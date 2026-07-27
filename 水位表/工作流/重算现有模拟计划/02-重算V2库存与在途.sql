-- 工作流：发货计划演变-v2-重算现有建议
-- 节点 02：建议量写回后全量重算 V2 水位。
-- 本文件与“工作流：更新水位表”的节点 10 保持同一计算口径。
--
-- 业务口径：
-- 1. 真实未入库量内联复用“期望入库SQL - 修改版.sql”的真实发货口径：
--    delivery_note.quantity_shipped - fba_ship.received；保留超签收形成的负补货，旧模拟计划不进入 v2。
-- 2. 模拟计划只读取 simulate_shipment.plan_source = 'shipment_plan_v2'。
-- 3. 模拟计划已生成真实 delivery_note 时，按 shippment_id + asin 排除，避免重复计算。
-- 4. 不写 daily_sales 的旧字段。
-- 5. 本节点位于旧节点 09 之后；合计行今天 inventory = 真实总库存 + 旧 add。
--    因此 v2 今日锚点先用 inventory - old add 还原真实库存，再加 v2_add。
-- 6. 先完整计算并校验临时表，最后一次性写回 v2_*；无补货日写 NULL，旧日期不会残留旧值。
-- 7. v3.5 / 决策 23：只递推“合计”行；店铺层不做 v2 断货精算或计划分摊。
-- 8. v2 在途按“初始正补货总量 - 截至当天累计补货”递推；负补货会减少库存并等量恢复在途。

SET SESSION cte_max_recursion_depth = 1000;
SET @v2_calculated_at = NOW(3);

DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_keys;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_stage;

-- 所有防护条件都写入 CHECK 临时表；任一条件为 0 时 SQL 立即失败，正式字段保持不变。
CREATE TEMPORARY TABLE temp_v2_projection_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

CREATE TEMPORARY TABLE temp_v2_scope_dates AS
SELECT
    ds.asin,
    ds.country,
    ds.shop,
    ds.`date`,
    CASE
        WHEN ds.`date` = CURDATE()
        THEN CAST(COALESCE(ds.inventory, 0) AS SIGNED)
             - CAST(COALESCE(ds.`add`, 0) AS SIGNED)
        ELSE ds.inventory
    END AS inventory,
    ds.maybe_sales,
    ds.weighted_sales
FROM daily_sales AS ds
WHERE ds.`date` >= CURDATE()
  AND ds.shop = '合计';

-- 必须有未来合计数据，且业务键、今日库存和每日记录都完整。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_scope_dates;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_dates
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR `date` IS NULL;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop, `date`
    FROM temp_v2_scope_dates
    GROUP BY asin, country, shop, `date`
    HAVING COUNT(*) <> 1
) AS duplicate_scope_rows;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop
    FROM temp_v2_scope_dates
    GROUP BY asin, country, shop
    HAVING SUM(`date` = CURDATE()) <> 1
) AS missing_today_rows;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_dates
WHERE `date` = CURDATE()
  AND inventory IS NULL;

CREATE TEMPORARY TABLE temp_v2_scope_gaps AS
SELECT asin, country, shop, previous_date, `date`
FROM (
    SELECT
        asin,
        country,
        shop,
        `date`,
        LAG(`date`) OVER (
            PARTITION BY asin, country, shop
            ORDER BY `date`
        ) AS previous_date
    FROM temp_v2_scope_dates
) AS ordered_scope
WHERE previous_date IS NOT NULL
  AND DATEDIFF(`date`, previous_date) <> 1;

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_gaps;

ALTER TABLE temp_v2_scope_dates
    ADD UNIQUE INDEX idx_v2_scope_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_scope_keys AS
SELECT asin, country, shop
FROM temp_v2_scope_dates
GROUP BY asin, country, shop;

ALTER TABLE temp_v2_scope_keys
    ADD UNIQUE INDEX idx_v2_scope_business_key (asin, country, shop);

-- 重建 v2 补货来源：内联期望入库真实在途 + 新算法模拟计划。
CREATE TEMPORARY TABLE temp_v2_supply_raw AS
WITH real_shipment AS (
    SELECT
        '合计' AS shop,
        real_supply.country,
        real_supply.asin,
        real_supply.expected_storage_time,
        CAST(SUM(real_supply.qty_shipped - real_supply.received) AS SIGNED) AS qty_shipped,
        0 AS received
    FROM (
        SELECT
            dn.country,
            dn.asin,
            DATE(
                COALESCE(
                    NULLIF(TRIM(dn.estimated_arrival_date), ''),
                    DATE_ADD(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        INTERVAL IFNULL(ttw.days, 0) DAY
                    )
                )
            ) AS expected_storage_time,
            dn.shipment_id,
            SUM(dn.quantity_shipped) AS qty_shipped,
            SUM(COALESCE(fs.received, 0)) AS received
        FROM delivery_note AS dn
        LEFT JOIN channel_lead_time AS clt
            ON TRIM(UPPER(dn.logistics_provider_name)) = TRIM(UPPER(clt.logistics_provider))
           AND TRIM(UPPER(dn.logistics_channel_name)) = TRIM(UPPER(clt.channel))
        LEFT JOIN time_to_warehouse AS ttw
            ON TRIM(UPPER(dn.country)) = TRIM(UPPER(ttw.country))
           AND (
                CASE
                    WHEN DATE_FORMAT(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        '%m-%d'
                    ) BETWEEN '06-10' AND '07-10'
                      OR DATE_FORMAT(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        '%m-%d'
                    ) BETWEEN '09-10' AND '10-10'
                      OR DATE_FORMAT(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        '%m-%d'
                    ) BETWEEN '11-01' AND '12-15'
                    THEN '旺季'
                    ELSE '淡季'
                END
           ) = ttw.season
        LEFT JOIN (
            SELECT shippment_id, msku, `apply`, SUM(received) AS received
            FROM fba_ship
            GROUP BY shippment_id, msku, `apply`
        ) AS fs
            ON fs.shippment_id = dn.shipment_id
           AND fs.msku = dn.msku
           AND fs.`apply` = dn.quantity_shipped
        WHERE (
                TRIM(dn.status) = '已发货'
                OR (
                    TRIM(dn.status) = '待配货'
                    AND COALESCE(fs.received, 0) > 0
                )
            )
          AND (TRIM(dn.state) <> '已索赔' OR dn.state IS NULL)
        GROUP BY
            dn.country,
            dn.asin,
            DATE(
                COALESCE(
                    NULLIF(TRIM(dn.estimated_arrival_date), ''),
                    DATE_ADD(
                        DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY),
                        INTERVAL IFNULL(ttw.days, 0) DAY
                    )
                )
            ),
            dn.shipment_id
    ) AS real_supply
    INNER JOIN temp_v2_scope_keys AS scope_key
        ON scope_key.asin = real_supply.asin
       AND scope_key.country = real_supply.country
       AND scope_key.shop = '合计'
    WHERE real_supply.expected_storage_time >= CURDATE()
      AND (real_supply.qty_shipped - real_supply.received) <> 0
    GROUP BY
        real_supply.country,
        real_supply.asin,
        real_supply.expected_storage_time
),
all_supply AS (
    SELECT
        shop,
        country,
        asin,
        expected_storage_time,
        qty_shipped,
        received,
        0 AS simulated_quantity
    FROM real_shipment

    UNION ALL

    SELECT
        sim.shop,
        sim.country,
        sim.asin,
        DATE(sim.add_date) AS expected_storage_time,
        0 AS qty_shipped,
        0 AS received,
        sim.number AS simulated_quantity
    FROM simulate_shipment AS sim
    WHERE sim.plan_source = 'shipment_plan_v2'
      AND sim.shop = '合计'
      AND (
            (
                sim.shippment_id IS NOT NULL
                AND sim.shippment_id <> ''
                AND NOT EXISTS (
                    SELECT 1
                    FROM delivery_note AS dn
                    WHERE TRIM(UPPER(dn.shipment_id)) = TRIM(UPPER(sim.shippment_id))
                      AND TRIM(UPPER(dn.asin)) = TRIM(UPPER(sim.asin))
                      AND (
                            TRIM(dn.status) = '已发货'
                            OR (
                                TRIM(dn.status) = '待配货'
                                AND EXISTS (
                                    SELECT 1
                                    FROM fba_ship AS fs2
                                    WHERE fs2.shippment_id = dn.shipment_id
                                      AND fs2.msku = dn.msku
                                      AND fs2.`apply` = dn.quantity_shipped
                                      AND COALESCE(fs2.received, 0) > 0
                                )
                            )
                        )
                      AND (TRIM(dn.state) <> '已索赔' OR dn.state IS NULL)
                )
            )
            OR sim.shippment_id IS NULL
            OR sim.shippment_id = ''
        )
)
SELECT
    supply.shop,
    supply.country,
    supply.asin,
    supply.expected_storage_time,
    CAST(
        SUM(supply.qty_shipped - supply.received + supply.simulated_quantity)
        AS SIGNED
    ) AS remaining
FROM all_supply AS supply
GROUP BY supply.shop, supply.country, supply.asin, supply.expected_storage_time
HAVING SUM(supply.qty_shipped - supply.received + supply.simulated_quantity) <> 0;

ALTER TABLE temp_v2_supply_raw
    ADD INDEX idx_v2_supply_raw_key (asin, country, shop, expected_storage_time);

-- 记录未进入有效 supply 的来源。完整业务键的未来补货若缺少水位日期行，
-- 正式节点仍由 FUTURE_SUPPLY_DATE_MAPPED guard 阻断，不能静默跳过。
CREATE TEMPORARY TABLE temp_v2_supply_unmapped AS
SELECT
    raw.shop,
    raw.country,
    raw.asin,
    raw.expected_storage_time,
    raw.remaining,
    CASE
        WHEN raw.asin IS NULL OR TRIM(raw.asin) = ''
          OR raw.country IS NULL OR TRIM(raw.country) = ''
          OR raw.shop IS NULL OR TRIM(raw.shop) = ''
        THEN 'INCOMPLETE_BUSINESS_KEY'
        WHEN raw.expected_storage_time IS NULL
        THEN 'MISSING_EXPECTED_STORAGE_TIME'
        WHEN scope_key.asin IS NULL
        THEN 'OUT_OF_SCOPE'
        WHEN raw.expected_storage_time < CURDATE()
        THEN 'PAST_DATE_OUTSIDE_PROJECTION'
        ELSE 'FUTURE_DATE_NOT_IN_DAILY_SALES'
    END AS unmapped_reason
FROM temp_v2_supply_raw AS raw
LEFT JOIN temp_v2_scope_keys AS scope_key
    ON scope_key.asin = raw.asin
   AND scope_key.country = raw.country
   AND scope_key.shop = raw.shop
LEFT JOIN temp_v2_scope_dates AS scope_date
    ON scope_date.asin = raw.asin
   AND scope_date.country = raw.country
   AND scope_date.shop = raw.shop
   AND scope_date.`date` = raw.expected_storage_time
WHERE scope_date.`date` IS NULL;

ALTER TABLE temp_v2_supply_unmapped
    ADD INDEX idx_v2_supply_unmapped_reason (unmapped_reason);

-- 只有能精确映射到今天及未来 daily_sales 日期行的补货才进入递推。
CREATE TEMPORARY TABLE temp_v2_supply AS
SELECT
    raw.shop,
    raw.country,
    raw.asin,
    raw.expected_storage_time,
    raw.remaining
FROM temp_v2_supply_raw AS raw
INNER JOIN temp_v2_scope_dates AS scope
    ON scope.asin = raw.asin
   AND scope.country = raw.country
   AND scope.shop = raw.shop
   AND scope.`date` = raw.expected_storage_time;

ALTER TABLE temp_v2_supply
    ADD INDEX idx_v2_supply_key (asin, country, shop, expected_storage_time);

-- 进入有效 supply 的记录必须具备完整键和日期；无效来源已在 unmapped 中隔离。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_supply
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR expected_storage_time IS NULL;

-- 完整键且属于推演范围的未来补货不能因缺少日期行而静默丢失。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_supply_unmapped
WHERE unmapped_reason = 'FUTURE_DATE_NOT_IN_DAILY_SALES';

CREATE TEMPORARY TABLE temp_v2_projection_input AS
SELECT
    scope.asin,
    scope.country,
    scope.shop,
    scope.`date`,
    scope.inventory AS actual_inventory,
    CAST(COALESCE(scope.maybe_sales, 0) AS SIGNED) AS demand,
    scope.weighted_sales,
    NULLIF(CAST(COALESCE(supply.remaining, 0) AS SIGNED), 0) AS v2_add
FROM temp_v2_scope_dates AS scope
LEFT JOIN temp_v2_supply AS supply
    ON supply.asin = scope.asin
   AND supply.country = scope.country
   AND supply.shop = scope.shop
   AND supply.expected_storage_time = scope.`date`;

ALTER TABLE temp_v2_projection_input
    ADD UNIQUE INDEX idx_v2_input_key (asin, country, shop, `date`);

-- MySQL 临时表在同一递归语句中不能重复打开：anchor 使用独立的今日 seed，
-- recursive member 继续读取完整 input。
CREATE TEMPORARY TABLE temp_v2_projection_seed AS
SELECT
    asin,
    country,
    shop,
    `date`,
    actual_inventory,
    demand,
    v2_add
FROM temp_v2_projection_input
WHERE `date` = CURDATE();

ALTER TABLE temp_v2_projection_seed
    ADD UNIQUE INDEX idx_v2_seed_key (asin, country, shop, `date`);

INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_projection_seed)
    = (SELECT COUNT(*) FROM temp_v2_scope_keys),
    1,
    0
);

-- 与普通库存口径一致：缺货期间未成交需求不结转；正补货到达时从本次补货量重新起算。
CREATE TEMPORARY TABLE temp_v2_inventory_prediction AS
WITH RECURSIVE inventory_calc AS (
    SELECT
        seed.asin,
        seed.country,
        seed.shop,
        seed.`date`,
        CAST(seed.actual_inventory AS SIGNED)
            + CAST(COALESCE(seed.v2_add, 0) AS SIGNED) AS calc_inventory,
        CAST(seed.demand AS SIGNED) AS demand
    FROM temp_v2_projection_seed AS seed

    UNION ALL

    SELECT
        input.asin,
        input.country,
        input.shop,
        input.`date`,
        CASE
            WHEN COALESCE(input.v2_add, 0) > 0
             AND (previous.calc_inventory - previous.demand) < 0
            THEN CAST(input.v2_add AS SIGNED)
            ELSE previous.calc_inventory
                - previous.demand
                + CAST(COALESCE(input.v2_add, 0) AS SIGNED)
        END AS calc_inventory,
        CAST(input.demand AS SIGNED) AS demand
    FROM temp_v2_projection_input AS input
    INNER JOIN inventory_calc AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.`date` = DATE_ADD(previous.`date`, INTERVAL 1 DAY)
)
SELECT asin, country, shop, `date`, calc_inventory
FROM inventory_calc;

ALTER TABLE temp_v2_inventory_prediction
    ADD UNIQUE INDEX idx_v2_prediction_key (asin, country, shop, `date`);

-- 递推结果行数必须与输入完全一致，否则说明日期链被截断。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_inventory_prediction)
    = (SELECT COUNT(*) FROM temp_v2_projection_input),
    1,
    0
);

-- 在途遵循库存转移守恒：正补货到库后扣减在途，负补货减少库存并恢复等量在途。
CREATE TEMPORARY TABLE temp_v2_branch_stage AS
SELECT
    prediction.asin,
    prediction.country,
    prediction.shop,
    prediction.`date`,
    input.v2_add,
    CAST(prediction.calc_inventory AS SIGNED) AS v2_inventory,
    CAST(
        CASE
            WHEN prediction.calc_inventory <= 0 THEN 0
            WHEN input.weighted_sales > 0
            THEN FLOOR(prediction.calc_inventory / input.weighted_sales)
            ELSE 0
        END AS SIGNED
    ) AS v2_days_for_sale,
    CAST(
        COALESCE(
            SUM(GREATEST(COALESCE(input.v2_add, 0), 0)) OVER (
                PARTITION BY prediction.asin, prediction.country, prediction.shop
            )
            - SUM(COALESCE(input.v2_add, 0)) OVER (
                PARTITION BY prediction.asin, prediction.country, prediction.shop
                ORDER BY prediction.`date`
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ),
            0
        ) AS SIGNED
    ) AS v2_on_the_way,
    @v2_calculated_at AS v2_calculated_at
FROM temp_v2_inventory_prediction AS prediction
INNER JOIN temp_v2_projection_input AS input
    ON input.asin = prediction.asin
   AND input.country = prediction.country
   AND input.shop = prediction.shop
   AND input.`date` = prediction.`date`;

ALTER TABLE temp_v2_branch_stage
    ADD UNIQUE INDEX idx_v2_branch_stage_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_write_stage AS
SELECT * FROM temp_v2_branch_stage;

ALTER TABLE temp_v2_write_stage
    ADD UNIQUE INDEX idx_v2_write_stage_key (asin, country, shop, `date`);

-- 合计推演必须完整覆盖合计日期范围。
INSERT INTO temp_v2_projection_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_write_stage)
    = (SELECT COUNT(*) FROM temp_v2_scope_dates),
    1,
    0
);

SET @v2_branch_rows = 0;
SET @v2_total_rows = (SELECT COUNT(*) FROM temp_v2_branch_stage);
SET @v2_write_rows = (SELECT COUNT(*) FROM temp_v2_write_stage);

-- 单调写入：较早启动的全量推演不得覆盖较晚启动的定向推演结果。
UPDATE daily_sales AS target
INNER JOIN temp_v2_write_stage AS stage
    ON stage.asin = target.asin
   AND stage.country = target.country
   AND stage.shop = target.shop
   AND stage.`date` = target.`date`
SET
    target.v2_add = stage.v2_add,
    target.v2_inventory = stage.v2_inventory,
    target.v2_days_for_sale = stage.v2_days_for_sale,
    target.v2_on_the_way = stage.v2_on_the_way,
    target.v2_calculated_at = stage.v2_calculated_at
WHERE target.`date` >= CURDATE()
  AND (
        target.v2_calculated_at IS NULL
        OR target.v2_calculated_at <= stage.v2_calculated_at
      );

SET @v2_changed_rows = ROW_COUNT();

DROP TEMPORARY TABLE IF EXISTS temp_v2_write_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_keys;
DROP TEMPORARY TABLE IF EXISTS temp_v2_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_projection_guard;

SELECT
    'OK' AS projection_status,
    @v2_calculated_at AS calculated_at,
    @v2_branch_rows AS branch_rows,
    @v2_total_rows AS total_rows,
    @v2_write_rows AS staged_rows,
    @v2_changed_rows AS changed_rows;
