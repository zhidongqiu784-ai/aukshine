-- 发货计划演变 v2：应用计划（collection workflow 第 1 个 SQL 节点）
-- 变量：:change_id, :audit_log_id
-- 触发前提：shipment_plan_change_v2.status='APPLY_PENDING'
--           且 projection_status='PENDING'。
-- 本节点只应用计划并把申请置为 APPLYING；定向水位推演成功后再执行 04 完成 SQL。

START TRANSACTION;

SET @v2_change_id = CAST(:change_id AS UNSIGNED);
SET @v2_request_status = NULL;
SET @v2_projection_status = NULL;
SET @v2_request_version = NULL;
SET @v2_plan_id = NULL;
SET @v2_original_number = NULL;
SET @v2_proposed_number = NULL;
SET @v2_original_date = NULL;
SET @v2_proposed_date = NULL;
SET @v2_original_channel = NULL;
SET @v2_proposed_channel = NULL;
SET @v2_asin = NULL;
SET @v2_country = NULL;
SET @v2_shop = NULL;
SET @v2_bundle_id = NULL;
SET @v2_request_uuid = NULL;
SET @v2_requester_user_id = NULL;
SET @v2_requester_username = NULL;
SET @v2_requester_department = NULL;

SELECT
    req.status,
    req.projection_status,
    req.row_version,
    req.plan_id,
    req.original_number,
    req.proposed_number,
    DATE(req.original_date),
    DATE(req.proposed_date),
    req.original_channel,
    req.proposed_channel,
    req.asin,
    req.country,
    req.shop,
    req.bundle_id,
    req.request_uuid,
    req.requester_user_id,
    req.requester_username,
    req.requester_department
INTO
    @v2_request_status,
    @v2_projection_status,
    @v2_request_version,
    @v2_plan_id,
    @v2_original_number,
    @v2_proposed_number,
    @v2_original_date,
    @v2_proposed_date,
    @v2_original_channel,
    @v2_proposed_channel,
    @v2_asin,
    @v2_country,
    @v2_shop,
    @v2_bundle_id,
    @v2_request_uuid,
    @v2_requester_user_id,
    @v2_requester_username,
    @v2_requester_department
FROM shipment_plan_change_v2 AS req
WHERE req.id = @v2_change_id
FOR UPDATE;

SET @v2_current_number = NULL;
SET @v2_current_date = NULL;
SET @v2_current_channel = NULL;
SET @v2_current_plan_source = NULL;
SET @v2_current_shippment_id = NULL;

SELECT
    sim.number,
    DATE(sim.`date`),
    sim.channel,
    sim.plan_source,
    sim.shippment_id
INTO
    @v2_current_number,
    @v2_current_date,
    @v2_current_channel,
    @v2_current_plan_source,
    @v2_current_shippment_id
FROM simulate_shipment AS sim
WHERE sim.id = @v2_plan_id
FOR UPDATE;

SET @v2_logistics_match_count = (
    SELECT COUNT(*)
    FROM v3_cfg_logistics_lead AS cfg
    WHERE cfg.site = @v2_country
      AND CONCAT(TRIM(cfg.channel), '-', cfg.lead_days, '天') = @v2_proposed_channel
);
SET @v2_logistics_days = (
    SELECT MAX(cfg.lead_days)
    FROM v3_cfg_logistics_lead AS cfg
    WHERE cfg.site = @v2_country
      AND CONCAT(TRIM(cfg.channel), '-', cfg.lead_days, '天') = @v2_proposed_channel
);
SET @v2_cycle_match_count = (
    SELECT COUNT(*) FROM v3_cfg_cycle_param AS cp WHERE cp.site = @v2_country
);
SET @v2_proposed_season = CASE
    WHEN DATE_FORMAT(DATE_ADD(@v2_proposed_date, INTERVAL @v2_logistics_days DAY), '%m-%d')
            BETWEEN '06-10' AND '07-10'
      OR DATE_FORMAT(DATE_ADD(@v2_proposed_date, INTERVAL @v2_logistics_days DAY), '%m-%d')
            BETWEEN '09-10' AND '10-10'
      OR DATE_FORMAT(DATE_ADD(@v2_proposed_date, INTERVAL @v2_logistics_days DAY), '%m-%d')
            BETWEEN '11-01' AND '12-15'
    THEN '旺季' ELSE '淡季'
END;
SET @v2_proposed_warehouse_days = (
    SELECT MAX(CASE
        WHEN @v2_proposed_season = '旺季' THEN cp.warehouse_peak
        ELSE cp.warehouse_off
    END)
    FROM v3_cfg_cycle_param AS cp
    WHERE cp.site = @v2_country
);
SET @v2_proposed_add_date = DATE_ADD(
    DATE_ADD(@v2_proposed_date, INTERVAL @v2_logistics_days DAY),
    INTERVAL @v2_proposed_warehouse_days DAY
);

DROP TEMPORARY TABLE IF EXISTS temp_v2_apply_guard;
CREATE TEMPORARY TABLE temp_v2_apply_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

INSERT INTO temp_v2_apply_guard (guard_value)
VALUES (IF(
    @v2_request_status = 'APPLY_PENDING'
    AND @v2_projection_status = 'PENDING'
    AND @v2_current_plan_source = 'shipment_plan_v2'
    AND @v2_current_number <=> @v2_original_number
    AND @v2_current_date <=> @v2_original_date
    AND @v2_current_channel <=> @v2_original_channel
    AND (@v2_current_shippment_id IS NULL OR TRIM(@v2_current_shippment_id) = '')
    AND @v2_proposed_number IS NOT NULL AND @v2_proposed_number >= 0
    AND @v2_proposed_date IS NOT NULL
    AND @v2_proposed_channel IS NOT NULL
    AND @v2_logistics_match_count = 1
    AND @v2_logistics_days IS NOT NULL
    AND @v2_cycle_match_count = 1
    AND @v2_proposed_warehouse_days IS NOT NULL
    AND @v2_proposed_add_date IS NOT NULL,
    1, 0
));

SET @v2_before_json = JSON_OBJECT(
    'number', @v2_current_number,
    'date', @v2_current_date,
    'channel', @v2_current_channel
);
SET @v2_after_json = JSON_OBJECT(
    'number', @v2_proposed_number,
    'date', @v2_proposed_date,
    'channel', @v2_proposed_channel,
    'season', @v2_proposed_season,
    'warehouse_days', @v2_proposed_warehouse_days,
    'add_date', @v2_proposed_add_date
);

UPDATE simulate_shipment
SET
    number = @v2_proposed_number,
    `date` = @v2_proposed_date,
    channel = @v2_proposed_channel,
    season = @v2_proposed_season,
    warehouse_days = @v2_proposed_warehouse_days,
    add_date = @v2_proposed_add_date,
    updated_at = NOW(3)
WHERE id = @v2_plan_id
  AND plan_source = 'shipment_plan_v2'
  AND number <=> @v2_original_number
  AND DATE(`date`) <=> @v2_original_date
  AND channel <=> @v2_original_channel
  AND (shippment_id IS NULL OR TRIM(shippment_id) = '');

SET @v2_plan_changed_rows = ROW_COUNT();
INSERT INTO temp_v2_apply_guard (guard_value)
VALUES (IF(@v2_plan_changed_rows = 1, 1, 0));

UPDATE shipment_plan_change_v2
SET
    status = 'APPLYING',
    projection_status = 'PENDING',
    row_version = row_version + 1,
    application_error = NULL,
    updated_at = NOW(3)
WHERE id = @v2_change_id
  AND status = 'APPLY_PENDING'
  AND projection_status = 'PENDING'
  AND row_version = @v2_request_version;

SET @v2_request_changed_rows = ROW_COUNT();
INSERT INTO temp_v2_apply_guard (guard_value)
VALUES (IF(@v2_request_changed_rows = 1, 1, 0));

SET @v2_apply_actor_user_id = COALESCE((
    SELECT actor_user_id
    FROM shipment_plan_change_log_v2
    WHERE change_id = @v2_change_id
      AND to_status = 'APPLY_PENDING'
      AND result = 'OK'
    ORDER BY occurred_at DESC, id DESC
    LIMIT 1
), @v2_requester_user_id);
SET @v2_apply_actor_username = COALESCE((
    SELECT actor_username
    FROM shipment_plan_change_log_v2
    WHERE change_id = @v2_change_id
      AND to_status = 'APPLY_PENDING'
      AND result = 'OK'
    ORDER BY occurred_at DESC, id DESC
    LIMIT 1
), @v2_requester_username);
SET @v2_apply_actor_role = COALESCE((
    SELECT acting_role
    FROM shipment_plan_change_log_v2
    WHERE change_id = @v2_change_id
      AND to_status = 'APPLY_PENDING'
      AND result = 'OK'
    ORDER BY occurred_at DESC, id DESC
    LIMIT 1
), 'system');

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
    'APPLY_PLAN',
    'APPLY_PENDING',
    'APPLYING',
    @v2_apply_actor_user_id,
    @v2_apply_actor_username,
    @v2_apply_actor_role,
    @v2_requester_department,
    NULL,
    @v2_before_json,
    @v2_after_json,
    'OK',
    NULL,
    NOW(3), NOW(3), NOW(3)
);

COMMIT;

SELECT
    @v2_change_id AS change_id,
    @v2_plan_id AS plan_id,
    @v2_asin AS asin,
    @v2_country AS country,
    @v2_shop AS shop,
    @v2_proposed_add_date AS add_date,
    @v2_request_version + 1 AS row_version,
    'APPLYING' AS status,
    'PENDING' AS projection_status;
