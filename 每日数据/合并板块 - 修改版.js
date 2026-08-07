async function run() {
  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect, useSyncExternalStore } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Drawer, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal, Upload } = ctx.libs.antd;
  const { DeleteOutlined, SaveOutlined, UploadOutlined, DownloadOutlined, StarFilled } = ctx.libs.antdIcons || {};

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const COLUMN_VIEW_SETTING_KEY = `${BLOCK_UID}__column_view_setting`;
  const DEFAULT_COLUMN_VIEWS_KEY = `${BLOCK_UID}__default_column_views`;
  const CHART_QUICK_SETTING_KEY = `${BLOCK_UID}__chart_quick_groups`;
  const IMPORTANT_CELL_SETTING_KEY = `${BLOCK_UID}__important_cells`;
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
  const CUSTOM_DEFAULT_COLUMN_VIEW_PREFIX = 'default_custom_';
  const CORE_COLUMN_VIEW_ID = DEFAULT_COLUMN_VIEW_IDS[1];

  const FONT_SIZE    = 15;
  const FONT_SIZE_SM = FONT_SIZE - 1;
  const FONT_SIZE_XS = FONT_SIZE - 2;
  const SAFE_WRITE_BATCH_SIZE = 10;
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
  const KEYWORD_DEFAULT_HEADER_COLOR = '#9DF29F';
  const LEGACY_KEYWORD_HEADER_COLORS = new Set(['#FCC102', '#EB6793']);
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
    { label:'默认自动抓取，也可手动复核',      value:KEYWORD_DEFAULT_HEADER_COLOR },
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
    keyword_position: KEYWORD_DEFAULT_HEADER_COLOR,
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
    { label: '近 14 天',  value: '14d'        },
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
    { key:'weekly_impressions',                 src:'weekly', field:'impressions',                  label:'广告曝光量',          hidden:false, pinned:false, width:80,  editable:false, columnGroup:'ad_data' },
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
    { key:'weekly_organic_traffic',         src:'weekly', field:'organic_traffic',         label:'自然流量（会话量-广告点击）', group:'traffic_conversion', axis:'left',  valueType:'integer' },
    { key:'weekly_session_conversion_rate', src:'weekly', field:'session_conversion_rate', label:'会话转化率',                group:'traffic_conversion', axis:'right', valueType:'percent' },
    { key:'order_link_onsite_organic_orders', src:'order_link', field:'onsite_organic_orders', label:'③站内纯自然单',          group:'order_structure',    axis:'left',  valueType:'integer' },
    { key:'order_link_onsite_ad_orders',    src:'order_link', field:'onsite_ad_orders',     label:'④站内总广告单',            group:'order_structure',    axis:'left',  valueType:'integer' },
    { key:'weekly_adv_rate',                src:'weekly', field:'adv_rate',                label:'广告订单量占比',            group:'ad_data',            axis:'right', valueType:'percent' },
    { key:'weekly_impressions',             src:'weekly', field:'impressions',             label:'广告曝光量',                    group:'ad_data',            axis:'left',  valueType:'integer' },
    { key:'weekly_guanggaodianji',          src:'weekly', field:'guanggaodianji',          label:'广告点击量',                group:'ad_data',            axis:'left',  valueType:'integer' },
    { key:'weekly_guanggaohuafei',          src:'weekly', field:'guanggaohuafei',          label:'广告花费',                  group:'ad_data',            axis:'left',  valueType:'decimal' },
    { key:'weekly_ad_sales_amount',         src:'weekly', field:'ad_sales_amount',         label:'广告销售额',                group:'ad_data',            axis:'left',  valueType:'decimal' },
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
    { key:'order_traffic_conversion', label:'订单&流量&转化', sourceGroups:['fixed', 'traffic_conversion', 'order_structure'] },
    { key:'ad_data',                  label:'广告数据',        sourceGroups:['ad_data'] },
    { key:'profit',                   label:'利润数据',        sourceGroups:['profit'] },
  ];
  const TREND_CHART_PRESETS = {
    traffic: ['weekly_zongliuliang', 'weekly_organic_traffic', 'weekly_guanggaodianji'],
    orderStructure: ['order_link_onsite_organic_orders', 'order_link_onsite_ad_orders'],
    adConversion: ['weekly_ctr', 'weekly_guanggaocvr'],
    adEfficiency: ['weekly_cpa', 'weekly_cpu'],
    adInvestment: ['weekly_guanggaohuafei', 'weekly_ad_sales_amount'],
  };
  const TREND_CHART_PRESET_OPTIONS = [
    { value:'traffic',        label:'流量结构' },
    { value:'orderStructure', label:'订单结构' },
    { value:'adConversion',   label:'广告转化' },
    { value:'adEfficiency',   label:'广告效率' },
    { value:'adInvestment',   label:'广告投入效果' },
  ];
  const TREND_CHART_DEFAULT_PRESET_KEY = 'traffic';
  const TREND_CHART_DEFAULT_FIELD_KEYS = TREND_CHART_PRESETS[TREND_CHART_DEFAULT_PRESET_KEY];
  const TREND_CHART_LINE_COLORS = ['#38BDF8','#F59E0B','#34D399','#FB7185','#A78BFA','#F97316','#22D3EE','#E879F9','#84CC16','#FACC15','#60A5FA','#F472B6'];
  const TREND_CHART_DATE_MODE_OPTIONS = [
    { value:'available', label:'已有数据日期' },
    { value:'7d',        label:'近7天' },
    { value:'30d',       label:'近30天' },
    { value:'custom',    label:'自定义日期' },
  ];
  const TREND_CHART_FIELD_KEY_SET = new Set(TREND_CHART_FIELDS.map((field) => field.key));
  const IMPORTANT_CELL_BACKGROUND = '#FFF1F0';
  const IMPORTANT_CELL_COLOR = '#CF1322';
  const IMPORTANT_CELL_BORDER = '#FF7875';
  const normalizeImportantCellKeys = (value) => {
    const rawKeys = Array.isArray(value?.keys) ? value.keys : (Array.isArray(value) ? value : []);
    return Array.from(new Set(rawKeys.map((key) => String(key || '').trim()).filter(Boolean)));
  };
  const getImportantCellRowKey = (row) => {
    if (!row) return null;
    const rowType = row.__rowType || 'data';
    const rawKey = row.country_asin_date || row.country_asin_week_range || row.id;
    return rawKey == null || rawKey === '' ? null : `${rowType}:${String(rawKey)}`;
  };
  const getImportantCellKey = (row, col) => {
    const rowKey = getImportantCellRowKey(row);
    const columnKey = String(col?.key || '').trim();
    return rowKey && columnKey ? JSON.stringify([rowKey, columnKey]) : null;
  };
  const loadImportantCellKeysFromUser = async () => {
    if (!currentUserId) return [];
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    return normalizeImportantCellKeys(userRes?.data?.data?.setting?.[IMPORTANT_CELL_SETTING_KEY]);
  };
  const saveImportantCellKeysToUser = async (keys) => {
    if (!currentUserId) throw new Error('未识别到当前用户');
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    const existingSetting = userRes?.data?.data?.setting || {};
    await ctx.request({
      url: 'users:update',
      method: 'post',
      params: { filterByTk: currentUserId },
      data: {
        setting: {
          ...existingSetting,
          [IMPORTANT_CELL_SETTING_KEY]: { keys: normalizeImportantCellKeys(keys) },
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return true;
  };
  const normalizeTrendChartQuickGroups = (groups) => {
    if (!Array.isArray(groups)) return [];
    const seenIds = new Set();
    const seenNames = new Set();
    return groups.reduce((result, group) => {
      const id = String(group?.id || '').trim();
      const name = String(group?.name || '').trim();
      const fields = Array.from(new Set(Array.isArray(group?.fields) ? group.fields : []))
        .filter((field) => TREND_CHART_FIELD_KEY_SET.has(field));
      const normalizedName = name.toLocaleLowerCase();
      if (!id || !name || !fields.length || seenIds.has(id) || seenNames.has(normalizedName)) return result;
      seenIds.add(id);
      seenNames.add(normalizedName);
      result.push({ id, name, fields });
      return result;
    }, []);
  };
  const isTrendChartQuickNameTaken = (name, customGroups = []) => {
    const normalizedName = String(name || '').trim().toLocaleLowerCase();
    if (!normalizedName) return false;
    return TREND_CHART_PRESET_OPTIONS.some((option) => option.label.toLocaleLowerCase() === normalizedName)
      || customGroups.some((group) => group.name.toLocaleLowerCase() === normalizedName);
  };
  const loadTrendChartQuickGroupsFromUser = async () => {
    if (!currentUserId) return [];
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    return normalizeTrendChartQuickGroups(userRes?.data?.data?.setting?.[CHART_QUICK_SETTING_KEY]);
  };
  const saveTrendChartQuickGroupsToUser = async (groups) => {
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
          [CHART_QUICK_SETTING_KEY]: normalizeTrendChartQuickGroups(groups),
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return true;
  };

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

  const WEEKLY_PERFORMANCE_UPDATE_TOOLTIP_TEXT = '每天更新2次（早上8点、16点），每次更新过去7天的数据；';
  const WEEKLY_PERFORMANCE_AD_UPDATE_TOOLTIP_TEXT = '每天更新2次（早上8点、16点），每次更新过去7天的数据；';
  const WEEKLY_PERFORMANCE_SALES_DIRECT_TOOLTIP_TEXT = '该数据由系统定时同步，无需手工填写。';
  const WEEKLY_PERFORMANCE_SALES_CALCULATED_TOOLTIP_TEXT = '该指标由系统定时计算并同步，无需手工填写。';
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
  const CURRENT_DAY_DATA_TOOLTIP_TEXT = '每次更新当天的数据。';

  const DAILY_SYNC_SOURCE_INFOS = [
    { workflow: '每日生成类型、asin数据', schedule: '早场 06/07/08 任一时间；晚场 18/19 任一时间', scope: 'JP', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '晚场 22/23 任一时间', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    { workflow: '每日生成类型、asin数据', schedule: '早场 13/14/15 任一时间；晚场 20/21 任一时间', scope: 'DE/FR', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
  ];

  const SQL_UPDATED_FIELD_TEXT = {
    'daily.date': '每天自动生成从今天起未来 3 个月的日期。',
    'daily.activity_annotation': '每天5:30更新，自动同步领星的BD/LD，其他如专享/coupon等需要手动填写',
    'daily.daily_price': `购物车价格\n${DAILY_SYNC_TOOLTIP_TEXT}\n${CURRENT_DAY_DATA_TOOLTIP_TEXT}`,
    'daily.list_price': `LP/WP/TP\n${DAILY_SYNC_TOOLTIP_TEXT}\n${CURRENT_DAY_DATA_TOOLTIP_TEXT}`,
    'daily.star_rating': `星级\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    'daily.number_of_comments': `Review 数量\n${DAILY_SYNC_TOOLTIP_TEXT}\n${CURRENT_DAY_DATA_TOOLTIP_TEXT}`,
    'daily.selling_accounts': `售卖账号\n${DAILY_SYNC_TOOLTIP_TEXT}\n${CURRENT_DAY_DATA_TOOLTIP_TEXT}`,
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
      formula: `自己页面截图\n${DAILY_SYNC_TOOLTIP_TEXT}\n${CURRENT_DAY_DATA_TOOLTIP_TEXT}`,
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
      formula: '日明细：直接显示数据表中的本周广告总预算，无需手工填写。',
      weeklySummaryFormula: '系统计算本周预算，并显示本周广告花费占预算的比例。',
      emptyRules: [
        '日明细：weekly_performance.weekly_ad_total_budget 为空',
        '周汇总预算：目标 CPU 或本周目标拆解单量合计为空',
        '周汇总显示比例：本周广告花费为空，或周汇总预算为空/为 0',
      ],
      fields: [
        { label: '日明细读取字段', field: 'weekly_performance.weekly_ad_total_budget' },
        { label: '日明细页面 JS 处理', field: '仅读取，不计算、不回写' },
        { label: '目标 CPU', field: 'target_default.ideal_cpu_by_margin' },
        { label: '本周目标拆解单量合计', field: 'target_management.target_order_qty（同一自然周汇总）' },
        { label: '本周广告花费合计', field: 'weekly_performance.guanggaohuafei（同一自然周汇总）' },
        { label: '周汇总预算公式', field: '目标 CPU × 本周目标拆解单量合计' },
        { label: '周汇总显示公式', field: '本周广告花费合计 ÷ 周汇总预算' },
      ],
      writeBackField: 'daily_weekly_summary.merge_summary_data.weekly_ad_total_budget（仅周汇总）',
      salesSectionTitle: '日明细口径',
    },
    weekly_target_completion_rate: {
      title: '本周目标完成率',
      formula: '日合并行：若本周广告花费为空则为空；若本周广告花费 > 本周广告总预算则提示广告预算超预期；否则按秒杀天数与目标广告费率判断利润空间，并拼接本周目标完成率。',
      weeklySummaryFormula: '本周实际总单量合计 ÷ 本周目标拆解单量合计。',
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
      salesSectionTitle: '日明细口径',
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
      formula: '按当前 ASIN_国家和站点时间直接匹配订单列表，统计测评订单标记为“是”且订单状态不是 Canceled 的订单数量；没有符合条件的订单时保留原值。',
      emptyRules: ['当前 ASIN_国家为空时保留原值', '当前站点时间为空时保留原值', '未匹配到符合条件的订单时保留原值', '订单日期为空或与当前站点时间不一致时不计入', '测评订单标记不等于“是”时不计入', '订单状态为 Canceled 时不计入'],
      fields: [
        { label: '当前 ASIN_国家', field: 'daily_asins.asin_country = order_list.asin_country_code' },
        { label: '当前站点时间', field: 'daily_asins.date = DATE(order_list.order_date)' },
        { label: '测评订单标记', field: "order_list.Invite_order = '是'" },
        { label: '订单状态', field: "order_list.status != 'Canceled'" },
        { label: '测评单数量', field: 'COUNT(order_list.order_number)；数量大于 0 时写回，等于 0 时保留 daily_asins.rsg_number 原值' },
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
      formula: [
        '该指标由页面自动计算。',
        '计算口径：实际总单量 ÷ 汇总流量-会话量。',
      ],
      emptyRules: ['实际总单量为空', '汇总流量-会话量为空或为 0'],
      fields: [
        { label: '生成方式', field: '页面 JS 计算并保留 4 位小数' },
        { label: '计算公式', field: 'round(sales ÷ zongliuliang, 4)' },
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '汇总流量-会话量', field: 'weekly_performance.zongliuliang' },
      ],
      writeBackField: 'weekly_performance.session_conversion_rate',
      salesSectionTitle: '销售说明',
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
    { src:'coupon_flash', label:'优惠券与秒杀费用测算', color:GROUP_COLOR_COUPON_FLASH },
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
  const WEEKLY_SUMMARY_LAST_SOURCE_FIELDS = new Set([
    'target_ad_cvr','target_cpa','ideal_cpu_by_margin',
    'target_profit_margin','target_ad_spend_rate','exchange_rate',
  ]);
  const WEEKLY_SUMMARY_TOOLTIP_OWNED_FIELDS = new Set([
    'weekly_ad_total_budget','weekly_target_completion_rate',
  ]);
  // Keep these descriptions aligned with buildWeeklySummaryFromRows below.
  const WEEKLY_SUMMARY_DERIVED_TOOLTIP_TEXT = {
    review_orders_ratio: '本周①测评单合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    offsite_orders_ratio: '本周站外订单合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    onsite_orders_ratio: '本周站内订单合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    onsite_organic_orders_ratio: '本周站内纯自然单合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    onsite_ad_orders_ratio: '本周站内广告单合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    adv_rate: '本周广告订单量合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    natural_traffic_proportion: '本周自然流量合计 ÷ 本周总流量合计，结果保留 4 位小数；总流量为空或为 0 时为空。',
    ctr: '本周广告点击量合计 ÷ 本周广告曝光量合计，结果保留 4 位小数；广告曝光量为空或为 0 时为空。',
    cpc: '本周广告花费合计 ÷ 本周广告点击量合计，结果保留 2 位小数；广告点击量为空或为 0 时为空。',
    acos: '本周广告花费合计 ÷ 本周广告销售额合计，结果保留 4 位小数；广告销售额为空或为 0 时为空。',
    tacos: '本周广告花费合计 ÷ 本周销售额（当地币）合计，结果保留 4 位小数；销售额为空或为 0 时为空。',
    guanggaocvr: '本周广告订单量合计 ÷ 本周广告点击量合计，结果保留 4 位小数；广告点击量为空或为 0 时为空。',
    cpa: '本周广告花费合计 ÷ 本周广告订单量合计，结果保留 2 位小数；广告订单量为空或为 0 时为空。',
    cpu: '本周广告花费合计 ÷ 本周实际总单量合计，结果保留 2 位小数；实际总单量为空或为 0 时为空。',
    session_conversion_rate: '本周实际总单量合计 ÷ 本周总流量合计，结果保留 4 位小数；总流量为空或为 0 时为空。',
    zongcvr: '本周实际总单量合计 ÷ 本周总流量合计，结果保留 4 位小数；总流量为空或为 0 时为空。',
    volume_cvr: '本周实际总单量合计 ÷ 本周总流量合计，结果保留 4 位小数；总流量为空或为 0 时为空。',
    cpo: '本周广告花费合计 ÷ 本周实际总单量合计，结果保留 2 位小数；实际总单量为空或为 0 时为空。',
    order_link_real_session_conversion_rate: '（本周实际总单量合计 - 本周①测评单合计）÷ 本周总流量合计，结果保留 4 位小数；任一必要值为空或总流量为 0 时为空。',
    real_session_conversion_rate: '与周汇总“实际 Session 转化率”相同，使用（本周实际总单量合计 - 本周①测评单合计）÷ 本周总流量合计。',
    page_view_conversion_rate: '本周实际总单量合计 ÷ 本周页面浏览量合计，结果保留 4 位小数；页面浏览量为空或为 0 时为空。',
    return_rate: '本周退款量合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    return_goods_rate: '本周退货量合计 ÷ 本周实际总单量合计，结果保留 4 位小数；实际总单量为空或为 0 时为空。',
    profit_margin: '本周净利润（当地币）合计 ÷ 本周成交额（当地币）合计，结果保留 4 位小数；成交额为空或为 0 时为空。',
    ad_cost_ratio: '本周广告花费合计 ÷ 本周销售额（当地币）合计，结果保留 4 位小数；销售额为空或为 0 时为空。',
    review_cost_ratio: '本周测评退款成本合计 ÷ 本周销售额（当地币）合计，结果保留 4 位小数；销售额为空或为 0 时为空。',
    product_cost_ratio: '本周产品成本合计 ÷ 本周销售额（当地币）合计，结果保留 4 位小数；销售额为空或为 0 时为空。',
    offsite_cost_per_order: '本周站外佣金合计 ÷ 本周站外订单合计，结果保留 2 位小数；站外订单为空或为 0 时为空。',
    flash_sale_cost_per_order: '本周秒杀总费用合计 ÷ 本周秒杀数量合计，结果保留 2 位小数；无法计算时按 0 显示。',
    unit_profit_after_ad_local: '本周净利润（当地币）合计 ÷ 本周实际总单量合计，结果保留 2 位小数；实际总单量为空或为 0 时为空。',
    unit_profit_rmb: '周汇总单台利润（当地币）× 本周最后一个有效汇率，结果保留 2 位小数；任一值为空时为空。',
    target_ad_cvr_formula: '将周汇总广告 CVR 与本周最后一个目标广告 CVR 比较：达标显示“√”，未达标显示差值。',
    target_cpa_formula: '将周汇总 CPA 与本周最后一个目标 CPA 比较：超标显示超出金额，否则显示“√”。',
    ideal_cpu_by_margin_formula: '将周汇总 CPU 与本周最后一个目标 CPU 比较：超标显示超出金额，否则显示“√”。',
    target_profit_margin_formula: '将周汇总利润率与本周最后一个目标利润率比较：未达标显示差值，否则显示“√”。',
    target_ad_spend_rate_formula: '将周汇总广告费率与本周最后一个目标广告费率比较：超标显示差值，否则显示“√”。',
  };

  const buildColumnPayload = (cols, preserved = []) => [
    ...cols.map((c) => ({ key: c.key, hidden: c.hidden === true, pinned: c.pinned === true, width: Number(c.width) || 80, headerColor: c.headerColor || null, bodyColor: getColBodyColor(c), editable: c.editable === true, richEdit: c.richEdit === true })),
    ...preserved,
  ];

  const normalizeColumnViewId = (viewId) => {
    const id = String(viewId || '').trim();
    return id || DEFAULT_COLUMN_VIEW_IDS[0];
  };

  const isBuiltinDefaultColumnViewId = (viewId) => DEFAULT_COLUMN_VIEW_IDS.includes(viewId);
  const isCustomDefaultColumnViewId = (viewId) => normalizeColumnViewId(viewId).startsWith(CUSTOM_DEFAULT_COLUMN_VIEW_PREFIX);
  const isDefaultColumnViewId = (viewId) => isBuiltinDefaultColumnViewId(viewId) || isCustomDefaultColumnViewId(viewId);
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
      ...Object.values(viewMap).filter((view) => !isBuiltinDefaultColumnViewId(view.id)),
    ];
  };

  const normalizeColumnViewState = (setting = {}) => {
    const defaultViews = normalizeColumnViewList(setting[DEFAULT_COLUMN_VIEWS_KEY]);
    const personalRaw = setting[COLUMN_VIEW_SETTING_KEY] || {};
    const personalViews = normalizeColumnViewList(personalRaw, { includeDefaultViews: false, onlyCustomViews: true });
    const customViews = personalViews.filter((view) => !isDefaultColumnViewId(view.id));
    const views = [
      ...defaultViews,
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
    const defaultViews = state.defaultViews.map((existing) => {
      const id = existing.id;
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
    const defaultViews = state.defaultViews.map((existing) => {
      const id = existing.id;
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

  const createDefaultColumnViewForCurrentUser = async (payload, name) => {
    if (!currentUserId || !IS_ADMIN) return null;
    const baseName = String(name || '').trim();
    if (!baseName) return null;
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    const existingSetting = userRes?.data?.data?.setting || {};
    const state = normalizeColumnViewState(existingSetting);
    const now = new Date().toISOString();
    const usedIds = new Set(state.views.map((view) => view.id).filter(Boolean));
    const usedNames = new Set(state.views.map((view) => getViewLabel(view)).filter(Boolean));
    let id = `${CUSTOM_DEFAULT_COLUMN_VIEW_PREFIX}${Date.now()}`;
    let idSuffix = 2;
    while (usedIds.has(id)) {
      id = `${CUSTOM_DEFAULT_COLUMN_VIEW_PREFIX}${Date.now()}_${idSuffix}`;
      idSuffix += 1;
    }
    let finalName = baseName;
    let nameSuffix = 2;
    while (usedNames.has(finalName)) {
      finalName = `${baseName}${nameSuffix}`;
      nameSuffix += 1;
    }
    const nextView = {
      id,
      name: finalName,
      type: 'default',
      payload: Array.isArray(payload) ? payload : [],
      updated_at: now,
    };
    const nextDefaultViews = [...state.defaultViews, nextView];
    const customViews = state.views.filter((view) => !isDefaultColumnViewId(view?.id));
    const nextViews = [...nextDefaultViews, ...customViews];
    await ctx.request({
      url: 'users:update',
      method: 'post',
      params: { filterByTk: currentUserId },
      data: {
        setting: {
          ...existingSetting,
          [DEFAULT_COLUMN_VIEWS_KEY]: { views: nextDefaultViews },
          [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload({ activeViewId: id, views: nextViews }, id),
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return { view: nextView, views: nextViews, defaultViews: nextDefaultViews };
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
      Object.keys(sourceMap).forEach((id) => {
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
        const nextDefaultMap = Object.fromEntries(currentDefaults.map((view) => [view.id, view]));
        Object.values(sourceMap).forEach((view) => {
          nextDefaultMap[view.id] = { ...(nextDefaultMap[view.id] || {}), ...view, updated_at: now };
        });
        const nextDefaults = normalizeColumnViewList({ views: Object.values(nextDefaultMap) });
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

  const WEEKLY_IMPORT_SHEET_NAME = '数据导入';
  const WEEKLY_IMPORT_HEADER_ROW = 6;
  const WEEKLY_IMPORT_DATA_START_ROW = 7;
  const WEEKLY_IMPORT_MAX_ROWS = 500;
  const DAILY_IMPORT_RESOURCE_KEY_FIELDS = {
    daily_asins: 'country_asin_date',
    target_management: 'country_asin_date',
    weekly_performance: 'country_asin_week',
    daily_order_link_tracking: 'country_asin_date',
    daily_profit: 'country_asin_date',
  };
  const DAILY_IMPORT_FIELD_OPTIONS = [
    { label: '推广天数', resource: 'daily_asins', field: 'promotion_days', type: 'integer' },
    { label: '活动标注', resource: 'daily_asins', field: 'activity_annotation', type: 'text', maxLength: 255 },
    { label: 'LP/WP/TP', resource: 'daily_asins', field: 'list_price', type: 'decimal' },
    { label: '购物车价格', resource: 'daily_asins', field: 'daily_price', type: 'decimal' },
    { label: '折后售价', resource: 'daily_asins', field: 'price_after_discount', type: 'decimal' },
    { label: '售卖账号', resource: 'daily_asins', field: 'selling_accounts', type: 'text' },
    { label: '目标拆解-小类排名', resource: 'target_management', field: 'target_subcategory_rank', type: 'integer' },
    { label: '目标拆解-单量', resource: 'target_management', field: 'target_order_qty', type: 'integer' },
    { label: '实际总单量', resource: 'weekly_performance', field: 'sales', type: 'integer' },
    { label: '目标差距', resource: 'daily_asins', field: 'target_gap', type: 'integer' },
    { label: '测评折后价', resource: 'daily_order_link_tracking', field: 'review_discounted_price', type: 'decimal' },
    { label: '①测评单', resource: 'daily_asins', field: 'rsg_number', type: 'integer' },
    { label: '手机端流量', resource: 'weekly_performance', field: 'sessions_mobile', type: 'integer' },
    { label: '电脑端流量', resource: 'weekly_performance', field: 'sessions', type: 'integer' },
    { label: '汇总流量-会话量', resource: 'weekly_performance', field: 'zongliuliang', type: 'integer' },
    { label: '页面浏览量', resource: 'weekly_performance', field: 'page_views_total', type: 'integer' },
    { label: '广告点击', resource: 'weekly_performance', field: 'guanggaodianji', type: 'integer' },
    { label: '退货量', resource: 'weekly_performance', field: 'return_goods_count', type: 'integer' },
    { label: '退货率', resource: 'weekly_performance', field: 'return_goods_rate', type: 'ratio' },
    { label: '小类排名', resource: 'weekly_performance', field: 'ranking', type: 'integer' },
    { label: '自己页面截图', resource: 'daily_order_link_tracking', field: 'page_screenshot', type: 'text', image: true },
    { label: 'review数量', resource: 'daily_asins', field: 'number_of_comments', type: 'integer' },
    { label: '星级', resource: 'daily_asins', field: 'star_rating', type: 'decimal' },
    { label: 'review详细截图', resource: 'daily_order_link_tracking', field: 'review_screenshot', type: 'text', image: true },
    { label: '差评rating / 差评', resource: 'daily_order_link_tracking', field: 'bad_review_notes', type: 'text' },
    { label: 'Asin 西柚/sif 搜索词排名趋势截图', resource: 'daily_order_link_tracking', field: 'keyword_trend_screenshot', type: 'text', image: true },
    { label: 'Asin 广告框架截图', resource: 'daily_order_link_tracking', field: 'ad_framework_screenshot', type: 'text', image: true },
    { label: 'Asin 搜索词表现截图', resource: 'daily_order_link_tracking', field: 'keyword_performance_screenshot', type: 'text', image: true },
    { label: '链接问题', resource: 'daily_order_link_tracking', field: 'link_problem', type: 'text', image: true },
    { label: '今日操作记录', resource: 'daily_order_link_tracking', field: 'operation_record', type: 'text', image: true },
    { label: '复盘', resource: 'daily_order_link_tracking', field: 'review_notes', type: 'text', image: true },
    { label: '广告优化操作动作记录（大方向记录）', resource: 'daily_order_link_tracking', field: 'ad_optimization_logs', type: 'text', image: true },
    { label: '广告曝光量', resource: 'weekly_performance', field: 'impressions', type: 'integer' },
    { label: '广告点击量', resource: 'weekly_performance', field: 'guanggaodianji', type: 'integer' },
    { label: '广告花费', resource: 'weekly_performance', field: 'guanggaohuafei', type: 'decimal' },
    { label: '广告总单量', resource: 'weekly_performance', field: 'guanggaodan', type: 'integer' },
    { label: '广告销售额', resource: 'weekly_performance', field: 'ad_sales_amount', type: 'decimal' },
    { label: '间接跑单订单量', resource: 'weekly_performance', field: 'indirect_order_volume', type: 'integer' },
    { label: 'SP广告费', resource: 'weekly_performance', field: 'ads_sp_cost', type: 'decimal' },
    { label: 'SD广告费', resource: 'weekly_performance', field: 'ads_sd_cost', type: 'decimal' },
    { label: 'SB广告费', resource: 'weekly_performance', field: 'shared_ads_sb_cost', type: 'decimal' },
    { label: 'SBV广告费', resource: 'weekly_performance', field: 'shared_ads_sbv_cost', type: 'decimal' },
    { label: '秒杀价格（当地币）', resource: 'daily_profit', field: 'flash_sale_price', type: 'decimal' },
    { label: '秒杀总单量', resource: 'daily_profit', field: 'flash_sale_qty', type: 'integer' },
    { label: '秒杀天数', resource: 'daily_profit', field: 'flash_sale_days', type: 'integer' },
  ];
  const DAILY_IMPORT_FIELDS_BY_LABEL = Object.fromEntries(DAILY_IMPORT_FIELD_OPTIONS.map((item) => [item.label, item]));
  const DAILY_IMPORT_KEYWORD_START_COLUMN = 36;
  const DAILY_IMPORT_KEYWORD_END_COLUMN = 52;
  const DAILY_IMPORT_COMPETITORS = [
    { role: '竞对1', asinCell: 'X5', rankColumn: 23, notesColumn: 24 },
    { role: '竞对2', asinCell: 'Z5', rankColumn: 25, notesColumn: 26 },
    { role: '竞对3', asinCell: 'AB5', rankColumn: 27, notesColumn: 28 },
  ];
  const DAILY_IMPORT_TEMPLATE_BASE64 = 'UEsDBAoAAAAAAIdO4kAAAAAAAAAAAAAAAAAJAAAAZG9jUHJvcHMvUEsDBBQAAAAIAIdO4kAgqjEYOQEAADgCAAAQAAAAZG9jUHJvcHMvYXBwLnhtbJ2RMU/DMBCFdyT+Q+S9dVshhCrHFVKF2OgQ2I1zaS0S27KPqGVnZGRjYajEBGws8G9Ixc/ASSRIgYntnd/p3fdkNlkWeVSC88romAz7AxKBliZVeh6T0+Sod0Aij0KnIjcaYrICTyZ8d4fNnLHgUIGPQoT2MVkg2jGlXi6gEL4fbB2czLhCYBjdnJosUxKmRl4WoJGOBoN9CksEnULas1+BpE0cl/jf0NTIms+fJSsbgDk7tDZXUmBoyaehWyLyC0a7r+wYRN16JpTznJU4LkGicZFXV6H3iETnwkOdF5NSOCU0htx6rR0anVuPjlcv6/e3u4/7B0aD3741srva1WqPD5uFILYX64CWIxjbhInCHPxJNhMO/wAedoEbhha3xdncPm9uHqun1+p6/Yuy6R3u/bhAv7+cfwJQSwMEFAAAAAgAh07iQPg7PG5EAQAAXgIAABEAAABkb2NQcm9wcy9jb3JlLnhtbH2SUU/DIBSF3038Dw3vHXSLc5K2i7rsySUm1mh8I3C3kRVKAO3676XtVrtoTHiBc/ju4YR0eVRl9AXWyUpnKJkQFIHmlZB6l6HXYh0vUOQ804KVlYYMNeDQMr++SrmhvLLwbCsD1ktwUSBpR7nJ0N57QzF2fA+KuUlw6CBuK6uYD1u7w4bxA9sBnhIyxwo8E8wz3AJjMxDRCSn4gDSftuwAgmMoQYH2DieTBP94PVjl/rzQKSOnkr4x4U2nuGO24L04uI9ODsa6rif1rIsR8if4ffP00j01lrrtigPKU8Ept8B8ZfNVKLNg5SHFo8O2wJI5vwldbyWIhya/17JhKf4tBFiXvSeCiEIa2mc/K2+zx1WxRnlbaEzu4mReEEK79dHOvbjfpusP1Gn6v8RpIC5iclOQW0qmlMxHxDMg73Jf/oj8G1BLAwQUAAAACACHTuJAIhWTOUMBAACEAgAAEwAAAGRvY1Byb3BzL2N1c3RvbS54bWy1kltLwzAUgN8F/0PJe5o0W9d2tB29DcQHRedeJaTpVmiTkqTTIf53M+u8vCq+ncM5fHznEq+e+845cKVbKRLguRg4XDBZt2KXgIfNGobA0YaKmnZS8AQcuQar9PIivlVy4Mq0XDsWIXQC9sYMS4Q02/OeateWha00UvXU2FTtkGyalvFSsrHnwiCC8QKxURvZw+ETBybe8mB+i6wlO9np7eY4WN00/oAfnaY3bZ2Al9IvytLHPiRVVEAPezmMZlEAcYgxyUmxjrLqFTjDqZkAR9Dejn5VbC3rYJbd8KSNSoPAz6IZ9qqKBPMq8sOIrDM/CINqEeZ5Fjx6JEZf7TE6a/xRaHYWur6/sXPWIzP52Hb1lqsffgT7BHrEtUd1SYjJ/9jMzzYF7djYUWMf6W7s+KTSzlP8vgQbfF8AOh1oep/0DVBLAwQKAAAAAACHTuJAAAAAAAAAAAAAAAAAAwAAAHhsL1BLAwQKAAAAAACHTuJAAAAAAAAAAAAAAAAADgAAAHhsL3dvcmtzaGVldHMvUEsDBBQAAAAIAIdO4kCpFj6BNH8BAK+pCwAYAAAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1snP1Zs6vneWUL3ldE/QcFQ+GwIm1L7NTYok4Aq+/79k4pU2lFSqJTou3M+vU1HhJLAjCGTxq4OK6soQGS2nO+c3/C+l7uX/4///sPv//Bv3/9pz//7ps/fvXJp//wk09+8PUff/PNP//uj//jq0+eHo///uef/ODP3/76j//8699/88evv/rk/3z950/+n1/9f/8/v/yPb/70P//8L19//e0P+Cv88c9fffIv3377r//44x//+Tf/8vUffv3nf/jmX7/+I//Jb7/50x9+/S3/f//0P37853/909e//ufvPvSH3//4s5/85Kc//sOvf/fHT77/K/zjn/4rf41vfvvb3/3m68NvfvNvf/j6j99+/xf509e///W3/PP/+V9+969//vir/e9//i/99f75T7/+D/67fvzzrP0jHn7/n/zlr/fpF/rn+8PvfvOnb/78zW+//YfffPOHH3//j+b/lr/48S82/nv+4Tf6C8Uv1h9+/af/+W//+vf8hf+V/3L//Xe//923/+e7/7of/0Bff/vXv85//Md//MN//Ouf/+E3f1z9U6z9An36sx9//e3Bv/3522/+cPjrb3/9ya9++V0Ct3/61S+/+bdvf/+7P359+6cf/Pnf/sDf8P8sv/79N//x1SeUYAXuf/c//uXbAT/+1S9//JfP/fPv+MWfxvzgT1//9qtPFp/+4/Luy5/8dKTvnOffff0ff177f//g21//94evf//1b779+p8p2Sc/mPL892+++Z8jnoF+wj/Vv/76j1//4H8//Cv/Rb9z/s/q//nTT37w7Tf/evn1b789+Pr3v//qk+XPPvnBr3/z7e/+/etbPvHVJ//9m2/5r/bdP+h3Vf0W9ts/ffP/+/qP3/3zfPe35R91/tk+/t8/mL/XV5/wl/3+Y/Gfff9Xnb/rxl9l9cmNv+f3/zDf/8Md8g/35//13a8K/8+//KLNf8+PX8D1X5zj704Hv/7//PVvf/1vv//24Jvfv/zun7/9F34ByGAF77/5j9Ovv8/h05/+w5ef/OA334X5FzZ/m99883t+wfm/P/jD7+Ycf/KDP/z6f3//S7366/1iPvnnb//P7/kvzn/8/V/j42+2+kt8/+HPVh/+bIJaffqL/+pn//Jh/h+rD382dfov/Y0///g7Mzoff+fv9ue/8k/9i9WHP+e/565/588p2Xe/YF/+9R/70//q3/nLj3/sL/mr7Pp3/pLCfPd3/in//B//nf8vv9o//j7t747aHOlf/fJP3/zHD5g7ApvT+hmf3+7ID/5M51npT/+RvxFNGX2BD+K/Mh/6M/Tff/WTX/743ynqb1bG8nvj8+/6MR85/B7wN/jLRz7d/MjR98aXf/nI8TY42Qan2+BsG5xvg4ttcLkNrrbB9Ta42Qa32+BuG9xvg4dt8LgNnrbB8zZ42Qav2+BtG7xvg8Uqy7/+si9W2a2RA31qFeeao/gWym+hABdKcKEIF8pwoRAXSnGhGBfKcaEgF0pyoSgXynKhMBdKc6E4F8pzoUAXSnShSBfKdKlMl8p0qUyXynSpTJfKdKlMl8p0qUyXynSpTJfKdKlMl8p0qUyXynS5numPmcC/7CCLttMO4m/t4Gebo7b83ljbwe/Bd488323p0ffgu9/zvwPH2+BkG5xug7NtcL4NLrbB5Ta42gbX2+BmG9xug7ttcL8NHrbB4zZ42gbP2+BlG7xug7dt8L4NFguRVVR/DWJxIOdQRPEtlN9CAS6U4EIRLpThQiEulOJCMS6U40JBLpTkQlEulOVCYS6U5kJxLpTnQoEulOhCkS6U6VKZLpXpUpkulelSmS6V6VKZLpXpUpkulelSmS6V6VKZLpXpUpkulelyPdON2eM5dKfZw9+avc+3Zu974+d/eZY7/B6szd734K+n7XgbnGyD021wtg3Ot8HFNrjcBlfb4Hob3GyD221wtw3ut8HDNnjcBk/b4HkbvGyD123wtg3et8FiIbIUORBZpffXsBZHcpTfQgEulOBCES6U4UIhLpTiQjEulONCQS6U5EJRLpTlQmEulOZCcS6U50KBLpToQpEulOlSmS6V6VKZLpXpUpkulelSmS6V6VKZLpXpUpkulelSmS6V6VKZLpXpcj3Tjdnjf4zuNHvzv643/1fvF1uz972xNnvfg7XZ+x789SQdb4OTbXC6Dc62wfk2uNgGl9vgahtcb4ObbXC7De62wf02eNgGj9vgaRs8b4OXbfC6Dd62wfs2WCxEliIHIociRyLKb6EAF0pwoQgXynChEBdKcaEYF8pxoSAXSnKhKBfKcqEwF0pzoTgXynOhQBdKdKFIF8p0qUyXynSpTJfKdKlMl8p0qUyXynSpTJfKdKlMl8p0qUyXynSpTJfKdLme6cbs8TXnd7PH/5b5r3zZ9zJf/371Cd8y/uWbuy83Z+/1e4NvnucL5fm2782f+enmZ971mcXCH/rZ5ocWS3/qfIX4iuov/3w/3/rYxcr57C//gItLoyuja6Mbo1ujO6N7owejR6Mno2ejVUyfrv13/MhlDa2CWbc+kvjO2igK30pPUb7g++z/SlEW+BTlUx4N/5LELzaTWK4UZvQvyqdbXx0flLP1XfFhOVtfvRyVs/W/U47L2fpN/aScrRNwWs5W48/K2Sr4eTlbbb4oZ+vX+TKcz7Z+na/K2fp1vi5n69f5ppytX+fbcrZ+ne/K2fp1vi9n69f5oZytX+fHcrZ+nZ/K2fp1fl45HMe/9PnzrV/nl5XD/89fna1f59dytn6d38rZ+nV+L2fr13nxcU43/oG2fqEXHyd1Q9r6lV7UUf1865d6UWf1861f68XHYd34hdz6xV58nNZ16YutX+3Fx3HdkLZ+uRcf53VD2vr1Xnwc2A1p6xd88XFi//pEv/g4oGvo4zyuoY/jt4Y+Ttsa+jhca+jjLK2hj6Ozhj5Oyhr6OBhr6OMcrKGP2q+hj5avoY9Sr6GPDq+hj8quoY+G/hUtP/q48eu8VdrlRx83pK3SLj/6uCFtlXb50ccNaau0y48+rv9G9cVWaZcffdyQtkq7/OjjuvTlVmmXH33ckLZKu/zo44a0VdrlRx83pK3SLj8auiFt/4p/dHZD2v4V/2jxhrT9K/7R6w1p+1f8o+kb0vav+Ef3N6TtX/GP07Au/fSvv+Ibjzj8EH0ecT7nTYP/0iPOvKXBIw5PRLPl3/6Jn33/9rv/57/8+k9f//Mnq9dafvaPi5/Nuwu/++4FlbPjv725/9sfLn/4+Vd/87/+7Ztv/+n7//t3kC82yI/+buM/53P3Ny9/+6O/n//7w8UPf/aj/zZ/kb/5/bf/9NV89u/qP934S/zoR7/88W/np/NbT2Gr/xa/+Mvj8IHId++j8N/0r86RnGORE5FTkTORc5ELkUuRK5FrkRuRW5E7kXuRB5FHkSeRZ5EXkVeRN5F3kcXCaF5vmm7+NbGFY10414WDXTjZhaNdONuFw1043YXjXTjfhQNeOOGFI14444VDXjjlhWNeOOeFg1446YWjXjjrhcNeOO2l01467aXTXjrtpdNeOu2l01467aXTXjrtpdNeOu2l01467aXTXjrt5UbaG3vPcO+09/Mq1//b3n8/8XztoY1dffKvp/FA5FDkSORY5ETkVORM5FzkQuRS5ErkWuRG5FbkTuRe5EHkUeRJ5FnkReRV5E3kXWSxMFoaOdaFc1042IWTXTjahbNdONyF01043oXzXTjghRNeOOKFM1445IVTXjjmhXNeOOiFk1446oWzXjjshdNeOu2l01467aXTXjrtpdNeOu2l01467aXTXjrtpdNeOu2l01467aXTXm6kvbGxfFO808bi77mxq0+ubazIociRyLHIicipyJnIuciFyKXIlci1yI3IrcidyL3Ig8ijyJPIs8iLyOv35K//s/5tG7xvg8VCZClyIOJEF4504UwXDnXhVBeOdeFcFw524WQXjnbhbBcOd+F0F4534XwXDnjhhBeOeOGMFw55sUp5/X9jrHJeR6uk19By8X2M62iV9Tpahb2OnPbSaS+d9tJpL5320mkvnfbSaS+d9tJpL5320mkvnfbybv3Xa2Nd537HTvM6H9hzXz8+ujawRodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b3Rg9Gj0ZPRs9GL0avRm9G70a89r+qxV+z5cV/s4NgkfgiIucCgP96ETqXAOxF7FwEsBfBcxnAXkTPhQB7ET6XAuxF/FwMsBcF4HKAvagAFwTsRQm4JGAvasBFAXlcFTCLHnBdwF70gCsD9qIHXBuwFz3g6oC96AHXB+xFD7hCYC96wDUCe9EDrhKse5tLzSsJuy3199dsPuV/ZPa3y//5tw2frj7619N8YHRodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b/Rg9Gj0ZPRs9GL0avRm9G7EUitbltosAl9E4iy1PxuZc1nLXqTOhS17kTuXtuxF8lzcshfZc3nLXqTPBS57kT+XuOxFA7jIZS86wGUue9ECLnTZix6w1PK41mUWPeBql73oAde77EUPuOJlL3rANS970QOuetmLHnDdy170gCtf9jZ7sLnUvAq321J/fw9or6VefXR9qYUOeUFr64c5R0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b3Rg9Gj0ZPRs9GL0avRm9G70YstVJjqc0OgkXiLLU/G5mz1PYidZbaXuTOUtuL5Flqe5E9S20v0mep7UX+LLW9aABLbS86wFLbixaw1PaiByy1PJbaLHrAUtuLHrDU9qIHLLW96AFLbS96wFLbix6w1PaiByy1vc0ebC41L5futtTfX1Taa6lXH11faqHDed1188fuR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b3Rg9Gj0ZPRs9GL0avRm9G70YstVJjqc0OgkXiLLU/G5mz1PYidZbaXuTOUtuL5Flqe5E9S20v0mep7UX+LLW9aABLbS86wFLbixaw1PaiByy1PJbaLHrAUtuLHrDU9qIHLLW96AFLbS96wFLbix6w1PaiByy1vc0ebC41r9/tttR8YN/vqVcfXV9qocNPhY6Mjo1OjE6NzozOjS6MLo2ujK6Nboxuje6M7o0ejB6NnoyejV6MXo3ejN6NWGqlxlKbHQSLxFlqfzYyZ6ntReostb3InaW2F8mz1PYie5baXqTPUtuL/Flqe9EAltpedIClthctYKntRQ9YankstVn0gKW2Fz1gqe1FD1hqe9EDltpe9IClthc9YKntRQ9YanubPdhcat6E322p+cC+S7366PpSCx1+KnRkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG/0YPRo9GT0bPRi9Gr0ZvRuxFIrNZba7CBYJM5S+7OROUttL1Jnqe1F7iy1vUiepbYX2bPU9iJ9ltpe5M9S24sGsNT2ogMstb1oAUttL3rAUstjqc2iByy1vegBS20vesBS24sesNT2ogcstb3oAUttL3rAUtvb7MHmUnMbb7elXt0H3OcniquPri+10OGnQkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRu9GLLVSY6nNDoJF4iy1PxuZs9T2InWW2l7kzlLbi+RZanuRPUttL9Jnqe1F/iy1vWgAS20vOsBS24sWsNT2ogcstTyW2ix6wFLbix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3NHmwuNZexdlvq1e2tfZZaF78OPhU6NDoyOjY6MTo1OjM6N7owujS6Mro2ujG6Nbozujd6MHo0ejJ6NnoxejV6M3o3YqkVJEttFoHz7oe9iJy39OxF6LylZy9i5y09exE8b+nZi+h5S89ehM9bevYift7SsxcF4C09e1EB3tKzFyXgLT17UQPe0pPHUptFD3hLz170gLf07EUPeEvPXvSAt/TsRQ94S89e9IC39OxFD3hLz170gLf01r3NpWZxd1tqPrDvtx+rj64/Uwsdzs8qt3+iKHRs68To1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3YilVkQstdlBsEicZ2p/NjLnmdpepM4ztb3InWdqe5E8z9T2Inueqe1F+jxT24v8eaa2Fw3gmdpedIBnanvRAp6p7UUPWGp5PFObRQ94prYXPeCZ2l70gGdqe9EDnqntRQ94prYXPeCZ2l70gGdqe5s92Fxq7sTsttSrSzT8XXZ+n3r9/s13/0q7A24lbc3yodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b3Rg9Gj0ZPRs9GL0avRm9G7EUutIFlqswicZ2p7ETnP1PYidJ6p7UXsPFPbi+B5prYX0fNMbS/C55naXsTPM7W9KADP1PaiAjxT24sS8ExtL2rAM7U8ltosesAztb3oAc/U9qIHPFPbix7wTG0vesAztb3oAc/U9qIHPFPbix7wTL3ubSz1/MFNOy31d3/S037/no2Pj649UxsdGh0ZHRudGJ0anRmdG10YXRpdGV0b3RjdGt0Z3Rs9GD0aPRk9G70YvRq9Gb0b8Wd0rN+t+u534cUy2EGwSHwRkfOndfjvEaHzJ3bYi9j5UzvsRfD8yR32Inr+9A57ET5/goe9iJ8/xcNeFIA/ycNeVIA/zcNelIA/0cNe1IA/1UMef66HWfSAP9vDXvSAP9/DXvSAP+PDXvSAP+fDXvSAP+vDXvSAP+/DXvSAP/PDXvSAP/dj3dtcau7J7LbUq4s1ezxTf6Y7OQdGh0ZHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3RvdGD0aPRk9Gz0YvRq9Gb0bvRiy1smWpzSLwRSTOUvuzkTl/spK9SJ0/Xcle5M6fsGQvkudPWbIX2fMnLdmL9PnTluxF/vyJS/aiAfypS/aiA/zJS/aiBfzpS/aiByy1PP4MJrPoAX8Ok73oAX8Wk73oAX8ek73oAX8mk73oAX8uk73oAX82k73oAX8+k73NHmwuNfdkdlvq1cWafZZad3IOPhM6NDoyOjY6MTo1OjM6N7owujS6Mro2ujG6Nbozujd6MHo0ejJ6NnoxejV6M3o3YqkVJEttFoGz1PYicp6p7UXoPFPbi9h5prYXwfNMbS+i55naXoTPM7W9iJ9nantRAJ6p7UUFeKa2FyXgmdpe1IBnankstVn0gGdqe9EDnqntRQ94prYXPeCZ2l70gGdqe9EDnqntRQ94prYXPeCZet3bXGruyey21KuLNfsste7kHHwmdGh0ZHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3Rv9GD0aPRk9Gz0YvRq9Gb0bsRSK0iW2iwCZ6ntReQstb0InaW2F7Gz1PYieJbaXkTPUtuL8FlqexE/S20vCsBS24sKsNT2ogQstb2oAUstj6U2ix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3oAUttL3rAUq97m0vNPZndlnp1sWafpdadnIPPhA6NjoyOjU6MTo3OjM6NLowuja6Mro1ujG6N7ozujR6MHo2ejJ6NXoxejd6M3o1YagXJUptF4Cy1vYicpbYXobPU9iJ2ltpeBM9S24voWWp7ET5LbS/iZ6ntRQFYantRAZbaXpSApbYXNWCp5bHUZtEDltpe9IClthc9YKntRQ9YanvRA5baXvSApbYXPWCp7UUPWOp1b3OpuSez21KvLtbss9S6k3PwmdCh0ZHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3RvdGD0aPRk9Gz0YvRq9Gb0bsRS60gWWqzCJyltheRs9T2InSW2l7EzlLbi+BZansRPUttL8Jnqe1F/Cy1vSgAS20vKsBS24sSsNT2ogYstTyW2ix6wFLbix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3oAUu97m0uNfdkdlvq1cWafZZad3IOPhM6NDoyOjY6MTo1OjM6N7owujS6Mro2ujG6Nbozujd6MHo0ejJ6NnoxejV6M3o3YqkVJEttFoGz1PYicpbaXoTOUtuL2FlqexE8S20vomep7UX4LLW9iJ+lthcFYKntRQVYantRApbaXtSApZbHUptFD1hqe9EDltpe9IClthc9YKntRQ9YanvRA5baXvSApbYXPWCp173NpeZOzG5LvbpEs89Sr9+/+f596s+EDo2OjI6NToxOjc6Mzo0ujC6NroyujW6Mbo3ujO6NHowejZ6Mno1ejF6N3ozejVhqBclSmx0Ei8R598Ofjcx598NepM67H/Yid979sBfJ8+6Hvciedz/sRfq8+2Ev8ufdD3vRAN79sBcd4N0Pe9EC3v2wFz1gqeXx7odZ9IB3P+xFD3j3w170gHc/7EUPePfDXvSAdz/sRQ9498Ne9IB3P+xt9mBzqVnc3ZaaD+x5R/Gz1UfX36cWOrR1ZHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3Rv9GD0aPRk9Gz0YvRq9Gb0bsRSK0iW2uwgWCTOUvuzkTlLbS9SZ6ntRe4stb1InqW2F9mz1PYifZbaXuTPUtuLBrDU9qIDLLW9aAFLbS96wFLLY6nNogcstb3oAUttL3rAUtuLHrDU9qIHLLW96AFLbS96wFLb2+zB5lJzJ2a3pV5douHvsusdxc/W79+snqmFDm0dGR0bnRidGp0ZnRtdGF0aXRldG90Y3RrdGd0bPRg9Gj0ZPRu9GL0avRm9G7HUCpKlNjsIFomz1P5sZM5S24vUWWp7kTtLbS+SZ6ntRfYstb1In6W2F/mz1PaiASy1vegAS20vWsBS24sesNTyWGqz6AFLbS96wFLbix6w1PaiByy1vegBS20vesBS24sesNT2NnuwsdSfcydmp6WeD+z5TP3x0bVnaqNDoyOjY6MTo1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3ejxSLYMthBsEh8EZEvIvNFhL6I1BcR+yJyX0Twi0h+EdEvIvtFhL+I9BcR/yLyX0QBFtGARVRgER1YRAkW0YJF1GARPVhGD5bRg2X0YBk9WEYPltGDZfRgGT1YRg+W0YNl9GAZPVhGD5bRg2X0YBk9WG72YHOpuSez21KvLtbs8Uz9ue7kHBgdGh0ZHRudGJ0anRmdG10YXRpdGV0b3RjdGt0Z3Rs9GD0aPRk9G70YvRq9Gb0bsdTKdrEMFoEvInGW2n+9yJyltheps9T2IneW2l4kz1Lbi+xZanuRPkttL/Jnqe1FA1hqe9EBltpetIClthc9YKnlsdRm0QOW2l70gKW2Fz1gqe1FD1hqe9EDltpe9IClthc9YKntbfZgc6m5E7PbUq8u0eyz1Ov3b77/9uNzoUOjI6NjoxOjU6Mzo3OjC6NLoyuja6Mbo1ujO6N7owejR6Mno2ejF6NXozejdyOWWkGy1GYHwSJxltqfjcxZanuROkttL3Jnqe1F8iy1vciepbYX6bPU9iJ/ltpeNIClthcdYKntRQtYanvRA5ZaHkttFj1gqe1FD1hqe9EDltpe9IClthc9YKntRQ9YanvRA5ba3mYPNpeaOzG7LfXqEs0+S71+/2a11EKHnwsdGR0bnRidGp0ZnRtdGF0aXRldG90Y3RrdGd0bPRg9Gj0ZPRu9GL0avRm9G7HUSo2lNjsIFomz1P5sZM5S24vUWWp7kTtLbS+SZ6ntRfYstb1In6W2F/mz1PaiASy1vegAS20vWsBS24sesNTyWGqz6AFLbS96wFLbix6w1PaiByy1vegBS20vesBS24sesNT2NnuwudTcidltqVeXaPZZ6vX7N6ulFjr8XOjI6NjoxOjU6Mzo3OjC6NLoyuja6Mbo1ujO6N7owejR6Mno2ejF6NXozejdiKVWaiy12UGwSJyl9mcjc5baXqTOUtuL3Flqe5E8S20vsmep7UX6LLW9yJ+lthcNYKntRQdYanvRApbaXvSApZbHUptFD1hqe9EDltpe9IClthc9YKntRQ9YanvRA5baXvSApba32YPNpeZOzG5LvbpEs89Sr9+/WS210OHnQkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRu9GLLVSY6nNDoJF4iy1PxuZs9T2InWW2l7kzlLbi+RZanuRPUttL9Jnqe1F/iy1vWgAS20vOsBS24sWsNT2ogcstTyW2ix6wFLbix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3NHmwuNXdidlvq1SWafZZ6/f7NaqmFDj8XOjI6NjoxOjU6Mzo3ujC6NLoyuja6Mbo1ujO6N3owejR6Mno2ejF6NXozejdiqZUaS212ECwSZ6n92cicpbYXqbPU9iJ3ltpeJM9S24vsWWp7kT5LbS/yZ6ntRQNYanvRAZbaXrSApbYXPWCp5bHUZtEDltpe9IClthc9YKntRQ9YanvRA5baXvSApbYXPWCp7W32YHOpuSez21KvLtbss9S6k3PwudCh0ZHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3RvdGD0aPRk9Gz0YvRq9Gb0bsRS60gWWqzCJx3P+xF5LylZy9C5y09exE7b+nZi+B5S89eRM9bevYifN7Ssxfx85aevSgAb+nZiwrwlp69KAFv6dmLGvCWnjyW2ix6wFt69qIHvKVnL3rAW3r2oge8pWcvesBbevaiB7ylZy96wFt69qIHvKW37m0uNYu721LzgX3fp159dP19aqHDz4WOjI6NToxOjc6Mzo0ujC6NroyujW6Mbo3ujO6NHowejZ6Mno1ejF6N3ozejVhqpcZSmx0Ei8R5pvZnI3Oeqe1F6jxT24vceaa2F8nzTG0vsueZ2l6kzzO1vcifZ2p70QCeqe1FB3imthct4JnaXvSApZbHM7VZ9IBnanvRA56p7UUPeKa2Fz3gmdpe9IBnanvRA56p7UUPeKa2t9mDzaXmnsxuS726WMPfZdc7ip/rTs6B0aHRkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRuxFLrWxZarMInGdqexE5z9T2InSeqe1F7DxT24vgeaa2F9HzTG0vwueZ2l7EzzO1vSgAz9T2ogI8U9uLEvBMbS9qwDO1PJbaLHrAM7W96AHP1PaiBzxT24se8ExtL3rAM7W96AHP1PaiBzxT24se8Ey97m0s9Re73lGcD+z5TP3x0bVnaqNDoyOjY6MTo1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3ejxSLYMthBsEh8EZEvIvNFhL6I1BcR+yJyX0Twi0h+EdEvIvtFhL+I9BcR/yLyX0QBFtGARVRgER1YRAkW0YJF1GARPVhGD5bRg2X0YBk9WEYPltGDZfRgGT1YRg+W0YNl9GAZPVhGD5bRg2X0YBk9WG72YHOpuSez0zP1F6uLNXs8U398dH2pdU3n0NaR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b3Rg9Gj0ZPRs9GL0avRm9G7EUutIBfLYAfBInGW2n+9yJyltheps9T2IneW2l4kz1Lbi+xZanuRPkttL/Jnqe1FA1hqe9EBltpetIClthc9YKnlsdRm0QOW2l70gKW2Fz1gqe1FD1hqe9EDltpe9IClthc9YKntbfZgc6m5J7PbUq8u1uyz1LqTc/CF0KHRkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRuxFLrSBZarMIfBGJs9T+bGTOUtuL1Flqe5E7S20vkmep7UX2LLW9SJ+lthf5s9T2ogEstb3oAEttL1rAUtuLHrDU8lhqs+gBS20vesBS24sesNT2ogcstb3oAUttL3rAUtuLHrDU9jZ7sLnU3JPZbalXF2v2WWrdyTn4QujQ6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N2IpVaQLLVZBM5S24vI+fbDXoTOtx/2Ina+/bAXwfPth72Inm8/7EX4fPthL+Ln2w97UQC+/bAXFeDbD3tRAr79sBc14NsPeSy1WfSAbz/sRQ/49sNe9IBvP+xFD/j2w170gG8/7EUP+PbDXvSAbz/sRQ/49mPd21xq7snsttSrizX7LLXu5Bx8IXRodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b/Rg9Gj0ZPRs9GL0avRm9G7EUitIltosAmep7UXkLLW9CJ2lthexs9T2IniW2l5Ez1Lbi/BZansRP0ttLwrAUtuLCrDU9qIELLW9qAFLLY+lNosesNT2ogcstb3oAUttL3rAUtuLHrDU9qIHLLW96AFLbS96wFKve5tLzT2Z3ZZ6dbFmn6XWnZyDL4QOjY6Mjo1OjE6NzozOjS6MLo2ujK6Nboxuje6M7o0ejB6NnoyejV6MXo3ejN6NWGoFyVKbReAstb2InKW2F6Gz1PYidpbaXgTPUtuL6FlqexE+S20v4mep7UUBWGp7UQGW2l6UgKW2FzVgqeWx1GbRA5baXvSApbYXPWCp7UUPWGp70QOW2l70gKW2Fz1gqe1FD1jqdW9zqbkns9tSry7W7LPUupNz8IXQodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b3Rg9Gj0ZPRs9GL0avRm9G7EUutIFlqswicpbYXkbPU9iJ0ltpexM5S24vgWWp7ET1LbS/CZ6ntRfwstb0oAEttLyrAUtuLErDU9qIGLLU8ltosesBS24sesNT2ogcstb3oAUttL3rAUtuLHrDU9qIHLLW96AFLve5tLjV3YnZb6tUlmn2Wev3+zfe3yb8QOjQ6Mjo2OjE6NTozOje6MLo0ujK6NroxujW6M7o3ejB6NHoyejZ6MXo1ejN6N2KpFSRLbXYQLBLnJ4r+bGTOTxTtRer8RNFe5M5PFO1F8vxE0V5kz08U7UX6/ETRXuTPTxTtRQP4iaK96AA/UbQXLeAnivaiByy1PH6iaBY94CeK9qIH/ETRXvSAnyjaix7wE0V70QN+omgvesBPFO1FD/iJor3NHmwuNYu721LzgX3fp159dP0tPaHDL4SOjI6NToxOjc6Mzo0ujC6NroyujW6Mbo3ujO6NHowejZ6Mno1ejF6N3ozejVhqpcZSmx0Ei8RZan82Mmep7UXqLLW9yJ2lthfJs9T2InuW2l6kz1Lbi/xZanvRAJbaXnSApbYXLWCp7UUPWGp5LLVZ9IClthc9YKntRQ9YanvRA5baXvSApbYXPWCp7UUPWGp7mz3YXGruxOy21KtLNPxddr2j+MX6/ZvVM7XQoa0jo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N3I5ZaQbLUZgfBInGW2p+NzFlqe5E6S20vcmep7UXyLLW9yJ6lthfps9T2In+W2l40gKW2Fx1gqe1FC1hqe9EDlloeS20WPWCp7UUPWGp70QOW2l70gKW2Fz1gqe1FD1hqe9EDltreZg82lvrLXe8ozgf2fKb++OjaM7XRodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b3Rg9Gj0ZPRs9GL0avRm9G70WIRbBnsIFgkvojIF5H5IkJfROqLiH0RuS8i+EUkv4joF5H9IsJfRPqLiH8R+S+iAItowCIqsIgOLKIEi2jBImqwiB4sowfL6MEyerCMHiyjB8vowTJ6sIweLKMHy+jBMnqwjB4sowfL6MEyerCMHiw3e7C51NyT2emZ+svVxZo9nqk/Prq+1Lqmc2jryOjY6MTo1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3YilVpCLZbCDYJE4S+2/XmTOUtuL1Flqe5E7S20vkmep7UX2LLW9SJ+lthf5s9T2ogEstb3oAEttL1rAUtuLHrDU8lhqs+gBS20vesBS24sesNT2ogcstb3oAUttL3rAUtuLHrDU9jZ7sLnU3JPZbalXF2v2WWrdyTn4UujQ6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N2IpVaQLLVZBL6IxFlqfzYyZ6ntReostb3InaW2F8mz1PYie5baXqTPUtuL/Flqe9EAltpedIClthctYKntRQ9YankstVn0gKW2Fz1gqe1FD1hqe9EDltpe9IClthc9YKntRQ9YanubPdhcau7E7LbUq0s0+yz1+v2b77+n/lLo0OjI6NjoxOjU6Mzo3OjC6NLoyuja6Mbo1ujO6N7owejR6Mno2ejF6NXozejdiKVWkCy12UGwSJyl9mcjc5baXqTOUtuL3Flqe5E8S20vsmep7UX6LLW9yJ+lthcNYKntRQdYanvRApbaXvSApZbHUptFD1hqe9EDltpe9IClthc9YKntRQ9YanvRA5baXvSApba32YPNpeZOzG5LvbpEs89Sr9+/WS210OGXQkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRu9GLLVSY6nNDoJF4iy1PxuZs9T2InWW2l7kzlLbi+RZanuRPUttL9Jnqe1F/iy1vWgAS20vOsBS24sWsNT2ogcstTyW2ix6wFLbix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3NHmwuNXdidlvq1SWafZZ6/f7NaqmFDr8UOjI6NjoxOjU6Mzo3ujC6NLoyuja6Mbo1ujO6N3owejR6Mno2ejF6NXozejdiqZUaS212ECwSZ6n92cicpbYXqbPU9iJ3ltpeJM9S24vsWWp7kT5LbS/yZ6ntRQNYanvRAZbaXrSApbYXPWCp5bHUZtEDltpe9IClthc9YKntRQ9YanvRA5baXvSApbYXPWCp7W32YHOpuROz21KvLtHss9Tr929WSy10+KXQkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRuxFLrdRYarODYJE4S+3PRuYstb1InaW2F7mz1PYieZbaXmTPUtuL9Flqe5E/S20vGsBS24sOsNT2ogUstb3oAUstj6U2ix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3oAUttb7MHm0vNPZndlnp1sWafpdadnIMvhQ6NjoyOjU6MTo3OjM6NLowuja6Mro1ujG6N7ozujR6MHo2ejJ6NXoxejd6M3o1YagXJUptF4PxE0V5Ezlt69iJ03tKzF7Hzlp69CJ639OxF9LylZy/C5y09exE/b+nZiwLwlp69qABv6dmLEvCWnr2oAW/pyWOpzaIHvKVnL3rAW3r2oge8pWcvesBbevaiB7ylZy96wFt69qIHvKVnL3rAW3rr3uZSs7i7LTUf2Pd96tVH19/SEzr8UujI6NjoxOjU6Mzo3OjC6NLoyuja6Mbo1ujO6N7owejR6Mno2ejF6NXozejdiKVWaiy12UGwSJxnan82MueZ2l6kzjO1vcidZ2p7kTzP1PYie56p7UX6PFPbi/x5prYXDeCZ2l50gGdqe9ECnqntRQ9Yank8U5tFD3imthc94JnaXvSAZ2p70QOeqe1FD3imthc94JnaXvSAZ2p7mz3YXGruyey21KuLNfxddr2j+KXu5BwYHRodGR0bnRidGp0ZnRtdGF0aXRldG90Y3RrdGd0bPRg9Gj0ZPRu9GL0avRm9G7HUypalNovAeaa2F5HzTG0vQueZ2l7EzjO1vQieZ2p7ET3P1PYifJ6p7UX8PFPbiwLwTG0vKsAztb0oAc/U9qIGPFPLY6nNogc8U9uLHvBMbS96wDO1vegBz9T2ogc8U9uLHvBMbS96wDO1vegBz9Tr3sZS/3TXO4rzgT2fqT8+uvZMbXRodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b/Rg9Gj0ZPRs9GL0avRm9G60WARbBjsIFokvIvJFZL6I0BeR+iJiX0Tuiwh+EckvIvpFZL+I8BeR/iLiX0T+iyjAIhqwiAosogOLKMEiWrCIGiyiB8vowTJ6sIweLKMHy+jBMnqwjB4sowfL6MEyerCMHiyjB8vowTJ6sIweLKMHy80ebC4192R2eqb+6epizR7P1B8fXV9qXdM5tHVkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG/0YPRo9GT0bPRi9Gr0ZvRuxFIryMUy2EGwSJyl9l8vMmep7UXqLLW9yJ2lthfJs9T2InuW2l6kz1Lbi/xZanvRAJbaXnSApbYXLWCp7UUPWGp5LLVZ9IClthc9YKntRQ9YanvRA5baXvSApbYXPWCp7UUPWGp7mz3YXGruyey21KuLNfsste7kHPxU6NDoyOjY6MTo1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3YilVpAstVkEvojEWWp/NjJnqe1F6iy1vcidpbYXybPU9iJ7ltpepM9S24v8WWp70QCW2l50gKW2Fy1gqe1FD1hqeSy1WfSApbYXPWCp7UUPWGp70QOW2l70gKW2Fz1gqe1FD1hqe5s92Fxq7snsttSrizX7LLXu5Bz8VOjQ6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N2IpVaQLLVZBM5S24vI+fbDXoTOtx/2Ina+/bAXwfPth72Inm8/7EX4fPthL+Ln2w97UQC+/bAXFeDbD3tRAr79sBc14NsPeSy1WfSAbz/sRQ/49sNe9IBvP+xFD/j2w170gG8/7EUP+PbDXvSAbz/sRQ/49mPd21xq7snsttSrizX7LLXu5Bz8VOjQ6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N2IpVaQLLVZBM5S24vIWWp7ETpLbS9iZ6ntRfAstb2InqW2F+Gz1PYifpbaXhSApbYXFWCp7UUJWGp7UQOWWh5LbRY9YKntRQ9YanvRA5baXvSApbYXPWCp7UUPWGp70QOW2l70gKVe9zaXmnsyuy316mLNPkutOzkHPxU6NDoyOjY6MTo1OjM6N7owujS6Mro2ujG6Nbozujd6MHo0ejJ6NnoxejV6M3o3YqkVJEttFoGz1PYicpbaXoTOUtuL2FlqexE8S20vomep7UX4LLW9iJ+lthcFYKntRQVYantRApbaXtSApZbHUptFD1hqe9EDltpe9IClthc9YKntRQ9YanvRA5baXvSApbYXPWCp173NpeaezG5LvbpYs89S607OwU+FDo2OjI6NToxOjc6Mzo0ujC6NroyujW6Mbo3ujO6NHowejZ6Mno1ejF6N3ozejVhqBclSm0XgLLW9iJylthehs9T2InaW2l4Ez1Lbi+hZansRPkttL+Jnqe1FAVhqe1EBltpelIClthc1YKnlsdRm0QOW2l70gKW2Fz1gqe1FD1hqe9EDltpe9IClthc9YKntRQ9Y6nVvc6m5E7PbUq8u0eyz1Ov3b76/Tf5ToUOjI6NjoxOjU6Mzo3OjC6NLoyuja6Mbo1ujO6N7owejR6Mno2ejF6NXozejdyOWWkGy1GYHwSJxfqLoz0bm/ETRXqTOTxTtRe78RNFeJM9PFO1F9vxE0V6kz08U7UX+/ETRXjSAnyjaiw7wE0V70QJ+omgvesBSy+MnimbRA36iaC96wE8U7UUP+ImivegBP1G0Fz3gJ4r2ogf8RNFe9ICfKNrb7MHmUrO4uy01H9j3ferVR9ff0hM6/KnQkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRuxFLrdRYarODYJE4S+3PRuYstb1InaW2F7mz1PYieZbaXmTPUtuL9Flqe5E/S20vGsBS24sOsNT2ogUstb3oAUstj6U2ix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3oAUttb7MHm0vNnZjdlnp1iYa/y653FH+6fv9m9UwtdGjryOjY6MTo1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3YilVpAstdlBsEicpfZnI3OW2l6kzlLbi9xZanuRPEttL7Jnqe1F+iy1vcifpbYXDWCp7UUHWGp70QKW2l70gKWWx1KbRQ9YanvRA5baXvSApbYXPWCp7UUPWGp70QOW2l70gKW2t9mDjaX+2a53FOcDez5Tf3x07Zna6NDoyOjY6MTo1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3WixCLYMdhAsEl9E5IvIfBGhLyL1RcS+iNwXEfwikl9E9IvIfhHhLyL9RcS/iPwXUYBFNGARFVhEBxZRgkW0YBE1WEQPltGDZfRgGT1YRg+W0YNl9GAZPVhGD5bRg2X0YBk9WEYPltGDZfRgGT1YRg+Wmz3YXGruyez0TP2z1cWa//SZ+k9f//arTxY/+/QfF59+Pq+c/O6rTz795Fdnx397c/+3P1z+8POv/uZ//ds33/7T9//37yBfbJAf/d3Gf87n7m9e/vZHfz//94eLH/7sR/9t/iJ/8/tv/+mr+ezf1X+68Zf40Y9++ePf/uqX//6rX/54/r/f/OqX3z3OLz/+i6z/vqFLQ4e2joyOjU6MTo3OjM6NLowuja6Mro1ujG6N7ozujR6MHo2ejJ6NXoxejd6M3o34fUNBLiLvxUF4kTi/b/ivF5nz+4a9SJ3fN+xF7vy+YS+S5/cNe5E9v2/Yi/T5fcNe5M/vG/aiAfy+YS86wO8b9qIF/L5hL3rA7xvy+H3DLHrA7xv2ogf8vmEvesDvG/aiB/y+YS96wO8b9qIH/L5hL3rA7xv2Nnuw+fsGt3Z2+31jdc3nP/194/vfKH5cS60bQgc/Ezo0OjI6NjoxOjU6Mzo3ujC6NLoyuja6Mbo1ujO6N3owejR6Mno2ejF6NXozejdiqRUkS20WgS8icZban43MWWp7kTpLbS9yZ6ntRfIstb3InqW2F+mz1PYif5baXjSApbYXHWCp7UULWGp70QOWWh5LbRY9YKntRQ9YanvRA5baXvSApbYXPWCp7UUPWGp70QOW2t5mDzaXmhs6uy316krPPku9fhvo+2/NfyZ0aHRkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG/0YPRo9GT0bPRi9Gr0ZvRuxFIrSJba7CBYJM5S+7OROUttL1Jnqe1F7iy1vUiepbYX2bPU9iJ9ltpe5M9S24sGsNT2ogMstb1oAUttL3rAUstjqc2iByy1vegBS20vesBS24sesNT2ogcstb3oAUttL3rAUtvb7MHmUvN1yW5LvbrSs89Sr98GWi210OHPhI6Mjo1OjE6NzozOjS6MLo2ujK6Nboxuje6M7o0ejB6NnoyejV6MXo3ejN6NWGqlxlKbHQSLxFlqfzYyZ6ntReostb3InaW2F8mz1PYie5baXqTPUtuL/Flqe9EAltpedIClthctYKntRQ9YankstVn0gKW2Fz1gqe1FD1hqe9EDltpe9IClthc9YKntRQ9YanubPdhcam7o7LbUqys9+yz1+m2g1VILHf5M6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N2IpVZqLLXZQbBInKX2ZyNzltpepM5S24vcWWp7kTxLbS+yZ6ntRfostb3In6W2Fw1gqe1FB1hqe9ECltpe9ICllsdSm0UPWGp70QOW2l70gKW2Fz1gqe1FD1hqe9EDltpe9ICltrfZg82l5obObku9utKzz1Kv3wZaLbXQ4c+EjoyOjU6MTo3OjM6NLowuja6Mro1ujG6N7ozujR6MHo2ejJ6NXoxejd6M3o1YaqXGUpsdBIvEWWp/NjJnqe1F6iy1vcidpbYXybPU9iJ7ltpepM9S24v8WWp70QCW2l50gKW2Fy1gqe1FD1hqeSy1WfSApbYXPWCp7UUPWGp70QOW2l70gKW2Fz1gqe1FD1hqe5s92Fxqbu3sttSraz77LLVuCB38TOjQ6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N2IpVaQLLVZBM5PFO1F5LwzaC9C551BexE77wzai+B5Z9BeRM87g/YifN4ZtBfx886gvSgA7wzaiwrwzqC9KAHvDNqLGvDOoDyW2ix6wDuD9qIHvDNoL3rAO4P2oge8M2gvesA7g/aiB7wzaC96wDuD9qIHvDO47m0uNYu721Lzgf/r292ffpLvfqw+uv6WntDhz4SOjI6NToxOjc6Mzo0ujC6NroyujW6Mbo3ujO6NHowejZ6Mno1ejF6N3ozejVhqpcZSmx0Ei8R5pvZnI3Oeqe1F6jxT24vceaa2F8nzTG0vsueZ2l6kzzO1vcifZ2p70QCeqe1FB3imthct4JnaXvSApZbHM7VZ9IBnanvRA56p7UUPeKa2Fz3gmdpe9IBnanvRA56p7UUPeKa2t9mDzaXm1s5uS7265sPf5T+/MfmfLLVuCB38TOjQ6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N2IpVaQLLVZBM4ztb2InGdqexE6z9T2Inaeqe1F8DxT24voeaa2F+HzTG0v4ueZ2l4UgGdqe1EBnqntRQl4prYXNeCZWh5LbRY94JnaXvSAZ2p70QOeqe1FD3imthc94JnaXvSAZ2p70QOeqe1FD3imXvc2lvrnu96YnA/s+Uz98dG1Z2qjQ6Mjo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N3o8Ui2DLYQbBIfBGRLyLzRYS+iNQXEfsicl9E8ItIfhHRLyL7RYS/iPQXEf8i8l9EARbRgEVUYBEdWEQJFtGCRdRgET1YRg+W0YNl9GAZPVhGD5bRg2X0YBk9WEYPltGDZfRgGT1YRg+W0YNl9GAZPVhu9mBzqbkns9Mz9c9XF2v2eKb++Oj6UuuazqGtI6NjoxOjU6Mzo3OjC6NLoyuja6Mbo1ujO6N7owejR6Mno2ejF6NXozejdyOWWkEulsEOgkXiLLX/epE5S20vUmep7UXuLLW9SJ6lthfZs9T2In2W2l7kz1Lbiwaw1PaiAyy1vWgBS20vesBSy2OpzaIHLLW96AFLbS96wFLbix6w1PaiByy1vegBS20vesBS29vsweZSc09mt6VeXazZZ6l1J+fg50KHRkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRu9GLLWCZKnNIvBFJM5S+7OROUttL1Jnqe1F7iy1vUiepbYX2bPU9iJ9ltpe5M9S24sGsNT2ogMstb1oAUttL3rAUstjqc2iByy1vegBS20vesBS24sesNT2ogcstb3oAUttL3rAUtvb7MHmUnNPZrelXl2s2WepdSfn4OdCh0ZHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3RvdGD0aPRk9Gz0YvRq9Gb0bvRiy1gmSpzSJwltpeRM63H/YidL79sBex8+2HvQiebz/sRfR8+2EvwufbD3sRP99+2IsC8O2HvagA337YixLw7Ye9qAHffshjqc2iB3z7YS96wLcf9qIHfPthL3rAtx/2ogd8+2EvesC3H/aiB3z7YS96wLcf697mUnNPZrelXl2s2WepdSfn4OdCh0ZHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3RvdGD0aPRk9Gz0YvRq9Gb0bvRiy1gmSpzSJwltpeRM5S24vQWWp7ETtLbS+CZ6ntRfQstb0In6W2F/Gz1PaiACy1vagAS20vSsBS24sasNTyWGqz6AFLbS96wFLbix6w1PaiByy1vegBS20vesBS24sesNT2ogcs9bq3udTck9ltqVcXa/ZZat3JOfi50KHRkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRuxFLrSBZarMInKW2F5Gz1PYidJbaXsTOUtuL4FlqexE9S20vwmep7UX8LLW9KABLbS8qwFLbixKw1PaiBiy1PJbaLHrAUtuLHrDU9qIHLLW96AFLbS96wFLbix6w1PaiByy1vegBS73ubS4192R2W+rVxZp9llp3cg5+LnRodGR0bHRidGp0ZnRudGF0aXRldG10Y3RrdGd0b/Rg9Gj0ZPRs9GL0avRm9G7EUitIltosAmep7UXkLLW9CJ2lthexs9T2IniW2l5Ez1Lbi/BZansRP0ttLwrAUtuLCrDU9qIELLW9qAFLLY+lNosesNT2ogcstb3oAUttL3rAUtuLHrDU9qIHLLW96AFLbS96wFKve5tLzZ2Y3ZZ6dYlmn6Vev3/z/W3ynwsdGh0ZHRudGJ0anRmdG10YXRpdGV0b3RjdGt0Z3Rs9GD0aPRk9G70YvRq9Gb0bsdQKkqU2OwgWifMTRX82MucnivYidX6iaC9y5yeK9iJ5fqJoL7LnJ4r2In1+omgv8ucnivaiAfxE0V50gJ8o2osW8BNFe9EDlloeP1E0ix7wE0V70QN+omgvesBPFO1FD/iJor3oAT9RtBc94CeK9qIH/ETR3mYPNpeaxd1tqfnAvu9Trz66/pae0OHPhY6Mjo1OjE6NzozOjS6MLo2ujK6Nboxuje6M7o0ejB6NnoyejV6MXo3ejN6NWGqlxlKbHQSLxFlqfzYyZ6ntReostb3InaW2F8mz1PYie5baXqTPUtuL/Flqe9EAltpedIClthctYKntRQ9YankstVn0gKW2Fz1gqe1FD1hqe9EDltpe9IClthc9YKntRQ9YanubPdhcau7E7LbUq0s0/F12vaP48/X7N6tnaqFDW0dGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRu9GLLWCZKnNDoJF4iy1PxuZs9T2InWW2l7kzlLbi+RZanuRPUttL9Jnqe1F/iy1vWgAS20vOsBS24sWsNT2ogcstTyW2ix6wFLbix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3NHmws9S92vaM4H9jzmfrjo2vP1EaHRkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRu9Gi0WwZbCDYJH4IiJfROaLCH0RqS8i9kXkvojgF5H8IqJfRPaLCH8R6S8i/kXkv4gCLKIBi6jAIjqwiBIsogWLqMEierCMHiyjB8vowTJ6sIweLKMHy+jBMnqwjB4sowfL6MEyerCMHiyjB8vowTJ6sNzsweZSc09mp2fqX6wu1uzxTP3x0fWl1jWdQ1tHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3RvdGD0aPRk9Gz0YvRq9Gb0bvRiy1glwsgx0Ei8RZav/1InOW2l6kzlLbi9xZanuRPEttL7Jnqe1F+iy1vcifpbYXDWCp7UUHWGp70QKW2l70gKWWx1KbRQ9YanvRA5baXvSApbYXPWCp7UUPWGp70QOW2l70gKW2t9mDzaXmnsxuS726WLPPUutOzsEvhA6NjoyOjU6MTo3OjM6NLowuja6Mro1ujG6N7ozujR6MHo2ejJ6NXoxejd6M3o1YagXJUptF4ItInKX2ZyNzltpepM5S24vcWWp7kTxLbS+yZ6ntRfostb3In6W2Fw1gqe1FB1hqe9ECltpe9ICllsdSm0UPWGp70QOW2l70gKW2Fz1gqe1FD1hqe9EDltpe9ICltrfZg82l5k7Mbku9ukSzz1Kv37/5/nvqXwgdGh0ZHRudGJ0anRmdG10YXRpdGV0b3RjdGt0Z3Rs9GD0aPRk9G70YvRq9Gb0bsdQKkqU2OwgWibPU/mxkzlLbi9RZanuRO0ttL5Jnqe1F9iy1vUifpbYX+bPU9qIBLLW96ABLbS9awFLbix6w1PJYarPoAUttL3rAUtuLHrDU9qIHLLW96AFLbS96wFLbix6w1PY2e7C51NyJ2W2pV5do9lnq9fs3q6UWOvyF0JHRsdGJ0anRmdG50YXRpdGV0bXRjdGt0Z3RvdGD0aPRk9Gz0YvRq9Gb0bsRS63UWGqzg2CROEvtz0bmLLW9SJ2lthe5s9T2InmW2l5kz1Lbi/RZanuRP0ttLxrAUtuLDrDU9qIFLLW96AFLLY+lNosesNT2ogcstb3oAUttL3rAUtuLHrDU9qIHLLW96AFLbW+zB5tLzZ2Y3ZZ6dYlmn6Vev3+zWmqhw18IHRkdG50YnRqdGZ0bXRhdGl0ZXRvdGN0a3RndGz0YPRo9GT0bvRi9Gr0ZvRux1EqNpTY7CBaJs9T+bGTOUtuL1Flqe5E7S20vkmep7UX2LLW9SJ+lthf5s9T2ogEstb3oAEttL1rAUtuLHrDU8lhqs+gBS20vesBS24sesNT2ogcstb3oAUttL3rAUtuLHrDU9jZ7sLnU3InZbalXl2j2Wer1+zerpRY6/IXQkdGx0YnRqdGZ0bnRhdGl0ZXRtdGN0a3RndG90YPRo9GT0bPRi9Gr0ZvRuxFLrdRYarODYJE4S+3PRuYstb1InaW2F7mz1PYieZbaXmTPUtuL9Flqe5E/S20vGsBS24sOsNT2ogUstb3oAUstj6U2ix6w1PaiByy1vegBS20vesBS24sesNT2ogcstb3oAUttb7MHm0vNPZndlnp1sWafpdadnINfCB0aHRkdG50YnRqdGZ0bXRhdGl0ZXRvdGN0a3RndGz0YPRo9GT0bvRi9Gr0ZvRux1AqSpTaLwPmJor2InLf07EXovKVnL2LnLT17ETxv6dmL6HlLz16Ez1t69iJ+3tKzFwXgLT17UQHe0rMXJeAtPXtRA97Sk8dSm0UPeEvPXvSAt/TsRQ94S89e9IC39OxFD3hLz170gLf07EUPeEvPXvSAt/TWvc2lZnF3W2o+sO/71KuPrr+lJ3T4C6Ejo2OjE6NTozOjc6MLo0ujK6NroxujW6M7o3ujB6NHoyejZ6MXo1ejN6N3I5ZaqbHUZgfBInGeqf3ZyJxnanuROs/U9iJ3nqntRfI8U9uL7Hmmthfp80xtL/LnmdpeNIBnanvRAZ6p7UULeKa2Fz1gqeXxTG0WPeCZ2l70gGdqe9EDnqntRQ94prYXPeCZ2l70gGdqe9EDnqntbfZgc6m5J7PbUq8u1vB32fWO4i90J+fA6NDoyOjY6MTo1OjM6NzowujS6Mro2ujG6Nbozuje6MHo0ejJ6NnoxejV6M3o3YilVrYstVkEzjO1vYicZ2p7ETrP1PYidp6p7UXwPFPbi+h5prYX4fNMbS/i55naXhSAZ2p7UQGeqe1FCXimthc14JlaHkttFj3gmdpe9IBnanvRA56p7UUPeKa2Fz3gmdpe9IBnanvRA56p7UUPeKZe9zaW+tOf7HpJ8btP7PlU/ZfPrj1WBzsMdhTsONhJsNNgZ8HOg10Euwx2Few62E2w22B3we6DPQR7DPYU7DnYS7DXYG/B3oMtFgWXBQ8KVhcWVYZFtWFRdVhUHxZViEU1YlGVWFQnFlWKRbViUbVYVC8WVYxFNWNR1VhUNxZVjkW1Y1H1WFQ/FlWQRTVkWQ1ZVkOW1ZBlNWRZDVlWQ5bVkGU1ZFkNWVZDltWQZTVkWQ1ZVkOW1ZBlNWS51ZCtvee6zU6P5p/+ZHVBZ49n8798dmPvdeGHBMUIUIz8xIhPjPTECE+M7MSITozkxAhOjNzEiE2M1MQITYxTLcahFuNMi3GkxTjRYhxoMc6zGMdZjNMsNntvyGk25DQbVhdm721WG2bvbVYfZu9tViNm721WJ2bvbVYrZu9tVi9m721WM2bvbVY3Zu9tVjtm721WP2bvbVZDZu9lzt4bVkNm721WQ2bvbVZDZu9tVkNm721WQ2bvbVZDZu9tVkNm721uNWRr77m0s+Per6757LX3uiJEhGIkKEaAYuQnRnxipCdGeGJkJ0Z0YiQnRnBi5CZGbGKkJkZoYpxqMQ61GGdajCMtxokW40CLcZ7FOM5inGax2XtDTrNhVWFRXZi998erDbP3NqsPs/c2qxGz9zarE7P3NqsVs/c2qxez9zarGbP3Nqsbs/c2qx2z9zarH7P3Nqshs/cyZ+8NqyGz9zarIbP3Nqshs/c2qyGz9zarIbP3Nqshs/c2qyGz9za3GrK191z92XHvV5eF9tp7XTQiQjESFCNAMfITIz4x0hMjPDGyEyM6MZITIzgxchMjNjFSEyM0MU61GIdajDMtxpEW40SLcaDFOM9iHGcxTrPY7L0hp9mwqjB7b7PKMN/n2Kw6zPc5NqsQ832OzarEfJ9js0ox3+fYrFrM9zk2qxjzfY7NqsZ8n2OzyjHf59isesz3OTarIPN9jszZe8NqyHyfY7MaMt/n2KyGzPc5Nqsh832OzWrIfJ9jsxoy3+fYrIbM9zk2qyHzfc66ubX3XCDace9XV4722ntdVyJCMRIUI0Ax8hMjPjHSEyM8MbITIzoxkhMjODFyEyM2MVITIzQxTrUYh1qMMy3GkRbjRItxoMU4z2IcZzFOs9jsvSGn2bCqMHtvs8owe2+z6jB7b7MKMXtvsyoxe2+zSjF7b7NqMXtvs4oxe2+zqjF7b7PKMXtvs+oxe2+zCjJ7L3P23rAaMntvsxoye2+zGjJ7b7MaMntvsxoye2+zGjJ7b7MaMntvsxoye79ubu0915B23PvVxaW99l6XnohQjATFCFCM/MSIT4z0xAhPjOzEiE6M5MQITozcxIhNjNTECE2MUy3GoRbjTItxpMU40WIcaDHOsxjHWYzTLDZ7b8hpNqwqzN7brDLM3tusOsze26xCzN7brErM3tusUsze26xazN7brGLM3tusasze26xyzN7brHrM3tusgszey5y9N6yGzN7brIbM3tushsze26yGzN7brIbM3tushsze26yGzN7brIbM3q+bW3vPZaYd9351/WmvvdfVKSIUI0ExAhQjPzHiEyM9McITIzsxohMjOTGCEyM3MWITIzUxQhPjVItxqMU402IcaTFOtBgHWozzLMZxFuM0i83eG3KaDasKs/c2qwyz9zarDrP3NqsQs/c2qxKz9zarFLP3NqsWs/c2qxiz9zarGrP3Nqscs/c2qx6z9zarILP3MmfvDashs/c2qyGz9zarIbP3Nqshs/c2qyGz9zarIbP3Nqshs/c2qyGz9+vm1t5z/WnHvV9dmNpr79cvW33/rw749CdiJChGgGLkJ0Z8YqQnRnhiZCdGdGIkJ0ZwYuQmRmxipCZGaGKcajEOtRhnWowjLcaJFuNAi3GexTjOYpxmsdl7Q06zIafZsLowP6+1WW2Yn9farD7Mz2ttViPm57U2qxPz81qb1Yr5ea3N6sX8vNZmNWN+XmuzujE/r7VZ7Zif19qsfszPa21WQ2bvZc7Paw2rIfPzWpvVkPl5rc1qyPy81mY1ZH5ea7MaMj+vtVkNmZ/X2qyGzM9rbW41ZGvvme0d955P7P3+/eqzG+9jipGgGAGKkZ8Y8YmRnhjhiZGdGNGJkZwYwYmRmxixiZGaGKGJcarFONRinGkxjrQYJ1qMAy3GeRbjOItxmsVm7w05zYacZsPqwuy9zWrD7L3N6sPsvc1qxOy9zerE7L3NasXsvc3qxey9zWrG7L3N6sbsvc1qx+y9zerH7L3NasjsvczZe8NqyOy9zWrI7L3Nasjsvc1qyOy9zWrI7L3Nasjsvc1qyOy9za2GbO09V7F23PvV5S3+Rrvejf30J+sXvz6e78VIUIwAxchPjPjESE+M8MTITozoxEhOjODEyE2M2MRITYzQxDjVYhxqMc60GEdajBMtxoEW4zyLcZzFOM1is/eGnGZDTrNhdWH23ma1YfbeZvVh9t5mNWL23mZ1YvbeZrVi9t5m9WL23mY1Y/beZnVj9t5mtWP23mb1Y/beZjVk9l7m7L1hNWT23mY1ZPbeZjVk9t5mNWT23mY1ZPbeZjVk9t5mNWT23uZWQzb3/tOd79fOJ/Z9vv/47Przvdnhp2ZHwY6DnQQ7DXYW7DzYRbDLYFfBroPdBLsNdhfsPthDsMdgT8Geg70Eew32Fuw9GHvvMBfLggcFqwvsffw1qw3sfZjVB/Y+zGoEex9mdYK9D7Nawd6HWb1g78OsZrD3YVY32Pswqx3sfZjVD/Y+zGoIe2+TvQ9YDWHvw6yGsPdhVkPY+zCrIex9mNUQ9j7Magh7H2Y1hL0Pc6shW3vP/azdnu8/Xd3o2uf5/uOzG3uvG2IkKEaAYuQnRnxipCdGeGJkJ0Z0YiQnRnBi5CZGbGKkJnYXjFMtj0MtxpkW40iLcaLFONBinGcxjrMYp1ls9t6Q02zIaTasLsze26w2zN7brD7M3tusRsze26xOzN7brFbM3tusXsze26xmzN7brG7M3tusdsze26x+zN7brIbM3sucvTeshsze26yGzN7brIbM3tushsze26yGzN7brIbM3tushsze27zbhFt7z/2sHfd+daNrr73XbTAiFCNBMQIUIz8x4hMjPTHCEyM7MaITIzkxghMjNzFiEyM1MUIT41SLcajFONNiHGkxTrQYB1qM8yzGcRbjNIvN3htymg2rCryfE2aVgfdzwqw68H5OmFUI3s8JsyrB+zlhVil4PyfMqgXv54RZxeD9nDCrGryfE2aVg/dzwqx68H5OmFUQ3s+xOXuvMszeG1ZDZu9tVkNm721WQ2bvbVZDZu9tVkNm721WQ2bvbVZDZu9tbjVka++5irXj3q8ub+219+sXv1bf338qRoJiBChGfmLEJ0Z6YoQnRnZiRCdGcmIEJ0ZuYsQmRmpihCbGqRbjUItxpsU40mKcaDEOtBjnWYzjLMZpFpu9N+Q0G3KaDasL83xvs9owz/c2qw/zfG+zGjHP9zarE/N8b7NaMc/3NqsX83xvs5oxz/c2qxvzfG+z2jHP9zarH/N8b7MaMnsvc/besBoye2+zGjJ7b7MaMntvsxoye2+zGjJ7b7MaMntvsxoye29zqyFbe89VrB33fnV5a6+9X7/49bH3YiQoRoBi5CdGfGKkJ0Z4YmQnRnRiJCdGcGLkJkZsYqQmRmhinGoxDrUYZ1qMIy3GiRbjQItxnsU4zmKcZrHZe0NOsyGn2bC6MHtvs9owe2+z+jB7b7MaMXtvszoxe2+zWjF7b7N6MXtvs5oxe2+zujF7b7PaMXtvs/oxe2+zGjJ7L3P23rAaMntvsxoye2+zGjJ7b7MaMntvsxoye2+zGjJ7b7MaMntvc6shW3vPVawd9351eWuvvV+/+PWx92IkKEaAYuQnRnxipCdGeGJkJ0Z0YiQnRnBi5CZGbGKkJkZoYpxqMQ61GGdajCMtxokW40CLcZ7FOM5inGax2XtDTrMhp9mwujB7b7PaMHtvs/owe2+zGjF7b7M6MXtvs1oxe2+zejF7b7OaMXtvs7oxe2+z2jF7b7P6MXtvsxoyey9z9t6wGjJ7b7MaMntvsxoye2+zGjJ7b7MaMntvsxoye2+zGjJ7b3OrIVt7z1WsHfd+dXlrr71fv/j1sfdiJChGgGLkJ0Z8YqQnRnhiZCdGdGIkJ0ZwYuQmRmxipCZGaGKcajEOtRhnWowjLcaJFuNAi3GexTjOYpxmsdl7Q06zIafZsLowe2+z2jB7b7P6MHtvsxoxe2+zOjF7b7NaMXtvs3oxe2+zmjF7b7O6MXtvs9oxe2+z+jF7b7MaMnsvc/besBoye2+zGjJ7b7MaMntvsxoye2+zGjJ7b7MaMntvsxoye29zqyFbe8/9rB33fnWja6+9120wIhQjQTECFCM/MeITIz0xwhMjOzGiEyM5MYITIzcxYhMjNTFCE+NUi3GoxTjTYhxpMU60GAdajPMsxnEW4zSLzd4bcpoNqwrz81qbVYb5ea3NqsP8vNZmFWJ+XmuzKjE/r7VZpZif19qsWszPa21WMebntTarGvPzWptVjvl5rc2qx/y81mYVZH5eK3P23rAawr9PIcxqCP8+hTCrIfz7FMKshvDvUwizGsK/TyHMagj/PoUwqyH8+xTCrIbw71PYMLf2ntnece/5xN7v368+u/E+phgJihGgGPmJEZ8Y6YkRnhjZiRGdGMmJEZwYuYkRmxipiRGaGKdajEMtxpkW40iLcaLFONBinGcxjrMYp1ls9t6Q02zIaTasLszzvc1qwzzf26w+zPO9zWrEPN/brE7M873NasU839usXszzvc1qxjzf26xuzPO9zWrHPN/brH7M873Nasjsvcx5vjeshszzvc1qyDzf26yGzPO9zWrIPN/brIbM873Nasg839ushszzvc2thmztPfezdtz71Y0u/kY736/9VLfBiFCMBMUIUIz8xIhPjPTECE+M7MSITozkxAhOjNzEiE2M1MQITYxTLcahFuNMi3GkxTjRYhxoMc6zGMdZjNMsNntvyGk2rCrM873NKsM839usOszzvc0qxDzf26xKzPO9zSrFPN/brFrM873NKsY839usaszzvc0qxzzf26x6zPO9zSrIPN/LnL03rIbM873Nasg839ushszzvc1qyDzf26yGzPO9zWrIPN/brIbM873Nasg836+bm3v/2c73a+cT+z7ff3x2/fne7PBTs6Ngx8FOgp0GOwt2Huwi2GWwq2DXwW6C3Qa7C3Yf7CHYY7CnYM/BXoK9BnsL9h6MvXeY3K8NeFCwusDzfXy82sDzfZjVB57vw6xG8HwfZnWC5/swqxU834dZveD5PsxqBs/3YVY3eL4Ps9rB832Y1Q+e78OshrD3Nnm+D1gN4fk+zGoI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Y7P6Md/n2KyGzN7LnOd7w2rIPN/brIbM873Nasg839ushszzvc1qyDzf26yGzPO9zWrIPN/b3GrI1t5zFWvHvV9d3tpr79cvfn3svRgJihGgGPmJEZ8Y6YkRnhjZiRGdGMmJEZwYuYkRmxipiRGaGKdajEMtxpkW40iLcaLFONBinGcxjrMYp1ls9t6Q02zIaTasLsze26w2zN7brD7M3tusRsze26xOzN7brFbM3tusXsze26xmzN7brG7M3tusdsze26x+zN7brIbM3sucvTeshsze26yGzN7brIbM3tushsze26yGzN7brIbM3tushsze29xqyNbecxVrx71fXd7aa+/XL3597L0YCYoRoBj5iRGfGOmJEZ4Y2YkRnRjJiRGcGLmJEZsYqYkRmhinWoxDLcaZFuNIi3GixTjQYpxnMY6zGKdZbPbekNNsyGk2rC7M3tusNsze26w+zN7brEbM3tusTsze26xWzN7brF7M3tusZsze26xuzN7brHbM3tusfsze26yGzN7LnL03rIbM3tushsze26yGzN7brIbM3tushsze26yGzN7brIbM3tvcasjW3nMVa8e9X13e2mvv1y9+fey9GAmKEaAY+YkRnxjpiRGeGNmJEZ0YyYkRnBi5iRGbGKmJEZoYp1qMQy3GmRbjSItxosU40GKcZzGOsxinWWz23pDTbMhpNqwuzN7brDbM3tusPsze26xGzN7brE7M3tusVsze26xezN7brGbM3tusbsze26x2zN7brH7M3tushszey5y9N6yGzN7brIbM3tushsze26yGzN7brIbM3tushsze26yGzN7b3GrI1t4z2zvuPZ/Y+/371Wc33scUI0ExAhQjPzHiEyM9McITIzsxohMjOTGCEyM3MWITIzUxQhPjVItxqMU402IcaTFOtBgHWozzLMZxFuM0i83eG3KaDTnNhtWF2Xub1YbZe5vVh9l7m9WI2Xub1YnZe5vVitl7m9WL2Xub1YzZe5vVjdl7m9WO2Xub1Y/Ze5vVkNl7mbP3htWQ2Xub1ZDZe5vVkNl7m9WQ2Xub1ZDZe5vVkNl7m9WQ2XubWw3Z2nvuZ+2496sbXfyN+n7tn77+7VefEOIv/nHx2U/ndaHfffXJ55/86uz4b2/u//aHyx9+/tXf/K9/++bbf/r+//4d5IsN8qO/2/jP+dz9zcvf/ujv5//+cPHDn/3ov81f5G9+/+0/fTWf/bv6Tzf+Ej/60S9//Ntf/fLff/XLH8//95tf/fK7/2lBpXQ5jUaJUSgx+iRGncRokxhlEqNLYlRJjCaJUSQxeiRGjcRokRglEqNDYoyMGBsjxsSIsTBiDIwY+yLGvIixLmKMi9j89mNYTVhUFeZ1IX+8yjCvC9msOszrQjarEPO6kM2qxLwuZLNKMa8L2axazOtCNqsY87qQzarGvC5ks8oxrwvZrHrM60I2qyDzupDM+e3HsBoyrwvZrIbM60I2qyHzupDNasi8LmSzGjKvC9mshszrQjarIfO6kM1qyLwutG5u/Pbz2U92ve773Sf+r/9z4/NPfhx7/5fPrv3PjWCHwY6CHQc7CXYa7CzYebCLYJfBroJdB7sJdhvsLth9sIdgj8Gegj0Hewn2Guwt2HuwxaLgsuBBwerCosqwqDYsqg6L6sOiCrGoRiyqEovqxKJKsahWLKoWi+rFooqxqGYsqhqL6saiyrGodiyqHovqx6IKsqiGLKshy2rIshqyrIYsqyHLasiyGrKshiyrIctqyLIasqyGLKshy2rIshqyrIYstxqytfdcF9vpf2589pPVBbP/9H9ufP8/L3rvdTmNCMVIUIwAxchPjPjESE+M8MTITozoxEhOjODEyE2M2MRITYzQxDjVYhxqMc60GEdajBMtxoEW4zyLcZzFOM1is/eGnGbDqsKiujB7749XG2bvbVYfZu9tViNm721WJ2bvbVYrZu9tVi9m721WM2bvbVY3Zu9tVjtm721WP2bvbVZDZu9lzt4bVkNm721WQ2bvbVZDZu9tVkNm721WQ2bvbVZDZu9tVkNm721uNWRr7/n+Z8e9X10w22vvdTmNCMVIUIwAxchPjPjESE+M8MTITozoxEhOjODEyE2M2MRITYzQxDjVYhxqMc60GEdajBMtxoEW4zyLcZzFOM1is/eGnGbDqsLsvc0qwzzf26w6zPO9zSrEPN/brErM873NKsU839usWszzvc0qxjzf26xqzPO9zSrHPN/brHrM873NKsg838ucvTeshszzvc1qyDzf26yGzPO9zWrIPN/brIbM873Nasg839ushszzvc1qyDzfr5tbe89Nux33fnU3b6+9170+IhQjQTECFCM/MeITIz0xwhMjOzGiEyM5MYITIzcxYhMjNTFCE+NUi3Go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';
  const WEEKLY_IMPORT_BLANK_MARKERS = new Set(['', '-', '/', '#VALUE!']);
  const WEEKLY_IMPORT_ALLOWED_COUNTRIES = new Set(Object.keys(COUNTRY_COLORS));
  let weeklyImportExcelJsPromise = null;
  let weeklyImportZipPromise = null;
  const loadWeeklyImportExcelJs = async () => {
    if (!weeklyImportExcelJsPromise) {
      weeklyImportExcelJsPromise = ctx.importAsync('exceljs@4.4.0').then((module) => {
        const library = module?.default || module;
        const Workbook = library?.Workbook || module?.Workbook;
        if (typeof Workbook !== 'function') throw new Error('Excel 模块未提供 Workbook');
        return { Workbook };
      }).catch((error) => {
        weeklyImportExcelJsPromise = null;
        throw error;
      });
    }
    return weeklyImportExcelJsPromise;
  };
  const loadWeeklyImportZip = async () => {
    if (!weeklyImportZipPromise) {
      weeklyImportZipPromise = ctx.importAsync('jszip@3.10.1').then((module) => module?.default || module).catch((error) => {
        weeklyImportZipPromise = null;
        throw error;
      });
    }
    return weeklyImportZipPromise;
  };
  const excelBufferToDataUrl = (buffer) => {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let base64 = '';
    for (let offset = 0; offset < bytes.length; offset += 3) {
      const first = bytes[offset];
      const hasSecond = offset + 1 < bytes.length;
      const hasThird = offset + 2 < bytes.length;
      const second = hasSecond ? bytes[offset + 1] : 0;
      const third = hasThird ? bytes[offset + 2] : 0;
      const value = (first << 16) | (second << 8) | third;
      base64 += alphabet[(value >>> 18) & 63];
      base64 += alphabet[(value >>> 12) & 63];
      base64 += hasSecond ? alphabet[(value >>> 6) & 63] : '=';
      base64 += hasThird ? alphabet[value & 63] : '=';
    }
    return `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${base64}`;
  };
  const decodeDailyImportTemplate = () => {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = String(DAILY_IMPORT_TEMPLATE_BASE64 || '').replace(/\s+/g, '');
    if (!clean || clean.includes('__DAILY_IMPORT_TEMPLATE')) throw new Error('固定模板尚未写入代码');
    const output = new Uint8Array(Math.floor(clean.length * 3 / 4) - (clean.endsWith('==') ? 2 : (clean.endsWith('=') ? 1 : 0)));
    let outputIndex = 0;
    for (let offset = 0; offset < clean.length; offset += 4) {
      const a = alphabet.indexOf(clean[offset]);
      const b = alphabet.indexOf(clean[offset + 1]);
      const c = clean[offset + 2] === '=' ? 0 : alphabet.indexOf(clean[offset + 2]);
      const d = clean[offset + 3] === '=' ? 0 : alphabet.indexOf(clean[offset + 3]);
      const value = (a << 18) | (b << 12) | (c << 6) | d;
      if (outputIndex < output.length) output[outputIndex++] = (value >>> 16) & 255;
      if (outputIndex < output.length) output[outputIndex++] = (value >>> 8) & 255;
      if (outputIndex < output.length) output[outputIndex++] = value & 255;
    }
    return output;
  };
  const buildFixedDailyImportWorkbook = async (metadata = {}) => {
    const country = String(metadata.country || '').trim().toUpperCase();
    const asin = String(metadata.asin || '').trim().toUpperCase();
    const { Workbook } = await loadWeeklyImportExcelJs();
    const workbook = new Workbook();
    await workbook.xlsx.load(decodeDailyImportTemplate());
    const sheet = workbook.getWorksheet(WEEKLY_IMPORT_SHEET_NAME) || workbook.worksheets?.[0];
    if (!sheet) throw new Error('固定模板中没有“数据导入”工作表');
    sheet.getCell('B1').value = country;
    sheet.getCell('B2').value = asin;
    workbook.calcProperties.fullCalcOnLoad = true;
    return workbook.xlsx.writeBuffer();
  };
  const getWeeklyImportCellValue = (cell) => {
    const value = cell?.value;
    if (value == null) return '';
    if (value instanceof Date) return value;
    if (typeof value !== 'object') return value;
    if (Object.prototype.hasOwnProperty.call(value, 'result')) return value.result ?? '';
    if (Array.isArray(value.richText)) return value.richText.map((item) => item?.text || '').join('');
    if (Object.prototype.hasOwnProperty.call(value, 'text')) return value.text ?? '';
    return cell?.text ?? '';
  };
  const dailyImportMimeType = (extension) => ({
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', webp: 'image/webp',
  }[String(extension || '').toLowerCase()] || 'application/octet-stream');
  const dailyImportResolveZipPath = (basePath, target) => {
    if (String(target || '').startsWith('/')) return String(target).slice(1);
    const parts = `${basePath.split('/').slice(0, -1).join('/')}/${target || ''}`.split('/');
    const resolved = [];
    parts.forEach((part) => {
      if (!part || part === '.') return;
      if (part === '..') resolved.pop();
      else resolved.push(part);
    });
    return resolved.join('/');
  };
  const dailyImportXmlDecode = (value) => String(value || '')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  const dailyImportRelationshipMap = (xml, basePath) => {
    const result = {};
    String(xml || '').replace(/<Relationship\b([^>]*)\/?\s*>/gi, (_match, attributes) => {
      const id = attributes.match(/\bId="([^"]+)"/i)?.[1];
      const target = attributes.match(/\bTarget="([^"]+)"/i)?.[1];
      const external = attributes.match(/\bTargetMode="External"/i);
      if (id && target && !external) result[id] = dailyImportResolveZipPath(basePath, dailyImportXmlDecode(target));
      return _match;
    });
    return result;
  };
  const dailyImportCellCoordinate = (range) => {
    const row = Number(range?.tl?.nativeRow ?? range?.tl?.row ?? 0) + 1;
    const column = Number(range?.tl?.nativeCol ?? range?.tl?.col ?? 0) + 1;
    return { row, column };
  };
  const extractDailyImportImages = async (workbook, sheet, sourceBuffer) => {
    const images = new Map();
    let imageNumber = 0;
    const addImage = (row, column, bytes, extension) => {
      if (!row || !column || !bytes?.length) return;
      const ext = String(extension || 'bin').replace(/^\./, '').toLowerCase();
      const key = `${row}:${column}`;
      imageNumber += 1;
      const item = {
        row,
        column,
        bytes: bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes),
        type: dailyImportMimeType(ext),
        name: `screenshot-r${row}-c${column}-${imageNumber}.${ext}`,
      };
      images.set(key, [...(images.get(key) || []), item]);
    };
    (sheet.getImages?.() || []).forEach((entry) => {
      const media = workbook.getImage?.(entry.imageId);
      const coordinate = dailyImportCellCoordinate(entry.range);
      if (media?.buffer) addImage(coordinate.row, coordinate.column, media.buffer, media.extension);
    });

    try {
      const JSZip = await loadWeeklyImportZip();
      const zip = await JSZip.loadAsync(sourceBuffer);
      const readText = async (path) => zip.file(path) ? zip.file(path).async('string') : '';
      const workbookPath = 'xl/workbook.xml';
      const workbookXml = await readText(workbookPath);
      const workbookRels = dailyImportRelationshipMap(await readText('xl/_rels/workbook.xml.rels'), workbookPath);
      const sheetTag = [...workbookXml.matchAll(/<sheet\b[^>]*>/gi)].map((match) => match[0])
        .find((tag) => dailyImportXmlDecode(tag.match(/\bname="([^"]+)"/i)?.[1]) === sheet.name);
      const sheetRelId = sheetTag?.match(/\br:id="([^"]+)"/i)?.[1];
      const sheetPath = workbookRels[sheetRelId];
      const cellImagesPath = 'xl/cellimages.xml';
      if (!sheetPath || !zip.file(cellImagesPath)) return images;
      const sheetXml = await readText(sheetPath);
      const cellImagesXml = await readText(cellImagesPath);
      const cellImageRelsPath = 'xl/_rels/cellimages.xml.rels';
      const cellImageRels = dailyImportRelationshipMap(await readText(cellImageRelsPath), cellImagesPath);
      const mediaById = {};
      const cellImageBlocks = cellImagesXml.match(/<(?:\w+:)?cellImage\b[\s\S]*?<\/(?:\w+:)?cellImage>/gi) || [];
      cellImageBlocks.forEach((block) => {
        const imageId = dailyImportXmlDecode(block.match(/<(?:\w+:)?cNvPr\b[^>]*\bname="([^"]+)"/i)?.[1]);
        const relationId = block.match(/<(?:\w+:)?blip\b[^>]*\br:embed="([^"]+)"/i)?.[1];
        if (imageId && relationId && cellImageRels[relationId]) mediaById[imageId] = cellImageRels[relationId];
      });
      const cellPattern = /<c\b(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/c>/gi;
      let cellMatch;
      while ((cellMatch = cellPattern.exec(sheetXml))) {
        const coordinate = cellMatch[1].match(/\br="([A-Z]+)(\d+)"/i);
        const formula = dailyImportXmlDecode(cellMatch[2].match(/<f\b[^>]*>([\s\S]*?)<\/f>/i)?.[1]);
        const imageId = formula.match(/DISPIMG\s*\(\s*"([^"]+)"/i)?.[1];
        const mediaPath = mediaById[imageId];
        if (!coordinate || !mediaPath || !zip.file(mediaPath)) continue;
        const columnName = coordinate[1].toUpperCase();
        let column = 0;
        for (const character of columnName) column = column * 26 + character.charCodeAt(0) - 64;
        const extension = mediaPath.split('.').pop() || 'bin';
        const duplicate = (images.get(`${Number(coordinate[2])}:${column}`) || []).some((item) => item.name.includes(imageId));
        if (!duplicate) addImage(Number(coordinate[2]), column, await zip.file(mediaPath).async('uint8array'), extension);
      }
    } catch (error) {
      throw new Error(`无法读取 Excel 嵌入图片：${error?.message || '文件结构错误'}`);
    }
    return images;
  };
  const readWeeklyImportWorkbook = async (file) => {
    const { Workbook } = await loadWeeklyImportExcelJs();
    const workbook = new Workbook();
    const sourceBuffer = await file.arrayBuffer();
    await workbook.xlsx.load(sourceBuffer);
    const sheet = workbook.getWorksheet(WEEKLY_IMPORT_SHEET_NAME) || workbook.worksheets?.[0];
    if (!sheet) throw new Error('Excel 中没有可读取的工作表');
    const images = await extractDailyImportImages(workbook, sheet, sourceBuffer);
    return { workbook, sheet, images };
  };
  const normalizeWeeklyImportDate = (value) => {
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      const year = value.getUTCFullYear();
      const month = value.getUTCMonth() + 1;
      const day = value.getUTCDate();
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
    const text = String(value ?? '').trim();
    let year;
    let month;
    let day;
    const dateMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (dateMatch) {
      year = Number(dateMatch[1]);
      month = Number(dateMatch[2]);
      day = Number(dateMatch[3]);
    } else if (/^\d{5}(?:\.0+)?$/.test(text)) {
      const serial = Number(text);
      const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
      year = excelDate.getUTCFullYear();
      month = excelDate.getUTCMonth() + 1;
      day = excelDate.getUTCDate();
    } else {
      throw new Error('日期必须为 YYYY-MM-DD');
    }
    const checked = new Date(Date.UTC(year, month - 1, day));
    if (checked.getUTCFullYear() !== year || checked.getUTCMonth() + 1 !== month || checked.getUTCDate() !== day) {
      throw new Error('日期不存在');
    }
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };
  const isWeeklyImportBlank = (value) => WEEKLY_IMPORT_BLANK_MARKERS.has(String(value ?? '').trim().toUpperCase());
  const normalizeDailyImportImageCellText = (value, cellImages) => {
    const text = String(value ?? '').trim();
    return cellImages?.length && text === '[object Object]' ? '' : text;
  };
  const parseWeeklyImportValue = (rawValue, option) => {
    const text = String(rawValue ?? '').trim();
    if (isWeeklyImportBlank(text)) return undefined;
    if (option.type === 'text') {
      if (option.maxLength && text.length > option.maxLength) throw new Error(`最多允许 ${option.maxLength} 个字符，当前 ${text.length} 个`);
      return text;
    }
    const percent = option.type === 'ratio' && text.endsWith('%');
    const normalized = text.replace(/,/g, '').replace(/%$/, '');
    const value = Number(normalized);
    if (!Number.isFinite(value)) throw new Error('必须填写有效数字');
    if (option.type === 'integer' && !Number.isInteger(value)) throw new Error('必须填写整数');
    return percent ? value / 100 : value;
  };
  const parseManualOverrideFields = (value) => {
    if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item);
    if (value && typeof value === 'object') return Object.keys(value);
    if (typeof value !== 'string' || !value.trim()) return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string' && item) : Object.keys(parsed || {});
    } catch (_error) {
      return [];
    }
  };
  const calculateWeeklyImportDerivedFields = (fields) => {
    const result = {};
    const hasAll = (...names) => names.every((name) => toFormulaNumber(fields?.[name]) != null);
    const divide = (numerator, denominator, digits = 4, absolute = false) => {
      const value = safeDivide(numerator, denominator);
      if (value == null) return null;
      const rounded = roundRate(value, digits);
      return absolute && rounded != null ? Math.abs(rounded) : rounded;
    };
    if (hasAll('order_items', 'guanggaodan')) result.zirandan = toFormulaNumber(fields.order_items) - toFormulaNumber(fields.guanggaodan);
    if (hasAll('guanggaodan', 'sales')) result.adv_rate = divide(fields.guanggaodan, fields.sales, 4);
    if (hasAll('zongliuliang', 'guanggaodianji')) {
      const organicTraffic = toFormulaNumber(fields.zongliuliang) - toFormulaNumber(fields.guanggaodianji);
      result.zirandianji = organicTraffic;
      result.organic_traffic = organicTraffic;
      result.natural_traffic_proportion = divide(organicTraffic, fields.zongliuliang, 4);
    }
    if (hasAll('order_items', 'zongliuliang')) result.zongcvr = divide(fields.order_items, fields.zongliuliang, 4);
    if (hasAll('guanggaodan', 'guanggaodianji')) result.guanggaocvr = divide(fields.guanggaodan, fields.guanggaodianji, 4);
    if (hasAll('guanggaodianji', 'impressions')) result.ctr = divide(fields.guanggaodianji, fields.impressions, 4);
    if (hasAll('guanggaohuafei', 'guanggaodianji')) result.cpc = divide(fields.guanggaohuafei, fields.guanggaodianji, 2);
    if (hasAll('guanggaohuafei', 'guanggaodan')) {
      result.cpa = divide(fields.guanggaohuafei, fields.guanggaodan, 2);
      result.cpo = divide(fields.guanggaohuafei, fields.guanggaodan, 2, true);
    }
    if (hasAll('guanggaohuafei', 'sales')) result.cpu = divide(fields.guanggaohuafei, fields.sales, 2, true);
    if (hasAll('sales', 'zongliuliang')) {
      result.volume_cvr = divide(fields.sales, fields.zongliuliang, 4);
      result.session_conversion_rate = result.volume_cvr;
    }
    if (hasAll('return_count', 'sales')) result.return_rate = divide(fields.return_count, fields.sales, 4);
    if (hasAll('return_goods_count', 'sales')) result.return_goods_rate = divide(fields.return_goods_count, fields.sales, 4);
    if (hasAll('guanggaohuafei', 'ad_sales_amount')) result.acos = divide(fields.guanggaohuafei, fields.ad_sales_amount, 4);
    if (hasAll('guanggaohuafei', 'amount')) result.tacos = divide(fields.guanggaohuafei, fields.amount, 4);
    if (hasAll('guanggaodan', 'ad_direct_order_quantity')) {
      result.indirect_order_volume = toFormulaNumber(fields.guanggaodan) - toFormulaNumber(fields.ad_direct_order_quantity);
    }
    return result;
  };
  const parseDailyImportSheet = ({ sheet, images, country, asin, startDate, endDate }) => {
    const startMs = Date.parse(`${startDate}T00:00:00Z`);
    const endMs = Date.parse(`${endDate}T00:00:00Z`);
    const dateCount = Math.floor((endMs - startMs) / 86400000) + 1;
    if (dateCount <= 0) throw new Error('导入数据终止日期不能早于起始日期');
    if (dateCount > WEEKLY_IMPORT_MAX_ROWS) throw new Error(`起止日期最多允许 ${WEEKLY_IMPORT_MAX_ROWS} 天，请拆分文件`);

    const headerByColumn = {};
    const staticOptionsByColumn = {};
    const keywordColumns = [];
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      const header = String(getWeeklyImportCellValue(sheet.getCell(WEEKLY_IMPORT_HEADER_ROW, column)) ?? '').trim();
      headerByColumn[column] = header;
      if (DAILY_IMPORT_FIELDS_BY_LABEL[header]) staticOptionsByColumn[column] = DAILY_IMPORT_FIELDS_BY_LABEL[header];
      if (column >= DAILY_IMPORT_KEYWORD_START_COLUMN && column <= DAILY_IMPORT_KEYWORD_END_COLUMN && header) {
        keywordColumns.push({ column, name: header });
      }
    }
    if (headerByColumn[1] !== '日期') throw new Error('第6行第一列必须是“日期”');
    const expectedLabels = new Set(DAILY_IMPORT_FIELD_OPTIONS.map((item) => item.label));
    const presentLabels = new Set(Object.values(headerByColumn).filter(Boolean));
    const missingLabels = [...expectedLabels].filter((label) => !presentLabels.has(label));
    if (missingLabels.length) throw new Error(`模板缺少业务列：${missingLabels.join('、')}`);

    const normalizedKeywordNames = new Map();
    keywordColumns.forEach((item) => {
      const normalized = item.name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
      if (normalizedKeywordNames.has(normalized)) throw new Error(`关键词表头重复：${item.name}`);
      normalizedKeywordNames.set(normalized, item.name);
    });
    const competitorConfigs = DAILY_IMPORT_COMPETITORS.map((config) => ({
      ...config,
      asin: String(getWeeklyImportCellValue(sheet.getCell(config.asinCell)) ?? '').trim().toUpperCase(),
    }));
    const configuredCompetitors = new Map();
    competitorConfigs.forEach((config) => {
      if (!config.asin) return;
      if (!/^[A-Z0-9]{10}$/.test(config.asin)) throw new Error(`${config.asinCell} 的竞对 ASIN 必须是 10 位字母或数字`);
      if (configuredCompetitors.has(config.asin)) {
        throw new Error(`顶部配置：${configuredCompetitors.get(config.asin)}和${config.role}重复填写竞对 ASIN ${config.asin}`);
      }
      configuredCompetitors.set(config.asin, config.role);
    });

    const errors = [];
    const rows = [];
    const effectiveColumns = new Set();
    let skippedRows = 0;
    const imageCountInRow = (rowNumber) => [...images.keys()].some((key) => key.startsWith(`${rowNumber}:`));
    const rowHasInput = (rowNumber) => {
      for (const columnText of Object.keys(staticOptionsByColumn)) {
        const column = Number(columnText);
        if (!isWeeklyImportBlank(getWeeklyImportCellValue(sheet.getCell(rowNumber, column)))) return true;
        if ((images.get(`${rowNumber}:${column}`) || []).length) return true;
      }
      for (const keyword of keywordColumns) {
        if (!isWeeklyImportBlank(getWeeklyImportCellValue(sheet.getCell(rowNumber, keyword.column)))) return true;
      }
      for (const competitor of competitorConfigs) {
        if (!isWeeklyImportBlank(getWeeklyImportCellValue(sheet.getCell(rowNumber, competitor.rankColumn)))) return true;
        if (!isWeeklyImportBlank(getWeeklyImportCellValue(sheet.getCell(rowNumber, competitor.notesColumn)))) return true;
        if ((images.get(`${rowNumber}:${competitor.notesColumn}`) || []).length) return true;
      }
      return imageCountInRow(rowNumber);
    };

    for (let dayIndex = 0; dayIndex < dateCount; dayIndex += 1) {
      const rowNumber = WEEKLY_IMPORT_DATA_START_ROW + dayIndex;
      if (!rowHasInput(rowNumber)) {
        skippedRows += 1;
        continue;
      }
      const date = normalizeWeeklyImportDate(new Date(startMs + dayIndex * 86400000));
      const countryAsin = `${country}_${asin}`;
      const datedKey = `${countryAsin}_${date}`;
      const resources = {};
      const resourceImages = {};
      for (const key of images.keys()) {
        if (!key.startsWith(`${rowNumber}:`)) continue;
        const column = Number(key.split(':')[1]);
        const staticOption = staticOptionsByColumn[column];
        const competitorImageColumn = competitorConfigs.some((config) => config.notesColumn === column);
        if (!staticOption?.image && !competitorImageColumn) {
          errors.push(`第 ${rowNumber} 行第 ${column} 列：该列不支持图片`);
        }
      }
      Object.entries(staticOptionsByColumn).forEach(([columnText, option]) => {
        const column = Number(columnText);
        const cellImages = images.get(`${rowNumber}:${column}`) || [];
        const cellValue = getWeeklyImportCellValue(sheet.getCell(rowNumber, column));
        const rawValue = option.image ? normalizeDailyImportImageCellText(cellValue, cellImages) : cellValue;
        try {
          const value = parseWeeklyImportValue(rawValue, option);
          if (value !== undefined) {
            const existingValue = resources[option.resource]?.[option.field];
            if (existingValue !== undefined && existingValue !== value) {
              errors.push(`第 ${rowNumber} 行“${option.label}”：同一字段填写了不同值`);
            } else {
              resources[option.resource] = { ...(resources[option.resource] || {}), [option.field]: value };
              effectiveColumns.add(option.label);
            }
          }
        } catch (error) {
          errors.push(`第 ${rowNumber} 行“${option.label}”：${error?.message || '格式错误'}`);
        }
        if (cellImages.length && option.image) {
          resourceImages[option.resource] = resourceImages[option.resource] || {};
          resourceImages[option.resource][option.field] = [...(resourceImages[option.resource][option.field] || []), ...cellImages];
          effectiveColumns.add(option.label);
        } else if (cellImages.length && !option.image) {
          errors.push(`第 ${rowNumber} 行“${option.label}”：该列不支持图片`);
        }
      });
      const keywords = [];
      keywordColumns.forEach((keyword) => {
        const value = String(getWeeklyImportCellValue(sheet.getCell(rowNumber, keyword.column)) ?? '').trim();
        if (!isWeeklyImportBlank(value)) {
          keywords.push({ name: keyword.name, rank: value });
          effectiveColumns.add(keyword.name);
        }
      });
      const competitors = {};
      competitorConfigs.forEach((config) => {
        const rank = String(getWeeklyImportCellValue(sheet.getCell(rowNumber, config.rankColumn)) ?? '').trim();
        const noteImages = images.get(`${rowNumber}:${config.notesColumn}`) || [];
        const notes = normalizeDailyImportImageCellText(
          getWeeklyImportCellValue(sheet.getCell(rowNumber, config.notesColumn)),
          noteImages,
        );
        const hasDailyData = !isWeeklyImportBlank(rank) || !isWeeklyImportBlank(notes) || noteImages.length;
        if (hasDailyData && !config.asin) {
          errors.push(`第 ${rowNumber} 行${config.role}有每日数据，但顶部 ${config.asinCell} 未填写竞对 ASIN`);
          return;
        }
        if (hasDailyData) competitors[config.role] = {
          asin: config.asin,
          rank: isWeeklyImportBlank(rank) ? undefined : rank,
          notes: isWeeklyImportBlank(notes) ? undefined : notes,
          images: noteImages,
        };
        if (!isWeeklyImportBlank(rank)) effectiveColumns.add(`${config.role}排名`);
        if (!isWeeklyImportBlank(notes) || noteImages.length) effectiveColumns.add(`${config.role}操作分析`);
      });
      const hasContent = Object.values(resources).some((fields) => Object.keys(fields).length)
        || Object.values(resourceImages).some((fields) => Object.keys(fields).length)
        || keywords.length || Object.keys(competitors).length;
      if (hasContent) rows.push({
        rowNumber,
        country,
        asin,
        countryAsin,
        asinCountry: `${asin}_${country}`,
        date,
        datedKey,
        resources,
        resourceImages,
        keywords,
        competitors,
      });
      else skippedRows += 1;
    }
    for (let rowNumber = WEEKLY_IMPORT_DATA_START_ROW + dateCount; rowNumber <= sheet.actualRowCount; rowNumber += 1) {
      if (rowHasInput(rowNumber)) errors.push(`第 ${rowNumber} 行：存在超出终止日期 ${endDate} 的业务数据或图片`);
      if (errors.length > 12) break;
    }
    if (errors.length) {
      const shown = errors.slice(0, 12).join('\n');
      throw new Error(`${shown}${errors.length > 12 ? `\n另有 ${errors.length - 12} 个错误` : ''}`);
    }
    if (!rows.length) throw new Error('Excel 中没有有效业务数据');
    return { rows, skippedRows, effectiveColumns: [...effectiveColumns], keywordNames: keywordColumns.map((item) => item.name), competitorConfigs };
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
    'activity_annotation',
    'list_price',
    'daily_price',
    'price_after_discount',
    'promotion_days',
    'number_of_comments',
    'rsg_number',
    'target_order_qty',
    'target_subcategory_rank',
    'review_discounted_price',
    'sales',
    'guanggaodan',
    'guanggaodianji',
    'zongliuliang',
    'page_views_total',
    'guanggaohuafei',
    'ranking',
    'guanggaocvr',
    'cpa',
    'cpu',
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

  const ImportantCellMarker = React.memo(({ visible }) => {
    if (!visible) return null;
    return React.createElement('span', {
      title: '重点单元格',
      'aria-label': '重点单元格',
      style: {
        position: 'absolute',
        top: '2px',
        right: '3px',
        zIndex: 4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: IMPORTANT_CELL_COLOR,
        fontSize: '11px',
        lineHeight: 1,
        pointerEvents: 'none',
      },
    }, StarFilled ? React.createElement(StarFilled) : '★');
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
    const hoverTipMoveAtRef = useRef(0);

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
    const updateHoverTip = (e, force = false) => {
      if (isEmpty) return;
      const now = Date.now();
      if (!force && now - hoverTipMoveAtRef.current < 32) return;
      hoverTipMoveAtRef.current = now;
      setHoverTip({ x: e.clientX, y: e.clientY });
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
      React.createElement('div', { ref: cellRef, onMouseEnter: (e) => updateHoverTip(e, true), onMouseMove: updateHoverTip, onMouseLeave: () => setHoverTip(null), style: { height: '46px', display: 'flex', alignItems: 'center', justifyContent: isEmpty ? 'center' : 'flex-start', gap: '5px', padding: '3px 5px', background: cellBackground || (content ? '#fafafa' : '#fff'), border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'cell', overflow: 'hidden', boxSizing: 'border-box', contentVisibility: 'auto', containIntrinsicSize: '46px' } },
        isEmpty
          ? React.createElement('div', { style: { fontSize: '16px', color: '#999', lineHeight: '18px', fontWeight: 700, textAlign: 'center' } }, placeholder)
          : React.createElement(React.Fragment, null,
              imageUrls.slice(0, 2).map((url, idx) =>
                React.createElement('img', {
                  key: `${url}-${idx}`,
                  src: url,
                  loading: 'lazy',
                  decoding: 'async',
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
    const safeDates = Array.isArray(dates) ? dates : [];
    const safeSeries = (Array.isArray(series) ? series : []).filter((item) => item.data.some((value) => toFormulaNumber(value) != null));
    const width = 1640;
    const height = 760;
    const margin = { top: 64, right: 122, bottom: 156, left: 118 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const [hoverIndex, setHoverIndex] = useState(null);

    if (!safeDates.length || !safeSeries.length) {
      return React.createElement('div', {
        style: { minHeight: '360px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', background: '#111827', borderRadius: '8px', fontSize: '16px' },
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
    const labelFontSize = safeDates.length > 40 ? 12 : safeDates.length > 16 ? 14 : 17;
    const labelMinGap = labelFontSize + 8;
    const labelTopLimit = margin.top + labelFontSize;
    const labelBottomLimit = margin.top + plotHeight - 12;
    const labelOffsets = [-18, 26, -34, 42];
    const pointLabels = safeDates.flatMap((date, dateIndex) => {
      const labels = safeSeries.map((item, seriesIndex) => {
        const scale = item.axis === 'right' ? rightScale : leftScale;
        const value = toFormulaNumber(item.data[dateIndex]);
        if (!scale || value == null) return null;
        const pointY = yFor(value, scale);
        return {
          item,
          value,
          pointX: xFor(dateIndex),
          pointY,
          labelY: Math.min(labelBottomLimit, Math.max(labelTopLimit, pointY + labelOffsets[seriesIndex % labelOffsets.length])),
        };
      }).filter(Boolean).sort((a, b) => a.labelY - b.labelY);
      if (!labels.length) return [];
      for (let index = 1; index < labels.length; index += 1) {
        if (labels[index].labelY - labels[index - 1].labelY < labelMinGap) {
          labels[index].labelY = labels[index - 1].labelY + labelMinGap;
        }
      }
      const bottomOverflow = labels[labels.length - 1].labelY - labelBottomLimit;
      if (bottomOverflow > 0) labels.forEach((label) => { label.labelY -= bottomOverflow; });
      for (let index = labels.length - 2; index >= 0; index -= 1) {
        if (labels[index + 1].labelY - labels[index].labelY < labelMinGap) {
          labels[index].labelY = labels[index + 1].labelY - labelMinGap;
        }
      }
      const topOverflow = labelTopLimit - labels[0].labelY;
      if (topOverflow > 0) labels.forEach((label) => { label.labelY += topOverflow; });
      const center = (labels.length - 1) / 2;
      return labels.map((label, labelIndex) => ({
        ...label,
        date,
        labelX: label.pointX + (labelIndex - center) * 18,
      }));
    });
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
      style: { position: 'relative', width: '100%', boxSizing: 'border-box', background: '#111827', borderRadius: '8px', padding: '18px', color: '#cbd5e1', fontVariantNumeric: 'tabular-nums' },
      onMouseLeave: () => setHoverIndex(null),
    },
      React.createElement('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '8px 14px', padding: '0 4px 12px', maxHeight: '96px', overflowY: 'auto' } },
        safeSeries.map((item) => React.createElement('div', { key: `legend_${item.key}`, style: { display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#cbd5e1', fontSize: '14px', fontWeight: 700 } },
          React.createElement('span', { style: { width: '18px', height: '3px', borderRadius: '2px', background: item.color } }),
          React.createElement('span', null, item.name)
        ))
      ),
      React.createElement('svg', { viewBox: `0 0 ${width} ${height}`, width: '100%', height: 'auto', role: 'img', style: { display: 'block' } },
        React.createElement('rect', { x: 0, y: 0, width, height, fill: '#111827' }),
        ticks(leftScale || rightScale).map((tick, index) => React.createElement('line', { key: `grid_${index}`, x1: margin.left, y1: yFor(tick, leftScale || rightScale), x2: margin.left + plotWidth, y2: yFor(tick, leftScale || rightScale), stroke: '#243244', strokeWidth: 1 })),
        ticks(leftScale).map((tick, index) => React.createElement('text', { key: `left_${index}`, x: margin.left - 14, y: yFor(tick, leftScale) + 5, textAnchor: 'end', fill: '#94a3b8', fontSize: 16, fontWeight: 700 }, formatTrendChartValue(tick, leftIntegerOnly ? 'integer' : 'decimal'))),
        ticks(rightScale).map((tick, index) => React.createElement('text', { key: `right_${index}`, x: margin.left + plotWidth + 14, y: yFor(tick, rightScale) + 5, textAnchor: 'start', fill: '#F59E0B', fontSize: 16, fontWeight: 700 }, formatTrendChartValue(tick, 'percent'))),
        React.createElement('line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('line', { x1: margin.left + plotWidth, y1: margin.top, x2: margin.left + plotWidth, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('line', { x1: margin.left, y1: margin.top + plotHeight, x2: margin.left + plotWidth, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('text', { x: margin.left, y: margin.top - 22, fill: '#94a3b8', fontSize: 17, fontWeight: 800, textAnchor: 'middle' }, '实际数值'),
        React.createElement('text', { x: margin.left + plotWidth, y: margin.top - 22, fill: '#F59E0B', fontSize: 17, fontWeight: 800, textAnchor: 'middle' }, '百分比'),
        safeDates.map((date, index) => {
          if (index % labelStep !== 0 && index !== safeDates.length - 1) return null;
          const x = xFor(index);
          return React.createElement('text', { key: `date_${date.key}`, x, y: margin.top + plotHeight + 34, fill: '#94a3b8', fontSize: 15, fontWeight: 700, textAnchor: 'end', transform: `rotate(-38 ${x} ${margin.top + plotHeight + 34})` }, date.label);
        }).filter(Boolean),
        safeSeries.map((item) => {
          const scale = item.axis === 'right' ? rightScale : leftScale;
          return scale ? React.createElement('path', { key: `line_${item.key}`, d: pathFor(item, scale), fill: 'none', stroke: item.color, strokeWidth: 2.2, strokeLinejoin: 'round', strokeLinecap: 'round', opacity: 0.95 }) : null;
        }),
        pointLabels.flatMap(({ item, value, pointX, pointY, labelX, labelY, date }) => ([
            React.createElement('circle', { key: `point_${item.key}_${date.key}`, cx: pointX, cy: pointY, r: 5, fill: item.color, stroke: '#111827', strokeWidth: 2 }),
            React.createElement('text', {
              key: `point_value_${item.key}_${date.key}`,
              x: labelX,
              y: labelY,
              fill: item.color,
              fontSize: labelFontSize,
              fontWeight: 800,
              textAnchor: 'middle',
              style: { paintOrder: 'stroke', stroke: '#111827', strokeWidth: 5, strokeLinejoin: 'round', pointerEvents: 'none' },
            }, formatTrendChartValue(value, item.valueType)),
          ])),
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
        style: { position: 'absolute', top: '132px', left: tooltipLeft, transform: tooltipTransform, width: '360px', maxWidth: 'calc(100% - 32px)', padding: '12px 14px', borderRadius: '8px', border: '1px solid rgba(148,163,184,0.45)', background: 'rgba(15,23,42,0.96)', color: '#e2e8f0', boxShadow: '0 18px 42px rgba(15,23,42,0.36)', zIndex: 2 },
      },
        React.createElement('div', { style: { color: '#f8fafc', fontWeight: 800, fontSize: '16px', marginBottom: '10px' } }, hoverDate.label),
        React.createElement('div', { style: { display: 'grid', gap: '7px', maxHeight: '300px', overflowY: 'auto' } },
          hoverRows.map((row) => React.createElement('div', { key: `tip_${row.key}`, style: { display: 'grid', gridTemplateColumns: '10px minmax(0,1fr) auto', alignItems: 'center', gap: '10px', fontSize: '14px' } },
            React.createElement('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: row.color } }),
            React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#cbd5e1' } }, row.name),
            React.createElement('span', { style: { color: toFormulaNumber(row.value) == null ? '#64748b' : '#f8fafc', fontWeight: 800 } }, formatTrendChartValue(row.value, row.valueType))
          ))
        )
      )
    );
  };

  const MergedTrendChartModal = ({ visible, onClose, country, asin, dateRange }) => {
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [chartRows, setChartRows] = useState([]);
    const [selectedFieldKeys, setSelectedFieldKeys] = useState(TREND_CHART_DEFAULT_FIELD_KEYS);
    const [customQuickGroups, setCustomQuickGroups] = useState([]);
    const [customQuickLoading, setCustomQuickLoading] = useState(false);
    const [customQuickSaving, setCustomQuickSaving] = useState(false);
    const [showCustomQuickModal, setShowCustomQuickModal] = useState(false);
    const [showCustomQuickDeleteModal, setShowCustomQuickDeleteModal] = useState(false);
    const [customQuickName, setCustomQuickName] = useState('');
    const [selectedDeleteQuickIds, setSelectedDeleteQuickIds] = useState([]);
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
    const fieldKeysByGroup = useMemo(() => Object.fromEntries(TREND_CHART_FIELD_GROUPS.map((group) => [
      group.key,
      TREND_CHART_FIELDS.filter((field) => group.sourceGroups.includes(field.group)).map((field) => field.key),
    ])), []);
    const fieldOptionsByGroup = useMemo(() => Object.fromEntries(TREND_CHART_FIELD_GROUPS.map((group) => [
      group.key,
      TREND_CHART_FIELDS.filter((field) => group.sourceGroups.includes(field.group)).map((field) => ({ value: field.key, label: field.label })),
    ])), []);
    const updateSelectedFieldsByGroup = (groupKey, groupFieldKeys) => {
      const groupKeys = new Set(fieldKeysByGroup[groupKey] || []);
      const nextGroupKeys = new Set(Array.isArray(groupFieldKeys) ? groupFieldKeys : []);
      setSelectedFieldKeys((currentKeys) => TREND_CHART_FIELDS.filter((field) => (
        groupKeys.has(field.key) ? nextGroupKeys.has(field.key) : currentKeys.includes(field.key)
      )).map((field) => field.key));
    };

    useEffect(() => {
      if (!visible) {
        setShowCustomQuickModal(false);
        setShowCustomQuickDeleteModal(false);
        setCustomQuickName('');
        setSelectedDeleteQuickIds([]);
        return undefined;
      }
      let active = true;
      const loadCustomQuickGroups = async () => {
        if (!currentUserId) {
          setCustomQuickGroups([]);
          return;
        }
        try {
          setCustomQuickLoading(true);
          const groups = await loadTrendChartQuickGroupsFromUser();
          if (active) setCustomQuickGroups(groups);
        } catch (error) {
          if (active) {
            setCustomQuickGroups([]);
            ctx.message.error(`加载自定义指标失败：${error?.message || '未知错误'}`);
          }
        } finally {
          if (active) setCustomQuickLoading(false);
        }
      };
      loadCustomQuickGroups();
      return () => { active = false; };
    }, [visible]);

    const handleSaveCustomQuick = useCallback(async () => {
      const name = customQuickName.trim();
      if (!currentUserId) {
        ctx.message.warning('未识别到当前用户，无法保存自定义指标');
        return;
      }
      if (!name) {
        ctx.message.warning('请输入指标名称');
        return;
      }
      if (!selectedFieldKeys.length) {
        ctx.message.warning('请先选择至少一个指标字段');
        return;
      }
      if (isTrendChartQuickNameTaken(name, customQuickGroups)) {
        ctx.message.warning('指标名称已存在，请更换名称');
        return;
      }
      try {
        setCustomQuickSaving(true);
        const latestGroups = await loadTrendChartQuickGroupsFromUser();
        if (isTrendChartQuickNameTaken(name, latestGroups)) {
          ctx.message.warning('指标名称已存在，请更换名称');
          setCustomQuickGroups(latestGroups);
          return;
        }
        const nextGroups = [
          ...latestGroups,
          {
            id: `chart_quick_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            name,
            fields: selectedFieldKeys,
          },
        ];
        await saveTrendChartQuickGroupsToUser(nextGroups);
        setCustomQuickGroups(nextGroups);
        setCustomQuickName('');
        setShowCustomQuickModal(false);
        ctx.message.success('自定义指标已保存');
      } catch (error) {
        ctx.message.error(`保存自定义指标失败：${error?.message || '未知错误'}`);
      } finally {
        setCustomQuickSaving(false);
      }
    }, [customQuickGroups, customQuickName, selectedFieldKeys]);

    const handleDeleteCustomQuick = useCallback(async (groupIds) => {
      if (!currentUserId) {
        ctx.message.warning('未识别到当前用户，无法删除自定义指标');
        return false;
      }
      const requestedIds = Array.from(new Set(Array.isArray(groupIds) ? groupIds : [groupIds])).filter(Boolean);
      if (!requestedIds.length) {
        ctx.message.warning('请选择要删除的自定义指标');
        return false;
      }
      try {
        setCustomQuickSaving(true);
        const latestGroups = await loadTrendChartQuickGroupsFromUser();
        const requestedIdSet = new Set(requestedIds);
        const existingDeleteIds = latestGroups
          .filter((group) => requestedIdSet.has(group.id))
          .map((group) => group.id);
        if (!existingDeleteIds.length) {
          setCustomQuickGroups(latestGroups);
          ctx.message.warning('所选自定义指标已不存在，列表已刷新');
          return false;
        }
        const existingDeleteIdSet = new Set(existingDeleteIds);
        const nextGroups = latestGroups.filter((group) => !existingDeleteIdSet.has(group.id));
        await saveTrendChartQuickGroupsToUser(nextGroups);
        setCustomQuickGroups(nextGroups);
        ctx.message.success(`已删除 ${existingDeleteIds.length} 个自定义指标`);
        return true;
      } catch (error) {
        ctx.message.error(`删除自定义指标失败：${error?.message || '未知错误'}`);
        return false;
      } finally {
        setCustomQuickSaving(false);
      }
    }, []);

    const handleConfirmDeleteCustomQuick = useCallback(async () => {
      if (!selectedDeleteQuickIds.length) {
        ctx.message.warning('请选择要删除的自定义指标');
        return;
      }
      const deleted = await handleDeleteCustomQuick(selectedDeleteQuickIds);
      if (!deleted) return;
      setShowCustomQuickDeleteModal(false);
      setSelectedDeleteQuickIds([]);
    }, [handleDeleteCustomQuick, selectedDeleteQuickIds]);

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
          const [weeklyRows, profitRows, orderLinkRows] = await Promise.all([
            fetchByKeys('weekly_performance:list', 'country_asin_week', dailyKeys),
            fetchByKeys('daily_profit:list', 'country_asin_date', dailyKeys),
            fetchByKeys('daily_order_link_tracking:list', 'country_asin_date', dailyKeys),
          ]);
          if (!active) return;
          const weeklyMap = Object.fromEntries(weeklyRows.filter((row) => row?.country_asin_week).map((row) => [row.country_asin_week, row]));
          const profitMap = Object.fromEntries(profitRows.filter((row) => row?.country_asin_date).map((row) => [row.country_asin_date, row]));
          const orderLinkMap = Object.fromEntries(orderLinkRows.filter((row) => row?.country_asin_date).map((row) => [row.country_asin_date, row]));
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
            order_link: orderLinkMap[row.country_asin_date] || {},
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
      const sortedDates = chartRows.map((row) => row.date).filter(Boolean).sort();
      const rangeStart = queryDateStart || sortedDates[0] || '';
      const rangeEnd = queryDateEnd || sortedDates[sortedDates.length - 1] || rangeStart;
      const startDay = rangeStart ? ctx.libs.dayjs(rangeStart) : null;
      const endDay = rangeEnd ? ctx.libs.dayjs(rangeEnd) : null;
      const totalDays = startDay?.isValid() && endDay?.isValid() && !endDay.isBefore(startDay, 'day')
        ? endDay.diff(startDay, 'day') + 1
        : 0;
      const chartRowMap = new Map(chartRows.map((row) => [row.date, row]));
      const continuousRows = totalDays > 0
        ? Array.from({ length: totalDays }, (_, index) => {
            const date = startDay.add(index, 'day').format('YYYY-MM-DD');
            return chartRowMap.get(date) || { key: `${country}_${asin}_${date}`, date, weekly: {}, profit: {}, order_link: {} };
          })
        : chartRows;
      const dates = continuousRows.map((row) => ({ key: row.key, label: row.date }));
      const series = selectedFieldKeys.map((key, index) => {
        const field = fieldMap[key];
        if (!field) return null;
        return { key, name: field.label, axis: field.axis, valueType: field.valueType, color: TREND_CHART_LINE_COLORS[index % TREND_CHART_LINE_COLORS.length], data: continuousRows.map((row) => toFormulaNumber(row[field.src]?.[field.field])) };
      }).filter(Boolean);
      return { dates, series };
    }, [chartRows, fieldMap, selectedFieldKeys, queryDateStart, queryDateEnd, country, asin]);
    const availableDataDates = chartRows.filter((row) => TREND_CHART_FIELDS.some((field) => (
      toFormulaNumber(row[field.src]?.[field.field]) != null
    ))).map((row) => row.date).filter(Boolean).sort();
    const availableDateRange = availableDataDates.length ? [availableDataDates[0], todayDate] : null;
    const pickerDateRange = dateMode === 'custom'
      ? displayedDateRange
      : presetDateRange || availableDateRange;
    const hasSameSelection = (currentKeys, targetKeys) => {
      if (!Array.isArray(currentKeys) || !Array.isArray(targetKeys) || currentKeys.length !== targetKeys.length) return false;
      const currentSet = new Set(currentKeys);
      return targetKeys.every((key) => currentSet.has(key));
    };
    const QUICK_BUTTON_PALETTES = {
      default: {
        border: '#bae6fd', background: '#f0f9ff', color: '#0369a1',
        activeBorder: '#38bdf8', activeBackground: '#e0f2fe', activeColor: '#075985',
        activeShadow: '0 0 0 2px rgba(14,165,233,0.14)',
      },
      custom: {
        border: '#ddd6fe', background: '#f5f3ff', color: '#6d28d9',
        activeBorder: '#a78bfa', activeBackground: '#ede9fe', activeColor: '#5b21b6',
        activeShadow: '0 0 0 2px rgba(124,58,237,0.14)',
      },
      availableDates: {
        border: '#bbf7d0', background: '#f0fdf4', color: '#15803d',
        activeBorder: '#4ade80', activeBackground: '#dcfce7', activeColor: '#166534',
        activeShadow: '0 0 0 2px rgba(34,197,94,0.14)',
      },
      recentDates: {
        border: '#fed7aa', background: '#fff7ed', color: '#c2410c',
        activeBorder: '#fb923c', activeBackground: '#ffedd5', activeColor: '#9a3412',
        activeShadow: '0 0 0 2px rgba(249,115,22,0.14)',
      },
    };
    const getQuickButtonStyle = (active, palette = QUICK_BUTTON_PALETTES.default) => ({
      minHeight: '40px',
      padding: '4px 12px',
      borderColor: active ? palette.activeBorder : palette.border,
      background: active ? palette.activeBackground : palette.background,
      color: active ? palette.activeColor : palette.color,
      borderRadius: '4px',
      boxShadow: active ? palette.activeShadow : '0 1px 1px rgba(15,23,42,0.04)',
      fontWeight: active ? 800 : 700,
      fontSize: `${FONT_SIZE_XS}px`,
    });
    const quickGroupStyle = {
      display: 'flex',
      gap: '8px',
      alignItems: 'center',
      flexWrap: 'nowrap',
      flexShrink: 0,
      padding: '6px 8px',
      background: '#f8fafc',
      borderRadius: '6px',
      boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.07)',
      boxSizing: 'border-box',
    };
    const quickGroupLabelStyle = {
      color: '#64748b',
      fontWeight: 700,
      fontSize: `${FONT_SIZE_XS}px`,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    };
    const setQuickDateMode = (value) => {
      setDateModeState({ scopeKey: dateRangeScopeKey, value });
      setDateRangeState({ scopeKey: dateRangeScopeKey, value: null });
    };

    return React.createElement(Modal, {
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 'min(1740px, calc(100vw - 32px))',
      destroyOnClose: false,
      bodyStyle: { padding: '16px 20px 20px', maxHeight: 'calc(100vh - 96px)', overflowX: 'hidden', overflowY: 'auto' },
    },
      !country || !asin
        ? React.createElement('div', { style: { padding: 24, color: '#999' } }, '请先筛选到具体国家和 ASIN。')
        : React.createElement('div', null,
          React.createElement('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '10px',
              marginBottom: '10px',
            },
          },
            TREND_CHART_FIELD_GROUPS.map((group) => React.createElement('div', { key: `trend_group_${group.key}`, style: { minWidth: 0 } },
              React.createElement('div', { style: { marginBottom: '4px', color: '#334155', fontSize: `${FONT_SIZE_XS}px`, fontWeight: 700 } }, group.label),
              React.createElement(Select, {
                mode: 'multiple',
                allowClear: true,
                showSearch: true,
                placeholder: `选择${group.label}字段`,
                value: selectedFieldKeys.filter((key) => (fieldKeysByGroup[group.key] || []).includes(key)),
                options: fieldOptionsByGroup[group.key] || [],
                onChange: (values) => updateSelectedFieldsByGroup(group.key, values),
                optionFilterProp: 'label',
                maxTagCount: 'responsive',
                style: { width: '100%' },
              })
            ))
          ),
          React.createElement('div', {
            'aria-busy': loading,
            style: {
              display: 'flex',
              gap: '8px',
              marginBottom: '12px',
              alignItems: 'center',
              flexWrap: 'nowrap',
              overflowX: 'auto',
              boxSizing: 'border-box',
            },
          },
            React.createElement('div', { style: quickGroupStyle },
              React.createElement('span', { style: quickGroupLabelStyle }, '快捷指标'),
              ...TREND_CHART_PRESET_OPTIONS.map((option) => {
                const fields = TREND_CHART_PRESETS[option.value] || [];
                const active = hasSameSelection(selectedFieldKeys, fields);
                return React.createElement(Button, {
                  key: option.value,
                  'aria-pressed': active,
                  onClick: () => setSelectedFieldKeys([...fields]),
                  style: getQuickButtonStyle(active),
                }, option.label);
              })
            ),
            React.createElement('div', { style: quickGroupStyle },
              React.createElement('span', { style: quickGroupLabelStyle }, '自定义指标'),
              !customQuickLoading && customQuickGroups.map((group) => {
                const active = hasSameSelection(selectedFieldKeys, group.fields);
                return React.createElement(Button, {
                  key: group.id,
                  onClick: () => setSelectedFieldKeys(group.fields),
                  disabled: customQuickSaving,
                  title: group.name,
                  'aria-pressed': active,
                  style: getQuickButtonStyle(active, QUICK_BUTTON_PALETTES.custom),
                }, React.createElement('span', { style: { display: 'block', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, group.name));
              }),
              React.createElement(Button, {
                disabled: !currentUserId || customQuickLoading || customQuickSaving,
                loading: customQuickLoading || (showCustomQuickModal && customQuickSaving),
                type: 'primary',
                title: currentUserId ? '保存当前指标组合' : '未识别到当前用户，无法保存',
                'aria-label': '保存当前指标组合',
                icon: SaveOutlined ? React.createElement(SaveOutlined) : null,
                onClick: () => { setCustomQuickName(''); setShowCustomQuickModal(true); },
                style: { width: '40px', minWidth: '40px', height: '40px', padding: 0, borderRadius: '4px' },
              }, SaveOutlined ? null : '存'),
              React.createElement(Button, {
                danger: true,
                type: 'primary',
                disabled: !currentUserId || customQuickLoading || customQuickSaving || !customQuickGroups.length,
                loading: customQuickLoading || (showCustomQuickDeleteModal && customQuickSaving),
                title: customQuickGroups.length ? '删除自定义指标' : '暂无可删除的自定义指标',
                'aria-label': '删除自定义指标',
                icon: DeleteOutlined ? React.createElement(DeleteOutlined) : null,
                onClick: () => { setSelectedDeleteQuickIds([]); setShowCustomQuickDeleteModal(true); },
                style: { width: '40px', minWidth: '40px', height: '40px', padding: 0, borderRadius: '4px' },
              }, DeleteOutlined ? null : '删')
            ),
            React.createElement('div', { style: quickGroupStyle },
              React.createElement('span', { style: quickGroupLabelStyle }, '日期快捷'),
              ...TREND_CHART_DATE_MODE_OPTIONS.filter((option) => option.value !== 'custom').map((option) => {
                const active = dateMode === option.value;
                const palette = option.value === 'available' ? QUICK_BUTTON_PALETTES.availableDates : QUICK_BUTTON_PALETTES.recentDates;
                return React.createElement(Button, {
                  key: option.value,
                  'aria-pressed': active,
                  onClick: () => setQuickDateMode(option.value),
                  style: getQuickButtonStyle(active, palette),
                }, option.label);
              }),
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
                style: { width: '240px', minWidth: '240px', height: '40px' },
              })
            )
          ),
          errorText && React.createElement('div', { style: { marginBottom: '12px', padding: '8px 10px', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: '6px', color: '#cf1322' } }, errorText),
          React.createElement('div', { style: { width: '100%', paddingBottom: '6px' } },
            React.createElement(MergedTrendLineChart, { dates: chartPayload.dates, series: chartPayload.series })
          ),
          React.createElement('div', { style: { marginTop: '8px', color: '#64748b', fontSize: `${FONT_SIZE_XS}px` } }, '说明：图表展示实际数值，不做归一化或趋势换算；已有数据日期为最早真实指标日期至今天，0 视为有效数据，空值日期会保留并以断线表示。'),
          React.createElement(Modal, {
            title: '保存自定义指标',
            open: showCustomQuickModal,
            visible: showCustomQuickModal,
            width: 420,
            okText: '保存',
            cancelText: '取消',
            confirmLoading: customQuickSaving,
            maskClosable: !customQuickSaving,
            destroyOnClose: true,
            onOk: handleSaveCustomQuick,
            onCancel: () => {
              if (customQuickSaving) return;
              setShowCustomQuickModal(false);
              setCustomQuickName('');
            },
          },
            React.createElement('div', { style: { display: 'grid', gap: '6px' } },
              React.createElement('label', { htmlFor: `${BLOCK_UID}_chart_quick_name`, style: { color: '#475569', fontWeight: 700, fontSize: `${FONT_SIZE_SM}px` } }, '指标名称'),
              React.createElement(Input, {
                id: `${BLOCK_UID}_chart_quick_name`,
                autoFocus: true,
                value: customQuickName,
                placeholder: '输入指标名称',
                disabled: customQuickSaving,
                onChange: (event) => setCustomQuickName(event.target.value),
                onPressEnter: () => { if (!customQuickSaving) handleSaveCustomQuick(); },
                style: { width: '100%', minHeight: '40px' },
              })
            )
          ),
          React.createElement(Modal, {
            title: '删除自定义指标',
            open: showCustomQuickDeleteModal,
            visible: showCustomQuickDeleteModal,
            width: 420,
            okText: '删除',
            cancelText: '取消',
            confirmLoading: customQuickSaving,
            okButtonProps: { danger: true, disabled: !selectedDeleteQuickIds.length },
            maskClosable: !customQuickSaving,
            destroyOnClose: true,
            onOk: handleConfirmDeleteCustomQuick,
            onCancel: () => {
              if (customQuickSaving) return;
              setShowCustomQuickDeleteModal(false);
              setSelectedDeleteQuickIds([]);
            },
          },
            React.createElement('div', { style: { display: 'grid', gap: '6px' } },
              React.createElement('label', { style: { color: '#475569', fontWeight: 700, fontSize: `${FONT_SIZE_SM}px` } }, '选择要删除的指标（可多选）'),
              customQuickGroups.length
                ? React.createElement('div', {
                    style: {
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      width: '100%',
                      maxHeight: '280px',
                      overflowY: 'auto',
                      padding: '2px',
                      boxSizing: 'border-box',
                    },
                  },
                    ...customQuickGroups.map((group) => {
                      const active = selectedDeleteQuickIds.includes(group.id);
                      return React.createElement(Button, {
                        key: group.id,
                        disabled: customQuickSaving,
                        title: group.name,
                        'aria-pressed': active,
                        onClick: () => setSelectedDeleteQuickIds((currentIds) => (
                          currentIds.includes(group.id)
                            ? currentIds.filter((id) => id !== group.id)
                            : [...currentIds, group.id]
                        )),
                        style: {
                          ...getQuickButtonStyle(active),
                          height: 'auto',
                          maxWidth: '100%',
                          whiteSpace: 'normal',
                          overflowWrap: 'anywhere',
                        },
                      }, group.name);
                    })
                  )
                : React.createElement('div', {
                    style: {
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      color: '#94a3b8',
                      fontSize: `${FONT_SIZE_SM}px`,
                    },
                  }, '暂无可删除的自定义指标')
            )
          )
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
    const [weeklyImportVisible, setWeeklyImportVisible] = useState(false);
    const [weeklyImportTemplateHref, setWeeklyImportTemplateHref] = useState('');
    const [weeklyImportTemplateBuilding, setWeeklyImportTemplateBuilding] = useState(false);
    const [weeklyImportFileList, setWeeklyImportFileList] = useState([]);
    const [weeklyImportPreview, setWeeklyImportPreview] = useState(null);
    const [weeklyImportBusy, setWeeklyImportBusy] = useState(false);
    const [weeklyImportProgress, setWeeklyImportProgress] = useState('');
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
    const [importantCellKeys, setImportantCellKeys] = useState([]);
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
    const cellFormulaSyncQueueRef = useRef({ running: false, pendingRowsByKey: new Map() });
    const weeklySummaryPersistQueueRef = useRef({ rowsByKey: {}, cols: INITIAL_COLUMNS, timer: null });
    const weeklySummaryMapRef = useRef({});
    const pendingFormulaAsinCountriesRef = useRef(new Set());
    const backgroundFormulaTimerRef = useRef(null);
    const formulaExecutionTailRef = useRef(Promise.resolve());
    const summaryExecutionTailRef = useRef(Promise.resolve());
    const formulaRevisionRef = useRef(0);
    const editSessionSequenceRef = useRef(0);
    const submittedEditSessionRef = useRef(null);
    const cellSaveStateRef = useRef({
      sequence: 0,
      latestVersionByCell: new Map(),
      committedValueByCell: new Map(),
      tailsByCell: new Map(),
      pendingPromises: new Set(),
      overlays: new Map(),
      pendingFormulaCount: 0,
      formulaRowsByKey: new Map(),
      formulaTimer: null,
    });
    const backgroundMergeSummaryRef = useRef({ timer: null, running: false, pendingForce: false });
    const currentPageMergeSummaryRef = useRef({ timer: null, running: false, pendingKeys: new Set() });
    const selectingRef = useRef(false);
    const selectionDraftRef = useRef(null);
    const pendingCellInteractionRef = useRef(null);
    const selectionStoreRef = useRef(null);
    if (!selectionStoreRef.current) selectionStoreRef.current = createSelectionStore();
    const selectionStore = selectionStoreRef.current;
    const importantCellKeysRef = useRef([]);
    const importantCellsLoadedRef = useRef(false);
    const importantCellPendingOperationsRef = useRef([]);
    const importantCellSaveStateRef = useRef({ timer: null, running: false, dirty: false, retryCount: 0 });
    const importantCellFlushSaveRef = useRef(null);
    const importantCellAltPressRef = useRef(null);
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

    const enqueueSerialTask = useCallback((tailRef, task) => {
      const taskPromise = tailRef.current.catch(() => undefined).then(task);
      tailRef.current = taskPromise.catch(() => undefined);
      return taskPromise;
    }, []);
    const runCoreFormulaTask = useCallback(
      (task) => enqueueSerialTask(formulaExecutionTailRef, task),
      [enqueueSerialTask]
    );
    const runFullSummaryTask = useCallback(
      (task) => enqueueSerialTask(summaryExecutionTailRef, task),
      [enqueueSerialTask]
    );

    const [urlParams, setUrlParams] = useState(() => loadUrlParams());
    const filterAsin    = urlParams?.asin    || null;
    const filterCountry = urlParams?.country || null;
    const filterModel   = urlParams?.model   || null;
    const filterSaleOwner = urlParams?.saleOwner || urlParams?.sale_owner || null;
    const hasRequiredUrlParams = !!(filterModel && filterCountry && filterAsin && filterSaleOwner);

    useEffect(() => {
      let cancelled = false;
      let hasPendingChanges = false;
      loadImportantCellKeysFromUser()
        .then((keys) => {
          if (cancelled) return;
          const nextKeySet = new Set(keys);
          const pendingOperations = importantCellPendingOperationsRef.current;
          pendingOperations.forEach((operation) => {
            operation.keys.forEach((key) => {
              if (operation.mode === 'add') nextKeySet.add(key);
              else if (operation.mode === 'remove') nextKeySet.delete(key);
              else if (nextKeySet.has(key)) nextKeySet.delete(key);
              else nextKeySet.add(key);
            });
          });
          hasPendingChanges = pendingOperations.length > 0;
          importantCellPendingOperationsRef.current = [];
          const nextKeys = Array.from(nextKeySet);
          importantCellKeysRef.current = nextKeys;
          setImportantCellKeys(nextKeys);
        })
        .catch(() => {
          if (cancelled) return;
          hasPendingChanges = importantCellPendingOperationsRef.current.length > 0;
          importantCellPendingOperationsRef.current = [];
        })
        .finally(() => {
          if (cancelled) return;
          importantCellsLoadedRef.current = true;
          if (hasPendingChanges) {
            const saveState = importantCellSaveStateRef.current;
            saveState.dirty = true;
            if (saveState.timer) clearTimeout(saveState.timer);
            saveState.timer = setTimeout(() => {
              saveState.timer = null;
              importantCellFlushSaveRef.current?.();
            }, 250);
          }
        });
      return () => {
        cancelled = true;
        const saveState = importantCellSaveStateRef.current;
        if (saveState.timer) clearTimeout(saveState.timer);
      };
    }, []);

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
        clearTimeout(formulaProgressFinishTimerRef.current);
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
        clearTimeout(formulaProgressFinishTimerRef.current);
        formulaProgressFinishTimerRef.current = null;
      }
      setFormulaProgress({ active: true, label, percent: 100 });
      formulaProgressFinishTimerRef.current = setTimeout(() => {
        formulaProgressFinishTimerRef.current = null;
        setFormulaProgress({ active: false, label: '', percent: 0 });
      }, 900);
    }, []);

    const resetFormulaProgress = useCallback(() => {
      if (formulaProgressFinishTimerRef.current) {
        clearTimeout(formulaProgressFinishTimerRef.current);
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
        case '14d':        { const d = new Date(now); d.setDate(d.getDate() - 13); range = [fmt(d), todayStr]; break; }
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

    const buildInviteOrderNumberMap = useCallback(async (dailyRows) => {
      const sourceRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      const dailyKeysByAsinCountryDate = {};
      const asinCountries = new Set();
      const result = {};
      sourceRows.forEach((row) => {
        const rowKey = row?.country_asin_date;
        const asinCountry = String(row?.asin_country ?? '').trim();
        const dateKey = toDateKey(row?.date);
        if (!rowKey || !asinCountry || !dateKey) return;
        if (!dailyKeysByAsinCountryDate[asinCountry]) dailyKeysByAsinCountryDate[asinCountry] = {};
        if (!dailyKeysByAsinCountryDate[asinCountry][dateKey]) dailyKeysByAsinCountryDate[asinCountry][dateKey] = new Set();
        dailyKeysByAsinCountryDate[asinCountry][dateKey].add(rowKey);
        asinCountries.add(asinCountry);
      });
      if (!asinCountries.size) return result;

      const orderRows = await fetchAllByIn('order_list:list', 'asin_country_code', [...asinCountries], {
        extraAnd: [{ Invite_order: { $eq: '是' } }],
        params: {
          fields: ['order_number', 'asin_country_code', 'Invite_order', 'status', 'order_date'],
        },
        chunkSize: 80,
        pageSize: 500,
      });
      orderRows.forEach((row) => {
        const orderNumber = String(row?.order_number ?? '').trim();
        const asinCountry = String(row?.asin_country_code ?? '').trim();
        const inviteOrder = String(row?.Invite_order ?? '').trim();
        const status = String(row?.status ?? '').trim();
        const dateKey = toDateKey(row?.order_date);
        if (!orderNumber || !asinCountry || inviteOrder !== '是' || status === 'Canceled' || !dateKey) return;
        const dailyKeys = dailyKeysByAsinCountryDate[asinCountry]?.[dateKey];
        if (!dailyKeys) return;
        [...dailyKeys].forEach((key) => {
          result[key] = (result[key] || 0) + 1;
        });
      });
      return result;
    }, [fetchAllByIn]);

    const syncDailyRsgNumbersFromOrders = useCallback(async (dailyRows, options = {}) => {
      const sourceRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      if (!sourceRows.length) return { rows: [], patchMap: {}, updateCount: 0, failCount: 0 };
      const rsgNumberMap = await buildInviteOrderNumberMap(sourceRows);
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
      for (let i = 0; i < updateJobs.length; i += SAFE_WRITE_BATCH_SIZE) {
        const batch = updateJobs.slice(i, i + SAFE_WRITE_BATCH_SIZE);
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
    }, [buildInviteOrderNumberMap]);

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

      const persistResults = await Promise.allSettled(summaries.map((summary) => {
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
      const persistFailures = persistResults.filter((result) => result.status === 'rejected');
      if (persistFailures.length) {
        const firstReason = persistFailures[0]?.reason?.message || '未知错误';
        throw new Error(`${persistFailures.length}/${summaries.length} 条周汇总写入失败：${firstReason}`);
      }

      const refreshedRows = await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', keys, {
        chunkSize: 80,
        pageSize: 500,
      }).catch(() => []);
      const nextMap = {};
      refreshedRows.forEach((row) => {
        const normalized = normalizeWeeklySummaryRecord(row);
        if (normalized) nextMap[normalized.country_asin_week_range] = normalized;
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
      if (queue.timer) clearTimeout(queue.timer);
      queue.timer = setTimeout(async () => {
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
      if (queue?.timer) clearTimeout(queue.timer);
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

    const loadDailyRowsForSummaryKeys = useCallback(async (summaryKeys) => {
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
    }, [fetchAllList]);

    function scheduleCurrentPageMergeSummaryRefresh(summaryKeys, options = {}) {
      const keys = [...new Set((Array.isArray(summaryKeys) ? summaryKeys : []).filter(Boolean))];
      const state = currentPageMergeSummaryRef.current;
      keys.forEach((key) => state.pendingKeys.add(key));
      if (!keys.length && !state.pendingKeys.size) return;
      if (state.timer) clearTimeout(state.timer);
      state.timer = setTimeout(async () => {
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
          await runFullSummaryTask(() => refreshFullWeeklySummariesForKeys(keysToRefresh));
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
      const rsgSyncResult = await syncDailyRsgNumbersFromOrders(sourceDailyRows);
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
      const [weeklyRecords, targetRecords, targetDefaultRecords, profitRecords, orderLinkRecords, productConfigRecords, sqpKeywordRecords, sqpKeywordPositionRecords, competitorRecords, competitorDailyRecords] = await Promise.all([
        fetchAllByIn('weekly_performance:list', 'country_asin_week', dailyKeys, { chunkSize: 40, pageSize: 500 }),
        fetchAllByIn('target_management:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }),
        fetchAllByIn('target_default:list', 'country_asin', countryAsinKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
        fetchAllByIn('daily_profit:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }),
        fetchAllByIn('daily_order_link_tracking:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
        fetchAllByIn('product_config:list', 'asin_country', productConfigAsinCountries, { chunkSize: 40, pageSize: 500 }).catch(() => []),
        fetchAllByIn('sqp_keywords:list', 'country_asin', countryAsinKeys, { chunkSize: 40, pageSize: 500, params: { sort: ['id'] } }).catch(() => []),
        fetchAllByIn('sqp_keyword_daily_positions:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
        fetchAllByIn('order_link_competitor_asins:list', 'country_asin', countryAsinKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
        fetchAllByIn('order_link_competitor_asins_daily:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
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
    }, [fetchAllByIn, syncDailyRsgNumbersFromOrders]);

    const refreshFullWeeklySummariesForKeys = useCallback(async (summaryKeys, options = {}) => {
      const keys = [...new Set((Array.isArray(summaryKeys) ? summaryKeys : []).filter(Boolean))];
      if (!keys.length) return {};
      const rows = await loadDailyRowsForSummaryKeys(keys);
      if (!rows.length) return {};
      const { mergedRows, summaryCols } = await mergeDailyRowsForWeeklySummary(rows, {
        updateDynamicColumns: options.updateDynamicColumns === true,
      });
      return refreshWeeklySummariesFromRows(mergedRows, summaryCols, { summaryKeys: keys });
    }, [loadDailyRowsForSummaryKeys, mergeDailyRowsForWeeklySummary, refreshWeeklySummariesFromRows]);

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
      setTimeout(() => {
        if (!affectedKeys.size) return;
        runFullSummaryTask(() => refreshFullWeeklySummariesForKeys([...affectedKeys]))
          .catch((err) => ctx.message.warning(`周汇总刷新失败：${err?.message || ''}`));
      }, 0);
      return safeNextRows;
    }, [getSummaryKeyForRow, refreshFullWeeklySummariesForKeys, runFullSummaryTask]);

    const estimateTextWidth = (text, fontSize) => String(text ?? '').length * fontSize * 0.62;
    const calcKeywordColWidth = (label) => Math.max(200, Math.min(360, Math.ceil(estimateTextWidth(label, FONT_SIZE_SM) + 48)));

    const applyDynamicColPrefs = useCallback((col) => {
      const exactPref = dynamicColumnPrefs[col.key] || {};
      const groupPref = col._competitorGroupKey ? (dynamicColumnPrefs[col._competitorGroupKey] || {}) : {};
      const pref = { ...groupPref, ...exactPref };
      const prefHeaderColor = Object.prototype.hasOwnProperty.call(pref, 'headerColor') ? pref.headerColor : undefined;
      const isLegacyKeywordHeaderColor = col._dynamicKind === 'keyword'
        && LEGACY_KEYWORD_HEADER_COLORS.has(String(prefHeaderColor || '').toUpperCase());
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
          : (isLegacyKeywordHeaderColor ? col.headerColor : (prefHeaderColor !== undefined ? prefHeaderColor : col.headerColor)),
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
            headerColor: KEYWORD_DEFAULT_HEADER_COLOR,
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
      const requestedSummaryKeys = Array.isArray(options.summaryKeys) ? options.summaryKeys.filter(Boolean) : [];
      const skipSummaryRefresh = options.skipSummaryRefresh === true;
      const expectedFormulaRevision = Number.isFinite(Number(options.expectedFormulaRevision))
        ? Number(options.expectedFormulaRevision)
        : null;
      const isStaleFormulaRun = () => expectedFormulaRevision != null && expectedFormulaRevision !== formulaRevisionRef.current;
      const rows = Array.isArray(sourceRows) ? sourceRows : [];
      const keys = [...new Set(rows.map((r) => r.country_asin_date || r.id).filter(Boolean))];
      if (!keys.length) {
        if (!silent) ctx.message.warning('当前没有可计算的数据');
        return { total: 0, success: 0, failCount: 0, skipped: 0 };
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
        return { total: 0, success: 0, failCount: 0, skipped: keys.length };
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
        const rsgSyncResult = await syncDailyRsgNumbersFromOrders(dailyRowsForFormula, { writeBack: false });
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
        const allDailyKeys = [...new Set(dailyRowsForFormula.map((row) => row?.country_asin_date).filter(Boolean))];
        const weeklyKeyCandidates = [...new Set(keys)];
        const [pricingScenarioRows, existingProfitRows, existingOrderLinkRows, existingTargetRows, existingWeeklyRows, productConfigRows, targetDefaultRows] = await Promise.all([
          fetchAllByIn('pricing_scenarios:list', 'asin_country', asinCountries, {
            chunkSize: 80,
            pageSize: 500,
          }).catch(() => []),
          fetchAllByIn('daily_profit:list', 'country_asin_date', allDailyKeys.length ? allDailyKeys : keys, {
            chunkSize: 80,
            pageSize: 500,
          }),
          fetchAllByIn('daily_order_link_tracking:list', 'country_asin_date', keys, {
            chunkSize: 80,
            pageSize: 500,
          }),
          fetchAllByIn('target_management:list', 'country_asin_date', keys, {
            chunkSize: 80,
            pageSize: 500,
          }),
          fetchAllByIn('weekly_performance:list', 'country_asin_week', weeklyKeyCandidates, {
            chunkSize: 80,
            pageSize: 500,
          }).catch(() => []),
          fetchAllByIn('product_config:list', 'asin_country', asinCountries, {
            chunkSize: 80,
            pageSize: 500,
          }).catch(() => []),
          fetchAllByIn('target_default:list', 'country_asin', countryAsinKeys, {
            chunkSize: 80,
            pageSize: 500,
          }).catch(() => []),
        ]);
        const pricingScenarioMap = buildPricingScenarioLookupMap(pricingScenarioRows);
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
        const persistedPatchMap = {};
        const recordPersistedPatch = (job, collection) => {
          if (!job?.key) return;
          const persistedUpdates = stripWriteMeta(job.updates);
          if (collection === 'daily_order_link_tracking' && Object.prototype.hasOwnProperty.call(persistedUpdates, 'real_session_conversion_rate')) {
            persistedUpdates.order_link_real_session_conversion_rate = persistedUpdates.real_session_conversion_rate;
          }
          persistedPatchMap[job.key] = { ...(persistedPatchMap[job.key] || {}), ...persistedUpdates };
        };
        const recordFulfilledPatches = (batch, results, collection) => {
          results.forEach((result, index) => {
            if (result.status === 'fulfilled') recordPersistedPatch(batch[index], collection);
          });
        };

        reportProgress(`准备写回 ${updateJobs.length + weeklyUpdateJobs.length + targetFormulaUpdateJobs.length + orderLinkUpdateJobs.length + profitUpdateJobs.length} 条...`, 55);
        let successCount = 0;
        let failCount = 0;
        for (let i = 0; i < updateJobs.length && !isStaleFormulaRun(); i += SAFE_WRITE_BATCH_SIZE) {
          const batch = updateJobs.slice(i, i + SAFE_WRITE_BATCH_SIZE);
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
          recordFulfilledPatches(batch, results, 'daily_asins');
          const done = Math.min(i + batch.length, updateJobs.length);
          const percent = updateJobs.length ? 55 + (done / updateJobs.length) * 15 : 70;
          reportProgress(`正在写回日表 ${done}/${updateJobs.length}...`, percent);
        }

        for (let i = 0; i < weeklyUpdateJobs.length && !isStaleFormulaRun(); i += SAFE_WRITE_BATCH_SIZE) {
          const batch = weeklyUpdateJobs.slice(i, i + SAFE_WRITE_BATCH_SIZE);
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
          recordFulfilledPatches(batch, results, 'weekly_performance');
          const done = Math.min(i + batch.length, weeklyUpdateJobs.length);
          const percent = weeklyUpdateJobs.length ? 70 + (done / weeklyUpdateJobs.length) * 5 : 75;
          reportProgress(`正在写回周表现 ${done}/${weeklyUpdateJobs.length}...`, percent);
        }

        const persistFormulaRecord = async (collection, job) => {
          const updateRecord = () => ctx.request({
            url: `${collection}:update`,
            method: 'post',
            params: { filterByTk: job.key },
            data: stripWriteMeta(job.updates),
          });
          if (job.exists) return updateRecord();
          try {
            return await ctx.request({
              url: `${collection}:create`,
              method: 'post',
              data: withCreateTimestamps(job.updates),
            });
          } catch (createErr) {
            const latestRes = await ctx.request({
              url: `${collection}:list`,
              method: 'get',
              params: {
                pageSize: 1,
                fields: ['country_asin_date'],
                filter: JSON.stringify({ country_asin_date: { $eq: job.key } }),
              },
            }).catch(() => null);
            const latestRows = Array.isArray(latestRes?.data?.data) ? latestRes.data.data : [];
            if (!latestRows.length) throw createErr;
            return updateRecord();
          }
        };

        for (let i = 0; i < targetFormulaUpdateJobs.length && !isStaleFormulaRun(); i += SAFE_WRITE_BATCH_SIZE) {
          const batch = targetFormulaUpdateJobs.slice(i, i + SAFE_WRITE_BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map((job) => persistFormulaRecord('target_management', job))
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          recordFulfilledPatches(batch, results, 'target_management');
          const done = Math.min(i + batch.length, targetFormulaUpdateJobs.length);
          const percent = targetFormulaUpdateJobs.length ? 75 + (done / targetFormulaUpdateJobs.length) * 5 : 80;
          reportProgress(`正在写回目标公式 ${done}/${targetFormulaUpdateJobs.length}...`, percent);
        }

        for (let i = 0; i < orderLinkUpdateJobs.length && !isStaleFormulaRun(); i += SAFE_WRITE_BATCH_SIZE) {
          const batch = orderLinkUpdateJobs.slice(i, i + SAFE_WRITE_BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map((job) => persistFormulaRecord('daily_order_link_tracking', job))
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          recordFulfilledPatches(batch, results, 'daily_order_link_tracking');
          const done = Math.min(i + batch.length, orderLinkUpdateJobs.length);
          const percent = orderLinkUpdateJobs.length ? 80 + (done / orderLinkUpdateJobs.length) * 5 : 85;
          reportProgress(`正在写回订单链接 ${done}/${orderLinkUpdateJobs.length}...`, percent);
        }

        for (let i = 0; i < profitUpdateJobs.length && !isStaleFormulaRun(); i += SAFE_WRITE_BATCH_SIZE) {
          const batch = profitUpdateJobs.slice(i, i + SAFE_WRITE_BATCH_SIZE);
          const results = await Promise.allSettled(
            batch.map((job) => persistFormulaRecord('daily_profit', job))
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          recordFulfilledPatches(batch, results, 'daily_profit');
          const done = Math.min(i + batch.length, profitUpdateJobs.length);
          const percent = profitUpdateJobs.length ? 85 + (done / profitUpdateJobs.length) * 10 : 95;
          reportProgress(`正在写回利润 ${done}/${profitUpdateJobs.length}...`, percent);
        }

        const currentDataRows = Array.isArray(dataRef.current) ? dataRef.current : [];
        const summaryBaseRows = currentDataRows.length ? currentDataRows : rows;
        const patchedDataRows = summaryBaseRows.map((item) => {
          const itemKey = item.country_asin_date || item.id;
          return persistedPatchMap[itemKey] ? mergeFormulaPatch(item, persistedPatchMap[itemKey]) : item;
        });
        const formulaRowsByKey = {};
        rows.forEach((item) => {
          const itemKey = item?.country_asin_date || item?.id;
          if (itemKey) formulaRowsByKey[itemKey] = item;
        });
        const patchedSummaryKeys = [
          ...requestedSummaryKeys,
          ...Object.keys(persistedPatchMap)
            .map((itemKey) => getSummaryKeyForRow(formulaRowsByKey[itemKey]))
            .filter(Boolean),
        ];

        let refreshedSummaryMap = {};
        let summaryFailCount = 0;
        const uniqueSummaryKeys = [...new Set(patchedSummaryKeys)];
        let staleFormulaRun = isStaleFormulaRun();
        if (uniqueSummaryKeys.length && !skipSummaryRefresh && !staleFormulaRun) {
          try {
            refreshedSummaryMap = await runFullSummaryTask(() => refreshFullWeeklySummariesForKeys(uniqueSummaryKeys));
          } catch (summaryErr) {
            summaryFailCount = 1;
            if (!silent) ctx.message.warning(`周汇总同步失败：${summaryErr?.message || ''}`);
          }
          staleFormulaRun = isStaleFormulaRun();
        }
        const totalFailCount = failCount + summaryFailCount;
        if (!staleFormulaRun) {
          const nextSummaryMap = { ...(weeklySummaryMapRef.current || {}), ...(refreshedSummaryMap || {}) };
          const displayPatchedRows = attachWeeklySummaryDataToRows(patchedDataRows, nextSummaryMap);
          dataRef.current = displayPatchedRows;
          setData(displayPatchedRows);
        }

        if (!silent) {
          if (totalFailCount) ctx.message.warning(`公式计算完成：成功 ${successCount} 条，失败 ${totalFailCount} 条`);
          else if (!updateJobs.length && !weeklyUpdateJobs.length && !targetFormulaUpdateJobs.length && !profitUpdateJobs.length && !orderLinkUpdateJobs.length && !Object.keys(refreshedSummaryMap || {}).length) {
            ctx.message.success('所有公式已是最新');
          } else ctx.message.success(`公式计算完成：成功 ${successCount} 条`);
        }
        reportProgress(totalFailCount ? `公式计算存在 ${totalFailCount} 条失败` : `公式计算完成：成功 ${successCount} 条`, 100);
        return {
          total: updateJobs.length + weeklyUpdateJobs.length + targetFormulaUpdateJobs.length + orderLinkUpdateJobs.length + profitUpdateJobs.length,
          success: successCount,
          failCount: totalFailCount,
          skipped: keys.length - Math.max(updateJobs.length, weeklyUpdateJobs.length, targetFormulaUpdateJobs.length, orderLinkUpdateJobs.length, profitUpdateJobs.length),
          summaryKeys: uniqueSummaryKeys,
          stale: staleFormulaRun,
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
    }, [attachWeeklySummaryDataToRows, buildActivityAnnotationMatchMap, fetchAllByIn, getSummaryKeyForRow, refreshFullWeeklySummariesForKeys, runFullSummaryTask, syncDailyRsgNumbersFromOrders]);

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
      if (options.recalcFormulas !== false && cellSaveStateRef.current.pendingFormulaCount > 0) {
        return { __stale: true };
      }

      let formulaFailCount = 0;
      let formulaWasStale = false;
      if (options.recalcFormulas !== false) {
        reportProgress?.({ label: '计算日公式...', percent: 18 });
        const expectedFormulaRevision = formulaRevisionRef.current;
        const formulaResult = await runCoreFormulaTask(async () => {
          const latestRows = await loadAllDailyRowsForCurrentCountryAsin();
          const latestRowsToRefresh = latestRows.filter((row) => {
            const key = getSummaryKeyForRow(row);
            return key && keySet.has(key);
          });
          rows = latestRows;
          rowsToRefresh = latestRowsToRefresh;
          return recalcAllCoreFormulas(latestRowsToRefresh, {
            silent: true,
            preloadedDailyRows: latestRows,
            skipSummaryRefresh: true,
            expectedFormulaRevision,
            onProgress: (progress) => {
              if (!reportProgress) return;
              const label = typeof progress === 'string' ? progress : (progress?.label || '正在计算日公式...');
              const rawPercent = typeof progress === 'object' ? Number(progress?.percent) : null;
              const percent = Number.isFinite(rawPercent) ? 18 + rawPercent * 0.55 : 45;
              reportProgress({ label, percent });
            },
          });
        });
        formulaFailCount = Number(formulaResult?.failCount) || 0;
        formulaWasStale = formulaResult?.stale === true;
      }

      if (formulaWasStale) return { __stale: true };

      const summaryResult = await runFullSummaryTask(async () => {
        reportProgress?.({ label: '读取最新数据...', percent: 76 });
        rows = await loadAllDailyRowsForCurrentCountryAsin();
        rowsToRefresh = rows.filter((row) => {
          const key = getSummaryKeyForRow(row);
          return key && keySet.has(key);
        });
        reportProgress?.({ label: '汇总周数据...', percent: 86 });
        const { mergedRows, summaryCols } = await mergeDailyRowsForWeeklySummary(rowsToRefresh, {
          updateDynamicColumns: options.updateDynamicColumns === true,
        });
        reportProgress?.({ label: '写入周汇总...', percent: 94 });
        return refreshWeeklySummariesFromRows(mergedRows, summaryCols, { summaryKeys: keysToRefresh });
      });
      if (formulaFailCount) throw new Error(`公式写回失败 ${formulaFailCount} 条`);
      return summaryResult;
    }

    function scheduleCurrentCountryAsinMergeSummarySync(options = {}) {
      if (!filterCountry || !filterAsin) return;
      const state = backgroundMergeSummaryRef.current;
      state.pendingForce = state.pendingForce || options.force === true;
      if (state.timer) clearTimeout(state.timer);
      if (options.showQueuedProgress) {
        showFormulaProgress({ label: '全量排队...', percent: 35 });
      }
      state.timer = setTimeout(async () => {
        state.timer = null;
        if (state.running) return;
        const currentPageState = currentPageMergeSummaryRef.current;
        if (currentPageState.running || currentPageState.timer) {
          scheduleCurrentCountryAsinMergeSummarySync({
            force: state.pendingForce,
            recalcFormulas: options.recalcFormulas,
            delay: 300,
          });
          return;
        }
        state.running = true;
        const force = state.pendingForce;
        state.pendingForce = false;
        try {
          showFormulaProgress({ label: '同步全量汇总...', percent: 5 });
          const syncResult = await ensureCurrentCountryAsinMergeSummaries({
            force,
            recalcFormulas: options.recalcFormulas !== false,
            onProgress: showFormulaProgress,
          });
          if (syncResult?.__stale) return;
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

    const applyPendingCellOverlays = useCallback((rows, loadStartedAt) => {
      const state = cellSaveStateRef.current;
      let nextRows = Array.isArray(rows) ? rows : [];
      state.overlays.forEach((overlay, cellKey) => {
        if (overlay.status === 'saved' && overlay.savedAt > 0 && overlay.savedAt <= loadStartedAt) {
          state.overlays.delete(cellKey);
          state.committedValueByCell.delete(cellKey);
          state.latestVersionByCell.delete(cellKey);
          return;
        }
        if (typeof overlay.applyToRow !== 'function') return;
        nextRows = nextRows.map((row) => (
          (typeof overlay.matchesRow === 'function'
            ? overlay.matchesRow(row)
            : (row.country_asin_date || row.id) === overlay.rowId)
            ? overlay.applyToRow(row)
            : row
        ));
      });
      return nextRows;
    }, []);

    const loadData = useCallback(async (options = {}) => {
      const page = options.page ?? curPageRef.current;
      const size = options.size ?? pageSizeRef.current;
      const skipFormula = options.skipFormula === true;
      const loadStartedAt = Date.now();
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
        const rsgSyncResult = await syncDailyRsgNumbersFromOrders(relatedDailyRecords);
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
        const [weeklyRecords, targetRecords, targetDefaultRecords, profitRecords, orderLinkRecords, productConfigRecords, sqpKeywordRecords, sqpKeywordPositionRecords, competitorRecords, competitorDailyRecords] = await Promise.all([
          fetchAllByIn('weekly_performance:list', 'country_asin_week', weeklyKeyCandidates, { chunkSize: 40, pageSize: 500 }),
          fetchAllByIn('target_management:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }),
          fetchAllByIn('target_default:list', 'country_asin', countryAsinKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
          fetchAllByIn('daily_profit:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }),
          fetchAllByIn('daily_order_link_tracking:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
          fetchAllByIn('product_config:list', 'asin_country', productConfigAsinCountries, { chunkSize: 40, pageSize: 500 }).catch(() => []),
          fetchAllByIn('sqp_keywords:list', 'country_asin', countryAsinKeys, { chunkSize: 40, pageSize: 500, params: { sort: ['id'] } }).catch(() => []),
          fetchAllByIn('sqp_keyword_daily_positions:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
          fetchAllByIn('order_link_competitor_asins:list', 'country_asin', countryAsinKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
          fetchAllByIn('order_link_competitor_asins_daily:list', 'country_asin_date', dailyKeys, { chunkSize: 40, pageSize: 500 }).catch(() => []),
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
          ? await runFullSummaryTask(() => refreshWeeklySummariesFromRows(summaryMergedData, summaryCols, { summaryKeys: candidateSummaryKeys })).catch(() => ({}))
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

        const loadedDisplayMergedData = attachWeeklySummaryDataToRows(mergedData, existingWeeklySummaryMap);
        const displayMergedData = applyPendingCellOverlays(loadedDisplayMergedData, loadStartedAt);

        dataRef.current = displayMergedData;
        setData(displayMergedData);
        setTotal(totalCount || displayMergedData.length);
        const shouldRunBackgroundSummary = !options.skipBackgroundSummary && filterCountry && filterAsin;
        if (!shouldRunBackgroundSummary && !options.skipCurrentPageSummaryRefresh && candidateSummaryKeys.length) {
          scheduleCurrentPageMergeSummaryRefresh(candidateSummaryKeys, {
            delay: !skipFormula ? 80 : 180,
            keepProgressForBackground: shouldRunBackgroundSummary,
          });
        }
        if (shouldRunBackgroundSummary) {
          scheduleCurrentCountryAsinMergeSummarySync({
            force: true,
            showQueuedProgress: true,
            delay: candidateSummaryKeys.length ? 300 : (!skipFormula ? 200 : 900),
          });
        }
        return displayMergedData;
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        const currentRows = Array.isArray(dataRef.current) ? dataRef.current : [];
        if (currentRows.length) return currentRows;
        dataRef.current = [];
        setData([]);
        setTotal(0);
        return [];
      } finally {
        setLoading(false);
      }
    }, [filterAsin, filterCountry, hasRequiredUrlParams, dateFilterType, getDateRange, getDailySort, fetchAllList, fetchAllByIn, buildDynamicKeywordCols, buildDynamicCompetitorCols, normalizeWeeklySummaryRecord, getSummaryKeyForRow, attachWeeklySummaryDataToRows, applyPendingCellOverlays, refreshWeeklySummariesFromRows, recalcAllCoreFormulas, runFullSummaryTask, showFormulaProgress, finishFormulaProgress, resetFormulaProgress, syncDailyRsgNumbersFromOrders]);

    const openWeeklyImport = useCallback(() => {
      setWeeklyImportVisible(true);
      setWeeklyImportTemplateHref('');
      setWeeklyImportFileList([]);
      setWeeklyImportPreview(null);
      setWeeklyImportProgress('');
    }, []);

    const closeWeeklyImport = useCallback(() => {
      if (weeklyImportBusy || weeklyImportTemplateBuilding) return;
      setWeeklyImportVisible(false);
      setWeeklyImportTemplateHref('');
      setWeeklyImportFileList([]);
      setWeeklyImportPreview(null);
      setWeeklyImportProgress('');
    }, [weeklyImportBusy, weeklyImportTemplateBuilding]);

    useEffect(() => {
      if (!weeklyImportVisible) return undefined;
      if (!filterCountry || !filterAsin) {
        setWeeklyImportTemplateHref('');
        setWeeklyImportTemplateBuilding(false);
        setWeeklyImportProgress('');
        return undefined;
      }
      let cancelled = false;
      setWeeklyImportTemplateBuilding(false);
      setWeeklyImportTemplateHref('');
      setWeeklyImportProgress('');
      const timer = setTimeout(() => {
        setWeeklyImportTemplateBuilding(true);
        (async () => {
          try {
            const buffer = await buildFixedDailyImportWorkbook({
              country: filterCountry,
              asin: filterAsin,
            });
            if (cancelled) return;
            setWeeklyImportTemplateHref(excelBufferToDataUrl(buffer));
            setWeeklyImportProgress('');
          } catch (error) {
            if (cancelled) return;
            setWeeklyImportProgress('');
            ctx.message.error({ content: `Excel 模板生成失败：${error?.message || 'Excel 模块加载失败'}`, duration: 8 });
          } finally {
            if (!cancelled) setWeeklyImportTemplateBuilding(false);
          }
        })();
      }, 0);
      return () => {
        cancelled = true;
        clearTimeout(timer);
      };
    }, [weeklyImportVisible, filterCountry, filterAsin]);

    const prepareDailyImport = useCallback(async (file) => {
      const { sheet, images } = await readWeeklyImportWorkbook(file);
      const country = String(getWeeklyImportCellValue(sheet.getCell('B1')) ?? '').trim().toUpperCase();
      const asin = String(getWeeklyImportCellValue(sheet.getCell('B2')) ?? '').trim().toUpperCase();
      let startDate = '';
      let endDate = '';
      const metadataErrors = [];
      if (!WEEKLY_IMPORT_ALLOWED_COUNTRIES.has(country)) metadataErrors.push(`国家“${country || '空'}”不在支持范围内`);
      if (!/^[A-Z0-9]{10}$/.test(asin)) metadataErrors.push('ASIN 必须是 10 位字母或数字');
      try { startDate = normalizeWeeklyImportDate(getWeeklyImportCellValue(sheet.getCell('B3'))); }
      catch (error) { metadataErrors.push(`导入数据起始日期：${error?.message || '日期错误'}`); }
      try { endDate = normalizeWeeklyImportDate(getWeeklyImportCellValue(sheet.getCell('B4'))); }
      catch (error) { metadataErrors.push(`导入数据终止日期：${error?.message || '日期错误'}`); }
      if (metadataErrors.length) throw new Error(metadataErrors.join('\n'));

      const parsed = parseDailyImportSheet({ sheet, images, country, asin, startDate, endDate });
      const rows = parsed.rows;
      const datedKeys = rows.map((row) => row.datedKey);
      const countryAsin = `${country}_${asin}`;
      const state = { static: {}, keywordByName: {}, keywordDaily: {}, competitorByAsin: {}, competitorDaily: {}, master: null };
      const summary = {};
      for (const [resource, keyField] of Object.entries(DAILY_IMPORT_RESOURCE_KEY_FIELDS)) {
        const relevantRows = rows.filter((row) => Object.keys(row.resources[resource] || {}).length || Object.keys(row.resourceImages[resource] || {}).length);
        const keys = relevantRows.map((row) => row.datedKey);
        const records = await fetchAllByIn(`${resource}:list`, keyField, keys, { chunkSize: 80, pageSize: 500 });
        const map = {};
        records.forEach((record) => {
          const key = record?.[keyField];
          if (!key) return;
          if (map[key]) throw new Error(`线上 ${resource} 主键重复：${key}`);
          map[key] = record;
        });
        state.static[resource] = map;
        summary[resource] = {
          create: relevantRows.filter((row) => !map[row.datedKey]).length,
          update: relevantRows.filter((row) => map[row.datedKey]).length,
        };
      }
      const masterRows = await fetchAllByIn('asin:list', 'unique', [`${asin}_${country}`], { chunkSize: 1, pageSize: 10 });
      if (masterRows.length > 1) throw new Error(`ASIN 主数据重复：${asin}_${country}`);
      state.master = masterRows[0] || null;

      const keywordRecords = await fetchAllList('sqp_keywords:list', {
        filter: JSON.stringify({ country_asin: { $eq: countryAsin } }),
      }, 500);
      keywordRecords.forEach((record) => {
        const normalized = String(record?.keyword_name || '').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
        if (!normalized) return;
        if (state.keywordByName[normalized]) throw new Error(`线上关键词重复：${record.keyword_name}`);
        state.keywordByName[normalized] = record;
      });
      const keywordDailyRecords = await fetchAllByIn('sqp_keyword_daily_positions:list', 'country_asin_date', datedKeys, { chunkSize: 80, pageSize: 500 });
      keywordDailyRecords.forEach((record) => {
        const key = `${record?.sqp_keyword_id}:${record?.country_asin_date}`;
        if (!record?.sqp_keyword_id || !record?.country_asin_date) return;
        if (state.keywordDaily[key]) throw new Error(`线上关键词每日记录重复：${key}`);
        state.keywordDaily[key] = record;
      });
      const usedKeywordNames = new Map();
      rows.forEach((row) => row.keywords.forEach((keyword) => {
        const normalized = keyword.name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
        if (!usedKeywordNames.has(normalized)) usedKeywordNames.set(normalized, keyword.name);
      }));
      let keywordDailyCreate = 0;
      let keywordDailyUpdate = 0;
      rows.forEach((row) => row.keywords.forEach((keyword) => {
        const normalized = keyword.name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
        const keywordRecord = state.keywordByName[normalized];
        if (keywordRecord?.id && state.keywordDaily[`${keywordRecord.id}:${row.datedKey}`]) keywordDailyUpdate += 1;
        else keywordDailyCreate += 1;
      }));
      summary.sqp_keywords = {
        create: [...usedKeywordNames.keys()].filter((name) => !state.keywordByName[name]).length,
        reuse: [...usedKeywordNames.keys()].filter((name) => state.keywordByName[name]).length,
      };
      summary.sqp_keyword_daily_positions = { create: keywordDailyCreate, update: keywordDailyUpdate };

      const competitorRecords = await fetchAllList('order_link_competitor_asins:list', {
        filter: JSON.stringify({ country_asin: { $eq: countryAsin } }),
      }, 500);
      competitorRecords.forEach((record) => {
        const competitorAsin = String(record?.competitor_asin || '').trim().toUpperCase();
        if (!competitorAsin) return;
        state.competitorByAsin[competitorAsin] = [...(state.competitorByAsin[competitorAsin] || []), record];
      });
      Object.entries(state.competitorByAsin).forEach(([competitorAsin, records]) => {
        if (records.length > 1) throw new Error(`线上竞对主记录重复：${competitorAsin} 共 ${records.length} 条`);
      });
      const competitorDailyRecords = await fetchAllByIn('order_link_competitor_asins_daily:list', 'country_asin_date', datedKeys, { chunkSize: 80, pageSize: 500 });
      competitorDailyRecords.forEach((record) => {
        const key = `${record?.competitor_id}:${record?.country_asin_date}`;
        if (!record?.competitor_id || !record?.country_asin_date) return;
        if (state.competitorDaily[key]) throw new Error(`线上竞对每日记录重复：${key}`);
        state.competitorDaily[key] = record;
      });
      const usedCompetitorAsins = new Set();
      rows.forEach((row) => Object.values(row.competitors).forEach((item) => usedCompetitorAsins.add(item.asin)));
      let competitorDailyCreate = 0;
      let competitorDailyUpdate = 0;
      rows.forEach((row) => Object.values(row.competitors).forEach((item) => {
        const record = state.competitorByAsin[item.asin]?.[0];
        if (record?.id && state.competitorDaily[`${record.id}:${row.datedKey}`]) competitorDailyUpdate += 1;
        else competitorDailyCreate += 1;
      }));
      summary.order_link_competitor_asins = {
        create: [...usedCompetitorAsins].filter((value) => !state.competitorByAsin[value]?.length).length,
        reuse: [...usedCompetitorAsins].filter((value) => state.competitorByAsin[value]?.length).length,
      };
      summary.order_link_competitor_asins_daily = { create: competitorDailyCreate, update: competitorDailyUpdate };
      summary.attachments = {
        upload: rows.reduce((total, row) => total
          + Object.values(row.resourceImages).reduce((resourceTotal, fields) => resourceTotal
            + Object.values(fields).reduce((fieldTotal, fieldImages) => fieldTotal + fieldImages.length, 0), 0)
          + Object.values(row.competitors).reduce((competitorTotal, item) => competitorTotal + (item.images?.length || 0), 0), 0),
      };
      const weeklyProtectedCount = rows.reduce((total, row) => total + Object.keys(row.resources.weekly_performance || {}).length, 0);
      return { ...parsed, state, summary, country, asin, startDate, endDate, weeklyProtectedCount, fileName: file.name };
    }, [fetchAllByIn, fetchAllList]);

    const preflightDailyImport = useCallback(async () => {
      const file = weeklyImportFileList[0];
      if (!file) {
        ctx.message.warning('请先选择 Excel 文件');
        return;
      }
      setWeeklyImportBusy(true);
      setWeeklyImportPreview(null);
      setWeeklyImportProgress('正在读取 Excel 并检查线上记录...');
      try {
        const preview = await prepareDailyImport(file);
        setWeeklyImportPreview(preview);
        setWeeklyImportProgress('预检通过');
        ctx.message.success(`Excel 预检通过：有效数据 ${preview.rows.length} 行`);
      } catch (error) {
        setWeeklyImportProgress('预检失败');
        ctx.message.error({ content: `导入预检失败：${error?.message || '未知错误'}`, duration: 10 });
      } finally {
        setWeeklyImportBusy(false);
      }
    }, [prepareDailyImport, weeklyImportFileList]);

    const uploadDailyImportImage = useCallback(async (image) => {
      const formData = new window.FormData();
      const fileBlob = new Blob([image.bytes], { type: image.type });
      formData.append('file', fileBlob, image.name);
      const response = await ctx.request({
        url: 'attachments:upload',
        method: 'post',
        data: formData,
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const url = response?.data?.data?.url || response?.data?.url;
      if (!url) throw new Error(`图片上传后未返回地址：${image.name}`);
      return url;
    }, []);

    const executeDailyImport = useCallback(async () => {
      const file = weeklyImportFileList[0];
      if (!file || !weeklyImportPreview) {
        ctx.message.warning('请先完成线上预检');
        return;
      }
      setWeeklyImportBusy(true);
      let completed = 0;
      try {
        setWeeklyImportProgress('正在重新检查线上记录...');
        const prepared = await prepareDailyImport(file);
        const { rows, state } = prepared;
        const uploadImagesIntoFields = async (fields, imageFields) => {
          const result = { ...(fields || {}) };
          for (const [field, fieldImages] of Object.entries(imageFields || {})) {
            const parts = [];
            if (!isWeeklyImportBlank(result[field])) parts.push(String(result[field]).trim());
            for (const image of fieldImages) parts.push(`![截图](${await uploadDailyImportImage(image)})`);
            result[field] = parts.join('\n\n');
          }
          return result;
        };
        for (const row of rows) {
          for (const [resource, keyField] of Object.entries(DAILY_IMPORT_RESOURCE_KEY_FIELDS)) {
            let fields = await uploadImagesIntoFields(row.resources[resource], row.resourceImages[resource]);
            if (!Object.keys(fields).length) continue;
            const existing = state.static[resource]?.[row.datedKey] || null;
            if (resource === 'weekly_performance') {
              const effectiveFields = { ...(existing || {}), ...fields };
              const derivedFields = calculateWeeklyImportDerivedFields(effectiveFields);
              Object.keys(row.resources.weekly_performance || {}).forEach((field) => delete derivedFields[field]);
              const manualOverrideFields = [...new Set([
                ...parseManualOverrideFields(existing?.manual_override_fields),
                ...Object.keys(row.resources.weekly_performance || {}),
              ])].sort();
              fields = { ...fields, ...derivedFields, manual_override_fields: manualOverrideFields };
            }
            if (existing) {
              await ctx.request({ url: `${resource}:update`, method: 'post', params: { filterByTk: row.datedKey }, data: fields });
              Object.assign(existing, fields);
            } else {
              const payload = { ...fields, [keyField]: row.datedKey };
              if (resource === 'daily_asins') {
                Object.assign(payload, { asin_country: row.asinCountry, country: row.country, asin: row.asin, date: row.date });
                ['model', 'sale_owner', 'model_sales'].forEach((field) => {
                  if (!isWeeklyImportBlank(state.master?.[field])) payload[field] = state.master[field];
                });
                if (payload.selling_accounts === undefined && !isWeeklyImportBlank(state.master?.selling_accounts)) {
                  payload.selling_accounts = state.master.selling_accounts;
                }
              } else if (resource === 'weekly_performance') {
                Object.assign(payload, { country: row.country, asin: row.asin, date: row.date });
              }
              const response = await ctx.request({ url: `${resource}:create`, method: 'post', data: payload });
              state.static[resource][row.datedKey] = response?.data?.data || payload;
            }
            completed += 1;
            setWeeklyImportProgress(`正在写入，已完成 ${completed} 个数据操作...`);
          }
        }

        const usedKeywords = {};
        for (const row of rows) {
          for (const keyword of row.keywords) {
            const normalized = keyword.name.replace(/\s+/g, ' ').trim().toLocaleLowerCase();
            let keywordRecord = state.keywordByName[normalized];
            if (!keywordRecord) {
              const response = await ctx.request({
                url: 'sqp_keywords:create', method: 'post',
                data: withCreateTimestamps({ country_asin: row.countryAsin, country: row.country, asin: row.asin, keyword_name: keyword.name }),
              });
              keywordRecord = response?.data?.data;
              if (!keywordRecord?.id) throw new Error(`创建关键词后未返回 ID：${keyword.name}`);
              state.keywordByName[normalized] = keywordRecord;
            }
            usedKeywords[normalized] = true;
            const dailyKey = `${keywordRecord.id}:${row.datedKey}`;
            const existing = state.keywordDaily[dailyKey];
            if (existing?.id) {
              await ctx.request({ url: 'sqp_keyword_daily_positions:update', method: 'post', params: { filterByTk: existing.id }, data: { actual_rank: keyword.rank, updated_at: new Date().toISOString() } });
              existing.actual_rank = keyword.rank;
            } else {
              const response = await ctx.request({
                url: 'sqp_keyword_daily_positions:create', method: 'post',
                data: withCreateTimestamps({ country_asin_date: row.datedKey, country_asin: row.countryAsin, country: row.country, asin: row.asin, sqp_keyword_id: keywordRecord.id, date: row.date, actual_rank: keyword.rank }),
              });
              state.keywordDaily[dailyKey] = response?.data?.data || { sqp_keyword_id: keywordRecord.id, country_asin_date: row.datedKey };
            }
            completed += 1;
          }
        }

        const occupiedRoleNumbers = new Set();
        Object.values(state.competitorByAsin).flat().forEach((record) => {
          const match = String(record?.role || '').match(/竞对\s*(\d+)/);
          if (match) occupiedRoleNumbers.add(Number(match[1]));
        });
        const nextRole = () => {
          let index = 1;
          while (occupiedRoleNumbers.has(index)) index += 1;
          occupiedRoleNumbers.add(index);
          return `竞对${index}`;
        };
        for (const row of rows) {
          for (const [templateRole, item] of Object.entries(row.competitors)) {
            let competitor = state.competitorByAsin[item.asin]?.[0];
            if (!competitor) {
              const response = await ctx.request({
                url: 'order_link_competitor_asins:create', method: 'post',
                data: { country_asin: row.countryAsin, competitor_asin: item.asin, role: nextRole() || templateRole },
              });
              competitor = response?.data?.data;
              if (!competitor?.id) throw new Error(`创建竞对后未返回 ID：${item.asin}`);
              state.competitorByAsin[item.asin] = [competitor];
            }
            const dailyFields = {};
            if (item.rank !== undefined) dailyFields.rank = item.rank;
            const noteParts = [];
            if (item.notes !== undefined) noteParts.push(item.notes);
            for (const image of item.images || []) noteParts.push(`![截图](${await uploadDailyImportImage(image)})`);
            if (noteParts.length) dailyFields.notes = noteParts.join('\n\n');
            if (!Object.keys(dailyFields).length) continue;
            const dailyKey = `${competitor.id}:${row.datedKey}`;
            const existing = state.competitorDaily[dailyKey];
            if (existing?.id) {
              await ctx.request({ url: 'order_link_competitor_asins_daily:update', method: 'post', params: { filterByTk: existing.id }, data: dailyFields });
              Object.assign(existing, dailyFields);
            } else {
              const response = await ctx.request({
                url: 'order_link_competitor_asins_daily:create', method: 'post',
                data: { country_asin_date: row.datedKey, competitor_id: competitor.id, date: row.date, ...dailyFields },
              });
              state.competitorDaily[dailyKey] = response?.data?.data || { competitor_id: competitor.id, country_asin_date: row.datedKey };
            }
            completed += 1;
          }
        }
        setWeeklyImportProgress('导入完成，正在刷新页面...');
        await loadData({ page: curPageRef.current, size: pageSizeRef.current });
        ctx.message.success(`导入完成：写入 ${completed} 个数据操作，保护产品表现字段值 ${prepared.weeklyProtectedCount} 个`);
        setWeeklyImportVisible(false);
        setWeeklyImportFileList([]);
        setWeeklyImportPreview(null);
        setWeeklyImportProgress('');
      } catch (error) {
        setWeeklyImportProgress(`导入停止：此前完成 ${completed} 个数据操作`);
        ctx.message.error({ content: `导入失败：${error?.message || '未知错误'}；此前完成 ${completed} 个数据操作`, duration: 12 });
      } finally {
        setWeeklyImportBusy(false);
      }
    }, [loadData, prepareDailyImport, uploadDailyImportImage, weeklyImportFileList, weeklyImportPreview]);

    useEffect(() => {
      const backgroundState = backgroundMergeSummaryRef.current;
      if (backgroundState?.timer) clearTimeout(backgroundState.timer);
      backgroundState.timer = null;
      backgroundState.pendingForce = false;
      const currentPageState = currentPageMergeSummaryRef.current;
      if (currentPageState?.timer) clearTimeout(currentPageState.timer);
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
      const timer = setInterval(() => {
        const visible = isRootVisible();
        const wasVisible = autoRefreshRef.current.wasVisible;
        autoRefreshRef.current.wasVisible = visible;
        if (visible && wasVisible === false) autoRefreshCurrentPage();
      }, 1000);
      return () => clearInterval(timer);
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
      if (backgroundFormulaTimerRef.current) clearTimeout(backgroundFormulaTimerRef.current);
      backgroundFormulaTimerRef.current = setTimeout(async () => {
        const pending = [...pendingFormulaAsinCountriesRef.current].filter(Boolean);
        const scheduledRevision = formulaRevisionRef.current;
        pendingFormulaAsinCountriesRef.current.clear();
        backgroundFormulaTimerRef.current = null;
        if (!pending.length) return;
        if (cellSaveStateRef.current.pendingFormulaCount > 0) return;
        try {
          const result = await runCoreFormulaTask(async () => {
            const rows = await fetchAllByIn('daily_asins:list', 'asin_country', pending, {
              params: { sort: 'date' },
              chunkSize: 50,
              pageSize: 500,
            });
            if (!rows.length) return { total: 0, success: 0, failCount: 0, skipped: 0 };
            return recalcAllCoreFormulas(rows, {
              silent: true,
              preloadedDailyRows: rows,
              expectedFormulaRevision: scheduledRevision,
            });
          });
          if (result?.failCount) throw new Error(`公式写回失败 ${result.failCount} 条`);
          if (scheduledRevision === formulaRevisionRef.current) {
            finishFormulaProgress('公式全量校准完成');
          }
        } catch (err) {
          resetFormulaProgress();
          ctx.message.warning(`后台公式校准失败：${err?.message || ''}`);
        }
      }, 1800);
    }, [fetchAllByIn, finishFormulaProgress, recalcAllCoreFormulas, resetFormulaProgress, runCoreFormulaTask]);

    useEffect(() => () => {
      if (formulaProgressFinishTimerRef.current) clearTimeout(formulaProgressFinishTimerRef.current);
      if (backgroundFormulaTimerRef.current) clearTimeout(backgroundFormulaTimerRef.current);
      if (backgroundMergeSummaryRef.current?.timer) clearTimeout(backgroundMergeSummaryRef.current.timer);
      if (currentPageMergeSummaryRef.current?.timer) clearTimeout(currentPageMergeSummaryRef.current.timer);
      if (cellSaveStateRef.current?.formulaTimer) clearTimeout(cellSaveStateRef.current.formulaTimer);
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
      const requestedFormulaRevision = Number.isFinite(Number(options.expectedFormulaRevision))
        ? Number(options.expectedFormulaRevision)
        : formulaRevisionRef.current + 1;
      if (requestedFormulaRevision > formulaRevisionRef.current) formulaRevisionRef.current = requestedFormulaRevision;
      const changedSummaryKeys = [...new Set(targetRows.map((row) => getSummaryKeyForRow(row)).filter(Boolean))];
      try {
        const result = await runCoreFormulaTask(async () => {
          const contextRows = await fetchAllByIn('daily_asins:list', 'asin_country', asinCountries, {
            params: { sort: 'date' },
            chunkSize: 50,
            pageSize: 500,
          });
          const fullContextRows = contextRows.length ? contextRows : targetRows;
          const earliestDateByAsinCountry = {};
          targetRows.forEach((row) => {
            const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
            if (!asinCountry) return;
            if (row?.__formulaFromStart) {
              earliestDateByAsinCountry[asinCountry] = '';
              return;
            }
            const dateKey = toDateKey(row?.date);
            if (!dateKey) {
              earliestDateByAsinCountry[asinCountry] = '';
              return;
            }
            const currentEarliest = earliestDateByAsinCountry[asinCountry];
            if (currentEarliest === undefined || (currentEarliest && dateKey < currentEarliest)) {
              earliestDateByAsinCountry[asinCountry] = dateKey;
            }
          });
          const rowsToRecalc = fullContextRows.filter((row) => {
            const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
            if (!Object.prototype.hasOwnProperty.call(earliestDateByAsinCountry, asinCountry)) return false;
            const earliestDate = earliestDateByAsinCountry[asinCountry];
            return !earliestDate || toDateKey(row?.date) >= earliestDate;
          });
          return recalcAllCoreFormulas(rowsToRecalc.length ? rowsToRecalc : targetRows, {
            silent: true,
            preloadedDailyRows: fullContextRows,
            summaryKeys: changedSummaryKeys,
            onProgress: options.onProgress,
            expectedFormulaRevision: requestedFormulaRevision,
          });
        });
        if (result?.failCount) throw new Error(`公式写回失败 ${result.failCount} 条`);
        return result;
      } finally {
        if (options.scheduleBackground !== false) scheduleBackgroundFormulaSync(targetRows);
      }
    }, [fetchAllByIn, getSummaryKeyForRow, recalcAllCoreFormulas, runCoreFormulaTask, scheduleBackgroundFormulaSync]);

    const syncFormulasForChangedRows = useCallback(async (changedRows = [], options = {}) => {
      const targetRows = Array.isArray(changedRows) ? changedRows.filter(Boolean) : [];
      if (!targetRows.length) return;
      const onProgress = options.onProgress;
      return syncCoreFormulasForRows(targetRows, {
        onProgress,
        scheduleBackground: true,
        expectedFormulaRevision: options.expectedFormulaRevision,
      });
    }, [syncCoreFormulasForRows]);

    const enqueueCellFormulaSync = useCallback((changedRows = []) => {
      const queue = cellFormulaSyncQueueRef.current;
      (Array.isArray(changedRows) ? changedRows : []).filter(Boolean).forEach((row) => {
        const key = row.country_asin_date || row.id;
        if (key) queue.pendingRowsByKey.set(key, row);
      });
      if (queue.running || !queue.pendingRowsByKey.size) return;

      queue.running = true;
      (async () => {
        let failed = false;
        let completedRevision = null;
        try {
          while (queue.pendingRowsByKey.size) {
            const pendingRows = [...queue.pendingRowsByKey.values()];
            queue.pendingRowsByKey.clear();
            const currentRows = Array.isArray(dataRef.current) ? dataRef.current : [];
            const latestRows = pendingRows.map((queuedRow) => {
              const key = queuedRow.country_asin_date || queuedRow.id;
              return currentRows.find((row) => (row.country_asin_date || row.id) === key) || queuedRow;
            });
            const syncRevision = formulaRevisionRef.current;

            showFormulaProgress({ label: '保存成功，正在同步公式...', percent: 8 });
            try {
              const syncResult = await syncFormulasForChangedRows(latestRows, {
                onProgress: showFormulaProgress,
                expectedFormulaRevision: syncRevision,
              });
              if (!syncResult?.stale) completedRevision = syncRevision;
            } catch (formulaErr) {
              failed = true;
              ctx.message.warning(`保存成功，但公式同步失败：${formulaErr?.message || '未知错误'}`);
            }
          }

          const cellSaveState = cellSaveStateRef.current;
          const hasNewerFormulaWork = completedRevision !== formulaRevisionRef.current
            || cellSaveState.pendingFormulaCount > 0
            || cellSaveState.formulaRowsByKey.size > 0;
          if (failed) resetFormulaProgress();
          else if (!hasNewerFormulaWork) finishFormulaProgress('快速公式已更新，等待全量校准');
        } finally {
          queue.running = false;
        }
      })();
    }, [finishFormulaProgress, resetFormulaProgress, showFormulaProgress, syncFormulasForChangedRows]);

    const scheduleQueuedCellFormulaSync = useCallback(() => {
      const state = cellSaveStateRef.current;
      if (state.formulaTimer) clearTimeout(state.formulaTimer);
      const armTimer = () => {
        state.formulaTimer = setTimeout(() => {
          state.formulaTimer = null;
          if (state.pendingFormulaCount > 0) {
            armTimer();
            return;
          }
          const currentRows = Array.isArray(dataRef.current) ? dataRef.current : [];
          const rows = [...state.formulaRowsByKey.entries()].map(([rowKey, fallbackRow]) => {
            const currentRow = currentRows.find((row) => (row.country_asin_date || row.id) === rowKey) || fallbackRow;
            return currentRow && fallbackRow?.__formulaFromStart
              ? { ...currentRow, __formulaFromStart: true }
              : currentRow;
          }).filter(Boolean);
          state.formulaRowsByKey.clear();
          if (rows.length) enqueueCellFormulaSync(rows);
        }, 320);
      };
      armTimer();
    }, [enqueueCellFormulaSync]);

    const queueCellSaveOperation = useCallback((options) => {
      const state = cellSaveStateRef.current;
      const cellKey = String(options?.cellKey || '');
      if (!cellKey || typeof options?.execute !== 'function') return null;
      const version = state.sequence + 1;
      state.sequence = version;
      state.latestVersionByCell.set(cellKey, version);
      if (!state.committedValueByCell.has(cellKey) && Object.prototype.hasOwnProperty.call(options, 'initialCommittedValue')) {
        state.committedValueByCell.set(cellKey, options.initialCommittedValue);
      }
      if (options.overlay) {
        state.overlays.set(cellKey, {
          ...options.overlay,
          version,
          status: 'pending',
          savedAt: 0,
        });
      }
      if (options.formulaSensitive) {
        formulaRevisionRef.current += 1;
        state.pendingFormulaCount += 1;
        if (state.formulaTimer) {
          clearTimeout(state.formulaTimer);
          state.formulaTimer = null;
        }
      }

      const previousTail = state.tailsByCell.get(cellKey) || Promise.resolve();
      const execution = previousTail.catch(() => undefined).then(options.execute);
      const settled = execution.then((result) => {
        if (Object.prototype.hasOwnProperty.call(options, 'savedValue')) {
          state.committedValueByCell.set(cellKey, options.savedValue);
        }
        const isLatest = state.latestVersionByCell.get(cellKey) === version;
        options.onPersisted?.(result, { isLatest });
        if (isLatest) {
          const currentOverlay = state.overlays.get(cellKey);
          if (currentOverlay?.version === version) {
            state.overlays.set(cellKey, { ...currentOverlay, status: 'saved', savedAt: Date.now() });
          }
          options.onSuccess?.(result);
        }
        if (options.formulaSensitive && options.rowId) {
          const currentRow = (Array.isArray(dataRef.current) ? dataRef.current : []).find(
            (row) => (row.country_asin_date || row.id) === options.rowId
          );
          const formulaRow = currentRow || options.fallbackRow || null;
          state.formulaRowsByKey.set(
            options.rowId,
            formulaRow && options.formulaFromStart ? { ...formulaRow, __formulaFromStart: true } : formulaRow
          );
        }
        if (isLatest && options.successMessage) ctx.message.success(options.successMessage);
        return result;
      }).catch((err) => {
        const isLatest = state.latestVersionByCell.get(cellKey) === version;
        if (isLatest) {
          const currentOverlay = state.overlays.get(cellKey);
          if (currentOverlay?.version === version) state.overlays.delete(cellKey);
          options.onRollback?.(state.committedValueByCell.get(cellKey));
          ctx.message.error(`${options.errorMessage || '保存失败'}：${err?.message || '未知错误'}`);
        }
        return null;
      }).finally(() => {
        state.pendingPromises.delete(settled);
        if (options.formulaSensitive) {
          state.pendingFormulaCount = Math.max(0, state.pendingFormulaCount - 1);
          if (state.pendingFormulaCount === 0 && state.formulaRowsByKey.size === 0) resetFormulaProgress();
          else scheduleQueuedCellFormulaSync();
        }
      });
      state.tailsByCell.set(cellKey, settled);
      state.pendingPromises.add(settled);
      return { version, promise: settled };
    }, [resetFormulaProgress, scheduleQueuedCellFormulaSync]);

    const waitForPendingCellSaves = useCallback(async () => {
      const state = cellSaveStateRef.current;
      while (state.pendingPromises.size) {
        await Promise.allSettled([...state.pendingPromises]);
      }
    }, []);

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
          ctx.message.success('Coupon 预估比例已保存，后台公式校准中');
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
          try {
            await ctx.request({
              url: 'target_default:create',
              method: 'post',
              data: { ...payload, country_asin: currentCountryAsin },
            });
          } catch (createErr) {
            const latestRes = await ctx.request({
              url: 'target_default:list',
              method: 'get',
              params: {
                pageSize: 1,
                filter: JSON.stringify({ country_asin: { $eq: currentCountryAsin } }),
              },
            }).catch(() => null);
            const latestRecord = Array.isArray(latestRes?.data?.data) ? latestRes.data.data[0] : null;
            if (!latestRecord?.id) throw createErr;
            await ctx.request({
              url: 'target_default:update',
              method: 'post',
              params: { filterByTk: latestRecord.id },
              data: payload,
            });
          }
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

    const findSqpManagerItem = useCallback(async (meta, value) => {
      if (!currentCountryAsin || !value) return null;
      const normalizedValue = normalizeSearchText(value);
      const rows = await fetchAllList(`${meta.collection}:list`, {
        sort: 'id',
        filter: JSON.stringify({ country_asin: { $eq: currentCountryAsin } }),
      }, 500);
      return rows.find((row) => normalizeSearchText(row?.[meta.nameField]) === normalizedValue) || null;
    }, [currentCountryAsin, fetchAllList]);

    const addKeyword = useCallback(async () => {
      const keyword = String(keywordDraft || '').trim();
      if (!currentCountryAsin || !keyword) return;
      const meta = getSqpManagerMeta();
      const existingLocal = managerItems.find((item) => normalizeSearchText(item?.[meta.nameField]) === normalizeSearchText(keyword));
      if (existingLocal) {
        ctx.message.warning(`该${meta.title}已存在`);
        return;
      }
      try {
        setManagerSaving(true);
        const res = await ctx.request({ url: `${meta.collection}:create`, method: 'post', data: withCreateTimestamps({ country_asin: currentCountryAsin, country: filterCountry, asin: filterAsin, [meta.nameField]: keyword }) });
        const createdId = res?.data?.data?.id;
        if (createdId && meta.collection === 'sqp_keywords') markDynamicColumnsVisible(`kw_actual_${createdId}`);
        setKeywordDraft('');
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success('新增成功');
      } catch (err) {
        const racedExisting = await findSqpManagerItem(meta, keyword).catch(() => null);
        if (racedExisting) {
          setKeywordDraft('');
          await refreshAfterManagerChange(keywordTab);
          ctx.message.warning(`该${meta.title}已存在，列表已刷新`);
          return;
        }
        ctx.message.error(`新增失败：${err?.message || '未知错误'}`);
      } finally {
        setManagerSaving(false);
      }
    }, [currentCountryAsin, filterAsin, filterCountry, findSqpManagerItem, getSqpManagerMeta, keywordDraft, keywordTab, managerItems, markDynamicColumnsVisible, refreshAfterManagerChange]);

    const updateKeyword = useCallback(async (item, keywordName) => {
      const meta = getSqpManagerMeta();
      if (isLockedSqpDefaultTerm(item)) {
        ctx.message.warning(`默认${meta.title}不能编辑`);
        return;
      }
      const normalizedValue = normalizeSearchText(keywordName);
      const existingLocal = managerItems.find((row) => row.id !== item.id && normalizeSearchText(row?.[meta.nameField]) === normalizedValue);
      if (existingLocal) {
        ctx.message.warning(`该${meta.title}已存在`);
        return;
      }
      try {
        setManagerSaving(true);
        await ctx.request({ url: `${meta.collection}:update`, method: 'post', params: { filterByTk: item.id }, data: { [meta.nameField]: keywordName || null } });
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success('已保存');
      } catch (err) {
        const racedExisting = await findSqpManagerItem(meta, keywordName).catch(() => null);
        if (racedExisting?.id && racedExisting.id !== item.id) {
          await refreshAfterManagerChange(keywordTab);
          ctx.message.warning(`该${meta.title}已存在，列表已刷新`);
          return;
        }
        ctx.message.error(`保存失败：${err?.message || '未知错误'}`);
      } finally {
        setManagerSaving(false);
      }
    }, [findSqpManagerItem, getSqpManagerMeta, isLockedSqpDefaultTerm, keywordTab, managerItems, refreshAfterManagerChange]);

    const deleteKeyword = useCallback(async (item) => {
      const meta = getSqpManagerMeta();
      if (isLockedSqpDefaultTerm(item)) {
        ctx.message.warning(`默认${meta.title}不能删除`);
        return;
      }
      try {
        setManagerSaving(true);
        if (meta.collection === 'sqp_keywords') {
          await ctx.request({
            url: 'sqp_keyword_daily_positions:destroy',
            method: 'post',
            params: { filter: JSON.stringify({ sqp_keyword_id: { $eq: item.id } }) },
          });
        }
        await ctx.request({ url: `${meta.collection}:destroy`, method: 'post', params: { filterByTk: item.id } });
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success(`已删除${meta.title}`);
      } finally {
        setManagerSaving(false);
      }
    }, [getSqpManagerMeta, isLockedSqpDefaultTerm, keywordTab, refreshAfterManagerChange]);

    const findCompetitorManagerItem = useCallback(async (competitorAsin) => {
      const normalizedAsin = normalizeSearchText(competitorAsin);
      if (!currentCountryAsin || !normalizedAsin) return null;
      const rows = await fetchAllList('order_link_competitor_asins:list', {
        sort: ['role', 'competitor_asin'],
        filter: JSON.stringify({ country_asin: { $eq: currentCountryAsin } }),
      }, 500);
      return rows.find((row) => normalizeSearchText(row.competitor_asin) === normalizedAsin) || null;
    }, [currentCountryAsin, fetchAllList]);

    const addCompetitor = useCallback(async () => {
      const getNextRole = (items) => `竞对${items.reduce((max, rec) => {
        const idx = getCompetitorRoleIndex(rec.role);
        return Number.isFinite(idx) && idx !== 9999 ? Math.max(max, idx) : max;
      }, 0) + 1}`;
      let role = getNextRole(managerItems);
      const competitorAsin = String(competitorDraft || '').trim();
      const competitorNote = String(competitorNoteDraft || '').trim();
      if (!currentCountryAsin || !competitorAsin) return;
      const localExisting = managerItems.find((row) => normalizeSearchText(row.competitor_asin) === normalizeSearchText(competitorAsin));
      if (localExisting) {
        ctx.message.warning('该竞对 ASIN 已存在');
        return;
      }
      try {
        setManagerSaving(true);
        const serverExisting = await findCompetitorManagerItem(competitorAsin);
        if (serverExisting) {
          setCompetitorDraft('');
          setCompetitorNoteDraft('');
          await refreshAfterManagerChange('competitor');
          ctx.message.warning('该竞对 ASIN 已存在，列表已刷新');
          return;
        }
        const createRecord = (nextRole) => ctx.request({
          url: 'order_link_competitor_asins:create',
          method: 'post',
          data: { country_asin: currentCountryAsin, role: nextRole, competitor_asin: competitorAsin, notes: competitorNote || null },
        });
        let res;
        try {
          res = await createRecord(role);
        } catch (createErr) {
          const latestRows = await fetchAllList('order_link_competitor_asins:list', {
            sort: ['role', 'competitor_asin'],
            filter: JSON.stringify({ country_asin: { $eq: currentCountryAsin } }),
          }, 500).catch(() => null);
          if (!Array.isArray(latestRows)) throw createErr;
          const existingSameAsin = latestRows.find((row) => normalizeSearchText(row.competitor_asin) === normalizeSearchText(competitorAsin));
          if (existingSameAsin) {
            setCompetitorDraft('');
            setCompetitorNoteDraft('');
            await refreshAfterManagerChange('competitor');
            ctx.message.warning('该竞对 ASIN 已存在，列表已刷新');
            return;
          }
          const retryRole = getNextRole(latestRows);
          if (retryRole === role || !latestRows.some((row) => row.role === role)) throw createErr;
          role = retryRole;
          res = await createRecord(role);
        }
        const createdId = res?.data?.data?.id;
        if (createdId) markDynamicColumnsVisible(`competitor_dynamic_${createdId}`);
        setCompetitorDraft('');
        setCompetitorNoteDraft('');
        await refreshAfterManagerChange('competitor');
        ctx.message.success(`${role} 已添加`);
      } catch (err) {
        ctx.message.error(`添加竞对失败：${err?.message || '未知错误'}`);
      } finally {
        setManagerSaving(false);
      }
    }, [competitorDraft, competitorNoteDraft, currentCountryAsin, fetchAllList, filterAsin, filterCountry, findCompetitorManagerItem, managerItems, markDynamicColumnsVisible, refreshAfterManagerChange]);

    const updateCompetitor = useCallback(async (item, value) => {
      const trimmed = String(value || '').trim();
      if (!trimmed) return;
      if (normalizeSearchText(trimmed) === normalizeSearchText(item.competitor_asin)) return;
      const localExisting = managerItems.find((row) => row.id !== item.id && normalizeSearchText(row.competitor_asin) === normalizeSearchText(trimmed));
      if (localExisting) {
        ctx.message.warning('该竞对 ASIN 已存在');
        await refreshAfterManagerChange('competitor');
        return;
      }
      try {
        setManagerSaving(true);
        const serverExisting = await findCompetitorManagerItem(trimmed);
        if (serverExisting?.id && serverExisting.id !== item.id) {
          await refreshAfterManagerChange('competitor');
          ctx.message.warning('该竞对 ASIN 已存在，列表已刷新');
          return;
        }
        await ctx.request({ url: 'order_link_competitor_asins:update', method: 'post', params: { filterByTk: item.id }, data: { competitor_asin: trimmed } });
        await refreshAfterManagerChange('competitor');
        ctx.message.success('已保存');
      } catch (err) {
        const racedExisting = await findCompetitorManagerItem(trimmed).catch(() => null);
        if (racedExisting?.id && racedExisting.id !== item.id) {
          await refreshAfterManagerChange('competitor');
          ctx.message.warning('该竞对 ASIN 已存在，列表已刷新');
          return;
        }
        ctx.message.error(`保存失败：${err?.message || '未知错误'}`);
      } finally {
        setManagerSaving(false);
      }
    }, [findCompetitorManagerItem, managerItems, refreshAfterManagerChange]);

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
        ctx.message.warning('只有默认视图可以保存为默认视图');
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
      if (columnLayoutSaveTimerRef.current) clearTimeout(columnLayoutSaveTimerRef.current);
      columnLayoutSaveTimerRef.current = setTimeout(async () => {
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
          clearTimeout(columnLayoutSaveTimerRef.current);
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
        const existingDefaultViews = normalizeColumnViewList({ views: views.filter((view) => isDefaultColumnViewId(view?.id)) });
        const defaultViews = syncHeaderColorsIntoColumnViews(existingDefaultViews.map((savedView) => {
          const id = savedView.id;
          return {
            id,
            name: getViewLabel(savedView) || DEFAULT_COLUMN_VIEW_LABELS[id] || '默认视图',
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
            clearTimeout(columnLayoutSaveTimerRef.current);
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
      const doCreateDefault = async (rawName) => {
        if (!IS_ADMIN) return false;
        const name = String(rawName || '').trim();
        if (!name) {
          ctx.message.warning('请先输入视图名称');
          return false;
        }
        setColumnViewCreating(true);
        try {
          const payload = buildCurrentColumnViewPayload();
          const result = await createDefaultColumnViewForCurrentUser(payload, name);
          if (!result?.view) throw new Error('默认视图未保存');
          columnViewSwitchSeqRef.current += 1;
          setColumnViewsLocal(result.views);
          setActiveColumnViewLocal(result.view.id);
          applyColumnPayloadToLocal(result.view.payload);
          ctx.message.success(`默认视图「${getViewLabel(result.view)}」已创建`);
          return true;
        } catch (err) {
          ctx.message.error(`新增默认视图失败：${err?.message || '未知错误'}`);
          return false;
        } finally {
          setColumnViewCreating(false);
        }
      };
      let nextName = '';
      let modalRef = null;
      modalRef = Modal.confirm({
        title: '复制并保存视图',
        content: React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } },
          React.createElement(Input, {
            autoFocus: true,
            placeholder: '请输入视图名称',
            onChange: (e) => { nextName = e.target.value; },
            onPressEnter: (e) => e.currentTarget?.blur?.(),
          }),
          IS_ADMIN && React.createElement(Button, {
            type: 'default',
            disabled: !currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching,
            onClick: async () => {
              const created = await doCreateDefault(nextName);
              if (created) modalRef?.destroy?.();
            },
            style: { alignSelf: 'flex-start', fontWeight: 700 },
          }, columnViewCreating ? '保存中...' : '保存默认视图')
        ),
        okText: '复制并保存',
        cancelText: '取消',
        onOk: async () => {
          const created = await doCreate(nextName);
          if (!created) return Promise.reject(new Error('视图未创建'));
        },
      });
    }, [activeColumnViewId, applyColumnPayloadToLocal, buildCurrentColumnViewPayload, columnViewCreating, columnViewSaving, columnViewSwitching, columnViews, setActiveColumnViewLocal, setColumnViewsLocal]);

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
      if (columnHighlightTimerRef.current) clearTimeout(columnHighlightTimerRef.current);
      columnHighlightTimerRef.current = setTimeout(() => setHighlightColumnKey(null), 2200);
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

    async function findKeywordDailyRecord(rowId, keywordId) {
      if (!rowId || !keywordId) return null;
      const res = await ctx.request({
        url: 'sqp_keyword_daily_positions:list',
        method: 'get',
        params: {
          pageSize: 1,
          filter: JSON.stringify({
            $and: [
              { country_asin_date: { $eq: rowId } },
              { sqp_keyword_id: { $eq: keywordId } },
            ],
          }),
        },
      });
      return Array.isArray(res?.data?.data) ? (res.data.data[0] || null) : null;
    }

    async function saveKeywordDailyRecord({ rowId, keywordId, countryAsin, country, asin, date, value, daily }) {
      let existing = daily?.id ? daily : null;
      if (!existing) existing = await findKeywordDailyRecord(rowId, keywordId);

      if (existing?.id) {
        await ctx.request({
          url: 'sqp_keyword_daily_positions:update',
          method: 'post',
          params: { filterByTk: existing.id },
          data: { actual_rank: value },
        });
        return { ...existing, actual_rank: value };
      }

      try {
        const res = await ctx.request({
          url: 'sqp_keyword_daily_positions:create',
          method: 'post',
          data: withCreateTimestamps({
            country_asin_date: rowId,
            country_asin: countryAsin,
            country,
            asin,
            sqp_keyword_id: keywordId,
            date,
            actual_rank: value,
          }),
        });
        return { ...(daily || {}), ...(res?.data?.data || {}), actual_rank: value };
      } catch (err) {
        const racedExisting = await findKeywordDailyRecord(rowId, keywordId);
        if (!racedExisting?.id) throw err;
        await ctx.request({
          url: 'sqp_keyword_daily_positions:update',
          method: 'post',
          params: { filterByTk: racedExisting.id },
          data: { actual_rank: value },
        });
        return { ...racedExisting, actual_rank: value };
      }
    }

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
          data: {
            country_asin_date: rowId,
            competitor_id: competitorId,
            date,
            [field]: value,
          },
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

    const importantCellKeySet = useMemo(
      () => new Set(importantCellKeys),
      [importantCellKeys]
    );

    const flushImportantCellSave = useCallback(async () => {
      const saveState = importantCellSaveStateRef.current;
      if (saveState.running || !saveState.dirty || !importantCellsLoadedRef.current) return;

      saveState.running = true;
      saveState.dirty = false;
      const keysToSave = [...importantCellKeysRef.current];
      try {
        await saveImportantCellKeysToUser(keysToSave);
        saveState.retryCount = 0;
      } catch (_) {
        saveState.dirty = true;
        saveState.retryCount += 1;
      } finally {
        saveState.running = false;
        if (saveState.dirty && saveState.retryCount <= 3) {
          if (saveState.timer) clearTimeout(saveState.timer);
          saveState.timer = setTimeout(() => {
            saveState.timer = null;
            importantCellFlushSaveRef.current?.();
          }, saveState.retryCount > 0 ? 1000 : 250);
        }
      }
    }, []);
    importantCellFlushSaveRef.current = flushImportantCellSave;

    const scheduleImportantCellSave = useCallback(() => {
      const saveState = importantCellSaveStateRef.current;
      saveState.dirty = true;
      saveState.retryCount = 0;
      if (saveState.timer) clearTimeout(saveState.timer);
      if (!importantCellsLoadedRef.current) {
        saveState.timer = null;
        return;
      }
      saveState.timer = setTimeout(() => {
        saveState.timer = null;
        importantCellFlushSaveRef.current?.();
      }, 250);
    }, []);

    const applyImportantCellOperation = useCallback((keys, mode) => {
      const validKeys = Array.from(new Set(keys.filter(Boolean)));
      if (!validKeys.length) return;
      if (!importantCellsLoadedRef.current) {
        importantCellPendingOperationsRef.current.push({ keys: validKeys, mode });
      }

      const nextKeySet = new Set(importantCellKeysRef.current);
      validKeys.forEach((key) => {
        if (mode === 'add') nextKeySet.add(key);
        else if (mode === 'remove') nextKeySet.delete(key);
        else if (nextKeySet.has(key)) nextKeySet.delete(key);
        else nextKeySet.add(key);
      });
      const nextKeys = Array.from(nextKeySet);
      importantCellKeysRef.current = nextKeys;
      setImportantCellKeys(nextKeys);
      scheduleImportantCellSave();
    }, [scheduleImportantCellSave]);

    const toggleImportantCell = useCallback((row, col) => {
      const cellKey = getImportantCellKey(row, col);
      if (!cellKey) return;
      applyImportantCellOperation([cellKey], 'toggle');
    }, [applyImportantCellOperation]);

    const toggleSelectedImportantCells = useCallback((rect) => {
      if (!rect) return;
      const keys = [];
      for (let r = rect.r1; r <= rect.r2; r += 1) {
        const row = pagedData[r];
        if (!row) continue;
        const rowId = row.country_asin_date || row.id;
        for (let c = rect.c1; c <= rect.c2; c += 1) {
          const col = visibleCols[c];
          if (!col) continue;
          const mergedCell = rowId ? weeklyMergedCellMap[rowId]?.[col.key] : null;
          if (mergedCell?.rowSpan === 0) continue;
          const cellKey = getImportantCellKey(row, col);
          if (cellKey) keys.push(cellKey);
        }
      }
      const validKeys = Array.from(new Set(keys));
      if (!validKeys.length) return;
      const currentKeys = new Set(importantCellKeysRef.current);
      const mode = validKeys.every((key) => currentKeys.has(key)) ? 'remove' : 'add';
      applyImportantCellOperation(validKeys, mode);
    }, [applyImportantCellOperation, pagedData, visibleCols, weeklyMergedCellMap]);

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

    const handleCellMouseDown = useCallback((e, r, c, row, col) => {
      if (e.button !== 0 || isResizing) return;

      const tag = String(e.target?.tagName || '').toLowerCase();
      const closestEl = e.target?.closest?.('.ant-picker, .ant-select, .ant-input-number');
      if (['input', 'textarea', 'select', 'button'].includes(tag) || closestEl) return;

      if (e.altKey) {
        e.preventDefault();
        e.stopPropagation();
        if (importantCellAltPressRef.current) importantCellAltPressRef.current.usedAsModifier = true;
        toggleImportantCell(row, col);
        return;
      }

      if (editingCell) {
        pendingCellInteractionRef.current = { r, c, openEditor: false };
        return;
      }

      const nextRange = { start: { r, c }, end: { r, c } };
      selectingRef.current = true;
      selectionDraftRef.current = nextRange;
      selectionStore.setRange(nextRange);
      setActiveCell({ r, c });
      setSelectedRange(nextRange);
      setSelectionInputValue('');
      focusClipboardWithoutScroll();
      e.preventDefault();
    }, [editingCell, focusClipboardWithoutScroll, isResizing, selectionStore, toggleImportantCell]);

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
            const nextDaily = await saveKeywordDailyRecord({
              rowId: op.rowId,
              keywordId: op.kwId,
              countryAsin: op.country && op.asin ? `${op.country}_${op.asin}` : null,
              country: op.country,
              asin: op.asin,
              date: op.date,
              value: op.valueToSave,
              daily: { ...op.daily, id: op.dailyId || op.daily?.id },
            });
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
          const updatePastedRows = changedRowsMap.size ? updateDataLocalOnly : updateDataAndRefreshWeekly;
          updatePastedRows((prev) => prev.map((row) => {
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
            finishFormulaProgress('粘贴快速公式已更新，等待全量校准');
          }
          ctx.message.success(changedRows.length
            ? `粘贴成功，已更新 ${undoItems.length + richOps.length} 个单元格，后台公式校准中`
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
    }, [canPastePlainTextAsSingleValue, finishFormulaProgress, getCellValue, isCellEditable, isTableClipboardEvent, loadData, normalizeSelection, pagedData, parsePastedValue, pushUndoEntry, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly, updateDataLocalOnly, visibleCols]);

    const fillSelectedCells = useCallback(async (rawValue) => {
      const rect = normalizeSelection(selectedRange);
      if (!rect || saving) return;
      const isSingleCellFill = rect.r1 === rect.r2 && rect.c1 === rect.c2;
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
            const nextDaily = await saveKeywordDailyRecord({
              rowId: op.rowId,
              keywordId: op.kwId,
              countryAsin: op.country && op.asin ? `${op.country}_${op.asin}` : null,
              country: op.country,
              asin: op.asin,
              date: op.date,
              value: op.valueToSave,
              daily: { ...op.daily, id: op.dailyId || op.daily?.id },
            });
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
        const updateFilledRows = changedRowsMap.size ? updateDataLocalOnly : updateDataAndRefreshWeekly;
        updateFilledRows((prev) => prev.map((row) => {
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
          if (isSingleCellFill) {
            setSaving(false);
            enqueueCellFormulaSync(changedRows);
          } else {
            showFormulaProgress({ label: '选区已填充，正在同步公式...', percent: 8 });
            await syncFormulasForChangedRows(changedRows, { onProgress: showFormulaProgress });
            finishFormulaProgress('填充快速公式已更新，等待全量校准');
          }
        }
        ctx.message.success(`已填充 ${requests.length + richOps.length} 个单元格`);
      } catch (err) {
        if (!isSingleCellFill) resetFormulaProgress();
        ctx.message.error(`填充失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [enqueueCellFormulaSync, finishFormulaProgress, getCellValue, isCellEditable, loadData, normalizeSelection, pagedData, parsePastedValue, pushUndoEntry, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly, updateDataLocalOnly, visibleCols]);

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
          const updateClearedRows = changedRowsMap.size ? updateDataLocalOnly : updateDataAndRefreshWeekly;
          updateClearedRows((prev) => prev.map((row) => {
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
            finishFormulaProgress('清空后快速公式已更新，等待全量校准');
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
    }, [finishFormulaProgress, getCellValue, isCellEditable, loadData, normalizeSelection, pagedData, pushUndoEntry, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly, updateDataLocalOnly, visibleCols]);

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

        const updateUndoneRows = changedRowsMap.size ? updateDataLocalOnly : updateDataAndRefreshWeekly;
        updateUndoneRows((prev) => prev.map((row) => {
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
          finishFormulaProgress('撤回后快速公式已更新，等待全量校准');
        }
        ctx.message.success('已撤回上一步编辑');
      } catch (err) {
        undoStackRef.current.push(entry);
        resetFormulaProgress();
        ctx.message.error(`撤回失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [finishFormulaProgress, resetFormulaProgress, saving, showFormulaProgress, syncFormulasForChangedRows, updateDataAndRefreshWeekly, updateDataLocalOnly]);

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
      if (e.key !== 'Alt' && importantCellAltPressRef.current) {
        importantCellAltPressRef.current.usedAsModifier = true;
      }
      if ((e.ctrlKey || e.metaKey) && String(e.key || '').toLowerCase() === 'z') {
        e.preventDefault();
        undoLastEdit();
        return;
      }
      if (!rect) return;
      if (e.key === 'Alt') {
        e.preventDefault();
        if (!e.repeat) importantCellAltPressRef.current = { usedAsModifier: false };
        return;
      }
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

    const handleKeyUp = useCallback((e) => {
      if (e.key !== 'Alt') return;
      const altPress = importantCellAltPressRef.current;
      importantCellAltPressRef.current = null;
      if (!altPress) return;
      e.preventDefault();
      if (altPress.usedAsModifier || editingCell || saving) return;
      const rect = normalizeSelection(selectedRange);
      if (rect) toggleSelectedImportantCells(rect);
    }, [editingCell, normalizeSelection, saving, selectedRange, toggleSelectedImportantCells]);

    const startEdit = useCallback((rowId, col, currentValue) => {
      if (saving) return;
      editSessionSequenceRef.current += 1;
      const sessionId = editSessionSequenceRef.current;
      selectingRef.current = false;
      selectionDraftRef.current = null;
      selectionStore.setRange(null);
      setSelectedRange(null);
      setSelectionInputValue('');
      setEditingCell({ rowId, colKey: col.key, field: col.field, src: col.src, sessionId });
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

    const resumePendingCellInteraction = useCallback(() => {
      const pending = pendingCellInteractionRef.current;
      pendingCellInteractionRef.current = null;
      if (!pending) return;

      if (pending.openEditor && pending.rowId && pending.col) {
        const latestRow = (Array.isArray(dataRef.current) ? dataRef.current : []).find(
          (row) => (row.country_asin_date || row.id) === pending.rowId
        );
        const latestValue = latestRow ? getCellValue(pending.col, latestRow) : pending.currentValue;
        startEdit(pending.rowId, pending.col, latestValue);
        return;
      }

      if (!Number.isInteger(pending.r) || !Number.isInteger(pending.c)) return;
      const nextRange = { start: { r: pending.r, c: pending.c }, end: { r: pending.r, c: pending.c } };
      selectingRef.current = false;
      selectionDraftRef.current = nextRange;
      selectionStore.setRange(nextRange);
      setActiveCell({ r: pending.r, c: pending.c });
      setSelectedRange(nextRange);
      setSelectionInputValue('');
      focusClipboardWithoutScroll();
    }, [focusClipboardWithoutScroll, selectionStore, startEdit]);

    const cancelEdit = useCallback(() => { setEditingCell(null); setEditValue(null); }, []);

    const saveEdit = useCallback((valueOverride) => {
      if (!editingCell) return;
      const sessionId = editingCell.sessionId;
      if (sessionId && submittedEditSessionRef.current === sessionId) return;
      if (sessionId) submittedEditSessionRef.current = sessionId;

      const { rowId, field, src } = editingCell;
      const currentEditValue = valueOverride !== undefined ? valueOverride : editValue;
      const row = (Array.isArray(dataRef.current) ? dataRef.current : []).find(
        (item) => (item.country_asin_date || item.id) === rowId
      );
      if (!row) { pendingCellInteractionRef.current = null; return; }

      const finishOptimisticEdit = () => {
        setEditingCell(null);
        setEditValue(null);
        resumePendingCellInteraction();
      };
      const updateNestedDailyValue = (colField, dailyField, value, useWeeklyRefresh = false) => {
        const updater = useWeeklyRefresh ? updateDataAndRefreshWeekly : updateDataLocalOnly;
        updater((prev) => prev.map((item) => {
          if ((item.country_asin_date || item.id) !== rowId) return item;
          const currentPayload = item[colField] || {};
          return {
            ...item,
            [colField]: {
              ...currentPayload,
              daily: { ...(currentPayload.daily || {}), [dailyField]: value },
            },
          };
        }));
      };

      const dynamicKeywordCol = dynamicKeywordCols.find((col) => col.key === editingCell.colKey);
      if (dynamicKeywordCol?._dynamicKind === 'keyword') {
        const payload = row[dynamicKeywordCol.field];
        const kw = payload?.kw;
        const daily = payload?.daily || {};
        if (!kw?.id) { pendingCellInteractionRef.current = null; ctx.message.error('无法找到 SQP 关键词记录'); cancelEdit(); return; }
        const normalizedEditValue = currentEditValue && typeof currentEditValue === 'object' ? currentEditValue?.daily?.actual_rank : currentEditValue;
        const valueToSave = normalizedEditValue !== '' && normalizedEditValue != null ? String(normalizedEditValue).trim() || null : null;
        const oldValue = daily.actual_rank ?? null;
        const cellKey = `keyword:${kw.id}:${rowId}:actual_rank`;
        updateNestedDailyValue(dynamicKeywordCol.field, 'actual_rank', valueToSave);
        queueCellSaveOperation({
          cellKey,
          rowId,
          initialCommittedValue: oldValue,
          savedValue: valueToSave,
          fallbackRow: row,
          overlay: {
            rowId,
            applyToRow: (currentRow) => {
              const currentPayload = currentRow[dynamicKeywordCol.field] || {};
              const latestLocalRow = (Array.isArray(dataRef.current) ? dataRef.current : []).find(
                (item) => (item.country_asin_date || item.id) === rowId
              );
              const latestLocalDaily = latestLocalRow?.[dynamicKeywordCol.field]?.daily || {};
              return { ...currentRow, [dynamicKeywordCol.field]: { ...currentPayload, daily: { ...(currentPayload.daily || {}), ...latestLocalDaily, actual_rank: valueToSave } } };
            },
          },
          execute: () => {
            const latestRow = (Array.isArray(dataRef.current) ? dataRef.current : []).find(
              (item) => (item.country_asin_date || item.id) === rowId
            );
            const latestDaily = latestRow?.[dynamicKeywordCol.field]?.daily || daily;
            return saveKeywordDailyRecord({
              rowId,
              keywordId: kw.id,
              countryAsin: row.country && row.asin ? `${row.country}_${row.asin}` : null,
              country: row.country || null,
              asin: row.asin || null,
              date: row.date ? String(row.date).slice(0, 10) : null,
              value: valueToSave,
              daily: latestDaily,
            });
          },
          onPersisted: (nextDaily) => {
            updateDataLocalOnly((prev) => prev.map((item) => {
              if ((item.country_asin_date || item.id) !== rowId) return item;
              const currentPayload = item[dynamicKeywordCol.field] || payload || {};
              const currentValue = currentPayload?.daily?.actual_rank ?? null;
              return { ...item, [dynamicKeywordCol.field]: { ...currentPayload, daily: { ...nextDaily, actual_rank: currentValue } } };
            }));
            pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'keyword', rowId, colField: dynamicKeywordCol.field, dailyId: nextDaily.id, oldValue, newValue: valueToSave }] });
          },
          onSuccess: () => updateDataAndRefreshWeekly((prev) => prev.map((item) => (
            (item.country_asin_date || item.id) === rowId ? { ...item } : item
          ))),
          onRollback: (committedValue) => updateNestedDailyValue(dynamicKeywordCol.field, 'actual_rank', committedValue ?? null, true),
          successMessage: '保存成功',
          errorMessage: '保存 SQP 关键词自然位失败',
        });
        finishOptimisticEdit();
        return;
      }

      const dynamicCompetitorCol = dynamicCompetitorCols.find((col) => col.key === editingCell.colKey);
      if (dynamicCompetitorCol?._dynamicKind === 'competitor') {
        const payload = row[dynamicCompetitorCol.field];
        const competitor = payload?.competitor;
        const daily = payload?.daily || {};
        const fieldName = dynamicCompetitorCol._competitorField || 'notes';
        if (!competitor?.id) { pendingCellInteractionRef.current = null; ctx.message.error('无法找到竞对记录'); cancelEdit(); return; }
        const normalizedEditValue = currentEditValue && typeof currentEditValue === 'object' ? currentEditValue?.daily?.[fieldName] : currentEditValue;
        const valueToSave = normalizedEditValue !== '' && normalizedEditValue != null ? normalizedEditValue : null;
        const oldValue = daily[fieldName] ?? null;
        const cellKey = `competitor:${competitor.id}:${rowId}:${fieldName}`;
        updateNestedDailyValue(dynamicCompetitorCol.field, fieldName, valueToSave);
        queueCellSaveOperation({
          cellKey,
          rowId,
          initialCommittedValue: oldValue,
          savedValue: valueToSave,
          fallbackRow: row,
          overlay: {
            rowId,
            applyToRow: (currentRow) => {
              const currentPayload = currentRow[dynamicCompetitorCol.field] || {};
              const latestLocalRow = (Array.isArray(dataRef.current) ? dataRef.current : []).find(
                (item) => (item.country_asin_date || item.id) === rowId
              );
              const latestLocalDaily = latestLocalRow?.[dynamicCompetitorCol.field]?.daily || {};
              return { ...currentRow, [dynamicCompetitorCol.field]: { ...currentPayload, daily: { ...(currentPayload.daily || {}), ...latestLocalDaily, [fieldName]: valueToSave } } };
            },
          },
          execute: () => {
            const latestRow = (Array.isArray(dataRef.current) ? dataRef.current : []).find(
              (item) => (item.country_asin_date || item.id) === rowId
            );
            const latestDaily = latestRow?.[dynamicCompetitorCol.field]?.daily || daily;
            return saveCompetitorDailyRecord({
              rowId,
              competitorId: competitor.id,
              date: row.date ? String(row.date).slice(0, 10) : null,
              field: fieldName,
              value: valueToSave,
              daily: latestDaily,
            });
          },
          onPersisted: (nextDaily) => {
            updateDataLocalOnly((prev) => prev.map((item) => {
              if ((item.country_asin_date || item.id) !== rowId) return item;
              const currentPayload = item[dynamicCompetitorCol.field] || payload || {};
              const currentValue = currentPayload?.daily?.[fieldName] ?? null;
              return { ...item, [dynamicCompetitorCol.field]: { ...currentPayload, daily: { ...nextDaily, [fieldName]: currentValue } } };
            }));
            pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'competitor', rowId, colField: dynamicCompetitorCol.field, dailyId: nextDaily.id, field: fieldName, oldValue, newValue: valueToSave }] });
          },
          onSuccess: () => updateDataAndRefreshWeekly((prev) => prev.map((item) => (
            (item.country_asin_date || item.id) === rowId ? { ...item } : item
          ))),
          onRollback: (committedValue) => updateNestedDailyValue(dynamicCompetitorCol.field, fieldName, committedValue ?? null, true),
          successMessage: '保存成功',
          errorMessage: '保存竞对失败',
        });
        finishOptimisticEdit();
        return;
      }

      const updateConfig = SRC_UPDATE_CONFIG[src];
      if (!updateConfig) { pendingCellInteractionRef.current = null; ctx.message.error(`字段来源 "${src}" 暂不支持编辑`); return; }
      const pkValue = row[updateConfig.pkField];
      if (!pkValue) { pendingCellInteractionRef.current = null; ctx.message.error(`无法找到记录主键：${updateConfig.pkField}`); cancelEdit(); return; }
      let valueToSave = currentEditValue;
      if (field === 'promo_day') valueToSave = currentEditValue;
      else if (field === 'order_structure_diagnostic') valueToSave = currentEditValue || null;
      else if (RATE_FIELDS.has(field)) valueToSave = (currentEditValue !== '' && currentEditValue !== null) ? Number(currentEditValue) / 100 : null;
      else if (MONEY_FIELDS.has(field) || NUM_FIELDS.has(field)) valueToSave = (currentEditValue !== '' && currentEditValue !== null) ? Number(currentEditValue) : null;
      else if (DATE_FIELDS.has(field)) valueToSave = currentEditValue || null;
      else valueToSave = currentEditValue || null;
      const oldValue = getCellValue({ field, src }, row) ?? null;
      const formulaSensitive = isFormulaSensitiveField(field);
      const cellKey = `static:${updateConfig.url}:${pkValue}:${field}`;
      const applyStaticValue = (currentRow, value) => mergeSourcePatch(currentRow, src, { [field]: value });
      const matchesStaticRow = (currentRow) => (
        src === 'product_config'
          ? currentRow?.[updateConfig.pkField] === pkValue
          : (currentRow.country_asin_date || currentRow.id) === rowId
      );
      updateDataLocalOnly((prev) => prev.map((item) => (
        matchesStaticRow(item) ? applyStaticValue(item, valueToSave) : item
      )));
      queueCellSaveOperation({
        cellKey,
        rowId,
        formulaSensitive,
        formulaFromStart: src === 'product_config',
        initialCommittedValue: oldValue,
        savedValue: valueToSave,
        fallbackRow: applyStaticValue(row, valueToSave),
        overlay: { rowId, matchesRow: matchesStaticRow, applyToRow: (currentRow) => applyStaticValue(currentRow, valueToSave) },
        execute: () => ctx.request({
          url: updateConfig.url,
          method: 'post',
          params: { filterByTk: pkValue },
          data: { [field]: valueToSave },
        }),
        onPersisted: () => {
          pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'static', rowId, src, field, pkValue, oldValue, newValue: valueToSave }] });
        },
        onSuccess: () => {
          if (!formulaSensitive) {
            updateDataAndRefreshWeekly((prev) => prev.map((item) => (
              matchesStaticRow(item) ? { ...item } : item
            )));
          }
        },
        onRollback: (committedValue) => {
          const updater = formulaSensitive ? updateDataLocalOnly : updateDataAndRefreshWeekly;
          updater((prev) => prev.map((item) => (
            matchesStaticRow(item) ? applyStaticValue(item, committedValue ?? null) : item
          )));
        },
        successMessage: formulaSensitive ? '' : '保存成功',
        errorMessage: '保存失败',
      });
      finishOptimisticEdit();
    }, [cancelEdit, dynamicCompetitorCols, dynamicKeywordCols, editValue, editingCell, pushUndoEntry, queueCellSaveOperation, resumePendingCellInteraction, updateDataAndRefreshWeekly, updateDataLocalOnly]);

    const refreshData  = useCallback(async () => {
      if (refreshingData || calcLoading || loading) return;
      try {
        setRefreshingData(true);
        setRefreshProgress('正在完成待保存单元格...');
        showFormulaProgress({ label: '正在完成待保存单元格...', percent: 3 });
        await waitForPendingCellSaves();
        const cellSaveState = cellSaveStateRef.current;
        if (cellSaveState.formulaTimer) {
          clearTimeout(cellSaveState.formulaTimer);
          cellSaveState.formulaTimer = null;
        }
        cellSaveState.formulaRowsByKey.clear();
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
        formulaRevisionRef.current += 1;
        const refreshFormulaRevision = formulaRevisionRef.current;
        const result = await runCoreFormulaTask(async () => {
          const latestRows = await loadFormulaRowsForCurrentCountryAsin();
          rows = latestRows;
          return recalcAllCoreFormulas(latestRows, {
            silent: true,
            preloadedDailyRows: latestRows,
            skipSummaryRefresh: true,
            expectedFormulaRevision: refreshFormulaRevision,
            onProgress: (progress) => {
              const label = typeof progress === 'string' ? progress : (progress?.label || '正在重新计算公式...');
              setRefreshProgress(label);
              showFormulaProgress(progress);
            },
          });
        });
        if (result?.stale) {
          setRefreshProgress('检测到新的编辑，保留最新输入...');
          await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true, skipBackgroundSummary: true, skipCurrentPageSummaryRefresh: true });
          finishFormulaProgress('最新编辑已保留，后台继续同步');
          return;
        }
        setRefreshProgress('正在刷新全量周汇总...');
        showFormulaProgress({ label: '正在刷新全量周汇总...', percent: 88 });
        await runFullSummaryTask(async () => {
          rows = await loadFormulaRowsForCurrentCountryAsin();
          const { mergedRows: summaryRows, summaryCols } = await mergeDailyRowsForWeeklySummary(rows, { updateDynamicColumns: true });
          return refreshWeeklySummariesFromRows(summaryRows, summaryCols);
        });
        setRefreshProgress('正在重新加载结果...');
        showFormulaProgress({ label: '正在重新加载结果...', percent: 96 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true, skipBackgroundSummary: true, skipCurrentPageSummaryRefresh: true });
        const ok = !result || result.failCount === 0;
        ctx.message[ok ? 'success' : 'warning'](ok ? '数据和周汇总已刷新' : '数据已刷新，部分公式计算失败');
        finishFormulaProgress(ok ? '刷新完成' : '刷新完成，部分公式失败');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.warning(`刷新未完成：${err?.message || '未知错误'}`);
      } finally {
        setRefreshingData(false);
        setRefreshProgress('');
      }
    }, [calcLoading, finishFormulaProgress, loadData, loadFormulaRowsForCurrentCountryAsin, loading, mergeDailyRowsForWeeklySummary, recalcAllCoreFormulas, refreshWeeklySummariesFromRows, refreshingData, resetFormulaProgress, runCoreFormulaTask, runFullSummaryTask, showFormulaProgress, waitForPendingCellSaves]);

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
      setTimeout(apply, 0);
      setTimeout(apply, 80);
    }, []);

    const saveKeywordRichCell = useCallback(async (row, col, newContent) => {
      const rowId = row?.country_asin_date || row?.id;
      const payload = row?.[col.field];
      const kw = payload?.kw;
      const daily = payload?.daily || {};
      if (!rowId || !kw?.id) { ctx.message.error('无法找到 SQP 关键词记录'); return false; }
      const scrollPos = captureTableScroll();
      try {
        const nextDaily = await saveKeywordDailyRecord({
          rowId,
          keywordId: kw.id,
          countryAsin: row.country && row.asin ? `${row.country}_${row.asin}` : null,
          country: row.country || null,
          asin: row.asin || null,
          date: row.date ? String(row.date).slice(0, 10) : null,
          value: newContent || null,
          daily,
        });
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
        const updateSavedRows = isFormulaSensitiveField(col) ? updateDataLocalOnly : updateDataAndRefreshWeekly;
        updateSavedRows((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? mergeSourcePatch(r, col.src, { [col.field]: valueToSave }) : r));
        pushUndoEntry({ label: '编辑单元格', items: [{ kind: 'static', rowId, src: col.src, field: col.field, pkValue, oldValue: getCellValue(col, row) ?? null, newValue: valueToSave }] });
        if (isFormulaSensitiveField(col)) {
          enqueueCellFormulaSync([nextRow]);
        }
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, enqueueCellFormulaSync, getCellValue, pushUndoEntry, restoreTableScroll, updateDataAndRefreshWeekly, updateDataLocalOnly]);

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
      marginBottom: '6px',
      color: '#bae0ff',
      fontSize: '12px',
      fontWeight: 700,
      letterSpacing: 0,
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
    const tooltipHighlightedSectionBaseStyle = {
      marginTop: '10px',
      padding: '8px 10px',
      borderRadius: '0 4px 4px 0',
    };
    const tooltipDailyDetailStyle = {
      ...tooltipHighlightedSectionBaseStyle,
      borderLeft: '3px solid #5cdbd3',
      background: 'rgba(19,194,194,0.12)',
    };
    const tooltipWeeklySummaryStyle = {
      ...tooltipHighlightedSectionBaseStyle,
      borderLeft: '3px solid #69b1ff',
      background: 'rgba(22,119,255,0.14)',
    };
    const tooltipFieldRowStyle = {
      display: 'grid',
      gridTemplateColumns: '86px minmax(0, 1fr)',
      gap: '8px',
      alignItems: 'start',
      padding: '2px 0',
    };
    const tooltipFieldLabelStyle = {
      color: 'rgba(255,255,255,0.52)',
      fontWeight: 600,
    };
    const tooltipCodeStyle = {
      padding: 0,
      background: 'transparent',
      color: 'rgba(255,255,255,0.78)',
      fontFamily: 'monospace',
      fontSize: '11px',
      lineHeight: 1.55,
      whiteSpace: 'normal',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere',
    };

    const renderTooltip = ({ title, formula, weeklySummaryFormula = [], emptyRules = [], fields = [], writeBackField, hideEmptyRules = false, hideFieldMapping = false, sourceInfos = [], emptyRuleMode = '任意', salesSectionTitle = '取值与计算规则' }) => {
      const formulaLines = splitTooltipText(formula || '直接展示该指标值');
      const weeklySummaryLines = splitTooltipText(weeklySummaryFormula);
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
        React.createElement('div', {
          style: salesSectionTitle === '日明细口径'
            ? tooltipDailyDetailStyle
            : { paddingTop: '10px' },
        },
          React.createElement('div', {
            style: salesSectionTitle === '日明细口径'
              ? { ...tooltipSectionTitleStyle, color: '#87e8de' }
              : tooltipSectionTitleStyle,
          }, salesSectionTitle),
          React.createElement('div', { style: { display: 'grid', gap: '4px' } },
            formulaLines.map((line, idx) => React.createElement('div', {
              key: `formula_${idx}`,
              style: tooltipBodyStyle,
            }, line))
          )
        ),
        weeklySummaryLines.length > 0 && React.createElement('div', { style: tooltipWeeklySummaryStyle },
          React.createElement('div', {
            style: { ...tooltipSectionTitleStyle, marginBottom: '5px', color: '#91caff' },
          }, '周汇总口径'),
          React.createElement('div', { style: { display: 'grid', gap: '4px' } },
            weeklySummaryLines.map((line, idx) => React.createElement('div', {
              key: `weekly_summary_${idx}`,
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
          React.createElement('div', { style: { ...tooltipSectionTitleStyle, color: 'rgba(255,255,255,0.58)' } }, '开发字段'),
          React.createElement('div', { style: { display: 'grid', gap: '2px' } },
            ...sourceInfos.flatMap((source, idx) => [
              React.createElement('div', { key: `source_workflow_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: tooltipFieldLabelStyle }, '来源工作流'),
                React.createElement('code', { style: tooltipCodeStyle }, source.workflow)
              ),
              source.schedule && React.createElement('div', { key: `source_schedule_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: tooltipFieldLabelStyle }, '执行时间'),
                React.createElement('span', null, source.schedule)
              ),
              source.scope && React.createElement('div', { key: `source_scope_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: tooltipFieldLabelStyle }, '适用站点'),
                React.createElement('span', null, source.scope)
              ),
              React.createElement('div', { key: `source_node_${idx}`, style: tooltipFieldRowStyle },
                React.createElement('span', { style: tooltipFieldLabelStyle }, 'SQL 节点'),
                React.createElement('code', { style: tooltipCodeStyle }, source.node)
              ),
            ].filter(Boolean)),
            ...(!hideFieldMapping ? fields.map((item, idx) => React.createElement('div', {
              key: `field_${idx}`,
              style: tooltipFieldRowStyle,
            },
              React.createElement('span', { style: tooltipFieldLabelStyle }, item.label),
              React.createElement('code', { style: tooltipCodeStyle }, item.field)
            )) : []),
            !hideFieldMapping && React.createElement('div', { style: tooltipFieldRowStyle },
              React.createElement('span', { style: tooltipFieldLabelStyle }, '写回字段'),
              React.createElement('code', { style: tooltipCodeStyle }, writeBackField || '无')
            )
          )
        )
      );
    };

    const getWeeklySummaryTooltipLines = (col) => {
      if (!col || WEEKLY_SUMMARY_TOOLTIP_OWNED_FIELDS.has(col.field)) return [];
      if (col.key === 'daily_country') return ['固定显示“周汇总”。'];
      if (col.key === 'daily_date') return ['按周日到周六划分自然周，显示该周起止日期。'];
      if (col.key === 'daily_promotion_days') return ['按周日作为每周起始日计算自然周编号，显示“第 N 周”。'];
      if (col._dynamicKind === 'keyword') {
        return ['按日期比较本周首个和最后一个有效自然位；任一天为“无”时显示“本周有掉队”，只有一个有效值时显示“仅首日数据”，否则显示上升、下滑或持平。'];
      }
      if (col._dynamicKind || !col.field) return [];

      const field = col.field;
      const label = col.label || field;
      if (WEEKLY_SUMMARY_SUM_FIELDS.has(field)) {
        const emptyText = field === 'flash_sale_total_cost' ? '；全部为空时按 0 计算' : '；全部为空时为空';
        return [`同一国家 + ASIN、同一自然周（周日到周六）内，将每日“${label}”的非空数值求和${emptyText}。`];
      }
      if (WEEKLY_SUMMARY_AVG_FIELDS.has(field)) {
        return [`计算同一自然周内每日“${label}”非空数值的平均值，结果保留 2 位小数；全部为空时为空。`];
      }
      if (WEEKLY_SUMMARY_LAST_FIELDS.has(field)) {
        return [`按日期取本周最后一个非空“${label}”；全部为空时为空。`];
      }
      if (WEEKLY_SUMMARY_DERIVED_TOOLTIP_TEXT[field]) {
        return [WEEKLY_SUMMARY_DERIVED_TOOLTIP_TEXT[field]];
      }
      if (WEEKLY_SUMMARY_LAST_SOURCE_FIELDS.has(field)) {
        return [`按日期取本周最后一个有效“${label}”，必要时从目标默认值或产品配置中补取；全部为空时为空。`];
      }
      return [];
    };

    const renderColumnTooltip = (col, config) => {
      const weeklySummaryLines = [
        ...splitTooltipText(config.weeklySummaryFormula),
        ...getWeeklySummaryTooltipLines(col),
      ];
      if (!weeklySummaryLines.length) return renderTooltip(config);
      return renderTooltip({
        ...config,
        weeklySummaryFormula: weeklySummaryLines,
        salesSectionTitle: config.salesSectionTitle || '日明细口径',
      });
    };

    const getHeaderTooltipText = (col) => {
      if (col._dynamicKind === 'keyword') return renderColumnTooltip(col, {
        title: col.label,
        formula: [
          '数据来源：SIF 最近一次从亚马逊前台抓取的自然排名。',
          '更新时间：每天北京时间 08:00 自动同步。日期取 SIF 返回的该关键词自然排名抓取北京时间，按 ASIN 所属站点转换为当地时间后，只取当地日期写入。',
          '站点时间：美国和加拿大按美西时间，日本按日本时间，德国、法国、西班牙和意大利按中欧时间，英国按英国时间；美西和欧洲会自动计算夏令时。',
          '写入规则：对应日期没有记录时自动创建；自然位为空时自动回填；已有非空值不会被自动覆盖。',
          '提醒：SIF 可能存在抓取延迟或遗漏。如果销售通过其他插件确认有自然位，可直接手动修改本列。',
        ],
        fields: [
          { label: '关键词', field: 'sqp_keywords.keyword_name' },
          { label: '每日自然位', field: 'sqp_keyword_daily_positions.actual_rank' },
        ],
        writeBackField: 'sqp_keyword_daily_positions.actual_rank',
        hideEmptyRules: true,
        salesSectionTitle: '自然位说明',
      });
      if (col._dynamicKind === 'competitor') return renderColumnTooltip(col, {
        title: col._competitorGroupLabel || col.label,
        formula: `引用竞对 ASIN「${col._competitorAsin || '未命名'}」，展示当条 date 的${col._competitorSubLabel || ''}。`,
        fields: [
          { label: '竞对 ASIN', field: 'order_link_competitor_asins.competitor_asin' },
          { label: col._competitorSubLabel || '字段', field: `order_link_competitor_asins_daily.${col._competitorField || 'notes'}` },
        ],
        writeBackField: `order_link_competitor_asins_daily.${col._competitorField || 'notes'}`,
        hideEmptyRules: true,
      });
      if (FIELD_TOOLTIP_DATA[col.field]) return renderColumnTooltip(col, FIELD_TOOLTIP_DATA[col.field]);
      if (col.src === 'weekly' && WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT[col.field]) {
        const weeklyTooltipLines = WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT[col.field].split('\n');
        const isDirectValue = WEEKLY_PERFORMANCE_DIRECT_VALUE_FIELDS.has(col.field);
        const weeklyFormulaLines = [
          isDirectValue ? WEEKLY_PERFORMANCE_SALES_DIRECT_TOOLTIP_TEXT : WEEKLY_PERFORMANCE_SALES_CALCULATED_TOOLTIP_TEXT,
          ...(!isDirectValue && weeklyTooltipLines[0] ? [`计算口径：${weeklyTooltipLines[0]}`] : []),
          col.columnGroup === 'ad_data'
            ? WEEKLY_PERFORMANCE_AD_UPDATE_TOOLTIP_TEXT
            : WEEKLY_PERFORMANCE_UPDATE_TOOLTIP_TEXT,
        ];
        if (col.field === 'reviews_count') {
          weeklyFormulaLines.push(CURRENT_DAY_DATA_TOOLTIP_TEXT);
        }
        return renderColumnTooltip(col, {
          title: col.label,
          formula: weeklyFormulaLines,
          fields: [
            { label: '生成方式', field: isDirectValue ? '定时 RPA 写入数据表' : '定时 RPA 计算后写入数据表' },
            { label: '计算/取值规则', field: weeklyTooltipLines.join('；') || '直接展示该指标值' },
            { label: `数据表字段（${col.label}）`, field: `weekly_performance.${col.field}` },
            { label: '页面 JS 处理', field: '仅读取，不计算、不回写' },
          ],
          writeBackField: `weekly_performance.${col.field}（由定时 RPA 写入）`,
          hideEmptyRules: true,
          salesSectionTitle: '日明细口径',
        });
      }
      const sqlSourceKey = `${col.src}.${col.field}`;
      if (SQL_UPDATED_FIELD_TEXT[sqlSourceKey]) return renderColumnTooltip(col, {
        title: col.label,
        formula: SQL_UPDATED_FIELD_TEXT[sqlSourceKey],
        sourceInfos: SQL_UPDATED_FIELD_SOURCE[sqlSourceKey],
        hideEmptyRules: true,
        hideFieldMapping: true,
      });
      if (FIELD_TOOLTIP_TEXT[col.field]) return renderColumnTooltip(col, {
        title: col.label,
        formula: FIELD_TOOLTIP_TEXT[col.field],
        fields: [{ label: `字段来源（${col.label}）`, field: `${SRC_TABLE_LABEL[col.src] || col.src}.${col.field}` }],
        writeBackField: `${SRC_TABLE_LABEL[col.src] || col.src}.${col.field}`,
        hideEmptyRules: true,
      });
      return renderColumnTooltip(col, {
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
              onClick: (e) => e.stopPropagation(),
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
            onClick: (e) => e.stopPropagation(),
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
      if (col.field === 'order_structure_diagnostic') return React.createElement(Select, { ref: inputRef, value: editValue || undefined, options: ORDER_STRUCTURE_DIAGNOSED_OPTIONS, style: { width: '100%' }, size: 'small', onChange: (v) => { setEditValue(v); saveEdit(v); }, onBlur: () => { if (editValue) saveEdit(); else cancelEdit(); }, onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); } });
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
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 } },
            React.createElement('span', null, '列设置'),
            React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#8c8c8c', fontWeight: 400 } }, '（自定义视图中 关于“列设置”的调整会自动保存）')
          ),
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
            React.createElement('button', { disabled: !currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching, title: currentUserId ? (columnViewCreating ? '保存中' : '复制并保存为新视图') : '未识别到当前用户，无法保存视图', 'aria-label': currentUserId ? (columnViewCreating ? '保存中' : '复制并保存为新视图') : '未识别到当前用户，无法保存视图', onClick: () => createColumnViewFromCurrent(), style: { ...iconButtonStyle({ disabled: !currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching, bg: '#1677ff', disabledBg: '#93c5fd', color: '#fff', disabledColor: '#fff' }), width: '120px', padding: '0 10px', fontSize: `${FONT_SIZE_SM}px`, whiteSpace: 'nowrap' } }, columnViewCreating ? '保存中...' : '复制视图')
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
    const pinnedCols = visibleCols.filter((col) => col.pinned);
    const nonPinnedCols = visibleCols.filter((col) => !col.pinned);
    const pinnedWidth = pinnedCols.reduce((sum, col) => sum + (col.width || 80), 0);
    const visibleColumnIndexMap = Object.fromEntries(visibleCols.map((col, index) => [col.key, index]));
    const canCompositePinnedCells = pinnedCols.length > 1
      && visibleCols.slice(0, pinnedCols.length).every((col) => col.pinned)
      && pinnedCols.every((col) => (
        !col._isCompetitorSubColumn && !MERGED_WEEKLY_DISPLAY_FIELDS.has(col.field)
      ));
    const pinnedGridTemplate = pinnedCols.map((col) => `${col.width || 80}px`).join(' ');

    const renderRegularHeaderCell = (col, nested = false) => {
      const isPinned = col.pinned;
      const leftOff = isPinned ? pinnedLeftMap[col.key] : undefined;
      const hdrColor = getColHeaderColor(col);
      const isHighlighted = highlightColumnKey === col.key;
      return React.createElement(nested ? 'div' : 'th', {
        rowSpan: nested ? undefined : (hasCompetitorColumns ? 2 : 1),
        key: col.key,
        draggable: true,
        onDragStart: (e) => onDragStart(e, col.key),
        onDragOver,
        onDrop: (e) => onDrop(e, col.key),
        onClick: () => handleSort(col.key),
        style: {
          position: nested ? 'relative' : 'sticky',
          top: nested ? undefined : `${HEADER_GROUP_HEIGHT}px`,
          left: nested ? undefined : (isPinned ? `${leftOff}px` : undefined),
          zIndex: nested ? undefined : (isPinned ? 4 : 2),
          width: `${col.width || 80}px`,
          minWidth: nested ? 0 : undefined,
          height: nested ? '100%' : undefined,
          padding: '5px 16px 5px 6px',
          background: isHighlighted ? '#FFF1B8' : hdrColor,
          color: getTextColorForBg(hdrColor),
          borderBottom: '2px solid rgba(0,0,0,0.12)',
          borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
          textAlign: 'center',
          fontWeight: 600,
          fontSize: `${FONT_SIZE_SM}px`,
          userSelect: 'none',
          cursor: 'pointer',
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
    };

    const renderBodyCell = (row, rIdx, rowId, isSummaryRow, col, cIdx, nested = false) => {
      const isPinned = col.pinned;
      const leftOff = isPinned ? pinnedLeftMap[col.key] : undefined;
      const dynFn = DYNAMIC_COLOR[col.field] || DYNAMIC_COLOR[col.key];
      const cellColor = isSummaryRow ? '#0f172a' : (dynFn ? dynFn(row) : null);
      const canEdit = !isSummaryRow && isCellEditable(col);
      const isEditing = editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key;
      const selected = isCellSelected(rIdx, cIdx);
      const isSelectionInputCell = selectionInputValue !== '' && selected && canEdit;
      const isHighlighted = highlightColumnKey === col.key;
      const isCrossHighlighted = isActiveCrossCell(rIdx, cIdx);
      const importantCellKey = getImportantCellKey(row, col);
      const isImportantCell = !!importantCellKey && importantCellKeySet.has(importantCellKey);
      const bodyCellBackground = getBodyCellBackground(rIdx, cIdx, selected, col);
      const cellBackground = isSummaryRow
        ? WEEKLY_SUMMARY_BG
        : (isHighlighted
          ? '#FFF7D6'
          : ((selected || isCrossHighlighted) ? bodyCellBackground : (isImportantCell ? IMPORTANT_CELL_BACKGROUND : bodyCellBackground)));
      const cellBoxShadow = selected
        ? 'inset 0 0 0 2px #1677ff'
        : (isHighlighted
          ? 'inset 0 0 0 2px #faad14'
          : (isCrossHighlighted
            ? (isPinned ? '1px 0 0 rgba(0,0,0,0.05)' : undefined)
            : (isImportantCell
              ? `inset 0 0 0 2px ${IMPORTANT_CELL_BORDER}`
              : (isPinned ? '1px 0 0 rgba(0,0,0,0.05)' : undefined))));
      const weeklyMergedCell = !isSummaryRow && MERGED_WEEKLY_DISPLAY_FIELDS.has(col.field)
        ? weeklyMergedCellMap[rowId]?.[col.key]
        : null;
      const isWeeklyMergedDisplayCell = Boolean(weeklyMergedCell);
      if (isWeeklyMergedDisplayCell && weeklyMergedCell.rowSpan === 0) return null;

      const elementType = nested ? 'div' : 'td';
      const position = nested ? 'relative' : (isPinned ? 'sticky' : 'relative');
      const left = nested ? undefined : (isPinned ? `${leftOff}px` : undefined);
      const zIndex = nested ? undefined : (isPinned ? 1 : undefined);
      const sharedSizeStyle = nested ? { width: `${col.width || 80}px`, minWidth: 0, height: '100%' } : {};

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

        return React.createElement(elementType, {
          key: col.key,
          rowSpan: nested ? undefined : (weeklyMergedCell?.rowSpan || undefined),
          onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx, row, col),
          onDoubleClickCapture: openRichEditorFromCell,
          onMouseEnter: (e) => handleCellMouseEnter(e, rIdx, cIdx),
          style: {
            ...sharedSizeStyle,
            position,
            left,
            zIndex,
            background: cellBackground,
            padding: '2px',
            borderBottom: '1px solid #e8e8e8',
            borderRight: isPinned ? '2px solid rgba(0,0,0,0.18)' : '1px solid #e8e8e8',
            textAlign: 'center',
            verticalAlign: 'middle',
            boxSizing: 'border-box',
            userSelect: 'none',
            boxShadow: cellBoxShadow,
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
          React.createElement(ImportantCellMarker, { visible: isImportantCell }),
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

      return React.createElement(elementType, {
        key: col.key,
        rowSpan: nested ? undefined : (weeklyMergedCell?.rowSpan || undefined),
        title: typeof renderedContent === 'string' ? renderedContent : (typeof displayContent === 'string' ? displayContent : undefined),
        onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx, row, col),
        onDoubleClick: () => {
          if (!canEdit || isEditing) return;
          const currentValue = getCellValue(col, row);
          if (editingCell || saving) {
            pendingCellInteractionRef.current = { r: rIdx, c: cIdx, rowId, col, currentValue, openEditor: true };
            return;
          }
          startEdit(rowId, col, currentValue);
        },
        style: {
          ...sharedSizeStyle,
          position,
          left,
          zIndex,
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
          boxShadow: cellBoxShadow,
        },
        onMouseEnter: (e) => {
          handleCellMouseEnter(e, rIdx, cIdx);
          if (canEdit && !isEditing) e.currentTarget.style.outline = '1px dashed #1890ff';
        },
        onMouseLeave: canEdit && !isEditing ? (e) => { e.currentTarget.style.outline = '1px dashed transparent'; } : undefined,
      },
        isEditing ? renderEditInput(col) : renderedContent,
        React.createElement(ImportantCellMarker, { visible: isImportantCell }),
        React.createElement(SelectionOverlay, {
          store: selectionStore,
          rowIndex: rIdx,
          columnIndex: cIdx,
        })
      );
    };
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
    const weeklyImportModal = React.createElement(Modal, {
      title: '导入每日数据',
      open: weeklyImportVisible,
      visible: weeklyImportVisible,
      onCancel: closeWeeklyImport,
      width: 780,
      maskClosable: !weeklyImportBusy && !weeklyImportTemplateBuilding,
      destroyOnClose: true,
      footer: [
        React.createElement(Button, { key: 'cancel', onClick: closeWeeklyImport, disabled: weeklyImportBusy || weeklyImportTemplateBuilding }, '取消'),
        React.createElement(Button, {
          key: 'preflight',
          onClick: preflightDailyImport,
          loading: weeklyImportBusy && !weeklyImportPreview,
          disabled: weeklyImportBusy || weeklyImportTemplateBuilding || !weeklyImportFileList.length,
        }, '线上预检'),
        React.createElement(Button, {
          key: 'execute',
          type: 'primary',
          onClick: executeDailyImport,
          loading: weeklyImportBusy && Boolean(weeklyImportPreview),
          disabled: weeklyImportBusy || !weeklyImportPreview,
          icon: UploadOutlined ? React.createElement(UploadOutlined) : null,
        }, '正式导入'),
      ],
    },
      React.createElement('div', { style: { display: 'grid', gap: '14px' } },
        React.createElement('section', null,
          React.createElement('div', { style: { marginBottom: 8, color: '#262626', fontWeight: 700 } }, '1. 下载固定模板'),
          React.createElement('div', { style: { display: 'flex', gap: 8, flexWrap: 'wrap' } },
            React.createElement(Button, {
              type: 'primary',
              href: weeklyImportTemplateHref || undefined,
              download: '每日数据历史导入通用模板.xlsx',
              loading: weeklyImportTemplateBuilding,
              disabled: !filterCountry || !filterAsin || weeklyImportBusy || weeklyImportTemplateBuilding || !weeklyImportTemplateHref,
              icon: DownloadOutlined ? React.createElement(DownloadOutlined) : null,
            }, '生成并下载模版')
          )
        ),
        React.createElement('section', null,
          React.createElement('div', { style: { marginBottom: 8, color: '#262626', fontWeight: 700 } }, '2. 选择填写后的 Excel'),
          React.createElement(Upload, {
            accept: '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            maxCount: 1,
            fileList: weeklyImportFileList,
            beforeUpload: (file) => {
              if (!/\.xlsx$/i.test(file?.name || '')) {
                ctx.message.error('只支持 XLSX 文件');
                return Upload.LIST_IGNORE || false;
              }
              setWeeklyImportFileList([file]);
              setWeeklyImportPreview(null);
              setWeeklyImportProgress('');
              return false;
            },
            onRemove: () => {
              if (weeklyImportBusy) return false;
              setWeeklyImportFileList([]);
              setWeeklyImportPreview(null);
              setWeeklyImportProgress('');
              return true;
            },
            disabled: weeklyImportBusy || weeklyImportTemplateBuilding,
          }, React.createElement(Button, {
            icon: UploadOutlined ? React.createElement(UploadOutlined) : null,
            disabled: weeklyImportBusy || weeklyImportTemplateBuilding,
          }, '选择 Excel 文件'))
        ),
        weeklyImportProgress && React.createElement('div', {
          style: {
            padding: '9px 12px',
            border: `1px solid ${weeklyImportPreview ? '#b7eb8f' : '#d9d9d9'}`,
            borderRadius: 6,
            background: weeklyImportPreview ? '#f6ffed' : '#fafafa',
            color: weeklyImportPreview ? '#135200' : '#595959',
            fontWeight: 600,
          },
        }, weeklyImportProgress),
        weeklyImportPreview && React.createElement('section', {
          style: { padding: '12px', border: '1px solid #b7eb8f', borderRadius: 6, background: '#f6ffed' },
        },
          React.createElement('div', { style: { marginBottom: 8, color: '#135200', fontWeight: 800 } }, '线上预检结果'),
          React.createElement('div', { style: { display: 'grid', gap: 4, color: '#3f6600' } },
            React.createElement('div', null, `国家：${weeklyImportPreview.country}`),
            React.createElement('div', null, `ASIN：${weeklyImportPreview.asin}`),
            React.createElement('div', null, `数据日期：${weeklyImportPreview.startDate === weeklyImportPreview.endDate
              ? weeklyImportPreview.startDate
              : `${weeklyImportPreview.startDate} 至 ${weeklyImportPreview.endDate}`}`),
            React.createElement('div', null, `有效数据：${weeklyImportPreview.rows.length}行`),
            React.createElement('div', { style: { overflowWrap: 'anywhere' } }, `有效列：${(weeklyImportPreview.effectiveColumns || []).join('、') || '无'}`)
          )
        )
      )
    );
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
    const actionBusy = loading || refreshingData || calcLoading || weeklyImportBusy || weeklyImportTemplateBuilding;
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
      weeklyImportModal,
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
          React.createElement('button', {
            type: 'button',
            onClick: openWeeklyImport,
            disabled: actionBusy,
            title: '导入每日数据',
            style: {
              ...btnStyle('#EB6793', '#fff', '#d84f7c'),
              opacity: actionBusy ? 0.6 : 1,
              cursor: actionBusy ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
            },
          }, UploadOutlined ? React.createElement(UploadOutlined) : null, '导入数据'),
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
        onKeyUp: handleKeyUp,
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
        onKeyUp: handleKeyUp,
        onDragOver: onTableDragOver,
        onMouseUp: stopSelecting,
        onMouseLeave: stopSelecting,
        style: { overflowX: 'auto', overflowY: 'auto', height: tableWrapHeight, borderRadius: '8px', border: '1px solid #d9d9d9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', background: '#fff', outline: 'none', willChange: 'scroll-position' }
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
                canCompositePinnedCells && React.createElement('colgroup', null,
                  visibleCols.map((col) => React.createElement('col', { key: `col_${col.key}`, style: { width: `${col.width || 80}px` } }))
                ),
                React.createElement('thead', null,
                  React.createElement('tr', null,
                    canCompositePinnedCells && React.createElement('th', {
                      colSpan: pinnedCols.length,
                      rowSpan: hasCompetitorColumns ? 2 : 1,
                      style: {
                        position: 'sticky',
                        top: `${HEADER_GROUP_HEIGHT}px`,
                        left: 0,
                        zIndex: 4,
                        width: `${pinnedWidth}px`,
                        height: `${HEADER_MAIN_HEIGHT + (hasCompetitorColumns ? HEADER_SUB_HEIGHT : 0)}px`,
                        padding: 0,
                        background: '#fff',
                        verticalAlign: 'middle',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                      },
                    },
                      React.createElement('div', {
                        style: {
                          position: 'absolute',
                          inset: 0,
                          display: 'grid',
                          gridTemplateColumns: pinnedGridTemplate,
                          width: `${pinnedWidth}px`,
                          height: '100%',
                          alignItems: 'stretch',
                        },
                      }, pinnedCols.map((col) => renderRegularHeaderCell(col, true)))
                    ),
                    (canCompositePinnedCells ? nonPinnedCols : visibleCols).map((col) => {
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

                      return renderRegularHeaderCell(col);
                    })
                  ),
                  hasCompetitorColumns && React.createElement('tr', null,
                    (canCompositePinnedCells ? nonPinnedCols : visibleCols).map((col) => {
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
                      canCompositePinnedCells && React.createElement('td', {
                        colSpan: pinnedCols.length,
                        style: {
                          position: 'sticky',
                          left: 0,
                          zIndex: 1,
                          width: `${pinnedWidth}px`,
                          height: '1px',
                          padding: 0,
                          background: isSummaryRow ? WEEKLY_SUMMARY_BG : (rIdx % 2 === 0 ? '#fff' : '#fafafa'),
                          verticalAlign: 'middle',
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                        },
                      },
                        React.createElement('div', {
                          style: {
                            display: 'grid',
                            gridTemplateColumns: pinnedGridTemplate,
                            width: `${pinnedWidth}px`,
                            height: '100%',
                            alignItems: 'stretch',
                          },
                        }, pinnedCols.map((col) => renderBodyCell(
                          row,
                          rIdx,
                          rowId,
                          isSummaryRow,
                          col,
                          visibleColumnIndexMap[col.key],
                          true,
                        )))
                      ),
                      canCompositePinnedCells && nonPinnedCols.map((col) => renderBodyCell(
                        row,
                        rIdx,
                        rowId,
                        isSummaryRow,
                        col,
                        visibleColumnIndexMap[col.key],
                      )),
                      !canCompositePinnedCells && visibleCols.map((col, cIdx) => renderBodyCell(
                        row,
                        rIdx,
                        rowId,
                        isSummaryRow,
                        col,
                        cIdx,
                      ))
                    );
                  })
                )
              )
            )
      ),

      // 分页
      React.createElement('div', { style: { marginTop: '6px', padding: '0 2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' } },
        React.createElement('div', {
          style: { flex: '1 1 420px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px', color: '#64748B', fontSize: '12px', lineHeight: '20px' },
        },
          React.createElement('span', null, '① 标注重点：选中单元格（支持多选）后按 Alt 键标注，再按Alt 键取消标注；'),
          React.createElement('span', null, '② 快捷写入：单击选中单元格 直接输入数字后，按 Enter 写入。'),
        ),
        React.createElement(Pagination, {
          current: curPage, pageSize, total,
          locale: PAGINATION_LOCALE,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`,
          onChange: onPageChange,
          onShowSizeChange: onPageChange,
          disabled: loading,
          style: { marginLeft: 'auto' },
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
