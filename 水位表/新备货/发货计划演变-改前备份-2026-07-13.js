const React = ctx.libs.React;
const { useCallback, useEffect, useMemo, useState } = React;
const {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Segmented,
  Space,
  Spin,
  Statistic,
  Table,
  Tag,
  Tooltip,
  Typography,
} = ctx.libs.antd;
const icons = ctx.libs.antdIcons || {};
const {
  CalendarOutlined,
  DatabaseOutlined,
  ReloadOutlined,
  ShopOutlined,
  ThunderboltOutlined,
} = icons;

const TOTAL_SHOP = '合计';
const PLAN_SOURCE = 'shipment_plan_v2';
const SAFE_MIN_DAYS = 7;
const SAFE_MAX_DAYS = 14;
const CHART_DAYS = 91;
const DAILY_QUERY_DAYS = 125;

function apiRequest(options) {
  if (typeof ctx.request === 'function') return ctx.request(options);
  return ctx.api.request(options);
}

function pickRows(response) {
  const payload = response?.data;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;
  return [];
}

function readDirectParam(source, name) {
  if (!source) return '';
  if (typeof source.get === 'function') return source.get(name) || '';
  return source[name] || '';
}

function parseSearch(searchText) {
  const result = {};
  String(searchText || '')
    .replace(/^\?/, '')
    .split('&')
    .forEach((part) => {
      if (!part) return;
      const index = part.indexOf('=');
      const key = index < 0 ? part : part.slice(0, index);
      const value = index < 0 ? '' : part.slice(index + 1);
      if (!key) return;
      result[decodeURIComponent(key)] = decodeURIComponent(value);
    });
  return result;
}

function getRouterSearch() {
  return (
    ctx.router?.state?.location?.search
    || ctx.app?.router?.router?.state?.location?.search
    || ctx.app?.router?.location?.search
    || ''
  );
}

function getRouterPathname() {
  return (
    ctx.router?.state?.location?.pathname
    || ctx.app?.router?.router?.state?.location?.pathname
    || ctx.app?.router?.location?.pathname
    || '/'
  );
}

function buildSearch(params) {
  const query = Object.keys(params || {})
    .filter((key) => params[key] != null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');
  return query ? `?${query}` : '';
}

function readParamsSync() {
  const direct = ctx.urlSearchParams || {};
  const routerParams = parseSearch(getRouterSearch());
  return {
    asin: readDirectParam(direct, 'asin') || routerParams.asin || '',
    country: readDirectParam(direct, 'country') || routerParams.country || '',
    shop: readDirectParam(direct, 'shop') || routerParams.shop || TOTAL_SHOP,
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
  const current = parseSearch(getRouterSearch());
  const next = { ...current, shop };
  const pathname = getRouterPathname();
  const search = buildSearch(next);
  const routers = [ctx.router, ctx.app?.router?.router].filter(Boolean);
  routers.forEach((router) => {
    if (typeof router.navigate === 'function') {
      router.navigate({ pathname, search, hash: '' }, { replace: true });
    }
  });
}

function pad2(value) {
  return String(value).padStart(2, '0');
}

function dateText(value) {
  if (!value) return '';
  const text = String(value);
  return text.length >= 10 ? text.slice(0, 10) : text;
}

function parseDate(value) {
  const text = dateText(value);
  if (!text) return null;
  const parts = text.split('-').map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function addDays(value, days) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  date.setDate(date.getDate() + Number(days || 0));
  return date;
}

function todayText() {
  return formatDate(new Date());
}

function nextMonday(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  const weekday = date.getDay();
  const delta = weekday === 0 ? 1 : 8 - weekday;
  date.setDate(date.getDate() + delta);
  return date;
}

function inDateRange(value, start, end) {
  const text = dateText(value);
  return Boolean(text && text >= formatDate(start) && text <= formatDate(end));
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return parsed.toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function sourceLabel(value) {
  return value === PLAN_SOURCE ? '新算法' : '原有计划';
}

function sourceColor(value) {
  return value === PLAN_SOURCE ? 'blue' : 'default';
}

async function requestShops(asin, country) {
  if (!asin || !country) return [];
  const response = await apiRequest({
    url: 'inventory_base:list',
    method: 'get',
    params: {
      page: 1,
      pageSize: 300,
      fields: 'shop',
      filter: JSON.stringify({
        $and: [
          { asin: { $eq: asin } },
          { country: { $eq: country } },
          { date: { $eq: todayText() } },
        ],
      }),
    },
  });
  return Array.from(new Set(pickRows(response).map((row) => row.shop).filter(Boolean)));
}

async function requestDailySales(params) {
  const start = formatDate(addDays(new Date(), -7));
  const end = formatDate(addDays(new Date(), DAILY_QUERY_DAYS));
  const response = await apiRequest({
    url: 'daily_sales:list',
    method: 'get',
    params: {
      page: 1,
      pageSize: 500,
      sort: 'date',
      fields: [
        'asin',
        'country',
        'shop',
        'model',
        'date',
        'type',
        'weighted_sales',
        'maybe_sales',
        'sale_maybe_sales',
        'inventory',
        'sale_inventory',
        'days_for_sale',
        'estimate_days_for_sales',
        'add',
        'on_the_way',
      ].join(','),
      filter: JSON.stringify({
        $and: [
          { asin: { $eq: params.asin } },
          { country: { $eq: params.country } },
          { shop: { $eq: params.shop } },
          { date: { $dateNotBefore: start } },
          { date: { $dateNotAfter: end } },
        ],
      }),
    },
  });
  return pickRows(response);
}

async function requestShipments(params) {
  const filters = [
    { asin: { $eq: params.asin } },
    { country: { $eq: params.country } },
  ];
  if (params.shop && params.shop !== TOTAL_SHOP) {
    filters.push({ shop: { $eq: params.shop } });
  }
  const response = await apiRequest({
    url: 'simulate_shipment:list',
    method: 'get',
    params: {
      page: 1,
      pageSize: 1000,
      sort: 'date',
      fields: [
        'id',
        'asin',
        'country',
        'shop',
        'shop_id',
        'channel',
        'msku',
        'sid_msku',
        'sku_1',
        'number',
        'date',
        'season',
        'warehouse_days',
        'add_date',
        'shippment_id',
        'plan_source',
      ].join(','),
      filter: JSON.stringify({ $and: filters }),
    },
  });
  return pickRows(response);
}

function buildWeeks(shipments) {
  const firstMonday = nextMonday(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const start = addDays(firstMonday, index * 7);
    const end = addDays(start, 6);
    const rows = shipments.filter((row) => inDateRange(row.date, start, end));
    const quantity = rows.reduce((sum, row) => sum + numberValue(row.number), 0);
    const addDates = rows.map((row) => dateText(row.add_date)).filter(Boolean).sort();
    const sources = Array.from(new Set(rows.map((row) => row.plan_source || 'legacy')));
    return {
      key: `W${index + 1}`,
      index,
      label: `W${index + 1}`,
      start,
      end,
      rows,
      quantity,
      firstAddDate: addDates[0] || '',
      sources,
    };
  });
}

function MetricCard({ title, value, suffix, icon, tone }) {
  return React.createElement(Card, {
    size: 'small',
    styles: { body: { padding: '15px 16px' } },
    style: {
      height: '100%',
      borderRadius: 12,
      border: `1px solid ${tone || '#e6edf6'}`,
      boxShadow: '0 4px 16px rgba(15,23,42,0.045)',
    },
  },
    React.createElement(Space, { align: 'start', size: 12 },
      React.createElement('div', {
        style: {
          width: 34,
          height: 34,
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#2563eb',
          background: '#eff6ff',
          fontSize: 17,
        },
      }, icon || React.createElement(DatabaseOutlined || 'span')),
      React.createElement(Statistic, {
        title,
        value,
        suffix,
        valueStyle: { fontSize: 23, lineHeight: 1.15, color: '#14213d', fontWeight: 800 },
      }),
    ),
  );
}

function WeekCell({ week }) {
  const isOrderWeek = week.index >= 5;
  return React.createElement('div', {
    style: {
      minHeight: 86,
      padding: '10px 8px',
      borderRadius: 9,
      border: isOrderWeek ? '1px solid #f3c96b' : '1px solid #e8eef6',
      background: isOrderWeek ? '#fff9e8' : '#fbfdff',
      textAlign: 'center',
    },
  },
    React.createElement('div', {
      style: { color: week.quantity > 0 ? '#173b6c' : '#94a3b8', fontSize: 22, fontWeight: 900 },
    }, formatNumber(week.quantity)),
    React.createElement('div', { style: { marginTop: 3, color: '#718096', fontSize: 11 } },
      week.rows.length ? `${week.rows.length} 条计划` : '本周无计划',
    ),
    week.firstAddDate
      ? React.createElement('div', { style: { marginTop: 5, color: '#64748b', fontSize: 11 } }, `入库 ${week.firstAddDate}`)
      : null,
    week.sources.includes(PLAN_SOURCE)
      ? React.createElement(Tag, { color: 'blue', style: { marginTop: 5, marginInlineEnd: 0 } }, '新算法')
      : null,
  );
}

function WeeklyMatrix({ params, currentRow, weeks }) {
  const weekColumns = weeks.map((week) => ({
    title: React.createElement('div', { style: { textAlign: 'center', lineHeight: 1.45 } },
      React.createElement('div', { style: { fontWeight: 900, color: week.index >= 5 ? '#9a6700' : '#173b6c' } }, week.label),
      React.createElement('div', { style: { color: '#64748b', fontSize: 11 } }, formatDate(week.start)),
      React.createElement('div', { style: { color: '#94a3b8', fontSize: 10 } }, `至 ${formatDate(week.end)}`),
    ),
    key: week.key,
    width: 142,
    render: () => React.createElement(WeekCell, { week }),
  }));

  const columns = [
    {
      title: '当前产品',
      key: 'product',
      fixed: 'left',
      width: 220,
      render: () => React.createElement('div', null,
        React.createElement('div', { style: { color: '#172033', fontSize: 15, fontWeight: 900 } }, currentRow?.model || '-'),
        React.createElement('div', { style: { marginTop: 5, color: '#56657a', fontSize: 12 } }, params.asin || '-'),
        React.createElement(Space, { size: 5, wrap: true, style: { marginTop: 8 } },
          React.createElement(Tag, { color: 'geekblue' }, params.country || '-'),
          React.createElement(Tag, { color: params.shop === TOTAL_SHOP ? 'gold' : 'cyan' }, params.shop || TOTAL_SHOP),
        ),
      ),
    },
    ...weekColumns,
    {
      title: React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontWeight: 900, color: '#9a6700' } }, '下单批计划'),
        React.createElement('div', { style: { color: '#8b6f2b', fontSize: 11 } }, 'W6 + W7'),
      ),
      key: 'orderBatch',
      fixed: 'right',
      width: 145,
      render: () => React.createElement('div', {
        style: {
          padding: '18px 8px',
          borderRadius: 10,
          border: '1px solid #e8bd58',
          background: '#fff4cf',
          color: '#7a4d00',
          textAlign: 'center',
        },
      },
        React.createElement('div', { style: { fontSize: 25, fontWeight: 900 } }, formatNumber((weeks[5]?.quantity || 0) + (weeks[6]?.quantity || 0))),
        React.createElement('div', { style: { marginTop: 3, fontSize: 11 } }, '未扣未交货订单'),
      ),
    },
  ];

  return React.createElement(Table, {
    rowKey: 'key',
    size: 'small',
    pagination: false,
    columns,
    dataSource: [{ key: `${params.asin}_${params.country}_${params.shop}` }],
    scroll: { x: 1380 },
  });
}

function makeLinePath(values, xOf, yOf) {
  let started = false;
  return values
    .map((value, index) => {
      if (value == null) return null;
      const command = started ? 'L' : 'M';
      started = true;
      return `${command} ${xOf(index)} ${yOf(value)}`;
    })
    .filter(Boolean)
    .join(' ');
}

function SafetyChart({ dailyRows, shipments }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  const chartRows = useMemo(() => {
    const start = todayText();
    const end = formatDate(addDays(new Date(), CHART_DAYS - 1));
    return dailyRows.filter((row) => {
      const text = dateText(row.date);
      return text >= start && text <= end;
    });
  }, [dailyRows]);

  if (!chartRows.length) {
    return React.createElement(Empty, { description: '当前店铺没有未来安全库存数据' });
  }

  const width = 1120;
  const height = 300;
  const padding = { left: 54, right: 24, top: 24, bottom: 42 };
  const systemValues = chartRows.map((row) => {
    const value = Number(row.days_for_sale);
    return Number.isFinite(value) ? value : null;
  });
  const salesValues = chartRows.map((row) => {
    const value = Number(row.estimate_days_for_sales);
    return Number.isFinite(value) ? value : null;
  });
  const allValues = [...systemValues, ...salesValues].filter((value) => value != null);
  const maxY = Math.max(30, Math.min(120, Math.ceil((Math.max(...allValues, SAFE_MAX_DAYS) + 5) / 10) * 10));
  const xOf = (index) => padding.left + (index * (width - padding.left - padding.right)) / Math.max(1, chartRows.length - 1);
  const yOf = (value) => padding.top + ((maxY - value) * (height - padding.top - padding.bottom)) / maxY;
  const systemPath = makeLinePath(systemValues, xOf, yOf);
  const salesPath = makeLinePath(salesValues, xOf, yOf);
  const shipmentByDate = shipments.reduce((result, row) => {
    const key = dateText(row.add_date);
    if (!key) return result;
    result[key] = (result[key] || 0) + numberValue(row.number);
    return result;
  }, {});
  const hovered = hoverIndex == null ? null : chartRows[hoverIndex];

  const svgChildren = [];
  [0, SAFE_MIN_DAYS, SAFE_MAX_DAYS, maxY].forEach((value) => {
    const y = yOf(value);
    svgChildren.push(React.createElement('line', {
      key: `grid_${value}`,
      x1: padding.left,
      x2: width - padding.right,
      y1: y,
      y2: y,
      stroke: value === SAFE_MIN_DAYS ? '#f59e0b' : value === SAFE_MAX_DAYS ? '#22c55e' : '#e8eef6',
      strokeDasharray: value === SAFE_MIN_DAYS || value === SAFE_MAX_DAYS ? '6 5' : undefined,
      strokeWidth: value === SAFE_MIN_DAYS || value === SAFE_MAX_DAYS ? 1.5 : 1,
    }));
    svgChildren.push(React.createElement('text', {
      key: `label_${value}`,
      x: padding.left - 10,
      y: y + 4,
      textAnchor: 'end',
      fill: '#7b8798',
      fontSize: 11,
    }, String(value)));
  });

  svgChildren.push(React.createElement('path', {
    key: 'system_path',
    d: systemPath,
    fill: 'none',
    stroke: '#4568dc',
    strokeWidth: 2.5,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
  }));
  svgChildren.push(React.createElement('path', {
    key: 'sales_path',
    d: salesPath,
    fill: 'none',
    stroke: '#eb5a92',
    strokeWidth: 2.5,
    strokeLinejoin: 'round',
    strokeLinecap: 'round',
  }));

  chartRows.forEach((row, index) => {
    const addQty = shipmentByDate[dateText(row.date)];
    if (addQty != null) {
      svgChildren.push(React.createElement('line', {
        key: `shipment_line_${index}`,
        x1: xOf(index),
        x2: xOf(index),
        y1: padding.top,
        y2: height - padding.bottom,
        stroke: '#d99a22',
        strokeDasharray: '3 4',
        strokeWidth: 1,
        opacity: 0.75,
      }));
      svgChildren.push(React.createElement('circle', {
        key: `shipment_dot_${index}`,
        cx: xOf(index),
        cy: padding.top + 5,
        r: 4,
        fill: '#d99a22',
      }));
    }
    const systemValue = systemValues[index];
    if (systemValue != null) {
      svgChildren.push(React.createElement('circle', {
        key: `hover_${index}`,
        cx: xOf(index),
        cy: yOf(systemValue),
        r: hoverIndex === index ? 5 : 8,
        fill: hoverIndex === index ? '#4568dc' : 'transparent',
        opacity: hoverIndex === index ? 1 : 0.01,
        onMouseEnter: () => setHoverIndex(index),
        onMouseLeave: () => setHoverIndex(null),
      }));
    }
  });

  const tickStep = Math.max(1, Math.ceil(chartRows.length / 10));
  chartRows.forEach((row, index) => {
    if (index % tickStep !== 0 && index !== chartRows.length - 1) return;
    svgChildren.push(React.createElement('text', {
      key: `x_${index}`,
      x: xOf(index),
      y: height - 17,
      textAnchor: 'middle',
      fill: '#7b8798',
      fontSize: 10,
    }, dateText(row.date).slice(5)));
  });

  return React.createElement('div', null,
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' },
    },
      React.createElement('div', null,
        React.createElement(Typography.Title, { level: 5, style: { margin: 0, color: '#172033' } }, '未来安全库存趋势'),
        React.createElement(Typography.Text, { type: 'secondary' }, `安全区间固定 ${SAFE_MIN_DAYS}–${SAFE_MAX_DAYS} 天，入库节点来自 simulate_shipment`),
      ),
      React.createElement(Space, { size: 12, wrap: true },
        React.createElement(Tag, { color: 'geekblue' }, '系统安全天数'),
        React.createElement(Tag, { color: 'magenta' }, '销售安全天数'),
        React.createElement(Tag, { color: 'gold' }, '计划入库节点'),
      ),
    ),
    React.createElement('div', { style: { overflowX: 'auto', border: '1px solid #e9eef6', borderRadius: 12, background: '#ffffff' } },
      React.createElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        preserveAspectRatio: 'none',
        style: { display: 'block', width: '100%', minWidth: 760, height: 300 },
      }, svgChildren),
    ),
    hovered
      ? React.createElement(Card, {
        size: 'small',
        style: { marginTop: 10, borderRadius: 10, background: '#f8fbff' },
        styles: { body: { padding: '10px 14px' } },
      }, React.createElement(Space, { size: 18, wrap: true },
        React.createElement(Typography.Text, { strong: true }, dateText(hovered.date)),
        React.createElement(Typography.Text, null, `系统 ${formatNumber(hovered.days_for_sale)} 天`),
        React.createElement(Typography.Text, null, `销售 ${formatNumber(hovered.estimate_days_for_sales)} 天`),
        React.createElement(Typography.Text, null, `库存 ${formatNumber(hovered.inventory)}`),
        React.createElement(Typography.Text, null, `预估销量 ${formatNumber(hovered.sale_maybe_sales ?? hovered.maybe_sales, 1)}`),
        shipmentByDate[dateText(hovered.date)] != null
          ? React.createElement(Tag, { color: 'gold' }, `计划入库 ${formatNumber(shipmentByDate[dateText(hovered.date)])}`)
          : null,
      ))
      : null,
  );
}

function ShipmentEvolutionBlock() {
  const [params, setParams] = useState(readParamsSync);
  const [shops, setShops] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('全部');
  const [refreshSeed, setRefreshSeed] = useState(0);

  useEffect(() => {
    let active = true;
    resolveParams().then((next) => {
      if (!active) return;
      setParams({ ...next, shop: next.shop || TOTAL_SHOP });
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const routers = [ctx.router, ctx.app?.router?.router].filter(Boolean);
    const unsubscribers = routers
      .filter((router) => typeof router.subscribe === 'function')
      .map((router) => router.subscribe(() => {
        const next = readParamsSync();
        setParams((current) => ({
          asin: next.asin || current.asin,
          country: next.country || current.country,
          shop: next.shop || current.shop || TOTAL_SHOP,
        }));
      }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, []);

  const loadData = useCallback(async () => {
    if (!params.asin || !params.country) {
      setDailyRows([]);
      setShipments([]);
      setShops([]);
      setError('缺少页面参数 asin 或 country，无法加载发货计划。');
      setLoading(false);
      return;
    }
    const activeParams = { ...params, shop: params.shop || TOTAL_SHOP };
    setLoading(true);
    setError('');
    try {
      const [shopList, dailyData, shipmentData] = await Promise.all([
        requestShops(activeParams.asin, activeParams.country),
        requestDailySales(activeParams),
        requestShipments(activeParams),
      ]);
      const shipmentShops = shipmentData.map((row) => row.shop).filter(Boolean);
      const mergedShops = Array.from(new Set([...shopList, ...shipmentShops])).filter((shop) => shop !== TOTAL_SHOP);
      setShops(mergedShops);
      setDailyRows(dailyData);
      setShipments(shipmentData);
    } catch (requestError) {
      setDailyRows([]);
      setShipments([]);
      setError(requestError?.message || String(requestError));
    } finally {
      setLoading(false);
    }
  }, [params.asin, params.country, params.shop, refreshSeed]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredShipments = useMemo(() => {
    if (sourceFilter === '新算法') return shipments.filter((row) => row.plan_source === PLAN_SOURCE);
    if (sourceFilter === '原有计划') return shipments.filter((row) => row.plan_source !== PLAN_SOURCE);
    return shipments;
  }, [shipments, sourceFilter]);

  const currentRow = useMemo(() => {
    const today = todayText();
    return dailyRows.find((row) => dateText(row.date) === today)
      || dailyRows.filter((row) => dateText(row.date) <= today).slice(-1)[0]
      || dailyRows[0]
      || null;
  }, [dailyRows]);

  const weeks = useMemo(() => buildWeeks(filteredShipments), [filteredShipments]);
  const latestAddDate = useMemo(() => {
    const dates = shipments.map((row) => dateText(row.add_date)).filter(Boolean).sort();
    return dates[dates.length - 1] || '';
  }, [shipments]);
  const newAlgorithmTotal = useMemo(
    () => shipments.filter((row) => row.plan_source === PLAN_SOURCE).reduce((sum, row) => sum + numberValue(row.number), 0),
    [shipments],
  );
  const sevenWeekTotal = useMemo(() => weeks.reduce((sum, week) => sum + week.quantity, 0), [weeks]);

  const detailColumns = [
    { title: '发货日期', dataIndex: 'date', width: 112, render: (value) => dateText(value) || '-' },
    { title: '预计入库', dataIndex: 'add_date', width: 112, render: (value) => dateText(value) || '-' },
    { title: '店铺', dataIndex: 'shop', width: 120, ellipsis: true },
    { title: '物流渠道', dataIndex: 'channel', width: 190, ellipsis: true },
    { title: '发货量', dataIndex: 'number', width: 95, align: 'right', render: (value) => React.createElement(Typography.Text, { strong: true }, formatNumber(value)) },
    { title: '淡旺季', dataIndex: 'season', width: 88, render: (value) => React.createElement(Tag, { color: value === '旺季' ? 'red' : 'green' }, value || '-') },
    {
      title: '来源',
      dataIndex: 'plan_source',
      width: 110,
      render: (value) => React.createElement(Tag, { color: sourceColor(value) }, sourceLabel(value)),
    },
  ];

  function changeShop(shop) {
    setSourceFilter('全部');
    setParams((current) => ({ ...current, shop }));
    replaceShopParam(shop);
  }

  const pageStyle = {
    padding: 18,
    border: '1px solid #e6edf6',
    borderRadius: 16,
    background: 'linear-gradient(180deg,#f8fbff 0%,#ffffff 170px)',
    color: '#172033',
    boxShadow: '0 8px 30px rgba(15,23,42,0.055)',
  };

  return React.createElement('div', { style: pageStyle },
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
    },
      React.createElement('div', null,
        React.createElement(Space, { size: 9, wrap: true },
          React.createElement(Typography.Title, { level: 3, style: { margin: 0, color: '#14213d' } }, '发货计划演变'),
          React.createElement(Tag, { color: 'blue' }, 'v2 实时数据'),
          shipments.some((row) => row.plan_source === PLAN_SOURCE)
            ? React.createElement(Tag, { color: 'cyan' }, '已接入新算法')
            : React.createElement(Tag, null, '等待新算法数据'),
        ),
        React.createElement(Typography.Text, { type: 'secondary' },
          `${params.asin || '-'} · ${params.country || '-'} · ${params.shop || TOTAL_SHOP}`,
        ),
      ),
      React.createElement(Button, {
        icon: React.createElement(ReloadOutlined || 'span'),
        onClick: () => setRefreshSeed((value) => value + 1),
        loading,
      }, '刷新数据'),
    ),

    React.createElement(Card, {
      size: 'small',
      style: { marginBottom: 14, borderRadius: 12, borderColor: '#b9d4fb', background: '#eef6ff' },
      styles: { body: { padding: '11px 12px' } },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
        React.createElement(Space, { size: 6 },
          React.createElement(ShopOutlined || 'span', { style: { color: '#2563eb' } }),
          React.createElement(Typography.Text, { strong: true }, '店铺选择'),
        ),
        [TOTAL_SHOP, ...shops].map((shop) => React.createElement(Button, {
          key: shop,
          size: 'small',
          type: (params.shop || TOTAL_SHOP) === shop ? 'primary' : 'default',
          onClick: () => changeShop(shop),
          style: { borderRadius: 999, fontWeight: 700 },
        }, shop)),
      ),
    ),

    error
      ? React.createElement(Alert, {
        type: 'error',
        showIcon: true,
        message: '发货计划数据加载失败',
        description: error,
        style: { marginBottom: 14 },
      })
      : null,

    loading
      ? React.createElement('div', { style: { minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
        React.createElement(Spin, { size: 'large', tip: '正在读取 daily_sales 与 simulate_shipment...' }),
      )
      : React.createElement(React.Fragment, null,
        React.createElement(Row, { gutter: [12, 12], style: { marginBottom: 14 } },
          React.createElement(Col, { xs: 24, sm: 12, xl: 6 }, React.createElement(MetricCard, {
            title: '当前库存',
            value: formatNumber(currentRow?.inventory),
            suffix: '台',
            icon: React.createElement(DatabaseOutlined || 'span'),
            tone: '#cbdcf5',
          })),
          React.createElement(Col, { xs: 24, sm: 12, xl: 6 }, React.createElement(MetricCard, {
            title: '当前安全天数',
            value: formatNumber(currentRow?.days_for_sale),
            suffix: '天',
            icon: React.createElement(ThunderboltOutlined || 'span'),
            tone: '#f3d2df',
          })),
          React.createElement(Col, { xs: 24, sm: 12, xl: 6 }, React.createElement(MetricCard, {
            title: '未来 7 周计划',
            value: formatNumber(sevenWeekTotal),
            suffix: '台',
            icon: React.createElement(CalendarOutlined || 'span'),
            tone: '#cde9da',
          })),
          React.createElement(Col, { xs: 24, sm: 12, xl: 6 }, React.createElement(MetricCard, {
            title: '新算法记录合计',
            value: formatNumber(newAlgorithmTotal),
            suffix: '台',
            icon: React.createElement(ThunderboltOutlined || 'span'),
            tone: '#c9defc',
          })),
        ),

        React.createElement(Card, {
          title: React.createElement(Space, { size: 8 },
            React.createElement(CalendarOutlined || 'span', { style: { color: '#2563eb' } }),
            React.createElement('span', null, '逐周发货计划'),
            latestAddDate ? React.createElement(Tag, { color: 'gold' }, `所选范围最晚入库 ${latestAddDate}`) : null,
          ),
          extra: React.createElement(Segmented, {
            size: 'small',
            value: sourceFilter,
            options: ['全部', '新算法', '原有计划'],
            onChange: setSourceFilter,
          }),
          style: { marginBottom: 14, borderRadius: 12 },
          styles: { body: { padding: 0 } },
        }, React.createElement(WeeklyMatrix, { params, currentRow, weeks })),

        React.createElement(Alert, {
          type: 'warning',
          showIcon: true,
          message: '需下单净额暂不使用在途数据替代',
          description: '字段词典规定：净下单量 = W6 + W7 发货计划 − 工厂未交货订单余量。当前 expected_inventory 是在途口径，不是工厂未交货订单，因此本面板只展示下单批计划量，待接入 AOK 未交货订单数据源后再显示净额。',
          style: { marginBottom: 14, borderRadius: 12 },
        }),

        React.createElement(Card, {
          style: { marginBottom: 14, borderRadius: 12 },
        }, React.createElement(SafetyChart, { dailyRows, shipments: filteredShipments })),

        React.createElement(Card, {
          title: React.createElement(Space, { size: 8 },
            React.createElement(DatabaseOutlined || 'span', { style: { color: '#2563eb' } }),
            React.createElement('span', null, '发货计划明细'),
            React.createElement(Tag, null, `${filteredShipments.length} 条`),
          ),
          style: { borderRadius: 12 },
          styles: { body: { padding: 0 } },
        }, filteredShipments.length
          ? React.createElement(Table, {
            rowKey: 'id',
            size: 'small',
            pagination: { pageSize: 10, showSizeChanger: false },
            columns: detailColumns,
            dataSource: filteredShipments.slice().sort((a, b) => String(a.date || '').localeCompare(String(b.date || ''))),
            scroll: { x: 930 },
          })
          : React.createElement(Empty, { description: '当前筛选范围没有发货计划', style: { padding: 34 } })),
      ),
  );
}

ctx.render(React.createElement(ShipmentEvolutionBlock));
