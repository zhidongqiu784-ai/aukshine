-- 工作流：更新水位表
-- 节点序号：3
-- 节点名称：更新每个店铺的加权基准销量weighted_sales 字段，使其在同一国家、ASIN和日期下保持一致。更新今天及以后的数据

UPDATE daily_sales AS d
JOIN (
    WITH base_sales_calc AS (
        SELECT
            asin,
            country,
            date,
            SUM(sales) / NULLIF(MAX(coefficient), 0) AS daily_base_sales
        FROM daily_sales
        WHERE shop <> '合计'
          AND date BETWEEN DATE_SUB(CURDATE(), INTERVAL 30 DAY) AND DATE_SUB(CURDATE(), INTERVAL 1 DAY)
        GROUP BY asin, country, date
    ),
    sales_history AS (
        SELECT
            asin,
            country,
            daily_base_sales,
            ROW_NUMBER() OVER (PARTITION BY asin, country ORDER BY date DESC) AS row_num,
            COUNT(*) OVER (PARTITION BY asin, country) AS total_count
        FROM base_sales_calc
    ),
    weighted_avg AS (
        SELECT
            asin,
            country,
            ROUND(
                CASE
                    WHEN total_count BETWEEN 1 AND 3 THEN
                        AVG(daily_base_sales)
                    WHEN total_count BETWEEN 4 AND 7 THEN
                        (COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND CEIL(total_count*0.3) THEN daily_base_sales END), 0) * 0.7 +
                         COALESCE(AVG(CASE WHEN row_num > CEIL(total_count*0.3) THEN daily_base_sales END), 0) * 0.3)
                    WHEN total_count BETWEEN 8 AND 15 THEN
                        (COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND CEIL(total_count*0.33) THEN daily_base_sales END), 0) * 0.6 +
                         COALESCE(AVG(CASE WHEN row_num BETWEEN CEIL(total_count*0.33)+1 AND CEIL(total_count*0.66) THEN daily_base_sales END), 0) * 0.3 +
                         COALESCE(AVG(CASE WHEN row_num > CEIL(total_count*0.66) THEN daily_base_sales END), 0) * 0.1)
                    WHEN total_count BETWEEN 16 AND 29 THEN
                        (COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND 7 THEN daily_base_sales END), 0) * 0.55 +
                         COALESCE(AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN daily_base_sales END), 0) * 0.35 +
                         COALESCE(AVG(CASE WHEN row_num BETWEEN 16 AND total_count THEN daily_base_sales END), 0) * 0.1)
                    ELSE
                        (COALESCE(AVG(CASE WHEN row_num BETWEEN 1 AND 7 THEN daily_base_sales END), 0) * 0.5 +
                         COALESCE(AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN daily_base_sales END), 0) * 0.3 +
                         COALESCE(AVG(CASE WHEN row_num BETWEEN 16 AND 30 THEN daily_base_sales END), 0) * 0.2)
                END
            , 1) AS weighted_sales_value
        FROM sales_history
        GROUP BY asin, country
    )
    SELECT
        d2.asin,
        d2.country,
        d2.date,
        w.weighted_sales_value
    FROM daily_sales d2
    JOIN weighted_avg w ON d2.asin = w.asin AND d2.country = w.country
    WHERE d2.date IS NOT NULL
) AS r
  ON r.asin = d.asin
 AND r.country = d.country
 AND r.date = d.date
SET d.weighted_sales = r.weighted_sales_value
WHERE d.shop <> '合计' AND d.date >= CURDATE();
