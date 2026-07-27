DROP TEMPORARY TABLE IF EXISTS temp_daily_type_coefficient;

CREATE TEMPORARY TABLE temp_daily_type_coefficient AS
WITH RECURSIVE
future_types AS (
    SELECT DISTINCT
        ds.asin,
        ds.country,
        ds.type AS original_type,
        REPLACE(
            REPLACE(
                REPLACE(
                    REPLACE(
                        REPLACE(ds.type, '、', ','),
                        '，',
                        ','
                    ),
                    ' ',
                    ''
                ),
                'BD（预测）',
                'BD'
            ),
            'BD(预测)',
            'BD'
        ) AS normalized_type
    FROM daily_sales AS ds
    WHERE ds.date >= CURDATE()
      AND ds.asin IS NOT NULL
      AND ds.country IS NOT NULL
      AND ds.type IS NOT NULL
      AND TRIM(ds.type) != ''
),
type_parts AS (
    SELECT
        ft.asin,
        ft.country,
        ft.original_type,
        SUBSTRING_INDEX(ft.normalized_type, ',', 1) AS part_type,
        CASE
            WHEN INSTR(ft.normalized_type, ',') > 0
            THEN SUBSTRING(
                ft.normalized_type,
                INSTR(ft.normalized_type, ',') + 1
            )
            ELSE ''
        END AS rest_type
    FROM future_types AS ft

    UNION ALL

    SELECT
        tp.asin,
        tp.country,
        tp.original_type,
        SUBSTRING_INDEX(tp.rest_type, ',', 1) AS part_type,
        CASE
            WHEN INSTR(tp.rest_type, ',') > 0
            THEN SUBSTRING(
                tp.rest_type,
                INSTR(tp.rest_type, ',') + 1
            )
            ELSE ''
        END AS rest_type
    FROM type_parts AS tp
    WHERE tp.rest_type != ''
),
coefficient_lookup AS (
    SELECT
        sc.asin,
        sc.country,
        REPLACE(
            REPLACE(
                REPLACE(sc.type, '、', ','),
                '，',
                ','
            ),
            ' ',
            ''
        ) AS normalized_type,
        MAX(sc.coefficient) AS coefficient
    FROM sales_coefficient AS sc
    WHERE sc.coefficient IS NOT NULL
      AND sc.coefficient > 0
    GROUP BY
        sc.asin,
        sc.country,
        REPLACE(
            REPLACE(
                REPLACE(sc.type, '、', ','),
                '，',
                ','
            ),
            ' ',
            ''
        )
    HAVING COUNT(DISTINCT sc.coefficient) = 1
)
SELECT
    tp.asin,
    tp.country,
    tp.original_type,
    ROUND(
        EXP(SUM(LN(cl.coefficient))),
        2
    ) AS calculated_coefficient
FROM type_parts AS tp
LEFT JOIN coefficient_lookup AS cl
    ON cl.asin = tp.asin
   AND cl.country = tp.country
   AND cl.normalized_type = tp.part_type
GROUP BY
    tp.asin,
    tp.country,
    tp.original_type
HAVING COUNT(*) = COUNT(cl.coefficient);

ALTER TABLE temp_daily_type_coefficient
ADD INDEX idx_type_lookup (asin, country, original_type);

UPDATE daily_sales AS ds
INNER JOIN temp_daily_type_coefficient AS calc
    ON calc.asin = ds.asin
   AND calc.country = ds.country
   AND calc.original_type = ds.type
SET ds.coefficient = calc.calculated_coefficient
WHERE ds.date >= CURDATE()
  AND NOT (
      ds.coefficient <=> calc.calculated_coefficient
  );

DROP TEMPORARY TABLE IF EXISTS temp_daily_type_coefficient;
