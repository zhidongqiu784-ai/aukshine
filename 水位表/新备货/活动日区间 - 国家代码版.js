// 配置中心 Tab3 — 活动日区间
async function run() {
  const React = ctx.libs.React;
  const { useState } = React;
  const { Table, Select, ConfigProvider, DatePicker, InputNumber, Input, Button, Spin, Popconfirm, message } = ctx.libs.antd;
  const dayjs = ctx.libs.dayjs || ctx.dayjs;
  const C = { text: '#18181b', muted: '#52525b', subtle: '#71717a', border: '#e4e4e7', bgSubtle: '#f4f4f5', blue: '#2563eb', blueBg: '#eff6ff', green: '#059669', greenBg: '#ecfdf5', amber: '#d97706', amberBg: '#fffbeb', red: '#dc2626', redBg: '#fef2f2', gray: '#71717a', grayBg: '#f4f4f5' };
  const num = { fontVariantNumeric: 'tabular-nums' };
  const fmt = v => (v === null || v === undefined || v === '' ? '-' : v);
  const pill = (bg, color, text) => React.createElement('span', { style: { display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500, background: bg, color, whiteSpace: 'nowrap' } }, text);
  const th = () => ({ style: { background: C.bgSubtle, fontSize: 11, color: C.muted, fontWeight: 600, whiteSpace: 'nowrap' } });
  // ===== 配置表统一样式 helper(6 色系,配置中心通用)=====
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
    '.ant-tabs-nav{background:linear-gradient(180deg,#ffffff,#f3f6fb);border-radius:10px;padding:3px 6px;box-shadow:0 1px 2px rgba(20,30,50,.05),0 2px 8px rgba(20,30,50,.05);}',
    '.ant-tabs-tab{font-size:14px !important;font-weight:600 !important;color:#5b6472 !important;border-radius:8px !important;padding:6px 14px !important;}',
    '.ant-tabs-tab:hover{background:#eef4ff !important;}',
    '.ant-tabs-tab.ant-tabs-tab-active{background:#eff6ff !important;box-shadow:0 1px 3px rgba(37,99,235,.18);}',
    '.ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn{color:#2563eb !important;font-weight:800 !important;}',
    '.ant-tabs-ink-bar{height:3px !important;background:#2563eb !important;border-radius:2px;}',
  ].join('\n');
  const btnEdit = { cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 6, border: '1px solid #cfe0ff', background: '#eff6ff', color: '#2563eb', whiteSpace: 'nowrap' };
  const btnSave = { cursor: 'pointer', fontSize: 12, fontWeight: 700, padding: '3px 12px', borderRadius: 6, border: '1px solid #047857', background: '#059669', color: '#fff', whiteSpace: 'nowrap' };
  const btnGhost = { cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 6, border: '1px solid #e4e4e7', background: '#fff', color: '#52525b', whiteSpace: 'nowrap' };
  const btnDanger = { cursor: 'pointer', fontSize: 12, fontWeight: 600, padding: '3px 12px', borderRadius: 6, border: '1px solid #f0b4b4', background: '#fef2f2', color: '#dc2626', whiteSpace: 'nowrap' };
  const datePickerLocale = {
    lang: {
      locale: 'zh_CN',
      placeholder: '请选择日期',
      today: '今天',
      now: '此刻',
      backToToday: '返回今天',
      ok: '确定',
      clear: '清除',
      month: '月',
      year: '年',
      timeSelect: '选择时间',
      dateSelect: '选择日期',
      monthSelect: '选择月份',
      yearSelect: '选择年份',
      decadeSelect: '选择年代',
      yearFormat: 'YYYY年',
      dateFormat: 'YYYY年M月D日',
      dayFormat: 'D',
      dateTimeFormat: 'YYYY年M月D日 HH时mm分ss秒',
      monthBeforeYear: true,
      previousMonth: '上个月',
      nextMonth: '下个月',
      previousYear: '上一年',
      nextYear: '下一年',
      previousDecade: '上一年代',
      nextDecade: '下一年代',
      previousCentury: '上一世纪',
      nextCentury: '下一世纪',
    },
    timePickerLocale: { placeholder: '请选择时间' },
  };
  const categoryOptions = [
    { value: '基础类型', label: '基础类型' },
    { value: '叠加基础类型', label: '叠加基础类型' },
    { value: '专享类型', label: '专享类型' },
    { value: '大促BDLD', label: '大促BDLD' },
    { value: '基础活动类型', label: '基础活动类型' },
    { value: '固定活动类型', label: '固定活动类型' },
    { value: '不参与', label: '不参与' },
  ];

  const autoDayPalette = [
    { bg: '#eef2ff', fg: '#4338ca' },
    { bg: '#ecfeff', fg: '#0e7490' },
    { bg: '#fff1f2', fg: '#be123c' },
    { bg: '#fffbeb', fg: '#a16207' },
    { bg: '#f0f9ff', fg: '#0369a1' },
    { bg: '#f5f3ff', fg: '#6d28d9' },
    { bg: '#ecfdf5', fg: '#047857' },
    { bg: '#fdf4ff', fg: '#a21caf' },
  ];
  const autoDayColor = value => {
    let hash = 0;
    Array.from(String(value || '')).forEach(char => {
      hash = (hash * 31 + char.codePointAt(0)) >>> 0;
    });
    return autoDayPalette[hash % autoDayPalette.length];
  };

  const dayPill = v => {
    const s = String(v || '');
    const low = s.toLowerCase();
    if (!s || s === '日常') return pill('#f8fafc', '#475569', s || '—');
    if (low.indexOf('woot') >= 0) return pill('#fff7ed', '#c2410c', s);
    if (s.indexOf('黑五') >= 0 || s.indexOf('秋促') >= 0) return pill('#fff1f2', '#be123c', s);
    if (s.indexOf('PD') >= 0 || s.indexOf('专享') >= 0) return pill('#fdf4ff', '#a21caf', s);
    if (s.indexOf('旺季') >= 0) return pill('#eff6ff', '#1d4ed8', s);
    if (s.indexOf('淡季') >= 0) return pill('#ecfdf5', '#047857', s);
    if (s.indexOf('BD') >= 0 || s.indexOf('LD') >= 0) return pill('#ecfeff', '#0e7490', s);
    const color = autoDayColor(s);
    return pill(color.bg, color.fg, s);
  };
  const categoryPill = v => {
    if (v === '基础类型') return pill(C.blueBg, C.blue, v);
    if (v === '叠加基础类型') return pill(C.greenBg, C.green, v);
    if (v === '专享类型') return pill(C.amberBg, C.amber, v);
    if (v === '大促BDLD') return pill(C.redBg, C.red, v);
    if (v === '基础活动类型') return pill('#ecfeff', '#0e7490', v);
    if (v === '固定活动类型') return pill('#f5f3ff', '#6d28d9', v);
    if (v === '不参与') return pill(C.grayBg, C.gray, v);
    return pill(C.grayBg, C.gray, fmt(v));
  };
  const ACTIVITY_COLLECTION = 'datetypetime';
  const toViewRow = row => ({
    id: row.id,
    region: row.country,
    day_type: row.daytype,
    category: row.daytype_category,
    start_date: row.startdate,
    end_date: row.enddate,
    coef: row.chushixishu,
  });
  async function readRows() { const res = await ctx.api.request({ url: ACTIVITY_COLLECTION + ':list', params: { pageSize: 500, sort: 'id' } }); return (res?.data?.data || []).map(toViewRow); }
  async function readRegionOptions() {
    const res = await ctx.api.request({ url: 'collections:get', params: { filterByTk: ACTIVITY_COLLECTION, appends: ['fields'] } });
    const fields = res?.data?.data?.fields || [];
    const countryField = fields.find(field => field.name === 'country');
    const enumOptions = countryField?.uiSchema?.enum || countryField?.enum || [];
    return enumOptions
      .filter(option => option && option.value != null)
      .map(option => ({ value: option.value, label: option.label || String(option.value) }));
  }
  async function writeApi(collection, action, row, payload) {
    if (collection !== ACTIVITY_COLLECTION) throw new Error('非法配置集合:' + collection);
    const req = { url: collection + ':' + action, method: 'post', data: payload };
    if (action !== 'create') req.params = { filterByTk: row.id };
    return ctx.api.request(req);
  }
  function App() {
    const [rows, setRows] = useState([]), [regionOptions, setRegionOptions] = useState([]), [region, setRegion] = useState(null), [loading, setLoading] = useState(true), [editingId, setEditingId] = useState(null), [draft, setDraft] = useState({});
    async function reload() {
      setLoading(true);
      try {
        const [nextRows, nextRegionOptions] = await Promise.all([readRows(), readRegionOptions()]);
        if (!nextRegionOptions.length) throw new Error('country 字段未配置可用枚举');
        setRows(nextRows);
        setRegionOptions(nextRegionOptions);
        setRegion(current => nextRegionOptions.some(option => option.value === current) ? current : nextRegionOptions[0].value);
      } catch (e) {
        message.error('读取失败:' + (e?.message || e));
      }
      setLoading(false);
    }
    React.useEffect(() => { reload(); }, []);
    function editNode(row, key, type) { const r = editingId === row.id ? draft : row; if (editingId !== row.id) return type === 'num' ? React.createElement('span', { style: num }, fmt(r[key])) : React.createElement('span', null, fmt(r[key])); const props = { size: 'small', value: r[key], style: { width: '100%' }, onChange: e => setDraft(Object.assign({}, draft, { [key]: e?.target ? e.target.value : e })) }; return type === 'num' ? React.createElement(InputNumber, props) : React.createElement(Input, props); }
    function dateNode(row, key) { const r = editingId === row.id ? draft : row; if (editingId !== row.id) return React.createElement('span', null, fmt(r[key])); return React.createElement(DatePicker, { size: 'small', locale: datePickerLocale, value: r[key] && dayjs ? dayjs(r[key], 'YYYY-MM-DD') : null, format: 'YYYY-MM-DD', allowClear: true, placeholder: '请选择日期', style: { width: '100%' }, onChange: (_, dateText) => setDraft(Object.assign({}, draft, { [key]: dateText || null })) }); }
    function categoryNode(row) { const r = editingId === row.id ? draft : row; if (editingId !== row.id) return categoryPill(r.category); return React.createElement(Select, { size: 'small', value: r.category, style: { width: '100%' }, options: categoryOptions, placeholder: '请选择分类', onChange: v => setDraft(Object.assign({}, draft, { category: v })) }); }
    async function save(row) { const isNew = String(row.id).indexOf('__new') === 0; const payload = { country: draft.region || region, daytype: draft.day_type, daytype_category: draft.category, startdate: draft.start_date, enddate: draft.end_date, chushixishu: draft.coef }; try { await writeApi(ACTIVITY_COLLECTION, isNew ? 'create' : 'update', row, payload); message.success('已保存'); setEditingId(null); await reload(); } catch (e) { message.error('保存失败:' + (e?.message || e)); } }
    async function remove(row) { try { await writeApi(ACTIVITY_COLLECTION, 'destroy', row, {}); message.success('已删除'); await reload(); } catch (e) { message.error('删除失败:' + (e?.message || e)); } }
    const view = rows.filter(r => !r.region || r.region === region);
    const data = editingId === '__new' ? [draft].concat(view) : view;
    const regionSummary = regionOptions.map(option => option.label).join('、');
    const columns = [
      { title: '日类型', dataIndex: 'day_type', width: 180, onHeaderCell: lh('slate'), render: (_, r) => editingId === r.id ? editNode(r, 'day_type') : dayPill(r.day_type) },
      { title: '开始日期', dataIndex: 'start_date', width: 140, onHeaderCell: lh('red'), render: (_, r) => dateNode(r, 'start_date') },
      { title: '结束日期', dataIndex: 'end_date', width: 140, onHeaderCell: lh('red'), render: (_, r) => dateNode(r, 'end_date') },
      { title: '初始系数', dataIndex: 'coef', width: 110, onHeaderCell: lh('amber'), render: (_, r) => editNode(r, 'coef', 'num') },
      { title: '分类', dataIndex: 'category', width: 130, onHeaderCell: lh('green'), render: (_, r) => categoryNode(r) },
      { title: '操作', width: 150, onHeaderCell: lh('pink'), render: (_, r) => editingId === r.id ? React.createElement('span', null, React.createElement('button', { onClick: () => save(r), style: btnSave }, '✓ 保存'), React.createElement('button', { onClick: () => setEditingId(null), style: btnGhost }, '取消')) : React.createElement('span', null, React.createElement('button', { onClick: () => { setEditingId(r.id); setDraft(Object.assign({}, r)); }, style: btnEdit }, '✎ 编辑'), React.createElement(Popconfirm, { title: '确认删除?', onConfirm: () => remove(r) }, React.createElement('button', { style: btnDanger }, '删除'))) },
    ];
    return React.createElement(ConfigProvider, null, React.createElement('div', { className: 'aok-cfg-wrap', style: { fontFamily: "'PingFang SC','Microsoft YaHei',-apple-system,sans-serif", color: C.text } },
      React.createElement('style', null, aokCfgCss),
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: 10, margin: '2px 0 10px' } }, React.createElement('span', { style: { fontSize: 18, fontWeight: 800, color: C.text } }, '🗓 活动日区间')),
      React.createElement('div', { style: { fontSize: 12, color: C.muted, lineHeight: 1.7, margin: '2px 0 12px' } }, '按区域(' + (regionSummary || '加载中') + ')分别配置活动日期与初始系数，支持手动添加。', React.createElement('span', { style: { color: '#a1a1aa' } }, '采运部维护 · 改动将生效于后续联动板块')),
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 } }, React.createElement('span', { style: { fontSize: 12, color: C.muted } }, '当前区域'), React.createElement(Select, { size: 'small', value: region, style: { width: 150 }, options: regionOptions, onChange: setRegion }), React.createElement(Button, { size: 'small', type: 'primary', disabled: !region, style: { marginLeft: 'auto' }, onClick: () => { const row = { id: '__new', region, day_type: '', category: '基础类型', start_date: '', end_date: '', coef: 1 }; setEditingId('__new'); setDraft(row); } }, '+ 添加')),
      loading ? React.createElement(Spin, null) : React.createElement(Table, { rowClassName: (r, i) => i % 2 ? 'aok-row-odd' : 'aok-row-even', size: 'small', columns, dataSource: data, rowKey: 'id', pagination: false, scroll: { x: 850 }, bordered: true }),
      React.createElement('div', { style: { background: '#eff6ff', borderLeft: '3px solid #2563eb', borderRadius: 6, padding: '10px 14px', fontSize: 12, lineHeight: 1.7, marginTop: 12, whiteSpace: 'normal', overflowWrap: 'anywhere' } },
        React.createElement('strong', { style: { color: '#1d4ed8' } }, '分类说明：'),
        '基础类型用于日常；叠加基础类型可以组合；基础活动类型的系数自动计算；固定活动类型按日期单独生效；大促BDLD用于修正真实BD/LD；专享类型单独生效；不参与类型不进入日类型计算。除基础活动类型外，其余系数均使用配置值。')));
  }
  ctx.render(React.createElement(App));
}
ctx.render(null);
run();
