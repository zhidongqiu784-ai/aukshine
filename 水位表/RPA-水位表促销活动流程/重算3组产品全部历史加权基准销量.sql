/*
用途：重新计算3组产品截至昨天的每一天加权基准销量。
只更新 daily_sales.weighted_sales，不修改任何其他字段。
*/

DROP TEMPORARY TABLE IF EXISTS temp_history_weighted_only_guard;
DROP TEMPORARY TABLE IF EXISTS temp_history_weighted_only_recalc;

CREATE TEMPORARY TABLE temp_history_weighted_only_guard (
    guard_name VARCHAR(100) NOT NULL,
    error_count INT NOT NULL,
    CONSTRAINT chk_history_weighted_only_guard CHECK (error_count = 0)
);

/* 确认历史范围仍是用户确认时的3541行。 */
INSERT INTO temp_history_weighted_only_guard
SELECT
    'history_scope_changed',
    ABS(COUNT(*) - 3541)
FROM daily_sales AS ds
WHERE ds.`date` < CURDATE()
  AND (
        (ds.country = 'FR' AND ds.asin = 'B0GRB39S7G')
     OR (ds.country = 'JP' AND ds.asin = 'B0CJVFJMVF')
     OR (ds.country = 'US' AND ds.asin = 'B0FB3P6H48')
  );

CREATE TEMPORARY TABLE temp_history_weighted_only_recalc AS
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
weighted AS (
    SELECT
        shop_country_asin_date,
        country,
        asin,
        shop,
        target_date,
        old_weighted_sales,
        ROUND(
            CASE
                WHEN total_count BETWEEN 1 AND 3 THEN AVG(daily_base_sales)
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
SELECT *
FROM weighted;

ALTER TABLE temp_history_weighted_only_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_weighted_only_pair_date (country, asin, target_date);

UPDATE daily_sales AS ds
INNER JOIN temp_history_weighted_only_recalc AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.weighted_sales = recalc.new_weighted_sales
WHERE recalc.new_weighted_sales IS NOT NULL
  AND (ds.weighted_sales <=> recalc.old_weighted_sales)
  AND NOT (ds.weighted_sales <=> recalc.new_weighted_sales);

SET @corrected_history_weighted_rows = ROW_COUNT();

SELECT
    @corrected_history_weighted_rows AS corrected_history_weighted_rows,
    COUNT(*) AS recalculable_rows,
    SUM(
        recalc.new_weighted_sales IS NOT NULL
        AND NOT (ds.weighted_sales <=> recalc.new_weighted_sales)
    ) AS remaining_weighted_rows
FROM temp_history_weighted_only_recalc AS recalc
INNER JOIN daily_sales AS ds
    ON ds.shop_country_asin_date = recalc.shop_country_asin_date;

/* 临时表由本次SQL节点连接结束时自动释放。 */
