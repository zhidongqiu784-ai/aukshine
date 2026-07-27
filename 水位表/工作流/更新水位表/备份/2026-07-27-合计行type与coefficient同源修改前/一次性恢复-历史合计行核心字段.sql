-- 一次性恢复全部历史分店铺行和合计行的核心销量字段。
-- weighted_sales 只使用重新计算的 base_sales，不使用 daily_base_sales，也没有回退值。

DROP TEMPORARY TABLE IF EXISTS temp_historical_daily_targets;
DROP TEMPORARY TABLE IF EXISTS temp_historical_history_sources;
DROP TEMPORARY TABLE IF EXISTS temp_historical_weighted;

CREATE TEMPORARY TABLE temp_historical_daily_targets AS
WITH logical_targets AS (
    SELECT DISTINCT asin, country, date
    FROM daily_sales
    WHERE date < CURDATE()
),
store_ranked AS (
    SELECT
        asin,
        country,
        date,
        sales,
        coefficient,
        type,
        ROW_NUMBER() OVER (
            PARTITION BY asin, country, date
            ORDER BY coefficient DESC, type DESC
        ) AS type_rank
    FROM daily_sales
    WHERE shop <> '合计'
      AND date < CURDATE()
),
store_daily AS (
    SELECT
        asin,
        country,
        date,
        SUM(sales) AS total_sales,
        ROUND(MAX(coefficient), 2) AS target_coefficient,
        MAX(CASE WHEN type_rank = 1 THEN type END) AS target_type,
        CAST(
            ROUND(SUM(sales) / NULLIF(MAX(coefficient), 0), 0)
            AS SIGNED
        ) AS base_sales
    FROM store_ranked
    GROUP BY asin, country, date
)
SELECT
    target.asin,
    target.country,
    target.date,
    CASE WHEN store.asin IS NULL THEN 0 ELSE 1 END AS has_shop_rows,
    store.total_sales,
    store.target_coefficient,
    store.target_type,
    store.base_sales
FROM logical_targets AS target
LEFT JOIN store_daily AS store
    ON store.asin = target.asin
   AND store.country = target.country
   AND store.date = target.date;

ALTER TABLE temp_historical_daily_targets
    ADD UNIQUE INDEX idx_historical_daily_target (asin, country, date);

CREATE TEMPORARY TABLE temp_historical_history_sources AS
SELECT asin, country, date, base_sales
FROM temp_historical_daily_targets
WHERE base_sales IS NOT NULL;

ALTER TABLE temp_historical_history_sources
    ADD UNIQUE INDEX idx_historical_history_source (asin, country, date);

CREATE TEMPORARY TABLE temp_historical_weighted AS
WITH history_ranked AS (
    SELECT
        target.asin,
        target.country,
        target.date AS target_date,
        history.base_sales,
        ROW_NUMBER() OVER (
            PARTITION BY target.asin, target.country, target.date
            ORDER BY history.date DESC
        ) AS row_num,
        COUNT(*) OVER (
            PARTITION BY target.asin, target.country, target.date
        ) AS total_count
    FROM temp_historical_daily_targets AS target
    INNER JOIN temp_historical_history_sources AS history
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
                AVG(base_sales)
            WHEN MAX(total_count) BETWEEN 4 AND 7 THEN
                AVG(CASE
                    WHEN row_num <= CEIL(total_count * 0.3) THEN base_sales
                END) * 0.7
                + AVG(CASE
                    WHEN row_num > CEIL(total_count * 0.3) THEN base_sales
                END) * 0.3
            WHEN MAX(total_count) BETWEEN 8 AND 15 THEN
                AVG(CASE
                    WHEN row_num <= CEIL(total_count * 0.33) THEN base_sales
                END) * 0.6
                + AVG(CASE
                    WHEN row_num BETWEEN CEIL(total_count * 0.33) + 1
                                     AND CEIL(total_count * 0.66)
                    THEN base_sales
                END) * 0.3
                + AVG(CASE
                    WHEN row_num > CEIL(total_count * 0.66) THEN base_sales
                END) * 0.1
            ELSE
                AVG(CASE WHEN row_num <= 7 THEN base_sales END) * 0.5
                + AVG(CASE
                    WHEN row_num BETWEEN 8 AND 15 THEN base_sales
                END) * 0.3
                + AVG(CASE
                    WHEN row_num BETWEEN 16 AND 30 THEN base_sales
                END) * 0.2
        END,
        1
    ) AS weighted_value
FROM history_ranked
GROUP BY asin, country, target_date;

ALTER TABLE temp_historical_weighted
    ADD UNIQUE INDEX idx_historical_weighted (asin, country, date);

-- 更新前预检：分别显示分店铺行和合计行预计变化数量。
SELECT
    CASE WHEN ds.shop = '合计' THEN '合计' ELSE '分店铺' END AS row_type,
    COUNT(*) AS historical_rows,
    SUM(NOT (ds.base_sales <=> target.base_sales)) AS base_sales_changes,
    SUM(NOT (ds.weighted_sales <=> weighted.weighted_value)) AS weighted_sales_changes,
    SUM(NOT (
        ds.maybe_sales <=> CAST(
            ROUND(
                weighted.weighted_value * CASE
                    WHEN ds.shop = '合计' AND target.has_shop_rows = 1
                        THEN target.target_coefficient
                    ELSE ds.coefficient
                END,
                0
            ) AS SIGNED
        )
    )) AS maybe_sales_changes,
    SUM(
        ds.shop = '合计'
        AND target.has_shop_rows = 1
        AND NOT (ds.coefficient <=> target.target_coefficient)
    ) AS coefficient_changes,
    SUM(
        ds.shop = '合计'
        AND target.has_shop_rows = 1
        AND NOT (ds.type <=> target.target_type)
    ) AS type_changes
FROM daily_sales AS ds
INNER JOIN temp_historical_daily_targets AS target
    ON target.asin = ds.asin
   AND target.country = ds.country
   AND target.date = ds.date
LEFT JOIN temp_historical_weighted AS weighted
    ON weighted.asin = ds.asin
   AND weighted.country = ds.country
   AND weighted.date = ds.date
WHERE ds.date < CURDATE()
GROUP BY CASE WHEN ds.shop = '合计' THEN '合计' ELSE '分店铺' END
ORDER BY row_type;

START TRANSACTION;

UPDATE daily_sales AS ds
INNER JOIN temp_historical_daily_targets AS target
    ON target.asin = ds.asin
   AND target.country = ds.country
   AND target.date = ds.date
LEFT JOIN temp_historical_weighted AS weighted
    ON weighted.asin = ds.asin
   AND weighted.country = ds.country
   AND weighted.date = ds.date
SET
    ds.type = CASE
        WHEN ds.shop = '合计' AND target.has_shop_rows = 1
            THEN target.target_type
        ELSE ds.type
    END,
    ds.coefficient = CASE
        WHEN ds.shop = '合计' AND target.has_shop_rows = 1
            THEN target.target_coefficient
        ELSE ds.coefficient
    END,
    ds.base_sales = target.base_sales,
    ds.weighted_sales = weighted.weighted_value,
    ds.maybe_sales = CAST(
        ROUND(
            weighted.weighted_value * CASE
                WHEN ds.shop = '合计' AND target.has_shop_rows = 1
                    THEN target.target_coefficient
                ELSE ds.coefficient
            END,
            0
        ) AS SIGNED
    )
WHERE ds.date < CURDATE()
  AND (
      NOT (ds.base_sales <=> target.base_sales)
      OR NOT (ds.weighted_sales <=> weighted.weighted_value)
      OR NOT (
          ds.maybe_sales <=> CAST(
              ROUND(
                  weighted.weighted_value * CASE
                      WHEN ds.shop = '合计' AND target.has_shop_rows = 1
                          THEN target.target_coefficient
                      ELSE ds.coefficient
                  END,
                  0
              ) AS SIGNED
          )
      )
      OR (
          ds.shop = '合计'
          AND target.has_shop_rows = 1
          AND (
              NOT (ds.coefficient <=> target.target_coefficient)
              OR NOT (ds.type <=> target.target_type)
          )
      )
  );

SET @restored_rows = ROW_COUNT();

COMMIT;

DROP TEMPORARY TABLE IF EXISTS temp_historical_weighted;
DROP TEMPORARY TABLE IF EXISTS temp_historical_history_sources;
DROP TEMPORARY TABLE IF EXISTS temp_historical_daily_targets;

SELECT @restored_rows AS restored_rows;
