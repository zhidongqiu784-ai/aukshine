-- 发货计划演变 v2：定向水位推演成功后的完成节点
-- 变量：:change_id, :audit_log_id

START TRANSACTION;

SET @v2_change_id = CAST(:change_id AS UNSIGNED);
SET @v2_from_status = NULL;
SET @v2_current_version = NULL;
SET @v2_bundle_id = NULL;
SET @v2_request_uuid = NULL;
SET @v2_requester_user_id = NULL;
SET @v2_requester_username = NULL;
SET @v2_requester_department = NULL;

SELECT
    status,
    row_version,
    bundle_id,
    request_uuid,
    requester_user_id,
    requester_username,
    requester_department
INTO
    @v2_from_status,
    @v2_current_version,
    @v2_bundle_id,
    @v2_request_uuid,
    @v2_requester_user_id,
    @v2_requester_username,
    @v2_requester_department
FROM shipment_plan_change_v2
WHERE id = @v2_change_id
FOR UPDATE;

DROP TEMPORARY TABLE IF EXISTS temp_v2_finish_guard;
CREATE TEMPORARY TABLE temp_v2_finish_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);
INSERT INTO temp_v2_finish_guard (guard_value)
VALUES (IF(@v2_from_status = 'APPLYING', 1, 0));

UPDATE shipment_plan_change_v2
SET
    status = 'APPLIED',
    projection_status = 'OK',
    application_error = NULL,
    applied_at = NOW(3),
    row_version = row_version + 1,
    updated_at = NOW(3)
WHERE id = @v2_change_id
  AND status = 'APPLYING'
  AND row_version = @v2_current_version;

SET @v2_finish_changed_rows = ROW_COUNT();
INSERT INTO temp_v2_finish_guard (guard_value)
VALUES (IF(@v2_finish_changed_rows = 1, 1, 0));

INSERT INTO shipment_plan_change_log_v2 (
    id, change_id, bundle_id, request_uuid, action,
    from_status, to_status, actor_user_id, actor_username,
    acting_role, actor_department, comment,
    before_json, after_json, result, error_message,
    occurred_at, created_at, updated_at
)
VALUES (
    CAST(:audit_log_id AS UNSIGNED),
    @v2_change_id,
    @v2_bundle_id,
    @v2_request_uuid,
    'PROJECTION_OK',
    'APPLYING',
    'APPLIED',
    @v2_requester_user_id,
    @v2_requester_username,
    'system',
    @v2_requester_department,
    NULL,
    JSON_OBJECT('status', 'APPLYING', 'projection_status', 'PENDING'),
    JSON_OBJECT('status', 'APPLIED', 'projection_status', 'OK'),
    'OK',
    NULL,
    NOW(3), NOW(3), NOW(3)
);

COMMIT;

SELECT
    @v2_change_id AS change_id,
    'APPLIED' AS status,
    'OK' AS projection_status,
    @v2_current_version + 1 AS row_version;
