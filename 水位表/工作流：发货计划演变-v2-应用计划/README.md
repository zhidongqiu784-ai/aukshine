# 工作流：发货计划演变-v2-应用计划

## 线上信息

- 工作流名称：`发货计划演变-v2-应用计划`
- 工作流 key：`azgbvzy72ne`
- 工作流类型：数据表事件（collection）
- 触发表：`shipment_plan_change_v2`
- 触发条件：`status = APPLY_PENDING` 且 `projection_status = PENDING`
- 当前线上节点顺序：写回模拟发货计划 -> 重算对应 ASIN 水位 -> 标记应用完成

## 本地文件与节点

| 顺序 | 线上节点 | 本地文件 | 变量绑定 |
|---|---|---|---|
| 01 | 写回模拟发货计划 | `01-写回模拟发货计划.sql` | `change_id = {{$context.data.id}}`、`audit_log_id = {{$system.genSnowflakeId}}` |
| 02 | 重算对应 ASIN 水位 | `02-重算对应ASIN水位.sql` | `asin = {{$context.data.asin}}`、`country = {{$context.data.country}}` |
| 03 | 标记应用完成 | `03-标记应用完成.sql` | `change_id = {{$context.data.id}}`、`audit_log_id = {{$system.genSnowflakeId}}` |

## 部署注意

第二个 SQL 节点部署时必须将文件开头的两个空输入替换为节点变量：

```sql
SET @v2_target_asin = CAST(:asin AS CHAR);
SET @v2_target_country = CAST(:country AS CHAR);
SET @v2_target_shop = '合计';
```

三个节点必须按编号顺序串行执行。定向水位推演失败时，不得继续执行“标记应用完成”。

