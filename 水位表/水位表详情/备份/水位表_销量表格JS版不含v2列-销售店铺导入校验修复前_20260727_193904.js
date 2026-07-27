async function run() {
  const React = ctx.libs.React;
  const { useCallback, useEffect, useMemo, useRef, useState } = React;
  const { Button, ConfigProvider, Modal, Pagination, Tag, Tooltip } = ctx.libs.antd;

  const currentUserId = typeof ctx.getVar === 'function' ? await ctx.getVar('ctx.user.id') : null;
  const currentUserLevel = typeof ctx.getVar === 'function' ? Number(await ctx.getVar('ctx.user.level')) || 0 : 0;
  const IS_ADMIN = currentUserLevel >= 3;
  const BLOCK_UID = ctx.model?.uid || 'water_level_sales_table';
  const BLOCK_NAME = '水位表表格';
  const BLOCK_NAME_SETTING_KEY = `${BLOCK_UID}__block_name`;
  const FONT_SIZE = 13;
  const TABLE_FONT_SIZE = 14;
  const TOTAL_SHOP_NAME = '合计';
  const INVENTORY_WORKFLOW_KEY = 'rnrq9biwydo';
  const TRANSIT_WORKFLOW_KEY = 'wqf4rth9ui1';
  const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100', '200'];
  const ANTD_ZH_CN_LOCALE = {
    locale: 'zh_CN',
    Pagination: {
      items_per_page: '\u6761/\u9875',
      jump_to: '\u8df3\u81f3',
      jump_to_confirm: '\u786e\u5b9a',
      page: '\u9875',
      prev_page: '\u4e0a\u4e00\u9875',
      next_page: '\u4e0b\u4e00\u9875',
      prev_5: '\u5411\u524d 5 \u9875',
      next_5: '\u5411\u540e 5 \u9875',
      prev_3: '\u5411\u524d 3 \u9875',
      next_3: '\u5411\u540e 3 \u9875',
      page_size: '\u9875\u7801',
    },
  };
  const EXPORT_PAGE_SIZE = 1000;
  const TABLE_SCROLL_MAX_HEIGHT = 830;
  const TABLE_HEADER_PADDING = IS_ADMIN ? '5px 18px 5px 7px' : '5px 7px';
  const TABLE_CELL_PADDING = '3px 7px';
  const TOOLBAR_BUTTON_STYLE = {
    height: 28,
    padding: '0 10px',
    borderRadius: 6,
    border: '1px solid #d7e2f0',
    background: '#f8fbff',
    color: '#334155',
    fontSize: 12,
    fontWeight: 600,
    lineHeight: '26px',
    boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
    whiteSpace: 'nowrap',
  };
  const DEFAULT_HEADER_COLOR = '#fafafa';
  const IMPORTANT_COLUMN_BG = '#fffbe6';
  const DATA_BAR_FIELDS = ['inventory', 'sale_inventory'];
  const PUSH_PROP_OPTIONS = [
    { label: '显示/隐藏', value: 'hidden' },
    { label: '列宽', value: 'width' },
    { label: '表头名称', value: 'title' },
    { label: '表头颜色', value: 'headerColor' },
    { label: '重点列', value: 'important' },
  ];
  const apiRequest = (options) => {
    if (typeof ctx.request === 'function') return ctx.request(options);
    return ctx.api.request(options);
  };

  const FIELD_TITLES = {
    country: '国家',
    shop: '店铺',
    asin: 'ASIN',
    model: '型号',
    date: '日期',
    week: '周几',
    type: '日类型',
    weighted_sales: '加权基准销量',
    coefficient: '类型系数',
    maybe_sales: '预估销量',
    inventory: '库存',
    add: '补货',
    sale_maybe_sales: '销售预估销量',
    sale_estimate_type: '销售预估日类型',
    on_the_way: '在途',
    sales_store: '销售店铺',
    quantity_receive: '待交付',
    overseas_warehouse_test_product: '海外仓检测品库存',
    overseas_warehouse_new_product: '海外仓全新品库存',
    days_for_sale: '安全库存天数',
    estimate_days_for_sales: '销售预估安全库存天数',
    sale_inventory: '销售预估库存',
    sales: '实际销量',
    base_sales: '基准销量',
  };

  const HEADER_TOOLTIPS = {
    inventory: '数据来源0点库存表：各店铺的FBA可售+待调仓的合计',
    days_for_sale: '库存/加权基准销量（向下取整）',
    estimate_days_for_sales: '销售预估库存/加权基准销量（向下取整）',
  };

  const TYPE_COLORS = {
    日常: 'default',
    淡季: 'green',
    淡季过渡: 'lime',
    '7月PD': 'orange',
    '10月秋促': 'gold',
    黑五网一: 'magenta',
    BD: 'cyan',
    'BD（预测）': 'blue',
    LD: 'blue',
    'BD (7月PD)': 'volcano',
    'LD (7月PD)': 'red',
    'BD (10月秋促)': 'volcano',
    'LD (10月秋促)': 'red',
    'BD (黑五网一)': 'volcano',
    'LD (黑五网一)': 'red',
    'BD（淡季）': 'green',
    'LD（淡季）': 'green',
    '10月秋促(专享)': 'orange',
    '7月PD(专享)': 'gold',
    '黑五网一(专享)': 'magenta',
    woot: 'geekblue',
    旺季: 'purple',
  };

  const TYPE_STYLES = {
    日常: { bg: '#f5f7fa', border: '#d9dee7', text: '#344054' },
    淡季: { bg: '#ecfdf3', border: '#abefc6', text: '#067647' },
    淡季过渡: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    '7月PD': { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
    '10月秋促': { bg: '#fefce8', border: '#fde68a', text: '#a16207' },
    黑五网一: { bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d' },
    BD: { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
    'BD（预测）': { bg: '#f0f9ff', border: '#bae6fd', text: '#0369a1' },
    LD: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    'BD (7月PD)': { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' },
    'LD (7月PD)': { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
    'BD (10月秋促)': { bg: '#fff7ed', border: '#fdba74', text: '#c2410c' },
    'LD (10月秋促)': { bg: '#fff1f2', border: '#fda4af', text: '#be123c' },
    'BD (黑五网一)': { bg: '#fdf2f8', border: '#f9a8d4', text: '#be185d' },
    'LD (黑五网一)': { bg: '#fdf2f8', border: '#f0abfc', text: '#a21caf' },
    'BD（淡季）': { bg: '#ecfdf3', border: '#86efac', text: '#166534' },
    'LD（淡季）': { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    '10月秋促(专享)': { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    '7月PD(专享)': { bg: '#fff7ed', border: '#fb923c', text: '#9a3412' },
    '黑五网一(专享)': { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
    woot: { bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
    旺季: { bg: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9' },
    大旺季: { bg: '#fff1f2', border: '#fda4af', text: '#be123c' },
    '2026世界杯': { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
  };

  function getTypeStyle(type) {
    return TYPE_STYLES[type] || { bg: '#eef2ff', border: '#c7d2fe', text: '#4338ca' };
  }

  const DAY_TYPE_CATEGORY_STYLES = {
    基础类型: { bg: '#eff6ff', border: '#eff6ff', text: '#2563eb' },
    叠加基础类型: { bg: '#ecfdf5', border: '#ecfdf5', text: '#059669' },
    专享类型: { bg: '#fffbeb', border: '#fffbeb', text: '#d97706' },
    大促BDLD: { bg: '#fef2f2', border: '#fef2f2', text: '#dc2626' },
    基础活动类型: { bg: '#ecfeff', border: '#ecfeff', text: '#0e7490' },
    固定活动类型: { bg: '#f5f3ff', border: '#f5f3ff', text: '#6d28d9' },
    不参与: { bg: '#f4f4f5', border: '#f4f4f5', text: '#71717a' },
  };

  function getDayTypeCategoryStyle(type, categoryMap) {
    const category = categoryMap?.[type];
    return DAY_TYPE_CATEGORY_STYLES[category] || DAY_TYPE_CATEGORY_STYLES.不参与;
  }

  function splitDailyTypes(value) {
    return String(value || '')
      .split('、')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  const FUTURE_COLUMNS = [
    { field: 'shop', width: 98 },
    { field: 'date', width: 131 },
    { field: 'type', width: 114 },
    { field: 'coefficient', width: 68, align: 'right' },
    { field: 'weighted_sales', width: 77, align: 'right' },
    { field: 'maybe_sales', width: 85, align: 'right', headerColor: '#F2BABA' },
    { field: 'inventory', width: 80, align: 'right', headerColor: '#F2BABA' },
    { field: 'sale_maybe_sales', width: 112, align: 'right', headerColor: '#EB6793' },
    { field: 'sale_inventory', width: 114, align: 'right', headerColor: '#EB6793' },
    { field: 'sale_estimate_type', width: 126, headerColor: '#EB6793' },
    { field: 'sales_store', width: 85, headerColor: '#5DBEAC' },
    { field: 'add', width: 58, align: 'right' },
    { field: 'on_the_way', width: 57, align: 'right' },
    { field: 'days_for_sale', width: 98, align: 'right' },
    { field: 'estimate_days_for_sales', width: 126, align: 'right' },
    { field: 'quantity_receive', width: 73, align: 'right' },
    { field: 'overseas_warehouse_test_product', width: 97, title: '海外检测品' },
    { field: 'overseas_warehouse_new_product', width: 100, title: '海外全新品' },
  ];

  const PAST_COLUMNS = [
    { field: 'shop', width: 75 },
    { field: 'date', width: 121 },
    { field: 'sales', width: 80, align: 'right' },
    { field: 'maybe_sales', width: 80, align: 'right' },
    { field: 'sale_maybe_sales', width: 95, align: 'right' },
    { field: 'type', width: 76 },
    { field: 'coefficient', width: 80, align: 'right' },
    { field: 'inventory', width: 58, align: 'right' },
    { field: 'weighted_sales', width: 86, align: 'right' },
    { field: 'base_sales', width: 67, align: 'right' },
  ];

  const EXPORT_LOGISTICS_FIELDS = [
    'country', 'shop', 'asin', 'model', 'date', 'type', 'coefficient', 'weighted_sales',
    'maybe_sales', 'inventory', 'sale_maybe_sales', 'sale_inventory', 'add', 'on_the_way',
    'days_for_sale', 'estimate_days_for_sales', 'quantity_receive',
    'overseas_warehouse_test_product', 'overseas_warehouse_new_product',
  ];

  const EXPORT_SALES_FIELDS = [
    'country', 'shop', 'asin', 'date', 'week', 'type', 'maybe_sales', 'sale_maybe_sales', 'sale_estimate_type', 'sales_store',
  ];

  function parseSearch(search) {
    const result = {};
    if (!search) return result;
    String(search).replace(/^\?/, '').split('&').forEach((part) => {
      if (!part) return;
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
      if (key) result[decodeURIComponent(key)] = decodeURIComponent(value);
    });
    return result;
  }

  function isShopKey(key) {
    return key === 'shop' || /^shop\d+$/.test(key);
  }

  function rememberStableUrlParams(params) {
    const stableParams = {};
    Object.keys(params || {}).forEach((key) => {
      const value = params[key];
      if (!isShopKey(key) && value != null && value !== '') {
        stableParams[key] = value;
      }
    });
    if (Object.keys(stableParams).length > 0) {
      globalThis.__NOCOBASE_URL_PARAMS__ = stableParams;
    }
    if (params?.shop) {
      globalThis.__NOCOBASE_SHOP_PARAM__ = params.shop;
    }
  }

  function getRouterLikeSearch(routerLike) {
    return (
      routerLike?.state?.location?.search
      || routerLike?.location?.search
      || ''
    );
  }

  function getRouterLikePathname(routerLike) {
    return (
      routerLike?.state?.location?.pathname
      || routerLike?.location?.pathname
      || '/'
    );
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

  function readUrlParams() {
    const params = {
      ...(ctx.urlSearchParams || {}),
      ...(ctx.app?.router?.location?.query || {}),
      ...parseSearch(ctx.app?.router?.location?.search || ''),
      ...parseSearch(getRouterSearch()),
    };
    rememberStableUrlParams(params);
    return params;
  }

  function buildSearch(params) {
    const query = Object.keys(params)
      .filter((key) => params[key] != null && params[key] !== '')
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    return query ? `?${query}` : '';
  }

  function replaceUrlParams(params) {
    rememberStableUrlParams(params);
    const search = buildSearch(params);
    const pathname = getRouterPathname();
    const routers = [ctx.router, ctx.app?.router?.router].filter(Boolean);
    routers.forEach((router) => {
      if (typeof router.navigate === 'function') {
        router.navigate({ pathname, search, hash: '' }, { replace: true });
      }
    });
  }

  function restoreMissingUrlParams() {
    const savedParams = globalThis.__NOCOBASE_URL_PARAMS__ || {};
    const savedShop = globalThis.__NOCOBASE_SHOP_PARAM__ || '';
    if (Object.keys(savedParams).length === 0 && !savedShop) return false;

    const router = ctx.app?.router?.router || ctx.router;
    if (!router || typeof router.navigate !== 'function') return false;

    const currentParams = {
      ...(ctx.app?.router?.location?.query || {}),
      ...parseSearch(getRouterLikeSearch(router)),
    };
    const hasMissingStableParam = Object.keys(savedParams).some((key) => currentParams[key] !== savedParams[key]);
    const hasMissingShop = savedShop && currentParams.shop !== savedShop;
    if (!hasMissingStableParam && !hasMissingShop) return false;

    const nextParams = { ...currentParams, ...savedParams };
    if (savedShop) nextParams.shop = savedShop;
    router.navigate(
      { pathname: getRouterLikePathname(router), search: buildSearch(nextParams), hash: '' },
      { replace: true },
    );
    return true;
  }

  function todayString() {
    const today = new Date();
    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function formatDateYMD(value) {
    if (!value) return '';
    const text = String(value);
    return text.length >= 10 ? text.slice(0, 10) : text;
  }

  function formatWeekday(value, fallbackDate) {
    const weekText = String(value || '').trim();
    if (/^周[一二三四五六日]$/.test(weekText)) return weekText;

    const englishWeekMap = {
      sunday: '\u5468\u65e5',
      monday: '\u5468\u4e00',
      tuesday: '\u5468\u4e8c',
      wednesday: '\u5468\u4e09',
      thursday: '\u5468\u56db',
      friday: '\u5468\u4e94',
      saturday: '\u5468\u516d',
    };
    const mappedWeek = englishWeekMap[weekText.toLowerCase()];
    if (mappedWeek) return mappedWeek;

    const dateText = formatDateYMD(weekText) || formatDateYMD(fallbackDate);
    if (!dateText) return weekText;

    const parsed = new Date(dateText);
    if (Number.isNaN(parsed.getTime())) return weekText;

    const weekDays = [
      '\u5468\u65e5',
      '\u5468\u4e00',
      '\u5468\u4e8c',
      '\u5468\u4e09',
      '\u5468\u56db',
      '\u5468\u4e94',
      '\u5468\u516d',
    ];
    return weekDays[parsed.getDay()];
  }

  function formatDateKey(value) {
    const text = formatDateYMD(value);
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.replace(/-/g, '');
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text.replace(/\D/g, '');
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0'),
    ].join('');
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '';
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return String(value);
    return Number.isInteger(numberValue)
      ? String(numberValue)
      : numberValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function renderValue(field, value, dayTypeCategoryMap = {}) {
    if (field === 'date') {
      const dateText = formatDateYMD(value);
      if (!dateText) return '';
      const parsed = new Date(dateText);
      if (Number.isNaN(parsed.getTime())) return dateText;
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${dateText} ${weekDays[parsed.getDay()]}`;
    }
    if (field === 'type' || field === 'sale_estimate_type') {
      if (!value) return '';
      const types = splitDailyTypes(value);
      return React.createElement('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          flexWrap: 'nowrap',
          gap: 4,
          whiteSpace: 'nowrap',
        },
      }, types.map((type) => {
        const style = getDayTypeCategoryStyle(type, dayTypeCategoryMap);
        return React.createElement('span', {
          key: type,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            padding: '1px 7px',
            borderRadius: 4,
            border: `1px solid ${style.border}`,
            background: style.bg,
            color: style.text,
            fontWeight: 600,
            fontSize: 12,
            lineHeight: 1.6,
            whiteSpace: 'nowrap',
          },
        }, type);
      }));
    }
    if (
      field.includes('sales')
      || field.includes('inventory')
      || field === 'coefficient'
      || field === 'add'
      || field === 'on_the_way'
      || field === 'quantity_receive'
      || field === 'base_sales'
    ) {
      return formatNumber(value);
    }
    return value == null ? '' : String(value);
  }

  function renderDataBarValue(field, value, maxAbs) {
    const numberValue = Number(value);
    const hasBar = value !== null
      && value !== undefined
      && value !== ''
      && Number.isFinite(numberValue)
      && numberValue !== 0
      && maxAbs > 0;
    const width = hasBar ? Math.min(100, (Math.abs(numberValue) / maxAbs) * 100) : 0;

    return React.createElement('span', {
      style: {
        position: 'relative',
        display: 'block',
        minWidth: 0,
        padding: TABLE_CELL_PADDING,
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontVariantNumeric: 'tabular-nums',
      },
    },
      hasBar
        ? React.createElement('span', {
          'aria-hidden': true,
          style: {
            position: 'absolute',
            top: 0,
            bottom: 0,
            [numberValue > 0 ? 'left' : 'right']: 0,
            width: `${width}%`,
            background: numberValue > 0
              ? 'rgba(34,197,94,0.38)'
              : 'rgba(239,68,68,0.40)',
            pointerEvents: 'none',
          },
        })
        : null,
      React.createElement('span', {
        style: {
          position: 'relative',
          zIndex: 1,
        },
      }, renderValue(field, value)),
    );
  }

  function getTextColorForBg(color) {
    if (!color || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return '#333';
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((char) => char + char).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#333' : '#fff';
  }

  function getColumnHeaderColor(col) {
    return col.headerColor || (col.important ? '#fff1b8' : DEFAULT_HEADER_COLOR);
  }

  function isNumericField(field) {
    return (
      field.includes('sales')
      || field.includes('inventory')
      || field === 'coefficient'
      || field === 'add'
      || field === 'on_the_way'
      || field === 'quantity_receive'
      || field === 'base_sales'
    );
  }

  function getAutoWidthText(field, value) {
    if (field === 'date') {
      const dateText = formatDateYMD(value);
      if (!dateText) return '';
      const parsed = new Date(dateText);
      if (Number.isNaN(parsed.getTime())) return dateText;
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${dateText} ${weekDays[parsed.getDay()]}`;
    }
    if (isNumericField(field)) return formatNumber(value);
    return value == null ? '' : String(value);
  }

  function estimateTextWidth(text, fontSize = FONT_SIZE) {
    if (text == null) return 0;
    let width = 0;
    String(text).split('').forEach((char) => {
      if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) width += 1.05;
      else if (/[A-Z]/.test(char)) width += 0.72;
      else if (/[a-z0-9]/.test(char)) width += 0.62;
      else width += 0.5;
    });
    return Math.ceil(width * fontSize);
  }

  function estimateTypeCellWidth(value) {
    const types = splitDailyTypes(value);
    if (!types.length) return 0;
    const tagsWidth = types.reduce((sum, type) => sum + estimateTextWidth(type, FONT_SIZE) + 16, 0);
    const gapsWidth = Math.max(0, types.length - 1) * 4;
    return tagsWidth + gapsWidth + 14;
  }

  function getAutoWidthBounds(col) {
    const field = col.field;
    if (field === 'date') return { min: 108, max: 150 };
    if (field === 'type') return { min: 58, max: 220 };
    if (field === 'shop' || field === 'sales_store') return { min: 50, max: 180 };
    if (field === 'model') return { min: 58, max: 200 };
    if (field === 'asin') return { min: 104, max: 180 };
    if (field?.startsWith('overseas_warehouse')) return { min: 58, max: 220 };
    if (field === 'days_for_sale' || field === 'estimate_days_for_sales' || field === 'sale_inventory') {
      return { min: 58, max: 220 };
    }
    if (isNumericField(field)) return { min: 50, max: 180 };
    return { min: 50, max: 220 };
  }

  function clampWidth(width, bounds) {
    return Math.max(bounds.min, Math.min(bounds.max, width));
  }

  function pickRows(response) {
    const data = response?.data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  }

  function pickTotal(response, fallback) {
    const meta = response?.data?.meta || response?.meta || response?.data?.data?.meta || {};
    const candidates = [
      meta.count,
      meta.total,
      meta.totalCount,
      response?.data?.count,
      response?.data?.total,
      response?.count,
      response?.total,
    ];
    for (const value of candidates) {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) return numberValue;
    }
    const fallbackValue = Number(fallback);
    return Number.isFinite(fallbackValue) ? fallbackValue : 0;
  }

  function pickReportedTotal(response) {
    const meta = response?.data?.meta || response?.meta || response?.data?.data?.meta || {};
    const candidates = [
      meta.count,
      meta.total,
      meta.totalCount,
      response?.data?.count,
      response?.data?.total,
      response?.count,
      response?.total,
    ];
    for (const value of candidates) {
      const numberValue = Number(value);
      if (Number.isFinite(numberValue)) return numberValue;
    }
    return null;
  }

  function getResponseError(response) {
    const successFlag = response?.data?.success ?? response?.success;
    return (
      response?.data?.errors?.[0]?.message
      || response?.data?.error?.message
      || response?.error?.message
      || (successFlag === false ? (response?.data?.message || response?.message) : '')
      || ''
    );
  }

  function notifyTask(key, message, description, duration = 0) {
    ctx.notification?.open?.({
      key,
      message,
      description,
      duration,
      placement: 'topRight',
    });
  }

  function buildFilter(params, mode) {
    const items = [];
    if (params.asin) items.push({ asin: { $eq: params.asin } });
    if (params.country) items.push({ country: { $eq: params.country } });
    if (params.shop) items.push({ shop: { $eq: params.shop } });

    items.push(
      mode === 'future'
        ? { date: { $dateNotBefore: todayString() } }
        : { date: { $dateNotAfter: todayString() } },
    );

    return JSON.stringify({ $and: items });
  }

  function normalizeColumnDefs(columnDefs) {
    return columnDefs.map((col) => ({
      key: col.key || col.field,
      ...col,
      width: Number(col.width) || 100,
      hidden: col.hidden === true,
      headerColor: col.headerColor || null,
      important: col.important === true,
      title: col.title || FIELD_TITLES[col.field] || col.field,
    }));
  }

  function getColumnTitle(col) {
    return col.title || FIELD_TITLES[col.field] || col.field;
  }

  function getColumnTooltip(col) {
    return HEADER_TOOLTIPS[col.field] || '';
  }

  function renderColumnTitle(col) {
    const tooltipText = getColumnTooltip(col);
    const titleNode = React.createElement('span', {
      style: {
        minWidth: 0,
        overflow: 'hidden',
        whiteSpace: 'normal',
        overflowWrap: 'anywhere',
        wordBreak: 'break-word',
      },
    }, getColumnTitle(col));

    if (!tooltipText || !Tooltip) return titleNode;
    return React.createElement(React.Fragment, null,
      titleNode,
      React.createElement(Tooltip, { title: tooltipText, placement: 'top' },
        React.createElement('span', {
          onClick: (event) => event.stopPropagation(),
          onDoubleClick: (event) => event.stopPropagation(),
          onMouseDown: (event) => event.stopPropagation(),
          style: {
            flex: '0 0 auto',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 13,
            height: 13,
            marginLeft: 3,
            border: '1px solid currentColor',
            borderRadius: '50%',
            color: '#6b7280',
            fontSize: 10,
            fontWeight: 700,
            lineHeight: '12px',
            cursor: 'help',
            transform: 'translateY(-0.5px)',
          },
        }, '?'),
      ),
    );
  }

  async function requestDailySales(mode, params, page, pageSize, fields) {
    return apiRequest({
      url: 'daily_sales:list',
      method: 'get',
      params: {
        page,
        pageSize,
        sort: mode === 'future' ? 'date' : '-date',
        filter: buildFilter(params, mode),
        ...(fields ? { fields: fields.join(',') } : {}),
      },
    });
  }

  async function requestShopList(asin, country) {
    if (!asin || !country) return [];
    const response = await apiRequest({
      url: 'inventory_base:list',
      method: 'get',
      params: {
        page: 1,
        pageSize: 200,
        fields: 'shop',
        filter: JSON.stringify({
          $and: [
            { asin: { $eq: asin } },
            { country: { $eq: country } },
            { date: { $eq: todayString() } },
          ],
        }),
      },
    });
    return Array.from(new Set(pickRows(response).map((row) => row.shop).filter(Boolean)));
  }

  async function requestSalesCoefficientList(asin, country) {
    if (!asin || !country) return [];
    const response = await apiRequest({
      url: 'sales_coefficient:list',
      method: 'get',
      params: {
        page: 1,
        pageSize: 200,
        fields: 'country,asin,type,coefficient,country_asin_type,last_modified_date',
        filter: JSON.stringify({
          $and: [
            { asin: { $eq: asin } },
            { country: { $eq: country } },
          ],
        }),
      },
    });

    const rows = pickRows(response);
    const seen = new Set();
    const orderedTypes = Object.keys(TYPE_COLORS);

    return rows
      .filter((row) => row.type)
      .filter((row) => {
        if (seen.has(row.type)) return false;
        seen.add(row.type);
        return true;
      })
      .sort((a, b) => {
        const ai = orderedTypes.indexOf(a.type);
        const bi = orderedTypes.indexOf(b.type);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return String(a.type).localeCompare(String(b.type), 'zh-CN');
      });
  }

  async function requestDayTypeCategoryMap(country) {
    if (!country) return {};
    const response = await apiRequest({
      url: 'datetypetime:list',
      method: 'get',
      params: {
        page: 1,
        pageSize: 1000,
        fields: 'country,daytype,daytype_category',
      },
    });

    const targetCountry = String(country).trim();
    return pickRows(response).reduce((map, row) => {
      const countries = String(row.country || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean);
      if (
        countries.includes(targetCountry)
        && row.daytype
        && row.daytype_category
        && !map[row.daytype]
      ) {
        map[row.daytype] = row.daytype_category;
      }
      return map;
    }, {});
  }

  function toCsvCell(value) {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function safeFilenamePart(value) {
    return String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ');
  }

  function downloadCsv(filename, fields, rows) {
    const header = fields.map((field) => FIELD_TITLES[field] || field);
    const lines = [
      header.map(toCsvCell).join(','),
      ...rows.map((row) => fields.map((field) => {
        if (field === 'date') return toCsvCell(formatDateYMD(row[field]));
        if (field === 'week') return toCsvCell(formatWeekday(row[field], row.date));
        return toCsvCell(row[field]);
      }).join(',')),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    const host = ctx.element;
    if (host && typeof host.appendChild === 'function') {
      host.appendChild(link);
      link.click();
      link.remove();
    } else {
      link.click();
    }

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function requestAllDailySales(mode, params, fields) {
    const allRows = [];
    let page = 1;
    let reportedTotal = null;

    while (true) {
      const response = await requestDailySales(mode, params, page, EXPORT_PAGE_SIZE, fields);
      const errorMessage = getResponseError(response);
      if (errorMessage) throw new Error(errorMessage);

      const rows = pickRows(response);
      allRows.push(...rows);
      reportedTotal = pickReportedTotal(response);

      if (
        !rows.length
        || rows.length < EXPORT_PAGE_SIZE
        || (reportedTotal != null && allRows.length >= reportedTotal)
      ) break;
      page += 1;
    }

    return allRows;
  }

  async function exportRows(params, type) {
    if (!params.asin || !params.country) {
      ctx.message?.warning?.('请先选择 ASIN 和国家后再导出');
      return;
    }

    const fields = type === 'sales' ? EXPORT_SALES_FIELDS : EXPORT_LOGISTICS_FIELDS;
    const label = type === 'sales' ? '销售' : '物流';
    notifyTask(`export-${type}`, `导出执行中 - ${label}`, '正在拉取数据并生成 CSV，请稍候...');

    const rows = await requestAllDailySales('future', params, fields);
    const filename = [
      '未来销量模拟',
      label,
      safeFilenamePart(params.asin),
      safeFilenamePart(params.country),
      safeFilenamePart(params.shop || TOTAL_SHOP_NAME),
    ].filter(Boolean).join('-');

    downloadCsv(`${filename}.csv`, fields, rows);
    notifyTask(`export-${type}`, `导出完成 - ${label}`, `已导出 ${rows.length} 条`, 4.5);
    ctx.message?.success?.(`已导出 ${rows.length} 条`);
  }

  function detectDelimiter(headerLine) {
    const candidates = [',', ';', '\t'];
    const counts = candidates.map((delimiter) => headerLine.split(delimiter).length - 1);
    const max = Math.max(...counts);
    return max > 0 ? candidates[counts.indexOf(max)] : ',';
  }

  function cleanCell(value) {
    let text = String(value == null ? '' : value).trim();
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
    if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) text = text.slice(1, -1);
    return text.trim();
  }

  function parseCsvLine(line, delimiter) {
    const values = [];
    let current = '';
    let inQuotes = false;

    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      const nextChar = line[index + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          index += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === delimiter && !inQuotes) {
        values.push(cleanCell(current));
        current = '';
      } else {
        current += char;
      }
    }

    values.push(cleanCell(current));
    return values;
  }

  async function runWithConcurrency(tasks, concurrency) {
    const results = [];
    const executing = new Set();
    for (const task of tasks) {
      const promise = task()
        .then((value) => {
          executing.delete(promise);
          return { status: 'fulfilled', value };
        })
        .catch((reason) => {
          executing.delete(promise);
          return { status: 'rejected', reason };
        });
      results.push(promise);
      executing.add(promise);
      if (executing.size >= concurrency) await Promise.race(executing);
    }
    return Promise.all(results);
  }

  async function updateDailySalesRows(updates, buildData, label) {
    let successCount = 0;
    let failCount = 0;
    notifyTask(`import-${label}`, `导入进度 - ${label}`, `执行中，共 ${updates.length} 条...`);

    const tasks = updates.map((update) => async () => {
      await apiRequest({
        url: 'daily_sales:update',
        method: 'post',
        params: { filterByTk: update.shop_country_asin_date },
        data: buildData(update),
      });
    });

    const results = await runWithConcurrency(tasks, 15);
    results.forEach((result) => {
      if (result.status === 'fulfilled') successCount += 1;
      else failCount += 1;
    });

    ctx.notification?.open?.({
      key: `import-${label}`,
      message: `导入进度 - ${label}`,
      description: `成功 ${successCount} 条，失败 ${failCount} 条`,
      duration: 4.5,
    });
    return { successCount, failCount };
  }

  async function importSalesCsv(file, onDone) {
    const requiredColumns = ['国家', '店铺', 'ASIN', '日期', '周几', '日类型', '预估销量', '销售预估销量', '销售预估日类型', '销售店铺'];
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const lines = text.split('\n').map((line) => line.replace(/\r$/, '')).filter((line) => line.trim());
    if (lines.length < 2) throw new Error('CSV 文件内容为空或格式不正确');

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCsvLine(lines[0], delimiter);
    const missing = requiredColumns.filter((column) => !headers.includes(column));
    if (missing.length) throw new Error(`CSV 文件缺少必需列: ${missing.join(', ')}`);

    const updatesHeji = [];
    const updatesSalesStore = [];
    const mainStoreMap = {};
    const skippedStats = {
      columnMismatch: 0,
      missingSaleMaybeSales: 0,
      missingSalesStore: 0,
      missingKeyFields: 0,
    };
    notifyTask('sales-import-main', 'CSV 导入执行中', '正在读取 CSV 并准备更新数据...');

    for (let index = 1; index < lines.length; index += 1) {
      const values = parseCsvLine(lines[index], delimiter);
      if (values.length !== headers.length) {
        skippedStats.columnMismatch += 1;
        continue;
      }
      const row = {};
      headers.forEach((header, valueIndex) => {
        row[header] = values[valueIndex];
      });

      const saleMaybeSalesRaw = String(row['销售预估销量'] || '').trim();
      const saleEstimateTypeRaw = String(row['销售预估日类型'] || '').trim();
      const salesStoreRaw = String(row['销售店铺'] || '').trim();
      const countryRaw = String(row['国家'] || '').trim();
      const asinRaw = String(row['ASIN'] || '').trim();
      const dateKey = formatDateKey(row['日期']);
      if (!saleMaybeSalesRaw) {
        skippedStats.missingSaleMaybeSales += 1;
        continue;
      }
      const saleValue = parseInt(saleMaybeSalesRaw, 10) || 0;
      if (!salesStoreRaw && saleValue !== 0) {
        skippedStats.missingSalesStore += 1;
        continue;
      }
      if (!countryRaw || !asinRaw || !dateKey) {
        skippedStats.missingKeyFields += 1;
        continue;
      }

      const comboKey = `${countryRaw}_${asinRaw}_${dateKey}`;
      if (!Object.prototype.hasOwnProperty.call(mainStoreMap, comboKey)) {
        mainStoreMap[comboKey] = salesStoreRaw;
      }

      updatesHeji.push({
        shop_country_asin_date: `${TOTAL_SHOP_NAME}_${countryRaw}_${asinRaw}_${dateKey}`,
        sales_store: salesStoreRaw || null,
        sale_maybe_sales: saleValue,
        sale_estimate_type: saleEstimateTypeRaw || null,
      });
      if (salesStoreRaw) {
        updatesSalesStore.push({
          shop_country_asin_date: `${salesStoreRaw}_${countryRaw}_${asinRaw}_${dateKey}`,
          sale_maybe_sales: saleValue,
          sale_estimate_type: saleEstimateTypeRaw || null,
        });
      }
    }

    if (!updatesHeji.length) {
      const reasons = [
        skippedStats.columnMismatch ? `列数不匹配 ${skippedStats.columnMismatch} 行` : '',
        skippedStats.missingSaleMaybeSales ? `缺少销售预估销量 ${skippedStats.missingSaleMaybeSales} 行` : '',
        skippedStats.missingSalesStore ? `缺少销售店铺 ${skippedStats.missingSalesStore} 行` : '',
        skippedStats.missingKeyFields ? `缺少国家/ASIN/日期 ${skippedStats.missingKeyFields} 行` : '',
      ].filter(Boolean);
      throw new Error(`没有找到有效数据行${reasons.length ? `：${reasons.join('；')}` : ''}`);
    }
    notifyTask(
      'sales-import-main',
      'CSV 导入执行中',
      `已解析 ${updatesHeji.length} 条有效数据，正在更新合计店铺和销售店铺...`,
    );

    const resultA = await updateDailySalesRows(
      updatesHeji,
      (update) => ({
        sales_store: update.sales_store,
        sale_maybe_sales: update.sale_maybe_sales,
        sale_estimate_type: update.sale_estimate_type,
      }),
      '合计店铺',
    );
    const resultB = await updateDailySalesRows(
      updatesSalesStore,
      (update) => ({
        sale_maybe_sales: update.sale_maybe_sales,
        sale_estimate_type: update.sale_estimate_type,
      }),
      '销售店铺',
    );

    const zeroUpdates = [];
    notifyTask('sales-import-main', 'CSV 导入执行中', '正在查询并置零非主销售店铺...');
    for (const comboKey of Object.keys(mainStoreMap)) {
      const parts = comboKey.split('_');
      const country = parts[0];
      const dateKey = parts[parts.length - 1];
      const asin = parts.slice(1, -1).join('_');
      const mainStore = mainStoreMap[comboKey];

      try {
        const response = await apiRequest({
          url: 'daily_sales:list',
          method: 'get',
          params: {
            pageSize: 200,
            fields: 'shop,country,asin,date',
            filter: JSON.stringify({ country, asin, date: dateKey }),
          },
        });
        pickRows(response).forEach((record) => {
          if (!record.shop || record.shop === mainStore || record.shop === TOTAL_SHOP_NAME) return;
          zeroUpdates.push({
            shop_country_asin_date: `${record.shop}_${country}_${asin}_${dateKey}`,
            sale_maybe_sales: 0,
          });
        });
      } catch (error) {
        console.warn('[WaterLevel] zero-out query failed:', comboKey, error?.message);
      }
    }

    const resultC = zeroUpdates.length
      ? await updateDailySalesRows(zeroUpdates, () => ({ sale_maybe_sales: 0 }), '非主非合置零')
      : { successCount: 0, failCount: 0 };

    notifyTask(
      'sales-import-main',
      'CSV 导入完成',
      `合计 ${resultA.successCount} 条，销售店铺 ${resultB.successCount} 条，置零 ${resultC.successCount} 条`,
      4.5,
    );
    ctx.message?.success?.(
      `导入完成：合计 ${resultA.successCount} 条，销售店铺 ${resultB.successCount} 条，置零 ${resultC.successCount} 条`,
    );
    if (typeof onDone === 'function') onDone();
  }

  function chooseImportFile(onDone) {
    Modal.confirm({
      title: '导入提示',
      content: '导入格式：CSV UTF-8（逗号分隔）。将更新 daily_sales 的销售预估销量、销售预估日类型与销售店铺。',
      okText: '我知道了，开始导入',
      cancelText: '取消',
      onOk: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        input.style.display = 'none';
        input.onchange = async (event) => {
          const file = event.target.files?.[0];
          input.remove();
          if (!file) return;
          try {
            await importSalesCsv(file, onDone);
          } catch (error) {
            notifyTask('sales-import-main', 'CSV 导入失败', error?.message || String(error), 8);
            ctx.message?.error?.(`CSV 导入失败: ${error?.message || error}`);
          }
        };

        const host = ctx.element;
        if (host && typeof host.appendChild === 'function') {
          host.appendChild(input);
          input.click();
        } else {
          input.click();
        }
      },
    });
  }

  async function triggerInventoryWorkflow(params, onDone) {
    if (!params.asin || !params.country) {
      ctx.message?.warning?.('请先选择 ASIN 和国家后再更新库存');
      return;
    }

    const contextValues = {
      asin: params.asin || '',
      country: params.country || '',
      shop: params.shop || TOTAL_SHOP_NAME,
    };

    notifyTask('inventory-update', '预估库存更新执行中', '已开始触发预估库存更新，请稍候...');

    const response = await apiRequest({
      url: 'workflows:trigger',
      method: 'post',
      params: { triggerWorkflows: INVENTORY_WORKFLOW_KEY },
      data: { values: contextValues },
    });

    const errorMessage = getResponseError(response);
    if (errorMessage) throw new Error(errorMessage);

    notifyTask('inventory-update', '预估库存更新已触发', '后台 workflow 已开始执行，稍后请刷新查看结果。', 4.5);
    ctx.message?.success?.('已触发预估库存更新');
    if (typeof onDone === 'function') onDone();
  }

  async function refreshAndTriggerInventory(params, reloadAll) {
    if (typeof reloadAll === 'function') reloadAll();
    try {
      await triggerInventoryWorkflow(params, reloadAll);
    } catch (error) {
      notifyTask('inventory-update', '预估库存更新失败', error?.message || String(error), 8);
      ctx.message?.error?.(`预估库存更新失败: ${error?.message || error}`);
    }
  }

  async function triggerTransitWorkflow(params, onDone) {
    if (!params.asin || !params.country) {
      ctx.message?.warning?.('请先选择 ASIN 和国家后再更新在途');
      return;
    }

    const contextValues = {
      asin: params.asin || '',
      country: params.country || '',
    };

    notifyTask('transit-update', '更新在途执行中', '已开始触发在途更新，请稍候...');

    const response = await apiRequest({
      url: 'workflows:trigger',
      method: 'post',
      params: { triggerWorkflows: TRANSIT_WORKFLOW_KEY },
      data: { values: contextValues },
    });

    const errorMessage = getResponseError(response);
    if (errorMessage) throw new Error(errorMessage);

    notifyTask('transit-update', '更新在途已触发', '后台 workflow 已开始执行，稍后请刷新查看结果。', 4.5);
    ctx.message?.success?.('已触发在途更新');
    if (typeof onDone === 'function') onDone();
  }

  const SalesTable = ({
    title,
    mode,
    columns,
    pageSizeDefault,
    params,
    refreshKey,
    dayTypeCategoryMap,
    toolbar,
    headerExtra,
  }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizeDefault);
    const [total, setTotal] = useState(0);
    const [columnDefs, setColumnDefs] = useState(() => normalizeColumnDefs(columns));
    const [isResizing, setIsResizing] = useState(false);
    const requestSeqRef = useRef(0);
    const resizeRef = useRef(null);
    const manuallyResizedRef = useRef(new Set());

    const updateColumns = useCallback((updater) => {
      setColumnDefs((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return next;
      });
    }, []);

    const autoFitColumns = useCallback((cols, sampleRows) => cols.map((col) => {
      if (manuallyResizedRef.current.has(col.key)) return col;
      const headerText = getColumnTitle(col);
      const bounds = getAutoWidthBounds(col);
      const headerPadding = IS_ADMIN ? 28 : 18;
      const cellPadding = 18;
      const headerWidth = estimateTextWidth(headerText, FONT_SIZE) + headerPadding;
      const contentWidth = (sampleRows || []).reduce((max, row) => {
        const text = getAutoWidthText(col.field, row?.[col.field]);
        const width = col.field === 'type'
          ? estimateTypeCellWidth(row?.[col.field])
          : estimateTextWidth(text, FONT_SIZE) + cellPadding;
        return Math.max(max, width);
      }, 0);
      return { ...col, width: clampWidth(Math.ceil(Math.max(headerWidth, contentWidth)), bounds) };
    }), []);

    const applyAutoWidths = useCallback(() => {
      manuallyResizedRef.current.clear();
      updateColumns((prev) => autoFitColumns(prev, rows));
      ctx.message?.success?.(`${title}列宽已自动调整`);
    }, [autoFitColumns, rows, title, updateColumns]);

    const loadData = useCallback(async (nextPage, nextPageSize) => {
      const seq = ++requestSeqRef.current;
      const activePage = Number(nextPage) || 1;
      const activePageSize = Number(nextPageSize) || Number(pageSizeDefault) || 20;
      if (!params.asin || !params.country) {
        setRows([]);
        setTotal(0);
        return;
      }

      setLoading(true);
      try {
        const response = await requestDailySales(mode, params, activePage, activePageSize);
        if (seq !== requestSeqRef.current) return;
        const nextRows = pickRows(response);
        const reportedTotal = pickReportedTotal(response);
        const reportedTotalLooksReliable = reportedTotal != null && (
          nextRows.length < activePageSize || reportedTotal > activePage * activePageSize
        );
        if (reportedTotalLooksReliable) {
          setRows(nextRows);
          setTotal(reportedTotal);
          return;
        }

        const allRows = await requestAllDailySales(mode, params);
        if (seq !== requestSeqRef.current) return;
        const totalRows = allRows.length;
        const maxPage = Math.max(1, Math.ceil(totalRows / activePageSize));
        const safePage = Math.min(activePage, maxPage);
        if (safePage !== activePage) setPage(safePage);
        const start = (safePage - 1) * activePageSize;
        setRows(allRows.slice(start, start + activePageSize));
        setTotal(totalRows);
      } catch (error) {
        if (seq !== requestSeqRef.current) return;
        ctx.message?.error?.(`${title}加载失败: ${error?.message || ''}`);
        setRows([]);
        setTotal(0);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, [mode, pageSizeDefault, params.asin, params.country, params.shop, title]);

    useEffect(() => {
      setPage(1);
      loadData(1, pageSize);
    }, [loadData, pageSize, refreshKey]);

    useEffect(() => {
      manuallyResizedRef.current.clear();
      setColumnDefs(normalizeColumnDefs(columns));
    }, [columns, mode]);

    const typeColumnWidth = useMemo(() => {
      const headerPadding = IS_ADMIN ? 28 : 18;
      const headerWidth = estimateTextWidth(FIELD_TITLES.type, FONT_SIZE) + headerPadding;
      const contentWidth = rows.reduce(
        (max, row) => Math.max(max, estimateTypeCellWidth(row?.type)),
        0,
      );
      return clampWidth(Math.ceil(Math.max(headerWidth, contentWidth)), { min: 72, max: 220 });
    }, [rows]);

    useEffect(() => {
      if (!rows.length) return;
      updateColumns((prev) => prev.map((col) => (
        col.field === 'type' && !manuallyResizedRef.current.has(col.key)
          ? { ...col, width: typeColumnWidth }
          : col
      )));
    }, [rows, typeColumnWidth, updateColumns]);

    const onResizeStart = useCallback((event, key) => {
      event.preventDefault();
      event.stopPropagation();
      if (!IS_ADMIN) return;
      const col = columnDefs.find((item) => item.key === key);
      manuallyResizedRef.current.add(key);
      resizeRef.current = {
        key,
        startX: event.clientX,
        startWidth: Number(col?.width) || 100,
      };
      setIsResizing(true);
    }, [columnDefs]);

    const onResizeMove = useCallback((event) => {
      if (!resizeRef.current) return;
      const { key, startX, startWidth } = resizeRef.current;
      const nextWidth = Math.max(48, Math.round(startWidth + event.clientX - startX));
      updateColumns((prev) => prev.map((col) => (
        col.key === key ? { ...col, width: nextWidth } : col
      )));
    }, [updateColumns]);

    const onResizeEnd = useCallback(() => {
      if (resizeRef.current) {
        resizeRef.current = null;
      }
      setIsResizing(false);
    }, []);

    const visibleColumnDefs = useMemo(() => {
      const visible = columnDefs.filter((col) => col.hidden !== true);
      return visible.length ? visible : columnDefs;
    }, [columnDefs]);

    const dataBarMaxByField = useMemo(() => {
      const maxima = {};
      DATA_BAR_FIELDS.forEach((field) => {
        maxima[field] = rows.reduce((max, row) => {
          const value = Number(row?.[field]);
          return Number.isFinite(value) ? Math.max(max, Math.abs(value)) : max;
        }, 0);
      });
      return maxima;
    }, [rows]);

    const scrollX = useMemo(
      () => visibleColumnDefs.reduce((sum, col) => sum + (col.width || 100), 0),
      [visibleColumnDefs],
    );
    const rowKeyOf = useCallback((row, index) => (
      row.shop_country_asin_date || row.country_asin_date || row.id || `${mode}-${index}`
    ), [mode]);
    const paginationTotal = total || rows.length;

    return React.createElement('section', {
      style: {
        minWidth: 0,
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: 12,
      },
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 10,
          minHeight: 38,
          marginBottom: 6,
        },
      },
        React.createElement('div', { style: { fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' } }, title),
        headerExtra
          ? React.createElement('div', {
            style: {
              flex: 1,
              minWidth: 0,
            },
          }, headerExtra)
          : null,
        React.createElement('div', {
          style: {
            display: 'flex',
            gap: 5,
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
            padding: 3,
            border: '1px solid #e3eaf3',
            borderRadius: 8,
            background: '#f6f9fc',
          },
        },
          toolbar ? toolbar({ rows, reload: () => loadData(page, pageSize) }) : null,
          React.createElement(Button, {
            size: 'small',
            onClick: () => loadData(page, pageSize),
            disabled: loading,
            style: TOOLBAR_BUTTON_STYLE,
          }, '刷新'),
        ),
      ),
      React.createElement('div', {
        style: {
          position: 'relative',
          border: '1px solid #f0f0f0',
          borderRadius: 6,
          overflow: 'hidden',
          background: '#fff',
        },
      },
        React.createElement('div', {
          style: {
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: TABLE_SCROLL_MAX_HEIGHT,
            transform: 'translateZ(0)',
          },
        },
          React.createElement('table', {
            style: {
              width: scrollX,
              minWidth: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              tableLayout: 'fixed',
              background: '#fff',
            },
          },
            React.createElement('colgroup', null,
              visibleColumnDefs.map((col) => React.createElement('col', {
                key: col.key,
                style: { width: col.width || 100 },
              })),
            ),
            React.createElement('thead', null,
              React.createElement('tr', null,
                visibleColumnDefs.map((col) => React.createElement('th', {
                  key: col.key,
                  style: {
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    width: col.width || 100,
                    padding: TABLE_HEADER_PADDING,
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: col.important ? '2px solid #faad14' : '1px solid #e8e8e8',
                    background: getColumnHeaderColor(col),
                    color: getTextColorForBg(getColumnHeaderColor(col)),
                    fontWeight: 600,
                    fontSize: TABLE_FONT_SIZE,
                    textAlign: col.align || 'left',
                    whiteSpace: 'normal',
                    overflow: 'hidden',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    boxSizing: 'border-box',
                    cursor: isResizing ? 'col-resize' : 'default',
                    userSelect: 'none',
                  },
                  title: getColumnTooltip(col) || getColumnTitle(col),
                },
                  React.createElement('span', {
                    style: {
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      maxWidth: '100%',
                      minWidth: 0,
                    },
                  },
                    col.important
                      ? React.createElement('span', { style: { color: '#fa8c16', flexShrink: 0 } }, '!')
                      : null,
                    renderColumnTitle(col),
                  ),
                  IS_ADMIN
                    ? React.createElement('div', {
                      onMouseDown: (event) => onResizeStart(event, col.key),
                      onClick: (event) => event.stopPropagation(),
                      draggable: false,
                      style: {
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 8,
                        cursor: 'col-resize',
                        zIndex: 3,
                      },
                    })
                    : null,
                )),
              ),
            ),
            React.createElement('tbody', null,
              loading && !rows.length
                ? React.createElement('tr', null,
                  React.createElement('td', {
                    colSpan: visibleColumnDefs.length,
                    style: {
                      padding: 32,
                      textAlign: 'center',
                      color: '#999',
                      borderBottom: '1px solid #f0f0f0',
                    },
                  }, '正在加载数据...'),
                )
                : null,
              !loading && !rows.length
                ? React.createElement('tr', null,
                  React.createElement('td', {
                    colSpan: visibleColumnDefs.length,
                    style: {
                      padding: 32,
                      textAlign: 'center',
                      color: '#999',
                      borderBottom: '1px solid #f0f0f0',
                    },
                  }, '暂无数据'),
                )
                : null,
              rows.map((row, rowIndex) => React.createElement('tr', {
                key: rowKeyOf(row, rowIndex),
                style: { background: rowIndex % 2 === 0 ? '#fff' : '#fcfcfc' },
              },
                visibleColumnDefs.map((col) => React.createElement('td', {
                  key: col.key,
                  style: {
                    width: col.width || 100,
                    padding: DATA_BAR_FIELDS.includes(col.field) ? 0 : TABLE_CELL_PADDING,
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: '1px solid #f0f0f0',
                    background: col.important ? IMPORTANT_COLUMN_BG : undefined,
                    color: '#333',
                    fontWeight: col.important ? 600 : 400,
                    fontSize: TABLE_FONT_SIZE,
                    textAlign: col.align || 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: col.field === 'type' ? 'clip' : 'ellipsis',
                    boxSizing: 'border-box',
                  },
                  title: typeof row[col.field] === 'object' ? '' : String(row[col.field] ?? ''),
                }, DATA_BAR_FIELDS.includes(col.field)
                  ? renderDataBarValue(col.field, row[col.field], dataBarMaxByField[col.field])
                  : renderValue(col.field, row[col.field], dayTypeCategoryMap))),
              )),
            ),
          ),
        ),
        loading && rows.length
          ? React.createElement('div', {
            style: {
              position: 'absolute',
              right: 10,
              top: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(24,144,255,0.08)',
              color: '#1677ff',
              fontSize: 12,
            },
          }, '刷新中')
          : null,
      ),
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingTop: 4,
        },
      },
        React.createElement(Pagination, {
          current: page,
          pageSize,
          total: paginationTotal,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          showQuickJumper: true,
          size: 'small',
          showTotal: (count, range) => `第 ${range[0]}-${range[1]} 条，共 ${count} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
            loadData(nextPage, nextPageSize);
          },
        }),
      ),
      isResizing
        ? React.createElement('div', {
          onMouseMove: onResizeMove,
          onMouseUp: onResizeEnd,
          onMouseLeave: onResizeEnd,
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            cursor: 'col-resize',
            background: 'transparent',
          },
        })
        : null,
    );
  };

  const ShopSwitcher = ({ params, onChange, shops, loading, onRefresh }) => {
    const shopList = [TOTAL_SHOP_NAME, ...shops.filter((shop) => shop !== TOTAL_SHOP_NAME)];
    const currentShop = params.shop || TOTAL_SHOP_NAME;

    return React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        minWidth: 0,
        padding: '7px 8px',
        border: '1px solid #93c5fd',
        borderRadius: 8,
        background: '#eef6ff',
        boxShadow: '0 1px 4px rgba(37,99,235,0.12), inset 0 0 0 1px rgba(255,255,255,0.85)',
      },
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          flexShrink: 0,
        },
      },
        React.createElement('span', { style: { fontWeight: 800, fontSize: 14, color: '#0f172a', whiteSpace: 'nowrap' } }, '店铺切换'),
        React.createElement('span', {
          style: {
            padding: '1px 6px',
            borderRadius: 999,
            background: '#dbeafe',
            color: '#1d4ed8',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
          },
        }, `${shopList.length}个`),
      ),
      React.createElement('div', {
        style: {
          display: 'flex',
          gap: 6,
          flex: 1,
          minWidth: 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '4px 5px',
          background: '#dbeafe',
          border: '1px solid #bfdbfe',
          borderRadius: 7,
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        },
      },
        shopList.map((shop) => {
          const active = shop === currentShop;
          return React.createElement('button', {
            key: shop,
            type: 'button',
            onClick: () => onChange(shop),
            style: {
              flex: '0 0 auto',
              minWidth: 72,
              minHeight: 32,
              padding: '5px 16px',
              borderRadius: 6,
              border: active ? '1px solid #1677ff' : '1px solid #c7d8ee',
              background: active ? '#1677ff' : '#fff',
              color: active ? '#fff' : '#334155',
              fontWeight: active ? 700 : 500,
              fontSize: 14,
              lineHeight: '20px',
              cursor: 'pointer',
              boxShadow: active ? '0 3px 9px rgba(22,119,255,0.28)' : '0 1px 3px rgba(15,23,42,0.08)',
              whiteSpace: 'nowrap',
              transition: 'background 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease, color 0.16s ease',
            },
          }, shop);
        }),
        React.createElement(Tooltip, {
          title: '店铺列表来自当天库存基础表 inventory_base 中，当前 ASIN + 国家对应的非空店铺；合计由系统固定加入。',
          placement: 'top',
        },
          React.createElement('span', {
            role: 'img',
            'aria-label': '店铺生成规则',
            style: {
              flex: '0 0 auto',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 18,
              height: 18,
              margin: '7px 6px 0 2px',
              border: '1px solid #60a5fa',
              borderRadius: '50%',
              background: '#eff6ff',
              color: '#1d4ed8',
              fontSize: 12,
              fontWeight: 800,
              lineHeight: '18px',
              cursor: 'help',
              boxShadow: '0 1px 3px rgba(37,99,235,0.12)',
            },
          }, '?'),
        ),
      ),
      React.createElement(Button, {
        size: 'small',
        onClick: onRefresh,
        loading,
        style: {
          ...TOOLBAR_BUTTON_STYLE,
          flexShrink: 0,
          borderColor: '#bfdbfe',
          background: '#eff6ff',
          color: '#1d4ed8',
        },
      }, '全部刷新'),
    );
  };

  const CoefficientPanel = ({ rows, loading, dayTypeCategoryMap }) => React.createElement('section', {
    style: {
      background: '#fff',
      border: '1px solid #f0f0f0',
      borderRadius: 8,
      padding: 6,
      marginBottom: 6,
      minHeight: 72,
    },
  },
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: rows.length ? 4 : 0,
      },
    },
      React.createElement('div', null,
        React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, '销售系数'),
        React.createElement('div', { style: { color: '#999', fontSize: 12, marginTop: 2 } },
          rows.length ? '' : loading ? '正在读取 sales_coefficient' : '当前 ASIN / 国家暂无配置',
        ),
      ),
      loading && rows.length
        ? React.createElement('span', {
          style: {
            marginLeft: 'auto',
            flexShrink: 0,
            padding: '1px 6px',
            borderRadius: 4,
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: 12,
            lineHeight: '18px',
          },
        }, '刷新中')
        : null,
    ),
    !rows.length
      ? null
      : React.createElement('div', {
        style: {
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 2,
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        },
      },
        rows.map((row) => {
          const style = getDayTypeCategoryStyle(row.type, dayTypeCategoryMap);
          return React.createElement('div', {
            key: row.type,
            title: `${row.type}: ${formatNumber(row.coefficient)}`,
            style: {
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 128,
              maxWidth: 220,
              padding: '3px 8px',
              border: `1px solid ${style.border}`,
              borderRadius: 6,
              background: style.bg,
              color: style.text,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              whiteSpace: 'nowrap',
            },
          },
            React.createElement('span', {
              style: {
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: 12,
                fontWeight: 600,
              },
            }, row.type),
            React.createElement('strong', {
              style: {
                marginLeft: 'auto',
                fontSize: 17,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              },
            }, formatNumber(row.coefficient)),
          );
        }),
      ),
  );

  const WaterLevelTables = () => {
    const [params, setParams] = useState(readUrlParams());
    const [shops, setShops] = useState([]);
    const [shopLoading, setShopLoading] = useState(false);
    const [coefficientRows, setCoefficientRows] = useState([]);
    const [coefficientLoading, setCoefficientLoading] = useState(false);
    const [dayTypeCategoryMap, setDayTypeCategoryMap] = useState({});
    const [refreshKey, setRefreshKey] = useState(0);

    const reloadAll = useCallback(() => setRefreshKey((value) => value + 1), []);

    const updateParams = useCallback((nextParams, shouldNavigate = false) => {
      rememberStableUrlParams(nextParams);
      setParams(nextParams);
      if (shouldNavigate) replaceUrlParams(nextParams);
      setRefreshKey((value) => value + 1);
    }, []);

    useEffect(() => {
      const routers = [ctx.router, ctx.app?.router?.router].filter(Boolean);
      const unlisteners = routers
        .filter((router) => typeof router.subscribe === 'function')
        .map((router) => router.subscribe(() => {
          const restored = restoreMissingUrlParams();
          if (!restored) updateParams(readUrlParams(), false);
        }));
      restoreMissingUrlParams();
      return () => {
        unlisteners.forEach((unlisten) => {
          if (typeof unlisten === 'function') unlisten();
        });
      };
    }, [updateParams]);

    useEffect(() => {
      let alive = true;
      setShopLoading(true);
      requestShopList(params.asin, params.country)
        .then((list) => {
          if (alive) setShops(list);
        })
        .catch((error) => {
          if (alive) {
            setShops([]);
            ctx.message?.warning?.(`店铺列表加载失败: ${error?.message || ''}`);
          }
        })
        .finally(() => {
          if (alive) setShopLoading(false);
        });
      return () => { alive = false; };
    }, [params.asin, params.country]);

    useEffect(() => {
      let alive = true;
      if (!params.asin || !params.country) {
        setCoefficientRows([]);
        setCoefficientLoading(false);
        return () => { alive = false; };
      }

      setCoefficientLoading(true);
      requestSalesCoefficientList(params.asin, params.country)
        .then((list) => {
          if (alive) setCoefficientRows(list);
        })
        .catch((error) => {
          if (alive) {
            setCoefficientRows([]);
            ctx.message?.warning?.(`销售系数加载失败: ${error?.message || ''}`);
          }
        })
        .finally(() => {
          if (alive) setCoefficientLoading(false);
        });

      return () => { alive = false; };
    }, [params.asin, params.country, refreshKey]);

    useEffect(() => {
      let alive = true;
      requestDayTypeCategoryMap(params.country)
        .then((map) => {
          if (alive) setDayTypeCategoryMap(map);
        })
        .catch((error) => {
          if (alive) {
            setDayTypeCategoryMap({});
            ctx.message?.warning?.(`日类型分类加载失败: ${error?.message || ''}`);
          }
        });
      return () => { alive = false; };
    }, [params.country, refreshKey]);

    const currentShop = params.shop || TOTAL_SHOP_NAME;
    const missingRequired = !params.asin || !params.country;

    const futureToolbar = () => React.createElement(React.Fragment, null,
      React.createElement(Button, {
        size: 'small',
        style: TOOLBAR_BUTTON_STYLE,
        onClick: () => exportRows(params, 'logistics').catch((error) => {
          notifyTask('export-logistics', '导出失败 - 物流', error?.message || String(error), 8);
          ctx.message?.error?.(`导出失败: ${error?.message || error}`);
        }),
      }, '导出-物流'),
      React.createElement(Button, {
        size: 'small',
        style: TOOLBAR_BUTTON_STYLE,
        onClick: () => exportRows(params, 'sales').catch((error) => {
          notifyTask('export-sales', '导出失败 - 销售', error?.message || String(error), 8);
          ctx.message?.error?.(`导出失败: ${error?.message || error}`);
        }),
      }, '导出-销售'),
      currentShop === TOTAL_SHOP_NAME
        ? React.createElement(Button, {
          size: 'small',
          style: TOOLBAR_BUTTON_STYLE,
          onClick: () => chooseImportFile(() => refreshAndTriggerInventory(params, reloadAll)),
        }, '导入')
        : null,
      React.createElement(Button, {
        size: 'small',
        style: {
          ...TOOLBAR_BUTTON_STYLE,
          borderColor: '#bfdbfe',
          background: '#eff6ff',
          color: '#1d4ed8',
        },
        onClick: () => triggerInventoryWorkflow(params, reloadAll).catch((error) => {
          notifyTask('inventory-update', '预估库存更新失败', error?.message || String(error), 8);
          ctx.message?.error?.(`预估库存更新失败: ${error?.message || ''}`);
        }),
      }, '预估库存更新'),
      React.createElement(Button, {
        size: 'small',
        style: {
          ...TOOLBAR_BUTTON_STYLE,
          borderColor: '#bbf7d0',
          background: '#f0fdf4',
          color: '#15803d',
        },
        onClick: () => triggerTransitWorkflow(params, reloadAll).catch((error) => {
          notifyTask('transit-update', '更新在途失败', error?.message || String(error), 8);
          ctx.message?.error?.(`更新在途失败: ${error?.message || ''}`);
        }),
      }, '更新在途'),
    );

    return React.createElement('div', {
      style: {
        padding: 8,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: FONT_SIZE,
        background: '#fafafa',
      },
    },
      !missingRequired
        ? React.createElement(CoefficientPanel, {
          rows: coefficientRows,
          loading: coefficientLoading,
          dayTypeCategoryMap,
        })
        : null,
      missingRequired
        ? React.createElement('div', {
          style: {
            padding: 24,
            textAlign: 'center',
            color: '#999',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            background: '#fff',
          },
        }, 'URL 中缺少 asin 或 country 参数')
        : React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
            gap: 8,
            alignItems: 'start',
          },
        },
          React.createElement(SalesTable, {
            title: '未来销量模拟',
            mode: 'future',
            columns: FUTURE_COLUMNS,
            pageSizeDefault: 200,
            params: { ...params, shop: currentShop },
            refreshKey,
            dayTypeCategoryMap,
            toolbar: futureToolbar,
            headerExtra: React.createElement(ShopSwitcher, {
              params: { ...params, shop: currentShop },
              shops,
              loading: shopLoading,
              onChange: (shop) => updateParams({ ...params, shop }, true),
              onRefresh: reloadAll,
            }),
          }),
          React.createElement(SalesTable, {
            title: '过去销量',
            mode: 'past',
            columns: PAST_COLUMNS,
            pageSizeDefault: 200,
            params: { ...params, shop: currentShop },
            refreshKey,
            dayTypeCategoryMap,
          }),
        ),
    );
  };

  ctx.render(
    React.createElement(ConfigProvider, { locale: ANTD_ZH_CN_LOCALE },
      React.createElement(WaterLevelTables),
    ),
  );
}

run();
