UPDATE nocobase.daily_sales
SET maybe_sales = CAST(ROUND(weighted_sales * coefficient, 0) AS SIGNED)
WHERE date >= CURRENT_DATE;
