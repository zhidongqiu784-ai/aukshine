-- 工作流：更新水位表
-- 节点序号：2
-- 节点名称：将同一country、asin、date下的基准销量设置为合并销量(sales)/代表日类型系数，更新今天及以后的数据

UPDATE daily_sales ds
JOIN (
    SELECT 
        asin,
        country,
        date,
        SUM(sales) AS total_sales,
        MAX(CASE WHEN type_rank = 1 THEN coefficient END) AS target_coefficient,
        CAST(
            ROUND(SUM(sales) / NULLIF(MAX(CASE WHEN type_rank = 1 THEN coefficient END), 0), 0)
            AS SIGNED
        ) AS calculated_base_sales
    FROM (
        SELECT
            asin,
            country,
            date,
            shop,
            sales,
            coefficient,
            type,
            ROW_NUMBER() OVER (
                PARTITION BY asin, country, date
                ORDER BY
                    category_priority,
                    coefficient IS NULL,
                    coefficient DESC,
                    type DESC,
                    shop DESC
            ) AS type_rank
        FROM (
            SELECT
                base.asin,
                base.country,
                base.date,
                base.shop,
                base.sales,
                base.coefficient,
                base.type,
                COALESCE((
                    SELECT MIN(
                        CASE dtt.daytype_category
                            WHEN '大促BDLD' THEN 1
                            WHEN '基础活动类型' THEN 2
                            WHEN '专享类型' THEN 3
                            WHEN '固定活动类型' THEN 4
                            WHEN '叠加基础类型' THEN 5
                            WHEN '基础类型' THEN 6
                            WHEN '不参与' THEN 7
                            ELSE 9
                        END
                    )
                    FROM datetypetime AS dtt
                    WHERE dtt.daytype IS NOT NULL
                      AND base.type IS NOT NULL
                      AND FIND_IN_SET(dtt.daytype, REPLACE(base.type, '、', ',')) > 0
                      AND FIND_IN_SET(base.country, dtt.country) > 0
                ), 9) AS category_priority
            FROM daily_sales AS base
            WHERE base.shop != '合计'
        ) categorized
    ) ranked
    GROUP BY asin, country, date
) agg ON ds.asin = agg.asin 
      AND ds.country = agg.country 
      AND ds.date = agg.date
SET ds.base_sales = agg.calculated_base_sales
WHERE ds.shop != '合计' 
  AND ds.date >= CURDATE();
