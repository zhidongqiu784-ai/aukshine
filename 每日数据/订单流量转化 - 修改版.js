async function run() {

  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Drawer, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal, Form } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
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

  const GLOBAL_KEY  = '__urlParams_global';
  const readGlobal  = ()     => ctx.engine[GLOBAL_KEY] || null;
  const writeGlobal = (data) => { ctx.engine[GLOBAL_KEY] = data; };

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

  function tryParseCurrentSearch() {
    const location = ctx.router?.state?.location;
    const search   = location?.search;
    if (!search) return null;
    const p         = parseSearch(search);
    const model     = p['model']      || null;
    const country   = p['country']    || null;
    const asin      = p['asin']       || null;
    const saleOwner = p['sale_owner'] || null;
    if (!model && !country && !asin && !saleOwner) return null;
    return { model, country, asin, sale_owner: saleOwner };
  }

  function loadUrlParams() {
    const fromSearch = tryParseCurrentSearch();
    if (fromSearch) { writeGlobal(fromSearch); return fromSearch; }
    return readGlobal();
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
    { label:'基础',      value:'#9DF29F' },
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

  const SRC_DEFAULT_COLOR = {
    daily: COLOR_GREEN,
    weekly: COLOR_ORANGE,
    order_link: COLOR_ROSE,
    keyword_position: '#b5796a',
    competitor: '#7FA1C3',
    tool: '#fa8c16',
  };

  const getColHeaderColor = (col) => col.headerColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;

  const PAGE_SIZE_OPTIONS = ['10','20','50','100'];
  const DEFAULT_PAGE_SIZE = 20;

  // 字段集合
  const MONEY_FIELDS = new Set([
    'daily_price','list_price','price_after_discount',
    'guanggaohuafei','ad_direct_sales_amount','ad_sales_amount',
    'ads_sp_cost','ads_sp_sales','ads_sd_cost','ads_sd_sales',
    'shared_ads_sb_cost','shared_ads_sb_sales','shared_ads_sbv_cost','shared_ads_sbv_sales',
    'ideal_cpu_by_margin','target_cpa','cpu','cpc','cpo','cpa',
    'review_discounted_price','review_actual_price',
  ]);
  const RATE_FIELDS  = new Set([
    'off','real_session_conversion_rate',
    'zongcvr','guanggaocvr','volume_cvr','acos','tacos',
    'weekly_target_completion_rate','target_ad_cvr','target_profit_margin','target_ad_spend_rate',
    'natural_traffic_proportion','return_rate','return_goods_rate',
    'ctr','adv_rate','natural_single_ratio',
    'link_cvr',
        'review_orders_ratio','offsite_orders_ratio','onsite_orders_ratio',
        'onsite_organic_orders_ratio','onsite_ad_orders_ratio',
        'order_link_real_session_conversion_rate',
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
    'link_clicks','link_orders',
    'actual_review_qty',
    'offsite_bg_orders','offsite_xx_orders','offsite_acc_orders',
    'total_offsite_orders','total_onsite_orders','onsite_organic_orders','onsite_ad_orders',
    'competitor1_rank','competitor2_rank','competitor3_rank',
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

  const ORDER_LINK_FORMULA_TRIGGER_FIELDS = new Set([
    'order_items',
    'rsg_number',
    'guanggaodan',
    'zongliuliang',
  ]);

  const RICH_TEXT_FIELDS = new Set([
    'competitor1_notes',
    'competitor2_notes',
    'competitor3_notes',
    'review_screenshot',
    'bad_review_notes',
    'keyword_trend_screenshot',
    'ad_framework_screenshot',
    'keyword_performance_screenshot',
    'page_screenshot',
    'link_problem',
    'operation_record',
    'ad_optimization_logs',
    'review_notes',
  ]);

  const KW_ROLE_ORDER = ['主推', '辅1', '辅2', '辅3', '辅4'];
  const KW_ROLE_LABEL = { '主推': '主推', '辅1': '辅1', '辅2': '辅2', '辅3': '辅3', '辅4': '辅4' };
  const KW_ROLE_COLORS = {
    '主推': '#EB6793',
    '辅1': '#F2BABA',
    '辅2': '#C5DFB4',
    '辅3': '#5DBEAC',
    '辅4': '#D4A76A',
  };

  const COMPETITOR_SLOT_ORDER = ['竞对1', '竞对2', '竞对3', '竞对4', '竞对5'];
  const COMPETITOR_SLOT_COLORS = {
    '竞对1': '#7FA1C3',
    '竞对2': '#82A0A8',
    '竞对3': '#A888B5',
    '竞对4': '#C68B5E',
    '竞对5': '#8FA382',
  };





  const DATE_FIELDS  = new Set(['date','updatedAt']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  // 只读字段
  const READONLY_FIELDS = new Set([
    'country_asin_date','country_asin_week','id','country','asin','date','updatedAt',
    'page_screenshot',

    // 公式字段
    'total_onsite_orders',
    'onsite_organic_orders',
    'onsite_organic_orders_ratio',
  ]);



  const ORDER_STRUCTURE_DIAGNOSED_MAP = { match:'符合', not_match:'不符合' };

  const ORDER_STRUCTURE_DIAGNOSED_OPTIONS = [
    { label:'符合', value:'match' },
    { label:'不符合', value:'not_match' },
  ];
  const FORMULA_DESCRIPTIONS = {
    total_onsite_orders:
  `【③站内:纯自然+广告单 - 公式】
  计算逻辑：
  ③站内:纯自然+广告单 = weekly_performance.order_items - daily_asins.rsg_number

  字段说明：
  • weekly_performance.order_items：实际总单量
  • daily_asins.rsg_number：实际刷单总数

  空值规则：
  • 实际总单量为空，结果为空
  • 实际刷单总数为空，结果为空`,

      onsite_organic_orders:
  `【④站内纯自然单 - 公式】
  计算逻辑：
  ④站内纯自然单 = daily_order_link_tracking.total_onsite_orders - weekly_performance.guanggaodan

  字段说明：
  • daily_order_link_tracking.total_onsite_orders：③站内:纯自然+广告单
  • weekly_performance.guanggaodan：广告总单量

  空值规则：
  • ③站内:纯自然+广告单为空，结果为空
  • 广告总单量为空，结果为空`,

      onsite_organic_orders_ratio:
  `【④站内纯自然单占比 - 公式】
  计算逻辑：
  ④站内纯自然单占比 = ④站内纯自然单 / weekly_performance.order_items

  等价写法：
  onsite_organic_orders_ratio = onsite_organic_orders / order_items

  字段说明：
  • onsite_organic_orders：④站内纯自然单
  • weekly_performance.order_items：实际总单量

  空值规则：
  • ④站内纯自然单为空，结果为空
  • 实际总单量为空，结果为空
  • 实际总单量为 0，结果为空`,
  };


  const INITIAL_COLUMNS = [
    // —— daily ——
    { key:'daily_country',                      src:'daily',  field:'country',                      label:'国家',            hidden:false, pinned:true,  width:70,  editable:false },
    { key:'daily_asin',                         src:'daily',  field:'asin',                         label:'ASIN',            hidden:false, pinned:true,  width:110, editable:false },
    { key:'daily_date',                         src:'daily',  field:'date',                         label:'日期',            hidden:false, pinned:true,  width:100, editable:false },
    { key:'daily_sale_owner',                   src:'daily',  field:'sale_owner',                   label:'销售',            hidden:false, pinned:true,  width:80,  editable:false },
    { key:'daily_model',                        src:'daily',  field:'model',                        label:'型号',            hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_activity_annotation',          src:'daily',  field:'activity_annotation',          label:'活动标注',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_daily_price',                  src:'daily',  field:'daily_price',                  label:'购物车价格',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_list_price',                   src:'daily',  field:'list_price',                   label:'LP/WP/TP',         hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_price_after_discount',         src:'daily',  field:'price_after_discount',         label:'折后售价',          hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_off',                          src:'daily',  field:'off',                          label:'Off 力度',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_star_rating',                  src:'daily',  field:'star_rating',                  label:'星级',            hidden:false, pinned:false, width:70,  editable:false },
    { key:'daily_number_of_comments',           src:'daily',  field:'number_of_comments',           label:'评论数',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'daily_selling_accounts',             src:'daily',  field:'selling_accounts',             label:'售卖账号',        hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_promotion_days',               src:'daily',  field:'promotion_days',               label:'推广天数',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_lp_duration_days',             src:'daily',  field:'lp_duration_days',             label:'LP 持续天数',     hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_rsg_number',                   src:'daily',  field:'rsg_number',                   label:'实际刷单总数',    hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_target_gap',                   src:'daily',  field:'target_gap',                   label:'目标差距',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_real_session_conversion_rate', src:'daily',  field:'real_session_conversion_rate', label:'真实会话转化率',  hidden:false, pinned:false, width:120, editable:false },
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
    { key:'weekly_page_views_total',            src:'weekly', field:'page_views_total',             label:'PV-Total',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_organic_traffic',             src:'weekly', field:'organic_traffic',              label:'自然流量',        hidden:false, pinned:false, width:80,  editable:false },
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
    { key:'weekly_page_views',                  src:'weekly', field:'page_views',                   label:'页面浏览量',      hidden:false, pinned:false, width:100, editable:false },
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
    { key:'order_link_clicks',                           src:'order_link', field:'link_clicks',                        label:'链接点击',               hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_orders',                           src:'order_link', field:'link_orders',                        label:'链接订单',               hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_cvr',                              src:'order_link', field:'link_cvr',                           label:'链接 CVR',                hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_real_session_conversion_rate',      src:'order_link', field:'order_link_real_session_conversion_rate', label:'真实会话转化率（剔除测评单）', hidden:false, pinned:false, width:160, editable:false },
    { key:'order_link_review_discounted_price',          src:'order_link', field:'review_discounted_price',            label:'测评折后价',             hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_review_actual_price',              src:'order_link', field:'review_actual_price',                label:'测评成交价',             hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_offsite_bg_orders',                src:'order_link', field:'offsite_bg_orders',                  label:'站外 BG 出单',            hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_offsite_xx_orders',                src:'order_link', field:'offsite_xx_orders',                  label:'站外 XX 出单',            hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_offsite_acc_orders',               src:'order_link', field:'offsite_acc_orders',                 label:'站外 ACC 出单',           hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_total_offsite_orders',             src:'order_link', field:'total_offsite_orders',               label:'②站外单',                 hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_total_onsite_orders',              src:'order_link', field:'total_onsite_orders',                label:'③站内:纯自然+广告单',                 hidden:false, pinned:false, width:90,  editable:false },
    { key:'order_link_onsite_organic_orders',            src:'order_link', field:'onsite_organic_orders',              label:'④站内纯自然单',           hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_onsite_ad_orders',                 src:'order_link', field:'onsite_ad_orders',                   label:'⑤站内总广告单',           hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_review_orders_ratio',              src:'order_link', field:'review_orders_ratio',                label:'①测评单占比',             hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_offsite_orders_ratio',             src:'order_link', field:'offsite_orders_ratio',               label:'②站外单占比',             hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_onsite_orders_ratio',              src:'order_link', field:'onsite_orders_ratio',                label:'③站内占比',               hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_onsite_organic_orders_ratio',      src:'order_link', field:'onsite_organic_orders_ratio',        label:'④站内纯自然单占比',       hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_onsite_ad_orders_ratio',           src:'order_link', field:'onsite_ad_orders_ratio',             label:'⑤站内总广告单占比',       hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_sp_orders_ratio',                  src:'order_link', field:'sp_orders_ratio',                    label:'⑥SP 广告单占比',           hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_sd_orders_ratio',                  src:'order_link', field:'sd_orders_ratio',                    label:'⑦SD 广告单占比',           hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_sb_orders_ratio',                  src:'order_link', field:'sb_orders_ratio',                    label:'⑧SB 广告单占比',           hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_sbv_orders_ratio',                 src:'order_link', field:'sbv_orders_ratio',                   label:'⑨SBV 广告单占比',          hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_order_structure_diagnostic',       src:'order_link', field:'order_structure_diagnostic',         label:'订单结构公式诊断',        hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_competitor1_asin',                 src:'order_link', field:'competitor1_asin',                   label:'目标竞对 asin1',           hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_competitor1_rank',                 src:'order_link', field:'competitor1_rank',                   label:'目标竞对 asin1 排名',       hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_competitor1_notes',                src:'order_link', field:'competitor1_notes',                  label:'目标竞对 asin1 操作分析',   hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_competitor2_asin',                 src:'order_link', field:'competitor2_asin',                   label:'目标竞对 asin2',           hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_competitor2_rank',                 src:'order_link', field:'competitor2_rank',                   label:'目标竞对 asin2 排名',       hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_competitor2_notes',                src:'order_link', field:'competitor2_notes',                  label:'目标竞对 asin2 操作分析',   hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_competitor3_asin',                 src:'order_link', field:'competitor3_asin',                   label:'目标竞对 asin3',           hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_competitor3_rank',                 src:'order_link', field:'competitor3_rank',                   label:'目标竞对 asin3 排名',       hidden:false, pinned:false, width:110, editable:false },
    { key:'order_link_competitor3_notes',                src:'order_link', field:'competitor3_notes',                  label:'目标竞对 asin3 操作分析',   hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_review_screenshot',                src:'order_link', field:'review_screenshot',                   label:'review 详细截图',          hidden:false, pinned:false, width:140, editable:false },
    { key:'order_link_bad_review_notes',                 src:'order_link', field:'bad_review_notes',                   label:'差评 rating/差评',                 hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_keyword_trend_screenshot',         src:'order_link', field:'keyword_trend_screenshot',           label:'Asin 西柚/sif 搜索词排名趋势截图',       hidden:false, pinned:false, width:140, editable:false },
    { key:'order_link_ad_framework_screenshot',          src:'order_link', field:'ad_framework_screenshot',            label:'Asin 广告框架截图',             hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_keyword_performance_screenshot',   src:'order_link', field:'keyword_performance_screenshot',     label:'Asin 搜索词表现截图',           hidden:false, pinned:false, width:130, editable:false },
    { key:'order_link_page_screenshot',                  src:'order_link', field:'page_screenshot',                    label:'自己页面截图',             hidden:false, pinned:false, width:120, editable:false },
    { key:'order_link_link_problem',                     src:'order_link', field:'link_problem',                       label:'链接问题',                 hidden:false, pinned:false, width:100, editable:false },
    { key:'order_link_operation_record',                 src:'order_link', field:'operation_record',                   label:'今日操作记录',       hidden:false, pinned:false, width:160, editable:false },
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
    { label:'可编辑',    value:'editable'    },
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

  const saveColsToUser = async (cols) => {
    if (!currentUserId) return false;
    try {
      const colPayload = cols.map((c) => ({
        key: c.key, hidden: c.hidden === true, pinned: c.pinned === true,
        width: Number(c.width) || 80, headerColor: c.headerColor || null,
        editable: c.editable === true,
      }));
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      await ctx.request({
        url: 'users:update', method: 'post', params: { filterByTk: currentUserId },
        data: { setting: { ...existingSetting, [BLOCK_UID]: colPayload } },
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

  const migrateLegacyColor = (color) => {
    if (!color) return null;
    const normalized = String(color).toLowerCase();
    if (PRESET_COLOR_VALUES.has(normalized)) {
      return color;
    }
    return LEGACY_COLOR_MAP[normalized] || color;
  };

  const buildColumns = async () => {
    const saved = await loadColsFromUser();
    if (!saved) return INITIAL_COLUMNS.map((c) => ({ ...c }));
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
      });
    });
    INITIAL_COLUMNS.forEach((c) => { if (!savedMap[c.key]) result.push({ ...c }); });
    return result;
  };

  const formatCell = (col, row) => {
    const v = row[col.field];

    if (col.field === 'order_structure_diagnostic') {
      return ORDER_STRUCTURE_DIAGNOSED_MAP[v] || v || '—';
    }

    if (MONEY_FIELDS.has(col.field)) {
      return (v != null && v !== '')
        ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 })
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
  const RichTextImageCell = ({ value, onSave, placeholder = '双击编辑 / Ctrl+V 粘贴截图' }) => {
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
          await saveToDatabase(next);
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
      return React.createElement('div', { style: { minHeight: '96px', border: '1px solid #1890ff', borderRadius: '6px', padding: '6px', background: '#fff', boxSizing: 'border-box' } },
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
          style: { width: '100%', height: '84px', border: '1px solid #1890ff', borderRadius: '4px', padding: '8px', fontSize: '13px', fontFamily: 'monospace', resize: 'vertical', background: '#fafafa', lineHeight: 1.5, outline: 'none', boxSizing: 'border-box' },
        })
      );
    }

    const visibleImages = imageUrls.slice(0, 2);
    const extraCount = Math.max(0, imageUrls.length - visibleImages.length);

    return React.createElement(React.Fragment, null,
      React.createElement('div', {
        onDoubleClick: () => { setTempContent(content || ''); setIsEditing(true); },
        style: { minHeight: '54px', maxHeight: '72px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', background: content ? '#fafafa' : '#fff', border: '1px solid #e5e7eb', borderRadius: '6px', cursor: 'cell', overflow: 'hidden', boxSizing: 'border-box' },
      },
        imageUrls.length > 0 && React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 } },
          visibleImages.map((url, i) => React.createElement('img', {
            key: i,
            src: url,
            onClick: (e) => { e.stopPropagation(); setPreviewUrl(url); },
            style: { width: '48px', height: '42px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'zoom-in' },
          })),
          extraCount > 0 && React.createElement('div', { style: { width: '34px', height: '42px', borderRadius: '4px', background: '#f0f0f0', color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, border: '1px solid #ddd' } }, `+${extraCount}`)
        ),
        React.createElement('div', { style: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '2px' } },
          React.createElement(Tooltip, {
            title: cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : placeholder),
            placement: 'topLeft',
            mouseEnterDelay: 0.3,
          },
            React.createElement('div', { style: { fontSize: '13px', color: cleanText ? '#333' : '#999', lineHeight: '18px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } },
              cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : placeholder)
            )
          ),
          React.createElement('div', { style: { fontSize: '11px', color: '#aaa', lineHeight: '14px' } },
            imageUrls.length ? `截图 ${imageUrls.length} 张 · 双击编辑` : '支持 Ctrl + V 粘贴截图'
          )
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
    const [addingRole, setAddingRole] = useState(null);
    const [newAsin, setNewAsin] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editValue, setEditValue] = useState('');
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
      if (!countryAsin) { setRecords([]); return; }
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
    }, [countryAsin]);

    useEffect(() => { if (visible) load(); }, [visible, load]);
    useEffect(() => {
      if (visible) {
        if (propCountry) setCountry(propCountry);
        if (propAsin) setAsin(propAsin);
      } else {
        setRecords([]); setAddingRole(null); setNewAsin(''); setEditingId(null); setEditValue('');
        if (!propCountry) setCountry(null);
        if (!propAsin) setAsin(null);
      }
    }, [visible, propCountry, propAsin]);

    const byRole = useMemo(() => {
      const map = {};
      COMPETITOR_SLOT_ORDER.forEach(role => { map[role] = []; });
      records.forEach(rec => {
        const role = rec.role || '竞对1';
        if (!map[role]) map[role] = [];
        map[role].push(rec);
      });
      return map;
    }, [records]);

    const addRecord = async (role) => {
      const trimmed = (newAsin || '').trim();
      if (!countryAsin) { ctx.message.warning('请先选择 Country 和 ASIN'); return; }
      if (!trimmed) { ctx.message.warning('请输入竞对 ASIN'); return; }
      if ((byRole[role] || []).length >= 1) { ctx.message.warning(`${role} 已经有竞对 ASIN`); return; }
      try {
        setSaving(true);
        await ctx.request({ url: 'order_link_competitor_asins:create', method: 'post', data: { country_asin: countryAsin, competitor_asin: trimmed, role } });
        setAddingRole(null); setNewAsin('');
        await load();
        onRefresh?.();
        ctx.message.success('竞对 ASIN 已添加');
      } catch (err) {
        ctx.message.error(`添加失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const saveName = async (id) => {
      const trimmed = (editValue || '').trim();
      if (!trimmed) return;
      try {
        setSaving(true);
        await ctx.request({ url: 'order_link_competitor_asins:update', method: 'post', params: { filterByTk: id }, data: { competitor_asin: trimmed } });
        setRecords(prev => prev.map(r => r.id === id ? { ...r, competitor_asin: trimmed } : r));
        setEditingId(null); setEditValue('');
        onRefresh?.();
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const deleteRecord = async (id) => {
      try {
        setSaving(true);
        await ctx.request({ url: 'order_link_competitor_asins:destroy', method: 'post', params: { filterByTk: id } });
        setRecords(prev => prev.filter(r => r.id !== id));
        onRefresh?.();
      } catch (err) {
        ctx.message.error(`删除失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const body = React.createElement(React.Fragment, null,
      hasContext
        ? React.createElement('div', { style: { marginBottom: '14px', padding: '12px', background: '#f0f7ff', border: '1px solid #91caff', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center' } },
            React.createElement('span', { style: { fontWeight: 600, color: '#1677ff' } }, '当前产品：'),
            React.createElement('span', { style: { fontWeight: 700, fontSize: '15px', color: '#333' } }, `${propCountry} · ${propAsin}`),
            React.createElement('span', { style: { marginLeft: 'auto', color: '#666', fontSize: '13px' } }, `共 ${records.length} 个竞对`)
          )
        : React.createElement('div', { style: { marginBottom: '14px', padding: '12px', background: '#f0f7ff', border: '1px solid #91caff', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' } },
            React.createElement('span', { style: { fontWeight: 600, color: '#1677ff' } }, '选择产品：'),
            React.createElement(Select, { placeholder: 'Country', value: country || undefined, options: countryOpts, onChange: (v) => { setCountry(v); setAsin(null); }, style: { minWidth: '140px' }, showSearch: true, allowClear: true }),
            React.createElement(Select, { placeholder: 'ASIN', value: asin || undefined, options: asinOpts, disabled: !country, onChange: setAsin, style: { minWidth: '180px' }, showSearch: true, allowClear: true })
          ),
      !countryAsin
        ? React.createElement('div', { style: { padding: '60px', textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: '8px' } }, '请先选择 Country 和 ASIN')
        : React.createElement('div', { style: { display: 'flex', minWidth: `${280 * COMPETITOR_SLOT_ORDER.length}px`, overflowX: 'auto' } },
            COMPETITOR_SLOT_ORDER.map(role => {
              const roleRecords = byRole[role] || [];
              const color = COMPETITOR_SLOT_COLORS[role] || COLOR_BLUE;
              const isAdding = addingRole === role;
              return React.createElement('div', { key: role, style: { width: '280px', minWidth: '280px', borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' } },
                React.createElement('div', { style: { background: color, color: getTextColorForBg(color), padding: '10px 12px', fontWeight: 700, textAlign: 'center' } }, role),
                React.createElement('div', { style: { flex: 1, padding: '10px', minHeight: '100px', background: '#fafafa' } },
                  roleRecords.length === 0
                    ? React.createElement('div', { style: { color: '#999', textAlign: 'center', padding: '24px 0' } }, '暂无竞对')
                    : roleRecords.map(rec => React.createElement('div', { key: rec.id, style: { padding: '10px', marginBottom: '8px', background: '#fff', borderRadius: '6px', border: `1px solid ${color}80` } },
                        editingId === rec.id
                          ? React.createElement(Input, { value: editValue, autoFocus: true, onChange: e => setEditValue(e.target.value), onPressEnter: () => saveName(rec.id), onBlur: () => saveName(rec.id), onKeyDown: e => { if (e.key === 'Escape') setEditingId(null); } })
                          : React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
                              React.createElement('span', { onDoubleClick: () => { setEditingId(rec.id); setEditValue(rec.competitor_asin || ''); }, style: { flex: 1, fontWeight: 700, cursor: 'cell', wordBreak: 'break-all' } }, rec.competitor_asin || '(未命名)'),
                              React.createElement(Popconfirm, { title: `确定删除 ${rec.competitor_asin || '该竞对'}？`, onConfirm: () => deleteRecord(rec.id), okText: '确定', cancelText: '取消' },
                                React.createElement('span', { style: { color: '#ff4d4f', cursor: 'pointer' } }, '✕')
                              )
                            )
                      ))
                ),
                React.createElement('div', { style: { padding: '8px', borderTop: `1px solid ${color}30`, background: '#fafafa' } },
                  isAdding
                    ? React.createElement('div', { style: { display: 'flex', gap: '6px' } },
                        React.createElement(Input, { value: newAsin, placeholder: '竞对 ASIN', autoFocus: true, onChange: e => setNewAsin(e.target.value), onPressEnter: () => addRecord(role) }),
                        React.createElement(Button, { type: 'primary', size: 'small', onClick: () => addRecord(role), loading: saving }, '✓'),
                        React.createElement(Button, { size: 'small', onClick: () => { setAddingRole(null); setNewAsin(''); } }, '✕')
                      )
                    : roleRecords.length >= 1
                      ? React.createElement('div', { style: { textAlign: 'center', fontSize: '12px', color: '#bbb' } }, '已配置')
                      : React.createElement(Button, { block: true, size: 'small', type: 'dashed', onClick: () => setAddingRole(role) }, '添加竞对')
                )
              );
            })
          )
    );

    return React.createElement(Drawer, {
      title: '管理竞对 ASIN（按 Country + ASIN）',
      placement: 'right',
      width: '80vw',
      onClose,
      open: visible,
      extra: loading ? React.createElement('span', { style: { color: '#1890ff' } }, '加载中...') : saving ? React.createElement('span', { style: { color: '#fa8c16' } }, '保存中...') : null,
    }, body);
  };

  const PushPanel = ({ columns, onClose, anchorPos }) => {
    const [userList, setUserList]           = useState([]);
    const [loadingUsers, setLoadingUsers]   = useState(true);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedProps, setSelectedProps] = useState(['hidden','pinned','width','headerColor','editable']);
    const [pushing, setPushing]             = useState(false);

    useEffect(() => {
      (async () => {
        setLoadingUsers(true);
        try {
          const res  = await ctx.request({ url: 'users:list', method: 'get', params: { pageSize: 200, 'filter[level][$ne]': 3 } });
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
      return item;
    }), [selectedProps]);

    const handlePush = useCallback(async () => {
      if (!selectedUsers.length) { ctx.message.warning('请先选择目标用户'); return; }
      if (!selectedProps.length) { ctx.message.warning('请至少选择一个推送属性'); return; }
      setPushing(true);
      try {
        const payload = buildPayload(columns);
        const results = await Promise.allSettled(
          selectedUsers.map(async (uid) => {
            const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
            const existingSetting = userRes?.data?.data?.setting || {};
            const existingCols    = existingSetting[BLOCK_UID];
            let mergedPayload = payload;
            if (Array.isArray(existingCols) && existingCols.length > 0) {
              const existingMap = Object.fromEntries(existingCols.map((c) => [c.key, c]));
              mergedPayload = payload.map((p) => {
                const merged = { ...(existingMap[p.key] || {}) };
                selectedProps.forEach((prop) => { if (p[prop] !== undefined) merged[prop] = p[prop]; });
                merged.key = p.key;
                return merged;
              });
            }
            await ctx.request({ url: 'users:update', method: 'post', params: { filterByTk: uid }, data: { setting: { ...existingSetting, [BLOCK_UID]: mergedPayload } } });
          })
        );
        const failCount = results.filter((r) => r.status === 'rejected').length;
        if (failCount === 0) { ctx.message.success(`推送成功，已推送给 ${selectedUsers.length} 位用户`); onClose(); }
        else ctx.message.warning(`部分推送失败：${failCount}/${selectedUsers.length} 位用户失败`);
      } catch (err) { ctx.message.error(`推送失败：${err?.message || '未知错误'}`); }
      finally { setPushing(false); }
    }, [selectedUsers, selectedProps, columns, buildPayload]);

    const userOptions = userList.map((u) => ({ label: u.nickname || u.username || `用户${u.id}`, value: u.id }));

    return React.createElement('div', {
      style: { position: 'fixed', top: `${anchorPos.top}px`, left: `${anchorPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', width: '380px', fontSize: `${FONT_SIZE}px` },
      onClick: (e) => e.stopPropagation(),
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', null, '📤 推送列配置给其他用户'),
        React.createElement('span', { onClick: onClose, style: { cursor: 'pointer', color: '#999', fontSize: '18px' } }, '✕'),
      ),
      React.createElement('div', { style: { marginBottom: '14px' } },
        React.createElement('div', { style: { marginBottom: '6px', fontWeight: 600 } }, '选择目标用户'),
        loadingUsers
          ? React.createElement('div', { style: { textAlign: 'center', padding: '8px', color: '#999' } }, '加载用户中...')
          : React.createElement(Select, { mode: 'multiple', allowClear: true, style: { width: '100%' }, placeholder: '请选择要推送的用户', value: selectedUsers, onChange: setSelectedUsers, options: userOptions, maxTagCount: 'responsive', showSearch: true, optionFilterProp: 'label', getPopupContainer: (trigger) => trigger.parentElement || trigger })
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
        React.createElement('button', { onClick: handlePush, disabled: pushing || !selectedUsers.length || !selectedProps.length, style: { padding: '6px 16px', color: '#fff', border: 'none', borderRadius: '4px', fontSize: `${FONT_SIZE}px`, fontWeight: 600, background: (pushing || !selectedUsers.length || !selectedProps.length) ? '#b5d8ff' : '#1890ff', cursor: (pushing || !selectedUsers.length || !selectedProps.length) ? 'not-allowed' : 'pointer' } }, pushing ? '推送中...' : '📤 确认推送'),
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
    const [dateFilterType, setDateFilterType]   = useState('all');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [competitorMasterVisible, setCompetitorMasterVisible] = useState(false);
    const [dynamicKeywordCols, setDynamicKeywordCols] = useState([]);
    const [dynamicCompetitorCols, setDynamicCompetitorCols] = useState([]);
    const [selectedRange, setSelectedRange]     = useState(null);
    const selectingRef = useRef(false);
    const autoWidthDoneRef = useRef(false);
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

    const resizeRef   = useRef(null);
    const dragColKey  = useRef(null);
    const inputRef    = useRef(null);
    const tableWrapRef = useRef(null);
    const clipboardRef = useRef(null);
    const panelBtnRef = useRef(null);
    const pushBtnRef  = useRef(null);
    const panelPos    = useFloatPos(panelBtnRef, showPanel);
    const pushPos     = useFloatPos(pushBtnRef, showPush);

    const urlParams          = useMemo(() => loadUrlParams(), []);
    const filterAsin         = urlParams?.asin    || null;
    const filterCountry      = urlParams?.country || null;

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
      const roleOrder = Object.fromEntries(KW_ROLE_ORDER.map((role, idx) => [role, idx + 1]));
      return [...(records || [])]
        .sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99))
        .map((kw) => {
          const roleLabel = KW_ROLE_LABEL[kw.role] || kw.role || '';
          const targetPart = kw.key_target ? ` / ${kw.key_target}` : '';
          return {
            key: `kw_actual_${kw.id}`,
            src: 'keyword_position',
            field: `kw_actual_${kw.id}`,
            label: `词:${kw.keyword_name || '未命名'}${roleLabel ? `(${roleLabel})` : ''}${targetPart}`,
            hidden: false,
            pinned: false,
            width: 160,
            editable: false,
            headerColor: KW_ROLE_COLORS[kw.role] || '#b5796a',
            _dynamicKind: 'keyword',
            _kwId: kw.id,
          };
        });
    }, []);

    const buildDynamicCompetitorCols = useCallback((records) => {
      const roleOrder = Object.fromEntries(COMPETITOR_SLOT_ORDER.map((role, idx) => [role, idx + 1]));
      return [...(records || [])]
        .sort((a, b) => (roleOrder[a.role] || 99) - (roleOrder[b.role] || 99))
        .map((comp) => ({
          key: `competitor_dynamic_${comp.id}`,
          src: 'competitor',
          field: `competitor_dynamic_${comp.id}`,
          label: `${comp.role || '竞对'}:${comp.competitor_asin || '未命名'}`,
          hidden: false,
          pinned: false,
          width: 180,
          editable: false,
          headerColor: COMPETITOR_SLOT_COLORS[comp.role] || COLOR_BLUE,
          _dynamicKind: 'competitor',
          _competitorId: comp.id,
        }));
    }, []);

    const DATE_FILTER_OPTIONS = [
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

    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: !prev[src] })); }, []);

    useEffect(() => { (async () => { const cols = await buildColumns(); setColumns(cols); })(); }, []);
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

    const getDailySort = useCallback(() => {
      if (!sortConfig.key) return 'date';
      const col = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      if (!col || col.src !== 'daily') return 'date';
      return sortConfig.dir === 'desc' ? `-${col.field}` : col.field;
    }, [sortConfig]);

    const loadData = useCallback(async (options = {}) => {
      const page = options.page ?? curPageRef.current;
      const size = options.size ?? pageSizeRef.current;
      try {
        setLoading(true);
        const dailyFilterAnd = [];
        if (currentUserLevel === 1) dailyFilterAnd.push({ sale_owner: { $eq: currentUserName } });
        if (filterAsin)    dailyFilterAnd.push({ asin:    { $eq: filterAsin    } });
        if (filterCountry) dailyFilterAnd.push({ country: { $eq: filterCountry } });
        const dateRange = getDateRange;
        if (dateRange) {
          dailyFilterAnd.push({ date: { $gte: dateRange[0] } });
          dailyFilterAnd.push({ date: { $lte: dateRange[1] } });
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
              loadData({ page: maxPage, size });
            }
          }
          setLoading(false);
          return;
        }

        const dailyKeyFilter = JSON.stringify({ country_asin_date: { $in: dailyKeys } });
        const weekKeyFilter = JSON.stringify({ country_asin_week: { $in: dailyKeys } });
        const countryAsinKeys = [...new Set(dailyRecords.map(d => d.country && d.asin ? `${d.country}_${d.asin}` : null).filter(Boolean))];
        const countryAsinFilter = JSON.stringify({ country_asin: { $in: countryAsinKeys } });

        const relatedPageSize = Math.max(size, dailyKeys.length, countryAsinKeys.length * 10, 100);

        const [rWeekly, rOrderLink, rEvalWords, rEvalWordsDaily, rCompetitors, rCompetitorsDaily] = await Promise.all([
          ctx.request({ url: 'weekly_performance:list',          method: 'get', params: { pageSize: relatedPageSize, filter: weekKeyFilter } }),
          ctx.request({ url: 'daily_order_link_tracking:list',   method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
          ctx.request({ url: 'new_eval_words:list',              method: 'get', params: { pageSize: relatedPageSize, filter: countryAsinFilter } }),
          ctx.request({ url: 'new_eval_words_daily:list',        method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
          ctx.request({ url: 'order_link_competitor_asins:list', method: 'get', params: { pageSize: Math.max(countryAsinKeys.length * 5, 100), filter: countryAsinFilter } }),
          ctx.request({ url: 'order_link_competitor_asins_daily:list', method: 'get', params: { pageSize: Math.max(dailyKeys.length * 5, 100), filter: dailyKeyFilter } }),
        ]);

        const weeklyRecords    = Array.isArray(rWeekly?.data?.data)     ? rWeekly.data.data     : [];
        const orderLinkRecords = Array.isArray(rOrderLink?.data?.data)  ? rOrderLink.data.data  : [];
        const evalWordsRecords = Array.isArray(rEvalWords?.data?.data)  ? rEvalWords.data.data  : [];
        const evalWordsDailyRecords = Array.isArray(rEvalWordsDaily?.data?.data) ? rEvalWordsDaily.data.data : [];
        const competitorRecords = Array.isArray(rCompetitors?.data?.data) ? rCompetitors.data.data : [];
        const competitorDailyRecords = Array.isArray(rCompetitorsDaily?.data?.data) ? rCompetitorsDaily.data.data : [];

        const keywordCols = buildDynamicKeywordCols(evalWordsRecords);
        const competitorCols = buildDynamicCompetitorCols(competitorRecords);
        setDynamicKeywordCols(keywordCols);
        setDynamicCompetitorCols(competitorCols);


        const weeklyMap = {};
        weeklyRecords.forEach((w) => {
          if (w.country_asin_week) {
            weeklyMap[w.country_asin_week] = w;
          }
        });

        const orderLinkMap = {};
        orderLinkRecords.forEach((o) => {
          if (o.country_asin_date) {
            orderLinkMap[o.country_asin_date] = o;
          }
        });

        const evalWordsByCountryAsin = {};
        evalWordsRecords.forEach((e) => {
          if (!e.country_asin) return;
          if (!evalWordsByCountryAsin[e.country_asin]) evalWordsByCountryAsin[e.country_asin] = [];
          evalWordsByCountryAsin[e.country_asin].push(e);
        });

        const evalWordsDailyMap = {};
        evalWordsDailyRecords.forEach((e) => {
          const dateStr = e.date ? String(e.date).slice(0, 10) : '';
          if (e.eval_word_id && dateStr) evalWordsDailyMap[`${e.eval_word_id}_${dateStr}`] = e;
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


        const mergedData = dailyRecords.map((d) => {
          const key = d.country_asin_date;
          const weeklyData = weeklyMap[key] || {};
          const orderLinkData = orderLinkMap[key] || {};
          const countryAsin = d.country && d.asin ? `${d.country}_${d.asin}` : null;
          const dateStr = d.date ? String(d.date).slice(0, 10) : null;

          const merged = {
            ...weeklyData,
            ...orderLinkData,
            ...d,
          };
          merged.order_link_real_session_conversion_rate = orderLinkData.real_session_conversion_rate;

          if (countryAsin && dateStr) {
            const rowKeywords = evalWordsByCountryAsin[countryAsin] || [];
            keywordCols.forEach((col) => {
              const kw = rowKeywords.find(k => k.id === col._kwId);
              if (!kw) return;
              merged[col.field] = {
                kw,
                daily: evalWordsDailyMap[`${kw.id}_${dateStr}`] || {},
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
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
      } finally { setLoading(false); }
    }, [filterAsin, filterCountry, currentUserName, currentUserLevel, getDateRange, getDailySort, buildDynamicKeywordCols, buildDynamicCompetitorCols]);

    useEffect(() => { setCurPage(1); loadData({ page: 1 }); }, [loadData]);

    useEffect(() => {
      if (!data.length || autoWidthDoneRef.current) return;
      const padding = 24;
      const sample = data.length <= 500 ? data : data.slice(0, 500);
      setColumns((prev) => {
        const next = prev.map((col) => {
          if (manuallyResizedRef.current.has(col.key)) return col;
          let maxWidth = estimateTextWidth(col.label, FONT_SIZE_SM);
          sample.forEach((row) => {
            const value = row[col.field];
            let displayStr;
            if (value == null || value === '') displayStr = '—';
            else if (col.field === 'order_structure_diagnostic') displayStr = ORDER_STRUCTURE_DIAGNOSED_MAP[value] || String(value) || '—';
            else if (MONEY_FIELDS.has(col.field)) displayStr = Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
            else if (RATE_FIELDS.has(col.field)) displayStr = `${(Number(value) * 100).toFixed(2)}%`;
            else if (DATE_FIELDS.has(col.field)) {
              if (!value) displayStr = '—';
              else {
                const d = new Date(value);
                displayStr = d.toLocaleDateString('zh-CN');
                if (col.field === 'date') { const wd = ['周日','周一','周二','周三','周四','周五','周六']; displayStr = `${displayStr} ${wd[d.getDay()]}`; }
              }
            } else displayStr = String(value);
            const w = estimateTextWidth(displayStr, FONT_SIZE);
            if (w > maxWidth) maxWidth = w;
          });
          return { ...col, width: Math.max(60, Math.ceil(maxWidth + padding)) };
        });
        saveColsToUser(next);
        return next;
      });
      autoWidthDoneRef.current = true;
    }, [data]);

    const onPageChange = useCallback((page, size) => {
      if (size !== pageSizeRef.current) {
        setCurPage(1);
        setPageSize(size);
        loadData({ page: 1, size });
      } else {
        setCurPage(page);
        loadData({ page, size });
      }
    }, [loadData]);

    const handleSort = useCallback((colKey) => {
      setSortConfig((prev) => ({
        key: colKey,
        dir: prev.key === colKey && prev.dir === 'asc' ? 'desc' : 'asc',
      }));
      setCurPage(1);
    }, []);

    const sortedData = useMemo(() => {
      if (!sortConfig.key || !data.length) return data;
      const col   = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      const field = col ? col.field : sortConfig.key;
      return [...data].sort((a, b) => {
        let va = a[field], vb = b[field];
        if (ALL_NUMERIC.has(field)) { va = Number(va) || 0; vb = Number(vb) || 0; return sortConfig.dir === 'asc' ? va - vb : vb - va; }
        if (DATE_FIELDS.has(field)) {
          const ta = va ? new Date(va).getTime() : 0;
          const tb = vb ? new Date(vb).getTime() : 0;
          return sortConfig.dir === 'asc' ? ta - tb : tb - ta;
        }
        const cmp = String(va || '').localeCompare(String(vb || '')); return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }, [data, sortConfig]);

    const pagedData = sortedData;

    const allColumns = useMemo(() => {
      const baseCols = columns.filter(c => !(c.field && (c.field.startsWith('kw_actual_') || c.field.startsWith('competitor_dynamic_'))));
      const keywordCols = dynamicKeywordCols;
      const competitorCols = dynamicCompetitorCols;
      const insertKeywordAfter = baseCols.findIndex(c => c.key === 'weekly_zongcvr');
      const withKeywords = insertKeywordAfter >= 0
        ? [...baseCols.slice(0, insertKeywordAfter + 1), ...keywordCols, ...baseCols.slice(insertKeywordAfter + 1)]
        : [...baseCols, ...keywordCols];
      const insertCompetitorAfter = withKeywords.findIndex(c => c.key === 'order_link_order_structure_diagnostic');
      return insertCompetitorAfter >= 0
        ? [...withKeywords.slice(0, insertCompetitorAfter + 1), ...competitorCols, ...withKeywords.slice(insertCompetitorAfter + 1)]
        : [...withKeywords, ...competitorCols];
    }, [columns, dynamicKeywordCols, dynamicCompetitorCols]);

    const updateDynamicCol = (key, updater) => {
      const setFn = key.startsWith('kw_actual_') ? setDynamicKeywordCols : key.startsWith('competitor_dynamic_') ? setDynamicCompetitorCols : null;
      if (!setFn) return false;
      setFn(prev => prev.map(c => c.key === key ? updater(c) : c));
      return true;
    };

    const toggleCol      = (key) => { if (updateDynamicCol(key, c => ({ ...c, hidden: !c.hidden }))) return; updateAndSave((p) => { const col = p.find((c) => c.key === key); if (!col) return p; if (!col.hidden) return p.map((c) => c.key === key ? { ...c, hidden: true } : c); return [...p.filter((c) => c.key !== key), { ...col, hidden: false }]; }); };
    const togglePin      = (key) => { if (updateDynamicCol(key, c => ({ ...c, pinned: !c.pinned }))) return; updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c)); };
    const setHColor      = (key, color) => { if (updateDynamicCol(key, c => ({ ...c, headerColor: color }))) return; updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c)); };
    const clearHColor    = (key) => { if (updateDynamicCol(key, c => ({ ...c, headerColor: null }))) return; updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c)); };
    const toggleEditable = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c));
    const selectAll      = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: false })));
    const deselectAll    = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: true  })));

    const visibleCols   = useMemo(() => { const vis = allColumns.filter((c) => !c.hidden && c.src !== 'tool'); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [allColumns]);
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += col.width || 80; } }); return map; }, [visibleCols]);

    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();
    const onDrop      = (e, targetKey) => { e.preventDefault(); const fromKey = dragColKey.current; if (!fromKey || fromKey === targetKey) return; if (fromKey.startsWith('kw_actual_') || fromKey.startsWith('competitor_dynamic_') || targetKey.startsWith('kw_actual_') || targetKey.startsWith('competitor_dynamic_')) { dragColKey.current = null; return; } updateAndSave((prev) => { const next = [...prev]; const fi = next.findIndex((c) => c.key === fromKey); const ti = next.findIndex((c) => c.key === targetKey); if (fi < 0 || ti < 0) return prev; const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved); return next; }); dragColKey.current = null; };

    const onResizeStart = useCallback((e, colKey) => { e.preventDefault(); e.stopPropagation(); const col = allColumns.find((c) => c.key === colKey); resizeRef.current = { colKey, startX: e.clientX, startWidth: col?.width || 80 }; setIsResizing(true); manuallyResizedRef.current.add(colKey); }, [allColumns]);
    const onOverlayMove = useCallback((e) => { if (!resizeRef.current) return; const { colKey, startX, startWidth } = resizeRef.current; const nw = Math.max(40, startWidth + (e.clientX - startX)); if (updateDynamicCol(colKey, c => ({ ...c, width: nw }))) return; updateAndSave((p) => p.map((c) => c.key === colKey ? { ...c, width: nw } : c)); }, []);
    const onOverlayUp   = useCallback(() => { resizeRef.current = null; setIsResizing(false); }, []);

    const isCellEditable = useCallback((col) => { if (READONLY_FIELDS.has(col.field)) return false; return col.editable === true; }, []);

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

    const getClipboardValue = useCallback((col, row) => {
      const value = row?.[col.field];
      if (value == null || value === '') return '';
      if (RATE_FIELDS.has(col.field)) return String(Number(value) * 100);
      if (DATE_FIELDS.has(col.field)) return String(value).slice(0, 10);
      return String(value);
    }, []);

    const parsePastedValue = useCallback((col, rawValue) => {
      const text = String(rawValue ?? '').trim();
      if (text === '') return null;
      if (col.field === 'order_structure_diagnostic') {
        return text;
      }
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

    const buildOrderLinkFormulaUpdates = useCallback((row) => {
      const orderItems  = toFormulaNumber(row.order_items);
      const rsgNumber   = toFormulaNumber(row.rsg_number);
      const guanggaodan = toFormulaNumber(row.guanggaodan);
      const traffic     = toFormulaNumber(row.zongliuliang);

      // ③站内:纯自然+广告单 = weekly_performance.order_items - daily_asins.rsg_number
      const totalOnsiteOrders =
        orderItems == null || rsgNumber == null
          ? null
          : orderItems - rsgNumber;

      // ④站内纯自然单 = daily_order_link_tracking.total_onsite_orders - weekly_performance.guanggaodan
      const onsiteOrganicOrders =
        totalOnsiteOrders == null || guanggaodan == null
          ? null
          : totalOnsiteOrders - guanggaodan;

      const onsiteOrganicOrdersRatio =
        onsiteOrganicOrders == null || orderItems == null || orderItems === 0
          ? null
          : onsiteOrganicOrders / orderItems;

      const realSessionConversionRate =
        orderItems == null || rsgNumber == null || traffic == null || traffic === 0
          ? null
          : (orderItems - rsgNumber) / traffic;

      return {
        total_onsite_orders: totalOnsiteOrders,
        onsite_organic_orders: onsiteOrganicOrders,
        onsite_organic_orders_ratio: onsiteOrganicOrdersRatio,
        real_session_conversion_rate: realSessionConversionRate,
      };
    }, []);



    const syncOrderLinkFormulaForRow = useCallback(async (row) => {
      const key = row?.country_asin_date || row?.id;
      if (!key) return null;

      const updates = buildOrderLinkFormulaUpdates(row);

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
          data: {
            country_asin_date: key,
            country: row.country || null,
            asin: row.asin || null,
            date: row.date || null,
            ...updates,
          },
        });
      }

      return {
        ...updates,
        order_link_real_session_conversion_rate: updates.real_session_conversion_rate,
      };
    }, [buildOrderLinkFormulaUpdates]);


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

    useEffect(() => {
      const handleGlobalMouseUp = () => {
          selectingRef.current = false;
        };

        window.addEventListener('mouseup', handleGlobalMouseUp, true);

        return () => {
          window.removeEventListener('mouseup', handleGlobalMouseUp, true);
        };
    }, []);

    const handleCopy = useCallback((e) => {
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

    const handlePaste = useCallback(async (e) => {
      if (editingCell || saving) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;

      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      e.preventDefault();

      const matrix = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((line) => line.split('\t'));
      while (matrix.length && matrix[matrix.length - 1].length === 1 && matrix[matrix.length - 1][0] === '') matrix.pop();
      if (!matrix.length) return;

      const ops = [];
      const localPatches = new Map();
      const recalcRows = new Set();


      matrix.forEach((line, rr) => {
        line.forEach((cellText, cc) => {
          const row = pagedData[rect.r1 + rr];
          const col = visibleCols[rect.c1 + cc];
          if (!row || !col || !isCellEditable(col)) return;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) return;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) return;
          const rowId = row.country_asin_date || row.id;
          const valueToSave = parsePastedValue(col, cellText);
          ops.push({ rowId, field: col.field, updateConfig, pkValue, valueToSave });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: valueToSave });
          if (ORDER_LINK_FORMULA_TRIGGER_FIELDS.has(col.field)) {
            recalcRows.add(rowId);
          }

        });
      });

      if (!ops.length) {
        ctx.message.warning('粘贴区域没有可编辑单元格');
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

        const formulaPatchMap = new Map();

        for (const rowId of recalcRows) {
          const baseRow = data.find((r) => (r.country_asin_date || r.id) === rowId);
          const localPatch = localPatches.get(rowId) || {};

          if (!baseRow) continue;

          const nextRow = {
            ...baseRow,
            ...localPatch,
          };

          const formulaUpdates = await syncOrderLinkFormulaForRow(nextRow);

          if (formulaUpdates) {
            formulaPatchMap.set(rowId, formulaUpdates);
          }
        }

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          const formulaPatch = formulaPatchMap.get(rowId);

          return patch || formulaPatch
            ? {
                ...row,
                ...(patch || {}),
                ...(formulaPatch || {}),
              }
            : row;
        }));

        ctx.message.success(
          recalcRows.size
            ? `已粘贴 ${ops.length} 个单元格，已同步 ${recalcRows.size} 行公式`
            : `已粘贴 ${ops.length} 个单元格`
        );

      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [editingCell, isCellEditable, normalizeSelection, pagedData, parsePastedValue, saving, selectedRange, visibleCols, data, syncOrderLinkFormulaForRow]);

    const startEdit = useCallback((rowId, col, currentValue) => {
      if (saving) return;
      setSelectedRange(null);
      setEditingCell({ rowId, colKey: col.key, field: col.field, src: col.src });
      if (col.field === 'order_structure_diagnostic') {
        setEditValue(currentValue || '');
      } else {
        setEditValue(RATE_FIELDS.has(col.field) && currentValue != null && currentValue !== '' ? Number(currentValue) * 100 : (currentValue != null && currentValue !== '' ? currentValue : ''));
      }
    }, [saving]);

    const cancelEdit = useCallback(() => { setEditingCell(null); setEditValue(null); }, []);

    const saveEdit = useCallback(async () => {
      if (!editingCell || saving) return;
      const { rowId, field, src } = editingCell;
      const updateConfig = SRC_UPDATE_CONFIG[src];
      if (!updateConfig) { ctx.message.error(`字段来源 "${src}" 暂不支持编辑`); return; }
      const row = data.find((r) => (r.country_asin_date || r.id) === rowId);
      if (!row) return;
      const pkValue = row[updateConfig.pkField];
      if (!pkValue) { ctx.message.error(`无法找到记录主键（${updateConfig.pkField}）`); cancelEdit(); return; }
      let valueToSave = editValue;
      if (field === 'order_structure_diagnostic') {
        valueToSave = editValue || null;
      } else if (RATE_FIELDS.has(field)) {
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

        if (ORDER_LINK_FORMULA_TRIGGER_FIELDS.has(field)) {
          formulaUpdates = await syncOrderLinkFormulaForRow(nextRow);
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
    }, [editingCell, editValue, data, saving, syncOrderLinkFormulaForRow]);



    const recalcAllOrderLinkFormulas = useCallback(async () => {
      if (!IS_ADMIN) {
        ctx.message.warning('只有管理员可以执行自动计算');
        return;
      }

      const rows = data.filter((r) => r.country_asin_date || r.id);

      if (!rows.length) {
        ctx.message.warning('当前没有可计算的数据');
        return;
      }

      setCalcLoading(true);
      setCalcProgress('准备计算...');

      try {
        const keys = [...new Set(rows.map((r) => r.country_asin_date || r.id).filter(Boolean))];

        setCalcProgress('正在读取订单链接记录...');

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

        const updateJobs = [];
        const patchMap = {};

        rows.forEach((row) => {
          const key = row.country_asin_date || row.id;
          if (!key) return;

          const updates = buildOrderLinkFormulaUpdates(row);
          patchMap[key] = {
            ...updates,
            order_link_real_session_conversion_rate: updates.real_session_conversion_rate,
          };

          updateJobs.push({
            key,
            row,
            updates,
            exists: !!existingMap[key],
            existingId: existingMap[key]?.id,
          });
        });

        if (!updateJobs.length) {
          ctx.message.warning('没有可更新的数据');
          return;
        }

        setCalcProgress(`准备写回 ${updateJobs.length} 条...`);

        let successCount = 0;
        let failCount = 0;

        const batchSize = 8;

        for (let i = 0; i < updateJobs.length; i += batchSize) {
          const batch = updateJobs.slice(i, i + batchSize);

          setCalcProgress(`正在写回 ${Math.min(i + batch.length, updateJobs.length)}/${updateJobs.length}...`);

          const results = await Promise.allSettled(
            batch.map(async (job) => {
              if (job.exists) {
                await ctx.request({
                  url: 'daily_order_link_tracking:update',
                  method: 'post',
                  params: { filterByTk: job.key },
                  data: job.updates,
                });
              } else {
                await ctx.request({
                  url: 'daily_order_link_tracking:create',
                  method: 'post',
                  data: {
                    country_asin_date: job.key,
                    country: job.row.country || null,
                    asin: job.row.asin || null,
                    date: job.row.date || null,
                    ...job.updates,
                  },
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
        } else {
          ctx.message.success(`公式计算完成：成功 ${successCount} 条`);
        }
      } catch (err) {
        console.error(err);
        ctx.message.error(`公式计算失败：${err?.message || '未知错误'}`);
      } finally {
        setCalcLoading(false);
        setCalcProgress('');
      }
    }, [data, buildOrderLinkFormulaUpdates]);


    const saveOrderLinkRichField = useCallback(async (row, field, newContent) => {
      const key = row?.country_asin_date || row?.id;
      if (!key) { ctx.message.error('无法找到记录主键'); return false; }
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
            data: {
              country_asin_date: key,
              country: row.country || null,
              asin: row.asin || null,
              date: row.date || null,
              [field]: newContent || null,
            },
          });
        }
        setData(prev => prev.map(r => (r.country_asin_date || r.id) === key ? { ...r, [field]: newContent || null } : r));
        return true;
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
        return false;
      }
    }, []);

    const saveKeywordRichCell = useCallback(async (row, col, newContent) => {
      const rowId = row?.country_asin_date || row?.id;
      const payload = row?.[col.field];
      const kw = payload?.kw;
      const daily = payload?.daily || {};
      if (!rowId || !kw?.id) { ctx.message.error('无法找到关键词记录'); return false; }
      try {
        let nextDaily = { ...daily, actual_rank: newContent || null };
        if (daily.id) {
          await ctx.request({ url: 'new_eval_words_daily:update', method: 'post', params: { filterByTk: daily.id }, data: { actual_rank: newContent || null } });
        } else {
          const res = await ctx.request({
            url: 'new_eval_words_daily:create',
            method: 'post',
            data: {
              country_asin_date: rowId,
              eval_word_id: kw.id,
              date: row.date ? String(row.date).slice(0, 10) : null,
              actual_rank: newContent || null,
            },
          });
          nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
        }
        setData(prev => prev.map(r => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
        return true;
      } catch (err) {
        ctx.message.error(`保存关键词失败：${err?.message || ''}`);
        return false;
      }
    }, []);

    const saveCompetitorRichCell = useCallback(async (row, col, newContent) => {
      const rowId = row?.country_asin_date || row?.id;
      const payload = row?.[col.field];
      const competitor = payload?.competitor;
      const daily = payload?.daily || {};
      if (!rowId || !competitor?.id) { ctx.message.error('无法找到竞对记录'); return false; }
      try {
        let nextDaily = { ...daily, notes: newContent || null };
        if (daily.id) {
          await ctx.request({ url: 'order_link_competitor_asins_daily:update', method: 'post', params: { filterByTk: daily.id }, data: { notes: newContent || null } });
        } else {
          const res = await ctx.request({
            url: 'order_link_competitor_asins_daily:create',
            method: 'post',
            data: {
              country_asin_date: rowId,
              competitor_id: competitor.id,
              date: row.date ? String(row.date).slice(0, 10) : null,
              notes: newContent || null,
            },
          });
          nextDaily = { ...nextDaily, ...(res?.data?.data || {}) };
        }
        setData(prev => prev.map(r => (r.country_asin_date || r.id) === rowId ? { ...r, [col.field]: { ...payload, daily: nextDaily } } : r));
        return true;
      } catch (err) {
        ctx.message.error(`保存竞对失败：${err?.message || ''}`);
        return false;
      }
    }, []);

    const refreshData  = useCallback(() => { loadData({ page: curPageRef.current, size: pageSizeRef.current }); ctx.message.success('数据已刷新'); }, [loadData]);
    const resetColumns = useCallback(async () => { const defaults = INITIAL_COLUMNS.map((c) => ({ ...c })); setColumns(defaults); await saveColsToUser(defaults); ctx.message.success('列已重置为默认'); }, []);

    const btnStyle = (bg, color, border) => ({ padding: '5px 12px', background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE}px`, whiteSpace: 'nowrap' });

    const renderEditInput = (col) => {
      if (col.field === 'order_structure_diagnostic') {
        return React.createElement(Select, {
          ref: inputRef, value: editValue || undefined, options: ORDER_STRUCTURE_DIAGNOSED_OPTIONS,
          style: { width: '100%' }, size: 'small',
          onChange: (v) => setEditValue(v),
          onBlur: () => { if (editValue) saveEdit(); else cancelEdit(); },
          onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); },
        });
      }
      const commonProps = { ref: inputRef, value: editValue, onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); }, style: { width: '100%' }, size: 'small' };
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
        IS_ADMIN && !READONLY_FIELDS.has(col.field) && React.createElement('label', { title: '双击单元格可编辑', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: col.editable === true, onChange: () => toggleEditable(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999' } }, '编辑'),
        ),
        React.createElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } },
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
            React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#aaa', fontWeight: 400 } }, IS_ADMIN ? '📌 固定 | ☑ 显示 | 🎨 颜色 | 编辑' : '📌 固定 | ☑ 显示 | 🎨 颜色'),
            React.createElement('button', { onClick: selectAll,   style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
            React.createElement('button', { onClick: deselectAll, style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
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

    return React.createElement('div', { style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),

      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' } },
        React.createElement('button', { onClick: () => setCompetitorMasterVisible(true), style: btnStyle('#fff7e6', '#fa8c16', '#fa8c16') }, '管理竞对 ASIN'),
        IS_ADMIN && React.createElement('button', { onClick: resetColumns, style: btnStyle('#1890ff', '#fff', '#1890ff') }, '？ 重置列'),
        React.createElement('button', { ref: panelBtnRef, onClick: () => { setShowPanel((v) => !v); setShowPush(false); }, style: btnStyle(showPanel ? '#e6f7ff' : '#fff', '#333', showPanel ? '#1890ff' : '#d9d9d9') }, '👁️ 列设置'),
        IS_ADMIN && React.createElement('button', { ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); }, style: btnStyle(showPush ? '#fff7e6' : '#fff', showPush ? '#fa8c16' : '#333', showPush ? '#fa8c16' : '#d9d9d9') }, '📤 推送配置'),
        React.createElement('button', { onClick: refreshData, style: btnStyle('#fff', '#333', '#d9d9d9') }, '🔄 刷新'),
        IS_ADMIN && React.createElement(Popconfirm, {
          title: `确定要重新计算当前页 ${data.length} 条订单结构公式吗？`,
          onConfirm: recalcAllOrderLinkFormulas,
          okText: '开始计算',
          cancelText: '取消',
          disabled: calcLoading || loading || !data.length,
        },
          React.createElement('button', {
            disabled: calcLoading || loading || !data.length,
            style: {
              ...btnStyle(
                calcLoading ? '#f5f5f5' : '#f6ffed',
                calcLoading ? '#999' : '#389e0d',
                calcLoading ? '#d9d9d9' : '#52c41a'
              ),
              fontWeight: 700,
              opacity: calcLoading || loading || !data.length ? 0.65 : 1,
              cursor: calcLoading || loading || !data.length ? 'not-allowed' : 'pointer',
              minWidth: '150px',
            }
          },
            calcLoading
              ? `🧮 ${calcProgress || '计算中...'}`
              : '🧮 计算公式'
          )
        ),
        React.createElement(Select, { value: dateFilterType, onChange: (v) => { setDateFilterType(v); if (v !== 'custom') setCustomDateRange(null); }, options: DATE_FILTER_OPTIONS, style: { width: '120px' }, size: 'small' }),
        React.createElement(DatePicker.RangePicker, {
          locale: DATE_PICKER_LOCALE,
          value: customDateRange ? [ctx.libs.dayjs(customDateRange[0]), ctx.libs.dayjs(customDateRange[1])] : null,
          onChange: (dates) => {
            if (dates && dates[0] && dates[1]) { const range = [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]; setCustomDateRange(range); setDateFilterType('custom'); }
            else { setCustomDateRange(null); if (dateFilterType === 'custom') setDateFilterType('all'); }
          },
          size: 'small', style: { width: '220px', opacity: dateFilterType === 'custom' ? 1 : 0.45 },
          placeholder: ['开始日期', '结束日期'], allowClear: true,
        }),
        React.createElement('span', { style: { fontSize: `${FONT_SIZE_SM}px`, color: '#888' } }, loading ? '加载中...' : `共 ${total} 条记录`),
      ),

      panelEl,
      pushPanelEl,

      React.createElement('div', {
        style: {
          display: 'flex',
          gap: '12px',
          flexWrap: 'wrap',
          marginBottom: '10px',
          padding: '6px 12px',
          background: '#fafafa',
          borderRadius: '6px',
          border: '1px solid #e8e8e8',
          alignItems: 'center',
          fontSize: `${FONT_SIZE_XS}px`
        }
      },
        React.createElement('span', { style: { fontWeight: 600, color: '#555', marginRight: '4px' } }, '🎨 列头颜色：'),
        ...PRESET_COLORS.map(pc =>
          React.createElement('div', { key: pc.value, style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            React.createElement('div', { style: { width: '14px', height: '14px', borderRadius: '3px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
            React.createElement('span', { style: { color: '#666' } }, pc.label)
          )
        ),
      ),

      React.createElement('textarea', {
        ref: clipboardRef,
        value: '',
        onChange: () => {},
        onCopy: handleCopy,
        onPaste: handlePaste,
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

      React.createElement('div', {
        ref: tableWrapRef,
        tabIndex: 0,
        onCopy: handleCopy,
        onPaste: handlePaste,
        onMouseUp: stopSelecting,
        onMouseLeave: stopSelecting,
        style: {
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 200px)',
          borderRadius: '6px',
          border: '1px solid #e8e8e8',
          boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
          outline: 'none'
        } },
        loading && data.length === 0
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '正在加载数据...')
          : data.length === 0
            ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据')
            : React.createElement('table', { style: { borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', background: '#fff', width: `${tableWidth}px` } },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  visibleCols.map((col) => {
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const canEdit  = isCellEditable(col);
                    const hdrColor = getColHeaderColor(col);
                    const formulaDesc = FORMULA_DESCRIPTIONS[col.field] || null;
                    
                    return React.createElement('th', {
                      key: col.key, draggable: true, onDragStart: (e) => onDragStart(e, col.key), onDragOver, onDrop: (e) => onDrop(e, col.key), onClick: () => handleSort(col.key),
                      style: {
                        position: 'sticky',
                        top: 0,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${col.width || 80}px`,
                        padding: '8px 18px 8px 8px',
                        background: hdrColor,
                        color: getTextColorForBg(hdrColor),
                        borderBottom: '2px solid rgba(0,0,0,0.1)',
                        borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                        textAlign: 'left',
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
                          maxWidth: '100%',
                          overflow: 'hidden',
                          verticalAlign: 'middle',
                        }
                      },
                        React.createElement('span', {
                          style: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }
                        }, col.label),

                        formulaDesc && React.createElement(Tooltip, {
                          title: React.createElement('pre', {
                            style: {
                              margin: 0,
                              fontFamily: 'inherit',
                              fontSize: '12px',
                              whiteSpace: 'pre-wrap',
                              lineHeight: 1.6,
                            }
                          }, formulaDesc),
                          placement: 'top',
                          overlayStyle: { maxWidth: '460px' },
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
                              marginLeft: '5px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              width: '18px',
                              height: '18px',
                              borderRadius: '4px',
                              background: 'rgba(24,144,255,0.88)',
                              color: '#fff',
                              fontSize: `${FONT_SIZE_XS}px`,
                              fontWeight: 700,
                              cursor: 'help',
                              flexShrink: 0,
                              lineHeight: 1,
                            },
                          }, '？')
                        ),

                        React.createElement('span', {
                          style: {
                            marginLeft: '3px',
                            opacity: sortConfig.key === col.key ? 1 : 0.4,
                            fontSize: `${FONT_SIZE_XS}px`,
                            flexShrink: 0,
                          }
                        }, sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'),
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

                      if (col._dynamicKind === 'keyword' || col._dynamicKind === 'competitor' || RICH_TEXT_FIELDS.has(col.field)) {
                        const richValue =
                          col._dynamicKind === 'keyword'
                            ? row[col.field]?.daily?.actual_rank
                            : col._dynamicKind === 'competitor'
                            ? row[col.field]?.daily?.notes
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
                            background: selected ? '#e6f4ff' : (rIdx % 2 === 0 ? '#fff' : '#fafafa'),
                            padding: '4px',
                            borderBottom: '1px solid #f0f0f0',
                            borderRight: isPinned ? '2px solid rgba(0,0,0,0.08)' : '1px solid #f5f5f5',
                            verticalAlign: 'middle',
                            boxSizing: 'border-box',
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined,
                          },
                        }, React.createElement(RichTextImageCell, {
                          value: richValue,
                          onSave: saveRich,
                          placeholder: col._dynamicKind === 'keyword' ? '双击填写自然位 / 粘贴截图' : '双击编辑 / 粘贴截图',
                        }));
                      }

                      const displayContent = formatCell(col, row);

                      return React.createElement('td', {
                        key: col.key, title: typeof displayContent === 'string' ? displayContent : undefined,
                        onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                        onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, row[col.field]); },
                        style: {
                          position: isPinned ? 'sticky' : undefined,
                          left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 1 : undefined,
                          background: selected ? '#e6f4ff' : (rIdx % 2 === 0 ? '#fff' : '#fafafa'),
                          padding: isEditing ? '4px 6px' : '7px 8px',
                          borderBottom: '1px solid #f0f0f0',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.08)' : '1px solid #f5f5f5',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: isNum ? 'right' : 'left',
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
                      }, isEditing ? renderEditInput(col) : displayContent);
                    })
                  );
                })
              )
            )
      ),

      React.createElement('div', { style: { marginTop: '12px', display: 'flex', justifyContent: 'flex-end' } },
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
      React.createElement('div', { style: { padding: '16px', fontFamily: 'system-ui, sans-serif', fontSize: `${FONT_SIZE}px` } },
        React.createElement(MergedTable, null)
      )
    );
  };

  ctx.render(React.createElement(TableApp));
}

run();
