async function run() {

  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal, Form } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const DEFAULT_COLUMNS_KEY = `${BLOCK_UID}__default_columns`;
  const COLUMN_VIEW_SETTING_KEY = `${BLOCK_UID}__column_view_setting`;
  const DEFAULT_COLUMN_VIEWS_KEY = `${BLOCK_UID}__default_column_views`;
  const TERM_FIELD_COLOR_SETTING_KEY = `${BLOCK_UID}_termFieldColors`;
  const BLOCK_NAME       = 'SQP';
  const BLOCK_NAME_SETTING_KEY = `${BLOCK_UID}__block_name`;
  const DEFAULT_COLUMN_VIEW_ID = 'default';
  const DEFAULT_COLUMN_VIEW_IDS = [DEFAULT_COLUMN_VIEW_ID];
  const DEFAULT_COLUMN_VIEW_LABELS = { [DEFAULT_COLUMN_VIEW_ID]: '默认视图' };
  const TERM_FIELD_TEMPLATE_KEY = '__term_field_template';
  const TERM_FIELD_COLORS_KEY = '__term_field_colors';
  const IS_ADMIN         = currentUserLevel === 3;
  const DEFAULT_TERM_COUNTRIES = ['US', 'CA', 'JP', 'DE', 'FR'];
  const DEFAULT_MARKET_BRAND = 'ONOAYO';

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

  const GLOBAL_KEY  = '__urlParams_global';
  const readGlobal  = ()     => ctx.engine[GLOBAL_KEY] || null;
  const writeGlobal = (data) => {
    ctx.engine[GLOBAL_KEY] = data ? {
      country: data.country || null,
      asin: data.asin || null,
      model: data.model || null,
      sale_owner: data.sale_owner || data.saleOwner || null,
      status: data.status || null,
      search_query: data.search_query || null,
    } : null;
  };

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
    const p            = parseSearch(search);
    const country      = p['country']      || null;
    const asin         = p['asin']         || null;
    const model        = p['model']        || null;
    const sale_owner   = p['sale_owner']   || p['saleOwner'] || null;
    const status       = p['status']       || null;
    const search_query = p['search_query'] || null;
    if (!country && !asin && !model && !sale_owner && !status && !search_query) return null;
    return { country, asin, model, sale_owner, status, search_query };
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
    { label:'默认自动取，也可手动复核',      value:'#9DF29F' },
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
  const IMPORTANT_COLUMN_BODY_COLOR = '#BADDB1';

  const SRC_DEFAULT_COLOR = {
    sqp: COLOR_GREEN,
  };

  const TERM_GROUP_DEFAULT_COLORS = {
    keyword: ['#C48B8B', '#D4A76A'],
    root: ['#82A0A8', '#8FA382'],
  };
  const TERM_GROUP_COLOR_LEGEND = [
    { label: '关键词1', value: TERM_GROUP_DEFAULT_COLORS.keyword[0] },
    { label: '关键词2', value: TERM_GROUP_DEFAULT_COLORS.keyword[1] },
    { label: '词根1', value: TERM_GROUP_DEFAULT_COLORS.root[0] },
    { label: '词根2', value: TERM_GROUP_DEFAULT_COLORS.root[1] },
  ];
  const DEFAULT_TERM_GROUP_COLOR = TERM_GROUP_DEFAULT_COLORS.keyword[0];
  const hexToRgb = (hexColor) => {
    if (!hexColor || !/^#[0-9a-fA-F]{6}$/.test(hexColor)) return null;
    return {
      r: parseInt(hexColor.slice(1, 3), 16),
      g: parseInt(hexColor.slice(3, 5), 16),
      b: parseInt(hexColor.slice(5, 7), 16),
    };
  };
  const rgbToHex = ({ r, g, b }) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
  const blendHexColors = (frontColor, backColor, opacity) => {
    const front = hexToRgb(frontColor);
    const back = hexToRgb(backColor);
    if (!front || !back) return backColor;
    return rgbToHex({
      r: front.r * opacity + back.r * (1 - opacity),
      g: front.g * opacity + back.g * (1 - opacity),
      b: front.b * opacity + back.b * (1 - opacity),
    });
  };
  const getTermGroupDefaultColor = (termType, groupIndex) => {
    const palette = TERM_GROUP_DEFAULT_COLORS[termType] || TERM_GROUP_DEFAULT_COLORS.keyword;
    return palette[groupIndex % palette.length] || DEFAULT_TERM_GROUP_COLOR;
  };
  const getTermGroupHeaderColor = (col) => col.termGroupHeaderColor || col.termGroupDefaultColor || DEFAULT_TERM_GROUP_COLOR;
  const getTermFieldHeaderColor = (col) => col.termFieldHeaderColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;
  const getColHeaderColor = (col) => col?._isTermColumn ? getTermFieldHeaderColor(col) : (col.headerColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN);
  const getColBodyColor = (col) => col?.bodyColor || null;
  const withCreateTimestamps = (payload) => {
    const now = new Date().toISOString();
    return {
      ...payload,
      created_at: payload?.created_at || now,
      updated_at: payload?.updated_at || now,
    };
  };
  const getTermCellBackground = (col, rowIndex, selected) => {
    if (selected) return '#e6f4ff';
    const baseColor = rowIndex % 2 === 0 ? '#fff' : '#fafafa';
    return blendHexColors(getTermGroupHeaderColor(col), baseColor, 0.08);
  };

  const PAGE_SIZE_OPTIONS = ['10','20','50','100'];
  const DEFAULT_PAGE_SIZE = 20;

  const MONEY_FIELDS = new Set([]);
  const RATE_FIELDS  = new Set([
    'market_ctr','asin_ctr','market_cart_rate','asin_cart_rate','market_cvr','asin_cvr',
    'asin_click_share','asin_cart_share','asin_purchase_share','stage_target_share',
  ]);
  const NUM_FIELDS   = new Set([
    'search_query_volume','impressions_count','impressions_asin_count',
    'clicks_count','clicks_asin_count','cart_additions_count','cart_additions_asin_count',
    'purchases_count','purchases_asin_count','weekly_required_orders','daily_required_orders',
  ]);
  const ZERO_AS_EMPTY_FIELDS = new Set([]);

  const DATE_FIELDS  = new Set(['report_date','week_start_date']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  const READONLY_FIELDS = new Set([
    'country_asin_week_date','country_asin_weekDate','id','country_asin','country','asin','report_date','week_start_date','week_label',
    'search_query_volume','impressions_count','impressions_asin_count','clicks_count','clicks_asin_count',
    'cart_additions_count','cart_additions_asin_count','purchases_count','purchases_asin_count',
    'market_ctr','asin_ctr','market_cart_rate','asin_cart_rate','market_cvr','asin_cvr',
    'asin_click_share','asin_cart_share','asin_purchase_share','weekly_required_orders','daily_required_orders',
    'market_diagnosis','asin_diagnosis','compare_diagnosis',
  ]);

  const FORMULA_DESCRIPTIONS = {
    search_query_volume: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的搜索查询数量求和。',
    impressions_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-市场曝光量求和。',
    clicks_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-市场点击量求和。',
    cart_additions_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-市场加购量求和。',
    purchases_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-市场购买量求和。',
    impressions_asin_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-Asin曝光量求和。',
    clicks_asin_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-Asin点击量求和。',
    cart_additions_asin_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-Asin加购量求和。',
    purchases_asin_count: '从 SQP 明细数据源汇总：匹配当前关键词/词根和当前周的 SQP-Asin购买量求和。',
    market_ctr: 'SQP-市场点击量 / SQP-市场曝光量',
    asin_ctr: 'SQP-Asin点击量 / SQP-Asin曝光量',
    market_cart_rate: 'SQP-市场加购量 / SQP-市场点击量',
    asin_cart_rate: 'SQP-Asin加购量 / SQP-Asin点击量',
    market_cvr: 'SQP-市场购买量 / SQP-市场点击量',
    asin_cvr: 'SQP-Asin购买量 / SQP-Asin点击量',
    asin_click_share: 'SQP-Asin点击量 / SQP-市场点击量',
    asin_cart_share: 'SQP-Asin加购量 / SQP-市场加购量',
    asin_purchase_share: 'SQP-Asin购买量 / SQP-市场购买量',
    stage_target_share: 'ASIN 默认值或手填',
    weekly_required_orders: '阶段目标份额 * 市场周购买量',
    daily_required_orders: '一周需出单 / 7',
    monday_review_note: '用户手填：周一自用备注或复盘。',
    market_diagnosis: '市场数据环比分析：对比当前周与上一周的搜索查询数量、SQP-市场曝光量、SQP-市场点击量、SQP-市场加购量、SQP-市场购买量、SQP-市场 CTR、SQP-市场 加购率、SQP-市场 CVR，展示环比增减。',
    asin_diagnosis: 'Asin数据环比分析：对比当前周与上一周的 SQP-Asin 点击份额、点击量、加购份额、加购量、出单份额、购买量、SQP-Asin CTR、SQP-Asin 加购率、SQP-Asin CVR，展示环比增减。',
    compare_diagnosis: 'Asin与市场数据同比分析：对比 SQP-Asin CTR/CVR/加购率 与 SQP-市场 CTR/CVR/加购率，并根据阶段目标份额计算的一周需出单判断当前 Asin 出单是否达标。',
  };

  const FORMULA_TOOLTIPS = {
    search_query_volume: {
      title: '搜索查询数量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的搜索查询数量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: '搜索查询数量', field: 'sqp_detail.search_query_volume' },
      ],
      writeBackField: 'sqp_term_weekly.search_query_volume',
    },
    impressions_count: {
      title: 'SQP-市场曝光量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的市场曝光量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: '市场曝光量', field: 'sqp_detail.impressions_count' },
      ],
      writeBackField: 'sqp_term_weekly.impressions_count',
    },
    clicks_count: {
      title: 'SQP-市场点击量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的市场点击量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: '市场点击量', field: 'sqp_detail.clicks_count' },
      ],
      writeBackField: 'sqp_term_weekly.clicks_count',
    },
    cart_additions_count: {
      title: 'SQP-市场加购量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的市场加购量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: '市场加购量', field: 'sqp_detail.cart_additions_count' },
      ],
      writeBackField: 'sqp_term_weekly.cart_additions_count',
    },
    purchases_count: {
      title: 'SQP-市场购买量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的市场购买量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: '市场购买量', field: 'sqp_detail.purchases_count' },
      ],
      writeBackField: 'sqp_term_weekly.purchases_count',
    },
    impressions_asin_count: {
      title: 'SQP-Asin曝光量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的 Asin 曝光量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: 'Asin曝光量', field: 'sqp_detail.impressions_asin_count' },
      ],
      writeBackField: 'sqp_term_weekly.impressions_asin_count',
    },
    clicks_asin_count: {
      title: 'SQP-Asin点击量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的 Asin 点击量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: 'Asin点击量', field: 'sqp_detail.clicks_asin_count' },
      ],
      writeBackField: 'sqp_term_weekly.clicks_asin_count',
    },
    cart_additions_asin_count: {
      title: 'SQP-Asin加购量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的 Asin 加购量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: 'Asin加购量', field: 'sqp_detail.cart_additions_asin_count' },
      ],
      writeBackField: 'sqp_term_weekly.cart_additions_asin_count',
    },
    purchases_asin_count: {
      title: 'SQP-Asin购买量',
      formula: '按当前关键词/词根与当前周汇总 SQP 明细中的 Asin 购买量',
      emptyRules: ['没有匹配到当前周的 SQP 明细'],
      fields: [
        { label: 'Asin购买量', field: 'sqp_detail.purchases_asin_count' },
      ],
      writeBackField: 'sqp_term_weekly.purchases_asin_count',
    },
    market_ctr: {
      title: 'SQP-市场 CTR',
      formula: 'SQP-市场点击量 ÷ SQP-市场曝光量',
      emptyRules: ['SQP-市场点击量为空', 'SQP-市场曝光量为空或为 0'],
      fields: [
        { label: '市场点击量', field: 'sqp_term_weekly.clicks_count' },
        { label: '市场曝光量', field: 'sqp_term_weekly.impressions_count' },
      ],
      writeBackField: 'sqp_term_weekly.market_ctr',
    },
    asin_ctr: {
      title: 'SQP-Asin CTR',
      formula: 'SQP-Asin点击量 ÷ SQP-Asin曝光量',
      emptyRules: ['SQP-Asin点击量为空', 'SQP-Asin曝光量为空或为 0'],
      fields: [
        { label: 'Asin点击量', field: 'sqp_term_weekly.clicks_asin_count' },
        { label: 'Asin曝光量', field: 'sqp_term_weekly.impressions_asin_count' },
      ],
      writeBackField: 'sqp_term_weekly.asin_ctr',
    },
    market_cart_rate: {
      title: 'SQP-市场 加购率',
      formula: 'SQP-市场加购量 ÷ SQP-市场点击量',
      emptyRules: ['SQP-市场加购量为空', 'SQP-市场点击量为空或为 0'],
      fields: [
        { label: '市场加购量', field: 'sqp_term_weekly.cart_additions_count' },
        { label: '市场点击量', field: 'sqp_term_weekly.clicks_count' },
      ],
      writeBackField: 'sqp_term_weekly.market_cart_rate',
    },
    asin_cart_rate: {
      title: 'SQP-Asin 加购率',
      formula: 'SQP-Asin加购量 ÷ SQP-Asin点击量',
      emptyRules: ['SQP-Asin加购量为空', 'SQP-Asin点击量为空或为 0'],
      fields: [
        { label: 'Asin加购量', field: 'sqp_term_weekly.cart_additions_asin_count' },
        { label: 'Asin点击量', field: 'sqp_term_weekly.clicks_asin_count' },
      ],
      writeBackField: 'sqp_term_weekly.asin_cart_rate',
    },
    market_cvr: {
      title: 'SQP-市场 CVR',
      formula: 'SQP-市场购买量 ÷ SQP-市场点击量',
      emptyRules: ['SQP-市场购买量为空', 'SQP-市场点击量为空或为 0'],
      fields: [
        { label: '市场购买量', field: 'sqp_term_weekly.purchases_count' },
        { label: '市场点击量', field: 'sqp_term_weekly.clicks_count' },
      ],
      writeBackField: 'sqp_term_weekly.market_cvr',
    },
    asin_cvr: {
      title: 'SQP-Asin CVR',
      formula: 'SQP-Asin购买量 ÷ SQP-Asin点击量',
      emptyRules: ['SQP-Asin购买量为空', 'SQP-Asin点击量为空或为 0'],
      fields: [
        { label: 'Asin购买量', field: 'sqp_term_weekly.purchases_asin_count' },
        { label: 'Asin点击量', field: 'sqp_term_weekly.clicks_asin_count' },
      ],
      writeBackField: 'sqp_term_weekly.asin_cvr',
    },
    asin_click_share: {
      title: 'SQP-Asin 点击份额',
      formula: 'SQP-Asin点击量 ÷ SQP-市场点击量',
      emptyRules: ['SQP-Asin点击量为空', 'SQP-市场点击量为空或为 0'],
      fields: [
        { label: 'Asin点击量', field: 'sqp_term_weekly.clicks_asin_count' },
        { label: '市场点击量', field: 'sqp_term_weekly.clicks_count' },
      ],
      writeBackField: 'sqp_term_weekly.asin_click_share',
    },
    asin_cart_share: {
      title: 'SQP-Asin 加购份额',
      formula: 'SQP-Asin加购量 ÷ SQP-市场加购量',
      emptyRules: ['SQP-Asin加购量为空', 'SQP-市场加购量为空或为 0'],
      fields: [
        { label: 'Asin加购量', field: 'sqp_term_weekly.cart_additions_asin_count' },
        { label: '市场加购量', field: 'sqp_term_weekly.cart_additions_count' },
      ],
      writeBackField: 'sqp_term_weekly.asin_cart_share',
    },
    asin_purchase_share: {
      title: 'SQP-Asin 出单份额',
      formula: 'SQP-Asin购买量 ÷ SQP-市场购买量',
      emptyRules: ['SQP-Asin购买量为空', 'SQP-市场购买量为空或为 0'],
      fields: [
        { label: 'Asin购买量', field: 'sqp_term_weekly.purchases_asin_count' },
        { label: '市场购买量', field: 'sqp_term_weekly.purchases_count' },
      ],
      writeBackField: 'sqp_term_weekly.asin_purchase_share',
    },
    stage_target_share: {
      title: '阶段目标份额',
      formula: '用户手填当前关键词/词根的阶段目标出单份额',
      emptyRules: ['未填写时显示为空，并不会计算需出单量'],
      fields: [
        { label: '阶段目标份额', field: 'sqp_term_weekly.stage_target_share' },
      ],
      writeBackField: 'sqp_term_weekly.stage_target_share',
    },
    weekly_required_orders: {
      title: '一周需出单',
      formula: '阶段目标份额 × SQP-市场周购买量，结果向上取整。',
      emptyRules: ['阶段目标份额为空', 'SQP-市场购买量为空'],
      fields: [
        { label: '阶段目标份额', field: 'sqp_term_weekly.stage_target_share' },
        { label: '市场周购买量', field: 'sqp_term_weekly.purchases_count' },
      ],
      writeBackField: 'sqp_term_weekly.weekly_required_orders',
    },
    daily_required_orders: {
      title: '单日需出单',
      formula: '一周需出单 ÷ 7，结果向上取整。',
      emptyRules: ['一周需出单为空'],
      fields: [
        { label: '一周需出单', field: 'sqp_term_weekly.weekly_required_orders' },
      ],
      writeBackField: 'sqp_term_weekly.daily_required_orders',
    },
    monday_review_note: {
      title: '周一自用备注或复盘',
      formula: '用户手填周一复盘、备注或后续动作',
      emptyRules: ['未填写时显示为空'],
      fields: [
        { label: '周一备注', field: 'sqp_term_weekly.monday_review_note' },
      ],
      writeBackField: 'sqp_term_weekly.monday_review_note',
    },
    market_diagnosis: {
      title: '市场数据环比分析',
      formula: '对比当前周与上一周的市场查询、曝光、点击、加购、购买、CTR、加购率和 CVR，展示环比增减',
      emptyRules: ['当前周市场数据缺失', '上一周市场数据缺失'],
      fields: [
        { label: '当前周市场指标', field: 'sqp_term_weekly.*（当前周）' },
        { label: '上一周市场指标', field: 'sqp_term_weekly.*（上一周）' },
      ],
      writeBackField: 'sqp_term_weekly.market_diagnosis',
    },
    asin_diagnosis: {
      title: 'Asin数据环比分析',
      formula: '对比当前周与上一周的 Asin 点击份额、点击量、加购份额、加购量、出单份额、购买量、CTR、加购率和 CVR，展示环比增减',
      emptyRules: ['当前周 Asin 数据缺失', '上一周 Asin 数据缺失'],
      fields: [
        { label: '当前周 Asin 指标', field: 'sqp_term_weekly.*（当前周）' },
        { label: '上一周 Asin 指标', field: 'sqp_term_weekly.*（上一周）' },
      ],
      writeBackField: 'sqp_term_weekly.asin_diagnosis',
    },
    compare_diagnosis: {
      title: 'Asin与市场数据同比分析',
      formula: '对比 Asin 与市场的 CTR、CVR、加购率，并结合一周需出单判断当前 Asin 出单是否达标',
      emptyRules: ['Asin 指标缺失', '市场指标缺失', '阶段目标份额或一周需出单缺失'],
      fields: [
        { label: 'Asin 指标', field: 'sqp_term_weekly.asin_ctr / asin_cvr / asin_cart_rate' },
        { label: '市场指标', field: 'sqp_term_weekly.market_ctr / market_cvr / market_cart_rate' },
        { label: '一周需出单', field: 'sqp_term_weekly.weekly_required_orders' },
      ],
      writeBackField: 'sqp_term_weekly.compare_diagnosis',
    },
  };

  const SRC_COLLECTION_NAME = {
    main: 'sqp_weekly_main',
    keyword: 'sqp_term_weekly',
    root: 'sqp_term_weekly',
    term: 'sqp_term_weekly',
  };

  const INITIAL_COLUMNS = [
    { key:'sqp_country',              src:'main', field:'country',               label:'站点',          hidden:false, pinned:true,  width:70,  editable:false },
    { key:'sqp_asin',                 src:'main', field:'asin',                  label:'ASIN',          hidden:false, pinned:true,  width:110, editable:false },
    { key:'sqp_week_start_date',      src:'main', field:'week_start_date',       label:'周起始日',      hidden:false, pinned:true,  width:110, editable:false },
    { key:'sqp_report_date',          src:'main', field:'report_date',           label:'周最后一天',    hidden:false, pinned:true,  width:110, editable:false },
    { key:'sqp_week_label',           src:'main', field:'week_label',            label:'第几周',        hidden:false, pinned:true,  width:90,  editable:false },
    { key:'sqp_country_asin_weekDate',src:'main', field:'country_asin_week_date', label:'主键',          hidden:true,  pinned:false, width:170, editable:false },
  ];

  const SRC_UPDATE_CONFIG = {
    term: { url: 'sqp_term_weekly:update', pkField: 'term_week_key' },
    keyword: { url: 'sqp_term_weekly:update', pkField: 'term_week_key' },
    root: { url: 'sqp_term_weekly:update', pkField: 'term_week_key' },
  };

  const DYNAMIC_COLOR = { country: (row) => COUNTRY_COLORS[row.country] || null };

  const SRC_GROUP_CONFIG = [
    { src:'main',    label:'📊 SQP 周主表', color:COLOR_GREEN },
    { src:'keyword', label:'🔑 关键词汇总',  color:COLOR_ORANGE },
    { src:'root',    label:'🌱 词根汇总',    color:COLOR_TEAL },
  ];

  const TERM_SUB_FIELDS = [
    { key: 'search_query_volume',       label: '搜索查询数量', type: 'number',    width: 128 },
    { key: 'impressions_count',         label: 'SQP-市场曝光量',     type: 'number',    width: 146 },
    { key: 'clicks_count',              label: 'SQP-市场点击量',     type: 'number',    width: 146 },
    { key: 'cart_additions_count',      label: 'SQP-市场加购量',     type: 'number',    width: 146 },
    { key: 'purchases_count',           label: 'SQP-市场购买量',     type: 'number',    width: 146 },
    { key: 'impressions_asin_count',    label: 'SQP-Asin曝光量',     type: 'number',    width: 138 },
    { key: 'clicks_asin_count',         label: 'SQP-Asin点击量',     type: 'number',    width: 138 },
    { key: 'cart_additions_asin_count', label: 'SQP-Asin加购量',     type: 'number',    width: 138 },
    { key: 'purchases_asin_count',      label: 'SQP-Asin购买量',     type: 'number',    width: 138 },
    { key: 'market_ctr',                label: 'SQP-市场 CTR',       type: 'rate',      width: 124 },
    { key: 'asin_ctr',                  label: 'SQP-Asin CTR',       type: 'rate',      width: 124 },
    { key: 'market_cart_rate',          label: 'SQP-市场 加购率',    type: 'rate',      width: 142 },
    { key: 'asin_cart_rate',            label: 'SQP-Asin 加购率',    type: 'rate',      width: 142 },
    { key: 'market_cvr',                label: 'SQP-市场 CVR',       type: 'rate',      width: 124 },
    { key: 'asin_cvr',                  label: 'SQP-Asin CVR',       type: 'rate',      width: 124 },
    { key: 'asin_click_share',          label: 'SQP-Asin 点击份额',  type: 'rate',      width: 152 },
    { key: 'asin_cart_share',           label: 'SQP-Asin 加购份额',  type: 'rate',      width: 152 },
    { key: 'asin_purchase_share',       label: 'SQP-Asin 出单份额',  type: 'rate',      width: 152 },
    { key: 'stage_target_share',        label: '阶段目标份额', type: 'stageRate', width: 128 },
    { key: 'weekly_required_orders',    label: '一周需出单',   type: 'number',    width: 148 },
    { key: 'daily_required_orders',     label: '单日需出单',   type: 'number',    width: 148 },
    { key: 'market_diagnosis',          label: '市场数据环比分析',       type: 'diagnosis', width: 420 },
    { key: 'asin_diagnosis',            label: 'Asin数据环比分析',       type: 'diagnosis', width: 420 },
    { key: 'compare_diagnosis',         label: 'Asin与市场数据同比分析',    type: 'diagnosis', width: 480 },
    { key: 'monday_review_note',        label: '周一自用备注或复盘', type: 'text', width: 220 },
  ];
  const CHART_EXCLUDED_FIELDS = new Set([
    'market_diagnosis',
    'asin_diagnosis',
    'compare_diagnosis',
    'monday_review_note',
  ]);
  const CHART_METRIC_FIELDS = TERM_SUB_FIELDS
    .filter((field) => !CHART_EXCLUDED_FIELDS.has(field.key) && ['number', 'rate', 'stageRate'].includes(field.type))
    .map((field) => ({
      ...field,
      axis: RATE_FIELDS.has(field.key) || field.type === 'rate' || field.type === 'stageRate' ? 'right' : 'left',
    }));
  const CHART_DEFAULT_FIELD_KEYS = ['market_ctr', 'asin_ctr'];
  const CHART_QUICK_GROUPS = [
    { label: 'CTR 对比', fields: ['market_ctr', 'asin_ctr'] },
    { label: '加购率对比', fields: ['market_cart_rate', 'asin_cart_rate'] },
    { label: 'CVR 对比', fields: ['market_cvr', 'asin_cvr'] },
  ];
  const CHART_LINE_COLORS = [
    '#F59E0B', '#3B82F6', '#EF4444', '#10B981', '#A855F7', '#14B8A6',
    '#F97316', '#60A5FA', '#F43F5E', '#22C55E', '#C084FC', '#06B6D4',
  ];
  const TERM_GAP = 4;
  const TERM_HEADER_MAIN_HEIGHT = 38;
  const TERM_HEADER_SUB_HEIGHT = 32;
  const DIAGNOSIS_COLUMN_MIN_WIDTH = 420;
  const TERM_SUB_FIELD_MIN_WIDTH = 56;
  const TERM_DIAGNOSIS_MIN_WIDTH = 160;
  const TERM_ADDED_ORDER_SORT = ['id'];

  const isDiagnosisColumn = (col) => col?._isTermColumn && col._termSubType === 'diagnosis';
  const isMultilineTermColumn = (col) => isDiagnosisColumn(col) || col?.field === 'monday_review_note';
  const getTermSubFieldDefaultWidth = (field) => TERM_SUB_FIELDS.find((sub) => sub.key === field)?.width || 80;
  const getTermSubFieldMinWidth = (field, type = null) => {
    const sub = TERM_SUB_FIELDS.find((item) => item.key === field);
    return type === 'diagnosis' || sub?.type === 'diagnosis' ? TERM_DIAGNOSIS_MIN_WIDTH : TERM_SUB_FIELD_MIN_WIDTH;
  };
  const getTermColumnMinWidth = (col) => {
    if (!col?._isTermColumn) return 40;
    return getTermSubFieldMinWidth(col.field, col._termSubType);
  };
  const getColumnRenderWidth = (col) => {
    const width = Number(col?.width) || 80;
    if (!col?._isTermColumn) return width;
    return Math.max(width, getTermColumnMinWidth(col));
  };
  const renderLabelWithRedAsin = (label) => {
    const text = String(label ?? '');
    const parts = text.split(/(Asin)/g);
    return parts.map((part, index) => part === 'Asin'
      ? React.createElement('span', { key: index, style: { color: '#ff4d4f', fontWeight: 800 } }, part)
      : part
    );
  };

  const getTermAddedOrderParts = (row) => {
    const createdRaw = row?.createdAt || row?.created_at;
    const createdTime = createdRaw ? Date.parse(createdRaw) : NaN;
    const idNum = Number(row?.id);
    return {
      createdTime: Number.isFinite(createdTime) ? createdTime : null,
      idNum: Number.isFinite(idNum) ? idNum : null,
      idText: row?.id == null ? '' : String(row.id),
    };
  };

  const sortTermsByAddedOrder = (rows) => [...(rows || [])].sort((a, b) => {
    const oa = getTermAddedOrderParts(a);
    const ob = getTermAddedOrderParts(b);
    if (oa.createdTime != null && ob.createdTime != null && oa.createdTime !== ob.createdTime) {
      return oa.createdTime - ob.createdTime;
    }
    if (oa.idNum != null && ob.idNum != null && oa.idNum !== ob.idNum) return oa.idNum - ob.idNum;
    return oa.idText.localeCompare(ob.idText, undefined, { numeric: true });
  });

  const getDefaultTermFieldTemplate = () => Object.fromEntries(
    TERM_SUB_FIELDS.map((sub) => [sub.key, {
      hidden: false,
      width: sub.width,
      editable: sub.key === 'stage_target_share' || sub.key === 'monday_review_note',
      bodyColor: null,
    }])
  );

  const normalizeTermFieldTemplate = (raw = {}) => {
    const defaults = getDefaultTermFieldTemplate();
    TERM_SUB_FIELDS.forEach((sub) => {
      const item = raw?.[sub.key] || {};
      defaults[sub.key] = {
        hidden: item.hidden === true,
        width: Math.max(Number(item.width) || sub.width, getTermSubFieldMinWidth(sub.key, sub.type)),
        editable: item.editable === true || sub.key === 'stage_target_share' || sub.key === 'monday_review_note',
        bodyColor: item.bodyColor || null,
      };
    });
    return defaults;
  };

  const getTermFieldTemplateFromPayload = (payload) => {
    const item = Array.isArray(payload) ? payload.find((entry) => entry?.key === TERM_FIELD_TEMPLATE_KEY) : null;
    return normalizeTermFieldTemplate(item?.fields || {});
  };

  const getTermFieldBodyColorsFromPayload = (payload) => {
    const template = getTermFieldTemplateFromPayload(payload);
    return Object.fromEntries(
      TERM_SUB_FIELDS.map((sub) => [sub.key, template[sub.key]?.bodyColor || null])
    );
  };

  const mergeTermFieldBodyColorsIntoPayload = (targetPayload, sourceBodyColors = {}) => {
    const bodyColors = sourceBodyColors && typeof sourceBodyColors === 'object' ? sourceBodyColors : {};
    if (!Object.keys(bodyColors).length || !Array.isArray(targetPayload)) return targetPayload;
    const currentTemplate = getTermFieldTemplateFromPayload(targetPayload);
    TERM_SUB_FIELDS.forEach((sub) => {
      if (!Object.prototype.hasOwnProperty.call(bodyColors, sub.key)) return;
      currentTemplate[sub.key] = {
        ...(currentTemplate[sub.key] || {}),
        bodyColor: bodyColors[sub.key] || null,
      };
    });
    let replaced = false;
    const nextPayload = targetPayload.map((item) => {
      if (item?.key !== TERM_FIELD_TEMPLATE_KEY) return item;
      replaced = true;
      return { key: TERM_FIELD_TEMPLATE_KEY, fields: currentTemplate };
    });
    return replaced
      ? nextPayload
      : [...nextPayload, { key: TERM_FIELD_TEMPLATE_KEY, fields: currentTemplate }];
  };

  const normalizeTermFieldColors = (raw = {}) => {
    const result = {};
    TERM_SUB_FIELDS.forEach((sub) => {
      const color = raw?.[sub.key];
      if (typeof color === 'string' && color.trim()) result[sub.key] = color;
    });
    return result;
  };

  const getTermFieldColorsFromPayload = (payload, fallback = {}) => {
    const item = Array.isArray(payload) ? payload.find((entry) => entry?.key === TERM_FIELD_COLORS_KEY) : null;
    return normalizeTermFieldColors({ ...(fallback || {}), ...(item?.colors || {}) });
  };

  const getHeaderColorMapFromPayload = (payload) => {
    const map = {};
    if (!Array.isArray(payload)) return map;
    payload.forEach((item) => {
      if (!item?.key || item.key === TERM_FIELD_TEMPLATE_KEY || item.key === TERM_FIELD_COLORS_KEY || isTermColumnConfig(item)) return;
      if (!Object.prototype.hasOwnProperty.call(item, 'headerColor')) return;
      map[item.key] = migrateLegacyColor(item.headerColor) || null;
    });
    return map;
  };

  const mergeHeaderColorsIntoColumnPayload = (targetPayload, sourceHeaderColorMap) => {
    const colorMap = sourceHeaderColorMap && typeof sourceHeaderColorMap === 'object' ? sourceHeaderColorMap : {};
    if (!Object.keys(colorMap).length || !Array.isArray(targetPayload)) return targetPayload;
    return targetPayload.map((item) => {
      if (!item?.key || item.key === TERM_FIELD_TEMPLATE_KEY || item.key === TERM_FIELD_COLORS_KEY || isTermColumnConfig(item)) return item;
      if (!Object.prototype.hasOwnProperty.call(colorMap, item.key)) return item;
      const nextColor = colorMap[item.key] || null;
      const currentColor = migrateLegacyColor(item.headerColor) || null;
      return currentColor === nextColor ? item : { ...item, headerColor: nextColor };
    });
  };

  const buildTermFieldColorsPayload = (cols, fallback = {}) => {
    const colors = normalizeTermFieldColors(fallback);
    (cols || []).forEach((c) => {
      if (!c?._isTermColumn || !c.field || !c.termFieldHeaderColor) return;
      colors[c.field] = c.termFieldHeaderColor;
    });
    return colors;
  };

  const isTermColumnConfig = (item) => item?._isTermColumn === true || item?._isTermFieldColumn === true || !!item?._termColumnKey || !!item?._termGroupKey;

  const withTermFieldColorsPayload = (payload, fieldColors = {}) => {
    const rows = Array.isArray(payload) ? payload.filter((item) => item?.key !== TERM_FIELD_COLORS_KEY && !isTermColumnConfig(item)) : [];
    const colors = getTermFieldColorsFromPayload(payload, fieldColors);
    return [...rows, { key: TERM_FIELD_COLORS_KEY, colors }];
  };

  const replaceTermFieldColorsPayload = (payload, fieldColors = {}) => {
    const rows = Array.isArray(payload) ? payload.filter((item) => item?.key !== TERM_FIELD_COLORS_KEY && !isTermColumnConfig(item)) : [];
    return [...rows, { key: TERM_FIELD_COLORS_KEY, colors: normalizeTermFieldColors(fieldColors) }];
  };

  const syncHeaderColorsIntoColumnViews = (views, sourceHeaderColorMap, sourceTermFieldColors = {}, updatedAt = new Date().toISOString(), sourceTermFieldBodyColors = null) => {
    const colorMap = sourceHeaderColorMap && typeof sourceHeaderColorMap === 'object' ? sourceHeaderColorMap : {};
    const termColors = normalizeTermFieldColors(sourceTermFieldColors);
    const termBodyColors = sourceTermFieldBodyColors && typeof sourceTermFieldBodyColors === 'object' ? sourceTermFieldBodyColors : null;
    const hasHeaderColors = Object.keys(colorMap).length > 0;
    const hasTermColors = Object.keys(termColors).length > 0;
    const hasTermBodyColors = termBodyColors && Object.keys(termBodyColors).length > 0;
    if (!hasHeaderColors && !hasTermColors && !hasTermBodyColors) return Array.isArray(views) ? views : [];
    return (Array.isArray(views) ? views : []).map((view) => {
      const payloadWithHeaderColors = hasHeaderColors
        ? mergeHeaderColorsIntoColumnPayload(view.payload, colorMap)
        : view.payload;
      const payloadWithBodyColors = hasTermBodyColors
        ? mergeTermFieldBodyColorsIntoPayload(payloadWithHeaderColors, termBodyColors)
        : payloadWithHeaderColors;
      return {
        ...view,
        payload: replaceTermFieldColorsPayload(payloadWithBodyColors, termColors),
        updated_at: updatedAt,
      };
    });
  };

  const buildTermFieldTemplatePayload = (cols, fallback = {}) => {
    const template = normalizeTermFieldTemplate(fallback);
    TERM_SUB_FIELDS.forEach((sub) => {
      const matches = (cols || []).filter((c) => c?._isTermColumn && c.field === sub.key);
      if (!matches.length) return;
      const widths = matches.map((c) => Number(c.width)).filter((n) => Number.isFinite(n) && n > 0);
      const bodyColor = matches.map((c) => c.bodyColor || null).find(Boolean) || null;
      template[sub.key] = {
        hidden: matches.every((c) => c.hidden === true),
        width: Math.max(widths.length ? Math.max(...widths) : sub.width, getTermSubFieldMinWidth(sub.key, sub.type)),
        editable: matches.some((c) => c.editable === true) || sub.key === 'stage_target_share' || sub.key === 'monday_review_note',
        bodyColor,
      };
    });
    return template;
  };

  const buildColumnPayload = (cols, options = {}) => {
    const fallbackTemplate = options.termFieldTemplate || getTermFieldTemplateFromPayload(cols);
    const fallbackColors = options.termFieldColors || getTermFieldColorsFromPayload(cols);
    return [
      ...(cols || [])
        .filter((c) => c?.key && c.key !== TERM_FIELD_TEMPLATE_KEY && c.key !== TERM_FIELD_COLORS_KEY && !isTermColumnConfig(c))
        .map((c) => ({
          key: c.key, hidden: c.hidden === true, pinned: c.pinned === true,
          width: Number(c.width) || 80, headerColor: c.headerColor || null,
          editable: c.editable === true,
          src: c.src, field: c.field, label: c.label,
          termGroupHeaderColor: c.termGroupHeaderColor || null,
          termFieldHeaderColor: c.termFieldHeaderColor || null,
          _isTermColumn: c._isTermColumn === true,
          _isTermFieldColumn: c._isTermFieldColumn === true,
          _termColumnKey: c._termColumnKey || null,
          _termGroupKey: c._termGroupKey || null,
          _termGroupLabel: c._termGroupLabel || null,
          _termType: c._termType || null,
          _termId: c._termId || null,
          _termName: c._termName || null,
          _termSubType: c._termSubType || null,
        })),
      { key: TERM_FIELD_TEMPLATE_KEY, fields: buildTermFieldTemplatePayload(cols, fallbackTemplate) },
      { key: TERM_FIELD_COLORS_KEY, colors: buildTermFieldColorsPayload(cols, fallbackColors) },
    ];
  };

  const normalizeColumnViewId = (viewId) => {
    const id = String(viewId || '').trim();
    return id || DEFAULT_COLUMN_VIEW_ID;
  };

  const isDefaultColumnViewId = (viewId) => DEFAULT_COLUMN_VIEW_IDS.includes(normalizeColumnViewId(viewId));

  const normalizeColumnViewName = (id, name) => {
    const text = String(name || '').trim();
    if (normalizeColumnViewId(id) === DEFAULT_COLUMN_VIEW_ID && (!text || text === '默认视图一')) return DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID];
    return text || DEFAULT_COLUMN_VIEW_LABELS[id] || '自定义视图';
  };

  const getViewLabel = (view) => normalizeColumnViewName(view?.id, view?.name);

  const buildInitialViewPayload = () => buildColumnPayload(INITIAL_COLUMNS.map((c) => ({ ...c })), {
    termFieldTemplate: getDefaultTermFieldTemplate(),
    termFieldColors: {},
  });

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
    if (includeDefaultViews && !viewMap[DEFAULT_COLUMN_VIEW_ID]) {
      viewMap[DEFAULT_COLUMN_VIEW_ID] = {
        id: DEFAULT_COLUMN_VIEW_ID,
        name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID],
        type: 'default',
        payload: buildInitialViewPayload(),
        updated_at: null,
      };
    }
    return [
      ...(includeDefaultViews ? DEFAULT_COLUMN_VIEW_IDS.map((id) => viewMap[id]).filter(Boolean) : []),
      ...Object.values(viewMap).filter((view) => !isDefaultColumnViewId(view.id)),
    ];
  };

  const normalizeColumnViewState = (setting = {}) => {
    const legacyTermFieldColors = normalizeTermFieldColors(setting[TERM_FIELD_COLOR_SETTING_KEY] || {});
    const legacyDefaultPayload = Array.isArray(setting[DEFAULT_COLUMNS_KEY]) && setting[DEFAULT_COLUMNS_KEY].length
      ? setting[DEFAULT_COLUMNS_KEY]
      : null;
    const legacyPersonalPayload = Array.isArray(setting[BLOCK_UID]) && setting[BLOCK_UID].length
      ? setting[BLOCK_UID]
      : null;
    const defaultViews = normalizeColumnViewList(setting[DEFAULT_COLUMN_VIEWS_KEY]);
    const personalRaw = setting[COLUMN_VIEW_SETTING_KEY] || {};
    const hasPersonalViewSetting = !!personalRaw && (
      personalRaw.activeViewId ||
      personalRaw.active_view_id ||
      Array.isArray(personalRaw.views)
    );
    if (legacyPersonalPayload && !hasPersonalViewSetting) {
      defaultViews[0] = {
        ...defaultViews[0],
        payload: buildColumnPayload(legacyPersonalPayload, { termFieldColors: legacyTermFieldColors }),
      };
    } else if (legacyDefaultPayload && !Array.isArray(setting[DEFAULT_COLUMN_VIEWS_KEY]?.views)) {
      defaultViews[0] = {
        ...defaultViews[0],
        payload: buildColumnPayload(legacyDefaultPayload, { termFieldColors: legacyTermFieldColors }),
      };
    } else if (Object.keys(legacyTermFieldColors).length) {
      defaultViews.forEach((view) => {
        view.payload = withTermFieldColorsPayload(view.payload, legacyTermFieldColors);
      });
    }
    const personalViews = normalizeColumnViewList(personalRaw, { includeDefaultViews: false, onlyCustomViews: true });
    if (Object.keys(legacyTermFieldColors).length) {
      personalViews.forEach((view) => {
        view.payload = withTermFieldColorsPayload(view.payload, legacyTermFieldColors);
      });
    }
    const defaultMap = Object.fromEntries(defaultViews.map((view) => [view.id, view]));
    const views = [
      {
        ...defaultMap[DEFAULT_COLUMN_VIEW_ID],
        id: DEFAULT_COLUMN_VIEW_ID,
        name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID],
        type: 'default',
      },
      ...personalViews,
    ];
    const activeViewId = normalizeColumnViewId(personalRaw.activeViewId || personalRaw.active_view_id || DEFAULT_COLUMN_VIEW_ID);
    return {
      activeViewId: views.some((view) => view.id === activeViewId) ? activeViewId : DEFAULT_COLUMN_VIEW_ID,
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
        payload: withTermFieldColorsPayload(Array.isArray(view.payload) ? view.payload : []),
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
      return normalizeColumnViewState(userRes?.data?.data?.setting || {});
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

  const loadColsFromUser = async (viewId) => {
    const state = await loadColumnViewStateFromUser();
    return getColumnViewPayload(state, viewId || state.activeViewId);
  };

  const loadDefaultColsFromUser = async () => {
    const state = await loadColumnViewStateFromUser();
    const view = state.defaultViews.find((item) => item.id === DEFAULT_COLUMN_VIEW_ID) || state.defaultViews[0];
    return Array.isArray(view?.payload) && view.payload.length ? view.payload : null;
  };

  const saveDefaultColumnViewToUsers = async (view, targetUserIds = null, fieldColors = null) => {
    if (!IS_ADMIN) return { ok: false, total: 0, failCount: 0 };
    const sourceView = {
      id: DEFAULT_COLUMN_VIEW_ID,
      name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID],
      type: 'default',
      payload: withTermFieldColorsPayload(
        Array.isArray(view?.payload) && view.payload.length ? view.payload : buildInitialViewPayload(),
        fieldColors || {}
      ),
      updated_at: new Date().toISOString(),
    };
    const sourceHeaderColorMap = getHeaderColorMapFromPayload(sourceView.payload);
    const sourceTermFieldColors = getTermFieldColorsFromPayload(sourceView.payload, fieldColors || {});
    const sourceTermFieldBodyColors = getTermFieldBodyColorsFromPayload(sourceView.payload);
    const res = await ctx.request({ url: 'users:list', method: 'get', params: { pageSize: 200 } });
    const allUsers = Array.isArray(res?.data?.data) ? res.data.data : [];
    const targetSet = Array.isArray(targetUserIds) && targetUserIds.length ? new Set(targetUserIds.map((id) => String(id))) : null;
    const userList = allUsers.filter((user) => {
      if (!user?.id) return false;
      return targetSet ? targetSet.has(String(user.id)) : true;
    });
    if (!userList.length) return { ok: false, total: 0, failCount: 0 };
    const results = await Promise.allSettled(
      userList.map(async (user) => {
        const uid = user?.id;
        if (!uid) return;
        const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
        const existingSetting = userRes?.data?.data?.setting || {};
        const currentDefaults = normalizeColumnViewList(existingSetting[DEFAULT_COLUMN_VIEWS_KEY]);
        const nextDefaults = currentDefaults.map((item) => item.id === DEFAULT_COLUMN_VIEW_ID ? sourceView : item);
        const existingState = normalizeColumnViewState(existingSetting);
        const syncedViews = syncHeaderColorsIntoColumnViews(
          existingState.views.map((item) => item.id === DEFAULT_COLUMN_VIEW_ID ? sourceView : item),
          sourceHeaderColorMap,
          sourceTermFieldColors,
          sourceView.updated_at,
          sourceTermFieldBodyColors
        );
        const nextSetting = {
          ...existingSetting,
          [DEFAULT_COLUMN_VIEWS_KEY]: { views: nextDefaults },
          [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload({ ...existingState, views: syncedViews }, existingState.activeViewId),
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

  const saveDefaultColumnViewToCurrentUser = async (view, fieldColors = null) => {
    if (!IS_ADMIN || !currentUserId) return false;
    const sourceView = {
      id: DEFAULT_COLUMN_VIEW_ID,
      name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID],
      type: 'default',
      payload: withTermFieldColorsPayload(
        Array.isArray(view?.payload) && view.payload.length ? view.payload : buildInitialViewPayload(),
        fieldColors || {}
      ),
      updated_at: new Date().toISOString(),
    };
    const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
    const existingSetting = userRes?.data?.data?.setting || {};
    const currentDefaults = normalizeColumnViewList(existingSetting[DEFAULT_COLUMN_VIEWS_KEY]);
    const nextDefaults = currentDefaults.map((item) => item.id === DEFAULT_COLUMN_VIEW_ID ? sourceView : item);
    const existingState = normalizeColumnViewState(existingSetting);
    const sourceHeaderColorMap = getHeaderColorMapFromPayload(sourceView.payload);
    const sourceTermFieldColors = getTermFieldColorsFromPayload(sourceView.payload, fieldColors || {});
    const sourceTermFieldBodyColors = getTermFieldBodyColorsFromPayload(sourceView.payload);
    const syncedViews = syncHeaderColorsIntoColumnViews(
      existingState.views.map((item) => item.id === DEFAULT_COLUMN_VIEW_ID ? sourceView : item),
      sourceHeaderColorMap,
      sourceTermFieldColors,
      sourceView.updated_at,
      sourceTermFieldBodyColors
    );
    await ctx.request({
      url: 'users:update',
      method: 'post',
      params: { filterByTk: currentUserId },
      data: {
        setting: {
          ...existingSetting,
          [DEFAULT_COLUMN_VIEWS_KEY]: { views: nextDefaults },
          [COLUMN_VIEW_SETTING_KEY]: buildColumnViewSettingPayload({ ...existingState, views: syncedViews }, existingState.activeViewId),
          [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME,
        },
      },
    });
    return true;
  };

  const loadTermFieldColorsFromUser = async () => {
    if (!currentUserId) return {};
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const saved = userRes?.data?.data?.setting?.[TERM_FIELD_COLOR_SETTING_KEY];
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
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
    const termFieldTemplate = getTermFieldTemplateFromPayload(saved);
    const payloadTermFieldColors = getTermFieldColorsFromPayload(saved);
    if (!saved || !Array.isArray(saved) || !saved.length) {
      return INITIAL_COLUMNS.map((c) => ({ ...c }));
    }
    const initMap  = Object.fromEntries(INITIAL_COLUMNS.map((c) => [c.key, c]));
    const savedRows = saved.filter((s) => s?.key && s.key !== TERM_FIELD_TEMPLATE_KEY && s.key !== TERM_FIELD_COLORS_KEY && !isTermColumnConfig(s));
    const savedMap = Object.fromEntries(savedRows.map((s) => [s.key, s]));
    const result   = [];
    savedRows.forEach((s) => {
      if (!s?.key) return;
      if (initMap[s.key]) {
        result.push({
          ...initMap[s.key],
          hidden: s.hidden === true,
          pinned: s.pinned === true,
          width: Number(s.width) || initMap[s.key].width,
          headerColor: migrateLegacyColor(s.headerColor),
          editable: s.editable === true,
        });
        return;
      }
      if (s._isTermColumn && s.src && s.field && s.label) {
        const subDef = TERM_SUB_FIELDS.find((sub) => sub.key === s.field);
        const template = termFieldTemplate[s.field] || {};
        result.push({
          ...s,
          label: subDef?.label || s.label,
          hidden: template.hidden === true,
          pinned: s.pinned === true,
          width: Math.max(Number(template.width) || Number(s.width) || subDef?.width || 80, getTermSubFieldMinWidth(s.field, s._termSubType || subDef?.type)),
          headerColor: migrateLegacyColor(s.headerColor),
          bodyColor: template.bodyColor || null,
          termGroupHeaderColor: migrateLegacyColor(s.termGroupHeaderColor),
          termFieldHeaderColor: payloadTermFieldColors[s.field] || migrateLegacyColor(s.termFieldHeaderColor),
          editable: template.editable === true || s.editable === true,
        });
      }
    });
    INITIAL_COLUMNS.forEach((c) => { if (!savedMap[c.key]) result.push({ ...c }); });
    return result;
  };

  const buildColumns = async () => {
    const state = await loadColumnViewStateFromUser();
    const payload = getColumnViewPayload(state, state.activeViewId);
    return mergeColumnsWithInitial(payload || buildInitialViewPayload());
  };

  const formatCell = (col, row) => {
    const v = row[col.field];

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
      return d.toLocaleDateString('zh-CN');
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
    const normalizePanelSearchText = (text) => String(text || '').trim().toLowerCase();
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
    const normalizedUserSearch = normalizePanelSearchText(userSearchText);
    const visibleDepartmentGroups = useMemo(() => {
      if (!normalizedUserSearch) return departmentGroups;
      return departmentGroups
        .map((group) => {
          const deptMatched = normalizePanelSearchText(group.dept).includes(normalizedUserSearch);
          const users = deptMatched
            ? group.users
            : group.users.filter((user) => normalizePanelSearchText(getUserName(user)).includes(normalizedUserSearch));
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
      } catch (err) { ctx.message.error(`推送失败：${err?.message || '未知错误'}`); }
      finally { setPushing(false); }
    }, [onClose, onPush, selectedUserIds]);

    return React.createElement('div', {
      style: { position: 'fixed', top: `${anchorPos.top}px`, left: `${anchorPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', width: '480px', fontSize: `${FONT_SIZE}px` },
      onClick: (e) => e.stopPropagation(),
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', null, '📤 推送默认视图'),
        React.createElement('span', { onClick: onClose, style: { cursor: 'pointer', color: '#999', fontSize: '18px' } }, '✕'),
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
      React.createElement('div', { style: { marginBottom: '16px', padding: '8px 10px', color: '#555', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' } }, `已选择 ${selectedUserIds.length} 位用户，推送内容为 SQP 默认视图、词下字段模板和词下字段颜色。`),
      React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
        React.createElement('button', { onClick: onClose, disabled: pushing, style: { padding: '6px 16px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: pushing ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px` } }, '取消'),
        React.createElement('button', { onClick: handlePush, disabled: pushing || loadingUsers || !selectedUserIds.length, style: { padding: '6px 16px', color: '#fff', border: 'none', borderRadius: '4px', fontSize: `${FONT_SIZE}px`, fontWeight: 600, background: (pushing || loadingUsers || !selectedUserIds.length) ? '#b5d8ff' : '#1890ff', cursor: (pushing || loadingUsers || !selectedUserIds.length) ? 'not-allowed' : 'pointer' } }, pushing ? '推送中...' : '📤 确认推送'),
      ),
    );
  };

  const metricLineStyle = {
    display: 'grid',
    gridTemplateColumns: '58px 1fr 58px 1fr',
    gap: '2px 6px',
    alignItems: 'center',
    fontSize: '12px',
    lineHeight: '18px',
  };

  const formatInt = (v) => (v == null || v === '' ? '-' : Number(v).toLocaleString('zh-CN'));
  const formatFixed2 = (v) => (v == null || v === '' ? '-' : Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
  const formatRate = (v) => (v == null || v === '' ? '-' : `${(Number(v) * 100).toFixed(2)}%`);
  const formatSmall = (v) => (v == null || v === '' ? '-' : Number(v).toFixed(1));
  const safeNum = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
  const div0 = (a, b) => safeNum(b) === 0 ? 0 : safeNum(a) / safeNum(b);
  const isValidNumber = (v) => v != null && v !== '' && !Number.isNaN(Number(v));
  const roundRateValue = (v) => (isValidNumber(v) ? Math.round(Number(v) * 10000) / 10000 : null);
  const REQUIRED_ORDERS_FIELDS = new Set(['weekly_required_orders', 'daily_required_orders']);
  const STAGE_TARGET_SYNC_FIELDS = new Set([
    'stage_target_share',
    'stage_target_share_is_manual',
    'weekly_required_orders',
    'daily_required_orders',
    'compare_diagnosis',
  ]);
  const roundRequiredOrders = (v) => (isValidNumber(v) ? Math.ceil(Number(v)) : null);
  const normalizeStageTargetShare = (v) => (isValidNumber(v) ? roundRateValue(Number(v)) : null);
  const hasStageTargetValue = (v) => isValidNumber(v);
  const hasStageTargetManualFlag = (term) => (
    term &&
    Object.prototype.hasOwnProperty.call(term, 'stage_target_share_is_manual') &&
    term.stage_target_share_is_manual !== null &&
    term.stage_target_share_is_manual !== ''
  );
  const isStageTargetManual = (term) => {
    const value = term?.stage_target_share_is_manual;
    return value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';
  };
  const resolveStageTargetShare = (term, stageDefaultState = { loaded: false, value: null }) => {
    const manualFlagExists = hasStageTargetManualFlag(term);
    const savedShare = normalizeStageTargetShare(term?.stage_target_share);
    const savedShareExists = hasStageTargetValue(term?.stage_target_share);
    const manual = isStageTargetManual(term) || (!manualFlagExists && savedShareExists);
    if (manual) return { value: savedShare, manual: true };
    if (stageDefaultState?.loaded !== true) {
      return { value: savedShareExists ? savedShare : null, manual: false };
    }
    return { value: normalizeStageTargetShare(stageDefaultState.value), manual: false };
  };
  const buildStageTargetDerivedValues = (term, stageDefaultState, purchasesCount) => {
    const resolved = resolveStageTargetShare(term, stageDefaultState);
    const weeklyRequired = calcWeeklyRequiredOrders(resolved.value, purchasesCount);
    return {
      stage_target_share: resolved.value,
      stage_target_share_is_manual: resolved.manual,
      weekly_required_orders: weeklyRequired,
      daily_required_orders: calcDailyRequiredOrders(weeklyRequired),
    };
  };
  const withResolvedStageTarget = (payload, sourceTerm, stageDefaultState) => ({
    ...payload,
    ...buildStageTargetDerivedValues(sourceTerm || payload, stageDefaultState, payload?.purchases_count),
  });
  const pickStageTargetSyncUpdates = (updates) => {
    const picked = {};
    Object.entries(updates || {}).forEach(([field, value]) => {
      if (STAGE_TARGET_SYNC_FIELDS.has(field)) picked[field] = value;
    });
    return picked;
  };
  const getAsinUniqueKey = (country, asin) => {
    const cleanCountry = String(country || '').trim();
    const cleanAsin = String(asin || '').trim();
    return cleanCountry && cleanAsin ? `${cleanAsin}_${cleanCountry}` : null;
  };
  const fetchAsinDefaultStageShare = async (country, asin) => {
    const unique = getAsinUniqueKey(country, asin);
    if (!unique) return { loaded: true, value: null };
    try {
      const res = await ctx.request({
        url: 'asin:list',
        method: 'get',
        params: {
          pageSize: 1,
          filter: JSON.stringify({ unique: { $eq: unique } }),
        },
      });
      const row = Array.isArray(res?.data?.data) ? res.data.data[0] : null;
      return { loaded: true, value: normalizeStageTargetShare(row?.default_stage_target_share) };
    } catch (err) {
      console.error('读取 ASIN 默认阶段目标份额失败:', err);
      return { loaded: false, value: null };
    }
  };
  const calcWeeklyRequiredOrders = (stageShare, purchasesCount) => (
    stageShare == null || stageShare === '' || !isValidNumber(purchasesCount)
      ? null
      : roundRequiredOrders(safeNum(stageShare) * Number(purchasesCount))
  );
  const calcDailyRequiredOrders = (weeklyRequired) => (
    isValidNumber(weeklyRequired) ? roundRequiredOrders(Number(weeklyRequired) / 7) : null
  );
  const getRequiredOrdersDisplay = (field, term) => {
    if (!REQUIRED_ORDERS_FIELDS.has(field)) return null;
    if (term?.stage_target_share == null || term.stage_target_share === '') return '请填写目标份额';
    return formatInt(roundRequiredOrders(term?.[field]));
  };
  const nullableSum = (rows, field) => {
    let hasValue = false;
    const total = rows.reduce((s, row) => {
      if (!isValidNumber(row?.[field])) return s;
      hasValue = true;
      return s + Number(row[field]);
    }, 0);
    return hasValue ? total : null;
  };
  const getMarketSourceRows = (rows) => {
    const byAsin = {};
    (rows || []).forEach((row) => {
      const rowAsin = String(row?.asin || '').trim();
      if (!rowAsin) return;
      if (!byAsin[rowAsin]) byAsin[rowAsin] = [];
      byAsin[rowAsin].push(row);
    });
    const sourceAsin = Object.keys(byAsin).sort((a, b) => byAsin[b].length - byAsin[a].length || a.localeCompare(b))[0];
    return sourceAsin ? byAsin[sourceAsin] : (rows || []);
  };
  const divNull = (a, b) => (isValidNumber(a) && isValidNumber(b) && Number(b) !== 0) ? roundRateValue(Number(a) / Number(b)) : null;
  const getMainWeekKey = (row) => row?.country_asin_week_date || row?.country_asin_weekDate || row?.country_asin_weekdate || row?.id;
  const getTermMainWeekKey = (row) => row?.country_asin_weekDate || row?.country_asin_week_date || row?.country_asin_weekdate || row?.id;
  const parseWeekNo = (label) => {
    const m = String(label || '').match(/\d+/);
    return m ? Number(m[0]) : null;
  };
  const deltaText = (cur, prev, unit = '', showBasePercent = false) => {
    if (!isValidNumber(cur) || !isValidNumber(prev)) return '数据不足';
    const diff = safeNum(cur) - safeNum(prev);
    const arrow = diff > 0 ? '↑+' : '↓-';
    if (unit === 'rate') return `${arrow}${Math.abs(diff * 100).toFixed(2)}%`;
    const base = showBasePercent ? (safeNum(prev) === 0 ? '新' : `${Math.round(Math.abs(diff) / safeNum(prev) * 100)}%`) : '';
    const suffix = showBasePercent ? `(${base})` : '';
    if (unit === 'wan') return `${arrow}${(Math.abs(diff) / 10000).toFixed(1)}万${suffix}`;
    return `${arrow}${Math.trunc(Math.abs(diff))}${suffix}`;
  };
  const diagnosisLine = (label, text) => text === '数据不足' ? `${label} -- 数据不足` : `${label}${text}`;
  const diagnosisPairLine = (label, firstLabel, first, secondLabel, second) => {
    if (first === '数据不足' || second === '数据不足') return `${label} -- 数据不足`;
    return `${label}${firstLabel}${first} | ${secondLabel}${second}`;
  };
  const getTermDiagnosisPrefix = (term) => {
    const termName = String(term?.term_name || '').trim();
    if (!termName) return '';
    const termTypeLabel = term?.term_type === 'root' ? '词根' : '关键词';
    return `【${termTypeLabel} ${termName}】 `;
  };
  const getDiagnosisWeekLabel = (term) => {
    const label = String(term?.week_label || '').trim();
    if (label) return label;
    if (isValidNumber(term?.week_no)) return `第${Number(term.week_no)}周`;
    return '';
  };
  const withTrailingSpace = (text) => text ? `${text} ` : '';
  const buildMarketDiagnosis = (cur, prev) => !prev ? null : [
    `${getTermDiagnosisPrefix(cur)}市场${getDiagnosisWeekLabel(cur)} 环比${getDiagnosisWeekLabel(prev)}：`,
    diagnosisLine('①搜寻数量', deltaText(cur.search_query_volume, prev.search_query_volume, 'wan', true)),
    diagnosisLine('②曝光', deltaText(cur.impressions_count, prev.impressions_count, 'wan', true)),
    diagnosisLine('③点击', deltaText(cur.clicks_count, prev.clicks_count, 'wan', true)),
    diagnosisLine('④加购', deltaText(cur.cart_additions_count, prev.cart_additions_count, '', true)),
    diagnosisLine('⑤单量', deltaText(cur.purchases_count, prev.purchases_count, '', true)),
    diagnosisLine('⑥CTR', deltaText(cur.market_ctr, prev.market_ctr, 'rate')),
    diagnosisLine('⑦加购率', deltaText(cur.market_cart_rate, prev.market_cart_rate, 'rate')),
    diagnosisLine('⑧CVR', deltaText(cur.market_cvr, prev.market_cvr, 'rate')),
  ].join('\n');
  const buildAsinDiagnosis = (cur, prev) => !prev ? null : [
    `${getTermDiagnosisPrefix(cur)}${withTrailingSpace(getDiagnosisWeekLabel(cur))}Asin 环比${getDiagnosisWeekLabel(prev)}：`,
    diagnosisPairLine('①点击份额', '', deltaText(cur.asin_click_share, prev.asin_click_share, 'rate'), '点击', deltaText(cur.clicks_asin_count, prev.clicks_asin_count)),
    diagnosisPairLine('②加购份额', '', deltaText(cur.asin_cart_share, prev.asin_cart_share, 'rate'), '加购', deltaText(cur.cart_additions_asin_count, prev.cart_additions_asin_count)),
    diagnosisPairLine('③购买份额', '', deltaText(cur.asin_purchase_share, prev.asin_purchase_share, 'rate'), '单量', deltaText(cur.purchases_asin_count, prev.purchases_asin_count)),
    diagnosisLine('④CTR', deltaText(cur.asin_ctr, prev.asin_ctr, 'rate')),
    diagnosisLine('⑤加购率', deltaText(cur.asin_cart_rate, prev.asin_cart_rate, 'rate')),
    diagnosisLine('⑥CVR', deltaText(cur.asin_cvr, prev.asin_cvr, 'rate')),
  ].join('\n');
  const rateDiff = (a, b) => (!isValidNumber(a) || !isValidNumber(b)) ? '数据不足' : `${(Math.abs(safeNum(a) - safeNum(b)) * 100).toFixed(2)}%`;
  const compareRateLine = (label, asinValue, marketValue) => {
    const diff = rateDiff(asinValue, marketValue);
    if (diff === '数据不足') return `${label} -- 数据不足`;
    return `${asinValue < marketValue ? `${label}差-` : `${label}优+`}${diff}`;
  };
  const buildCompareDiagnosis = (cur) => {
    const hasOrderData = isValidNumber(cur.weekly_required_orders) && isValidNumber(cur.purchases_asin_count);
    const requiredOrders = safeNum(cur.weekly_required_orders);
    const asinOrders = safeNum(cur.purchases_asin_count);
    return [
      `${getTermDiagnosisPrefix(cur)}${withTrailingSpace(getDiagnosisWeekLabel(cur))}Asin 同比市场：`,
      compareRateLine('①CTR', cur.asin_ctr, cur.market_ctr),
      compareRateLine('②CVR', cur.asin_cvr, cur.market_cvr),
      compareRateLine('③加购率', cur.asin_cart_rate, cur.market_cart_rate),
      hasOrderData
        ? `${requiredOrders > asinOrders ? '④出单未达标' : '④出单已OK'}|${asinOrders - requiredOrders > 0 ? `超${Math.trunc(asinOrders - requiredOrders)}单` : `缺${Math.trunc(Math.abs(asinOrders - requiredOrders))}单`}`
        : '④出单 -- 数据不足',
    ].join('\n');
  };
  const buildStoredTermFormulaUpdates = (term, mainRow = {}, prevTerm = null, stageDefaultState = { loaded: false, value: null }) => {
    const stageTargetValues = buildStageTargetDerivedValues(term, stageDefaultState, term.purchases_count);
    const cur = {
      ...term,
      ...stageTargetValues,
      week_label: mainRow.week_label || term.week_label,
      week_no: term.week_no || parseWeekNo(mainRow.week_label),
      market_ctr: divNull(term.clicks_count, term.impressions_count),
      asin_ctr: divNull(term.clicks_asin_count, term.impressions_asin_count),
      market_cart_rate: divNull(term.cart_additions_count, term.clicks_count),
      asin_cart_rate: divNull(term.cart_additions_asin_count, term.clicks_asin_count),
      market_cvr: divNull(term.purchases_count, term.clicks_count),
      asin_cvr: divNull(term.purchases_asin_count, term.clicks_asin_count),
      asin_click_share: divNull(term.clicks_asin_count, term.clicks_count),
      asin_cart_share: divNull(term.cart_additions_asin_count, term.cart_additions_count),
      asin_purchase_share: divNull(term.purchases_asin_count, term.purchases_count),
    };
    return {
      market_ctr: cur.market_ctr,
      asin_ctr: cur.asin_ctr,
      market_cart_rate: cur.market_cart_rate,
      asin_cart_rate: cur.asin_cart_rate,
      market_cvr: cur.market_cvr,
      asin_cvr: cur.asin_cvr,
      asin_click_share: cur.asin_click_share,
      asin_cart_share: cur.asin_cart_share,
      asin_purchase_share: cur.asin_purchase_share,
      stage_target_share: cur.stage_target_share,
      stage_target_share_is_manual: cur.stage_target_share_is_manual,
      weekly_required_orders: cur.weekly_required_orders,
      daily_required_orders: cur.daily_required_orders,
      compare_diagnosis: buildCompareDiagnosis(cur),
      ...(prevTerm ? {
        market_diagnosis: buildMarketDiagnosis(cur, prevTerm),
        asin_diagnosis: buildAsinDiagnosis(cur, prevTerm),
      } : {}),
    };
  };

  const TermSummaryCell = ({ term, asinStageDefaultState, onStageShareSaved }) => {
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(term?.stage_target_share != null ? Number(term.stage_target_share) * 100 : null);
    const [saving, setSaving] = useState(false);
    useEffect(() => {
      setValue(term?.stage_target_share != null ? Number(term.stage_target_share) * 100 : null);
    }, [term?.term_week_key, term?.stage_target_share]);

    if (!term) {
      return React.createElement('div', { style: { color: '#bbb', textAlign: 'center', fontSize: '12px' } }, '无数据');
    }

    const save = async () => {
      try {
        setSaving(true);
        const isManualInput = !(value === '' || value == null);
        const stageShare = isManualInput
          ? roundRateValue(Number(value) / 100)
          : normalizeStageTargetShare(asinStageDefaultState?.value);
        const weeklyRequired = calcWeeklyRequiredOrders(stageShare, term.purchases_count);
        const dailyRequired = calcDailyRequiredOrders(weeklyRequired);
        const nextTerm = {
          ...term,
          stage_target_share: stageShare,
          stage_target_share_is_manual: isManualInput,
          weekly_required_orders: weeklyRequired,
          daily_required_orders: dailyRequired,
        };
        const compareDiagnosis = isValidNumber(term.purchases_count)
          ? buildCompareDiagnosis(nextTerm)
          : null;
        const dataPatch = {
          stage_target_share: stageShare,
          stage_target_share_is_manual: isManualInput,
          weekly_required_orders: weeklyRequired,
          daily_required_orders: dailyRequired,
          compare_diagnosis: compareDiagnosis,
        };
        await ctx.request({
          url: 'sqp_term_weekly:update',
          method: 'post',
          params: { filterByTk: term.term_week_key },
          data: dataPatch,
        });
        onStageShareSaved?.(term.term_week_key, dataPatch);
        setEditing(false);
        ctx.message.success('阶段目标已保存');
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const diagnosis = [term.market_diagnosis, term.asin_diagnosis, term.compare_diagnosis].filter(Boolean).join('\n\n');
    const renderValue = (sub) => {
      if (sub.type === 'rate') return formatRate(term[sub.key]);
      if (sub.type === 'number') {
        const requiredDisplay = getRequiredOrdersDisplay(sub.key, term);
        return requiredDisplay || formatInt(term[sub.key]);
      }
      if (sub.type === 'stageRate') {
        if (editing) {
          return React.createElement('span', { style: { display: 'inline-flex', gap: 4, alignItems: 'center' } },
            React.createElement(InputNumber, {
              size: 'small',
              min: 0,
              max: 100,
              step: 0.01,
              value,
              addonAfter: '%',
              style: { width: 84 },
              disabled: saving,
              onChange: setValue,
              onPressEnter: save,
            }),
            React.createElement(Button, { size: 'small', type: 'primary', loading: saving, onClick: save }, '存')
          );
        }
        return formatRate(term.stage_target_share);
      }
      if (sub.type === 'diagnosis') return diagnosis || '-';
      return term[sub.key] ?? '-';
    };
    const cellBox = (sub) => {
      const content = React.createElement('div', {
        onDoubleClick: sub.type === 'stageRate' ? () => setEditing(true) : undefined,
        style: {
          width: '100%',
          minHeight: '32px',
          padding: '6px 8px',
          border: '1px solid #d0d5dd',
          borderRadius: 4,
          background: '#fff',
          boxSizing: 'border-box',
          display: 'flex',
          alignItems: sub.type === 'diagnosis' ? 'flex-start' : 'center',
          justifyContent: sub.type === 'diagnosis' ? 'flex-start' : 'center',
          overflow: sub.type === 'diagnosis' ? 'visible' : 'hidden',
          textOverflow: sub.type === 'diagnosis' ? 'clip' : 'ellipsis',
          whiteSpace: sub.type === 'diagnosis' ? 'pre-wrap' : 'nowrap',
          lineHeight: sub.type === 'diagnosis' ? 1.55 : undefined,
          cursor: sub.type === 'stageRate' ? 'cell' : 'default',
          color: sub.type === 'stageRate' ? '#1677ff' : '#333',
          fontWeight: sub.type === 'number' || sub.type === 'rate' ? 700 : 500,
          fontSize: '12px',
        },
      }, renderValue(sub));
      return content;
    };

    return React.createElement('div', {
      style: {
        display: 'flex',
        gap: `${TERM_GAP}px`,
        alignItems: 'center',
        width: '100%',
        boxSizing: 'border-box',
        padding: '2px',
      }
    },
      TERM_SUB_FIELDS.map((sub) =>
        React.createElement('div', {
          key: sub.key,
          style: {
            flex: `0 0 ${sub.width}px`,
            maxWidth: `${sub.width}px`,
            minWidth: 0,
            display: 'flex',
            boxSizing: 'border-box',
          }
        }, cellBox(sub))
      )
    );
  };

  const normalizeChartDate = (value) => value ? String(value).slice(0, 10) : '';
  const getChartTermKey = (term) => `${term?.term_type === 'root' ? 'root' : 'keyword'}_${term?.term_id || term?.term_name || ''}`;
  const getChartTermTypeLabel = (type) => type === 'root' ? '词根' : '关键词';
  const keepValidSelection = (prev, validValues, fallbackValues) => {
    const validSet = new Set(validValues);
    const kept = (prev || []).filter((value) => validSet.has(value));
    return kept.length ? kept : fallbackValues;
  };
  const formatChartNumber = (value, axis) => {
    if (!isValidNumber(value)) return '-';
    if (axis === 'right') return formatRate(value);
    const num = Number(value);
    return Math.abs(num) >= 1000
      ? num.toLocaleString('zh-CN', { maximumFractionDigits: 0 })
      : num.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  };

  const TrendLineChart = ({ weeks, series }) => {
    const width = 1460;
    const height = 660;
    const margin = { top: 52, right: 96, bottom: 132, left: 96 };
    const plotWidth = width - margin.left - margin.right;
    const plotHeight = height - margin.top - margin.bottom;
    const selectedWeeks = weeks || [];
    const safeSeries = (series || []).filter((item) => item?.data?.some(isValidNumber));
    const [hoverIndex, setHoverIndex] = useState(null);
    if (!selectedWeeks.length || !safeSeries.length) {
      return React.createElement('div', {
        style: {
          minHeight: '360px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#94a3b8',
          background: '#111827',
          border: '1px solid #1f2937',
          borderRadius: '8px',
        },
      }, '所选条件没有真实数据');
    }

    const buildScale = (values) => {
      const clean = values.filter(isValidNumber).map(Number);
      if (!clean.length) return null;
      let min = Math.min(...clean);
      let max = Math.max(...clean);
      if (min > 0) min = 0;
      if (max === min) {
        max = max === 0 ? 1 : max * 1.2;
        min = 0;
      }
      const pad = (max - min) * 0.08;
      return { min: Math.max(0, min - pad), max: max + pad };
    };
    const leftScale = buildScale(safeSeries.filter((item) => item.axis === 'left').flatMap((item) => item.data));
    const rightScale = buildScale(safeSeries.filter((item) => item.axis === 'right').flatMap((item) => item.data));
    const gridScale = leftScale || rightScale;
    const ticks = (scale) => {
      if (!scale) return [];
      const count = 5;
      return Array.from({ length: count }, (_, index) => scale.min + ((scale.max - scale.min) * index) / (count - 1));
    };
    const xFor = (index) => selectedWeeks.length === 1
      ? margin.left + plotWidth / 2
      : margin.left + (plotWidth * index) / (selectedWeeks.length - 1);
    const yFor = (value, scale) => margin.top + ((scale.max - Number(value)) / (scale.max - scale.min)) * plotHeight;
    const pathFor = (item, scale) => {
      let path = '';
      let started = false;
      item.data.forEach((value, index) => {
        if (!isValidNumber(value)) {
          started = false;
          return;
        }
        path += `${started ? 'L' : 'M'} ${xFor(index).toFixed(2)} ${yFor(value, scale).toFixed(2)} `;
        started = true;
      });
      return path.trim();
    };
    const compactDate = (dateText) => {
      const text = normalizeChartDate(dateText);
      return text ? text.slice(5).replace('-', '/') : '';
    };
    const weekName = (week) => week?.weekNo ? `周 ${week.weekNo}` : (week?.shortLabel || week?.reportDate || '周');
    const compactDateRange = (week) => {
      const start = compactDate(week?.weekStartDate);
      const end = compactDate(week?.reportDate);
      if (start && end && start !== end) return `${start}-${end}`;
      return start || end || '';
    };
    const fullDateRange = (week) => {
      const start = normalizeChartDate(week?.weekStartDate);
      const end = normalizeChartDate(week?.reportDate);
      if (start && end && start !== end) return `${start} - ${end}`;
      return start || end || '';
    };
    const bandBounds = (index) => {
      const x = xFor(index);
      const prevX = index > 0 ? xFor(index - 1) : margin.left;
      const nextX = index < selectedWeeks.length - 1 ? xFor(index + 1) : margin.left + plotWidth;
      return {
        x1: selectedWeeks.length === 1 ? margin.left : (prevX + x) / 2,
        x2: selectedWeeks.length === 1 ? margin.left + plotWidth : (x + nextX) / 2,
      };
    };
    const activeHoverIndex = Number.isInteger(hoverIndex) && hoverIndex >= 0 && hoverIndex < selectedWeeks.length ? hoverIndex : null;
    const hoverWeek = activeHoverIndex == null ? null : selectedWeeks[activeHoverIndex];
    const hoverX = activeHoverIndex == null ? null : xFor(activeHoverIndex);
    const hoverRows = hoverWeek ? safeSeries.map((item) => {
      const value = item.data?.[activeHoverIndex];
      return {
        key: item.key,
        name: item.name,
        axis: item.axis,
        color: item.color,
        value,
        hasValue: isValidNumber(value),
      };
    }) : [];
    const tooltipLeft = hoverX == null ? '50%' : `${Math.min(92, Math.max(8, (hoverX / width) * 100))}%`;
    const tooltipTransform = hoverX != null && hoverX > width * 0.62
      ? 'translateX(-100%) translateX(-12px)'
      : 'translateX(12px)';

    return React.createElement('div', {
      style: {
        position: 'relative',
        background: '#111827',
        border: '1px solid #1f2937',
        borderRadius: '8px',
        padding: '16px',
        color: '#cbd5e1',
      },
      onMouseLeave: () => setHoverIndex(null),
    },
      React.createElement('svg', {
        viewBox: `0 0 ${width} ${height}`,
        width: '100%',
        height: 'auto',
        role: 'img',
        style: { display: 'block' },
      },
        React.createElement('rect', { x: 0, y: 0, width, height, fill: '#111827' }),
        ticks(gridScale).map((tick, index) => {
          const y = yFor(tick, gridScale);
          return React.createElement('g', { key: `grid_${index}` },
            React.createElement('line', { x1: margin.left, y1: y, x2: margin.left + plotWidth, y2: y, stroke: '#243244', strokeWidth: 1 }),
            leftScale && React.createElement('text', { x: margin.left - 12, y: y + 4, textAnchor: 'end', fill: '#94a3b8', fontSize: 13 }, formatChartNumber(tick, 'left')),
            rightScale && React.createElement('text', { x: margin.left + plotWidth + 12, y: y + 4, textAnchor: 'start', fill: '#94a3b8', fontSize: 13 }, formatChartNumber(tick, 'right'))
          );
        }),
        React.createElement('line', { x1: margin.left, y1: margin.top, x2: margin.left, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('line', { x1: margin.left + plotWidth, y1: margin.top, x2: margin.left + plotWidth, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('line', { x1: margin.left, y1: margin.top + plotHeight, x2: margin.left + plotWidth, y2: margin.top + plotHeight, stroke: '#334155', strokeWidth: 1.5 }),
        React.createElement('text', { x: 20, y: margin.top + plotHeight / 2, fill: '#94a3b8', fontSize: 14, transform: `rotate(-90 20 ${margin.top + plotHeight / 2})`, textAnchor: 'middle' }, '数值'),
        React.createElement('text', { x: width - 20, y: margin.top + plotHeight / 2, fill: '#F59E0B', fontSize: 14, transform: `rotate(90 ${width - 20} ${margin.top + plotHeight / 2})`, textAnchor: 'middle' }, '百分比'),
        selectedWeeks.map((week, index) => {
          const x = xFor(index);
          return React.createElement('g', { key: week.key },
            React.createElement('line', { x1: x, y1: margin.top, x2: x, y2: margin.top + plotHeight, stroke: '#1f2937', strokeWidth: 1 }),
            React.createElement('text', {
              x,
              y: margin.top + plotHeight + 30,
              fill: '#94a3b8',
              fontSize: 12,
              textAnchor: 'end',
              transform: `rotate(-38 ${x} ${margin.top + plotHeight + 30})`,
            },
              React.createElement('tspan', { x, dy: 0 }, weekName(week)),
              compactDateRange(week) && React.createElement('tspan', { x, dy: 15 }, compactDateRange(week))
            )
          );
        }),
        safeSeries.map((item, index) => {
          const scale = item.axis === 'right' ? rightScale : leftScale;
          if (!scale) return null;
          return React.createElement('path', {
            key: `line_${item.key}`,
            d: pathFor(item, scale),
            fill: 'none',
            stroke: item.color,
            strokeWidth: 2.5,
            strokeLinejoin: 'round',
            strokeLinecap: 'round',
            opacity: index >= 12 ? 0.78 : 0.95,
          });
        }),
        safeSeries.flatMap((item) => {
          const scale = item.axis === 'right' ? rightScale : leftScale;
          if (!scale) return [];
          return item.data.map((value, index) => {
            if (!isValidNumber(value)) return null;
            const week = selectedWeeks[index];
            return React.createElement('circle', {
              key: `pt_${item.key}_${week.key}`,
              cx: xFor(index),
              cy: yFor(value, scale),
              r: 3.8,
              fill: item.color,
              stroke: '#111827',
              strokeWidth: 1.5,
            });
          }).filter(Boolean);
        }),
        safeSeries.flatMap((item, seriesIndex) => {
          const scale = item.axis === 'right' ? rightScale : leftScale;
          if (!scale) return [];
          const labelOffset = [-12, 18, -24, 30][seriesIndex % 4];
          return item.data.map((value, index) => {
            if (!isValidNumber(value)) return null;
            const week = selectedWeeks[index];
            const y = yFor(value, scale);
            const nextY = Math.min(margin.top + plotHeight - 8, Math.max(margin.top + 10, y + labelOffset));
            return React.createElement('text', {
              key: `pt_label_${item.key}_${week.key}`,
              x: xFor(index),
              y: nextY,
              fill: item.color,
              fontSize: selectedWeeks.length > 16 ? 10 : 11,
              fontWeight: 800,
              textAnchor: 'middle',
              stroke: '#111827',
              strokeWidth: 4,
              paintOrder: 'stroke',
              pointerEvents: 'none',
            }, formatChartNumber(value, item.axis));
          }).filter(Boolean);
        }),
        selectedWeeks.map((week, index) => {
          const bounds = bandBounds(index);
          return React.createElement('rect', {
            key: `hover_band_${week.key}`,
            x: bounds.x1,
            y: margin.top,
            width: Math.max(1, bounds.x2 - bounds.x1),
            height: plotHeight,
            fill: 'transparent',
            pointerEvents: 'all',
            style: { cursor: 'crosshair' },
            onMouseEnter: () => setHoverIndex(index),
            onMouseMove: () => setHoverIndex(index),
          });
        }),
        hoverWeek && React.createElement('g', { pointerEvents: 'none' },
          React.createElement('line', {
            x1: hoverX,
            y1: margin.top,
            x2: hoverX,
            y2: margin.top + plotHeight,
            stroke: '#e2e8f0',
            strokeWidth: 1.4,
            strokeDasharray: '4 5',
            opacity: 0.72,
          }),
          hoverRows.filter((row) => row.hasValue).map((row) => {
            const scale = row.axis === 'right' ? rightScale : leftScale;
            if (!scale) return null;
            return React.createElement('circle', {
              key: `hover_pt_${row.key}`,
              cx: hoverX,
              cy: yFor(row.value, scale),
              r: 6,
              fill: row.color,
              stroke: '#f8fafc',
              strokeWidth: 2,
            });
          }).filter(Boolean)
        )
      ),
      hoverWeek && React.createElement('div', {
        style: {
          position: 'absolute',
          top: '54px',
          left: tooltipLeft,
          transform: tooltipTransform,
          width: '360px',
          maxWidth: 'calc(100% - 32px)',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(148, 163, 184, 0.45)',
          background: 'rgba(15, 23, 42, 0.96)',
          color: '#e2e8f0',
          boxShadow: '0 18px 42px rgba(15, 23, 42, 0.36)',
          pointerEvents: 'auto',
          zIndex: 2,
        },
      },
        React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '4px' } },
          React.createElement('span', { style: { color: '#f8fafc', fontWeight: 800 } }, weekName(hoverWeek)),
          React.createElement('span', { style: { color: '#94a3b8', fontSize: `${FONT_SIZE_XS}px` } }, hoverRows.filter((row) => row.hasValue).length, '/', hoverRows.length)
        ),
        React.createElement('div', { style: { color: '#94a3b8', fontSize: `${FONT_SIZE_XS}px`, marginBottom: '8px' } }, fullDateRange(hoverWeek) || hoverWeek.label),
        React.createElement('div', { style: { display: 'grid', gap: '5px', maxHeight: '260px', overflowY: 'auto', paddingRight: '2px' } },
          hoverRows.map((row) => React.createElement('div', {
            key: `tooltip_${row.key}`,
            style: {
              display: 'grid',
              gridTemplateColumns: '10px minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: '8px',
              fontSize: `${FONT_SIZE_XS}px`,
            },
          },
            React.createElement('span', { style: { width: '8px', height: '8px', borderRadius: '50%', background: row.color } }),
            React.createElement('span', { title: row.name, style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#cbd5e1' } }, row.name),
            React.createElement('span', { style: { color: row.hasValue ? '#f8fafc' : '#64748b', fontWeight: 800 } }, row.hasValue ? formatChartNumber(row.value, row.axis) : '-')
          ))
        )
      ),
      React.createElement('div', {
        style: {
          display: 'flex',
          flexWrap: 'wrap',
          gap: '8px 14px',
          padding: '4px 4px 0',
          maxHeight: '104px',
          overflowY: 'auto',
        },
      },
        safeSeries.map((item) => React.createElement('div', {
          key: `legend_${item.key}`,
          title: item.name,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            maxWidth: '320px',
            color: '#cbd5e1',
            fontSize: `${FONT_SIZE_XS}px`,
          },
        },
          React.createElement('span', { style: { width: '18px', height: '3px', borderRadius: '2px', background: item.color, flexShrink: 0 } }),
          React.createElement('span', { style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, item.name)
        ))
      )
    );
  };

  const SqpTrendChartModal = ({ visible, onClose, country, asin }) => {
    const [loading, setLoading] = useState(false);
    const [errorText, setErrorText] = useState('');
    const [weeks, setWeeks] = useState([]);
    const [termRows, setTermRows] = useState([]);
    const [termOptions, setTermOptions] = useState([]);
    const [selectedWeekKeys, setSelectedWeekKeys] = useState([]);
    const [selectedTermKeys, setSelectedTermKeys] = useState([]);
    const [selectedMetricKeys, setSelectedMetricKeys] = useState(CHART_DEFAULT_FIELD_KEYS);
    const countryAsin = country && asin ? `${country}_${asin}` : null;

    const metricOptions = useMemo(() => CHART_METRIC_FIELDS.map((field) => ({
      value: field.key,
      label: `${field.label}${field.axis === 'right' ? '（百分比）' : '（数值）'}`,
    })), []);
    const metricMap = useMemo(() => Object.fromEntries(CHART_METRIC_FIELDS.map((field) => [field.key, field])), []);
    const termOptionMap = useMemo(() => Object.fromEntries(termOptions.map((item) => [item.value, item])), [termOptions]);

    useEffect(() => {
      if (!visible) return undefined;
      let active = true;
      const fetchAll = async (url, params = {}) => {
        const pageSize = 500;
        const rows = [];
        for (let page = 1; page <= 10000; page += 1) {
          const res = await ctx.request({
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

      const loadChartData = async () => {
        setErrorText('');
        if (!countryAsin) {
          setWeeks([]);
          setTermRows([]);
          setTermOptions([]);
          setSelectedWeekKeys([]);
          setSelectedTermKeys([]);
          return;
        }
        try {
          setLoading(true);
          const filter = JSON.stringify({ country_asin: { $eq: countryAsin } });
          const [weekRows, rawTermRows, keywords, roots] = await Promise.all([
            fetchAll('sqp_weekly_main:list', { sort: 'report_date', filter }),
            fetchAll('sqp_term_weekly:list', { sort: ['term_type', 'term_name', 'report_date'], filter }),
            fetchAll('sqp_keywords:list', { sort: TERM_ADDED_ORDER_SORT, filter }),
            fetchAll('sqp_roots:list', { sort: TERM_ADDED_ORDER_SORT, filter }),
          ]);
          if (!active) return;

          const keywordIds = new Set(keywords.map((item) => item?.id == null ? '' : String(item.id)).filter(Boolean));
          const keywordNames = new Set(keywords.map((item) => String(item?.keyword_name || '').trim()).filter(Boolean));
          const rootIds = new Set(roots.map((item) => item?.id == null ? '' : String(item.id)).filter(Boolean));
          const rootNames = new Set(roots.map((item) => String(item?.root_name || '').trim()).filter(Boolean));
          const hasActiveTerms = keywordIds.size || keywordNames.size || rootIds.size || rootNames.size;
          const activeTermRows = rawTermRows.filter((term) => {
            if (!hasActiveTerms) return true;
            const termId = term?.term_id == null ? '' : String(term.term_id);
            const termName = String(term?.term_name || '').trim();
            if (term?.term_type === 'root') return (termId && rootIds.has(termId)) || (termName && rootNames.has(termName));
            return (termId && keywordIds.has(termId)) || (termName && keywordNames.has(termName));
          });

          const weekMap = new Map();
          weekRows.forEach((row) => {
            const reportDate = normalizeChartDate(row.report_date);
            if (!reportDate) return;
            const weekNo = parseWeekNo(row.week_label);
            weekMap.set(reportDate, {
              key: reportDate,
              reportDate,
              weekStartDate: normalizeChartDate(row.week_start_date),
              weekNo,
              label: `${weekNo ? `周 ${weekNo}` : (row.week_label || '周')} | ${normalizeChartDate(row.week_start_date) || '-'} - ${reportDate}`,
              shortLabel: weekNo ? `周${weekNo}` : reportDate,
            });
          });
          activeTermRows.forEach((row) => {
            const reportDate = normalizeChartDate(row.report_date);
            if (!reportDate || weekMap.has(reportDate)) return;
            const weekNo = Number(row.week_no) || parseWeekNo(row.week_label);
            weekMap.set(reportDate, {
              key: reportDate,
              reportDate,
              weekStartDate: '',
              weekNo,
              label: `${weekNo ? `周 ${weekNo}` : '周'} | - - ${reportDate}`,
              shortLabel: weekNo ? `周${weekNo}` : reportDate,
            });
          });
          const nextWeeks = Array.from(weekMap.values()).sort((a, b) => String(a.reportDate).localeCompare(String(b.reportDate)));

          const termMap = new Map();
          activeTermRows.forEach((term) => {
            const key = getChartTermKey(term);
            const name = String(term?.term_name || '').trim();
            if (!key || !name || termMap.has(key)) return;
            const type = term?.term_type === 'root' ? 'root' : 'keyword';
            termMap.set(key, {
              value: key,
              label: `${getChartTermTypeLabel(type)}：${name}`,
              termName: name,
              termType: type,
              sortText: `${type === 'root' ? '1' : '0'}_${name}`,
            });
          });
          const nextTermOptions = Array.from(termMap.values()).sort((a, b) => a.sortText.localeCompare(b.sortText, undefined, { numeric: true }));
          const validWeekKeys = nextWeeks.map((item) => item.key);
          const validTermKeys = nextTermOptions.map((item) => item.value);
          const validMetricKeys = CHART_METRIC_FIELDS.map((item) => item.key);
          setWeeks(nextWeeks);
          setTermRows(activeTermRows);
          setTermOptions(nextTermOptions);
          setSelectedWeekKeys((prev) => keepValidSelection(prev, validWeekKeys, validWeekKeys));
          setSelectedTermKeys((prev) => keepValidSelection(prev, validTermKeys, validTermKeys.slice(0, 1)));
          setSelectedMetricKeys((prev) => keepValidSelection(prev, validMetricKeys, CHART_DEFAULT_FIELD_KEYS));
        } catch (err) {
          if (!active) return;
          setErrorText(`加载图表数据失败：${err?.message || '未知错误'}`);
          setWeeks([]);
          setTermRows([]);
          setTermOptions([]);
        } finally {
          if (active) setLoading(false);
        }
      };

      loadChartData();
      return () => { active = false; };
    }, [visible, countryAsin]);

    const chartPayload = useMemo(() => {
      const selectedWeekSet = new Set(selectedWeekKeys);
      const selectedWeeks = weeks.filter((week) => selectedWeekSet.has(week.key));
      const termWeekRows = {};
      termRows.forEach((row) => {
        const termKey = getChartTermKey(row);
        const weekKey = normalizeChartDate(row.report_date);
        if (!termKey || !weekKey) return;
        if (!termWeekRows[termKey]) termWeekRows[termKey] = {};
        termWeekRows[termKey][weekKey] = row;
      });
      const nextSeries = [];
      selectedTermKeys.forEach((termKey) => {
        const term = termOptionMap[termKey];
        selectedMetricKeys.forEach((fieldKey) => {
          const metric = metricMap[fieldKey];
          if (!term || !metric) return;
          const data = selectedWeeks.map((week) => {
            const row = termWeekRows[termKey]?.[week.key];
            const value = row?.[fieldKey];
            return isValidNumber(value) ? Number(value) : null;
          });
          if (!data.some(isValidNumber)) return;
          const color = CHART_LINE_COLORS[nextSeries.length % CHART_LINE_COLORS.length];
          nextSeries.push({
            key: `${termKey}_${fieldKey}`,
            name: `${term.label} + ${metric.label}`,
            axis: metric.axis,
            color,
            data,
          });
        });
      });
      return { weeks: selectedWeeks, series: nextSeries };
    }, [metricMap, selectedMetricKeys, selectedTermKeys, selectedWeekKeys, termOptionMap, termRows, weeks]);

    const latestWeekKeys = weeks.slice(-8).map((week) => week.key);
    const modalTitle = countryAsin ? `SQP 趋势图：${countryAsin}` : 'SQP 趋势图';

    return React.createElement(Modal, {
      title: modalTitle,
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 'min(1520px, calc(100vw - 64px))',
      destroyOnClose: false,
      bodyStyle: { padding: '16px 20px 20px', maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' },
    },
      !countryAsin
        ? React.createElement('div', { style: { padding: 24, color: '#999' } }, '请先通过 URL 或筛选进入具体 country + asin。')
        : React.createElement('div', null,
          React.createElement('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: '1.15fr 1.15fr 1fr',
              gap: '10px',
              marginBottom: '10px',
            },
          },
            React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 700, color: '#334155' } }, '选择关键词/词根'),
              React.createElement(Select, {
                mode: 'multiple',
                allowClear: true,
                showSearch: true,
                placeholder: loading ? '正在加载词...' : '选择一个或多个关键词/词根',
                value: selectedTermKeys,
                options: termOptions,
                onChange: setSelectedTermKeys,
                optionFilterProp: 'label',
                maxTagCount: 'responsive',
                loading,
                style: { width: '100%' },
              })
            ),
            React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 700, color: '#334155' } }, '选择指标字段'),
              React.createElement(Select, {
                mode: 'multiple',
                allowClear: true,
                showSearch: true,
                placeholder: '选择一个或多个指标字段',
                value: selectedMetricKeys,
                options: metricOptions,
                onChange: setSelectedMetricKeys,
                optionFilterProp: 'label',
                maxTagCount: 'responsive',
                style: { width: '100%' },
              })
            ),
            React.createElement('div', null,
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 700, color: '#334155' } }, '按周筛选'),
              React.createElement(Select, {
                mode: 'multiple',
                allowClear: true,
                showSearch: true,
                placeholder: loading ? '正在加载周...' : '选择要展示的周',
                value: selectedWeekKeys,
                options: weeks.map((week) => ({ value: week.key, label: week.label })),
                onChange: setSelectedWeekKeys,
                optionFilterProp: 'label',
                maxTagCount: 'responsive',
                loading,
                style: { width: '100%' },
              })
            )
          ),
          React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', alignItems: 'center' } },
            React.createElement('span', { style: { color: '#64748b', fontWeight: 700, fontSize: `${FONT_SIZE_SM}px` } }, '快捷：'),
            ...CHART_QUICK_GROUPS.map((group) => React.createElement('button', {
              key: group.label,
              onClick: () => setSelectedMetricKeys(group.fields),
              style: { padding: '4px 10px', border: '1px solid #bae6fd', background: '#f0f9ff', color: '#0369a1', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: `${FONT_SIZE_XS}px` },
            }, group.label)),
            React.createElement('span', { style: { color: '#cbd5e1' } }, '|'),
            React.createElement('button', {
              onClick: () => setSelectedWeekKeys(weeks.map((week) => week.key)),
              style: { padding: '4px 10px', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', borderRadius: '4px', cursor: 'pointer', fontWeight: 700, fontSize: `${FONT_SIZE_XS}px` },
            }, '全部周'),
            React.createElement('button', {
              onClick: () => setSelectedWeekKeys(latestWeekKeys),
              disabled: !latestWeekKeys.length,
              style: { padding: '4px 10px', border: '1px solid #fed7aa', background: latestWeekKeys.length ? '#fff7ed' : '#f8fafc', color: latestWeekKeys.length ? '#c2410c' : '#94a3b8', borderRadius: '4px', cursor: latestWeekKeys.length ? 'pointer' : 'not-allowed', fontWeight: 700, fontSize: `${FONT_SIZE_XS}px` },
            }, '最近8周'),
            React.createElement('span', { style: { marginLeft: 'auto', color: '#64748b', fontSize: `${FONT_SIZE_XS}px` } },
              loading ? '正在加载真实数据...' : `周 ${selectedWeekKeys.length}/${weeks.length}，词 ${selectedTermKeys.length}/${termOptions.length}`
            )
          ),
          errorText && React.createElement('div', { style: { marginBottom: '12px', padding: '8px 10px', background: '#fff1f0', border: '1px solid #ffccc7', borderRadius: '6px', color: '#cf1322' } }, errorText),
          React.createElement(TrendLineChart, { weeks: chartPayload.weeks, series: chartPayload.series }),
          React.createElement('div', { style: { marginTop: '8px', color: '#64748b', fontSize: `${FONT_SIZE_XS}px` } },
            '说明：空值不按 0 处理，折线会在空值处断开。'
          )
        )
    );
  };

  const TermManagerModal = ({ visible, onClose, country, asin, onRefresh, recalculatingIds = {}, onRecalcStateChange, onRecalcProgress, onRecalcFinish }) => {
    const [tab, setTab] = useState('keyword');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const [lockedDefaultNames, setLockedDefaultNames] = useState(new Set());
    const countryAsin = country && asin ? `${country}_${asin}` : null;
    const collection = tab === 'keyword' ? 'sqp_keywords' : 'sqp_roots';
    const nameField = tab === 'keyword' ? 'keyword_name' : 'root_name';
    const title = tab === 'keyword' ? '关键词' : '词根';
    const normalizeTermName = (value) => String(value || '').trim().toLowerCase();
    const isDefaultLocked = (item) => lockedDefaultNames.has(normalizeTermName(item?.[nameField]));

    const findTermItem = async (termName) => {
      const res = await ctx.request({
        url: `${collection}:list`,
        method: 'get',
        params: {
          pageSize: 1,
          filter: JSON.stringify({
            $and: [
              { country_asin: { $eq: countryAsin } },
              { [nameField]: { $eq: termName } },
            ],
          }),
        },
      });
      return Array.isArray(res?.data?.data) ? res.data.data[0] : null;
    };

    const recalcTermWeekly = async (termItem, nextName, onProgress) => {
      const termName = String(nextName || termItem?.[nameField] || '').trim();
      if (!termItem?.id || !countryAsin || !termName) return 0;

      const fetchAll = async (url, params = {}) => {
        const pageSize = 500;
        const rows = [];
        for (let page = 1; page <= 10000; page += 1) {
          const res = await ctx.request({
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

      const stageDefaultState = await fetchAsinDefaultStageShare(country, asin);
      const weeks = await fetchAll('sqp_weekly_main:list', {
        sort: 'report_date',
        filter: JSON.stringify({ country_asin: { $eq: countryAsin } }),
      });
      const reportDates = weeks
        .map((week) => week.report_date ? String(week.report_date).slice(0, 10) : '')
        .filter(Boolean)
        .sort();
      onProgress?.({ label: `正在读取当前 ASIN 品牌`, percent: 5 });
      const asinRows = await fetchAll('asin:list', {
        filter: JSON.stringify({ unique: { $eq: getAsinUniqueKey(country, asin) } }),
      });
      const asinRow = asinRows[0] || {};
      const modelName = String(asinRow.model || '').trim();
      let currentBrand = String(asinRow.brand || '').trim();
      if (!currentBrand && modelName) {
        const skuRows = await fetchAll('sku:list', {
          sort: 'sku',
          filter: JSON.stringify({
            $and: [
              { country: { $eq: country } },
              { model: { $eq: modelName } },
            ],
          }),
        });
        currentBrand = String(skuRows[0]?.brand || '').trim();
      }
      if (!currentBrand) currentBrand = DEFAULT_MARKET_BRAND;
      const sameBrandAsinRows = await fetchAll('asin:list', {
        filter: JSON.stringify({
          $and: [
            { country: { $eq: country } },
            { brand: { $eq: currentBrand } },
          ],
        }),
      });
      const sameBrandAsins = new Set(
        sameBrandAsinRows.map((item) => String(item?.asin || '').trim()).filter(Boolean)
      );
      sameBrandAsins.add(String(asin || '').trim());
      onProgress?.({ label: `正在批量读取${title} ${termName}同品牌明细`, percent: 6 });
      const [sqpRows, existingTermRows] = await Promise.all([
        reportDates.length ? fetchAll('sqp:list', {
          filter: JSON.stringify({
            $and: [
              { country: { $eq: country } },
              { report_date: { $gte: reportDates[0] } },
              { report_date: { $lte: reportDates[reportDates.length - 1] } },
            ],
          }),
        }) : [],
        fetchAll('sqp_term_weekly:list', {
          filter: JSON.stringify({
            $and: [
              { country_asin: { $eq: countryAsin } },
              { term_type: { $eq: tab === 'keyword' ? 'keyword' : 'root' } },
              { term_id: { $eq: termItem.id } },
            ],
          }),
        }),
      ]);
      const existingTermMap = {};
      existingTermRows.forEach((row) => {
        if (row?.term_week_key) existingTermMap[row.term_week_key] = row;
      });
      const sqpRowsByReportDate = {};
      const reportDateSet = new Set(reportDates);
      sqpRows.forEach((row) => {
        const reportDate = row?.report_date ? String(row.report_date).slice(0, 10) : '';
        if (!reportDate || !reportDateSet.has(reportDate)) return;
        if (!sameBrandAsins.has(String(row?.asin || '').trim())) return;
        if (!sqpRowsByReportDate[reportDate]) sqpRowsByReportDate[reportDate] = [];
        sqpRowsByReportDate[reportDate].push(row);
      });
      let count = 0;
      let prevPayload = null;
      const recalculatedRows = [];
      const writeJobs = [];

      for (const week of weeks) {
        const reportDate = week.report_date ? String(week.report_date).slice(0, 10) : null;
        if (!reportDate) continue;
        onProgress?.({
          label: `正在重算${title} ${termName}：${count + 1}/${weeks.length}`,
          percent: 8 + (weeks.length ? (count / weeks.length) * 86 : 0),
        });
        const sqpRows = sqpRowsByReportDate[reportDate] || [];
        const termType = tab === 'keyword' ? 'keyword' : 'root';
        const isMatchedTermRow = (row) => {
          const searchQuery = String(row.search_query || '').trim();
          if (!searchQuery) return false;
          return termType === 'root'
            ? searchQuery.includes(termName)
            : searchQuery === termName;
        };
        const currentAsinRows = sqpRows.filter((row) => String(row.asin || '').trim() === String(asin || '').trim());
        const matchedMarketRows = getMarketSourceRows(sqpRows).filter(isMatchedTermRow);
        const matchedAsinRows = currentAsinRows.filter(isMatchedTermRow);

        const searchQueryVolume = nullableSum(matchedMarketRows, 'search_query_volume');
        const impressionsCount = nullableSum(matchedMarketRows, 'impressions_count');
        const clicksCount = nullableSum(matchedMarketRows, 'clicks_count');
        const cartAdditionsCount = nullableSum(matchedMarketRows, 'cart_additions_count');
        const purchasesCount = nullableSum(matchedMarketRows, 'purchases_count');
        const impressionsAsinCount = nullableSum(matchedAsinRows, 'impressions_asin_count');
        const clicksAsinCount = nullableSum(matchedAsinRows, 'clicks_asin_count');
        const cartAdditionsAsinCount = nullableSum(matchedAsinRows, 'cart_additions_asin_count');
        const purchasesAsinCount = nullableSum(matchedAsinRows, 'purchases_asin_count');
        const hasTermData = [
          searchQueryVolume, impressionsCount, clicksCount, cartAdditionsCount, purchasesCount,
          impressionsAsinCount, clicksAsinCount, cartAdditionsAsinCount, purchasesAsinCount,
        ].some(isValidNumber);
        const mainKey = getMainWeekKey(week);
        const termWeekKey = `${country}_${asin}_${reportDate}_${termType}_${termItem.id}`;

        const payload = {
          term_week_key: termWeekKey,
          country_asin_weekDate: mainKey,
          country_asin: countryAsin,
          country,
          asin,
          report_date: reportDate,
          week_no: parseWeekNo(week.week_label),
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
          market_ctr: divNull(clicksCount, impressionsCount),
          asin_ctr: divNull(clicksAsinCount, impressionsAsinCount),
          market_cart_rate: divNull(cartAdditionsCount, clicksCount),
          asin_cart_rate: divNull(cartAdditionsAsinCount, clicksAsinCount),
          market_cvr: divNull(purchasesCount, clicksCount),
          asin_cvr: divNull(purchasesAsinCount, clicksAsinCount),
          asin_click_share: divNull(clicksAsinCount, clicksCount),
          asin_cart_share: divNull(cartAdditionsAsinCount, cartAdditionsCount),
          asin_purchase_share: divNull(purchasesAsinCount, purchasesCount),
          stage_target_share: null,
          weekly_required_orders: null,
          daily_required_orders: null,
          market_diagnosis: null,
          asin_diagnosis: null,
          compare_diagnosis: null,
        };
        const payloadWithLabel = { ...payload, week_label: week.week_label };
        if (hasTermData) {
          payload.market_diagnosis = buildMarketDiagnosis(payloadWithLabel, prevPayload);
          payload.asin_diagnosis = buildAsinDiagnosis(payloadWithLabel, prevPayload);
          payload.compare_diagnosis = buildCompareDiagnosis(payloadWithLabel);
        }

        const rec = existingTermMap[payload.term_week_key] || null;
        const nextPayload = withResolvedStageTarget(payload, rec || payload, stageDefaultState);
        if (hasTermData) {
          nextPayload.market_diagnosis = payload.market_diagnosis;
          nextPayload.asin_diagnosis = payload.asin_diagnosis;
          nextPayload.compare_diagnosis = buildCompareDiagnosis({ ...nextPayload, week_label: week.week_label });
        }
        if (rec?.term_week_key) writeJobs.push({ type: 'update', key: rec.term_week_key, data: nextPayload });
        else writeJobs.push({ type: 'create', data: withCreateTimestamps(nextPayload) });
        recalculatedRows.push(nextPayload);
        prevPayload = hasTermData ? payloadWithLabel : null;
        count += 1;
      }
      if (writeJobs.length) {
        onProgress?.({ label: `正在并发写回${title} ${termName}：0/${writeJobs.length}`, percent: 92 });
        const batchSize = 50;
        for (let i = 0; i < writeJobs.length; i += batchSize) {
          const batch = writeJobs.slice(i, i + batchSize);
          const done = Math.min(i + batch.length, writeJobs.length);
          onProgress?.({ label: `正在并发写回${title} ${termName}：${done}/${writeJobs.length}`, percent: 92 + (done / writeJobs.length) * 4 });
          const results = await Promise.allSettled(batch.map((job) => ctx.request({
            url: job.type === 'update' ? 'sqp_term_weekly:update' : 'sqp_term_weekly:create',
            method: 'post',
            ...(job.type === 'update' ? { params: { filterByTk: job.key } } : {}),
            data: job.data,
          })));
          const failed = results.filter((result) => result.status === 'rejected');
          if (failed.length) throw new Error(`写回失败 ${failed.length} 条`);
        }
      }
      onProgress?.({ label: `正在合并${title} ${termName}重算结果`, percent: 96 });
      return { count, rows: recalculatedRows };
    };

    const load = useCallback(async () => {
      if (!visible || !countryAsin) { setItems([]); setLockedDefaultNames(new Set()); return; }
      setLoading(true);
      try {
        const fetchAll = async (url, params = {}) => {
          const pageSize = 500;
          const rows = [];
          for (let page = 1; page <= 10000; page += 1) {
            const res = await ctx.request({
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
        const rows = await fetchAll(`${collection}:list`, {
          sort: TERM_ADDED_ORDER_SORT,
          filter: JSON.stringify({ country_asin: { $eq: countryAsin } }),
        });
        setItems(sortTermsByAddedOrder(rows));
        let modelName = '';
        const asinRows = await fetchAll('asin:list', {
          filter: JSON.stringify({ unique: { $eq: getAsinUniqueKey(country, asin) } }),
        });
        modelName = String(asinRows[0]?.model || '').trim();
        let categoryName = '';
        if (modelName) {
          const skuRows = await fetchAll('sku:list', {
            sort: 'sku',
            filter: JSON.stringify({
              $and: [
                { country: { $eq: country } },
                { model: { $eq: modelName } },
              ],
            }),
          });
          categoryName = String(skuRows[0]?.type || '').trim();
        }
        if (!categoryName) {
          setLockedDefaultNames(new Set());
          return;
        }
        const defaults = await fetchAll('sqp_default_terms:list', {
          sort: 'id',
          filter: JSON.stringify({
            $and: [
              { country: { $eq: country } },
              { category: { $eq: categoryName } },
              { term_type: { $eq: tab === 'keyword' ? 'keyword' : 'root' } },
            ],
          }),
        });
        setLockedDefaultNames(new Set(defaults.map((item) => normalizeTermName(item.term_name)).filter(Boolean)));
      } catch (err) {
        ctx.message.error(`加载${title}失败：${err?.message || ''}`);
        setLockedDefaultNames(new Set());
      } finally {
        setLoading(false);
      }
    }, [visible, countryAsin, collection, country, asin, tab, title]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (!visible) { setName(''); setTab('keyword'); setEditingId(null); setEditingName(''); setUpdatingId(null); } }, [visible]);

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
        ctx.message.loading?.(`正在生成${title}汇总...`);
        const result = await recalcTermWeekly(termItem, trimmed);
        setName('');
        await load();
        onRefresh?.({ action: 'recalc', rows: result.rows });
        ctx.message.success(`新增成功，已生成 ${result.count} 周汇总`);
      } catch (err) {
        ctx.message.error(`新增失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const updateItem = async (item, value) => {
      if (isDefaultLocked(item)) {
        ctx.message.warning(`默认${title}不能改名`);
        return;
      }
      const nextValue = String(value || '').trim();
      if (!nextValue) {
        ctx.message.warning(`${title}名称不能为空`);
        return;
      }
      if (nextValue === String(item?.[nameField] || '').trim()) {
        setEditingId(null);
        setEditingName('');
        return;
      }
      try {
        setUpdatingId(item.id);
        await ctx.request({
          url: `${collection}:update`,
          method: 'post',
          params: { filterByTk: item.id },
          data: { [nameField]: nextValue },
        });
        setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, [nameField]: nextValue } : it));
        setEditingId(null);
        setEditingName('');
        ctx.message.success('名称已保存，正在后台重算汇总');
        onRecalcStateChange?.(item.id, true);
        onRecalcProgress?.({ label: `正在准备重算${title} ${nextValue}`, percent: 3 });
        setTimeout(async () => {
          try {
            const result = await recalcTermWeekly({ ...item, [nameField]: nextValue }, nextValue, onRecalcProgress);
            onRefresh?.({ action: 'recalc', rows: result.rows });
            ctx.message.success(`重算完成：${result.count} 周汇总`);
            onRecalcFinish?.(`重算完成：${title} ${nextValue}`);
          } catch (err) {
            ctx.message.error(`重算失败：${err?.message || ''}`);
            onRecalcFinish?.(`重算失败：${title} ${nextValue}`);
          } finally {
            onRecalcStateChange?.(item.id, false);
          }
        }, 0);
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      } finally {
        setUpdatingId(null);
      }
    };

    const deleteItem = async (item) => {
      try {
        if (isDefaultLocked(item)) {
          ctx.message.warning(`默认${title}不能删除`);
          return;
        }
        const termType = tab === 'keyword' ? 'keyword' : 'root';
        if (!item?.id) {
          ctx.message.warning(`未识别到${title}ID，无法清理汇总数据`);
          return;
        }
        let deletedTermRows = 0;
        while (true) {
          const termRowsRes = await ctx.request({
            url: 'sqp_term_weekly:list',
            method: 'get',
            params: {
              pageSize: 500,
              filter: JSON.stringify({
                $and: [
                  { country_asin: { $eq: countryAsin } },
                  { term_type: { $eq: termType } },
                  { term_id: { $eq: item.id } },
                ],
              }),
            },
          });
          const termRows = Array.isArray(termRowsRes?.data?.data) ? termRowsRes.data.data : [];
          if (!termRows.length) break;
          for (const row of termRows) {
            await ctx.request({
              url: 'sqp_term_weekly:destroy',
              method: 'post',
              params: { filterByTk: row.term_week_key || row.id },
            });
            deletedTermRows += 1;
          }
        }
        await ctx.request({ url: `${collection}:destroy`, method: 'post', params: { filterByTk: item.id } });
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        onRefresh?.();
        ctx.message.success(`已删除${title}，并清理 ${deletedTermRows} 条汇总数据`);
      } catch (err) {
        ctx.message.error(`删除失败：${err?.message || ''}`);
      }
    };

    return React.createElement(Modal, {
      title: countryAsin ? `管理 SQP ${title}：${countryAsin}` : `管理 SQP ${title}`,
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 680,
      destroyOnClose: true,
    },
      !countryAsin
        ? React.createElement('div', { style: { padding: 24, color: '#999' } }, '请先通过 URL 或筛选进入具体 country + asin。')
        : React.createElement('div', null,
            React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
              React.createElement(Button, { type: tab === 'keyword' ? 'primary' : 'default', onClick: () => setTab('keyword') }, '关键词'),
              React.createElement(Button, { type: tab === 'root' ? 'primary' : 'default', onClick: () => setTab('root') }, '词根')
            ),
            React.createElement('div', { style: { display: 'flex', gap: 8, marginBottom: 12 } },
              React.createElement(Input, { value: name, placeholder: `新增${title}`, onChange: (e) => setName(e.target.value), onPressEnter: addItem }),
              React.createElement(Button, { type: 'primary', loading: saving, onClick: addItem }, '新增')
            ),
            loading
              ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#999' } }, '加载中...')
              : React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                  items.length === 0 && React.createElement('div', { style: { padding: 20, color: '#999', textAlign: 'center', background: '#fafafa' } }, `暂无${title}`),
                  items.map((item) => {
                    const isEditing = editingId === item.id;
                    const currentName = item[nameField] || '';
                    const isUpdating = updatingId === item.id;
                    const isRecalculating = !!recalculatingIds[item.id];
                    const rowBusy = isUpdating || isRecalculating;
                    const locked = isDefaultLocked(item);
                    return React.createElement('div', {
                      key: item.id,
                      style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' },
                    },
                      isEditing
                        ? React.createElement(Input, {
                          value: editingName,
                          autoFocus: true,
                          disabled: isUpdating,
                          onChange: (e) => setEditingName(e.target.value),
                          onPressEnter: () => updateItem(item, editingName.trim()),
                        })
                        : React.createElement('div', {
                          style: {
                            minHeight: 32,
                            padding: '5px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            border: '1px solid #d9d9d9',
                            borderRadius: 4,
                            background: '#fafafa',
                            color: '#333',
                            gap: 8,
                          },
                        },
                          React.createElement('span', null, isRecalculating ? `${currentName || '-'}（重算中...）` : (currentName || '-')),
                          locked && React.createElement('span', {
                            style: {
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: '#f0f5ff',
                              border: '1px solid #adc6ff',
                              color: '#2f54eb',
                              fontSize: `${FONT_SIZE_XS}px`,
                              fontWeight: 700,
                            },
                          }, '默认')
                        ),
                      React.createElement('div', { style: { display: 'flex', gap: 6 } },
                        isEditing
                          ? React.createElement(React.Fragment, null,
                            React.createElement(Button, {
                              type: 'primary',
                              loading: isUpdating,
                              onClick: () => updateItem(item, editingName.trim()),
                            }, '保存'),
                            React.createElement(Button, {
                              disabled: isUpdating,
                              onClick: () => { setEditingId(null); setEditingName(''); },
                            }, '取消'),
                          )
                          : React.createElement(Button, {
                            disabled: rowBusy || locked,
                            onClick: () => { setEditingId(item.id); setEditingName(currentName); },
                          }, locked ? '默认' : (isRecalculating ? '重算中' : '编辑')),
                        React.createElement(Popconfirm, { title: `确定删除「${currentName || title}」？`, onConfirm: () => deleteItem(item), disabled: rowBusy || locked },
                          React.createElement(Button, { danger: true, disabled: rowBusy || isEditing || locked }, '删除')
                        )
                      )
                    );
                  })
                )
          )
    );
  };

  const DefaultTermConfigModal = ({ visible, onClose, onChanged, currentCountry, currentModel }) => {
    const [country, setCountry] = useState(DEFAULT_TERM_COUNTRIES[0]);
    const [category, setCategory] = useState('');
    const [categoryOptions, setCategoryOptions] = useState([]);
    const [currentAsinCategory, setCurrentAsinCategory] = useState('');
    const [tab, setTab] = useState('keyword');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editingName, setEditingName] = useState('');
    const [updatingId, setUpdatingId] = useState(null);
    const title = tab === 'root' ? '默认词根' : '默认关键词';
    const normalizeName = (value) => String(value || '').trim();
    const wasVisibleRef = useRef(false);
    const selectedCountryRef = useRef(country);
    selectedCountryRef.current = country;

    const loadCategoryOptions = useCallback(async () => {
      if (!visible) return;
      const selectedCountry = normalizeName(country);
      if (!selectedCountry) {
        setCategoryOptions([]);
        setCategory('');
        setCurrentAsinCategory('');
        return;
      }
      try {
        const fetchAll = async (url, params = {}) => {
          const pageSize = 500;
          const rows = [];
          for (let page = 1; page <= 10000; page += 1) {
            const res = await ctx.request({
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
        const cleanCountry = normalizeName(currentCountry);
        const cleanModel = normalizeName(currentModel);
        const defaultRows = await fetchAll('sqp_default_terms:list', {
          sort: 'category',
          filter: JSON.stringify({ country: { $eq: selectedCountry } }),
        });
        const currentSkuRows = cleanCountry && cleanModel
          ? await fetchAll('sku:list', {
              sort: 'sku',
              filter: JSON.stringify({
                $and: [
                  { country: { $eq: cleanCountry } },
                  { model: { $eq: cleanModel } },
                ],
              }),
            })
          : [];
        const preferredCategory = normalizeName(currentSkuRows[0]?.type);
        const preferredForSelectedCountry = selectedCountry === cleanCountry ? preferredCategory : '';
        const nextOptions = Array.from(new Set(
          defaultRows.map((item) => normalizeName(item.category)).filter(Boolean)
        ))
          .sort((a, b) => a.localeCompare(b, 'zh-Hans'))
          .map((item) => ({ value: item, label: item }));
        if (normalizeName(selectedCountryRef.current) !== selectedCountry) return;
        setCategoryOptions(nextOptions);
        setCurrentAsinCategory(preferredCategory);
        setCategory((prevCategory) => {
          const cleanCategory = normalizeName(prevCategory);
          const hasCurrent = nextOptions.some((item) => item.value === cleanCategory);
          const hasPreferred = preferredForSelectedCountry && nextOptions.some((item) => item.value === preferredForSelectedCountry);
          if (hasCurrent) return cleanCategory;
          if (hasPreferred) return preferredForSelectedCountry;
          return nextOptions[0]?.value || '';
        });
      } catch (err) {
        ctx.message.error(`加载类目失败：${err?.message || '未知错误'}`);
        setCategoryOptions([]);
        setCategory('');
        setCurrentAsinCategory('');
      }
    }, [visible, country, currentCountry, currentModel]);

    useEffect(() => {
      if (visible && !wasVisibleRef.current) {
        setCategory('');
      }
      wasVisibleRef.current = visible;
    }, [visible]);

    useEffect(() => {
      if (!visible) return;
      setName('');
      setEditingId(null);
      setEditingName('');
      setUpdatingId(null);
    }, [visible, country, category]);

    const load = useCallback(async () => {
      if (!visible || !category) {
        setItems([]);
        return;
      }
      setLoading(true);
      try {
        const res = await ctx.request({
          url: 'sqp_default_terms:list',
          method: 'get',
          params: {
            pageSize: 500,
            sort: 'id',
            filter: JSON.stringify({
              $and: [
                { country: { $eq: country } },
                { category: { $eq: category } },
                { term_type: { $eq: tab } },
              ],
            }),
          },
        });
        setItems(Array.isArray(res?.data?.data) ? res.data.data : []);
      } catch (err) {
        ctx.message.error(`加载${title}失败：${err?.message || '未知错误'}`);
        setItems([]);
      } finally {
        setLoading(false);
      }
    }, [visible, country, category, tab, title]);

    useEffect(() => { loadCategoryOptions(); }, [loadCategoryOptions]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => {
      if (visible && currentCountry && DEFAULT_TERM_COUNTRIES.includes(currentCountry)) {
        selectedCountryRef.current = currentCountry;
        setCountry(currentCountry);
      }
    }, [visible, currentCountry]);
    useEffect(() => {
      if (!visible) {
        setName('');
        setEditingId(null);
        setEditingName('');
        setUpdatingId(null);
      }
    }, [visible]);

    const existingNames = useMemo(() => new Set(items.map((item) => normalizeName(item.term_name).toLowerCase()).filter(Boolean)), [items]);
    const currentModelLabel = normalizeName(currentModel);

    const addItem = async () => {
      const trimmed = normalizeName(name);
      if (!category) { ctx.message.warning('请选择类目'); return; }
      if (!trimmed) { ctx.message.warning(`请输入${title}`); return; }
      if (existingNames.has(trimmed.toLowerCase())) { ctx.message.warning(`${title}已存在`); return; }
      try {
        setSaving(true);
        await ctx.request({
          url: 'sqp_default_terms:create',
          method: 'post',
          data: { country, category, term_type: tab, term_name: trimmed },
        });
        setName('');
        await load();
        onChanged?.();
        ctx.message.success(`${title}已新增`);
      } catch (err) {
        ctx.message.error(`新增${title}失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    };

    const updateItem = async (item, value) => {
      const nextValue = normalizeName(value);
      const currentValue = normalizeName(item?.term_name);
      if (!nextValue) { ctx.message.warning(`${title}不能为空`); return; }
      if (nextValue === currentValue) {
        setEditingId(null);
        setEditingName('');
        return;
      }
      const duplicated = items.some((it) => it.id !== item.id && normalizeName(it.term_name).toLowerCase() === nextValue.toLowerCase());
      if (duplicated) { ctx.message.warning(`${title}已存在`); return; }
      try {
        setUpdatingId(item.id);
        await ctx.request({
          url: 'sqp_default_terms:update',
          method: 'post',
          params: { filterByTk: item.id },
          data: { term_name: nextValue },
        });
        setEditingId(null);
        setEditingName('');
        await load();
        onChanged?.();
        ctx.message.success(`${title}已保存`);
      } catch (err) {
        ctx.message.error(`保存${title}失败：${err?.message || '未知错误'}`);
      } finally {
        setUpdatingId(null);
      }
    };

    const deleteItem = async (item) => {
      try {
        setUpdatingId(item.id);
        await ctx.request({
          url: 'sqp_default_terms:destroy',
          method: 'post',
          params: { filterByTk: item.id },
        });
        setItems((prev) => prev.filter((it) => it.id !== item.id));
        onChanged?.();
        ctx.message.success(`${title}已删除`);
      } catch (err) {
        ctx.message.error(`删除${title}失败：${err?.message || '未知错误'}`);
      } finally {
        setUpdatingId(null);
      }
    };

    return React.createElement(Modal, {
      title: '默认关键词/词根配置',
      open: visible,
      visible,
      onCancel: onClose,
      footer: null,
      width: 760,
      destroyOnClose: true,
    },
      React.createElement('div', { style: { display: 'grid', gap: '12px' } },
        React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: '120px 140px 1fr',
            gap: '10px',
            alignItems: 'center',
          },
        },
          React.createElement(Select, {
            value: country,
            onChange: setCountry,
            options: DEFAULT_TERM_COUNTRIES.map((item) => ({ value: item, label: item })),
          }),
          React.createElement(Select, {
            value: category,
            onChange: setCategory,
            placeholder: '选择类目',
            options: categoryOptions,
          }),
          React.createElement('div', { style: { display: 'flex', gap: 8 } },
            React.createElement(Button, { type: tab === 'keyword' ? 'primary' : 'default', onClick: () => setTab('keyword') }, '默认关键词'),
            React.createElement(Button, { type: tab === 'root' ? 'primary' : 'default', onClick: () => setTab('root') }, '默认词根')
          )
        ),

        React.createElement('div', {
          style: {
            padding: '7px 10px',
            borderRadius: '6px',
            border: '1px solid #bfdbfe',
            background: '#eff6ff',
            color: '#1d4ed8',
            fontSize: `${FONT_SIZE_XS}px`,
            lineHeight: 1.6,
          },
        }, `当前站点：${country || '未识别'}；当前型号：${currentModelLabel || '未识别'}；当前类目：${currentAsinCategory || '未识别'}（类目下拉仅来自当前选择站点的默认词配置）`),

        React.createElement('div', { style: { display: 'flex', gap: 8 } },
          React.createElement(Input, {
            value: name,
            placeholder: `新增${title}`,
            onChange: (e) => setName(e.target.value),
            onPressEnter: addItem,
          }),
          React.createElement(Button, { type: 'primary', loading: saving, onClick: addItem }, '新增')
        ),

        React.createElement('div', {
          style: {
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            overflow: 'hidden',
            background: '#fff',
          },
        },
          React.createElement('div', {
            style: {
              display: 'grid',
              gridTemplateColumns: '72px 1fr 150px',
              gap: 8,
              padding: '8px 10px',
              background: '#f8fafc',
              borderBottom: '1px solid #e5e7eb',
              color: '#475569',
              fontWeight: 800,
              fontSize: `${FONT_SIZE_SM}px`,
            },
          },
            React.createElement('span', null, '序号'),
            React.createElement('span', null, title),
            React.createElement('span', { style: { textAlign: 'right' } }, '操作')
          ),
          loading
            ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#94a3b8' } }, '加载中...')
            : items.length === 0
              ? React.createElement('div', { style: { padding: 24, textAlign: 'center', color: '#94a3b8' } }, `暂无${title}`)
              : React.createElement('div', { style: { maxHeight: '420px', overflowY: 'auto' } },
                items.map((item, index) => {
                  const isEditing = editingId === item.id;
                  const isBusy = updatingId === item.id;
                  const currentName = normalizeName(item.term_name);
                  return React.createElement('div', {
                    key: item.id,
                    style: {
                      display: 'grid',
                      gridTemplateColumns: '72px 1fr 150px',
                      gap: 8,
                      alignItems: 'center',
                      minHeight: '42px',
                      padding: '7px 10px',
                      borderBottom: index === items.length - 1 ? 'none' : '1px solid #f1f5f9',
                    },
                  },
                    React.createElement('span', { style: { color: '#64748b', fontVariantNumeric: 'tabular-nums' } }, index + 1),
                    isEditing
                      ? React.createElement(Input, {
                        value: editingName,
                        autoFocus: true,
                        disabled: isBusy,
                        onChange: (e) => setEditingName(e.target.value),
                        onPressEnter: () => updateItem(item, editingName),
                      })
                      : React.createElement('span', { style: { color: '#111827', fontWeight: 650 } }, currentName || '-'),
                    React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: 6 } },
                      isEditing
                        ? React.createElement(React.Fragment, null,
                          React.createElement(Button, { size: 'small', type: 'primary', loading: isBusy, onClick: () => updateItem(item, editingName) }, '保存'),
                          React.createElement(Button, { size: 'small', disabled: isBusy, onClick: () => { setEditingId(null); setEditingName(''); } }, '取消')
                        )
                        : React.createElement(Button, { size: 'small', disabled: isBusy, onClick: () => { setEditingId(item.id); setEditingName(currentName); } }, '编辑'),
                      React.createElement(Popconfirm, {
                        title: `确定删除「${currentName || title}」？`,
                        description: '只删除默认模板，不影响已生成的实际关键词/词根。',
                        onConfirm: () => deleteItem(item),
                        disabled: isBusy || isEditing,
                      },
                        React.createElement(Button, { size: 'small', danger: true, disabled: isBusy || isEditing }, '删除')
                      )
                    )
                  );
                })
              )
        ),
        React.createElement('div', { style: { color: '#64748b', fontSize: `${FONT_SIZE_XS}px`, lineHeight: 1.6 } },
          '默认模板用于进入具体站点和类目 ASIN 页面时自动补齐缺失词。删除模板不会删除已经生成的关键词、词根或周汇总。'
        )
      )
    );
  };

  const MergedTable = () => {
    const [data, setData]                       = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [showPanel, setShowPanel]             = useState(false);
    const [showPush, setShowPush]               = useState(false);
    const [showTermManager, setShowTermManager] = useState(false);
    const [showDefaultTermConfig, setShowDefaultTermConfig] = useState(false);
    const [showChartModal, setShowChartModal]   = useState(false);
    const [showStageDefaultModal, setShowStageDefaultModal] = useState(false);
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [termFieldColors, setTermFieldColors] = useState({});
    const [columnViews, setColumnViews]         = useState([]);
    const [activeColumnViewId, setActiveColumnViewId] = useState(DEFAULT_COLUMN_VIEW_ID);
    const [columnViewSwitching, setColumnViewSwitching] = useState(false);
    const [columnViewCreating, setColumnViewCreating] = useState(false);
    const [columnViewSaving, setColumnViewSaving] = useState(false);
    const [sortConfig, setSortConfig]           = useState({ key: 'sqp_report_date', dir: 'asc' });
    const [curPage, setCurPage]                 = useState(1);
    const [pageSize, setPageSize]               = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal]                     = useState(0);
    const [configReady, setConfigReady]         = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [editingCell, setEditingCell]         = useState(null);
    const [editValue, setEditValue]             = useState(null);
    const [saving, setSaving]                   = useState(false);
    const [isResizing, setIsResizing]           = useState(false);
    const [calculatingFormulas, setCalculatingFormulas] = useState(false);
    const [refreshingData, setRefreshingData]   = useState(false);
    const [refreshProgress, setRefreshProgress] = useState('');
    const [formulaProgress, setFormulaProgress] = useState({ active: false, label: '', percent: 0 });
    const [termRecalculatingIds, setTermRecalculatingIds] = useState({});
    const [asinStageDefaultState, setAsinStageDefaultState] = useState({ loaded: false, value: null });
    const [stageDefaultInput, setStageDefaultInput] = useState(null);
    const [savingStageDefault, setSavingStageDefault] = useState(false);
    const [stageDefaultProgress, setStageDefaultProgress] = useState({ active: false, label: '', percent: 0, status: 'normal' });
    const [defaultTermConfigVersion, setDefaultTermConfigVersion] = useState(0);
    const [dateFilterType, setDateFilterType]   = useState('all');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [selectedRange, setSelectedRange]     = useState(null);
    const [activeCell, setActiveCell]           = useState(null);
    const [crossHighlightEnabled, setCrossHighlightEnabled] = useState(false);
    const [crossHighlightColor, setCrossHighlightColor] = useState(DEFAULT_ACTIVE_CROSS_HIGHLIGHT_COLOR);
    const [showCrossHighlightPanel, setShowCrossHighlightPanel] = useState(false);
    const selectingRef = useRef(false);
    const autoWidthDoneRef = useRef(false);
    const manuallyResizedRef = useRef(new Set());
    const termColumnPrefsRef = useRef({ byKey: {}, fieldColors: {}, groupColors: {}, groupColorsByName: {} });
    const termFieldTemplateRef = useRef(getDefaultTermFieldTemplate());
    const columnViewsRef = useRef([]);
    const activeColumnViewIdRef = useRef(DEFAULT_COLUMN_VIEW_ID);
    const columnLayoutSaveTimerRef = useRef(null);
    const pendingColumnLayoutViewIdRef = useRef(null);

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
    const rootRef     = useRef(null);
    const tableWrapRef = useRef(null);
    const clipboardRef = useRef(null);
    const autoRefreshRef = useRef({ lastAt: 0, wasVisible: null });
    const autoDefaultTermsRef = useRef({ key: null, running: false });
    const calculateFormulasRef = useRef(null);
    const panelBtnRef = useRef(null);
    const pushBtnRef  = useRef(null);
    const crossHighlightBtnRef = useRef(null);
    const panelPos    = useFloatPos(panelBtnRef, showPanel);
    const pushPos     = useFloatPos(pushBtnRef, showPush);
    const crossHighlightPos = useFloatPos(crossHighlightBtnRef, showCrossHighlightPanel);

    const urlParams            = useMemo(() => loadUrlParams(), []);
    const filterAsin           = urlParams?.asin         || null;
    const filterCountry        = urlParams?.country      || null;
    const filterModel          = urlParams?.model        || null;
    const filterSaleOwner      = urlParams?.sale_owner   || null;
    const hasRequiredUrlParams = !!(filterModel && filterCountry && filterAsin && filterSaleOwner);

    const loadAsinStageDefaultShare = useCallback(async () => {
      const state = await fetchAsinDefaultStageShare(filterCountry, filterAsin);
      setAsinStageDefaultState(state);
      return state;
    }, [filterCountry, filterAsin]);

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

    const setTermRecalculating = useCallback((id, active) => {
      setTermRecalculatingIds((prev) => {
        const next = { ...prev };
        if (active) next[id] = true;
        else delete next[id];
        return next;
      });
    }, []);

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

    const isGroupCollapsed = useCallback((src) => collapsedGroups[src] !== false, [collapsedGroups]);
    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: prev[src] !== false ? false : true })); }, []);

    const rememberTermColumnPrefs = useCallback((cols, fixedFieldColors = null) => {
      const prefs = termColumnPrefsRef.current || { byKey: {}, fieldColors: {}, groupColors: {}, groupColorsByName: {} };
      if (fixedFieldColors) {
        prefs.fieldColors = { ...fixedFieldColors };
      }
      (cols || []).forEach((col) => {
        if (!col?._isTermColumn) return;
        prefs.byKey[col.key] = { ...prefs.byKey[col.key], ...col };
        if (col.termFieldHeaderColor) prefs.fieldColors[col.field] = col.termFieldHeaderColor;
        const groupKey = col._termGroupKey || col._termColumnKey;
        if (col.termGroupHeaderColor && groupKey) prefs.groupColors[groupKey] = col.termGroupHeaderColor;
        if (col.termGroupHeaderColor && col._termType && col._termName) {
          prefs.groupColorsByName[`${col._termType}:${String(col._termName).trim().toLowerCase()}`] = col.termGroupHeaderColor;
        }
      });
      termColumnPrefsRef.current = prefs;
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

    const applyColumnPayloadToLocal = useCallback((payload) => {
      const nextPayload = payload || buildInitialViewPayload();
      const baseColumns = mergeColumnsWithInitial(nextPayload);
      const nextFieldColors = getTermFieldColorsFromPayload(nextPayload);
      const nextTemplate = getTermFieldTemplateFromPayload(nextPayload);
      const currentTermColumns = columns.filter((col) => col?._isTermColumn);
      const nextTermColumns = currentTermColumns.map((col) => {
        const subDef = TERM_SUB_FIELDS.find((sub) => sub.key === col.field);
        const template = nextTemplate[col.field] || {};
        return {
          ...col,
          label: subDef?.label || col.label,
          hidden: template.hidden === true,
          width: Math.max(Number(template.width) || Number(col.width) || subDef?.width || 80, getTermSubFieldMinWidth(col.field, col._termSubType || subDef?.type)),
          editable: template.editable === true || col.editable === true,
          bodyColor: template.bodyColor || null,
          _termSubType: col._termSubType || subDef?.type,
          termFieldHeaderColor: nextFieldColors[col.field] || null,
        };
      });
      const nextColumns = [...baseColumns.filter((col) => !col?._isTermColumn), ...nextTermColumns];
      termFieldTemplateRef.current = nextTemplate;
      setTermFieldColors(nextFieldColors);
      rememberTermColumnPrefs(nextColumns, nextFieldColors);
      setColumns(nextColumns);
    }, [columns, rememberTermColumnPrefs]);

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

    const getCurrentColumnPayload = useCallback(() => {
      return buildColumnPayload(columns, { termFieldTemplate: termFieldTemplateRef.current, termFieldColors });
    }, [columns, termFieldColors]);

    const saveCurrentCustomColumnView = useCallback(async () => {
      if (!currentUserId) return false;
      const viewId = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (isDefaultColumnViewId(viewId)) return false;
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const currentView = views.find((view) => view.id === viewId);
      if (!currentView) return false;
      const payload = getCurrentColumnPayload();
      const nextViews = views.map((view) => view.id === viewId ? {
        ...view,
        payload,
        updated_at: new Date().toISOString(),
      } : view);
      setColumnViewsLocal(nextViews);
      const saved = await saveColumnViewStateToUser({ activeViewId: viewId, views: nextViews }, viewId);
      if (!saved) throw new Error('用户配置未保存');
      return true;
    }, [activeColumnViewId, columnViews, getCurrentColumnPayload, setColumnViewsLocal]);

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
        const defaultView = {
          id: DEFAULT_COLUMN_VIEW_ID,
          name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID],
          type: 'default',
          payload,
          updated_at: new Date().toISOString(),
        };
        const saved = await saveDefaultColumnViewToCurrentUser(defaultView, termFieldColors);
        if (!saved) throw new Error('默认视图配置未保存');
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(defaultView.payload);
        const sourceTermFieldColors = getTermFieldColorsFromPayload(defaultView.payload, termFieldColors);
        const sourceTermFieldBodyColors = getTermFieldBodyColorsFromPayload(defaultView.payload);
        const nextViews = syncHeaderColorsIntoColumnViews(
          views.map((view) => view.id === viewId ? { ...view, ...defaultView } : view),
          sourceHeaderColorMap,
          sourceTermFieldColors,
          defaultView.updated_at,
          sourceTermFieldBodyColors
        );
        setColumnViewsLocal(nextViews);
        ctx.message.success('默认视图已保存');
      } catch (err) {
        ctx.message.error(`保存默认视图失败：${err?.message || '未知错误'}`);
      } finally {
        setColumnViewSaving(false);
      }
    }, [activeColumnViewId, columnViewSaving, columnViewSwitching, columnViews, getCurrentColumnPayload, setColumnViewsLocal, termFieldColors]);

    useEffect(() => {
      const pendingViewId = pendingColumnLayoutViewIdRef.current;
      const activeViewIdNow = normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId);
      if (!pendingViewId || pendingViewId !== activeViewIdNow || isDefaultColumnViewId(activeViewIdNow)) return undefined;
      if (!currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching) return undefined;
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
    }, [activeColumnViewId, columnViewCreating, columnViewSaving, columnViewSwitching, saveCurrentCustomColumnView]);

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const [viewState, fixedFieldColors] = await Promise.all([loadColumnViewStateFromUser(), loadTermFieldColorsFromUser()]);
        if (cancelled) return;
        const rawPayload = getColumnViewPayload(viewState, viewState.activeViewId) || buildInitialViewPayload();
        const payload = withTermFieldColorsPayload(rawPayload, fixedFieldColors);
        const cols = mergeColumnsWithInitial(payload);
        const payloadFieldColors = getTermFieldColorsFromPayload(payload);
        termFieldTemplateRef.current = getTermFieldTemplateFromPayload(payload);
        setColumnViewsLocal(viewState.views);
        setActiveColumnViewLocal(viewState.activeViewId);
        setTermFieldColors(payloadFieldColors);
        rememberTermColumnPrefs(cols, payloadFieldColors);
        setColumns(cols);
        setConfigReady(true);
      })();
      return () => { cancelled = true; };
    }, [rememberTermColumnPrefs, setActiveColumnViewLocal, setColumnViewsLocal]);
    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);

    const updateAndSave = useCallback((updater) => {
      markColumnLayoutChanged();
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        const nextTemplate = buildTermFieldTemplatePayload(next, termFieldTemplateRef.current);
        termFieldTemplateRef.current = nextTemplate;
        rememberTermColumnPrefs(next);
        return next;
      });
    }, [markColumnLayoutChanged, rememberTermColumnPrefs]);

    const updateColumnsLocally = useCallback((updater) => {
      markColumnLayoutChanged();
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        termFieldTemplateRef.current = buildTermFieldTemplatePayload(next, termFieldTemplateRef.current);
        rememberTermColumnPrefs(next);
        return next;
      });
    }, [markColumnLayoutChanged, rememberTermColumnPrefs]);

    const updateResizableColumns = useCallback((updater) => {
      updateColumnsLocally(updater);
    }, [updateColumnsLocally]);

    const saveCurrentAsDefaultColumns = useCallback(async () => {
      if (!IS_ADMIN) return;
      try {
        const payload = buildColumnPayload(columns, { termFieldTemplate: termFieldTemplateRef.current, termFieldColors });
        const defaultView = {
          id: DEFAULT_COLUMN_VIEW_ID,
          name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID],
          type: 'default',
          payload,
          updated_at: new Date().toISOString(),
        };
        const result = await saveDefaultColumnViewToUsers(defaultView, null, termFieldColors);
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(defaultView.payload);
        const sourceTermFieldColors = getTermFieldColorsFromPayload(defaultView.payload, termFieldColors);
        const sourceTermFieldBodyColors = getTermFieldBodyColorsFromPayload(defaultView.payload);
        setColumnViewsLocal(syncHeaderColorsIntoColumnViews(
          views.map((view) => view.id === DEFAULT_COLUMN_VIEW_ID ? { ...view, ...defaultView } : view),
          sourceHeaderColorMap,
          sourceTermFieldColors,
          defaultView.updated_at,
          sourceTermFieldBodyColors
        ));
        if (result.ok) {
          ctx.message.success(`已设为默认视图，并同步自定义视图列头颜色和重要指标标记给 ${result.total} 位用户`);
        } else {
          ctx.message.warning(`默认视图已部分保存，失败 ${result.failCount}/${result.total} 位用户`);
        }
      } catch (err) {
        ctx.message.error(`设为默认视图失败：${err?.message || '未知错误'}`);
      }
    }, [columnViews, columns, setColumnViewsLocal, termFieldColors]);

    const pushDefaultViewToUsers = useCallback(async (targetUserIds = null) => {
      if (!IS_ADMIN) return { ok: false, total: 0, failCount: 0 };
      try {
        const payload = buildColumnPayload(columns, { termFieldTemplate: termFieldTemplateRef.current, termFieldColors });
        const defaultView = {
          id: DEFAULT_COLUMN_VIEW_ID,
          name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID],
          type: 'default',
          payload,
          updated_at: new Date().toISOString(),
        };
        const result = await saveDefaultColumnViewToUsers(defaultView, targetUserIds, termFieldColors);
        const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
        const sourceHeaderColorMap = getHeaderColorMapFromPayload(defaultView.payload);
        const sourceTermFieldColors = getTermFieldColorsFromPayload(defaultView.payload, termFieldColors);
        const sourceTermFieldBodyColors = getTermFieldBodyColorsFromPayload(defaultView.payload);
        setColumnViewsLocal(syncHeaderColorsIntoColumnViews(
          views.map((view) => view.id === DEFAULT_COLUMN_VIEW_ID ? { ...view, ...defaultView } : view),
          sourceHeaderColorMap,
          sourceTermFieldColors,
          defaultView.updated_at,
          sourceTermFieldBodyColors
        ));
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
    }, [columnViews, columns, setColumnViewsLocal, termFieldColors]);

    const restoreDefaultColumns = useCallback(async () => {
      if (!isDefaultColumnViewId(activeColumnViewId)) {
        ctx.message.warning('自定义视图没有全员默认配置，可切换到默认视图后恢复');
        return;
      }
      if (!currentUserId) {
        const nextColumns = INITIAL_COLUMNS.map((c) => ({ ...c }));
        termFieldTemplateRef.current = getDefaultTermFieldTemplate();
        rememberTermColumnPrefs(nextColumns, termFieldColors);
        setColumns(nextColumns);
        return;
      }
      try {
        const state = await loadColumnViewStateFromUser();
        const defaultView = state.defaultViews.find((view) => view.id === DEFAULT_COLUMN_VIEW_ID) || state.defaultViews[0];
        const defaultPayload = Array.isArray(defaultView?.payload) && defaultView.payload.length ? defaultView.payload : buildInitialViewPayload();
        const nextViews = state.views.map((view) => view.id === DEFAULT_COLUMN_VIEW_ID ? { ...view, name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID], payload: defaultPayload, updated_at: new Date().toISOString() } : view);
        const saved = await saveColumnViewStateToUser({ ...state, views: nextViews }, DEFAULT_COLUMN_VIEW_ID);
        if (!saved) throw new Error('用户配置未保存');
        const nextColumns = mergeColumnsWithInitial(defaultPayload);
        const nextFieldColors = getTermFieldColorsFromPayload(defaultPayload);
        termFieldTemplateRef.current = getTermFieldTemplateFromPayload(defaultPayload);
        setColumnViewsLocal(nextViews);
        setActiveColumnViewLocal(DEFAULT_COLUMN_VIEW_ID);
        setTermFieldColors(nextFieldColors);
        rememberTermColumnPrefs(nextColumns, nextFieldColors);
        setColumns(nextColumns);
        ctx.message.success('已恢复默认视图');
      } catch (err) {
        ctx.message.error(`恢复默认视图失败：${err?.message || '未知错误'}`);
      }
    }, [activeColumnViewId, rememberTermColumnPrefs, setActiveColumnViewLocal, setColumnViewsLocal]);

    const switchColumnView = useCallback(async (viewId) => {
      const nextViewId = normalizeColumnViewId(viewId);
      if (nextViewId === activeColumnViewId || columnViewSwitching) return;
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
        applyColumnPayloadToLocal(view?.payload);
        saveActiveColumnViewToUser(nextViewId).catch(() => {});
      } catch (err) {
        ctx.message.error(`切换视图失败：${err?.message || '未知错误'}`);
      } finally {
        setColumnViewSwitching(false);
      }
    }, [activeColumnViewId, applyColumnPayloadToLocal, columnViewSwitching, columnViews, saveCurrentCustomColumnView, setActiveColumnViewLocal]);

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
          onPressEnter: (e) => e.currentTarget?.blur?.(),
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
        ctx.message.warning('未识别到当前用户，无法保存视图');
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
          const now = new Date().toISOString();
          const id = `custom_${Date.now()}`;
          const usedNames = new Set(views.map((view) => getViewLabel(view)));
          let name = nameBase;
          let idx = 2;
          while (usedNames.has(name)) {
            name = `${nameBase}${idx}`;
            idx += 1;
          }
          const nextView = {
            id,
            name,
            type: 'custom',
            payload: getCurrentColumnPayload(),
            updated_at: now,
          };
          const nextViews = [...views, nextView];
          const saved = await saveColumnViewStateToUser({ activeViewId: id, views: nextViews }, id);
          if (!saved) throw new Error('用户配置未保存');
          pendingColumnLayoutViewIdRef.current = null;
          setColumnViewsLocal(nextViews);
          setActiveColumnViewLocal(id);
          ctx.message.success(`已复制并保存为「${name}」`);
          return true;
        } catch (err) {
          ctx.message.error(`复制并保存视图失败：${err?.message || '未知错误'}`);
          return false;
        } finally {
          setColumnViewCreating(false);
        }
      };
      if (typeof nameArg === 'string' && nameArg.trim()) {
        doCreate(nameArg);
        return;
      }
      const views = columnViewsRef.current.length ? columnViewsRef.current : columnViews;
      const currentView = views.find((view) => view.id === normalizeColumnViewId(activeColumnViewIdRef.current || activeColumnViewId)) || views[0];
      let draftName = `${getViewLabel(currentView) || '视图'}副本`;
      Modal.confirm({
        title: '复制并保存视图',
        content: React.createElement(Input, {
          defaultValue: draftName,
          autoFocus: true,
          maxLength: 20,
          placeholder: '请输入视图名称',
          onChange: (e) => { draftName = e.target.value; },
          onPressEnter: (e) => e.currentTarget?.blur?.(),
        }),
        okText: '复制并保存',
        cancelText: '取消',
        onOk: async () => {
          const created = await doCreate(draftName);
          if (!created) return Promise.reject(new Error('视图未保存'));
        },
      });
    }, [activeColumnViewId, columnViewCreating, columnViewSwitching, columnViews, getCurrentColumnPayload, saveCurrentCustomColumnView, setActiveColumnViewLocal, setColumnViewsLocal]);

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
            const nextViews = views.filter((view) => view.id !== currentViewId);
            const nextActiveView = nextViews.find((view) => view.id === DEFAULT_COLUMN_VIEW_ID) || nextViews[0];
            const saved = await saveColumnViewStateToUser({ activeViewId: nextActiveView?.id || DEFAULT_COLUMN_VIEW_ID, views: nextViews }, nextActiveView?.id || DEFAULT_COLUMN_VIEW_ID);
            if (!saved) throw new Error('用户配置未保存');
            setColumnViewsLocal(nextViews);
            setActiveColumnViewLocal(nextActiveView?.id || DEFAULT_COLUMN_VIEW_ID);
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

    const loadActiveTermRefs = useCallback(async () => {
      const countryAsin = filterCountry && filterAsin ? `${filterCountry}_${filterAsin}` : null;
      if (!countryAsin) return null;
      try {
        const [keywordRes, rootRes] = await Promise.all([
          ctx.request({
            url: 'sqp_keywords:list',
            method: 'get',
            params: { pageSize: 1000, sort: TERM_ADDED_ORDER_SORT, filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) },
          }),
          ctx.request({
            url: 'sqp_roots:list',
            method: 'get',
            params: { pageSize: 1000, sort: TERM_ADDED_ORDER_SORT, filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) },
          }),
        ]);
        const keywords = sortTermsByAddedOrder(Array.isArray(keywordRes?.data?.data) ? keywordRes.data.data : []);
        const roots = sortTermsByAddedOrder(Array.isArray(rootRes?.data?.data) ? rootRes.data.data : []);
        const toIdSet = (rows) => new Set(rows.map((row) => row.id).filter((id) => id != null).map((id) => String(id)));
        const toNameSet = (rows, field) => new Set(rows.map((row) => String(row[field] || '').trim()).filter(Boolean));
        const toOrderMap = (rows, field) => {
          const map = {};
          rows.forEach((row, index) => {
            if (row.id != null) map[`id:${row.id}`] = index;
            const name = String(row[field] || '').trim();
            if (name) map[`name:${name}`] = index;
          });
          return map;
        };
        return {
          keywordIds: toIdSet(keywords),
          keywordNames: toNameSet(keywords, 'keyword_name'),
          keywordOrder: toOrderMap(keywords, 'keyword_name'),
          rootIds: toIdSet(roots),
          rootNames: toNameSet(roots, 'root_name'),
          rootOrder: toOrderMap(roots, 'root_name'),
        };
      } catch {
        return null;
      }
    }, [filterCountry, filterAsin]);

    const isActiveTermRow = (term, activeRefs) => {
      if (!activeRefs) return true;
      const isRoot = term.term_type === 'root';
      const idSet = isRoot ? activeRefs.rootIds : activeRefs.keywordIds;
      const nameSet = isRoot ? activeRefs.rootNames : activeRefs.keywordNames;
      const termId = term.term_id == null ? '' : String(term.term_id);
      const termName = String(term.term_name || '').trim();
      return (termId && idSet.has(termId)) || (termName && nameSet.has(termName));
    };

    const getTermOrderIndex = useCallback((term, activeRefs) => {
      if (!activeRefs) return Number.MAX_SAFE_INTEGER;
      const orderMap = term.term_type === 'root' ? activeRefs.rootOrder : activeRefs.keywordOrder;
      const termId = term.term_id == null ? '' : String(term.term_id);
      const termName = String(term.term_name || '').trim();
      if (termId && orderMap?.[`id:${termId}`] != null) return orderMap[`id:${termId}`];
      if (termName && orderMap?.[`name:${termName}`] != null) return orderMap[`name:${termName}`];
      return Number.MAX_SAFE_INTEGER;
    }, []);

    const ensureDefaultTermsForCurrentAsin = useCallback(async () => {
      if (!filterCountry || !filterAsin) return { created: 0 };
      const countryAsin = `${filterCountry}_${filterAsin}`;
      const normalizeText = (value) => String(value || '').trim();
      const fetchAll = async (url, params = {}) => {
        const pageSize = 500;
        const rows = [];
        for (let page = 1; page <= 10000; page += 1) {
          const res = await ctx.request({
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
      const resolveCurrentCategory = async () => {
        let modelName = normalizeText(filterModel);
        if (!modelName) {
          const asinRows = await fetchAll('asin:list', {
            filter: JSON.stringify({ unique: { $eq: getAsinUniqueKey(filterCountry, filterAsin) } }),
          });
          const asinRow = asinRows[0] || {};
          modelName = normalizeText(asinRow.model);
        }
        if (!modelName) return '';
        const skuRows = await fetchAll('sku:list', {
          sort: 'sku',
          pageSize: 1,
          filter: JSON.stringify({
            $and: [
              { country: { $eq: filterCountry } },
              { model: { $eq: modelName } },
            ],
          }),
        });
        return normalizeText(skuRows[0]?.type);
      };
      const currentCategory = await resolveCurrentCategory();
      if (!currentCategory) {
        return { created: 0, skipped: true, message: '未找到当前型号对应的 SKU 产品类型，已跳过默认词自动生成' };
      }
      const defaultFilter = JSON.stringify({
        $and: [
          { country: { $eq: filterCountry } },
          { category: { $eq: currentCategory } },
        ],
      });
      const countryAsinFilter = JSON.stringify({ country_asin: { $eq: countryAsin } });
      const [defaults, keywords, roots] = await Promise.all([
        fetchAll('sqp_default_terms:list', { sort: 'id', filter: defaultFilter }),
        fetchAll('sqp_keywords:list', { sort: TERM_ADDED_ORDER_SORT, filter: countryAsinFilter }),
        fetchAll('sqp_roots:list', { sort: TERM_ADDED_ORDER_SORT, filter: countryAsinFilter }),
      ]);
      if (!defaults.length) return { created: 0 };
      const keywordNames = new Set(keywords.map((item) => String(item?.keyword_name || '').trim().toLowerCase()).filter(Boolean));
      const rootNames = new Set(roots.map((item) => String(item?.root_name || '').trim().toLowerCase()).filter(Boolean));
      const createJobs = [];
      defaults.forEach((item) => {
        const termType = item?.term_type === 'root' ? 'root' : 'keyword';
        const termName = String(item?.term_name || '').trim();
        if (!termName) return;
        const normalized = termName.toLowerCase();
        if (termType === 'root') {
          if (rootNames.has(normalized)) return;
          rootNames.add(normalized);
          createJobs.push({
            url: 'sqp_roots:create',
            data: withCreateTimestamps({ country_asin: countryAsin, country: filterCountry, asin: filterAsin, root_name: termName }),
          });
          return;
        }
        if (keywordNames.has(normalized)) return;
        keywordNames.add(normalized);
        createJobs.push({
          url: 'sqp_keywords:create',
          data: withCreateTimestamps({ country_asin: countryAsin, country: filterCountry, asin: filterAsin, keyword_name: termName }),
        });
      });
      if (!createJobs.length) return { created: 0 };
      for (const job of createJobs) {
        await ctx.request({ url: job.url, method: 'post', data: job.data });
      }
      return { created: createJobs.length, category: currentCategory };
    }, [filterCountry, filterAsin, filterModel]);

    const curPageRef  = useRef(curPage);
    const pageSizeRef = useRef(pageSize);
    useEffect(() => { curPageRef.current  = curPage;  }, [curPage]);
    useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);

    const requestSeqRef = useRef(0);

    const pickTotalFromResponse = (res) => {
      const count = res?.data?.meta?.count;
      return Number.isFinite(Number(count)) ? Number(count) : 0;
    };

    const mergeTermColumns = useCallback((termRows) => {
      const seen = new Map();
      const groupOrder = new Map();
      const groupTypeCounts = {};
      termRows.forEach((term) => {
        if (!term?.term_week_key || !term.term_name) return;
        const groupKey = `term_${term.term_type}_${term.term_id || term.term_name}`;
        const groupLabel = `${term.term_name}${term.term_type === 'root' ? '（词根）' : '（关键词）'}`;
        if (!groupOrder.has(groupKey)) {
          const typeKey = term.term_type === 'root' ? 'root' : 'keyword';
          const nextIndex = groupTypeCounts[typeKey] || 0;
          groupOrder.set(groupKey, nextIndex);
          groupTypeCounts[typeKey] = nextIndex + 1;
        }
        TERM_SUB_FIELDS.forEach((sub) => {
          const key = `${groupKey}_${sub.key}`;
          if (!seen.has(key)) {
            seen.set(key, {
              key,
              src: term.term_type === 'root' ? 'root' : 'keyword',
              field: sub.key,
              label: sub.label,
              hidden: false,
              pinned: false,
              width: sub.width,
              editable: sub.key === 'stage_target_share' || sub.key === 'monday_review_note',
              _isTermColumn: true,
              _isTermFieldColumn: true,
              _termColumnKey: groupKey,
              _termGroupKey: groupKey,
              _termGroupLabel: groupLabel,
              _termType: term.term_type,
              _termId: term.term_id,
              _termName: term.term_name,
              _termSubType: sub.type,
            });
          }
        });
      });

      setColumns((prev) => {
        rememberTermColumnPrefs(prev);
        const base = prev.filter((c) => !c._isTermColumn);
        const old = Object.fromEntries(prev.filter((c) => c._isTermColumn).map((c) => [c.key, c]));
        const fieldColors = {};
        prev.filter((c) => c._isTermColumn && c.termFieldHeaderColor).forEach((c) => { fieldColors[c.field] = c.termFieldHeaderColor; });
        const groupColors = {};
        prev.filter((c) => c._isTermColumn && c.termGroupHeaderColor).forEach((c) => { groupColors[c._termGroupKey || c._termColumnKey] = c.termGroupHeaderColor; });
        const cachedPrefs = termColumnPrefsRef.current || { byKey: {}, fieldColors: {}, groupColors: {}, groupColorsByName: {} };
        const template = termFieldTemplateRef.current || getDefaultTermFieldTemplate();
        const dynamic = Array.from(seen.values()).map((col) => {
          const oldCol = old[col.key] || cachedPrefs.byKey[col.key] || {};
          const fieldTemplate = template[col.field] || {};
          const groupKey = col._termGroupKey || col._termColumnKey;
          const groupIndex = groupOrder.has(groupKey) ? groupOrder.get(groupKey) : 0;
          const groupNameKey = col._termType && col._termName ? `${col._termType}:${String(col._termName).trim().toLowerCase()}` : null;
          return {
            ...col,
            ...oldCol,
            label: col.label,
            _termColumnKey: col._termColumnKey,
            _termGroupKey: col._termGroupKey,
            _termGroupLabel: col._termGroupLabel,
            _termType: col._termType,
            _termId: col._termId,
            _termName: col._termName,
            hidden: fieldTemplate.hidden === true,
            width: Math.max(Number(fieldTemplate.width) || Number(oldCol.width) || col.width, getTermColumnMinWidth(col)),
            editable: fieldTemplate.editable === true || oldCol.editable === true || col.editable === true,
            bodyColor: fieldTemplate.bodyColor || null,
            _termSubType: col._termSubType,
            termGroupDefaultColor: getTermGroupDefaultColor(col._termType, groupIndex),
            termGroupHeaderColor: oldCol.termGroupHeaderColor || groupColors[groupKey] || cachedPrefs.groupColors[groupKey] || (groupNameKey ? cachedPrefs.groupColorsByName[groupNameKey] : null) || null,
            termFieldHeaderColor: oldCol.termFieldHeaderColor || fieldColors[col.field] || termFieldColors[col.field] || cachedPrefs.fieldColors[col.field] || null,
          };
        });
        rememberTermColumnPrefs(dynamic);
        return [...base, ...dynamic];
      });
    }, [rememberTermColumnPrefs, termFieldColors]);

    const load = useCallback(async (options = {}) => {
      const page = options.page ?? curPageRef.current;
      const size = options.size ?? pageSizeRef.current;
      const skipFormula = options.skipFormula === true;
      const requestSeq = ++requestSeqRef.current;
      try {
        setLoading(true);
        if (!hasRequiredUrlParams) {
          setData([]);
          setTotal(0);
          return;
        }
        const sqpFilterAnd = [];
        if (filterAsin)    sqpFilterAnd.push({ asin:    { $eq: filterAsin    } });
        if (filterCountry) sqpFilterAnd.push({ country: { $eq: filterCountry } });
        const dateRange = getDateRange;
        if (dateRange) {
          sqpFilterAnd.push({ report_date: { $gte: dateRange[0] } });
          sqpFilterAnd.push({ report_date: { $lte: dateRange[1] } });
        }

        let sortStr = 'report_date';
        if (sortConfig.key) {
          const col = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
          const field = col ? col.field : sortConfig.key;
          sortStr = sortConfig.dir === 'desc' ? `-${field}` : field;
        }

        const sqpParams = {
          sort: sortStr,
          page,
          pageSize: size,
          ...(sqpFilterAnd.length > 0 ? { filter: JSON.stringify({ $and: sqpFilterAnd }) } : {}),
        };

        const stageDefaultState = await loadAsinStageDefaultShare();
        if (requestSeq !== requestSeqRef.current) return;
        const rSqp = await ctx.request({ url: 'sqp_weekly_main:list', method: 'get', params: sqpParams });
        if (requestSeq !== requestSeqRef.current) return;
        const mainRecords = Array.isArray(rSqp?.data?.data) ? rSqp.data.data : [];
        const totalCount = pickTotalFromResponse(rSqp);
        const keys = mainRecords.map(getMainWeekKey).filter(Boolean);
        const activeTermRefs = await loadActiveTermRefs();
        if (requestSeq !== requestSeqRef.current) return;
        let termRows = [];
        if (keys.length) {
          const termFilter = {
            $or: keys.map((key) => ({ country_asin_weekDate: { $eq: key } })),
          };
          const termPageSize = Math.max(keys.length * 20, 100);
          const rTerms = await ctx.request({
            url: 'sqp_term_weekly:list',
            method: 'get',
            params: { pageSize: termPageSize, sort: ['term_type', 'term_name'], filter: JSON.stringify(termFilter) },
          });
          const rawTermRows = Array.isArray(rTerms?.data?.data) ? rTerms.data.data : [];
          termRows = rawTermRows
            .filter((term) => isActiveTermRow(term, activeTermRefs))
            .sort((a, b) => {
              const typeA = a.term_type === 'root' ? 1 : 0;
              const typeB = b.term_type === 'root' ? 1 : 0;
              if (typeA !== typeB) return typeA - typeB;
              const orderA = getTermOrderIndex(a, activeTermRefs);
              const orderB = getTermOrderIndex(b, activeTermRefs);
              if (orderA !== orderB) return orderA - orderB;
              return String(a.term_name || '').localeCompare(String(b.term_name || ''));
            });
        }

        const mainMap = {};
        mainRecords.forEach((row) => {
          const mainKey = getMainWeekKey(row);
          if (mainKey) mainMap[mainKey] = row;
        });

        const termFormulaJobs = [];
        const termGroups = {};
        termRows.forEach((term) => {
          const groupKey = `${term.term_type}_${term.term_id || term.term_name || ''}`;
          if (!termGroups[groupKey]) termGroups[groupKey] = [];
          termGroups[groupKey].push(term);
        });
        Object.values(termGroups).forEach((rows) => {
          const sortedRows = [...rows].sort((a, b) => String(a.report_date || '').localeCompare(String(b.report_date || '')));
          let prevTerm = null;
          sortedRows.forEach((term) => {
            const mainRow = mainMap[getTermMainWeekKey(term)] || {};
            const updates = buildStoredTermFormulaUpdates(term, mainRow, prevTerm, stageDefaultState);
            const writeUpdates = skipFormula ? pickStageTargetSyncUpdates(updates) : updates;
            const changed = Object.entries(writeUpdates).some(([field, value]) => String(term[field] ?? '') !== String(value ?? ''));
            if (Object.keys(updates).length) {
              Object.assign(term, updates);
            }
            if (changed && term.term_week_key && Object.keys(writeUpdates).length) {
              termFormulaJobs.push({
                key: term.term_week_key,
                updates: writeUpdates,
              });
            }
            prevTerm = {
              ...term,
              ...updates,
              week_label: mainRow.week_label || term.week_label,
              week_no: term.week_no || parseWeekNo(mainRow.week_label),
            };
          });
        });

        const termsByMain = {};
        termRows.forEach((term) => {
          const mainKey = getTermMainWeekKey(term);
          const colKey = `term_${term.term_type}_${term.term_id || term.term_name}`;
          if (!termsByMain[mainKey]) termsByMain[mainKey] = {};
          termsByMain[mainKey][colKey] = term;
        });

        mergeTermColumns(termRows);
        setData(mainRecords.map((row) => {
          const mainKey = getMainWeekKey(row);
          return {
            ...row,
            country_asin_weekDate: row.country_asin_weekDate || mainKey,
            country_asin_week_date: row.country_asin_week_date || mainKey,
            __terms: termsByMain[mainKey] || {},
          };
        }));
        setTotal(totalCount);
        if (!skipFormula && termFormulaJobs.length) {
          await Promise.allSettled(termFormulaJobs.map((job) => ctx.request({
            url: 'sqp_term_weekly:update',
            method: 'post',
            params: { filterByTk: job.key },
            data: job.updates,
          })));
        }

        if (mainRecords.length === 0 && page > 1 && totalCount > 0) {
          const maxPage = Math.max(1, Math.ceil(totalCount / size));
          if (page > maxPage) {
            setCurPage(maxPage);
            load({ page: maxPage, size, skipFormula });
          }
        }
      } catch (err) {
        if (requestSeq !== requestSeqRef.current) return;
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
      } finally {
        if (requestSeq === requestSeqRef.current) setLoading(false);
      }
    }, [filterAsin, filterCountry, hasRequiredUrlParams, getDateRange, loadActiveTermRefs, loadAsinStageDefaultShare, mergeTermColumns, sortConfig, getTermOrderIndex]);

    const openStageDefaultModal = useCallback(async () => {
      if (!filterCountry || !filterAsin) {
        ctx.message.warning('请先筛选到具体站点和 ASIN');
        return;
      }
      setShowPanel(false);
      setShowPush(false);
      setShowCrossHighlightPanel(false);
      setShowDefaultTermConfig(false);
      setShowStageDefaultModal(true);
      const state = await loadAsinStageDefaultShare();
      setStageDefaultInput(state?.value != null ? Number(state.value) * 100 : null);
    }, [filterCountry, filterAsin, loadAsinStageDefaultShare]);

    const saveStageDefaultShare = useCallback(async () => {
      const unique = getAsinUniqueKey(filterCountry, filterAsin);
      if (!unique) {
        ctx.message.warning('请先筛选到具体站点和 ASIN');
        return;
      }
      const nextValue = stageDefaultInput === '' || stageDefaultInput == null
        ? null
        : roundRateValue(Number(stageDefaultInput) / 100);
      if (stageDefaultInput !== '' && stageDefaultInput != null && !isValidNumber(stageDefaultInput)) {
        ctx.message.error('请输入有效的目标份额默认值');
        return;
      }
      try {
        setSavingStageDefault(true);
        setStageDefaultProgress({ active: true, label: '正在保存默认值...', percent: 12, status: 'normal' });
        await ctx.request({
          url: 'asin:update',
          method: 'post',
          params: { filterByTk: unique },
          data: { default_stage_target_share: nextValue },
        });
        setStageDefaultProgress({ active: true, label: '默认值已保存，正在刷新当前页...', percent: 45, status: 'normal' });
        setAsinStageDefaultState({ loaded: true, value: nextValue });
        setStageDefaultProgress({ active: true, label: '正在同步非手动目标份额...', percent: 82, status: 'normal' });
        await load({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        setStageDefaultProgress({ active: true, label: '同步完成', percent: 100, status: 'success' });
        ctx.message.success('目标份额默认值已保存');
        window.setTimeout(() => {
          setShowStageDefaultModal(false);
          setStageDefaultProgress({ active: false, label: '', percent: 0, status: 'normal' });
        }, 700);
      } catch (err) {
        setStageDefaultProgress({ active: true, label: '保存失败，请重试', percent: 100, status: 'exception' });
        ctx.message.error(`保存目标份额默认值失败：${err?.message || '未知错误'}`);
      } finally {
        setSavingStageDefault(false);
      }
    }, [filterCountry, filterAsin, load, stageDefaultInput]);

    useEffect(() => {
      if (!configReady) return;
      if (filterCountry && filterAsin) return;
      setCurPage(1);
      load({ page: 1, skipFormula: true });
    }, [configReady, filterCountry, filterAsin, load]);

    const autoRefreshCurrentPage = useCallback(async () => {
      if (loading || refreshingData || calculatingFormulas || saving || editingCell || !configReady) return;
      const now = Date.now();
      if (now - (autoRefreshRef.current.lastAt || 0) < 3000) return;
      autoRefreshRef.current.lastAt = now;
      try {
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '切回页面，正在刷新数据...', percent: 5 });
        await load({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        const calculate = calculateFormulasRef.current;
        if (calculate && filterCountry && filterAsin) {
          await calculate({
            silent: true,
            reload: false,
            allowNonAdmin: true,
            onProgress: (progress) => {
              const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
              setRefreshProgress(label);
              showFormulaProgress(progress);
            },
          });
        }
        finishFormulaProgress('切回页面刷新完成');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.warning(`切回页面自动刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshProgress('');
      }
    }, [calculatingFormulas, configReady, editingCell, filterAsin, filterCountry, finishFormulaProgress, load, loading, refreshingData, resetFormulaProgress, saving, showFormulaProgress]);

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
      if (!configReady || !data.length || autoWidthDoneRef.current) return;
      const padding = 24;
      const sample = data.length <= 500 ? data : data.slice(0, 500);
      setColumns((prev) => {
        const next = prev.map((col) => {
          if (manuallyResizedRef.current.has(col.key)) return col;
          if (col._isTermColumn) return col;
          let maxWidth = estimateTextWidth(col.label, FONT_SIZE_SM);
          sample.forEach((row) => {
            const value = row[col.field];
            let displayStr;
            if (value == null || value === '') displayStr = '—';
            else if (MONEY_FIELDS.has(col.field)) displayStr = Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            else if (RATE_FIELDS.has(col.field)) displayStr = `${(Number(value) * 100).toFixed(2)}%`;
            else if (DATE_FIELDS.has(col.field)) {
              if (!value) displayStr = '—';
              else displayStr = new Date(value).toLocaleDateString('zh-CN');
            } else displayStr = String(value);
            const w = estimateTextWidth(displayStr, FONT_SIZE);
            if (w > maxWidth) maxWidth = w;
          });
          return { ...col, width: Math.min(420, Math.max(60, Math.ceil(maxWidth + padding))) };
        });
        return next;
      });
      autoWidthDoneRef.current = true;
    }, [configReady, data]);

    const onPageChange = useCallback((page, size) => {
      if (size !== pageSizeRef.current) {
        setCurPage(1);
        setPageSize(size);
        load({ page: 1, size, skipFormula: true });
      } else {
        setCurPage(page);
        load({ page, size, skipFormula: true });
      }
    }, [load]);

    const onShowSizeChange = useCallback((page, size) => {
      setCurPage(1);
      setPageSize(size);
      load({ page: 1, size, skipFormula: true });
    }, [load]);

    const handleSort = useCallback((colKey) => {
      const col = columns.find((c) => c.key === colKey);
      if (col?._isTermColumn) return;
      setSortConfig((prev) => ({
        key: colKey,
        dir: prev.key === colKey && prev.dir === 'asc' ? 'desc' : 'asc',
      }));
    }, [columns]);

    const toggleCol      = (key) => updateAndSave((p) => { const col = p.find((c) => c.key === key); if (!col) return p; if (!col.hidden) return p.map((c) => c.key === key ? { ...c, hidden: true } : c); return [...p.filter((c) => c.key !== key), { ...col, hidden: false }]; });
    const togglePin      = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c));
    const setHColor      = (key, color) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c));
    const clearHColor    = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c));
    const setTermGroupColor = (groupKey, color) => updateAndSave((p) => p.map((c) => c._isTermColumn && (c._termGroupKey || c._termColumnKey) === groupKey ? { ...c, termGroupHeaderColor: color } : c));
    const clearTermGroupColor = (groupKey) => updateAndSave((p) => p.map((c) => c._isTermColumn && (c._termGroupKey || c._termColumnKey) === groupKey ? { ...c, termGroupHeaderColor: null } : c));
    const saveFixedTermFieldColor = (field, color) => {
      markColumnLayoutChanged();
      setTermFieldColors((prev) => {
        const next = { ...prev };
        if (color) next[field] = color;
        else delete next[field];
        termColumnPrefsRef.current = {
          ...(termColumnPrefsRef.current || { byKey: {}, fieldColors: {}, groupColors: {}, groupColorsByName: {} }),
          fieldColors: next,
        };
        return next;
      });
      setColumns((prev) => {
        if (!prev.some((c) => c._isTermColumn && c.field === field)) return prev;
        const next = prev.map((c) => c._isTermColumn && c.field === field ? { ...c, termFieldHeaderColor: color || null } : c);
        rememberTermColumnPrefs(next, termColumnPrefsRef.current.fieldColors);
        return next;
      });
    };
    const setTermFieldColor = (field, color) => saveFixedTermFieldColor(field, color);
    const clearTermFieldColor = (field) => saveFixedTermFieldColor(field, null);
    const toggleEditable = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c));
    const selectAll      = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: false })));
    const deselectAll    = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: true  })));
    const isTermFieldTemplateVisible = (field) => termFieldTemplateRef.current?.[field]?.hidden !== true;
    const setAllTermFieldTemplateVisible = (visible) => {
      const current = termFieldTemplateRef.current || getDefaultTermFieldTemplate();
      const nextTemplate = normalizeTermFieldTemplate(Object.fromEntries(
        TERM_SUB_FIELDS.map((sub) => [sub.key, {
          ...(current[sub.key] || {}),
          hidden: visible !== true,
        }])
      ));
      termFieldTemplateRef.current = nextTemplate;
      updateAndSave((p) => p.map((c) => c._isTermColumn ? { ...c, hidden: visible !== true } : c));
    };
    const toggleTermFieldTemplate = (field) => {
      const current = termFieldTemplateRef.current || getDefaultTermFieldTemplate();
      const nextHidden = current[field]?.hidden !== true;
      const nextTemplate = normalizeTermFieldTemplate({
        ...current,
        [field]: {
          ...(current[field] || {}),
          hidden: nextHidden,
        },
      });
      termFieldTemplateRef.current = nextTemplate;
      updateAndSave((p) => p.map((c) => c._isTermColumn && c.field === field ? { ...c, hidden: nextHidden } : c));
    };
    const isTermFieldImportant = (field) => termFieldTemplateRef.current?.[field]?.bodyColor === IMPORTANT_COLUMN_BODY_COLOR;
    const toggleTermFieldImportant = (field) => {
      const current = termFieldTemplateRef.current || getDefaultTermFieldTemplate();
      const nextBodyColor = current[field]?.bodyColor === IMPORTANT_COLUMN_BODY_COLOR ? null : IMPORTANT_COLUMN_BODY_COLOR;
      const nextTemplate = normalizeTermFieldTemplate({
        ...current,
        [field]: {
          ...(current[field] || {}),
          bodyColor: nextBodyColor,
        },
      });
      termFieldTemplateRef.current = nextTemplate;
      markColumnLayoutChanged();
      setColumns((prev) => {
        const next = prev.map((c) => c._isTermColumn && c.field === field ? { ...c, bodyColor: nextBodyColor } : c);
        rememberTermColumnPrefs(next);
        return next;
      });
    };

    const visibleCols   = useMemo(() => { const vis = columns.filter((c) => !c.hidden); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [columns]);
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += getColumnRenderWidth(col); } }); return map; }, [visibleCols]);
    const hasTermColumns = useMemo(() => visibleCols.some((c) => c._isTermColumn), [visibleCols]);
    const termHeaderGroups = useMemo(() => {
      const groups = {};
      visibleCols.forEach((col, idx) => {
        if (!col._isTermColumn) return;
        const key = col._termGroupKey || col._termColumnKey;
        if (!groups[key]) {
          groups[key] = { firstIndex: idx, colSpan: 0, label: col._termGroupLabel || col._termName || col.label };
        }
        groups[key].colSpan += 1;
      });
      return groups;
    }, [visibleCols]);
    const termQuickIndexItems = useMemo(() => {
      const items = [];
      const seen = new Set();
      let left = 0;
      visibleCols.forEach((col) => {
        const width = getColumnRenderWidth(col);
        if (col._isTermColumn) {
          const key = col._termGroupKey || col._termColumnKey;
          if (!seen.has(key)) {
            seen.add(key);
            items.push({
              key,
              label: col._termName || col._termGroupLabel || col._termGroupKey || col.label,
              type: col._termType === 'root' ? 'root' : 'keyword',
              typeLabel: col._termType === 'root' ? '词根' : '关键词',
              left,
            });
          }
        }
        left += width;
      });
      return items;
    }, [visibleCols]);
    const scrollToTermGroup = useCallback((left) => {
      const wrap = tableWrapRef.current;
      if (!wrap) return;
      const pinnedWidth = visibleCols.filter((col) => col.pinned).reduce((sum, col) => sum + getColumnRenderWidth(col), 0);
      wrap.scrollTo?.({ left: Math.max(0, left - pinnedWidth), behavior: 'smooth' });
      if (!wrap.scrollTo) wrap.scrollLeft = Math.max(0, left - pinnedWidth);
    }, [visibleCols]);
    const termQuickSelectOptions = useMemo(() => {
      const groups = { keyword: [], root: [] };
      termQuickIndexItems.forEach((item) => {
        const type = item.type === 'root' ? 'root' : 'keyword';
        groups[type].push({
          value: item.key,
          label: item.label,
          title: `${item.typeLabel}：${item.label}`,
        });
      });
      return groups;
    }, [termQuickIndexItems]);
    const termQuickIndexMap = useMemo(() => Object.fromEntries(termQuickIndexItems.map((item) => [item.key, item])), [termQuickIndexItems]);
    const [termQuickSelectValues, setTermQuickSelectValues] = useState({ keyword: undefined, root: undefined });
    const [colorLegendExpanded, setColorLegendExpanded] = useState(false);
    const handleTermQuickSelect = useCallback((type, key) => {
      const item = termQuickIndexMap[key];
      if (!item) return;
      scrollToTermGroup(item.left);
      setTermQuickSelectValues(type === 'root'
        ? { keyword: undefined, root: key }
        : { keyword: key, root: undefined }
      );
    }, [scrollToTermGroup, termQuickIndexMap]);
    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();
    const onDrop      = (e, targetKey) => { e.preventDefault(); const fromKey = dragColKey.current; if (!fromKey || fromKey === targetKey) return; updateResizableColumns((prev) => { const next = [...prev]; const fi = next.findIndex((c) => c.key === fromKey); const ti = next.findIndex((c) => c.key === targetKey); const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved); return next; }); dragColKey.current = null; };

    const onResizeStart = useCallback((e, colKey) => {
      e.preventDefault();
      e.stopPropagation();
      const col = columns.find((c) => c.key === colKey);
      resizeRef.current = {
        type: 'column',
        colKey,
        termField: col?._isTermColumn ? col.field : null,
        startX: e.clientX,
        startWidth: getColumnRenderWidth(col),
      };
      setIsResizing(true);
      if (col?._isTermColumn) {
        columns.filter((c) => c._isTermColumn && c.field === col.field).forEach((c) => manuallyResizedRef.current.add(c.key));
      } else {
        manuallyResizedRef.current.add(colKey);
      }
    }, [columns]);
    const onTermGroupResizeStart = useCallback((e, groupKey) => {
      e.preventDefault();
      e.stopPropagation();
      const groupCols = visibleCols.filter((c) => c._isTermColumn && (c._termGroupKey || c._termColumnKey) === groupKey);
      if (!groupCols.length) return;
      resizeRef.current = {
        type: 'termGroup',
        groupKey,
        fields: groupCols.map((c) => c.field),
        startX: e.clientX,
        startWidths: Object.fromEntries(groupCols.map((c) => [c.field, getColumnRenderWidth(c)])),
      };
      setIsResizing(true);
      const fieldSet = new Set(groupCols.map((c) => c.field));
      columns.filter((c) => c._isTermColumn && fieldSet.has(c.field)).forEach((c) => manuallyResizedRef.current.add(c.key));
    }, [columns, visibleCols]);
    const onOverlayMove = useCallback((e) => {
      if (!resizeRef.current) return;
      const info = resizeRef.current;
      const delta = e.clientX - info.startX;
      if (info.type === 'termGroup') {
        const fields = info.fields || [];
        const perColDelta = fields.length ? delta / fields.length : 0;
        updateResizableColumns((p) => p.map((c) => c._isTermColumn && fields.includes(c.field)
          ? { ...c, width: Math.max(getTermColumnMinWidth(c), (info.startWidths[c.field] || 80) + perColDelta) }
          : c
        ));
        return;
      }
      const targetCol = columns.find((c) => c.key === info.colKey);
      const minWidth = targetCol?._isTermColumn ? getTermColumnMinWidth(targetCol) : 40;
      const nw = Math.max(minWidth, info.startWidth + delta);
      updateResizableColumns((p) => p.map((c) => info.termField && c._isTermColumn && c.field === info.termField ? { ...c, width: nw } : (c.key === info.colKey ? { ...c, width: nw } : c)));
    }, [columns, updateResizableColumns]);
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

    const isActiveCrossCell = useCallback((r, c) => {
      if (!crossHighlightEnabled || !activeCell) return false;
      return r === activeCell.r || c === activeCell.c;
    }, [activeCell, crossHighlightEnabled]);

    const getBodyCellBackground = useCallback((r, c, selected) => {
      if (selected) return '#e6f4ff';
      if (isActiveCrossCell(r, c)) return crossHighlightColor;
      return r % 2 === 0 ? '#fff' : '#fafafa';
    }, [crossHighlightColor, isActiveCrossCell]);

    const getTermBodyCellBackground = useCallback((col, r, c, selected) => {
      if (selected) return '#e6f4ff';
      if (isActiveCrossCell(r, c)) return crossHighlightColor;
      const bodyColor = getColBodyColor(col);
      if (bodyColor) return bodyColor;
      return getTermCellBackground(col, r, false);
    }, [crossHighlightColor, isActiveCrossCell]);

    const getTermRecord = useCallback((col, row) => row?.__terms?.[col._termColumnKey] || null, []);

    const getCellRawValue = useCallback((col, row) => {
      if (col?._isTermColumn) return getTermRecord(col, row)?.[col.field];
      return row?.[col.field];
    }, [getTermRecord]);

    const getDisplayDiagnosis = useCallback((col, term, row) => {
      const value = term?.[col.field];
      if (!value) return '-';
      if (col.field !== 'compare_diagnosis') return value;
      const weekLabel = getDiagnosisWeekLabel({ ...term, week_label: row?.week_label || term?.week_label, week_no: term?.week_no || parseWeekNo(row?.week_label) });
      if (!weekLabel || String(value).includes(`${weekLabel} Asin`)) return value;
      return String(value)
        .replace(/】\s*Asin\s*同比市场/, `】 ${weekLabel} Asin 同比市场`)
        .replace(/^Asin\s*同比市场/, `${weekLabel} Asin 同比市场`);
    }, []);

    const formatTermValue = useCallback((col, term) => {
      if (!term) return '-';
      const value = term[col.field];
      if (col._termSubType === 'rate' || col._termSubType === 'stageRate') return formatRate(value);
      if (col._termSubType === 'number') {
        const requiredDisplay = getRequiredOrdersDisplay(col.field, term);
        return requiredDisplay || formatInt(value);
      }
      if (col._termSubType === 'diagnosis') return value || '-';
      return value == null || value === '' ? '-' : String(value);
    }, []);

    const getClipboardValue = useCallback((col, row) => {
      const value = getCellRawValue(col, row);
      if (value == null || value === '') return '';
      if (RATE_FIELDS.has(col.field)) return String(Number(value) * 100);
      if (DATE_FIELDS.has(col.field)) return String(value).slice(0, 10);
      return String(value);
    }, [getCellRawValue]);

    const parsePastedValue = useCallback((col, rawValue) => {
      const text = String(rawValue ?? '').trim();
      if (text === '') return null;
      if (RATE_FIELDS.has(col.field)) {
        const num = Number(text.replace('%', '').replace(/,/g, ''));
        return !isNaN(num) ? roundRateValue(num / 100) : null;
      }
      if (MONEY_FIELDS.has(col.field) || NUM_FIELDS.has(col.field)) {
        const num = Number(text.replace(/,/g, ''));
        return !isNaN(num) ? num : null;
      }
      if (DATE_FIELDS.has(col.field)) return text || null;
      return text;
    }, []);

    const buildUpdatePatch = useCallback((row, col, valueToSave) => {
      const updateConfig = SRC_UPDATE_CONFIG[col.src];
      if (!updateConfig) return null;

      if (col._isTermColumn) {
        const term = getTermRecord(col, row);
        const pkValue = term?.[updateConfig.pkField];
        if (!pkValue) return null;
        const dataPatch = { [col.field]: valueToSave };
        if (col.field === 'stage_target_share') {
          const isManualInput = valueToSave !== null && valueToSave !== undefined && valueToSave !== '';
          const stageShare = isManualInput
            ? valueToSave
            : normalizeStageTargetShare(asinStageDefaultState?.value);
          const weeklyRequired = calcWeeklyRequiredOrders(stageShare, term.purchases_count);
          const dailyRequired = calcDailyRequiredOrders(weeklyRequired);
          const nextTerm = {
            ...term,
            stage_target_share: stageShare,
            stage_target_share_is_manual: isManualInput,
            weekly_required_orders: weeklyRequired,
            daily_required_orders: dailyRequired,
          };
          dataPatch.stage_target_share = stageShare;
          dataPatch.stage_target_share_is_manual = isManualInput;
          dataPatch.weekly_required_orders = weeklyRequired;
          dataPatch.daily_required_orders = dailyRequired;
          dataPatch.compare_diagnosis = isValidNumber(term.purchases_count)
            ? buildCompareDiagnosis({ ...nextTerm, week_label: row.week_label })
            : null;
        }
        return {
          updateConfig,
          pkValue,
          dataPatch,
          applyLocal: (sourceRow) => {
            const currentTerm = sourceRow.__terms?.[col._termColumnKey] || {};
            return {
              ...sourceRow,
              __terms: {
                ...sourceRow.__terms,
                [col._termColumnKey]: { ...currentTerm, ...dataPatch },
              },
            };
          },
        };
      }

      const pkValue = row[updateConfig.pkField];
      if (!pkValue) return null;
      return {
        updateConfig,
        pkValue,
        dataPatch: { [col.field]: valueToSave },
        applyLocal: (sourceRow) => ({ ...sourceRow, [col.field]: valueToSave }),
      };
    }, [asinStageDefaultState, getTermRecord]);

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
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;
      const lines = [];
      for (let r = rect.r1; r <= rect.r2; r++) {
        const row = data[r];
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
    }, [getClipboardValue, normalizeSelection, data, selectedRange, visibleCols]);

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
      const derivedFormulaRows = new Set();

      matrix.forEach((line, rr) => {
        line.forEach((cellText, cc) => {
          const row = data[rect.r1 + rr];
          const col = visibleCols[rect.c1 + cc];
          if (!row || !col || !isCellEditable(col)) return;
          const rowId = getMainWeekKey(row);
          const valueToSave = parsePastedValue(col, cellText);
          const patch = buildUpdatePatch(row, col, valueToSave);
          if (!patch) return;
          ops.push({ rowId, ...patch });
          if (
            patch.dataPatch &&
            (Object.prototype.hasOwnProperty.call(patch.dataPatch, 'weekly_required_orders') ||
              Object.prototype.hasOwnProperty.call(patch.dataPatch, 'daily_required_orders') ||
              Object.prototype.hasOwnProperty.call(patch.dataPatch, 'compare_diagnosis'))
          ) {
            derivedFormulaRows.add(rowId);
          }
          const prevPatch = localPatches.get(rowId);
          localPatches.set(rowId, (sourceRow) => patch.applyLocal(prevPatch ? prevPatch(sourceRow) : sourceRow));
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
            data: op.dataPatch,
          });
        }

        setData((prev) => prev.map((row) => {
          const rowId = getMainWeekKey(row);
          const applyLocal = localPatches.get(rowId);
          return applyLocal ? applyLocal(row) : row;
        }));

        if (derivedFormulaRows.size) {
          showFormulaProgress({ label: '粘贴已保存，正在同步公式...', percent: 70 });
          finishFormulaProgress('粘贴公式同步完成');
        }
        ctx.message.success(`已粘贴 ${ops.length} 个单元格`);
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [buildUpdatePatch, editingCell, finishFormulaProgress, isCellEditable, normalizeSelection, data, parsePastedValue, resetFormulaProgress, saving, selectedRange, showFormulaProgress, visibleCols]);

    const handleDeleteSelectedCells = useCallback(async (e) => {
      if (e.key !== 'Backspace' && e.key !== 'Delete') return;
      if (editingCell || saving) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;

      e.preventDefault();

      const ops = [];
      const localPatches = new Map();
      const derivedFormulaRows = new Set();

      for (let r = rect.r1; r <= rect.r2; r++) {
        const row = data[r];
        if (!row) continue;
        for (let c = rect.c1; c <= rect.c2; c++) {
          const col = visibleCols[c];
          if (!col || !isCellEditable(col)) continue;
          const rowId = getMainWeekKey(row);
          const patch = buildUpdatePatch(row, col, null);
          if (!patch) continue;
          ops.push({ rowId, ...patch });
          if (
            patch.dataPatch &&
            (Object.prototype.hasOwnProperty.call(patch.dataPatch, 'weekly_required_orders') ||
              Object.prototype.hasOwnProperty.call(patch.dataPatch, 'daily_required_orders') ||
              Object.prototype.hasOwnProperty.call(patch.dataPatch, 'compare_diagnosis'))
          ) {
            derivedFormulaRows.add(rowId);
          }
          const prevPatch = localPatches.get(rowId);
          localPatches.set(rowId, (sourceRow) => patch.applyLocal(prevPatch ? prevPatch(sourceRow) : sourceRow));
        }
      }

      if (!ops.length) {
        ctx.message.warning('选区没有可删除的可编辑单元格');
        return;
      }

      try {
        setSaving(true);
        for (const op of ops) {
          await ctx.request({
            url: op.updateConfig.url,
            method: 'post',
            params: { filterByTk: op.pkValue },
            data: op.dataPatch,
          });
        }

        setData((prev) => prev.map((row) => {
          const rowId = getMainWeekKey(row);
          const applyLocal = localPatches.get(rowId);
          return applyLocal ? applyLocal(row) : row;
        }));

        if (derivedFormulaRows.size) {
          showFormulaProgress({ label: '删除已保存，正在同步公式...', percent: 70 });
          finishFormulaProgress('删除公式同步完成');
        }
        ctx.message.success(`已清空 ${ops.length} 个单元格`);
      } catch (err) {
        ctx.message.error(`删除失败：${err?.message || '未知错误'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [buildUpdatePatch, editingCell, finishFormulaProgress, isCellEditable, normalizeSelection, data, resetFormulaProgress, saving, selectedRange, showFormulaProgress, visibleCols]);

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
      const row = data.find((r) => getMainWeekKey(r) === rowId);
      if (!row) return;
      const col = columns.find((c) => c.key === editingCell.colKey);
      if (!col) return;
      let valueToSave = editValue;
      if (RATE_FIELDS.has(field)) {
        valueToSave = (editValue !== '' && editValue !== null) ? roundRateValue(Number(editValue) / 100) : null;
      } else if (MONEY_FIELDS.has(field) || NUM_FIELDS.has(field)) {
        valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) : null;
      } else if (DATE_FIELDS.has(field)) {
        valueToSave = editValue || null;
      }
      const patch = buildUpdatePatch(row, col, valueToSave);
      if (!patch) { ctx.message.error(`无法找到记录主键（${updateConfig.pkField}）`); cancelEdit(); return; }
      try {
        setSaving(true);
        await ctx.request({
          url: patch.updateConfig.url,
          method: 'post',
          params: { filterByTk: patch.pkValue },
          data: patch.dataPatch,
        });

        setData((prev) =>
          prev.map((r) =>
            getMainWeekKey(r) === rowId
              ? patch.applyLocal(r)
              : r
          )
        );

        ctx.message.success('保存成功');
        setEditingCell(null);
        setEditValue(null);
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setSaving(false); }
    }, [buildUpdatePatch, cancelEdit, columns, editingCell, editValue, data, saving]);

    const calculateFormulas = useCallback(async (options = {}) => {
      const silent = options?.silent === true;
      const reload = options?.reload !== false;
      const allowNonAdmin = options?.allowNonAdmin === true;
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
      const progressName = (name) => {
        const text = String(name || '');
        return text.length > 18 ? `${text.slice(0, 18)}...` : text;
      };
      if (!IS_ADMIN && !allowNonAdmin) return false;
      if (!filterCountry || !filterAsin) {
        if (!silent) ctx.message.warning('请先筛选到具体站点和 ASIN，再计算公式');
        return false;
      }

      const countryAsin = `${filterCountry}_${filterAsin}`;
      const fetchAll = async (url, params = {}) => {
        const pageSize = 500;
        const rows = [];
        for (let page = 1; page <= 10000; page += 1) {
          const res = await ctx.request({
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

      const termPatchRows = [];
      const termWriteJobs = [];
      let existingTermMap = {};
      let sqpRowsByReportDate = {};
      let stageDefaultState = { loaded: false, value: null };
      const queueTermWeeklySave = (payload, weekLabel) => {
        const rec = existingTermMap[payload.term_week_key] || null;
        if (rec?.term_week_key) {
          const nextPayload = withResolvedStageTarget(payload, rec, stageDefaultState);
          nextPayload.compare_diagnosis = payload.compare_diagnosis
            ? buildCompareDiagnosis({ ...nextPayload, week_label: weekLabel })
            : null;
          const changed = Object.entries(nextPayload).some(([field, value]) => String(rec[field] ?? '') !== String(value ?? ''));
          if (changed) {
            termWriteJobs.push({ type: 'update', key: rec.term_week_key, data: nextPayload });
          }
          return { ...rec, ...nextPayload };
        }
        const createPayload = withCreateTimestamps(withResolvedStageTarget(payload, payload, stageDefaultState));
        createPayload.compare_diagnosis = payload.compare_diagnosis
          ? buildCompareDiagnosis({ ...createPayload, week_label: weekLabel })
          : null;
        termWriteJobs.push({ type: 'create', data: createPayload });
        return { ...createPayload };
      };

      const buildTermPayloads = async (termType, termItem, termName, weeks) => {
        let count = 0;
        let prevPayload = null;
        for (const week of weeks) {
          const reportDate = week.report_date ? String(week.report_date).slice(0, 10) : null;
          if (!reportDate) continue;
          const sqpRows = sqpRowsByReportDate[reportDate] || [];
          const isMatchedTermRow = (row) => {
            const searchQuery = String(row.search_query || '').trim();
            if (!searchQuery) return false;
            return termType === 'root'
              ? searchQuery.includes(termName)
              : searchQuery === termName;
          };
          const currentAsinRows = sqpRows.filter((row) => String(row.asin || '').trim() === String(filterAsin || '').trim());
          const matchedMarketRows = getMarketSourceRows(sqpRows).filter(isMatchedTermRow);
          const matchedAsinRows = currentAsinRows.filter(isMatchedTermRow);

          const searchQueryVolume = nullableSum(matchedMarketRows, 'search_query_volume');
          const impressionsCount = nullableSum(matchedMarketRows, 'impressions_count');
          const clicksCount = nullableSum(matchedMarketRows, 'clicks_count');
          const cartAdditionsCount = nullableSum(matchedMarketRows, 'cart_additions_count');
          const purchasesCount = nullableSum(matchedMarketRows, 'purchases_count');
          const impressionsAsinCount = nullableSum(matchedAsinRows, 'impressions_asin_count');
          const clicksAsinCount = nullableSum(matchedAsinRows, 'clicks_asin_count');
          const cartAdditionsAsinCount = nullableSum(matchedAsinRows, 'cart_additions_asin_count');
          const purchasesAsinCount = nullableSum(matchedAsinRows, 'purchases_asin_count');
          const hasTermData = [
            searchQueryVolume, impressionsCount, clicksCount, cartAdditionsCount, purchasesCount,
            impressionsAsinCount, clicksAsinCount, cartAdditionsAsinCount, purchasesAsinCount,
          ].some(isValidNumber);
          const mainKey = getMainWeekKey(week);
          const termWeekKey = `${filterCountry}_${filterAsin}_${reportDate}_${termType}_${termItem.id}`;
          const payload = {
            term_week_key: termWeekKey,
            country_asin_weekDate: mainKey,
            country_asin: countryAsin,
            country: filterCountry,
            asin: filterAsin,
            report_date: reportDate,
            week_no: parseWeekNo(week.week_label),
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
            market_ctr: divNull(clicksCount, impressionsCount),
            asin_ctr: divNull(clicksAsinCount, impressionsAsinCount),
            market_cart_rate: divNull(cartAdditionsCount, clicksCount),
            asin_cart_rate: divNull(cartAdditionsAsinCount, clicksAsinCount),
            market_cvr: divNull(purchasesCount, clicksCount),
            asin_cvr: divNull(purchasesAsinCount, clicksAsinCount),
            asin_click_share: divNull(clicksAsinCount, clicksCount),
            asin_cart_share: divNull(cartAdditionsAsinCount, cartAdditionsCount),
            asin_purchase_share: divNull(purchasesAsinCount, purchasesCount),
            stage_target_share: null,
            weekly_required_orders: null,
            daily_required_orders: null,
            market_diagnosis: null,
            asin_diagnosis: null,
            compare_diagnosis: null,
          };
          const payloadWithLabel = { ...payload, week_label: week.week_label };
          if (hasTermData) {
            payload.market_diagnosis = buildMarketDiagnosis(payloadWithLabel, prevPayload);
            payload.asin_diagnosis = buildAsinDiagnosis(payloadWithLabel, prevPayload);
            payload.compare_diagnosis = buildCompareDiagnosis(payloadWithLabel);
          }
          const savedPayload = queueTermWeeklySave(payload, week.week_label);
          if (savedPayload) termPatchRows.push(savedPayload);
          prevPayload = hasTermData ? payloadWithLabel : null;
          count += 1;
        }
        return count;
      };

      try {
        setCalculatingFormulas(true);
        stageDefaultState = await loadAsinStageDefaultShare();
        onProgress?.({ label: '正在读取关键词/词根...', percent: 10 });
        const [keywords, roots, weeks] = await Promise.all([
          fetchAll('sqp_keywords:list', { sort: TERM_ADDED_ORDER_SORT, filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) }),
          fetchAll('sqp_roots:list', { sort: TERM_ADDED_ORDER_SORT, filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) }),
          fetchAll('sqp_weekly_main:list', { sort: 'report_date', filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) }),
        ]);
        const orderedKeywords = sortTermsByAddedOrder(keywords);
        const orderedRoots = sortTermsByAddedOrder(roots);
        const totalTerms = orderedKeywords.filter((item) => item.id && String(item.keyword_name || '').trim()).length
          + orderedRoots.filter((item) => item.id && String(item.root_name || '').trim()).length;
        if (!totalTerms || !weeks.length) {
          onProgress?.({ label: '没有需要计算的 SQP 公式数据', percent: 100 });
          if (!silent) ctx.message.success('没有需要计算的 SQP 公式数据');
          if (reload) load({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
          return true;
        }
        const reportDates = weeks
          .map((week) => week.report_date ? String(week.report_date).slice(0, 10) : '')
          .filter(Boolean)
          .sort();
        onProgress?.({ label: '正在读取当前 ASIN 品牌...', percent: 12 });
        const asinRows = await fetchAll('asin:list', {
          filter: JSON.stringify({ unique: { $eq: getAsinUniqueKey(filterCountry, filterAsin) } }),
        });
        const asinRow = asinRows[0] || {};
        const modelName = String(filterModel || asinRow.model || '').trim();
        let currentBrand = String(asinRow.brand || '').trim();
        if (!currentBrand && modelName) {
          const skuRows = await fetchAll('sku:list', {
            sort: 'sku',
            filter: JSON.stringify({
              $and: [
                { country: { $eq: filterCountry } },
                { model: { $eq: modelName } },
              ],
            }),
          });
          currentBrand = String(skuRows[0]?.brand || '').trim();
        }
        if (!currentBrand) currentBrand = DEFAULT_MARKET_BRAND;
        const sameBrandAsinRows = await fetchAll('asin:list', {
          filter: JSON.stringify({
            $and: [
              { country: { $eq: filterCountry } },
              { brand: { $eq: currentBrand } },
            ],
          }),
        });
        const sameBrandAsins = new Set(
          sameBrandAsinRows.map((item) => String(item?.asin || '').trim()).filter(Boolean)
        );
        sameBrandAsins.add(String(filterAsin || '').trim());
        onProgress?.({ label: '正在批量读取同品牌 SQP 明细...', percent: 12 });
        const [sqpRows, existingTermRows] = await Promise.all([
          reportDates.length ? fetchAll('sqp:list', {
            filter: JSON.stringify({
              $and: [
                { country: { $eq: filterCountry } },
                { report_date: { $gte: reportDates[0] } },
                { report_date: { $lte: reportDates[reportDates.length - 1] } },
              ],
            }),
          }) : [],
          fetchAll('sqp_term_weekly:list', {
            filter: JSON.stringify({ country_asin: { $eq: countryAsin } }),
          }),
        ]);
        existingTermMap = {};
        existingTermRows.forEach((row) => {
          if (row?.term_week_key) existingTermMap[row.term_week_key] = row;
        });
        sqpRowsByReportDate = {};
        const reportDateSet = new Set(reportDates);
        sqpRows.forEach((row) => {
          const reportDate = row?.report_date ? String(row.report_date).slice(0, 10) : '';
          if (!reportDate || !reportDateSet.has(reportDate)) return;
          if (!sameBrandAsins.has(String(row?.asin || '').trim())) return;
          if (!sqpRowsByReportDate[reportDate]) sqpRowsByReportDate[reportDate] = [];
          sqpRowsByReportDate[reportDate].push(row);
        });
        let doneTerms = 0;
        let totalWeeks = 0;
        for (const keyword of orderedKeywords) {
          const termName = String(keyword.keyword_name || '').trim();
          if (!keyword.id || !termName) continue;
          doneTerms += 1;
          onProgress?.({ label: `正在计算关键词 ${doneTerms}/${totalTerms}：${progressName(termName)}`, percent: 15 + (totalTerms ? (doneTerms / totalTerms) * 75 : 75) });
          totalWeeks += await buildTermPayloads('keyword', keyword, termName, weeks);
        }
        for (const root of orderedRoots) {
          const termName = String(root.root_name || '').trim();
          if (!root.id || !termName) continue;
          doneTerms += 1;
          onProgress?.({ label: `正在计算词根 ${doneTerms}/${totalTerms}：${progressName(termName)}`, percent: 15 + (totalTerms ? (doneTerms / totalTerms) * 75 : 75) });
          totalWeeks += await buildTermPayloads('root', root, termName, weeks);
        }
        let writeFailCount = 0;
        if (termWriteJobs.length) {
          const batchSize = 60;
          for (let i = 0; i < termWriteJobs.length; i += batchSize) {
            const batch = termWriteJobs.slice(i, i + batchSize);
            onProgress?.({ label: `正在写回周汇总 ${Math.min(i + batch.length, termWriteJobs.length)}/${termWriteJobs.length}...`, percent: 92 + (Math.min(i + batch.length, termWriteJobs.length) / termWriteJobs.length) * 4 });
            const results = await Promise.allSettled(batch.map((job) => ctx.request({
              url: job.type === 'update' ? 'sqp_term_weekly:update' : 'sqp_term_weekly:create',
              method: 'post',
              ...(job.type === 'update' ? { params: { filterByTk: job.key } } : {}),
              data: job.data,
            })));
            writeFailCount += results.filter((result) => result.status === 'rejected').length;
          }
        }
        if (termPatchRows.length) {
          onProgress?.({ label: '正在合并公式结果...', percent: 96 });
          mergeTermColumns(termPatchRows);
          const patchByMain = {};
          termPatchRows.forEach((term) => {
            const mainKey = getTermMainWeekKey(term);
            const groupKey = `term_${term.term_type}_${term.term_id || term.term_name || ''}`;
            if (!mainKey || !groupKey) return;
            if (!patchByMain[mainKey]) patchByMain[mainKey] = {};
            patchByMain[mainKey][groupKey] = term;
          });
          setData((prev) => prev.map((row) => {
            const mainKey = getMainWeekKey(row);
            const termPatch = patchByMain[mainKey];
            return termPatch
              ? { ...row, __terms: { ...(row.__terms || {}), ...termPatch } }
              : row;
            }));
        }
        if (!silent) {
          if (writeFailCount) ctx.message.warning(`计算完成：${keywords.length} 个关键词、${roots.length} 个词根，共 ${totalWeeks} 条周汇总，写回失败 ${writeFailCount} 条`);
          else ctx.message.success(`计算完成：${keywords.length} 个关键词、${roots.length} 个词根，共 ${totalWeeks} 条周汇总`);
        }
        if (reload) load({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        return writeFailCount === 0;
      } catch (err) {
        if (silent) {
          console.error('SQP 公式计算失败:', err);
        } else {
          ctx.message.error(`计算失败：${err?.message || '未知错误'}`);
        }
        return false;
      } finally {
        setCalculatingFormulas(false);
      }
    }, [filterCountry, filterAsin, load, loadAsinStageDefaultShare, mergeTermColumns]);

    useEffect(() => {
      calculateFormulasRef.current = calculateFormulas;
    }, [calculateFormulas]);

    useEffect(() => {
      if (!configReady || !filterCountry || !filterAsin) return undefined;
      const countryAsin = `${filterCountry}_${filterAsin}`;
      const runKey = `${countryAsin}_${filterModel || ''}_${defaultTermConfigVersion}`;
      if (autoDefaultTermsRef.current.running || autoDefaultTermsRef.current.key === runKey) return undefined;
      let active = true;
      autoDefaultTermsRef.current.running = true;
      autoDefaultTermsRef.current.key = runKey;
      setCurPage(1);
      (async () => {
        try {
          showFormulaProgress({ label: '正在检查类目默认词...', percent: 6 });
          const result = await ensureDefaultTermsForCurrentAsin();
          if (!active) return;
          if (result.created > 0) {
            showFormulaProgress({ label: `已补齐 ${result.created} 个默认词，正在生成周汇总...`, percent: 18 });
            await calculateFormulas({
              silent: true,
              reload: false,
              allowNonAdmin: true,
              onProgress: showFormulaProgress,
            });
            if (!active) return;
            ctx.message.success(`已自动补齐 ${result.created} 个默认词`);
            finishFormulaProgress('默认词周汇总生成完成');
          } else {
            if (result.message) ctx.message.warning(result.message);
            resetFormulaProgress();
          }
          await load({ page: 1, size: pageSizeRef.current, skipFormula: true });
        } catch (err) {
          resetFormulaProgress();
          ctx.message.warning(`默认词自动生成失败：${err?.message || '未知错误'}`);
          await load({ page: 1, size: pageSizeRef.current, skipFormula: true });
        } finally {
          autoDefaultTermsRef.current.running = false;
        }
      })();
      return () => { active = false; };
    }, [
      calculateFormulas,
      configReady,
      defaultTermConfigVersion,
      ensureDefaultTermsForCurrentAsin,
      filterAsin,
      filterCountry,
      filterModel,
      finishFormulaProgress,
      load,
      resetFormulaProgress,
      showFormulaProgress,
    ]);

    const refreshData  = useCallback(async () => {
      if (refreshingData || calculatingFormulas || loading) return;
      try {
        setRefreshingData(true);
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '正在刷新数据...', percent: 5 });
        if (!filterCountry || !filterAsin) {
          await load({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
          ctx.message.success('数据已刷新');
          finishFormulaProgress('数据已刷新');
          return;
        }
        const ok = await calculateFormulas({
          silent: true,
          reload: false,
          allowNonAdmin: true,
          onProgress: (progress) => {
            const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
            setRefreshProgress(label);
            showFormulaProgress(progress);
          },
        });
        await load({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        ctx.message.success(ok ? '数据已刷新并重新计算公式' : '数据已刷新');
        finishFormulaProgress(ok ? '刷新公式计算完成' : '数据已刷新');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.error(`刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshingData(false);
        setRefreshProgress('');
      }
    }, [calculateFormulas, calculatingFormulas, filterCountry, filterAsin, finishFormulaProgress, load, loading, refreshingData, resetFormulaProgress, showFormulaProgress]);

    const handleTermManagerRefresh = useCallback(async (event) => {
      const rows = Array.isArray(event?.rows) ? event.rows : [];
      if (!rows.length) {
        await refreshData();
        return;
      }
      const allTermMap = new Map();
      data.forEach((mainRow) => {
        Object.values(mainRow.__terms || {}).forEach((term) => {
          if (!term) return;
          const key = term.term_week_key || `${getTermMainWeekKey(term)}_${term.term_type}_${term.term_id || term.term_name}`;
          if (key) allTermMap.set(key, term);
        });
      });
      rows.forEach((term) => {
        const key = term.term_week_key || `${getTermMainWeekKey(term)}_${term.term_type}_${term.term_id || term.term_name}`;
        if (key) allTermMap.set(key, term);
      });
      mergeTermColumns(Array.from(allTermMap.values()));
      const patchByMain = {};
      rows.forEach((term) => {
        const mainKey = getTermMainWeekKey(term);
        const groupKey = `term_${term.term_type}_${term.term_id || term.term_name || ''}`;
        if (!mainKey || !groupKey) return;
        if (!patchByMain[mainKey]) patchByMain[mainKey] = {};
        patchByMain[mainKey][groupKey] = term;
      });
      setData((prev) => prev.map((row) => {
        const mainKey = getMainWeekKey(row);
        const termPatch = patchByMain[mainKey];
        return termPatch
          ? { ...row, __terms: { ...(row.__terms || {}), ...termPatch } }
          : row;
      }));
    }, [data, load, mergeTermColumns, refreshData]);

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
      const commonProps = { ref: inputRef, value: editValue, onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); }, style: { width: '100%' }, size: 'small' };
      if (RATE_FIELDS.has(col.field))  return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), min: 0, max: 100, step: 0.01, precision: 2, addonAfter: '%' });
      if (MONEY_FIELDS.has(col.field)) return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 0.01, precision: 2 });
      if (NUM_FIELDS.has(col.field))   return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 1 });
      if (DATE_FIELDS.has(col.field))  return React.createElement(DatePicker,  { ...commonProps, locale: DATE_PICKER_LOCALE, value: editValue ? ctx.libs.dayjs(editValue) : null, onChange: (date) => setEditValue(date ? date.format('YYYY-MM-DD') : null) });
      if (col.field === 'monday_review_note') return React.createElement(Input.TextArea, { ...commonProps, onChange: (e) => setEditValue(e.target.value), autoSize: { minRows: 2, maxRows: 6 } });
      return React.createElement(Input, { ...commonProps, onChange: (e) => setEditValue(e.target.value), onPressEnter: () => saveEdit() });
    };

    const renderColorSwatches = (currentColor, isCustom, onSet, onClear, resetColor) =>
      React.createElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } },
        PRESET_COLORS.map((pc) => {
          const selected = String(currentColor || '').toLowerCase() === String(pc.value || '').toLowerCase();
          return React.createElement('div', {
            key: pc.value,
            title: pc.label,
            onClick: (e) => { e.stopPropagation(); onSet(pc.value); },
            style: {
              width: '16px',
              height: '16px',
              borderRadius: '4px',
              cursor: 'pointer',
              flexShrink: 0,
              background: pc.value,
              border: selected ? '2px solid #fff' : '1px solid rgba(0,0,0,0.12)',
              boxShadow: selected
                ? '0 0 0 2px #1677ff, inset 0 0 0 1px rgba(0,0,0,0.25)'
                : 'none',
              boxSizing: 'border-box',
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
            }
          },
            selected && React.createElement('span', {
              style: {
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 0 0 1px rgba(0,0,0,0.45)',
              }
            })
          );
        }),
        isCustom && React.createElement('div', {
          title: '重置为默认色',
          onClick: (e) => { e.stopPropagation(); onClear(); },
          style: {
            width: '14px',
            height: '14px',
            borderRadius: '2px',
            cursor: 'pointer',
            flexShrink: 0,
            background: resetColor,
            border: '2px dashed #333',
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '9px',
            color: '#fff',
            fontWeight: 700,
            lineHeight: 1,
          }
        }, '↺')
      );

    const renderColRow = (col, options = {}) => {
      const showColor = options.showColor !== false;
      const currentColor = getColHeaderColor(col);
      const srcDefault   = SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;
      const isCustom     = col._isTermColumn ? !!col.termFieldHeaderColor : !!col.headerColor;
      return React.createElement('div', { key: col.key, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0 3px 12px', borderBottom: '1px solid #fafafa' } },
        React.createElement('div', { onClick: () => togglePin(col.key), style: { width: '22px', textAlign: 'center', flexShrink: 0, cursor: 'pointer', fontSize: `${FONT_SIZE_SM}px`, opacity: col.pinned ? 1 : 0.2, userSelect: 'none' } }, '📌'),
        React.createElement('input', { type: 'checkbox', checked: !col.hidden, onChange: () => toggleCol(col.key), style: { flexShrink: 0, cursor: 'pointer' } }),
        React.createElement('span', { style: { flex: 1, fontSize: `${FONT_SIZE_SM}px`, color: col.hidden ? '#ccc' : '#333', userSelect: 'none' } }, col.label),
        IS_ADMIN && !READONLY_FIELDS.has(col.field) && React.createElement('label', { title: '双击单元格可编辑', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: col.editable === true, onChange: () => toggleEditable(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999' } }, '编辑'),
        ),
        IS_ADMIN && showColor && renderColorSwatches(currentColor, isCustom, (color) => setHColor(col.key, color), () => clearHColor(col.key), srcDefault),
      );
    };

    const activeColumnView = columnViews.find((view) => view.id === activeColumnViewId);
    const columnViewOptions = useMemo(() => {
      const list = columnViews.length ? columnViews : [{ id: DEFAULT_COLUMN_VIEW_ID, name: DEFAULT_COLUMN_VIEW_LABELS[DEFAULT_COLUMN_VIEW_ID], type: 'default' }];
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
    const iconButtonStyle = ({ disabled = false, bg = '#fff', color = '#333', border = 'none' } = {}) => ({
      width: '24px',
      height: '24px',
      borderRadius: '4px',
      border,
      background: disabled ? '#f1f5f9' : bg,
      color: disabled ? '#94a3b8' : color,
      cursor: disabled ? 'not-allowed' : 'pointer',
      fontSize: `${FONT_SIZE_XS}px`,
      fontWeight: 800,
      lineHeight: '22px',
      padding: 0,
      textAlign: 'center',
      flexShrink: 0,
    });

    const panelEl = showPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { position: 'fixed', top: `${panelPos.top}px`, left: `${panelPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', width: IS_ADMIN ? '680px' : '560px', maxHeight: '620px', overflowY: 'auto' } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: '#555', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', null, '列设置'),
          canModifyActiveColumnView && React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement('button', { onClick: selectAll,   style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
            React.createElement('button', { onClick: deselectAll, style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
          ),
        ),
        React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px', padding: '8px 10px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px' } },
          React.createElement('span', { style: { fontSize: `${FONT_SIZE_SM}px`, color: '#334155', fontWeight: 800, flexShrink: 0 } }, '视图'),
          React.createElement(Select, {
            size: 'small',
            value: activeColumnViewId,
            options: columnViewOptions,
            onChange: switchColumnView,
            disabled: columnViewSwitching || columnViewCreating || columnViewSaving,
            style: { width: '340px', flex: '1 1 300px' },
            optionLabelProp: 'selectLabel',
          }),
          canSaveDefaultColumnView && React.createElement('button', { disabled: !currentUserId || columnViewSaving || columnViewSwitching, title: currentUserId ? (columnViewSaving ? '保存中' : '保存当前默认视图配置') : '未识别到当前用户，无法保存默认视图', onClick: saveCurrentDefaultColumnView, style: { ...iconButtonStyle({ disabled: !currentUserId || columnViewSaving || columnViewSwitching, bg: '#0f766e', color: '#fff' }), width: '126px', padding: '0 10px', fontSize: `${FONT_SIZE_SM}px`, whiteSpace: 'nowrap' } }, columnViewSaving ? '保存中...' : '保存默认视图'),
          React.createElement('button', { disabled: !currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching, title: currentUserId ? (columnViewCreating ? '保存中' : '复制并保存为新视图') : '未识别到当前用户，无法保存视图', onClick: () => createColumnViewFromCurrent(), style: { ...iconButtonStyle({ disabled: !currentUserId || columnViewCreating || columnViewSaving || columnViewSwitching, bg: '#1677ff', color: '#fff' }), width: '120px', padding: '0 10px', fontSize: `${FONT_SIZE_SM}px`, whiteSpace: 'nowrap' } }, columnViewCreating ? '保存中...' : '复制并保存')
        ),
        (() => {
          const groupKey = '__term_field_colors';
          const isCollapsed = isGroupCollapsed(groupKey);
          return React.createElement('div', {
            style: {
              marginBottom: '8px',
              border: '1px solid #d9d9d9',
              borderRadius: '6px',
              overflow: 'hidden',
            }
          },
            React.createElement('div', {
              onClick: () => toggleGroup(groupKey),
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '5px 10px',
                background: '#f6f6f6',
                borderBottom: isCollapsed ? 'none' : '1px solid #ececec',
                fontWeight: 700,
                fontSize: `${FONT_SIZE_SM}px`,
                color: '#555',
                cursor: 'pointer',
                userSelect: 'none',
              }
            },
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#777', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
              React.createElement('span', { style: { flex: 1 } }, '词下字段模板'),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', fontWeight: 400 } }, `${TERM_SUB_FIELDS.length} 个字段`),
              canModifyActiveColumnView && React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); setAllTermFieldTemplateVisible(true); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全选'),
              canModifyActiveColumnView && React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); setAllTermFieldTemplateVisible(false); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全取消')
            ),
            !isCollapsed && React.createElement('div', null,
              TERM_SUB_FIELDS.map((sub) => {
                const fixedColor = termFieldColors[sub.key] || null;
                const sampleCol = columns.find((c) => c._isTermColumn && c.field === sub.key) || { src: 'keyword', field: sub.key, termFieldHeaderColor: fixedColor };
                const currentColor = getTermFieldHeaderColor(sampleCol);
                const isCustom = !!fixedColor || !!sampleCol.termFieldHeaderColor;
                const resetColor = SRC_DEFAULT_COLOR[sampleCol.src] || COLOR_ORANGE;
                const visible = isTermFieldTemplateVisible(sub.key);
                const important = isTermFieldImportant(sub.key);
                return React.createElement('div', {
                  key: sub.key,
                  style: {
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 10px 4px 12px',
                    borderBottom: '1px solid #fafafa',
                  }
                },
                  React.createElement('input', { type: 'checkbox', checked: visible, onChange: () => toggleTermFieldTemplate(sub.key), style: { flexShrink: 0, cursor: 'pointer' } }),
                  React.createElement('span', {
                    style: {
                      width: '170px',
                      fontSize: `${FONT_SIZE_SM}px`,
                      color: visible ? '#333' : '#ccc',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }
                  }, sub.label),
                  React.createElement('label', {
                    title: '将所有关键词和词根下该字段标记为重要指标，列头不变',
                    style: {
                      display: 'flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: `${FONT_SIZE_XS}px`,
                      color: '#666',
                      cursor: 'pointer',
                      flexShrink: 0,
                      userSelect: 'none',
                    }
                  },
                    React.createElement('input', {
                      type: 'checkbox',
                      checked: important,
                      onChange: () => toggleTermFieldImportant(sub.key),
                      style: { cursor: 'pointer' }
                    }),
                    React.createElement('span', {
                      style: {
                        display: 'inline-block',
                        width: '12px',
                        height: '12px',
                        background: IMPORTANT_COLUMN_BODY_COLOR,
                        border: '1px solid #9ab98c',
                        borderRadius: '2px',
                        boxSizing: 'border-box',
                      }
                    }),
                    '重要指标'
                  ),
                  IS_ADMIN && renderColorSwatches(currentColor, isCustom, (color) => setTermFieldColor(sub.key, color), () => clearTermFieldColor(sub.key), resetColor)
                );
              })
            )
          );
        })(),
        IS_ADMIN && SRC_GROUP_CONFIG.filter((group) => group.src === 'main').map((group) => {
          const groupCols   = columns.filter((c) => c.src === group.src && !c._isTermColumn);
          if (!groupCols.length) return null;
          const isCollapsed = isGroupCollapsed(group.src);
          const visCount    = groupCols.filter((c) => !c.hidden).length;
          return React.createElement('div', { key: group.src, style: { marginBottom: '6px', border: `1px solid ${group.color}40`, borderRadius: '6px', overflow: 'hidden' } },
            React.createElement('div', { onClick: () => toggleGroup(group.src), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer', userSelect: 'none', background: `${group.color}18`, borderBottom: isCollapsed ? 'none' : `1px solid ${group.color}30` } },
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: group.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
              React.createElement('span', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: group.color, flex: 1 } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              canModifyActiveColumnView && React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); updateAndSave((p) => p.map((c) => c.src === group.src ? { ...c, hidden: false } : c)); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全选'),
              canModifyActiveColumnView && React.createElement('button', {
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
      React.createElement(PushPanel, { onClose: () => setShowPush(false), anchorPos: pushPos, onPush: pushDefaultViewToUsers }),
    );

    const termManagerEl = React.createElement(TermManagerModal, {
      visible: showTermManager,
      onClose: () => setShowTermManager(false),
      country: filterCountry,
      asin: filterAsin,
      onRefresh: handleTermManagerRefresh,
      recalculatingIds: termRecalculatingIds,
      onRecalcStateChange: setTermRecalculating,
      onRecalcProgress: showFormulaProgress,
      onRecalcFinish: finishFormulaProgress,
    });
    const defaultTermConfigEl = IS_ADMIN && React.createElement(DefaultTermConfigModal, {
      visible: showDefaultTermConfig,
      onClose: () => setShowDefaultTermConfig(false),
      currentCountry: filterCountry,
      currentModel: filterModel || currentInfoRow.model,
      onChanged: () => {
        autoDefaultTermsRef.current.key = null;
        setDefaultTermConfigVersion((v) => v + 1);
      },
    });
    const chartModalEl = React.createElement(SqpTrendChartModal, {
      visible: showChartModal,
      onClose: () => setShowChartModal(false),
      country: filterCountry,
      asin: filterAsin,
    });
    const stageDefaultModalEl = React.createElement(Modal, {
      title: '目标份额默认值',
      open: showStageDefaultModal,
      visible: showStageDefaultModal,
      onCancel: () => {
        if (savingStageDefault) return;
        setShowStageDefaultModal(false);
        setStageDefaultProgress({ active: false, label: '', percent: 0, status: 'normal' });
      },
      destroyOnClose: false,
      width: 460,
      footer: React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
        React.createElement(Button, {
          disabled: savingStageDefault,
          onClick: () => {
            setShowStageDefaultModal(false);
            setStageDefaultProgress({ active: false, label: '', percent: 0, status: 'normal' });
          },
        }, '取消'),
        React.createElement(Button, {
          type: 'primary',
          loading: savingStageDefault,
          onClick: saveStageDefaultShare,
        }, '保存')
      ),
    },
      React.createElement('div', { style: { display: 'grid', gap: '12px' } },
        React.createElement('div', { style: { color: '#334155', fontWeight: 700 } },
          `${filterCountry || '-'} / ${filterAsin || '-'}`
        ),
        React.createElement('div', { style: { display: 'grid', gap: '6px' } },
          React.createElement('div', { style: { color: '#475569', fontSize: `${FONT_SIZE_SM}px`, fontWeight: 700 } }, '默认阶段目标份额'),
          React.createElement(InputNumber, {
            min: 0,
            max: 100,
            step: 0.01,
            precision: 2,
            value: stageDefaultInput,
            addonAfter: '%',
            disabled: savingStageDefault,
            onChange: setStageDefaultInput,
            onPressEnter: saveStageDefaultShare,
            style: { width: '100%' },
          })
        ),
        React.createElement('div', { style: { color: '#64748b', fontSize: `${FONT_SIZE_XS}px`, lineHeight: 1.6 } },
          '保存后，当前 ASIN 下非手动阶段目标会按该默认值刷新；已手动修改的行不会被覆盖。'
        ),
        stageDefaultProgress.active && React.createElement('div', {
          style: {
            height: '26px',
            border: `1px solid ${stageDefaultProgress.status === 'exception' ? '#ffccc7' : '#91caff'}`,
            borderRadius: '4px',
            background: stageDefaultProgress.status === 'exception' ? '#fff1f0' : '#f0f7ff',
            overflow: 'hidden',
            position: 'relative',
          },
        },
          React.createElement('div', {
            style: {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.max(2, Math.min(100, stageDefaultProgress.percent || 0))}%`,
              background: stageDefaultProgress.status === 'exception'
                ? 'linear-gradient(90deg, #ff7875, #ff4d4f)'
                : stageDefaultProgress.status === 'success'
                  ? 'linear-gradient(90deg, #95de64, #52c41a)'
                  : 'linear-gradient(90deg, #69c0ff, #1677ff)',
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
              color: stageDefaultProgress.percent >= 55 ? '#fff' : (stageDefaultProgress.status === 'exception' ? '#cf1322' : '#0958d9'),
              fontSize: `${FONT_SIZE_XS}px`,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            },
          }, `${stageDefaultProgress.label || '正在保存...'} ${Math.round(stageDefaultProgress.percent || 0)}%`)
        )
      )
    );

    const getSourceFieldName = (col) => {
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      return sourceCollection ? `${sourceCollection}.${col.field}` : col.field;
    };
    const getHeaderTooltipData = (col) => {
      if (FORMULA_TOOLTIPS[col.field]) {
        return { ...FORMULA_TOOLTIPS[col.field], title: col.label || FORMULA_TOOLTIPS[col.field].title };
      }
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      const sourceField = getSourceFieldName(col);
      return {
        title: col.label,
        formula: '直接展示来源字段的值',
        emptyRules: ['来源字段为空时显示为空'],
        fields: sourceCollection ? [{ label: col.label, field: sourceField }] : [],
        writeBackField: sourceCollection ? sourceField : '无',
      };
    };
    const getTermGroupTooltipData = (col, groupLabel) => {
      const termTypeLabel = col._termType === 'root' ? '词根' : '关键词';
      return {
        title: groupLabel || col._termGroupLabel || col._termName || col.label,
        formula: `展示当前${termTypeLabel}在每周 SQP 汇总中的市场、Asin、份额、目标和诊断指标`,
        emptyRules: [`未配置该${termTypeLabel}`, '当前周没有 SQP 周汇总记录', '对应子字段为空时显示为空'],
        fields: [
          { label: termTypeLabel, field: col._termType === 'root' ? 'sqp_roots.root_name' : 'sqp_keywords.keyword_name' },
          { label: '周汇总记录', field: 'sqp_term_weekly.term_week_key' },
        ],
        writeBackField: 'sqp_term_weekly.*',
      };
    };
    const renderTooltip = ({ title, formula, emptyRules = [], emptyRuleMode = '满足任意', fields = [], writeBackField }) => React.createElement('div', {
      style: {
        maxWidth: '360px',
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'inherit',
      },
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '6px' } }, title),
      React.createElement('div', { style: { marginBottom: '6px' } }, formula || '直接展示该指标值'),
      React.createElement('div', { style: { marginBottom: '2px' } }, `为空情况（${emptyRuleMode}）：`),
      React.createElement('ul', { style: { margin: '0 0 10px 18px', padding: 0 } },
        (emptyRules.length ? emptyRules : ['无特殊为空条件']).map((rule, idx) =>
          React.createElement('li', { key: `empty_${idx}` }, rule)
        )
      ),
      IS_ADMIN && React.createElement(React.Fragment, null,
        React.createElement('hr', { style: { border: 0, borderTop: '1px solid rgba(255,255,255,0.22)', margin: '8px 0' } }),
        React.createElement('div', { style: { fontSize: '12px', opacity: 0.75, lineHeight: 1.55 } },
          React.createElement('div', { style: { fontWeight: 700, marginBottom: '4px' } }, '🔧 字段说明（开发用）'),
          (fields.length ? fields : [{ label: '字段', field: '无' }]).map((item, idx) => React.createElement('div', { key: `field_${idx}` },
            React.createElement('span', null, `${item.label}：`),
            React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, item.field)
          )),
          React.createElement('div', { style: { marginTop: '4px' } },
            React.createElement('span', null, '写回字段：'),
            React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, writeBackField || '无')
          )
        )
      )
    );
    const renderHeaderLabel = (label, tooltipData, style = {}) => React.createElement(Tooltip, {
      title: tooltipData ? renderTooltip(tooltipData) : label,
      placement: 'top',
      overlayStyle: { maxWidth: '360px' },
      mouseEnterDelay: 0.15,
    }, React.createElement('span', {
      onClick: tooltipData ? (e) => e.stopPropagation() : undefined,
      style: {
        display: 'inline-block',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        cursor: tooltipData ? 'help' : 'default',
        verticalAlign: 'middle',
        ...style,
      },
    }, label));

    const tableWidth = visibleCols.reduce((s, c) => s + getColumnRenderWidth(c), 0);
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

    const currentInfoRow = data[0] || {};
    const topInfoItems = [
      { label: '型号', value: currentInfoRow.model || filterModel || '-' },
      { label: '国家', value: filterCountry || currentInfoRow.country || '-' },
      { label: 'ASIN', value: filterAsin || currentInfoRow.asin || '-' },
      { label: '销售', value: currentInfoRow.sale_owner || currentInfoRow.sales_owner || filterSaleOwner || '-' },
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
        React.createElement('div', { key: item.label, style: { minWidth: 0, borderLeft: index === 0 ? 'none' : '1px solid #d9d9d9', paddingLeft: index === 0 ? 0 : '6px', color: '#333', fontSize: `${FONT_SIZE_SM}px`, fontWeight: 600, lineHeight: '18px', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' } },
          React.createElement('span', { style: { color: '#4d7f78', fontWeight: 600 } }, `${item.label}：`),
          React.createElement('span', null, item.value)
        )
      )
    );
    const actionBusy = loading || refreshingData || calculatingFormulas;
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

    const primaryColorLegendItems = PRESET_COLORS.slice(0, 3);
    const extraColorLegendItems = PRESET_COLORS.slice(3);
    const renderColorLegendItem = (pc) => React.createElement('div', {
      key: pc.label || pc.value,
      style: { display: 'flex', alignItems: 'center', gap: '4px' }
    },
      React.createElement('div', { style: { width: '14px', height: '14px', borderRadius: '3px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
      React.createElement('span', { style: { color: '#666' } }, pc.label)
    );
    const quickJumpEl = termQuickIndexItems.length > 0 && React.createElement('div', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        columnGap: '10px',
        rowGap: '5px',
        flexWrap: 'wrap',
        maxWidth: '100%',
        minHeight: '30px',
        marginBottom: '4px',
        padding: '5px 10px',
        border: '1px solid #e8e8e8',
        borderRadius: '8px',
        background: '#fafafa',
        boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        fontSize: `${FONT_SIZE_XS}px`,
        boxSizing: 'border-box',
      }
    },
      React.createElement('span', { style: { color: '#666', fontWeight: 600, flexShrink: 0 } }, '快速跳转：'),
      React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', columnGap: '5px', flexShrink: 0 } },
        React.createElement('span', { style: { color: '#6d28d9', fontWeight: 700, flexShrink: 0 } }, '关键词'),
        React.createElement(Select, {
          size: 'small',
          value: termQuickSelectValues.keyword,
          allowClear: true,
          showSearch: true,
          placeholder: termQuickSelectOptions.keyword.length ? '选择关键词' : '暂无关键词',
          options: termQuickSelectOptions.keyword,
          onSelect: (key) => handleTermQuickSelect('keyword', key),
          optionFilterProp: 'label',
          disabled: !termQuickSelectOptions.keyword.length,
          style: { width: '220px', maxWidth: '42vw' },
        })
      ),
      React.createElement('div', { style: { display: 'inline-flex', alignItems: 'center', columnGap: '5px', flexShrink: 0 } },
        React.createElement('span', { style: { color: '#0f766e', fontWeight: 700, flexShrink: 0 } }, '词根'),
        React.createElement(Select, {
          size: 'small',
          value: termQuickSelectValues.root,
          allowClear: true,
          showSearch: true,
          placeholder: termQuickSelectOptions.root.length ? '选择词根' : '暂无词根',
          options: termQuickSelectOptions.root,
          onSelect: (key) => handleTermQuickSelect('root', key),
          optionFilterProp: 'label',
          disabled: !termQuickSelectOptions.root.length,
          style: { width: '220px', maxWidth: '42vw' },
        })
      )
    );

    return React.createElement('div', { ref: rootRef, style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),

      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', columnGap: '14px', rowGap: '6px', flexWrap: 'wrap', marginBottom: '4px' },
      },
        headerInfoEl,
        React.createElement('div', {
          style: {
            display: 'inline-flex',
            width: 'fit-content',
            maxWidth: '100%',
            columnGap: '8px',
            rowGap: '4px',
            flexWrap: 'wrap',
            minHeight: '30px',
            marginBottom: '4px',
            padding: '5px 10px',
            background: '#fafafa',
            borderRadius: '8px',
            border: '1px solid #d9d9d9',
            alignItems: 'center',
            fontSize: `${FONT_SIZE_XS}px`,
            boxSizing: 'border-box',
            boxShadow: '0 1px 2px rgba(15,23,42,0.05)',
          }
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
            ...extraColorLegendItems.map(renderColorLegendItem),
            React.createElement('span', { style: { color: '#bbb' } }, '|'),
            React.createElement('span', { style: { fontWeight: 600, color: '#555' } }, '词列默认：'),
            ...TERM_GROUP_COLOR_LEGEND.map(renderColorLegendItem)
          ),
        ),
        quickJumpEl
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
          React.createElement('button', { ref: panelBtnRef, type: 'button', onClick: () => { setShowPanel((v) => !v); setShowPush(false); setShowCrossHighlightPanel(false); setShowDefaultTermConfig(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '👁️ 列设置'),
          IS_ADMIN && React.createElement('button', { ref: pushBtnRef, type: 'button', onClick: () => { setShowPush((v) => !v); setShowPanel(false); setShowCrossHighlightPanel(false); setShowDefaultTermConfig(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '📤 推送配置'),
          React.createElement('button', {
          ref: crossHighlightBtnRef,
          type: 'button',
          onClick: () => { setShowCrossHighlightPanel((v) => !v); setShowPanel(false); setShowPush(false); setShowDefaultTermConfig(false); },
          style: btnStyle('#EB6793', '#fff', '#d84f7c'),
        }, crossHighlightEnabled ? '高亮行列：开' : '高亮行列'),
          React.createElement('button', { type: 'button', onClick: openStageDefaultModal, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '目标份额默认值'),
          React.createElement('button', { type: 'button', onClick: () => { setShowTermManager(true); setShowDefaultTermConfig(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '🔑 管理关键词/词根'),
          IS_ADMIN && React.createElement('button', { type: 'button', onClick: () => { setShowDefaultTermConfig(true); setShowPanel(false); setShowPush(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '默认词配置'),
          React.createElement('button', { type: 'button', onClick: () => { setShowChartModal(true); setShowPanel(false); setShowPush(false); setShowCrossHighlightPanel(false); setShowDefaultTermConfig(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '📈 打开图表')
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
        justifyContent: 'center',
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
        ),

        ),

      panelEl,
      pushPanelEl,
      crossHighlightPanelEl,
      termManagerEl,
      defaultTermConfigEl,
      chartModalEl,
      stageDefaultModalEl,

      React.createElement('textarea', {
        ref: clipboardRef,
        value: '',
        onChange: () => {},
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleDeleteSelectedCells,
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

      React.createElement('div', {
        ref: tableWrapRef,
        tabIndex: 0,
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleDeleteSelectedCells,
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
        !hasRequiredUrlParams
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据 请重新进入页面')
          : loading && data.length === 0
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '正在加载数据...')
          : data.length === 0
            ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据')
            : React.createElement('table', { style: { borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed', background: '#fff', width: `${tableWidth}px` } },
              React.createElement('colgroup', null,
                visibleCols.map((col) => React.createElement('col', {
                  key: `${col.key}_col`,
                  style: { width: `${getColumnRenderWidth(col)}px` },
                }))
              ),
              React.createElement('thead', null,
                React.createElement('tr', null,
                  visibleCols.map((col) => {
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const canEdit  = isCellEditable(col);
                    const isTermCol = !!col._isTermColumn;
                    const hdrColor = isTermCol ? getTermGroupHeaderColor(col) : getColHeaderColor(col);
                    const termGroup = isTermCol ? termHeaderGroups[col._termGroupKey || col._termColumnKey] : null;
                    const headerTooltip = isTermCol ? getTermGroupTooltipData(col, termGroup?.label) : getHeaderTooltipData(col);
                    const hasFormulaTooltip = !isTermCol && !!FORMULA_TOOLTIPS[col.field];
                    if (isTermCol && termGroup?.firstIndex !== visibleCols.findIndex((c) => c.key === col.key)) return null;
                    const termGroupWidth = isTermCol
                      ? visibleCols
                          .filter((c) => c._isTermColumn && (c._termGroupKey || c._termColumnKey) === (col._termGroupKey || col._termColumnKey))
                          .reduce((s, c) => s + getColumnRenderWidth(c), 0)
                      : null;

                    return React.createElement('th', {
                      key: isTermCol ? `${col._termGroupKey}_group` : col.key,
                      rowSpan: isTermCol ? 1 : (hasTermColumns ? 2 : 1),
                      colSpan: isTermCol ? termGroup?.colSpan : undefined,
                      draggable: !isTermCol,
                      onDragStart: (e) => onDragStart(e, col.key),
                      onDragOver,
                      onDrop: (e) => onDrop(e, col.key),
                      onClick: () => handleSort(col.key),
                      style: {
                        position: 'sticky',
                        top: 0,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${termGroupWidth || getColumnRenderWidth(col)}px`,
                        height: isTermCol ? `${TERM_HEADER_MAIN_HEIGHT}px` : undefined,
                        padding: isTermCol ? '4px 18px 4px 8px' : '8px 18px 8px 8px',
                        background: hdrColor,
                        color: getTextColorForBg(hdrColor),
                        borderBottom: isTermCol ? '1px solid rgba(0,0,0,0.08)' : '2px solid rgba(0,0,0,0.1)',
                        borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                        textAlign: isTermCol ? 'center' : 'left',
                        fontWeight: 600,
                        fontSize: isTermCol ? `${FONT_SIZE_XS}px` : `${FONT_SIZE_SM}px`,
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
                        renderHeaderLabel(isTermCol ? termGroup?.label : renderLabelWithRedAsin(col.label), headerTooltip),

                        hasFormulaTooltip && React.createElement(Tooltip, {
                          title: renderTooltip(headerTooltip),
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

                        !isTermCol && React.createElement('span', {
                          style: {
                            marginLeft: '3px',
                            opacity: sortConfig.key === col.key ? 1 : 0.4,
                            fontSize: `${FONT_SIZE_XS}px`,
                            flexShrink: 0,
                          }
                        }, sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'),
                      ),
                      React.createElement('div', {
                        draggable: false,
                        title: isTermCol ? '拖拽调整整个词列宽度' : '拖拽调整列宽',
                        onMouseDown: (e) => isTermCol ? onTermGroupResizeStart(e, col._termGroupKey || col._termColumnKey) : onResizeStart(e, col.key),
                        onClick: (e) => e.stopPropagation(),
                        onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); },
                        style: {
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: isTermCol ? '8px' : '6px',
                          cursor: 'col-resize',
                          zIndex: 5,
                          background: 'transparent'
                        }
                      }),
                    );
                  })
                ),
                hasTermColumns && React.createElement('tr', null,
                  visibleCols.map((col, colIdx) => {
                    if (!col._isTermColumn) return null;
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const hdrColor = getTermFieldHeaderColor(col);
                    const textColor = getTextColorForBg(hdrColor);
                    const groupKey = col._termGroupKey || col._termColumnKey;
                    const nextCol = visibleCols[colIdx + 1];
                    const isTermGroupEnd = !nextCol?._isTermColumn || (nextCol._termGroupKey || nextCol._termColumnKey) !== groupKey;
                    const groupColor = getTermGroupHeaderColor(col);
                    const headerTooltip = getHeaderTooltipData(col);
                    return React.createElement('th', {
                      key: `${col.key}_sub`,
                      draggable: false,
                      onDragStart: (e) => onDragStart(e, col.key),
                      onDragOver,
                      onDrop: (e) => onDrop(e, col.key),
                      onClick: () => handleSort(col.key),
                      style: {
                        position: 'sticky',
                        top: `${TERM_HEADER_MAIN_HEIGHT}px`,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${getColumnRenderWidth(col)}px`,
                        minHeight: `${TERM_HEADER_SUB_HEIGHT}px`,
                        padding: '4px 10px 4px 8px',
                        background: hdrColor,
                        borderBottom: '2px solid rgba(0,0,0,0.12)',
                        borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : (isTermGroupEnd ? `2px solid ${groupColor}66` : '1px solid rgba(0,0,0,0.08)'),
                        boxSizing: 'border-box',
                        color: textColor,
                        textAlign: 'center',
                        fontSize: `${FONT_SIZE_XS}px`,
                        fontWeight: 700,
                        whiteSpace: 'normal',
                        overflow: 'visible',
                        wordBreak: 'break-word',
                        lineHeight: 1.2,
                        cursor: 'pointer',
                      },
                    },
                      renderHeaderLabel(renderLabelWithRedAsin(col.label), headerTooltip, {
                        whiteSpace: 'normal',
                        overflow: 'visible',
                        textOverflow: 'clip',
                        lineHeight: 1.2,
                      }),
                      React.createElement('div', {
                        draggable: false,
                        title: '拖拽调整这个字段宽度',
                        onMouseDownCapture: (e) => onResizeStart(e, col.key),
                        onClick: (e) => e.stopPropagation(),
                        onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); },
                        style: {
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: '10px',
                          cursor: 'col-resize',
                          zIndex: 10,
                          background: 'linear-gradient(to right, transparent, rgba(0,0,0,0.08))'
                        }
                      })
                    );
                  })
                )
              ),
              React.createElement('tbody', null,
                data.map((row, rIdx) => {
                  const rowId = getMainWeekKey(row);
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

                      if (col._isTermColumn) {
                        const term = row.__terms?.[col._termColumnKey];
                        const displayContent = col._termSubType === 'diagnosis' ? getDisplayDiagnosis(col, term, row) : formatTermValue(col, term);
                        const rawValue = term?.[col.field];
                        const groupKey = col._termGroupKey || col._termColumnKey;
                        const nextCol = visibleCols[cIdx + 1];
                        const isTermGroupEnd = !nextCol?._isTermColumn || (nextCol._termGroupKey || nextCol._termColumnKey) !== groupKey;
                        const groupColor = getTermGroupHeaderColor(col);
                        return React.createElement('td', {
                          key: col.key,
                          onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                          onMouseEnter: () => handleCellMouseEnter(rIdx, cIdx),
                          onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, rawValue); },
                          style: {
                            position: isPinned ? 'sticky' : undefined,
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 1 : undefined,
                            background: getTermBodyCellBackground(col, rIdx, cIdx, selected),
                            padding: isEditing ? '4px 6px' : '7px 8px',
                            borderBottom: '1px solid #f0f0f0',
                            borderRight: isTermGroupEnd ? `2px solid ${groupColor}55` : '1px solid #f5f5f5',
                            verticalAlign: 'middle',
                            boxSizing: 'border-box',
                            width: `${getColumnRenderWidth(col)}px`,
                            whiteSpace: isMultilineTermColumn(col) ? 'pre-wrap' : 'nowrap',
                            overflow: isMultilineTermColumn(col) ? 'visible' : 'hidden',
                            textOverflow: isMultilineTermColumn(col) ? 'clip' : 'ellipsis',
                            lineHeight: isMultilineTermColumn(col) ? 1.55 : undefined,
                            textAlign: col._termSubType === 'number' || col._termSubType === 'rate' || col._termSubType === 'stageRate' ? 'right' : 'left',
                            color: canEdit ? '#1677ff' : '#333',
                            fontWeight: col._termSubType === 'number' || col._termSubType === 'rate' ? 700 : 500,
                            fontSize: `${FONT_SIZE}px`,
                            cursor: canEdit && !isEditing ? 'cell' : 'default',
                            outline: canEdit && !isEditing ? '1px dashed transparent' : undefined,
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined,
                          },
                          onMouseLeave: canEdit && !isEditing ? (e) => { e.currentTarget.style.outline = '1px dashed transparent'; } : undefined,
                        }, isEditing ? renderEditInput(col) : displayContent);
                      }

                      const displayContent = formatCell(col, row);

                      return React.createElement('td', {
                        key: col.key, title: typeof displayContent === 'string' ? displayContent : undefined,
                        onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                        onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, getCellRawValue(col, row)); },
                        style: {
                          position: isPinned ? 'sticky' : undefined,
                          left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 1 : undefined,
                          background: getBodyCellBackground(rIdx, cIdx, selected),
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

      React.createElement('div', { style: { marginTop: '6px', padding: '0 2px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' } },
        React.createElement(Pagination, { current: curPage, pageSize, total, pageSizeOptions: PAGE_SIZE_OPTIONS, showSizeChanger: true, showQuickJumper: true, locale: PAGINATION_LOCALE, showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`, onChange: onPageChange, onShowSizeChange: onShowSizeChange, disabled: loading })
      )
    );
  };

  const TableApp = () => {
    const zhCN = {
      locale: 'zh_CN',
      DatePicker: DATE_PICKER_LOCALE,
    };
    return React.createElement(ConfigProvider, { locale: zhCN },
      React.createElement('div', { style: { padding: '16px', fontFamily: 'system-ui, sans-serif', fontSize: `${FONT_SIZE}px`, WebkitFontSmoothing: 'antialiased', textRendering: 'optimizeLegibility', fontVariantNumeric: 'tabular-nums' } },
        React.createElement(MergedTable, null)
      )
    );
  };

  ctx.render(React.createElement(TableApp));
}

run();
