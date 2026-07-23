-- 工作流：更新水位表
-- 用途：一次性回补 2026-07-21 的“合计”销量和基准销量
-- 生产只读基线（2026-07-23 核对）：
--   1. 分店共有 18 个 ASIN/国家组合存在实际销量；
--   2. 对应 18 条“合计”记录均已存在；
--   3. 对应“合计”记录的 sales、base_sales 均为 NULL；
--   4. 2026-07-22 已正确，无需回补。
-- 本脚本不修改库存、预估库存、系数、加权销量、补货、在途或未来数据。

SET @backfill_date = DATE('2026-07-21');
SET @expected_groups = 18;

DROP TEMPORARY TABLE IF EXISTS temp_summary_sales_backfill_source;
DROP TEMPORARY TABLE IF EXISTS temp_summary_sales_backfill_guard;

-- 按生产节点 6 的口径，从分店行重新计算合计销量和基准销量。
CREATE TEMPORARY TABLE temp_summary_sales_backfill_source AS
SELECT
    ds.asin,
    ds.country,
    ds.`date`,
    CAST(SUM(ds.sales) AS SIGNED) AS total_sales,
    MAX(ds.coefficient) AS max_coefficient,
    SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0) AS calculated_base_sales
FROM daily_sales AS ds
WHERE ds.`date` = @backfill_date
  AND ds.shop <> '合计'
GROUP BY ds.asin, ds.country, ds.`date`
HAVING COUNT(ds.sales) > 0;

ALTER TABLE temp_summary_sales_backfill_source
    ADD UNIQUE INDEX idx_summary_sales_backfill_source (asin, country, `date`);

-- 任一基线条件不满足时立即失败，避免扩大写入范围。
CREATE TEMPORARY TABLE temp_summary_sales_backfill_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

INSERT INTO temp_summary_sales_backfill_guard (guard_value)
SELECT IF(COUNT(*) = @expected_groups, 1, 0)
FROM temp_summary_sales_backfill_source;

INSERT INTO temp_summary_sales_backfill_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_summary_sales_backfill_source
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR `date` IS NULL
   OR max_coefficient IS NULL
   OR max_coefficient = 0;

-- 每个来源组合必须精确对应一条已存在的“合计”记录。
INSERT INTO temp_summary_sales_backfill_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT
        source.asin,
        source.country,
        source.`date`,
        COUNT(summary.shop_country_asin_date) AS summary_rows
    FROM temp_summary_sales_backfill_source AS source
    LEFT JOIN daily_sales AS summary
        ON summary.asin = source.asin
       AND summary.country = source.country
       AND summary.`date` = source.`date`
       AND summary.shop = '合计'
    GROUP BY source.asin, source.country, source.`date`
    HAVING COUNT(summary.shop_country_asin_date) <> 1
) AS invalid_summary_mapping;

-- 当前18条目标记录必须仍保持未回补状态，防止覆盖后续人工修正。
INSERT INTO temp_summary_sales_backfill_guard (guard_value)
SELECT IF(COUNT(*) = @expected_groups, 1, 0)
FROM temp_summary_sales_backfill_source AS source
INNER JOIN daily_sales AS summary
    ON summary.asin = source.asin
   AND summary.country = source.country
   AND summary.`date` = source.`date`
   AND summary.shop = '合计'
WHERE summary.sales IS NULL
  AND summary.base_sales IS NULL;

UPDATE daily_sales AS summary
INNER JOIN temp_summary_sales_backfill_source AS source
    ON source.asin = summary.asin
   AND source.country = summary.country
   AND source.`date` = summary.`date`
SET
    summary.sales = source.total_sales,
    summary.base_sales = source.calculated_base_sales
WHERE summary.shop = '合计'
  AND summary.`date` = @backfill_date
  AND summary.sales IS NULL
  AND summary.base_sales IS NULL;

SET @changed_rows = ROW_COUNT();

-- 保存校验结果；base_sales 在当前字段口径下按整数读取。
SELECT
    COUNT(*),
    SUM(summary.sales <=> source.total_sales),
    SUM(summary.base_sales <=> ROUND(source.calculated_base_sales, 0))
INTO
    @checked_groups,
    @sales_matched_groups,
    @base_sales_matched_groups
FROM temp_summary_sales_backfill_source AS source
INNER JOIN daily_sales AS summary
    ON summary.asin = source.asin
   AND summary.country = source.country
   AND summary.`date` = source.`date`
   AND summary.shop = '合计';

DROP TEMPORARY TABLE IF EXISTS temp_summary_sales_backfill_guard;
DROP TEMPORARY TABLE IF EXISTS temp_summary_sales_backfill_source;

-- NocoBase SQL 节点返回最后一组结果，以本行作为执行回执。
SELECT
    @backfill_date AS backfill_date,
    @expected_groups AS expected_groups,
    @changed_rows AS changed_rows,
    @checked_groups AS checked_groups,
    @sales_matched_groups AS sales_matched_groups,
    @base_sales_matched_groups AS base_sales_matched_groups,
    IF(
        @changed_rows = @expected_groups
        AND @checked_groups = @expected_groups
        AND @sales_matched_groups = @expected_groups
        AND @base_sales_matched_groups = @expected_groups,
        'OK',
        'CHECK_FAILED'
    ) AS backfill_status;
