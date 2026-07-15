// 配置中心 Tab1 — 备货周期参数(V4)
async function run() {
  const React = ctx.libs.React;
  const { useState } = React;
  const { Table, Tooltip, ConfigProvider, InputNumber, Button, Spin, message } = ctx.libs.antd;

  const C = {
    text: '#18181b', muted: '#52525b', subtle: '#71717a', border: '#e4e4e7', bgSubtle: '#f4f4f5',
    blue: '#2563eb', blueBg: '#eff6ff', green: '#059669', greenBg: '#ecfdf5',
    amber: '#d97706', amberBg: '#fffbeb', red: '#dc2626', redBg: '#fef2f2',
    gray: '#71717a', grayBg: '#f4f4f5', redBand: '#fee2e2', yellowBand: '#fef3c7',
    greenBand: '#dcfce7', blueBand: '#dbeafe',
  };
  const num = { fontVariantNumeric: 'tabular-nums' };
  const fmt = v => (v === null || v === undefined || v === '' ? '—' : v);
  const n = v => Number(v) || 0;
  const pill = (bg, color, text) => React.createElement('span', { style: { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: bg, color, whiteSpace: 'nowrap' } }, text);
  // ===== 配置表统一样式 helper(6 色系,可复用到配置中心全部 Tab)=====
  // gh(hue)=渐变组头白字;lh(hue)=淡底深色粗体叶头。色系:slate/red/amber/green/blue/pink
  const gh = hue => () => ({ className: 'aok-g-' + hue });
  const lh = hue => () => ({ className: 'aok-c-' + hue });
  const aokCfgCss = [
    '.aok-cfg-wrap .ant-table-thead .aok-g-slate{background:linear-gradient(180deg,#94a3b8,#7c8aa0);color:#fff;font-weight:700;text-align:center;}',
    '.aok-cfg-wrap .ant-table-thead .aok-g-red{background:linear-gradient(180deg,#e8766f,#dc5a52);color:#fff;font-weight:700;text-align:center;}',
    '.aok-cfg-wrap .ant-table-thead .aok-g-amber{background:linear-gradient(180deg,#e6a23c,#dc9528);color:#fff;font-weight:700;text-align:center;}',
    '.aok-cfg-wrap .ant-table-thead .aok-g-green{background:linear-gradient(180deg,#5fb892,#52ac86);color:#fff;font-weight:700;text-align:center;}',
    '.aok-cfg-wrap .ant-table-thead .aok-g-blue{background:linear-gradient(180deg,#5b9bf0,#3b82f6);color:#fff;font-weight:700;text-align:center;}',
    '.aok-cfg-wrap .ant-table-thead .aok-g-pink{background:linear-gradient(180deg,#e186a0,#d9728f);color:#fff;font-weight:700;text-align:center;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-slate{background:#eef1f5;color:#475569;font-weight:700;font-size:13px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-red{background:#fde8e6;color:#9b2c24;font-weight:700;font-size:13px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-amber{background:#fdf1da;color:#9a6512;font-weight:700;font-size:13px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-green{background:#e3f3eb;color:#2c6e54;font-weight:700;font-size:13px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-blue{background:#e6effd;color:#1e478e;font-weight:700;font-size:13px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-pink{background:#fbe7ed;color:#a64a66;font-weight:700;font-size:13px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-tbody > tr > td{font-size:13px;}',
    '.aok-cfg-wrap .ant-table-tbody > tr.aok-row-odd > td{background:#f8fafb;}',
    '.aok-cfg-wrap .ant-table-tbody > tr.aok-row-even > td{background:#fff;}',
    '.aok-cfg-wrap .ant-table-tbody > tr:hover > td{background:#eef4ff !important;}',
    '/* 页面级 Tab 导航栏立体高亮(全局选择器,仅配置中心页挂载时生效;离开即随块卸载) */',
    '.ant-tabs-nav{background:linear-gradient(180deg,#ffffff,#f3f6fb);border-radius:10px;padding:3px 6px;box-shadow:0 1px 2px rgba(20,30,50,.05),0 2px 8px rgba(20,30,50,.05);}',
    '.ant-tabs-tab{font-size:14px !important;font-weight:600 !important;color:#5b6472 !important;border-radius:8px !important;padding:6px 14px !important;}',
    '.ant-tabs-tab:hover{background:#eef4ff !important;}',
    '.ant-tabs-tab.ant-tabs-tab-active{background:#eff6ff !important;box-shadow:0 1px 3px rgba(37,99,235,.18);}',
    '.ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn{color:#2563eb !important;font-weight:800 !important;}',
    '.ant-tabs-ink-bar{height:3px !important;background:#2563eb !important;border-radius:2px;}',
  ].join('\n');
  // 操作列按钮样式(可复用):编辑=浅蓝高亮 / 保存=实心绿 / 取消=描边幽灵
  const btnEdit = { cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 6, border: '1px solid #cfe0ff', background: '#eff6ff', color: C.blue, whiteSpace: 'nowrap' };
  const btnSave = { cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 6, border: '1px solid #047857', background: '#059669', color: '#fff', whiteSpace: 'nowrap' };
  const btnGhost = { cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 6, border: '1px solid #e4e4e7', background: '#fff', color: C.muted, whiteSpace: 'nowrap' };
  const tipTitle = '二期:动态学习/自动校验上线后启用';

  async function readRows() {
    const res = await ctx.api.request({ url: 'v3_cfg_cycle_param:list', params: { pageSize: 500, sort: 'id' } });
    return res?.data?.data || [];
  }
  async function writeApi(collection, action, row, payload) {
    if (!collection.startsWith('v3_cfg_')) throw new Error('非法配置集合:' + collection);
    if (action !== 'update') throw new Error('本表只允许更新');
    return ctx.api.request({ url: collection + ':update', method: 'post', params: { filterByTk: row.id }, data: payload });
  }

  const cellInput = (editing, draft, key, setDraft) => editing
    ? React.createElement(InputNumber, { size: 'small', value: draft[key], style: { width: 50 }, onChange: v => setDraft(Object.assign({}, draft, { [key]: v })) })
    : React.createElement('span', { style: num }, fmt(draft[key]));
  const pairInput = (editing, draft, a, b, setDraft) => editing
    ? React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
        React.createElement(InputNumber, { size: 'small', value: draft[a], style: { width: 42 }, onChange: v => setDraft(Object.assign({}, draft, { [a]: v })) }),
        React.createElement('span', { style: { color: C.subtle } }, '/'),
        React.createElement(InputNumber, { size: 'small', value: draft[b], style: { width: 42 }, onChange: v => setDraft(Object.assign({}, draft, { [b]: v })) }))
    : React.createElement('span', { style: num }, `${fmt(draft[a])}/${fmt(draft[b])}`);
  const sums = r => {
    const offRigid = n(r.product_lead) + n(r.transit_days) + n(r.warehouse_off);
    const peakRigid = n(r.product_lead) + n(r.transit_days) + n(r.warehouse_peak);
    const pair = (base, min, max) => [base + n(r[min]), base + n(r[max])];
    return {
      off: pair(offRigid, 'safety_stock_min', 'safety_stock_max'),
      peak: pair(peakRigid, 'safety_stock_min', 'safety_stock_max'),
    };
  };
  const sumText = p => React.createElement('span', { style: num }, `${p[0]}/${p[1]}`);
  const ratioValue = days => Number((days / 30).toFixed(1));
  const ratioText = p => React.createElement('span', { style: num }, `${ratioValue(p[0]).toFixed(1)}~${ratioValue(p[1]).toFixed(1)}`);
  const derivedPayload = r => {
    const s = sums(r);
    return {
      cycle_days_off_min: s.off[0],
      cycle_days_off_max: s.off[1],
      cycle_days_peak_min: s.peak[0],
      cycle_days_peak_max: s.peak[1],
      stock_sales_ratio_off_min: ratioValue(s.off[0]),
      stock_sales_ratio_off_max: ratioValue(s.off[1]),
      stock_sales_ratio_peak_min: ratioValue(s.peak[0]),
      stock_sales_ratio_peak_max: ratioValue(s.peak[1]),
    };
  };
  const infoBox = (text, bg, border) => React.createElement('div', { style: { background: bg || '#eff6ff', borderLeft: `3px solid ${border || '#2563eb'}`, borderRadius: 6, padding: '10px 14px', fontSize: 12, lineHeight: 1.7, marginBottom: 12, color: C.text } }, text);

  function App() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({});

    async function reload() {
      setLoading(true);
      try { setRows(await readRows()); } catch (e) { message.error('读取失败:' + (e?.message || e)); }
      setLoading(false);
    }
    React.useEffect(() => { reload(); }, []);
    async function save(row) {
      const payload = Object.assign({
        product_lead: draft.product_lead, transit_days: draft.transit_days, warehouse_off: draft.warehouse_off, warehouse_peak: draft.warehouse_peak,
        safety_stock_min: draft.safety_stock_min, safety_stock_max: draft.safety_stock_max,
      }, derivedPayload(draft));
      try { await writeApi('v3_cfg_cycle_param', 'update', row, payload); message.success('已保存'); setEditingId(null); await reload(); }
      catch (e) { message.error('保存失败:' + (e?.message || e)); }
    }

    const columns = [
      { title: '站点', dataIndex: 'site', width: 60, fixed: 'left', onHeaderCell: lh('slate'), render: v => React.createElement('span', null, fmt(v)) },
      { title: '刚性需求时间(天)', onHeaderCell: gh('red'), children: [
        { title: '产品交期', dataIndex: 'product_lead', width: 66, onHeaderCell: lh('red'), render: (_, r) => cellInput(editingId === r.id, editingId === r.id ? draft : r, 'product_lead', setDraft) },
        { title: '运输', dataIndex: 'transit_days', width: 52, onHeaderCell: lh('red'), render: (_, r) => cellInput(editingId === r.id, editingId === r.id ? draft : r, 'transit_days', setDraft) },
        { title: '淡季入仓', dataIndex: 'warehouse_off', width: 66, onHeaderCell: lh('red'), render: (_, r) => cellInput(editingId === r.id, editingId === r.id ? draft : r, 'warehouse_off', setDraft) },
        { title: '旺季入仓', dataIndex: 'warehouse_peak', width: 66, onHeaderCell: lh('red'), render: (_, r) => cellInput(editingId === r.id, editingId === r.id ? draft : r, 'warehouse_peak', setDraft) },
      ] },
      { title: '弹性预留时间(天)', onHeaderCell: gh('amber'), children: [
        { title: '安全库存(min/max)', width: 92, onHeaderCell: lh('amber'), render: (_, r) => pairInput(editingId === r.id, editingId === r.id ? draft : r, 'safety_stock_min', 'safety_stock_max', setDraft) },
      ] },
      { title: '合计时间(天)=刚性+弹性', onHeaderCell: gh('green'), children: [
        { title: '淡季(min/max)', width: 76, onHeaderCell: lh('green'), render: (_, r) => sumText(sums(editingId === r.id ? draft : r).off) },
        { title: '旺季(min/max)', width: 76, onHeaderCell: lh('green'), render: (_, r) => sumText(sums(editingId === r.id ? draft : r).peak) },
      ] },
      { title: '库销比阈值=合计/30', onHeaderCell: gh('blue'), children: [
        { title: '淡季', width: 68, onHeaderCell: lh('blue'), render: (_, r) => ratioText(sums(editingId === r.id ? draft : r).off) },
        { title: '旺季', width: 68, onHeaderCell: lh('blue'), render: (_, r) => ratioText(sums(editingId === r.id ? draft : r).peak) },
      ] },
      { title: '操作', width: 110, fixed: 'right', onHeaderCell: lh('pink'), render: (_, r) => editingId === r.id
        ? React.createElement('span', { style: { display: 'inline-flex', gap: 6 } },
            React.createElement('button', { onClick: () => save(r), style: btnSave }, '✓ 保存'),
            React.createElement('button', { onClick: () => setEditingId(null), style: btnGhost }, '取消'))
        : React.createElement('button', { onClick: () => { setEditingId(r.id); setDraft(Object.assign({}, r)); }, style: btnEdit }, '✎ 编辑') },
    ];

    return React.createElement(ConfigProvider, null,
      React.createElement('div', { className: 'aok-cfg-wrap', style: { fontFamily: "'PingFang SC','Microsoft YaHei',-apple-system,sans-serif", color: C.text } },
        React.createElement('style', { dangerouslySetInnerHTML: { __html: aokCfgCss } }),
        React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, margin: '2px 0 10px' } },
          React.createElement('span', { style: { fontSize: 18, fontWeight: 800, color: C.text } }, '📐 备货周期参数'),
          React.createElement('span', { style: { fontSize: 12, fontWeight: 700, color: '#9a6512', background: '#fdf1da', padding: '1px 8px', borderRadius: 8 } }, 'V4'),
          React.createElement('span', { style: { fontSize: 12, color: C.subtle } }, '影子配置 · 采运部维护 · 改动将生效于后续联动板块')),
        infoBox('这是 V4 算法的核心参数表。刚性需求时间:产品交期 + 运输 + 入仓(物理上必须的);弹性预留时间:安全库存(对抗不确定性);合计时间 = 刚性 + 弹性 = 备货周期总长 → 决定库销比阈值;库销比下限 = 合计时间(用安全库存最小值)/ 30 → 跌破即"短缺预警";库销比上限 = 合计时间(用安全库存最大值)/ 30 → 超过即"滞销预警"'),
        React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', marginBottom: 8 } }, pill(C.blueBg, C.blue, '全部站点 7 行')),
        loading ? React.createElement(Spin, null) : React.createElement(Table, { size: 'small', columns, dataSource: rows, rowKey: 'id', pagination: false, scroll: { x: 820 }, bordered: true, rowClassName: (r, i) => i % 2 ? 'aok-row-odd' : 'aok-row-even' }),
        infoBox('① 安全库存不区分淡旺季，统一下限 7 天、上限 14 天 ② 库销比阈值不需要单独配置——从安全库存最小/最大值与时效参数自动反推', '#f0f9ff', '#2563eb'),
        infoBox('看"到 FBA 日"(= 今天 + 产品交期 45 + 运输时效)是否落在旺季活动窗口。旺季活动节点(中心 ± 14 天):7 月 PD:6/30 前后;10 月秋促:10/15 前后;黑五网一:11/28 前后。原因:旺季入仓延迟的根源是 FBA 仓库爆仓,只有"货到 FBA 那天"在旺季前后才会受影响。', '#eff6ff', '#2563eb'),
        React.createElement(Tooltip, { title: tipTitle }, React.createElement('span', { style: { display: 'none' } }, '—'))));
  }

  ctx.render(React.createElement(App));
}
run();
