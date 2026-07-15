-- 发货计划演变 v2：v3.5 完整算法定时工作流候选 SQL
-- 数据库：MySQL 8.x
-- 算法标识：shipment_plan_v2
-- 本 SQL 只返回本周允许创建的候选记录，不直接 INSERT。
-- 工作流须循环返回数组并调用 POST /api/simulate_shipment:create。
-- 入仓天数统一读取 v3_cfg_cycle_param：
--   淡季 warehouse_off；旺季 warehouse_peak。
-- 非下单周生成 A1；下单周继承上一周 A1 并生成 A2。
-- 旧记录不读取也不修改；首次从本周 W1 起算，后续边界只读取 shipment_plan_v2。
-- 最终输出严格限定为 simulate_shipment:create 的 11 个业务字段。

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

-- 商品基础集合严格承接“水位表一栏 SQL”：当天合计行 + 有效 ASIN，且型号必须存在。
base_target AS (
    SELECT
        ds.asin,
        ds.country,
        MAX(NULLIF(TRIM(ds.model), '')) AS model,
        MAX(COALESCE(ds.weighted_sales, 0)) AS weighted_sales,
        MAX(COALESCE(ds.quantity_receive, 0)) AS quantity_receive,
        COUNT(*) AS today_total_row_count,
        MAX(a.status) AS asin_status
    FROM daily_sales AS ds
    CROSS JOIN run_phase AS rp
    INNER JOIN asin AS a
        ON CONCAT(ds.asin, '_', ds.country) = a.`unique`
    WHERE DATE(ds.`date`) = rp.snapshot_date
      AND ds.shop = '合计'
      AND ds.asin IS NOT NULL
      AND TRIM(ds.asin) <> ''
      AND ds.country IS NOT NULL
      AND TRIM(ds.country) <> ''
      AND COALESCE(a.maintenance_level, '') <> '变体'
      AND a.status IN ('新品', '普通', '重点')
      AND EXISTS (
          SELECT 1
          FROM model AS m
          WHERE m.model = ds.model
      )
    GROUP BY ds.asin, ds.country
),
today_total_raw AS (
    SELECT
        bt.asin,
        bt.country,
        bt.model AS daily_model,
        bt.weighted_sales,
        bt.quantity_receive,
        bt.today_total_row_count,
        bt.asin_status
    FROM base_target AS bt
),
today_total_qualified AS (
    SELECT
        tr.asin,
        tr.country,
        tr.daily_model AS model,
        tr.weighted_sales,
        tr.quantity_receive,
        tr.today_total_row_count,
        tr.asin_status,
        1 AS is_eligible_receiver
    FROM today_total_raw AS tr
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
            WHEN tr.positive_receiver_count_same_model <> 1 THEN 'MULTIPLE_RECEIVERS'
            WHEN tr.weighted_sales < tr.eligible_max_weighted_sales THEN 'NOT_MAX_WEIGHTED_SALES'
            WHEN tr.today_total_row_count <> 1 THEN 'DUPLICATE_TODAY_TOTAL_ROW'
            ELSE 'PASS'
        END AS rpa_assignment_status
    FROM today_total_ranked AS tr
),

-- 店铺集合承接销量表格：当天 inventory_base 中该 ASIN + country 的真实店铺。
shop_seed AS (
    SELECT DISTINCT
        ib.asin,
        ib.country,
        ib.shop
    FROM inventory_base AS ib
    CROSS JOIN run_phase AS rp
    INNER JOIN base_target AS bt
        ON bt.asin = ib.asin
       AND bt.country = ib.country
    WHERE DATE(ib.`date`) = rp.snapshot_date
      AND ib.shop IS NOT NULL
      AND TRIM(ib.shop) <> ''
      AND ib.shop <> '合计'
),
shop_lookup AS (
    SELECT
        sp.country,
        sp.short_name AS shop,
        MAX(sp.sid) AS shop_id,
        COUNT(*) AS shop_match_count
    FROM shop AS sp
    WHERE sp.short_name IS NOT NULL
      AND TRIM(sp.short_name) <> ''
      AND sp.country IS NOT NULL
      AND TRIM(sp.country) <> ''
    GROUP BY sp.country, sp.short_name
),
default_logistics AS (
    SELECT
        cfg.site AS country,
        MAX(cfg.channel) AS default_channel,
        MAX(cfg.lead_days) AS logistics_days,
        COUNT(*) AS logistics_match_count
    FROM v3_cfg_logistics_lead AS cfg
    WHERE cfg.channel = '海运普线'
    GROUP BY cfg.site
),

-- 新算法边界只读取 shipment_plan_v2；旧模拟计划不得参与日期、数量或字段取值。
latest_v2_boundary AS (
    SELECT
        s.asin,
        s.country,
        s.shop,
        MAX(s.add_date) AS latest_add_date
    FROM simulate_shipment AS s
    WHERE s.plan_source = 'shipment_plan_v2'
      AND s.asin IS NOT NULL
      AND TRIM(s.asin) <> ''
      AND s.country IS NOT NULL
      AND TRIM(s.country) <> ''
      AND s.shop IS NOT NULL
      AND TRIM(s.shop) <> ''
      AND s.`date` IS NOT NULL
      AND s.add_date IS NOT NULL
    GROUP BY s.asin, s.country, s.shop
),
latest_v2_ranked AS (
    SELECT
        s.id,
        s.asin,
        s.country,
        s.shop,
        s.`date` AS latest_ship_date,
        s.add_date AS latest_add_date,
        s.number AS latest_row_number,
        ROW_NUMBER() OVER (
            PARTITION BY s.asin, s.country, s.shop
            ORDER BY s.`date` DESC, s.id DESC
        ) AS rn
    FROM simulate_shipment AS s
    INNER JOIN latest_v2_boundary AS lb
        ON lb.asin = s.asin
       AND lb.country = s.country
       AND lb.shop = s.shop
       AND lb.latest_add_date = s.add_date
    WHERE s.plan_source = 'shipment_plan_v2'
),
latest_v2_plan AS (
    SELECT
        lr.id,
        lr.asin,
        lr.country,
        lr.shop,
        lr.latest_ship_date,
        lr.latest_add_date,
        (
            SELECT COALESCE(SUM(COALESCE(same_day.number, 0)), 0)
            FROM simulate_shipment AS same_day
            WHERE same_day.asin = lr.asin
              AND same_day.country = lr.country
              AND same_day.shop = lr.shop
              AND same_day.`date` = lr.latest_ship_date
              AND same_day.add_date = lr.latest_add_date
              AND same_day.plan_source = 'shipment_plan_v2'
        ) AS latest_committed_number
    FROM latest_v2_ranked AS lr
    WHERE lr.rn = 1
),
plan_seed AS (
    SELECT
        ss.asin,
        ss.country,
        ss.shop,
        sl.shop_id,
        sl.shop_match_count,
        CASE
            WHEN dl.default_channel IS NULL OR dl.logistics_days IS NULL THEN NULL
            ELSE CONCAT(dl.default_channel, '-', dl.logistics_days, '天')
        END AS channel,
        dl.logistics_days,
        dl.logistics_match_count,
        lv.latest_ship_date,
        lv.latest_add_date,
        CASE WHEN lv.id IS NULL THEN NULL ELSE 'shipment_plan_v2' END AS latest_plan_source,
        COALESCE(lv.latest_committed_number, 0) AS latest_committed_number
    FROM shop_seed AS ss
    LEFT JOIN shop_lookup AS sl
        ON sl.country = ss.country
       AND sl.shop = ss.shop
    LEFT JOIN default_logistics AS dl
        ON dl.country = ss.country
    LEFT JOIN latest_v2_plan AS lv
        ON lv.asin = ss.asin
       AND lv.country = ss.country
       AND lv.shop = ss.shop
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
            WHEN lp.latest_ship_date IS NULL THEN rp.w1_start_date
            WHEN DATE_ADD(lp.latest_ship_date, INTERVAL 7 DAY) > rp.run_monday
                THEN DATE_ADD(lp.latest_ship_date, INTERVAL 7 DAY)
            ELSE DATE_ADD(
                rp.run_monday,
                INTERVAL (
                    MOD(WEEKDAY(lp.latest_ship_date) - WEEKDAY(rp.run_monday) + 6, 7) + 1
                ) DAY
            )
        END AS candidate_ship_date
    FROM plan_seed AS lp
    CROSS JOIN run_phase AS rp
),
transport_calc AS (
    SELECT
        sc.*,
        CASE
            WHEN sc.logistics_days IS NULL THEN NULL
            ELSE DATE_ADD(sc.candidate_ship_date, INTERVAL sc.logistics_days DAY)
        END AS candidate_arrival_date
    FROM ship_calc AS sc
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
        CASE
            WHEN sc.candidate_season = '旺季' THEN cp.warehouse_peak
            WHEN sc.candidate_season = '淡季' THEN cp.warehouse_off
            ELSE NULL
        END AS candidate_warehouse_days,
        CASE
            WHEN sc.candidate_arrival_date IS NULL THEN NULL
            WHEN sc.candidate_season = '旺季' AND cp.warehouse_peak IS NOT NULL
                THEN DATE_ADD(sc.candidate_arrival_date, INTERVAL cp.warehouse_peak DAY)
            WHEN sc.candidate_season = '淡季' AND cp.warehouse_off IS NOT NULL
                THEN DATE_ADD(sc.candidate_arrival_date, INTERVAL cp.warehouse_off DAY)
            ELSE NULL
        END AS candidate_add_date
    FROM season_calc AS sc
    LEFT JOIN v3_cfg_cycle_param AS cp
        ON cp.site = sc.country
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
             AND (dc.latest_add_date IS NULL OR dc.candidate_add_date > dc.latest_add_date)
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
            WHEN gc.shop_id IS NULL THEN 'SHOP_ID_MISSING'
            WHEN gc.shop_match_count <> 1 THEN 'SHOP_ID_AMBIGUOUS'
            WHEN COALESCE(gc.logistics_match_count, 0) = 0 THEN 'CHANNEL_CONFIG_MISSING'
            WHEN gc.logistics_match_count <> 1 THEN 'CHANNEL_CONFIG_DUPLICATE'
            WHEN gc.channel IS NULL OR TRIM(gc.channel) = '' THEN 'CHANNEL_MISSING'
            WHEN gc.logistics_days IS NULL THEN 'LOGISTICS_DAYS_MISSING'
            WHEN gc.candidate_warehouse_days IS NULL THEN 'WAREHOUSE_DAYS_MISSING'
            WHEN gc.candidate_add_date IS NULL THEN 'ADD_DATE_UNAVAILABLE'
            WHEN gc.latest_add_date IS NOT NULL
             AND gc.candidate_add_date <= gc.latest_add_date THEN 'ADD_DATE_NOT_AFTER_LATEST'
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
                  AND s.plan_source = 'shipment_plan_v2'
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
    cr.channel,
    cr.country,
    cr.shop,
    cr.shop_id,
    cr.asin,
    cr.candidate_number AS `number`,
    cr.candidate_ship_date AS `date`,
    cr.candidate_season AS season,
    cr.candidate_warehouse_days AS warehouse_days,
    cr.candidate_add_date AS add_date,
    'shipment_plan_v2' AS plan_source
FROM candidate_rows AS cr
INNER JOIN region_net_calc AS rn
    ON rn.asin = cr.asin
   AND rn.country = cr.country
   AND rn.snapshot_date = cr.snapshot_date
   AND rn.run_monday = cr.run_monday
WHERE cr.generation_status = 'READY'
  AND (
      cr.cycle_phase = 'NON_ORDER_WEEK'
      OR rn.region_net_status = 'READY'
  )
ORDER BY cr.country, cr.asin, cr.shop;

-- HTTP 请求节点只发送以上 11 个字段；sku_1、sid_msku、msku 不生成也不发送。
-- SQL 节点测试结果如为 [记录数组, 元数据]，循环目标必须选择第 1 项记录数组。
