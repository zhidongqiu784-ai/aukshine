-- 发货计划演变 v2：应用前统一安全区间闸（候选版，只读）
-- 只负责复算和阻断；不更新任何业务表。
SET SESSION cte_max_recursion_depth = 1000;
SET @v2_applycheck_change_id = CAST(:change_id AS UNSIGNED);
SET @v2_applycheck_request_gate_result = NULL;
SET @v2_applycheck_request_status = NULL;
SET @v2_applycheck_projection_status = NULL;
SET @v2_applycheck_plan_id = NULL;
SET @v2_applycheck_asin = NULL;
SET @v2_applycheck_country = NULL;
SET @v2_applycheck_shop = NULL;
SET @v2_applycheck_original_number = NULL;
SET @v2_applycheck_proposed_number = NULL;
SET @v2_applycheck_original_date = NULL;
SET @v2_applycheck_proposed_date = NULL;
SET @v2_applycheck_original_channel = NULL;
SET @v2_applycheck_proposed_channel = NULL;
SET @v2_applycheck_current_number = NULL;
SET @v2_applycheck_current_date = NULL;
SET @v2_applycheck_current_channel = NULL;
SET @v2_applycheck_plan_source = NULL;
SET @v2_applycheck_shippment_id = NULL;

SELECT
    req.gate_result, req.status, req.projection_status, req.plan_id,
    req.asin, req.country, req.shop,
    req.original_number, req.proposed_number,
    DATE(req.original_date), DATE(req.proposed_date),
    req.original_channel, req.proposed_channel,
    sim.number, DATE(sim.`date`), sim.channel, sim.plan_source, sim.shippment_id
INTO
    @v2_applycheck_request_gate_result, @v2_applycheck_request_status,
    @v2_applycheck_projection_status, @v2_applycheck_plan_id,
    @v2_applycheck_asin, @v2_applycheck_country, @v2_applycheck_shop,
    @v2_applycheck_original_number, @v2_applycheck_proposed_number,
    @v2_applycheck_original_date, @v2_applycheck_proposed_date,
    @v2_applycheck_original_channel, @v2_applycheck_proposed_channel,
    @v2_applycheck_current_number, @v2_applycheck_current_date,
    @v2_applycheck_current_channel, @v2_applycheck_plan_source,
    @v2_applycheck_shippment_id
FROM shipment_plan_change_v2 AS req
LEFT JOIN simulate_shipment AS sim ON sim.id = req.plan_id
WHERE req.id = @v2_applycheck_change_id;

SET @v2_applycheck_logistics_match_count = (
    SELECT COUNT(*) FROM v3_cfg_logistics_lead AS cfg
    WHERE cfg.site = @v2_applycheck_country
      AND CONCAT(TRIM(cfg.channel), '-', cfg.lead_days, '天') = @v2_applycheck_proposed_channel
);
SET @v2_applycheck_logistics_days = (
    SELECT MAX(cfg.lead_days) FROM v3_cfg_logistics_lead AS cfg
    WHERE cfg.site = @v2_applycheck_country
      AND CONCAT(TRIM(cfg.channel), '-', cfg.lead_days, '天') = @v2_applycheck_proposed_channel
);
SET @v2_applycheck_cycle_match_count = (
    SELECT COUNT(*) FROM v3_cfg_cycle_param AS cp WHERE cp.site = @v2_applycheck_country
);
SET @v2_applycheck_proposed_season = CASE
    WHEN DATE_FORMAT(DATE_ADD(@v2_applycheck_proposed_date, INTERVAL @v2_applycheck_logistics_days DAY), '%m-%d') BETWEEN '06-10' AND '07-10'
      OR DATE_FORMAT(DATE_ADD(@v2_applycheck_proposed_date, INTERVAL @v2_applycheck_logistics_days DAY), '%m-%d') BETWEEN '09-10' AND '10-10'
      OR DATE_FORMAT(DATE_ADD(@v2_applycheck_proposed_date, INTERVAL @v2_applycheck_logistics_days DAY), '%m-%d') BETWEEN '11-01' AND '12-15'
    THEN '旺季' ELSE '淡季'
END;
SET @v2_applycheck_warehouse_days = (
    SELECT MAX(CASE WHEN @v2_applycheck_proposed_season = '旺季' THEN cp.warehouse_peak ELSE cp.warehouse_off END)
    FROM v3_cfg_cycle_param AS cp WHERE cp.site = @v2_applycheck_country
);
SET @v2_applycheck_proposed_add_date = DATE_ADD(
    DATE_ADD(@v2_applycheck_proposed_date, INTERVAL @v2_applycheck_logistics_days DAY),
    INTERVAL @v2_applycheck_warehouse_days DAY
);
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_projection;
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_recursive_source;
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_scope;
CREATE TEMPORARY TABLE temp_v2_applycheck_scope AS
SELECT
    ds.asin, ds.country, ds.shop, DATE(ds.`date`) AS `date`,
    CASE WHEN DATE(ds.`date`) = CURDATE()
         THEN CAST(ds.inventory AS SIGNED) - CAST(COALESCE(ds.`add`, 0) AS SIGNED)
         ELSE CAST(ds.inventory AS SIGNED) END AS actual_inventory,
    CAST(COALESCE(ds.maybe_sales, 0) AS SIGNED) AS demand,
    ds.weighted_sales,
    ds.v2_days_for_sale AS baseline_days
FROM daily_sales AS ds
WHERE ds.asin = @v2_applycheck_asin
  AND ds.country = @v2_applycheck_country
  AND ds.shop = @v2_applycheck_shop
  AND DATE(ds.`date`) >= CURDATE();
-- 拟议补货 = 真实未入库 + 全部 v2 计划，其中仅替换目标 plan_id 的数量和到货日。
CREATE TEMPORARY TABLE temp_v2_applycheck_supply AS
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
    WHERE dn.asin = @v2_applycheck_asin
      AND dn.country = @v2_applycheck_country
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
                WHEN sim.id = @v2_applycheck_plan_id THEN @v2_applycheck_proposed_add_date
                ELSE DATE(sim.add_date)
            END
            AS DATE
        ) AS expected_storage_time,
        0 AS qty_shipped,
        0 AS received,
        CASE WHEN sim.id = @v2_applycheck_plan_id THEN @v2_applycheck_proposed_number ELSE COALESCE(sim.number, 0) END
            AS simulated_quantity
    FROM simulate_shipment AS sim
    WHERE sim.asin = @v2_applycheck_asin
      AND sim.country = @v2_applycheck_country
      AND sim.shop = @v2_applycheck_shop
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
CREATE TEMPORARY TABLE temp_v2_applycheck_input AS
SELECT
    scope.*,
    NULLIF(CAST(COALESCE(supply.remaining, 0) AS SIGNED), 0) AS proposed_add
FROM temp_v2_applycheck_scope AS scope
LEFT JOIN temp_v2_applycheck_supply AS supply
    ON supply.asin = scope.asin
   AND supply.country = scope.country
   AND supply.shop = scope.shop
   AND supply.expected_storage_time = scope.`date`;
-- MySQL 8 对同一 TEMP 表在递归 CTE 的 anchor 与 recursive member 中重复打开会报
-- Can't reopen table，因此使用两个独立物理副本。
CREATE TEMPORARY TABLE temp_v2_applycheck_seed AS
SELECT * FROM temp_v2_applycheck_input WHERE `date` = CURDATE();

CREATE TEMPORARY TABLE temp_v2_applycheck_recursive_source AS
SELECT * FROM temp_v2_applycheck_input WHERE `date` > CURDATE();
CREATE TEMPORARY TABLE temp_v2_applycheck_projection AS
WITH RECURSIVE projection AS (
    SELECT
        input.asin,
        input.country,
        input.shop,
        input.`date`,
        CAST(input.actual_inventory + COALESCE(input.proposed_add, 0) AS SIGNED) AS calc_inventory,
        input.demand
    FROM temp_v2_applycheck_seed AS input

    UNION ALL

    SELECT
        input.asin,
        input.country,
        input.shop,
        input.`date`,
        CAST(
            CASE
                WHEN COALESCE(input.proposed_add, 0) > 0
                 AND (previous.calc_inventory - previous.demand) < 0
                THEN input.proposed_add
                ELSE previous.calc_inventory
                    - previous.demand
                    + COALESCE(input.proposed_add, 0)
            END
            AS SIGNED
        ) AS calc_inventory,
        input.demand
    FROM temp_v2_applycheck_recursive_source AS input
    INNER JOIN projection AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.`date` = DATE_ADD(previous.`date`, INTERVAL 1 DAY)
)
SELECT * FROM projection;
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_risk;
CREATE TEMPORARY TABLE temp_v2_applycheck_risk AS
SELECT
    base.`date`, base.baseline_days, base.proposal_days,
    CASE
        WHEN base.baseline_days < 7 THEN 7 - base.baseline_days
        WHEN base.baseline_days > 14 THEN base.baseline_days - 14
        ELSE 0 END AS baseline_risk,
    CASE
        WHEN base.proposal_days < 7 THEN 7 - base.proposal_days
        WHEN base.proposal_days > 14 THEN base.proposal_days - 14
        ELSE 0 END AS proposal_risk
FROM (
    SELECT
        input.`date`,
        CAST(input.baseline_days AS SIGNED) AS baseline_days,
        CAST(CASE
            WHEN projection.calc_inventory <= 0 THEN 0
            WHEN input.weighted_sales > 0 THEN FLOOR(projection.calc_inventory / input.weighted_sales)
            ELSE 0 END AS SIGNED) AS proposal_days
    FROM temp_v2_applycheck_input AS input
    INNER JOIN temp_v2_applycheck_projection AS projection
        ON projection.asin = input.asin
       AND projection.country = input.country
       AND projection.shop = input.shop
       AND projection.`date` = input.`date`
) AS base;
DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_gate_summary;
CREATE TEMPORARY TABLE temp_v2_applycheck_gate_summary AS
SELECT
    MAX(proposal_risk - baseline_risk) AS max_risk_delta,
    CASE WHEN SUM(proposal_risk > baseline_risk) = 0 THEN 1 ELSE 0 END AS is_safe_or_not_worse
FROM temp_v2_applycheck_risk;

DROP TEMPORARY TABLE IF EXISTS temp_v2_applycheck_guard;
CREATE TEMPORARY TABLE temp_v2_applycheck_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

INSERT INTO temp_v2_applycheck_guard (guard_value)
VALUES (IF(
    @v2_applycheck_request_status = 'APPLY_PENDING'
    AND @v2_applycheck_projection_status = 'PENDING'
    AND @v2_applycheck_plan_source = 'shipment_plan_v2'
    AND @v2_applycheck_current_number <=> @v2_applycheck_original_number
    AND @v2_applycheck_current_date <=> @v2_applycheck_original_date
    AND @v2_applycheck_current_channel <=> @v2_applycheck_original_channel
    AND (@v2_applycheck_shippment_id IS NULL OR TRIM(@v2_applycheck_shippment_id) = '')
    AND @v2_applycheck_proposed_number IS NOT NULL AND @v2_applycheck_proposed_number >= 0
    AND @v2_applycheck_proposed_date IS NOT NULL
    AND @v2_applycheck_proposed_channel IS NOT NULL
    AND @v2_applycheck_logistics_match_count = 1
    AND @v2_applycheck_logistics_days IS NOT NULL
    AND @v2_applycheck_cycle_match_count = 1
    AND @v2_applycheck_warehouse_days IS NOT NULL
    AND @v2_applycheck_proposed_add_date IS NOT NULL,
    1, 0
));

INSERT INTO temp_v2_applycheck_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_applycheck_scope) > 0
    AND (SELECT COUNT(*) FROM temp_v2_applycheck_scope WHERE actual_inventory IS NULL OR baseline_days IS NULL) = 0
    AND (SELECT COUNT(*) FROM (
        SELECT `date`, LAG(`date`) OVER (ORDER BY `date`) AS previous_date
        FROM temp_v2_applycheck_scope
    ) AS chain WHERE previous_date IS NOT NULL AND DATEDIFF(`date`, previous_date) <> 1) = 0,
    1, 0
);

INSERT INTO temp_v2_applycheck_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_applycheck_supply WHERE expected_storage_time IS NULL) = 0
    AND (SELECT COUNT(*)
         FROM temp_v2_applycheck_supply AS supply
         LEFT JOIN temp_v2_applycheck_scope AS scope
           ON scope.asin = supply.asin AND scope.country = supply.country
          AND scope.shop = supply.shop AND scope.`date` = supply.expected_storage_time
         WHERE supply.expected_storage_time >= CURDATE() AND scope.`date` IS NULL) = 0
    AND (SELECT COUNT(*) FROM temp_v2_applycheck_projection)
        = (SELECT COUNT(*) FROM temp_v2_applycheck_input),
    1, 0
);

SET @v2_applycheck_current_safe = (
    SELECT is_safe_or_not_worse FROM temp_v2_applycheck_gate_summary
);
SET @v2_applycheck_current_gate_result = CASE
    WHEN @v2_applycheck_current_safe = 1 THEN 'SAFE_OR_NOT_WORSE'
    ELSE 'OUT'
END;

-- 保留审批效力：原 OUT 已人工审批；原 SAFE 必须在应用时仍 SAFE；W1-W2 继续不套自动闸。
INSERT INTO temp_v2_applycheck_guard (guard_value)
VALUES (IF(
    @v2_applycheck_request_gate_result IN ('OUT', 'NOT_APPLICABLE')
    OR (
        @v2_applycheck_request_gate_result = 'SAFE_OR_NOT_WORSE'
        AND @v2_applycheck_current_safe = 1
    ),
    1, 0
));

SELECT
    @v2_applycheck_change_id AS change_id,
    @v2_applycheck_plan_id AS plan_id,
    @v2_applycheck_request_gate_result AS submitted_gate_result,
    @v2_applycheck_current_gate_result AS current_gate_result,
    gate.max_risk_delta,
    gate.is_safe_or_not_worse
FROM temp_v2_applycheck_gate_summary AS gate;