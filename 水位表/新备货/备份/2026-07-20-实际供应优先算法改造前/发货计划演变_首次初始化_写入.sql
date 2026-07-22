-- One-time initialization write SQL. Review the read-only candidate SQL before running.
-- Production write: run manually in DataGrip; never schedule this file.
-- 一次性首次初始化写入：保留已有 shipment_plan_v2，并补齐当前窗口 W1-W7。
-- Inserts 11 business fields plus created_at and updated_at.
-- 仅供操作人员在 DataGrip 手动执行，不得加入定时任务。

-- 发货计划演变 v2：v3.5 七周首次初始化写入 SQL
-- 数据库：MySQL 8.x
-- 算法标识：shipment_plan_v2
-- 本 SQL 将 W1-W7 中缺失的 READY 候选直接写入 simulate_shipment。
-- 使用单条 INSERT ... WITH ... SELECT 原子写入，不调用逐行接口。
-- 入仓天数统一读取 v3_cfg_cycle_param：
--   淡季 warehouse_off；旺季 warehouse_peak。
-- 非下单槽生成 A1；下单槽继承前一槽已有或本次算出的 A1 并生成 A2。
-- 精确日期已有的新算法记录只作承诺输入；旧算法记录不读取也不修改。
-- 服务期起点库存读取 daily_sales.v2_inventory，并叠加本次初始化已生成的前序周候选量；
-- 空值保持候选未就绪，不回退旧 inventory。
-- 写入11个业务字段，并显式写入 created_at、updated_at。

START TRANSACTION;

INSERT INTO simulate_shipment (
    channel, country, shop, shop_id, asin,
    number, date, season, warehouse_days, add_date, plan_source,
    created_at, updated_at
)
WITH RECURSIVE
runtime AS (
    SELECT
        CURDATE() AS snapshot_date,
        DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY) AS run_monday,
        DATE('2026-07-06') AS order_week_anchor
),
run_phase AS (
    SELECT
        r.*,
        DATE_ADD(r.run_monday, INTERVAL 7 DAY) AS w1_start_date
    FROM runtime AS r
),
week_slots (week_no) AS (
    SELECT 1
    UNION ALL
    SELECT week_no + 1
    FROM week_slots
    WHERE week_no < 7
),
run_calendar_seed AS (
    SELECT
        rp.snapshot_date,
        rp.run_monday,
        rp.order_week_anchor,
        rp.w1_start_date,
        ws.week_no,
        DATE_ADD(
            rp.run_monday,
            INTERVAL ((ws.week_no - 1) * 7) DAY
        ) AS slot_run_monday,
        DATE_ADD(
            rp.w1_start_date,
            INTERVAL ((ws.week_no - 1) * 7) DAY
        ) AS candidate_ship_date
    FROM run_phase AS rp
    CROSS JOIN week_slots AS ws
),
run_calendar AS (
    SELECT
        rcs.*,
        CASE
            WHEN MOD(
                TIMESTAMPDIFF(WEEK, rcs.order_week_anchor, rcs.slot_run_monday),
                2
            ) = 0 THEN 'ORDER_WEEK'
            ELSE 'NON_ORDER_WEEK'
        END AS cycle_phase
    FROM run_calendar_seed AS rcs
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

-- 七周初始化只在当前 W1-W7 窗口内工作；已有精确日期记录只作为承诺输入，不会重写。
existing_slot_ranked AS (
    SELECT
        rc.week_no,
        s.id,
        s.asin,
        s.country,
        s.shop,
        s.`date` AS existing_ship_date,
        s.add_date AS existing_add_date,
        s.season AS existing_season,
        s.warehouse_days AS existing_warehouse_days,
        COUNT(*) OVER (
            PARTITION BY s.asin, s.country, s.shop, s.`date`
        ) AS existing_match_count,
        SUM(COALESCE(s.number, 0)) OVER (
            PARTITION BY s.asin, s.country, s.shop, s.`date`
        ) AS existing_number,
        ROW_NUMBER() OVER (
            PARTITION BY s.asin, s.country, s.shop, s.`date`
            ORDER BY s.id DESC
        ) AS rn
    FROM simulate_shipment AS s
    INNER JOIN run_calendar AS rc
        ON s.`date` = rc.candidate_ship_date
    WHERE s.plan_source = 'shipment_plan_v2'
      AND s.asin IS NOT NULL
      AND TRIM(s.asin) <> ''
      AND s.country IS NOT NULL
      AND TRIM(s.country) <> ''
      AND s.shop IS NOT NULL
      AND TRIM(s.shop) <> ''
),
existing_slot AS (
    SELECT
        esr.week_no,
        esr.id AS existing_id,
        esr.asin,
        esr.country,
        esr.shop,
        esr.existing_ship_date,
        esr.existing_add_date,
        esr.existing_season,
        esr.existing_warehouse_days,
        esr.existing_match_count,
        esr.existing_number
    FROM existing_slot_ranked AS esr
    WHERE esr.rn = 1
),
plan_grid AS (
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
        rc.snapshot_date,
        rc.run_monday,
        rc.order_week_anchor,
        rc.w1_start_date,
        rc.week_no,
        rc.slot_run_monday,
        rc.cycle_phase,
        rc.candidate_ship_date,
        es.existing_id,
        COALESCE(es.existing_match_count, 0) AS existing_match_count,
        es.existing_number,
        es.existing_add_date,
        es.existing_season,
        es.existing_warehouse_days
    FROM shop_seed AS ss
    CROSS JOIN run_calendar AS rc
    LEFT JOIN shop_lookup AS sl
        ON sl.country = ss.country
       AND sl.shop = ss.shop
    LEFT JOIN default_logistics AS dl
        ON dl.country = ss.country
    LEFT JOIN existing_slot AS es
        ON es.asin = ss.asin
       AND es.country = ss.country
       AND es.shop = ss.shop
       AND es.week_no = rc.week_no
),
transport_calc AS (
    SELECT
        pg.*,
        CASE
            WHEN pg.logistics_days IS NULL THEN NULL
            ELSE DATE_ADD(pg.candidate_ship_date, INTERVAL pg.logistics_days DAY)
        END AS candidate_arrival_date
    FROM plan_grid AS pg
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
a1_service_window AS (
    SELECT
        wc.*,
        CAST(NULL AS DATE) AS latest_ship_date,
        CAST(NULL AS DATE) AS latest_add_date,
        CAST(NULL AS CHAR(32)) AS latest_plan_source,
        CAST(NULL AS DECIMAL(20, 4)) AS latest_committed_number,
        CAST(NULL AS CHAR(64)) AS previous_a1_status,
        DATE_ADD(wc.candidate_add_date, INTERVAL 7 DAY) AS first_service_start_date,
        DATE_ADD(wc.candidate_add_date, INTERVAL 13 DAY) AS first_service_end_date,
        CAST(NULL AS DATE) AS second_service_start_date,
        CAST(NULL AS DATE) AS second_service_end_date,
        wc.candidate_ship_date AS batch_first_ship_date
    FROM warehouse_calc AS wc
),
a1_demand_calc AS (
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
        CAST(NULL AS DECIMAL(20, 4)) AS inventory_at_second_service_start,
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
        CAST(NULL AS DECIMAL(20, 4)) AS second_week_demand,
        CAST(NULL AS UNSIGNED) AS second_week_demand_days
    FROM a1_service_window AS sw
),
a1_formula_calc AS (
    SELECT
        dc.*,
        dc.inventory_at_first_service_start AS formula_start_inventory_excluding_a1,
        dc.first_week_demand AS latest_demand,
        CAST(NULL AS DECIMAL(20, 4)) AS a1_committed_number,
        CASE
            WHEN dc.logistics_days IS NOT NULL
             AND dc.candidate_warehouse_days IS NOT NULL
             AND dc.candidate_add_date IS NOT NULL
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
            ELSE NULL
        END AS candidate_number,
        CAST(NULL AS DECIMAL(20, 4)) AS n2_unfloored,
        CAST(NULL AS DECIMAL(20, 4)) AS a1_commitment_deviation
    FROM a1_demand_calc AS dc
),
a1_supply_status AS (
    SELECT
        af.*,
        CASE
            WHEN af.existing_match_count > 1 THEN 'EXACT_CANDIDATE_DUPLICATE'
            WHEN af.existing_match_count = 1 AND af.existing_add_date IS NULL
                THEN 'EXISTING_A1_ADD_DATE_MISSING'
            WHEN af.existing_match_count = 1 THEN 'EXISTING'
            WHEN COALESCE(af.logistics_match_count, 0) = 0 THEN 'CHANNEL_CONFIG_MISSING'
            WHEN af.logistics_match_count <> 1 THEN 'CHANNEL_CONFIG_DUPLICATE'
            WHEN af.channel IS NULL OR TRIM(af.channel) = '' THEN 'CHANNEL_MISSING'
            WHEN af.logistics_days IS NULL THEN 'LOGISTICS_DAYS_MISSING'
            WHEN af.candidate_warehouse_days IS NULL THEN 'WAREHOUSE_DAYS_MISSING'
            WHEN af.candidate_add_date IS NULL THEN 'ADD_DATE_UNAVAILABLE'
            WHEN af.first_week_demand_days <> 7 THEN 'FIRST_SERVICE_WEEK_INCOMPLETE'
            WHEN af.inventory_at_first_service_start IS NULL THEN 'START_INVENTORY_MISSING'
            WHEN af.candidate_number IS NULL THEN 'FORMULA_NOT_READY'
            ELSE 'READY'
        END AS supply_status
    FROM a1_formula_calc AS af
),
slot_a1_supply AS (
    SELECT
        aps.asin,
        aps.country,
        aps.shop,
        aps.week_no,
        aps.candidate_ship_date AS supply_ship_date,
        CASE
            WHEN aps.supply_status = 'EXISTING' THEN aps.existing_add_date
            WHEN aps.supply_status = 'READY' THEN aps.candidate_add_date
            ELSE NULL
        END AS supply_add_date,
        CASE
            WHEN aps.supply_status = 'EXISTING' THEN aps.existing_number
            WHEN aps.supply_status = 'READY' THEN aps.candidate_number
            ELSE NULL
        END AS supply_number,
        CASE
            WHEN aps.supply_status IN ('EXISTING', 'READY') THEN 'shipment_plan_v2'
            ELSE NULL
        END AS supply_plan_source,
        aps.supply_status
    FROM a1_supply_status AS aps
),
prior_a1_supply AS (
    SELECT
        s.asin,
        s.country,
        s.shop,
        0 AS week_no,
        rp.run_monday AS supply_ship_date,
        CASE WHEN COUNT(*) = 1 THEN MAX(s.add_date) ELSE NULL END AS supply_add_date,
        CASE WHEN COUNT(*) = 1 THEN SUM(COALESCE(s.number, 0)) ELSE NULL END AS supply_number,
        CASE
            WHEN COUNT(*) = 1 AND MAX(s.add_date) IS NOT NULL THEN 'shipment_plan_v2'
            ELSE NULL
        END AS supply_plan_source,
        CASE
            WHEN COUNT(*) > 1 THEN 'EXACT_CANDIDATE_DUPLICATE'
            WHEN MAX(s.add_date) IS NULL THEN 'EXISTING_A1_ADD_DATE_MISSING'
            ELSE 'EXISTING'
        END AS supply_status
    FROM simulate_shipment AS s
    CROSS JOIN run_phase AS rp
    INNER JOIN shop_seed AS ss
        ON ss.asin = s.asin
       AND ss.country = s.country
       AND ss.shop = s.shop
    WHERE s.plan_source = 'shipment_plan_v2'
      AND s.`date` = rp.run_monday
    GROUP BY s.asin, s.country, s.shop, rp.run_monday
),
a1_supply AS (
    SELECT * FROM slot_a1_supply
    UNION ALL
    SELECT * FROM prior_a1_supply
),
order_service_window AS (
    SELECT
        wc.*,
        pas.supply_ship_date AS latest_ship_date,
        pas.supply_add_date AS latest_add_date,
        pas.supply_plan_source AS latest_plan_source,
        pas.supply_number AS latest_committed_number,
        pas.supply_status AS previous_a1_status,
        DATE_ADD(pas.supply_add_date, INTERVAL 7 DAY) AS first_service_start_date,
        DATE_ADD(pas.supply_add_date, INTERVAL 13 DAY) AS first_service_end_date,
        DATE_ADD(wc.candidate_add_date, INTERVAL 7 DAY) AS second_service_start_date,
        DATE_ADD(wc.candidate_add_date, INTERVAL 13 DAY) AS second_service_end_date,
        pas.supply_ship_date AS batch_first_ship_date
    FROM warehouse_calc AS wc
    LEFT JOIN a1_supply AS pas
        ON pas.asin = wc.asin
       AND pas.country = wc.country
       AND pas.shop = wc.shop
       AND pas.week_no = wc.week_no - 1
    WHERE 1 = 0
),
order_demand_calc AS (
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
        (
            SELECT SUM(COALESCE(ds.maybe_sales, ds.weighted_sales, 0))
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) BETWEEN sw.second_service_start_date AND sw.second_service_end_date
        ) AS second_week_demand,
        (
            SELECT COUNT(DISTINCT DATE(ds.`date`))
            FROM daily_sales AS ds
            WHERE ds.asin = sw.asin
              AND ds.country = sw.country
              AND ds.shop = sw.shop
              AND DATE(ds.`date`) BETWEEN sw.second_service_start_date AND sw.second_service_end_date
        ) AS second_week_demand_days
    FROM order_service_window AS sw
),
order_formula_calc AS (
    SELECT
        dc.*,
        dc.inventory_at_first_service_start - dc.latest_committed_number
            AS formula_start_inventory_excluding_a1,
        COALESCE(dc.first_week_demand, 0) + COALESCE(dc.second_week_demand, 0)
            AS latest_demand,
        dc.latest_committed_number AS a1_committed_number,
        CASE
            WHEN dc.previous_a1_status IN ('EXISTING', 'READY')
             AND dc.latest_plan_source = 'shipment_plan_v2'
             AND dc.logistics_days IS NOT NULL
             AND dc.candidate_warehouse_days IS NOT NULL
             AND dc.candidate_add_date IS NOT NULL
             AND dc.latest_add_date IS NOT NULL
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
                                dc.inventory_at_first_service_start
                                - dc.latest_committed_number
                            )
                            - dc.latest_committed_number
                        )
                    ) AS SIGNED
                )
            ELSE NULL
        END AS candidate_number,
        (
            COALESCE(dc.first_week_demand, 0) + COALESCE(dc.second_week_demand, 0)
        ) - (
            dc.inventory_at_first_service_start - dc.latest_committed_number
        ) AS n2_unfloored,
        CASE
            WHEN dc.inventory_at_first_service_start IS NOT NULL
             AND dc.first_week_demand IS NOT NULL
                THEN dc.latest_committed_number
                     - GREATEST(
                         0,
                         dc.first_week_demand
                         - (
                             dc.inventory_at_first_service_start
                             - dc.latest_committed_number
                         )
                     )
            ELSE NULL
        END AS a1_commitment_deviation
    FROM order_demand_calc AS dc
),
formula_calc AS (
    SELECT * FROM a1_formula_calc
    UNION ALL
    SELECT * FROM order_formula_calc
),
formula_sequence_calc AS (
    SELECT
        fc.*,
        @seq_same_key := IF(
            @seq_prev_key = CONCAT(fc.asin, '|', fc.country, '|', fc.shop),
            1,
            0
        ) AS seq_same_key,
        @seq_previous_candidate := IF(@seq_same_key = 1, @seq_cumulative_candidate, 0) AS seq_previous_candidate,
        @seq_service_demand := COALESCE(fc.first_week_demand, 0) AS sequential_service_demand,
        @seq_raw_inventory := fc.inventory_at_first_service_start
            AS sequential_raw_inventory_at_service_start,
        @seq_effective_inventory := CASE
            WHEN @seq_raw_inventory IS NULL THEN NULL
            ELSE @seq_raw_inventory + @seq_previous_candidate
        END AS sequential_inventory_at_service_start,
        @seq_candidate := CASE
            WHEN fc.first_week_demand_days <> 7 THEN NULL
            WHEN @seq_effective_inventory IS NULL THEN NULL
            ELSE CAST(
                CEIL(GREATEST(0, @seq_service_demand - @seq_effective_inventory))
                AS SIGNED
            )
        END AS sequential_candidate_number,
        @seq_cumulative_candidate := @seq_previous_candidate + COALESCE(@seq_candidate, 0)
            AS seq_cumulative_candidate,
        @seq_prev_key := CONCAT(fc.asin, '|', fc.country, '|', fc.shop) AS seq_set_key
    FROM (
        SELECT *
        FROM formula_calc
        ORDER BY country, asin, shop, week_no
    ) AS fc
    CROSS JOIN (
        SELECT
            @seq_prev_key := '',
            @seq_cumulative_candidate := 0,
            @seq_same_key := 0,
            @seq_previous_candidate := 0,
            @seq_service_demand := 0,
            @seq_raw_inventory := NULL,
            @seq_effective_inventory := NULL,
            @seq_candidate := NULL
    ) AS seq_vars
),
guard_calc AS (
    SELECT
        fc.*,
        CASE WHEN fc.existing_match_count > 0 THEN 1 ELSE 0 END AS exact_candidate_exists
    FROM formula_sequence_calc AS fc
),
candidate_rows AS (
    SELECT
        gc.*,
        CASE
            WHEN gc.cycle_phase = 'ORDER_WEEK' THEN 'A2_SECOND_WEEK'
            ELSE 'A1_FIRST_WEEK'
        END AS generation_role,
        CASE
            WHEN gc.existing_match_count > 1 THEN 'EXACT_CANDIDATE_DUPLICATE'
            WHEN gc.existing_match_count = 1 THEN 'EXACT_CANDIDATE_ALREADY_EXISTS'
            WHEN COALESCE(gc.logistics_match_count, 0) = 0 THEN 'CHANNEL_CONFIG_MISSING'
            WHEN gc.logistics_match_count <> 1 THEN 'CHANNEL_CONFIG_DUPLICATE'
            WHEN gc.channel IS NULL OR TRIM(gc.channel) = '' THEN 'CHANNEL_MISSING'
            WHEN gc.logistics_days IS NULL THEN 'LOGISTICS_DAYS_MISSING'
            WHEN gc.candidate_warehouse_days IS NULL THEN 'WAREHOUSE_DAYS_MISSING'
            WHEN gc.candidate_add_date IS NULL THEN 'ADD_DATE_UNAVAILABLE'
            WHEN gc.first_week_demand_days <> 7 THEN 'FIRST_SERVICE_WEEK_INCOMPLETE'
            WHEN gc.inventory_at_first_service_start IS NULL
                THEN 'START_INVENTORY_MISSING'
            WHEN gc.sequential_candidate_number IS NULL THEN 'FORMULA_NOT_READY'
            ELSE 'READY'
        END AS generation_status
    FROM guard_calc AS gc
),
horizon_plan_rows AS (
    SELECT
        s.asin,
        s.country,
        s.shop,
        s.`date` AS ship_date,
        COALESCE(s.number, 0) AS plan_number
    FROM simulate_shipment AS s
    CROSS JOIN run_phase AS rp
    WHERE s.plan_source = 'shipment_plan_v2'
      AND s.shop = '合计'
      AND s.`date` >= rp.w1_start_date
      AND s.`date` < DATE_ADD(rp.w1_start_date, INTERVAL 49 DAY)
    UNION ALL
    SELECT
        cr.asin,
        cr.country,
        cr.shop,
        cr.candidate_ship_date AS ship_date,
        cr.sequential_candidate_number AS plan_number
    FROM candidate_rows AS cr
    WHERE cr.generation_status = 'READY'
),
region_candidate_rollup AS (
    SELECT
        cr.asin,
        cr.country,
        cr.snapshot_date,
        cr.run_monday,
        cr.week_no,
        cr.slot_run_monday,
        cr.cycle_phase,
        cr.w1_start_date,
        cr.candidate_ship_date,
        MIN(cr.batch_first_ship_date) AS min_batch_first_ship_date,
        MAX(cr.batch_first_ship_date) AS max_batch_first_ship_date,
        COUNT(*) AS region_candidate_shop_count,
        SUM(
            CASE
                WHEN cr.generation_status IN ('READY', 'EXACT_CANDIDATE_ALREADY_EXISTS')
                    THEN 1
                ELSE 0
            END
        ) AS region_ready_shop_count,
        SUM(
            CASE
                WHEN cr.cycle_phase = 'ORDER_WEEK' THEN cr.latest_committed_number
                WHEN cr.generation_status = 'EXACT_CANDIDATE_ALREADY_EXISTS'
                    THEN cr.existing_number
                ELSE cr.sequential_candidate_number
            END
        ) AS region_a1_number,
        SUM(
            CASE
                WHEN cr.cycle_phase = 'ORDER_WEEK'
                 AND cr.generation_status = 'EXACT_CANDIDATE_ALREADY_EXISTS'
                    THEN cr.existing_number
                WHEN cr.cycle_phase = 'ORDER_WEEK' THEN cr.sequential_candidate_number
                ELSE 0
            END
        ) AS region_a2_number
    FROM candidate_rows AS cr
    GROUP BY
        cr.asin,
        cr.country,
        cr.snapshot_date,
        cr.run_monday,
        cr.week_no,
        cr.slot_run_monday,
        cr.cycle_phase,
        cr.w1_start_date,
        cr.candidate_ship_date
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
                SELECT COALESCE(SUM(GREATEST(COALESCE(hp.plan_number, 0), 0)), 0)
                FROM horizon_plan_rows AS hp
                WHERE hp.asin = rr.asin
                  AND hp.country = rr.country
                  AND hp.ship_date >= rr.w1_start_date
                  AND hp.ship_date < rr.min_batch_first_ship_date
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
            ELSE GREATEST(0, rs.quantity_receive - ro.earlier_committed_number)
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
                - GREATEST(0, rs.quantity_receive - ro.earlier_committed_number)
            )
        END AS net_order_number,
        CASE
            WHEN rs.asin IS NULL THEN 'TODAY_TOTAL_ROW_MISSING'
            WHEN ro.batch_week_aligned = 0 THEN 'SHOP_BATCH_WEEK_NOT_ALIGNED'
            WHEN ro.region_ready_shop_count <> ro.region_candidate_shop_count
                THEN 'SHOP_CANDIDATE_NOT_ALL_READY'
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
    NULL AS shop_id,
    cr.asin,
    cr.sequential_candidate_number AS `number`,
    cr.candidate_ship_date AS `date`,
    cr.candidate_season AS season,
    cr.candidate_warehouse_days AS warehouse_days,
    cr.candidate_add_date AS add_date,
    'shipment_plan_v2' AS plan_source,
    NOW(3) AS created_at,
    NOW(3) AS updated_at
FROM candidate_rows AS cr
WHERE cr.generation_status = 'READY'
ORDER BY cr.country, cr.asin, cr.week_no, cr.shop;

SELECT ROW_COUNT() AS inserted_rows;
COMMIT;

-- sku_1, sid_msku and msku are intentionally not inserted.
-- Re-running is protected by the exact v2 country + asin + shop + date guard.
