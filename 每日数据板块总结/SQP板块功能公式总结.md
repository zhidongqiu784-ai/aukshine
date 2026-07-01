# SQP 板块功能公式总结

## 1. 板块一句话说明

SQP 板块用于按周汇总关键词和词根的市场数据、当前 ASIN 数据、份额、目标出单和诊断分析，帮助运营人员判断某个关键词或词根下，市场有没有变大、ASIN 有没有变强、出单份额是否达标。

这个板块的主线是“按周看 SQP 市场数据 + 当前 ASIN 数据 + 目标份额 + 诊断结论”。

## 2. 主要功能

### 2.1 周主表展示

基础行来自 `sqp_weekly_main`。

一行代表一个：

- 国家
- ASIN
- 周起始日
- 周最后一天
- 第几周

### 2.2 关键词和词根动态列

SQP 板块会读取当前 ASIN 下维护的：

- 关键词：`sqp_keywords`
- 词根：`sqp_roots`

每个关键词或词根都会变成一组动态列。

关键词匹配规则：

- `sqp.search_query = keyword_name`

词根匹配规则：

- `sqp.search_query contains root_name`

### 2.3 周维度公式写回

关键词和词根的周汇总结果写入 `sqp_term_weekly`。

写回内容包括：

- 市场查询、曝光、点击、加购、购买
- 当前 ASIN 曝光、点击、加购、购买
- CTR、CVR、加购率
- 点击份额、加购份额、出单份额
- 阶段目标份额
- 一周需出单
- 单日需出单
- 市场环比分析
- ASIN 环比分析
- ASIN 与市场对比分析
- 周一复盘备注

### 2.4 趋势图

SQP 板块支持趋势图，用于查看一个关键词或词根跨周指标变化。

趋势图读取：

- `sqp_weekly_main`
- `sqp_term_weekly`
- `sqp_keywords`
- `sqp_roots`

### 2.5 关键词和词根管理

SQP 板块不只是展示关键词和词根，还能直接管理当前 ASIN 下的关键词和词根。

支持的动作：

- 新增关键词。
- 新增词根。
- 编辑非默认关键词或非默认词根。
- 删除非默认关键词或非默认词根。
- 删除关键词或词根时，同步删除它已经生成的周汇总记录。

字段名公式版：

- `keyword.country_asin = 当前国家_ASIN`
- `keyword.country = 当前国家`
- `keyword.asin = 当前 ASIN`
- `keyword.keyword_name = 输入的关键词`
- `root.country_asin = 当前国家_ASIN`
- `root.country = 当前国家`
- `root.asin = 当前 ASIN`
- `root.root_name = 输入的词根`
- `delete sqp_term_weekly where country_asin = 当前国家_ASIN and term_type = keyword/root and term_id = 当前词ID`

中文公式版：

- 运营新增关键词后，系统会把这个词绑定到当前国家和当前 ASIN。
- 运营新增词根后，系统会把这个词根绑定到当前国家和当前 ASIN。
- 删除某个关键词或词根时，不只删除词本身，还会清掉它以前生成过的每周汇总，避免页面残留旧数据。

### 2.6 默认关键词和默认词根配置

SQP 板块支持按“国家 + 类目”维护默认关键词和默认词根。

默认词用于解决一个问题：运营进入某个 ASIN 页面时，如果这个 ASIN 还没有维护关键词或词根，系统可以按类目自动补齐一批基础词。

默认词配置表：

- `sqp_default_terms`

默认词生成到实际 ASIN 后，写入：

- 关键词写入 `sqp_keywords`
- 词根写入 `sqp_roots`

字段名公式版：

- `current_category = sku.type where sku.country = 当前国家 and sku.model = 当前型号`
- `default_terms = sqp_default_terms where country = 当前国家 and category = current_category`
- `if default_term.term_type = "keyword" and keyword_name not exists => sqp_keywords:create`
- `if default_term.term_type = "root" and root_name not exists => sqp_roots:create`

中文公式版：

- 系统先根据当前国家和型号，到 `sku` 表找到当前产品类目。
- 再按国家和类目读取默认关键词和默认词根。
- 如果当前 ASIN 已经有同名关键词或同名词根，就跳过，不重复创建。
- 如果当前 ASIN 没有这个词，就自动补到当前 ASIN 下。

### 2.7 视图、字段模板、颜色和配置推送

SQP 板块支持保存当前用户的页面配置，也支持管理员把默认配置推送给其他用户。

主要配置包括：

- 默认视图。
- 自定义视图。
- 列显示、列宽、列顺序、固定列。
- 词下字段模板。
- 词下字段颜色。
- 列头颜色。
- 重要指标字段背景。
- 十字高亮颜色。

这些配置主要写入 `users.setting`。

字段名公式版：

- `users.setting[BLOCK_NAME_SETTING_KEY] = "SQP"`
- `users.setting[COLUMN_VIEW_SETTING_KEY] = 当前用户视图配置`
- `users.setting[DEFAULT_COLUMN_VIEWS_KEY] = 默认视图配置`
- `users.setting[TERM_FIELD_TEMPLATE_KEY] = 词下字段模板`
- `users.setting[TERM_FIELD_COLORS_KEY] = 词下字段颜色`
- `users.setting[TERM_FIELD_TEMPLATE_KEY].fields[field].bodyColor = 重要指标字段背景`

中文公式版：

- 每个用户可以保存自己习惯看的列和颜色。
- 在词下字段模板里勾选重要指标后，所有关键词和词根下的同名字段都会使用 `#BADDB1` 表体背景。
- 重要指标背景只作用于表体数据区，不改变词组表头和字段表头颜色。
- 管理员可以保存一套默认视图。
- 管理员也可以把默认视图、词下字段模板、词下字段颜色和重要指标字段背景推送给指定用户。
- 这些配置只影响页面展示习惯，不改变 SQP 业务数据本身。

### 2.8 目标份额默认值维护

SQP 板块支持在页面上维护当前 ASIN 的默认阶段目标份额。

默认阶段目标份额写入：

- `asin.default_stage_target_share`

字段名公式版：

- `asin.unique = 当前 ASIN_当前国家`
- `asin.default_stage_target_share = 输入百分比 / 100`
- `if sqp_term_weekly.stage_target_share_is_manual = true => 保留手动值`
- `else => sqp_term_weekly.stage_target_share = asin.default_stage_target_share`

中文公式版：

- 运营在页面上填 5%，系统保存时会按 0.05 写入 ASIN 表。
- 已经手动改过目标份额的关键词或词根，不会被默认值覆盖。
- 没有手动改过的关键词或词根，会跟随 ASIN 默认目标份额重新计算一周需出单和单日需出单。

## 3. 数据什么时候抓

### 3.1 页面打开时即时抓取

页面加载、筛选变化、翻页、刷新时会读取：

- `sqp_weekly_main:list`
- `sqp_term_weekly:list`
- `sqp_keywords:list`
- `sqp_roots:list`
- `asin:list`

计算公式时还会读取：

- `sqp:list`
- `sku:list`
- `sqp_term_weekly:list`

管理和配置功能还会按操作读取或写入：

- `sqp_keywords:list/create/update/destroy`
- `sqp_roots:list/create/update/destroy`
- `sqp_default_terms:list/create/update/destroy`
- `users:get`
- `users:list`
- `users:update`
- `asin:update`

### 3.2 默认抓取时间范围

SQP 板块默认日期筛选为「全部日期」。

字段名公式版：

- `dateFilterType = "all"`
- `report_date` 不加日期条件

中文公式版：

- 默认读取当前筛选国家和 ASIN 的全部周数据。
- 如果用户选择日期范围，则用 `sqp_weekly_main.report_date` 过滤。

### 3.3 可选日期范围

- 全部日期：不加日期条件。
- 今天：`report_date = 今天`
- 昨天：`report_date = 昨天`
- 近 7 天：`今天 - 6 天 <= report_date <= 今天`
- 近 30 天：`今天 - 29 天 <= report_date <= 今天`
- 近 90 天：`今天 - 89 天 <= report_date <= 今天`
- 本月：`本月 1 日 <= report_date <= 今天`
- 上月：`上月 1 日 <= report_date <= 上月最后一天`
- 自定义：用户选择开始和结束日期。

### 3.4 SQP 明细抓取范围

计算公式时，SQP 板块会先读取当前 ASIN 的所有周：

- `sqp_weekly_main.country_asin = 当前国家_ASIN`

再取这些周覆盖的 `report_date` 范围：

- `min_report_date <= sqp.report_date <= max_report_date`
- `sqp.country = 当前国家`

品牌范围：

- 先从 `asin` 表按 `unique = ASIN_国家` 找当前 ASIN。
- 如果有品牌，取同国家同品牌 ASIN。
- 如果没有品牌但有型号，就从 `sku` 表按国家和型号找品牌。
- 如果还没有品牌，默认使用 `ONOAYO`。
- SQP 市场数据只保留同品牌 ASIN 范围内的 SQP 明细。

## 4. 数据覆盖与写回逻辑

### 4.1 公式写回表

所有关键词和词根周公式写入：

- `sqp_term_weekly`

主键：

- `term_week_key = 国家_ASIN_周最后一天_termType_termId`

示例结构：

- 关键词：`US_B0XXXX_2026-06-21_keyword_123`
- 词根：`US_B0XXXX_2026-06-21_root_456`

### 4.2 有记录更新，没有记录创建

字段名公式版：

- `if sqp_term_weekly.term_week_key exists => update`
- `else => create`

中文公式版：

- 如果该关键词或词根在该周已经有汇总记录，就更新。
- 如果还没有该周记录，就创建一条。

### 4.3 页面加载时的自动校准

页面加载时会读取当前页的 `sqp_term_weekly`，重新计算比例、目标出单和诊断字段。

如果 `skipFormula` 不是 true，且字段变化，会写回：

- `market_ctr`
- `asin_ctr`
- `market_cart_rate`
- `asin_cart_rate`
- `market_cvr`
- `asin_cvr`
- `asin_click_share`
- `asin_cart_share`
- `asin_purchase_share`
- `stage_target_share`
- `stage_target_share_is_manual`
- `weekly_required_orders`
- `daily_required_orders`
- `compare_diagnosis`
- `market_diagnosis`
- `asin_diagnosis`

### 4.4 阶段目标份额覆盖逻辑

阶段目标份额有“手动值”和“ASIN 默认值”两种来源。

字段名公式版：

- `manual = stage_target_share_is_manual = true`
- `if manual then stage_target_share = 当前行手动值`
- `else stage_target_share = asin.default_stage_target_share`
- `weekly_required_orders = CEIL(stage_target_share * purchases_count)`
- `daily_required_orders = CEIL(weekly_required_orders / 7)`

中文公式版：

- 如果运营手动改过某个关键词或词根的阶段目标份额，就保留手动值。
- 如果没有手动改过，就使用 ASIN 上维护的默认阶段目标份额。
- 一周需出单用阶段目标份额乘市场购买量。
- 单日需出单用一周需出单除以 7 并向上取整。

### 4.5 关键词和词根新增覆盖逻辑

新增关键词或词根时，系统先写入词表，再按当前 ASIN 的所有周生成对应周汇总。

字段名公式版：

- `keyword create => sqp_keywords:create`
- `root create => sqp_roots:create`
- `weeks = sqp_weekly_main where country_asin = 当前国家_ASIN`
- `for each week => term_week_key = country_asin + report_date + term_type + term_id`
- `if sqp_term_weekly.term_week_key exists => update`
- `else => sqp_term_weekly:create`

中文公式版：

- 新增一个关键词后，这个词不会只停留在词表里。
- 系统会拿当前 ASIN 的所有周数据，为这个关键词生成每周汇总。
- 如果某一周已经有汇总，就更新。
- 如果某一周没有汇总，就新建。
- 新增词根也是同样逻辑，只是匹配规则从“完全等于关键词”变成“搜索词包含词根”。

### 4.6 关键词和词根删除覆盖逻辑

删除关键词或词根时，系统会同步清理它的周汇总，避免旧数据继续显示。

字段名公式版：

- `delete sqp_keywords where id = 当前关键词ID`
- `delete sqp_roots where id = 当前词根ID`
- `delete sqp_term_weekly where country_asin = 当前国家_ASIN and term_type = keyword/root and term_id = 当前词ID`

中文公式版：

- 删除关键词时，会删除这个关键词本身。
- 同时删除这个关键词已经生成过的所有周汇总。
- 删除词根时，也会删除这个词根本身和它的所有周汇总。
- 默认关键词和默认词根不能在普通关键词/词根管理里直接删除，避免误删模板生成的基础词。

### 4.7 默认词模板覆盖逻辑

默认词模板存放在 `sqp_default_terms`。

字段名公式版：

- `sqp_default_terms.country = 国家`
- `sqp_default_terms.category = 类目`
- `sqp_default_terms.term_type = keyword/root`
- `sqp_default_terms.term_name = 默认词名称`
- `if same country + category + term_type + term_name exists => update or skip duplicate`
- `else => create`

中文公式版：

- 默认词模板按国家和类目管理。
- 同一个国家、同一个类目下，可以配置默认关键词和默认词根。
- 新建模板后，不会立刻改变所有 ASIN 的历史数据。
- 当进入具体 ASIN 页面或触发默认词补齐时，系统才会把缺失的默认词补到该 ASIN。
- 删除默认词模板，只删除模板本身，不删除已经补到 ASIN 下的实际关键词、词根和周汇总。

### 4.8 默认词自动补齐逻辑

默认词自动补齐用于让新 ASIN 自动拥有类目基础词。

字段名公式版：

- `current_category = sku.type where sku.country = 当前国家 and sku.model = 当前型号`
- `defaults = sqp_default_terms where country = 当前国家 and category = current_category`
- `existing_keywords = sqp_keywords where country_asin = 当前国家_ASIN`
- `existing_roots = sqp_roots where country_asin = 当前国家_ASIN`
- `if default keyword not in existing_keywords => sqp_keywords:create`
- `if default root not in existing_roots => sqp_roots:create`

中文公式版：

- 系统先判断当前 ASIN 属于哪个类目。
- 再找这个类目提前配置好的默认词。
- 当前 ASIN 已经有的词不会重复创建。
- 当前 ASIN 缺少的默认关键词或默认词根会自动补上。
- 补齐后，系统会继续生成这些词对应的周汇总。

### 4.9 目标份额默认值写回逻辑

页面上的“目标份额默认值”保存到 `asin` 表。

字段名公式版：

- `asin.unique = 当前 ASIN_当前国家`
- `asin.default_stage_target_share = 输入值 / 100`
- `load(skipFormula = true)` 刷新页面数据
- `manual row keeps stage_target_share`
- `non-manual row uses asin.default_stage_target_share`

中文公式版：

- 运营输入的是百分比，例如 5。
- 系统写入数据库时保存为小数，例如 0.05。
- 保存后会刷新当前页。
- 手动改过阶段目标份额的行保持原值。
- 没手动改过的行使用新的 ASIN 默认值，并重新计算一周需出单、单日需出单和对比分析。

### 4.10 用户视图和配置覆盖逻辑

用户视图、字段模板和颜色配置主要写入 `users.setting`。

字段名公式版：

- `users.setting[BLOCK_NAME_SETTING_KEY] = "SQP"`
- `users.setting[COLUMN_VIEW_SETTING_KEY] = columnViews`
- `users.setting[DEFAULT_COLUMN_VIEWS_KEY] = defaultColumnViews`
- `users.setting[TERM_FIELD_TEMPLATE_KEY] = termFieldTemplate`
- `users.setting[TERM_FIELD_COLORS_KEY] = termFieldColors`
- `users.setting[TERM_FIELD_COLOR_SETTING_KEY] = legacyTermFieldColors`

中文公式版：

- 用户调整列宽、列顺序、显示隐藏、字段颜色和重要指标字段背景后，会保存到当前用户配置。
- 默认视图不能直接删除，只能保存、恢复或复制成自定义视图。
- 管理员保存默认视图后，可以同步给其他用户。
- 推送默认视图时，其他用户自定义视图里的对应字段会同步列头颜色和重要指标字段背景。
- 推送默认视图不会强制覆盖其他用户自定义视图里的列宽、显示隐藏、固定列和列顺序。
- 重要指标字段背景保存在词下字段模板里，设置某个字段后会应用到所有关键词和词根的同名字段列。
- 表格底色优先级为：选中单元格、十字高亮、重要指标字段背景、词组默认浅色背景、普通斑马纹。
- 推送配置只覆盖用户的 SQP 页面配置，不会改 SQP 业务数据。

### 4.11 单元格手动编辑覆盖逻辑

SQP 板块支持部分词下字段手动编辑。

可手动编辑的核心字段：

- `stage_target_share`
- `monday_review_note`

字段名公式版：

- `stage_target_share input => sqp_term_weekly.stage_target_share`
- `stage_target_share input => sqp_term_weekly.stage_target_share_is_manual = true`
- `weekly_required_orders = CEIL(stage_target_share * purchases_count)`
- `daily_required_orders = CEIL(weekly_required_orders / 7)`
- `monday_review_note input => sqp_term_weekly.monday_review_note`

中文公式版：

- 手动改阶段目标份额后，该行会标记为手动值。
- 被标记为手动值的行，不再被 ASIN 默认目标份额自动覆盖。
- 改完阶段目标份额后，系统会同步重算一周需出单、单日需出单和对比分析。
- 周一复盘备注是运营手填内容，直接保存到该关键词或词根的该周汇总记录里。

## 5. 基础字段公式清单

| 序号 | 显示名 | 来源字段 | 字段名公式版 | 中文公式版 |
|---:|---|---|---|---|
| 1 | 站点 | `main.country` | `sqp_weekly_main.country` | 直接展示 SQP 周主表的站点。 |
| 2 | ASIN | `main.asin` | `sqp_weekly_main.asin` | 直接展示当前 ASIN。 |
| 3 | 周起始日 | `main.week_start_date` | `sqp_weekly_main.week_start_date` | 直接展示该周起始日期。 |
| 4 | 周最后一天 | `main.report_date` | `sqp_weekly_main.report_date` | 直接展示该周最后一天，也是 SQP 报告日期。 |
| 5 | 第几周 | `main.week_label` | `sqp_weekly_main.week_label` | 直接展示第几周标签。 |
| 6 | 主键 | `main.country_asin_week_date` | `sqp_weekly_main.country_asin_week_date` | 页面隐藏主键，用于匹配周主表和词汇总表。 |

## 6. 关键词和词根动态字段公式清单

说明：

- 下列字段会在每个关键词、每个词根下重复出现。
- 关键词精确匹配搜索词。
- 词根包含匹配搜索词。
- 写回表都是 `sqp_term_weekly`。

| 序号 | 显示名 | 字段 | 字段名公式版 | 中文公式版 |
|---:|---|---|---|---|
| 1 | 搜索查询数量 | `search_query_volume` | `SUM(sqp.search_query_volume)` | 汇总当前周、当前关键词或词根匹配到的搜索查询数量。 |
| 2 | SQP-市场曝光量 | `impressions_count` | `SUM(sqp.impressions_count)` | 汇总市场曝光量。 |
| 3 | SQP-市场点击量 | `clicks_count` | `SUM(sqp.clicks_count)` | 汇总市场点击量。 |
| 4 | SQP-市场加购量 | `cart_additions_count` | `SUM(sqp.cart_additions_count)` | 汇总市场加购量。 |
| 5 | SQP-市场购买量 | `purchases_count` | `SUM(sqp.purchases_count)` | 汇总市场购买量。 |
| 6 | SQP-Asin曝光量 | `impressions_asin_count` | `SUM(sqp.impressions_asin_count where sqp.asin = 当前 ASIN)` | 汇总当前 ASIN 曝光量。 |
| 7 | SQP-Asin点击量 | `clicks_asin_count` | `SUM(sqp.clicks_asin_count where sqp.asin = 当前 ASIN)` | 汇总当前 ASIN 点击量。 |
| 8 | SQP-Asin加购量 | `cart_additions_asin_count` | `SUM(sqp.cart_additions_asin_count where sqp.asin = 当前 ASIN)` | 汇总当前 ASIN 加购量。 |
| 9 | SQP-Asin购买量 | `purchases_asin_count` | `SUM(sqp.purchases_asin_count where sqp.asin = 当前 ASIN)` | 汇总当前 ASIN 购买量。 |
| 10 | SQP-市场 CTR | `market_ctr` | `clicks_count / impressions_count` | 市场点击量除以市场曝光量。 |
| 11 | SQP-Asin CTR | `asin_ctr` | `clicks_asin_count / impressions_asin_count` | 当前 ASIN 点击量除以当前 ASIN 曝光量。 |
| 12 | SQP-市场 加购率 | `market_cart_rate` | `cart_additions_count / clicks_count` | 市场加购量除以市场点击量。 |
| 13 | SQP-Asin 加购率 | `asin_cart_rate` | `cart_additions_asin_count / clicks_asin_count` | 当前 ASIN 加购量除以当前 ASIN 点击量。 |
| 14 | SQP-市场 CVR | `market_cvr` | `purchases_count / clicks_count` | 市场购买量除以市场点击量。 |
| 15 | SQP-Asin CVR | `asin_cvr` | `purchases_asin_count / clicks_asin_count` | 当前 ASIN 购买量除以当前 ASIN 点击量。 |
| 16 | SQP-Asin 点击份额 | `asin_click_share` | `clicks_asin_count / clicks_count` | 当前 ASIN 点击量占市场点击量的比例。 |
| 17 | SQP-Asin 加购份额 | `asin_cart_share` | `cart_additions_asin_count / cart_additions_count` | 当前 ASIN 加购量占市场加购量的比例。 |
| 18 | SQP-Asin 出单份额 | `asin_purchase_share` | `purchases_asin_count / purchases_count` | 当前 ASIN 购买量占市场购买量的比例。 |
| 19 | 阶段目标份额 | `stage_target_share` | `manual_value OR asin.default_stage_target_share` | 手动填了就用手动值，否则用 ASIN 默认阶段目标份额。 |
| 20 | 一周需出单 | `weekly_required_orders` | `CEIL(stage_target_share * purchases_count)` | 阶段目标份额乘市场购买量并向上取整。 |
| 21 | 单日需出单 | `daily_required_orders` | `CEIL(weekly_required_orders / 7)` | 一周需出单除以 7 并向上取整。 |
| 22 | 市场数据环比分析 | `market_diagnosis` | `COMPARE(current_week market fields, previous_week market fields)` | 对比本周和上周市场查询、曝光、点击、加购、购买、CTR、加购率、CVR。 |
| 23 | Asin数据环比分析 | `asin_diagnosis` | `COMPARE(current_week asin fields, previous_week asin fields)` | 对比本周和上周 ASIN 份额、点击、加购、购买、CTR、加购率、CVR。 |
| 24 | Asin与市场数据同比分析 | `compare_diagnosis` | `COMPARE(asin_ctr/cvr/cart_rate, market_ctr/cvr/cart_rate) + compare orders` | 对比 ASIN 和市场的转化质量，并判断出单是否达标。 |
| 25 | 周一自用备注或复盘 | `monday_review_note` | `sqp_term_weekly.monday_review_note` | 运营手填周一复盘、备注或后续动作。 |

## 7. 关键公式详细说明

### 7.1 市场数据汇总

字段名公式版：

- `search_query_volume = SUM(matched_market_rows.search_query_volume)`
- `impressions_count = SUM(matched_market_rows.impressions_count)`
- `clicks_count = SUM(matched_market_rows.clicks_count)`
- `cart_additions_count = SUM(matched_market_rows.cart_additions_count)`
- `purchases_count = SUM(matched_market_rows.purchases_count)`

中文公式版：

- 先按当前周找到 SQP 明细。
- 关键词用搜索词完全相等匹配。
- 词根用搜索词包含词根匹配。
- 匹配到的市场数据分别求和。
- 没匹配到数据时为空。

### 7.2 当前 ASIN 数据汇总

字段名公式版：

- `current_asin_rows = sqp_rows where sqp.asin = 当前 ASIN`
- `impressions_asin_count = SUM(current_asin_rows.impressions_asin_count)`
- `clicks_asin_count = SUM(current_asin_rows.clicks_asin_count)`
- `cart_additions_asin_count = SUM(current_asin_rows.cart_additions_asin_count)`
- `purchases_asin_count = SUM(current_asin_rows.purchases_asin_count)`

中文公式版：

- 只看当前 ASIN 在 SQP 明细里的数据。
- 把曝光、点击、加购、购买分别求和。

### 7.3 CTR、CVR、加购率

| 字段 | 字段名公式版 | 中文公式版 |
|---|---|---|
| `market_ctr` | `clicks_count / impressions_count` | 市场点击率。 |
| `asin_ctr` | `clicks_asin_count / impressions_asin_count` | 当前 ASIN 点击率。 |
| `market_cart_rate` | `cart_additions_count / clicks_count` | 市场加购率。 |
| `asin_cart_rate` | `cart_additions_asin_count / clicks_asin_count` | 当前 ASIN 加购率。 |
| `market_cvr` | `purchases_count / clicks_count` | 市场购买转化率。 |
| `asin_cvr` | `purchases_asin_count / clicks_asin_count` | 当前 ASIN 购买转化率。 |

### 7.4 份额类公式

| 字段 | 字段名公式版 | 中文公式版 |
|---|---|---|
| `asin_click_share` | `clicks_asin_count / clicks_count` | 当前 ASIN 拿到的市场点击份额。 |
| `asin_cart_share` | `cart_additions_asin_count / cart_additions_count` | 当前 ASIN 拿到的市场加购份额。 |
| `asin_purchase_share` | `purchases_asin_count / purchases_count` | 当前 ASIN 拿到的市场出单份额。 |

### 7.5 目标出单公式

字段名公式版：

- `stage_target_share = manual stage_target_share OR asin.default_stage_target_share`
- `weekly_required_orders = CEIL(stage_target_share * purchases_count)`
- `daily_required_orders = CEIL(weekly_required_orders / 7)`

中文公式版：

- 阶段目标份额表示运营希望当前 ASIN 拿到多少市场出单份额。
- 一周需出单 = 目标份额 × 市场购买量。
- 单日需出单 = 一周需出单平均到 7 天。
- 两个出单字段都向上取整，避免目标被小数低估。

### 7.6 市场数据环比分析

字段名公式版：

- `market_diagnosis = current_week_market - previous_week_market`
- 比较字段：`search_query_volume`、`impressions_count`、`clicks_count`、`cart_additions_count`、`purchases_count`、`market_ctr`、`market_cart_rate`、`market_cvr`

中文公式版：

- 拿本周市场表现和上一周市场表现对比。
- 会显示搜索量、曝光、点击、加购、购买、CTR、加购率、CVR 是上升还是下降。
- 如果上一周没有数据，则显示数据不足或为空。

### 7.7 ASIN 数据环比分析

字段名公式版：

- `asin_diagnosis = current_week_asin - previous_week_asin`
- 比较字段：`asin_click_share`、`clicks_asin_count`、`asin_cart_share`、`cart_additions_asin_count`、`asin_purchase_share`、`purchases_asin_count`、`asin_ctr`、`asin_cart_rate`、`asin_cvr`

中文公式版：

- 拿本周当前 ASIN 表现和上一周当前 ASIN 表现对比。
- 会看点击份额、加购份额、出单份额、点击、加购、购买、CTR、加购率、CVR 的变化。

### 7.8 ASIN 与市场数据同比分析

字段名公式版：

- `CTR_diff = asin_ctr - market_ctr`
- `CVR_diff = asin_cvr - market_cvr`
- `cart_rate_diff = asin_cart_rate - market_cart_rate`
- `order_diff = purchases_asin_count - weekly_required_orders`

中文公式版：

- 看当前 ASIN 的 CTR、CVR、加购率比市场高还是低。
- 再看当前 ASIN 实际购买量是否达到一周需出单。
- 如果实际购买量大于等于一周需出单，显示出单已 OK。
- 如果实际购买量小于一周需出单，显示缺多少单。

## 8. 小白理解版流程

1. 页面先读取当前 ASIN 的所有周。
2. 再读取当前 ASIN 维护的关键词和词根。
3. 如果当前 ASIN 缺少类目默认词，系统会从默认词模板里自动补齐。
4. 运营也可以手动新增关键词或词根。
5. 新增关键词或词根后，系统会给它生成所有周的汇总记录。
6. 系统按周去 SQP 明细里找这些关键词或词根。
7. 关键词必须完全匹配搜索词，词根只要被搜索词包含就算匹配。
8. 系统把市场数据和当前 ASIN 数据分别求和。
9. 系统计算点击率、加购率、转化率和份额。
10. 系统按阶段目标份额算一周和一天需要出多少单。
11. 如果运营维护了 ASIN 默认目标份额，非手动行会跟随默认值计算。
12. 如果某个关键词或词根手动改过目标份额，这一行保留手动值。
13. 系统对比上一周，生成市场环比和 ASIN 环比。
14. 系统对比 ASIN 和市场，判断这个词是否有优势、出单是否达标。
15. 汇总结果写回 `sqp_term_weekly`，下次打开页面可以直接展示。
16. 如果删除关键词或词根，系统同步删除它的周汇总，避免旧数据残留。
17. 页面列宽、视图、词下字段模板、颜色、重要指标背景和推送配置保存在 `users.setting`，只影响页面显示，不改变 SQP 业务数据。
