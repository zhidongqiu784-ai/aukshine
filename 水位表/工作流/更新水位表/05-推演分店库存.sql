-- 工作流：更新水位表
-- 节点序号：5
-- 节点名称：分店铺库存推演
-- 节点说明：
-- 基于今天的基础库存，预测未来每天的库存水平和可售天数

-- 1. 设置递归深度
SET SESSION cte_max_recursion_depth = 1000;

-- 2. 递归推演每日库存（maybe_sales 扣减，更新 inventory）
CREATE TEMPORARY TABLE temp_inventory_prediction AS
WITH RECURSIVE inventory_calc AS (
    -- 初始成员：今天的实际库存
    SELECT
        asin, country, shop, `date`,
        CAST(inventory AS SIGNED) + CAST(COALESCE(`add`, 0) AS SIGNED) AS calc_inv,
        CAST(COALESCE(maybe_sales, 0) AS SIGNED) AS m_sales,
        CAST(0 AS SIGNED) AS m_add
    FROM daily_sales
    WHERE `date` = CURDATE() AND shop <> '合计'

    UNION ALL

    SELECT
        d.asin, d.country, d.shop, d.date,
        CASE
            WHEN COALESCE(d.`add`, 0) > 0
                 AND (f.calc_inv - f.m_sales) < 0 THEN
                CAST(d.`add` AS SIGNED)
            ELSE
                (f.calc_inv - f.m_sales) + CAST(COALESCE(d.`add`, 0) AS SIGNED)
        END AS calc_inv,
        CAST(COALESCE(d.maybe_sales, 0) AS SIGNED),
        CAST(COALESCE(d.`add`, 0) AS SIGNED)
    FROM daily_sales d
    INNER JOIN inventory_calc f
        ON d.asin = f.asin
           AND d.country = f.country
           AND d.shop = f.shop
           AND d.date = DATE_ADD(f.date, INTERVAL 1 DAY)
    WHERE d.shop <> '合计'
)
SELECT asin, country, shop, `date`, calc_inv
FROM inventory_calc;

-- 3. 索引优化
ALTER TABLE temp_inventory_prediction ADD INDEX idx_lookup (`date`, shop, asin, country);

-- 4. 更新分店铺库存
UPDATE daily_sales AS cur
JOIN temp_inventory_prediction AS x
    ON x.`date` = cur.`date`
   AND x.shop = cur.shop
   AND x.asin = cur.asin
   AND x.country = cur.country
SET
    cur.inventory = x.calc_inv,
    cur.days_for_sale = CASE
        WHEN x.calc_inv <= 0 THEN 0
        WHEN cur.weighted_sales > 0 THEN FLOOR(x.calc_inv / cur.weighted_sales)
        ELSE 0
    END
WHERE cur.shop <> '合计'
  AND cur.`date` >= CURDATE();

-- -------------------------------------------------------------------
-- 4B. 销售预估库存递推（sale_inventory）
--     ✅ 初始成员复用 temp_inventory_prediction 今天的 calc_inv
--        保证今天 sale_inventory = inventory，明天起按 sale_maybe_sales 分叉
-- -------------------------------------------------------------------
CREATE TEMPORARY TABLE temp_sale_inventory_prediction AS
WITH RECURSIVE sale_inventory_calc AS (

    -- 初始成员：直接用 temp_inventory_prediction 今天的 calc_inv，不再读 inventory
    SELECT
        tip.asin, tip.country, tip.shop, tip.`date`,
        tip.calc_inv AS sale_calc_inv,
        CAST(
            COALESCE(
                CASE
                    WHEN d.sale_maybe_sales IS NOT NULL THEN d.sale_maybe_sales
                    ELSE d.maybe_sales
                END, 0
            ) AS SIGNED
        ) AS s_sales,
        CAST(0 AS SIGNED) AS s_add
    FROM temp_inventory_prediction tip
    JOIN daily_sales d
        ON d.`date` = tip.`date`
       AND d.asin = tip.asin
       AND d.country = tip.country
       AND d.shop = tip.shop
    WHERE tip.`date` = CURDATE()

    UNION ALL

    -- 递归成员：从明天起按 sale_maybe_sales 扣减
    SELECT
        d.asin, d.country, d.shop, d.date,
        CASE
            WHEN COALESCE(d.`add`, 0) > 0
                 AND (f.sale_calc_inv - f.s_sales) < 0 THEN
                CAST(d.`add` AS SIGNED)
            ELSE
                (f.sale_calc_inv - f.s_sales) + CAST(COALESCE(d.`add`, 0) AS SIGNED)
        END AS sale_calc_inv,
        CAST(
            COALESCE(
                CASE
                    WHEN d.sale_maybe_sales IS NOT NULL THEN d.sale_maybe_sales
                    ELSE d.maybe_sales
                END, 0
            ) AS SIGNED
        ) AS s_sales,
        CAST(COALESCE(d.`add`, 0) AS SIGNED) AS s_add
    FROM daily_sales d
    INNER JOIN sale_inventory_calc f
        ON d.asin = f.asin
           AND d.country = f.country
           AND d.shop = f.shop
           AND d.date = DATE_ADD(f.date, INTERVAL 1 DAY)
    WHERE d.shop <> '合计'
)
SELECT asin, country, shop, `date`, sale_calc_inv
FROM sale_inventory_calc;

ALTER TABLE temp_sale_inventory_prediction
    ADD INDEX idx_sale_lookup (`date`, shop, asin, country);

-- 4C. 写回 sale_inventory + estimate_days_for_sales
UPDATE daily_sales AS cur
JOIN temp_sale_inventory_prediction AS x
    ON x.`date` = cur.`date`
   AND x.shop = cur.shop
   AND x.asin = cur.asin
   AND x.country = cur.country
SET
    cur.sale_inventory = x.sale_calc_inv,
    cur.estimate_days_for_sales = CASE
        WHEN x.sale_calc_inv <= 0 THEN 0
        WHEN cur.weighted_sales > 0 THEN FLOOR(x.sale_calc_inv / cur.weighted_sales)
        ELSE 0
    END
WHERE cur.shop <> '合计'
  AND cur.`date` >= CURDATE();

-- 5. 同步更新"在途"数据
CREATE TEMPORARY TABLE temp_on_the_way_calc AS
SELECT
    asin, country, shop, `date`,
    COALESCE(SUM(`add`) OVER (
        PARTITION BY asin, country, shop
        ORDER BY `date`
        ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
    ), 0) AS total_add
FROM daily_sales
WHERE `date` >= CURDATE() - INTERVAL 30 DAY
  AND shop <> '合计';

ALTER TABLE temp_on_the_way_calc ADD INDEX idx_join (asin, country, shop, `date`);

UPDATE daily_sales AS tgt
JOIN temp_on_the_way_calc AS src
    ON src.asin = tgt.asin
   AND src.country = tgt.country
   AND src.shop = tgt.shop
   AND src.`date` = tgt.`date`
SET tgt.on_the_way = src.total_add
WHERE tgt.shop <> '合计'
  AND tgt.`date` >= CURDATE() - INTERVAL 30 DAY;

-- 6. 清理
DROP TEMPORARY TABLE IF EXISTS temp_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_on_the_way_calc;
