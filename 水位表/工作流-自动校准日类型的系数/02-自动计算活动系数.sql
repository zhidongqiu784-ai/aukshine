UPDATE sales_coefficient AS sc
INNER JOIN (
    SELECT
        ds.asin,
        ds.country,
        REPLACE(
            REPLACE(
                REPLACE(ds.type, '、', ','),
                '，',
                ','
            ),
            ' ',
            ''
        ) AS normalized_type,
        ROUND(
            SUM(ds.sales) / NULLIF(SUM(ds.weighted_sales), 0),
            2
        ) AS calculated_coefficient
    FROM daily_sales AS ds
    WHERE ds.shop = '合计'
      AND ds.date < CURDATE()
      AND ds.sales IS NOT NULL
      AND ds.weighted_sales IS NOT NULL
      AND ds.weighted_sales != 0

      -- 排除复合日类型
      AND REPLACE(
              REPLACE(
                  REPLACE(ds.type, '、', ','),
                  '，',
                  ','
              ),
              ' ',
              ''
          ) NOT LIKE '%,%'

      -- 只计算基础活动类型
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
    GROUP BY
        ds.asin,
        ds.country,
        REPLACE(
            REPLACE(
                REPLACE(ds.type, '、', ','),
                '，',
                ','
            ),
            ' ',
            ''
        )
    HAVING calculated_coefficient IS NOT NULL
) AS calc
    ON calc.asin = sc.asin
   AND calc.country = sc.country
   AND calc.normalized_type = sc.type
SET
    sc.coefficient = calc.calculated_coefficient
WHERE sc.type != '日常';
