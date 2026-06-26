async function run() {
  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Drawer, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const DEFAULT_COLUMNS_KEY = `${BLOCK_UID}__default_columns`;
  const BLOCK_NAME       = '核心板块';
  const BLOCK_NAME_SETTING_KEY = `${BLOCK_UID}__block_name`;
  const COLUMN_GROUP_ORDER_KEY = '__column_group_order';
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
  const readGlobal     = () => ctx.engine[GLOBAL_KEY] || null;
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

  const getColHeaderColor = (col) => col.headerColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;

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
    { key:'weekly_order_items',                 src:'weekly', field:'order_items',                  label:'实际总单量',      hidden:false, pinned:true, width:80,  editable:false, columnGroup:'fixed' },
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
    { key:'weekly_zongcvr',                     src:'weekly', field:'zongcvr',                      label:'会话转化率',  hidden:false, pinned:false, width:80,  editable:false, columnGroup:'traffic_conversion' },
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
    { key:'weekly_natural_single_ratio',        src:'weekly', field:'natural_single_ratio',         label:'纯站内自然单占比',      hidden:false, pinned:false, width:120, editable:false, columnGroup:'ad_data' },
    { key:'weekly_impressions',                 src:'weekly', field:'impressions',                  label:'曝光量',          hidden:false, pinned:false, width:80,  editable:false, columnGroup:'ad_data' },
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

  const MONEY_FIELDS = new Set(['daily_price','list_price','price_after_discount','review_discounted_price','review_actual_price','net_price_without_tax','gross_revenue_local','net_revenue_local','net_profit_local','cumulative_break_even','unit_profit_local','unit_profit_after_ad_local','unit_profit_rmb','product_cost_total','review_refund_total','review_refund_cost','review_refund_per_unit','review_unit_profit','offsite_commission_cost','offsite_cost_per_order','coupon_total_cost','flash_sale_price','flash_sale_total_cost','flash_sale_cost_per_order','ads_sp_cost','ads_sp_sales','ads_sd_cost','ads_sd_sales','shared_ads_sb_cost','shared_ads_sb_sales','shared_ads_sbv_cost','shared_ads_sbv_sales','guanggaohuafei','ad_direct_sales_amount','ad_sales_amount']);
  const RATE_FIELDS = new Set(['off','real_session_conversion_rate','order_link_real_session_conversion_rate','page_view_conversion_rate','review_orders_ratio','formula_review_rate','offsite_orders_ratio','onsite_orders_ratio','onsite_organic_orders_ratio','onsite_ad_orders_ratio','sp_orders_ratio','sd_orders_ratio','sb_orders_ratio','sbv_orders_ratio','zongcvr','guanggaocvr','volume_cvr','acos','tacos','natural_traffic_proportion','return_rate','return_goods_rate','profit_margin','product_cost_ratio','ad_cost_ratio','review_cost_ratio','coupon_order_ratio_estimated','ctr','adv_rate','natural_single_ratio']);
  const NUM_FIELDS = new Set(['star_rating','number_of_comments','promotion_days','promo_days_40d','promo_days_90d','lp_duration_days','rsg_number','target_gap','target_order_qty','target_subcategory_rank','sales','zirandan','guanggaodan','order_items','ranking','ad_direct_order_quantity','indirect_order_volume','impressions','page_views_total','organic_traffic','return_count','return_goods_count','flash_sale_qty','flash_sale_days','prev_rank','reviews_count','promotion_volume','b2b_volume','sessions','sessions_mobile','zongliuliang','guanggaodianji','zirandianji','cpu','cpa','cpc','cpo','page_views','page_views_mobile','offsite_bg_orders','offsite_xx_orders','offsite_acc_orders','total_offsite_orders','total_onsite_orders','onsite_organic_orders','onsite_ad_orders']);
  const DATE_FIELDS = new Set(['date','updatedAt']);
  const ALL_NUMERIC = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

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
  const COMPETITOR_SUB_FIELDS = [
    { key: 'rank', label: '排名', width: 110, headerColor: '#EB6793' },
    { key: 'notes', label: '操作分析', width: 220, headerColor: '#F2BABA' },
  ];
  const isDynamicColumnKey = (key) => {
    return String(key || '').startsWith('kw_actual_') || String(key || '').startsWith('competitor_dynamic_');
  };
  const isColumnSettingMetaKey = (key) => key === COLUMN_GROUP_ORDER_KEY;
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

  const SQL_UPDATED_FIELD_TEXT = {
    'daily.date': '每天自动生成从今天起未来 3 个月的日期。',
    'daily.activity_annotation': '自动匹配 BD/LD 活动日期，活动当天显示活动类型。',
    'daily.daily_price': '每天自动同步昨日购物车价格：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.list_price': '每天自动同步昨日 LP/WP/TP：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.star_rating': '每天自动同步昨日星级：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.number_of_comments': '每天自动同步昨日 Review 数量：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.selling_accounts': '每天自动同步昨日售卖账号：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.promotion_days': '按该 ASIN/国家的首单日期计算推广天数：非 US/CA 早上 8:30，US/CA 中午 1:00。',
  };

  const SQL_UPDATED_FIELD_SOURCE = {
    'daily.date': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    'daily.activity_annotation': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '3更新 活动标注' }],
    'daily.daily_price': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.list_price': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.star_rating': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.number_of_comments': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.selling_accounts': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.promotion_days': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
  };

  const FIELD_TOOLTIP_DATA = {
    target_gap: {
      title: '目标差距',
      formula: '实际总单量 - 目标拆解 - 单量。',
      emptyRules: ['实际总单量为空', '目标拆解 - 单量为空'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
        { label: '目标拆解 - 单量', field: 'target_management.target_order_qty' },
      ],
      writeBackField: 'daily_asins.target_gap',
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
    total_onsite_orders: {
      title: '②站内:纯自然+广告单',
      formula: '实际总单量 - ①测评单。',
      emptyRules: ['实际总单量为空', '①测评单为空'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.formula_review_rate',
    },
    onsite_orders_ratio: {
      title: '②站内:纯自然+广告单占比',
      formula: '②站内:纯自然+广告单 ÷ 实际总单量。',
      emptyRules: ['②站内:纯自然+广告单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '②站内:纯自然+广告单', field: 'daily_order_link_tracking.total_onsite_orders' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_orders_ratio',
    },
    onsite_organic_orders_ratio: {
      title: '③站内纯自然单占比',
      formula: '③站内纯自然单 ÷ 实际总单量。',
      emptyRules: ['③站内纯自然单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '③站内纯自然单', field: 'daily_order_link_tracking.onsite_organic_orders' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
      ],
      writeBackField: 'daily_order_link_tracking.onsite_organic_orders_ratio',
    },
    onsite_ad_orders_ratio: {
      title: '④站内总广告单占比',
      formula: '④站内总广告单 ÷ 实际总单量。',
      emptyRules: ['④站内总广告单为空', '实际总单量为空或为 0'],
      fields: [
        { label: '④站内总广告单', field: 'daily_order_link_tracking.onsite_ad_orders' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
      formula: '（实际总单量 - ①测评单）× 成交额-去掉税费（按折后售价匹配） + ①测评单 × 成交额-去掉税费（按测评折后价匹配）。',
      emptyRules: ['实际总单量为空', '折后售价未匹配到成交额-去掉税费', '①测评单不为 0 时，测评折后价未匹配到成交额-去掉税费'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '折后售价', field: 'daily_asins.price_after_discount' },
        { label: '测评折后价', field: 'daily_order_link_tracking.review_discounted_price' },
        { label: '按折后售价匹配成交额-去掉税费', field: 'daily_asins.asin_country = pricing_scenarios.asin_country; daily_asins.price_after_discount = pricing_scenarios.price_with_tax; pricing_scenarios.scenario_type = normal; return pricing_scenarios.net_price' },
        { label: '按测评折后价匹配成交额-去掉税费', field: 'daily_asins.asin_country = pricing_scenarios.asin_country; daily_order_link_tracking.review_discounted_price = pricing_scenarios.price_with_tax; pricing_scenarios.scenario_type = review; return pricing_scenarios.net_price' },
      ],
      writeBackField: 'daily_profit.gross_revenue_local',
    },
    net_revenue_local: {
      title: '净销售额（当地币）-算利润',
      formula: '成交额-算费率 - （实际总单量 - ①测评单）× 成交额-去掉税费（按折后售价匹配） × 0.93 × 全新品退款占比。',
      emptyRules: ['成交额-算费率为空', '实际总单量为空', '折后售价未匹配到成交额-去掉税费', '全新品退款占比为空'],
      fields: [
        { label: '成交额-算费率', field: 'daily_profit.gross_revenue_local' },
        { label: '实际总单量', field: 'weekly_performance.order_items' },
        { label: '①测评单', field: 'daily_asins.rsg_number' },
        { label: '折后售价', field: 'daily_asins.price_after_discount' },
        { label: '按折后售价匹配成交额-去掉税费', field: 'daily_asins.asin_country = pricing_scenarios.asin_country; daily_asins.price_after_discount = pricing_scenarios.price_with_tax; pricing_scenarios.scenario_type = normal; return pricing_scenarios.net_price' },
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
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
    order_link_real_session_conversion_rate: {
      title: '真实会话转化率（剔除测评单）',
      formula: '（实际总单量 - ①测评单）÷ 汇总流量-会话量，并保留 4 位小数。',
      emptyRules: ['实际总单量为空', '①测评单为空', '汇总流量-会话量为空或为 0'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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
        { label: '实际总单量', field: 'weekly_performance.order_items' },
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

  const PUSH_PROP_OPTIONS = [
    { label:'显示/隐藏', value:'hidden' }, { label:'固定列', value:'pinned' },
    { label:'列宽', value:'width' }, { label:'表头颜色', value:'headerColor' }, { label:'可编辑', value:'editable' }, { label:'+编辑', value:'richEdit' },
  ];

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
  const WEEKLY_SUMMARY_SCOPE = 'core';
  const WEEKLY_SUMMARY_DATA_FIELD = 'core_summary_data';
  const WEEKLY_SUMMARY_ROW_TYPE = 'weeklySummary';
  const WEEKLY_SUMMARY_BG = '#DDEBF7';
  const WEEKLY_SUMMARY_SUM_FIELDS = new Set([
    'target_order_qty','order_items','target_gap','rsg_number',
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
    'adv_rate','natural_single_ratio','natural_traffic_proportion','ctr','cpc','acos','guanggaocvr','cpa','cpu','tacos',
    'zongcvr','volume_cvr','cpo','order_link_real_session_conversion_rate','real_session_conversion_rate','page_view_conversion_rate',
    'return_rate','return_goods_rate','profit_margin','ad_cost_ratio','review_cost_ratio','product_cost_ratio',
    'offsite_cost_per_order','flash_sale_cost_per_order','unit_profit_local','unit_profit_after_ad_local','unit_profit_rmb',
    'weekly_target_completion_rate',
    'target_ad_cvr_formula','target_cpa_formula','ideal_cpu_by_margin_formula',
    'target_profit_margin_formula','target_ad_spend_rate_formula'
  ]);
  const WEEKLY_SUMMARY_CORE_FIELDS = [];

  const buildColumnPayload = (cols, preserved = []) => [
    ...cols.map((c) => ({ key: c.key, hidden: c.hidden === true, pinned: c.pinned === true, width: Number(c.width) || 80, headerColor: c.headerColor || null, editable: c.editable === true, richEdit: c.richEdit === true })),
    ...preserved,
  ];

  const saveColsToUser = async (cols) => {
    if (!currentUserId) return false;
    try {
      const staticKeys = new Set(INITIAL_COLUMNS.map((c) => c.key));
      const existingSaved = await loadColsFromUser() || [];
      const incomingKeys = new Set(cols.map((c) => c.key).filter(Boolean));
      const preserved = existingSaved.filter((c) => c?.key && !incomingKeys.has(c.key) && (isDynamicColumnKey(c.key) || staticKeys.has(c.key) || isColumnSettingMetaKey(c.key)));
      const colPayload = buildColumnPayload(cols, preserved);
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      await ctx.request({ url: 'users:update', method: 'post', params: { filterByTk: currentUserId }, data: { setting: { ...existingSetting, [BLOCK_UID]: colPayload, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } } });
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

  const getSavedColumnGroupOrder = (saved) => {
    if (!Array.isArray(saved)) return [];
    const item = saved.find((entry) => entry?.key === COLUMN_GROUP_ORDER_KEY);
    return Array.isArray(item?.order) ? item.order.filter(Boolean) : [];
  };

  const saveColumnGroupOrderToUser = async (order) => {
    if (!currentUserId) return false;
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      const existingSaved = Array.isArray(existingSetting[BLOCK_UID]) ? existingSetting[BLOCK_UID] : [];
      const nextSaved = [
        ...existingSaved.filter((item) => item?.key !== COLUMN_GROUP_ORDER_KEY),
        { key: COLUMN_GROUP_ORDER_KEY, order: Array.isArray(order) ? order.filter(Boolean) : [] },
      ];
      await ctx.request({
        url: 'users:update',
        method: 'post',
        params: { filterByTk: currentUserId },
        data: { setting: { ...existingSetting, [BLOCK_UID]: nextSaved, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } },
      });
      return true;
    } catch {
      ctx.message.error('板块顺序保存失败');
      return false;
    }
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
      result.push({ ...initMap[s.key], hidden: s.hidden === true, pinned: s.pinned === true, width: Number(s.width) || initMap[s.key].width, headerColor: migrateLegacyColor(s.headerColor), editable: s.editable === true, richEdit: s.richEdit === true });
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
    const saved = await loadColsFromUser();
    if (saved) return mergeColumnsWithInitial(saved);
    const defaultSaved = await loadDefaultColsFromUser();
    if (defaultSaved) return mergeColumnsWithInitial(defaultSaved);
    return normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true });
  };

  const getCellValue = (col, row) => {
    if (!col || !row) return undefined;
    if (row.__rowType === WEEKLY_SUMMARY_ROW_TYPE) {
      if (col.key === 'daily_country') return '周汇总';
      if (col.key === 'daily_promotion_days') return row.week_no ? `第${row.week_no}周` : '';
      if (col.key === 'daily_date') return row.week_range_label || row.week_no || '';
      const data = row.summary_data || {};
      if (Object.prototype.hasOwnProperty.call(data, col.key)) return data[col.key];
      if (Object.prototype.hasOwnProperty.call(data, col.field)) return data[col.field];
      return undefined;
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
      } else if (col._dynamicKind === 'keyword') {
        value = buildKeywordWeeklyTrend(sortedRows.map((row) => row[col.field]?.daily?.actual_rank));
      } else if (col._dynamicKind) {
        value = null;
      } else if (WEEKLY_SUMMARY_SUM_FIELDS.has(col.field)) {
        value = sumFieldFromRows(sortedRows, col.field, colsByField);
      } else if (WEEKLY_SUMMARY_AVG_FIELDS.has(col.field)) {
        value = avgFieldFromRows(sortedRows, col.field, colsByField);
      } else if (WEEKLY_SUMMARY_LAST_FIELDS.has(col.field)) {
        value = lastValueFromRows(sortedRows, col.field, colsByField);
      } else {
        value = null;
      }
      if (value !== null && value !== undefined && value !== '') {
        summaryData[col.key] = value;
        if (col.field && !Object.prototype.hasOwnProperty.call(summaryData, col.field)) summaryData[col.field] = value;
      }
    });

    const setDerived = (field, value) => {
      if (!WEEKLY_SUMMARY_FORMULA_FIELDS.has(field)) return;
      if (value == null) return;
      summaryData[field] = roundRate(value, 4);
      columnsForSummary.forEach((col) => {
        if (col.field === field) summaryData[col.key] = summaryData[field];
      });
    };
    const setMoneyDerived = (field, value) => {
      if (!WEEKLY_SUMMARY_FORMULA_FIELDS.has(field)) return;
      if (value == null) return;
      summaryData[field] = roundMoney(value);
      columnsForSummary.forEach((col) => {
        if (col.field === field) summaryData[col.key] = summaryData[field];
      });
    };
    const setTextDerived = (field, value) => {
      if (!WEEKLY_SUMMARY_FORMULA_FIELDS.has(field)) return;
      if (value == null) return;
      summaryData[field] = value;
      columnsForSummary.forEach((col) => {
        if (col.field === field) summaryData[col.key] = summaryData[field];
      });
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

    setDerived('review_orders_ratio', safeDivide(summaryData.rsg_number, summaryData.order_items));
    setDerived('offsite_orders_ratio', safeDivide(summaryData.total_offsite_orders, summaryData.order_items));
    setDerived('onsite_orders_ratio', safeDivide(summaryData.total_onsite_orders, summaryData.order_items));
    setDerived('onsite_organic_orders_ratio', safeDivide(summaryData.onsite_organic_orders, summaryData.order_items));
    setDerived('onsite_ad_orders_ratio', safeDivide(summaryData.onsite_ad_orders, summaryData.order_items));
    setDerived('adv_rate', safeDivide(summaryData.guanggaodan, summaryData.order_items));
    setDerived('natural_single_ratio', safeDivide(summaryData.onsite_organic_orders ?? summaryData.zirandan, summaryData.order_items));
    setDerived('natural_traffic_proportion', safeDivide(summaryData.organic_traffic, summaryData.zongliuliang));
    setDerived('ctr', safeDivide(summaryData.guanggaodianji, summaryData.impressions));
    setMoneyDerived('cpc', safeDivide(summaryData.guanggaohuafei, summaryData.guanggaodianji));
    setDerived('acos', safeDivide(summaryData.guanggaohuafei, summaryData.ad_sales_amount));
    setDerived('tacos', safeDivide(summaryData.guanggaohuafei, summaryData.gross_revenue_local));
    setDerived('guanggaocvr', safeDivide(summaryData.guanggaodan, summaryData.guanggaodianji));
    setMoneyDerived('cpa', safeDivide(summaryData.guanggaohuafei, summaryData.guanggaodan));
    setMoneyDerived('cpu', safeDivide(summaryData.guanggaohuafei, summaryData.order_items));
    setDerived('zongcvr', safeDivide(summaryData.order_items, summaryData.zongliuliang));
    setDerived('volume_cvr', safeDivide(summaryData.sales, summaryData.zongliuliang));
    setMoneyDerived('cpo', safeDivide(summaryData.guanggaohuafei, summaryData.order_items));
    setDerived('order_link_real_session_conversion_rate', safeDivide((summaryData.order_items || 0) - (summaryData.rsg_number || 0), summaryData.zongliuliang));
    setDerived('real_session_conversion_rate', summaryData.order_link_real_session_conversion_rate);
    setDerived('page_view_conversion_rate', safeDivide(summaryData.order_items, summaryData.page_views_total));
    setDerived('return_rate', safeDivide(summaryData.return_count, summaryData.order_items));
    setDerived('return_goods_rate', safeDivide(summaryData.return_goods_count, summaryData.order_items));
    setDerived('profit_margin', safeDivide(summaryData.net_profit_local, summaryData.net_revenue_local));
    setDerived('ad_cost_ratio', safeDivide(summaryData.guanggaohuafei, summaryData.gross_revenue_local));
    setDerived('review_cost_ratio', safeDivide(summaryData.review_refund_cost, summaryData.gross_revenue_local));
    setDerived('product_cost_ratio', safeDivide(summaryData.product_cost_total, summaryData.gross_revenue_local));
    setMoneyDerived('offsite_cost_per_order', safeDivide(summaryData.offsite_commission_cost, summaryData.total_offsite_orders));
    setMoneyDerived('flash_sale_cost_per_order', safeDivide(summaryData.flash_sale_total_cost, summaryData.flash_sale_qty));
    setMoneyDerived('unit_profit_after_ad_local', safeDivide(summaryData.net_profit_local, summaryData.order_items));
    const unitProfitLocalNum = toFormulaNumber(summaryData.unit_profit_after_ad_local);
    const exchangeRateNum = toFormulaNumber(summaryData.exchange_rate);
    const unitProfitRmb = unitProfitLocalNum == null || exchangeRateNum == null
      ? null
      : unitProfitLocalNum * exchangeRateNum;
    setMoneyDerived('unit_profit_rmb', unitProfitRmb);
    setDerived('weekly_target_completion_rate', safeDivide(summaryData.order_items, summaryData.target_order_qty));
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

  const DAILY_FORMULA_PATCH_FIELDS = new Set(['off', 'promo_day', 'lp_duration_days', 'promo_days_40d', 'promo_days_90d', 'target_gap']);
  const ORDER_LINK_FORMULA_PATCH_FIELDS = new Set([
    'net_price_without_tax',
    'review_actual_price',
    'total_onsite_orders',
    'onsite_organic_orders',
    'onsite_ad_orders',
    'review_orders_ratio',
    'onsite_orders_ratio',
    'onsite_organic_orders_ratio',
    'onsite_ad_orders_ratio',
    'real_session_conversion_rate',
    'order_link_real_session_conversion_rate',
    'page_view_conversion_rate',
  ]);
  const mergeFormulaPatch = (row, patch) => {
    const dailyPatch = {};
    const orderLinkPatch = {};
    const profitPatch = {};
    Object.entries(patch || {}).forEach(([field, value]) => {
      if (DAILY_FORMULA_PATCH_FIELDS.has(field)) dailyPatch[field] = value;
      else if (ORDER_LINK_FORMULA_PATCH_FIELDS.has(field)) orderLinkPatch[field] = value;
      else profitPatch[field] = value;
    });
    let nextRow = { ...row, ...(patch || {}) };
    if (Object.keys(dailyPatch).length) nextRow = mergeSourcePatch(nextRow, 'daily', dailyPatch);
    if (Object.keys(orderLinkPatch).length) nextRow = mergeSourcePatch(nextRow, 'order_link', orderLinkPatch);
    if (Object.keys(profitPatch).length) nextRow = mergeSourcePatch(nextRow, 'profit', profitPatch);
    return nextRow;
  };

  const formatCell = (col, row) => {
    const v = getCellValue(col, row);
    if (col._dynamicKind === 'keyword') {
      const rank = v?.daily?.actual_rank;
      return rank != null && rank !== '' ? String(rank) : '—';
    }
    if (col._dynamicKind === 'competitor') {
      const value = v?.daily?.[col._competitorField];
      return value != null && value !== '' ? String(value) : '—';
    }
    if (row?.__rowType === WEEKLY_SUMMARY_ROW_TYPE) {
      if (v == null || v === '') return '—';
      if (MONEY_FIELDS.has(col.field)) return Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
      if (RATE_FIELDS.has(col.field)) return formatPercent(v);
      return String(v);
    }
    if (col.field === 'promo_day') return v === 1 || v === '1' || v === true ? '是' : (v === 0 || v === '0' || v === false ? '否' : '—');
    if (col.field === 'order_structure_diagnostic') return ORDER_STRUCTURE_DIAGNOSED_MAP[v] || v || '—';
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

  const renderCellDisplay = (col, row) => {
    const displayContent = formatCell(col, row);
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
        justifyContent: 'flex-end',
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

  const useFloatPos = (btnRef, open) => {
    const [pos, setPos] = useState({ top: 0, left: 0 });
    useEffect(() => {
      if (!open || !btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }, [open]);
    return pos;
  };

  // 推送配置面板
  // 推送配置面板
  // 推送配置面板
  const PushPanel = ({ columns, onClose, anchorPos }) => {
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedProps, setSelectedProps] = useState(['hidden','pinned','width','headerColor','editable','richEdit']);
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
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setPushing(false); }
    }, [userList, selectedProps, columns, buildPayload]);

    return React.createElement('div', {
      style: { position: 'fixed', top: `${anchorPos.top}px`, left: `${anchorPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', width: '380px', fontSize: `${FONT_SIZE}px` },
      onClick: (e) => e.stopPropagation(),
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', null, '📛 推送列配置给其他用户'),
        React.createElement('span', { onClick: onClose, style: { cursor: 'pointer', color: '#999', fontSize: '18px' } }, '×'),
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

  const RichTextImageCell = ({ value, onSave, placeholder = '+' }) => {
    const [content, setContent] = useState(value || '');
    const [isEditing, setIsEditing] = useState(false);
    const [tempContent, setTempContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

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
      if (tempContent !== content) await saveToDatabase(tempContent);
      setIsEditing(false);
    };
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
            setIsEditing(false);
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
    const previewLayer = previewUrl && React.createElement('div', { style: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }, onClick: () => setPreviewUrl(null) },
      React.createElement('img', { src: previewUrl, style: { maxWidth: '95%', maxHeight: '92vh', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.7)' } })
    );
    if (isEditing) {
      return React.createElement('div', { style: { height: '46px', border: '1px solid #1890ff', borderRadius: '6px', padding: '3px', background: '#fff', boxSizing: 'border-box', overflow: 'hidden' } },
        React.createElement('textarea', {
          value: tempContent,
          onChange: (e) => setTempContent(e.target.value),
          onPaste: handlePasteImage,
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
          style: { width: '100%', height: '38px', border: '1px solid #1890ff', borderRadius: '4px', padding: '3px 5px', fontSize: '13px', fontFamily: 'monospace', resize: 'none', background: '#fafafa', lineHeight: '15px', outline: 'none', boxSizing: 'border-box', overflow: 'auto' },
        })
      );
    }
    const isEmpty = !cleanText && imageUrls.length === 0;
    return React.createElement(React.Fragment, null,
      React.createElement('div', { onDoubleClick: () => { setTempContent(content || ''); setIsEditing(true); }, style: { height: '46px', display: 'flex', alignItems: 'center', justifyContent: isEmpty ? 'center' : 'flex-start', gap: '5px', padding: '3px 5px', background: content ? '#fafafa' : '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'cell', overflow: 'hidden', boxSizing: 'border-box' } },
        isEmpty
          ? React.createElement('div', { style: { fontSize: '16px', color: '#999', lineHeight: '18px', fontWeight: 700, textAlign: 'center' } }, placeholder)
          : React.createElement(React.Fragment, null,
              imageUrls.slice(0, 2).map((url, idx) =>
                React.createElement('img', {
                  key: `${url}-${idx}`,
                  src: url,
                  onClick: (e) => { e.stopPropagation(); setPreviewUrl(url); },
                  style: { width: '34px', height: '34px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', flex: '0 0 auto', cursor: 'zoom-in' },
                })
              ),
              cleanText && React.createElement('div', { style: { minWidth: 0, flex: '1 1 auto', fontSize: '12px', color: '#333', lineHeight: '16px', maxHeight: '36px', overflow: 'hidden', textAlign: 'left', whiteSpace: 'pre-wrap', wordBreak: 'break-word' } }, cleanText)
            )
      ),
      previewLayer
    );
  };

  // MergedTable 主组件
  // MergedTable 主组件
  // MergedTable 主组件
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
    const [keywordTab, setKeywordTab]           = useState('keyword');
    const [keywordDraft, setKeywordDraft]       = useState('');
    const [competitorDraft, setCompetitorDraft] = useState('');
    const [competitorNoteDraft, setCompetitorNoteDraft] = useState('');
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [dynamicKeywordCols, setDynamicKeywordCols] = useState([]);
    const [dynamicCompetitorCols, setDynamicCompetitorCols] = useState([]);
    const [weeklySummaryMap, setWeeklySummaryMap] = useState({});
    const [dynamicColumnPrefs, setDynamicColumnPrefs] = useState({});
    const [columnGroupOrder, setColumnGroupOrder] = useState([]);
    const [sortConfig, setSortConfig]           = useState({ key: 'daily_date', dir: 'asc' });
    const [curPage, setCurPage]                 = useState(1);
    const [pageSize, setPageSize]               = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal]                     = useState(0);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [editingCell, setEditingCell]         = useState(null);
    const [editValue, setEditValue]             = useState(null);
    const [saving, setSaving]                   = useState(false);
    const [isResizing, setIsResizing]           = useState(false);
    const [selectedRange, setSelectedRange]     = useState(null);
    const [activeCell, setActiveCell]           = useState(null);
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
    const selectingRef = useRef(false);
    const autoRefreshRef = useRef({ lastAt: 0, wasVisible: null });
    const curPageRef = useRef(curPage);
    const pageSizeRef = useRef(pageSize);
    const dataRef = useRef([]);
    const formulaProgressFinishTimerRef = useRef(null);
    const backgroundCoreSummaryRef = useRef({ timer: null, running: false, pendingForce: false });
    const currentPageCoreSummaryRef = useRef({ timer: null, running: false, pendingRowsByKey: {} });
    const dynamicKeywordColsRef = useRef([]);
    const dynamicCompetitorColsRef = useRef([]);
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

    const getDefaultCollapsedGroups = useCallback(() => Object.fromEntries(
      SRC_GROUP_CONFIG.map((group) => [group.src, true])
    ), []);

    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: !prev[src] })); }, []);

    useEffect(() => { (async () => { const cols = await buildColumns(); setColumns(cols); })(); }, []);
    useEffect(() => {
      (async () => {
        const saved = await loadColsFromUser() || await loadDefaultColsFromUser();
        if (!Array.isArray(saved)) return;
        const prefs = {};
        saved.forEach((item) => {
          if (!isDynamicColumnKey(item?.key)) return;
          const pref = {
            key: item.key,
            hidden: item.hidden === true,
            pinned: item.pinned === true,
            width: Number(item.width) || undefined,
            headerColor: item.headerColor || null,
          };
          if (Object.prototype.hasOwnProperty.call(item, 'richEdit')) pref.richEdit = item.richEdit === true;
          prefs[item.key] = pref;
        });
        setDynamicColumnPrefs(prefs);
        setColumnGroupOrder(getSavedColumnGroupOrder(saved));
      })();
    }, []);
    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);
    useEffect(() => { curPageRef.current = curPage; }, [curPage]);
    useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);
    useEffect(() => { dataRef.current = data; }, [data]);
    useEffect(() => { dynamicKeywordColsRef.current = dynamicKeywordCols; }, [dynamicKeywordCols]);
    useEffect(() => { dynamicCompetitorColsRef.current = dynamicCompetitorCols; }, [dynamicCompetitorCols]);

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
      if (dateFilterType === 'custom') return expandDateRangeToNaturalWeeks(customDateRange);
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
      return expandDateRangeToNaturalWeeks(range);
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
        if (options.mergeMap === true) return {};
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

    const updateDataAndRefreshWeekly = useCallback((updater, cols = INITIAL_COLUMNS, options = {}) => {
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
      if (affectedKeys.size && options.skipWeeklyRefresh !== true) {
        window.setTimeout(() => {
          try {
            refreshWeeklySummariesFromRows(dataRef.current, cols, { summaryKeys: [...affectedKeys] });
          } catch (err) {
            ctx.message.warning(`周汇总刷新失败：${err?.message || ''}`);
          }
        }, 0);
      }
      return safeNextRows;
    }, [getSummaryKeyForRow, refreshWeeklySummariesFromRows]);

    const getDailySort = useCallback(() => {
      if (!sortConfig.key) return 'date';
      const col = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      if (!col || col.src !== 'daily') return 'date';
      return sortConfig.dir === 'desc' ? `-${col.field}` : col.field;
    }, [sortConfig]);

    const estimateTextWidth = (text, fontSize) => String(text ?? '').length * fontSize * 0.62;
    const calcKeywordColWidth = (label) => Math.max(200, Math.min(360, Math.ceil(estimateTextWidth(label, FONT_SIZE_SM) + 48)));

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
        width: col.key.startsWith('kw_actual_')
          ? Math.max(Number(exactPref.width) || 0, autoWidth)
          : (Number(exactPref.width) || autoWidth),
        richEdit: Object.prototype.hasOwnProperty.call(pref, 'richEdit') ? pref.richEdit === true : col.richEdit,
        headerColor: col._dynamicKind === 'competitor'
          ? col.headerColor
          : (Object.prototype.hasOwnProperty.call(pref, 'headerColor') ? pref.headerColor : col.headerColor),
      };
    }, [dynamicColumnPrefs]);

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
            hidden: idx >= 3,
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
              hidden: compIdx !== 0,
              pinned: false,
              width: sub.width,
              editable: isRankField,
              richEdit: !isRankField,
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
              _isCompetitorSubColumn: true,
            });
          });
        });
      return cols;
    }, []);

    const mergeDailyRowsForWeeklySummary = useCallback(async (dailyRows, options = {}) => {
      const sourceDailyRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      if (!sourceDailyRows.length) return { mergedRows: [], summaryCols: [...INITIAL_COLUMNS] };

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
        const dateStr = toDateKey(c.date);
        if (c.competitor_id && dateStr) competitorDailyMap[`${c.competitor_id}_${dateStr}`] = c;
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
            merged[col.field] = { competitor: comp, daily: competitorDailyMap[`${comp.id}_${dateStr}`] || {} };
          });
        }
        return merged;
      });

      return { mergedRows, summaryCols: [...INITIAL_COLUMNS, ...keywordCols, ...competitorCols] };
    }, [fetchAllList, buildDynamicKeywordCols, buildDynamicCompetitorCols]);

    const refreshFullWeeklySummariesForRows = useCallback(async (rows, options = {}) => {
      const sourceRows = (Array.isArray(rows) ? rows : []).filter((row) => row && row.__rowType !== WEEKLY_SUMMARY_ROW_TYPE);
      const affectedKeys = [...new Set(sourceRows.map(getSummaryKeyForRow).filter(Boolean))];
      if (!affectedKeys.length) return {};

      const ranges = sourceRows
        .map((row) => getWeekRangeForDate(row?.date))
        .filter(Boolean);
      const rangeStarts = ranges.map((range) => range.start).filter(Boolean).sort();
      const rangeEnds = ranges.map((range) => range.end).filter(Boolean).sort();
      const asinCountries = [
        ...new Set(
          sourceRows
            .map((row) => row.asin_country || (row.asin && row.country ? `${row.asin}_${row.country}` : ''))
            .filter(Boolean)
        )
      ];
      const filterAnd = [];
      if (currentUserLevel === 1) filterAnd.push({ sale_owner: { $eq: currentUserName } });
      if (asinCountries.length) filterAnd.push({ asin_country: { $in: asinCountries } });
      if (rangeStarts.length) filterAnd.push({ date: { $gte: rangeStarts[0] } });
      if (rangeEnds.length) filterAnd.push({ date: { $lte: rangeEnds[rangeEnds.length - 1] } });

      const fullRowsRaw = await fetchAllList('daily_asins:list', {
        sort: 'date',
        ...(filterAnd.length ? { filter: JSON.stringify({ $and: filterAnd }) } : {}),
      }, Math.max(200, affectedKeys.length * 14));
      const affectedKeySet = new Set(affectedKeys);
      const fullRows = fullRowsRaw.filter((row) => affectedKeySet.has(getSummaryKeyForRow(row)));
      if (!fullRows.length) return {};

      if (options.onProgress) options.onProgress({ label: '正在同步周汇总...', percent: 88 });
      const { mergedRows, summaryCols } = await mergeDailyRowsForWeeklySummary(fullRows, { updateDynamicColumns: options.updateDynamicColumns === true });
      return refreshWeeklySummariesFromRows(mergedRows, summaryCols, { summaryKeys: affectedKeys });
    }, [currentUserLevel, currentUserName, fetchAllList, getSummaryKeyForRow, mergeDailyRowsForWeeklySummary, refreshWeeklySummariesFromRows]);

    function scheduleCurrentPageCoreSummaryRefresh(rows, options = {}) {
      const sourceRows = (Array.isArray(rows) ? rows : []).filter((row) => row && row.__rowType !== WEEKLY_SUMMARY_ROW_TYPE);
      const state = currentPageCoreSummaryRef.current;
      sourceRows.forEach((row) => {
        const key = getSummaryKeyForRow(row);
        if (key) state.pendingRowsByKey[key] = row;
      });
      if (!Object.keys(state.pendingRowsByKey).length) return;
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(async () => {
        state.timer = null;
        if (state.running) {
          scheduleCurrentPageCoreSummaryRefresh([], { delay: 300 });
          return;
        }
        const rowsToRefresh = Object.values(state.pendingRowsByKey);
        state.pendingRowsByKey = {};
        if (!rowsToRefresh.length) return;
        state.running = true;
        try {
          showFormulaProgress({ label: '更新本页汇总...', percent: 18 });
          await refreshFullWeeklySummariesForRows(rowsToRefresh);
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
          if (Object.keys(state.pendingRowsByKey).length) scheduleCurrentPageCoreSummaryRefresh([], { delay: 300 });
        }
      }, Number(options.delay) || 120);
    }

    const updateAndSave = useCallback((updater) => {
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveColsToUser(next);
        return next;
      });
    }, []);

    const recalcAllCoreFormulas = useCallback(async (sourceRows = [], optionsArg = false) => {
      const options = typeof optionsArg === 'object' && optionsArg !== null ? optionsArg : { silent: optionsArg === true };
      const silent = options.silent === true;
      const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
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
        reportProgress('正在读取历史价格...', 12);
        const allDailyRows = await fetchAllByIn('daily_asins:list', 'asin_country', asinCountries, {
          params: { sort: 'date' },
          chunkSize: 50,
          pageSize: 500,
        });
        reportProgress('正在读取试算与关联数据...', 22);
        const pricingScenarioRows = await fetchAllByIn('pricing_scenarios:list', 'asin_country', asinCountries, {
          extraAnd: [{ scenario_type: { $in: ['normal', 'review'] } }],
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const pricingScenarioMap = {};
        pricingScenarioRows.forEach((row) => {
          const lookupKey = toPricingScenarioLookupKey(row?.asin_country || '', row?.price_with_tax, row?.scenario_type);
          if (lookupKey) pricingScenarioMap[lookupKey] = row;
        });
        const allDailyKeys = [...new Set(allDailyRows.map((row) => row?.country_asin_date).filter(Boolean))];
        const existingProfitRows = await fetchAllByIn('daily_profit:list', 'country_asin_date', allDailyKeys.length ? allDailyKeys : keys, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const existingOrderLinkRows = await fetchAllByIn('daily_order_link_tracking:list', 'country_asin_date', keys, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const existingTargetRows = await fetchAllByIn('target_management:list', 'country_asin_date', keys, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const weeklyKeyCandidates = [...new Set(keys)];
        const existingWeeklyRows = await fetchAllByIn('weekly_performance:list', 'country_asin_week', weeklyKeyCandidates, {
          chunkSize: 80,
          pageSize: 500,
        }).catch(() => []);
        const productConfigRows = await fetchAllByIn('product_config:list', 'asin_country', asinCountries, {
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
        const productConfigMap = {};
        productConfigRows.forEach((row) => {
          if (row?.asin_country) productConfigMap[row.asin_country] = row;
        });
        const lpDurationMap = buildLpDurationMap(allDailyRows);
        const promoDays40dMap = buildPromoDaysWindowMap(allDailyRows, 40);
        const promoDays90dMap = buildPromoDaysWindowMap(allDailyRows, 90);
        const allDailyMap = {};
        allDailyRows.forEach((row) => {
          if (row.country_asin_date) allDailyMap[row.country_asin_date] = row;
        });
        const sourceRowsByKey = {};
        rows.forEach((row) => {
          const key = row?.country_asin_date || row?.id;
          if (key) sourceRowsByKey[key] = row;
        });
        const keySet = new Set(keys);
        const dailyRowsByAsinCountry = {};
        allDailyRows.forEach((row) => {
          const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
          const dateKey = toDateKey(row?.date);
          if (!asinCountry || !dateKey) return;
          if (!dailyRowsByAsinCountry[asinCountry]) dailyRowsByAsinCountry[asinCountry] = [];
          dailyRowsByAsinCountry[asinCountry].push(row);
        });

        const updateJobs = [];
        const profitJobsByKey = {};
        const queueProfitUpdate = (key, baseData, fieldUpdates) => {
          if (!profitJobsByKey[key]) profitJobsByKey[key] = { key, updates: { ...baseData } };
          profitJobsByKey[key].updates = { ...profitJobsByKey[key].updates, ...fieldUpdates };
        };
        const orderLinkJobsByKey = {};
        const queueOrderLinkUpdate = (key, baseData, fieldUpdates) => {
          if (!orderLinkJobsByKey[key]) orderLinkJobsByKey[key] = { key, updates: { ...baseData } };
          orderLinkJobsByKey[key].updates = { ...orderLinkJobsByKey[key].updates, ...fieldUpdates };
        };
        const patchMap = {};
        const computedNetProfitMap = {};
        const baseProfitUpdateMap = {};
        keys.forEach((key) => {
          const source = allDailyMap[key] || sourceRowsByKey[key];
          if (!source) return;
          const asinCountry = source?.asin_country || (source?.asin && source?.country ? `${source.asin}_${source.country}` : '');
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
          const orderItems = toFormulaNumber(sourceWeekly.order_items ?? existingWeeklyMap[key]?.order_items ?? source?.order_items);
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
          const adOrders = toFormulaNumber(sourceWeekly.guanggaodan ?? existingWeeklyMap[key]?.guanggaodan ?? source?.guanggaodan);
          const sessions = toFormulaNumber(sourceWeekly.zongliuliang ?? existingWeeklyMap[key]?.zongliuliang ?? source?.zongliuliang);
          const pageViewsTotal = toFormulaNumber(sourceWeekly.page_views_total ?? existingWeeklyMap[key]?.page_views_total ?? source?.page_views_total);
          const totalOnsiteOrders = orderItems == null || rsgNumber == null ? null : roundMoney(orderItems - rsgNumber);
          const onsiteAdOrders = adOrders == null ? null : roundMoney(adOrders);
          const onsiteOrganicOrders = totalOnsiteOrders == null || adOrders == null ? null : roundMoney(totalOnsiteOrders - adOrders);
          const reviewOrdersRatio = rsgNumber == null || orderItems == null || orderItems === 0 ? null : roundRate(rsgNumber / orderItems, 4);
          const onsiteOrdersRatio = totalOnsiteOrders == null || orderItems == null || orderItems === 0 ? null : roundRate(totalOnsiteOrders / orderItems, 4);
          const onsiteOrganicOrdersRatio = onsiteOrganicOrders == null || orderItems == null || orderItems === 0 ? null : roundRate(onsiteOrganicOrders / orderItems, 4);
          const onsiteAdOrdersRatio = onsiteAdOrders == null || orderItems == null || orderItems === 0 ? null : roundRate(onsiteAdOrders / orderItems, 4);
          const realSessionConversionRate = totalOnsiteOrders == null || sessions == null || sessions === 0 ? null : roundRate(totalOnsiteOrders / sessions, 4);
          const pageViewConversionRate = orderItems == null || pageViewsTotal == null || pageViewsTotal === 0 ? null : roundRate(orderItems / pageViewsTotal, 4);
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
          const updates = {
            off: buildDailyOffValue(source),
            promo_day: hasPromoActivity(source) ? 1 : 0,
            lp_duration_days: lpDurationMap[key] ?? null,
            promo_days_40d: promoDays40dMap[key] ?? null,
            promo_days_90d: promoDays90dMap[key] ?? null,
            target_gap: targetGap,
          };
          const sameOff = isFormulaSameValue(source.off, updates.off);
          const samePromoDay = isFormulaSameValue(source.promo_day, updates.promo_day);
          const sameLpDuration = isFormulaSameValue(source.lp_duration_days, updates.lp_duration_days);
          const samePromoDays40d = isFormulaSameValue(source.promo_days_40d, updates.promo_days_40d);
          const samePromoDays90d = isFormulaSameValue(source.promo_days_90d, updates.promo_days_90d);
          const sameTargetGap = isFormulaSameValue(source.target_gap, updates.target_gap);
          if (!(sameOff && samePromoDay && sameLpDuration && samePromoDays40d && samePromoDays90d && sameTargetGap)) {
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

        const profitUpdateJobs = Object.values(profitJobsByKey);
        const orderLinkUpdateJobs = Object.values(orderLinkJobsByKey);
        if (!updateJobs.length && !profitUpdateJobs.length && !orderLinkUpdateJobs.length) {
          if (!silent) ctx.message.warning(`没有可更新的公式数据，已检查 ${keys.length} 条`);
          reportProgress(`公式已检查 ${keys.length} 条，无需写回`, 100);
          return { total: keys.length, success: 0, skipped: keys.length };
        }

        reportProgress(`准备写回 ${updateJobs.length + orderLinkUpdateJobs.length + profitUpdateJobs.length} 条...`, 55);
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
          const percent = updateJobs.length ? 55 + (done / updateJobs.length) * 20 : 75;
          reportProgress(`正在写回日表 ${done}/${updateJobs.length}...`, percent);
        }

        for (let i = 0; i < orderLinkUpdateJobs.length; i += 100) {
          const batch = orderLinkUpdateJobs.slice(i, i + 100);
          const results = await Promise.allSettled(
            batch.map(async (job) => {
              try {
                await ctx.request({
                  url: 'daily_order_link_tracking:update',
                  method: 'post',
                  params: { filterByTk: job.key },
                  data: Object.fromEntries(
                    Object.entries(job.updates).filter(([field]) => !['country_asin_date','asin_country','asin','country','date'].includes(field))
                  ),
                });
              } catch (err) {
                await ctx.request({
                  url: 'daily_order_link_tracking:create',
                  method: 'post',
                  data: withCreateTimestamps(Object.fromEntries(
                    Object.entries(job.updates).filter(([field]) => !['asin_country','asin','country','date'].includes(field))
                  )),
                });
              }
            })
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          const done = Math.min(i + batch.length, orderLinkUpdateJobs.length);
          const percent = orderLinkUpdateJobs.length ? 75 + (done / orderLinkUpdateJobs.length) * 10 : 85;
          reportProgress(`正在写回订单链接 ${done}/${orderLinkUpdateJobs.length}...`, percent);
        }

        for (let i = 0; i < profitUpdateJobs.length; i += 100) {
          const batch = profitUpdateJobs.slice(i, i + 100);
          const results = await Promise.allSettled(
            batch.map(async (job) => {
              try {
                await ctx.request({
                  url: 'daily_profit:update',
                  method: 'post',
                  params: { filterByTk: job.key },
                  data: Object.fromEntries(
                    Object.entries(job.updates).filter(([field]) => !['country_asin_date','asin_country','asin','country','date'].includes(field))
                  ),
                });
              } catch (err) {
                await ctx.request({
                  url: 'daily_profit:create',
                  method: 'post',
                  data: withCreateTimestamps(Object.fromEntries(
                    Object.entries(job.updates).filter(([field]) => !['asin_country','asin','country','date'].includes(field))
                  )),
                });
              }
            })
          );
          successCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
          const done = Math.min(i + batch.length, profitUpdateJobs.length);
          const percent = profitUpdateJobs.length ? 85 + (done / profitUpdateJobs.length) * 10 : 95;
          reportProgress(`正在写回利润 ${done}/${profitUpdateJobs.length}...`, percent);
        }

        const summaryCols = [...INITIAL_COLUMNS, ...dynamicKeywordColsRef.current, ...dynamicCompetitorColsRef.current];
        updateDataAndRefreshWeekly((prev) => prev.map((row) => {
          const key = row.country_asin_date || row.id;
          return patchMap[key] ? mergeFormulaPatch(row, patchMap[key]) : row;
        }), summaryCols, { skipWeeklyRefresh: true });

        if (!silent) {
          if (failCount) ctx.message.warning(`公式计算完成：成功 ${successCount} 条，失败 ${failCount} 条`);
          else ctx.message.success(`公式计算完成：成功 ${successCount} 条`);
        }
        reportProgress(`公式计算完成：成功 ${successCount} 条`, 100);
        return { total: updateJobs.length + orderLinkUpdateJobs.length + profitUpdateJobs.length, success: successCount, skipped: keys.length - Math.max(updateJobs.length, orderLinkUpdateJobs.length, profitUpdateJobs.length) };
      } catch (err) {
        if (!silent) ctx.message.error(`公式计算失败：${err?.message || '未知错误'}`);
        throw err;
      } finally {
        if (!silent) {
          setCalcLoading(false);
          setCalcProgress('');
        }
      }
    }, [fetchAllByIn, updateDataAndRefreshWeekly]);

    async function loadAllDailyRowsForCurrentCountryAsin() {
      if (!filterCountry || !filterAsin) return [];
      const filterAnd = [
        { country: { $eq: filterCountry } },
        { asin: { $eq: filterAsin } },
      ];
      if (currentUserLevel === 1) filterAnd.push({ sale_owner: { $eq: currentUserName } });
      return fetchAllList('daily_asins:list', {
        sort: 'date',
        filter: JSON.stringify({ $and: filterAnd }),
      }, 1000);
    }

    async function ensureCurrentCountryAsinCoreSummaries(options = {}) {
      const reportProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      reportProgress?.({ label: '读取全量数据...', percent: 8 });
      let rows = await loadAllDailyRowsForCurrentCountryAsin();
      if (!rows.length) return {};

      if (options.recalcFormulas !== false) {
        reportProgress?.({ label: '计算日公式...', percent: 18 });
        await recalcAllCoreFormulas(rows, {
          silent: true,
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
      }

      reportProgress?.({ label: '汇总周数据...', percent: 86 });
      const { mergedRows, summaryCols } = await mergeDailyRowsForWeeklySummary(rows, {
        updateDynamicColumns: options.updateDynamicColumns === true,
      });
      reportProgress?.({ label: '写入周汇总...', percent: 94 });
      return refreshWeeklySummariesFromRows(mergedRows, summaryCols);
    }

    function scheduleCurrentCountryAsinCoreSummarySync(options = {}) {
      if (!filterCountry || !filterAsin) return;
      const state = backgroundCoreSummaryRef.current;
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
          await ensureCurrentCountryAsinCoreSummaries({
            force,
            recalcFormulas: options.recalcFormulas !== false,
            updateDynamicColumns: options.updateDynamicColumns === true,
            onProgress: showFormulaProgress,
          });
          finishFormulaProgress('全量同步完成');
        } catch (err) {
          resetFormulaProgress();
          ctx.message.warning(`后台周汇总同步失败：${err?.message || ''}`);
        } finally {
          state.running = false;
          if (state.pendingForce) scheduleCurrentCountryAsinCoreSummarySync({ force: true });
        }
      }, Number(options.delay) || 800);
    }

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
        const dailyRecords = Array.isArray(rDaily?.data?.data) ? rDaily.data.data : [];
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
        const relatedDailyMap = {};
        dailyRecords.forEach((row) => {
          if (row?.country_asin_date) relatedDailyMap[row.country_asin_date] = row;
        });
        const relatedDailyRecords = Object.values(relatedDailyMap);
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
          const dateStr = toDateKey(c.date);
          if (c.competitor_id && dateStr) competitorDailyMap[`${c.competitor_id}_${dateStr}`] = c;
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
                daily: competitorDailyMap[`${comp.id}_${dateStr}`] || {},
              };
            });
          }
          return merged;
        };
        const mergedData = dailyRecords.map(mergeDailyRecord);
        const existingWeeklySummaryRows = candidateSummaryKeys.length
          ? await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', candidateSummaryKeys, {
              chunkSize: 80,
              pageSize: 500,
            }).catch(() => [])
          : [];
        const existingWeeklySummaryMap = {};
        existingWeeklySummaryRows.forEach((row) => {
          const normalized = normalizeWeeklySummaryRecord(row);
          if (normalized) existingWeeklySummaryMap[normalized.country_asin_week_range] = normalized;
        });
        setWeeklySummaryMap(existingWeeklySummaryMap);

        const missingSummaryKeySet = new Set(candidateSummaryKeys.filter((key) => !existingWeeklySummaryMap[key]));

        dataRef.current = mergedData;
        setData(mergedData);
        setTotal(totalCount || mergedData.length);
        const shouldRunBackgroundSummary = !options.skipBackgroundSummary && filterCountry && filterAsin;
        if (!options.skipCurrentPageSummaryRefresh && mergedData.length) {
          scheduleCurrentPageCoreSummaryRefresh(mergedData, {
            delay: (!skipFormula || missingSummaryKeySet.size) ? 80 : 180,
            keepProgressForBackground: shouldRunBackgroundSummary,
          });
        }
        if (shouldRunBackgroundSummary) {
          scheduleCurrentCountryAsinCoreSummarySync({
            force: true,
            showQueuedProgress: !mergedData.length || options.skipCurrentPageSummaryRefresh,
            delay: mergedData.length ? 1000 : ((!skipFormula || missingSummaryKeySet.size) ? 200 : 900),
          });
        }
        return mergedData;
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        dataRef.current = [];
        setData([]);
        setTotal(0);
        return [];
      } finally {
        setLoading(false);
      }
    }, [filterAsin, filterCountry, currentUserName, currentUserLevel, dateFilterType, getDateRange, getDailySort, fetchAllList, fetchAllByIn, buildDynamicKeywordCols, buildDynamicCompetitorCols, normalizeWeeklySummaryRecord, getSummaryKeyForRow, refreshWeeklySummariesFromRows, recalcAllCoreFormulas, showFormulaProgress, finishFormulaProgress, resetFormulaProgress]);

    // 初始加载、筛选或排序变化时重新加载第一页
    useEffect(() => {
      setCurPage(1);
      loadData({ page: 1, size: pageSizeRef.current });
    }, [loadData]);

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

    useEffect(() => {
      const backgroundState = backgroundCoreSummaryRef.current;
      if (backgroundState?.timer) window.clearTimeout(backgroundState.timer);
      backgroundState.timer = null;
      backgroundState.pendingForce = false;
      const currentPageState = currentPageCoreSummaryRef.current;
      if (currentPageState?.timer) window.clearTimeout(currentPageState.timer);
      currentPageState.timer = null;
      currentPageState.pendingRowsByKey = {};
    }, [filterCountry, filterAsin]);

    useEffect(() => () => {
      if (formulaProgressFinishTimerRef.current) window.clearTimeout(formulaProgressFinishTimerRef.current);
      if (backgroundCoreSummaryRef.current?.timer) window.clearTimeout(backgroundCoreSummaryRef.current.timer);
      if (currentPageCoreSummaryRef.current?.timer) window.clearTimeout(currentPageCoreSummaryRef.current.timer);
    }, []);

    const loadFormulaRowsForCurrentCountryAsin = useCallback(async () => {
      if (!filterCountry || !filterAsin) {
        ctx.message.warning('请先筛选到具体国家和 ASIN，再计算核心利润公式');
        return [];
      }
      const dailyFilterAnd = [
        { country: { $eq: filterCountry } },
        { asin: { $eq: filterAsin } },
      ];
      if (currentUserLevel === 1) dailyFilterAnd.push({ sale_owner: { $eq: currentUserName } });
      return fetchAllList('daily_asins:list', {
        sort: 'date',
        filter: JSON.stringify({ $and: dailyFilterAnd }),
      }, 1000);
    }, [currentUserLevel, currentUserName, filterAsin, filterCountry, fetchAllList]);

    const syncCoreFormulasForRows = useCallback(async (changedRows = [], options = {}) => {
      const asinCountries = [
        ...new Set(
          (Array.isArray(changedRows) ? changedRows : [])
            .map((row) => row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : ''))
            .filter(Boolean)
        )
      ];
      if (!asinCountries.length) return;
      const rows = await fetchAllByIn('daily_asins:list', 'asin_country', asinCountries, {
        params: { sort: 'date' },
        chunkSize: 50,
        pageSize: 500,
      });
      await recalcAllCoreFormulas(rows, { silent: true, onProgress: options.onProgress });
    }, [fetchAllByIn, recalcAllCoreFormulas]);

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
        setData((prev) => prev.map((row) => {
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
    }, [couponConfigRecord, couponRatioDraft, currentAsinCountry, loadCouponConfig, loadData]);

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
            sort: type === 'keyword' ? ['id'] : ['role', 'competitor_asin'],
            filter: JSON.stringify({ country_asin: { $eq: currentCountryAsin } }),
          },
        });
        setManagerItems(Array.isArray(res?.data?.data) ? res.data.data : []);
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || '未知错误'}`);
        setManagerItems([]);
      } finally {
        setManagerLoading(false);
      }
    }, [currentCountryAsin]);

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
        saveColsToUser(Object.values(next).filter((item) => isDynamicColumnKey(item?.key)));
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
      try {
        setManagerSaving(true);
        await ctx.request({ url: `${meta.collection}:update`, method: 'post', params: { filterByTk: item.id }, data: { [meta.nameField]: keywordName || null } });
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success('已保存');
      } finally {
        setManagerSaving(false);
      }
    }, [getSqpManagerMeta, keywordTab, refreshAfterManagerChange]);

    const deleteKeyword = useCallback(async (item) => {
      const meta = getSqpManagerMeta();
      try {
        setManagerSaving(true);
        await ctx.request({ url: `${meta.collection}:destroy`, method: 'post', params: { filterByTk: item.id } });
        await refreshAfterManagerChange(keywordTab);
        ctx.message.success(`已删除${meta.title}`);
      } finally {
        setManagerSaving(false);
      }
    }, [getSqpManagerMeta, keywordTab, refreshAfterManagerChange]);

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

    // 翻页并请求当前页
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
      const insertCompetitorAfter = baseColumns.findIndex((c) => c.key === 'weekly_ranking');
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
          : normalizeColumnsByGroup(INITIAL_COLUMNS.map((c) => ({ ...c })), { sortWithinGroups: true });
        const nextDynamicPrefs = {};
        if (Array.isArray(defaultPayload)) {
          defaultPayload.forEach((item) => {
            if (!isDynamicColumnKey(item?.key)) return;
            const pref = {
              key: item.key,
              hidden: item.hidden === true,
              pinned: item.pinned === true,
              width: Number(item.width) || undefined,
              headerColor: item.headerColor || null,
            };
            nextDynamicPrefs[item.key] = pref;
          });
        }
        setDynamicColumnPrefs(nextDynamicPrefs);
        setColumnGroupOrder(getSavedColumnGroupOrder(defaultPayload));
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
        saveColsToUser(Object.values(next).filter((item) => isDynamicColumnKey(item?.key)));
        return next;
      });
    }, []);

    const updateDynamicCol = (key, updater) => {
      const setFn = key.startsWith('kw_actual_') ? setDynamicKeywordCols : key.startsWith('competitor_dynamic_') ? setDynamicCompetitorCols : null;
      if (!setFn) return false;
      setFn((prev) => prev.map((c) => c.key === key ? updater(c) : c));
      return true;
    };

    const toggleCol      = (key) => { const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, hidden: !c.hidden }))) { persistDynamicColPrefs(key, { hidden: !(cur?.hidden === true), width: cur?.width, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null }); return; } updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => c.key === key ? { ...c, hidden: !c.hidden } : c))); };
    const togglePin      = (key) => { const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, pinned: !c.pinned }))) { persistDynamicColPrefs(key, { pinned: !(cur?.pinned === true), width: cur?.width, hidden: cur?.hidden === true, headerColor: cur?.headerColor || null }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c)); };
    const setHColor      = (key, color) => { const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, headerColor: color }))) { persistDynamicColPrefs(key, { headerColor: color, width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c)); };
    const clearHColor    = (key) => { const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, headerColor: null }))) { persistDynamicColPrefs(key, { headerColor: null, width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c)); };
    const toggleEditable = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c));
    const toggleRichEdit = (key) => { const cur = allColumns.find((c) => c.key === key); if (updateDynamicCol(key, (c) => ({ ...c, richEdit: c.richEdit !== true }))) { persistDynamicColPrefs(key, { richEdit: !(cur?.richEdit === true), width: cur?.width, hidden: cur?.hidden === true, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null }); return; } updateAndSave((p) => p.map((c) => c.key === key ? { ...c, richEdit: !c.richEdit } : c)); };
    const setDynamicHiddenBySrc = (src, hidden) => {
      const updateSet = (setFn) => setFn((prev) => prev.map((c) => {
        if (c.src !== src) return c;
        persistDynamicColPrefs(c.key, { hidden, width: c.width, pinned: c.pinned === true, headerColor: c.headerColor || null });
        return { ...c, hidden };
      }));
      updateSet(setDynamicKeywordCols);
      updateSet(setDynamicCompetitorCols);
    };
    const setDynamicHiddenByGroup = (groupKey, hidden) => {
      const updateSet = (setFn) => setFn((prev) => prev.map((c) => {
        if (getColumnGroupKey(c) !== groupKey) return c;
        persistDynamicColPrefs(c.key, { hidden, width: c.width, pinned: c.pinned === true, headerColor: c.headerColor || null, richEdit: c.richEdit === true });
        return { ...c, hidden };
      }));
      updateSet(setDynamicKeywordCols);
      updateSet(setDynamicCompetitorCols);
    };
    const selectAll      = () => { updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => ({ ...c, hidden: false })))); setDynamicHiddenBySrc('keyword_position', false); setDynamicHiddenBySrc('competitor', false); };
    const deselectAll    = () => { updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => ({ ...c, hidden: true  })))); setDynamicHiddenBySrc('keyword_position', true); setDynamicHiddenBySrc('competitor', true); };
    const selectGroup    = (src) => { if (src === 'keyword_position' || src === 'competitor') { setDynamicHiddenBySrc(src, false); return; } setDynamicHiddenByGroup(src, false); updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => getColumnGroupKey(c) === src ? { ...c, hidden: false } : c))); };
    const deselectGroup  = (src) => { if (src === 'keyword_position' || src === 'competitor') { setDynamicHiddenBySrc(src, true); return; } setDynamicHiddenByGroup(src, true); updateAndSave((p) => normalizeColumnsByGroup(p.map((c) => getColumnGroupKey(c) === src ? { ...c, hidden: true  } : c))); };
    const moveColumnGroup = (src, direction) => {
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
      saveColumnGroupOrderToUser(nextOrder);
    };

    const visibleCols   = useMemo(() => { const vis = allColumns.filter((c) => !c.hidden); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [allColumns]);
    const hasCompetitorColumns = useMemo(() => visibleCols.some((c) => c._isCompetitorSubColumn), [visibleCols]);
    const HEADER_GROUP_HEIGHT = 28;
    const HEADER_MAIN_HEIGHT = 26;
    const HEADER_SUB_HEIGHT = 20;
    const TABLE_VISIBLE_ROWS = 10;
    const TABLE_BODY_ROW_HEIGHT = 66;
    const tableWrapHeight = HEADER_GROUP_HEIGHT + HEADER_MAIN_HEIGHT + (hasCompetitorColumns ? HEADER_SUB_HEIGHT : 0) + TABLE_BODY_ROW_HEIGHT * TABLE_VISIBLE_ROWS + 2;
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
      updateAndSave((prev) => {
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
    }, [updateAndSave]);
    const onDragEnd = () => { dragColKey.current = null; };

    const onResizeStart = useCallback((e, colKey) => { e.preventDefault(); e.stopPropagation(); const col = allColumns.find((c) => c.key === colKey); resizeRef.current = { colKey, startX: e.clientX, startWidth: col?.width || 80 }; setIsResizing(true); }, [allColumns]);
    const onOverlayMove = useCallback((e) => {
      if (!resizeRef.current) return;
      const { colKey, startX, startWidth } = resizeRef.current;
      const nw = Math.max(40, startWidth + (e.clientX - startX));
      const cur = allColumns.find((c) => c.key === colKey);
      if (isDynamicColumnKey(colKey)) {
        if (updateDynamicCol(colKey, (c) => ({ ...c, width: nw }))) {
          persistDynamicColPrefs(colKey, { width: nw, hidden: cur?.hidden === true, pinned: cur?.pinned === true, headerColor: cur?.headerColor || null });
        }
        return;
      }
      updateAndSave((p) => p.map((c) => c.key === colKey ? { ...c, width: nw } : c));
    }, [allColumns, persistDynamicColPrefs, updateAndSave]);
    const onOverlayUp   = useCallback(() => { resizeRef.current = null; setIsResizing(false); }, []);

    const isCellEditable = useCallback((col, row = null) => {
      if (row?.__rowType === WEEKLY_SUMMARY_ROW_TYPE) return false;
      if (READONLY_FIELDS.has(col.field)) return false;
      return col.editable === true;
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

    const handleCellMouseDown = useCallback((e, r, c) => {
      if (e.button !== 0 || editingCell || isResizing) return;

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
    }, [getClipboardValue, normalizeSelection, pagedData, selectedRange, visibleCols]);

    const handlePaste = useCallback(async (e) => {
      const rect = normalizeSelection(selectedRange);
      if (!rect || saving) return;
      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      e.preventDefault();
      const matrix = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((line) => line.split('\t'));
      while (matrix.length && matrix[matrix.length - 1].length === 1 && matrix[matrix.length - 1][0] === '') matrix.pop();
      if (!matrix.length) return;
      const patches = new Map();
      const sourcePatches = new Map();
      const richOps = [];
      const requests = [];
      const changedRowsMap = new Map();
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
              valueToSave: String(cellText ?? '').trim() || null,
            });
            continue;
          }

          if (!isCellEditable(col, targetRow)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = targetRow[updateConfig.pkField];
          if (!rowId || !pkValue) continue;
          const valueToSave = parsePastedValue(col, cellText);
          requests.push(ctx.request({
            url: updateConfig.url,
            method: 'post',
            params: { filterByTk: pkValue },
            data: { [col.field]: valueToSave },
          }));
          patches.set(rowId, { ...(patches.get(rowId) || {}), [col.field]: valueToSave });
          const nextSourcePatches = {
            ...(sourcePatches.get(rowId) || {}),
            [col.src]: {
              ...((sourcePatches.get(rowId) || {})[col.src] || {}),
              [col.field]: valueToSave,
            },
          };
          sourcePatches.set(rowId, nextSourcePatches);
          changedRowsMap.set(rowId, mergeSourcePatch({ ...targetRow, ...(patches.get(rowId) || {}) }, col.src, { [col.field]: valueToSave }));
        }
      });

      if (!requests.length && !richOps.length) {
        ctx.message.warning('粘贴区域没有可编辑单元格');
        return;
      }

      try {
        setSaving(true);
        const results = await Promise.allSettled(requests);
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
            return { rowId: op.rowId, colField: op.colField, field: 'actual_rank', daily: nextDaily };
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
          return { rowId: op.rowId, colField: op.colField, field: op.field, daily: nextDaily };
        }));
        const failCount =
          results.filter((r) => r.status === 'rejected').length +
          richResults.filter((r) => r.status === 'rejected').length;
        if (failCount === 0) {
          const richPatchItems = richResults
            .filter((r) => r.status === 'fulfilled')
            .map((r) => r.value);
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
                if (!payload) return;
                nextRow[p.colField] = {
                  ...payload,
                  daily: p.daily,
                };
              });
            }
            return nextRow;
          }), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
          const changedRows = [...changedRowsMap.values()];
          const affectedRowIds = new Set([
            ...patches.keys(),
            ...sourcePatches.keys(),
            ...richPatchItems.map((item) => item.rowId).filter(Boolean),
          ]);
          const affectedRowsForSummary = dataRef.current.filter((row) => affectedRowIds.has(row.country_asin_date || row.id));
          if (changedRows.length || affectedRowsForSummary.length) {
            showFormulaProgress({ label: changedRows.length ? '粘贴已保存，正在同步公式...' : '粘贴已保存，正在同步周汇总...', percent: 8 });
            if (changedRows.length <= 3) {
              if (changedRows.length) await recalcAllCoreFormulas(changedRows, { silent: true, onProgress: showFormulaProgress });
            } else {
              await syncCoreFormulasForRows(changedRows, { onProgress: showFormulaProgress });
            }
            if (affectedRowsForSummary.length) {
              await refreshFullWeeklySummariesForRows(affectedRowsForSummary, { onProgress: showFormulaProgress });
            }
            finishFormulaProgress(changedRows.length ? '粘贴公式和周汇总同步完成' : '粘贴周汇总同步完成');
          }
          ctx.message.success(changedRows.length
            ? `粘贴成功，已更新 ${requests.length + richOps.length} 个单元格，公式和周汇总已同步`
            : `粘贴成功，已更新 ${requests.length + richOps.length} 个单元格`);
        } else {
          ctx.message.warning(`部分粘贴失败：${failCount}/${requests.length + richOps.length}`);
          loadData({ page: curPageRef.current, size: pageSizeRef.current });
        }
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [dynamicCompetitorCols, dynamicKeywordCols, finishFormulaProgress, isCellEditable, loadData, normalizeSelection, pagedData, parsePastedValue, recalcAllCoreFormulas, refreshFullWeeklySummariesForRows, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncCoreFormulasForRows, updateDataAndRefreshWeekly, visibleCols]);

    const clearSelectedCells = useCallback(async () => {
      const rect = normalizeSelection(selectedRange);
      if (!rect || saving) return;
      const patches = new Map();
      const sourcePatches = new Map();
      const richPatches = [];
      const requests = [];
      const changedRowsMap = new Map();

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
            richPatches.push({ rowId, colField: col.field, field, valueToSave: null });
            continue;
          }

          if (!isCellEditable(col, targetRow)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = targetRow[updateConfig.pkField];
          if (!rowId || !pkValue) continue;

          requests.push(ctx.request({
            url: updateConfig.url,
            method: 'post',
            params: { filterByTk: pkValue },
            data: { [col.field]: null },
          }));
          patches.set(rowId, { ...(patches.get(rowId) || {}), [col.field]: null });
          const nextSourcePatches = {
            ...(sourcePatches.get(rowId) || {}),
            [col.src]: {
              ...((sourcePatches.get(rowId) || {})[col.src] || {}),
              [col.field]: null,
            },
          };
          sourcePatches.set(rowId, nextSourcePatches);
          changedRowsMap.set(rowId, mergeSourcePatch({ ...targetRow, ...(patches.get(rowId) || {}) }, col.src, { [col.field]: null }));
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
          }), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
          const changedRows = [...changedRowsMap.values()];
          const affectedRowIds = new Set([
            ...patches.keys(),
            ...sourcePatches.keys(),
            ...richPatches.map((item) => item.rowId).filter(Boolean),
          ]);
          const affectedRowsForSummary = dataRef.current.filter((row) => affectedRowIds.has(row.country_asin_date || row.id));
          if (changedRows.length || affectedRowsForSummary.length) {
            showFormulaProgress({ label: changedRows.length ? '选区已清空，正在同步公式...' : '选区已清空，正在同步周汇总...', percent: 8 });
            if (changedRows.length <= 3) {
              if (changedRows.length) await recalcAllCoreFormulas(changedRows, { silent: true, onProgress: showFormulaProgress });
            } else {
              await syncCoreFormulasForRows(changedRows, { onProgress: showFormulaProgress });
            }
            if (affectedRowsForSummary.length) {
              await refreshFullWeeklySummariesForRows(affectedRowsForSummary, { onProgress: showFormulaProgress });
            }
            finishFormulaProgress(changedRows.length ? '清空后公式和周汇总同步完成' : '清空后周汇总同步完成');
          }
          ctx.message.success(changedRows.length
            ? `\u5df2\u6e05\u7a7a ${requests.length} \u4e2a\u5355\u5143\u683c\uff0c\u516c\u5f0f\u548c\u5468\u6c47\u603b\u5df2\u540c\u6b65`
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
    }, [dynamicCompetitorCols, dynamicKeywordCols, finishFormulaProgress, isCellEditable, loadData, normalizeSelection, pagedData, recalcAllCoreFormulas, refreshFullWeeklySummariesForRows, resetFormulaProgress, saving, selectedRange, showFormulaProgress, syncCoreFormulasForRows, updateDataAndRefreshWeekly, visibleCols]);

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
    }, [saving]);

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
          const nextRow = { ...row, [dynamicKeywordCol.field]: { ...(payload || {}), daily: nextDaily } };
          updateDataAndRefreshWeekly((prev) => prev.map((r) => {
            if ((r.country_asin_date || r.id) !== rowId) return r;
            const currentPayload = r[dynamicKeywordCol.field] || payload || {};
            return { ...r, [dynamicKeywordCol.field]: { ...currentPayload, daily: nextDaily } };
          }), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
          showFormulaProgress({ label: '保存成功，正在同步周汇总...', percent: 20 });
          await refreshFullWeeklySummariesForRows([nextRow], { onProgress: showFormulaProgress });
          finishFormulaProgress('周汇总同步完成');
          setEditingCell(null);
          setEditValue(null);
          savedCell = true;
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
        let savedCell = false;
        try {
          setSaving(true);
          let nextDaily = { ...daily, [fieldName]: valueToSave };
          if (daily.id) {
            await ctx.request({
              url: 'order_link_competitor_asins_daily:update',
              method: 'post',
              params: { filterByTk: daily.id },
              data: { [fieldName]: valueToSave },
            });
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
          const nextRow = { ...row, [dynamicCompetitorCol.field]: { ...(payload || {}), daily: nextDaily } };
          updateDataAndRefreshWeekly((prev) => prev.map((r) => {
            if ((r.country_asin_date || r.id) !== rowId) return r;
            const currentPayload = r[dynamicCompetitorCol.field] || payload || {};
            return { ...r, [dynamicCompetitorCol.field]: { ...currentPayload, daily: nextDaily } };
          }), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
          showFormulaProgress({ label: '保存成功，正在同步周汇总...', percent: 20 });
          await refreshFullWeeklySummariesForRows([nextRow], { onProgress: showFormulaProgress });
          finishFormulaProgress('周汇总同步完成');
          setEditingCell(null);
          setEditValue(null);
          savedCell = true;
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

        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? mergeSourcePatch(r, src, { [field]: valueToSave }) : r), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
        setEditingCell(null);
        setEditValue(null);
        savedCell = true;
        setSaving(false);
        ctx.message.success('保存成功，公式后台同步中');

        window.setTimeout(async () => {
          try {
            showFormulaProgress({ label: '保存成功，正在同步公式...', percent: 8 });
            const formulaResult = await recalcAllCoreFormulas([nextRow], { silent: true, onProgress: showFormulaProgress });
            if (formulaResult?.success > 0) {
              const refreshedRows = await fetchAllList('daily_profit:list', {
                filter: JSON.stringify({ country_asin_date: { $eq: rowId } }),
              }, 1).catch(() => []);
              const formulaUpdates = refreshedRows?.[0] || null;
              if (formulaUpdates) {
                updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? mergeFormulaPatch(r, formulaUpdates) : r), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
              }
            }
            await refreshFullWeeklySummariesForRows([nextRow], { onProgress: showFormulaProgress });
            finishFormulaProgress('公式和周汇总同步完成');
          } catch (formulaErr) {
            resetFormulaProgress();
            ctx.message.warning(`保存成功，但公式同步失败：${formulaErr?.message || '未知错误'}`);
          }
        }, 0);
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || '未知错误'}`);
      } finally {
        if (!savedCell) setSaving(false);
      }
    }, [editingCell, editValue, data, dynamicKeywordCols, dynamicCompetitorCols, saving, cancelEdit, recalcAllCoreFormulas, fetchAllList, finishFormulaProgress, refreshFullWeeklySummariesForRows, resetFormulaProgress, showFormulaProgress, updateDataAndRefreshWeekly]);

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
        const nextRow = { ...row, [col.field]: { ...(payload || {}), daily: nextDaily } };
        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
        await refreshFullWeeklySummariesForRows([nextRow]);
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存 SQP 关键词自然位失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, dynamicCompetitorCols, dynamicKeywordCols, refreshFullWeeklySummariesForRows, restoreTableScroll, updateDataAndRefreshWeekly]);

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
        const nextRow = { ...row, [col.field]: { ...(payload || {}), daily: nextDaily } };
        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
        await refreshFullWeeklySummariesForRows([nextRow]);
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存竞对失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, dynamicCompetitorCols, dynamicKeywordCols, refreshFullWeeklySummariesForRows, restoreTableScroll, updateDataAndRefreshWeekly]);

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
        updateDataAndRefreshWeekly((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? mergeSourcePatch(r, col.src, { [col.field]: valueToSave }) : r), [...INITIAL_COLUMNS, ...dynamicKeywordCols, ...dynamicCompetitorCols], { skipWeeklyRefresh: true });
        await syncCoreFormulasForRows([nextRow]);
        await refreshFullWeeklySummariesForRows([nextRow]);
        restoreTableScroll(scrollPos);
        return true;
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
        return false;
      }
    }, [captureTableScroll, dynamicCompetitorCols, dynamicKeywordCols, refreshFullWeeklySummariesForRows, restoreTableScroll, syncCoreFormulasForRows, updateDataAndRefreshWeekly]);

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

    const btnStyle = (bg, color, border) => ({ padding: '5px 12px', background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE}px`, whiteSpace: 'nowrap' });
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
    const renderSortMark = (key) => {
      if (sortConfig.key !== key) return null;
      return React.createElement('span', {
        style: { marginLeft: '2px', fontSize: `${FONT_SIZE_XS}px`, lineHeight: 1, flexShrink: 0 },
      }, sortConfig.dir === 'asc' ? '▲' : '▼');
    };

    const renderTooltip = ({ title, formula, emptyRules = [], fields = [], writeBackField, hideEmptyRules = false, hideFieldMapping = false, sourceInfos = [] }) => React.createElement('div', {
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
      React.createElement('hr', {
        style: {
          border: 0,
          borderTop: '1px solid rgba(255,255,255,0.22)',
          margin: '8px 0',
        },
      }),
      React.createElement('div', {
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
    const renderHeaderLabel = (col) => React.createElement(Tooltip, {
      title: getHeaderTooltipText(col),
      placement: 'top',
      overlayStyle: { maxWidth: '360px' },
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
      },
    }, col.label));
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
      overlayStyle: { maxWidth: '360px' },
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
            style: { color: 'inherit', textDecoration: 'underline', textUnderlineOffset: '2px', fontWeight: 800 },
          }, col._competitorAsin)
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
      const editableIconStyle = col.editable ? { fontSize: `${FONT_SIZE_SM}px`, color: '#EB6793', fontWeight: 'bold' } : { fontSize: `${FONT_SIZE_XS}px`, color: '#999' };
      const richEditIconStyle = col.richEdit ? { fontSize: `${FONT_SIZE_SM}px`, color: '#1890ff', fontWeight: 'bold' } : { fontSize: `${FONT_SIZE_XS}px`, color: '#999' };
      return React.createElement('div', { key: col.key, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0 3px 12px', borderBottom: '1px solid #fafafa' } },
        React.createElement('div', { onClick: () => togglePin(col.key), style: { width: '22px', textAlign: 'center', flexShrink: 0, cursor: 'pointer', fontSize: `${FONT_SIZE_SM}px`, opacity: col.pinned ? 1 : 0.2, userSelect: 'none' } }, '📌'),
        React.createElement('input', { type: 'checkbox', checked: !col.hidden, onChange: () => toggleCol(col.key), style: { flexShrink: 0, cursor: 'pointer' } }),
        React.createElement('span', { style: { flex: 1, fontSize: `${FONT_SIZE_SM}px`, color: col.hidden ? '#ccc' : '#333', userSelect: 'none' } }, col.label),
        IS_ADMIN && !col._dynamicKind && !READONLY_FIELDS.has(col.field) && React.createElement('label', { title: '双击单元格可编辑', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: col.editable === true, onChange: () => toggleEditable(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: editableIconStyle }, '编辑'),
        ),
        IS_ADMIN && supportsRichEdit(col) && React.createElement('label', { title: '使用 + 编辑，可输入多行内容和粘贴截图', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: col.richEdit === true, onChange: () => toggleRichEdit(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: richEditIconStyle }, '+编辑'),
        ),
        IS_ADMIN && React.createElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } },
          PRESET_COLORS.map((pc) => React.createElement('div', { key: pc.value, title: pc.label, onClick: () => setHColor(col.key, pc.value), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: pc.value, border: currentColor === pc.value ? '2px solid #333' : '2px solid transparent', boxSizing: 'border-box' } })),
          isCustom && React.createElement('div', { title: '重置为默认色', onClick: () => clearHColor(col.key), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: srcDefault, border: '2px dashed #333', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 700, lineHeight: 1 } }, '↺'),
        ),
      );
    };

    const panelEl = showPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { position: 'fixed', top: `${panelPos.top}px`, left: `${panelPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', width: IS_ADMIN ? '600px' : '520px', maxHeight: '620px', overflowY: 'auto' } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: '#555', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', null, '列设置'),
          React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#aaa', fontWeight: 400 } }, IS_ADMIN ? '📌 固定 | ☑ 显示 | 🎨 颜色 | 编辑' : '📌 固定 | ☑ 显示'),
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
            React.createElement('button', { onClick: selectAll,   style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
            React.createElement('button', { onClick: deselectAll, style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
          ),
        ),
        panelGroupConfig.map((group) => {
          const groupCols   = allColumns.filter((c) => getColumnGroupKey(c) === group.src);
          if (!groupCols.length) return null;
          const isCollapsed = !!collapsedGroups[group.src];
          const visCount    = groupCols.filter((c) => !c.hidden).length;
          const canMoveGroup = group.src !== 'competitor';
          return React.createElement('div', { key: group.src, style: { marginBottom: '6px', border: '1px solid #d6dde5', borderRadius: '6px', overflow: 'hidden', background: '#fff' } },
            React.createElement('div', { onClick: () => toggleGroup(group.src), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px 6px 0', cursor: 'pointer', userSelect: 'none', background: `${group.color}22`, borderBottom: isCollapsed ? 'none' : '1px solid #dfe5ec' } },
              React.createElement('span', { style: { alignSelf: 'stretch', width: '4px', background: group.color, flexShrink: 0 } }),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#334155', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s', flexShrink: 0 } }, '▾'),
              React.createElement('span', { style: { fontWeight: 800, fontSize: `${FONT_SIZE_SM}px`, color: '#1f2933', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#475569', fontWeight: 600, marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              canMoveGroup && React.createElement('button', { title: '板块上移', onClick: (e) => { e.stopPropagation(); moveColumnGroup(group.src, -1); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#fff', color: '#555', border: '1px solid #d9d9d9', borderRadius: '3px', cursor: 'pointer' } }, '上移'),
              canMoveGroup && React.createElement('button', { title: '板块下移', onClick: (e) => { e.stopPropagation(); moveColumnGroup(group.src, 1); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#fff', color: '#555', border: '1px solid #d9d9d9', borderRadius: '3px', cursor: 'pointer' } }, '下移'),
              React.createElement('button', { onClick: (e) => { e.stopPropagation(); selectGroup(group.src); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
              React.createElement('button', { onClick: (e) => { e.stopPropagation(); deselectGroup(group.src); }, style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
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
                  managerItems.map((item) => React.createElement('div', { key: item.id, style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' } },
                    React.createElement(Input, {
                      defaultValue: item[sqpMeta.nameField] || '',
                      disabled: managerSaving,
                      onBlur: (e) => { const v = e.target.value.trim(); if (v !== (item[sqpMeta.nameField] || '')) updateKeyword(item, v); },
                      onPressEnter: (e) => e.currentTarget.blur(),
                    }),
                    React.createElement(Popconfirm, { title: `确定删除「${item[sqpMeta.nameField] || sqpMeta.title}」？`, onConfirm: () => deleteKeyword(item), okText: '确定', cancelText: '取消' },
                      React.createElement(Button, { danger: true, disabled: managerSaving }, '删除')
                    )
                  ))
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
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '2px',
        padding: '3px 8px',
        background: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        boxShadow: 'none',
        maxWidth: '100%',
        boxSizing: 'border-box',
      },
    },
      ...topInfoItems.map((item, index) =>
        React.createElement('div', { key: item.label, style: { minWidth: 0, borderLeft: index === 0 ? 'none' : '1px solid #d9d9d9', paddingLeft: index === 0 ? 0 : '8px', color: '#333', fontSize: `${FONT_SIZE_SM}px`, fontWeight: 600, lineHeight: '17px', whiteSpace: 'nowrap' } },
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

    return React.createElement('div', { ref: rootRef, style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),
      keywordManagerModal,
      targetManagerModal,
      couponManagerModal,
      competitorManagerModal,
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '2px' },
      },
        headerInfoEl,

        // 预设颜色图例
        React.createElement('div', {
          style: { display: 'inline-flex', width: 'fit-content', maxWidth: '100%', gap: '6px', flexWrap: 'wrap', padding: '3px 8px', background: '#fafafa', borderRadius: '4px', border: '1px solid #d9d9d9', alignItems: 'center', fontSize: `${FONT_SIZE_XS}px`, boxSizing: 'border-box' }
        },
          React.createElement('span', { style: { fontWeight: 600, color: '#555', marginRight: '4px' } }, '列头颜色：'),
          ...PRESET_COLORS.map(pc =>
            React.createElement('div', { key: pc.value, style: { display: 'flex', alignItems: 'center', gap: '2px' } },
              React.createElement('div', { style: { width: '10px', height: '10px', borderRadius: '2px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
              React.createElement('span', { style: { color: '#666' } }, pc.label)
            )
          ),
        ),
      ),

      panelEl,
      pushPanelEl,
      crossHighlightPanelEl,

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

      // 销售操作区
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
          React.createElement('button', { onClick: openTargetManager, disabled: !currentCountryAsin, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentCountryAsin ? 1 : 0.6, cursor: currentCountryAsin ? 'pointer' : 'not-allowed' } }, '管理目标值'),
          React.createElement('button', { onClick: openCompetitorManager, disabled: !currentCountryAsin, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentCountryAsin ? 1 : 0.6, cursor: currentCountryAsin ? 'pointer' : 'not-allowed' } }, '管理竞对 ASIN'),
          React.createElement('button', { onClick: openKeywordManager, disabled: !currentCountryAsin, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentCountryAsin ? 1 : 0.6, cursor: currentCountryAsin ? 'pointer' : 'not-allowed' } }, '管理 SQP 关键词'),
          React.createElement('button', { onClick: openCouponManager, disabled: !currentAsinCountry, style: { ...btnStyle('#EB6793', '#fff', '#d84f7c'), opacity: currentAsinCountry ? 1 : 0.6, cursor: currentAsinCountry ? 'pointer' : 'not-allowed' } }, '管理 Coupon 预估比例'),
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
              ...btnStyle(actionBusy ? '#f5f5f5' : '#fff', actionBusy ? '#999' : '#333', '#d9d9d9'),
              opacity: actionBusy ? 0.65 : 1,
              cursor: actionBusy ? 'not-allowed' : 'pointer',
            },
          }, refreshingData ? '刷新中...' : '🔄 刷新'),
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
        style: { overflowX: 'auto', overflowY: 'auto', height: `${tableWrapHeight}px`, borderRadius: '8px', border: '1px solid #d9d9d9', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', background: '#fff', outline: 'none' }
      },
        loading && data.length === 0
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
                            background: groupHdrColor,
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
                            overflow: 'hidden'
                          },
                        },
                        React.createElement('span', { style: { display: 'flex', alignItems: 'center', justifyContent: 'center', maxWidth: '100%', minWidth: 0, overflow: 'hidden', verticalAlign: 'middle' } },
                          renderCompetitorGroupHeaderLabel(col),
                          renderSortMark(groupSortKey),
                        )
                        );
                      }

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
                          background: hdrColor,
                          color: getTextColorForBg(hdrColor),
                          borderBottom: '2px solid rgba(0,0,0,0.12)',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                          textAlign: 'center', fontWeight: 600,
                          fontSize: `${FONT_SIZE_SM}px`,
                          userSelect: 'none', cursor: 'pointer',
                          whiteSpace: 'normal',
                          lineHeight: '15px',
                          boxSizing: 'border-box',
                          overflow: 'hidden'
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
                          background: hdrColor,
                          borderBottom: '2px solid rgba(0,0,0,0.12)',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                          boxSizing: 'border-box',
                          cursor: 'pointer',
                          userSelect: 'none',
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
                    const rowId = row.country_asin_date || row.id;
                    const isWeeklySummary = row.__rowType === WEEKLY_SUMMARY_ROW_TYPE;
                    return React.createElement('tr', { key: rowId || rIdx, style: { background: isWeeklySummary ? WEEKLY_SUMMARY_BG : (rIdx % 2 === 0 ? '#fff' : '#fafafa') } },
                      visibleCols.map((col) => {
                        const isPinned  = col.pinned;
                        const leftOff   = isPinned ? pinnedLeftMap[col.key] : undefined;
                        const dynFn     = DYNAMIC_COLOR[col.field] || DYNAMIC_COLOR[col.key];
                        const cellColor = dynFn ? dynFn(row) : null;
                        const isNum     = ALL_NUMERIC.has(col.field) || col.field === 'promo_day';
                        const canEdit   = isCellEditable(col, row);
                        const isEditing = editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key;
                        const cIdx      = visibleCols.findIndex((c) => c.key === col.key);
                        const selected  = isCellSelected(rIdx, cIdx);

                        if (shouldUseRichEdit(col, canEdit)) {
                          const richValue =
                            col._dynamicKind === 'keyword'
                              ? row[col.field]?.daily?.actual_rank
                              : col._dynamicKind === 'competitor'
                              ? row[col.field]?.daily?.[col._competitorField || 'notes']
                              : getCellValue(col, row);
                          const saveRich =
                            col._dynamicKind === 'keyword'
                              ? (next) => saveKeywordRichCell(row, col, next)
                              : col._dynamicKind === 'competitor'
                              ? (next) => saveCompetitorRichCell(row, col, next)
                              : (next) => saveStaticRichCell(row, col, next);

                          return React.createElement('td', {
                            key: col.key,
                            onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                            onMouseEnter: () => handleCellMouseEnter(rIdx, cIdx),
                            style: {
                              position: isPinned ? 'sticky' : undefined,
                              left: isPinned ? `${leftOff}px` : undefined,
                              zIndex: isPinned ? 1 : undefined,
                              background: isWeeklySummary ? WEEKLY_SUMMARY_BG : getBodyCellBackground(rIdx, cIdx, selected),
                              padding: '2px',
                              borderBottom: '1px solid #e8e8e8',
                              borderRight: isPinned ? '2px solid rgba(0,0,0,0.18)' : '1px solid #e8e8e8',
                              textAlign: 'center',
                              verticalAlign: 'middle',
                              boxSizing: 'border-box',
                              userSelect: 'none',
                              boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : (isPinned ? '1px 0 0 rgba(0,0,0,0.05)' : undefined),
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
                          key: col.key,
                          title: typeof renderedContent === 'string' ? renderedContent : (typeof displayContent === 'string' ? displayContent : undefined),
                          onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                          onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, getCellValue(col, row)); },
                          style: {
                            position: isPinned ? 'sticky' : undefined,
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 1 : undefined,
                            background: isWeeklySummary ? WEEKLY_SUMMARY_BG : getBodyCellBackground(rIdx, cIdx, selected),
                            padding: isEditing ? '3px 5px' : '5px 8px',
                            borderBottom: '1px solid #e8e8e8',
                            borderRight: isPinned ? '2px solid rgba(0,0,0,0.18)' : '1px solid #e8e8e8',
                            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                            textAlign: 'center',
                            color: cellColor || '#1a1a1a',
                            fontWeight: isWeeklySummary ? 700 : (cellColor ? 600 : 500),
                            fontSize: `${FONT_SIZE}px`,
                            boxSizing: 'border-box',
                            userSelect: 'none',
                            cursor: canEdit && !isEditing ? 'cell' : 'default',
                            outline: canEdit && !isEditing ? '1px dashed transparent' : undefined,
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : (isPinned ? '1px 0 0 rgba(0,0,0,0.05)' : undefined),
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
            )
      ),

      // 分页
      React.createElement('div', { style: { marginTop: '0px', display: 'flex', justifyContent: 'flex-end' } },
        React.createElement(Pagination, {
          current: curPage, pageSize, total,
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
      React.createElement('div', { style: { padding: '0', fontFamily: 'system-ui, sans-serif', fontSize: `${FONT_SIZE}px` } },
        React.createElement(MergedTable, null)
      )
    );
  };

  ctx.render(React.createElement(TableApp));
}
run();

