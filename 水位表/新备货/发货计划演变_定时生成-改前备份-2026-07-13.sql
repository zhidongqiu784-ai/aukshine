-- 发货计划演变 v2：定时工作流候选数据 SQL
-- 数据库：MySQL 8.x
-- 算法标识：shipment_plan_v2
-- 最终输出严格限定为 simulate_shipment:create 使用的 14 个可写字段。
--
-- 重要：本 SQL 只计算“本周应新增的候选记录”，不直接 INSERT。
-- 原因：数据库层直接 INSERT 不会触发 NocoBase 的 action 类型工作流。
-- 工作流应按以下顺序配置：
--   1. 定时触发：每周一次，并安排在 daily_sales 当日数据更新完成之后。
--   2. SQL 节点：执行本文件 SQL，得到候选数组。
--   3. JSON 变量映射节点：从 SQL 返回值中提取记录数组。
--      当前环境的 SQL 测试返回 [记录数组, 元数据]，循环目标应取第 1 项记录数组，不能循环元数据。
--   4. 循环节点：循环上一步提取出的记录数组。
--   5. HTTP 请求节点：POST /api/simulate_shipment:create。
--      请求体字段映射到循环项同名字段；不要使用数据库 SQL 直接插入。
--   6. simulate_shipment:create 会触发现有“修改模拟发货-新”工作流，
--      继续计算 add_date 并刷新 expected_inventory / daily_sales。
--
-- 生成规则：
--   - 边界严格按 ASIN + country + shop 取现有 MAX(add_date)，不按渠道拆分。
--   - 取 MAX(add_date) 对应的最近记录作为下一周模板，正常向后顺延 7 天。
--   - 如果该组合长期未维护，不补写历史计划；直接落到今天之后的下一个同星期发货日。
--   - 候选 add_date 必须严格大于该组现有 MAX(add_date)。
--   - 每个自然周、每个 ASIN + country + shop 最多生成一条 v2 记录，重复执行不会推进多周。
--   - number 允许为 0；0 计划仍需落库，用于推进每周承诺边界并保留算法轨迹。
--   - 需求口径：service_start = add_date + 7 天；读取该服务周 7 天 daily_sales。
--   - 系统建议量使用 maybe_sales / inventory；销售调整场景只在 JS 面板对比，不直接写入系统计划。
--   - daily_sales 不足完整 7 天、物流时效缺失、入仓时效缺失的组合不会返回候选。

WITH
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
        ROW_NUMBER() OVER (
            PARTITION BY s.asin, s.country, s.shop
            ORDER BY s.add_date DESC, s.`date` DESC, s.id DESC
        ) AS rn
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
),
latest_plan AS (
    SELECT
        id,
        asin,
        country,
        shop,
        shop_id,
        channel,
        msku,
        sid_msku,
        sku_1,
        latest_ship_date,
        latest_add_date
    FROM latest_ranked
    WHERE rn = 1
),
ship_calc AS (
    SELECT
        lp.*,
        CASE
            WHEN DATE_ADD(lp.latest_ship_date, INTERVAL 7 DAY) > CURDATE()
                THEN DATE_ADD(lp.latest_ship_date, INTERVAL 7 DAY)
            ELSE DATE_ADD(
                CURDATE(),
                INTERVAL (
                    MOD(WEEKDAY(lp.latest_ship_date) - WEEKDAY(CURDATE()) + 6, 7) + 1
                ) DAY
            )
        END AS candidate_ship_date
    FROM latest_plan AS lp
),
transport_calc AS (
    SELECT
        sp.*,
        ld.days AS logistics_days,
        DATE_ADD(
            sp.candidate_ship_date,
            INTERVAL ld.days DAY
        ) AS candidate_arrival_date
    FROM ship_calc AS sp
    INNER JOIN logistics_days AS ld
        ON ld.logistics_days = sp.channel
    WHERE sp.channel IS NOT NULL
      AND TRIM(sp.channel) <> ''
      AND ld.days IS NOT NULL
),
season_calc AS (
    SELECT
        tc.*,
        CASE
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
        DATE_ADD(sc.candidate_arrival_date, INTERVAL ttw.days DAY) AS candidate_add_date
    FROM season_calc AS sc
    INNER JOIN time_to_warehouse AS ttw
        ON ttw.country = sc.country
       AND ttw.season = sc.candidate_season
    WHERE ttw.days IS NOT NULL
),
service_calc AS (
    SELECT
        wc.*,
        DATE_ADD(wc.candidate_add_date, INTERVAL 7 DAY) AS service_start_date,
        DATE_ADD(wc.candidate_add_date, INTERVAL 13 DAY) AS service_end_date
    FROM warehouse_calc AS wc
    WHERE wc.candidate_add_date > wc.latest_add_date
),
demand_calc AS (
    SELECT
        svc.*,
        (
            SELECT COALESCE(ds.inventory, 0)
            FROM daily_sales AS ds
            WHERE ds.asin = svc.asin
              AND ds.country = svc.country
              AND ds.shop = svc.shop
              AND ds.`date` = svc.service_start_date
            LIMIT 1
        ) AS service_start_inventory,
        (
            SELECT SUM(
                COALESCE(
                    ds.maybe_sales,
                    ds.weighted_sales,
                    0
                )
            )
            FROM daily_sales AS ds
            WHERE ds.asin = svc.asin
              AND ds.country = svc.country
              AND ds.shop = svc.shop
              AND ds.`date` BETWEEN svc.service_start_date AND svc.service_end_date
        ) AS demand_7_days,
        (
            SELECT COUNT(*)
            FROM daily_sales AS ds
            WHERE ds.asin = svc.asin
              AND ds.country = svc.country
              AND ds.shop = svc.shop
              AND ds.`date` BETWEEN svc.service_start_date AND svc.service_end_date
        ) AS demand_day_count
    FROM service_calc AS svc
),
candidate_rows AS (
    SELECT
        dc.channel,
        dc.country,
        dc.msku,
        dc.shop,
        dc.shop_id,
        COALESCE(
            NULLIF(dc.sid_msku, ''),
            CONCAT(dc.shop, '_', dc.country, '_', dc.asin)
        ) AS sid_msku,
        dc.sku_1,
        dc.asin,
        CAST(
            CEIL(
                GREATEST(
                    0,
                    dc.demand_7_days - GREATEST(0, dc.service_start_inventory)
                )
            ) AS SIGNED
        ) AS `number`,
        dc.candidate_ship_date AS `date`,
        dc.candidate_season AS season,
        dc.candidate_warehouse_days AS warehouse_days,
        dc.candidate_add_date AS add_date,
        'shipment_plan_v2' AS plan_source,
        dc.latest_add_date,
        dc.service_start_date,
        dc.service_end_date,
        dc.service_start_inventory,
        dc.demand_7_days
    FROM demand_calc AS dc
    WHERE dc.demand_day_count = 7
      AND dc.service_start_inventory IS NOT NULL
      AND dc.demand_7_days IS NOT NULL
      AND NOT EXISTS (
          SELECT 1
          FROM simulate_shipment AS exact_row
          WHERE exact_row.asin = dc.asin
            AND exact_row.country = dc.country
            AND exact_row.shop = dc.shop
            AND exact_row.`date` = dc.candidate_ship_date
            AND exact_row.plan_source = 'shipment_plan_v2'
      )
      AND NOT EXISTS (
          SELECT 1
          FROM simulate_shipment AS weekly_guard
          WHERE weekly_guard.asin = dc.asin
            AND weekly_guard.country = dc.country
            AND weekly_guard.shop = dc.shop
            AND weekly_guard.plan_source = 'shipment_plan_v2'
            AND weekly_guard.created_at >= DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY)
            AND weekly_guard.created_at < DATE_ADD(
                DATE_SUB(CURDATE(), INTERVAL WEEKDAY(CURDATE()) DAY),
                INTERVAL 7 DAY
            )
      )
)
SELECT
    channel,
    country,
    msku,
    shop,
    shop_id,
    sid_msku,
    sku_1,
    asin,
    `number`,
    `date`,
    season,
    warehouse_days,
    add_date,
    plan_source
FROM candidate_rows
ORDER BY country, asin, shop;

-- HTTP 请求节点只需发送以下业务字段：
-- channel, country, msku, shop, shop_id, sid_msku, sku_1, asin,
-- number, date, season, warehouse_days, add_date, plan_source
--
-- HTTP 请求节点 body 示例（把 <循环节点key> 替换为实际 key）：
-- {
--   "channel": "{{$scopes.<循环节点key>.item.channel}}",
--   "country": "{{$scopes.<循环节点key>.item.country}}",
--   "msku": "{{$scopes.<循环节点key>.item.msku}}",
--   "shop": "{{$scopes.<循环节点key>.item.shop}}",
--   "shop_id": "{{$scopes.<循环节点key>.item.shop_id}}",
--   "sid_msku": "{{$scopes.<循环节点key>.item.sid_msku}}",
--   "sku_1": "{{$scopes.<循环节点key>.item.sku_1}}",
--   "asin": "{{$scopes.<循环节点key>.item.asin}}",
--   "number": "{{$scopes.<循环节点key>.item.number}}",
--   "date": "{{$scopes.<循环节点key>.item.date}}",
--   "season": "{{$scopes.<循环节点key>.item.season}}",
--   "warehouse_days": "{{$scopes.<循环节点key>.item.warehouse_days}}",
--   "add_date": "{{$scopes.<循环节点key>.item.add_date}}",
--   "plan_source": "{{$scopes.<循环节点key>.item.plan_source}}"
-- }


