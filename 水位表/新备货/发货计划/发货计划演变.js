const React = ctx.libs.React;
const { useCallback, useEffect, useMemo, useRef, useState } = React;
const {
  Button,
  Checkbox,
  Drawer,
  Empty,
  Input,
  InputNumber,
  Modal,
  Segmented,
  Select,
  Spin,
  Switch,
  Tooltip,
  Typography,
} = ctx.libs.antd;
const icons = ctx.libs.antdIcons || {};
const {
  CalendarOutlined,
  DownOutlined,
  GlobalOutlined,
  LinkOutlined,
  ReloadOutlined,
  RightOutlined,
  ShopOutlined,
} = icons;
const h = React.createElement;

const TOTAL_SHOP = '合计';
const WATER_DETAIL_ROUTE = 'https://erp.aukshine.com/admin/20gdqvf4dzm/tab/tkgsjefv7hm';
const PLAN_SOURCE = 'shipment_plan_v2';
const WEEKLY_SNAPSHOT_SOURCE = 'shipment_plan_weekly_snapshot_v2';
const ENABLE_WEEKLY_SNAPSHOT_BASELINE = true;
const WORKFLOW_KEYS = Object.freeze({
  submit: 'a2fj1fzldts',
  review: '7d4cr4o7bmd',
});
const SUPERVISOR_ROLE_KEY = 'r_7ih2kbf7t1g';
const LOGISTICS_DEPARTMENT = '物流仓储部';
const EFFICIENCY_DEPARTMENT = '效率部';
const ORDER_WEEK_ANCHOR = '2026-07-06';
const SAFE_MIN_DAYS = 7;
const SAFE_MAX_DAYS = 14;
const ALL_SALES = '__ALL_SALES__';
const ELIGIBLE_STATUSES = ['普通', '新品', '重点'];

async function safeGetContextVar(name) {
  try {
    return typeof ctx.getVar === 'function' ? await ctx.getVar(name) : null;
  } catch (error) {
    return null;
  }
}

function userTokens(value) {
  const list = Array.isArray(value) ? value : value == null ? [] : [value];
  return list.flatMap((item) => {
    if (item == null) return [];
    if (typeof item !== 'object') return [String(item).trim()];
    return [item.key, item.name, item.title, item.roleName, item.department, item.label]
      .filter(Boolean).map((token) => String(token).trim());
  }).filter(Boolean);
}

function apiRequest(options) {
  if (typeof ctx.request === 'function') return ctx.request(options);
  return ctx.api.request(options);
}

async function resolveCurrentUser() {
  const contextUser = await safeGetContextVar('ctx.user') || ctx.user || ctx.auth?.user || {};
  const userId = await safeGetContextVar('ctx.user.id') || contextUser.id;
  if (!userId) return contextUser;
  try {
    const response = await apiRequest({
      url: 'users:get', method: 'get', params: {
        filterByTk: userId, appends: 'roles',
        fields: 'id,username,level,department,manager,roles',
      },
    });
    const payload = response?.data?.data ?? response?.data;
    const user = Array.isArray(payload) ? payload[0] : payload;
    return user && typeof user === 'object' ? { ...contextUser, ...user } : contextUser;
  } catch (error) {
    try {
      const response = await apiRequest({
        url: 'users:list', method: 'get', params: {
          page: 1, pageSize: 1, appends: 'roles', fields: 'id,username,level,department,manager,roles',
          filter: JSON.stringify({ id: { $eq: userId } }),
        },
      });
      const payload = response?.data?.data ?? response?.data;
      const user = Array.isArray(payload) ? payload[0] : null;
      return user ? { ...contextUser, ...user } : contextUser;
    } catch (fallbackError) {
      return contextUser;
    }
  }
}

const CURRENT_USER = await resolveCurrentUser();
const CURRENT_USERNAME = String(CURRENT_USER.username || await safeGetContextVar('ctx.user.username') || '').trim();
const CURRENT_ROLE_TOKENS = Array.from(new Set([
  ...userTokens(CURRENT_USER.roles || CURRENT_USER.role),
  ...userTokens(await safeGetContextVar('ctx.user.roles')),
]));
const CURRENT_DEPARTMENT_TOKENS = Array.from(new Set([
  ...userTokens(CURRENT_USER.department || CURRENT_USER.departments),
  ...userTokens(await safeGetContextVar('ctx.user.department')),
]));
const IS_ADMIN = CURRENT_ROLE_TOKENS.some((token) => (
  ['admin', 'root', 'super-admin', 'administrator', '系统管理员', '管理员'].includes(token.toLowerCase())
)) || CURRENT_DEPARTMENT_TOKENS.includes(EFFICIENCY_DEPARTMENT);
const IS_SUPERVISOR = !IS_ADMIN && CURRENT_ROLE_TOKENS.includes(SUPERVISOR_ROLE_KEY);
const IS_LOGISTICS = !IS_ADMIN && !IS_SUPERVISOR && CURRENT_DEPARTMENT_TOKENS.includes(LOGISTICS_DEPARTMENT);
const IS_SALES_USER = !IS_ADMIN && !IS_SUPERVISOR && !IS_LOGISTICS
  && CURRENT_ROLE_TOKENS.some((token) => token.toLowerCase() === 'member')
  && CURRENT_DEPARTMENT_TOKENS.some((token) => token.startsWith('销售'));
const AVAILABLE_ROLE_KEYS = IS_ADMIN
  ? ['sale', 'lead', 'ops', 'final']
  : IS_SUPERVISOR
    ? ['lead']
    : IS_LOGISTICS
      ? ['ops', 'final']
      : IS_SALES_USER
        ? ['sale']
        : [];
const DEFAULT_ROLE = AVAILABLE_ROLE_KEYS[0] || 'readonly';
const CAN_VIEW_COMPANY_PRODUCTS = IS_ADMIN || IS_LOGISTICS;
const CAN_SELECT_SALE = IS_ADMIN || IS_SUPERVISOR || IS_LOGISTICS;

const C = {
  ink: '#1f2329', muted: '#667085', line: '#dfe4eb', panel: '#ffffff', page: '#eef1f5',
  blue: '#3370ff', green: '#2ba471', orange: '#e8912a', purple: '#8b6cf0', red: '#e34d42', gold: '#b06a00',
};

function workflowConfigured(key) {
  return Boolean(key && !String(key).startsWith('__'));
}

async function triggerWorkflow(key, values) {
  if (!workflowConfigured(key)) {
    throw new Error('发货计划工作流尚未绑定，当前只能查看与模拟，不能提交真实变更。');
  }
  return apiRequest({
    url: 'workflows:trigger', method: 'post',
    params: { triggerWorkflows: key }, data: { values },
  });
}

function workflowRequestId(prefix = 'shipment-plan') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
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
    sale: query.sale || readDirectParam(direct, 'sale') || '',
    asin: query.asin || readDirectParam(direct, 'asin') || '',
    country: query.country || readDirectParam(direct, 'country') || '',
    shop: query.shop || readDirectParam(direct, 'shop') || TOTAL_SHOP,
  };
}

async function resolveParams() {
  const result = readParamsSync();
  if (typeof ctx.getVar === 'function') {
    result.sale = result.sale || await ctx.getVar('ctx.urlSearchParams.sale') || '';
    result.asin = result.asin || await ctx.getVar('ctx.urlSearchParams.asin') || '';
    result.country = result.country || await ctx.getVar('ctx.urlSearchParams.country') || '';
    result.shop = result.shop || await ctx.getVar('ctx.urlSearchParams.shop') || TOTAL_SHOP;
  }
  return result;
}

function replaceShopParam(shop, preserveProductScope = false) {
  const stable = readParamsSync();
  const next = { ...parseSearch(routerSearch()), sale: stable.sale, shop };
  if (!preserveProductScope) {
    delete next.asin;
    delete next.country;
  }
  const target = { pathname: routerPath(), search: buildSearch(next), hash: '' };
  [ctx.router, ctx.app?.router?.router].filter(Boolean).forEach((router) => {
    if (typeof router.navigate === 'function') router.navigate(target, { replace: true });
  });
}

function replaceSaleParams(sale, shop = TOTAL_SHOP) {
  const next = { ...parseSearch(routerSearch()), sale, shop };
  delete next.asin;
  delete next.country;
  const target = { pathname: routerPath(), search: buildSearch(next), hash: '' };
  [ctx.router, ctx.app?.router?.router].filter(Boolean).forEach((router) => {
    if (typeof router.navigate === 'function') router.navigate(target, { replace: true });
  });
}

function productKey(row) {
  return String(row?.unique || `${row?.asin || ''}_${row?.country || ''}`);
}

function pad2(value) { return String(value).padStart(2, '0'); }
function dateText(value) {
  if (!value) return '';
  return value instanceof Date ? formatDate(value) : String(value).slice(0, 10);
}
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
function addCalendarMonths(value, months) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + Number(months || 0));
  const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  date.setDate(Math.min(day, monthEnd));
  return date;
}
function todayText() { return formatDate(new Date()); }
function mondayOf(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  date.setHours(0, 0, 0, 0);
  const weekday = date.getDay();
  date.setDate(date.getDate() - (weekday === 0 ? 6 : weekday - 1));
  return date;
}
function isCurrentOrderWeek() {
  const anchor = mondayOf(ORDER_WEEK_ANCHOR);
  const current = mondayOf(new Date());
  if (!anchor || !current) return false;
  return Math.round((current - anchor) / 604800000) % 2 === 0;
}
function nextMonday(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : parseDate(value);
  if (!date) return null;
  const currentMonday = mondayOf(date);
  return currentMonday ? addDays(currentMonday, 7) : null;
}
function previousRunMondayText() {
  const current = mondayOf(new Date());
  return current ? formatDate(addDays(current, -7)) : '';
}
function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
function optionalNumber(value) {
  if (value == null || value === '') return NaN;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}
function v19CoverSeries(dateValues, inventories, demands, outputCount = dateValues.length) {
  const size = dateValues.length;
  const normalizedDemands = demands.map((value) => {
    const parsed = optionalNumber(value);
    return Number.isFinite(parsed) ? Math.max(0, parsed) : NaN;
  });
  const prefix = new Array(size + 1).fill(0);
  const nextMissing = new Array(size + 1).fill(size);
  let missingIndex = size;
  for (let index = size - 1; index >= 0; index -= 1) {
    if (!Number.isFinite(normalizedDemands[index])) missingIndex = index;
    nextMissing[index] = missingIndex;
  }
  normalizedDemands.forEach((value, index) => {
    prefix[index + 1] = prefix[index] + (Number.isFinite(value) ? value : 0);
  });
  const values = new Array(Math.min(outputCount, size)).fill(null);
  const lowerBounds = new Array(values.length).fill(false);
  values.forEach((_, start) => {
    const inventory = optionalNumber(inventories[start]);
    if (!Number.isFinite(inventory) || !Number.isFinite(normalizedDemands[start])) return;
    if (inventory <= 0) { values[start] = 0; return; }
    const lastAvailable = nextMissing[start] - 1;
    if (lastAvailable < start) return;
    let low = start; let high = lastAvailable; let depletedAt = -1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const consumed = prefix[middle + 1] - prefix[start];
      if (consumed > inventory) { depletedAt = middle; high = middle - 1; } else low = middle + 1;
    }
    if (depletedAt >= 0) {
      values[start] = Math.max(0, v19DaysBetween(dateValues[start], dateValues[depletedAt]));
      return;
    }
    values[start] = Math.max(0, v19DaysBetween(dateValues[start], dateValues[lastAvailable]) + 1);
    lowerBounds[start] = true;
  });
  return { values, lowerBounds };
}
function v19CoverText(value, lowerBound) {
  return Number.isFinite(value) ? `${lowerBound ? '≥' : ''}${fmt(value, 1)}` : '-';
}
function v19CoverDetail(dateValues, inventories, demands, start) {
  const inventory = optionalNumber(inventories[start]);
  const firstDemand = optionalNumber(demands[start]);
  if (!Number.isFinite(inventory) || !Number.isFinite(firstDemand)) return null;
  if (inventory <= 0) return { inventory, cumulativeDemand: 0, startDate: dateValues[start], endDate: dateValues[start], depleted: true };
  let cumulativeDemand = 0;
  let lastAvailable = start - 1;
  for (let index = start; index < dateValues.length; index += 1) {
    const demand = optionalNumber(demands[index]);
    if (!Number.isFinite(demand)) break;
    cumulativeDemand += Math.max(0, demand);
    lastAvailable = index;
    if (cumulativeDemand > inventory) {
      return { inventory, cumulativeDemand, startDate: dateValues[start], endDate: dateValues[index], depleted: true };
    }
  }
  return lastAvailable >= start
    ? { inventory, cumulativeDemand, startDate: dateValues[start], endDate: dateValues[lastAvailable], depleted: false }
    : null;
}
function fmt(value, digits = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return '-';
  return parsed.toLocaleString('zh-CN', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
function v19CoverDetailLines(detail, value, lowerBound, demandName) {
  if (!detail || !Number.isFinite(value)) return ['库存或销量预测数据不足，无法计算'];
  if (detail.inventory <= 0) return [`起始库存 ${fmt(detail.inventory, 2)} 台 ≤ 0`, '可撑天数 = 0 天'];
  const range = `${shortDate(detail.startDate)}～${shortDate(detail.endDate)}`;
  if (detail.depleted) return [
    `起始库存：${fmt(detail.inventory, 2)} 台`,
    `${range} 累计 ${demandName}：${fmt(detail.cumulativeDemand, 2)} 台，首次超过库存`,
    `可撑天数 = ${shortDate(detail.endDate)} − ${shortDate(detail.startDate)} = ${fmt(value, 1)} 天`,
  ];
  return [
    `起始库存：${fmt(detail.inventory, 2)} 台`,
    `${range} 累计 ${demandName}：${fmt(detail.cumulativeDemand, 2)} 台，库存尚未耗尽`,
    `预测范围内至少可撑 ${lowerBound ? '≥' : ''}${fmt(value, 1)} 天`,
  ];
}
function inRange(value, start, end) {
  const text = dateText(value);
  return Boolean(text && text >= formatDate(start) && text <= formatDate(end));
}

function productScopeFilter(products) {
  return { $or: products.map((product) => ({ $and: [
    { asin: { $eq: product.asin } },
    { country: { $eq: product.country } },
  ] })) };
}

function rowProductKey(row) {
  return `${row?.asin || ''}_${row?.country || ''}`;
}

function productBatches(products, size = 12) {
  const batches = [];
  for (let index = 0; index < products.length; index += size) batches.push(products.slice(index, index + size));
  return batches;
}

async function requestProductBatches(products, requester) {
  const responses = await Promise.all(productBatches(products).map(requester));
  return responses.flatMap(pickRows);
}

async function requestShops(products) {
  if (!products.length) return [];
  return requestProductBatches(products, (batch) => apiRequest({
    url: 'inventory_base:list', method: 'get', params: {
      page: 1, pageSize: 5000, fields: 'asin,country,shop',
      filter: JSON.stringify({ $and: [
        productScopeFilter(batch), { date: { $eq: todayText() } },
      ] }),
    },
  }));
}

async function requestEligibleProducts() {
  if (!IS_ADMIN && !IS_SUPERVISOR && !IS_LOGISTICS && !IS_SALES_USER) return [];
  const filters = [{ status: { $in: ELIGIBLE_STATUSES } }];
  if (IS_SUPERVISOR) {
    const managedResponse = await apiRequest({
      url: 'users:list', method: 'get', params: {
        page: 1, pageSize: 1000, fields: 'username,department_manager',
        filter: JSON.stringify({ department_manager: { $eq: CURRENT_USERNAME } }),
      },
    });
    const managedSales = pickRows(managedResponse).map((row) => row.username).filter(Boolean);
    if (!managedSales.length) return [];
    filters.push({ sale_owner: { $in: managedSales } });
  } else if (!CAN_VIEW_COMPANY_PRODUCTS) {
    filters.push({ sale_owner: { $eq: CURRENT_USERNAME } });
  }
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

async function requestDailySales(products, shop) {
  if (!products.length) return [];
  const start = formatDate(addDays(new Date(), -7));
  return requestProductBatches(products, (batch) => apiRequest({
    url: 'daily_sales:list', method: 'get', params: {
      page: 1, pageSize: 10000, sort: 'date',
      fields: [
        'asin', 'country', 'shop', 'model', 'date', 'type', 'weighted_sales', 'maybe_sales',
        'sale_maybe_sales', 'inventory', 'sale_inventory', 'days_for_sale', 'quantity_receive', 'add', 'on_the_way',
        'v2_add', 'v2_inventory', 'v2_days_for_sale', 'v2_sale_inventory', 'v2_on_the_way', 'v2_calculated_at',
      ].join(','),
      filter: JSON.stringify({ $and: [
        productScopeFilter(batch), { shop: { $eq: TOTAL_SHOP } },
        { date: { $dateNotBefore: start } },
      ] }),
    },
  }));
}

async function requestShipments(products, shop) {
  if (!products.length) return [];
  return requestProductBatches(products, (batch) => {
    const filters = [
      productScopeFilter(batch),
      { plan_source: { $eq: PLAN_SOURCE } },
      { shop: { $eq: TOTAL_SHOP } },
    ];
    return apiRequest({
    url: 'simulate_shipment:list', method: 'get', params: {
      page: 1, pageSize: 10000, sort: 'date',
      fields: [
        'id', 'asin', 'country', 'shop', 'shop_id', 'channel', 'msku', 'sid_msku', 'sku_1',
        'number', 'date', 'season', 'warehouse_days', 'add_date', 'arrival_date', 'shippment_id', 'plan_source', 'v2_calculation_snapshot',
        'v2_risk_grade', 'v2_risk_reason',
      ].join(','),
      filter: JSON.stringify({ $and: filters }),
    },
    });
  });
}

async function requestActualPlans(products) {
  if (!products.length) return [];
  const start = formatDate(nextMonday(new Date()));
  const rows = await requestProductBatches(products, (batch) => apiRequest({
    url: 'simulate_shipment:list', method: 'get', params: {
      page: 1, pageSize: 10000, sort: 'date',
      fields: [
        'id', 'asin', 'country', 'shop', 'shop_id', 'channel', 'msku', 'sid_msku', 'sku_1',
        'number', 'date', 'warehouse_days', 'add_date', 'arrival_date', 'plan_source',
      ].join(','),
      filter: JSON.stringify({ $and: [
        productScopeFilter(batch),
        { date: { $dateNotBefore: start } },
        { number: { $gt: 0 } },
      ] }),
    },
  }));
  return rows.filter((row) => row.plan_source !== PLAN_SOURCE && numberValue(row.number) > 0);
}

async function requestWeeklySnapshots(products) {
  if (!ENABLE_WEEKLY_SNAPSHOT_BASELINE) return [];
  if (!products.length) return [];
  const previousRun = previousRunMondayText();
  if (!previousRun) return [];
  try {
    return await requestProductBatches(products, (batch) => apiRequest({
      url: `${WEEKLY_SNAPSHOT_SOURCE}:list`, method: 'get', params: {
        page: 1, pageSize: 10000, sort: 'ship_week_start',
        fields: [
          'run_monday_asin_country_shop_ship_week_start',
          'run_monday', 'snapshot_at', 'asin', 'country', 'shop', 'model', 'sale_owner',
          'ship_date', 'ship_week_start', 'display_week_code', 'system_suggest_qty',
          'approved_qty', 'approved_date', 'approved_channel', 'source_plan_id',
          'formula_version', 'change_id', 'change_status',
        ],
        filter: JSON.stringify({ $and: [
          productScopeFilter(batch),
          { shop: { $eq: TOTAL_SHOP } },
          { run_monday: { $dateNotBefore: previousRun } },
          { run_monday: { $dateNotAfter: previousRun } },
        ] }),
      },
    }));
  } catch (requestError) {
    return [];
  }
}

async function requestExpectedInventory(products) {
  if (!products.length) return [];
  const start = todayText();
  return requestProductBatches(products, (batch) => apiRequest({
    url: 'expected_inventory:list', method: 'get', params: {
      page: 1, pageSize: 10000, sort: 'expected_storage_time',
      fields: [
        'asin', 'country', 'shop', 'expected_storage_time', 'qty_shipped', 'remaining',
      ].join(','),
      filter: JSON.stringify({ $and: [
        productScopeFilter(batch),
        { qty_shipped: { $gt: 0 } },
        { remaining: { $gt: 0 } },
        { expected_storage_time: { $dateNotBefore: start } },
      ] }),
    },
  }));
}

async function requestPlanChanges(shipments) {
  const ids = Array.from(new Set(shipments.map((row) => row.id).filter((id) => id != null)));
  if (!ids.length) return [];
  const responses = await Promise.all(productBatches(ids, 200).map((batch) => apiRequest({
    url: 'shipment_plan_change_v2:list', method: 'get', params: {
      page: 1, pageSize: 10000, sort: '-createdAt',
      fields: [
        'id', 'plan_id', 'status', 'row_version', 'week_code', 'change_kind',
        'original_number', 'proposed_number', 'original_date', 'proposed_date',
        'original_channel', 'proposed_channel', 'reason_type', 'reason', 'gate_result',
        'projection_status', 'application_error', 'applied_at', 'request_uuid', 'bundle_id',
        'requester_username', 'sale_owner', 'product_label', 'createdAt', 'updatedAt',
      ].join(','),
      filter: JSON.stringify({ plan_id: { $in: batch } }),
    },
  })));
  return responses.flatMap(pickRows);
}

async function waitForSubmittedChanges(requestIds, attempts = 8) {
  const ids = Array.from(new Set(requestIds.filter(Boolean)));
  if (!ids.length) return [];
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await apiRequest({
      url: 'shipment_plan_change_v2:list', method: 'get', params: {
        page: 1, pageSize: Math.max(20, ids.length),
        fields: 'id,plan_id,status,row_version,request_uuid,bundle_id,createdAt',
        filter: JSON.stringify({ request_uuid: { $in: ids } }),
      },
    });
    const rows = pickRows(response);
    if (new Set(rows.map((row) => row.request_uuid)).size === ids.length) return rows;
    await new Promise((resolve) => setTimeout(resolve, 450));
  }
  return [];
}

async function requestChangeLogs(changes) {
  const ids = Array.from(new Set(changes.map((row) => row.id).filter((id) => id != null)));
  if (!ids.length) return [];
  const responses = await Promise.all(productBatches(ids, 200).map((batch) => apiRequest({
    url: 'shipment_plan_change_log_v2:list', method: 'get', params: {
      page: 1, pageSize: 10000, sort: 'occurred_at',
      fields: [
        'id', 'change_id', 'bundle_id', 'request_uuid', 'action', 'from_status', 'to_status',
        'actor_user_id', 'actor_username', 'acting_role', 'actor_department', 'comment',
        'before_json', 'after_json', 'result', 'error_message', 'occurred_at', 'createdAt', 'updatedAt',
      ].join(','),
      filter: JSON.stringify({ change_id: { $in: batch } }),
    },
  })));
  return responses.flatMap(pickRows);
}

async function requestLogisticsLeads(products) {
  const countries = Array.from(new Set(products.map((row) => row.country).filter(Boolean)));
  if (!countries.length) return [];
  const response = await apiRequest({
    url: 'v3_cfg_logistics_lead:list', method: 'get', params: {
      page: 1, pageSize: 1000, sort: 'site,lead_days', fields: 'site,channel,lead_days',
      filter: JSON.stringify({ site: { $in: countries } }),
    },
  });
  return pickRows(response);
}

async function requestWaterProducts(products) {
  if (!products.length) return [];
  return requestProductBatches(products, (batch) => apiRequest({
    url: 'water_product:list', method: 'get', params: {
      page: 1, pageSize: 1000,
      fields: [
        'asin', 'country', 'shop1', 'product_label', 'status', 'inv_sales_ratio',
        'expected_stockout_date', 'quantity_receive',
      ].join(','),
      filter: JSON.stringify({ $and: [
        productScopeFilter(batch),
        { shop1: { $eq: TOTAL_SHOP } },
      ] }),
    },
  }));
}

async function requestModelLevels(products) {
  const countries = Array.from(new Set(products.map((product) => product.country).filter(Boolean)));
  const models = Array.from(new Set(products.map((product) => product.model).filter(Boolean)));
  if (!countries.length || !models.length) return [];
  const response = await apiRequest({
    url: 'model_level_config:list', method: 'get', params: {
      page: 1, pageSize: 1000, fields: 'country,model,level_name,enabled',
      filter: JSON.stringify({ $and: [
        { country: { $in: countries } },
        { model: { $in: models } },
        { enabled: { $eq: '是' } },
      ] }),
    },
  });
  return pickRows(response);
}

function latestOnOrBefore(rows, date) {
  return rows.filter((row) => dateText(row.date) <= date).slice().sort((a, b) => dateText(b.date).localeCompare(dateText(a.date)))[0]
    || rows.slice().sort((a, b) => dateText(b.date).localeCompare(dateText(a.date)))[0]
    || null;
}

const V19_ROLE_NAME = { sale: '销售', lead: '主管', ops: '采购', final: '终审', readonly: '只读' };
const V19_STATUS_OWNER = { yel: 'sale', org: 'lead', ops: 'ops', fin: 'final', rej: 'sale' };
const V19_STATUS_TEXT = {
  ok: '已生效', yel: '待销售', org: '待主管', ops: '待采购', fin: '待终审', rej: '已驳回', sub: '处理中',
};
const V19_STATUS_STYLE = {
  ok: { bg: '#f3fbf6', border: '#8fd3aa', color: '#167046' }, yel: { bg: '#fffdf0', border: '#e5c14e', color: '#7a5b00' },
  org: { bg: '#fff8ee', border: '#e8912a', color: '#9c4a00' }, ops: { bg: '#f0f5ff', border: '#3370ff', color: '#1d3f8f' },
  fin: { bg: '#f6f3ff', border: '#8b6cf0', color: '#4b2fb5' }, rej: { bg: '#fdf0ef', border: '#e34d42', color: '#b03a2e' },
  sub: { bg: '#f6f9ff', border: '#8ba7d8', color: '#36507e' },
};
const V19_CHANGE_MARK = { up: '↑', down: '↓', advance: '←', delay: '→', air: '✈', sys: '⟳' };
const V19_CHANGE_LABEL = { up: '加发', down: '减发', advance: '提前', delay: '推迟', air: '改运输方式', sys: '系统重算' };
const V19_LIFE = {
  新品期: { bg: '#e6efff', color: '#1d5fc4' }, 新品: { bg: '#e6efff', color: '#1d5fc4' },
  成长期: { bg: '#e2f6eb', color: '#147a43' }, 成长: { bg: '#e2f6eb', color: '#147a43' },
  成熟期: { bg: '#e6efec', color: '#3a6657' }, 成熟: { bg: '#e6efec', color: '#3a6657' },
  淘汰期: { bg: '#f3e2e1', color: '#9c3b32' }, 淘汰: { bg: '#f3e2e1', color: '#9c3b32' },
};

// 风险分级(后端 v2_risk_grade)与活动前置建议(快照 event_lead)的周级聚合 —— 只读展示,前端不判定
const V19_RISK_RANK = { '红': 3, '橙': 2, '黄': 1, '绿': 0 };
const V19_RISK_STYLE = {
  '红': { dot: '#c0392b', text: '断货风险' },
  '橙': { dot: '#e8912a', text: '压货/晚到' },
  '黄': { dot: '#c9a227', text: '待人工确认' },
};
function v19WeekRisk(rows) {
  let best = null;
  (rows || []).forEach((row) => {
    const grade = String(row.v2_risk_grade || '');
    if (!V19_RISK_STYLE[grade]) return;
    if (!best || V19_RISK_RANK[grade] > V19_RISK_RANK[best.grade]) {
      best = { grade, reason: row.v2_risk_reason || '', asin: row.asin };
    }
  });
  return best;
}
function v19WeekEventLead(rows) {
  let hit = null;
  (rows || []).forEach((row) => {
    const snapshot = v19ParseCalculationSnapshot(row.v2_calculation_snapshot);
    const lead = snapshot && snapshot.event_lead;
    if (!lead || lead.action !== 'SUGGEST_FAST_CHANNEL') return;
    if (!hit || numberValue(lead.days_gain) > numberValue(hit.daysGain)) {
      hit = { asin: row.asin, eventStart: lead.late_event_start, fastChannel: lead.fast_channel,
              daysGain: lead.days_gain, fastAddDate: lead.fast_add_date };
    }
  });
  return hit;
}

function v21WeekBaseline(rows, start) {
  const sameWeek = (rows || []).filter((row) => dateText(row.ship_week_start) === formatDate(start));
  if (!sameWeek.length) return null;
  const hasApproved = sameWeek.some((row) => row.approved_qty != null && Number.isFinite(Number(row.approved_qty)));
  return {
    rows: sameWeek,
    runMonday: sameWeek[0]?.run_monday || '',
    systemSuggestQty: sameWeek.reduce((sum, row) => sum + numberValue(row.system_suggest_qty), 0),
    approvedQty: hasApproved ? sameWeek.reduce((sum, row) => sum + numberValue(row.approved_qty), 0) : null,
    hasApproved,
    approvedChannel: Array.from(new Set(sameWeek.map((row) => row.approved_channel).filter(Boolean))).join('、'),
  };
}

function buildWeeks(shipments, realSupplyRows = [], actualPlans = [], baselineRows = []) {
  const first = nextMonday(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const start = addDays(first, index * 7);
    const end = addDays(start, 6);
    const rows = shipments.filter((row) => inRange(row.date, start, end));
    const shippedRows = realSupplyRows.filter((row) => inRange(row.expected_storage_time, start, end));
    const actualPlanRows = actualPlans.filter((row) => inRange(row.date, start, end));
    const quantity = rows.reduce((sum, row) => sum + numberValue(row.number), 0);
    const shippedQty = shippedRows.reduce((sum, row) => sum + numberValue(row.remaining), 0);
    const actualPlanQty = actualPlanRows.reduce((sum, row) => sum + numberValue(row.number), 0);
    const addDates = rows.map((row) => parseDate(row.add_date)).filter(Boolean).sort((a, b) => a - b);
    const coverStart = addDates.length ? addDays(addDates[0], 7) : null;
    const coverEnd = addDates.length ? addDays(addDates[addDates.length - 1], 13) : null;
    return {
      key: `W${index + 1}`, index, start, end, rows,
      actualRows: shippedRows, shippedRows, actualPlanRows,
      quantity, actualQty: shippedQty, shippedQty, actualPlanQty,
      coverStart, coverEnd,
      baseline: v21WeekBaseline(baselineRows, start),
      risk: v19WeekRisk(rows),
      eventLead: v19WeekEventLead(rows),
      newQty: rows.filter((row) => row.plan_source === PLAN_SOURCE).reduce((sum, row) => sum + numberValue(row.number), 0),
      legacyQty: rows.filter((row) => row.plan_source !== PLAN_SOURCE).reduce((sum, row) => sum + numberValue(row.number), 0),
    };
  });
}

function workflowStatus(value) {
  const status = String(value || '');
  if (status === 'PENDING_SUPERVISOR') return 'org';
  if (status === 'PENDING_PROCUREMENT') return 'ops';
  if (status === 'PENDING_FINAL') return 'fin';
  if (status === 'REJECTED') return 'rej';
  if (status === 'APPLIED') return 'ok';
  return 'sub';
}

function workflowChangeType(record) {
  if (record?.proposed_channel && record.proposed_channel !== record.original_channel) return 'air';
  if (record?.proposed_date && dateText(record.proposed_date) !== dateText(record.original_date)) return dateText(record.proposed_date) < dateText(record.original_date) ? 'advance' : 'delay';
  return numberValue(record?.proposed_number) >= numberValue(record?.original_number) ? 'up' : 'down';
}

function workflowStatusPriority(status) {
  return { rej: 6, org: 5, ops: 4, fin: 3, sub: 2, ok: 1 }[status] || 0;
}

function buildWorkflowChanges(products, shipments, records, logs) {
  const productsByKey = new Map(products.map((product) => [rowProductKey(product), product]));
  const plansById = new Map(shipments.map((plan) => [String(plan.id), plan]));
  const latest = new Map();
  records.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || ''))).forEach((record) => {
    const key = `${record.plan_id}::${record.change_kind}`;
    if (!latest.has(key)) latest.set(key, record);
  });
  const grouped = new Map();
  latest.forEach((record) => {
    const plan = plansById.get(String(record.plan_id));
    const product = plan ? productsByKey.get(rowProductKey(plan)) : null;
    const planDate = parseDate(plan?.date);
    const first = nextMonday(new Date());
    const weekIndex = planDate && first ? Math.floor((planDate - first) / 604800000) : -1;
    if (!plan || !product || weekIndex < 0 || weekIndex > 6) return;
    const key = v19ChangeKey(productKey(product), weekIndex);
    if (!grouped.has(key)) grouped.set(key, { product, weekIndex, records: [] });
    grouped.get(key).records.push(record);
  });
  const logsByChange = new Map();
  logs.forEach((log) => {
    const key = String(log.change_id);
    if (!logsByChange.has(key)) logsByChange.set(key, []);
    logsByChange.get(key).push(log);
  });
  const result = {};
  grouped.forEach((group, key) => {
    const productPlans = shipments.filter((plan) => rowProductKey(plan) === rowProductKey(group.product));
    const week = buildWeeks(productPlans)[group.weekIndex];
    const numberRecords = group.records.filter((record) => record.status !== 'APPLIED' && record.proposed_number != null);
    const dateRecord = group.records.find((record) => record.status !== 'APPLIED' && record.proposed_date && dateText(record.proposed_date) !== dateText(record.original_date));
    const channelRecord = group.records.find((record) => record.status !== 'APPLIED' && record.proposed_channel && record.proposed_channel !== record.original_channel);
    const latestRecord = group.records.slice().sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))[0];
    const statuses = group.records.map((record) => workflowStatus(record.status));
    const status = statuses.slice().sort((a, b) => workflowStatusPriority(b) - workflowStatusPriority(a))[0] || 'sub';
    const delta = numberRecords.reduce((sum, record) => sum + numberValue(record.proposed_number) - numberValue(record.original_number), 0);
    const timeline = group.records.flatMap((record) => (logsByChange.get(String(record.id)) || []).map((log) => ({
      kind: log.acting_role === 'sale' ? 'sale' : 'sys',
      who: log.actor_username || V19_ROLE_NAME[log.acting_role] || '系统',
      when: dateText(log.occurred_at || log.createdAt),
      label: log.action || '工作流处理',
      from: record.proposed_number != null ? record.original_number : '—',
      to: record.proposed_number != null ? record.proposed_number : '—',
      reason: log.comment || log.error_message || `${record.reason_type || ''}：${record.reason || ''}`,
      status: V19_STATUS_TEXT[workflowStatus(log.to_status || record.status)] || String(log.to_status || record.status || ''),
    }))).sort((a, b) => String(a.when).localeCompare(String(b.when)));
    result[key] = {
      id: group.records.length === 1 ? group.records[0].id : null,
      records: group.records,
      type: workflowChangeType(latestRecord),
      from: week.quantity,
      to: Math.max(0, week.quantity + delta),
      shift: dateRecord ? Math.round((parseDate(dateRecord.proposed_date) - parseDate(dateRecord.original_date)) / 604800000) : 0,
      channel: channelRecord?.proposed_channel || null,
      reasonType: latestRecord?.reason_type || '', reason: latestRecord?.reason || '',
      status, needFinal: group.records.some((record) => record.status === 'PENDING_FINAL'),
      inBand: group.records.every((record) => record.gate_result === 'SAFE_OR_NOT_WORSE'),
      by: latestRecord?.requester_username || '', at: latestRecord?.createdAt || '', timeline,
      row_version: latestRecord?.row_version,
    };
  });
  return result;
}

function sourceName(value) { return value === PLAN_SOURCE ? '新算法' : '原有计划'; }
function ratioInfo(row) {
  const ratio = numberValue(row?.inv_sales_ratio, NaN);
  if (!Number.isFinite(ratio)) return { value: null, name: '未计算', color: '#667085', bg: '#f2f4f7' };
  if (ratio < 3.5) return { value: ratio, name: '短缺', color: '#147a43', bg: '#e9f7ee' };
  if (ratio <= 4.5) return { value: ratio, name: '正常', color: '#1d5fc4', bg: '#eef4ff' };
  return { value: ratio, name: '滞销', color: '#b03a2e', bg: '#fbe9e7' };
}

function v19Button(textValue, onClick, kind = 'ghost', disabled = false, extra = {}) {
  const palette = kind === 'pass' ? { bg: '#2ba471', border: '#2ba471', color: '#fff' }
    : kind === 'blue' ? { bg: '#3370ff', border: '#3370ff', color: '#fff' }
      : kind === 'reject' ? { bg: '#fff', border: '#e34d42', color: '#c0392b' }
        : { bg: '#fff', border: '#c9d2df', color: '#3a4763' };
  return h(Button, {
    size: 'small', disabled, onClick, style: {
      height: 30, padding: '0 14px', borderRadius: 7, fontSize: 12.5, fontWeight: 800,
      background: palette.bg, borderColor: palette.border, color: palette.color, ...extra,
    },
  }, textValue);
}

function V19ScopeControls({ selectedSale, saleOptions, productCount, loading, onSaleChange }) {
  const selectStyle = { width: 176, fontSize: 12.5 };
  return h(React.Fragment, null,
    h('b', { style: { fontSize: 12.5, color: '#3a4763' } }, '商品范围'),
    CAN_SELECT_SALE
      ? h(React.Fragment, null,
        h('span', { style: { fontSize: 12.5, color: '#5a6169' } }, '销售'),
        h(Select, { size: 'small', value: selectedSale, options: saleOptions, onChange: onSaleChange, showSearch: true, optionFilterProp: 'label', loading, style: selectStyle }))
      : h('span', { style: { fontSize: 12.5, fontWeight: 700, color: '#1a5fb4', background: '#e7f0fd', border: '1px solid #b9d4f5', borderRadius: 6, padding: '2px 9px' } }, `当前销售：${CURRENT_USERNAME || '未识别'}`),
    h('span', { style: { fontSize: 12, color: '#5a6169' } }, `${productCount} 个 ASIN`));
}

function V19RoleBar({ role, mine, counts, batchSigned, poGenerated, orderWeek, onRole, onMine, onBatch, onGeneratePO, onAllPass }) {
  return h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: '#f3f6fb',
    border: '1px solid #e0e7f1', borderRadius: 9, padding: '9px 13px', marginBottom: 12,
  } },
  h('span', { style: { fontSize: 12.5, fontWeight: 800, color: '#3a4763' } }, '角色透镜'),
  ...(AVAILABLE_ROLE_KEYS.length ? AVAILABLE_ROLE_KEYS.map((key) => h('span', {
    key, onClick: () => onRole(key), style: {
      display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, borderRadius: 8,
      padding: '6px 13px', cursor: 'pointer', background: role === key ? '#1f2329' : '#fff',
      color: role === key ? '#fff' : '#5a6169', border: `1px solid ${role === key ? '#1f2329' : '#e0e5ec'}`,
    },
  }, V19_ROLE_NAME[key], h('span', { style: {
    fontSize: 11, fontWeight: 800, color: '#fff', borderRadius: 9, padding: '0 6px', minWidth: 17, textAlign: 'center',
    background: counts[key] ? (role === key ? '#ff6b60' : '#e34d42') : '#c8cfda',
  } }, counts[key] || 0))) : [h('span', { key: 'readonly', style: { fontSize: 12.5, fontWeight: 700, color: '#667085', background: '#fff', border: '1px solid #dfe4eb', borderRadius: 7, padding: '5px 10px' } }, '只读用户')]),
  h('span', { style: { display: 'inline-flex', border: '1px solid #cfd6e0', borderRadius: 7, overflow: 'hidden' } },
    ...[{ key: true, label: '待我处理' }, { key: false, label: '全部' }].map((item) => h('span', {
      key: String(item.key), onClick: () => onMine(item.key), style: {
        fontSize: 12, fontWeight: 700, padding: '5px 12px', cursor: 'pointer',
        color: mine === item.key ? '#fff' : '#5a6169', background: mine === item.key ? '#3370ff' : '#fff',
      },
    }, item.label))),
  role === 'lead' ? h('span', { onClick: onBatch, style: {
    display: 'inline-flex', alignItems: 'center', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '6px 12px', cursor: 'pointer',
    background: batchSigned ? '#e9f7ee' : '#fdf1e3', border: `1px solid ${batchSigned ? '#6cc08b' : '#e8b45a'}`, color: batchSigned ? '#0e5c32' : '#8a5200',
  } }, batchSigned ? `✓ 本期批次已签核 · N${batchSigned.n}/M${batchSigned.m}/X${batchSigned.x} · 留痕` : '📋 本期批次签核 · 截止周三 18:00（剩 26h）') : null,
  role === 'ops' && orderWeek ? h('span', { onClick: onGeneratePO, 'aria-disabled': true, style: {
    display: 'inline-flex', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '6px 12px', cursor: 'not-allowed',
    background: '#f2f4f7', border: '1px solid #d8dde5', color: '#8a9099',
  } }, '⚙ 生成下单计划 · 工作流尚未启用') : null,
  role === 'sale' ? h(Button, { onClick: onAllPass, size: 'small', 'aria-disabled': true, style: { marginLeft: 'auto', height: 31, borderRadius: 7, background: '#f2f4f7', borderColor: '#d8dde5', color: '#8a9099', cursor: 'not-allowed', fontSize: 12.5, fontWeight: 700 } },
    '✓ 全表一键通过 · 工作流尚未启用') : null,
  h('span', { style: { border: '1px solid #e8b45a', background: '#fff8ea', color: '#8a5a00', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 700 } },
    orderWeek ? '📅 本周 = 下单周：W7 新排待确认 · 周二合并 W6 下 PO' : '📅 本周 = 非下单周：仅新排 W6 · 下周合并 W7 下 PO'));
}

function V19Legend() {
  const item = (...children) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } }, ...children);
  const sw = (border, bg) => h('span', { style: { width: 13, height: 13, display: 'inline-block', borderRadius: 3, background: bg, boxShadow: `inset 0 0 0 2px ${border}` } });
  const life = (label, style) => h('span', { style: { display: 'inline-block', fontSize: 11, fontWeight: 700, borderRadius: 9, padding: '1px 9px', ...style } }, label);
  return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, color: '#5a6169', background: '#fafbfc', border: '1px dashed #d7dce4', borderRadius: 7, padding: '8px 12px', marginBottom: 14 } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap' } }, item(h('b', { style: { color: '#1f2329' } }, '变动：')), item(h('b', { style: { color: '#147a43' } }, '↑'), '加发'), item(h('b', { style: { color: '#1d5fc4' } }, '↓'), '减发'), item(h('b', { style: { color: '#c0392b' } }, '✈'), '改渠道'), item(h('b', { style: { color: '#7c3aed' } }, '⟳'), '系统重算'), item(h('b', { style: { color: '#1f2329', marginLeft: 8 } }, '流转外框：')), item(sw('#e5c14e', '#fffdf0'), '🟡 待销售'), item(sw('#e8912a', '#fff8ee'), '🟠 待主管'), item(sw('#3370ff', '#f0f5ff'), '🔵 待采购'), item(sw('#8b6cf0', '#f6f3ff'), '🟣 待终审'), item(sw('#e34d42', '#fdf0ef'), '⛔ 被驳回')),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap' } }, item(h('b', { style: { color: '#1f2329' } }, '产品标签：')), item(life('新品期', V19_LIFE.新品期)), item(life('成长期', V19_LIFE.成长期)), item(life('成熟期', V19_LIFE.成熟期)), item(life('淘汰期', V19_LIFE.淘汰期)), item(h('b', { style: { color: '#1f2329', marginLeft: 8 } }, '库销比：'), h('span', { style: { color: '#c0392b', fontWeight: 700 } }, '短缺 <3.5'), ' / ', h('span', { style: { color: '#1a6d49', fontWeight: 700 } }, '正常 3.5–4.5'), ' / ', h('span', { style: { color: '#b06a1e', fontWeight: 700 } }, '滞销 >4.5'), '（决策 28 全局固定）')),
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap' } }, item(h('b', { style: { color: '#1f2329' } }, '周段闸：')), item('🔒 ', h('b', null, 'W1'), ' 已锁定，不允许修改'), item(h('b', { style: { color: '#1d5fc4' } }, 'W2–W5'), ' 已承诺 · 服务端按修改后 7–14 天或不劣于系统建议判闸'), item(h('b', { style: { color: '#b06a00' } }, 'W6 已承诺'), '（系统不重算 · PO 前可提异议）· ', h('b', { style: { color: '#b06a00' } }, 'W7 前沿'), ' 未承诺 —— 调量＝下单异议 → 安全区间闸（安全或不劣于系统建议则免审；出界走下单链 销售→采购→终审，决策 27）· ', h('b', null, 'PO 落地后双周真锁 🔒'))));
}

function v19ChangeKey(rowKey, weekIndex) { return `${rowKey}::${weekIndex}`; }
function v19WeekValue(row, weekIndex, changes, useNetScope = false) {
  const change = changes[v19ChangeKey(row.key, weekIndex)];
  const weeks = useNetScope ? (row.netWeeks || row.weeks) : row.weeks;
  return change && Number.isFinite(Number(change.to)) ? Number(change.to) : numberValue(weeks[weekIndex]?.quantity);
}
function v19WeekState(row, weekIndex, useNetScope = false) {
  const weeks = useNetScope ? (row.netWeeks || row.weeks) : row.weeks;
  const actual = numberValue(weeks[weekIndex]?.actualPlanQty);
  return actual > 0 ? { kind: 'actual', qty: actual, label: '实际', locked: false } : null;
}
function v19CombinedWeekState(row, indices) {
  const actual = indices.reduce((sum, index) => sum + numberValue(row.weeks[index]?.actualPlanQty), 0);
  return actual > 0 ? { kind: 'actual', qty: actual, label: '实际', locked: false } : null;
}
function v19NetOf(row, changes) {
  const orderQty = v19WeekValue(row, 5, changes, true) + v19WeekValue(row, 6, changes, true);
  const used = Array.from({ length: 5 }, (_, index) => v19WeekValue(row, index, changes, true)).reduce((sum, value) => sum + value, 0);
  const receive = numberValue(row.waterRow?.quantity_receive ?? row.totalRow?.quantity_receive);
  return { orderQty, used, receive, undelivered: Math.max(0, receive - used), net: Math.max(0, orderQty - Math.max(0, receive - used)) };
}
function v19LifeName(row) {
  const raw = String(row.waterRow?.product_label || row.product?.status || '');
  if (raw.includes('新品')) return '新品期';
  if (raw.includes('成长')) return '成长期';
  if (raw.includes('成熟')) return '成熟期';
  if (raw.includes('淘汰')) return '淘汰期';
  return raw || '未配置';
}
function v19Warning(row) { return row.ratio?.name === '短缺' || row.waterRow?.status === '必断货'; }
function v19Changed(row, changes) {
  return row.weeks.some((week, index) => Boolean(changes[v19ChangeKey(row.key, index)]) || week.newQty > 0);
}
function v19TimelineFor(row, weekIndex, change) {
  const week = row.weeks[weekIndex];
  const base = [{
    kind: 'sys', who: '系统', when: dateText(week.rows[0]?.createdAt || week.rows[0]?.add_date || todayText()),
    chip: week.newQty > 0 ? 'sys' : 'live', label: week.newQty > 0 ? '⟳ 新算法生成' : '初始计划',
    from: '—', to: week.quantity, reason: week.rows.length ? `计划来源：${week.rows.some((item) => item.plan_source === PLAN_SOURCE) ? '新算法' : '原有计划'}；共 ${week.rows.length} 条店铺计划。` : '该周暂无计划记录。',
    status: '已生效',
  }];
  return change?.timeline?.length ? [...base, ...change.timeline] : base;
}


const V19_ACTIVITY_PERIODS = [
  { name: 'PD', start: '06-10', end: '07-10' },
  { name: '秋促', start: '09-10', end: '10-10' },
  { name: '黑五', start: '11-01', end: '12-15' },
];

function v19ChannelDays(value) {
  const textValue = String(value || '');
  const explicit = textValue.match(/(\d+)\s*天/);
  return explicit ? numberValue(explicit[1]) : 0;
}

function v19ChannelOptions(logisticsLeads, country, currentValue) {
  const options = (logisticsLeads || []).filter((row) => row.site === country && row.channel && numberValue(row.lead_days) > 0)
    .map((row) => ({ value: `${row.channel}-${numberValue(row.lead_days)}天`, label: `${row.channel} · ${numberValue(row.lead_days)} 天` }));
  const unique = Array.from(new Map(options.map((option) => [option.value, option])).values());
  if (currentValue && !unique.some((option) => option.value === currentValue)) unique.unshift({ value: currentValue, label: `${currentValue}（当前计划）` });
  return unique;
}

function v19ChannelValue(value) {
  return String(value || '').trim();
}

function v19WarehouseDays(row, week) {
  const record = week?.rows?.find((item) => numberValue(item.warehouse_days) > 0)
    || row.weeks.flatMap((item) => item.rows).find((item) => numberValue(item.warehouse_days) > 0);
  return Math.max(0, numberValue(record?.warehouse_days));
}

function v19BatchDates(row, week, channelValue, shiftWeeks = 0) {
  const record = week.rows[0] || {};
  const shipDate = week.start instanceof Date && !Number.isNaN(week.start.getTime())
    ? new Date(week.start.getTime())
    : parseDate(week.start) || parseDate(record.date) || new Date();
  const warehouseDays = v19WarehouseDays(row, week);
  const shiftedShip = addDays(shipDate, shiftWeeks * 7);
  const arrival = addDays(shiftedShip, v19ChannelDays(channelValue || record.channel));
  const storedAddDate = parseDate(record.add_date);
  const sellable = shiftWeeks === 0 && !channelValue && storedAddDate
    ? storedAddDate
    : addDays(arrival, warehouseDays);
  return { shipDate: shiftedShip, arrival, sellable, warehouseDays };
}

function V19TrendChart({ row, changes, role, poApproved, orderWeek, channelOptions, onApply, onSandbox }) {
  const waterDetailUrl = row.product.asin && row.product.country
    ? `${WATER_DETAIL_ROUTE}${buildSearch({ asin: row.product.asin, country: row.product.country, shop: TOTAL_SHOP })}`
    : '';
  const [simOn, setSimOn] = useState(false);
  const [mods, setMods] = useState({});
  const [draft, setDraft] = useState(null);
  const dragRef = useRef(null);
  const [dragging, setDragging] = useState(null);
  const [nodeIndex, setNodeIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const [hoverNode, setHoverNode] = useState(null);
  const hoverLockRef = useRef(false);
  const changeSignature = row.weeks.map((week, index) => `${index}:${changes[v19ChangeKey(row.key, index)]?.at || ''}`).join('|');
  useEffect(() => { dragRef.current = null; setMods({}); setDraft(null); setSimOn(false); setDragging(null); setNodeIndex(null); setHoverIndex(null); setHoverNode(null); }, [row.key, changeSignature]);
  const W = 1600; const H = 360; const L = 54; const R = 22; const T = 28; const B = 42;
  const plotW = W - L - R; const plotH = H - T - B;
  const todayIndex = 0;
  const fallbackDaily = Math.max(0.1, numberValue(row.summaryRow?.weighted_sales, numberValue(row.summaryRow?.maybe_sales, 0.1)));
  const startDate = parseDate(todayText());
  const endDate = addCalendarMonths(startDate, 4);
  const N = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  const dates = Array.from({ length: N }, (_, index) => formatDate(addDays(startDate, index)));
  const dailyMap = new Map(row.dailyRows.map((item) => [dateText(item.date), item]));
  const futureForecastDates = row.dailyRows.map((item) => parseDate(item.date)).filter((date) => date && date >= startDate)
    .sort((a, b) => a - b);
  const lastForecastDate = futureForecastDates[futureForecastDates.length - 1] || endDate;
  const projectionEnd = lastForecastDate > endDate ? lastForecastDate : endDate;
  const projectionLength = Math.max(N, Math.round((projectionEnd - startDate) / 86400000) + 1);
  const projectionDates = Array.from({ length: projectionLength }, (_, index) => formatDate(addDays(startDate, index)));
  const saleInventoryValues = projectionDates.map((date) => dailyMap.get(date)?.sale_inventory);
  const saleDemandValues = projectionDates.map((date) => dailyMap.get(date)?.sale_maybe_sales);
  const saleCover = v19CoverSeries(projectionDates, saleInventoryValues, saleDemandValues, N);
  const existingValues = saleCover.values.map((value, index) => index <= todayIndex ? null : value);
  const hasSaleForecastLine = existingValues.some(Number.isFinite);
  function nearestValue(values, index, fallback = 0) {
    if (Number.isFinite(values[index])) return values[index];
    for (let offset = 1; offset < values.length; offset += 1) {
      if (index - offset >= 0 && Number.isFinite(values[index - offset])) return values[index - offset];
      if (index + offset < values.length && Number.isFinite(values[index + offset])) return values[index + offset];
    }
    return fallback;
  }
  const frac = (index) => N <= 1 ? 0 : index / (N - 1);
  const px = (index) => L + frac(Math.max(0, Math.min(N - 1, index))) * plotW;
  const indexOfDate = (value) => {
    const parsed = value instanceof Date && !Number.isNaN(value.getTime()) ? value : parseDate(value);
    return parsed ? Math.max(0, Math.min(N - 1, Math.round((parsed - startDate) / 86400000))) : todayIndex;
  };
  function allocateQuantity(total, plans) {
    if (!plans.length) return [];
    const target = Math.max(0, Math.round(numberValue(total)));
    const weights = plans.map((plan) => Math.max(0, numberValue(plan.number)));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const raw = plans.map((plan, index) => weightTotal > 0 ? target * weights[index] / weightTotal : target / plans.length);
    const values = raw.map((value) => Math.floor(value));
    let remainder = target - values.reduce((sum, value) => sum + value, 0);
    raw.map((value, index) => ({ index, fraction: value - values[index] }))
      .sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .forEach((item) => { if (remainder > 0) { values[item.index] += 1; remainder -= 1; } });
    return values;
  }
  const baseNodes = row.weeks.map((week, index) => {
    const change = changes[v19ChangeKey(row.key, index)];
    const baseQty = v19WeekValue(row, index, changes);
    const channel = v19ChannelValue(change?.channel || week.rows[0]?.channel);
    const baseShift = numberValue(change?.shift);
    return { index, week, hasPlan: week.rows.length > 0, baseQty, channel, baseChannel: channel, baseShift, baseChannelOverride: change?.channel || null, baseDates: v19BatchDates(row, week, change?.channel || null, baseShift) };
  });
  const displayMods = useMemo(() => draft ? { ...mods, [draft.index]: draft.mod } : mods, [mods, draft]);
  useEffect(() => { if (typeof onSandbox === 'function') onSandbox(row.key, displayMods); }, [row.key, displayMods]);
  useEffect(() => () => { if (typeof onSandbox === 'function') onSandbox(row.key, {}); }, [row.key]);
  const buildNodes = (activeMods) => baseNodes.map((base) => {
    const mod = activeMods[base.index] || {};
    const qty = mod.qty == null ? base.baseQty : Math.max(0, numberValue(mod.qty));
    const shift = Math.max(-2, Math.min(2, mod.shift == null ? base.baseShift : numberValue(mod.shift)));
    const channel = mod.channel || base.channel;
    const datesValue = v19BatchDates(row, base.week, mod.channel || base.baseChannelOverride, shift);
    const pointIndex = indexOfDate(datesValue.sellable);
    return {
      ...base, mod, qty,
      shippedQty: numberValue(base.week.shippedQty), actualPlanQty: numberValue(base.week.actualPlanQty),
      shift, channel, ...datesValue, pointIndex,
    };
  });
  const buildPreview = (activeMods) => {
    const nodes = buildNodes(activeMods);
    const adds = new Map(projectionDates.map((date) => [date, 0]));
    const adjustAdd = (dateValue, delta) => {
      const key = dateText(dateValue);
      if (!adds.has(key)) return;
      adds.set(key, numberValue(adds.get(key)) + numberValue(delta));
    };
    row.realSupplyRows.forEach((supply) => {
      adjustAdd(supply.expected_storage_time, numberValue(supply.remaining));
    });
    nodes.forEach((node) => {
      if (!node.hasPlan) return;
      const mod = activeMods[node.index];
      if (!mod) {
        node.week.rows.forEach((plan) => adjustAdd(plan.add_date, numberValue(plan.number)));
        return;
      }
      const allocations = allocateQuantity(node.qty, node.week.rows);
      node.week.rows.forEach((plan, planIndex) => {
        adjustAdd(node.sellable, allocations[planIndex]);
      });
    });
    const invArr = new Array(projectionDates.length).fill(NaN);
    const demArr = new Array(projectionDates.length).fill(NaN);
    let previousInventory = NaN; let previousDemand = 0;
    projectionDates.forEach((date, index) => {
      if (index < todayIndex) return;
      const daily = dailyMap.get(date);
      if (!daily) { previousInventory = NaN; previousDemand = 0; return; }
      const add = numberValue(adds.get(date));
      const demand = optionalNumber(daily.maybe_sales);
      if (!Number.isFinite(demand)) { previousInventory = NaN; previousDemand = 0; return; }
      let inventory;
      if (index === todayIndex || !Number.isFinite(previousInventory)) {
        const actualInventory = numberValue(daily.inventory) - numberValue(daily.add);
        inventory = actualInventory + add;
      } else if (add > 0 && previousInventory - previousDemand < 0) {
        inventory = add;
      } else {
        inventory = previousInventory - previousDemand + add;
      }
      invArr[index] = inventory; demArr[index] = demand;
      previousInventory = inventory; previousDemand = demand;
    });
    const previewCover = v19CoverSeries(projectionDates, invArr, demArr, N);
    return {
      values: previewCover.values,
      lowerBounds: previewCover.lowerBounds,
      inventories: invArr,
      demands: demArr,
      nodes: nodes.map((node) => ({ ...node, dayValue: Math.max(0, nearestValue(previewCover.values, node.pointIndex)) })),
    };
  };
  const systemChart = buildPreview({});
  const sysValues = systemChart.values;
  const futureInventoryReady = sysValues.slice(todayIndex + 1).some(Number.isFinite);
  const displayChart = Object.keys(displayMods).length ? buildPreview(displayMods) : systemChart;
  const simValues = displayChart.values;
  const numericSeries = [...sysValues, ...existingValues].filter(Number.isFinite);
  const observedMax = Math.max(50, ...numericSeries);
  const yStep = Math.max(10, Math.ceil(observedMax / 50) * 10);
  const maxY = Math.max(50, Math.ceil(observedMax / yStep) * yStep);
  const yTicks = Array.from({ length: Math.floor(maxY / yStep) + 1 }, (_, index) => index * yStep);
  const py = (value) => T + (1 - Math.min(maxY, Math.max(0, numberValue(value))) / maxY) * plotH;
  const nodeAnchorValues = simOn && (draft?.pending || Object.keys(mods).length) ? simValues : sysValues;
  const visibleNodes = displayChart.nodes.filter((node) => node.hasPlan).map((node) => {
    const lineDayValue = Math.max(0, nearestValue(nodeAnchorValues, node.pointIndex));
    return { ...node, dayValue: lineDayValue, x: px(node.pointIndex), y: py(lineDayValue) };
  });
  const labelWidth = 78;
  const labelHeight = 34;
  const labelGap = 8;
  const anchorCounts = new Map();
  visibleNodes.forEach((node) => {
    const key = `${node.pointIndex}:${Math.round(node.y)}`;
    anchorCounts.set(key, (anchorCounts.get(key) || 0) + 1);
  });
  const clampLabelX = (value) => Math.max(L + labelWidth / 2, Math.min(W - R - labelWidth / 2, value));
  const clampLabelY = (value) => Math.max(T + labelHeight / 2, Math.min(H - B - labelHeight / 2, value));
  const overlapArea = (first, second) => {
    const overlapX = labelWidth + labelGap - Math.abs(first.x - second.x);
    const overlapY = labelHeight + labelGap - Math.abs(first.y - second.y);
    return overlapX > 0 && overlapY > 0 ? overlapX * overlapY : 0;
  };
  const occupiedLabels = [];
  const nodeLayoutByIndex = new Map();
  const labelLanes = [
    T + labelHeight / 2 + 5,
    T + labelHeight * 1.5 + labelGap + 5,
    H - B - labelHeight * 1.5 - labelGap - 5,
    H - B - labelHeight / 2 - 5,
  ];
  visibleNodes.slice().sort((a, b) => a.x - b.x || a.index - b.index).forEach((node) => {
    const preferredLane = node.index % labelLanes.length;
    const laneOrder = Array.from({ length: labelLanes.length }, (_, offset) => (
      (preferredLane + offset) % labelLanes.length
    ));
    const candidates = [
      ...laneOrder.map((lane) => ({ x: node.x, y: labelLanes[lane] })),
      ...laneOrder.flatMap((lane) => [-(labelWidth + 12), labelWidth + 12].map((offset) => ({
        x: node.x + offset,
        y: labelLanes[lane],
      }))),
    ].map((candidate) => ({ x: clampLabelX(candidate.x), y: clampLabelY(candidate.y) }));
    const uniqueCandidates = candidates.filter((candidate, index, list) => (
      list.findIndex((item) => Math.abs(item.x - candidate.x) < 0.5 && Math.abs(item.y - candidate.y) < 0.5) === index
    ));
    const selectedCandidate = uniqueCandidates.find((candidate) => (
      occupiedLabels.every((placed) => overlapArea(candidate, placed) === 0)
    )) || uniqueCandidates.reduce((best, candidate) => {
      const score = occupiedLabels.reduce((sum, placed) => sum + overlapArea(candidate, placed), 0);
      return !best || score < best.score ? { ...candidate, score } : best;
    }, null);
    const labelX = selectedCandidate?.x ?? clampLabelX(node.x);
    const labelY = selectedCandidate?.y ?? clampLabelY(labelLanes[preferredLane]);
    const displaced = Math.abs(labelX - node.x) > 1 || Math.abs(labelY - node.y) > 20;
    const anchorKey = `${node.pointIndex}:${Math.round(node.y)}`;
    const stacked = (anchorCounts.get(anchorKey) || 0) > 1;
    occupiedLabels.push({ x: labelX, y: labelY });
    nodeLayoutByIndex.set(node.index, {
      ...node,
      stacked,
      displaced,
      labelX,
      labelY,
      handleX: stacked ? labelX : node.x,
      handleY: stacked ? labelY : node.y,
      handleWidth: stacked ? labelWidth : 40,
      handleHeight: stacked ? labelHeight : 40,
    });
  });
  const laidOutNodes = visibleNodes.map((node) => nodeLayoutByIndex.get(node.index) || node);
  const selected = nodeIndex == null ? null : laidOutNodes.find((node) => node.index === nodeIndex);
  const hoveredBatch = dragging || hoverNode == null ? null : laidOutNodes.find((node) => node.index === hoverNode);


  const actualPlanRowsText = (week) => (week?.actualPlanRows || []).map((item) => (
    `${item.shop || '未标店铺'} · 发货 ${dateText(item.date) || '-'} · ${item.channel || '未标渠道'} · ${fmt(item.number)}台`
  ));
  const batchInfo = (node) => {
    if (!node) return null;
    const baseShipDate = addDays(node.week.start, node.baseShift * 7);
    const shipDate = addDays(node.week.start, node.shift * 7);
    const baseArrival = node.baseDates?.arrival;
    const baseSellable = node.baseDates?.sellable;
    const quantityChanged = numberValue(node.qty) !== numberValue(node.baseQty);
    const shipDateChanged = dateText(shipDate) !== dateText(baseShipDate);
    const arrivalChanged = dateText(node.arrival) !== dateText(baseArrival);
    const sellableChanged = dateText(node.sellable) !== dateText(baseSellable);
    const channelChanged = String(node.channel || '') !== String(node.baseChannel || '');
    const actualPlanQty = numberValue(node.week.actualPlanQty);
    const stateKind = actualPlanQty > 0 ? 'actual' : '';
    return {
      suggestQty: numberValue(node.qty), baseSuggestQty: numberValue(node.baseQty), quantityChanged,
      shipDate, baseShipDate, shipDateChanged,
      arrival: node.arrival, baseArrival, arrivalChanged,
      sellable: node.sellable, baseSellable, sellableChanged,
      warehouseDays: node.warehouseDays,
      channel: node.channel || '-', baseChannel: node.baseChannel || '-', channelChanged,
      stateKind, stateQty: actualPlanQty,
      stateRows: stateKind ? actualPlanRowsText(node.week) : [],
    };
  };
  const renderBatchBase = (info, options = {}) => {
    if (!info) return [];
    const color = options.dark ? '#fff' : '#1f2329';
    const muted = options.dark ? '#cbd6ff' : '#8a9099';
    const changed = options.dark ? '#ffd479' : '#5b3fc4';
    const rowStyle = { margin: '4px 0', color };
    return [
      h('div', { key: 'suggest', style: rowStyle }, h('span', { style: { color: muted } }, '系统建议　'), h('b', { style: { color: info.quantityChanged ? changed : color } }, info.quantityChanged ? `${fmt(info.baseSuggestQty)} → ${fmt(info.suggestQty)} 台` : `${fmt(info.suggestQty)} 台`)),
      h('div', { key: 'ship-date', style: rowStyle }, h('span', { style: { color: muted } }, '发货日期　'), h('b', { style: { color: info.shipDateChanged ? changed : color } }, info.shipDateChanged ? `${dateText(info.baseShipDate)} → ${dateText(info.shipDate)}` : dateText(info.shipDate))),
      h('div', { key: 'arrival-date', style: rowStyle }, h('span', { style: { color: muted } }, '物流到达　'), h('b', { style: { color: info.arrivalChanged ? changed : color } }, info.arrivalChanged ? `${dateText(info.baseArrival)} → ${dateText(info.arrival)}` : dateText(info.arrival))),
      h('div', { key: 'warehouse-days', style: rowStyle }, h('span', { style: { color: muted } }, '入仓天数　'), h('b', null, `${fmt(info.warehouseDays)} 天`)),
      h('div', { key: 'sellable-date', style: rowStyle }, h('span', { style: { color: muted } }, '预计入库　'), h('b', { style: { color: info.sellableChanged ? changed : color } }, info.sellableChanged ? `${dateText(info.baseSellable)} → ${dateText(info.sellable)}` : dateText(info.sellable))),
      h('div', { key: 'channel', style: rowStyle }, h('span', { style: { color: muted } }, '渠道　　　'), options.channelNode || h('b', { style: { color: info.channelChanged ? changed : color } }, info.channelChanged ? `${info.baseChannel} → ${info.channel}` : info.channel), options.channelNode && info.channelChanged ? h('span', { style: { marginLeft: 7, color: changed, fontWeight: 700 } }, `${info.baseChannel} → ${info.channel}`) : null),
    ];
  };
  const renderBatchState = (info, options = {}) => {
    if (!info?.stateKind) return null;
    const dark = options.dark;
    const label = '实际';
    const tone = dark ? '#ffd479' : '#1a6d49';
    return h('div', { style: { marginTop: 7, paddingTop: 7, borderTop: `1px solid ${dark ? 'rgba(255,255,255,.2)' : '#e7eaf0'}` } },
      h('div', { style: { color: tone, fontWeight: 800 } }, `${label} ${fmt(info.stateQty)} 台 · 当前 W1 起的水位表计划，固定不随模拟变化`),
      ...info.stateRows.map((text, index) => h('div', { key: `${label}-${index}`, style: { color: dark ? '#f2f4f8' : '#667085', fontSize: 11.5, lineHeight: 1.55 } }, text)));
  };
  const hoveredBatchInfo = batchInfo(hoveredBatch);
  const selectedInfo = batchInfo(selected);
  const pathOf = (values) => {
    let drawing = false;
    return values.map((value, index) => {
      if (!Number.isFinite(value)) { drawing = false; return ''; }
      const command = drawing ? 'L' : 'M'; drawing = true;
      return `${command}${px(index).toFixed(1)} ${py(value).toFixed(1)}`;
    }).filter(Boolean).join(' ');
  };
  const completeSystemSeries = sysValues.every(Number.isFinite);
  const areaPath = completeSystemSeries ? `${pathOf(sysValues)} L ${px(N - 1).toFixed(1)} ${py(0).toFixed(1)} L ${px(0).toFixed(1)} ${py(0).toFixed(1)} Z` : '';
  const metrics = (values) => {
    const future = values.slice(todayIndex).filter(Number.isFinite);
    return { over: future.filter((value) => value > SAFE_MAX_DAYS).length, min: future.length ? Math.min(...future) : 0 };
  };
  const baseMetric = metrics(sysValues); const simMetric = metrics(simValues);
  const changedKeys = Object.keys(mods).filter((key) => {
    const mod = mods[key]; const base = baseNodes[Number(key)];
    return mod && ((mod.shift != null && numberValue(mod.shift) !== base?.baseShift) || (mod.channel && mod.channel !== base?.channel) || (mod.qty != null && numberValue(mod.qty) !== base?.baseQty));
  });
  const stock = numberValue(row.summaryRow?.inventory);
  const transit = numberValue(row.summaryRow?.v2_on_the_way, numberValue(row.summaryRow?.on_the_way));
  const receive = numberValue(row.waterRow?.quantity_receive ?? row.totalRow?.quantity_receive);
  const stockoutIndex = sysValues.findIndex((value, index) => index > todayIndex && Number.isFinite(value) && value <= 0);
  const stockoutDate = row.waterRow?.expected_stockout_date || (stockoutIndex > 0 ? dates[stockoutIndex] : '3 个月内无');
  const hoverDaily = hoverIndex == null ? null : dailyMap.get(dates[hoverIndex]);
  const hover = dragging || hoveredBatch || hoverIndex == null ? null : {
    x: px(hoverIndex), date: dates[hoverIndex],
    sys: sysValues[hoverIndex], sysLowerBound: systemChart.lowerBounds[hoverIndex],
    existing: existingValues[hoverIndex], existingLowerBound: saleCover.lowerBounds[hoverIndex],
    sysDetail: v19CoverDetail(projectionDates, systemChart.inventories, systemChart.demands, hoverIndex),
    existingDetail: v19CoverDetail(projectionDates, saleInventoryValues, saleDemandValues, hoverIndex),
    daily: hoverDaily,
  };
  const hoverSystemLines = hover ? v19CoverDetailLines(hover.sysDetail, hover.sys, hover.sysLowerBound, '预估销量') : [];
  const hoverSaleLines = hover ? v19CoverDetailLines(hover.existingDetail, hover.existing, hover.existingLowerBound, '销售预估销量') : [];
  const ticks = Array.from(new Set(
    Array.from({ length: 5 }, (_, index) => indexOfDate(addCalendarMonths(startDate, index))),
  )).filter((index) => index >= 0 && index < N).sort((a, b) => a - b);

  function editDraft(index, patchValue) {
    const current = draft?.index === index ? draft.mod : (mods[index] || {});
    setSimOn(true); setDraft({ index, mod: { ...current, ...patchValue }, pending: true }); setNodeIndex(index);
  }
  function nodeEditable(node) {
    if (node.index === 0) return false;
    return role === 'sale' && !(poApproved && orderWeek && node.index >= 5);
  }
  function toggleSimulation() {
    if (simOn) {
      dragRef.current = null;
      hoverLockRef.current = false;
      setDragging(null); setMods({}); setDraft(null); setNodeIndex(null); setHoverIndex(null); setHoverNode(null); setSimOn(false);
    } else setSimOn(true);
  }
  function startDrag(event, node) {
    event.preventDefault?.();
    event.stopPropagation?.();
    const original = { ...(mods[node.index] || {}), qty: node.qty, shift: node.shift, channel: node.channel };
    const session = {
      index: node.index, pointerId: event.pointerId,
      x: event.clientX, y: event.clientY,
      qty: node.qty, shift: node.shift, channel: node.channel, original, lastMod: original,
      moved: false, locked: !nodeEditable(node),
    };
    hoverLockRef.current = true;
    setHoverIndex(null); setHoverNode(null); setDraft(null); setNodeIndex(null);
    dragRef.current = session;
    setDragging(session);
  }
  function moveDrag(event) {
    const session = dragRef.current;
    if (!session || (session.pointerId != null && event.pointerId !== session.pointerId)) return;
    event.preventDefault?.();
    const dx = event.clientX - session.x; const dy = session.y - event.clientY;
    if (!session.moved && Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
    if (session.locked) return;
    if (!session.moved) {
      session.moved = true;
      setSimOn(true); setHoverIndex(null); setHoverNode(null);
    }
    const base = baseNodes[session.index]; const minQty = session.index === 0 ? base.baseQty : 0;
    const minShift = -2; const maxShift = 2;
    const qtyStep = Math.max(1, Math.round(fallbackDaily));
    const dyDays = Math.round(dy / 5);
    const dxDays = dx / 10;
    const qty = Math.max(minQty, session.qty + dyDays * qtyStep);
    let shift = Math.max(minShift, Math.min(maxShift, session.shift + Math.round(dxDays / 7)));
    const todayDate = parseDate(todayText()); const windowEnd = addDays(startDate, N - 1);
    let shiftedDates = v19BatchDates(row, base.week, session.channel, shift);
    while (shift < maxShift && shiftedDates.shipDate < todayDate) { shift += 1; shiftedDates = v19BatchDates(row, base.week, session.channel, shift); }
    while (shift > minShift && shiftedDates.sellable > windowEnd) { shift -= 1; shiftedDates = v19BatchDates(row, base.week, session.channel, shift); }
    while (shift < maxShift && shiftedDates.sellable < todayDate) { shift += 1; shiftedDates = v19BatchDates(row, base.week, session.channel, shift); }
    session.lastMod = { ...session.original, qty, shift };
    setDragging({ ...session });
    setDraft({ index: session.index, mod: session.lastMod, pending: true });
  }
  function endDrag(event) {
    const session = dragRef.current;
    if (!session || (session.pointerId != null && event?.pointerId != null && event.pointerId !== session.pointerId)) return;
    event?.preventDefault?.();
    dragRef.current = null;
    hoverLockRef.current = false;
    setDragging(null);
    if (!session.moved) {
      setDraft({ index: session.index, mod: { ...(mods[session.index] || {}) }, pending: false });
      setNodeIndex(session.index);
      return;
    }
    const finalMod = session.lastMod || session.original;
    const unchanged = numberValue(finalMod.qty) === numberValue(session.qty)
      && numberValue(finalMod.shift) === numberValue(session.shift)
      && String(finalMod.channel || '') === String(session.channel || '');
    if (unchanged) {
      setDraft(null); setNodeIndex(null); setHoverNode(session.index);
      return;
    }
    setDraft({ index: session.index, mod: finalMod, pending: true });
    setNodeIndex(session.index);
  }
  function confirmDraft() {
    if (!draft) return;
    setMods((current) => ({ ...current, [draft.index]: { ...draft.mod } }));
    setDraft((current) => current ? { ...current, pending: false } : current);
  }
  function resetNode(index) {
    setMods((current) => { const next = { ...current }; delete next[index]; return next; });
    setDraft(null); setNodeIndex(null);
  }
  function closeNodePanel() { setDraft(null); setNodeIndex(null); }
  function applyAll() {
    const bundle = changedKeys.map((key) => {
      const index = Number(key); const base = baseNodes[index]; const mod = mods[index]; const oneChart = buildPreview({ [index]: mod });
      const built = oneChart.nodes[index];
      const quantityChanged = numberValue(mod.qty, base.baseQty) !== base.baseQty;
      const dateChanged = numberValue(mod.shift, base.baseShift) !== base.baseShift;
      const channelChanged = Boolean(mod.channel && mod.channel !== base.channel);
      const type = channelChanged ? 'air' : numberValue(mod.qty, base.baseQty) > base.baseQty ? 'up' : numberValue(mod.qty, base.baseQty) < base.baseQty ? 'down' : numberValue(mod.shift, base.baseShift) < base.baseShift ? 'advance' : 'delay';
      return { weekIndex: index, from: base.baseQty, to: numberValue(mod.qty, base.baseQty), shift: numberValue(mod.shift), channel: mod.channel || base.channel, type, quantityChanged, dateChanged, channelChanged, arrival: formatDate(built.arrival), sellable: formatDate(built.sellable) };
    });
    const evidence = `基于 daily_sales.inventory、maybe_sales 与系统建议入库逐日计算真实可撑天数，预览 ${bundle.length} 处调整：当前系统建议曲线超上限 ${baseMetric.over} 天、最低 ${fmt(baseMetric.min, 1)} 天。最终安全区间结果以提交工作流服务端重算为准。`;
    onApply(row, bundle, evidence);
  }

  const activityRects = V19_ACTIVITY_PERIODS.map((period) => {
    const year = startDate.getFullYear(); const start = indexOfDate(`${year}-${period.start}`); const end = indexOfDate(`${year}-${period.end}`);
    if (end <= 0 || start >= N - 1) return null;
    const left = px(Math.max(0, start)); const right = px(Math.min(N - 1, end));
    return h('rect', { key: period.name, x: left, y: T, width: Math.max(1, right - left), height: plotH, fill: '#f4b942', fillOpacity: 0.1 });
  }).filter(Boolean);
  const xPercent = (value) => `${Math.max(0, Math.min(100, value / W * 100))}%`;
  const yPercent = (value) => `${Math.max(0, Math.min(100, value / H * 100))}%`;

  return h('div', {
    onPointerMoveCapture: moveDrag,
    onPointerUpCapture: endDrag,
    onPointerCancelCapture: endDrag,
    onPointerLeave: (event) => {
      if (dragRef.current) endDrag(event);
      hoverLockRef.current = false;
      setHoverIndex(null); setHoverNode(null);
    },
    style: { position: 'relative', width: '100%', maxWidth: 2200, minWidth: 0, margin: '0 auto', padding: '12px 12px 16px', background: '#fbfcfe', boxSizing: 'border-box', whiteSpace: 'normal' },
  },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 13.5, fontWeight: 700, marginBottom: 8 } },
      '📈 到货 & 真实可撑天数趋势（未来 4 个月） | ', h('span', { style: { color: '#3370ff' } }, `${row.product.model || '-'} | ${row.product.country || '-'}`),
      h(Button, { size: 'small', onClick: toggleSimulation, style: { borderColor: '#8b6cf0', background: simOn ? '#8b6cf0' : '#f6f3ff', color: simOn ? '#fff' : '#5b3fc4', borderRadius: 6, fontSize: 12, fontWeight: 700 } }, '🧪 模拟演算'),
      h(Button, {
        size: 'small',
        icon: h(LinkOutlined || 'span'),
        href: waterDetailUrl || undefined,
        target: '_blank',
        rel: 'noreferrer',
        disabled: !waterDetailUrl,
        style: { marginLeft: 'auto', borderColor: '#b9d4f5', background: '#f6f9ff', color: '#1a5fb4', borderRadius: 6, fontSize: 12, fontWeight: 700 },
      }, '水位表详情')),
    h('div', { style: { margin: '2px 0 6px', fontSize: 13, color: '#5a6169', background: '#f7f9fc', border: '1px solid #e6ebf2', borderRadius: 7, padding: '6px 12px' } },
      '📦 当前在库 ', h('b', null, fmt(stock)), '（FBA | 0:00 快照） | 在途 ', h('b', null, fmt(transit)), '（= 发货 − 已签收，已计入曲线起点） | 未交货订单 ', h('b', null, fmt(receive)), ' | 预计断货日 ', h('b', { style: { color: stockoutDate === '3 个月内无' ? '#147a43' : '#c0392b' } }, stockoutDate)),
    !futureInventoryReady ? h('div', { style: { margin: '5px 0 7px', padding: '6px 10px', borderRadius: 6, background: '#fff8e6', border: '1px solid #f0c36d', color: '#7a4d00', fontSize: 12 } }, '未来普通水位尚未计算；当前仅展示已有历史，提交前需先运行水位表更新。') : null,
    simOn && (changedKeys.length || draft?.pending) ? h('div', { style: { margin: '6px 0 8px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, fontWeight: 700, color: '#4b2fb0', background: '#f6f3ff', border: '1px dashed #8b6cf0', borderRadius: 8, padding: '6px 11px' } },
      `🧪 拖动预览 · ${changedKeys.length + (draft?.pending && !changedKeys.includes(String(draft.index)) ? 1 : 0)} 处改动 · 当前系统建议曲线：超上限 ${baseMetric.over} 天、最低 ${fmt(baseMetric.min, 1)} 天 · 调整后预览：超上限 ${simMetric.over} 天、最低 ${fmt(simMetric.min, 1)} 天`,
      changedKeys.length ? v19Button('→ 转为修改申请', applyAll, 'blue') : null, v19Button('全部重置', () => { setMods({}); setDraft(null); setNodeIndex(null); }, 'ghost'),
      h('span', { style: { marginLeft: 'auto', fontWeight: 400, color: '#8a7fc0', fontSize: 11 } }, '拖圆点：上下 = 系统建议数量（1 格 = 1 天库存）· 左右 = 时间（按周）· 实际计划固定不随拖动变化；已发已转在途，不再单独展示；安全区间由服务端工作流重算')) : null,
    h('div', {
      style: { position: 'relative', width: '100%', aspectRatio: `${W} / ${H}`, background: '#fff', border: '1px solid #eef1f5', borderRadius: 8, overflow: 'hidden', userSelect: 'none', touchAction: 'none' },
    },
      h('svg', { viewBox: `0 0 ${W} ${H}`, shapeRendering: 'geometricPrecision', style: { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' } },
        ...activityRects,
        ...yTicks.map((value) => h('line', { key: value, x1: L, x2: W - R, y1: py(value), y2: py(value), stroke: '#eef1f5', vectorEffect: 'non-scaling-stroke' })),
        h('line', { x1: px(todayIndex), x2: px(todayIndex), y1: T, y2: H - B, stroke: '#333', strokeWidth: 1.2, strokeDasharray: '2 3', vectorEffect: 'non-scaling-stroke' }),
        h('line', { x1: L, x2: W - R, y1: py(SAFE_MIN_DAYS), y2: py(SAFE_MIN_DAYS), stroke: '#c0392b', strokeWidth: 1.2, strokeDasharray: '5 4', vectorEffect: 'non-scaling-stroke' }),
        h('line', { x1: L, x2: W - R, y1: py(SAFE_MAX_DAYS), y2: py(SAFE_MAX_DAYS), stroke: '#e8912a', strokeWidth: 1.2, strokeDasharray: '5 4', vectorEffect: 'non-scaling-stroke' }),
        areaPath ? h('path', { d: areaPath, fill: '#5b7cfa', fillOpacity: 0.08 }) : null,
        h('path', { d: pathOf(existingValues), fill: 'none', stroke: '#e0a53a', strokeWidth: 2, vectorEffect: 'non-scaling-stroke' }),
        h('path', { d: pathOf(sysValues), fill: 'none', stroke: '#5b7cfa', strokeWidth: 2, vectorEffect: 'non-scaling-stroke' }),
        simOn && (changedKeys.length || draft?.pending) ? h('path', { d: pathOf(simValues), fill: 'none', stroke: '#8b5cf0', strokeWidth: 2.2, strokeDasharray: '7 4', vectorEffect: 'non-scaling-stroke' }) : null,
        ...Array.from({ length: N }, (_, index) => {
          const left = index === 0 ? L : (px(index - 1) + px(index)) / 2; const right = index === N - 1 ? W - R : (px(index) + px(index + 1)) / 2;
          return h('rect', { key: `hit-${index}`, x: left, y: T, width: Math.max(1, right - left), height: plotH, fill: 'transparent', onPointerEnter: () => { if (!hoverLockRef.current && !dragRef.current) setHoverIndex(index); } });
        }),
        h('text', { x: L - 34, y: T - 8, fontSize: 12, fill: '#8a9099', pointerEvents: 'none' }, '天数'),
        ...yTicks.map((value) => h('text', { key: `y-${value}`, x: L - 12, y: py(value) + 4, textAnchor: 'end', fontSize: 11.5, fill: '#98a1ad', pointerEvents: 'none' }, value)),
        h('text', { x: px(todayIndex) + 4, y: T + 22, fontSize: 11, fill: '#333', pointerEvents: 'none' }, `今天 ${shortDate(new Date())}`),
        h('text', { x: W - R, y: py(SAFE_MAX_DAYS) - 5, textAnchor: 'end', fontSize: 11.5, fill: '#b06a00', pointerEvents: 'none' }, '安全上限 14 天 · 长期超出=备货偏多，砍最近批次'),
        h('text', { x: W - R, y: py(SAFE_MIN_DAYS) + 13, textAnchor: 'end', fontSize: 11.5, fill: '#c0392b', pointerEvents: 'none' }, '安全下限 7 天 · 跌破=断货风险'),
        ...V19_ACTIVITY_PERIODS.map((period) => {
          const year = startDate.getFullYear(); const start = indexOfDate(`${year}-${period.start}`); const end = indexOfDate(`${year}-${period.end}`);
          if (end <= 0 || start >= N - 1) return null;
          return h('text', { key: `activity-${period.name}`, x: px(Math.max(0, start)) + 3, y: T + 13, fontSize: 11, fill: '#b06a00', pointerEvents: 'none' }, period.name);
        }).filter(Boolean),
        ...ticks.map((index) => h('text', { key: `x-${index}`, x: px(index), y: H - 10, textAnchor: 'middle', fontSize: 11, fill: '#98a1ad', pointerEvents: 'none' }, shortDate(dates[index]))),
        ...laidOutNodes.flatMap((node) => {
          const locked = node.index === 0; const modified = changedKeys.includes(String(node.index)) || (draft?.pending && draft.index === node.index); const hasQty = numberValue(node.qty) > 0;
          const labelX = node.labelX == null ? node.x : node.labelX;
          const labelY = node.labelY == null ? Math.max(T + 16, node.y - (26 + (node.index % 3) * 14)) : node.labelY;
          const textStyle = { textAnchor: 'middle', paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.8, strokeLinejoin: 'round', pointerEvents: 'none' };
          return [
            node.displaced ? h('line', { key: `node-link-${node.index}`, x1: node.x, y1: node.y, x2: labelX, y2: labelY - 4, stroke: modified ? '#8b6cf0' : '#9aa6b2', strokeWidth: 1, strokeDasharray: '2 3', opacity: 0.72, pointerEvents: 'none' }) : null,
            node.displaced ? h('rect', { key: `node-label-bg-${node.index}`, x: labelX - labelWidth / 2, y: labelY - 16, width: labelWidth, height: labelHeight, rx: 5, fill: modified ? '#f6f3ff' : '#fff', stroke: modified ? '#8b6cf0' : '#d9dee7', strokeWidth: 1, opacity: 0.96, pointerEvents: 'none' }) : null,
            h('circle', { key: `node-dot-${node.index}`, cx: node.x, cy: node.y, r: hasQty ? 6.5 : 4.2, fill: modified ? '#f6f3ff' : hasQty ? '#fff' : '#f8fafc', stroke: modified ? '#8b6cf0' : locked ? '#b06a00' : '#5b7cfa', strokeWidth: hasQty ? 2.3 : 1.4, strokeDasharray: locked || modified ? undefined : '3 2', opacity: hasQty ? 1 : 0.45, pointerEvents: 'none' }),
            h('text', { key: `node-qty-${node.index}`, x: labelX, y: labelY, fill: modified ? '#5b3fc4' : locked ? '#8a5a00' : '#1f2329', fontSize: modified ? 12.6 : 12, fontWeight: 800, ...textStyle }, `W${node.index + 1} · ${fmt(node.qty)}${modified ? '*' : ''}`),
            h('text', { key: `node-date-${node.index}`, x: labelX, y: labelY + 14, fill: modified ? '#6b4fd0' : '#667085', fontSize: 10.5, fontWeight: 700, ...textStyle }, `入库 ${shortDate(node.sellable)}`),
          ].filter(Boolean);
        }),
        ),
      ...laidOutNodes.map((node) => {
        const info = batchInfo(node);
        const stateText = info?.stateKind === 'actual' ? ` · 实际 ${fmt(info.stateQty)} 台` : '';
        return h('button', {
          key: `node-${node.index}`, type: 'button', 'aria-label': `W${node.index + 1} · 系统建议 ${fmt(node.qty)} 台${stateText} · 物流到达 ${shortDate(node.arrival)} · 入仓 ${fmt(node.warehouseDays)} 天 · 入库 ${shortDate(node.sellable)}`, onPointerDown: (event) => startDrag(event, node),
          onPointerEnter: () => { if (!hoverLockRef.current && !dragRef.current) setHoverNode(node.index); }, onPointerLeave: () => { if (!dragRef.current) setHoverNode(null); },
          style: { position: 'absolute', left: xPercent(node.handleX == null ? node.x : node.handleX), top: yPercent(node.handleY == null ? node.y : node.handleY), width: node.handleWidth || 40, height: node.handleHeight || 40, transform: 'translate(-50%,-50%)', zIndex: 5, padding: 0, border: 0, outline: 'none', background: 'transparent', cursor: dragging?.index === node.index ? 'grabbing' : 'grab', touchAction: 'none' },
        });
      }),
      hover ? h(React.Fragment, null,
        h('span', { style: { position: 'absolute', left: xPercent(hover.x), top: yPercent(T), bottom: yPercent(B), zIndex: 3, borderLeft: '1px dashed #98a1ad', pointerEvents: 'none' } }),
        h('div', { style: { position: 'absolute', ...(hover.x / W > 0.72 ? { right: 12 } : { left: `calc(${xPercent(hover.x)} + 9px)` }), top: 32, zIndex: 6, width: 390, maxWidth: 'calc(100% - 24px)', boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', borderRadius: 6, padding: '9px 11px', background: 'rgba(31,35,41,.92)', color: '#fff', fontSize: 12, lineHeight: 1.55, pointerEvents: 'none', boxShadow: '0 5px 16px rgba(0,0,0,.18)' } },
          h('div', { style: { fontWeight: 800 } }, shortDate(hover.date)),
          h('div', { style: { color: '#dce6ff' } }, `水位表可撑 ${v19CoverText(hover.sys, hover.sysLowerBound)} 天 · 销售可撑 ${v19CoverText(hover.existing, hover.existingLowerBound)} 天`),
          h('div', { style: { marginTop: 6, color: '#9db7ff', fontWeight: 800 } }, '蓝线 · 系统曲线'),
          ...hoverSystemLines.map((line, index) => h('div', { key: `sys-calc-${index}`, style: { color: '#dce6ff' } }, line)),
          h('div', { style: { marginTop: 6, color: '#f4cf8a', fontWeight: 800 } }, '黄线 · 销售曲线'),
          ...hoverSaleLines.map((line, index) => h('div', { key: `sale-calc-${index}`, style: { color: '#f7dfb2' } }, line)))) : null,
      hoveredBatch ? h('div', { style: { position: 'absolute', ...(hoveredBatch.x / W > 0.76 ? { right: 12 } : { left: `calc(${xPercent(hoveredBatch.x)} + 12px)` }), ...(hoveredBatch.y / H > 0.52 ? { bottom: `calc(${Math.max(5, 100 - hoveredBatch.y / H * 100)}% + 14px)` } : { top: `calc(${Math.max(5, hoveredBatch.y / H * 100)}% + 14px)` }), zIndex: 6, width: 330, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 20px)', overflowY: 'auto', boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', padding: '9px 11px', borderRadius: 7, background: 'rgba(31,35,41,0.94)', color: '#fff', fontSize: 12, lineHeight: 1.55, pointerEvents: 'none', boxShadow: '0 6px 22px rgba(0,0,0,.28)' } },
        h('b', null, `W${hoveredBatch.index + 1} · ${shortDate(hoveredBatch.week.start)}~${shortDate(hoveredBatch.week.end)}${hoveredBatch.index === 0 ? ' 🔒' : ''}`),
        ...renderBatchBase(hoveredBatchInfo, { dark: true }),
        renderBatchState(hoveredBatchInfo, { dark: true })) : null),
    h('div', { style: { margin: '6px 0 0 40px', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#5a6169' } },
      h('span', null, h('i', { style: { display: 'inline-block', width: 18, borderTop: '2px solid #5b7cfa', marginRight: 5, verticalAlign: 'middle' } }), '水位表库存 + 系统建议入库 + 预估销量·真实可撑天数'),
      h('span', null, h('i', { style: { display: 'inline-block', width: 18, borderTop: '2px solid #e0a53a', marginRight: 5, verticalAlign: 'middle' } }), hasSaleForecastLine ? '销售预估库存 + 销售预估销量·真实可撑天数' : '销售预估库存 + 销售预估销量·真实可撑天数(未填,黄线不显示)'),
      h('span', null, h('i', { style: { display: 'inline-block', width: 18, borderTop: '2px dashed #c0392b', marginRight: 5, verticalAlign: 'middle' } }), '7/14 天安全线'),
      h('span', null, h('b', { style: { color: '#1a5fb4' } }, '✈'), '=活动前置建议(悬停看详情)'),
        h('span', null, '◌ W节点=到货日期 · 模拟货量从到货日影响曲线'),
      h('span', { style: { color: '#b06a00' } }, '▨ 活动日区间'),
      simOn && (changedKeys.length || draft?.pending) ? h('span', null, h('i', { style: { display: 'inline-block', width: 18, borderTop: '2px dashed #8b5cf0', marginRight: 5, verticalAlign: 'middle' } }), '模拟线') : null),
    selected ? h('div', { style: {
      position: 'absolute', zIndex: 8,
      ...(selected.x / W > 0.78 ? { right: 20 } : { left: `${Math.max(1, Math.min(76, selected.x / W * 100 - 10))}%` }),
      ...(selected.y / H > 0.55 ? { bottom: `calc(${Math.max(5, 100 - selected.y / H * 100)}% + 16px)` } : { top: `calc(${Math.max(5, selected.y / H * 100)}% + 16px)` }),
      width: 322, maxWidth: 'calc(100% - 40px)', boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', background: '#fff', border: '1.5px solid #8b6cf0', borderRadius: 10,
      boxShadow: '0 10px 34px rgba(30,20,80,.24)', padding: '11px 13px', fontSize: 12, color: '#3a4763',
    } },
      h('div', { style: { display: 'flex', alignItems: 'center', marginBottom: 7, fontSize: 13 } },
        h('b', { style: { color: '#1f2329' } }, `W${selected.index + 1} 批发`),
        h('span', { style: { marginLeft: 7, fontWeight: 400, color: '#8a9099', fontSize: 11 } }, `发货 ${shortDate(selected.week.start)}`),
        selected.index === 0 ? h('span', { style: { marginLeft: 7, fontSize: 10.5, color: '#9c6a06', background: '#fff6de', borderRadius: 4, padding: '1px 6px' } }, '🔒 W1 已锁定') : null,
        h(Button, { type: 'text', size: 'small', onClick: closeNodePanel, style: { marginLeft: 'auto', padding: '0 5px', minWidth: 28, color: '#98a1ad' } }, '✕')),
      ...renderBatchBase(selectedInfo, {
        channelNode: h(Select, { size: 'small', value: selected.channel, disabled: !nodeEditable(selected) || !channelOptions?.length, onChange: (value) => editDraft(selected.index, { channel: value }), options: channelOptions || [], style: { width: 220, maxWidth: '100%' } }),
      }),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '影响'), `拖动只影响建议量，约 +${fmt(selected.qty / fallbackDaily, 1)} 天安全库存`),
      draft?.pending || changedKeys.includes(String(selected.index)) ? h('div', { style: { marginTop: 7, padding: '6px 9px', borderRadius: 6, background: '#eef4ff', color: '#1d3f8f', fontSize: 11.5, lineHeight: 1.6 } }, `拖动视觉预览：超上限 ${baseMetric.over} → ${simMetric.over} 天 · 最低 ${fmt(baseMetric.min, 1)} → ${fmt(simMetric.min, 1)} 天。是否免审、最终曲线与写回值由服务端工作流重算。`) : null,
      h('div', { style: { marginTop: 7, fontSize: 11, color: '#6a7280', lineHeight: 1.55 } }, !nodeEditable(selected) ? `${V19_ROLE_NAME[role]}视角只读或该节点已锁定。` : '上下拖数量，左右拖时间；点击后可精确选择渠道。'),
      renderBatchState(selectedInfo),
      h('div', { style: { display: 'flex', gap: 8, marginTop: 9 } },
        draft?.pending ? v19Button('✓ 确认此改动', confirmDraft, 'blue') : changedKeys.includes(String(selected.index)) ? v19Button('→ 转为修改申请', applyAll, 'blue') : null,
        changedKeys.includes(String(selected.index)) || draft?.pending ? v19Button(draft?.pending ? '↩ 还原' : '↩ 还原此格', () => resetNode(selected.index)) : null)) : null);
}

function V19EditModal({ target, loading, onClose, onSubmit }) {
  const [type, setType] = useState('up'); const [qty, setQty] = useState(0); const [channel, setChannel] = useState(''); const [reasonType, setReasonType] = useState('秒杀排期'); const [reason, setReason] = useState('');
  useEffect(() => { if (target) { setType(target.type || 'up'); setQty(numberValue(target.qty, target.weekIndex == null ? 0 : v19WeekValue(target.row, target.weekIndex, target.changes || {}))); setChannel(target.currentChannel || ''); setReasonType('秒杀排期'); setReason(''); } }, [target]);
  if (!target) return null;
  const bundle = Array.isArray(target.bundle) ? target.bundle : null;
  if (bundle) {
    const blocked = bundle.filter((item) => item.weekIndex === 0);
    return h(Modal, { title: '✏ 模拟转修改申请', open: true, onCancel: onClose, footer: null, width: 620 },
      h('div', { style: { padding: '9px 11px', borderRadius: 7, background: '#f6f3ff', border: '1px solid #d9cef7', color: '#4b2fb0', fontSize: 12.5, lineHeight: 1.65, marginBottom: 10 } },
        h('b', null, `${target.row.product.model || '-'} · ${target.row.product.country || '-'}　模拟证据（自动带入 · 只读）`),
        h('div', null, target.evidence),
        h('div', { style: { color: '#c0392b', fontWeight: 700 } }, '补充说明必填：模拟只说明“改了会怎样”，审核需要说明“为什么要改”。')),
      h('div', { style: { border: '1px solid #e4e8ef', borderRadius: 8, overflow: 'hidden', marginBottom: 10 } },
        ...bundle.map((item) => h('div', { key: item.weekIndex, style: { display: 'grid', gridTemplateColumns: '58px 1fr 1.1fr 90px', gap: 8, alignItems: 'center', padding: '7px 10px', borderBottom: item === bundle[bundle.length - 1] ? 'none' : '1px solid #eef1f5', fontSize: 12 } },
          h('b', { style: { color: '#3370ff' } }, `W${item.weekIndex + 1}`),
          h('span', null, `${V19_CHANGE_MARK[item.type]} ${V19_CHANGE_LABEL[item.type]}　${fmt(item.from)} → ${fmt(item.to)} 台`),
          h('span', { style: { color: '#5a6169' } }, `${item.channel} · 到货 ${shortDate(item.arrival)} · 可售 ${shortDate(item.sellable)}`),
          h('span', { style: { color: '#1d3f8f', fontWeight: 700 } }, item.weekIndex === 0 ? '已锁定' : '提交后服务端判闸')))),
      blocked.length ? h('div', { style: { padding: '7px 9px', background: '#fdf0ef', border: '1px solid #e8998f', color: '#9c3b32', borderRadius: 6, fontSize: 12, marginBottom: 9 } }, `W1 已锁定：请回到趋势图还原 W${blocked.map((item) => item.weekIndex + 1).join('、W')} 后再提交。`) : null,
      h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '理由类型'), h(Select, { value: reasonType, onChange: setReasonType, options: ['秒杀排期', '断货救急', '需求下修', '活动取消', '其他'].map((value) => ({ value, label: value })), style: { width: '100%' } })),
      h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '补充说明 ', h('span', { style: { color: '#c0392b' } }, '* 必填')), h(Input.TextArea, { rows: 4, value: reason, onChange: (event) => setReason(event.target.value), placeholder: '例：秒杀排期确认、活动取消、需求下修、FBA 即将断货……' })),
      h('div', { style: { display: 'flex', gap: 8 } }, h(Button, { type: 'primary', loading, disabled: !reason.trim() || blocked.length > 0, onClick: () => onSubmit({ bundle, evidence: target.evidence, reasonType, reason: reason.trim() }), style: { flex: 1, fontWeight: 800 } }, `提交 ${bundle.length} 周修改申请`), h(Button, { onClick: onClose }, '取消')),
      h('div', { style: { marginTop: 8, fontSize: 10.5, color: '#98a1ad' } }, '每一周分别按 W1 锁定、W2–W5、W6–W7 的权限与安全区间闸进入对应流程。'));
  }
  const base = v19WeekValue(target.row, target.weekIndex, target.changes || {});
  const w1Blocked = target.weekIndex === 0;
  const gate = target.weekIndex === 0 ? 'W1 已锁定：本周不允许修改。'
    : target.weekIndex >= 5 ? 'W6–W7 下单异议：提交后由服务端按 v2 水位重算；区间内免审，出界走销售→采购→终审。'
      : 'W2–W5：提交后由服务端按 v2 水位重算；区间内免审，出界走主管+采购审核。';
  return h(Modal, { title: '✏ 修改申请', open: true, onCancel: onClose, footer: null, width: 430 },
    h('div', { style: { fontSize: 12, color: '#3a4763', background: '#f5f7fb', borderRadius: 6, padding: '6px 8px', marginBottom: 10 } }, `${target.row.product.model || '-'} · ${target.row.product.country} · W${target.weekIndex + 1} · 当前 ${fmt(base)} 台`),
    h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '修改方式'), h(Select, { value: type, onChange: setType, options: [{ value: 'up', label: '↑ 加发 / 上调数量' }, { value: 'down', label: '↓ 减发 / 下调数量' }, { value: 'air', label: '✈ 改运输方式（按站点真实配置）' }], style: { width: '100%' } })),
    type !== 'air' ? h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '新数量'), h(InputNumber, { min: 0, value: qty, onChange: setQty, style: { width: '100%' } })) : null,
    type === 'air' ? h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '新运输方式'), h(Select, { value: channel, onChange: setChannel, options: target.channelOptions || [], placeholder: '选择该站点已配置渠道', style: { width: '100%' } })) : null,
    h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '理由类型'), h(Select, { value: reasonType, onChange: setReasonType, options: ['秒杀排期', '断货救急', '需求下修', '活动取消', '其他'].map((value) => ({ value, label: value })), style: { width: '100%' } })),
    h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '补充说明 ', h('span', { style: { color: '#c0392b' } }, '* 必填（加发 / 减发都必须写）')), h(Input.TextArea, { rows: 3, value: reason, onChange: (event) => setReason(event.target.value), placeholder: '例：秒杀排期确认、FBA 5 天内断货、需求下修、活动取消…' })),
    h('div', { style: { fontSize: 11, color: '#1d3f8f', background: '#eef4ff', border: '1px solid #bcd2ff', borderRadius: 6, padding: '6px 8px', marginBottom: 8, lineHeight: 1.55 } }, '安全区间 7–14 天；页面不自行套公式，最终结果以提交工作流服务端重算为准。'),
    h('div', { style: { fontSize: 11, color: '#7a4d00', background: '#fff8e6', border: '1px solid #f0c36d', borderRadius: 6, padding: '6px 8px', marginBottom: 10, lineHeight: 1.55 } }, gate),
    h('div', { style: { display: 'flex', gap: 8 } }, h(Button, { type: 'primary', loading, disabled: w1Blocked || !reason.trim() || (type === 'air' && (!channel || channel === target.currentChannel)), onClick: () => onSubmit({ type, to: type === 'air' ? base : numberValue(qty), channel, reasonType, reason: reason.trim() }), style: { flex: 1, fontWeight: 800 } }, w1Blocked ? 'W1 已锁定' : '提交申请'), h(Button, { onClick: onClose }, '取消')),
    h('div', { style: { marginTop: 8, fontSize: 10.5, color: '#98a1ad', lineHeight: 1.5 } }, '提交后：格子标 ⏳ 待审 · 顶部出现「销售提交的修改需求需要审核」· 对应审核角色收件箱 +1'));
}

function V19ChangeDrawer({ detail, role, changes, auditNote, onAuditNote, onClose, onEdit, onAction }) {
  if (!detail) return null;
  const { row, weekIndex } = detail; const key = v19ChangeKey(row.key, weekIndex); const change = changes[key]; const week = row.weeks[weekIndex]; const status = change?.status || 'ok';
  const suggestQty = v19WeekValue(row, weekIndex, changes);
  const weekState = v19WeekState(row, weekIndex);
  const baseline = week.baseline;
  const planSourceText = [
    week.rows.some((item) => item.plan_source === PLAN_SOURCE) ? '系统建议' : '',
    weekState ? '实际计划（当前 W1 起）' : '',
  ].filter(Boolean).join(' + ') || '无计划';
  const stateSourceText = weekState
    ? week.actualPlanRows.map((item) => `${item.shop || '-'}·发货${shortDate(item.date)}·${item.channel || '-'}·${fmt(item.number)}台`).join('、')
    : '';
  const suggestSourceText = week.rows.map((item) => `${item.shop || '-'}·${item.channel || '-'}·${fmt(item.number)}台`).join('、');
  const timeline = v19TimelineFor(row, weekIndex, change); const style = V19_STATUS_STYLE[status];
  const statusBody = status === 'sub' ? '🟣 工作流处理中 —— 服务端正在校验、判闸或应用计划'
    : status === 'yel' ? '🟡 待销售确认 —— 系统重算动过此格（例外格）'
    : status === 'org' ? '🟠 待主管审（真实性）· 截止周三 18:00（剩 26h）· 超时不放行 → 升级 Ailah 留痕'
      : status === 'ops' ? '🔵 待采购审（可执行性）' : status === 'fin' ? '🟣 待终审 —— 已过前置审核，随本期 PO 在聚合面板一并终审（S5）'
        : status === 'rej' ? `⛔ 已驳回 —— ${change?.rejectBy || ''}意见：「${change?.rejectReason || ''}」` : `✅ ${change ? '已生效' : '当前计划已生效'}`;
  return h(Drawer, { title: `${row.product.model || '-'} · ${row.product.country} · W${weekIndex + 1} 发货变动`, open: true, onClose, width: 560 },
    h('div', { style: { fontSize: 13.5, fontWeight: 700, margin: '6px 0 8px', paddingLeft: 9, borderLeft: '3px solid #3370ff' } }, '发货计划与推算'),
    h('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: 12.5 } }, h('tbody', null,
      ...[['ASIN', row.product.asin], ['发货周次', `W${weekIndex + 1} · ${shortDate(week.start)}~${shortDate(week.end)}`], ['系统建议', `${fmt(suggestQty)} 台`], ['上周建议', baseline ? `${fmt(baseline.systemSuggestQty)} 台（${dateText(baseline.runMonday)} 版本）` : '无上周基线'], ['上周人工确认', baseline?.hasApproved ? `${fmt(baseline.approvedQty)} 台${baseline.approvedChannel ? ` · ${baseline.approvedChannel}` : ''}` : baseline ? '上周未人工改动' : '无上周基线'], ['覆盖售卖期', `${shortDate(week.coverStart)}~${shortDate(week.coverEnd)}`], ['计划来源', planSourceText], ['建议明细/渠道', suggestSourceText || '-'], ...(weekState ? [[`${weekState.label}明细`, stateSourceText || '-']] : [])].map((item) => h('tr', { key: item[0] }, h('td', { style: { border: '1px solid #d4dae3', padding: '6px 11px', background: '#dde4ee', fontWeight: 700, color: '#3a4763', width: 96 } }, item[0]), h('td', { style: { border: '1px solid #d4dae3', padding: '6px 11px' } }, item[1]))))),
    h('div', { style: { fontSize: 13.5, fontWeight: 700, margin: '18px 0 8px', paddingLeft: 9, borderLeft: '3px solid #3370ff' } }, '建议数量计算'),
    v19SuggestionCalculation(row, week),
    h('div', { style: { fontSize: 13.5, fontWeight: 700, margin: '18px 0 8px', paddingLeft: 9, borderLeft: '3px solid #3370ff' } }, '覆盖售卖期计算'),
    v19CoverageCalculation(week),
    h('div', { style: { fontSize: 13.5, fontWeight: 700, margin: '18px 0 8px', paddingLeft: 9, borderLeft: '3px solid #e09c1e' } }, '修改申请 ', h('span', { style: { fontWeight: 400, fontSize: 11.5, color: '#8a9099' } }, '推导与验算已并入趋势行（参数卡 + 曲线 + 模拟）—— 回表展开该行即见')),
    h('div', { style: { display: 'inline-block', padding: '5px 10px', borderRadius: 7, fontSize: 12.5, fontWeight: 800, marginBottom: 7, background: style.bg, border: `1px solid ${style.border}`, color: style.color } }, statusBody),
    change ? h('div', { style: { border: '1px solid #e8912a', background: '#fffaf3', borderRadius: 8, padding: '8px 10px', marginBottom: 8, fontSize: 12.5 } },
      h('b', { style: { color: '#9c4a00' } }, '销售提交的申请内容'), h('div', { style: { marginTop: 5 } }, `${V19_CHANGE_MARK[change.type]} ${V19_CHANGE_LABEL[change.type]}　${fmt(change.from)} → ${fmt(change.to)} 台`), h('div', null, `理由：${change.reasonType}：${change.reason}`), h('div', { style: { color: '#8a9099' } }, `提交：${change.by} · ${change.at}`)) : null,
    status !== 'ok' || !change ? h('div', { style: { marginTop: 10, background: '#f7f9fc', border: '1px solid #e1e7ef', borderRadius: 8, padding: '10px 12px' } },
      h('div', { style: { fontSize: 11.5, color: '#5a6169', lineHeight: 1.6, marginBottom: 8 } }, status === 'yel' ? '销售查事实：数字与业务对不对。确认即承诺；要改必须写理由。' : status === 'org' ? '主管审真实性：活动是否真实、值不值这个量。' : status === 'ops' ? '采购审可执行性：MOQ / 物流舱位 / 下厂交期。' : status === 'fin' ? '终审在顶部「本期 PO 聚合」面板操作。' : '可修改后再次提交，或维持系统值直接确认。'),
      (status === 'org' || status === 'ops' || status === 'rej') ? h(Input.TextArea, { value: auditNote, onChange: (event) => onAuditNote(event.target.value), rows: 2, placeholder: status === 'rej' ? '修改补充说明' : '审核意见 / 批注（驳回时必填）', style: { marginBottom: 8 } }) : null,
      h('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
        status === 'yel' && role === 'sale' ? v19Button('✓ 确认无误', () => onAction(key, 'confirm'), 'pass') : null,
        (status === 'yel' || status === 'rej' || status === 'ok') && role === 'sale' ? v19Button('✏ 修改申请', () => onEdit(row, weekIndex), 'blue') : null,
        status === 'org' && role === 'lead' ? v19Button('真实性通过 → 转采购', () => onAction(key, 'leadPass'), 'pass') : null,
        status === 'org' && role === 'lead' ? v19Button('驳回（意见必填）', () => onAction(key, 'reject'), 'reject', !auditNote.trim()) : null,
        status === 'org' && role === 'sale' ? v19Button('↩ 撤回申请', () => onAction(key, 'withdraw'), 'ghost') : null,
        status === 'ops' && role === 'ops' ? v19Button(change?.needFinal ? '可执行性通过 → 转终审' : '可执行性通过', () => onAction(key, 'opsPass'), 'pass') : null,
        status === 'ops' && role === 'ops' ? v19Button('驳回（意见必填）', () => onAction(key, 'reject'), 'reject', !auditNote.trim()) : null,
        status === 'ops' && role === 'ops' ? v19Button('📌 加批注', () => onAction(key, 'note'), 'ghost', !auditNote.trim()) : null)) : null,
    h('div', { style: { fontSize: 13.5, fontWeight: 700, margin: '18px 0 8px', paddingLeft: 9, borderLeft: '3px solid #3370ff' } }, '历史时间线 ', h('span', { style: { fontWeight: 400, fontSize: 11.5, color: '#8a9099' } }, '从早到晚 · 橙点 = 最新')),
    h('div', { style: { marginLeft: 6 } }, ...timeline.map((item, index) => h('div', { key: index, style: { position: 'relative', padding: '0 0 14px 22px', borderLeft: index === timeline.length - 1 ? '2px solid transparent' : '2px solid #e1e6ee' } },
      h('span', { style: { position: 'absolute', left: -7, top: 1, width: 12, height: 12, borderRadius: '50%', background: index === timeline.length - 1 ? '#fff3df' : '#fff', border: `2px solid ${index === timeline.length - 1 ? '#e8912a' : item.kind === 'sys' ? '#9333ea' : '#1366d6'}` } }),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12 } }, h('b', { style: { color: item.kind === 'sys' ? '#7c3aed' : '#1366d6' } }, item.who), h('span', { style: { fontSize: 10.5, fontWeight: 700, borderRadius: 8, padding: '1px 7px', background: item.kind === 'sys' ? '#f3e9fc' : '#e6efff', color: item.kind === 'sys' ? '#7c3aed' : '#1d5fc4' } }, item.label), h('span', { style: { color: '#8a9099', fontSize: 11 } }, item.when), h('span', { style: { marginLeft: 'auto', fontSize: 10.5, fontWeight: 700 } }, item.status)),
      h('div', { style: { fontSize: 12, marginTop: 3 } }, `${fmt(item.from)} → ${fmt(item.to)} 台`), h('div', { style: { fontSize: 11.5, color: '#5a6169', marginTop: 2, lineHeight: 1.55 } }, item.reason)))));
}

function V19BatchModal({ open, rows, changes, signed, onClose, onSign, onOpenDetail, onAction }) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const items = [];
  rows.forEach((row) => row.weeks.forEach((week, index) => { const change = changes[v19ChangeKey(row.key, index)]; if (change && change.status !== 'ok') items.push({ row, index, change }); }));
  const notices = rows.filter((row) => v19Warning(row) || v19LifeName(row) === '新品期').map((row) => ({ row, warning: v19Warning(row), newProduct: v19LifeName(row) === '新品期' }));
  const excluded = items.filter((item) => item.change.status === 'rej').length; const checked = items.filter((item) => ['ops', 'fin', 'ok'].includes(item.change.status)).length;
  const groups = rows.reduce((result, row) => { const name = row.product.sale_owner || '未分配'; (result[name] ||= []).push(row); return result; }, {});
  return h(Modal, { title: '📋 本期批次签核 · 全团队（团队一批 · S4）', open, onCancel: onClose, footer: null, width: 860 },
    h('div', { style: { display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11.5, color: '#5a6169', marginBottom: 8 } }, h('span', null, '周期 7/6~7/17 · 下单周'), h('span', { style: { fontWeight: 700, background: '#fdf1e3', color: '#b06a00', border: '1px solid #e8b45a', borderRadius: 6, padding: '3px 10px' } }, '⏰ 截止周三 18:00 · 剩 26h · 超时不放行 → 升级 Ailah 留痕')),
    h('div', { style: { padding: '7px 12px', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', background: '#fdf4f0', color: '#b05a1e' } }, '第一层 · 必看项 —— 逐条判断，可行内打回（打回即排除本批次、回销售待办，不阻塞签核 S4-3）'),
    items.length || notices.length ? h(React.Fragment, null,
      ...items.map((item) => {
        const key = v19ChangeKey(item.row.key, item.index);
        return h('div', { key, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: '1px solid #eef1f5', fontSize: 12.5, flexWrap: 'wrap' } },
          h('span', { style: { fontSize: 11, fontWeight: 800, borderRadius: 5, padding: '1px 8px', background: item.change.status === 'rej' ? '#fbe9e7' : '#fdeee0', color: item.change.status === 'rej' ? '#b03a2e' : '#9c4a00' } }, item.change.status === 'rej' ? '已打回' : '销售改过'),
          h('b', null, `${item.row.product.model} · ${item.row.product.country} · W${item.index + 1}`),
          h('span', { style: { color: '#5a6169' } }, `${fmt(item.change.from)} → ${fmt(item.change.to)}（${V19_STATUS_TEXT[item.change.status]}）· ${item.change.reason}`),
          item.change.status === 'org' && !signed ? v19Button('真实性通过', () => onAction(key, 'leadPass'), 'pass', false, { marginLeft: 'auto' }) : null,
          v19Button(item.change.status === 'org' ? '点开 / 打回' : '点开链路', () => onOpenDetail(item.row, item.index), 'ghost', false, item.change.status === 'org' ? {} : { marginLeft: 'auto' }));
      }),
      ...notices.map((item) => h('div', { key: `notice-${item.row.key}`, style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #eef1f5', fontSize: 12.5 } },
        h('span', { style: { fontSize: 11, fontWeight: 800, borderRadius: 5, padding: '1px 8px', background: item.warning ? '#fff1dc' : '#e6efff', color: item.warning ? '#a75d00' : '#1d5fc4' } }, item.warning ? '黄/红预警' : '新品期'),
        h('b', null, `${item.row.product.model} · ${item.row.product.country}`),
        h('span', { style: { color: '#5a6169' } }, item.warning ? '安全库存或库销比预警 · 主管必须知会' : '新品期 ASIN · 0 容忍、不套健康区间闸 · 知会项')))) : h('div', { style: { padding: 12, color: '#5a6169' } }, '本期无必看项'),
    h('div', { style: { padding: '7px 12px', fontSize: 11.5, fontWeight: 800, letterSpacing: '0.08em', background: '#f4f7fb', color: '#5a6a80' } }, '第二层 · 扫一眼项 —— 一键确认的常规格，按销售人分组（诊断价值留在视图层 S4-2）'),
    ...Object.keys(groups).flatMap((name) => [
      h('div', { key: name, onClick: () => setExpandedGroups((current) => ({ ...current, [name]: !current[name] })), style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderBottom: '1px solid #eef1f5', background: '#fbfcfe', fontSize: 12, color: '#5a6169', cursor: 'pointer' } }, h('b', { style: { color: '#1f2329' } }, name), `${groups[name].length} 个 ASIN · 首周合计 ${fmt(groups[name].reduce((sum, row) => sum + v19WeekValue(row, 5, changes), 0))} 台`, h('span', { style: { marginLeft: 'auto', color: '#7b8797' } }, expandedGroups[name] ? '▾ 收起' : '▸ 展开')),
      expandedGroups[name] ? h('div', { key: `${name}-rows`, style: { padding: '8px 28px', background: '#f7f9fc', borderBottom: '1px solid #e8edf3', fontSize: 11.5, color: '#5a6169', lineHeight: 1.8 } }, ...groups[name].map((row) => h('div', { key: row.key }, `${row.product.model} · ${row.product.country} · W6 首周 ${fmt(v19WeekValue(row, 5, changes))} 台 · 一键确认`))) : null,
    ]),
    h('div', { style: { padding: '12px', background: '#f7f9fc', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' } }, h('span', { style: { fontSize: 12, color: '#5a6169' } }, `签核范围 ${rows.length} 个 ASIN · 已逐条核 ${checked} 项 · 排除 ${excluded} 项（未闭环 → 不进本期 PO，销售处理后走补充确认）`), signed ? h('b', { style: { marginLeft: 'auto', color: '#0e5c32' } }, `✓ 已签核 N${signed.n}/M${signed.m}/X${signed.x} · ${signed.at} · 留痕`) : v19Button('批次签核工作流尚未启用', null, 'ghost', true, { marginLeft: 'auto' })));
}

function V19FinalPanel({ rows, changes, signed, poGenerated, approved, onApprove, onOpenDetail }) {
  const net = rows.reduce((sum, row) => sum + v19NetOf(row, changes).net, 0); const reds = [];
  rows.forEach((row) => row.weeks.forEach((week, index) => { const change = changes[v19ChangeKey(row.key, index)]; if (change?.needFinal && change.status !== 'ok') reds.push({ row, index, change }); }));
  const can = reds.length > 0 && reds.every((item) => item.change.status === 'fin') && !approved;
  return h('div', { style: { border: '2px solid #8b6cf0', borderRadius: 11, background: '#fbfaff', marginBottom: 12, overflow: 'hidden' } },
    h('div', { style: { padding: '11px 16px', background: '#f3efff', borderBottom: '1px solid #ddd2f5', display: 'flex', alignItems: 'center', gap: 12, fontWeight: 800, fontSize: 14, color: '#3b2496', flexWrap: 'wrap' } }, '本期 PO 聚合 · 全站点合并', h('span', { style: { fontSize: 11.5, fontWeight: 400, color: '#7a68b8' } }, 'PO-2026-0714 · = 首周承诺 + 次周新排 − 未交货余量'), approved ? h('span', { style: { marginLeft: 'auto', fontSize: 13, fontWeight: 800, color: '#0e5c32', background: '#e9f7ee', border: '1px solid #6cc08b', borderRadius: 7, padding: '7px 13px' } }, '✅ PO 已通过 · 下单不可取消（决策 19）· 采购发合同下厂') : null),
    h('div', { style: { display: 'flex', gap: 26, padding: '10px 16px', flexWrap: 'wrap', fontSize: 12.5, borderBottom: '1px solid #eee8fa' } }, ...[['需下单净额合计', `${fmt(net)} 台`], ['涉及 ASIN', rows.length], ['金额（仅终审+主管可见 · 2.9.5③）', `$${fmt(net * 43)}`], ['主管批次签核', signed ? `✓ N${signed.n}/M${signed.m}/X${signed.x}` : '⏳ 未签核'], ['PO 草案（采购生成）', poGenerated ? '✓ 已生成 → 执行看板' : '⏳ 待生成']].map((item) => h('span', { key: item[0] }, h('span', { style: { color: '#7a68b8' } }, `${item[0]} `), h('b', { style: { fontSize: 15 } }, item[1])))),
    h('div', { style: { padding: '8px 16px', borderBottom: '1px solid #eee8fa' } }, reds.length ? reds.map((item) => h('div', { key: v19ChangeKey(item.row.key, item.index), style: { display: 'flex', alignItems: 'center', gap: 9, fontSize: 12.5, margin: '4px 0', flexWrap: 'wrap' } }, h('span', { style: { fontSize: 11, fontWeight: 800, background: '#fbe9e7', color: '#b03a2e', borderRadius: 5, padding: '1px 8px' } }, '标红'), `${item.row.product.model} ${item.row.product.country} · ${V19_CHANGE_LABEL[item.change.type]} · ${V19_STATUS_TEXT[item.change.status]}`, v19Button('点开链路', () => onOpenDetail(item.row, item.index)))) : h('div', { style: { color: '#5a6169' } }, '本期无标红项')),
    h('div', { style: { padding: '11px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' } }, approved ? null : v19Button('通过全部待终审申请', onApprove, 'blue', !can), approved ? null : v19Button('个别调整（仅标红项）', null, 'ghost', true), h('span', { style: { fontSize: 11.5, color: '#7a68b8', width: '100%', lineHeight: 1.6 } }, `按钮只处理真实状态为“待终审”的申请；主管、采购、锁状态与乐观锁均由审核工作流服务端再次校验。${approved ? '' : can ? '' : ' 当前没有可终审申请，按钮置灰。'}`)));
}

function v19DaysBetween(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);
  return start && end ? Math.round((end - start) / 86400000) : null;
}

function v19ParseCalculationSnapshot(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch (error) { return null; }
}

function v19SuggestionCalculation(row, week) {
  const plans = week?.rows || [];
  if (!plans.length) return h('div', { style: { padding: '9px 11px', background: '#f7f9fc', color: '#8a9099', fontSize: 12, borderRadius: 6 } }, '该周没有建议计划。');
  const hasHistoricalPlan = plans.some((plan) => !v19ParseCalculationSnapshot(plan.v2_calculation_snapshot));
  return h('div', { style: { fontSize: 12, color: '#3a4763', lineHeight: 1.7 } },
    hasHistoricalPlan ? h('div', { style: { marginBottom: 8, padding: '7px 10px', background: '#fff8e6', border: '1px solid #f0c36d', borderRadius: 6, color: '#7a4d00' } }, '历史计划未保存完整计算明细，无法准确还原当时的到货日倒推和执行约束过程。') : null,
    ...plans.map((plan, index) => {
      const snapshot = v19ParseCalculationSnapshot(plan.v2_calculation_snapshot);
      const title = plans.length > 1 ? `计划 ${index + 1} · ${fmt(plan.number)} 台` : `建议 ${fmt(plan.number)} 台`;
      if (snapshot) {
        const detail = snapshot.recalculation || snapshot.arrival_calculation || null;
        const constraint = snapshot.constraint_layer || {};
        const orderWeek = !detail && snapshot.cycle_phase === 'ORDER_WEEK';
        const serviceDemand = numberValue(detail?.coverage_demand_7d ?? (orderWeek ? snapshot.second_week_demand : snapshot.first_week_demand), NaN);
        const rawGap = numberValue(detail?.raw_new_number_before_constraint ?? snapshot.raw_suggested_number_before_constraint ?? constraint.qty_before_constraint ?? snapshot.gap_before_ceiling, NaN);
        const priorSurplus = numberValue(detail?.prior_constraint_surplus ?? snapshot.prior_constraint_surplus ?? constraint.prior_constraint_surplus, 0);
        const adjustedGapSnapshot = numberValue(detail?.adjusted_gap_after_prior_surplus ?? snapshot.adjusted_gap_after_prior_surplus ?? constraint.adjusted_gap_after_prior_surplus, NaN);
        const theoreticalGap = Number.isFinite(rawGap) ? Math.max(0, rawGap) : NaN;
        const adjustedGap = Number.isFinite(adjustedGapSnapshot)
          ? Math.max(0, adjustedGapSnapshot)
          : Number.isFinite(theoreticalGap) ? Math.max(0, theoreticalGap - priorSurplus) : NaN;
        const unitsPerBox = numberValue(detail?.constraint_units_per_box ?? snapshot.constraint_units_per_box ?? constraint.units_per_box, NaN);
        const minShipQty = numberValue(detail?.constraint_min_ship_qty ?? snapshot.constraint_min_ship_qty ?? constraint.min_ship_qty, 0);
        const storedBoxedQty = numberValue(constraint.qty_boxed_after_prior_surplus ?? constraint.qty_boxed, NaN);
        const boxedQty = Number.isFinite(storedBoxedQty) ? storedBoxedQty
          : Number.isFinite(adjustedGap)
            ? (adjustedGap <= 0 ? 0 : Number.isFinite(unitsPerBox) && unitsPerBox > 0 ? Math.ceil(adjustedGap / unitsPerBox) * unitsPerBox : adjustedGap)
            : NaN;
        const effectiveMinQty = numberValue(constraint.min_qty_effective, Number.isFinite(unitsPerBox) && unitsPerBox > 0 && minShipQty > 0
          ? Math.ceil(minShipQty / unitsPerBox) * unitsPerBox : minShipQty);
        const finalQty = numberValue(detail?.new_number ?? snapshot.suggested_number ?? constraint.qty_final ?? plan.number);
        const serviceStart = detail?.service_start_date || (orderWeek ? snapshot.second_service_start_date : snapshot.service_start_date) || '-';
        const serviceEnd = detail?.service_end_date || (orderWeek ? snapshot.second_service_end_date : snapshot.service_end_date) || '-';
        const demandDays = detail
          ? numberValue(detail.coverage_demand_days, 7)
          : numberValue(orderWeek ? snapshot.second_week_demand_days : snapshot.first_week_demand_days, 7);
        const requiredAtAdd = numberValue(detail?.required_inventory_at_add_date, NaN);
        const storedInventoryBeforeAdd = numberValue(
          detail?.inventory_before_plan_at_add_date ?? detail?.ordinary_inventory_at_add_date,
          NaN,
        );
        const inventoryBeforeAdd = Number.isFinite(storedInventoryBeforeAdd)
          ? storedInventoryBeforeAdd
          : Number.isFinite(requiredAtAdd) && Number.isFinite(theoreticalGap)
            ? Math.max(0, requiredAtAdd - theoreticalGap)
            : NaN;
        const inventoryDate = detail?.inventory_date || snapshot.inventory_date || plan.add_date || '-';
        const inventoryWithConstraintSurplus = numberValue(
          orderWeek ? snapshot.raw_inventory_at_second_service_start : snapshot.raw_inventory_at_service_start,
          NaN,
        );
        const serviceStartInventory = inventoryWithConstraintSurplus;
        return h('div', { key: plan.id || index, style: { background: '#f7f9fc', border: '1px solid #e1e7ef', borderRadius: 6, padding: '8px 11px', marginTop: index ? 8 : 0 } },
          h('div', { style: { fontWeight: 700 } }, title),
          Number.isFinite(serviceDemand) ? h('div', null, `服务期：${serviceStart}～${serviceEnd}；${fmt(demandDays)} 天，需要 ${fmt(serviceDemand, 2)} 台`) : null,
          detail && Number.isFinite(requiredAtAdd) ? h('div', null, `到货日：${dateText(inventoryDate)}，从服务期倒推需要 ${fmt(requiredAtAdd, 2)} 台`) : null,
          detail && Number.isFinite(inventoryBeforeAdd) ? h('div', null, `计算时，到货日前预计可用库存：${fmt(inventoryBeforeAdd, 2)} 台`) : null,
          detail && Number.isFinite(theoreticalGap) && Number.isFinite(requiredAtAdd) && Number.isFinite(inventoryBeforeAdd)
            ? h('div', null, `原始缺口：max(0, ${fmt(requiredAtAdd, 2)} − ${fmt(inventoryBeforeAdd, 2)}) = ${fmt(theoreticalGap, 2)} 台`) : null,
          !detail && Number.isFinite(serviceStartInventory) ? h('div', null, `服务期开始前预计可用库存：${fmt(serviceStartInventory, 2)} 台`) : null,
          !detail && Number.isFinite(theoreticalGap) && Number.isFinite(serviceDemand) && Number.isFinite(serviceStartInventory)
            ? h('div', null, `理论缺口：max(0, ${fmt(serviceDemand, 2)} − ${fmt(serviceStartInventory, 2)}) = ${fmt(theoreticalGap, 2)} 台`) : null,
          Number.isFinite(adjustedGap) ? h('div', null, `前周多发余量抵扣：${fmt(priorSurplus, 2)} 台，抵扣后仍需 ${fmt(adjustedGap, 2)} 台`) : null,
          Number.isFinite(boxedQty) && adjustedGap > 0 && Number.isFinite(unitsPerBox) && unitsPerBox > 0
            ? h('div', null, `整箱：每箱 ${fmt(unitsPerBox)} 台，ceil(${fmt(adjustedGap, 2)} ÷ ${fmt(unitsPerBox)}) = ${fmt(boxedQty / unitsPerBox)} 箱，共 ${fmt(boxedQty)} 台`) : null,
          Number.isFinite(boxedQty) && adjustedGap > 0 && (!Number.isFinite(unitsPerBox) || unitsPerBox <= 0)
            ? h('div', null, `箱入数未配置，按 ${fmt(boxedQty)} 台计算`) : null,
          minShipQty > 0 && adjustedGap > 0 ? h('div', null, boxedQty < effectiveMinQty
            ? `最低发货量 ${fmt(minShipQty)} 台，补量后按 ${fmt(effectiveMinQty)} 台执行`
            : `最低发货量 ${fmt(minShipQty)} 台，当前已满足`) : null,
          h('div', { style: { fontWeight: 700, color: '#1d5fc4' } }, `最终建议数量：${fmt(finalQty)} 台`));
      }
      return h('div', { key: plan.id || index, style: { background: '#f7f9fc', border: '1px solid #e1e7ef', borderRadius: 6, padding: '8px 11px', marginTop: index ? 8 : 0 } },
        h('div', { style: { fontWeight: 700 } }, title),
        h('div', { style: { color: '#8a9099' } }, `表内建议为 ${fmt(plan.number)} 台；该历史记录缺少生成时计算明细，无法准确拆解服务期需求、预计库存及执行约束。`));
    }));
}

function v19CoverageCalculation(week) {
  const plans = (week?.rows || []).filter((plan) => parseDate(plan.date) && parseDate(plan.add_date));
  if (!plans.length) return h('div', { style: { padding: '9px 11px', background: '#f7f9fc', color: '#8a9099', fontSize: 12, borderRadius: 6 } }, '该周没有可计算覆盖售卖期的建议计划。');
  return h('div', { style: { background: '#f7f9fc', border: '1px solid #e1e7ef', borderRadius: 6, padding: '8px 11px', fontSize: 12, color: '#3a4763', lineHeight: 1.7 } },
    ...plans.map((plan, index) => {
      const warehouseDays = Math.max(0, numberValue(plan.warehouse_days));
      const totalDays = v19DaysBetween(plan.date, plan.add_date);
      const logisticsDays = totalDays == null ? null : Math.max(0, totalDays - warehouseDays);
      const coverStart = addDays(plan.add_date, 7);
      const coverEnd = addDays(plan.add_date, 13);
      return h('div', {
        key: plan.id || index,
        style: { borderTop: index ? '1px solid #dfe5ed' : 'none', paddingTop: index ? 8 : 0, marginTop: index ? 8 : 0 },
      },
      plans.length > 1 ? h('div', { style: { fontWeight: 700, marginBottom: 2 } }, `计划 ${index + 1}`) : null,
      h('div', null, `发货日：${dateText(plan.date)} · 渠道：${plan.channel || '-'}`),
      h('div', null, `物流天数：${logisticsDays == null ? '-' : `${logisticsDays} 天`} · 入仓天数：${warehouseDays} 天`),
      h('div', null, `预计入库：${dateText(plan.date)} + ${logisticsDays == null ? '-' : logisticsDays} 天 + ${warehouseDays} 天 = ${dateText(plan.add_date)}`),
      h('div', null, `覆盖售卖期：${dateText(plan.add_date)} + 7～13 天 = ${dateText(coverStart)}～${dateText(coverEnd)}`));
    }));
}

function V19Table({ rows, allScopeRows, changes, confirmedRows, role, orderWeek, poApproved, logisticsLeads, onEdit, onOpenDetail }) {
  const [expanded, setExpanded] = useState({}); const [sandboxes, setSandboxes] = useState({});
  const shownIndices = [0, 1, 2, 3, 4, 5, 6];
  const headerWeeks = buildWeeks([]); const border = '1px solid #edf0f4';
  const th = (textValue, props = {}) => h('th', { rowSpan: props.rowSpan, colSpan: props.colSpan, onClick: props.onClick, style: { borderBottom: border, borderRight: border, padding: '8px 11px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 13.5, ...props.style } }, textValue);
  const sumFor = (index) => allScopeRows.reduce((sum, row) => sum + v19WeekValue(row, index, changes), 0);

  const netSum = allScopeRows.reduce((sum, row) => sum + v19NetOf(row, changes).net, 0);
  const headerCoverage = (index) => {
    const week = rows.map((row) => row.weeks[index]).find((item) => item?.coverStart && item?.coverEnd);
    return week ? `${shortDate(week.coverStart)}～${shortDate(week.coverEnd)}` : '—';
  };
  const weekCellBody = (suggest, state, simulation = null, baseline = null) => {
    const simulatedSuggest = simulation?.suggest;
    const quantityChanged = simulatedSuggest != null
      && Number.isFinite(Number(simulatedSuggest))
      && numberValue(simulatedSuggest) !== numberValue(suggest);
    const quantityNode = quantityChanged
      ? h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 16, lineHeight: 1.2, whiteSpace: 'nowrap' } },
        h('b', { style: { color: '#1f2329' } }, fmt(suggest)),
        h('span', { style: { color: '#5b3fc4', fontWeight: 800 } }, '→'),
        h('b', { style: { color: '#5b3fc4' } }, fmt(simulatedSuggest)))
      : (Number.isFinite(Number(suggest)) ? fmt(suggest) : '—');
    const compareQty = baseline?.hasApproved ? numberValue(baseline.approvedQty) : numberValue(baseline?.systemSuggestQty);
    const delta = numberValue(suggest) - compareQty;
    const compareLabel = baseline?.hasApproved ? '上周人工确认' : '上周建议';
    const deltaLabel = baseline?.hasApproved
      ? `差额 ${delta > 0 ? '+' : ''}${fmt(delta)}`
      : delta > 0 ? `增加 ${fmt(delta)}` : delta < 0 ? `减少 ${fmt(Math.abs(delta))}` : '持平';
    const deltaColor = baseline?.hasApproved ? '#7c3aed' : delta > 0 ? '#147a43' : delta < 0 ? '#c0392b' : '#8a9099';
    return h(React.Fragment, null,
      quantityNode,
      h('span', { style: { display: 'block', marginTop: 2, fontSize: 9.5, color: '#667085', fontWeight: 700 } }, simulation?.active ? '系统建议 · 模拟中' : '系统建议'),
      baseline ? h('span', { style: { display: 'block', marginTop: 1, fontSize: 9.5, color: '#6a7280', fontWeight: 700 } }, `${compareLabel} ${fmt(compareQty)} `, h('span', { style: { color: deltaColor } }, `| ${deltaLabel}`)) : h('span', { style: { display: 'block', marginTop: 1, fontSize: 9.5, color: '#a5acb8', fontWeight: 600 } }, '上周暂无'),
      state ? h('span', { style: { display: 'block', marginTop: 1, fontSize: 9.5, color: '#1a6d49', fontWeight: 700 } }, `${state.label} ${fmt(state.qty)}${state.locked ? ' 🔒' : ''}`) : null);
  };
  const sandboxHintOf = (row, week, change, value, sandbox, state) => {
    if (!sandbox) return '';
    const baseShift = numberValue(change?.shift);
    const nextShift = sandbox.shift == null ? baseShift : numberValue(sandbox.shift);
    const baseChannel = v19ChannelValue(change?.channel || week.rows[0]?.channel);
    const nextChannel = sandbox.channel || baseChannel;
    const baseDates = v19BatchDates(row, week, change?.channel || null, baseShift);
    const nextDates = v19BatchDates(row, week, nextChannel, nextShift);
    const nextQty = sandbox.qty == null ? value : numberValue(sandbox.qty);
    const parts = [];
    if (nextQty !== value) parts.push(`系统建议 ${fmt(value)} → ${fmt(nextQty)} 台`);
    if (dateText(baseDates.shipDate) !== dateText(nextDates.shipDate)) parts.push(`发货日期 ${dateText(baseDates.shipDate)} → ${dateText(nextDates.shipDate)}`);
    if (dateText(baseDates.arrival) !== dateText(nextDates.arrival)) parts.push(`到货日期 ${dateText(baseDates.arrival)} → ${dateText(nextDates.arrival)}`);
    if (nextChannel !== baseChannel) parts.push(`渠道 ${baseChannel} → ${nextChannel}`);
    if (state) parts.push(`${state.label} ${fmt(state.qty)} 台${state.locked ? '已锁定' : '固定不变'}`);
    return `模拟沙盘：${parts.join('；') || '未改变'}`;
  };
  return h('div', null,
    h('div', { style: { overflowX: 'auto', border: '1px solid #e3e7ee', borderRadius: 8 } }, h('table', { style: { borderCollapse: 'separate', borderSpacing: 0, fontSize: 14, whiteSpace: 'nowrap', minWidth: 1740, width: '100%' } },
      h('thead', null,
        h('tr', null, th('商品信息（看一眼就能初判：要不要备、能不能备）', { colSpan: 9, style: { background: '#dcefe3', color: '#1a6d49', fontWeight: 800, fontSize: 14 } }), th('发货周次（备货当周不进表 · W1 从下一周开始；前沿 W6–W7 按净额交采购）', { colSpan: shownIndices.length, style: { background: '#d8b072', color: '#6b4a17', fontWeight: 800, fontSize: 14 } }), th(h('span', null, '需新下厂', h('span', { style: { display: 'block', fontWeight: 400, fontSize: 11, color: '#b08430' } }, '净额 · PO 唯一依据')), { rowSpan: 4, style: { background: '#fff4e2', color: '#8a5a00', borderBottom: '2px solid #e8b45a', minWidth: 145 } })),
        h('tr', null, th('趋势', { rowSpan: 3, style: { background: '#eaf5ee', color: '#2c6a4c' } }), ...['站点', '销售', '型号', 'ASIN', '加权日均', '等级', '库销比', '产品标签'].map((value) => th(value, { rowSpan: 3, style: { background: '#eaf5ee', color: '#2c6a4c', fontWeight: 700 } })), ...shownIndices.map((index) => th(index === 0 ? 'W1 🔒' : `W${index + 1}`, { style: { background: index === 0 ? '#ededf0' : index >= 5 ? '#efeaff' : '#f3e6cf', color: index === 0 ? '#6a727d' : index >= 5 ? '#5b3fc4' : '#7a5a24', fontWeight: 700 } }))),
        h('tr', null, ...shownIndices.map((index) => th(`${shortDate(headerWeeks[index].start)}~${shortDate(headerWeeks[index].end)}`, { style: { background: index === 0 ? '#ededf0' : index >= 5 ? '#efeaff' : '#f7edda', color: index === 0 ? '#8a9099' : index >= 5 ? '#6b4fd0' : '#8a6a2e', fontSize: 11 } }))),
        h('tr', null, ...shownIndices.map((index) => th(h('span', null, '覆盖售卖期 ', h('span', { style: { color: index >= 5 ? '#6b4fd0' : '#b06a1e' } }, headerCoverage(index))), { style: { background: index === 0 ? '#ededf0' : index >= 5 ? '#efeaff' : '#fbf5e8', color: '#a07a3a', fontSize: 10 } })))),
      h('tbody', null,
        ...rows.flatMap((row, rowIndex) => {
          const open = Boolean(expanded[row.key]); const confirmed = Boolean(confirmedRows?.[row.key]); const lifeName = v19LifeName(row); const lifeStyle = V19_LIFE[lifeName] || { bg: '#eef1f5', color: '#5a6169' }; const ratioColor = row.ratio.name === '短缺' ? '#c0392b' : row.ratio.name === '滞销' ? '#b06a1e' : '#1a6d49'; const net = v19NetOf(row, changes);
          const info = [row.product.country || '-', row.product.sale_owner || '-', row.product.model || '-', row.product.asin || '-', fmt(row.summaryRow?.weighted_sales, 1), row.levelName || '未配置', `${fmt(row.ratio.value, 1)} ${row.ratio.name}`, lifeName];
          const cells = shownIndices.map((index) => {
            const week = row.weeks[index]; const hasPlan = week.rows.length > 0; const key = v19ChangeKey(row.key, index); const change = changes[key]; const value = v19WeekValue(row, index, changes); const state = v19WeekState(row, index); const sandbox = sandboxes[row.key]?.[index]; const simulatedSuggest = sandbox?.qty == null ? null : numberValue(sandbox.qty); const displayValue = simulatedSuggest == null ? value : simulatedSuggest; const status = change?.status || 'ok'; const statusStyle = V19_STATUS_STYLE[status]; const newAlgorithm = week.newQty > 0; const actualPresent = state?.kind === 'actual';
            const stateHint = state ? `；${state.label} ${fmt(state.qty)} 台${state.locked ? '已锁定' : '固定不变'}` : '';
            const baselineHint = week.baseline ? `；上周建议 ${fmt(week.baseline.systemSuggestQty)} 台${week.baseline.hasApproved ? `，上周人工 ${fmt(week.baseline.approvedQty)} 台` : '，上周未人工改动'}` : '；无上周基线';
            const interactionHint = sandbox ? sandboxHintOf(row, week, change, value, sandbox, state) : change ? `${V19_CHANGE_MARK[change.type]} ${V19_CHANGE_LABEL[change.type]}：系统建议 ${fmt(change.from)} → ${fmt(change.to)} 台 · ${V19_STATUS_TEXT[status]} · ${change.reason}${stateHint}${baselineHint}` : hasPlan ? `点击查看：系统建议 ${week.rows.length} 条${stateHint}${baselineHint}` : `该周尚未生成系统计划${baselineHint}`;
            const leadHint = week.eventLead ? `｜✈ 活动前置建议：${week.eventLead.eventStart || ''} 活动前到不了，改「${week.eventLead.fastChannel || '快渠道'}」可提前 ${fmt(week.eventLead.daysGain)} 天（到货 ${week.eventLead.fastAddDate || '-'}）；换渠道多付运费，由采购决定` : '';
            return h(Tooltip, { key: index, title: interactionHint + leadHint }, h('td', { onClick: hasPlan ? () => onOpenDetail(row, index) : undefined, style: { position: 'relative', minWidth: 116, padding: '8px 7px', textAlign: 'center', borderBottom: border, borderRight: border, cursor: hasPlan ? 'pointer' : 'default', fontWeight: change || displayValue ? 800 : 500, color: sandbox ? '#5b3fc4' : change ? statusStyle.color : displayValue ? '#1f2329' : '#c2c8d0', background: sandbox ? '#f2edff' : actualPresent ? '#f3fbf6' : index >= 5 ? '#f6f3ff' : index === 0 ? '#ededf0' : statusStyle.bg, boxShadow: sandbox ? 'inset 0 0 0 2px #8b6cf0' : change && status !== 'ok' ? `inset 0 0 0 2px ${statusStyle.border}` : index >= 5 ? 'inset 0 2px 0 #8b6cf0, inset 0 -2px 0 #8b6cf0' : 'none' } }, sandbox ? h('span', { style: { position: 'absolute', top: 1, right: 3, fontSize: 9.5, color: '#6b4fd0', fontWeight: 900 } }, '沙盘') : change ? h('span', { style: { position: 'absolute', top: 2, right: 3, fontSize: 10.5, fontWeight: 900, color: statusStyle.color } }, V19_CHANGE_MARK[change.type]) : newAlgorithm ? h('span', { style: { position: 'absolute', top: 2, right: 3, color: '#8a9099', fontSize: 10.5 } }, '⟳') : actualPresent ? h('span', { style: { position: 'absolute', top: 2, right: 3, color: '#1a6d49', fontSize: 10.5 } }, '◆') : null, change && status !== 'ok' ? h('span', { style: { position: 'absolute', top: 1, left: 3, fontSize: 10 } }, status === 'rej' ? '⛔' : '⏳') : null, week.eventLead ? h('span', { style: { position: 'absolute', bottom: 1, right: 3, fontSize: 9.5, color: '#1a5fb4', fontWeight: 800 } }, '✈') : null, hasPlan ? weekCellBody(value, state, { active: Boolean(sandbox), suggest: simulatedSuggest }, week.baseline) : h(React.Fragment, null, h('span', { style: { display: 'block', fontSize: 15, color: '#a5acb8' } }, '—'), h('span', { style: { display: 'block', marginTop: 2, fontSize: 9.5, color: '#a5acb8', fontWeight: 600 } }, '尚未生成'))));
          });
          return [h('tr', { key: row.key, style: { background: open ? '#f7faff' : rowIndex % 2 ? '#fafbfc' : '#fff', boxShadow: open ? 'inset 0 2px 0 #8fb1ff' : 'none' } },
            h('td', { onClick: () => setExpanded((current) => ({ ...current, [row.key]: !current[row.key] })), style: { width: 32, cursor: 'pointer', color: open ? '#3370ff' : '#8a929c', borderBottom: border, borderRight: border, textAlign: 'center', padding: '8px 6px' } }, open ? '▼' : '▶'),
            ...info.map((value, index) => h('td', { key: index, style: { borderBottom: border, borderRight: border, padding: '8px 11px', textAlign: index === 2 ? 'left' : 'center', fontWeight: [0, 2, 4].includes(index) ? 800 : 600, fontSize: index === 3 ? 11.5 : 12.5, color: '#1f2329' } },
              index === 0 ? h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 6 } }, h('i', { style: { width: 7, height: 7, borderRadius: '50%', background: v19Warning(row) ? '#e34d42' : '#2ba471', boxShadow: `0 0 0 2px ${v19Warning(row) ? '#fde5e3' : '#e2f6eb'}` } }), value)
                : index === 5 ? h('span', { style: { display: 'inline-block', minWidth: 28, borderRadius: 8, padding: '1px 7px', background: '#eef3fa', color: '#3a4763', fontSize: 11, fontWeight: 800 } }, value)
                  : index === 6 ? h('span', { style: { display: 'inline-block', borderRadius: 8, padding: '1px 7px', background: row.ratio.bg, color: ratioColor, fontSize: 11, fontWeight: 800 } }, value)
                    : index === 7 ? h('span', { style: { display: 'inline-block', fontSize: 11, fontWeight: 700, borderRadius: 9, padding: '1px 9px', background: lifeStyle.bg, color: lifeStyle.color } }, value)
                      : value)),
            ...cells,
            h('td', { style: { background: '#fffaf1', textAlign: 'center', borderLeft: '2px solid #f0d9a8', borderBottom: border, padding: '4px 7px', minWidth: 145 } }, orderWeek ? net.net ? h(React.Fragment, null, h('div', { style: { fontSize: 14, fontWeight: 800, color: '#b06a00' } }, fmt(net.net)), h('div', { style: { fontSize: 10, color: '#9a8b6a' } }, `发货计划合计 ${fmt(net.orderQty)}`), h('div', { style: { fontSize: 10, color: '#9a8b6a' } }, `− 未交货订单 ${fmt(net.undelivered)}`), h('div', { style: { fontSize: 10, color: '#9a8b6a' } }, `= 需下单 ${fmt(net.net)}`), confirmed ? h('div', { style: { fontSize: 10, color: '#147a43', fontWeight: 800 } }, '✓ 销售已确认') : null, poApproved ? h('div', { style: { fontSize: 10, color: '#0e5c32', fontWeight: 700 } }, 'PO 已通过 🔒') : null) : h(React.Fragment, null, h('div', { style: { fontSize: 10, color: '#9a8b6a' } }, `本批无需求${net.undelivered ? ` · 未交货余 ${fmt(net.undelivered)}` : ''}`), h('div', { style: { fontSize: 10, color: '#147a43', fontWeight: 700 } }, '= 需下单 0 · 订单余量够'), confirmed ? h('div', { style: { fontSize: 10, color: '#147a43', fontWeight: 800 } }, '✓ 销售已确认') : null) : h(React.Fragment, null, h('div', { style: { fontSize: 10, fontWeight: 800 } }, '非下单周'), h('div', { style: { fontSize: 10, color: '#9a8b6a' } }, `W6 已排 ${fmt(v19WeekValue(row, 5, changes))} 台`), h('div', { style: { fontSize: 10, color: '#3370ff' } }, '下周二下 PO')))),
          open ? h('tr', { key: `${row.key}-chart` }, h('td', { colSpan: 9 + shownIndices.length + 1, style: { padding: 0, borderBottom: border } }, h(V19TrendChart, { row, changes, role, poApproved, orderWeek, channelOptions: v19ChannelOptions(logisticsLeads, row.product.country, row.weeks[0]?.rows[0]?.channel), onSandbox: (rowKey, mods) => setSandboxes((current) => ({ ...current, [rowKey]: mods })), onApply: (selectedRow, bundle, evidence) => onEdit(selectedRow, bundle, evidence) }))) : null];
        }),
        h('tr', null, h('td', { colSpan: 9, style: { background: '#eef3fa', fontWeight: 800, borderTop: '2px solid #c3cfe0', textAlign: 'right', padding: '8px 12px', color: '#3a4763' } }, 'Σ 每周建议量合计 ', h('span', { style: { fontSize: 11, color: '#1a5fb4', background: '#e7f0fd', border: '1px solid #b9d4f5', borderRadius: 6, padding: '1px 9px', marginLeft: 6 } }, `${role === 'sale' ? '我的 ASIN' : role === 'lead' ? '本部门' : '公司'} · ${allScopeRows.length} ASIN`)), ...shownIndices.map((index) => {
          const suggest = sumFor(index);
          return h('td', { key: index, style: { background: '#eef3fa', fontWeight: 800, borderTop: '2px solid #c3cfe0', textAlign: 'center', padding: '8px 6px' } }, weekCellBody(suggest, null));
        }), h('td', { style: { background: '#eef3fa', color: '#8a6206', fontSize: 14, fontWeight: 800, borderTop: '2px solid #c3cfe0', textAlign: 'center' } }, orderWeek ? h(React.Fragment, null, fmt(netSum), h('span', { style: { display: 'block', fontSize: 10, fontWeight: 600, color: '#98a1ad' } }, '下单数量合计（净额，仅建议量）')) : h(React.Fragment, null, fmt(sumFor(5)), h('span', { style: { display: 'block', fontSize: 10, fontWeight: 600, color: '#98a1ad' } }, 'W6 建议量合计 · 下周合并下 PO'))))))),
    null);
}

function ShipmentEvolutionBlockV19() {
  const [params, setParams] = useState(readParamsSync); const [products, setProducts] = useState([]); const [catalogReady, setCatalogReady] = useState(false); const [catalogLoading, setCatalogLoading] = useState(true); const [catalogError, setCatalogError] = useState('');
  const [selectedSale, setSelectedSale] = useState(CAN_SELECT_SALE ? ALL_SALES : CURRENT_USERNAME); const [shops, setShops] = useState([]); const [dailyRows, setDailyRows] = useState([]); const [totalRows, setTotalRows] = useState([]); const [shipments, setShipments] = useState([]); const [actualPlans, setActualPlans] = useState([]); const [weeklySnapshots, setWeeklySnapshots] = useState([]); const [realSupplies, setRealSupplies] = useState([]); const [waterRows, setWaterRows] = useState([]); const [modelLevels, setModelLevels] = useState([]); const [logisticsLeads, setLogisticsLeads] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refreshSeed, setRefreshSeed] = useState(0); const requestSequence = useRef(0);
  const [role, setRole] = useState(DEFAULT_ROLE); const [mine, setMine] = useState(false); const orderWeek = isCurrentOrderWeek(); const [siteFilter, setSiteFilter] = useState(''); const [modelFilter, setModelFilter] = useState(''); const [labelFilter, setLabelFilter] = useState([]); const [onlyWarning, setOnlyWarning] = useState(false); const [onlyChanged, setOnlyChanged] = useState(false); const [changes, setChanges] = useState({}); const [confirmedRows, setConfirmedRows] = useState({}); const [detail, setDetail] = useState(null); const [editTarget, setEditTarget] = useState(null); const [auditNote, setAuditNote] = useState(''); const [actionLoading, setActionLoading] = useState(false); const [batchOpen, setBatchOpen] = useState(false); const [batchSigned, setBatchSigned] = useState(null); const [poGenerated, setPoGenerated] = useState(false); const [poApproved, setPoApproved] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => { let active = true; Promise.all([resolveParams(), requestEligibleProducts()]).then(([initial, rows]) => { if (!active) return; setProducts(rows); const names = new Set(rows.map((item) => item.sale_owner).filter(Boolean)); const requested = rows.find((item) => item.asin === initial.asin && item.country === initial.country); const sale = CAN_SELECT_SALE ? (initial.sale === ALL_SALES || names.has(initial.sale) ? initial.sale : requested?.sale_owner || ALL_SALES) : CURRENT_USERNAME; setSelectedSale(sale); setParams({ ...initial, sale, shop: TOTAL_SHOP }); if (!initial.asin && !initial.country && (initial.sale !== sale || initial.shop !== TOTAL_SHOP)) replaceSaleParams(sale, TOTAL_SHOP); if (!rows.length) setCatalogError(!AVAILABLE_ROLE_KEYS.length ? '当前用户不属于管理员、销售主管、物流仓储部或销售部门，本页面按只读无数据处理。' : '当前查看范围内没有状态为普通、新品或重点的非变体 ASIN。'); }).catch((requestError) => setCatalogError(requestError?.message || String(requestError))).finally(() => { if (active) { setCatalogLoading(false); setCatalogReady(true); } }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!catalogReady) return undefined;
    const routers = [ctx.router, ctx.app?.router?.router].filter((router) => typeof router?.subscribe === 'function');
    const unsubscribers = routers.map((router) => router.subscribe(() => {
      const next = readParamsSync(); const names = new Set(products.map((item) => item.sale_owner).filter(Boolean));
      const requested = products.find((item) => item.asin === next.asin && item.country === next.country);
      const sale = CAN_SELECT_SALE ? (next.sale === ALL_SALES || names.has(next.sale) ? next.sale : requested?.sale_owner || ALL_SALES) : CURRENT_USERNAME;
      setSelectedSale(sale); setSiteFilter(''); setModelFilter(''); setParams({ ...next, sale, shop: TOTAL_SHOP }); setChanges({}); setConfirmedRows({});
    }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [catalogReady, products]);
  const saleOptions = useMemo(() => [{ value: ALL_SALES, label: '全部销售' }, ...Array.from(new Set(products.map((item) => item.sale_owner).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')).map((name) => ({ value: name, label: name }))], [products]);
  const scopedProducts = useMemo(() => CAN_SELECT_SALE && selectedSale !== ALL_SALES ? products.filter((item) => item.sale_owner === selectedSale) : products, [products, selectedSale]); const scopeSignature = useMemo(() => scopedProducts.map(productKey).join('|'), [scopedProducts]);
  const siteOptions = useMemo(() => Array.from(new Set(scopedProducts.map((item) => item.country).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')).map((value) => ({ value, label: value })), [scopedProducts]);
  const modelOptions = useMemo(() => Array.from(new Set(scopedProducts.map((item) => item.model).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN', { numeric: true })).map((value) => ({ value, label: value })), [scopedProducts]);
  const shopScopeProducts = useMemo(() => {
    if (!params.asin) return scopedProducts;
    const matched = scopedProducts.filter((item) => item.asin === params.asin && (!params.country || item.country === params.country));
    return matched.length ? matched : scopedProducts;
  }, [scopedProducts, params.asin, params.country]);
  const shopScopeSignature = useMemo(() => shopScopeProducts.map(productKey).join('|'), [shopScopeProducts]);
  const shopProductKeys = useMemo(() => {
    const result = new Map();
    shops.forEach((shop) => result.set(shop.name, new Set(shop.productKeys)));
    return result;
  }, [shops]);
  const loadData = useCallback(async () => {
    if (!catalogReady) return;
    const requestId = ++requestSequence.current;
    if (!scopedProducts.length) { setDailyRows([]); setTotalRows([]); setShipments([]); setActualPlans([]); setWeeklySnapshots([]); setRealSupplies([]); setWaterRows([]); setModelLevels([]); setLogisticsLeads([]); setChanges({}); setShops([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const dailyPromise = requestDailySales(scopedProducts, TOTAL_SHOP);
      const shipmentPromise = requestShipments(scopedProducts, TOTAL_SHOP);
      const actualPlanPromise = requestActualPlans(scopedProducts);
      const weeklySnapshotPromise = requestWeeklySnapshots(scopedProducts);
      const realSupplyPromise = requestExpectedInventory(scopedProducts);
      const [dailyData, shipmentData, actualPlanData, weeklySnapshotData, realSupplyData, waterData, levelData, logisticsData] = await Promise.all([
        dailyPromise, shipmentPromise, actualPlanPromise, weeklySnapshotPromise, realSupplyPromise,
        requestWaterProducts(scopedProducts), requestModelLevels(scopedProducts), requestLogisticsLeads(scopedProducts),
      ]);
      if (requestId !== requestSequence.current) return;
      const planChangeData = await requestPlanChanges(shipmentData);
      const changeLogData = await requestChangeLogs(planChangeData);
      if (requestId !== requestSequence.current) return;
      setShops([]);
      setDailyRows(dailyData); setTotalRows(dailyData); setShipments(shipmentData); setActualPlans(actualPlanData); setWeeklySnapshots(weeklySnapshotData); setRealSupplies(realSupplyData); setWaterRows(waterData); setModelLevels(levelData); setLogisticsLeads(logisticsData);
      setChanges(buildWorkflowChanges(scopedProducts, shipmentData, planChangeData, changeLogData));
    } catch (requestError) {
      if (requestId === requestSequence.current) { setError(requestError?.message || String(requestError)); setDailyRows([]); setTotalRows([]); setShipments([]); setActualPlans([]); setWeeklySnapshots([]); setRealSupplies([]); setWaterRows([]); setModelLevels([]); setLogisticsLeads([]); setChanges({}); }
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [catalogReady, scopeSignature, refreshSeed]);
  useEffect(() => { loadData(); }, [loadData]);
  const productViews = useMemo(() => scopedProducts.map((product) => { const key = productKey(product); const dataKey = rowProductKey(product); const matches = (item) => rowProductKey(item) === dataKey; const productDaily = dailyRows.filter(matches); const productTotal = totalRows.filter(matches); const productPlans = shipments.filter(matches); const productActualPlans = actualPlans.filter(matches); const productWeeklySnapshots = weeklySnapshots.filter(matches); const productRealSupplies = realSupplies.filter(matches); const waterRow = waterRows.find(matches) || null; const current = productDaily.find((item) => dateText(item.date) === todayText()) || latestOnOrBefore(productDaily, todayText()); const total = productTotal.find((item) => dateText(item.date) === todayText()) || latestOnOrBefore(productTotal, todayText()); return { key, dataKey, product, dailyRows: productDaily, totalRow: total, waterRow, summaryRow: current, ratio: ratioInfo(waterRow), levelName: modelLevels.find((item) => item.country === product.country && item.model === product.model)?.level_name || '', realSupplyRows: productRealSupplies, weeks: buildWeeks(productPlans, productRealSupplies, productActualPlans, productWeeklySnapshots), netWeeks: buildWeeks(productPlans, productRealSupplies, productActualPlans, productWeeklySnapshots), noShopData: !current }; }), [scopedProducts, dailyRows, totalRows, shipments, actualPlans, weeklySnapshots, realSupplies, waterRows, modelLevels]);
  const counts = useMemo(() => { const result = { sale: orderWeek ? productViews.filter((row) => !confirmedRows[row.key]).length : 0, lead: 0, ops: 0, final: 0 }; Object.values(changes).forEach((change) => { const owner = V19_STATUS_OWNER[change.status]; if (owner) result[owner] += 1; }); if (!batchSigned) result.lead += 1; if (orderWeek && !poGenerated && !poApproved) result.ops += 1; if (orderWeek && !poApproved) result.final += 1; return result; }, [productViews, confirmedRows, changes, batchSigned, orderWeek, poGenerated, poApproved]);
  const visibleRows = useMemo(() => productViews.filter((row) => !siteFilter || row.product.country === siteFilter).filter((row) => !modelFilter || row.product.model === modelFilter).filter((row) => !labelFilter.length || labelFilter.includes(v19LifeName(row))).filter((row) => !onlyWarning || v19Warning(row)).filter((row) => !onlyChanged || v19Changed(row, changes)).filter((row) => { if (!mine) return true; if (role === 'sale' && orderWeek && !confirmedRows[row.key]) return true; return row.weeks.some((week, index) => V19_STATUS_OWNER[changes[v19ChangeKey(row.key, index)]?.status] === role); }), [productViews, siteFilter, modelFilter, labelFilter, onlyWarning, onlyChanged, mine, role, orderWeek, confirmedRows, changes]);
  const inflight = Object.values(changes).filter((change) => !['ok', 'yel'].includes(change.status)).length;
  function changeSale(sale) { setSelectedSale(sale); setSiteFilter(''); setModelFilter(''); setParams({ sale, shop: TOTAL_SHOP }); setChanges({}); setConfirmedRows({}); replaceSaleParams(sale, TOTAL_SHOP); }
  function openEdit(row, weekIndexOrBundle, modOrEvidence = {}) {
    if (Array.isArray(weekIndexOrBundle)) {
      setEditTarget({ row, bundle: weekIndexOrBundle, evidence: String(modOrEvidence || ''), changes, role });
      setDetail(null); return;
    }
    const weekIndex = weekIndexOrBundle; const current = changes[v19ChangeKey(row.key, weekIndex)];
    const mod = modOrEvidence || {};
    const currentChannel = row.weeks[weekIndex]?.rows[0]?.channel || '';
    setEditTarget({ row, weekIndex, changes, role, qty: mod.qty, type: current?.type || (mod.channel && mod.channel !== currentChannel ? 'air' : 'up'), currentChannel, channelOptions: v19ChannelOptions(logisticsLeads, row.product.country, currentChannel) });
    setDetail(null);
  }
  function allocateWeekQuantities(total, plans) {
    if (!plans.length) return [];
    const target = Math.max(0, Math.round(numberValue(total)));
    const weights = plans.map((plan) => Math.max(0, numberValue(plan.number)));
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const raw = plans.map((plan, index) => weightTotal > 0 ? target * weights[index] / weightTotal : target / plans.length);
    const values = raw.map((value) => Math.floor(value));
    let remainder = target - values.reduce((sum, value) => sum + value, 0);
    raw.map((value, index) => ({ index, fraction: value - values[index] })).sort((a, b) => b.fraction - a.fraction || a.index - b.index)
      .forEach((item) => { if (remainder > 0) { values[item.index] += 1; remainder -= 1; } });
    return values;
  }
  async function submitEdit(payload) {
    if (!editTarget || actionLoading) return;
    if (!['sale', 'ops'].includes(role)) { ctx.message?.error?.('当前角色只能查看，不能提交修改申请。'); return; }
    const { row } = editTarget;
    const items = payload.bundle || [{
      weekIndex: editTarget.weekIndex, type: payload.type, to: payload.to,
      channel: payload.type === 'air' ? payload.channel : undefined, shift: 0,
      quantityChanged: payload.type !== 'air', channelChanged: payload.type === 'air', dateChanged: false,
    }];
    const bundleId = workflowRequestId('bundle'); const requests = [];
    try {
      items.forEach((item) => {
        const week = row.weeks[item.weekIndex];
        if (!week?.rows?.length || week.rows.some((plan) => plan.id == null)) throw new Error(`W${item.weekIndex + 1} 没有可绑定的真实计划 ID，不能提交。`);
        const targetTotal = item.to == null ? week.quantity : numberValue(item.to);
        const allocations = allocateWeekQuantities(targetTotal, week.rows);
        week.rows.forEach((plan, planIndex) => {
          const numberChanged = item.quantityChanged && allocations[planIndex] !== Math.round(numberValue(plan.number));
          const dateChanged = item.dateChanged && numberValue(item.shift) !== 0;
          const channelChanged = item.channelChanged && item.channel && String(item.channel) !== String(plan.channel || '');
          const kinds = [numberChanged ? 'NUMBER' : null, dateChanged ? 'DATE' : null, channelChanged ? 'CHANNEL' : null].filter(Boolean);
          if (!kinds.length) return;
          requests.push({
            request_uuid: workflowRequestId('change'), bundle_id: bundleId, plan_id: plan.id,
            change_kind: kinds.length > 1 ? 'MIXED' : kinds[0],
            proposed_number: numberChanged ? allocations[planIndex] : null,
            proposed_date: dateChanged ? formatDate(addDays(plan.date, numberValue(item.shift) * 7)) : null,
            proposed_channel: channelChanged ? item.channel : null,
            reason_type: payload.reasonType, reason: payload.reason,
            simulation_evidence: payload.evidence || null, acting_role: role,
          });
        });
      });
      if (!requests.length) { ctx.message?.warning?.('当前沙盘没有形成可提交的实际变更。'); return; }
      setActionLoading(true);
      for (const request of requests) await triggerWorkflow(WORKFLOW_KEYS.submit, request);
      const submitted = await waitForSubmittedChanges(requests.map((request) => request.request_uuid));
      if (!submitted.length) ctx.message?.warning?.('申请已触发，但申请表暂未回查到记录，请稍后刷新。');
      else ctx.message?.success?.(`已写入 ${submitted.length} 条真实修改申请，服务端正在判定安全区间与审核路径。`);
      setEditTarget(null); setRefreshSeed((value) => value + 1);
    } catch (requestError) {
      setRefreshSeed((value) => value + 1);
      ctx.message?.error?.(requestError?.message || String(requestError));
    } finally { setActionLoading(false); }
  }
  async function reviewRecords(records, action) {
    if (actionLoading) return;
    const expectedStatus = role === 'lead' ? 'PENDING_SUPERVISOR' : role === 'ops' ? 'PENDING_PROCUREMENT' : role === 'final' ? 'PENDING_FINAL' : '';
    const targets = (records || []).filter((record) => record.status === expectedStatus);
    if (!targets.length) { ctx.message?.warning?.('当前视角没有可处理的真实申请，请刷新或切换到对应店铺。'); return; }
    try {
      setActionLoading(true);
      for (const record of targets) await triggerWorkflow(WORKFLOW_KEYS.review, {
        change_id: record.id, action, expected_row_version: record.row_version,
        comment: auditNote.trim() || null, acting_role: role,
      });
      ctx.message?.success?.(`${action === 'APPROVE' ? '审核通过' : '已驳回'} ${targets.length} 条申请。`);
      setAuditNote(''); setDetail(null); setRefreshSeed((value) => value + 1);
    } catch (requestError) {
      setRefreshSeed((value) => value + 1);
      ctx.message?.error?.(requestError?.message || String(requestError));
    } finally { setActionLoading(false); }
  }
  function actionChange(key, action) {
    const target = changes[key];
    if (!target) return;
    if (action === 'leadPass' || action === 'opsPass') reviewRecords(target.records, 'APPROVE');
    else if (action === 'reject') reviewRecords(target.records, 'REJECT');
    else ctx.message?.info?.('该批次动作工作流尚未启用，本页不会写入本地假状态。');
  }
  function allPass() { ctx.message?.info?.('全表确认工作流尚未启用，本页不会写入本地假状态。'); }
  function signBatch() { ctx.message?.info?.('批次签核工作流尚未启用，本页不会写入本地假状态。'); }
  function generatePO() { ctx.message?.info?.('生成下单计划工作流尚未启用，本页不会写入本地假状态。'); }
  function approvePO() {
    const records = Object.values(changes).flatMap((change) => change.records || []).filter((record) => record.status === 'PENDING_FINAL');
    reviewRecords(records, 'APPROVE');
  }
  return h('div', { style: { width: '100%', minWidth: 0, margin: 0, padding: 22, background: '#eef1f5', color: '#1f2329', fontFamily: '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif', fontSize: 13.5, lineHeight: 1.6, boxSizing: 'border-box', WebkitFontSmoothing: 'antialiased', fontVariantNumeric: 'tabular-nums' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', fontSize: 21, fontWeight: 800, marginBottom: 14 } },
      h('span', { style: { fontSize: 22 } }, '📦'),
      '发货计划演变',
      h('span', { style: { fontSize: 12, fontWeight: 700, color: '#1a5fb4', background: '#e7f0fd', border: '1px solid #b9d4f5', borderRadius: 11, padding: '2px 10px' } }, 'v21 · W1 锁定 · W1-W7 独立展示 · 上周建议/上周人工按同一发货周对齐｜决策 27：修改后由服务端重算 v2 水位，结果在 7–14 天或不劣于系统建议则免审；出界才审核（W2-W5→主管+采购；下单批→采购+终审）'),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 'auto' } },
        h(Button, {
          loading: catalogLoading || loading,
          icon: h(ReloadOutlined || 'span'),
          onClick: () => setRefreshSeed((value) => value + 1),
          style: { height: 40, borderRadius: 7, padding: '0 14px', color: '#3a4763', borderColor: '#c9d2df', background: '#fff', fontWeight: 700 },
        }, '刷新'),
        h(Button, {
          icon: h(guideOpen ? (DownOutlined || 'span') : (RightOutlined || 'span')),
          'aria-expanded': guideOpen,
          onClick: () => setGuideOpen((value) => !value),
          style: { height: 40, borderRadius: 7, padding: '0 14px', color: '#1a5fb4', borderColor: '#b9d4f5', background: '#f6f9ff', fontWeight: 700 },
        }, guideOpen ? '收起计划说明' : '查看计划说明'))),
    h('div', { style: { background: '#fff', border: '1px solid #e6e9ee', borderRadius: 9, boxShadow: '0 1px 8px rgba(0,0,0,0.05)', padding: '16px 18px' } },
      guideOpen ? h(React.Fragment, null,
        h('div', { style: { fontSize: 12.5, color: '#5a6169', lineHeight: 1.7, marginBottom: 10 } }, '系统每周滚动算好发货计划，', h('b', { style: { color: '#1f2329' } }, '你只确认「够不够、覆盖到哪周」，不用自己算'), '。表头三行：', h('b', { style: { color: '#1f2329' } }, '周次 / 发货日期 / 覆盖售卖期'), '。', h('b', { style: { color: '#1f2329' } }, '基准 7/6 备货周'), '（周一确认 · 7/7 周二下厂）：', h('b', { style: { color: '#1f2329' } }, '备货当周不进表，W1 从下一周 7/13 起算'), '；+45 天交期 → 8/21 出厂落 ', h('b', { style: { color: '#1f2329' } }, '8/18 那一周（W6）'), ' → ', h('b', { style: { color: '#1f2329' } }, '本期下单批 = W6 + W7 = 前沿'), '，发货计划排到 W7 为止。格子 = 该周应发量；', h('b', { style: { color: '#1f2329' } }, '需下单（净额）= W6+W7 应发相加 − 未交货订单余量'), '，采购按净额下 PO。节奏：', h('b', { style: { color: '#1f2329' } }, '每周新排一周（逐周滚动）'), '——非下单周排 W6，确认即承诺——', h('b', { style: { color: '#1f2329' } }, '承诺 = 系统不重算'), '（铁律①修订）；下单周排 W7，漂移全由 W7 吸收（铁律②）；', h('b', { style: { color: '#1f2329' } }, '周二 PO 落地前 W6 仍可提下单异议'), '（改即申请 → 采购 → 终审），PO 通过后 W6+W7 真锁死（决策 19 不可取消）。', h('span', { style: { color: '#8a9099' } }, '发货 = 出货 / 出厂轴，W1 = 下周；各站点周次一致，时效差异只改覆盖售卖期与在途量。')),
        h('div', { style: { display: 'flex', gap: 10, marginBottom: 11, flexWrap: 'wrap' } }, h('div', { style: { flex: 1, minWidth: 260, background: '#f6f9ff', border: '1px solid #d6e4fb', borderRadius: 7, padding: '9px 13px', fontSize: 12.5, color: '#26405f', lineHeight: 1.6 } }, h('b', { style: { color: '#1a5fb4' } }, '① 确认发货计划　'), '常规行顶栏「一键通过（例外除外）」；', h('b', null, '要改 → 展开趋势图直接拖节点'), '（上下 = 数量、左右 = 时间按周、点渠道名切换），曲线即时变，满意再「转修改申请」（模拟证据自动带入 + 补充说明必填）。闸：', h('b', null, 'W1 已锁定'), ' · ', h('b', null, 'W2–W5 按修改后 7–14 天或不劣于系统建议判闸'), ' · ', h('b', null, 'W6–W7 = 下单异议'), '（W6 已承诺可议至 PO）。'), h('div', { style: { flex: 1, minWidth: 260, background: '#f6f9ff', border: '1px solid #d6e4fb', borderRadius: 7, padding: '9px 13px', fontSize: 12.5, color: '#26405f', lineHeight: 1.6 } }, h('b', { style: { color: '#1a5fb4' } }, '② 看覆盖前沿　'), '第三行「覆盖售卖期」= 这批发出去补的是哪段可售；点开行看测算（时效 / 安全库存 / 淡旺季）验系统算得对不对。')),
        h('div', { style: { fontSize: 12, color: '#36507e', background: '#eef4ff', borderLeft: '3px solid #3370ff', borderRadius: 5, padding: '9px 12px', lineHeight: 1.7, marginBottom: 12 } }, '数据口径：蓝线从 daily_sales.inventory 起算，在每条系统建议的 add_date 加入 simulate_shipment.number，再按 maybe_sales 逐日计算；黄线按 sale_inventory + sale_maybe_sales 逐日计算。实际计划只读取发货日期从当前 W1 起、数量大于 0 的旧 simulate_shipment 记录，不以是否生成货件编号判断；系统建议读取 simulate_shipment.plan_source=shipment_plan_v2。当前 W1 之前的计划视为已经发走并转为在途，不再单独展示。', h('b', { style: { color: '#1f2329' } }, '格子主数、图表节点和蓝线使用同一套系统建议；紫线只显示拖动调整后的结果，黄线不叠加系统建议。拖动和审批只改系统建议，不改实际计划。净额列 = 只读结果 = W6+W7 建议量 − 未交货余量（2.5.2）。'), '净额 = 0 时本批不下新单。周二采购在净额区「生成下单计划」→ 下单执行看板（工厂×规格 · 调拨在看板算）→ 终审。')) : null,
      h(V19RoleBar, { role, mine, counts, batchSigned, poGenerated, orderWeek, onRole: setRole, onMine: setMine, onBatch: () => setBatchOpen(true), onGeneratePO: generatePO, onAllPass: allPass }),
      role === 'final' && (orderWeek || Object.values(changes).some((change) => change.status === 'fin')) ? h(V19FinalPanel, { rows: productViews, changes, signed: batchSigned, poGenerated, approved: poApproved, onApprove: approvePO, onOpenDetail: (row, weekIndex) => setDetail({ row, weekIndex }) }) : null,
      inflight ? h('div', { style: { margin: '8px 0', padding: '8px 12px', border: '1px solid #f0c36d', background: '#fff8e6', borderRadius: 8, fontSize: 12.5, color: '#7a4d00' } }, '⚠ ', h('b', null, '销售提交的修改需求进入审核流'), '；当前 ', h('b', null, inflight), ' 条在途。', h('span', { style: { color: '#8a9099' } }, '（原型：提交即计入状态机）')) : null,
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h(V19ScopeControls, { selectedSale, saleOptions, productCount: scopedProducts.length, loading: catalogLoading || loading, onSaleChange: changeSale })),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingLeft: 12, borderLeft: '1px solid #dfe4eb' } },
          h('span', { style: { fontSize: 12.5, fontWeight: 700, color: '#3a4763' } }, '筛选'),
          h(Select, { allowClear: true, showSearch: true, optionFilterProp: 'label', size: 'small', value: siteFilter || undefined, placeholder: '全部站点', onChange: (value) => setSiteFilter(value || ''), options: siteOptions, style: { width: 140 } }),
          h(Select, { allowClear: true, showSearch: true, optionFilterProp: 'label', size: 'small', value: modelFilter || undefined, placeholder: '全部型号', onChange: (value) => setModelFilter(value || ''), options: modelOptions, style: { width: 180 } }),
          h(Select, { mode: 'multiple', allowClear: true, maxTagCount: 'responsive', size: 'small', value: labelFilter, placeholder: '全部产品标签', onChange: setLabelFilter, options: ['新品期', '成长期', '成熟期', '淘汰期'].map((value) => ({ value, label: value })), style: { width: 260 } }),
          h(Checkbox, { checked: onlyWarning, onChange: (event) => setOnlyWarning(event.target.checked) }, '仅看预警'),
          h(Checkbox, { checked: onlyChanged, onChange: (event) => setOnlyChanged(event.target.checked) }, '仅看本周动过的'))),
      h(V19Legend),
      catalogError ? h('div', { style: { padding: 10, border: '1px solid #f2b8b5', background: '#fff1f0', color: '#a61d24', borderRadius: 8, marginBottom: 10 } }, catalogError) : null,
      error ? h('div', { style: { padding: 10, border: '1px solid #f2b8b5', background: '#fff1f0', color: '#a61d24', borderRadius: 8, marginBottom: 10 } }, error) : null,
      catalogLoading || loading ? h('div', { style: { minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h(Spin, { size: 'large', tip: '正在读取普通水位、销售预估水位、系统建议、上周基线和当前 W1 起的实际计划...' })) : visibleRows.length ? h(V19Table, { rows: visibleRows, allScopeRows: productViews, changes, confirmedRows, role, orderWeek, poApproved, logisticsLeads, onEdit: openEdit, onOpenDetail: (row, weekIndex) => { setAuditNote(''); setDetail({ row, weekIndex }); } }) : h(Empty, { description: mine ? '当前角色没有待处理商品' : '当前筛选范围没有商品' })),
    h(V19EditModal, { target: editTarget, loading: actionLoading, onClose: () => setEditTarget(null), onSubmit: submitEdit }),
    h(V19ChangeDrawer, { detail, role, changes, auditNote, onAuditNote: setAuditNote, onClose: () => setDetail(null), onEdit: openEdit, onAction: actionChange }),
    h(V19BatchModal, { open: batchOpen, rows: productViews, changes, signed: batchSigned, onClose: () => setBatchOpen(false), onSign: signBatch, onAction: actionChange, onOpenDetail: (row, weekIndex) => { setBatchOpen(false); setDetail({ row, weekIndex }); } }));
}

ctx.render(h(ShipmentEvolutionBlockV19));
