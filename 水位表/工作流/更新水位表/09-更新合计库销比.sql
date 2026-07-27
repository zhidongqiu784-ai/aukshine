-- 工作流：更新水位表
-- 节点序号：9
-- 节点名称：更新今天及未来汇总数据的库销比（inv_sales_ratio）

UPDATE daily_sales
SET inv_sales_ratio = ROUND(
    (
        COALESCE(on_the_way, 0)
      + COALESCE(inventory, 0)
      + COALESCE(quantity_receive, 0)
      + COALESCE(overseas_warehouse_test_product, 0)
      + COALESCE(overseas_warehouse_new_product, 0)
    ) / NULLIF(weighted_sales, 0) / 30,
    2
)
WHERE shop = '合计'
  AND date >= CURDATE();
