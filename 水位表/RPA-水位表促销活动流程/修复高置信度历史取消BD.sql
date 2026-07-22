/*
用途：修复经“历史已取消BD自动修复候选验证.sql”确认的高置信度历史取消BD。
数据库：MySQL 8.0+

本次固定范围：
1. FR / B0GRB39S7G / 詹慕斯 / 2026-05-18 至 2026-05-19
2. JP / B0CJVFJMVF / 聪冲冲 / 2026-05-15 至 2026-05-17
3. US / B0FB3P6H48 / 绘影 / 2026-05-27 至 2026-06-07

保护规则：
- deal_date 必须仍是同一条“已取消”BD。
- 必须仍有34条目标店铺/合计记录；首次执行时31条尚未标记BD，
  若前序步骤已成功而后序步骤中断，也允许34条均已恢复为BD后续跑。
- 当前BD系数必须仍分别为1.70、0.82、2.60。
- 任一闸门不满足时，通过临时表 CHECK 约束终止执行。
- 所有 UPDATE 都带修改前旧值校验，避免覆盖并发变化。
*/

DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_guard;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_scope;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_target_snapshot;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_daily_base;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_base_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_changed_base_days;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_weighted_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_maybe_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_coefficient_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_future_coefficient;
DROP TEMPORARY TABLE IF EXISTS temp_bd_repair_future_maybe;

CREATE TEMPORARY TABLE temp_bd_repair_scope (
    promotion_id VARCHAR(255) NOT NULL,
    country VARCHAR(20) NOT NULL,
    shop VARCHAR(255) NOT NULL,
    asin VARCHAR(50) NOT NULL,
    repair_start_date DATE NOT NULL,
    repair_end_date DATE NOT NULL,
    expected_bd_coefficient DECIMAL(12, 4) NOT NULL,
    PRIMARY KEY (promotion_id),
    INDEX idx_bd_repair_scope_pair (country, asin),
    INDEX idx_bd_repair_scope_date (repair_start_date, repair_end_date)
);

INSERT INTO temp_bd_repair_scope (
    promotion_id,
    country,
    shop,
    asin,
    repair_start_date,
    repair_end_date,
    expected_bd_coefficient
)
VALUES
    (
        '7af44a00-68cc-4dfb-8a01-9caf3d43df79',
        'FR',
        '詹慕斯',
        'B0GRB39S7G',
        '2026-05-18',
        '2026-05-19',
        1.70
    ),
    (
        '26d759a7-e9e8-4763-ba20-8a7ba726b9df',
        'JP',
        '聪冲冲',
        'B0CJVFJMVF',
        '2026-05-15',
        '2026-05-17',
        0.82
    ),
    (
        'f0e04c00-bdee-4263-a731-6d6d7dedc358',
        'US',
        '绘影',
        'B0FB3P6H48',
        '2026-05-27',
        '2026-06-07',
        2.60
    );

/* CHECK 闸门：插入任何非零值都会终止脚本。 */
CREATE TEMPORARY TABLE temp_bd_repair_guard (
    guard_name VARCHAR(100) NOT NULL,
    error_count INT NOT NULL,
    CONSTRAINT chk_bd_repair_guard CHECK (error_count = 0)
);

INSERT INTO temp_bd_repair_guard
SELECT
    'deal_date_scope_changed',
    3 - COUNT(*)
FROM temp_bd_repair_scope AS scope
INNER JOIN deal_date AS dd
    ON dd.promotion_id = scope.promotion_id
   AND dd.country = scope.country
   AND dd.shop_code = scope.shop
   AND dd.asin = scope.asin
   AND dd.promotion_type = 'BD'
   AND dd.origin_status = '已取消'
   AND DATE(dd.promotion_start_time) <= scope.repair_start_date
   AND DATE(dd.promotion_end_time) >= scope.repair_end_date;

INSERT INTO temp_bd_repair_guard
SELECT
    'sales_coefficient_changed_or_missing',
    3 - COUNT(*)
FROM temp_bd_repair_scope AS scope
INNER JOIN sales_coefficient AS sc
    ON sc.country = scope.country
   AND sc.asin = scope.asin
   AND sc.type = 'BD'
   AND ABS(sc.coefficient - scope.expected_bd_coefficient) < 0.000001;

CREATE TEMPORARY TABLE temp_bd_repair_target_snapshot AS
SELECT
    ds.shop_country_asin_date,
    ds.country,
    ds.asin,
    ds.shop,
    ds.`date`,
    ds.type AS old_type,
    ds.coefficient AS old_coefficient,
    ds.base_sales AS old_base_sales,
    ds.weighted_sales AS old_weighted_sales,
    ds.maybe_sales AS old_maybe_sales,
    scope.shop AS activity_shop,
    scope.expected_bd_coefficient AS bd_coefficient
FROM temp_bd_repair_scope AS scope
INNER JOIN daily_sales AS ds
    ON ds.country = scope.country
   AND ds.asin = scope.asin
   AND ds.shop IN (scope.shop, '合计')
   AND ds.`date` BETWEEN scope.repair_start_date AND scope.repair_end_date;

ALTER TABLE temp_bd_repair_target_snapshot
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_bd_target_pair_date (country, asin, `date`);

INSERT INTO temp_bd_repair_guard
SELECT
    'target_row_count_changed',
    ABS(COUNT(*) - 34)
FROM temp_bd_repair_target_snapshot;

INSERT INTO temp_bd_repair_guard
SELECT
    'target_type_change_count_changed',
    CASE
        WHEN SUM(NOT (old_type <=> 'BD')) IN (0, 31) THEN 0
        ELSE 1
    END
FROM temp_bd_repair_target_snapshot;

INSERT INTO temp_bd_repair_guard
SELECT
    'unexpected_target_type',
    SUM(old_type IS NULL OR old_type NOT IN ('日常', 'BD'))
FROM temp_bd_repair_target_snapshot;

/* 1. 仅恢复活动店铺行和合计行，不改同ASIN的其他店铺。 */
UPDATE daily_sales AS ds
INNER JOIN temp_bd_repair_target_snapshot AS snap
    ON snap.shop_country_asin_date = ds.shop_country_asin_date
SET
    ds.type = 'BD',
    ds.coefficient = snap.bd_coefficient
WHERE (ds.type <=> snap.old_type)
  AND (ds.coefficient <=> snap.old_coefficient)
  AND (
      NOT (ds.type <=> 'BD')
      OR NOT (ds.coefficient <=> snap.bd_coefficient)
  );

SET @corrected_bd_type_coefficient_rows = ROW_COUNT();

/* 2. 使用现有口径：同ASIN、国家、日期的分店铺销量合计 / 最大系数。 */
CREATE TEMPORARY TABLE temp_bd_repair_daily_base AS
SELECT
    scope.country,
    scope.asin,
    ds.`date`,
    SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0) AS daily_base_sales
FROM temp_bd_repair_scope AS scope
INNER JOIN daily_sales AS ds
    ON ds.country = scope.country
   AND ds.asin = scope.asin
   AND ds.shop <> '合计'
   AND ds.`date` BETWEEN scope.repair_start_date AND scope.repair_end_date
GROUP BY
    scope.country,
    scope.asin,
    ds.`date`;

ALTER TABLE temp_bd_repair_daily_base
ADD PRIMARY KEY (country, asin, `date`);

CREATE TEMPORARY TABLE temp_bd_repair_base_recalc AS
SELECT
    ds.shop_country_asin_date,
    ds.country,
    ds.asin,
    ds.shop,
    ds.`date`,
    ds.base_sales AS old_base_sales,
    CAST(ROUND(base.daily_base_sales, 0) AS SIGNED) AS new_base_sales
FROM temp_bd_repair_daily_base AS base
INNER JOIN daily_sales AS ds
    ON ds.country = base.country
   AND ds.asin = base.asin
   AND ds.`date` = base.`date`
WHERE base.daily_base_sales IS NOT NULL;

ALTER TABLE temp_bd_repair_base_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_bd_base_pair_date (country, asin, `date`);

CREATE TEMPORARY TABLE temp_bd_repair_changed_base_days AS
SELECT DISTINCT
    country,
    asin,
    `date`
FROM temp_bd_repair_base_recalc
/*
FR和US的活动店铺系数高于日常系数，首次执行时这14天的日基准发生变化。
这里固定保留其来源日期，使前序写入成功、后序中断后仍能续跑加权重算。
JP的活动店铺原本已有BD且系数低于日常，不会改变最大系数口径。
*/
WHERE country IN ('FR', 'US');

ALTER TABLE temp_bd_repair_changed_base_days
ADD PRIMARY KEY (country, asin, `date`);

UPDATE daily_sales AS ds
INNER JOIN temp_bd_repair_base_recalc AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.base_sales = recalc.new_base_sales
WHERE (ds.base_sales <=> recalc.old_base_sales)
  AND NOT (ds.base_sales <=> recalc.new_base_sales);

SET @corrected_bd_base_sales_rows = ROW_COUNT();

/* 3. 仅重算前30天窗口包含实际变更基准销量日期的记录。 */
CREATE TEMPORARY TABLE temp_bd_repair_weighted_recalc AS
WITH daily_base_source AS (
    SELECT
        ds.country,
        ds.asin,
        ds.`date` AS history_date,
        SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0) AS daily_base_sales
    FROM daily_sales AS ds
    INNER JOIN temp_bd_repair_scope AS scope
        ON scope.country = ds.country
       AND scope.asin = ds.asin
    WHERE ds.shop <> '合计'
      AND ds.`date` < CURDATE()
    GROUP BY
        ds.country,
        ds.asin,
        ds.`date`
),
affected_targets AS (
    SELECT DISTINCT
        target.shop_country_asin_date,
        target.country,
        target.asin,
        target.shop,
        target.`date` AS target_date,
        target.weighted_sales AS old_weighted_sales
    FROM temp_bd_repair_changed_base_days AS changed
    INNER JOIN daily_sales AS target
        ON target.country = changed.country
       AND target.asin = changed.asin
       AND target.`date` BETWEEN DATE_ADD(changed.`date`, INTERVAL 1 DAY)
                             AND DATE_ADD(changed.`date`, INTERVAL 30 DAY)
       AND target.`date` < CURDATE()
),
history_ranked AS (
    SELECT
        target.shop_country_asin_date,
        target.country,
        target.asin,
        target.shop,
        target.target_date,
        target.old_weighted_sales,
        source.daily_base_sales,
        ROW_NUMBER() OVER (
            PARTITION BY target.shop_country_asin_date
            ORDER BY source.history_date DESC
        ) AS row_num,
        COUNT(*) OVER (
            PARTITION BY target.shop_country_asin_date
        ) AS total_count
    FROM affected_targets AS target
    INNER JOIN daily_base_source AS source
        ON source.country = target.country
       AND source.asin = target.asin
       AND source.history_date BETWEEN DATE_SUB(target.target_date, INTERVAL 30 DAY)
                                  AND DATE_SUB(target.target_date, INTERVAL 1 DAY)
    WHERE source.daily_base_sales IS NOT NULL
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
SELECT *
FROM weighted;

ALTER TABLE temp_bd_repair_weighted_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_bd_weighted_pair_date (country, asin, target_date);

UPDATE daily_sales AS ds
INNER JOIN temp_bd_repair_weighted_recalc AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.weighted_sales = recalc.new_weighted_sales
WHERE recalc.new_weighted_sales IS NOT NULL
  AND (ds.weighted_sales <=> recalc.old_weighted_sales)
  AND NOT (ds.weighted_sales <=> recalc.new_weighted_sales);

SET @corrected_bd_weighted_sales_rows = ROW_COUNT();

/* 4. 重算直接修复行以及加权基准销量受影响行的历史预估销量。 */
CREATE TEMPORARY TABLE temp_bd_repair_maybe_recalc AS
SELECT
    ds.shop_country_asin_date,
    ds.maybe_sales AS old_maybe_sales,
    CASE
        WHEN ds.weighted_sales IS NULL OR ds.coefficient IS NULL THEN NULL
        ELSE CAST(ROUND(ds.weighted_sales * ds.coefficient, 0) AS SIGNED)
    END AS new_maybe_sales
FROM daily_sales AS ds
INNER JOIN (
    SELECT shop_country_asin_date
    FROM temp_bd_repair_target_snapshot

    UNION

    SELECT shop_country_asin_date
    FROM temp_bd_repair_weighted_recalc
) AS affected
    ON affected.shop_country_asin_date = ds.shop_country_asin_date;

ALTER TABLE temp_bd_repair_maybe_recalc
ADD PRIMARY KEY (shop_country_asin_date);

UPDATE daily_sales AS ds
INNER JOIN temp_bd_repair_maybe_recalc AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.maybe_sales = recalc.new_maybe_sales
WHERE recalc.new_maybe_sales IS NOT NULL
  AND (ds.maybe_sales <=> recalc.old_maybe_sales)
  AND NOT (ds.maybe_sales <=> recalc.new_maybe_sales);

SET @corrected_bd_maybe_sales_rows = ROW_COUNT();

/* 5. 按线上自动校准公式，只重算这3个ASIN/国家的BD系数。 */
CREATE TEMPORARY TABLE temp_bd_repair_coefficient_recalc AS
SELECT
    sc.asin,
    sc.country,
    sc.type,
    sc.coefficient AS old_coefficient,
    ROUND(
        SUM(ds.sales) / NULLIF(SUM(ds.weighted_sales), 0),
        2
    ) AS new_coefficient
FROM temp_bd_repair_scope AS scope
INNER JOIN sales_coefficient AS sc
    ON sc.asin = scope.asin
   AND sc.country = scope.country
   AND sc.type = 'BD'
INNER JOIN daily_sales AS ds
    ON ds.asin = sc.asin
   AND ds.country = sc.country
   AND ds.shop = '合计'
   AND ds.type = 'BD'
   AND ds.`date` < CURDATE()
   AND ds.sales IS NOT NULL
   AND ds.weighted_sales IS NOT NULL
   AND ds.weighted_sales <> 0
GROUP BY
    sc.asin,
    sc.country,
    sc.type,
    sc.coefficient;

ALTER TABLE temp_bd_repair_coefficient_recalc
ADD PRIMARY KEY (country, asin, type);

INSERT INTO temp_bd_repair_guard
SELECT
    'coefficient_recalc_missing',
    3 - COUNT(*)
FROM temp_bd_repair_coefficient_recalc
WHERE new_coefficient IS NOT NULL
  AND new_coefficient > 0;

UPDATE sales_coefficient AS sc
INNER JOIN temp_bd_repair_coefficient_recalc AS recalc
    ON recalc.asin = sc.asin
   AND recalc.country = sc.country
   AND recalc.type = sc.type
SET sc.coefficient = recalc.new_coefficient
WHERE (sc.coefficient <=> recalc.old_coefficient)
  AND recalc.new_coefficient IS NOT NULL
  AND recalc.new_coefficient > 0
  AND NOT (sc.coefficient <=> recalc.new_coefficient);

SET @corrected_bd_sales_coefficient_rows = ROW_COUNT();

/* 6. 按线上同步逻辑，只同步这3个ASIN/国家今天及未来的日类型系数。 */
CREATE TEMPORARY TABLE temp_bd_repair_future_coefficient AS
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

ALTER TABLE temp_bd_repair_future_coefficient
ADD PRIMARY KEY (shop_country_asin_date);

UPDATE daily_sales AS ds
INNER JOIN temp_bd_repair_future_coefficient AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.coefficient = recalc.new_coefficient
WHERE (ds.coefficient <=> recalc.old_coefficient)
  AND NOT (ds.coefficient <=> recalc.new_coefficient);

SET @corrected_bd_future_coefficient_rows = ROW_COUNT();

CREATE TEMPORARY TABLE temp_bd_repair_future_maybe AS
SELECT
    ds.shop_country_asin_date,
    ds.maybe_sales AS old_maybe_sales,
    CASE
        WHEN ds.weighted_sales IS NULL OR ds.coefficient IS NULL THEN NULL
        ELSE CAST(ROUND(ds.weighted_sales * ds.coefficient, 0) AS SIGNED)
    END AS new_maybe_sales
FROM daily_sales AS ds
INNER JOIN (
    SELECT DISTINCT country, asin
    FROM temp_bd_repair_scope
) AS scope
    ON scope.country = ds.country
   AND scope.asin = ds.asin
WHERE ds.`date` >= CURDATE();

ALTER TABLE temp_bd_repair_future_maybe
ADD PRIMARY KEY (shop_country_asin_date);

UPDATE daily_sales AS ds
INNER JOIN temp_bd_repair_future_maybe AS recalc
    ON recalc.shop_country_asin_date = ds.shop_country_asin_date
SET ds.maybe_sales = recalc.new_maybe_sales
WHERE recalc.new_maybe_sales IS NOT NULL
  AND (ds.maybe_sales <=> recalc.old_maybe_sales)
  AND NOT (ds.maybe_sales <=> recalc.new_maybe_sales);

SET @corrected_bd_future_maybe_rows = ROW_COUNT();

/* 7. 最终结果和残留检查。 */
SELECT
    @corrected_bd_type_coefficient_rows AS corrected_type_coefficient_rows,
    @corrected_bd_base_sales_rows AS corrected_base_sales_rows,
    @corrected_bd_weighted_sales_rows AS corrected_weighted_sales_rows,
    @corrected_bd_maybe_sales_rows AS corrected_historical_maybe_sales_rows,
    @corrected_bd_sales_coefficient_rows AS corrected_sales_coefficient_rows,
    @corrected_bd_future_coefficient_rows AS corrected_future_coefficient_rows,
    @corrected_bd_future_maybe_rows AS corrected_future_maybe_sales_rows,
    (
        SELECT COUNT(*)
        FROM temp_bd_repair_target_snapshot AS snap
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = snap.shop_country_asin_date
        WHERE ds.type <> 'BD'
           OR NOT (ds.coefficient <=> snap.bd_coefficient)
    ) AS remaining_target_type_coefficient_rows,
    (
        SELECT COUNT(*)
        FROM temp_bd_repair_base_recalc AS recalc
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = recalc.shop_country_asin_date
        WHERE NOT (ds.base_sales <=> recalc.new_base_sales)
    ) AS remaining_base_sales_rows,
    (
        SELECT COUNT(*)
        FROM temp_bd_repair_weighted_recalc AS recalc
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = recalc.shop_country_asin_date
        WHERE recalc.new_weighted_sales IS NOT NULL
          AND NOT (ds.weighted_sales <=> recalc.new_weighted_sales)
    ) AS remaining_weighted_sales_rows,
    (
        SELECT COUNT(*)
        FROM temp_bd_repair_maybe_recalc AS recalc
        INNER JOIN daily_sales AS ds
            ON ds.shop_country_asin_date = recalc.shop_country_asin_date
        WHERE recalc.new_maybe_sales IS NOT NULL
          AND NOT (ds.maybe_sales <=> recalc.new_maybe_sales)
    ) AS remaining_historical_maybe_sales_rows,
    (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT(
                'country', country,
                'asin', asin,
                'old_coefficient', old_coefficient,
                'new_coefficient', new_coefficient
            )
        )
        FROM temp_bd_repair_coefficient_recalc
    ) AS bd_coefficient_changes;

/* 临时表由本次SQL节点连接结束时自动释放，确保上方结果是最后结果集。 */
