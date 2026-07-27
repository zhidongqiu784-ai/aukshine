UPDATE sales_coefficient AS sc
INNER JOIN (
    WITH store_activity_rows AS (
        SELECT
            ds.asin,
            ds.country,
            ds.date,
            REPLACE(
                REPLACE(
                    REPLACE(ds.type, '、', ','),
                    '，',
                    ','
                ),
                ' ',
                ''
            ) AS activity_type
        FROM daily_sales AS ds
        WHERE ds.shop <> '合计'
          AND ds.date < CURDATE()
          AND ds.type IS NOT NULL

          -- 排除复合日类型，只识别店铺行中的单一基础活动类型。
          AND REPLACE(
                  REPLACE(
                      REPLACE(ds.type, '、', ','),
                      '，',
                      ','
                  ),
                  ' ',
                  ''
              ) NOT LIKE '%,%'

          AND EXISTS (
              SELECT 1
              FROM datetypetime AS dtt
              WHERE dtt.daytype = REPLACE(
                        REPLACE(
                            REPLACE(ds.type, '、', ','),
                            '，',
                            ','
                        ),
                        ' ',
                        ''
                    )
                AND dtt.daytype_category = '基础活动类型'
                AND FIND_IN_SET(ds.country, dtt.country) > 0
          )
    ),
    activity_days AS (
        SELECT
            asin,
            country,
            date,
            MIN(activity_type) AS activity_type
        FROM store_activity_rows
        GROUP BY asin, country, date

        -- 同日同时出现多个基础活动类型时无法归属合计销量，排除该日期。
        HAVING COUNT(DISTINCT activity_type) = 1
    ),
    summary_samples AS (
        SELECT
            ad.asin,
            ad.country,
            ad.activity_type,
            summary_row.date,
            summary_row.sales,
            summary_row.weighted_sales
        FROM activity_days AS ad
        INNER JOIN daily_sales AS summary_row
            ON summary_row.asin = ad.asin
           AND summary_row.country = ad.country
           AND summary_row.date = ad.date
           AND summary_row.shop = '合计'
        WHERE summary_row.sales IS NOT NULL
          AND summary_row.weighted_sales IS NOT NULL
          AND summary_row.weighted_sales <> 0
    )
    SELECT
        samples.asin,
        samples.country,
        samples.activity_type,
        ROUND(
            SUM(samples.sales) / NULLIF(SUM(samples.weighted_sales), 0),
            2
        ) AS calculated_coefficient
    FROM summary_samples AS samples
    GROUP BY
        samples.asin,
        samples.country,
        samples.activity_type
    HAVING calculated_coefficient IS NOT NULL
) AS calc
    ON calc.asin = sc.asin
   AND calc.country = sc.country
   AND calc.activity_type = sc.type
SET
    sc.coefficient = calc.calculated_coefficient
WHERE sc.type != '日常';
