const React = ctx.libs.React;
const { useCallback, useEffect, useMemo, useState } = React;
const {
  Button,
  Drawer,
  Empty,
  Segmented,
  Select,
  Spin,
  Switch,
  Tag,
  Tooltip,
  Typography,
} = ctx.libs.antd;
const icons = ctx.libs.antdIcons || {};
const {
  CalendarOutlined,
  DownOutlined,
  GlobalOutlined,
  ReloadOutlined,
  RightOutlined,
  ShopOutlined,
} = icons;
const h = React.createElement;

const TOTAL_SHOP = '合计';
const PLAN_SOURCE = 'shipment_plan_v2';
const SAFE_MIN_DAYS = 7;
const SAFE_MAX_DAYS = 14;
const DAILY_QUERY_DAYS = 125;
const ALL_SALES = '__ALL_SALES__';
const ALL_MODELS = '__ALL_MODELS__';
const ELIGIBLE_STATUSES = ['普通', '新品', '重点'];

const CURRENT_USERNAME = String(
  (typeof ctx.getVar === 'function' ? await ctx.getVar('ctx.user.username') : '')
    || ctx.user?.username
    || ctx.auth?.user?.username
    || '',
).trim();
const CURRENT_USER_LEVEL = Number(
  (typeof ctx.getVar === 'function' ? await ctx.getVar('ctx.user.level') : null)
    ?? ctx.user?.level
    ?? ctx.auth?.user?.level
    ?? 0,
) || 0;
const IS_ADMIN = CURRENT_USER_LEVEL >= 3;

const C = {
  ink: '#1f2329', muted: '#667085', line: '#dfe4eb', panel: '#ffffff', page: '#eef1f5',
  blue: '#3370ff', green: '#2ba471', orange: '#e8912a', purple: '#8b6cf0', red: '#e34d42', gold: '#b06a00',
};

function apiRequest(options) {
  if (typeof ctx.request === 'function') return ctx.request(options);
  return ctx.api.request(options);
}

function pickRows(response) {
  const payload = response?.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return Array.isArray(payload) ? payload : [];
}

function readDirectParam(source, name) {
  if (!source) return '';
  if (typeof source.get === 'function') return source.get(name) || '';
  return source[name] || '';
}

function parseSearch(text) {
  const result = {};
  String(text || '').replace(/^\?/, '').split('&').forEach((part) => {
    if (!part) return;
    const index = part.indexOf('=');
    const key = index < 0 ? part : part.slice(0, index);
    const value = index < 0 ? '' : part.slice(index + 1);
    if (key) result[decodeURIComponent(key)] = decodeURIComponent(value);
  });
  return result;
}

function routerSearch() {
  return ctx.router?.state?.location?.search
    || ctx.app?.router?.router?.state?.location?.search
    || ctx.app?.router?.location?.search
    || '';
}

function routerPath() {
  return ctx.router?.state?.location?.pathname
    || ctx.app?.router?.router?.state?.location?.pathname
    || ctx.app?.router?.location?.pathname
    || '/';
}

function buildSearch(params) {
  const query = Object.keys(params || {}).filter((key) => params[key] != null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`).join('&');
  return query ? `?${query}` : '';
}

function readParamsSync() {
  const direct = ctx.urlSearchParams || {};
  const query = parseSearch(routerSearch());
  return {
    asin: readDirectParam(direct, 'asin') || query.asin || '',
    country: readDirectParam(direct, 'country') || query.country || '',
    shop: readDirectParam(direct, 'shop') || query.shop || TOTAL_SHOP,
  };
}

async function resolveParams() {
  const result = readParamsSync();
  if (typeof ctx.getVar === 'function') {
    result.asin = result.asin || await ctx.getVar('ctx.urlSearchParams.asin') || '';
    result.country = result.country || await ctx.getVar('ctx.urlSearchParams.country') || '';
    result.shop = result.shop || await ctx.getVar('ctx.urlSearchParams.shop') || TOTAL_SHOP;
  }
  return result;
}

function replaceShopParam(shop) {
  const stable = readParamsSync();
  const next = { ...parseSearch(routerSearch()), asin: stable.asin, country: stable.country, shop };
  const target = { pathname: routerPath(), search: buildSearch(next), hash: '' };
  [ctx.router, ctx.app?.router?.router].filter(Boolean).forEach((router) => {
    if (typeof router.navigate === 'function') router.navigate(target, { replace: true });
  });
}

function replaceProductParams(product, shop = TOTAL_SHOP) {
  const next = {
    ...parseSearch(routerSearch()),
    asin: product?.asin || '',
    country: product?.country || '',
    shop,
  };
  const target = { pathname: routerPath(), search: buildSearch(next), hash: '' };
  [ctx.router, ctx.app?.router?.router].filter(Boolean).forEach((router) => {
    if (typeof router.navigate === 'function') router.navigate(target, { replace: true });
  });
}

function productKey(row) {
  return String(row?.unique || `${row?.asin || ''}_${row?.country || ''}`);
}

function pad2(value) { return String(value).padStart(2, '0'); }
function dateText(value) { return value ? String(value).slice(0, 10) : ''; }
function parseDate(value) {
  const parts = dateText(value).split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}
function formatDate(value) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return `${value.getFullYear()}-${pad2(value.getMonth() + 1)}-${pad2(value.getDate())}`;
}
function shortDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  return date ? `${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}` : '-';
}
function addDays(value, days) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}
function todayText() { return formatDate(new Date()); }
function nextMonday(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  const weekday = date.getDay();
  date.setDate(date.getDate() + (weekday === 0 ? 1 : 8 - weekday));
  return date;
}
function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function fmt(value, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return parsed.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function inRange(value, start, end) {
  const text = dateText(value);
  return Boolean(text && text >= formatDate(start) && text <= formatDate(end));
}

async function requestShops(asin, country) {
  if (!asin || !country) return [];
  const response = await apiRequest({
    url: 'inventory_base:list', method: 'get', params: {
      page: 1, pageSize: 300, fields: 'shop',
      filter: JSON.stringify({ $and: [
        { asin: { $eq: asin } }, { country: { $eq: country } }, { date: { $eq: todayText() } },
      ] }),
    },
  });
  return Array.from(new Set(pickRows(response).map((row) => row.shop).filter(Boolean)))
    .filter((shop) => shop !== TOTAL_SHOP);
}

async function requestEligibleProducts() {
  if (!IS_ADMIN && !CURRENT_USERNAME) return [];
  const filters = [{ status: { $in: ELIGIBLE_STATUSES } }];
  if (!IS_ADMIN) filters.push({ sale_owner: { $eq: CURRENT_USERNAME } });
  const response = await apiRequest({
    url: 'asin:list', method: 'get', params: {
      page: 1, pageSize: 1000,
      fields: 'unique,asin,country,model,sale_owner,status,maintenance_level',
      filter: JSON.stringify({ $and: filters }),
    },
  });
  return pickRows(response)
    .filter((row) => ELIGIBLE_STATUSES.includes(row.status))
    .filter((row) => row.maintenance_level !== '变体')
    .filter((row) => row.asin && row.country)
    .sort((a, b) => [a.sale_owner, a.model ? `0${a.model}` : '1', a.asin, a.country].map((value) => String(value || '')).join('|')
      .localeCompare([b.sale_owner, b.model ? `0${b.model}` : '1', b.asin, b.country].map((value) => String(value || '')).join('|'), 'zh-CN'));
}

async function requestDailySales(params, forceTotal = false) {
  const start = formatDate(addDays(new Date(), -7));
  const end = formatDate(addDays(new Date(), DAILY_QUERY_DAYS));
  const shop = forceTotal ? TOTAL_SHOP : params.shop;
  const response = await apiRequest({
    url: 'daily_sales:list', method: 'get', params: {
      page: 1, pageSize: 500, sort: 'date',
      fields: [
        'asin', 'country', 'shop', 'model', 'date', 'type', 'weighted_sales', 'maybe_sales',
        'sale_maybe_sales', 'inventory', 'sale_inventory', 'days_for_sale', 'estimate_days_for_sales',
        'quantity_receive', 'add', 'on_the_way',
      ].join(','),
      filter: JSON.stringify({ $and: [
        { asin: { $eq: params.asin } }, { country: { $eq: params.country } }, { shop: { $eq: shop } },
        { date: { $dateNotBefore: start } }, { date: { $dateNotAfter: end } },
      ] }),
    },
  });
  return pickRows(response);
}

async function requestShipments(params) {
  const filters = [{ asin: { $eq: params.asin } }, { country: { $eq: params.country } }];
  if (params.shop && params.shop !== TOTAL_SHOP) filters.push({ shop: { $eq: params.shop } });
  const response = await apiRequest({
    url: 'simulate_shipment:list', method: 'get', params: {
      page: 1, pageSize: 2000, sort: 'date',
      fields: [
        'id', 'asin', 'country', 'shop', 'shop_id', 'channel', 'msku', 'sid_msku', 'sku_1',
        'number', 'date', 'season', 'warehouse_days', 'add_date', 'shippment_id', 'plan_source',
      ].join(','),
      filter: JSON.stringify({ $and: filters }),
    },
  });
  return pickRows(response);
}

async function requestWaterProduct(params) {
  const response = await apiRequest({
    url: 'water_product:list', method: 'get', params: {
      page: 1, pageSize: 10,
      fields: [
        'asin', 'country', 'shop1', 'model', 'sale_owner', 'manager', 'product_label', 'status',
        'inv_sales_ratio', 'expected_stockout_date', 'total_instock', 'weighted_sales',
        'quantity_receive', 'maybe_sales', 'on_the_way', 'inventory',
      ].join(','),
      filter: JSON.stringify({ $and: [
        { asin: { $eq: params.asin } },
        { country: { $eq: params.country } },
        { shop1: { $eq: TOTAL_SHOP } },
      ] }),
    },
  });
  return pickRows(response)[0] || null;
}

async function requestModelLevel(params, model) {
  if (!params.country || !model) return '';
  const response = await apiRequest({
    url: 'model_level_config:list', method: 'get', params: {
      page: 1, pageSize: 10, fields: 'country,model,level_name,enabled',
      filter: JSON.stringify({ $and: [
        { country: { $eq: params.country } },
        { model: { $eq: model } },
        { enabled: { $eq: '是' } },
      ] }),
    },
  });
  return pickRows(response)[0]?.level_name || '';
}

function latestOnOrBefore(rows, date) {
  return rows.filter((row) => dateText(row.date) <= date).slice().sort((a, b) => dateText(b.date).localeCompare(dateText(a.date)))[0]
    || rows.slice().sort((a, b) => dateText(b.date).localeCompare(dateText(a.date)))[0]
    || null;
}

function buildWeeks(shipments) {
  const first = nextMonday(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const start = addDays(first, index * 7);
    const end = addDays(start, 6);
    const rows = shipments.filter((row) => inRange(row.date, start, end));
    const quantity = rows.reduce((sum, row) => sum + numberValue(row.number), 0);
    const addDates = rows.map((row) => parseDate(row.add_date)).filter(Boolean).sort((a, b) => a - b);
    const coverStart = addDates.length ? addDays(addDates[0], 7) : null;
    const coverEnd = addDates.length ? addDays(addDates[addDates.length - 1], 13) : null;
    return {
      key: `W${index + 1}`, index, start, end, rows, quantity,
      coverStart, coverEnd,
      newQty: rows.filter((row) => row.plan_source === PLAN_SOURCE).reduce((sum, row) => sum + numberValue(row.number), 0),
      legacyQty: rows.filter((row) => row.plan_source !== PLAN_SOURCE).reduce((sum, row) => sum + numberValue(row.number), 0),
    };
  });
}

function sourceName(value) { return value === PLAN_SOURCE ? '新算法' : '原有计划'; }
function ratioInfo(row) {
  const ratio = numberValue(row?.inv_sales_ratio, NaN);
  if (!Number.isFinite(ratio)) return { value: null, name: '未计算', color: '#667085', bg: '#f2f4f7' };
  if (ratio < 3.5) return { value: ratio, name: '短缺', color: '#147a43', bg: '#e9f7ee' };
  if (ratio <= 4.5) return { value: ratio, name: '正常', color: '#1d5fc4', bg: '#eef4ff' };
  return { value: ratio, name: '滞销', color: '#b03a2e', bg: '#fbe9e7' };
}

function InfoBox({ children, tone = 'blue' }) {
  const palette = tone === 'gold'
    ? { bg: '#fff8e6', border: '#f0c36d', text: '#704800' }
    : { bg: '#eef4ff', border: '#bcd2ff', text: '#2b477a' };
  return h('div', { style: {
    background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text,
    borderRadius: 8, padding: '9px 13px', fontSize: 12.5, lineHeight: 1.75,
  } }, children);
}

function ProductSwitcher({
  selectedSale,
  selectedModel,
  selectedProductKey,
  saleOptions,
  modelOptions,
  productOptions,
  productCount,
  loading,
  onSaleChange,
  onModelChange,
  onProductChange,
}) {
  const commonSelectProps = {
    size: 'small',
    showSearch: true,
    optionFilterProp: 'label',
    loading,
    disabled: loading,
  };
  return h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: '#f8fafc',
    border: '1px solid #dfe4eb', borderRadius: 8, flexWrap: 'wrap', marginBottom: 8,
  } },
  h('b', { style: { fontSize: 12.5, whiteSpace: 'nowrap' } }, '商品范围'),
  IS_ADMIN
    ? h(React.Fragment, null,
      h('span', { style: { fontSize: 12, color: C.muted } }, '销售'),
      h(Select, {
        ...commonSelectProps,
        value: selectedSale,
        options: saleOptions,
        onChange: onSaleChange,
        style: { width: 140 },
      }))
    : h(Tag, { color: 'blue', bordered: false, style: { marginInlineEnd: 0 } }, `当前销售：${CURRENT_USERNAME || '未识别'}`),
  h('span', { style: { fontSize: 12, color: C.muted } }, '型号'),
  h(Select, {
    ...commonSelectProps,
    value: selectedModel,
    options: modelOptions,
    onChange: onModelChange,
    style: { width: 170 },
  }),
  h('span', { style: { fontSize: 12, color: C.muted } }, 'ASIN / 站点'),
  h(Select, {
    ...commonSelectProps,
    value: selectedProductKey || undefined,
    placeholder: '请选择 ASIN / 站点',
    options: productOptions,
    onChange: onProductChange,
    style: { width: 310, maxWidth: '100%' },
  }),
  h(Tag, { bordered: false, style: { marginInlineEnd: 0 } }, `${productCount} 个可用商品`));
}

function ShopSwitcher({ params, shops, loading, onChange, onRefresh }) {
  const list = [TOTAL_SHOP, ...shops.filter((shop) => shop !== TOTAL_SHOP)];
  return h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', background: '#f6f9ff',
    border: '1px solid #dbe7fa', borderRadius: 8, overflowX: 'auto', marginBottom: 10,
  } },
  h(ShopOutlined || 'span', { style: { color: C.blue } }),
  h('b', { style: { fontSize: 12.5, whiteSpace: 'nowrap' } }, '店铺选择'),
  ...list.map((shop) => h(Button, {
    key: shop, size: 'small', type: params.shop === shop ? 'primary' : 'default',
    onClick: () => onChange(shop), style: { borderRadius: 6, fontWeight: 700, flex: '0 0 auto' },
  }, shop)),
  h(Tag, { color: 'blue', style: { marginLeft: 2 } }, `${Math.max(0, list.length - 1)} 个店铺`),
  h(Tooltip, { title: '重新读取店铺和计划数据' }, h(Button, {
    size: 'small', icon: h(ReloadOutlined || 'span'), loading, onClick: onRefresh, style: { marginLeft: 'auto' },
  }, '刷新')));
}

function RoleBar() {
  const roles = ['销售', '主管', '采购', '终审'];
  return h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: '#f3f6fb',
    border: '1px solid #e0e7f1', borderRadius: 9, padding: '9px 13px', marginBottom: 12,
  } },
  h('b', { style: { fontSize: 12.5, color: '#3a4763' } }, '角色透镜'),
  ...roles.map((role, index) => h(Tooltip, { key: role, title: '当前数据表没有审批状态字段，暂不启用' },
    h('span', { style: {
      fontSize: 13, fontWeight: 700, color: index === 0 ? '#fff' : '#7a818d', borderRadius: 8,
      padding: '6px 13px', background: index === 0 ? C.ink : '#fff', border: '1px solid #dfe4eb', cursor: 'not-allowed',
    } }, role, h('span', { style: {
      marginLeft: 7, fontSize: 10, background: index === 0 ? '#ff6b60' : '#c8cfda', color: '#fff', borderRadius: 9, padding: '0 6px',
    } }, '0')))),
  h(Segmented, { size: 'small', disabled: true, value: '全部', options: ['待我处理', '全部'] }),
  h(Button, { disabled: true, type: 'primary', style: { marginLeft: 'auto', background: C.green } }, '✓ 全表一键通过'),
  h('div', { style: { width: '100%', fontSize: 11.5, color: '#8a9099' } },
    '审批与修改申请在 v19 中属于 mock；当前仅复刻界面结构，不伪造待办或审批结果。'));
}

function Legend() {
  const swatch = (color, bg) => h('span', { style: {
    width: 17, height: 13, display: 'inline-block', borderRadius: 3, background: bg, boxShadow: `inset 0 0 0 2px ${color}`,
  } });
  const item = (...children) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 } }, ...children);
  return h('div', { style: {
    border: '1px solid #e1e5eb', borderRadius: 8, background: '#fbfcfe', padding: '8px 11px',
    fontSize: 11.5, color: '#555d69', lineHeight: 1.9, marginBottom: 10,
  } },
  h('div', null, item(h('b', null, '变动：')), item(h('b', { style: { color: '#147a43' } }, '↑'), '加发'),
    item(h('b', { style: { color: '#1d5fc4' } }, '↓'), '减发'), item(h('b', { style: { color: '#7c3aed' } }, '⟳'), '系统重算'),
    item(h('b', null, '流转外框：')), item(swatch('#e5c14e', '#fffdf0'), '待销售'), item(swatch(C.orange, '#fff8ee'), '待主管'),
    item(swatch(C.blue, '#f0f5ff'), '待采购'), item(swatch(C.purple, '#f6f3ff'), '待终审')),
  h('div', null, item(h('b', null, '库销比：')), item(h(Tag, { color: 'green', bordered: false }, '短缺 <3.5')),
    item(h(Tag, { color: 'blue', bordered: false }, '正常 3.5–4.5')), item(h(Tag, { color: 'red', bordered: false }, '滞销 >4.5')),
    item(h('b', null, '计划来源：')), item(h(Tag, { color: 'blue', bordered: false }, '新算法')), item(h(Tag, { bordered: false }, '原有计划'))),
  h('div', null, item(h('b', null, '周段闸：')), item('🔒 W1–W2 守工厂节奏'), item(h('b', { style: { color: '#1d5fc4' } }, 'W3–W5 已承诺')),
    item(h('b', { style: { color: C.gold } }, 'W6 已承诺 · W7 前沿'))));
}

function SafetyChart({ dailyRows, weeks }) {
  const width = 1280;
  const height = 250;
  const left = 45;
  const top = 22;
  const plotW = width - left - 22;
  const plotH = height - top - 38;
  const points = dailyRows.slice().sort((a, b) => dateText(a.date).localeCompare(dateText(b.date))).slice(0, 91);
  if (!points.length) return h(Empty, { image: Empty.PRESENTED_IMAGE_SIMPLE, description: '暂无安全天数趋势数据' });
  const maxY = Math.max(28, SAFE_MAX_DAYS + 4, ...points.map((row) => numberValue(row.estimate_days_for_sales ?? row.days_for_sale)));
  const x = (index) => left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotW);
  const y = (value) => top + plotH - (Math.max(0, Math.min(maxY, numberValue(value))) / maxY) * plotH;
  const path = points.map((row, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(row.estimate_days_for_sales ?? row.days_for_sale).toFixed(1)}`).join(' ');
  const weekMarks = weeks.map((week) => {
    const index = points.findIndex((row) => dateText(row.date) >= formatDate(week.start));
    return index < 0 ? null : { ...week, x: x(index) };
  }).filter(Boolean);
  return h('div', { style: { overflowX: 'auto' } },
    h('svg', { viewBox: `0 0 ${width} ${height}`, style: { width: '100%', minWidth: 900, display: 'block' } },
      h('rect', { x: left, y: y(SAFE_MAX_DAYS), width: plotW, height: y(SAFE_MIN_DAYS) - y(SAFE_MAX_DAYS), fill: '#e9f7ee' }),
      h('line', { x1: left, x2: left + plotW, y1: y(SAFE_MIN_DAYS), y2: y(SAFE_MIN_DAYS), stroke: C.orange, strokeDasharray: '6 5' }),
      h('line', { x1: left, x2: left + plotW, y1: y(SAFE_MAX_DAYS), y2: y(SAFE_MAX_DAYS), stroke: C.green, strokeDasharray: '6 5' }),
      h('text', { x: 5, y: y(SAFE_MIN_DAYS) + 4, fontSize: 11, fill: C.orange }, '7 天'),
      h('text', { x: 2, y: y(SAFE_MAX_DAYS) + 4, fontSize: 11, fill: C.green }, '14 天'),
      ...weekMarks.map((mark) => h('g', { key: mark.key },
        h('line', { x1: mark.x, x2: mark.x, y1: top, y2: top + plotH, stroke: '#d8dee8', strokeDasharray: '3 4' }),
        h('circle', { cx: mark.x, cy: top + plotH - 5, r: Math.min(7, 3 + Math.sqrt(mark.quantity) / 7), fill: mark.index >= 5 ? '#d79b32' : '#7aa4ff' }),
        h('text', { x: mark.x, y: height - 8, textAnchor: 'middle', fontSize: 10, fill: '#6a7280' }, mark.key))),
      h('path', { d: path, fill: 'none', stroke: C.blue, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }),
    ),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#7a818d', padding: '0 8px' } },
      h('span', null, `起点 ${dateText(points[0].date)}`),
      h('span', null, '绿色区域 = 7–14 天安全区间；圆点 = 周计划节点'),
      h('span', null, `终点 ${dateText(points[points.length - 1].date)}`)));
}

function WeekCell({ week, isOrder, onOpen }) {
  const hasNew = week.newQty > 0;
  const bg = isOrder ? '#fff8e8' : '#fff';
  return h('td', { onClick: () => onOpen(week), style: {
    minWidth: 112, padding: '12px 8px', textAlign: 'center', borderRight: '1px solid #e3e7ed',
    borderBottom: '1px solid #e3e7ed', background: bg, cursor: week.rows.length ? 'pointer' : 'default', position: 'relative',
  } },
  hasNew ? h('span', { style: { position: 'absolute', top: 5, right: 6, color: '#7c3aed', fontWeight: 900, fontSize: 11 } }, '⟳') : null,
  h('div', { style: { fontSize: 17, fontWeight: 850, color: isOrder ? '#8b5700' : C.ink } }, week.quantity ? fmt(week.quantity) : '—'),
  h('div', { style: { marginTop: 3, fontSize: 10, color: '#8a9099' } },
    week.rows.length ? `${week.rows.length} 条 · ${hasNew ? '含新算法' : '原有计划'}` : '该周无排'));
}

function EvolutionTable({ params, currentRow, totalRow, waterRow, levelName, dailyRows, weeks, netWeeks }) {
  const [expanded, setExpanded] = useState(false);
  const [w12Open, setW12Open] = useState(false);
  const [drawerWeek, setDrawerWeek] = useState(null);
  const summaryRow = waterRow || currentRow;
  const ratio = ratioInfo(summaryRow);
  const shownWeeks = w12Open ? weeks : [{
    key: 'W1–W2', folded: true, quantity: weeks[0].quantity + weeks[1].quantity,
    rows: [...weeks[0].rows, ...weeks[1].rows], start: weeks[0].start, end: weeks[1].end,
  }, ...weeks.slice(2)];
  const netScopeWeeks = netWeeks || weeks;
  const orderQty = netScopeWeeks[5].quantity + netScopeWeeks[6].quantity;
  const quantityReceive = numberValue(waterRow?.quantity_receive ?? totalRow?.quantity_receive);
  const earlierCommitted = netScopeWeeks.slice(0, 5).reduce((sum, week) => sum + numberValue(week.quantity), 0);
  const undelivered = Math.max(0, quantityReceive - earlierCommitted);
  const net = Math.max(0, orderQty - undelivered);
  const productCells = [
    params.country || '-', waterRow?.sale_owner || '-', summaryRow?.model || '-', params.asin || '-', fmt(summaryRow?.weighted_sales, 1),
    levelName || '未配置', `${fmt(ratio.value, 1)} ${waterRow?.status || ratio.name}`, waterRow?.product_label || '未配置',
  ];
  const headCell = (text, options = {}) => {
    const { rowSpan, colSpan, ...style } = options;
    return h('th', { rowSpan, colSpan, style: {
    padding: '7px 6px', borderRight: '1px solid #dce1e8', borderBottom: '1px solid #dce1e8',
    fontSize: 11, lineHeight: 1.35, textAlign: 'center', color: '#46505f', whiteSpace: 'nowrap', ...style,
    } }, text);
  };
  return h(React.Fragment, null,
    h('div', { style: { overflowX: 'auto', border: '1px solid #dce1e8', borderRadius: 8 } },
      h('table', { style: { width: '100%', minWidth: w12Open ? 1540 : 1430, borderCollapse: 'separate', borderSpacing: 0, background: '#fff' } },
        h('thead', null,
          h('tr', null,
            h('th', { colSpan: 9, style: { padding: 8, background: '#eaf7ef', color: '#17603b', borderBottom: '1px solid #cfe8d8', fontSize: 12.5 } },
              '商品信息（看一眼就能初判：要不要备、能不能备）'),
            h('th', { colSpan: shownWeeks.length, style: { padding: 8, background: '#fff4df', color: '#805000', borderBottom: '1px solid #edd8aa', fontSize: 12.5 } },
              '发货周次（W1 = 下周；W6–W7 为本期下单批）'),
            h('th', { rowSpan: 4, style: { width: 170, background: '#fff0c8', color: '#764900', borderLeft: '1px solid #e6c56b', fontSize: 12.5 } },
              '需新下厂', h('div', { style: { fontSize: 10, fontWeight: 500, marginTop: 3 } }, '净额 · PO 唯一依据'))),
          h('tr', null,
            headCell('趋势', { rowSpan: 3, width: 38, background: '#f4f8f5' }),
            ...['站点', '销售', '型号', 'ASIN', '加权日均', '等级', '库销比', '标签'].map((title) => headCell(title, { rowSpan: 3, background: '#f4f8f5' })),
            ...shownWeeks.map((week) => headCell(week.key, {
              background: week.folded ? '#f4f6fa' : (week.index >= 5 ? '#fff1d5' : '#fff8eb'),
              color: week.index >= 5 ? '#8b5700' : '#475467', fontWeight: 850,
            }))),
          h('tr', null, ...shownWeeks.map((week) => headCell(`${shortDate(week.start)}~${shortDate(week.end)}`, {
            background: week.index >= 5 ? '#fff5df' : '#fbfcfe', fontSize: 10,
          }))),
          h('tr', null, ...shownWeeks.map((week) => headCell(week.folded ? '点开看两周' : `可售 ${shortDate(week.coverStart)}~${shortDate(week.coverEnd)}`, {
            background: week.index >= 5 ? '#fff8ea' : '#fff', color: '#6f7784', fontSize: 9.5,
          })))),
        h('tbody', null,
          h('tr', null,
            h('td', { onClick: () => setExpanded((value) => !value), style: {
              textAlign: 'center', borderRight: '1px solid #e3e7ed', borderBottom: '1px solid #e3e7ed', cursor: 'pointer', background: '#fafbfd',
            } }, h(expanded ? DownOutlined || 'span' : RightOutlined || 'span')),
            ...productCells.map((value, index) => h('td', { key: index, style: {
              padding: '10px 7px', textAlign: index === 3 ? 'left' : 'center', borderRight: '1px solid #e3e7ed',
              borderBottom: '1px solid #e3e7ed', fontSize: 11.5, fontWeight: index === 2 || index === 3 ? 750 : 500,
              whiteSpace: 'nowrap', background: '#fff', color: index === 6 ? ratio.color : C.ink,
            } }, index === 6 ? h('span', { style: { background: ratio.bg, borderRadius: 5, padding: '2px 5px' } }, value) : value)),
            ...shownWeeks.map((week) => week.folded
              ? h('td', { key: week.key, onClick: () => setW12Open(true), title: '点击展开 W1–W2', style: {
                minWidth: 116, textAlign: 'center', background: '#f4f6fa', borderRight: '1px solid #e3e7ed',
                borderBottom: '1px solid #e3e7ed', cursor: 'pointer', fontWeight: 800,
              } }, `${fmt(week.quantity)} 🔒`, h('div', { style: { fontSize: 9.5, fontWeight: 500, color: '#7d8592' } }, '点开 ▸'))
              : h(WeekCell, { key: week.key, week, isOrder: week.index >= 5, onOpen: setDrawerWeek })),
            h('td', { style: {
              minWidth: 170, padding: '9px 10px', background: '#fff9e8', textAlign: 'center', borderBottom: '1px solid #e3e7ed',
            } },
            h('div', { style: { fontSize: 21, fontWeight: 900, color: net ? '#8b5700' : C.green } }, fmt(net)),
            h('div', { style: { fontSize: 10, color: '#7d6a43' } }, `计划 ${fmt(orderQty)} − 未交货余 ${fmt(undelivered)}`),
            h('div', { style: { fontSize: 9.5, color: '#9a8150', marginTop: 2 } },
              `合计未交货 ${fmt(quantityReceive)} − W1~W5占用 ${fmt(earlierCommitted)}`))),
          expanded ? h('tr', null, h('td', { colSpan: 9 + shownWeeks.length + 1, style: { padding: 14, background: '#fbfcfe' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
              h('b', { style: { fontSize: 12.5 } }, '到货与安全库存天数趋势'),
              h(Button, { size: 'small', onClick: () => setW12Open((value) => !value) }, w12Open ? '收起 W1–W2' : '展开 W1–W2')),
            h(SafetyChart, { dailyRows, weeks }))) : null))),
    h(Drawer, {
      title: drawerWeek ? `${drawerWeek.key} 发货计划明细` : '发货计划明细', open: Boolean(drawerWeek),
      onClose: () => setDrawerWeek(null), width: 560,
    }, drawerWeek && drawerWeek.rows.length
      ? h('div', null, ...drawerWeek.rows.map((row) => h('div', { key: row.id, style: {
        border: '1px solid #e1e5eb', borderLeft: `4px solid ${row.plan_source === PLAN_SOURCE ? C.blue : '#98a2b3'}`,
        borderRadius: 8, padding: 12, marginBottom: 10,
      } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 10 } },
        h('b', null, `${dateText(row.date)} · ${row.shop || '-'}`),
        h(Tag, { color: row.plan_source === PLAN_SOURCE ? 'blue' : 'default', bordered: false }, sourceName(row.plan_source))),
      h('div', { style: { fontSize: 24, fontWeight: 850, margin: '8px 0' } }, `${fmt(row.number)} 台`),
      h('div', { style: { fontSize: 12, color: C.muted, lineHeight: 1.8 } },
        `渠道：${row.channel || '-'}　预计入库：${dateText(row.add_date) || '-'}　淡旺季：${row.season || '-'}`))))
      : h(Empty, { description: '该周没有计划记录' })));
}

function ShipmentEvolutionBlock() {
  const [params, setParams] = useState(readParamsSync);
  const [products, setProducts] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selectedSale, setSelectedSale] = useState(IS_ADMIN ? ALL_SALES : CURRENT_USERNAME);
  const [selectedModel, setSelectedModel] = useState(ALL_MODELS);
  const [shops, setShops] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [totalRows, setTotalRows] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [waterRow, setWaterRow] = useState(null);
  const [levelName, setLevelName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('全部');
  const [onlyWarning, setOnlyWarning] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([resolveParams(), requestEligibleProducts()])
      .then(([initialParams, productRows]) => {
        if (!active) return;
        setProducts(productRows);
        const requestedProduct = productRows.find((row) => row.asin === initialParams.asin && row.country === initialParams.country);
        const firstProduct = requestedProduct || productRows[0] || null;
        if (firstProduct) {
          const nextShop = requestedProduct ? (initialParams.shop || TOTAL_SHOP) : TOTAL_SHOP;
          setParams({ asin: firstProduct.asin, country: firstProduct.country, shop: nextShop });
          if (!requestedProduct) replaceProductParams(firstProduct, nextShop);
        } else {
          setParams({ asin: '', country: '', shop: TOTAL_SHOP });
          setCatalogError(!IS_ADMIN && !CURRENT_USERNAME
            ? '无法识别当前登录用户，不能确定可查看的商品范围。'
            : '当前查看范围内没有状态为普通、新品或重点的非变体 ASIN。');
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setProducts([]);
        setParams({ asin: '', country: '', shop: TOTAL_SHOP });
        setCatalogError(requestError?.message || String(requestError));
      })
      .finally(() => {
        if (active) {
          setCatalogLoading(false);
          setCatalogReady(true);
        }
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!catalogReady) return undefined;
    const unsubscribers = [ctx.router, ctx.app?.router?.router].filter((router) => typeof router?.subscribe === 'function')
      .map((router) => router.subscribe(() => {
        const next = readParamsSync();
        const allowedProduct = products.find((row) => row.asin === next.asin && row.country === next.country);
        if (!allowedProduct) return;
        setParams({ asin: allowedProduct.asin, country: allowedProduct.country, shop: next.shop || TOTAL_SHOP });
      }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [catalogReady, products]);

  const loadData = useCallback(async () => {
    if (!catalogReady) return;
    if (!params.asin || !params.country) {
      setDailyRows([]); setTotalRows([]); setShipments([]); setShops([]);
      setWaterRow(null); setLevelName('');
      setError(''); setLoading(false); return;
    }
    const activeParams = { ...params, shop: params.shop || TOTAL_SHOP };
    setLoading(true); setError('');
    try {
      const needsSeparateTotal = activeParams.shop !== TOTAL_SHOP;
      const [shopList, dailyData, totalData, shipmentData, waterData] = await Promise.all([
        requestShops(activeParams.asin, activeParams.country),
        requestDailySales(activeParams, false),
        needsSeparateTotal ? requestDailySales(activeParams, true) : requestDailySales(activeParams, false),
        requestShipments(activeParams),
        requestWaterProduct(activeParams),
      ]);
      const shipmentShops = shipmentData.map((row) => row.shop).filter(Boolean).filter((shop) => shop !== TOTAL_SHOP);
      setShops(Array.from(new Set([...shopList, ...shipmentShops])));
      setDailyRows(dailyData); setTotalRows(totalData); setShipments(shipmentData);
      setWaterRow(waterData);
      setLevelName(await requestModelLevel(activeParams, waterData?.model || dailyData[0]?.model || totalData[0]?.model));
    } catch (requestError) {
      setDailyRows([]); setTotalRows([]); setShipments([]);
      setWaterRow(null); setLevelName('');
      setError(requestError?.message || String(requestError));
    } finally { setLoading(false); }
  }, [catalogReady, params.asin, params.country, params.shop, refreshSeed]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredShipments = useMemo(() => {
    if (sourceFilter === '新算法') return shipments.filter((row) => row.plan_source === PLAN_SOURCE);
    if (sourceFilter === '原有计划') return shipments.filter((row) => row.plan_source !== PLAN_SOURCE);
    return shipments;
  }, [shipments, sourceFilter]);
  const currentRow = useMemo(() => dailyRows.find((row) => dateText(row.date) === todayText()) || null, [dailyRows]);
  const totalRow = useMemo(() => totalRows.find((row) => dateText(row.date) === todayText()) || null, [totalRows]);
  const weeks = useMemo(() => buildWeeks(filteredShipments), [filteredShipments]);
  const netWeeks = useMemo(() => buildWeeks(shipments), [shipments]);
  const displayRow = waterRow || currentRow;
  const ratio = ratioInfo(displayRow);
  const hiddenByWarning = onlyWarning && ratio.name === '正常';

  const saleOptions = useMemo(() => {
    const names = Array.from(new Set(products.map((row) => row.sale_owner).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
    return [{ value: ALL_SALES, label: '全部销售' }, ...names.map((name) => ({ value: name, label: name }))];
  }, [products]);
  const saleScopedProducts = useMemo(() => (
    IS_ADMIN && selectedSale !== ALL_SALES
      ? products.filter((row) => row.sale_owner === selectedSale)
      : products
  ), [products, selectedSale]);
  const modelOptions = useMemo(() => {
    const models = Array.from(new Set(saleScopedProducts.map((row) => row.model).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
    return [{ value: ALL_MODELS, label: '全部型号' }, ...models.map((model) => ({ value: model, label: model }))];
  }, [saleScopedProducts]);
  const visibleProducts = useMemo(() => (
    selectedModel === ALL_MODELS
      ? saleScopedProducts
      : saleScopedProducts.filter((row) => row.model === selectedModel)
  ), [saleScopedProducts, selectedModel]);
  const productOptions = useMemo(() => visibleProducts.map((row) => ({
    value: productKey(row),
    label: `${IS_ADMIN && selectedSale === ALL_SALES ? `${row.sale_owner || '未分配'} · ` : ''}${row.model || '未填型号'} · ${row.asin} · ${row.country} · ${row.status}`,
  })), [visibleProducts, selectedSale]);
  const selectedProduct = useMemo(() => products.find((row) => row.asin === params.asin && row.country === params.country) || null,
    [products, params.asin, params.country]);

  function chooseProduct(product) {
    if (!product) return;
    setSourceFilter('全部');
    setParams({ asin: product.asin, country: product.country, shop: TOTAL_SHOP });
    replaceProductParams(product, TOTAL_SHOP);
  }

  function changeSale(sale) {
    setSelectedSale(sale);
    setSelectedModel(ALL_MODELS);
    const candidates = sale === ALL_SALES ? products : products.filter((row) => row.sale_owner === sale);
    chooseProduct(candidates[0] || null);
  }

  function changeModel(model) {
    setSelectedModel(model);
    const candidates = model === ALL_MODELS
      ? saleScopedProducts
      : saleScopedProducts.filter((row) => row.model === model);
    chooseProduct(candidates[0] || null);
  }

  function changeProduct(key) {
    chooseProduct(visibleProducts.find((row) => productKey(row) === key) || null);
  }

  function changeShop(shop) {
    setSourceFilter('全部'); setParams((current) => ({ ...current, shop })); replaceShopParam(shop);
  }

  return h('div', { style: {
    padding: 14, background: C.page, color: C.ink, border: '1px solid #dfe4eb', borderRadius: 9,
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif',
  } },
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 10 } },
    h('span', { style: { fontSize: 21 } }, '📦'),
    h(Typography.Title, { level: 4, style: { margin: 0, fontSize: 20 } }, '发货计划演变'),
    h(Tag, { color: 'blue', bordered: false }, 'v19 · 真实数据版'),
    h(Tag, { color: shipments.some((row) => row.plan_source === PLAN_SOURCE) ? 'cyan' : 'default', bordered: false },
      shipments.some((row) => row.plan_source === PLAN_SOURCE) ? '已接入新算法' : '等待新算法数据'),
    h('span', { style: { marginLeft: 'auto', fontSize: 12, color: C.muted } }, `${params.asin || '-'} · ${params.country || '-'} · ${params.shop || TOTAL_SHOP}`)),
  h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: '#fff', border: '1px solid #d8dee8', borderBottom: `2px solid ${C.blue}`, borderRadius: '7px 7px 0 0', fontSize: 12.5, fontWeight: 800, marginBottom: 9 } },
    h(GlobalOutlined || 'span'), '全部站点 · 统一系统'),
  h('div', { style: { background: C.panel, border: '1px solid #dfe4eb', borderRadius: 9, padding: 12 } },
    h(ProductSwitcher, {
      selectedSale,
      selectedModel,
      selectedProductKey: selectedProduct ? productKey(selectedProduct) : '',
      saleOptions,
      modelOptions,
      productOptions,
      productCount: visibleProducts.length,
      loading: catalogLoading,
      onSaleChange: changeSale,
      onModelChange: changeModel,
      onProductChange: changeProduct,
    }),
    h(ShopSwitcher, { params, shops, loading: catalogLoading || loading, onChange: changeShop, onRefresh: () => setRefreshSeed((value) => value + 1) }),
    h('div', { style: { fontSize: 12.5, lineHeight: 1.75, color: '#4d5562', marginBottom: 10 } },
      '系统每周滚动计算发货计划，表头依次展示周次、发货日期和覆盖售卖期。格子为该周应发量；',
      h('b', null, '需下单净额 = W6 + W7 − 未交货订单余量'),
      '。未交货订单余量固定读取当天 ASIN + country + shop=合计 的 quantity_receive。'),
    h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 8, marginBottom: 8 } },
      h(InfoBox, null, h('b', null, '① 确认发货计划　'), '按 W1–W7 查看真实计划；点击周格查看店铺、渠道、预计入库和计划来源。'),
      h(InfoBox, null, h('b', null, '② 看覆盖前沿　'), '覆盖售卖期按计划预计入库日 add_date 后第 7～13 天计算；展开行查看安全天数趋势。')),
    h(InfoBox, { tone: 'gold' }, '数据口径：商品数据来自 daily_sales；周计划来自 simulate_shipment；新旧算法以 plan_source 区分。当前审批、拖动改量和生成 PO 没有真实状态表支撑，因此只保留界面位置，不执行写入。'),
    h('div', { style: { height: 10 } }),
    h(RoleBar),
    catalogError ? h('div', { style: { padding: '10px 12px', border: '1px solid #f2b8b5', borderRadius: 8, background: '#fff1f0', color: '#a61d24', marginBottom: 10 } },
      h('b', null, '商品范围加载失败　'), catalogError) : null,
    error ? h('div', { style: { padding: '10px 12px', border: '1px solid #f2b8b5', borderRadius: 8, background: '#fff1f0', color: '#a61d24', marginBottom: 10 } },
      h('b', null, '发货计划数据加载失败　'), error) : null,
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 9 } },
      h('b', { style: { fontSize: 12 } }, '筛选'),
      h('span', { style: { fontSize: 12 } }, '仅看预警'), h(Switch, { size: 'small', checked: onlyWarning, onChange: setOnlyWarning }),
      h('span', { style: { marginLeft: 'auto', fontSize: 11.5, color: C.muted } }, hiddenByWarning ? '0 条' : currentRow ? '1 条' : '0 条'),
      h(Segmented, { size: 'small', value: sourceFilter, options: ['全部', '新算法', '原有计划'], onChange: setSourceFilter })),
    h(Legend),
    catalogLoading || loading ? h('div', { style: { minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      h(Spin, { size: 'large', tip: catalogLoading ? '正在识别当前用户的商品范围...' : '正在读取 daily_sales 与 simulate_shipment...' }))
      : hiddenByWarning ? h(Empty, { description: '当前记录不属于预警范围' })
        : displayRow ? h(EvolutionTable, { params, currentRow: currentRow || displayRow, totalRow, waterRow, levelName, dailyRows, weeks, netWeeks })
          : h(Empty, { description: selectedProduct ? `当天没有 ${params.shop || TOTAL_SHOP} 的 daily_sales 数据` : '当前范围内没有可查看的商品' }),
    h('div', { style: { marginTop: 8 } }, h(InfoBox, null,
      'W8+ 为系统预览区，本面板暂不展示。当前店铺选择为“合计”时，daily_sales 使用合计行，simulate_shipment 汇总实际店铺记录；选择具体店铺后，两者均切换到该店铺。'))));
}

ctx.render(h(ShipmentEvolutionBlock));
