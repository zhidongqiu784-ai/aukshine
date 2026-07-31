-- 发货计划演变 v2：审核流转（同步 custom-action）
-- SQL 节点变量：
-- :actor_user_id, :acting_role, :change_id, :action,
-- :expected_row_version, :comment, :audit_log_id
--
-- action 仅支持 APPROVE / REJECT；审核身份与范围全部从 users、roles_users、
-- asin.sale_owner -> users.manager 实时回查。更新使用 id + status + row_version
-- 三重条件，防止两个审核动作覆盖彼此。

START TRANSACTION;

SET @v2_actor_user_id = CAST(:actor_user_id AS UNSIGNED);
SET @v2_acting_role = UPPER(TRIM(CAST(:acting_role AS CHAR)));
SET @v2_change_id = CAST(:change_id AS UNSIGNED);
SET @v2_action = UPPER(TRIM(CAST(:action AS CHAR)));
SET @v2_expected_version = CAST(:expected_row_version AS SIGNED);
SET @v2_comment = NULLIF(TRIM(CAST(:comment AS CHAR)), '');
SET @v2_from_status = NULL;
SET @v2_current_version = NULL;
SET @v2_week_code = NULL;
SET @v2_asin = NULL;
SET @v2_country = NULL;
SET @v2_shop = NULL;
SET @v2_plan_id = NULL;
SET @v2_bundle_id = NULL;
SET @v2_request_uuid = NULL;
SET @v2_sale_owner_snapshot = NULL;
SET @v2_requester_user_id = NULL;
SET @v2_request_reason = NULL;
SET @v2_gate_result = NULL;

SET @v2_actor_username = (
    SELECT MAX(u.username) FROM users AS u WHERE u.id = @v2_actor_user_id
);
SET @v2_actor_department = (
    SELECT MAX(u.department) FROM users AS u WHERE u.id = @v2_actor_user_id
);
SET @v2_is_admin = IF(EXISTS (
    SELECT 1 FROM roles_users AS ru
    WHERE ru.user_id = @v2_actor_user_id AND ru.role_name IN ('admin', 'root')
), 1, 0);
SET @v2_is_supervisor = IF(EXISTS (
    SELECT 1 FROM roles_users AS ru
    WHERE ru.user_id = @v2_actor_user_id AND ru.role_name = 'r_7ih2kbf7t1g'
), 1, 0);
SET @v2_is_logistics = IF(@v2_actor_department = '物流仓储部', 1, 0);

SELECT
    req.status,
    req.row_version,
    req.week_code,
    req.asin,
    req.country,
    req.shop,
    req.plan_id,
    req.bundle_id,
    req.request_uuid,
    req.sale_owner,
    req.requester_user_id,
    req.reason,
    req.gate_result
INTO
    @v2_from_status,
    @v2_current_version,
    @v2_week_code,
    @v2_asin,
    @v2_country,
    @v2_shop,
    @v2_plan_id,
    @v2_bundle_id,
    @v2_request_uuid,
    @v2_sale_owner_snapshot,
    @v2_requester_user_id,
    @v2_request_reason,
    @v2_gate_result
FROM shipment_plan_change_v2 AS req
WHERE req.id = @v2_change_id;

SET @v2_live_sale_owner = (
    SELECT MAX(NULLIF(TRIM(a.sale_owner), ''))
    FROM asin AS a
    WHERE a.asin = @v2_asin AND a.country = @v2_country
);
SET @v2_live_sale_manager = (
    SELECT MAX(NULLIF(TRIM(sale_user.manager), ''))
    FROM users AS sale_user
    WHERE sale_user.username = @v2_live_sale_owner
);

SET @v2_actor_allowed = CASE
    WHEN @v2_is_admin = 1
     AND (
        (@v2_from_status = 'PENDING_SUPERVISOR' AND @v2_acting_role = 'LEAD')
        OR (@v2_from_status = 'PENDING_PROCUREMENT' AND @v2_acting_role = 'OPS')
        OR (@v2_from_status = 'PENDING_FINAL' AND @v2_acting_role = 'FINAL')
     ) THEN 1
    WHEN @v2_from_status = 'PENDING_SUPERVISOR'
     AND @v2_acting_role = 'LEAD'
     AND @v2_is_supervisor = 1
     AND @v2_live_sale_manager = @v2_actor_username THEN 1
    WHEN @v2_from_status = 'PENDING_PROCUREMENT'
     AND @v2_acting_role = 'OPS'
     AND @v2_is_logistics = 1
     AND @v2_is_supervisor = 0 THEN 1
    WHEN @v2_from_status = 'PENDING_FINAL'
     AND @v2_acting_role = 'FINAL'
     AND @v2_is_logistics = 1
     AND @v2_is_supervisor = 0 THEN 1
    ELSE 0
END;

SET @v2_next_status = CASE
    WHEN @v2_action = 'REJECT' THEN 'REJECTED'
    WHEN @v2_action = 'APPROVE' AND @v2_from_status = 'PENDING_SUPERVISOR'
        THEN 'PENDING_PROCUREMENT'
    WHEN @v2_action = 'APPROVE' AND @v2_from_status = 'PENDING_PROCUREMENT'
         AND @v2_week_code IN ('W6', 'W7')
        THEN 'PENDING_FINAL'
    WHEN @v2_action = 'APPROVE' AND @v2_from_status = 'PENDING_PROCUREMENT'
        THEN 'APPLY_PENDING'
    WHEN @v2_action = 'APPROVE' AND @v2_from_status = 'PENDING_FINAL'
        THEN 'APPLY_PENDING'
    ELSE NULL
END;

SET @v2_validation_error = CASE
    WHEN @v2_actor_username IS NULL THEN '当前登录用户不存在或已失效'
    WHEN @v2_from_status IS NULL THEN '申请不存在'
    WHEN @v2_action NOT IN ('APPROVE', 'REJECT') THEN '不支持的审核动作'
    WHEN @v2_from_status NOT IN ('PENDING_SUPERVISOR', 'PENDING_PROCUREMENT', 'PENDING_FINAL')
        THEN '申请当前状态不可审核'
    WHEN @v2_current_version <> @v2_expected_version THEN '申请已被其他人处理，请刷新后重试'
    WHEN @v2_actor_allowed <> 1 THEN '当前用户没有该审核角色或商品范围权限'
    WHEN @v2_next_status IS NULL THEN '无法确定下一审核状态'
    WHEN @v2_action = 'REJECT' AND @v2_comment IS NULL THEN '驳回意见必填'
    ELSE NULL
END;

SET @v2_before_json = JSON_OBJECT(
    'status', @v2_from_status,
    'row_version', @v2_current_version,
    'gate_result', @v2_gate_result
);

UPDATE shipment_plan_change_v2
SET
    status = @v2_next_status,
    row_version = row_version + 1,
    projection_status = CASE
        WHEN @v2_next_status = 'APPLY_PENDING' THEN NULL
        WHEN @v2_next_status = 'REJECTED' THEN 'REJECTED'
        ELSE 'WAITING_APPROVAL'
    END,
    application_error = NULL,
    updated_at = NOW(3)
WHERE id = @v2_change_id
  AND status = @v2_from_status
  AND row_version = @v2_expected_version
  AND @v2_validation_error IS NULL;

SET @v2_changed_rows = ROW_COUNT();

INSERT INTO shipment_plan_change_log_v2 (
    id,
    change_id,
    bundle_id,
    request_uuid,
    action,
    from_status,
    to_status,
    actor_user_id,
    actor_username,
    acting_role,
    actor_department,
    comment,
    before_json,
    after_json,
    result,
    error_message,
    occurred_at,
    created_at,
    updated_at
)
SELECT
    CAST(:audit_log_id AS UNSIGNED),
    @v2_change_id,
    @v2_bundle_id,
    @v2_request_uuid,
    @v2_action,
    @v2_from_status,
    @v2_next_status,
    @v2_actor_user_id,
    @v2_actor_username,
    LOWER(@v2_acting_role),
    @v2_actor_department,
    @v2_comment,
    @v2_before_json,
    JSON_OBJECT('status', @v2_next_status, 'row_version', @v2_current_version + 1),
    'OK',
    NULL,
    NOW(3),
    NOW(3),
    NOW(3)
WHERE @v2_changed_rows = 1;

COMMIT;

SELECT
    CASE WHEN @v2_changed_rows = 1 THEN 1 ELSE 0 END AS allow,
    CASE
        WHEN @v2_changed_rows = 1 THEN NULL
        WHEN @v2_validation_error IS NOT NULL THEN @v2_validation_error
        ELSE '申请已被其他人处理，请刷新后重试'
    END AS error_message,
    @v2_change_id AS change_id,
    @v2_from_status AS from_status,
    @v2_next_status AS next_status,
    @v2_current_version + 1 AS next_row_version,
    CASE WHEN @v2_changed_rows = 1 AND @v2_next_status = 'APPLY_PENDING' THEN 1 ELSE 0 END
        AS should_trigger_apply,
    @v2_action AS action,
    @v2_actor_username AS actor_username,
    LOWER(@v2_acting_role) AS acting_role;
