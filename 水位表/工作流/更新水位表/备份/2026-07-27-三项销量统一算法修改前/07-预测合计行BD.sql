-- 工作流：更新水位表
-- 节点序号：7
-- 节点名称：合计行BD预测

SET SESSION cte_max_recursion_depth = 1000;

DROP TEMPORARY TABLE IF EXISTS temp_summary_bd_prediction_days;

CREATE TEMPORARY TABLE temp_summary_bd_prediction_days AS
WITH RECURSIVE
real_bd_days AS (
    SELECT
        asin,
        country,
        `date`,
        CASE
            WHEN country IN ('DE', 'FR', 'ES', 'IT', 'UK') THEN 8
            ELSE 22
        END AS gap_days,
        DATE_SUB(
            `date`,
            INTERVAL ROW_NUMBER() OVER (
                PARTITION BY asin, country
                ORDER BY `date`
            ) DAY
        ) AS grp_key
    FROM daily_sales ds
    WHERE shop = '合计'
      AND type IS NOT NULL
      AND type NOT LIKE '%预测%'
      AND EXISTS (
          SELECT 1
          FROM datetypetime dtt
          WHERE dtt.daytype IS NOT NULL
            AND dtt.daytype_category <> '固定活动类型'
            AND dtt.daytype LIKE 'BD%'
            AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
            AND FIND_IN_SET(ds.country, dtt.country) > 0
      )
      AND asin IS NOT NULL
      AND asin != ''
      AND country IN ('US', 'CA', 'JP', 'DE', 'FR', 'ES', 'IT', 'UK')
      AND `date` BETWEEN DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                      AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
),
real_bd_segments AS (
    SELECT
        asin,
        country,
        MIN(`date`) AS bd_start_date,
        MAX(`date`) AS bd_end_date,
        MAX(gap_days) AS gap_days
    FROM real_bd_days
    GROUP BY asin, country, grp_key
),
last_bd AS (
    SELECT
        real_bd_segments.*,
        ROW_NUMBER() OVER (
            PARTITION BY asin, country
            ORDER BY bd_end_date DESC, bd_start_date DESC
        ) AS rn
    FROM real_bd_segments
),
predicted_bd AS (
    SELECT
        asin,
        country,
        gap_days,
        DATE_ADD(bd_end_date, INTERVAL gap_days DAY) AS pred_start_date
    FROM last_bd
    WHERE rn = 1

    UNION ALL

    SELECT
        asin,
        country,
        gap_days,
        DATE_ADD(pred_start_date, INTERVAL (13 + gap_days) DAY) AS pred_start_date
    FROM predicted_bd
    WHERE pred_start_date <= DATE_ADD(CURDATE(), INTERVAL 180 DAY)
),
blocked_days AS (
    SELECT
        asin,
        country,
        type,
        `date`,
        DATE_SUB(
            `date`,
            INTERVAL ROW_NUMBER() OVER (
                PARTITION BY asin, country, type
                ORDER BY `date`
            ) DAY
        ) AS grp_key
    FROM daily_sales ds
    WHERE shop = '合计'
      AND type IS NOT NULL
      AND type NOT LIKE '%预测%'
      AND EXISTS (
          SELECT 1
          FROM datetypetime dtt
          WHERE dtt.daytype IS NOT NULL
            AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
            AND dtt.daytype_category <> '固定活动类型'
            AND (
                   dtt.daytype LIKE 'BD%'
                OR dtt.daytype LIKE 'LD%'
                OR dtt.daytype_category = '专享类型'
            )
            AND FIND_IN_SET(ds.country, dtt.country) > 0
      )
      AND `date` BETWEEN DATE_SUB(CURDATE(), INTERVAL 365 DAY)
                      AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
),
blocked_segments AS (
    SELECT
        asin,
        country,
        MIN(`date`) AS block_start_date,
        MAX(`date`) AS block_end_date
    FROM blocked_days
    GROUP BY asin, country, type, grp_key
),
valid_predicted_bd AS (
    SELECT
        p.asin,
        p.country,
        p.pred_start_date,
        DATE_ADD(p.pred_start_date, INTERVAL 13 DAY) AS pred_end_date
    FROM predicted_bd p
    WHERE p.pred_start_date BETWEEN DATE_ADD(CURDATE(), INTERVAL 8 DAY)
                                AND DATE_ADD(CURDATE(), INTERVAL 180 DAY)
      AND NOT EXISTS (
          SELECT 1
          FROM blocked_segments bs
          WHERE bs.asin = p.asin
            AND bs.country = p.country
            AND (
                (
                    bs.block_start_date <= DATE_ADD(p.pred_start_date, INTERVAL 13 DAY)
                    AND bs.block_end_date >= p.pred_start_date
                )
                OR ABS(DATEDIFF(bs.block_start_date, p.pred_start_date)) <= 7
            )
      )
),
day_offsets AS (
    SELECT 0 AS day_offset
    UNION ALL
    SELECT day_offset + 1
    FROM day_offsets
    WHERE day_offset < 13
)
SELECT
    vpb.asin,
    vpb.country,
    DATE_ADD(vpb.pred_start_date, INTERVAL day_offsets.day_offset DAY) AS pred_date
FROM valid_predicted_bd vpb
INNER JOIN day_offsets ON 1 = 1
WHERE DATE_ADD(vpb.pred_start_date, INTERVAL day_offsets.day_offset DAY)
      BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

ALTER TABLE temp_summary_bd_prediction_days
ADD INDEX idx_summary_pred (asin, country, pred_date);

UPDATE daily_sales ds
INNER JOIN temp_summary_bd_prediction_days pred
    ON ds.asin = pred.asin
   AND ds.country = pred.country
   AND ds.date = pred.pred_date
SET ds.type = 'BD（预测）'
WHERE ds.shop = '合计'
  AND (
      ds.type IS NULL
      OR TRIM(ds.type) = ''
      OR NOT EXISTS (
          SELECT 1
          FROM datetypetime dtt
          WHERE dtt.daytype IS NOT NULL
            AND FIND_IN_SET(dtt.daytype, REPLACE(ds.type, '、', ',')) > 0
            AND dtt.daytype_category <> '固定活动类型'
            AND (
                   dtt.daytype LIKE 'BD%'
                OR dtt.daytype LIKE 'LD%'
                OR dtt.daytype_category = '专享类型'
            )
            AND FIND_IN_SET(ds.country, dtt.country) > 0
      )
  )
  AND ds.date BETWEEN CURDATE()
                  AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

UPDATE daily_sales ds
INNER JOIN sales_coefficient sc
    ON ds.asin = sc.asin
   AND ds.country = sc.country
   AND sc.type = 'BD'
SET ds.coefficient = sc.coefficient
WHERE ds.shop = '合计'
  AND ds.type = 'BD（预测）'
  AND ds.`date` BETWEEN CURDATE()
                    AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

UPDATE daily_sales
SET maybe_sales = weighted_sales * coefficient
WHERE shop = '合计'
  AND type = 'BD（预测）'
  AND date BETWEEN CURDATE()
              AND DATE_ADD(CURDATE(), INTERVAL 180 DAY);

DROP TEMPORARY TABLE IF EXISTS temp_summary_bd_prediction_days;
