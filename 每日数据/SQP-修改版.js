async function run() {

  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal, Form } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const TERM_FIELD_COLOR_SETTING_KEY = `${BLOCK_UID}_termFieldColors`;
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
    const p            = parseSearch(search);
    const country      = p['country']      || null;
    const asin         = p['asin']         || null;
    const search_query = p['search_query'] || null;
    if (!country && !asin && !search_query) return null;
    return { country, asin, search_query };
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
    'purchases_count','purchases_asin_count','weekly_required_orders',
  ]);
  const ZERO_AS_EMPTY_FIELDS = new Set([]);

  const DATE_FIELDS  = new Set(['report_date','week_start_date']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  const READONLY_FIELDS = new Set([
    'country_asin_week_date','country_asin_weekDate','id','country_asin','country','asin','report_date','week_start_date','week_label',
    'search_query_volume','impressions_count','impressions_asin_count','clicks_count','clicks_asin_count',
    'cart_additions_count','cart_additions_asin_count','purchases_count','purchases_asin_count',
    'market_ctr','asin_ctr','market_cart_rate','asin_cart_rate','market_cvr','asin_cvr',
    'asin_click_share','asin_cart_share','asin_purchase_share','weekly_required_orders',
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
    stage_target_share: '手填',
    weekly_required_orders: '阶段目标份额 * 市场周购买量',
    monday_review_note: '用户手填：周一自用备注或复盘。',
    market_diagnosis: '市场数据环比分析：对比当前周与上一周的搜索查询数量、SQP-市场曝光量、SQP-市场点击量、SQP-市场加购量、SQP-市场购买量、SQP-市场 CTR、SQP-市场 加购率、SQP-市场 CVR，展示环比增减。',
    asin_diagnosis: 'Asin数据环比分析：对比当前周与上一周的 SQP-Asin 点击份额、点击量、加购份额、加购量、出单份额、购买量、SQP-Asin CTR、SQP-Asin 加购率、SQP-Asin CVR，展示环比增减。',
    compare_diagnosis: 'Asin与市场数据同比分析：对比 SQP-Asin CTR/CVR/加购率 与 SQP-市场 CTR/CVR/加购率，并根据阶段目标份额计算的一周需出单判断当前 Asin 出单是否达标。',
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

  const PUSH_PROP_OPTIONS = [
    { label:'显示/隐藏', value:'hidden'      }, { label:'固定列',    value:'pinned'      },
    { label:'列宽',      value:'width'       }, { label:'表头颜色',  value:'headerColor' },
    { label:'可编辑',    value:'editable'    },
  ];
  const TERM_PUSH_METADATA_FIELDS = [
    'src', 'field', 'label', 'termGroupDefaultColor',
    '_isTermColumn', '_isTermFieldColumn', '_termColumnKey', '_termGroupKey',
    '_termGroupLabel', '_termType', '_termId', '_termName', '_termSubType',
  ];

  const SRC_GROUP_CONFIG = [
    { src:'main',    label:'📊 SQP 周主表', color:COLOR_GREEN },
    { src:'keyword', label:'🔑 关键词汇总',  color:COLOR_ORANGE },
    { src:'root',    label:'🌱 词根汇总',    color:COLOR_TEAL },
  ];

  const TERM_SUB_FIELDS = [
    { key: 'search_query_volume',       label: '搜索查询数量', type: 'number',    width: 98 },
    { key: 'impressions_count',         label: 'SQP-市场曝光量',     type: 'number',    width: 112 },
    { key: 'clicks_count',              label: 'SQP-市场点击量',     type: 'number',    width: 112 },
    { key: 'cart_additions_count',      label: 'SQP-市场加购量',     type: 'number',    width: 112 },
    { key: 'purchases_count',           label: 'SQP-市场购买量',     type: 'number',    width: 112 },
    { key: 'impressions_asin_count',    label: 'SQP-Asin曝光量',     type: 'number',    width: 112 },
    { key: 'clicks_asin_count',         label: 'SQP-Asin点击量',     type: 'number',    width: 112 },
    { key: 'cart_additions_asin_count', label: 'SQP-Asin加购量',     type: 'number',    width: 112 },
    { key: 'purchases_asin_count',      label: 'SQP-Asin购买量',     type: 'number',    width: 112 },
    { key: 'market_ctr',                label: 'SQP-市场 CTR',       type: 'rate',      width: 102 },
    { key: 'asin_ctr',                  label: 'SQP-Asin CTR',       type: 'rate',      width: 102 },
    { key: 'market_cart_rate',          label: 'SQP-市场 加购率',    type: 'rate',      width: 116 },
    { key: 'asin_cart_rate',            label: 'SQP-Asin 加购率',    type: 'rate',      width: 116 },
    { key: 'market_cvr',                label: 'SQP-市场 CVR',       type: 'rate',      width: 102 },
    { key: 'asin_cvr',                  label: 'SQP-Asin CVR',       type: 'rate',      width: 102 },
    { key: 'asin_click_share',          label: 'SQP-Asin 点击份额',  type: 'rate',      width: 128 },
    { key: 'asin_cart_share',           label: 'SQP-Asin 加购份额',  type: 'rate',      width: 128 },
    { key: 'asin_purchase_share',       label: 'SQP-Asin 出单份额',  type: 'rate',      width: 128 },
    { key: 'stage_target_share',        label: '阶段目标份额', type: 'stageRate', width: 128 },
    { key: 'weekly_required_orders',    label: '一周需出单',   type: 'number',    width: 96 },
    { key: 'market_diagnosis',          label: '市场数据环比分析',       type: 'diagnosis', width: 420 },
    { key: 'asin_diagnosis',            label: 'Asin数据环比分析',       type: 'diagnosis', width: 420 },
    { key: 'compare_diagnosis',         label: 'Asin与市场数据同比分析',    type: 'diagnosis', width: 480 },
    { key: 'monday_review_note',        label: '周一自用备注或复盘', type: 'text', width: 220 },
  ];
  const TERM_GAP = 4;
  const TERM_HEADER_MAIN_HEIGHT = 38;
  const TERM_HEADER_SUB_HEIGHT = 32;
  const DIAGNOSIS_COLUMN_MIN_WIDTH = 420;
  const TERM_ADDED_ORDER_SORT = ['id'];

  const isDiagnosisColumn = (col) => col?._isTermColumn && col._termSubType === 'diagnosis';
  const isMultilineTermColumn = (col) => isDiagnosisColumn(col) || col?.field === 'monday_review_note';
  const getColumnRenderWidth = (col) => {
    const width = Number(col?.width) || 80;
    if (!isDiagnosisColumn(col)) return width;
    return Math.max(width, col.field === 'compare_diagnosis' ? 480 : DIAGNOSIS_COLUMN_MIN_WIDTH);
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

  const saveColsToUser = async (cols) => {
    if (!currentUserId) return false;
    try {
      const colPayload = cols.map((c) => ({
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

  const saveTermFieldColorsToUser = async (fieldColors) => {
    if (!currentUserId) return false;
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      await ctx.request({
        url: 'users:update', method: 'post', params: { filterByTk: currentUserId },
        data: { setting: { ...existingSetting, [TERM_FIELD_COLOR_SETTING_KEY]: fieldColors || {} } },
      });
      return true;
    } catch { ctx.message.error('词下字段颜色保存失败'); return false; }
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

  const buildColumns = async () => {
    const saved = await loadColsFromUser();
    if (!saved) return INITIAL_COLUMNS.map((c) => ({ ...c }));
    const initMap  = Object.fromEntries(INITIAL_COLUMNS.map((c) => [c.key, c]));
    const savedMap = Object.fromEntries(saved.map((s) => [s.key, s]));
    const result   = [];
    saved.forEach((s) => {
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
        result.push({
          ...s,
          label: subDef?.label || s.label,
          hidden: s.hidden === true,
          pinned: s.pinned === true,
          width: Number(s.width) || 80,
          headerColor: migrateLegacyColor(s.headerColor),
          termGroupHeaderColor: migrateLegacyColor(s.termGroupHeaderColor),
          termFieldHeaderColor: migrateLegacyColor(s.termFieldHeaderColor),
          editable: s.editable === true,
        });
      }
    });
    INITIAL_COLUMNS.forEach((c) => { if (!savedMap[c.key]) result.push({ ...c }); });
    return result;
  };

  const formatCell = (col, row) => {
    const v = row[col.field];

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

  const PushPanel = ({ columns, termFieldColors, onClose, anchorPos }) => {
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

    const buildTermFieldColorPayload = useCallback((cols) => {
      const fieldColors = { ...(termFieldColors || {}) };
      cols.forEach((c) => {
        if (!c?._isTermColumn || !c.field) return;
        if (c.termFieldHeaderColor) fieldColors[c.field] = c.termFieldHeaderColor;
      });
      return fieldColors;
    }, [termFieldColors]);

    const buildPayload = useCallback((cols) => cols.map((c) => {
      const item = { key: c.key };
      if (c._isTermColumn) {
        TERM_PUSH_METADATA_FIELDS.forEach((prop) => {
          if (c[prop] !== undefined) item[prop] = c[prop];
        });
      }
      if (selectedProps.includes('hidden'))      item.hidden      = c.hidden === true;
      if (selectedProps.includes('pinned'))      item.pinned      = c.pinned === true;
      if (selectedProps.includes('width'))       item.width       = Number(c.width) || 80;
      if (selectedProps.includes('headerColor')) {
        item.headerColor = c.headerColor || null;
        if (c._isTermColumn) {
          item.termGroupHeaderColor = c.termGroupHeaderColor || null;
          item.termFieldHeaderColor = c.termFieldHeaderColor || termFieldColors?.[c.field] || null;
        }
      }
      if (selectedProps.includes('editable'))    item.editable    = c.editable === true;
      return item;
    }), [selectedProps, termFieldColors]);

    const handlePush = useCallback(async () => {
      if (!selectedUsers.length) { ctx.message.warning('请先选择目标用户'); return; }
      if (!selectedProps.length) { ctx.message.warning('请至少选择一个推送属性'); return; }
      setPushing(true);
      try {
        const payload = buildPayload(columns);
        const termFieldColorPayload = selectedProps.includes('headerColor')
          ? buildTermFieldColorPayload(columns)
          : null;
        const results = await Promise.allSettled(
          selectedUsers.map(async (uid) => {
            const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
            const existingSetting = userRes?.data?.data?.setting || {};
            const nextSetting = { ...existingSetting, [BLOCK_UID]: payload };
            if (termFieldColorPayload) {
              nextSetting[TERM_FIELD_COLOR_SETTING_KEY] = termFieldColorPayload;
            }
            await ctx.request({ url: 'users:update', method: 'post', params: { filterByTk: uid }, data: { setting: nextSetting } });
          })
        );
        const failCount = results.filter((r) => r.status === 'rejected').length;
        if (failCount === 0) { ctx.message.success(`推送成功，已推送给 ${selectedUsers.length} 位用户`); onClose(); }
        else ctx.message.warning(`部分推送失败：${failCount}/${selectedUsers.length} 位用户失败`);
      } catch (err) { ctx.message.error(`推送失败：${err?.message || '未知错误'}`); }
      finally { setPushing(false); }
    }, [selectedUsers, selectedProps, columns, buildPayload, buildTermFieldColorPayload]);

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
  const nullableSum = (rows, field) => {
    let hasValue = false;
    const total = rows.reduce((s, row) => {
      if (!isValidNumber(row?.[field])) return s;
      hasValue = true;
      return s + Number(row[field]);
    }, 0);
    return hasValue ? total : null;
  };
  const divNull = (a, b) => (isValidNumber(a) && isValidNumber(b) && Number(b) !== 0) ? Number(a) / Number(b) : null;
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

  const TermSummaryCell = ({ term, onStageShareSaved }) => {
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
        const stageShare = value === '' || value == null ? null : Number(value) / 100;
        const weeklyRequired = stageShare == null || !isValidNumber(term.purchases_count)
          ? null
          : stageShare * Number(term.purchases_count);
        await ctx.request({
          url: 'sqp_term_weekly:update',
          method: 'post',
          params: { filterByTk: term.term_week_key },
          data: { stage_target_share: stageShare, weekly_required_orders: weeklyRequired },
        });
        onStageShareSaved?.(term.term_week_key, { stage_target_share: stageShare, weekly_required_orders: weeklyRequired });
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
      if (sub.type === 'number') return sub.key === 'weekly_required_orders' ? formatFixed2(term[sub.key]) : formatInt(term[sub.key]);
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

  const TermManagerModal = ({ visible, onClose, country, asin, onRefresh }) => {
    const [tab, setTab] = useState('keyword');
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [name, setName] = useState('');
    const countryAsin = country && asin ? `${country}_${asin}` : null;
    const collection = tab === 'keyword' ? 'sqp_keywords' : 'sqp_roots';
    const nameField = tab === 'keyword' ? 'keyword_name' : 'root_name';
    const title = tab === 'keyword' ? '关键词' : '词根';

    const upsertTermWeekly = async (payload) => {
      const exists = await ctx.request({
        url: 'sqp_term_weekly:list',
        method: 'get',
        params: {
          pageSize: 1,
          filter: JSON.stringify({ term_week_key: { $eq: payload.term_week_key } }),
        },
      });
      const rec = Array.isArray(exists?.data?.data) ? exists.data.data[0] : null;
      if (rec?.term_week_key) {
        const nextPayload = { ...payload };
        if (rec.stage_target_share != null && rec.stage_target_share !== '') {
          nextPayload.stage_target_share = rec.stage_target_share;
          nextPayload.weekly_required_orders = isValidNumber(payload.purchases_count)
            ? safeNum(rec.stage_target_share) * Number(payload.purchases_count)
            : null;
          nextPayload.compare_diagnosis = payload.compare_diagnosis
            ? buildCompareDiagnosis({ ...nextPayload, week_label: payload.week_label })
            : null;
        }
        await ctx.request({
          url: 'sqp_term_weekly:update',
          method: 'post',
          params: { filterByTk: rec.term_week_key },
          data: nextPayload,
        });
      } else {
        await ctx.request({
          url: 'sqp_term_weekly:create',
          method: 'post',
          data: payload,
        });
      }
    };

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

    const recalcTermWeekly = async (termItem, nextName) => {
      const termName = String(nextName || termItem?.[nameField] || '').trim();
      if (!termItem?.id || !countryAsin || !termName) return 0;

      const fetchAll = async (url, params = {}) => {
        const pageSize = 200;
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
          filter: JSON.stringify({
            $and: [
              { country: { $eq: country } },
              { asin: { $eq: asin } },
              { report_date: { $eq: reportDate } },
            ],
          }),
        });
        const termType = tab === 'keyword' ? 'keyword' : 'root';
        const matchedSqpRows = sqpRows.filter((row) => {
          const searchQuery = String(row.search_query || '').trim();
          if (!searchQuery) return false;
          return termType === 'root'
            ? searchQuery.includes(termName)
            : searchQuery === termName;
        });

        const searchQueryVolume = nullableSum(matchedSqpRows, 'search_query_volume');
        const impressionsCount = nullableSum(matchedSqpRows, 'impressions_count');
        const clicksCount = nullableSum(matchedSqpRows, 'clicks_count');
        const cartAdditionsCount = nullableSum(matchedSqpRows, 'cart_additions_count');
        const purchasesCount = nullableSum(matchedSqpRows, 'purchases_count');
        const impressionsAsinCount = nullableSum(matchedSqpRows, 'impressions_asin_count');
        const clicksAsinCount = nullableSum(matchedSqpRows, 'clicks_asin_count');
        const cartAdditionsAsinCount = nullableSum(matchedSqpRows, 'cart_additions_asin_count');
        const purchasesAsinCount = nullableSum(matchedSqpRows, 'purchases_asin_count');
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

        await upsertTermWeekly(payload);
        prevPayload = hasTermData ? payloadWithLabel : null;
        count += 1;
      }
      return count;
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
        setItems(sortTermsByAddedOrder(Array.isArray(res?.data?.data) ? res.data.data : []));
      } catch (err) {
        ctx.message.error(`加载${title}失败：${err?.message || ''}`);
      } finally {
        setLoading(false);
      }
    }, [visible, countryAsin, collection, title]);

    useEffect(() => { load(); }, [load]);
    useEffect(() => { if (!visible) { setName(''); setTab('keyword'); } }, [visible]);

    const addItem = async () => {
      const trimmed = String(name || '').trim();
      if (!trimmed) { ctx.message.warning(`请输入${title}`); return; }
      if (!countryAsin) { ctx.message.warning('请先筛选到具体站点和 ASIN'); return; }
      try {
        setSaving(true);
        const createdRes = await ctx.request({
          url: `${collection}:create`,
          method: 'post',
          data: { country_asin: countryAsin, country, asin, [nameField]: trimmed },
        });
        const created = createdRes?.data?.data || {};
        const termItem = created?.id ? created : await findTermItem(trimmed);
        ctx.message.loading?.(`正在生成${title}汇总...`);
        const count = await recalcTermWeekly(termItem, trimmed);
        setName('');
        await load();
        onRefresh?.();
        ctx.message.success(`新增成功，已生成 ${count} 周汇总`);
      } catch (err) {
        ctx.message.error(`新增失败：${err?.message || ''}`);
      } finally {
        setSaving(false);
      }
    };

    const updateItem = async (item, value) => {
      try {
        await ctx.request({
          url: `${collection}:update`,
          method: 'post',
          params: { filterByTk: item.id },
          data: { [nameField]: value || null },
        });
        const nextValue = value || null;
        setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, [nameField]: nextValue } : it));
        if (nextValue) {
          const count = await recalcTermWeekly({ ...item, [nameField]: nextValue }, nextValue);
          ctx.message.success(`已更新，并重算 ${count} 周汇总`);
        }
        onRefresh?.();
      } catch (err) {
        ctx.message.error(`保存失败：${err?.message || ''}`);
      }
    };

    const deleteItem = async (item) => {
      try {
        const termType = tab === 'keyword' ? 'keyword' : 'root';
        let deletedTermRows = 0;
        while (true) {
          const termName = String(item?.[nameField] || '').trim();
          const termMatchers = [{ term_id: { $eq: item.id } }];
          if (termName) termMatchers.push({ term_name: { $eq: termName } });
          const termRowsRes = await ctx.request({
            url: 'sqp_term_weekly:list',
            method: 'get',
            params: {
              pageSize: 500,
              filter: JSON.stringify({
                $and: [
                  { country_asin: { $eq: countryAsin } },
                  { term_type: { $eq: termType } },
                  { $or: termMatchers },
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
                  items.map((item) => React.createElement('div', {
                    key: item.id,
                    style: { display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'center' },
                  },
                    React.createElement(Input, {
                      defaultValue: item[nameField] || '',
                      onBlur: (e) => updateItem(item, e.target.value.trim()),
                      onPressEnter: (e) => e.currentTarget.blur(),
                    }),
                    React.createElement(Popconfirm, { title: `确定删除「${item[nameField] || title}」？`, onConfirm: () => deleteItem(item) },
                      React.createElement(Button, { danger: true }, '删除')
                    )
                  ))
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
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [termFieldColors, setTermFieldColors] = useState({});
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
    const [dateFilterType, setDateFilterType]   = useState('all');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [selectedRange, setSelectedRange]     = useState(null);
    const selectingRef = useRef(false);
    const autoWidthDoneRef = useRef(false);
    const manuallyResizedRef = useRef(new Set());
    const termColumnPrefsRef = useRef({ byKey: {}, fieldColors: {}, groupColors: {}, groupColorsByName: {} });

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

    const urlParams            = useMemo(() => loadUrlParams(), []);
    const filterAsin           = urlParams?.asin         || null;
    const filterCountry        = urlParams?.country      || null;

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

    useEffect(() => {
      let cancelled = false;
      (async () => {
        const [cols, fixedFieldColors] = await Promise.all([buildColumns(), loadTermFieldColorsFromUser()]);
        if (cancelled) return;
        setTermFieldColors(fixedFieldColors);
        rememberTermColumnPrefs(cols, fixedFieldColors);
        setColumns(cols);
        setConfigReady(true);
      })();
      return () => { cancelled = true; };
    }, [rememberTermColumnPrefs]);
    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);

    const updateAndSave = useCallback((updater) => {
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        rememberTermColumnPrefs(next);
        saveColsToUser(next);
        return next;
      });
    }, [rememberTermColumnPrefs]);

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
        const dynamic = Array.from(seen.values()).map((col) => {
          const oldCol = old[col.key] || cachedPrefs.byKey[col.key] || {};
          const groupKey = col._termGroupKey || col._termColumnKey;
          const groupIndex = groupOrder.has(groupKey) ? groupOrder.get(groupKey) : 0;
          const groupNameKey = col._termType && col._termName ? `${col._termType}:${String(col._termName).trim().toLowerCase()}` : null;
          return {
            ...col,
            ...oldCol,
            label: col.label,
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
      const requestSeq = ++requestSeqRef.current;
      try {
        setLoading(true);
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

        if (mainRecords.length === 0 && page > 1 && totalCount > 0) {
          const maxPage = Math.max(1, Math.ceil(totalCount / size));
          if (page > maxPage) {
            setCurPage(maxPage);
            load({ page: maxPage, size });
          }
        }
      } catch (err) {
        if (requestSeq !== requestSeqRef.current) return;
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
      } finally {
        if (requestSeq === requestSeqRef.current) setLoading(false);
      }
    }, [filterAsin, filterCountry, getDateRange, loadActiveTermRefs, mergeTermColumns, sortConfig, getTermOrderIndex]);

    useEffect(() => {
      if (!configReady) return;
      setCurPage(1);
      load({ page: 1 });
    }, [configReady, load]);

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
            else if (MONEY_FIELDS.has(col.field)) displayStr = Number(value).toLocaleString('zh-CN', { minimumFractionDigits: 2 });
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
        load({ page: 1, size });
      } else {
        setCurPage(page);
        load({ page, size });
      }
    }, [load]);

    const onShowSizeChange = useCallback((page, size) => {
      setCurPage(1);
      setPageSize(size);
      load({ page: 1, size });
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
      setTermFieldColors((prev) => {
        const next = { ...prev };
        if (color) next[field] = color;
        else delete next[field];
        termColumnPrefsRef.current = {
          ...(termColumnPrefsRef.current || { byKey: {}, fieldColors: {}, groupColors: {}, groupColorsByName: {} }),
          fieldColors: next,
        };
        saveTermFieldColorsToUser(next);
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
    const termSettingGroups = useMemo(() => {
      const groups = {};
      columns.filter((c) => c._isTermColumn).forEach((col) => {
        const key = col._termGroupKey || col._termColumnKey;
        if (!groups[key]) {
          groups[key] = {
            key,
            src: col.src,
            label: `${col.src === 'root' ? '🌱 词根' : '🔑 关键词'}：${col._termGroupLabel || col._termName || col.label}`,
            color: SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN,
            cols: [],
          };
        }
        groups[key].cols.push(col);
      });
      return Object.values(groups);
    }, [columns]);

    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();
    const onDrop      = (e, targetKey) => { e.preventDefault(); const fromKey = dragColKey.current; if (!fromKey || fromKey === targetKey) return; updateAndSave((prev) => { const next = [...prev]; const fi = next.findIndex((c) => c.key === fromKey); const ti = next.findIndex((c) => c.key === targetKey); const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved); return next; }); dragColKey.current = null; };

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
        updateAndSave((p) => p.map((c) => c._isTermColumn && fields.includes(c.field)
          ? { ...c, width: Math.max(40, (info.startWidths[c.field] || 80) + perColDelta) }
          : c
        ));
        return;
      }
      const targetCol = columns.find((c) => c.key === info.colKey);
      const minWidth = isDiagnosisColumn(targetCol)
        ? (targetCol.field === 'compare_diagnosis' ? 480 : DIAGNOSIS_COLUMN_MIN_WIDTH)
        : 40;
      const nw = Math.max(minWidth, info.startWidth + delta);
      updateAndSave((p) => p.map((c) => info.termField && c._isTermColumn && c.field === info.termField ? { ...c, width: nw } : (c.key === info.colKey ? { ...c, width: nw } : c)));
    }, [columns, updateAndSave]);
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
      if (col._termSubType === 'number') return col.field === 'weekly_required_orders' ? formatFixed2(value) : formatInt(value);
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
        return !isNaN(num) ? num / 100 : null;
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
          const weeklyRequired = valueToSave == null || !isValidNumber(term.purchases_count)
            ? null
            : safeNum(valueToSave) * Number(term.purchases_count);
          const nextTerm = { ...term, stage_target_share: valueToSave, weekly_required_orders: weeklyRequired };
          dataPatch.weekly_required_orders = weeklyRequired;
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
    }, [getTermRecord]);

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

        ctx.message.success(`已粘贴 ${ops.length} 个单元格`);
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [buildUpdatePatch, editingCell, isCellEditable, normalizeSelection, data, parsePastedValue, saving, selectedRange, visibleCols]);

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
        valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) / 100 : null;
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

    const refreshData  = useCallback(() => { load({ page: curPageRef.current, size: pageSizeRef.current }); ctx.message.success('数据已刷新'); }, [load]);
    const calculateFormulas = useCallback(async () => {
      if (!IS_ADMIN) return;
      if (!filterCountry || !filterAsin) {
        ctx.message.warning('请先筛选到具体站点和 ASIN，再计算公式');
        return;
      }

      const countryAsin = `${filterCountry}_${filterAsin}`;
      const fetchAll = async (url, params = {}) => {
        const pageSize = 200;
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

      const upsertTermWeekly = async (payload) => {
        const exists = await ctx.request({
          url: 'sqp_term_weekly:list',
          method: 'get',
          params: {
            pageSize: 1,
            filter: JSON.stringify({ term_week_key: { $eq: payload.term_week_key } }),
          },
        });
        const rec = Array.isArray(exists?.data?.data) ? exists.data.data[0] : null;
        if (rec?.term_week_key) {
          const nextPayload = { ...payload };
          if (rec.stage_target_share != null && rec.stage_target_share !== '') {
            nextPayload.stage_target_share = rec.stage_target_share;
            nextPayload.weekly_required_orders = isValidNumber(payload.purchases_count)
              ? safeNum(rec.stage_target_share) * Number(payload.purchases_count)
              : null;
            nextPayload.compare_diagnosis = payload.compare_diagnosis
              ? buildCompareDiagnosis({ ...nextPayload, week_label: payload.week_label })
              : null;
          }
          await ctx.request({
            url: 'sqp_term_weekly:update',
            method: 'post',
            params: { filterByTk: rec.term_week_key },
            data: nextPayload,
          });
          return;
        }
        await ctx.request({
          url: 'sqp_term_weekly:create',
          method: 'post',
          data: payload,
        });
      };

      const buildTermPayloads = async (termType, termItem, termName, weeks) => {
        let count = 0;
        let prevPayload = null;
        for (const week of weeks) {
          const reportDate = week.report_date ? String(week.report_date).slice(0, 10) : null;
          if (!reportDate) continue;
          const sqpRows = await fetchAll('sqp:list', {
            filter: JSON.stringify({
              $and: [
                { country: { $eq: filterCountry } },
                { asin: { $eq: filterAsin } },
                { report_date: { $eq: reportDate } },
              ],
            }),
          });
          const matchedSqpRows = sqpRows.filter((row) => {
            const searchQuery = String(row.search_query || '').trim();
            if (!searchQuery) return false;
            return termType === 'root'
              ? searchQuery.includes(termName)
              : searchQuery === termName;
          });

          const searchQueryVolume = nullableSum(matchedSqpRows, 'search_query_volume');
          const impressionsCount = nullableSum(matchedSqpRows, 'impressions_count');
          const clicksCount = nullableSum(matchedSqpRows, 'clicks_count');
          const cartAdditionsCount = nullableSum(matchedSqpRows, 'cart_additions_count');
          const purchasesCount = nullableSum(matchedSqpRows, 'purchases_count');
          const impressionsAsinCount = nullableSum(matchedSqpRows, 'impressions_asin_count');
          const clicksAsinCount = nullableSum(matchedSqpRows, 'clicks_asin_count');
          const cartAdditionsAsinCount = nullableSum(matchedSqpRows, 'cart_additions_asin_count');
          const purchasesAsinCount = nullableSum(matchedSqpRows, 'purchases_asin_count');
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
          await upsertTermWeekly(payload);
          prevPayload = hasTermData ? payloadWithLabel : null;
          count += 1;
        }
        return count;
      };

      try {
        setCalculatingFormulas(true);
        const [keywords, roots, weeks] = await Promise.all([
          fetchAll('sqp_keywords:list', { sort: TERM_ADDED_ORDER_SORT, filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) }),
          fetchAll('sqp_roots:list', { sort: TERM_ADDED_ORDER_SORT, filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) }),
          fetchAll('sqp_weekly_main:list', { sort: 'report_date', filter: JSON.stringify({ country_asin: { $eq: countryAsin } }) }),
        ]);
        const orderedKeywords = sortTermsByAddedOrder(keywords);
        const orderedRoots = sortTermsByAddedOrder(roots);
        let totalWeeks = 0;
        for (const keyword of orderedKeywords) {
          const termName = String(keyword.keyword_name || '').trim();
          if (!keyword.id || !termName) continue;
          totalWeeks += await buildTermPayloads('keyword', keyword, termName, weeks);
        }
        for (const root of orderedRoots) {
          const termName = String(root.root_name || '').trim();
          if (!root.id || !termName) continue;
          totalWeeks += await buildTermPayloads('root', root, termName, weeks);
        }
        ctx.message.success(`计算完成：${keywords.length} 个关键词、${roots.length} 个词根，共 ${totalWeeks} 条周汇总`);
        load({ page: curPageRef.current, size: pageSizeRef.current });
      } catch (err) {
        ctx.message.error(`计算失败：${err?.message || '未知错误'}`);
      } finally {
        setCalculatingFormulas(false);
      }
    }, [filterCountry, filterAsin, load]);

    const resetColumns = useCallback(async () => {
      const defaults = INITIAL_COLUMNS.map((c) => ({ ...c }));
      setColumns(defaults);
      setTermFieldColors({});
      termColumnPrefsRef.current = { byKey: {}, fieldColors: {}, groupColors: {}, groupColorsByName: {} };
      await saveColsToUser(defaults);
      await saveTermFieldColorsToUser({});
      ctx.message.success('列已重置为默认');
    }, []);

    const btnStyle = (bg, color, border) => ({ padding: '5px 12px', background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE}px`, whiteSpace: 'nowrap' });

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
        showColor && renderColorSwatches(currentColor, isCustom, (color) => setHColor(col.key, color), () => clearHColor(col.key), srcDefault),
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
              React.createElement('span', { style: { flex: 1 } }, '🎨 词下字段统一颜色'),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', fontWeight: 400 } }, `${TERM_SUB_FIELDS.length} 个字段`)
            ),
            !isCollapsed && React.createElement('div', null,
              TERM_SUB_FIELDS.map((sub) => {
                const fixedColor = termFieldColors[sub.key] || null;
                const sampleCol = columns.find((c) => c._isTermColumn && c.field === sub.key) || { src: 'keyword', field: sub.key, termFieldHeaderColor: fixedColor };
                const currentColor = getTermFieldHeaderColor(sampleCol);
                const isCustom = !!fixedColor || !!sampleCol.termFieldHeaderColor;
                const resetColor = SRC_DEFAULT_COLOR[sampleCol.src] || COLOR_ORANGE;
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
                  React.createElement('span', {
                    style: {
                      width: '170px',
                      fontSize: `${FONT_SIZE_SM}px`,
                      color: '#333',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }
                  }, sub.label),
                  renderColorSwatches(currentColor, isCustom, (color) => setTermFieldColor(sub.key, color), () => clearTermFieldColor(sub.key), resetColor)
                );
              })
            )
          );
        })(),
        SRC_GROUP_CONFIG.filter((group) => group.src === 'main').map((group) => {
          const groupCols   = columns.filter((c) => c.src === group.src && !c._isTermColumn);
          if (!groupCols.length) return null;
          const isCollapsed = isGroupCollapsed(group.src);
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
        termSettingGroups.map((group) => {
          const groupCols = group.cols;
          if (!groupCols.length) return null;
          const isCollapsed = isGroupCollapsed(group.key);
          const visCount = groupCols.filter((c) => !c.hidden).length;
          const firstCol = groupCols[0];
          const groupColor = getTermGroupHeaderColor(firstCol);
          const isCustom = !!firstCol.termGroupHeaderColor;
          const resetColor = firstCol.termGroupDefaultColor || getTermGroupDefaultColor(firstCol._termType, 0);
          return React.createElement('div', { key: group.key, style: { marginBottom: '6px', border: `1px solid ${group.color}40`, borderRadius: '6px', overflow: 'hidden' } },
            React.createElement('div', { onClick: () => toggleGroup(group.key), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer', userSelect: 'none', background: `${group.color}18`, borderBottom: isCollapsed ? 'none' : `1px solid ${group.color}30` } },
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: group.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
              React.createElement('span', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: group.color, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999' } }, '词列色'),
              renderColorSwatches(groupColor, isCustom, (color) => setTermGroupColor(group.key, color), () => clearTermGroupColor(group.key), resetColor),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); updateAndSave((p) => p.map((c) => c._isTermColumn && (c._termGroupKey || c._termColumnKey) === group.key ? { ...c, hidden: false } : c)); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全选'),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); updateAndSave((p) => p.map((c) => c._isTermColumn && (c._termGroupKey || c._termColumnKey) === group.key ? { ...c, hidden: true } : c)); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全取消')
            ),
            !isCollapsed && React.createElement('div', null, groupCols.map((col) => renderColRow(col, { showColor: false }))),
          );
        }),
      ),
    );

    const pushPanelEl = showPush && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPush(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement(PushPanel, { columns, termFieldColors, onClose: () => setShowPush(false), anchorPos: pushPos }),
    );

    const termManagerEl = React.createElement(TermManagerModal, {
      visible: showTermManager,
      onClose: () => setShowTermManager(false),
      country: filterCountry,
      asin: filterAsin,
      onRefresh: refreshData,
    });

    const tableWidth = visibleCols.reduce((s, c) => s + getColumnRenderWidth(c), 0);

    return React.createElement('div', { style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),

      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' } },
        IS_ADMIN && React.createElement('button', { onClick: resetColumns, style: btnStyle('#1890ff', '#fff', '#1890ff') }, '？ 重置列'),
        React.createElement('button', { ref: panelBtnRef, onClick: () => { setShowPanel((v) => !v); setShowPush(false); }, style: btnStyle(showPanel ? '#e6f7ff' : '#fff', '#333', showPanel ? '#1890ff' : '#d9d9d9') }, '👁️ 列设置'),
        IS_ADMIN && React.createElement('button', { ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); }, style: btnStyle(showPush ? '#fff7e6' : '#fff', showPush ? '#fa8c16' : '#333', showPush ? '#fa8c16' : '#d9d9d9') }, '📤 推送配置'),
        React.createElement('button', { onClick: refreshData, style: btnStyle('#fff', '#333', '#d9d9d9') }, '🔄 刷新'),
        IS_ADMIN && React.createElement('button', {
          onClick: calculateFormulas,
          disabled: calculatingFormulas,
          style: btnStyle(calculatingFormulas ? '#f5f5f5' : '#f6ffed', calculatingFormulas ? '#999' : '#389e0d', calculatingFormulas ? '#d9d9d9' : '#52c41a'),
        }, calculatingFormulas ? '计算中...' : '🧮 计算公式'),
        React.createElement('button', { onClick: () => setShowTermManager(true), style: btnStyle('#fff7e6', '#ad6800', '#faad14') }, '🔑 管理关键词/词根'),
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
      termManagerEl,

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
          fontSize: `${FONT_SIZE_XS}px`,
        }
      },
        React.createElement('span', { style: { fontWeight: 600, color: '#555', marginRight: '4px' } }, '🎨 列头颜色：'),
        ...PRESET_COLORS.map(pc =>
          React.createElement('div', { key: pc.value, style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            React.createElement('div', { style: { width: '14px', height: '14px', borderRadius: '3px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
            React.createElement('span', { style: { color: '#666' } }, pc.label)
          )
        ),
        React.createElement('span', { style: { color: '#bbb' } }, '|'),
        React.createElement('span', { style: { fontWeight: 600, color: '#555' } }, '词列默认：'),
        ...TERM_GROUP_COLOR_LEGEND.map(pc =>
          React.createElement('div', { key: pc.label, style: { display: 'flex', alignItems: 'center', gap: '4px' } },
            React.createElement('div', { style: { width: '14px', height: '14px', borderRadius: '3px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
            React.createElement('span', { style: { color: '#666' } }, pc.label)
          )
        ),
      ),

      termQuickIndexItems.length > 0 && React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          marginBottom: '8px',
          padding: '4px 8px',
          border: '1px solid #e8e8e8',
          borderRadius: '4px',
          background: '#fff',
          overflowX: 'auto',
          whiteSpace: 'nowrap',
          fontSize: `${FONT_SIZE_XS}px`,
        }
      },
        React.createElement('span', { style: { color: '#666', fontWeight: 600, flexShrink: 0 } }, '词列索引：'),
        termQuickIndexItems.map((item) => React.createElement('button', {
          key: item.key,
          onClick: () => scrollToTermGroup(item.left),
          title: `${item.typeLabel}：${item.label}`,
          style: {
            flexShrink: 0,
            padding: '2px 8px',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
            background: item.typeLabel === '词根' ? '#f0fdfa' : '#f5f3ff',
            color: item.typeLabel === '词根' ? '#0f766e' : '#6d28d9',
            cursor: 'pointer',
            fontSize: `${FONT_SIZE_XS}px`,
            maxWidth: '180px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }
        }, `${item.label}（${item.typeLabel}）`))
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
                    const formulaDesc = isTermCol ? null : (FORMULA_DESCRIPTIONS[col.field] || null);
                    const termGroup = isTermCol ? termHeaderGroups[col._termGroupKey || col._termColumnKey] : null;
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
                        formulaDesc ? React.createElement(Tooltip, {
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
                        }, React.createElement('span', {
                          onClick: (e) => e.stopPropagation(),
                          style: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            cursor: 'help',
                          }
                        }, isTermCol ? termGroup?.label : renderLabelWithRedAsin(col.label))) : React.createElement('span', {
                          style: {
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }
                        }, isTermCol ? termGroup?.label : renderLabelWithRedAsin(col.label)),

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
                    const formulaDesc = FORMULA_DESCRIPTIONS[col.field] || null;
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
                        height: `${TERM_HEADER_SUB_HEIGHT}px`,
                        padding: '4px 8px',
                        background: hdrColor,
                        borderBottom: '2px solid rgba(0,0,0,0.12)',
                        borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : (isTermGroupEnd ? `2px solid ${groupColor}66` : '1px solid rgba(0,0,0,0.08)'),
                        boxSizing: 'border-box',
                        color: textColor,
                        textAlign: 'center',
                        fontSize: `${FONT_SIZE_XS}px`,
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        cursor: 'pointer',
                      },
                    },
                      formulaDesc ? React.createElement(Tooltip, {
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
                      }, React.createElement('span', {
                        onClick: (e) => e.stopPropagation(),
                        style: {
                          display: 'inline-block',
                          maxWidth: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          cursor: 'help',
                          verticalAlign: 'middle',
                        },
                      }, renderLabelWithRedAsin(col.label))) : renderLabelWithRedAsin(col.label),
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
                            background: getTermCellBackground(col, rIdx, selected),
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
        React.createElement(Pagination, { current: curPage, pageSize, total, pageSizeOptions: PAGE_SIZE_OPTIONS, showSizeChanger: true, showQuickJumper: true, showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`, onChange: onPageChange, onShowSizeChange: onShowSizeChange, disabled: loading })
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
