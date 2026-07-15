-- 工作流：更新水位表
-- 节点序号：6
-- 节点名称：为指定ASIN、国家的所有日期创建或更新汇总记录（单量版）
-- 参数：:asin、:country
-- 节点说明：
-- 1、汇总补货、库存（取基础库存各店铺的可售+待调仓的合计）、在途
-- 2、基准销量：合并销量/类型系数（最大值）
-- 3、加权基准销量：过去30天按0.95指数衰减，越近日期权重越高，并按有效基准销量日期归一化
-- 4、兼容领星昨日销量延迟：昨天仅回补销量和基准销量；其他汇总字段及加权销量仅更新今天及以后

INSERT INTO daily_sales (
    asin, country, shop, sales, model, shop_country_asin_date, date,
    inventory, sale_inventory, coefficient, week, base_sales, weighted_sales, days_for_sale,
    `add`, on_the_way, maybe_sales, overseas_warehouse_test_product,
    overseas_warehouse_new_product, type, sale_maybe_sales
)
WITH
filtered_sales_with_type AS (
    SELECT 
        asin, country, date, sales, inventory, coefficient, `add`, on_the_way,
        model, week, overseas_warehouse_test_product, overseas_warehouse_new_product, 
        maybe_sales, sale_inventory, sale_maybe_sales, type, sales_store,
        FIRST_VALUE(type) OVER (PARTITION BY asin, country, date ORDER BY coefficient DESC, type DESC) AS max_coeff_type
    FROM daily_sales
    WHERE shop <> '合计'
      AND asin = :asin
      AND country = :country
),
summary_sales_store AS (
    SELECT asin, country, date, sales_store
    FROM daily_sales
    WHERE shop = '合计'
      AND sales_store IS NOT NULL
      AND asin = :asin
      AND country = :country
),
real_inventory_agg AS (
    SELECT
        asin,
        country,
        date,
        SUM(COALESCE(afn_fulfillable_quantity, 0) + COALESCE(reserved_fc_transfers, 0)) AS calculated_inv,
        SUM(COALESCE(afn_fulfillable_quantity, 0) + COALESCE(reserved_fc_transfers, 0)) AS calculated_sale_inv  -- ✅ 新增
    FROM inventory_base
    WHERE asin = :asin
      AND country = :country
      AND date >= (
          SELECT MIN(date)
          FROM daily_sales
          WHERE shop <> '合计'
            AND asin = :asin
            AND country = :country
      )
    GROUP BY asin, country, date
),
shop_combined AS (
    SELECT
        asin, country, date,
        SUM(`add`) AS total_add,
        SUM(on_the_way) AS total_on_the_way,
        SUM(sales) AS total_sales,
        SUM(COALESCE(maybe_sales, 0)) AS total_maybe_sales,
        MAX(coefficient) AS max_coefficient,
        MAX(max_coeff_type) AS max_coeff_type,
        MAX(model) AS model,
        MAX(week) AS week,
        MAX(overseas_warehouse_test_product) AS overseas_warehouse_test_product,
        MAX(overseas_warehouse_new_product) AS overseas_warehouse_new_product,
        SUM(COALESCE(sale_inventory, 0)) AS total_sale_inventory,
        SUM(sale_maybe_sales) AS total_sale_maybe_sales,
        SUM(CASE WHEN sale_maybe_sales > 0 THEN COALESCE(maybe_sales, 0) ELSE 0 END) AS total_maybe_sales_filtered
    FROM filtered_sales_with_type
    GROUP BY asin, country, date
),
base_calculated AS (
    SELECT
        sc.*,
        COALESCE(inv.calculated_inv, 0) AS final_inventory,
        COALESCE(inv.calculated_sale_inv, 0) AS final_sale_inventory,  -- ✅ 新增
        sc.total_sales / NULLIF(sc.max_coefficient, 0) AS daily_base_sales
    FROM shop_combined sc
    LEFT JOIN real_inventory_agg inv
        ON sc.asin = inv.asin AND sc.country = inv.country AND sc.date = inv.date
),
sales_history AS (
    SELECT asin, country, daily_base_sales,
           ROW_NUMBER() OVER (PARTITION BY asin, country ORDER BY date DESC) AS row_num,
           COUNT(*) OVER (PARTITION BY asin, country) AS total_count
    FROM base_calculated
    WHERE date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY)
),
weighted_sales_current AS (
    SELECT
        asin, country,
        ROUND(
            SUM(
                CASE
                    WHEN daily_base_sales IS NOT NULL
                    THEN daily_base_sales * POWER(0.95, row_num - 1)
                    ELSE 0
                END
            ) / NULLIF(
                SUM(
                    CASE
                        WHEN daily_base_sales IS NOT NULL
                        THEN POWER(0.95, row_num - 1)
                        ELSE 0
                    END
                ),
                0
            ),
            1
        ) AS weighted_sales
    FROM sales_history
    GROUP BY asin, country
)
SELECT
    bc.asin, bc.country, '合计', bc.total_sales, bc.model,
    CONCAT('合计_', bc.country, '_', bc.asin, '_', REPLACE(bc.date, '-', '')), bc.date,

    bc.final_inventory,
    bc.final_sale_inventory,  -- ✅ 替换原来的 bc.total_sale_inventory

    ROUND(bc.max_coefficient, 2), bc.week, bc.daily_base_sales,

    COALESCE(
        w.weighted_sales,
        ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
        0
    ) AS weighted_sales,

    CASE
        WHEN bc.final_inventory <= 0 THEN 0
        WHEN COALESCE(
                 w.weighted_sales,
                 ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
                 0
             ) > 0
        THEN LEAST(
            FLOOR(
                bc.final_inventory / COALESCE(
                    w.weighted_sales,
                    ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
                    0
                )
            ),
            65535
        )
        ELSE NULL
    END AS days_for_sale,

    bc.total_add, bc.total_on_the_way,

    FLOOR(
        bc.max_coefficient * COALESCE(
            w.weighted_sales,
            ROUND(bc.total_maybe_sales / NULLIF(bc.max_coefficient, 0), 1),
            0
        )
    ) AS maybe_sales,

    bc.overseas_warehouse_test_product, bc.overseas_warehouse_new_product, bc.max_coeff_type,

    COALESCE((
        SELECT ds.sale_maybe_sales
        FROM daily_sales ds
        INNER JOIN summary_sales_store sss
            ON sss.asin = bc.asin
           AND sss.country = bc.country
           AND sss.date = bc.date
        WHERE ds.asin = bc.asin
          AND ds.country = bc.country
          AND ds.date = bc.date
          AND ds.shop = sss.sales_store
        LIMIT 1
    ), 0) AS sale_maybe_sales

FROM base_calculated bc
LEFT JOIN weighted_sales_current w
    ON bc.asin = w.asin AND bc.country = w.country

ON DUPLICATE KEY UPDATE
    daily_sales.sales =
        CASE
            WHEN VALUES(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN VALUES(sales)
            ELSE daily_sales.sales
        END,
    daily_sales.model =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(model)
            ELSE daily_sales.model
        END,
    daily_sales.coefficient =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(coefficient)
            ELSE daily_sales.coefficient
        END,
    daily_sales.base_sales =
        CASE
            WHEN VALUES(date) >= DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN VALUES(base_sales)
            ELSE daily_sales.base_sales
        END,
    daily_sales.type =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(type)
            ELSE daily_sales.type
        END,

    daily_sales.inventory =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(inventory)
            ELSE daily_sales.inventory
        END,

    daily_sales.sale_inventory =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(sale_inventory)
            ELSE daily_sales.sale_inventory
        END,

    daily_sales.maybe_sales =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(maybe_sales)
            ELSE daily_sales.maybe_sales
        END,

    daily_sales.sale_maybe_sales =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(sale_maybe_sales)
            ELSE daily_sales.sale_maybe_sales
        END,

    daily_sales.weighted_sales =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(weighted_sales)
            ELSE daily_sales.weighted_sales
        END,

    daily_sales.`add` =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(`add`)
            ELSE daily_sales.`add`
        END,

    daily_sales.on_the_way =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(on_the_way)
            ELSE daily_sales.on_the_way
        END,

    daily_sales.overseas_warehouse_test_product =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(overseas_warehouse_test_product)
            ELSE daily_sales.overseas_warehouse_test_product
        END,

    daily_sales.overseas_warehouse_new_product =
        CASE
            WHEN VALUES(date) >= CURDATE() THEN VALUES(overseas_warehouse_new_product)
            ELSE daily_sales.overseas_warehouse_new_product
        END;
