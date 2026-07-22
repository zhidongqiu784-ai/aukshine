/*
用途：在历史BD修复和BD系数校准已经完成后，只完成3组产品的未来系数与预估销量同步。
这是“修复高置信度历史取消BD.sql”中断后的收尾脚本，不重复执行历史重算。
*/

DROP TEMPORARY TABLE IF EXISTS temp_bd_finish_guard;
DROP TEMPORARY TABLE IF EXISTS temp_bd_finish_future_coefficient;
DROP TEMPORARY TABLE IF EXISTS temp_bd_finish_future_maybe;

CREATE TEMPORARY TABLE temp_bd_finish_guard (
    guard_name VARCHAR(100) NOT NULL,
    error_count INT NOT NULL,
    CONSTRAINT chk_bd_finish_guard CHECK (error_count = 0)
);

/* 34条目标店铺/合计记录必须已经全部恢复为BD。 */
INSERT INTO temp_bd_finish_guard
SELECT
    'historical_target_not_completed',
    ABS(COUNT(*) - 34)
    + SUM(ds.type <> 'BD')
FROM daily_sales AS ds
WHERE (
        ds.country = 'FR'
        AND ds.asin = 'B0GRB39S7G'
        AND ds.shop IN ('詹慕斯', '合计')
        AND ds.`date` BETWEEN '2026-05-18' AND '2026-05-19'
      )
   OR (
        ds.country = 'JP'
        AND ds.asin = 'B0CJVFJMVF'
        AND ds.shop IN ('聪冲冲', '合计')
        AND ds.`date` BETWEEN '2026-05-15' AND '2026-05-17'
      )
   OR (
        ds.country = 'US'
        AND ds.asin = 'B0FB3P6H48'
        AND ds.shop IN ('绘影', '合计')
        AND ds.`date` BETWEEN '2026-05-27' AND '2026-06-07'
      );

/* 必须仍是本次历史重算得到的3条BD系数。 */
INSERT INTO temp_bd_finish_guard
SELECT
    'calibrated_bd_coefficient_changed',
    3 - COUNT(*)
FROM sales_coefficient AS sc
WHERE sc.type = 'BD'
  AND (
        (sc.country = 'FR' AND sc.asin = 'B0GRB39S7G' AND ABS(sc.coefficient - 1.67) < 0.000001)
     OR (sc.country = 'JP' AND sc.asin = 'B0CJVFJMVF' AND ABS(sc.coefficient - 0.86) < 0.000001)
     OR (sc.country = 'US' AND sc.asin = 'B0FB3P6H48' AND ABS(sc.coefficient - 3.09) < 0.000001)
  );

CREATE TEMPORARY TABLE temp_bd_finish_future_coefficient AS
WITH RECURSIVE future_types AS (
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
    WHERE (
            (ds.country = 'FR' AND ds.asin = 'B0GRB39S7G')
         OR (ds.country = 'JP' AND ds.asin = 'B0CJVFJMVF')
         OR (ds.country = 'US' AND ds.asin = 'B0FB3P6H48')
      )
      AND ds.`date` >= CURDATE()
      AND ds.type IS NOT NULL
      AND TRIM(ds.type) <> ''
),
type_parts AS (
    SELECT
        ft.asin,
        ft.country,
        ft.original_type,
        SUBSTRING_INDEX(ft.normalized_type, ',', 1) AS part_type,
        CASE
            WHEN INSTR(ft.normalized_type, ',') > 0
            THEN SUBSTRING(ft.normalized_type, INSTR(ft.normalized_type, ',') + 1)
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
            THEN SUBSTRING(tp.rest_type, INSTR(tp.rest_type, ',') + 1)
            ELSE ''
        END AS rest_type
    FROM type_parts AS tp
    WHERE tp.rest_type <> ''
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
    WHERE (
            (sc.country = 'FR' AND sc.asin = 'B0GRB39S7G')
         OR (sc.country = 'JP' AND sc.asin = 'B0CJVFJMVF')
         OR (sc.country = 'US' AND sc.asin = 'B0FB3P6H48')
      )
      AND sc.coefficient IS NOT NULL
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
),
calculated AS (
    SELECT
        tp.asin,
        tp.country,
        tp.original_type,
        ROUND(EXP(SUM(LN(cl.coefficient))), 2) AS calculated_coefficient
    FROM type_parts AS tp
    LEFT JOIN coefficient_lookup AS cl
        ON cl.asin = tp.asin
       AND cl.country = tp.country
       AND cl.normalized_type = tp.part_type
    GROUP BY
        tp.asin,
        tp.country,
        tp.original_type
    HAVING COUNT(*) = COUNT(cl.coefficient)
)
SELECT
    ds.shop_country_asin_date,
    ds.coefficient AS old_coefficient,
    calc.calculated_coefficient AS new_coefficient
FROM daily_sales AS ds
INNER JOIN calculated AS calc
    ON calc.asin = ds.asin
   AND calc.country = ds.country
   AND calc.original_type = ds.type
WHERE ds.`date` >= CURDATE();

ALTER TABLE temp_bd_finish_future_coefficient
ADD PRIMARY KEY (shop_country_asin_date);

UPDATE daily_sales AS ds
INNER JOIN temp_bd_finish_future_coefficient AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.coefficient = recalc.new_coefficient
WHERE (ds.coefficient <=> recalc.old_coefficient)
  AND NOT (ds.coefficient <=> recalc.new_coefficient);

SET @corrected_bd_future_coefficient_rows = ROW_COUNT();

CREATE TEMPORARY TABLE temp_bd_finish_future_maybe AS
SELECT
    ds.shop_country_asin_date,
    ds.maybe_sales AS old_maybe_sales,
    CASE
        WHEN ds.weighted_sales IS NULL OR ds.coefficient IS NULL THEN NULL
        ELSE CAST(ROUND(ds.weighted_sales * ds.coefficient, 0) AS SIGNED)
    END AS new_maybe_sales
FROM daily_sales AS ds
WHERE (
        (ds.country = 'FR' AND ds.asin = 'B0GRB39S7G')
     OR (ds.country = 'JP' AND ds.asin = 'B0CJVFJMVF')
     OR (ds.country = 'US' AND ds.asin = 'B0FB3P6H48')
  )
  AND ds.`date` >= CURDATE();

ALTER TABLE temp_bd_finish_future_maybe
ADD PRIMARY KEY (shop_country_asin_date);

UPDATE daily_sales AS ds
INNER JOIN temp_bd_finish_future_maybe AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.maybe_sales = recalc.new_maybe_sales
WHERE recalc.new_maybe_sales IS NOT NULL
  AND (ds.maybe_sales <=> recalc.old_maybe_sales)
  AND NOT (ds.maybe_sales <=> recalc.new_maybe_sales);

SET @corrected_bd_future_maybe_rows = ROW_COUNT();

SELECT
    @corrected_bd_future_coefficient_rows AS corrected_future_coefficient_rows,
    @corrected_bd_future_maybe_rows AS corrected_future_maybe_sales_rows,
    (
        SELECT COUNT(*)
        FROM temp_bd_finish_future_coefficient AS recalc
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = recalc.shop_country_asin_date
        WHERE NOT (ds.coefficient <=> recalc.new_coefficient)
    ) AS remaining_future_coefficient_rows,
    (
        SELECT COUNT(*)
        FROM temp_bd_finish_future_maybe AS recalc
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = recalc.shop_country_asin_date
        WHERE recalc.new_maybe_sales IS NOT NULL
          AND NOT (ds.maybe_sales <=> recalc.new_maybe_sales)
    ) AS remaining_future_maybe_sales_rows;

/* 临时表由本次SQL节点连接结束时自动释放。 */
