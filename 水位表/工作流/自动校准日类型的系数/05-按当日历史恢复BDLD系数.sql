DROP TEMPORARY TABLE IF EXISTS temp_historical_bd_ld_samples;
DROP TEMPORARY TABLE IF EXISTS temp_historical_bd_ld_targets;

CREATE TEMPORARY TABLE temp_historical_bd_ld_samples AS
WITH store_activity_rows AS (
    SELECT
        ds.asin,
        ds.country,
        ds.date,
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(REPLACE(ds.type, '、', ','), '，', ','),
                    CHAR(32),
                    ''
                ),
                'BD（预测）',
                'BD'
            ),
            'BD(预测)',
            'BD'
        ) AS activity_type
    FROM daily_sales AS ds
    WHERE ds.shop <> '合计'
      AND ds.date < CURDATE()
      AND ds.type IS NOT NULL
),
activity_days AS (
    SELECT
        asin,
        country,
        date,
        MIN(activity_type) AS activity_type
    FROM store_activity_rows
    WHERE activity_type IN ('BD', 'LD')
    GROUP BY asin, country, date
    HAVING COUNT(DISTINCT activity_type) = 1
)
SELECT
    activity.asin,
    activity.country,
    activity.activity_type,
    summary_row.date,
    summary_row.sales,
    summary_row.weighted_sales
FROM activity_days AS activity
INNER JOIN daily_sales AS summary_row
    ON summary_row.asin = activity.asin
   AND summary_row.country = activity.country
   AND summary_row.date = activity.date
   AND summary_row.shop = '合计'
WHERE summary_row.sales IS NOT NULL
  AND summary_row.weighted_sales IS NOT NULL
  AND summary_row.weighted_sales <> 0;

ALTER TABLE temp_historical_bd_ld_samples
ADD INDEX idx_sample_lookup (asin, country, activity_type, date);

CREATE TEMPORARY TABLE temp_historical_bd_ld_targets AS
WITH target_dates AS (
    SELECT DISTINCT
        ds.asin,
        ds.country,
        ds.date,
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(REPLACE(ds.type, '、', ','), '，', ','),
                    CHAR(32),
                    ''
                ),
                'BD（预测）',
                'BD'
            ),
            'BD(预测)',
            'BD'
        ) AS activity_type
    FROM daily_sales AS ds
    WHERE ds.date < CURDATE()
      AND ds.type IS NOT NULL
)
SELECT
    target.asin,
    target.country,
    target.date,
    target.activity_type,
    COUNT(sample.date) AS valid_prior_days,
    COALESCE(
        ROUND(
            SUM(sample.sales) / NULLIF(SUM(sample.weighted_sales), 0),
            2
        ),
        CASE target.activity_type
            WHEN 'BD' THEN 1.7
            WHEN 'LD' THEN 2.2
        END
    ) AS calculated_coefficient
FROM target_dates AS target
LEFT JOIN temp_historical_bd_ld_samples AS sample
    ON sample.asin = target.asin
   AND sample.country = target.country
   AND sample.activity_type = target.activity_type
   AND sample.date < target.date
WHERE target.activity_type IN ('BD', 'LD')
GROUP BY
    target.asin,
    target.country,
    target.date,
    target.activity_type;

ALTER TABLE temp_historical_bd_ld_targets
ADD INDEX idx_target_lookup (asin, country, date, activity_type);

START TRANSACTION;

UPDATE daily_sales AS ds
INNER JOIN temp_historical_bd_ld_targets AS target
    ON target.asin = ds.asin
   AND target.country = ds.country
   AND target.date = ds.date
   AND target.activity_type = REPLACE(
        REPLACE(
            REPLACE(
                REPLACE(REPLACE(ds.type, '、', ','), '，', ','),
                CHAR(32),
                ''
            ),
            'BD（预测）',
            'BD'
        ),
        'BD(预测)',
        'BD'
   )
SET ds.coefficient = target.calculated_coefficient
WHERE ds.date < CURDATE()
  AND NOT (ds.coefficient <=> target.calculated_coefficient);

SET @restored_rows = ROW_COUNT();

COMMIT;

DROP TEMPORARY TABLE IF EXISTS temp_historical_bd_ld_targets;
DROP TEMPORARY TABLE IF EXISTS temp_historical_bd_ld_samples;

SELECT @restored_rows AS restored_rows;
