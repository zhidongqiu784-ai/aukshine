DROP TEMPORARY TABLE IF EXISTS temp_historical_summary_daily_targets;
DROP TEMPORARY TABLE IF EXISTS temp_historical_summary_history_sources;
DROP TEMPORARY TABLE IF EXISTS temp_historical_summary_weighted;

CREATE TEMPORARY TABLE temp_historical_summary_daily_targets AS
WITH store_ranked AS (
    SELECT
        asin,
        country,
        date,
        sales,
        maybe_sales,
        coefficient,
        type,
        ROW_NUMBER() OVER (
            PARTITION BY asin, country, date
            ORDER BY coefficient DESC, type DESC
        ) AS type_rank
    FROM daily_sales
    WHERE shop <> '合计'
      AND date < CURDATE()
)
SELECT
    asin,
    country,
    date,
    SUM(sales) AS total_sales,
    SUM(COALESCE(maybe_sales, 0)) AS total_maybe_sales,
    ROUND(MAX(coefficient), 2) AS target_coefficient,
    MAX(CASE WHEN type_rank = 1 THEN type END) AS target_type,
    SUM(sales) / NULLIF(MAX(coefficient), 0) AS daily_base_sales,
    CAST(
        ROUND(SUM(sales) / NULLIF(MAX(coefficient), 0), 0)
        AS SIGNED
    ) AS target_base_sales
FROM store_ranked
GROUP BY asin, country, date;

ALTER TABLE temp_historical_summary_daily_targets
    ADD INDEX idx_summary_daily_target (asin, country, date);

CREATE TEMPORARY TABLE temp_historical_summary_history_sources AS
SELECT *
FROM temp_historical_summary_daily_targets;

ALTER TABLE temp_historical_summary_history_sources
    ADD INDEX idx_summary_history_source (asin, country, date);

CREATE TEMPORARY TABLE temp_historical_summary_weighted AS
WITH history_ranked AS (
    SELECT
        target.asin,
        target.country,
        target.date AS target_date,
        history.daily_base_sales,
        ROW_NUMBER() OVER (
            PARTITION BY target.asin, target.country, target.date
            ORDER BY history.date DESC
        ) AS row_num,
        COUNT(*) OVER (
            PARTITION BY target.asin, target.country, target.date
        ) AS total_count
    FROM temp_historical_summary_daily_targets AS target
    INNER JOIN temp_historical_summary_history_sources AS history
        ON history.asin = target.asin
       AND history.country = target.country
       AND history.date BETWEEN DATE_SUB(target.date, INTERVAL 30 DAY)
                            AND DATE_SUB(target.date, INTERVAL 1 DAY)
)
SELECT
    asin,
    country,
    target_date AS date,
    ROUND(
        CASE
            WHEN MAX(total_count) BETWEEN 1 AND 3 THEN
                AVG(daily_base_sales)
            WHEN MAX(total_count) BETWEEN 4 AND 7 THEN
                AVG(CASE
                    WHEN row_num <= CEIL(total_count * 0.3) THEN daily_base_sales
                END) * 0.7
                + AVG(CASE
                    WHEN row_num > CEIL(total_count * 0.3) THEN daily_base_sales
                END) * 0.3
            WHEN MAX(total_count) BETWEEN 8 AND 15 THEN
                AVG(CASE
                    WHEN row_num <= CEIL(total_count * 0.33) THEN daily_base_sales
                END) * 0.6
                + AVG(CASE
                    WHEN row_num BETWEEN CEIL(total_count * 0.33) + 1
                                     AND CEIL(total_count * 0.66)
                    THEN daily_base_sales
                END) * 0.3
                + AVG(CASE
                    WHEN row_num > CEIL(total_count * 0.66) THEN daily_base_sales
                END) * 0.1
            ELSE
                AVG(CASE WHEN row_num <= 7 THEN daily_base_sales END) * 0.5
                + AVG(CASE
                    WHEN row_num BETWEEN 8 AND 15 THEN daily_base_sales
                END) * 0.3
                + AVG(CASE
                    WHEN row_num BETWEEN 16 AND 30 THEN daily_base_sales
                END) * 0.2
        END,
        1
    ) AS weighted_value
FROM history_ranked
GROUP BY asin, country, target_date;

ALTER TABLE temp_historical_summary_weighted
    ADD INDEX idx_summary_weighted (asin, country, date);

START TRANSACTION;

UPDATE daily_sales AS total
INNER JOIN temp_historical_summary_daily_targets AS target
    ON target.asin = total.asin
   AND target.country = total.country
   AND target.date = total.date
LEFT JOIN temp_historical_summary_weighted AS weighted
    ON weighted.asin = total.asin
   AND weighted.country = total.country
   AND weighted.date = total.date
SET
    total.type = target.target_type,
    total.coefficient = target.target_coefficient,
    total.base_sales = COALESCE(target.target_base_sales, total.base_sales),
    total.weighted_sales = COALESCE(
        weighted.weighted_value,
        NULLIF(
            ROUND(
                target.total_maybe_sales / NULLIF(target.target_coefficient, 0),
                1
            ),
            0
        ),
        total.weighted_sales
    )
WHERE total.shop = '合计'
  AND total.date < CURDATE()
  AND (
      NOT (total.type <=> target.target_type)
      OR NOT (total.coefficient <=> target.target_coefficient)
      OR NOT (
          total.base_sales <=> COALESCE(
              target.target_base_sales,
              total.base_sales
          )
      )
      OR NOT (
          total.weighted_sales <=> COALESCE(
              weighted.weighted_value,
              NULLIF(
                  ROUND(
                      target.total_maybe_sales
                      / NULLIF(target.target_coefficient, 0),
                      1
                  ),
                  0
              ),
              total.weighted_sales
          )
      )
  );

SET @restored_rows = ROW_COUNT();

COMMIT;

DROP TEMPORARY TABLE IF EXISTS temp_historical_summary_weighted;
DROP TEMPORARY TABLE IF EXISTS temp_historical_summary_history_sources;
DROP TEMPORARY TABLE IF EXISTS temp_historical_summary_daily_targets;

SELECT @restored_rows AS restored_rows;
