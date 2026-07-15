WITH base AS (
    /* 1. 汇总真实发货数据：只统计 delivery_note 中 status = 已发货 的单 */
    SELECT
        dn.shop,
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
        SUM(dn.quantity_shipped)      AS qty_shipped,
        SUM(COALESCE(fs.received, 0)) AS received
    FROM delivery_note AS dn
             LEFT JOIN channel_lead_time AS clt
                       ON TRIM(UPPER(dn.logistics_provider_name)) = TRIM(UPPER(clt.logistics_provider))
                           AND TRIM(UPPER(dn.logistics_channel_name))  = TRIM(UPPER(clt.channel))
             LEFT JOIN time_to_warehouse AS ttw
                       ON TRIM(UPPER(dn.country)) = TRIM(UPPER(ttw.country))
                           AND (
                                   CASE
                                       WHEN DATE_FORMAT(DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY), '%m-%d') BETWEEN '06-10' AND '07-10'
                                           OR DATE_FORMAT(DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY), '%m-%d') BETWEEN '09-10' AND '10-10'
                                           OR DATE_FORMAT(DATE_ADD(dn.shipment_time, INTERVAL IFNULL(clt.days, 0) DAY), '%m-%d') BETWEEN '11-01' AND '12-15'
                                           THEN '旺季' ELSE '淡季'
                                       END
                                   ) = ttw.season
             LEFT JOIN (
        SELECT shippment_id, msku, `apply`, SUM(received) AS received
        FROM fba_ship
        GROUP BY shippment_id, msku, `apply`
    ) AS fs
                       ON fs.shippment_id = dn.shipment_id
                           AND fs.msku         = dn.msku
                           AND fs.`apply`      = dn.quantity_shipped
    WHERE (
              TRIM(dn.status) = '已发货'
              OR (
                  TRIM(dn.status) = '待配货'
                  AND COALESCE(fs.received, 0) > 0
              )
          )
      AND (TRIM(dn.state) != '已索赔' OR dn.state IS NULL)
    GROUP BY
        dn.shop,
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

     union_all AS (
         /* 2. 合并真实发货单和模拟发货单 */

         -- A: 真实已发货单
         SELECT
             shop,
             country,
             asin,
             expected_storage_time,
             qty_shipped,
             received,
             0 AS sim_qty
         FROM base

         UNION ALL

         -- B: 模拟单
         SELECT
             sim.shop,
             sim.country,
             sim.asin,
             DATE(sim.add_date) AS expected_storage_time,
             0 AS qty_shipped,
             0 AS received,
             sim.number AS sim_qty
         FROM simulate_shipment sim
         WHERE COALESCE(sim.plan_source, '') <> 'shipment_plan_v2'
           AND (
                   (
                       sim.shippment_id IS NOT NULL
                           AND sim.shippment_id <> ''
                           AND NOT EXISTS (
                           SELECT 1
                           FROM delivery_note dn
                           WHERE TRIM(UPPER(dn.shipment_id)) = TRIM(UPPER(sim.shippment_id))
                             AND TRIM(UPPER(dn.asin))        = TRIM(UPPER(sim.asin))
                              AND (
                                      TRIM(dn.status) = '已发货'
                                      OR (
                                          TRIM(dn.status) = '待配货'
                                          AND EXISTS (
                                              SELECT 1
                                              FROM fba_ship fs2
                                              WHERE fs2.shippment_id = dn.shipment_id
                                                AND fs2.msku         = dn.msku
                                                AND fs2.`apply`      = dn.quantity_shipped
                                                AND COALESCE(fs2.received, 0) > 0
                                          )
                                      )
                                  )
                              AND (TRIM(dn.state) != '已索赔' OR dn.state IS NULL)
                       )
                       )
                       OR
                   (
                       sim.shippment_id IS NULL
                           OR sim.shippment_id = ''
                       )
                   )
      ),

     final AS (
         /* 3. 最终汇总 */
         SELECT
             ua.shop,
             ua.country,
             ua.asin,
             ua.expected_storage_time,
             SUM(ua.qty_shipped) AS total_qty_shipped,
             SUM(ua.received)    AS total_received,
             SUM(ua.qty_shipped - ua.received + ua.sim_qty) AS remaining
         FROM union_all ua
         GROUP BY
             ua.shop,
             ua.country,
             ua.asin,
             ua.expected_storage_time
     )

SELECT
    CONCAT(
            shop,
            '_',
            country,
            '_',
            asin,
            '_',
            DATE_FORMAT(expected_storage_time, '%Y%m%d')
    ) AS asin_country_shop_date,
    shop,
    country,
    asin,
    expected_storage_time,
    total_qty_shipped AS qty_shipped,
    total_received AS received,
    remaining
FROM final
WHERE total_qty_shipped <> 0
   OR total_received <> 0
   OR remaining <> 0
ORDER BY
    shop,
    country,
    asin,
    expected_storage_time;
