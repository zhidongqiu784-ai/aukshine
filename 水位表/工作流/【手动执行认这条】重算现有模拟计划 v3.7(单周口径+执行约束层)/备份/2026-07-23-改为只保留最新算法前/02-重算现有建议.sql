-- 工作流：发货计划演变-v2-重算现有建议
-- 节点 01：原地重算现有 W1-W7 建议数量。
-- 数据库：MySQL 8.x
--
-- 计算口径：
-- 1. 只处理未来、区域合计层、plan_source=shipment_plan_v2 的现有计划。
-- 2. 任一周已关联真实发货或存在活动申请时，整组 ASIN/站点不参与重算。
-- 3. 先排除现有 v2 模拟计划，按“昨日库存 - 今日需求 + 今日真实补货”重建基线。
-- 4. 负库存持续结转，缺货期间未满足的需求不会在补货日清零。
-- 5. W1-W7 按发货日期顺序逐周计算：
--    建议量 = MAX(0, 2 × 覆盖周需求 - (无模拟计划基线库存 + 前序新建议累计))。

SET SESSION cte_max_recursion_depth = 1000;
SET @v2_recalculated_at = NOW(3);

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_stage;

CREATE TEMPORARY TABLE temp_v2_recalculation_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

CREATE TEMPORARY TABLE temp_v2_recalculation_stage AS
WITH RECURSIVE
plan_raw AS (
    SELECT
        sim.id,
        sim.asin,
        sim.country,
        sim.shop,
        sim.number AS old_number,
        sim.`date` AS ship_date,
        sim.add_date,
        sim.channel,
        sim.season,
        sim.warehouse_days,
        CASE
            WHEN sim.shippment_id IS NOT NULL AND TRIM(sim.shippment_id) <> '' THEN 1
            WHEN EXISTS (
                SELECT 1
                FROM shipment_plan_change_v2 AS ch
                WHERE ch.plan_id = sim.id
                  AND ch.status IN (
                      'PENDING_SUPERVISOR',
                      'PENDING_PROCUREMENT',
                      'PENDING_FINAL',
                      'APPLY_PENDING',
                      'APPLYING',
                      'APPLIED'
                  )
            ) THEN 1
            ELSE 0
        END AS is_protected
    FROM simulate_shipment AS sim
    WHERE sim.plan_source = 'shipment_plan_v2'
      AND sim.shop = '合计'
      AND sim.`date` >= CURDATE()
),
plan_key_guard AS (
    SELECT
        asin,
        country,
        shop,
        COUNT(*) AS plan_count,
        SUM(is_protected) AS protected_count,
        SUM(`ship_date` IS NULL OR add_date IS NULL) AS incomplete_date_count,
        COUNT(DISTINCT ship_date) AS distinct_ship_date_count
    FROM plan_raw
    GROUP BY asin, country, shop
),
ranked_plan AS (
    SELECT
        raw.*,
        ROW_NUMBER() OVER (
            PARTITION BY raw.asin, raw.country, raw.shop
            ORDER BY raw.ship_date, raw.id
        ) AS week_no
    FROM plan_raw AS raw
    INNER JOIN plan_key_guard AS guard_row
        ON guard_row.asin = raw.asin
       AND guard_row.country = raw.country
       AND guard_row.shop = raw.shop
    WHERE guard_row.plan_count = 7
      AND guard_row.protected_count = 0
      AND guard_row.incomplete_date_count = 0
      AND guard_row.distinct_ship_date_count = 7
),
real_shipment_detail AS (
    SELECT
        dn.country,
        dn.asin,
        DATE(
            COALESCE(
                NULLIF(TRIM(dn.estimated_arrival_date), ''),
                DATE_ADD(
                    DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                    INTERVAL IFNULL(ttw.days, 0) DAY
                )
            )
        ) AS expected_storage_time,
        dn.shipment_id,
        SUM(dn.quantity_shipped) AS qty_shipped,
        SUM(COALESCE(fs.received, 0)) AS received
    FROM delivery_note AS dn
    LEFT JOIN channel_lead_time AS clt
        ON TRIM(UPPER(dn.logistics_provider_name)) = TRIM(UPPER(clt.logistics_provider))
       AND TRIM(UPPER(dn.logistics_channel_name)) = TRIM(UPPER(clt.channel))
    LEFT JOIN time_to_warehouse AS ttw
        ON TRIM(UPPER(dn.country)) = TRIM(UPPER(ttw.country))
       AND (
            CASE
                WHEN DATE_FORMAT(
                    DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                    '%m-%d'
                ) BETWEEN '06-10' AND '07-10'
                  OR DATE_FORMAT(
                    DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                    '%m-%d'
                ) BETWEEN '09-10' AND '10-10'
                  OR DATE_FORMAT(
                    DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                    '%m-%d'
                ) BETWEEN '11-01' AND '12-15'
                THEN '旺季'
                ELSE '淡季'
            END
       ) = ttw.season
    LEFT JOIN (
        SELECT shippment_id, msku, `apply`, SUM(received) AS received
        FROM fba_ship
        GROUP BY shippment_id, msku, `apply`
    ) AS fs
        ON fs.shippment_id = dn.shipment_id
       AND fs.msku = dn.msku
       AND fs.`apply` = dn.quantity_shipped
    WHERE (
            TRIM(dn.status) = '已发货'
            OR (
                TRIM(dn.status) = '待配货'
                AND COALESCE(fs.received, 0) > 0
            )
        )
      AND (TRIM(dn.state) <> '已索赔' OR dn.state IS NULL)
    GROUP BY
        dn.country,
        dn.asin,
        DATE(
            COALESCE(
                NULLIF(TRIM(dn.estimated_arrival_date), ''),
                DATE_ADD(
                    DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                    INTERVAL IFNULL(ttw.days, 0) DAY
                )
            )
        ),
        dn.shipment_id
),
real_supply AS (
    SELECT
        detail.asin,
        detail.country,
        detail.expected_storage_time,
        CAST(SUM(detail.qty_shipped - detail.received) AS SIGNED) AS remaining
    FROM real_shipment_detail AS detail
    WHERE detail.expected_storage_time >= CURDATE()
      AND (detail.qty_shipped - detail.received) <> 0
    GROUP BY detail.asin, detail.country, detail.expected_storage_time
),
plan_metric AS (
    SELECT
        plan.*,
        DATE_ADD(plan.add_date, INTERVAL 7 DAY) AS service_start_date,
        DATE_ADD(plan.add_date, INTERVAL 13 DAY) AS service_end_date,
        (
            SELECT MAX(
                CASE
                    WHEN DATE(ds.`date`) = CURDATE()
                    THEN CAST(COALESCE(ds.inventory, 0) AS SIGNED)
                         - CAST(COALESCE(ds.`add`, 0) AS SIGNED)
                END
            )
            FROM daily_sales AS ds
            WHERE ds.asin = plan.asin
              AND ds.country = plan.country
              AND ds.shop = plan.shop
              AND DATE(ds.`date`) = CURDATE()
        )
        + COALESCE((
            SELECT SUM(supply.remaining)
            FROM real_supply AS supply
            WHERE supply.asin = plan.asin
              AND supply.country = plan.country
              AND supply.expected_storage_time BETWEEN CURDATE()
                  AND DATE_ADD(plan.add_date, INTERVAL 7 DAY)
        ), 0)
        - COALESCE((
            SELECT SUM(COALESCE(ds.maybe_sales, ds.weighted_sales, 0))
            FROM daily_sales AS ds
            WHERE ds.asin = plan.asin
              AND ds.country = plan.country
              AND ds.shop = plan.shop
              AND DATE(ds.`date`) >= CURDATE()
              AND DATE(ds.`date`) < DATE_ADD(plan.add_date, INTERVAL 7 DAY)
        ), 0) AS baseline_inventory_without_v2,
        (
            SELECT SUM(COALESCE(ds.maybe_sales, ds.weighted_sales, 0))
            FROM daily_sales AS ds
            WHERE ds.asin = plan.asin
              AND ds.country = plan.country
              AND ds.shop = plan.shop
              AND DATE(ds.`date`) BETWEEN DATE_ADD(plan.add_date, INTERVAL 7 DAY)
                  AND DATE_ADD(plan.add_date, INTERVAL 13 DAY)
        ) AS coverage_demand_7d,
        (
            SELECT COUNT(DISTINCT DATE(ds.`date`))
            FROM daily_sales AS ds
            WHERE ds.asin = plan.asin
              AND ds.country = plan.country
              AND ds.shop = plan.shop
              AND DATE(ds.`date`) BETWEEN DATE_ADD(plan.add_date, INTERVAL 7 DAY)
                  AND DATE_ADD(plan.add_date, INTERVAL 13 DAY)
        ) AS coverage_demand_days
    FROM ranked_plan AS plan
),
ready_plan AS (
    SELECT metric.*
    FROM plan_metric AS metric
    WHERE metric.baseline_inventory_without_v2 IS NOT NULL
      AND metric.coverage_demand_7d IS NOT NULL
      AND metric.coverage_demand_days = 7
      AND NOT EXISTS (
          SELECT 1
          FROM ranked_plan AS prior_plan
          WHERE prior_plan.asin = metric.asin
            AND prior_plan.country = metric.country
            AND prior_plan.shop = metric.shop
            AND prior_plan.week_no < metric.week_no
            AND prior_plan.add_date > metric.service_start_date
      )
),
plan_calc AS (
    SELECT
        plan.id,
        plan.asin,
        plan.country,
        plan.shop,
        plan.week_no,
        plan.old_number,
        plan.ship_date,
        plan.add_date,
        plan.service_start_date,
        plan.service_end_date,
        CAST(plan.baseline_inventory_without_v2 AS SIGNED) AS baseline_inventory_without_v2,
        CAST(plan.coverage_demand_7d AS SIGNED) AS coverage_demand_7d,
        CAST(plan.coverage_demand_7d * 2 AS SIGNED) AS target_inventory_14d,
        CAST(0 AS SIGNED) AS prior_recalculated_supply,
        CAST(plan.baseline_inventory_without_v2 AS SIGNED) AS effective_start_inventory,
        CAST(
            CEIL(GREATEST(0, plan.coverage_demand_7d * 2 - plan.baseline_inventory_without_v2))
            AS SIGNED
        ) AS new_number,
        CAST(
            CEIL(GREATEST(0, plan.coverage_demand_7d * 2 - plan.baseline_inventory_without_v2))
            AS SIGNED
        ) AS cumulative_new_number
    FROM ready_plan AS plan
    WHERE plan.week_no = 1

    UNION ALL

    SELECT
        plan.id,
        plan.asin,
        plan.country,
        plan.shop,
        plan.week_no,
        plan.old_number,
        plan.ship_date,
        plan.add_date,
        plan.service_start_date,
        plan.service_end_date,
        CAST(plan.baseline_inventory_without_v2 AS SIGNED),
        CAST(plan.coverage_demand_7d AS SIGNED),
        CAST(plan.coverage_demand_7d * 2 AS SIGNED),
        previous.cumulative_new_number,
        CAST(plan.baseline_inventory_without_v2 + previous.cumulative_new_number AS SIGNED),
        CAST(
            CEIL(
                GREATEST(
                    0,
                    plan.coverage_demand_7d * 2
                    - (plan.baseline_inventory_without_v2 + previous.cumulative_new_number)
                )
            ) AS SIGNED
        ),
        CAST(
            previous.cumulative_new_number
            + CEIL(
                GREATEST(
                    0,
                    plan.coverage_demand_7d * 2
                    - (plan.baseline_inventory_without_v2 + previous.cumulative_new_number)
                )
            ) AS SIGNED
        )
    FROM ready_plan AS plan
    INNER JOIN plan_calc AS previous
        ON plan.asin = previous.asin
       AND plan.country = previous.country
       AND plan.shop = previous.shop
       AND plan.week_no = previous.week_no + 1
)
SELECT
    id AS plan_id,
    asin,
    country,
    shop,
    CONCAT('W', week_no) AS week_code,
    ship_date,
    add_date,
    service_start_date,
    service_end_date,
    old_number,
    new_number,
    new_number - old_number AS change_number,
    baseline_inventory_without_v2,
    prior_recalculated_supply,
    effective_start_inventory,
    coverage_demand_7d,
    target_inventory_14d,
    CONCAT(
        target_inventory_14d,
        ' - (',
        baseline_inventory_without_v2,
        ' + ',
        prior_recalculated_supply,
        ') = ',
        new_number
    ) AS calculation_process
FROM plan_calc
ORDER BY country, asin, shop, week_no;

ALTER TABLE temp_v2_recalculation_stage
    ADD UNIQUE INDEX idx_v2_recalculation_plan_id (plan_id),
    ADD UNIQUE INDEX idx_v2_recalculation_week (asin, country, shop, week_code);

-- 必须存在可重算记录，每个进入重算的业务组必须完整覆盖 W1-W7。
INSERT INTO temp_v2_recalculation_guard (guard_value)
SELECT IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_recalculation_stage;

INSERT INTO temp_v2_recalculation_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop
    FROM temp_v2_recalculation_stage
    GROUP BY asin, country, shop
    HAVING COUNT(*) <> 7
) AS incomplete_group;

-- 写回前再次检查锁定状态，防止预览后新建申请或生成真实发货。
INSERT INTO temp_v2_recalculation_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_recalculation_stage AS stage
INNER JOIN simulate_shipment AS sim
    ON sim.id = stage.plan_id
WHERE (sim.shippment_id IS NOT NULL AND TRIM(sim.shippment_id) <> '')
   OR EXISTS (
        SELECT 1
        FROM shipment_plan_change_v2 AS ch
        WHERE ch.plan_id = sim.id
          AND ch.status IN (
              'PENDING_SUPERVISOR',
              'PENDING_PROCUREMENT',
              'PENDING_FINAL',
              'APPLY_PENDING',
              'APPLYING',
              'APPLIED'
          )
   );

SET @v2_recalculation_stage_rows = (
    SELECT COUNT(*) FROM temp_v2_recalculation_stage
);
SET @v2_recalculation_changed_rows = (
    SELECT COUNT(*)
    FROM temp_v2_recalculation_stage
    WHERE old_number <> new_number
);

UPDATE simulate_shipment AS target
INNER JOIN temp_v2_recalculation_stage AS stage
    ON stage.plan_id = target.id
SET
    target.number = stage.new_number,
    target.v2_calculation_snapshot = JSON_MERGE_PATCH(
        COALESCE(target.v2_calculation_snapshot, JSON_OBJECT()),
        JSON_OBJECT(
            'formula_version', 'v2_backlog_recovery_2026_07_23',
            'generated_at', DATE_FORMAT(@v2_recalculated_at, '%Y-%m-%d %H:%i:%s.%f'),
            'cycle_phase', 'RECALCULATION',
            'service_start_date', DATE_FORMAT(stage.service_start_date, '%Y-%m-%d'),
            'service_end_date', DATE_FORMAT(stage.service_end_date, '%Y-%m-%d'),
            'first_week_demand', stage.coverage_demand_7d,
            'first_week_demand_days', 7,
            'target_demand', stage.target_inventory_14d,
            'raw_inventory_at_service_start', stage.effective_start_inventory,
            'gap_before_ceiling',
                stage.target_inventory_14d - stage.effective_start_inventory,
            'suggested_number', stage.new_number,
            'recalculation',
            JSON_OBJECT(
                'formula_version', 'v2_backlog_recovery_2026_07_23',
                'recalculated_at', DATE_FORMAT(@v2_recalculated_at, '%Y-%m-%d %H:%i:%s.%f'),
                'previous_number', stage.old_number,
                'new_number', stage.new_number,
                'week_code', stage.week_code,
                'service_start_date', DATE_FORMAT(stage.service_start_date, '%Y-%m-%d'),
                'service_end_date', DATE_FORMAT(stage.service_end_date, '%Y-%m-%d'),
                'baseline_inventory_without_v2', stage.baseline_inventory_without_v2,
                'prior_recalculated_supply', stage.prior_recalculated_supply,
                'effective_start_inventory', stage.effective_start_inventory,
                'coverage_demand_7d', stage.coverage_demand_7d,
                'target_inventory_14d', stage.target_inventory_14d,
                'formula', 'MAX(0, target_inventory_14d - effective_start_inventory)',
                'rollback_available', TRUE
            )
        )
    ),
    target.updated_at = @v2_recalculated_at
WHERE target.plan_source = 'shipment_plan_v2'
  AND target.shop = '合计'
  AND target.number = stage.old_number
  AND (target.shippment_id IS NULL OR TRIM(target.shippment_id) = '')
  AND NOT EXISTS (
      SELECT 1
      FROM shipment_plan_change_v2 AS ch
      WHERE ch.plan_id = target.id
        AND ch.status IN (
            'PENDING_SUPERVISOR',
            'PENDING_PROCUREMENT',
            'PENDING_FINAL',
            'APPLY_PENDING',
            'APPLYING',
            'APPLIED'
        )
  );

-- 乐观锁和写回值必须全部匹配，否则事务整体回滚。
INSERT INTO temp_v2_recalculation_guard (guard_value)
SELECT IF(COUNT(*) = @v2_recalculation_stage_rows, 1, 0)
FROM temp_v2_recalculation_stage AS stage
INNER JOIN simulate_shipment AS target
    ON target.id = stage.plan_id
   AND target.number = stage.new_number
   AND target.updated_at = @v2_recalculated_at;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_guard;

SELECT
    'OK' AS recalculation_status,
    @v2_recalculated_at AS recalculated_at,
    @v2_recalculation_stage_rows AS staged_rows,
    @v2_recalculation_changed_rows AS changed_number_rows,
    @v2_recalculation_stage_rows - @v2_recalculation_changed_rows AS unchanged_number_rows;
