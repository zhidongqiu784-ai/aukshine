# simulate_shipment v2-only 保护：暂不启用

当前不能安全创建 `simulate_shipment` 的全局 request-interception。

原因不是无法识别单条 v2 记录，而是 NocoBase 的 update/destroy 请求可能使用
`filter` 批量命中多条记录。拦截器稳定暴露 `filterByTk` 和 `values`，但不能保证
每一种批量 `filter` 都能在触发配置中安全展开并逐条判断 `plan_source`。如果直接
全局拦截 update/destroy，可能把旧的销售手填模拟计划一起拦掉；如果只看前端
`values.plan_source`，又可能漏过对已有 v2 记录的批量修改。

因此本轮明确不创建、不启用该拦截器，也不把前端隐藏按钮当作服务端保护。

在具备以下任一能力后再单独实施：

- 服务端插件提供只允许受控工作流更新 `plan_source='shipment_plan_v2'` 的资源 action；或
- 已验证 request-interception 能可靠解析并查询所有单条、批量 `filter` 命中的记录，且对旧计划回归测试通过；或
- 将 v2 计划迁移到独立 collection，再对独立 collection 全局拦截。

正式启用前，必须保持现有旧计划 CRUD 契约不变，并单独验证：单条更新、批量更新、
单条删除、批量删除、旧计划创建和 v2 工作流应用六条路径。
