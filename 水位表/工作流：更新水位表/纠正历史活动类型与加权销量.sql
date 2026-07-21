-- 纠正全部历史活动类型系数、加权基准销量与预估销量
--
-- 适用范围：
-- 1. 只处理 date < CURDATE() 的历史记录。
-- 2. 分店铺行：按最新日类型规则重算 coefficient。
--    - 大促BDLD、基础活动类型、专享类型不参与叠加，按优先级单独显示。
--    - 普通单类型直接取 sales_coefficient。
--    - 普通复合类型按组成类型系数连乘。
-- 3. 合计行：按节点06逻辑，从同日分店铺行中选当天最大系数及其日类型。
--    - 历史数据不保留 BD（预测），合计行统一恢复为同日分店铺实际类型。
-- 4. base_sales：使用修正后的系数重算全部可计算历史记录，明确四舍五入为整数。
-- 5. weighted_sales：每条历史记录都按目标日期前30天重算。
--    - 分店铺行和合计行都使用同 ASIN + 国家维度、按当天最大系数计算的基准销量。
-- 6. maybe_sales：分店铺行和合计行都按 weighted_sales * coefficient 四舍五入为整数。
--
-- 加权口径与 06-生成合计记录.sql 一致：
-- 1-3天直接平均；4-7天按70%/30%；8-15天按60%/30%/10%；
-- 16天及以上按最近7天50%、第8-15天30%、第16-30天20%，最终保留1位小数。
--
-- 高风险写入：执行前必须备份 daily_sales，或导出下方“修正前明细”结果。
-- NocoBase SQL 节点中不要手写 START TRANSACTION / COMMIT。

DROP TEMPORARY TABLE IF EXISTS temp_history_protected_types;
DROP TEMPORARY TABLE IF EXISTS temp_history_detail_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_summary_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_daily_base_source;
DROP TEMPORARY TABLE IF EXISTS temp_history_base_sales_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_weighted_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_maybe_recalc;

-- 1. 活动类型配置：用于识别“不参与叠加、优先显示”的日类型。
CREATE TEMPORARY TABLE temp_history_protected_types AS
SELECT
    daytype,
    country AS config_country,
    MIN(
        CASE daytype_category
            WHEN '大促BDLD' THEN 1
            WHEN '基础活动类型' THEN 2
            WHEN '专享类型' THEN 3
            ELSE 9
        END
    ) AS activity_priority
FROM datetypetime
WHERE daytype IS NOT NULL
  AND daytype_category IN ('大促BDLD', '基础活动类型', '专享类型')
GROUP BY daytype, country;

ALTER TABLE temp_history_protected_types
ADD PRIMARY KEY (daytype, config_country);

-- 2. 分店铺历史行：拆分日类型，计算最新算法下的目标日类型和系数。
CREATE TEMPORARY TABLE temp_history_detail_recalc AS
WITH RECURSIVE type_parts AS (
    SELECT
        ds.shop_country_asin_date,
        ds.asin,
        ds.country,
        ds.shop,
        ds.`date`,
        ds.type AS old_type,
        ds.coefficient AS old_coefficient,
        TRIM(SUBSTRING_INDEX(ds.type, '、', 1)) AS part_type,
        CASE
            WHEN ds.type LIKE '%、%' THEN TRIM(SUBSTRING(
                ds.type,
                CHAR_LENGTH(SUBSTRING_INDEX(ds.type, '、', 1)) + 2
            ))
            ELSE ''
        END AS rest_type
    FROM daily_sales ds
    WHERE ds.shop <> '合计'
      AND ds.`date` < CURDATE()
      AND ds.type IS NOT NULL
      AND ds.type <> ''

    UNION ALL

    SELECT
        shop_country_asin_date,
        asin,
        country,
        shop,
        `date`,
        old_type,
        old_coefficient,
        TRIM(SUBSTRING_INDEX(rest_type, '、', 1)) AS part_type,
        CASE
            WHEN rest_type LIKE '%、%' THEN TRIM(SUBSTRING(
                rest_type,
                CHAR_LENGTH(SUBSTRING_INDEX(rest_type, '、', 1)) + 2
            ))
            ELSE ''
        END AS rest_type
    FROM type_parts
    WHERE rest_type <> ''
),
part_coefficients AS (
    SELECT
        tp.*,
        pt.activity_priority,
        sc.coefficient AS part_coefficient
    FROM type_parts tp
    LEFT JOIN (
        SELECT
            daytype,
            country AS config_country,
            MIN(
                CASE daytype_category
                    WHEN '大促BDLD' THEN 1
                    WHEN '基础活动类型' THEN 2
                    WHEN '专享类型' THEN 3
                    ELSE 9
                END
            ) AS activity_priority
        FROM datetypetime
        WHERE daytype IS NOT NULL
          AND daytype_category IN ('大促BDLD', '基础活动类型', '专享类型')
        GROUP BY daytype, country
    ) pt
        ON pt.daytype = tp.part_type
       AND FIND_IN_SET(tp.country, pt.config_country) > 0
    LEFT JOIN sales_coefficient sc
        ON sc.asin = tp.asin
       AND sc.country = tp.country
       AND sc.type = tp.part_type
),
protected_choice AS (
    SELECT
        pc.*,
        ROW_NUMBER() OVER (
            PARTITION BY pc.shop_country_asin_date
            ORDER BY
                pc.activity_priority,
                pc.part_coefficient DESC,
                pc.part_type DESC
        ) AS priority_rank
    FROM part_coefficients pc
    WHERE pc.activity_priority IS NOT NULL
      AND pc.activity_priority < 9
),
protected_rows AS (
    SELECT
        shop_country_asin_date,
        asin,
        country,
        shop,
        `date`,
        old_type,
        old_coefficient,
        part_type AS new_type,
        CASE
            WHEN part_coefficient IS NOT NULL AND part_coefficient > 0 THEN part_coefficient
            ELSE NULL
        END AS new_coefficient,
        1 AS part_count,
        CASE
            WHEN part_coefficient IS NOT NULL AND part_coefficient > 0 THEN 1
            ELSE 0
        END AS matched_count,
        'protected_priority' AS calc_mode
    FROM protected_choice
    WHERE priority_rank = 1
),
ordinary_rows AS (
    SELECT
        pc.shop_country_asin_date,
        pc.asin,
        pc.country,
        pc.shop,
        pc.`date`,
        pc.old_type,
        pc.old_coefficient,
        pc.old_type AS new_type,
        CASE
            WHEN COUNT(*) = SUM(
                CASE
                    WHEN pc.part_coefficient IS NOT NULL AND pc.part_coefficient > 0 THEN 1
                    ELSE 0
                END
            )
            THEN EXP(SUM(
                CASE
                    WHEN pc.part_coefficient IS NOT NULL AND pc.part_coefficient > 0
                        THEN LN(pc.part_coefficient)
                END
            ))
            ELSE NULL
        END AS new_coefficient,
        COUNT(*) AS part_count,
        SUM(
            CASE
                WHEN pc.part_coefficient IS NOT NULL AND pc.part_coefficient > 0 THEN 1
                ELSE 0
            END
        ) AS matched_count,
        CASE
            WHEN COUNT(*) > 1 THEN 'ordinary_multiply'
            ELSE 'ordinary_direct'
        END AS calc_mode
    FROM part_coefficients pc
    WHERE NOT EXISTS (
        SELECT 1
        FROM protected_choice p
        WHERE p.shop_country_asin_date = pc.shop_country_asin_date
    )
    GROUP BY
        pc.shop_country_asin_date,
        pc.asin,
        pc.country,
        pc.shop,
        pc.`date`,
        pc.old_type,
        pc.old_coefficient
)
SELECT * FROM protected_rows
UNION ALL
SELECT * FROM ordinary_rows;

ALTER TABLE temp_history_detail_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_history_detail_recalc_date (asin, country, `date`);

-- 分店铺修正前汇总：missing_coefficient_rows 必须先确认。
SELECT
    COUNT(*) AS candidate_detail_rows,
    SUM(new_coefficient IS NOT NULL) AS executable_detail_rows,
    SUM(new_coefficient IS NULL) AS missing_coefficient_rows,
    SUM(
        new_coefficient IS NOT NULL
        AND (
            NOT (old_type <=> new_type)
            OR NOT (old_coefficient <=> new_coefficient)
        )
    ) AS will_update_detail_rows,
    MIN(`date`) AS min_date,
    MAX(`date`) AS max_date
FROM temp_history_detail_recalc;

-- 分店铺修正前明细：生产执行前应导出保存，作为逐主键回滚依据。
SELECT
    shop_country_asin_date,
    asin,
    country,
    shop,
    `date`,
    old_type,
    new_type,
    old_coefficient,
    new_coefficient,
    calc_mode
FROM temp_history_detail_recalc
WHERE new_coefficient IS NULL
   OR NOT (old_type <=> new_type)
   OR NOT (old_coefficient <=> new_coefficient)
ORDER BY `date`, country, asin, shop;

-- 3. 写回分店铺历史日类型与系数；旧值校验用于避免覆盖并发变化。
UPDATE daily_sales ds
INNER JOIN temp_history_detail_recalc r
    ON r.shop_country_asin_date = ds.shop_country_asin_date
SET
    ds.type = r.new_type,
    ds.coefficient = r.new_coefficient
WHERE ds.shop <> '合计'
  AND ds.`date` < CURDATE()
  AND r.new_coefficient IS NOT NULL
  AND (ds.type <=> r.old_type)
  AND (ds.coefficient <=> r.old_coefficient)
  AND (
      NOT (ds.type <=> r.new_type)
      OR NOT (ds.coefficient <=> r.new_coefficient)
  );

SET @corrected_detail_type_coeff_rows = ROW_COUNT();

-- 4. 按节点06最大系数口径，直接从同日分店铺行计算合计类型和系数。
CREATE TEMPORARY TABLE temp_history_summary_recalc AS
SELECT
    s.shop_country_asin_date,
    s.asin,
    s.country,
    s.shop,
    s.`date`,
    s.type AS old_type,
    s.coefficient AS old_coefficient,
    d.max_coeff_type AS new_type,
    ROUND(d.max_coefficient, 2) AS new_coefficient,
    'summary_from_daily_max' AS calc_mode
FROM daily_sales s
INNER JOIN (
    SELECT
        asin,
        country,
        `date`,
        type AS max_coeff_type,
        coefficient AS max_coefficient
    FROM (
        SELECT
            ds.asin,
            ds.country,
            ds.`date`,
            ds.type,
            ds.coefficient,
            ROW_NUMBER() OVER (
                PARTITION BY ds.asin, ds.country, ds.`date`
                ORDER BY ds.coefficient DESC, ds.type DESC
            ) AS coefficient_rank
        FROM daily_sales ds
        WHERE ds.shop <> '合计'
          AND ds.`date` < CURDATE()
    ) ranked_detail
    WHERE coefficient_rank = 1
) d
    ON d.asin = s.asin
   AND d.country = s.country
   AND d.`date` = s.`date`
WHERE s.shop = '合计'
  AND s.`date` < CURDATE();

ALTER TABLE temp_history_summary_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_history_summary_recalc_date (asin, country, `date`);

-- 合计行修正前汇总。
SELECT
    COUNT(*) AS candidate_summary_rows,
    SUM(new_coefficient IS NOT NULL) AS executable_summary_rows,
    SUM(new_coefficient IS NULL) AS missing_summary_coefficient_rows,
    SUM(
        new_coefficient IS NOT NULL
        AND (
            NOT (old_type <=> new_type)
            OR NOT (old_coefficient <=> new_coefficient)
        )
    ) AS will_update_summary_rows
FROM temp_history_summary_recalc;

-- 5. 写回合计历史日类型与系数。
UPDATE daily_sales ds
INNER JOIN temp_history_summary_recalc r
    ON r.shop_country_asin_date = ds.shop_country_asin_date
SET
    ds.type = r.new_type,
    ds.coefficient = r.new_coefficient
WHERE ds.shop = '合计'
  AND ds.`date` < CURDATE()
  AND r.new_coefficient IS NOT NULL
  AND (ds.type <=> r.old_type)
  AND (ds.coefficient <=> r.old_coefficient)
  AND (
      NOT (ds.type <=> r.new_type)
      OR NOT (ds.coefficient <=> r.new_coefficient)
  );

SET @corrected_summary_type_coeff_rows = ROW_COUNT();

-- 6. 准备加权基准销量的历史基准销量来源。
CREATE TEMPORARY TABLE temp_history_daily_base_source AS
SELECT
    'DETAIL' AS calc_scope,
    ds.asin,
    ds.country,
    ds.`date` AS history_date,
    SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0) AS daily_base_sales
FROM daily_sales ds
WHERE ds.shop <> '合计'
  AND ds.`date` < CURDATE()
GROUP BY ds.asin, ds.country, ds.`date`

UNION ALL

SELECT
    'SUMMARY' AS calc_scope,
    ds.asin,
    ds.country,
    ds.`date` AS history_date,
    SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0) AS daily_base_sales
FROM daily_sales ds
WHERE ds.shop <> '合计'
  AND ds.`date` < CURDATE()
GROUP BY ds.asin, ds.country, ds.`date`;

ALTER TABLE temp_history_daily_base_source
ADD INDEX idx_history_daily_base_source (
    calc_scope,
    asin,
    country,
    history_date
);

-- 7. 使用修正后的系数，重算全部可计算历史记录的基准销量。
CREATE TEMPORARY TABLE temp_history_base_sales_recalc AS
SELECT
    ds.shop_country_asin_date,
    ds.asin,
    ds.country,
    ds.shop,
    ds.`date`,
    ds.base_sales AS old_base_sales,
    CAST(
        ROUND(
            CASE
                WHEN ds.shop = '合计' THEN source.daily_base_sales
                ELSE GREATEST(source.daily_base_sales, 0)
            END,
            0
        ) AS SIGNED
    ) AS new_base_sales
FROM daily_sales ds
INNER JOIN temp_history_daily_base_source source
    ON source.calc_scope = CASE
        WHEN ds.shop = '合计' THEN 'SUMMARY'
        ELSE 'DETAIL'
    END
   AND source.asin = ds.asin
   AND source.country = ds.country
   AND source.history_date = ds.`date`
WHERE ds.`date` < CURDATE()
  AND source.daily_base_sales IS NOT NULL;

ALTER TABLE temp_history_base_sales_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_history_base_sales_recalc_date (asin, country, `date`);

-- 基准销量修正前汇总与逐主键明细，明细可用于回滚。
SELECT
    COUNT(*) AS recalculable_base_sales_rows,
    SUM(shop <> '合计') AS recalculable_detail_base_sales_rows,
    SUM(shop = '合计') AS recalculable_summary_base_sales_rows,
    SUM(NOT (old_base_sales <=> new_base_sales)) AS will_update_base_sales_rows
FROM temp_history_base_sales_recalc;

SELECT
    shop_country_asin_date,
    asin,
    country,
    shop,
    `date`,
    old_base_sales,
    new_base_sales
FROM temp_history_base_sales_recalc
WHERE NOT (old_base_sales <=> new_base_sales)
ORDER BY `date`, country, asin, shop;

UPDATE daily_sales ds
INNER JOIN temp_history_base_sales_recalc r
    ON r.shop_country_asin_date = ds.shop_country_asin_date
SET ds.base_sales = r.new_base_sales
WHERE ds.`date` < CURDATE()
  AND (ds.base_sales <=> r.old_base_sales)
  AND NOT (ds.base_sales <=> r.new_base_sales);

SET @corrected_base_sales_rows = ROW_COUNT();

-- 8. 以每条历史记录为目标日，按其前30天数据执行最新分段加权。
CREATE TEMPORARY TABLE temp_history_weighted_recalc AS
WITH history_ranked AS (
    SELECT
        target.shop_country_asin_date,
        target.asin,
        target.country,
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
    FROM daily_sales target
    INNER JOIN temp_history_daily_base_source source
        ON source.calc_scope = CASE
            WHEN target.shop = '合计' THEN 'SUMMARY'
            ELSE 'DETAIL'
        END
       AND source.asin = target.asin
       AND source.country = target.country
       AND source.history_date BETWEEN DATE_SUB(target.`date`, INTERVAL 30 DAY)
                                  AND DATE_SUB(target.`date`, INTERVAL 1 DAY)
    WHERE target.`date` < CURDATE()
      AND source.daily_base_sales IS NOT NULL
),
weighted AS (
    SELECT
        shop_country_asin_date,
        asin,
        country,
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
                        CASE
                            WHEN row_num <= 7 THEN daily_base_sales
                        END
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
        asin,
        country,
        shop,
        target_date,
        old_weighted_sales,
        total_count
)
SELECT * FROM weighted;

ALTER TABLE temp_history_weighted_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_history_weighted_recalc_date (asin, country, target_date);

-- 加权基准销量修正前汇总与明细。
SELECT
    COUNT(*) AS recalculable_history_rows,
    SUM(new_weighted_sales IS NOT NULL) AS executable_weighted_rows,
    SUM(
        new_weighted_sales IS NOT NULL
        AND NOT (old_weighted_sales <=> new_weighted_sales)
    ) AS will_update_weighted_rows,
    MIN(target_date) AS min_target_date,
    MAX(target_date) AS max_target_date
FROM temp_history_weighted_recalc;

SELECT
    shop_country_asin_date,
    asin,
    country,
    shop,
    target_date,
    old_weighted_sales,
    new_weighted_sales,
    ROUND(new_weighted_sales - old_weighted_sales, 1) AS difference
FROM temp_history_weighted_recalc
WHERE new_weighted_sales IS NOT NULL
  AND NOT (old_weighted_sales <=> new_weighted_sales)
ORDER BY target_date, country, asin, shop;

-- 9. 写回全部历史记录的加权基准销量。
UPDATE daily_sales ds
INNER JOIN temp_history_weighted_recalc r
    ON r.shop_country_asin_date = ds.shop_country_asin_date
SET ds.weighted_sales = r.new_weighted_sales
WHERE ds.`date` < CURDATE()
  AND r.new_weighted_sales IS NOT NULL
  AND (ds.weighted_sales <=> r.old_weighted_sales)
  AND NOT (ds.weighted_sales <=> r.new_weighted_sales);

SET @corrected_weighted_sales_rows = ROW_COUNT();

-- 10. 用修正后的系数和加权基准销量，重算全部历史预估销量。
CREATE TEMPORARY TABLE temp_history_maybe_recalc AS
SELECT
    ds.shop_country_asin_date,
    ds.asin,
    ds.country,
    ds.shop,
    ds.`date`,
    ds.maybe_sales AS old_maybe_sales,
    CASE
        WHEN ds.weighted_sales IS NULL OR ds.coefficient IS NULL THEN NULL
        ELSE CAST(ROUND(ds.weighted_sales * ds.coefficient, 0) AS SIGNED)
    END AS new_maybe_sales
FROM daily_sales ds
WHERE ds.`date` < CURDATE();

ALTER TABLE temp_history_maybe_recalc
ADD PRIMARY KEY (shop_country_asin_date),
ADD INDEX idx_history_maybe_recalc_date (asin, country, `date`);

SELECT
    COUNT(*) AS candidate_maybe_rows,
    SUM(new_maybe_sales IS NOT NULL) AS executable_maybe_rows,
    SUM(new_maybe_sales IS NULL) AS skipped_null_maybe_rows,
    SUM(
        new_maybe_sales IS NOT NULL
        AND NOT (old_maybe_sales <=> new_maybe_sales)
    ) AS will_update_maybe_rows
FROM temp_history_maybe_recalc;

UPDATE daily_sales ds
INNER JOIN temp_history_maybe_recalc r
    ON r.shop_country_asin_date = ds.shop_country_asin_date
SET ds.maybe_sales = r.new_maybe_sales
WHERE ds.`date` < CURDATE()
  AND r.new_maybe_sales IS NOT NULL
  AND (ds.maybe_sales <=> r.old_maybe_sales)
  AND NOT (ds.maybe_sales <=> r.new_maybe_sales);

SET @corrected_maybe_sales_rows = ROW_COUNT();

-- 11. 执行结果与残留检查。
SELECT
    @corrected_detail_type_coeff_rows AS corrected_detail_type_coeff_rows,
    @corrected_summary_type_coeff_rows AS corrected_summary_type_coeff_rows,
    @corrected_base_sales_rows AS corrected_base_sales_rows,
    @corrected_weighted_sales_rows AS corrected_weighted_sales_rows,
    @corrected_maybe_sales_rows AS corrected_maybe_sales_rows,
    (
        SELECT COUNT(*)
        FROM temp_history_detail_recalc
        WHERE new_coefficient IS NULL
    ) AS skipped_detail_missing_coefficient_rows,
    (
        SELECT COUNT(*)
        FROM temp_history_summary_recalc
        WHERE new_coefficient IS NULL
    ) AS skipped_summary_missing_coefficient_rows,
    (
        SELECT COUNT(*)
        FROM daily_sales ds
        LEFT JOIN temp_history_weighted_recalc r
            ON r.shop_country_asin_date = ds.shop_country_asin_date
        WHERE ds.`date` < CURDATE()
          AND r.shop_country_asin_date IS NULL
    ) AS skipped_no_history_weighted_rows,
    (
        SELECT COUNT(*)
        FROM temp_history_maybe_recalc
        WHERE new_maybe_sales IS NULL
    ) AS skipped_null_maybe_rows,
    (
        SELECT COUNT(*)
        FROM temp_history_base_sales_recalc r
        INNER JOIN daily_sales ds
            ON ds.shop_country_asin_date = r.shop_country_asin_date
        WHERE NOT (ds.base_sales <=> r.new_base_sales)
    ) AS remaining_base_sales_rows,
    (
        SELECT COUNT(*)
        FROM daily_sales ds
        WHERE ds.`date` < CURDATE()
          AND ds.type = 'BD（预测）'
    ) AS remaining_history_bd_prediction_rows;

-- 分店铺日类型/系数残留。
SELECT
    r.shop_country_asin_date,
    r.old_type,
    r.new_type,
    r.old_coefficient,
    r.new_coefficient,
    ds.type AS current_type,
    ds.coefficient AS current_coefficient
FROM temp_history_detail_recalc r
INNER JOIN daily_sales ds
    ON ds.shop_country_asin_date = r.shop_country_asin_date
WHERE r.new_coefficient IS NOT NULL
  AND (
      NOT (ds.type <=> r.new_type)
      OR NOT (ds.coefficient <=> r.new_coefficient)
  )
ORDER BY r.`date`, r.country, r.asin, r.shop;

-- 合计日类型/系数残留。
SELECT
    r.shop_country_asin_date,
    r.old_type,
    r.new_type,
    r.old_coefficient,
    r.new_coefficient,
    ds.type AS current_type,
    ds.coefficient AS current_coefficient
FROM temp_history_summary_recalc r
INNER JOIN daily_sales ds
    ON ds.shop_country_asin_date = r.shop_country_asin_date
WHERE r.new_coefficient IS NOT NULL
  AND (
      NOT (ds.type <=> r.new_type)
      OR NOT (ds.coefficient <=> r.new_coefficient)
  )
ORDER BY r.`date`, r.country, r.asin, r.shop;

-- 加权基准销量残留。
SELECT
    r.shop_country_asin_date,
    r.old_weighted_sales,
    r.new_weighted_sales,
    ds.weighted_sales AS current_weighted_sales
FROM temp_history_weighted_recalc r
INNER JOIN daily_sales ds
    ON ds.shop_country_asin_date = r.shop_country_asin_date
WHERE r.new_weighted_sales IS NOT NULL
  AND NOT (ds.weighted_sales <=> r.new_weighted_sales)
ORDER BY r.target_date, r.country, r.asin, r.shop;

-- 基准销量残留。
SELECT
    r.shop_country_asin_date,
    r.old_base_sales,
    r.new_base_sales,
    ds.base_sales AS current_base_sales
FROM temp_history_base_sales_recalc r
INNER JOIN daily_sales ds
    ON ds.shop_country_asin_date = r.shop_country_asin_date
WHERE NOT (ds.base_sales <=> r.new_base_sales)
ORDER BY r.`date`, r.country, r.asin, r.shop;

-- 预估销量残留。
SELECT
    r.shop_country_asin_date,
    r.old_maybe_sales,
    r.new_maybe_sales,
    ds.maybe_sales AS current_maybe_sales
FROM temp_history_maybe_recalc r
INNER JOIN daily_sales ds
    ON ds.shop_country_asin_date = r.shop_country_asin_date
WHERE r.new_maybe_sales IS NOT NULL
  AND NOT (ds.maybe_sales <=> r.new_maybe_sales)
ORDER BY r.`date`, r.country, r.asin, r.shop;

DROP TEMPORARY TABLE IF EXISTS temp_history_maybe_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_weighted_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_base_sales_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_daily_base_source;
DROP TEMPORARY TABLE IF EXISTS temp_history_summary_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_detail_recalc;
DROP TEMPORARY TABLE IF EXISTS temp_history_protected_types;
