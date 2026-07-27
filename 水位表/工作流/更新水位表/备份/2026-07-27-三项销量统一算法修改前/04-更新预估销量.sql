-- 工作流：更新水位表
-- 节点序号：4
-- 节点名称：更新今天及未来日期的预估销量

UPDATE nocobase.daily_sales
SET maybe_sales = weighted_sales * coefficient
WHERE date >= CURRENT_DATE
  AND shop <> '合计';
