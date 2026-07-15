-- 重算全部历史合计行加权基准销量：原版分段权重
-- 高风险写入：仅更新 shop = '合计'、date < CURDATE() 的 weighted_sales。
-- 基准销量从分店明细重新汇总，不依赖历史合计行现有的 base_sales。
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
            ) AS row_num,
            COUNT(*) OVER (
                PARTITION BY t.shop_country_asin_date
            ) AS total_count
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
                CASE
                    WHEN total_count BETWEEN 1 AND 3 THEN
                        AVG(daily_base_sales)
                    WHEN total_count BETWEEN 4 AND 7 THEN
                        AVG(
                            CASE
                                WHEN row_num <= CEIL(total_count * 0.3)
                                THEN daily_base_sales
                            END
                        ) * 0.7
                        + AVG(
                            CASE
                                WHEN row_num > CEIL(total_count * 0.3)
                                THEN daily_base_sales
                            END
                        ) * 0.3
                    WHEN total_count BETWEEN 8 AND 15 THEN
                        AVG(
                            CASE
                                WHEN row_num <= CEIL(total_count * 0.33)
                                THEN daily_base_sales
                            END
                        ) * 0.6
                        + AVG(
                            CASE
                                WHEN row_num BETWEEN CEIL(total_count * 0.33) + 1
                                                 AND CEIL(total_count * 0.66)
                                THEN daily_base_sales
                            END
                        ) * 0.3
                        + AVG(
                            CASE
                                WHEN row_num > CEIL(total_count * 0.66)
                                THEN daily_base_sales
                            END
                        ) * 0.1
                    ELSE
                        AVG(
                            CASE
                                WHEN row_num BETWEEN 1 AND 7
                                THEN daily_base_sales
                            END
                        ) * 0.5
                        + AVG(
                            CASE
                                WHEN row_num BETWEEN 8 AND 15
                                THEN daily_base_sales
                            END
                        ) * 0.3
                        + AVG(
                            CASE
                                WHEN row_num BETWEEN 16 AND 30
                                THEN daily_base_sales
                            END
                        ) * 0.2
                END,
                1
            ) AS new_weighted_sales
        FROM history_ranked
        GROUP BY shop_country_asin_date, total_count
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
