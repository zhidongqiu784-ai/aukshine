async function run() {

  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Drawer, Modal, Table, Button, Popconfirm, ConfigProvider, Tooltip } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const LEGACY_DEFAULT_COLUMNS_KEY = `${BLOCK_UID}__default_columns`;
  const COLUMN_VIEW_SETTING_KEY = `${BLOCK_UID}__column_view_setting`;
  const DEFAULT_COLUMN_VIEWS_KEY = `${BLOCK_UID}__default_column_views`;
  const BLOCK_NAME       = '推新板块';
  const BLOCK_NAME_SETTING_KEY = `${BLOCK_UID}__block_name`;
  const IS_ADMIN         = currentUserLevel === 3;
  const DEFAULT_COLUMN_VIEW_IDS = ['default_1'];
  const DEFAULT_COLUMN_VIEW_LABELS = { default_1: '默认视图' };

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
  const readGlobal     = ()     => ctx.engine[GLOBAL_KEY] || null;
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
  const IMPORTANT_COLUMN_BODY_COLOR = '#BADDB1';

  const SRC_DEFAULT_COLOR = {
    daily: COLOR_GREEN, weekly: COLOR_ORANGE, keyword_tracking: '#b5796a', tool: '#fa8c16',
  };

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

  const PAGE_SIZE_OPTIONS = ['10','20','50','100'];
  const DEFAULT_PAGE_SIZE = 20;

  const KW_ROLE_ORDER = ['主推', '辅1', '辅2', '辅3', '辅4'];

  const KW_ROLE_COLORS = {
    '主推': {
      bg: '#EAF7E6',
      header: '#EB6793',
      headerText: '#fff',
      text: '#2F6B2F',
      border: '#7DAA6A',
      cardBg: '#FFFFFF',
    },

    '辅1': {
      bg: '#FDEBF2',
      header: '#EB6793',
      headerText: '#fff',
      text: '#9B2453',
      border: '#EB6793',
      cardBg: '#FFFFFF',
    },

    '辅2': {
      bg: '#FCEEEE',
      header: '#EB6793',
      headerText: '#5A2B2B',
      text: '#8A3E3E',
      border: '#E6A0A0',
      cardBg: '#FFFFFF',
    },

    '辅3': {
      bg: '#EAF7F4',
      header: '#EB6793',
      headerText: '#fff',
      text: '#1C5C50',
      border: '#5DBEAC',
      cardBg: '#FFFFFF',
    },

    '辅4': {
      bg: '#FFF8E6',
      header: '#EB6793',
      headerText: '#fff',
      text: '#8A5A16',
      border: '#D4A76A',
      cardBg: '#FFFFFF',
    },
  };


  const ROLE_SLOT_LABEL = {
    '主推': '主推', '辅1': '辅1', '辅2': '辅2', '辅3': '辅3', '辅4': '辅4',
  };

  const PROMO_DAY_OPTIONS = [{ label: '是', value: 1 }, { label: '否', value: 0 }];

  const FORMULA_DESCRIPTIONS = {
    est_review_total: `【预计刷单总数】\n= SUM(new_eval_words_daily.est_review_qty)\n当日所有关键词"预计刷单量"求和\n（用于核对当日测评需量）`,
    rsg_number: `【实际刷单总数】\n= daily_asins.rsg_number\n引用订单流量转化里的测评单`,
    daily_eval_demand: `【单日测评应需量】\n= CEIL(预计流量 × 目标转化率 − 预计自然单)\n= CEIL(est_traffic × daily_keyword_tracking.target_cvr − est_nat_order)`,
    actual_natural_order: `【实际自然单】\n= 实际总单量 - 测评单 - 实际广告单\n= weekly_performance.sales - daily_asins.rsg_number - weekly_performance.guanggaodan\n其中 daily_asins.rsg_number 引用订单流量转化里的测评单`,
    plan_eval_judgment: `【计划-测评单判断】对比 单日应需量 vs 预计刷单总数\n• 应需量 = 0      → "无计划"\n• 应需量 > 总数   → "计划测评缺-X单"\n• 应需量 < 总数   → "计划测评超+X单"\n• 相等            → "√"`,
    actual_eval_judgment: `【实际-测评结果判断】对比 实际刷单 vs 预计刷单\n• 预计=0 且 实际=0 → "无计划"\n• 预计=0 且 实际>0 → "无计划但测X单"\n• 实际 > 预计      → "测评超+X单"\n• 实际 < 预计      → "测评缺-X单"\n• 相等             → "√"`,
    actual_cvr_judgment: `【实际测评转化率判断】= IF(实际CVR为空 或 目标CVR为空, "", 判断实际CVR - 目标CVR)对比 weekly_performance.session_conversion_rate vs daily_keyword_tracking.target_cvr\n• 实际CVR - 目标CVR > 0 → "CVR满足+X.XX%"\n• 实际CVR - 目标CVR < 0 → "CVR不达标-X.XX%-广告失控？测评不足？"\n• 实际CVR - 目标CVR = 0 → "CVR持平"`,
  };

  const FORMULA_TOOLTIPS = {
    off: {
      title: 'Off 力度',
      formula: '(LP/WP/TP − 购物车价格) ÷ LP/WP/TP',
      emptyTitle: '为空情况（满足任意）：',
      emptyRules: ['LP/WP/TP 为空或无法转为数字', 'LP/WP/TP 为 0，无法作为分母', '购物车价格为空或无法转为数字'],
      fields: [
        { label: 'LP/WP/TP', field: 'daily_asins.list_price' },
        { label: '购物车价格', field: 'daily_asins.daily_price' },
      ],
      writeBackField: 'daily_asins.off',
    },
    est_review_total: {
      title: '预计刷单总数',
      formula: '当日所有关键词的预计刷单量求和',
      emptyTitle: '空值处理（不显示为空）：',
      emptyRules: ['当日没有关键词明细时汇总为 0', '关键词预计刷单量为空或无法转为数字时按 0 参与求和'],
      fields: [
        { label: '预计刷单量', field: 'new_eval_words_daily.est_review_qty' },
      ],
      writeBackField: 'daily_keyword_tracking.est_review_total',
    },
    rsg_number: {
      title: '实际刷单总数',
      formula: '引用订单流量转化里的测评单',
      emptyTitle: '空值处理（不显示为空）：',
      emptyRules: ['daily_asins.rsg_number 为空或无法转为数字时按 0 计算和写回'],
      fields: [
        { label: '实际刷单总数', field: 'daily_asins.rsg_number' },
      ],
      writeBackField: 'daily_keyword_tracking.actual_review_qty',
    },
    daily_eval_demand: {
      title: '单日测评应需量',
      formula: '预计流量 × 目标转化率 − 预计自然单，结果向上取整',
      emptyTitle: '空值处理（不显示为空）：',
      emptyRules: ['预计流量为空或无法转为数字时按 0 计算', '目标转化率为空或无法转为数字时按 0 计算', '预计自然单为空或无法转为数字时按 0 计算'],
      fields: [
        { label: '预计流量', field: 'daily_keyword_tracking.est_traffic' },
        { label: '目标转化率', field: 'daily_keyword_tracking.target_cvr' },
        { label: '预计自然单', field: 'daily_keyword_tracking.est_nat_order' },
      ],
      writeBackField: 'daily_keyword_tracking.daily_eval_demand',
    },
    actual_natural_order: {
      title: '实际自然单',
      formula: '实际总单量 − 实际刷单总数 − 实际广告单',
      emptyTitle: '空值处理（不显示为空）：',
      emptyRules: ['实际总单量为空或无法转为数字时按 0 计算', '实际刷单总数为空或无法转为数字时按 0 计算', '实际广告单为空或无法转为数字时按 0 计算'],
      fields: [
        { label: '实际总单量', field: 'weekly_performance.sales' },
        { label: '实际刷单总数', field: 'daily_asins.rsg_number' },
        { label: '实际广告单', field: 'weekly_performance.guanggaodan' },
      ],
      writeBackField: 'daily_keyword_tracking.actual_natural_order',
    },
    plan_eval_judgment: {
      title: '计划 - 测评单判断',
      formula: '对比单日测评应需量与预计刷单总数，判断计划测评缺口或超量',
      emptyTitle: '空值处理（不显示为空）：',
      emptyRules: ['单日测评应需量为空、无法转为数字或为 0 时显示无计划', '预计刷单总数为空或无法转为数字时按 0 对比'],
      fields: [
        { label: '单日测评应需量', field: 'daily_keyword_tracking.daily_eval_demand' },
        { label: '预计刷单总数', field: 'daily_keyword_tracking.est_review_total' },
      ],
      writeBackField: 'daily_keyword_tracking.plan_eval_judgment',
    },
    actual_eval_judgment: {
      title: '实际 - 测评结果判断',
      formula: '对比实际刷单总数与预计刷单总数，判断实际测评缺口或超量',
      emptyTitle: '空值处理（不显示为空）：',
      emptyRules: ['预计刷单总数为空或无法转为数字时按 0 对比', '实际刷单总数为空或无法转为数字时按 0 对比', '两者都为 0 时显示无计划'],
      fields: [
        { label: '预计刷单总数', field: 'daily_keyword_tracking.est_review_total' },
        { label: '实际刷单总数', field: 'daily_asins.rsg_number' },
      ],
      writeBackField: 'daily_keyword_tracking.actual_eval_judgment',
    },
    actual_cvr_judgment: {
      title: '实际测评转化率判断',
      formula: '对比实际 CVR 与目标转化率，输出满足、不达标或持平判断',
      emptyTitle: '为空情况（满足任意）：',
      emptyRules: ['实际 CVR 为空', '目标转化率为空', '任一数值无法转换为数字'],
      fields: [
        { label: '实际 CVR', field: 'weekly_performance.session_conversion_rate' },
        { label: '目标转化率', field: 'daily_keyword_tracking.target_cvr' },
      ],
      writeBackField: 'daily_keyword_tracking.actual_cvr_judgment',
    },
  };

  const WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT = {
    sales: '销量 = 领星销量按国家+ASIN汇总累加。\nsales = sum(volume)。',
    zirandan: '自然订单量 = 总订单量 - 广告订单量。\nzirandan = order_items - guanggaodan。',
    guanggaodan: '广告订单量 = 领星广告订单量按国家+ASIN汇总累加。\nguanggaodan = sum(ad_order_quantity)。',
    zongliuliang: '总流量 = 同国家+ASIN下取 Sessions-Total 最大值。\nzongliuliang = max(sessions_total)。',
    session_conversion_rate: '会话转化率 = 实际总单量 ÷ 汇总流量-会话量，并保留 4 位小数。\nsession_conversion_rate = round(sales ÷ zongliuliang, 4)；zongliuliang 为 0 时为 null。',
  };

  const TARGET_CVR_NOTE_TOOLTIP = {
    title: '目标转化率调整提示',
    formula: 'ASIN 总维度的目标转化率可参考前一天实际转化率进行人工调整',
    emptyTitle: '为空情况（满足任意）：',
    emptyRules: ['目标转化率未填写时该字段为空', '目标转化率未填写时实际测评转化率判断为空', '前一天实际转化率缺失时无法参考，需要人工判断'],
    fields: [
      { label: '目标转化率', field: 'daily_keyword_tracking.target_cvr' },
      { label: '实际 CVR', field: 'weekly_performance.session_conversion_rate' },
    ],
    writeBackField: 'daily_keyword_tracking.target_cvr',
  };

  const SRC_COLLECTION_NAME = {
    daily: 'daily_asins',
    weekly: 'weekly_performance',
    keyword_tracking: 'daily_keyword_tracking',
    keyword_screenshot: 'daily_keyword_tracking',
  };

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

  const DAILY_SQL_UPDATED_FIELD_TEXT = {
    country: '每天自动从 ASIN 表生成，只包含状态为「新品、重点、普通」的产品。',
    asin: '每天自动从 ASIN 表生成，只包含状态为「新品、重点、普通」的产品。',
    date: '每天自动生成从今天起未来 3 个月的日期。',
    model: '每天自动从 ASIN 表同步型号。',
    sale_owner: '每天自动从 ASIN 表同步销售负责人。',
    activity_annotation: `活动标注\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    daily_price: `购物车价格\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    promotion_days: `推广天数\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    list_price: `LP/WP/TP\n${DAILY_SYNC_TOOLTIP_TEXT}`,
    selling_accounts: `售卖账号\n${DAILY_SYNC_TOOLTIP_TEXT}`,
  };

  const DAILY_SQL_UPDATED_FIELD_SOURCE = {
    country: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    asin: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    date: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    model: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    sale_owner: [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    activity_annotation: DAILY_SYNC_SOURCE_INFOS,
    daily_price: DAILY_SYNC_SOURCE_INFOS,
    promotion_days: DAILY_SYNC_SOURCE_INFOS,
    list_price: DAILY_SYNC_SOURCE_INFOS,
    selling_accounts: DAILY_SYNC_SOURCE_INFOS,
  };

  const DAILY_SQL_UPDATED_FIELDS = new Set(Object.keys(DAILY_SQL_UPDATED_FIELD_TEXT));


  const INITIAL_COLUMNS = [
    { key:'daily_country',         src:'daily',  field:'country',         label:'国家',       hidden:false, pinned:true,  width:70,  editable:false },
    { key:'daily_asin',            src:'daily',  field:'asin',            label:'ASIN',       hidden:false, pinned:true,  width:110, editable:false },
    { key:'daily_date',            src:'daily',  field:'date',            label:'站点时间',       hidden:false, pinned:true,  width:100, editable:false },
    { key:'daily_sale_owner',      src:'daily',  field:'sale_owner',      label:'销售',       hidden:false, pinned:true,  width:80,  editable:false },
    { key:'daily_model',           src:'daily',  field:'model',           label:'型号',       hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_activity_annotation', src:'daily', field:'activity_annotation', label:'活动标注', hidden:false, pinned:false, width:90, editable:false },
    { key:'daily_promotion_days',  src:'daily',  field:'promotion_days',  label:'推广天数',   hidden:false, pinned:false, width:85,  editable:false },
    { key:'daily_daily_price',     src:'daily',  field:'daily_price',     label:'购物车价格',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_list_price',      src:'daily',  field:'list_price',      label:'LP/WP/TP',    hidden:false, pinned:false, width:85,  editable:false },
    { key:'daily_off',             src:'daily',  field:'off',             label:'Off 力度',   hidden:false, pinned:false, width:85,  editable:false },
    { key:'daily_price_after_discount', src:'daily', field:'price_after_discount', label:'折后售价', hidden:false, pinned:false, width:85, editable:false },
    { key:'daily_selling_accounts', src:'daily', field:'selling_accounts', label:'售卖账号', hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_rsg_number',      src:'daily',  field:'rsg_number',      label:'实际刷单总数', hidden:false, pinned:false, width:95, editable:false },
    { key:'weekly_order_items',    src:'weekly', field:'sales',           label:'实际总单量',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_order_items_2',  src:'weekly', field:'sales',           label:'实际总单量',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_zirandan',       src:'weekly', field:'zirandan',        label:'实际自然单',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_guanggaodan',    src:'weekly', field:'guanggaodan',     label:'实际广告单',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'keyword_tracking_actual_natural_order', src:'keyword_tracking', field:'actual_natural_order', label:'实际自然单', hidden:false, pinned:false, width:105, editable:false },
    { key:'weekly_zongliuliang',   src:'weekly', field:'zongliuliang',    label:'实际流量',     hidden:false, pinned:false, width:85,  editable:false },
    { key:'weekly_zongcvr',        src:'weekly', field:'session_conversion_rate', label:'实际转化率', hidden:false, pinned:false, width:110, editable:false },
    { key:'keyword_tracking_est_review_total',    src:'keyword_tracking', field:'est_review_total',     label:'预计刷单总数',            hidden:false, pinned:false, width:100, editable:false },
    { key:'keyword_tracking_est_traffic',         src:'keyword_tracking', field:'est_traffic',          label:'预计流量',                hidden:false, pinned:false, width:90,  editable:false },
    { key:'keyword_tracking_target_cvr',          src:'keyword_tracking', field:'target_cvr',           label:'目标转化率-有备注',              hidden:false, pinned:false, width:90,  editable:false },
    { key:'keyword_tracking_est_nat_order',       src:'keyword_tracking', field:'est_nat_order',        label:'预计自然单 (不含广告单)', hidden:false, pinned:false, width:130, editable:false },
    { key:'keyword_tracking_daily_eval_demand',   src:'keyword_tracking', field:'daily_eval_demand',    label:'单日测评应需量',          hidden:false, pinned:false, width:110, editable:false },
    { key:'keyword_tracking_plan_eval_judgment',  src:'keyword_tracking', field:'plan_eval_judgment',   label:'计划 - 测评单判断',       hidden:false, pinned:false, width:130, editable:false },
    { key:'keyword_tracking_actual_eval_judgment',src:'keyword_tracking', field:'actual_eval_judgment', label:'实际 - 测评结果判断',     hidden:false, pinned:false, width:130, editable:false },
    { key:'keyword_tracking_actual_cvr_judgment', src:'keyword_tracking', field:'actual_cvr_judgment',  label:'实际测评转化率判断',      hidden:false, pinned:false, width:140, editable:false },
    { key:'keyword_tracking_actual_kw_pos', src:'keyword_tracking', field:'actual_keyword_position', label:'整体关键词位实际', hidden:false, pinned:false, width:280, editable:false },
    { key:'tool_kw_master', src:'tool', field:'tool_kw_master', label:'🔑 管理关键词按钮', hidden:true, pinned:false, width:0, editable:false },
  ];
  
  const WEEKLY_ACTUAL_NATURAL_TRIGGER_FIELDS = new Set(['sales', 'guanggaodan', 'session_conversion_rate']);
  const KT_TRIGGER_FIELDS = new Set(['est_traffic','target_cvr','est_nat_order']);
  const DAILY_PRICE_TRIGGER_FIELDS = new Set(['daily_price','list_price']);

  const SRC_UPDATE_CONFIG = {
    daily:            { url: 'daily_asins:update',            pkField: 'country_asin_date' },
    weekly:           { url: 'weekly_performance:update',     pkField: 'country_asin_week' },
    keyword_tracking: { url: 'daily_keyword_tracking:update', pkField: 'country_asin_date' },
  };

  const WEEKLY_SUMMARY_COLLECTION = 'daily_weekly_summary';
  const WEEKLY_SUMMARY_SCOPE = 'push';
  const WEEKLY_SUMMARY_DATA_FIELD = 'push_summary_data';
  const WEEKLY_SUMMARY_ROW_TYPE = 'weeklySummary';

  const isActualKeywordPosColumn = (col) =>
    col?.key === 'keyword_tracking_actual_kw_pos' || col?.field === 'actual_keyword_position';

  const MONEY_FIELDS = new Set(['daily_price','list_price','price_after_discount']);
  const RATE_FIELDS  = new Set(['off', 'session_conversion_rate', 'zongcvr', 'target_cvr']);
  const NUM_FIELDS   = new Set(['promotion_days','rsg_number','sales','zirandan','guanggaodan','zongliuliang','est_review_total','est_traffic','est_nat_order','daily_eval_demand','actual_natural_order',]);
  const DATE_FIELDS  = new Set(['date','updatedAt']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  const isBlankLike = (v) => v === null || v === undefined || v === '';
  const toFormulaNumber = (v) => {
    if (isBlankLike(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
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
  const pickChangedFields = (current, updates) => {
    const changed = {};
    Object.entries(updates || {}).forEach(([field, value]) => {
      if (!isFormulaSameValue(current?.[field], value)) changed[field] = value;
    });
    return changed;
  };
  const getFormulaChangeReason = (currentValue, nextValue) => {
    if (isBlankLike(currentValue) && !isBlankLike(nextValue)) return '当前为空，计算结果有值';
    if (!isBlankLike(currentValue) && isBlankLike(nextValue)) return '当前有值，计算结果为空';

    const currentNumber = toFormulaNumber(currentValue);
    const nextNumber = toFormulaNumber(nextValue);

    if (currentNumber != null && nextNumber != null) return '数值不一致';

    const currentText = String(currentValue ?? '').trim();
    const nextText = String(nextValue ?? '').trim();

    if (currentText !== nextText) return '文本不一致';

    return '类型或格式不一致';
  };
  const appendFormulaChangeDiagnostics = (diagnostics, options) => {
    if (diagnostics.length >= 5) return;

    const { key, sourceName, current, changed } = options;

    Object.entries(changed || {}).some(([field, nextValue]) => {
      if (diagnostics.length >= 5) return true;

      const currentValue = current?.[field];

      diagnostics.push({
        key,
        source: sourceName,
        field: `${sourceName}.${field}`,
        currentValue,
        calculatedValue: nextValue,
        currentType: currentValue === null ? 'null' : typeof currentValue,
        calculatedType: nextValue === null ? 'null' : typeof nextValue,
        reason: getFormulaChangeReason(currentValue, nextValue),
      });

      return false;
    });
  };
  const toDateKey = (v) => v ? String(v).slice(0, 10) : '';
  const parseDateKey = (dateKey) => {
    const key = toDateKey(dateKey);
    if (!key) return null;
    const [y, m, d] = key.split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
  };
  const formatDateKey = (date) => {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  };
  const addDaysToKey = (dateKey, days) => {
    const date = parseDateKey(dateKey);
    if (!date) return '';
    date.setDate(date.getDate() + days);
    return formatDateKey(date);
  };
  const getNaturalWeekRange = (dateKey) => {
    const date = parseDateKey(dateKey);
    if (!date) return null;
    const day = date.getDay();
    const sunday = new Date(date);
    sunday.setDate(date.getDate() - day);
    const saturday = new Date(sunday);
    saturday.setDate(sunday.getDate() + 6);
    return [formatDateKey(sunday), formatDateKey(saturday)];
  };
  const getWeekNoSundayStart = (dateKey) => {
    const range = getNaturalWeekRange(dateKey);
    const date = parseDateKey(dateKey);
    if (!range || !date) return null;
    const start = parseDateKey(range[0]);
    const yearStart = new Date(date.getFullYear(), 0, 1);
    const firstWeekStart = new Date(yearStart);
    firstWeekStart.setDate(yearStart.getDate() - yearStart.getDay());
    return Math.floor((start.getTime() - firstWeekStart.getTime()) / 86400000 / 7) + 1;
  };
  const expandDateRangeToNaturalWeeks = (range) => {
    if (!range) return null;
    const start = range[0] ? getNaturalWeekRange(range[0])?.[0] : null;
    const end = range[1] ? getNaturalWeekRange(range[1])?.[1] : null;
    return [start || range[0] || null, end || range[1] || null];
  };
  const getWeekRangeKey = (dateKey) => {
    const range = getNaturalWeekRange(dateKey);
    return range ? `${range[0]}_${range[1]}` : '';
  };
  const getWeeklySummaryKey = (rowOrParts) => {
    const country = rowOrParts?.country;
    const asin = rowOrParts?.asin;
    const start = rowOrParts?.week_start_date || rowOrParts?.start;
    const end = rowOrParts?.week_end_date || rowOrParts?.end;
    if (!country || !asin || !start || !end) return '';
    return `${country}_${asin}_${start}_${end}`;
  };
  const getWeeklySummaryKeyForDailyRow = (row) => {
    const range = getNaturalWeekRange(row?.date);
    if (!range || !row?.country || !row?.asin) return '';
    return getWeeklySummaryKey({ country: row.country, asin: row.asin, start: range[0], end: range[1] });
  };
  const sumRows = (rows, field) => (Array.isArray(rows) ? rows : []).reduce((s, row) => s + (Number(row?.[field]) || 0), 0);
  const averageRows = (rows, field) => {
    const nums = (Array.isArray(rows) ? rows : [])
      .map((row) => toFormulaNumber(row?.[field]))
      .filter((n) => n != null);
    if (!nums.length) return null;
    return nums.reduce((s, n) => s + n, 0) / nums.length;
  };
  const buildPlanEvalJudgment = (dailyEvalDemand, estReviewTotal) => {
    const demand = Number(dailyEvalDemand) || 0;
    const total = Number(estReviewTotal) || 0;
    if (demand === 0) return '无计划';
    if (demand > total) return `计划测评缺-${demand - total}单`;
    if (demand < total) return `计划测评超+${Math.abs(demand - total)}单`;
    return '√';
  };
  const buildActualEvalJudgment = (actualTotal, estReviewTotal) => {
    const actual = Number(actualTotal) || 0;
    const total = Number(estReviewTotal) || 0;
    if (total === 0 && actual === 0) return '无计划';
    if (total === 0 && actual > 0) return `无计划但测${actual}单`;
    if (actual > total) return `测评超+${actual - total}单`;
    if (actual < total) return `测评缺-${total - actual}单`;
    return '√';
  };
  const buildActualCvrJudgment = (actualCvr, targetCvr) => {
    if (isBlankLike(actualCvr) || isBlankLike(targetCvr)) return '';
    const actual = Number(actualCvr);
    const target = Number(targetCvr);
    if (Number.isNaN(actual) || Number.isNaN(target)) return '';
    const diff = actual - target;
    if (diff > 0) return `CVR满足+${(diff * 100).toFixed(2)}%`;
    if (diff < 0) return `CVR不达标-${(Math.abs(diff) * 100).toFixed(2)}%-广告失控？测评不足？`;
    return 'CVR持平';
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
  const recalcDailyPriceFormulas = async (context, countryAsinDate) => {
    if (!countryAsinDate) return null;
    const currentRes = await context.request({
      url: 'daily_asins:list',
      method: 'get',
      params: { filter: JSON.stringify({ country_asin_date: { $eq: countryAsinDate } }), pageSize: 1 },
    });
    const currentRow = currentRes?.data?.data?.[0];
    const asinCountry = currentRow?.asin_country || (currentRow?.asin && currentRow?.country ? `${currentRow.asin}_${currentRow.country}` : '');
    if (!asinCountry) return null;

    const allRes = await context.request({
      url: 'daily_asins:list',
      method: 'get',
      params: { filter: JSON.stringify({ asin_country: { $eq: asinCountry } }), pageSize: 1000 },
    });
    const rows = Array.isArray(allRes?.data?.data) ? allRes.data.data : [];
    const lpDurationMap = buildLpDurationMap(rows);
    const currentUpdates = {};

    await Promise.all(rows.map(async (row) => {
      const key = row.country_asin_date;
      if (!key) return;
      const updates = {
        off: buildDailyOffValue(row),
        lp_duration_days: lpDurationMap[key] ?? null,
      };
      if (key === countryAsinDate) Object.assign(currentUpdates, updates);
      if (String(row.off ?? '') === String(updates.off ?? '') && String(row.lp_duration_days ?? '') === String(updates.lp_duration_days ?? '')) return;
      await context.request({
        url: 'daily_asins:update',
        method: 'post',
        params: { filterByTk: key },
        data: updates,
      });
    }));

    return currentUpdates;
  };

  const READONLY_FIELDS = new Set(['country_asin_date','country_asin_week','id','country','asin','date','updatedAt','keywords','tool_kw_master','rsg_number','est_review_total','daily_eval_demand','plan_eval_judgment','actual_eval_judgment','actual_cvr_judgment','est_review_qty','actual_review_qty']);

  const DYNAMIC_COLOR = { country: (row) => COUNTRY_COLORS[row.country] || null };

  const SRC_GROUP_CONFIG = [
    { src:'tool',             label:'🛠️ 工具按钮',           color:'#fa8c16'    },
    { src:'daily',            label:'📋 每日 ASIN',          color:COLOR_GREEN  },
    { src:'weekly',           label:'📈 周产品表现',         color:COLOR_ORANGE },
    { src:'keyword_tracking', label:'🔍 关键词追踪汇总',     color:'#b5796a'    },
    { src:'keyword_screenshot', label:'📸 整体关键词位实际',       color:'#d4380d'    },
  ];

  // 【新增】关键词列的 6 个子字段定义（表头和单元格都按此顺序）
  const KW_SUB_FIELDS = [
    { key: 'est_review_qty',    label: '预计刷单', type: 'number',   width: 80,  headerColor: '#FFF1B8' },
    { key: 'est_rank',          label: '预测词位', type: 'text',     width: 100, headerColor: '#D6E4FF' },
    { key: 'actual_review_qty', label: '实际刷单', type: 'number',   width: 80,  headerColor: '#B5F5EC' },
    { key: 'actual_rank',       label: '实际词位', type: 'text',     width: 100, headerColor: '#F9F0FF' },

    // 选填字段：默认隐藏，需要时展开
    { key: 'review_notes',      label: '复盘',    type: 'textarea', width: 100, optional: true, headerColor: '#FFF0F6' },
    { key: 'new_plan',          label: '新计划',  type: 'textarea', width: 100, optional: true, headerColor: '#FFF7E6' },
  ];
  const DEFAULT_KW_SUB_FIELD_HEADER_COLORS = Object.fromEntries(KW_SUB_FIELDS.map((field) => [field.key, field.headerColor]));

  // 关键词列宽度根据是否显示选填字段动态计算：默认约 400px，展开约 608px

  const GAP = 4;
  const KW_CELL_PADDING_X = 8;
  const KW_TD_PADDING_X = 4;
  const KW_SAFE_X = 16;

  function getKwVisibleSubFields(showOptional) {
    return showOptional
      ? KW_SUB_FIELDS
      : KW_SUB_FIELDS.filter((f) => !f.optional);
  }

  function getKwContentWidth(showOptional) {
    return getKwVisibleSubFields(showOptional).reduce((s, f) => s + f.width, 0);
  }

  function getKwMinWidth(showOptional) {
    const fields = getKwVisibleSubFields(showOptional);

    return (
      getKwContentWidth(showOptional) +
      Math.max(0, fields.length - 1) * GAP +
      KW_CELL_PADDING_X +
      KW_TD_PADDING_X +
      KW_SAFE_X
    );
  }

  function getSafeKwColWidth(width, showOptional = false) {
    const minWidth = getKwMinWidth(showOptional);
    return Math.max(Number(width) || minWidth, minWidth);
  }

  // 完整展开时的最小宽度：608px
  const KW_COL_TOTAL_WIDTH = getKwMinWidth(true);

  // 默认隐藏复盘/新计划时的最小宽度：400px
  const KW_COL_COMPACT_WIDTH = getKwMinWidth(false);


  const AUTO_WIDTH_CONFIG = {
    normalMin: 60,
    normalMax: 420,
    keywordMin: KW_COL_COMPACT_WIDTH,
    keywordMax: 1200,
  };


  function clampWidth(width, min, max) {
    return Math.max(min, Math.min(max, width));
  }

  function measureTextWidth(text, font) {
    const value = String(text || '');

    if (!value) return 0;

    try {
      const canvas = document.createElement('canvas');
      const ctx2d = canvas.getContext('2d');

      if (!ctx2d) {
        return value.length * 14;
      }

      ctx2d.font = font || `600 ${FONT_SIZE_SM}px system-ui, sans-serif`;
      return Math.ceil(ctx2d.measureText(value).width);
    } catch {
      return value.length * 14;
    }
  }

  function calcHeaderAutoWidth(label, options = {}) {
    const {
      fontSize = FONT_SIZE_SM,
      fontWeight = 600,
      extra = 42,
      min = AUTO_WIDTH_CONFIG.normalMin,
      max = AUTO_WIDTH_CONFIG.normalMax,
    } = options;

    const font = `${fontWeight} ${fontSize}px system-ui, sans-serif`;
    const textWidth = measureTextWidth(label, font);

    return clampWidth(textWidth + extra, min, max);
  }

  function calcKeywordHeaderAutoWidth(label, showOptional = false) {
    const minWidth = getKwMinWidth(showOptional);

    const titleWidth = calcHeaderAutoWidth(label, {
      fontSize: FONT_SIZE_XS,
      fontWeight: 700,
      extra: 54,
      min: minWidth,
      max: AUTO_WIDTH_CONFIG.keywordMax,
    });

    return Math.max(minWidth, titleWidth);
  }


  function getKwSubFieldsForWidth(colWidth, showOptional = false) {
    const fields = getKwVisibleSubFields(showOptional);
    const contentWidth = fields.reduce((s, f) => s + f.width, 0);

    const totalWidth = getSafeKwColWidth(colWidth, showOptional);

    const fixedExtra =
      Math.max(0, fields.length - 1) * GAP +
      KW_CELL_PADDING_X +
      KW_TD_PADDING_X +
      KW_SAFE_X;

    const availableContentWidth = Math.max(
      contentWidth,
      totalWidth - fixedExtra
    );

    const scale = availableContentWidth / contentWidth;

    return fields.map((sub) => ({
      ...sub,
      width: Math.max(sub.width, Math.floor(sub.width * scale)),
    }));
  }





  const buildColumnPayload = (cols, preserved = []) => [
    ...(Array.isArray(cols) ? cols : []).map((c) => ({
      key: c.key, hidden: c.hidden === true, pinned: c.pinned === true,
      width: Number(c.width) || 80, headerColor: c.headerColor || null,
      bodyColor: c.bodyColor || null,
      editable: c.editable === true,
    })),
    ...preserved,
  ];

  const mergeColumnPayloadEntries = (basePayload = [], overridePayload = []) => {
    const result = (Array.isArray(basePayload) ? basePayload : [])
      .filter((c) => c?.key)
      .map((c) => ({ ...c }));
    const indexMap = new Map(result.map((c, idx) => [c.key, idx]));

    (Array.isArray(overridePayload) ? overridePayload : []).forEach((item) => {
      if (!item?.key) return;
      const idx = indexMap.get(item.key);
      if (idx >= 0) {
        result[idx] = { ...result[idx], ...item };
      } else {
        indexMap.set(item.key, result.length);
        result.push({ ...item });
      }
    });

    return result;
  };

  const patchColumnPayloadEntry = (payload = [], key, patch = {}, fallback = {}) => {
    if (!key) return Array.isArray(payload) ? payload : [];
    const base = Array.isArray(payload) ? payload : [];
    let found = false;
    const next = base.map((item) => {
      if (item?.key !== key) return item;
      found = true;
      return { ...item, ...patch };
    });

    if (!found) {
      next.push({
        key,
        hidden: fallback.hidden === true,
        pinned: fallback.pinned === true,
        width: Number(fallback.width) || 80,
        headerColor: fallback.headerColor || null,
        bodyColor: fallback.bodyColor || null,
        editable: fallback.editable === true,
        ...patch,
      });
    }

    return next;
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
      result.push({ ...initMap[s.key], hidden: s.hidden === true, pinned: s.pinned === true, width: Number(s.width) || initMap[s.key].width, headerColor: migrateLegacyColor(s.headerColor), bodyColor: s.bodyColor || null, editable: s.editable === true });
    });
    INITIAL_COLUMNS.forEach((c) => { if (!savedMap[c.key]) result.push({ ...c }); });
    return result;
  };

  const normalizeColumnViewId = (viewId) => {
    const id = String(viewId || '').trim();
    return id || DEFAULT_COLUMN_VIEW_IDS[0];
  };

  const isDefaultColumnViewId = (viewId) => DEFAULT_COLUMN_VIEW_IDS.includes(viewId);

  const normalizeColumnViewName = (id, name) => {
    const text = String(name || '').trim();
    if (id === 'default_1' && (!text || text === '默认视图一' || text === '完整列')) return DEFAULT_COLUMN_VIEW_LABELS.default_1;
    return text || DEFAULT_COLUMN_VIEW_LABELS[id] || '自定义视图';
  };

  const getViewLabel = (view) => normalizeColumnViewName(view?.id, view?.name);
  const normalizeKwSubFieldHeaderColors = (colors = {}) => {
    const result = {};
    KW_SUB_FIELDS.forEach((field) => {
      const value = colors?.[field.key];
      if (typeof value === 'string' && value.trim()) result[field.key] = value;
    });
    return result;
  };

  const getHeaderColorMapFromPayload = (payload) => {
    const map = {};
    if (!Array.isArray(payload)) return map;
    payload.forEach((item) => {
      if (!item?.key) return;
      const hasHeaderColor = Object.prototype.hasOwnProperty.call(item, 'headerColor');
      const hasBodyColor = Object.prototype.hasOwnProperty.call(item, 'bodyColor');
      if (!hasHeaderColor && !hasBodyColor) return;
      map[item.key] = {
        headerColor: hasHeaderColor ? (migrateLegacyColor(item.headerColor) || null) : undefined,
        bodyColor: hasBodyColor ? (item.bodyColor || null) : undefined,
      };
    });
    return map;
  };

  const mergeHeaderColorsIntoColumnPayload = (targetPayload, sourceHeaderColorMap) => {
    const colorMap = sourceHeaderColorMap && typeof sourceHeaderColorMap === 'object' ? sourceHeaderColorMap : {};
    if (!Object.keys(colorMap).length || !Array.isArray(targetPayload)) return targetPayload;
    return targetPayload.map((item) => {
      if (!item?.key || !Object.prototype.hasOwnProperty.call(colorMap, item.key)) return item;
      const styleConfig = colorMap[item.key];
      const hasNextHeaderColor = styleConfig && typeof styleConfig === 'object' && Object.prototype.hasOwnProperty.call(styleConfig, 'headerColor');
      const hasNextBodyColor = styleConfig && typeof styleConfig === 'object' && Object.prototype.hasOwnProperty.call(styleConfig, 'bodyColor');
      const nextHeaderColor = hasNextHeaderColor
        ? styleConfig.headerColor
        : (typeof styleConfig === 'string' ? migrateLegacyColor(styleConfig) : undefined);
      const nextBodyColor = hasNextBodyColor ? (styleConfig.bodyColor || null) : undefined;
      const currentHeaderColor = migrateLegacyColor(item.headerColor) || null;
      const currentBodyColor = item.bodyColor || null;
      const patch = {};
      if (nextHeaderColor !== undefined && currentHeaderColor !== nextHeaderColor) patch.headerColor = nextHeaderColor;
      if (nextBodyColor !== undefined && currentBodyColor !== nextBodyColor) patch.bodyColor = nextBodyColor;
      return Object.keys(patch).length ? { ...item, ...patch } : item;
    });
  };

  const syncHeaderColorsIntoColumnViews = (views, sourceHeaderColorMap, sourceKwSubColors = {}, updatedAt = new Date().toISOString()) => {
    const colorMap = sourceHeaderColorMap && typeof sourceHeaderColorMap === 'object' ? sourceHeaderColorMap : {};
    const kwColors = normalizeKwSubFieldHeaderColors(sourceKwSubColors);
    const hasHeaderColors = Object.keys(colorMap).length > 0;
    const hasKwColors = Object.keys(kwColors).length > 0;
    if (!hasHeaderColors && !hasKwColors) return Array.isArray(views) ? views : [];
    return (Array.isArray(views) ? views : []).map((view) => ({
      ...view,
      payload: hasHeaderColors ? mergeHeaderColorsIntoColumnPayload(view.payload, colorMap) : view.payload,
      kwSubFieldHeaderColors: kwColors,
      updated_at: updatedAt,
    }));
  };

  const normalizeColumnViewList = (raw, fallbackLegacyPayload = null, options = {}) => {
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
        kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(view.kwSubFieldHeaderColors || view.kw_sub_field_header_colors),
        updated_at: view.updated_at || null,
      };
    });
    if (includeDefaultViews) {
      DEFAULT_COLUMN_VIEW_IDS.forEach((id) => {
        if (viewMap[id]) return;
        const legacyPayload = Array.isArray(fallbackLegacyPayload) && fallbackLegacyPayload.length ? fallbackLegacyPayload : null;
        viewMap[id] = {
          id,
          name: normalizeColumnViewName(id),
          type: 'default',
          payload: legacyPayload || buildColumnPayload(INITIAL_COLUMNS.map((c) => ({ ...c }))),
          kwSubFieldHeaderColors: {},
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
    const defaultViews = normalizeColumnViewList(setting[DEFAULT_COLUMN_VIEWS_KEY], setting[LEGACY_DEFAULT_COLUMNS_KEY]);
    const personalRaw = setting[COLUMN_VIEW_SETTING_KEY] || {};
    const personalViews = normalizeColumnViewList(personalRaw, null, { includeDefaultViews: false, onlyCustomViews: true });
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
        kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(view.kwSubFieldHeaderColors),
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
      const state = await loadColumnViewStateFromUser();
      const existingSaved = getColumnViewPayload(state, viewId) || [];
      const incomingKeys = new Set((Array.isArray(cols) ? cols : []).map((c) => c.key).filter(Boolean));
      const preserved = existingSaved.filter((c) => c?.key && !incomingKeys.has(c.key));
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

  const saveDefaultColumnViewToCurrentUser = async (defaultView) => {
    if (!currentUserId || !IS_ADMIN) return false;
    const sourceView = {
      id: DEFAULT_COLUMN_VIEW_IDS[0],
      name: DEFAULT_COLUMN_VIEW_LABELS.default_1,
      type: 'default',
      payload: Array.isArray(defaultView?.payload) ? defaultView.payload : [],
      kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(defaultView?.kwSubFieldHeaderColors),
      updated_at: defaultView?.updated_at || new Date().toISOString(),
    };
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    const existingSetting = userRes?.data?.data?.setting || {};
    const existingState = normalizeColumnViewState(existingSetting);
    const sourceHeaderColorMap = getHeaderColorMapFromPayload(sourceView.payload);
    const syncedViews = syncHeaderColorsIntoColumnViews(
      existingState.views.map((view) => isDefaultColumnViewId(view?.id) ? { ...view, ...sourceView } : view),
      sourceHeaderColorMap,
      sourceView.kwSubFieldHeaderColors,
      sourceView.updated_at
    );
    await ctx.request({
      url: 'users:update',
      method: 'post',
      params: { filterByTk: currentUserId },
      data: {
        setting: {
          ...existingSetting,
          [DEFAULT_COLUMN_VIEWS_KEY]: { views: [sourceView] },
          [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload({ ...existingState, views: syncedViews }, existingState.activeViewId),
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return true;
  };

  const saveDefaultColumnViewToUsers = async (defaultView, targetUserIds = null) => {
    if (!IS_ADMIN) return { ok: false, total: 0, failCount: 0 };
    const sourceView = {
      id: DEFAULT_COLUMN_VIEW_IDS[0],
      name: DEFAULT_COLUMN_VIEW_LABELS.default_1,
      type: 'default',
      payload: Array.isArray(defaultView?.payload) ? defaultView.payload : [],
      kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(defaultView?.kwSubFieldHeaderColors),
      updated_at: new Date().toISOString(),
    };
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
        const existingState = normalizeColumnViewState(existingSetting);
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(sourceView.payload);
        const syncedViews = syncHeaderColorsIntoColumnViews(
          existingState.views.map((view) => isDefaultColumnViewId(view?.id) ? { ...view, ...sourceView } : view),
          sourceHeaderColorMap,
          sourceView.kwSubFieldHeaderColors,
          sourceView.updated_at
        );
        await ctx.request({
          url: 'users:update',
          method: 'post',
          params: { filterByTk: uid },
          data: {
            setting: {
              ...existingSetting,
              [DEFAULT_COLUMN_VIEWS_KEY]: { views: [sourceView] },
              [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload({ ...existingState, views: syncedViews }, existingState.activeViewId),
              [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
            },
          },
        });
      })
    );
    const failCount = results.filter((r) => r.status === 'rejected').length;
    return { ok: failCount === 0, total: userList.length, failCount };
  };

  const PRESET_COLOR_VALUES = new Set(
    PRESET_COLORS.map((pc) => String(pc.value).toLowerCase())
  );

  const migrateLegacyColor = (color) => {
    if (!color) return null;
    const normalized = String(color).toLowerCase();
    if (PRESET_COLOR_VALUES.has(normalized)) {
      return color;
    }
    return LEGACY_COLOR_MAP[normalized] || color;
  };


  const buildColumns = async () => mergeColumnsWithInitial(await loadColsFromUser());

  const formatCell = (col, row) => {
    const v = row[col.field];
    if (col.field === 'promo_day') return v === 1 || v === true ? '是' : (v === 0 || v === false ? '否' : '—');
    if (MONEY_FIELDS.has(col.field)) return (v != null && v !== '') ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
    if (RATE_FIELDS.has(col.field))  return (v != null && v !== '') ? `${(Number(v) * 100).toFixed(2)}%` : '—';
    if (DATE_FIELDS.has(col.field)) {
      if (!v) return '—';
      if (row?._isWeeklySummary) return String(v);
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

  /* ========== 【修复】关键词单元格：消除输入框溢出 ========== */
  const KeywordCell = ({ data, countryAsinDate, date, role, onSaved, colWidth, showOptionalFields, onSubMouseDown, onSubMouseEnter, isSubSelected, readOnly = false, cellBackground = null, onProgress }) => {
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);
    const kwSubFields = useMemo(() => {
      return getKwSubFieldsForWidth(colWidth, showOptionalFields);
    }, [colWidth, showOptionalFields]);
    
    useEffect(() => {
      if (editingField && inputRef.current) {
        inputRef.current.focus?.();
        inputRef.current.select?.();
      }
    }, [editingField]);

    if (!data || !data.kw) {
      return React.createElement('div', {
        style: {
          width: '100%',
          boxSizing: 'border-box',
          color: '#ccc',
          textAlign: 'center',
          padding: '12px',
          fontSize: '13px',
          background: readOnly ? '#eaf4ff' : (cellBackground || '#fafafa'),
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '40px'
        }
      }, '未配置关键词');
    }


    const kw = data.kw;
    const daily = data.daily || {};
    const handleSave = async (field) => {
      try {
        setSaving(true);
        onProgress?.({ label: '正在保存数据...', percent: 10 });
        if (daily.id) {
          await ctx.request({
            url: 'new_eval_words_daily:update',
            method: 'post',
            params: { filterByTk: daily.id },
            data: { [field]: editValue === '' ? null : editValue }
          });
          daily[field] = editValue === '' ? null : editValue;
        } else {
          const res = await ctx.request({
            url: 'new_eval_words_daily:create',
            method: 'post',
            data: withCreateTimestamps({
              country_asin_date: countryAsinDate,
              eval_word_id: kw.id,
              date,
              [field]: editValue === '' ? null : editValue
            })
          });
          Object.assign(daily, res?.data?.data || { id: 'new', [field]: editValue });
        }
        if (field === 'est_review_qty' || field === 'actual_review_qty') {
          onProgress?.({ label: '正在同步日公式...', percent: 35 });
          await onSaved?.(countryAsinDate);
        }
      } catch (err) {
        ctx.message.error(`保存失败: ${err.message}`);
      } finally {
        setSaving(false);
        setEditingField(null);
      }
    };

    // 关键：内部元素 100% 宽度，让 flex 容器自己分配
    const renderField = (sub) => {
      const val = daily[sub.key];
      const isEditing = editingField === sub.key;
      const isNumber = sub.type === 'number';
      const isTextarea = sub.type === 'textarea';

      const display = val != null && val !== '' ? String(val) : '';
      const selected = !!isSubSelected?.(sub.key);

      const baseBoxStyle = {
        width: '100%',                // ← 关键：占满父容器
        minHeight: '32px',
        padding: '6px 8px',
        background: readOnly ? '#eaf4ff' : (cellBackground || '#fff'),
        border: readOnly ? '1px solid #8ec5ff' : '1px solid #d0d5dd',
        borderRadius: '4px',
        cursor: readOnly ? 'default' : 'cell',
        fontSize: '13px',
        fontWeight: readOnly ? 700 : (isNumber ? 700 : 500),
        color: val != null && val !== '' ? '#000' : '#bbb',
        textAlign: isNumber ? 'center' : 'left',
        boxSizing: 'border-box',      // ← 关键：包含 padding/border
        overflow: 'hidden',
        whiteSpace: 'normal',
        lineHeight: '15px',
        maxHeight: '30px',
        wordBreak: 'break-all',
        lineHeight: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isNumber ? 'center' : 'flex-start',
        boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined,
      };

      if (isEditing) {
        if (isTextarea) {
          return React.createElement(Input.TextArea, {
            ref: inputRef,
            size: 'small',
            value: editValue,
            onChange: e => setEditValue(e.target.value),
            onBlur: () => handleSave(sub.key),
            onKeyDown: e => {
              if (e.key === 'Escape') setEditingField(null);
              if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSave(sub.key);
            },
            autoSize: { minRows: 1, maxRows: 3 },
            style: { width: '100%', fontSize: '13px' }
          });
        }
        if (isNumber) {
          return React.createElement(InputNumber, {
            ref: inputRef,
            size: 'small',
            value: editValue === '' ? null : editValue,
            onChange: v => setEditValue(v === null || v === undefined ? '' : v),
            onBlur: () => handleSave(sub.key),
            onPressEnter: () => handleSave(sub.key),
            style: { width: '100%' },          // ← 关键
            controls: false                     // 去掉 +/- 按钮节省宽度
          });
        }
        return React.createElement(Input, {
          ref: inputRef,
          size: 'small',
          value: editValue,
          onChange: e => setEditValue(e.target.value),
          onBlur: () => handleSave(sub.key),
          onPressEnter: () => handleSave(sub.key),
          onKeyDown: e => { if (e.key === 'Escape') setEditingField(null); },
          style: { width: '100%' }              // ← 关键
        });
      }

      const boxEl = React.createElement('div', {
        onDoubleClick: () => {
          if (readOnly) return;
          setEditingField(sub.key);
          setEditValue(val ?? '');
        },
        style: baseBoxStyle
      }, display || '—');

      if ((isTextarea || sub.type === 'text') && display && display.length > 8) {
        return React.createElement(Tooltip, {
          title: React.createElement('pre', {
            style: { margin: 0, whiteSpace: 'pre-wrap', fontSize: '13px', lineHeight: '1.5', maxWidth: '420px' }
          }, display),
          placement: 'topLeft',
          mouseEnterDelay: 0.3,
          overlayStyle: { maxWidth: '460px' }
        }, boxEl);
      }

      return boxEl;
    };

    return React.createElement('div', {
      style: {
        display: 'flex',
        gap: '4px',
        alignItems: 'center',
        padding: '4px 4px',
        width: '100%',
        boxSizing: 'border-box',
      }
    },
      kwSubFields.map(sub =>
        React.createElement('div', {
          key: sub.key,
          onMouseDown: (e) => onSubMouseDown?.(e, sub.key),
          onMouseEnter: (e) => onSubMouseEnter?.(e, sub.key),
          style: {
            // ← 关键：用 flex 而不是固定 width
            flex: `0 0 ${sub.width}px`,
            maxWidth: `${sub.width}px`,
            minWidth: 0,                 // 允许内容收缩
            display: 'flex',
            boxSizing: 'border-box'
          }
        }, renderField(sub))
      )
    );
  };


  const ActualKeywordPosCell = ({ rowId, country, asin, date, screenshot, onSaved, readOnly = false, cellBackground = null, cellKey, openSignal }) => {
    const [content, setContent] = useState(screenshot || '');
    const [isEditing, setIsEditing] = useState(false);
    const [tempContent, setTempContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [editorPos, setEditorPos] = useState({ top: 0, left: 0 });
    const editorRef = useRef(null);

    useEffect(() => {
      setContent(screenshot || '');
    }, [screenshot]);

    const extractImages = (text) => {
      const regex = /!\[.*?\]\((.*?)\)/g;
      const urls = [];
      let match;
      while ((match = regex.exec(text || '')) !== null) {
        urls.push(match[1]);
      }
      return urls;
    };

    const imageUrls = useMemo(() => extractImages(content), [content]);

    const cleanText = useMemo(() => {
      if (!content) return '';
      return content.replace(/!\[.*?\]\(.*?\)\s*/g, '').trim();
    }, [content]);

    const openEditor = (e) => {
      if (readOnly) return;
      e?.preventDefault?.();
      e?.stopPropagation?.();
      const rect = e?.rect;
      const panelWidth = 520;
      const gap = 8;
      let left = rect ? rect.right + gap : 24;
      let top = rect ? rect.top : 24;
      if (rect && rect.left > panelWidth + gap + 12) left = rect.left - panelWidth - gap;
      left = Math.max(12, left);
      top = Math.max(12, top);
      setEditorPos({ top, left });
      setTempContent(content || '');
      setIsEditing(true);
    };

    useEffect(() => {
      if (!openSignal || openSignal.cellKey !== cellKey) return;
      openEditor({ rect: openSignal.rect, preventDefault: () => {}, stopPropagation: () => {} });
    }, [openSignal]);

    const saveToDatabase = async (newContent) => {
      if (!rowId) return ctx.message.error('记录ID不存在');
      const valueToSave = newContent || null;

      try {
        const filterStr = JSON.stringify({ country_asin_date: { $eq: rowId } });
        const res = await ctx.request({
          url: 'daily_keyword_tracking:list',
          method: 'get',
          params: { filter: filterStr, pageSize: 1 },
        });
        const existing = Array.isArray(res?.data?.data) ? res.data.data[0] : null;
        if (existing) {
          await ctx.request({
            url: 'daily_keyword_tracking:update',
            method: 'post',
            params: { filterByTk: rowId },
            data: { actual_keyword_position: valueToSave }
          });
        } else {
          await ctx.request({
            url: 'daily_keyword_tracking:create',
            method: 'post',
            data: withCreateTimestamps({
              country_asin_date: rowId,
              country: country || null,
              asin: asin || null,
              date: date || null,
              actual_keyword_position: valueToSave,
            }),
          });
        }

        setContent(valueToSave || '');
        onSaved?.(rowId);
        return true;
      } catch (err) {
        console.error(err);
        ctx.message.error('保存失败');
        return false;
      }
    };

    const saveAndExit = async () => {
      if (tempContent !== content) {
        await saveToDatabase(tempContent);
      }
      setIsEditing(false);
    };

    const cancelEdit = () => {
      setTempContent('');
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
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        const url = res?.data?.data?.url || res?.data?.url;

        if (url) {
          const markdownImage = `![实际关键词位截图](${url})`;
          const newContent = tempContent
            ? tempContent + '\n\n' + markdownImage
            : markdownImage;

          setTempContent(newContent);
          await saveToDatabase(newContent);
        }
      } catch (err) {
        ctx.message.error('上传失败');
      } finally {
        setUploading(false);
      }
    };

    const handlePaste = (e) => {
      if (!isEditing) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let item of items) {
        if (item.type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) uploadFile(file);
          return;
        }
      }
    };

    const openPreview = (url) => setPreviewUrl(url);
    const closePreview = () => setPreviewUrl(null);
    const editorImageUrls = useMemo(() => extractImages(tempContent), [tempContent]);

    const previewLayer = previewUrl && React.createElement('div', {
      style: {
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.88)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      },
      onClick: closePreview
    },
      React.createElement('div', {
        style: { position: 'relative', maxWidth: '95%', maxHeight: '95%' },
        onClick: e => e.stopPropagation()
      },
        React.createElement('img', {
          src: previewUrl,
          style: {
            maxWidth: '100%',
            maxHeight: '90vh',
            borderRadius: '8px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.7)'
          }
        }),
        React.createElement('div', {
          onClick: closePreview,
          style: {
            position: 'absolute',
            top: '-18px',
            right: '-18px',
            background: '#fff',
            width: '34px',
            height: '34px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '18px',
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.4)'
          }
        }, '✕')
      )
    );

    if (!isEditing) {
      const visibleImages = imageUrls.slice(0, 2);
      const extraCount = Math.max(0, imageUrls.length - visibleImages.length);
      const isEmpty = !cleanText && imageUrls.length === 0;

      return React.createElement(React.Fragment, null,
        React.createElement('div', {
          style: {
            minHeight: '54px',
            maxHeight: '68px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: isEmpty ? 'center' : undefined,
            gap: '8px',
            padding: '6px 8px',
            background: cellBackground || (content ? '#fafafa' : '#fff'),
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            cursor: 'cell',
            overflow: 'hidden',
            boxSizing: 'border-box'
          }
        },
          imageUrls.length > 0 && React.createElement('div', {
            style: {
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              flexShrink: 0
            }
          },
            visibleImages.map((url, i) => React.createElement('img', {
              key: i,
              src: url,
              onClick: (e) => {
                e.stopPropagation();
                openPreview(url);
              },
              style: {
                width: '48px',
                height: '42px',
                objectFit: 'cover',
                borderRadius: '4px',
                border: '1px solid #d9d9d9',
                background: '#fff',
                cursor: 'zoom-in'
              }
            })),
            extraCount > 0 && React.createElement('div', {
              style: {
                width: '34px',
                height: '42px',
                borderRadius: '4px',
                background: '#f0f0f0',
                color: '#666',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                border: '1px solid #ddd'
              }
            }, `+${extraCount}`)
          ),

          React.createElement('div', {
            style: {
              flex: 1,
              minWidth: 0,
              height: isEmpty ? '100%' : undefined,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: isEmpty ? 'center' : undefined,
              alignItems: isEmpty ? 'center' : undefined,
              gap: '2px'
            }
          },
            React.createElement(Tooltip, {
              title: cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : '+'),
              placement: 'topLeft',
              mouseEnterDelay: 0.3
            },
              React.createElement('div', {
                style: {
                  fontSize: isEmpty ? '18px' : '13px',
                  color: cleanText ? '#333' : '#999',
                  lineHeight: isEmpty ? '20px' : '18px',
                  fontWeight: isEmpty ? 700 : 400,
                  textAlign: isEmpty ? 'center' : 'left',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              },
                cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : '+')
              )
            )
          )
        ),

        previewLayer
      );
    }

    return React.createElement(React.Fragment, null,
      React.createElement('div', {
        style: {
          minHeight: '54px',
          maxHeight: '68px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '6px 8px',
          background: '#eef6ff',
          border: '1px solid #1890ff',
          borderRadius: '6px',
          color: '#0958d9',
          boxSizing: 'border-box',
          overflow: 'hidden',
          fontSize: '12px',
        },
      }, uploading ? '正在上传截图...' : '正在编辑，点击框外保存'),
      React.createElement('div', {
        style: { position: 'fixed', inset: 0, zIndex: 9995, background: 'transparent' },
        onMouseDown: () => { if (!uploading) saveAndExit(); },
      }),
      React.createElement('div', {
        ref: editorRef,
        'data-rich-editor-panel': '1',
        style: { position: 'fixed', top: `${editorPos.top}px`, left: `${editorPos.left}px`, zIndex: 9996, width: 'min(520px, calc(100vw - 24px))', maxHeight: 'calc(100vh - 24px)', background: '#fff', borderRadius: '8px', boxShadow: '0 12px 32px rgba(15,23,42,0.24)', border: '1px solid #d8e3f0', display: 'flex', flexDirection: 'column', overflow: 'hidden' },
        onMouseDown: (e) => e.stopPropagation(),
        onClick: (e) => e.stopPropagation(),
      },
        React.createElement('div', { style: { padding: '9px 12px', borderBottom: '1px solid #edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
          React.createElement('div', { style: { fontWeight: 700, color: '#1f2937', fontSize: '13px' } }, '编辑实际关键词位'),
          React.createElement('button', {
            type: 'button',
            onClick: cancelEdit,
            disabled: uploading,
            style: { border: 'none', background: 'transparent', color: '#94a3b8', fontSize: '20px', lineHeight: 1, cursor: uploading ? 'not-allowed' : 'pointer', padding: '2px 4px' },
          }, '×')
        ),
        React.createElement('div', { style: { padding: '10px 12px 8px' } },
          React.createElement('textarea', {
            value: tempContent,
            onChange: e => setTempContent(e.target.value),
            onPaste: handlePaste,
            onKeyDown: (e) => {
              if (e.key === 'Escape') {
                cancelEdit();
              } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                saveAndExit();
              }
            },
            autoFocus: true,
            disabled: uploading,
            style: {
              width: '100%',
              height: editorImageUrls.length ? '180px' : '260px',
              minHeight: '150px',
              maxHeight: '46vh',
              border: '1px solid #b6d7ff',
              borderRadius: '6px',
              padding: '9px 10px',
              fontSize: '13px',
              fontFamily: 'monospace',
              resize: 'vertical',
              background: '#fbfdff',
              lineHeight: '20px',
              outline: 'none',
              boxSizing: 'border-box',
              overflow: 'auto',
            },
            placeholder: '输入文字描述...\n支持 Ctrl + V 粘贴截图\nCtrl + Enter 保存，Esc 取消'
          }),
          editorImageUrls.length > 0 && React.createElement('div', {
            style: { marginTop: '8px', display: 'flex', gap: '8px', flexWrap: 'wrap', maxHeight: '150px', overflow: 'auto', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#f8fafc' },
          },
            editorImageUrls.map((url, idx) =>
              React.createElement('img', {
                key: `${url}-${idx}`,
                src: url,
                onClick: (e) => { e.stopPropagation(); openPreview(url); },
                style: { width: '120px', height: '90px', objectFit: 'cover', borderRadius: '4px', border: '1px solid #d9d9d9', background: '#fff', cursor: 'zoom-in' },
              })
            )
          )
        ),
        React.createElement('div', { style: { padding: '8px 12px 10px', borderTop: '1px solid #edf2f7', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' } },
          React.createElement('div', { style: { color: '#64748b', fontSize: '12px' } }, uploading ? '截图上传中，请稍候' : '点击框外自动保存'),
          React.createElement('div', { style: { display: 'flex', gap: '8px' } },
            React.createElement('button', {
              type: 'button',
              onClick: cancelEdit,
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
  };


  const LegacyKeywordMasterDrawer = ({ visible, onClose, countryAsinOptions, country: propCountry, asin: propAsin, onRefresh }) => {
    const [country, setCountry]             = useState(propCountry || null);
    const [asin, setAsin]                   = useState(propAsin || null);
    const hasContext = !!(propCountry && propAsin);
    const [keywords, setKeywords]           = useState([]);
    const [loading, setLoading]             = useState(false);
    const [saving, setSaving]               = useState(false);
    const [editingNameId, setEditingNameId] = useState(null);
    const [nameValue, setNameValue]         = useState('');
    const [addingRole, setAddingRole]       = useState(null);
    const [newName, setNewName]             = useState('');
    const [keyTargetValue, setKeyTargetValue] = useState('');
    const nameInputRef = useRef(null);
    const keyTargetInputRef = useRef(null);

    const countryAsin = country && asin ? `${country}_${asin}` : null;

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
      if (!countryAsin) { setKeywords([]); return; }
      setLoading(true);
      try{
        const r = await ctx.request({ url: 'new_eval_words:list', method: 'get',
          params: { filter: JSON.stringify({ country_asin: { $eq: countryAsin } }), pageSize: 200 } });
        setKeywords(r?.data?.data || []);
      } catch { ctx.message.error('加载关键词失败'); }
      finally { setLoading(false); }
    }, [countryAsin]);

    useEffect(() => { if (visible && countryAsin) load(); }, [visible, countryAsin, load]);
    useEffect(() => {
      if (visible) {
        if (propCountry) setCountry(propCountry);
        if (propAsin)    setAsin(propAsin);
      } else {
        setKeywords([]); setAddingRole(null); setNewName(''); setKeyTargetValue('');
        if (!propCountry) setCountry(null);
        if (!propAsin)    setAsin(null);
      }
    }, [visible, propCountry, propAsin]);

    useEffect(() => { if (editingNameId && nameInputRef.current) { nameInputRef.current.focus?.(); nameInputRef.current.select?.(); } }, [editingNameId]);
    useEffect(() => { if (addingRole && keyTargetInputRef.current) { keyTargetInputRef.current.focus?.(); } }, [addingRole]);

    const kwByRole = useMemo(() => {
      const map = {};
      KW_ROLE_ORDER.forEach(r => { map[r] = []; });
      keywords.forEach(kw => {
        const role = kw.role || '辅4';
        if (!map[role]) map[role] = [];
        map[role].push(kw);
      });
      return map;
    }, [keywords]);

    const saveName = async (id) => {
      const trimmed = (nameValue || '').trim();
      if (!trimmed) { ctx.message.warning('关键词名称不能为空'); return; }
      try {
        setSaving(true);
        await ctx.request({ url: 'new_eval_words:update', method: 'post',
          params: { filterByTk: id }, data: { keyword_name: trimmed } });
        setKeywords(prev => prev.map(kw => kw.id === id ? { ...kw, keyword_name: trimmed } : kw));
        setEditingNameId(null); setNameValue('');
        ctx.message.success('名称已更新');
        onRefresh?.();
      } catch (err) { ctx.message.error(`保存失败：${err?.message || ''}`); }
      finally { setSaving(false); }
    };

    const saveKeyTarget = async (id, value) => {
      try {
        setSaving(true);
        await ctx.request({
          url: 'new_eval_words:update', method: 'post',
          params: { filterByTk: id }, data: { key_target: value || null },
        });
        setKeywords(prev => prev.map(kw => kw.id === id ? { ...kw, key_target: value || null } : kw));
        onRefresh?.();
      } catch (err) { ctx.message.error(`保存目标失败：${err?.message || ''}`); }
      finally { setSaving(false); }
    };

    const handleAdd = async (role) => {
      const trimmed = (newName || '').trim();
      if (!trimmed) { ctx.message.warning('请输入关键词名称'); return; }
      if (!countryAsin) { ctx.message.warning('请先选择 Country 和 ASIN'); return; }
      if ((kwByRole[role] || []).length >= 1) { ctx.message.warning(`「${role}」已有关键词，每个角色只能一个`); return; }
      try {
        setSaving(true);
        const keyTargetVal = keyTargetValue ? keyTargetValue.trim() : null;
        await ctx.request({ url: 'new_eval_words:create', method: 'post',
          data: withCreateTimestamps({ keyword_name: trimmed, role, country_asin: countryAsin, key_target: keyTargetVal }) });

        ctx.message.success('添加成功');
        setAddingRole(null); setNewName(''); setKeyTargetValue('');
        await load();
        onRefresh?.();
      } catch (err) { ctx.message.error(`添加失败：${err?.message || ''}`); }
      finally { setSaving(false); }
    };

    const handleDelete = async (id) => {
      try {
        setSaving(true);
        const allDaily = [];
        const filter = JSON.stringify({ eval_word_id: { $eq: id } });
        const pageSize = 200;
        for (let page = 1; page <= 10000; page += 1) {
          const allDailyRes = await ctx.request({
            url: 'new_eval_words_daily:list',
            method: 'get',
            params: { filter, page, pageSize },
          });
          const batch = Array.isArray(allDailyRes?.data?.data) ? allDailyRes.data.data : [];
          allDaily.push(...batch);
          const totalPage = Number(allDailyRes?.data?.meta?.totalPage);
          if (batch.length < pageSize || (Number.isFinite(totalPage) && page >= totalPage)) break;
        }
        await Promise.all(allDaily.map(d =>
          ctx.request({ url: 'new_eval_words_daily:destroy', method: 'post', params: { filterByTk: d.id } })
        ));
        await ctx.request({ url: 'new_eval_words:destroy', method: 'post', params: { filterByTk: id } });

        ctx.message.success(`删除成功（同时清理 ${allDaily.length} 条日数据）`);
        setKeywords(prev => prev.filter(kw => kw.id !== id));
        onRefresh?.();
      } catch (err) {
        ctx.message.error(`删除失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const COL_WIDTH = 320;

    const body = React.createElement(React.Fragment, null,
      hasContext
        ? React.createElement('div', {
                        style: { marginBottom: '14px', padding: '12px', background: '#f0f7ff', border: '1px solid #91caff', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center' }
          },
            React.createElement('span', { style: { fontWeight: 600, color: '#1677ff' } }, '📦 当前产品：'),
            React.createElement('span', { style: { fontWeight: 700, fontSize: '15px', color: '#333' } }, `${propCountry} · ${propAsin}`),
            React.createElement('span', { style: { marginLeft: 'auto', color: '#666', fontSize: '13px' } },
              `共 ${keywords.length} 个关键词 · 直接在下方添加即可`
            ),
          )
        : React.createElement('div', {
            style: { marginBottom: '14px', padding: '12px', background: '#f0f7ff', border: '1px solid #91caff', borderRadius: '6px', display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }
          },
            React.createElement('span', { style: { fontWeight: 600, color: '#1677ff' } }, '🎯 选择产品：'),
            React.createElement(Select, {
              placeholder: '选择 Country', value: country || undefined, options: countryOpts,
              onChange: (v) => { setCountry(v); setAsin(null); },
              style: { minWidth: '140px' }, showSearch: true, allowClear: true,
            }),
            React.createElement(Select, {
              placeholder: '选择 ASIN', value: asin || undefined, options: asinOpts, disabled: !country,
              onChange: (v) => setAsin(v),
              style: { minWidth: '180px' }, showSearch: true, allowClear: true,
            }),
            countryAsin && React.createElement('span', { style: { marginLeft: 'auto', color: '#666', fontSize: '13px' } },
              `当前：${countryAsin} · 共 ${keywords.length} 个关键词`
            ),
          ),

      !countryAsin
        ? React.createElement('div', { style: { padding: '60px', textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: '8px' } },
            '👆 请先选择 Country 和 ASIN'
          )
        : React.createElement('div', { style: { overflowX: 'auto', paddingBottom: '8px' } },
            React.createElement('div', { style: { display: 'flex', minWidth: `${COL_WIDTH * KW_ROLE_ORDER.length}px` } },
              KW_ROLE_ORDER.map(role => {
                const colors   = KW_ROLE_COLORS[role];
                const roleKws  = kwByRole[role] || [];
                const isAdding = addingRole === role;

                return React.createElement('div', {
                  key: role,
                  style: { width: `${COL_WIDTH}px`, minWidth: `${COL_WIDTH}px`, borderRight: '1px solid #e8e8e8', display: 'flex', flexDirection: 'column' }
                },
                  React.createElement('div', {
                    style: {
                    background: colors.header,
                    color: colors.headerText || '#fff',
                    padding: '10px 12px',
                    fontWeight: 700,
                    fontSize: '15px',
                    textAlign: 'center',
                    borderBottom: `1px solid ${colors.border || colors.header}`,
                  }},
                    `${ROLE_SLOT_LABEL[role] || role} (${role})`,
                    React.createElement('span', { style: { marginLeft: '6px', fontSize: '12px', fontWeight: 400, opacity: 0.85 } }, `${roleKws.length}个`)
                  ),

                  React.createElement('div', { style: { flex: 1, padding: '10px', background: colors.bg, minHeight: '120px' } },
                    roleKws.length === 0
                      ? React.createElement('div', { style: {color: '#999',fontSize: '13px',textAlign: 'center', padding: '24px 0',fontWeight: 500,} }, '暂无关键词')
                      : roleKws.map((kw) => {
                          const isEditingName = editingNameId === kw.id;
                          return React.createElement('div', {
                            key: kw.id,
                            style: {
                            padding: '12px',
                            marginBottom: '10px',
                            background: colors.cardBg || '#fff',
                            borderRadius: '6px',
                            border: `1px solid ${colors.border || colors.header}`,
                            boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
                          }
                          },
                            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' } },
                              isEditingName
                                ? React.createElement(Input, {
                                    ref: nameInputRef, value: nameValue, style: { flex: 1 },
                                    onChange: e => setNameValue(e.target.value),
                                    onPressEnter: () => saveName(kw.id),
                                    onBlur: () => saveName(kw.id),
                                    onKeyDown: e => { if (e.key === 'Escape') { setEditingNameId(null); setNameValue(''); } },
                                  })
                                : React.createElement('span', {
                                    onDoubleClick: () => { setEditingNameId(kw.id); setNameValue(kw.keyword_name || ''); },
                                    style: { flex: 1, fontSize: '16px', fontWeight: 700, color: colors.text, cursor: 'cell', wordBreak: 'break-all' }
                                  }, kw.keyword_name || '(未命名)'),
                              !isEditingName && React.createElement(Popconfirm, {
                                title: `确定删除「${kw.keyword_name || '该关键词'}」？会同时清理所有日期的数据。`,
                                onConfirm: () => handleDelete(kw.id), okText: '确定', cancelText: '取消',
                              },
                                React.createElement('span', { style: { fontSize: '14px', color: '#ff4d4f', cursor: 'pointer' }, title: '删除' }, '✕')
                              )
                            ),
                            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
                              React.createElement('span', { style: { fontSize: '12px', color: '#888' } }, '🎯 目标'),
                              React.createElement(Input, {
                                value: kw.key_target || '', placeholder: '填写目标...', size: 'small',
                                onChange: (e) => saveKeyTarget(kw.id, e.target.value),
                                style: { flex: 1 },
                              })
                            )
                          );
                        })
                  ),

                  React.createElement('div', { style: { padding: '8px', borderTop: `1px solid ${colors.header}20`, background: colors.bg } },
                    isAdding
                      ? React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
                          React.createElement(Input, {
                            value: newName, placeholder: '输入关键词...', style: { flex: 1 },
                            onChange: e => setNewName(e.target.value),
                            autoFocus: true, ref: nameInputRef,
                            onKeyDown: e => { if (e.key === 'Escape') { setAddingRole(null); setNewName(''); setKeyTargetValue(''); } },
                          }),
                          React.createElement(Input, {
                            value: keyTargetValue, placeholder: '填写目标...', style: { flex: 1 },
                            onChange: e => setKeyTargetValue(e.target.value),
                            ref: keyTargetInputRef,
                            onKeyDown: e => { if (e.key === 'Escape') { setAddingRole(null); setNewName(''); setKeyTargetValue(''); } },
                          }),
                          React.createElement(Button, { type: 'primary', size: 'small', onClick: () => handleAdd(role), loading: saving }, '✓'),
                          React.createElement(Button, { size: 'small', onClick: () => { setAddingRole(null); setNewName(''); setKeyTargetValue(''); } }, '✕')
                        )
                      : roleKws.length >= 1
                        ? React.createElement('div', { style: { textAlign: 'center', fontSize: '12px', color: '#ccc', padding: '6px 0' } }, '已达上限 (1个)')
                        : React.createElement(Button, {
                            block: true, size: 'small', type: 'dashed',
                            onClick: () => { setAddingRole(role); setNewName(''); setKeyTargetValue(''); },
                            style: {color: colors.text,borderColor: colors.border || colors.header,background: 'rgba(255,255,255,0.72)',fontWeight: 600,},
                          }, '＋ 添加关键词')
                  )
                );
              })
            )
          )
    );

    return React.createElement(Drawer, {
      title: '🔑 关键词管理（按 Country + ASIN 维护主表）',
      placement: 'right', width: '85vw', onClose, open: visible,
      extra: loading
        ? React.createElement('span', { style: { fontSize: '12px', color: '#1890ff' } }, '加载中...')
        : saving
        ? React.createElement('span', { style: { fontSize: '12px', color: '#fa8c16' } }, '保存中...')
        : null,
    }, body);
  };

  const KeywordMasterDrawer = ({ visible, onClose, countryAsinOptions, country: propCountry, asin: propAsin, onRefresh }) => {
    const [country, setCountry] = useState(propCountry || null);
    const [asin, setAsin] = useState(propAsin || null);
    const [keywords, setKeywords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newName, setNewName] = useState('');
    const [newTarget, setNewTarget] = useState('');
    const hasContext = !!(propCountry && propAsin);
    const countryAsin = country && asin ? `${country}_${asin}` : null;

    const countryOpts = useMemo(() => {
      const set = new Set(countryAsinOptions.map((o) => o.country).filter(Boolean));
      return Array.from(set).sort().map((c) => ({ label: c, value: c }));
    }, [countryAsinOptions]);

    const asinOpts = useMemo(() => {
      if (!country) return [];
      const set = new Set(countryAsinOptions.filter((o) => o.country === country).map((o) => o.asin).filter(Boolean));
      return Array.from(set).sort().map((a) => ({ label: a, value: a }));
    }, [countryAsinOptions, country]);

    const roleIndex = useCallback((role) => {
      const idx = KW_ROLE_ORDER.indexOf(role || '');
      return idx >= 0 ? idx : KW_ROLE_ORDER.length;
    }, []);

    const sortedKeywords = useMemo(() => {
      return [...keywords].sort((a, b) => {
        const ai = roleIndex(a.role);
        const bi = roleIndex(b.role);
        if (ai !== bi) return ai - bi;
        return Number(a.id || 0) - Number(b.id || 0);
      });
    }, [keywords, roleIndex]);

    const load = useCallback(async () => {
      if (!countryAsin) {
        setKeywords([]);
        return;
      }
      setLoading(true);
      try {
        const r = await ctx.request({
          url: 'new_eval_words:list',
          method: 'get',
          params: { filter: JSON.stringify({ country_asin: { $eq: countryAsin } }), pageSize: 200 },
        });
        setKeywords(Array.isArray(r?.data?.data) ? r.data.data : []);
      } catch {
        ctx.message.error('加载关键词失败');
      } finally {
        setLoading(false);
      }
    }, [countryAsin]);

    useEffect(() => { if (visible && countryAsin) load(); }, [visible, countryAsin, load]);
    useEffect(() => {
      if (visible) {
        if (propCountry) setCountry(propCountry);
        if (propAsin) setAsin(propAsin);
      } else {
        setKeywords([]);
        setNewName('');
        setNewTarget('');
        if (!propCountry) setCountry(null);
        if (!propAsin) setAsin(null);
      }
    }, [visible, propCountry, propAsin]);

    const findNextRole = useCallback(() => {
      const used = new Set(keywords.map((kw) => kw.role).filter(Boolean));
      return KW_ROLE_ORDER.find((role) => !used.has(role)) || null;
    }, [keywords]);

    const saveName = async (item, value) => {
      const trimmed = String(value || '').trim();
      const oldValue = String(item?.keyword_name || '').trim();
      if (trimmed === oldValue) return;
      if (!trimmed) {
        ctx.message.warning('关键词名称不能为空');
        return;
      }
      try {
        setSaving(true);
        await ctx.request({
          url: 'new_eval_words:update',
          method: 'post',
          params: { filterByTk: item.id },
          data: { keyword_name: trimmed },
        });
        setKeywords((prev) => prev.map((kw) => (kw.id === item.id ? { ...kw, keyword_name: trimmed } : kw)));
        ctx.message.success('名称已更新');
        onRefresh?.();
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const saveTarget = async (item, value) => {
      const nextValue = String(value || '').trim();
      const oldValue = String(item?.key_target || '').trim();
      if (nextValue === oldValue) return;
      try {
        setSaving(true);
        await ctx.request({
          url: 'new_eval_words:update',
          method: 'post',
          params: { filterByTk: item.id },
          data: { key_target: nextValue || null },
        });
        setKeywords((prev) => prev.map((kw) => (kw.id === item.id ? { ...kw, key_target: nextValue || null } : kw)));
        ctx.message.success('目标已更新');
        onRefresh?.();
      } catch (err) {
        ctx.message.error(`保存目标失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const handleAdd = async () => {
      const trimmed = String(newName || '').trim();
      if (!trimmed) {
        ctx.message.warning('请输入关键词名称');
        return;
      }
      if (!countryAsin) {
        ctx.message.warning('请先选择 Country 和 ASIN');
        return;
      }
      if (keywords.length >= KW_ROLE_ORDER.length) {
        ctx.message.warning(`关键词已达上限，最多 ${KW_ROLE_ORDER.length} 个`);
        return;
      }
      const role = findNextRole();
      if (!role) {
        ctx.message.warning(`关键词已达上限，最多 ${KW_ROLE_ORDER.length} 个`);
        return;
      }
      try {
        setSaving(true);
        const targetValue = String(newTarget || '').trim();
        await ctx.request({
          url: 'new_eval_words:create',
          method: 'post',
          data: withCreateTimestamps({
            keyword_name: trimmed,
            role,
            country_asin: countryAsin,
            key_target: targetValue || null,
          }),
        });
        setNewName('');
        setNewTarget('');
        await load();
        onRefresh?.();
        ctx.message.success('新增成功');
      } catch (err) {
        ctx.message.error(`新增失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const handleDelete = async (item) => {
      try {
        setSaving(true);
        const allDaily = [];
        const filter = JSON.stringify({ eval_word_id: { $eq: item.id } });
        const pageSize = 200;
        for (let page = 1; page <= 10000; page += 1) {
          const allDailyRes = await ctx.request({
            url: 'new_eval_words_daily:list',
            method: 'get',
            params: { filter, page, pageSize },
          });
          const batch = Array.isArray(allDailyRes?.data?.data) ? allDailyRes.data.data : [];
          allDaily.push(...batch);
          const totalPage = Number(allDailyRes?.data?.meta?.totalPage);
          if (batch.length < pageSize || (Number.isFinite(totalPage) && page >= totalPage)) break;
        }
        await Promise.all(allDaily.map((d) =>
          ctx.request({ url: 'new_eval_words_daily:destroy', method: 'post', params: { filterByTk: d.id } })
        ));
        await ctx.request({ url: 'new_eval_words:destroy', method: 'post', params: { filterByTk: item.id } });

        setKeywords((prev) => prev.filter((kw) => kw.id !== item.id));
        onRefresh?.();
        ctx.message.success(`删除成功，已清理 ${allDaily.length} 条日数据`);
      } catch (err) {
        ctx.message.error(`删除失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const selector = !hasContext && React.createElement('div', {
      style: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 8, marginBottom: 12 },
    },
      React.createElement(Select, {
        placeholder: '选择 Country',
        value: country || undefined,
        options: countryOpts,
        onChange: (v) => { setCountry(v); setAsin(null); },
        showSearch: true,
        allowClear: true,
        disabled: saving,
      }),
      React.createElement(Select, {
        placeholder: '选择 ASIN',
        value: asin || undefined,
        options: asinOpts,
        disabled: !country || saving,
        onChange: (v) => setAsin(v),
        showSearch: true,
        allowClear: true,
      })
    );

    return React.createElement(Modal, {
      title: countryAsin ? `管理关键词：${countryAsin}` : '管理关键词',
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 560,
      destroyOnClose: true,
    },
      !countryAsin
        ? React.createElement('div', null,
            selector,
            React.createElement('div', { style: { padding: 24, color: '#999', textAlign: 'center', background: '#fafafa', borderRadius: 6 } },
              '请先选择 Country 和 ASIN'
            )
          )
        : React.createElement('div', null,
            selector,
            React.createElement('div', {
              style: { marginBottom: 12, padding: '10px 12px', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 6, color: '#3f6600', lineHeight: 1.6 },
            },
              '这里管理的是推新板块同一批关键词；在这里新增、修改或删除，推新板块会同步变化。'
            ),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 120px 56px', gap: 8, marginBottom: 10 } },
              React.createElement(Input, {
                value: newName,
                placeholder: '新增关键词',
                onChange: (e) => setNewName(e.target.value),
                onPressEnter: handleAdd,
                disabled: saving || loading,
              }),
              React.createElement(Input, {
                value: newTarget,
                placeholder: '目标',
                onChange: (e) => setNewTarget(e.target.value),
                onPressEnter: handleAdd,
                disabled: saving || loading,
              }),
              React.createElement(Button, { type: 'primary', loading: saving, onClick: handleAdd, disabled: loading }, '新增')
            ),
            loading
              ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#999' } }, '加载中...')
              : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
                  sortedKeywords.length === 0 && React.createElement('div', { style: { padding: 20, color: '#999', textAlign: 'center', background: '#fafafa', borderRadius: 6 } }, '暂无关键词'),
                  sortedKeywords.map((item) => React.createElement('div', {
                    key: item.id,
                    style: { display: 'grid', gridTemplateColumns: '1fr 120px 56px', gap: 8, alignItems: 'center' },
                  },
                    React.createElement(Input, {
                      defaultValue: item.keyword_name || '',
                      disabled: saving,
                      onBlur: (e) => saveName(item, e.target.value),
                      onPressEnter: (e) => e.currentTarget.blur(),
                    }),
                    React.createElement(Input, {
                      defaultValue: item.key_target || '',
                      placeholder: '目标',
                      disabled: saving,
                      onBlur: (e) => saveTarget(item, e.target.value),
                      onPressEnter: (e) => e.currentTarget.blur(),
                    }),
                    React.createElement(Popconfirm, {
                      title: `确定删除「${item.keyword_name || '该关键词'}」？会同时清理所有日期的数据。`,
                      onConfirm: () => handleDelete(item),
                      okText: '确定',
                      cancelText: '取消',
                    },
                      React.createElement(Button, { danger: true, disabled: saving }, '删除')
                    )
                  ))
                )
          )
    );
  };

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
          return { ...group, users };
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
        React.createElement('span', null, '推送默认视图'),
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
                      React.createElement('span', { style: { width: '14px', color: '#64748b', transform: isOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s', display: 'inline-block' } }, '▾'),
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
      React.createElement('div', { style: { marginBottom: '16px', padding: '8px 10px', color: '#555', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' } }, `已选择 ${selectedUserIds.length} 位用户，推送内容为默认视图的全部列配置。`),
      React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
        React.createElement('button', { onClick: onClose, disabled: pushing, style: { padding: '6px 16px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: pushing ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px` } }, '取消'),
        React.createElement('button', { onClick: handlePush, disabled: pushing || loadingUsers || !selectedUserIds.length, style: { padding: '6px 16px', color: '#fff', border: 'none', borderRadius: '4px', fontSize: `${FONT_SIZE}px`, fontWeight: 600, background: (pushing || loadingUsers || !selectedUserIds.length) ? '#b5d8ff' : '#1890ff', cursor: (pushing || loadingUsers || !selectedUserIds.length) ? 'not-allowed' : 'pointer' } }, pushing ? '推送中...' : '确认推送'),
      ),
    );
  };

  const RECALC_CALCULATORS = {
    keyword_tracking: async (ctx, countryAsinDate) => {
      const ktRes = await ctx.request({
        url: 'daily_keyword_tracking:list', method: 'get',
        params: { filter: JSON.stringify({ country_asin_date: { $eq: countryAsinDate } }), pageSize: 1 }
      });
      const kt = ktRes?.data?.data?.[0];
      if (!kt) return { updates: {}, log: '[跳过] 未找到 keyword_tracking 记录' };

      const dailyAsinRes = await ctx.request({
        url: 'daily_asins:list', method: 'get',
        params: { filter: JSON.stringify({ country_asin_date: { $eq: countryAsinDate } }), pageSize: 1 }
      });
      const dailyAsin = dailyAsinRes?.data?.data?.[0] || {};

      const dailyRes = await ctx.request({
        url: 'new_eval_words_daily:list', method: 'get',
        params: { filter: JSON.stringify({ country_asin_date: { $eq: countryAsinDate } }), pageSize: 500 }
      });
      const dailyRows = dailyRes?.data?.data || [];
      const estReviewTotal = dailyRows.reduce((s, k) => s + (Number(k.est_review_qty) || 0), 0);
      const actualTotal    = Number(dailyAsin.rsg_number) || 0;

      const wpRes = await ctx.request({
        url: 'weekly_performance:list', method: 'get',
        params: { filter: JSON.stringify({ country_asin_week: { $eq: countryAsinDate } }), pageSize: 1 }
      });
      const wp = wpRes?.data?.data?.[0];

      const weeklySales = Number(wp?.sales) || 0;
      const weeklyAdOrders   = Number(wp?.guanggaodan) || 0;

      // 实际自然单 = 实际总单量 - daily_asins.rsg_number - 实际广告单
      const actualNaturalOrder = weeklySales - actualTotal - weeklyAdOrders;

      // ③站内:纯自然+广告单 = weekly_performance.sales - daily_asins.rsg_number
      const totalOnsiteOrders = weeklySales - actualTotal;
      // ④站内纯自然单 = total_onsite_orders - weekly_performance.guanggaodan
      const onsiteOrganicOrders = totalOnsiteOrders - weeklyAdOrders;

      const estTraffic         = Number(kt.est_traffic)   || 0;
      const targetCvrForDemand = Number(kt.target_cvr)    || 0;
      const estNatOrder        = Number(kt.est_nat_order) || 0;
      const dailyEvalDemand = Math.ceil(estTraffic * targetCvrForDemand - estNatOrder);



      let planEvalJudgment;
      if (dailyEvalDemand === 0) planEvalJudgment = '无计划';
      else if (dailyEvalDemand - estReviewTotal > 0) planEvalJudgment = `计划测评缺-${dailyEvalDemand - estReviewTotal}单`;
      else if (dailyEvalDemand - estReviewTotal < 0) planEvalJudgment = `计划测评超+${Math.abs(dailyEvalDemand - estReviewTotal)}单`;
      else planEvalJudgment = '√';

      let actualEvalJudgment;
      if (estReviewTotal === 0 && actualTotal === 0) actualEvalJudgment = '无计划';
      else if (estReviewTotal === 0 && actualTotal > 0) actualEvalJudgment = `无计划但测${actualTotal}单`;
      else if (actualTotal > estReviewTotal) actualEvalJudgment = `测评超+${actualTotal - estReviewTotal}单`;
      else if (actualTotal < estReviewTotal) actualEvalJudgment = `测评缺-${estReviewTotal - actualTotal}单`;
      else actualEvalJudgment = '√';

    let actualCvrJudgment = '';
    const isBlank = (v) => v === null || v === undefined || v === '';
    if (wp && !isBlank(wp.session_conversion_rate) && !isBlank(kt.target_cvr)) {
      const sessionConversionRate = Number(wp.session_conversion_rate);
      const targetCvrVal = Number(kt.target_cvr);

      if (!Number.isNaN(sessionConversionRate) && !Number.isNaN(targetCvrVal)) {
        const diff = sessionConversionRate - targetCvrVal;

        if (diff > 0) {
          actualCvrJudgment = `CVR满足+${(diff * 100).toFixed(2)}%`;
        } else if (diff < 0) {
          actualCvrJudgment = `CVR不达标-${(Math.abs(diff) * 100).toFixed(2)}%-广告失控？测评不足？`;
        } else {
          actualCvrJudgment = 'CVR持平';
        }
      }
    }


      return {
        updates: {
          est_review_total:        estReviewTotal,
          daily_eval_demand:       dailyEvalDemand,
          actual_natural_order:    actualNaturalOrder,
          plan_eval_judgment:      planEvalJudgment,
          actual_eval_judgment:    actualEvalJudgment,
          actual_cvr_judgment:     actualCvrJudgment,
        },
        dailyUpdates: {},
        orderLinkUpdates: {
          total_onsite_orders: totalOnsiteOrders,
          onsite_organic_orders: onsiteOrganicOrders,
        },
        log: `keywords=${dailyRows.length}, est=${estReviewTotal}, actual=${actualTotal}, actualNatural=${actualNaturalOrder}`
      };
    },
  };

  const MergedTable = () => {
    const [data, setData]                       = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [showPanel, setShowPanel]             = useState(false);
    const [showPush, setShowPush]               = useState(false);
    const [calcAllLoading, setCalcAllLoading]   = useState(false);
    const [calcAllProgress, setCalcAllProgress] = useState('');
    const [refreshingData, setRefreshingData]   = useState(false);
    const [refreshProgress, setRefreshProgress] = useState('');
    const [formulaProgress, setFormulaProgress] = useState({ active: false, label: '', percent: 0 });
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [columnViews, setColumnViews]         = useState([]);
    const [activeColumnViewId, setActiveColumnViewId] = useState(DEFAULT_COLUMN_VIEW_IDS[0]);
    const [columnViewSwitching, setColumnViewSwitching] = useState(false);
    const [columnViewCreating, setColumnViewCreating] = useState(false);
    const [columnViewSaving, setColumnViewSaving] = useState(false);
    const [kwSubFieldHeaderColors, setKwSubFieldHeaderColors] = useState({});
    const [sortConfig, setSortConfig]           = useState({ key: 'daily_date', dir: 'asc' });
    const [curPage, setCurPage]                 = useState(1);
    const [pageSize, setPageSize]               = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal]                     = useState(0);
    const [collapsedGroups, setCollapsedGroups] = useState({ daily: true, weekly: true, keyword_tracking: true, tool: true });
    const [editingCell, setEditingCell]         = useState(null);
    const [editValue, setEditValue]             = useState(null);
    const [richEditOpenSignal, setRichEditOpenSignal] = useState(null);
    const [saving, setSaving]                   = useState(false);
    const [isResizing, setIsResizing]           = useState(false);
    const [dateFilterType, setDateFilterType]   = useState('recent_future');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [kwMasterVisible, setKwMasterVisible] = useState(false);
    const [showKwOptionalFields, setShowKwOptionalFields] = useState(false);
    const [selectedRange, setSelectedRange] = useState(null);
    const [activeCell, setActiveCell] = useState(null);
    const [crossHighlightEnabled, setCrossHighlightEnabled] = useState(false);
    const [crossHighlightColor, setCrossHighlightColor] = useState(DEFAULT_ACTIVE_CROSS_HIGHLIGHT_COLOR);
    const [showCrossHighlightPanel, setShowCrossHighlightPanel] = useState(false);
    const [colorLegendExpanded, setColorLegendExpanded] = useState(false);
    const selectingRef = useRef(false);

    const getTextColorForBg = (hexColor) => {
      if (!hexColor || hexColor.length < 7) return '#333';
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#222' : '#fff';
    };

    const [dynamicKwCols, setDynamicKwCols] = useState([]);
    const [kwColOrder, setKwColOrder] = useState([]);
    const activeViewPayloadRef = useRef([]);

    const expandBaseColumnsByHeader = useCallback((cols) => {
      let changed = false;

      const next = cols.map((col) => {
        if (!col || col.src === 'tool') return col;

        const formulaTooltip = FORMULA_TOOLTIPS[col.field];
        const hasFormulaIcon = !!formulaTooltip;
        const hasSortIcon = true;

        const extra =
          34 +
          (hasFormulaIcon ? 24 : 0) +
          (hasSortIcon ? 18 : 0);

        const targetWidth = calcHeaderAutoWidth(col.label, {
          fontSize: FONT_SIZE_SM,
          fontWeight: 600,
          extra,
          min: col.width || 60,
          max: 420,
        });

        if (targetWidth > Number(col.width || 0)) {
          changed = true;
          return {
            ...col,
            width: targetWidth,
          };
        }

        return col;
      });

      return changed ? next : cols;
    }, []);



    // 动态词列：宽度改为 6 字段总宽
    const buildDynamicKwCols = useCallback((kwRecords) => {
      if (!kwRecords || !kwRecords.length) return [];

      const roleOrder = { '主推': 1, '辅1': 2, '辅2': 3, '辅3': 4, '辅4': 5 };
      const sorted = [...kwRecords].sort((a, b) => {
        const orderA = roleOrder[a.role] || 99;
        const orderB = roleOrder[b.role] || 99;
        return orderA - orderB;
      });

      return sorted.map((kw) => {
        const roleLabel = ROLE_SLOT_LABEL[kw.role] || kw.role;
        const targetPart = kw.key_target ? ` 目标${kw.key_target}` : '';
        const label = `${kw.keyword_name || '未命名'}（${roleLabel}）${targetPart}`;

        return {
          key: `kw_dynamic_${kw.id}`,
          src: 'keyword_tracking',
          field: `kw_dynamic_${kw.id}`,
          label: label,
          hidden: false,
          pinned: false,
          width: calcKeywordHeaderAutoWidth(label, showKwOptionalFields),
          editable: false,
          headerColor: KW_ROLE_COLORS[kw.role]?.header || '#b5796a',
          _kwId: kw.id,
          _kwName: kw.keyword_name || '未命名',
          _kwRole: kw.role,
          _isKwColumn: true, // 标识为关键词列，需要二级表头
        };
      });
    }, [showKwOptionalFields]);

    useEffect(() => {
      const minWidth = getKwMinWidth(showKwOptionalFields);

      setDynamicKwCols((prev) =>
        prev.map((c) => ({
          ...c,
          width: showKwOptionalFields
            ? getSafeKwColWidth(c.width, showKwOptionalFields)
            : Math.min(Number(c.width) || minWidth, minWidth),
        }))
      );
    }, [showKwOptionalFields]);


    const allColumns = useMemo(() => {
      const baseCols = columns.filter(c =>
        !['kw_1', 'kw_2', 'kw_3', 'kw_4', 'kw_6'].includes(c.field) &&
        !(c.field && c.field.startsWith('kw_dynamic_'))
      );

      let orderedKwCols = dynamicKwCols.map((col) => ({
        ...col,
        width: getSafeKwColWidth(col.width, showKwOptionalFields),
      }));
      if (kwColOrder.length > 0) {
        const orderMap = {};
        kwColOrder.forEach((key, idx) => { orderMap[key] = idx; });
        orderedKwCols.sort((a, b) => {
          const idxA = orderMap[a.key] ?? 9999;
          const idxB = orderMap[b.key] ?? 9999;
          return idxA - idxB;
        });
      }

      const insertAfterIndex = baseCols.findIndex(c => c.key === 'weekly_order_items');

      if (insertAfterIndex >= 0) {
        const before = baseCols.slice(0, insertAfterIndex + 1);
        const after = baseCols.slice(insertAfterIndex + 1);
        return [...before, ...orderedKwCols, ...after];
      }

      return [...baseCols, ...orderedKwCols];
    }, [columns, dynamicKwCols, kwColOrder, showKwOptionalFields]);

    const countryAsinOptions = useMemo(() => {
      const seen = new Set();
      const list = [];
      data.forEach(r => {
        if (!r.country || !r.asin) return;
        const key = `${r.country}_${r.asin}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push({ country: r.country, asin: r.asin });
      });
      return list;
    }, [data]);

    const kwMasterBtnVisible = useMemo(() => {
      const c = allColumns.find(c => c.key === 'tool_kw_master');
      return c && !c.hidden;
    }, [allColumns]);

    const resizeRef   = useRef(null);
    const dragColKey  = useRef(null);
    const inputRef    = useRef(null);
    const rootRef     = useRef(null);
    const tableWrapRef = useRef(null);
    const clipboardRef = useRef(null);
    const autoRefreshRef = useRef({ lastAt: 0, wasVisible: null });
    const formulaProgressFinishTimerRef = useRef(null);
    const backgroundPushSummaryRef = useRef({ timer: null, running: false, pendingForce: false });
    const currentPagePushSummaryRef = useRef({ timer: null, running: false, pendingRowsByKey: {} });
    const panelBtnRef = useRef(null);
    const pushBtnRef  = useRef(null);
    const crossHighlightBtnRef = useRef(null);
    const columnViewSwitchSeqRef = useRef(0);
    const columnLayoutSaveTimerRef = useRef(null);
    const pendingColumnLayoutViewIdRef = useRef(null);
    const columnViewsRef = useRef([]);
    const activeColumnViewIdRef = useRef(DEFAULT_COLUMN_VIEW_IDS[0]);
    const panelPos    = useFloatPos(panelBtnRef, showPanel);
    const pushPos     = useFloatPos(pushBtnRef, showPush);
    const crossHighlightPos = useFloatPos(crossHighlightBtnRef, showCrossHighlightPanel);

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

    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: !prev[src] })); }, []);

    const applyColumnPayloadToLocal = useCallback((payload) => {
      activeViewPayloadRef.current = Array.isArray(payload) ? payload : [];
      setColumns(mergeColumnsWithInitial(payload));
    }, []);

    const applyColumnViewToLocal = useCallback((view) => {
      const payload = Array.isArray(view?.payload) && view.payload.length ? view.payload : null;
      applyColumnPayloadToLocal(payload);
      setKwSubFieldHeaderColors(normalizeKwSubFieldHeaderColors(view?.kwSubFieldHeaderColors));
    }, [applyColumnPayloadToLocal]);

    const setColumnViewsLocal = useCallback((views) => {
      const nextViews = Array.isArray(views) ? views : [];
      columnViewsRef.current = nextViews;
      setColumnViews(nextViews);
    }, []);

    const setActiveColumnViewLocal = useCallback((viewId) => {
      const nextViewId = normalizeColumnViewId(viewId);
      activeColumnViewIdRef.current = nextViewId;
      setActiveColumnViewId(nextViewId);
      saveActiveColumnViewToUser(nextViewId).catch(() => {});
    }, []);

    useEffect(() => {
      (async () => {
        const state = await loadColumnViewStateFromUser();
        setColumnViewsLocal(state.views);
        setActiveColumnViewLocal(state.activeViewId);
        const activeView = state.views.find((view) => view.id === state.activeViewId) || state.views[0];
        applyColumnViewToLocal(activeView || { payload: getColumnViewPayload(state, state.activeViewId), kwSubFieldHeaderColors: {} });
      })();
    }, [applyColumnViewToLocal, setActiveColumnViewLocal, setColumnViewsLocal]);

    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);

    const canModifyColumnView = useCallback((viewIdArg = null) => {
      const viewId = normalizeColumnViewId(viewIdArg || activeColumnViewIdRef.current || activeColumnViewId);
      return IS_ADMIN || !isDefaultColumnViewId(viewId);
    }, [activeColumnViewId]);

    const warnReadonlyDefaultView = useCallback(() => {
      ctx.message.warning('默认视图不能直接改名或自动覆盖，请使用复制并保存创建自定义视图');
    }, []);

    const markColumnLayoutChanged = useCallback(() => {
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (isDefaultColumnViewId(viewId)) return;
      pendingColumnLayoutViewIdRef.current = viewId;
    }, [activeColumnViewId]);

    const saveColsToCurrentViewFast = useCallback(async (cols, viewIdArg = null) => {
      if (!currentUserId) return false;
      const viewId = normalizeColumnViewId(viewIdArg || activeColumnViewIdRef.current || activeColumnViewId);
      if (!canModifyColumnView(viewId)) throw new Error('默认视图不能直接覆盖，请使用复制并保存创建自定义视图');
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const currentView = views.find((view) => view.id === viewId);
      const existingSaved = Array.isArray(currentView?.payload) ? currentView.payload : [];
      const incomingKeys = new Set((Array.isArray(cols) ? cols : []).map((c) => c.key).filter(Boolean));
      const preserved = existingSaved.filter((c) => c?.key && !incomingKeys.has(c.key));
      const colPayload = buildColumnPayload(Array.isArray(cols) ? cols : [], preserved);
      const nextViews = views.map((view) => view.id === viewId ? { ...view, payload: colPayload, updated_at: new Date().toISOString() } : view);
      setColumnViewsLocal(nextViews);
      const saved = await saveColumnViewStateToUser({ activeViewId: viewId, views: nextViews }, viewId);
      if (!saved) throw new Error('用户配置未保存');
      return true;
    }, [activeColumnViewId, canModifyColumnView, columnViews, setColumnViewsLocal]);

    const syncDynamicKwColumnConfig = useCallback((key, patch) => {
      if (!String(key || '').startsWith('kw_dynamic_')) return;
      markColumnLayoutChanged();

      let fallbackCol = null;
      setDynamicKwCols((prev) => {
        fallbackCol = prev.find((c) => c.key === key) || null;
        return prev.map((c) => c.key === key ? { ...c, ...patch } : c);
      });

      const fallback = fallbackCol || dynamicKwCols.find((c) => c.key === key) || {};
      activeViewPayloadRef.current = patchColumnPayloadEntry(
        activeViewPayloadRef.current,
        key,
        patch,
        fallback
      );

      const viewId = activeColumnViewIdRef.current || activeColumnViewId;
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      if (!views.length) return;

      const nextViews = views.map((view) => {
        if (view.id !== viewId) return view;
        return {
          ...view,
          payload: patchColumnPayloadEntry(view.payload, key, patch, fallback),
          updated_at: new Date().toISOString(),
        };
      });
      setColumnViewsLocal(nextViews);
    }, [activeColumnViewId, columnViews, dynamicKwCols, markColumnLayoutChanged, setColumnViewsLocal]);

    const getCurrentColumnPayload = useCallback(() => {
      const currentKwWidthMap = Object.fromEntries(
        allColumns
          .filter((c) => String(c?.key || '').startsWith('kw_dynamic_'))
          .map((c) => [c.key, c.width])
      );
      const dynamicPayload = (Array.isArray(activeViewPayloadRef.current) ? activeViewPayloadRef.current : [])
        .filter((c) => String(c?.key || '').startsWith('kw_dynamic_'))
        .map((c) => ({
          ...c,
          width: getSafeKwColWidth(currentKwWidthMap[c.key] || c.width, showKwOptionalFields),
        }));
      const payload = mergeColumnPayloadEntries(buildColumnPayload(allColumns), dynamicPayload);
      const dynamicDebug = payload
        .filter((c) => String(c?.key || '').startsWith('kw_dynamic_'))
        .map((c) => ({ key: c.key, width: c.width, hidden: c.hidden, pinned: c.pinned, headerColor: c.headerColor, bodyColor: c.bodyColor }));
      console.log('[推新板块视图保存] dynamic keyword payload', dynamicDebug);
      return payload;
    }, [allColumns, showKwOptionalFields]);

    const saveCurrentCustomColumnView = useCallback(async () => {
      if (!currentUserId) return false;
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (isDefaultColumnViewId(viewId)) return false;
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const currentView = views.find((view) => view.id === viewId);
      if (!currentView) return false;
      const payload = getCurrentColumnPayload();
      activeViewPayloadRef.current = payload;
      const nextViews = views.map((view) => view.id === viewId ? {
        ...view,
        payload,
        kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(kwSubFieldHeaderColors),
        updated_at: new Date().toISOString(),
      } : view);
      setColumnViewsLocal(nextViews);
      const saved = await saveColumnViewStateToUser({ activeViewId: viewId, views: nextViews }, viewId);
      if (!saved) throw new Error('用户配置未保存');
      return true;
    }, [activeColumnViewId, columnViews, getCurrentColumnPayload, kwSubFieldHeaderColors, setColumnViewsLocal]);

    const saveCurrentDefaultColumnView = useCallback(async () => {
      if (!IS_ADMIN) return;
      if (columnViewSaving || columnViewSwitching) return;
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (!isDefaultColumnViewId(viewId)) {
        ctx.message.warning('只有默认视图可以保存为默认配置');
        return;
      }
      setColumnViewSaving(true);
      try {
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const payload = getCurrentColumnPayload();
        activeViewPayloadRef.current = payload;
        const defaultView = {
          id: DEFAULT_COLUMN_VIEW_IDS[0],
          name: DEFAULT_COLUMN_VIEW_LABELS.default_1,
          type: 'default',
          payload,
          kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(kwSubFieldHeaderColors),
          updated_at: new Date().toISOString(),
        };
        const saved = await saveDefaultColumnViewToCurrentUser(defaultView);
        if (!saved) throw new Error('默认视图配置未保存');
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(defaultView.payload);
        const nextViews = syncHeaderColorsIntoColumnViews(
          views.map((view) => view.id === viewId ? { ...view, ...defaultView } : view),
          sourceHeaderColorMap,
          defaultView.kwSubFieldHeaderColors,
          defaultView.updated_at
        );
        setColumnViewsLocal(nextViews);
        ctx.message.success('默认视图已保存');
      } catch (err) {
        ctx.message.error(`保存默认视图失败：${err?.message || '未知错误'}`);
      } finally {
        setColumnViewSaving(false);
      }
    }, [activeColumnViewId, columnViewSaving, columnViewSwitching, columnViews, getCurrentColumnPayload, kwSubFieldHeaderColors, setColumnViewsLocal]);

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

    const updateAndSave = useCallback((updater) => {
      markColumnLayoutChanged();
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        return next;
      });
    }, [markColumnLayoutChanged]);

    const saveCurrentAsDefaultColumns = useCallback(async (targetUserIds = null) => {
      if (!IS_ADMIN) return;
      try {
        const now = new Date().toISOString();
        const payload = getCurrentColumnPayload();
        activeViewPayloadRef.current = payload;
        const defaultView = {
          id: DEFAULT_COLUMN_VIEW_IDS[0],
          name: DEFAULT_COLUMN_VIEW_LABELS.default_1,
          type: 'default',
          payload,
          kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(kwSubFieldHeaderColors),
          updated_at: now,
        };
        await saveDefaultColumnViewToCurrentUser(defaultView);
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(defaultView.payload);
        setColumnViewsLocal(syncHeaderColorsIntoColumnViews(
          views.map((view) => isDefaultColumnViewId(view?.id) ? { ...view, ...defaultView } : view),
          sourceHeaderColorMap,
          defaultView.kwSubFieldHeaderColors,
          now
        ));
        const result = await saveDefaultColumnViewToUsers(defaultView, targetUserIds);
        if (result.ok) {
          ctx.message.success(`已同步默认视图、自定义视图列头颜色和重要指标标记给 ${result.total} 位用户`);
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
    }, [columnViews, getCurrentColumnPayload, kwSubFieldHeaderColors, setColumnViewsLocal]);

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
        setActiveColumnViewLocal(nextViewId);
        applyColumnViewToLocal(view);
      } catch (err) {
        ctx.message.error(`切换视图失败：${err?.message || '未知错误'}`);
      } finally {
        if (seq === columnViewSwitchSeqRef.current) setColumnViewSwitching(false);
      }
    }, [activeColumnViewId, applyColumnViewToLocal, columnViewSwitching, columnViews, saveCurrentCustomColumnView, setActiveColumnViewLocal]);

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
      const currentView = views.find((view) => view.id === currentViewId);
      let draftName = getViewLabel(currentView);
      Modal.confirm({
        title: '重命名视图',
        okText: '保存',
        cancelText: '取消',
        content: React.createElement(Input, {
          defaultValue: draftName,
          autoFocus: true,
          maxLength: 20,
          onChange: (e) => { draftName = e.target.value; },
          onPressEnter: (e) => { draftName = e.currentTarget.value; },
        }),
        onOk: async () => {
          const name = String(draftName || '').trim();
          if (!name) throw new Error('请输入视图名称');
          try {
            setColumnViewSaving(true);
            const nextViews = views.map((view) => view.id === currentViewId ? { ...view, name, updated_at: new Date().toISOString() } : view);
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
        const nameBase = String(rawName || '').trim();
        if (!nameBase) {
          ctx.message.warning('请先输入视图名称');
          return false;
        }
        setColumnViewCreating(true);
        try {
        const now = new Date().toISOString();
        const id = `custom_${Date.now()}`;
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const usedNames = new Set(views.map((view) => getViewLabel(view)));
        let name = nameBase;
        let idx = 2;
        while (usedNames.has(name)) {
          name = `${nameBase}${idx}`;
          idx += 1;
        }
        const nextView = { id, name, type: 'custom', payload: getCurrentColumnPayload(), kwSubFieldHeaderColors: normalizeKwSubFieldHeaderColors(kwSubFieldHeaderColors), updated_at: now };
        const nextViews = [...views, nextView];
        const saved = await saveColumnViewStateToUser({ activeViewId: id, views: nextViews }, id);
        if (!saved) throw new Error('用户配置未保存');
        columnViewSwitchSeqRef.current += 1;
        setColumnViewsLocal(nextViews);
        setActiveColumnViewLocal(id);
        applyColumnViewToLocal(nextView);
        ctx.message.success(`视图「${name}」已创建`);
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
      let draftName = '';
      Modal.confirm({
        title: '复制并保存视图',
        okText: '复制并保存',
        cancelText: '取消',
        content: React.createElement(Input, {
          autoFocus: true,
          maxLength: 20,
          placeholder: '请输入视图名称',
          onChange: (e) => { draftName = e.target.value; },
          onPressEnter: (e) => { draftName = e.currentTarget.value; },
        }),
        onOk: async () => {
          const created = await doCreate(draftName);
          if (!created) return Promise.reject(new Error('视图未创建'));
        },
      });
    }, [applyColumnViewToLocal, columnViewCreating, columnViewSwitching, columnViews, getCurrentColumnPayload, kwSubFieldHeaderColors, setActiveColumnViewLocal, setColumnViewsLocal]);

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
            applyColumnPayloadToLocal(nextActiveView?.payload);
            ctx.message.success('视图已删除');
          } catch (err) {
            ctx.message.error(`删除视图失败：${err?.message || '未知错误'}`);
            return Promise.reject(err);
          } finally {
            setColumnViewCreating(false);
          }
        },
      });
    }, [activeColumnViewId, applyColumnPayloadToLocal, columnViewCreating, columnViewSwitching, columnViews, setActiveColumnViewLocal, setColumnViewsLocal]);

    const recalcKeywordTracking = useCallback(async (countryAsinDate) => {
      if (!countryAsinDate) return null;

      try {
        const { updates, dailyUpdates, orderLinkUpdates } = await RECALC_CALCULATORS.keyword_tracking(ctx, countryAsinDate);

        const hasKtUpdates = updates && Object.keys(updates).length > 0;
        const hasDailyUpdates = dailyUpdates && Object.keys(dailyUpdates).length > 0;
        const hasOrderLinkUpdates = orderLinkUpdates && Object.keys(orderLinkUpdates).length > 0;

        if (!hasKtUpdates && !hasDailyUpdates && !hasOrderLinkUpdates) return null;

        if (hasKtUpdates) {
          await ctx.request({
            url: 'daily_keyword_tracking:update',
            method: 'post',
            params: { filterByTk: countryAsinDate },
            data: updates,
          });
        }

        if (hasDailyUpdates) {
          await ctx.request({
            url: 'daily_asins:update',
            method: 'post',
            params: { filterByTk: countryAsinDate },
            data: dailyUpdates,
          });
        }

        if (hasOrderLinkUpdates) {
          const orderLinkFilter = JSON.stringify({ country_asin_date: { $eq: countryAsinDate } });
          const orderLinkRes = await ctx.request({
            url: 'daily_order_link_tracking:list',
            method: 'get',
            params: { filter: orderLinkFilter, pageSize: 1 },
          });
          const existing = orderLinkRes?.data?.data?.[0];
          if (existing) {
            await ctx.request({
              url: 'daily_order_link_tracking:update',
              method: 'post',
              params: { filterByTk: countryAsinDate },
              data: orderLinkUpdates,
            });
          } else {
            const parts = countryAsinDate.split('_');
            await ctx.request({
              url: 'daily_order_link_tracking:create',
              method: 'post',
              data: withCreateTimestamps({
                country_asin_date: countryAsinDate,
                country: parts[0] || null,
                asin: parts[1] || null,
                date: parts[2] || null,
                ...orderLinkUpdates,
              }),
            });
          }
        }

        const mergedUpdates = {
          ...(updates || {}),
          ...(dailyUpdates || {}),
          ...(orderLinkUpdates || {}),
        };

        setData((prev) =>
          prev.map((r) =>
            (r.country_asin_date || r.id) === countryAsinDate
              ? { ...r, ...mergedUpdates }
              : r
          )
        );

        return mergedUpdates;
      } catch (err) {
        ctx.message.error(`自动计算失败：${err?.message || ''}`);
        return null;
      }
    }, []);

    const recalcAllFormulas = useCallback(async (rowsArg = null, options = {}) => {
      const allowNonAdmin = options?.allowNonAdmin === true;
      const silentSuccess = options?.silentSuccess === true;
      const silentLoading = options?.silentLoading === true;
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
      if (!IS_ADMIN && !allowNonAdmin) {
        ctx.message.warning('只有管理员可以执行自动计算');
        return false;
      }
      const sourceRows = Array.isArray(rowsArg) ? rowsArg : data;

      const keys = [
        ...new Set(
          sourceRows
            .map((r) => r.country_asin_date || r.id)
            .filter(Boolean)
        )
      ];

      if (!keys.length) {
        ctx.message.warning('当前没有可计算的数据');
        return false;
      }

      const isBlank = (v) => v === null || v === undefined || v === '';

      const parallelLimit = async (items, limit, worker, onProgress) => {
        let index = 0;
        let done = 0;
        const results = [];

        const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
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
        });

        await Promise.all(runners);
        return results;
      };

      const updateCalcProgress = (label) => {
        if (!silentLoading) setCalcAllProgress(label);
        onProgress?.(label);
      };

      if (!silentLoading) setCalcAllLoading(true);
      updateCalcProgress('准备计算...');

      try {
        updateCalcProgress('正在批量读取数据...');

        const subFilter = JSON.stringify({
          country_asin_date: { $in: keys }
        });

        const weekFilter = JSON.stringify({
          country_asin_week: { $in: keys }
        });
        const caKeys = [...new Set(sourceRows.map((row) => row?.country && row?.asin ? `${row.country}_${row.asin}` : null).filter(Boolean))];
        const caFilter = JSON.stringify({
          country_asin: { $in: caKeys }
        });
        const calcRelatedPageSize = Math.max(keys.length * 50, 100);

        const [rKeywordTracking, rKw, rKwDaily, rWeekly, rOrderLink] = await Promise.all([
          ctx.request({
            url: 'daily_keyword_tracking:list',
            method: 'get',
            params: {
              pageSize: calcRelatedPageSize,
              filter: subFilter
            }
          }),

          ctx.request({
            url: 'new_eval_words:list',
            method: 'get',
            params: {
              pageSize: Math.max(caKeys.length * 10, 100),
              filter: caFilter
            }
          }),

          ctx.request({
            url: 'new_eval_words_daily:list',
            method: 'get',
            params: {
              pageSize: calcRelatedPageSize,
              filter: subFilter
            }
          }),

          ctx.request({
            url: 'weekly_performance:list',
            method: 'get',
            params: {
              pageSize: Math.max(keys.length, 100),
              filter: weekFilter
            }
          }),

          ctx.request({
            url: 'daily_order_link_tracking:list',
            method: 'get',
            params: {
              pageSize: Math.max(keys.length, 100),
              filter: subFilter
            }
          })
        ]);

        const keywordTrackingRecords = Array.isArray(rKeywordTracking?.data?.data)
          ? rKeywordTracking.data.data
          : [];

        const kwRecords = Array.isArray(rKw?.data?.data)
          ? rKw.data.data
          : [];

        let kwDailyRecords = Array.isArray(rKwDaily?.data?.data)
          ? rKwDaily.data.data
          : [];

        const weeklyRecords = Array.isArray(rWeekly?.data?.data)
          ? rWeekly.data.data
          : [];
        const orderLinkRecords = Array.isArray(rOrderLink?.data?.data)
          ? rOrderLink.data.data
          : [];

        const actualReviewSync = await syncKeywordActualReviewQtyFromRefunds(sourceRows, kwRecords, kwDailyRecords);
        kwDailyRecords = actualReviewSync.kwDailyRecords;

        const ktMap = {};
        keywordTrackingRecords.forEach((kt) => {
          if (kt.country_asin_date) {
            ktMap[kt.country_asin_date] = kt;
          }
        });

        const weeklyMap = {};
        weeklyRecords.forEach((w) => {
          if (w.country_asin_week) {
            weeklyMap[w.country_asin_week] = w;
          }
        });

        const orderLinkMap = {};
        orderLinkRecords.forEach((row) => {
          if (row.country_asin_date) {
            orderLinkMap[row.country_asin_date] = row;
          }
        });

        const dailyMap = {};
        sourceRows.forEach((d) => {
          if (d.country_asin_date) {
            dailyMap[d.country_asin_date] = d;
          }
        });

        const kwDailyMap = {};
        kwDailyRecords.forEach((d) => {
          const key = d.country_asin_date;
          if (!key) return;

          if (!kwDailyMap[key]) {
            kwDailyMap[key] = [];
          }

          kwDailyMap[key].push(d);
        });

        updateCalcProgress('正在本地计算公式...');

        const updateJobs = [];
        const patchMap = {};
        const changeDiagnostics = [];

        let skipCount = 0;

        keys.forEach((countryAsinDate) => {
          const kt = ktMap[countryAsinDate];

          if (!kt) {
            skipCount += 1;
            return;
          }

          const dailyRows = kwDailyMap[countryAsinDate] || [];
          const dailyRecord = dailyMap[countryAsinDate] || {};
          const wp = weeklyMap[countryAsinDate];

          const estReviewTotal = dailyRows.reduce(
            (s, k) => s + (Number(k.est_review_qty) || 0),
            0
          );

          const actualTotal = Number(dailyRecord.rsg_number) || 0;

          const weeklySales = Number(wp?.sales) || 0;
          const weeklyAdOrders = Number(wp?.guanggaodan) || 0;

          const actualNaturalOrder = weeklySales - actualTotal - weeklyAdOrders;

          const totalOnsiteOrders = weeklySales - actualTotal;
          const onsiteOrganicOrders = totalOnsiteOrders - weeklyAdOrders;

          const estTraffic = Number(kt.est_traffic) || 0;
          const targetCvrForDemand = Number(kt.target_cvr) || 0;
          const estNatOrder = Number(kt.est_nat_order) || 0;

          const dailyEvalDemand = Math.ceil(
            estTraffic * targetCvrForDemand - estNatOrder
          );

          let planEvalJudgment;

          if (dailyEvalDemand === 0) {
            planEvalJudgment = '无计划';
          } else if (dailyEvalDemand - estReviewTotal > 0) {
            planEvalJudgment = `计划测评缺-${dailyEvalDemand - estReviewTotal}单`;
          } else if (dailyEvalDemand - estReviewTotal < 0) {
            planEvalJudgment = `计划测评超+${Math.abs(dailyEvalDemand - estReviewTotal)}单`;
          } else {
            planEvalJudgment = '√';
          }

          let actualEvalJudgment;

          if (estReviewTotal === 0 && actualTotal === 0) {
            actualEvalJudgment = '无计划';
          } else if (estReviewTotal === 0 && actualTotal > 0) {
            actualEvalJudgment = `无计划但测${actualTotal}单`;
          } else if (actualTotal > estReviewTotal) {
            actualEvalJudgment = `测评超+${actualTotal - estReviewTotal}单`;
          } else if (actualTotal < estReviewTotal) {
            actualEvalJudgment = `测评缺-${estReviewTotal - actualTotal}单`;
          } else {
            actualEvalJudgment = '√';
          }

          let actualCvrJudgment = '';

          if (wp && !isBlank(wp.session_conversion_rate) && !isBlank(kt.target_cvr)) {
            const sessionConversionRate = Number(wp.session_conversion_rate);
            const targetCvrVal = Number(kt.target_cvr);

            if (!Number.isNaN(sessionConversionRate) && !Number.isNaN(targetCvrVal)) {
              const diff = sessionConversionRate - targetCvrVal;

              if (diff > 0) {
                actualCvrJudgment = `CVR满足+${(diff * 100).toFixed(2)}%`;
              } else if (diff < 0) {
                actualCvrJudgment = `CVR不达标-${(Math.abs(diff) * 100).toFixed(2)}%-广告失控？测评不足？`;
              } else {
                actualCvrJudgment = 'CVR持平';
              }
            }
          }

          const ktUpdates = {
            est_review_total: estReviewTotal,
            daily_eval_demand: dailyEvalDemand,
            actual_natural_order: actualNaturalOrder,
            plan_eval_judgment: planEvalJudgment,
            actual_eval_judgment: actualEvalJudgment,
            actual_cvr_judgment: actualCvrJudgment,
          };

          const dailyUpdates = {};

          const orderLinkUpdates = {
            total_onsite_orders: totalOnsiteOrders,
            onsite_organic_orders: onsiteOrganicOrders,
          };

          const changedKtUpdates = pickChangedFields(kt, ktUpdates);
          const changedDailyUpdates = pickChangedFields(dailyRecord, dailyUpdates);
          const changedOrderLinkUpdates = pickChangedFields(orderLinkMap[countryAsinDate] || {}, orderLinkUpdates);

          appendFormulaChangeDiagnostics(changeDiagnostics, {
            key: countryAsinDate,
            sourceName: 'daily_keyword_tracking',
            current: kt,
            changed: changedKtUpdates,
          });
          appendFormulaChangeDiagnostics(changeDiagnostics, {
            key: countryAsinDate,
            sourceName: 'daily_asins',
            current: dailyRecord,
            changed: changedDailyUpdates,
          });
          appendFormulaChangeDiagnostics(changeDiagnostics, {
            key: countryAsinDate,
            sourceName: 'daily_order_link_tracking',
            current: orderLinkMap[countryAsinDate] || {},
            changed: changedOrderLinkUpdates,
          });

          if (
            !Object.keys(changedKtUpdates).length &&
            !Object.keys(changedDailyUpdates).length &&
            !Object.keys(changedOrderLinkUpdates).length
          ) {
            return;
          }

          patchMap[countryAsinDate] = {
            ...changedKtUpdates,
            ...changedDailyUpdates,
            ...changedOrderLinkUpdates,
          };

          updateJobs.push({
            countryAsinDate,
            ktUpdates: changedKtUpdates,
            dailyUpdates: changedDailyUpdates,
            orderLinkUpdates: changedOrderLinkUpdates,
            hasOrderLink: !!orderLinkMap[countryAsinDate],
          });
        });

        if (changeDiagnostics.length && typeof console !== 'undefined') {
          console.groupCollapsed?.(`[推新板块公式写回诊断] 前 ${changeDiagnostics.length} 条差异 / 待写回 ${updateJobs.length} 条`);
          console.table(changeDiagnostics);
          console.groupEnd?.();
        }

        if (!updateJobs.length) {
          if (!silentLoading) setCalcAllProgress('');
          return true;
        }

        updateCalcProgress(`准备写回 ${updateJobs.length} 条记录...`);

        let successCount = 0;
        let failCount = 0;

        const CONCURRENCY = 100;

        await parallelLimit(
          updateJobs,
          CONCURRENCY,
          async (job) => {
            try {
              const writes = [];

              if (job.ktUpdates && Object.keys(job.ktUpdates).length) {
                writes.push(ctx.request({
                  url: 'daily_keyword_tracking:update',
                  method: 'post',
                  params: {
                    filterByTk: job.countryAsinDate
                  },
                  data: job.ktUpdates,
                }));
              }

              writes.push((async () => {
                  if (!job.orderLinkUpdates || !Object.keys(job.orderLinkUpdates).length) return;
                  if (job.hasOrderLink) {
                    await ctx.request({
                      url: 'daily_order_link_tracking:update',
                      method: 'post',
                      params: { filterByTk: job.countryAsinDate },
                      data: job.orderLinkUpdates,
                    });
                  } else {
                    const parts = job.countryAsinDate.split('_');
                    await ctx.request({
                      url: 'daily_order_link_tracking:create',
                      method: 'post',
                      data: withCreateTimestamps({
                        country_asin_date: job.countryAsinDate,
                        country: parts[0] || null,
                        asin: parts[1] || null,
                        date: parts[2] || null,
                        ...job.orderLinkUpdates,
                      }),
                    });
                  }
                })());

              if (job.dailyUpdates && Object.keys(job.dailyUpdates).length) {
                writes.push(ctx.request({
                  url: 'daily_asins:update',
                  method: 'post',
                  params: {
                    filterByTk: job.countryAsinDate
                  },
                  data: job.dailyUpdates,
                }));
              }

              await Promise.all(writes);

              successCount += 1;
              return { ok: true };
            } catch (err) {
              console.error('自动计算写回失败:', job.countryAsinDate, err);
              failCount += 1;
              return { ok: false, err };
            }
          },
          (done, totalCount) => {
            updateCalcProgress(`正在写回 ${done}/${totalCount}...`);
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
            `自动计算完成：成功 ${successCount} 条，失败 ${failCount} 条，跳过 ${skipCount} 条`
          );
        } else if (!silentSuccess) {
          ctx.message.success(
            `自动计算完成：成功 ${successCount} 条，跳过 ${skipCount} 条`
          );
        }
        return failCount === 0;
      } catch (err) {
        console.error(err);
        ctx.message.error(`自动计算失败：${err?.message || '未知错误'}`);
        return false;
      } finally {
        if (!silentLoading) {
          setCalcAllLoading(false);
          setCalcAllProgress('');
        }
      }
    }, [data]);




    const curPageRef  = useRef(curPage);
    const pageSizeRef = useRef(pageSize);
    useEffect(() => { curPageRef.current  = curPage;  }, [curPage]);
    useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);

    const pickTotalFromResponse = (res) => {
      const count = res?.data?.meta?.count;
      return Number.isFinite(Number(count)) ? Number(count) : 0;
    };

    const loadFormulaRowsForCurrentCountryAsin = useCallback(async (silent = false) => {
      if (!filterCountry || !filterAsin) {
        if (!silent) ctx.message.warning('请先筛选到具体国家和 ASIN，再计算推新公式');
        return [];
      }

      const dailyFilterAnd = [
        { country: { $eq: filterCountry } },
        { asin: { $eq: filterAsin } },
      ];
      const pageSize = 500;
      const rows = [];
      let totalCount = null;
      for (let page = 1; page <= 10000; page += 1) {
        const res = await ctx.request({
          url: 'daily_asins:list',
          method: 'get',
          params: {
            sort: 'date',
            page,
            pageSize,
            filter: JSON.stringify({ $and: dailyFilterAnd }),
          },
        });
        const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
        rows.push(...batch);
        const pickedTotal = pickTotalFromResponse(res);
        if (pickedTotal > 0) totalCount = pickedTotal;
        if (!batch.length || batch.length < pageSize || (totalCount != null && rows.length >= totalCount)) break;
      }
      return rows;
    }, [filterAsin, filterCountry]);

    const getDailySort = useCallback(() => {
      if (!sortConfig.key) return 'date';
      const col = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      if (!col || col.src !== 'daily') return 'date';
      return sortConfig.dir === 'desc' ? `-${col.field}` : col.field;
    }, [sortConfig]);

    const shouldShowWeeklySummary = useMemo(() => (
      !sortConfig.key || sortConfig.key === 'daily_date'
    ), [sortConfig]);

    const fetchAllList = useCallback(async (url, params = {}, pageSize = 500) => {
      const rows = [];
      let totalCount = null;
      for (let page = 1; page <= 10000; page += 1) {
        const res = await ctx.request({
          url,
          method: 'get',
          params: {
            ...params,
            page,
            pageSize,
          },
        });
        const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
        rows.push(...batch);
        const pickedTotal = pickTotalFromResponse(res);
        if (pickedTotal > 0) totalCount = pickedTotal;
        if (!batch.length || batch.length < pageSize || (totalCount != null && rows.length >= totalCount)) break;
      }
      return rows;
    }, []);

    const fetchAllByIn = useCallback(async (url, field, values, options = {}) => {
      const uniqueValues = [...new Set((Array.isArray(values) ? values : []).filter(Boolean))];
      if (!uniqueValues.length) return [];
      const chunkSize = Math.max(1, Math.min(Number(options.chunkSize) || 80, 100));
      const pageSize = Math.max(1, Math.min(Number(options.pageSize) || 500, 500));
      const extraAnd = Array.isArray(options.extraAnd) ? options.extraAnd : [];
      const all = [];
      for (let i = 0; i < uniqueValues.length; i += chunkSize) {
        const chunk = uniqueValues.slice(i, i + chunkSize);
        const filterParts = [{ [field]: { $in: chunk } }, ...extraAnd];
        const filter = filterParts.length === 1 ? filterParts[0] : { $and: filterParts };
        const rows = await fetchAllList(url, {
          ...(options.params || {}),
          filter: JSON.stringify(filter),
        }, pageSize);
        all.push(...rows);
      }
      return all;
    }, [fetchAllList]);

    const syncKeywordActualReviewQtyFromRefunds = useCallback(async (dailyRows, kwRecords, kwDailyRecords, options = {}) => {
      const sourceRows = Array.isArray(dailyRows) ? dailyRows.filter(Boolean) : [];
      const keywords = Array.isArray(kwRecords) ? kwRecords.filter(Boolean) : [];
      const existingKwDailyRows = Array.isArray(kwDailyRecords) ? kwDailyRecords.filter(Boolean) : [];
      if (!sourceRows.length || !keywords.length) {
        return { kwDailyRecords: existingKwDailyRows, dailyPatchMap: {}, kwPatchMap: {}, updateCount: 0, failCount: 0 };
      }

      const rowMeta = {};
      const asinCountryToDailyKeys = {};
      const countryAsinToDailyKeys = {};
      const result = {};
      sourceRows.forEach((row) => {
        const rowKey = row?.country_asin_date;
        const dateKey = toDateKey(row?.date);
        const evalAsinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
        const kwCountryAsin = row?.country_asin || (row?.country && row?.asin ? `${row.country}_${row.asin}` : '');
        if (!rowKey || !dateKey || !evalAsinCountry || !kwCountryAsin) return;
        rowMeta[rowKey] = { dateKey, evalAsinCountry, kwCountryAsin };
        if (!asinCountryToDailyKeys[evalAsinCountry]) asinCountryToDailyKeys[evalAsinCountry] = new Set();
        if (!countryAsinToDailyKeys[kwCountryAsin]) countryAsinToDailyKeys[kwCountryAsin] = new Set();
        asinCountryToDailyKeys[evalAsinCountry].add(rowKey);
        countryAsinToDailyKeys[kwCountryAsin].add(rowKey);
      });

      const kwMeta = {};
      const keywordByCountryAsin = {};
      keywords.forEach((kw) => {
        const kwId = kw?.id;
        const countryAsin = kw?.country_asin;
        const keywordName = String(kw?.keyword_name ?? '').trim();
        if (kwId == null || !countryAsin || !keywordName) return;
        kwMeta[kwId] = { countryAsin, keywordName, keywordKey: normalizeSearchText(keywordName) };
        if (!keywordByCountryAsin[countryAsin]) keywordByCountryAsin[countryAsin] = [];
        keywordByCountryAsin[countryAsin].push(kw);
        (countryAsinToDailyKeys[countryAsin] ? [...countryAsinToDailyKeys[countryAsin]] : []).forEach((rowKey) => {
          result[`${rowKey}_${kwId}`] = 0;
        });
      });

      const evalAsinCountries = Object.keys(asinCountryToDailyKeys);
      if (!evalAsinCountries.length) return { kwDailyRecords: existingKwDailyRows, dailyPatchMap: {}, kwPatchMap: {}, updateCount: 0, failCount: 0 };

      const evaluationRows = await fetchAllByIn('evaluation_requirement:list', 'asin_country', evalAsinCountries, {
        chunkSize: 80,
        pageSize: 500,
      });
      const rsgKeyToTargetsByDateAndKeyword = {};
      evaluationRows.forEach((row) => {
        const evalAsinCountry = row?.asin_country;
        const code = String(row?.exclusive_evaluation_code ?? '').trim();
        if (!evalAsinCountry || !code || !asinCountryToDailyKeys[evalAsinCountry]) return;
        if (!rsgKeyToTargetsByDateAndKeyword[code]) rsgKeyToTargetsByDateAndKeyword[code] = {};
        [...asinCountryToDailyKeys[evalAsinCountry]].forEach((rowKey) => {
          const meta = rowMeta[rowKey];
          const rowKeywords = keywordByCountryAsin[meta?.kwCountryAsin] || [];
          if (!meta?.dateKey || !rowKeywords.length) return;
          if (!rsgKeyToTargetsByDateAndKeyword[code][meta.dateKey]) rsgKeyToTargetsByDateAndKeyword[code][meta.dateKey] = {};
          rowKeywords.forEach((kw) => {
            const kwId = kw?.id;
            const keywordKey = kwMeta[kwId]?.keywordKey;
            if (!keywordKey) return;
            if (!rsgKeyToTargetsByDateAndKeyword[code][meta.dateKey][keywordKey]) {
              rsgKeyToTargetsByDateAndKeyword[code][meta.dateKey][keywordKey] = [];
            }
            rsgKeyToTargetsByDateAndKeyword[code][meta.dateKey][keywordKey].push({ rowKey, kwId });
          });
        });
      });

      const rsgKeys = Object.keys(rsgKeyToTargetsByDateAndKeyword);
      const neededDates = [...new Set(Object.values(rowMeta).map((meta) => meta.dateKey).filter(Boolean))];
      if (!rsgKeys.length || !neededDates.length) {
        return { kwDailyRecords: existingKwDailyRows, dailyPatchMap: {}, kwPatchMap: {}, updateCount: 0, failCount: 0 };
      }

      const rsgDailyRows = await fetchAllByIn('rsg_daily:list', 'rsg_id', rsgKeys, {
        extraAnd: [{ date: { $in: neededDates } }],
        chunkSize: 80,
        pageSize: 500,
      });
      const rsgDailyIdToTargets = {};
      const rsgDailyIdsForQuery = [];
      rsgDailyRows.forEach((row) => {
        const id = row?.id;
        const rsgKey = String(row?.rsg_id ?? '').trim();
        const dateKey = toDateKey(row?.date);
        const keywordKey = normalizeSearchText(row?.keywork);
        const targets = rsgKeyToTargetsByDateAndKeyword[rsgKey]?.[dateKey]?.[keywordKey] || [];
        if (id == null || !targets.length) return;
        rsgDailyIdToTargets[String(id)] = targets;
        rsgDailyIdsForQuery.push(id);
      });
      const rsgDailyIds = [...new Set(rsgDailyIdsForQuery)];
      if (!rsgDailyIds.length) {
        return { kwDailyRecords: existingKwDailyRows, dailyPatchMap: {}, kwPatchMap: {}, updateCount: 0, failCount: 0 };
      }

      const refundRows = await fetchAllByIn('refund:list', 'rsg_daily_id', rsgDailyIds, {
        chunkSize: 80,
        pageSize: 500,
      });
      const orderNumbers = [...new Set(refundRows.map((row) => String(row?.order_number ?? '').trim()).filter(Boolean))];
      if (orderNumbers.length) {
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
          const orderNumber = String(row?.order_number ?? '').trim();
          if (!orderNumber || !validOrderNumbers.has(orderNumber)) return;
          const targets = rsgDailyIdToTargets[String(row?.rsg_daily_id ?? '')] || [];
          targets.forEach(({ rowKey, kwId }) => {
            const key = `${rowKey}_${kwId}`;
            if (Object.prototype.hasOwnProperty.call(result, key)) result[key] = (result[key] || 0) + 1;
          });
        });
      }

      const existingMap = {};
      existingKwDailyRows.forEach((row) => {
        const key = `${row?.country_asin_date}_${row?.eval_word_id}`;
        if (row?.country_asin_date && row?.eval_word_id != null) existingMap[key] = row;
      });

      const kwPatchMap = {};
      const dailyTotals = {};
      Object.entries(result).forEach(([key, value]) => {
        const idx = key.lastIndexOf('_');
        const rowKey = key.slice(0, idx);
        const kwId = key.slice(idx + 1);
        kwPatchMap[key] = value;
        dailyTotals[rowKey] = (dailyTotals[rowKey] || 0) + value;
      });
      const dailyPatchMap = {};

      let updateCount = 0;
      let failCount = 0;
      const nextKwDailyRows = [...existingKwDailyRows];
      const nextMap = { ...existingMap };
      if (options.writeBack !== false) {
        const jobs = Object.entries(kwPatchMap).map(([key, actualReviewQty]) => {
          const idx = key.lastIndexOf('_');
          const rowKey = key.slice(0, idx);
          const kwId = key.slice(idx + 1);
          const existing = existingMap[key];
          const meta = rowMeta[rowKey] || {};
          return { key, rowKey, kwId, existing, actualReviewQty, date: meta.dateKey };
        });
        for (let i = 0; i < jobs.length; i += 100) {
          const batch = jobs.slice(i, i + 100);
          const results = await Promise.allSettled(batch.map(async (job) => {
            if (job.existing?.id) {
              if (isFormulaSameValue(job.existing.actual_review_qty, job.actualReviewQty)) return job.existing;
              await ctx.request({
                url: 'new_eval_words_daily:update',
                method: 'post',
                params: { filterByTk: job.existing.id },
                data: { actual_review_qty: job.actualReviewQty },
              });
              Object.assign(job.existing, { actual_review_qty: job.actualReviewQty });
              return job.existing;
            }
            const res = await ctx.request({
              url: 'new_eval_words_daily:create',
              method: 'post',
              data: withCreateTimestamps({
                country_asin_date: job.rowKey,
                eval_word_id: Number(job.kwId) || job.kwId,
                date: job.date || null,
                actual_review_qty: job.actualReviewQty,
              }),
            });
            const created = res?.data?.data || {
              country_asin_date: job.rowKey,
              eval_word_id: Number(job.kwId) || job.kwId,
              date: job.date || null,
              actual_review_qty: job.actualReviewQty,
            };
            nextKwDailyRows.push(created);
            nextMap[job.key] = created;
            return created;
          }));
          updateCount += results.filter((r) => r.status === 'fulfilled').length;
          failCount += results.filter((r) => r.status === 'rejected').length;
        }
      } else {
        Object.entries(kwPatchMap).forEach(([key, value]) => {
          const existing = nextMap[key];
          if (existing) existing.actual_review_qty = value;
        });
      }

      return { kwDailyRecords: nextKwDailyRows, dailyPatchMap, kwPatchMap, updateCount, failCount };
    }, [fetchAllByIn]);

    const buildMergedRows = useCallback((dailyRecords, related) => {
      const weeklyRecords = Array.isArray(related?.weeklyRecords) ? related.weeklyRecords : [];
      const keywordTrackingRecords = Array.isArray(related?.keywordTrackingRecords) ? related.keywordTrackingRecords : [];
      const kwRecords = Array.isArray(related?.kwRecords) ? related.kwRecords : [];
      const kwDailyRecords = Array.isArray(related?.kwDailyRecords) ? related.kwDailyRecords : [];
      const dynamicCols = Array.isArray(related?.dynamicCols) ? related.dynamicCols : [];

      const weeklyMap = {};
      weeklyRecords.forEach((w) => { if (w.country_asin_week) weeklyMap[w.country_asin_week] = w; });

      const keywordTrackingMap = {};
      keywordTrackingRecords.forEach((kt) => { if (kt.country_asin_date) keywordTrackingMap[kt.country_asin_date] = kt; });

      const kwMapByCa = {};
      kwRecords.forEach((kw) => {
        if (!kwMapByCa[kw.country_asin]) kwMapByCa[kw.country_asin] = [];
        kwMapByCa[kw.country_asin].push(kw);
      });

      const kwDailyMap = {};
      kwDailyRecords.forEach((d) => {
        kwDailyMap[`${d.eval_word_id}_${d.date}`] = d;
      });

      return (Array.isArray(dailyRecords) ? dailyRecords : []).map((d) => {
        const merged = { ...d };
        if (d.country_asin_date) {
          const keyDate = d.country_asin_date;
          if (weeklyMap[keyDate]) Object.assign(merged, weeklyMap[keyDate]);

          if (keywordTrackingMap[keyDate]) {
            const kt = keywordTrackingMap[keyDate];
            Object.assign(merged, kt);
            merged.actual_keyword_position = kt.actual_keyword_position || '';
            merged.actual_kw_pos_screenshot = kt.actual_keyword_position || '';
          }

          const ca = `${d.country}_${d.asin}`;
          const dateStr = d.date ? String(d.date).slice(0, 10) : null;
          if (ca && dateStr) {
            const kws = kwMapByCa[ca] || [];

            dynamicCols.forEach((dynCol) => {
              const kw = kws.find((k) => k.id === dynCol._kwId);
              if (kw) {
                const dailyData = kwDailyMap[`${kw.id}_${dateStr}`] || {};
                merged[dynCol.field] = { kw, daily: dailyData };
              }
            });
          }
        }
        return merged;
      });
    }, []);

    const buildWeeklySummaryRows = useCallback((mergedRows, dynamicCols) => {
      if (!Array.isArray(mergedRows) || !mergedRows.length) return [];

      const groups = {};
      mergedRows.forEach((row) => {
        const dateKey = toDateKey(row?.date);
        const weekKey = getWeekRangeKey(dateKey);
        if (!weekKey) return;
        if (!groups[weekKey]) groups[weekKey] = [];
        groups[weekKey].push(row);
      });

      return Object.entries(groups).map(([weekKey, rows]) => {
        const [weekStart, weekEnd] = weekKey.split('_');
        const sample = rows[0] || {};
        const summaryKey = getWeeklySummaryKey({ country: sample.country, asin: sample.asin, start: weekStart, end: weekEnd });
        const estReviewTotal = sumRows(rows, 'est_review_total');
        const actualReviewTotal = sumRows(rows, 'rsg_number');
        const estTraffic = sumRows(rows, 'est_traffic');
        const targetCvr = averageRows(rows, 'target_cvr');
        const estNatOrder = sumRows(rows, 'est_nat_order');
        const dailyEvalDemand = sumRows(rows, 'daily_eval_demand');
        const actualNaturalOrder = sumRows(rows, 'actual_natural_order') || sumRows(rows, 'zirandan');
        const actualAdOrder = sumRows(rows, 'guanggaodan');
        const actualTraffic = sumRows(rows, 'zongliuliang');
        const actualTotalOrder = sumRows(rows, 'sales');
        const actualCvr = actualTraffic ? actualTotalOrder / actualTraffic : null;
        const weekNo = getWeekNoSundayStart(weekStart);

        const summaryData = {
          daily_country: '周汇总',
          daily_date: `${weekStart} ~ ${weekEnd}`,
          daily_promotion_days: weekNo ? `第${weekNo}周` : '',
          rsg_number: actualReviewTotal,
          sales: actualTotalOrder,
          weekly_order_items: actualTotalOrder,
          weekly_order_items_2: actualTotalOrder,
          zirandan: actualNaturalOrder,
          weekly_zirandan: actualNaturalOrder,
          guanggaodan: actualAdOrder,
          weekly_guanggaodan: actualAdOrder,
          zongliuliang: actualTraffic,
          weekly_zongliuliang: actualTraffic,
          session_conversion_rate: actualCvr,
          zongcvr: actualCvr,
          weekly_zongcvr: actualCvr,
          est_review_total: estReviewTotal,
          keyword_tracking_est_review_total: estReviewTotal,
          est_traffic: estTraffic,
          keyword_tracking_est_traffic: estTraffic,
          target_cvr: targetCvr,
          keyword_tracking_target_cvr: targetCvr,
          est_nat_order: estNatOrder,
          keyword_tracking_est_nat_order: estNatOrder,
          daily_eval_demand: dailyEvalDemand,
          keyword_tracking_daily_eval_demand: dailyEvalDemand,
          actual_natural_order: actualNaturalOrder,
          keyword_tracking_actual_natural_order: actualNaturalOrder,
          plan_eval_judgment: buildPlanEvalJudgment(dailyEvalDemand, estReviewTotal),
          keyword_tracking_plan_eval_judgment: buildPlanEvalJudgment(dailyEvalDemand, estReviewTotal),
          actual_eval_judgment: buildActualEvalJudgment(actualReviewTotal, estReviewTotal),
          keyword_tracking_actual_eval_judgment: buildActualEvalJudgment(actualReviewTotal, estReviewTotal),
          actual_cvr_judgment: buildActualCvrJudgment(actualCvr, targetCvr),
          keyword_tracking_actual_cvr_judgment: buildActualCvrJudgment(actualCvr, targetCvr),
        };

        const summary = {
          _isWeeklySummary: true,
          __rowType: WEEKLY_SUMMARY_ROW_TYPE,
          id: summaryKey,
          country_asin_week_range: summaryKey,
          country_asin_date: summaryKey,
          country_asin_week: summaryKey,
          country: sample.country || '',
          asin: sample.asin || '',
          asin_country: sample.asin_country || (sample.asin && sample.country ? `${sample.asin}_${sample.country}` : null),
          date: `${weekStart} ~ ${weekEnd}`,
          week_start_date: weekStart,
          week_end_date: weekEnd,
          week_no: weekNo,
          week_range_label: `${weekStart}~${weekEnd}`,
          source_days_count: rows.length,
          sale_owner: '',
          model: '',
          activity_annotation: '',
          promotion_days: weekNo ? `第${weekNo}周` : '',
          daily_price: '',
          list_price: '',
          off: '',
          price_after_discount: '',
          selling_accounts: '',
          rsg_number: actualReviewTotal,
          sales: actualTotalOrder,
          zirandan: actualNaturalOrder,
          guanggaodan: actualAdOrder,
          zongliuliang: actualTraffic,
          session_conversion_rate: actualCvr,
          zongcvr: actualCvr,
          est_review_total: estReviewTotal,
          est_traffic: estTraffic,
          target_cvr: targetCvr,
          est_nat_order: estNatOrder,
          daily_eval_demand: dailyEvalDemand,
          actual_natural_order: actualNaturalOrder,
          plan_eval_judgment: buildPlanEvalJudgment(dailyEvalDemand, estReviewTotal),
          actual_eval_judgment: buildActualEvalJudgment(actualReviewTotal, estReviewTotal),
          actual_cvr_judgment: buildActualCvrJudgment(actualCvr, targetCvr),
          actual_keyword_position: '',
          actual_kw_pos_screenshot: '',
          [WEEKLY_SUMMARY_DATA_FIELD]: summaryData,
          summary_data: summaryData,
        };

        (dynamicCols || []).forEach((dynCol) => {
          const kwRows = rows.map((row) => row?.[dynCol.field]?.daily || {});
          const isMainKeyword = dynCol._kwRole === '主推';
          const estReviewQty = isMainKeyword ? sumRows(kwRows, 'est_review_qty') : '';
          const actualReviewQty = sumRows(kwRows, 'actual_review_qty');
          const dynamicValue = {
            kw: { id: dynCol._kwId, keyword_name: dynCol._kwName, role: dynCol._kwRole },
            daily: {
              est_review_qty: estReviewQty,
              est_rank: '',
              actual_review_qty: actualReviewQty,
              actual_rank: '',
              review_notes: '',
              new_plan: '',
            },
          };
          summaryData[dynCol.field] = dynamicValue;
          summaryData[dynCol.key] = dynamicValue;
          summary[dynCol.field] = {
            ...dynamicValue,
          };
        });

        return summary;
      }).sort((a, b) => {
        const ak = String(a.date || '').slice(0, 10);
        const bk = String(b.date || '').slice(0, 10);
        return sortConfig.dir === 'desc' ? bk.localeCompare(ak) : ak.localeCompare(bk);
      });
    }, [sortConfig.dir]);

    const normalizeWeeklySummaryRecord = useCallback((record) => {
      if (!record?.country_asin_week_range) return null;
      const scopedSummaryData = record[WEEKLY_SUMMARY_DATA_FIELD];
      const legacySummaryData = record.summary_data;
      const summaryData = scopedSummaryData && typeof scopedSummaryData === 'object'
        ? scopedSummaryData
        : legacySummaryData && typeof legacySummaryData === 'object'
        ? legacySummaryData
        : {};
      const weekStart = record.week_start_date || '';
      const weekEnd = record.week_end_date || '';
      return {
        ...record,
        ...summaryData,
        _isWeeklySummary: true,
        __rowType: WEEKLY_SUMMARY_ROW_TYPE,
        id: record.country_asin_week_range,
        country: record.country || summaryData.country || '',
        asin: record.asin || summaryData.asin || '',
        asin_country: record.asin_country || summaryData.asin_country || '',
        week_start_date: weekStart,
        week_end_date: weekEnd,
        week_no: record.week_no ?? summaryData.week_no ?? null,
        week_range_label: record.week_range_label || `${weekStart}~${weekEnd}`,
        country_asin_date: record.country_asin_week_range,
        country_asin_week: record.country_asin_week_range,
        date: weekStart && weekEnd ? `${weekStart} ~ ${weekEnd}` : (record.week_range_label || ''),
        promotion_days: record.week_no ? `第${record.week_no}周` : (summaryData.daily_promotion_days || ''),
        actual_keyword_position: '',
        actual_kw_pos_screenshot: '',
        summary_data: summaryData,
      };
    }, []);

    const syncWeeklySummaryRows = useCallback(async (summaryRows) => {
      const summaries = (Array.isArray(summaryRows) ? summaryRows : [])
        .filter((row) => row?.country_asin_week_range);
      if (!summaries.length) return [];

      const keys = summaries.map((row) => row.country_asin_week_range);
      const existingRows = await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', keys, {
        chunkSize: 80,
        pageSize: 500,
      }).catch(() => []);
      const existingMap = {};
      existingRows.forEach((row) => {
        if (row?.country_asin_week_range) existingMap[row.country_asin_week_range] = row;
      });

      const writeResults = await Promise.allSettled(summaries.map((summary) => {
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
      const failCount = writeResults.filter((item) => item.status === 'rejected').length;
      if (failCount > 0) {
        throw new Error(`${failCount} 条写入失败`);
      }

      const refreshedRows = await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', keys, {
        chunkSize: 80,
        pageSize: 500,
      }).catch(() => []);
      const refreshedMap = {};
      refreshedRows.forEach((row) => {
        const normalized = normalizeWeeklySummaryRecord(row);
        if (normalized) refreshedMap[normalized.country_asin_week_range] = normalized;
      });
      return summaries.map((summary) => refreshedMap[summary.country_asin_week_range] || summary);
    }, [fetchAllByIn, normalizeWeeklySummaryRecord]);

    const loadWeeklySummaryRowsForDailyRows = useCallback(async (dailyRows) => {
      const keys = [...new Set((Array.isArray(dailyRows) ? dailyRows : []).map(getWeeklySummaryKeyForDailyRow).filter(Boolean))];
      if (!keys.length) return [];
      const records = await fetchAllByIn(`${WEEKLY_SUMMARY_COLLECTION}:list`, 'country_asin_week_range', keys, {
        chunkSize: 80,
        pageSize: 500,
      }).catch(() => []);
      return records.map(normalizeWeeklySummaryRecord).filter(Boolean);
    }, [fetchAllByIn, normalizeWeeklySummaryRecord]);

    const recalcAndPersistWeeklySummariesForRows = useCallback(async (changedRows) => {
      const groups = {};
      (Array.isArray(changedRows) ? changedRows : []).forEach((row) => {
        const range = getNaturalWeekRange(row?.date);
        if (!range || !row?.country || !row?.asin) return;
        const key = getWeeklySummaryKeyForDailyRow(row);
        if (!groups[key]) groups[key] = { key, country: row.country, asin: row.asin, start: range[0], end: range[1] };
      });

      const groupList = Object.values(groups);
      if (!groupList.length) return [];

      const fullDailyRows = [];
      for (const group of groupList) {
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
        fullDailyRows.push(...rows);
      }

      const dailyMap = {};
      fullDailyRows.forEach((row) => {
        if (row?.country_asin_date) dailyMap[row.country_asin_date] = row;
      });
      const uniqueDailyRows = Object.values(dailyMap);
      const fullWeekKeys = [...new Set(uniqueDailyRows.map((d) => d.country_asin_date).filter(Boolean))];
      const caKeys = [...new Set(uniqueDailyRows.map((d) => d.country && d.asin ? `${d.country}_${d.asin}` : null).filter(Boolean))];
      if (!fullWeekKeys.length) return [];

      const fullWeekSubFilter = JSON.stringify({ country_asin_date: { $in: fullWeekKeys } });
      const fullWeekWeekFilter = JSON.stringify({ country_asin_week: { $in: fullWeekKeys } });
      const caFilter = JSON.stringify({ country_asin: { $in: caKeys } });
      const [fullWeeklyRecords, fullKeywordTrackingRecords, kwRecords, fullKwDailyRecords] = await Promise.all([
        fetchAllList('weekly_performance:list', { filter: fullWeekWeekFilter }, 500),
        fetchAllList('daily_keyword_tracking:list', { filter: fullWeekSubFilter }, 500),
        caKeys.length ? fetchAllList('new_eval_words:list', { filter: caFilter }, 500) : [],
        fetchAllList('new_eval_words_daily:list', { filter: fullWeekSubFilter }, 500),
      ]);

      const dynamicCols = buildDynamicKwCols(kwRecords);
      const fullMergedRows = buildMergedRows(uniqueDailyRows, {
        weeklyRecords: fullWeeklyRecords,
        keywordTrackingRecords: fullKeywordTrackingRecords,
        kwRecords,
        kwDailyRecords: fullKwDailyRecords,
        dynamicCols,
      });
      const summaryRows = buildWeeklySummaryRows(fullMergedRows, dynamicCols)
        .filter((summary) => groups[summary.country_asin_week_range]);
      return syncWeeklySummaryRows(summaryRows);
    }, [buildDynamicKwCols, buildMergedRows, buildWeeklySummaryRows, fetchAllList, syncWeeklySummaryRows]);

    function scheduleCurrentPagePushSummaryRefresh(rows, options = {}) {
      const sourceRows = (Array.isArray(rows) ? rows : []).filter((row) => row && !row._isWeeklySummary && row.country && row.asin && row.date);
      const state = currentPagePushSummaryRef.current;
      sourceRows.forEach((row) => {
        const key = getWeeklySummaryKeyForDailyRow(row);
        if (key) state.pendingRowsByKey[key] = row;
      });
      if (!Object.keys(state.pendingRowsByKey).length) return;
      if (state.timer) window.clearTimeout(state.timer);
      state.timer = window.setTimeout(async () => {
        state.timer = null;
        if (state.running) {
          scheduleCurrentPagePushSummaryRefresh([], { delay: 300 });
          return;
        }
        const rowsToRefresh = Object.values(state.pendingRowsByKey);
        state.pendingRowsByKey = {};
        if (!rowsToRefresh.length) return;
        state.running = true;
        try {
          showFormulaProgress({ label: '更新本页汇总...', percent: 18 });
          const updatedSummaries = await recalcAndPersistWeeklySummariesForRows(rowsToRefresh);
          if (Array.isArray(updatedSummaries) && updatedSummaries.length) {
            setData((prev) => {
              const normalRows = prev.filter((row) => !row?._isWeeklySummary);
              const existingSummaries = prev.filter((row) => row?._isWeeklySummary);
              const updatedMap = {};
              updatedSummaries.forEach((summary) => {
                if (summary?.country_asin_week_range) updatedMap[summary.country_asin_week_range] = summary;
              });
              const keepSummaries = existingSummaries.filter((summary) => !updatedMap[summary.country_asin_week_range]);
              return interleaveWeeklySummaryRows(normalRows, [...keepSummaries, ...updatedSummaries]);
            });
          }
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
          if (Object.keys(state.pendingRowsByKey).length) scheduleCurrentPagePushSummaryRefresh([], { delay: 300 });
        }
      }, Number(options.delay) || 120);
    }

    async function ensureCurrentCountryAsinPushSummaries(options = {}) {
      const reportProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
      reportProgress?.({ label: '读取全量数据...', percent: 8 });
      let rows = await loadFormulaRowsForCurrentCountryAsin(true);
      if (!Array.isArray(rows) || !rows.length) return [];

      if (options.recalcFormulas !== false) {
        reportProgress?.({ label: '计算日公式...', percent: 18 });
        let formulaPercent = 18;
        await recalcAllFormulas(rows, {
          allowNonAdmin: true,
          silentSuccess: true,
          silentLoading: true,
          onProgress: (progress) => {
            if (!reportProgress) return;
            const label = typeof progress === 'string' ? progress : (progress?.label || '计算日公式...');
            const rawPercent = typeof progress === 'object' ? Number(progress?.percent) : null;
            formulaPercent = Number.isFinite(rawPercent)
              ? 18 + rawPercent * 0.55
              : Math.min(75, formulaPercent + 8);
            reportProgress({ label, percent: formulaPercent });
          },
        });
        reportProgress?.({ label: '读取最新数据...', percent: 76 });
        rows = await loadFormulaRowsForCurrentCountryAsin(true);
      }

      if (!Array.isArray(rows) || !rows.length) return [];
      reportProgress?.({ label: '汇总周数据...', percent: 86 });
      const updatedSummaries = await recalcAndPersistWeeklySummariesForRows(rows);
      reportProgress?.({ label: '写入周汇总...', percent: 94 });
      if (Array.isArray(updatedSummaries) && updatedSummaries.length) {
        setData((prev) => {
          const normalRows = prev.filter((row) => !row?._isWeeklySummary);
          const existingSummaries = prev.filter((row) => row?._isWeeklySummary);
          const updatedMap = {};
          updatedSummaries.forEach((summary) => {
            if (summary?.country_asin_week_range) updatedMap[summary.country_asin_week_range] = summary;
          });
          const keepSummaries = existingSummaries.filter((summary) => !updatedMap[summary.country_asin_week_range]);
          return interleaveWeeklySummaryRows(normalRows, [...keepSummaries, ...updatedSummaries]);
        });
      }
      return updatedSummaries;
    }

    function scheduleCurrentCountryAsinPushSummarySync(options = {}) {
      if (!filterCountry || !filterAsin) return;
      const state = backgroundPushSummaryRef.current;
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
          await ensureCurrentCountryAsinPushSummaries({
            force,
            recalcFormulas: options.recalcFormulas !== false,
            onProgress: showFormulaProgress,
          });
          finishFormulaProgress('全量同步完成');
        } catch (err) {
          resetFormulaProgress();
          ctx.message.warning(`后台周汇总同步失败：${err?.message || ''}`);
        } finally {
          state.running = false;
          if (state.pendingForce) scheduleCurrentCountryAsinPushSummarySync({ force: true });
        }
      }, Number(options.delay) || 800);
    }

    const interleaveWeeklySummaryRows = useCallback((rows, summaryRows) => {
      if (!shouldShowWeeklySummary || !Array.isArray(rows) || !rows.length) return rows || [];
      if (!Array.isArray(summaryRows) || !summaryRows.length) return rows;

      const summaryMap = {};
      summaryRows.forEach((summary) => {
        const startKey = String(summary?.date || '').slice(0, 10);
        const weekKey = getWeekRangeKey(startKey);
        if (weekKey) summaryMap[weekKey] = summary;
      });

      const sortedRows = [...rows].sort((a, b) => {
        const ak = toDateKey(a?.date);
        const bk = toDateKey(b?.date);
        return sortConfig.dir === 'desc' ? bk.localeCompare(ak) : ak.localeCompare(bk);
      });

      const result = [];
      sortedRows.forEach((row, idx) => {
        result.push(row);
        const weekKey = getWeekRangeKey(row?.date);
        const nextWeekKey = getWeekRangeKey(sortedRows[idx + 1]?.date);
        if (weekKey && weekKey !== nextWeekKey && summaryMap[weekKey]) {
          result.push(summaryMap[weekKey]);
        }
      });
      return result;
    }, [shouldShowWeeklySummary, sortConfig.dir]);

    const loadData = useCallback(async (options = {}) => {
      const page = options.page ?? curPageRef.current;
      const size = options.size ?? pageSizeRef.current;
      const skipFormula = options.skipFormula === true;
      try {
        setLoading(true);
        if (!hasRequiredUrlParams) {
          setData([]);
          setTotal(0);
          return [];
        }
        const dailyFilterAnd = [];
        if (filterAsin)    dailyFilterAnd.push({ asin:    { $eq: filterAsin    } });
        if (filterCountry) dailyFilterAnd.push({ country: { $eq: filterCountry } });
        const dateRange = expandDateRangeToNaturalWeeks(getDateRange);
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
        const keys = [...new Set(dailyRecords.map(d => d.country_asin_date).filter(Boolean))];
        const caKeys = [...new Set(dailyRecords.map(d => d.country && d.asin ? `${d.country}_${d.asin}` : null).filter(Boolean))];

        if (keys.length === 0) {
          setData([]);
          setTotal(totalCount);
          if (page > 1 && totalCount > 0) {
            const maxPage = Math.max(1, Math.ceil(totalCount / size));
            if (page > maxPage) {
              setCurPage(maxPage);
              return loadData({ page: maxPage, size, skipFormula, skipBackgroundSummary: options.skipBackgroundSummary, skipCurrentPageSummaryRefresh: options.skipCurrentPageSummaryRefresh });
            }
          }
          setLoading(false);
          return [];
        }

        const subFilter  = JSON.stringify({ country_asin_date: { $in: keys } });
        const weekFilter = JSON.stringify({ country_asin_week: { $in: keys } });
        const caFilter   = JSON.stringify({ country_asin: { $in: caKeys } });
        const relatedPageSize = Math.max(size, keys.length, caKeys.length, 100);

        const [rWeekly, rKeywordTracking, rKw, rKwDaily] = await Promise.all([
          ctx.request({ url: 'weekly_performance:list',        method: 'get', params: { pageSize: relatedPageSize, filter: weekFilter } }),
          ctx.request({ url: 'daily_keyword_tracking:list',    method: 'get', params: { pageSize: relatedPageSize, filter: subFilter } }),
          ctx.request({ url: 'new_eval_words:list',            method: 'get', params: { pageSize: relatedPageSize, filter: caFilter } }),
          ctx.request({ url: 'new_eval_words_daily:list',      method: 'get', params: { pageSize: relatedPageSize, filter: subFilter } }),
        ]);

        const weeklyRecords          = Array.isArray(rWeekly?.data?.data)          ? rWeekly.data.data          : [];
        const keywordTrackingRecords = Array.isArray(rKeywordTracking?.data?.data) ? rKeywordTracking.data.data : [];
        const kwRecords              = Array.isArray(rKw?.data?.data)              ? rKw.data.data              : [];
        let kwDailyRecords           = Array.isArray(rKwDaily?.data?.data)         ? rKwDaily.data.data         : [];

        const actualReviewSync = await syncKeywordActualReviewQtyFromRefunds(dailyRecords, kwRecords, kwDailyRecords);
        kwDailyRecords = actualReviewSync.kwDailyRecords;

        const dynamicCols = buildDynamicKwCols(kwRecords);
        setDynamicKwCols((prev) => {
          const prevMap = Object.fromEntries(prev.map((c) => [c.key, c]));
          const savedMap = Object.fromEntries((Array.isArray(activeViewPayloadRef.current) ? activeViewPayloadRef.current : []).map((c) => [c.key, c]));

          const next = dynamicCols.map((c) => {
            const old = prevMap[c.key];
            const saved = savedMap[c.key];

            return {
              ...c,
              width: getSafeKwColWidth(Number(saved?.width) || old?.width || c.width, showKwOptionalFields),
              hidden: Object.prototype.hasOwnProperty.call(saved || {}, 'hidden') ? saved.hidden === true : old?.hidden === true,
              pinned: Object.prototype.hasOwnProperty.call(saved || {}, 'pinned') ? saved.pinned === true : old?.pinned === true,
              headerColor: Object.prototype.hasOwnProperty.call(saved || {}, 'headerColor') ? (saved.headerColor || c.headerColor) : (old?.headerColor || c.headerColor),
              bodyColor: Object.prototype.hasOwnProperty.call(saved || {}, 'bodyColor') ? (saved.bodyColor || null) : (old?.bodyColor || null),
              editable: Object.prototype.hasOwnProperty.call(saved || {}, 'editable') ? saved.editable === true : old?.editable === true,
            };
          });

          const same =
            prev.length === next.length &&
            prev.every((c, idx) => {
              const n = next[idx];
              return n &&
                c.key === n.key &&
                c.label === n.label &&
                c.width === n.width &&
                c.hidden === n.hidden &&
                c.pinned === n.pinned &&
                c.headerColor === n.headerColor &&
                c.bodyColor === n.bodyColor;
            });

          return same ? prev : next;
        });

        setKwColOrder((prev) => (
          prev.length > 0 || dynamicCols.length === 0
            ? prev
            : dynamicCols.map(c => c.key)
        ));

        const mergedData = buildMergedRows(dailyRecords, {
          weeklyRecords,
          keywordTrackingRecords,
          kwRecords,
          kwDailyRecords,
          dynamicCols,
        });

        let weeklySummaryRows = [];
        if (shouldShowWeeklySummary) {
          weeklySummaryRows = await loadWeeklySummaryRowsForDailyRows(mergedData);
        }

        setData(interleaveWeeklySummaryRows(mergedData, weeklySummaryRows));
        setTotal(totalCount);
        const loadedSummaryKeys = new Set(weeklySummaryRows.map((row) => row.country_asin_week_range).filter(Boolean));
        const missingSummaryRows = shouldShowWeeklySummary
          ? mergedData.filter((row) => {
              const key = getWeeklySummaryKeyForDailyRow(row);
              return key && !loadedSummaryKeys.has(key);
            })
          : [];
        const shouldRunBackgroundSummary = !options.skipBackgroundSummary && filterCountry && filterAsin;
        if (!options.skipCurrentPageSummaryRefresh && mergedData.length) {
          scheduleCurrentPagePushSummaryRefresh(mergedData, {
            delay: (!skipFormula || missingSummaryRows.length) ? 80 : 180,
            keepProgressForBackground: shouldRunBackgroundSummary,
          });
        }
        if (shouldRunBackgroundSummary) {
          scheduleCurrentCountryAsinPushSummarySync({
            force: true,
            showQueuedProgress: !mergedData.length || options.skipCurrentPageSummaryRefresh,
            delay: mergedData.length ? 1000 : ((!skipFormula || missingSummaryRows.length) ? 200 : 900),
          });
        }
        return mergedData;
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
        return [];
      } finally { setLoading(false); }
    }, [filterAsin, filterCountry, hasRequiredUrlParams, getDateRange, buildDynamicKwCols, getDailySort, buildMergedRows, shouldShowWeeklySummary, loadWeeklySummaryRowsForDailyRows, interleaveWeeklySummaryRows, syncKeywordActualReviewQtyFromRefunds, showKwOptionalFields]);

    useEffect(() => { setCurPage(1); loadData({ page: 1 }); }, [loadData]);

    const persistWeeklySummariesForChangedRows = useCallback(async (rows) => {
      const changedRows = (Array.isArray(rows) ? rows : [])
        .filter((row) => row && !row._isWeeklySummary && row.country && row.asin && row.date);
      if (!changedRows.length) return;
      try {
        showFormulaProgress({ label: '正在更新周汇总...', percent: 60 });
        const updatedSummaries = await recalcAndPersistWeeklySummariesForRows(changedRows);
        if (Array.isArray(updatedSummaries) && updatedSummaries.length) {
          showFormulaProgress({ label: '正在刷新页面汇总...', percent: 85 });
          setData((prev) => {
            const normalRows = prev.filter((row) => !row?._isWeeklySummary);
            const existingSummaries = prev.filter((row) => row?._isWeeklySummary);
            const updatedMap = {};
            updatedSummaries.forEach((summary) => {
              if (summary?.country_asin_week_range) updatedMap[summary.country_asin_week_range] = summary;
            });
            const keepSummaries = existingSummaries.filter((summary) => !updatedMap[summary.country_asin_week_range]);
            return interleaveWeeklySummaryRows(normalRows, [...keepSummaries, ...updatedSummaries]);
          });
        }
        finishFormulaProgress('周汇总已更新');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.warning(`周汇总更新失败：${err?.message || '未知错误'}`);
      }
    }, [finishFormulaProgress, interleaveWeeklySummaryRows, recalcAndPersistWeeklySummariesForRows, resetFormulaProgress, showFormulaProgress]);

    const autoRefreshCurrentPage = useCallback(async () => {
      if (loading || refreshingData || calcAllLoading || saving || editingCell) return;
      const now = Date.now();
      if (now - (autoRefreshRef.current.lastAt || 0) < 3000) return;
      autoRefreshRef.current.lastAt = now;
      try {
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '切回页面，正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        if (!(filterCountry && filterAsin)) {
          finishFormulaProgress('切回页面已刷新');
        }
      } catch (err) {
        resetFormulaProgress();
        ctx.message.warning(`切回页面自动刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshProgress('');
      }
    }, [calcAllLoading, editingCell, filterAsin, filterCountry, finishFormulaProgress, loadData, loading, refreshingData, resetFormulaProgress, saving, showFormulaProgress]);

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
      const backgroundState = backgroundPushSummaryRef.current;
      if (backgroundState?.timer) window.clearTimeout(backgroundState.timer);
      backgroundState.timer = null;
      backgroundState.pendingForce = false;
      const currentPageState = currentPagePushSummaryRef.current;
      if (currentPageState?.timer) window.clearTimeout(currentPageState.timer);
      currentPageState.timer = null;
      currentPageState.pendingRowsByKey = {};
    }, [filterCountry, filterAsin]);

    useEffect(() => () => {
      if (formulaProgressFinishTimerRef.current) window.clearTimeout(formulaProgressFinishTimerRef.current);
      if (columnLayoutSaveTimerRef.current) window.clearTimeout(columnLayoutSaveTimerRef.current);
      if (backgroundPushSummaryRef.current?.timer) window.clearTimeout(backgroundPushSummaryRef.current.timer);
      if (currentPagePushSummaryRef.current?.timer) window.clearTimeout(currentPagePushSummaryRef.current.timer);
    }, []);

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
      if (shouldShowWeeklySummary) return data;
      const sourceData = shouldShowWeeklySummary ? data : data.filter((row) => !row?._isWeeklySummary);
      if (!sortConfig.key || !sourceData.length) return sourceData;
      const col   = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      const field = col ? col.field : sortConfig.key;
      return [...sourceData].sort((a, b) => {
        let va = a[field], vb = b[field];
        if (field === 'promo_day') { va = Number(va) || 0; vb = Number(vb) || 0; return sortConfig.dir === 'asc' ? va - vb : vb - va; }
        if (ALL_NUMERIC.has(field)) { va = Number(va) || 0; vb = Number(vb) || 0; return sortConfig.dir === 'asc' ? va - vb : vb - va; }
        if (DATE_FIELDS.has(field)) {
          const ta = va ? new Date(String(va).slice(0, 10)).getTime() : 0;
          const tb = vb ? new Date(String(vb).slice(0, 10)).getTime() : 0;
          return sortConfig.dir === 'asc' ? ta - tb : tb - ta;
        }
        const cmp = String(va || '').localeCompare(String(vb || '')); return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }, [data, shouldShowWeeklySummary, sortConfig]);

    const pagedData = sortedData;

    const toggleCol      = (key) => updateAndSave((p) => { const col = p.find((c) => c.key === key); if (!col) return p; if (!col.hidden) return p.map((c) => c.key === key ? { ...c, hidden: true } : c); return [...p.filter((c) => c.key !== key), { ...col, hidden: false }]; });
    const togglePin      = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c));
    const setHColor      = (key, color) => {
      if (String(key || '').startsWith('kw_dynamic_')) {
        syncDynamicKwColumnConfig(key, { headerColor: color || null });
        return;
      }
      updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c));
    };
    const clearHColor    = (key) => {
      if (String(key || '').startsWith('kw_dynamic_')) {
        syncDynamicKwColumnConfig(key, { headerColor: null });
        return;
      }
      updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c));
    };
    const toggleImportantColumn = (key) => {
      const target = allColumns.find((c) => c.key === key);
      const nextBodyColor = getColBodyColor(target) === IMPORTANT_COLUMN_BODY_COLOR ? null : IMPORTANT_COLUMN_BODY_COLOR;
      if (String(key || '').startsWith('kw_dynamic_')) {
        syncDynamicKwColumnConfig(key, { bodyColor: nextBodyColor });
        return;
      }
      updateAndSave((p) => p.map((c) => c.key === key ? { ...c, bodyColor: nextBodyColor } : c));
    };
    const saveKwSubFieldHeaderColorsToCurrentView = useCallback(async (nextColors) => {
      const viewId = activeColumnViewIdRef.current || activeColumnViewId;
      const safeColors = normalizeKwSubFieldHeaderColors(nextColors);
      setKwSubFieldHeaderColors(safeColors);
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const nextViews = views.map((view) => view.id === viewId ? {
        ...view,
        kwSubFieldHeaderColors: safeColors,
        updated_at: new Date().toISOString(),
      } : view);
      setColumnViewsLocal(nextViews);
      markColumnLayoutChanged();
      return true;
    }, [activeColumnViewId, columnViews, markColumnLayoutChanged, setColumnViewsLocal]);
    const setKwSubHColor = (fieldKey, color) => {
      saveKwSubFieldHeaderColorsToCurrentView({ ...kwSubFieldHeaderColors, [fieldKey]: color }).catch((err) => ctx.message.error(`保存词下字段颜色失败：${err?.message || ''}`));
    };
    const clearKwSubHColor = (fieldKey) => {
      const next = { ...kwSubFieldHeaderColors };
      delete next[fieldKey];
      saveKwSubFieldHeaderColorsToCurrentView(next).catch((err) => ctx.message.error(`重置词下字段颜色失败：${err?.message || ''}`));
    };
    const toggleEditable = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c));
    const selectAll      = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: false })));
    const deselectAll    = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: true  })));
    const selectGroup    = (src) => updateAndSave((p) => p.map((c) => c.src === src ? { ...c, hidden: false } : c));
    const deselectGroup  = (src) => updateAndSave((p) => p.map((c) => c.src === src ? { ...c, hidden: true  } : c));

    const visibleCols   = useMemo(() => { const vis = allColumns.filter((c) => !c.hidden && c.src !== 'tool'); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [allColumns]);
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += col.width || 80; } }); return map; }, [visibleCols]);
    const getKwSubHeaderColor = useCallback((sub) => {
      if (!sub?.key) return '#f5f5f5';
      return kwSubFieldHeaderColors[sub.key] || DEFAULT_KW_SUB_FIELD_HEADER_COLORS[sub.key] || '#f5f5f5';
    }, [kwSubFieldHeaderColors]);

    // 是否存在至少一个关键词列 → 需要二级表头
    const hasKwColumns = useMemo(() => visibleCols.some(c => c._isKwColumn), [visibleCols]);

    const onDragStart = (e, key) => {
      if (isResizing) {
        e.preventDefault();
        return;
      }
      dragColKey.current = key;
      e.dataTransfer.effectAllowed = 'move';
    };
    const onDragOver  = (e) => e.preventDefault();

    const onDrop = useCallback((e, targetKey) => {
      e.preventDefault();
      markColumnLayoutChanged();
      const fromKey = dragColKey.current;
      if (!fromKey || fromKey === targetKey) return;

      const isFromKw = fromKey.startsWith('kw_dynamic_');
      const isToKw = targetKey.startsWith('kw_dynamic_');

      if (isFromKw && isToKw) {
        setKwColOrder(prev => {
          const newOrder = [...prev];
          const fromIdx = newOrder.indexOf(fromKey);
          const toIdx = newOrder.indexOf(targetKey);
          if (fromIdx >= 0 && toIdx >= 0) {
            newOrder.splice(fromIdx, 1);
            newOrder.splice(toIdx, 0, fromKey);
          }
          return newOrder;
        });
      } else {
        updateAndSave((prev) => {
          const next = [...prev];
          const fi = next.findIndex((c) => c.key === fromKey);
          const ti = next.findIndex((c) => c.key === targetKey);
          if (fi >= 0 && ti >= 0) {
            const [moved] = next.splice(fi, 1);
            next.splice(ti, 0, moved);
          }
          return next;
        });
      }

      dragColKey.current = null;
    }, [markColumnLayoutChanged, updateAndSave]);

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

      const isKwCol = String(colKey).startsWith('kw_dynamic_');
      const minWidth = isKwCol ? getKwMinWidth(showKwOptionalFields) : 40;
      const nw = Math.max(minWidth, startWidth + (e.clientX - startX));


      if (isKwCol) {
        syncDynamicKwColumnConfig(colKey, { width: nw });
        return;
      }

      updateAndSave((p) =>
        p.map((c) =>
          c.key === colKey
            ? { ...c, width: nw }
            : c
        )
      );
    }, [updateAndSave, showKwOptionalFields, syncDynamicKwColumnConfig]);

    const onOverlayUp   = useCallback(() => { resizeRef.current = null; setIsResizing(false); }, []);

    const isCellEditable = useCallback((col) => {
      if (READONLY_FIELDS.has(col.field)) return false;
      return col.editable === true;
    }, []);

    const getKwSubRangeKeys = useCallback((startSubKey, endSubKey) => {
      if (!startSubKey || !endSubKey) return null;
      const fields = getKwVisibleSubFields(showKwOptionalFields);
      const startIdx = fields.findIndex((sub) => sub.key === startSubKey);
      const endIdx = fields.findIndex((sub) => sub.key === endSubKey);
      if (startIdx < 0 || endIdx < 0) return null;
      const from = Math.min(startIdx, endIdx);
      const to = Math.max(startIdx, endIdx);
      return new Set(fields.slice(from, to + 1).map((sub) => sub.key));
    }, [showKwOptionalFields]);

    const normalizeSelection = useCallback((range) => {
      if (!range) return null;
      const r1 = Math.min(range.start.r, range.end.r);
      const r2 = Math.max(range.start.r, range.end.r);
      const c1 = Math.min(range.start.c, range.end.c);
      const c2 = Math.max(range.start.c, range.end.c);
      const startSubKey = range.start.subKey || null;
      const endSubKey = range.end.subKey || null;
      return { r1, r2, c1, c2, startSubKey, endSubKey };
    }, []);

    const isCellSelected = useCallback((r, c) => {
      const rect = normalizeSelection(selectedRange);
      if (rect?.startSubKey || rect?.endSubKey) return false;
      return !!rect && r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2;
    }, [normalizeSelection, selectedRange]);

    const isKeywordSubSelected = useCallback((r, c, subKey) => {
      const rect = normalizeSelection(selectedRange);
      if (!rect || r < rect.r1 || r > rect.r2 || c < rect.c1 || c > rect.c2) return false;
      if (!rect.startSubKey && !rect.endSubKey) return false;
      if (rect.c1 !== rect.c2 || c !== rect.c1) return false;
      const subKeys = getKwSubRangeKeys(rect.startSubKey, rect.endSubKey);
      return !!subKeys?.has(subKey);
    }, [getKwSubRangeKeys, normalizeSelection, selectedRange]);

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
      const value = row?.[col.field];
      if (value == null || value === '') return '';
      if (RATE_FIELDS.has(col.field)) return String(Number(value) * 100);
      if (DATE_FIELDS.has(col.field)) return String(value).slice(0, 10);
      return String(value);
    }, []);

    const parsePastedValue = useCallback((col, rawValue) => {
      const text = String(rawValue ?? '').trim();
      if (text === '') return null;
      if (col.field === 'promo_day') {
        const low = text.toLowerCase();
        if (['1', 'true', 'yes', 'y', '是'].includes(low)) return 1;
        if (['0', 'false', 'no', 'n', '否'].includes(low)) return 0;
        return null;
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

    const parseKeywordPastedValue = useCallback((sub, rawValue) => {
      const text = String(rawValue ?? '').trim();
      if (text === '') return null;
      if (sub.type === 'number') {
        const num = Number(text.replace(/,/g, ''));
        return !isNaN(num) ? num : null;
      }
      return text;
    }, []);

    const getClipboardSlots = useCallback((cols) => {
      const slots = [];
      const kwSubFields = getKwVisibleSubFields(showKwOptionalFields);
      cols.forEach((col, colIndex) => {
        if (col.field && col.field.startsWith('kw_dynamic_')) {
          kwSubFields.forEach((sub) => {
            slots.push({ type: 'keyword', col, colIndex, sub });
          });
          return;
        }
        if (isActualKeywordPosColumn(col)) {
          slots.push({ type: 'rich', col, colIndex, field: 'actual_keyword_position' });
          return;
        }
        slots.push({ type: 'normal', col, colIndex });
      });
      return slots;
    }, [showKwOptionalFields]);

    const getClipboardSlotsForRange = useCallback((c1, c2, rect = null) => {
      let slots = getClipboardSlots(visibleCols).filter((slot) => slot.colIndex >= c1 && slot.colIndex <= c2);
      if (rect?.startSubKey || rect?.endSubKey) {
        const subKeys = getKwSubRangeKeys(rect.startSubKey, rect.endSubKey);
        if (subKeys && c1 === c2) {
          slots = slots.filter((slot) => slot.type === 'keyword' && slot.colIndex === c1 && subKeys.has(slot.sub.key));
        }
      }
      return slots;
    }, [getClipboardSlots, getKwSubRangeKeys, visibleCols]);

    const getKeywordClipboardValue = useCallback((col, row, sub) => {
      const value = row?.[col.field]?.daily?.[sub.key];
      return value == null || value === '' ? '' : String(value);
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

    const handleCellMouseDown = useCallback((e, r, c, subKey = null) => {
      if (e.button !== 0 || isResizing || editingCell) return;
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button'].includes(tag) || e.target?.closest?.('.ant-picker, .ant-select, .ant-input-number')) return;
      selectingRef.current = true;
      setActiveCell({ r, c, subKey });
      setSelectedRange({ start: { r, c, subKey }, end: { r, c, subKey } });
      focusClipboardWithoutScroll();
      e.preventDefault();
    }, [editingCell, isResizing, focusClipboardWithoutScroll]);

    const handleCellMouseEnter = useCallback((e, r, c, subKey = null) => {
      if (!selectingRef.current) return;
      if (e && typeof e.buttons === 'number' && (e.buttons & 1) !== 1) {
        selectingRef.current = false;
        return;
      }
      setSelectedRange((prev) => prev ? { ...prev, end: { r, c, subKey: subKey || prev.end.subKey || null } } : prev);
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
      const slots = getClipboardSlotsForRange(rect.c1, rect.c2, rect);
      if (!slots.length) return;
      const lines = [];
      for (let r = rect.r1; r <= rect.r2; r++) {
        const row = pagedData[r];
        const cells = [];
        slots.forEach((slot) => {
          if (!row || !slot.col) {
            cells.push('');
          } else if (slot.type === 'keyword') {
            cells.push(getKeywordClipboardValue(slot.col, row, slot.sub));
          } else if (slot.type === 'rich') {
            cells.push(getClipboardValue(slot.col, row));
          } else {
            cells.push(getClipboardValue(slot.col, row));
          }
        });
        lines.push(cells.join('\t'));
      }
      e.clipboardData.setData('text/plain', lines.join('\n'));
      e.preventDefault();
      ctx.message.success('已复制选区');
    }, [getClipboardSlotsForRange, getClipboardValue, getKeywordClipboardValue, normalizeSelection, pagedData, selectedRange]);

    const runPostEditRecalcs = useCallback(async (dailyFormulaRows, recalcRows, options = {}) => {
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
      const dailyRows = [...(dailyFormulaRows || [])];
      const keywordRows = [...(recalcRows || [])];
      const totalRows = dailyRows.length + keywordRows.length;
      let doneRows = 0;
      const reportProgress = (label) => {
        if (!onProgress || !totalRows) return;
        doneRows += 1;
        onProgress({ label, percent: Math.min(95, 10 + (doneRows / totalRows) * 85) });
      };

      for (const rowId of dailyRows) {
        const dailyUpdates = await recalcDailyPriceFormulas(ctx, rowId);
        if (dailyUpdates) {
          setData((prev) => prev.map((row) => (row.country_asin_date || row.id) === rowId ? { ...row, ...dailyUpdates } : row));
        }
        reportProgress('正在同步每日公式...');
      }

      for (const rowId of keywordRows) {
        await recalcKeywordTracking(rowId);
        reportProgress('正在同步推新公式...');
      }
    }, [recalcKeywordTracking]);

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
      const kwOps = [];
      const richOps = [];
      const localPatches = new Map();
      const kwLocalPatches = [];
      const recalcRows = new Set();
      const dailyFormulaRows = new Set();
      const allSlots = getClipboardSlots(visibleCols);
      const startSlotIndex = allSlots.findIndex((slot) => (
        slot.colIndex === rect.c1 &&
        (!rect.startSubKey || (slot.type === 'keyword' && slot.sub.key === rect.startSubKey))
      ));
      const isSingleValuePaste = matrix.length === 1 && matrix[0].length === 1;

      if (!isSingleValuePaste && startSlotIndex < 0) {
        ctx.message.warning('粘贴起点无效');
        return;
      }

      const targetRows = isSingleValuePaste
        ? Array.from({ length: rect.r2 - rect.r1 + 1 }, () => matrix[0])
        : matrix;
      const targetSlots = isSingleValuePaste ? getClipboardSlotsForRange(rect.c1, rect.c2, rect) : null;
      if (isSingleValuePaste && !targetSlots.length) {
        ctx.message.warning('\u7c98\u8d34\u8d77\u70b9\u65e0\u6548');
        return;
      }

      targetRows.forEach((line, rr) => {
        const slotsForLine = isSingleValuePaste
          ? targetSlots
          : line.map((_, cc) => allSlots[startSlotIndex + cc]);
        slotsForLine.forEach((slot, cc) => {
          const cellText = isSingleValuePaste ? matrix[0][0] : line[cc];
          const row = pagedData[rect.r1 + rr];
          const col = slot?.col;
          if (!row || !slot || !col) return;
          if (row._isWeeklySummary) return;
          const rowId = row.country_asin_date || row.id;

          if (slot.type === 'keyword') {
            const kwData = row[col.field];
            const kw = kwData?.kw;
            const daily = kwData?.daily || {};
            if (!kw?.id || !rowId) return;
            const valueToSave = parseKeywordPastedValue(slot.sub, cellText);
            kwOps.push({
              rowId,
              colField: col.field,
              daily,
              dailyId: daily.id,
              kwId: kw.id,
              date: row.date ? String(row.date).slice(0, 10) : null,
              field: slot.sub.key,
              valueToSave,
            });
            kwLocalPatches.push({ rowId, colField: col.field, field: slot.sub.key, valueToSave });
            if (slot.sub.key === 'est_review_qty' || slot.sub.key === 'actual_review_qty') recalcRows.add(rowId);
            return;
          }

          if (slot.type === 'rich' || isActualKeywordPosColumn(col)) {
            const valueToSave = String(cellText ?? '').trim() || null;
            richOps.push({
              rowId,
              field: 'actual_keyword_position',
              country: row.country || null,
              asin: row.asin || null,
              date: row.date ? String(row.date).slice(0, 10) : null,
              valueToSave,
            });
            localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), actual_keyword_position: valueToSave });
            return;
          }

          if (!isCellEditable(col)) return;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) return;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) return;
          const valueToSave = parsePastedValue(col, cellText);
          ops.push({ rowId, field: col.field, src: col.src, updateConfig, pkValue, valueToSave });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: valueToSave });
          if (col.src === 'daily' && DAILY_PRICE_TRIGGER_FIELDS.has(col.field)) {
            dailyFormulaRows.add(rowId);
          }
          if (
            (col.src === 'keyword_tracking' && KT_TRIGGER_FIELDS.has(col.field)) ||
            (col.src === 'weekly' && WEEKLY_ACTUAL_NATURAL_TRIGGER_FIELDS.has(col.field))
          ) {
            recalcRows.add(rowId);
          }
        });
      });

      if (!ops.length && !kwOps.length && !richOps.length) {
        ctx.message.warning('粘贴区域没有可编辑单元格');
        return;
      }

      try {
        setSaving(true);
        showFormulaProgress({ label: '正在保存数据...', percent: 10 });
        for (const op of ops) {
          await ctx.request({
            url: op.updateConfig.url,
            method: 'post',
            params: { filterByTk: op.pkValue },
            data: { [op.field]: op.valueToSave },
          });
        }
        for (const op of richOps) {
          const filterStr = JSON.stringify({ country_asin_date: { $eq: op.rowId } });
          const existingRes = await ctx.request({
            url: 'daily_keyword_tracking:list',
            method: 'get',
            params: { filter: filterStr, pageSize: 1 },
          });
          const existing = Array.isArray(existingRes?.data?.data) ? existingRes.data.data[0] : null;
          if (existing) {
            await ctx.request({
              url: 'daily_keyword_tracking:update',
              method: 'post',
              params: { filterByTk: op.rowId },
              data: { [op.field]: op.valueToSave },
            });
          } else {
            await ctx.request({
              url: 'daily_keyword_tracking:create',
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
        }
        for (const op of kwOps) {
          const currentDailyId = op.daily.id || op.dailyId;
          if (currentDailyId) {
            await ctx.request({
              url: 'new_eval_words_daily:update',
              method: 'post',
              params: { filterByTk: currentDailyId },
              data: { [op.field]: op.valueToSave },
            });
          } else {
            const res = await ctx.request({
              url: 'new_eval_words_daily:create',
              method: 'post',
              data: withCreateTimestamps({
                country_asin_date: op.rowId,
                eval_word_id: op.kwId,
                date: op.date,
                [op.field]: op.valueToSave,
              }),
            });
            const created = res?.data?.data || {};
            op.daily.id = created.id || op.daily.id || 'new';
          }
          op.daily[op.field] = op.valueToSave;
        }

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          let nextRow = patch ? { ...row, ...patch } : row;
          const rowKwPatches = kwLocalPatches.filter((p) => p.rowId === rowId);
          if (!rowKwPatches.length) return nextRow;
          nextRow = nextRow === row ? { ...row } : nextRow;
          rowKwPatches.forEach((p) => {
            const kwData = nextRow[p.colField];
            if (!kwData) return;
            nextRow[p.colField] = {
              ...kwData,
              daily: {
                ...(kwData.daily || {}),
                [p.field]: p.valueToSave,
              },
            };
          });
          return nextRow;
        }));

        const formulaRows = new Set([...dailyFormulaRows, ...recalcRows]);
        if (formulaRows.size) {
          showFormulaProgress({ label: '正在同步日公式...', percent: 35 });
          await runPostEditRecalcs(dailyFormulaRows, recalcRows, { onProgress: showFormulaProgress });
        }

        const changedRowIds = new Set([
          ...ops.map((op) => op.rowId),
          ...kwOps.map((op) => op.rowId),
          ...richOps.map((op) => op.rowId),
        ].filter(Boolean));
        const changedRows = pagedData.filter((row) => changedRowIds.has(row.country_asin_date || row.id));
        if (changedRows.length) {
          await persistWeeklySummariesForChangedRows(changedRows);
        }

        ctx.message.success(`已粘贴 ${ops.length + kwOps.length + richOps.length} 个单元格`);
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [editingCell, finishFormulaProgress, getClipboardSlots, getClipboardSlotsForRange, isCellEditable, normalizeSelection, pagedData, parseKeywordPastedValue, parsePastedValue, persistWeeklySummariesForChangedRows, resetFormulaProgress, runPostEditRecalcs, saving, selectedRange, showFormulaProgress, visibleCols]);

    const clearSelectedCells = useCallback(async () => {
      if (editingCell || saving) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;
      const slots = getClipboardSlotsForRange(rect.c1, rect.c2, rect);
      if (!slots.length) return;

      const ops = [];
      const kwOps = [];
      const richOps = [];
      const localPatches = new Map();
      const kwLocalPatches = [];
      const recalcRows = new Set();
      const dailyFormulaRows = new Set();

      for (let r = rect.r1; r <= rect.r2; r += 1) {
        const row = pagedData[r];
        if (!row) continue;
        if (row._isWeeklySummary) continue;
        const rowId = row.country_asin_date || row.id;
        slots.forEach((slot) => {
          const col = slot?.col;
          if (!rowId || !slot || !col) return;

          if (slot.type === 'rich' || isActualKeywordPosColumn(col)) {
            richOps.push({ rowId, field: 'actual_keyword_position', valueToSave: null });
            localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), actual_keyword_position: null });
            return;
          }

          if (slot.type === 'keyword') {
            const kwData = row[col.field];
            const daily = kwData?.daily || {};
            if (!daily.id) return;
            kwOps.push({
              rowId,
              colField: col.field,
              daily,
              dailyId: daily.id,
              field: slot.sub.key,
              valueToSave: null,
            });
            kwLocalPatches.push({ rowId, colField: col.field, field: slot.sub.key, valueToSave: null });
            if (slot.sub.key === 'est_review_qty' || slot.sub.key === 'actual_review_qty') recalcRows.add(rowId);
            return;
          }

          if (!isCellEditable(col)) return;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) return;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) return;
          ops.push({ rowId, field: col.field, src: col.src, updateConfig, pkValue, valueToSave: null });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: null });
          if (col.src === 'daily' && DAILY_PRICE_TRIGGER_FIELDS.has(col.field)) {
            dailyFormulaRows.add(rowId);
          }
          if (
            (col.src === 'keyword_tracking' && KT_TRIGGER_FIELDS.has(col.field)) ||
            (col.src === 'weekly' && WEEKLY_ACTUAL_NATURAL_TRIGGER_FIELDS.has(col.field))
          ) {
            recalcRows.add(rowId);
          }
        });
      }

      if (!ops.length && !kwOps.length && !richOps.length) {
        ctx.message.warning('\u9009\u533a\u6ca1\u6709\u53ef\u5220\u9664\u7684\u53ef\u7f16\u8f91\u5355\u5143\u683c');
        return;
      }

      try {
        setSaving(true);
        showFormulaProgress({ label: '正在保存数据...', percent: 10 });
        for (const op of ops) {
          await ctx.request({
            url: op.updateConfig.url,
            method: 'post',
            params: { filterByTk: op.pkValue },
            data: { [op.field]: op.valueToSave },
          });
        }

        for (const op of richOps) {
          await ctx.request({
            url: 'daily_keyword_tracking:update',
            method: 'post',
            params: { filterByTk: op.rowId },
            data: { [op.field]: op.valueToSave },
          });
        }

        for (const op of kwOps) {
          await ctx.request({
            url: 'new_eval_words_daily:update',
            method: 'post',
            params: { filterByTk: op.dailyId },
            data: { [op.field]: op.valueToSave },
          });
          op.daily[op.field] = op.valueToSave;
        }

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          let nextRow = patch ? { ...row, ...patch } : row;
          const rowKwPatches = kwLocalPatches.filter((p) => p.rowId === rowId);
          if (!rowKwPatches.length) return nextRow;
          nextRow = nextRow === row ? { ...row } : nextRow;
          rowKwPatches.forEach((p) => {
            const kwData = nextRow[p.colField];
            if (!kwData) return;
            nextRow[p.colField] = {
              ...kwData,
              daily: {
                ...(kwData.daily || {}),
                [p.field]: p.valueToSave,
              },
            };
          });
          return nextRow;
        }));

        const formulaRows = new Set([...dailyFormulaRows, ...recalcRows]);
        if (formulaRows.size) {
          showFormulaProgress({ label: '正在同步日公式...', percent: 35 });
          await runPostEditRecalcs(dailyFormulaRows, recalcRows, { onProgress: showFormulaProgress });
        }
        const changedRowIds = new Set([
          ...ops.map((op) => op.rowId),
          ...kwOps.map((op) => op.rowId),
          ...richOps.map((op) => op.rowId),
        ].filter(Boolean));
        const changedRows = pagedData.filter((row) => changedRowIds.has(row.country_asin_date || row.id));
        if (changedRows.length) {
          await persistWeeklySummariesForChangedRows(changedRows);
        }
        ctx.message.success(`\u5df2\u6e05\u7a7a ${ops.length + kwOps.length + richOps.length} \u4e2a\u5355\u5143\u683c`);
      } catch (err) {
        ctx.message.error(`\u6e05\u7a7a\u5931\u8d25\uff1a${err?.message || '\u672a\u77e5\u9519\u8bef'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [editingCell, finishFormulaProgress, getClipboardSlotsForRange, isCellEditable, normalizeSelection, pagedData, persistWeeklySummariesForChangedRows, resetFormulaProgress, runPostEditRecalcs, saving, selectedRange, showFormulaProgress]);

    const handleSelectionKeyDown = useCallback((e) => {
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
      const row = data.find((r) => (r.country_asin_date || r.id) === rowId);
      if (row?._isWeeklySummary) return;
      selectingRef.current = false;
      setSelectedRange(null);
      setEditingCell({ rowId, colKey: col.key, field: col.field, src: col.src });
      if (col.field === 'promo_day') setEditValue(currentValue != null ? currentValue : 0);
      else if (RATE_FIELDS.has(col.field)) {
        if (currentValue != null && currentValue !== '') {          setEditValue(Number(currentValue) * 100);
        } else {
          setEditValue('');
        }
      } else {
        setEditValue(currentValue != null && currentValue !== '' ? currentValue : '');
      }
    }, [data, saving]);

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
      if (field === 'promo_day') valueToSave = editValue;
      else if (RATE_FIELDS.has(field)) {
        if (editValue === '' || editValue === null || editValue === undefined) {
          valueToSave = null;
        } else {
          const num = Number(editValue);
          valueToSave = !isNaN(num) ? num / 100 : null;
        }
      }
      else if (MONEY_FIELDS.has(field) || NUM_FIELDS.has(field)) {
        valueToSave = (editValue !== '' && editValue !== null && editValue !== undefined) ? Number(editValue) : null;
      }
      else if (DATE_FIELDS.has(field)) {
        valueToSave = editValue || null;
      }
      else {
        valueToSave = editValue || null;
      }

      try {
        setSaving(true);
        showFormulaProgress({ label: '正在保存数据...', percent: 10 });
        await ctx.request({ url: updateConfig.url, method: 'post', params: { filterByTk: pkValue }, data: { [field]: valueToSave } });
        setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [field]: valueToSave } : r));
        ctx.message.success('保存成功');
        if (src === 'daily' && DAILY_PRICE_TRIGGER_FIELDS.has(field)) {
          try {
            showFormulaProgress({ label: '正在同步日公式...', percent: 35 });
            const dailyUpdates = await recalcDailyPriceFormulas(ctx, rowId);
            if (dailyUpdates) {
              setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, ...dailyUpdates } : r));
            }
          } catch (e) {
            ctx.message.warning(`LP/WP/TP 公式重算失败：${e?.message || ''}`);
          }
        }
        const shouldRecalcKeywordTracking =
          (src === 'keyword_tracking' && KT_TRIGGER_FIELDS.has(field)) ||
          (src === 'weekly' && WEEKLY_ACTUAL_NATURAL_TRIGGER_FIELDS.has(field));

        if (shouldRecalcKeywordTracking) {
          try {
            showFormulaProgress({ label: '正在同步日公式...', percent: 35 });
            await recalcKeywordTracking(rowId);
          } catch (e) {
            ctx.message.warning(`自动计算失败：${e?.message || ''}`);
          }
        }
        await persistWeeklySummariesForChangedRows([{ ...row, [field]: valueToSave }]);
        setEditingCell(null); setEditValue(null);
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setSaving(false); }
    }, [editingCell, editValue, data, saving, recalcKeywordTracking, persistWeeklySummariesForChangedRows]);

    const refreshData  = useCallback(async () => {
      if (refreshingData || calcAllLoading || loading) return;
      try {
        setRefreshingData(true);
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true, skipBackgroundSummary: true, skipCurrentPageSummaryRefresh: true });
        setRefreshProgress('正在读取当前 ASIN / 国家全部日期...');
        showFormulaProgress({ label: '正在读取当前 ASIN / 国家全部日期...', percent: 12 });
        let formulaRows = await loadFormulaRowsForCurrentCountryAsin();
        let ok = true;
        if (!Array.isArray(formulaRows) || formulaRows.length === 0) {
          ok = true;
        } else {
          let progressPercent = 15;
          ok = await recalcAllFormulas(formulaRows, {
            allowNonAdmin: true,
            silentSuccess: true,
            onProgress: (progress) => {
              const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
              progressPercent = Math.min(75, progressPercent + 10);
              setRefreshProgress(label);
              showFormulaProgress(typeof progress === 'object' && progress !== null ? progress : { label, percent: progressPercent });
            },
          });
        }
        formulaRows = await loadFormulaRowsForCurrentCountryAsin(true);
        if (Array.isArray(formulaRows) && formulaRows.length) {
          setRefreshProgress('正在刷新全量周汇总...');
          showFormulaProgress({ label: '正在刷新全量周汇总...', percent: 82 });
          await recalcAndPersistWeeklySummariesForRows(formulaRows);
          showFormulaProgress({ label: '正在读取最新周汇总...', percent: 94 });
          await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true, skipBackgroundSummary: true, skipCurrentPageSummaryRefresh: true });
        }
        ctx.message[ok ? 'success' : 'warning'](ok ? '数据和周汇总已刷新' : '数据已刷新，公式计算失败');
        finishFormulaProgress(ok ? '刷新完成' : '刷新完成，公式失败');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.error(`刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshingData(false);
        setRefreshProgress('');
      }
    }, [calcAllLoading, finishFormulaProgress, loadData, loadFormulaRowsForCurrentCountryAsin, loading, recalcAllFormulas, recalcAndPersistWeeklySummariesForRows, refreshingData, resetFormulaProgress, showFormulaProgress]);
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

    const renderEditInput = (col) => {
      if (col.field === 'promo_day') return React.createElement(Select, { ref: inputRef, value: editValue, options: PROMO_DAY_OPTIONS, style: { width: '100%' }, size: 'small', onChange: (v) => setEditValue(v), onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); } });
      const commonProps = { ref: inputRef, value: editValue, onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); }, style: { width: '100%', textAlign: 'center' }, size: 'small' };
      if (RATE_FIELDS.has(col.field)) {
        return React.createElement(InputNumber, {
          ...commonProps,
          value: (editValue === '' || editValue === null || editValue === undefined) ? null : Number(editValue),
          onChange: (v) => {
            if (v === null || v === undefined) {
              setEditValue('');
            } else {
              setEditValue(v);
            }
          },
          onPressEnter: () => saveEdit(),
          min: 0,
          step: 1,
          precision: 2,
          addonAfter: '%',
          placeholder: '请输入百分比'
        });
      }
      if (MONEY_FIELDS.has(col.field)) return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 0.01, precision: 2 });
      if (NUM_FIELDS.has(col.field))   return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 1 });
      if (DATE_FIELDS.has(col.field))  return React.createElement(DatePicker,  { ...commonProps, locale: DATE_PICKER_LOCALE, value: editValue ? ctx.libs.dayjs(editValue) : null, onChange: (date) => setEditValue(date ? date.format('YYYY-MM-DD') : '') });
      return React.createElement(Input, { ...commonProps, onChange: (e) => setEditValue(e.target.value), onPressEnter: () => saveEdit() });
    };

    const renderColRow = (col) => {
      const currentColor = getColHeaderColor(col);
      const srcDefault   = SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;
      const isCustom     = !!col.headerColor;
      const isToolCol    = col.src === 'tool';
      const isReadonly   = READONLY_FIELDS.has(col.field);
      const isImportantColumn = getColBodyColor(col) === IMPORTANT_COLUMN_BODY_COLOR;

      return React.createElement('div', {
        key: col.key,
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '3px 0 3px 12px',
          borderBottom: '1px solid #fafafa'
        }
      },

        !isToolCol && React.createElement('div', {
          onClick: () => canModifyActiveColumnView ? togglePin(col.key) : warnReadonlyDefaultView(),
          style: {
            width: '22px',
            textAlign: 'center',
            flexShrink: 0,
            cursor: canModifyActiveColumnView ? 'pointer' : 'not-allowed',
            fontSize: `${FONT_SIZE_SM}px`,
            opacity: col.pinned ? 1 : (canModifyActiveColumnView ? 0.2 : 0.12),
            userSelect: 'none'
          }
        }, '📌'),

        isToolCol && React.createElement('div', {
          style: { width: '22px', flexShrink: 0 }
        }),

        React.createElement('input', {
          type: 'checkbox',
          checked: !col.hidden,
          disabled: !canModifyActiveColumnView,
          onChange: () => canModifyActiveColumnView ? toggleCol(col.key) : warnReadonlyDefaultView(),
          style: { flexShrink: 0, cursor: canModifyActiveColumnView ? 'pointer' : 'not-allowed' }
        }),

        React.createElement('span', {
          style: {
            flex: 1,
            fontSize: `${FONT_SIZE_SM}px`,
            color: col.hidden ? '#ccc' : '#333',
            userSelect: 'none'
          }
        }, col.label),

        !isToolCol && React.createElement('label', {
          title: '将该列数据区标记为重要指标，列头不变',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: `${FONT_SIZE_XS}px`,
            color: '#666',
            cursor: canModifyActiveColumnView ? 'pointer' : 'not-allowed',
            flexShrink: 0,
            marginRight: '4px',
            userSelect: 'none'
          }
        },
          React.createElement('input', {
            type: 'checkbox',
            checked: isImportantColumn,
            disabled: !canModifyActiveColumnView,
            onChange: () => canModifyActiveColumnView ? toggleImportantColumn(col.key) : warnReadonlyDefaultView(),
            style: {
              cursor: canModifyActiveColumnView ? 'pointer' : 'not-allowed'
            }
          }),
          React.createElement('span', {
            style: {
              display: 'inline-block',
              width: '12px',
              height: '12px',
              background: IMPORTANT_COLUMN_BODY_COLOR,
              border: '1px solid #9ab98c',
              borderRadius: '2px',
              boxSizing: 'border-box'
            }
          }),
          '重要指标'
        ),

        IS_ADMIN && !isToolCol && React.createElement('label', {
          title: isReadonly ? '该字段为系统只读字段，不能开启编辑' : '允许在表格中双击编辑该列',
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
            fontSize: `${FONT_SIZE_XS}px`,
            color: isReadonly ? '#bbb' : '#666',
            cursor: isReadonly ? 'not-allowed' : 'pointer',
            flexShrink: 0,
            marginRight: '4px',
            userSelect: 'none'
          }
        },
          React.createElement('input', {
            type: 'checkbox',
            checked: col.editable === true,
            disabled: isReadonly,
            onChange: () => {
              if (!isReadonly) {
                toggleEditable(col.key);
              }
            },
            style: {
              cursor: isReadonly ? 'not-allowed' : 'pointer'
            }
          }),
          '编辑'
        ),

        IS_ADMIN && !isToolCol && React.createElement('div', {
          style: {
            display: 'flex',
            gap: '3px',
            alignItems: 'center'
          }
        },
          PRESET_COLORS.map((pc) =>
            React.createElement('div', {
              key: pc.value,
              title: pc.label,
              onClick: () => setHColor(col.key, pc.value),
              style: {
                width: '14px',
                height: '14px',
                borderRadius: '2px',
                cursor: 'pointer',
                flexShrink: 0,
                background: pc.value,
                border: currentColor === pc.value ? '2px solid #333' : '2px solid transparent',
                boxSizing: 'border-box'
              }
            })
          ),

          isCustom && React.createElement('div', {
            title: '重置为默认色',
            onClick: () => clearHColor(col.key),
            style: {
              width: '14px',
              height: '14px',
              borderRadius: '2px',
              cursor: 'pointer',
              flexShrink: 0,
              background: srcDefault,
              border: '2px dashed #333',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '9px',
              color: '#fff',
              fontWeight: 700,
              lineHeight: 1
            }
          }, '↺')
        )
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
    const canModifyActiveColumnView = true;
    const canSaveDefaultColumnView = IS_ADMIN && isDefaultColumnViewId(activeColumnViewId);
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
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { position: 'fixed', top: `${panelPos.top}px`, left: `${panelPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', width: IS_ADMIN ? '720px' : '640px', maxHeight: '620px', overflowY: 'auto' } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: '#555', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', null, '列设置'),
          canModifyActiveColumnView && React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement('button', { onClick: selectAll,   style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
            React.createElement('button', { onClick: deselectAll, style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
          ),
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', padding: '10px', background: '#f8fafc', border: '1px solid #dbe3ee', borderRadius: '6px' } },
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
        ),
        IS_ADMIN && React.createElement('div', { style: { marginBottom: '10px', padding: '10px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' } },
          React.createElement('div', { style: { marginBottom: '8px', fontSize: `${FONT_SIZE_SM}px`, fontWeight: 800, color: '#334155' } }, '词下字段颜色'),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '8px 12px' } },
            KW_SUB_FIELDS.map((sub) => {
              const currentColor = getKwSubHeaderColor(sub);
              const isCustom = !!kwSubFieldHeaderColors[sub.key];
              return React.createElement('div', { key: sub.key, style: { display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 } },
                React.createElement('span', { style: { width: '72px', flexShrink: 0, fontSize: `${FONT_SIZE_XS}px`, color: '#475569', fontWeight: 700 } }, sub.label),
                React.createElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center', flexWrap: 'wrap' } },
                  PRESET_COLORS.map((pc) =>
                    React.createElement('div', {
                      key: pc.value,
                      title: pc.label,
                      onClick: () => setKwSubHColor(sub.key, pc.value),
                      style: {
                        width: '14px',
                        height: '14px',
                        borderRadius: '2px',
                        cursor: canModifyActiveColumnView ? 'pointer' : 'not-allowed',
                        flexShrink: 0,
                        background: pc.value,
                        border: currentColor === pc.value ? '2px solid #333' : '2px solid transparent',
                        boxSizing: 'border-box',
                        opacity: canModifyActiveColumnView ? 1 : 0.45,
                      },
                    })
                  ),
                  isCustom && React.createElement('div', {
                    title: '重置为默认色',
                    onClick: () => clearKwSubHColor(sub.key),
                    style: {
                      width: '14px',
                      height: '14px',
                      borderRadius: '2px',
                      cursor: canModifyActiveColumnView ? 'pointer' : 'not-allowed',
                      flexShrink: 0,
                      background: DEFAULT_KW_SUB_FIELD_HEADER_COLORS[sub.key] || '#f5f5f5',
                      border: '2px dashed #333',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '9px',
                      color: getTextColorForBg(DEFAULT_KW_SUB_FIELD_HEADER_COLORS[sub.key] || '#f5f5f5'),
                      fontWeight: 700,
                      lineHeight: 1,
                      opacity: canModifyActiveColumnView ? 1 : 0.45,
                    },
                  }, '↺')
                )
              );
            })
          )
        ),
        SRC_GROUP_CONFIG.filter((group) => group.src !== 'tool').map((group) => {
          const groupCols   = allColumns.filter((c) => c.src === group.src);
          if (!groupCols.length) return null;
          const isCollapsed = !!collapsedGroups[group.src];
          const visCount    = groupCols.filter((c) => !c.hidden).length;
          return React.createElement('div', { key: group.src, style: { marginBottom: '6px', border: `1px solid ${group.color}40`, borderRadius: '6px', overflow: 'hidden' } },
            React.createElement('div', { onClick: () => toggleGroup(group.src), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer', userSelect: 'none', background: `${group.color}18`, borderBottom: isCollapsed ? 'none' : `1px solid ${group.color}30` } },
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: group.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' } }, '▼'),
              React.createElement('span', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: group.color, flex: 1 } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              canModifyActiveColumnView && React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); selectGroup(group.src); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全选'),
              canModifyActiveColumnView && React.createElement('button', {
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
      React.createElement(PushPanel, { onClose: () => setShowPush(false), anchorPos: pushPos, onPush: saveCurrentAsDefaultColumns }),
    );

    const tableWidth = visibleCols.reduce((s, c) => s + (c.width || 80), 0);
    const HEADER_MAIN_HEIGHT = 30;
    const HEADER_SUB_HEIGHT = 24;
    const TABLE_BODY_ROW_HEIGHT = 66;
    const TABLE_MIN_VISIBLE_ROWS = 8;
    const TABLE_MAX_VISIBLE_ROWS = 20;
    const tableHeaderHeight = HEADER_MAIN_HEIGHT + (hasKwColumns ? HEADER_SUB_HEIGHT : 0) + 2;
    const tableWrapMinHeight = tableHeaderHeight + TABLE_BODY_ROW_HEIGHT * TABLE_MIN_VISIBLE_ROWS;
    const tableWrapMaxHeight = tableHeaderHeight + TABLE_BODY_ROW_HEIGHT * TABLE_MAX_VISIBLE_ROWS;
    const tableWrapHeight = `clamp(${tableWrapMinHeight}px, calc(100dvh - 395px), ${tableWrapMaxHeight}px)`;
    const getSourceFieldName = (col) => {
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      return sourceCollection ? `${sourceCollection}.${col.field}` : col.field;
    };
    const getHeaderTooltipData = (col) => {
      if (col.field === 'target_cvr') return { ...TARGET_CVR_NOTE_TOOLTIP, hideEmptyRules: false };
      if (FORMULA_TOOLTIPS[col.field]) return { ...FORMULA_TOOLTIPS[col.field], hideEmptyRules: false };
      if (col.src === 'weekly' && WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT[col.field]) {
        const weeklyTooltipLines = WEEKLY_PERFORMANCE_FIELD_TOOLTIP_TEXT[col.field].split('\n');
        return {
          title: col.label,
          formula: weeklyTooltipLines[0] || '直接展示该指标值',
          hideEmptyRules: true,
          fields: [
            { label: '字段标识公式', field: weeklyTooltipLines[1] || `${col.field} = 直接展示该指标值` },
            { label: `字段来源（${col.label}）`, field: `weekly_performance.${col.field}` },
          ],
          writeBackField: `weekly_performance.${col.field}`,
        };
      }
      if (col.src === 'daily' && DAILY_SQL_UPDATED_FIELDS.has(col.field)) {
        return {
          title: col.label,
          formula: DAILY_SQL_UPDATED_FIELD_TEXT[col.field],
          hideEmptyRules: true,
          sourceInfos: DAILY_SQL_UPDATED_FIELD_SOURCE[col.field],
          hideFieldMapping: true,
          fields: [],
          writeBackField: '',
        };
      }
      if (col._isKwColumn) {
        return {
          title: col.label,
          formula: `展示关键词「${col._kwName || col.label || '未命名'}」的预计刷单、实际刷单、预测词位、实际词位、复盘和新计划`,
          emptyRules: ['未配置该关键词时为空', '当天没有关键词明细记录时为空', '对应子字段为空时显示为空'],
          hideEmptyRules: true,
          fields: [
            { label: '预计刷单', field: 'new_eval_words_daily.est_review_qty' },
            { label: '预测词位', field: 'new_eval_words_daily.est_rank' },
            { label: '实际刷单', field: 'new_eval_words_daily.actual_review_qty' },
            { label: '实际词位', field: 'new_eval_words_daily.actual_rank' },
            { label: '复盘', field: 'new_eval_words_daily.review_notes' },
            { label: '新计划', field: 'new_eval_words_daily.new_plan' },
          ],
          writeBackField: 'new_eval_words_daily.*',
        };
      }
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      const sourceField = getSourceFieldName(col);
      return {
        title: col.label,
        formula: '直接展示来源字段的值',
        emptyRules: ['来源字段为空时显示为空'],
        hideEmptyRules: true,
        fields: sourceCollection ? [{ label: col.label, field: sourceField }] : [],
        writeBackField: sourceCollection ? sourceField : '无',
      };
    };
    const getKwSubTooltipData = (sub) => ({
      title: sub.label,
      formula: `展示当前关键词当天的${sub.label}`,
      emptyRules: ['未配置该关键词时为空', '当天没有关键词明细记录时为空', `${sub.label}字段为空时显示为空`],
      hideEmptyRules: true,
      fields: [
        { label: sub.label, field: `new_eval_words_daily.${sub.key}` },
      ],
      writeBackField: `new_eval_words_daily.${sub.key}`,
    });
    const renderTooltipFormula = (formula) => {
      const lines = Array.isArray(formula)
        ? (formula.length ? formula : ['直接展示该指标值'])
        : String(formula || '直接展示该指标值').split(/\r?\n/);
      return React.createElement('div', { style: { marginBottom: '6px' } }, lines.map((line, idx) =>
        React.createElement('div', {
          key: `formula_${idx}`,
          style: { marginTop: idx === 0 ? 0 : '4px' },
        }, line)
      ));
    };
    const renderTooltip = ({ title, formula, emptyTitle = '为空情况：', emptyRules = [], fields = [], writeBackField, hideEmptyRules = false, hideFieldMapping = false, sourceInfos = [] }) => React.createElement('div', {
      style: {
        maxWidth: '360px',
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'inherit',
      },
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '6px' } }, title),
      renderTooltipFormula(formula),
      !hideEmptyRules && React.createElement('div', { style: { marginBottom: '2px' } }, emptyTitle),
      !hideEmptyRules && React.createElement('ul', { style: { margin: '0 0 10px 18px', padding: 0 } },
        (emptyRules.length ? emptyRules : ['无特殊为空情况']).map((rule, idx) =>
          React.createElement('li', { key: `empty_${idx}` }, rule)
        )
      ),
      IS_ADMIN && React.createElement('hr', { style: { border: 0, borderTop: '1px solid rgba(255,255,255,0.22)', margin: '8px 0' } }),
      IS_ADMIN && React.createElement('div', { style: { fontSize: '12px', opacity: 0.75, lineHeight: 1.55 } },
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
            React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, source.workflow)
          ),
          source.schedule && React.createElement('div', null, `执行时间：${source.schedule}`),
          source.scope && React.createElement('div', null, `适用站点：${source.scope}`),
          React.createElement('div', null,
            React.createElement('span', null, 'SQL 节点：'),
            React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, source.node)
          )
        )),
        !hideFieldMapping && (fields.length ? fields : [{ label: '字段', field: '无' }]).map((item, idx) => React.createElement('div', { key: `field_${idx}` },
          React.createElement('span', null, `${item.label}：`),
          React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, item.field)
        )),
        !hideFieldMapping && React.createElement('div', { style: { marginTop: '4px' } },
          React.createElement('span', null, '写回字段：'),
          React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, writeBackField || '无')
        )
      )
    );
    const renderHeaderText = (label) => {
      if (label === '整体关键词位实际') {
        return React.createElement(React.Fragment, null,
          '整体关键词位',
          React.createElement('span', { style: { color: '#ff4d4f' } }, '实际')
        );
      }
      return label;
    };
    const renderHeaderLabel = (label, tooltipData, style = {}) => React.createElement(Tooltip, {
      title: tooltipData ? renderTooltip(tooltipData) : label,
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
    }, renderHeaderText(label)));

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
          React.createElement('span', { style: { color: '#4d7f78', fontWeight: 600 } }, `${item.label}：`),
          React.createElement('span', null, item.value)
        )
      )
    );
    const actionBusy = loading || refreshingData || calcAllLoading;
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
      const label = index === 0 ? '默认自动取，也可手动复核' : pc.label;
      return React.createElement('div', {
        key: pc.value,
        style: { display: 'flex', alignItems: 'center', gap: '2px' },
      },
        React.createElement('div', { style: { width: '10px', height: '10px', borderRadius: '2px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
        React.createElement('span', { style: { color: '#666' } }, label)
      );
    };

    return React.createElement('div', { ref: rootRef, style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),


      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', columnGap: '14px', rowGap: '6px', flexWrap: 'wrap', marginBottom: '4px' },
      },
        headerInfoEl,

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
      )
      ),

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
          React.createElement('button', { ref: panelBtnRef, onClick: () => { setShowPanel((v) => !v); setShowPush(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '👁️ 列设置'),
          IS_ADMIN && React.createElement('button', { ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '📤 推送配置'),
          React.createElement('button', {
          ref: crossHighlightBtnRef,
          onClick: () => { setShowCrossHighlightPanel((v) => !v); setShowPanel(false); setShowPush(false); },
          style: btnStyle('#EB6793', '#fff', '#d84f7c'),
        }, crossHighlightEnabled ? '高亮行列：开' : '高亮行列'),
          kwMasterBtnVisible && React.createElement('button', { onClick: () => setKwMasterVisible(true), style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '🔑 管理关键词'),
          React.createElement('button', {
          onClick: () => setShowKwOptionalFields((v) => !v),
          style: {
            ...btnStyle(
              showKwOptionalFields ? '#f9f0ff' : '#fff0f6',
              showKwOptionalFields ? '#722ed1' : '#c41d7f',
              showKwOptionalFields ? '#722ed1' : '#c41d7f'
            ),
            fontWeight: 600,
            boxShadow: showKwOptionalFields
              ? '0 0 0 2px rgba(114, 46, 209, 0.12), 0 1px 2px rgba(15,23,42,0.08)'
              : '0 1px 2px rgba(15,23,42,0.08), inset 0 1px 0 rgba(255,255,255,0.24)'
          }
        }, showKwOptionalFields ? '📝 隐藏复盘/计划' : '📝 显示复盘/计划')
        )
      ,

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
        )),

            panelEl,
      pushPanelEl,
      crossHighlightPanelEl,

      React.createElement('textarea', {
        ref: clipboardRef,
        value: '',
        onChange: () => {},
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleSelectionKeyDown,
        tabIndex: -1,
        'aria-hidden': true,
        style: {
          position: 'fixed',
          left: '-1000px',
          top: '-1000px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none',
        }
      }),

      React.createElement(KeywordMasterDrawer, {
        visible: kwMasterVisible,
        onClose: () => setKwMasterVisible(false),
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
        onKeyDown: handleSelectionKeyDown,
        onMouseUp: stopSelecting,
        onMouseLeave: stopSelecting,
        style: {
          overflowX: 'auto',
          overflowY: 'auto',
          height: tableWrapHeight,
          borderRadius: '8px',
          border: '1px solid #d9d9d9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          background: '#fff',
          outline: 'none'
        } },
        !hasRequiredUrlParams
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据 请重新进入页面')
          : loading && data.length === 0
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '正在加载数据...')
          : data.length === 0
            ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据')
            : React.createElement('table', { style: { borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', background: '#fff', width: `${tableWidth}px` } },
              React.createElement('thead', null,
                // 第一行表头（主标题）：关键词列会 rowSpan=1，其它列 rowSpan=2
                React.createElement('tr', null,
                  visibleCols.map((col) => {
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const hdrColor = getColHeaderColor(col);
                    const formulaTooltip = col.field === 'target_cvr' ? TARGET_CVR_NOTE_TOOLTIP : (FORMULA_TOOLTIPS[col.field] || null);
                    const headerTooltip = getHeaderTooltipData(col);
                    const isKwCol = !!col._isKwColumn;

                    return React.createElement('th', {
                      key: col.key,
                      rowSpan: isKwCol ? 1 : (hasKwColumns ? 2 : 1),
                      draggable: true,
                      onDragStart: (e) => onDragStart(e, col.key),
                      onDragOver,
                      onDrop: (e) => onDrop(e, col.key),
                      onClick: () => handleSort(col.key),
                      style: {
                        position: 'sticky',
                        top: 0,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${col.width || 80}px`,
                        height: isKwCol ? `${HEADER_MAIN_HEIGHT}px` : undefined,
                        padding: isKwCol ? '2px 6px' : '5px 6px',
                        lineHeight: '18px',
                        background: hdrColor,
                        color: getTextColorForBg(hdrColor),
                        borderBottom: isKwCol ? '1px solid rgba(0,0,0,0.08)' : '2px solid rgba(0,0,0,0.12)',
                        borderRight: '1px solid rgba(0,0,0,0.15)',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: isKwCol ? `${FONT_SIZE_XS}px` : `${FONT_SIZE_SM}px`,
                        userSelect: 'none',
                        cursor: 'grab',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        verticalAlign: 'middle'
                      },
                    },
                      React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '100%', overflow: 'hidden', verticalAlign: 'middle' } },
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
                        !isKwCol && React.createElement('span', { style: { display: sortConfig.key === col.key ? 'inline-block' : 'none', marginLeft: '2px', opacity: 0.85, fontSize: `${FONT_SIZE_XS}px`, flexShrink: 0, lineHeight: 1 } }, sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : ''),
                      ),
                      React.createElement('div', { draggable: false, onMouseDown: (e) => onResizeStart(e, col.key), onClick: (e) => e.stopPropagation(), onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); }, style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 2, background: 'transparent' } }),
                    );
                  })
                ),
                // 第二行表头：只有关键词列需要显示子字段标签
                hasKwColumns && React.createElement('tr', null,
                  visibleCols.map((col) => {
                    if (!col._isKwColumn) return null;
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const hdrColor = getColHeaderColor(col);
                    
                    const kwSubFields = getKwSubFieldsForWidth(col.width, showKwOptionalFields);
                    return React.createElement('th', {
                      key: `${col.key}_sub`,
                      style: {
                        position: 'sticky',
                        top: `${HEADER_MAIN_HEIGHT}px`,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${col.width}px`,
                        height: `${HEADER_SUB_HEIGHT}px`,
                        padding: 0,
                        background: hdrColor,
                        borderBottom: '2px solid rgba(0,0,0,0.12)',
                        borderRight: '1px solid rgba(0,0,0,0.15)',
                        boxSizing: 'border-box',
                      }
                    },
                      React.createElement('div', {
                        style: {
                          display: 'flex',
                          width: '100%',
                          height: `${HEADER_SUB_HEIGHT}px`,
                          boxSizing: 'border-box',
                          gap: '4px',
                          padding: '2px 4px',
                          alignItems: 'center',
                        }
                      },
                        kwSubFields.map(sub => {
                          const subColor = getKwSubHeaderColor(sub);
                          const subTextColor = getTextColorForBg(subColor);
                          return React.createElement('div', {
                            key: sub.key,
                            style: {
                              flex: `0 0 ${sub.width}px`,
                              maxWidth: `${sub.width}px`,
                              minWidth: 0,
                              textAlign: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: subTextColor,
                              padding: '2px 2px',
                              lineHeight: '16px',
                              background: subColor,
                              border: '1px solid rgba(0,0,0,0.10)',
                              borderRadius: '3px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              boxSizing: 'border-box',
                            }
                          }, renderHeaderLabel(sub.label, getKwSubTooltipData(sub), {
                            fontSize: '11px',
                            fontWeight: 700,
                            color: subTextColor,
                          }));
                        })
                      )
                    );
                  })
                )
              ),
              React.createElement('tbody', null,
                pagedData.map((row, rIdx) => {
                  const rowId = row.country_asin_date || row.id;
                  const isWeeklySummaryRow = !!row._isWeeklySummary;
                  const summaryBg = '#d6eaff';
                  return React.createElement('tr', { key: rowId || rIdx, style: { background: isWeeklySummaryRow ? summaryBg : (rIdx % 2 === 0 ? '#fff' : '#fafafa'), fontWeight: isWeeklySummaryRow ? 700 : undefined } },
                    visibleCols.map((col) => {
                      const isPinned  = col.pinned;
                      const leftOff   = isPinned ? pinnedLeftMap[col.key] : undefined;
                      const dynFn     = DYNAMIC_COLOR[col.field] || DYNAMIC_COLOR[col.key];
                      const cellColor = dynFn ? dynFn(row) : null;
                      const isNum     = ALL_NUMERIC.has(col.field) || col.field === 'promo_day';
                      const canEdit   = !isWeeklySummaryRow && isCellEditable(col);
                      const isEditing = editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key;
                      const cIdx      = visibleCols.findIndex((c) => c.key === col.key);
                      const selected  = isCellSelected(rIdx, cIdx);
                      const bodyCellBackground = getBodyCellBackground(rIdx, cIdx, selected, col);
                      const cellBackground = isWeeklySummaryRow ? summaryBg : bodyCellBackground;

                      // 动态词列渲染（单行 6 字段紧凑排列）
                      if (col.field && col.field.startsWith('kw_dynamic_')) {
                        return React.createElement('td', {
                          key: col.key,
                          style: {
                            position: isPinned ? 'sticky' : undefined,
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 1 : undefined,
                            background: cellBackground,
                            padding: '2px',
                            borderBottom: '1px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                            width: `${col.width}px`,
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined,
                          }
                        }, React.createElement(KeywordCell, {
                          data: row[col.field],
                          countryAsinDate: rowId,
                          date: row.date ? String(row.date).slice(0, 10) : null,
                          role: col._kwRole || '主推',
                          onSaved: async (savedRowId) => {
                            await recalcKeywordTracking(savedRowId);
                            await persistWeeklySummariesForChangedRows([row]);
                          },
                          onProgress: showFormulaProgress,
                          colWidth: col.width,
                          showOptionalFields: showKwOptionalFields,
                          readOnly: isWeeklySummaryRow,
                          cellBackground,
                          onSubMouseDown: (e, subKey) => handleCellMouseDown(e, rIdx, cIdx, subKey),
                          onSubMouseEnter: (e, subKey) => handleCellMouseEnter(e, rIdx, cIdx, subKey),
                          isSubSelected: (subKey) => isKeywordSubSelected(rIdx, cIdx, subKey)
                        }));
                      }

                      if (isActualKeywordPosColumn(col)) {
                        const richCellKey = `${rowId || rIdx}__${col.key}`;
                        const openRichEditorFromCell = (e) => {
                          if (isWeeklySummaryRow || e.target?.closest?.('[data-rich-editor-panel="1"]')) return;
                          e.preventDefault();
                          e.stopPropagation();
                          selectingRef.current = false;
                          setSelectedRange(null);
                          const rect = e.currentTarget.getBoundingClientRect();
                          setRichEditOpenSignal({
                            cellKey: richCellKey,
                            tick: Date.now(),
                            rect: { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height },
                          });
                        };
                        return React.createElement('td', {
                          key: col.key,
                          onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                          onDoubleClickCapture: openRichEditorFromCell,
                          onMouseEnter: (e) => handleCellMouseEnter(e, rIdx, cIdx),
                          style: {
                            position: isPinned ? 'sticky' : undefined,
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 1 : undefined,
                            background: cellBackground,
                            padding: '2px',
                            borderBottom: '1px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            verticalAlign: 'middle',
                            textAlign: 'center',
                            boxSizing: 'border-box',
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined
                          }
                        },
                          React.createElement(ActualKeywordPosCell, {
                            rowId: rowId,
                            country: row.country || null,
                            asin: row.asin || null,
                            date: row.date ? String(row.date).slice(0, 10) : null,
                            screenshot: row.actual_keyword_position,
                            onSaved: recalcKeywordTracking,
                            readOnly: isWeeklySummaryRow,
                            cellBackground,
                            cellKey: richCellKey,
                            openSignal: richEditOpenSignal
                          })
                        );
                      }

                      const displayContent = formatCell(col, row);

                      const pinnedBorderStyle = isPinned ? {
                        borderRight: '2px solid rgba(0,0,0,0.18)',
                        boxShadow: '1px 0 0 rgba(0,0,0,0.05)'
                      } : {};

                      return React.createElement('td', {
                        key: col.key, title: typeof displayContent === 'string' ? displayContent : undefined,
                        onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                        onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, row[col.field]); },
                        style: {
                          position: isPinned ? 'sticky' : undefined,
                          left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 1 : undefined,
                          background: cellBackground,
                          padding: isEditing ? '3px 5px' : '5px 8px',
                          borderBottom: '1px solid #e8e8e8',
                          borderRight: '1px solid #e8e8e8',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                          color: cellColor || '#1a1a1a',
                          fontWeight: isWeeklySummaryRow ? 700 : (cellColor ? 600 : 500),
                          fontSize: `${FONT_SIZE}px`,
                          boxSizing: 'border-box',
                          cursor: canEdit && !isEditing ? 'cell' : 'default',
                          outline: canEdit && !isEditing ? '1px dashed transparent' : undefined,
                          ...pinnedBorderStyle,
                          boxShadow: selected
                            ? `inset 0 0 0 2px #1677ff${isPinned ? ', 1px 0 0 rgba(0,0,0,0.05)' : ''}`
                            : pinnedBorderStyle.boxShadow
                        },
                        onMouseEnter: (e) => {
                          handleCellMouseEnter(e, rIdx, cIdx);
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

      React.createElement('div', { style: { marginTop: '6px', padding: '0 2px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center' } },
        React.createElement(Pagination, { current: curPage, pageSize, total, locale: PAGINATION_LOCALE, pageSizeOptions: PAGE_SIZE_OPTIONS, showSizeChanger: true, showQuickJumper: true, showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`, onChange: onPageChange, onShowSizeChange: onPageChange, disabled: loading })
      )
    );
  };

  const TableApp = () => {
    const zhCN = {
      locale: 'zh_CN',
      DatePicker: DATE_PICKER_LOCALE,
    };
    return React.createElement(ConfigProvider, { locale: zhCN },
      React.createElement('div', { style: { padding: '0', fontFamily: 'system-ui, sans-serif', fontSize: `${FONT_SIZE}px`, WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility', fontVariantNumeric: 'tabular-nums' } },
        React.createElement(MergedTable, null)
      )
    );
  };

  ctx.render(React.createElement(TableApp));
}

run();
