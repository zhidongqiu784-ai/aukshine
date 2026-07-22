# 工作流：发货计划演变-v2-审核流转

## 线上信息

- 工作流名称：`发货计划演变-v2-审核流转`
- 工作流 ID：`375902663409664`
- 工作流 key：`7d4cr4o7bmd`
- 工作流类型：自定义操作（custom-action）
- 当前状态：已启用、当前版本

## 节点顺序

```text
01 读取审核参数（json-query，key: 4na6gfd9hdp）
  -> 02 校验权限并流转状态（sql，key: embkv2vu3ge）
  -> 03 整理审核结果（json-query，key: i2b8rjisu40）
  -> 04 判断是否允许审核（condition，key: 4zwbt4wy041）
       |-- 允许：05 提示审核完成 -> 06 判断是否进入应用计划
       |                              `-- 需要应用：07 触发计划应用
       `-- 拒绝：08 提示审核失败原因 -> 09 终止失败审核
```

本目录只保存 SQL 节点代码；其他节点配置保存在
`../新备货/工作流/workflows.manifest.json`。

## SQL 文件

| 节点 | 本地文件 |
|---|---|
| 02 校验权限并流转状态 | `02-校验权限并流转状态.sql` |

## SQL 变量绑定

| 变量 | 来源 |
|---|---|
| `actor_user_id` | `{{$context.user.id}}` |
| `acting_role` | `{{$jobsMapByNodeKey.4na6gfd9hdp.acting_role}}` |
| `change_id` | `{{$jobsMapByNodeKey.4na6gfd9hdp.change_id}}` |
| `action` | `{{$jobsMapByNodeKey.4na6gfd9hdp.action}}` |
| `expected_row_version` | `{{$jobsMapByNodeKey.4na6gfd9hdp.expected_row_version}}` |
| `comment` | `{{$jobsMapByNodeKey.4na6gfd9hdp.comment}}` |
| `audit_log_id` | `{{$system.genSnowflakeId}}` |

