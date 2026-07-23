-- 工作流：发货计划演变-v2-重算现有建议
-- 应急回滚节点：恢复最近一次重算前的建议数量。
-- 默认不放入线上主链，只在确认需要回滚时人工执行。

SET @v2_rollback_at = NOW(3);

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_rollback_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_rollback_stage;

CREATE TEMPORARY TABLE temp_v2_recalculation_rollback_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

CREATE TEMPORARY TABLE temp_v2_recalculation_rollback_stage AS
SELECT
    sim.id AS plan_id,
    sim.number AS current_number,
    CAST(
        JSON_UNQUOTE(
            JSON_EXTRACT(sim.v2_calculation_snapshot, '$.recalculation.previous_number')
        ) AS SIGNED
    ) AS previous_number
FROM simulate_shipment AS sim
WHERE sim.plan_source = 'shipment_plan_v2'
  AND sim.shop = '合计'
  AND sim.`date` >= CURDATE()
  AND JSON_UNQUOTE(
      JSON_EXTRACT(sim.v2_calculation_snapshot, '$.recalculation.formula_version')
  ) = 'v2_backlog_recovery_2026_07_23'
  AND JSON_EXTRACT(
      sim.v2_calculation_snapshot, '$.recalculation.rollback_available'
  ) = TRUE;

ALTER TABLE temp_v2_recalculation_rollback_stage
    ADD UNIQUE INDEX idx_v2_rollback_plan_id (plan_id);

INSERT INTO temp_v2_recalculation_rollback_guard (guard_value)
SELECT IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_recalculation_rollback_stage;

-- 回滚必须整批执行；若任一计划已进入真实发货或申请流转，则阻断整次回滚。
INSERT INTO temp_v2_recalculation_rollback_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_recalculation_rollback_stage AS stage
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

SET @v2_rollback_rows = (
    SELECT COUNT(*) FROM temp_v2_recalculation_rollback_stage
);

UPDATE simulate_shipment AS target
INNER JOIN temp_v2_recalculation_rollback_stage AS stage
    ON stage.plan_id = target.id
SET
    target.number = stage.previous_number,
    target.v2_calculation_snapshot = JSON_SET(
        target.v2_calculation_snapshot,
        '$.recalculation.rollback_available', FALSE,
        '$.recalculation.rolled_back_at',
        DATE_FORMAT(@v2_rollback_at, '%Y-%m-%d %H:%i:%s.%f')
    ),
    target.updated_at = @v2_rollback_at
WHERE target.number = stage.current_number
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

INSERT INTO temp_v2_recalculation_rollback_guard (guard_value)
SELECT IF(COUNT(*) = @v2_rollback_rows, 1, 0)
FROM temp_v2_recalculation_rollback_stage AS stage
INNER JOIN simulate_shipment AS target
    ON target.id = stage.plan_id
   AND target.number = stage.previous_number
   AND target.updated_at = @v2_rollback_at;

COMMIT;

DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_rollback_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_recalculation_rollback_guard;

SELECT
    'OK' AS rollback_status,
    @v2_rollback_at AS rolled_back_at,
    @v2_rollback_rows AS restored_rows;
