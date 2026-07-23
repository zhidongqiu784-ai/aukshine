async function run() {
  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect, useSyncExternalStore } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Drawer, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const COLUMN_VIEW_SETTING_KEY = `${BLOCK_UID}__column_view_setting`;
  const DEFAULT_COLUMN_VIEWS_KEY = `${BLOCK_UID}__default_column_views`;
  const BLOCK_NAME       = '合并板块';
  const BLOCK_NAME_SETTING_KEY = `${BLOCK_UID}__block_name`;
  const COLUMN_GROUP_ORDER_KEY = '__column_group_order';
  const COLUMN_PAGE_SIZE_KEY = '__page_size';
  const IS_ADMIN         = currentUserLevel === 3;
  const DEFAULT_COLUMN_VIEW_IDS = ['default_1', 'default_2'];
  const DEFAULT_COLUMN_VIEW_LABELS = {
    default_1: '完整列',
    default_2: '核心列',
  };
  const CORE_COLUMN_VIEW_ID = DEFAULT_COLUMN_VIEW_IDS[1];

  const FONT_SIZE    = 15;
  const FONT_SIZE_SM = FONT_SIZE - 1;
  const FONT_SIZE_XS = FONT_SIZE - 2;
  const normalizeSearchText = (text) => String(text || '').trim().toLowerCase();

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
  const PAGINATION_LOCALE = {
    items_per_page: '条/页',
    jump_to: '跳至',
    jump_to_confirm: '确定',
    page: '页',
    prev_page: '上一页',
    next_page: '下一页',
    prev_5: '向前 5 页',
    next_5: '向后 5 页',
    prev_3: '向前 3 页',
    next_3: '向后 3 页',
    page_size: '页码',
  };

  const GLOBAL_KEY     = '__urlParams_global';
  const SK_MODEL       = '__up_model';
  const SK_COUNTRY     = '__up_country';
  const SK_ASIN        = '__up_asin';
  const SK_SALE_OWNER  = '__up_saleOwner';
  const SK_STATUS      = '__up_status';
  const readGlobal     = () => ctx.engine[GLOBAL_KEY] || null;
  const writeGlobal    = (data) => {
    ctx.engine[GLOBAL_KEY] = data ? {
      model: data.model || null,
      country: data.country || null,
      asin: data.asin || null,
      sale_owner: data.saleOwner || data.sale_owner || null,
      status: data.status || null,
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
    saveToEngine(SK_STATUS,     params?.status);
  }

  function loadCachedParams() {
    const globalParams = readGlobal() || {};
    return {
      model:     getFromEngine(SK_MODEL)      || globalParams.model      || null,
      country:   getFromEngine(SK_COUNTRY)    || globalParams.country    || null,
      asin:      getFromEngine(SK_ASIN)       || globalParams.asin       || null,
      saleOwner: getFromEngine(SK_SALE_OWNER) || globalParams.saleOwner  || globalParams.sale_owner || null,
      status:    getFromEngine(SK_STATUS)     || globalParams.status     || null,
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
    if (params.status)    parts.push('status='     + encodeURIComponent(params.status));
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
    const status    = p['status']     || cached.status    || null;

    return { model, country, asin, saleOwner, status };
  }

  function hasUrlParams(params) {
    return !!(params?.model || params?.country || params?.asin || params?.saleOwner || params?.sale_owner || params?.status);
  }

  function needPatchSearch(parsed, params) {
    return (
      (!parsed['model']      && params.model)     ||
      (!parsed['country']    && params.country)   ||
      (!parsed['asin']       && params.asin)      ||
      (!parsed['sale_owner'] && params.saleOwner) ||
      (!parsed['status']     && params.status)
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
  const GROUP_COLOR_ORDER_STRUCTURE = '#F6CCAC';
  const GROUP_COLOR_TRAFFIC         = '#E4EDDB';
  const GROUP_COLOR_LINK_TRACKING   = '#D8C8E8';
  const GROUP_COLOR_LINK_NOTES      = '#B2C7E6';
  const GROUP_COLOR_AD_DATA         = '#FEE598';
  const GROUP_COLOR_PROFIT          = '#0071C1';
  const GROUP_COLOR_FIXED           = '#B9D7C3';
  const GROUP_COLOR_COUPON_FLASH    = '#F4C7D7';
  const GROUP_COLOR_OPS_TARGET      = '#DAD7A6';
  const GROUP_COLOR_TARGET_AD       = '#E8C48F';
  const GROUP_COLOR_KEYWORD         = '#C9D7F2';
  const GROUP_COLOR_COMPETITOR      = '#CBB4D9';
  const GROUP_COLOR_OTHER           = '#D6DADF';

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
    { label:'',          value:'#FCC102' },
    { label:'',          value:'#9C79D9' },
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
    daily:  COLOR_GREEN,
    weekly: COLOR_ORANGE,
    target: COLOR_PURPLE,
    profit: COLOR_TEAL,
    product_config: COLOR_GRAY,
    order_link: COLOR_ROSE,
    keyword_position: COLOR_YELLOW,
    competitor: COLOR_BLUE,
  };

  const IMPORTANT_COLUMN_BODY_COLOR = '#BADDB1';
  const getColHeaderColor = (col) => col.headerColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;
  const getColBodyColor = (col) => col?.bodyColor || null;

  const withCreateTimestamps = (payload) => {
    const now = new Date().toISOString();
    return {
      ...payload,
      created_at: payload?.created_at || now,
      updated_at: payload?.updated_at || now,
    };
  };

  const getTextColorForBg = (hexColor) => {
    if (!hexColor || hexColor.length < 7) return '#333';
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? '#222' : '#fff';
  };

  const PAGE_SIZE_OPTIONS = ['10','20','50','100'];
  const DEFAULT_PAGE_SIZE = 20;
  const normalizePageSizeValue = (value) => {
    const n = Number(value);
    return PAGE_SIZE_OPTIONS.includes(String(n)) ? n : DEFAULT_PAGE_SIZE;
  };

  // 日期筛选选项
  const DATE_FILTER_OPTIONS = [
    { label: '近7天及以后', value: 'recent_future' },
    { label: '全部日期',  value: 'all'        },
    { label: '今天',      value: 'today'      },
    { label: '昨天',      value: 'yesterday'  },
    { label: '近 7 天',   value: '7d'         },
    { label: '近 30 天',  value: '30d'        },
    { label: '近 90 天',  value: '90d'        },
    { label: '本月',      value: 'this_month' },
    { label: '上月',      value: 'last_month' },
    { label: '自定义',    value: 'custom'     },
  ];

  const ORDER_STRUCTURE_DIAGNOSED_MAP = { match:'符合', not_match:'不符合' };
  const ORDER_STRUCTURE_DIAGNOSED_OPTIONS = [
    { label:'符合', value:'match' },
    { label:'不符合', value:'not_match' },
  ];

  const INITIAL_COLUMNS = [
    { key:'daily_country',                      src:'daily',  field:'country',                      label:'国家',            hidden:false, pinned:true,  width:70,  editable:false, columnGroup:'other' },
    { key:'daily_asin',                         src:'daily',  field:'asin',                         label:'ASIN',            hidden:false, pinned:true,  width:110, editable:false, columnGroup:'other' },
    { key:'daily_date',                         src:'daily',  field:'date',                         label:'站点时间',        hidden:false, pinned:true,  width:100, editable:false, columnGroup:'fixed' },
    { key:'daily_promotion_days',               src:'daily',  field:'promotion_days',               label:'推广天数',        hidden:false, pinned:true, width:80,  editable:false, columnGroup:'fixed' },
    { key:'daily_activity_annotation',          src:'daily',  field:'activity_annotation',          label:'活动标注',        hidden:false, pinned:true, width:90,  editable:false, columnGroup:'fixed' },
    { key:'daily_list_price',                   src:'daily',  field:'list_price',                   label:'LP/WP/TP',         hidden:false, pinned:true, width:80,  editable:false, columnGroup:'fixed' },
    { key:'daily_lp_duration_days',             src:'daily',  field:'lp_duration_days',             label:'本划线价持续天数',     hidden:false, pinned:true, width:90,  editable:false, columnGroup:'fixed', headerWrap:true },
    { key:'daily_off',                          src:'daily',  field:'off',                          label:'Off 力度',        hidden:false, pinned:true, width:80,  editable:false, columnGroup:'fixed' },
    { key:'daily_daily_price',                  src:'daily',  field:'daily_price',                  label:'购物车价格',      hidden:false, pinned:true, width:90,  editable:false, columnGroup:'fixed' },
    { key:'daily_price_after_discount',         src:'daily',  field:'price_after_discount',         label:'折后售价',          hidden:false, pinned:true, width:80,  editable:false, columnGroup:'fixed' },
    { key:'order_link_net_price_without_tax',             src:'order_link', field:'net_price_without_tax',             label:'成交额-去掉税费',             hidden:false, pinned:true, width:120, editable:false, columnGroup:'fixed', headerWrap:true },
    { key:'daily_selling_accounts',             src:'daily',  field:'selling_accounts',             label:'售卖账号',        hidden:false, pinned:true, width:100, editable:false, columnGroup:'fixed' },
    { key:'target_target_subcategory_rank',       src:'target', field:'target_subcategory_rank',       label:'目标拆解 - 小类排名', hidden:false, pinned:true, width:130, editable:false, columnGroup:'fixed', headerWrap:true },
    { key:'target_target_order_qty',              src:'target', field:'target_order_qty',              label:'目标拆解 - 单量',     hidden:false, pinned:true, width:110, editable:false, columnGroup:'fixed' },
    { key:'weekly_order_items',                 src:'weekly', field:'sales',                        label:'实际总单量',      hidden:false, pinned:true, width:80,  editable:false, columnGroup:'fixed' },
    { key:'daily_target_gap',                   src:'daily',  field:'target_gap',                   label:'目标差距',        hidden:false, pinned:true, width:80,  editable:false, columnGroup:'fixed' },
    { key:'order_link_review_discounted_price',          src:'order_link', field:'review_discounted_price',            label:'测评折后价',             hidden:false, pinned:false, width:100, editable:true, columnGroup:'order_structure' },
    { key:'order_link_review_actual_price',              src:'order_link', field:'review_actual_price',                label:'测评成交价',             hidden:false, pinned:false, width:100, editable:false, columnGroup:'order_structure' },
    { key:'daily_rsg_number',                   src:'daily',  field:'rsg_number',                   label:'①测评单',    hidden:false, pinned:false, width:80,  editable:false, columnGroup:'order_structure' },
    { key:'order_link_total_onsite_orders',              src:'order_link', field:'total_onsite_orders',                label:'②站内:纯自然+广告单',                 hidden:false, pinned:false, width:90,  editable:false, columnGroup:'order_structure' },
    { key:'order_link_onsite_organic_orders',            src:'order_link', field:'onsite_organic_orders',              label:'③站内纯自然单',           hidden:false, pinned:false, width:110, editable:false, columnGroup:'order_structure' },
    { key:'order_link_onsite_ad_orders',                 src:'order_link', field:'onsite_ad_orders',                   label:'④站内总广告单',           hidden:false, pinned:false, width:110, editable:false, columnGroup:'order_structure' },
    { key:'order_link_review_orders_ratio',              src:'order_link', field:'review_orders_ratio',                label:'①测评单占比',             hidden:false, pinned:false, width:110, editable:false, columnGroup:'order_structure' },
    { key:'order_link_onsite_orders_ratio',              src:'order_link', field:'onsite_orders_ratio',                label:'②站内:纯自然+广告单占比',               hidden:false, pinned:false, width:100, editable:false, columnGroup:'order_structure' },
    { key:'order_link_onsite_organic_orders_ratio',      src:'order_link', field:'onsite_organic_orders_ratio',        label:'③站内纯自然单占比',       hidden:false, pinned:false, width:130, editable:false, columnGroup:'order_structure' },
    { key:'order_link_onsite_ad_orders_ratio',           src:'order_link', field:'onsite_ad_orders_ratio',             label:'④站内总广告单占比',       hidden:false, pinned:false, width:130, editable:false, columnGroup:'order_structure' },
    { key:'weekly_sessions_mobile',             src:'weekly', field:'sessions_mobile',              label:'手机端流量', hidden:false, pinned:false, width:130, editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_sessions',                    src:'weekly', field:'sessions',                     label:'电脑端流量',hidden:false, pinned:false, width:130, editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_zongliuliang',                src:'weekly', field:'zongliuliang',                 label:'汇总流量-会话量',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_page_views_total',            src:'weekly', field:'page_views_total',             label:'页面浏览量',        hidden:false, pinned:false, width:90,  editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_organic_traffic',             src:'weekly', field:'organic_traffic',              label:'自然流量(会话量-广告点击)',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_guanggaodianji',              src:'weekly', field:'guanggaodianji',               label:'广告点击',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_natural_traffic_proportion',  src:'weekly', field:'natural_traffic_proportion',   label:'自然流量占比',    hidden:false, pinned:false, width:100, editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_guanggaocvr',                 src:'weekly', field:'guanggaocvr',                  label:'广告转化率',        hidden:false, pinned:false, width:90,  editable:false, columnGroup:'traffic_conversion' },
    { key:'weekly_zongcvr',                     src:'weekly', field:'session_conversion_rate',      label:'会话转化率',  hidden:false, pinned:false, width:80,  editable:false, columnGroup:'traffic_conversion' },
    { key:'order_link_real_session_conversion_rate',      src:'order_link', field:'order_link_real_session_conversion_rate', label:'真实会话转化率（剔除测评单）', hidden:false, pinned:false, width:160, editable:false, columnGroup:'traffic_conversion' },
    { key:'order_link_page_view_conversion_rate',         src:'order_link', field:'page_view_conversion_rate',         label:'页面浏览转化率',             hidden:false, pinned:false, width:120, editable:false, columnGroup:'traffic_conversion' },
    { key:'order_link_formula_review_rate',              src:'order_link', field:'formula_review_rate',                label:'公式算-留评率',           hidden:false, pinned:false, width:120, editable:false, columnGroup:'link_tracking' },
    { key:'order_link_review_screenshot',                src:'order_link', field:'review_screenshot',                 label:'review 详细截图',        hidden:false, pinned:false, width:140, editable:true, richEdit:true, columnGroup:'link_tracking' },
    { key:'order_link_bad_review_notes',                 src:'order_link', field:'bad_review_notes',                  label:'差评 rating/差评',       hidden:false, pinned:false, width:120, editable:true, richEdit:true, columnGroup:'link_tracking' },
    { key:'order_link_keyword_trend_screenshot',         src:'order_link', field:'keyword_trend_screenshot',          label:'Asin 西柚/sif 搜索词排名趋势截图', hidden:false, pinned:false, width:160, editable:true, richEdit:true, columnGroup:'link_tracking' },
    { key:'order_link_ad_framework_screenshot',          src:'order_link', field:'ad_framework_screenshot',           label:'Asin 广告框架截图',      hidden:false, pinned:false, width:140, editable:true, richEdit:true, columnGroup:'link_tracking' },
    { key:'order_link_keyword_performance_screenshot',   src:'order_link', field:'keyword_performance_screenshot',    label:'Asin 搜索词表现截图',    hidden:false, pinned:false, width:150, editable:true, richEdit:true, columnGroup:'link_tracking' },
    { key:'order_link_page_screenshot',                  src:'order_link', field:'page_screenshot',                   label:'自己页面截图',           hidden:false, pinned:false, width:120, editable:true, richEdit:true, columnGroup:'link_tracking' },
    { key:'order_link_link_problem',                     src:'order_link', field:'link_problem',                       label:'链接问题',                 hidden:false, pinned:false, width:100, editable:true, richEdit:true, columnGroup:'link_notes' },
    { key:'order_link_operation_record',                 src:'order_link', field:'operation_record',                   label:'今日操作记录',       hidden:false, pinned:false, width:160, editable:true, richEdit:true, columnGroup:'link_notes' },
    { key:'order_link_review_notes',                     src:'order_link', field:'review_notes',                       label:'复盘',               hidden:false, pinned:false, width:100, editable:true, richEdit:true, columnGroup:'link_notes' },
    { key:'order_link_ad_optimization_logs',             src:'order_link', field:'ad_optimization_logs',               label:'广告优化操作动作记录 (大方向记录)',         hidden:false, pinned:false, width:160, editable:true, richEdit:true, columnGroup:'link_notes' },
    { key:'weekly_adv_rate',                    src:'weekly', field:'adv_rate',                     label:'广告订单量占比',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'ad_data' },
    { key:'weekly_natural_single_ratio',        src:'order_link', field:'onsite_organic_orders_ratio', label:'纯站内自然单占比',      hidden:false, pinned:false, width:120, editable:false, columnGroup:'ad_data' },
    { key:'weekly_impressions',                 src:'weekly', field:'impressions',                  label:'曝光量',          hidden:false, pinned:false, width:80,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_weekly_ad_total_budget',      src:'weekly', field:'weekly_ad_total_budget',       label:'本周广告总预算',  hidden:false, pinned:false, width:130, editable:false, columnGroup:'ad_data' },
    { key:'weekly_guanggaohuafei',              src:'weekly', field:'guanggaohuafei',               label:'广告花费',        hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_guanggaodan',                 src:'weekly', field:'guanggaodan',                  label:'广告总单量',      hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_ad_sales_amount',             src:'weekly', field:'ad_sales_amount',              label:'广告销售额',      hidden:false, pinned:false, width:100, editable:false, columnGroup:'ad_data' },
    { key:'weekly_ctr',                         src:'weekly', field:'ctr',                          label:'CTR',             hidden:false, pinned:false, width:70,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_cpc',                         src:'weekly', field:'cpc',                          label:'CPC',             hidden:false, pinned:false, width:70,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_acos',                        src:'weekly', field:'acos',                         label:'ACOS',            hidden:false, pinned:false, width:80,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_cvr',                   src:'weekly', field:'guanggaocvr',                 label:'CVR',             hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_cpa',                         src:'weekly', field:'cpa',                          label:'CPA',             hidden:false, pinned:false, width:80,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_cpu',                         src:'weekly', field:'cpu',                          label:'CPU',             hidden:false, pinned:false, width:80,  editable:false, columnGroup:'ad_data' },
    { key:'profit_tacos',                       src:'profit', field:'tacos',                        label:'TACOS',           hidden:false, pinned:false, width:80,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_indirect_order_volume',       src:'weekly', field:'indirect_order_volume',        label:'间接跑单订单量',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'ad_data' },
    { key:'weekly_ads_sp_cost',                 src:'weekly', field:'ads_sp_cost',                  label:'SP 广告费',       hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_ads_sd_cost',                 src:'weekly', field:'ads_sd_cost',                  label:'SD 广告费',       hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_shared_ads_sb_cost',          src:'weekly', field:'shared_ads_sb_cost',           label:'SB 广告费',       hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_shared_ads_sbv_cost',         src:'weekly', field:'shared_ads_sbv_cost',         label:'SBV 广告费',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'ad_data' },
    { key:'profit_unit_profit_local',          src:'profit', field:'unit_profit_local',          label:'单个利润（不算测评和广告，算了退货）当地币',         hidden:false, pinned:false, width:90,  editable:false, columnGroup:'profit' },
    { key:'profit_review_refund_per_unit',     src:'profit', field:'review_refund_per_unit',     label:'单个测评返款金额（当地币）-（负数）',     hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_review_refund_cost',         src:'profit', field:'review_refund_cost',         label:'测评总返款费',     hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_review_unit_profit',         src:'profit', field:'review_unit_profit',         label:'单个测评订单的售价回款利润金额',   hidden:false, pinned:false, width:110, editable:false, columnGroup:'profit' },
    { key:'profit_review_refund_total',        src:'profit', field:'review_refund_total',        label:'总测评回款金额',     hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_net_profit_local',           src:'profit', field:'net_profit_local',           label:'纯利润（当地币）',           hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_net_revenue_local',          src:'profit', field:'net_revenue_local',          label:'净销售额（当地币）-算利润率',         hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_gross_revenue_local',        src:'profit', field:'gross_revenue_local',        label:'成交额-算费率',           hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_profit_margin',              src:'profit', field:'profit_margin',              label:'利润率（忽略coupon使用率）',           hidden:false, pinned:false, width:100,  editable:false, columnGroup:'profit' },
    { key:'profit_ad_cost_ratio',              src:'profit', field:'ad_cost_ratio',              label:'广告费率',         hidden:false, pinned:false, width:80,  editable:false, columnGroup:'profit' },
    { key:'profit_review_cost_ratio',          src:'profit', field:'review_cost_ratio',         label:'测评费率',         hidden:false, pinned:false, width:80,  editable:false, columnGroup:'profit' },
    { key:'profit_offsite_commission_cost',    src:'profit', field:'offsite_commission_cost',    label:'站外佣金费',       hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_offsite_cost_per_order',     src:'profit', field:'offsite_cost_per_order',     label:'站外单均成本',     hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_product_cost_total',         src:'profit', field:'product_cost_total',         label:'产品成本费',       hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_product_cost_ratio',         src:'profit', field:'product_cost_ratio',         label:'产品成本占比',     hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'target_weekly_target_completion_rate', src:'target', field:'weekly_target_completion_rate', label:'本周目标完成率',      hidden:false, pinned:false, width:120, editable:false, columnGroup:'ops_target' },
    { key:'target_goal_subcategory_rank',         src:'target', field:'goal_subcategory_rank',         label:'目标小类排名',        hidden:false, pinned:false, width:110, editable:false, columnGroup:'ops_target' },
    { key:'target_sales_mom_rate',                src:'target', field:'sales_mom_rate',                label:'销量环比变化',        hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ops_target' },
    { key:'target_target_ad_cvr_formula',         src:'target', field:'target_ad_cvr_formula',         label:'目标广告 CVR', hidden:false, pinned:false, width:140, editable:false, columnGroup:'ops_target' },
    { key:'target_target_cpa_formula',            src:'target', field:'target_cpa_formula',            label:'目标 CPA',     hidden:false, pinned:false, width:130, editable:false, columnGroup:'ops_target' },
    { key:'target_ideal_cpu_by_margin_formula',   src:'target', field:'ideal_cpu_by_margin_formula',   label:'目标 CPU',     hidden:false, pinned:false, width:130, editable:false, columnGroup:'ops_target' },
    { key:'target_target_profit_margin_formula',  src:'target', field:'target_profit_margin_formula',  label:'目标利润率',   hidden:false, pinned:false, width:130, editable:false, columnGroup:'ops_target' },
    { key:'target_target_ad_spend_rate_formula',  src:'target', field:'target_ad_spend_rate_formula',  label:'目标广告费率', hidden:false, pinned:false, width:140, editable:false, columnGroup:'ops_target' },
    { key:'daily_model',                        src:'daily',  field:'model',                        label:'型号',            hidden:false, pinned:false, width:100, editable:false, columnGroup:'other' },
    { key:'daily_star_rating',                  src:'daily',  field:'star_rating',                  label:'星级',            hidden:false, pinned:false, width:70,  editable:false, columnGroup:'link_tracking' },
    { key:'daily_number_of_comments',           src:'daily',  field:'number_of_comments',           label:'review数量',          hidden:false, pinned:false, width:70,  editable:false, columnGroup:'link_tracking' },
    { key:'daily_promo_day',              src:'daily',  field:'promo_day',                   label:'是否促销',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'other' },
    { key:'daily_promo_days_40d',         src:'daily',  field:'promo_days_40d',              label:'前40天促销天数',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'daily_promo_days_90d',         src:'daily',  field:'promo_days_90d',              label:'前90天促销天数',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'daily_today_operation',              src:'daily',  field:'today_operation',              label:'今日操作记录',    hidden:false, pinned:false, width:160, editable:false, columnGroup:'other' },
    { key:'daily_updatedAt',                    src:'daily',  field:'updatedAt',                    label:'更新时间',        hidden:false, pinned:false, width:100, editable:false, columnGroup:'other' },
    { key:'weekly_sales',                       src:'weekly', field:'sales',                        label:'销量',            hidden:false, pinned:false, width:80,  editable:false, columnGroup:'other' },
    { key:'weekly_zirandan',                    src:'weekly', field:'zirandan',                     label:'实际自然单',      hidden:false, pinned:false, width:90,  editable:false, columnGroup:'other' },
    { key:'weekly_ad_direct_order_quantity',    src:'weekly', field:'ad_direct_order_quantity',     label:'直接成交订单量',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'weekly_ad_direct_sales_amount',      src:'weekly', field:'ad_direct_sales_amount',       label:'直接成交额',      hidden:false, pinned:false, width:100, editable:false, columnGroup:'other' },
    { key:'weekly_page_views',                  src:'weekly', field:'page_views',                   label:'PV-Browser',      hidden:false, pinned:false, width:100, editable:false, columnGroup:'other' },
    { key:'weekly_page_views_mobile',           src:'weekly', field:'page_views_mobile',            label:'PV-Mobile',       hidden:false, pinned:false, width:100, editable:false, columnGroup:'other' },
    { key:'weekly_ads_sp_sales',                src:'weekly', field:'ads_sp_sales',                 label:'SP 广告销售额',   hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'weekly_ads_sd_sales',                src:'weekly', field:'ads_sd_sales',                 label:'SD 广告销售额',   hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'weekly_shared_ads_sb_sales',         src:'weekly', field:'shared_ads_sb_sales',          label:'SB 广告销售额',   hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'weekly_shared_ads_sbv_sales',         src:'weekly', field:'shared_ads_sbv_sales',         label:'SBV 广告销售额',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'weekly_return_count',                src:'weekly', field:'return_count',                 label:'退款量',          hidden:false, pinned:false, width:70,  editable:false, columnGroup:'other' },
    { key:'weekly_return_rate',                 src:'weekly', field:'return_rate',                  label:'退款率',          hidden:false, pinned:false, width:70,  editable:false, columnGroup:'other' },
    { key:'weekly_return_goods_count',          src:'weekly', field:'return_goods_count',           label:'退货量',          hidden:false, pinned:false, width:70,  editable:false, columnGroup:'link_tracking' },
    { key:'weekly_return_goods_rate',           src:'weekly', field:'return_goods_rate',            label:'退货率',          hidden:false, pinned:false, width:70,  editable:false, columnGroup:'link_tracking' },
    { key:'weekly_category',                    src:'weekly', field:'category',                     label:'类别',            hidden:false, pinned:false, width:80,  editable:false, columnGroup:'other' },
    { key:'weekly_date',                        src:'weekly', field:'date',                         label:'周日期',          hidden:false, pinned:false, width:100, editable:false, columnGroup:'other' },
    { key:'weekly_zirandianji',                 src:'weekly', field:'zirandianji',                  label:'自然点击',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'other' },
    { key:'weekly_prev_rank',                   src:'weekly', field:'prev_rank',                    label:'上一次小类排名',  hidden:false, pinned:false, width:110, editable:false, columnGroup:'other' },
    { key:'weekly_prev_star',                   src:'weekly', field:'prev_star',                    label:'前一个评分',      hidden:false, pinned:false, width:90,  editable:false, columnGroup:'other' },
    { key:'weekly_avg_star',                    src:'weekly', field:'avg_star',                     label:'评分',            hidden:false, pinned:false, width:70,  editable:false, columnGroup:'other' },
    { key:'weekly_reviews_count',               src:'weekly', field:'reviews_count',                label:'评论数量',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'other' },
    { key:'weekly_promotion_volume',            src:'weekly', field:'promotion_volume',             label:'促销销量',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'other' },
    { key:'weekly_b2b_volume',                  src:'weekly', field:'b2b_volume',                   label:'B2B 销量',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'other' },
    { key:'profit_cumulative_break_even',      src:'profit', field:'cumulative_break_even',      label:'累计盈亏平衡（当地币）',         hidden:false, pinned:false, width:100, editable:false, columnGroup:'profit' },
    { key:'profit_unit_profit_after_ad_local', src:'profit', field:'unit_profit_after_ad_local', label:'单台利润（当地币）',   hidden:false, pinned:false, width:110, editable:false, columnGroup:'profit' },
    { key:'profit_unit_profit_rmb',            src:'profit', field:'unit_profit_rmb',            label:'单台利润（RMB）',    hidden:false, pinned:false, width:110, editable:false, columnGroup:'profit' },
    { key:'product_config_coupon_order_ratio_estimated', src:'product_config', field:'coupon_order_ratio_estimated', label:'产生coupon费用的订单比例-预估', hidden:false, pinned:false, width:130, editable:true, columnGroup:'coupon_flash' },
    { key:'profit_coupon_total_cost',          src:'profit', field:'coupon_total_cost',          label:'Coupon 总费用',     hidden:false, pinned:false, width:100, editable:false, columnGroup:'coupon_flash' },
    { key:'profit_flash_sale_price',           src:'profit', field:'flash_sale_price',           label:'秒杀价格（当地币）',         hidden:false, pinned:false, width:90,  editable:false, columnGroup:'coupon_flash' },
    { key:'profit_flash_sale_qty',             src:'profit', field:'flash_sale_qty',             label:'秒杀总单量',       hidden:false, pinned:false, width:80,  editable:false, columnGroup:'coupon_flash' },
    { key:'profit_flash_sale_days',            src:'profit', field:'flash_sale_days',            label:'秒杀天数',         hidden:false, pinned:false, width:80,  editable:false, columnGroup:'coupon_flash' },
    { key:'profit_flash_sale_total_cost',      src:'profit', field:'flash_sale_total_cost',      label:'秒杀总费用（当地币）',       hidden:false, pinned:false, width:100, editable:false, columnGroup:'coupon_flash' },
    { key:'profit_flash_sale_cost_per_order',  src:'profit', field:'flash_sale_cost_per_order',  label:'秒杀平均每单的费用 (当地币)',     hidden:false, pinned:false, width:100, editable:false, columnGroup:'coupon_flash' },
    { key:'daily_sale_owner',                   src:'daily',  field:'sale_owner',                   label:'销售',            hidden:false, pinned:false,  width:80,  editable:false, columnGroup:'other' },
    { key:'weekly_ranking',                     src:'weekly', field:'ranking',                      label:'小类排名',        hidden:false, pinned:false, width:80,  editable:false, columnGroup:'link_tracking' },
    { key:'weekly_volume_cvr',                  src:'weekly', field:'volume_cvr',                   label:'销量 CVR',        hidden:false, pinned:false, width:90,  editable:false, columnGroup:'other' },
    { key:'weekly_ad_click_count',        src:'weekly', field:'guanggaodianji',              label:'广告点击量',      hidden:false, pinned:false, width:90,  editable:false, columnGroup:'ad_data' },
    { key:'weekly_cpo',                         src:'weekly', field:'cpo',                          label:'CPO',             hidden:false, pinned:false, width:70,  editable:false, columnGroup:'other' },
  ];

  const MONEY_FIELDS = new Set(['daily_price','list_price','price_after_discount','review_discounted_price','review_actual_price','net_price_without_tax','gross_revenue_local','net_revenue_local','net_profit_local','cumulative_break_even','unit_profit_local','unit_profit_after_ad_local','unit_profit_rmb','product_cost_total','review_refund_total','review_refund_cost','review_refund_per_unit','review_unit_profit','offsite_commission_cost','offsite_cost_per_order','coupon_total_cost','flash_sale_price','flash_sale_total_cost','flash_sale_cost_per_order','ads_sp_cost','ads_sp_sales','ads_sd_cost','ads_sd_sales','shared_ads_sb_cost','shared_ads_sb_sales','shared_ads_sbv_cost','shared_ads_sbv_sales','guanggaohuafei','ad_direct_sales_amount','ad_sales_amount','weekly_ad_total_budget']);
  const RATE_FIELDS = new Set(['off','real_session_conversion_rate','order_link_real_session_conversion_rate','page_view_conversion_rate','review_orders_ratio','formula_review_rate','offsite_orders_ratio','onsite_orders_ratio','onsite_organic_orders_ratio','onsite_ad_orders_ratio','sp_orders_ratio','sd_orders_ratio','sb_orders_ratio','sbv_orders_ratio','session_conversion_rate','zongcvr','guanggaocvr','volume_cvr','acos','tacos','natural_traffic_proportion','return_rate','return_goods_rate','profit_margin','product_cost_ratio','ad_cost_ratio','review_cost_ratio','coupon_order_ratio_estimated','ctr','adv_rate']);
  const NUM_FIELDS = new Set(['star_rating','number_of_comments','promotion_days','promo_days_40d','promo_days_90d','lp_duration_days','rsg_number','target_gap','target_order_qty','target_subcategory_rank','sales','zirandan','guanggaodan','ranking','ad_direct_order_quantity','indirect_order_volume','impressions','page_views_total','organic_traffic','return_count','return_goods_count','flash_sale_qty','flash_sale_days','prev_rank','reviews_count','promotion_volume','b2b_volume','sessions','sessions_mobile','zongliuliang','guanggaodianji','zirandianji','cpu','cpa','cpc','cpo','page_views','page_views_mobile','offsite_bg_orders','offsite_xx_orders','offsite_acc_orders','total_offsite_orders','onsite_organic_orders','onsite_ad_orders']);
  const DATE_FIELDS = new Set(['date','updatedAt']);
  const ALL_NUMERIC = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);
  const TREND_CHART_FIELDS = [
    { key:'weekly_sales',                   src:'weekly', field:'sales',                   label:'实际总单量',                group:'fixed',              axis:'left',  valueType:'integer' },
    { key:'weekly_zongliuliang',            src:'weekly', field:'zongliuliang',            label:'汇总流量-会话量',          group:'traffic_conversion', axis:'left',  valueType:'integer' },
    { key:'weekly_session_conversion_rate', src:'weekly', field:'session_conversion_rate', label:'会话转化率',                group:'traffic_conversion', axis:'right', valueType:'percent' },
    { key:'weekly_adv_rate',                src:'weekly', field:'adv_rate',                label:'广告订单量占比',            group:'ad_data',            axis:'right', valueType:'percent' },
    { key:'weekly_impressions',             src:'weekly', field:'impressions',             label:'曝光量',                    group:'ad_data',            axis:'left',  valueType:'integer' },
    { key:'weekly_guanggaodianji',          src:'weekly', field:'guanggaodianji',          label:'广告点击量',                group:'ad_data',            axis:'left',  valueType:'integer' },
    { key:'weekly_guanggaohuafei',          src:'weekly', field:'guanggaohuafei',          label:'广告花费',                  group:'ad_data',            axis:'left',  valueType:'decimal' },
    { key:'weekly_guanggaodan',             src:'weekly', field:'guanggaodan',             label:'广告总单量',                group:'ad_data',            axis:'left',  valueType:'integer' },
    { key:'weekly_ctr',                     src:'weekly', field:'ctr',                     label:'CTR',                       group:'ad_data',            axis:'right', valueType:'percent' },
    { key:'weekly_cpc',                     src:'weekly', field:'cpc',                     label:'CPC',                       group:'ad_data',            axis:'left',  valueType:'decimal' },
    { key:'weekly_acos',                    src:'weekly', field:'acos',                    label:'ACOS',                      group:'ad_data',            axis:'right', valueType:'percent' },
    { key:'weekly_guanggaocvr',             src:'weekly', field:'guanggaocvr',             label:'CVR',                       group:'ad_data',            axis:'right', valueType:'percent' },
    { key:'weekly_cpa',                     src:'weekly', field:'cpa',                     label:'CPA',                       group:'ad_data',            axis:'left',  valueType:'decimal' },
    { key:'weekly_cpu',                     src:'weekly', field:'cpu',                     label:'CPU',                       group:'ad_data',            axis:'left',  valueType:'decimal' },
    { key:'profit_tacos',                   src:'profit', field:'tacos',                   label:'TACOS',                     group:'ad_data',            axis:'right', valueType:'percent' },
    { key:'profit_net_profit_local',        src:'profit', field:'net_profit_local',        label:'纯利润（当地币）',           group:'profit',             axis:'left',  valueType:'decimal' },
    { key:'profit_profit_margin',           src:'profit', field:'profit_margin',           label:'利润率（忽略coupon使用率）', group:'profit',             axis:'right', valueType:'percent' },
    { key:'profit_cumulative_break_even',   src:'profit', field:'cumulative_break_even',   label:'累计盈亏平衡（当地币）',     group:'profit',             axis:'left',  valueType:'decimal' },
  ];
  const TREND_CHART_FIELD_GROUPS = [
    { key:'fixed',              label:'固定列' },
    { key:'traffic_conversion', label:'流量结构&转化' },
    { key:'ad_data',            label:'广告数据' },
    { key:'profit',             label:'利润数据' },
  ];
  const TREND_CHART_DEFAULT_FIELD_KEYS = ['weekly_sales', 'weekly_zongliuliang', 'weekly_session_conversion_rate'];
  const TREND_CHART_LINE_COLORS = ['#38BDF8','#F59E0B','#34D399','#FB7185','#A78BFA','#F97316','#22D3EE','#E879F9','#84CC16','#FACC15','#60A5FA','#F472B6'];
  const TREND_CHART_DATE_MODE_OPTIONS = [
    { value:'available', label:'已有数据日期' },
    { value:'7d',        label:'近7天' },
    { value:'30d',       label:'近30天' },
    { value:'custom',    label:'自定义日期' },
  ];

  const isBlankLike = (v) => v === null || v === undefined || v === '';
  const toFormulaNumber = (v) => {
    if (isBlankLike(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const toPriceKey = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n.toFixed(2) : '';
  };
  const formatPercent = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '—';
    return `${(n * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
  };
  const getFlashSaleMissingMessage = (col, row) => {
    if (!col || !row || (col.field !== 'flash_sale_total_cost' && col.field !== 'flash_sale_cost_per_order')) return '';
    const currentValue = getCellValue(col, row);
    if (currentValue !== null && currentValue !== undefined && currentValue !== '') return '';
    const profitRow = row.__src?.profit || row;
    const productConfigRow = row.__src?.product_config || row;
    const totalMissing = [];
    if (isBlankLike(profitRow.flash_sale_qty)) totalMissing.push('秒杀总单量');
    if (isBlankLike(profitRow.flash_sale_price)) totalMissing.push('秒杀价格（当地币）');
    if (isBlankLike(productConfigRow.lightning_commission_rate)) totalMissing.push('站点秒杀抽佣率');
    if (isBlankLike(productConfigRow.lightning_fee_cap)) totalMissing.push('站点秒杀变动费用上限（当地币）');
    if (isBlankLike(productConfigRow.lightning_fixed_fee)) totalMissing.push('站点秒杀每日固定费用（当地币）');
    if (isBlankLike(profitRow.flash_sale_days)) totalMissing.push('秒杀天数');

    let missing = totalMissing;
    if (col.field === 'flash_sale_cost_per_order') {
      missing = [...totalMissing];
      if (!missing.length && isBlankLike(profitRow.flash_sale_total_cost)) missing.push('秒杀总费用（当地币）');
      const qty = toFormulaNumber(profitRow.flash_sale_qty);
      if (qty == null) missing.push('秒杀总单量');
    }
    const uniqueMissing = [...new Set(missing)];
    return uniqueMissing.length ? `请补全${uniqueMissing.join('、')}` : '';
  };
  const getFormulaMissingHint = (col, row) => {
    if (!col || !row) return '';
    if (row.__rowType === WEEKLY_SUMMARY_ROW_TYPE) return '';
    const value = getCellValue(col, row);
    if (!isBlankLike(value)) return '';
    if (col.field === 'unit_profit_local') {
      return isBlankLike(row?.price_after_discount)
        ? '请补全折后售价'
        : '请在利润试算中补充新的折后价';
    }
    if (col.field === 'review_refund_per_unit' || col.field === 'review_unit_profit') {
      const orderLinkRow = row.__src?.order_link || row;
      const reviewDiscountedPrice = orderLinkRow?.review_discounted_price ?? row?.review_discounted_price;
      return isBlankLike(reviewDiscountedPrice)
        ? '请补全测评折后价'
        : '请在测评试算中补充新的测评折后价';
    }
    return '';
  };
  const toScenarioTypeKey = (v) => String(v ?? '').trim().toLowerCase();
  const toPricingScenarioLookupKey = (asinCountry, price, scenarioType) => {
    const priceKey = toPriceKey(price);
    const scenarioKey = toScenarioTypeKey(scenarioType);
    if (!asinCountry || !priceKey || !scenarioKey) return '';
    return `${asinCountry}_${priceKey}_${scenarioKey}`;
  };
  const getPricingScenarioGrossProfit = (pricingScenarioMap, asinCountry, price, scenarioType) => {
    const key = toPricingScenarioLookupKey(asinCountry, price, scenarioType);
    return key ? pricingScenarioMap[key]?.gross_profit ?? null : null;
  };
  const getPricingScenarioReviewReturnAmount = (pricingScenarioMap, asinCountry, price, scenarioType) => {
    const key = toPricingScenarioLookupKey(asinCountry, price, scenarioType);
    return key ? pricingScenarioMap[key]?.review_return_amount ?? null : null;
  };
  const getPricingScenarioNetPrice = (pricingScenarioMap, asinCountry, price, scenarioType) => {
    const key = toPricingScenarioLookupKey(asinCountry, price, scenarioType);
    return key ? pricingScenarioMap[key]?.net_price ?? null : null;
  };
  const getPricingScenarioMonthlyCogs = (pricingScenarioMap, asinCountry, price, scenarioType) => {
    const key = toPricingScenarioLookupKey(asinCountry, price, scenarioType);
    return key ? pricingScenarioMap[key]?.monthly_cogs ?? null : null;
  };
  const parseStoredSchemeArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (_error) {
      return [];
    }
  };
  const pricingScenarioTimestamp = (candidate) => {
    const parsed = Date.parse(candidate?.matchedAt || '');
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const pricingScenarioIdRank = (candidate) => {
    const parsed = Number(candidate?.recordId);
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const shouldReplacePricingScenario = (current, candidate) => {
    if (!current) return true;
    if (candidate.sourceRank !== current.sourceRank) return candidate.sourceRank > current.sourceRank;
    if (pricingScenarioTimestamp(candidate) !== pricingScenarioTimestamp(current)) {
      return pricingScenarioTimestamp(candidate) > pricingScenarioTimestamp(current);
    }
    return pricingScenarioIdRank(candidate) > pricingScenarioIdRank(current);
  };
  const addPricingScenarioCandidate = (map, candidate) => {
    const key = toPricingScenarioLookupKey(candidate.asin_country, candidate.price_with_tax, candidate.scenario_type);
    if (!key || !shouldReplacePricingScenario(map[key], candidate)) return;
    map[key] = candidate;
  };
  const buildPricingScenarioLookupMap = (rows) => {
    const map = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      const asinCountry = String(row?.asin_country || '').trim().toUpperCase();
      const rowTimestamp = row?.updatedAt || row?.updated_at || row?.createdAt || row?.created_at || null;

      parseStoredSchemeArray(row?.kept_pricing_schemes).forEach((scheme) => {
        addPricingScenarioCandidate(map, {
          asin_country: asinCountry,
          scenario_type: 'normal',
          price_with_tax: scheme?.discountPrice,
          net_price: scheme?.netRevenue ?? null,
          monthly_cogs: scheme?.breakdown?.procurementCost ?? null,
          gross_profit: scheme?.unitProfit ?? null,
          review_return_amount: null,
          source: 'json',
          sourceRank: 2,
          matchedAt: scheme?.keptAt || rowTimestamp,
          recordId: row?.id,
        });
      });

      parseStoredSchemeArray(row?.kept_testing_schemes).forEach((scheme) => {
        addPricingScenarioCandidate(map, {
          asin_country: asinCountry,
          scenario_type: 'review',
          price_with_tax: scheme?.evaluationPrice,
          net_price: scheme?.netRevenue ?? null,
          monthly_cogs: null,
          gross_profit: scheme?.paybackProfit ?? null,
          review_return_amount: scheme?.buyerRefund ?? null,
          source: 'json',
          sourceRank: 2,
          matchedAt: scheme?.keptAt || rowTimestamp,
          recordId: row?.id,
        });
      });

      const legacyType = String(row?.scenario_type || '').trim().toLowerCase();
      if (legacyType === 'normal' || legacyType === 'review') {
        addPricingScenarioCandidate(map, {
          ...row,
          asin_country: asinCountry,
          scenario_type: legacyType,
          source: 'legacy',
          sourceRank: 1,
          matchedAt: rowTimestamp,
          recordId: row?.id,
        });
      }
    });
    return map;
  };
  const toNegativeMoney = (value) => {
    const n = toFormulaNumber(value);
    return n == null ? null : -Math.abs(n);
  };
  const roundMoney = (value) => {
    const n = toFormulaNumber(value);
    return n == null ? null : Math.round((n + Number.EPSILON) * 100) / 100;
  };
  const roundRate = (value, digits = 4) => {
    const n = toFormulaNumber(value);
    const factor = 10 ** digits;
    return n == null ? null : Math.round((n + Number.EPSILON) * factor) / factor;
  };
  const formatPercent0 = (value) => {
    const n = toFormulaNumber(value);
    return n == null ? '' : `${(n * 100).toFixed(0)}%`;
  };
  const formatExcelInteger = (value) => {
    const n = toFormulaNumber(value);
    return n == null ? '' : String(Math.round(n));
  };
  const buildWeeklyTargetCompletionText = ({ adSpend, weeklyAdTotalBudget, flashSaleDays, targetAdSpendRate, completionRate }) => {
    if (adSpend == null) return '';
    const body = weeklyAdTotalBudget != null && adSpend > weeklyAdTotalBudget
      ? `🚨广告预算超预期${formatExcelInteger(adSpend - weeklyAdTotalBudget)}，需检查广告`
      : (flashSaleDays != null && targetAdSpendRate != null && flashSaleDays > targetAdSpendRate
        ? '💰有利润空间，可判断是否加大广告'
        : '❓预算未超标但利润不足，why？');
    return `${body} (本周目标完成率：${formatPercent0(completionRate)})`;
  };
  const isFormulaSameValue = (current, next) => {
    if (isBlankLike(current) && isBlankLike(next)) return true;
    const currentNumber = toFormulaNumber(current);
    const nextNumber = toFormulaNumber(next);
    if (currentNumber != null && nextNumber != null) {
      return Math.abs(currentNumber - nextNumber) < 0.000001;
    }
    return String(current ?? '').trim() === String(next ?? '').trim();
  };
  const toDateKey = (v) => v ? String(v).slice(0, 10) : '';
  const toCompetitorDailyKey = (competitorId, countryAsinDate) => (
    competitorId && countryAsinDate ? `${competitorId}_${countryAsinDate}` : ''
  );
  const formatUTCDateKey = (date) => date.toISOString().slice(0, 10);
  const expandDateRangeToNaturalWeeks = (range) => {
    if (!Array.isArray(range)) return range;
    const [startValue, endValue] = range;
    let start = startValue ? toDateKey(startValue) : null;
    let end = endValue ? toDateKey(endValue) : null;
    if (start) {
      const startDate = new Date(`${start}T00:00:00Z`);
      if (!Number.isNaN(startDate.getTime())) {
        startDate.setUTCDate(startDate.getUTCDate() - startDate.getUTCDay());
        start = formatUTCDateKey(startDate);
      }
    }
    if (end) {
      const endDate = new Date(`${end}T00:00:00Z`);
      if (!Number.isNaN(endDate.getTime())) {
        endDate.setUTCDate(endDate.getUTCDate() + (6 - endDate.getUTCDay()));
        end = formatUTCDateKey(endDate);
      }
    }
    return [start, end];
  };
  const getPreviousDateKey = (dateValue) => {
    const dateKey = toDateKey(dateValue);
    if (!dateKey) return '';
    const date = new Date(`${dateKey}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return '';
    date.setUTCDate(date.getUTCDate() - 1);
    return date.toISOString().slice(0, 10);
  };
  const toCountryAsinKey = (country, asin) => {
    if (!country || !asin) return '';
    return `${country}_${asin}`;
  };
  const parseCountryFromCountryAsin = (countryAsin) => {
    const parts = String(countryAsin || '').split('_');
    return parts.length > 1 ? parts[0] : '';
  };
  const getCompetitorRoleIndex = (role) => {
    const match = String(role || '').match(/竞对(\d+)/);
    return match ? Number(match[1]) : 9999;
  };
  const getCompetitorColor = (role) => {
    const palette = ['#7FA1C3', '#A888B5'];
    const idx = getCompetitorRoleIndex(role);
    return palette[(Number.isFinite(idx) && idx > 0 ? idx - 1 : 0) % palette.length];
  };
  const COMPETITOR_GROUP_HEADER_COLOR = '#EB6793';
  const COMPETITOR_SUB_FIELDS = [
    { key: 'rank', label: '排名', width: 110, headerColor: '#EB6793' },
    { key: 'notes', label: '操作分析', width: 220, headerColor: '#F2BABA' },
  ];
  const TARGET_HEADER_VALUE_CONFIG = {
    target_ad_cvr_formula: { sourceField: 'target_ad_cvr', type: 'percent' },
    target_cpa_formula: { sourceField: 'target_cpa', type: 'number' },
    ideal_cpu_by_margin_formula: { sourceField: 'ideal_cpu_by_margin', type: 'number' },
    target_profit_margin_formula: { sourceField: 'target_profit_margin', type: 'percent' },
    target_ad_spend_rate_formula: { sourceField: 'target_ad_spend_rate', type: 'percent' },
  };
  const isDynamicColumnKey = (key) => {
    return String(key || '').startsWith('kw_actual_') || String(key || '').startsWith('competitor_dynamic_');
  };
  const isColumnSettingMetaKey = (key) => key === COLUMN_GROUP_ORDER_KEY || key === COLUMN_PAGE_SIZE_KEY;
  const dateDiffDays = (endDate, startDate) => {
    const endKey = toDateKey(endDate);
    const startKey = toDateKey(startDate);
    if (!endKey || !startKey) return null;
    const end = new Date(`${endKey}T00:00:00Z`);
    const start = new Date(`${startKey}T00:00:00Z`);
    if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return null;
    return Math.floor((end.getTime() - start.getTime()) / 86400000);
  };
  const buildDailyOffValue = (row) => {
    const listPrice = toFormulaNumber(row?.list_price);
    const dailyPrice = toFormulaNumber(row?.daily_price);
    if (listPrice == null || dailyPrice == null || listPrice === 0) return null;
    return (listPrice - dailyPrice) / listPrice;
  };
  const buildLpDurationMap = (dailyRecords) => {
    const groups = {};
    (Array.isArray(dailyRecords) ? dailyRecords : []).forEach((row) => {
      const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
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

  const hasPromoActivity = (row) => {
    const value = row?.activity_annotation;
    return value !== null && value !== undefined && String(value).trim() !== '';
  };

  const buildPromoDaysWindowMap = (dailyRecords, windowDays) => {
    const groups = {};
    (Array.isArray(dailyRecords) ? dailyRecords : []).forEach((row) => {
      const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
      const dateKey = toDateKey(row?.date);
      if (!asinCountry || !dateKey) return;
      if (!groups[asinCountry]) groups[asinCountry] = [];
      groups[asinCountry].push(row);
    });

    const result = {};
    Object.values(groups).forEach((rows) => {
      const sortedRows = [...rows].sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)));
      sortedRows.forEach((row) => {
        const key = row?.country_asin_date;
        const rowDate = toDateKey(row?.date);
        if (!key || !rowDate) return;
        result[key] = sortedRows.reduce((count, candidate) => {
          if (!hasPromoActivity(candidate)) return count;
          const diff = dateDiffDays(rowDate, candidate?.date);
          return diff !== null && diff >= 1 && diff <= windowDays ? count + 1 : count;
        }, 0);
      });
    });
    return result;
  };

  const READONLY_FIELDS = new Set(['country_asin_date','country','asin','date','updatedAt']);

  const DYNAMIC_COLOR = { country: (row) => COUNTRY_COLORS[row.country] || null };

  const SRC_TABLE_LABEL = {
    daily: 'daily_asins',
    weekly: 'weekly_performance',
    target: 'target_management',
    profit: 'daily_profit',
    product_config: 'product_config',
    order_link: 'daily_order_link_tracking',
    keyword_position: 'sqp_keywords / sqp_keyword_daily_positions',
    competitor: 'order_link_competitor_asins / order_link_competitor_asins_daily',
  };

  const FIELD_TOOLTIP_TEXT = {
    off: '公式：(LP/WP/TP - 购物车价格) / LP/WP/TP，写回 daily_asins.off。',
    promo_day: '公式：当条数据 activity_annotation 非空时为 1，否则为 0，显示为是/否。',
    promo_days_40d: '公式：同 ASIN + 国家，统计当条 date 往前 1 到 40 天内 activity_annotation 非空的天数。',
    promo_days_90d: '公式：同 ASIN + 国家，统计当条 date 往前 1 到 90 天内 activity_annotation 非空的天数。',
    lp_duration_days: '公式：同 ASIN + 国家按 date 排序，统计当前 LP/WP/TP 连续未变化天数。',
  };

  const WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT = {
    sales: '销量 = 领星销量按国家+ASIN汇总累加。\nsales = sum(volume)。',
    zirandan: '自然订单量 = 总订单量 - 广告订单量。\nzirandan = order_items - guanggaodan。',
    guanggaodan: '广告订单量 = 领星广告订单量按国家+ASIN汇总累加。\nguanggaodan = sum(ad_order_quantity)。',
    adv_rate: '广告订单量占比 = 广告订单量 ÷ 销量；销量为空时为空。\nadv_rate = round(guanggaodan ÷ sales, 4)；sales 为 0 时为 null。',
    zongliuliang: '总流量 = 同国家+ASIN下取 Sessions-Total 最大值。\nzongliuliang = max(sessions_total)。',
    guanggaodianji: '广告点击量 = 领星广告点击量按国家+ASIN汇总累加。\nguanggaodianji = sum(clicks)。',
    zirandianji: '自然点击 = 总流量 - 广告点击量。\nzirandianji = zongliuliang - guanggaodianji。',
    guanggaohuafei: '广告花费 = 领星广告花费按国家+ASIN汇总累加，金额保留两位小数。\nguanggaohuafei = round(sum(abs(spend)), 2)。',
    guanggaocvr: '广告CVR = 广告订单量 ÷ 广告点击量；广告点击量为空时为空。\nguanggaocvr = round(guanggaodan ÷ guanggaodianji, 4)；guanggaodianji 为 0 时为 null。',
    cpo: 'CPO = 广告花费 ÷ 广告订单量，结果取绝对值并保留两位小数；广告订单量为空时为空。\ncpo = abs(round(guanggaohuafei ÷ guanggaodan, 2))；guanggaodan 为 0 时为 null。',
    cpu: 'CPU = 广告花费 ÷ 销量，结果取绝对值并保留两位小数；销量为空时为空。\ncpu = abs(round(guanggaohuafei ÷ sales, 2))；sales 为 0 时为 null。',
    cpc: 'CPC = 广告花费 ÷ 广告点击量，保留两位小数；广告点击量为空时为空。\ncpc = round(guanggaohuafei ÷ guanggaodianji, 2)；guanggaodianji 为 0 时为 null。',
    ranking: '小类排名 = 从小类排名数组取第一个小类排名。\nranking = small_cate_rank[0].rank。',
    reviews_count: '评论数量 = 同国家+ASIN下取评论数量最大值。\nreviews_count = max(reviews_count)。',
    avg_star: '评分 = 取领星接口当前评分。\navg_star = avg_star。',
    prev_star: '前一个评分 = 取领星接口前一个评分。\nprev_star = prev_star。',
    prev_rank: '上一次小类排名 = 从小类排名数组取第一个上一次小类排名。\nprev_rank = small_cate_rank[0].prev_rank。',
    promotion_volume: '促销销量 = 促销销量按国家+ASIN汇总累加。\npromotion_volume = sum(promotion_volume)。',
    ad_sales_amount: '广告销售额 = 广告销售额按国家+ASIN汇总累加，金额保留两位小数。\nad_sales_amount = round(sum(abs(ad_sales_amount)), 2)。',
    b2b_volume: 'B2B销量 = B2B销量按国家+ASIN汇总累加。\nb2b_volume = sum(b2b_volume)。',
    return_count: '退款量 = 退款量按国家+ASIN汇总累加。\nreturn_count = sum(return_count)。',
    impressions: '展示量 = 展示量按国家+ASIN汇总累加。\nimpressions = sum(impressions)。',
    shared_ads_sb_cost: 'SB广告费 = SB广告费按国家+ASIN汇总累加，金额保留两位小数。\nshared_ads_sb_cost = round(sum(abs(shared_ads_sb_cost)), 2)。',
    shared_ads_sbv_cost: 'SBV广告费 = SBV广告费按国家+ASIN汇总累加，金额保留两位小数。\nshared_ads_sbv_cost = round(sum(abs(shared_ads_sbv_cost)), 2)。',
    ads_sd_cost: 'SD广告费 = SD广告费按国家+ASIN汇总累加，金额保留两位小数。\nads_sd_cost = round(sum(abs(ads_sd_cost)), 2)。',
    ads_sp_cost: 'SP广告费 = SP广告费按国家+ASIN汇总累加，金额保留两位小数。\nads_sp_cost = round(sum(abs(ads_sp_cost)), 2)。',
    ads_sd_sales: 'SD广告销售额 = SD广告销售额按国家+ASIN汇总累加，金额保留两位小数。\nads_sd_sales = round(sum(abs(ads_sd_sales)), 2)。',
    ads_sp_sales: 'SP广告销售额 = SP广告销售额按国家+ASIN汇总累加，金额保留两位小数。\nads_sp_sales = round(sum(abs(ads_sp_sales)), 2)。',
    shared_ads_sb_sales: 'SB广告销售额 = SB广告销售额按国家+ASIN汇总累加，金额保留两位小数。\nshared_ads_sb_sales = round(sum(abs(shared_ads_sb_sales)), 2)。',
    shared_ads_sbv_sales: 'SBV广告销售额 = SBV广告销售额按国家+ASIN汇总累加，金额保留两位小数。\nshared_ads_sbv_sales = round(sum(abs(shared_ads_sbv_sales)), 2)。',
    ad_direct_order_quantity: '直接成交订单量 = 直接成交订单量按国家+ASIN汇总累加。\nad_direct_order_quantity = sum(ad_direct_order_quantity)。',
    page_views_total: 'PV-Total = 同国家+ASIN下取 PV-Total 最大值。\npage_views_total = max(page_views_total)。',
    page_views: 'PV-Browser = 同国家+ASIN下取 PV-Browser 最大值。\npage_views = max(page_views)。',
    page_views_mobile: 'PV-Mobile = 同国家+ASIN下取 PV-Mobile 最大值。\npage_views_mobile = max(page_views_mobile)。',
    sessions: 'Sessions-Browser = 同国家+ASIN下取 Sessions-Browser 最大值。\nsessions = max(sessions)。',
    sessions_mobile: 'Sessions-Mobile = 同国家+ASIN下取 Sessions-Mobile 最大值。\nsessions_mobile = max(sessions_mobile)。',
    ctr: 'CTR = 广告点击量 ÷ 展示量；展示量为空时为空。\nctr = round(guanggaodianji ÷ impressions, 4)；impressions 为 0 时为 null。',
    volume_cvr: '销量CVR = 销量 ÷ 总流量；总流量为空时为空。\nvolume_cvr = round(sales ÷ zongliuliang, 4)；zongliuliang 为 0 时为 null。',
    return_rate: '退款率 = 退款量 ÷ 销量；销量为空时为空。\nreturn_rate = round(return_count ÷ sales, 4)；sales 为 0 时为 null。',
    return_goods_count: '退货量 = 退货量按国家+ASIN汇总累加。\nreturn_goods_count = sum(return_goods_count)。',
    date: '日期 = 取本次查询日期。\ndate = start_date。',
    return_goods_rate: '退货率 = 退货量 ÷ 销量；销量为空时为空。\nreturn_goods_rate = round(return_goods_count ÷ sales, 4)；sales 为 0 时为 null。',
    organic_traffic: '自然流量 = 总流量 - 广告点击量。\norganic_traffic = zongliuliang - guanggaodianji。',
    natural_traffic_proportion: '自然流量占比 = 自然流量 ÷ 总流量；总流量为空时为空。\nnatural_traffic_proportion = round(organic_traffic ÷ zongliuliang, 4)；zongliuliang 为 0 时为 null。',
    ad_direct_sales_amount: '直接成交额 = 直接成交额按国家+ASIN汇总累加，金额保留两位小数。\nad_direct_sales_amount = round(sum(abs(ad_direct_sales_amount)), 2)。',
    acos: 'ACOS = 广告花费 ÷ 广告销售额；广告销售额为空时为空。\nacos = round(guanggaohuafei ÷ ad_sales_amount, 4)；ad_sales_amount 为 0 时为 null。',
    cpa: 'CPA = 广告花费 ÷ 广告订单量，保留两位小数；广告订单量为空时为空。\ncpa = round(guanggaohuafei ÷ guanggaodan, 2)；guanggaodan 为 0 时为 null。',
    indirect_order_volume: '间接跑单订单量 = 广告订单量 - 直接成交订单量。\nindirect_order_volume = guanggaodan - ad_direct_order_quantity。',
    category: '类别 = 从小类排名数组取第一个类别。\ncategory = small_cate_rank[0].category。',
  };

  const WEEKLY_PERFORMANCE_UPDATE_TOOLTIP_TEXT = '每天更新2次（早上8点、16点），每次更新过去30天的数据；';
  const WEEKLY_PERFORMANCE_DIRECT_VALUE_FIELDS = new Set([
    'sales', 'guanggaodan', 'zongliuliang', 'guanggaodianji', 'guanggaohuafei',
    'ranking', 'reviews_count', 'avg_star', 'prev_star', 'prev_rank',
    'promotion_volume', 'ad_sales_amount', 'b2b_volume', 'return_count', 'impressions',
    'shared_ads_sb_cost', 'shared_ads_sbv_cost', 'ads_sd_cost', 'ads_sp_cost',
    'ads_sd_sales', 'ads_sp_sales', 'shared_ads_sb_sales', 'shared_ads_sbv_sales',
    'ad_direct_order_quantity', 'page_views_total', 'page_views', 'page_views_mobile',
    'sessions', 'sessions_mobile', 'return_goods_count', 'date',
    'ad_direct_sales_amount', 'category',
  ]);

  const DAILY_SYNC_TOOLTIP_TEXT = [
    '按站点分早晚场同步：',
    'JP站点：早场 06/07/08 任一时间同步；晚场 18/19 任一时间同步。',
    'US/CA站点：晚场 22/23 任一时间同步。',
    '欧洲站点（DE/FR）：早场 13/14/15 任一时间同步；晚场 20/21 任一时间同步。',
  ].join('\n');

  const DAILY_SYNC_SOURCE_INFOS = [
    { workflow: '每日生成类型、asin数据', schedule: '早场 06/07/08 任一时间；晚场 18/19 任一时间', scope: 'JP', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '晚场 22/23 任一时间', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    { workflow: '每日生成类型、asin数据', schedule: '早场 13/14/15 任一时间；晚场 20/21 任一时间', scope: 'DE/FR', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
  ];

  const SQL_UPDATED_FIELD_TEXT = {
    'daily.date': '每天自动生成从今天起未来 3 个月的日期。',
    'daily.activity_annotation': '每天5:30更新，自动同步领星的BD/LD，其他如专享/coupon等需要手动填写',
    'daily.daily_price': `购物车价格\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    'daily.list_price': `LP/WP/TP\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    'daily.star_rating': `星级\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    'daily.number_of_comments': `Review 数量\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    'daily.selling_accounts': `售卖账号\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    'daily.promotion_days': '每天 5:30 同步昨日推广天数。',
    'target.sales_mom_rate': '每天早上 8:30 自动对比当天和前一天实际总单量，计算销量环比变化。',
  };

  const SQL_UPDATED_FIELD_SOURCE = {
    'daily.date': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    'daily.activity_annotation': [{ workflow: '每日生成类型、asin数据', schedule: '每天 5:30', node: '3更新 活动标注' }],
    'daily.daily_price': DAILY_SYNC_SOURCE_INFOS,
    'daily.list_price': DAILY_SYNC_SOURCE_INFOS,
    'daily.star_rating': DAILY_SYNC_SOURCE_INFOS,
    'daily.number_of_comments': DAILY_SYNC_SOURCE_INFOS,
    'daily.selling_accounts': DAILY_SYNC_SOURCE_INFOS,
    'daily.promotion_days': [
      { workflow: '每日生成类型、asin数据', schedule: '每天 5:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天 5:30', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'target.sales_mom_rate': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '更新 目标管理的销量环比' }],
  };

  const FIELD_TOOLTIP_DATA = {
    page_screenshot: {
      title: '自己页面截图',
      formula: `自己页面截图\n${DAILY_SYNC_TOOLTIP_TEXT}`,
      fields: [{ label: '字段来源（自己页面截图）', field: 'daily_order_link_tracking.page_screenshot' }],
      writeBackField: 'daily_order_link_tracking.page_screenshot',
      hideEmptyRules: true,
    },
    target_gap: {
      title: '目标差距',
      formula: '实际总单量 - 目标拆解 - 单量。',
      emptyRules: ['实际总单量为空', '目标拆解 - 单量为空'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '目标拆解 - 单量', field: 'target_management.target_order_qty' },
      ],
      writeBackField: 'daily_asins.target_gap',
    },
    weekly_ad_total_budget: {
      title: '本周广告总预算',
      formula: [
        '日合并行：目标 CPU × 本周目标拆解单量合计。',
        '周汇总行：本周广告花费合计 ÷ 日合并行本周广告总预算。',
      ],
      emptyRules: ['日合并行：目标 CPU 为空或本周目标拆解单量合计为空', '周汇总行：本周广告花费为空或日合并行本周广告总预算为空/为 0'],
      fields: [
        { label: '目标 CPU', field: 'target_default.ideal_cpu_by_margin' },
        { label: '本周目标拆解单量合计', field: 'target_management.target_order_qty（同一自然周汇总）' },
        { label: '本周广告花费合计', field: 'weekly_performance.guanggaohuafei（同一自然周汇总）' },
        { label: '日合并行本周广告总预算', field: 'daily_weekly_summary.merge_summary_data.weekly_ad_total_budget' },
      ],
      writeBackField: 'daily_weekly_summary.merge_summary_data.weekly_ad_total_budget',
    },
    weekly_target_completion_rate: {
      title: '本周目标完成率',
      formula: [
        '日合并行：若本周广告花费为空则为空；若本周广告花费 > 本周广告总预算则提示广告预算超预期；否则按秒杀天数与目标广告费率判断利润空间，并拼接本周目标完成率。',
        '周汇总行：本周实际总单量合计 ÷ 本周目标拆解单量合计。',
      ],
      emptyRules: ['日合并行：本周广告花费为空', '周汇总行：本周实际总单量为空或本周目标拆解单量合计为空/为 0'],
      fields: [
        { label: '本周广告花费', field: 'weekly_performance.guanggaohuafei' },
        { label: '本周广告总预算', field: 'daily_weekly_summary.merge_summary_data.weekly_ad_total_budget' },
        { label: '秒杀天数', field: 'daily_profit.flash_sale_days' },
        { label: '目标广告费率', field: 'target_default.target_ad_spend_rate' },
        { label: '本周实际总单量合计', field: 'weekly_performance.sales（同一自然周汇总）' },
        { label: '本周目标拆解单量合计', field: 'target_management.target_order_qty（同一自然周汇总）' },
      ],
      writeBackField: 'daily_weekly_summary.merge_summary_data.weekly_target_completion_rate',
    },
    sales_mom_rate: {
      title: '销量环比变化',
      formula: '当天实际总单量 - 前一天实际总单量。',
      emptyRules: ['当天实际总单量为空', '前一天实际总单量为空'],
      fields: [
        { label: '当天实际总单量', field: 'weekly_performance.sales（当前日期）' },
        { label: '前一天实际总单量', field: 'weekly_performance.sales（同 ASIN + 国家，当前日期前一天）' },
      ],
      writeBackField: 'target_management.sales_mom_rate',
      sourceInfos: SQL_UPDATED_FIELD_SOURCE['target.sales_mom_rate'],
    },
    net_price_without_tax: {
      title: '成交额-去掉税费',
      formula: '按当前行国家、ASIN、折后售价匹配定价试算记录（scenario_type = normal），取成交售价（不含税）。',
      emptyRules: ['未匹配到相同国家、ASIN、折后售价且 scenario_type = normal 的定价试算记录', '成交售价（不含税）为空'],
      fields: [
        { label: '折后售价', field: 'daily_asins.price_after_discount' },
        { label: '试算场景', field: 'pricing_scenarios.scenario_type = normal' },
        { label: '试算折后价（含税）', field: 'pricing_scenarios.price_with_tax' },
        { label: '成交售价（不含税）', field: 'pricing_scenarios.net_price' },
      ],
      writeBackField: 'daily_order_link_tracking.net_price_without_tax',
    },
    off: {
      title: 'Off 力度',
      formula: '（LP/WP/TP - 购物车价格）÷ LP/WP/TP。',
      emptyRules: ['LP/WP/TP 为空或为 0', '购物车价格为空'],
      fields: [
        { label: 'LP/WP/TP', field: 'daily_asins.list_price' },
        { label: '购物车价格', field: 'daily_asins.daily_price' },
      ],
      writeBackField: 'daily_asins.off',
    },
    lp_duration_days: {
      title: '本划线价持续天数',
      formula: '同 ASIN + 国家按站点时间排序，统计当前 LP/WP/TP 连续未变化天数；第一条记录当天算 1 天，价格变化后的第一天也算 1 天。',
      emptyRules: ['LP/WP/TP 为空', '站点时间为空', '未找到同国家、ASIN 的历史记录'],
      fields: [
        { label: '当前 LP/WP/TP', field: 'daily_asins.list_price' },
        { label: '当前站点时间', field: 'daily_asins.date' },
        { label: '同国家 ASIN', field: 'daily_asins.asin_country' },
      ],
      writeBackField: 'daily_asins.lp_duration_days',
    },
    rsg_number: {
      title: '①测评单',
      formula: '按当前 ASIN_国家匹配测评需求，取全部专属测评码匹配同一天的 RSG 日数据，再统计关联返款单中未取消订单的数量。',
      emptyRules: ['当前 ASIN_国家为空', '当前站点时间为空', '未匹配到测评需求记录时按 0 写回', '未匹配到同一天 RSG 日数据时按 0 写回', '返款单号为空不计入', '订单状态为 Canceled 不计入'],
      fields: [
        { label: '当前 ASIN_国家', field: 'daily_asins.asin_country = evaluation_requirement.asin_country' },
        { label: '专属测评码', field: 'evaluation_requirement.exclusive_evaluation_code = rsg_daily.rsg_id' },
        { label: '当前站点时间', field: 'daily_asins.date = rsg_daily.date' },
        { label: 'RSG 日数据', field: 'rsg_daily.id = refund.rsg_daily_id' },
        { label: '返款订单号', field: 'refund.order_number 非空' },
        { label: '订单状态', field: 'refund.order_number = order_list.order_number; order_list.status != Canceled' },
        { label: '测评单数量', field: 'COUNT(refund.id)' },
      ],
      writeBackField: 'daily_asins.rsg_number',
    },
    total_onsite_orders: {
      title: '②站内:纯自然+广告单',
      formula: '实际总单量 - ①测评单。',
      emptyRules: ['实际总单量为空', '①测评单为空'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
      ],
      writeBackField: 'daily_order_link_tracking.total_onsite_orders',
    },
    onsite_organic_orders: {
      title: '③站内纯自然单',
      formula: '②站内:纯自然+广告单 - 广告总单量。',
      emptyRules: ['②站内:纯自然+广告单为空', '广告总单量为空'],
      fields: [
        { label: '②站内:纯自然+广告单', field: 'daily_order_link_tracking.total_onsite_orders' },
        { label: '广告总单量', field: 'weekly_performance.guanggaodan' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_organic_orders',
    },
    onsite_ad_orders: {
      title: '④站内总广告单',
      formula: '直接取广告总单量。',
      emptyRules: ['广告总单量为空'],
      fields: [
        { label: '广告总单量', field: 'weekly_performance.guanggaodan' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_ad_orders',
    },
    review_orders_ratio: {
      title: '①测评单占比',
      formula: '①测评单 ÷ 实际总单量。',
      emptyRules: ['①测评单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
      ],
      writeBackField: 'daily_order_link_tracking.review_orders_ratio',
    },
    formula_review_rate: {
      title: '公式算-留评率',
      formula: '（当前记录日期 Review 数 - 当前记录日期前一天 Review 数）÷ 实际总单量。',
      emptyRules: ['当前记录日期或前一天的 Review 数据缺失', '实际总单量为空或为 0'],
      fields: [
        { label: '当前记录日期 Review 数', field: 'daily_asins.number_of_comments' },
        { label: '前一天 Review 数', field: 'daily_asins.number_of_comments（当前记录日期前一天）' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
      ],
      writeBackField: 'daily_order_link_tracking.formula_review_rate',
    },
    onsite_orders_ratio: {
      title: '②站内:纯自然+广告单占比',
      formula: '②站内:纯自然+广告单 ÷ 实际总单量。',
      emptyRules: ['②站内:纯自然+广告单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '②站内:纯自然+广告单', field: 'daily_order_link_tracking.total_onsite_orders' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_orders_ratio',
    },
    onsite_organic_orders_ratio: {
      title: '③站内纯自然单占比',
      formula: '③站内纯自然单 ÷ 实际总单量。',
      emptyRules: ['③站内纯自然单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '③站内纯自然单', field: 'daily_order_link_tracking.onsite_organic_orders' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_organic_orders_ratio',
    },
    onsite_ad_orders_ratio: {
      title: '④站内总广告单占比',
      formula: '④站内总广告单 ÷ 实际总单量。',
      emptyRules: ['④站内总广告单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '④站内总广告单', field: 'daily_order_link_tracking.onsite_ad_orders' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_ad_orders_ratio',
    },
    ideal_cpu_by_margin_formula: {
      title: '目标 CPU',
      formula: '对比实际 CPU 与按利润率推算的理想 CPU，实际高于目标时显示超标金额，否则显示达标',
      emptyRules: ['实际 CPU 为空', '目标 CPU 为空'],
      fields: [
        { label: '实际 CPU', field: 'weekly_performance.cpu' },
        { label: '目标 CPU', field: 'target_default.ideal_cpu_by_margin' },
      ],
      writeBackField: 'target_management.ideal_cpu_by_margin_formula',
    },
    goal_subcategory_rank: {
      title: '目标小类排名',
      formula: '对比实际小类排名与目标小类排名，判断是否达标或落后多少名。',
      emptyRules: ['目标小类排名未填写时提示写目标排名', '实际小类排名为空时结果为空'],
      fields: [
        { label: '实际小类排名', field: 'weekly_performance.ranking' },
        { label: '目标小类排名', field: 'target_management.target_subcategory_rank' },
      ],
      writeBackField: 'target_management.goal_subcategory_rank',
    },
    target_ad_cvr_formula: {
      title: '目标广告 CVR',
      formula: '对比广告 CVR 与目标广告 CVR，实际达到目标时显示达标，否则显示差额百分比。',
      emptyRules: ['广告 CVR 为空', '目标广告 CVR 为空'],
      fields: [
        { label: '广告 CVR', field: 'weekly_performance.guanggaocvr' },
        { label: '目标广告 CVR', field: 'target_default.target_ad_cvr' },
      ],
      writeBackField: 'target_management.target_ad_cvr_formula',
    },
    target_cpa_formula: {
      title: '目标 CPA',
      formula: '对比实际 CPA 与目标 CPA，实际高于目标时显示超标金额，否则显示达标。',
      emptyRules: ['实际 CPA 为空', '目标 CPA 为空'],
      fields: [
        { label: '实际 CPA', field: 'weekly_performance.cpa' },
        { label: '目标 CPA', field: 'target_default.target_cpa' },
      ],
      writeBackField: 'target_management.target_cpa_formula',
    },
    target_profit_margin_formula: {
      title: '目标利润率',
      formula: '对比实际利润率与目标利润率，实际低于目标时显示差额百分比，否则显示达标。',
      emptyRules: ['实际利润率为空', '目标利润率为空'],
      fields: [
        { label: '实际利润率', field: 'daily_profit.profit_margin' },
        { label: '目标利润率', field: 'target_default.target_profit_margin' },
      ],
      writeBackField: 'target_management.target_profit_margin_formula',
    },
    target_ad_spend_rate_formula: {
      title: '目标广告费率',
      formula: '对比实际广告费率与目标广告费率，实际高于目标时显示超出百分比，否则显示达标。',
      emptyRules: ['实际广告费率为空', '目标广告费率为空'],
      fields: [
        { label: '实际广告费率', field: 'daily_profit.ad_cost_ratio' },
        { label: '目标广告费率', field: 'target_default.target_ad_spend_rate' },
      ],
      writeBackField: 'target_management.target_ad_spend_rate_formula',
    },
    gross_revenue_local: {
      title: '成交额-算费率',
      formula: '（实际总单量 - ①测评单）× 普通订单成交售价（不含税）（按折后售价匹配） + ①测评单 × 测评订单成交售价（不含税） （按测评折后价匹配）。',
      emptyRules: ['实际总单量为空', '普通订单成交售价（不含税）未匹配', '①测评单不为 0 时，测评订单成交售价（不含税）未匹配'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '折后售价', field: 'daily_asins.price_after_discount' },
        { label: '测评折后价', field: 'daily_order_link_tracking.review_discounted_price' },
        { label: '普通订单成交售价（不含税）', field: 'JSON：kept_pricing_schemes[].discountPrice 匹配后取 netRevenue；旧数据回退：price_with_tax 匹配后取 net_price' },
        { label: '测评订单成交售价（不含税）', field: 'JSON：kept_testing_schemes[].evaluationPrice 匹配后取 netRevenue；旧数据回退：price_with_tax 匹配后取 net_price' },
      ],
      writeBackField: 'daily_profit.gross_revenue_local',
    },
    net_revenue_local: {
      title: '净销售额（当地币）-算利润',
      formula: '成交额-算费率 - （实际总单量 - ①测评单）× 成交售价（不含税）× 0.93 × 全新品退款占比 （按折后售价匹配）。',
      emptyRules: ['成交额-算费率为空', '实际总单量为空', '成交售价（不含税）未匹配', '全新品退款占比为空'],
      fields: [
        { label: '成交额-算费率', field: 'daily_profit.gross_revenue_local' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '折后售价', field: 'daily_asins.price_after_discount' },
        { label: '成交售价（不含税）', field: 'JSON：kept_pricing_schemes[].discountPrice 匹配后取 netRevenue；旧数据回退：price_with_tax 匹配后取 net_price' },
        { label: '全新品退款占比', field: 'daily_asins.asin_country = product_config.asin_country; return product_config.refund_rate_new' },
      ],
      writeBackField: 'daily_profit.net_revenue_local',
    },
    net_profit_local: {
      title: '纯利润（当地币）',
      formula: '单个利润（不算测评和广告，算了退货）当地币 ×（实际总单量 - ①测评单） + 测评总返款费 - 广告花费 + 总测评回款金额 - Coupon 总费用 - 秒杀总费用（当地币）。',
      emptyRules: ['单个利润（不算测评和广告，算了退货）当地币为空', '实际总单量为空'],
      fields: [
        { label: '单个利润（不算测评和广告，算了退货）当地币', field: 'daily_profit.unit_profit_local' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '测评总返款费', field: 'daily_profit.review_refund_cost' },
        { label: '广告花费', field: 'weekly_performance.guanggaohuafei' },
        { label: '总测评回款金额', field: 'daily_profit.review_refund_total' },
        { label: 'Coupon 总费用', field: 'daily_profit.coupon_total_cost' },
        { label: '秒杀总费用（当地币）', field: 'daily_profit.flash_sale_total_cost' },
      ],
      writeBackField: 'daily_profit.net_profit_local',
    },
    cumulative_break_even: {
      title: '累计盈亏平衡（当地币）',
      formula: '纯利润（当地币） + 当前日期前一天记录的累计盈亏平衡（当地币）；如没有前一天记录，则等于纯利润（当地币）。',
      emptyRules: ['纯利润（当地币）为空'],
      fields: [
        { label: '当前日期', field: 'daily_asins.date' },
        { label: '当前 ASIN_国家', field: 'daily_asins.asin_country' },
        { label: '纯利润（当地币）', field: 'daily_profit.net_profit_local' },
        { label: '前一天累计盈亏平衡（当地币）', field: 'daily_profit.cumulative_break_even' },
      ],
      writeBackField: 'daily_profit.cumulative_break_even',
    },
    coupon_order_ratio_estimated: {
      title: '产生coupon费用的订单比例-预估',
      formula: '销售按每个 ASIN_国家维护的预估比例，用于计算 Coupon 总费用。',
      emptyRules: ['未维护产生coupon费用的订单比例-预估'],
      fields: [
        { label: '当前 ASIN_国家', field: 'daily_asins.asin_country = product_config.asin_country' },
        { label: '产生coupon费用的订单比例-预估', field: 'product_config.coupon_order_ratio_estimated' },
      ],
      writeBackField: 'product_config.coupon_order_ratio_estimated',
    },
    session_conversion_rate: {
      title: '会话转化率',
      formula: '实际总单量 ÷ 汇总流量-会话量，并保留 4 位小数。',
      emptyRules: ['实际总单量为空', '汇总流量-会话量为空或为 0'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '汇总流量-会话量', field: 'weekly_performance.zongliuliang' },
      ],
      writeBackField: 'weekly_performance.session_conversion_rate',
    },
    order_link_real_session_conversion_rate: {
      title: '真实会话转化率（剔除测评单）',
      formula: '（实际总单量 - ①测评单）÷ 汇总流量-会话量，并保留 4 位小数。',
      emptyRules: ['实际总单量为空', '①测评单为空', '汇总流量-会话量为空或为 0'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '汇总流量-会话量', field: 'weekly_performance.zongliuliang' },
      ],
      writeBackField: 'daily_order_link_tracking.real_session_conversion_rate',
    },
    page_view_conversion_rate: {
      title: '页面浏览转化率',
      formula: '实际总单量 ÷ 页面浏览量。',
      emptyRules: ['实际总单量为空', '页面浏览量为空或为 0'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '页面浏览量', field: 'weekly_performance.page_views_total' },
      ],
      writeBackField: 'daily_order_link_tracking.page_view_conversion_rate',
    },
    coupon_total_cost: {
      title: 'Coupon 总费用',
      formula: '折后售价 × 站点Coupon抽佣率 ×（实际总单量 - ①测评单）× 产生coupon费用的订单比例-预估。',
      emptyRules: ['折后售价为空', '站点Coupon抽佣率为空', '实际总单量为空', '产生coupon费用的订单比例-预估为空'],
      fields: [
        { label: '折后售价', field: 'daily_asins.price_after_discount' },
        { label: '站点Coupon抽佣率', field: 'product_config.coupon_commission_rate' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '产生coupon费用的订单比例-预估', field: 'product_config.coupon_order_ratio_estimated' },
      ],
      writeBackField: 'daily_profit.coupon_total_cost',
    },
    flash_sale_total_cost: {
      title: '秒杀总费用（当地币）',
      formula: '第一段：秒杀总单量 × 秒杀价格（当地币） × 站点秒杀抽佣率，与站点秒杀变动费用上限（当地币）比较，取较小值；第二段：站点秒杀每日固定费用（当地币） × 秒杀天数；秒杀总费用（当地币） = 第一段 + 第二段。',
      emptyRules: ['秒杀总单量为空', '秒杀价格（当地币）为空', '站点秒杀抽佣率为空', '站点秒杀变动费用上限（当地币）为空', '站点秒杀每日固定费用（当地币）为空', '秒杀天数为空'],
      fields: [
        { label: '秒杀总单量', field: 'daily_profit.flash_sale_qty' },
        { label: '秒杀价格（当地币）', field: 'daily_profit.flash_sale_price' },
        { label: '站点秒杀抽佣率', field: 'product_config.lightning_commission_rate' },
        { label: '站点秒杀变动费用上限（当地币）', field: 'product_config.lightning_fee_cap' },
        { label: '站点秒杀每日固定费用（当地币）', field: 'product_config.lightning_fixed_fee' },
        { label: '秒杀天数', field: 'daily_profit.flash_sale_days' },
      ],
      writeBackField: 'daily_profit.flash_sale_total_cost',
    },
    flash_sale_cost_per_order: {
      title: '秒杀平均每单的费用 (当地币)',
      formula: '秒杀总费用（当地币） ÷ 秒杀总单量。',
      emptyRules: ['秒杀总费用（当地币）为空', '秒杀总单量为空'],
      fields: [
        { label: '秒杀总费用（当地币）', field: 'daily_profit.flash_sale_total_cost' },
        { label: '秒杀总单量', field: 'daily_profit.flash_sale_qty' },
      ],
      writeBackField: 'daily_profit.flash_sale_cost_per_order',
    },
    profit_margin: {
      title: '利润率（忽略coupon使用率）',
      formula: '纯利润（当地币） ÷ 净销售额（当地币）-算利润。',
      emptyRules: ['纯利润（当地币）为空', '净销售额（当地币）-算利润为空或为 0'],
      fields: [
        { label: '纯利润（当地币）', field: 'daily_profit.net_profit_local' },
        { label: '净销售额（当地币）-算利润', field: 'daily_profit.net_revenue_local' },
      ],
      writeBackField: 'daily_profit.profit_margin',
    },
    ad_cost_ratio: {
      title: '广告费率',
      formula: '广告花费 ÷ 成交额-算费率。',
      emptyRules: ['广告花费为空', '成交额-算费率为空或为 0'],
      fields: [
        { label: '广告花费', field: 'weekly_performance.guanggaohuafei' },
        { label: '成交额-算费率', field: 'daily_profit.gross_revenue_local' },
      ],
      writeBackField: 'daily_profit.ad_cost_ratio',
    },
    tacos: {
      title: 'TACOS',
      formula: '广告花费 ÷ 成交额-算费率，保留 4 位小数。',
      emptyRules: ['广告花费为空', '成交额-算费率为空或为 0'],
      fields: [
        { label: '广告花费', field: 'weekly_performance.guanggaohuafei' },
        { label: '成交额-算费率', field: 'daily_profit.gross_revenue_local' },
      ],
      writeBackField: 'daily_profit.tacos',
    },
    unit_profit_local: {
      title: '单个利润（不算测评和广告，算了退货）当地币',
      formula: '根据当前 ASIN_国家和折后售价，匹配“普通定价”试算记录，取该记录的“月毛利（当地币）”。可理解为100%广告订单的cpa盈亏阈值。',
      emptyRules: ['折后售价为空时显示“请补全折后售价”', '折后售价有值但未匹配到普通定价试算或月毛利为空时显示“请在利润试算中补充新的折后价”'],
      fields: [
        { label: '当前折后售价', field: 'daily_asins.price_after_discount' },
        { label: '当前 ASIN_国家', field: 'daily_asins.asin_country / pricing_scenarios.asin_country' },
        { label: '试算场景', field: 'pricing_scenarios.scenario_type = normal' },
        { label: '试算折后价（含税）', field: 'pricing_scenarios.price_with_tax' },
        { label: '单个利润', field: 'pricing_scenarios.gross_profit' },
      ],
      writeBackField: 'daily_profit.unit_profit_local',
    },
    product_cost_total: {
      title: '产品成本费',
      formula: '根据折后售价匹配“预计折后价（含税，当地币）”，取“月采购成本（当地币）” × 实际总单量。',
      emptyRules: ['折后售价为空', '未匹配到相同 ASIN_国家、折后售价、普通定价的试算记录', '月采购成本（当地币）为空', '实际总单量为空'],
      fields: [
        { label: '折后售价', field: 'daily_asins.price_after_discount' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '按折后售价匹配月采购成本', field: 'daily_asins.asin_country = pricing_scenarios.asin_country; daily_asins.price_after_discount = pricing_scenarios.price_with_tax; pricing_scenarios.scenario_type = normal; return pricing_scenarios.monthly_cogs' },
      ],
      writeBackField: 'daily_profit.product_cost_total',
    },
    product_cost_ratio: {
      title: '产品成本占比',
      formula: '产品成本费 ÷ 成交额-算费率。',
      emptyRules: ['产品成本费为空', '成交额-算费率为空或为 0'],
      fields: [
        { label: '产品成本费', field: 'daily_profit.product_cost_total' },
        { label: '成交额-算费率', field: 'daily_profit.gross_revenue_local' },
      ],
      writeBackField: 'daily_profit.product_cost_ratio',
    },
    unit_profit_after_ad_local: {
      title: '单台利润 (当地币)',
      formula: '纯利润（当地币） ÷ 实际总单量。',
      emptyRules: ['纯利润（当地币）为空', '实际总单量为空或为 0'],
      fields: [
        { label: '纯利润（当地币）', field: 'daily_profit.net_profit_local' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
      ],
      writeBackField: 'daily_profit.unit_profit_after_ad_local',
    },
    unit_profit_rmb: {
      title: '单台利润 (RMB)',
      formula: '单台利润（当地币） × 汇率。',
      emptyRules: ['单台利润（当地币）为空', '汇率为空'],
      fields: [
        { label: '单台利润（当地币）', field: 'daily_profit.unit_profit_after_ad_local' },
        { label: '汇率', field: 'product_config.exchange_rate' },
      ],
      writeBackField: 'daily_profit.unit_profit_rmb',
    },
    review_discounted_price: {
      title: '测评折后价',
      formula: '直接展示当前记录的测评折后价，用于匹配测评方案试算记录。',
      emptyRules: ['测评折后价为空'],
      fields: [
        { label: '测评折后价', field: 'daily_order_link_tracking.review_discounted_price' },
      ],
      writeBackField: 'daily_order_link_tracking.review_discounted_price',
    },
    review_actual_price: {
      title: '测评成交价',
      formula: '按当前行国家、ASIN、测评折后价匹配定价试算记录（scenario_type = review），取成交售价（不含税）。',
      emptyRules: ['未匹配到相同国家、ASIN、测评折后价且 scenario_type = review 的定价试算记录', '成交售价（不含税）为空'],
      fields: [
        { label: '测评折后价', field: 'daily_order_link_tracking.review_discounted_price' },
        { label: '试算场景', field: 'pricing_scenarios.scenario_type = review' },
        { label: '试算折后价（含税）', field: 'pricing_scenarios.price_with_tax' },
        { label: '成交售价（不含税）', field: 'pricing_scenarios.net_price' },
      ],
      writeBackField: 'daily_order_link_tracking.review_actual_price',
    },
    review_refund_per_unit: {
      title: '单个测评返款金额（当地币）-（负数）',
      formula: '根据当前 ASIN_国家和测评折后价，匹配“测评方案”试算记录，取“单个测评返款金额（当地币）”并转为负数。',
      emptyRules: ['测评折后价为空时显示“请补全测评折后价”', '测评折后价有值但未匹配到测评方案试算或单个测评返款金额为空时显示“请在测评试算中补充新的测评折后价”'],
      fields: [
        { label: '测评折后价', field: 'daily_order_link_tracking.review_discounted_price' },
        { label: '当前 ASIN_国家', field: 'daily_asins.asin_country / pricing_scenarios.asin_country' },
        { label: '试算场景', field: 'pricing_scenarios.scenario_type = review' },
        { label: '试算折后价（含税）', field: 'pricing_scenarios.price_with_tax' },
        { label: '测评返款金额', field: 'pricing_scenarios.review_return_amount' },
      ],
      writeBackField: 'daily_profit.review_refund_per_unit',
    },
    review_refund_cost: {
      title: '测评总返款费',
      formula: '单个测评返款金额（当地币）-（负数） × ①测评单',
      emptyRules: ['单个测评返款金额为空', '①测评单为空'],
      fields: [
        { label: '单个测评返款金额', field: 'daily_profit.review_refund_per_unit' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
      ],
      writeBackField: 'daily_profit.review_refund_cost',
    },
    review_cost_ratio: {
      title: '测评费率',
      formula: '测评总返款费 ÷ 成交额-算费率。',
      emptyRules: ['测评总返款费为空', '成交额-算费率为空或为 0'],
      fields: [
        { label: '测评总返款费', field: 'daily_profit.review_refund_cost' },
        { label: '成交额-算费率', field: 'daily_profit.gross_revenue_local' },
      ],
      writeBackField: 'daily_profit.review_cost_ratio',
    },
    review_unit_profit: {
      title: '单个测评订单的售价回款利润金额',
      formula: '根据当前 ASIN_国家和测评折后价，匹配“测评方案”试算记录，取该记录的“月毛利（当地币）”。',
      emptyRules: ['测评折后价为空时显示“请补全测评折后价”', '测评折后价有值但未匹配到测评方案试算或月毛利为空时显示“请在测评试算中补充新的测评折后价”'],
      fields: [
        { label: '测评折后价', field: 'daily_order_link_tracking.review_discounted_price' },
        { label: '当前 ASIN_国家', field: 'daily_asins.asin_country / pricing_scenarios.asin_country' },
        { label: '试算场景', field: 'pricing_scenarios.scenario_type = review' },
        { label: '试算折后价（含税）', field: 'pricing_scenarios.price_with_tax' },
        { label: '售价回款利润', field: 'pricing_scenarios.gross_profit' },
      ],
      writeBackField: 'daily_profit.review_unit_profit',
    },
    review_refund_total: {
      title: '总测评回款金额',
      formula: '单个测评订单的售价回款利润金额 × ①测评单',
      emptyRules: ['单个测评订单的售价回款利润金额为空', '①测评单为空'],
      fields: [
        { label: '单个测评订单的售价回款利润金额', field: 'daily_profit.review_unit_profit' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
      ],
      writeBackField: 'daily_profit.review_refund_total',
    },
  };

  const SRC_GROUP_CONFIG = [
    { src:'fixed', label:'固定列', color:GROUP_COLOR_FIXED },
    { src:'order_structure', label:'订单结构', color:GROUP_COLOR_ORDER_STRUCTURE },
    { src:'traffic_conversion', label:'流量结构&转化', color:GROUP_COLOR_TRAFFIC },
    { src:'link_tracking', label:'链接追踪', color:GROUP_COLOR_LINK_TRACKING },
    { src:'link_notes', label:'链接操作备注', color:GROUP_COLOR_LINK_NOTES },
    { src:'ad_data', label:'广告数据', color:GROUP_COLOR_AD_DATA },
    { src:'profit', label:'利润数据', color:GROUP_COLOR_PROFIT },
    { src:'coupon_flash', label:'优惠卷与秒杀费用测算', color:GROUP_COLOR_COUPON_FLASH },
    { src:'ops_target', label:'运营目标与达成追踪', color:GROUP_COLOR_OPS_TARGET },
    { src:'keyword_position', label:'关键词追踪', color:GROUP_COLOR_KEYWORD },
    { src:'competitor', label:'竞对 ASIN', color:GROUP_COLOR_COMPETITOR },
    { src:'other', label:'辅助字段', color:GROUP_COLOR_OTHER },
  ];

  const SRC_UPDATE_CONFIG = {
    daily:   { url: 'daily_asins:update',               pkField: 'country_asin_date' },
    weekly:  { url: 'weekly_performance:update',        pkField: 'country_asin_week' },
    target:  { url: 'target_management:update',         pkField: 'country_asin_date' },
    profit:  { url: 'daily_profit:update',              pkField: 'country_asin_date' },
    order_link: { url: 'daily_order_link_tracking:update', pkField: 'country_asin_date' },
    product_config: { url: 'product_config:update',     pkField: 'asin_country' },
  };

  const WEEKLY_SUMMARY_COLLECTION = 'daily_weekly_summary';
  const WEEKLY_SUMMARY_SCOPE = 'merge';
  const WEEKLY_SUMMARY_DATA_FIELD = 'merge_summary_data';
  const WEEKLY_SUMMARY_ROW_TYPE = 'weeklySummary';
  const WEEKLY_SUMMARY_BG = '#DDEBF7';
  const WEEKLY_SUMMARY_SUM_FIELDS = new Set([
    'target_order_qty','sales','target_gap','rsg_number',
    'offsite_bg_orders','offsite_xx_orders','offsite_acc_orders','total_offsite_orders',
    'total_onsite_orders','onsite_organic_orders','onsite_ad_orders',
    'sessions_mobile','sessions','zongliuliang','page_views_total',
    'organic_traffic','guanggaodianji','impressions','guanggaohuafei','guanggaodan','ad_sales_amount',
    'indirect_order_volume',
    'ads_sp_cost','ads_sd_cost','shared_ads_sb_cost','shared_ads_sbv_cost',
    'return_count','return_goods_count',
    'review_refund_cost','review_refund_total','net_profit_local','net_revenue_local','gross_revenue_local',
    'offsite_commission_cost','product_cost_total','coupon_total_cost',
    'flash_sale_qty','flash_sale_days','flash_sale_total_cost',
  ]);
  const WEEKLY_SUMMARY_AVG_FIELDS = new Set([
    'review_discounted_price'
  ]);
  const WEEKLY_SUMMARY_LAST_FIELDS = new Set([
    'coupon_order_ratio_estimated'
  ]);
  const WEEKLY_SUMMARY_BLANK_FIELDS = new Set([
    'unit_profit_local','review_refund_per_unit','review_unit_profit','cumulative_break_even'
  ]);
  const WEEKLY_SUMMARY_FORMULA_FIELDS = new Set([
    ...WEEKLY_SUMMARY_SUM_FIELDS,
    ...WEEKLY_SUMMARY_AVG_FIELDS,
    ...WEEKLY_SUMMARY_LAST_FIELDS,
    'review_orders_ratio','offsite_orders_ratio','onsite_orders_ratio','onsite_organic_orders_ratio','onsite_ad_orders_ratio',
    'sp_orders_ratio','sd_orders_ratio','sb_orders_ratio','sbv_orders_ratio',
    'adv_rate','natural_traffic_proportion','ctr','cpc','acos','guanggaocvr','cpa','cpu','tacos',
    'session_conversion_rate','zongcvr','volume_cvr','cpo','order_link_real_session_conversion_rate','real_session_conversion_rate','page_view_conversion_rate',
    'return_rate','return_goods_rate','profit_margin','ad_cost_ratio','review_cost_ratio','product_cost_ratio',
    'offsite_cost_per_order','flash_sale_cost_per_order','unit_profit_local','unit_profit_after_ad_local','unit_profit_rmb',
    'weekly_ad_total_budget','weekly_target_completion_rate',
    'target_ad_cvr_formula','target_cpa_formula','ideal_cpu_by_margin_formula',
    'target_profit_margin_formula','target_ad_spend_rate_formula'
  ]);
  const WEEKLY_SUMMARY_CORE_FIELDS = [];
  const MERGED_WEEKLY_DISPLAY_FIELDS = new Set(['weekly_ad_total_budget', 'weekly_target_completion_rate']);

  const buildColumnPayload = (cols, preserved = []) => [
    ...cols.map((c) => ({ key: c.key, hidden: c.hidden === true, pinned: c.pinned === true, width: Number(c.width) || 80, headerColor: c.headerColor || null, bodyColor: getColBodyColor(c), editable: c.editable === true, richEdit: c.richEdit === true })),
    ...preserved,
  ];

  const normalizeColumnViewId = (viewId) => {
    const id = String(viewId || '').trim();
    return id || DEFAULT_COLUMN_VIEW_IDS[0];
  };

  const isDefaultColumnViewId = (viewId) => DEFAULT_COLUMN_VIEW_IDS.includes(viewId);
  const isCoreColumnViewId = (viewId) => normalizeColumnViewId(viewId) === CORE_COLUMN_VIEW_ID;

  const normalizeColumnViewName = (id, name) => {
    const text = String(name || '').trim();
    if (id === 'default_1' && (!text || text === '默认视图一')) return DEFAULT_COLUMN_VIEW_LABELS.default_1;
    if (id === 'default_2' && (!text || text === '默认视图二')) return DEFAULT_COLUMN_VIEW_LABELS.default_2;
    return text || DEFAULT_COLUMN_VIEW_LABELS[id] || '自定义视图';
  };

  const getViewLabel = (view) => normalizeColumnViewName(view?.id, view?.name);

  const normalizeColumnViewList = (raw, options = {}) => {
    const includeDefaultViews = options.includeDefaultViews !== false;
    const onlyCustomViews = options.onlyCustomViews === true;
    const rawViews = Array.isArray(raw?.views) ? raw.views : (Array.isArray(raw) ? raw : []);
    const viewMap = {};
    rawViews.forEach((view) => {
      const id = normalizeColumnViewId(view?.id);
      if (!id || !Array.isArray(view?.payload) || !view.payload.length) return;
      if (onlyCustomViews && isDefaultColumnViewId(id)) return;
      viewMap[id] = {
        id,
        name: normalizeColumnViewName(id, view.name),
        type: view.type || (isDefaultColumnViewId(id) ? 'default' : 'custom'),
        payload: view.payload,
        updated_at: view.updated_at || null,
      };
    });
    if (includeDefaultViews) {
      DEFAULT_COLUMN_VIEW_IDS.forEach((id) => {
        if (viewMap[id]) return;
        viewMap[id] = {
          id,
          name: normalizeColumnViewName(id),
          type: 'default',
          payload: buildColumnPayload(normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true })),
          updated_at: null,
        };
      });
    }
    return [
      ...(includeDefaultViews ? DEFAULT_COLUMN_VIEW_IDS.map((id) => viewMap[id]).filter(Boolean) : []),
      ...Object.values(viewMap).filter((view) => !isDefaultColumnViewId(view.id)),
    ];
  };

  const normalizeColumnViewState = (setting = {}) => {
    const defaultViews = normalizeColumnViewList(setting[DEFAULT_COLUMN_VIEWS_KEY]);
    const personalRaw = setting[COLUMN_VIEW_SETTING_KEY] || {};
    const personalViews = normalizeColumnViewList(personalRaw, { includeDefaultViews: false, onlyCustomViews: true });
    const defaultMap = Object.fromEntries(defaultViews.map((view) => [view.id, view]));
    const customViews = personalViews.filter((view) => !isDefaultColumnViewId(view.id));
    const views = [
      ...DEFAULT_COLUMN_VIEW_IDS.map((id) => ({
        ...defaultMap[id],
        id,
        name: normalizeColumnViewName(id, defaultMap[id]?.name),
        type: 'default',
      })),
      ...customViews,
    ];
    const activeViewId = normalizeColumnViewId(personalRaw.activeViewId || personalRaw.active_view_id || DEFAULT_COLUMN_VIEW_IDS[0]);
    const activeExists = views.some((view) => view.id === activeViewId);
    return {
      activeViewId: activeExists ? activeViewId : DEFAULT_COLUMN_VIEW_IDS[0],
      views,
      defaultViews,
    };
  };

  const getColumnViewPayload = (state, viewId) => {
    const id = normalizeColumnViewId(viewId || state?.activeViewId);
    const view = state?.views?.find((item) => item.id === id) || state?.views?.[0];
    return Array.isArray(view?.payload) && view.payload.length ? view.payload : null;
  };

  const buildColumnViewSettingPayload = (state, activeViewId) => ({
    activeViewId: normalizeColumnViewId(activeViewId || state?.activeViewId),
    views: (state?.views || [])
      .filter((view) => !isDefaultColumnViewId(view?.id))
      .map((view) => ({
        id: view.id,
        name: getViewLabel(view),
        type: 'custom',
        payload: Array.isArray(view.payload) ? view.payload : [],
        updated_at: view.updated_at || null,
      })),
  });

  const saveColumnViewStateToUser = async (state, activeViewId) => {
    if (!currentUserId) return false;
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    const existingSetting = userRes?.data?.data?.setting || {};
    await ctx.request({
      url: 'users:update',
      method: 'post',
      params: { filterByTk: currentUserId },
      data: {
        setting: {
          ...existingSetting,
          [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload(state, activeViewId),
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return true;
  };

  const saveDefaultColumnViewToCurrentUser = async (viewId, payload, name = null) => {
    if (!currentUserId || !IS_ADMIN || !isDefaultColumnViewId(viewId)) return false;
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    const existingSetting = userRes?.data?.data?.setting || {};
    const state = normalizeColumnViewState(existingSetting);
    const now = new Date().toISOString();
    const sourceHeaderColorMap = getHeaderColorMapFromPayload(payload);
    const defaultViews = DEFAULT_COLUMN_VIEW_IDS.map((id) => {
      const existing = state.defaultViews.find((view) => view.id === id);
      return {
        id,
        name: id === viewId ? normalizeColumnViewName(id, name || existing?.name) : normalizeColumnViewName(id, existing?.name),
        type: 'default',
        payload: id === viewId
          ? (Array.isArray(payload) ? payload : [])
          : (Array.isArray(existing?.payload) && existing.payload.length
            ? existing.payload
            : buildColumnPayload(normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true }))),
        updated_at: id === viewId ? now : (existing?.updated_at || null),
      };
    });
    const syncedDefaultViews = syncHeaderColorsIntoColumnViews(defaultViews, sourceHeaderColorMap, now);
    const defaultViewMap = Object.fromEntries(syncedDefaultViews.map((view) => [view.id, view]));
    const syncedViews = syncHeaderColorsIntoColumnViews(state.views, sourceHeaderColorMap, now)
      .map((view) => isDefaultColumnViewId(view?.id) && defaultViewMap[view.id] ? defaultViewMap[view.id] : view);
    await ctx.request({
      url: 'users:update',
      method: 'post',
      params: { filterByTk: currentUserId },
      data: {
        setting: {
          ...existingSetting,
          [DEFAULT_COLUMN_VIEWS_KEY]: { views: syncedDefaultViews },
          [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload({ activeViewId: viewId, views: syncedViews }, viewId),
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return true;
  };

  const saveDefaultColumnViewPayloadToCurrentUser = async (viewId, payload, name = null) => {
    if (!currentUserId || !isDefaultColumnViewId(viewId)) return false;
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    const existingSetting = userRes?.data?.data?.setting || {};
    const state = normalizeColumnViewState(existingSetting);
    const now = new Date().toISOString();
    const defaultViews = DEFAULT_COLUMN_VIEW_IDS.map((id) => {
      const existing = state.defaultViews.find((view) => view.id === id);
      return {
        id,
        name: id === viewId ? normalizeColumnViewName(id, name || existing?.name) : normalizeColumnViewName(id, existing?.name),
        type: 'default',
        payload: id === viewId
          ? (Array.isArray(payload) ? payload : [])
          : (Array.isArray(existing?.payload) && existing.payload.length
            ? existing.payload
            : buildColumnPayload(normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true }))),
        updated_at: id === viewId ? now : (existing?.updated_at || null),
      };
    });
    await ctx.request({
      url: 'users:update',
      method: 'post',
      params: { filterByTk: currentUserId },
      data: {
        setting: {
          ...existingSetting,
          [DEFAULT_COLUMN_VIEWS_KEY]: { views: defaultViews },
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return true;
  };

  const loadColumnViewStateFromUser = async () => {
    if (!currentUserId) return normalizeColumnViewState({});
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      return normalizeColumnViewState(existingSetting);
    } catch {
      return normalizeColumnViewState({});
    }
  };

  const saveActiveColumnViewToUser = async (viewId) => {
    if (!currentUserId) return false;
    try {
      const state = await loadColumnViewStateFromUser();
      return saveColumnViewStateToUser(state, viewId);
    } catch {
      return false;
    }
  };

  const saveColsToUser = async (cols, options = {}) => {
    if (!currentUserId) return false;
    try {
      const viewId = normalizeColumnViewId(options.viewId);
      const staticKeys = new Set(INITIAL_COLUMNS.map((c) => c.key));
      const state = await loadColumnViewStateFromUser();
      const existingSaved = getColumnViewPayload(state, viewId) || [];
      const incomingKeys = new Set(cols.map((c) => c.key).filter(Boolean));
      const preserved = existingSaved.filter((c) => c?.key && !incomingKeys.has(c.key) && (isDynamicColumnKey(c.key) || staticKeys.has(c.key) || isColumnSettingMetaKey(c.key)));
      const colPayload = buildColumnPayload(cols, preserved);
      const nextViews = state.views.map((view) => view.id === viewId ? { ...view, payload: colPayload, updated_at: new Date().toISOString() } : view);
      await saveColumnViewStateToUser({ ...state, views: nextViews }, viewId);
      return true;
    } catch { ctx.message.error('列设置保存失败'); return false; }
  };

  const loadColsFromUser = async (viewId) => {
    const state = await loadColumnViewStateFromUser();
    return getColumnViewPayload(state, viewId || state.activeViewId);
  };

  const loadDefaultColsFromUser = async (viewId = DEFAULT_COLUMN_VIEW_IDS[0]) => {
    const state = await loadColumnViewStateFromUser();
    const view = state.defaultViews.find((item) => item.id === viewId) || state.defaultViews[0];
    return Array.isArray(view?.payload) && view.payload.length ? view.payload : null;
  };

  const getSavedColumnGroupOrder = (saved) => {
    if (!Array.isArray(saved)) return [];
    const item = saved.find((entry) => entry?.key === COLUMN_GROUP_ORDER_KEY);
    return Array.isArray(item?.order) ? item.order.filter(Boolean) : [];
  };

  const getSavedPageSize = (saved) => {
    if (!Array.isArray(saved)) return DEFAULT_PAGE_SIZE;
    const item = saved.find((entry) => entry?.key === COLUMN_PAGE_SIZE_KEY);
    return normalizePageSizeValue(item?.pageSize ?? item?.page_size ?? item?.value ?? item?.size);
  };

  const upsertColumnPayloadPageSize = (payload, pageSizeValue) => [
    ...(Array.isArray(payload) ? payload.filter((item) => item?.key !== COLUMN_PAGE_SIZE_KEY) : []),
    { key: COLUMN_PAGE_SIZE_KEY, pageSize: normalizePageSizeValue(pageSizeValue) },
  ];

  const getHeaderColorMapFromPayload = (payload) => {
    const map = {};
    if (!Array.isArray(payload)) return map;
    payload.forEach((item) => {
      if (!item?.key || isColumnSettingMetaKey(item.key)) return;
      const hasHeaderColor = Object.prototype.hasOwnProperty.call(item, 'headerColor');
      const hasBodyColor = Object.prototype.hasOwnProperty.call(item, 'bodyColor');
      if (!hasHeaderColor && !hasBodyColor) return;
      map[item.key] = {
        headerColor: hasHeaderColor ? (migrateLegacyColor(item.headerColor) || null) : undefined,
        bodyColor: hasBodyColor ? (getColBodyColor(item) || null) : undefined,
      };
    });
    return map;
  };

  const mergeHeaderColorsIntoColumnPayload = (targetPayload, sourceHeaderColorMap) => {
    const colorMap = sourceHeaderColorMap && typeof sourceHeaderColorMap === 'object' ? sourceHeaderColorMap : {};
    if (!Object.keys(colorMap).length || !Array.isArray(targetPayload)) return targetPayload;
    return targetPayload.map((item) => {
      if (!item?.key || isColumnSettingMetaKey(item.key)) return item;
      if (!Object.prototype.hasOwnProperty.call(colorMap, item.key)) return item;
      const stylePatch = colorMap[item.key];
      const nextColor = stylePatch && typeof stylePatch === 'object' ? stylePatch.headerColor : (stylePatch || null);
      const nextBodyColor = stylePatch && typeof stylePatch === 'object' ? stylePatch.bodyColor : undefined;
      const currentColor = migrateLegacyColor(item.headerColor) || null;
      const currentBodyColor = getColBodyColor(item);
      const nextItem = { ...item };
      let changed = false;
      if (nextColor !== undefined && currentColor !== nextColor) {
        nextItem.headerColor = nextColor;
        changed = true;
      }
      if (nextBodyColor !== undefined && currentBodyColor !== nextBodyColor) {
        nextItem.bodyColor = nextBodyColor;
        changed = true;
      }
      return changed ? nextItem : item;
    });
  };

  const syncHeaderColorsIntoColumnViews = (views, sourceHeaderColorMap, updatedAt = new Date().toISOString()) => {
    const colorMap = sourceHeaderColorMap && typeof sourceHeaderColorMap === 'object' ? sourceHeaderColorMap : {};
    if (!Object.keys(colorMap).length) return Array.isArray(views) ? views : [];
    return (Array.isArray(views) ? views : []).map((view) => ({
      ...view,
      payload: mergeHeaderColorsIntoColumnPayload(view.payload, colorMap),
      updated_at: updatedAt,
    }));
  };

  const saveColumnGroupOrderToUser = async (order, options = {}) => {
    if (!currentUserId) return false;
    try {
      const viewId = normalizeColumnViewId(options.viewId);
      const state = await loadColumnViewStateFromUser();
      const existingSaved = getColumnViewPayload(state, viewId) || [];
      const nextSaved = [
        ...existingSaved.filter((item) => item?.key !== COLUMN_GROUP_ORDER_KEY),
        { key: COLUMN_GROUP_ORDER_KEY, order: Array.isArray(order) ? order.filter(Boolean) : [] },
      ];
      const nextViews = state.views.map((view) => view.id === viewId ? { ...view, payload: nextSaved, updated_at: new Date().toISOString() } : view);
      await saveColumnViewStateToUser({ ...state, views: nextViews }, viewId);
      return true;
    } catch {
      ctx.message.error('板块顺序保存失败');
      return false;
    }
  };

  const saveDefaultColumnViewsToAllUsers = async (defaultViews, targetUserIds = null, options = {}) => {
    if (!IS_ADMIN) return { ok: false, total: 0, failCount: 0 };
    const sourceMap = {};
    (Array.isArray(defaultViews) ? defaultViews : []).forEach((view) => {
      if (!isDefaultColumnViewId(view?.id)) return;
      sourceMap[view.id] = {
        id: view.id,
        name: normalizeColumnViewName(view.id, view.name),
        type: 'default',
        payload: Array.isArray(view.payload) ? view.payload : [],
        updated_at: view.updated_at || new Date().toISOString(),
      };
    });
    DEFAULT_COLUMN_VIEW_IDS.forEach((id) => {
      if (!sourceMap[id]) {
        sourceMap[id] = {
          id,
          name: DEFAULT_COLUMN_VIEW_LABELS[id],
          type: 'default',
          payload: buildColumnPayload(normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true })),
          updated_at: new Date().toISOString(),
        };
      }
    });
    const customHeaderSourceViewId = isDefaultColumnViewId(options.syncCustomHeaderColorsFromViewId)
      ? options.syncCustomHeaderColorsFromViewId
      : null;
    const customHeaderColorMap = customHeaderSourceViewId
      ? getHeaderColorMapFromPayload(sourceMap[customHeaderSourceViewId]?.payload)
      : {};
    if (Object.keys(customHeaderColorMap).length) {
      DEFAULT_COLUMN_VIEW_IDS.forEach((id) => {
        sourceMap[id] = {
          ...sourceMap[id],
          payload: mergeHeaderColorsIntoColumnPayload(sourceMap[id]?.payload, customHeaderColorMap),
          updated_at: new Date().toISOString(),
        };
      });
    }
    const res = await ctx.request({ url: 'users:list', method: 'get', params: { pageSize: 200 } });
    const allUsers = Array.isArray(res?.data?.data) ? res.data.data : [];
    const targetSet = Array.isArray(targetUserIds) && targetUserIds.length ? new Set(targetUserIds.map((id) => String(id))) : null;
    const userList = allUsers.filter((user) => {
      if (!user?.id) return false;
      if (String(user.id) === String(currentUserId)) return false;
      return targetSet ? targetSet.has(String(user.id)) : true;
    });
    if (!userList.length) return { ok: false, total: 0, failCount: 0 };
    const results = await Promise.allSettled(
      userList.map(async (user) => {
        const uid = user?.id;
        if (!uid) return;
        const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
        const existingSetting = userRes?.data?.data?.setting || {};
        const now = new Date().toISOString();
        const currentDefaults = normalizeColumnViewList(existingSetting[DEFAULT_COLUMN_VIEWS_KEY]);
        const nextDefaults = currentDefaults.map((view) => sourceMap[view.id] ? { ...view, ...sourceMap[view.id], updated_at: now } : view);
        const existingState = normalizeColumnViewState(existingSetting);
        const shouldSyncCustomHeaderColors = Object.keys(customHeaderColorMap).length > 0;
        const nextViews = shouldSyncCustomHeaderColors
          ? existingState.views.map((view) => {
              if (isDefaultColumnViewId(view?.id)) return view;
              const nextPayload = mergeHeaderColorsIntoColumnPayload(view.payload, customHeaderColorMap);
              return nextPayload === view.payload ? view : { ...view, payload: nextPayload, updated_at: now };
            })
          : existingState.views;
        const nextSetting = {
          ...existingSetting,
          [DEFAULT_COLUMN_VIEWS_KEY]: { views: nextDefaults },
          ...(shouldSyncCustomHeaderColors
            ? { [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload({ ...existingState, views: nextViews }, existingState.activeViewId) }
            : {}),
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        };
        await ctx.request({
          url: 'users:update',
          method: 'post',
          params: { filterByTk: uid },
          data: { setting: nextSetting },
        });
      })
    );
    const failCount = results.filter((r) => r.status === 'rejected').length;
    return { ok: failCount === 0, total: userList.length, failCount };
  };

  const migrateLegacyColor = (color) => {
    if (!color) return null;
    const normalized = String(color).toLowerCase();
    if (PRESET_COLOR_VALUES.has(normalized)) return color;
    return LEGACY_COLOR_MAP[normalized] || color;
  };

  const getStaticColumnGroupKey = (col) => col?.columnGroup || col?.src || 'other';
  const INITIAL_COLUMN_INDEX = Object.fromEntries(INITIAL_COLUMNS.map((c, idx) => [c.key, idx]));
  const COLUMN_ORDER_OVERRIDES = {
    weekly_return_goods_count: 100,
    weekly_return_goods_rate: 110,
    weekly_ranking: 120,
    order_link_page_screenshot: 130,
    daily_number_of_comments: 150,
    daily_star_rating: 160,
    order_link_formula_review_rate: 170,
    order_link_review_screenshot: 180,
    order_link_bad_review_notes: 190,
    order_link_keyword_trend_screenshot: 200,
    order_link_ad_framework_screenshot: 210,
    order_link_keyword_performance_screenshot: 220,
  };
  const normalizeColumnsByGroup = (cols, options = {}) => {
    const sortWithinGroups = options.sortWithinGroups === true;
    const list = Array.isArray(cols) ? cols.filter(Boolean) : [];
    if (!list.length) return list;
    const buckets = {};
    const groupOrder = [];
    list.forEach((col) => {
      const groupKey = getStaticColumnGroupKey(col);
      if (!buckets[groupKey]) {
        buckets[groupKey] = [];
        groupOrder.push(groupKey);
      }
      buckets[groupKey].push(col);
    });
    return groupOrder.flatMap((groupKey) => {
      const bucket = buckets[groupKey] || [];
      if (!sortWithinGroups) return bucket;
      return [...bucket].sort((a, b) => {
        const ai = Object.prototype.hasOwnProperty.call(COLUMN_ORDER_OVERRIDES, a.key)
          ? COLUMN_ORDER_OVERRIDES[a.key]
          : (Object.prototype.hasOwnProperty.call(INITIAL_COLUMN_INDEX, a.key) ? INITIAL_COLUMN_INDEX[a.key] : Number.MAX_SAFE_INTEGER);
        const bi = Object.prototype.hasOwnProperty.call(COLUMN_ORDER_OVERRIDES, b.key)
          ? COLUMN_ORDER_OVERRIDES[b.key]
          : (Object.prototype.hasOwnProperty.call(INITIAL_COLUMN_INDEX, b.key) ? INITIAL_COLUMN_INDEX[b.key] : Number.MAX_SAFE_INTEGER);
        if (ai !== bi) return ai - bi;
        return bucket.indexOf(a) - bucket.indexOf(b);
      });
    });
  };

  const mergeColumnsWithInitial = (saved) => {
    if (!saved || !Array.isArray(saved) || !saved.length) {
      return normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true });
    }
    const initMap = Object.fromEntries(INITIAL_COLUMNS.map((c) => [c.key, c]));
    const savedMap = Object.fromEntries(saved.map((s) => [s.key, s]));
    const result = [];
    saved.forEach((s) => {
      if (!s?.key || !initMap[s.key]) return;
      result.push({ ...initMap[s.key], hidden: s.hidden === true, pinned: s.pinned === true, width: Number(s.width) || initMap[s.key].width, headerColor: migrateLegacyColor(s.headerColor), bodyColor: getColBodyColor(s), editable: s.editable === true, richEdit: s.richEdit === true });
    });
    INITIAL_COLUMNS.forEach((c, idx) => {
      if (savedMap[c.key]) return;
      const nextInitialKeys = INITIAL_COLUMNS.slice(idx + 1).map((item) => item.key);
      const insertAt = result.findIndex((item) => nextInitialKeys.includes(item.key));
      if (insertAt >= 0) result.splice(insertAt, 0, { ...c });
      else result.push({ ...c });
    });
    return normalizeColumnsByGroup(result);
  };

  const buildColumns = async () => {
    const state = await loadColumnViewStateFromUser();
    const saved = getColumnViewPayload(state, state.activeViewId);
    if (saved) return mergeColumnsWithInitial(saved);
    return normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true });
  };

  const getCellValue = (col, row) => {
    if (!col || !row) return undefined;
    if (row.__rowType === WEEKLY_SUMMARY_ROW_TYPE) {
      if (col.key === 'daily_country') return '周汇总';
      if (col.key === 'daily_promotion_days') return row.week_no ? `第${row.week_no}周` : '';
      if (col.key === 'daily_date') return row.week_range_label || row.week_no || '';
      const data = row.summary_data || {};
      if (Object.prototype.hasOwnProperty.call(data, col.field)) return data[col.field];
      if (Object.prototype.hasOwnProperty.call(data, col.key)) return data[col.key];
      return undefined;
    }
    if (MERGED_WEEKLY_DISPLAY_FIELDS.has(col.field)) {
      const summaryKey = typeof getSummaryKeyForRow === 'function' ? getSummaryKeyForRow(row) : '';
      const summaryData = (summaryKey ? weeklySummaryMap?.[summaryKey]?.summary_data : null) || row.__weeklySummaryData || {};
      if (Object.prototype.hasOwnProperty.call(summaryData, col.field)) return summaryData[col.field];
      if (Object.prototype.hasOwnProperty.call(summaryData, col.key)) return summaryData[col.key];
    }
    if (col._dynamicKind) return row[col.field];
    const sourceRow = row.__src?.[col.src];
    if (sourceRow && Object.prototype.hasOwnProperty.call(sourceRow, col.field)) {
      return sourceRow[col.field];
    }
    return row[col.field];
  };

  const safeDivide = (numerator, denominator) => {
    const n = toFormulaNumber(numerator);
    const d = toFormulaNumber(denominator);
    if (n == null || d == null || d === 0) return null;
    return n / d;
  };

  const sumFieldFromRows = (rows, field, colsByField = null) => {
    const col = colsByField?.[field] || null;
    let hasValue = false;
    const sum = (Array.isArray(rows) ? rows : []).reduce((total, row) => {
      const value = col ? getCellValue(col, row) : row?.[field];
      const n = toFormulaNumber(value);
      if (n == null) return total;
      hasValue = true;
      return total + n;
    }, 0);
    return hasValue ? roundMoney(sum) : null;
  };

  const sumFieldFromRowsLikeExcel = (rows, field, colsByField = null) => {
    const value = sumFieldFromRows(rows, field, colsByField);
    return value == null ? 0 : value;
  };

  const avgFieldFromRows = (rows, field, colsByField = null) => {
    const col = colsByField?.[field] || null;
    const nums = (Array.isArray(rows) ? rows : [])
      .map((row) => toFormulaNumber(col ? getCellValue(col, row) : row?.[field]))
      .filter((n) => n != null);
    if (!nums.length) return null;
    return roundMoney(nums.reduce((sum, n) => sum + n, 0) / nums.length);
  };

  const lastValueFromRows = (rows, field, colsByField = null) => {
    const col = colsByField?.[field] || null;
    for (let i = (Array.isArray(rows) ? rows.length : 0) - 1; i >= 0; i -= 1) {
      const value = col ? getCellValue(col, rows[i]) : rows[i]?.[field];
      if (value !== null && value !== undefined && value !== '') return value;
    }
    return null;
  };

  const lastSourceValueFromRows = (rows, src, field) => {
    for (let i = (Array.isArray(rows) ? rows.length : 0) - 1; i >= 0; i -= 1) {
      const value = rows[i]?.__src?.[src]?.[field];
      if (value !== null && value !== undefined && value !== '') return value;
    }
    return null;
  };

  const formatWeeklyPercentDiff = (value, digits) => {
    const n = toFormulaNumber(value);
    if (n == null) return '';
    return `${(n * 100).toFixed(digits)}%`;
  };

  const formatWeeklyIntegerDiff = (value) => {
    const n = toFormulaNumber(value);
    if (n == null) return '';
    return String(Math.round(n));
  };

  const calcWeeklyTargetAdCvrFormula = (actual, target) => {
    const actualNum = toFormulaNumber(actual);
    const targetNum = toFormulaNumber(target);
    if (actualNum == null) return '';
    if (targetNum == null) return null;
    return actualNum >= targetNum ? '√' : `x -${formatWeeklyPercentDiff(targetNum - actualNum, 1)}`;
  };

  const calcWeeklyTargetCpaFormula = (actual, target) => {
    const actualNum = toFormulaNumber(actual);
    const targetNum = toFormulaNumber(target);
    if (actualNum == null || targetNum == null) return '';
    return actualNum > targetNum ? `CPA超标${formatWeeklyIntegerDiff(actualNum - targetNum)}` : '√';
  };

  const calcWeeklyTargetCpuFormula = (actual, target) => {
    const actualNum = toFormulaNumber(actual);
    const targetNum = toFormulaNumber(target);
    if (actualNum == null || targetNum == null) return '';
    return actualNum > targetNum ? `CPU超标${formatWeeklyIntegerDiff(actualNum - targetNum)}` : '√';
  };

  const calcWeeklyTargetProfitMarginFormula = (actual, target) => {
    const actualNum = toFormulaNumber(actual);
    const targetNum = toFormulaNumber(target);
    if (actualNum == null || targetNum == null) return '';
    return actualNum < targetNum ? `X -${formatWeeklyPercentDiff(targetNum - actualNum, 2)}` : '√';
  };

  const calcWeeklyTargetAdSpendRateFormula = (actual, target) => {
    const actualNum = toFormulaNumber(actual);
    const targetNum = toFormulaNumber(target);
    if (actualNum == null || targetNum == null) return '';
    return actualNum > targetNum ? `X -${formatWeeklyPercentDiff(actualNum - targetNum, 2)}` : '√';
  };

  const getWeekRangeForDate = (dateValue) => {
    const dateKey = toDateKey(dateValue);
    if (!dateKey) return null;
    const date = new Date(`${dateKey}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    const start = new Date(date);
    start.setUTCDate(date.getUTCDate() - date.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return {
      start: start.toISOString().slice(0, 10),
      end: end.toISOString().slice(0, 10),
    };
  };

  const getWeekNoSundayStart = (dateValue) => {
    const range = getWeekRangeForDate(dateValue);
    if (!range) return null;
    const dateKey = toDateKey(dateValue);
    const date = new Date(`${dateKey}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return null;
    const start = new Date(`${range.start}T00:00:00Z`);
    const yearStart = new Date(`${date.getUTCFullYear()}-01-01T00:00:00Z`);
    const firstWeekStart = new Date(yearStart);
    firstWeekStart.setUTCDate(yearStart.getUTCDate() - yearStart.getUTCDay());
    return Math.floor((start.getTime() - firstWeekStart.getTime()) / 86400000 / 7) + 1;
  };

  const getWeeklySummaryKey = (rowOrParts) => {
    const country = rowOrParts?.country;
    const asin = rowOrParts?.asin;
    const start = rowOrParts?.week_start_date || rowOrParts?.start;
    const end = rowOrParts?.week_end_date || rowOrParts?.end;
    if (!country || !asin || !start || !end) return '';
    return `${country}_${asin}_${start}_${end}`;
  };

  const groupRowsByNaturalWeek = (rows) => {
    const groups = {};
    (Array.isArray(rows) ? rows : []).forEach((row) => {
      if (row?.__rowType === WEEKLY_SUMMARY_ROW_TYPE) return;
      const range = getWeekRangeForDate(row?.date);
      if (!range || !row?.country || !row?.asin) return;
      const key = getWeeklySummaryKey({ country: row.country, asin: row.asin, ...range });
      if (!groups[key]) groups[key] = { key, range, rows: [] };
      groups[key].rows.push(row);
    });
    Object.values(groups).forEach((group) => {
      group.rows.sort((a, b) => toDateKey(a?.date).localeCompare(toDateKey(b?.date)));
    });
    return groups;
  };

  const buildWeeklySummaryFromRows = (rows, cols) => {
    const sortedRows = [...(Array.isArray(rows) ? rows : [])]
      .filter((row) => row && row.__rowType !== WEEKLY_SUMMARY_ROW_TYPE)
      .sort((a, b) => toDateKey(a?.date).localeCompare(toDateKey(b?.date)));
    if (!sortedRows.length) return null;
    const first = sortedRows[0];
    const last = sortedRows[sortedRows.length - 1];
    const range = getWeekRangeForDate(last?.date || first?.date);
    if (!range || !first?.country || !first?.asin) return null;

    const columnsForSummary = Array.isArray(cols) && cols.length ? cols : INITIAL_COLUMNS;
    const colsByField = {};
    columnsForSummary.forEach((col) => {
      if (col?.field && !colsByField[col.field]) colsByField[col.field] = col;
    });

    const summaryData = {};
    columnsForSummary.forEach((col) => {
      if (!col?.key) return;
      let value = null;
      if (col.key === 'daily_country') value = '周汇总';
      else if (col.key === 'daily_promotion_days') value = '';
      else if (col.key === 'daily_date') value = `${range.start}~${range.end}`;
      else if (WEEKLY_SUMMARY_BLANK_FIELDS.has(col.field)) {
        value = null;
      }
      else if (col._dynamicKind === 'keyword') {
        value = buildKeywordWeeklyTrend(sortedRows.map((row) => row[col.field]?.daily?.actual_rank));
      } else if (col._dynamicKind) {
        value = null;
      } else if (WEEKLY_SUMMARY_SUM_FIELDS.has(col.field)) {
        value = col.field === 'flash_sale_total_cost'
          ? sumFieldFromRowsLikeExcel(sortedRows, col.field, colsByField)
          : sumFieldFromRows(sortedRows, col.field, colsByField);
      } else if (WEEKLY_SUMMARY_AVG_FIELDS.has(col.field)) {
        value = avgFieldFromRows(sortedRows, col.field, colsByField);
      } else if (WEEKLY_SUMMARY_LAST_FIELDS.has(col.field)) {
        value = lastValueFromRows(sortedRows, col.field, colsByField);
      } else {
        value = null;
      }
      if (value !== null && value !== undefined && value !== '') {
        if (col.field && !Object.prototype.hasOwnProperty.call(summaryData, col.field)) summaryData[col.field] = value;
      }
    });

    const setDerived = (field, value) => {
      if (!WEEKLY_SUMMARY_FORMULA_FIELDS.has(field)) return;
      if (value == null) return;
      summaryData[field] = roundRate(value, 4);
    };
    const setMoneyDerived = (field, value) => {
      if (!WEEKLY_SUMMARY_FORMULA_FIELDS.has(field)) return;
      if (value == null) return;
      summaryData[field] = roundMoney(value);
    };
    const setTextDerived = (field, value) => {
      if (!WEEKLY_SUMMARY_FORMULA_FIELDS.has(field)) return;
      if (value == null) return;
      summaryData[field] = value;
    };

    [
      'target_ad_cvr',
      'target_cpa',
      'ideal_cpu_by_margin',
      'target_profit_margin',
      'target_ad_spend_rate',
      'exchange_rate',
    ].forEach((field) => {
      const value = lastValueFromRows(sortedRows, field, colsByField)
        ?? lastSourceValueFromRows(sortedRows, 'target_default', field)
        ?? lastSourceValueFromRows(sortedRows, 'product_config', field);
      if (value !== null && value !== undefined && value !== '') summaryData[field] = value;
    });

    setDerived('review_orders_ratio', safeDivide(summaryData.rsg_number, summaryData.sales));
    setDerived('offsite_orders_ratio', safeDivide(summaryData.total_offsite_orders, summaryData.sales));
    setDerived('onsite_orders_ratio', safeDivide(summaryData.total_onsite_orders, summaryData.sales));
    setDerived('onsite_organic_orders_ratio', safeDivide(summaryData.onsite_organic_orders, summaryData.sales));
    setDerived('onsite_ad_orders_ratio', safeDivide(summaryData.onsite_ad_orders, summaryData.sales));
    setDerived('adv_rate', safeDivide(summaryData.guanggaodan, summaryData.sales));
    setDerived('natural_traffic_proportion', safeDivide(summaryData.organic_traffic, summaryData.zongliuliang));
    setDerived('ctr', safeDivide(summaryData.guanggaodianji, summaryData.impressions));
    setMoneyDerived('cpc', safeDivide(summaryData.guanggaohuafei, summaryData.guanggaodianji));
    setDerived('acos', safeDivide(summaryData.guanggaohuafei, summaryData.ad_sales_amount));
    setDerived('tacos', safeDivide(summaryData.guanggaohuafei, summaryData.gross_revenue_local));
    setDerived('guanggaocvr', safeDivide(summaryData.guanggaodan, summaryData.guanggaodianji));
    setMoneyDerived('cpa', safeDivide(summaryData.guanggaohuafei, summaryData.guanggaodan));
    setMoneyDerived('cpu', safeDivide(summaryData.guanggaohuafei, summaryData.sales));
    setDerived('session_conversion_rate', safeDivide(summaryData.sales, summaryData.zongliuliang));
    setDerived('zongcvr', safeDivide(summaryData.sales, summaryData.zongliuliang));
    setDerived('volume_cvr', safeDivide(summaryData.sales, summaryData.zongliuliang));
    setMoneyDerived('cpo', safeDivide(summaryData.guanggaohuafei, summaryData.sales));
    setDerived('order_link_real_session_conversion_rate', safeDivide(summaryData.sales == null || summaryData.rsg_number == null ? null : summaryData.sales - summaryData.rsg_number, summaryData.zongliuliang));
    setDerived('real_session_conversion_rate', summaryData.order_link_real_session_conversion_rate);
    setDerived('page_view_conversion_rate', safeDivide(summaryData.sales, summaryData.page_views_total));
    setDerived('return_rate', safeDivide(summaryData.return_count, summaryData.sales));
    setDerived('return_goods_rate', safeDivide(summaryData.return_goods_count, summaryData.sales));
    setDerived('profit_margin', safeDivide(summaryData.net_profit_local, summaryData.net_revenue_local));
    setDerived('ad_cost_ratio', safeDivide(summaryData.guanggaohuafei, summaryData.gross_revenue_local));
    setDerived('review_cost_ratio', safeDivide(summaryData.review_refund_cost, summaryData.gross_revenue_local));
    setDerived('product_cost_ratio', safeDivide(summaryData.product_cost_total, summaryData.gross_revenue_local));
    setMoneyDerived('offsite_cost_per_order', safeDivide(summaryData.offsite_commission_cost, summaryData.total_offsite_orders));
    setMoneyDerived('flash_sale_cost_per_order', safeDivide(summaryData.flash_sale_total_cost, summaryData.flash_sale_qty) ?? 0);
    setMoneyDerived('unit_profit_after_ad_local', safeDivide(summaryData.net_profit_local, summaryData.sales));
    const unitProfitLocalNum = toFormulaNumber(summaryData.unit_profit_after_ad_local);
    const exchangeRateNum = toFormulaNumber(summaryData.exchange_rate);
    const unitProfitRmb = unitProfitLocalNum == null || exchangeRateNum == null
      ? null
      : unitProfitLocalNum * exchangeRateNum;
    setMoneyDerived('unit_profit_rmb', unitProfitRmb);
    const weeklyAdBudgetCpu = toFormulaNumber(
      lastSourceValueFromRows(sortedRows, 'target_default', 'ideal_cpu_by_margin')
        ?? summaryData.ideal_cpu_by_margin
    );
    const weeklyAdBudgetQty = toFormulaNumber(summaryData.target_order_qty);
    setMoneyDerived('weekly_ad_total_budget', weeklyAdBudgetCpu == null || weeklyAdBudgetQty == null ? null : weeklyAdBudgetCpu * weeklyAdBudgetQty);
    setDerived('weekly_target_completion_rate', safeDivide(summaryData.sales, summaryData.target_order_qty));
    setTextDerived('target_ad_cvr_formula', calcWeeklyTargetAdCvrFormula(summaryData.guanggaocvr, summaryData.target_ad_cvr));
    setTextDerived('target_cpa_formula', calcWeeklyTargetCpaFormula(summaryData.cpa, summaryData.target_cpa));
    setTextDerived('ideal_cpu_by_margin_formula', calcWeeklyTargetCpuFormula(summaryData.cpu, summaryData.ideal_cpu_by_margin));
    setTextDerived('target_profit_margin_formula', calcWeeklyTargetProfitMarginFormula(summaryData.profit_margin, summaryData.target_profit_margin));
    setTextDerived('target_ad_spend_rate_formula', calcWeeklyTargetAdSpendRateFormula(summaryData.ad_cost_ratio, summaryData.target_ad_spend_rate));

    const weekNo = getWeekNoSundayStart(last?.date || first?.date);
    summaryData.daily_promotion_days = weekNo ? `第${weekNo}周` : '';
    const summaryKey = getWeeklySummaryKey({ country: first.country, asin: first.asin, ...range });
    const summaryRow = {
      __rowType: WEEKLY_SUMMARY_ROW_TYPE,
      country_asin_week_range: summaryKey,
      id: summaryKey,
      country: first.country,
      asin: first.asin,
      asin_country: first.asin_country || (first.asin && first.country ? `${first.asin}_${first.country}` : null),
      model: lastValueFromRows(sortedRows, 'model', colsByField),
      sale_owner: lastValueFromRows(sortedRows, 'sale_owner', colsByField),
      week_start_date: range.start,
      week_end_date: range.end,
      week_no: weekNo,
      week_range_label: `${range.start}~${range.end}`,
      source_days_count: sortedRows.length,
      [WEEKLY_SUMMARY_DATA_FIELD]: summaryData,
      summary_data: summaryData,
    };
    WEEKLY_SUMMARY_CORE_FIELDS.forEach((field) => {
      summaryRow[field] = Object.prototype.hasOwnProperty.call(summaryData, field) ? summaryData[field] : null;
    });
    return summaryRow;
  };

  const buildKeywordWeeklyTrend = (values) => {
    const cleaned = (Array.isArray(values) ? values : []).map((v) => String(v ?? '').trim()).filter(Boolean);
    if (!cleaned.length) return null;
    if (cleaned.some((v) => v === '无')) return '本周有掉队';
    if (cleaned.length < 2) return '仅首日数据';
    const parseRank = (value) => {
      const match = String(value || '').match(/P(\d+)-(\d+)/i);
      return match ? Number(match[1]) * 100 + Number(match[2]) : null;
    };
    const first = parseRank(cleaned[0]);
    const last = parseRank(cleaned[cleaned.length - 1]);
    if (first == null || last == null) return cleaned[cleaned.length - 1];
    if (last < first) return '走势：上升';
    if (last > first) return '走势：下滑';
    return '走势：持平';
  };

  const mergeSourcePatch = (row, src, patch) => {
    if (!src || !patch) return { ...row, ...(patch || {}) };
    return {
      ...row,
      ...patch,
      __src: {
        ...(row.__src || {}),
        [src]: {
          ...(row.__src?.[src] || {}),
          ...patch,
        },
      },
    };
  };

  const DAILY_FORMULA_PATCH_FIELDS = new Set(['activity_annotation', 'off', 'promo_day', 'lp_duration_days', 'promo_days_40d', 'promo_days_90d', 'target_gap']);
  const TARGET_FORMULA_PATCH_FIELDS = new Set([
    'goal_subcategory_rank',
    'target_ad_cvr_formula',
    'target_cpa_formula',
    'ideal_cpu_by_margin_formula',
    'target_profit_margin_formula',
    'target_ad_spend_rate_formula',
  ]);
  const WEEKLY_FORMULA_PATCH_FIELDS = new Set(['session_conversion_rate']);
  const ORDER_LINK_FORMULA_PATCH_FIELDS = new Set([
    'net_price_without_tax',
    'review_actual_price',
    'total_onsite_orders',
    'onsite_organic_orders',
    'onsite_ad_orders',
    'review_orders_ratio',
    'formula_review_rate',
    'onsite_orders_ratio',
    'onsite_organic_orders_ratio',
    'onsite_ad_orders_ratio',
    'real_session_conversion_rate',
    'order_link_real_session_conversion_rate',
    'page_view_conversion_rate',
  ]);
  const FORMULA_INPUT_FIELDS = new Set([
    'date',
    'list_price',
    'daily_price',
    'price_after_discount',
    'promotion_days',
    'target_order_qty',
    'review_discounted_price',
    'sales',
    'guanggaodan',
    'zongliuliang',
    'page_views_total',
    'guanggaohuafei',
    'flash_sale_qty',
    'flash_sale_price',
    'flash_sale_days',
    'coupon_order_ratio_estimated',
    'target_ad_cvr',
    'target_cpa',
    'ideal_cpu_by_margin',
    'target_profit_margin',
    'target_ad_spend_rate',
    'refund_rate_new',
    'coupon_commission_rate',
    'lightning_commission_rate',
    'lightning_fee_cap',
    'lightning_fixed_fee',
    'exchange_rate',
  ]);
  const isFormulaSensitiveField = (colOrField) => {
    if (!colOrField) return false;
    if (typeof colOrField === 'string') return FORMULA_INPUT_FIELDS.has(colOrField);
    if (colOrField._dynamicKind) return false;
    return FORMULA_INPUT_FIELDS.has(colOrField.field);
  };
  const mergeFormulaPatch = (row, patch) => {
    const dailyPatch = {};
    const targetPatch = {};
    const orderLinkPatch = {};
    const weeklyPatch = {};
    const profitPatch = {};
    Object.entries(patch || {}).forEach(([field, value]) => {
      if (DAILY_FORMULA_PATCH_FIELDS.has(field)) dailyPatch[field] = value;
      else if (TARGET_FORMULA_PATCH_FIELDS.has(field)) targetPatch[field] = value;
      else if (ORDER_LINK_FORMULA_PATCH_FIELDS.has(field)) orderLinkPatch[field] = value;
      else if (WEEKLY_FORMULA_PATCH_FIELDS.has(field)) weeklyPatch[field] = value;
      else profitPatch[field] = value;
    });
    let nextRow = { ...row, ...(patch || {}) };
    if (Object.keys(dailyPatch).length) nextRow = mergeSourcePatch(nextRow, 'daily', dailyPatch);
    if (Object.keys(targetPatch).length) nextRow = mergeSourcePatch(nextRow, 'target', targetPatch);
    if (Object.keys(orderLinkPatch).length) nextRow = mergeSourcePatch(nextRow, 'order_link', orderLinkPatch);
    if (Object.keys(weeklyPatch).length) nextRow = mergeSourcePatch(nextRow, 'weekly', weeklyPatch);
    if (Object.keys(profitPatch).length) nextRow = mergeSourcePatch(nextRow, 'profit', profitPatch);
    return nextRow;
  };

  const formatCell = (col, row) => {
    const v = getCellValue(col, row);
    if (row?.__rowType === WEEKLY_SUMMARY_ROW_TYPE) {
      if (col.field === 'weekly_ad_total_budget') {
        const data = row.summary_data || {};
        const rate = safeDivide(data.guanggaohuafei, data.weekly_ad_total_budget);
        return rate == null ? '—' : formatPercent(rate);
      }
      if (col.field === 'weekly_target_completion_rate') {
        const rate = toFormulaNumber(v);
        return rate == null ? '—' : formatPercent(rate);
      }
      if (v == null || v === '') return '—';
      if (MONEY_FIELDS.has(col.field)) return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
      if (RATE_FIELDS.has(col.field)) return formatPercent(v);
      return String(v);
    }
    if (col._dynamicKind === 'keyword') {
      const rank = v?.daily?.actual_rank;
      return rank != null && rank !== '' ? String(rank) : '—';
    }
    if (col._dynamicKind === 'competitor') {
      const value = v?.daily?.[col._competitorField];
      return value != null && value !== '' ? String(value) : '—';
    }
    if (col.field === 'promo_day') return v === 1 || v === '1' || v === true ? '是' : (v === 0 || v === '0' || v === false ? '否' : '—');
    if (col.field === 'order_structure_diagnostic') return ORDER_STRUCTURE_DIAGNOSED_MAP[v] || v || '—';
    if (col.field === 'weekly_ad_total_budget') {
      return (v != null && v !== '') ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '—';
    }
    if (col.field === 'weekly_target_completion_rate') {
      const summaryKey = typeof getSummaryKeyForRow === 'function' ? getSummaryKeyForRow(row) : '';
      const summaryData = (summaryKey ? weeklySummaryMap?.[summaryKey]?.summary_data : null) || row.__weeklySummaryData || {};
      const text = buildWeeklyTargetCompletionText({
        adSpend: toFormulaNumber(summaryData.guanggaohuafei),
        weeklyAdTotalBudget: toFormulaNumber(summaryData.weekly_ad_total_budget),
        flashSaleDays: toFormulaNumber(summaryData.flash_sale_days),
        targetAdSpendRate: toFormulaNumber(summaryData.target_ad_spend_rate),
        completionRate: toFormulaNumber(summaryData.weekly_target_completion_rate ?? v),
      });
      if (text) return text;
      if (v == null || v === '') return '—';
      const rate = toFormulaNumber(v);
      return rate == null ? String(v) : formatPercent(rate);
    }
    if (MONEY_FIELDS.has(col.field)) return (v != null && v !== '') ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '—';
    if (RATE_FIELDS.has(col.field))  return (v != null && v !== '') ? formatPercent(v) : '—';
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

  const renderCellDisplay = (col, row, cachedDisplayContent) => {
    const displayContent = cachedDisplayContent === undefined
      ? formatCell(col, row)
      : cachedDisplayContent;
    const formulaMissingHint = getFormulaMissingHint(col, row);
    if (formulaMissingHint) return formulaMissingHint;
    const flashSaleMissingMessage = getFlashSaleMissingMessage(col, row);
    if (flashSaleMissingMessage) return flashSaleMissingMessage;
    if (col.field !== 'target_gap') return displayContent;
    const rawValue = getCellValue(col, row);
    if (rawValue == null || rawValue === '') return displayContent;
    const num = Number(rawValue);
    if (!Number.isFinite(num)) return displayContent;
    const isNegative = num < 0;
    return React.createElement('span', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
      },
    },
      React.createElement('span', {
        style: {
          display: 'inline-grid',
          gridTemplateColumns: '14px 28px',
          alignItems: 'center',
          columnGap: '6px',
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
      React.createElement('span', {
        style: {
          display: 'inline-block',
          minWidth: '28px',
          textAlign: 'right',
          fontVariantNumeric: 'tabular-nums',
        },
      }, displayContent)
      )
    );
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

  const useExternalSelection = typeof useSyncExternalStore === 'function'
    ? useSyncExternalStore
    : function useExternalSelectionFallback(subscribe, getSnapshot) {
      const [snapshot, setSnapshot] = useState(getSnapshot);
      useEffect(() => subscribe(() => setSnapshot(getSnapshot())), [subscribe, getSnapshot]);
      return snapshot;
    };

  const createSelectionStore = () => {
    let range = null;
    let rect = null;
    const entries = new Map();
    const normalize = (value) => {
      if (!value) return null;
      return {
        r1: Math.min(value.start.r, value.end.r),
        r2: Math.max(value.start.r, value.end.r),
        c1: Math.min(value.start.c, value.end.c),
        c2: Math.max(value.start.c, value.end.c),
      };
    };
    const contains = (rect, r, c) => !!rect
      && r >= rect.r1
      && r <= rect.r2
      && c >= rect.c1
      && c <= rect.c2;
    const isSameRange = (left, right) => {
      if (left === right) return true;
      if (!left || !right) return false;
      return left.start.r === right.start.r
        && left.start.c === right.start.c
        && left.end.r === right.end.r
        && left.end.c === right.end.c;
    };
    return {
      subscribe(r, c, listener) {
        const key = `${r}:${c}`;
        let entry = entries.get(key);
        if (!entry) {
          entry = { r, c, listeners: new Set() };
          entries.set(key, entry);
        }
        entry.listeners.add(listener);
        return () => {
          entry.listeners.delete(listener);
          if (!entry.listeners.size) entries.delete(key);
        };
      },
      isSelected(r, c) {
        return contains(rect, r, c);
      },
      setRange(nextRange) {
        if (isSameRange(range, nextRange)) return;
        const previousRect = rect;
        const nextRect = normalize(nextRange);
        range = nextRange;
        rect = nextRect;
        entries.forEach((entry) => {
          if (contains(previousRect, entry.r, entry.c) === contains(nextRect, entry.r, entry.c)) return;
          entry.listeners.forEach((listener) => listener());
        });
      },
    };
  };

  const SelectionOverlay = React.memo(({ store, rowIndex, columnIndex }) => {
    const subscribe = useCallback(
      (listener) => store.subscribe(rowIndex, columnIndex, listener),
      [columnIndex, rowIndex, store]
    );
    const getSnapshot = useCallback(
      () => store.isSelected(rowIndex, columnIndex),
      [columnIndex, rowIndex, store]
    );
    const selected = useExternalSelection(subscribe, getSnapshot, () => false);
    if (!selected) return null;
    return React.createElement('span', {
      'aria-hidden': true,
      style: {
        position: 'absolute',
        inset: 0,
        zIndex: 3,
        pointerEvents: 'none',
        boxShadow: 'inset 0 0 0 2px #1677ff',
      },
    });
  });

  // 推送配置面板
  // 推送配置面板
  // 推送配置面板
  const PushPanel = ({ onClose, anchorPos, onPush }) => {
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [expandedDepartments, setExpandedDepartments] = useState({});
    const [userSearchText, setUserSearchText] = useState('');
    const [pushing, setPushing] = useState(false);

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

    const getUserDepartment = (user) => {
      const raw = user?.department ?? user?.departments ?? user?.department_name ?? user?.dept;
      if (Array.isArray(raw)) return raw.map((item) => String(item?.title || item?.name || item || '').trim()).filter(Boolean).join(' / ') || '未分部门';
      if (raw && typeof raw === 'object') return String(raw.title || raw.name || raw.label || raw.id || '').trim() || '未分部门';
      return String(raw || '').trim() || '未分部门';
    };
    const getUserName = (user) => String(user?.nickname || user?.name || user?.username || user?.email || user?.id || '未命名用户');
    const departmentGroups = useMemo(() => {
      const groups = {};
      userList.forEach((user) => {
        const dept = getUserDepartment(user);
        if (!groups[dept]) groups[dept] = [];
        groups[dept].push(user);
      });
      return Object.keys(groups).sort((a, b) => a.localeCompare(b)).map((dept) => ({
        dept,
        users: groups[dept].sort((a, b) => getUserName(a).localeCompare(getUserName(b))),
      }));
    }, [userList]);
    const departmentUserIds = useMemo(() => Object.fromEntries(
      departmentGroups.map((group) => [group.dept, group.users.map((user) => String(user.id)).filter(Boolean)])
    ), [departmentGroups]);
    const selectedUserIdSet = useMemo(() => new Set(selectedUserIds.map((id) => String(id))), [selectedUserIds]);
    const normalizedUserSearch = normalizeSearchText(userSearchText);
    const visibleDepartmentGroups = useMemo(() => {
      if (!normalizedUserSearch) return departmentGroups;
      return departmentGroups
        .map((group) => {
          const deptMatched = normalizeSearchText(group.dept).includes(normalizedUserSearch);
          const users = deptMatched
            ? group.users
            : group.users.filter((user) => normalizeSearchText(getUserName(user)).includes(normalizedUserSearch));
          return { ...group, users, forceOpen: deptMatched || users.length > 0 };
        })
        .filter((group) => group.users.length);
    }, [departmentGroups, normalizedUserSearch]);
    const toggleDepartment = useCallback((dept) => {
      setExpandedDepartments((prev) => ({ ...prev, [dept]: !prev[dept] }));
    }, []);
    const toggleDepartmentUsers = useCallback((dept) => {
      const ids = departmentUserIds[dept] || [];
      if (!ids.length) return;
      setSelectedUserIds((prev) => {
        const next = new Set(prev.map((id) => String(id)));
        const allSelected = ids.every((id) => next.has(String(id)));
        ids.forEach((id) => {
          if (allSelected) next.delete(String(id));
          else next.add(String(id));
        });
        return [...next];
      });
    }, [departmentUserIds]);
    const toggleUser = useCallback((userId) => {
      const id = String(userId || '');
      if (!id) return;
      setSelectedUserIds((prev) => {
        const next = new Set(prev.map((item) => String(item)));
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return [...next];
      });
    }, []);

    const handlePush = useCallback(async () => {
      if (!selectedUserIds.length) { ctx.message.warning('请先选择推送人员'); return; }
      setPushing(true);
      try {
        const result = await onPush(selectedUserIds);
        if (result?.ok) onClose();
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setPushing(false); }
    }, [onClose, onPush, selectedUserIds]);

    return React.createElement('div', {
      style: { position: 'fixed', top: `${anchorPos.top}px`, left: `${anchorPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', width: '480px', fontSize: `${FONT_SIZE}px` },
      onClick: (e) => e.stopPropagation(),
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', null, '推送完整列、核心列'),
        React.createElement('span', { onClick: onClose, style: { cursor: 'pointer', color: '#999', fontSize: '18px' } }, '×'),
      ),
      React.createElement('div', { style: { marginBottom: '14px' } },
        React.createElement('div', { style: { marginBottom: '6px', fontWeight: 600 } }, '推送目标'),
        loadingUsers
          ? React.createElement('div', { style: { textAlign: 'center', padding: '8px', color: '#999' } }, '加载用户中...')
          : React.createElement(React.Fragment, null,
            React.createElement(Input, {
              value: userSearchText,
              allowClear: true,
              placeholder: '搜索部门或人员',
              size: 'small',
              onChange: (e) => setUserSearchText(e.target.value),
              style: { marginBottom: '8px' },
            }),
            React.createElement('div', { style: { maxHeight: '300px', overflowY: 'auto', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' } },
              visibleDepartmentGroups.length
                ? visibleDepartmentGroups.map((group) => {
                  const ids = departmentUserIds[group.dept] || [];
                  const selectedCount = ids.filter((id) => selectedUserIdSet.has(String(id))).length;
                  const allSelected = ids.length > 0 && selectedCount === ids.length;
                  const isOpen = normalizedUserSearch ? true : !!expandedDepartments[group.dept];
                  return React.createElement('div', { key: group.dept, style: { borderBottom: '1px solid #edf2f7' } },
                    React.createElement('div', { onClick: () => toggleDepartment(group.dept), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#f8fafc', cursor: 'pointer', userSelect: 'none' } },
                      React.createElement('span', { style: { width: '14px', color: '#64748b', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', display: 'inline-block' } }, '>'),
                      React.createElement('span', { style: { flex: 1, fontWeight: 700, color: '#334155' } }, `${group.dept}（${selectedCount}/${ids.length}）`),
                      React.createElement('button', { onClick: (e) => { e.stopPropagation(); toggleDepartmentUsers(group.dept); }, style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: allSelected ? '#fff1f0' : '#e6f4ff', color: allSelected ? '#cf1322' : '#0958d9', border: `1px solid ${allSelected ? '#ffccc7' : '#91caff'}`, borderRadius: '4px', cursor: 'pointer' } }, allSelected ? '取消全选' : '全选')
                    ),
                    isOpen && React.createElement('div', { style: { padding: '4px 0' } },
                      group.users.map((user) => {
                        const id = String(user.id);
                        const selected = selectedUserIdSet.has(id);
                        return React.createElement('div', { key: id, onClick: () => toggleUser(id), style: { padding: '7px 34px', cursor: 'pointer', background: selected ? '#e6f4ff' : '#fff', color: selected ? '#0958d9' : '#334155', fontWeight: selected ? 700 : 400, display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
                          React.createElement('span', null, getUserName(user)),
                          selected && React.createElement('span', { style: { color: '#1677ff', fontWeight: 800 } }, '已选')
                        );
                      })
                    )
                  );
                })
                : React.createElement('div', { style: { padding: '16px', textAlign: 'center', color: '#94a3b8' } }, '没有匹配人员')
            )
          )
      ),
      React.createElement('div', { style: { marginBottom: '16px', padding: '8px 10px', color: '#555', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' } }, `已选择 ${selectedUserIds.length} 位用户，推送内容为完整列、核心列的全部配置。`),
      React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
        React.createElement('button', { onClick: onClose, disabled: pushing, style: { padding: '6px 16px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: pushing ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px` } }, '取消'),
        React.createElement('button', { onClick: handlePush, disabled: pushing || loadingUsers || !selectedUserIds.length, style: { padding: '6px 16px', color: '#fff', border: 'none', borderRadius: '4px', fontSize: `${FONT_SIZE}px`, fontWeight: 600, background: (pushing || loadingUsers || !selectedUserIds.length) ? '#b5d8ff' : '#1890ff', cursor: (pushing || loadingUsers || !selectedUserIds.length) ? 'not-allowed' : 'pointer' } }, pushing ? '推送中...' : '确认推送'),
      ),
    );
  };

  const RichTextImageCell = ({ value, onSave, placeholder = '+', cellKey, openSignal, cellBackground = null, onAfterSaveExit }) => {
    const [content, setContent] = useState(value || '');
    const [isEditing, setIsEditing] = useState(false);
    const [tempContent, setTempContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [hoverTip, setHoverTip] = useState(null);
    const [editorPos, setEditorPos] = useState({ top: 0, left: 0 });
    const cellRef = useRef(null);
    const editorRef = useRef(null);

    useEffect(() => { setContent(value || ''); }, [value]);

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
      const saved = tempContent !== content ? await saveToDatabase(tempContent) : true;
      setIsEditing(false);
      if (saved) onAfterSaveExit?.();
    };
    const stopEditorClipboardEvent = (e) => {
      e?.stopPropagation?.();
    };
    const openEditor = (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const rect = e?.rect || (e?.currentTarget || cellRef.current)?.getBoundingClientRect?.();
      const panelWidth = 520;
      const gap = 8;
      let left = rect ? rect.right + gap : 24;
      let top = rect ? rect.top : 24;
      if (rect && rect.left > panelWidth + gap + 12) left = rect.left - panelWidth - gap;
      left = Math.max(12, left);
      top = Math.max(12, top);
      setEditorPos({ top, left });
      setHoverTip(null);
      setTempContent(content || '');
      setIsEditing(true);
    };
    useEffect(() => {
      if (!openSignal || openSignal.cellKey !== cellKey) return;
      openEditor({ rect: openSignal.rect, preventDefault: () => {}, stopPropagation: () => {} });
    }, [openSignal]);
    const uploadFile = async (file) => {
      setUploading(true);
      try {
        const formData = new window.FormData();
        formData.append('file', file);
        const res = await ctx.request({ url: 'attachments:upload', method: 'post', data: formData, headers: { 'Content-Type': 'multipart/form-data' } });
        const url = res?.data?.data?.url || res?.data?.url;
        if (url) {
          const markdownImage = `![截图](${url})`;
          const next = tempContent ? `${tempContent}\n\n${markdownImage}` : markdownImage;
          setTempContent(next);
          const saved = await saveToDatabase(next);
          if (saved) {
            setTempContent(next);
          }
        }
      } catch (err) {
        ctx.message.error(`上传失败：${err?.message || ''}`);
      } finally {
        setUploading(false);
      }
    };
    const handlePasteImage = (e) => {
      if (!isEditing) return;
      e.stopPropagation();
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
    const openImagePreview = (e, url) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      setPreviewUrl(url);
    };
    const previewLayer = previewUrl && React.createElement('div', {
      style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' },
      onMouseDown: (e) => { e.preventDefault(); e.stopPropagation(); },
      onClick: (e) => { e.stopPropagation(); setPreviewUrl(null); },
    },
      React.createElement('img', {
        src: previewUrl,
        onMouseDown: (e) => { e.preventDefault(); e.stopPropagation(); },
        onClick: (e) => e.stopPropagation(),
        style: { maxWidth: '95%', maxHeight: '92vh', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)' },
      })
    );
    const tooltipLayer = hoverTip && !isEditing && cleanText && React.createElement('div', {
      style: {
        position: 'fixed',
        left: `${hoverTip.x + 12}px`,
        top: `${hoverTip.y + 12}px`,
        zIndex: 9998,
        maxWidth: '320px',
        maxHeight: '150px',
        overflow: 'auto',
        padding: '7px 9px',
        background: '#fff',
        color: '#1f2937',
        border: '1px solid #cbd5e1',
        borderRadius: '4px',
        boxShadow: '0 6px 18px rgba(15,23,42,0.16)',
        fontSize: '12px',
        lineHeight: '18px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
        textAlign: 'left',
        pointerEvents: 'none',
      },
    }, cleanText);
    const editorImageUrls = useMemo(() => extractImages(tempContent), [tempContent]);
    if (isEditing) {
      return React.createElement(React.Fragment, null,
        React.createElement('div', {
          style: { height: '46px', display: 'flex', alignItems: 'center', padding: '3px 5px', background: '#eef6ff', border: '1px solid #1890ff', borderRadius: '6px', color: '#0958d9', boxSizing: 'border-box', overflow: 'hidden', fontSize: '12px' },
        }, uploading ? '正在上传截图...' : '正在编辑，弹窗中保存后生效'),
        React.createElement('div', {
          style: { position: 'fixed', inset: 0, zIndex: 9995, background: 'transparent' },
          onMouseDown: () => { if (!uploading && !previewUrl) saveAndExit(); },
        }),
        React.createElement('div', {
          ref: editorRef,
          'data-rich-editor-panel': '1',
          style: { position: 'fixed', top: `${editorPos.top}px`, left: `${editorPos.left}px`, zIndex: 9996, width: 'min(520px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 24px)', background: '#fff', borderRadius: '8px', boxShadow: '0 12px 32px rgba(15,23,42,0.24)', border: '1px solid #d8e3f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
          onMouseDown: (e) => e.stopPropagation(),
          onClick: (e) => e.stopPropagation(),
          onCopy: stopEditorClipboardEvent,
          onCut: stopEditorClipboardEvent,
          onPaste: stopEditorClipboardEvent,
          onKeyDown: (e) => e.stopPropagation(),
        },
            React.createElement('div', {
              style: { padding: '9px 12px', borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
            },
              React.createElement('div', { style: { fontWeight: 700, color: '#1f2937', fontSize: '13px' } }, '编辑单元格内容'),
              React.createElement('button', {
                type: 'button',
                onClick: () => setIsEditing(false),
                disabled: uploading,
                style: { border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '20px', lineHeight: 1, cursor: uploading ? 'not-allowed' : 'pointer', padding: '2px 4px' },
              }, '×')
            ),
            React.createElement('div', { style: { padding: '10px 12px 8px' } },
              React.createElement('textarea', {
                value: tempContent,
                onChange: (e) => setTempContent(e.target.value),
                onCopy: stopEditorClipboardEvent,
                onCut: stopEditorClipboardEvent,
                onPaste: handlePasteImage,
                onKeyDown: (e) => {
                  e.stopPropagation();
                  if (e.key === 'Escape') setIsEditing(false);
                  if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    saveAndExit();
                  }
                },
                autoFocus: true,
                disabled: uploading,
                placeholder: '输入文字...\n支持 Ctrl + V 粘贴截图\nCtrl + Enter 保存，Esc 取消',
                style: { width: '100%', height: editorImageUrls.length ? '180px' : '260px', minHeight: '150px', maxHeight: '46vh', border: '1px solid #b6d7ff', borderRadius: '6px', padding: '9px 10px', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical', background: '#fbfdff', lineHeight: '20px', outline: 'none', boxSizing: 'border-box', overflow: 'auto' },
              }),
              editorImageUrls.length > 0 && React.createElement('div', {
                style: { marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '150px', overflow: 'auto', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f8fafc' },
              },
                editorImageUrls.map((url, idx) =>
                  React.createElement('img', {
                    key: `${url}-${idx}`,
                    src: url,
                    onMouseDown: (e) => openImagePreview(e, url),
                    onClick: (e) => openImagePreview(e, url),
                    style: { width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'zoom-in' },
                  })
                )
              )
            ),
            React.createElement('div', {
              style: { padding: '8px 12px 10px', borderTop: '1px solid #edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
            },
              React.createElement('div', { style: { color: '#64748b', fontSize: '12px' } }, uploading ? '截图上传中，请稍候' : '点击框外自动保存'),
              React.createElement('div', { style: { display: 'flex', gap: '8px' } },
                React.createElement('button', {
                  type: 'button',
                  onClick: () => setIsEditing(false),
                  disabled: uploading,
                  style: { padding: '6px 16px', background: '#fff', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '4px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '13px' },
                }, '取消'),
                React.createElement('button', {
                  type: 'button',
                  onClick: saveAndExit,
                  disabled: uploading,
                  style: { padding: '6px 18px', background: uploading ? '#93c5fd' : '#1677ff', color: '#fff', border: '1px solid #1677ff', borderRadius: '4px', cursor: uploading ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: 700 },
                }, uploading ? '上传中...' : '保存')
              )
            )
        ),
        previewLayer
      );
    }
    const isEmpty = !cleanText && imageUrls.length === 0;
    return React.createElement(React.Fragment, null,
      React.createElement('div', { ref: cellRef, onMouseEnter: (e) => { if (!isEmpty) setHoverTip({ x: e.clientX, y: e.clientY }); }, onMouseMove: (e) => { if (!isEmpty) setHoverTip({ x: e.clientX, y: e.clientY }); }, onMouseLeave: () => setHoverTip(null), style: { height: '46px', display: 'flex', alignItems: 'center', justifyContent: isEmpty ? 'center' : 'flex-start', gap: '5px', padding: '3px 5px', background: cellBackground || (content ? '#fafafa' : '#fff'), border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'cell', overflow: 'hidden', boxSizing: 'border-box' } },
        isEmpty
          ? React.createElement('div', { style: { fontSize: '16px', color: '#999', lineHeight: '18px', fontWeight: 700, textAlign: 'center' } }, placeholder)
          : React.createElement(React.Fragment, null,
              imageUrls.slice(0, 2).map((url, idx) =>
                React.createElement('img', {
                  key: `${url}-${idx}`,
                  src: url,
                  onMouseDown: (e) => openImagePreview(e, url),
                  onClick: (e) => openImagePreview(e, url),
                  style: { width: '34px', height: '34px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', flex: '0 0 auto', cursor: 'zoom-in' },
                })
              ),
              cleanText && React.createElement('div', { style: { minWidth: 0, flex: '1 1 auto', fontSize: '12px', color: '#333', lineHeight: '16px', maxHeight: '36px', overflow: 'hidden', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, cleanText)
            )
      ),
      previewLayer,
      tooltipLayer
    );
  };

  const formatTrendChartValue = (value, valueType) => {
    const number = toFormulaNumber(value);
    if (number == null) return '-';
    if (valueType === 'percent') return `${(number * 100).toFixed(2).replace(/\.?0+$/, '')}%`;
    if (valueType === 'integer' && Number.isInteger(number)) return number.toLocaleString('zh-CN');
    return Math.abs(number) >= 1000
      ? number.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
      : number.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };

  const MergedTrendLineChart = ({ dates, series }) => {
    const width = 1560;
    const height = 700;
    const margin = { top: 58, right: 118, bottom: 116, left: 118 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const safeDates = Array.isArray(dates) ? dates : [];
    const safeSeries = (Array.isArray(series) ? series : []).filter((item) => item.data.some((value) => toFormulaNumber(value) != null));
    const [hoverIndex, setHoverIndex] = useState(null);

    if (!safeDates.length || !safeSeries.length) {
      return React.createElement('div', {
        style: { minHeight: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', fontSize: '16px' },
      }, '所选条件没有真实数据');
    }

    const buildScale = (values, integerOnly = false) => {
      const clean = values.map(toFormulaNumber).filter((value) => value != null);
      if (!clean.length) return null;
      let min = Math.min(...clean);
      let max = Math.max(...clean);
      if (integerOnly) {
        if (min === max && min === 0) return { min: 0, max: 1, step: 1, integerOnly: true };
        const span = Math.max(1, max - min || Math.abs(max) || Math.abs(min));
        const paddedMin = min < 0 ? min - span * 0.08 : 0;
        const paddedMax = max > 0 ? max + span * 0.08 : 0;
        const roughStep = Math.max(1, (paddedMax - paddedMin) / 4);
        const magnitude = 10 ** Math.floor(Math.log10(roughStep));
        const normalized = roughStep / magnitude;
        const niceNormalized = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10;
        const step = Math.max(1, Math.ceil(niceNormalized * magnitude));
        const scaleMin = paddedMin < 0 ? Math.floor(paddedMin / step) * step : 0;
        const scaleMax = paddedMax > 0 ? Math.ceil(paddedMax / step) * step : 0;
        return { min: scaleMin, max: scaleMax === scaleMin ? scaleMin + step : scaleMax, step, integerOnly: true };
      }
      if (min === max) {
        if (min === 0) return { min: 0, max: 1 };
        const pad = Math.max(Math.abs(min) * 0.12, 1);
        return min > 0 ? { min: 0, max: min + pad } : { min: min - pad, max: 0 };
      }
      const pad = (max - min) * 0.08;
      min = min < 0 ? min - pad : 0;
      max = max > 0 ? max + pad : 0;
      return { min, max: max === min ? min + 1 : max };
    };
    const leftSeries = safeSeries.filter((item) => item.axis === 'left');
    const leftIntegerOnly = leftSeries.length > 0 && leftSeries.every((item) => (
      item.valueType === 'integer' && item.data.every((value) => {
        const number = toFormulaNumber(value);
        return number == null || Number.isInteger(number);
      })
    ));
    const leftScale = buildScale(leftSeries.flatMap((item) => item.data), leftIntegerOnly);
    const rightScale = buildScale(safeSeries.filter((item) => item.axis === 'right').flatMap((item) => item.data));
    const ticks = (scale) => {
      if (!scale) return [];
      if (scale.integerOnly) return Array.from({ length: Math.round((scale.max - scale.min) / scale.step) + 1 }, (_, index) => scale.min + scale.step * index);
      return Array.from({ length: 5 }, (_, index) => scale.min + ((scale.max - scale.min) * index) / 4);
    };
    const xFor = (index) => safeDates.length === 1 ? margin.left + plotWidth / 2 : margin.left + (plotWidth * index) / (safeDates.length - 1);
    const yFor = (value, scale) => margin.top + ((scale.max - Number(value)) / (scale.max - scale.min)) * plotHeight;
    const pathFor = (item, scale) => {
      let path = '';
      let started = false;
      item.data.forEach((value, index) => {
        const number = toFormulaNumber(value);
        if (number == null) { started = false; return; }
        path += `${started ? 'L' : 'M'} ${xFor(index).toFixed(2)} ${yFor(number, scale).toFixed(2)} `;
        started = true;
      });
      return path.trim();
    };
    const labelStep = Math.max(1, Math.ceil(safeDates.length / 18));
    const activeHoverIndex = Number.isInteger(hoverIndex) && hoverIndex >= 0 && hoverIndex < safeDates.length ? hoverIndex : null;
    const hoverDate = activeHoverIndex == null ? null : safeDates[activeHoverIndex];
    const hoverX = activeHoverIndex == null ? null : xFor(activeHoverIndex);
    const hoverRows = hoverDate ? safeSeries.map((item) => ({ ...item, value: item.data[activeHoverIndex] })) : [];
    const tooltipLeft = hoverX == null ? '50%' : `${Math.min(92, Math.max(8, (hoverX / width) * 100))}%`;
    const tooltipTransform = hoverX != null && hoverX > width * 0.62 ? 'translateX(-100%) translateX(-12px)' : 'translateX(12px)';

    return React.createElement('div', {
      style: { position: 'relative', background: '#111827', border: '1px solid #1f2937', borderRadius: '8px', padding: '18px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' },
      onMouseLeave: () => setHoverIndex(null),
    },
      React.createElement('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height: 'auto', role: 'img', style: { display: 'block' } },
        React.createElement('rect', { x: 0, y: 0, width, height, fill: '#111827' }),
        ticks(leftScale || rightScale).map((tick, index) => React.createElement('line', { key: `grid_${index}`, x1: margin.left, y1: yFor(tick, leftScale || rightScale), x2: margin.left + plotWidth, y2: yFor(tick, leftScale || rightScale), stroke: '#243244', strokeWidth: 1 })),
        ticks(leftScale).map((tick, index) => React.createElement('text', { key: `left_${index}`, x: margin.left - 14, y: yFor(tick, leftScale) + 5, textAnchor: 'end', fill: '#94a3b8', fontSize: 16, fontWeight: 700 }, formatTrendChartValue(tick, leftIntegerOnly ? 'integer' : 'decimal'))),
        ticks(rightScale).map((tick, index) => React.createElement('text', { key: `right_${index}`, x: margin.left + plotWidth + 14, y: yFor(tick, rightScale) + 5, textAnchor: 'start', fill: '#F59E0B', fontSize: 16, fontWeight: 700 }, formatTrendChartValue(tick, 'percent'))),
        React.createElement('line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('line', { x1: margin.left + plotWidth, y1: margin.top, x2: margin.left + plotWidth, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('line', { x1: margin.left, y1: margin.top + plotHeight, x2: margin.left + plotWidth, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('text', { x: margin.left, y: margin.top - 22, fill: '#94a3b8', fontSize: 17, fontWeight: 800, textAnchor: 'middle' }, '数值/金额'),
        React.createElement('text', { x: margin.left + plotWidth, y: margin.top - 22, fill: '#F59E0B', fontSize: 17, fontWeight: 800, textAnchor: 'middle' }, '百分比'),
        safeDates.map((date, index) => {
          if (index % labelStep !== 0 && index !== safeDates.length - 1) return null;
          const x = xFor(index);
          return React.createElement('text', { key: `date_${date.key}`, x, y: margin.top + plotHeight + 34, fill: '#94a3b8', fontSize: 15, fontWeight: 700, textAnchor: 'end', transform: `rotate(-38 ${x} ${margin.top + plotHeight + 34})` }, date.label);
        }).filter(Boolean),
        safeSeries.map((item) => {
          const scale = item.axis === 'right' ? rightScale : leftScale;
          return scale ? React.createElement('path', { key: `line_${item.key}`, d: pathFor(item, scale), fill: 'none', stroke: item.color, strokeWidth: 3.2, strokeLinejoin: 'round', strokeLinecap: 'round', opacity: 0.95 }) : null;
        }),
        safeSeries.flatMap((item) => {
          const scale = item.axis === 'right' ? rightScale : leftScale;
          if (!scale) return [];
          return item.data.map((value, index) => {
            const number = toFormulaNumber(value);
            return number == null ? null : React.createElement('circle', { key: `point_${item.key}_${safeDates[index].key}`, cx: xFor(index), cy: yFor(number, scale), r: 4.5, fill: item.color, stroke: '#111827', strokeWidth: 2 });
          }).filter(Boolean);
        }),
        safeDates.map((date, index) => {
          const currentX = xFor(index);
          const prevX = index > 0 ? xFor(index - 1) : margin.left;
          const nextX = index < safeDates.length - 1 ? xFor(index + 1) : margin.left + plotWidth;
          const x1 = safeDates.length === 1 ? margin.left : (prevX + currentX) / 2;
          const x2 = safeDates.length === 1 ? margin.left + plotWidth : (currentX + nextX) / 2;
          return React.createElement('rect', { key: `hover_${date.key}`, x: x1, y: margin.top, width: Math.max(1, x2 - x1), height: plotHeight, fill: 'transparent', pointerEvents: 'all', style: { cursor: 'crosshair' }, onMouseEnter: () => setHoverIndex(index), onMouseMove: () => setHoverIndex(index) });
        }),
        hoverDate && React.createElement('line', { x1: hoverX, y1: margin.top, x2: hoverX, y2: margin.top + plotHeight, stroke: '#e2e8f0', strokeWidth: 1.4, strokeDasharray: '4 5', opacity: 0.72, pointerEvents: 'none' })
      ),
      hoverDate && React.createElement('div', {
        style: { position: 'absolute', top: '54px', left: tooltipLeft, transform: tooltipTransform, width: '360px', maxWidth: 'calc(100% - 32px)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.45)', background: 'rgba(15,23,42,0.96)', color: '#e2e8f0', boxShadow: '0 18px 42px rgba(15,23,42,0.36)', zIndex: 2 },
      },
        React.createElement('div', { style: { color: '#f8fafc', fontWeight: 800, fontSize: '16px', marginBottom: '10px' } }, hoverDate.label),
        React.createElement('div', { style: { display: 'grid', gap: '7px', maxHeight: '300px', overflowY: 'auto' } },
          hoverRows.map((row) => React.createElement('div', { key: `tip_${row.key}`, style: { display: 'grid', gridTemplateColumns: '10px minmax(0,1fr) auto', alignItems: 'center', gap: '10px', fontSize: '14px' } },
            React.createElement('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: row.color } }),
            React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#cbd5e1' } }, row.name),
            React.createElement('span', { style: { color: toFormulaNumber(row.value) == null ? '#64748b' : '#f8fafc', fontWeight: 800 } }, formatTrendChartValue(row.value, row.valueType))
          ))
        )
      ),
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px 14px', padding: '6px 4px 0', maxHeight: '96px', overflowY: 'auto' } },
        safeSeries.map((item) => React.createElement('div', { key: `legend_${item.key}`, style: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '14px', fontWeight: 700 } },
          React.createElement('span', { style: { width: '18px', height: '3px', borderRadius: '2px', background: item.color } }),
          React.createElement('span', null, item.name)
        ))
      )
    );
  };

  const MergedTrendChartModal = ({ visible, onClose, country, asin, dateRange }) => {
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [chartRows, setChartRows] = useState([]);
    const [selectedFieldKeys, setSelectedFieldKeys] = useState(TREND_CHART_DEFAULT_FIELD_KEYS);
    const [dateRangeState, setDateRangeState] = useState({ scopeKey: '', value: null });
    const [dateModeState, setDateModeState] = useState({ scopeKey: '', value: 'available' });
    const dateRangeStart = dateRange?.[0] || '';
    const dateRangeEnd = dateRange?.[1] || '';
    const dateRangeScopeKey = `${country || ''}|${asin || ''}|${dateRangeStart}|${dateRangeEnd}`;
    const selectedDateRange = dateRangeState.scopeKey === dateRangeScopeKey ? dateRangeState.value : null;
    const dateMode = dateModeState.scopeKey === dateRangeScopeKey ? dateModeState.value : 'available';
    const displayedDateRange = selectedDateRange || (dateRangeStart && dateRangeEnd ? [dateRangeStart, dateRangeEnd] : null);
    const todayDate = ctx.libs.dayjs().format('YYYY-MM-DD');
    const presetDateRange = dateMode === '7d'
      ? [ctx.libs.dayjs().subtract(6, 'day').format('YYYY-MM-DD'), todayDate]
      : dateMode === '30d'
        ? [ctx.libs.dayjs().subtract(29, 'day').format('YYYY-MM-DD'), todayDate]
        : null;
    const queryDateStart = dateMode === 'available'
      ? ''
      : presetDateRange?.[0] || selectedDateRange?.[0] || dateRangeStart;
    const queryDateEnd = dateMode === 'available'
      ? todayDate
      : presetDateRange?.[1] || selectedDateRange?.[1] || dateRangeEnd;
    const fieldMap = useMemo(() => Object.fromEntries(TREND_CHART_FIELDS.map((field) => [field.key, field])), []);
    const fieldOptionsByGroup = useMemo(() => Object.fromEntries(TREND_CHART_FIELD_GROUPS.map((group) => [
      group.key,
      TREND_CHART_FIELDS.filter((field) => field.group === group.key).map((field) => ({ value: field.key, label: field.label })),
    ])), []);
    const updateSelectedFieldsByGroup = (groupKey, groupFieldKeys) => {
      const groupKeys = new Set(TREND_CHART_FIELDS.filter((field) => field.group === groupKey).map((field) => field.key));
      const nextGroupKeys = new Set(Array.isArray(groupFieldKeys) ? groupFieldKeys : []);
      setSelectedFieldKeys((currentKeys) => TREND_CHART_FIELDS.filter((field) => (
        groupKeys.has(field.key) ? nextGroupKeys.has(field.key) : currentKeys.includes(field.key)
      )).map((field) => field.key));
    };

    useEffect(() => {
      if (!visible) return undefined;
      let active = true;
      const fetchAll = async (url, params = {}) => {
        const rows = [];
        for (let page = 1; page <= 1000; page += 1) {
          const res = await ctx.request({ url, method: 'get', params: { ...params, page, pageSize: 500 } });
          const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
          rows.push(...batch);
          const totalPage = Number(res?.data?.meta?.totalPage);
          if (batch.length < 500 || (Number.isFinite(totalPage) && page >= totalPage)) break;
        }
        return rows;
      };
      const fetchByKeys = async (url, field, keys) => {
        const rows = [];
        for (let index = 0; index < keys.length; index += 80) {
          const chunk = keys.slice(index, index + 80);
          rows.push(...await fetchAll(url, { filter: JSON.stringify({ [field]: { $in: chunk } }) }));
        }
        return rows;
      };
      const loadChartData = async () => {
        setErrorText('');
        setChartRows([]);
        if (!country || !asin) { setLoading(false); return; }
        try {
          setLoading(true);
          const filterAnd = [{ country: { $eq: country } }, { asin: { $eq: asin } }];
          if (queryDateStart) filterAnd.push({ date: { $gte: queryDateStart } });
          if (queryDateEnd) filterAnd.push({ date: { $lte: queryDateEnd } });
          const dailyRows = await fetchAll('daily_asins:list', { sort: 'date', filter: JSON.stringify({ $and: filterAnd }) });
          const dailyKeys = [...new Set(dailyRows.map((row) => row?.country_asin_date).filter(Boolean))];
          const [weeklyRows, profitRows] = await Promise.all([
            fetchByKeys('weekly_performance:list', 'country_asin_week', dailyKeys),
            fetchByKeys('daily_profit:list', 'country_asin_date', dailyKeys),
          ]);
          if (!active) return;
          const weeklyMap = Object.fromEntries(weeklyRows.filter((row) => row?.country_asin_week).map((row) => [row.country_asin_week, row]));
          const profitMap = Object.fromEntries(profitRows.filter((row) => row?.country_asin_date).map((row) => [row.country_asin_date, row]));
          const loadedDates = dailyRows.map((row) => toDateKey(row?.date)).filter(Boolean).sort();
          if (dateMode === 'available' && !selectedDateRange && loadedDates.length && (!dateRangeStart || !dateRangeEnd)) {
            setDateRangeState({
              scopeKey: dateRangeScopeKey,
              value: [dateRangeStart || loadedDates[0], dateRangeEnd || loadedDates[loadedDates.length - 1]],
            });
          }
          setChartRows(dailyRows.map((row) => ({
            key: row.country_asin_date || `${country}_${asin}_${toDateKey(row.date)}`,
            date: toDateKey(row.date),
            weekly: weeklyMap[row.country_asin_date] || {},
            profit: profitMap[row.country_asin_date] || {},
          })).filter((row) => row.date));
        } catch (error) {
          if (active) { setChartRows([]); setErrorText(`加载图表数据失败：${error?.message || '未知错误'}`); }
        } finally {
          if (active) setLoading(false);
        }
      };
      loadChartData();
      return () => { active = false; };
    }, [visible, country, asin, queryDateStart, queryDateEnd, dateRangeScopeKey, dateMode]);

    const chartPayload = useMemo(() => {
      const rowsWithSelectedData = chartRows.filter((row) => selectedFieldKeys.some((key) => {
        const field = fieldMap[key];
        return field && toFormulaNumber(row[field.src]?.[field.field]) != null;
      }));
      const dates = rowsWithSelectedData.map((row) => ({ key: row.key, label: row.date }));
      const series = selectedFieldKeys.map((key, index) => {
        const field = fieldMap[key];
        if (!field) return null;
        return { key, name: field.label, axis: field.axis, valueType: field.valueType, color: TREND_CHART_LINE_COLORS[index % TREND_CHART_LINE_COLORS.length], data: rowsWithSelectedData.map((row) => toFormulaNumber(row[field.src]?.[field.field])) };
      }).filter(Boolean);
      return { dates, series };
    }, [chartRows, fieldMap, selectedFieldKeys]);
    const availableDataDates = chartRows.filter((row) => TREND_CHART_FIELDS.some((field) => (
      toFormulaNumber(row[field.src]?.[field.field]) != null
    ))).map((row) => row.date).filter(Boolean).sort();
    const availableDateRange = availableDataDates.length ? [availableDataDates[0], todayDate] : null;
    const pickerDateRange = dateMode === 'custom'
      ? displayedDateRange
      : presetDateRange || availableDateRange;

    return React.createElement(Modal, {
      title: country && asin ? `合并板块趋势图：${country}_${asin}` : '合并板块趋势图',
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 'min(1680px, calc(100vw - 32px))',
      destroyOnClose: false,
      bodyStyle: { padding: '16px 20px 20px', maxHeight: 'calc(100vh - 96px)', overflowY: 'auto' },
    },
      !country || !asin
        ? React.createElement('div', { style: { padding: 24, color: '#999' } }, '请先筛选到具体国家和 ASIN。')
        : React.createElement('div', null,
          React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', marginBottom: '12px' } },
            React.createElement('div', { style: { flex: '1 1 100%', minWidth: 0 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 700, color: '#334155' } }, '选择指标字段'),
              React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' } },
                TREND_CHART_FIELD_GROUPS.map((group) => React.createElement('div', { key: `trend_group_${group.key}`, style: { minWidth: 0 } },
                  React.createElement('div', { style: { marginBottom: '4px', color: '#64748b', fontSize: `${FONT_SIZE_XS}px`, fontWeight: 700 } }, group.label),
                  React.createElement(Select, {
                    mode: 'multiple',
                    allowClear: true,
                    showSearch: true,
                    placeholder: `选择${group.label}字段`,
                    value: selectedFieldKeys.filter((key) => fieldMap[key]?.group === group.key),
                    options: fieldOptionsByGroup[group.key] || [],
                    onChange: (values) => updateSelectedFieldsByGroup(group.key, values),
                    optionFilterProp: 'label',
                    maxTagCount: 'responsive',
                    style: { width: '100%' },
                  })
                ))
              )
            ),
            React.createElement('div', { style: { flex: '0 1 180px', minWidth: '150px' } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 700, color: '#334155' } }, '日期选择'),
              React.createElement(Select, {
                value: dateMode,
                options: TREND_CHART_DATE_MODE_OPTIONS,
                onChange: (value) => {
                  setDateModeState({ scopeKey: dateRangeScopeKey, value });
                  if (value !== 'custom') setDateRangeState({ scopeKey: dateRangeScopeKey, value: null });
                },
                style: { width: '100%' },
              })
            ),
            React.createElement('div', { style: { flex: '0 1 320px', minWidth: '260px' } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 700, color: '#334155' } }, '选择日期范围'),
              React.createElement(DatePicker.RangePicker, {
                locale: DATE_PICKER_LOCALE,
                value: pickerDateRange?.[0] && pickerDateRange?.[1]
                  ? [ctx.libs.dayjs(pickerDateRange[0]), ctx.libs.dayjs(pickerDateRange[1])]
                  : null,
                onChange: (dates) => {
                  const value = dates?.[0] && dates?.[1]
                    ? [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]
                    : null;
                  setDateRangeState({ scopeKey: dateRangeScopeKey, value });
                  setDateModeState({ scopeKey: dateRangeScopeKey, value: value ? 'custom' : 'available' });
                },
                placeholder: ['开始日期', '结束日期'],
                allowClear: true,
                style: { width: '100%' },
              })
            ),
            React.createElement('div', { style: { color: '#64748b', fontSize: `${FONT_SIZE_XS}px`, paddingBottom: '6px', whiteSpace: 'nowrap' } }, loading ? '正在加载真实数据...' : `共 ${chartPayload.dates.length} 个有效日期点`)
          ),
          errorText && React.createElement('div', { style: { marginBottom: '12px', padding: '8px 10px', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: '6px', color: '#cf1322' } }, errorText),
          React.createElement(MergedTrendLineChart, { dates: chartPayload.dates, series: chartPayload.series }),
          React.createElement('div', { style: { marginTop: '8px', color: '#64748b', fontSize: `${FONT_SIZE_XS}px` } }, '说明：已有数据日期为最早真实指标日期至今天；0 视为有效数据，空值不会占用横轴日期。')
        )
    );
  };

  // MergedTable 主组件
  // MergedTable 主组件
  // MergedTable 主组件
  const MergedTable = () => {
    const [data, setData]                       = useState([]);
    const [weeklySummaryMap, setWeeklySummaryMap] = useState({});
    const [loading, setLoading]                 = useState(true);
    const [calcLoading, setCalcLoading]         = useState(false);
    const [calcProgress, setCalcProgress]       = useState('');
    const [refreshingData, setRefreshingData]   = useState(false);
    const [refreshProgress, setRefreshProgress] = useState('');
    const [formulaProgress, setFormulaProgress] = useState({ active: false, label: '', percent: 0 });
    const [showPanel, setShowPanel]             = useState(false);
    const [showPush, setShowPush]               = useState(false);
    const [trendChartVisible, setTrendChartVisible] = useState(false);
    const [competitorManagerVisible, setCompetitorManagerVisible] = useState(false);
    const [keywordManagerVisible, setKeywordManagerVisible] = useState(false);
    const [couponManagerVisible, setCouponManagerVisible] = useState(false);
    const [couponConfigRecord, setCouponConfigRecord] = useState(null);
    const [couponRatioDraft, setCouponRatioDraft] = useState(null);
    const [couponManagerLoading, setCouponManagerLoading] = useState(false);
    const [couponManagerSaving, setCouponManagerSaving] = useState(false);
    const [targetManagerVisible, setTargetManagerVisible] = useState(false);
    const [targetManagerLoading, setTargetManagerLoading] = useState(false);
    const [targetManagerSaving, setTargetManagerSaving] = useState(false);
    const [targetDefaultRecord, setTargetDefaultRecord] = useState(null);
    const [targetAdCvrDraft, setTargetAdCvrDraft] = useState(null);
    const [targetCpaDraft, setTargetCpaDraft] = useState(null);
    const [targetIdealCpuDraft, setTargetIdealCpuDraft] = useState(null);
    const [targetProfitMarginDraft, setTargetProfitMarginDraft] = useState(null);
    const [targetAdSpendRateDraft, setTargetAdSpendRateDraft] = useState(null);
    const [managerItems, setManagerItems]       = useState([]);
    const [managerLoading, setManagerLoading]   = useState(false);
    const [managerSaving, setManagerSaving]     = useState(false);
    const [lockedSqpDefaultNames, setLockedSqpDefaultNames] = useState(new Set());
    const [keywordTab, setKeywordTab]           = useState('keyword');
    const [keywordDraft, setKeywordDraft]       = useState('');
    const [competitorDraft, setCompetitorDraft] = useState('');
    const [competitorNoteDraft, setCompetitorNoteDraft] = useState('');
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [columnViews, setColumnViews]         = useState([]);
    const [activeColumnViewId, setActiveColumnViewId] = useState(DEFAULT_COLUMN_VIEW_IDS[0]);
    const [columnViewReady, setColumnViewReady] = useState(false);
    const [columnViewSwitching, setColumnViewSwitching] = useState(false);
    const [columnViewCreating, setColumnViewCreating] = useState(false);
    const [columnViewSaving, setColumnViewSaving] = useState(false);
    const [dynamicKeywordCols, setDynamicKeywordCols] = useState([]);
    const [dynamicCompetitorCols, setDynamicCompetitorCols] = useState([]);
    const [dynamicColumnPrefs, setDynamicColumnPrefs] = useState({});
    const [columnGroupOrder, setColumnGroupOrder] = useState([]);
    const [columnSearchValue, setColumnSearchValue] = useState(undefined);
    const [quickJumpSelectValues, setQuickJumpSelectValues] = useState({ keyword: undefined, competitor: undefined });
    const [colorLegendExpanded, setColorLegendExpanded] = useState(false);
    const [panelColumnSearchText, setPanelColumnSearchText] = useState('');
    const [highlightColumnKey, setHighlightColumnKey] = useState(null);
    const [sortConfig, setSortConfig]           = useState({ key: 'daily_date', dir: 'asc' });
    const [curPage, setCurPage]                 = useState(1);
    const [pageSize, setPageSize]               = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal]                     = useState(0);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [editingCell, setEditingCell]         = useState(null);
    const [editValue, setEditValue]             = useState(null);
    const [richEditOpenSignal, setRichEditOpenSignal] = useState(null);
    const [saving, setSaving]                   = useState(false);
    const [isResizing, setIsResizing]           = useState(false);
    const [selectedRange, setSelectedRange]     = useState(null);
    const [activeCell, setActiveCell]           = useState(null);
    const [selectionInputValue, setSelectionInputValue] = useState('');
    const [crossHighlightEnabled, setCrossHighlightEnabled] = useState(false);
    const [crossHighlightColor, setCrossHighlightColor] = useState(DEFAULT_ACTIVE_CROSS_HIGHLIGHT_COLOR);
    const [showCrossHighlightPanel, setShowCrossHighlightPanel] = useState(false);
    // 日期筛选状态
    const [dateFilterType, setDateFilterType]   = useState('recent_future');
    const [customDateRange, setCustomDateRange] = useState(null);

    const resizeRef   = useRef(null);
    const dragColKey  = useRef(null);
    const inputRef    = useRef(null);
    const rootRef     = useRef(null);
    const tableWrapRef = useRef(null);
    const clipboardRef = useRef(null);
    const dataRef = useRef([]);
    const formulaProgressFinishTimerRef = useRef(null);
    const weeklySummaryPersistQueueRef = useRef({ rowsByKey: {}, cols: INITIAL_COLUMNS, timer: null });
    const weeklySummaryMapRef = useRef({});
    const pendingFormulaAsinCountriesRef = useRef(new Set());
    const backgroundFormulaTimerRef = useRef(null);
    const backgroundMergeSummaryRef = useRef({ timer: null, running: false, pendingForce: false });
    const currentPageMergeSummaryRef = useRef({ timer: null, running: false, pendingKeys: new Set() });
    const selectingRef = useRef(false);
    const selectionDraftRef = useRef(null);
    const selectionStoreRef = useRef(null);
    if (!selectionStoreRef.current) selectionStoreRef.current = createSelectionStore();
    const selectionStore = selectionStoreRef.current;
    const undoStackRef = useRef([]);
    const columnHighlightTimerRef = useRef(null);
    const columnViewSwitchSeqRef = useRef(0);
    const columnLayoutSaveTimerRef = useRef(null);
    const pendingColumnLayoutViewIdRef = useRef(null);
    const columnViewsRef = useRef([]);
    const activeColumnViewIdRef = useRef(DEFAULT_COLUMN_VIEW_IDS[0]);
    const autoRefreshRef = useRef({ lastAt: 0, wasVisible: null });
    const curPageRef = useRef(curPage);
    const pageSizeRef = useRef(pageSize);
    const panelBtnRef = useRef(null);
    const pushBtnRef  = useRef(null);
    const crossHighlightBtnRef = useRef(null);
    const panelPos    = useFloatPos(panelBtnRef, showPanel);
    const pushPos     = useFloatPos(pushBtnRef, showPush);
    const crossHighlightPos = useFloatPos(crossHighlightBtnRef, showCrossHighlightPanel);

    const [urlParams, setUrlParams] = useState(() => loadUrlParams());
    const filterAsin    = urlParams?.asin    || null;
    const filterCountry = urlParams?.country || null;
    const filterModel   = urlParams?.model   || null;
    const filterSaleOwner = urlParams?.saleOwner || urlParams?.sale_owner || null;
    const hasRequiredUrlParams = !!(filterModel && filterCountry && filterAsin && filterSaleOwner);

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
            status:    p['status']     || getFromEngine(SK_STATUS),
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

    const getDefaultCollapsedGroups = useCallback(() => Object.fromEntries(
      SRC_GROUP_CONFIG.map((group) => [group.src, true])
    ), []);

    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: !prev[src] })); }, []);

    const applyColumnPayloadToLocal = useCallback((payload) => {
      const saved = Array.isArray(payload) && payload.length ? payload : null;
      setColumns(saved ? mergeColumnsWithInitial(saved) : normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true }));
      const prefs = {};
      if (Array.isArray(saved)) {
        saved.forEach((item) => {
          if (!isDynamicColumnKey(item?.key)) return;
          const pref = {
            key: item.key,
            hidden: item.hidden === true,
            pinned: item.pinned === true,
            width: Number(item.width) || undefined,
            headerColor: item.headerColor || null,
            bodyColor: getColBodyColor(item),
          };
          if (Object.prototype.hasOwnProperty.call(item, 'richEdit')) pref.richEdit = item.richEdit === true;
          prefs[item.key] = pref;
        });
      }
      setDynamicColumnPrefs(prefs);
      setColumnGroupOrder(getSavedColumnGroupOrder(saved));
      const nextPageSize = getSavedPageSize(saved);
      const pageSizeChanged = nextPageSize !== pageSizeRef.current;
      if (pageSizeChanged) {
        pageSizeRef.current = nextPageSize;
        setPageSize(nextPageSize);
        curPageRef.current = 1;
        setCurPage(1);
      }
      return { pageSize: nextPageSize, pageSizeChanged };
    }, []);

    const setColumnViewsLocal = useCallback((views) => {
      const nextViews = Array.isArray(views) ? views : [];
      columnViewsRef.current = nextViews;
      setColumnViews(nextViews);
    }, []);

    const setActiveColumnViewLocal = useCallback((viewId) => {
      const nextViewId = normalizeColumnViewId(viewId);
      activeColumnViewIdRef.current = nextViewId;
      setActiveColumnViewId(nextViewId);
    }, []);

    useEffect(() => {
      let alive = true;
      (async () => {
        try {
          const state = await loadColumnViewStateFromUser();
          if (!alive) return;
          setColumnViewsLocal(state.views);
          setActiveColumnViewLocal(state.activeViewId);
          applyColumnPayloadToLocal(getColumnViewPayload(state, state.activeViewId));
        } finally {
          if (alive) setColumnViewReady(true);
        }
      })();
      return () => { alive = false; };
    }, [applyColumnPayloadToLocal, setActiveColumnViewLocal, setColumnViewsLocal]);
    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);
    useEffect(() => { curPageRef.current = curPage; }, [curPage]);
    useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);
    useEffect(() => { dataRef.current = data; }, [data]);
    useEffect(() => { weeklySummaryMapRef.current = weeklySummaryMap; }, [weeklySummaryMap]);

    const showFormulaProgress = useCallback((progress) => {
      if (formulaProgressFinishTimerRef.current) {
        window.clearTimeout(formulaProgressFinishTimerRef.current);
        formulaProgressFinishTimerRef.current = null;
      }
      const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
      const percent = typeof progress === 'object' && progress !== null
        ? Math.max(0, Math.min(100, Number(progress.percent) || 0))
        : 0;
      setFormulaProgress({ active: true, label, percent });
    }, []);

    const finishFormulaProgress = useCallback((label = '公式同步完成') => {
      if (formulaProgressFinishTimerRef.current) {
        window.clearTimeout(formulaProgressFinishTimerRef.current);
        formulaProgressFinishTimerRef.current = null;
      }
      setFormulaProgress({ active: true, label, percent: 100 });
      formulaProgressFinishTimerRef.current = window.setTimeout(() => {
        formulaProgressFinishTimerRef.current = null;
        setFormulaProgress({ active: false, label: '', percent: 0 });
      }, 900);
    }, []);

    const resetFormulaProgress = useCallback(() => {
      if (formulaProgressFinishTimerRef.current) {
        window.clearTimeout(formulaProgressFinishTimerRef.current);
        formulaProgressFinishTimerRef.current = null;
      }
      setFormulaProgress({ active: false, label: '', percent: 0 });
    }, []);

    // 计算日期范围
    const getDateRange = useMemo(() => {
      if (dateFilterType === 'all')    return null;
      if (dateFilterType === 'custom') return customDateRange;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const todayStr = fmt(now);
      let range = null;
      switch (dateFilterType) {
        case 'recent_future': { const d = new Date(now); d.setDate(d.getDate() - 6); range = [fmt(d), null]; break; }
        case 'today':      range = [todayStr, todayStr]; break;
        case 'yesterday':  { const d = new Date(now); d.setDate(d.getDate() - 1); range = [fmt(d), fmt(d)]; break; }
        case '7d':         { const d = new Date(now); d.setDate(d.getDate() - 6); range = [fmt(d), todayStr]; break; }
        case '30d':        { const d = new Date(now); d.setDate(d.getDate() - 29); range = [fmt(d), todayStr]; break; }
        case '90d':        { const d = new Date(now); d.setDate(d.getDate() - 89); range = [fmt(d), todayStr]; break; }
        case 'this_month': { const d = new Date(now.getFullYear(), now.getMonth(), 1); range = [fmt(d), todayStr]; break; }
        case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); range = [fmt(s), fmt(e)]; break; }
        default: range = null;
      }
      return range;
    }, [dateFilterType, customDateRange]);

    const pickTotalFromResponse = (res) => {
      const count = res?.data?.meta?.count;
      return Number.isFinite(Number(count)) ? Number(count) : 0;
    };

    const fetchAllList = useCallback(async (url, params = {}, batchSize = 500) => {
      const safePageSize = Math.max(1, Math.min(Number(batchSize) || 500, 500));
      const all = [];
      let page = 1;
      let totalCount = null;
      while (true) {
        const res = await ctx.request({
          url,
          method: 'get',
          params: { ...params, page, pageSize: safePageSize },
        });
        const records = Array.isArray(res?.data?.data) ? res.data.data : [];
        all.push(...records);
        const pickedTotal = pickTotalFromResponse(res);
        if (pickedTotal > 0) totalCount = pickedTotal;
        if (!records.length || records.length < safePageSize || (totalCount != null && all.length >= totalCount)) break;
        page += 1;
      }
      return all;
    }, []);

    const fetchAllByIn = useCallback(async (url, field, values, options = {}) => {
      const uniqueValues = [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
      if (!uniqueValues.length) return [];
      const chunkSize = Math.max(1, Math.min(Number(options.chunkSize) || 80, 100));
      const pageSize = Math.max(1, Math.min(Number(options.pageSize) || 500, 500));
      const extraAnd = Array.isArray(options.extraAnd) ? options.extraAnd : [];
      const extraParams = options.params || {};
      const all = [];
      for (let i = 0; i < uniqueValues.length; i += chunkSize) {
        const chunk = uniqueValues.slice(i, i + chunkSize);
        const filterParts = [{ [field]: { $in: chunk } }, ...extraAnd];
        const filter = filterParts.length === 1 ? filterParts[0] : { $and: filterParts };
        const rows = await fetchAllList(url, {
          ...extraParams,
          filter: JSON.stringify(filter),
        }, pageSize);
        all.push(...rows);
      }
      return all;
    }, [fetchAllList]);

    const buildActivityAnnotationMatchMap = useCallback(async (dailyRows) => {
      const sourceRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      const rowMetaByKey = {};
      const asins = new Set();
      const countries = new Set();
      sourceRows.forEach((row) => {
        const rowKey = row?.country_asin_date;
        const asin = String(row?.asin ?? '').trim();
        const country = String(row?.country ?? '').trim();
        const dateKey = toDateKey(row?.date);
        if (!rowKey || !asin || !country || !dateKey) return;
        rowMetaByKey[rowKey] = { asin, country, dateKey };
        asins.add(asin);
        countries.add(country);
      });
      if (!Object.keys(rowMetaByKey).length || !asins.size) return {};

      const dealRows = await fetchAllByIn('deal_date:list', 'asin', [...asins], {
        extraAnd: [
          countries.size ? { country: { $in: [...countries] } } : null,
          { promotion_type: { $in: ['BD', 'LD'] } },
          { origin_status: { $in: ['已结束', '进行中'] } },
        ].filter(Boolean),
        chunkSize: 80,
        pageSize: 500,
      });

      const dealsByCountryAsin = {};
      [...dealRows]
        .sort((a, b) => {
          const startCompare = toDateKey(a?.promotion_start_time).localeCompare(toDateKey(b?.promotion_start_time));
          if (startCompare) return startCompare;
          return String(a?.id ?? '').localeCompare(String(b?.id ?? ''));
        })
        .forEach((deal) => {
          const promotionType = String(deal?.promotion_type ?? '').trim();
          const originStatus = String(deal?.origin_status ?? '').trim();
          const asin = String(deal?.asin ?? '').trim();
          const country = String(deal?.country ?? '').trim();
          const startDate = toDateKey(deal?.promotion_start_time);
          const endDate = toDateKey(deal?.promotion_end_time);
          if (!['BD', 'LD'].includes(promotionType)) return;
          if (!['已结束', '进行中'].includes(originStatus)) return;
          if (!asin || !country || !startDate || !endDate) return;
          const countryAsin = toCountryAsinKey(country, asin);
          if (!dealsByCountryAsin[countryAsin]) dealsByCountryAsin[countryAsin] = [];
          dealsByCountryAsin[countryAsin].push({ startDate, endDate, promotionType });
        });

      const result = {};
      Object.entries(rowMetaByKey).forEach(([rowKey, meta]) => {
        const deals = dealsByCountryAsin[toCountryAsinKey(meta.country, meta.asin)] || [];
        const matchedDeal = deals.find((deal) => meta.dateKey >= deal.startDate && meta.dateKey <= deal.endDate);
        if (matchedDeal?.promotionType) result[rowKey] = matchedDeal.promotionType;
      });
      return result;
    }, [fetchAllByIn]);

    const buildRsgRefundNumberMap = useCallback(async (dailyRows) => {
      const sourceRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      const asinCountryToDailyKeys = {};
      const dailyRowMeta = {};
      const result = {};
      sourceRows.forEach((row) => {
        const rowKey = row?.country_asin_date;
        const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
        const dateKey = toDateKey(row?.date);
        if (!rowKey || !asinCountry || !dateKey) return;
        result[rowKey] = 0;
        dailyRowMeta[rowKey] = { asinCountry, dateKey };
        if (!asinCountryToDailyKeys[asinCountry]) asinCountryToDailyKeys[asinCountry] = new Set();
        asinCountryToDailyKeys[asinCountry].add(rowKey);
      });
      const asinCountries = Object.keys(asinCountryToDailyKeys);
      if (!asinCountries.length) return result;

      const evaluationRows = await fetchAllByIn('evaluation_requirement:list', 'asin_country', asinCountries, {
        chunkSize: 80,
        pageSize: 500,
      });

      const rsgKeyToDailyKeysByDate = {};
      evaluationRows.forEach((row) => {
        const asinCountry = row?.asin_country;
        const code = String(row?.exclusive_evaluation_code ?? '').trim();
        if (!asinCountry || !code || !asinCountryToDailyKeys[asinCountry]) return;
        if (!rsgKeyToDailyKeysByDate[code]) rsgKeyToDailyKeysByDate[code] = {};
        [...asinCountryToDailyKeys[asinCountry]].forEach((dailyKey) => {
          const dateKey = dailyRowMeta[dailyKey]?.dateKey;
          if (!dateKey) return;
          if (!rsgKeyToDailyKeysByDate[code][dateKey]) rsgKeyToDailyKeysByDate[code][dateKey] = new Set();
          rsgKeyToDailyKeysByDate[code][dateKey].add(dailyKey);
        });
      });
      const rsgKeys = Object.keys(rsgKeyToDailyKeysByDate);
      const neededDates = [...new Set(Object.values(dailyRowMeta).map((meta) => meta.dateKey).filter(Boolean))];
      if (!rsgKeys.length) return result;

      const rsgDailyRows = await fetchAllByIn('rsg_daily:list', 'rsg_id', rsgKeys, {
        extraAnd: neededDates.length ? [{ date: { $in: neededDates } }] : [],
        chunkSize: 80,
        pageSize: 500,
      });
      const rsgDailyIdToDailyKeys = {};
      const rsgDailyIdsForQuery = [];
      rsgDailyRows.forEach((row) => {
        const id = row?.id;
        const rsgKey = String(row?.rsg_id ?? '').trim();
        const dateKey = toDateKey(row?.date);
        const dailyKeys = rsgKeyToDailyKeysByDate[rsgKey]?.[dateKey];
        if (id == null || !rsgKey || !dateKey || !dailyKeys) return;
        rsgDailyIdToDailyKeys[String(id)] = dailyKeys;
        rsgDailyIdsForQuery.push(id);
      });
      const rsgDailyIds = [...new Set(rsgDailyIdsForQuery)];
      if (!rsgDailyIds.length) return result;

      const refundRows = await fetchAllByIn('refund:list', 'rsg_daily_id', rsgDailyIds, {
        chunkSize: 80,
        pageSize: 500,
      });
      const orderNumbers = [...new Set(refundRows.map((row) => String(row?.order_number ?? '').trim()).filter(Boolean))];
      if (!orderNumbers.length) return result;

      const orderRows = await fetchAllByIn('order_list:list', 'order_number', orderNumbers, {
        chunkSize: 80,
        pageSize: 500,
      });
      const validOrderNumbers = new Set();
      orderRows.forEach((row) => {
        const orderNumber = String(row?.order_number ?? '').trim();
        const status = String(row?.status ?? '').trim();
        if (orderNumber && status !== 'Canceled') validOrderNumbers.add(orderNumber);
      });

      refundRows.forEach((row) => {
        const rsgDailyId = String(row?.rsg_daily_id ?? '');
        const orderNumber = String(row?.order_number ?? '').trim();
        if (!orderNumber || !validOrderNumbers.has(orderNumber)) return;
        const dailyKeys = rsgDailyIdToDailyKeys[rsgDailyId];
        if (!dailyKeys) return;
        [...dailyKeys].forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = (result[key] || 0) + 1;
        });
      });
      return result;
    }, [fetchAllByIn]);

    const syncDailyRsgNumbersFromRefunds = useCallback(async (dailyRows, options = {}) => {
      const sourceRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      if (!sourceRows.length) return { rows: [], patchMap: {}, updateCount: 0, failCount: 0 };
      const rsgNumberMap = await buildRsgRefundNumberMap(sourceRows);
      const patchMap = {};
      const updateJobs = [];
      const rows = sourceRows.map((row) => {
        const mapKey = row?.country_asin_date;
        if (!mapKey || !Object.prototype.hasOwnProperty.call(rsgNumberMap, mapKey)) return row;
        const rsgNumber = rsgNumberMap[mapKey];
        if (!isFormulaSameValue(row?.rsg_number, rsgNumber) && row?.country_asin_date) {
          patchMap[row.country_asin_date] = { rsg_number: rsgNumber };
          updateJobs.push({ key: row.country_asin_date, updates: { rsg_number: rsgNumber } });
        }
        return { ...row, rsg_number: rsgNumber };
      });
      if (options.writeBack === false || !updateJobs.length) {
        return { rows, patchMap, updateCount: 0, failCount: 0 };
      }
      let updateCount = 0;
      let failCount = 0;
      for (let i = 0; i < updateJobs.length; i += 100) {
        const batch = updateJobs.slice(i, i + 100);
        const results = await Promise.allSettled(
          batch.map((job) => ctx.request({
            url: 'daily_asins:update',
            method: 'post',
            params: { filterByTk: job.key },
            data: job.updates,
          }))
        );
        updateCount += results.filter((r) => r.status === 'fulfilled').length;
        failCount += results.filter((r) => r.status === 'rejected').length;
      }
      return { rows, patchMap, updateCount, failCount };
    }, [buildRsgRefundNumberMap]);

    const normalizeWeeklySummaryRecord = useCallback((record) => {
      if (!record?.country_asin_week_range) return null;
      const scopedSummaryData = record[WEEKLY_SUMMARY_DATA_FIELD];
      const legacySummaryData = record.summary_data;
      const summaryData = scopedSummaryData && typeof scopedSummaryData === 'object'
        ? scopedSummaryData
        : legacySummaryData && typeof legacySummaryData === 'object'
        ? legacySummaryData
        : {};
      return {
        ...record,
        id: record.country_asin_week_range,
        __rowType: WEEKLY_SUMMARY_ROW_TYPE,
        week_range_label: `${record.week_start_date || ''}~${record.week_end_date || ''}`,
        summary_data: summaryData,
      };
    }, []);

    const syncWeeklySummariesForRows = useCallback(async (rows, cols, options = {}) => {
      const groups = groupRowsByNaturalWeek(rows);
      const summaries = Object.values(groups)
        .map((group) => buildWeeklySummaryFromRows(group.rows, cols))
        .filter(Boolean);
      if (!summaries.length) {
        setWeeklySummaryMap({});
        return {};
      }

      const keys = summaries.map((summary) => summary.country_asin_week_range).filter(Boolean);
      const existingRows = await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', keys, {
        chunkSize: 80,
        pageSize: 500,
      }).catch(() => []);
      const existingMap = {};
      existingRows.forEach((row) => {
        if (row?.country_asin_week_range) existingMap[row.country_asin_week_range] = row;
      });

      await Promise.allSettled(summaries.map((summary) => {
        const payload = {
          country_asin_week_range: summary.country_asin_week_range,
          country: summary.country || null,
          asin: summary.asin || null,
          asin_country: summary.asin_country || null,
          model: summary.model || null,
          sale_owner: summary.sale_owner || null,
          week_start_date: summary.week_start_date || null,
          week_end_date: summary.week_end_date || null,
          week_no: summary.week_no ?? null,
          source_days_count: summary.source_days_count ?? null,
          [WEEKLY_SUMMARY_DATA_FIELD]: summary.summary_data || {},
        };
        WEEKLY_SUMMARY_CORE_FIELDS.forEach((field) => {
          payload[field] = summary[field] ?? null;
        });
        if (existingMap[summary.country_asin_week_range]) {
          return ctx.request({
            url: `${WEEKLY_SUMMARY_COLLECTION}:update`,
            method: 'post',
            params: { filterByTk: summary.country_asin_week_range },
            data: payload,
          });
        }
        return ctx.request({
          url: `${WEEKLY_SUMMARY_COLLECTION}:create`,
          method: 'post',
          data: payload,
        });
      }));

      const refreshedRows = await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', keys, {
        chunkSize: 80,
        pageSize: 500,
      }).catch(() => []);
      const nextMap = {};
      refreshedRows.forEach((row) => {
        const normalized = normalizeWeeklySummaryRecord(row);
        if (normalized) nextMap[normalized.country_asin_week_range] = normalized;
      });
      summaries.forEach((summary) => {
        if (!nextMap[summary.country_asin_week_range]) nextMap[summary.country_asin_week_range] = summary;
      });
      if (options.mergeMap === true) {
        setWeeklySummaryMap((prev) => ({ ...prev, ...nextMap }));
      } else {
        setWeeklySummaryMap(nextMap);
      }
      return nextMap;
    }, [fetchAllByIn, normalizeWeeklySummaryRecord]);

    const getSummaryKeyForRow = useCallback((row) => {
      const range = getWeekRangeForDate(row?.date);
      return range && row?.country && row?.asin
        ? getWeeklySummaryKey({ country: row.country, asin: row.asin, ...range })
        : '';
    }, []);

    const attachWeeklySummaryDataToRows = useCallback((rows, summaryMap) => (
      (Array.isArray(rows) ? rows : []).map((row) => {
        if (!row || row.__rowType === WEEKLY_SUMMARY_ROW_TYPE) return row;
        const summaryKey = getSummaryKeyForRow(row);
        const summaryData = summaryKey ? (summaryMap?.[summaryKey]?.summary_data || {}) : {};
        return { ...row, __weeklySummaryData: summaryData };
      })
    ), [getSummaryKeyForRow]);

    const scheduleWeeklySummaryPersist = useCallback((rows, cols = INITIAL_COLUMNS) => {
      const queue = weeklySummaryPersistQueueRef.current;
      queue.cols = cols;
      (Array.isArray(rows) ? rows : []).forEach((row) => {
        const key = row?.country_asin_date || row?.id || `${row?.country || ''}_${row?.asin || ''}_${toDateKey(row?.date)}`;
        if (key) queue.rowsByKey[key] = row;
      });
      if (queue.timer) window.clearTimeout(queue.timer);
      queue.timer = window.setTimeout(async () => {
        const queuedRows = Object.values(queue.rowsByKey).filter(Boolean);
        const queuedCols = queue.cols || INITIAL_COLUMNS;
        queue.rowsByKey = {};
        queue.timer = null;
        if (!queuedRows.length) return;
        try {
          await syncWeeklySummariesForRows(queuedRows, queuedCols, { mergeMap: true });
        } catch (err) {
          ctx.message.warning(`周汇总落库失败：${err?.message || ''}`);
        }
      }, 800);
    }, [syncWeeklySummariesForRows]);

    useEffect(() => () => {
      const queue = weeklySummaryPersistQueueRef.current;
      if (queue?.timer) window.clearTimeout(queue.timer);
    }, []);

    const refreshWeeklySummariesFromRows = useCallback(async (rows, cols = INITIAL_COLUMNS, options = {}) => {
      const summaryKeys = new Set(Array.isArray(options?.summaryKeys) ? options.summaryKeys.filter(Boolean) : []);
      const sourceRows = (Array.isArray(rows) ? rows : []).filter((row) => {
        if (!row || row.__rowType === WEEKLY_SUMMARY_ROW_TYPE) return false;
        if (!summaryKeys.size) return true;
        const key = getSummaryKeyForRow(row);
        return key && summaryKeys.has(key);
      });
      if (!sourceRows.length) return {};
      return syncWeeklySummariesForRows(sourceRows, cols, { mergeMap: true });
    }, [getSummaryKeyForRow, syncWeeklySummariesForRows]);

    function parseWeeklySummaryKeyParts(summaryKey) {
      const parts = String(summaryKey || '').split('_');
      if (parts.length < 4) return null;
      const end = parts.pop();
      const start = parts.pop();
      const country = parts.shift();
      const asin = parts.join('_');
      if (!country || !asin || !start || !end) return null;
      return { country, asin, start, end };
    }

    async function loadDailyRowsForSummaryKeys(summaryKeys) {
      const groups = {};
      (Array.isArray(summaryKeys) ? summaryKeys : []).forEach((key) => {
        const parts = parseWeeklySummaryKeyParts(key);
        if (!parts) return;
        groups[key] = parts;
      });
      const allRows = [];
      for (const group of Object.values(groups)) {
        const filterAnd = [
          { country: { $eq: group.country } },
          { asin: { $eq: group.asin } },
          { date: { $gte: group.start } },
          { date: { $lte: group.end } },
        ];
        const rows = await fetchAllList('daily_asins:list', {
          sort: 'date',
          filter: JSON.stringify({ $and: filterAnd }),
        }, 500);
        allRows.push(...rows);
      }
      const rowMap = {};
      allRows.forEach((row) => {
        if (row?.country_asin_date) rowMap[row.country_asin_date] = row;
      });
      return Object.values(rowMap);
    }

    async function refreshFullWeeklySummariesForKeys(summaryKeys, options = {}) {
      const keys = [...new Set((Array.isArray(summaryKeys) ? summaryKeys : []).filter(Boolean))];
      if (!keys.length) return {};
      const rows = await loadDailyRowsForSummaryKeys(keys);
      if (!rows.length) return {};
      const { mergedRows, summaryCols } = await mergeDailyRowsForWeeklySummary(rows, {
        updateDynamicColumns: options.updateDynamicColumns === true,
      });
      return refreshWeeklySummariesFromRows(mergedRows, summaryCols, { summaryKeys: keys });
    }

    function scheduleCurrentPageMergeSummaryRefresh(summaryKeys, options = {}) {
      const keys = [...new Set((Array.isArray(summaryKeys) ? summaryKeys : []).filter(Boolean))];
      const state = currentPageMergeSummaryRef.current;
      keys.forEach((key) => state.pendingKeys.add(key));
      if (!keys.length && !state.pendingKeys.size) return;
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(async () => {
        state.timer = null;
        if (state.running) {
          scheduleCurrentPageMergeSummaryRefresh([], { delay: 300 });
          return;
        }
        const keysToRefresh = [...state.pendingKeys];
        state.pendingKeys.clear();
        if (!keysToRefresh.length) return;
        state.running = true;
        try {
          showFormulaProgress({ label: '更新本页汇总...', percent: 18 });
          await refreshFullWeeklySummariesForKeys(keysToRefresh);
          if (options.keepProgressForBackground) {
            showFormulaProgress({ label: '本页已更新，全量排队...', percent: 35 });
          } else {
            finishFormulaProgress('本页汇总已更新');
          }
        } catch (err) {
          resetFormulaProgress();
          ctx.message.warning(`当前页周汇总快刷失败：${err?.message || ''}`);
        } finally {
          state.running = false;
          if (state.pendingKeys.size) scheduleCurrentPageMergeSummaryRefresh([], { delay: 300 });
        }
      }, Number(options.delay) || 120);
    }

    const updateDataAndRefreshWeekly = useCallback((updater, cols = INITIAL_COLUMNS) => {
      const prevRows = Array.isArray(dataRef.current) ? dataRef.current : [];
      const nextRows = typeof updater === 'function' ? updater(prevRows) : updater;
      const safeNextRows = Array.isArray(nextRows) ? nextRows : [];
      const affectedKeys = new Set();
      const maxLen = Math.max(prevRows.length, safeNextRows.length);
      for (let i = 0; i < maxLen; i += 1) {
        if (prevRows[i] === safeNextRows[i]) continue;
        const prevKey = getSummaryKeyForRow(prevRows[i]);
        const nextKey = getSummaryKeyForRow(safeNextRows[i]);
        if (prevKey) affectedKeys.add(prevKey);
        if (nextKey) affectedKeys.add(nextKey);
      }
      dataRef.current = safeNextRows;
      setData(safeNextRows);
      window.setTimeout(() => {
        if (!affectedKeys.size) return;
        refreshFullWeeklySummariesForKeys([...affectedKeys])
          .catch((err) => ctx.message.warning(`周汇总刷新失败：${err?.message || ''}`));
      }, 0);
      return safeNextRows;
    }, [getSummaryKeyForRow, refreshWeeklySummariesFromRows]);

    const updateDataLocalOnly = useCallback((updater) => {
      const prevRows = Array.isArray(dataRef.current) ? dataRef.current : [];
      const nextRows = typeof updater === 'function' ? updater(prevRows) : updater;
      const safeNextRows = Array.isArray(nextRows) ? nextRows : [];
      dataRef.current = safeNextRows;
      setData(safeNextRows);
      return safeNextRows;
    }, []);

    const getDailySort = useCallback(() => 'date', []);

    const mergeDailyRowsForWeeklySummary = useCallback(async (dailyRows, options = {}) => {
      let sourceDailyRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      if (!sourceDailyRows.length) return { mergedRows: [], summaryCols: [...INITIAL_COLUMNS] };
      const rsgSyncResult = await syncDailyRsgNumbersFromRefunds(sourceDailyRows);
      sourceDailyRows = rsgSyncResult.rows.length ? rsgSyncResult.rows : sourceDailyRows;

      const dailyKeys = [...new Set(sourceDailyRows.map((d) => d.country_asin_date).filter(Boolean))];
      const countryAsinKeys = [...new Set(sourceDailyRows.map((d) => toCountryAsinKey(d.country, d.asin)).filter(Boolean))];
      const productConfigAsinCountries = [
        ...new Set(
          sourceDailyRows
            .map((d) => d.asin_country || (d.asin && d.country ? `${d.asin}_${d.country}` : ''))
            .filter(Boolean)
        )
      ];
      const weeklyParams = dailyKeys.length ? { filter: JSON.stringify({ country_asin_week: { $in: dailyKeys } }) } : {};
      const profitParams = dailyKeys.length ? { filter: JSON.stringify({ country_asin_date: { $in: dailyKeys } }) } : {};
      const targetParams = dailyKeys.length ? { filter: JSON.stringify({ country_asin_date: { $in: dailyKeys } }) } : {};
      const countryAsinParams = countryAsinKeys.length ? { filter: JSON.stringify({ country_asin: { $in: countryAsinKeys } }) } : {};
      const targetDefaultParams = countryAsinKeys.length ? { filter: JSON.stringify({ country_asin: { $in: countryAsinKeys } }) } : {};
      const dailyKeyParams = dailyKeys.length ? { filter: JSON.stringify({ country_asin_date: { $in: dailyKeys } }) } : {};
      const productConfigParams = productConfigAsinCountries.length ? { filter: JSON.stringify({ asin_country: { $in: productConfigAsinCountries } }) } : {};
      const optionalFetchAll = (url, params, batchSize) => fetchAllList(url, params, batchSize).catch(() => []);

      const [weeklyRecords, targetRecords, targetDefaultRecords, profitRecords, orderLinkRecords, productConfigRecords, sqpKeywordRecords, sqpKeywordPositionRecords, competitorRecords, competitorDailyRecords] = await Promise.all([
        dailyKeys.length ? fetchAllList('weekly_performance:list', weeklyParams, Math.max(100, dailyKeys.length * 2)) : [],
        dailyKeys.length ? fetchAllList('target_management:list', targetParams, Math.max(100, dailyKeys.length * 2)) : [],
        countryAsinKeys.length ? optionalFetchAll('target_default:list', targetDefaultParams, Math.max(100, countryAsinKeys.length * 2)) : [],
        dailyKeys.length ? fetchAllList('daily_profit:list', profitParams, Math.max(100, dailyKeys.length * 2)) : [],
        dailyKeys.length ? optionalFetchAll('daily_order_link_tracking:list', dailyKeyParams, Math.max(100, dailyKeys.length * 2)) : [],
        productConfigAsinCountries.length ? optionalFetchAll('product_config:list', productConfigParams, Math.max(100, productConfigAsinCountries.length * 2)) : [],
        countryAsinKeys.length ? optionalFetchAll('sqp_keywords:list', { ...countryAsinParams, sort: ['id'] }, Math.max(100, countryAsinKeys.length * 20)) : [],
        dailyKeys.length ? optionalFetchAll('sqp_keyword_daily_positions:list', dailyKeyParams, Math.max(1000, dailyKeys.length * 20)) : [],
        countryAsinKeys.length ? optionalFetchAll('order_link_competitor_asins:list', countryAsinParams, Math.max(100, countryAsinKeys.length * 5)) : [],
        dailyKeys.length ? optionalFetchAll('order_link_competitor_asins_daily:list', dailyKeyParams, Math.max(100, dailyKeys.length * 5)) : [],
      ]);

      const keywordCols = buildDynamicKeywordCols(sqpKeywordRecords);
      const competitorCols = buildDynamicCompetitorCols(competitorRecords);
      if (options.updateDynamicColumns === true) {
        setDynamicKeywordCols(keywordCols);
        setDynamicCompetitorCols(competitorCols);
      }

      const weeklyMap = {};
      weeklyRecords.forEach((w) => { if (w.country_asin_week) weeklyMap[w.country_asin_week] = w; });
      const profitMap = {};
      profitRecords.forEach((p) => { if (p.country_asin_date) profitMap[p.country_asin_date] = p; });
      const orderLinkMap = {};
      orderLinkRecords.forEach((o) => { if (o.country_asin_date) orderLinkMap[o.country_asin_date] = o; });
      const productConfigMap = {};
      productConfigRecords.forEach((p) => { if (p.asin_country) productConfigMap[p.asin_country] = p; });
      const targetMap = {};
      targetRecords.forEach((t) => { if (t.country_asin_date) targetMap[t.country_asin_date] = t; });
      const targetDefaultMap = {};
      targetDefaultRecords.forEach((t) => { if (t.country_asin) targetDefaultMap[t.country_asin] = t; });

      const sqpKeywordsByCountryAsin = {};
      sqpKeywordRecords.forEach((e) => {
        if (!e.country_asin) return;
        if (!sqpKeywordsByCountryAsin[e.country_asin]) sqpKeywordsByCountryAsin[e.country_asin] = [];
        sqpKeywordsByCountryAsin[e.country_asin].push(e);
      });
      const sqpKeywordPositionMap = {};
      sqpKeywordPositionRecords.forEach((e) => {
        const dateStr = toDateKey(e.date);
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
        const rowKey = toCompetitorDailyKey(c.competitor_id, c.country_asin_date);
        if (rowKey) competitorDailyMap[rowKey] = c;
      });

      const mergedRows = sourceDailyRows.map((d) => {
        const key = d.country_asin_date;
        const weeklyData = weeklyMap[key] || {};
        const targetData = targetMap[key] || {};
        const profitData = profitMap[key] || {};
        const orderLinkData = orderLinkMap[key] || {};
        const asinCountry = d.asin_country || (d.asin && d.country ? `${d.asin}_${d.country}` : '');
        const productConfigData = productConfigMap[asinCountry] || {};
        const countryAsin = toCountryAsinKey(d.country, d.asin);
        const targetDefaultData = targetDefaultMap[countryAsin] || {};
        const dateStr = toDateKey(d.date);
        const merged = { ...targetDefaultData, ...weeklyData, ...targetData, ...profitData, ...orderLinkData, ...productConfigData, ...d };
        merged.__src = {
          weekly: weeklyData,
          target: targetData,
          target_default: targetDefaultData,
          profit: profitData,
          order_link: orderLinkData,
          product_config: productConfigData,
          daily: d,
        };
        merged.order_link_real_session_conversion_rate = orderLinkData.real_session_conversion_rate;
        if (countryAsin && dateStr) {
          const rowKeywords = sqpKeywordsByCountryAsin[countryAsin] || [];
          keywordCols.forEach((col) => {
            const kw = rowKeywords.find((item) => item.id === col._kwId);
            if (!kw) return;
            merged[col.field] = { kw, daily: sqpKeywordPositionMap[`${kw.id}_${dateStr}`] || {} };
          });
          const rowCompetitors = competitorsByCountryAsin[countryAsin] || [];
          competitorCols.forEach((col) => {
            const comp = rowCompetitors.find((item) => item.id === col._competitorId);
            if (!comp) return;
            merged[col.field] = {
              competitor: comp,
              daily: competitorDailyMap[toCompetitorDailyKey(comp.id, key)] || {},
            };
          });
        }
        return merged;
      });

      return { mergedRows, summaryCols: [...INITIAL_COLUMNS, ...keywordCols, ...competitorCols] };
    }, [fetchAllList, syncDailyRsgNumbersFromRefunds]);

    const estimateTextWidth = (text, fontSize) => String(text ?? '').length * fontSize * 0.62;
    const calcKeywordColWidth = (label) => Math.max(200, Math.min(360, Math.ceil(estimateTextWidth(label, FONT_SIZE_SM) + 48)));

    const applyDynamicColPrefs = useCallback((col) => {
      const exactPref = dynamicColumnPrefs[col.key] || {};
      const groupPref = col._competitorGroupKey ? (dynamicColumnPrefs[col._competitorGroupKey] || {}) : {};
      const pref = { ...groupPref, ...exactPref };
      const autoWidth = col.key.startsWith('kw_actual_') ? calcKeywordColWidth(col.label) : col.width;
      const activeViewIsCore = isCoreColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      const coreHidden = col._dynamicKind === 'keyword'
        ? Number(col._kwIndex || 0) > 3
        : (col._dynamicKind === 'competitor' ? Number(col._competitorIndex || 0) !== 0 : col.hidden);
      const baseHidden = activeViewIsCore ? coreHidden : col.hidden;
      return {
        ...col,
        hidden: Object.prototype.hasOwnProperty.call(pref, 'hidden') ? pref.hidden === true : baseHidden,
        pinned: Object.prototype.hasOwnProperty.call(col._competitorGroupKey ? groupPref : pref, 'pinned')
          ? (col._competitorGroupKey ? groupPref : pref).pinned === true
          : col.pinned,
        width: col.key.startsWith('kw_actual_')
          ? Math.max(Number(exactPref.width) || 0, autoWidth)
          : (Number(exactPref.width) || autoWidth),
        richEdit: Object.prototype.hasOwnProperty.call(pref, 'richEdit') ? pref.richEdit === true : col.richEdit,
        headerColor: col._dynamicKind === 'competitor'
          ? col.headerColor
          : (Object.prototype.hasOwnProperty.call(pref, 'headerColor') ? pref.headerColor : col.headerColor),
        bodyColor: Object.prototype.hasOwnProperty.call(pref, 'bodyColor') ? (pref.bodyColor || null) : getColBodyColor(col),
      };
    }, [activeColumnViewId, dynamicColumnPrefs]);

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
            columnGroup: 'keyword_position',
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
          const roleIndex = getCompetitorRoleIndex(role);
          const asinLabel = comp.competitor_asin || '未命名';
          const noteLabel = String(comp.notes || '').trim();
          const competitorCountry = comp.country || parseCountryFromCountryAsin(comp.country_asin);
          const groupKey = `competitor_dynamic_${comp.id}`;
          const groupLabel = noteLabel ? `${role}:${asinLabel}（${noteLabel}）` : `${role}:${asinLabel}`;
          COMPETITOR_SUB_FIELDS.forEach((sub) => {
            const isRankField = sub.key === 'rank';
            cols.push({
              key: `${groupKey}_${sub.key}`,
              src: 'competitor',
              field: `${groupKey}_${sub.key}`,
              label: `${groupLabel} ${sub.label}`,
              columnGroup: 'link_tracking',
              hidden: false,
              pinned: false,
              width: sub.width,
              editable: isRankField,
              richEdit: !isRankField,
              headerColor: sub.headerColor,
              _dynamicKind: 'competitor',
              _competitorId: comp.id,
              _competitorIndex: compIdx,
              _competitorRole: role,
              _competitorAsin: comp.competitor_asin || '',
              _competitorNote: noteLabel,
              _competitorCountry: competitorCountry || '',
              _competitorField: sub.key,
              _competitorGroupKey: groupKey,
              _competitorGroupLabel: groupLabel,
              _competitorGroupHeaderColor: COMPETITOR_GROUP_HEADER_COLOR,
              _competitorSubLabel: sub.label,
              _isCompetitorSubColumn: true,
            });
          });
        });
      return cols;
    }, []);

    const canModifyColumnView = useCallback((viewIdArg = null) => {
      const viewId = normalizeColumnViewId(viewIdArg || activeColumnViewIdRef.current || activeColumnViewId);
      return IS_ADMIN || !isDefaultColumnViewId(viewId);
    }, [activeColumnViewId]);

    const warnReadonlyDefaultView = useCallback(() => {
      ctx.message.warning('默认视图不能直接改名或覆盖，请使用复制并保存创建自定义视图');
    }, []);

    const markColumnLayoutChanged = useCallback(() => {
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (isDefaultColumnViewId(viewId)) return;
      pendingColumnLayoutViewIdRef.current = viewId;
    }, [activeColumnViewId]);

    const saveColsToCurrentViewFast = useCallback(async (cols, viewIdArg = null) => {
      if (!currentUserId) return false;
      const viewId = normalizeColumnViewId(viewIdArg || activeColumnViewIdRef.current || activeColumnViewId);
      if (!canModifyColumnView(viewId)) {
        throw new Error('完整列和核心列仅管理员可修改');
      }
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const staticKeys = new Set(INITIAL_COLUMNS.map((c) => c.key));
      const currentView = views.find((view) => view.id === viewId);
      const existingSaved = Array.isArray(currentView?.payload) ? currentView.payload : [];
      const incomingKeys = new Set((Array.isArray(cols) ? cols : []).map((c) => c.key).filter(Boolean));
      const preserved = existingSaved.filter((c) => c?.key && !incomingKeys.has(c.key) && (isDynamicColumnKey(c.key) || staticKeys.has(c.key) || isColumnSettingMetaKey(c.key)));
      const colPayload = buildColumnPayload(Array.isArray(cols) ? cols : [], preserved);
      const nextViews = views.map((view) => view.id === viewId ? { ...view, payload: colPayload, updated_at: new Date().toISOString() } : view);
      setColumnViewsLocal(nextViews);
      const saved = await saveColumnViewStateToUser({ activeViewId: viewId, views: nextViews }, viewId);
      if (!saved) throw new Error('用户配置未保存');
      return true;
    }, [activeColumnViewId, canModifyColumnView, columnViews, setColumnViewsLocal]);

    const updateAndSave = useCallback((updater) => {
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return next;
      });
    }, []);

    const updateColumnsLocalOnly = useCallback((updater) => {
      setColumns((prev) => (typeof updater === 'function' ? updater(prev) : updater));
    }, []);

    const recalcAllCoreFormulas = useCallback(async (sourceRows = [], optionsArg = false) => {
      const options = typeof optionsArg === 'object' && optionsArg !== null ? optionsArg : { silent: optionsArg === true };
      const silent = options.silent === true;
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      const preloadedDailyRows = Array.isArray(options.preloadedDailyRows) ? options.preloadedDailyRows.filter(Boolean) : [];
      const rows = Array.isArray(sourceRows) ? sourceRows : [];
      const keys = [...new Set(rows.map((r) => r.country_asin_date || r.id).filter(Boolean))];
      if (!keys.length) {
        if (!silent) ctx.message.warning('当前没有可计算的数据');
        return { total: 0, success: 0, skipped: 0 };
      }

        const asinCountries = [
          ...new Set(
            rows
              .map((r) => r.asin_country || (r.asin && r.country ? `${r.asin}_${r.country}` : ''))
              .filter(Boolean)
          )
        ];
        const countryAsinKeys = [
          ...new Set(
            rows
              .map((r) => toCountryAsinKey(r.country, r.asin))
              .filter(Boolean)
          )
        ];

      if (!asinCountries.length) {
        if (!silent) ctx.message.warning('当前数据缺少 ASIN/国家信息，无法计算公式');
        return { total: 0, success: 0, skipped: keys.length };
      }

      if (!silent) {
        setCalcLoading(true);
        setCalcProgress('准备计算...');
      }
      const reportProgress = (label, percent) => {
        const safePercent = Math.max(0, Math.min(100, Number(percent) || 0));
        if (!silent) setCalcProgress(label);
        onProgress?.({ label, percent: safePercent });
      };
      reportProgress('准备计算...', 5);

      try {
        const allDailyRows = preloadedDailyRows.length
          ? [...preloadedDailyRows].sort((a, b) => toDateKey(a?.date).localeCompare(toDateKey(b?.date)))
          : null;
        if (allDailyRows) {
          reportProgress(allDailyRows.length <= rows.length ? '已复用本次改动行...' : '已复用当前 ASIN / 国家全部日期...', 12);
        } else {
          reportProgress('正在读取当前 ASIN / 国家全部日期...', 12);
        }
        let dailyRowsForFormula = allDailyRows || await fetchAllByIn('daily_asins:list', 'asin_country', asinCountries, {
          params: { sort: 'date' },
          chunkSize: 50,
          pageSize: 500,
        });
        const rsgSyncResult = await syncDailyRsgNumbersFromRefunds(dailyRowsForFormula, { writeBack: false });
        dailyRowsForFormula = rsgSyncResult.rows.length ? rsgSyncResult.rows : dailyRowsForFormula;
        const originalActivityAnnotationMap = {};
        dailyRowsForFormula.forEach((row) => {
          if (row?.country_asin_date) originalActivityAnnotationMap[row.country_asin_date] = row.activity_annotation;
        });
        let activityAnnotationMatchMap = {};
        try {
          activityAnnotationMatchMap = await buildActivityAnnotationMatchMap(dailyRowsForFormula);
          if (Object.keys(activityAnnotationMatchMap).length) {
            dailyRowsForFormula = dailyRowsForFormula.map((row) => {
              const key = row?.country_asin_date;
              if (!key || !Object.prototype.hasOwnProperty.call(activityAnnotationMatchMap, key)) return row;
              return { ...row, activity_annotation: activityAnnotationMatchMap[key] };
            });
          }
        } catch (err) {
          if (!silent) ctx.message.warning(`活动标注匹配失败，已跳过：${err?.message || ''}`);
        }
        reportProgress(allDailyRows && allDailyRows.length <= rows.length ? '正在读取当前行关联数据...' : '正在读取试算与关联数据...', 22);
        const pricingScenarioRows = await fetchAllByIn('pricing_scenarios:list', 'asin_country', asinCountries, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const pricingScenarioMap = buildPricingScenarioLookupMap(pricingScenarioRows);
        const allDailyKeys = [...new Set(dailyRowsForFormula.map((row) => row?.country_asin_date).filter(Boolean))];
        const existingProfitRows = await fetchAllByIn('daily_profit:list', 'country_asin_date', allDailyKeys.length ? allDailyKeys : keys, {
          chunkSize: 80,
          pageSize: 500,
        });
        const existingOrderLinkRows = await fetchAllByIn('daily_order_link_tracking:list', 'country_asin_date', keys, {
          chunkSize: 80,
          pageSize: 500,
        });
        const existingTargetRows = await fetchAllByIn('target_management:list', 'country_asin_date', keys, {
          chunkSize: 80,
          pageSize: 500,
        });
        const weeklyKeyCandidates = [...new Set(keys)];
        const existingWeeklyRows = await fetchAllByIn('weekly_performance:list', 'country_asin_week', weeklyKeyCandidates, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const productConfigRows = await fetchAllByIn('product_config:list', 'asin_country', asinCountries, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const targetDefaultRows = await fetchAllByIn('target_default:list', 'country_asin', countryAsinKeys, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        reportProgress(`正在计算 ${keys.length} 条公式...`, 42);
        const existingProfitMap = {};
        existingProfitRows.forEach((row) => {
          if (row?.country_asin_date) existingProfitMap[row.country_asin_date] = row;
        });
        const existingOrderLinkMap = {};
        existingOrderLinkRows.forEach((row) => {
          if (row?.country_asin_date) existingOrderLinkMap[row.country_asin_date] = row;
        });
        const existingTargetMap = {};
        existingTargetRows.forEach((row) => {
          if (row?.country_asin_date) existingTargetMap[row.country_asin_date] = row;
        });
        const existingWeeklyMap = {};
        existingWeeklyRows.forEach((row) => {
          if (row?.country_asin_week) existingWeeklyMap[row.country_asin_week] = row;
        });
        const formulaWeekGroups = groupRowsByNaturalWeek(dailyRowsForFormula);
        const weeklyCompletionRateBySummaryKey = {};
        const weeklyTargetQtyBySummaryKey = {};
        Object.entries(formulaWeekGroups).forEach(([summaryKey, group]) => {
          let orderTotal = 0;
          let hasOrder = false;
          let targetTotal = 0;
          let hasTarget = false;
          (group.rows || []).forEach((item) => {
            const itemKey = item?.country_asin_date || item?.id;
            const itemWeekly = item?.__src?.weekly || {};
            const itemOrder = toFormulaNumber(itemWeekly.sales ?? existingWeeklyMap[itemKey]?.sales ?? item?.sales);
            const itemTarget = toFormulaNumber(existingTargetMap[itemKey]?.target_order_qty ?? item?.__src?.target?.target_order_qty ?? item?.target_order_qty);
            if (itemOrder != null) {
              orderTotal += itemOrder;
              hasOrder = true;
            }
            if (itemTarget != null) {
              targetTotal += itemTarget;
              hasTarget = true;
            }
          });
          weeklyTargetQtyBySummaryKey[summaryKey] = hasTarget ? targetTotal : null;
          weeklyCompletionRateBySummaryKey[summaryKey] = hasOrder && hasTarget && targetTotal !== 0
            ? roundRate(orderTotal / targetTotal, 4)
            : null;
        });
        const productConfigMap = {};
        productConfigRows.forEach((row) => {
          if (row?.asin_country) productConfigMap[row.asin_country] = row;
        });
        const targetDefaultMap = {};
        targetDefaultRows.forEach((row) => {
          if (row?.country_asin) targetDefaultMap[row.country_asin] = row;
        });
        const lpDurationMap = buildLpDurationMap(dailyRowsForFormula);
        const promoDays40dMap = buildPromoDaysWindowMap(dailyRowsForFormula, 40);
        const promoDays90dMap = buildPromoDaysWindowMap(dailyRowsForFormula, 90);
        const allDailyMap = {};
        dailyRowsForFormula.forEach((row) => {
          if (row.country_asin_date) allDailyMap[row.country_asin_date] = row;
        });
        const sourceRowsByKey = {};
        rows.forEach((row) => {
          const key = row?.country_asin_date || row?.id;
          if (key) sourceRowsByKey[key] = row;
        });
        const keySet = new Set(keys);
        const dailyRowsByAsinCountry = {};
        const dailyRowsByAsinCountryDate = {};
        dailyRowsForFormula.forEach((row) => {
          const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
          const dateKey = toDateKey(row?.date);
          if (!asinCountry || !dateKey) return;
          if (!dailyRowsByAsinCountry[asinCountry]) dailyRowsByAsinCountry[asinCountry] = [];
          dailyRowsByAsinCountry[asinCountry].push(row);
          if (!dailyRowsByAsinCountryDate[asinCountry]) dailyRowsByAsinCountryDate[asinCountry] = {};
          dailyRowsByAsinCountryDate[asinCountry][dateKey] = row;
        });

        const updateJobs = [];
        const profitJobsByKey = {};
        const queueProfitUpdate = (key, baseData, fieldUpdates, exists = false) => {
          const recordExists = exists || Boolean(existingProfitMap[key]);
          if (!profitJobsByKey[key]) profitJobsByKey[key] = { key, exists: recordExists, updates: { ...baseData } };
          profitJobsByKey[key].exists = profitJobsByKey[key].exists || recordExists;
          profitJobsByKey[key].updates = { ...profitJobsByKey[key].updates, ...fieldUpdates };
        };
        const orderLinkJobsByKey = {};
        const queueOrderLinkUpdate = (key, baseData, fieldUpdates, exists = false) => {
          const recordExists = exists || Boolean(existingOrderLinkMap[key]);
          if (!orderLinkJobsByKey[key]) orderLinkJobsByKey[key] = { key, exists: recordExists, updates: { ...baseData } };
          orderLinkJobsByKey[key].exists = orderLinkJobsByKey[key].exists || recordExists;
          orderLinkJobsByKey[key].updates = { ...orderLinkJobsByKey[key].updates, ...fieldUpdates };
        };
        const targetFormulaJobsByKey = {};
        const queueTargetFormulaUpdate = (key, baseData, fieldUpdates, exists = false) => {
          const recordExists = exists || Boolean(existingTargetMap[key]);
          if (!targetFormulaJobsByKey[key]) targetFormulaJobsByKey[key] = { key, exists: recordExists, updates: { ...baseData } };
          targetFormulaJobsByKey[key].exists = targetFormulaJobsByKey[key].exists || recordExists;
          targetFormulaJobsByKey[key].updates = { ...targetFormulaJobsByKey[key].updates, ...fieldUpdates };
        };
        const weeklyJobsByKey = {};
        const queueWeeklyUpdate = (key, fieldUpdates) => {
          if (!existingWeeklyMap[key]) return;
          if (!weeklyJobsByKey[key]) weeklyJobsByKey[key] = { key, updates: {} };
          weeklyJobsByKey[key].updates = { ...weeklyJobsByKey[key].updates, ...fieldUpdates };
        };
        const patchMap = {};
        const computedNetProfitMap = {};
        const baseProfitUpdateMap = {};
        keys.forEach((key) => {
          const source = allDailyMap[key] || sourceRowsByKey[key];
          if (!source) return;
          const asinCountry = source?.asin_country || (source?.asin && source?.country ? `${source.asin}_${source.country}` : '');
          const countryAsin = toCountryAsinKey(source?.country, source?.asin);
          const summaryKey = getSummaryKeyForRow(source);
          const matchedGrossProfit = getPricingScenarioGrossProfit(
            pricingScenarioMap,
            asinCountry,
            source?.price_after_discount,
            'normal'
          );
          const orderLinkRow = existingOrderLinkMap[key] || sourceRowsByKey[key] || {};
          const reviewDiscountedPrice = orderLinkRow?.review_discounted_price ?? source?.review_discounted_price;
          const normalNetPrice = getPricingScenarioNetPrice(
            pricingScenarioMap,
            asinCountry,
            source?.price_after_discount,
            'normal'
          );
          const monthlyCogs = getPricingScenarioMonthlyCogs(
            pricingScenarioMap,
            asinCountry,
            source?.price_after_discount,
            'normal'
          );
          const reviewNetPrice = getPricingScenarioNetPrice(
            pricingScenarioMap,
            asinCountry,
            reviewDiscountedPrice,
            'review'
          );
          const matchedReviewReturnAmount = getPricingScenarioReviewReturnAmount(
            pricingScenarioMap,
            asinCountry,
            reviewDiscountedPrice,
            'review'
          );
          const reviewUnitProfit = getPricingScenarioGrossProfit(
            pricingScenarioMap,
            asinCountry,
            reviewDiscountedPrice,
            'review'
          );
          const roundedMatchedGrossProfit = roundMoney(matchedGrossProfit);
          const roundedReviewUnitProfit = roundMoney(reviewUnitProfit);
          const reviewRefundPerUnit = toNegativeMoney(matchedReviewReturnAmount);
          const rsgNumber = toFormulaNumber(source?.rsg_number);
          const reviewRefundCost = reviewRefundPerUnit == null || rsgNumber == null
            ? null
            : roundMoney(reviewRefundPerUnit * rsgNumber);
          const reviewRefundTotal = roundedReviewUnitProfit == null || rsgNumber == null
            ? null
            : roundMoney(roundedReviewUnitProfit * rsgNumber);
          const sourceWeekly = source?.__src?.weekly || {};
          const orderItems = toFormulaNumber(sourceWeekly.sales ?? existingWeeklyMap[key]?.sales ?? source?.sales);
          const hasReviewOrders = (rsgNumber || 0) > 0;
          const grossRevenueLocal = orderItems == null || normalNetPrice == null || (hasReviewOrders && reviewNetPrice == null)
            ? null
            : roundMoney((orderItems - (rsgNumber || 0)) * normalNetPrice + (rsgNumber || 0) * (reviewNetPrice || 0));
          const refundRateNew = toFormulaNumber(productConfigMap[asinCountry]?.refund_rate_new);
          const netRevenueLocal = grossRevenueLocal == null || orderItems == null || normalNetPrice == null || refundRateNew == null
            ? null
            : roundMoney(grossRevenueLocal - (orderItems - (rsgNumber || 0)) * normalNetPrice * 0.93 * refundRateNew);
          const productCostTotal = monthlyCogs == null || orderItems == null
            ? null
            : roundMoney(monthlyCogs * orderItems);
          const targetOrderQty = toFormulaNumber(existingTargetMap[key]?.target_order_qty ?? source?.__src?.target?.target_order_qty ?? source?.target_order_qty);
          const targetGap = orderItems == null || targetOrderQty == null
            ? null
            : roundMoney(orderItems - targetOrderQty);
          const idealCpuByMargin = toFormulaNumber(
            targetDefaultMap[countryAsin]?.ideal_cpu_by_margin
            ?? source?.__src?.target_default?.ideal_cpu_by_margin
            ?? source?.ideal_cpu_by_margin
          );
          const adOrders = toFormulaNumber(sourceWeekly.guanggaodan ?? existingWeeklyMap[key]?.guanggaodan ?? source?.guanggaodan);
          const adClicks = toFormulaNumber(sourceWeekly.guanggaodianji ?? existingWeeklyMap[key]?.guanggaodianji ?? source?.guanggaodianji);
          const sessions = toFormulaNumber(sourceWeekly.zongliuliang ?? existingWeeklyMap[key]?.zongliuliang ?? source?.zongliuliang);
          const pageViewsTotal = toFormulaNumber(sourceWeekly.page_views_total ?? existingWeeklyMap[key]?.page_views_total ?? source?.page_views_total);
          const sourceDateKey = toDateKey(source?.date);
          const prevDailyRow = sourceDateKey && asinCountry
            ? dailyRowsByAsinCountryDate[asinCountry]?.[getPreviousDateKey(sourceDateKey)]
            : null;
          const currentReviewCount = toFormulaNumber(source?.number_of_comments);
          const previousReviewCount = toFormulaNumber(prevDailyRow?.number_of_comments);
          const formulaReviewRate = currentReviewCount == null || previousReviewCount == null || orderItems == null || orderItems === 0
            ? null
            : roundRate((currentReviewCount - previousReviewCount) / orderItems, 4);
          const totalOnsiteOrders = orderItems == null || rsgNumber == null ? null : roundMoney(orderItems - rsgNumber);
          const onsiteAdOrders = adOrders == null ? null : roundMoney(adOrders);
          const onsiteOrganicOrders = totalOnsiteOrders == null || adOrders == null ? null : roundMoney(totalOnsiteOrders - adOrders);
          const reviewOrdersRatio = rsgNumber == null || orderItems == null || orderItems === 0 ? null : roundRate(rsgNumber / orderItems, 4);
          const onsiteOrdersRatio = totalOnsiteOrders == null || orderItems == null || orderItems === 0 ? null : roundRate(totalOnsiteOrders / orderItems, 4);
          const onsiteOrganicOrdersRatio = onsiteOrganicOrders == null || orderItems == null || orderItems === 0 ? null : roundRate(onsiteOrganicOrders / orderItems, 4);
          const onsiteAdOrdersRatio = onsiteAdOrders == null || orderItems == null || orderItems === 0 ? null : roundRate(onsiteAdOrders / orderItems, 4);
          const sessionConversionRate = orderItems == null || sessions == null || sessions === 0 ? null : roundRate(orderItems / sessions, 4);
          const realSessionConversionRate = totalOnsiteOrders == null || sessions == null || sessions === 0 ? null : roundRate(totalOnsiteOrders / sessions, 4);
          const pageViewConversionRate = orderItems == null || pageViewsTotal == null || pageViewsTotal === 0 ? null : roundRate(orderItems / pageViewsTotal, 4);
          const currentSessionConversionRate = Object.prototype.hasOwnProperty.call(existingWeeklyMap[key] || {}, 'session_conversion_rate')
            ? existingWeeklyMap[key].session_conversion_rate
            : (sourceWeekly.session_conversion_rate ?? source?.session_conversion_rate);
          if (!isFormulaSameValue(currentSessionConversionRate, sessionConversionRate)) {
            patchMap[key] = { ...(patchMap[key] || {}), session_conversion_rate: sessionConversionRate };
            queueWeeklyUpdate(key, { session_conversion_rate: sessionConversionRate });
          }
          const currentOrderLinkRow = existingOrderLinkMap[key] || sourceRowsByKey[key] || {};
          const baseOrderLinkUpdate = {
            country_asin_date: key,
            asin_country: asinCountry || null,
            asin: source?.asin || null,
            country: source?.country || null,
            date: toDateKey(source?.date) || null,
          };
          const orderLinkFormulaUpdates = {
            net_price_without_tax: roundMoney(normalNetPrice),
            review_actual_price: roundMoney(reviewNetPrice),
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
          };
          Object.entries(orderLinkFormulaUpdates).forEach(([field, value]) => {
            if (isFormulaSameValue(currentOrderLinkRow[field], value)) return;
            patchMap[key] = { ...(patchMap[key] || {}), [field]: value };
            if (field === 'real_session_conversion_rate') {
              patchMap[key].order_link_real_session_conversion_rate = value;
            }
            queueOrderLinkUpdate(key, baseOrderLinkUpdate, { [field]: value });
          });
          const hasMatchedActivityAnnotation = Object.prototype.hasOwnProperty.call(activityAnnotationMatchMap, key);
          const matchedActivityAnnotation = hasMatchedActivityAnnotation ? activityAnnotationMatchMap[key] : null;
          const activityAnnotationUpdate = hasMatchedActivityAnnotation && !isFormulaSameValue(originalActivityAnnotationMap[key], matchedActivityAnnotation)
            ? { activity_annotation: matchedActivityAnnotation }
            : {};
          const updates = {
            ...activityAnnotationUpdate,
            rsg_number: rsgNumber,
            off: buildDailyOffValue(source),
            promo_day: hasPromoActivity(source) ? 1 : 0,
            lp_duration_days: lpDurationMap[key] ?? null,
            promo_days_40d: promoDays40dMap[key] ?? null,
            promo_days_90d: promoDays90dMap[key] ?? null,
            target_gap: targetGap,
          };
          const sameActivityAnnotation = !Object.keys(activityAnnotationUpdate).length;
          const sameRsgNumber = !rsgSyncResult.patchMap[key];
          const sameOff = isFormulaSameValue(source.off, updates.off);
          const samePromoDay = isFormulaSameValue(source.promo_day, updates.promo_day);
          const sameLpDuration = isFormulaSameValue(source.lp_duration_days, updates.lp_duration_days);
          const samePromoDays40d = isFormulaSameValue(source.promo_days_40d, updates.promo_days_40d);
          const samePromoDays90d = isFormulaSameValue(source.promo_days_90d, updates.promo_days_90d);
          const sameTargetGap = isFormulaSameValue(source.target_gap, updates.target_gap);
          if (!(sameActivityAnnotation && sameRsgNumber && sameOff && samePromoDay && sameLpDuration && samePromoDays40d && samePromoDays90d && sameTargetGap)) {
            patchMap[key] = { ...(patchMap[key] || {}), ...updates };
            updateJobs.push({ key, updates });
          }

          const currentProfitRow = { ...(sourceRowsByKey[key] || {}), ...(existingProfitMap[key] || {}) };
          const baseProfitUpdate = {
            country_asin_date: key,
            asin_country: asinCountry || null,
            asin: source?.asin || null,
            country: source?.country || null,
            date: toDateKey(source?.date) || null,
          };
          baseProfitUpdateMap[key] = baseProfitUpdate;
          const adSpend = toFormulaNumber(sourceWeekly.guanggaohuafei ?? existingWeeklyMap[key]?.guanggaohuafei ?? source?.guanggaohuafei);
          const priceAfterDiscount = toFormulaNumber(source?.price_after_discount);
          const couponCommissionRate = toFormulaNumber(productConfigMap[asinCountry]?.coupon_commission_rate);
          const couponOrderRatioEstimated = toFormulaNumber(productConfigMap[asinCountry]?.coupon_order_ratio_estimated);
          const couponTotalCost = priceAfterDiscount == null || couponCommissionRate == null || orderItems == null || couponOrderRatioEstimated == null
            ? null
            : roundMoney(priceAfterDiscount * couponCommissionRate * (orderItems - (rsgNumber || 0)) * couponOrderRatioEstimated);
          const flashSaleQty = toFormulaNumber(currentProfitRow.flash_sale_qty);
          const flashSalePrice = toFormulaNumber(currentProfitRow.flash_sale_price);
          const flashSaleDays = toFormulaNumber(currentProfitRow.flash_sale_days);
          const lightningCommissionRate = toFormulaNumber(productConfigMap[asinCountry]?.lightning_commission_rate);
          const lightningFeeCap = toFormulaNumber(productConfigMap[asinCountry]?.lightning_fee_cap);
          const lightningFixedFee = toFormulaNumber(productConfigMap[asinCountry]?.lightning_fixed_fee);
          const flashSaleVariableCost = flashSaleQty == null || flashSalePrice == null || lightningCommissionRate == null || lightningFeeCap == null
            ? null
            : Math.min(flashSaleQty * flashSalePrice * lightningCommissionRate, lightningFeeCap);
          const flashSaleFixedCost = lightningFixedFee == null || flashSaleDays == null
            ? null
            : lightningFixedFee * flashSaleDays;
          const flashSaleTotalCost = flashSaleVariableCost == null || flashSaleFixedCost == null
            ? null
            : roundMoney(flashSaleVariableCost + flashSaleFixedCost);
          const flashSaleCostPerOrder = flashSaleTotalCost == null || flashSaleQty == null || flashSaleQty === 0
            ? null
            : roundMoney(flashSaleTotalCost / flashSaleQty);
          const netProfitLocal = roundMoney(
            (roundedMatchedGrossProfit || 0) * ((orderItems || 0) - (rsgNumber || 0))
            + (reviewRefundCost || 0)
            - (adSpend || 0)
            + (reviewRefundTotal || 0)
            - (couponTotalCost || 0)
            - (flashSaleTotalCost || 0)
          );
          computedNetProfitMap[key] = netProfitLocal;
          const sameNetProfitLocal = isFormulaSameValue(currentProfitRow.net_profit_local, netProfitLocal);
          if (!sameNetProfitLocal) {
            patchMap[key] = { ...(patchMap[key] || {}), net_profit_local: netProfitLocal };
            queueProfitUpdate(key, baseProfitUpdate, { net_profit_local: netProfitLocal });
          }
          const sameGrossRevenueLocal = isFormulaSameValue(currentProfitRow.gross_revenue_local, grossRevenueLocal);
          if (!sameGrossRevenueLocal) {
            patchMap[key] = { ...(patchMap[key] || {}), gross_revenue_local: grossRevenueLocal };
            queueProfitUpdate(key, baseProfitUpdate, { gross_revenue_local: grossRevenueLocal });
          }
          const tacos = adSpend == null || grossRevenueLocal == null || grossRevenueLocal === 0
            ? null
            : roundRate(adSpend / grossRevenueLocal, 4);
          const sameTacos = isFormulaSameValue(currentProfitRow.tacos, tacos);
          if (!sameTacos) {
            patchMap[key] = { ...(patchMap[key] || {}), tacos };
            queueProfitUpdate(key, baseProfitUpdate, { tacos });
          }
          const sameNetRevenueLocal = isFormulaSameValue(currentProfitRow.net_revenue_local, netRevenueLocal);
          if (!sameNetRevenueLocal) {
            patchMap[key] = { ...(patchMap[key] || {}), net_revenue_local: netRevenueLocal };
            queueProfitUpdate(key, baseProfitUpdate, { net_revenue_local: netRevenueLocal });
          }
          const sameCouponTotalCost = isFormulaSameValue(currentProfitRow.coupon_total_cost, couponTotalCost);
          if (!sameCouponTotalCost) {
            patchMap[key] = { ...(patchMap[key] || {}), coupon_total_cost: couponTotalCost };
            queueProfitUpdate(key, baseProfitUpdate, { coupon_total_cost: couponTotalCost });
          }
          const sameFlashSaleTotalCost = isFormulaSameValue(currentProfitRow.flash_sale_total_cost, flashSaleTotalCost);
          if (!sameFlashSaleTotalCost) {
            patchMap[key] = { ...(patchMap[key] || {}), flash_sale_total_cost: flashSaleTotalCost };
            queueProfitUpdate(key, baseProfitUpdate, { flash_sale_total_cost: flashSaleTotalCost });
          }
          const sameFlashSaleCostPerOrder = isFormulaSameValue(currentProfitRow.flash_sale_cost_per_order, flashSaleCostPerOrder);
          if (!sameFlashSaleCostPerOrder) {
            patchMap[key] = { ...(patchMap[key] || {}), flash_sale_cost_per_order: flashSaleCostPerOrder };
            queueProfitUpdate(key, baseProfitUpdate, { flash_sale_cost_per_order: flashSaleCostPerOrder });
          }
          const profitMargin = netProfitLocal == null || netRevenueLocal == null || netRevenueLocal === 0
            ? null
            : roundRate(netProfitLocal / netRevenueLocal, 4);
          const sameProfitMargin = isFormulaSameValue(currentProfitRow.profit_margin, profitMargin);
          if (!sameProfitMargin) {
            patchMap[key] = { ...(patchMap[key] || {}), profit_margin: profitMargin };
            queueProfitUpdate(key, baseProfitUpdate, { profit_margin: profitMargin });
          }
          const unitProfitAfterAdLocal = netProfitLocal == null || orderItems == null || orderItems === 0
            ? null
            : roundMoney(netProfitLocal / orderItems);
          const sameUnitProfitAfterAdLocal = isFormulaSameValue(currentProfitRow.unit_profit_after_ad_local, unitProfitAfterAdLocal);
          if (!sameUnitProfitAfterAdLocal) {
            patchMap[key] = { ...(patchMap[key] || {}), unit_profit_after_ad_local: unitProfitAfterAdLocal };
            queueProfitUpdate(key, baseProfitUpdate, { unit_profit_after_ad_local: unitProfitAfterAdLocal });
          }
          const exchangeRate = toFormulaNumber(productConfigMap[asinCountry]?.exchange_rate);
          const unitProfitRmb = unitProfitAfterAdLocal == null || exchangeRate == null
            ? null
            : roundMoney(unitProfitAfterAdLocal * exchangeRate);
          const sameUnitProfitRmb = isFormulaSameValue(currentProfitRow.unit_profit_rmb, unitProfitRmb);
          if (!sameUnitProfitRmb) {
            patchMap[key] = { ...(patchMap[key] || {}), unit_profit_rmb: unitProfitRmb };
            queueProfitUpdate(key, baseProfitUpdate, { unit_profit_rmb: unitProfitRmb });
          }
          const adCostRatio = adSpend == null || grossRevenueLocal == null || grossRevenueLocal === 0
            ? null
            : roundRate(adSpend / grossRevenueLocal, 4);
          const sameAdCostRatio = isFormulaSameValue(currentProfitRow.ad_cost_ratio, adCostRatio);
          if (!sameAdCostRatio) {
            patchMap[key] = { ...(patchMap[key] || {}), ad_cost_ratio: adCostRatio };
            queueProfitUpdate(key, baseProfitUpdate, { ad_cost_ratio: adCostRatio });
          }
          const sameUnitProfitLocal = isFormulaSameValue(currentProfitRow.unit_profit_local, roundedMatchedGrossProfit);
          if (!sameUnitProfitLocal) {
            patchMap[key] = { ...(patchMap[key] || {}), unit_profit_local: roundedMatchedGrossProfit };
            queueProfitUpdate(key, baseProfitUpdate, { unit_profit_local: roundedMatchedGrossProfit });
          }
          const sameProductCostTotal = isFormulaSameValue(currentProfitRow.product_cost_total, productCostTotal);
          if (!sameProductCostTotal) {
            patchMap[key] = { ...(patchMap[key] || {}), product_cost_total: productCostTotal };
            queueProfitUpdate(key, baseProfitUpdate, { product_cost_total: productCostTotal });
          }
          const productCostRatio = productCostTotal == null || grossRevenueLocal == null || grossRevenueLocal === 0
            ? null
            : roundRate(productCostTotal / grossRevenueLocal, 4);
          const sameProductCostRatio = isFormulaSameValue(currentProfitRow.product_cost_ratio, productCostRatio);
          if (!sameProductCostRatio) {
            patchMap[key] = { ...(patchMap[key] || {}), product_cost_ratio: productCostRatio };
            queueProfitUpdate(key, baseProfitUpdate, { product_cost_ratio: productCostRatio });
          }
          const sameReviewRefundPerUnit = isFormulaSameValue(currentProfitRow.review_refund_per_unit, reviewRefundPerUnit);
          if (!sameReviewRefundPerUnit) {
            patchMap[key] = { ...(patchMap[key] || {}), review_refund_per_unit: reviewRefundPerUnit };
            queueProfitUpdate(key, baseProfitUpdate, { review_refund_per_unit: reviewRefundPerUnit });
          }
          const sameReviewRefundCost = isFormulaSameValue(currentProfitRow.review_refund_cost, reviewRefundCost);
          if (!sameReviewRefundCost) {
            patchMap[key] = { ...(patchMap[key] || {}), review_refund_cost: reviewRefundCost };
            queueProfitUpdate(key, baseProfitUpdate, { review_refund_cost: reviewRefundCost });
          }
          const reviewCostRatio = reviewRefundCost == null || grossRevenueLocal == null || grossRevenueLocal === 0
            ? null
            : roundRate(reviewRefundCost / grossRevenueLocal, 4);
          const sameReviewCostRatio = isFormulaSameValue(currentProfitRow.review_cost_ratio, reviewCostRatio);
          if (!sameReviewCostRatio) {
            patchMap[key] = { ...(patchMap[key] || {}), review_cost_ratio: reviewCostRatio };
            queueProfitUpdate(key, baseProfitUpdate, { review_cost_ratio: reviewCostRatio });
          }
          const sameReviewUnitProfit = isFormulaSameValue(currentProfitRow.review_unit_profit, roundedReviewUnitProfit);
          if (!sameReviewUnitProfit) {
            patchMap[key] = { ...(patchMap[key] || {}), review_unit_profit: roundedReviewUnitProfit };
            queueProfitUpdate(key, baseProfitUpdate, { review_unit_profit: roundedReviewUnitProfit });
          }
          const sameReviewRefundTotal = isFormulaSameValue(currentProfitRow.review_refund_total, reviewRefundTotal);
          if (!sameReviewRefundTotal) {
            patchMap[key] = { ...(patchMap[key] || {}), review_refund_total: reviewRefundTotal };
            queueProfitUpdate(key, baseProfitUpdate, { review_refund_total: reviewRefundTotal });
          }

          const targetAdCvr = toFormulaNumber(
            targetDefaultMap[countryAsin]?.target_ad_cvr
            ?? source?.__src?.target_default?.target_ad_cvr
            ?? source?.target_ad_cvr
          );
          const targetCpa = toFormulaNumber(
            targetDefaultMap[countryAsin]?.target_cpa
            ?? source?.__src?.target_default?.target_cpa
            ?? source?.target_cpa
          );
          const targetProfitMargin = toFormulaNumber(
            targetDefaultMap[countryAsin]?.target_profit_margin
            ?? source?.__src?.target_default?.target_profit_margin
            ?? source?.target_profit_margin
          );
          const targetAdSpendRate = toFormulaNumber(
            targetDefaultMap[countryAsin]?.target_ad_spend_rate
            ?? source?.__src?.target_default?.target_ad_spend_rate
            ?? source?.target_ad_spend_rate
          );
          const targetSubcategoryRank = toFormulaNumber(
            existingTargetMap[key]?.target_subcategory_rank
            ?? source?.__src?.target?.target_subcategory_rank
            ?? source?.target_subcategory_rank
          );
          const actualRanking = toFormulaNumber(sourceWeekly.ranking ?? existingWeeklyMap[key]?.ranking ?? source?.ranking);
          const actualAdCvr = toFormulaNumber(sourceWeekly.guanggaocvr ?? existingWeeklyMap[key]?.guanggaocvr ?? source?.guanggaocvr)
            ?? safeDivide(adOrders, adClicks);
          const actualCpa = toFormulaNumber(sourceWeekly.cpa ?? existingWeeklyMap[key]?.cpa ?? source?.cpa)
            ?? safeDivide(adSpend, adOrders);
          const actualCpu = toFormulaNumber(sourceWeekly.cpu ?? existingWeeklyMap[key]?.cpu ?? source?.cpu)
            ?? safeDivide(adSpend, orderItems);
          const goalSubcategoryRank = targetSubcategoryRank == null
            ? '写目标排名'
            : actualRanking == null
            ? ''
            : actualRanking > targetSubcategoryRank
            ? `未达标 - 拉下${Math.round(actualRanking - targetSubcategoryRank)}名`
            : '√';
          const currentTargetRow = existingTargetMap[key] || sourceRowsByKey[key] || {};
          const targetFormulaUpdates = {
            goal_subcategory_rank: goalSubcategoryRank,
            target_ad_cvr_formula: calcWeeklyTargetAdCvrFormula(actualAdCvr, targetAdCvr),
            target_cpa_formula: calcWeeklyTargetCpaFormula(actualCpa, targetCpa),
            ideal_cpu_by_margin_formula: calcWeeklyTargetCpuFormula(actualCpu, idealCpuByMargin),
            target_profit_margin_formula: calcWeeklyTargetProfitMarginFormula(profitMargin, targetProfitMargin),
            target_ad_spend_rate_formula: calcWeeklyTargetAdSpendRateFormula(adCostRatio, targetAdSpendRate),
          };
          const targetFormulaChanged = Object.entries(targetFormulaUpdates).some(
            ([field, value]) => !isFormulaSameValue(currentTargetRow[field], value)
          );
          if (targetFormulaChanged) {
            const baseTargetFormulaUpdate = {
              country_asin_date: key,
              asin_country: asinCountry || null,
              asin: source?.asin || null,
              country: source?.country || null,
              date: toDateKey(source?.date) || null,
            };
            patchMap[key] = { ...(patchMap[key] || {}), ...targetFormulaUpdates };
            queueTargetFormulaUpdate(key, baseTargetFormulaUpdate, targetFormulaUpdates);
          }
        });

        Object.entries(dailyRowsByAsinCountry).forEach(([asinCountry, groupRows]) => {
          const rowsByDate = {};
          groupRows.forEach((row) => {
            const dateKey = toDateKey(row?.date);
            if (dateKey) rowsByDate[dateKey] = row;
          });
          const cumulativeByKey = {};
          [...groupRows]
            .sort((a, b) => toDateKey(a?.date).localeCompare(toDateKey(b?.date)))
            .forEach((row) => {
              const key = row?.country_asin_date;
              const dateKey = toDateKey(row?.date);
              if (!key || !dateKey) return;

              const currentProfitRow = existingProfitMap[key] || {};
              const netProfitLocal = Object.prototype.hasOwnProperty.call(computedNetProfitMap, key)
                ? computedNetProfitMap[key]
                : roundMoney(currentProfitRow.net_profit_local);
              if (netProfitLocal == null) return;

              const prevDateKey = getPreviousDateKey(dateKey);
              const prevKey = rowsByDate[prevDateKey]?.country_asin_date || '';
              const prevCumulative = prevKey
                ? (Object.prototype.hasOwnProperty.call(cumulativeByKey, prevKey)
                  ? cumulativeByKey[prevKey]
                  : roundMoney(existingProfitMap[prevKey]?.cumulative_break_even))
                : null;
              const cumulativeBreakEven = roundMoney(netProfitLocal + (prevCumulative || 0));
              cumulativeByKey[key] = cumulativeBreakEven;

              if (!keySet.has(key)) return;
              const sameCumulativeBreakEven = isFormulaSameValue(currentProfitRow.cumulative_break_even, cumulativeBreakEven);
              if (!sameCumulativeBreakEven) {
                const baseProfitUpdate = baseProfitUpdateMap[key] || {
                  country_asin_date: key,
                  asin_country: asinCountry || null,
                  asin: row?.asin || null,
                  country: row?.country || null,
                  date: dateKey,
                };
                patchMap[key] = { ...(patchMap[key] || {}), cumulative_break_even: cumulativeBreakEven };
                queueProfitUpdate(key, baseProfitUpdate, { cumulative_break_even: cumulativeBreakEven });
              }
            });
        });

        const weeklyUpdateJobs = Object.values(weeklyJobsByKey);
        const profitUpdateJobs = Object.values(profitJobsByKey);
        const orderLinkUpdateJobs = Object.values(orderLinkJobsByKey);
        const targetFormulaUpdateJobs = Object.values(targetFormulaJobsByKey);
        const writeMetaFields = new Set(['country_asin_date', 'asin_country', 'asin', 'country', 'date']);
        const stripWriteMeta = (updates) => Object.fromEntries(
          Object.entries(updates || {}).filter(([field]) => !writeMetaFields.has(field))
        );

        reportProgress(`准备写回 ${updateJobs.length + weeklyUpdateJobs.length + targetFormulaUpdateJobs.length + orderLinkUpdateJobs.length + profitUpdateJobs.length} 条...`, 55);
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < updateJobs.length; i += 100) {
          const batch = updateJobs.slice(i, i + 100);
          const results = await Promise.allSettled(
            batch.map((job) => ctx.request({
              url: 'daily_asins:update',
              method: 'post',
              params: { filterByTk: job.key },
              data: job.updates,
            }))
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          const done = Math.min(i + batch.length, updateJobs.length);
          const percent = updateJobs.length ? 55 + (done / updateJobs.length) * 15 : 70;
          reportProgress(`正在写回日表 ${done}/${updateJobs.length}...`, percent);
        }

        for (let i = 0; i < weeklyUpdateJobs.length; i += 100) {
          const batch = weeklyUpdateJobs.slice(i, i + 100);
          const results = await Promise.allSettled(
            batch.map((job) => ctx.request({
              url: 'weekly_performance:update',
              method: 'post',
              params: { filterByTk: job.key },
              data: job.updates,
            }))
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          const done = Math.min(i + batch.length, weeklyUpdateJobs.length);
          const percent = weeklyUpdateJobs.length ? 70 + (done / weeklyUpdateJobs.length) * 5 : 75;
          reportProgress(`正在写回周表现 ${done}/${weeklyUpdateJobs.length}...`, percent);
        }

        for (let i = 0; i < targetFormulaUpdateJobs.length; i += 100) {
          const batch = targetFormulaUpdateJobs.slice(i, i + 100);
          const results = await Promise.allSettled(
            batch.map((job) => job.exists
              ? ctx.request({
                  url: 'target_management:update',
                  method: 'post',
                  params: { filterByTk: job.key },
                  data: stripWriteMeta(job.updates),
                })
              : ctx.request({
                  url: 'target_management:create',
                  method: 'post',
                  data: withCreateTimestamps(job.updates),
                })
            )
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          const done = Math.min(i + batch.length, targetFormulaUpdateJobs.length);
          const percent = targetFormulaUpdateJobs.length ? 75 + (done / targetFormulaUpdateJobs.length) * 5 : 80;
          reportProgress(`正在写回目标公式 ${done}/${targetFormulaUpdateJobs.length}...`, percent);
        }

        for (let i = 0; i < orderLinkUpdateJobs.length; i += 100) {
          const batch = orderLinkUpdateJobs.slice(i, i + 100);
          const results = await Promise.allSettled(
            batch.map((job) => job.exists
              ? ctx.request({
                  url: 'daily_order_link_tracking:update',
                  method: 'post',
                  params: { filterByTk: job.key },
                  data: stripWriteMeta(job.updates),
                })
              : ctx.request({
                  url: 'daily_order_link_tracking:create',
                  method: 'post',
                  data: withCreateTimestamps(job.updates),
                })
            )
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          const done = Math.min(i + batch.length, orderLinkUpdateJobs.length);
          const percent = orderLinkUpdateJobs.length ? 80 + (done / orderLinkUpdateJobs.length) * 5 : 85;
          reportProgress(`正在写回订单链接 ${done}/${orderLinkUpdateJobs.length}...`, percent);
        }

        for (let i = 0; i < profitUpdateJobs.length; i += 100) {
          const batch = profitUpdateJobs.slice(i, i + 100);
          const results = await Promise.allSettled(
            batch.map((job) => job.exists
              ? ctx.request({
                  url: 'daily_profit:update',
                  method: 'post',
                  params: { filterByTk: job.key },
                  data: stripWriteMeta(job.updates),
                })
              : ctx.request({
                  url: 'daily_profit:create',
                  method: 'post',
                  data: withCreateTimestamps(job.updates),
                })
            )
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          const done = Math.min(i + batch.length, profitUpdateJobs.length);
          const percent = profitUpdateJobs.length ? 85 + (done / profitUpdateJobs.length) * 10 : 95;
          reportProgress(`正在写回利润 ${done}/${profitUpdateJobs.length}...`, percent);
        }

        const currentDataRows = Array.isArray(dataRef.current) ? dataRef.current : [];
        const summaryBaseRows = currentDataRows.length ? currentDataRows : rows;
        const patchedDataRows = summaryBaseRows.map((item) => {
          const itemKey = item.country_asin_date || item.id;
          return patchMap[itemKey] ? mergeFormulaPatch(item, patchMap[itemKey]) : item;
        });
        let patchedSummaryKeys = patchedDataRows
          .filter((item) => {
            const itemKey = item.country_asin_date || item.id;
            return !!patchMap[itemKey];
          })
          .map((item) => getSummaryKeyForRow(item))
          .filter(Boolean);
        if (!patchedSummaryKeys.length) {
          patchedSummaryKeys = patchedDataRows.map((item) => getSummaryKeyForRow(item)).filter(Boolean);
        }

        let refreshedSummaryMap = {};
        try {
          refreshedSummaryMap = await refreshWeeklySummariesFromRows(patchedDataRows, INITIAL_COLUMNS, { summaryKeys: [...new Set(patchedSummaryKeys)] });
        } catch (summaryErr) {
          if (!silent) ctx.message.warning(`周汇总同步失败：${summaryErr?.message || ''}`);
        }
        const nextSummaryMap = { ...(weeklySummaryMapRef.current || {}), ...(refreshedSummaryMap || {}) };
        const displayPatchedRows = attachWeeklySummaryDataToRows(patchedDataRows, nextSummaryMap);
        dataRef.current = displayPatchedRows;
        setData(displayPatchedRows);

        if (!silent) {
          if (!updateJobs.length && !weeklyUpdateJobs.length && !targetFormulaUpdateJobs.length && !profitUpdateJobs.length && !orderLinkUpdateJobs.length && !Object.keys(refreshedSummaryMap || {}).length) {
            ctx.message.success('所有公式已是最新');
          } else if (failCount) ctx.message.warning(`公式计算完成：成功 ${successCount} 条，失败 ${failCount} 条`);
          else ctx.message.success(`公式计算完成：成功 ${successCount} 条`);
        }
        reportProgress(`公式计算完成：成功 ${successCount} 条`, 100);
        return {
          total: updateJobs.length + weeklyUpdateJobs.length + targetFormulaUpdateJobs.length + orderLinkUpdateJobs.length + profitUpdateJobs.length,
          success: successCount,
          skipped: keys.length - Math.max(updateJobs.length, weeklyUpdateJobs.length, targetFormulaUpdateJobs.length, orderLinkUpdateJobs.length, profitUpdateJobs.length),
        };
      } catch (err) {
        if (!silent) ctx.message.error(`公式计算失败：${err?.message || '未知错误'}`);
        throw err;
      } finally {
        if (!silent) {
          setCalcLoading(false);
          setCalcProgress('');
        }
      }
    }, [attachWeeklySummaryDataToRows, buildActivityAnnotationMatchMap, fetchAllByIn, getSummaryKeyForRow, refreshWeeklySummariesFromRows, syncDailyRsgNumbersFromRefunds]);

    async function loadAllDailyRowsForCurrentCountryAsin() {
      if (!filterCountry || !filterAsin) return [];
      const filterAnd = [
        { country: { $eq: filterCountry } },
        { asin: { $eq: filterAsin } },
      ];
      return fetchAllList('daily_asins:list', {
        sort: 'date',
        filter: JSON.stringify({ $and: filterAnd }),
      }, 1000);
    }

    async function ensureCurrentCountryAsinMergeSummaries(options = {}) {
      const reportProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      reportProgress?.({ label: '读取全量数据...', percent: 8 });
      let rows = await loadAllDailyRowsForCurrentCountryAsin();
      if (!rows.length) return {};
      const keys = [...new Set(rows.map((row) => getSummaryKeyForRow(row)).filter(Boolean))];
      if (!keys.length) return {};

      const keysToRefresh = keys;
      if (!keysToRefresh.length) return {};

      const keySet = new Set(keysToRefresh);
      let rowsToRefresh = rows.filter((row) => {
        const key = getSummaryKeyForRow(row);
        return key && keySet.has(key);
      });
      if (!rowsToRefresh.length) return {};

      if (options.recalcFormulas !== false) {
        reportProgress?.({ label: '计算日公式...', percent: 18 });
        await recalcAllCoreFormulas(rowsToRefresh, {
          silent: true,
          preloadedDailyRows: rows,
          onProgress: (progress) => {
            if (!reportProgress) return;
            const label = typeof progress === 'string' ? progress : (progress?.label || '正在计算日公式...');
            const rawPercent = typeof progress === 'object' ? Number(progress?.percent) : null;
            const percent = Number.isFinite(rawPercent) ? 18 + rawPercent * 0.55 : 45;
            reportProgress({ label, percent });
          },
        });
        reportProgress?.({ label: '读取最新数据...', percent: 76 });
        rows = await loadAllDailyRowsForCurrentCountryAsin();
        rowsToRefresh = rows.filter((row) => {
          const key = getSummaryKeyForRow(row);
          return key && keySet.has(key);
        });
      }

      reportProgress?.({ label: '汇总周数据...', percent: 86 });
      const { mergedRows, summaryCols } = await mergeDailyRowsForWeeklySummary(rowsToRefresh, {
        updateDynamicColumns: options.updateDynamicColumns === true,
      });
      reportProgress?.({ label: '写入周汇总...', percent: 94 });
      return refreshWeeklySummariesFromRows(mergedRows, summaryCols, { summaryKeys: keysToRefresh });
    }

    function scheduleCurrentCountryAsinMergeSummarySync(options = {}) {
      if (!filterCountry || !filterAsin) return;
      const state = backgroundMergeSummaryRef.current;
      state.pendingForce = state.pendingForce || options.force === true;
      if (state.timer) window.clearTimeout(state.timer);
      if (options.showQueuedProgress) {
        showFormulaProgress({ label: '全量排队...', percent: 35 });
      }
      state.timer = window.setTimeout(async () => {
        state.timer = null;
        if (state.running) return;
        state.running = true;
        const force = state.pendingForce;
        state.pendingForce = false;
        try {
          showFormulaProgress({ label: '同步全量汇总...', percent: 5 });
          await ensureCurrentCountryAsinMergeSummaries({
            force,
            recalcFormulas: options.recalcFormulas !== false,
            onProgress: showFormulaProgress,
          });
          finishFormulaProgress('全量同步完成');
        } catch (err) {
          resetFormulaProgress();
          ctx.message.warning(`后台周汇总补齐失败：${err?.message || ''}`);
        } finally {
          state.running = false;
          if (state.pendingForce) scheduleCurrentCountryAsinMergeSummarySync({ force: true });
        }
      }, Number(options.delay) || 800);
    }

    const loadData = useCallback(async (options = {}) => {
      const page = options.page ?? curPageRef.current;
      const size = options.size ?? pageSizeRef.current;
      const skipFormula = options.skipFormula === true;
      try {
        setLoading(true);
        if (!hasRequiredUrlParams) {
          dataRef.current = [];
          setData([]);
          setTotal(0);
          return [];
        }
        const dailyFilterAnd = [];
        if (filterAsin)    dailyFilterAnd.push({ asin:    { $eq: filterAsin    } });
        if (filterCountry) dailyFilterAnd.push({ country: { $eq: filterCountry } });
        // 日期筛选
        const dateRange = getDateRange;
        if (dateRange) {
          if (dateRange[0]) dailyFilterAnd.push({ date: { $gte: dateRange[0] } });
          if (dateRange[1]) dailyFilterAnd.push({ date: { $lte: dateRange[1] } });
        }
        const dailyParams = {
          sort: getDailySort(),
          page,
          pageSize: size,
          ...(dailyFilterAnd.length > 0 ? { filter: JSON.stringify({ $and: dailyFilterAnd }) } : {}),
        };

        const rDaily = await ctx.request({ url: 'daily_asins:list', method: 'get', params: dailyParams });
        let dailyRecords = Array.isArray(rDaily?.data?.data) ? rDaily.data.data : [];
        const totalCount = pickTotalFromResponse(rDaily);
        const productConfigAsinCountries = [
          ...new Set(
            dailyRecords
              .map((d) => d.asin_country || (d.asin && d.country ? `${d.asin}_${d.country}` : ''))
              .filter(Boolean)
          )
        ];

        const candidateSummaryKeys = dailyRecords.map((row) => {
          const range = getWeekRangeForDate(row?.date);
          return range && row?.country && row?.asin
            ? getWeeklySummaryKey({ country: row.country, asin: row.asin, ...range })
            : '';
        }).filter(Boolean);
        const candidateSummaryKeySet = new Set(candidateSummaryKeys);
        const candidateSummaryRanges = dailyRecords.map((row) => {
          const range = getWeekRangeForDate(row?.date);
          return range && row?.country && row?.asin ? { ...range, country: row.country, asin: row.asin } : null;
        }).filter(Boolean);
        const rangeStarts = candidateSummaryRanges.map((item) => item.start).filter(Boolean).sort();
        const rangeEnds = candidateSummaryRanges.map((item) => item.end).filter(Boolean).sort();
        const summaryDailyFilterAnd = [];
        if (productConfigAsinCountries.length) summaryDailyFilterAnd.push({ asin_country: { $in: productConfigAsinCountries } });
        else {
          if (filterAsin) summaryDailyFilterAnd.push({ asin: { $eq: filterAsin } });
          if (filterCountry) summaryDailyFilterAnd.push({ country: { $eq: filterCountry } });
        }
        if (rangeStarts.length) summaryDailyFilterAnd.push({ date: { $gte: rangeStarts[0] } });
        if (rangeEnds.length) summaryDailyFilterAnd.push({ date: { $lte: rangeEnds[rangeEnds.length - 1] } });
        const summaryDailyRecordsRaw = candidateSummaryKeySet.size
          ? await fetchAllList('daily_asins:list', {
              sort: 'date',
              ...(summaryDailyFilterAnd.length > 0 ? { filter: JSON.stringify({ $and: summaryDailyFilterAnd }) } : {}),
            }, Math.max(200, candidateSummaryKeySet.size * 14))
          : [];
        let summaryDailyRecords = summaryDailyRecordsRaw.filter((row) => {
          const range = getWeekRangeForDate(row?.date);
          const key = range && row?.country && row?.asin
            ? getWeeklySummaryKey({ country: row.country, asin: row.asin, ...range })
            : '';
          return candidateSummaryKeySet.has(key);
        });
        const relatedDailyMap = {};
        [...dailyRecords, ...summaryDailyRecords].forEach((row) => {
          if (row?.country_asin_date) relatedDailyMap[row.country_asin_date] = row;
        });
        let relatedDailyRecords = Object.values(relatedDailyMap);
        const rsgSyncResult = await syncDailyRsgNumbersFromRefunds(relatedDailyRecords);
        if (rsgSyncResult.rows.length) {
          const syncedDailyMap = {};
          rsgSyncResult.rows.forEach((row) => {
            if (row?.country_asin_date) syncedDailyMap[row.country_asin_date] = row;
          });
          dailyRecords = dailyRecords.map((row) => syncedDailyMap[row.country_asin_date] || row);
          summaryDailyRecords = summaryDailyRecords.map((row) => syncedDailyMap[row.country_asin_date] || row);
          relatedDailyRecords = rsgSyncResult.rows;
        }
        const dailyKeys = [...new Set(relatedDailyRecords.map((d) => d.country_asin_date).filter(Boolean))];
        const weeklyKeyCandidates = [...new Set(dailyKeys)];
        const countryAsinKeys = [...new Set(relatedDailyRecords.map((d) => toCountryAsinKey(d.country, d.asin)).filter(Boolean))];
        const weeklyParams = dailyKeys.length
          ? { filter: JSON.stringify({ country_asin_week: { $in: weeklyKeyCandidates } }) }
          : {};
        const profitParams = dailyKeys.length
          ? { filter: JSON.stringify({ country_asin_date: { $in: dailyKeys } }) }
          : {};
        const targetParams = dailyKeys.length
          ? { filter: JSON.stringify({ country_asin_date: { $in: dailyKeys } }) }
          : {};
        const countryAsinParams = countryAsinKeys.length
          ? { filter: JSON.stringify({ country_asin: { $in: countryAsinKeys } }) }
          : {};
        const targetDefaultParams = countryAsinKeys.length
          ? { filter: JSON.stringify({ country_asin: { $in: countryAsinKeys } }) }
          : {};
        const dailyKeyParams = dailyKeys.length
          ? { filter: JSON.stringify({ country_asin_date: { $in: dailyKeys } }) }
          : {};
        const productConfigParams = productConfigAsinCountries.length
          ? { filter: JSON.stringify({ asin_country: { $in: productConfigAsinCountries } }) }
          : {};

        const optionalFetchAll = (url, params, batchSize) => fetchAllList(url, params, batchSize).catch(() => []);
        const [weeklyRecords, targetRecords, targetDefaultRecords, profitRecords, orderLinkRecords, productConfigRecords, sqpKeywordRecords, sqpKeywordPositionRecords, competitorRecords, competitorDailyRecords] = await Promise.all([
          dailyKeys.length ? fetchAllList('weekly_performance:list', weeklyParams, Math.max(100, dailyKeys.length * 2)) : [],
          dailyKeys.length ? fetchAllList('target_management:list', targetParams, Math.max(100, dailyKeys.length * 2)) : [],
          countryAsinKeys.length ? optionalFetchAll('target_default:list', targetDefaultParams, Math.max(100, countryAsinKeys.length * 2)) : [],
          dailyKeys.length ? fetchAllList('daily_profit:list', profitParams, Math.max(100, dailyKeys.length * 2)) : [],
          dailyKeys.length ? optionalFetchAll('daily_order_link_tracking:list', dailyKeyParams, Math.max(100, dailyKeys.length * 2)) : [],
          productConfigAsinCountries.length ? optionalFetchAll('product_config:list', productConfigParams, Math.max(100, productConfigAsinCountries.length * 2)) : [],
          countryAsinKeys.length ? optionalFetchAll('sqp_keywords:list', { ...countryAsinParams, sort: ['id'] }, Math.max(100, countryAsinKeys.length * 20)) : [],
          dailyKeys.length ? optionalFetchAll('sqp_keyword_daily_positions:list', dailyKeyParams, Math.max(1000, dailyKeys.length * 20)) : [],
          countryAsinKeys.length ? optionalFetchAll('order_link_competitor_asins:list', countryAsinParams, Math.max(100, countryAsinKeys.length * 5)) : [],
          dailyKeys.length ? optionalFetchAll('order_link_competitor_asins_daily:list', dailyKeyParams, Math.max(100, dailyKeys.length * 5)) : [],
        ]);

        const keywordCols = buildDynamicKeywordCols(sqpKeywordRecords);
        const competitorCols = buildDynamicCompetitorCols(competitorRecords);
        setDynamicKeywordCols(keywordCols);
        setDynamicCompetitorCols(competitorCols);

        const weeklyMap = {};
        weeklyRecords.forEach((w) => {
          if (w.country_asin_week) weeklyMap[w.country_asin_week] = w;
        });
        const profitMap = {};
        profitRecords.forEach((p) => {
          if (p.country_asin_date) profitMap[p.country_asin_date] = p;
        });
        const orderLinkMap = {};
        orderLinkRecords.forEach((o) => {
          if (o.country_asin_date) orderLinkMap[o.country_asin_date] = o;
        });
        const productConfigMap = {};
        productConfigRecords.forEach((p) => {
          if (p.asin_country) productConfigMap[p.asin_country] = p;
        });
        const targetMap = {};
        targetRecords.forEach((t) => {
          if (t.country_asin_date) targetMap[t.country_asin_date] = t;
        });
        const targetDefaultMap = {};
        targetDefaultRecords.forEach((t) => {
          if (t.country_asin) targetDefaultMap[t.country_asin] = t;
        });
        const sqpKeywordsByCountryAsin = {};
        sqpKeywordRecords.forEach((e) => {
          if (!e.country_asin) return;
          if (!sqpKeywordsByCountryAsin[e.country_asin]) sqpKeywordsByCountryAsin[e.country_asin] = [];
          sqpKeywordsByCountryAsin[e.country_asin].push(e);
        });
        const sqpKeywordPositionMap = {};
        sqpKeywordPositionRecords.forEach((e) => {
          const dateStr = toDateKey(e.date);
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
          const rowKey = toCompetitorDailyKey(c.competitor_id, c.country_asin_date);
          if (rowKey) competitorDailyMap[rowKey] = c;
        });

        const mergeDailyRecord = (d) => {
          const key = d.country_asin_date;
          const weeklyData = weeklyMap[key] || {};
          const targetData = targetMap[key] || {};
          const profitData = profitMap[key] || {};
          const orderLinkData = orderLinkMap[key] || {};
          const asinCountry = d.asin_country || (d.asin && d.country ? `${d.asin}_${d.country}` : '');
          const productConfigData = productConfigMap[asinCountry] || {};
          const countryAsin = toCountryAsinKey(d.country, d.asin);
          const targetDefaultData = targetDefaultMap[countryAsin] || {};
          const dateStr = toDateKey(d.date);
          const merged = { ...targetDefaultData, ...weeklyData, ...targetData, ...profitData, ...orderLinkData, ...productConfigData, ...d };
          merged.__src = {
            weekly: weeklyData,
            target: targetData,
            target_default: targetDefaultData,
            profit: profitData,
            order_link: orderLinkData,
            product_config: productConfigData,
            daily: d,
          };
          merged.order_link_real_session_conversion_rate = orderLinkData.real_session_conversion_rate;
          if (countryAsin && dateStr) {
            const rowKeywords = sqpKeywordsByCountryAsin[countryAsin] || [];
            keywordCols.forEach((col) => {
              const kw = rowKeywords.find((item) => item.id === col._kwId);
              if (!kw) return;
              merged[col.field] = {
                kw,
                daily: sqpKeywordPositionMap[`${kw.id}_${dateStr}`] || {},
              };
            });

            const rowCompetitors = competitorsByCountryAsin[countryAsin] || [];
            competitorCols.forEach((col) => {
              const comp = rowCompetitors.find((item) => item.id === col._competitorId);
              if (!comp) return;
              merged[col.field] = {
                competitor: comp,
                daily: competitorDailyMap[toCompetitorDailyKey(comp.id, key)] || {},
              };
            });
          }
          return merged;
        };
        const mergedData = dailyRecords.map(mergeDailyRecord);
        const summaryMergedData = summaryDailyRecords.map(mergeDailyRecord);

        const summaryCols = [...INITIAL_COLUMNS, ...keywordCols, ...competitorCols];
        const existingWeeklySummaryMap = {};
        const refreshedWeeklySummaryMap = candidateSummaryKeys.length
          ? await refreshWeeklySummariesFromRows(summaryMergedData, summaryCols, { summaryKeys: candidateSummaryKeys }).catch(() => ({}))
          : {};
        Object.assign(existingWeeklySummaryMap, refreshedWeeklySummaryMap || {});
        if (candidateSummaryKeys.length && !Object.keys(existingWeeklySummaryMap).length) {
          const existingWeeklySummaryRows = await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', candidateSummaryKeys, {
            chunkSize: 80,
            pageSize: 500,
          }).catch(() => []);
          existingWeeklySummaryRows.forEach((row) => {
            const normalized = normalizeWeeklySummaryRecord(row);
            if (normalized) existingWeeklySummaryMap[normalized.country_asin_week_range] = normalized;
          });
        }
        setWeeklySummaryMap(existingWeeklySummaryMap);

        const missingSummaryKeySet = new Set(candidateSummaryKeys.filter((key) => !existingWeeklySummaryMap[key]));
        const displayMergedData = attachWeeklySummaryDataToRows(mergedData, existingWeeklySummaryMap);

        dataRef.current = displayMergedData;
        setData(displayMergedData);
        setTotal(totalCount || displayMergedData.length);
        const shouldRunBackgroundSummary = !options.skipBackgroundSummary && filterCountry && filterAsin;
        if (!options.skipCurrentPageSummaryRefresh && candidateSummaryKeys.length) {
          scheduleCurrentPageMergeSummaryRefresh(candidateSummaryKeys, {
            delay: (!skipFormula || missingSummaryKeySet.size) ? 80 : 180,
            keepProgressForBackground: shouldRunBackgroundSummary,
          });
        }
        if (shouldRunBackgroundSummary) {
          scheduleCurrentCountryAsinMergeSummarySync({
            force: true,
            showQueuedProgress: !candidateSummaryKeys.length || options.skipCurrentPageSummaryRefresh,
            delay: candidateSummaryKeys.length ? 1000 : ((!skipFormula || missingSummaryKeySet.size) ? 200 : 900),
          });
        }
        return displayMergedData;
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        dataRef.current = [];
        setData([]);
        setTotal(0);
        return [];
      } finally {
        setLoading(false);
      }
    }, [filterAsin, filterCountry, hasRequiredUrlParams, dateFilterType, getDateRange, getDailySort, fetchAllList, fetchAllByIn, buildDynamicKeywordCols, buildDynamicCompetitorCols, normalizeWeeklySummaryRecord, getSummaryKeyForRow, attachWeeklySummaryDataToRows, refreshWeeklySummariesFromRows, recalcAllCoreFormulas, showFormulaProgress, finishFormulaProgress, resetFormulaProgress, syncDailyRsgNumbersFromRefunds]);

    useEffect(() => {
      const backgroundState = backgroundMergeSummaryRef.current;
      if (backgroundState?.timer) window.clearTimeout(backgroundState.timer);
      backgroundState.timer = null;
      backgroundState.pendingForce = false;
      const currentPageState = currentPageMergeSummaryRef.current;
      if (currentPageState?.timer) window.clearTimeout(currentPageState.timer);
      currentPageState.timer = null;
      currentPageState.pendingKeys.clear();
    }, [filterCountry, filterAsin]);

    // 初始加载或筛选变化时重新加载第一页；列头排序只在本地重排当前数据。
    useEffect(() => {
      if (!columnViewReady) return;
      setCurPage(1);
      curPageRef.current = 1;
      loadData({ page: 1, size: pageSizeRef.current });
    }, [columnViewReady, loadData]);

    const autoRefreshCurrentPage = useCallback(async () => {
      if (loading || refreshingData || calcLoading || saving || editingCell) return;
      const now = Date.now();
      if (now - (autoRefreshRef.current.lastAt || 0) < 3000) return;
      autoRefreshRef.current.lastAt = now;
      try {
        showFormulaProgress({ label: '切回页面，正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        if (!(filterCountry && filterAsin)) {
          finishFormulaProgress('切回页面已刷新');
        }
      } catch (err) {
        resetFormulaProgress();
        ctx.message.warning(`切回页面自动刷新失败：${err?.message || '未知错误'}`);
      }
    }, [calcLoading, editingCell, filterAsin, filterCountry, finishFormulaProgress, loadData, loading, refreshingData, resetFormulaProgress, saving, showFormulaProgress]);

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

    const loadFormulaRowsForCurrentCountryAsin = useCallback(async () => {
      if (!filterCountry || !filterAsin) {
        ctx.message.warning('请先筛选到具体国家和 ASIN，再计算核心利润公式');
        return [];
      }
      const dailyFilterAnd = [
        { country: { $eq: filterCountry } },
        { asin: { $eq: filterAsin } },
      ];
      return fetchAllList('daily_asins:list', {
        sort: 'date',
        filter: JSON.stringify({ $and: dailyFilterAnd }),
      }, 1000);
    }, [filterAsin, filterCountry, fetchAllList]);

    const scheduleBackgroundFormulaSync = useCallback((changedRows = []) => {
      const asinCountries = [
        ...new Set(
          (Array.isArray(changedRows) ? changedRows : [])
            .map((row) => row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : ''))
            .filter(Boolean)
        )
      ];
      if (!asinCountries.length) return;
      asinCountries.forEach((asinCountry) => pendingFormulaAsinCountriesRef.current.add(asinCountry));
      if (backgroundFormulaTimerRef.current) window.clearTimeout(backgroundFormulaTimerRef.current);
      backgroundFormulaTimerRef.current = window.setTimeout(async () => {
        const pending = [...pendingFormulaAsinCountriesRef.current].filter(Boolean);
        pendingFormulaAsinCountriesRef.current.clear();
        backgroundFormulaTimerRef.current = null;
        if (!pending.length) return;
        try {
          const rows = await fetchAllByIn('daily_asins:list', 'asin_country', pending, {
            params: { sort: 'date' },
            chunkSize: 50,
            pageSize: 500,
          });
          if (rows.length) {
            await recalcAllCoreFormulas(rows, { silent: true, preloadedDailyRows: rows });
          }
        } catch (err) {
          ctx.message.warning(`后台公式校准失败：${err?.message || ''}`);
        }
      }, 1800);
    }, [fetchAllByIn, recalcAllCoreFormulas]);

    useEffect(() => () => {
      if (formulaProgressFinishTimerRef.current) window.clearTimeout(formulaProgressFinishTimerRef.current);
      if (backgroundFormulaTimerRef.current) window.clearTimeout(backgroundFormulaTimerRef.current);
      if (backgroundMergeSummaryRef.current?.timer) window.clearTimeout(backgroundMergeSummaryRef.current.timer);
      if (currentPageMergeSummaryRef.current?.timer) window.clearTimeout(currentPageMergeSummaryRef.current.timer);
    }, []);

    const syncCoreFormulasForRows = useCallback(async (changedRows = [], options = {}) => {
      const targetRows = Array.isArray(changedRows) ? changedRows.filter(Boolean) : [];
      const asinCountries = [
        ...new Set(
          targetRows
            .map((row) => row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : ''))
            .filter(Boolean)
        )
      ];
      if (!asinCountries.length || !targetRows.length) return;
      const contextRows = await fetchAllByIn('daily_asins:list', 'asin_country', asinCountries, {
        params: { sort: 'date' },
        chunkSize: 50,
        pageSize: 500,
      });
      const rowsToRecalc = contextRows.length ? contextRows : targetRows;
      await recalcAllCoreFormulas(rowsToRecalc, { silent: true, preloadedDailyRows: rowsToRecalc, onProgress: options.onProgress });
      if (options.scheduleBackground !== false) scheduleBackgroundFormulaSync(targetRows);
    }, [fetchAllByIn, recalcAllCoreFormulas, scheduleBackgroundFormulaSync]);

    const syncFormulasForChangedRows = useCallback(async (changedRows = [], options = {}) => {
      const targetRows = Array.isArray(changedRows) ? changedRows.filter(Boolean) : [];
      if (!targetRows.length) return;
      const onProgress = options.onProgress;
      await syncCoreFormulasForRows(targetRows, { onProgress, scheduleBackground: false });
    }, [syncCoreFormulasForRows]);

    const pushUndoEntry = useCallback((entry) => {
      const items = Array.isArray(entry?.items) ? entry.items.filter(Boolean) : [];
      if (!items.length) return;
      undoStackRef.current.push({ ...entry, items, at: Date.now() });
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    }, []);

    const currentCountryAsin = useMemo(() => toCountryAsinKey(filterCountry, filterAsin), [filterCountry, filterAsin]);
    const currentAsinCountry = useMemo(() => (filterAsin && filterCountry ? `${filterAsin}_${filterCountry}` : ''), [filterAsin, filterCountry]);

    const loadCouponConfig = useCallback(async () => {
      if (!currentAsinCountry) {
        setCouponConfigRecord(null);
        setCouponRatioDraft(null);
        return;
      }
      setCouponManagerLoading(true);
      try {
        const rows = await fetchAllList('product_config:list', {
          filter: JSON.stringify({ asin_country: { $eq: currentAsinCountry } }),
        }, 1).catch(() => []);
        const record = rows?.[0] || null;
        setCouponConfigRecord(record);
        const ratio = toFormulaNumber(record?.coupon_order_ratio_estimated);
        setCouponRatioDraft(ratio == null ? null : ratio * 100);
      } catch (err) {
        ctx.message.error(`加载 Coupon 配置失败：${err?.message || '未知错误'}`);
        setCouponConfigRecord(null);
        setCouponRatioDraft(null);
      } finally {
        setCouponManagerLoading(false);
      }
    }, [currentAsinCountry, fetchAllList]);

    const openCouponManager = useCallback(() => {
      setCouponManagerVisible(true);
      loadCouponConfig();
    }, [loadCouponConfig]);

    const saveCouponConfig = useCallback(async () => {
      if (!currentAsinCountry) return;
      const ratioValue = couponRatioDraft == null || couponRatioDraft === ''
        ? null
        : Number(couponRatioDraft) / 100;
      if (ratioValue != null && !Number.isFinite(ratioValue)) {
        ctx.message.error('请输入正确的比例');
        return;
      }
      if (!couponConfigRecord?.asin_country) {
        ctx.message.error('未找到当前 ASIN_国家 的 product_config 配置记录，无法保存');
        return;
      }
      try {
        setCouponManagerSaving(true);
        const payload = { coupon_order_ratio_estimated: ratioValue };
        await ctx.request({
          url: 'product_config:update',
          method: 'post',
          params: { filter: JSON.stringify({ asin_country: { $eq: couponConfigRecord.asin_country } }) },
          data: payload,
        });
        const nextRecord = { ...(couponConfigRecord || {}), coupon_order_ratio_estimated: ratioValue };
        setCouponConfigRecord(nextRecord);
        updateDataAndRefreshWeekly((prev) => prev.map((row) => {
          const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
          return asinCountry === currentAsinCountry ? { ...row, coupon_order_ratio_estimated: ratioValue } : row;
        }));
        try {
          await loadData({ page: curPageRef.current, size: pageSizeRef.current });
          await loadCouponConfig();
          ctx.message.success('Coupon 预估比例已保存，公式已同步');
        } catch (formulaErr) {
          ctx.message.warning(`Coupon 预估比例已保存，公式同步或刷新失败：${formulaErr?.message || '未知错误'}`);
        }
      } catch (err) {
        ctx.message.error(`保存 Coupon 配置失败：${err?.message || '未知错误'}`);
      } finally {
        setCouponManagerSaving(false);
      }
    }, [couponConfigRecord, couponRatioDraft, currentAsinCountry, loadCouponConfig, loadData, updateDataAndRefreshWeekly]);

    const resetTargetDraft = useCallback(() => {
      setTargetDefaultRecord(null);
      setTargetAdCvrDraft(null);
      setTargetCpaDraft(null);
      setTargetIdealCpuDraft(null);
      setTargetProfitMarginDraft(null);
      setTargetAdSpendRateDraft(null);
    }, []);

    const loadTargetDefault = useCallback(async () => {
      if (!currentCountryAsin) {
        resetTargetDraft();
        return;
      }
      setTargetManagerLoading(true);
      try {
        const rows = await fetchAllList('target_default:list', {
          filter: JSON.stringify({ country_asin: { $eq: currentCountryAsin } }),
        }, 1).catch(() => []);
        const record = rows?.[0] || null;
        setTargetDefaultRecord(record);
        setTargetAdCvrDraft(record?.target_ad_cvr != null ? Number(record.target_ad_cvr) * 100 : null);
        setTargetCpaDraft(record?.target_cpa ?? null);
        setTargetIdealCpuDraft(record?.ideal_cpu_by_margin ?? null);
        setTargetProfitMarginDraft(record?.target_profit_margin != null ? Number(record.target_profit_margin) * 100 : null);
        setTargetAdSpendRateDraft(record?.target_ad_spend_rate != null ? Number(record.target_ad_spend_rate) * 100 : null);
      } catch (err) {
        ctx.message.error(`加载目标值失败：${err?.message || '未知错误'}`);
        resetTargetDraft();
      } finally {
        setTargetManagerLoading(false);
      }
    }, [currentCountryAsin, fetchAllList, resetTargetDraft]);

    const openTargetManager = useCallback(() => {
      setTargetManagerVisible(true);
      loadTargetDefault();
    }, [loadTargetDefault]);

    const saveTargetDefault = useCallback(async () => {
      if (!currentCountryAsin) return;
      const payload = {
        target_ad_cvr: targetAdCvrDraft != null && targetAdCvrDraft !== '' ? Number(targetAdCvrDraft) / 100 : null,
        target_cpa: targetCpaDraft != null && targetCpaDraft !== '' ? Number(targetCpaDraft) : null,
        ideal_cpu_by_margin: targetIdealCpuDraft != null && targetIdealCpuDraft !== '' ? Number(targetIdealCpuDraft) : null,
        target_profit_margin: targetProfitMarginDraft != null && targetProfitMarginDraft !== '' ? Number(targetProfitMarginDraft) / 100 : null,
        target_ad_spend_rate: targetAdSpendRateDraft != null && targetAdSpendRateDraft !== '' ? Number(targetAdSpendRateDraft) / 100 : null,
      };
      const invalidKey = Object.keys(payload).find((key) => payload[key] != null && !Number.isFinite(payload[key]));
      if (invalidKey) {
        ctx.message.error('请输入正确的目标值');
        return;
      }
      try {
        setTargetManagerSaving(true);
        if (targetDefaultRecord?.id) {
          await ctx.request({
            url: 'target_default:update',
            method: 'post',
            params: { filterByTk: targetDefaultRecord.id },
            data: payload,
          });
        } else {
          await ctx.request({
            url: 'target_default:create',
            method: 'post',
            data: withCreateTimestamps({ ...payload, country_asin: currentCountryAsin, country: filterCountry, asin: filterAsin }),
          });
        }
        await loadTargetDefault();
        await loadData({ page: curPageRef.current, size: pageSizeRef.current });
        ctx.message.success('目标值已保存，当前表格已刷新');
      } catch (err) {
        ctx.message.error(`保存目标值失败：${err?.message || '未知错误'}`);
      } finally {
        setTargetManagerSaving(false);
      }
    }, [currentCountryAsin, filterAsin, filterCountry, loadData, loadTargetDefault, targetAdCvrDraft, targetAdSpendRateDraft, targetCpaDraft, targetDefaultRecord, targetIdealCpuDraft, targetProfitMarginDraft]);

    const loadManagerItems = useCallback(async (type) => {
      if (!currentCountryAsin) {
        setManagerItems([]);
        setLockedSqpDefaultNames(new Set());
        return;
      }
      setManagerLoading(true);
      try {
        const url = type === 'root' ? 'sqp_roots:list' : (type === 'keyword' ? 'sqp_keywords:list' : 'order_link_competitor_asins:list');
        const res = await ctx.request({
          url,
          method: 'get',
          params: {
            pageSize: 500,
            sort: type === 'competitor' ? ['role', 'competitor_asin'] : ['id'],
            filter: JSON.stringify({ country_asin: { $eq: currentCountryAsin } }),
          },
        });
        setManagerItems(Array.isArray(res?.data?.data) ? res.data.data : []);
        if (type !== 'keyword' && type !== 'root') {
          setLockedSqpDefaultNames(new Set());
          return;
        }
        let modelName = String(filterModel || '').trim();
        if (!modelName && filterCountry && filterAsin) {
          const asinRows = await fetchAllList('asin:list', {
            filter: JSON.stringify({ $and: [
              { country: { $eq: filterCountry } },
              { asin: { $eq: filterAsin } },
            ] }),
          }, 1).catch(() => []);
          modelName = String(asinRows?.[0]?.model || '').trim();
        }
        if (!modelName || !filterCountry) {
          setLockedSqpDefaultNames(new Set());
          return;
        }
        const skuRows = await fetchAllList('sku:list', {
          filter: JSON.stringify({ $and: [
            { country: { $eq: filterCountry } },
            { model: { $eq: modelName } },
          ] }),
        }, 1).catch(() => []);
        const categoryName = String(skuRows?.[0]?.type || '').trim();
        if (!categoryName) {
          setLockedSqpDefaultNames(new Set());
          return;
        }
        const defaultRows = await fetchAllList('sqp_default_terms:list', {
          sort: 'id',
          filter: JSON.stringify({ $and: [
            { country: { $eq: filterCountry } },
            { category: { $eq: categoryName } },
            { term_type: { $eq: type } },
          ] }),
        }, 500).catch(() => []);
        setLockedSqpDefaultNames(new Set(
          defaultRows
            .map((row) => normalizeSearchText(row?.term_name))
            .filter(Boolean)
        ));
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || '未知错误'}`);
        setManagerItems([]);
        setLockedSqpDefaultNames(new Set());
      } finally {
        setManagerLoading(false);
      }
    }, [currentCountryAsin, fetchAllList, filterAsin, filterCountry, filterModel]);

    const openKeywordManager = useCallback(() => {
      setKeywordManagerVisible(true);
      setKeywordDraft('');
      loadManagerItems(keywordTab);
    }, [keywordTab, loadManagerItems]);

    const openCompetitorManager = useCallback(() => {
      setCompetitorManagerVisible(true);
      setCompetitorDraft('');
      setCompetitorNoteDraft('');
      loadManagerItems('competitor');
    }, [loadManagerItems]);

    const refreshAfterManagerChange = useCallback(async (type) => {
      await loadManagerItems(type);
      await loadData({ page: curPageRef.current, size: pageSizeRef.current });
    }, [loadData, loadManagerItems]);

    const markDynamicColumnsVisible = useCallback((keys) => {
      const list = (Array.isArray(keys) ? keys : [keys]).filter(Boolean);
      if (!list.length) return;
      setDynamicColumnPrefs((prev) => {
        const next = { ...prev };
        list.forEach((key) => {
          next[key] = { ...(next[key] || {}), key, hidden: false };
        });
        return next;
      });
    }, []);

    const getSqpManagerMeta = useCallback(() => {
      const isKeyword = keywordTab === 'keyword';
      return {
        collection: isKeyword ? 'sqp_keywords' : 'sqp_roots',
        nameField: isKeyword ? 'keyword_name' : 'root_name',
        title: isKeyword ? '关键词' : '词根',
      };
    }, [keywordTab]);

    const isLockedSqpDefaultTerm = useCallback((item) => {
      const meta = getSqpManagerMeta();
      return lockedSqpDefaultNames.has(normalizeSearchText(item?.[meta.nameField]));
    }, [getSqpManagerMeta, lockedSqpDefaultNames]);

    const addKeyword = useCallback(async () => {
      const keyword = String(keywordDraft || '').trim();
      if (!currentCountryAsin || !keyword) return;
      const meta = getSqpManagerMeta();
      try {
        setManagerSaving(true);
        const res = await ctx.request({ url: `${meta.collection}:create`, method: 'post', data: withCreateTimestamps({ country_asin: currentCountryAsin, country: filterCountry, asin: filterAsin, [meta.nameField]: keyword }) });
        const createdId = res?.data?.data?.id;
        if (createdId && meta.collection === 'sqp_keywords') markDynamicColumnsVisible(`kw_actual_${createdId}`);
        setKeywordDraft('');
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success('新增成功');
      } finally {
        setManagerSaving(false);
      }
    }, [currentCountryAsin, filterAsin, filterCountry, getSqpManagerMeta, keywordDraft, keywordTab, markDynamicColumnsVisible, refreshAfterManagerChange]);

    const updateKeyword = useCallback(async (item, keywordName) => {
      const meta = getSqpManagerMeta();
      if (isLockedSqpDefaultTerm(item)) {
        ctx.message.warning(`默认${meta.title}不能编辑`);
        return;
      }
      try {
        setManagerSaving(true);
        await ctx.request({ url: `${meta.collection}:update`, method: 'post', params: { filterByTk: item.id }, data: { [meta.nameField]: keywordName || null } });
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success('已保存');
      } finally {
        setManagerSaving(false);
      }
    }, [getSqpManagerMeta, isLockedSqpDefaultTerm, keywordTab, refreshAfterManagerChange]);

    const deleteKeyword = useCallback(async (item) => {
      const meta = getSqpManagerMeta();
      if (isLockedSqpDefaultTerm(item)) {
        ctx.message.warning(`默认${meta.title}不能删除`);
        return;
      }
      try {
        setManagerSaving(true);
        await ctx.request({ url: `${meta.collection}:destroy`, method: 'post', params: { filterByTk: item.id } });
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success(`已删除${meta.title}`);
      } finally {
        setManagerSaving(false);
      }
    }, [getSqpManagerMeta, isLockedSqpDefaultTerm, keywordTab, refreshAfterManagerChange]);

    const addCompetitor = useCallback(async () => {
      const sorted = [...managerItems].sort((a, b) => getCompetitorRoleIndex(a.role) - getCompetitorRoleIndex(b.role));
      const maxIdx = sorted.reduce((max, rec) => {
        const idx = getCompetitorRoleIndex(rec.role);
        return Number.isFinite(idx) && idx !== 9999 ? Math.max(max, idx) : max;
      }, 0);
      const role = `竞对${maxIdx + 1}`;
      const competitorAsin = String(competitorDraft || '').trim();
      const competitorNote = String(competitorNoteDraft || '').trim();
      if (!currentCountryAsin || !competitorAsin) return;
      try {
        setManagerSaving(true);
        const res = await ctx.request({ url: 'order_link_competitor_asins:create', method: 'post', data: withCreateTimestamps({ country_asin: currentCountryAsin, country: filterCountry, asin: filterAsin, role, competitor_asin: competitorAsin, notes: competitorNote || null }) });
        const createdId = res?.data?.data?.id;
        if (createdId) markDynamicColumnsVisible(`competitor_dynamic_${createdId}`);
        setCompetitorDraft('');
        setCompetitorNoteDraft('');
        await refreshAfterManagerChange('competitor');
        ctx.message.success(`${role} 已添加`);
      } finally {
        setManagerSaving(false);
      }
    }, [competitorDraft, competitorNoteDraft, currentCountryAsin, filterAsin, filterCountry, managerItems, markDynamicColumnsVisible, refreshAfterManagerChange]);

    const updateCompetitor = useCallback(async (item, value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      try {
        setManagerSaving(true);
        await ctx.request({ url: 'order_link_competitor_asins:update', method: 'post', params: { filterByTk: item.id }, data: { competitor_asin: trimmed } });
        await refreshAfterManagerChange('competitor');
        ctx.message.success('已保存');
      } finally {
        setManagerSaving(false);
      }
    }, [refreshAfterManagerChange]);

    const updateCompetitorNote = useCallback(async (item, value) => {
      const trimmed = String(value || '').trim();
      try {
        setManagerSaving(true);
        await ctx.request({ url: 'order_link_competitor_asins:update', method: 'post', params: { filterByTk: item.id }, data: { notes: trimmed || null } });
        await refreshAfterManagerChange('competitor');
        ctx.message.success('备注已保存');
      } finally {
        setManagerSaving(false);
      }
    }, [refreshAfterManagerChange]);

    const deleteCompetitor = useCallback(async (item) => {
      try {
        setManagerSaving(true);
        let deletedDailyRows = 0;
        while (true) {
          const dailyRes = await ctx.request({
            url: 'order_link_competitor_asins_daily:list',
            method: 'get',
            params: { pageSize: 200, filter: JSON.stringify({ competitor_id: { $eq: item.id } }) },
          });
          const dailyRows = Array.isArray(dailyRes?.data?.data) ? dailyRes.data.data : [];
          if (!dailyRows.length) break;
          for (const row of dailyRows) {
            await ctx.request({ url: 'order_link_competitor_asins_daily:destroy', method: 'post', params: { filterByTk: row.id } });
            deletedDailyRows += 1;
          }
        }
        await ctx.request({ url: 'order_link_competitor_asins:destroy', method: 'post', params: { filterByTk: item.id } });
        await refreshAfterManagerChange('competitor');
        ctx.message.success(`已删除竞对，并清理 ${deletedDailyRows} 条每日记录`);
      } finally {
        setManagerSaving(false);
      }
    }, [refreshAfterManagerChange]);

    useEffect(() => {
      if (keywordManagerVisible) {
        setKeywordDraft('');
        loadManagerItems(keywordTab);
      }
    }, [keywordManagerVisible, keywordTab, loadManagerItems]);

    // 排序
    const handleSort = useCallback((colKey) => {
      setSortConfig((prev) => {
        if (prev.key !== colKey) return { key: colKey, dir: 'asc' };
        if (prev.dir === 'asc') return { key: colKey, dir: 'desc' };
        return { key: null, dir: null };
      });
      setCurPage(1);
    }, []);

    const getSortedRows = useCallback((rows) => {
      if (!sortConfig.key || !Array.isArray(rows) || !rows.length) return rows;
      const col   = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key)
        || dynamicKeywordCols.find((c) => c.key === sortConfig.key)
        || dynamicCompetitorCols.find((c) => c.key === sortConfig.key);
      const field = col ? col.field : sortConfig.key;
      return [...rows].sort((a, b) => {
        let va = col?._dynamicKind ? formatCell(col, a) : getCellValue(col, a);
        let vb = col?._dynamicKind ? formatCell(col, b) : getCellValue(col, b);
        if (field === 'promo_day') {
          va = Number(va) || 0; vb = Number(vb) || 0;
          return sortConfig.dir === 'asc' ? va - vb : vb - va;
        }
        if (ALL_NUMERIC.has(field)) {
          va = Number(va) || 0; vb = Number(vb) || 0;
          return sortConfig.dir === 'asc' ? va - vb : vb - va;
        }
        if (DATE_FIELDS.has(field)) {
          const ta = va ? new Date(va).getTime() : 0;
          const tb = vb ? new Date(vb).getTime() : 0;
          return sortConfig.dir === 'asc' ? ta - tb : tb - ta;
        }
        const cmp = String(va || '').localeCompare(String(vb || ''));
        return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }, [sortConfig, dynamicKeywordCols, dynamicCompetitorCols]);

    const pagedData = useMemo(() => {
      if (!Array.isArray(data) || !data.length) return data;
      const sortCol = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key)
        || dynamicKeywordCols.find((c) => c.key === sortConfig.key)
        || dynamicCompetitorCols.find((c) => c.key === sortConfig.key);
      const sortField = sortCol ? sortCol.field : sortConfig.key;
      const shouldShowWeeklySummary = !sortConfig.key || DATE_FIELDS.has(sortField);
      if (!shouldShowWeeklySummary) return getSortedRows(data);
      const groups = groupRowsByNaturalWeek(data);
      const orderedGroups = Object.values(groups).sort((a, b) => {
        const aStart = a?.range?.start || '';
        const bStart = b?.range?.start || '';
        return sortConfig.dir === 'desc' ? bStart.localeCompare(aStart) : aStart.localeCompare(bStart);
      });
      const result = [];
      orderedGroups.forEach((group) => {
        const sortedRows = getSortedRows(group.rows || []);
        sortedRows.forEach((row) => result.push(row));
        const summaryKey = group.key;
        const summaryRow = weeklySummaryMap[summaryKey];
        if (summaryRow) result.push(summaryRow);
      });
      return result;
    }, [data, sortConfig, dynamicKeywordCols, dynamicCompetitorCols, getSortedRows, weeklySummaryMap]);

    // 总数变化时防止页码超出
    useEffect(() => {
      const maxPage = Math.max(1, Math.ceil(total / pageSize));
      if (curPage > maxPage) setCurPage(1);
    }, [total, pageSize, curPage]);

    const getColumnGroupKey = (col) => col?.columnGroup || col?.src || 'other';
    const columnGroupMetaMap = useMemo(() => Object.fromEntries(SRC_GROUP_CONFIG.map((group) => [group.src, group])), []);
    const orderColumnsByGroup = useCallback((cols, groupOrder) => {
      if (!Array.isArray(groupOrder) || !groupOrder.length) return cols;
      const buckets = {};
      const currentOrder = [];
      cols.forEach((col) => {
        const groupKey = getColumnGroupKey(col);
        if (!buckets[groupKey]) {
          buckets[groupKey] = [];
          currentOrder.push(groupKey);
        }
        buckets[groupKey].push(col);
      });
      const orderedKeys = [
        ...groupOrder.filter((groupKey) => buckets[groupKey]),
        ...currentOrder.filter((groupKey) => !groupOrder.includes(groupKey)),
      ];
      return orderedKeys.flatMap((groupKey) => buckets[groupKey] || []);
    }, []);
    const allColumns = useMemo(() => {
      const keywordCols = dynamicKeywordCols.map(applyDynamicColPrefs);
      const competitorCols = dynamicCompetitorCols.map(applyDynamicColPrefs);
      const baseColumns = normalizeColumnsByGroup(columns);
      const insertCompetitorAfter = baseColumns.findIndex((c) => c.key === 'order_link_page_screenshot');
      const withCompetitors = insertCompetitorAfter >= 0
        ? [...baseColumns.slice(0, insertCompetitorAfter + 1), ...competitorCols, ...baseColumns.slice(insertCompetitorAfter + 1)]
        : [...baseColumns, ...competitorCols];
      const insertKeywordAfter = withCompetitors.findIndex((c) => c.key === 'order_link_keyword_performance_screenshot');
      const withKeywords = insertKeywordAfter >= 0
        ? [...withCompetitors.slice(0, insertKeywordAfter + 1), ...keywordCols, ...withCompetitors.slice(insertKeywordAfter + 1)]
        : [...withCompetitors, ...keywordCols];
      return orderColumnsByGroup(withKeywords, columnGroupOrder);
    }, [columns, dynamicKeywordCols, dynamicCompetitorCols, applyDynamicColPrefs, columnGroupOrder, orderColumnsByGroup]);
    const panelGroupConfig = useMemo(() => {
      const seen = [];
      allColumns.forEach((col) => {
        const groupKey = getColumnGroupKey(col);
        if (!seen.includes(groupKey)) seen.push(groupKey);
      });
      SRC_GROUP_CONFIG.forEach((group) => {
        if (!seen.includes(group.src)) seen.push(group.src);
      });
      return seen
        .filter((groupKey) => groupKey !== 'other')
        .map((groupKey) => columnGroupMetaMap[groupKey] || { src: groupKey, label: groupKey || '辅助字段', color: COLOR_GRAY });
    }, [allColumns, columnGroupMetaMap]);

    const buildCurrentColumnViewPayload = useCallback(() => (
      buildColumnPayload(allColumns, [
        { key: COLUMN_GROUP_ORDER_KEY, order: Array.isArray(columnGroupOrder) ? columnGroupOrder.filter(Boolean) : [] },
        { key: COLUMN_PAGE_SIZE_KEY, pageSize: normalizePageSizeValue(pageSizeRef.current || pageSize) },
      ])
    ), [allColumns, columnGroupOrder, pageSize]);

    const saveCurrentCustomColumnView = useCallback(async () => {
      if (!currentUserId) return false;
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (isDefaultColumnViewId(viewId)) return false;
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const currentView = views.find((view) => view.id === viewId);
      if (!currentView) return false;
      const nextPayload = buildCurrentColumnViewPayload();
      const now = new Date().toISOString();
      const nextViews = views.map((view) => view.id === viewId ? { ...view, payload: nextPayload, updated_at: now } : view);
      setColumnViewsLocal(nextViews);
      const saved = await saveColumnViewStateToUser({ activeViewId: viewId, views: nextViews }, viewId);
      if (!saved) throw new Error('用户配置未保存');
      return true;
    }, [activeColumnViewId, buildCurrentColumnViewPayload, columnViews, setColumnViewsLocal]);

    const saveCurrentViewPageSize = useCallback(async (nextPageSizeValue) => {
      if (!currentUserId) return false;
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const currentView = views.find((view) => view.id === viewId);
      if (!currentView) return false;
      const normalizedPageSize = normalizePageSizeValue(nextPageSizeValue);
      const now = new Date().toISOString();
      const fallbackDefaultPayload = buildColumnPayload(normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true }));
      const basePayload = isDefaultColumnViewId(viewId)
        ? (Array.isArray(currentView.payload) && currentView.payload.length ? currentView.payload : fallbackDefaultPayload)
        : buildCurrentColumnViewPayload();
      const nextPayload = upsertColumnPayloadPageSize(basePayload, normalizedPageSize);
      const nextViews = views.map((view) => view.id === viewId ? { ...view, payload: nextPayload, updated_at: now } : view);
      setColumnViewsLocal(nextViews);
      const saved = isDefaultColumnViewId(viewId)
        ? await saveDefaultColumnViewPayloadToCurrentUser(viewId, nextPayload, getViewLabel(currentView))
        : await saveColumnViewStateToUser({ activeViewId: viewId, views: nextViews }, viewId);
      if (!saved) throw new Error('页数配置未保存');
      return true;
    }, [activeColumnViewId, buildCurrentColumnViewPayload, columnViews, setColumnViewsLocal]);

    const onPageChange = useCallback((page, size) => {
      const nextSize = normalizePageSizeValue(size);
      if (nextSize !== pageSizeRef.current) {
        setCurPage(1);
        curPageRef.current = 1;
        pageSizeRef.current = nextSize;
        setPageSize(nextSize);
        saveCurrentViewPageSize(nextSize).catch((err) => {
          ctx.message.warning(`页数配置保存失败：${err?.message || '未知错误'}`);
        });
        loadData({ page: 1, size: nextSize, skipFormula: true });
      } else {
        setCurPage(page);
        curPageRef.current = page;
        loadData({ page, size: nextSize, skipFormula: true });
      }
    }, [loadData, saveCurrentViewPageSize]);

    const saveCurrentDefaultColumnView = useCallback(async () => {
      if (!IS_ADMIN) return;
      if (columnViewSaving || columnViewSwitching) return;
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (!isDefaultColumnViewId(viewId)) {
        ctx.message.warning('只有完整列和核心列可以保存为默认视图');
        return;
      }
      setColumnViewSaving(true);
      try {
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const currentView = views.find((view) => view.id === viewId);
        const nextPayload = buildCurrentColumnViewPayload();
        const saved = await saveDefaultColumnViewToCurrentUser(viewId, nextPayload, getViewLabel(currentView));
        if (!saved) throw new Error('默认视图配置未保存');
        const now = new Date().toISOString();
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(nextPayload);
        const nextViews = syncHeaderColorsIntoColumnViews(
          views.map((view) => view.id === viewId ? { ...view, payload: nextPayload, updated_at: now } : view),
          sourceHeaderColorMap,
          now
        );
        setColumnViewsLocal(nextViews);
        ctx.message.success(`${getViewLabel(currentView)}默认视图已保存`);
      } catch (err) {
        ctx.message.error(`保存默认视图失败：${err?.message || '未知错误'}`);
      } finally {
        setColumnViewSaving(false);
      }
    }, [activeColumnViewId, buildCurrentColumnViewPayload, columnViewSaving, columnViewSwitching, columnViews, setColumnViewsLocal]);

    useEffect(() => {
      const pendingViewId = pendingColumnLayoutViewIdRef.current;
      const activeViewIdNow = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (!pendingViewId || pendingViewId !== activeViewIdNow || isDefaultColumnViewId(activeViewIdNow)) return;
      if (!currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching) return;
      if (columnLayoutSaveTimerRef.current) window.clearTimeout(columnLayoutSaveTimerRef.current);
      columnLayoutSaveTimerRef.current = window.setTimeout(async () => {
        const timerViewId = pendingColumnLayoutViewIdRef.current;
        columnLayoutSaveTimerRef.current = null;
        if (!timerViewId || timerViewId !== normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId)) return;
        if (isDefaultColumnViewId(timerViewId)) return;
        pendingColumnLayoutViewIdRef.current = null;
        try {
          await saveCurrentCustomColumnView();
        } catch (err) {
          pendingColumnLayoutViewIdRef.current = timerViewId;
          ctx.message.error(`自定义视图配置自动保存失败：${err?.message || '未知错误'}`);
        }
      }, 700);
      return () => {
        if (columnLayoutSaveTimerRef.current) {
          window.clearTimeout(columnLayoutSaveTimerRef.current);
          columnLayoutSaveTimerRef.current = null;
        }
      };
    }, [activeColumnViewId, columnViewCreating, columnViewSaving, columnViewSwitching, currentUserId, saveCurrentCustomColumnView]);

    const saveCurrentAsDefaultColumns = useCallback(async (targetUserIds = null) => {
      if (!IS_ADMIN) return;
      try {
        const now = new Date().toISOString();
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const currentPayload = buildCurrentColumnViewPayload();
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(currentPayload);
        const defaultViews = syncHeaderColorsIntoColumnViews(DEFAULT_COLUMN_VIEW_IDS.map((id) => {
          const savedView = views.find((view) => view.id === id);
          return {
            id,
            name: getViewLabel(savedView) || DEFAULT_COLUMN_VIEW_LABELS[id],
            type: 'default',
            payload: id === activeColumnViewId
              ? currentPayload
              : (Array.isArray(savedView?.payload) && savedView.payload.length
                ? savedView.payload
                : buildColumnPayload(normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true }))),
            updated_at: now,
          };
        }), sourceHeaderColorMap, now);
        const defaultViewMap = Object.fromEntries(defaultViews.map((view) => [view.id, view]));
        setColumnViewsLocal(syncHeaderColorsIntoColumnViews(
          views.map((view) => isDefaultColumnViewId(view?.id) && defaultViewMap[view.id] ? defaultViewMap[view.id] : view),
          sourceHeaderColorMap,
          now
        ));
        const result = await saveDefaultColumnViewsToAllUsers(defaultViews, targetUserIds, { syncCustomHeaderColorsFromViewId: activeColumnViewId });
        if (result.ok) {
          ctx.message.success(`已同步默认视图和自定义视图列头颜色、重要指标标记给 ${result.total} 位用户`);
        } else if (!result.total) {
          ctx.message.warning('未选择到有效推送用户');
        } else {
          ctx.message.warning(`默认视图已部分同步，失败 ${result.failCount}/${result.total} 位用户`);
        }
        return result;
      } catch (err) {
        ctx.message.error(`推送默认视图失败：${err?.message || '未知错误'}`);
        return { ok: false, total: 0, failCount: 0 };
      }
    }, [activeColumnViewId, buildCurrentColumnViewPayload, columnViews, setColumnViewsLocal]);

    const restoreDefaultColumns = useCallback(async () => {
      if (!isDefaultColumnViewId(activeColumnViewId)) {
        ctx.message.warning('自定义视图没有全员默认配置，可切换到默认视图后恢复');
        return;
      }
      if (!currentUserId) {
        setColumns(INITIAL_COLUMNS.map((c) => ({ ...c })));
        setDynamicColumnPrefs({});
        return;
      }
      try {
        const state = await loadColumnViewStateFromUser();
        const defaultView = state.defaultViews.find((view) => view.id === activeColumnViewId) || state.defaultViews[0];
        const defaultPayload = Array.isArray(defaultView?.payload) ? defaultView.payload : [];
        const nextViews = state.views.map((view) => view.id === activeColumnViewId ? { ...view, name: defaultView?.name || view.name, payload: defaultPayload, updated_at: new Date().toISOString() } : view);
        const nextState = { ...state, views: nextViews };
        await saveColumnViewStateToUser(nextState, activeColumnViewId);
        setColumnViewsLocal(nextState.views);
        const applyResult = applyColumnPayloadToLocal(defaultPayload);
        if (applyResult?.pageSizeChanged) {
          await loadData({ page: 1, size: applyResult.pageSize, skipFormula: true });
        }
        ctx.message.success(`已恢复${getViewLabel(defaultView)}默认列配置`);
      } catch (err) {
        ctx.message.error(`恢复默认配置失败：${err?.message || '未知错误'}`);
      }
    }, [activeColumnViewId, applyColumnPayloadToLocal, loadData, setColumnViewsLocal]);

    const switchColumnView = useCallback(async (viewId) => {
      const nextViewId = normalizeColumnViewId(viewId);
      if (nextViewId === activeColumnViewId || columnViewSwitching) return;
      const seq = columnViewSwitchSeqRef.current + 1;
      columnViewSwitchSeqRef.current = seq;
      setColumnViewSwitching(true);
      try {
        const pendingViewId = pendingColumnLayoutViewIdRef.current;
        const currentViewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
        if (pendingViewId && pendingViewId === currentViewId && !isDefaultColumnViewId(currentViewId)) {
          if (columnLayoutSaveTimerRef.current) {
            window.clearTimeout(columnLayoutSaveTimerRef.current);
            columnLayoutSaveTimerRef.current = null;
          }
          pendingColumnLayoutViewIdRef.current = null;
          await saveCurrentCustomColumnView();
        }
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const view = views.find((item) => item.id === nextViewId) || views[0];
        const payload = Array.isArray(view?.payload) && view.payload.length ? view.payload : null;
        setActiveColumnViewLocal(nextViewId);
        const applyResult = applyColumnPayloadToLocal(payload);
        saveActiveColumnViewToUser(nextViewId).catch(() => {});
        if (applyResult?.pageSizeChanged) {
          await loadData({ page: 1, size: applyResult.pageSize, skipFormula: true });
        }
      } catch (err) {
        ctx.message.error(`切换视图失败：${err?.message || '未知错误'}`);
      } finally {
        if (seq === columnViewSwitchSeqRef.current) setColumnViewSwitching(false);
      }
    }, [activeColumnViewId, applyColumnPayloadToLocal, columnViewSwitching, columnViews, loadData, saveCurrentCustomColumnView, setActiveColumnViewLocal]);

    const renameColumnView = useCallback((viewIdArg = null) => {
      if (!currentUserId) {
        ctx.message.warning('未识别到当前用户，无法重命名视图');
        return;
      }
      if (columnViewSaving || columnViewSwitching) return;
      const currentViewId = normalizeColumnViewId(viewIdArg || activeColumnViewIdRef.current || activeColumnViewId);
      if (!canModifyColumnView(currentViewId)) {
        warnReadonlyDefaultView();
        return;
      }
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const activeView = views.find((view) => view.id === currentViewId);
      let nextName = getViewLabel(activeView);
      Modal.confirm({
        title: '重命名视图',
        content: React.createElement(Input, {
          defaultValue: nextName,
          autoFocus: true,
          placeholder: '请输入视图名称',
          onChange: (e) => { nextName = e.target.value; },
          onPressEnter: (e) => {
            e.currentTarget?.blur?.();
          },
        }),
        okText: '保存',
        cancelText: '取消',
        onOk: async () => {
          const name = String(nextName || '').trim();
          if (!name) {
            ctx.message.warning('请先输入视图名称');
            return Promise.reject(new Error('视图名称为空'));
          }
          try {
            setColumnViewSaving(true);
            const now = new Date().toISOString();
            const nextViews = views.map((view) => view.id === currentViewId ? { ...view, name, updated_at: now } : view);
            const saved = await saveColumnViewStateToUser({ activeViewId: currentViewId, views: nextViews }, currentViewId);
            if (!saved) throw new Error('用户配置未保存');
            setColumnViewsLocal(nextViews);
            ctx.message.success('视图名称已保存');
          } catch (err) {
            ctx.message.error(`重命名视图失败：${err?.message || '未知错误'}`);
            return Promise.reject(err);
          } finally {
            setColumnViewSaving(false);
          }
        },
      });
    }, [activeColumnViewId, canModifyColumnView, columnViewSaving, columnViewSwitching, columnViews, setColumnViewsLocal, warnReadonlyDefaultView]);

    const createColumnViewFromCurrent = useCallback((nameArg = null) => {
      if (!currentUserId) {
        ctx.message.warning('未识别到当前用户，无法新增视图');
        return;
      }
      if (columnViewCreating || columnViewSwitching) return;
      const doCreate = async (rawName) => {
        const name = String(rawName || '').trim();
        if (!name) {
          ctx.message.warning('请先输入视图名称');
          return false;
        }
        setColumnViewCreating(true);
        try {
        const currentViewId = activeColumnViewIdRef.current || activeColumnViewId;
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const now = new Date().toISOString();
        const id = `custom_${Date.now()}`;
        const usedNames = new Set(views.map((view) => getViewLabel(view)));
        let finalName = name;
        let idx = 2;
        while (usedNames.has(finalName)) {
          finalName = `${name}${idx}`;
          idx += 1;
        }
        const payload = buildCurrentColumnViewPayload();
        const nextView = { id, name: finalName, type: 'custom', payload, updated_at: now };
        const nextViews = [...views, nextView];
        const saved = await saveColumnViewStateToUser({ activeViewId: id, views: nextViews }, id);
        if (!saved) throw new Error('用户配置未保存');
        columnViewSwitchSeqRef.current += 1;
        setColumnViewsLocal(nextViews);
        setActiveColumnViewLocal(id);
        applyColumnPayloadToLocal(nextView.payload);
        ctx.message.success(`视图「${finalName}」已创建`);
        return true;
        } catch (err) {
          ctx.message.error(`新增视图失败：${err?.message || '未知错误'}`);
          return false;
        } finally {
          setColumnViewCreating(false);
        }
      };
      if (String(nameArg || '').trim()) {
        doCreate(nameArg);
        return;
      }
      let nextName = '';
      Modal.confirm({
        title: '复制并保存视图',
        content: React.createElement(Input, {
          autoFocus: true,
          placeholder: '请输入视图名称',
          onChange: (e) => { nextName = e.target.value; },
          onPressEnter: (e) => e.currentTarget?.blur?.(),
        }),
        okText: '复制并保存',
        cancelText: '取消',
        onOk: async () => {
          const created = await doCreate(nextName);
          if (!created) return Promise.reject(new Error('视图未创建'));
        },
      });
    }, [activeColumnViewId, applyColumnPayloadToLocal, buildCurrentColumnViewPayload, columnViewCreating, columnViewSwitching, columnViews, setActiveColumnViewLocal, setColumnViewsLocal]);

    const deleteColumnView = useCallback(async (viewIdArg = null) => {
      if (!currentUserId) {
        ctx.message.warning('未识别到当前用户，无法删除视图');
        return;
      }
      const currentViewId = normalizeColumnViewId(viewIdArg || activeColumnViewIdRef.current || activeColumnViewId);
      if (isDefaultColumnViewId(currentViewId)) {
        ctx.message.warning('默认视图不能删除，只能删除自定义视图');
        return;
      }
      if (columnViewCreating || columnViewSwitching) return;
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const activeView = views.find((view) => view.id === currentViewId);
      Modal.confirm({
        title: `确定删除「${getViewLabel(activeView)}」吗？`,
        okText: '删除',
        okType: 'danger',
        cancelText: '取消',
        onOk: async () => {
          try {
            setColumnViewCreating(true);
            const nextActiveViewId = DEFAULT_COLUMN_VIEW_IDS[0];
            const nextViews = views.filter((view) => view.id !== currentViewId);
            const saved = await saveColumnViewStateToUser({ activeViewId: nextActiveViewId, views: nextViews }, nextActiveViewId);
            if (!saved) throw new Error('用户配置未保存');
            const nextActiveView = nextViews.find((view) => view.id === nextActiveViewId) || nextViews[0];
            setColumnViewsLocal(nextViews);
            setActiveColumnViewLocal(nextActiveViewId);
            const applyResult = applyColumnPayloadToLocal(nextActiveView?.payload);
            if (applyResult?.pageSizeChanged) {
              await loadData({ page: 1, size: applyResult.pageSize, skipFormula: true });
            }
            ctx.message.success('视图已删除');
          } catch (err) {
            ctx.message.error(`删除视图失败：${err?.message || '未知错误'}`);
            return Promise.reject(err);
          } finally {
            setColumnViewCreating(false);
          }
        },
      });
    }, [activeColumnViewId, applyColumnPayloadToLocal, columnViewCreating, columnViewSwitching, columnViews, loadData, setActiveColumnViewLocal, setColumnViewsLocal]);

    const persistDynamicColPrefs = useCallback((key, patch) => {
      if (!isDynamicColumnKey(key)) return;
      setDynamicColumnPrefs((prev) => {
        const next = { ...prev, [key]: { ...(prev[key] || {}), key, ...patch } };
        return next;
      });
    }, []);

    const updateDynamicCol = (key, updater) => {
      const setFn = key.startsWith('kw_actual_') ? setDynamicKeywordCols : key.startsWith('competitor_dynamic_') ? setDynamicCompetitorCols : null;
      if (!setFn) return false;
      setFn((prev) => prev.map((c) => c.key === key ? updater(c) : c));
      return true;
    };

    const ensureColumnViewEditable = () => {
      markColumnLayoutChanged();
      return true;
    };
    const toggleCol      = (key) => { if (!ensureColumnViewEditable()) return; const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, hidden: !c.hidden }))) { persistDynamicColPrefs(key, { hidden: !(cur?.hidden === true), width: cur?.width, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null, bodyColor: getColBodyColor(cur) }); return; } updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => c.key === key ? { ...c, hidden: !c.hidden } : c))); };
    const togglePin      = (key) => { if (!ensureColumnViewEditable()) return; const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, pinned: !c.pinned }))) { persistDynamicColPrefs(key, { pinned: !(cur?.pinned === true), width: cur?.width, hidden: cur?.hidden === true, headerColor: cur?.headerColor || null, bodyColor: getColBodyColor(cur) }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c)); };
    const setHColor      = (key, color) => { if (!ensureColumnViewEditable()) return; const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, headerColor: color }))) { persistDynamicColPrefs(key, { headerColor: color, bodyColor: getColBodyColor(cur), width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c)); };
    const clearHColor    = (key) => { if (!ensureColumnViewEditable()) return; const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, headerColor: null }))) { persistDynamicColPrefs(key, { headerColor: null, bodyColor: getColBodyColor(cur), width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c)); };
    const toggleEditable = (key) => { if (!ensureColumnViewEditable()) return; updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c)); };
    const toggleRichEdit = (key) => { if (!ensureColumnViewEditable()) return; const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, richEdit: c.richEdit !== true }))) { persistDynamicColPrefs(key, { richEdit: !(cur?.richEdit === true), width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null, bodyColor: getColBodyColor(cur) }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, richEdit: !c.richEdit } : c)); };
    const toggleImportantColumn = (key) => {
      if (!ensureColumnViewEditable()) return;
      const cur = allColumns.find((c) => c.key === key);
      const nextBodyColor = getColBodyColor(cur) ? null : IMPORTANT_COLUMN_BODY_COLOR;
      if (updateDynamicCol(key, (c) => ({ ...c, bodyColor: nextBodyColor }))) {
        persistDynamicColPrefs(key, { bodyColor: nextBodyColor, width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null, richEdit: cur?.richEdit === true });
        return;
      }
      updateAndSave((p) => p.map((c) => c.key === key ? { ...c, bodyColor: nextBodyColor } : c));
    };
    const setDynamicHiddenBySrc = (src, hidden) => {
      const updateSet = (setFn) => setFn((prev) => prev.map((c) => {
        if (c.src !== src) return c;
        persistDynamicColPrefs(c.key, { hidden, width: c.width, pinned: c.pinned === true, headerColor: c.headerColor || null, bodyColor: getColBodyColor(c) });
        return { ...c, hidden };
      }));
      updateSet(setDynamicKeywordCols);
      updateSet(setDynamicCompetitorCols);
    };
    const setDynamicHiddenByGroup = (groupKey, hidden) => {
      const updateSet = (setFn) => setFn((prev) => prev.map((c) => {
        if (getColumnGroupKey(c) !== groupKey) return c;
        persistDynamicColPrefs(c.key, { hidden, width: c.width, pinned: c.pinned === true, headerColor: c.headerColor || null, bodyColor: getColBodyColor(c), richEdit: c.richEdit === true });
        return { ...c, hidden };
      }));
      updateSet(setDynamicKeywordCols);
      updateSet(setDynamicCompetitorCols);
    };
    const selectAll      = () => { if (!ensureColumnViewEditable()) return; updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => ({ ...c, hidden: false })))); setDynamicHiddenBySrc('keyword_position', false); setDynamicHiddenBySrc('competitor', false); };
    const deselectAll    = () => { if (!ensureColumnViewEditable()) return; updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => ({ ...c, hidden: true  })))); setDynamicHiddenBySrc('keyword_position', true); setDynamicHiddenBySrc('competitor', true); };
    const selectGroup    = (src) => { if (!ensureColumnViewEditable()) return; if (src === 'keyword_position' || src === 'competitor') { setDynamicHiddenBySrc(src, false); return; } setDynamicHiddenByGroup(src, false); updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => getColumnGroupKey(c) === src ? { ...c, hidden: false } : c))); };
    const deselectGroup  = (src) => { if (!ensureColumnViewEditable()) return; if (src === 'keyword_position' || src === 'competitor') { setDynamicHiddenBySrc(src, true); return; } setDynamicHiddenByGroup(src, true); updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => getColumnGroupKey(c) === src ? { ...c, hidden: true  } : c))); };
    const moveColumnGroup = (src, direction) => {
      if (!ensureColumnViewEditable()) return;
      const order = [];
      allColumns.forEach((col) => {
        const groupKey = getColumnGroupKey(col);
        if (!order.includes(groupKey)) order.push(groupKey);
      });
      const idx = order.indexOf(src);
      const nextIdx = idx + direction;
      if (idx < 0 || nextIdx < 0 || nextIdx >= order.length) return;
      const nextOrder = [...order];
      [nextOrder[idx], nextOrder[nextIdx]] = [nextOrder[nextIdx], nextOrder[idx]];
      setColumnGroupOrder(nextOrder);
    };

    const visibleCols   = useMemo(() => { const vis = allColumns.filter((c) => !c.hidden); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [allColumns]);
    const hasCompetitorColumns = useMemo(() => visibleCols.some((c) => c._isCompetitorSubColumn), [visibleCols]);
    const weeklyMergedCellMap = useMemo(() => {
      const map = {};
      if (!Array.isArray(pagedData) || !pagedData.length) return map;
      const mergeCols = visibleCols.filter((col) => MERGED_WEEKLY_DISPLAY_FIELDS.has(col.field));
      if (!mergeCols.length) return map;
      let idx = 0;
      while (idx < pagedData.length) {
        const row = pagedData[idx];
        if (!row || row.__rowType === WEEKLY_SUMMARY_ROW_TYPE) {
          idx += 1;
          continue;
        }
        const summaryKey = getSummaryKeyForRow(row);
        if (!summaryKey) {
          idx += 1;
          continue;
        }
        let end = idx + 1;
        while (end < pagedData.length) {
          const next = pagedData[end];
          if (!next || next.__rowType === WEEKLY_SUMMARY_ROW_TYPE) break;
          if (getSummaryKeyForRow(next) !== summaryKey) break;
          end += 1;
        }
        const rowSpan = end - idx;
        for (let pos = idx; pos < end; pos += 1) {
          const item = pagedData[pos];
          const itemId = item?.country_asin_date || item?.id;
          if (!itemId) continue;
          map[itemId] = map[itemId] || {};
          mergeCols.forEach((col) => {
            map[itemId][col.key] = { rowSpan: pos === idx ? rowSpan : 0 };
          });
        }
        idx = end;
      }
      return map;
    }, [pagedData, visibleCols, getSummaryKeyForRow]);
    const HEADER_GROUP_HEIGHT = 28;
    const HEADER_MAIN_HEIGHT = 26;
    const HEADER_SUB_HEIGHT = 20;
    const TABLE_BODY_ROW_HEIGHT = 66;
    const TABLE_MIN_VISIBLE_ROWS = 8;
    const TABLE_MAX_VISIBLE_ROWS = 20;
    const tableHeaderHeight = HEADER_GROUP_HEIGHT + HEADER_MAIN_HEIGHT + (hasCompetitorColumns ? HEADER_SUB_HEIGHT : 0) + 2;
    const tableWrapMinHeight = tableHeaderHeight + TABLE_BODY_ROW_HEIGHT * TABLE_MIN_VISIBLE_ROWS;
    const tableWrapMaxHeight = tableHeaderHeight + TABLE_BODY_ROW_HEIGHT * TABLE_MAX_VISIBLE_ROWS;
    const tableWrapHeight = `clamp(${tableWrapMinHeight}px, calc(100dvh - 395px), ${tableWrapMaxHeight}px)`;
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += col.width || 80; } }); return map; }, [visibleCols]);
    const headerColumnGroups = useMemo(() => {
      const groups = [];
      let left = 0;
      visibleCols.forEach((col) => {
        const groupKey = getColumnGroupKey(col);
        const colWidth = col.width || 80;
        const last = groups[groups.length - 1];
        if (last && last.key === groupKey) {
          last.cols.push(col);
          last.width += colWidth;
          if (col.pinned) {
            last.pinnedCols.push(col);
            last.pinnedWidth += colWidth;
            if (last.pinnedLeft == null) last.pinnedLeft = pinnedLeftMap[col.key] || 0;
          }
          left += colWidth;
          return;
        }
        groups.push({
          key: groupKey,
          cols: [col],
          pinnedCols: col.pinned ? [col] : [],
          pinnedWidth: col.pinned ? colWidth : 0,
          pinnedLeft: col.pinned ? (pinnedLeftMap[col.key] || 0) : null,
          width: colWidth,
          left,
        });
        left += colWidth;
      });
      return groups;
    }, [visibleCols, pinnedLeftMap]);
    const scrollToIndexLeft = useCallback((left) => {
      const wrap = tableWrapRef.current;
      if (!wrap) return;
      const pinnedWidth = visibleCols.filter((col) => col.pinned).reduce((sum, col) => sum + (col.width || 80), 0);
      wrap.scrollTo?.({ left: Math.max(0, left - pinnedWidth), behavior: 'smooth' });
      if (!wrap.scrollTo) wrap.scrollLeft = Math.max(0, left - pinnedWidth);
    }, [visibleCols]);
    const columnIndexGroups = useMemo(() => {
      const keywordItems = [];
      const competitorItems = [];
      const seenCompetitors = new Set();
      let left = 0;
      visibleCols.forEach((col) => {
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
    const quickJumpSelectOptions = useMemo(() => ({
      keyword: columnIndexGroups.keywordItems.map((item) => ({
        value: `keyword:${item.key}`,
        label: item.label,
        title: item.label,
      })),
      competitor: columnIndexGroups.competitorItems.map((item) => ({
        value: `competitor:${item.key}`,
        label: item.label,
        title: item.label,
      })),
    }), [columnIndexGroups]);
    const quickJumpIndexMap = useMemo(() => {
      const entries = [];
      columnIndexGroups.keywordItems.forEach((item) => entries.push([`keyword:${item.key}`, item]));
      columnIndexGroups.competitorItems.forEach((item) => entries.push([`competitor:${item.key}`, item]));
      return Object.fromEntries(entries);
    }, [columnIndexGroups]);
    const handleQuickJumpSelect = useCallback((type, value) => {
      const item = quickJumpIndexMap[value];
      if (!item) return;
      scrollToIndexLeft(item.left);
      setQuickJumpSelectValues(type === 'competitor'
        ? { keyword: undefined, competitor: value }
        : { keyword: value, competitor: undefined }
      );
    }, [quickJumpIndexMap, scrollToIndexLeft]);

    const normalizeColumnSearchText = normalizeSearchText;
    const getColumnSearchText = useCallback((col) => {
      const groupKey = getColumnGroupKey(col);
      const groupMeta = columnGroupMetaMap[groupKey] || {};
      return [
        col.label,
        col.field,
        col.key,
        col.src,
        groupKey,
        groupMeta.label,
        col._kwName,
        col._competitorAsin,
        col._competitorRole,
        col._competitorNote,
        col._competitorSubLabel,
      ].filter(Boolean).join(' ');
    }, [columnGroupMetaMap]);
    const getColumnLeft = useCallback((colKey) => {
      let left = 0;
      for (const col of visibleCols) {
        if (col.key === colKey) return left;
        left += col.width || 80;
      }
      return null;
    }, [visibleCols]);
    const columnSearchOptions = useMemo(() => allColumns.filter((col) => getColumnGroupKey(col) !== 'other').map((col) => {
      const groupKey = getColumnGroupKey(col);
      const groupMeta = columnGroupMetaMap[groupKey] || {};
      return {
        value: col.key,
        label: `${col.label}｜${groupMeta.label || groupKey}`,
        searchText: normalizeColumnSearchText(getColumnSearchText(col)),
      };
    }), [allColumns, columnGroupMetaMap, getColumnSearchText]);
    const locateColumn = useCallback((colKey, options = {}) => {
      const col = allColumns.find((item) => item.key === colKey);
      if (!col) return;
      const groupKey = getColumnGroupKey(col);
      const groupMeta = columnGroupMetaMap[groupKey] || {};
      if (col.hidden) {
        setShowPanel(true);
        setShowPush(false);
        setShowCrossHighlightPanel(false);
        setPanelColumnSearchText(col.label || col.field || '');
        setCollapsedGroups((prev) => ({ ...prev, [groupKey]: false }));
        ctx.message.warning(`「${col.label}」当前已隐藏，请先在列设置中勾选显示`);
        return;
      }
      const left = getColumnLeft(col.key);
      if (left == null) return;
      scrollToIndexLeft(left);
      setHighlightColumnKey(col.key);
      if (columnHighlightTimerRef.current) window.clearTimeout(columnHighlightTimerRef.current);
      columnHighlightTimerRef.current = window.setTimeout(() => setHighlightColumnKey(null), 2200);
      if (options.fromPanel) {
        setCollapsedGroups((prev) => ({ ...prev, [groupKey]: false }));
      }
      ctx.message.success(`已定位到「${col.label}」${groupMeta.label ? `（${groupMeta.label}）` : ''}`);
    }, [allColumns, columnGroupMetaMap, getColumnLeft, scrollToIndexLeft]);

    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();
    const autoScrollTableOnDrag = useCallback((e) => {
      if (!dragColKey.current) return;
      const wrap = tableWrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const edge = 90;
      const maxStep = 36;
      let step = 0;
      if (e.clientX < rect.left + edge) {
        step = -Math.max(8, Math.round(((rect.left + edge - e.clientX) / edge) * maxStep));
      } else if (e.clientX > rect.right - edge) {
        step = Math.max(8, Math.round(((e.clientX - (rect.right - edge)) / edge) * maxStep));
      }
      if (step !== 0) wrap.scrollLeft += step;
    }, []);
    const onTableDragOver = useCallback((e) => {
      e.preventDefault();
      autoScrollTableOnDrag(e);
    }, [autoScrollTableOnDrag]);
    const onDrop = useCallback((e, targetKey) => {
      e.preventDefault();
      const fromKey = dragColKey.current;
      if (!fromKey || fromKey === targetKey) { dragColKey.current = null; return; }
      if (isDynamicColumnKey(fromKey) || isDynamicColumnKey(targetKey)) { dragColKey.current = null; return; }
      markColumnLayoutChanged();
      const updateColumnLayout = canModifyColumnView() ? updateAndSave : updateColumnsLocalOnly;
      updateColumnLayout((prev) => {
        const next = [...prev];
        const fi = next.findIndex((c) => c.key === fromKey);
        const ti = next.findIndex((c) => c.key === targetKey);
        if (fi < 0 || ti < 0) return prev;
        if (getColumnGroupKey(next[fi]) !== getColumnGroupKey(next[ti])) return prev;
        const [moved] = next.splice(fi, 1);
        next.splice(ti, 0, moved);
        return next;
      });
      dragColKey.current = null;
    }, [canModifyColumnView, markColumnLayoutChanged, updateAndSave, updateColumnsLocalOnly]);
    const onDragEnd = () => { dragColKey.current = null; };

    const onResizeStart = useCallback((e, colKey) => {
      e.preventDefault();
      e.stopPropagation();
      markColumnLayoutChanged();
      const col = allColumns.find((c) => c.key === colKey);
      resizeRef.current = { colKey, startX: e.clientX, startWidth: col?.width || 80 };
      setIsResizing(true);
    }, [allColumns, markColumnLayoutChanged]);
    const onOverlayMove = useCallback((e) => {
      if (!resizeRef.current) return;
      const { colKey, startX, startWidth } = resizeRef.current;
      const nw = Math.max(40, startWidth + (e.clientX - startX));
      const cur = allColumns.find((c) => c.key === colKey);
      if (isDynamicColumnKey(colKey)) {
        if (updateDynamicCol(colKey, (c) => ({ ...c, width: nw }))) {
          persistDynamicColPrefs(colKey, { width: nw, hidden: cur?.hidden === true, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null, bodyColor: getColBodyColor(cur) });
        }
        return;
      }
      const updateColumnLayout = canModifyColumnView() ? updateAndSave : updateColumnsLocalOnly;
      updateColumnLayout((p) => p.map((c) => c.key === colKey ? { ...c, width: nw } : c));
    }, [allColumns, canModifyColumnView, persistDynamicColPrefs, updateAndSave, updateColumnsLocalOnly]);
    const onOverlayUp   = useCallback(() => { resizeRef.current = null; setIsResizing(false); }, []);

    const isCellEditable = useCallback((col) => { if (READONLY_FIELDS.has(col.field)) return false; return col.editable === true; }, []);

    const supportsRichEdit = (col) => {
      if (col?._dynamicKind === 'competitor' && col._competitorField === 'rank') return false;
      if (col?._dynamicKind) return true;
      if (!col || READONLY_FIELDS.has(col.field)) return false;
      if (RATE_FIELDS.has(col.field) || MONEY_FIELDS.has(col.field) || NUM_FIELDS.has(col.field) || DATE_FIELDS.has(col.field)) return false;
      if (col.field === 'promo_day' || col.field === 'order_structure_diagnostic') return false;
      return true;
    };

    const shouldUseRichEdit = (col, canEdit = false) => {
      if (!supportsRichEdit(col)) return false;
      if (col?._dynamicKind) return col.richEdit !== false;
      return canEdit && col.richEdit === true;
    };

    const canPastePlainTextAsSingleValue = (col) => {
      return shouldUseRichEdit(col, isCellEditable(col));
    };

    const cellDisplayCache = useMemo(() => pagedData.map((row) =>
      visibleCols.map((col) => {
        const displayContent = formatCell(col, row);
        return {
          displayContent,
          renderedContent: renderCellDisplay(col, row, displayContent),
        };
      })
    ), [pagedData, visibleCols]);

    async function findCompetitorDailyRecord(rowId, competitorId) {
      if (!rowId || !competitorId) return null;
      const res = await ctx.request({
        url: 'order_link_competitor_asins_daily:list',
        method: 'get',
        params: {
          pageSize: 1,
          filter: JSON.stringify({
            $and: [
              { country_asin_date: { $eq: rowId } },
              { competitor_id: { $eq: competitorId } },
            ],
          }),
        },
      });
      return Array.isArray(res?.data?.data) ? (res.data.data[0] || null) : null;
    }

    async function saveCompetitorDailyRecord({ rowId, competitorId, date, field, value, daily }) {
      let existing = daily?.id ? daily : null;
      if (!existing) existing = await findCompetitorDailyRecord(rowId, competitorId);

      if (existing?.id) {
        await ctx.request({
          url: 'order_link_competitor_asins_daily:update',
          method: 'post',
          params: { filterByTk: existing.id },
          data: { [field]: value },
        });
        return { ...existing, [field]: value };
      }

      try {
        const res = await ctx.request({
          url: 'order_link_competitor_asins_daily:create',
          method: 'post',
          data: withCreateTimestamps({
            country_asin_date: rowId,
            competitor_id: competitorId,
            date,
            [field]: value,
          }),
        });
        return { ...(daily || {}), ...(res?.data?.data || {}), [field]: value };
      } catch (err) {
        const racedExisting = await findCompetitorDailyRecord(rowId, competitorId);
        if (!racedExisting?.id) throw err;
        await ctx.request({
          url: 'order_link_competitor_asins_daily:update',
          method: 'post',
          params: { filterByTk: racedExisting.id },
          data: { [field]: value },
        });
        return { ...racedExisting, [field]: value };
      }
    }

    const normalizeSelection = useCallback((range) => {
      if (!range) return null;
      const r1 = Math.min(range.start.r, range.end.r);
      const r2 = Math.max(range.start.r, range.end.r);
      const c1 = Math.min(range.start.c, range.end.c);
      const c2 = Math.max(range.start.c, range.end.c);
      return { r1, r2, c1, c2 };
    }, []);

    const selectionRect = useMemo(
      () => normalizeSelection(selectedRange),
      [normalizeSelection, selectedRange]
    );

    const isCellSelected = useCallback((r, c) => {
      return !!selectionRect
        && r >= selectionRect.r1
        && r <= selectionRect.r2
        && c >= selectionRect.c1
        && c <= selectionRect.c2;
    }, [selectionRect]);

    const isActiveCrossCell = useCallback((r, c) => {
      if (!crossHighlightEnabled || !activeCell) return false;
      return r === activeCell.r || c === activeCell.c;
    }, [activeCell, crossHighlightEnabled]);

    const getBodyCellBackground = useCallback((r, c, selected, col = null) => {
      if (selected) return '#e6f4ff';
      if (isActiveCrossCell(r, c)) return crossHighlightColor;
      const bodyColor = getColBodyColor(col);
      if (bodyColor) return bodyColor;
      return r % 2 === 0 ? '#fff' : '#fafafa';
    }, [crossHighlightColor, isActiveCrossCell]);

    const getClipboardValue = useCallback((col, row) => {
      const formatted = formatCell(col, row);
      return formatted === '—' ? '' : String(formatted ?? '');
    }, []);

    const parsePastedValue = useCallback((col, rawValue) => {
      const text = String(rawValue ?? '').trim();
      if (!text || text === '—') return null;
      if (col.field === 'promo_day') {
        if (text === '是' || text === '1' || /^true$/i.test(text)) return 1;
        if (text === '否' || text === '0' || /^false$/i.test(text)) return 0;
        return null;
      }
      if (col.field === 'order_structure_diagnostic') {
        const matched = ORDER_STRUCTURE_DIAGNOSED_OPTIONS.find((opt) => opt.label === text || opt.value === text);
        return matched ? matched.value : null;
      }
      if (RATE_FIELDS.has(col.field)) {
        const n = Number(text.replace(/,/g, '').replace('%', ''));
        return Number.isFinite(n) ? n / 100 : null;
      }
      if (MONEY_FIELDS.has(col.field) || NUM_FIELDS.has(col.field)) {
        const n = Number(text.replace(/,/g, ''));
        return Number.isFinite(n) ? n : null;
      }
      if (DATE_FIELDS.has(col.field)) return text.slice(0, 10) || null;
      return text;
    }, []);

    const focusClipboardWithoutScroll = useCallback(() => {
      const el = clipboardRef.current;
      if (!el) return;
      const wrap = tableWrapRef.current;
      const left = wrap?.scrollLeft || 0;
      const top = wrap?.scrollTop || 0;
      el.focus({ preventScroll: true });
      if (wrap) {
        wrap.scrollLeft = left;
        wrap.scrollTop = top;
      }
    }, []);

    const isTableClipboardEvent = useCallback((e) => {
      const target = e?.target;
      return target === clipboardRef.current || target === tableWrapRef.current;
    }, []);

    const handleCellMouseDown = useCallback((e, r, c) => {
      if (e.button !== 0 || editingCell || isResizing) return;

      const tag = String(e.target?.tagName || '').toLowerCase();
      const closestEl = e.target?.closest?.('.ant-picker, .ant-select, .ant-input-number');
      if (['input', 'textarea', 'select', 'button'].includes(tag) || closestEl) return;

      const nextRange = { start: { r, c }, end: { r, c } };
      selectingRef.current = true;
      selectionDraftRef.current = nextRange;
      selectionStore.setRange(nextRange);
      setActiveCell({ r, c });
      setSelectedRange(nextRange);
      setSelectionInputValue('');
      focusClipboardWithoutScroll();
      e.preventDefault();
    }, [editingCell, focusClipboardWithoutScroll, isResizing, selectionStore]);

    const commitSelectionDraft = useCallback(() => {
      const draft = selectionDraftRef.current;
      if (draft) {
        selectionStore.setRange(draft);
        setSelectedRange((prev) => {
          if (prev
            && prev.start.r === draft.start.r
            && prev.start.c === draft.start.c
            && prev.end.r === draft.end.r
            && prev.end.c === draft.end.c) return prev;
          return draft;
        });
      }
    }, [selectionStore]);

    const handleCellMouseEnter = useCallback((e, r, c) => {
      if (!selectingRef.current) return;
      if (e && typeof e.buttons === 'number' && (e.buttons & 1) !== 1) {
        selectingRef.current = false;
        commitSelectionDraft();
        return;
      }
      const draft = selectionDraftRef.current;
      if (!draft || (draft.end.r === r && draft.end.c === c)) return;
      const nextRange = { ...draft, end: { r, c } };
      selectionDraftRef.current = nextRange;
      selectionStore.setRange(nextRange);
    }, [commitSelectionDraft, selectionStore]);

    const stopSelecting = useCallback(() => {
      selectingRef.current = false;
      commitSelectionDraft();
    }, [commitSelectionDraft]);

    const handleCopy = useCallback((e) => {
      if (!isTableClipboardEvent(e)) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;
      e.preventDefault();
      const lines = [];
      for (let r = rect.r1; r <= rect.r2; r += 1) {
        const row = pagedData[r];
        const cells = [];
        for (let c = rect.c1; c <= rect.c2; c += 1) {
          const col = visibleCols[c];
          cells.push(col && row ? getClipboardValue(col, row) : '');
        }
        lines.push(cells.join('\t'));
      }
      e.clipboardData.setData('text/plain', lines.join('\n'));
    }, [getClipboardValue, isTableClipboardEvent, normalizeSelection, pagedData, selectedRange, visibleCols]);

    const handlePaste = useCallback(async (e) => {
      if (!isTableClipboardEvent(e)) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect || saving) return;
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      const normalizedText = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const selectedCol = visibleCols[rect.c1];
      const selectedRow = pagedData[rect.r1];
      const isPlainTextCellPaste =
        selectedCol &&
        selectedRow &&
        selectedRow.__rowType !== WEEKLY_SUMMARY_ROW_TYPE &&
        canPastePlainTextAsSingleValue(selectedCol) &&
        !normalizedText.includes('\t');
      const matrix = isPlainTextCellPaste
        ? [[normalizedText]]
        : normalizedText.split('\n').map((line) => line.split('\t'));
      while (matrix.length && matrix[matrix.length - 1].length === 1 && matrix[matrix.length - 1][0] === '') matrix.pop();
      if (!matrix.length) return;
      const patches = new Map();
      const sourcePatches = new Map();
      const richOps = [];
      const requestGroups = new Map();
      const changedRowsMap = new Map();
      const undoItems = [];
      const isSingleValuePaste = matrix.length === 1 && matrix[0].length === 1;
      const targetRows = isSingleValuePaste
        ? Array.from({ length: rect.r2 - rect.r1 + 1 }, () => matrix[0])
        : matrix;

      targetRows.forEach((line, rowOffset) => {
        const targetColCount = isSingleValuePaste ? (rect.c2 - rect.c1 + 1) : line.length;
        for (let colOffset = 0; colOffset < targetColCount; colOffset += 1) {
          const cellText = isSingleValuePaste ? matrix[0][0] : line[colOffset];
          const targetRow = pagedData[rect.r1 + rowOffset];
          const col = visibleCols[rect.c1 + colOffset];
          if (!targetRow || !col) continue;
          if (isPlainTextCellPaste) {
            if (targetRow.__rowType === WEEKLY_SUMMARY_ROW_TYPE) continue;
            if (!canPastePlainTextAsSingleValue(col)) continue;
          }
          const rowId = targetRow.country_asin_date || targetRow.id;

          if (col._dynamicKind === 'keyword') {
            const payload = targetRow[col.field];
            const kw = payload?.kw;
            const daily = payload?.daily || {};
            if (!rowId || !kw?.id) continue;
            richOps.push({
              type: 'keyword',
              rowId,
              colField: col.field,
              daily,
              dailyId: daily.id,
              kwId: kw.id,
              country: targetRow.country || null,
              asin: targetRow.asin || null,
              date: targetRow.date ? String(targetRow.date).slice(0, 10) : null,
              oldValue: daily.actual_rank ?? null,
              valueToSave: String(cellText ?? '').trim() || null,
            });
            continue;
          }

          if (col._dynamicKind === 'competitor') {
            const payload = targetRow[col.field];
            const competitor = payload?.competitor;
            const daily = payload?.daily || {};
            if (!rowId || !competitor?.id) continue;
            richOps.push({
              type: 'competitor',
              rowId,
              colField: col.field,
              daily,
              dailyId: daily.id,
              competitorId: competitor.id,
              field: col._competitorField || 'notes',
              date: targetRow.date ? String(targetRow.date).slice(0, 10) : null,
              oldValue: daily[col._competitorField || 'notes'] ?? null,
              valueToSave: String(cellText ?? '').trim() || null,
            });
            continue;
          }

          if (!isCellEditable(col)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = targetRow[updateConfig.pkField];
          if (!rowId || !pkValue) continue;
          const valueToSave = parsePastedValue(col, cellText);
          const oldValue = getCellValue(col, targetRow) ?? null;
          const requestKey = `${updateConfig.url}::${pkValue}`;
          const requestGroup = requestGroups.get(requestKey) || { url: updateConfig.url, pkValue, data: {} };
          requestGroup.data[col.field] = valueToSave;
          requestGroups.set(requestKey, requestGroup);
          undoItems.push({ kind: 'static', rowId, src: col.src, field: col.field, pkValue, oldValue, newValue: valueToSave });
          patches.set(rowId, { ...(patches.get(rowId) || {}), [col.field]: valueToSave });
          const nextSourcePatches = {
            ...(sourcePatches.get(rowId) || {}),
            [col.src]: {
              ...((sourcePatches.get(rowId) || {})[col.src] || {}),
              [col.field]: valueToSave,
            },
          };
          sourcePatches.set(rowId, nextSourcePatches);
          if (isFormulaSensitiveField(col)) {
            changedRowsMap.set(rowId, mergeSourcePatch({ ...targetRow, ...(patches.get(rowId) || {}) }, col.src, { [col.field]: valueToSave }));
          }
        }
      });

      const groupedRequests = [...requestGroups.values()];
      if (!groupedRequests.length && !richOps.length) {
        ctx.message.warning('粘贴区域没有可编辑单元格');
        return;
      }

      try {
        setSaving(true);
        const results = await Promise.allSettled(groupedRequests.map((group) => ctx.request({
          url: group.url,
          method: 'post',
          params: { filterByTk: group.pkValue },
          data: group.data,
        })));
        const richResults = await Promise.allSettled(richOps.map(async (op) => {
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
            return { type: 'keyword', rowId: op.rowId, colField: op.colField, field: 'actual_rank', daily: nextDaily, dailyId: nextDaily.id || op.dailyId, oldValue: op.oldValue, newValue: op.valueToSave };
          }

          const nextDaily = await saveCompetitorDailyRecord({
            rowId: op.rowId,
            competitorId: op.competitorId,
            date: op.date,
            field: op.field,
            value: op.valueToSave,
            daily: { ...op.daily, id: op.dailyId || op.daily?.id },
          });
          return { type: 'competitor', rowId: op.rowId, colField: op.colField, field: op.field, daily: nextDaily, dailyId: nextDaily.id || op.dailyId, oldValue: op.oldValue, newValue: op.valueToSave };
        }));
        const failCount =
          results.filter((r) => r.status === 'rejected').length +
          richResults.filter((r) => r.status === 'rejected').length;
        if (failCount === 0) {
          const richPatchItems = richResults
            .filter((r) => r.status === 'fulfilled')
            .map((r) => r.value);
          const richUndoItems = richPatchItems.map((p) => ({
            kind: p.type,
            rowId: p.rowId,
            colField: p.colField,
            dailyId: p.dailyId,
            field: p.field,
            oldValue: p.oldValue ?? null,
            newValue: p.newValue ?? null,
          }));
          pushUndoEntry({ label: '粘贴', items: [...undoItems, ...richUndoItems] });
          updateDataLocalOnly((prev) => prev.map((row) => {
            const rowId = row.country_asin_date || row.id;
            const patch = patches.get(rowId);
            const rowSourcePatches = sourcePatches.get(rowId) || {};
            const rowRichPatches = richPatchItems.filter((p) => p.rowId === rowId);
            let nextRow = patch ? { ...row, ...patch } : row;
            Object.entries(rowSourcePatches).forEach(([src, srcPatch]) => {
              nextRow = mergeSourcePatch(nextRow, src, srcPatch);
            });
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
          const changedRows = [...changedRowsMap.values()];
          if (changedRows.length) {
            showFormulaProgress({ label: '粘贴已保存，正在同步公式...', percent: 8 });
            await syncFormulasForChangedRows(changedRows, { onProgress: showFormulaProgress });
            finishFormulaProgress('粘贴公式同步完成');
          }
          ctx.message.success(changedRows.length
            ? `粘贴成功，已更新 ${undoItems.length + richOps.length} 个单元格，公式已同步`
            : `粘贴成功，已更新 ${undoItems.length + richOps.length} 个单元格`);
        } else {
          ctx.message.warning(`部分粘贴失败：${failCount}/${groupedRequests.length + richOps.length} 个请求`);
          loadData({ page: curPageRef.current, size: pageSizeRef.current });
        }
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [canPastePlainTextAsSingleValue, finishFormulaProgress, getCellValue, isCellEditable, isTableClipboardEvent, loadData, normalizeSelection, pagedData, parsePastedValue, pushUndoEntry, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulasForChangedRows, updateDataLocalOnly, visibleCols]);

    const fillSelectedCells = useCallback(async (rawValue) => {
      const rect = normalizeSelection(selectedRange);
      if (!rect || saving) return;
      setSelectionInputValue('');
      const patches = new Map();
      const sourcePatches = new Map();
      const richOps = [];
      const requests = [];
      const changedRowsMap = new Map();
      const undoItems = [];

      for (let r = rect.r1; r <= rect.r2; r += 1) {
        const targetRow = pagedData[r];
        if (!targetRow || targetRow.__rowType === WEEKLY_SUMMARY_ROW_TYPE) continue;
        for (let c = rect.c1; c <= rect.c2; c += 1) {
          const col = visibleCols[c];
          if (!col) continue;
          const rowId = targetRow.country_asin_date || targetRow.id;
          if (!rowId) continue;

          if (col._dynamicKind === 'keyword') {
            const payload = targetRow[col.field];
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
              country: targetRow.country || null,
              asin: targetRow.asin || null,
              date: targetRow.date ? String(targetRow.date).slice(0, 10) : null,
              oldValue: daily.actual_rank ?? null,
              valueToSave: String(rawValue ?? '').trim() || null,
            });
            continue;
          }

          if (col._dynamicKind === 'competitor') {
            const payload = targetRow[col.field];
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
              date: targetRow.date ? String(targetRow.date).slice(0, 10) : null,
              oldValue: daily[col._competitorField || 'notes'] ?? null,
              valueToSave: String(rawValue ?? '').trim() || null,
            });
            continue;
          }

          if (!isCellEditable(col)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          const pkValue = updateConfig ? targetRow[updateConfig.pkField] : null;
          if (!updateConfig || !pkValue) continue;
          const valueToSave = parsePastedValue(col, rawValue);
          const oldValue = getCellValue(col, targetRow) ?? null;
          requests.push(ctx.request({
            url: updateConfig.url,
            method: 'post',
            params: { filterByTk: pkValue },
            data: { [col.field]: valueToSave },
          }));
          undoItems.push({ kind: 'static', rowId, src: col.src, field: col.field, pkValue, oldValue, newValue: valueToSave });
          patches.set(rowId, { ...(patches.get(rowId) || {}), [col.field]: valueToSave });
          const nextSourcePatches = {
            ...(sourcePatches.get(rowId) || {}),
            [col.src]: {
              ...((sourcePatches.get(rowId) || {})[col.src] || {}),
              [col.field]: valueToSave,
            },
          };
          sourcePatches.set(rowId, nextSourcePatches);
          if (isFormulaSensitiveField(col)) {
            changedRowsMap.set(rowId, mergeSourcePatch({ ...targetRow, ...(patches.get(rowId) || {}) }, col.src, { [col.field]: valueToSave }));
          }
        }
      }

      if (!requests.length && !richOps.length) {
        ctx.message.warning('选区没有可填充的可编辑单元格');
        return;
      }

      try {
        setSaving(true);
        const results = await Promise.allSettled(requests);
        const richResults = await Promise.allSettled(richOps.map(async (op) => {
          if (op.type === 'keyword') {
            let nextDaily = { ...op.daily, actual_rank: op.valueToSave };
            if (op.dailyId) {
              await ctx.request({ url: 'sqp_keyword_daily_positions:update', method: 'post', params: { filterByTk: op.dailyId }, data: { actual_rank: op.valueToSave } });
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
            return { type: 'keyword', rowId: op.rowId, colField: op.colField, field: 'actual_rank', daily: nextDaily, dailyId: nextDaily.id || op.dailyId, oldValue: op.oldValue, newValue: op.valueToSave };
          }

          const nextDaily = await saveCompetitorDailyRecord({
            rowId: op.rowId,
            competitorId: op.competitorId,
            date: op.date,
            field: op.field,
            value: op.valueToSave,
            daily: { ...op.daily, id: op.dailyId || op.daily?.id },
          });
          return { type: 'competitor', rowId: op.rowId, colField: op.colField, field: op.field, daily: nextDaily, dailyId: nextDaily.id || op.dailyId, oldValue: op.oldValue, newValue: op.valueToSave };
        }));
        const failCount = results.filter((r) => r.status === 'rejected').length + richResults.filter((r) => r.status === 'rejected').length;
        if (failCount) {
          ctx.message.warning(`部分填充失败：${failCount}/${requests.length + richOps.length}`);
          loadData({ page: curPageRef.current, size: pageSizeRef.current });
          return;
        }

        const richPatchItems = richResults.filter((r) => r.status === 'fulfilled').map((r) => r.value);
        const richUndoItems = richPatchItems.map((p) => ({
          kind: p.type,
          rowId: p.rowId,
          colField: p.colField,
          dailyId: p.dailyId,
          field: p.field,
          oldValue: p.oldValue ?? null,
          newValue: p.newValue ?? null,
        }));
        pushUndoEntry({ label: '填充', items: [...undoItems, ...richUndoItems] });
        updateDataAndRefreshWeekly((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = patches.get(rowId);
          const rowSourcePatches = sourcePatches.get(rowId) || {};
          const rowRichPatches = richPatchItems.filter((p) => p.rowId === rowId);
          let nextRow = patch ? { ...row, ...patch } : row;
          Object.entries(rowSourcePatches).forEach(([src, srcPatch]) => {
            nextRow = mergeSourcePatch(nextRow, src, srcPatch);
          });
          if (rowRichPatches.length) {
            nextRow = nextRow === row ? { ...row } : nextRow;
            rowRichPatches.forEach((p) => {
              const payload = nextRow[p.colField];
              if (payload) nextRow[p.colField] = { ...payload, daily: p.daily };
            });
          }
          return nextRow;
        }));

        const changedRows = [...changedRowsMap.values()];
        if (changedRows.length) {
          showFormulaProgress({ label: '选区已填充，正在同步公式...', percent: 8 });
          await syncFormulasForChangedRows(changedRows, { onProgress: showFormulaProgress });
          finishFormulaProgress('填充公式同步完成');
        }
        ctx.message.success(`已填充 ${requests.length + richOps.length} 个单元格`);
      } catch (err) {
        resetFormulaProgress();
        ctx.message.error(`填充失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [finishFormulaProgress, getCellValue, isCellEditable, loadData, normalizeSelection, pagedData, parsePastedValue, pushUndoEntry, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly, visibleCols]);

    const clearSelectedCells = useCallback(async () => {
      const rect = normalizeSelection(selectedRange);
      if (!rect || saving) return;
      const patches = new Map();
      const sourcePatches = new Map();
      const richPatches = [];
      const requests = [];
      const changedRowsMap = new Map();
      const undoItems = [];

      for (let rowOffset = 0; rowOffset <= rect.r2 - rect.r1; rowOffset += 1) {
        const targetRow = pagedData[rect.r1 + rowOffset];
        if (!targetRow) continue;
        for (let colOffset = 0; colOffset <= rect.c2 - rect.c1; colOffset += 1) {
          const col = visibleCols[rect.c1 + colOffset];
          if (!col) continue;
          const rowId = targetRow.country_asin_date || targetRow.id;
          if (!rowId) continue;

          if (col._dynamicKind === 'keyword') {
            const payload = targetRow[col.field];
            const daily = payload?.daily || {};
            if (!daily.id) continue;
            requests.push(ctx.request({
              url: 'sqp_keyword_daily_positions:update',
              method: 'post',
              params: { filterByTk: daily.id },
              data: { actual_rank: null },
            }));
            undoItems.push({ kind: 'keyword', rowId, colField: col.field, dailyId: daily.id, oldValue: daily.actual_rank ?? null, newValue: null });
            richPatches.push({ rowId, colField: col.field, field: 'actual_rank', valueToSave: null });
            continue;
          }

          if (col._dynamicKind === 'competitor') {
            const payload = targetRow[col.field];
            const daily = payload?.daily || {};
            if (!daily.id) continue;
            const field = col._competitorField || 'notes';
            requests.push(ctx.request({
              url: 'order_link_competitor_asins_daily:update',
              method: 'post',
              params: { filterByTk: daily.id },
              data: { [field]: null },
            }));
            undoItems.push({ kind: 'competitor', rowId, colField: col.field, dailyId: daily.id, field, oldValue: daily[field] ?? null, newValue: null });
            richPatches.push({ rowId, colField: col.field, field, valueToSave: null });
            continue;
          }

          if (!isCellEditable(col)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = targetRow[updateConfig.pkField];
          if (!rowId || !pkValue) continue;
          const oldValue = getCellValue(col, targetRow) ?? null;

          requests.push(ctx.request({
            url: updateConfig.url,
            method: 'post',
            params: { filterByTk: pkValue },
            data: { [col.field]: null },
          }));
          undoItems.push({ kind: 'static', rowId, src: col.src, field: col.field, pkValue, oldValue, newValue: null });
          patches.set(rowId, { ...(patches.get(rowId) || {}), [col.field]: null });
          const nextSourcePatches = {
            ...(sourcePatches.get(rowId) || {}),
            [col.src]: {
              ...((sourcePatches.get(rowId) || {})[col.src] || {}),
              [col.field]: null,
            },
          };
          sourcePatches.set(rowId, nextSourcePatches);
          if (isFormulaSensitiveField(col)) {
            changedRowsMap.set(rowId, mergeSourcePatch({ ...targetRow, ...(patches.get(rowId) || {}) }, col.src, { [col.field]: null }));
          }
        }
      }

      if (!requests.length) {
        ctx.message.warning('\u9009\u533a\u6ca1\u6709\u53ef\u5220\u9664\u7684\u53ef\u7f16\u8f91\u5355\u5143\u683c');
        return;
      }

      try {
        setSaving(true);
        const results = await Promise.allSettled(requests);
        const failCount = results.filter((r) => r.status === 'rejected').length;
        if (failCount === 0) {
          pushUndoEntry({ label: '清空', items: undoItems });
          updateDataAndRefreshWeekly((prev) => prev.map((row) => {
            const rowId = row.country_asin_date || row.id;
            const patch = patches.get(rowId);
            const rowSourcePatches = sourcePatches.get(rowId) || {};
            const rowRichPatches = richPatches.filter((p) => p.rowId === rowId);
            let nextRow = patch ? { ...row, ...patch } : row;
            Object.entries(rowSourcePatches).forEach(([src, srcPatch]) => {
              nextRow = mergeSourcePatch(nextRow, src, srcPatch);
            });
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
          const changedRows = [...changedRowsMap.values()];
          if (changedRows.length) {
            showFormulaProgress({ label: '选区已清空，正在同步公式...', percent: 8 });
            await syncFormulasForChangedRows(changedRows, { onProgress: showFormulaProgress });
            finishFormulaProgress('清空后公式同步完成');
          }
          ctx.message.success(changedRows.length
            ? `\u5df2\u6e05\u7a7a ${requests.length} \u4e2a\u5355\u5143\u683c\uff0c\u516c\u5f0f\u5df2\u540c\u6b65`
            : `\u5df2\u6e05\u7a7a ${requests.length} \u4e2a\u5355\u5143\u683c`);
        } else {
          ctx.message.warning(`\u90e8\u5206\u6e05\u7a7a\u5931\u8d25\uff1a${failCount}/${requests.length}`);
          loadData({ page: curPageRef.current, size: pageSizeRef.current });
        }
      } catch (err) {
        ctx.message.error(`\u6e05\u7a7a\u5931\u8d25\uff1a${err?.message || '\u672a\u77e5\u9519\u8bef'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [finishFormulaProgress, getCellValue, isCellEditable, loadData, normalizeSelection, pagedData, pushUndoEntry, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly, visibleCols]);

    const undoLastEdit = useCallback(async () => {
      if (saving) return;
      const entry = undoStackRef.current.pop();
      if (!entry?.items?.length) {
        ctx.message.info('暂无可撤回的编辑');
        return;
      }
      const changedRowsMap = new Map();
      try {
        setSaving(true);
        await Promise.all(entry.items.map(async (item) => {
          if (item.kind === 'static') {
            const updateConfig = SRC_UPDATE_CONFIG[item.src];
            if (!updateConfig || !item.pkValue) return;
            await ctx.request({
              url: updateConfig.url,
              method: 'post',
              params: { filterByTk: item.pkValue },
              data: { [item.field]: item.oldValue ?? null },
            });
            const baseRow = dataRef.current.find((row) => (row.country_asin_date || row.id) === item.rowId);
            if (baseRow && isFormulaSensitiveField(item.field)) {
              changedRowsMap.set(item.rowId, mergeSourcePatch(baseRow, item.src, { [item.field]: item.oldValue ?? null }));
            }
            return;
          }
          if (item.kind === 'keyword') {
            if (!item.dailyId) return;
            await ctx.request({
              url: 'sqp_keyword_daily_positions:update',
              method: 'post',
              params: { filterByTk: item.dailyId },
              data: { actual_rank: item.oldValue ?? null },
            });
            return;
          }
          if (item.kind === 'competitor') {
            if (!item.dailyId) return;
            const fieldName = item.field || 'notes';
            await ctx.request({
              url: 'order_link_competitor_asins_daily:update',
              method: 'post',
              params: { filterByTk: item.dailyId },
              data: { [fieldName]: item.oldValue ?? null },
            });
          }
        }));

        updateDataAndRefreshWeekly((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const rowItems = entry.items.filter((item) => item.rowId === rowId);
          if (!rowItems.length) return row;
          let nextRow = row;
          rowItems.forEach((item) => {
            if (item.kind === 'static') {
              nextRow = mergeSourcePatch(nextRow, item.src, { [item.field]: item.oldValue ?? null });
              nextRow = { ...nextRow, [item.field]: item.oldValue ?? null };
              return;
            }
            const payload = nextRow[item.colField];
            if (!payload) return;
            const fieldName = item.kind === 'keyword' ? 'actual_rank' : (item.field || 'notes');
            nextRow = {
              ...nextRow,
              [item.colField]: {
                ...payload,
                daily: {
                  ...(payload.daily || {}),
                  [fieldName]: item.oldValue ?? null,
                },
              },
            };
          });
          return nextRow;
        }));

        const changedRows = [...changedRowsMap.values()];
        if (changedRows.length) {
          showFormulaProgress({ label: '已撤回，正在同步公式...', percent: 8 });
          await syncFormulasForChangedRows(changedRows, { onProgress: showFormulaProgress });
          finishFormulaProgress('撤回后公式同步完成');
        }
        ctx.message.success('已撤回上一步编辑');
      } catch (err) {
        undoStackRef.current.push(entry);
        resetFormulaProgress();
        ctx.message.error(`撤回失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [finishFormulaProgress, resetFormulaProgress, saving, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly]);

    const handleKeyDown = useCallback((e) => {
      if (editingCell || saving) return;
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
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'z') {
        e.preventDefault();
        undoLastEdit();
        return;
      }
      if (!rect) return;
      if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setSelectionInputValue((prev) => `${prev || ''}${e.key}`);
        return;
      }
      if (e.key === 'Enter' && selectionInputValue !== '') {
        e.preventDefault();
        const value = selectionInputValue;
        setSelectionInputValue('');
        fillSelectedCells(value);
        return;
      }
      if (e.key === 'Escape' && selectionInputValue !== '') {
        e.preventDefault();
        setSelectionInputValue('');
        return;
      }
      if (e.key === 'Backspace' && selectionInputValue !== '') {
        e.preventDefault();
        setSelectionInputValue((prev) => String(prev || '').slice(0, -1));
        return;
      }
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      e.preventDefault();
      clearSelectedCells();
    }, [clearSelectedCells, editingCell, fillSelectedCells, normalizeSelection, saving, selectedRange, selectionInputValue, undoLastEdit]);

    const startEdit = useCallback((rowId, col, currentValue) => {
      if (saving) return;
      selectingRef.current = false;
      selectionDraftRef.current = null;
      selectionStore.setRange(null);
      setSelectedRange(null);
      setSelectionInputValue('');
      setEditingCell({ rowId, colKey: col.key, field: col.field, src: col.src });
      if (col._dynamicKind === 'keyword') {
        const value = currentValue?.daily?.actual_rank;
        setEditValue(value != null && value !== '' ? value : '');
      } else if (col._dynamicKind === 'competitor') {
        const value = currentValue?.daily?.[col._competitorField || 'notes'];
        setEditValue(value != null && value !== '' ? value : '');
      } else if (col.field === 'promo_day') setEditValue(currentValue != null ? currentValue : 0);
      else if (col.field === 'order_structure_diagnostic') setEditValue(currentValue || '');
      else if (RATE_FIELDS.has(col.field)) setEditValue(currentValue != null && currentValue !== '' ? Number(currentValue) * 100 : '');
      else setEditValue(currentValue != null && currentValue !== '' ? currentValue : '');
    }, [saving, selectionStore]);

    const cancelEdit = useCallback(() => { setEditingCell(null); setEditValue(null); }, []);

    const saveEdit = useCallback(async () => {
      if (!editingCell || saving) return;
      const { rowId, field, src } = editingCell;
      const row = data.find((r) => (r.country_asin_date || r.id) === rowId);
      if (!row) return;
      const dynamicKeywordCol = dynamicKeywordCols.find((c) => c.key === editingCell.colKey);
      if (dynamicKeywordCol?._dynamicKind === 'keyword') {
        const payload = row[dynamicKeywordCol.field];
        const kw = payload?.kw;
        const daily = payload?.daily || {};
        if (!kw?.id) { ctx.message.error('无法找到 SQP 关键词记录'); cancelEdit(); return; }
        const normalizedEditValue = editValue && typeof editValue === 'object' ? editValue?.daily?.actual_rank : editValue;
        const valueToSave = normalizedEditValue !== '' && normalizedEditValue != null ? String(normalizedEditValue).trim() || null : null;
        const oldValue = daily.actual_rank ?? null;
        let savedCell = false;
        try {
          setSaving(true);
          let nextDaily = { ...daily, actual_rank: valueToSave };
          if (daily.id) {
            await ctx.request({
              url: 'sqp_keyword_daily_positions:update',
              method: 'post',
              params: { filterByTk: daily.id },
              data: { actual_rank: valueToSave },
            });
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
          updateDataAndRefreshWeekly((prev) => prev.map((r) => {
            if ((r.country_asin_date || r.id) !== rowId) return r;
            const currentPayload = r[dynamicKeywordCol.field] || payload || {};
            return { ...r, [dynamicKeywordCol.field]: { ...currentPayload, daily: nextDaily } };
          }));
          setEditingCell(null);
          setEditValue(null);
          savedCell = true;
          pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'keyword', rowId, colField: dynamicKeywordCol.field, dailyId: nextDaily.id, oldValue, newValue: valueToSave }] });
          setSaving(false);
          ctx.message.success('保存成功');
        } catch (err) {
          ctx.message.error(`保存 SQP 关键词自然位失败：${err?.message || '未知错误'}`);
        } finally {
          if (!savedCell) setSaving(false);
        }
        return;
      }
      const dynamicCompetitorCol = dynamicCompetitorCols.find((c) => c.key === editingCell.colKey);
      if (dynamicCompetitorCol?._dynamicKind === 'competitor') {
        const payload = row[dynamicCompetitorCol.field];
        const competitor = payload?.competitor;
        const daily = payload?.daily || {};
        const fieldName = dynamicCompetitorCol._competitorField || 'notes';
        if (!competitor?.id) { ctx.message.error('无法找到竞对记录'); cancelEdit(); return; }
        const normalizedEditValue = editValue && typeof editValue === 'object' ? editValue?.daily?.[fieldName] : editValue;
        const valueToSave = normalizedEditValue !== '' && normalizedEditValue != null ? normalizedEditValue : null;
        const oldValue = daily[fieldName] ?? null;
        let savedCell = false;
        try {
          setSaving(true);
          const nextDaily = await saveCompetitorDailyRecord({
            rowId,
            competitorId: competitor.id,
            date: row.date ? String(row.date).slice(0, 10) : null,
            field: fieldName,
            value: valueToSave,
            daily,
          });
          updateDataAndRefreshWeekly((prev) => prev.map((r) => {
            if ((r.country_asin_date || r.id) !== rowId) return r;
            const currentPayload = r[dynamicCompetitorCol.field] || payload || {};
            return { ...r, [dynamicCompetitorCol.field]: { ...currentPayload, daily: nextDaily } };
          }));
          setEditingCell(null);
          setEditValue(null);
          savedCell = true;
          pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'competitor', rowId, colField: dynamicCompetitorCol.field, dailyId: nextDaily.id, field: fieldName, oldValue, newValue: valueToSave }] });
          setSaving(false);
          ctx.message.success('保存成功');
        } catch (err) {
          ctx.message.error(`保存竞对失败：${err?.message || '未知错误'}`);
        } finally {
          if (!savedCell) setSaving(false);
        }
        return;
      }
      const updateConfig = SRC_UPDATE_CONFIG[src];
      if (!updateConfig) { ctx.message.error(`字段来源 "${src}" 暂不支持编辑`); return; }
      const pkValue = row[updateConfig.pkField];
      if (!pkValue) { ctx.message.error(`无法找到记录主键：${updateConfig.pkField}`); cancelEdit(); return; }
      let valueToSave = editValue;
      if (field === 'promo_day') valueToSave = editValue;
      else if (field === 'order_structure_diagnostic') valueToSave = editValue || null;
      else if (RATE_FIELDS.has(field)) valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) / 100 : null;
      else if (MONEY_FIELDS.has(field) || NUM_FIELDS.has(field)) valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) : null;
      else if (DATE_FIELDS.has(field)) valueToSave = editValue || null;
      else valueToSave = editValue || null;
      const oldValue = getCellValue({ field, src }, row) ?? null;
      let savedCell = false;
      try {
        setSaving(true);
        await ctx.request({
          url: updateConfig.url,
          method: 'post',
          params: { filterByTk: pkValue },
          data: { [field]: valueToSave },
        });

        const nextRow = mergeSourcePatch(row, src, { [field]: valueToSave });

        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? mergeSourcePatch(r, src, { [field]: valueToSave }) : r));
        setEditingCell(null);
        setEditValue(null);
        savedCell = true;
        pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'static', rowId, src, field, pkValue, oldValue, newValue: valueToSave }] });
        setSaving(false);
        if (isFormulaSensitiveField(field)) {
          showFormulaProgress({ label: '保存成功，正在同步公式...', percent: 8 });

          window.setTimeout(async () => {
            try {
              await syncFormulasForChangedRows([nextRow], { onProgress: showFormulaProgress });
              finishFormulaProgress('公式同步完成');
            } catch (formulaErr) {
              resetFormulaProgress();
              ctx.message.warning(`保存成功，但公式同步失败：${formulaErr?.message || '未知错误'}`);
            }
          }, 0);
        } else {
          ctx.message.success('保存成功');
        }
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || '未知错误'}`);
      } finally {
        if (!savedCell) setSaving(false);
      }
    }, [editingCell, editValue, data, dynamicKeywordCols, dynamicCompetitorCols, saving, cancelEdit, finishFormulaProgress, pushUndoEntry, resetFormulaProgress, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly]);

    const refreshData  = useCallback(async () => {
      if (refreshingData || calcLoading || loading) return;
      try {
        setRefreshingData(true);
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true, skipBackgroundSummary: true, skipCurrentPageSummaryRefresh: true });
        setRefreshProgress('正在读取当前 ASIN / 国家全部日期...');
        showFormulaProgress({ label: '正在读取当前 ASIN / 国家全部日期...', percent: 12 });
        let rows = await loadFormulaRowsForCurrentCountryAsin();
        if (!Array.isArray(rows) || !rows.length) {
          ctx.message.success('数据已刷新');
          finishFormulaProgress('数据已刷新');
          return;
        }
        const result = await recalcAllCoreFormulas(rows, {
          silent: true,
          preloadedDailyRows: rows,
          onProgress: (progress) => {
            const label = typeof progress === 'string' ? progress : (progress?.label || '正在重新计算公式...');
            setRefreshProgress(label);
            showFormulaProgress(progress);
          },
        });
        rows = await loadFormulaRowsForCurrentCountryAsin();
        setRefreshProgress('正在刷新全量周汇总...');
        showFormulaProgress({ label: '正在刷新全量周汇总...', percent: 88 });
        const { mergedRows: summaryRows, summaryCols } = await mergeDailyRowsForWeeklySummary(rows, { updateDynamicColumns: true });
        await refreshWeeklySummariesFromRows(summaryRows, summaryCols);
        setRefreshProgress('正在重新加载结果...');
        showFormulaProgress({ label: '正在重新加载结果...', percent: 96 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true, skipBackgroundSummary: true, skipCurrentPageSummaryRefresh: true });
        const ok = !result || result.success >= result.total || result.skipped >= result.total;
        ctx.message[ok ? 'success' : 'warning'](ok ? '数据和周汇总已刷新' : '数据已刷新，部分公式计算失败');
        finishFormulaProgress(ok ? '刷新完成' : '刷新完成，部分公式失败');
      } catch (err) {
        resetFormulaProgress();
        throw err;
      } finally {
        setRefreshingData(false);
        setRefreshProgress('');
      }
    }, [calcLoading, finishFormulaProgress, loadData, loadFormulaRowsForCurrentCountryAsin, loading, mergeDailyRowsForWeeklySummary, recalcAllCoreFormulas, refreshWeeklySummariesFromRows, refreshingData, resetFormulaProgress, showFormulaProgress]);

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
        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
        pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'keyword', rowId, colField: col.field, dailyId: nextDaily.id, oldValue: daily.actual_rank ?? null, newValue: newContent || null }] });
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存 SQP 关键词自然位失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, pushUndoEntry, restoreTableScroll, updateDataAndRefreshWeekly]);

    const saveCompetitorRichCell = useCallback(async (row, col, newContent) => {
      const rowId = row?.country_asin_date || row?.id;
      const payload = row?.[col.field];
      const competitor = payload?.competitor;
      const daily = payload?.daily || {};
      const fieldName = col._competitorField || 'notes';
      if (!rowId || !competitor?.id) { ctx.message.error('无法找到竞对记录'); return false; }
      const scrollPos = captureTableScroll();
      try {
        const nextDaily = await saveCompetitorDailyRecord({
          rowId,
          competitorId: competitor.id,
          date: row.date ? String(row.date).slice(0, 10) : null,
          field: fieldName,
          value: newContent || null,
          daily,
        });
        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
        pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'competitor', rowId, colField: col.field, dailyId: nextDaily.id, field: fieldName, oldValue: daily[fieldName] ?? null, newValue: newContent || null }] });
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存竞对失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, pushUndoEntry, restoreTableScroll, updateDataAndRefreshWeekly]);

    const saveStaticRichCell = useCallback(async (row, col, newContent) => {
      const rowId = row?.country_asin_date || row?.id;
      const updateConfig = SRC_UPDATE_CONFIG[col.src];
      if (!rowId || !updateConfig) { ctx.message.error('无法找到可写入的字段配置'); return false; }
      const pkValue = row[updateConfig.pkField];
      if (!pkValue) { ctx.message.error(`无法找到记录主键：${updateConfig.pkField}`); return false; }
      const valueToSave = newContent || null;
      const scrollPos = captureTableScroll();
      try {
        await ctx.request({ url: updateConfig.url, method: 'post', params: { filterByTk: pkValue }, data: { [col.field]: valueToSave } });
        const nextRow = mergeSourcePatch(row, col.src, { [col.field]: valueToSave });
        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? mergeSourcePatch(r, col.src, { [col.field]: valueToSave }) : r));
        pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'static', rowId, src: col.src, field: col.field, pkValue, oldValue: getCellValue(col, row) ?? null, newValue: valueToSave }] });
        if (isFormulaSensitiveField(col)) {
          showFormulaProgress({ label: '保存成功，正在同步公式...', percent: 8 });
          await syncFormulasForChangedRows([nextRow], { onProgress: showFormulaProgress });
          finishFormulaProgress('公式同步完成');
        }
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        resetFormulaProgress();
        ctx.message.error(`保存失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, finishFormulaProgress, getCellValue, pushUndoEntry, resetFormulaProgress, restoreTableScroll, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly]);

    const btnStyle = (bg, color, border) => ({
      minHeight: '30px',
      padding: '5px 12px',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '4px',
      background: bg,
      color,
      border: `1px solid ${border}`,
      borderRadius: '6px',
      cursor: 'pointer',
      fontSize: `${FONT_SIZE_SM}px`,
      fontWeight: 700,
      lineHeight: '18px',
      whiteSpace: 'nowrap',
      boxSizing: 'border-box',
      letterSpacing: 0,
      boxShadow: '0 1px 2px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.24)',
      transitionProperty: 'box-shadow, opacity',
      transitionDuration: '120ms',
      transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    });
    const renderIndexButton = (item) => React.createElement('button', {
      key: item.key,
      type: 'button',
      onClick: () => scrollToIndexLeft(item.left),
      style: {
        minHeight: '24px',
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 9px',
        border: '1px solid #d9d9d9',
        borderRadius: '5px',
        background: item.type === 'competitor' ? '#eff6ff' : '#fff7e6',
        color: item.type === 'competitor' ? '#1d4ed8' : '#b45309',
        cursor: 'pointer',
        fontSize: `${FONT_SIZE_XS}px`,
        fontWeight: 700,
        lineHeight: '16px',
        whiteSpace: 'nowrap',
        maxWidth: '180px',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        boxSizing: 'border-box',
        letterSpacing: 0,
        boxShadow: '0 1px 2px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.24)',
        transitionProperty: 'box-shadow, opacity',
        transitionDuration: '120ms',
        transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
      },
    }, item.label);
    const renderSortMark = (key) => {
      if (sortConfig.key !== key) return null;
      return React.createElement('span', {
        style: { marginLeft: '2px', fontSize: `${FONT_SIZE_XS}px`, lineHeight: 1, flexShrink: 0 },
      }, sortConfig.dir === 'asc' ? '▲' : '▼');
    };

    const splitTooltipText = (value) => {
      const text = Array.isArray(value) ? value.join('\n') : String(value || '').trim();
      if (!text) return [];
      const lines = text.match(/[^。！？\n]+[。！？]?/g) || [text];
      return lines.map((line) => line.trim()).filter(Boolean);
    };
    const tooltipSectionTitleStyle = {
      marginBottom: '5px',
      color: '#bae0ff',
      fontSize: '12px',
      fontWeight: 800,
      letterSpacing: '0.02em',
    };
    const tooltipBodyStyle = {
      color: 'rgba(255,255,255,0.92)',
      fontSize: '13px',
      lineHeight: 1.7,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
      textWrap: 'pretty',
    };
    const tooltipFieldRowStyle = {
      display: 'grid',
      gridTemplateColumns: '92px minmax(0, 1fr)',
      gap: '7px',
      alignItems: 'start',
    };
    const tooltipCodeStyle = {
      padding: '1px 5px',
      borderRadius: '4px',
      background: 'rgba(255,255,255,0.08)',
      color: 'rgba(255,255,255,0.9)',
      fontFamily: 'monospace',
      whiteSpace: 'normal',
      wordBreak: 'break-all',
    };

    const renderTooltip = ({ title, formula, emptyRules = [], fields = [], writeBackField, hideEmptyRules = false, hideFieldMapping = false, sourceInfos = [], emptyRuleMode = '任意' }) => {
      const formulaLines = splitTooltipText(formula || '直接展示该指标值');
      const resolvedEmptyRules = emptyRules.length ? emptyRules : ['无特殊为空条件'];
      return React.createElement('div', {
        style: {
          width: '440px',
          maxWidth: 'calc(100vw - 56px)',
          color: 'inherit',
          WebkitFontSmoothing: 'antialiased',
        },
      },
        React.createElement('div', {
          style: {
            paddingBottom: '9px',
            borderBottom: '1px solid rgba(255,255,255,0.2)',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 800,
            lineHeight: 1.45,
            textWrap: 'balance',
          },
        }, title),
        React.createElement('div', { style: { paddingTop: '10px' } },
          React.createElement('div', { style: tooltipSectionTitleStyle }, '取值与计算规则'),
          React.createElement('div', { style: { display: 'grid', gap: '4px' } },
            formulaLines.map((line, idx) => React.createElement('div', {
              key: `formula_${idx}`,
              style: tooltipBodyStyle,
            }, line))
          )
        ),
        !hideEmptyRules && React.createElement('div', {
          style: {
            marginTop: '10px',
            padding: '8px 10px',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.08)',
          },
        },
          React.createElement('div', { style: { ...tooltipSectionTitleStyle, color: '#ffd591' } }, `为空情况（满足${emptyRuleMode}）`),
          React.createElement('ul', {
            style: {
              ...tooltipBodyStyle,
              margin: '0 0 0 18px',
              padding: 0,
            },
          }, resolvedEmptyRules.map((rule, idx) => React.createElement('li', {
            key: `empty_${idx}`,
            style: { marginTop: idx === 0 ? 0 : '3px', paddingLeft: '2px' },
          }, rule)))
        ),
        IS_ADMIN && React.createElement('div', {
          style: {
            marginTop: '10px',
            paddingTop: '9px',
            borderTop: '1px solid rgba(255,255,255,0.2)',
            color: 'rgba(255,255,255,0.72)',
            fontSize: '12px',
            lineHeight: 1.65,
          },
        },
          React.createElement('div', { style: { ...tooltipSectionTitleStyle, color: '#b7eb8f' } }, '🔧 字段说明（开发用）'),
          React.createElement('div', { style: { display: 'grid', gap: '5px' } },
            ...sourceInfos.flatMap((source, idx) => [
              React.createElement('div', { key: `source_workflow_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: { color: 'rgba(255,255,255,0.62)' } }, '来源工作流'),
                React.createElement('code', { style: tooltipCodeStyle }, source.workflow)
              ),
              source.schedule && React.createElement('div', { key: `source_schedule_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: { color: 'rgba(255,255,255,0.62)' } }, '执行时间'),
                React.createElement('span', null, source.schedule)
              ),
              source.scope && React.createElement('div', { key: `source_scope_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: { color: 'rgba(255,255,255,0.62)' } }, '适用站点'),
                React.createElement('span', null, source.scope)
              ),
              React.createElement('div', { key: `source_node_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: { color: 'rgba(255,255,255,0.62)' } }, 'SQL 节点'),
                React.createElement('code', { style: tooltipCodeStyle }, source.node)
              ),
            ].filter(Boolean)),
            ...(!hideFieldMapping ? fields.map((item, idx) => React.createElement('div', {
              key: `field_${idx}`,
              style: tooltipFieldRowStyle,
            },
              React.createElement('span', { style: { color: 'rgba(255,255,255,0.62)' } }, item.label),
              React.createElement('code', { style: tooltipCodeStyle }, item.field)
            )) : []),
            !hideFieldMapping && React.createElement('div', { style: tooltipFieldRowStyle },
              React.createElement('span', { style: { color: 'rgba(255,255,255,0.62)' } }, '写回字段'),
              React.createElement('code', { style: tooltipCodeStyle }, writeBackField || '无')
            )
          )
        )
      );
    };

    const getHeaderTooltipText = (col) => {
      if (col._dynamicKind === 'keyword') return renderTooltip({
        title: col.label,
        formula: `引用 SQP 关键词「${col._kwName || '未命名'}」，展示当条 date 的自然位。`,
        fields: [
          { label: '关键词', field: 'sqp_keywords.keyword_name' },
          { label: '每日自然位', field: 'sqp_keyword_daily_positions.actual_rank' },
        ],
        writeBackField: 'sqp_keyword_daily_positions.actual_rank',
        hideEmptyRules: true,
      });
      if (col._dynamicKind === 'competitor') return renderTooltip({
        title: col._competitorGroupLabel || col.label,
        formula: `引用竞对 ASIN「${col._competitorAsin || '未命名'}」，展示当条 date 的${col._competitorSubLabel || ''}。`,
        fields: [
          { label: '竞对 ASIN', field: 'order_link_competitor_asins.competitor_asin' },
          { label: col._competitorSubLabel || '字段', field: `order_link_competitor_asins_daily.${col._competitorField || 'notes'}` },
        ],
        writeBackField: `order_link_competitor_asins_daily.${col._competitorField || 'notes'}`,
        hideEmptyRules: true,
      });
      if (FIELD_TOOLTIP_DATA[col.field]) return renderTooltip(FIELD_TOOLTIP_DATA[col.field]);
      if (col.src === 'weekly' && WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT[col.field]) {
        const weeklyTooltipLines = WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT[col.field].split('\n');
        const weeklyFormulaLines = [weeklyTooltipLines[0] || '直接展示该指标值'];
        if (WEEKLY_PERFORMANCE_DIRECT_VALUE_FIELDS.has(col.field)) {
          weeklyFormulaLines.push(WEEKLY_PERFORMANCE_UPDATE_TOOLTIP_TEXT);
        }
        return renderTooltip({
          title: col.label,
          formula: weeklyFormulaLines,
          fields: [
            { label: '字段标识公式', field: weeklyTooltipLines[1] || `${col.field} = 直接展示该指标值` },
            { label: `字段来源（${col.label}）`, field: `weekly_performance.${col.field}` },
          ],
          writeBackField: `weekly_performance.${col.field}`,
          hideEmptyRules: true,
        });
      }
      const sqlSourceKey = `${col.src}.${col.field}`;
      if (SQL_UPDATED_FIELD_TEXT[sqlSourceKey]) return renderTooltip({
        title: col.label,
        formula: SQL_UPDATED_FIELD_TEXT[sqlSourceKey],
        sourceInfos: SQL_UPDATED_FIELD_SOURCE[sqlSourceKey],
        hideEmptyRules: true,
        hideFieldMapping: true,
      });
      if (FIELD_TOOLTIP_TEXT[col.field]) return renderTooltip({
        title: col.label,
        formula: FIELD_TOOLTIP_TEXT[col.field],
        fields: [{ label: `字段来源（${col.label}）`, field: `${SRC_TABLE_LABEL[col.src] || col.src}.${col.field}` }],
        writeBackField: `${SRC_TABLE_LABEL[col.src] || col.src}.${col.field}`,
        hideEmptyRules: true,
      });
      return renderTooltip({
        title: col.label,
        formula: '直接展示该指标值',
        fields: [{ label: `字段来源（${col.label}）`, field: `${SRC_TABLE_LABEL[col.src] || col.src}.${col.field}` }],
        writeBackField: `${SRC_TABLE_LABEL[col.src] || col.src}.${col.field}`,
        hideEmptyRules: true,
      });
    };
    const formatTargetHeaderNumber = (value) => {
      const n = toFormulaNumber(value);
      if (n == null) return '';
      const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
      return String(rounded).replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1');
    };
    const getTargetHeaderValue = (sourceField) => {
      if (!sourceField) return null;
      if (targetDefaultRecord?.country_asin === currentCountryAsin && !isBlankLike(targetDefaultRecord[sourceField])) {
        return targetDefaultRecord[sourceField];
      }
      const rows = Array.isArray(data) ? data : [];
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row || row.__rowType === WEEKLY_SUMMARY_ROW_TYPE) continue;
        const sourceValue = row.__src?.target_default?.[sourceField];
        if (!isBlankLike(sourceValue)) return sourceValue;
        if (!isBlankLike(row[sourceField])) return row[sourceField];
      }
      return null;
    };
    const getHeaderDisplayLabel = (col) => {
      const config = TARGET_HEADER_VALUE_CONFIG[col.field];
      if (!config) return col.label;
      const rawValue = getTargetHeaderValue(config.sourceField);
      const numericValue = toFormulaNumber(rawValue);
      if (numericValue == null) return col.label;
      const formattedValue = config.type === 'percent'
        ? `${formatTargetHeaderNumber(numericValue * 100)}%`
        : formatTargetHeaderNumber(numericValue);
      return formattedValue ? `${col.label}-${formattedValue}` : col.label;
    };
    const renderHeaderLabel = (col) => {
      const isOwnPageScreenshotCol = col.key === 'order_link_page_screenshot';
      const currentAsinUrl = isOwnPageScreenshotCol ? buildAmazonAsinUrl(filterAsin, filterCountry) : '';
      const displayLabel = getHeaderDisplayLabel(col);
      const content = currentAsinUrl
        ? React.createElement(React.Fragment, null,
            React.createElement('a', {
              href: currentAsinUrl,
              target: '_blank',
              rel: 'noreferrer',
              onClick: (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.open(currentAsinUrl, '_blank', 'noopener,noreferrer');
              },
              style: {
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '2px',
                minWidth: 0,
                maxWidth: '100%',
                color: 'inherit',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                fontWeight: 800,
                lineHeight: '13px',
                cursor: 'pointer',
              },
            },
              React.createElement('span', {
                style: {
                  display: 'inline-block',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: 'underline',
                  textUnderlineOffset: '2px',
                  borderBottom: '1px solid currentColor',
                  lineHeight: '13px',
                },
              }, filterAsin)
            ),
            React.createElement('span', { style: { display: 'block', lineHeight: '13px', marginTop: '1px' } }, displayLabel)
          )
        : displayLabel;
      return React.createElement(Tooltip, {
        title: getHeaderTooltipText(col),
        placement: 'top',
        overlayStyle: { maxWidth: '480px' },
        overlayInnerStyle: { padding: '12px 14px', borderRadius: '8px' },
        mouseEnterDelay: 0.15,
      }, React.createElement('span', {
        style: {
          display: 'block',
          minWidth: 0,
          maxWidth: '100%',
          overflow: 'hidden',
          whiteSpace: 'normal',
          lineHeight: '15px',
          maxHeight: '30px',
          wordBreak: 'break-all',
          cursor: currentAsinUrl ? 'pointer' : 'help',
        },
      }, content));
    };
    const getAmazonDomainByCountry = (country) => {
      const code = String(country || '').trim().toUpperCase();
      const domainMap = {
        US: 'www.amazon.com',
        CA: 'www.amazon.ca',
        MX: 'www.amazon.com.mx',
        UK: 'www.amazon.co.uk',
        GB: 'www.amazon.co.uk',
        DE: 'www.amazon.de',
        FR: 'www.amazon.fr',
        IT: 'www.amazon.it',
        ES: 'www.amazon.es',
        NL: 'www.amazon.nl',
        SE: 'www.amazon.se',
        PL: 'www.amazon.pl',
        BE: 'www.amazon.com.be',
        JP: 'www.amazon.co.jp',
        AU: 'www.amazon.com.au',
        SG: 'www.amazon.sg',
        AE: 'www.amazon.ae',
        SA: 'www.amazon.sa',
        IN: 'www.amazon.in',
        BR: 'www.amazon.com.br',
        TR: 'www.amazon.com.tr',
      };
      return domainMap[code] || 'www.amazon.com';
    };
    const buildAmazonAsinUrl = (asin, country) => {
      const cleanAsin = String(asin || '').trim();
      if (!cleanAsin) return '';
      return `https://${getAmazonDomainByCountry(country)}/dp/${encodeURIComponent(cleanAsin)}`;
    };
    const renderCompetitorGroupHeaderLabel = (col) => React.createElement(Tooltip, {
      title: getHeaderTooltipText(col),
      placement: 'top',
      overlayStyle: { maxWidth: '480px' },
      overlayInnerStyle: { padding: '12px 14px', borderRadius: '8px' },
      mouseEnterDelay: 0.15,
    }, React.createElement('span', {
      style: {
        display: 'block',
        minWidth: 0,
        maxWidth: '100%',
        overflow: 'hidden',
        whiteSpace: 'normal',
        lineHeight: '15px',
        maxHeight: '30px',
        wordBreak: 'break-all',
        cursor: 'help',
        color: 'currentColor',
      },
    },
      React.createElement('span', null, `${col._competitorRole || '竞对'}:`),
      col._competitorAsin
        ? React.createElement('a', {
            href: buildAmazonAsinUrl(col._competitorAsin, col._competitorCountry || filterCountry),
            target: '_blank',
            rel: 'noreferrer',
            onClick: (e) => {
              e.preventDefault();
              e.stopPropagation();
              const url = buildAmazonAsinUrl(col._competitorAsin, col._competitorCountry || filterCountry);
              if (url) window.open(url, '_blank', 'noopener,noreferrer');
            },
            style: { display: 'inline-flex', alignItems: 'center', gap: '2px', minWidth: 0, color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 800, cursor: 'pointer' },
          },
            React.createElement('span', {
              style: {
                display: 'inline-block',
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                borderBottom: '1px solid currentColor',
                lineHeight: '13px',
              },
            }, col._competitorAsin)
          )
        : React.createElement('span', null, '未命名'),
      col._competitorNote ? React.createElement('span', null, `（${col._competitorNote}）`) : null
    ));

    const renderEditInput = (col) => {
      if (col.field === 'promo_day') return React.createElement(Select, { ref: inputRef, value: editValue, options: [{ label:'是',value:1},{label:'否',value:0}], style: { width: '100%' }, size: 'small', onChange: (v) => setEditValue(v), onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); } });
      if (col.field === 'order_structure_diagnostic') return React.createElement(Select, { ref: inputRef, value: editValue || undefined, options: ORDER_STRUCTURE_DIAGNOSED_OPTIONS, style: { width: '100%' }, size: 'small', onChange: (v) => { setEditValue(v); saveEdit(); }, onBlur: () => { if (editValue) saveEdit(); else cancelEdit(); }, onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); } });
      const commonProps = { ref: inputRef, value: editValue, onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); }, style: { width: '100%' }, size: 'small' };
      if (RATE_FIELDS.has(col.field)) return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), min: 0, max: 100, step: 0.01, precision: 2, addonAfter: '%' });
      if (MONEY_FIELDS.has(col.field)) return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 0.01, precision: 2 });
      if (NUM_FIELDS.has(col.field))   return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 1 });
      if (DATE_FIELDS.has(col.field))  return React.createElement(DatePicker,  { ...commonProps, locale: DATE_PICKER_LOCALE, value: editValue ? ctx.libs.dayjs(editValue) : null, onChange: (date) => setEditValue(date ? date.format('YYYY-MM-DD') : null) });
      return React.createElement(Input, { ...commonProps, onChange: (e) => setEditValue(e.target.value), onPressEnter: () => saveEdit() });
    };

    const renderColRow = (col) => {
      const currentColor = getColHeaderColor(col);
      const srcDefault   = SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;
      const isCustom     = !!col.headerColor;
      const isImportantColumn = !!getColBodyColor(col);
      const editableIconStyle = col.editable ? { fontSize: `${FONT_SIZE_SM}px`, color: '#EB6793', fontWeight: 'bold' } : { fontSize: `${FONT_SIZE_XS}px`, color: '#999' };
      const richEditIconStyle = col.richEdit ? { fontSize: `${FONT_SIZE_SM}px`, color: '#1890ff', fontWeight: 'bold' } : { fontSize: `${FONT_SIZE_XS}px`, color: '#999' };
      return React.createElement('div', { key: col.key, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0 3px 12px', borderBottom: '1px solid #fafafa' } },
        React.createElement('span', {
          onClick: () => togglePin(col.key),
          title: col.pinned ? '取消固定列' : '固定列',
          style: {
            width: '20px',
            height: '20px',
            flexShrink: 0,
            cursor: 'pointer',
            fontSize: `${FONT_SIZE_SM}px`,
            lineHeight: '20px',
            color: col.pinned ? '#e5484d' : '#f2b8bb',
            opacity: col.pinned ? 1 : 0.72,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
          },
        }, '📌'),
        React.createElement('input', { type: 'checkbox', checked: !col.hidden, onChange: () => toggleCol(col.key), style: { flexShrink: 0, cursor: 'pointer' } }),
        React.createElement('span', { style: { flex: 1, fontSize: `${FONT_SIZE_SM}px`, color: col.hidden ? '#ccc' : '#333', userSelect: 'none' } }, col.label),
        React.createElement('button', { title: col.hidden ? '该列隐藏，需先显示' : '定位到表格列', onClick: () => locateColumn(col.key, { fromPanel: true }), style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: col.hidden ? '#f5f5f5' : '#e6f4ff', color: col.hidden ? '#999' : '#0958d9', border: '1px solid #d9d9d9', borderRadius: '3px', cursor: 'pointer', flexShrink: 0 } }, '定位'),
        IS_ADMIN && !col._dynamicKind && !READONLY_FIELDS.has(col.field) && React.createElement('label', { title: '双击单元格可编辑', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: col.editable === true, onChange: () => toggleEditable(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: editableIconStyle }, '编辑'),
        ),
        IS_ADMIN && supportsRichEdit(col) && React.createElement('label', { title: '使用 + 编辑，可输入多行内容和粘贴截图', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: col.richEdit === true, onChange: () => toggleRichEdit(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: richEditIconStyle }, '+编辑'),
        ),
        React.createElement('label', { title: '将该列数据区标记为重要指标，列头不变', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: isImportantColumn, onChange: () => toggleImportantColumn(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: isImportantColumn ? '#2f5f1a' : '#777', fontWeight: isImportantColumn ? 800 : 600, whiteSpace: 'nowrap' } }, '重要指标'),
          React.createElement('span', { style: { width: '12px', height: '12px', borderRadius: '2px', background: IMPORTANT_COLUMN_BODY_COLOR, border: '1px solid rgba(0,0,0,0.18)', flexShrink: 0 } }),
        ),
        IS_ADMIN && React.createElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } },
          PRESET_COLORS.map((pc) => React.createElement('div', { key: pc.value, title: pc.label, onClick: () => setHColor(col.key, pc.value), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: pc.value, border: currentColor === pc.value ? '2px solid #333' : '2px solid transparent', boxSizing: 'border-box' } })),
          isCustom && React.createElement('div', { title: '重置为默认色', onClick: () => clearHColor(col.key), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: srcDefault, border: '2px dashed #333', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 700, lineHeight: 1 } }, '重'),
        ),
      );
    };

    const activeColumnView = columnViews.find((view) => view.id === activeColumnViewId);
    const columnViewOptions = useMemo(() => {
      const list = columnViews.length ? columnViews : DEFAULT_COLUMN_VIEW_IDS.map((id) => ({ id, name: DEFAULT_COLUMN_VIEW_LABELS[id], type: 'default' }));
      return list.map((view) => {
        const viewId = normalizeColumnViewId(view.id);
        const canRename = canModifyColumnView(viewId) && !columnViewSaving && !columnViewSwitching;
        const canDelete = !isDefaultColumnViewId(viewId) && !columnViewCreating && !columnViewSwitching;
        const stopSelect = (e) => {
          e.preventDefault?.();
          e.stopPropagation?.();
        };
        return {
          value: viewId,
          selectLabel: getViewLabel(view),
          label: React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', width: '100%' } },
            React.createElement('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, getViewLabel(view)),
            React.createElement('button', {
              type: 'button',
              title: canRename ? '修改视图名称' : '当前视图不可重命名',
              disabled: !canRename,
              onMouseDown: stopSelect,
              onClick: (e) => { stopSelect(e); if (canRename) renameColumnView(viewId); },
              style: { height: '22px', padding: '0 7px', border: '1px solid #c7d2fe', borderRadius: '4px', background: canRename ? '#eef2ff' : '#f1f5f9', color: canRename ? '#4f46e5' : '#94a3b8', cursor: canRename ? 'pointer' : 'not-allowed', fontSize: '12px', lineHeight: '20px', fontWeight: 700, flexShrink: 0 },
            }, '改名'),
            React.createElement('button', {
              type: 'button',
              title: canDelete ? '删除视图' : '默认视图不能删除',
              disabled: !canDelete,
              onMouseDown: stopSelect,
              onClick: (e) => { stopSelect(e); if (canDelete) deleteColumnView(viewId); },
              style: { width: '22px', height: '22px', padding: 0, border: '1px solid #fecaca', borderRadius: '4px', background: canDelete ? '#fff1f0' : '#f1f5f9', color: canDelete ? '#cf1322' : '#94a3b8', cursor: canDelete ? 'pointer' : 'not-allowed', fontSize: '14px', lineHeight: '20px', flexShrink: 0 },
            }, '×')
          ),
        };
      });
    }, [canModifyColumnView, columnViewCreating, columnViewSaving, columnViewSwitching, columnViews, deleteColumnView, renameColumnView]);
    const canAdjustActiveColumnView = true;
    const canSaveDefaultColumnView = IS_ADMIN && isDefaultColumnViewId(activeColumnViewId);
    const panelSearchQuery = normalizeColumnSearchText(panelColumnSearchText);
    const iconButtonStyle = (options = {}) => {
      const disabled = options.disabled === true;
      return {
        width: '30px',
        height: '30px',
        padding: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: `${FONT_SIZE + 1}px`,
        lineHeight: 1,
        fontWeight: 800,
        background: disabled ? options.disabledBg : options.bg,
        color: disabled ? options.disabledColor : options.color,
        border: options.border || 'none',
        borderRadius: '4px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.72 : 1,
      };
    };
    const panelEl = showPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { position: 'fixed', top: `${panelPos.top}px`, left: `${panelPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', width: IS_ADMIN ? '820px' : '760px', maxHeight: '620px', overflowY: 'auto' } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: '#555', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', null, '列设置'),
          canAdjustActiveColumnView && React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement('button', { onClick: selectAll,   style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
            React.createElement('button', { onClick: deselectAll, style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
          ),
        ),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px', padding: '12px', background: '#f8fafc', border: '1px solid #dbe3ee', borderRadius: '6px' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' } },
            React.createElement('span', { style: { fontSize: `${FONT_SIZE_SM}px`, color: '#334155', fontWeight: 800, flexShrink: 0 } }, '视图版本'),
            React.createElement(Select, {
              value: activeColumnViewId,
              options: columnViewOptions,
              onChange: switchColumnView,
              size: 'middle',
              disabled: columnViewSwitching || columnViewCreating || columnViewSaving,
              style: { width: '340px' },
              optionLabelProp: 'selectLabel',
            }),
            canSaveDefaultColumnView && React.createElement('button', { disabled: !currentUserId || columnViewSaving || columnViewSwitching, title: currentUserId ? (columnViewSaving ? '保存中' : '保存当前默认视图配置') : '未识别到当前用户，无法保存默认视图', 'aria-label': currentUserId ? (columnViewSaving ? '保存中' : '保存当前默认视图配置') : '未识别到当前用户，无法保存默认视图', onClick: saveCurrentDefaultColumnView, style: { ...iconButtonStyle({ disabled: !currentUserId || columnViewSaving || columnViewSwitching, bg: '#0f766e', disabledBg: '#99f6e4', color: '#fff', disabledColor: '#fff' }), width: '126px', padding: '0 10px', fontSize: `${FONT_SIZE_SM}px`, whiteSpace: 'nowrap' } }, columnViewSaving ? '保存中...' : '保存默认视图'),
            React.createElement('button', { disabled: !currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching, title: currentUserId ? (columnViewCreating ? '保存中' : '复制并保存为新视图') : '未识别到当前用户，无法保存视图', 'aria-label': currentUserId ? (columnViewCreating ? '保存中' : '复制并保存为新视图') : '未识别到当前用户，无法保存视图', onClick: () => createColumnViewFromCurrent(), style: { ...iconButtonStyle({ disabled: !currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching, bg: '#1677ff', disabledBg: '#93c5fd', color: '#fff', disabledColor: '#fff' }), width: '120px', padding: '0 10px', fontSize: `${FONT_SIZE_SM}px`, whiteSpace: 'nowrap' } }, columnViewCreating ? '保存中...' : '复制并保存')
          )
        ),
        React.createElement(Input, {
          value: panelColumnSearchText,
          allowClear: true,
          placeholder: '搜索列名 / 字段名 / 板块名',
          size: 'small',
          onChange: (e) => setPanelColumnSearchText(e.target.value),
          style: { marginBottom: '8px' },
        }),
        panelGroupConfig.map((group) => {
          const groupCols   = allColumns.filter((c) => getColumnGroupKey(c) === group.src);
          const filteredGroupCols = panelSearchQuery
            ? groupCols.filter((col) => normalizeColumnSearchText(getColumnSearchText(col)).includes(panelSearchQuery))
            : groupCols;
          if (!filteredGroupCols.length) return null;
          const isCollapsed = panelSearchQuery ? false : !!collapsedGroups[group.src];
          const visCount    = groupCols.filter((c) => !c.hidden).length;
          const canMoveGroup = group.src !== 'competitor';
          return React.createElement('div', { key: group.src, style: { marginBottom: '6px', border: '1px solid #d6dde5', borderRadius: '6px', overflow: 'hidden', background: '#fff' } },
            React.createElement('div', { onClick: () => toggleGroup(group.src), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 6px 0', cursor: 'pointer', userSelect: 'none', background: `${group.color}22`, borderBottom: isCollapsed ? 'none' : '1px solid #dfe5ec' } },
              React.createElement('span', { style: { alignSelf: 'stretch', width: '4px', background: group.color, flexShrink: 0 } }),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#334155', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 } }, '>'),
              React.createElement('span', { style: { fontWeight: 800, fontSize: `${FONT_SIZE_SM}px`, color: '#1f2933', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#475569', fontWeight: 600, marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              canAdjustActiveColumnView && canMoveGroup && React.createElement('button', { title: '板块上移', onClick: (e) => { e.stopPropagation(); moveColumnGroup(group.src, -1); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#fff', color: '#555', border: '1px solid #d9d9d9', borderRadius: '3px', cursor: 'pointer' } }, '上移'),
              canAdjustActiveColumnView && canMoveGroup && React.createElement('button', { title: '板块下移', onClick: (e) => { e.stopPropagation(); moveColumnGroup(group.src, 1); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#fff', color: '#555', border: '1px solid #d9d9d9', borderRadius: '3px', cursor: 'pointer' } }, '下移'),
              canAdjustActiveColumnView && React.createElement('button', { onClick: (e) => { e.stopPropagation(); selectGroup(group.src); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
              canAdjustActiveColumnView && React.createElement('button', { onClick: (e) => { e.stopPropagation(); deselectGroup(group.src); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
            ),
            !isCollapsed && React.createElement('div', null, filteredGroupCols.map((col) => renderColRow(col))),
          );
        }),
      ),
    );

    const pushPanelEl = showPush && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPush(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement(PushPanel, { onClose: () => setShowPush(false), anchorPos: pushPos, onPush: saveCurrentAsDefaultColumns }),
    );

    const tableWidth = visibleCols.reduce((s, c) => s + (c.width || 80), 0);
    const managerInputStyle = { width: '100%', padding: '4px 8px', border: '1px solid #d9d9d9', borderRadius: 4, fontSize: `${FONT_SIZE_SM}px` };
    const sortedManagerItems = [...managerItems].sort((a, b) => {
      const ai = getCompetitorRoleIndex(a.role);
      const bi = getCompetitorRoleIndex(b.role);
      if (ai !== bi) return ai - bi;
      return String(a.competitor_asin || a.keyword_name || a.root_name || '').localeCompare(String(b.competitor_asin || b.keyword_name || b.root_name || ''));
    });
    const sqpMeta = getSqpManagerMeta();
    const nextCompetitorRole = `竞对${sortedManagerItems.reduce((max, rec) => {
      const idx = getCompetitorRoleIndex(rec.role);
      return Number.isFinite(idx) && idx !== 9999 ? Math.max(max, idx) : max;
    }, 0) + 1}`;
    const keywordManagerModal = React.createElement(Modal, {
      title: currentCountryAsin ? `管理 SQP ${sqpMeta.title}：${currentCountryAsin}` : `管理 SQP ${sqpMeta.title}`,
      open: keywordManagerVisible,
      visible: keywordManagerVisible,
      onCancel: () => setKeywordManagerVisible(false),
      footer: null,
      width: 700,
      destroyOnClose: true,
    },
      !currentCountryAsin
        ? React.createElement('div', { style: { padding: 24, color: '#999' } }, '请先进入具体 country + asin 后再管理关键词。')
        : React.createElement('div', null,
            React.createElement('div', { style: { marginBottom: 12, padding: '10px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, color: '#3f6600', lineHeight: 1.6 } },
              '这里管理的是 SQP 版块同一批关键词/词根；在这里新增、修改或删除，SQP 版块会同步变化。'
            ),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
              React.createElement(Button, { type: keywordTab === 'keyword' ? 'primary' : 'default', onClick: () => setKeywordTab('keyword'), disabled: managerSaving }, '关键词'),
              React.createElement(Button, { type: keywordTab === 'root' ? 'primary' : 'default', onClick: () => setKeywordTab('root'), disabled: managerSaving }, '词根')
            ),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
              React.createElement(Input, { value: keywordDraft, placeholder: `新增${sqpMeta.title}`, onChange: (e) => setKeywordDraft(e.target.value), onPressEnter: addKeyword, disabled: managerSaving }),
              React.createElement(Button, { type: 'primary', loading: managerSaving, onClick: addKeyword }, '新增')
            ),
            managerLoading
              ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#999' } }, '加载中...')
              : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                  managerItems.length === 0 && React.createElement('div', { style: { padding: 20, color: '#999', textAlign: 'center', background: '#fafafa', borderRadius: 6 } }, `暂无${sqpMeta.title}`),
                  managerItems.map((item) => {
                    const lockedDefault = isLockedSqpDefaultTerm(item);
                    return React.createElement('div', { key: item.id, style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' } },
                      React.createElement(Input, {
                        defaultValue: item[sqpMeta.nameField] || '',
                        disabled: managerSaving || lockedDefault,
                        suffix: lockedDefault ? React.createElement('span', { style: { color: '#1677ff', fontSize: 12, fontWeight: 700 } }, '默认') : null,
                        onBlur: (e) => { const v = e.target.value.trim(); if (!lockedDefault && v !== (item[sqpMeta.nameField] || '')) updateKeyword(item, v); },
                        onPressEnter: (e) => e.currentTarget.blur(),
                      }),
                      React.createElement(Popconfirm, { title: `确定删除「${item[sqpMeta.nameField] || sqpMeta.title}」？`, onConfirm: () => deleteKeyword(item), okText: '确定', cancelText: '取消', disabled: managerSaving || lockedDefault },
                        React.createElement(Button, { danger: true, disabled: managerSaving || lockedDefault }, '删除')
                      )
                    );
                  })
                )
          )
    );
    const targetManagerModal = React.createElement(Modal, {
      title: currentCountryAsin ? `管理目标值：${currentCountryAsin}` : '管理目标值',
      open: targetManagerVisible,
      visible: targetManagerVisible,
      onCancel: () => setTargetManagerVisible(false),
      footer: [
        React.createElement(Button, { key: 'cancel', onClick: () => setTargetManagerVisible(false), disabled: targetManagerSaving }, '取消'),
        React.createElement(Button, { key: 'save', type: 'primary', loading: targetManagerSaving, onClick: saveTargetDefault, disabled: !currentCountryAsin || targetManagerLoading }, '保存'),
      ],
      width: 640,
      destroyOnClose: true,
    },
      !currentCountryAsin
        ? React.createElement('div', { style: { padding: 24, color: '#999', background: '#fafafa', borderRadius: 6 } }, '请先进入具体 country + asin 后再管理目标值。')
        : React.createElement('div', null,
            React.createElement('div', { style: { marginBottom: 12, padding: 12, background: '#fffbe6', border: '1px solid #ffe58f', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'center' } },
              React.createElement('span', { style: { fontWeight: 600, color: '#ad6800' } }, '当前：'),
              React.createElement('span', { style: { fontWeight: 700, color: '#333' } }, `${filterCountry} · ${filterAsin}`),
              React.createElement('span', { style: { marginLeft: 'auto', color: targetDefaultRecord ? '#666' : '#ad6800', fontSize: 13 } }, targetDefaultRecord ? '已存在目标配置' : '将新建目标配置')
            ),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
              React.createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 6, color: '#333', fontWeight: 600 } },
                '目标广告 CVR',
                React.createElement(InputNumber, { value: targetAdCvrDraft, onChange: setTargetAdCvrDraft, min: 0, max: 100, step: 0.01, precision: 2, addonAfter: '%', style: { width: '100%' }, disabled: targetManagerLoading || targetManagerSaving, placeholder: '请输入百分比' })
              ),
              React.createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 6, color: '#333', fontWeight: 600 } },
                '目标 CPA',
                React.createElement(InputNumber, { value: targetCpaDraft, onChange: setTargetCpaDraft, min: 0, step: 0.01, precision: 2, style: { width: '100%' }, disabled: targetManagerLoading || targetManagerSaving, placeholder: '请输入金额' })
              ),
              React.createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 6, color: '#333', fontWeight: 600 } },
                '目标 CPU',
                React.createElement(InputNumber, { value: targetIdealCpuDraft, onChange: setTargetIdealCpuDraft, min: 0, step: 0.01, precision: 2, style: { width: '100%' }, disabled: targetManagerLoading || targetManagerSaving, placeholder: '请输入金额' })
              ),
              React.createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 6, color: '#333', fontWeight: 600 } },
                '目标利润率',
                React.createElement(InputNumber, { value: targetProfitMarginDraft, onChange: setTargetProfitMarginDraft, min: 0, max: 100, step: 0.01, precision: 2, addonAfter: '%', style: { width: '100%' }, disabled: targetManagerLoading || targetManagerSaving, placeholder: '请输入百分比' })
              ),
              React.createElement('label', { style: { display: 'flex', flexDirection: 'column', gap: 6, color: '#333', fontWeight: 600 } },
                '目标广告费率',
                React.createElement(InputNumber, { value: targetAdSpendRateDraft, onChange: setTargetAdSpendRateDraft, min: 0, max: 100, step: 0.01, precision: 2, addonAfter: '%', style: { width: '100%' }, disabled: targetManagerLoading || targetManagerSaving, placeholder: '请输入百分比' })
              )
            ),
            React.createElement('div', { style: { marginTop: 10, color: '#888', fontSize: `${FONT_SIZE_SM}px`, lineHeight: 1.6 } },
              targetManagerLoading ? '加载中...' : '保存后会写入 target_default，并刷新当前合并板块数据。'
            )
          )
    );
    const couponManagerModal = React.createElement(Modal, {
      title: currentAsinCountry ? `管理产生coupon费用的订单比例-预估：${currentAsinCountry}` : '管理产生coupon费用的订单比例-预估',
      open: couponManagerVisible,
      visible: couponManagerVisible,
      onCancel: () => setCouponManagerVisible(false),
      footer: [
        React.createElement(Button, { key: 'cancel', onClick: () => setCouponManagerVisible(false), disabled: couponManagerSaving }, '取消'),
        React.createElement(Button, { key: 'save', type: 'primary', loading: couponManagerSaving, onClick: saveCouponConfig, disabled: !currentAsinCountry || couponManagerLoading || !couponConfigRecord?.asin_country }, '保存'),
      ],
      width: 560,
      destroyOnClose: true,
    },
      !currentAsinCountry
        ? React.createElement('div', { style: { padding: 24, color: '#999', background: '#fafafa', borderRadius: 6 } }, '请先进入具体 ASIN + country 后再管理 Coupon 预估比例。')
        : React.createElement('div', null,
            React.createElement('div', { style: { marginBottom: 12, padding: 12, background: '#fff7e6', border: '1px solid #ffd591', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'center' } },
              React.createElement('span', { style: { fontWeight: 600, color: '#d46b08' } }, '当前：'),
              React.createElement('span', { style: { fontWeight: 700, color: '#333' } }, `${filterAsin} · ${filterCountry}`),
              React.createElement('span', { style: { marginLeft: 'auto', color: couponConfigRecord ? '#666' : '#d46b08', fontSize: 13 } }, couponConfigRecord ? '已有关联配置' : '未找到产品配置')
            ),
            React.createElement('div', { style: { marginBottom: 8, fontWeight: 600, color: '#333' } }, '产生coupon费用的订单比例-预估'),
            React.createElement(InputNumber, {
              value: couponRatioDraft,
              onChange: setCouponRatioDraft,
              min: 0,
              max: 100,
              step: 0.01,
              precision: 2,
              addonAfter: '%',
              style: { width: '100%' },
              disabled: couponManagerLoading || couponManagerSaving,
              placeholder: '请输入比例',
            }),
            React.createElement('div', { style: { marginTop: 10, color: '#888', fontSize: `${FONT_SIZE_SM}px`, lineHeight: 1.6 } },
              couponManagerLoading
                ? '加载中...'
                : (couponConfigRecord
                  ? '保存后会写入 product_config.coupon_order_ratio_estimated，并立刻同步重算 Coupon 总费用和相关利润公式。'
                  : '当前 ASIN_国家 没有 product_config 配置记录，请先补齐产品配置后再维护该比例。')
            )
          )
    );
    const competitorManagerModal = React.createElement(Modal, {
      title: null,
      open: competitorManagerVisible,
      visible: competitorManagerVisible,
      onCancel: () => setCompetitorManagerVisible(false),
      footer: null,
      width: 720,
      destroyOnClose: true,
    },
      !currentCountryAsin
        ? React.createElement('div', { style: { padding: 24, color: '#999', background: '#fafafa', borderRadius: 6 } }, '请先进入具体 country + asin 后再管理竞对 ASIN。')
        : React.createElement('div', null,
            React.createElement('div', { style: { marginBottom: 12, padding: 12, background: '#f0f7ff', border: '1px solid #91caff', borderRadius: 6, display: 'flex', gap: 12, alignItems: 'center' } },
              React.createElement('span', { style: { fontWeight: 600, color: '#1677ff' } }, '当前：'),
              React.createElement('span', { style: { fontWeight: 700, color: '#333' } }, `${filterCountry} · ${filterAsin}`),
              React.createElement('span', { style: { marginLeft: 'auto', color: '#666', fontSize: 13 } }, `共 ${managerItems.length} 个竞对`)
            ),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: 8, marginBottom: 12 } },
              React.createElement(Input, { value: competitorDraft, placeholder: `新增${nextCompetitorRole} ASIN`, onChange: (e) => setCompetitorDraft(e.target.value), onPressEnter: addCompetitor, disabled: managerSaving }),
              React.createElement(Input, { value: competitorNoteDraft, placeholder: '列头备注（可选）', onChange: (e) => setCompetitorNoteDraft(e.target.value), onPressEnter: addCompetitor, disabled: managerSaving }),
              React.createElement(Button, { type: 'primary', loading: managerSaving, onClick: addCompetitor }, '新增')
            ),
            managerLoading
              ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#999' } }, '加载中...')
              : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                  sortedManagerItems.length === 0 && React.createElement('div', { style: { padding: 20, color: '#999', textAlign: 'center', background: '#fafafa', borderRadius: 6 } }, '暂无竞对'),
                  sortedManagerItems.map((item) => React.createElement('div', { key: item.id, style: { display: 'grid', gridTemplateColumns: '72px 1fr 1fr auto', gap: 8, alignItems: 'center' } },
                    React.createElement('span', { style: { padding: '4px 8px', borderRadius: 4, background: getCompetitorColor(item.role), color: getTextColorForBg(getCompetitorColor(item.role)), textAlign: 'center', fontWeight: 700, fontSize: 13 } }, item.role || '竞对'),
                    React.createElement(Input, {
                      defaultValue: item.competitor_asin || '',
                      disabled: managerSaving,
                      onBlur: (e) => updateCompetitor(item, e.target.value.trim()),
                      onPressEnter: (e) => e.currentTarget.blur(),
                    }),
                    React.createElement(Input, {
                      defaultValue: item.notes || '',
                      placeholder: '列头备注',
                      disabled: managerSaving,
                      onBlur: (e) => updateCompetitorNote(item, e.target.value.trim()),
                      onPressEnter: (e) => e.currentTarget.blur(),
                    }),
                    React.createElement(Popconfirm, { title: `确定删除「${item.competitor_asin || item.role || '竞对'}」？`, onConfirm: () => deleteCompetitor(item), okText: '确定', cancelText: '取消' },
                      React.createElement(Button, { danger: true, disabled: managerSaving }, '删除')
                    )
                  ))
                )
          )
    );

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
        alignItems: 'center',
        gap: '8px',
        flexWrap: 'wrap',
        minHeight: '30px',
        marginBottom: '4px',
        padding: '5px 10px',
        background: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '8px',
        boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
        maxWidth: '100%',
        boxSizing: 'border-box',
      },
    },
      ...topInfoItems.map((item, index) =>
        React.createElement('div', { key: item.label, style: { minWidth: 0, borderLeft: index === 0 ? 'none' : '1px solid #d9d9d9', paddingLeft: index === 0 ? 0 : '8px', color: '#333', fontSize: `${FONT_SIZE_SM}px`, fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } },
          React.createElement('span', { style: { color: '#666', fontWeight: 500 } }, `${item.label}：`),
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

    const primaryColorLegendItems = PRESET_COLORS.slice(0, 4);
    const extraColorLegendItems = PRESET_COLORS.slice(4);
    const renderColorLegendItem = (pc, index) => {
      const label = index === 0 ? '默认自动抓取，也可手动复核' : pc.label;
      return React.createElement('div', {
        key: pc.value,
        style: { display: 'flex', alignItems: 'center', gap: '2px' },
      },
        React.createElement('div', { style: { width: '10px', height: '10px', borderRadius: '2px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
        label && React.createElement('span', { style: { color: '#666' } }, label)
      );
    };
    const quickJumpEl = (quickJumpSelectOptions.keyword.length > 0 || quickJumpSelectOptions.competitor.length > 0) && React.createElement('div', {
      style: { display: 'inline-flex', width: 'fit-content', maxWidth: '100%', alignItems: 'center', columnGap: '10px', rowGap: '5px', flexWrap: 'wrap', marginBottom: '4px', minHeight: '30px', padding: '5px 10px', background: '#fafafa', border: '1px solid #d9d9d9', borderRadius: 8, boxShadow: '0 1px 2px rgba(15,23,42,0.05)', fontSize: `${FONT_SIZE_XS}px`, boxSizing: 'border-box' },
    },
      React.createElement('span', { style: { color: '#666', fontWeight: 600, flexShrink: 0 } }, '快速跳转：'),
      React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 } },
        React.createElement('span', { style: { color: '#389e0d', fontWeight: 700, whiteSpace: 'nowrap' } }, 'SQP词'),
        React.createElement(Select, {
          size: 'small',
          value: quickJumpSelectValues.keyword,
          allowClear: true,
          showSearch: true,
          placeholder: quickJumpSelectOptions.keyword.length ? '选择SQP词' : '暂无SQP词',
          options: quickJumpSelectOptions.keyword,
          onSelect: (value) => handleQuickJumpSelect('keyword', value),
          optionFilterProp: 'label',
          disabled: !quickJumpSelectOptions.keyword.length,
          popupMatchSelectWidth: false,
          style: { width: '210px', maxWidth: '36vw' },
        })
      ),
      React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 } },
        React.createElement('span', { style: { color: '#0958d9', fontWeight: 700, whiteSpace: 'nowrap' } }, '竞对ASIN'),
        React.createElement(Select, {
          size: 'small',
          value: quickJumpSelectValues.competitor,
          allowClear: true,
          showSearch: true,
          placeholder: quickJumpSelectOptions.competitor.length ? '选择竞对ASIN' : '暂无竞对ASIN',
          options: quickJumpSelectOptions.competitor,
          onSelect: (value) => handleQuickJumpSelect('competitor', value),
          optionFilterProp: 'label',
          disabled: !quickJumpSelectOptions.competitor.length,
          popupMatchSelectWidth: false,
          style: { width: '220px', maxWidth: '36vw' },
        })
      )
    );

    return React.createElement('div', { ref: rootRef, style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),
      keywordManagerModal,
      targetManagerModal,
      couponManagerModal,
      competitorManagerModal,
      React.createElement(MergedTrendChartModal, { visible: trendChartVisible, onClose: () => setTrendChartVisible(false), country: filterCountry, asin: filterAsin, dateRange: getDateRange }),
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', columnGap: '14px', rowGap: '6px', flexWrap: 'wrap', marginBottom: '4px' },
      },
        headerInfoEl,

        // 预设颜色图例
        React.createElement('div', {
          style: { display: 'inline-flex', width: 'fit-content', maxWidth: '100%', columnGap: '8px', rowGap: '4px', flexWrap: 'wrap', minHeight: '30px', padding: '5px 10px', background: '#fafafa', borderRadius: '8px', border: '1px solid #d9d9d9', boxShadow: '0 1px 2px rgba(15,23,42,0.05)', alignItems: 'center', fontSize: `${FONT_SIZE_XS}px`, boxSizing: 'border-box' }
        },
          React.createElement('span', { style: { fontWeight: 600, color: '#555', marginRight: '4px' } }, '列头颜色：'),
          ...primaryColorLegendItems.map(renderColorLegendItem),
          React.createElement('button', {
            type: 'button',
            onClick: () => setColorLegendExpanded((v) => !v),
            title: colorLegendExpanded ? '收起剩余列头颜色' : '向右展开剩余列头颜色',
            style: {
              minHeight: '22px',
              padding: '1px 7px',
              border: '1px solid #d9d9d9',
              borderRadius: '5px',
              background: '#fff',
              color: '#555',
              cursor: 'pointer',
              fontSize: `${FONT_SIZE_XS}px`,
              fontWeight: 700,
              lineHeight: '18px',
              whiteSpace: 'nowrap',
            },
          }, colorLegendExpanded ? '‹ 收起' : '展开 ›'),
          colorLegendExpanded && React.createElement(React.Fragment, null,
            React.createElement('span', { style: { color: '#bbb' } }, '|'),
            ...extraColorLegendItems.map((pc, idx) => renderColorLegendItem(pc, idx + primaryColorLegendItems.length))
          ),
        ),
        quickJumpEl
      ),

      panelEl,
      pushPanelEl,
      crossHighlightPanelEl,

      // 销售操作区
      React.createElement('div', { style: { display: 'flex', columnGap: '8px', rowGap: '6px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '6px', alignItems: 'stretch' } },
        React.createElement('div', {
          style: {
            display: 'flex',
            columnGap: '5px',
            rowGap: '5px',
            flexWrap: 'wrap',
            alignItems: 'center',
            minHeight: '38px',
            boxSizing: 'border-box',
            padding: '6px 8px',
            background: '#ffe1e1',
            border: '2px solid #f5222d',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(245,34,45,0.12)',
          },
        },
        React.createElement('span', { style: { color: '#a8071a', fontSize: `${FONT_SIZE}px`, fontWeight: 800, marginRight: '3px', lineHeight: '20px', whiteSpace: 'nowrap' } }, '需设置：'),
          React.createElement(Select, {
            value: columnSearchValue,
            showSearch: true,
            allowClear: true,
            placeholder: '搜索列并跳转',
            size: 'small',
            options: columnSearchOptions,
            optionFilterProp: 'searchText',
            filterOption: (input, option) => (option?.searchText || '').includes(normalizeColumnSearchText(input)),
            onChange: (value) => setColumnSearchValue(value || undefined),
            onSelect: (value) => locateColumn(value),
            style: { width: '240px', minWidth: '220px', flexShrink: 0 },
            popupMatchSelectWidth: false,
          }),
          React.createElement('button', { type: 'button', ref: panelBtnRef, onClick: () => { setShowPanel((v) => { const next = !v; if (next) setCollapsedGroups(getDefaultCollapsedGroups()); return next; }); setShowPush(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '列设置'),
          IS_ADMIN && React.createElement('button', { type: 'button', ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '推送配置'),
          React.createElement('button', {
            type: 'button',
            ref: crossHighlightBtnRef,
            onClick: () => { setShowCrossHighlightPanel((v) => !v); setShowPanel(false); setShowPush(false); },
            style: btnStyle('#EB6793', '#fff', '#d84f7c'),
          }, crossHighlightEnabled ? '高亮行列：开' : '高亮行列'),
          React.createElement('button', { type: 'button', onClick: openTargetManager, disabled: !currentCountryAsin, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentCountryAsin ? 1 : 0.6, cursor: currentCountryAsin ? 'pointer' : 'not-allowed' } }, '管理目标值'),
          React.createElement('button', { type: 'button', onClick: openCompetitorManager, disabled: !currentCountryAsin, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentCountryAsin ? 1 : 0.6, cursor: currentCountryAsin ? 'pointer' : 'not-allowed' } }, '管理竞对 ASIN'),
          React.createElement('button', { type: 'button', onClick: openKeywordManager, disabled: !currentCountryAsin, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentCountryAsin ? 1 : 0.6, cursor: currentCountryAsin ? 'pointer' : 'not-allowed' } }, '管理 SQP 关键词'),
          React.createElement('button', { type: 'button', onClick: openCouponManager, disabled: !currentAsinCountry, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentAsinCountry ? 1 : 0.6, cursor: currentAsinCountry ? 'pointer' : 'not-allowed' } }, '管理 Coupon 预估比例'),
          React.createElement('button', { type: 'button', onClick: () => { setTrendChartVisible(true); setShowPanel(false); setShowPush(false); setShowCrossHighlightPanel(false); }, disabled: !currentCountryAsin, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentCountryAsin ? 1 : 0.6, cursor: currentCountryAsin ? 'pointer' : 'not-allowed' } }, '打开图表'),
        ),

        React.createElement('div', {
          style: {
            display: 'flex',
            columnGap: '6px',
            rowGap: '5px',
            flexWrap: 'wrap',
            alignItems: 'center',
            minHeight: '38px',
            boxSizing: 'border-box',
            padding: '6px 8px',
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '8px',
            boxShadow: '0 1px 3px rgba(15,23,42,0.06)',
          },
        },
          React.createElement('button', {
            type: 'button',
            onClick: refreshData,
            disabled: actionBusy,
            style: {
              ...btnStyle(actionBusy ? '#f5f5f5' : '#fff', actionBusy ? '#999' : '#333', '#d9d9d9'),
              opacity: actionBusy ? 0.65 : 1,
              cursor: actionBusy ? 'not-allowed' : 'pointer',
            },
          }, refreshingData ? '刷新中...' : '刷新'),
          // 日期筛选下拉
          React.createElement(Select, {
            value: dateFilterType,
            onChange: (v) => { setDateFilterType(v); if (v !== 'custom') setCustomDateRange(null); },
            options: DATE_FILTER_OPTIONS,
            style: { width: '118px' },
            size: 'small',
          }),
          React.createElement('span', {
            style: {
              minHeight: '26px',
              display: 'inline-flex',
              alignItems: 'center',
              padding: '0 8px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              background: '#fafafa',
              color: '#555',
              fontSize: `${FONT_SIZE_XS}px`,
              fontWeight: 700,
              lineHeight: '16px',
              whiteSpace: 'nowrap',
              boxSizing: 'border-box',
            },
          }, '日期范围'),

          // 自定义日期范围选择器
          React.createElement(DatePicker.RangePicker, {
            locale: DATE_PICKER_LOCALE,
            value: customDateRange
              ? [ctx.libs.dayjs(customDateRange[0]), ctx.libs.dayjs(customDateRange[1])]
              : null,
            onChange: (dates) => {
              if (dates && dates[0] && dates[1]) {
                const range = [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')];
                setCustomDateRange(range);
                setDateFilterType('custom');
              } else {
                setCustomDateRange(null);
                if (dateFilterType === 'custom') setDateFilterType('all');
              }
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
          formulaProgressEl,
        ),
      ),

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
        },
      }),

      // 表格
      React.createElement('div', {
        ref: tableWrapRef,
        tabIndex: 0,
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleKeyDown,
        onDragOver: onTableDragOver,
        onMouseUp: stopSelecting,
        onMouseLeave: stopSelecting,
        style: { overflowX: 'auto', overflowY: 'auto', height: tableWrapHeight, borderRadius: '8px', border: '1px solid #d9d9d9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', background: '#fff', outline: 'none' }
      },
        !hasRequiredUrlParams
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据 请重新进入页面')
          : loading && data.length === 0
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '正在加载数据...')
          : data.length === 0
            ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据')
            : React.createElement(React.Fragment, null,
              React.createElement('div', {
                style: {
                  position: 'sticky',
                  top: 0,
                  zIndex: 6,
                  height: `${HEADER_GROUP_HEIGHT}px`,
                  width: `${tableWidth}px`,
                  background: '#fff',
                  borderBottom: '1px solid rgba(0,0,0,0.16)',
                  boxSizing: 'border-box',
                },
              },
                headerColumnGroups.map((group) => {
                  const firstCol = group.cols[0];
                  const isPinned = group.pinnedWidth > 0;
                  const groupMeta = columnGroupMetaMap[group.key] || { label: group.key || '其他字段', color: COLOR_GRAY };
                  const groupColor = groupMeta.color || COLOR_GRAY;
                  return React.createElement('div', {
                    key: `section_${group.key}_${firstCol.key}`,
                    style: {
                      position: isPinned ? 'sticky' : 'absolute',
                      left: isPinned ? `${group.pinnedLeft || 0}px` : `${group.left}px`,
                      top: 0,
                      width: `${isPinned ? group.pinnedWidth : group.width}px`,
                      height: `${HEADER_GROUP_HEIGHT}px`,
                      padding: '4px 8px',
                      background: groupColor,
                      color: getTextColorForBg(groupColor),
                      borderRight: isPinned ? '2px solid rgba(0,0,0,0.18)' : '1px solid rgba(0,0,0,0.16)',
                      textAlign: 'center',
                      fontWeight: 700,
                      fontSize: `${FONT_SIZE_SM}px`,
                      whiteSpace: 'normal',
                      lineHeight: '15px',
                      overflow: 'hidden',
                      boxSizing: 'border-box',
                      zIndex: isPinned ? 8 : 7,
                      boxShadow: isPinned ? '1px 0 0 rgba(0,0,0,0.05)' : undefined,
                    },
                  }, groupMeta.label);
                })
              ),
              React.createElement('table', { style: { borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', background: '#fff', width: `${tableWidth}px` } },
                React.createElement('thead', null,
                  React.createElement('tr', null,
                    visibleCols.map((col) => {
                      const isPinned = col.pinned;
                      const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                      const hdrColor = getColHeaderColor(col);
                      const isCompetitorSubCol = !!col._isCompetitorSubColumn;

                      if (isCompetitorSubCol) {
                        const groupCols = visibleCols.filter((c) => c._competitorGroupKey === col._competitorGroupKey);
                        if (groupCols[0]?.key !== col.key) return null;
                        const groupWidth = groupCols.reduce((sum, item) => sum + (item.width || 80), 0);
                        const groupSortKey = groupCols.find((item) => item._competitorField === 'rank')?.key || col.key;
                        const groupHdrColor = col._competitorGroupHeaderColor || getCompetitorColor(col._competitorRole) || hdrColor;
                        const groupHighlighted = groupCols.some((item) => item.key === highlightColumnKey);
                        return React.createElement('th', {
                          colSpan: groupCols.length,
                          key: col._competitorGroupKey,
                          draggable: true,
                          onDragStart: (e) => onDragStart(e, col.key),
                          onDragOver,
                          onDrop: (e) => onDrop(e, col.key),
                          onClick: () => handleSort(groupSortKey),
                          style: {
                            position: 'sticky',
                            top: `${HEADER_GROUP_HEIGHT}px`,
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 4 : 2,
                            width: `${groupWidth}px`,
                            height: `${HEADER_MAIN_HEIGHT}px`,
                            padding: '2px 6px',
                            background: groupHighlighted ? '#FFF1B8' : groupHdrColor,
                            color: getTextColorForBg(groupHdrColor),
                            borderBottom: '1px solid rgba(0,0,0,0.08)',
                            borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                            textAlign: 'center',
                            fontWeight: 600,
                            fontSize: `${FONT_SIZE_XS}px`,
                            userSelect: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'normal',
                            lineHeight: '15px',
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            boxShadow: groupHighlighted ? 'inset 0 0 0 2px #faad14' : undefined,
                          },
                        },
                        React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', minWidth: 0, overflow: 'hidden', verticalAlign: 'middle' } },
                          renderCompetitorGroupHeaderLabel(col),
                          renderSortMark(groupSortKey),
                        )
                        );
                      }

                      const isHighlighted = highlightColumnKey === col.key;
                      return React.createElement('th', {
                        rowSpan: hasCompetitorColumns ? 2 : 1,
                        key: col.key, draggable: true,
                        onDragStart: (e) => onDragStart(e, col.key),
                        onDragOver,
                        onDrop: (e) => onDrop(e, col.key),
                        onClick: () => handleSort(col.key),
                        style: {
                          position: 'sticky', top: `${HEADER_GROUP_HEIGHT}px`, left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 4 : 2,
                          width: `${col.width || 80}px`,
                          padding: '5px 16px 5px 6px',
                          background: isHighlighted ? '#FFF1B8' : hdrColor,
                          color: getTextColorForBg(hdrColor),
                          borderBottom: '2px solid rgba(0,0,0,0.12)',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                          textAlign: 'center', fontWeight: 600,
                          fontSize: `${FONT_SIZE_SM}px`,
                          userSelect: 'none', cursor: 'pointer',
                          whiteSpace: 'normal',
                          lineHeight: '15px',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          boxShadow: isHighlighted ? 'inset 0 0 0 2px #faad14' : undefined,
                        },
                      },
                        React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', minWidth: 0, overflow: 'hidden', verticalAlign: 'middle' } },
                          renderHeaderLabel(col),
                          renderSortMark(col.key),
                        ),
                        React.createElement('div', { draggable: false, onMouseDown: (e) => onResizeStart(e, col.key), onClick: (e) => e.stopPropagation(), onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); }, style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 2, background: 'transparent' } }),
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
                      const isHighlighted = highlightColumnKey === col.key;
                      return React.createElement('th', {
                        key: `${col.key}_sub`,
                        draggable: true,
                        onDragStart: (e) => onDragStart(e, col.key),
                        onDragOver,
                        onDrop: (e) => onDrop(e, col.key),
                        onClick: () => handleSort(col.key),
                        style: {
                          position: 'sticky',
                          top: `${HEADER_GROUP_HEIGHT + HEADER_MAIN_HEIGHT}px`,
                          left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 4 : 2,
                          width: `${col.width || 80}px`,
                          height: `${HEADER_SUB_HEIGHT}px`,
                          padding: '2px 4px',
                          background: isHighlighted ? '#FFF1B8' : hdrColor,
                          borderBottom: '2px solid rgba(0,0,0,0.12)',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          userSelect: 'none',
                          boxShadow: isHighlighted ? 'inset 0 0 0 2px #faad14' : undefined,
                        },
                      },
                        React.createElement('span', { style: { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', width: '100%', overflow: 'hidden' } },
                          renderHeaderLabel({ ...col, label: col._competitorSubLabel || col.label }),
                          renderSortMark(col.key),
                        ),
                        React.createElement('div', { draggable: false, onMouseDown: (e) => onResizeStart(e, col.key), onClick: (e) => e.stopPropagation(), onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); }, style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 2, background: 'transparent' } })
                      );
                    })
                  )
                ),
                React.createElement('tbody', null,
                  pagedData.map((row, rIdx) => {
                    const rowId = row.country_asin_date || row.country_asin_week_range || row.id;
                    const isSummaryRow = row.__rowType === WEEKLY_SUMMARY_ROW_TYPE;
                    return React.createElement('tr', { key: rowId || rIdx, style: { background: isSummaryRow ? WEEKLY_SUMMARY_BG : (rIdx % 2 === 0 ? '#fff' : '#fafafa') } },
                      visibleCols.map((col, cIdx) => {
                        const isPinned  = col.pinned;
                        const leftOff   = isPinned ? pinnedLeftMap[col.key] : undefined;
                        const dynFn     = DYNAMIC_COLOR[col.field] || DYNAMIC_COLOR[col.key];
                        const cellColor = isSummaryRow ? '#0f172a' : (dynFn ? dynFn(row) : null);
                        const isNum     = ALL_NUMERIC.has(col.field) || col.field === 'promo_day';
                        const canEdit   = !isSummaryRow && isCellEditable(col);
                        const isEditing = editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key;
                        const selected  = isCellSelected(rIdx, cIdx);
                        const isSelectionInputCell = selectionInputValue !== '' && selected && canEdit;
                        const isHighlighted = highlightColumnKey === col.key;
                        const bodyCellBackground = getBodyCellBackground(rIdx, cIdx, selected, col);
                        const cellBackground = isSummaryRow ? WEEKLY_SUMMARY_BG : (isHighlighted ? '#FFF7D6' : bodyCellBackground);
                        const weeklyMergedCell = !isSummaryRow && MERGED_WEEKLY_DISPLAY_FIELDS.has(col.field)
                          ? weeklyMergedCellMap[rowId]?.[col.key]
                          : null;
                        const isWeeklyMergedDisplayCell = Boolean(weeklyMergedCell);
                        if (isWeeklyMergedDisplayCell && weeklyMergedCell.rowSpan === 0) return null;

                        if (!isSummaryRow && shouldUseRichEdit(col, canEdit)) {
                          const richCellKey = `${rowId || rIdx}__${col.key}`;
                          const richValue =
                            col._dynamicKind === 'keyword'
                              ? row[col.field]?.daily?.actual_rank
                              : col._dynamicKind === 'competitor'
                              ? row[col.field]?.daily?.[col._competitorField || 'notes']
                              : getCellValue(col, row);
                          const openRichEditorFromCell = (e) => {
                            if (e.target?.closest?.('[data-rich-editor-panel="1"]')) return;
                            e.preventDefault();
                            e.stopPropagation();
                            selectingRef.current = false;
                            selectionDraftRef.current = null;
                            selectionStore.setRange(null);
                            setSelectedRange(null);
                            setSelectionInputValue('');
                            const rect = e.currentTarget.getBoundingClientRect();
                            setRichEditOpenSignal({
                              cellKey: richCellKey,
                              tick: Date.now(),
                              rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
                            });
                          };
                          const saveRich =
                            col._dynamicKind === 'keyword'
                              ? (next) => saveKeywordRichCell(row, col, next)
                              : col._dynamicKind === 'competitor'
                              ? (next) => saveCompetitorRichCell(row, col, next)
                              : (next) => saveStaticRichCell(row, col, next);

                          return React.createElement('td', {
                            key: col.key,
                            rowSpan: weeklyMergedCell?.rowSpan || undefined,
                            onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                            onDoubleClickCapture: openRichEditorFromCell,
                            onMouseEnter: (e) => handleCellMouseEnter(e, rIdx, cIdx),
                            style: {
                              position: isPinned ? 'sticky' : 'relative',
                              left: isPinned ? `${leftOff}px` : undefined,
                              zIndex: isPinned ? 1 : undefined,
                              background: cellBackground,
                              padding: '2px',
                              borderBottom: '1px solid #e8e8e8',
                              borderRight: isPinned ? '2px solid rgba(0,0,0,0.18)' : '1px solid #e8e8e8',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              boxSizing: 'border-box',
                              userSelect: 'none',
                              boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : (isHighlighted ? 'inset 0 0 0 2px #faad14' : (isPinned ? '1px 0 0 rgba(0,0,0,0.05)' : undefined)),
                            },
                          },
                            React.createElement(RichTextImageCell, {
                              value: richValue,
                              onSave: saveRich,
                              placeholder: '+',
                              cellKey: richCellKey,
                              openSignal: richEditOpenSignal,
                              cellBackground,
                              onAfterSaveExit: focusClipboardWithoutScroll,
                            }),
                            React.createElement(SelectionOverlay, {
                              store: selectionStore,
                              rowIndex: rIdx,
                              columnIndex: cIdx,
                            })
                          );
                        }

                        const cachedCellDisplay = cellDisplayCache[rIdx]?.[cIdx];
                        const displayContent = isSelectionInputCell
                          ? selectionInputValue
                          : cachedCellDisplay?.displayContent;
                        const renderedContent = isSelectionInputCell
                          ? selectionInputValue
                          : cachedCellDisplay?.renderedContent;

                        return React.createElement('td', {
                          key: col.key,
                          rowSpan: weeklyMergedCell?.rowSpan || undefined,
                          title: typeof renderedContent === 'string' ? renderedContent : (typeof displayContent === 'string' ? displayContent : undefined),
                          onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                          onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, getCellValue(col, row)); },
                          style: {
                            position: isPinned ? 'sticky' : 'relative',
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 1 : undefined,
                            background: cellBackground,
                            padding: isEditing ? '3px 5px' : '5px 8px',
                            borderBottom: '1px solid #e8e8e8',
                            borderRight: isPinned ? '2px solid rgba(0,0,0,0.18)' : '1px solid #e8e8e8',
                            whiteSpace: isWeeklyMergedDisplayCell ? 'normal' : 'nowrap',
                            overflow: 'hidden',
                            textOverflow: isWeeklyMergedDisplayCell ? 'clip' : 'ellipsis',
                            textAlign: 'center',
                            verticalAlign: isWeeklyMergedDisplayCell ? 'middle' : undefined,
                            lineHeight: isWeeklyMergedDisplayCell ? '18px' : undefined,
                            color: cellColor || '#1a1a1a',
                            fontWeight: isSummaryRow ? 700 : (cellColor ? 600 : 500),
                            fontSize: `${FONT_SIZE}px`,
                            boxSizing: 'border-box',
                            userSelect: 'none',
                            cursor: canEdit && !isEditing ? 'cell' : 'default',
                            outline: canEdit && !isEditing ? '1px dashed transparent' : undefined,
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : (isHighlighted ? 'inset 0 0 0 2px #faad14' : (isPinned ? '1px 0 0 rgba(0,0,0,0.05)' : undefined)),
                          },
                          onMouseEnter: (e) => {
                            handleCellMouseEnter(e, rIdx, cIdx);
                            if (canEdit && !isEditing) e.currentTarget.style.outline = '1px dashed #1890ff';
                          },
                          onMouseLeave: canEdit && !isEditing ? (e) => { e.currentTarget.style.outline = '1px dashed transparent'; } : undefined,
                        },
                          isEditing ? renderEditInput(col) : renderedContent,
                          React.createElement(SelectionOverlay, {
                            store: selectionStore,
                            rowIndex: rIdx,
                            columnIndex: cIdx,
                          })
                        );
                      })
                    );
                  })
                )
              )
            )
      ),

      // 分页
      React.createElement('div', { style: { marginTop: '6px', padding: '0 2px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' } },
        React.createElement(Pagination, {
          current: curPage, pageSize, total,
          locale: PAGINATION_LOCALE,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`,
          onChange: onPageChange,
          onShowSizeChange: onPageChange,
          disabled: loading
        })
      ),
    );
  };

  const TableApp = () => {
    const zhCN = { locale: 'zh_CN', DatePicker: DATE_PICKER_LOCALE };
    return React.createElement(ConfigProvider, { locale: zhCN },
      React.createElement('div', { style: { padding: '0', fontFamily: 'system-ui, sans-serif', fontSize: `${FONT_SIZE}px`, WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility', fontVariantNumeric: 'tabular-nums' } },
        React.createElement(MergedTable, null)
      )
    );
  };

  ctx.render(React.createElement(TableApp));
}
run();
