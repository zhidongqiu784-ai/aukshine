-- 发货计划 V21 历史基线快照写入节点
-- 用途：放在「每周生成模拟计划」工作流的生成/更新 simulate_shipment 节点之后。
-- 数据库：MySQL 8.x
-- 口径：
--   1. 当前 run_monday = 本周周一。
--   2. 固化本轮 W1-W7，也就是 run_monday + 7 天 到 run_monday + 55 天内的发货周。
--   3. 上周建议/上周人工确认由前端按同一 ship_week_start 对齐读取，不按 W 序号硬对齐。
--   4. 本节点只写入 shipment_plan_weekly_snapshot_v2，不修改 simulate_shipment / daily_sales。

START TRANSACTION;

SET @snapshot_run_monday = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);
SET @snapshot_at = NOW(3);

DELETE FROM shipment_plan_weekly_snapshot_v2
WHERE run_monday = @snapshot_run_monday;

INSERT INTO shipment_plan_weekly_snapshot_v2 (
    run_monday_asin_country_shop_ship_week_start,
    run_monday,
    snapshot_at,
    asin,
    country,
    shop,
    model,
    sale_owner,
    ship_date,
    ship_week_start,
    display_week_code,
    system_suggest_qty,
    approved_qty,
    approved_date,
    approved_channel,
    source_plan_id,
    formula_version,
    calculation_snapshot,
    change_id,
    change_status,
    snapshot_payload
)
WITH applied_latest AS (
    SELECT *
    FROM (
        SELECT
            ch.*,
            ROW_NUMBER() OVER (
                PARTITION BY ch.plan_id
                ORDER BY COALESCE(ch.applied_at, ch.updated_at, ch.created_at) DESC, ch.id DESC
            ) AS rn
        FROM shipment_plan_change_v2 AS ch
        WHERE ch.status = 'APPLIED'
    ) AS ranked
    WHERE ranked.rn = 1
),
base_plan AS (
    SELECT
        sim.id AS source_plan_id,
        sim.asin,
        sim.country,
        sim.shop,
        sim.channel,
        sim.number,
        sim.`date` AS ship_date,
        DATE_SUB(sim.`date`, INTERVAL WEEKDAY(sim.`date`) DAY) AS ship_week_start,
        sim.v2_calculation_snapshot,
        JSON_UNQUOTE(JSON_EXTRACT(sim.v2_calculation_snapshot, '$.formula_version')) AS formula_version
    FROM simulate_shipment AS sim
    WHERE sim.plan_source = 'shipment_plan_v2'
      AND sim.shop = '合计'
      AND sim.`date` >= DATE_ADD(@snapshot_run_monday, INTERVAL 7 DAY)
      AND sim.`date` < DATE_ADD(@snapshot_run_monday, INTERVAL 56 DAY)
),
enriched AS (
    SELECT
        bp.*,
        ds.model AS daily_model,
        a.sale_owner,
        al.id AS applied_change_id,
        al.status AS applied_status,
        al.proposed_number,
        al.proposed_date,
        al.proposed_channel
    FROM base_plan AS bp
    LEFT JOIN daily_sales AS ds
        ON ds.asin = bp.asin
       AND ds.country = bp.country
       AND ds.shop = '合计'
       AND DATE(ds.`date`) = CURDATE()
    LEFT JOIN asin AS a
        ON a.`unique` = CONCAT(bp.asin, '_', bp.country)
    LEFT JOIN applied_latest AS al
        ON al.plan_id = bp.source_plan_id
)
SELECT
    CONCAT(
        DATE_FORMAT(@snapshot_run_monday, '%Y-%m-%d'), '_',
        e.asin, '_', e.country, '_', e.shop, '_',
        DATE_FORMAT(e.ship_week_start, '%Y-%m-%d')
    ) AS run_monday_asin_country_shop_ship_week_start,
    @snapshot_run_monday AS run_monday,
    @snapshot_at AS snapshot_at,
    e.asin,
    e.country,
    e.shop,
    MAX(NULLIF(TRIM(e.daily_model), '')) AS model,
    MAX(e.sale_owner) AS sale_owner,
    MIN(e.ship_date) AS ship_date,
    e.ship_week_start,
    CONCAT('W', 1 + TIMESTAMPDIFF(WEEK, DATE_ADD(@snapshot_run_monday, INTERVAL 7 DAY), e.ship_week_start)) AS display_week_code,
    CAST(SUM(COALESCE(e.number, 0)) AS SIGNED) AS system_suggest_qty,
    CASE
        WHEN SUM(CASE WHEN e.applied_change_id IS NOT NULL THEN 1 ELSE 0 END) > 0
        THEN CAST(SUM(COALESCE(e.proposed_number, e.number, 0)) AS SIGNED)
        ELSE NULL
    END AS approved_qty,
    CASE
        WHEN SUM(CASE WHEN e.applied_change_id IS NOT NULL THEN 1 ELSE 0 END) > 0
        THEN MIN(COALESCE(e.proposed_date, e.ship_date))
        ELSE NULL
    END AS approved_date,
    CASE
        WHEN SUM(CASE WHEN e.applied_change_id IS NOT NULL THEN 1 ELSE 0 END) > 0
        THEN GROUP_CONCAT(DISTINCT COALESCE(NULLIF(TRIM(e.proposed_channel), ''), e.channel) ORDER BY COALESCE(NULLIF(TRIM(e.proposed_channel), ''), e.channel) SEPARATOR '、')
        ELSE NULL
    END AS approved_channel,
    MIN(e.source_plan_id) AS source_plan_id,
    MAX(e.formula_version) AS formula_version,
    JSON_ARRAYAGG(e.v2_calculation_snapshot) AS calculation_snapshot,
    MIN(e.applied_change_id) AS change_id,
    CASE
        WHEN SUM(CASE WHEN e.applied_change_id IS NOT NULL THEN 1 ELSE 0 END) > 0 THEN 'APPLIED'
        ELSE NULL
    END AS change_status,
    JSON_OBJECT(
        'plan_ids', JSON_ARRAYAGG(e.source_plan_id),
        'run_monday', DATE_FORMAT(@snapshot_run_monday, '%Y-%m-%d'),
        'snapshot_at', DATE_FORMAT(@snapshot_at, '%Y-%m-%d %H:%i:%s.%f'),
        'ship_week_start', DATE_FORMAT(e.ship_week_start, '%Y-%m-%d'),
        'has_applied_change', SUM(CASE WHEN e.applied_change_id IS NOT NULL THEN 1 ELSE 0 END) > 0
    ) AS snapshot_payload
FROM enriched AS e
GROUP BY e.asin, e.country, e.shop, e.ship_week_start;

SET @snapshot_inserted_rows = ROW_COUNT();

COMMIT;

SELECT
    'OK' AS snapshot_status,
    @snapshot_run_monday AS run_monday,
    @snapshot_at AS snapshot_at,
    @snapshot_inserted_rows AS inserted_snapshot_rows;
