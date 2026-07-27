-- Formal weekly shipment_plan_v2 upsert SQL. Use only in the Monday workflow.
-- Production write with refresh guards; do not run ad hoc.
-- 发货计划演变 v2：v3.5 完整算法定时工作流候选 SQL
-- 数据库：MySQL 8.x
-- 算法标识：shipment_plan_v2
-- 本 SQL 将本周 READY 候选更新插入 simulate_shipment。
-- 已存在且未锁定的 shipment_plan_v2 记录会刷新；缺失记录会新增。
-- 入仓天数统一读取 v3_cfg_cycle_param：
--   淡季 warehouse_off；旺季 warehouse_peak。
-- 非下单周生成 A1；下单周继承上一周 A1 并生成 A2。
-- 旧记录不读取也不修改；首次从本周 W1 起算，后续边界只读取 shipment_plan_v2。
-- 服务期起点库存只读取 daily_sales.v2_inventory；空值保持候选未就绪，不回退旧 inventory。
-- 写入12个业务字段（含建议数量计算快照），并显式写入 created_at、updated_at。

START TRANSACTION;

DROP TEMPORARY TABLE IF EXISTS temp_shipment_plan_v2_weekly_candidates;
CREATE TEMPORARY TABLE temp_shipment_plan_v2_weekly_candidates (
    exact_candidate_plan_id BIGINT NULL,
    exact_candidate_active_change TINYINT NOT NULL DEFAULT 0,
    channel VARCHAR(255),
    country VARCHAR(64),
    shop VARCHAR(255),
    shop_id BIGINT NULL,
    asin VARCHAR(64),
    number INT,
    `date` DATE,
    season VARCHAR(32),
    warehouse_days INT,
    add_date DATE,
    plan_source VARCHAR(64),
    v2_calculation_snapshot JSON,
    INDEX idx_weekly_candidate_plan_id (exact_candidate_plan_id),
    INDEX idx_weekly_candidate_key (asin, country, shop, `date`, plan_source)
);

INSERT INTO temp_shipment_plan_v2_weekly_candidates (
    exact_candidate_plan_id, exact_candidate_active_change,
    channel, country, shop, shop_id, asin,
    number, `date`, season, warehouse_days, add_date, plan_source,
    v2_calculation_snapshot
)
WITH
runtime AS (
    SELECT
        CURDATE() AS snapshot_date,
        DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AS run_monday,
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

-- v3.5 / 决策 23：计划只在区域合计层生成，具体店铺由后续人工分配。
shop_seed AS (
    SELECT
        bt.asin,
        bt.country,
        bt.model,
        '合计' AS shop
    FROM base_target AS bt
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
-- 决策 29(2026-07-25):渠道与班期改读「站点选渠规则 + 渠道班期」,取站点默认慢渠道;
-- 旧 v3_cfg_logistics_lead「海运普线」不再作为老品渠道/时效源。
default_logistics AS (
    SELECT
        pol.site AS country,
        MAX(ch.channel_name) AS default_channel,
        MAX(ch.transit_days) AS logistics_days,
        MAX(ch.dispatch_frequency) AS dispatch_frequency,
        MAX(ch.dispatch_weekday) AS dispatch_weekday,
        COUNT(*) AS logistics_match_count
    FROM np_site_channel_policy AS pol
    INNER JOIN np_shipping_channel AS ch
        ON ch.channel_name = pol.slow_channel
       AND ch.enabled = 1
       AND ch.transit_days IS NOT NULL
    WHERE pol.enabled = 1
      AND pol.slow_channel IS NOT NULL
      AND TRIM(pol.slow_channel) <> ''
    GROUP BY pol.site
),
-- ===== 活动日历(决策 29 · 活动前置,2026-07-25)
-- ⚠ datetypetime 存的是【年度循环模板】:年份是占位值(2000),只有月-日有效,
--    故按"月-日 + 目标年份"展开为真实区间;只取大促与固定活动,叠加基础类型(淡季/旺季)不触发前置。
-- country 为逗号分隔多站点(如 'US,CA'),按成员匹配。
event_template AS (
    SELECT DISTINCT
        REPLACE(dt.country, ' ', '') AS country_csv,
        DATE_FORMAT(dt.startdate, '%m-%d') AS md_start,
        DATE_FORMAT(dt.enddate, '%m-%d') AS md_end
    FROM datetypetime AS dt
    WHERE dt.status = '生效中'
      AND dt.daytype_category IN ('大促BDLD', '固定活动类型')
      AND dt.startdate IS NOT NULL
      AND dt.enddate IS NOT NULL
      AND dt.country IS NOT NULL
      AND TRIM(dt.country) <> ''
),
event_year AS (
    SELECT YEAR(CURDATE()) AS y
    UNION ALL
    SELECT YEAR(CURDATE()) + 1
),
event_calendar AS (
    SELECT
        et.country_csv,
        STR_TO_DATE(CONCAT(ey.y, '-', et.md_start), '%Y-%m-%d') AS event_start,
        STR_TO_DATE(CONCAT(ey.y, '-', et.md_end), '%Y-%m-%d') AS event_end
    FROM event_template AS et
    CROSS JOIN event_year AS ey
    WHERE STR_TO_DATE(CONCAT(ey.y, '-', et.md_start), '%Y-%m-%d') IS NOT NULL
      AND STR_TO_DATE(CONCAT(ey.y, '-', et.md_end), '%Y-%m-%d') IS NOT NULL
      AND STR_TO_DATE(CONCAT(ey.y, '-', et.md_end), '%Y-%m-%d')
          >= STR_TO_DATE(CONCAT(ey.y, '-', et.md_start), '%Y-%m-%d')
),
-- 站点快渠道(方案 A:只标记建议,系统不自动换渠道)
fast_logistics AS (
    SELECT
        pol.site AS country,
        MAX(ch.channel_name) AS fast_channel,
        MAX(ch.transit_days) AS fast_days,
        COUNT(*) AS fast_match_count
    FROM np_site_channel_policy AS pol
    INNER JOIN np_shipping_channel AS ch
        ON ch.channel_name = pol.fast_channel
       AND ch.enabled = 1
       AND ch.transit_days IS NOT NULL
    WHERE pol.enabled = 1
      AND pol.fast_channel IS NOT NULL
      AND TRIM(pol.fast_channel) <> ''
    GROUP BY pol.site
),
-- 箱入数(型号 × 站点);同组多 SKU 取一致值,值不一致时 variants > 1 供快照标注。
spec_lookup AS (
    SELECT
        sp.model,
        sp.site,
        MAX(sp.units_per_box) AS units_per_box,
        COUNT(DISTINCT sp.units_per_box) AS units_per_box_variants
    FROM v3_cfg_product_spec AS sp
    WHERE sp.model IS NOT NULL AND TRIM(sp.model) <> ''
      AND sp.site IS NOT NULL AND TRIM(sp.site) <> ''
      AND sp.units_per_box IS NOT NULL AND sp.units_per_box > 0
    GROUP BY sp.model, sp.site
),
-- 发货执行约束参数(默认档;S 级名单表未建前全部走默认档)。
ship_constraint AS (
    SELECT
        COUNT(*) AS constraint_match_count,
        MAX(c.min_ship_wave_qty) AS min_ship_qty,
        MAX(c.max_boxes_per_ticket) AS max_boxes_per_ticket
    FROM v3_cfg_ship_constraint AS c
    WHERE c.enabled = 1
      AND c.level_scope LIKE '默认%'
),

-- 新算法边界只读取 shipment_plan_v2；旧模拟计划不得参与日期、数量或字段取值。
latest_v2_boundary AS (
    SELECT
        s.asin,
        s.country,
        s.shop,
        MAX(s.add_date) AS latest_add_date
    FROM simulate_shipment AS s
    CROSS JOIN run_phase AS rp
    WHERE s.plan_source = 'shipment_plan_v2'
      AND s.asin IS NOT NULL
      AND TRIM(s.asin) <> ''
      AND s.country IS NOT NULL
      AND TRIM(s.country) <> ''
      AND s.shop IS NOT NULL
      AND TRIM(s.shop) <> ''
      AND s.`date` IS NOT NULL
      AND s.add_date IS NOT NULL
      AND (
          s.created_at IS NULL
          OR s.created_at < rp.run_monday
          OR s.created_at >= DATE_ADD(rp.run_monday, INTERVAL 7 DAY)
      )
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
    CROSS JOIN run_phase AS rp
    INNER JOIN latest_v2_boundary AS lb
        ON lb.asin = s.asin
       AND lb.country = s.country
       AND lb.shop = s.shop
       AND lb.latest_add_date = s.add_date
    WHERE s.plan_source = 'shipment_plan_v2'
      AND (
          s.created_at IS NULL
          OR s.created_at < rp.run_monday
          OR s.created_at >= DATE_ADD(rp.run_monday, INTERVAL 7 DAY)
      )
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
        ss.model,
        ss.shop,
        sl.shop_id,
        sl.shop_match_count,
        CASE
            WHEN dl.default_channel IS NULL OR dl.logistics_days IS NULL THEN NULL
            WHEN dl.default_channel LIKE '%天%' THEN dl.default_channel
            ELSE CONCAT(dl.default_channel, '-', dl.logistics_days, '天')
        END AS channel,
        dl.default_channel AS channel_name,
        dl.dispatch_frequency,
        dl.dispatch_weekday,
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
        END AS candidate_ship_anchor
    FROM plan_seed AS lp
    CROSS JOIN run_phase AS rp
),
-- 决策 29:发货日对齐渠道发运班期(每周一次 → 该周指定星期;工作日班期 → 取周一)。
ship_align_raw AS (
    SELECT
        sc.*,
        DATE_ADD(
            DATE_SUB(sc.candidate_ship_anchor, INTERVAL WEEKDAY(sc.candidate_ship_anchor) DAY),
            INTERVAL CASE sc.dispatch_weekday
                WHEN 'mon' THEN 0
                WHEN 'tue' THEN 1
                WHEN 'wed' THEN 2
                WHEN 'thu' THEN 3
                WHEN 'fri' THEN 4
                ELSE 0
            END DAY
        ) AS ship_date_aligned
    FROM ship_calc AS sc
),
ship_align AS (
    SELECT
        sa.*,
        CASE
            WHEN sa.ship_date_aligned <= sa.snapshot_date
                THEN DATE_ADD(sa.ship_date_aligned, INTERVAL 7 DAY)
            ELSE sa.ship_date_aligned
        END AS candidate_ship_date
    FROM ship_align_raw AS sa
),
transport_calc AS (
    SELECT
        sc.*,
        CASE
            WHEN sc.logistics_days IS NULL THEN NULL
            ELSE DATE_ADD(sc.candidate_ship_date, INTERVAL sc.logistics_days DAY)
        END AS candidate_arrival_date
    FROM ship_align AS sc
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
warehouse_calc_passthrough AS (
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
-- ===== 活动前置判定(2026-07-25 定稿):
-- B(加厚):服务期与大促窗口重叠 → 该批目标需求由 7 天提到 14 天。
-- A(标记):到货日 > 活动开始 − 前置天数 且 <= 活动结束 → 判"晚到",给出换快渠道建议与可提前天数;
--          系统只标记不自动换渠道(换渠道 = 多付运费,由采购决定)。
service_event AS (
    SELECT
        sw.*,
        cfgl.event_lead_days,
        fl.fast_channel,
        fl.fast_days,
        (
            SELECT MIN(ec.event_start)
            FROM event_calendar AS ec
            WHERE FIND_IN_SET(sw.country, ec.country_csv) > 0
              AND ec.event_start <= DATE_ADD(sw.first_service_start_date, INTERVAL 6 DAY)
              AND ec.event_end >= sw.first_service_start_date
        ) AS first_window_event_start,
        (
            SELECT MIN(ec.event_start)
            FROM event_calendar AS ec
            WHERE sw.second_service_start_date IS NOT NULL
              AND FIND_IN_SET(sw.country, ec.country_csv) > 0
              AND ec.event_start <= DATE_ADD(sw.second_service_start_date, INTERVAL 6 DAY)
              AND ec.event_end >= sw.second_service_start_date
        ) AS second_window_event_start,
        (
            SELECT MIN(ec.event_start)
            FROM event_calendar AS ec
            WHERE sw.candidate_add_date IS NOT NULL
              AND FIND_IN_SET(sw.country, ec.country_csv) > 0
              AND ec.event_end >= sw.candidate_add_date
              AND sw.candidate_add_date
                  > DATE_SUB(ec.event_start, INTERVAL COALESCE(cfgl.event_lead_days, 7) DAY)
              AND sw.candidate_add_date <= ec.event_end
        ) AS late_event_start,
        -- B 方案:服务期与大促重叠 → 目标覆盖由 7 天延到 14 天(有界例外,冲破上限只标注不判红)
        CASE
            WHEN EXISTS (
                SELECT 1 FROM event_calendar AS ec
                WHERE FIND_IN_SET(sw.country, ec.country_csv) > 0
                  AND ec.event_start <= DATE_ADD(sw.first_service_start_date, INTERVAL 6 DAY)
                  AND ec.event_end >= sw.first_service_start_date
            ) THEN DATE_ADD(sw.first_service_start_date, INTERVAL 13 DAY)
            ELSE sw.first_service_end_date
        END AS first_service_end_effective,
        CASE
            WHEN EXISTS (
                SELECT 1 FROM event_calendar AS ec
                WHERE FIND_IN_SET(sw.country, ec.country_csv) > 0
                  AND ec.event_start <= DATE_ADD(sw.first_service_start_date, INTERVAL 6 DAY)
                  AND ec.event_end >= sw.first_service_start_date
            ) THEN 14 ELSE 7
        END AS first_window_days_expected,
        CASE
            WHEN sw.second_service_start_date IS NULL THEN NULL
            WHEN EXISTS (
                SELECT 1 FROM event_calendar AS ec
                WHERE FIND_IN_SET(sw.country, ec.country_csv) > 0
                  AND ec.event_start <= DATE_ADD(sw.second_service_start_date, INTERVAL 6 DAY)
                  AND ec.event_end >= sw.second_service_start_date
            ) THEN DATE_ADD(sw.second_service_start_date, INTERVAL 13 DAY)
            ELSE sw.second_service_end_date
        END AS second_service_end_effective,
        CASE
            WHEN sw.second_service_start_date IS NULL THEN NULL
            WHEN EXISTS (
                SELECT 1 FROM event_calendar AS ec
                WHERE FIND_IN_SET(sw.country, ec.country_csv) > 0
                  AND ec.event_start <= DATE_ADD(sw.second_service_start_date, INTERVAL 6 DAY)
                  AND ec.event_end >= sw.second_service_start_date
            ) THEN 14 ELSE 7
        END AS second_window_days_expected
    FROM warehouse_calc_passthrough AS sw
    LEFT JOIN fast_logistics AS fl
        ON fl.country = sw.country
    LEFT JOIN (
        SELECT MAX(c.event_lead_days) AS event_lead_days
        FROM v3_cfg_ship_constraint AS c
        WHERE c.enabled = 1
          AND c.level_scope LIKE '默认%'
    ) AS cfgl
        ON 1 = 1
),
demand_calc AS (
    SELECT
        sw.*,
        (
            SELECT MAX(ds.v2_inventory)
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) = sw.first_service_start_date
        ) AS inventory_at_first_service_start,
        (
            SELECT MAX(ds.v2_inventory)
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) = sw.second_service_start_date
        ) AS inventory_at_second_service_start,
        (
            SELECT SUM(COALESCE(ds.maybe_sales, ds.weighted_sales, 0))
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) BETWEEN sw.first_service_start_date AND sw.first_service_end_effective
        ) AS first_week_demand,
        (
            SELECT COUNT(DISTINCT DATE(ds.`date`))
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) BETWEEN sw.first_service_start_date AND sw.first_service_end_effective
        ) AS first_week_demand_days,
        CASE
            WHEN sw.cycle_phase = 'ORDER_WEEK' THEN (
                SELECT SUM(COALESCE(ds.maybe_sales, ds.weighted_sales, 0))
                FROM daily_sales AS ds
                WHERE ds.asin = sw.asin
                  AND ds.country = sw.country
                  AND ds.shop = sw.shop
                  AND DATE(ds.`date`) BETWEEN sw.second_service_start_date AND sw.second_service_end_effective
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
                  AND DATE(ds.`date`) BETWEEN sw.second_service_start_date AND sw.second_service_end_effective
            )
            ELSE NULL
        END AS second_week_demand_days
    FROM service_event AS sw
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
             AND dc.first_week_demand_days = dc.first_window_days_expected
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
             AND dc.first_week_demand_days = dc.first_window_days_expected
             AND dc.second_week_demand_days = dc.second_window_days_expected
             AND dc.inventory_at_first_service_start IS NOT NULL
             AND dc.inventory_at_second_service_start IS NOT NULL
                THEN CAST(
                    CEIL(
                        GREATEST(
                            0,
                            dc.second_week_demand - dc.inventory_at_second_service_start
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
        (
            SELECT exact_row.id
            FROM simulate_shipment AS exact_row
            WHERE exact_row.asin = fc.asin
              AND exact_row.country = fc.country
              AND exact_row.shop = fc.shop
              AND exact_row.`date` = fc.candidate_ship_date
              AND exact_row.plan_source = 'shipment_plan_v2'
            ORDER BY exact_row.id DESC
            LIMIT 1
        ) AS exact_candidate_plan_id,
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
            WHEN gc.first_week_demand_days <> gc.first_window_days_expected THEN 'FIRST_SERVICE_WEEK_INCOMPLETE'
            WHEN gc.cycle_phase = 'ORDER_WEEK' AND gc.second_week_demand_days <> gc.second_window_days_expected
                THEN 'SECOND_SERVICE_WEEK_INCOMPLETE'
            WHEN gc.inventory_at_first_service_start IS NULL THEN 'START_INVENTORY_MISSING'
            WHEN gc.candidate_number IS NULL THEN 'FORMULA_NOT_READY'
            WHEN gc.generated_in_run_week = 1 AND gc.exact_candidate_exists = 0 THEN 'ALREADY_GENERATED_IN_RUN_WEEK'
            ELSE 'READY'
        END AS generation_status
    FROM guard_calc AS gc
),

-- 区域层汇总。quantity_receive 和净额均是 ASIN + country 口径，不能按店铺重复求和。
-- ===== 发货执行约束层(决策 29,2026-07-25):整箱取整 → 最低发货量补足 → 拆票。
-- 顺序纪律:先算缺口(上游 candidate_number),再做执行约束,净额与区域汇总一律用约束后数量。
-- 取整余量无需显式记账:本周多发会抬高下周服务期起点库存(v2_inventory 递推),下周建议量自动少算。
box_calc AS (
    SELECT
        cr.*,
        spec.units_per_box,
        spec.units_per_box_variants,
        cst.constraint_match_count,
        cst.min_ship_qty,
        cst.max_boxes_per_ticket,
        -- 箱入数缺失或同型号站点配置了多个不同值(variants<>1)时不整箱,只标注 + 保底线,
        -- 不整箱好过不发货:缺规格的 SKU 若被拦下会整周无计划,断货风险大于装箱不齐整。
        CASE
            WHEN cr.candidate_number IS NULL THEN NULL
            WHEN cr.candidate_number <= 0 THEN cr.candidate_number
            WHEN spec.units_per_box IS NULL
              OR COALESCE(spec.units_per_box_variants, 0) <> 1 THEN cr.candidate_number
            ELSE CAST(CEIL(cr.candidate_number / spec.units_per_box) * spec.units_per_box AS SIGNED)
        END AS qty_boxed,
        -- 约束参数必须恰好命中一条有效默认档,否则最低量置 0(退回约束前行为)并由状态标出。
        CASE
            WHEN COALESCE(cst.constraint_match_count, 0) <> 1
              OR COALESCE(cst.min_ship_qty, 0) <= 0 THEN 0
            WHEN spec.units_per_box IS NULL
              OR COALESCE(spec.units_per_box_variants, 0) <> 1 THEN cst.min_ship_qty
            ELSE CAST(CEIL(cst.min_ship_qty / spec.units_per_box) * spec.units_per_box AS SIGNED)
        END AS min_qty_effective
    FROM candidate_rows AS cr
    LEFT JOIN spec_lookup AS spec
        ON spec.model = cr.model
       AND spec.site = cr.country
    LEFT JOIN ship_constraint AS cst
        ON 1 = 1
),
constrained_rows AS (
    SELECT
        bc.*,
        CASE
            WHEN bc.candidate_number IS NULL THEN NULL
            WHEN bc.candidate_number <= 0 THEN bc.candidate_number
            ELSE GREATEST(bc.qty_boxed, bc.min_qty_effective)
        END AS qty_final,
        CASE
            WHEN bc.candidate_number IS NULL THEN 'NOT_READY'
            WHEN bc.candidate_number <= 0 THEN 'NO_SHIPMENT'
            WHEN COALESCE(bc.constraint_match_count, 0) <> 1
              OR COALESCE(bc.min_ship_qty, 0) <= 0 THEN 'CONSTRAINT_CONFIG_INVALID'
            WHEN bc.units_per_box IS NULL THEN 'BOX_SIZE_MISSING'
            WHEN COALESCE(bc.units_per_box_variants, 0) <> 1 THEN 'BOX_SIZE_CONFLICT'
            WHEN bc.min_qty_effective > bc.qty_boxed THEN 'MIN_QTY_TOPPED_UP'
            WHEN bc.qty_boxed > bc.candidate_number THEN 'BOX_ROUNDED'
            ELSE 'EXACT'
        END AS constraint_status
    FROM box_calc AS bc
),

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
                ELSE cr.qty_final
            END
        ) AS region_a1_number,
        SUM(
            CASE
                WHEN cr.cycle_phase = 'ORDER_WEEK' THEN cr.qty_final
                ELSE 0
            END
        ) AS region_a2_number
    FROM constrained_rows AS cr
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
                  AND s.shop = '合计'
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
    cr.exact_candidate_plan_id,
    EXISTS (
        SELECT 1
        FROM shipment_plan_change_v2 AS ch
        WHERE ch.plan_id = cr.exact_candidate_plan_id
          AND ch.status IN (
              'PENDING_SUPERVISOR',
              'PENDING_PROCUREMENT',
              'PENDING_FINAL',
              'APPLY_PENDING',
              'APPLYING',
              'APPLIED'
          )
    ) AS exact_candidate_active_change,
    cr.channel,
    cr.country,
    cr.shop,
    NULL AS shop_id,
    cr.asin,
    cr.qty_final AS `number`,
    cr.candidate_ship_date AS `date`,
    cr.candidate_season AS season,
    cr.candidate_warehouse_days AS warehouse_days,
    cr.candidate_add_date AS add_date,
    'shipment_plan_v2' AS plan_source,
    JSON_OBJECT(
        'formula_version', 'shipment_plan_v2_weekly_v3.8_event_lead',
        'generated_at', DATE_FORMAT(NOW(3), '%Y-%m-%d %H:%i:%s.%f'),
        'cycle_phase', cr.cycle_phase,
        'generation_role', cr.generation_role,
        'service_start_date', DATE_FORMAT(cr.first_service_start_date, '%Y-%m-%d'),
        'service_end_date', DATE_FORMAT(cr.first_service_end_date, '%Y-%m-%d'),
        'second_service_start_date', DATE_FORMAT(cr.second_service_start_date, '%Y-%m-%d'),
        'second_service_end_date', DATE_FORMAT(cr.second_service_end_date, '%Y-%m-%d'),
        'first_week_demand_days', cr.first_week_demand_days,
        'second_week_demand_days', cr.second_week_demand_days,
        'first_week_demand', cr.first_week_demand,
        'second_week_demand', cr.second_week_demand,
        'target_demand', CASE
            WHEN cr.cycle_phase = 'ORDER_WEEK'
                THEN COALESCE(cr.second_week_demand, 0)
            ELSE COALESCE(cr.first_week_demand, 0)
        END,
        'raw_inventory_at_service_start', cr.inventory_at_first_service_start,
        'raw_inventory_at_second_service_start', cr.inventory_at_second_service_start,
        'inventory_excluding_a1', cr.formula_start_inventory_excluding_a1,
        'a1_committed_number', cr.a1_committed_number,
        'gap_before_ceiling', CASE
            WHEN cr.cycle_phase = 'ORDER_WEEK'
                THEN COALESCE(cr.second_week_demand, 0)
                    - cr.inventory_at_second_service_start
            ELSE COALESCE(cr.first_week_demand, 0)
                    - cr.inventory_at_first_service_start
        END,
        'suggested_number', cr.qty_final,
        'event_lead', JSON_OBJECT(
            'version', 'event_lead_v1_2026_07_25',
            'event_lead_days', cr.event_lead_days,
            'first_window_event_start', DATE_FORMAT(cr.first_window_event_start, '%Y-%m-%d'),
            'second_window_event_start', DATE_FORMAT(cr.second_window_event_start, '%Y-%m-%d'),
            'first_window_days_expected', cr.first_window_days_expected,
            'second_window_days_expected', cr.second_window_days_expected,
            'thickened', CASE WHEN cr.first_window_days_expected = 14
                              OR COALESCE(cr.second_window_days_expected, 0) = 14 THEN 1 ELSE 0 END,
            'late_event_start', DATE_FORMAT(cr.late_event_start, '%Y-%m-%d'),
            'is_late', CASE
                WHEN COALESCE(cr.qty_final, 0) <= 0 THEN 0
                WHEN cr.late_event_start IS NULL THEN 0 ELSE 1 END,
            'fast_channel', cr.fast_channel,
            'fast_days', cr.fast_days,
            'days_gain', CASE
                WHEN cr.fast_days IS NULL OR cr.logistics_days IS NULL THEN NULL
                ELSE cr.logistics_days - cr.fast_days
            END,
            'fast_add_date', CASE
                WHEN cr.fast_days IS NULL OR cr.candidate_warehouse_days IS NULL THEN NULL
                ELSE DATE_FORMAT(DATE_ADD(cr.candidate_ship_date,
                     INTERVAL (cr.fast_days + cr.candidate_warehouse_days) DAY), '%Y-%m-%d')
            END,
            'fast_fixes_late', CASE
                WHEN cr.late_event_start IS NULL THEN NULL
                WHEN cr.fast_days IS NULL OR cr.candidate_warehouse_days IS NULL THEN 0
                WHEN DATE_ADD(cr.candidate_ship_date, INTERVAL (cr.fast_days + cr.candidate_warehouse_days) DAY)
                     <= DATE_SUB(cr.late_event_start, INTERVAL COALESCE(cr.event_lead_days, 7) DAY)
                     THEN 1
                ELSE 0
            END,
            'action', CASE
                WHEN COALESCE(cr.qty_final, 0) <= 0 THEN 'NONE'  -- 零量批次不发货,不产生换渠道建议(防噪音)
                WHEN cr.late_event_start IS NULL THEN 'NONE'
                WHEN cr.fast_days IS NULL OR cr.candidate_warehouse_days IS NULL THEN 'LATE_NO_FAST_CHANNEL'
                WHEN DATE_ADD(cr.candidate_ship_date, INTERVAL (cr.fast_days + cr.candidate_warehouse_days) DAY)
                     <= DATE_SUB(cr.late_event_start, INTERVAL COALESCE(cr.event_lead_days, 7) DAY)
                     THEN 'SUGGEST_FAST_CHANNEL'
                ELSE 'LATE_FAST_NOT_ENOUGH'
            END
        ),
        'constraint_layer', JSON_OBJECT(
            'version', 'ship_constraint_v1_1_2026_07_25',
            'status', cr.constraint_status,
            'qty_before_constraint', cr.candidate_number,
            'units_per_box', cr.units_per_box,
            'units_per_box_variants', cr.units_per_box_variants,
            'qty_boxed', cr.qty_boxed,
            'constraint_match_count', cr.constraint_match_count,
            'min_ship_qty', cr.min_ship_qty,
            'min_qty_effective', cr.min_qty_effective,
            'qty_final', cr.qty_final,
            'boxes', CASE
                WHEN cr.units_per_box IS NULL
                  OR COALESCE(cr.units_per_box_variants, 0) <> 1
                  OR COALESCE(cr.qty_final, 0) <= 0 THEN NULL
                ELSE CAST(CEIL(cr.qty_final / cr.units_per_box) AS SIGNED)
            END,
            'tickets', CASE
                WHEN cr.units_per_box IS NULL
                  OR COALESCE(cr.units_per_box_variants, 0) <> 1
                  OR COALESCE(cr.max_boxes_per_ticket, 0) <= 0
                  OR COALESCE(cr.qty_final, 0) <= 0 THEN NULL
                ELSE CAST(CEIL(CEIL(cr.qty_final / cr.units_per_box) / cr.max_boxes_per_ticket) AS SIGNED)
            END,
            'max_boxes_per_ticket', cr.max_boxes_per_ticket,
            'channel_name', cr.channel_name,
            'dispatch_frequency', cr.dispatch_frequency,
            'dispatch_weekday', cr.dispatch_weekday,
            'ship_date_anchor', DATE_FORMAT(cr.candidate_ship_anchor, '%Y-%m-%d'),
            'ship_date_aligned', DATE_FORMAT(cr.candidate_ship_date, '%Y-%m-%d')
        )
    ) AS v2_calculation_snapshot
FROM constrained_rows AS cr
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

UPDATE simulate_shipment AS target
INNER JOIN temp_shipment_plan_v2_weekly_candidates AS cand
    ON cand.exact_candidate_plan_id = target.id
SET
    target.channel = cand.channel,
    target.shop_id = COALESCE(cand.shop_id, target.shop_id),
    target.number = cand.number,
    target.`date` = cand.`date`,
    target.season = cand.season,
    target.warehouse_days = cand.warehouse_days,
    target.add_date = cand.add_date,
    target.v2_calculation_snapshot = cand.v2_calculation_snapshot,
    target.updated_at = NOW(3)
WHERE target.plan_source = 'shipment_plan_v2'
  AND cand.exact_candidate_active_change = 0
  AND (target.shippment_id IS NULL OR TRIM(target.shippment_id) = '');

SET @shipment_plan_v2_weekly_updated_rows = ROW_COUNT();

INSERT INTO simulate_shipment (
    channel, country, shop, shop_id, asin,
    number, date, season, warehouse_days, add_date, plan_source, v2_calculation_snapshot,
    created_at, updated_at
)
SELECT
    cand.channel,
    cand.country,
    cand.shop,
    cand.shop_id,
    cand.asin,
    cand.number,
    cand.`date`,
    cand.season,
    cand.warehouse_days,
    cand.add_date,
    cand.plan_source,
    cand.v2_calculation_snapshot,
    NOW(3) AS created_at,
    NOW(3) AS updated_at
FROM temp_shipment_plan_v2_weekly_candidates AS cand
WHERE cand.exact_candidate_plan_id IS NULL;

SET @shipment_plan_v2_weekly_inserted_rows = ROW_COUNT();

SELECT
    @shipment_plan_v2_weekly_updated_rows AS updated_rows,
    @shipment_plan_v2_weekly_inserted_rows AS inserted_rows;

DROP TEMPORARY TABLE IF EXISTS temp_shipment_plan_v2_weekly_candidates;
COMMIT;

-- sku_1, sid_msku and msku are intentionally not inserted.
-- Re-running refreshes unlocked v2 suggestions and inserts missing candidates.