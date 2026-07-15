-- 工作流：更新水位表
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

DROP TEMPORARY TABLE IF EXISTS temp_sale_inventory_simulation;
