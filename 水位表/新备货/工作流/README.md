# 发货计划演变 v2 工作流总索引

本目录保存跨工作流部署清单和公共说明。各工作流 SQL 已按线上工作流分别归档到 `水位表/工作流：*` 目录。

## 文件

- `../../工作流：发货计划演变-v2-提交申请/`：保存提交申请工作流 SQL 和线上节点说明。
- `../../工作流：发货计划演变-v2-审核流转/`：保存审核流转工作流 SQL 和线上节点说明。
- `../../工作流：发货计划演变-v2-应用计划/`：保存应用计划工作流的三个 SQL 节点，并按线上节点顺序编号。
- `../../工作流：每周生成模拟计划/`：保存每周计划生成和随后 V2 水位推演的两个线上 SQL 节点。
- `workflows.manifest.json`：四个默认禁用工作流的触发器、节点顺序、分支和配置模板。
- `05-simulate_shipment-v2保护-暂不启用.md`：说明为什么暂不能对 `simulate_shipment` 使用全局拦截。

应用计划工作流的第二个 SQL 节点使用
`../../工作流：发货计划演变-v2-应用计划/02-重算对应ASIN水位.sql`。部署时必须按 manifest 的
`sqlTransform` 把两个 `NULL` 输入替换成参数 `:asin / :country`；
`shop` 由 SQL 内部固定为 `合计`，不接受前端或工作流变量覆盖。

## 服务端业务口径

### 角色

- 管理员：`roles_users.role_name IN ('admin', 'root')`，可以按 `acting_role` 操作。
- 销售：申请时必须满足 `asin.sale_owner = users.username`。
- 主管：必须同时拥有角色 `r_7ih2kbf7t1g`，并满足销售归属用户的 `users.manager = 当前主管 username`。
- 采购与终审：当前用户 `users.department = '物流仓储部'`。
- 前端隐藏按钮只负责体验，服务端每次都重新查权限。

### 周段和路线

| 周段 | 发起 | 安全闸结果 | 初始/下一状态 |
|---|---|---|---|
| W1-W2 | 销售提前、加量、改渠道 | 不适用 | `PENDING_SUPERVISOR -> PENDING_PROCUREMENT -> APPLY_PENDING` |
| W1-W2 | 物流仓储部提前、推迟、加量、改渠道 | 不适用 | `APPLY_PENDING` |
| W3-W5 | 销售 | `SAFE_OR_NOT_WORSE` | `APPLY_PENDING` |
| W3-W5 | 销售 | `OUT` 或新品 | `PENDING_SUPERVISOR -> PENDING_PROCUREMENT -> APPLY_PENDING` |
| W6-W7 | 销售 | `SAFE_OR_NOT_WORSE` | `APPLY_PENDING` |
| W6-W7 | 销售 | `OUT` 或新品 | `PENDING_PROCUREMENT -> PENDING_FINAL -> APPLY_PENDING` |

物流仓储部的 `ops` 发起只允许 W1-W2；W3-W7 使用审核按钮，不直接发起调整。
W1-W2 所有角色都不能减量，销售不能推迟。日期必须按 7 天吸附、相对原日期
不超过前后 14 天、不得早于今天，也不得移出当前 W1-W7。

### 安全区间闸

提交 SQL 不读取前端 `gate_result`。它使用下列口径：

1. 基线为目标店铺 `daily_sales.v2_days_for_sale`。
2. 拟议曲线使用真实未入库量加全部 `shipment_plan_v2`，仅替换本次 `plan_id` 的数量、发货日或渠道计算出的到货日。
3. 库存递推与水位节点 10 相同：前一天扣销量后为负且当天有补货时，从当天补货量重启；否则正常扣销量加补货。
4. 每天风险为：低于 7 天取 `7-days`，高于 14 天取 `days-14`，区间内取 0。
5. 全部日期都满足 `proposal_risk <= baseline_risk` 才返回 `SAFE_OR_NOT_WORSE`；任一天变差即 `OUT`。
6. `asin.status='新品'` 或 `water_product.product_label` 含“新品”时强制 `OUT`。

### 应用触发

前端只触发“提交申请”和“审核流转”。前端不得触发应用工作流。

应用工作流是 `shipment_plan_change_v2` 的 collection workflow，只在
`status='APPLY_PENDING' AND projection_status='PENDING'` 的新增或更新事件触发。
审核工作流转入 `APPLY_PENDING` 后，通过 NocoBase update 节点把
`projection_status` 置为 `PENDING`，从而产生受控的应用事件。

## 部署顺序

1. 读取 `workflows.manifest.json`，确认四个 workflow 均为 `enabled=false`。
2. 串行创建 `submit`，按 `upstreamRef / branchIndex` 顺序逐个创建节点；每创建一个节点立即回读真实 `node.key`，替换后续 `__*_KEY__`。
3. 以同样方式创建 `review`、`apply`、`request_guard`。节点不能并发创建。
4. 回读四个 workflow，核对 trigger、sync、节点数、主链、分支和 SQL 变量。
5. SQL 节点测试只使用回滚或只读样例。不得以真实申请直接试写生产数据。
6. 先测试提交的拒绝/通过分支，再测试审核乐观锁，再用专用测试计划验证应用和定向水位。
7. 最后才测试 `request_guard` 是否只拦外部 CRUD、不拦 workflow 内部 create/update。
8. 完成全链路报告后另行请求确认；未获确认不得启用。

已存在的小时 v2 水位候选工作流：`id=375895468081152`、
`key=xp7rq5lgncz`，节点 10 `key=q0thhufe1cs`。资产编写时它保持禁用。

## 节点拓扑

### 提交申请

`input -> validate SQL -> result -> allow condition`

- 通过分支：`create request -> create submit log -> success message`
- 拒绝分支：`error message -> end(-1)`

### 审核流转

`input -> transition SQL -> result -> allow condition`

- 拒绝分支：`error message -> end(-1)`
- 通过分支：`success message -> should_trigger_apply condition`
- 需要应用：`update projection_status=PENDING (individualHooks=true)`

### 应用计划

`apply plan SQL -> targeted projection SQL -> finish SQL`

如果定向推演失败，申请会停在 `APPLYING / PENDING`，不会伪装成已生效；
小时全量节点是数据推演兜底，但仍需根据失败执行记录修复并完成申请状态。

### 申请表全局保护

`response message -> end(-1)`，拦截申请表外部 `create/update/destroy`。
该保护必须最后启用，并先验证 workflow 内部 create/update 不经过外部请求拦截器。

## 验证清单

- 销售不能提交别人的 ASIN，主管不能审核不属于其下属销售的申请。
- 非物流仓储部不能使用 `ops/final`，普通用户不能伪造 `acting_role`。
- W1-W2 减量、销售推迟、非整周日期、超过 14 天、移出 W1-W7 均返回明确错误。
- 同一 `request_uuid` 重复提交被拒绝。
- MIXED 同时调整数量、日期、渠道时，服务端按三个拟议字段分别覆盖并重新计算。
- 新品即使风险不变也必须走人工链。
- 两个审核人使用相同 `row_version` 时只能一个成功。
- 应用前若真实计划任一原值变化，乐观锁必须失败，不能覆盖新值。
- 应用成功后 `simulate_shipment`、申请状态、审计日志和目标店铺/合计 v2 水位一致。
- 旧计划 `plan_source <> 'shipment_plan_v2'` 与旧 `daily_sales` 字段保持不变。
