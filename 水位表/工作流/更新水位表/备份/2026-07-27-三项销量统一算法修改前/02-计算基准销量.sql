-- 工作流：更新水位表
-- 节点序号：2
-- 节点名称：将同一country、asin、date下的基准销量设置为合并销量(sales)/max(coefficient)，更新今天及以后的数据

UPDATE daily_sales ds
JOIN (
    SELECT 
        asin,
        country,
        date,
        SUM(sales) AS total_sales,
        MAX(coefficient) AS max_coefficient,
        -- ⭐ 使用 NULLIF 避免除以零
        GREATEST(
            SUM(sales) / NULLIF(MAX(coefficient), 0), 
            0
        ) AS calculated_base_sales
    FROM daily_sales
    WHERE shop != '合计'
    GROUP BY asin, country, date
) agg ON ds.asin = agg.asin 
      AND ds.country = agg.country 
      AND ds.date = agg.date
SET ds.base_sales = agg.calculated_base_sales
WHERE ds.shop != '合计' 
  AND ds.date >= CURDATE();
