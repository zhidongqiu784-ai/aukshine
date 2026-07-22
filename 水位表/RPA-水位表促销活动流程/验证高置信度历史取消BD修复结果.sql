/* 只读验收：独立重算本次修复范围，不写入任何表。 */

WITH
repair_scope AS (
    SELECT 'FR' AS country, 'B0GRB39S7G' AS asin, '詹慕斯' AS activity_shop,
           DATE('2026-05-18') AS repair_start_date,
           DATE('2026-05-19') AS repair_end_date,
           1.70 AS historical_bd_coefficient
    UNION ALL
    SELECT 'JP', 'B0CJVFJMVF', '聪冲冲',
           DATE('2026-05-15'), DATE('2026-05-17'), 0.82
    UNION ALL
    SELECT 'US', 'B0FB3P6H48', '绘影',
           DATE('2026-05-27'), DATE('2026-06-07'), 2.60
),
target_rows AS (
    SELECT
        ds.*,
        scope.historical_bd_coefficient
    FROM repair_scope AS scope
    INNER JOIN daily_sales AS ds
        ON ds.country = scope.country
       AND ds.asin = scope.asin
       AND ds.shop IN (scope.activity_shop, '合计')
       AND ds.`date` BETWEEN scope.repair_start_date AND scope.repair_end_date
),
repair_daily_base AS (
    SELECT
        scope.country,
        scope.asin,
        ds.`date`,
        CAST(
            ROUND(
                SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0),
                0
            ) AS SIGNED
        ) AS expected_base_sales
    FROM repair_scope AS scope
    INNER JOIN daily_sales AS ds
        ON ds.country = scope.country
       AND ds.asin = scope.asin
       AND ds.shop <> '合计'
       AND ds.`date` BETWEEN scope.repair_start_date AND scope.repair_end_date
    GROUP BY
        scope.country,
        scope.asin,
        ds.`date`
),
base_comparison AS (
    SELECT
        ds.shop_country_asin_date,
        ds.base_sales,
        base.expected_base_sales
    FROM repair_daily_base AS base
    INNER JOIN daily_sales AS ds
        ON ds.country = base.country
       AND ds.asin = base.asin
       AND ds.`date` = base.`date`
),
weighted_target_rows AS (
    SELECT
        ds.shop_country_asin_date,
        ds.country,
        ds.asin,
        ds.shop,
        ds.`date` AS target_date,
        ds.weighted_sales
    FROM daily_sales AS ds
    WHERE (
            ds.country = 'FR'
            AND ds.asin = 'B0GRB39S7G'
            AND ds.`date` BETWEEN '2026-05-19' AND '2026-06-18'
          )
       OR (
            ds.country = 'US'
            AND ds.asin = 'B0FB3P6H48'
            AND ds.`date` BETWEEN '2026-05-28' AND '2026-07-07'
          )
),
daily_base_source AS (
    SELECT
        ds.country,
        ds.asin,
        ds.`date` AS history_date,
        SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0) AS daily_base_sales
    FROM daily_sales AS ds
    WHERE ds.shop <> '合计'
      AND ds.`date` < CURDATE()
      AND (
            (ds.country = 'FR' AND ds.asin = 'B0GRB39S7G')
         OR (ds.country = 'US' AND ds.asin = 'B0FB3P6H48')
      )
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
        target.target_date,
        target.weighted_sales,
        source.daily_base_sales,
        ROW_NUMBER() OVER (
            PARTITION BY target.shop_country_asin_date
            ORDER BY source.history_date DESC
        ) AS row_num,
        COUNT(*) OVER (
            PARTITION BY target.shop_country_asin_date
        ) AS total_count
    FROM weighted_target_rows AS target
    INNER JOIN daily_base_source AS source
        ON source.country = target.country
       AND source.asin = target.asin
       AND source.history_date BETWEEN DATE_SUB(target.target_date, INTERVAL 30 DAY)
                                  AND DATE_SUB(target.target_date, INTERVAL 1 DAY)
    WHERE source.daily_base_sales IS NOT NULL
),
weighted_expected AS (
    SELECT
        shop_country_asin_date,
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
        ) AS expected_weighted_sales
    FROM history_ranked
    GROUP BY
        shop_country_asin_date,
        total_count
),
maybe_scope AS (
    SELECT shop_country_asin_date
    FROM target_rows

    UNION

    SELECT shop_country_asin_date
    FROM weighted_target_rows
)
SELECT
    (SELECT COUNT(*) FROM target_rows) AS target_rows,
    (
        SELECT COUNT(*)
        FROM target_rows
        WHERE type <> 'BD'
           OR NOT (coefficient <=> historical_bd_coefficient)
    ) AS target_type_coefficient_mismatches,
    (SELECT COUNT(*) FROM base_comparison) AS base_checked_rows,
    (
        SELECT COUNT(*)
        FROM base_comparison
        WHERE NOT (base_sales <=> expected_base_sales)
    ) AS base_mismatches,
    (SELECT COUNT(*) FROM weighted_expected) AS weighted_checked_rows,
    (
        SELECT COUNT(*)
        FROM weighted_expected AS expected
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = expected.shop_country_asin_date
        WHERE NOT (ds.weighted_sales <=> expected.expected_weighted_sales)
    ) AS weighted_mismatches,
    (SELECT COUNT(*) FROM maybe_scope) AS historical_maybe_checked_rows,
    (
        SELECT COUNT(*)
        FROM maybe_scope AS scope
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = scope.shop_country_asin_date
        WHERE ds.weighted_sales IS NOT NULL
          AND ds.coefficient IS NOT NULL
          AND NOT (
              ds.maybe_sales
              <=> CAST(ROUND(ds.weighted_sales * ds.coefficient, 0) AS SIGNED)
          )
    ) AS historical_maybe_mismatches,
    (
        SELECT COUNT(*)
        FROM sales_coefficient AS sc
        WHERE sc.type = 'BD'
          AND (
                (sc.country = 'FR' AND sc.asin = 'B0GRB39S7G' AND ABS(sc.coefficient - 1.67) < 0.000001)
             OR (sc.country = 'JP' AND sc.asin = 'B0CJVFJMVF' AND ABS(sc.coefficient - 0.86) < 0.000001)
             OR (sc.country = 'US' AND sc.asin = 'B0FB3P6H48' AND ABS(sc.coefficient - 3.09) < 0.000001)
          )
    ) AS calibrated_bd_coefficient_rows;
