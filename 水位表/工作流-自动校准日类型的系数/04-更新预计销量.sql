UPDATE nocobase.daily_sales
SET maybe_sales = weighted_sales * coefficient
WHERE date >= CURRENT_DATE;
