# 水位表一栏 SQL 说明

## 整体作用

这份 SQL 生成“当天水位表一栏”数据。主维度是：

- `asin + country`

驱动表是 `daily_sales` 当天、`shop = '合计'` 的记录。然后补充：

- 实时库存
- 在途
- 预计断货日期
- 店铺明细
- 负责人
- 库销比
- 状态

最终只保留：

- `a.maintenance_level <> '变体'`
- `a.status IN ('新品', '普通', '重点')`

---

## base_target / base_keys

来源表：`daily_sales`

过滤条件：

- `date = CURRENT_DATE`
- `shop = '合计'`

作用：

- `base_target` 取当天合计行，作为主查询基础。
- `base_keys` 只保留 `asin + country`，后续所有子查询都只计算这些目标商品。

取出的字段：

- `asin`
- `country`
- `model`
- `weighted_sales`
- `maybe_sales`
- `date`
- `type`
- `coefficient`
- `overseas_warehouse_test_product`
- `overseas_warehouse_new_product`
- `quantity_receive`
- `days_on_sale`

---

## on_the_way 在途

来源表：`delivery_note`

当前口径：

- 当前 `ASIN + 国家` 下，预计今天或未来入库、未索赔发货单中，正数 `on_the_way` 的合计。

日期判断：

- 优先使用 `dn.estimated_arrival_date`。
- 如果 `estimated_arrival_date` 为空字符串或 `NULL`，则使用 `dn.expected_storage_time`。
- 日期必须大于等于今天。

对应表达式：

- `COALESCE(NULLIF(TRIM(dn.estimated_arrival_date), ''), dn.expected_storage_time) >= CURRENT_DATE`

状态条件：

- `dn.state != '已索赔' OR dn.state IS NULL`

数量计算：

- `dn.on_the_way > 0` 才参与累计。
- `dn.on_the_way = 0` 不影响结果。
- `dn.on_the_way IS NULL` 按 0 处理。
- `dn.on_the_way < 0` 不参与计算，也不抵扣其他正数。

对应表达式：

- `CASE WHEN COALESCE(dn.on_the_way, 0) > 0 THEN dn.on_the_way ELSE 0 END`

分组方式：

- `otw_base` 先按 `shop + country + asin + 日期` 分组。
- `otw_agg` 再按 `country + asin` 汇总成最终 `on_the_way`。

当前不再使用：

- `simulate_shipment`
- `quantity_shipped - received`
- `fba_ship.received`

---

## 店铺明细 shop_pivot

来源表：

- `daily_sales`
- `inventory_base`
- `woot_statistics`
- `shop`

作用：

- 为每个 `asin + country` 生成最多 8 个店铺字段。

输出字段：

- `shop1` 到 `shop8`
- `shop_display2` 到 `shop_display8`

店铺来源：

- `daily_sales` 当天合计行，固定作为 `合计`。
- `inventory_base` 当天存在库存记录的店铺。
- `woot_statistics` 中出现过的 `ASIN + 国家`，额外补一个 `woot` 店铺。

排序规则：

- `合计` 永远排第一。
- 其他店铺按当天销量倒序。
- 销量相同按店铺名升序。

展示名规则：

- `合计` 显示为 `合计`。
- 店铺在 `shop` 表有 `type` 时，显示为 `店铺名-type`。
- 否则显示店铺名。

注意：

- `shop_pivot` 中保留 `rn <= 20`，但最终只输出 `rn = 1` 到 `rn = 8`。

---

## inventory 实时库存

来源表：`inventory_base`

过滤条件：

- `ib.date = CURRENT_DATE`

计算公式：

- `SUM(COALESCE(ib.afn_fulfillable_quantity, 0) + COALESCE(ib.reserved_fc_transfers, 0))`

业务含义：

- 可售库存 + 调拨中库存

最终字段：

- `COALESCE(inv.real_inventory, 0) AS inventory`

取整规则：

- 不取整，直接求和。

---

## expected_stockout_date / days_for_sale

来源表：`daily_sales`

过滤条件：

- `shop = '合计'`
- `date >= CURRENT_DATE`
- `inventory < 0`

计算公式：

- `MIN(ds.date) AS first_stockout_date`

业务含义：

- 从今天开始，第一次合计库存小于 0 的日期。

最终字段：

- `expected_stockout_date = first_stockout_date`

`days_for_sale` 规则：

- 如果 `first_stockout_date IS NULL`，返回 `大于180天`。
- 否则返回 `DATEDIFF(first_stockout_date, ds.date)`。

取整规则：

- 不额外取整。
- `DATEDIFF` 本身返回整数天数。

---

## product_label 产品阶段

来源字段：`daily_sales.days_on_sale`

规则：

- `days_on_sale IS NULL`：返回 `NULL`
- `days_on_sale < 90`：返回 `新品期`
- `days_on_sale >= 90 AND days_on_sale < 365`：返回 `成长期`
- `days_on_sale >= 365`：返回 `成熟期`

---

## inv_sales_ratio 单品库销比

来源字段：

- `on_the_way`
- `inventory`
- `quantity_receive`
- `overseas_warehouse_test_product`
- `overseas_warehouse_new_product`
- `weighted_sales`

计算公式：

- `(on_the_way + inventory + quantity_receive + overseas_warehouse_test_product + overseas_warehouse_new_product) / weighted_sales / 30`

SQL 中使用：

- `NULLIF(weighted_sales, 0)` 避免除零。
- `ROUND(..., 2)` 保留 2 位小数。

业务含义：

- 总可用和在途库存 ÷ 日均加权销量 ÷ 30。

如果 `weighted_sales = 0`：

- 计算结果为 `NULL`。

---

## status 状态

使用的底层公式与 `inv_sales_ratio` 一致：

- `(on_the_way + inventory + quantity_receive + overseas_warehouse_test_product + overseas_warehouse_new_product) / weighted_sales / 30`

判断规则：

- `< 3.5`：`短缺`
- `BETWEEN 3.5 AND 5`：`正常`
- `>= 5`：`滞销`
- 其他情况：`NULL`

注意：

- `BETWEEN 3.5 AND 5` 包含 3.5 和 5。
- 状态判断使用原始计算值，不是先按 `ROUND(..., 2)` 后再判断。

---

## total_instock 总库存口径

来源字段：

- `on_the_way`
- `inventory`
- `quantity_receive`
- `overseas_warehouse_new_product`
- `overseas_warehouse_test_product`

计算公式：

- `on_the_way + inventory + quantity_receive + overseas_warehouse_new_product + overseas_warehouse_test_product`

业务含义：

- 在途 + 实时库存 + 待收货 + 海外仓新品 + 海外仓测试品

取整规则：

- 不取整。

---

## sales_total_inv_ratio 负责人维度总库销比

分组维度：

- `a.sale_owner`

计算公式：

- `SUM(total_instock) OVER (PARTITION BY a.sale_owner) / SUM(weighted_sales) OVER (PARTITION BY a.sale_owner) / 30`

SQL 中使用：

- `NULLIF(SUM(weighted_sales) OVER (PARTITION BY a.sale_owner), 0)` 避免除零。
- `ROUND(..., 2)` 保留 2 位小数。

业务含义：

- 同一销售负责人名下所有商品的总库存 ÷ 总加权销量 ÷ 30。

---

## 负责人和层级

来源表：

- `asin`
- `users`

关联规则：

- `CONCAT(ds.asin, '_', ds.country) = a.unique`
- `a.sale_owner = u.username`
- `u.manager = mgr.username`

输出字段：

- `sale_owner`
- `manager`
- `sale_level`
- `manager_level`

---

## 最终主表输出口径

最终每行代表：

- 当天 `daily_sales` 合计行中的一个 `ASIN + 国家`。

补充字段包括：

- 库存
- 在途
- 销量
- 库销比
- 状态
- 断货日期
- 店铺排序
- 负责人信息

核心库存口径：

- `total_instock = 在途正数合计 + 当前 FBA 可售/调拨库存 + 待收货 + 海外仓新品 + 海外仓测试品`

核心库销比口径：

- `total_instock / weighted_sales / 30`

取整规则：

- 单品库销比 `inv_sales_ratio`：保留 2 位小数。
- 负责人总库销比 `sales_total_inv_ratio`：保留 2 位小数。
- 实时库存、在途、总库存：不取整。
