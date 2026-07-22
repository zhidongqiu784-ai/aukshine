/* 只读预览：不写入任何生产表。 */

WITH
scope AS (
    SELECT 'FR' AS country, 'B0GRB39S7G' AS asin
    UNION ALL
    SELECT 'JP', 'B0CJVFJMVF'
    UNION ALL
    SELECT 'US', 'B0FB3P6H48'
),
daily_base_source AS (
    SELECT
        ds.country,
        ds.asin,
        ds.`date` AS history_date,
        SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0) AS daily_base_sales
    FROM daily_sales AS ds
    INNER JOIN scope
        ON scope.country = ds.country
       AND scope.asin = ds.asin
    WHERE ds.shop <> '合计'
      AND ds.`date` < CURDATE()
    GROUP BY
        ds.country,
        ds.asin,
        ds.`date`
),
history_ranked AS (
    SELECT
        target.shop_country_asin_date,
        target.country,
        target.asin,
        target.shop,
        target.`date` AS target_date,
        target.weighted_sales AS old_weighted_sales,
        source.daily_base_sales,
        ROW_NUMBER() OVER (
            PARTITION BY target.shop_country_asin_date
            ORDER BY source.history_date DESC
        ) AS row_num,
        COUNT(*) OVER (
            PARTITION BY target.shop_country_asin_date
        ) AS total_count
    FROM daily_sales AS target
    INNER JOIN scope
        ON scope.country = target.country
       AND scope.asin = target.asin
    INNER JOIN daily_base_source AS source
        ON source.country = target.country
       AND source.asin = target.asin
       AND source.history_date BETWEEN DATE_SUB(target.`date`, INTERVAL 30 DAY)
                                  AND DATE_SUB(target.`date`, INTERVAL 1 DAY)
    WHERE target.`date` < CURDATE()
      AND source.daily_base_sales IS NOT NULL
),
weighted_recalc AS (
    SELECT
        shop_country_asin_date,
        country,
        asin,
        shop,
        target_date,
        old_weighted_sales,
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
                        CASE WHEN row_num <= 7 THEN daily_base_sales END
                    ) * 0.5
                    + AVG(
                        CASE
                            WHEN row_num BETWEEN 8 AND 15 THEN daily_base_sales
                        END
                    ) * 0.3
                    + AVG(
                        CASE
                            WHEN row_num BETWEEN 16 AND 30 THEN daily_base_sales
                        END
                    ) * 0.2
            END,
            1
        ) AS new_weighted_sales
    FROM history_ranked
    GROUP BY
        shop_country_asin_date,
        country,
        asin,
        shop,
        target_date,
        old_weighted_sales,
        total_count
)
SELECT
    (
        SELECT COUNT(*)
        FROM daily_sales AS ds
        INNER JOIN scope
            ON scope.country = ds.country
           AND scope.asin = ds.asin
        WHERE ds.`date` < CURDATE()
    ) AS total_history_rows,
    COUNT(*) AS recalculable_rows,
    SUM(new_weighted_sales IS NULL) AS null_result_rows,
    SUM(
        new_weighted_sales IS NOT NULL
        AND NOT (old_weighted_sales <=> new_weighted_sales)
    ) AS will_update_rows,
    MIN(target_date) AS min_recalculable_date,
    MAX(target_date) AS max_recalculable_date,
    MIN(CASE
        WHEN new_weighted_sales IS NOT NULL
         AND NOT (old_weighted_sales <=> new_weighted_sales)
        THEN target_date
    END) AS min_change_date,
    MAX(CASE
        WHEN new_weighted_sales IS NOT NULL
         AND NOT (old_weighted_sales <=> new_weighted_sales)
        THEN target_date
    END) AS max_change_date
FROM weighted_recalc;
