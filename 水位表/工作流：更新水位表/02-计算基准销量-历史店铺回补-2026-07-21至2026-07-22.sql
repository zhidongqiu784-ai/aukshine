-- 工作流：更新水位表
-- 用途：一次性回补 2026-07-21 至 2026-07-22 的店铺基准销量
-- 生产只读基线（2026-07-23 核对）：
--   1. 2026-07-21 有 18 个 ASIN/国家组合存在实际销量，共 95 条店铺记录待回补；
--   2. 2026-07-22 有 20 个 ASIN/国家组合存在实际销量，共 107 条店铺记录待回补；
--   3. 上述 202 条店铺记录的 base_sales 均为 NULL；
--   4. 两天对应的 38 条“合计”记录均已恢复且与汇总值一致。
-- 本脚本只修改店铺行的 base_sales，不修改“合计”、sales、库存、系数或其他日期。

SET @backfill_start_date = DATE('2026-07-21');
SET @backfill_end_date = DATE('2026-07-22');
SET @expected_groups_20260721 = 18;
SET @expected_groups_20260722 = 20;
SET @expected_rows_20260721 = 95;
SET @expected_rows_20260722 = 107;
SET @expected_total_rows = 202;
SET @expected_guard_rows = 4;

DROP TEMPORARY TABLE IF EXISTS temp_store_base_sales_backfill_source;
DROP TEMPORARY TABLE IF EXISTS temp_store_base_sales_backfill_target;
DROP TEMPORARY TABLE IF EXISTS temp_store_base_sales_backfill_guard;

-- 完全复用现有节点 2 的口径：同一日期、ASIN、国家下，
-- 所有店铺的 SUM(sales) / MAX(coefficient) 作为每条店铺记录的基准销量。
CREATE TEMPORARY TABLE temp_store_base_sales_backfill_source AS
SELECT
    ds.asin,
    ds.country,
    ds.`date`,
    MAX(ds.coefficient) AS max_coefficient,
    GREATEST(
        SUM(ds.sales) / NULLIF(MAX(ds.coefficient), 0),
        0
    ) AS calculated_base_sales
FROM daily_sales AS ds
WHERE ds.shop <> '合计'
  AND ds.`date` BETWEEN @backfill_start_date AND @backfill_end_date
GROUP BY ds.asin, ds.country, ds.`date`
HAVING COUNT(ds.sales) > 0;

ALTER TABLE temp_store_base_sales_backfill_source
    ADD UNIQUE INDEX idx_store_base_sales_backfill_source (asin, country, `date`);

-- 固化本次允许更新的精确记录；只纳入当前 base_sales 仍为空的店铺行。
CREATE TEMPORARY TABLE temp_store_base_sales_backfill_target AS
SELECT
    ds.shop_country_asin_date,
    ds.asin,
    ds.country,
    ds.shop,
    ds.`date`,
    source.calculated_base_sales
FROM daily_sales AS ds
INNER JOIN temp_store_base_sales_backfill_source AS source
    ON source.asin = ds.asin
   AND source.country = ds.country
   AND source.`date` = ds.`date`
WHERE ds.shop <> '合计'
  AND ds.base_sales IS NULL
  AND ds.`date` BETWEEN @backfill_start_date AND @backfill_end_date;

ALTER TABLE temp_store_base_sales_backfill_target
    ADD UNIQUE INDEX idx_store_base_sales_backfill_target (shop_country_asin_date);

-- 任一生产基线不满足时立即失败，避免覆盖已被其他人修正的数据。
CREATE TEMPORARY TABLE temp_store_base_sales_backfill_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

INSERT INTO temp_store_base_sales_backfill_guard (guard_value)
SELECT IF(
    SUM(`date` = DATE('2026-07-21')) = @expected_groups_20260721
    AND SUM(`date` = DATE('2026-07-22')) = @expected_groups_20260722,
    1,
    0
)
FROM temp_store_base_sales_backfill_source;

INSERT INTO temp_store_base_sales_backfill_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_store_base_sales_backfill_source
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR `date` IS NULL
   OR max_coefficient IS NULL
   OR max_coefficient = 0
   OR calculated_base_sales IS NULL;

INSERT INTO temp_store_base_sales_backfill_guard (guard_value)
SELECT IF(
    SUM(`date` = DATE('2026-07-21')) = @expected_rows_20260721
    AND SUM(`date` = DATE('2026-07-22')) = @expected_rows_20260722
    AND COUNT(*) = @expected_total_rows,
    1,
    0
)
FROM temp_store_base_sales_backfill_target;

-- 活跃组合下的全部店铺行都必须仍为空，不能只更新其中一部分。
INSERT INTO temp_store_base_sales_backfill_guard (guard_value)
SELECT IF(
    COUNT(*) = @expected_total_rows
    AND SUM(ds.base_sales IS NULL) = @expected_total_rows,
    1,
    0
)
FROM daily_sales AS ds
INNER JOIN temp_store_base_sales_backfill_source AS source
    ON source.asin = ds.asin
   AND source.country = ds.country
   AND source.`date` = ds.`date`
WHERE ds.shop <> '合计';

SELECT COUNT(*)
INTO @target_rows
FROM temp_store_base_sales_backfill_target;

START TRANSACTION;

UPDATE daily_sales AS ds
INNER JOIN temp_store_base_sales_backfill_target AS target
    ON target.shop_country_asin_date = ds.shop_country_asin_date
CROSS JOIN (
    SELECT COUNT(*) AS passed_guards
    FROM temp_store_base_sales_backfill_guard
) AS guard
SET ds.base_sales = target.calculated_base_sales
WHERE ds.shop <> '合计'
  AND ds.base_sales IS NULL
  AND ds.`date` BETWEEN @backfill_start_date AND @backfill_end_date
  AND guard.passed_guards = @expected_guard_rows;

SELECT
    COUNT(*),
    SUM(ds.base_sales <=> ROUND(target.calculated_base_sales, 0)),
    SUM(ds.base_sales IS NULL)
INTO
    @checked_rows,
    @matched_rows,
    @null_rows
FROM temp_store_base_sales_backfill_target AS target
INNER JOIN daily_sales AS ds
    ON ds.shop_country_asin_date = target.shop_country_asin_date;

SET @backfill_status = IF(
    @target_rows = @expected_total_rows
    AND @checked_rows = @expected_total_rows
    AND @matched_rows = @expected_total_rows
    AND @null_rows = 0,
    'OK',
    'CHECK_FAILED'
);

-- 只有更新前目标数量和更新后逐行对账均为 202 时才提交，否则自动回滚本次 UPDATE。
SET @transaction_action = IF(@backfill_status = 'OK', 'COMMIT', 'ROLLBACK');
PREPARE finish_backfill_transaction FROM @transaction_action;
EXECUTE finish_backfill_transaction;
DEALLOCATE PREPARE finish_backfill_transaction;

DROP TEMPORARY TABLE IF EXISTS temp_store_base_sales_backfill_guard;
DROP TEMPORARY TABLE IF EXISTS temp_store_base_sales_backfill_target;
DROP TEMPORARY TABLE IF EXISTS temp_store_base_sales_backfill_source;

-- 成功执行时应返回 target_rows=202、checked_rows=202、matched_rows=202、null_rows=0、backfill_status=OK。
SELECT
    @backfill_start_date AS backfill_start_date,
    @backfill_end_date AS backfill_end_date,
    @target_rows AS target_rows,
    @checked_rows AS checked_rows,
    @matched_rows AS matched_rows,
    @null_rows AS null_rows,
    @transaction_action AS transaction_action,
    @backfill_status AS backfill_status;
