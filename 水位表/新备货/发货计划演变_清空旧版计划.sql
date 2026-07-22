-- 发货计划演变：清空旧版 shipment_plan_v2 数据
-- 数据库：MySQL
-- 使用顺序：先执行本文件，再执行区域合计版生成 SQL。
-- 影响范围：仅 simulate_shipment.plan_source = 'shipment_plan_v2'。
-- 注意：COMMIT 后无法直接恢复，只能重新运行生成 SQL。

-- 1. 删除前核对范围。
SELECT
    COUNT(*) AS rows_to_delete,
    COUNT(DISTINCT country, asin) AS country_asin_count,
    COUNT(DISTINCT country, asin, shop) AS country_asin_shop_count,
    COALESCE(SUM(number), 0) AS quantity_to_delete,
    SUM(CASE WHEN shop = '合计' THEN 1 ELSE 0 END) AS total_shop_rows,
    SUM(CASE WHEN shop <> '合计' OR shop IS NULL THEN 1 ELSE 0 END) AS branch_shop_rows
FROM simulate_shipment
WHERE plan_source = 'shipment_plan_v2';

-- 2. 精准删除旧算法数据，不触碰手填计划和其他来源。
START TRANSACTION;

DELETE FROM simulate_shipment
WHERE plan_source = 'shipment_plan_v2';

SET @deleted_shipment_plan_v2_rows = ROW_COUNT();

SELECT @deleted_shipment_plan_v2_rows AS deleted_rows;

COMMIT;

-- 3. 删除后必须为 0。
SELECT COUNT(*) AS remaining_rows
FROM simulate_shipment
WHERE plan_source = 'shipment_plan_v2';
