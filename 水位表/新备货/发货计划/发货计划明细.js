const React = ctx.libs.React;
const { useEffect, useMemo, useState } = React;
const { Alert, Empty, Select, Spin, Table, Tag, Typography } = ctx.libs.antd;
const h = React.createElement;

const PLAN_SOURCE = 'shipment_plan_v2';
const TOTAL_SHOP = '合计';
const ELIGIBLE_STATUSES = ['普通', '新品', '重点'];
const SUPERVISOR_ROLE_KEY = 'r_7ih2kbf7t1g';
const LOGISTICS_DEPARTMENT = '物流仓储部';
const EFFICIENCY_DEPARTMENT = '效率部';

function apiRequest(options) {
  if (typeof ctx.request === 'function') return ctx.request(options);
  return ctx.api.request(options);
}

function pickRows(response) {
  const payload = response?.data;
  if (Array.isArray(payload?.data)) return payload.data;
  return Array.isArray(payload) ? payload : [];
}

async function safeGetVar(path) {
  try {
    return typeof ctx.getVar === 'function' ? await ctx.getVar(path) : null;
  } catch (error) {
    return null;
  }
}

function tokens(value) {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.flatMap((item) => {
    if (item == null) return [];
    if (typeof item !== 'object') return [String(item).trim()];
    return [item.key, item.name, item.title, item.roleName, item.department, item.label]
      .filter(Boolean)
      .map((token) => String(token).trim());
  }).filter(Boolean);
}

async function resolveCurrentUser() {
  const contextUser = await safeGetVar('ctx.user') || ctx.user || ctx.auth?.user || {};
  const userId = await safeGetVar('ctx.user.id') || contextUser.id;
  if (!userId) return contextUser;
  try {
    const response = await apiRequest({
      url: 'users:get',
      method: 'get',
      params: {
        filterByTk: userId,
        appends: 'roles',
        fields: 'id,username,department,roles',
      },
    });
    const payload = response?.data?.data ?? response?.data;
    const user = Array.isArray(payload) ? payload[0] : payload;
    return user && typeof user === 'object' ? { ...contextUser, ...user } : contextUser;
  } catch (error) {
    return contextUser;
  }
}

async function requestVisibleProducts() {
  const user = await resolveCurrentUser();
  const username = String(user.username || await safeGetVar('ctx.user.username') || '').trim();
  const roleTokens = Array.from(new Set([
    ...tokens(user.roles || user.role),
    ...tokens(await safeGetVar('ctx.user.roles')),
  ]));
  const departmentTokens = Array.from(new Set([
    ...tokens(user.department || user.departments),
    ...tokens(await safeGetVar('ctx.user.department')),
  ]));
  const isAdmin = roleTokens.some((token) => (
    ['admin', 'root', 'super-admin', 'administrator', '系统管理员', '管理员']
      .includes(token.toLowerCase())
  )) || departmentTokens.includes(EFFICIENCY_DEPARTMENT);
  const isSupervisor = !isAdmin && roleTokens.includes(SUPERVISOR_ROLE_KEY);
  const isLogistics = !isAdmin && !isSupervisor && departmentTokens.includes(LOGISTICS_DEPARTMENT);
  const isSales = !isAdmin && !isSupervisor && !isLogistics
    && roleTokens.some((token) => token.toLowerCase() === 'member')
    && departmentTokens.some((token) => token.startsWith('销售'));

  if (!isAdmin && !isSupervisor && !isLogistics && !isSales) return [];
  const filters = [{ status: { $in: ELIGIBLE_STATUSES } }];
  if (isSupervisor) {
    const managedResponse = await apiRequest({
      url: 'users:list',
      method: 'get',
      params: {
        page: 1,
        pageSize: 1000,
        fields: 'username,department_manager',
        filter: JSON.stringify({ department_manager: { $eq: username } }),
      },
    });
    const managedSales = pickRows(managedResponse).map((row) => row.username).filter(Boolean);
    if (!managedSales.length) return [];
    filters.push({ sale_owner: { $in: managedSales } });
  } else if (!isAdmin && !isLogistics) {
    filters.push({ sale_owner: { $eq: username } });
  }

  const response = await apiRequest({
    url: 'asin:list',
    method: 'get',
    params: {
      page: 1,
      pageSize: 1000,
      fields: 'asin,country,status,maintenance_level',
      filter: JSON.stringify({ $and: filters }),
    },
  });
  return pickRows(response).filter((row) => (
    row.asin
    && row.country
    && ELIGIBLE_STATUSES.includes(row.status)
    && row.maintenance_level !== '变体'
  ));
}

function batches(items, size = 12) {
  const result = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function productScopeFilter(products) {
  return {
    $or: products.map((product) => ({
      $and: [
        { asin: { $eq: product.asin } },
        { country: { $eq: product.country } },
      ],
    })),
  };
}

async function requestShipmentPlans(products) {
  if (!products.length) return [];
  const responses = await Promise.all(batches(products).map((batch) => apiRequest({
    url: 'simulate_shipment:list',
    method: 'get',
    params: {
      page: 1,
      pageSize: 10000,
      sort: 'date,country,channel',
      fields: [
        'id',
        'asin',
        'country',
        'shop',
        'channel',
        'number',
        'date',
        'add_date',
        'plan_source',
        'v2_calculation_snapshot',
      ].join(','),
      filter: JSON.stringify({
        $and: [
          productScopeFilter(batch),
          { shop: { $eq: TOTAL_SHOP } },
          { plan_source: { $eq: PLAN_SOURCE } },
          { number: { $gt: 0 } },
        ],
      }),
    },
  })));
  return responses.flatMap(pickRows);
}

function parseDate(value) {
  const text = String(value || '').slice(0, 10);
  const match = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = value instanceof Date ? value : parseDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(value, days) {
  const source = value instanceof Date ? value : parseDate(value);
  if (!source) return null;
  const result = new Date(source);
  result.setDate(result.getDate() + days);
  return result;
}

function shippingWeek(value) {
  const date = parseDate(value);
  if (!date) return '—';
  const day = date.getDay();
  const monday = addDays(date, day === 0 ? -6 : 1 - day);
  return `${formatDate(monday)}—${formatDate(addDays(monday, 4))}`;
}

function parseSnapshot(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function finiteNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function balancedTicketQuantities(boxes, tickets, unitsPerBox) {
  if (!(boxes > 0) || !(tickets > 0) || !(unitsPerBox > 0)) return null;
  const baseBoxes = Math.floor(boxes / tickets);
  const remainder = boxes % tickets;
  return Array.from({ length: tickets }, (_, index) => (
    (baseBoxes + (index < remainder ? 1 : 0)) * unitsPerBox
  ));
}

function rangeText(values) {
  const dates = Array.from(new Set(values.filter(Boolean))).sort();
  if (!dates.length) return '—';
  return dates.length === 1 ? dates[0] : `${dates[0]}—${dates[dates.length - 1]}`;
}

function coverageRange(snapshot, addDate) {
  const recalculation = snapshot?.recalculation || {};
  const start = snapshot?.second_service_start_date
    || recalculation.service_start_date
    || snapshot?.service_start_date;
  const end = snapshot?.second_service_end_date
    || recalculation.service_end_date
    || snapshot?.service_end_date;
  if (start && end) return { start: String(start).slice(0, 10), end: String(end).slice(0, 10) };
  const parsedAddDate = parseDate(addDate);
  return parsedAddDate
    ? { start: formatDate(addDays(parsedAddDate, 7)), end: formatDate(addDays(parsedAddDate, 13)) }
    : null;
}

function aggregatePlans(plans) {
  const groups = new Map();
  plans.forEach((plan) => {
    const country = String(plan.country || '').trim() || '—';
    const date = String(plan.date || '').slice(0, 10);
    const channel = String(plan.channel || '').trim() || '—';
    const key = `${country}|${date}|${channel}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        country,
        date,
        channel,
        quantity: 0,
        boxes: 0,
        boxesComplete: true,
        ticketCount: 0,
        ticketParts: [],
        ticketsComplete: true,
        addDates: [],
        coverageStarts: [],
        coverageEnds: [],
      });
    }
    const group = groups.get(key);
    group.quantity += finiteNumber(plan.number) || 0;
    if (plan.add_date) group.addDates.push(String(plan.add_date).slice(0, 10));

    const snapshot = parseSnapshot(plan.v2_calculation_snapshot);
    const constraint = snapshot?.constraint_layer || {};
    const boxCount = finiteNumber(constraint.boxes);
    const ticketCount = finiteNumber(constraint.tickets);
    const unitsPerBox = finiteNumber(constraint.units_per_box);
    if (boxCount == null) group.boxesComplete = false;
    else group.boxes += boxCount;

    const parts = balancedTicketQuantities(boxCount, ticketCount, unitsPerBox);
    if (!parts) group.ticketsComplete = false;
    else {
      group.ticketCount += ticketCount;
      group.ticketParts.push(...parts);
    }

    const coverage = coverageRange(snapshot, plan.add_date);
    if (coverage) {
      group.coverageStarts.push(coverage.start);
      group.coverageEnds.push(coverage.end);
    }
  });

  const rows = Array.from(groups.values()).sort((a, b) => (
    a.date.localeCompare(b.date)
    || a.country.localeCompare(b.country)
    || a.channel.localeCompare(b.channel, 'zh-CN')
  ));
  const siteDates = new Map();
  rows.forEach((row) => {
    if (!siteDates.has(row.country)) siteDates.set(row.country, []);
    const dates = siteDates.get(row.country);
    if (!dates.includes(row.date)) dates.push(row.date);
  });
  return rows.map((row) => {
    const waveIndex = siteDates.get(row.country).indexOf(row.date) + 1;
    return {
      ...row,
      wave: `${row.country}-W${String(waveIndex).padStart(2, '0')}`,
      week: shippingWeek(row.date),
      addDateText: rangeText(row.addDates),
      coverageText: row.coverageStarts.length
        ? `${row.coverageStarts.slice().sort()[0]}—${row.coverageEnds.slice().sort().at(-1)}`
        : '—',
    };
  });
}

function headerCell() {
  return {
    style: {
      background: '#f3f5f7',
      color: '#3d4652',
      fontWeight: 600,
      fontSize: 12,
      textAlign: 'center',
      padding: '11px 10px',
      whiteSpace: 'normal',
      lineHeight: 1.35,
      borderColor: '#e8ebef',
    },
  };
}

function bodyCell(record, index, hoveredRowKey, reviewBoundary) {
  let background = index % 2 === 0 ? '#ffffff' : '#fafbfc';
  if (record.date > reviewBoundary) background = '#fffbf1';
  if (record.key === hoveredRowKey) background = '#f0f6f3';
  return {
    style: {
      background,
      borderColor: '#edf0f2',
      padding: '9px 10px',
      transitionProperty: 'background-color',
      transitionDuration: '150ms',
      transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    },
  };
}

function selectOptions(values) {
  const counts = new Map();
  values.filter(Boolean).forEach((value) => {
    const text = String(value).trim();
    if (text) counts.set(text, (counts.get(text) || 0) + 1);
  });
  return Array.from(counts.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([value, count]) => ({ value, label: `${value}  (${count})` }));
}

function ShipmentPlanDetailBlock() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCountries, setSelectedCountries] = useState([]);
  const [selectedAsins, setSelectedAsins] = useState([]);
  const [hoveredRowKey, setHoveredRowKey] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    requestVisibleProducts()
      .then((products) => requestShipmentPlans(products))
      .then((rows) => {
        if (active) setPlans(rows);
      })
      .catch((requestError) => {
        if (active) setError(requestError?.message || String(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const countryOptions = useMemo(() => selectOptions(plans.map((plan) => plan.country)), [plans]);
  const asinOptions = useMemo(() => selectOptions(plans.map((plan) => plan.asin)), [plans]);
  const filteredPlans = useMemo(() => plans.filter((plan) => (
    (!selectedCountries.length || selectedCountries.includes(plan.country))
    && (!selectedAsins.length || selectedAsins.includes(plan.asin))
  )), [plans, selectedAsins, selectedCountries]);
  const rows = useMemo(() => aggregatePlans(filteredPlans), [filteredPlans]);
  const reviewBoundary = formatDate(addDays(new Date(), 14));
  const columns = useMemo(() => [
    {
      title: '计划发货周',
      dataIndex: 'week',
      width: 190,
      render: (value) => h('span', { style: { whiteSpace: 'nowrap', color: '#3b4149' } }, value),
    },
    {
      title: '渠道实际发运日',
      dataIndex: 'date',
      width: 132,
      render: (value) => h('span', { style: { whiteSpace: 'nowrap', color: '#252b33', fontWeight: 600 } }, value || '—'),
    },
    {
      title: '波次',
      dataIndex: 'wave',
      width: 88,
      render: (value) => h('span', { style: { whiteSpace: 'nowrap', color: '#2f5d50', fontWeight: 600 } }, value),
    },
    {
      title: '站点',
      dataIndex: 'country',
      width: 64,
      render: (value) => h('span', { style: { color: '#4d5662', fontWeight: 500 } }, value),
    },
    {
      title: '渠道',
      dataIndex: 'channel',
      width: 158,
      render: (value) => h('span', { style: { color: '#1f2329' } }, value),
    },
    {
      title: '发货量',
      dataIndex: 'quantity',
      width: 86,
      render: (value) => h('b', { style: { fontVariantNumeric: 'tabular-nums' } }, Math.round(value).toLocaleString()),
    },
    {
      title: '箱数',
      dataIndex: 'boxes',
      width: 72,
      render: (_, row) => row.boxesComplete
        ? h('b', { style: { fontVariantNumeric: 'tabular-nums' } }, Math.round(row.boxes).toLocaleString())
        : h('span', { style: { color: '#8a9099' } }, '—'),
    },
    {
      title: h('span', null, '分票数量', h('small', {
        style: { display: 'block', marginTop: 2, color: '#8b744d', fontSize: 9.5, fontWeight: 500 },
      }, '单票不超过50箱')),
      dataIndex: 'ticketCount',
      width: 220,
      render: (_, row) => row.ticketsComplete
        ? h('div', { style: { lineHeight: 1.45 } },
          h('b', { style: { display: 'block', color: '#1f2329', fontVariantNumeric: 'tabular-nums' } },
            `${row.ticketCount}票：${row.ticketParts.map((value) => Math.round(value)).join(' + ')}`),
          h('span', { style: { color: '#718096', fontSize: 10 } }, '按各计划快照中的箱入数均衡拆票'))
        : h('span', { style: { color: '#8a9099' } }, '—'),
    },
    {
      title: '预计可售日',
      dataIndex: 'addDateText',
      width: 150,
      render: (value) => h('span', { style: { whiteSpace: 'nowrap', color: '#252b33', fontWeight: 600 } }, value),
    },
    {
      title: '覆盖销售日期',
      dataIndex: 'coverageText',
      width: 190,
      render: (value) => h('span', { style: { whiteSpace: 'nowrap' } }, value),
    },
  ].map((column) => ({
    ...column,
    align: 'center',
    onHeaderCell: headerCell,
    onCell: (record, index) => bodyCell(record, index, hoveredRowKey, reviewBoundary),
  })), [hoveredRowKey, reviewBoundary]);

  return h('div', {
    style: {
      width: '100%',
      minWidth: 0,
      padding: 12,
      boxSizing: 'border-box',
      background: '#f6f7f8',
      color: '#1f2329',
      fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif',
      fontVariantNumeric: 'tabular-nums',
      WebkitFontSmoothing: 'antialiased',
    },
  },
  h('section', {
    style: {
      overflow: 'hidden',
      borderRadius: 6,
      background: '#fff',
      boxShadow: '0 1px 2px rgba(16,24,40,.05), 0 4px 14px rgba(16,24,40,.045)',
    },
  },
  h('header', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      minHeight: 56,
      padding: '10px 14px',
      boxSizing: 'border-box',
      background: '#ffffff',
      borderBottom: '1px solid #eceff2',
      flexWrap: 'wrap',
    },
  },
  h('span', { style: { width: 4, height: 28, borderRadius: 2, background: '#d4a64f', flex: '0 0 auto' } }),
  h('div', { style: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 220 } },
    h(Typography.Text, { strong: true, style: { color: '#252b33', fontSize: 14, lineHeight: 1.35 } }, '全部站点物流发货明细'),
    h(Typography.Text, { style: { color: '#7b8490', fontSize: 11.5, lineHeight: 1.35 } }, '按实际发运日排序 · 新品衔接及正常补货计划')),
  h('div', { style: { display: 'flex', gap: 7, marginLeft: 'auto', flexWrap: 'wrap' } },
    h(Tag, { style: { margin: 0, background: '#fff', borderColor: '#e4e7eb', color: '#66707c', fontSize: 10 } },
      h('span', { style: { display: 'inline-block', width: 8, height: 8, marginRight: 5, borderRadius: 2, background: '#ffffff', boxShadow: 'inset 0 0 0 1px #d9dde2' } }),
      '14天复核前'),
    h(Tag, { style: { margin: 0, background: '#fff', borderColor: '#e4e7eb', color: '#7b6438', fontSize: 10 } },
      h('span', { style: { display: 'inline-block', width: 8, height: 8, marginRight: 5, borderRadius: 2, background: '#ffefc7' } }),
      '14天复核后'),
    h(Tag, { bordered: false, style: { margin: 0, background: '#f3f6f5', color: '#426457', fontSize: 10 } }, '单票≤50箱'))),
  h('div', {
    style: {
      display: 'flex',
      alignItems: 'flex-end',
      gap: 12,
      padding: '11px 14px',
      background: '#fafbfc',
      borderBottom: '1px solid #eceff2',
      flexWrap: 'wrap',
    },
  },
  h('label', { style: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 220, flex: '0 1 260px' } },
    h(Typography.Text, { style: { color: '#606975', fontSize: 11, fontWeight: 600 } }, '国家'),
    h(Select, {
      mode: 'multiple',
      allowClear: true,
      showSearch: true,
      size: 'large',
      value: selectedCountries,
      options: countryOptions,
      placeholder: '全部国家',
      maxTagCount: 'responsive',
      optionFilterProp: 'label',
      onChange: setSelectedCountries,
      'aria-label': '按国家筛选',
      style: { width: '100%' },
    })),
  h('label', { style: { display: 'flex', flexDirection: 'column', gap: 5, minWidth: 260, flex: '0 1 340px' } },
    h(Typography.Text, { style: { color: '#606975', fontSize: 11, fontWeight: 600 } }, 'ASIN'),
    h(Select, {
      mode: 'multiple',
      allowClear: true,
      showSearch: true,
      size: 'large',
      value: selectedAsins,
      options: asinOptions,
      placeholder: '搜索或选择 ASIN',
      maxTagCount: 'responsive',
      optionFilterProp: 'label',
      onChange: setSelectedAsins,
      'aria-label': '按 ASIN 筛选',
      style: { width: '100%' },
    })),
  h(Typography.Text, {
    style: { marginLeft: 'auto', paddingBottom: 10, color: '#7a8490', fontSize: 11.5, whiteSpace: 'nowrap' },
  }, `${filteredPlans.length} 条计划 · ${rows.length} 个发货波次`)),
  error ? h(Alert, { type: 'error', showIcon: true, message: '发货计划明细读取失败', description: error, style: { margin: 12 } }) : null,
  loading
    ? h('div', { style: { minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h(Spin, { size: 'large', tip: '正在读取发货计划明细...' }))
    : rows.length
      ? h(Table, {
        rowKey: 'key',
        size: 'small',
        columns,
        dataSource: rows,
        tableLayout: 'fixed',
        scroll: { x: 1350 },
        pagination: rows.length > 50 ? {
          pageSize: 50,
          showSizeChanger: true,
          pageSizeOptions: [20, 50, 100],
          showTotal: (total) => `共 ${total} 个站点发货波次`,
          style: { margin: '12px 14px' },
        } : false,
        onRow: (row) => ({
          onMouseEnter: () => setHoveredRowKey(row.key),
          onMouseLeave: () => setHoveredRowKey(null),
        }),
      })
      : h('div', { style: { minHeight: 280, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h(Empty, {
        description: selectedCountries.length || selectedAsins.length
          ? '没有符合当前筛选条件的发货计划'
          : '当前可见范围内没有系统发货计划',
      }))));
}

ctx.render(h(ShipmentPlanDetailBlock));
