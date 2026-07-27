# 【在用·测试】发货计划演变-v2-应用计划（统一安全闸）

## 线上信息

- 工作流名称：`【在用·测试】发货计划演变-v2-应用计划（统一安全闸）`
- 工作流 ID：`377514716954624`
- 工作流 key：`n86b77udykf`
- 工作流类型：数据表事件（collection）
- 触发表：`shipment_plan_change_v2`
- 触发条件：`status = APPLY_PENDING` 且 `projection_status = PENDING`
- 当前状态：已启用、当前版本
- 线上更新时间：`2026-07-26T04:01:30.000Z`
- 当前线上节点顺序：应用前复核统一安全区间闸 -> 写回模拟发货计划 -> 重算对应 ASIN 水位 -> 标记应用完成

## 本地文件与节点

| 顺序 | 线上节点 | 本地文件 | 变量绑定 |
|---|---|---|---|
| 00 | 应用前复核统一安全区间闸 | `00-应用前复核统一安全区间闸.sql` | 无 |
| 01 | 写回模拟发货计划 | `01-写回模拟发货计划.sql` | `change_id = {{$context.data.id}}`、`audit_log_id = {{$system.genSnowflakeId}}` |
| 02 | 重算对应 ASIN 水位 | `02-重算对应ASIN水位.sql` | `asin = {{$context.data.asin}}`、`country = {{$context.data.country}}`、`shop = {{$context.data.shop}}` |
| 03 | 标记应用完成 | `03-标记应用完成.sql` | `change_id = {{$context.data.id}}`、`audit_log_id = {{$system.genSnowflakeId}}` |

## 部署注意

第二个水位重算 SQL 节点部署时必须将文件开头的三个空输入替换为节点变量：

```sql
SET @v2_target_asin = CAST(:asin AS CHAR);
SET @v2_target_country = CAST(:country AS CHAR);
SET @v2_target_shop = CAST(:shop AS CHAR);
```

四个节点必须按编号顺序串行执行。统一安全闸失败时，不得继续写回模拟发货计划；定向水位推演失败时，不得继续执行“标记应用完成”。