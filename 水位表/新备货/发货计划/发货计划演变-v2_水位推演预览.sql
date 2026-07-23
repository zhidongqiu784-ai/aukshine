-- 发货计划演变 v2：水位推演只读预览
-- 来源、递推和防护条件与“10-发货计划演变-v2水位推演.sql”一致
--
-- 业务口径：
-- 1. 真实未入库量严格复用“期望入库SQL - 修改版.sql”：
--    delivery_note.quantity_shipped - fba_ship.received。
-- 2. 模拟计划只读取 simulate_shipment.plan_source = 'shipment_plan_v2'。
-- 3. 模拟计划已生成真实 delivery_note 时，按 shippment_id + asin 排除，避免重复计算。
-- 4. 不读取 expected_inventory，不写 daily_sales 的旧字段。
-- 5. 本节点位于旧节点 09 之后；合计行今天 inventory = 真实总库存 + 旧 add。
--    因此 v2 今日锚点先用 inventory - old add 还原真实库存，再加 v2_add。
-- 6. 只在临时表完整计算并校验，不执行任何正式表 UPDATE/INSERT/DELETE。
-- 7. v3.5 / 决策 23：只递推“合计”行；店铺层不做 v2 断货精算或计划分摊。

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

-- 预览版只记录 guard 结果，不用 CHECK 中止；正式节点 10 仍保持 fail-closed。
CREATE TEMPORARY TABLE temp_v2_projection_guard (
    guard_name VARCHAR(80) NOT NULL,
    guard_value TINYINT NOT NULL,
    PRIMARY KEY (guard_name)
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
INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'SCOPE_NOT_EMPTY', IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_scope_dates;

INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'SCOPE_KEYS_COMPLETE', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_dates
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR `date` IS NULL;

INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'SCOPE_ROWS_UNIQUE', IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop, `date`
    FROM temp_v2_scope_dates
    GROUP BY asin, country, shop, `date`
    HAVING COUNT(*) <> 1
) AS duplicate_scope_rows;

INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'TODAY_ROW_PER_SCOPE', IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop
    FROM temp_v2_scope_dates
    GROUP BY asin, country, shop
    HAVING SUM(`date` = CURDATE()) <> 1
) AS missing_today_rows;

INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'TODAY_INVENTORY_PRESENT', IF(COUNT(*) = 0, 1, 0)
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

INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'DATE_CHAIN_CONTIGUOUS', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_scope_gaps;

ALTER TABLE temp_v2_scope_dates
    ADD INDEX idx_v2_scope_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_scope_keys AS
SELECT asin, country, shop
FROM temp_v2_scope_dates
GROUP BY asin, country, shop;

ALTER TABLE temp_v2_scope_keys
    ADD INDEX idx_v2_scope_business_key (asin, country, shop);

-- 先保留原始补货汇总，再区分可映射与不可映射来源。
CREATE TEMPORARY TABLE temp_v2_supply_raw AS
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

-- 进入有效 supply 的记录必须具备完整键和日期；无效来源保留在 unmapped 诊断中。
INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'SUPPLY_KEYS_AND_DATE_COMPLETE', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_supply
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR expected_storage_time IS NULL;

-- 完整键且属于推演范围的未来补货必须明确报告缺失日期行。
INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'FUTURE_SUPPLY_DATE_MAPPED', IF(COUNT(*) = 0, 1, 0)
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
    ADD INDEX idx_v2_input_key (asin, country, shop, `date`);

-- anchor 与 recursive member 分别读取 seed/input，避免 MySQL 重复打开同一临时表。
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
    ADD INDEX idx_v2_seed_key (asin, country, shop, `date`);

INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'SEED_ROW_COUNT_COMPLETE', IF(
    (SELECT COUNT(*) FROM temp_v2_projection_seed)
    = (SELECT COUNT(*) FROM temp_v2_scope_keys),
    1,
    0
);

-- 缺货需求连续结转：补货到达时仍保留此前负库存，不再从补货量重新起算。
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
        previous.calc_inventory
            - previous.demand
            + CAST(COALESCE(input.v2_add, 0) AS SIGNED) AS calc_inventory,
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
    ADD INDEX idx_v2_prediction_key (asin, country, shop, `date`);

-- 递推结果行数必须与输入完全一致，否则说明日期链被截断。
INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'RECURSION_ROW_COUNT_COMPLETE', IF(
    (SELECT COUNT(*) FROM temp_v2_inventory_prediction)
    = (SELECT COUNT(*) FROM temp_v2_projection_input),
    1,
    0
);

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
            SUM(COALESCE(input.v2_add, 0)) OVER (
                PARTITION BY prediction.asin, prediction.country, prediction.shop
                ORDER BY prediction.`date`
                ROWS BETWEEN 1 FOLLOWING AND UNBOUNDED FOLLOWING
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
    ADD INDEX idx_v2_branch_stage_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_write_stage AS
SELECT * FROM temp_v2_branch_stage;

ALTER TABLE temp_v2_write_stage
    ADD INDEX idx_v2_write_stage_key (asin, country, shop, `date`);

-- 合计推演必须完整覆盖合计日期范围。
INSERT INTO temp_v2_projection_guard (guard_name, guard_value)
SELECT 'WRITE_STAGE_COVERS_FUTURE', IF(
    (SELECT COUNT(*) FROM temp_v2_write_stage)
    = (SELECT COUNT(*) FROM temp_v2_scope_dates),
    1,
    0
);

-- 保存预览统计到会话变量，清理临时表后统一输出。
SET @v2_preview_pending_write_rows = (SELECT COUNT(*) FROM temp_v2_write_stage);
SET @v2_preview_branch_rows = 0;
SET @v2_preview_total_rows = (SELECT COUNT(*) FROM temp_v2_branch_stage);
SET @v2_preview_add_nonnull_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_stage
    WHERE v2_add IS NOT NULL
);
SET @v2_preview_min_inventory = (SELECT MIN(v2_inventory) FROM temp_v2_write_stage);
SET @v2_preview_max_inventory = (SELECT MAX(v2_inventory) FROM temp_v2_write_stage);
SET @v2_preview_min_days = (SELECT MIN(v2_days_for_sale) FROM temp_v2_write_stage);
SET @v2_preview_max_days = (SELECT MAX(v2_days_for_sale) FROM temp_v2_write_stage);
SET @v2_preview_missing_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_stage
    WHERE v2_inventory IS NULL
       OR v2_days_for_sale IS NULL
       OR v2_on_the_way IS NULL
       OR v2_calculated_at IS NULL
);
SET @v2_preview_negative_inventory_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_stage
    WHERE v2_inventory < 0
);
SET @v2_preview_negative_add_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_stage
    WHERE v2_add < 0
);
SET @v2_preview_negative_on_the_way_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_stage
    WHERE v2_on_the_way < 0
);
SET @v2_preview_invalid_days_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_stage
    WHERE v2_days_for_sale < 0
);
SET @v2_preview_date_gap_rows = (SELECT COUNT(*) FROM temp_v2_scope_gaps);
SET @v2_preview_unmapped_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_supply_unmapped
    WHERE unmapped_reason = 'FUTURE_DATE_NOT_IN_DAILY_SALES'
);
SET @v2_preview_invalid_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_supply_unmapped
    WHERE unmapped_reason IN (
        'INCOMPLETE_BUSINESS_KEY',
        'MISSING_EXPECTED_STORAGE_TIME'
    )
);
SET @v2_preview_out_of_scope_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_supply_unmapped
    WHERE unmapped_reason = 'OUT_OF_SCOPE'
);
SET @v2_preview_past_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_supply_unmapped
    WHERE unmapped_reason = 'PAST_DATE_OUTSIDE_PROJECTION'
);
SET @v2_preview_orphan_total_rows = (
    SELECT COUNT(*)
    FROM daily_sales AS total
    LEFT JOIN (
        SELECT asin, country, `date`
        FROM temp_v2_branch_stage
        GROUP BY asin, country, `date`
    ) AS branch
        ON branch.asin = total.asin
       AND branch.country = total.country
       AND branch.`date` = total.`date`
    WHERE total.shop = '合计'
      AND total.`date` >= CURDATE()
      AND branch.`date` IS NULL
);
SET @v2_preview_unmapped_supply_summary = (
    SELECT GROUP_CONCAT(
        CONCAT(unmapped_reason, '=', reason_count)
        ORDER BY unmapped_reason
        SEPARATOR ','
    )
    FROM (
        SELECT unmapped_reason, COUNT(*) AS reason_count
        FROM temp_v2_supply_unmapped
        GROUP BY unmapped_reason
    ) AS reason_counts
);
SET @v2_preview_abnormal_rows =
      @v2_preview_negative_add_rows
    + @v2_preview_negative_on_the_way_rows
    + @v2_preview_invalid_days_rows
    + @v2_preview_date_gap_rows
    + @v2_preview_unmapped_supply_rows
    + @v2_preview_invalid_supply_rows;
SET @v2_preview_failed_guard_count = (
    SELECT COUNT(*)
    FROM temp_v2_projection_guard
    WHERE guard_value = 0
);
SET @v2_preview_failed_guard_names = (
    SELECT GROUP_CONCAT(guard_name ORDER BY guard_name SEPARATOR ',')
    FROM temp_v2_projection_guard
    WHERE guard_value = 0
);
SET @v2_preview_guard_results = (
    SELECT GROUP_CONCAT(
        CONCAT(guard_name, '=', guard_value)
        ORDER BY guard_name
        SEPARATOR ','
    )
    FROM temp_v2_projection_guard
);

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
    IF(
        @v2_preview_failed_guard_count = 0,
        'PREVIEW_OK',
        'PREVIEW_GUARD_FAILED'
    ) AS preview_status,
    @v2_calculated_at AS calculated_at,
    @v2_preview_pending_write_rows AS pending_write_rows,
    @v2_preview_branch_rows AS branch_rows,
    @v2_preview_total_rows AS total_rows,
    @v2_preview_add_nonnull_rows AS v2_add_nonnull_rows,
    @v2_preview_min_inventory AS min_v2_inventory,
    @v2_preview_max_inventory AS max_v2_inventory,
    @v2_preview_min_days AS min_v2_days_for_sale,
    @v2_preview_max_days AS max_v2_days_for_sale,
    @v2_preview_failed_guard_count AS failed_guard_count,
    @v2_preview_failed_guard_names AS failed_guard_names,
    @v2_preview_guard_results AS guard_results,
    @v2_preview_missing_rows AS missing_value_rows,
    @v2_preview_abnormal_rows AS abnormal_rows,
    @v2_preview_negative_inventory_rows AS negative_inventory_rows,
    @v2_preview_negative_add_rows AS negative_v2_add_rows,
    @v2_preview_negative_on_the_way_rows AS negative_v2_on_the_way_rows,
    @v2_preview_invalid_days_rows AS invalid_v2_days_rows,
    @v2_preview_date_gap_rows AS date_gap_rows,
    @v2_preview_unmapped_supply_rows AS unmapped_future_supply_rows,
    @v2_preview_invalid_supply_rows AS ignored_invalid_supply_rows,
    @v2_preview_out_of_scope_supply_rows AS ignored_out_of_scope_supply_rows,
    @v2_preview_past_supply_rows AS ignored_past_supply_rows,
    @v2_preview_orphan_total_rows AS ignored_orphan_total_rows,
    @v2_preview_unmapped_supply_summary AS unmapped_supply_summary;
