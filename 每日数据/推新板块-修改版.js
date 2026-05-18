async function run() {

  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Drawer, Table, Button, Popconfirm, ConfigProvider, Tooltip } = ctx.libs.antd;

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

  const SRC_DEFAULT_COLOR = {
    daily: COLOR_GREEN, weekly: COLOR_ORANGE, keyword_tracking: '#b5796a', tool: '#fa8c16',
  };

  const getColHeaderColor = (col) => col.headerColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;

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
    rsg_number: `【实际刷单总数】\n= SUM(new_eval_words_daily.actual_review_qty)\n当日所有关键词"实际刷单"求和`,
    daily_eval_demand: `【单日测评应需量】\n= CEIL(预计流量 × 目标转化率 − 预计自然单)\n= CEIL(est_traffic × daily_keyword_tracking.target_cvr − est_nat_order)`,
    actual_natural_order: `【实际自然单】\n= 实际总单量 - 测评单 - 实际广告单\n= weekly_performance.order_items - daily_asins.rsg_number - weekly_performance.guanggaodan\n其中 daily_asins.rsg_number 来源于当日关键词"实际刷单"汇总`,
    plan_eval_judgment: `【计划-测评单判断】对比 单日应需量 vs 预计刷单总数\n• 应需量 = 0      → "无计划"\n• 应需量 > 总数   → "计划测评缺-X单"\n• 应需量 < 总数   → "计划测评超+X单"\n• 相等            → "√"`,
    actual_eval_judgment: `【实际-测评结果判断】对比 实际刷单 vs 预计刷单\n• 预计=0 且 实际=0 → "无计划"\n• 预计=0 且 实际>0 → "无计划但测X单"\n• 实际 > 预计      → "测评超+X单"\n• 实际 < 预计      → "测评缺-X单"\n• 相等             → "√"`,
    actual_cvr_judgment: `【实际测评转化率判断】= IF(实际CVR为空 或 目标CVR为空, "", 判断实际CVR - 目标CVR)对比 weekly_performance.zongcvr vs daily_keyword_tracking.target_cvr\n• 实际CVR - 目标CVR > 0 → "CVR满足+X.XX%"\n• 实际CVR - 目标CVR < 0 → "CVR不达标-X.XX%-广告失控？测评不足？"\n• 实际CVR - 目标CVR = 0 → "CVR持平"`,
  };


  const INITIAL_COLUMNS = [
    { key:'daily_country',         src:'daily',  field:'country',         label:'国家',       hidden:false, pinned:true,  width:70,  editable:false },
    { key:'daily_asin',            src:'daily',  field:'asin',            label:'ASIN',       hidden:false, pinned:true,  width:110, editable:false },
    { key:'daily_date',            src:'daily',  field:'date',            label:'站点时间',       hidden:false, pinned:true,  width:100, editable:false },
    { key:'daily_sale_owner',      src:'daily',  field:'sale_owner',      label:'销售',       hidden:false, pinned:true,  width:80,  editable:false },
    { key:'daily_model',           src:'daily',  field:'model',           label:'型号',       hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_promotion_days',  src:'daily',  field:'promotion_days',  label:'推广天数',   hidden:false, pinned:false, width:85,  editable:false },
    { key:'daily_list_price',      src:'daily',  field:'list_price',      label:'LP/WP/TP',    hidden:false, pinned:false, width:85,  editable:false },
    { key:'daily_off',             src:'daily',  field:'off',             label:'Off 力度',   hidden:false, pinned:false, width:85,  editable:false },
    { key:'daily_price_after_discount', src:'daily', field:'price_after_discount', label:'折后售价', hidden:false, pinned:false, width:85, editable:false },
    { key:'daily_selling_accounts', src:'daily', field:'selling_accounts', label:'售卖账号', hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_rsg_number',      src:'daily',  field:'rsg_number',      label:'实际刷单总数', hidden:false, pinned:false, width:95, editable:false },
    { key:'weekly_order_items',    src:'weekly', field:'order_items',     label:'实际总单量',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_order_items_2',  src:'weekly', field:'order_items',     label:'实际总单量',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_zirandan',       src:'weekly', field:'zirandan',        label:'实际自然单',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_guanggaodan',    src:'weekly', field:'guanggaodan',     label:'实际广告单',   hidden:false, pinned:false, width:90,  editable:false },
    { key:'keyword_tracking_actual_natural_order', src:'keyword_tracking', field:'actual_natural_order', label:'实际自然单', hidden:false, pinned:false, width:105, editable:false },
    { key:'weekly_zongliuliang',   src:'weekly', field:'zongliuliang',    label:'实际流量',     hidden:false, pinned:false, width:85,  editable:false },
    { key:'weekly_zongcvr',        src:'weekly', field:'zongcvr',         label:'实际转化率 CVR', hidden:false, pinned:false, width:110, editable:false },
    { key:'keyword_tracking_est_review_total',    src:'keyword_tracking', field:'est_review_total',     label:'预计刷单总数',            hidden:false, pinned:false, width:100, editable:false },
    { key:'keyword_tracking_est_traffic',         src:'keyword_tracking', field:'est_traffic',          label:'预计流量',                hidden:false, pinned:false, width:90,  editable:false },
    { key:'keyword_tracking_target_cvr',          src:'keyword_tracking', field:'target_cvr',           label:'目标转化率-有备注',              hidden:false, pinned:false, width:90,  editable:false },
    { key:'keyword_tracking_est_nat_order',       src:'keyword_tracking', field:'est_nat_order',        label:'预计自然单 (不含广告单)', hidden:false, pinned:false, width:130, editable:false },
    { key:'keyword_tracking_daily_eval_demand',   src:'keyword_tracking', field:'daily_eval_demand',    label:'单日测评应需量',          hidden:false, pinned:false, width:110, editable:false },
    { key:'keyword_tracking_plan_eval_judgment',  src:'keyword_tracking', field:'plan_eval_judgment',   label:'计划 - 测评单判断',       hidden:false, pinned:false, width:130, editable:false },
    { key:'keyword_tracking_actual_eval_judgment',src:'keyword_tracking', field:'actual_eval_judgment', label:'实际 - 测评结果判断',     hidden:false, pinned:false, width:130, editable:false },
    { key:'keyword_tracking_actual_cvr_judgment', src:'keyword_tracking', field:'actual_cvr_judgment',  label:'实际测评转化率判断',      hidden:false, pinned:false, width:140, editable:false },
    { key:'keyword_tracking_actual_kw_pos', src:'keyword_tracking', field:'actual_keyword_position', label:'实际关键词位', hidden:false, pinned:false, width:280, editable:false },
    { key:'tool_kw_master', src:'tool', field:'tool_kw_master', label:'🔑 管理关键词按钮', hidden:true, pinned:false, width:0, editable:false },
  ];
  
  const WEEKLY_ACTUAL_NATURAL_TRIGGER_FIELDS = new Set(['order_items', 'guanggaodan']);
  const KT_TRIGGER_FIELDS = new Set(['est_traffic','target_cvr','est_nat_order']);

  const SRC_UPDATE_CONFIG = {
    daily:            { url: 'daily_asins:update',            pkField: 'country_asin_date' },
    weekly:           { url: 'weekly_performance:update',     pkField: 'country_asin_week' },
    keyword_tracking: { url: 'daily_keyword_tracking:update', pkField: 'country_asin_date' },
  };

  const MONEY_FIELDS = new Set(['list_price','price_after_discount']);
  const RATE_FIELDS  = new Set(['off', 'zongcvr', 'target_cvr']);
  const NUM_FIELDS   = new Set(['promotion_days','rsg_number','order_items','zirandan','guanggaodan','zongliuliang','est_review_total','est_traffic','est_nat_order','daily_eval_demand','actual_natural_order',]);
  const DATE_FIELDS  = new Set(['date','updatedAt']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  const READONLY_FIELDS = new Set(['country_asin_date','country_asin_week','id','country','asin','date','updatedAt','keywords','tool_kw_master','rsg_number','est_review_total','daily_eval_demand','plan_eval_judgment','actual_eval_judgment','actual_cvr_judgment','est_review_qty','actual_review_qty']);

  const DYNAMIC_COLOR = { country: (row) => COUNTRY_COLORS[row.country] || null };

  const PUSH_PROP_OPTIONS = [
    { label:'显示/隐藏', value:'hidden'      }, { label:'固定列',    value:'pinned'      },
    { label:'列宽',      value:'width'       }, { label:'表头颜色',  value:'headerColor' },
    { label:'可编辑',    value:'editable'    },
  ];

  const SRC_GROUP_CONFIG = [
    { src:'tool',             label:'🛠️ 工具按钮',           color:'#fa8c16'    },
    { src:'daily',            label:'📋 每日 ASIN',          color:COLOR_GREEN  },
    { src:'weekly',           label:'📈 周产品表现',         color:COLOR_ORANGE },
    { src:'keyword_tracking', label:'🔍 关键词追踪汇总',     color:'#b5796a'    },
    { src:'keyword_screenshot', label:'📸 实际关键词位',       color:'#d4380d'    },
  ];

  // 【新增】关键词列的 6 个子字段定义（表头和单元格都按此顺序）
  const KW_SUB_FIELDS = [
    { key: 'est_review_qty',    label: '预计刷单', type: 'number',   width: 80  },
    { key: 'est_rank',          label: '预测词位', type: 'text',     width: 100 },
    { key: 'actual_review_qty', label: '实际刷单', type: 'number',   width: 80  },
    { key: 'actual_rank',       label: '实际词位', type: 'text',     width: 100 },

    // 选填字段：默认隐藏，需要时展开
    { key: 'review_notes',      label: '复盘',    type: 'textarea', width: 100, optional: true },
    { key: 'new_plan',          label: '新计划',  type: 'textarea', width: 100, optional: true },
  ];

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
    const minWidth = getKwMinWidth(showOptional);
    const contentWidth = fields.reduce((s, f) => s + f.width, 0);

    const totalWidth = Math.max(Number(colWidth) || minWidth, minWidth);

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





  const saveColsToUser = async (cols) => {
    if (!currentUserId) return false;
    try {
      const colPayload = cols.map((c) => ({ key: c.key, hidden: c.hidden === true, pinned: c.pinned === true, width: Number(c.width) || 80, headerColor: c.headerColor || null, editable: c.editable === true }));
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      await ctx.request({ url: 'users:update', method: 'post', params: { filterByTk: currentUserId }, data: { setting: { ...existingSetting, [BLOCK_UID]: colPayload } } });
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


  const buildColumns = async () => {
    const saved = await loadColsFromUser();
    if (!saved) return INITIAL_COLUMNS.map((c) => ({ ...c }));
    const initMap  = Object.fromEntries(INITIAL_COLUMNS.map((c) => [c.key, c]));
    const savedMap = Object.fromEntries(saved.map((s) => [s.key, s]));
    const result   = [];
    saved.forEach((s) => {
      if (!s?.key || !initMap[s.key]) return;
      result.push({ ...initMap[s.key], hidden: s.hidden === true, pinned: s.pinned === true, width: Number(s.width) || initMap[s.key].width, headerColor: migrateLegacyColor(s.headerColor), editable: s.editable === true });
    });
    INITIAL_COLUMNS.forEach((c) => { if (!savedMap[c.key]) result.push({ ...c }); });
    return result;
  };

  const formatCell = (col, row) => {
    const v = row[col.field];
    if (col.field === 'promo_day') return v === 1 || v === true ? '是' : (v === 0 || v === false ? '否' : '—');
    if (MONEY_FIELDS.has(col.field)) return (v != null && v !== '') ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2 }) : '—';
    if (RATE_FIELDS.has(col.field))  return (v != null && v !== '') ? `${(Number(v) * 100).toFixed(2)}%` : '—';
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

  /* ========== 【修复】关键词单元格：消除输入框溢出 ========== */
  const KeywordCell = ({ data, countryAsinDate, date, role, onSaved, colWidth, showOptionalFields }) => {
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
          background: '#fafafa',
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
            data: {
              country_asin_date: countryAsinDate,
              eval_word_id: kw.id,
              date,
              [field]: editValue === '' ? null : editValue
            }
          });
          Object.assign(daily, res?.data?.data || { id: 'new', [field]: editValue });
        }
        if (field === 'est_review_qty' || field === 'actual_review_qty') {
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

      const baseBoxStyle = {
        width: '100%',                // ← 关键：占满父容器
        minHeight: '32px',
        padding: '6px 8px',
        background: '#fff',
        border: '1px solid #d0d5dd',
        borderRadius: '4px',
        cursor: 'cell',
        fontSize: '13px',
        fontWeight: isNumber ? 700 : 500,
        color: val != null && val !== '' ? '#000' : '#bbb',
        textAlign: isNumber ? 'center' : 'left',
        boxSizing: 'border-box',      // ← 关键：包含 padding/border
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        lineHeight: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: isNumber ? 'center' : 'flex-start',
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


  const ActualKeywordPosCell = ({ rowId, screenshot, onSaved }) => {
    const [content, setContent] = useState(screenshot || '');
    const [isEditing, setIsEditing] = useState(false);
    const [tempContent, setTempContent] = useState('');
    const [uploading, setUploading] = useState(false);
    const [previewUrl, setPreviewUrl] = useState(null);

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

    const handleDoubleClick = () => {
      setTempContent(content || '');
      setIsEditing(true);
    };

    const saveToDatabase = async (newContent) => {
      if (!rowId) return ctx.message.error('记录ID不存在');

      try {
        await ctx.request({
          url: 'daily_keyword_tracking:update',
          method: 'post',
          params: { filterByTk: rowId },
          data: { actual_keyword_position: newContent }
        });

        setContent(newContent);
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

      return React.createElement(React.Fragment, null,
        React.createElement('div', {
          onDoubleClick: handleDoubleClick,
          style: {
            minHeight: '54px',
            maxHeight: '68px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 8px',
            background: content ? '#fafafa' : '#fff',
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
              display: 'flex',
              flexDirection: 'column',
              gap: '2px'
            }
          },
            React.createElement(Tooltip, {
              title: cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : '暂无内容'),
              placement: 'topLeft',
              mouseEnterDelay: 0.3
            },
              React.createElement('div', {
                style: {
                  fontSize: '13px',
                  color: cleanText ? '#333' : '#999',
                  lineHeight: '18px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }
              },
                cleanText || (imageUrls.length ? `${imageUrls.length} 张截图` : '双击编辑 / 粘贴截图')
              )
            ),

            React.createElement('div', {
              style: {
                fontSize: '11px',
                color: '#aaa',
                lineHeight: '14px'
              }
            },
              imageUrls.length
                ? `截图 ${imageUrls.length} 张 · 双击编辑`
                : '支持 Ctrl + V 粘贴截图'
            )
          )
        ),

        previewLayer
      );
    }

    return React.createElement('div', {
      style: {
        background: '#fff',
        border: '1px solid #1890ff',
        borderRadius: '6px',
        padding: '6px',
        minHeight: '96px',
        boxSizing: 'border-box'
      }
    },
      React.createElement('textarea', {
        value: tempContent,
        onChange: e => setTempContent(e.target.value),
        onPaste: handlePaste,
        onBlur: saveAndExit,
        onKeyDown: (e) => {
          if (e.key === 'Escape') {
            cancelEdit();
          } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            saveAndExit();
          }
        },
        autoFocus: true,
        style: {
          width: '100%',
          height: '84px',
          border: '1px solid #1890ff',
          borderRadius: '4px',
          padding: '8px',
          fontSize: '13px',
          fontFamily: 'monospace',
          resize: 'vertical',
          background: '#fafafa',
          lineHeight: '1.5',
          outline: 'none',
          boxSizing: 'border-box'
        },
        placeholder: '输入文字描述...\n支持 Ctrl + V 粘贴截图\nCtrl + Enter 保存，Esc 取消'
      })
    );
  };


  const KeywordMasterDrawer = ({ visible, onClose, countryAsinOptions, country: propCountry, asin: propAsin, onRefresh }) => {
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
          data: { keyword_name: trimmed, role, country_asin: countryAsin, key_target: keyTargetVal } });

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

  const RECALC_CALCULATORS = {
    keyword_tracking: async (ctx, countryAsinDate) => {
      const ktRes = await ctx.request({
        url: 'daily_keyword_tracking:list', method: 'get',
        params: { filter: JSON.stringify({ country_asin_date: { $eq: countryAsinDate } }), pageSize: 1 }
      });
      const kt = ktRes?.data?.data?.[0];
      if (!kt) return { updates: {}, log: '[跳过] 未找到 keyword_tracking 记录' };

      const dailyRes = await ctx.request({
        url: 'new_eval_words_daily:list', method: 'get',
        params: { filter: JSON.stringify({ country_asin_date: { $eq: countryAsinDate } }), pageSize: 500 }
      });
      const dailyRows = dailyRes?.data?.data || [];
      const estReviewTotal = dailyRows.reduce((s, k) => s + (Number(k.est_review_qty) || 0), 0);
      const actualTotal    = dailyRows.reduce((s, k) => s + (Number(k.actual_review_qty) || 0), 0);

      const wpRes = await ctx.request({
        url: 'weekly_performance:list', method: 'get',
        params: { filter: JSON.stringify({ country_asin_week: { $eq: countryAsinDate } }), pageSize: 1 }
      });
      const wp = wpRes?.data?.data?.[0];

      const weeklyOrderItems = Number(wp?.order_items) || 0;
      const weeklyAdOrders   = Number(wp?.guanggaodan) || 0;

      // 实际自然单 = 实际总单量 - 测评单 - 实际广告单
      // 这里 actualTotal 等价于即将写入 daily_asins.rsg_number 的实际刷单总数
      const actualNaturalOrder = weeklyOrderItems - actualTotal - weeklyAdOrders;

      // ③站内:纯自然+广告单 = weekly_performance.order_items - daily_asins.rsg_number
      const totalOnsiteOrders = weeklyOrderItems - actualTotal;
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
    if (wp && !isBlank(wp.zongcvr) && !isBlank(kt.target_cvr)) {
      const zongcvr = Number(wp.zongcvr);
      const targetCvrVal = Number(kt.target_cvr);

      if (!Number.isNaN(zongcvr) && !Number.isNaN(targetCvrVal)) {
        const diff = zongcvr - targetCvrVal;

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
          est_review_qty:          estReviewTotal,
          actual_review_qty:       actualTotal,
          est_review_total:        estReviewTotal,
          daily_eval_demand:       dailyEvalDemand,
          actual_natural_order:    actualNaturalOrder,
          plan_eval_judgment:      planEvalJudgment,
          actual_eval_judgment:    actualEvalJudgment,
          actual_cvr_judgment:     actualCvrJudgment,
        },
        dailyUpdates: {
          rsg_number: actualTotal,
        },
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
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [sortConfig, setSortConfig]           = useState({ key: 'daily_date', dir: 'asc' });
    const [curPage, setCurPage]                 = useState(1);
    const [pageSize, setPageSize]               = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal]                     = useState(0);
    const [collapsedGroups, setCollapsedGroups] = useState({ daily: true, weekly: true, keyword_tracking: true, tool: true });
    const [editingCell, setEditingCell]         = useState(null);
    const [editValue, setEditValue]             = useState(null);
    const [saving, setSaving]                   = useState(false);
    const [isResizing, setIsResizing]           = useState(false);
    const [dateFilterType, setDateFilterType]   = useState('all');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [kwMasterVisible, setKwMasterVisible] = useState(false);
    const [showKwOptionalFields, setShowKwOptionalFields] = useState(false);
    const [selectedRange, setSelectedRange] = useState(null);
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

    const expandBaseColumnsByHeader = useCallback((cols) => {
      let changed = false;

      const next = cols.map((col) => {
        if (!col || col.src === 'tool') return col;

        const formulaDesc = FORMULA_DESCRIPTIONS[col.field];
        const hasFormulaIcon = !!formulaDesc;
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
            ? Math.max(Number(c.width) || minWidth, minWidth)
            : Math.min(Number(c.width) || minWidth, minWidth),
        }))
      );
    }, [showKwOptionalFields]);


    const allColumns = useMemo(() => {
      const baseCols = columns.filter(c =>
        !['kw_1', 'kw_2', 'kw_3', 'kw_4', 'kw_6'].includes(c.field) &&
        !(c.field && c.field.startsWith('kw_dynamic_'))
      );

      let orderedKwCols = [...dynamicKwCols];
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
    }, [columns, dynamicKwCols, kwColOrder]);

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
    const tableWrapRef = useRef(null);
    const clipboardRef = useRef(null);
    const panelBtnRef = useRef(null);
    const pushBtnRef  = useRef(null);
    const panelPos    = useFloatPos(panelBtnRef, showPanel);
    const pushPos     = useFloatPos(pushBtnRef, showPush);

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

    const urlParams     = useMemo(() => loadUrlParams(), []);
    const filterAsin    = urlParams?.asin    || null;
    const filterCountry = urlParams?.country || null;

    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: !prev[src] })); }, []);

    useEffect(() => {
      (async () => {
        const cols = await buildColumns();
        const expandedCols = expandBaseColumnsByHeader(cols);
        setColumns(expandedCols);
      })();
    }, [expandBaseColumnsByHeader]);

    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);

    const updateAndSave = useCallback((updater) => {
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveColsToUser(next);
        return next;
      });
    }, []);

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
              data: {
                country_asin_date: countryAsinDate,
                country: parts[0] || null,
                asin: parts[1] || null,
                date: parts[2] || null,
                ...orderLinkUpdates,
              },
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

    const recalcAllFormulas = useCallback(async () => {
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

      setCalcAllLoading(true);
      setCalcAllProgress('准备计算...');

      try {
        setCalcAllProgress('正在批量读取数据...');

        const subFilter = JSON.stringify({
          country_asin_date: { $in: keys }
        });

        const weekFilter = JSON.stringify({
          country_asin_week: { $in: keys }
        });
        const calcRelatedPageSize = Math.max(keys.length * 50, 100);

        const [rKeywordTracking, rKwDaily, rWeekly] = await Promise.all([
          ctx.request({
            url: 'daily_keyword_tracking:list',
            method: 'get',
            params: {
              pageSize: calcRelatedPageSize,
              filter: subFilter
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
          })
        ]);

        const keywordTrackingRecords = Array.isArray(rKeywordTracking?.data?.data)
          ? rKeywordTracking.data.data
          : [];

        const kwDailyRecords = Array.isArray(rKwDaily?.data?.data)
          ? rKwDaily.data.data
          : [];

        const weeklyRecords = Array.isArray(rWeekly?.data?.data)
          ? rWeekly.data.data
          : [];

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

        const kwDailyMap = {};
        kwDailyRecords.forEach((d) => {
          const key = d.country_asin_date;
          if (!key) return;

          if (!kwDailyMap[key]) {
            kwDailyMap[key] = [];
          }

          kwDailyMap[key].push(d);
        });

        setCalcAllProgress('正在本地计算公式...');

        const updateJobs = [];
        const patchMap = {};

        let skipCount = 0;

        keys.forEach((countryAsinDate) => {
          const kt = ktMap[countryAsinDate];

          if (!kt) {
            skipCount += 1;
            return;
          }

          const dailyRows = kwDailyMap[countryAsinDate] || [];
          const wp = weeklyMap[countryAsinDate];

          const estReviewTotal = dailyRows.reduce(
            (s, k) => s + (Number(k.est_review_qty) || 0),
            0
          );

          const actualTotal = dailyRows.reduce(
            (s, k) => s + (Number(k.actual_review_qty) || 0),
            0
          );

          const weeklyOrderItems = Number(wp?.order_items) || 0;
          const weeklyAdOrders = Number(wp?.guanggaodan) || 0;

          const actualNaturalOrder = weeklyOrderItems - actualTotal - weeklyAdOrders;

          const totalOnsiteOrders = weeklyOrderItems - actualTotal;
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

          if (wp && !isBlank(wp.zongcvr) && !isBlank(kt.target_cvr)) {
            const zongcvr = Number(wp.zongcvr);
            const targetCvrVal = Number(kt.target_cvr);

            if (!Number.isNaN(zongcvr) && !Number.isNaN(targetCvrVal)) {
              const diff = zongcvr - targetCvrVal;

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
            est_review_qty: estReviewTotal,
            actual_review_qty: actualTotal,
            est_review_total: estReviewTotal,
            daily_eval_demand: dailyEvalDemand,
            actual_natural_order: actualNaturalOrder,
            plan_eval_judgment: planEvalJudgment,
            actual_eval_judgment: actualEvalJudgment,
            actual_cvr_judgment: actualCvrJudgment,
          };

          const dailyUpdates = {
            rsg_number: actualTotal,
          };

          const orderLinkUpdates = {
            total_onsite_orders: totalOnsiteOrders,
            onsite_organic_orders: onsiteOrganicOrders,
          };

          patchMap[countryAsinDate] = {
            ...ktUpdates,
            ...dailyUpdates,
            ...orderLinkUpdates,
          };

          updateJobs.push({
            countryAsinDate,
            ktUpdates,
            dailyUpdates,
            orderLinkUpdates,
          });
        });

        if (!updateJobs.length) {
          ctx.message.warning(`没有可更新的数据，跳过 ${skipCount} 条`);
          setCalcAllProgress('');
          return;
        }

        setCalcAllProgress(`准备写回 ${updateJobs.length} 条记录...`);

        let successCount = 0;
        let failCount = 0;

        const CONCURRENCY = 8;

        await parallelLimit(
          updateJobs,
          CONCURRENCY,
          async (job) => {
            try {
              const writes = [
                ctx.request({
                  url: 'daily_keyword_tracking:update',
                  method: 'post',
                  params: {
                    filterByTk: job.countryAsinDate
                  },
                  data: job.ktUpdates,
                }),

                ctx.request({
                  url: 'daily_asins:update',
                  method: 'post',
                  params: {
                    filterByTk: job.countryAsinDate
                  },
                  data: job.dailyUpdates,
                }),

                (async () => {
                  if (!job.orderLinkUpdates || !Object.keys(job.orderLinkUpdates).length) return;
                  const orderLinkFilter = JSON.stringify({ country_asin_date: { $eq: job.countryAsinDate } });
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
                      params: { filterByTk: job.countryAsinDate },
                      data: job.orderLinkUpdates,
                    });
                  } else {
                    const parts = job.countryAsinDate.split('_');
                    await ctx.request({
                      url: 'daily_order_link_tracking:create',
                      method: 'post',
                      data: {
                        country_asin_date: job.countryAsinDate,
                        country: parts[0] || null,
                        asin: parts[1] || null,
                        date: parts[2] || null,
                        ...job.orderLinkUpdates,
                      },
                    });
                  }
                })(),
              ];

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
            setCalcAllProgress(`正在写回 ${done}/${totalCount}...`);
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
        } else {
          ctx.message.success(
            `自动计算完成：成功 ${successCount} 条，跳过 ${skipCount} 条`
          );
        }
      } catch (err) {
        console.error(err);
        ctx.message.error(`自动计算失败：${err?.message || '未知错误'}`);
      } finally {
        setCalcAllLoading(false);
        setCalcAllProgress('');
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
        const keys = [...new Set(dailyRecords.map(d => d.country_asin_date).filter(Boolean))];
        const caKeys = [...new Set(dailyRecords.map(d => d.country && d.asin ? `${d.country}_${d.asin}` : null).filter(Boolean))];

        if (keys.length === 0) {
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
        const kwDailyRecords         = Array.isArray(rKwDaily?.data?.data)         ? rKwDaily.data.data         : [];

        const dynamicCols = buildDynamicKwCols(kwRecords);
        setDynamicKwCols((prev) => {
          const prevMap = Object.fromEntries(prev.map((c) => [c.key, c]));

          const next = dynamicCols.map((c) => {
            const old = prevMap[c.key];

            return old
              ? {
                  ...c,
                  width: old.width || c.width,
                  hidden: old.hidden === true,
                  pinned: old.pinned === true,
                  headerColor: old.headerColor || c.headerColor,
                }
              : c;
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
                c.headerColor === n.headerColor;
            });

          return same ? prev : next;
        });

        setKwColOrder((prev) => (
          prev.length > 0 || dynamicCols.length === 0
            ? prev
            : dynamicCols.map(c => c.key)
        ));

        const weeklyMap          = {}; weeklyRecords.forEach((w)  => { if (w.country_asin_week)  weeklyMap[w.country_asin_week]   = w; });
        const keywordTrackingMap = {}; keywordTrackingRecords.forEach((kt) => { if (kt.country_asin_date) keywordTrackingMap[kt.country_asin_date] = kt; });

        const kwMapByCa = {};
        kwRecords.forEach(kw => {
          if (!kwMapByCa[kw.country_asin]) kwMapByCa[kw.country_asin] = [];
          kwMapByCa[kw.country_asin].push(kw);
        });

        const kwDailyMap = {};
        kwDailyRecords.forEach(d => {
          kwDailyMap[`${d.eval_word_id}_${d.date}`] = d;
        });

        const mergedData = dailyRecords.map((d) => {
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

              dynamicCols.forEach(dynCol => {
                const kw = kws.find(k => k.id === dynCol._kwId);
                if (kw) {
                  const dailyData = kwDailyMap[`${kw.id}_${dateStr}`] || {};
                  merged[dynCol.field] = { kw, daily: dailyData };
                }
              });
            }
          }
          return merged;
        });

        setData(mergedData);
        setTotal(totalCount);
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
      } finally { setLoading(false); }
    }, [filterAsin, filterCountry, currentUserName, currentUserLevel, getDateRange, buildDynamicKwCols, getDailySort]);

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
        if (field === 'promo_day') { va = Number(va) || 0; vb = Number(vb) || 0; return sortConfig.dir === 'asc' ? va - vb : vb - va; }
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

    const visibleCols   = useMemo(() => { const vis = allColumns.filter((c) => !c.hidden && c.src !== 'tool'); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [allColumns]);
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += col.width || 80; } }); return map; }, [visibleCols]);

    // 是否存在至少一个关键词列 → 需要二级表头
    const hasKwColumns = useMemo(() => visibleCols.some(c => c._isKwColumn), [visibleCols]);

    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();

    const onDrop = useCallback((e, targetKey) => {
      e.preventDefault();
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
    }, [updateAndSave]);

    const onResizeStart = useCallback((e, colKey) => { e.preventDefault(); e.stopPropagation(); const col = allColumns.find((c) => c.key === colKey); resizeRef.current = { colKey, startX: e.clientX, startWidth: col?.width || 80 }; setIsResizing(true); }, [allColumns]);
    const onOverlayMove = useCallback((e) => {
      if (!resizeRef.current) return;

      const { colKey, startX, startWidth } = resizeRef.current;

      const isKwCol = String(colKey).startsWith('kw_dynamic_');
      const minWidth = isKwCol ? getKwMinWidth(showKwOptionalFields) : 40;
      const nw = Math.max(minWidth, startWidth + (e.clientX - startX));


      if (isKwCol) {
        setDynamicKwCols((prev) =>
          prev.map((c) =>
            c.key === colKey
              ? { ...c, width: nw }
              : c
          )
        );
        return;
      }

      updateAndSave((p) =>
        p.map((c) =>
          c.key === colKey
            ? { ...c, width: nw }
            : c
        )
      );
    }, [updateAndSave, showKwOptionalFields]);

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
        slots.push({ type: 'normal', col, colIndex });
      });
      return slots;
    }, [showKwOptionalFields]);

    const getClipboardSlotsForRange = useCallback((c1, c2) => {
      return getClipboardSlots(visibleCols).filter((slot) => slot.colIndex >= c1 && slot.colIndex <= c2);
    }, [getClipboardSlots, visibleCols]);

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

    const handleCellMouseDown = useCallback((e, r, c) => {
      if (e.button !== 0 || isResizing || editingCell) return;
      const tag = String(e.target?.tagName || '').toLowerCase();
      if (['input', 'textarea', 'select', 'button'].includes(tag) || e.target?.closest?.('.ant-picker, .ant-select, .ant-input-number')) return;
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
      const slots = getClipboardSlotsForRange(rect.c1, rect.c2);
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
      const kwOps = [];
      const localPatches = new Map();
      const kwLocalPatches = [];
      const recalcRows = new Set();
      const allSlots = getClipboardSlots(visibleCols);
      const startSlotIndex = allSlots.findIndex((slot) => slot.colIndex === rect.c1);

      if (startSlotIndex < 0) {
        ctx.message.warning('粘贴起点无效');
        return;
      }

      matrix.forEach((line, rr) => {
        line.forEach((cellText, cc) => {
          const row = pagedData[rect.r1 + rr];
          const slot = allSlots[startSlotIndex + cc];
          const col = slot?.col;
          if (!row || !slot || !col) return;
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

          if (!isCellEditable(col)) return;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) return;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) return;
          const valueToSave = parsePastedValue(col, cellText);
          ops.push({ rowId, field: col.field, src: col.src, updateConfig, pkValue, valueToSave });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: valueToSave });
          if (
            (col.src === 'keyword_tracking' && KT_TRIGGER_FIELDS.has(col.field)) ||
            (col.src === 'weekly' && WEEKLY_ACTUAL_NATURAL_TRIGGER_FIELDS.has(col.field))
          ) {
            recalcRows.add(rowId);
          }
        });
      });

      if (!ops.length && !kwOps.length) {
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
              data: {
                country_asin_date: op.rowId,
                eval_word_id: op.kwId,
                date: op.date,
                [op.field]: op.valueToSave,
              },
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

        for (const rowId of recalcRows) {
          await recalcKeywordTracking(rowId);
        }

        ctx.message.success(`已粘贴 ${ops.length + kwOps.length} 个单元格`);
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
      } finally {
        setSaving(false);
      }
    }, [editingCell, getClipboardSlots, isCellEditable, normalizeSelection, pagedData, parseKeywordPastedValue, parsePastedValue, recalcKeywordTracking, saving, selectedRange, visibleCols]);

    const startEdit = useCallback((rowId, col, currentValue) => {
      if (saving) return;
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
        await ctx.request({ url: updateConfig.url, method: 'post', params: { filterByTk: pkValue }, data: { [field]: valueToSave } });
        setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [field]: valueToSave } : r));
        ctx.message.success('保存成功');
        const shouldRecalcKeywordTracking =
          (src === 'keyword_tracking' && KT_TRIGGER_FIELDS.has(field)) ||
          (src === 'weekly' && WEEKLY_ACTUAL_NATURAL_TRIGGER_FIELDS.has(field));

        if (shouldRecalcKeywordTracking) {
          try {
            await recalcKeywordTracking(rowId);
          } catch (e) {
            ctx.message.warning(`自动计算失败：${e?.message || ''}`);
          }
        }
        setEditingCell(null); setEditValue(null);
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setSaving(false); }
    }, [editingCell, editValue, data, saving, recalcKeywordTracking]);

    const refreshData  = useCallback(() => { loadData({ page: curPageRef.current, size: pageSizeRef.current }); ctx.message.success('数据已刷新'); }, [loadData]);
    const resetColumns = useCallback(async () => { const defaults = INITIAL_COLUMNS.map((c) => ({ ...c })); setColumns(defaults); await saveColsToUser(defaults); ctx.message.success('列已重置为默认'); }, []);

    const btnStyle = (bg, color, border) => ({ padding: '5px 12px', background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE}px`, whiteSpace: 'nowrap' });

    const renderEditInput = (col) => {
      if (col.field === 'promo_day') return React.createElement(Select, { ref: inputRef, value: editValue, options: PROMO_DAY_OPTIONS, style: { width: '100%' }, size: 'small', onChange: (v) => setEditValue(v), onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); } });
      const commonProps = { ref: inputRef, value: editValue, onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); }, style: { width: '100%' }, size: 'small' };
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
          onClick: () => togglePin(col.key),
          style: {
            width: '22px',
            textAlign: 'center',
            flexShrink: 0,
            cursor: 'pointer',
            fontSize: `${FONT_SIZE_SM}px`,
            opacity: col.pinned ? 1 : 0.2,
            userSelect: 'none'
          }
        }, '📌'),

        isToolCol && React.createElement('div', {
          style: { width: '22px', flexShrink: 0 }
        }),

        React.createElement('input', {
          type: 'checkbox',
          checked: !col.hidden,
          onChange: () => toggleCol(col.key),
          style: { flexShrink: 0, cursor: 'pointer' }
        }),

        React.createElement('span', {
          style: {
            flex: 1,
            fontSize: `${FONT_SIZE_SM}px`,
            color: col.hidden ? '#ccc' : '#333',
            userSelect: 'none'
          }
        }, col.label),

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

        !isToolCol && React.createElement('div', {
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

    const panelEl = showPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { position: 'fixed', top: `${panelPos.top}px`, left: `${panelPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', width: IS_ADMIN ? '600px' : '520px', maxHeight: '620px', overflowY: 'auto' } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: '#555', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', null, '列设置'),
          React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#aaa', fontWeight: 400 } }, IS_ADMIN ? '📌 固定 | ☑ 显示 | 🎨 颜色 ' : '📌 固定 | ☑ 显示 | 🎨 颜色'),
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
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: group.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' } }, '▼'),
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
      React.createElement(PushPanel, { columns: allColumns, onClose: () => setShowPush(false), anchorPos: pushPos }),
    );

    const tableWidth = visibleCols.reduce((s, c) => s + (c.width || 80), 0);
    const HEADER_MAIN_HEIGHT = 30;
    const HEADER_SUB_HEIGHT = 24;

    return React.createElement('div', { style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),

      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px', alignItems: 'center' } },
        IS_ADMIN && React.createElement('button', { onClick: resetColumns, style: btnStyle('#1890ff', '#fff', '#1890ff') }, '📊 重置列'),
        React.createElement('button', { ref: panelBtnRef, onClick: () => { setShowPanel((v) => !v); setShowPush(false); }, style: btnStyle(showPanel ? '#e6f7ff' : '#fff', '#333', showPanel ? '#1890ff' : '#d9d9d9') }, '👁️ 列设置'),
        IS_ADMIN && React.createElement('button', { ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); }, style: btnStyle(showPush ? '#fff7e6' : '#fff', showPush ? '#fa8c16' : '#333', showPush ? '#fa8c16' : '#d9d9d9') }, '📤 推送配置'),
        React.createElement('button', { onClick: refreshData, style: btnStyle('#fff', '#333', '#d9d9d9') }, '🔄 刷新'),
        IS_ADMIN && React.createElement(Popconfirm, {
          title: `确定要重新计算当前筛选范围内的 ${total} 条记录公式吗？`,
          onConfirm: recalcAllFormulas,
          okText: '开始计算',
          cancelText: '取消',
          disabled: calcAllLoading || loading || !data.length,
        },
          React.createElement('button', {
            disabled: calcAllLoading || loading || !data.length,
            style: {
              ...btnStyle(
                calcAllLoading ? '#f5f5f5' : '#f6ffed',
                calcAllLoading ? '#999' : '#389e0d',
                calcAllLoading ? '#d9d9d9' : '#52c41a'
              ),
              fontWeight: 700,
              opacity: calcAllLoading || loading || !data.length ? 0.65 : 1,
              cursor: calcAllLoading || loading || !data.length ? 'not-allowed' : 'pointer',
              minWidth: '170px',
            }
          },
            calcAllLoading
              ? `🧮 ${calcAllProgress || '计算中...'}`
              : '🧮 自动计算所有公式'
          )
        ),
        kwMasterBtnVisible && React.createElement('button', { onClick: () => setKwMasterVisible(true), style: btnStyle('#fff7e6', '#fa8c16', '#fa8c16') }, '🔑 管理关键词'),
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
              ? '0 0 0 2px rgba(114, 46, 209, 0.12)'
              : 'none'
          }
        }, showKwOptionalFields ? '📝 隐藏复盘/计划' : '📝 显示复盘/计划'),
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
        onMouseUp: stopSelecting,
        onMouseLeave: stopSelecting,
        style: {
          overflowX: 'auto',
          overflowY: 'auto',
          maxHeight: 'calc(100vh - 220px)',
          borderRadius: '8px',
          border: '1px solid #d9d9d9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          background: '#fff',
          outline: 'none'
        } },
        loading && data.length === 0
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
                    const formulaDesc = FORMULA_DESCRIPTIONS[col.field];
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
                        padding: isKwCol ? '3px 6px' : '6px 18px 6px 8px',
                        lineHeight: '18px',
                        background: hdrColor,
                        color: getTextColorForBg(hdrColor),
                        borderBottom: isKwCol ? '1px solid rgba(0,0,0,0.08)' : '2px solid rgba(0,0,0,0.12)',
                        borderRight: '1px solid rgba(0,0,0,0.15)',
                        textAlign: isKwCol ? 'center' : 'left',
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
                      React.createElement('span', { style: { pointerEvents: 'none' } },
                        col.label,
                        col.field === 'target_cvr' && React.createElement(Tooltip, {
                          title: 'ASIN总维度-目标转化率可按前一天实际转化率调整（例：前一天实际转化率没达预期，则今天可手动把"目标转化率"调高）',
                          overlayStyle: { maxWidth: '360px' },
                        },
                          React.createElement('span', {
                            onClick: (e) => e.stopPropagation(),
                            onMouseDown: (e) => e.stopPropagation(),
                            draggable: false,
                            onDragStart: (e) => e.preventDefault(),
                            style: {
                              marginLeft: '4px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              background: '#fff7e6',
                              borderRadius: '12px',
                              padding: '0 4px',
                              fontSize: '12px',
                              fontWeight: 700,
                              color: '#fa8c16',
                              cursor: 'help',
                              lineHeight: 1.4,
                              pointerEvents: 'auto',
                              userSelect: 'none',
                              verticalAlign: 'middle'
                            }
                          }, '💡')
                        ),
                        formulaDesc && React.createElement(Tooltip, {
                          title: React.createElement('pre', { style: { margin: 0, fontFamily: 'inherit', fontSize: '12px', whiteSpace: 'pre-wrap', lineHeight: 1.6 } }, formulaDesc),
                          placement: 'top',
                          overlayStyle: { maxWidth: '420px' },
                        },
                          React.createElement('span', {
                            onClick: (e) => e.stopPropagation(),
                            onMouseDown: (e) => e.stopPropagation(),
                            draggable: false,
                            onDragStart: (e) => e.preventDefault(),
                            style: { marginLeft: '4px', padding: '0 4px', fontSize: `${FONT_SIZE_XS}px`, color: '#fff', background: 'rgba(24,144,255,0.85)', borderRadius: '3px', fontStyle: 'italic', fontWeight: 700, cursor: 'help', pointerEvents: 'auto', userSelect: 'none', verticalAlign: 'middle' }
                          }, 'ƒ')
                        ),
                        !isKwCol && React.createElement('span', { style: { marginLeft: '3px', opacity: sortConfig.key === col.key ? 1 : 0.4, fontSize: `${FONT_SIZE_XS}px` } }, sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : '⇅'),
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
                    const textColor = getTextColorForBg(hdrColor);
                    
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
                        kwSubFields.map(sub =>
                          React.createElement('div', {
                            key: sub.key,
                            style: {
                              flex: `0 0 ${sub.width}px`,
                              maxWidth: `${sub.width}px`,
                              minWidth: 0,
                              textAlign: 'center',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: textColor,
                              padding: '2px 2px',
                              lineHeight: '16px',
                              background: 'rgba(255,255,255,0.15)',
                              borderRadius: '3px',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              boxSizing: 'border-box',
                            }
                          }, sub.label)
                        )
                      )
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
                      const isNum     = ALL_NUMERIC.has(col.field) || col.field === 'promo_day';
                      const canEdit   = isCellEditable(col);
                      const isEditing = editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key;
                      const cIdx      = visibleCols.findIndex((c) => c.key === col.key);
                      const selected  = isCellSelected(rIdx, cIdx);

                      // 动态词列渲染（单行 6 字段紧凑排列）
                      if (col.field && col.field.startsWith('kw_dynamic_')) {
                        return React.createElement('td', {
                          key: col.key,
                          onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                          onMouseEnter: () => handleCellMouseEnter(rIdx, cIdx),
                          style: {
                            position: isPinned ? 'sticky' : undefined,
                            left: isPinned ? `${leftOff}px` : undefined,
                            zIndex: isPinned ? 1 : undefined,
                            background: selected ? '#e6f4ff' : (rIdx % 2 === 0 ? '#fff' : '#fafafa'),
                            padding: '2px',
                            borderBottom: '1px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            verticalAlign: 'middle',
                            boxSizing: 'border-box',
                            width: `${col.width}px`,
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined,
                          }
                        }, React.createElement(KeywordCell, {
                          data: row[col.field],
                          countryAsinDate: rowId,
                          date: row.date ? String(row.date).slice(0, 10) : null,
                          role: col._kwRole || '主推',
                          onSaved: recalcKeywordTracking,
                          colWidth: col.width,
                          showOptionalFields: showKwOptionalFields
                        }));
                      }

                      if (col.key === 'keyword_tracking_actual_kw_pos' || col.field === 'actual_keyword_position') {
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
                            borderBottom: '1px solid #e8e8e8',
                            borderRight: '1px solid #e8e8e8',
                            verticalAlign: 'middle',
                            boxSizing: 'border-box',
                            boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined
                          }
                        },
                          React.createElement(ActualKeywordPosCell, {
                            rowId: rowId,
                            screenshot: row.actual_keyword_position,
                            onSaved: recalcKeywordTracking
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
                          background: selected ? '#e6f4ff' : (rIdx % 2 === 0 ? '#fff' : '#fafafa'),
                          padding: isEditing ? '4px 6px' : '10px 12px',
                          borderBottom: '1px solid #e8e8e8',
                          borderRight: '1px solid #e8e8e8',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: isNum ? 'right' : 'left',
                          color: cellColor || '#1a1a1a',
                          fontWeight: cellColor ? 600 : 500,
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
