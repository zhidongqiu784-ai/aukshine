-- 发货计划演变 v2：提交申请（服务端校验 + 同口径安全区间闸）
-- NocoBase SQL 节点变量：
-- :actor_user_id, :acting_role, :request_uuid, :bundle_id, :plan_id,
-- :change_kind, :proposed_number, :proposed_date, :proposed_channel,
-- :reason_type, :reason
--
-- 安全原则：
-- 1. 用户、角色、商品范围、原计划、周次、路线和闸结果全部由服务端重查。
-- 2. 不读取前端 original_*、week_code、gate_result、status、requester_*。
-- 3. 安全闸以 daily_sales.v2_days_for_sale 为系统基线，并用拟议计划替换后按
--    节点 10 同一条库存递推规则重算逐日风险；proposal_risk <= baseline_risk
--    对所有日期都成立才是 SAFE_OR_NOT_WORSE。新品始终 OUT。
-- 4. 本 SQL 只读业务表；通过后由 workflow create 节点创建申请和提交日志。

SET SESSION cte_max_recursion_depth = 1000;
SET @v2_run_monday = DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY);

DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_context;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_effective;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_scope;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_recursive_source;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_projection;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_risk;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_gate_summary;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_guard_summary;
DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_output;

CREATE TEMPORARY TABLE temp_v2_submit_guard (
    guard_order INT NOT NULL,
    guard_name VARCHAR(64) NOT NULL,
    guard_value TINYINT NOT NULL,
    error_message VARCHAR(255) NOT NULL
);

CREATE TEMPORARY TABLE temp_v2_submit_context AS
SELECT
    input.plan_id AS requested_plan_id,
    sim.id AS plan_id,
    sim.plan_source,
    sim.asin,
    sim.country,
    sim.shop,
    sim.shop_id,
    CAST(COALESCE(sim.number, 0) AS SIGNED) AS original_number,
    DATE(sim.`date`) AS original_date,
    sim.channel AS original_channel,
    DATE(sim.add_date) AS original_add_date,
    sim.shippment_id,
    input.actor_user_id AS requested_actor_user_id,
    u.id AS actor_user_id,
    u.username AS actor_username,
    u.department AS actor_department,
    CASE WHEN EXISTS (
        SELECT 1 FROM roles_users AS ru
        WHERE ru.user_id = u.id AND ru.role_name IN ('admin', 'root')
    ) THEN 1 ELSE 0 END AS is_admin,
    CASE WHEN EXISTS (
        SELECT 1 FROM roles_users AS ru
        WHERE ru.user_id = u.id AND ru.role_name = 'r_7ih2kbf7t1g'
    ) THEN 1 ELSE 0 END AS is_supervisor,
    CASE WHEN u.department = '物流仓储部' THEN 1 ELSE 0 END AS is_logistics,
    product.sale_owner,
    product.asin_match_count,
    product.asin_status,
    label.product_label,
    FLOOR(DATEDIFF(DATE(sim.`date`), @v2_run_monday) / 7) AS week_no
FROM (
    SELECT
        CAST(:plan_id AS UNSIGNED) AS plan_id,
        CAST(:actor_user_id AS UNSIGNED) AS actor_user_id
) AS input
LEFT JOIN simulate_shipment AS sim
    ON sim.id = input.plan_id
LEFT JOIN users AS u
    ON u.id = input.actor_user_id
LEFT JOIN (
    SELECT
        a.asin,
        a.country,
        MAX(NULLIF(TRIM(a.sale_owner), '')) AS sale_owner,
        MAX(a.status) AS asin_status,
        COUNT(*) AS asin_match_count
    FROM asin AS a
    GROUP BY a.asin, a.country
) AS product
    ON product.asin = sim.asin
   AND product.country = sim.country
LEFT JOIN (
    SELECT
        ds.asin,
        ds.country,
        MAX(COALESCE(
            NULLIF(TRIM(plc.label), ''),
            CASE
                WHEN ds.days_on_sale IS NULL THEN NULL
                WHEN ds.days_on_sale < 90 THEN '新品期'
                WHEN ds.days_on_sale < 365 THEN '成长期'
                ELSE '成熟期'
            END
        )) AS product_label
    FROM daily_sales AS ds
    LEFT JOIN (
        SELECT country, model, MAX(NULLIF(TRIM(label), '')) AS label
        FROM product_label_cfg
        WHERE label IS NOT NULL AND TRIM(label) <> ''
        GROUP BY country, model
    ) AS plc
        ON plc.country = ds.country
       AND plc.model = ds.model
    WHERE ds.`date` = CURDATE()
      AND ds.shop = '合计'
    GROUP BY ds.asin, ds.country
) AS label
    ON label.asin = sim.asin
   AND label.country = sim.country
;

INSERT INTO temp_v2_submit_guard
SELECT 10, 'ACTOR_EXISTS', IF(actor_user_id IS NOT NULL, 1, 0), '当前登录用户不存在或已失效'
FROM temp_v2_submit_context;

INSERT INTO temp_v2_submit_guard
SELECT 20, 'PLAN_EXISTS', IF(plan_id IS NOT NULL, 1, 0), '目标发货计划不存在'
FROM temp_v2_submit_context;

CREATE TEMPORARY TABLE temp_v2_submit_effective AS
SELECT
    context.*,
    UPPER(TRIM(CAST(:acting_role AS CHAR))) AS acting_role,
    UPPER(TRIM(CAST(:change_kind AS CHAR))) AS requested_change_kind,
    NULLIF(
        TRIM(CAST(:request_uuid AS CHAR)) COLLATE utf8mb4_0900_ai_ci,
        ''
    ) AS request_uuid,
    NULLIF(TRIM(CAST(:bundle_id AS CHAR)), '') AS bundle_id,
    NULLIF(TRIM(CAST(:reason_type AS CHAR)), '') AS reason_type,
    NULLIF(TRIM(CAST(:reason AS CHAR)), '') AS reason,
    COALESCE(CAST(:proposed_number AS SIGNED), context.original_number) AS effective_number,
    COALESCE(DATE(:proposed_date), context.original_date) AS effective_date,
    COALESCE(
        NULLIF(
            TRIM(CAST(:proposed_channel AS CHAR)) COLLATE utf8mb4_0900_ai_ci,
            ''
        ),
        context.original_channel
    ) COLLATE utf8mb4_0900_ai_ci AS effective_channel,
    CASE
        WHEN context.asin_status = '新品'
          OR COALESCE(context.product_label, '') LIKE '%新品%'
        THEN 1 ELSE 0
    END AS is_new_product
FROM temp_v2_submit_context AS context;

ALTER TABLE temp_v2_submit_effective
    ADD COLUMN change_kind VARCHAR(16) NULL,
    ADD COLUMN logistics_days INT NULL,
    ADD COLUMN logistics_match_count INT NOT NULL DEFAULT 0,
    ADD COLUMN warehouse_days INT NULL,
    ADD COLUMN cycle_match_count INT NOT NULL DEFAULT 0,
    ADD COLUMN effective_season VARCHAR(8) NULL,
    ADD COLUMN effective_add_date DATE NULL;

UPDATE temp_v2_submit_effective
SET change_kind = CASE
    WHEN (
        (NOT (effective_number <=> original_number))
        + (NOT (effective_date <=> original_date))
        + (NOT (effective_channel <=> original_channel))
    ) > 1 THEN 'MIXED'
    WHEN NOT (effective_number <=> original_number) THEN 'NUMBER'
    WHEN NOT (effective_date <=> original_date) THEN 'DATE'
    WHEN NOT (effective_channel <=> original_channel) THEN 'CHANNEL'
    ELSE 'NONE'
END;

UPDATE temp_v2_submit_effective AS effective
SET
    effective.logistics_days = (
        SELECT MAX(cfg.lead_days)
        FROM v3_cfg_logistics_lead AS cfg
        WHERE cfg.site = effective.country
          AND CONCAT(TRIM(cfg.channel), '-', cfg.lead_days, '天') = effective.effective_channel
    ),
    effective.logistics_match_count = (
        SELECT COUNT(*)
        FROM v3_cfg_logistics_lead AS cfg
        WHERE cfg.site = effective.country
          AND CONCAT(TRIM(cfg.channel), '-', cfg.lead_days, '天') = effective.effective_channel
    ),
    effective.cycle_match_count = (
        SELECT COUNT(*) FROM v3_cfg_cycle_param AS cp
        WHERE cp.site = effective.country
    );

UPDATE temp_v2_submit_effective AS effective
SET effective.effective_season = CASE
    WHEN DATE_FORMAT(DATE_ADD(effective.effective_date, INTERVAL effective.logistics_days DAY), '%m-%d')
            BETWEEN '06-10' AND '07-10'
      OR DATE_FORMAT(DATE_ADD(effective.effective_date, INTERVAL effective.logistics_days DAY), '%m-%d')
            BETWEEN '09-10' AND '10-10'
      OR DATE_FORMAT(DATE_ADD(effective.effective_date, INTERVAL effective.logistics_days DAY), '%m-%d')
            BETWEEN '11-01' AND '12-15'
    THEN '旺季' ELSE '淡季'
END;

UPDATE temp_v2_submit_effective AS effective
SET effective.warehouse_days = (
    SELECT MAX(CASE
        WHEN effective.effective_season = '旺季' THEN cp.warehouse_peak
        ELSE cp.warehouse_off
    END)
    FROM v3_cfg_cycle_param AS cp
    WHERE cp.site = effective.country
);

UPDATE temp_v2_submit_effective
SET effective_add_date = DATE_ADD(
    DATE_ADD(effective_date, INTERVAL logistics_days DAY),
    INTERVAL warehouse_days DAY
);

-- 身份、来源、范围、字段和幂等防护。每条语句只打开 TEMP 表一次。
INSERT INTO temp_v2_submit_guard
SELECT 30, 'PLAN_SOURCE', IF(
    plan_source = 'shipment_plan_v2'
    AND asin IS NOT NULL AND TRIM(asin) <> ''
    AND country IS NOT NULL AND TRIM(country) <> ''
    AND shop = '合计'
    AND original_date IS NOT NULL AND asin_match_count = 1,
    1, 0
), '目标必须是区域合计口径的 shipment_plan_v2 计划'
FROM temp_v2_submit_effective;

INSERT INTO temp_v2_submit_guard
SELECT 40, 'REQUIRED_INPUT', IF(
    request_uuid IS NOT NULL AND bundle_id IS NOT NULL
    AND reason_type IS NOT NULL AND reason IS NOT NULL,
    1, 0
), '请求标识、整包标识、理由类型和补充理由均为必填'
FROM temp_v2_submit_effective;

INSERT INTO temp_v2_submit_guard
SELECT 50, 'IDEMPOTENCY', IF(COUNT(*) = 0, 1, 0), '该请求已经提交，请勿重复操作'
FROM shipment_plan_change_v2
WHERE request_uuid = NULLIF(
    TRIM(CAST(:request_uuid AS CHAR)) COLLATE utf8mb4_0900_ai_ci,
    ''
);

INSERT INTO temp_v2_submit_guard
SELECT 60, 'ACTOR_SCOPE', IF(
    acting_role IN ('SALE', 'OPS')
    AND NOT (
        acting_role = 'SALE' AND is_admin = 0
        AND (
            is_supervisor = 1
            OR is_logistics = 1
            OR COALESCE(sale_owner, '') <> actor_username
        )
    )
    AND NOT (
        acting_role = 'OPS' AND is_admin = 0
        AND (is_supervisor = 1 OR is_logistics = 0)
    )
    AND NOT (acting_role = 'OPS' AND week_no NOT BETWEEN 1 AND 2),
    1, 0
), '当前用户无权以该角色修改此计划；采购直改仅限 W1-W2'
FROM temp_v2_submit_effective;

INSERT INTO temp_v2_submit_guard
SELECT 70, 'WEEK_AND_LOCK', IF(
    week_no BETWEEN 1 AND 7
    AND (shippment_id IS NULL OR TRIM(shippment_id) = ''),
    1, 0
), '仅允许修改当前 W1-W7，已关联真实货件的计划已锁定'
FROM temp_v2_submit_effective;

INSERT INTO temp_v2_submit_guard
SELECT 80, 'EFFECTIVE_VALUES', IF(
    change_kind IN ('NUMBER', 'DATE', 'CHANNEL', 'MIXED')
    AND effective_number IS NOT NULL AND effective_number >= 0
    AND effective_date IS NOT NULL AND effective_channel IS NOT NULL
    AND logistics_match_count = 1 AND logistics_days IS NOT NULL
    AND cycle_match_count = 1 AND warehouse_days IS NOT NULL
    AND effective_add_date IS NOT NULL,
    1, 0
), '拟议值无变化、无效，或物流/入仓参数不是唯一有效配置'
FROM temp_v2_submit_effective;

INSERT INTO temp_v2_submit_guard
SELECT 90, 'W1_W2_DIRECTION', IF(
    NOT (
        week_no BETWEEN 1 AND 2
        AND effective_number < original_number
    )
    AND NOT (
        week_no BETWEEN 1 AND 2
        AND acting_role = 'SALE'
        AND effective_date > original_date
    ),
    1, 0
), 'W1-W2 不允许减量；销售不允许推迟 W1-W2'
FROM temp_v2_submit_effective;

-- 日期只允许整周吸附，最多前后两周，不得早于今天或拖出当前 W1-W7 窗口。
INSERT INTO temp_v2_submit_guard
SELECT 100, 'DATE_BOUNDARY', IF(
    ABS(DATEDIFF(effective_date, original_date)) <= 14
    AND MOD(ABS(DATEDIFF(effective_date, original_date)), 7) = 0
    AND effective_date >= CURDATE()
    AND FLOOR(DATEDIFF(effective_date, @v2_run_monday) / 7) BETWEEN 1 AND 7,
    1, 0
), '发货日期必须按整周吸附、在原日期前后 14 天内，且不能早于今天或移出 W1-W7'
FROM temp_v2_submit_effective;

SELECT
    plan_id,
    asin,
    country,
    shop,
    effective_number,
    effective_add_date
INTO
    @v2_submit_plan_id,
    @v2_submit_asin,
    @v2_submit_country,
    @v2_submit_shop,
    @v2_submit_effective_number,
    @v2_submit_effective_add_date
FROM temp_v2_submit_effective;

-- 安全闸输入：今天起完整、连续的区域合计事实链。
CREATE TEMPORARY TABLE temp_v2_submit_scope AS
SELECT
    ds.asin,
    ds.country,
    ds.shop,
    DATE(ds.`date`) AS `date`,
    CASE
        WHEN DATE(ds.`date`) = CURDATE()
        THEN CAST(ds.inventory AS SIGNED) - CAST(COALESCE(ds.`add`, 0) AS SIGNED)
        ELSE CAST(ds.inventory AS SIGNED)
    END AS actual_inventory,
    CAST(COALESCE(ds.maybe_sales, 0) AS SIGNED) AS demand,
    ds.weighted_sales,
    ds.v2_days_for_sale AS baseline_days
FROM daily_sales AS ds
INNER JOIN temp_v2_submit_effective AS effective
    ON effective.asin = ds.asin
   AND effective.country = ds.country
   AND effective.shop = ds.shop
WHERE DATE(ds.`date`) >= CURDATE();

ALTER TABLE temp_v2_submit_scope
    ADD UNIQUE INDEX idx_v2_submit_scope (asin, country, shop, `date`);

INSERT INTO temp_v2_submit_guard
SELECT 110, 'PROJECTION_SCOPE_EXISTS', IF(COUNT(*) > 0, 1, 0),
       '目标区域没有今天及未来的 daily_sales 合计水位链'
FROM temp_v2_submit_scope;

INSERT INTO temp_v2_submit_guard
SELECT 120, 'BASELINE_COMPLETE', IF(COUNT(*) = 0, 1, 0),
       '目标区域合计行的真实库存或 v2_days_for_sale 基线未初始化'
FROM temp_v2_submit_scope
WHERE actual_inventory IS NULL OR baseline_days IS NULL;

INSERT INTO temp_v2_submit_guard
SELECT 130, 'DATE_CHAIN_COMPLETE', IF(COUNT(*) = 0, 1, 0),
       '目标区域合计行的 daily_sales 日期链不连续'
FROM (
    SELECT `date`, LAG(`date`) OVER (ORDER BY `date`) AS previous_date
    FROM temp_v2_submit_scope
) AS ordered_scope
WHERE previous_date IS NOT NULL AND DATEDIFF(`date`, previous_date) <> 1;

-- 拟议补货 = 真实未入库 + 全部 v2 计划，其中仅替换目标 plan_id 的数量和到货日。
CREATE TEMPORARY TABLE temp_v2_submit_supply AS
WITH real_shipment AS (
    SELECT
        '合计' AS shop,
        dn.country,
        dn.asin,
        DATE(COALESCE(
            NULLIF(TRIM(dn.estimated_arrival_date), ''),
            DATE_ADD(
                DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                INTERVAL IFNULL(ttw.days, 0) DAY
            )
        )) AS expected_storage_time,
        SUM(dn.quantity_shipped) AS qty_shipped,
        SUM(COALESCE(fs.received, 0)) AS received,
        0 AS simulated_quantity
    FROM delivery_note AS dn
    LEFT JOIN channel_lead_time AS clt
        ON TRIM(UPPER(dn.logistics_provider_name)) = TRIM(UPPER(clt.logistics_provider))
       AND TRIM(UPPER(dn.logistics_channel_name)) = TRIM(UPPER(clt.channel))
    LEFT JOIN time_to_warehouse AS ttw
        ON TRIM(UPPER(dn.country)) = TRIM(UPPER(ttw.country))
       AND (CASE
            WHEN DATE_FORMAT(DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY), '%m-%d')
                    BETWEEN '06-10' AND '07-10'
              OR DATE_FORMAT(DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY), '%m-%d')
                    BETWEEN '09-10' AND '10-10'
              OR DATE_FORMAT(DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY), '%m-%d')
                    BETWEEN '11-01' AND '12-15'
            THEN '旺季' ELSE '淡季' END) = ttw.season
    LEFT JOIN (
        SELECT shippment_id, msku, `apply`, SUM(received) AS received
        FROM fba_ship GROUP BY shippment_id, msku, `apply`
    ) AS fs
        ON fs.shippment_id = dn.shipment_id
       AND fs.msku = dn.msku
       AND fs.`apply` = dn.quantity_shipped
    WHERE dn.asin = @v2_submit_asin
      AND dn.country = @v2_submit_country
      AND (TRIM(dn.status) = '已发货'
        OR (TRIM(dn.status) = '待配货' AND COALESCE(fs.received, 0) > 0))
      AND (TRIM(dn.state) <> '已索赔' OR dn.state IS NULL)
    GROUP BY dn.country, dn.asin,
        DATE(COALESCE(
            NULLIF(TRIM(dn.estimated_arrival_date), ''),
            DATE_ADD(
                DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                INTERVAL IFNULL(ttw.days, 0) DAY
            )
        )), dn.shipment_id
),
simulated_shipment AS (
    SELECT
        sim.shop,
        sim.country,
        sim.asin,
        CAST(
            CASE
                WHEN sim.id = @v2_submit_plan_id THEN @v2_submit_effective_add_date
                ELSE DATE(sim.add_date)
            END
            AS DATE
        ) AS expected_storage_time,
        0 AS qty_shipped,
        0 AS received,
        CASE WHEN sim.id = @v2_submit_plan_id THEN @v2_submit_effective_number ELSE COALESCE(sim.number, 0) END
            AS simulated_quantity
    FROM simulate_shipment AS sim
    WHERE sim.asin = @v2_submit_asin
      AND sim.country = @v2_submit_country
      AND sim.shop = @v2_submit_shop
      AND sim.plan_source = 'shipment_plan_v2'
      AND (
            sim.shippment_id IS NULL OR sim.shippment_id = ''
            OR NOT EXISTS (
                SELECT 1
                FROM delivery_note AS dn
                WHERE TRIM(UPPER(dn.shipment_id)) = TRIM(UPPER(sim.shippment_id))
                  AND TRIM(UPPER(dn.asin)) = TRIM(UPPER(sim.asin))
                  AND (TRIM(dn.status) = '已发货'
                    OR (TRIM(dn.status) = '待配货' AND EXISTS (
                        SELECT 1 FROM fba_ship AS fs2
                        WHERE fs2.shippment_id = dn.shipment_id
                          AND fs2.msku = dn.msku
                          AND fs2.`apply` = dn.quantity_shipped
                          AND COALESCE(fs2.received, 0) > 0
                    )))
                  AND (TRIM(dn.state) <> '已索赔' OR dn.state IS NULL)
            )
          )
),
all_supply AS (
    SELECT * FROM real_shipment
    UNION ALL
    SELECT * FROM simulated_shipment
)
SELECT
    shop,
    country,
    asin,
    expected_storage_time,
    CAST(SUM(qty_shipped - received + simulated_quantity) AS SIGNED) AS remaining
FROM all_supply
GROUP BY shop, country, asin, expected_storage_time
HAVING SUM(qty_shipped - received + simulated_quantity) <> 0;

ALTER TABLE temp_v2_submit_supply
    ADD INDEX idx_v2_submit_supply (asin, country, shop, expected_storage_time);

INSERT INTO temp_v2_submit_guard
SELECT 135, 'SUPPLY_KEYS_COMPLETE', IF(COUNT(*) = 0, 1, 0),
       '拟议补货存在缺失的预计到货日期'
FROM temp_v2_submit_supply
WHERE expected_storage_time IS NULL;

INSERT INTO temp_v2_submit_guard
SELECT 140, 'SUPPLY_DATES_COVERED', IF(COUNT(*) = 0, 1, 0),
       '拟议计划存在超出 daily_sales 日期范围的到货日'
FROM temp_v2_submit_supply AS supply
LEFT JOIN temp_v2_submit_scope AS scope
    ON scope.asin = supply.asin
   AND scope.country = supply.country
   AND scope.shop = supply.shop
   AND scope.`date` = supply.expected_storage_time
WHERE supply.expected_storage_time >= CURDATE()
  AND scope.`date` IS NULL;

CREATE TEMPORARY TABLE temp_v2_submit_input AS
SELECT
    scope.*,
    NULLIF(CAST(COALESCE(supply.remaining, 0) AS SIGNED), 0) AS proposed_add
FROM temp_v2_submit_scope AS scope
LEFT JOIN temp_v2_submit_supply AS supply
    ON supply.asin = scope.asin
   AND supply.country = scope.country
   AND supply.shop = scope.shop
   AND supply.expected_storage_time = scope.`date`;

ALTER TABLE temp_v2_submit_input
    ADD UNIQUE INDEX idx_v2_submit_input (asin, country, shop, `date`);

-- MySQL 8 对同一 TEMP 表在递归 CTE 的 anchor 与 recursive member 中重复打开会报
-- Can't reopen table，因此使用两个独立物理副本。
CREATE TEMPORARY TABLE temp_v2_submit_seed AS
SELECT * FROM temp_v2_submit_input WHERE `date` = CURDATE();

CREATE TEMPORARY TABLE temp_v2_submit_recursive_source AS
SELECT * FROM temp_v2_submit_input WHERE `date` > CURDATE();

ALTER TABLE temp_v2_submit_recursive_source
    ADD UNIQUE INDEX idx_v2_submit_recursive_source (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_submit_projection AS
WITH RECURSIVE projection AS (
    SELECT
        input.asin,
        input.country,
        input.shop,
        input.`date`,
        CAST(input.actual_inventory + COALESCE(input.proposed_add, 0) AS SIGNED) AS calc_inventory,
        input.demand
    FROM temp_v2_submit_seed AS input

    UNION ALL

    SELECT
        input.asin,
        input.country,
        input.shop,
        input.`date`,
        CAST(
            previous.calc_inventory
            - previous.demand
            + COALESCE(input.proposed_add, 0)
            AS SIGNED
        ) AS calc_inventory,
        input.demand
    FROM temp_v2_submit_recursive_source AS input
    INNER JOIN projection AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.`date` = DATE_ADD(previous.`date`, INTERVAL 1 DAY)
)
SELECT * FROM projection;

INSERT INTO temp_v2_submit_guard
SELECT 150, 'RECURSION_COMPLETE', IF(
    (SELECT COUNT(*) FROM temp_v2_submit_projection)
    = (SELECT COUNT(*) FROM temp_v2_submit_input),
    1, 0
), '拟议计划库存递推未覆盖完整日期链';

CREATE TEMPORARY TABLE temp_v2_submit_risk AS
SELECT
    input.`date`,
    CAST(input.baseline_days AS SIGNED) AS baseline_days,
    CAST(CASE
        WHEN projection.calc_inventory <= 0 THEN 0
        WHEN input.weighted_sales > 0 THEN FLOOR(projection.calc_inventory / input.weighted_sales)
        ELSE 0
    END AS SIGNED) AS proposal_days
FROM temp_v2_submit_input AS input
INNER JOIN temp_v2_submit_projection AS projection
    ON projection.asin = input.asin
   AND projection.country = input.country
   AND projection.shop = input.shop
   AND projection.`date` = input.`date`;

ALTER TABLE temp_v2_submit_risk
    ADD COLUMN baseline_risk INT NULL,
    ADD COLUMN proposal_risk INT NULL;

UPDATE temp_v2_submit_risk
SET
    baseline_risk = CASE
        WHEN baseline_days < 7 THEN 7 - baseline_days
        WHEN baseline_days > 14 THEN baseline_days - 14
        ELSE 0
    END,
    proposal_risk = CASE
        WHEN proposal_days < 7 THEN 7 - proposal_days
        WHEN proposal_days > 14 THEN proposal_days - 14
        ELSE 0
    END;

CREATE TEMPORARY TABLE temp_v2_submit_gate_summary AS
SELECT
    MAX(proposal_risk - baseline_risk) AS max_risk_delta,
    CASE
        WHEN SUM(proposal_risk > baseline_risk) = 0 THEN 1
        ELSE 0
    END AS is_safe_or_not_worse
FROM temp_v2_submit_risk;

DROP TEMPORARY TABLE IF EXISTS temp_v2_submit_guard_summary;
CREATE TEMPORARY TABLE temp_v2_submit_guard_summary AS
SELECT
    CASE WHEN SUM(guard_value = 0) = 0 THEN 1 ELSE 0 END AS allow,
    SUBSTRING_INDEX(
        GROUP_CONCAT(
            CASE WHEN guard_value = 0 THEN error_message END
            ORDER BY guard_order SEPARATOR '；'
        ),
        '；',
        1
    ) AS error_message
FROM temp_v2_submit_guard;

CREATE TEMPORARY TABLE temp_v2_submit_output AS
SELECT
    guard.allow,
    guard.error_message,
    effective.request_uuid,
    effective.bundle_id,
    effective.plan_id,
    effective.asin,
    effective.country,
    effective.shop,
    CONCAT('W', effective.week_no) AS week_code,
    effective.change_kind,
    effective.original_number,
    effective.effective_number AS proposed_number,
    effective.original_date,
    effective.effective_date AS proposed_date,
    effective.original_channel,
    effective.effective_channel AS proposed_channel,
    effective.reason_type,
    effective.reason,
    CASE WHEN guard.allow = 0 THEN NULL ELSE CASE
        WHEN effective.week_no BETWEEN 1 AND 2 THEN 'NOT_APPLICABLE'
        WHEN effective.is_new_product = 1 THEN 'OUT'
        WHEN gate.is_safe_or_not_worse = 1 THEN 'SAFE_OR_NOT_WORSE'
        ELSE 'OUT'
    END END AS gate_result,
    CASE WHEN guard.allow = 0 THEN NULL ELSE CASE
        WHEN effective.acting_role = 'OPS' AND effective.week_no BETWEEN 1 AND 2
            THEN 'APPLY_PENDING'
        WHEN effective.week_no BETWEEN 1 AND 2
            THEN 'PENDING_SUPERVISOR'
        WHEN effective.week_no BETWEEN 3 AND 5
         AND effective.is_new_product = 0
         AND gate.is_safe_or_not_worse = 1 THEN 'APPLY_PENDING'
        WHEN effective.week_no BETWEEN 3 AND 5
            THEN 'PENDING_SUPERVISOR'
        WHEN effective.week_no BETWEEN 6 AND 7
         AND effective.is_new_product = 0
         AND gate.is_safe_or_not_worse = 1 THEN 'APPLY_PENDING'
        ELSE 'PENDING_PROCUREMENT'
    END END AS status,
    0 AS row_version,
    effective.actor_user_id AS requester_user_id,
    effective.actor_username AS requester_username,
    effective.actor_department AS requester_department,
    effective.sale_owner,
    effective.product_label,
    CASE WHEN guard.allow = 0 THEN 'BLOCKED' ELSE CASE
        WHEN effective.acting_role = 'OPS' AND effective.week_no BETWEEN 1 AND 2 THEN 'PENDING'
        WHEN effective.week_no >= 3
         AND effective.is_new_product = 0
         AND gate.is_safe_or_not_worse = 1 THEN 'PENDING'
        ELSE 'WAITING_APPROVAL'
    END END AS projection_status,
    LOWER(effective.acting_role) AS acting_role,
    effective.effective_add_date AS proposed_add_date,
    effective.effective_season AS proposed_season,
    effective.warehouse_days AS proposed_warehouse_days,
    gate.max_risk_delta
FROM temp_v2_submit_effective AS effective
CROSS JOIN temp_v2_submit_gate_summary AS gate
CROSS JOIN temp_v2_submit_guard_summary AS guard;

SELECT * FROM temp_v2_submit_output;
