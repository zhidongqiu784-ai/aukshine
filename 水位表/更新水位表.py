# 使用提醒:
# 1. xbot包提供软件自动化、数据表格、Excel、日志、AI等功能
# 2. package包提供访问当前应用数据的功能，如获取元素、访问全局变量、获取资源文件等功能
# 3. 当此模块作为流程独立运行时执行main函数
# 4. 可视化流程中可以通过"调用模块"的指令使用此模块

import time
from datetime import datetime

import mysql.connector
import xbot
from xbot import print

from . import package
from .package import variables as glv


_xbot_print = print


def print(message="", *args, **kwargs):
    """让影刀日志每条都是单行，避免前导换行导致列表里显示省略号。"""
    if args:
        message = " ".join([str(message)] + [str(arg) for arg in args])
    lines = str(message).splitlines()
    while lines and lines[0].strip() == "":
        lines.pop(0)
    for line in lines:
        if line.strip():
            _xbot_print(line, **kwargs)


DB_CONF = {
    "host": glv.get("A_host"),
    "user": glv.get("A_user"),
    "password": glv.get("A_password"),
    "database": glv.get("A_nocobase"),
    "port": 3306,
    "connection_timeout": 15,
}

QUERY_TIMEOUT_SECONDS = 600
LOCK_WAIT_TIMEOUT_SECONDS = 60
RUN_LOCK_NAME = "water_level_update_v1"
RUN_LOCK_WAIT_SECONDS = 0


SQL_STEPS = (
    (
        "01-更新分店库存",
        r"""-- 工作流：更新水位表
-- 节点序号：1
-- 节点名称：更新水位表分店铺的库存为0点基准库存的可售+待调仓

UPDATE daily_sales AS ds
LEFT JOIN inventory_base AS cs
    ON cs.asin = ds.asin
    AND cs.country = ds.country
    AND cs.shop = ds.shop
    AND cs.date = ds.date
LEFT JOIN woot_statistics AS ws
    ON ds.asin = ws.asin
    AND ds.country = ws.country
    AND ds.date = ws.date
SET
    ds.inventory = CASE
        WHEN ds.shop = 'woot' THEN COALESCE(ws.remaining_stock, 0)
        ELSE COALESCE(cs.afn_fulfillable_quantity, 0) + COALESCE(cs.reserved_fc_transfers, 0)
    END,
    ds.sale_inventory = CASE
        WHEN ds.shop = 'woot' THEN COALESCE(ws.remaining_stock, 0)
        ELSE COALESCE(cs.afn_fulfillable_quantity, 0) + COALESCE(cs.reserved_fc_transfers, 0)
    END
WHERE ds.date = CURDATE()
  AND ds.shop <> '合计';""",
    ),
    (
        "02-计算基准销量",
        r"""-- 工作流：更新水位表
-- 节点序号：2
-- 节点名称：将同一country、asin、date下的基准销量设置为合并销量(sales)/代表日类型系数，更新今天及以后的数据

UPDATE daily_sales ds
JOIN (
    SELECT
        asin,
        country,
        date,
        SUM(sales) AS total_sales,
        MAX(CASE WHEN type_rank = 1 THEN coefficient END) AS target_coefficient,
        CAST(
            ROUND(SUM(sales) / NULLIF(MAX(CASE WHEN type_rank = 1 THEN coefficient END), 0), 0)
            AS SIGNED
        ) AS calculated_base_sales
    FROM (
        SELECT
            asin,
            country,
            date,
            shop,
            sales,
            coefficient,
            type,
            ROW_NUMBER() OVER (
                PARTITION BY asin, country, date
                ORDER BY
                    category_priority,
                    coefficient IS NULL,
                    coefficient DESC,
                    type DESC,
                    shop DESC
            ) AS type_rank
        FROM (
            SELECT
                base.asin,
                base.country,
                base.date,
                base.shop,
                base.sales,
                base.coefficient,
                base.type,
                COALESCE((
                    SELECT MIN(
                        CASE dtt.daytype_category
                            WHEN '大促BDLD' THEN 1
                            WHEN '基础活动类型' THEN 2
                            WHEN '专享类型' THEN 3
                            WHEN '固定活动类型' THEN 4
                            WHEN '叠加基础类型' THEN 5
                            WHEN '基础类型' THEN 6
                            WHEN '不参与' THEN 7
                            ELSE 9
                        END
                    )
                    FROM datetypetime AS dtt
                    WHERE dtt.daytype IS NOT NULL
                      AND base.type IS NOT NULL
                      AND FIND_IN_SET(dtt.daytype, REPLACE(base.type, '、', ',')) > 0
                      AND FIND_IN_SET(base.country, dtt.country) > 0
                ), 9) AS category_priority
            FROM daily_sales AS base
            WHERE base.shop != '合计'
        ) categorized
    ) ranked
    GROUP BY asin, country, date
) agg ON ds.asin = agg.asin
      AND ds.country = agg.country
      AND ds.date = agg.date
SET ds.base_sales = agg.calculated_base_sales
WHERE ds.shop != '合计'
  AND ds.date >= CURDATE();""",
    ),
    (
        "03-计算加权基准销量",
        r"""-- 工作流：更新水位表
-- 节点序号：3
-- 节点名称：更新每个店铺的加权基准销量weighted_sales 字段，使其在同一国家、ASIN和日期下保持一致。更新今天及以后的数据

UPDATE daily_sales AS d
JOIN (
    WITH base_sales_history AS (
        SELECT
            asin,
            country,
            date,
            base_sales
        FROM daily_sales
        WHERE shop = '合计'
          AND base_sales IS NOT NULL
          AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY)
    ),
    sales_history AS (
        SELECT
            asin,
            country,
            base_sales,
            ROW_NUMBER() OVER (PARTITION BY asin, country ORDER BY date DESC) AS row_num,
            COUNT(*) OVER (PARTITION BY asin, country) AS total_count
        FROM base_sales_history
    ),
    weighted_avg AS (
        SELECT
            asin,
            country,
            ROUND(
                CASE
                    WHEN total_count BETWEEN 1 AND 3 THEN AVG(base_sales)
                    WHEN total_count BETWEEN 4 AND 7 THEN
                        (AVG(CASE WHEN row_num <= CEIL(total_count*0.3) THEN base_sales END)*0.7
                         + AVG(CASE WHEN row_num > CEIL(total_count*0.3) THEN base_sales END)*0.3)
                    WHEN total_count BETWEEN 8 AND 15 THEN
                        (AVG(CASE WHEN row_num <= CEIL(total_count*0.33) THEN base_sales END)*0.6
                         + AVG(CASE WHEN row_num BETWEEN CEIL(total_count*0.33)+1 AND CEIL(total_count*0.66) THEN base_sales END)*0.3
                         + AVG(CASE WHEN row_num > CEIL(total_count*0.66) THEN base_sales END)*0.1)
                    ELSE
                        (AVG(CASE WHEN row_num <= 7 THEN base_sales END)*0.5
                         + AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN base_sales END)*0.3
                         + AVG(CASE WHEN row_num BETWEEN 16 AND 30 THEN base_sales END)*0.2)
                END
            , 1) AS weighted_sales_value
        FROM sales_history
        GROUP BY asin, country
    )
    SELECT DISTINCT
        d2.asin,
        d2.country,
        d2.date,
        w.weighted_sales_value
    FROM daily_sales d2
    LEFT JOIN weighted_avg w ON d2.asin = w.asin AND d2.country = w.country
    WHERE d2.shop <> '合计'
      AND d2.date >= CURDATE()
) AS r
  ON r.asin = d.asin
 AND r.country = d.country
 AND r.date = d.date
SET d.weighted_sales = r.weighted_sales_value
WHERE d.shop <> '合计' AND d.date >= CURDATE();""",
    ),
    (
        "04-更新预估销量",
        r"""-- 工作流：更新水位表
-- 节点序号：4
-- 节点名称：更新今天及未来日期的预估销量

UPDATE nocobase.daily_sales
SET maybe_sales = CAST(ROUND(weighted_sales * coefficient, 0) AS SIGNED)
WHERE date >= CURRENT_DATE
  AND shop <> '合计';""",
    ),
    (
        "05-推演分店库存",
        r"""-- 工作流：更新水位表
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
DROP TEMPORARY TABLE IF EXISTS temp_on_the_way_calc;""",
    ),
    (
        "06-生成合计记录",
        r"""-- 工作流：更新水位表
-- 节点序号：6
-- 节点名称：为同一ASIN、国家、日期的所有店铺数据创建汇总记录（"合计"记录）
-- 节点说明：
-- 1、汇总补货、库存（取基础库存各店铺的可售+待调仓的合计）、在途
-- 2、基准销量：合并销量/代表日类型系数
-- 3、加权基准销量：按过去30天的平均值，但是过去7天的权重为50%，过去8-15天的权重30%，过去16-30天的权重为20%
-- 4、兼容领星昨日销量延迟：昨天仅回补销量和基准销量；其他汇总字段及加权销量仅更新今天及以后

INSERT INTO daily_sales (
    asin, country, shop, sales, model, shop_country_asin_date, date,
    inventory, sale_inventory, coefficient, week, base_sales, weighted_sales, days_for_sale,
    `add`, on_the_way, maybe_sales, overseas_warehouse_test_product,
    overseas_warehouse_new_product, type, sale_maybe_sales
)
WITH
categorized_sales AS (
    SELECT
        ds.asin, ds.country, ds.date, ds.shop, ds.sales, ds.inventory, ds.coefficient,
        ds.`add`, ds.on_the_way, ds.model, ds.week,
        ds.overseas_warehouse_test_product, ds.overseas_warehouse_new_product,
        ds.maybe_sales, ds.sale_inventory, ds.sale_maybe_sales, ds.type, ds.sales_store,
        COALESCE((
            SELECT MIN(
                CASE dtt.daytype_category
                    WHEN '大促BDLD' THEN 1
                    WHEN '基础活动类型' THEN 2
                    WHEN '专享类型' THEN 3
                    WHEN '固定活动类型' THEN 4
                    WHEN '叠加基础类型' THEN 5
                    WHEN '基础类型' THEN 6
                    WHEN '不参与' THEN 7
                    ELSE 9
                END
            )
            FROM datetypetime AS dtt
            WHERE dtt.daytype IS NOT NULL
              AND ds.type IS NOT NULL
              AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
              AND FIND_IN_SET(ds.country, dtt.country) > 0
        ), 9) AS category_priority
    FROM daily_sales AS ds
    WHERE ds.shop <> '合计'
),
filtered_sales_with_type AS (
    SELECT
        asin, country, date, shop, sales, inventory, coefficient, `add`, on_the_way,
        model, week, overseas_warehouse_test_product, overseas_warehouse_new_product,
        maybe_sales, sale_inventory, sale_maybe_sales, type, sales_store,
        ROW_NUMBER() OVER (
            PARTITION BY asin, country, date
            ORDER BY
                category_priority,
                coefficient IS NULL,
                coefficient DESC,
                type DESC,
                shop DESC
        ) AS type_rank
    FROM categorized_sales
),
summary_sales_store AS (
    SELECT asin, country, date, sales_store
    FROM daily_sales
    WHERE shop = '合计'
      AND sales_store IS NOT NULL
),
real_inventory_agg AS (
    SELECT
        asin,
        country,
        date,
        SUM(COALESCE(afn_fulfillable_quantity, 0) + COALESCE(reserved_fc_transfers, 0)) AS calculated_inv,
        SUM(COALESCE(afn_fulfillable_quantity, 0) + COALESCE(reserved_fc_transfers, 0)) AS calculated_sale_inv  -- ✅ 新增
    FROM inventory_base
    WHERE date >= (SELECT MIN(date) FROM daily_sales WHERE shop <> '合计')
    GROUP BY asin, country, date
),
shop_combined AS (
    SELECT
        asin, country, date,
        SUM(`add`) AS total_add,
        SUM(on_the_way) AS total_on_the_way,
        SUM(sales) AS total_sales,
        SUM(COALESCE(maybe_sales, 0)) AS total_maybe_sales,
        MAX(CASE WHEN type_rank = 1 THEN coefficient END) AS max_coefficient,
        MAX(CASE WHEN type_rank = 1 THEN type END) AS max_coeff_type,
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
        CAST(
            ROUND(sc.total_sales / NULLIF(sc.max_coefficient, 0), 0)
            AS SIGNED
        ) AS calculated_base_sales
    FROM shop_combined sc
    LEFT JOIN real_inventory_agg inv
        ON sc.asin = inv.asin AND sc.country = inv.country AND sc.date = inv.date
),
base_sales_history AS (
    SELECT asin, country, date, base_sales
    FROM daily_sales
    WHERE shop = '合计'
      AND base_sales IS NOT NULL
      AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY)
),
sales_history AS (
    SELECT asin, country, base_sales,
           ROW_NUMBER() OVER (PARTITION BY asin, country ORDER BY date DESC) AS row_num,
           COUNT(*) OVER (PARTITION BY asin, country) AS total_count
    FROM base_sales_history
),
weighted_sales_current AS (
    SELECT
        asin, country,
        ROUND(
            CASE
                WHEN total_count BETWEEN 1 AND 3 THEN AVG(base_sales)
                WHEN total_count BETWEEN 4 AND 7 THEN
                    (AVG(CASE WHEN row_num <= CEIL(total_count*0.3) THEN base_sales END)*0.7
                     + AVG(CASE WHEN row_num >  CEIL(total_count*0.3) THEN base_sales END)*0.3)
                WHEN total_count BETWEEN 8 AND 15 THEN
                    (AVG(CASE WHEN row_num <= CEIL(total_count*0.33) THEN base_sales END)*0.6
                     + AVG(CASE WHEN row_num BETWEEN CEIL(total_count*0.33)+1 AND CEIL(total_count*0.66) THEN base_sales END)*0.3
                     + AVG(CASE WHEN row_num >  CEIL(total_count*0.66) THEN base_sales END)*0.1)
                ELSE
                    (AVG(CASE WHEN row_num <= 7 THEN base_sales END)*0.5
                     + AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN base_sales END)*0.3
                     + AVG(CASE WHEN row_num BETWEEN 16 AND 30 THEN base_sales END)*0.2)
            END, 1
        ) AS weighted_sales
    FROM sales_history
    GROUP BY asin, country
)
SELECT
    bc.asin, bc.country, '合计', bc.total_sales, bc.model,
    CONCAT('合计_', bc.country, '_', bc.asin, '_', REPLACE(bc.date, '-', '')), bc.date,

    bc.final_inventory,
    bc.final_sale_inventory,  -- ✅ 替换原来的 bc.total_sale_inventory

    ROUND(bc.max_coefficient, 2), bc.week, bc.calculated_base_sales,

    w.weighted_sales,

    CASE
        WHEN bc.final_inventory <= 0 THEN 0
        WHEN w.weighted_sales > 0
        THEN LEAST(
            FLOOR(bc.final_inventory / w.weighted_sales),
            65535
        )
        ELSE NULL
    END AS days_for_sale,

    bc.total_add, bc.total_on_the_way,

    CAST(
        ROUND(
            bc.max_coefficient * w.weighted_sales,
            0
        ) AS SIGNED
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
        END;""",
    ),
    (
        "07-预测合计行BD",
        r"""-- 工作流：更新水位表
-- 节点序号：7
-- 节点名称：合计行BD预测

SET SESSION cte_max_recursion_depth = 1000;

DROP TEMPORARY TABLE IF EXISTS temp_summary_bd_prediction_days;

CREATE TEMPORARY TABLE temp_summary_bd_prediction_days AS
WITH RECURSIVE
real_bd_days AS (
    SELECT
        asin,
        country,
        `date`,
        CASE
            WHEN country IN ('DE', 'FR', 'ES', 'IT', 'UK') THEN 8
            ELSE 22
        END AS gap_days,
        DATE_SUB(
            `date`,
            INTERVAL ROW_NUMBER() OVER (
                PARTITION BY asin, country
                ORDER BY `date`
            ) DAY
        ) AS grp_key
    FROM daily_sales ds
    WHERE shop = '合计'
      AND type IS NOT NULL
      AND type NOT LIKE '%预测%'
      AND EXISTS (
          SELECT 1
          FROM datetypetime dtt
          WHERE dtt.daytype IS NOT NULL
            AND dtt.daytype_category <> '固定活动类型'
            AND dtt.daytype LIKE 'BD%'
            AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
            AND FIND_IN_SET(ds.country, dtt.country) > 0
      )
      AND asin IS NOT NULL
      AND asin != ''
      AND country IN ('US', 'CA', 'JP', 'DE', 'FR', 'ES', 'IT', 'UK')
      AND `date` BETWEEN DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                      AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
),
real_bd_segments AS (
    SELECT
        asin,
        country,
        MIN(`date`) AS bd_start_date,
        MAX(`date`) AS bd_end_date,
        MAX(gap_days) AS gap_days
    FROM real_bd_days
    GROUP BY asin, country, grp_key
),
last_bd AS (
    SELECT
        real_bd_segments.*,
        ROW_NUMBER() OVER (
            PARTITION BY asin, country
            ORDER BY bd_end_date DESC, bd_start_date DESC
        ) AS rn
    FROM real_bd_segments
),
predicted_bd AS (
    SELECT
        asin,
        country,
        gap_days,
        DATE_ADD(bd_end_date, INTERVAL gap_days DAY) AS pred_start_date
    FROM last_bd
    WHERE rn = 1

    UNION ALL

    SELECT
        asin,
        country,
        gap_days,
        DATE_ADD(pred_start_date, INTERVAL (13 + gap_days) DAY) AS pred_start_date
    FROM predicted_bd
    WHERE pred_start_date <= DATE_ADD(CURDATE(), INTERVAL 180 DAY)
),
blocked_days AS (
    SELECT
        asin,
        country,
        type,
        `date`,
        DATE_SUB(
            `date`,
            INTERVAL ROW_NUMBER() OVER (
                PARTITION BY asin, country, type
                ORDER BY `date`
            ) DAY
        ) AS grp_key
    FROM daily_sales ds
    WHERE shop = '合计'
      AND type IS NOT NULL
      AND type NOT LIKE '%预测%'
      AND EXISTS (
          SELECT 1
          FROM datetypetime dtt
          WHERE dtt.daytype IS NOT NULL
            AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
            AND dtt.daytype_category <> '固定活动类型'
            AND (
                   dtt.daytype LIKE 'BD%'
                OR dtt.daytype LIKE 'LD%'
                OR dtt.daytype_category = '专享类型'
            )
            AND FIND_IN_SET(ds.country, dtt.country) > 0
      )
      AND `date` BETWEEN DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                      AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
),
blocked_segments AS (
    SELECT
        asin,
        country,
        MIN(`date`) AS block_start_date,
        MAX(`date`) AS block_end_date
    FROM blocked_days
    GROUP BY asin, country, type, grp_key
),
valid_predicted_bd AS (
    SELECT
        p.asin,
        p.country,
        p.pred_start_date,
        DATE_ADD(p.pred_start_date, INTERVAL 13 DAY) AS pred_end_date
    FROM predicted_bd p
    WHERE p.pred_start_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 8 DAY)
                                AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
      AND NOT EXISTS (
          SELECT 1
          FROM blocked_segments bs
          WHERE bs.asin = p.asin
            AND bs.country = p.country
            AND (
                (
                    bs.block_start_date <= DATE_ADD(p.pred_start_date, INTERVAL 13 DAY)
                    AND bs.block_end_date >= p.pred_start_date
                )
                OR ABS(DATEDIFF(bs.block_start_date, p.pred_start_date)) <= 7
            )
      )
),
day_offsets AS (
    SELECT 0 AS day_offset
    UNION ALL
    SELECT day_offset + 1
    FROM day_offsets
    WHERE day_offset < 13
)
SELECT
    vpb.asin,
    vpb.country,
    DATE_ADD(vpb.pred_start_date, INTERVAL day_offsets.day_offset DAY) AS pred_date
FROM valid_predicted_bd vpb
INNER JOIN day_offsets ON 1 = 1
WHERE DATE_ADD(vpb.pred_start_date, INTERVAL day_offsets.day_offset DAY)
      BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

ALTER TABLE temp_summary_bd_prediction_days
ADD INDEX idx_summary_pred (asin, country, pred_date);

UPDATE daily_sales ds
INNER JOIN temp_summary_bd_prediction_days pred
    ON ds.asin = pred.asin
   AND ds.country = pred.country
   AND ds.date = pred.pred_date
SET ds.type = 'BD（预测）'
WHERE ds.shop = '合计'
  AND (
      ds.type IS NULL
      OR TRIM(ds.type) = ''
      OR NOT EXISTS (
          SELECT 1
          FROM datetypetime dtt
          WHERE dtt.daytype IS NOT NULL
            AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
            AND dtt.daytype_category <> '固定活动类型'
            AND (
                   dtt.daytype LIKE 'BD%'
                OR dtt.daytype LIKE 'LD%'
                OR dtt.daytype_category = '专享类型'
            )
            AND FIND_IN_SET(ds.country, dtt.country) > 0
      )
  )
  AND ds.date BETWEEN CURDATE()
                  AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

UPDATE daily_sales ds
INNER JOIN sales_coefficient sc
    ON ds.asin = sc.asin
   AND ds.country = sc.country
   AND sc.type = 'BD'
SET ds.coefficient = sc.coefficient
WHERE ds.shop = '合计'
  AND ds.type = 'BD（预测）'
  AND ds.`date` BETWEEN CURDATE()
                    AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

UPDATE daily_sales
SET maybe_sales = CAST(ROUND(weighted_sales * coefficient, 0) AS SIGNED)
WHERE shop = '合计'
  AND type = 'BD（预测）'
  AND date BETWEEN CURDATE()
              AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

DROP TEMPORARY TABLE IF EXISTS temp_summary_bd_prediction_days;""",
    ),
    (
        "08-修正合计库存结余",
        r"""-- 工作流：更新水位表
-- 节点序号：8
-- 节点名称：修正合计行的库存结余

SET SESSION cte_max_recursion_depth = 2000;

-- =========================================================
-- 2) inventory 模拟（去掉 is_active）
-- =========================================================
DROP TEMPORARY TABLE IF EXISTS temp_inventory_simulation;

CREATE TEMPORARY TABLE temp_inventory_simulation AS
WITH RECURSIVE total_calc AS (
    SELECT
        asin,
        country,
        shop,
        `date`,

        CAST(inventory AS SIGNED) + CAST(COALESCE(`add`, 0) AS SIGNED) AS calc_inv,
        CAST(COALESCE(maybe_sales, 0) AS SIGNED) AS demand,
        CAST(COALESCE(`add`, 0) AS SIGNED) AS replenishment

    FROM daily_sales
    WHERE `date` = CURDATE()
      AND shop = '合计'

    UNION ALL

    SELECT
        d.asin,
        d.country,
        d.shop,
        d.`date`,

        CASE
            WHEN (f.calc_inv - f.demand) < 0
                 AND CAST(COALESCE(d.`add`, 0) AS SIGNED) > 0
            THEN CAST(COALESCE(d.`add`, 0) AS SIGNED)

            ELSE f.calc_inv - f.demand + CAST(COALESCE(d.`add`, 0) AS SIGNED)
        END AS calc_inv,

        CAST(COALESCE(d.maybe_sales, 0) AS SIGNED) AS demand,
        CAST(COALESCE(d.`add`, 0) AS SIGNED) AS replenishment

    FROM daily_sales d
    INNER JOIN total_calc f
        ON d.asin = f.asin
       AND d.country = f.country
       AND d.shop = f.shop
       AND d.`date` = DATE_ADD(f.`date`, INTERVAL 1 DAY)
    WHERE d.shop = '合计'
)
SELECT * FROM total_calc;

ALTER TABLE temp_inventory_simulation ADD INDEX idx_update (`date`, asin, country);

UPDATE daily_sales AS cur
JOIN temp_inventory_simulation AS x
  ON x.`date` = cur.`date`
 AND x.asin = cur.asin
 AND x.country = cur.country
SET
    cur.inventory = x.calc_inv,
    cur.days_for_sale = CASE
        WHEN x.calc_inv <= 0 THEN 0
        WHEN cur.weighted_sales > 0 THEN FLOOR(x.calc_inv / cur.weighted_sales)
        ELSE 0
    END
WHERE cur.shop = '合计'
  AND cur.`date` >= CURDATE();

DROP TEMPORARY TABLE IF EXISTS temp_inventory_simulation;


-- =========================================================
-- 3) sale_inventory 模拟（去掉 is_active）
-- =========================================================
DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_simulation;

CREATE TEMPORARY TABLE temp_sale_inventory_simulation AS
WITH RECURSIVE sale_total_calc AS (
    SELECT
        asin,
        country,
        shop,
        `date`,

        CAST(sale_inventory AS SIGNED) + CAST(COALESCE(`add`, 0) AS SIGNED) AS sale_calc_inv,
        CAST(COALESCE(sale_maybe_sales, maybe_sales, 0) AS SIGNED) AS sale_demand,
        CAST(COALESCE(`add`, 0) AS SIGNED) AS replenishment

    FROM daily_sales
    WHERE `date` = CURDATE()
      AND shop = '合计'

    UNION ALL

    SELECT
        d.asin,
        d.country,
        d.shop,
        d.`date`,

        CASE
            WHEN (f.sale_calc_inv - f.sale_demand) < 0
                 AND CAST(COALESCE(d.`add`, 0) AS SIGNED) > 0
            THEN CAST(COALESCE(d.`add`, 0) AS SIGNED)

            ELSE f.sale_calc_inv - f.sale_demand + CAST(COALESCE(d.`add`, 0) AS SIGNED)
        END AS sale_calc_inv,

        CAST(COALESCE(d.sale_maybe_sales, d.maybe_sales, 0) AS SIGNED) AS sale_demand,
        CAST(COALESCE(d.`add`, 0) AS SIGNED) AS replenishment

    FROM daily_sales d
    INNER JOIN sale_total_calc f
        ON d.asin = f.asin
       AND d.country = f.country
       AND d.shop = f.shop
       AND d.`date` = DATE_ADD(f.`date`, INTERVAL 1 DAY)
    WHERE d.shop = '合计'
)
SELECT * FROM sale_total_calc;

ALTER TABLE temp_sale_inventory_simulation ADD INDEX idx_update (`date`, asin, country);

UPDATE daily_sales AS cur
JOIN temp_sale_inventory_simulation AS x
  ON x.`date` = cur.`date`
 AND x.asin = cur.asin
 AND x.country = cur.country
SET
    cur.sale_inventory = x.sale_calc_inv,
    cur.estimate_days_for_sales = CASE
        WHEN x.sale_calc_inv <= 0 THEN 0
        WHEN cur.weighted_sales > 0 THEN FLOOR(x.sale_calc_inv / cur.weighted_sales)
        ELSE 0
    END
WHERE cur.shop = '合计'
  AND cur.`date` >= CURDATE();

DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_simulation;""",
    ),
    (
        "09-更新合计库销比",
        r"""-- 工作流：更新水位表
-- 节点序号：9
-- 节点名称：更新今天及未来汇总数据的库销比（inv_sales_ratio）

UPDATE daily_sales
SET inv_sales_ratio = ROUND(
    (
        COALESCE(on_the_way, 0)
      + COALESCE(inventory, 0)
      + COALESCE(quantity_receive, 0)
      + COALESCE(overseas_warehouse_test_product, 0)
      + COALESCE(overseas_warehouse_new_product, 0)
    ) / NULLIF(weighted_sales, 0) / 30,
    2
)
WHERE shop = '合计'
  AND date >= CURDATE();""",
    ),
    (
        "10-发货计划演变-v2水位推演",
        r"""-- 工作流：更新水位表
-- 节点序号：10
-- 节点名称：发货计划演变 v2 水位推演（全量）
--
-- 业务口径：
-- 1. 真实未入库量内联复用“期望入库SQL - 修改版.sql”的真实发货口径：
--    delivery_note.quantity_shipped - fba_ship.received；保留超签收形成的负补货，旧模拟计划不进入 v2。
-- 2. 模拟计划只读取 simulate_shipment.plan_source = 'shipment_plan_v2'。
-- 3. 模拟计划已生成真实 delivery_note 时，按 shippment_id + asin 排除，避免重复计算。
-- 4. 不写 daily_sales 的旧字段。
-- 5. 本节点位于旧节点 09 之后；合计行今天 inventory = 真实总库存 + 旧 add。
--    因此 v2 今日锚点先用 inventory - old add 还原真实库存，再加 v2_add。
-- 6. 先完整计算并校验临时表，最后一次性写回 v2_*；无补货日写 NULL，旧日期不会残留旧值。
-- 7. v3.5 / 决策 23：只递推“合计”行；店铺层不做 v2 断货精算或计划分摊。
-- 8. v2 在途按“初始正补货总量 - 截至当天累计补货”递推；负补货会减少库存并等量恢复在途。

SET SESSION cte_max_recursion_depth = 1000;
SET @v2_calculated_at = NOW(3);

DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_keys;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_stage;

-- 所有防护条件都写入 CHECK 临时表；任一条件为 0 时 SQL 立即失败，正式字段保持不变。
CREATE TEMPORARY TABLE temp_v2_projection_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

CREATE TEMPORARY TABLE temp_v2_scope_dates AS
SELECT
    ds.asin,
    ds.country,
    ds.shop,
    ds.`date`,
    CASE
        WHEN ds.`date` = CURDATE()
        THEN CAST(COALESCE(ds.inventory, 0) AS SIGNED)
             - CAST(COALESCE(ds.`add`, 0) AS SIGNED)
        ELSE ds.inventory
    END AS inventory,
    ds.maybe_sales,
    ds.sale_maybe_sales,
    ds.weighted_sales
FROM daily_sales AS ds
WHERE ds.`date` >= CURDATE()
  AND ds.shop = '合计';

-- 必须有未来合计数据，且业务键、今日库存和每日记录都完整。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_scope_dates;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_dates
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR `date` IS NULL;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop, `date`
    FROM temp_v2_scope_dates
    GROUP BY asin, country, shop, `date`
    HAVING COUNT(*) <> 1
) AS duplicate_scope_rows;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop
    FROM temp_v2_scope_dates
    GROUP BY asin, country, shop
    HAVING SUM(`date` = CURDATE()) <> 1
) AS missing_today_rows;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_dates
WHERE `date` = CURDATE()
  AND inventory IS NULL;

CREATE TEMPORARY TABLE temp_v2_scope_gaps AS
SELECT asin, country, shop, previous_date, `date`
FROM (
    SELECT
        asin,
        country,
        shop,
        `date`,
        LAG(`date`) OVER (
            PARTITION BY asin, country, shop
            ORDER BY `date`
        ) AS previous_date
    FROM temp_v2_scope_dates
) AS ordered_scope
WHERE previous_date IS NOT NULL
  AND DATEDIFF(`date`, previous_date) <> 1;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_gaps;

ALTER TABLE temp_v2_scope_dates
    ADD UNIQUE INDEX idx_v2_scope_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_scope_keys AS
SELECT asin, country, shop
FROM temp_v2_scope_dates
GROUP BY asin, country, shop;

ALTER TABLE temp_v2_scope_keys
    ADD UNIQUE INDEX idx_v2_scope_business_key (asin, country, shop);

-- 重建 v2 补货来源：内联期望入库真实在途 + 新算法模拟计划。
CREATE TEMPORARY TABLE temp_v2_supply_raw AS
WITH real_shipment AS (
    SELECT
        '合计' AS shop,
        real_supply.country,
        real_supply.asin,
        real_supply.expected_storage_time,
        CAST(SUM(real_supply.qty_shipped - real_supply.received) AS SIGNED) AS qty_shipped,
        0 AS received
    FROM (
        SELECT
            dn.country,
            dn.asin,
            DATE(
                COALESCE(
                    NULLIF(TRIM(dn.estimated_arrival_date), ''),
                    DATE_ADD(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        INTERVAL IFNULL(ttw.days, 0) DAY
                    )
                )
            ) AS expected_storage_time,
            dn.shipment_id,
            SUM(dn.quantity_shipped) AS qty_shipped,
            SUM(COALESCE(fs.received, 0)) AS received
        FROM delivery_note AS dn
        LEFT JOIN channel_lead_time AS clt
            ON TRIM(UPPER(dn.logistics_provider_name)) = TRIM(UPPER(clt.logistics_provider))
           AND TRIM(UPPER(dn.logistics_channel_name)) = TRIM(UPPER(clt.channel))
        LEFT JOIN time_to_warehouse AS ttw
            ON TRIM(UPPER(dn.country)) = TRIM(UPPER(ttw.country))
           AND (
                CASE
                    WHEN DATE_FORMAT(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        '%m-%d'
                    ) BETWEEN '06-10' AND '07-10'
                      OR DATE_FORMAT(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        '%m-%d'
                    ) BETWEEN '09-10' AND '10-10'
                      OR DATE_FORMAT(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        '%m-%d'
                    ) BETWEEN '11-01' AND '12-15'
                    THEN '旺季'
                    ELSE '淡季'
                END
           ) = ttw.season
        LEFT JOIN (
            SELECT shippment_id, msku, `apply`, SUM(received) AS received
            FROM fba_ship
            GROUP BY shippment_id, msku, `apply`
        ) AS fs
            ON fs.shippment_id = dn.shipment_id
           AND fs.msku = dn.msku
           AND fs.`apply` = dn.quantity_shipped
        WHERE (
                TRIM(dn.status) = '已发货'
                OR (
                    TRIM(dn.status) = '待配货'
                    AND COALESCE(fs.received, 0) > 0
                )
            )
          AND (TRIM(dn.state) <> '已索赔' OR dn.state IS NULL)
        GROUP BY
            dn.country,
            dn.asin,
            DATE(
                COALESCE(
                    NULLIF(TRIM(dn.estimated_arrival_date), ''),
                    DATE_ADD(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        INTERVAL IFNULL(ttw.days, 0) DAY
                    )
                )
            ),
            dn.shipment_id
    ) AS real_supply
    INNER JOIN temp_v2_scope_keys AS scope_key
        ON scope_key.asin = real_supply.asin
       AND scope_key.country = real_supply.country
       AND scope_key.shop = '合计'
    WHERE real_supply.expected_storage_time >= CURDATE()
      AND (real_supply.qty_shipped - real_supply.received) <> 0
    GROUP BY
        real_supply.country,
        real_supply.asin,
        real_supply.expected_storage_time
),
all_supply AS (
    SELECT
        shop,
        country,
        asin,
        expected_storage_time,
        qty_shipped,
        received,
        0 AS simulated_quantity
    FROM real_shipment

    UNION ALL

    SELECT
        sim.shop,
        sim.country,
        sim.asin,
        DATE(sim.add_date) AS expected_storage_time,
        0 AS qty_shipped,
        0 AS received,
        sim.number AS simulated_quantity
    FROM simulate_shipment AS sim
    WHERE sim.plan_source = 'shipment_plan_v2'
      AND sim.shop = '合计'
      AND (
            (
                sim.shippment_id IS NOT NULL
                AND sim.shippment_id <> ''
                AND NOT EXISTS (
                    SELECT 1
                    FROM delivery_note AS dn
                    WHERE TRIM(UPPER(dn.shipment_id)) = TRIM(UPPER(sim.shippment_id))
                      AND TRIM(UPPER(dn.asin)) = TRIM(UPPER(sim.asin))
                      AND (
                            TRIM(dn.status) = '已发货'
                            OR (
                                TRIM(dn.status) = '待配货'
                                AND EXISTS (
                                    SELECT 1
                                    FROM fba_ship AS fs2
                                    WHERE fs2.shippment_id = dn.shipment_id
                                      AND fs2.msku = dn.msku
                                      AND fs2.`apply` = dn.quantity_shipped
                                      AND COALESCE(fs2.received, 0) > 0
                                )
                            )
                        )
                      AND (TRIM(dn.state) <> '已索赔' OR dn.state IS NULL)
                )
            )
            OR sim.shippment_id IS NULL
            OR sim.shippment_id = ''
        )
)
SELECT
    supply.shop,
    supply.country,
    supply.asin,
    supply.expected_storage_time,
    CAST(
        SUM(supply.qty_shipped - supply.received + supply.simulated_quantity)
        AS SIGNED
    ) AS remaining
FROM all_supply AS supply
GROUP BY supply.shop, supply.country, supply.asin, supply.expected_storage_time
HAVING SUM(supply.qty_shipped - supply.received + supply.simulated_quantity) <> 0;

ALTER TABLE temp_v2_supply_raw
    ADD INDEX idx_v2_supply_raw_key (asin, country, shop, expected_storage_time);

-- 记录未进入有效 supply 的来源。完整业务键的未来补货若缺少水位日期行，
-- 正式节点仍由 FUTURE_SUPPLY_DATE_MAPPED guard 阻断，不能静默跳过。
CREATE TEMPORARY TABLE temp_v2_supply_unmapped AS
SELECT
    raw.shop,
    raw.country,
    raw.asin,
    raw.expected_storage_time,
    raw.remaining,
    CASE
        WHEN raw.asin IS NULL OR TRIM(raw.asin) = ''
          OR raw.country IS NULL OR TRIM(raw.country) = ''
          OR raw.shop IS NULL OR TRIM(raw.shop) = ''
        THEN 'INCOMPLETE_BUSINESS_KEY'
        WHEN raw.expected_storage_time IS NULL
        THEN 'MISSING_EXPECTED_STORAGE_TIME'
        WHEN scope_key.asin IS NULL
        THEN 'OUT_OF_SCOPE'
        WHEN raw.expected_storage_time < CURDATE()
        THEN 'PAST_DATE_OUTSIDE_PROJECTION'
        ELSE 'FUTURE_DATE_NOT_IN_DAILY_SALES'
    END AS unmapped_reason
FROM temp_v2_supply_raw AS raw
LEFT JOIN temp_v2_scope_keys AS scope_key
    ON scope_key.asin = raw.asin
   AND scope_key.country = raw.country
   AND scope_key.shop = raw.shop
LEFT JOIN temp_v2_scope_dates AS scope_date
    ON scope_date.asin = raw.asin
   AND scope_date.country = raw.country
   AND scope_date.shop = raw.shop
   AND scope_date.`date` = raw.expected_storage_time
WHERE scope_date.`date` IS NULL;

ALTER TABLE temp_v2_supply_unmapped
    ADD INDEX idx_v2_supply_unmapped_reason (unmapped_reason);

-- 只有能精确映射到今天及未来 daily_sales 日期行的补货才进入递推。
CREATE TEMPORARY TABLE temp_v2_supply AS
SELECT
    raw.shop,
    raw.country,
    raw.asin,
    raw.expected_storage_time,
    raw.remaining
FROM temp_v2_supply_raw AS raw
INNER JOIN temp_v2_scope_dates AS scope
    ON scope.asin = raw.asin
   AND scope.country = raw.country
   AND scope.shop = raw.shop
   AND scope.`date` = raw.expected_storage_time;

ALTER TABLE temp_v2_supply
    ADD INDEX idx_v2_supply_key (asin, country, shop, expected_storage_time);

-- 进入有效 supply 的记录必须具备完整键和日期；无效来源已在 unmapped 中隔离。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_supply
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR expected_storage_time IS NULL;

-- 完整键且属于推演范围的未来补货不能因缺少日期行而静默丢失。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_supply_unmapped
WHERE unmapped_reason = 'FUTURE_DATE_NOT_IN_DAILY_SALES';

CREATE TEMPORARY TABLE temp_v2_projection_input AS
SELECT
    scope.asin,
    scope.country,
    scope.shop,
    scope.`date`,
    scope.inventory AS actual_inventory,
    CAST(COALESCE(scope.maybe_sales, 0) AS SIGNED) AS demand,
    scope.weighted_sales,
    NULLIF(CAST(COALESCE(supply.remaining, 0) AS SIGNED), 0) AS v2_add
FROM temp_v2_scope_dates AS scope
LEFT JOIN temp_v2_supply AS supply
    ON supply.asin = scope.asin
   AND supply.country = scope.country
   AND supply.shop = scope.shop
   AND supply.expected_storage_time = scope.`date`;

ALTER TABLE temp_v2_projection_input
    ADD UNIQUE INDEX idx_v2_input_key (asin, country, shop, `date`);

-- MySQL 临时表在同一递归语句中不能重复打开：anchor 使用独立的今日 seed，
-- recursive member 继续读取完整 input。
CREATE TEMPORARY TABLE temp_v2_projection_seed AS
SELECT
    asin,
    country,
    shop,
    `date`,
    actual_inventory,
    demand,
    v2_add
FROM temp_v2_projection_input
WHERE `date` = CURDATE();

ALTER TABLE temp_v2_projection_seed
    ADD UNIQUE INDEX idx_v2_seed_key (asin, country, shop, `date`);

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_projection_seed)
    = (SELECT COUNT(*) FROM temp_v2_scope_keys),
    1,
    0
);

-- 与普通库存口径一致：缺货期间未成交需求不结转；正补货到达时从本次补货量重新起算。
CREATE TEMPORARY TABLE temp_v2_inventory_prediction AS
WITH RECURSIVE inventory_calc AS (
    SELECT
        seed.asin,
        seed.country,
        seed.shop,
        seed.`date`,
        CAST(seed.actual_inventory AS SIGNED)
            + CAST(COALESCE(seed.v2_add, 0) AS SIGNED) AS calc_inventory,
        CAST(seed.demand AS SIGNED) AS demand
    FROM temp_v2_projection_seed AS seed

    UNION ALL

    SELECT
        input.asin,
        input.country,
        input.shop,
        input.`date`,
        CASE
            WHEN COALESCE(input.v2_add, 0) > 0
             AND (previous.calc_inventory - previous.demand) < 0
            THEN CAST(input.v2_add AS SIGNED)
            ELSE previous.calc_inventory
                - previous.demand
                + CAST(COALESCE(input.v2_add, 0) AS SIGNED)
        END AS calc_inventory,
        CAST(input.demand AS SIGNED) AS demand
    FROM temp_v2_projection_input AS input
    INNER JOIN inventory_calc AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.`date` = DATE_ADD(previous.`date`, INTERVAL 1 DAY)
)
SELECT asin, country, shop, `date`, calc_inventory
FROM inventory_calc;

ALTER TABLE temp_v2_inventory_prediction
    ADD UNIQUE INDEX idx_v2_prediction_key (asin, country, shop, `date`);

-- 递推结果行数必须与输入完全一致，否则说明日期链被截断。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_inventory_prediction)
    = (SELECT COUNT(*) FROM temp_v2_projection_input),
    1,
    0
);

-- 在途遵循库存转移守恒：正补货到库后扣减在途，负补货减少库存并恢复等量在途。
CREATE TEMPORARY TABLE temp_v2_branch_stage AS
SELECT
    prediction.asin,
    prediction.country,
    prediction.shop,
    prediction.`date`,
    input.v2_add,
    CAST(prediction.calc_inventory AS SIGNED) AS v2_inventory,
    CAST(
        CASE
            WHEN prediction.calc_inventory <= 0 THEN 0
            WHEN input.weighted_sales > 0
            THEN FLOOR(prediction.calc_inventory / input.weighted_sales)
            ELSE 0
        END AS SIGNED
    ) AS v2_days_for_sale,
    CAST(
        COALESCE(
            SUM(GREATEST(COALESCE(input.v2_add, 0), 0)) OVER (
                PARTITION BY prediction.asin, prediction.country, prediction.shop
            )
            - SUM(COALESCE(input.v2_add, 0)) OVER (
                PARTITION BY prediction.asin, prediction.country, prediction.shop
                ORDER BY prediction.`date`
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ),
            0
        ) AS SIGNED
    ) AS v2_on_the_way,
    @v2_calculated_at AS v2_calculated_at
FROM temp_v2_inventory_prediction AS prediction
INNER JOIN temp_v2_projection_input AS input
    ON input.asin = prediction.asin
   AND input.country = prediction.country
   AND input.shop = prediction.shop
   AND input.`date` = prediction.`date`;

ALTER TABLE temp_v2_branch_stage
    ADD UNIQUE INDEX idx_v2_branch_stage_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_write_stage AS
SELECT * FROM temp_v2_branch_stage;

ALTER TABLE temp_v2_write_stage
    ADD UNIQUE INDEX idx_v2_write_stage_key (asin, country, shop, `date`);

-- 合计推演必须完整覆盖合计日期范围。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_write_stage)
    = (SELECT COUNT(*) FROM temp_v2_scope_dates),
    1,
    0
);

SET @v2_branch_rows = 0;
SET @v2_total_rows = (SELECT COUNT(*) FROM temp_v2_branch_stage);
SET @v2_write_rows = (SELECT COUNT(*) FROM temp_v2_write_stage);

-- 单调写入：较早启动的全量推演不得覆盖较晚启动的定向推演结果。

-- ===== v2 真实可撑天数(v2_days_cover,2026-07-25 决策30配套尺子):
-- 从该日起按未来逐日预估勾销、数到库存耗尽是第几天;不计该日之后的到货;>60 记 60(前端显示 60+)。
DROP TEMPORARY TABLE IF EXISTS temp_v2_cover_a;
DROP TEMPORARY TABLE IF EXISTS temp_v2_cover_b;
DROP TEMPORARY TABLE IF EXISTS temp_v2_cover_days;

CREATE TEMPORARY TABLE temp_v2_cover_a AS
SELECT
    prediction.asin,
    prediction.country,
    prediction.shop,
    prediction.`date`,
    CAST(GREATEST(prediction.calc_inventory, 0) AS SIGNED) AS stock_at_day,
    CAST(input.demand AS SIGNED) AS demand,
    CAST(SUM(input.demand) OVER (
        PARTITION BY prediction.asin, prediction.country, prediction.shop
        ORDER BY prediction.`date`
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS SIGNED) AS cum_demand
FROM temp_v2_inventory_prediction AS prediction
INNER JOIN temp_v2_projection_input AS input
    ON input.asin = prediction.asin
   AND input.country = prediction.country
   AND input.shop = prediction.shop
   AND input.`date` = prediction.`date`;

ALTER TABLE temp_v2_cover_a
    ADD INDEX idx_v2_cover_a_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_cover_b AS
SELECT * FROM temp_v2_cover_a;

ALTER TABLE temp_v2_cover_b
    ADD INDEX idx_v2_cover_b_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_cover_days AS
SELECT
    a.asin,
    a.country,
    a.shop,
    a.`date`,
    CAST(
        CASE
            WHEN MAX(a.stock_at_day) = 0 THEN 0
            ELSE LEAST(60, COALESCE(MIN(DATEDIFF(b.`date`, a.`date`)), 61))
        END AS SIGNED
    ) AS v2_days_cover
FROM temp_v2_cover_a AS a
LEFT JOIN temp_v2_cover_b AS b
    ON b.asin = a.asin
   AND b.country = a.country
   AND b.shop = a.shop
   AND b.`date` >= a.`date`
   AND b.`date` <= DATE_ADD(a.`date`, INTERVAL 60 DAY)
   AND (b.cum_demand - a.cum_demand + a.demand) > a.stock_at_day
GROUP BY a.asin, a.country, a.shop, a.`date`;

ALTER TABLE temp_v2_cover_days
    ADD UNIQUE INDEX idx_v2_cover_days_key (asin, country, shop, `date`);

UPDATE daily_sales AS target
INNER JOIN temp_v2_write_stage AS stage
    ON stage.asin = target.asin
   AND stage.country = target.country
   AND stage.shop = target.shop
   AND stage.`date` = target.`date`
SET
    target.v2_add = stage.v2_add,
    target.v2_inventory = stage.v2_inventory,
    target.v2_days_for_sale = stage.v2_days_for_sale,
    target.v2_on_the_way = stage.v2_on_the_way,
    target.v2_calculated_at = stage.v2_calculated_at
WHERE target.`date` >= CURDATE()
  AND (
        target.v2_calculated_at IS NULL
        OR target.v2_calculated_at <= stage.v2_calculated_at
      );

SET @v2_changed_rows = ROW_COUNT();

UPDATE daily_sales AS target
INNER JOIN temp_v2_cover_days AS cover
    ON cover.asin = target.asin
   AND cover.country = target.country
   AND cover.shop = target.shop
   AND cover.`date` = target.`date`
SET target.v2_days_cover = cover.v2_days_cover
WHERE target.`date` >= CURDATE();

DROP TEMPORARY TABLE IF EXISTS temp_v2_cover_a;
DROP TEMPORARY TABLE IF EXISTS temp_v2_cover_b;
DROP TEMPORARY TABLE IF EXISTS temp_v2_cover_days;

-- ===== 销售预估口径(v2_sale_*,2026-07-25 双口径对比视图):
-- 同一供给流(真实在途 + v2 计划),需求换为销售预估销量(sale_maybe_sales);
-- 该 SKU 未来销售预估合计为 0(未填)时写 NULL,前端不画线。
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_flag;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_cover_a;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_cover_b;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_cover_days;

CREATE TEMPORARY TABLE temp_v2_sale_input AS
SELECT
    scope.asin,
    scope.country,
    scope.shop,
    scope.`date`,
    scope.inventory AS actual_inventory,
    CAST(COALESCE(scope.sale_maybe_sales, 0) AS SIGNED) AS demand,
    NULLIF(CAST(COALESCE(supply.remaining, 0) AS SIGNED), 0) AS v2_add
FROM temp_v2_scope_dates AS scope
LEFT JOIN temp_v2_supply AS supply
    ON supply.asin = scope.asin
   AND supply.country = scope.country
   AND supply.shop = scope.shop
   AND supply.expected_storage_time = scope.`date`;

ALTER TABLE temp_v2_sale_input
    ADD UNIQUE INDEX idx_v2_sale_input_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_sale_seed AS
SELECT * FROM temp_v2_sale_input WHERE `date` = CURDATE();

ALTER TABLE temp_v2_sale_seed
    ADD UNIQUE INDEX idx_v2_sale_seed_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_sale_prediction AS
WITH RECURSIVE sale_calc AS (
    SELECT
        seed.asin, seed.country, seed.shop, seed.`date`,
        CAST(seed.actual_inventory AS SIGNED)
            + CAST(COALESCE(seed.v2_add, 0) AS SIGNED) AS calc_inventory,
        CAST(seed.demand AS SIGNED) AS demand
    FROM temp_v2_sale_seed AS seed

    UNION ALL

    SELECT
        input.asin, input.country, input.shop, input.`date`,
        CASE
            WHEN COALESCE(input.v2_add, 0) > 0
             AND (previous.calc_inventory - previous.demand) < 0
            THEN CAST(input.v2_add AS SIGNED)
            ELSE previous.calc_inventory
                - previous.demand
                + CAST(COALESCE(input.v2_add, 0) AS SIGNED)
        END AS calc_inventory,
        CAST(input.demand AS SIGNED) AS demand
    FROM temp_v2_sale_input AS input
    INNER JOIN sale_calc AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.`date` = DATE_ADD(previous.`date`, INTERVAL 1 DAY)
)
SELECT asin, country, shop, `date`, calc_inventory, demand FROM sale_calc;

ALTER TABLE temp_v2_sale_prediction
    ADD UNIQUE INDEX idx_v2_sale_pred_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_sale_flag AS
SELECT asin, country, shop, SUM(demand) AS total_sale_demand
FROM temp_v2_sale_input
GROUP BY asin, country, shop;

ALTER TABLE temp_v2_sale_flag
    ADD UNIQUE INDEX idx_v2_sale_flag_key (asin, country, shop);

CREATE TEMPORARY TABLE temp_v2_sale_cover_a AS
SELECT
    p.asin, p.country, p.shop, p.`date`,
    CAST(GREATEST(p.calc_inventory, 0) AS SIGNED) AS stock_at_day,
    CAST(p.demand AS SIGNED) AS demand,
    CAST(SUM(p.demand) OVER (
        PARTITION BY p.asin, p.country, p.shop
        ORDER BY p.`date`
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS SIGNED) AS cum_demand
FROM temp_v2_sale_prediction AS p;

ALTER TABLE temp_v2_sale_cover_a
    ADD INDEX idx_v2_sale_cover_a_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_sale_cover_b AS
SELECT * FROM temp_v2_sale_cover_a;

ALTER TABLE temp_v2_sale_cover_b
    ADD INDEX idx_v2_sale_cover_b_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_sale_cover_days AS
SELECT
    a.asin, a.country, a.shop, a.`date`,
    CAST(
        CASE
            WHEN MAX(a.stock_at_day) = 0 THEN 0
            ELSE LEAST(60, COALESCE(MIN(DATEDIFF(b.`date`, a.`date`)), 61))
        END AS SIGNED
    ) AS v2_sale_days_cover
FROM temp_v2_sale_cover_a AS a
LEFT JOIN temp_v2_sale_cover_b AS b
    ON b.asin = a.asin
   AND b.country = a.country
   AND b.shop = a.shop
   AND b.`date` >= a.`date`
   AND b.`date` <= DATE_ADD(a.`date`, INTERVAL 60 DAY)
   AND (b.cum_demand - a.cum_demand + a.demand) > a.stock_at_day
GROUP BY a.asin, a.country, a.shop, a.`date`;

ALTER TABLE temp_v2_sale_cover_days
    ADD UNIQUE INDEX idx_v2_sale_cover_days_key (asin, country, shop, `date`);

UPDATE daily_sales AS target
INNER JOIN temp_v2_sale_prediction AS pred
    ON pred.asin = target.asin
   AND pred.country = target.country
   AND pred.shop = target.shop
   AND pred.`date` = target.`date`
INNER JOIN temp_v2_sale_cover_days AS cover
    ON cover.asin = target.asin
   AND cover.country = target.country
   AND cover.shop = target.shop
   AND cover.`date` = target.`date`
INNER JOIN temp_v2_sale_flag AS flag
    ON flag.asin = target.asin
   AND flag.country = target.country
   AND flag.shop = target.shop
SET
    target.v2_sale_inventory = CASE WHEN flag.total_sale_demand > 0 THEN pred.calc_inventory ELSE NULL END,
    target.v2_sale_days_cover = CASE WHEN flag.total_sale_demand > 0 THEN cover.v2_sale_days_cover ELSE NULL END
WHERE target.`date` >= CURDATE();

DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_flag;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_cover_a;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_cover_b;
DROP TEMPORARY TABLE IF EXISTS temp_v2_sale_cover_days;


DROP TEMPORARY TABLE IF EXISTS temp_v2_write_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_keys;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_guard;


-- ===== 风险分级行级标注(决策 29 · 提案四,2026-07-25)
-- 必须跑在水位推演之后:红/橙依赖 v2_days_cover 曲线(已含本轮计划)。
-- 三档互斥、按 红 → 橙 → 黄 取首个命中;只标不拦(拦不拦归审批闸)。
DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_event;
DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_scope;
DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_day;
DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_agg;

-- 活动窗口(年度循环模板 → 真实区间),口径同生成流
CREATE TEMPORARY TABLE temp_v2_risk_event AS
SELECT
    et.country_csv,
    STR_TO_DATE(CONCAT(ey.y, '-', et.md_start), '%Y-%m-%d') AS event_start,
    STR_TO_DATE(CONCAT(ey.y, '-', et.md_end), '%Y-%m-%d') AS event_end
FROM (
    SELECT DISTINCT
        REPLACE(dt.country, ' ', '') AS country_csv,
        DATE_FORMAT(dt.startdate, '%m-%d') AS md_start,
        DATE_FORMAT(dt.enddate, '%m-%d') AS md_end
    FROM datetypetime AS dt
    WHERE dt.status = '生效中'
      AND dt.daytype_category IN ('大促BDLD', '固定活动类型')
      AND dt.startdate IS NOT NULL AND dt.enddate IS NOT NULL
      AND dt.country IS NOT NULL AND TRIM(dt.country) <> ''
) AS et
CROSS JOIN (
    SELECT YEAR(CURDATE()) AS y UNION ALL SELECT YEAR(CURDATE()) + 1
) AS ey
HAVING event_start IS NOT NULL AND event_end IS NOT NULL AND event_end >= event_start;

-- 待评级的计划行:未来、v2 计划、区域合计层
CREATE TEMPORARY TABLE temp_v2_risk_scope AS
SELECT
    sim.id AS plan_id,
    sim.asin, sim.country, sim.shop,
    sim.add_date AS win_start,
    DATE_ADD(sim.add_date, INTERVAL 13 DAY) AS win_end,
    JSON_UNQUOTE(JSON_EXTRACT(sim.v2_calculation_snapshot, '$.constraint_layer.status')) AS cst_status,
    JSON_UNQUOTE(JSON_EXTRACT(sim.v2_calculation_snapshot, '$.event_lead.action')) AS ev_action,
    COALESCE(JSON_EXTRACT(sim.v2_calculation_snapshot, '$.event_lead.is_late'), 0) AS ev_late
FROM simulate_shipment AS sim
WHERE sim.plan_source = 'shipment_plan_v2'
  AND sim.add_date IS NOT NULL
  AND sim.add_date >= CURDATE()
  AND sim.shop = '合计';

ALTER TABLE temp_v2_risk_scope ADD UNIQUE INDEX idx_v2_risk_scope (plan_id);

-- 逐日展开:该批责任窗口内每天的可撑天数 + 是否处于活动豁免带(活动开始前 7 天 ~ 活动结束)
CREATE TEMPORARY TABLE temp_v2_risk_day AS
SELECT
    ps.plan_id,
    ds.v2_days_cover,
    CAST(COALESCE(ds.maybe_sales, ds.weighted_sales, 0) AS SIGNED) AS demand,
    EXISTS (
        SELECT 1 FROM temp_v2_risk_event AS ew
        WHERE FIND_IN_SET(ps.country, ew.country_csv) > 0
          AND DATE(ds.`date`) BETWEEN DATE_SUB(ew.event_start, INTERVAL 7 DAY) AND ew.event_end
    ) AS in_event_zone
FROM temp_v2_risk_scope AS ps
INNER JOIN daily_sales AS ds
    ON ds.asin = ps.asin AND ds.country = ps.country AND ds.shop = ps.shop
   AND DATE(ds.`date`) BETWEEN ps.win_start AND ps.win_end
WHERE ds.v2_days_cover IS NOT NULL;

CREATE TEMPORARY TABLE temp_v2_risk_agg AS
SELECT
    plan_id,
    COUNT(*) AS day_count,
    SUM(v2_days_cover = 0) AS zero_days,
    SUM(v2_days_cover < 7 AND in_event_zone = 0) AS below_days,
    SUM(v2_days_cover > 14 AND in_event_zone = 0) AS above_days,
    SUM(demand) AS window_demand
FROM temp_v2_risk_day
GROUP BY plan_id;

ALTER TABLE temp_v2_risk_agg ADD UNIQUE INDEX idx_v2_risk_agg (plan_id);

UPDATE simulate_shipment AS target
INNER JOIN temp_v2_risk_scope AS ps ON ps.plan_id = target.id
LEFT JOIN temp_v2_risk_agg AS ag ON ag.plan_id = ps.plan_id
SET
    target.v2_risk_grade = CASE
        -- 噪音闸①:责任期内没有需求(预估全 0)不判红——无货可卖 ≠ 断货风险
        WHEN COALESCE(ag.window_demand, 0) > 0
         AND (COALESCE(ag.zero_days, 0) > 0 OR COALESCE(ag.below_days, 0) > 0) THEN '红'
        -- 噪音闸②:本周不发货(建议量 0)时的"超上限"是存量滞销,归滞销预警,不在此重复报
        WHEN (COALESCE(ag.above_days, 0) > 0 AND COALESCE(target.number, 0) > 0)
          OR ps.ev_late = 1 THEN '橙'
        WHEN ps.cst_status IN ('BOX_SIZE_MISSING', 'BOX_SIZE_CONFLICT', 'CONSTRAINT_CONFIG_INVALID')
          OR ps.ev_action IN ('LATE_FAST_NOT_ENOUGH', 'LATE_NO_FAST_CHANNEL')
          OR COALESCE(ag.day_count, 0) = 0 THEN '黄'
        ELSE '绿'
    END,
    target.v2_risk_reason = CASE
        WHEN COALESCE(ag.window_demand, 0) > 0 AND COALESCE(ag.zero_days, 0) > 0
            THEN CONCAT('责任期内 ', ag.zero_days, ' 天库存耗尽')
        WHEN COALESCE(ag.window_demand, 0) > 0 AND COALESCE(ag.below_days, 0) > 0
            THEN CONCAT('普通日 ', ag.below_days, ' 天跌破下限 7 天')
        WHEN COALESCE(ag.above_days, 0) > 0 AND COALESCE(target.number, 0) > 0
            THEN CONCAT('普通日 ', ag.above_days, ' 天超上限 14 天')
        WHEN ps.ev_late = 1 THEN '到货日落进活动窗口(晚到)'
        WHEN ps.cst_status = 'BOX_SIZE_MISSING' THEN '缺箱入数,未整箱'
        WHEN ps.cst_status = 'BOX_SIZE_CONFLICT' THEN '箱入数配置冲突,未整箱'
        WHEN ps.cst_status = 'CONSTRAINT_CONFIG_INVALID' THEN '约束参数配置异常,最低发货量未生效'
        WHEN ps.ev_action IN ('LATE_FAST_NOT_ENOUGH', 'LATE_NO_FAST_CHANNEL') THEN '晚到且快渠道也赶不上'
        WHEN COALESCE(ag.day_count, 0) = 0 THEN '预测未覆盖责任期,无法评级'
        ELSE NULL
    END;

SET @v2_risk_graded_rows = ROW_COUNT();

DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_day;
DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_agg;
DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_scope;
DROP TEMPORARY TABLE IF EXISTS temp_v2_risk_event;

SELECT
    'OK' AS projection_status,
    @v2_calculated_at AS calculated_at,
    @v2_branch_rows AS branch_rows,
    @v2_total_rows AS total_rows,
    @v2_write_rows AS staged_rows,
    @v2_changed_rows AS changed_rows;""",
    ),
)


def print_title(title, width=80):
    print("\n" + "=" * width)
    print(title)
    print("=" * width)


def configure_db_session(cursor):
    session_settings = [
        f"SET SESSION innodb_lock_wait_timeout = {LOCK_WAIT_TIMEOUT_SECONDS}",
        f"SET SESSION lock_wait_timeout = {LOCK_WAIT_TIMEOUT_SECONDS}",
        f"SET SESSION max_execution_time = {QUERY_TIMEOUT_SECONDS * 1000}",
        f"SET SESSION max_statement_time = {QUERY_TIMEOUT_SECONDS}",
    ]
    for statement in session_settings:
        try:
            cursor.execute(statement)
        except Exception:
            # 不同 MySQL/MariaDB 版本支持的超时变量不同，能设置哪个就用哪个。
            pass


def acquire_run_lock(cursor):
    cursor.execute(
        "SELECT GET_LOCK(%s, %s)",
        (RUN_LOCK_NAME, RUN_LOCK_WAIT_SECONDS),
    )
    row = cursor.fetchone()
    if not row or row[0] != 1:
        raise RuntimeError("已有一轮更新水位表任务正在执行，本轮停止")


def release_run_lock(cursor):
    try:
        cursor.execute("SELECT RELEASE_LOCK(%s)", (RUN_LOCK_NAME,))
        cursor.fetchone()
    except Exception as error:
        # 连接关闭时 MySQL 仍会自动释放命名锁。
        print(f"释放运行锁时出现警告: {error}")


def execute_sql_script(cursor, sql):
    """兼容 Connector/Python 9.2 前后的多语句执行方式。"""
    version_info = tuple(getattr(mysql.connector, "__version_info__", ())[:2])
    last_rows = None

    if version_info >= (9, 2):
        cursor.execute(sql, map_results=True)
        while True:
            if cursor.with_rows:
                last_rows = cursor.fetchall()
            if not cursor.nextset():
                break
        return last_rows

    for result in cursor.execute(sql, multi=True):
        if result.with_rows:
            last_rows = result.fetchall()
    return last_rows


def get_validation_counts(cursor):
    cursor.execute(
        """
        SELECT
            SUM(shop <> '合计' AND date = CURDATE()) AS today_shop_rows,
            SUM(shop <> '合计' AND date > CURDATE()) AS future_shop_rows,
            SUM(shop = '合计' AND date = CURDATE()) AS today_total_rows,
            SUM(shop = '合计' AND date > CURDATE()) AS future_total_rows
        FROM daily_sales
        WHERE date >= CURDATE()
        """
    )
    row = cursor.fetchone()
    return {
        "today_shop_rows": int(row[0] or 0),
        "future_shop_rows": int(row[1] or 0),
        "today_total_rows": int(row[2] or 0),
        "future_total_rows": int(row[3] or 0),
    }


def validate_before_update(cursor):
    counts = get_validation_counts(cursor)
    print(
        "执行前检查: "
        f"今日分店={counts['today_shop_rows']:,}, "
        f"未来分店={counts['future_shop_rows']:,}"
    )
    if counts["today_shop_rows"] == 0:
        raise RuntimeError("daily_sales 没有今日分店数据，停止更新水位表")
    if counts["future_shop_rows"] == 0:
        raise RuntimeError("daily_sales 没有未来分店数据，停止更新水位表")
    return counts


def validate_after_update(cursor):
    counts = get_validation_counts(cursor)
    print(
        "执行后检查: "
        f"今日分店={counts['today_shop_rows']:,}, "
        f"未来分店={counts['future_shop_rows']:,}, "
        f"今日合计={counts['today_total_rows']:,}, "
        f"未来合计={counts['future_total_rows']:,}"
    )
    if counts["today_total_rows"] == 0:
        raise RuntimeError("更新后没有生成今日合计行")
    if counts["future_total_rows"] == 0:
        raise RuntimeError("更新后没有生成未来合计行")
    return counts


def run_water_level_update():
    started_at = time.time()
    connection = mysql.connector.connect(**DB_CONF)
    cursor = connection.cursor()
    lock_acquired = False

    try:
        configure_db_session(cursor)
        acquire_run_lock(cursor)
        lock_acquired = True
        validate_before_update(cursor)

        total_steps = len(SQL_STEPS)
        for index, (step_name, sql) in enumerate(SQL_STEPS, start=1):
            step_started_at = time.time()
            print(f"[{index}/{total_steps}] {step_name} 开始...")
            try:
                result_rows = execute_sql_script(cursor, sql)
                connection.commit()
            except Exception as error:
                connection.rollback()
                elapsed = time.time() - step_started_at
                print(f"[{index}/{total_steps}] {step_name} 失败，耗时 {elapsed:.2f} 秒")
                raise RuntimeError(
                    f"更新水位表失败于步骤 {index}: {step_name}: {error}"
                ) from error

            elapsed = time.time() - step_started_at
            print(f"[{index}/{total_steps}] {step_name} 完成，耗时 {elapsed:.2f} 秒")
            if result_rows:
                print(f"[{index}/{total_steps}] 最终结果: {result_rows[-1]}")

        final_counts = validate_after_update(cursor)
        total_elapsed = time.time() - started_at
        print_title(f"更新水位表完成，总耗时: {total_elapsed:.2f} 秒")
        return final_counts
    finally:
        if lock_acquired:
            release_run_lock(cursor)
        cursor.close()
        connection.close()


def main():
    start_time = datetime.now()
    try:
        print_title("更新水位表 - Python版", 80)
        print(f"执行时间: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        return run_water_level_update()
    except Exception as error:
        import traceback

        print_title("更新水位表执行失败", 80)
        print(str(error))
        print(traceback.format_exc())
        raise
