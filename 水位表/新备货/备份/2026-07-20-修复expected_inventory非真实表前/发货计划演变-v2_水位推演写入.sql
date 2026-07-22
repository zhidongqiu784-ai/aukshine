-- 发货计划演变 v2：全量水位推演写入
--
-- 用途：
-- 1. 放在“每周生成模拟计划”工作流的生成节点后，生成计划后立即刷新 v2 水位。
-- 2. 也可以放在“更新水位表”工作流 1-9 步骤后，旧水位更新完成后再刷新 v2 水位。
--
-- 业务口径：
-- 1. 只递推 daily_sales.shop = '合计' 的区域合计行。
-- 2. 今日锚点使用 daily_sales.inventory - daily_sales.add，还原旧水位节点加过旧补货前的真实库存。
-- 3. 真实在途读取 expected_inventory：qty_shipped > 0 且 remaining > 0。
-- 4. 新算法模拟计划读取 simulate_shipment.plan_source = 'shipment_plan_v2' 且 shop = '合计'。
-- 5. 只写 daily_sales.v2_* 字段，不写 daily_sales 旧字段，不写 expected_inventory。
-- 6. 如果校验失败，本 SQL 不更新 daily_sales，并在最后 SELECT 返回 GUARD_FAILED。

SET SESSION cte_max_recursion_depth = 1000;
SET @v2_calculated_at = NOW(3);

DROP TEMPORARY TABLE IF EXISTS temp_v2_write_guard;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_scope_keys;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_stage;

CREATE TEMPORARY TABLE temp_v2_write_guard (
    guard_name VARCHAR(80) NOT NULL,
    guard_value TINYINT NOT NULL,
    PRIMARY KEY (guard_name)
);

CREATE TEMPORARY TABLE temp_v2_write_scope_dates AS
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

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'SCOPE_NOT_EMPTY', IF(COUNT(*) > 0, 1, 0)
FROM temp_v2_write_scope_dates;

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'SCOPE_KEYS_COMPLETE', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_write_scope_dates
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR `date` IS NULL;

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'SCOPE_ROWS_UNIQUE', IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop, `date`
    FROM temp_v2_write_scope_dates
    GROUP BY asin, country, shop, `date`
    HAVING COUNT(*) <> 1
) AS duplicate_scope_rows;

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'TODAY_ROW_PER_SCOPE', IF(COUNT(*) = 0, 1, 0)
FROM (
    SELECT asin, country, shop
    FROM temp_v2_write_scope_dates
    GROUP BY asin, country, shop
    HAVING SUM(`date` = CURDATE()) <> 1
) AS missing_today_rows;

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'TODAY_INVENTORY_PRESENT', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_write_scope_dates
WHERE `date` = CURDATE()
  AND inventory IS NULL;

CREATE TEMPORARY TABLE temp_v2_write_scope_gaps AS
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
    FROM temp_v2_write_scope_dates
) AS ordered_scope
WHERE previous_date IS NOT NULL
  AND DATEDIFF(`date`, previous_date) <> 1;

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'DATE_CHAIN_CONTIGUOUS', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_write_scope_gaps;

ALTER TABLE temp_v2_write_scope_dates
    ADD INDEX idx_v2_write_scope_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_write_scope_keys AS
SELECT asin, country, shop
FROM temp_v2_write_scope_dates
GROUP BY asin, country, shop;

ALTER TABLE temp_v2_write_scope_keys
    ADD INDEX idx_v2_write_scope_business_key (asin, country, shop);

CREATE TEMPORARY TABLE temp_v2_write_supply_raw AS
WITH real_shipment AS (
    SELECT
        '合计' AS shop,
        ei.country,
        ei.asin,
        DATE(ei.expected_storage_time) AS expected_storage_time,
        SUM(COALESCE(ei.remaining, 0)) AS qty_shipped,
        0 AS received
    FROM expected_inventory AS ei
    INNER JOIN temp_v2_write_scope_keys AS scope_key
        ON scope_key.asin = ei.asin
       AND scope_key.country = ei.country
       AND scope_key.shop = '合计'
    WHERE COALESCE(ei.qty_shipped, 0) > 0
      AND COALESCE(ei.remaining, 0) > 0
      AND DATE(ei.expected_storage_time) >= CURDATE()
    GROUP BY
        ei.country,
        ei.asin,
        DATE(ei.expected_storage_time)
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
    INNER JOIN temp_v2_write_scope_keys AS scope_key
        ON scope_key.asin = sim.asin
       AND scope_key.country = sim.country
       AND scope_key.shop = sim.shop
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

ALTER TABLE temp_v2_write_supply_raw
    ADD INDEX idx_v2_write_supply_raw_key (asin, country, shop, expected_storage_time);

CREATE TEMPORARY TABLE temp_v2_write_supply_unmapped AS
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
FROM temp_v2_write_supply_raw AS raw
LEFT JOIN temp_v2_write_scope_keys AS scope_key
    ON scope_key.asin = raw.asin
   AND scope_key.country = raw.country
   AND scope_key.shop = raw.shop
LEFT JOIN temp_v2_write_scope_dates AS scope_date
    ON scope_date.asin = raw.asin
   AND scope_date.country = raw.country
   AND scope_date.shop = raw.shop
   AND scope_date.`date` = raw.expected_storage_time
WHERE scope_date.`date` IS NULL;

ALTER TABLE temp_v2_write_supply_unmapped
    ADD INDEX idx_v2_write_supply_unmapped_reason (unmapped_reason);

CREATE TEMPORARY TABLE temp_v2_write_supply AS
SELECT
    raw.shop,
    raw.country,
    raw.asin,
    raw.expected_storage_time,
    raw.remaining
FROM temp_v2_write_supply_raw AS raw
INNER JOIN temp_v2_write_scope_dates AS scope
    ON scope.asin = raw.asin
   AND scope.country = raw.country
   AND scope.shop = raw.shop
   AND scope.`date` = raw.expected_storage_time;

ALTER TABLE temp_v2_write_supply
    ADD INDEX idx_v2_write_supply_key (asin, country, shop, expected_storage_time);

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'SUPPLY_KEYS_AND_DATE_COMPLETE', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_write_supply
WHERE asin IS NULL OR TRIM(asin) = ''
   OR country IS NULL OR TRIM(country) = ''
   OR shop IS NULL OR TRIM(shop) = ''
   OR expected_storage_time IS NULL;

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'FUTURE_SUPPLY_DATE_MAPPED', IF(COUNT(*) = 0, 1, 0)
FROM temp_v2_write_supply_unmapped
WHERE unmapped_reason = 'FUTURE_DATE_NOT_IN_DAILY_SALES';

CREATE TEMPORARY TABLE temp_v2_write_projection_input AS
SELECT
    scope.asin,
    scope.country,
    scope.shop,
    scope.`date`,
    scope.inventory AS actual_inventory,
    CAST(COALESCE(scope.maybe_sales, 0) AS SIGNED) AS demand,
    scope.weighted_sales,
    NULLIF(CAST(COALESCE(supply.remaining, 0) AS SIGNED), 0) AS v2_add
FROM temp_v2_write_scope_dates AS scope
LEFT JOIN temp_v2_write_supply AS supply
    ON supply.asin = scope.asin
   AND supply.country = scope.country
   AND supply.shop = scope.shop
   AND supply.expected_storage_time = scope.`date`;

ALTER TABLE temp_v2_write_projection_input
    ADD INDEX idx_v2_write_input_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_write_projection_seed AS
SELECT
    asin,
    country,
    shop,
    `date`,
    actual_inventory,
    demand,
    v2_add
FROM temp_v2_write_projection_input
WHERE `date` = CURDATE();

ALTER TABLE temp_v2_write_projection_seed
    ADD INDEX idx_v2_write_seed_key (asin, country, shop, `date`);

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'SEED_ROW_COUNT_COMPLETE', IF(
    (SELECT COUNT(*) FROM temp_v2_write_projection_seed)
    = (SELECT COUNT(*) FROM temp_v2_write_scope_keys),
    1,
    0
);

CREATE TEMPORARY TABLE temp_v2_write_inventory_prediction AS
WITH RECURSIVE inventory_calc AS (
    SELECT
        seed.asin,
        seed.country,
        seed.shop,
        seed.`date`,
        CAST(
            CAST(seed.actual_inventory AS SIGNED)
            + CAST(COALESCE(seed.v2_add, 0) AS SIGNED)
            AS SIGNED
        ) AS calc_inventory,
        CAST(seed.demand AS SIGNED) AS demand
    FROM temp_v2_write_projection_seed AS seed

    UNION ALL

    SELECT
        input.asin,
        input.country,
        input.shop,
        input.`date`,
        CAST(
            CASE
                WHEN COALESCE(input.v2_add, 0) > 0
                 AND (previous.calc_inventory - previous.demand) < 0
                THEN CAST(input.v2_add AS SIGNED)
                ELSE previous.calc_inventory
                     - previous.demand
                     + CAST(COALESCE(input.v2_add, 0) AS SIGNED)
            END
            AS SIGNED
        ) AS calc_inventory,
        CAST(input.demand AS SIGNED) AS demand
    FROM temp_v2_write_projection_input AS input
    INNER JOIN inventory_calc AS previous
        ON input.asin = previous.asin
       AND input.country = previous.country
       AND input.shop = previous.shop
       AND input.`date` = DATE_ADD(previous.`date`, INTERVAL 1 DAY)
)
SELECT asin, country, shop, `date`, calc_inventory
FROM inventory_calc;

ALTER TABLE temp_v2_write_inventory_prediction
    ADD INDEX idx_v2_write_prediction_key (asin, country, shop, `date`);

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'RECURSION_ROW_COUNT_COMPLETE', IF(
    (SELECT COUNT(*) FROM temp_v2_write_inventory_prediction)
    = (SELECT COUNT(*) FROM temp_v2_write_projection_input),
    1,
    0
);

CREATE TEMPORARY TABLE temp_v2_write_branch_stage AS
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
FROM temp_v2_write_inventory_prediction AS prediction
INNER JOIN temp_v2_write_projection_input AS input
    ON input.asin = prediction.asin
   AND input.country = prediction.country
   AND input.shop = prediction.shop
   AND input.`date` = prediction.`date`;

ALTER TABLE temp_v2_write_branch_stage
    ADD INDEX idx_v2_write_branch_stage_key (asin, country, shop, `date`);

CREATE TEMPORARY TABLE temp_v2_write_stage AS
SELECT * FROM temp_v2_write_branch_stage;

ALTER TABLE temp_v2_write_stage
    ADD INDEX idx_v2_write_stage_key (asin, country, shop, `date`);

INSERT INTO temp_v2_write_guard (guard_name, guard_value)
SELECT 'WRITE_STAGE_COVERS_FUTURE', IF(
    (SELECT COUNT(*) FROM temp_v2_write_stage)
    = (SELECT COUNT(*) FROM temp_v2_write_scope_dates),
    1,
    0
);

SET @v2_write_failed_guard_count = (
    SELECT COUNT(*)
    FROM temp_v2_write_guard
    WHERE guard_value = 0
);
SET @v2_write_failed_guard_names = (
    SELECT GROUP_CONCAT(guard_name ORDER BY guard_name SEPARATOR ',')
    FROM temp_v2_write_guard
    WHERE guard_value = 0
);
SET @v2_write_guard_results = (
    SELECT GROUP_CONCAT(
        CONCAT(guard_name, '=', guard_value)
        ORDER BY guard_name
        SEPARATOR ','
    )
    FROM temp_v2_write_guard
);
SET @v2_write_stage_rows = (SELECT COUNT(*) FROM temp_v2_write_stage);
SET @v2_write_add_nonnull_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_stage
    WHERE v2_add IS NOT NULL
);
SET @v2_write_supply_rows = (SELECT COUNT(*) FROM temp_v2_write_supply);
SET @v2_write_min_inventory = (SELECT MIN(v2_inventory) FROM temp_v2_write_stage);
SET @v2_write_max_inventory = (SELECT MAX(v2_inventory) FROM temp_v2_write_stage);
SET @v2_write_min_days = (SELECT MIN(v2_days_for_sale) FROM temp_v2_write_stage);
SET @v2_write_max_days = (SELECT MAX(v2_days_for_sale) FROM temp_v2_write_stage);
SET @v2_write_unmapped_future_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_supply_unmapped
    WHERE unmapped_reason = 'FUTURE_DATE_NOT_IN_DAILY_SALES'
);
SET @v2_write_invalid_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_supply_unmapped
    WHERE unmapped_reason IN (
        'INCOMPLETE_BUSINESS_KEY',
        'MISSING_EXPECTED_STORAGE_TIME'
    )
);
SET @v2_write_out_of_scope_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_supply_unmapped
    WHERE unmapped_reason = 'OUT_OF_SCOPE'
);
SET @v2_write_past_supply_rows = (
    SELECT COUNT(*)
    FROM temp_v2_write_supply_unmapped
    WHERE unmapped_reason = 'PAST_DATE_OUTSIDE_PROJECTION'
);
SET @v2_write_unmapped_supply_summary = (
    SELECT GROUP_CONCAT(
        CONCAT(unmapped_reason, '=', reason_count)
        ORDER BY unmapped_reason
        SEPARATOR ','
    )
    FROM (
        SELECT unmapped_reason, COUNT(*) AS reason_count
        FROM temp_v2_write_supply_unmapped
        GROUP BY unmapped_reason
    ) AS reason_counts
);

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
WHERE @v2_write_failed_guard_count = 0
  AND target.`date` >= CURDATE()
  AND target.shop = '合计'
  AND (
        target.v2_calculated_at IS NULL
        OR target.v2_calculated_at <= stage.v2_calculated_at
      );

SET @v2_write_changed_rows = ROW_COUNT();

DROP TEMPORARY TABLE IF EXISTS temp_v2_write_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_branch_stage;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_inventory_prediction;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_projection_seed;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_projection_input;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_supply;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_supply_unmapped;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_supply_raw;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_scope_gaps;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_scope_keys;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_scope_dates;
DROP TEMPORARY TABLE IF EXISTS temp_v2_write_guard;

SELECT
    IF(
        @v2_write_failed_guard_count = 0,
        'WRITE_OK',
        'GUARD_FAILED'
    ) AS write_status,
    @v2_calculated_at AS calculated_at,
    @v2_write_stage_rows AS staged_rows,
    @v2_write_changed_rows AS changed_rows,
    @v2_write_supply_rows AS mapped_supply_rows,
    @v2_write_add_nonnull_rows AS v2_add_nonnull_rows,
    @v2_write_min_inventory AS min_v2_inventory,
    @v2_write_max_inventory AS max_v2_inventory,
    @v2_write_min_days AS min_v2_days_for_sale,
    @v2_write_max_days AS max_v2_days_for_sale,
    @v2_write_failed_guard_count AS failed_guard_count,
    @v2_write_failed_guard_names AS failed_guard_names,
    @v2_write_guard_results AS guard_results,
    @v2_write_unmapped_future_supply_rows AS unmapped_future_supply_rows,
    @v2_write_invalid_supply_rows AS ignored_invalid_supply_rows,
    @v2_write_out_of_scope_supply_rows AS ignored_out_of_scope_supply_rows,
    @v2_write_past_supply_rows AS ignored_past_supply_rows,
    @v2_write_unmapped_supply_summary AS unmapped_supply_summary;
