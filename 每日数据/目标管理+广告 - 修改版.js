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
    daily: COLOR_GREEN, weekly: COLOR_ORANGE, target: COLOR_PURPLE,
    orderLink: COLOR_TEAL,
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
  ]);
    const RATE_FIELDS  = new Set([
    'off','real_session_conversion_rate',
    'zongcvr','guanggaocvr','volume_cvr','acos','tacos',
    'weekly_target_completion_rate','target_ad_cvr','target_profit_margin','target_ad_spend_rate',
    'natural_traffic_proportion','return_rate','return_goods_rate',
    'ctr','adv_rate','natural_single_ratio',
    'onsite_organic_orders_ratio',
  ]);
  const NUM_FIELDS   = new Set([
    'star_rating','number_of_comments','promotion_days','lp_duration_days','rsg_number','target_gap',
    'sales','zirandan','guanggaodan','order_items','ranking',
    'ad_direct_order_quantity','indirect_order_volume','impressions','page_views_total','organic_traffic',
    'return_count','return_goods_count',
    'target_subcategory_rank','target_order_qty','goal_subcategory_rank',
    'prev_rank','reviews_count','promotion_volume','b2b_volume',
    'sessions','sessions_mobile','zongliuliang','guanggaodianji','zirandianji',
  ]);
  const ZERO_AS_EMPTY_FIELDS = new Set([
    'target_cpa',
    'ideal_cpu_by_margin',
    'stage_target_cpu',
  ]);
  const isBlankLike = (v) => {
      return v === null || v === undefined || v === '';
  };

  const isZeroAsEmpty = (field, v) => {
    return ZERO_AS_EMPTY_FIELDS.has(field) && Number(v) === 0;
  };

  const isFormulaBlank = (field, v) => {
    return isBlankLike(v) || isZeroAsEmpty(field, v);
  };

  const DATE_FIELDS  = new Set(['date','updatedAt']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  // 只读字段
  const READONLY_FIELDS = new Set([
    'country_asin_date','country_asin_week','id','country','asin','date','updatedAt',
    'goal_subcategory_rank','target_ad_cvr_formula','target_cpa_formula',
    'ideal_cpu_by_margin_formula','stage_target_cpu_formula',
    'target_profit_margin_formula','target_ad_spend_rate_formula',
  ]);

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
    { key:'weekly_zongcvr',                     src:'weekly', field:'zongcvr',                      label:'总CVR',  hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_guanggaocvr',                 src:'weekly', field:'guanggaocvr',                  label:'CVR',        hidden:false, pinned:false, width:90,  editable:false },
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
    { key:'weekly_zongliuliang',                src:'weekly', field:'zongliuliang',                 label:'实际流量',        hidden:false, pinned:false, width:80,  editable:false },
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
    { key:'weekly_sessions',                    src:'weekly', field:'sessions',                     label:'Sessions-Browser',hidden:false, pinned:false, width:130, editable:false },
    { key:'weekly_sessions_mobile',             src:'weekly', field:'sessions_mobile',              label:'Sessions-Mobile', hidden:false, pinned:false, width:130, editable:false },
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
    { key:'orderLink_onsite_organic_orders_ratio', src:'orderLink', field:'onsite_organic_orders_ratio', label:'④站内纯自然单占比', hidden:false, pinned:false, width:150, editable:false },
    // —— target ——
    { key:'target_target_subcategory_rank',       src:'target', field:'target_subcategory_rank',       label:'目标拆解 - 小类排名', hidden:false, pinned:false, width:130, editable:false },
    { key:'target_target_order_qty',              src:'target', field:'target_order_qty',              label:'目标拆解 - 单量',     hidden:false, pinned:false, width:110, editable:false },
    { key:'target_weekly_target_completion_rate', src:'target', field:'weekly_target_completion_rate', label:'本周目标完成率',      hidden:false, pinned:false, width:120, editable:false },
    { key:'target_goal_subcategory_rank',         src:'target', field:'goal_subcategory_rank',         label:'目标小类排名',        hidden:false, pinned:false, width:110, editable:false },
    { key:'target_sales_mom_rate',                src:'target', field:'sales_mom_rate',                label:'销量环比变化',        hidden:false, pinned:false, width:90,  editable:false },
    // 公式字段
    { key:'target_target_ad_cvr_formula',         src:'target', field:'target_ad_cvr_formula',         label:'目标广告 CVR', hidden:false, pinned:false, width:140, editable:false },
    { key:'target_target_cpa_formula',            src:'target', field:'target_cpa_formula',            label:'目标 CPA',     hidden:false, pinned:false, width:130, editable:false },
    { key:'target_ideal_cpu_by_margin_formula',   src:'target', field:'ideal_cpu_by_margin_formula',   label:'目标 CPU',     hidden:false, pinned:false, width:130, editable:false },
    { key:'target_target_profit_margin_formula',  src:'target', field:'target_profit_margin_formula',  label:'目标利润率',   hidden:false, pinned:false, width:130, editable:false },
    { key:'target_target_ad_spend_rate_formula',  src:'target', field:'target_ad_spend_rate_formula',  label:'目标广告费率', hidden:false, pinned:false, width:140, editable:false },
  ];

  const FORMULA_DESCRIPTIONS = {
    goal_subcategory_rank:
`【目标小类排名】对比 实际排名 vs 目标排名
对比 weekly_performance.ranking vs target_subcategory_rank
• 未填目标               → "写目标排名"
• 未填实际               → 空
• 实际 > 目标（更差）    → "未达标 - 拉下X名"
• 实际 ≤ 目标            → "√"`,
    target_ad_cvr_formula:
`【目标广告 CVR - 公式】
对比 weekly_performance.guanggaocvr vs target_default.target_ad_cvr
• 实际 ≥ 目标 → "√"
• 实际 < 目标 → "x -X%"（差额百分比）`,
    target_cpa_formula:
`【目标 CPA - 公式】
对比 weekly_performance.cpa vs target_default.target_cpa
• 实际 > 目标 → "CPA 超标X"
• 实际 ≤ 目标 → "√"`,
    ideal_cpu_by_margin_formula:
`【目标 CPU - 公式】
对比 weekly_performance.cpu vs target_default.ideal_cpu_by_margin
• 实际 > 目标 → "CPU 超标X"
• 实际 ≤ 目标 → "√"`,
    stage_target_cpu_formula:
`【阶段目标 CPU - 公式】
对比 weekly_performance.cpu vs stage_target_cpu
• 实际 > 目标 → "CPU 超标X"
• 实际 ≤ 目标 → "√"`,
    target_profit_margin_formula:
`【目标利润率 - 公式】
对比 daily_profit.profit_margin vs target_default.target_profit_margin
• 实际 < 目标 → "X -X%"（差额百分比）
• 实际 ≥ 目标 → "√"`,
    target_ad_spend_rate_formula:
`【目标广告费率 - 公式】
对比 daily_profit.ad_cost_ratio vs target_default.target_ad_spend_rate
• 实际 > 目标 → "X -X%"（超出百分比）
• 实际 ≤ 目标 → "√"`,
  };

  const SRC_UPDATE_CONFIG = {
    daily:  { url: 'daily_asins:update',        pkField: 'country_asin_date' },
    weekly: { url: 'weekly_performance:update',  pkField: 'country_asin_week' },
    target: { url: 'target_management:update',   pkField: 'country_asin_date' },
  };

  const TARGET_TRIGGER_FIELDS = new Set([
    'target_subcategory_rank','stage_target_cpu',
    'ranking','guanggaocvr','cpu','ad_cost_ratio','profit_margin',
  ]);

  const DYNAMIC_COLOR = { country: (row) => COUNTRY_COLORS[row.country] || null };

  const PUSH_PROP_OPTIONS = [
    { label:'显示/隐藏', value:'hidden'      }, { label:'固定列',    value:'pinned'      },
    { label:'列宽',      value:'width'       }, { label:'表头颜色',  value:'headerColor' },
    { label:'可编辑',    value:'editable'    },
  ];

  const SRC_GROUP_CONFIG = [
    { src:'daily',     label:'📋 每日 ASIN',      color:COLOR_GREEN  },
    { src:'weekly',    label:'📈 周产品表现',       color:COLOR_ORANGE },
    { src:'target',    label:'🎯 目标管理',         color:COLOR_PURPLE },
    { src:'orderLink', label:'🔗 订单链接追踪',     color:COLOR_TEAL   },
  ];

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

    // CPA / CPU 等字段为 0 时，按空值显示
    if (isZeroAsEmpty(col.field, v)) return '—';

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
  // TargetDefaultsModal - 目标值管理弹窗（基于 target_default 表）
  // ════════════════════════════════════════════════════════════
  const TargetDefaultsModal = ({ open, onClose, onSaved, initialCountryAsin, currentCountry, currentAsin, currentModel }) => {
      const [targetAdCvr, setTargetAdCvr]       = useState(null);
      const [targetCpa, setTargetCpa]           = useState(null);
      const [idealCpu, setIdealCpu]             = useState(null);
      const [targetProfitMargin, setTargetProfitMargin] = useState(null);
      const [targetAdSpendRate, setTargetAdSpendRate]   = useState(null);
      const [loading, setLoading]               = useState(false);
      const [saving, setSaving]                 = useState(false);
      const [foundRecord, setFoundRecord]       = useState(false);

      const resetForm = useCallback(() => {
        setTargetAdCvr(null);
        setTargetCpa(null);
        setIdealCpu(null);
        setTargetProfitMargin(null);
        setTargetAdSpendRate(null);
        setFoundRecord(false);
      }, []);

      useEffect(() => {
        if (open && initialCountryAsin) {
          setLoading(true);
          setFoundRecord(false);
          (async () => {
            try {
              const filterStr = JSON.stringify({ country_asin: { $eq: initialCountryAsin } });
              const res = await ctx.request({
                url: 'target_default:list', method: 'get',
                params: { filter: filterStr, pageSize: 1 },
              });
              const record = res?.data?.data?.[0];
              if (record) {
                setTargetAdCvr(record.target_ad_cvr != null ? Number(record.target_ad_cvr) * 100 : null);
                setTargetCpa(record.target_cpa ?? null);
                setIdealCpu(record.ideal_cpu_by_margin ?? null);
                setTargetProfitMargin(record.target_profit_margin != null ? Number(record.target_profit_margin) * 100 : null);
                setTargetAdSpendRate(record.target_ad_spend_rate != null ? Number(record.target_ad_spend_rate) * 100 : null);
                setFoundRecord(true);
              } else {
                setTargetAdCvr(null);
                setTargetCpa(null);
                setIdealCpu(null);
                setTargetProfitMargin(null);
                setTargetAdSpendRate(null);
              }
            } catch (err) {
              ctx.message.error(`加载失败：${err?.message || ''}`);
            } finally { setLoading(false); }
          })();
        } else if (!open) {
          resetForm();
        }
      }, [open, initialCountryAsin]);

      const handleSave = useCallback(async () => {
        if (!initialCountryAsin) { ctx.message.warning('缺少国家_ASIN信息'); return; }
        setSaving(true);
        try {
          const filterStr = JSON.stringify({ country_asin: { $eq: initialCountryAsin } });
          const res = await ctx.request({
            url: 'target_default:list', method: 'get',
            params: { filter: filterStr, pageSize: 1 },
          });
          const existing = res?.data?.data?.[0];
          const data = {
            target_ad_cvr: targetAdCvr != null && targetAdCvr !== '' ? Number(targetAdCvr) / 100 : null,
            target_cpa: targetCpa != null ? Number(targetCpa) : null,
            ideal_cpu_by_margin: idealCpu != null ? Number(idealCpu) : null,
            target_profit_margin: targetProfitMargin != null && targetProfitMargin !== '' ? Number(targetProfitMargin) / 100 : null,
            target_ad_spend_rate: targetAdSpendRate != null && targetAdSpendRate !== '' ? Number(targetAdSpendRate) / 100 : null,
          };

          if (existing) {
            await ctx.request({
              url: 'target_default:update', method: 'post',
              params: { filterByTk: existing.id },
              data,
            });
          } else {
            await ctx.request({
              url: 'target_default:create', method: 'post',
              data: { ...data, country_asin: initialCountryAsin },
            });
          }

          ctx.message.success('目标值已保存，正在后台重算公式...');
          onSaved?.();
          onClose();

          // 后台批量重算：先批量读取依赖数据，再分批更新，避免每条记录重复查询。
          setTimeout(async () => {
            try {
              const result = await recalcTargetFormulasForCountryAsin(ctx, initialCountryAsin, data);
              if (result.total > 0) {
                ctx.message.success(`已同步重算 ${result.success}/${result.total} 条目标管理公式`);
                onSaved?.();
              }
            } catch (e) {
              ctx.message.warning(`目标管理公式重算失败：${e?.message || ''}`);
            }
          }, 300);

        } catch (err) {
          ctx.message.error(`保存失败：${err?.message || ''}`);
        } finally { setSaving(false); }
      }, [initialCountryAsin, targetAdCvr, targetCpa, idealCpu, targetProfitMargin, targetAdSpendRate, onClose, onSaved]);

      const commonInputStyle = { width: '100%' };
      const percentInputStyle = { width: '100%' };

      return React.createElement(Modal, {
        title: '🎯 目标值管理',
        open,
        onCancel: onClose,
        width: 560,
        footer: React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
          React.createElement('button', {
            onClick: onClose, disabled: saving,
            style: { padding: '6px 20px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px` }
          }, '取消'),
          React.createElement('button', {
            onClick: handleSave, disabled: saving || !initialCountryAsin,
            style: { padding: '6px 20px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: (saving || !initialCountryAsin) ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px`, fontWeight: 600 }
          }, saving ? '保存中...' : '💾 保存'),
        ),
        destroyOnClose: true,
      },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', fontSize: `${FONT_SIZE}px` } },
          React.createElement('div', {
            style: {
              padding: '12px 14px',
              background: '#f6f8fa',
              borderRadius: '6px',
              border: '1px solid #e1e4e8',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              fontSize: `${FONT_SIZE_SM}px`,
              flexWrap: 'wrap'
            }
          },
            currentModel && React.createElement('span', { style: { fontWeight: 700, color: '#52c41a', fontSize: `${FONT_SIZE}px` } }, currentModel),
            currentModel && currentCountry && React.createElement('span', { style: { color: '#ccc' } }, '|'),
            currentCountry && React.createElement('span', { style: { fontWeight: 700, color: COUNTRY_COLORS[currentCountry] || '#333', fontSize: `${FONT_SIZE}px` } }, currentCountry),
            (currentModel || currentCountry) && currentAsin && React.createElement('span', { style: { color: '#ccc' } }, '|'),
            currentAsin && React.createElement('span', { style: { fontWeight: 700, color: '#1890ff', fontSize: `${FONT_SIZE}px` } }, currentAsin),
          ),

          loading && React.createElement('div', { style: { textAlign: 'center', padding: '12px', color: '#999' } }, '⏳ 加载中...'),

          !loading && foundRecord && React.createElement('div', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#52c41a', padding: '2px 0' } }, '✅ 已加载现有目标值'),
          !loading && !foundRecord && React.createElement('div', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#fa8c16', padding: '2px 0' } }, '⚠️ 未找到记录，保存后将新建'),

          React.createElement('div', { style: { borderTop: '1px solid #f0f0f0' } }),

          // 第一行：目标广告 CVR | 目标 CPA
          React.createElement('div', { style: { display: 'flex', gap: '16px' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标广告 CVR'),
              React.createElement(InputNumber, {
                value: targetAdCvr, onChange: setTargetAdCvr,
                style: percentInputStyle, step: 0.1, precision: 2, min: 0, max: 100,
                placeholder: '输入百分比数值', size: 'small', addonAfter: '%', disabled: loading,
              }),
            ),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标 CPA'),
              React.createElement(InputNumber, {
                value: targetCpa, onChange: setTargetCpa,
                style: commonInputStyle, step: 0.01, precision: 2, min: 0,
                placeholder: '请输入目标 CPA', size: 'small', disabled: loading,
              }),
            ),
          ),

          // 第二行：目标 CPU | 目标利润率
          React.createElement('div', { style: { display: 'flex', gap: '16px' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标 CPU'),
              React.createElement(InputNumber, {
                value: idealCpu, onChange: setIdealCpu,
                style: commonInputStyle, step: 0.01, precision: 2, min: 0,
                placeholder: '请输入目标 CPU', size: 'small', disabled: loading,
              }),
            ),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标利润率'),
              React.createElement(InputNumber, {
                value: targetProfitMargin, onChange: setTargetProfitMargin,
                style: percentInputStyle, step: 0.1, precision: 2, min: 0, max: 100,
                placeholder: '输入百分比数值', size: 'small', addonAfter: '%', disabled: loading,
              }),
            ),
          ),

          // 第三行：目标广告费率
          React.createElement('div', { style: { display: 'flex', gap: '16px' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标广告费率'),
              React.createElement(InputNumber, {
                value: targetAdSpendRate, onChange: setTargetAdSpendRate,
                style: percentInputStyle, step: 0.1, precision: 2, min: 0, max: 100,
                placeholder: '输入百分比数值', size: 'small', addonAfter: '%', disabled: loading,
              }),
            ),
            React.createElement('div', { style: { flex: 1 } }),
          ),
        ),
      );
    };

  // ════════════════════════════════════════════════════════════
  // 目标管理公式计算函数
  // ════════════════════════════════════════════════════════════
  const buildTargetFormulaUpdates = (target, defaults = {}, wp = null, profit = null) => {
      const updates = {};

      // 1. goal_subcategory_rank
      const targetRank = target.target_subcategory_rank;
      const actualRank = wp?.ranking;
      if (targetRank == null || isNaN(Number(targetRank))) {
        updates.goal_subcategory_rank = '写目标排名';
      } else if (actualRank == null || isNaN(Number(actualRank))) {
        updates.goal_subcategory_rank = '';
      } else if (Number(actualRank) > Number(targetRank)) {
        updates.goal_subcategory_rank = `未达标 - 拉下${Number(actualRank) - Number(targetRank)}名`;
      } else {
        updates.goal_subcategory_rank = '√';
      }

      // 2. target_ad_cvr_formula
      const gpCvr = wp?.guanggaocvr;
      const targetAdCvr = defaults.target_ad_cvr;
      if (gpCvr == null || gpCvr === '' || targetAdCvr == null || targetAdCvr === '') {
        updates.target_ad_cvr_formula = '';
      } else if (Number(gpCvr) >= Number(targetAdCvr)) {
        updates.target_ad_cvr_formula = '√';
      } else {
        const diff = ((Number(targetAdCvr) - Number(gpCvr)) * 100).toFixed(1);
        updates.target_ad_cvr_formula = `x -${diff}%`;
      }

      // 3. target_cpa_formula
      const wpCpa = wp?.cpa;
      const targetCpa = defaults.target_cpa;

      if (
        isFormulaBlank('cpa', wpCpa) ||
        isFormulaBlank('target_cpa', targetCpa)
      ) {
        updates.target_cpa_formula = '';
      } else if (Number(wpCpa) > Number(targetCpa)) {
        updates.target_cpa_formula = `CPA 超标${Math.round(Number(wpCpa) - Number(targetCpa))}`;
      } else {
        updates.target_cpa_formula = '√';
      }


      // 4. ideal_cpu_by_margin_formula
      const wpCpu = wp?.cpu;
      const idealCpu = defaults.ideal_cpu_by_margin;

      if (
        isFormulaBlank('cpu', wpCpu) ||
        isFormulaBlank('ideal_cpu_by_margin', idealCpu)
      ) {
        updates.ideal_cpu_by_margin_formula = '';
      } else if (Number(wpCpu) > Number(idealCpu)) {
        updates.ideal_cpu_by_margin_formula = `CPU 超标${Math.round(Number(wpCpu) - Number(idealCpu))}`;
      } else {
        updates.ideal_cpu_by_margin_formula = '√';
      }


      // 5. stage_target_cpu_formula
      const stageTargetCpu = target.stage_target_cpu;
      if (
        isFormulaBlank('cpu', wpCpu) ||
        isFormulaBlank('stage_target_cpu', stageTargetCpu)
      ) {
        updates.stage_target_cpu_formula = '';
      } else if (Number(wpCpu) > Number(stageTargetCpu)) {
        updates.stage_target_cpu_formula = `CPU 超标${Math.round(Number(wpCpu) - Number(stageTargetCpu))}`;
      } else {
        updates.stage_target_cpu_formula = '√';
      }


      // 6. target_ad_spend_rate_formula
      const adCostRatio = profit?.ad_cost_ratio;
      const targetAdSpendRate = defaults.target_ad_spend_rate;
      if (adCostRatio == null || targetAdSpendRate == null) {
        updates.target_ad_spend_rate_formula = '';
      } else if (Number(adCostRatio) > Number(targetAdSpendRate)) {
        const diff = ((Number(adCostRatio) - Number(targetAdSpendRate)) * 100).toFixed(2);
        updates.target_ad_spend_rate_formula = `X -${diff}%`;
      } else {
        updates.target_ad_spend_rate_formula = '√';
      }

      // 7. target_profit_margin_formula
      const profitMargin = profit?.profit_margin;
      const targetProfitMargin = defaults.target_profit_margin;
      if (profitMargin == null || targetProfitMargin == null) {
        updates.target_profit_margin_formula = '';
      } else if (Number(profitMargin) < Number(targetProfitMargin)) {
        const diff = ((Number(targetProfitMargin) - Number(profitMargin)) * 100).toFixed(2);
        updates.target_profit_margin_formula = `X -${diff}%`;
      } else {
        updates.target_profit_margin_formula = '√';
      }

      return updates;
  };

  const updateTargetFormulaRecord = async (context, countryAsinDate, updates) => {
    if (!countryAsinDate || !updates || Object.keys(updates).length === 0) return null;
    await context.request({
      url: 'target_management:update', method: 'post',
      params: { filterByTk: countryAsinDate },
      data: updates,
    });
    return updates;
  };

  const recalcTargetFormula = async (context, countryAsinDate) => {
    if (!countryAsinDate) return null;
    try {
      const tmFilterStr = JSON.stringify({ country_asin_date: { $eq: countryAsinDate } });
      const targetRes = await context.request({
        url: 'target_management:list', method: 'get',
        params: { filter: tmFilterStr, pageSize: 1 },
      });
      const target = targetRes?.data?.data?.[0];
      if (!target) return null;

      const countryAsin = countryAsinDate.replace(/_\d{4}-\d{2}-\d{2}$/, '');

      const tdFilterStr = JSON.stringify({ country_asin: { $eq: countryAsin } });
      const defRes = await context.request({
        url: 'target_default:list', method: 'get',
        params: { filter: tdFilterStr, pageSize: 1 },
      });
      const defaults = defRes?.data?.data?.[0] || {};

      const wpFilterStr = JSON.stringify({ country_asin_week: { $eq: countryAsinDate } });
      const wpRes = await context.request({
        url: 'weekly_performance:list', method: 'get',
        params: { filter: wpFilterStr, pageSize: 1 },
      });
      const wp = wpRes?.data?.data?.[0] || null;

      const dpFilterStr = JSON.stringify({ country_asin_date: { $eq: countryAsinDate } });
      const profitRes = await context.request({
        url: 'daily_profit:list', method: 'get',
        params: { filter: dpFilterStr, pageSize: 1 },
      });
      const profit = profitRes?.data?.data?.[0] || null;

      const updates = buildTargetFormulaUpdates(target, defaults, wp, profit);
      return await updateTargetFormulaRecord(context, countryAsinDate, updates);
    } catch (err) {
      console.error(`目标公式重算失败：${countryAsinDate}`, err);
      return null;
    }
  };

  const recalcTargetFormulasForCountryAsin = async (context, countryAsin, defaults) => {
    if (!countryAsin) return { total: 0, success: 0 };
    const fetchAll = async (url, params = {}) => {
      const pageSize = 200;
      const rows = [];
      for (let page = 1; page <= 10000; page += 1) {
        const res = await context.request({
          url,
          method: 'get',
          params: { ...params, page, pageSize },
        });
        const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
        rows.push(...batch);
        const totalPage = Number(res?.data?.meta?.totalPage);
        if (batch.length < pageSize || (Number.isFinite(totalPage) && page >= totalPage)) break;
      }
      return rows;
    };

    const tmFilterStr = JSON.stringify({ country_asin_date: { $includes: countryAsin } });
    const tmRecords = await fetchAll('target_management:list', { filter: tmFilterStr });
    const targetKeys = tmRecords.map((tm) => tm.country_asin_date).filter(Boolean);
    if (!targetKeys.length) return { total: 0, success: 0 };

    // ✅ 只用 targetKeys，不加"周"后缀
    const weeklyFilterStr = JSON.stringify({ country_asin_week: { $in: targetKeys } });
    const profitFilterStr = JSON.stringify({ country_asin_date: { $in: targetKeys } });

    const [weeklyRecords, profitRecords] = await Promise.all([
      fetchAll('weekly_performance:list', { filter: weeklyFilterStr }),
      fetchAll('daily_profit:list', { filter: profitFilterStr }),
    ]);
    const weeklyMap = {};
    weeklyRecords.forEach((wp) => {
      if (wp.country_asin_week) weeklyMap[wp.country_asin_week] = wp;  // ✅ 不 replace
    });
    const profitMap = {};
    profitRecords.forEach((profit) => {
      if (profit.country_asin_date) profitMap[profit.country_asin_date] = profit;
    });

    const updateJobs = tmRecords.map((target) => {
      const key = target.country_asin_date;
      const updates = buildTargetFormulaUpdates(target, defaults, weeklyMap[key] || null, profitMap[key] || null);
      return { key, updates };
    });

    const batchSize = 10;
    let success = 0;
    for (let i = 0; i < updateJobs.length; i += batchSize) {
      const batch = updateJobs.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((job) => updateTargetFormulaRecord(context, job.key, job.updates))
      );
      success += results.filter((r) => r.status === 'fulfilled' && r.value).length;
    }

    return { total: updateJobs.length, success };
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
    const [showTargetDefaults, setShowTargetDefaults] = useState(false);
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
    const [selectedRange, setSelectedRange]     = useState(null);
    const selectingRef = useRef(false);

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
    const filterModel        = urlParams?.model   || null;
    const computedCountryAsin = useMemo(() => {
      if (filterAsin && filterCountry) return `${filterCountry}_${filterAsin}`;
      return '';
    }, [filterAsin, filterCountry]);

    const getTextColorForBg = (hexColor) => {
      if (!hexColor || hexColor.length < 7) return '#333';
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#222' : '#fff';
    };

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
        const dailyParams = {
          sort: getDailySort(),
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
        const relatedPageSize = Math.max(size, dailyKeys.length, 100);

        const [rWeekly, rTarget, rOrderLink] = await Promise.all([
          ctx.request({ url: 'weekly_performance:list', method: 'get', params: { pageSize: relatedPageSize, filter: weekKeyFilter } }),
          ctx.request({ url: 'target_management:list',  method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
          ctx.request({ url: 'daily_order_link_tracking:list', method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
        ]);

        const weeklyRecords = Array.isArray(rWeekly?.data?.data) ? rWeekly.data.data : [];
        const targetRecords = Array.isArray(rTarget?.data?.data) ? rTarget.data.data : [];
        const orderLinkRecords = Array.isArray(rOrderLink?.data?.data) ? rOrderLink.data.data : [];


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


        const mergedData = dailyRecords.map((d) => {
          const key = d.country_asin_date;
          const weeklyData = weeklyMap[key] || {};
          const targetData = targetMap[key] || {};
          const orderLinkData = orderLinkMap[key] || {};
          return {
            ...weeklyData,
            ...targetData,
            ...orderLinkData,
            ...d,
          };
        });

        setData(mergedData);
        setTotal(totalCount);
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
      } finally { setLoading(false); }
    }, [filterAsin, filterCountry, currentUserName, currentUserLevel, getDateRange, getDailySort]);

    useEffect(() => { setCurPage(1); loadData({ page: 1 }); }, [loadData]);

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

    const toggleCol      = (key) => updateAndSave((p) => { const col = p.find((c) => c.key === key); if (!col) return p; if (!col.hidden) return p.map((c) => c.key === key ? { ...c, hidden: true } : c); return [...p.filter((c) => c.key !== key), { ...col, hidden: false }]; });
    const togglePin      = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c));
    const setHColor      = (key, color) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c));
    const clearHColor    = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c));
    const toggleEditable = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c));
    const selectAll      = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: false })));
    const deselectAll    = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: true  })));
    const selectGroup    = (src) => updateAndSave((p) => p.map((c) => c.src === src ? { ...c, hidden: false } : c));
    const deselectGroup  = (src) => updateAndSave((p) => p.map((c) => c.src === src ? { ...c, hidden: true  } : c));

    const visibleCols   = useMemo(() => { const vis = columns.filter((c) => !c.hidden); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [columns]);
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += col.width || 80; } }); return map; }, [visibleCols]);

    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();
    const onDrop      = (e, targetKey) => { e.preventDefault(); const fromKey = dragColKey.current; if (!fromKey || fromKey === targetKey) return; updateAndSave((prev) => { const next = [...prev]; const fi = next.findIndex((c) => c.key === fromKey); const ti = next.findIndex((c) => c.key === targetKey); const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved); return next; }); dragColKey.current = null; };

    const onResizeStart = useCallback((e, colKey) => { e.preventDefault(); e.stopPropagation(); const col = columns.find((c) => c.key === colKey); resizeRef.current = { colKey, startX: e.clientX, startWidth: col?.width || 80 }; setIsResizing(true); }, [columns]);
    const onOverlayMove = useCallback((e) => { if (!resizeRef.current) return; const { colKey, startX, startWidth } = resizeRef.current; const nw = Math.max(40, startWidth + (e.clientX - startX)); updateAndSave((p) => p.map((c) => c.key === colKey ? { ...c, width: nw } : c)); }, []);
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

      // 与页面展示逻辑一致：这些字段为 0 时复制为空
      if (isZeroAsEmpty(col.field, value)) return '';

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

      focusClipboardWithoutScroll();  // 原版在 mousedown 时就聚焦

      e.preventDefault();             // 原版阻止默认行为
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
          if (TARGET_TRIGGER_FIELDS.has(col.field)) recalcRows.add(rowId);
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

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          return patch ? { ...row, ...patch } : row;
        }));

        for (const rowId of recalcRows) {
          const updates = await recalcTargetFormula(ctx, rowId);
          if (updates) {
            setData((prev) => prev.map((row) => (row.country_asin_date || row.id) === rowId ? { ...row, ...updates } : row));
          }
        }

        ctx.message.success(`已粘贴 ${ops.length} 个单元格`);
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [editingCell, isCellEditable, normalizeSelection, pagedData, parsePastedValue, saving, selectedRange, visibleCols]);

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
      const updateConfig = SRC_UPDATE_CONFIG[src];
      if (!updateConfig) { ctx.message.error(`字段来源 "${src}" 暂不支持编辑`); return; }
      const row = data.find((r) => (r.country_asin_date || r.id) === rowId);
      if (!row) return;
      const pkValue = row[updateConfig.pkField];
      if (!pkValue) { ctx.message.error(`无法找到记录主键（${updateConfig.pkField}）`); cancelEdit(); return; }
      let valueToSave = editValue;
      if (RATE_FIELDS.has(field))                 valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) / 100 : null;
      else if (MONEY_FIELDS.has(field) || NUM_FIELDS.has(field)) valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) : null;
      else if (DATE_FIELDS.has(field))            valueToSave = editValue || null;
      try {
        setSaving(true);
        await ctx.request({ url: updateConfig.url, method: 'post', params: { filterByTk: pkValue }, data: { [field]: valueToSave } });
        setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [field]: valueToSave } : r));
        ctx.message.success('保存成功');
        if (TARGET_TRIGGER_FIELDS.has(field)) {
          try {
            const updates = await recalcTargetFormula(ctx, rowId);
            if (updates) {
              setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, ...updates } : r));
            }
          } catch (e) { ctx.message.warning(`公式重算失败：${e?.message || ''}`); }
        }
        setEditingCell(null); setEditValue(null);
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setSaving(false); }
    }, [editingCell, editValue, data, saving]);

    const recalcAllTargetFormulas = useCallback(async () => {
      if (!IS_ADMIN) {
        ctx.message.warning('只有管理员可以执行自动计算');
        return;
      }

      const keys = [
        ...new Set(
          data
            .map((r) => r.country_asin_date || r.id)
            .filter(Boolean)
        )
      ];

      if (!keys.length) {
        ctx.message.warning('当前没有可计算的数据');
        return;
      }

      const getCountryAsin = (countryAsinDate) => {
        return String(countryAsinDate || '').replace(/_\d{4}-\d{2}-\d{2}$/, '');
      };

      const parallelLimit = async (items, limit, worker, onProgress) => {
        let index = 0;
        let done = 0;
        const results = [];

        const runners = Array.from(
          { length: Math.min(limit, items.length) },
          async () => {
            while (index < items.length) {
              const currentIndex = index++;
              const item = items[currentIndex];

              try {
                results[currentIndex] = await worker(item, currentIndex);
              } catch (err) {
                results[currentIndex] = { error: err };
              } finally {
                done += 1;
                onProgress?.(done, items.length);
              }
            }
          }
        );

        await Promise.all(runners);
        return results;
      };

      setCalcLoading(true);
      setCalcProgress('准备计算...');

      try {
        setCalcProgress('正在批量读取数据...');

        const countryAsins = [
          ...new Set(keys.map(getCountryAsin).filter(Boolean))
        ];

        const targetFilterStr = JSON.stringify({
          country_asin_date: { $in: keys }
        });

        const weeklyFilterStr = JSON.stringify({
          country_asin_week: { $in: keys }
        });

        const profitFilterStr = JSON.stringify({
          country_asin_date: { $in: keys }
        });

        const defaultFilterStr = JSON.stringify({
          country_asin: { $in: countryAsins }
        });
        const calcRelatedPageSize = Math.max(keys.length, 100);
        const defaultPageSize = Math.max(countryAsins.length, 100);

        const [targetRes, weeklyRes, profitRes, defaultRes] = await Promise.all([
          ctx.request({
            url: 'target_management:list',
            method: 'get',
            params: {
              filter: targetFilterStr,
              pageSize: calcRelatedPageSize,
            },
          }),

          ctx.request({
            url: 'weekly_performance:list',
            method: 'get',
            params: {
              filter: weeklyFilterStr,
              pageSize: calcRelatedPageSize,
            },
          }),

          ctx.request({
            url: 'daily_profit:list',
            method: 'get',
            params: {
              filter: profitFilterStr,
              pageSize: calcRelatedPageSize,
            },
          }),

          ctx.request({
            url: 'target_default:list',
            method: 'get',
            params: {
              filter: defaultFilterStr,
              pageSize: defaultPageSize,
            },
          }),
        ]);

        const targetRecords = Array.isArray(targetRes?.data?.data)
          ? targetRes.data.data
          : [];

        const weeklyRecords = Array.isArray(weeklyRes?.data?.data)
          ? weeklyRes.data.data
          : [];

        const profitRecords = Array.isArray(profitRes?.data?.data)
          ? profitRes.data.data
          : [];

        const defaultRecords = Array.isArray(defaultRes?.data?.data)
          ? defaultRes.data.data
          : [];

        const targetMap = {};
        targetRecords.forEach((t) => {
          if (t.country_asin_date) {
            targetMap[t.country_asin_date] = t;
          }
        });

        const weeklyMap = {};
        weeklyRecords.forEach((w) => {
          if (w.country_asin_week) {
            weeklyMap[w.country_asin_week] = w;
          }
        });

        const profitMap = {};
        profitRecords.forEach((p) => {
          if (p.country_asin_date) {
            profitMap[p.country_asin_date] = p;
          }
        });

        const defaultMap = {};
        defaultRecords.forEach((d) => {
          if (d.country_asin) {
            defaultMap[d.country_asin] = d;
          }
        });

        setCalcProgress('正在本地计算公式...');

        const updateJobs = [];
        const patchMap = {};
        let skipCount = 0;

        keys.forEach((key) => {
          const target = targetMap[key];

          if (!target) {
            skipCount += 1;
            return;
          }

          const countryAsin = getCountryAsin(key);
          const defaults = defaultMap[countryAsin] || {};
          const weekly = weeklyMap[key] || null;
          const profit = profitMap[key] || null;

          const updates = buildTargetFormulaUpdates(
            target,
            defaults,
            weekly,
            profit
          );

          if (!updates || Object.keys(updates).length === 0) {
            skipCount += 1;
            return;
          }

          patchMap[key] = updates;

          updateJobs.push({
            key,
            updates,
          });
        });

        if (!updateJobs.length) {
          ctx.message.warning(`没有可更新的数据，跳过 ${skipCount} 条`);
          return;
        }

        setCalcProgress(`准备写回 ${updateJobs.length} 条...`);

        let successCount = 0;
        let failCount = 0;

        const CONCURRENCY = 8;

        await parallelLimit(
          updateJobs,
          CONCURRENCY,
          async (job) => {
            try {
              await updateTargetFormulaRecord(ctx, job.key, job.updates);
              successCount += 1;
              return { ok: true };
            } catch (err) {
              console.error('目标公式写回失败:', job.key, err);
              failCount += 1;
              return { ok: false, err };
            }
          },
          (done, totalCount) => {
            setCalcProgress(`正在写回 ${done}/${totalCount}...`);
          }
        );

        setData((prev) =>
          prev.map((r) => {
            const key = r.country_asin_date || r.id;
            return patchMap[key] ? { ...r, ...patchMap[key] } : r;
          })
        );

        if (failCount > 0) {
          ctx.message.warning(
            `公式计算完成：成功 ${successCount} 条，失败 ${failCount} 条，跳过 ${skipCount} 条`
          );
        } else {
          ctx.message.success(
            `公式计算完成：成功 ${successCount} 条，跳过 ${skipCount} 条`
          );
        }
      } catch (err) {
        console.error(err);
        ctx.message.error(`公式计算失败：${err?.message || '未知错误'}`);
      } finally {
        setCalcLoading(false);
        setCalcProgress('');
      }
    }, [data]);

    const refreshData = useCallback(async (silent = false) => {
      await loadData({ page: curPageRef.current, size: pageSizeRef.current });
      if (!silent) {
        ctx.message.success('数据已刷新');
      }
    }, [loadData]);
    const resetColumns = useCallback(async () => { const defaults = INITIAL_COLUMNS.map((c) => ({ ...c })); setColumns(defaults); await saveColsToUser(defaults); ctx.message.success('列已重置为默认'); }, []);

    const btnStyle = (bg, color, border) => ({ padding: '5px 12px', background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE}px`, whiteSpace: 'nowrap' });

    const renderEditInput = (col) => {
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
          const groupCols   = columns.filter((c) => c.src === group.src);
          if (!groupCols.length) return null;
          const isCollapsed = !!collapsedGroups[group.src];
          const visCount    = groupCols.filter((c) => !c.hidden).length;
          return React.createElement('div', { key: group.src, style: { marginBottom: '6px', border: `1px solid ${group.color}40`, borderRadius: '6px', overflow: 'hidden' } },
            React.createElement('div', { onClick: () => toggleGroup(group.src), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer', userSelect: 'none', background: `${group.color}18`, borderBottom: isCollapsed ? 'none' : `1px solid ${group.color}30` } },
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: group.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
              React.createElement('span', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: group.color, flex: 1 } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); selectGroup(group.src); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全选'),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); deselectGroup(group.src); },
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
      React.createElement(PushPanel, { columns, onClose: () => setShowPush(false), anchorPos: pushPos }),
    );

    // 目标值管理 Modal
    const targetDefaultsModalEl = React.createElement(TargetDefaultsModal, {
      open: showTargetDefaults,
      onClose: () => setShowTargetDefaults(false),
      onSaved: () => { refreshData(true); },
      initialCountryAsin: computedCountryAsin,
      currentCountry: filterCountry,
      currentAsin: filterAsin,
      currentModel: filterModel,
    });


    const tableWidth = visibleCols.reduce((s, c) => s + (c.width || 80), 0);

    // 判断是否是公式字段（field 包含 _formula 后缀或等于 goal_subcategory_rank）
    const isFormulaField = (field) => {
      return field && (field.endsWith('_formula') || field === 'goal_subcategory_rank');
    };

    return React.createElement('div', { style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),

      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' } },
        IS_ADMIN && React.createElement('button', { onClick: resetColumns, style: btnStyle('#1890ff', '#fff', '#1890ff') }, '📊 重置列'),
        React.createElement('button', { ref: panelBtnRef, onClick: () => { setShowPanel((v) => !v); setShowPush(false); setShowTargetDefaults(false); }, style: btnStyle(showPanel ? '#e6f7ff' : '#fff', '#333', showPanel ? '#1890ff' : '#d9d9d9') }, '👁️ 列设置'),
        IS_ADMIN && React.createElement('button', { ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); setShowTargetDefaults(false); }, style: btnStyle(showPush ? '#fff7e6' : '#fff', showPush ? '#fa8c16' : '#333', showPush ? '#fa8c16' : '#d9d9d9') }, '📤 推送配置'),
                React.createElement('button', { onClick: refreshData, style: btnStyle('#fff', '#333', '#d9d9d9') }, '🔄 刷新'),
        // 🎯 目标值按钮 - 高亮显示
        React.createElement('button', {
          onClick: () => { setShowTargetDefaults((v) => !v); setShowPanel(false); setShowPush(false); },
          style: btnStyle('#fff7e6', '#fa8c16', '#fa8c16')
        }, '🎯 目标值'),
        IS_ADMIN && React.createElement(Popconfirm, {
          title: `确定要重新计算当前筛选范围内的 ${total} 条目标公式吗？`,
          onConfirm: recalcAllTargetFormulas,
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

      panelEl,
      pushPanelEl,
      targetDefaultsModalEl,

      React.createElement('textarea', {
        ref: clipboardRef,
        value: '',
        onChange: () => {},
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleKeyDown,
        tabIndex: -1,           // 原版用 -1
        'aria-hidden': true,
        style: {
          position: 'fixed',    // 原版定位方式
          left: '0px',
          top: '0px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none', // 原版不响应鼠标事件
          zIndex: -1,
        }
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
            : React.createElement('table', {
                style: {
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  tableLayout: 'fixed',
                  background: '#fff',
                  width: `${tableWidth}px`,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                }
              },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  visibleCols.map((col) => {
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const canEdit  = isCellEditable(col);
                    const hdrColor = getColHeaderColor(col);
                    const formulaDesc = FORMULA_DESCRIPTIONS[col.field] || null;
                    const isFormula = isFormulaField(col.field);
                    
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
                        cursor: isFormula ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      },
                    },
                      React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', pointerEvents: 'auto' } },
                          col.label,
                          formulaDesc && React.createElement(Tooltip, {
                              title: React.createElement('pre', {
                                  style: { margin: 0, fontFamily: 'inherit', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.6 }
                              }, formulaDesc),
                              placement: 'top',
                              overlayStyle: { maxWidth: '420px' },
                              mouseEnterDelay: 0.2,
                          },
                              React.createElement('span', {
                                  onClick: (e) => e.stopPropagation(),
                                  onMouseDown: (e) => e.stopPropagation(),
                                  draggable: false,
                                  onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); },
                                  style: {
                                      marginLeft: '4px',
                                      padding: '0 4px',
                                      fontSize: `${FONT_SIZE_XS}px`,
                                      color: '#fff',
                                      background: 'rgba(24,144,255,0.85)',
                                      borderRadius: '3px',
                                      fontStyle: 'italic',
                                      fontWeight: 700,
                                      cursor: 'help',
                                      verticalAlign: 'middle',
                                      display: 'inline-block',
                                  },
                              }, 'ƒ')
                          ),
                          React.createElement('span', { 
                              style: { 
                                  marginLeft: '3px', 
                                  opacity: sortConfig.key === col.key ? 1 : 0.4, 
                                  fontSize: `${FONT_SIZE_XS}px`,
                                  display: 'inline-block',
                              } 
                          }, sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'),
                      ),
                      React.createElement('div', { onMouseDown: (e) => onResizeStart(e, col.key), onClick: (e) => e.stopPropagation(), style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 2, background: 'transparent' } }),
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
                          userSelect: isEditing ? 'text' : 'none',
                          WebkitUserSelect: isEditing ? 'text' : 'none',
                          MozUserSelect: isEditing ? 'text' : 'none',
                          msUserSelect: isEditing ? 'text' : 'none',
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
