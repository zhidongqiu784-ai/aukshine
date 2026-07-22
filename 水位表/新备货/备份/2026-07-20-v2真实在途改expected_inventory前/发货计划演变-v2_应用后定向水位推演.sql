-- 发货计划演变 v2：计划应用后定向水位推演
--
-- 用途：应用工作流成功更新一条 shipment_plan_v2 计划后，立即重算对应
--       ASIN + country 的“合计”行。
--
-- 输入绑定（必须在创建 NocoBase 工作流 SQL 节点时替换下面两个 NULL）：
-- - 右侧必须绑定服务端已校验的申请记录字段，不能直接信任前端值。
-- - 两个输入必须与本文件其他语句处于同一个 SQL 节点、同一个数据库连接。
-- - 未绑定时 CHECK 防护会主动失败，不会更新 daily_sales。
SET @v2_target_asin = CAST(NULL AS CHAR);
SET @v2_target_country = CAST(NULL AS CHAR);
SET @v2_target_shop = '合计';

-- 业务口径与“10-发货计划演变-v2水位推演.sql”保持一致：
-- 真实未入库量 = delivery_note.quantity_shipped - fba_ship.received；
-- 只合并 plan_source = 'shipment_plan_v2'，保留 shippment_id 去重，不读 expected_inventory。
-- 旧节点 05 已令今天 inventory = 真实库存 + 旧 add；定向推演先减旧 add 还原事实锚点，
-- 再加 v2_add，不能直接在当前 inventory 上叠加新计划。

SET SESSION cte_max_recursion_depth = 1000;
SET @v2_target_asin = NULLIF(TRIM(@v2_target_asin), '');
SET @v2_target_country = NULLIF(TRIM(@v2_target_country), '');
SET @v2_calculated_at = NOW(3);

DROP TEMPORARY TABLE IF EXISTS temp_v2_target_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_write_stage;

CREATE TEMPORARY TABLE temp_v2_target_guard (
    guard_value TINYINT NOT NULL CHECK (guard_value = 1)
);

INSERT INTO temp_v2_target_guard (guard_value)
VALUES (
    IF(
        @v2_target_asin IS NOT NULL
        AND @v2_target_country IS NOT NULL
        AND @v2_target_shop = '合计',
        1,
        0
    )
);

CREATE TEMPORARY TABLE temp_v2_target_scope_dates AS
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
WHERE ds.asin = @v2_target_asin
  AND ds.country = @v2_target_country
  AND ds.shop = @v2_target_shop
  AND ds.`date` >= CURDATE();

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_target_scope_dates;

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop, `date`
    FROM temp_v2_target_scope_dates
    GROUP BY asin, country, shop, `date`
    HAVING COUNT(*) <> 1
) AS duplicate_target_rows;

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(SUM(`date` = CURDATE()) = 1, 1, 0)
FROM temp_v2_target_scope_dates;

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_target_scope_dates
WHERE `date` = CURDATE()
  AND inventory IS NULL;

CREATE TEMPORARY TABLE temp_v2_target_scope_gaps AS
SELECT previous_date, `date`
FROM (
    SELECT
        `date`,
        LAG(`date`) OVER (ORDER BY `date`) AS previous_date
    FROM temp_v2_target_scope_dates
) AS ordered_scope
WHERE previous_date IS NOT NULL
  AND DATEDIFF(`date`, previous_date) <> 1;

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_target_scope_gaps;

ALTER TABLE temp_v2_target_scope_dates
    ADD UNIQUE INDEX idx_v2_target_scope_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_target_supply_raw AS
WITH real_shipment AS (
    SELECT
        '合计' AS shop,
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
    WHERE dn.asin = @v2_target_asin
      AND dn.country = @v2_target_country
      AND (
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
    WHERE sim.asin = @v2_target_asin
      AND sim.country = @v2_target_country
      AND sim.shop = @v2_target_shop
      AND sim.plan_source = 'shipment_plan_v2'
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
    shop,
    country,
    asin,
    expected_storage_time,
    CAST(SUM(qty_shipped - received + simulated_quantity) AS SIGNED) AS remaining
FROM all_supply
GROUP BY shop, country, asin, expected_storage_time
HAVING SUM(qty_shipped - received + simulated_quantity) <> 0;

ALTER TABLE temp_v2_target_supply_raw
    ADD INDEX idx_v2_target_supply_raw_key (asin, country, shop, expected_storage_time);

CREATE TEMPORARY TABLE temp_v2_target_supply_unmapped AS
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
        WHEN raw.expected_storage_time < CURDATE()
        THEN 'PAST_DATE_OUTSIDE_PROJECTION'
        ELSE 'FUTURE_DATE_NOT_IN_DAILY_SALES'
    END AS unmapped_reason
FROM temp_v2_target_supply_raw AS raw
LEFT JOIN temp_v2_target_scope_dates AS scope
    ON scope.asin = raw.asin
   AND scope.country = raw.country
   AND scope.shop = raw.shop
   AND scope.`date` = raw.expected_storage_time
WHERE scope.`date` IS NULL;

ALTER TABLE temp_v2_target_supply_unmapped
    ADD INDEX idx_v2_target_supply_unmapped_reason (unmapped_reason);

CREATE TEMPORARY TABLE temp_v2_target_supply AS
SELECT
    raw.shop,
    raw.country,
    raw.asin,
    raw.expected_storage_time,
    raw.remaining
FROM temp_v2_target_supply_raw AS raw
INNER JOIN temp_v2_target_scope_dates AS scope
    ON scope.asin = raw.asin
   AND scope.country = raw.country
   AND scope.shop = raw.shop
   AND scope.`date` = raw.expected_storage_time;

ALTER TABLE temp_v2_target_supply
    ADD INDEX idx_v2_target_supply_key (asin, country, shop, expected_storage_time);

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_target_supply
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR expected_storage_time IS NULL;

-- 完整键的目标未来补货不能因缺少日期行而静默丢失。
INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_target_supply_unmapped
WHERE unmapped_reason = 'FUTURE_DATE_NOT_IN_DAILY_SALES';

CREATE TEMPORARY TABLE temp_v2_target_projection_input AS
SELECT
    scope.asin,
    scope.country,
    scope.shop,
    scope.`date`,
    scope.inventory AS actual_inventory,
    CAST(COALESCE(scope.maybe_sales, 0) AS SIGNED) AS demand,
    scope.weighted_sales,
    NULLIF(CAST(COALESCE(supply.remaining, 0) AS SIGNED), 0) AS v2_add
FROM temp_v2_target_scope_dates AS scope
LEFT JOIN temp_v2_target_supply AS supply
    ON supply.asin = scope.asin
   AND supply.country = scope.country
   AND supply.shop = scope.shop
   AND supply.expected_storage_time = scope.`date`;

ALTER TABLE temp_v2_target_projection_input
    ADD UNIQUE INDEX idx_v2_target_input_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_target_projection_seed AS
SELECT
    asin,
    country,
    shop,
    `date`,
    actual_inventory,
    demand,
    v2_add
FROM temp_v2_target_projection_input
WHERE `date` = CURDATE();

ALTER TABLE temp_v2_target_projection_seed
    ADD UNIQUE INDEX idx_v2_target_seed_key (asin, country, shop, `date`);

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(COUNT(*) = 1, 1, 0)
FROM temp_v2_target_projection_seed;

CREATE TEMPORARY TABLE temp_v2_target_inventory_prediction AS
WITH RECURSIVE inventory_calc AS (
    SELECT
        seed.asin,
        seed.country,
        seed.shop,
        seed.`date`,
        CAST(seed.actual_inventory AS SIGNED)
            + CAST(COALESCE(seed.v2_add, 0) AS SIGNED) AS calc_inventory,
        CAST(seed.demand AS SIGNED) AS demand
    FROM temp_v2_target_projection_seed AS seed

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
    FROM temp_v2_target_projection_input AS input
    INNER JOIN inventory_calc AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.`date` = DATE_ADD(previous.`date`, INTERVAL 1 DAY)
)
SELECT asin, country, shop, `date`, calc_inventory
FROM inventory_calc;

ALTER TABLE temp_v2_target_inventory_prediction
    ADD UNIQUE INDEX idx_v2_target_prediction_key (asin, country, shop, `date`);

INSERT INTO temp_v2_target_guard (guard_value)
SELECT IF(
    (SELECT COUNT(*) FROM temp_v2_target_inventory_prediction)
    = (SELECT COUNT(*) FROM temp_v2_target_projection_input),
    1,
    0
);

CREATE TEMPORARY TABLE temp_v2_target_branch_stage AS
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
            SUM(COALESCE(input.v2_add, 0)) OVER (
                ORDER BY prediction.`date`
                ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
            ),
            0
        ) AS SIGNED
    ) AS v2_on_the_way,
    @v2_calculated_at AS v2_calculated_at
FROM temp_v2_target_inventory_prediction AS prediction
INNER JOIN temp_v2_target_projection_input AS input
    ON input.asin = prediction.asin
   AND input.country = prediction.country
   AND input.shop = prediction.shop
   AND input.`date` = prediction.`date`;

ALTER TABLE temp_v2_target_branch_stage
    ADD UNIQUE INDEX idx_v2_target_branch_stage_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_target_write_stage AS
SELECT * FROM temp_v2_target_branch_stage;

ALTER TABLE temp_v2_target_write_stage
    ADD UNIQUE INDEX idx_v2_target_write_stage_key (asin, country, shop, `date`);

SET @v2_target_branch_rows = 0;
SET @v2_target_total_rows = (SELECT COUNT(*) FROM temp_v2_target_branch_stage);
SET @v2_target_write_rows = (SELECT COUNT(*) FROM temp_v2_target_write_stage);

-- 单调写入：只覆盖空值或不晚于本次开始时间的结果。
UPDATE daily_sales AS target
INNER JOIN temp_v2_target_write_stage AS stage
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
  AND target.asin = @v2_target_asin
  AND target.country = @v2_target_country
  AND target.shop = '合计'
  AND (
        target.v2_calculated_at IS NULL
        OR target.v2_calculated_at <= stage.v2_calculated_at
      );

SET @v2_target_changed_rows = ROW_COUNT();

DROP TEMPORARY TABLE IF EXISTS temp_v2_target_write_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_target_guard;

SELECT
    'OK' AS projection_status,
    @v2_target_asin AS asin,
    @v2_target_country AS country,
    @v2_target_shop AS shop,
    @v2_calculated_at AS calculated_at,
    @v2_target_branch_rows AS branch_rows,
    @v2_target_total_rows AS total_rows,
    @v2_target_write_rows AS staged_rows,
    @v2_target_changed_rows AS changed_rows;
