-- 工作流：发货计划演变-v2-重算现有建议
-- 节点 01：原地重算现有 W1-W7 建议数量。
-- 数据库：MySQL 8.x
--
-- 计算口径：
-- 1. 只处理未来、区域合计层、plan_source=shipment_plan_v2 的现有计划。
-- 2. 任一周已关联真实发货或存在活动申请时，整组 ASIN/站点不参与重算。
-- 3. 先排除现有 v2 模拟计划，按普通库存口径逐日重建基线。
-- 4. 缺货期间未成交需求不结转；正补货到达时从补货量重新起算。
-- 5. 每周先从服务期目标倒推到货日应有库存，再扣除到货日前可用库存：
--    建议量 = MAX(0, 到货日应有库存 - 到货日前可用库存)。

SET SESSION cte_max_recursion_depth = 1000;
SET @v2_recalculated_at = NOW(3);

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_stage;

CREATE TEMPORARY TABLE temp_v2_recalculation_guard (
    stage_exists TINYINT,
    complete_groups TINYINT,
    service_target_reached TINYINT,
    plans_unlocked TINYINT,
    writeback_matched TINYINT,
    CONSTRAINT chk_v2_stage_exists
        CHECK (stage_exists IS NULL OR stage_exists = 1),
    CONSTRAINT chk_v2_complete_groups
        CHECK (complete_groups IS NULL OR complete_groups = 1),
    CONSTRAINT chk_v2_service_target_reached
        CHECK (service_target_reached IS NULL OR service_target_reached = 1),
    CONSTRAINT chk_v2_plans_unlocked
        CHECK (plans_unlocked IS NULL OR plans_unlocked = 1),
    CONSTRAINT chk_v2_writeback_matched
        CHECK (writeback_matched IS NULL OR writeback_matched = 1)
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
    WHERE metric.add_date >= CURDATE()
      AND metric.coverage_demand_7d IS NOT NULL
      AND metric.coverage_demand_days = 7
),
scope_horizon AS (
    SELECT
        asin,
        country,
        shop,
        MAX(service_start_date) AS max_projection_date
    FROM ready_plan
    GROUP BY asin, country, shop
),
projection_input AS (
    SELECT
        ds.asin,
        ds.country,
        ds.shop,
        DATE(ds.`date`) AS projection_date,
        CASE
            WHEN DATE(ds.`date`) = CURDATE()
            THEN CAST(COALESCE(ds.inventory, 0) AS SIGNED)
                 - CAST(COALESCE(ds.`add`, 0) AS SIGNED)
        END AS actual_inventory_without_supply,
        CAST(COALESCE(ds.maybe_sales, ds.weighted_sales, 0) AS SIGNED) AS demand,
        CAST(COALESCE(supply.remaining, 0) AS SIGNED) AS real_supply
    FROM daily_sales AS ds
    INNER JOIN scope_horizon AS horizon
        ON horizon.asin = ds.asin
       AND horizon.country = ds.country
       AND horizon.shop = ds.shop
    LEFT JOIN real_supply AS supply
        ON supply.asin = ds.asin
       AND supply.country = ds.country
       AND supply.expected_storage_time = DATE(ds.`date`)
    WHERE DATE(ds.`date`) BETWEEN CURDATE() AND horizon.max_projection_date
),
plan_requirement AS (
    SELECT
        plan.id AS plan_id,
        plan.asin,
        plan.country,
        plan.shop,
        plan.week_no,
        plan.add_date,
        plan.service_start_date AS requirement_date,
        CAST(plan.coverage_demand_7d * 2 AS SIGNED) AS required_inventory
    FROM ready_plan AS plan

    UNION ALL

    SELECT
        requirement.plan_id,
        requirement.asin,
        requirement.country,
        requirement.shop,
        requirement.week_no,
        requirement.add_date,
        DATE_SUB(requirement.requirement_date, INTERVAL 1 DAY),
        CAST(
            CASE
                WHEN requirement.required_inventory <= current_day.real_supply THEN 0
                ELSE previous_day.demand
                     + requirement.required_inventory
                     - current_day.real_supply
            END AS SIGNED
        )
    FROM plan_requirement AS requirement
    INNER JOIN projection_input AS current_day
        ON current_day.asin = requirement.asin
       AND current_day.country = requirement.country
       AND current_day.shop = requirement.shop
       AND current_day.projection_date = requirement.requirement_date
    INNER JOIN projection_input AS previous_day
        ON previous_day.asin = requirement.asin
       AND previous_day.country = requirement.country
       AND previous_day.shop = requirement.shop
       AND previous_day.projection_date = DATE_SUB(requirement.requirement_date, INTERVAL 1 DAY)
    WHERE requirement.requirement_date > requirement.add_date
),
plan_requirement_at_add AS (
    SELECT
        plan_id,
        asin,
        country,
        shop,
        week_no,
        add_date,
        required_inventory
    FROM plan_requirement
    WHERE requirement_date = add_date
),
arrival_requirement AS (
    SELECT
        asin,
        country,
        shop,
        add_date,
        MAX(required_inventory) AS required_inventory
    FROM plan_requirement_at_add
    GROUP BY asin, country, shop, add_date
),
inventory_projection AS (
    SELECT
        input.asin,
        input.country,
        input.shop,
        input.projection_date,
        input.demand,
        CAST(
            GREATEST(
                input.actual_inventory_without_supply + input.real_supply,
                COALESCE(
                    arrival.required_inventory,
                    input.actual_inventory_without_supply + input.real_supply
                )
            ) AS SIGNED
        ) AS projected_inventory,
        CAST(input.actual_inventory_without_supply + input.real_supply AS SIGNED)
            AS inventory_before_plan
    FROM projection_input AS input
    LEFT JOIN arrival_requirement AS arrival
        ON arrival.asin = input.asin
       AND arrival.country = input.country
       AND arrival.shop = input.shop
       AND arrival.add_date = input.projection_date
    WHERE input.projection_date = CURDATE()

    UNION ALL

    SELECT
        input.asin,
        input.country,
        input.shop,
        input.projection_date,
        input.demand,
        CAST(
            GREATEST(
                GREATEST(0, previous.projected_inventory - previous.demand)
                    + input.real_supply,
                COALESCE(
                    arrival.required_inventory,
                    GREATEST(0, previous.projected_inventory - previous.demand)
                        + input.real_supply
                )
            ) AS SIGNED
        ),
        CAST(
            GREATEST(0, previous.projected_inventory - previous.demand)
                + input.real_supply AS SIGNED
        )
    FROM projection_input AS input
    INNER JOIN inventory_projection AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.projection_date = DATE_ADD(previous.projection_date, INTERVAL 1 DAY)
    LEFT JOIN arrival_requirement AS arrival
        ON arrival.asin = input.asin
       AND arrival.country = input.country
       AND arrival.shop = input.shop
       AND arrival.add_date = input.projection_date
),
arrival_allocation_source AS (
    SELECT DISTINCT
        plan.*,
        requirement.required_inventory AS required_inventory_at_add_date,
        projection.inventory_before_plan,
        service_projection.projected_inventory AS projected_inventory_at_service_start
    FROM ready_plan AS plan
    INNER JOIN plan_requirement_at_add AS requirement
        ON requirement.plan_id = plan.id
    INNER JOIN inventory_projection AS projection
        ON projection.asin = plan.asin
       AND projection.country = plan.country
       AND projection.shop = plan.shop
       AND projection.projection_date = plan.add_date
    INNER JOIN inventory_projection AS service_projection
        ON service_projection.asin = plan.asin
       AND service_projection.country = plan.country
       AND service_projection.shop = plan.shop
       AND service_projection.projection_date = plan.service_start_date
),
arrival_allocation_base AS (
    SELECT
        source.*,
        MAX(source.required_inventory_at_add_date) OVER (
            PARTITION BY source.asin, source.country, source.shop, source.add_date
            ORDER BY source.week_no, source.id
            ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING
        ) AS prior_same_date_required_inventory
    FROM arrival_allocation_source AS source
),
arrival_allocation AS (
    SELECT
        allocation.*,
        CAST(
            GREATEST(
                allocation.inventory_before_plan,
                COALESCE(
                    allocation.prior_same_date_required_inventory,
                    allocation.inventory_before_plan
                )
            ) AS SIGNED
        ) AS effective_inventory_before_plan,
        CAST(
            CEIL(
                GREATEST(
                    0,
                    allocation.required_inventory_at_add_date
                    - GREATEST(
                        allocation.inventory_before_plan,
                        COALESCE(
                            allocation.prior_same_date_required_inventory,
                            allocation.inventory_before_plan
                        )
                    )
                )
            ) AS SIGNED
        ) AS new_number
    FROM arrival_allocation_base AS allocation
),
plan_calc AS (
    SELECT
        allocation.*,
        CAST(
            allocation.effective_inventory_before_plan
                - allocation.inventory_before_plan AS SIGNED
        ) AS prior_recalculated_supply
    FROM arrival_allocation AS allocation
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
    inventory_before_plan AS baseline_inventory_without_v2,
    prior_recalculated_supply,
    effective_inventory_before_plan AS effective_start_inventory,
    coverage_demand_7d,
    CAST(coverage_demand_7d * 2 AS SIGNED) AS target_inventory_14d,
    required_inventory_at_add_date,
    projected_inventory_at_service_start,
    CONCAT(
        required_inventory_at_add_date,
        ' - (',
        inventory_before_plan,
        ' + ',
        prior_recalculated_supply,
        ') = ',
        new_number
    ) AS calculation_process
FROM plan_calc
ORDER BY country, asin, shop, week_no;

ALTER TABLE temp_v2_recalculation_stage
    ADD UNIQUE INDEX idx_v2_recalculation_plan_id (plan_id),
    ADD UNIQUE INDEX idx_v2_recalculation_week (asin, country, shop, ship_date);

-- 必须存在可重算记录，每个进入重算的业务组必须完整覆盖 W1-W7。
INSERT INTO temp_v2_recalculation_guard (stage_exists)
SELECT IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_recalculation_stage;

INSERT INTO temp_v2_recalculation_guard (complete_groups)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop
    FROM temp_v2_recalculation_stage
    GROUP BY asin, country, shop
    HAVING COUNT(*) <> 7
) AS incomplete_group;

-- 重算后的到货曲线必须在每周服务期开始日达到两周目标库存。
INSERT INTO temp_v2_recalculation_guard (service_target_reached)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_recalculation_stage
WHERE projected_inventory_at_service_start < target_inventory_14d;

-- 写回前再次检查锁定状态，防止预览后新建申请或生成真实发货。
INSERT INTO temp_v2_recalculation_guard (plans_unlocked)
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
            'formula_version', 'v2_stockout_no_backlog_2026_07_23',
            'generated_at', DATE_FORMAT(@v2_recalculated_at, '%Y-%m-%d %H:%i:%s.%f'),
            'cycle_phase', 'RECALCULATION',
            'service_start_date', DATE_FORMAT(stage.service_start_date, '%Y-%m-%d'),
            'service_end_date', DATE_FORMAT(stage.service_end_date, '%Y-%m-%d'),
            'first_week_demand', stage.coverage_demand_7d,
            'first_week_demand_days', 7,
            'target_demand', stage.required_inventory_at_add_date,
            'raw_inventory_at_service_start', stage.effective_start_inventory,
            'gap_before_ceiling',
                stage.required_inventory_at_add_date - stage.effective_start_inventory,
            'suggested_number', stage.new_number,
            'recalculation',
            JSON_OBJECT(
                'formula_version', 'v2_stockout_no_backlog_2026_07_23',
                'recalculated_at', DATE_FORMAT(@v2_recalculated_at, '%Y-%m-%d %H:%i:%s.%f'),
                'new_number', stage.new_number,
                'week_code', stage.week_code,
                'service_start_date', DATE_FORMAT(stage.service_start_date, '%Y-%m-%d'),
                'service_end_date', DATE_FORMAT(stage.service_end_date, '%Y-%m-%d'),
                'baseline_inventory_without_v2', stage.baseline_inventory_without_v2,
                'prior_recalculated_supply', stage.prior_recalculated_supply,
                'effective_start_inventory', stage.effective_start_inventory,
                'coverage_demand_7d', stage.coverage_demand_7d,
                'target_inventory_14d', stage.target_inventory_14d,
                'required_inventory_at_add_date', stage.required_inventory_at_add_date,
                'inventory_before_plan_at_add_date', stage.baseline_inventory_without_v2,
                'projected_inventory_at_service_start',
                    stage.projected_inventory_at_service_start,
                'stockout_demand_recovered', FALSE,
                'formula',
                    'MAX(0, required_inventory_at_add_date - effective_inventory_before_plan)'
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
INSERT INTO temp_v2_recalculation_guard (writeback_matched)
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
