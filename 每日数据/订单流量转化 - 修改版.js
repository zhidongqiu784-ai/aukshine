async function run() {

  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal, Form } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const DEFAULT_COLUMNS_KEY = `${BLOCK_UID}__default_columns`;
  const BLOCK_NAME       = '订单流量转化';
  const BLOCK_NAME_SETTING_KEY = `${BLOCK_UID}__block_name`;
  const IS_ADMIN         = currentUserLevel >= 2;

  const FONT_SIZE    = 15;
  const FONT_SIZE_SM = FONT_SIZE - 1;
  const FONT_SIZE_XS = FONT_SIZE - 2;

  const DATE_PICKER_LOCALE = {
    lang: {
      locale: 'zh_CN',
      placeholder: '请选择日期',
      rangePlaceholder: ['开始日期', '结束日期'],
      today: '今天', now: '此刻', backToToday: '返回今天',
      ok: '确定', clear: '清除', month: '月', year: '年',
      yearFormat: 'YYYY年', monthFormat: 'M月',
      monthBeforeYear: false,
      previousMonth: '上个月', nextMonth: '下个月',
      previousYear: '上一年', nextYear: '下一年',
      shortWeekDays: ['日','一','二','三','四','五','六'],
      shortMonths: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    },
    timePickerLocale: { placeholder: '请选择时间' },
  };

  const GLOBAL_KEY     = '__urlParams_global';
  const SK_MODEL       = '__up_model';
  const SK_COUNTRY     = '__up_country';
  const SK_ASIN        = '__up_asin';
  const SK_SALE_OWNER  = '__up_saleOwner';
  const readGlobal     = ()     => ctx.engine[GLOBAL_KEY] || null;
  const writeGlobal    = (data) => {
    ctx.engine[GLOBAL_KEY] = data ? {
      model: data.model || null,
      country: data.country || null,
      asin: data.asin || null,
      sale_owner: data.saleOwner || data.sale_owner || null,
    } : null;
  };

  function saveToEngine(key, val) {
    if (!val || val === '-') return;
    ctx.engine[key] = val;
  }

  function getFromEngine(key) {
    return ctx.engine[key] || null;
  }

  function saveAllParams(params) {
    saveToEngine(SK_MODEL,      params?.model);
    saveToEngine(SK_COUNTRY,    params?.country);
    saveToEngine(SK_ASIN,       params?.asin);
    saveToEngine(SK_SALE_OWNER, params?.saleOwner || params?.sale_owner);
  }

  function loadCachedParams() {
    const globalParams = readGlobal() || {};
    return {
      model:     getFromEngine(SK_MODEL)      || globalParams.model      || null,
      country:   getFromEngine(SK_COUNTRY)    || globalParams.country    || null,
      asin:      getFromEngine(SK_ASIN)       || globalParams.asin       || null,
      saleOwner: getFromEngine(SK_SALE_OWNER) || globalParams.saleOwner  || globalParams.sale_owner || null,
    };
  }

  function parseSearch(search) {
    const result = {};
    if (!search || search.length < 2) return result;
    const qs = search.charAt(0) === '?' ? search.slice(1) : search;
    qs.split('&').forEach(part => {
      const eqIdx = part.indexOf('=');
      if (eqIdx === -1) return;
      const key = decodeURIComponent(part.slice(0, eqIdx).replace(/\+/g, ' '));
      const val = decodeURIComponent(part.slice(eqIdx + 1).replace(/\+/g, ' '));
      if (key) result[key] = val;
    });
    return result;
  }

  function buildSearch(params) {
    const parts = [];
    if (params.model)     parts.push('model='      + encodeURIComponent(params.model));
    if (params.country)   parts.push('country='    + encodeURIComponent(params.country));
    if (params.asin)      parts.push('asin='       + encodeURIComponent(params.asin));
    if (params.saleOwner) parts.push('sale_owner=' + encodeURIComponent(params.saleOwner));
    return parts.length ? '?' + parts.join('&') : '';
  }

  function getRouterSearch() {
    const loc = ctx.router.state && ctx.router.state.location;
    return (loc && loc.search) || '';
  }

  function getRouterPathname() {
    const loc = ctx.router.state && ctx.router.state.location;
    return (loc && loc.pathname) || '';
  }

  function resolveParams(search) {
    const p = parseSearch(search);
    const cached = loadCachedParams();

    const model     = p['model']      || cached.model     || null;
    const country   = p['country']    || cached.country   || null;
    const asin      = p['asin']       || cached.asin      || null;
    const saleOwner = p['sale_owner'] || cached.saleOwner || null;

    return { model, country, asin, saleOwner };
  }

  function hasUrlParams(params) {
    return !!(params?.model || params?.country || params?.asin || params?.saleOwner || params?.sale_owner);
  }

  function needPatchSearch(parsed, params) {
    return (
      (!parsed['model']      && params.model)     ||
      (!parsed['country']    && params.country)   ||
      (!parsed['asin']       && params.asin)      ||
      (!parsed['sale_owner'] && params.saleOwner)
    );
  }

  function loadUrlParams() {
    const params = resolveParams(getRouterSearch());
    if (hasUrlParams(params)) {
      saveAllParams(params);
      writeGlobal(params);
      return params;
    }
    return null;
  }

  const COUNTRY_COLORS = {
    US:'#b5796a', CA:'#a0776e', JP:'#c4956a', DE:'#b08a6e',
    FR:'#c4a882', ES:'#7a9e9f', UK:'#7d9b76', IT:'#7b9bb5',
    MX:'#6e8fa3', SE:'#9b8ab4',
  };

  const COLOR_GREEN  = '#8FA382';
  const COLOR_YELLOW = '#D4A76A';
  const COLOR_BLUE   = '#7FA1C3';
  const COLOR_PURPLE = '#A888B5';
  const COLOR_ORANGE = '#C68B5E';
  const COLOR_TEAL   = '#82A0A8';
  const COLOR_GRAY   = '#A0A8B0';
  const COLOR_ROSE   = '#C48B8B';

  const LEGACY_COLOR_MAP = {
    '#f2c150': COLOR_YELLOW,
    '#53c7ea': COLOR_BLUE,
    '#9b59b6': COLOR_PURPLE,
    '#e67e22': COLOR_ORANGE,
  };

  const PRESET_COLORS = [
    { label:'默认自动抓取，也可手动复核',      value:'#9DF29F' },
    { label:'必填',      value:'#EB6793' },
    { label:'选填',      value:'#F2BABA' },
    { label:'重要指标',  value:'#C5DFB4' },
    { label:'日公式1',   value:'#5DBEAC' },
    { label:'日公式2',   value:'#B0D4CC' },
    { label:'日公式3',   value:'#1C5C50' },
    { label:'周公式1',   value:'#00205C' },
    { label:'周公式2',   value:'#035E9B' },
    { label:'周公式3',   value:'#044D72' },
  ];

  const PRESET_COLOR_VALUES = new Set(
    PRESET_COLORS.map((pc) => String(pc.value).toLowerCase())
  );

  const ACTIVE_CROSS_HIGHLIGHT_COLORS = [
    { label:'暖黄', value:'#FFF1B8' },
    { label:'米橙', value:'#FFE7BA' },
    { label:'浅粉', value:'#FFD6E7' },
    { label:'浅蓝', value:'#D6E4FF' },
    { label:'薄荷', value:'#B5F5EC' },
    { label:'亮黄', value:'#FFE58F' },
    { label:'浅橙', value:'#FFD8BF' },
    { label:'玫粉', value:'#FFADD2' },
    { label:'天蓝', value:'#91CAFF' },
    { label:'青绿', value:'#87E8DE' },
  ];
  const DEFAULT_ACTIVE_CROSS_HIGHLIGHT_COLOR = '#D6E4FF';

  const SRC_DEFAULT_COLOR = {
    daily: COLOR_GREEN,
    weekly: COLOR_ORANGE,
    order_link: COLOR_ROSE,
    keyword_position: '#b5796a',
    competitor: '#7FA1C3',
    tool: '#fa8c16',
  };

  const getColHeaderColor = (col) => col.headerColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;

  const withCreateTimestamps = (payload) => {
    const now = new Date().toISOString();
    return {
      ...payload,
      created_at: payload?.created_at || now,
      updated_at: payload?.updated_at || now,
    };
  };

  const PAGE_SIZE_OPTIONS = ['10','20','50','100'];
  const DEFAULT_PAGE_SIZE = 20;

  // 字段集合
  const MONEY_FIELDS = new Set([
    'daily_price','list_price','price_after_discount',
    'guanggaohuafei','ad_direct_sales_amount','ad_sales_amount',
    'ads_sp_cost','ads_sp_sales','ads_sd_cost','ads_sd_sales',
    'shared_ads_sb_cost','shared_ads_sb_sales','shared_ads_sbv_cost','shared_ads_sbv_sales',
    'ideal_cpu_by_margin','target_cpa','cpu','cpc','cpo','cpa',
    'review_discounted_price','review_actual_price','net_price_without_tax',
  ]);
  const RATE_FIELDS  = new Set([
    'off','real_session_conversion_rate',
    'zongcvr','guanggaocvr','volume_cvr','acos','tacos',
    'weekly_target_completion_rate','target_ad_cvr','target_profit_margin','target_ad_spend_rate',
    'natural_traffic_proportion','return_rate','return_goods_rate',
    'ctr','adv_rate','natural_single_ratio',
        'review_orders_ratio','offsite_orders_ratio','onsite_orders_ratio',
        'onsite_organic_orders_ratio','onsite_ad_orders_ratio',
        'order_link_real_session_conversion_rate','page_view_conversion_rate','formula_review_rate',
        'sp_orders_ratio','sd_orders_ratio','sb_orders_ratio','sbv_orders_ratio',
  ]);
  const NUM_FIELDS   = new Set([
    'star_rating','number_of_comments','promotion_days','lp_duration_days','rsg_number','target_gap',
    'sales','zirandan','guanggaodan','order_items','ranking',
    'ad_direct_order_quantity','indirect_order_volume','impressions','page_views_total','organic_traffic',
    'return_count','return_goods_count',
    'target_subcategory_rank','target_order_qty','goal_subcategory_rank',
    'prev_rank','reviews_count','promotion_volume','b2b_volume',
    'sessions','sessions_mobile','zongliuliang','guanggaodianji','zirandianji',
    'actual_review_qty',
    'offsite_bg_orders','offsite_xx_orders','offsite_acc_orders',
    'total_offsite_orders','total_onsite_orders','onsite_organic_orders','onsite_ad_orders',
  ]);
  const ZERO_AS_EMPTY_FIELDS = new Set([]);

  const isBlankLike = (v) => {
      return v === null || v === undefined || v === '';
  };

  const isFormulaBlank = (field, v) => {
    return isBlankLike(v);
  };

  const toFormulaNumber = (v) => {
    if (isBlankLike(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const buildDailyOffValue = (row) => {
    const listPrice = toFormulaNumber(row?.list_price);
    const dailyPrice = toFormulaNumber(row?.daily_price);
    if (listPrice == null || dailyPrice == null || listPrice === 0) return null;
    return (listPrice - dailyPrice) / listPrice;
  };
  const dateDiffDays = (endDate, startDate) => {
    const endKey = toDateKey(endDate);
    const startKey = toDateKey(startDate);
    if (!endKey || !startKey) return null;
    const end = new Date(`${endKey}T00:00:00Z`);
    const start = new Date(`${startKey}T00:00:00Z`);
    if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return null;
    return Math.floor((end.getTime() - start.getTime()) / 86400000);
  };
  const buildLpDurationMap = (dailyRecords) => {
    const groups = {};
    (Array.isArray(dailyRecords) ? dailyRecords : []).forEach((row) => {
      const asinCountry = row?.asin_country || toAsinCountryKey(row?.asin, row?.country);
      const dateKey = toDateKey(row?.date);
      if (!asinCountry || !dateKey) return;
      if (!groups[asinCountry]) groups[asinCountry] = [];
      groups[asinCountry].push(row);
    });

    const result = {};
    Object.values(groups).forEach((rows) => {
      const sortedRows = [...rows].sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)));
      const minDate = toDateKey(sortedRows[0]?.date);
      sortedRows.forEach((row, index) => {
        const key = row?.country_asin_date;
        const rowDate = toDateKey(row?.date);
        const rowListPrice = toFormulaNumber(row?.list_price);
        if (!key || !rowDate || rowListPrice == null) {
          if (key) result[key] = null;
          return;
        }

        let previousDifferentDate = '';
        for (let i = index - 1; i >= 0; i -= 1) {
          const prev = sortedRows[i];
          const prevDate = toDateKey(prev?.date);
          if (!prevDate || prevDate >= rowDate) continue;
          const prevListPrice = toFormulaNumber(prev?.list_price);
          if (prevListPrice == null || prevListPrice !== rowListPrice) {
            previousDifferentDate = prevDate;
            break;
          }
        }

        const durationDays = previousDifferentDate
          ? dateDiffDays(rowDate, previousDifferentDate)
          : dateDiffDays(rowDate, minDate);
        result[key] = durationDays == null ? null : durationDays + (previousDifferentDate ? 0 : 1);
      });
    });
    return result;
  };

  const toPriceKey = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '';
  };
  const toAsinCountryKey = (asin, country) => {
    if (!asin || !country) return '';
    return `${asin}_${country}`;
  };
  const AMAZON_DOMAIN_BY_COUNTRY = {
    US: 'www.amazon.com',
    CA: 'www.amazon.ca',
    JP: 'www.amazon.co.jp',
    DE: 'www.amazon.de',
    FR: 'www.amazon.fr',
    ES: 'www.amazon.es',
    UK: 'www.amazon.co.uk',
    GB: 'www.amazon.co.uk',
    IT: 'www.amazon.it',
    MX: 'www.amazon.com.mx',
    SE: 'www.amazon.se',
  };
  const parseCountryFromCountryAsin = (countryAsin) => {
    const parts = String(countryAsin || '').split('_');
    return parts.length > 1 ? parts[0] : '';
  };
  const buildAmazonAsinUrl = (country, asin) => {
    const countryKey = String(country || '').trim().toUpperCase();
    const asinKey = String(asin || '').trim();
    const domain = AMAZON_DOMAIN_BY_COUNTRY[countryKey];
    return domain && asinKey ? `https://${domain}/dp/${encodeURIComponent(asinKey)}` : '';
  };
  const toScenarioTypeKey = (v) => String(v ?? '').trim().toLowerCase();
  const toPricingScenarioLookupKey = (asinCountry, price, scenarioType) => {
    const priceKey = toPriceKey(price);
    const scenarioKey = toScenarioTypeKey(scenarioType);
    if (!asinCountry || !priceKey || !scenarioKey) return '';
    return `${asinCountry}_${priceKey}_${scenarioKey}`;
  };
  const getPricingScenarioNetPrice = (pricingScenarioMap, asinCountry, price, scenarioType) => {
    const key = toPricingScenarioLookupKey(asinCountry, price, scenarioType);
    return key ? pricingScenarioMap[key]?.net_price ?? null : null;
  };
  const toDateKey = (v) => v ? String(v).slice(0, 10) : '';
  const addDays = (dateStr, days) => {
    const baseDate = toDateKey(dateStr);
    if (!baseDate) return '';
    const match = baseDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return '';
    const d = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
    if (Number.isNaN(d.getTime())) return '';
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  };
  const toDailyReviewLookupKey = (country, asin, date) => {
    const dateStr = toDateKey(date);
    if (!country || !asin || !dateStr) return '';
    return `${country}_${asin}_${dateStr}`;
  };

  const ORDER_LINK_FORMULA_TRIGGER_FIELDS = new Set([
    'order_items',
    'number_of_comments',
    'rsg_number',
    'guanggaodan',
    'zongliuliang',
    'page_views_total',
    'target_order_qty',
    'price_after_discount',
    'review_discounted_price',
  ]);
  const DAILY_FORMULA_TRIGGER_FIELDS = new Set([
    'daily_price',
    'list_price',
  ]);

  const RICH_TEXT_FIELDS = new Set([
    'review_screenshot',
    'bad_review_notes',
    'keyword_trend_screenshot',
    'ad_framework_screenshot',
    'keyword_performance_screenshot',
    'page_screenshot',
    'link_problem',
    'operation_record',
    'today_todo_plan',
    'ad_optimization_logs',
    'review_notes',
  ]);

  const getCompetitorRoleIndex = (role) => {
    const match = String(role || '').match(/竞对(\d+)/);
    return match ? Number(match[1]) : 9999;
  };
  const getCompetitorColor = (role) => {
    const palette = ['#7FA1C3', '#A888B5'];
    const idx = getCompetitorRoleIndex(role);
    return palette[(Number.isFinite(idx) && idx > 0 ? idx - 1 : 0) % palette.length];
  };

  const COMPETITOR_SUB_FIELDS = [
    { key: 'rank', label: '排名', width: 110, headerColor: '#EB6793' },
    { key: 'notes', label: '操作分析', width: 220, headerColor: '#F2BABA' },
  ];

  const DATE_FIELDS  = new Set(['date','updatedAt']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  // 只读字段
  const READONLY_FIELDS = new Set([
    'country_asin_date','country_asin_week','id','country','asin','date','updatedAt',
    'page_screenshot',
    'off',
    'lp_duration_days',
    'net_price_without_tax',
    'review_actual_price',

    // 公式字段
    'total_onsite_orders',
    'onsite_organic_orders',
    'onsite_ad_orders',
    'review_orders_ratio',
    'formula_review_rate',
    'onsite_orders_ratio',
    'onsite_organic_orders_ratio',
    'onsite_ad_orders_ratio',
    'page_view_conversion_rate',
    'real_session_conversion_rate',
    'target_gap',
  ]);

  const COLLECTION_LABELS = {
    daily_asins: '每日asin主表',
    weekly_performance: '产品表现',
    daily_order_link_tracking: '订单结构与链接追踪合并表',
    target_management: '目标管理',
    pricing_scenarios: '定价与测评试算表',
    sqp_keywords: 'SQP关键词',
    sqp_keyword_daily_positions: 'SQP关键词每日自然位',
    order_link_competitor_asins: '订单流量竞对ASIN',
    order_link_competitor_asins_daily: '订单流量竞对ASIN日数据',
  };

  const FIELD_LABELS = {
    'daily_asins.country': '国家',
    'daily_asins.asin': 'ASIN',
    'daily_asins.date': '站点时间',
    'daily_asins.sale_owner': '销售',
    'daily_asins.model': '型号',
    'daily_asins.activity_annotation': '活动标注',
    'daily_asins.daily_price': '购物车价格',
    'daily_asins.list_price': 'LP/WP/TP',
    'daily_asins.price_after_discount': '折后价',
    'daily_asins.off': 'Off力度',
    'daily_asins.star_rating': '星级',
    'daily_asins.number_of_comments': 'review数量',
    'daily_asins.selling_accounts': '售卖账号',
    'daily_asins.promotion_days': '推广天数',
    'daily_asins.lp_duration_days': 'LP持续天数',
    'daily_asins.rsg_number': '①测评单',
    'daily_asins.today_operation': '今日操作记录',
    'weekly_performance.sales': '销量',
    'weekly_performance.zirandan': '自然订单量',
    'weekly_performance.guanggaodan': '广告订单量',
    'weekly_performance.order_items': '总订单量',
    'weekly_performance.cpu': 'CPU',
    'weekly_performance.ranking': '小类排名',
    'weekly_performance.zongcvr': '总CVR',
    'weekly_performance.zongliuliang': '总流量',
    'weekly_performance.page_views_total': '页面浏览量',
    'weekly_performance.page_views': 'PV-Browser',
    'daily_order_link_tracking.total_onsite_orders': '②站内:纯自然+广告单',
    'daily_order_link_tracking.onsite_organic_orders': '③站内纯自然单',
    'daily_order_link_tracking.onsite_ad_orders': '④站内总广告单',
    'daily_order_link_tracking.review_orders_ratio': '①测评单占比',
    'daily_order_link_tracking.formula_review_rate': '公式算-留评率',
    'daily_order_link_tracking.onsite_orders_ratio': '②站内占比',
    'daily_order_link_tracking.onsite_organic_orders_ratio': '③站内纯自然单占比',
    'daily_order_link_tracking.onsite_ad_orders_ratio': '④站内总广告单占比',
    'daily_order_link_tracking.real_session_conversion_rate': '真实会话转化率（剔除测评单）',
    'daily_order_link_tracking.page_view_conversion_rate': '页面浏览转化率',
    'daily_order_link_tracking.target_gap': '目标差距',
    'daily_order_link_tracking.net_price_without_tax': '成交额-去掉税费',
    'daily_order_link_tracking.review_discounted_price': '测评折后价',
    'daily_order_link_tracking.review_actual_price': '测评成交价',
    'daily_order_link_tracking.today_todo_plan': '今日待办-预计计划（仅新品推广前30天）',
    'target_management.target_order_qty': '目标拆解-单量',
    'pricing_scenarios.price_with_tax': '预计折后价（含税，当地币）',
    'pricing_scenarios.net_price': '成交售价（不含税）',
    'sqp_keywords.keyword_name': '关键词',
    'sqp_keyword_daily_positions.actual_rank': '自然位',
    'order_link_competitor_asins.competitor_asin': '竞对ASIN',
    'order_link_competitor_asins.notes': '备注',
    'order_link_competitor_asins_daily.rank': '排名',
    'order_link_competitor_asins_daily.notes': '操作分析/截图',
  };

  const FIELD_REF_COLLECTIONS = Object.keys(COLLECTION_LABELS).join('|');
  const FIELD_REF_PATTERN = new RegExp(`\\b(${FIELD_REF_COLLECTIONS})\\.([A-Za-z_][A-Za-z0-9_]*)\\b`, 'g');
  const fieldRef = (collection, field, fallbackLabel) => {
    const collectionLabel = COLLECTION_LABELS[collection] || collection;
    const fieldLabel = FIELD_LABELS[`${collection}.${field}`] || fallbackLabel || field;
    return `${collectionLabel}（${collection}）表的 ${fieldLabel}（${field}）字段`;
  };
  const localizeFieldRefs = (text) => String(text || '').replace(
    FIELD_REF_PATTERN,
    (_match, collection, field) => fieldRef(collection, field)
  );
  const conciseFieldRef = (collection, field) => {
    const collectionLabel = COLLECTION_LABELS[collection] || collection;
    const fieldLabel = FIELD_LABELS[`${collection}.${field}`] || field;
    return `${collectionLabel}.${fieldLabel}`;
  };
  const localizeFormulaRefs = (text) => String(text || '').replace(
    FIELD_REF_PATTERN,
    (_match, collection, field) => conciseFieldRef(collection, field)
  );
  const hasFieldRef = (text) => {
    FIELD_REF_PATTERN.lastIndex = 0;
    return FIELD_REF_PATTERN.test(String(text || ''));
  };
  const formatFormulaDescription = (text) => {
    const lines = String(text || '').split('\n');
    return lines.map((line) => {
      if (!hasFieldRef(line)) return line;
      const trimmed = line.trim();
      if (trimmed.includes('=')) {
        return `${line}\n  中文公式：${localizeFormulaRefs(trimmed)}`;
      }
      return localizeFieldRefs(line);
    }).join('\n');
  };

  const FORMULA_DESCRIPTIONS = {
    total_onsite_orders:
  `【②站内:纯自然+广告单 - 公式】
  计算逻辑：
  ②站内:纯自然+广告单 = weekly_performance.order_items - daily_asins.rsg_number

  字段说明：
  • weekly_performance.order_items：实际总单量
  • daily_asins.rsg_number：测评单

  空值规则：
  • 实际总单量为空，结果为空
  • 测评单为空，结果为空`,

      onsite_organic_orders:
  `【③站内纯自然单 - 公式】
  计算逻辑：
  ③站内纯自然单 = daily_order_link_tracking.total_onsite_orders - weekly_performance.guanggaodan

  字段说明：
  • daily_order_link_tracking.total_onsite_orders：②站内:纯自然+广告单
  • weekly_performance.guanggaodan：广告总单量

  空值规则：
  • ②站内:纯自然+广告单为空，结果为空
  • 广告总单量为空，结果为空`,

      onsite_ad_orders:
  `【④站内总广告单 - 公式】
  计算逻辑：
  ④站内总广告单 = weekly_performance.guanggaodan

  字段说明：
  • weekly_performance.guanggaodan：广告总单量

  空值规则：
  • 广告总单量为空，结果为空`,

      review_orders_ratio:
  `【①测评单占比 - 公式】
  计算逻辑：
  ①测评单占比 = daily_asins.rsg_number / weekly_performance.order_items

  字段说明：
  • daily_asins.rsg_number：测评单
  • weekly_performance.order_items：实际总单量

  空值规则：
  • 测评单为空，结果为空
  • 实际总单量为空或为 0，结果为空`,

      onsite_orders_ratio:
  `【②站内:纯自然+广告单占比 - 公式】
  计算逻辑：
  ②站内:纯自然+广告单占比 = ②站内:纯自然+广告单 / weekly_performance.order_items

  字段说明：
  • daily_order_link_tracking.total_onsite_orders：②站内:纯自然+广告单
  • weekly_performance.order_items：实际总单量

  空值规则：
  • ②站内:纯自然+广告单为空，结果为空
  • 实际总单量为空或为 0，结果为空`,

      onsite_organic_orders_ratio:
  `【③站内纯自然单占比 - 公式】
  计算逻辑：
  ③站内纯自然单占比 = ③站内纯自然单 / weekly_performance.order_items

  等价写法：
  onsite_organic_orders_ratio = onsite_organic_orders / order_items

  字段说明：
  • onsite_organic_orders：③站内纯自然单
  • weekly_performance.order_items：实际总单量

  空值规则：
  • ③站内纯自然单为空，结果为空
  • 实际总单量为空，结果为空
  • 实际总单量为 0，结果为空`,

      onsite_ad_orders_ratio:
  `【④站内总广告单占比 - 公式】
  计算逻辑：
  ④站内总广告单占比 = ④站内总广告单 / weekly_performance.order_items

  字段说明：
  • onsite_ad_orders：④站内总广告单
  • weekly_performance.order_items：实际总单量

  空值规则：
  • ④站内总广告单为空，结果为空
  • 实际总单量为空或为 0，结果为空`,

      order_link_real_session_conversion_rate:
  `【真实会话转化率（剔除测评单）- 公式】
  计算逻辑：
  真实会话转化率（剔除测评单） = ROUND((weekly_performance.order_items - daily_asins.rsg_number) / weekly_performance.zongliuliang, 4)

  字段说明：
  • weekly_performance.order_items：实际总单量
  • daily_asins.rsg_number：测评单
  • weekly_performance.zongliuliang：汇总流量-会话量

  写回字段：
  • daily_order_link_tracking.real_session_conversion_rate

  空值规则：
  • 实际总单量为空，结果为空
  • 测评单为空，结果为空
  • 汇总流量-会话量为空或为 0，结果为空`,

      target_gap:
  `【目标差距 - 公式】
  计算逻辑：
  目标差距 = weekly_performance.order_items - target_management.target_order_qty

  字段说明：
  • weekly_performance.order_items：实际总单量
  • target_management.target_order_qty：目标单量

  写回字段：
  • daily_order_link_tracking.target_gap

  空值规则：
  • 实际总单量为空，结果为空
  • 目标单量为空，结果为空`,

      page_view_conversion_rate:
  `【页面浏览转化率 - 公式】
  计算逻辑：
  页面浏览转化率 = weekly_performance.order_items / weekly_performance.page_views_total

  字段说明：
  • weekly_performance.order_items：实际总单量
  • weekly_performance.page_views_total：页面浏览量

  空值规则：
  • 实际总单量为空，结果为空
  • 页面浏览量为空或为 0，结果为空`,

      formula_review_rate:
  `【公式算-留评率 - 公式】
  计算逻辑：
  公式算-留评率 = (当前记录日期的 daily_asins.number_of_comments - 当前记录日期前一天的 daily_asins.number_of_comments) / weekly_performance.order_items

  字段说明：
  • daily_asins.number_of_comments：当前记录日期的 review 数量
  • daily_asins.number_of_comments（当前记录日期前一天）：同国家、同 ASIN，按当前行 date 往前 1 天的 review 数量
  • weekly_performance.order_items：实际总单量

  写回字段：
  • daily_order_link_tracking.formula_review_rate

  空值规则：
  • 当前记录日期的 review 数量为空，结果为空
  • 当前记录日期前一天的 review 数量为空，结果为空
  • 实际总单量为空或为 0，结果为空`,
  };

  const COLUMN_DESCRIPTIONS = {};
COLUMN_DESCRIPTIONS.net_price_without_tax = `【成交额-去掉税费 - 字段说明】
字段来源：pricing_scenarios.net_price

说明：
根据当前行国家、ASIN、daily_asins.price_after_discount 匹配 pricing_scenarios 中 scenario_type = normal 且 price_with_tax 相同的记录，并写入 daily_order_link_tracking.net_price_without_tax。`;

COLUMN_DESCRIPTIONS.review_actual_price = `【测评成交价 - 字段说明】
字段来源：pricing_scenarios.net_price

说明：
根据当前行国家、ASIN、daily_order_link_tracking.review_discounted_price 匹配 pricing_scenarios 中 scenario_type = review 且 price_with_tax 相同的记录，并写入 daily_order_link_tracking.review_actual_price。`;

  const FORMULA_TOOLTIPS = {
    total_onsite_orders: {
      title: '②站内:纯自然+广告单',
      formula: '实际总单量 − 测评单',
      emptyRules: ['实际总单量为空', '测评单为空'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
        { label: '测评单', field: 'daily_asins.rsg_number' },
      ],
      writeBackField: 'daily_order_link_tracking.total_onsite_orders',
    },
    onsite_organic_orders: {
      title: '③站内纯自然单',
      formula: '②站内:纯自然+广告单 − 广告总单量',
      emptyRules: ['②站内:纯自然+广告单为空', '广告总单量为空'],
      fields: [
        { label: '②站内:纯自然+广告单', field: 'daily_order_link_tracking.total_onsite_orders' },
        { label: '广告总单量', field: 'weekly_performance.guanggaodan' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_organic_orders',
    },
    onsite_ad_orders: {
      title: '④站内总广告单',
      formula: '直接取广告总单量',
      emptyRules: ['广告总单量为空'],
      fields: [
        { label: '广告总单量', field: 'weekly_performance.guanggaodan' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_ad_orders',
    },
    review_orders_ratio: {
      title: '①测评单占比',
      formula: '测评单 ÷ 实际总单量',
      emptyRules: ['测评单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '测评单', field: 'daily_asins.rsg_number' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.review_orders_ratio',
    },
    formula_review_rate: {
      title: '留评率（公式算）',
      formula: '(当前记录日期 Review 数 − 当前记录日期前一天 Review 数) ÷ 实际总单量',
      emptyRules: ['当前记录日期或前一天的 Review 数据缺失', '实际总单量为空或为 0'],
      fields: [
        { label: '当前记录日期 Review 数', field: 'daily_asins.number_of_comments' },
        { label: '当前记录日期前一天 Review 数', field: 'daily_asins.number_of_comments（当前记录日期前一天）' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.formula_review_rate',
    },
    onsite_orders_ratio: {
      title: '②站内:纯自然+广告单占比',
      formula: '②站内:纯自然+广告单 ÷ 实际总单量',
      emptyRules: ['②站内:纯自然+广告单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '②站内:纯自然+广告单', field: 'daily_order_link_tracking.total_onsite_orders' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_orders_ratio',
    },
    onsite_organic_orders_ratio: {
      title: '③站内纯自然单占比',
      formula: '③站内纯自然单 ÷ 实际总单量',
      emptyRules: ['③站内纯自然单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '③站内纯自然单', field: 'daily_order_link_tracking.onsite_organic_orders' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_organic_orders_ratio',
    },
    onsite_ad_orders_ratio: {
      title: '④站内总广告单占比',
      formula: '④站内总广告单 ÷ 实际总单量',
      emptyRules: ['④站内总广告单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '④站内总广告单', field: 'daily_order_link_tracking.onsite_ad_orders' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_ad_orders_ratio',
    },
    order_link_real_session_conversion_rate: {
      title: '真实会话转化率（剔除测评单）',
      formula: '(实际总单量 − 测评单) ÷ 汇总流量-会话量，并保留 4 位小数',
      emptyRules: ['实际总单量为空', '测评单为空', '汇总流量-会话量为空或为 0'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
        { label: '测评单', field: 'daily_asins.rsg_number' },
        { label: '汇总流量-会话量', field: 'weekly_performance.zongliuliang' },
      ],
      writeBackField: 'daily_order_link_tracking.real_session_conversion_rate',
    },
    target_gap: {
      title: '目标差距',
      formula: '实际总单量 − 目标单量',
      emptyRules: ['实际总单量为空', '目标单量为空'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
        { label: '目标单量', field: 'target_management.target_order_qty' },
      ],
      writeBackField: 'daily_order_link_tracking.target_gap',
    },
    page_view_conversion_rate: {
      title: '页面浏览转化率',
      formula: '实际总单量 ÷ 页面浏览量',
      emptyRules: ['实际总单量为空', '页面浏览量为空或为 0'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
        { label: '页面浏览量', field: 'weekly_performance.page_views_total' },
      ],
      writeBackField: 'daily_order_link_tracking.page_view_conversion_rate',
    },
  };

  const COLUMN_TOOLTIPS = {
    country: {
      title: '国家',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「每日asin主表-生成未来 3 个月的数据的asin数据」按 asin 表生成未来 3 个月每日基础记录，并写入 daily_asins.country',
      fields: [
        { label: '来源国家', field: 'asin.country' },
        { label: '有效 ASIN 状态', field: "asin.status IN ('新品', '重点', '普通')" },
        { label: '生成日期范围', field: 'CURDATE() 至 CURDATE() + INTERVAL 3 MONTH' },
      ],
      writeBackField: 'daily_asins.country',
    },
    asin: {
      title: 'ASIN',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「每日asin主表-生成未来 3 个月的数据的asin数据」按 asin 表生成未来 3 个月每日基础记录，并写入 daily_asins.asin',
      fields: [
        { label: '来源 ASIN', field: 'asin.asin' },
        { label: '有效 ASIN 状态', field: "asin.status IN ('新品', '重点', '普通')" },
        { label: '主键拼接', field: "CONCAT(asin.country, '_', asin.asin, '_', date)" },
      ],
      writeBackField: 'daily_asins.asin',
    },
    date: {
      title: '站点时间',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「每日asin主表-生成未来 3 个月的数据的asin数据」通过递归日期表生成从今天起未来 3 个月的 daily_asins.date',
      fields: [
        { label: '日期起点', field: 'CURDATE()' },
        { label: '日期终点', field: 'CURDATE() + INTERVAL 3 MONTH' },
        { label: '主键字段', field: 'daily_asins.country_asin_date' },
      ],
      writeBackField: 'daily_asins.date',
    },
    model: {
      title: '型号',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「每日asin主表-生成未来 3 个月的数据的asin数据」从 asin.model 同步到 daily_asins.model',
      fields: [
        { label: '来源型号', field: 'asin.model' },
        { label: '有效 ASIN 状态', field: "asin.status IN ('新品', '重点', '普通')" },
      ],
      writeBackField: 'daily_asins.model',
    },
    sale_owner: {
      title: '销售',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「每日asin主表-生成未来 3 个月的数据的asin数据」从 asin.sale_owner 同步到 daily_asins.sale_owner',
      fields: [
        { label: '来源销售', field: 'asin.sale_owner' },
        { label: '关联型号销售键', field: "CONCAT(asin.model, '_', asin.sale_owner)" },
      ],
      writeBackField: 'daily_asins.sale_owner',
    },
    activity_annotation: {
      title: '活动标注',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「3更新 活动标注」匹配 deal_date，若当前日期落在 BD/LD 活动时间内，则写入促销类型',
      fields: [
        { label: '匹配 ASIN', field: 'deal_date.asin = daily_asins.asin' },
        { label: '匹配国家', field: 'deal_date.country = daily_asins.country' },
        { label: '活动类型', field: "deal_date.promotion_type IN ('BD', 'LD')" },
        { label: '活动状态', field: "deal_date.origin_status IN ('已结束', '进行中')" },
        { label: '活动日期范围', field: 'daily_asins.date BETWEEN DATE(deal_date.promotion_start_time) AND DATE(deal_date.promotion_end_time)' },
      ],
      writeBackField: 'daily_asins.activity_annotation',
    },
    daily_price: {
      title: '购物车价格',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号」从 asin.daily_price 同步到昨日的非 US/CA daily_asins 记录',
      fields: [
        { label: '来源购物车价格', field: 'asin.daily_price' },
        { label: '匹配键', field: 'asin.unique = daily_asins.asin_country' },
        { label: '更新日期', field: 'daily_asins.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)' },
        { label: '站点范围', field: "RIGHT(daily_asins.asin_country, 2) NOT IN ('US', 'CA')" },
      ],
      writeBackField: 'daily_asins.daily_price',
    },
    list_price: {
      title: 'LP/WP/TP',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号」从 asin.list_price 同步到昨日的非 US/CA daily_asins 记录',
      fields: [
        { label: '来源划线价', field: 'asin.list_price' },
        { label: '匹配键', field: 'asin.unique = daily_asins.asin_country' },
        { label: '更新日期', field: 'daily_asins.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)' },
        { label: '站点范围', field: "RIGHT(daily_asins.asin_country, 2) NOT IN ('US', 'CA')" },
      ],
      writeBackField: 'daily_asins.list_price',
    },
    star_rating: {
      title: '星级',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号」从 asin.star_rating 同步到昨日的非 US/CA daily_asins 记录',
      fields: [
        { label: '来源星级', field: 'asin.star_rating' },
        { label: '匹配键', field: 'asin.unique = daily_asins.asin_country' },
        { label: '更新日期', field: 'daily_asins.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)' },
        { label: '站点范围', field: "RIGHT(daily_asins.asin_country, 2) NOT IN ('US', 'CA')" },
      ],
      writeBackField: 'daily_asins.star_rating',
    },
    number_of_comments: {
      title: 'review数量',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号」从 asin.number_of_comments 同步到昨日的非 US/CA daily_asins 记录',
      fields: [
        { label: '来源 review 数', field: 'asin.number_of_comments' },
        { label: '匹配键', field: 'asin.unique = daily_asins.asin_country' },
        { label: '更新日期', field: 'daily_asins.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)' },
        { label: '站点范围', field: "RIGHT(daily_asins.asin_country, 2) NOT IN ('US', 'CA')" },
      ],
      writeBackField: 'daily_asins.number_of_comments',
    },
    selling_accounts: {
      title: '售卖账号',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号」从 asin.selling_accounts 同步到昨日的非 US/CA daily_asins 记录',
      fields: [
        { label: '来源售卖账号', field: 'asin.selling_accounts' },
        { label: '匹配键', field: 'asin.unique = daily_asins.asin_country' },
        { label: '更新日期', field: 'daily_asins.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)' },
        { label: '站点范围', field: "RIGHT(daily_asins.asin_country, 2) NOT IN ('US', 'CA')" },
      ],
      writeBackField: 'daily_asins.selling_accounts',
    },
    promotion_days: {
      title: '推广天数',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号」取 order_list 中该 ASIN/国家的最早订单日期，计算昨日记录距首单日期的天数，最小为 0',
      fields: [
        { label: '首单日期', field: 'MIN(order_list.order_date)' },
        { label: '匹配键', field: 'order_list.asin_country_code = daily_asins.asin_country' },
        { label: '计算逻辑', field: 'GREATEST(DATEDIFF(daily_asins.date, first_order_date), 0)' },
        { label: '更新日期', field: 'daily_asins.date = DATE_SUB(CURDATE(), INTERVAL 1 DAY)' },
        { label: '站点范围', field: "RIGHT(daily_asins.asin_country, 2) NOT IN ('US', 'CA')" },
      ],
      writeBackField: 'daily_asins.promotion_days',
    },
    net_price_without_tax: {
      title: '成交额-去掉税费',
      formula: '按当前行国家、ASIN、折后售价匹配定价试算记录（scenario_type = normal），取成交售价（不含税）',
      emptyRules: ['未匹配到相同国家、ASIN、折后售价且 scenario_type = normal 的定价试算记录', '成交售价（不含税）为空'],
      fields: [
        { label: '当前折后售价', field: 'daily_asins.price_after_discount' },
        { label: '试算场景', field: 'pricing_scenarios.scenario_type = normal' },
        { label: '试算折后价（含税）', field: 'pricing_scenarios.price_with_tax' },
        { label: '成交售价（不含税）', field: 'pricing_scenarios.net_price' },
      ],
      writeBackField: 'daily_order_link_tracking.net_price_without_tax',
    },
    review_actual_price: {
      title: '测评成交价',
      formula: '按当前行国家、ASIN、测评折后价匹配定价试算记录（scenario_type = review），取成交售价（不含税）',
      emptyRules: ['未匹配到相同国家、ASIN、测评折后价且 scenario_type = review 的定价试算记录', '成交售价（不含税）为空'],
      fields: [
        { label: '测评折后价', field: 'daily_order_link_tracking.review_discounted_price' },
        { label: '试算场景', field: 'pricing_scenarios.scenario_type = review' },
        { label: '试算折后价（含税）', field: 'pricing_scenarios.price_with_tax' },
        { label: '成交售价（不含税）', field: 'pricing_scenarios.net_price' },
      ],
      writeBackField: 'daily_order_link_tracking.review_actual_price',
    },
    off: {
      title: 'Off 力度',
      formula: '(LP/WP/TP − 购物车价格) ÷ LP/WP/TP',
      emptyRules: ['LP/WP/TP 为空或为 0', '购物车价格为空'],
      fields: [
        { label: 'LP/WP/TP', field: 'daily_asins.list_price' },
        { label: '购物车价格', field: 'daily_asins.daily_price' },
      ],
      writeBackField: 'daily_asins.off',
    },
    lp_duration_days: {
      title: '本划线价持续天数',
      formula: '由工作流「每日生成类型、asin数据」的 SQL 节点「2更新 LP持续天数」计算：同价格连续天数；第一条记录当天算 1 天，价格变化后的第一天也算 1 天',
      emptyRules: ['LP/WP/TP 为空', '站点时间为空', '未找到同国家、ASIN 的历史记录'],
      fields: [
        { label: '当前 LP/WP/TP', field: 'daily_asins.list_price' },
        { label: '当前站点时间', field: 'daily_asins.date' },
        { label: '同国家 ASIN', field: 'daily_asins.asin_country' },
      ],
      writeBackField: 'daily_asins.lp_duration_days',
    },
  };

  const COLUMN_TOOLTIP_EMPTY_RULE_FIELDS = new Set([
    'off',
  ]);

  const DAILY_SQL_UPDATED_FIELD_TEXT = {
    country: '每天自动从 ASIN 表生成，只包含状态为「新品、重点、普通」的产品。',
    asin: '每天自动从 ASIN 表生成，只包含状态为「新品、重点、普通」的产品。',
    date: '每天自动生成从今天起未来 3 个月的日期。',
    model: '每天自动从 ASIN 表同步型号。',
    sale_owner: '每天自动从 ASIN 表同步销售负责人。',
    activity_annotation: '自动匹配 BD/LD 活动日期，活动当天显示活动类型。',
    daily_price: '每天自动同步昨日购物车价格：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    list_price: '每天自动同步昨日 LP/WP/TP：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    star_rating: '每天自动同步昨日星级：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    number_of_comments: '每天自动同步昨日 review 数量：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    selling_accounts: '每天自动同步昨日售卖账号：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    promotion_days: '按该 ASIN/国家的首单日期计算推广天数：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    lp_duration_days: '按当前 LP/WP/TP 连续未变化的天数自动计算，当天算 1 天。',
  };

  const DAILY_SQL_UPDATED_FIELDS = new Set(Object.keys(DAILY_SQL_UPDATED_FIELD_TEXT));

  const DAILY_SQL_UPDATED_FIELD_SOURCE = {
    country: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    asin: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    date: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    model: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    sale_owner: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    activity_annotation: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '3更新 活动标注' }],
    daily_price: [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    list_price: [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    star_rating: [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    number_of_comments: [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    selling_accounts: [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    promotion_days: [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    lp_duration_days: [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '2更新 LP持续天数' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '2更新 LP持续天数' },
    ],
  };

  const SRC_TABLE_LABEL = {
    daily: '每日asin主表（daily_asins）',
    weekly: '产品表现（weekly_performance）',
    order_link: '订单结构与链接追踪合并表（daily_order_link_tracking）',
    keyword_position: 'SQP关键词（sqp_keywords） / SQP关键词每日自然位（sqp_keyword_daily_positions）',
    competitor: '订单流量竞对ASIN（order_link_competitor_asins） / 订单流量竞对ASIN日数据（order_link_competitor_asins_daily）',
    tool: '工具列',
  };

  const SRC_COLLECTION_NAME = {
    daily: 'daily_asins',
    weekly: 'weekly_performance',
    order_link: 'daily_order_link_tracking',
  };

  const INITIAL_COLUMNS = [
    // —— daily ——
    { key:'daily_country',                      src:'daily',  field:'country',                      label:'国家',            hidden:false, pinned:true,  width:70,  editable:false },
    { key:'daily_asin',                         src:'daily',  field:'asin',                         label:'ASIN',            hidden:false, pinned:true,  width:110, editable:false },
    { key:'daily_date',                         src:'daily',  field:'date',                         label:'站点时间',        hidden:false, pinned:true,  width:100, editable:false },
    { key:'daily_sale_owner',                   src:'daily',  field:'sale_owner',                   label:'销售',            hidden:false, pinned:true,  width:80,  editable:false },
    { key:'daily_model',                        src:'daily',  field:'model',                        label:'型号',            hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_activity_annotation',          src:'daily',  field:'activity_annotation',          label:'活动标注',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_daily_price',                  src:'daily',  field:'daily_price',                  label:'购物车价格',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_list_price',                   src:'daily',  field:'list_price',                   label:'LP/WP/TP',         hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_price_after_discount',         src:'daily',  field:'price_after_discount',         label:'折后售价',          hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_off',                          src:'daily',  field:'off',                          label:'Off 力度',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_star_rating',                  src:'daily',  field:'star_rating',                  label:'星级',            hidden:false, pinned:false, width:70,  editable:false },
    { key:'daily_number_of_comments',           src:'daily',  field:'number_of_comments',           label:'review数量',      hidden:false, pinned:false, width:70,  editable:false },
    { key:'daily_selling_accounts',             src:'daily',  field:'selling_accounts',             label:'售卖账号',        hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_promotion_days',               src:'daily',  field:'promotion_days',               label:'推广天数',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_lp_duration_days',             src:'daily',  field:'lp_duration_days',             label:'本划线价持续天数',     hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_rsg_number',                   src:'daily',  field:'rsg_number',                   label:'①测评单',    hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_today_operation',              src:'daily',  field:'today_operation',              label:'今日操作记录',    hidden:false, pinned:false, width:160, editable:false },
    { key:'daily_updatedAt',                    src:'daily',  field:'updatedAt',                    label:'更新时间',        hidden:false, pinned:false, width:100, editable:false },
    // —— weekly ——
    { key:'weekly_sales',                       src:'weekly', field:'sales',                        label:'销量',            hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_zirandan',                    src:'weekly', field:'zirandan',                     label:'实际自然单',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_guanggaodan',                 src:'weekly', field:'guanggaodan',                  label:'广告总单量',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_order_items',                 src:'weekly', field:'order_items',                  label:'实际总单量',      hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_cpu',                         src:'weekly', field:'cpu',                          label:'CPU',             hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_ranking',                     src:'weekly', field:'ranking',                      label:'小类排名',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_zongcvr',                     src:'weekly', field:'zongcvr',                      label:'会话转化率',  hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_guanggaocvr',                 src:'weekly', field:'guanggaocvr',                  label:'广告转化率',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_volume_cvr',                  src:'weekly', field:'volume_cvr',                   label:'销量 CVR',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_guanggaohuafei',              src:'weekly', field:'guanggaohuafei',               label:'广告花费',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_acos',                        src:'weekly', field:'acos',                         label:'ACOS',            hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_tacos',                       src:'weekly', field:'tacos',                        label:'TACOS',           hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_cpa',                         src:'weekly', field:'cpa',                          label:'CPA',             hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_cpc',                         src:'weekly', field:'cpc',                          label:'CPC',             hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_cpo',                         src:'weekly', field:'cpo',                          label:'CPO',             hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_ad_direct_order_quantity',    src:'weekly', field:'ad_direct_order_quantity',     label:'直接成交订单量',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_ad_direct_sales_amount',      src:'weekly', field:'ad_direct_sales_amount',       label:'直接成交额',      hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_ad_sales_amount',             src:'weekly', field:'ad_sales_amount',              label:'广告销售额',      hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_indirect_order_volume',       src:'weekly', field:'indirect_order_volume',        label:'间接跑单订单量',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_impressions',                 src:'weekly', field:'impressions',                  label:'曝光量',          hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_page_views_total',            src:'weekly', field:'page_views_total',             label:'页面浏览量',      hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_organic_traffic',             src:'weekly', field:'organic_traffic',              label:'自然流量(会话量-广告点击)',        hidden:false, pinned:false, width:150, editable:false },
    { key:'weekly_natural_traffic_proportion',  src:'weekly', field:'natural_traffic_proportion',   label:'自然流量占比',    hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_return_count',                src:'weekly', field:'return_count',                 label:'退款量',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_return_rate',                 src:'weekly', field:'return_rate',                  label:'退款率',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_return_goods_count',          src:'weekly', field:'return_goods_count',           label:'退货量',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_return_goods_rate',           src:'weekly', field:'return_goods_rate',            label:'退货率',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_category',                    src:'weekly', field:'category',                     label:'类别',            hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_date',                        src:'weekly', field:'date',                         label:'周日期',          hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_zongliuliang',                src:'weekly', field:'zongliuliang',                 label:'汇总流量-会话量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_guanggaodianji',              src:'weekly', field:'guanggaodianji',               label:'广告点击',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_zirandianji',                 src:'weekly', field:'zirandianji',                  label:'自然点击',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_ctr',                         src:'weekly', field:'ctr',                          label:'CTR',             hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_adv_rate',                    src:'weekly', field:'adv_rate',                     label:'广告订单量占比',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_prev_rank',                   src:'weekly', field:'prev_rank',                    label:'上一次小类排名',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_prev_star',                   src:'weekly', field:'prev_star',                    label:'前一个评分',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_avg_star',                    src:'weekly', field:'avg_star',                     label:'评分',            hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_reviews_count',               src:'weekly', field:'reviews_count',                label:'评论数量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_promotion_volume',            src:'weekly', field:'promotion_volume',             label:'促销销量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_b2b_volume',                  src:'weekly', field:'b2b_volume',                   label:'B2B 销量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_sessions',                    src:'weekly', field:'sessions',                     label:'电脑端流量',hidden:false, pinned:false, width:130, editable:false },
    { key:'weekly_sessions_mobile',             src:'weekly', field:'sessions_mobile',              label:'手机端流量', hidden:false, pinned:false, width:130, editable:false },
    { key:'weekly_page_views',                  src:'weekly', field:'page_views',                   label:'PV-Browser',      hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_page_views_mobile',           src:'weekly', field:'page_views_mobile',            label:'PV-Mobile',       hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_ads_sp_cost',                 src:'weekly', field:'ads_sp_cost',                  label:'SP 广告费',       hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_ads_sp_sales',                src:'weekly', field:'ads_sp_sales',                 label:'SP 广告销售额',   hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_ads_sd_cost',                 src:'weekly', field:'ads_sd_cost',                  label:'SD 广告费',       hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_ads_sd_sales',                src:'weekly', field:'ads_sd_sales',                 label:'SD 广告销售额',   hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_shared_ads_sb_cost',          src:'weekly', field:'shared_ads_sb_cost',           label:'SB 广告费',       hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_shared_ads_sb_sales',         src:'weekly', field:'shared_ads_sb_sales',          label:'SB 广告销售额',   hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_shared_ads_sbv_cost',         src:'weekly', field:'shared_ads_sbv_cost',         label:'SBV 广告费',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_shared_ads_sbv_sales',         src:'weekly', field:'shared_ads_sbv_sales',         label:'SBV 广告销售额',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_natural_single_ratio',        src:'weekly', field:'natural_single_ratio',         label:'自然单占比',      hidden:false, pinned:false, width:110, editable:false },
    // —— order_link ——
    { key:'order_link_real_session_conversion_rate',      src:'order_link', field:'order_link_real_session_conversion_rate', label:'真实会话转化率（剔除测评单）', hidden:false, pinned:false, width:160, editable:false },
    { key:'order_link_target_gap',                        src:'order_link', field:'target_gap',                         label:'目标差距',               hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_page_view_conversion_rate',         src:'order_link', field:'page_view_conversion_rate',         label:'页面浏览转化率',             hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_net_price_without_tax',             src:'order_link', field:'net_price_without_tax',             label:'成交额-去掉税费',             hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_review_discounted_price',          src:'order_link', field:'review_discounted_price',            label:'测评折后价',             hidden:false, pinned:false, width:100, editable:true },
    { key:'order_link_review_actual_price',              src:'order_link', field:'review_actual_price',                label:'测评成交价',             hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_offsite_bg_orders',                src:'order_link', field:'offsite_bg_orders',                  label:'站外 BG 出单',            hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_offsite_xx_orders',                src:'order_link', field:'offsite_xx_orders',                  label:'站外 XX 出单',            hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_offsite_acc_orders',               src:'order_link', field:'offsite_acc_orders',                 label:'站外 ACC 出单',           hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_total_offsite_orders',             src:'order_link', field:'total_offsite_orders',               label:'②站外单',                 hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_total_onsite_orders',              src:'order_link', field:'total_onsite_orders',                label:'②站内:纯自然+广告单',                 hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_onsite_organic_orders',            src:'order_link', field:'onsite_organic_orders',              label:'③站内纯自然单',           hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_onsite_ad_orders',                 src:'order_link', field:'onsite_ad_orders',                   label:'④站内总广告单',           hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_review_orders_ratio',              src:'order_link', field:'review_orders_ratio',                label:'①测评单占比',             hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_formula_review_rate',              src:'order_link', field:'formula_review_rate',                label:'公式算-留评率',           hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_offsite_orders_ratio',             src:'order_link', field:'offsite_orders_ratio',               label:'②站外单占比',             hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_onsite_orders_ratio',              src:'order_link', field:'onsite_orders_ratio',                label:'②站内:纯自然+广告单占比',               hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_onsite_organic_orders_ratio',      src:'order_link', field:'onsite_organic_orders_ratio',        label:'③站内纯自然单占比',       hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_onsite_ad_orders_ratio',           src:'order_link', field:'onsite_ad_orders_ratio',             label:'④站内总广告单占比',       hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_sp_orders_ratio',                  src:'order_link', field:'sp_orders_ratio',                    label:'⑥SP 广告单占比',           hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_sd_orders_ratio',                  src:'order_link', field:'sd_orders_ratio',                    label:'⑦SD 广告单占比',           hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_sb_orders_ratio',                  src:'order_link', field:'sb_orders_ratio',                    label:'⑧SB 广告单占比',           hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_sbv_orders_ratio',                 src:'order_link', field:'sbv_orders_ratio',                   label:'⑨SBV 广告单占比',          hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_review_screenshot',                src:'order_link', field:'review_screenshot',                   label:'review 详细截图',          hidden:false, pinned:false, width:140, editable:false },
    { key:'order_link_bad_review_notes',                 src:'order_link', field:'bad_review_notes',                   label:'差评 rating/差评',                 hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_keyword_trend_screenshot',         src:'order_link', field:'keyword_trend_screenshot',           label:'Asin 西柚/sif 搜索词排名趋势截图',       hidden:false, pinned:false, width:140, editable:false },
    { key:'order_link_ad_framework_screenshot',          src:'order_link', field:'ad_framework_screenshot',            label:'Asin 广告框架截图',             hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_keyword_performance_screenshot',   src:'order_link', field:'keyword_performance_screenshot',     label:'Asin 搜索词表现截图',           hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_page_screenshot',                  src:'order_link', field:'page_screenshot',                    label:'自己页面截图',             hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_link_problem',                     src:'order_link', field:'link_problem',                       label:'链接问题',                 hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_operation_record',                 src:'order_link', field:'operation_record',                   label:'今日操作记录',       hidden:false, pinned:false, width:160, editable:false },
    { key:'order_link_today_todo_plan',                  src:'order_link', field:'today_todo_plan',                    label:'今日待办-预计计划（仅新品推广前30天）', hidden:false, pinned:false, width:220, editable:false },
    { key:'order_link_ad_optimization_logs',             src:'order_link', field:'ad_optimization_logs',               label:'广告优化操作记录 (大方向记录)',         hidden:false, pinned:false, width:160, editable:false },
    { key:'order_link_review_notes',                     src:'order_link', field:'review_notes',                       label:'复盘',               hidden:false, pinned:false, width:100, editable:false },
    { key:'tool_competitor_master',                      src:'tool',       field:'tool_competitor_master',             label:'管理竞对 ASIN',       hidden:true,  pinned:false, width:0,   editable:false },
  ];

  const SRC_UPDATE_CONFIG = {
    daily:      { url: 'daily_asins:update',               pkField: 'country_asin_date' },
    weekly:     { url: 'weekly_performance:update',        pkField: 'country_asin_week' },
    order_link: { url: 'daily_order_link_tracking:update', pkField: 'country_asin_date' },
  };

  const DYNAMIC_COLOR = { country: (row) => COUNTRY_COLORS[row.country] || null };

  const PUSH_PROP_OPTIONS = [
    { label:'显示/隐藏', value:'hidden'      }, { label:'固定列',    value:'pinned'      },
    { label:'列宽',      value:'width'       }, { label:'表头颜色',  value:'headerColor' },
    { label:'可编辑',    value:'editable'    }, { label:'+编辑',     value:'richEdit'    },
  ];

  const SRC_GROUP_CONFIG = [
    { src:'daily',      label:'📋 每日 ASIN',        color:COLOR_GREEN  },
    { src:'weekly',     label:'📈 周产品表现',       color:COLOR_ORANGE },
    { src:'order_link', label:'🔗 订单链接追踪',     color:COLOR_ROSE   },
  ];

  SRC_GROUP_CONFIG.unshift({ src:'tool', label:'工具按钮', color:'#fa8c16' });
  SRC_GROUP_CONFIG.push(
    { src:'keyword_position', label:'关键词自然位', color:'#b5796a' },
    { src:'competitor', label:'竞对 ASIN', color:COLOR_BLUE },
  );

  const isDynamicColumnKey = (key) => {
    return String(key || '').startsWith('kw_actual_') || String(key || '').startsWith('competitor_dynamic_');
  };

  const buildColumnPayload = (cols, preserved = []) => [
    ...cols.map((c) => ({
      key: c.key, hidden: c.hidden === true, pinned: c.pinned === true,
      width: Number(c.width) || 80, headerColor: c.headerColor || null,
      editable: c.editable === true,
      richEdit: c.richEdit === true,
    })),
    ...preserved,
  ];

  const saveColsToUser = async (cols) => {
    if (!currentUserId) return false;
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      const existingCols = Array.isArray(existingSetting[BLOCK_UID]) ? existingSetting[BLOCK_UID] : [];
      const incomingPayload = buildColumnPayload(cols);
      const colKeys = new Set(incomingPayload.map((c) => c.key));
      const preservedDynamic = existingCols.filter((c) => isDynamicColumnKey(c?.key) && !colKeys.has(c.key));
      const preservedStatic = existingCols.filter((c) => !isDynamicColumnKey(c?.key) && !colKeys.has(c.key));
      const colPayload = buildColumnPayload(cols, [...preservedStatic, ...preservedDynamic]);
      await ctx.request({
        url: 'users:update', method: 'post', params: { filterByTk: currentUserId },
        data: { setting: { ...existingSetting, [BLOCK_UID]: colPayload, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } },
      });
      return true;
    } catch { ctx.message.error('列设置保存失败'); return false; }
  };

  const loadColsFromUser = async () => {
    if (!currentUserId) return null;
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const saved = userRes?.data?.data?.setting?.[BLOCK_UID];
      if (!saved || !Array.isArray(saved) || !saved.length) return null;
      return saved;
    } catch { return null; }
  };

  const loadDefaultColsFromUser = async () => {
    if (!currentUserId) return null;
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const saved = userRes?.data?.data?.setting?.[DEFAULT_COLUMNS_KEY];
      if (!saved || !Array.isArray(saved) || !saved.length) return null;
      return saved;
    } catch { return null; }
  };

  const saveDefaultColsToAllUsers = async (cols) => {
    if (!IS_ADMIN) return { ok: false, total: 0, failCount: 0 };
    const payload = buildColumnPayload(cols);
    const res = await ctx.request({ url: 'users:list', method: 'get', params: { pageSize: 200 } });
    const userList = Array.isArray(res?.data?.data) ? res.data.data : [];
    const results = await Promise.allSettled(
      userList.map(async (user) => {
        const uid = user?.id;
        if (!uid) return;
        const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
        const existingSetting = userRes?.data?.data?.setting || {};
        await ctx.request({
          url: 'users:update',
          method: 'post',
          params: { filterByTk: uid },
          data: { setting: { ...existingSetting, [DEFAULT_COLUMNS_KEY]: payload, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } },
        });
      })
    );
    const failCount = results.filter((r) => r.status === 'rejected').length;
    return { ok: failCount === 0, total: userList.length, failCount };
  };

  const migrateLegacyColor = (color) => {
    if (!color) return null;
    const normalized = String(color).toLowerCase();
    if (PRESET_COLOR_VALUES.has(normalized)) {
      return color;
    }
    return LEGACY_COLOR_MAP[normalized] || color;
  };

  const mergeColumnsWithInitial = (saved) => {
    if (!saved || !Array.isArray(saved) || !saved.length) {
      return INITIAL_COLUMNS.map((c) => ({ ...c }));
    }
    const initMap  = Object.fromEntries(INITIAL_COLUMNS.map((c) => [c.key, c]));
    const savedMap = Object.fromEntries(saved.map((s) => [s.key, s]));
    const result   = [];
    saved.forEach((s) => {
      if (!s?.key || !initMap[s.key]) return;
      result.push({
        ...initMap[s.key],
        hidden: s.hidden === true,
        pinned: s.pinned === true,
        width: Number(s.width) || initMap[s.key].width,
        headerColor: migrateLegacyColor(s.headerColor),
        editable: s.editable === true,
        richEdit: s.richEdit === true,
      });
    });
    INITIAL_COLUMNS.forEach((c, idx) => {
      if (savedMap[c.key]) return;
      const prevInitialKeys = INITIAL_COLUMNS.slice(0, idx).map((item) => item.key);
      let insertAfter = -1;
      for (let i = result.length - 1; i >= 0; i -= 1) {
        if (prevInitialKeys.includes(result[i]?.key)) {
          insertAfter = i;
          break;
        }
      }
      if (insertAfter >= 0) result.splice(insertAfter + 1, 0, { ...c });
      else result.push({ ...c });
    });
    return result;
  };

  const buildColumns = async () => {
    const saved = await loadColsFromUser();
    if (saved) return mergeColumnsWithInitial(saved);
    const defaultSaved = await loadDefaultColsFromUser();
    if (defaultSaved) return mergeColumnsWithInitial(defaultSaved);
    return INITIAL_COLUMNS.map((c) => ({ ...c }));
  };

  const formatCell = (col, row) => {
    let v = row[col.field];
    if (col?._dynamicKind === 'keyword') v = row[col.field]?.daily?.actual_rank;
    if (col?._dynamicKind === 'competitor') v = row[col.field]?.daily?.[col._competitorField || 'notes'];

    if (MONEY_FIELDS.has(col.field)) {
      return (v != null && v !== '')
        ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
    }

    if (RATE_FIELDS.has(col.field)) {
      return (v != null && v !== '')
        ? `${(Number(v) * 100).toFixed(2)}%`
        : '—';
    }

    if (DATE_FIELDS.has(col.field)) {
      if (!v) return '—';
      const d = new Date(v);
      const dateStr = d.toLocaleDateString('zh-CN');
      if (col.field === 'date') {
        const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
        return `${dateStr} ${weekDays[d.getDay()]}`;
      }
      return dateStr;
    }

    if (v == null || v === '') return '—';
    return String(v);
  };

  const renderCellDisplay = (col, row) => {
    const displayContent = formatCell(col, row);
    if (col.field !== 'target_gap') return displayContent;
    const rawValue = row[col.field];
    if (rawValue == null || rawValue === '') return displayContent;
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return displayContent;
    const isNegative = num < 0;
    return React.createElement('span', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        width: '100%',
      },
    },
      React.createElement('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '14px',
          height: '14px',
          borderRadius: '50%',
          background: isNegative ? '#ff6b5f' : '#45c46f',
          color: '#fff',
          fontSize: '10px',
          fontWeight: 700,
          lineHeight: 1,
          flexShrink: 0,
        },
      }, isNegative ? '×' : '✓'),
      React.createElement('span', null, displayContent)
    );
  };

  const getTextColorForBg = (hexColor) => {
    if (!hexColor || hexColor.length < 7) return '#333';
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#222' : '#fff';
  };

  const useFloatPos = (btnRef, open) => {
    const [pos, setPos] = useState({ top: 0, left: 0 });
    useEffect(() => {
      if (!open || !btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }, [open]);
    return pos;
  };

  // ════════════════════════════════════════════════════════════
  // 推送配置面板
  // ════════════════════════════════════════════════════════════
  const RichTextImageCell = ({ value, onSave, placeholder = '+' }) => {
    const [content, setContent] = useState(value || '');
    const [isEditing, setIsEditing] = useState(false);
    const [tempContent, setTempContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

    useEffect(() => {
      setContent(value || '');
    }, [value]);

    const extractImages = (text) => {
      const regex = /!\[.*?\]\((.*?)\)/g;
      const urls = [];
      let match;
      while ((match = regex.exec(text || '')) !== null) urls.push(match[1]);
      return urls;
    };

    const imageUrls = useMemo(() => extractImages(content), [content]);
    const cleanText = useMemo(() => (content || '').replace(/!\[.*?\]\(.*?\)\s*/g, '').trim(), [content]);

    const saveToDatabase = async (newContent) => {
      const ok = await onSave?.(newContent);
      if (ok !== false) setContent(newContent);
      return ok !== false;
    };

    const saveAndExit = async () => {
      if (tempContent !== content) await saveToDatabase(tempContent);
      setIsEditing(false);
    };

    const uploadFile = async (file) => {
      setUploading(true);
      try {
        const formData = new window.FormData();
        formData.append('file', file);
        const res = await ctx.request({
          url: 'attachments:upload',
          method: 'post',
          data: formData,
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        const url = res?.data?.data?.url || res?.data?.url;
        if (url) {
          const markdownImage = `![截图](${url})`;
          const next = tempContent ? `${tempContent}\n\n${markdownImage}` : markdownImage;
          setTempContent(next);
          const saved = await saveToDatabase(next);
          if (saved) {
            setTempContent(next);
            setIsEditing(false);
          }
        }
      } catch (err) {
        ctx.message.error(`上传失败：${err?.message || ''}`);
      } finally {
        setUploading(false);
      }
    };

    const handlePaste = (e) => {
      if (!isEditing) return;
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) uploadFile(file);
          return;
        }
      }
    };

    const previewLayer = previewUrl && React.createElement('div', {
      style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onClick: () => setPreviewUrl(null),
    },
      React.createElement('img', {
        src: previewUrl,
        style: { maxWidth: '95%', maxHeight: '92vh', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)' },
      })
    );

    if (isEditing) {
      return React.createElement('div', { style: { height: '60px', border: '1px solid #1890ff', borderRadius: '6px', padding: '3px', background: '#fff', boxSizing: 'border-box', overflow: 'hidden' } },
        React.createElement('textarea', {
          value: tempContent,
          onChange: e => setTempContent(e.target.value),
          onPaste: handlePaste,
          onBlur: saveAndExit,
          onKeyDown: (e) => {
            if (e.key === 'Escape') setIsEditing(false);
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              saveAndExit();
            }
          },
          autoFocus: true,
          disabled: uploading,
          placeholder: '输入文字...\n支持 Ctrl + V 粘贴截图\nCtrl + Enter 保存，Esc 取消',
          style: { width: '100%', height: '52px', border: '1px solid #1890ff', borderRadius: '4px', padding: '3px 5px', fontSize: '13px', fontFamily: 'monospace', resize: 'none', background: '#fafafa', lineHeight: '15px', outline: 'none', boxSizing: 'border-box', overflow: 'auto' },
        })
      );
    }

    const isEmpty = !cleanText && imageUrls.length === 0;
    return React.createElement(React.Fragment, null,
      React.createElement('div', {
        onDoubleClick: () => { setTempContent(content || ''); setIsEditing(true); },
        style: { height: '60px', display: 'flex', alignItems: 'center', justifyContent: isEmpty ? 'center' : 'flex-start', gap: '6px', padding: '3px 5px', background: content ? '#fafafa' : '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'cell', overflow: 'hidden', boxSizing: 'border-box' },
      },
        isEmpty
          ? React.createElement('div', { style: { fontSize: '16px', color: '#999', lineHeight: '18px', fontWeight: 700, textAlign: 'center' } }, placeholder)
          : React.createElement(React.Fragment, null,
              imageUrls.slice(0, 2).map((url, i) => React.createElement('img', {
                key: `${url}-${i}`,
                src: url,
                onClick: (e) => { e.stopPropagation(); setPreviewUrl(url); },
                style: { width: '42px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'zoom-in', flex: '0 0 auto' },
              })),
              cleanText && React.createElement('div', { style: { minWidth: 0, flex: '1 1 auto', fontSize: '13px', color: '#333', lineHeight: '16px', maxHeight: '48px', overflow: 'hidden', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, cleanText)
            )
      ),
      previewLayer
    );
    const helperText = imageUrls.length ? `截图 ${imageUrls.length} 张` : '';

    return React.createElement(React.Fragment, null,
      React.createElement('div', {
        onDoubleClick: () => { setTempContent(content || ''); setIsEditing(true); },
        style: { height: '60px', display: 'flex', alignItems: 'center', justifyContent: isEmpty ? 'center' : undefined, gap: '6px', padding: '3px 5px', background: content ? '#fafafa' : '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'cell', overflow: 'hidden', boxSizing: 'border-box' },
      },
        imageUrls.length > 0 && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 } },
          visibleImages.map((url, i) => React.createElement('img', {
            key: i,
            src: url,
            onClick: (e) => { e.stopPropagation(); setPreviewUrl(url); },
            style: { width: '42px', height: '36px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'zoom-in' },
          })),
          extraCount > 0 && React.createElement('div', { style: { width: '30px', height: '36px', borderRadius: '4px', background: '#f0f0f0', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, border: '1px solid #ddd' } }, `+${extraCount}`)
        ),
        React.createElement('div', { style: { flex: isEmpty ? '0 0 auto' : 1, minWidth: 0, height: isEmpty ? '100%' : undefined, display: 'flex', flexDirection: 'column', justifyContent: isEmpty ? 'center' : undefined, alignItems: isEmpty ? 'center' : undefined, gap: '2px' } },
          React.createElement(Tooltip, {
            title: cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : placeholder),
            placement: 'topLeft',
            mouseEnterDelay: 0.3,
          },
            React.createElement('div', { style: { fontSize: isEmpty ? '16px' : '13px', color: cleanText ? '#333' : '#999', lineHeight: isEmpty ? '18px' : '16px', fontWeight: isEmpty ? 700 : 400, textAlign: isEmpty ? 'center' : 'left', minHeight: cleanText ? '30px' : undefined, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-all' } },
              cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : placeholder)
            )
          ),
          helperText && React.createElement('div', { style: { fontSize: '11px', color: '#aaa', lineHeight: '14px' } }, helperText)
        )
      ),
      previewLayer
    );
  };

  const CompetitorMasterDrawer = ({ visible, onClose, countryAsinOptions, country: propCountry, asin: propAsin, onRefresh }) => {
    const [country, setCountry] = useState(propCountry || null);
    const [asin, setAsin] = useState(propAsin || null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [note, setNote] = useState('');
    const countryAsin = country && asin ? `${country}_${asin}` : null;
    const hasContext = !!(propCountry && propAsin);

    const countryOpts = useMemo(() => {
      const set = new Set(countryAsinOptions.map(o => o.country).filter(Boolean));
      return Array.from(set).sort().map(c => ({ label: c, value: c }));
    }, [countryAsinOptions]);

    const asinOpts = useMemo(() => {
      if (!country) return [];
      const set = new Set(countryAsinOptions.filter(o => o.country === country).map(o => o.asin).filter(Boolean));
      return Array.from(set).sort().map(a => ({ label: a, value: a }));
    }, [countryAsinOptions, country]);

    const load = useCallback(async () => {
      if (!visible || !countryAsin) { setRecords([]); return; }
      setLoading(true);
      try {
        const res = await ctx.request({
          url: 'order_link_competitor_asins:list',
          method: 'get',
          params: { filter: JSON.stringify({ country_asin: { $eq: countryAsin } }), pageSize: 100 },
        });
        setRecords(Array.isArray(res?.data?.data) ? res.data.data : []);
      } catch (err) {
        ctx.message.error(`加载竞对失败：${err?.message || ''}`);
      } finally {
        setLoading(false);
      }
    }, [visible, countryAsin]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => {
      if (visible) {
        if (propCountry) setCountry(propCountry);
        if (propAsin) setAsin(propAsin);
      } else {
        setRecords([]);
        setName('');
        setNote('');
        if (!propCountry) setCountry(null);
        if (!propAsin) setAsin(null);
      }
    }, [visible, propCountry, propAsin]);

    useEffect(() => { setName(''); setNote(''); }, [countryAsin]);

    const sortedRecords = useMemo(() => {
      return [...records].sort((a, b) => {
        const ai = getCompetitorRoleIndex(a.role);
        const bi = getCompetitorRoleIndex(b.role);
        if (ai !== bi) return ai - bi;
        return String(a.competitor_asin || '').localeCompare(String(b.competitor_asin || ''));
      });
    }, [records]);

    const nextRole = useMemo(() => {
      const maxIdx = sortedRecords.reduce((max, rec) => {
        const idx = getCompetitorRoleIndex(rec.role);
        return Number.isFinite(idx) && idx !== 9999 ? Math.max(max, idx) : max;
      }, 0);
      return `竞对${maxIdx + 1}`;
    }, [sortedRecords]);

    const addRecord = async () => {
      const trimmed = String(name || '').trim();
      const trimmedNote = String(note || '').trim();
      if (!countryAsin) { ctx.message.warning('请先选择 Country 和 ASIN'); return; }
      if (!trimmed) { ctx.message.warning('请输入竞对 ASIN'); return; }
      try {
        setSaving(true);
        await ctx.request({
          url: 'order_link_competitor_asins:create',
          method: 'post',
          data: withCreateTimestamps({ country_asin: countryAsin, competitor_asin: trimmed, role: nextRole, notes: trimmedNote || null }),
        });
        setName('');
        setNote('');
        await load();
        onRefresh?.();
        ctx.message.success(`${nextRole} 已添加`);
      } catch (err) {
        ctx.message.error(`添加失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const updateRecord = async (item, value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      try {
        setSaving(true);
        await ctx.request({
          url: 'order_link_competitor_asins:update',
          method: 'post',
          params: { filterByTk: item.id },
          data: { competitor_asin: trimmed },
        });
        setRecords(prev => prev.map(r => r.id === item.id ? { ...r, competitor_asin: trimmed } : r));
        onRefresh?.();
        ctx.message.success('已保存');
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const updateNoteRecord = async (item, value) => {
      const trimmed = String(value || '').trim();
      try {
        setSaving(true);
        await ctx.request({
          url: 'order_link_competitor_asins:update',
          method: 'post',
          params: { filterByTk: item.id },
          data: { notes: trimmed || null },
        });
        setRecords(prev => prev.map(r => r.id === item.id ? { ...r, notes: trimmed || null } : r));
        onRefresh?.();
        ctx.message.success('已保存');
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const deleteRecord = async (item) => {
      try {
        setSaving(true);
        let deletedDailyRows = 0;
        while (true) {
          const dailyRes = await ctx.request({
            url: 'order_link_competitor_asins_daily:list',
            method: 'get',
            params: {
              pageSize: 200,
              filter: JSON.stringify({ competitor_id: { $eq: item.id } }),
            },
          });
          const dailyRows = Array.isArray(dailyRes?.data?.data) ? dailyRes.data.data : [];
          if (!dailyRows.length) break;
          for (const row of dailyRows) {
            await ctx.request({
              url: 'order_link_competitor_asins_daily:destroy',
              method: 'post',
              params: { filterByTk: row.id },
            });
            deletedDailyRows += 1;
          }
        }
        await ctx.request({ url: 'order_link_competitor_asins:destroy', method: 'post', params: { filterByTk: item.id } });
        setRecords(prev => prev.filter(r => r.id !== item.id));
        onRefresh?.();
        ctx.message.success(`已删除竞对，并清理 ${deletedDailyRows} 条每日记录`);
      } catch (err) {
        ctx.message.error(`删除失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    return React.createElement(Modal, {
      title: null,
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 720,
      destroyOnClose: true,
    },
      React.createElement('div', null,
        hasContext
          ? React.createElement('div', { style: { marginBottom: 12, padding: 12, background: '#f0f7ff', border: '1px solid #91caff', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'center' } },
              React.createElement('span', { style: { fontWeight: 600, color: '#1677ff' } }, '当前：'),
              React.createElement('span', { style: { fontWeight: 700, color: '#333' } }, `${propCountry} · ${propAsin}`),
              React.createElement('span', { style: { marginLeft: 'auto', color: '#666', fontSize: 13 } }, `共 ${records.length} 个竞对`)
            )
          : React.createElement('div', { style: { marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
              React.createElement(Select, { placeholder: 'Country', value: country || undefined, options: countryOpts, onChange: (v) => { setCountry(v); setAsin(null); }, style: { minWidth: 140 }, showSearch: true, allowClear: true }),
              React.createElement(Select, { placeholder: 'ASIN', value: asin || undefined, options: asinOpts, disabled: !country, onChange: setAsin, style: { minWidth: 180 }, showSearch: true, allowClear: true })
            ),
        !countryAsin
          ? React.createElement('div', { style: { padding: 24, color: '#999', background: '#fafafa', borderRadius: 6 } }, '请先选择具体 Country 和 ASIN。')
          : React.createElement(React.Fragment, null,
              React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(160px, 1fr) minmax(180px, 1fr) auto', gap: 8, marginBottom: 12 } },
                React.createElement(Input, { value: name, placeholder: `新增${nextRole} ASIN`, onChange: (e) => setName(e.target.value), onPressEnter: addRecord, disabled: saving }),
                React.createElement(Input, { value: note, placeholder: '列头备注（可选）', onChange: (e) => setNote(e.target.value), onPressEnter: addRecord, disabled: saving }),
                React.createElement(Button, { type: 'primary', loading: saving, onClick: addRecord }, '新增')
              ),
              loading
                ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#999' } }, '加载中...')
                : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                    sortedRecords.length === 0 && React.createElement('div', { style: { padding: 20, color: '#999', textAlign: 'center', background: '#fafafa', borderRadius: 6 } }, '暂无竞对'),
                    sortedRecords.map((item) => React.createElement('div', {
                      key: item.id,
                      style: { display: 'grid', gridTemplateColumns: '72px minmax(140px, 1fr) minmax(160px, 1fr) auto', gap: 8, alignItems: 'center' },
                    },
                      React.createElement('span', { style: { padding: '4px 8px', borderRadius: 4, background: getCompetitorColor(item.role), color: getTextColorForBg(getCompetitorColor(item.role)), textAlign: 'center', fontWeight: 700, fontSize: 13 } }, item.role || '竞对'),
                      React.createElement(Input, {
                        defaultValue: item.competitor_asin || '',
                        onBlur: (e) => updateRecord(item, e.target.value.trim()),
                        onPressEnter: (e) => e.currentTarget.blur(),
                      }),
                      React.createElement(Input, {
                        defaultValue: item.notes || '',
                        placeholder: '列头备注',
                        onBlur: (e) => updateNoteRecord(item, e.target.value),
                        onPressEnter: (e) => e.currentTarget.blur(),
                      }),
                      React.createElement(Popconfirm, { title: `确定删除「${item.competitor_asin || item.role || '竞对'}」？`, onConfirm: () => deleteRecord(item), okText: '确定', cancelText: '取消' },
                        React.createElement(Button, { danger: true }, '删除')
                      )
                    ))
                  )
            )
      )
    );
  };

  const TERM_ADDED_ORDER_SORT = ['id'];
  const sqpIsValidNumber = (value) => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
  const sqpSafeNum = (value) => sqpIsValidNumber(value) ? Number(value) : 0;
  const sqpRoundRate = (value) => sqpIsValidNumber(value) ? Math.round(Number(value) * 10000) / 10000 : null;
  const sqpDivNull = (a, b) => (sqpIsValidNumber(a) && sqpIsValidNumber(b) && Number(b) !== 0) ? sqpRoundRate(Number(a) / Number(b)) : null;
  const sqpNullableSum = (rows, field) => {
    let hasValue = false;
    const total = (Array.isArray(rows) ? rows : []).reduce((sum, row) => {
      if (!sqpIsValidNumber(row?.[field])) return sum;
      hasValue = true;
      return sum + Number(row[field]);
    }, 0);
    return hasValue ? total : null;
  };
  const sqpParseWeekNo = (label) => {
    const match = String(label || '').match(/\d+/);
    return match ? Number(match[0]) : null;
  };
  const sqpSortTermsByAddedOrder = (rows) => [...(rows || [])].sort((a, b) => {
    const sortA = Number(a.sort ?? a.id ?? 0);
    const sortB = Number(b.sort ?? b.id ?? 0);
    if (sortA !== sortB) return sortA - sortB;
    return Number(a.id || 0) - Number(b.id || 0);
  });
  const sqpDeltaText = (cur, prev, unit = '', showBasePercent = false) => {
    if (!sqpIsValidNumber(cur) || !sqpIsValidNumber(prev)) return '数据不足';
    const diff = sqpSafeNum(cur) - sqpSafeNum(prev);
    const arrow = diff > 0 ? '↑+' : '↓-';
    if (unit === 'rate') return `${arrow}${Math.abs(diff * 100).toFixed(2)}%`;
    const base = showBasePercent ? (sqpSafeNum(prev) === 0 ? '新' : `${Math.round(Math.abs(diff) / sqpSafeNum(prev) * 100)}%`) : '';
    const suffix = showBasePercent ? `(${base})` : '';
    if (unit === 'wan') return `${arrow}${(Math.abs(diff) / 10000).toFixed(1)}万${suffix}`;
    return `${arrow}${Math.trunc(Math.abs(diff))}${suffix}`;
  };
  const sqpDiagnosisLine = (label, text) => text === '数据不足' ? `${label} -- 数据不足` : `${label}${text}`;
  const sqpDiagnosisPairLine = (label, firstLabel, first, secondLabel, second) => (
    first === '数据不足' || second === '数据不足'
      ? `${label} -- 数据不足`
      : `${label}${firstLabel}${first} | ${secondLabel}${second}`
  );
  const sqpTermPrefix = (term) => {
    const termName = String(term?.term_name || '').trim();
    if (!termName) return '';
    return `【${term?.term_type === 'root' ? '词根' : '关键词'} ${termName}】 `;
  };
  const sqpWeekLabel = (term) => {
    const label = String(term?.week_label || '').trim();
    if (label) return label;
    return sqpIsValidNumber(term?.week_no) ? `第${Number(term.week_no)}周` : '';
  };
  const sqpTrailing = (text) => text ? `${text} ` : '';
  const sqpBuildMarketDiagnosis = (cur, prev) => !prev ? null : [
    `${sqpTermPrefix(cur)}市场${sqpWeekLabel(cur)} 环比${sqpWeekLabel(prev)}：`,
    sqpDiagnosisLine('①搜寻数量', sqpDeltaText(cur.search_query_volume, prev.search_query_volume, 'wan', true)),
    sqpDiagnosisLine('②曝光', sqpDeltaText(cur.impressions_count, prev.impressions_count, 'wan', true)),
    sqpDiagnosisLine('③点击', sqpDeltaText(cur.clicks_count, prev.clicks_count, 'wan', true)),
    sqpDiagnosisLine('④加购', sqpDeltaText(cur.cart_additions_count, prev.cart_additions_count, '', true)),
    sqpDiagnosisLine('⑤单量', sqpDeltaText(cur.purchases_count, prev.purchases_count, '', true)),
    sqpDiagnosisLine('⑥CTR', sqpDeltaText(cur.market_ctr, prev.market_ctr, 'rate')),
    sqpDiagnosisLine('⑦加购率', sqpDeltaText(cur.market_cart_rate, prev.market_cart_rate, 'rate')),
    sqpDiagnosisLine('⑧CVR', sqpDeltaText(cur.market_cvr, prev.market_cvr, 'rate')),
  ].join('\n');
  const sqpBuildAsinDiagnosis = (cur, prev) => !prev ? null : [
    `${sqpTermPrefix(cur)}${sqpTrailing(sqpWeekLabel(cur))}Asin 环比${sqpWeekLabel(prev)}：`,
    sqpDiagnosisPairLine('①点击份额', '', sqpDeltaText(cur.asin_click_share, prev.asin_click_share, 'rate'), '点击', sqpDeltaText(cur.clicks_asin_count, prev.clicks_asin_count)),
    sqpDiagnosisPairLine('②加购份额', '', sqpDeltaText(cur.asin_cart_share, prev.asin_cart_share, 'rate'), '加购', sqpDeltaText(cur.cart_additions_asin_count, prev.cart_additions_asin_count)),
    sqpDiagnosisPairLine('③购买份额', '', sqpDeltaText(cur.asin_purchase_share, prev.asin_purchase_share, 'rate'), '单量', sqpDeltaText(cur.purchases_asin_count, prev.purchases_asin_count)),
    sqpDiagnosisLine('④CTR', sqpDeltaText(cur.asin_ctr, prev.asin_ctr, 'rate')),
    sqpDiagnosisLine('⑤加购率', sqpDeltaText(cur.asin_cart_rate, prev.asin_cart_rate, 'rate')),
    sqpDiagnosisLine('⑥CVR', sqpDeltaText(cur.asin_cvr, prev.asin_cvr, 'rate')),
  ].join('\n');
  const sqpRateDiff = (a, b) => (!sqpIsValidNumber(a) || !sqpIsValidNumber(b)) ? '数据不足' : `${(Math.abs(sqpSafeNum(a) - sqpSafeNum(b)) * 100).toFixed(2)}%`;
  const sqpCompareRateLine = (label, asinValue, marketValue) => {
    const diff = sqpRateDiff(asinValue, marketValue);
    if (diff === '数据不足') return `${label} -- 数据不足`;
    return `${asinValue < marketValue ? `${label}差-` : `${label}优+`}${diff}`;
  };
  const sqpBuildCompareDiagnosis = (cur) => {
    const hasOrderData = sqpIsValidNumber(cur.weekly_required_orders) && sqpIsValidNumber(cur.purchases_asin_count);
    const requiredOrders = sqpSafeNum(cur.weekly_required_orders);
    const asinOrders = sqpSafeNum(cur.purchases_asin_count);
    return [
      `${sqpTermPrefix(cur)}${sqpTrailing(sqpWeekLabel(cur))}Asin 同比市场：`,
      sqpCompareRateLine('①CTR', cur.asin_ctr, cur.market_ctr),
      sqpCompareRateLine('②CVR', cur.asin_cvr, cur.market_cvr),
      sqpCompareRateLine('③加购率', cur.asin_cart_rate, cur.market_cart_rate),
      hasOrderData
        ? `${requiredOrders > asinOrders ? '④出单未达标' : '④出单已OK'}|${asinOrders - requiredOrders > 0 ? `超${Math.trunc(asinOrders - requiredOrders)}单` : `缺${Math.trunc(Math.abs(asinOrders - requiredOrders))}单`}`
        : '④出单 -- 数据不足',
    ].join('\n');
  };
  const sqpWeeklyRequiredOrders = (stageShare, purchasesCount) => (
    stageShare == null || stageShare === '' || !sqpIsValidNumber(purchasesCount)
      ? null
      : Math.round(Number(stageShare) * Number(purchasesCount))
  );
  const sqpDailyRequiredOrders = (weeklyRequired) => sqpIsValidNumber(weeklyRequired) ? Math.round(Number(weeklyRequired) / 7) : null;

  const SqpTermManagerModal = ({ visible, onClose, country, asin, onRefresh }) => {
    const [tab, setTab] = useState('keyword');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const countryAsin = country && asin ? `${country}_${asin}` : null;
    const collection = tab === 'keyword' ? 'sqp_keywords' : 'sqp_roots';
    const nameField = tab === 'keyword' ? 'keyword_name' : 'root_name';
    const title = tab === 'keyword' ? '关键词' : '词根';

    const fetchAll = async (url, params = {}) => {
      const pageSize = 200;
      const rows = [];
      for (let page = 1; page <= 10000; page += 1) {
        const res = await ctx.request({ url, method: 'get', params: { ...params, page, pageSize } });
        const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
        rows.push(...batch);
        const totalPage = Number(res?.data?.meta?.totalPage);
        if (batch.length < pageSize || (Number.isFinite(totalPage) && page >= totalPage)) break;
      }
      return rows;
    };

    const load = useCallback(async () => {
      if (!visible || !countryAsin) { setItems([]); return; }
      setLoading(true);
      try {
        const res = await ctx.request({
          url: `${collection}:list`,
          method: 'get',
          params: { pageSize: 500, sort: TERM_ADDED_ORDER_SORT, filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) },
        });
        setItems(sqpSortTermsByAddedOrder(Array.isArray(res?.data?.data) ? res.data.data : []));
      } catch (err) {
        ctx.message.error(`加载${title}失败：${err?.message || ''}`);
      } finally {
        setLoading(false);
      }
    }, [visible, countryAsin, collection, title]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (!visible) { setName(''); setTab('keyword'); } }, [visible]);

    const upsertTermWeekly = async (payload) => {
      const exists = await ctx.request({
        url: 'sqp_term_weekly:list',
        method: 'get',
        params: { pageSize: 1, filter: JSON.stringify({ term_week_key: { $eq: payload.term_week_key } }) },
      });
      const rec = Array.isArray(exists?.data?.data) ? exists.data.data[0] : null;
      if (rec?.term_week_key) {
        const nextPayload = { ...payload };
        if (rec.stage_target_share != null && rec.stage_target_share !== '') {
          nextPayload.stage_target_share = rec.stage_target_share;
          nextPayload.weekly_required_orders = sqpWeeklyRequiredOrders(rec.stage_target_share, payload.purchases_count);
          nextPayload.daily_required_orders = sqpDailyRequiredOrders(nextPayload.weekly_required_orders);
          nextPayload.compare_diagnosis = payload.compare_diagnosis
            ? sqpBuildCompareDiagnosis({ ...nextPayload, week_label: payload.week_label })
            : null;
        }
        await ctx.request({ url: 'sqp_term_weekly:update', method: 'post', params: { filterByTk: rec.term_week_key }, data: nextPayload });
      } else {
        await ctx.request({ url: 'sqp_term_weekly:create', method: 'post', data: withCreateTimestamps(payload) });
      }
    };

    const findTermItem = async (termName) => {
      const res = await ctx.request({
        url: `${collection}:list`,
        method: 'get',
        params: {
          pageSize: 1,
          filter: JSON.stringify({ $and: [{ country_asin: { $eq: countryAsin } }, { [nameField]: { $eq: termName } }] }),
        },
      });
      return Array.isArray(res?.data?.data) ? res.data.data[0] : null;
    };

    const recalcTermWeekly = async (termItem, nextName) => {
      const termName = String(nextName || termItem?.[nameField] || '').trim();
      if (!termItem?.id || !countryAsin || !termName) return 0;
      const weeks = await fetchAll('sqp_weekly_main:list', {
        sort: 'report_date',
        filter: JSON.stringify({ country_asin: { $eq: countryAsin } }),
      });
      let count = 0;
      let prevPayload = null;
      for (const week of weeks) {
        const reportDate = week.report_date ? String(week.report_date).slice(0, 10) : null;
        if (!reportDate) continue;
        const sqpRows = await fetchAll('sqp:list', {
          filter: JSON.stringify({ $and: [{ country: { $eq: country } }, { asin: { $eq: asin } }, { report_date: { $eq: reportDate } }] }),
        });
        const termType = tab === 'keyword' ? 'keyword' : 'root';
        const matchedRows = sqpRows.filter((row) => {
          const searchQuery = String(row.search_query || '').trim();
          if (!searchQuery) return false;
          return termType === 'root' ? searchQuery.includes(termName) : searchQuery === termName;
        });
        const searchQueryVolume = sqpNullableSum(matchedRows, 'search_query_volume');
        const impressionsCount = sqpNullableSum(matchedRows, 'impressions_count');
        const clicksCount = sqpNullableSum(matchedRows, 'clicks_count');
        const cartAdditionsCount = sqpNullableSum(matchedRows, 'cart_additions_count');
        const purchasesCount = sqpNullableSum(matchedRows, 'purchases_count');
        const impressionsAsinCount = sqpNullableSum(matchedRows, 'impressions_asin_count');
        const clicksAsinCount = sqpNullableSum(matchedRows, 'clicks_asin_count');
        const cartAdditionsAsinCount = sqpNullableSum(matchedRows, 'cart_additions_asin_count');
        const purchasesAsinCount = sqpNullableSum(matchedRows, 'purchases_asin_count');
        const mainKey = week.country_asin_weekDate || week.country_asin_week_date || week.id;
        const payload = {
          term_week_key: `${country}_${asin}_${reportDate}_${termType}_${termItem.id}`,
          country_asin_weekDate: mainKey,
          country_asin: countryAsin,
          country,
          asin,
          report_date: reportDate,
          week_no: sqpParseWeekNo(week.week_label),
          term_type: termType,
          term_name: termName,
          term_id: termItem.id,
          search_query_volume: searchQueryVolume,
          impressions_count: impressionsCount,
          clicks_count: clicksCount,
          cart_additions_count: cartAdditionsCount,
          purchases_count: purchasesCount,
          impressions_asin_count: impressionsAsinCount,
          clicks_asin_count: clicksAsinCount,
          cart_additions_asin_count: cartAdditionsAsinCount,
          purchases_asin_count: purchasesAsinCount,
          market_ctr: sqpDivNull(clicksCount, impressionsCount),
          asin_ctr: sqpDivNull(clicksAsinCount, impressionsAsinCount),
          market_cart_rate: sqpDivNull(cartAdditionsCount, clicksCount),
          asin_cart_rate: sqpDivNull(cartAdditionsAsinCount, clicksAsinCount),
          market_cvr: sqpDivNull(purchasesCount, clicksCount),
          asin_cvr: sqpDivNull(purchasesAsinCount, clicksAsinCount),
          asin_click_share: sqpDivNull(clicksAsinCount, clicksCount),
          asin_cart_share: sqpDivNull(cartAdditionsAsinCount, cartAdditionsCount),
          asin_purchase_share: sqpDivNull(purchasesAsinCount, purchasesCount),
          stage_target_share: null,
          weekly_required_orders: null,
          daily_required_orders: null,
          market_diagnosis: null,
          asin_diagnosis: null,
          compare_diagnosis: null,
        };
        const payloadWithLabel = { ...payload, week_label: week.week_label };
        const hasTermData = [
          searchQueryVolume, impressionsCount, clicksCount, cartAdditionsCount, purchasesCount,
          impressionsAsinCount, clicksAsinCount, cartAdditionsAsinCount, purchasesAsinCount,
        ].some(sqpIsValidNumber);
        if (hasTermData) {
          payload.market_diagnosis = sqpBuildMarketDiagnosis(payloadWithLabel, prevPayload);
          payload.asin_diagnosis = sqpBuildAsinDiagnosis(payloadWithLabel, prevPayload);
          payload.compare_diagnosis = sqpBuildCompareDiagnosis(payloadWithLabel);
        }
        await upsertTermWeekly(payload);
        prevPayload = hasTermData ? payloadWithLabel : null;
        count += 1;
      }
      return count;
    };

    const addItem = async () => {
      const trimmed = String(name || '').trim();
      if (!trimmed) { ctx.message.warning(`请输入${title}`); return; }
      if (!countryAsin) { ctx.message.warning('请先筛选到具体站点和 ASIN'); return; }
      try {
        setSaving(true);
        const createdRes = await ctx.request({
          url: `${collection}:create`,
          method: 'post',
          data: withCreateTimestamps({ country_asin: countryAsin, country, asin, [nameField]: trimmed }),
        });
        const created = createdRes?.data?.data || {};
        const termItem = created?.id ? created : await findTermItem(trimmed);
        const count = await recalcTermWeekly(termItem, trimmed);
        setName('');
        await load();
        onRefresh?.();
        ctx.message.success(`新增成功，已同步 SQP 并生成 ${count} 周汇总`);
      } catch (err) {
        ctx.message.error(`新增失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const updateItem = async (item, value) => {
      const nextValue = String(value || '').trim();
      try {
        setSaving(true);
        await ctx.request({ url: `${collection}:update`, method: 'post', params: { filterByTk: item.id }, data: { [nameField]: nextValue || null } });
        setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, [nameField]: nextValue || null } : it));
        if (nextValue) {
          const count = await recalcTermWeekly({ ...item, [nameField]: nextValue }, nextValue);
          ctx.message.success(`已保存，并同步 SQP ${count} 周汇总`);
        }
        onRefresh?.();
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const deleteItem = async (item) => {
      try {
        setSaving(true);
        const termType = tab === 'keyword' ? 'keyword' : 'root';
        let deletedTermRows = 0;
        while (true) {
          const termName = String(item?.[nameField] || '').trim();
          const termMatchers = [{ term_id: { $eq: item.id } }];
          if (termName) termMatchers.push({ term_name: { $eq: termName } });
          const res = await ctx.request({
            url: 'sqp_term_weekly:list',
            method: 'get',
            params: {
              pageSize: 500,
              filter: JSON.stringify({ $and: [{ country_asin: { $eq: countryAsin } }, { term_type: { $eq: termType } }, { $or: termMatchers }] }),
            },
          });
          const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
          if (!rows.length) break;
          for (const row of rows) {
            await ctx.request({ url: 'sqp_term_weekly:destroy', method: 'post', params: { filterByTk: row.term_week_key || row.id } });
            deletedTermRows += 1;
          }
        }
        await ctx.request({ url: `${collection}:destroy`, method: 'post', params: { filterByTk: item.id } });
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        onRefresh?.();
        ctx.message.success(`已删除${title}，并同步清理 ${deletedTermRows} 条 SQP 汇总`);
      } catch (err) {
        ctx.message.error(`删除失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    return React.createElement(Modal, {
      title: countryAsin ? `管理 SQP ${title}：${countryAsin}` : `管理 SQP ${title}`,
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 700,
      destroyOnClose: true,
    },
      !countryAsin
        ? React.createElement('div', { style: { padding: 24, color: '#999' } }, '请先进入具体 country + asin 后再管理关键词。')
        : React.createElement('div', null,
            React.createElement('div', { style: { marginBottom: 12, padding: '10px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, color: '#3f6600', lineHeight: 1.6 } },
              '这里管理的是 SQP 版块同一批关键词/词根；在这里新增、修改或删除，SQP 版块会同步变化。'
            ),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
              React.createElement(Button, { type: tab === 'keyword' ? 'primary' : 'default', onClick: () => setTab('keyword'), disabled: saving }, '关键词'),
              React.createElement(Button, { type: tab === 'root' ? 'primary' : 'default', onClick: () => setTab('root'), disabled: saving }, '词根')
            ),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
              React.createElement(Input, { value: name, placeholder: `新增${title}`, onChange: (e) => setName(e.target.value), onPressEnter: addItem, disabled: saving }),
              React.createElement(Button, { type: 'primary', loading: saving, onClick: addItem }, '新增')
            ),
            loading
              ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#999' } }, '加载中...')
              : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                  items.length === 0 && React.createElement('div', { style: { padding: 20, color: '#999', textAlign: 'center', background: '#fafafa' } }, `暂无${title}`),
                  items.map((item) => React.createElement('div', {
                    key: item.id,
                    style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' },
                  },
                    React.createElement(Input, {
                      defaultValue: item[nameField] || '',
                      disabled: saving,
                      onBlur: (e) => updateItem(item, e.target.value.trim()),
                      onPressEnter: (e) => e.currentTarget.blur(),
                    }),
                    React.createElement(Popconfirm, { title: `确定删除「${item[nameField] || title}」？`, onConfirm: () => deleteItem(item), okText: '确定', cancelText: '取消' },
                      React.createElement(Button, { danger: true, disabled: saving }, '删除')
                    )
                  ))
                )
          )
    );
  };

  const PushPanel = ({ columns, onClose, anchorPos }) => {
    const [userList, setUserList]           = useState([]);
    const [loadingUsers, setLoadingUsers]   = useState(true);
    const [selectedProps, setSelectedProps] = useState(['hidden','pinned','width','headerColor','editable','richEdit']);
    const [pushing, setPushing]             = useState(false);

    useEffect(() => {
      (async () => {
        setLoadingUsers(true);
        try {
          const res  = await ctx.request({ url: 'users:list', method: 'get', params: { pageSize: 200 } });
          const list = Array.isArray(res?.data?.data) ? res.data.data : [];
          setUserList(list.filter((u) => String(u.id) !== String(currentUserId)));
        } catch { ctx.message.error('加载用户列表失败'); }
        finally { setLoadingUsers(false); }
      })();
    }, []);

    const buildPayload = useCallback((cols) => cols.map((c) => {
      const item = { key: c.key };
      if (selectedProps.includes('hidden'))      item.hidden      = c.hidden === true;
      if (selectedProps.includes('pinned'))      item.pinned      = c.pinned === true;
      if (selectedProps.includes('width'))       item.width       = Number(c.width) || 80;
      if (selectedProps.includes('headerColor')) item.headerColor = c.headerColor || null;
      if (selectedProps.includes('editable'))    item.editable    = c.editable === true;
      if (selectedProps.includes('richEdit'))    item.richEdit    = c.richEdit === true;
      return item;
    }), [selectedProps]);

    const handlePush = useCallback(async () => {
      const targetUserIds = userList.map((u) => u.id);
      if (!targetUserIds.length) { ctx.message.warning('没有可推送的其他用户'); return; }
      if (!selectedProps.length) { ctx.message.warning('请至少选择一个推送属性'); return; }
      setPushing(true);
      try {
        const payload = buildPayload(columns);
        const results = await Promise.allSettled(
          targetUserIds.map(async (uid) => {
            const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
            const existingSetting = userRes?.data?.data?.setting || {};
            await ctx.request({ url: 'users:update', method: 'post', params: { filterByTk: uid }, data: { setting: { ...existingSetting, [BLOCK_UID]: payload, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } } });
          })
        );
        const failCount = results.filter((r) => r.status === 'rejected').length;
        if (failCount === 0) { ctx.message.success(`推送成功，已推送给 ${targetUserIds.length} 位用户`); onClose(); }
        else ctx.message.warning(`部分推送失败：${failCount}/${targetUserIds.length} 位用户失败`);
      } catch (err) { ctx.message.error(`推送失败：${err?.message || '未知错误'}`); }
      finally { setPushing(false); }
    }, [userList, selectedProps, columns, buildPayload]);

    return React.createElement('div', {
      style: { position: 'fixed', top: `${anchorPos.top}px`, left: `${anchorPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', width: '380px', fontSize: `${FONT_SIZE}px` },
      onClick: (e) => e.stopPropagation(),
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', null, '📤 推送列配置给其他用户'),
        React.createElement('span', { onClick: onClose, style: { cursor: 'pointer', color: '#999', fontSize: '18px' } }, '✕'),
      ),
      React.createElement('div', { style: { marginBottom: '14px' } },
        React.createElement('div', { style: { marginBottom: '6px', fontWeight: 600 } }, '推送目标'),
        loadingUsers
          ? React.createElement('div', { style: { textAlign: 'center', padding: '8px', color: '#999' } }, '加载用户中...')
          : React.createElement('div', { style: { padding: '8px 10px', color: '#555', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' } }, `将推送给其他全部用户（${userList.length} 位）`)
      ),
      React.createElement('div', { style: { marginBottom: '16px' } },
        React.createElement('div', { style: { marginBottom: '8px', fontWeight: 600 } }, '选择推送的属性'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          PUSH_PROP_OPTIONS.map((opt) =>
            React.createElement('label', { key: opt.value, style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' } },
              React.createElement('input', { type: 'checkbox', checked: selectedProps.includes(opt.value), onChange: (e) => { if (e.target.checked) setSelectedProps((p) => [...p, opt.value]); else setSelectedProps((p) => p.filter((x) => x !== opt.value)); }, style: { cursor: 'pointer', width: '14px', height: '14px' } }),
              opt.label,
            )
          ),
        ),
      ),
      React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
        React.createElement('button', { onClick: onClose, disabled: pushing, style: { padding: '6px 16px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: pushing ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px` } }, '取消'),
        React.createElement('button', { onClick: handlePush, disabled: pushing || loadingUsers || !userList.length || !selectedProps.length, style: { padding: '6px 16px', color: '#fff', border: 'none', borderRadius: '4px', fontSize: `${FONT_SIZE}px`, fontWeight: 600, background: (pushing || loadingUsers || !userList.length || !selectedProps.length) ? '#b5d8ff' : '#1890ff', cursor: (pushing || loadingUsers || !userList.length || !selectedProps.length) ? 'not-allowed' : 'pointer' } }, pushing ? '推送中...' : '📤 推送给全部用户'),
      ),
    );
  };

  // ════════════════════════════════════════════════════════════
  // MergedTable 主组件
  // ════════════════════════════════════════════════════════════
  const MergedTable = () => {
    const [data, setData]                       = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [calcLoading, setCalcLoading]         = useState(false);
    const [calcProgress, setCalcProgress]       = useState('');
    const [refreshingData, setRefreshingData]   = useState(false);
    const [refreshProgress, setRefreshProgress] = useState('');
    const [formulaProgress, setFormulaProgress] = useState({ active: false, label: '', percent: 0 });
    const [showPanel, setShowPanel]             = useState(false);
    const [showPush, setShowPush]               = useState(false);
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [sortConfig, setSortConfig]           = useState({ key: 'daily_date', dir: 'asc' });
    const [curPage, setCurPage]                 = useState(1);
    const [pageSize, setPageSize]               = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal]                     = useState(0);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [editingCell, setEditingCell]         = useState(null);
    const [editValue, setEditValue]             = useState(null);
    const [saving, setSaving]                   = useState(false);
    const [isResizing, setIsResizing]           = useState(false);
    const [dateFilterType, setDateFilterType]   = useState('recent_future');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [competitorMasterVisible, setCompetitorMasterVisible] = useState(false);
    const [sqpTermManagerVisible, setSqpTermManagerVisible] = useState(false);
    const [dynamicKeywordCols, setDynamicKeywordCols] = useState([]);
    const [dynamicCompetitorCols, setDynamicCompetitorCols] = useState([]);
    const [dynamicColumnPrefs, setDynamicColumnPrefs] = useState({});
    const [selectedRange, setSelectedRange]     = useState(null);
    const [activeCell, setActiveCell]           = useState(null);
    const [crossHighlightEnabled, setCrossHighlightEnabled] = useState(false);
    const [crossHighlightColor, setCrossHighlightColor] = useState(DEFAULT_ACTIVE_CROSS_HIGHLIGHT_COLOR);
    const [showCrossHighlightPanel, setShowCrossHighlightPanel] = useState(false);
    const selectingRef = useRef(false);
    const hasSavedColumnPrefsRef = useRef(false);
    const manuallyResizedRef = useRef(new Set());

    const estimateTextWidth = (text, fontSize) => {
      if (text == null) return 0;
      const str = String(text);
      let width = 0;
      for (const ch of str) {
        if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(ch)) width += 1.8;
        else if (/[a-zA-Z]/.test(ch)) width += 0.9;
        else if (/[0-9]/.test(ch)) width += 0.8;
        else width += 0.6;
      }
      return width * fontSize;
    };

    const measureTextWidth = (text, fontSize, fontWeight = 600) => {
      if (text == null) return 0;
      try {
        const span = document.createElement('span');
        span.textContent = String(text);
        span.style.position = 'fixed';
        span.style.left = '-9999px';
        span.style.top = '-9999px';
        span.style.visibility = 'hidden';
        span.style.whiteSpace = 'nowrap';
        span.style.fontFamily = 'system-ui, sans-serif';
        span.style.fontSize = `${fontSize}px`;
        span.style.fontWeight = String(fontWeight);
        document.body.appendChild(span);
        const width = span.offsetWidth || span.getBoundingClientRect().width;
        document.body.removeChild(span);
        return width || estimateTextWidth(text, fontSize);
      } catch {
        return estimateTextWidth(text, fontSize);
      }
    };

    const calcKeywordColWidth = (label) => {
      return Math.max(128, Math.min(300, Math.ceil(measureTextWidth(label, FONT_SIZE_SM, 600) + 30)));
    };

    const applyDynamicColPrefs = useCallback((col) => {
      const exactPref = dynamicColumnPrefs[col.key] || {};
      const groupPref = col._competitorGroupKey ? (dynamicColumnPrefs[col._competitorGroupKey] || {}) : {};
      const pref = { ...groupPref, ...exactPref };
      const autoWidth = col.key.startsWith('kw_actual_') ? calcKeywordColWidth(col.label) : col.width;
      return {
        ...col,
        hidden: Object.prototype.hasOwnProperty.call(pref, 'hidden') ? pref.hidden === true : col.hidden,
        pinned: Object.prototype.hasOwnProperty.call(col._competitorGroupKey ? groupPref : pref, 'pinned')
          ? (col._competitorGroupKey ? groupPref : pref).pinned === true
          : col.pinned,
        width: Number(exactPref.width) || autoWidth,
        richEdit: (col._dynamicKind === 'keyword' || col._competitorField === 'rank')
          ? false
          : (Object.prototype.hasOwnProperty.call(pref, 'richEdit') ? pref.richEdit === true : col.richEdit),
        headerColor: col._dynamicKind === 'competitor'
          ? col.headerColor
          : (Object.prototype.hasOwnProperty.call(pref, 'headerColor') ? pref.headerColor : col.headerColor),
      };
    }, [dynamicColumnPrefs]);

    const resizeRef   = useRef(null);
    const dragColKey  = useRef(null);
    const inputRef    = useRef(null);
    const rootRef     = useRef(null);
    const tableWrapRef = useRef(null);
    const clipboardRef = useRef(null);
    const autoRefreshRef = useRef({ lastAt: 0, wasVisible: null });
    const recalcAllOrderLinkFormulasRef = useRef(null);
    const panelBtnRef = useRef(null);
    const pushBtnRef  = useRef(null);
    const crossHighlightBtnRef = useRef(null);
    const panelPos    = useFloatPos(panelBtnRef, showPanel);
    const pushPos     = useFloatPos(pushBtnRef, showPush);
    const crossHighlightPos = useFloatPos(crossHighlightBtnRef, showCrossHighlightPanel);

    const [urlParams, setUrlParams] = useState(() => loadUrlParams());
    const filterAsin         = urlParams?.asin    || null;
    const filterCountry      = urlParams?.country || null;
    const filterModel        = urlParams?.model   || null;
    const filterSaleOwner    = urlParams?.saleOwner || urlParams?.sale_owner || null;

    useEffect(function() {
      function setResolvedParams(search) {
        const merged = resolveParams(search);
        if (hasUrlParams(merged)) {
          saveAllParams(merged);
          writeGlobal(merged);
        }
        setUrlParams(merged);
        return merged;
      }

      function patchUrlIfNeeded(delayMs) {
        setTimeout(function() {
          const search  = getRouterSearch();
          const pathname = getRouterPathname();
          const p = parseSearch(search);
          const merged = setResolvedParams(search);

          if (needPatchSearch(p, merged)) {
            const newSearch = buildSearch(merged);
            ctx.router.navigate(pathname + newSearch, { replace: true });
          }
        }, delayMs);
      }

      const initialSearch = getRouterSearch();
      const initialParams = setResolvedParams(initialSearch);
      const ip = parseSearch(initialSearch);
      if (needPatchSearch(ip, initialParams)) {
        patchUrlIfNeeded(300);
      }

      const unsubscribe = ctx.router.subscribe && ctx.router.subscribe(function(state) {
        const search = (state.location && state.location.search) || '';
        const p = parseSearch(search);

        if (p['model'] || p['asin']) {
          saveAllParams({
            model:     p['model']      || getFromEngine(SK_MODEL),
            country:   p['country']    || getFromEngine(SK_COUNTRY),
            asin:      p['asin']       || getFromEngine(SK_ASIN),
            saleOwner: p['sale_owner'] || getFromEngine(SK_SALE_OWNER),
          });
        }

        setTimeout(function() {
          const latestSearch  = getRouterSearch();
          const latestPathname = getRouterPathname();
          const lp = parseSearch(latestSearch);
          const merged = setResolvedParams(latestSearch);

          if (needPatchSearch(lp, merged)) {
            const newSearch = buildSearch(merged);
            ctx.router.navigate(latestPathname + newSearch, { replace: true });
          }
        }, 400);
      });

      return function() {
        unsubscribe && unsubscribe();
      };
    }, []);

    const showFormulaProgress = useCallback((progress) => {
      const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
      const percent = typeof progress === 'object' && progress !== null
        ? Math.max(0, Math.min(100, Number(progress.percent) || 0))
        : 0;
      setFormulaProgress({ active: true, label, percent });
    }, []);

    const finishFormulaProgress = useCallback((label = '公式同步完成') => {
      setFormulaProgress({ active: true, label, percent: 100 });
      window.setTimeout(() => {
        setFormulaProgress({ active: false, label: '', percent: 0 });
      }, 900);
    }, []);

    const resetFormulaProgress = useCallback(() => {
      setFormulaProgress({ active: false, label: '', percent: 0 });
    }, []);

    const countryAsinOptions = useMemo(() => {
      const seen = new Set();
      const list = [];
      data.forEach((row) => {
        if (!row.country || !row.asin) return;
        const key = `${row.country}_${row.asin}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ country: row.country, asin: row.asin });
      });
      return list;
    }, [data]);

    const buildDynamicKeywordCols = useCallback((records) => {
      return [...(records || [])]
        .sort((a, b) => Number(a.id || 0) - Number(b.id || 0))
        .map((kw, idx) => {
          const label = `词${idx + 1}:${kw.keyword_name || '未命名'} 自然位`;
          return {
            key: `kw_actual_${kw.id}`,
            src: 'keyword_position',
            field: `kw_actual_${kw.id}`,
            label,
            hidden: false,
            pinned: false,
            width: calcKeywordColWidth(label),
            editable: true,
            richEdit: false,
            headerColor: idx < 4 ? '#FCC102' : '#EB6793',
            _dynamicKind: 'keyword',
            _kwId: kw.id,
            _kwName: kw.keyword_name || '未命名',
            _kwIndex: idx + 1,
          };
        });
    }, []);

    const buildDynamicCompetitorCols = useCallback((records) => {
      const cols = [];
      [...(records || [])]
        .sort((a, b) => {
          const ai = getCompetitorRoleIndex(a.role);
          const bi = getCompetitorRoleIndex(b.role);
          if (ai !== bi) return ai - bi;
          return String(a.competitor_asin || '').localeCompare(String(b.competitor_asin || ''));
        })
        .forEach((comp, compIdx) => {
          const role = comp.role || `竞对${compIdx + 1}`;
          const asinLabel = comp.competitor_asin || '未命名';
          const noteLabel = String(comp.notes || '').trim();
          const competitorCountry = comp.country || parseCountryFromCountryAsin(comp.country_asin);
          const groupKey = `competitor_dynamic_${comp.id}`;
          const groupLabel = noteLabel ? `${role}:${asinLabel}（${noteLabel}）` : `${role}:${asinLabel}`;
          COMPETITOR_SUB_FIELDS.forEach((sub, idx) => {
            cols.push({
              key: `${groupKey}_${sub.key}`,
              src: 'competitor',
              field: `${groupKey}_${sub.key}`,
              label: `${groupLabel} ${sub.label}`,
              hidden: false,
              pinned: false,
              width: sub.width,
              editable: sub.key === 'rank',
              richEdit: sub.key !== 'rank',
              headerColor: sub.headerColor,
              _dynamicKind: 'competitor',
              _competitorId: comp.id,
              _competitorRole: role,
              _competitorAsin: comp.competitor_asin || '',
              _competitorNote: noteLabel,
              _competitorCountry: competitorCountry || '',
              _competitorField: sub.key,
              _competitorGroupKey: groupKey,
              _competitorGroupLabel: groupLabel,
              _competitorGroupHeaderColor: getCompetitorColor(role),
              _competitorSubLabel: sub.label,
              _competitorSubIndex: idx,
              _isCompetitorSubColumn: true,
            });
          });
        });
      return cols;
    }, []);

    const DATE_FILTER_OPTIONS = [
    { label: '近7天及以后', value: 'recent_future' },
      { label: '全部日期',  value: 'all'        }, { label: '今天',      value: 'today'      },
      { label: '昨天',      value: 'yesterday'  }, { label: '近 7 天',   value: '7d'         },
      { label: '近 30 天',  value: '30d'        }, { label: '近 90 天',  value: '90d'        },
      { label: '本月',      value: 'this_month' }, { label: '上月',      value: 'last_month' },
      { label: '自定义',    value: 'custom'     },
    ];

    const getDateRange = useMemo(() => {
      if (dateFilterType === 'all')    return null;
      if (dateFilterType === 'custom') return customDateRange;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const todayStr = fmt(now);
      switch (dateFilterType) {
        case 'recent_future': { const d = new Date(now); d.setDate(d.getDate() - 6); return [fmt(d), null]; }
        case 'today':      return [todayStr, todayStr];
        case 'yesterday':  { const d = new Date(now); d.setDate(d.getDate() - 1); return [fmt(d), fmt(d)]; }
        case '7d':         { const d = new Date(now); d.setDate(d.getDate() - 6); return [fmt(d), todayStr]; }
        case '30d':        { const d = new Date(now); d.setDate(d.getDate() - 29); return [fmt(d), todayStr]; }
        case '90d':        { const d = new Date(now); d.setDate(d.getDate() - 89); return [fmt(d), todayStr]; }
        case 'this_month': { const d = new Date(now.getFullYear(), now.getMonth(), 1); return [fmt(d), todayStr]; }
        case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return [fmt(s), fmt(e)]; }
        default: return null;
      }
    }, [dateFilterType, customDateRange]);

    const getDefaultCollapsedGroups = useCallback(() => Object.fromEntries(
      SRC_GROUP_CONFIG.map((group) => [group.src, true])
    ), []);

    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: !prev[src] })); }, []);

    useEffect(() => {
      (async () => {
        const saved = await loadColsFromUser();
        const defaultSaved = saved ? null : await loadDefaultColsFromUser();
        const activeSaved = saved || defaultSaved;
        hasSavedColumnPrefsRef.current = Array.isArray(activeSaved) && activeSaved.length > 0;
        if (hasSavedColumnPrefsRef.current) {
          manuallyResizedRef.current = new Set(activeSaved.map((item) => item?.key).filter(Boolean));
        }
        const cols = await buildColumns();
        setColumns(cols);
      })();
    }, []);
    useEffect(() => {
      (async () => {
        const saved = await loadColsFromUser() || await loadDefaultColsFromUser();
        if (!Array.isArray(saved)) return;
        const prefs = {};
        saved.forEach((item) => {
          if (!isDynamicColumnKey(item?.key)) return;
          prefs[item.key] = {
            key: item.key,
            hidden: item.hidden === true,
            pinned: item.pinned === true,
            width: Number(item.width) || undefined,
            headerColor: item.headerColor || null,
          };
          if (Object.prototype.hasOwnProperty.call(item, 'richEdit')) prefs[item.key].richEdit = item.richEdit === true;
        });
        setDynamicColumnPrefs(prefs);
      })();
    }, []);
    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);

    const updateAndSave = useCallback((updater) => {
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveColsToUser(next);
        return next;
      });
    }, []);

    const curPageRef  = useRef(curPage);
    const pageSizeRef = useRef(pageSize);
    useEffect(() => { curPageRef.current  = curPage;  }, [curPage]);
    useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);

    const pickTotalFromResponse = (res) => {
      const count = res?.data?.meta?.count;
      return Number.isFinite(Number(count)) ? Number(count) : 0;
    };
    const fetchAllList = useCallback(async (url, params = {}, pageSize = 1000) => {
      const all = [];
      let page = 1;
      let totalCount = null;
      while (true) {
        const res = await ctx.request({
          url,
          method: 'get',
          params: {
            ...params,
            page,
            pageSize,
          },
        });
        const records = Array.isArray(res?.data?.data) ? res.data.data : [];
        all.push(...records);
        const pickedTotal = pickTotalFromResponse(res);
        if (pickedTotal > 0) totalCount = pickedTotal;
        if (!records.length || records.length < pageSize || (totalCount != null && all.length >= totalCount)) break;
        page += 1;
      }
      return all;
    }, []);

    const getDailySort = useCallback(() => {
      if (!sortConfig.key) return 'date';
      const col = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      if (col?.dbField === false) return 'date';
      if (!col || col.src !== 'daily') return 'date';
      return sortConfig.dir === 'desc' ? `-${col.field}` : col.field;
    }, [sortConfig]);

    const buildFormulaRowsFromDailyRecords = useCallback(async (dailyRecords) => {
      const records = Array.isArray(dailyRecords) ? dailyRecords : [];
      const dailyKeys = [...new Set(records.map(d => d.country_asin_date).filter(Boolean))];
      if (!dailyKeys.length) return [];

      const dailyKeyFilter = JSON.stringify({ country_asin_date: { $in: dailyKeys } });
      const weekKeyFilter = JSON.stringify({ country_asin_week: { $in: dailyKeys } });
      const countries = [...new Set(records.map(d => d.country).filter(Boolean))];
      const asins = [...new Set(records.map(d => d.asin).filter(Boolean))];
      const previousDayDates = [...new Set(records.map(d => addDays(toDateKey(d.date), -1)).filter(Boolean))];
      const priorDailyReviewFilter = JSON.stringify({
        $and: [
          { country: { $in: countries } },
          { asin: { $in: asins } },
          { date: { $in: previousDayDates } },
        ],
      });
      const asinCountryKeys = [...new Set(records.map(d => d.asin_country || toAsinCountryKey(d.asin, d.country)).filter(Boolean))];
      const pricingFilter = JSON.stringify({ asin_country: { $in: asinCountryKeys } });
      const lpDurationFilter = JSON.stringify({ asin_country: { $in: asinCountryKeys } });

      const optionalFetchAll = (url, params) => fetchAllList(url, params).catch(() => []);
      const [weeklyRecords, targetRecords, orderLinkRecords, pricingScenarioRecords, priorDailyReviewRecords, lpDurationDailyRecords] = await Promise.all([
        fetchAllList('weekly_performance:list', { filter: weekKeyFilter }),
        fetchAllList('target_management:list', { filter: dailyKeyFilter }),
        fetchAllList('daily_order_link_tracking:list', { filter: dailyKeyFilter }),
        optionalFetchAll('pricing_scenarios:list', { filter: pricingFilter }),
        optionalFetchAll('daily_asins:list', { filter: priorDailyReviewFilter }),
        optionalFetchAll('daily_asins:list', { filter: lpDurationFilter, sort: 'date' }),
      ]);

      const weeklyMap = {};
      weeklyRecords.forEach((w) => { if (w.country_asin_week) weeklyMap[w.country_asin_week] = w; });
      const targetMap = {};
      targetRecords.forEach((t) => { if (t.country_asin_date) targetMap[t.country_asin_date] = t; });
      const orderLinkMap = {};
      orderLinkRecords.forEach((o) => { if (o.country_asin_date) orderLinkMap[o.country_asin_date] = o; });
      const pricingScenarioMap = {};
      pricingScenarioRecords.forEach((p) => {
        const key = toPricingScenarioLookupKey(p.asin_country || '', p.price_with_tax, p.scenario_type);
        if (key && !pricingScenarioMap[key]) pricingScenarioMap[key] = p;
      });
      const priorDailyReviewMap = {};
      priorDailyReviewRecords.forEach((d) => {
        const key = toDailyReviewLookupKey(d.country, d.asin, d.date);
        if (key) priorDailyReviewMap[key] = d.number_of_comments;
      });
      const lpDurationMap = buildLpDurationMap(lpDurationDailyRecords);

      return records.map((d) => {
        const key = d.country_asin_date;
        const dateStr = d.date ? String(d.date).slice(0, 10) : null;
        const asinCountry = d.asin_country || toAsinCountryKey(d.asin, d.country);
        const targetData = targetMap[key] || {};
        const orderLinkData = orderLinkMap[key] || {};
        const merged = {
          ...(weeklyMap[key] || {}),
          ...targetData,
          ...orderLinkData,
          ...d,
        };
        merged.target_order_qty = targetData.target_order_qty ?? merged.target_order_qty;
        merged.order_link_real_session_conversion_rate = orderLinkData.real_session_conversion_rate;
        merged.review_count_previous_day = priorDailyReviewMap[toDailyReviewLookupKey(d.country, d.asin, addDays(dateStr, -1))] ?? null;
        merged.off = buildDailyOffValue(merged);
        merged.lp_duration_days = lpDurationMap[key] ?? null;
        merged.net_price_without_tax = getPricingScenarioNetPrice(pricingScenarioMap, asinCountry, d.price_after_discount, 'normal');
        merged.review_actual_price = getPricingScenarioNetPrice(pricingScenarioMap, asinCountry, merged.review_discounted_price, 'review');
        return merged;
      });
    }, [fetchAllList]);

    const loadAllFormulaRowsForCurrentCountryAsin = useCallback(async () => {
      if (!filterCountry || !filterAsin) {
        ctx.message.warning('需要先指定 country 和 asin，才能计算当前链接的全部数据');
        return [];
      }
      const dailyFilterAnd = [
        { country: { $eq: filterCountry } },
        { asin: { $eq: filterAsin } },
      ];
      if (currentUserLevel === 1) dailyFilterAnd.push({ sale_owner: { $eq: currentUserName } });
      const dailyRecords = await fetchAllList('daily_asins:list', {
        sort: 'date',
        filter: JSON.stringify({ $and: dailyFilterAnd }),
      });
      return buildFormulaRowsFromDailyRecords(dailyRecords);
    }, [buildFormulaRowsFromDailyRecords, currentUserLevel, currentUserName, fetchAllList, filterAsin, filterCountry]);

    const loadData = useCallback(async (options = {}) => {
      const page = options.page ?? curPageRef.current;
      const size = options.size ?? pageSizeRef.current;
      const skipFormula = options.skipFormula === true;
      try {
        setLoading(true);
        const dailyFilterAnd = [];
        if (currentUserLevel === 1) dailyFilterAnd.push({ sale_owner: { $eq: currentUserName } });
        if (filterAsin)    dailyFilterAnd.push({ asin:    { $eq: filterAsin    } });
        if (filterCountry) dailyFilterAnd.push({ country: { $eq: filterCountry } });
        const dateRange = getDateRange;
        if (dateRange) {
          if (dateRange[0]) dailyFilterAnd.push({ date: { $gte: dateRange[0] } });
          if (dateRange[1]) dailyFilterAnd.push({ date: { $lte: dateRange[1] } });
        }
        const dailySort = getDailySort();
        const dailyParams = {
          sort: dailySort,
          page,
          pageSize: size,
          ...(dailyFilterAnd.length > 0 ? { filter: JSON.stringify({ $and: dailyFilterAnd }) } : {}),
        };

        const rDaily = await ctx.request({ url: 'daily_asins:list', method: 'get', params: dailyParams });
        const dailyRecords = Array.isArray(rDaily?.data?.data) ? rDaily.data.data : [];
        const totalCount = pickTotalFromResponse(rDaily);

        const dailyKeys = [...new Set(dailyRecords.map(d => d.country_asin_date).filter(Boolean))];

        if (dailyKeys.length === 0) {
          setData([]);
          setTotal(totalCount);
          if (page > 1 && totalCount > 0) {
            const maxPage = Math.max(1, Math.ceil(totalCount / size));
            if (page > maxPage) {
              setCurPage(maxPage);
              return loadData({ page: maxPage, size, skipFormula });
            }
          }
          setLoading(false);
          return [];
        }

        const dailyKeyFilter = JSON.stringify({ country_asin_date: { $in: dailyKeys } });
        const weekKeyFilter = JSON.stringify({ country_asin_week: { $in: dailyKeys } });
        const countryAsinKeys = [...new Set(dailyRecords.map(d => d.country && d.asin ? `${d.country}_${d.asin}` : null).filter(Boolean))];
        const countryAsinFilter = JSON.stringify({ country_asin: { $in: countryAsinKeys } });
        const countries = [...new Set(dailyRecords.map(d => d.country).filter(Boolean))];
        const asins = [...new Set(dailyRecords.map(d => d.asin).filter(Boolean))];
        const previousDayDates = [...new Set(dailyRecords.map(d => addDays(toDateKey(d.date), -1)).filter(Boolean))];
        const priorDailyReviewFilter = JSON.stringify({
          $and: [
            { country: { $in: countries } },
            { asin: { $in: asins } },
            { date: { $in: previousDayDates } },
          ],
        });
        const asinCountryKeys = [...new Set(dailyRecords.map(d => d.asin_country || toAsinCountryKey(d.asin, d.country)).filter(Boolean))];
        const pricingFilter = JSON.stringify({
          asin_country: { $in: asinCountryKeys },
        });
        const lpDurationFilter = JSON.stringify({
          asin_country: { $in: asinCountryKeys },
        });

        const relatedPageSize = Math.max(size, dailyKeys.length, countryAsinKeys.length * 10, 100);
        const optionalListRequest = (promise) => promise.catch(() => ({ data: { data: [] } }));
        const optionalFetchAll = (url, params) => fetchAllList(url, params).catch(() => []);

        const [rWeekly, rTarget, rOrderLink, rSqpKeywords, rSqpKeywordPositions, rPricingScenarios, rCompetitors, rCompetitorsDaily, rPriorDailyReviews, lpDurationDailyRecords] = await Promise.all([
          ctx.request({ url: 'weekly_performance:list',          method: 'get', params: { pageSize: relatedPageSize, filter: weekKeyFilter } }),
          ctx.request({ url: 'target_management:list',           method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
          ctx.request({ url: 'daily_order_link_tracking:list',   method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
          optionalListRequest(ctx.request({ url: 'sqp_keywords:list',                method: 'get', params: { pageSize: relatedPageSize, sort: ['id'], filter: countryAsinFilter } })),
          optionalListRequest(ctx.request({ url: 'sqp_keyword_daily_positions:list', method: 'get', params: { pageSize: Math.max(dailyKeys.length * 20, 1000), filter: dailyKeyFilter } })),
          optionalListRequest(ctx.request({ url: 'pricing_scenarios:list',           method: 'get', params: { pageSize: Math.max(countryAsinKeys.length * 100, 1000), filter: pricingFilter } })),
          optionalListRequest(ctx.request({ url: 'order_link_competitor_asins:list', method: 'get', params: { pageSize: Math.max(countryAsinKeys.length * 5, 100), filter: countryAsinFilter } })),
          optionalListRequest(ctx.request({ url: 'order_link_competitor_asins_daily:list', method: 'get', params: { pageSize: Math.max(dailyKeys.length * 5, 100), filter: dailyKeyFilter } })),
          optionalListRequest(ctx.request({ url: 'daily_asins:list',                 method: 'get', params: { pageSize: Math.max(dailyRecords.length * 2, 100), filter: priorDailyReviewFilter } })),
          optionalFetchAll('daily_asins:list', { filter: lpDurationFilter, sort: 'date' }),
        ]);

        const weeklyRecords    = Array.isArray(rWeekly?.data?.data)     ? rWeekly.data.data     : [];
        const targetRecords    = Array.isArray(rTarget?.data?.data)     ? rTarget.data.data     : [];
        const orderLinkRecords = Array.isArray(rOrderLink?.data?.data)  ? rOrderLink.data.data  : [];
        const sqpKeywordRecords = Array.isArray(rSqpKeywords?.data?.data) ? rSqpKeywords.data.data : [];
        const sqpKeywordPositionRecords = Array.isArray(rSqpKeywordPositions?.data?.data) ? rSqpKeywordPositions.data.data : [];
        const pricingScenarioRecords = Array.isArray(rPricingScenarios?.data?.data) ? rPricingScenarios.data.data : [];
        const competitorRecords = Array.isArray(rCompetitors?.data?.data) ? rCompetitors.data.data : [];
        const competitorDailyRecords = Array.isArray(rCompetitorsDaily?.data?.data) ? rCompetitorsDaily.data.data : [];
        const priorDailyReviewRecords = Array.isArray(rPriorDailyReviews?.data?.data) ? rPriorDailyReviews.data.data : [];
        const lpDurationRecords = Array.isArray(lpDurationDailyRecords) ? lpDurationDailyRecords : [];

        const keywordCols = buildDynamicKeywordCols(sqpKeywordRecords);
        const competitorCols = buildDynamicCompetitorCols(competitorRecords);
        setDynamicKeywordCols(keywordCols);
        setDynamicCompetitorCols(competitorCols);

        const weeklyMap = {};
        weeklyRecords.forEach((w) => {
          if (w.country_asin_week) {
            weeklyMap[w.country_asin_week] = w;
          }
        });

        const targetMap = {};
        targetRecords.forEach((t) => {
          if (t.country_asin_date) {
            targetMap[t.country_asin_date] = t;
          }
        });

        const orderLinkMap = {};
        orderLinkRecords.forEach((o) => {
          if (o.country_asin_date) {
            orderLinkMap[o.country_asin_date] = o;
          }
        });

        const pricingScenarioMap = {};
        pricingScenarioRecords.forEach((p) => {
          const key = toPricingScenarioLookupKey(p.asin_country || '', p.price_with_tax, p.scenario_type);
          if (key && !pricingScenarioMap[key]) pricingScenarioMap[key] = p;
        });

        const sqpKeywordsByCountryAsin = {};
        sqpKeywordRecords.forEach((e) => {
          if (!e.country_asin) return;
          if (!sqpKeywordsByCountryAsin[e.country_asin]) sqpKeywordsByCountryAsin[e.country_asin] = [];
          sqpKeywordsByCountryAsin[e.country_asin].push(e);
        });

        const sqpKeywordPositionMap = {};
        sqpKeywordPositionRecords.forEach((e) => {
          const dateStr = e.date ? String(e.date).slice(0, 10) : '';
          if (e.sqp_keyword_id && dateStr) sqpKeywordPositionMap[`${e.sqp_keyword_id}_${dateStr}`] = e;
        });

        const competitorsByCountryAsin = {};
        competitorRecords.forEach((c) => {
          if (!c.country_asin) return;
          if (!competitorsByCountryAsin[c.country_asin]) competitorsByCountryAsin[c.country_asin] = [];
          competitorsByCountryAsin[c.country_asin].push(c);
        });

        const competitorDailyMap = {};
        competitorDailyRecords.forEach((c) => {
          const dateStr = c.date ? String(c.date).slice(0, 10) : '';
          if (c.competitor_id && dateStr) competitorDailyMap[`${c.competitor_id}_${dateStr}`] = c;
        });

        const priorDailyReviewMap = {};
        priorDailyReviewRecords.forEach((d) => {
          const key = toDailyReviewLookupKey(d.country, d.asin, d.date);
          if (key) priorDailyReviewMap[key] = d.number_of_comments;
        });
        const lpDurationMap = buildLpDurationMap(lpDurationRecords);

        const pricingRefreshJobs = [];
        const orderLinkFormulaRefreshJobs = [];
        const dailyFormulaRefreshJobs = [];

        const mergedData = dailyRecords.map((d) => {
          const key = d.country_asin_date;
          const weeklyData = weeklyMap[key] || {};
          const targetData = targetMap[key] || {};
          const orderLinkData = orderLinkMap[key] || {};
          const countryAsin = d.country && d.asin ? `${d.country}_${d.asin}` : null;
          const dateStr = d.date ? String(d.date).slice(0, 10) : null;

          const merged = {
            ...weeklyData,
            ...targetData,
            ...orderLinkData,
            ...d,
          };
          merged.target_order_qty = targetData.target_order_qty ?? merged.target_order_qty;
          merged.order_link_real_session_conversion_rate = orderLinkData.real_session_conversion_rate;
          merged.review_count_previous_day = priorDailyReviewMap[toDailyReviewLookupKey(d.country, d.asin, addDays(dateStr, -1))] ?? null;
          const offValue = buildDailyOffValue(merged);
          const lpDurationDays = lpDurationMap[key] ?? null;
          merged.off = offValue;
          merged.lp_duration_days = lpDurationDays;
          if (
            key &&
            (
              String(d.off ?? '') !== String(offValue ?? '') ||
              String(d.lp_duration_days ?? '') !== String(lpDurationDays ?? '')
            )
          ) {
            dailyFormulaRefreshJobs.push({
              key,
              data: {
                off: offValue,
                lp_duration_days: lpDurationDays,
              },
            });
          }
          const asinCountry = d.asin_country || toAsinCountryKey(d.asin, d.country);
          const netPriceWithoutTax = getPricingScenarioNetPrice(pricingScenarioMap, asinCountry, d.price_after_discount, 'normal');
          const reviewActualPrice = getPricingScenarioNetPrice(pricingScenarioMap, asinCountry, merged.review_discounted_price, 'review');
          merged.net_price_without_tax = netPriceWithoutTax;
          merged.review_actual_price = reviewActualPrice;
          const orderLinkFormulaUpdates = buildOrderLinkFormulaUpdates(merged);
          const { real_session_conversion_rate, ...visibleOrderLinkFormulaUpdates } = orderLinkFormulaUpdates;
          Object.assign(merged, visibleOrderLinkFormulaUpdates, {
            order_link_real_session_conversion_rate: real_session_conversion_rate,
          });
          if (
            key &&
            orderLinkData.country_asin_date &&
            (
              String(orderLinkData.net_price_without_tax ?? '') !== String(netPriceWithoutTax ?? '') ||
              String(orderLinkData.review_actual_price ?? '') !== String(reviewActualPrice ?? '')
            )
          ) {
            pricingRefreshJobs.push({
              key,
              country: d.country || null,
              asin: d.asin || null,
              date: d.date || null,
              exists: !!orderLinkData.country_asin_date,
              data: {
                net_price_without_tax: netPriceWithoutTax,
                review_actual_price: reviewActualPrice,
              },
            });
          }
          if (
            key &&
            Object.entries(orderLinkFormulaUpdates).some(([formulaField, formulaValue]) => (
              String(orderLinkData[formulaField] ?? '') !== String(formulaValue ?? '')
            ))
          ) {
            orderLinkFormulaRefreshJobs.push({
              key,
              country: d.country || null,
              asin: d.asin || null,
              date: d.date || null,
              exists: !!orderLinkData.country_asin_date,
              data: orderLinkFormulaUpdates,
            });
          }

          if (countryAsin && dateStr) {
            const rowKeywords = sqpKeywordsByCountryAsin[countryAsin] || [];
            keywordCols.forEach((col) => {
              const kw = rowKeywords.find(k => k.id === col._kwId);
              if (!kw) return;
              merged[col.field] = {
                kw,
                daily: sqpKeywordPositionMap[`${kw.id}_${dateStr}`] || {},
              };
            });

            const rowCompetitors = competitorsByCountryAsin[countryAsin] || [];
            competitorCols.forEach((col) => {
              const comp = rowCompetitors.find(c => c.id === col._competitorId);
              if (!comp) return;
              merged[col.field] = {
                competitor: comp,
                daily: competitorDailyMap[`${comp.id}_${dateStr}`] || {},
              };
            });
          }

          return merged;
        });

        setData(mergedData);
        setTotal(totalCount);
        if (skipFormula) return mergedData;

        if (dailyFormulaRefreshJobs.length) {
          await Promise.allSettled(dailyFormulaRefreshJobs.map((job) => (
            ctx.request({
              url: 'daily_asins:update',
              method: 'post',
              params: { filterByTk: job.key },
              data: job.data,
            })
          )));
        }
        if (pricingRefreshJobs.length) {
          await Promise.allSettled(pricingRefreshJobs.map((job) => {
            if (job.exists) {
              return ctx.request({
                url: 'daily_order_link_tracking:update',
                method: 'post',
                params: { filterByTk: job.key },
                data: job.data,
              });
            }
            return ctx.request({
              url: 'daily_order_link_tracking:create',
              method: 'post',
              data: withCreateTimestamps({
                country_asin_date: job.key,
                country: job.country,
                asin: job.asin,
                date: job.date,
                ...job.data,
              }),
            });
          }));
        }
        if (orderLinkFormulaRefreshJobs.length) {
          await Promise.allSettled(orderLinkFormulaRefreshJobs.map((job) => {
            if (job.exists) {
              return ctx.request({
                url: 'daily_order_link_tracking:update',
                method: 'post',
                params: { filterByTk: job.key },
                data: job.data,
              });
            }
            return ctx.request({
              url: 'daily_order_link_tracking:create',
              method: 'post',
              data: withCreateTimestamps({
                country_asin_date: job.key,
                country: job.country,
                asin: job.asin,
                date: job.date,
                ...job.data,
              }),
            });
          }));
        }
        return mergedData;
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
        return [];
      } finally { setLoading(false); }
    }, [filterAsin, filterCountry, currentUserName, currentUserLevel, getDateRange, getDailySort, fetchAllList, buildDynamicKeywordCols, buildDynamicCompetitorCols]);

    useEffect(() => { setCurPage(1); loadData({ page: 1, skipFormula: true }); }, [loadData]);

    const autoRefreshCurrentPage = useCallback(async () => {
      if (loading || refreshingData || calcLoading || saving || editingCell) return;
      const now = Date.now();
      if (now - (autoRefreshRef.current.lastAt || 0) < 3000) return;
      autoRefreshRef.current.lastAt = now;
      try {
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '切回页面，正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        const recalc = recalcAllOrderLinkFormulasRef.current;
        if (recalc) {
          showFormulaProgress({ label: '正在读取当前 ASIN / 国家全部数据...', percent: 12 });
          const rows = await loadAllFormulaRowsForCurrentCountryAsin();
          if (Array.isArray(rows) && rows.length) {
            let progressPercent = 18;
            await recalc(rows, {
              silentSuccess: true,
              onProgress: (progress) => {
                const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
                progressPercent = Math.min(95, progressPercent + 10);
                setRefreshProgress(label);
                showFormulaProgress(typeof progress === 'object' && progress !== null ? progress : { label, percent: progressPercent });
              },
            });
          }
        }
        finishFormulaProgress('切回页面刷新完成');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.warning(`切回页面自动刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshProgress('');
      }
    }, [calcLoading, editingCell, finishFormulaProgress, loadAllFormulaRowsForCurrentCountryAsin, loadData, loading, refreshingData, resetFormulaProgress, saving, showFormulaProgress]);

    const isRootVisible = useCallback(() => {
      const el = rootRef.current;
      if (!el) return true;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }, []);

    useEffect(() => {
      autoRefreshRef.current.wasVisible = isRootVisible();
      const timer = window.setInterval(() => {
        const visible = isRootVisible();
        const wasVisible = autoRefreshRef.current.wasVisible;
        autoRefreshRef.current.wasVisible = visible;
        if (visible && wasVisible === false) autoRefreshCurrentPage();
      }, 1000);
      return () => window.clearInterval(timer);
    }, [autoRefreshCurrentPage, isRootVisible]);

    const onPageChange = useCallback((page, size) => {
      if (size !== pageSizeRef.current) {
        setCurPage(1);
        setPageSize(size);
        loadData({ page: 1, size, skipFormula: true });
      } else {
        setCurPage(page);
        loadData({ page, size, skipFormula: true });
      }
    }, [loadData]);

    const handleSort = useCallback((colKey) => {
      setSortConfig((prev) => {
        if (prev.key !== colKey) return { key: colKey, dir: 'asc' };
        if (prev.dir === 'asc') return { key: colKey, dir: 'desc' };
        return { key: null, dir: null };
      });
      setCurPage(1);
    }, []);

    const sortedData = useMemo(() => {
      if (!sortConfig.key || !data.length) return data;
      const col   = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key)
        || dynamicKeywordCols.find((c) => c.key === sortConfig.key)
        || dynamicCompetitorCols.find((c) => c.key === sortConfig.key);
      const field = col ? col.field : sortConfig.key;
      const getSortValue = (row) => {
        if (col?._dynamicKind === 'keyword') return row[field]?.daily?.actual_rank;
        if (col?._dynamicKind === 'competitor') return row[field]?.daily?.[col._competitorField || 'notes'];
        return row[field];
      };
      const cleanRichText = (value) => String(value ?? '').replace(/!\[.*?\]\(.*?\)\s*/g, '').trim();
      const rankNumber = (value) => {
        const match = cleanRichText(value).match(/-?\d+(?:\.\d+)?/);
        return match ? Number(match[0]) : null;
      };
      return [...data].sort((a, b) => {
        let va = getSortValue(a), vb = getSortValue(b);
        if (ALL_NUMERIC.has(field)) { va = Number(va) || 0; vb = Number(vb) || 0; return sortConfig.dir === 'asc' ? va - vb : vb - va; }
        if (col?._dynamicKind === 'keyword' || col?._competitorField === 'rank') {
          const na = rankNumber(va);
          const nb = rankNumber(vb);
          if (na != null && nb != null && na !== nb) return sortConfig.dir === 'asc' ? na - nb : nb - na;
          if (na != null && nb == null) return sortConfig.dir === 'asc' ? -1 : 1;
          if (na == null && nb != null) return sortConfig.dir === 'asc' ? 1 : -1;
        }
        if (DATE_FIELDS.has(field)) {
          const ta = va ? new Date(va).getTime() : 0;
          const tb = vb ? new Date(vb).getTime() : 0;
          return sortConfig.dir === 'asc' ? ta - tb : tb - ta;
        }
        const cmp = cleanRichText(va).localeCompare(cleanRichText(vb)); return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }, [data, sortConfig, dynamicKeywordCols, dynamicCompetitorCols]);

    const pagedData = sortedData;

    const allColumns = useMemo(() => {
      const baseCols = columns.filter(c => !(c.field && (c.field.startsWith('kw_actual_') || c.field.startsWith('competitor_dynamic_'))));
      const keywordCols = dynamicKeywordCols.map(applyDynamicColPrefs);
      const competitorCols = dynamicCompetitorCols.map(applyDynamicColPrefs);
      const insertKeywordAfter = baseCols.findIndex(c => c.key === 'order_link_keyword_performance_screenshot');
      const withKeywords = insertKeywordAfter >= 0
        ? [...baseCols.slice(0, insertKeywordAfter + 1), ...keywordCols, ...baseCols.slice(insertKeywordAfter + 1)]
        : [...baseCols, ...keywordCols];
      const insertCompetitorAfter = withKeywords.findIndex(c => c.key === 'order_link_page_screenshot');
      return insertCompetitorAfter >= 0
        ? [...withKeywords.slice(0, insertCompetitorAfter + 1), ...competitorCols, ...withKeywords.slice(insertCompetitorAfter + 1)]
        : [...withKeywords, ...competitorCols];
    }, [columns, dynamicKeywordCols, dynamicCompetitorCols, applyDynamicColPrefs]);

    const saveCurrentAsDefaultColumns = useCallback(async () => {
      if (!IS_ADMIN) return;
      try {
        const result = await saveDefaultColsToAllUsers(allColumns);
        if (result.ok) {
          ctx.message.success(`已设为默认列配置，并同步给 ${result.total} 位用户`);
        } else {
          ctx.message.warning(`默认列配置已部分保存，失败 ${result.failCount}/${result.total} 位用户`);
        }
      } catch (err) {
        ctx.message.error(`设为默认配置失败：${err?.message || '未知错误'}`);
      }
    }, [allColumns]);

    const restoreDefaultColumns = useCallback(async () => {
      if (!currentUserId) {
        setColumns(INITIAL_COLUMNS.map((c) => ({ ...c })));
        setDynamicColumnPrefs({});
        return;
      }
      try {
        const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
        const existingSetting = userRes?.data?.data?.setting || {};
        const defaultPayload = existingSetting[DEFAULT_COLUMNS_KEY];
        const nextSetting = { ...existingSetting };
        delete nextSetting[BLOCK_UID];
        await ctx.request({
          url: 'users:update',
          method: 'post',
          params: { filterByTk: currentUserId },
          data: { setting: nextSetting },
        });

        const nextColumns = Array.isArray(defaultPayload) && defaultPayload.length
          ? mergeColumnsWithInitial(defaultPayload)
          : INITIAL_COLUMNS.map((c) => ({ ...c }));
        const nextDynamicPrefs = {};
        if (Array.isArray(defaultPayload)) {
          defaultPayload.forEach((item) => {
            if (!isDynamicColumnKey(item?.key)) return;
            nextDynamicPrefs[item.key] = {
              key: item.key,
              hidden: item.hidden === true,
              pinned: item.pinned === true,
              width: Number(item.width) || undefined,
              headerColor: item.headerColor || null,
            };
          });
        }
        setDynamicColumnPrefs(nextDynamicPrefs);
        setColumns(nextColumns);
        ctx.message.success('已恢复默认列配置');
      } catch (err) {
        ctx.message.error(`恢复默认配置失败：${err?.message || '未知错误'}`);
      }
    }, []);

    const persistDynamicColPrefs = useCallback((key, patch) => {
      if (!isDynamicColumnKey(key)) return;
        setDynamicColumnPrefs((prev) => {
        const next = { ...prev, [key]: { ...(prev[key] || {}), key, ...patch } };
        const dynamicCols = Object.values(next).filter((item) => isDynamicColumnKey(item?.key));
        saveColsToUser(dynamicCols);
        return next;
      });
    }, []);

    const updateDynamicCol = (key, updater) => {
      const setFn = key.startsWith('kw_actual_') ? setDynamicKeywordCols : key.startsWith('competitor_dynamic_') ? setDynamicCompetitorCols : null;
      if (!setFn) return false;
      setFn(prev => prev.map(c => c.key === key ? updater(c) : c));
      return true;
    };

    const toggleCol      = (key) => { const cur = allColumns.find(c => c.key === key); if (updateDynamicCol(key, c => ({ ...c, hidden: !c.hidden }))) { persistDynamicColPrefs(key, { hidden: !(cur?.hidden === true), width: cur?.width, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null }); return; } updateAndSave((p) => { const col = p.find((c) => c.key === key); if (!col) return p; if (!col.hidden) return p.map((c) => c.key === key ? { ...c, hidden: true } : c); return [...p.filter((c) => c.key !== key), { ...col, hidden: false }]; }); };
    const togglePin      = (key) => { const cur = allColumns.find(c => c.key === key); if (cur?._competitorGroupKey) { const nextPinned = !(cur.pinned === true); setDynamicCompetitorCols(prev => prev.map(c => c._competitorGroupKey === cur._competitorGroupKey ? { ...c, pinned: nextPinned } : c)); persistDynamicColPrefs(cur._competitorGroupKey, { pinned: nextPinned, hidden: cur?.hidden === true, headerColor: cur?.headerColor || null }); return; } if (updateDynamicCol(key, c => ({ ...c, pinned: !c.pinned }))) { persistDynamicColPrefs(key, { pinned: !(cur?.pinned === true), width: cur?.width, hidden: cur?.hidden === true, headerColor: cur?.headerColor || null }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c)); };
    const setHColor      = (key, color) => { const cur = allColumns.find(c => c.key === key); if (updateDynamicCol(key, c => ({ ...c, headerColor: color }))) { persistDynamicColPrefs(key, { headerColor: color, width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c)); };
    const clearHColor    = (key) => { const cur = allColumns.find(c => c.key === key); if (updateDynamicCol(key, c => ({ ...c, headerColor: null }))) { persistDynamicColPrefs(key, { headerColor: null, width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c)); };
    const toggleEditable = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c));
    const selectAll      = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: false })));
    const deselectAll    = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: true  })));

    const visibleCols   = useMemo(() => { const vis = allColumns.filter((c) => !c.hidden && c.src !== 'tool'); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [allColumns]);
    const hasCompetitorColumns = useMemo(() => visibleCols.some((c) => c._isCompetitorSubColumn), [visibleCols]);
    const HEADER_MAIN_HEIGHT = 30;
    const HEADER_SUB_HEIGHT = 24;
    const TABLE_VISIBLE_ROWS = 10;
    const TABLE_BODY_ROW_HEIGHT = 66;
    const tableWrapHeight = HEADER_MAIN_HEIGHT + (hasCompetitorColumns ? HEADER_SUB_HEIGHT : 0) + TABLE_BODY_ROW_HEIGHT * TABLE_VISIBLE_ROWS + 2;
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += col.width || 80; } }); return map; }, [visibleCols]);

    const scrollToIndexLeft = useCallback((left) => {
      const wrap = tableWrapRef.current;
      if (!wrap) return;
      const pinnedWidth = visibleCols.filter((col) => col.pinned).reduce((sum, col) => sum + (col.width || 80), 0);
      const nextLeft = Math.max(0, left - pinnedWidth);
      wrap.scrollTo?.({ left: nextLeft, behavior: 'smooth' });
      if (!wrap.scrollTo) wrap.scrollLeft = nextLeft;
      try {
        wrap.focus({ preventScroll: true });
      } catch {
        wrap.focus?.();
      }
    }, [visibleCols]);

    const columnIndexGroups = useMemo(() => {
      const keywordItems = [];
      const seenCompetitors = new Set();
      const competitorItems = [];
      let left = 0;

      visibleCols.forEach((col, idx) => {
        if (col._dynamicKind === 'keyword') {
          keywordItems.push({
            key: col.key,
            label: `词${col._kwIndex || keywordItems.length + 1}：${col._kwName || col.label || '未命名'}`,
            type: 'keyword',
            left,
          });
        }

        if (col._competitorGroupKey && !seenCompetitors.has(col._competitorGroupKey)) {
          seenCompetitors.add(col._competitorGroupKey);
          const roleIndex = getCompetitorRoleIndex(col._competitorGroupLabel);
          const fallbackIndex = competitorItems.length + 1;
          const asinLabel = String(col._competitorGroupLabel || col.label || '未命名').split(':').slice(1).join(':') || col._competitorGroupLabel || col.label || '未命名';
          competitorItems.push({
            key: col._competitorGroupKey,
            label: `竞对ASIN${Number.isFinite(roleIndex) && roleIndex !== 9999 ? roleIndex : fallbackIndex}：${asinLabel}`,
            type: 'competitor',
            left,
          });
        }

        left += col.width || 80;
      });

      return { keywordItems, competitorItems };
    }, [visibleCols]);

    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();
    const onDrop      = (e, targetKey) => { e.preventDefault(); const fromKey = dragColKey.current; if (!fromKey || fromKey === targetKey) return; if (fromKey.startsWith('kw_actual_') || fromKey.startsWith('competitor_dynamic_') || targetKey.startsWith('kw_actual_') || targetKey.startsWith('competitor_dynamic_')) { dragColKey.current = null; return; } updateAndSave((prev) => { const next = [...prev]; const fi = next.findIndex((c) => c.key === fromKey); const ti = next.findIndex((c) => c.key === targetKey); if (fi < 0 || ti < 0) return prev; const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved); return next; }); dragColKey.current = null; };

    const onResizeStart = useCallback((e, colKey) => { e.preventDefault(); e.stopPropagation(); const col = allColumns.find((c) => c.key === colKey); resizeRef.current = { colKey, startX: e.clientX, startWidth: col?.width || 80 }; setIsResizing(true); manuallyResizedRef.current.add(colKey); }, [allColumns]);
    const onOverlayMove = useCallback((e) => {
      if (!resizeRef.current) return;
      const { colKey, startX, startWidth } = resizeRef.current;
      const nw = Math.max(40, startWidth + (e.clientX - startX));
      resizeRef.current.lastWidth = nw;
      if (updateDynamicCol(colKey, c => ({ ...c, width: nw }))) return;
      setColumns((p) => p.map((c) => c.key === colKey ? { ...c, width: nw } : c));
    }, []);
    const onOverlayUp   = useCallback(() => {
      const info = resizeRef.current;
      if (info?.colKey && isDynamicColumnKey(info.colKey)) {
        const cur = allColumns.find(c => c.key === info.colKey);
        persistDynamicColPrefs(info.colKey, {
          width: Number(info.lastWidth) || cur?.width,
          hidden: cur?.hidden === true,
          pinned: cur?.pinned === true,
          headerColor: cur?.headerColor || null,
        });
      } else if (info?.colKey) {
        setColumns((prev) => {
          const next = prev.map((c) => c.key === info.colKey ? { ...c, width: Number(info.lastWidth) || c.width } : c);
          saveColsToUser(next);
          return next;
        });
      }
      resizeRef.current = null;
      setIsResizing(false);
    }, [allColumns, persistDynamicColPrefs]);

    const isCellEditable = useCallback((col) => {
      if (col?._dynamicKind === 'keyword') return col.editable === true;
      if (col?._dynamicKind === 'competitor') return col._competitorField === 'rank' && col.editable === true;
      if (READONLY_FIELDS.has(col.field)) return false;
      return col.editable === true;
    }, []);

    const getEditableValue = useCallback((row, col) => {
      if (col?._dynamicKind === 'keyword') return row?.[col.field]?.daily?.actual_rank;
      if (col?._dynamicKind === 'competitor') return row?.[col.field]?.daily?.[col._competitorField || 'notes'];
      return row?.[col.field];
    }, []);

    const normalizeSelection = useCallback((range) => {
      if (!range) return null;
      const r1 = Math.min(range.start.r, range.end.r);
      const r2 = Math.max(range.start.r, range.end.r);
      const c1 = Math.min(range.start.c, range.end.c);
      const c2 = Math.max(range.start.c, range.end.c);
      return { r1, r2, c1, c2 };
    }, []);

    const isCellSelected = useCallback((r, c) => {
      const rect = normalizeSelection(selectedRange);
      return !!rect && r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2;
    }, [normalizeSelection, selectedRange]);

    const isActiveCrossCell = useCallback((r, c) => {
      if (!crossHighlightEnabled || !activeCell) return false;
      return r === activeCell.r || c === activeCell.c;
    }, [activeCell, crossHighlightEnabled]);

    const getBodyCellBackground = useCallback((r, c, selected) => {
      if (selected) return '#e6f4ff';
      if (isActiveCrossCell(r, c)) return crossHighlightColor;
      return r % 2 === 0 ? '#fff' : '#fafafa';
    }, [crossHighlightColor, isActiveCrossCell]);

    const getClipboardValue = useCallback((col, row) => {
      if (col?._dynamicKind === 'keyword') return String(row?.[col.field]?.daily?.actual_rank || '');
      if (col?._dynamicKind === 'competitor') return String(row?.[col.field]?.daily?.[col._competitorField || 'notes'] || '');
      const value = row?.[col.field];
      if (value == null || value === '') return '';
      if (RATE_FIELDS.has(col.field)) return String(Number(value) * 100);
      if (DATE_FIELDS.has(col.field)) return String(value).slice(0, 10);
      return String(value);
    }, []);

    const parsePastedValue = useCallback((col, rawValue) => {
      const text = String(rawValue ?? '').trim();
      if (text === '') return null;
      if (RATE_FIELDS.has(col.field)) {
        const num = Number(text.replace('%', '').replace(/,/g, ''));
        return !isNaN(num) ? num / 100 : null;
      }
      if (MONEY_FIELDS.has(col.field) || NUM_FIELDS.has(col.field)) {
        const num = Number(text.replace(/,/g, ''));
        return !isNaN(num) ? num : null;
      }
      if (DATE_FIELDS.has(col.field)) return text || null;
      return text;
    }, []);

    const round4 = useCallback((value) => {
      return value == null ? null : Math.round(value * 10000) / 10000;
    }, []);

    const buildOrderLinkFormulaUpdates = useCallback((row) => {
      const orderItems  = toFormulaNumber(row.order_items);
      const rsgNumber   = toFormulaNumber(row.rsg_number);
      const guanggaodan = toFormulaNumber(row.guanggaodan);
      const traffic     = toFormulaNumber(row.zongliuliang);
      const pageViews   = toFormulaNumber(row.page_views_total);
      const targetOrderQty = toFormulaNumber(row.target_order_qty);
      const netPriceWithoutTax = toFormulaNumber(row.net_price_without_tax);
      const reviewActualPrice = toFormulaNumber(row.review_actual_price);
      const reviewCount = toFormulaNumber(row.number_of_comments);
      const reviewCountPreviousDay = toFormulaNumber(row.review_count_previous_day);

      // ②站内:纯自然+广告单 = weekly_performance.order_items - daily_asins.rsg_number
      const totalOnsiteOrders =
        orderItems == null || rsgNumber == null
          ? null
          : orderItems - rsgNumber;

      // ③站内纯自然单 = daily_order_link_tracking.total_onsite_orders - weekly_performance.guanggaodan
      const onsiteOrganicOrders =
        totalOnsiteOrders == null || guanggaodan == null
          ? null
          : totalOnsiteOrders - guanggaodan;

      const onsiteAdOrders = guanggaodan == null ? null : guanggaodan;

      const reviewOrdersRatio =
        rsgNumber == null || orderItems == null || orderItems === 0
          ? null
          : rsgNumber / orderItems;

      const formulaReviewRate =
        reviewCount == null || reviewCountPreviousDay == null || orderItems == null || orderItems === 0
          ? null
          : (reviewCount - reviewCountPreviousDay) / orderItems;

      const onsiteOrdersRatio =
        totalOnsiteOrders == null || orderItems == null || orderItems === 0
          ? null
          : totalOnsiteOrders / orderItems;

      const onsiteOrganicOrdersRatio =
        onsiteOrganicOrders == null || orderItems == null || orderItems === 0
          ? null
          : onsiteOrganicOrders / orderItems;

      const onsiteAdOrdersRatio =
        onsiteAdOrders == null || orderItems == null || orderItems === 0
          ? null
          : onsiteAdOrders / orderItems;

      const realSessionConversionRate =
        orderItems == null || rsgNumber == null || traffic == null || traffic === 0
          ? null
          : round4((orderItems - rsgNumber) / traffic);

      const pageViewConversionRate =
        orderItems == null || pageViews == null || pageViews === 0
          ? null
          : orderItems / pageViews;

      const targetGap =
        orderItems == null || targetOrderQty == null
          ? null
          : orderItems - targetOrderQty;

      return {
        total_onsite_orders: totalOnsiteOrders,
        onsite_organic_orders: onsiteOrganicOrders,
        onsite_ad_orders: onsiteAdOrders,
        review_orders_ratio: reviewOrdersRatio,
        formula_review_rate: formulaReviewRate,
        onsite_orders_ratio: onsiteOrdersRatio,
        onsite_organic_orders_ratio: onsiteOrganicOrdersRatio,
        onsite_ad_orders_ratio: onsiteAdOrdersRatio,
        real_session_conversion_rate: realSessionConversionRate,
        page_view_conversion_rate: pageViewConversionRate,
        target_gap: targetGap,
        net_price_without_tax: netPriceWithoutTax,
        review_actual_price: reviewActualPrice,
      };
    }, [round4]);

    const isFormulaBlankLike = useCallback((value) => value === null || value === undefined || value === '', []);
    const toComparableFormulaNumber = useCallback((value) => {
      if (isFormulaBlankLike(value)) return null;
      const num = Number(value);
      return Number.isFinite(num) ? num : null;
    }, [isFormulaBlankLike]);
    const isSameFormulaValue = useCallback((current, next) => {
      if (isFormulaBlankLike(current) && isFormulaBlankLike(next)) return true;
      const currentNumber = toComparableFormulaNumber(current);
      const nextNumber = toComparableFormulaNumber(next);
      if (currentNumber != null && nextNumber != null) {
        return Math.abs(currentNumber - nextNumber) < 0.000001;
      }
      return String(current ?? '').trim() === String(next ?? '').trim();
    }, [isFormulaBlankLike, toComparableFormulaNumber]);
    const pickChangedFormulaFields = useCallback((current, updates) => {
      const changed = {};
      Object.entries(updates || {}).forEach(([field, value]) => {
        if (!isSameFormulaValue(current?.[field], value)) changed[field] = value;
      });
      return changed;
    }, [isSameFormulaValue]);

    const syncDailyFormulaForRow = useCallback(async (row) => {
      const key = row?.country_asin_date || row?.id;
      if (!key) return null;

      const asinCountry = row?.asin_country || toAsinCountryKey(row?.asin, row?.country);
      let lpDurationDays = null;
      if (asinCountry) {
        const filter = JSON.stringify({ asin_country: { $eq: asinCountry } });
        const dailyRows = await fetchAllList('daily_asins:list', { filter, sort: 'date' }).catch(() => []);
        const lpDurationMap = buildLpDurationMap(dailyRows);
        lpDurationDays = lpDurationMap[key] ?? null;
      }

      const offValue = buildDailyOffValue(row);
      const updates = {
        off: offValue,
        lp_duration_days: lpDurationDays,
      };

      await ctx.request({
        url: 'daily_asins:update',
        method: 'post',
        params: { filterByTk: key },
        data: updates,
      });

      return updates;
    }, [fetchAllList]);

    const fetchPricingScenarioNetPriceForRow = useCallback(async (row, scenarioType) => {
      const asinCountry = row?.asin_country || toAsinCountryKey(row?.asin, row?.country);
      const scenarioKey = toScenarioTypeKey(scenarioType);
      const lookupPrice = scenarioKey === 'review' ? row?.review_discounted_price : row?.price_after_discount;
      const priceKey = toPriceKey(lookupPrice);
      if (!asinCountry || !priceKey || !scenarioKey) return null;

      const pricingFilter = JSON.stringify({
        $and: [
          { asin_country: { $eq: asinCountry } },
          { scenario_type: { $eq: scenarioKey } },
        ],
      });

      const res = await ctx.request({
        url: 'pricing_scenarios:list',
        method: 'get',
        params: {
          pageSize: 1000,
          filter: pricingFilter,
        },
      });

      const records = Array.isArray(res?.data?.data) ? res.data.data : [];
      const matched = records.find((p) => (
        toPriceKey(p.price_with_tax) === priceKey &&
        toScenarioTypeKey(p.scenario_type) === scenarioKey
      ));
      return matched?.net_price ?? null;
    }, []);

    const fetchReviewCountPreviousDayForRow = useCallback(async (row) => {
      const country = row?.country || null;
      const asin = row?.asin || null;
      const previousDay = addDays(toDateKey(row?.date), -1);
      if (!country || !asin || !previousDay) return null;

      const filter = JSON.stringify({
        $and: [
          { country: { $eq: country } },
          { asin: { $eq: asin } },
          { date: { $eq: previousDay } },
        ],
      });

      const res = await ctx.request({
        url: 'daily_asins:list',
        method: 'get',
        params: {
          filter,
          pageSize: 1,
        },
      });

      const record = Array.isArray(res?.data?.data) ? res.data.data[0] : null;
      return record?.number_of_comments ?? null;
    }, []);

    const syncOrderLinkFormulaForRow = useCallback(async (row) => {
      const key = row?.country_asin_date || row?.id;
      if (!key) return null;

      const [refreshedNetPriceWithoutTax, refreshedReviewActualPrice] = await Promise.all([
        fetchPricingScenarioNetPriceForRow(row, 'normal'),
        fetchPricingScenarioNetPriceForRow(row, 'review'),
      ]);
      const refreshedReviewCountPreviousDay = await fetchReviewCountPreviousDayForRow(row);
      const updates = buildOrderLinkFormulaUpdates({
        ...row,
        net_price_without_tax: refreshedNetPriceWithoutTax,
        review_actual_price: refreshedReviewActualPrice,
        review_count_previous_day: refreshedReviewCountPreviousDay,
      });

      const filterStr = JSON.stringify({
        country_asin_date: { $eq: key },
      });

      const res = await ctx.request({
        url: 'daily_order_link_tracking:list',
        method: 'get',
        params: {
          filter: filterStr,
          pageSize: 1,
        },
      });

      const existing = res?.data?.data?.[0];

      if (existing) {
        await ctx.request({
          url: 'daily_order_link_tracking:update',
          method: 'post',
          params: { filterByTk: key },
          data: updates,
        });
      } else {
        await ctx.request({
          url: 'daily_order_link_tracking:create',
          method: 'post',
          data: withCreateTimestamps({
            country_asin_date: key,
            country: row.country || null,
            asin: row.asin || null,
            date: row.date || null,
            ...updates,
          }),
        });
      }

      const { real_session_conversion_rate, ...visibleUpdates } = updates;
      return {
        ...visibleUpdates,
        order_link_real_session_conversion_rate: real_session_conversion_rate,
      };
    }, [buildOrderLinkFormulaUpdates, fetchPricingScenarioNetPriceForRow, fetchReviewCountPreviousDayForRow]);

    const syncFormulaForRow = useCallback(async (row) => {
      return syncOrderLinkFormulaForRow(row);
    }, [syncOrderLinkFormulaForRow]);

    const focusClipboardWithoutScroll = useCallback(() => {
      const el = clipboardRef.current;
      if (!el) return;

      const wrap = tableWrapRef.current;
      const scrollTop = wrap?.scrollTop ?? 0;
      const scrollLeft = wrap?.scrollLeft ?? 0;

      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }

      if (wrap) {
        wrap.scrollTop = scrollTop;
        wrap.scrollLeft = scrollLeft;
      }
    }, []);

    
    const handleCellMouseDown = useCallback((e, r, c) => {
      if (e.button !== 0 || isResizing || editingCell) return;

      const tag = String(e.target?.tagName || '').toLowerCase();
      const closestEl = e.target?.closest?.('.ant-picker, .ant-select, .ant-input-number');

      if (['input', 'textarea', 'select', 'button'].includes(tag) || closestEl) return;

      selectingRef.current = true;
      setActiveCell({ r, c });
      setSelectedRange({ start: { r, c }, end: { r, c } });

      focusClipboardWithoutScroll();

      e.preventDefault();
    }, [editingCell, isResizing, focusClipboardWithoutScroll]);

    const handleCellMouseEnter = useCallback((r, c) => {
      if (!selectingRef.current) return;
      setSelectedRange((prev) => prev ? { ...prev, end: { r, c } } : prev);
    }, []);

    const stopSelecting = useCallback(() => {
      selectingRef.current = false;
    }, []);

    const handleCopy = useCallback((e) => {
      const target = e.target;
      if (
        target !== clipboardRef.current &&
        target?.closest?.('textarea, input, [contenteditable="true"], .ant-input, .ant-input-number, .ant-select, .ant-picker')
      ) {
        return;
      }
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;
      const lines = [];
      for (let r = rect.r1; r <= rect.r2; r++) {
        const row = pagedData[r];
        const cells = [];
        for (let c = rect.c1; c <= rect.c2; c++) {
          const col = visibleCols[c];
          cells.push(col && row ? getClipboardValue(col, row) : '');
        }
        lines.push(cells.join('\t'));
      }
      e.clipboardData.setData('text/plain', lines.join('\n'));
      e.preventDefault();
      ctx.message.success('已复制选区');
    }, [getClipboardValue, normalizeSelection, pagedData, selectedRange, visibleCols]);

    const syncFormulaPatches = useCallback(async (localPatches, recalcRows, dailyRecalcRows, options = {}) => {
      const formulaPatchMap = new Map();
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
      const dailyRows = [...(dailyRecalcRows || [])];
      const orderLinkRows = [...(recalcRows || [])];
      const totalRows = dailyRows.length + orderLinkRows.length;
      let doneRows = 0;
      const reportProgress = (label) => {
        if (!onProgress || !totalRows) return;
        doneRows += 1;
        onProgress({ label, percent: Math.min(95, 10 + (doneRows / totalRows) * 85) });
      };

      for (const rowId of dailyRows) {
        const baseRow = data.find((r) => (r.country_asin_date || r.id) === rowId);
        const localPatch = localPatches.get(rowId) || {};
        if (!baseRow) continue;

        const formulaUpdates = await syncDailyFormulaForRow({
          ...baseRow,
          ...localPatch,
        });

        if (formulaUpdates) {
          formulaPatchMap.set(rowId, {
            ...(formulaPatchMap.get(rowId) || {}),
            ...formulaUpdates,
          });
        }
        reportProgress('正在同步每日公式...');
      }

      for (const rowId of orderLinkRows) {
        const baseRow = data.find((r) => (r.country_asin_date || r.id) === rowId);
        const localPatch = localPatches.get(rowId) || {};
        if (!baseRow) continue;

        const formulaUpdates = await syncFormulaForRow({
          ...baseRow,
          ...localPatch,
        });

        if (formulaUpdates) {
          formulaPatchMap.set(rowId, {
            ...(formulaPatchMap.get(rowId) || {}),
            ...formulaUpdates,
          });
        }
        reportProgress('正在同步订单链接公式...');
      }

      return formulaPatchMap;
    }, [data, syncDailyFormulaForRow, syncFormulaForRow]);

    const handlePaste = useCallback(async (e) => {
      if (editingCell || saving) return;
      const target = e.target;
      if (
        target !== clipboardRef.current &&
        target?.closest?.('textarea, input, [contenteditable="true"], .ant-input, .ant-input-number, .ant-select, .ant-picker')
      ) {
        return;
      }
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;

      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      e.preventDefault();

      const matrix = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((line) => line.split('\t'));
      while (matrix.length && matrix[matrix.length - 1].length === 1 && matrix[matrix.length - 1][0] === '') matrix.pop();
      if (!matrix.length) return;

      const ops = [];
      const richOps = [];
      const localPatches = new Map();
      const recalcRows = new Set();
      const dailyRecalcRows = new Set();
      const isSingleValuePaste = matrix.length === 1 && matrix[0].length === 1;
      const targetRows = isSingleValuePaste
        ? Array.from({ length: rect.r2 - rect.r1 + 1 }, () => matrix[0])
        : matrix;

      targetRows.forEach((line, rr) => {
        const targetColCount = isSingleValuePaste ? (rect.c2 - rect.c1 + 1) : line.length;
        for (let cc = 0; cc < targetColCount; cc += 1) {
          const cellText = isSingleValuePaste ? matrix[0][0] : line[cc];
          const row = pagedData[rect.r1 + rr];
          const col = visibleCols[rect.c1 + cc];
          if (!row || !col) continue;
          const rowId = row.country_asin_date || row.id;
          if (!rowId) continue;

          if (col._dynamicKind === 'keyword') {
            const payload = row[col.field];
            const kw = payload?.kw;
            const daily = payload?.daily || {};
            if (!kw?.id) continue;
            richOps.push({
              type: 'keyword',
              rowId,
              colField: col.field,
              daily,
              dailyId: daily.id,
              kwId: kw.id,
              country: row.country || null,
              asin: row.asin || null,
              date: row.date ? String(row.date).slice(0, 10) : null,
              valueToSave: String(cellText ?? '').trim() || null,
            });
            continue;
          }

          if (col._dynamicKind === 'competitor') {
            const payload = row[col.field];
            const competitor = payload?.competitor;
            const daily = payload?.daily || {};
            if (!competitor?.id) continue;
            richOps.push({
              type: 'competitor',
              rowId,
              colField: col.field,
              daily,
              dailyId: daily.id,
              competitorId: competitor.id,
              field: col._competitorField || 'notes',
              date: row.date ? String(row.date).slice(0, 10) : null,
              valueToSave: String(cellText ?? '').trim() || null,
            });
            continue;
          }

          if (RICH_TEXT_FIELDS.has(col.field)) {
            const valueToSave = String(cellText ?? '').trim() || null;
            richOps.push({
              type: 'order_link_rich',
              rowId,
              field: col.field,
              country: row.country || null,
              asin: row.asin || null,
              date: row.date || null,
              valueToSave,
            });
            localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: valueToSave });
            continue;
          }

          if (!isCellEditable(col)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) continue;
          const valueToSave = parsePastedValue(col, cellText);
          ops.push({ rowId, field: col.field, updateConfig, pkValue, valueToSave });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: valueToSave });
          if (ORDER_LINK_FORMULA_TRIGGER_FIELDS.has(col.field)) {
            recalcRows.add(rowId);
          }
          if (DAILY_FORMULA_TRIGGER_FIELDS.has(col.field)) {
            dailyRecalcRows.add(rowId);
          }

        }
      });

      if (!ops.length && !richOps.length) {
        ctx.message.warning('粘贴区域没有可编辑单元格');
        return;
      }

      try {
        setSaving(true);
        const richPatchItems = [];
        for (const op of ops) {
          await ctx.request({
            url: op.updateConfig.url,
            method: 'post',
            params: { filterByTk: op.pkValue },
            data: { [op.field]: op.valueToSave },
          });
        }
        for (const op of richOps) {
          if (op.type === 'keyword') {
            let nextDaily = { ...op.daily, actual_rank: op.valueToSave };
            if (op.dailyId) {
              await ctx.request({
                url: 'sqp_keyword_daily_positions:update',
                method: 'post',
                params: { filterByTk: op.dailyId },
                data: { actual_rank: op.valueToSave },
              });
            } else {
              const countryAsin = op.country && op.asin ? `${op.country}_${op.asin}` : null;
              const res = await ctx.request({
                url: 'sqp_keyword_daily_positions:create',
                method: 'post',
                data: withCreateTimestamps({
                  country_asin_date: op.rowId,
                  country_asin: countryAsin,
                  country: op.country,
                  asin: op.asin,
                  sqp_keyword_id: op.kwId,
                  date: op.date,
                  actual_rank: op.valueToSave,
                }),
              });
              nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
            }
            richPatchItems.push({ rowId: op.rowId, colField: op.colField, field: 'actual_rank', daily: nextDaily });
            continue;
          }

          if (op.type === 'order_link_rich') {
            const filterStr = JSON.stringify({ country_asin_date: { $eq: op.rowId } });
            const existingRes = await ctx.request({
              url: 'daily_order_link_tracking:list',
              method: 'get',
              params: { filter: filterStr, pageSize: 1 },
            });
            const existing = Array.isArray(existingRes?.data?.data) ? existingRes.data.data[0] : null;
            if (existing) {
              await ctx.request({
                url: 'daily_order_link_tracking:update',
                method: 'post',
                params: { filterByTk: op.rowId },
                data: { [op.field]: op.valueToSave },
              });
            } else {
              await ctx.request({
                url: 'daily_order_link_tracking:create',
                method: 'post',
                data: withCreateTimestamps({
                  country_asin_date: op.rowId,
                  country: op.country,
                  asin: op.asin,
                  date: op.date,
                  [op.field]: op.valueToSave,
                }),
              });
            }
            continue;
          }

          let nextDaily = { ...op.daily, [op.field]: op.valueToSave };
          if (op.dailyId) {
            await ctx.request({
              url: 'order_link_competitor_asins_daily:update',
              method: 'post',
              params: { filterByTk: op.dailyId },
              data: { [op.field]: op.valueToSave },
            });
          } else {
            const res = await ctx.request({
              url: 'order_link_competitor_asins_daily:create',
              method: 'post',
              data: withCreateTimestamps({
                country_asin_date: op.rowId,
                competitor_id: op.competitorId,
                date: op.date,
                [op.field]: op.valueToSave,
              }),
            });
            nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
          }
          richPatchItems.push({ rowId: op.rowId, colField: op.colField, field: op.field, daily: nextDaily });
        }

        const formulaRows = new Set([...recalcRows, ...dailyRecalcRows]);
        if (formulaRows.size) {
          showFormulaProgress({ label: '粘贴已保存，正在同步公式...', percent: 8 });
        }
        const formulaPatchMap = await syncFormulaPatches(localPatches, recalcRows, dailyRecalcRows, { onProgress: showFormulaProgress });

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          const formulaPatch = formulaPatchMap.get(rowId);
          const rowRichPatches = richPatchItems.filter((p) => p.rowId === rowId);

          let nextRow = patch || formulaPatch
            ? {
                ...row,
                ...(patch || {}),
                ...(formulaPatch || {}),
              }
            : row;

          if (rowRichPatches.length) {
            nextRow = nextRow === row ? { ...row } : nextRow;
            rowRichPatches.forEach((p) => {
              const payload = nextRow[p.colField];
              if (!payload) return;
              nextRow[p.colField] = {
                ...payload,
                daily: p.daily,
              };
            });
          }

          return nextRow;
        }));

        if (formulaRows.size) finishFormulaProgress('粘贴公式同步完成');
        const totalOps = ops.length + richOps.length;
        ctx.message.success(
          recalcRows.size || dailyRecalcRows.size
            ? `已粘贴 ${totalOps} 个单元格，已同步 ${new Set([...recalcRows, ...dailyRecalcRows]).size} 行公式`
            : `已粘贴 ${totalOps} 个单元格`
        );

      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [editingCell, finishFormulaProgress, isCellEditable, normalizeSelection, pagedData, parsePastedValue, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulaPatches, visibleCols]);

    const clearSelectedCells = useCallback(async () => {
      if (editingCell || saving) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;

      const ops = [];
      const richOps = [];
      const localPatches = new Map();
      const richLocalPatches = [];
      const recalcRows = new Set();
      const dailyRecalcRows = new Set();

      for (let r = rect.r1; r <= rect.r2; r += 1) {
        const row = pagedData[r];
        if (!row) continue;
        for (let c = rect.c1; c <= rect.c2; c += 1) {
          const col = visibleCols[c];
          if (!col) continue;
          const rowId = row.country_asin_date || row.id;
          if (!rowId) continue;

          if (col._dynamicKind === 'keyword') {
            const payload = row[col.field];
            const daily = payload?.daily || {};
            if (!daily.id) continue;
            richOps.push({
              type: 'keyword',
              rowId,
              colField: col.field,
              dailyId: daily.id,
              field: 'actual_rank',
              valueToSave: null,
            });
            richLocalPatches.push({ rowId, colField: col.field, field: 'actual_rank', valueToSave: null });
            continue;
          }

          if (col._dynamicKind === 'competitor') {
            const payload = row[col.field];
            const daily = payload?.daily || {};
            if (!daily.id) continue;
            const field = col._competitorField || 'notes';
            richOps.push({
              type: 'competitor',
              rowId,
              colField: col.field,
              dailyId: daily.id,
              field,
              valueToSave: null,
            });
            richLocalPatches.push({ rowId, colField: col.field, field, valueToSave: null });
            continue;
          }

          if (RICH_TEXT_FIELDS.has(col.field)) {
            richOps.push({
              type: 'order_link_rich',
              rowId,
              field: col.field,
              valueToSave: null,
            });
            localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: null });
            continue;
          }

          if (!isCellEditable(col)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) continue;
          ops.push({ rowId, field: col.field, updateConfig, pkValue, valueToSave: null });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: null });
          if (ORDER_LINK_FORMULA_TRIGGER_FIELDS.has(col.field)) {
            recalcRows.add(rowId);
          }
          if (DAILY_FORMULA_TRIGGER_FIELDS.has(col.field)) {
            dailyRecalcRows.add(rowId);
          }
        }
      }

      if (!ops.length && !richOps.length) {
        ctx.message.warning('\u9009\u533a\u6ca1\u6709\u53ef\u5220\u9664\u7684\u53ef\u7f16\u8f91\u5355\u5143\u683c');
        return;
      }

      try {
        setSaving(true);
        for (const op of ops) {
          await ctx.request({
            url: op.updateConfig.url,
            method: 'post',
            params: { filterByTk: op.pkValue },
            data: { [op.field]: op.valueToSave },
          });
        }

        for (const op of richOps) {
          if (op.type === 'keyword') {
            await ctx.request({
              url: 'sqp_keyword_daily_positions:update',
              method: 'post',
              params: { filterByTk: op.dailyId },
              data: { [op.field]: op.valueToSave },
            });
          } else if (op.type === 'competitor') {
            await ctx.request({
              url: 'order_link_competitor_asins_daily:update',
              method: 'post',
              params: { filterByTk: op.dailyId },
              data: { [op.field]: op.valueToSave },
            });
          } else if (op.type === 'order_link_rich') {
            await ctx.request({
              url: 'daily_order_link_tracking:update',
              method: 'post',
              params: { filterByTk: op.rowId },
              data: { [op.field]: op.valueToSave },
            });
          }
        }

        const formulaRows = new Set([...recalcRows, ...dailyRecalcRows]);
        if (formulaRows.size) {
          showFormulaProgress({ label: '选区已清空，正在同步公式...', percent: 8 });
        }
        const formulaPatchMap = await syncFormulaPatches(localPatches, recalcRows, dailyRecalcRows, { onProgress: showFormulaProgress });

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          const formulaPatch = formulaPatchMap.get(rowId);
          const rowRichPatches = richLocalPatches.filter((p) => p.rowId === rowId);
          let nextRow = patch || formulaPatch
            ? {
                ...row,
                ...(patch || {}),
                ...(formulaPatch || {}),
              }
            : row;

          if (rowRichPatches.length) {
            nextRow = nextRow === row ? { ...row } : nextRow;
            rowRichPatches.forEach((p) => {
              const payload = nextRow[p.colField];
              if (!payload) return;
              nextRow[p.colField] = {
                ...payload,
                daily: {
                  ...(payload.daily || {}),
                  [p.field]: p.valueToSave,
                },
              };
            });
          }

          return nextRow;
        }));

        if (formulaRows.size) finishFormulaProgress('清空后公式同步完成');
        ctx.message.success(`\u5df2\u6e05\u7a7a ${ops.length + richOps.length} \u4e2a\u5355\u5143\u683c`);
      } catch (err) {
        ctx.message.error(`\u6e05\u7a7a\u5931\u8d25\uff1a${err?.message || '\u672a\u77e5\u9519\u8bef'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [editingCell, finishFormulaProgress, isCellEditable, normalizeSelection, pagedData, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulaPatches, visibleCols]);

    const handleKeyDown = useCallback((e) => {
      if (editingCell || saving) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target;
      const tag = String(target?.tagName || '').toLowerCase();
      const isClipboardTarget = target === clipboardRef.current;
      if (
        !isClipboardTarget &&
        (['input', 'textarea', 'select'].includes(tag) ||
          target?.isContentEditable ||
          target?.closest?.('[contenteditable="true"], .ant-input, .ant-input-number, .ant-select, .ant-picker'))
      ) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;
      e.preventDefault();
      clearSelectedCells();
    }, [clearSelectedCells, editingCell, normalizeSelection, saving, selectedRange]);

    const startEdit = useCallback((rowId, col, currentValue) => {
      if (saving) return;
      setSelectedRange(null);
      setEditingCell({ rowId, colKey: col.key, field: col.field, src: col.src });
      setEditValue(RATE_FIELDS.has(col.field) && currentValue != null && currentValue !== '' ? Number(currentValue) * 100 : (currentValue != null && currentValue !== '' ? currentValue : ''));
    }, [saving]);

    const cancelEdit = useCallback(() => { setEditingCell(null); setEditValue(null); }, []);

    const saveEdit = useCallback(async () => {
      if (!editingCell || saving) return;
      const { rowId, field, src } = editingCell;
      const row = data.find((r) => (r.country_asin_date || r.id) === rowId);
      if (!row) return;
      const col = visibleCols.find((item) => item.key === editingCell.colKey);
      if (col?._dynamicKind === 'keyword' || col?._dynamicKind === 'competitor') {
        const valueToSave = String(editValue ?? '').trim() || null;
        try {
          setSaving(true);
          if (col._dynamicKind === 'keyword') {
            const payload = row[col.field];
            const kw = payload?.kw;
            const daily = payload?.daily || {};
            if (!kw?.id) { ctx.message.error('无法找到 SQP 关键词记录'); return; }
            let nextDaily = { ...daily, actual_rank: valueToSave };
            if (daily.id) {
              await ctx.request({ url: 'sqp_keyword_daily_positions:update', method: 'post', params: { filterByTk: daily.id }, data: { actual_rank: valueToSave } });
            } else {
              const countryAsin = row.country && row.asin ? `${row.country}_${row.asin}` : null;
              const res = await ctx.request({
                url: 'sqp_keyword_daily_positions:create',
                method: 'post',
                data: withCreateTimestamps({
                  country_asin_date: rowId,
                  country_asin: countryAsin,
                  country: row.country || null,
                  asin: row.asin || null,
                  sqp_keyword_id: kw.id,
                  date: row.date ? String(row.date).slice(0, 10) : null,
                  actual_rank: valueToSave,
                }),
              });
              nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
            }
            setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
          } else {
            const payload = row[col.field];
            const competitor = payload?.competitor;
            const daily = payload?.daily || {};
            const fieldName = col._competitorField || 'notes';
            if (!competitor?.id) { ctx.message.error('无法找到竞对记录'); return; }
            let nextDaily = { ...daily, [fieldName]: valueToSave };
            if (daily.id) {
              await ctx.request({ url: 'order_link_competitor_asins_daily:update', method: 'post', params: { filterByTk: daily.id }, data: { [fieldName]: valueToSave } });
            } else {
              const res = await ctx.request({
                url: 'order_link_competitor_asins_daily:create',
                method: 'post',
                data: withCreateTimestamps({
                  country_asin_date: rowId,
                  competitor_id: competitor.id,
                  date: row.date ? String(row.date).slice(0, 10) : null,
                  [fieldName]: valueToSave,
                }),
              });
              nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
            }
            setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
          }
          ctx.message.success('淇濆瓨鎴愬姛');
          setEditingCell(null);
          setEditValue(null);
        } catch (err) {
          ctx.message.error(`保存失败：${err?.message || '未知错误'}`);
        } finally {
          setSaving(false);
        }
        return;
      }
      const updateConfig = SRC_UPDATE_CONFIG[src];
      if (!updateConfig) { ctx.message.error(`字段来源 "${src}" 暂不支持编辑`); return; }
      const pkValue = row[updateConfig.pkField];
      if (!pkValue) { ctx.message.error(`无法找到记录主键（${updateConfig.pkField}）`); cancelEdit(); return; }
      let valueToSave = editValue;
      if (RATE_FIELDS.has(field)) {
        valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) / 100 : null;
      } else if (MONEY_FIELDS.has(field) || NUM_FIELDS.has(field)) {
        valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) : null;
      } else if (DATE_FIELDS.has(field)) {
        valueToSave = editValue || null;
      }
      try {
        setSaving(true);
        await ctx.request({
          url: updateConfig.url,
          method: 'post',
          params: { filterByTk: pkValue },
          data: { [field]: valueToSave },
        });

        const nextRow = {
          ...row,
          [field]: valueToSave,
        };

        let formulaUpdates = null;

        if (DAILY_FORMULA_TRIGGER_FIELDS.has(field)) {
          formulaUpdates = {
            ...(formulaUpdates || {}),
            ...(await syncDailyFormulaForRow(nextRow) || {}),
          };
        }

        if (ORDER_LINK_FORMULA_TRIGGER_FIELDS.has(field)) {
          formulaUpdates = {
            ...(formulaUpdates || {}),
            ...(await syncFormulaForRow(nextRow) || {}),
          };
        }

        setData((prev) =>
          prev.map((r) =>
            (r.country_asin_date || r.id) === rowId
              ? {
                  ...r,
                  [field]: valueToSave,
                  ...(formulaUpdates || {}),
                }
              : r
          )
        );

        ctx.message.success(
          formulaUpdates ? '保存成功，公式已同步' : '保存成功'
        );

        setEditingCell(null);
        setEditValue(null);
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setSaving(false); }
    }, [editingCell, editValue, data, saving, syncDailyFormulaForRow, syncFormulaForRow, visibleCols]);

    const recalcAllOrderLinkFormulas = useCallback(async (rowsOverride, options = {}) => {
      const hasRowsOverride = Array.isArray(rowsOverride);
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;

      if (!IS_ADMIN && !hasRowsOverride) {
        ctx.message.warning('只有管理员可以执行自动计算');
        return false;
      }

      setCalcLoading(true);
      setCalcProgress('准备计算...');
      onProgress?.('准备计算...');

      try {
        if (!hasRowsOverride) {
          setCalcProgress('正在读取当前 ASIN / 国家全部数据...');
          onProgress?.('正在读取当前 ASIN / 国家全部数据...');
        }
        const rowsSource = hasRowsOverride
          ? rowsOverride
          : await loadAllFormulaRowsForCurrentCountryAsin();
        const rows = rowsSource.filter((r) => r.country_asin_date || r.id);

        if (!rows.length) {
          ctx.message.warning('当前没有可计算的数据');
          return false;
        }

        const keys = [...new Set(rows.map((r) => r.country_asin_date || r.id).filter(Boolean))];

        setCalcProgress('正在读取订单链接记录...');
        onProgress?.('正在读取订单链接记录...');

        const orderLinkFilter = JSON.stringify({
          country_asin_date: { $in: keys }
        });

        const orderLinkRes = await ctx.request({
          url: 'daily_order_link_tracking:list',
          method: 'get',
          params: {
            filter: orderLinkFilter,
            pageSize: Math.max(keys.length, 100),
          },
        });

        const orderLinkRecords = Array.isArray(orderLinkRes?.data?.data)
          ? orderLinkRes.data.data
          : [];

        const existingMap = {};
        orderLinkRecords.forEach((r) => {
          if (r.country_asin_date) existingMap[r.country_asin_date] = r;
        });

        setCalcProgress('正在本地计算公式...');
        onProgress?.('正在本地计算公式...');

        const updateJobs = [];
        const dailyUpdateJobs = [];
        const patchMap = {};

        rows.forEach((row) => {
          const key = row.country_asin_date || row.id;
          if (!key) return;

          const dailyUpdates = {
            off: buildDailyOffValue(row),
            lp_duration_days: toFormulaNumber(row.lp_duration_days),
          };
          const orderLinkUpdates = buildOrderLinkFormulaUpdates(row);
          const changedDailyUpdates = pickChangedFormulaFields(row, dailyUpdates);
          const currentOrderLink = existingMap[key] || {};
          const changedOrderLinkUpdates = pickChangedFormulaFields(currentOrderLink, orderLinkUpdates);
          const { real_session_conversion_rate, ...visibleOrderLinkUpdates } = orderLinkUpdates;
          const { real_session_conversion_rate: changedRealSessionConversionRate, ...changedVisibleOrderLinkUpdates } = changedOrderLinkUpdates;

          if (Object.keys(changedDailyUpdates).length || Object.keys(changedOrderLinkUpdates).length || !existingMap[key]) {
            patchMap[key] = {
              ...changedDailyUpdates,
              ...changedVisibleOrderLinkUpdates,
              ...(Object.prototype.hasOwnProperty.call(changedOrderLinkUpdates, 'real_session_conversion_rate')
                ? { order_link_real_session_conversion_rate: changedRealSessionConversionRate }
                : {}),
              ...(!existingMap[key] ? {
                ...visibleOrderLinkUpdates,
                order_link_real_session_conversion_rate: real_session_conversion_rate,
              } : {}),
            };
          }

          if (Object.keys(changedDailyUpdates).length) {
            dailyUpdateJobs.push({
              key,
              dailyUpdates: changedDailyUpdates,
            });
          }

          if (!existingMap[key] || Object.keys(changedOrderLinkUpdates).length) {
            updateJobs.push({
              key,
              row,
              orderLinkUpdates: existingMap[key] ? changedOrderLinkUpdates : orderLinkUpdates,
              exists: !!existingMap[key],
              existingId: existingMap[key]?.id,
            });
          }
        });

        if (!updateJobs.length && !dailyUpdateJobs.length) {
          return true;
        }

        setCalcProgress(`准备写回 ${updateJobs.length} 条...`);
        onProgress?.(`准备写回 ${updateJobs.length} 条...`);

        let successCount = 0;
        let failCount = 0;

        const batchSize = 8;

        for (let i = 0; i < dailyUpdateJobs.length; i += batchSize) {
          const batch = dailyUpdateJobs.slice(i, i + batchSize);

          await Promise.allSettled(
            batch.map((job) => ctx.request({
              url: 'daily_asins:update',
              method: 'post',
              params: { filterByTk: job.key },
              data: job.dailyUpdates,
            }))
          );
        }

        for (let i = 0; i < updateJobs.length; i += batchSize) {
          const batch = updateJobs.slice(i, i + batchSize);

          setCalcProgress(`正在写回 ${Math.min(i + batch.length, updateJobs.length)}/${updateJobs.length}...`);
          onProgress?.(`正在写回 ${Math.min(i + batch.length, updateJobs.length)}/${updateJobs.length}...`);

          const results = await Promise.allSettled(
            batch.map(async (job) => {
              if (job.exists) {
                await ctx.request({
                  url: 'daily_order_link_tracking:update',
                  method: 'post',
                  params: { filterByTk: job.key },
                  data: job.orderLinkUpdates,
                });
              } else {
                await ctx.request({
                  url: 'daily_order_link_tracking:create',
                  method: 'post',
                  data: withCreateTimestamps({
                    country_asin_date: job.key,
                    country: job.row.country || null,
                    asin: job.row.asin || null,
                    date: job.row.date || null,
                    ...job.orderLinkUpdates,
                  }),
                });
              }
            })
          );

          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
        }

        setData((prev) =>
          prev.map((row) => {
            const key = row.country_asin_date || row.id;
            return patchMap[key] ? { ...row, ...patchMap[key] } : row;
          })
        );

        if (failCount > 0) {
          ctx.message.warning(`公式计算完成：成功 ${successCount} 条，失败 ${failCount} 条`);
        } else if (!options.silentSuccess) {
          ctx.message.success(`公式计算完成：成功 ${successCount} 条`);
        }
        return failCount === 0;
      } catch (err) {
        console.error(err);
        ctx.message.error(`公式计算失败：${err?.message || '未知错误'}`);
        return false;
      } finally {
        setCalcLoading(false);
        setCalcProgress('');
      }
    }, [buildOrderLinkFormulaUpdates, IS_ADMIN, loadAllFormulaRowsForCurrentCountryAsin]);

    useEffect(() => {
      recalcAllOrderLinkFormulasRef.current = recalcAllOrderLinkFormulas;
    }, [recalcAllOrderLinkFormulas]);

    const captureTableScroll = useCallback(() => {
      const wrap = tableWrapRef.current;
      return wrap ? { top: wrap.scrollTop, left: wrap.scrollLeft } : null;
    }, []);

    const restoreTableScroll = useCallback((pos) => {
      if (!pos) return;
      const apply = () => {
        const wrap = tableWrapRef.current;
        if (!wrap) return;
        wrap.scrollTop = pos.top;
        wrap.scrollLeft = pos.left;
      };
      apply();
      window.setTimeout(apply, 0);
      window.setTimeout(apply, 80);
    }, []);

    const saveOrderLinkRichField = useCallback(async (row, field, newContent) => {
      const key = row?.country_asin_date || row?.id;
      if (!key) { ctx.message.error('无法找到记录主键'); return false; }
      const scrollPos = captureTableScroll();
      try {
        const filterStr = JSON.stringify({ country_asin_date: { $eq: key } });
        const res = await ctx.request({ url: 'daily_order_link_tracking:list', method: 'get', params: { filter: filterStr, pageSize: 1 } });
        const existing = res?.data?.data?.[0];
        if (existing) {
          await ctx.request({ url: 'daily_order_link_tracking:update', method: 'post', params: { filterByTk: key }, data: { [field]: newContent || null } });
        } else {
          await ctx.request({
            url: 'daily_order_link_tracking:create',
            method: 'post',
            data: withCreateTimestamps({
              country_asin_date: key,
              country: row.country || null,
              asin: row.asin || null,
              date: row.date || null,
              [field]: newContent || null,
            }),
          });
        }
        setData(prev => prev.map(r => (r.country_asin_date || r.id) === key ? { ...r, [field]: newContent || null } : r));
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, restoreTableScroll]);

    const saveKeywordRichCell = useCallback(async (row, col, newContent) => {
      const rowId = row?.country_asin_date || row?.id;
      const payload = row?.[col.field];
      const kw = payload?.kw;
      const daily = payload?.daily || {};
      if (!rowId || !kw?.id) { ctx.message.error('无法找到 SQP 关键词记录'); return false; }
      const scrollPos = captureTableScroll();
      try {
        let nextDaily = { ...daily, actual_rank: newContent || null };
        if (daily.id) {
          await ctx.request({ url: 'sqp_keyword_daily_positions:update', method: 'post', params: { filterByTk: daily.id }, data: { actual_rank: newContent || null } });
        } else {
          const countryAsin = row.country && row.asin ? `${row.country}_${row.asin}` : null;
          const res = await ctx.request({
            url: 'sqp_keyword_daily_positions:create',
            method: 'post',
            data: withCreateTimestamps({
              country_asin_date: rowId,
              country_asin: countryAsin,
              country: row.country || null,
              asin: row.asin || null,
              sqp_keyword_id: kw.id,
              date: row.date ? String(row.date).slice(0, 10) : null,
              actual_rank: newContent || null,
            }),
          });
          nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
        }
        setData(prev => prev.map(r => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存 SQP 关键词自然位失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, restoreTableScroll]);

    const saveCompetitorRichCell = useCallback(async (row, col, newContent) => {
      const rowId = row?.country_asin_date || row?.id;
      const payload = row?.[col.field];
      const competitor = payload?.competitor;
      const daily = payload?.daily || {};
      const fieldName = col._competitorField || 'notes';
      if (!rowId || !competitor?.id) { ctx.message.error('无法找到竞对记录'); return false; }
      const scrollPos = captureTableScroll();
      try {
        let nextDaily = { ...daily, [fieldName]: newContent || null };
        if (daily.id) {
          await ctx.request({ url: 'order_link_competitor_asins_daily:update', method: 'post', params: { filterByTk: daily.id }, data: { [fieldName]: newContent || null } });
        } else {
          const res = await ctx.request({
            url: 'order_link_competitor_asins_daily:create',
            method: 'post',
            data: withCreateTimestamps({
              country_asin_date: rowId,
              competitor_id: competitor.id,
              date: row.date ? String(row.date).slice(0, 10) : null,
              [fieldName]: newContent || null,
            }),
          });
          nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
        }
        setData(prev => prev.map(r => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存竞对失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, restoreTableScroll]);

    const refreshData = useCallback(async () => {
      if (refreshingData || calcLoading || loading) return;
      try {
        setRefreshingData(true);
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        setRefreshProgress('正在读取当前 ASIN / 国家全部数据...');
        showFormulaProgress({ label: '正在读取当前 ASIN / 国家全部数据...', percent: 12 });
        const rows = await loadAllFormulaRowsForCurrentCountryAsin();
        if (!Array.isArray(rows) || !rows.length) {
          ctx.message.success('数据已刷新');
          finishFormulaProgress('数据已刷新');
          return;
        }
        let progressPercent = 18;
        const ok = await recalcAllOrderLinkFormulas(rows, {
          silentSuccess: true,
          onProgress: (progress) => {
            const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
            progressPercent = Math.min(95, progressPercent + 10);
            setRefreshProgress(label);
            showFormulaProgress(typeof progress === 'object' && progress !== null ? progress : { label, percent: progressPercent });
          },
        });
        showFormulaProgress({ label: '正在重新加载结果...', percent: 96 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        ctx.message[ok ? 'success' : 'warning'](ok ? '数据已刷新并重新计算公式' : '数据已刷新，公式计算失败');
        finishFormulaProgress(ok ? '刷新公式计算完成' : '刷新完成，公式失败');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.error(`刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshingData(false);
        setRefreshProgress('');
      }
    }, [calcLoading, finishFormulaProgress, loadAllFormulaRowsForCurrentCountryAsin, loadData, loading, recalcAllOrderLinkFormulas, refreshingData, resetFormulaProgress, showFormulaProgress]);

    const btnStyle = (bg, color, border) => ({ padding: '5px 12px', background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE}px`, whiteSpace: 'nowrap' });

    const renderEditInput = (col) => {
      const commonProps = { ref: inputRef, value: editValue, onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); }, style: { width: '100%', textAlign: 'center' }, size: 'small' };
      if (RATE_FIELDS.has(col.field))  return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), min: 0, max: 100, step: 0.01, precision: 2, addonAfter: '%' });
      if (MONEY_FIELDS.has(col.field)) return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 0.01, precision: 2 });
      if (NUM_FIELDS.has(col.field))   return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 1 });
      if (DATE_FIELDS.has(col.field))  return React.createElement(DatePicker,  { ...commonProps, locale: DATE_PICKER_LOCALE, value: editValue ? ctx.libs.dayjs(editValue) : null, onChange: (date) => setEditValue(date ? date.format('YYYY-MM-DD') : null) });
      return React.createElement(Input, { ...commonProps, onChange: (e) => setEditValue(e.target.value), onPressEnter: () => saveEdit() });
    };

    const renderColRow = (col) => {
      const currentColor = getColHeaderColor(col);
      const srcDefault   = SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;
      const isCustom     = !!col.headerColor;
      return React.createElement('div', { key: col.key, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0 3px 12px', borderBottom: '1px solid #fafafa' } },
        React.createElement('div', { onClick: () => togglePin(col.key), style: { width: '22px', textAlign: 'center', flexShrink: 0, cursor: 'pointer', fontSize: `${FONT_SIZE_SM}px`, opacity: col.pinned ? 1 : 0.2, userSelect: 'none' } }, '📌'),
        React.createElement('input', { type: 'checkbox', checked: !col.hidden, onChange: () => toggleCol(col.key), style: { flexShrink: 0, cursor: 'pointer' } }),
        React.createElement('span', { style: { flex: 1, fontSize: `${FONT_SIZE_SM}px`, color: col.hidden ? '#ccc' : '#333', userSelect: 'none' } }, col.label),
        IS_ADMIN && !READONLY_FIELDS.has(col.field) && React.createElement('label', { title: col.editable === true ? '关闭单元格编辑' : '开启单元格编辑', style: { display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', flexShrink: 0, minWidth: '48px' } },
          React.createElement('input', { type: 'checkbox', checked: col.editable === true, onChange: () => toggleEditable(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: { fontSize: `${FONT_SIZE_SM}px`, color: col.editable === true ? '#1890ff' : '#999', fontWeight: 700 } }, '编辑'),
        ),
        IS_ADMIN && React.createElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } },
          PRESET_COLORS.map((pc) => React.createElement('div', { key: pc.value, title: pc.label, onClick: () => setHColor(col.key, pc.value), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: pc.value, border: currentColor === pc.value ? '2px solid #333' : '2px solid transparent', boxSizing: 'border-box' } })),
          isCustom && React.createElement('div', { title: '重置为默认色', onClick: () => clearHColor(col.key), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: srcDefault, border: '2px dashed #333', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 700, lineHeight: 1 } }, '↺'),
        ),
      );
    };

    const panelEl = showPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { position: 'fixed', top: `${panelPos.top}px`, left: `${panelPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', width: IS_ADMIN ? '660px' : '520px', maxHeight: '620px', overflowY: 'auto' } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: '#555', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' } },
          React.createElement('span', null, '列设置'),
          React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 } },
            React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#aaa', fontWeight: 400 } }, IS_ADMIN ? '📌 固定 | ☑ 显示 | ☑ 编辑 | 🎨 颜色' : '📌 固定 | ☑ 显示'),
            IS_ADMIN && React.createElement(Popconfirm, {
              title: '\u786e\u5b9a\u628a\u5f53\u524d\u5217\u914d\u7f6e\u8bbe\u4e3a\u9ed8\u8ba4\u914d\u7f6e\u5417\uff1f\u4f1a\u540c\u6b65\u7ed9\u6240\u6709\u7528\u6237\u4f5c\u4e3a\u6062\u590d\u9ed8\u8ba4\u7684\u76ee\u6807\u3002',
              onConfirm: saveCurrentAsDefaultColumns,
              okText: '\u8bbe\u4e3a\u9ed8\u8ba4',
              cancelText: '\u53d6\u6d88',
            },
              React.createElement('button', { style: { padding: '2px 8px', minWidth: '86px', fontSize: `${FONT_SIZE_XS}px`, lineHeight: '20px', whiteSpace: 'nowrap', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '\u8bbe\u4e3a\u9ed8\u8ba4\u914d\u7f6e')
            ),
            React.createElement(Popconfirm, {
              title: '\u786e\u5b9a\u6062\u590d\u9ed8\u8ba4\u5217\u914d\u7f6e\u5417\uff1f\u5f53\u524d\u4e2a\u4eba\u5217\u8bbe\u7f6e\u4f1a\u88ab\u6e05\u9664\u3002',
              onConfirm: restoreDefaultColumns,
              okText: '\u6062\u590d\u9ed8\u8ba4',
              cancelText: '\u53d6\u6d88',
            },
              React.createElement('button', { style: { padding: '2px 8px', minWidth: '86px', fontSize: `${FONT_SIZE_XS}px`, lineHeight: '20px', whiteSpace: 'nowrap', background: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591', borderRadius: '3px', cursor: 'pointer' } }, '\u6062\u590d\u9ed8\u8ba4\u914d\u7f6e')
            ),
            React.createElement('button', { onClick: selectAll,   style: { padding: '2px 8px', minWidth: '42px', fontSize: `${FONT_SIZE_XS}px`, lineHeight: '20px', whiteSpace: 'nowrap', background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
            React.createElement('button', { onClick: deselectAll, style: { padding: '2px 8px', minWidth: '48px', fontSize: `${FONT_SIZE_XS}px`, lineHeight: '20px', whiteSpace: 'nowrap', background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
          ),
        ),
        SRC_GROUP_CONFIG.map((group) => {
          const groupCols   = allColumns.filter((c) => c.src === group.src);
          if (!groupCols.length) return null;
          const isCollapsed = !!collapsedGroups[group.src];
          const visCount    = groupCols.filter((c) => !c.hidden).length;
          return React.createElement('div', { key: group.src, style: { marginBottom: '6px', border: `1px solid ${group.color}40`, borderRadius: '6px', overflow: 'hidden' } },
            React.createElement('div', { onClick: () => toggleGroup(group.src), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer', userSelect: 'none', background: `${group.color}18`, borderBottom: isCollapsed ? 'none' : `1px solid ${group.color}30` } },
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: group.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
              React.createElement('span', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: group.color, flex: 1 } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); updateAndSave((p) => p.map((c) => c.src === group.src ? { ...c, hidden: false } : c)); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全选'),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); updateAndSave((p) => p.map((c) => c.src === group.src ? { ...c, hidden: true } : c)); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全取消'),
            ),
            !isCollapsed && React.createElement('div', null, groupCols.map((col) => renderColRow(col))),
          );
        }),
      ),
    );

    const pushPanelEl = showPush && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPush(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement(PushPanel, { columns: allColumns, onClose: () => setShowPush(false), anchorPos: pushPos }),
    );

    const tableWidth = visibleCols.reduce((s, c) => s + (c.width || 80), 0);
    const renderIndexButton = (item) => React.createElement('button', {
      key: item.key,
      onClick: () => scrollToIndexLeft(item.left),
      style: {
        flexShrink: 0,
        padding: '2px 8px',
        height: '22px',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        background: item.type === 'competitor' ? '#eff6ff' : '#fff7e6',
        color: item.type === 'competitor' ? '#1d4ed8' : '#b45309',
        cursor: 'pointer',
        fontSize: `${FONT_SIZE_XS}px`,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        maxWidth: '180px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
    }, item.label);
    const renderSortMark = (key) => React.createElement('span', {
      style: {
        display: sortConfig.key === key ? 'inline-block' : 'none',
        marginLeft: '2px',
        opacity: 0.85,
        fontSize: `${FONT_SIZE_XS}px`,
        flexShrink: 0,
        lineHeight: 1,
      }
    }, sortConfig.key === key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '');
    const getSourceFieldName = (col) => {
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      return sourceCollection ? `${sourceCollection}.${col.field}` : col.field;
    };
    const getSourceDisplayName = (col) => {
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      return sourceCollection
        ? fieldRef(sourceCollection, col.field, col.label)
        : `${SRC_TABLE_LABEL[col.src] || col.src || '未知来源'}.${col.field}`;
    };
    const getHeaderTooltipData = (col) => {
      if (FORMULA_TOOLTIPS[col.field]) {
        return { ...FORMULA_TOOLTIPS[col.field], hideEmptyRules: false };
      }
      if (COLUMN_TOOLTIPS[col.field]) {
        if (DAILY_SQL_UPDATED_FIELDS.has(col.field) && col.src !== 'daily') {
          return null;
        }
        const salesText = col.src === 'daily' ? DAILY_SQL_UPDATED_FIELD_TEXT[col.field] : null;
        const sourceInfos = col.src === 'daily' ? DAILY_SQL_UPDATED_FIELD_SOURCE[col.field] : null;
        return {
          ...COLUMN_TOOLTIPS[col.field],
          formula: salesText || COLUMN_TOOLTIPS[col.field].formula,
          hideEmptyRules: !COLUMN_TOOLTIP_EMPTY_RULE_FIELDS.has(col.field),
          sourceInfos,
          hideFieldMapping: !!sourceInfos,
          hideFieldDetails: false,
        };
      }
      if (col._dynamicKind === 'keyword') {
        return {
          title: col.label,
          formula: `引用SQP版块填写的关键词「${col._kwName || '未命名'}」，展示当天填写的自然位`,
          hideEmptyRules: true,
          fields: [
            { label: '关键词名称', field: 'sqp_keywords.keyword_name' },
            { label: '每日自然位', field: 'sqp_keyword_daily_positions.actual_rank' },
          ],
          writeBackField: 'sqp_keyword_daily_positions.actual_rank',
        };
      }
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      const sourceField = getSourceFieldName(col);
      return {
        title: col.label,
        formula: `直接展示${getSourceDisplayName(col)}的值`,
        emptyRules: ['来源字段为空时显示为空'],
        hideEmptyRules: true,
        fields: [{ label: col.label, field: sourceField }],
        writeBackField: sourceCollection ? sourceField : '无',
      };
    };
    const getCompetitorGroupTooltipData = (col) => ({
      title: col._competitorGroupLabel || col.label,
      formula: '展示竞对 ASIN 的每日排名和操作分析记录',
      emptyRules: ['未配置竞对 ASIN', '当天没有竞对日数据记录', '对应排名或操作分析字段为空'],
      hideEmptyRules: true,
      fields: [
        { label: '竞对 ASIN', field: 'order_link_competitor_asins.competitor_asin' },
        { label: '列头备注', field: 'order_link_competitor_asins.notes' },
        { label: '每日排名', field: 'order_link_competitor_asins_daily.rank' },
        { label: '操作分析', field: 'order_link_competitor_asins_daily.notes' },
      ],
      writeBackField: 'order_link_competitor_asins_daily.rank / order_link_competitor_asins_daily.notes',
    });
    const getCompetitorSubTooltipData = (col) => {
      const isRank = col._competitorField === 'rank';
      return {
        title: col._competitorSubLabel || col.label,
        formula: isRank ? '展示该竞对 ASIN 当天记录的排名' : '展示该竞对 ASIN 当天记录的操作分析',
        emptyRules: ['未配置竞对 ASIN', '当天没有竞对日数据记录', `${isRank ? '排名' : '操作分析'}字段为空`],
        hideEmptyRules: true,
        fields: [
          { label: '列头备注', field: 'order_link_competitor_asins.notes' },
          { label: isRank ? '每日排名' : '操作分析', field: `order_link_competitor_asins_daily.${isRank ? 'rank' : 'notes'}` },
        ],
        writeBackField: `order_link_competitor_asins_daily.${isRank ? 'rank' : 'notes'}`,
      };
    };
    const renderTooltip = ({ title, formula, emptyRules = [], fields = [], writeBackField, hideEmptyRules = false, hideFieldDetails = false, hideFieldMapping = false, sourceInfos = [] }) => React.createElement('div', {
      style: {
        maxWidth: '360px',
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'inherit',
      },
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '6px' } }, title),
      React.createElement('div', { style: { marginBottom: '6px' } }, formula || '直接展示该指标值'),
      !hideEmptyRules && React.createElement('div', { style: { marginBottom: '2px' } }, '为空条件：'),
      !hideEmptyRules && React.createElement('ul', {
        style: {
          margin: '0 0 10px 18px',
          padding: 0,
        },
      }, (emptyRules.length ? emptyRules : ['无特殊为空条件']).map((rule, idx) =>
        React.createElement('li', { key: `empty_${idx}` }, rule)
      )),
      !hideFieldDetails && React.createElement('hr', {
        style: {
          border: 0,
          borderTop: '1px solid rgba(255,255,255,0.22)',
          margin: '8px 0',
        },
      }),
      !hideFieldDetails && React.createElement('div', {
        style: {
          fontSize: '12px',
          opacity: 0.75,
          lineHeight: 1.55,
        },
      },
        React.createElement('div', { style: { fontWeight: 700, marginBottom: '4px' } }, '🔧 字段说明（开发用）'),
        Array.isArray(sourceInfos) && sourceInfos.map((source, idx) => React.createElement('div', {
          key: `source_${idx}`,
          style: {
            marginBottom: '6px',
            paddingBottom: '6px',
            borderBottom: idx === sourceInfos.length - 1 ? 'none' : '1px dashed rgba(255,255,255,0.18)',
          },
        },
          React.createElement('div', null,
            React.createElement('span', null, '来源工作流：'),
            React.createElement('code', {
              style: {
                fontFamily: 'monospace',
                whiteSpace: 'normal',
                wordBreak: 'break-all',
              },
            }, source.workflow)
          ),
          source.schedule && React.createElement('div', null, `执行时间：${source.schedule}`),
          source.scope && React.createElement('div', null, `适用站点：${source.scope}`),
          React.createElement('div', null,
            React.createElement('span', null, 'SQL 节点：'),
            React.createElement('code', {
              style: {
                fontFamily: 'monospace',
                whiteSpace: 'normal',
                wordBreak: 'break-all',
              },
            }, source.node)
          )
        )),
        !hideFieldMapping && fields.map((item, idx) => React.createElement('div', { key: `field_${idx}` },
          React.createElement('span', null, `${item.label}：`),
          React.createElement('code', {
            style: {
              fontFamily: 'monospace',
              whiteSpace: 'normal',
              wordBreak: 'break-all',
            },
          }, item.field)
        )),
        !hideFieldMapping && React.createElement('div', { style: { marginTop: '4px' } },
          React.createElement('span', null, '写回字段：'),
          React.createElement('code', {
            style: {
              fontFamily: 'monospace',
              whiteSpace: 'normal',
              wordBreak: 'break-all',
            },
          }, writeBackField || '无')
        )
      )
    );
    const renderHeaderTooltipTitle = (tooltipData) => tooltipData
      ? renderTooltip(tooltipData)
      : null;
    const renderHeaderLabel = (label, tooltipData, style = {}) => React.createElement(Tooltip, {
      title: renderHeaderTooltipTitle(tooltipData) || label,
      placement: 'top',
      overlayStyle: { maxWidth: '360px' },
      mouseEnterDelay: 0.15,
    }, React.createElement('span', {
      style: {
        overflow: 'hidden',
        whiteSpace: 'normal',
        lineHeight: '15px',
        maxHeight: '30px',
        wordBreak: 'break-all',
        display: 'block',
        width: '100%',
        textAlign: 'center',
        cursor: tooltipData ? 'help' : 'default',
        ...style,
      }
    }, label));

    const renderCompetitorGroupHeaderLabel = (col) => {
      const tooltipData = getCompetitorGroupTooltipData(col);
      const label = col._competitorGroupLabel || col.label;
      const url = buildAmazonAsinUrl(col._competitorCountry, col._competitorAsin);
      if (!url) return renderHeaderLabel(label, tooltipData);

      return React.createElement(Tooltip, {
        title: renderHeaderTooltipTitle(tooltipData) || label,
        placement: 'top',
        overlayStyle: { maxWidth: '360px' },
        mouseEnterDelay: 0.15,
      }, React.createElement('a', {
        href: url,
        target: '_blank',
        rel: 'noopener noreferrer',
        title: url,
        onClick: (e) => e.stopPropagation(),
        onMouseDown: (e) => e.stopPropagation(),
        draggable: false,
        onDragStart: (e) => {
          e.preventDefault();
          e.stopPropagation();
        },
        style: {
          display: 'inline-block',
          maxWidth: '100%',
          overflow: 'hidden',
          whiteSpace: 'normal',
        lineHeight: '15px',
        maxHeight: '30px',
        wordBreak: 'break-all',
          color: 'inherit',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
          cursor: 'pointer',
        },
      }, label));
    };

    const crossHighlightPanelEl = showCrossHighlightPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowCrossHighlightPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', {
        onClick: (e) => e.stopPropagation(),
        style: {
          position: 'fixed',
          top: `${crossHighlightPos.top}px`,
          left: `${crossHighlightPos.left}px`,
          zIndex: 2000,
          width: '220px',
          padding: '10px',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          fontSize: `${FONT_SIZE_SM}px`,
        },
      },
        React.createElement('div', { style: { marginBottom: '8px', color: '#666', fontWeight: 600 } }, '高亮当前行列'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '10px' } },
          ...ACTIVE_CROSS_HIGHLIGHT_COLORS.map((item) => React.createElement('button', {
            key: item.value,
            title: item.label,
            onClick: () => { setCrossHighlightColor(item.value); setCrossHighlightEnabled(true); },
            style: {
              width: '32px',
              height: '24px',
              borderRadius: '3px',
              background: item.value,
              border: crossHighlightColor === item.value ? '2px solid #1677ff' : '1px solid #d9d9d9',
              cursor: 'pointer',
              boxSizing: 'border-box',
            },
          }))
        ),
        React.createElement('button', {
          onClick: () => { setCrossHighlightEnabled(false); setActiveCell(null); setShowCrossHighlightPanel(false); },
          style: { width: '100%', padding: '5px 8px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE_SM}px` },
        }, '取消高亮')
      )
    );

    const topInfoItems = [
      { label: '型号', value: filterModel || '-' },
      { label: '国家', value: filterCountry || '-' },
      { label: 'ASIN', value: filterAsin || '-' },
      { label: '销售', value: filterSaleOwner || '-' },
    ];
    const headerInfoEl = React.createElement('div', {
      style: {
        display: 'inline-flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '2px',
        padding: '3px 8px',
        background: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        boxShadow: 'none',
        maxWidth: '100%',
      },
    },
      ...topInfoItems.map((item, index) =>
        React.createElement('div', { key: item.label, style: { minWidth: 0, borderLeft: index === 0 ? 'none' : '1px solid #d9d9d9', paddingLeft: index === 0 ? 0 : '8px', color: '#333', fontSize: `${FONT_SIZE_SM}px`, fontWeight: 600, lineHeight: '17px', whiteSpace: 'nowrap' } },
          React.createElement('span', { style: { color: '#4d7f78', fontWeight: 600 } }, `${item.label}：`),
          React.createElement('span', null, item.value)
        )
      )
    );
    const actionBusy = loading || refreshingData || calcLoading;
    const formulaProgressEl = formulaProgress.active && React.createElement('div', {
      style: {
        width: '260px',
        minWidth: '220px',
        height: '24px',
        border: '1px solid #91caff',
        borderRadius: '4px',
        background: '#f0f7ff',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      },
    },
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.max(2, Math.min(100, formulaProgress.percent || 0))}%`,
          background: 'linear-gradient(90deg, #69c0ff, #1677ff)',
          transition: 'width 0.25s ease',
        },
      }),
      React.createElement('div', {
        style: {
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 8px',
          color: formulaProgress.percent >= 55 ? '#fff' : '#0958d9',
          fontSize: `${FONT_SIZE_XS}px`,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textShadow: formulaProgress.percent >= 55 ? '0 1px 1px rgba(0,0,0,0.25)' : 'none',
        },
      }, `${formulaProgress.label || '正在同步公式...'} ${Math.round(formulaProgress.percent || 0)}%`)
    );

    return React.createElement('div', { ref: rootRef, style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),
      

      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '2px' },
      },
        headerInfoEl,

        React.createElement('div', {
        style: { display: 'inline-flex', width: 'fit-content', maxWidth: '100%', gap: '6px', flexWrap: 'wrap', marginBottom: '2px', padding: '3px 8px', background: '#fafafa', borderRadius: '4px', border: '1px solid #d9d9d9', alignItems: 'center', fontSize: `${FONT_SIZE_XS}px`, boxSizing: 'border-box' }
      },
        React.createElement('span', { style: { fontWeight: 600, color: '#555', marginRight: '4px' } }, '列头颜色：'),
        ...PRESET_COLORS.map(pc =>
          React.createElement('div', { key: pc.value, style: { display: 'flex', alignItems: 'center', gap: '2px' } },
            React.createElement('div', { style: { width: '10px', height: '10px', borderRadius: '2px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
            React.createElement('span', { style: { color: '#666' } }, pc.label)
          )
        ),
      )
      ),

      (columnIndexGroups.keywordItems.length > 0 || columnIndexGroups.competitorItems.length > 0) && React.createElement('div', {
      style: { display: 'inline-flex', width: 'fit-content', maxWidth: '100%', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px', padding: '3px 8px', background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: `${FONT_SIZE_XS}px`, boxSizing: 'border-box' },
      },
      React.createElement('span', { style: { color: '#666', fontWeight: 600, flexShrink: 0 } }, '快速跳转：'),
      columnIndexGroups.keywordItems.length > 0 && React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' } },
      React.createElement('span', { style: { color: '#389e0d', fontWeight: 700, whiteSpace: 'nowrap' } }, 'SQP词：'),
      ...columnIndexGroups.keywordItems.map(renderIndexButton),
      ),
      columnIndexGroups.competitorItems.length > 0 && React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' } },
      React.createElement('span', { style: { color: '#0958d9', fontWeight: 700, whiteSpace: 'nowrap' } }, '竞对ASIN：'),
      ...columnIndexGroups.competitorItems.map(renderIndexButton),
      ),
      ),

      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px', alignItems: 'stretch' } },
        React.createElement('div', {
          style: {
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            alignItems: 'center',
            minHeight: '34px',
            boxSizing: 'border-box',
            padding: '5px 8px',
            background: '#ffe1e1',
            border: '2px solid #f5222d',
            borderRadius: '4px',
            boxShadow: '0 0 0 1px rgba(245,34,45,0.12)',
          },
        },
          React.createElement('span', { style: { color: '#a8071a', fontSize: `${FONT_SIZE + 1}px`, fontWeight: 900, marginRight: '4px', whiteSpace: 'nowrap' } }, '需设置：'),
          React.createElement('button', { ref: panelBtnRef, onClick: () => { setShowPanel((v) => { const next = !v; if (next) setCollapsedGroups(getDefaultCollapsedGroups()); return next; }); setShowPush(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '👁️ 列设置'),
          IS_ADMIN && React.createElement('button', { ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '📤 推送配置'),
          React.createElement('button', {
          ref: crossHighlightBtnRef,
          onClick: () => { setShowCrossHighlightPanel((v) => !v); setShowPanel(false); setShowPush(false); },
          style: btnStyle('#EB6793', '#fff', '#d84f7c'),
        }, crossHighlightEnabled ? '高亮行列：开' : '高亮行列'),
          React.createElement('button', { onClick: () => setCompetitorMasterVisible(true), style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '管理竞对 ASIN'),
          React.createElement('button', { onClick: () => setSqpTermManagerVisible(true), style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '管理 SQP 关键词')
        ),
        React.createElement('div', {
        style: {
        display: 'flex',
        gap: '4px',
        flexWrap: 'wrap',
        alignItems: 'center',
        minHeight: '34px',
        boxSizing: 'border-box',
        padding: '5px 8px',
        background: '#fff',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        },
        },
        React.createElement('button', {
        onClick: refreshData,
        disabled: actionBusy,
        style: {
        ...btnStyle(actionBusy ? '#f5f5f5' : '#fff', actionBusy ? '#999' : '#333', actionBusy ? '#d9d9d9' : '#d9d9d9'),
        opacity: actionBusy ? 0.65 : 1,
        cursor: actionBusy ? 'not-allowed' : 'pointer',
        },
        }, refreshingData ? '刷新中...' : '🔄 刷新'),
        React.createElement(Select, { value: dateFilterType, onChange: (v) => { setDateFilterType(v); if (v !== 'custom') setCustomDateRange(null); }, options: DATE_FILTER_OPTIONS, style: { width: '120px' }, size: 'small' }),
        React.createElement('span', {
        style: {
        padding: '2px 6px',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        background: '#fafafa',
        color: '#555',
        fontSize: `${FONT_SIZE_XS}px`,
        fontWeight: 700,
        whiteSpace: 'nowrap',
        },
        }, '日期范围'),
        React.createElement(DatePicker.RangePicker, {
        locale: DATE_PICKER_LOCALE,
        value: customDateRange ? [ctx.libs.dayjs(customDateRange[0]), ctx.libs.dayjs(customDateRange[1])] : null,
        onChange: (dates) => {
        if (dates && dates[0] && dates[1]) { const range = [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]; setCustomDateRange(range); setDateFilterType('custom'); }
        else { setCustomDateRange(null); if (dateFilterType === 'custom') setDateFilterType('all'); }
        },
        size: 'small',
        style: {
        width: '240px',
        border: dateFilterType === 'custom' ? '1px solid #1677ff' : '1px solid #bfbfbf',
        background: dateFilterType === 'custom' ? '#f0f7ff' : '#fff',
        boxShadow: dateFilterType === 'custom' ? '0 0 0 2px rgba(22,119,255,0.12)' : 'none',
        },
        placeholder: ['开始日期', '结束日期'],
        allowClear: true,
        }),
        React.createElement('span', { style: { fontSize: `${FONT_SIZE_SM}px`, color: '#888' } }, loading ? '加载中...' : `共 ${total} 条记录`),
        formulaProgressEl
        ),

        ),

      panelEl,
      pushPanelEl,
      crossHighlightPanelEl,

      React.createElement('textarea', {
        ref: clipboardRef,
        value: '',
        onChange: () => {},
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleKeyDown,
        tabIndex: -1,
        'aria-hidden': true,
        style: {
        position: 'fixed',
        left: '0px',
        top: '0px',
        width: '1px',
        height: '1px',
        opacity: 0,
        pointerEvents: 'none',
        zIndex: -1,
      }
      }),

      React.createElement(CompetitorMasterDrawer, {
        visible: competitorMasterVisible,
        onClose: () => setCompetitorMasterVisible(false),
        countryAsinOptions,
        country: filterCountry,
        asin: filterAsin,
        onRefresh: refreshData,
      }),

      React.createElement(SqpTermManagerModal, {
        visible: sqpTermManagerVisible,
        onClose: () => setSqpTermManagerVisible(false),
        country: filterCountry,
        asin: filterAsin,
        onRefresh: refreshData,
      }),

      React.createElement('div', {
        ref: tableWrapRef,
        tabIndex: 0,
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleKeyDown,
        onMouseUp: stopSelecting,
        onMouseLeave: stopSelecting,
        style: {
          overflowX: 'auto',
          overflowY: 'auto',
          height: `${tableWrapHeight}px`,
          borderRadius: '8px',
          border: '1px solid #d9d9d9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          outline: 'none'
        } },
        loading && data.length === 0
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '正在加载数据...')
          : data.length === 0
            ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据')
            : React.createElement('table', { style: { borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', background: '#fff', width: `${tableWidth}px` } },
              React.createElement('colgroup', null,
                visibleCols.map((col) => React.createElement('col', {
                  key: `${col.key}_col`,
                  style: { width: `${col.width || 80}px` },
                }))
              ),
              React.createElement('thead', null,
                React.createElement('tr', null,
                  visibleCols.map((col) => {
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const hdrColor = getColHeaderColor(col);
                    const formulaTooltip = FORMULA_TOOLTIPS[col.field] || null;
                    const headerTooltip = getHeaderTooltipData(col);
                    const isCompetitorSubCol = !!col._isCompetitorSubColumn;

                    if (isCompetitorSubCol) {
                      const groupCols = visibleCols.filter((c) => c._competitorGroupKey === col._competitorGroupKey);
                      if (groupCols[0]?.key !== col.key) return null;
                      const groupWidth = groupCols.reduce((sum, item) => sum + (item.width || 80), 0);
                      const groupSortKey = groupCols.find((item) => item._competitorField === 'rank')?.key || col.key;
                      const groupHdrColor = col._competitorGroupHeaderColor || getCompetitorColor(col._competitorRole) || hdrColor;

                      return React.createElement('th', {
                        colSpan: groupCols.length,
                        key: col._competitorGroupKey,
                        draggable: true,
                        onDragStart: (e) => onDragStart(e, col.key),
                        onDragOver,
                        onDrop: (e) => onDrop(e, col.key),
                        style: {
                          position: 'sticky',
                          top: 0,
                          left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 4 : 2,
                          width: `${groupWidth}px`,
                          height: `${HEADER_MAIN_HEIGHT}px`,
                          padding: '2px 6px',
                          background: groupHdrColor,
                          color: getTextColorForBg(groupHdrColor),
                          borderBottom: '1px solid rgba(0,0,0,0.08)',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                          textAlign: 'center',
                          fontWeight: 600,
                          fontSize: `${FONT_SIZE_XS}px`,
                          userSelect: 'none',
                          cursor: 'default',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                          overflow: 'hidden'
                        },
                      },
                        React.createElement('span', {
                          style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          maxWidth: '100%',
                            overflow: 'hidden',
                            verticalAlign: 'middle',
                          }
                        },
                          renderCompetitorGroupHeaderLabel(col),
                        )
                      );
                    }
                    
                    return React.createElement('th', {
                      rowSpan: hasCompetitorColumns ? 2 : 1,
                      key: col.key, draggable: true, onDragStart: (e) => onDragStart(e, col.key), onDragOver, onDrop: (e) => onDrop(e, col.key), onClick: () => handleSort(col.key),
                      style: {
                        position: 'sticky',
                        top: 0,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${col.width || 80}px`,
                        padding: '5px 6px',
                        background: hdrColor,
                        color: getTextColorForBg(hdrColor),
                        borderBottom: '2px solid rgba(0,0,0,0.1)',
                        borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: `${FONT_SIZE_SM}px`,
                        userSelect: 'none',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      },
                    },
                      React.createElement('span', {
                        style: {
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '100%',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          verticalAlign: 'middle',
                        }
                      },
                        renderHeaderLabel(col.label, headerTooltip),

                        formulaTooltip && React.createElement(Tooltip, {
                          title: renderTooltip(formulaTooltip),
                          placement: 'top',
                          overlayStyle: { maxWidth: '360px' },
                          mouseEnterDelay: 0.15,
                        },
                          React.createElement('span', {
                            onClick: (e) => e.stopPropagation(),
                            onMouseDown: (e) => e.stopPropagation(),
                            draggable: false,
                            onDragStart: (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            },
                            style: {
                              marginLeft: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              height: '15px',
                              minWidth: '20px',
                              padding: '0 4px',
                              borderRadius: '999px',
                              background: 'rgba(255,255,255,0.24)',
                              border: '1px solid rgba(255,255,255,0.45)',
                              color: 'currentColor',
                              fontSize: '10px',
                              fontWeight: 800,
                              cursor: 'help',
                              flexShrink: 0,
                              lineHeight: '13px',
                              opacity: 0.78,
                              letterSpacing: 0,
                            },
                          }, 'fx')
                        ),

                        renderSortMark(col.key),
                      ),
                      React.createElement('div', {
                        onMouseDown: (e) => onResizeStart(e, col.key),
                        onClick: (e) => e.stopPropagation(),
                        style: {
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '6px',
                          cursor: 'col-resize',
                          zIndex: 2,
                          background: 'transparent'
                        }
                      }),
                    );
                  })
                ),
                hasCompetitorColumns && React.createElement('tr', null,
                  visibleCols.map((col) => {
                    if (!col._isCompetitorSubColumn) return null;
                    const isPinned = col.pinned;
                    const leftOff = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const hdrColor = getColHeaderColor(col);
                    const textColor = getTextColorForBg(hdrColor);
                    return React.createElement('th', {
                      key: `${col.key}_sub`,
                      draggable: true,
                      onDragStart: (e) => onDragStart(e, col.key),
                      onDragOver,
                      onDrop: (e) => onDrop(e, col.key),
                      onClick: () => handleSort(col.key),
                      style: {
                        position: 'sticky',
                        top: `${HEADER_MAIN_HEIGHT}px`,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${col.width || 80}px`,
                        height: `${HEADER_SUB_HEIGHT}px`,
                        padding: '2px 4px',
                        background: hdrColor,
                        borderBottom: '2px solid rgba(0,0,0,0.12)',
                        borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        userSelect: 'none',
                        textAlign: 'center',
                      },
                    },
                      React.createElement('span', {
                        style: {
                          display: 'inline-flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          width: '100%',
                          overflow: 'hidden',
                        },
                      },
                        renderHeaderLabel(col._competitorSubLabel || col.label, getCompetitorSubTooltipData(col), {
                          fontSize: '11px',
                          fontWeight: 700,
                          color: textColor,
                        }),
                        renderSortMark(col.key),
                      ),
                      React.createElement('div', {
                        onMouseDown: (e) => onResizeStart(e, col.key),
                        onClick: (e) => e.stopPropagation(),
                        style: {
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '6px',
                          cursor: 'col-resize',
                          zIndex: 2,
                          background: 'transparent'
                        }
                      })
                    );
                  })
                )
              ),
              React.createElement('tbody', null,
                pagedData.map((row, rIdx) => {
                  const rowId = row.country_asin_date || row.id;
                  return React.createElement('tr', { key: rowId || rIdx, style: { background: rIdx % 2 === 0 ? '#fff' : '#fafafa' } },
                    visibleCols.map((col) => {
                      const isPinned  = col.pinned;
                      const leftOff   = isPinned ? pinnedLeftMap[col.key] : undefined;
                      const dynFn     = DYNAMIC_COLOR[col.field] || DYNAMIC_COLOR[col.key];
                      const cellColor = dynFn ? dynFn(row) : null;
                      const isNum     = ALL_NUMERIC.has(col.field);
                      const canEdit   = isCellEditable(col);
                      const isEditing = editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key;
                      const cIdx      = visibleCols.findIndex((c) => c.key === col.key);
                      const selected  = isCellSelected(rIdx, cIdx);

                      if ((col._dynamicKind && col.richEdit === true) || RICH_TEXT_FIELDS.has(col.field)) {
                        const richValue =
                          col._dynamicKind === 'keyword'
                            ? row[col.field]?.daily?.actual_rank
                            : col._dynamicKind === 'competitor'
                            ? row[col.field]?.daily?.[col._competitorField || 'notes']
                            : row[col.field];
                        const saveRich =
                          col._dynamicKind === 'keyword'
                            ? (next) => saveKeywordRichCell(row, col, next)
                            : col._dynamicKind === 'competitor'
                            ? (next) => saveCompetitorRichCell(row, col, next)
                            : (next) => saveOrderLinkRichField(row, col.field, next);

                        return React.createElement('td', {
                          key: col.key,
                          onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                          onMouseEnter: () => handleCellMouseEnter(rIdx, cIdx),
                          style: {
                            position: isPinned ? 'sticky' : undefined,
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 1 : undefined,
                            background: getBodyCellBackground(rIdx, cIdx, selected),
                            padding: '2px',
                            borderBottom: '1px solid #f0f0f0',
                            borderRight: isPinned ? '2px solid rgba(0,0,0,0.08)' : '1px solid #f5f5f5',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined,
                          },
                        }, React.createElement(RichTextImageCell, {
                          value: richValue,
                          onSave: saveRich,
                          placeholder: '+',
                        }));
                      }

                      const displayContent = formatCell(col, row);
                      const renderedContent = renderCellDisplay(col, row);

                      return React.createElement('td', {
                        key: col.key, title: typeof displayContent === 'string' ? displayContent : undefined,
                        onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                        onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, getEditableValue(row, col)); },
                        style: {
                          position: isPinned ? 'sticky' : undefined,
                          left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 1 : undefined,
                          background: getBodyCellBackground(rIdx, cIdx, selected),
                          padding: isEditing ? '3px 5px' : '5px 8px',
                          borderBottom: '1px solid #f0f0f0',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.08)' : '1px solid #f5f5f5',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                          color: cellColor || '#333',
                          fontWeight: cellColor ? 600 : 'normal',
                          fontSize: `${FONT_SIZE}px`,
                          boxSizing: 'border-box',
                          cursor: canEdit && !isEditing ? 'cell' : 'default',
                          outline: canEdit && !isEditing ? '1px dashed transparent' : undefined,
                          boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined
                        },
                        onMouseEnter: (e) => {
                          handleCellMouseEnter(rIdx, cIdx);
                          if (canEdit && !isEditing) e.currentTarget.style.outline = '1px dashed #1890ff';
                        },
                        onMouseLeave: canEdit && !isEditing ? (e) => { e.currentTarget.style.outline = '1px dashed transparent'; } : undefined,
                      }, isEditing ? renderEditInput(col) : renderedContent);
                    })
                  );
                })
              )
            )
      ),

      React.createElement('div', { style: { marginTop: '0px', display: 'flex', justifyContent: 'flex-end' } },
        React.createElement(Pagination, { current: curPage, pageSize, total, pageSizeOptions: PAGE_SIZE_OPTIONS, showSizeChanger: true, showQuickJumper: true, showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`, onChange: onPageChange, onShowSizeChange: onPageChange, disabled: loading })
      )
    );
  };

  const TableApp = () => {
    const zhCN = {
      locale: 'zh_CN',
      DatePicker: DATE_PICKER_LOCALE,
    };
    return React.createElement(ConfigProvider, { locale: zhCN },
      React.createElement('div', { style: { padding: '0', fontFamily: 'system-ui, sans-serif', fontSize: `${FONT_SIZE}px` } },
        React.createElement(MergedTable, null)
      )
    );
  };

  ctx.render(React.createElement(TableApp));
}

run();
