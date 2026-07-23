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
  date.setHours(0, 0, 0, 0);
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
        page: 1, pageSize: 1000, fields: 'username,manager',
        filter: JSON.stringify({ manager: { $eq: CURRENT_USERNAME } }),
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
        'sale_maybe_sales', 'inventory', 'days_for_sale', 'quantity_receive', 'add', 'on_the_way',
        'v2_add', 'v2_inventory', 'v2_days_for_sale', 'v2_on_the_way', 'v2_calculated_at',
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
      ].join(','),
      filter: JSON.stringify({ $and: filters }),
    },
    });
  });
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

function buildWeeks(shipments, realSupplyRows = []) {
  const first = nextMonday(new Date());
  return Array.from({ length: 7 }, (_, index) => {
    const start = addDays(first, index * 7);
    const end = addDays(start, 6);
    const rows = shipments.filter((row) => inRange(row.date, start, end));
    const actualRows = realSupplyRows.filter((row) => inRange(row.expected_storage_time, start, end));
    const quantity = rows.reduce((sum, row) => sum + numberValue(row.number), 0);
    const actualQty = actualRows.reduce((sum, row) => sum + numberValue(row.remaining), 0);
    const addDates = rows.map((row) => parseDate(row.add_date)).filter(Boolean).sort((a, b) => a - b);
    const coverStart = addDates.length ? addDays(addDates[0], 7) : null;
    const coverEnd = addDates.length ? addDays(addDates[addDates.length - 1], 13) : null;
    return {
      key: `W${index + 1}`, index, start, end, rows, actualRows, quantity, actualQty, totalQty: quantity + actualQty,
      coverStart, coverEnd,
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

function InfoBox({ children, tone = 'blue' }) {
  const palette = tone === 'gold'
    ? { bg: '#fff8e6', border: '#f0c36d', text: '#704800' }
    : { bg: '#eef4ff', border: '#bcd2ff', text: '#2b477a' };
  return h('div', { style: {
    background: palette.bg, border: `1px solid ${palette.border}`, color: palette.text,
    borderRadius: 8, padding: '9px 13px', fontSize: 14, lineHeight: 1.7, fontWeight: 500,
  } }, children);
}

function SaleSwitcher({ selectedSale, saleOptions, productCount, loading, onSaleChange }) {
  return h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', background: '#f8fafc',
    border: '1px solid #dfe4eb', borderRadius: 8, flexWrap: 'wrap', marginBottom: 8,
  } },
  h('b', { style: { fontSize: 14, whiteSpace: 'nowrap' } }, '商品范围'),
  CAN_SELECT_SALE
    ? h(React.Fragment, null,
      h('span', { style: { fontSize: 13.5, color: '#475467' } }, '销售'),
      h(Select, {
        size: 'middle', showSearch: true, optionFilterProp: 'label', loading, disabled: loading,
        value: selectedSale,
        options: saleOptions,
        onChange: onSaleChange,
        style: { width: 180 },
      }))
    : h(Tag, { color: 'blue', bordered: false, style: { marginInlineEnd: 0, fontSize: 13.5 } }, `当前销售：${CURRENT_USERNAME || '未识别'}`),
  h(Tag, { color: 'blue', bordered: false, style: { marginInlineEnd: 0, fontSize: 13.5 } }, `${productCount} 个商品直接展示`));
}

function ShopSwitcher({ params, shops, loading, onChange, onRefresh }) {
  const list = [TOTAL_SHOP, ...shops.filter((shop) => shop !== TOTAL_SHOP)];
  return h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 7, padding: '8px 10px', background: '#f6f9ff',
    border: '1px solid #dbe7fa', borderRadius: 8, overflowX: 'auto', marginBottom: 10,
  } },
  h(ShopOutlined || 'span', { style: { color: C.blue } }),
  h('b', { style: { fontSize: 14, whiteSpace: 'nowrap' } }, '店铺选择'),
  ...list.map((shop) => h(Button, {
    key: shop, size: 'middle', type: params.shop === shop ? 'primary' : 'default',
    onClick: () => onChange(shop), style: { borderRadius: 6, fontWeight: 700, fontSize: 13.5, flex: '0 0 auto' },
  }, shop)),
  h(Tag, { color: 'blue', style: { marginLeft: 2, fontSize: 13.5 } }, `${Math.max(0, list.length - 1)} 个店铺`),
  h(Tooltip, { title: '重新读取店铺和计划数据' }, h(Button, {
    size: 'middle', icon: h(ReloadOutlined || 'span'), loading, onClick: onRefresh, style: { marginLeft: 'auto', fontSize: 13.5 },
  }, '刷新')));
}

function RoleBar() {
  const roles = ['销售', '主管', '采购', '终审'];
  return h('div', { style: {
    display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', background: '#f3f6fb',
    border: '1px solid #e0e7f1', borderRadius: 9, padding: '9px 13px', marginBottom: 12,
  } },
  h('b', { style: { fontSize: 14, color: '#3a4763' } }, '角色透镜'),
  ...roles.map((role, index) => h(Tooltip, { key: role, title: '当前数据表没有审批状态字段，暂不启用' },
    h('span', { style: {
      fontSize: 14, fontWeight: 700, color: index === 0 ? '#fff' : '#667085', borderRadius: 8,
      padding: '6px 13px', background: index === 0 ? C.ink : '#fff', border: '1px solid #dfe4eb', cursor: 'not-allowed',
    } }, role, h('span', { style: {
      marginLeft: 7, fontSize: 12, background: index === 0 ? '#ff6b60' : '#98a2b3', color: '#fff', borderRadius: 9, padding: '0 6px',
    } }, '0')))),
  h(Segmented, { size: 'middle', disabled: true, value: '全部', options: ['待我处理', '全部'] }),
  h(Button, { disabled: true, type: 'primary', style: { marginLeft: 'auto', background: C.green } }, '✓ 全表一键通过'),
  h('div', { style: { width: '100%', fontSize: 13, color: '#667085', lineHeight: 1.6 } },
    '审批与修改申请在 v19 中属于 mock；当前仅复刻界面结构，不伪造待办或审批结果。'));
}

function Legend() {
  const swatch = (color, bg) => h('span', { style: {
    width: 17, height: 13, display: 'inline-block', borderRadius: 3, background: bg, boxShadow: `inset 0 0 0 2px ${color}`,
  } });
  const item = (...children) => h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 12 } }, ...children);
  return h('div', { style: {
    border: '1px solid #e1e5eb', borderRadius: 8, background: '#fbfcfe', padding: '8px 11px',
    fontSize: 13, color: '#475467', lineHeight: 1.8, marginBottom: 10,
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
  const chartDays = (row) => dateText(row.date) <= todayText()
    ? numberValue(row.days_for_sale)
    : numberValue(row.v2_days_for_sale, NaN);
  const maxY = Math.max(28, SAFE_MAX_DAYS + 4, ...points.map(chartDays).filter(Number.isFinite));
  const x = (index) => left + (points.length <= 1 ? 0 : (index / (points.length - 1)) * plotW);
  const y = (value) => top + plotH - (Math.max(0, Math.min(maxY, numberValue(value))) / maxY) * plotH;
  const path = points.map((row, index) => `${index ? 'L' : 'M'} ${x(index).toFixed(1)} ${y(chartDays(row)).toFixed(1)}`).join(' ');
  const weekMarks = weeks.map((week) => {
    const index = points.findIndex((row) => dateText(row.date) >= formatDate(week.start));
    return index < 0 ? null : { ...week, x: x(index) };
  }).filter(Boolean);
  return h('div', { style: { overflowX: 'auto' } },
    h('svg', { viewBox: `0 0 ${width} ${height}`, style: { width: '100%', minWidth: 900, display: 'block' } },
      h('rect', { x: left, y: y(SAFE_MAX_DAYS), width: plotW, height: y(SAFE_MIN_DAYS) - y(SAFE_MAX_DAYS), fill: '#e9f7ee' }),
      h('line', { x1: left, x2: left + plotW, y1: y(SAFE_MIN_DAYS), y2: y(SAFE_MIN_DAYS), stroke: C.orange, strokeDasharray: '6 5' }),
      h('line', { x1: left, x2: left + plotW, y1: y(SAFE_MAX_DAYS), y2: y(SAFE_MAX_DAYS), stroke: C.green, strokeDasharray: '6 5' }),
      h('text', { x: 5, y: y(SAFE_MIN_DAYS) + 4, fontSize: 12.5, fontWeight: 700, fill: C.orange }, '7 天'),
      h('text', { x: 2, y: y(SAFE_MAX_DAYS) + 4, fontSize: 12.5, fontWeight: 700, fill: C.green }, '14 天'),
      ...weekMarks.map((mark) => h('g', { key: mark.key },
        h('line', { x1: mark.x, x2: mark.x, y1: top, y2: top + plotH, stroke: '#d8dee8', strokeDasharray: '3 4' }),
        h('circle', { cx: mark.x, cy: top + plotH - 5, r: Math.min(7, 3 + Math.sqrt(mark.quantity) / 7), fill: mark.index >= 5 ? '#d79b32' : '#7aa4ff' }),
        h('text', { x: mark.x, y: height - 8, textAnchor: 'middle', fontSize: 12, fontWeight: 600, fill: '#667085' }, mark.key))),
      h('path', { d: path, fill: 'none', stroke: C.blue, strokeWidth: 2.5, strokeLinejoin: 'round', strokeLinecap: 'round' }),
    ),
    h('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: '#667085', padding: '0 8px' } },
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
  hasNew ? h('span', { style: { position: 'absolute', top: 5, right: 6, color: '#7c3aed', fontWeight: 900, fontSize: 12.5 } }, '⟳') : null,
  h('div', { style: { fontSize: 20, fontWeight: 850, fontVariantNumeric: 'tabular-nums', color: isOrder ? '#8b5700' : C.ink } }, week.quantity ? fmt(week.quantity) : '—'),
  h('div', { style: { marginTop: 3, fontSize: 12.5, color: '#667085' } },
    week.rows.length ? `${week.rows.length} 条 · ${hasNew ? '含新算法' : '原有计划'}` : '该周无排'),
  week.coverStart || week.coverEnd
    ? h('div', { style: { marginTop: 2, fontSize: 11.5, color: '#7d6a43', whiteSpace: 'nowrap' } },
      `可售 ${shortDate(week.coverStart)}~${shortDate(week.coverEnd)}`)
    : null);
}

function EvolutionTable({ rows }) {
  const [expandedKey, setExpandedKey] = useState('');
  const [w12Open, setW12Open] = useState(false);
  const [drawerItem, setDrawerItem] = useState(null);
  useEffect(() => {
    setExpandedKey('');
    setDrawerItem(null);
  }, [rows]);
  const foldWeeks = (weeks) => (w12Open ? weeks : [{
    key: 'W1–W2', folded: true, quantity: weeks[0].quantity + weeks[1].quantity,
    rows: [...weeks[0].rows, ...weeks[1].rows], start: weeks[0].start, end: weeks[1].end,
  }, ...weeks.slice(2)]);
  const headerWeeks = foldWeeks(buildWeeks([]));
  const headCell = (text, options = {}) => {
    const { rowSpan, colSpan, ...style } = options;
    return h('th', { rowSpan, colSpan, style: {
    padding: '8px 7px', borderRight: '1px solid #dce1e8', borderBottom: '1px solid #dce1e8',
    fontSize: 13, lineHeight: 1.45, fontWeight: 700, textAlign: 'center', color: '#344054', whiteSpace: 'nowrap', ...style,
    } }, text);
  };
  return h(React.Fragment, null,
    h('div', { style: { overflowX: 'auto', border: '1px solid #dce1e8', borderRadius: 8 } },
      h('table', { style: { width: '100%', minWidth: w12Open ? 1680 : 1560, borderCollapse: 'separate', borderSpacing: 0, background: '#fff', fontVariantNumeric: 'tabular-nums' } },
        h('thead', null,
          h('tr', null,
            h('th', { colSpan: 9, style: { padding: 9, background: '#eaf7ef', color: '#17603b', borderBottom: '1px solid #cfe8d8', fontSize: 14 } },
              '商品信息（看一眼就能初判：要不要备、能不能备）'),
            h('th', { colSpan: headerWeeks.length, style: { padding: 9, background: '#fff4df', color: '#805000', borderBottom: '1px solid #edd8aa', fontSize: 14 } },
              '发货周次（W1 = 下周；W6–W7 为本期下单批）'),
            h('th', { rowSpan: 4, style: { width: 180, background: '#fff0c8', color: '#764900', borderLeft: '1px solid #e6c56b', fontSize: 14 } },
              '需新下厂', h('div', { style: { fontSize: 12.5, fontWeight: 600, marginTop: 3 } }, '净额 · PO 唯一依据'))),
          h('tr', null,
            headCell('趋势', { rowSpan: 3, width: 38, background: '#f4f8f5' }),
            ...['站点', '销售', '型号', 'ASIN', '加权日均', '等级', '库销比', '标签'].map((title) => headCell(title, { rowSpan: 3, background: '#f4f8f5' })),
            ...headerWeeks.map((week) => headCell(week.key, {
              background: week.folded ? '#f4f6fa' : (week.index >= 5 ? '#fff1d5' : '#fff8eb'),
              color: week.index >= 5 ? '#8b5700' : '#475467', fontWeight: 850,
            }))),
          h('tr', null, ...headerWeeks.map((week) => headCell(`${shortDate(week.start)}~${shortDate(week.end)}`, {
            background: week.index >= 5 ? '#fff5df' : '#fbfcfe', fontSize: 12.5,
          }))),
          h('tr', null, ...headerWeeks.map((week) => headCell(week.folded ? '点开看两周' : '每行按预计入库计算', {
            background: week.index >= 5 ? '#fff8ea' : '#fff', color: '#667085', fontSize: 12,
          })))),
        h('tbody', null, ...rows.map((row) => {
          const shownWeeks = foldWeeks(row.weeks);
          const netScopeWeeks = row.netWeeks || row.weeks;
          const orderQty = netScopeWeeks[5].quantity + netScopeWeeks[6].quantity;
          const quantityReceive = numberValue(row.waterRow?.quantity_receive ?? row.totalRow?.quantity_receive);
          const earlierCommitted = netScopeWeeks.slice(0, 5).reduce((sum, week) => sum + numberValue(week.quantity), 0);
          const undelivered = Math.max(0, quantityReceive - earlierCommitted);
          const net = Math.max(0, orderQty - undelivered);
          const summaryRow = row.summaryRow;
          const ratio = row.ratio;
          const productCells = [
            row.product.country || '-', row.product.sale_owner || '-', row.product.model || '-', row.product.asin || '-',
            row.noShopData ? '该店铺无数据' : fmt(summaryRow?.weighted_sales, 1),
            row.levelName || '未配置', `${fmt(ratio.value, 1)} ${row.waterRow?.status || ratio.name}`, row.waterRow?.product_label || '未配置',
          ];
          const expanded = expandedKey === row.key;
          return h(React.Fragment, { key: row.key },
          h('tr', null,
            h('td', { onClick: () => setExpandedKey((value) => value === row.key ? '' : row.key), style: {
              textAlign: 'center', borderRight: '1px solid #e3e7ed', borderBottom: '1px solid #e3e7ed', cursor: 'pointer', background: '#fafbfd',
            } }, h(expanded ? DownOutlined || 'span' : RightOutlined || 'span')),
            ...productCells.map((value, index) => h('td', { key: index, style: {
              padding: '10px 7px', textAlign: index === 3 ? 'left' : 'center', borderRight: '1px solid #e3e7ed',
              borderBottom: '1px solid #e3e7ed', fontSize: 13.5, fontWeight: index === 2 || index === 3 ? 750 : 600,
              whiteSpace: 'nowrap', background: '#fff', color: index === 6 ? ratio.color : C.ink,
            } }, index === 6 ? h('span', { style: { background: ratio.bg, borderRadius: 5, padding: '2px 5px' } }, value) : value)),
            ...shownWeeks.map((week) => week.folded
              ? h('td', { key: week.key, onClick: () => setW12Open(true), title: '点击展开 W1–W2', style: {
                minWidth: 116, textAlign: 'center', background: '#f4f6fa', borderRight: '1px solid #e3e7ed',
                borderBottom: '1px solid #e3e7ed', cursor: 'pointer', fontWeight: 800,
              } }, `${fmt(week.quantity)} 🔒`, h('div', { style: { fontSize: 12, fontWeight: 600, color: '#667085' } }, '点开 ▸'))
              : h(WeekCell, { key: week.key, week, isOrder: week.index >= 5, onOpen: (selectedWeek) => setDrawerItem({ product: row.product, week: selectedWeek }) })),
            h('td', { style: {
              minWidth: 170, padding: '9px 10px', background: '#fff9e8', textAlign: 'center', borderBottom: '1px solid #e3e7ed',
            } },
            h('div', { style: { fontSize: 24, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: net ? '#8b5700' : C.green } }, fmt(net)),
            h('div', { style: { fontSize: 12.5, color: '#7d6a43', fontWeight: 600 } }, `计划 ${fmt(orderQty)} − 未交货余 ${fmt(undelivered)}`),
            h('div', { style: { fontSize: 12, color: '#7d6a43', marginTop: 2 } },
              `合计未交货 ${fmt(quantityReceive)} − W1~W5占用 ${fmt(earlierCommitted)}`))),
          expanded ? h('tr', null, h('td', { colSpan: 9 + shownWeeks.length + 1, style: { padding: 14, background: '#fbfcfe' } },
            h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 } },
              h('b', { style: { fontSize: 14 } }, `${row.product.asin} · 到货与安全库存天数趋势`),
              h(Button, { size: 'middle', onClick: () => setW12Open((value) => !value) }, w12Open ? '收起 W1–W2' : '展开 W1–W2')),
            h(SafetyChart, { dailyRows: row.dailyRows, weeks: row.weeks }))) : null);
        })))),
    h(Drawer, {
      title: drawerItem ? `${drawerItem.product.asin} · ${drawerItem.week.key} 发货计划明细` : '发货计划明细', open: Boolean(drawerItem),
      onClose: () => setDrawerItem(null), width: 560,
    }, drawerItem && drawerItem.week.rows.length
      ? h('div', null, ...drawerItem.week.rows.map((shipment) => h('div', { key: shipment.id, style: {
        border: '1px solid #e1e5eb', borderLeft: `4px solid ${shipment.plan_source === PLAN_SOURCE ? C.blue : '#98a2b3'}`,
        borderRadius: 8, padding: 12, marginBottom: 10,
      } },
      h('div', { style: { display: 'flex', justifyContent: 'space-between', gap: 10 } },
        h('b', null, `${dateText(shipment.date)} · ${shipment.shop || '-'}`),
        h(Tag, { color: shipment.plan_source === PLAN_SOURCE ? 'blue' : 'default', bordered: false }, sourceName(shipment.plan_source))),
      h('div', { style: { fontSize: 24, fontWeight: 850, margin: '8px 0' } }, `${fmt(shipment.number)} 台`),
      h('div', { style: { fontSize: 13.5, color: C.muted, lineHeight: 1.8 } },
        `渠道：${shipment.channel || '-'}　预计入库：${dateText(shipment.add_date) || '-'}　淡旺季：${shipment.season || '-'}`))))
      : h(Empty, { description: '该周没有计划记录' })));
}

const V19_ROLE_NAME = { sale: '销售', lead: '主管', ops: '采购', final: '终审', readonly: '只读' };
const V19_STATUS_OWNER = { yel: 'sale', org: 'lead', ops: 'ops', fin: 'final', rej: 'sale' };
const V19_STATUS_TEXT = {
  ok: '已生效', sub: '工作流处理中', yel: '待销售确认', org: '待主管审', ops: '待采购审', fin: '待终审', rej: '已驳回',
};
const V19_STATUS_STYLE = {
  sub: { border: '#8b6cf0', bg: '#f6f3ff', color: '#4b2fb0' },
  yel: { border: '#e5c14e', bg: '#fffdf0', color: '#7a4d00' },
  org: { border: '#e8912a', bg: '#fff8ee', color: '#9c4a00' },
  ops: { border: '#3370ff', bg: '#f0f5ff', color: '#1d3f8f' },
  fin: { border: '#8b6cf0', bg: '#f6f3ff', color: '#4b2fb0' },
  rej: { border: '#e34d42', bg: '#fdf0ef', color: '#9c3b32' },
  ok: { border: '#dfe4eb', bg: '#fff', color: '#1f2329' },
};
const V19_CHANGE_MARK = { up: '↑', down: '↓', advance: '←', delay: '→', air: '✈', sys: '⟳' };
const V19_CHANGE_LABEL = { up: '加发', down: '减发', advance: '提前', delay: '推迟', air: '改运输方式', sys: '系统重算' };
const V19_LIFE = {
  新品期: { bg: '#e6efff', color: '#1d5fc4' }, 新品: { bg: '#e6efff', color: '#1d5fc4' },
  成长期: { bg: '#e2f6eb', color: '#147a43' }, 成长: { bg: '#e2f6eb', color: '#147a43' },
  成熟期: { bg: '#e6efec', color: '#3a6657' }, 成熟: { bg: '#e6efec', color: '#3a6657' },
  淘汰期: { bg: '#f3e2e1', color: '#9c3b32' }, 淘汰: { bg: '#f3e2e1', color: '#9c3b32' },
};

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
    h('span', { style: { fontSize: 12, color: '#5a6169' } }, `${productCount} 个 ASIN`),
    h('span', { style: { fontSize: 12.5, fontWeight: 700, color: '#1a5fb4', background: '#e7f0fd', border: '1px solid #b9d4f5', borderRadius: 6, padding: '2px 9px' } }, '区域合计口径'));
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
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 15, flexWrap: 'wrap' } }, item(h('b', { style: { color: '#1f2329' } }, '周段闸：')), item('🔒 ', h('b', null, 'W1–W2'), ' 不允许减量；销售可提前、加量、改渠道，但不可推迟，提交后走主管；采购仅在 W1–W2 可应急直改'), item(h('b', { style: { color: '#1d5fc4' } }, 'W3–W5'), ' 已承诺 · 服务端按修改后 7–14 天或不劣于系统建议判闸'), item(h('b', { style: { color: '#b06a00' } }, 'W6 已承诺'), '（系统不重算 · PO 前可提异议）· ', h('b', { style: { color: '#b06a00' } }, 'W7 前沿'), ' 未承诺 —— 调量＝下单异议 → 安全区间闸（安全或不劣于系统建议则免审；出界走下单链 销售→采购→终审，决策 27）· ', h('b', null, 'PO 落地后双周真锁 🔒'))));
}

function ShipmentEvolutionBlockLegacy() {
  const [params, setParams] = useState(readParamsSync);
  const [products, setProducts] = useState([]);
  const [catalogReady, setCatalogReady] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [selectedSale, setSelectedSale] = useState(CAN_SELECT_SALE ? ALL_SALES : CURRENT_USERNAME);
  const [shops, setShops] = useState([]);
  const [dailyRows, setDailyRows] = useState([]);
  const [totalRows, setTotalRows] = useState([]);
  const [shipments, setShipments] = useState([]);
  const [waterRows, setWaterRows] = useState([]);
  const [modelLevels, setModelLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sourceFilter, setSourceFilter] = useState('全部');
  const [onlyWarning, setOnlyWarning] = useState(false);
  const [refreshSeed, setRefreshSeed] = useState(0);
  const requestSequence = useRef(0);

  useEffect(() => {
    let active = true;
    Promise.all([resolveParams(), requestEligibleProducts()])
      .then(([initialParams, productRows]) => {
        if (!active) return;
        setProducts(productRows);
        const saleNames = Array.from(new Set(productRows.map((row) => row.sale_owner).filter(Boolean)));
        const requestedProduct = productRows.find((row) => row.asin === initialParams.asin && row.country === initialParams.country);
        const nextSale = CAN_SELECT_SALE
          ? (initialParams.sale === ALL_SALES || saleNames.includes(initialParams.sale)
            ? initialParams.sale
            : (requestedProduct?.sale_owner || ALL_SALES))
          : CURRENT_USERNAME;
        if (productRows.length) {
          const nextShop = initialParams.shop || TOTAL_SHOP;
          setSelectedSale(nextSale);
          setParams({ sale: nextSale, shop: nextShop });
          if (initialParams.sale !== nextSale || initialParams.asin || initialParams.country) replaceSaleParams(nextSale, nextShop);
        } else {
          setParams({ sale: nextSale, shop: TOTAL_SHOP });
          setCatalogError(!CAN_SELECT_SALE && !CURRENT_USERNAME
            ? '无法识别当前登录用户，不能确定可查看的商品范围。'
            : '当前查看范围内没有状态为普通、新品或重点的非变体 ASIN。');
        }
      })
      .catch((requestError) => {
        if (!active) return;
        setProducts([]);
        setParams({ sale: CAN_SELECT_SALE ? ALL_SALES : CURRENT_USERNAME, shop: TOTAL_SHOP });
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
        const saleNames = new Set(products.map((row) => row.sale_owner).filter(Boolean));
        const nextSale = CAN_SELECT_SALE && (next.sale === ALL_SALES || saleNames.has(next.sale)) ? next.sale : (CAN_SELECT_SALE ? ALL_SALES : CURRENT_USERNAME);
        setSelectedSale(nextSale);
        setParams({ sale: nextSale, shop: next.shop || TOTAL_SHOP });
      }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [catalogReady, products]);

  const saleOptions = useMemo(() => {
    const names = Array.from(new Set(products.map((row) => row.sale_owner).filter(Boolean)))
      .sort((a, b) => String(a).localeCompare(String(b), 'zh-CN'));
    return [{ value: ALL_SALES, label: '全部销售' }, ...names.map((name) => ({ value: name, label: name }))];
  }, [products]);
  const scopedProducts = useMemo(() => (
    CAN_SELECT_SALE && selectedSale !== ALL_SALES
      ? products.filter((row) => row.sale_owner === selectedSale)
      : products
  ), [products, selectedSale]);
  const scopeSignature = useMemo(() => scopedProducts.map(productKey).join('|'), [scopedProducts]);

  const loadData = useCallback(async () => {
    if (!catalogReady) return;
    const requestId = ++requestSequence.current;
    if (!scopedProducts.length) {
      setDailyRows([]); setTotalRows([]); setShipments([]); setShops([]);
      setWaterRows([]); setModelLevels([]);
      setError(''); setLoading(false); return;
    }
    const activeShop = params.shop || TOTAL_SHOP;
    setLoading(true); setError('');
    try {
      const needsSeparateTotal = activeShop !== TOTAL_SHOP;
      const dailyPromise = requestDailySales(scopedProducts, activeShop);
      const [shopData, dailyData, totalData, shipmentData, waterData, levelData] = await Promise.all([
        requestShops(scopedProducts),
        dailyPromise,
        needsSeparateTotal ? requestDailySales(scopedProducts, TOTAL_SHOP) : dailyPromise,
        requestShipments(scopedProducts, activeShop),
        requestWaterProducts(scopedProducts),
        requestModelLevels(scopedProducts),
      ]);
      if (requestId !== requestSequence.current) return;
      const shopList = shopData.map((row) => row.shop).filter(Boolean).filter((shop) => shop !== TOTAL_SHOP);
      const shipmentShops = shipmentData.map((row) => row.shop).filter(Boolean).filter((shop) => shop !== TOTAL_SHOP);
      setShops(Array.from(new Set([...shopList, ...shipmentShops])));
      setDailyRows(dailyData); setTotalRows(totalData); setShipments(shipmentData);
      setWaterRows(waterData); setModelLevels(levelData);
    } catch (requestError) {
      if (requestId !== requestSequence.current) return;
      setDailyRows([]); setTotalRows([]); setShipments([]);
      setWaterRows([]); setModelLevels([]);
      setError(requestError?.message || String(requestError));
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [catalogReady, scopeSignature, params.shop, refreshSeed]);

  useEffect(() => { loadData(); }, [loadData]);

  const filteredShipments = useMemo(() => {
    if (sourceFilter === '新算法') return shipments.filter((row) => row.plan_source === PLAN_SOURCE);
    if (sourceFilter === '原有计划') return shipments.filter((row) => row.plan_source !== PLAN_SOURCE);
    return shipments;
  }, [shipments, sourceFilter]);
  const productViews = useMemo(() => scopedProducts.map((product) => {
    const key = productKey(product);
    const dataKey = rowProductKey(product);
    const matches = (row) => rowProductKey(row) === dataKey;
    const productDailyRows = dailyRows.filter(matches);
    const productTotalRows = totalRows.filter(matches);
    const productShipments = filteredShipments.filter(matches);
    const productAllShipments = shipments.filter(matches);
    const waterRow = waterRows.find(matches) || null;
    const currentRow = productDailyRows.find((row) => dateText(row.date) === todayText()) || null;
    const totalRow = productTotalRows.find((row) => dateText(row.date) === todayText()) || null;
    const summaryRow = currentRow;
    const ratio = ratioInfo(waterRow);
    const levelName = modelLevels.find((row) => row.country === product.country && row.model === product.model)?.level_name || '';
    return {
      key, product, dailyRows: productDailyRows, totalRow, waterRow, summaryRow, ratio, levelName,
      weeks: buildWeeks(productShipments), netWeeks: buildWeeks(productAllShipments),
      noShopData: params.shop !== TOTAL_SHOP && !currentRow,
    };
  }), [scopedProducts, dailyRows, totalRows, filteredShipments, shipments, waterRows, modelLevels, params.shop]);
  const visibleViews = useMemo(() => onlyWarning
    ? productViews.filter((row) => row.ratio.name !== '正常')
    : productViews, [productViews, onlyWarning]);

  function changeSale(sale) {
    setSelectedSale(sale);
    setSourceFilter('全部');
    setParams({ sale, shop: TOTAL_SHOP });
    replaceSaleParams(sale, TOTAL_SHOP);
  }

  function changeShop(shop) {
    setSourceFilter('全部'); setParams((current) => ({ ...current, shop })); replaceShopParam(shop);
  }

  return h('div', { style: {
    padding: 14, background: C.page, color: C.ink, border: '1px solid #dfe4eb', borderRadius: 9,
    fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif',
    fontSize: 14, lineHeight: 1.6, textRendering: 'optimizeLegibility', WebkitFontSmoothing: 'antialiased',
    fontVariantNumeric: 'tabular-nums',
  } },
  h('div', { style: { display: 'flex', alignItems: 'center', gap: 9, flexWrap: 'wrap', marginBottom: 10 } },
    h('span', { style: { fontSize: 21 } }, '📦'),
    h(Typography.Title, { level: 4, style: { margin: 0, fontSize: 22 } }, '发货计划演变'),
    h(Tag, { color: 'blue', bordered: false }, 'v19 · 真实数据版'),
    h(Tag, { color: shipments.some((row) => row.plan_source === PLAN_SOURCE) ? 'cyan' : 'default', bordered: false },
      shipments.some((row) => row.plan_source === PLAN_SOURCE) ? '已接入新算法' : '等待新算法数据'),
    h('span', { style: { marginLeft: 'auto', fontSize: 13, color: C.muted } }, `${selectedSale === ALL_SALES ? '全部销售' : selectedSale || '-'} · ${scopedProducts.length} 个商品 · ${params.shop || TOTAL_SHOP}`)),
  h('div', { style: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '7px 14px', background: '#fff', border: '1px solid #d8dee8', borderBottom: `2px solid ${C.blue}`, borderRadius: '7px 7px 0 0', fontSize: 14, fontWeight: 800, marginBottom: 9 } },
    h(GlobalOutlined || 'span'), '全部站点 · 统一系统'),
  h('div', { style: { background: C.panel, border: '1px solid #dfe4eb', borderRadius: 9, padding: 12 } },
    h(SaleSwitcher, {
      selectedSale,
      saleOptions,
      productCount: scopedProducts.length,
      loading: catalogLoading,
      onSaleChange: changeSale,
    }),
    h(ShopSwitcher, { params, shops, loading: catalogLoading || loading, onChange: changeShop, onRefresh: () => setRefreshSeed((value) => value + 1) }),
    h('div', { style: { fontSize: 14, lineHeight: 1.7, color: '#475467', marginBottom: 10 } },
      '当前表格直接展示所选销售名下的全部商品。系统每周滚动计算发货计划，格子为各商品该周应发量；',
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
      h('b', { style: { fontSize: 13.5 } }, '筛选'),
      h('span', { style: { fontSize: 13.5 } }, '仅看预警'), h(Switch, { checked: onlyWarning, onChange: setOnlyWarning }),
      h('span', { style: { marginLeft: 'auto', fontSize: 13, color: C.muted } }, `${visibleViews.length} 条`),
      h(Segmented, { size: 'middle', value: sourceFilter, options: ['全部', '新算法', '原有计划'], onChange: setSourceFilter })),
    h(Legend),
    catalogLoading || loading ? h('div', { style: { minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      h(Spin, { size: 'large', tip: catalogLoading ? '正在识别当前用户的商品范围...' : '正在读取 daily_sales 与 simulate_shipment...' }))
      : visibleViews.length ? h(EvolutionTable, { rows: visibleViews })
        : h(Empty, { description: onlyWarning ? '当前销售范围内没有预警商品' : '当前范围内没有可查看的商品' }),
    h('div', { style: { marginTop: 8 } }, h(InfoBox, null,
      'W8+ 为系统预览区，本面板暂不展示。当前店铺选择为“合计”时，daily_sales 使用合计行，simulate_shipment 汇总实际店铺记录；选择具体店铺后，两者均切换到该店铺。'))));
}

function v19ChangeKey(rowKey, weekIndex) { return `${rowKey}::${weekIndex}`; }
function v19WeekValue(row, weekIndex, changes, useNetScope = false) {
  const change = changes[v19ChangeKey(row.key, weekIndex)];
  const weeks = useNetScope ? (row.netWeeks || row.weeks) : row.weeks;
  return change && Number.isFinite(Number(change.to)) ? Number(change.to) : numberValue(weeks[weekIndex]?.quantity);
}
function v19ActualWeekValue(row, weekIndex, useNetScope = false) {
  const weeks = useNetScope ? (row.netWeeks || row.weeks) : row.weeks;
  return numberValue(weeks[weekIndex]?.actualQty);
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
  const sellable = addDays(arrival, warehouseDays);
  return { shipDate: shiftedShip, arrival, sellable, warehouseDays };
}

function V19TrendChart({ row, changes, role, poApproved, orderWeek, channelOptions, onApply, onSandbox }) {
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
  useEffect(() => { if (typeof onSandbox === 'function') onSandbox(row.key, mods); }, [mods]);

  const W = 1600; const H = 320; const L = 54; const R = 22; const T = 28; const B = 42;
  const plotW = W - L - R; const plotH = H - T - B;
  const todayIndex = 5; const compress = 0.16;
  const fallbackDaily = Math.max(0.1, numberValue(row.summaryRow?.weighted_sales, numberValue(row.summaryRow?.maybe_sales, 0.1)));
  const startDate = addDays(parseDate(todayText()), -todayIndex);
  const latestDailyDate = row.dailyRows.reduce((latest, item) => {
    const value = parseDate(item.date);
    return value && (!latest || value > latest) ? value : latest;
  }, null);
  const fallbackEndDate = addDays(startDate, 97);
  const endDate = latestDailyDate && latestDailyDate >= startDate ? latestDailyDate : fallbackEndDate;
  const N = Math.max(todayIndex + 1, Math.round((endDate - startDate) / 86400000) + 1);
  const breakIndex = Math.min(42, Math.max(0, N - 2));
  const dates = Array.from({ length: N }, (_, index) => formatDate(addDays(startDate, index)));
  const dailyMap = new Map(row.dailyRows.map((item) => [dateText(item.date), item]));
  const existingValues = dates.map((date) => {
    const value = numberValue(dailyMap.get(date)?.days_for_sale, NaN);
    return Number.isFinite(value) ? value : null;
  });
  const sysValues = dates.map((date, index) => {
    const daily = dailyMap.get(date);
    const value = index <= todayIndex
      ? numberValue(daily?.days_for_sale, NaN)
      : numberValue(daily?.v2_days_for_sale, NaN);
    return Number.isFinite(value) ? value : null;
  });
  const futureV2Ready = sysValues.slice(todayIndex + 1).some(Number.isFinite);
  function nearestValue(values, index, fallback = 0) {
    if (Number.isFinite(values[index])) return values[index];
    for (let offset = 1; offset < values.length; offset += 1) {
      if (index - offset >= 0 && Number.isFinite(values[index - offset])) return values[index - offset];
      if (index + offset < values.length && Number.isFinite(values[index + offset])) return values[index + offset];
    }
    return fallback;
  }
  const frac = (index) => index <= breakIndex ? (index / breakIndex) * compress : compress + ((index - breakIndex) / (N - 1 - breakIndex)) * (1 - compress);
  const px = (index) => L + frac(Math.max(0, Math.min(N - 1, index))) * plotW;
  const indexOfDate = (value) => {
    const parsed = value instanceof Date && !Number.isNaN(value.getTime()) ? value : parseDate(value);
    return parsed ? Math.max(0, Math.min(N - 1, Math.round((parsed - startDate) / 86400000))) : todayIndex;
  };
  function planStorageDate(plan, week, channel, shiftWeeks) {
    const originalStorage = parseDate(plan?.add_date);
    const originalChannel = v19ChannelValue(plan?.channel);
    if (originalStorage && channel === originalChannel) return addDays(originalStorage, shiftWeeks * 7);
    const shipDate = parseDate(plan?.date) || week.start;
    return addDays(shipDate, shiftWeeks * 7 + v19ChannelDays(channel) + Math.max(0, numberValue(plan?.warehouse_days)));
  }
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
    return { index, week, baseQty, channel, baseShift, baseChannelOverride: change?.channel || null, baseDates: v19BatchDates(row, week, change?.channel || null, baseShift) };
  });
  const displayMods = draft ? { ...mods, [draft.index]: draft.mod } : mods;
  const buildNodes = (activeMods) => baseNodes.map((base) => {
    const mod = activeMods[base.index] || {};
    const qty = mod.qty == null ? base.baseQty : Math.max(0, numberValue(mod.qty));
    const shift = Math.max(-2, Math.min(2, mod.shift == null ? base.baseShift : numberValue(mod.shift)));
    const channel = mod.channel || base.channel;
    const datesValue = v19BatchDates(row, base.week, mod.channel || base.baseChannelOverride, shift);
    const storageDate = base.week.rows.length
      ? planStorageDate(base.week.rows[0], base.week, channel, shift)
      : datesValue.sellable;
    const pointIndex = indexOfDate(storageDate);
    return {
      ...base, mod, qty, actualQty: numberValue(base.week.actualQty), totalQty: qty + numberValue(base.week.actualQty), shift, channel, ...datesValue, storageDate, pointIndex,
    };
  });
  const buildPreview = (activeMods) => {
    const nodes = buildNodes(activeMods);
    const adds = new Map(dates.map((date) => [date, numberValue(dailyMap.get(date)?.v2_add)]));
    const adjustAdd = (dateValue, delta) => {
      const key = dateText(dateValue);
      if (!adds.has(key)) return;
      adds.set(key, numberValue(adds.get(key)) + numberValue(delta));
    };
    nodes.forEach((node) => {
      const mod = activeMods[node.index];
      if (!mod || !node.week.rows.length) return;
      const allocations = allocateQuantity(node.qty, node.week.rows);
      node.week.rows.forEach((plan, planIndex) => {
        adjustAdd(plan.add_date, -numberValue(plan.number));
        adjustAdd(planStorageDate(plan, node.week, node.channel, node.shift), allocations[planIndex]);
      });
    });
    const values = sysValues.slice();
    let previousInventory = NaN; let previousDemand = 0;
    dates.forEach((date, index) => {
      if (index < todayIndex) return;
      const daily = dailyMap.get(date);
      if (!daily) { values[index] = null; previousInventory = NaN; previousDemand = 0; return; }
      const add = numberValue(adds.get(date));
      const demand = Math.trunc(numberValue(daily.maybe_sales));
      let inventory;
      if (index === todayIndex || !Number.isFinite(previousInventory)) {
        const actualInventory = numberValue(daily.v2_inventory) - numberValue(daily.v2_add);
        inventory = actualInventory + add;
      } else if (add > 0 && previousInventory - previousDemand < 0) {
        inventory = add;
      } else {
        inventory = previousInventory - previousDemand + add;
      }
      const weightedSales = numberValue(daily.weighted_sales);
      values[index] = inventory > 0 && weightedSales > 0 ? Math.floor(inventory / weightedSales) : 0;
      previousInventory = inventory; previousDemand = demand;
    });
    return { values, nodes: nodes.map((node) => ({ ...node, dayValue: Math.max(0, nearestValue(values, node.pointIndex)) })) };
  };
  const displayChart = buildPreview(displayMods);
  const simValues = displayChart.values;
  const numericSeries = [...sysValues, ...existingValues].filter(Number.isFinite);
  const observedMax = Math.max(50, ...numericSeries);
  const yStep = Math.max(10, Math.ceil(observedMax / 50) * 10);
  const maxY = Math.max(50, Math.ceil(observedMax / yStep) * yStep);
  const yTicks = Array.from({ length: Math.floor(maxY / yStep) + 1 }, (_, index) => index * yStep);
  const py = (value) => T + (1 - Math.min(maxY, Math.max(0, numberValue(value))) / maxY) * plotH;
  const visibleNodes = displayChart.nodes.map((node) => ({ ...node, x: px(node.pointIndex), y: py(node.dayValue) }));
  const selected = nodeIndex == null ? null : visibleNodes.find((node) => node.index === nodeIndex);
  const hoveredBatch = dragging || hoverNode == null ? null : visibleNodes.find((node) => node.index === hoverNode);
  const actualRowsText = (week) => {
    const groups = new Map();
    (week?.actualRows || []).forEach((item) => {
      const date = dateText(item.expected_storage_time) || '-';
      groups.set(date, numberValue(groups.get(date)) + numberValue(item.remaining));
    });
    const rows = Array.from(groups.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    return rows.length ? rows.map(([date, qty]) => `${shortDate(date)} ${fmt(qty)}台`).join('、') : '无';
  };
  const batchInfo = (node) => node ? {
    actualQty: numberValue(node.actualQty),
    suggestQty: numberValue(node.qty),
    totalQty: numberValue(node.actualQty) + numberValue(node.qty),
    actualRows: actualRowsText(node.week),
  } : null;
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
  const stock = numberValue(row.summaryRow?.v2_inventory, numberValue(row.summaryRow?.inventory));
  const transit = numberValue(row.summaryRow?.v2_on_the_way, numberValue(row.summaryRow?.on_the_way));
  const receive = numberValue(row.waterRow?.quantity_receive ?? row.totalRow?.quantity_receive);
  const warehouseDays = v19WarehouseDays(row, row.weeks[0]) || '-';
  const stockoutIndex = sysValues.findIndex((value, index) => index > todayIndex && Number.isFinite(value) && value <= 0);
  const stockoutDate = row.waterRow?.expected_stockout_date || (stockoutIndex > 0 ? dates[stockoutIndex] : '3 个月内无');
  const hoverDaily = hoverIndex == null ? null : dailyMap.get(dates[hoverIndex]);
  const hover = dragging || hoveredBatch || hoverIndex == null ? null : {
    x: px(hoverIndex), date: dates[hoverIndex], sys: sysValues[hoverIndex], existing: existingValues[hoverIndex], daily: hoverDaily,
  };
  const tickSegments = 6;
  const ticks = Array.from(new Set([
    0,
    breakIndex,
    ...Array.from({ length: tickSegments }, (_, index) => (
      Math.round(breakIndex + ((N - 1 - breakIndex) * (index + 1)) / tickSegments)
    )),
  ])).filter((index) => index >= 0 && index < N).sort((a, b) => a - b);

  function editDraft(index, patchValue) {
    const current = draft?.index === index ? draft.mod : (mods[index] || {});
    setSimOn(true); setDraft({ index, mod: { ...current, ...patchValue }, pending: true }); setNodeIndex(index);
  }
  function nodeEditable(node) {
    if (role === 'ops') return node.index < 2;
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
    const base = baseNodes[session.index]; const minQty = session.index < 2 ? base.baseQty : 0;
    const minShift = -2; const maxShift = session.index < 2 && role !== 'ops' ? 0 : 2;
    const qtyStep = Math.max(1, Math.round(fallbackDaily));
    const dyDays = Math.round(dy / 5);
    const dxDays = dx / 10;
    const qty = Math.max(minQty, session.qty + dyDays * qtyStep);
    let shift = Math.max(minShift, Math.min(maxShift, session.shift + Math.round(dxDays / 7)));
    const todayDate = parseDate(todayText()); const windowEnd = addDays(startDate, N - 1);
    let shiftedDates = v19BatchDates(row, base.week, session.channel, shift);
    while (shift < maxShift && shiftedDates.shipDate < todayDate) { shift += 1; shiftedDates = v19BatchDates(row, base.week, session.channel, shift); }
    while (shift > minShift && shiftedDates.arrival > windowEnd) { shift -= 1; shiftedDates = v19BatchDates(row, base.week, session.channel, shift); }
    while (shift < maxShift && shiftedDates.arrival < todayDate) { shift += 1; shiftedDates = v19BatchDates(row, base.week, session.channel, shift); }
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
    const evidence = `基于 daily_sales.v2_days_for_sale 的拖动预览 ${bundle.length} 处：当前系统曲线超上限 ${baseMetric.over} 天、最低 ${fmt(baseMetric.min, 1)} 天。最终安全区间结果以提交工作流服务端重算为准。`;
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
      '📈 到货 & 安全库存天数趋势（≈3 个月） · ', h('span', { style: { color: '#3370ff' } }, `${row.product.model || '-'} · ${row.product.country || '-'}`),
      h(Button, { size: 'small', onClick: toggleSimulation, style: { borderColor: '#8b6cf0', background: simOn ? '#8b6cf0' : '#f6f3ff', color: simOn ? '#fff' : '#5b3fc4', borderRadius: 6, fontSize: 12, fontWeight: 700 } }, '🧪 模拟演算'),
      h('span', { style: { fontWeight: 400, fontSize: 11.5, color: '#8a9099' } }, '节点 = 未来批次（W1–W7）· 点看详情 / 改渠道 · 拖改量与时间 · 拖后确认才保留')),
    h('div', { style: { margin: '2px 0 6px', fontSize: 13, color: '#5a6169', background: '#f7f9fc', border: '1px solid #e6ebf2', borderRadius: 7, padding: '6px 12px' } },
      '📦 当前在库 ', h('b', null, fmt(stock)), '（FBA · 0:00 快照）　·　在途 ', h('b', null, fmt(transit)), '（= 发货 − 已签收，已计入曲线起点）　·　未交货订单 ', h('b', null, fmt(receive)), '　·　预计断货日 ', h('b', { style: { color: stockoutDate === '3 个月内无' ? '#147a43' : '#c0392b' } }, stockoutDate), '　·　入仓 ', h('b', null, `${warehouseDays} 天`), '（节点悬停看「可售日」）'),
    !futureV2Ready ? h('div', { style: { margin: '5px 0 7px', padding: '6px 10px', borderRadius: 6, background: '#fff8e6', border: '1px solid #f0c36d', color: '#7a4d00', fontSize: 12 } }, '未来 v2 水位尚未计算；当前仅展示已有历史，提交前需先运行 v2 水位推演。') : null,
    simOn && (changedKeys.length || draft?.pending) ? h('div', { style: { margin: '6px 0 8px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 12, fontWeight: 700, color: '#4b2fb0', background: '#f6f3ff', border: '1px dashed #8b6cf0', borderRadius: 8, padding: '6px 11px' } },
      `🧪 拖动预览 · ${changedKeys.length + (draft?.pending && !changedKeys.includes(String(draft.index)) ? 1 : 0)} 处改动 · 当前 v2 曲线：超上限 ${baseMetric.over} 天、最低 ${fmt(baseMetric.min, 1)} 天 · 拖后视觉预览：超上限 ${simMetric.over} 天、最低 ${fmt(simMetric.min, 1)} 天`,
      changedKeys.length ? v19Button('→ 转为修改申请', applyAll, 'blue') : null, v19Button('全部重置', () => { setMods({}); setDraft(null); setNodeIndex(null); }, 'ghost'),
      h('span', { style: { marginLeft: 'auto', fontWeight: 400, color: '#8a7fc0', fontSize: 11 } }, '拖圆点：上下 = 建议数量（1 格 = 1 天库存）· 左右 = 时间（按周）· 真实在途锁定不可拖；安全区间由服务端工作流重算')) : null,
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
        h('text', { x: px(breakIndex), y: 13, textAnchor: 'middle', fontSize: 11, fill: '#98a1ad', pointerEvents: 'none' }, '↤ 空档压缩 ｜ 可调整区 ↦'),
        h('text', { x: px(breakIndex), y: H - 28, textAnchor: 'middle', fontSize: 15, fill: '#98a1ad', pointerEvents: 'none' }, '≈'),
        ...visibleNodes.flatMap((node) => {
          const locked = node.index < 2; const modified = changedKeys.includes(String(node.index)) || (draft?.pending && draft.index === node.index); const hasQty = numberValue(node.totalQty) > 0;
          const labelLift = 20 + (node.index % 3) * 12;
          const labelY = Math.max(T + 16, node.y - labelLift);
          const textStyle = { textAnchor: 'middle', paintOrder: 'stroke', stroke: '#fff', strokeWidth: 3.8, strokeLinejoin: 'round', pointerEvents: 'none' };
          return [
            h('circle', { key: `node-dot-${node.index}`, cx: node.x, cy: node.y, r: hasQty ? 6.5 : 4.2, fill: modified ? '#f6f3ff' : hasQty ? '#fff' : '#f8fafc', stroke: locked ? '#b06a00' : '#5b7cfa', strokeWidth: hasQty ? 2.3 : 1.4, strokeDasharray: locked ? undefined : '3 2', opacity: hasQty ? 1 : 0.45, pointerEvents: 'none' }),
            hasQty ? h('text', { key: `node-qty-${node.index}`, x: node.x, y: labelY, fill: modified ? '#5b3fc4' : locked ? '#8a5a00' : '#1f2329', fontSize: modified ? 12.6 : 12, fontWeight: 800, ...textStyle }, `W${node.index + 1} · ${fmt(node.qty)}${modified ? '*' : ''}`) : null,
          ];
        })),
      ...visibleNodes.map((node) => {
        return h('button', {
          key: `node-${node.index}`, type: 'button', 'aria-label': `W${node.index + 1} · 建议 ${fmt(node.qty)} 台 · 真实在途 ${fmt(node.actualQty)} 台 · 到货 ${shortDate(node.arrival)}`, onPointerDown: (event) => startDrag(event, node),
          onPointerEnter: () => { if (!hoverLockRef.current && !dragRef.current) setHoverNode(node.index); }, onPointerLeave: () => { if (!dragRef.current) setHoverNode(null); },
          style: { position: 'absolute', left: xPercent(node.x), top: yPercent(node.y), width: 40, height: 40, transform: 'translate(-50%,-50%)', zIndex: 5, padding: 0, border: 0, outline: 'none', background: 'transparent', cursor: dragging?.index === node.index ? 'grabbing' : 'grab', touchAction: 'none' },
        });
      }),
      hover ? h(React.Fragment, null,
        h('span', { style: { position: 'absolute', left: xPercent(hover.x), top: yPercent(T), bottom: yPercent(B), zIndex: 3, borderLeft: '1px dashed #98a1ad', pointerEvents: 'none' } }),
        h('div', { style: { position: 'absolute', ...(hover.x / W > 0.76 ? { right: 12 } : { left: `calc(${xPercent(hover.x)} + 9px)` }), top: 32, zIndex: 6, width: 248, maxWidth: 'calc(100% - 24px)', boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', borderRadius: 6, padding: '8px 10px', background: 'rgba(31,35,41,.92)', color: '#fff', fontSize: 12, lineHeight: 1.55, pointerEvents: 'none', boxShadow: '0 5px 16px rgba(0,0,0,.18)' } },
          h('div', { style: { fontWeight: 800 } }, shortDate(hover.date)),
          h('div', { style: { color: '#dce6ff' } }, `系统安全 ${fmt(hover.sys, 1)} 天 · 销售 ${fmt(hover.existing, 1)} 天`),
          hover.daily ? h('div', { style: { color: '#f4cf8a' } }, `当天日均预估 ${fmt(numberValue(hover.daily.weighted_sales, hover.daily.maybe_sales))} 台/天`) : null)) : null,
      hoveredBatch ? h('div', { style: { position: 'absolute', ...(hoveredBatch.x / W > 0.76 ? { right: 12 } : { left: `calc(${xPercent(hoveredBatch.x)} + 12px)` }), ...(hoveredBatch.y / H > 0.52 ? { bottom: `calc(${Math.max(5, 100 - hoveredBatch.y / H * 100)}% + 14px)` } : { top: `calc(${Math.max(5, hoveredBatch.y / H * 100)}% + 14px)` }), zIndex: 6, width: 300, maxWidth: 'calc(100% - 24px)', maxHeight: 'calc(100% - 20px)', overflowY: 'auto', boxSizing: 'border-box', whiteSpace: 'normal', overflowWrap: 'anywhere', wordBreak: 'break-word', padding: '9px 11px', borderRadius: 7, background: 'rgba(31,35,41,0.94)', color: '#fff', fontSize: 12, lineHeight: 1.55, pointerEvents: 'none', boxShadow: '0 6px 22px rgba(0,0,0,.28)' } },
        h('b', null, `W${hoveredBatch.index + 1} · ${shortDate(hoveredBatch.week.start)}~${shortDate(hoveredBatch.week.end)}${hoveredBatch.index < 2 ? ' 🔒' : ''}`),
        h('div', null, `合计 ${fmt(hoveredBatchInfo.totalQty)} = 真实 ${fmt(hoveredBatchInfo.actualQty)} + 建议 ${fmt(hoveredBatchInfo.suggestQty)}`),
        hoveredBatchInfo.actualQty ? h('div', { style: { color: '#ffd479' } }, `真实入库：${hoveredBatchInfo.actualRows}`) : null,
        h('div', null, `建议入库 ${shortDate(hoveredBatch.arrival)} · 可售 ${shortDate(hoveredBatch.sellable)}`),
        h('div', { style: { color: '#cbd6ff' } }, `${hoveredBatch.mod.channel || hoveredBatch.channel} · 拖动只改建议量`)) : null),
    h('div', { style: { margin: '6px 0 0 40px', display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: '#5a6169' } },
      h('span', null, h('i', { style: { display: 'inline-block', width: 18, borderTop: '2px solid #5b7cfa', marginRight: 5, verticalAlign: 'middle' } }), '新算法天数'),
      h('span', null, h('i', { style: { display: 'inline-block', width: 18, borderTop: '2px solid #e0a53a', marginRight: 5, verticalAlign: 'middle' } }), '现有天数'),
      h('span', null, h('i', { style: { display: 'inline-block', width: 18, borderTop: '2px dashed #c0392b', marginRight: 5, verticalAlign: 'middle' } }), '7/14 天安全线'),
        h('span', null, '◌ W节点=真实+建议'),
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
        selected.index < 2 ? h('span', { style: { marginLeft: 7, fontSize: 10.5, color: '#9c6a06', background: '#fff6de', borderRadius: 4, padding: '1px 6px' } }, '🔒 W1–W2 守工厂节奏') : null,
        h(Button, { type: 'text', size: 'small', onClick: closeNodePanel, style: { marginLeft: 'auto', padding: '0 5px', minWidth: 28, color: '#98a1ad' } }, '✕')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '合计'),
        h('b', { style: { fontSize: 13, color: '#1f2329' } }, fmt(selectedInfo.totalQty)), ' 台',
        h('span', { style: { color: '#8a9099' } }, `= 真实 ${fmt(selectedInfo.actualQty)} + 建议 ${fmt(selectedInfo.suggestQty)}`)),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '建议量'),
        h('b', { style: { fontSize: 13, color: selected.qty !== selected.baseQty ? '#5b3fc4' : '#1f2329' } }, fmt(selected.qty)), ' 台',
        selected.qty !== selected.baseQty ? h('span', { style: { color: '#98a1ad' } }, `原 ${fmt(selected.baseQty)}`) : null),
      selectedInfo.actualQty ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '真实在途'),
        h('span', { style: { color: '#9a6a0a', fontWeight: 700 } }, selectedInfo.actualRows),
        h('span', { style: { color: '#98a1ad' } }, '锁定')) : null,
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '发货时间'),
        h('b', { style: { fontSize: 13, color: selected.shift !== selected.baseShift ? '#5b3fc4' : '#1f2329' } }, `${shortDate(selected.week.start)}${selected.shift ? ` ⏱ ${selected.shift > 0 ? '推迟' : '提前'} ${Math.abs(selected.shift)} 周` : ''}`)),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '渠道'),
        h(Select, { size: 'small', value: selected.channel, disabled: !nodeEditable(selected) || !channelOptions?.length, onChange: (value) => editDraft(selected.index, { channel: value }), options: channelOptions || [], style: { width: 220, maxWidth: '100%' } })),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '到货'),
        h('b', { style: { fontSize: 13, color: selected.shift !== selected.baseShift || Boolean(selected.mod.channel) ? '#5b3fc4' : '#1f2329' } }, dateText(selected.arrival) || '-'),
        `→ 入仓 ${selected.warehouseDays || 0} 天 → 可售 `, h('b', { style: { fontSize: 13 } }, formatDate(selected.sellable))),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 7, margin: '5px 0', flexWrap: 'wrap' } },
        h('span', { style: { color: '#8a9099', width: 56 } }, '影响'), `拖动只影响建议量，约 +${fmt(selected.qty / fallbackDaily, 1)} 天安全库存`),
      draft?.pending || changedKeys.includes(String(selected.index)) ? h('div', { style: { marginTop: 7, padding: '6px 9px', borderRadius: 6, background: '#eef4ff', color: '#1d3f8f', fontSize: 11.5, lineHeight: 1.6 } }, `拖动视觉预览：超上限 ${baseMetric.over} → ${simMetric.over} 天 · 最低 ${fmt(baseMetric.min, 1)} → ${fmt(simMetric.min, 1)} 天。是否免审、最终曲线与写回值由服务端工作流重算。`) : null,
      h('div', { style: { marginTop: 7, fontSize: 11, color: '#6a7280', lineHeight: 1.55 } }, !nodeEditable(selected) ? (role === 'ops' ? '采购应急直改仅限 W1–W2；其他周次请走审核。' : `${V19_ROLE_NAME[role]}视角只读或该节点已锁定。`) : selected.index < 2 ? (role === 'ops' ? 'W1–W2：采购可提前、推迟、加量、改渠道；不可减量。' : 'W1–W2：销售可提前、加量、改渠道；不可推迟、不可减量。') : '上下拖数量，左右拖时间；点击后可精确选择渠道。'),
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
    const blocked = bundle.filter((item) => item.weekIndex < 2 && (
      (item.quantityChanged && numberValue(item.to) < numberValue(item.from))
      || (target.role !== 'ops' && item.dateChanged && numberValue(item.shift) > 0)
    ));
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
          h('span', { style: { color: '#1d3f8f', fontWeight: 700 } }, item.weekIndex < 2 ? (target.role === 'ops' ? '采购应急' : '主管链') : '提交后服务端判闸')))),
      blocked.length ? h('div', { style: { padding: '7px 9px', background: '#fdf0ef', border: '1px solid #e8998f', color: '#9c3b32', borderRadius: 6, fontSize: 12, marginBottom: 9 } }, `W1–W2 守工厂节奏：任何角色都不可减发，销售不可推迟。请回到趋势图还原 W${blocked.map((item) => item.weekIndex + 1).join('、W')} 后再提交。`) : null,
      h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '理由类型'), h(Select, { value: reasonType, onChange: setReasonType, options: ['秒杀排期', '断货救急', '需求下修', '活动取消', '其他'].map((value) => ({ value, label: value })), style: { width: '100%' } })),
      h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '补充说明 ', h('span', { style: { color: '#c0392b' } }, '* 必填')), h(Input.TextArea, { rows: 4, value: reason, onChange: (event) => setReason(event.target.value), placeholder: '例：秒杀排期确认、活动取消、需求下修、FBA 即将断货……' })),
      h('div', { style: { display: 'flex', gap: 8 } }, h(Button, { type: 'primary', loading, disabled: !reason.trim() || blocked.length > 0, onClick: () => onSubmit({ bundle, evidence: target.evidence, reasonType, reason: reason.trim() }), style: { flex: 1, fontWeight: 800 } }, `提交 ${bundle.length} 周修改申请`), h(Button, { onClick: onClose }, '取消')),
      h('div', { style: { marginTop: 8, fontSize: 10.5, color: '#98a1ad' } }, '每一周分别按 W1–W2、W3–W5、W6–W7 的权限与安全区间闸进入对应流程。'));
  }
  const base = v19WeekValue(target.row, target.weekIndex, target.changes || {});
  const w12Blocked = target.weekIndex < 2 && type === 'down';
  const gate = target.weekIndex < 2 ? 'W1–W2 守工厂节奏：不允许减量；销售不可推迟，其他修改走主管；采购仅在 W1–W2 可应急直改。'
    : target.weekIndex >= 5 ? 'W6–W7 下单异议：提交后由服务端按 v2 水位重算；区间内免审，出界走销售→采购→终审。'
      : 'W3–W5：提交后由服务端按 v2 水位重算；区间内免审，出界走主管+采购审核。';
  return h(Modal, { title: '✏ 修改申请', open: true, onCancel: onClose, footer: null, width: 430 },
    h('div', { style: { fontSize: 12, color: '#3a4763', background: '#f5f7fb', borderRadius: 6, padding: '6px 8px', marginBottom: 10 } }, `${target.row.product.model || '-'} · ${target.row.product.country} · W${target.weekIndex + 1} · 当前 ${fmt(base)} 台`),
    h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '修改方式'), h(Select, { value: type, onChange: setType, options: [{ value: 'up', label: '↑ 加发 / 上调数量' }, { value: 'down', label: '↓ 减发 / 下调数量' }, { value: 'air', label: '✈ 改运输方式（按站点真实配置）' }], style: { width: '100%' } })),
    type !== 'air' ? h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '新数量'), h(InputNumber, { min: 0, value: qty, onChange: setQty, style: { width: '100%' } })) : null,
    type === 'air' ? h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '新运输方式'), h(Select, { value: channel, onChange: setChannel, options: target.channelOptions || [], placeholder: '选择该站点已配置渠道', style: { width: '100%' } })) : null,
    h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '理由类型'), h(Select, { value: reasonType, onChange: setReasonType, options: ['秒杀排期', '断货救急', '需求下修', '活动取消', '其他'].map((value) => ({ value, label: value })), style: { width: '100%' } })),
    h('div', { style: { marginBottom: 10 } }, h('b', { style: { display: 'block', marginBottom: 4, fontSize: 12.5 } }, '补充说明 ', h('span', { style: { color: '#c0392b' } }, '* 必填（加发 / 减发都必须写）')), h(Input.TextArea, { rows: 3, value: reason, onChange: (event) => setReason(event.target.value), placeholder: '例：秒杀排期确认、FBA 5 天内断货、需求下修、活动取消…' })),
    h('div', { style: { fontSize: 11, color: '#1d3f8f', background: '#eef4ff', border: '1px solid #bcd2ff', borderRadius: 6, padding: '6px 8px', marginBottom: 8, lineHeight: 1.55 } }, '安全区间 7–14 天；页面不自行套公式，最终结果以提交工作流服务端重算为准。'),
    h('div', { style: { fontSize: 11, color: '#7a4d00', background: '#fff8e6', border: '1px solid #f0c36d', borderRadius: 6, padding: '6px 8px', marginBottom: 10, lineHeight: 1.55 } }, gate),
    h('div', { style: { display: 'flex', gap: 8 } }, h(Button, { type: 'primary', loading, disabled: !reason.trim() || w12Blocked || (type === 'air' && (!channel || channel === target.currentChannel)), onClick: () => onSubmit({ type, to: type === 'air' ? base : numberValue(qty), channel, reasonType, reason: reason.trim() }), style: { flex: 1, fontWeight: 800 } }, w12Blocked ? 'W1–W2 不允许减发' : '提交申请'), h(Button, { onClick: onClose }, '取消')),
    h('div', { style: { marginTop: 8, fontSize: 10.5, color: '#98a1ad', lineHeight: 1.5 } }, '提交后：格子标 ⏳ 待审 · 顶部出现「销售提交的修改需求需要审核」· 对应审核角色收件箱 +1'));
}

function V19ChangeDrawer({ detail, role, changes, auditNote, onAuditNote, onClose, onEdit, onAction }) {
  if (!detail) return null;
  const { row, weekIndex } = detail; const key = v19ChangeKey(row.key, weekIndex); const change = changes[key]; const week = row.weeks[weekIndex]; const status = change?.status || 'ok';
  const suggestQty = v19WeekValue(row, weekIndex, changes);
  const actualQty = v19ActualWeekValue(row, weekIndex);
  const planSourceText = [
    actualQty ? '真实在途（expected_inventory，锁定）' : '',
    week.rows.some((item) => item.plan_source === PLAN_SOURCE) ? '新算法建议' : '',
  ].filter(Boolean).join(' + ') || '无计划';
  const actualSourceText = week.actualRows.map((item) => `${item.shop || '-'}·预计入库${shortDate(item.expected_storage_time)}·${fmt(item.remaining)}台`).join('、');
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
      ...[['ASIN', row.product.asin], ['发货周次', `W${weekIndex + 1} · ${shortDate(week.start)}~${shortDate(week.end)}`], ['合计到货', `${fmt(actualQty + suggestQty)} 台（实际 ${fmt(actualQty)} / 建议 ${fmt(suggestQty)}）`], ['覆盖售卖期', `${shortDate(week.coverStart)}~${shortDate(week.coverEnd)}`], ['计划来源', planSourceText], ['真实在途明细', actualSourceText || '-'], ['建议明细/渠道', suggestSourceText || '-']].map((item) => h('tr', { key: item[0] }, h('td', { style: { border: '1px solid #d4dae3', padding: '6px 11px', background: '#dde4ee', fontWeight: 700, color: '#3a4763', width: 96 } }, item[0]), h('td', { style: { border: '1px solid #d4dae3', padding: '6px 11px' } }, item[1]))))),
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

function v19CurrentSuggestionRecalculation(row) {
  const dailyMap = new Map((row?.dailyRows || []).map((item) => [dateText(item.date), item]));
  let previousCandidate = 0;
  const result = new Map();
  (row?.weeks || []).forEach((week) => {
    (week?.rows || []).slice().sort((a, b) => dateText(a.date).localeCompare(dateText(b.date))).forEach((plan, index) => {
      const serviceStart = addDays(plan.add_date, 7);
      const serviceEnd = addDays(plan.add_date, 13);
      const serviceDates = Array.from({ length: 7 }, (_, dayIndex) => dateText(addDays(serviceStart, dayIndex)));
      const serviceRows = serviceDates.map((date) => dailyMap.get(date)).filter(Boolean);
      const weeklyDemand = serviceRows.reduce((sum, item) => sum + numberValue(item.maybe_sales, numberValue(item.weighted_sales)), 0);
      const rawInventoryValues = serviceRows
        .filter((item) => dateText(item.date) === dateText(serviceStart))
        .map((item) => numberValue(item.v2_inventory, NaN)).filter(Number.isFinite);
      const rawInventory = rawInventoryValues.length ? Math.max(...rawInventoryValues) : null;
      const effectiveInventory = rawInventory == null ? null : rawInventory + previousCandidate;
      const targetDemand = weeklyDemand * 2;
      const suggestedNumber = serviceRows.length === 7 && effectiveInventory != null
        ? Math.ceil(Math.max(0, targetDemand - effectiveInventory)) : null;
      result.set(String(plan.id || `${plan.date}-${index}`), {
        serviceStart, serviceEnd, demandDays: serviceRows.length, weeklyDemand, targetDemand,
        rawInventory, previousCandidate, effectiveInventory, suggestedNumber,
      });
      previousCandidate += suggestedNumber || 0;
    });
  });
  return result;
}

function v19SuggestionCalculation(row, week) {
  const plans = week?.rows || [];
  if (!plans.length) return h('div', { style: { padding: '9px 11px', background: '#f7f9fc', color: '#8a9099', fontSize: 12, borderRadius: 6 } }, '该周没有建议计划。');
  const recalculations = v19CurrentSuggestionRecalculation(row);
  const hasHistoricalPlan = plans.some((plan) => !v19ParseCalculationSnapshot(plan.v2_calculation_snapshot));
  return h('div', { style: { fontSize: 12, color: '#3a4763', lineHeight: 1.7 } },
    hasHistoricalPlan ? h('div', { style: { marginBottom: 8, padding: '7px 10px', background: '#fff8e6', border: '1px solid #f0c36d', borderRadius: 6, color: '#7a4d00' } }, '历史计划未保存生成时快照；以下按当前 daily_sales.v2 数据复算，仅用于说明当前口径，不代表当时生成输入。') : null,
    ...plans.map((plan, index) => {
      const snapshot = v19ParseCalculationSnapshot(plan.v2_calculation_snapshot);
      const current = recalculations.get(String(plan.id || `${plan.date}-${index}`));
      const title = plans.length > 1 ? `计划 ${index + 1} · ${fmt(plan.number)} 台` : `建议 ${fmt(plan.number)} 台`;
      if (snapshot) {
        const orderWeek = snapshot.cycle_phase === 'ORDER_WEEK';
        const demandText = orderWeek
          ? `${fmt(snapshot.first_week_demand, 2)} + ${fmt(snapshot.second_week_demand, 2)} = ${fmt(snapshot.target_demand, 2)}`
          : `${fmt(snapshot.first_week_demand, 2)} × 2 = ${fmt(snapshot.target_demand, 2)}`;
        const gapText = orderWeek
          ? `${fmt(snapshot.target_demand, 2)} − ${fmt(snapshot.inventory_excluding_a1, 2)} − ${fmt(snapshot.a1_committed_number, 2)} = ${fmt(snapshot.gap_before_ceiling, 2)}`
          : `${fmt(snapshot.target_demand, 2)} − ${fmt(snapshot.raw_inventory_at_service_start, 2)} = ${fmt(snapshot.gap_before_ceiling, 2)}`;
        return h('div', { key: plan.id || index, style: { background: '#f7f9fc', border: '1px solid #e1e7ef', borderRadius: 6, padding: '8px 11px', marginTop: index ? 8 : 0 } },
          h('div', { style: { fontWeight: 700 } }, `${title}（生成快照）`),
          h('div', null, `服务期：${snapshot.service_start_date || '-'}～${snapshot.service_end_date || '-'} · 完整数据 ${fmt(snapshot.first_week_demand_days)} 天`),
          h('div', null, `${orderWeek ? '两周需求' : '目标14天需求'}：${demandText}`),
          h('div', null, `服务期原始库存：${fmt(snapshot.raw_inventory_at_service_start, 2)}`),
          orderWeek ? h('div', null, `扣除已承诺 A1 后库存：${fmt(snapshot.raw_inventory_at_service_start, 2)} − ${fmt(snapshot.a1_committed_number, 2)} = ${fmt(snapshot.inventory_excluding_a1, 2)}`) : null,
          h('div', null, `需求缺口：${gapText}`),
          h('div', { style: { fontWeight: 700, color: '#1d5fc4' } }, `建议数量：向上取整 max(0, ${fmt(snapshot.gap_before_ceiling, 2)}) = ${fmt(snapshot.suggested_number)} 台`),
          h('div', { style: { color: '#8a9099' } }, `算法：${snapshot.formula_version || '-'} · 生成：${snapshot.generated_at || '-'}`));
      }
      return h('div', { key: plan.id || index, style: { background: '#f7f9fc', border: '1px solid #e1e7ef', borderRadius: 6, padding: '8px 11px', marginTop: index ? 8 : 0 } },
        h('div', { style: { fontWeight: 700 } }, `${title}（当前复算）`),
        h('div', null, `服务期：${dateText(current?.serviceStart) || '-'}～${dateText(current?.serviceEnd) || '-'} · 当前完整数据 ${fmt(current?.demandDays)} 天`),
        h('div', null, `当前服务周需求：${fmt(current?.weeklyDemand, 2)}；目标14天需求：${fmt(current?.weeklyDemand, 2)} × 2 = ${fmt(current?.targetDemand, 2)}`),
        h('div', null, `当前服务期原始库存：${current?.rawInventory == null ? '-' : fmt(current.rawInventory, 2)}`),
        h('div', null, `前序当前复算候选量：${fmt(current?.previousCandidate, 2)}`),
        h('div', null, `当前有效库存：${current?.rawInventory == null ? '-' : `${fmt(current.rawInventory, 2)} + ${fmt(current.previousCandidate, 2)} = ${fmt(current.effectiveInventory, 2)}`}`),
        h('div', { style: { fontWeight: 700, color: '#1d5fc4' } }, current?.suggestedNumber == null
          ? '当前复算：数据不足，无法计算'
          : `当前复算建议：向上取整 max(0, ${fmt(current.targetDemand, 2)} − ${fmt(current.effectiveInventory, 2)}) = ${fmt(current.suggestedNumber)} 台`),
        h('div', { style: { color: '#8a9099' } }, `表内历史建议仍为 ${fmt(plan.number)} 台；两者不一致时，以“缺少当时快照、当前基础数据已变化”解释，不改写历史数量。`));
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
  const [expanded, setExpanded] = useState({}); const [w12Open, setW12Open] = useState(false); const [sandboxes, setSandboxes] = useState({});
  const shownIndices = w12Open ? [0, 1, 2, 3, 4, 5, 6] : ['fold', 2, 3, 4, 5, 6];
  const headerWeeks = buildWeeks([]); const border = '1px solid #edf0f4';
  const th = (textValue, props = {}) => h('th', { rowSpan: props.rowSpan, colSpan: props.colSpan, onClick: props.onClick, style: { borderBottom: border, borderRight: border, padding: '8px 11px', textAlign: 'center', whiteSpace: 'nowrap', fontSize: 13.5, ...props.style } }, textValue);
  const sumFor = (index) => allScopeRows.reduce((sum, row) => sum + v19WeekValue(row, index, changes), 0);
  const actualSumFor = (index) => allScopeRows.reduce((sum, row) => sum + v19ActualWeekValue(row, index), 0);
  const netSum = allScopeRows.reduce((sum, row) => sum + v19NetOf(row, changes).net, 0);
  const headerCoverage = (index) => {
    const week = rows.map((row) => row.weeks[index]).find((item) => item?.coverStart && item?.coverEnd);
    return week ? `${shortDate(week.coverStart)}～${shortDate(week.coverEnd)}` : '—';
  };
  const weekCellBody = (total, actual, suggest) => h(React.Fragment, null,
    total ? fmt(total) : '—',
    actual ? h('span', { style: { fontSize: 10, marginLeft: 2 } }, '🔒') : null,
    actual && suggest ? h('span', { style: { display: 'block', marginTop: 2, fontSize: 9.5, color: '#8a9099', fontWeight: 600 } }, `实际 ${fmt(actual)} / 建议 ${fmt(suggest)}`) : actual ? h('span', { style: { display: 'block', marginTop: 2, fontSize: 9.5, color: '#9a6a0a', fontWeight: 700 } }, '真实在途') : suggest ? h('span', { style: { display: 'block', marginTop: 2, fontSize: 9.5, color: '#7c3aed', fontWeight: 700 } }, '新算法建议') : null);
  return h('div', null,
    h('div', { style: { overflowX: 'auto', border: '1px solid #e3e7ee', borderRadius: 8 } }, h('table', { style: { borderCollapse: 'separate', borderSpacing: 0, fontSize: 14, whiteSpace: 'nowrap', minWidth: w12Open ? 1680 : 1580, width: '100%' } },
      h('thead', null,
        h('tr', null, th('商品信息（看一眼就能初判：要不要备、能不能备）', { colSpan: 9, style: { background: '#dcefe3', color: '#1a6d49', fontWeight: 800, fontSize: 14 } }), th('发货周次（备货当周 7/6 不进表 · W1 = 7/13 → W7 = 8/24；前沿 W6–W7 按净额交采购）', { colSpan: shownIndices.length, style: { background: '#d8b072', color: '#6b4a17', fontWeight: 800, fontSize: 14 } }), th(h('span', null, '需新下厂', h('span', { style: { display: 'block', fontWeight: 400, fontSize: 11, color: '#b08430' } }, '净额 · PO 唯一依据')), { rowSpan: 4, style: { background: '#fff4e2', color: '#8a5a00', borderBottom: '2px solid #e8b45a', minWidth: 145 } })),
        h('tr', null, th('趋势', { rowSpan: 3, style: { background: '#eaf5ee', color: '#2c6a4c' } }), ...['站点', '销售', '型号', 'ASIN', '加权日均', '等级', '库销比', '产品标签'].map((value) => th(value, { rowSpan: 3, style: { background: '#eaf5ee', color: '#2c6a4c', fontWeight: 700 } })), ...shownIndices.map((index) => index === 'fold' ? th('W1–W2 🔒', { onClick: () => setW12Open(true), style: { background: '#ededf0', color: '#6a727d', cursor: 'pointer' } }) : th(`W${index + 1}`, { style: { background: index >= 5 ? '#efeaff' : '#f3e6cf', color: index >= 5 ? '#5b3fc4' : '#7a5a24', fontWeight: 700 } }))),
        h('tr', null, ...shownIndices.map((index) => index === 'fold' ? th(`${shortDate(headerWeeks[0].start)}~${shortDate(headerWeeks[1].end)}`, { style: { background: '#ededf0', color: '#8a9099', fontSize: 11 } }) : th(`${shortDate(headerWeeks[index].start)}~${shortDate(headerWeeks[index].end)}`, { style: { background: index >= 5 ? '#efeaff' : '#f7edda', color: index >= 5 ? '#6b4fd0' : '#8a6a2e', fontSize: 11 } }))),
        h('tr', null, ...shownIndices.map((index) => index === 'fold' ? th('点开看两周', { style: { background: '#ededf0', color: '#8a9099', fontSize: 10 } }) : th(h('span', null, '覆盖售卖期 ', h('span', { style: { color: index >= 5 ? '#6b4fd0' : '#b06a1e' } }, headerCoverage(index))), { style: { background: index >= 5 ? '#efeaff' : '#fbf5e8', color: '#a07a3a', fontSize: 10 } })))),
      h('tbody', null,
        ...rows.flatMap((row, rowIndex) => {
          const open = Boolean(expanded[row.key]); const confirmed = Boolean(confirmedRows?.[row.key]); const lifeName = v19LifeName(row); const lifeStyle = V19_LIFE[lifeName] || { bg: '#eef1f5', color: '#5a6169' }; const ratioColor = row.ratio.name === '短缺' ? '#c0392b' : row.ratio.name === '滞销' ? '#b06a1e' : '#1a6d49'; const net = v19NetOf(row, changes);
          const info = [row.product.country || '-', row.product.sale_owner || '-', row.product.model || '-', row.product.asin || '-', fmt(row.summaryRow?.weighted_sales, 1), row.levelName || '未配置', `${fmt(row.ratio.value, 1)} ${row.ratio.name}`, lifeName];
          const cells = shownIndices.map((index) => {
            if (index === 'fold') {
              const actual = v19ActualWeekValue(row, 0) + v19ActualWeekValue(row, 1);
              const suggest = v19WeekValue(row, 0, changes) + v19WeekValue(row, 1, changes);
              return h('td', { key: 'fold', onClick: () => setW12Open(true), style: { background: '#ededf0', color: '#6a727d', fontSize: 11, cursor: 'pointer', minWidth: 84, borderBottom: border, borderRight: border, textAlign: 'center', fontWeight: 700 } }, weekCellBody(suggest, actual, suggest));
            }
            const week = row.weeks[index]; const key = v19ChangeKey(row.key, index); const change = changes[key]; const value = v19WeekValue(row, index, changes); const actual = v19ActualWeekValue(row, index); const sandbox = sandboxes[row.key]?.[index]; const displaySuggest = sandbox?.qty == null ? value : numberValue(sandbox.qty); const displayValue = displaySuggest; const status = change?.status || 'ok'; const statusStyle = V19_STATUS_STYLE[status]; const newAlgorithm = week.newQty > 0; const actualLocked = actual > 0;
            const interactionHint = sandbox ? `模拟沙盘：建议 ${fmt(value)} → ${fmt(displaySuggest)} 台；实际在途 ${fmt(actual)} 台不变` : change ? `${V19_CHANGE_MARK[change.type]} ${V19_CHANGE_LABEL[change.type]}：建议 ${fmt(change.from)} → ${fmt(change.to)} 台 · ${V19_STATUS_TEXT[status]} · ${change.reason}` : week.rows.length || week.actualRows.length ? `点击查看：新算法建议 ${week.rows.length} 条，真实在途 ${week.actualRows.length} 条` : '该周无排；点击可提出修改申请';
            return h(Tooltip, { key: index, title: interactionHint }, h('td', { onClick: () => onOpenDetail(row, index), style: { position: 'relative', minWidth: 98, padding: '8px 7px', textAlign: 'center', borderBottom: border, borderRight: border, cursor: 'pointer', fontWeight: change || displayValue ? 800 : 500, color: sandbox ? '#5b3fc4' : change ? statusStyle.color : displayValue ? '#1f2329' : '#c2c8d0', background: sandbox ? '#f2edff' : actualLocked ? '#fffaf1' : index >= 5 ? '#f6f3ff' : index < 2 ? '#ededf0' : statusStyle.bg, boxShadow: sandbox ? 'inset 0 0 0 2px #8b6cf0' : change && status !== 'ok' ? `inset 0 0 0 2px ${statusStyle.border}` : index >= 5 ? 'inset 0 2px 0 #8b6cf0, inset 0 -2px 0 #8b6cf0' : 'none' } }, sandbox ? h('span', { style: { position: 'absolute', top: 1, right: 3, fontSize: 9.5, color: '#6b4fd0', fontWeight: 900 } }, '沙盘') : change ? h('span', { style: { position: 'absolute', top: 2, right: 3, fontSize: 10.5, fontWeight: 900, color: statusStyle.color } }, V19_CHANGE_MARK[change.type]) : newAlgorithm ? h('span', { style: { position: 'absolute', top: 2, right: 3, color: '#7c3aed', fontSize: 10.5 } }, '⟳') : actualLocked ? h('span', { style: { position: 'absolute', top: 2, right: 3, color: '#b06a00', fontSize: 10.5 } }, '◆') : null, change && status !== 'ok' ? h('span', { style: { position: 'absolute', top: 1, left: 3, fontSize: 10 } }, status === 'rej' ? '⛔' : '⏳') : null, weekCellBody(displayValue, actual, displaySuggest)));
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
          const actual = index === 'fold' ? actualSumFor(0) + actualSumFor(1) : actualSumFor(index);
          const suggest = index === 'fold' ? sumFor(0) + sumFor(1) : sumFor(index);
          return h('td', { key: index, style: { background: '#eef3fa', fontWeight: 800, borderTop: '2px solid #c3cfe0', textAlign: 'center', padding: '8px 6px' } }, weekCellBody(suggest, actual, suggest));
        }), h('td', { style: { background: '#eef3fa', color: '#8a6206', fontSize: 14, fontWeight: 800, borderTop: '2px solid #c3cfe0', textAlign: 'center' } }, orderWeek ? h(React.Fragment, null, fmt(netSum), h('span', { style: { display: 'block', fontSize: 10, fontWeight: 600, color: '#98a1ad' } }, '下单数量合计（净额，仅建议量）')) : h(React.Fragment, null, fmt(sumFor(5)), h('span', { style: { display: 'block', fontSize: 10, fontWeight: 600, color: '#98a1ad' } }, 'W6 建议量合计 · 下周合并下 PO'))))))),
    !w12Open ? null : h(Button, { size: 'small', onClick: () => setW12Open(false), style: { marginTop: 7 } }, '收起 W1–W2'));
}

function ShipmentEvolutionBlockV19() {
  const [params, setParams] = useState(readParamsSync); const [products, setProducts] = useState([]); const [catalogReady, setCatalogReady] = useState(false); const [catalogLoading, setCatalogLoading] = useState(true); const [catalogError, setCatalogError] = useState('');
  const [selectedSale, setSelectedSale] = useState(CAN_SELECT_SALE ? ALL_SALES : CURRENT_USERNAME); const [shops, setShops] = useState([]); const [dailyRows, setDailyRows] = useState([]); const [totalRows, setTotalRows] = useState([]); const [shipments, setShipments] = useState([]); const [realSupplies, setRealSupplies] = useState([]); const [waterRows, setWaterRows] = useState([]); const [modelLevels, setModelLevels] = useState([]); const [logisticsLeads, setLogisticsLeads] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [refreshSeed, setRefreshSeed] = useState(0); const requestSequence = useRef(0);
  const [role, setRole] = useState(DEFAULT_ROLE); const [mine, setMine] = useState(false); const orderWeek = isCurrentOrderWeek(); const [labelFilter, setLabelFilter] = useState([]); const [onlyWarning, setOnlyWarning] = useState(false); const [onlyChanged, setOnlyChanged] = useState(false); const [changes, setChanges] = useState({}); const [confirmedRows, setConfirmedRows] = useState({}); const [detail, setDetail] = useState(null); const [editTarget, setEditTarget] = useState(null); const [auditNote, setAuditNote] = useState(''); const [actionLoading, setActionLoading] = useState(false); const [batchOpen, setBatchOpen] = useState(false); const [batchSigned, setBatchSigned] = useState(null); const [poGenerated, setPoGenerated] = useState(false); const [poApproved, setPoApproved] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  useEffect(() => { let active = true; Promise.all([resolveParams(), requestEligibleProducts()]).then(([initial, rows]) => { if (!active) return; setProducts(rows); const names = new Set(rows.map((item) => item.sale_owner).filter(Boolean)); const requested = rows.find((item) => item.asin === initial.asin && item.country === initial.country); const sale = CAN_SELECT_SALE ? (initial.sale === ALL_SALES || names.has(initial.sale) ? initial.sale : requested?.sale_owner || ALL_SALES) : CURRENT_USERNAME; setSelectedSale(sale); setParams({ ...initial, sale, shop: TOTAL_SHOP }); if (!initial.asin && !initial.country && (initial.sale !== sale || initial.shop !== TOTAL_SHOP)) replaceSaleParams(sale, TOTAL_SHOP); if (!rows.length) setCatalogError(!AVAILABLE_ROLE_KEYS.length ? '当前用户不属于管理员、销售主管、物流仓储部或销售部门，本页面按只读无数据处理。' : '当前查看范围内没有状态为普通、新品或重点的非变体 ASIN。'); }).catch((requestError) => setCatalogError(requestError?.message || String(requestError))).finally(() => { if (active) { setCatalogLoading(false); setCatalogReady(true); } }); return () => { active = false; }; }, []);
  useEffect(() => {
    if (!catalogReady) return undefined;
    const routers = [ctx.router, ctx.app?.router?.router].filter((router) => typeof router?.subscribe === 'function');
    const unsubscribers = routers.map((router) => router.subscribe(() => {
      const next = readParamsSync(); const names = new Set(products.map((item) => item.sale_owner).filter(Boolean));
      const requested = products.find((item) => item.asin === next.asin && item.country === next.country);
      const sale = CAN_SELECT_SALE ? (next.sale === ALL_SALES || names.has(next.sale) ? next.sale : requested?.sale_owner || ALL_SALES) : CURRENT_USERNAME;
      setSelectedSale(sale); setParams({ ...next, sale, shop: TOTAL_SHOP }); setChanges({}); setConfirmedRows({});
    }));
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe?.());
  }, [catalogReady, products]);
  const saleOptions = useMemo(() => [{ value: ALL_SALES, label: '全部销售' }, ...Array.from(new Set(products.map((item) => item.sale_owner).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'zh-CN')).map((name) => ({ value: name, label: name }))], [products]);
  const scopedProducts = useMemo(() => CAN_SELECT_SALE && selectedSale !== ALL_SALES ? products.filter((item) => item.sale_owner === selectedSale) : products, [products, selectedSale]); const scopeSignature = useMemo(() => scopedProducts.map(productKey).join('|'), [scopedProducts]);
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
    if (!scopedProducts.length) { setDailyRows([]); setTotalRows([]); setShipments([]); setRealSupplies([]); setWaterRows([]); setModelLevels([]); setLogisticsLeads([]); setChanges({}); setShops([]); setLoading(false); return; }
    setLoading(true); setError('');
    try {
      const dailyPromise = requestDailySales(scopedProducts, TOTAL_SHOP);
      const shipmentPromise = requestShipments(scopedProducts, TOTAL_SHOP);
      const realSupplyPromise = requestExpectedInventory(scopedProducts);
      const [dailyData, shipmentData, realSupplyData, waterData, levelData, logisticsData] = await Promise.all([
        dailyPromise, shipmentPromise, realSupplyPromise,
        requestWaterProducts(scopedProducts), requestModelLevels(scopedProducts), requestLogisticsLeads(scopedProducts),
      ]);
      if (requestId !== requestSequence.current) return;
      const planChangeData = await requestPlanChanges(shipmentData);
      const changeLogData = await requestChangeLogs(planChangeData);
      if (requestId !== requestSequence.current) return;
      setShops([]);
      setDailyRows(dailyData); setTotalRows(dailyData); setShipments(shipmentData); setRealSupplies(realSupplyData); setWaterRows(waterData); setModelLevels(levelData); setLogisticsLeads(logisticsData);
      setChanges(buildWorkflowChanges(scopedProducts, shipmentData, planChangeData, changeLogData));
    } catch (requestError) {
      if (requestId === requestSequence.current) { setError(requestError?.message || String(requestError)); setDailyRows([]); setTotalRows([]); setShipments([]); setRealSupplies([]); setWaterRows([]); setModelLevels([]); setLogisticsLeads([]); setChanges({}); }
    } finally { if (requestId === requestSequence.current) setLoading(false); }
  }, [catalogReady, scopeSignature, refreshSeed]);
  useEffect(() => { loadData(); }, [loadData]);
  const productViews = useMemo(() => scopedProducts.map((product) => { const key = productKey(product); const dataKey = rowProductKey(product); const matches = (item) => rowProductKey(item) === dataKey; const productDaily = dailyRows.filter(matches); const productTotal = totalRows.filter(matches); const productPlans = shipments.filter(matches); const productRealSupplies = realSupplies.filter(matches); const waterRow = waterRows.find(matches) || null; const current = productDaily.find((item) => dateText(item.date) === todayText()) || latestOnOrBefore(productDaily, todayText()); const total = productTotal.find((item) => dateText(item.date) === todayText()) || latestOnOrBefore(productTotal, todayText()); return { key, dataKey, product, dailyRows: productDaily, totalRow: total, waterRow, summaryRow: current, ratio: ratioInfo(waterRow), levelName: modelLevels.find((item) => item.country === product.country && item.model === product.model)?.level_name || '', realSupplyRows: productRealSupplies, weeks: buildWeeks(productPlans, productRealSupplies), netWeeks: buildWeeks(productPlans, productRealSupplies), noShopData: !current }; }), [scopedProducts, dailyRows, totalRows, shipments, realSupplies, waterRows, modelLevels]);
  const counts = useMemo(() => { const result = { sale: orderWeek ? productViews.filter((row) => !confirmedRows[row.key]).length : 0, lead: 0, ops: 0, final: 0 }; Object.values(changes).forEach((change) => { const owner = V19_STATUS_OWNER[change.status]; if (owner) result[owner] += 1; }); if (!batchSigned) result.lead += 1; if (orderWeek && !poGenerated && !poApproved) result.ops += 1; if (orderWeek && !poApproved) result.final += 1; return result; }, [productViews, confirmedRows, changes, batchSigned, orderWeek, poGenerated, poApproved]);
  const visibleRows = useMemo(() => productViews.filter((row) => !labelFilter.length || labelFilter.includes(v19LifeName(row))).filter((row) => !onlyWarning || v19Warning(row)).filter((row) => !onlyChanged || v19Changed(row, changes)).filter((row) => { if (!mine) return true; if (role === 'sale' && orderWeek && !confirmedRows[row.key]) return true; return row.weeks.some((week, index) => V19_STATUS_OWNER[changes[v19ChangeKey(row.key, index)]?.status] === role); }), [productViews, labelFilter, onlyWarning, onlyChanged, mine, role, orderWeek, confirmedRows, changes]);
  const inflight = Object.values(changes).filter((change) => !['ok', 'yel'].includes(change.status)).length;
  function changeSale(sale) { setSelectedSale(sale); setParams({ sale, shop: TOTAL_SHOP }); setChanges({}); setConfirmedRows({}); replaceSaleParams(sale, TOTAL_SHOP); }
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
      h('span', { style: { fontSize: 12, fontWeight: 700, color: '#1a5fb4', background: '#e7f0fd', border: '1px solid #b9d4f5', borderRadius: 11, padding: '2px 10px' } }, 'v19 · 安全天数统一 7/14 · 库销比全局固定 3.5/4.5（短缺/正常/滞销）｜决策 27：修改后由服务端重算 v2 水位，结果在 7–14 天或不劣于系统建议则免审生效；出界才审核（W3–W5→主管+采购；下单批→采购+终审）· W1–W2 守工厂节奏维持（审可执行性）'),
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
        h('div', { style: { display: 'flex', gap: 10, marginBottom: 11, flexWrap: 'wrap' } }, h('div', { style: { flex: 1, minWidth: 260, background: '#f6f9ff', border: '1px solid #d6e4fb', borderRadius: 7, padding: '9px 13px', fontSize: 12.5, color: '#26405f', lineHeight: 1.6 } }, h('b', { style: { color: '#1a5fb4' } }, '① 确认发货计划　'), '常规行顶栏「一键通过（例外除外）」；', h('b', null, '要改 → 展开趋势图直接拖节点'), '（上下 = 数量、左右 = 时间按周、点渠道名切换），曲线即时变，满意再「转修改申请」（模拟证据自动带入 + 补充说明必填）。闸：', h('b', null, 'W1–W2 不允许减量，销售不可推迟，采购仅 W1–W2 可直改'), ' · ', h('b', null, 'W3–W5 按修改后 7–14 天或不劣于系统建议判闸'), ' · ', h('b', null, 'W6–W7 = 下单异议'), '（W6 已承诺可议至 PO）。'), h('div', { style: { flex: 1, minWidth: 260, background: '#f6f9ff', border: '1px solid #d6e4fb', borderRadius: 7, padding: '9px 13px', fontSize: 12.5, color: '#26405f', lineHeight: 1.6 } }, h('b', { style: { color: '#1a5fb4' } }, '② 看覆盖前沿　'), '第三行「覆盖售卖期」= 这批发出去补的是哪段可售；点开行看测算（时效 / 安全库存 / 淡旺季）验系统算得对不对。')),
        h('div', { style: { fontSize: 12, color: '#36507e', background: '#eef4ff', borderLeft: '3px solid #3370ff', borderRadius: 5, padding: '9px 12px', lineHeight: 1.7, marginBottom: 12 } }, '数据口径：库存 / 安全天数 / 在途读取 daily_sales.v2_*；真实在途读取 expected_inventory（qty_shipped>0 且 remaining>0，锁定不可改）；建议计划读取 simulate_shipment.plan_source=shipment_plan_v2。', h('b', { style: { color: '#1f2329' } }, '格子主数和图表节点 = 新算法建议量；真实在途单独展示，并继续参与库存曲线推演。拖动和审批只改“建议量”，不改真实发货。净额列 = 只读结果 = W6+W7 建议量 − 未交货余量（2.5.2）。'), '净额 = 0 时本批不下新单。周二采购在净额区「生成下单计划」→ 下单执行看板（工厂×规格 · 调拨在看板算）→ 终审。')) : null,
      h(V19RoleBar, { role, mine, counts, batchSigned, poGenerated, orderWeek, onRole: setRole, onMine: setMine, onBatch: () => setBatchOpen(true), onGeneratePO: generatePO, onAllPass: allPass }),
      role === 'final' && (orderWeek || Object.values(changes).some((change) => change.status === 'fin')) ? h(V19FinalPanel, { rows: productViews, changes, signed: batchSigned, poGenerated, approved: poApproved, onApprove: approvePO, onOpenDetail: (row, weekIndex) => setDetail({ row, weekIndex }) }) : null,
      inflight ? h('div', { style: { margin: '8px 0', padding: '8px 12px', border: '1px solid #f0c36d', background: '#fff8e6', borderRadius: 8, fontSize: 12.5, color: '#7a4d00' } }, '⚠ ', h('b', null, '销售提交的修改需求进入审核流'), '；当前 ', h('b', null, inflight), ' 条在途。', h('span', { style: { color: '#8a9099' } }, '（原型：提交即计入状态机）')) : null,
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 10 } },
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
          h(V19ScopeControls, { selectedSale, saleOptions, productCount: scopedProducts.length, loading: catalogLoading || loading, onSaleChange: changeSale })),
        h('div', { style: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingLeft: 12, borderLeft: '1px solid #dfe4eb' } },
          h('span', { style: { fontSize: 12.5, fontWeight: 700, color: '#3a4763' } }, '筛选'),
          h(Select, { mode: 'multiple', allowClear: true, maxTagCount: 'responsive', size: 'small', value: labelFilter, placeholder: '全部产品标签', onChange: setLabelFilter, options: ['新品期', '成长期', '成熟期', '淘汰期'].map((value) => ({ value, label: value })), style: { width: 260 } }),
          h(Checkbox, { checked: onlyWarning, onChange: (event) => setOnlyWarning(event.target.checked) }, '仅看预警'),
          h(Checkbox, { checked: onlyChanged, onChange: (event) => setOnlyChanged(event.target.checked) }, '仅看本周动过的'),
          h(Tag, { color: 'blue', bordered: false }, '计划来源：新算法'))),
      h(V19Legend),
      catalogError ? h('div', { style: { padding: 10, border: '1px solid #f2b8b5', background: '#fff1f0', color: '#a61d24', borderRadius: 8, marginBottom: 10 } }, catalogError) : null,
      error ? h('div', { style: { padding: 10, border: '1px solid #f2b8b5', background: '#fff1f0', color: '#a61d24', borderRadius: 8, marginBottom: 10 } }, error) : null,
      catalogLoading || loading ? h('div', { style: { minHeight: 360, display: 'flex', alignItems: 'center', justifyContent: 'center' } }, h(Spin, { size: 'large', tip: '正在读取 daily_sales.v2、水位标签、真实在途和新算法建议...' })) : visibleRows.length ? h(V19Table, { rows: visibleRows, allScopeRows: productViews, changes, confirmedRows, role, orderWeek, poApproved, logisticsLeads, onEdit: openEdit, onOpenDetail: (row, weekIndex) => { setAuditNote(''); setDetail({ row, weekIndex }); } }) : h(Empty, { description: mine ? '当前角色没有待处理商品' : '当前筛选范围没有商品' })),
    h(V19EditModal, { target: editTarget, loading: actionLoading, onClose: () => setEditTarget(null), onSubmit: submitEdit }),
    h(V19ChangeDrawer, { detail, role, changes, auditNote, onAuditNote: setAuditNote, onClose: () => setDetail(null), onEdit: openEdit, onAction: actionChange }),
    h(V19BatchModal, { open: batchOpen, rows: productViews, changes, signed: batchSigned, onClose: () => setBatchOpen(false), onSign: signBatch, onAction: actionChange, onOpenDetail: (row, weekIndex) => { setBatchOpen(false); setDetail({ row, weekIndex }); } }));
}

ctx.render(h(ShipmentEvolutionBlockV19));
