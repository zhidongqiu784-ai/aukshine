-- 重算全部历史合计行加权基准销量：0.95 指数衰减
-- 高风险写入：仅更新 shop = '合计'、date < CURDATE() 的 weighted_sales。
-- 基准销量从分店明细重新汇总，不依赖历史合计行现有的 base_sales。
-- 最近一天权重为 1，向前每一天的权重乘以 0.95，并按有效历史日期归一化。
-- 没有任何可用历史基准销量的记录保持原值。
-- NocoBase SQL 节点中不要手写 START TRANSACTION / COMMIT。

UPDATE daily_sales AS d
JOIN (
    WITH daily_base_sales AS (
        SELECT
            asin,
            country,
            `date`,
            SUM(sales) / NULLIF(MAX(coefficient), 0) AS daily_base_sales
        FROM daily_sales
        WHERE shop <> '合计'
          AND `date` < CURDATE()
        GROUP BY asin, country, `date`
    ),
    target_rows AS (
        SELECT
            shop_country_asin_date,
            asin,
            country,
            `date` AS target_date
        FROM daily_sales
        WHERE shop = '合计'
          AND `date` < CURDATE()
    ),
    history_ranked AS (
        SELECT
            t.shop_country_asin_date,
            t.asin,
            t.country,
            t.target_date,
            h.daily_base_sales,
            ROW_NUMBER() OVER (
                PARTITION BY t.shop_country_asin_date
                ORDER BY h.`date` DESC
            ) AS row_num
        FROM target_rows AS t
        INNER JOIN daily_base_sales AS h
            ON h.asin = t.asin
           AND h.country = t.country
           AND h.`date` BETWEEN DATE_SUB(t.target_date, INTERVAL 30 DAY)
                            AND DATE_SUB(t.target_date, INTERVAL 1 DAY)
        WHERE h.daily_base_sales IS NOT NULL
    ),
    recalculated AS (
        SELECT
            shop_country_asin_date,
            ROUND(
                SUM(
                    daily_base_sales * POWER(0.95, row_num - 1)
                ) / NULLIF(
                    SUM(POWER(0.95, row_num - 1)),
                    0
                ),
                1
            ) AS new_weighted_sales
        FROM history_ranked
        GROUP BY shop_country_asin_date
    )
    SELECT
        shop_country_asin_date,
        new_weighted_sales
    FROM recalculated
) AS r
    ON r.shop_country_asin_date = d.shop_country_asin_date
SET d.weighted_sales = r.new_weighted_sales
WHERE d.shop = '合计'
  AND d.`date` < CURDATE()
  AND NOT (d.weighted_sales <=> r.new_weighted_sales);
