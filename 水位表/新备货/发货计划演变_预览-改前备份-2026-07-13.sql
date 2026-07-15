-- 发货计划演变 v2：v3.5 完整算法诊断预览 SQL
-- 本文件只读，不直接 INSERT，也不用于 simulate_shipment:create 字段映射。
-- 数据库：MySQL 8.x
-- 算法标识：shipment_plan_v2
--
-- 业务口径：
--   1. 每周一只新增一个前沿周；2026-07-06 为下单周锚点，之后单双周交替。
--   2. 非下单周生成首周 A1；下单周读取上一周已落库的 A1，生成次周 A2。
--   3. A2 = max(0, 最新两周服务期需求 - 最新起点库存位置 - A1)。
--   4. quantity_receive 只从当天 daily_sales 的 ASIN + country + shop='合计' 读取一次。
--   5. 未交货订单余量 = quantity_receive - W1 至下单批前一周已承诺发货量。
--   6. 本期需下单净额 = max(0, A1 + A2 - 未交货订单余量)。
--   7. quantity_receive 已由 RPA 分配给同 model + country 下，status 属于
--      普通/新品/重点且 weighted_sales 最高的非变体 ASIN；本 SQL 只校验，不重新分配。
--
-- 当前数据限制：daily_sales 只有未交货总量，没有采购单预计出厂日期，故无法执行
-- “按预计出厂日 FIFO、晚到订单不得占用早期发货周”的逐单匹配。本预览按总量顺序占用，
-- 并在 factory_date_match_status 中明确标记该限制。
--
-- 验证阶段边界：仍按 ASIN + country + shop 读取现有 MAX(add_date)，只在其后生成候选；
-- 不补历史、不修改旧记录。正式切换到标准 W1-W7 窗口前，需要单独确认切换日期。

WITH
runtime AS (
    SELECT
        CURDATE() AS snapshot_date,
        DATE_ADD(
            CURDATE(),
            INTERVAL MOD(7 - WEEKDAY(CURDATE()), 7) DAY
        ) AS run_monday,
        DATE('2026-07-06') AS order_week_anchor
),
run_phase AS (
    SELECT
        r.*,
        CASE
            WHEN MOD(TIMESTAMPDIFF(WEEK, r.order_week_anchor, r.run_monday), 2) = 0
                THEN 'ORDER_WEEK'
            ELSE 'NON_ORDER_WEEK'
        END AS cycle_phase,
        DATE_ADD(r.run_monday, INTERVAL 7 DAY) AS w1_start_date
    FROM runtime AS r
),

-- ASIN 资格事实源。status 限定普通/新品/重点即排除变体等其他状态。
asin_profile AS (
    SELECT
        a.asin,
        a.country,
        MAX(NULLIF(TRIM(a.model), '')) AS asin_model,
        MAX(a.status) AS asin_status
    FROM asin AS a
    WHERE a.asin IS NOT NULL
      AND TRIM(a.asin) <> ''
      AND a.country IS NOT NULL
      AND TRIM(a.country) <> ''
    GROUP BY a.asin, a.country
),

-- 当天合计行：同一 ASIN + country 只保留一条快照，并保留重复行计数供审计。
today_total_raw AS (
    SELECT
        ds.asin,
        ds.country,
        MAX(NULLIF(TRIM(ds.model), '')) AS daily_model,
        MAX(COALESCE(ds.weighted_sales, 0)) AS weighted_sales,
        MAX(COALESCE(ds.quantity_receive, 0)) AS quantity_receive,
        COUNT(*) AS today_total_row_count
    FROM daily_sales AS ds
    CROSS JOIN run_phase AS rp
    WHERE DATE(ds.`date`) = rp.snapshot_date
      AND ds.shop = '合计'
      AND ds.asin IS NOT NULL
      AND TRIM(ds.asin) <> ''
      AND ds.country IS NOT NULL
      AND TRIM(ds.country) <> ''
    GROUP BY ds.asin, ds.country
),
today_total_qualified AS (
    SELECT
        tr.asin,
        tr.country,
        COALESCE(tr.daily_model, ap.asin_model) AS model,
        tr.weighted_sales,
        tr.quantity_receive,
        tr.today_total_row_count,
        ap.asin_status,
        CASE
            WHEN ap.asin_status IN ('普通', '新品', '重点') THEN 1
            ELSE 0
        END AS is_eligible_receiver
    FROM today_total_raw AS tr
    LEFT JOIN asin_profile AS ap
        ON ap.asin = tr.asin
       AND ap.country = tr.country
),
today_total_ranked AS (
    SELECT
        tq.*,
        MAX(
            CASE
                WHEN tq.is_eligible_receiver = 1 THEN tq.weighted_sales
                ELSE NULL
            END
        ) OVER (
            PARTITION BY tq.country, tq.model
        ) AS eligible_max_weighted_sales,
        SUM(
            CASE WHEN tq.quantity_receive > 0 THEN 1 ELSE 0 END
        ) OVER (
            PARTITION BY tq.country, tq.model
        ) AS positive_receiver_count_same_model
    FROM today_total_qualified AS tq
),
receiver_snapshot AS (
    SELECT
        tr.asin,
        tr.country,
        tr.model,
        tr.weighted_sales AS receiver_weighted_sales,
        tr.eligible_max_weighted_sales,
        tr.quantity_receive,
        tr.today_total_row_count,
        tr.asin_status,
        tr.is_eligible_receiver,
        tr.positive_receiver_count_same_model,
        CASE
            WHEN tr.quantity_receive <= 0 THEN 'NO_OPEN_ORDER'
            WHEN tr.model IS NULL THEN 'MODEL_MISSING'
            WHEN tr.is_eligible_receiver = 0 THEN 'ASIN_STATUS_INELIGIBLE'
            WHEN tr.positive_receiver_count_same_model <> 1 THEN 'MULTIPLE_RECEIVERS'
            WHEN tr.weighted_sales < tr.eligible_max_weighted_sales THEN 'NOT_MAX_WEIGHTED_SALES'
            WHEN tr.today_total_row_count <> 1 THEN 'DUPLICATE_TODAY_TOTAL_ROW'
            ELSE 'PASS'
        END AS rpa_assignment_status
    FROM today_total_ranked AS tr
),

-- 严格按 ASIN + country + shop 的 MAX(add_date) 找边界，再选该边界的最新模板。
latest_boundary AS (
    SELECT
        s.asin,
        s.country,
        s.shop,
        MAX(s.add_date) AS latest_add_date
    FROM simulate_shipment AS s
    WHERE s.asin IS NOT NULL
      AND TRIM(s.asin) <> ''
      AND s.country IS NOT NULL
      AND TRIM(s.country) <> ''
      AND s.shop IS NOT NULL
      AND TRIM(s.shop) <> ''
      AND s.shop <> '合计'
      AND s.`date` IS NOT NULL
      AND s.add_date IS NOT NULL
    GROUP BY s.asin, s.country, s.shop
),
latest_ranked AS (
    SELECT
        s.id,
        s.asin,
        s.country,
        s.shop,
        s.shop_id,
        s.channel,
        s.msku,
        s.sid_msku,
        s.sku_1,
        s.`date` AS latest_ship_date,
        s.add_date AS latest_add_date,
        s.plan_source AS latest_plan_source,
        s.number AS latest_row_number,
        ROW_NUMBER() OVER (
            PARTITION BY s.asin, s.country, s.shop
            ORDER BY s.`date` DESC, s.id DESC
        ) AS rn
    FROM simulate_shipment AS s
    INNER JOIN latest_boundary AS lb
        ON lb.asin = s.asin
       AND lb.country = s.country
       AND lb.shop = s.shop
       AND lb.latest_add_date = s.add_date
),
latest_plan AS (
    SELECT
        lr.id,
        lr.asin,
        lr.country,
        lr.shop,
        lr.shop_id,
        lr.channel,
        lr.msku,
        lr.sid_msku,
        lr.sku_1,
        lr.latest_ship_date,
        lr.latest_add_date,
        lr.latest_plan_source,
        (
            SELECT COALESCE(SUM(COALESCE(same_day.number, 0)), 0)
            FROM simulate_shipment AS same_day
            WHERE same_day.asin = lr.asin
              AND same_day.country = lr.country
              AND same_day.shop = lr.shop
              AND same_day.`date` = lr.latest_ship_date
              AND same_day.add_date = lr.latest_add_date
        ) AS latest_committed_number
    FROM latest_ranked AS lr
    WHERE lr.rn = 1
),
ship_calc AS (
    SELECT
        lp.*,
        rp.snapshot_date,
        rp.run_monday,
        rp.order_week_anchor,
        rp.cycle_phase,
        rp.w1_start_date,
        CASE
            WHEN DATE_ADD(lp.latest_ship_date, INTERVAL 7 DAY) > rp.run_monday
                THEN DATE_ADD(lp.latest_ship_date, INTERVAL 7 DAY)
            ELSE DATE_ADD(
                rp.run_monday,
                INTERVAL (
                    MOD(WEEKDAY(lp.latest_ship_date) - WEEKDAY(rp.run_monday) + 6, 7) + 1
                ) DAY
            )
        END AS candidate_ship_date
    FROM latest_plan AS lp
    CROSS JOIN run_phase AS rp
),
transport_calc AS (
    SELECT
        sc.*,
        ld.days AS logistics_days,
        CASE
            WHEN ld.days IS NULL THEN NULL
            ELSE DATE_ADD(sc.candidate_ship_date, INTERVAL ld.days DAY)
        END AS candidate_arrival_date
    FROM ship_calc AS sc
    LEFT JOIN logistics_days AS ld
        ON ld.logistics_days = sc.channel
),
season_calc AS (
    SELECT
        tc.*,
        CASE
            WHEN tc.candidate_arrival_date IS NULL THEN NULL
            WHEN DATE_FORMAT(tc.candidate_arrival_date, '%m-%d') BETWEEN '06-10' AND '07-10'
              OR DATE_FORMAT(tc.candidate_arrival_date, '%m-%d') BETWEEN '09-10' AND '10-10'
              OR DATE_FORMAT(tc.candidate_arrival_date, '%m-%d') BETWEEN '11-01' AND '12-15'
                THEN '旺季'
            ELSE '淡季'
        END AS candidate_season
    FROM transport_calc AS tc
),
warehouse_calc AS (
    SELECT
        sc.*,
        ttw.days AS candidate_warehouse_days,
        CASE
            WHEN sc.candidate_arrival_date IS NULL OR ttw.days IS NULL THEN NULL
            ELSE DATE_ADD(sc.candidate_arrival_date, INTERVAL ttw.days DAY)
        END AS candidate_add_date
    FROM season_calc AS sc
    LEFT JOIN time_to_warehouse AS ttw
        ON ttw.country = sc.country
       AND ttw.season = sc.candidate_season
),
service_window AS (
    SELECT
        wc.*,
        CASE
            WHEN wc.cycle_phase = 'ORDER_WEEK'
                THEN DATE_ADD(wc.latest_add_date, INTERVAL 7 DAY)
            ELSE DATE_ADD(wc.candidate_add_date, INTERVAL 7 DAY)
        END AS first_service_start_date,
        CASE
            WHEN wc.cycle_phase = 'ORDER_WEEK'
                THEN DATE_ADD(wc.latest_add_date, INTERVAL 13 DAY)
            ELSE DATE_ADD(wc.candidate_add_date, INTERVAL 13 DAY)
        END AS first_service_end_date,
        CASE
            WHEN wc.cycle_phase = 'ORDER_WEEK'
                THEN DATE_ADD(wc.candidate_add_date, INTERVAL 7 DAY)
            ELSE NULL
        END AS second_service_start_date,
        CASE
            WHEN wc.cycle_phase = 'ORDER_WEEK'
                THEN DATE_ADD(wc.candidate_add_date, INTERVAL 13 DAY)
            ELSE NULL
        END AS second_service_end_date,
        CASE
            WHEN wc.cycle_phase = 'ORDER_WEEK' THEN wc.latest_ship_date
            ELSE wc.candidate_ship_date
        END AS batch_first_ship_date
    FROM warehouse_calc AS wc
),
demand_calc AS (
    SELECT
        sw.*,
        (
            SELECT MAX(ds.inventory)
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) = sw.first_service_start_date
        ) AS inventory_at_first_service_start,
        (
            SELECT SUM(COALESCE(ds.maybe_sales, ds.weighted_sales, 0))
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) BETWEEN sw.first_service_start_date AND sw.first_service_end_date
        ) AS first_week_demand,
        (
            SELECT COUNT(DISTINCT DATE(ds.`date`))
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) BETWEEN sw.first_service_start_date AND sw.first_service_end_date
        ) AS first_week_demand_days,
        CASE
            WHEN sw.cycle_phase = 'ORDER_WEEK' THEN (
                SELECT SUM(COALESCE(ds.maybe_sales, ds.weighted_sales, 0))
                FROM daily_sales AS ds
                WHERE ds.asin = sw.asin
                  AND ds.country = sw.country
                  AND ds.shop = sw.shop
                  AND DATE(ds.`date`) BETWEEN sw.second_service_start_date AND sw.second_service_end_date
            )
            ELSE NULL
        END AS second_week_demand,
        CASE
            WHEN sw.cycle_phase = 'ORDER_WEEK' THEN (
                SELECT COUNT(DISTINCT DATE(ds.`date`))
                FROM daily_sales AS ds
                WHERE ds.asin = sw.asin
                  AND ds.country = sw.country
                  AND ds.shop = sw.shop
                  AND DATE(ds.`date`) BETWEEN sw.second_service_start_date AND sw.second_service_end_date
            )
            ELSE NULL
        END AS second_week_demand_days
    FROM service_window AS sw
),
formula_calc AS (
    SELECT
        dc.*,
        CASE
            WHEN dc.cycle_phase = 'ORDER_WEEK'
                THEN dc.inventory_at_first_service_start - dc.latest_committed_number
            ELSE dc.inventory_at_first_service_start
        END AS formula_start_inventory_excluding_a1,
        CASE
            WHEN dc.cycle_phase = 'ORDER_WEEK'
                THEN COALESCE(dc.first_week_demand, 0) + COALESCE(dc.second_week_demand, 0)
            ELSE dc.first_week_demand
        END AS latest_demand,
        CASE
            WHEN dc.cycle_phase = 'ORDER_WEEK' THEN dc.latest_committed_number
            ELSE NULL
        END AS a1_committed_number,
        CASE
            WHEN dc.cycle_phase = 'NON_ORDER_WEEK'
             AND dc.logistics_days IS NOT NULL
             AND dc.candidate_warehouse_days IS NOT NULL
             AND dc.candidate_add_date > dc.latest_add_date
             AND dc.first_week_demand_days = 7
             AND dc.inventory_at_first_service_start IS NOT NULL
                THEN CAST(
                    CEIL(
                        GREATEST(
                            0,
                            dc.first_week_demand - dc.inventory_at_first_service_start
                        )
                    ) AS SIGNED
                )
            WHEN dc.cycle_phase = 'ORDER_WEEK'
             AND dc.latest_plan_source = 'shipment_plan_v2'
             AND dc.logistics_days IS NOT NULL
             AND dc.candidate_warehouse_days IS NOT NULL
             AND dc.candidate_add_date > dc.latest_add_date
             AND dc.first_week_demand_days = 7
             AND dc.second_week_demand_days = 7
             AND dc.inventory_at_first_service_start IS NOT NULL
                THEN CAST(
                    CEIL(
                        GREATEST(
                            0,
                            (
                                dc.first_week_demand + dc.second_week_demand
                            )
                            - (
                                dc.inventory_at_first_service_start - dc.latest_committed_number
                            )
                            - dc.latest_committed_number
                        )
                    ) AS SIGNED
                )
            ELSE NULL
        END AS candidate_number,
        CASE
            WHEN dc.cycle_phase = 'ORDER_WEEK'
                THEN (
                    COALESCE(dc.first_week_demand, 0) + COALESCE(dc.second_week_demand, 0)
                ) - (
                    dc.inventory_at_first_service_start - dc.latest_committed_number
                )
            ELSE NULL
        END AS n2_unfloored,
        CASE
            WHEN dc.cycle_phase = 'ORDER_WEEK'
             AND dc.inventory_at_first_service_start IS NOT NULL
             AND dc.first_week_demand IS NOT NULL
                THEN dc.latest_committed_number
                     - GREATEST(
                         0,
                         dc.first_week_demand
                         - (dc.inventory_at_first_service_start - dc.latest_committed_number)
                     )
            ELSE NULL
        END AS a1_commitment_deviation
    FROM demand_calc AS dc
),
guard_calc AS (
    SELECT
        fc.*,
        EXISTS (
            SELECT 1
            FROM simulate_shipment AS exact_row
            WHERE exact_row.asin = fc.asin
              AND exact_row.country = fc.country
              AND exact_row.shop = fc.shop
              AND exact_row.`date` = fc.candidate_ship_date
              AND exact_row.plan_source = 'shipment_plan_v2'
        ) AS exact_candidate_exists,
        EXISTS (
            SELECT 1
            FROM simulate_shipment AS weekly_guard
            WHERE weekly_guard.asin = fc.asin
              AND weekly_guard.country = fc.country
              AND weekly_guard.shop = fc.shop
              AND weekly_guard.plan_source = 'shipment_plan_v2'
              AND weekly_guard.created_at >= fc.run_monday
              AND weekly_guard.created_at < DATE_ADD(fc.run_monday, INTERVAL 7 DAY)
        ) AS generated_in_run_week
    FROM formula_calc AS fc
),
candidate_rows AS (
    SELECT
        gc.*,
        CASE
            WHEN gc.cycle_phase = 'ORDER_WEEK' THEN 'A2_SECOND_WEEK'
            ELSE 'A1_FIRST_WEEK'
        END AS generation_role,
        CASE
            WHEN gc.channel IS NULL OR TRIM(gc.channel) = '' THEN 'CHANNEL_MISSING'
            WHEN gc.logistics_days IS NULL THEN 'LOGISTICS_DAYS_MISSING'
            WHEN gc.candidate_warehouse_days IS NULL THEN 'WAREHOUSE_DAYS_MISSING'
            WHEN gc.candidate_add_date IS NULL THEN 'ADD_DATE_UNAVAILABLE'
            WHEN gc.candidate_add_date <= gc.latest_add_date THEN 'ADD_DATE_NOT_AFTER_LATEST'
            WHEN gc.cycle_phase = 'ORDER_WEEK'
             AND COALESCE(gc.latest_plan_source, '') <> 'shipment_plan_v2'
                THEN 'A1_FROM_PREVIOUS_WEEK_MISSING'
            WHEN gc.first_week_demand_days <> 7 THEN 'FIRST_SERVICE_WEEK_INCOMPLETE'
            WHEN gc.cycle_phase = 'ORDER_WEEK' AND gc.second_week_demand_days <> 7
                THEN 'SECOND_SERVICE_WEEK_INCOMPLETE'
            WHEN gc.inventory_at_first_service_start IS NULL THEN 'START_INVENTORY_MISSING'
            WHEN gc.candidate_number IS NULL THEN 'FORMULA_NOT_READY'
            WHEN gc.exact_candidate_exists = 1 THEN 'EXACT_CANDIDATE_ALREADY_EXISTS'
            WHEN gc.generated_in_run_week = 1 THEN 'ALREADY_GENERATED_IN_RUN_WEEK'
            ELSE 'READY'
        END AS generation_status
    FROM guard_calc AS gc
),

-- 区域层汇总。quantity_receive 和净额均是 ASIN + country 口径，不能按店铺重复求和。
region_candidate_rollup AS (
    SELECT
        cr.asin,
        cr.country,
        cr.snapshot_date,
        cr.run_monday,
        cr.cycle_phase,
        cr.w1_start_date,
        MIN(cr.batch_first_ship_date) AS min_batch_first_ship_date,
        MAX(cr.batch_first_ship_date) AS max_batch_first_ship_date,
        COUNT(*) AS region_candidate_shop_count,
        SUM(CASE WHEN cr.generation_status = 'READY' THEN 1 ELSE 0 END) AS region_ready_shop_count,
        SUM(
            CASE
                WHEN cr.cycle_phase = 'ORDER_WEEK' THEN cr.latest_committed_number
                ELSE cr.candidate_number
            END
        ) AS region_a1_number,
        SUM(
            CASE
                WHEN cr.cycle_phase = 'ORDER_WEEK' THEN cr.candidate_number
                ELSE 0
            END
        ) AS region_a2_number
    FROM candidate_rows AS cr
    GROUP BY
        cr.asin,
        cr.country,
        cr.snapshot_date,
        cr.run_monday,
        cr.cycle_phase,
        cr.w1_start_date
),
region_order_calc AS (
    SELECT
        rr.*,
        CASE
            WHEN rr.min_batch_first_ship_date = rr.max_batch_first_ship_date THEN 1
            ELSE 0
        END AS batch_week_aligned,
        CASE
            WHEN rr.min_batch_first_ship_date = rr.max_batch_first_ship_date THEN (
                SELECT COALESCE(SUM(GREATEST(COALESCE(s.number, 0), 0)), 0)
                FROM simulate_shipment AS s
                WHERE s.asin = rr.asin
                  AND s.country = rr.country
                  AND s.shop IS NOT NULL
                  AND s.shop <> '合计'
                  AND s.`date` >= rr.w1_start_date
                  AND s.`date` < rr.min_batch_first_ship_date
            )
            ELSE NULL
        END AS earlier_committed_number
    FROM region_candidate_rollup AS rr
),
region_net_calc AS (
    SELECT
        ro.*,
        rs.model AS receiver_model,
        rs.receiver_weighted_sales,
        rs.eligible_max_weighted_sales,
        rs.quantity_receive,
        rs.today_total_row_count,
        rs.asin_status,
        rs.positive_receiver_count_same_model,
        rs.rpa_assignment_status,
        CASE
            WHEN rs.asin IS NULL THEN NULL
            WHEN ro.batch_week_aligned = 0 THEN NULL
            ELSE GREATEST(
                0,
                rs.quantity_receive - ro.earlier_committed_number
            )
        END AS unfulfilled_order_remaining,
        CASE
            WHEN ro.cycle_phase <> 'ORDER_WEEK' THEN NULL
            WHEN rs.asin IS NULL THEN NULL
            WHEN ro.batch_week_aligned = 0 THEN NULL
            WHEN ro.region_ready_shop_count <> ro.region_candidate_shop_count THEN NULL
            WHEN rs.quantity_receive > 0 AND rs.rpa_assignment_status <> 'PASS' THEN NULL
            ELSE GREATEST(
                0,
                ro.region_a1_number
                + ro.region_a2_number
                - GREATEST(
                    0,
                    rs.quantity_receive - ro.earlier_committed_number
                )
            )
        END AS net_order_number,
        CASE
            WHEN rs.asin IS NULL THEN 'TODAY_TOTAL_ROW_MISSING'
            WHEN ro.batch_week_aligned = 0 THEN 'SHOP_BATCH_WEEK_NOT_ALIGNED'
            WHEN ro.region_ready_shop_count <> ro.region_candidate_shop_count THEN 'SHOP_CANDIDATE_NOT_ALL_READY'
            WHEN rs.quantity_receive > 0 AND rs.rpa_assignment_status <> 'PASS'
                THEN CONCAT('RPA_ASSIGNMENT_', rs.rpa_assignment_status)
            WHEN ro.cycle_phase <> 'ORDER_WEEK' THEN 'WAIT_FOR_ORDER_WEEK'
            ELSE 'READY'
        END AS region_net_status
    FROM region_order_calc AS ro
    LEFT JOIN receiver_snapshot AS rs
        ON rs.asin = ro.asin
       AND rs.country = ro.country
)
SELECT
    -- simulate_shipment:create 对应业务字段（预览不写入）
    cr.channel,
    cr.country,
    cr.msku,
    cr.shop,
    cr.shop_id,
    COALESCE(
        NULLIF(cr.sid_msku, ''),
        CONCAT(cr.shop, '_', cr.country, '_', cr.asin)
    ) AS sid_msku,
    cr.sku_1,
    cr.asin,
    cr.candidate_number AS `number`,
    cr.candidate_ship_date AS `date`,
    cr.candidate_season AS season,
    cr.candidate_warehouse_days AS warehouse_days,
    cr.candidate_add_date AS add_date,
    'shipment_plan_v2' AS plan_source,

    -- 本次运行与边界
    cr.snapshot_date,
    cr.run_monday,
    cr.cycle_phase,
    cr.generation_role,
    cr.generation_status,
    cr.latest_ship_date,
    cr.latest_add_date,
    cr.latest_plan_source,
    cr.latest_committed_number,

    -- A1 / A2 公式追溯
    cr.first_service_start_date,
    cr.first_service_end_date,
    cr.second_service_start_date,
    cr.second_service_end_date,
    cr.first_week_demand,
    cr.second_week_demand,
    cr.latest_demand,
    cr.inventory_at_first_service_start,
    cr.formula_start_inventory_excluding_a1,
    cr.a1_committed_number,
    cr.n2_unfloored,
    cr.a1_commitment_deviation,

    -- ASIN + country 区域净额；同一区域的每个店铺行会重复展示，只能取一次。
    'ASIN_COUNTRY_TAKE_ONCE' AS region_metric_scope,
    rn.min_batch_first_ship_date AS region_batch_first_ship_date,
    rn.batch_week_aligned,
    rn.region_candidate_shop_count,
    rn.region_ready_shop_count,
    rn.region_a1_number,
    rn.region_a2_number,
    rn.earlier_committed_number,
    rn.quantity_receive,
    rn.unfulfilled_order_remaining,
    rn.net_order_number,
    rn.region_net_status,

    -- RPA 分配审计
    rn.receiver_model,
    rn.asin_status AS receiver_asin_status,
    rn.receiver_weighted_sales,
    rn.eligible_max_weighted_sales,
    rn.positive_receiver_count_same_model,
    rn.today_total_row_count,
    rn.rpa_assignment_status,
    'AGGREGATE_ONLY_NO_FACTORY_DATE' AS factory_date_match_status
FROM candidate_rows AS cr
INNER JOIN region_net_calc AS rn
    ON rn.asin = cr.asin
   AND rn.country = cr.country
   AND rn.snapshot_date = cr.snapshot_date
   AND rn.run_monday = cr.run_monday
ORDER BY cr.country, cr.asin, cr.shop;

-- 正式工作流只允许把以下 14 个业务字段映射给 simulate_shipment:create：
-- channel, country, msku, shop, shop_id, sid_msku, sku_1, asin,
-- number, date, season, warehouse_days, add_date, plan_source
--
-- 使用正式 SQL 前还必须增加过滤：generation_status = 'READY'。
-- 本预览故意保留未就绪行，方便查看缺失数据和阻断原因。


