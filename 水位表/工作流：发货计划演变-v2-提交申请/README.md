# 工作流：发货计划演变-v2-提交申请

## 线上信息

- 工作流名称：`发货计划演变-v2-提交申请`
- 工作流 ID：`375901962960896`
- 工作流 key：`a2fj1fzldts`
- 工作流类型：自定义操作（custom-action）
- 当前状态：已启用、当前版本

## 节点顺序

```text
01 读取提交参数（json-query，key: 92ha0rvrhet）
  -> 02 校验申请与安全区间（sql，key: lmftgbnboxz）
  -> 03 整理校验结果（json-query，key: krowdo2cd8k）
  -> 04 判断是否允许提交（condition，key: yqii3sromad）
       |-- 允许：05 创建修改申请 -> 06 写入提交日志 -> 07 提示提交成功
       `-- 拒绝：08 提示提交失败原因 -> 09 终止失败提交
```

本目录只保存 SQL 节点代码；其他节点配置保存在
`../新备货/工作流/workflows.manifest.json`。

## SQL 文件

| 节点 | 本地文件 |
|---|---|
| 02 校验申请与安全区间 | `02-校验申请与安全区间.sql` |

## SQL 变量绑定

| 变量 | 来源 |
|---|---|
| `actor_user_id` | `{{$context.user.id}}` |
| `acting_role` | `{{$jobsMapByNodeKey.92ha0rvrhet.acting_role}}` |
| `request_uuid` | `{{$jobsMapByNodeKey.92ha0rvrhet.request_uuid}}` |
| `bundle_id` | `{{$jobsMapByNodeKey.92ha0rvrhet.bundle_id}}` |
| `plan_id` | `{{$jobsMapByNodeKey.92ha0rvrhet.plan_id}}` |
| `change_kind` | `{{$jobsMapByNodeKey.92ha0rvrhet.change_kind}}` |
| `proposed_number` | `{{$jobsMapByNodeKey.92ha0rvrhet.proposed_number}}` |
| `proposed_date` | `{{$jobsMapByNodeKey.92ha0rvrhet.proposed_date}}` |
| `proposed_channel` | `{{$jobsMapByNodeKey.92ha0rvrhet.proposed_channel}}` |
| `reason_type` | `{{$jobsMapByNodeKey.92ha0rvrhet.reason_type}}` |
| `reason` | `{{$jobsMapByNodeKey.92ha0rvrhet.reason}}` |

