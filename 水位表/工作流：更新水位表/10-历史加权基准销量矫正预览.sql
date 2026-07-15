-- 历史加权基准销量矫正预览
-- 只读：不会修改任何数据。
-- 口径：仅合计行、仅历史日期、过去30天基准销量完整、差异绝对值大于1。

WITH target_rows AS (
    SELECT
        shop_country_asin_date,
        asin,
        country,
        `date` AS target_date,
        weighted_sales AS old_weighted_sales
    FROM daily_sales
    WHERE shop = '合计'
      AND `date` < CURDATE()
      AND weighted_sales IS NOT NULL
),
history_ranked AS (
    SELECT
        t.shop_country_asin_date,
        t.asin,
        t.country,
        t.target_date,
        t.old_weighted_sales,
        h.base_sales,
        ROW_NUMBER() OVER (
            PARTITION BY t.shop_country_asin_date
            ORDER BY h.`date` DESC
        ) AS row_num,
        COUNT(*) OVER (
            PARTITION BY t.shop_country_asin_date
        ) AS history_count
    FROM target_rows t
    INNER JOIN daily_sales h
        ON h.asin = t.asin
       AND h.country = t.country
       AND h.shop = '合计'
       AND h.`date` BETWEEN DATE_SUB(t.target_date, INTERVAL 30 DAY)
                        AND DATE_SUB(t.target_date, INTERVAL 1 DAY)
    WHERE h.base_sales IS NOT NULL
),
recalculated AS (
    SELECT
        shop_country_asin_date,
        asin,
        country,
        target_date,
        old_weighted_sales,
        MAX(history_count) AS history_count,
        ROUND(
            AVG(CASE WHEN row_num BETWEEN 1 AND 7 THEN base_sales END) * 0.5
          + AVG(CASE WHEN row_num BETWEEN 8 AND 15 THEN base_sales END) * 0.3
          + AVG(CASE WHEN row_num BETWEEN 16 AND 30 THEN base_sales END) * 0.2,
            1
        ) AS new_weighted_sales
    FROM history_ranked
    GROUP BY
        shop_country_asin_date,
        asin,
        country,
        target_date,
        old_weighted_sales
),
candidates AS (
    SELECT
        shop_country_asin_date,
        asin,
        country,
        target_date,
        old_weighted_sales,
        new_weighted_sales,
        ROUND(old_weighted_sales - new_weighted_sales, 1) AS difference
    FROM recalculated
    WHERE history_count = 30
      AND ABS(old_weighted_sales - new_weighted_sales) > 1
)
SELECT
    COUNT(*) OVER () AS candidate_count,
    shop_country_asin_date,
    asin,
    country,
    target_date,
    old_weighted_sales,
    new_weighted_sales,
    difference
FROM candidates
ORDER BY ABS(difference) DESC, asin, country, target_date;
