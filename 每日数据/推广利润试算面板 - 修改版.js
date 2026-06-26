const React = ctx.libs.React;
const { useEffect, useState } = React;
const {
  Alert,
  Button,
  Col,
  DatePicker,
  Divider,
  Empty,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Row,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
  message,
} = ctx.libs.antd;
const {
  DeleteOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SaveOutlined,
} = ctx.libs.antdIcons || {};

const { Text } = Typography;
const R = React;

const COLLECTION = 'promotion_profit_scenarios';
const PRICING_COLLECTION = 'pricing_scenarios';

const M = {
  primary: '#217346',
  primaryHover: '#185c37',
  primaryLight: '#8bc59f',
  primaryBg: '#e2f0d9',
  pageBg: '#e9edf3',
  cardBg: '#ffffff',
  sectionBg: '#f3f6f8',
  inputBg: '#ffffff',
  disabledBg: '#edf2f7',
  green: '#548235',
  greenBg: '#e2f0d9',
  greenBd: '#a9d08e',
  red: '#c00000',
  redBg: '#fce4d6',
  redBd: '#f4b183',
  orange: '#c55a11',
  orangeBg: '#fce4d6',
  orangeBd: '#f4b183',
  teal: '#1f4e78',
  tealBg: '#ddebf7',
  tealBd: '#9dc3e6',
  violet: '#8064a2',
  violetBg: '#e4dfec',
  violetBd: '#b4a7d6',
  navy: 'rgba(0,0,0,0.88)',
  textPrimary: 'rgba(0,0,0,0.88)',
  textSecond: 'rgba(0,0,0,0.65)',
  textMuted: 'rgba(0,0,0,0.45)',
  border: '#b7c3cf',
  borderLight: '#d9e2ec',
  radius: '4px',
  radiusSm: '3px',
  radiusXs: '2px',
  font: 'Aptos, "Segoe UI", "Microsoft YaHei UI", "PingFang SC", "Hiragino Sans GB", Arial, sans-serif',
  fontMono: '"SF Mono", "Cascadia Mono", Consolas, "Microsoft YaHei UI", monospace',
  shadow: '0 1px 2px rgba(0,0,0,0.03)',
  shadowSm: '0 1px 2px rgba(0,0,0,0.03)',
};

const PRODUCT_CONFIG_PERCENT_FIELDS = [
  'tax_rate',
  'commission_rate',
  'storage_rate',
  'coupon_commission_rate',
  'lightning_commission_rate',
  'offsite_commission_rate',
  'refund_rate_new',
  'refund_rate_used',
  'refund_rate_review',
];

const PRODUCT_CONFIG_FORM_SECTIONS = [
  {
    title: '基础成本',
    fields: [
      { name: 'cost_rmb', label: '产品成本（RMB）', required: true, step: 0.01, isPercent: false },
      { name: 'detection_machine_cost_rmb', label: '检测机产品成本（RMB）', step: 0.01, isPercent: false },
      { name: 'exchange_rate', label: '汇率', step: 0.0001, isPercent: false },
      { name: 'freight_per_unit_rmb', label: '头程费用（单台 RMB）', step: 0.01, isPercent: false },
      { name: 'tax_rate', label: '税点', step: 0.01, isPercent: true },
    ],
  },
  {
    title: '平台费用',
    fields: [
      { name: 'commission_rate', label: '佣金占比', step: 0.01, isPercent: true },
      { name: 'storage_rate', label: '仓储费占比', step: 0.01, isPercent: true },
      { name: 'fba_fee', label: '配送费（当地币）', step: 0.01, isPercent: false },
      { name: 'inbound_fee', label: '入库配置费（当地币）', step: 0.01, isPercent: false },
    ],
  },
  {
    title: '促销费用',
    fields: [
      { name: 'coupon_commission_rate', label: 'Coupon 抽佣率', step: 0.01, isPercent: true },
      { name: 'offsite_commission_rate', label: '站外佣金率（仅 US）', step: 0.01, isPercent: true },
      { name: 'lightning_commission_rate', label: '秒杀抽佣率', step: 0.01, isPercent: true },
      { name: 'lightning_fixed_fee', label: '秒杀每日固定费用（当地币）', step: 0.01, isPercent: false },
      { name: 'lightning_fee_cap', label: '秒杀变动费用上限（当地币）', step: 0.01, isPercent: false },
    ],
  },
  {
    title: '退款占比',
    fields: [
      { name: 'refund_rate_new', label: '全新品退款占比', step: 0.01, isPercent: true },
      { name: 'refund_rate_used', label: '检测机退款占比', step: 0.01, isPercent: true },
      { name: 'refund_rate_review', label: '测评退款占比', step: 0.01, isPercent: true },
    ],
  },
];

const PRODUCT_CONFIG_INITIAL_VALUES = {
  exchange_rate: 7.2,
  commission_rate: 15,
  tax_rate: 0,
  storage_rate: 0,
  fba_fee: 0,
  freight_per_unit_rmb: 0,
  cost_rmb: 0,
  detection_machine_cost_rmb: 0,
  refund_rate_new: 0,
  refund_rate_used: 0,
  refund_rate_review: 0,
  inbound_fee: 0,
  coupon_commission_rate: 0,
  lightning_commission_rate: 0,
  lightning_fixed_fee: 0,
  lightning_fee_cap: 0,
  offsite_commission_rate: 0,
};

const EXCEL_COLORS = {
  pink: '#fce4d6',
  cyan: '#ddebf7',
  yellow: '#fff2cc',
  green: '#e2f0d9',
  blue: '#d9eaf7',
};

const EXCEL_HEADER_TEXT = 'rgba(0,0,0,0.88)';
const EXCEL_HEADER_FILLS = {
  config: '#DFEBF6',
  input: '#EB6793',
  formula: '#7DDED6',
  warning: '#FCC102',
  profit: '#ACD78D',
};
const MULTILINE_HEADER_FIELDS = new Set([
  'plan_date',
  'expected_discount_price',
  'lightning_fee_per_order',
  'total_daily_orders',
  'total_orders',
  'stage_revenue',
  'net_sales',
]);

const TABLE_SECTION_COLORS = {
  plan: { label: '计划', header: '#d9eaf7', cell: '#ffffff', border: '#5b9bd5', text: '#1f4e78' },
  price: { label: '价格', header: '#fce4d6', cell: '#ffffff', border: '#ed7d31', text: '#7f3f00' },
  volume: { label: '销量', header: '#e2f0d9', cell: '#ffffff', border: '#70ad47', text: '#375623' },
  cost: { label: '成本', header: '#e4dfec', cell: '#ffffff', border: '#8064a2', text: '#3f3151' },
  profit: { label: '利润', header: '#c6e0b4', cell: '#ffffff', border: '#548235', text: '#274e13' },
  ads: { label: '广告', header: '#fff2cc', cell: '#ffffff', border: '#bf9000', text: '#7f6000' },
  action: { label: '操作', header: '#d9e1f2', cell: '#ffffff', border: '#4472c4', text: '#1f4e78' },
};

const HEADER_FILL_BY_FIELD = {
  model: EXCEL_HEADER_FILLS.config,
  product_stage: EXCEL_HEADER_FILLS.input,
  overall_strategy: EXCEL_HEADER_FILLS.input,
  seller_inventory_note: EXCEL_HEADER_FILLS.input,
  inventory: EXCEL_HEADER_FILLS.input,
  listing_page: EXCEL_HEADER_FILLS.input,
  review_count: EXCEL_HEADER_FILLS.input,
  ads_goal_adjustment: EXCEL_HEADER_FILLS.input,
  plan_date: EXCEL_HEADER_FILLS.formula,
  weekday: EXCEL_HEADER_FILLS.formula,
  period: EXCEL_HEADER_FILLS.input,
  trial_note: EXCEL_HEADER_FILLS.input,
  period_target: EXCEL_HEADER_FILLS.input,
  list_price: EXCEL_HEADER_FILLS.input,
  price_with_tax: EXCEL_HEADER_FILLS.input,
  lp_off_rate: EXCEL_HEADER_FILLS.formula,
  coupon_amount: EXCEL_HEADER_FILLS.input,
  code_amount: EXCEL_HEADER_FILLS.input,
  coupon_fee_per_order: EXCEL_HEADER_FILLS.input,
  coupon_order_ratio: EXCEL_HEADER_FILLS.input,
  expected_discount_price: EXCEL_HEADER_FILLS.formula,
  coupon_rate: EXCEL_HEADER_FILLS.formula,
  lightning_price: EXCEL_HEADER_FILLS.input,
  lightning_off_rate: EXCEL_HEADER_FILLS.formula,
  tax_amount: EXCEL_HEADER_FILLS.formula,
  net_price: EXCEL_HEADER_FILLS.formula,
  review_discount_price: EXCEL_HEADER_FILLS.input,
  review_net_price: EXCEL_HEADER_FILLS.formula,
  review_return_amount: EXCEL_HEADER_FILLS.formula,
  review_cashback_amount: EXCEL_HEADER_FILLS.formula,
  review_product_cost: EXCEL_HEADER_FILLS.formula,
  stage_days: EXCEL_HEADER_FILLS.input,
  lightning_days: EXCEL_HEADER_FILLS.input,
  lightning_daily_orders: EXCEL_HEADER_FILLS.input,
  non_lightning_daily_orders: EXCEL_HEADER_FILLS.input,
  lightning_fee_per_order: EXCEL_HEADER_FILLS.formula,
  total_daily_orders: EXCEL_HEADER_FILLS.formula,
  total_orders: EXCEL_HEADER_FILLS.formula,
  daily_review_orders: EXCEL_HEADER_FILLS.input,
  daily_offsite_orders: EXCEL_HEADER_FILLS.input,
  daily_ads_orders: EXCEL_HEADER_FILLS.formula,
  daily_organic_orders: EXCEL_HEADER_FILLS.warning,
  total_review_orders: EXCEL_HEADER_FILLS.formula,
  review_order_ratio: EXCEL_HEADER_FILLS.formula,
  stage_revenue: EXCEL_HEADER_FILLS.formula,
  cost_ratio: EXCEL_HEADER_FILLS.formula,
  logistics_ratio: EXCEL_HEADER_FILLS.formula,
  fba_ratio: EXCEL_HEADER_FILLS.formula,
  coupon_fee_rate: EXCEL_HEADER_FILLS.formula,
  lightning_fee_rate: EXCEL_HEADER_FILLS.formula,
  ads_rate: EXCEL_HEADER_FILLS.formula,
  review_rate: EXCEL_HEADER_FILLS.formula,
  other_rate: EXCEL_HEADER_FILLS.input,
  gross_margin: EXCEL_HEADER_FILLS.profit,
  net_sales: EXCEL_HEADER_FILLS.profit,
  coupon_cost: EXCEL_HEADER_FILLS.profit,
  lightning_cost: EXCEL_HEADER_FILLS.profit,
  ads_cost: EXCEL_HEADER_FILLS.profit,
  gross_profit: EXCEL_HEADER_FILLS.profit,
  gross_profit_rmb: EXCEL_HEADER_FILLS.profit,
  cpc: EXCEL_HEADER_FILLS.input,
  cvr: EXCEL_HEADER_FILLS.input,
  theoretical_cpa: EXCEL_HEADER_FILLS.formula,
  daily_ads_budget: EXCEL_HEADER_FILLS.warning,
  daily_ads_orders_calc: EXCEL_HEADER_FILLS.formula,
  stage_ads_orders: EXCEL_HEADER_FILLS.formula,
  ads_order_ratio: EXCEL_HEADER_FILLS.input,
  required_daily_organic_orders: EXCEL_HEADER_FILLS.warning,
  tacos_calculated: EXCEL_HEADER_FILLS.formula,
  acos_reference: EXCEL_HEADER_FILLS.formula,
  ads_sales_price: EXCEL_HEADER_FILLS.formula,
  cumulative_profit_rmb: EXCEL_HEADER_FILLS.warning,
};

const HEADER_TEXT_BY_FIELD = {
  total_review_orders: '#C10002',
};

const HEADER_TITLE_OVERRIDES = {
  overall_strategy: '整体策略\n价格策略 / 手段',
  seller_inventory_note: '售卖账号\n库存备注',
  ads_goal_adjustment: '广告目标\n调整方向',
  plan_date: '具体日期\n周起始日期',
  coupon_fee_per_order: '单笔 coupon 费用\n(当地币)',
  coupon_order_ratio: '产生 coupon 费用的\n订单比例',
  expected_discount_price: '预计折后价-含税\n(当地币)\n对标市场竞对是否有优势',
  coupon_rate: 'coupon 力度\n看评价是否为 VP',
  lightning_price: '秒杀价格\n(当地币)',
  lightning_off_rate: '秒杀显示\nOFF 力度',
  net_price: '成交售价\n(不含税)',
  review_net_price: '测评税后\n成交价',
  review_return_amount: '单个测评\n返款金额',
  review_cashback_amount: '单个测评\n回款金额',
  review_product_cost: '单个测评\n产品成本',
  stage_days: '本阶段\n销售总天数',
  lightning_daily_orders: '秒杀日均\n单量',
  non_lightning_daily_orders: '非秒杀日均\n单量',
  lightning_fee_per_order: '秒杀平均每单费用\n(当地币)',
  total_daily_orders: '总日均单量\n含测评 / 站外单',
  total_orders: '预计总销量\n含测评 / 站外单',
  daily_review_orders: '日均测评\n数量',
  daily_offsite_orders: '日均站外\n单量',
  daily_ads_orders: '日均广告\n单量',
  daily_organic_orders: '日均纯自然\n单量',
  total_review_orders: '总测评\n数量',
  review_order_ratio: '测评单量\n占比',
  stage_revenue: '月成交额\n算费率分母',
  logistics_ratio: '月物流\n占比',
  fba_ratio: '配送费\n月占比',
  coupon_fee_rate: 'coupon\n费率',
  lightning_fee_rate: '秒杀\n费率',
  ads_rate: '广告费占比\n等于广告费率测算\nTACOS',
  review_rate: '测评占比\n等于测评费率测算',
  other_rate: '其他费用比例\n礼品卡 / 明信片 / 配置费',
  gross_profit: '阶段毛利\n(当地币)',
  gross_profit_rmb: '阶段毛利\nRMB',
  net_sales: '阶段净销售收入\n作为利润率分母\n(当地币)',
  coupon_cost: '阶段 coupon 费用\n(当地币)',
  lightning_cost: '阶段秒杀费用\n(当地币)',
  ads_cost: '阶段广告费\n(当地币)',
  cpc: 'CPC\n手动填',
  cvr: 'CVR\n手动填',
  theoretical_cpa: '理论 CPA\nCPA 底线',
  daily_ads_budget: '单日广告\n额度',
  daily_ads_orders_calc: '单日广告\n订单',
  stage_ads_orders: '阶段广告\n总订单',
  ads_order_ratio: '广告订单\n占比',
  required_daily_organic_orders: '对应需要的\n日均纯自然单',
  tacos_calculated: '广告费率 (TACOS)\n受 CPC / CVR / 广告订单占比影响',
  acos_reference: '即时 ACOS 参考\n广告花费 / 广告销售额',
  ads_sales_price: '广告销售\n价格',
  cumulative_profit_rmb: '累计盈亏\n平衡',
};

const COLUMN_SECTION_FIELDS = {
  plan: [
    'model', 'product_stage', 'overall_strategy', 'seller_inventory_note', 'inventory',
    'listing_page', 'review_count', 'ads_goal_adjustment', 'plan_date', 'weekday',
    'period', 'trial_note', 'period_target',
  ],
  price: [
    'list_price', 'price_with_tax', 'lp_off_rate', 'coupon_amount', 'code_amount',
    'coupon_fee_per_order', 'coupon_order_ratio', 'expected_discount_price',
    'coupon_rate', 'lightning_price', 'lightning_off_rate', 'tax_amount',
    'net_price', 'review_discount_price', 'review_net_price', 'review_return_amount',
    'review_cashback_amount', 'review_product_cost',
  ],
  volume: [
    'stage_days', 'lightning_days', 'lightning_daily_orders',
    'non_lightning_daily_orders', 'lightning_fee_per_order', 'total_daily_orders',
    'total_orders', 'daily_review_orders', 'daily_offsite_orders', 'daily_ads_orders',
    'daily_organic_orders', 'total_review_orders', 'review_order_ratio', 'stage_revenue',
  ],
  cost: [
    'cost_ratio', 'logistics_ratio', 'fba_ratio', 'coupon_fee_rate',
    'lightning_fee_rate', 'review_rate', 'other_rate', 'net_sales', 'coupon_cost',
    'lightning_cost',
  ],
  profit: ['gross_margin', 'gross_profit', 'gross_profit_rmb', 'cumulative_profit_rmb'],
  ads: [
    'ads_rate', 'ads_cost', 'cpc', 'cvr', 'theoretical_cpa', 'daily_ads_budget',
    'daily_ads_orders_calc', 'stage_ads_orders', 'ads_order_ratio',
    'required_daily_organic_orders', 'tacos_calculated', 'acos_reference', 'ads_sales_price',
  ],
};

const LEFT_FIXED_FIELDS = new Set(['model', 'product_stage', 'overall_strategy']);

const EMPHASIS_FIELDS = new Set([
  'product_stage',
  'plan_date',
  'price_with_tax',
  'expected_discount_price',
  'total_orders',
  'stage_revenue',
  'gross_margin',
  'gross_profit_rmb',
  'cumulative_profit_rmb',
]);

const COLUMN_WIDTH_OVERRIDES = {
  model: 118,
  product_stage: 108,
  overall_strategy: 216,
  seller_inventory_note: 204,
  inventory: 84,
  listing_page: 112,
  review_count: 84,
  ads_goal_adjustment: 220,
  plan_date: 170,
  weekday: 74,
  period: 132,
  trial_note: 172,
  period_target: 172,
  list_price: 94,
  price_with_tax: 112,
  lp_off_rate: 126,
  coupon_amount: 112,
  code_amount: 104,
  coupon_fee_per_order: 148,
  coupon_order_ratio: 190,
  expected_discount_price: 270,
  coupon_rate: 220,
  lightning_price: 132,
  lightning_off_rate: 132,
  net_price: 136,
  review_discount_price: 122,
  review_net_price: 136,
  review_return_amount: 156,
  review_cashback_amount: 156,
  review_product_cost: 156,
  stage_days: 142,
  lightning_daily_orders: 124,
  non_lightning_daily_orders: 142,
  lightning_fee_per_order: 178,
  total_daily_orders: 170,
  total_orders: 170,
  daily_review_orders: 124,
  daily_offsite_orders: 124,
  daily_ads_orders: 124,
  daily_organic_orders: 136,
  total_review_orders: 116,
  review_order_ratio: 124,
  stage_revenue: 166,
  logistics_ratio: 116,
  coupon_fee_rate: 110,
  lightning_fee_rate: 110,
  ads_rate: 244,
  review_rate: 226,
  other_rate: 252,
  net_sales: 190,
  coupon_cost: 152,
  lightning_cost: 148,
  ads_cost: 136,
  gross_profit: 128,
  gross_profit_rmb: 124,
  theoretical_cpa: 146,
  daily_ads_budget: 124,
  daily_ads_orders_calc: 124,
  stage_ads_orders: 132,
  ads_order_ratio: 124,
  tacos_calculated: 318,
  acos_reference: 278,
  ads_sales_price: 122,
  cumulative_profit_rmb: 132,
  required_daily_organic_orders: 190,
};

const STAGE_TONES = {
  推新期: { color: '#7f3f00', bg: '#fce4d6', border: '#ed7d31' },
  上升期: { color: '#1f4e78', bg: '#ddebf7', border: '#5b9bd5' },
  稳定期: { color: '#375623', bg: '#e2f0d9', border: '#70ad47' },
};

const DATE_PICKER_ZH_CN = {
  lang: {
    locale: 'zh_CN',
    placeholder: '选择日期',
    rangePlaceholder: ['开始日期', '结束日期'],
    today: '今天',
    now: '此刻',
    backToToday: '返回今天',
    ok: '确定',
    clear: '清除',
    month: '月',
    year: '年',
    timeSelect: '选择时间',
    dateSelect: '选择日期',
    monthSelect: '选择月份',
    yearSelect: '选择年份',
    decadeSelect: '选择年代',
    previousMonth: '上个月',
    nextMonth: '下个月',
    previousYear: '上一年',
    nextYear: '下一年',
    previousDecade: '上一年代',
    nextDecade: '下一年代',
    previousCentury: '上一世纪',
    nextCentury: '下一世纪',
    shortWeekDays: ['日', '一', '二', '三', '四', '五', '六'],
    shortMonths: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    yearFormat: 'YYYY年',
    monthFormat: 'M月',
    dateFormat: 'YYYY年M月D日',
    dateTimeFormat: 'YYYY年M月D日 HH:mm:ss',
    monthBeforeYear: false,
  },
  timePickerLocale: {
    placeholder: '选择时间',
  },
};

const TEMPLATE_DEFS = {
  lp_launch_daily: {
    key: 'lp_launch_daily',
    label: '正式下LP日期',
    shortLabel: '正式下LP',
    dateLabel: '正式下LP日期',
    defaultLaunchDate: '',
    sourceStartRow: 6,
  },
};

const SAVE_FIELDS = [
  'plan_key', 'asin_country', 'template_type', 'template_date_label', 'launch_date',
  'row_no', 'source_excel_row', 'date_offset', 'model', 'product_stage',
  'overall_strategy', 'seller_inventory_note', 'inventory', 'listing_page',
  'review_count', 'ads_goal_adjustment', 'plan_date', 'weekday', 'period',
  'trial_note', 'period_target', 'machine_type', 'shop_type', 'cost_rmb',
  'list_price', 'price_with_tax', 'lp_off_rate', 'coupon_amount', 'code_amount',
  'coupon_fee_per_order', 'coupon_order_ratio', 'expected_discount_price',
  'coupon_rate', 'lightning_price', 'lightning_off_rate', 'tax_rate', 'tax_amount',
  'net_price', 'review_discount_price', 'review_net_price', 'review_return_amount',
  'review_cashback_amount', 'review_product_cost', 'review_extra_fee',
  'review_cost_rmb', 'review_use_coupon', 'stage_days', 'lightning_days',
  'lightning_daily_orders', 'non_lightning_daily_orders', 'lightning_fee_per_order',
  'total_daily_orders', 'total_orders', 'daily_review_orders', 'daily_offsite_orders',
  'daily_ads_orders', 'daily_organic_orders', 'total_review_orders',
  'review_order_ratio', 'exchange_rate', 'stage_revenue', 'refund_rate',
  'cost_ratio', 'freight_per_unit_rmb', 'logistics_ratio', 'commission_rate',
  'fba_fee', 'fba_ratio', 'inbound_fee', 'storage_rate', 'offsite_commission_rate',
  'coupon_fee_rate', 'lightning_fee_rate', 'ads_rate', 'review_rate', 'other_rate',
  'gross_margin', 'net_sales', 'refund_amount', 'purchase_cost', 'logistics_cost',
  'commission_amount', 'fba_amount', 'storage_amount', 'offsite_amount',
  'other_amount', 'review_return_cost', 'coupon_cost', 'lightning_cost',
  'ads_cost', 'gross_profit', 'gross_profit_rmb', 'cpc', 'cvr', 'theoretical_cpa',
  'daily_ads_budget', 'daily_ads_orders_calc', 'stage_ads_orders', 'ads_order_ratio',
  'required_daily_organic_orders', 'tacos_calculated', 'acos_reference',
  'ads_sales_price', 'cumulative_profit_rmb',
];

const ACTIVE_TEMPLATE_KEY = 'lp_launch_daily';

const EXCEL_TABLE_COLUMNS = [
  { dataIndex: 'model', title: '型号', width: 118, edit: 'text', fixed: 'left' },
  {
    dataIndex: 'product_stage',
    title: '产品阶段',
    width: 92,
    edit: 'select',
    fixed: 'left',
    options: [
      { label: '推新期', value: '推新期' },
      { label: '上升期', value: '上升期' },
      { label: '稳定期', value: '稳定期' },
    ],
  },
  { dataIndex: 'overall_strategy', title: '整体策略(价格策略/手段)', width: 190, edit: 'text', fixed: 'left' },
  { dataIndex: 'seller_inventory_note', title: '售卖账号+库存备注', width: 180, edit: 'text' },
  { dataIndex: 'inventory', title: '库存', width: 76, edit: 'number' },
  { dataIndex: 'listing_page', title: '链接页面', width: 100, edit: 'text' },
  { dataIndex: 'review_count', title: '评论', width: 76, edit: 'number' },
  { dataIndex: 'ads_goal_adjustment', title: '广告目标及调整方向', width: 190, edit: 'text' },
  { dataIndex: 'plan_date', title: '具体日期\n/周起始日期', width: 160 },
  { dataIndex: 'weekday', title: '周几', width: 64 },
  { dataIndex: 'period', title: '周期', width: 118, edit: 'text' },
  { dataIndex: 'trial_note', title: '试算备注', width: 150, edit: 'text' },
  { dataIndex: 'period_target', title: '周期小类目标', width: 150, edit: 'text' },
  { dataIndex: 'list_price', title: '划线价', width: 86, edit: 'number' },
  { dataIndex: 'price_with_tax', title: '定价(含税)', width: 96, edit: 'number' },
  { dataIndex: 'lp_off_rate', title: '日常LP off力度', width: 112, type: 'percent' },
  { dataIndex: 'coupon_amount', title: 'coupon金额', width: 96, edit: 'number' },
  { dataIndex: 'code_amount', title: 'code金额', width: 88, edit: 'number' },
  { dataIndex: 'coupon_fee_per_order', title: '单笔coupon费用\n(当地币)', width: 126, type: 'number' },
  { dataIndex: 'coupon_order_ratio', title: '产生coupon费用的订单比例', width: 158, edit: 'percentInput', type: 'percent' },
  { dataIndex: 'expected_discount_price', title: '预计折后价-含税((当地币))\n--(对标市场竞对是否有优势)', width: 210, type: 'number' },
  { dataIndex: 'coupon_rate', title: 'coupon力度-看评价是否为VP', width: 160, type: 'percent' },
  { dataIndex: 'lightning_price', title: '秒杀价格(当地币)', width: 122, edit: 'number' },
  { dataIndex: 'lightning_off_rate', title: '秒杀显示off力度', width: 118, type: 'percent' },
  { dataIndex: 'tax_amount', title: '税费', width: 76, type: 'number' },
  { dataIndex: 'net_price', title: '成交售价(不含税)', width: 122, type: 'number' },
  { dataIndex: 'review_discount_price', title: '测评折后价', width: 106, edit: 'number' },
  { dataIndex: 'review_net_price', title: '测评税后成交价', width: 124, type: 'number' },
  { dataIndex: 'review_return_amount', title: '单个测评返款金额', width: 132, type: 'number' },
  { dataIndex: 'review_cashback_amount', title: '单个测评回款金额', width: 132, type: 'number' },
  { dataIndex: 'review_product_cost', title: '单个测评产品成本', width: 132, type: 'number' },
  { dataIndex: 'stage_days', title: '本阶段销售总天数', width: 126, edit: 'number' },
  { dataIndex: 'lightning_days', title: '秒杀天数', width: 86, edit: 'number' },
  { dataIndex: 'lightning_daily_orders', title: '秒杀日均单量', width: 106, edit: 'number' },
  { dataIndex: 'non_lightning_daily_orders', title: '非秒杀日均单量', width: 126, edit: 'number' },
  { dataIndex: 'lightning_fee_per_order', title: '秒杀平均每单的费用\n(当地币)', width: 150, type: 'number' },
  { dataIndex: 'total_daily_orders', title: '总日均单量\n-(含测评站外单)', width: 136, type: 'number' },
  { dataIndex: 'total_orders', title: '预计总销量\n-(含测评站外单)', width: 136, type: 'number' },
  { dataIndex: 'daily_review_orders', title: '日均测评数量', width: 106, edit: 'number' },
  { dataIndex: 'daily_offsite_orders', title: '日均站外单量', width: 106, edit: 'number' },
  { dataIndex: 'daily_ads_orders', title: '日均广告单量', width: 106, type: 'number' },
  { dataIndex: 'daily_organic_orders', title: '日均纯自然单量', width: 122, type: 'number' },
  { dataIndex: 'total_review_orders', title: '总测评数量', width: 100, type: 'number' },
  { dataIndex: 'review_order_ratio', title: '测评单量占比', width: 110, type: 'percent' },
  { dataIndex: 'stage_revenue', title: '月成交额\n()-算费率的分母', width: 140, type: 'number' },
  { dataIndex: 'cost_ratio', title: '成本占比', width: 92, type: 'percent' },
  { dataIndex: 'logistics_ratio', title: '月物流占比', width: 104, type: 'percent' },
  { dataIndex: 'fba_ratio', title: '配送费\n月占比', width: 98, type: 'percent' },
  { dataIndex: 'coupon_fee_rate', title: 'coupon费率', width: 98, type: 'percent' },
  { dataIndex: 'lightning_fee_rate', title: '秒杀费率', width: 92, type: 'percent' },
  { dataIndex: 'ads_rate', title: '广告费占比(等于后面的广告费率测算)TACOS', width: 280, type: 'percent' },
  { dataIndex: 'review_rate', title: '测评占比(等于后面的测评费率测算)', width: 230, type: 'percent' },
  { dataIndex: 'other_rate', title: '其他费用比例[礼品卡明信片配置费那些]', width: 250, edit: 'percentInput', type: 'percent' },
  { dataIndex: 'gross_margin', title: '毛利率', width: 84, type: 'percent', highlight: true },
  { dataIndex: 'net_sales', title: '阶段净销售收入\n--作为利润率分母\n(当地币)', width: 160, type: 'number' },
  { dataIndex: 'coupon_cost', title: '阶段coupon费用\n(当地币)', width: 136, type: 'number' },
  { dataIndex: 'lightning_cost', title: '阶段秒杀费用\n(当地币)', width: 132, type: 'number' },
  { dataIndex: 'ads_cost', title: '阶段广告费\n(当地币)', width: 120, type: 'number' },
  { dataIndex: 'gross_profit', title: '阶段毛利\n(当地币)', width: 118, type: 'number', highlight: true },
  { dataIndex: 'gross_profit_rmb', title: '阶段毛利\nRMB', width: 112, type: 'number', highlight: true },
  { dataIndex: 'cpc', title: 'CPC\n--手动填', width: 86, edit: 'number' },
  { dataIndex: 'cvr', title: 'CVR\n--手动填', width: 86, edit: 'percentInput', type: 'percent' },
  { dataIndex: 'theoretical_cpa', title: '理论CPA-CPA的底线', width: 136, type: 'number' },
  { dataIndex: 'daily_ads_budget', title: '单日广告额度', width: 112, type: 'number' },
  { dataIndex: 'daily_ads_orders_calc', title: '单日广告订单', width: 112, type: 'number' },
  { dataIndex: 'stage_ads_orders', title: '阶段广告总订单\n ', width: 122, type: 'number' },
  { dataIndex: 'ads_order_ratio', title: '广告订单占比', width: 108, edit: 'percentInput', type: 'percent' },
  { dataIndex: 'required_daily_organic_orders', title: '对应需要的日均纯自然单', width: 158, type: 'number' },
  { dataIndex: 'tacos_calculated', title: '广告费率(TACOS)--受cpc、cvr、广告订单占比影响', width: 300, type: 'percent' },
  { dataIndex: 'acos_reference', title: '即时ACOS参考(广告花费/广告销售额)', width: 250, type: 'percent' },
  { dataIndex: 'ads_sales_price', title: '广告销售价格', width: 108, type: 'number' },
  { dataIndex: 'cumulative_profit_rmb', title: '累计盈亏平衡', width: 118, type: 'number', highlight: true },
];

const STAGE_OPTIONS = [
  { label: '推新期', value: '推新期' },
  { label: '上升期', value: '上升期' },
  { label: '稳定期', value: '稳定期' },
];

const WORKBENCH_FIELD_SECTIONS = [
  {
    title: '基础计划',
    accent: '#1f4e78',
    fields: [
      { field: 'product_stage', label: '产品阶段', kind: 'select', options: STAGE_OPTIONS },
      { field: 'period', label: '周期' },
      { field: 'trial_note', label: '试算备注' },
      { field: 'period_target', label: '周期小类目标' },
      { field: 'overall_strategy', label: '整体策略', wide: true },
      { field: 'seller_inventory_note', label: '账号库存备注', wide: true },
      { field: 'inventory', label: '库存', kind: 'number' },
      { field: 'listing_page', label: '链接页面' },
      { field: 'review_count', label: '评论数', kind: 'number' },
      { field: 'ads_goal_adjustment', label: '广告目标及调整方向', wide: true },
    ],
  },
  {
    title: '价格促销',
    accent: '#c00000',
    fields: [
      { field: 'list_price', label: '划线价', kind: 'number' },
      { field: 'price_with_tax', label: '定价含税', kind: 'number', primary: true },
      { field: 'coupon_amount', label: 'Coupon 金额', kind: 'number' },
      { field: 'code_amount', label: 'Code 金额', kind: 'number' },
      { field: 'coupon_order_ratio', label: 'Coupon 订单比例', kind: 'percent' },
      { field: 'lightning_price', label: '秒杀价格', kind: 'number' },
      { field: 'review_discount_price', label: '测评折后价', kind: 'number' },
    ],
  },
  {
    title: '单量结构',
    accent: '#548235',
    fields: [
      { field: 'stage_days', label: '阶段天数', kind: 'number' },
      { field: 'lightning_days', label: '秒杀天数', kind: 'number' },
      { field: 'lightning_daily_orders', label: '秒杀日均单量', kind: 'number' },
      { field: 'non_lightning_daily_orders', label: '非秒杀日均单量', kind: 'number' },
      { field: 'daily_review_orders', label: '日均测评数量', kind: 'number' },
      { field: 'daily_offsite_orders', label: '日均站外单量', kind: 'number' },
    ],
  },
  {
    title: '广告测算',
    accent: '#bf9000',
    fields: [
      { field: 'cpc', label: 'CPC', kind: 'number', primary: true },
      { field: 'cvr', label: 'CVR', kind: 'percent', primary: true },
      { field: 'ads_order_ratio', label: '广告订单占比', kind: 'percent' },
      { field: 'other_rate', label: '其他费用比例', kind: 'percent' },
    ],
  },
];

const QUICK_WORKBENCH_FIELDS = [
  { field: 'product_stage', label: '产品阶段', kind: 'select', options: STAGE_OPTIONS },
  { field: 'period', label: '周期' },
  { field: 'price_with_tax', label: '定价含税', kind: 'number', primary: true },
  { field: 'coupon_amount', label: 'Coupon 金额', kind: 'number' },
  { field: 'stage_days', label: '阶段天数', kind: 'number' },
  { field: 'non_lightning_daily_orders', label: '非秒杀日均单量', kind: 'number' },
  { field: 'daily_review_orders', label: '日均测评数量', kind: 'number' },
  { field: 'cpc', label: 'CPC', kind: 'number', primary: true },
  { field: 'cvr', label: 'CVR', kind: 'percent', primary: true },
  { field: 'ads_order_ratio', label: '广告订单占比', kind: 'percent' },
  { field: 'overall_strategy', label: '整体策略', wide: true },
];

const QUICK_WORKBENCH_FIELD_SET = new Set(QUICK_WORKBENCH_FIELDS.map((item) => item.field));

const WORKBENCH_RESULT_SECTIONS = [
  {
    title: '利润',
    items: [
      { field: 'gross_margin', label: '毛利率', type: 'percent', tone: 'profit' },
      { field: 'gross_profit_rmb', label: '阶段毛利 RMB', type: 'money', tone: 'profit' },
      { field: 'cumulative_profit_rmb', label: '累计盈亏', type: 'money', tone: 'profit' },
      { field: 'net_sales', label: '净销售收入', type: 'money' },
    ],
  },
  {
    title: '销量',
    items: [
      { field: 'total_daily_orders', label: '总日均单量', type: 'number' },
      { field: 'total_orders', label: '预计总销量', type: 'number' },
      { field: 'daily_organic_orders', label: '日均自然单', type: 'number', tone: 'capacity' },
      { field: 'review_order_ratio', label: '测评占比', type: 'percent' },
    ],
  },
  {
    title: '广告',
    items: [
      { field: 'tacos_calculated', label: 'TACOS', type: 'percent', tone: 'ads' },
      { field: 'daily_ads_budget', label: '单日广告额度', type: 'money' },
      { field: 'stage_ads_orders', label: '阶段广告订单', type: 'number' },
      { field: 'acos_reference', label: '即时 ACOS', type: 'percent' },
    ],
  },
];

const PERCENT_DECIMAL_SAVE_FIELDS = new Set([
  ...EXCEL_TABLE_COLUMNS.filter((item) => item.type === 'percent').map((item) => item.dataIndex),
  ...PRODUCT_CONFIG_PERCENT_FIELDS,
  'refund_rate',
]);
const NON_NUMERIC_SAVE_FIELDS = new Set([
  'plan_key', 'asin_country', 'template_type', 'template_date_label',
  'launch_date', 'model', 'product_stage', 'overall_strategy',
  'seller_inventory_note', 'listing_page', 'ads_goal_adjustment',
  'plan_date', 'weekday', 'period', 'trial_note', 'period_target',
  'machine_type', 'shop_type',
]);
const NUMERIC_SAVE_FIELDS = new Set(
  SAVE_FIELDS.filter((field) => !NON_NUMERIC_SAVE_FIELDS.has(field) && !PERCENT_DECIMAL_SAVE_FIELDS.has(field)),
);

function apiRequest(options) {
  const requestOptions = {
    method: 'GET',
    ...options,
  };
  if (ctx.request) return ctx.request(requestOptions);
  if (ctx.api && ctx.api.request) return ctx.api.request(requestOptions);
  throw new Error('当前上下文缺少 ctx.request');
}

function productConfigRequest(options) {
  const requestOptions = {
    method: 'get',
    ...options,
  };
  if (ctx.api && ctx.api.request) return ctx.api.request(requestOptions);
  if (ctx.request) return ctx.request(requestOptions);
  throw new Error('当前上下文缺少 ctx.api.request');
}

const URL_PARAM_KEYS = ['model', 'country', 'asin', 'asin_country', 'sale_owner', 'status'];

function getParamValue(source, key) {
  if (!source) return '';
  try {
    if (typeof source.get === 'function') {
      const value = source.get(key);
      if (value != null && value !== '') return String(value);
    }
  } catch (_) {}
  const value = source[key];
  if (Array.isArray(value)) return value[0] == null ? '' : String(value[0]);
  return value == null ? '' : String(value);
}

function normalizeUrlParams(source) {
  const result = {};
  URL_PARAM_KEYS.forEach((key) => {
    const value = getParamValue(source, key);
    if (value) result[key] = value;
  });
  if (!result.sale_owner) {
    const saleOwner = getParamValue(source, 'saleOwner');
    if (saleOwner) result.sale_owner = saleOwner;
  }
  return result;
}

function mergeUrlParams(target, source) {
  const params = normalizeUrlParams(source);
  URL_PARAM_KEYS.forEach((key) => {
    if (params[key]) target[key] = params[key];
  });
  return target;
}

function parseSearchToParams(value) {
  const result = {};
  if (!value) return result;
  const text = String(value);
  const queries = [];
  const pushQuery = (query) => {
    if (!query) return;
    queries.push(query.replace(/^\?/, '').split('#')[0]);
  };
  const questionIndex = text.indexOf('?');
  if (questionIndex >= 0) {
    pushQuery(text.slice(questionIndex + 1));
  } else {
    pushQuery(text);
  }
  const hashIndex = text.indexOf('#');
  if (hashIndex >= 0) {
    const hashText = text.slice(hashIndex + 1);
    const hashQuestionIndex = hashText.indexOf('?');
    if (hashQuestionIndex >= 0) pushQuery(hashText.slice(hashQuestionIndex + 1));
  }
  queries.forEach((query) => {
    try {
      mergeUrlParams(result, new URLSearchParams(query));
    } catch (_) {}
  });
  return result;
}

function readLocationParams(loc) {
  const result = {};
  if (!loc) return result;
  mergeUrlParams(result, parseSearchToParams(loc.search));
  mergeUrlParams(result, parseSearchToParams(loc.hash));
  mergeUrlParams(result, parseSearchToParams(loc.href));
  return result;
}

function readUrlParamsSync() {
  const result = {};
  try { mergeUrlParams(result, ctx.urlSearchParams); } catch (_) {}
  try { if (typeof window !== 'undefined') mergeUrlParams(result, readLocationParams(window.location)); } catch (_) {}
  return result;
}

async function resolveUrlParams() {
  const result = {};
  try {
    if (ctx.getVar) {
      const p = await ctx.getVar('ctx.urlSearchParams');
      mergeUrlParams(result, p);
    }
  } catch (_) {}
  mergeUrlParams(result, readUrlParamsSync());
  return result;
}

function getParams(baseParams = INITIAL_URL_PARAMS) {
  const fallback = {};
  mergeUrlParams(fallback, baseParams || {});
  mergeUrlParams(fallback, readUrlParamsSync());
  return fallback;
}

function getAsinCountry(params) {
  return params?.asin && params?.country ? `${params.asin}_${params.country}` : (params?.asin_country || '');
}

function areUrlParamsSame(a, b) {
  return URL_PARAM_KEYS.every((key) => (a?.[key] || '') === (b?.[key] || ''));
}

const INITIAL_URL_PARAMS = await resolveUrlParams();

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function round(value, digits = 2) {
  const n = toNum(value, 0);
  const factor = Math.pow(10, digits);
  return Math.round(n * factor) / factor;
}

function fixedNumber(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return value;
  return Number(round(value, digits).toFixed(digits));
}

function formatFixed(value, digits = 2) {
  if (!Number.isFinite(Number(value))) return '-';
  return toNum(value, 0).toLocaleString('zh-CN', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

function toPercentInputValue(value) {
  if (isBlank(value)) return undefined;
  return fixedNumber(toNum(value, 0) * 100, 2);
}

function fromPercentInputValue(value) {
  if (isBlank(value)) return undefined;
  return fixedNumber(toNum(value, 0) / 100, 4);
}

function normalizeSaveValue(field, value) {
  if (isBlank(value)) return value;
  if (PERCENT_DECIMAL_SAVE_FIELDS.has(field)) return fixedNumber(value, 4);
  if (NUMERIC_SAVE_FIELDS.has(field)) return fixedNumber(value, 2);
  return value;
}

const AUTO_FORMULA_STATE_FIELD = '__autoFormulaFields';
const AUTO_FORMULA_INPUT_FIELDS = new Set(['lightning_price', 'review_discount_price']);

function isBlank(value) {
  return value === undefined || value === null || value === '';
}

function numberEquals(a, b, digits = 6) {
  return round(a, digits) === round(b, digits);
}

function div(numerator, denominator, fallback = 0) {
  const d = toNum(denominator, 0);
  if (!d) return fallback;
  return toNum(numerator, 0) / d;
}

function normalizeDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  try {
    return formatDate(value);
  } catch (_) {
    return '';
  }
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function addDays(baseDate, offset) {
  const normalized = normalizeDate(baseDate);
  if (!normalized) return '';
  const parts = normalized.split('-').map(Number);
  if (parts.length < 3 || parts.some((p) => !Number.isFinite(p))) return normalized;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  date.setDate(date.getDate() + toNum(offset, 0));
  return formatDate(date);
}

function formulaPlanDate(row) {
  return addDays(row?.launch_date, row?.date_offset || 0);
}

function weekdayOf(dateText) {
  const normalized = normalizeDate(dateText);
  if (!normalized) return '';
  const parts = normalized.split('-').map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return `周${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`;
}

function toDayjs(dateText) {
  const normalized = normalizeDate(dateText);
  if (!normalized || !ctx.libs.dayjs) return null;
  return ctx.libs.dayjs(normalized);
}

function money(value) {
  return formatFixed(value, 2);
}

function percent(value) {
  return Number.isFinite(Number(value)) ? `${formatFixed(toNum(value) * 100, 2)}%` : '-';
}

function priceKey(value) {
  return Number.isFinite(Number(value)) ? String(round(toNum(value), 2)) : '';
}

function compactRecord(row) {
  const data = {};
  SAVE_FIELDS.forEach((field) => {
    if (row[field] !== undefined) data[field] = normalizeSaveValue(field, row[field]);
  });
  return data;
}

function createEmptyRow(templateKey, asinCountry, launchDate, rowNo, dateOffset = 0) {
  const def = TEMPLATE_DEFS[templateKey];
  const normalizedLaunchDate = normalizeDate(launchDate);
  const planDate = normalizedLaunchDate ? addDays(normalizedLaunchDate, dateOffset) : '';
  return {
    plan_key: asinCountry ? `${asinCountry}_${templateKey}` : '',
    asin_country: asinCountry || '',
    template_type: templateKey,
    template_date_label: def.dateLabel,
    launch_date: normalizedLaunchDate,
    row_no: rowNo,
    source_excel_row: null,
    date_offset: dateOffset,
    plan_date: planDate,
    weekday: weekdayOf(planDate),
    model: '',
    product_stage: '',
    period: '',
    trial_note: '',
    machine_type: undefined,
    shop_type: undefined,
  };
}

function calculateRows(rows, cfg, reviewPricingMap = {}) {
  let cumulative = 0;
  return rows.map((source, index) => {
    const row = { ...source };
    const autoFormulaFields = row[AUTO_FORMULA_STATE_FIELD] || {};
    const isAutoFormulaInput = (field, defaultValue) => {
      if (isBlank(row[field])) return true;
      if (autoFormulaFields[field] === true) return true;
      if (autoFormulaFields[field] === false) return false;
      return numberEquals(row[field], defaultValue);
    };
    const machineType = row.machine_type || 'new';
    const isWoot = row.shop_type === 'woot';
    const detectionCostRmb = toNum(cfg?.detection_machine_cost_rmb, toNum(cfg?.cost_rmb, 0));
    const costRmb = machineType === 'used'
      ? detectionCostRmb
      : toNum(cfg?.cost_rmb, 0);
    const exchangeRate = toNum(cfg?.exchange_rate, 1) || 1;
    const taxRate = toNum(cfg?.tax_rate, 0);
    const commissionRate = isWoot ? 0 : toNum(cfg?.commission_rate, 0);
    const fbaFee = isWoot ? 0 : toNum(cfg?.fba_fee, 0);
    const storageRate = isWoot ? 0 : toNum(cfg?.storage_rate, 0);
    const inboundFee = toNum(cfg?.inbound_fee, 0);
    const freightPerUnit = toNum(cfg?.freight_per_unit_rmb, 0);
    const stageRefundRate = machineType === 'used'
      ? toNum(cfg?.refund_rate_used, toNum(cfg?.refund_rate_new, 0))
      : toNum(cfg?.refund_rate_new, 0);
    const reviewRefundRate = toNum(cfg?.refund_rate_review, 0);
    const couponCommissionRate = toNum(cfg?.coupon_commission_rate, 0);
    const lightningCommissionRate = toNum(cfg?.lightning_commission_rate, 0);
    const lightningFixedFee = toNum(cfg?.lightning_fixed_fee, 0);
    const lightningFeeCap = toNum(cfg?.lightning_fee_cap, 0);
    const offsiteCommissionRate = !isBlank(cfg?.offsite_commission_rate)
      ? toNum(cfg?.offsite_commission_rate, 0)
      : toNum(row.offsite_commission_rate, 0);

    const listPrice = toNum(row.list_price, 0);
    const priceWithTax = toNum(row.price_with_tax, 0);
    const couponAmount = toNum(row.coupon_amount, 0);
    const codeAmount = toNum(row.code_amount, 0);
    const expectedDiscountPrice = round(priceWithTax - couponAmount - codeAmount, 2);
    const taxAmount = round(div(expectedDiscountPrice * taxRate, 1 + taxRate), 2);
    const netPrice = round(expectedDiscountPrice - taxAmount, 2);
    const lightningPriceIsAuto = isAutoFormulaInput('lightning_price', expectedDiscountPrice);
    const lightningPrice = lightningPriceIsAuto ? expectedDiscountPrice : toNum(row.lightning_price, 0);
    const reviewDiscountPriceIsAuto = isAutoFormulaInput('review_discount_price', listPrice);
    const reviewDiscountPrice = reviewDiscountPriceIsAuto ? listPrice : toNum(row.review_discount_price, 0);
    const reviewScenario = reviewPricingMap[priceKey(reviewDiscountPrice)];
    const reviewNetPrice = reviewScenario && reviewScenario.net_price != null
      ? toNum(reviewScenario.net_price, 0)
      : 0;
    const reviewExtraFee = row.review_extra_fee !== undefined && row.review_extra_fee !== null
      ? toNum(row.review_extra_fee, 30)
      : 30;
    const reviewCostRmb = row.review_cost_rmb !== undefined && row.review_cost_rmb !== null
      ? toNum(row.review_cost_rmb, detectionCostRmb)
      : detectionCostRmb;
    const reviewUseCoupon = toNum(row.review_use_coupon, 0);
    const reviewProductCost = reviewScenario && reviewScenario.monthly_cogs != null
      ? toNum(reviewScenario.monthly_cogs, 0)
      : 0;
    const reviewCouponFee = round(reviewNetPrice * reviewUseCoupon * couponCommissionRate, 6);
    const reviewRefund = round(reviewNetPrice * reviewRefundRate * 0.93, 6);
    const reviewFreight = round(freightPerUnit / exchangeRate, 6);
    const reviewCommission = round(reviewNetPrice * commissionRate, 6);
    const reviewFba = round(fbaFee, 6);
    const reviewStorage = round(reviewNetPrice * storageRate + inboundFee, 6);
    const reviewReturnAmount = reviewScenario && reviewScenario.review_return_amount != null
      ? toNum(reviewScenario.review_return_amount, 0)
      : 0;
    const reviewCashbackAmount = reviewScenario && reviewScenario.review_order_profit_local != null
      ? toNum(reviewScenario.review_order_profit_local, 0)
      : 0;

    const stageDays = Math.max(toNum(row.stage_days, 1), 1);
    const lightningDays = Math.max(toNum(row.lightning_days, 0), 0);
    const lightningDailyOrders = toNum(row.lightning_daily_orders, 0);
    const nonLightningDailyOrders = toNum(row.non_lightning_daily_orders, 0);
    const totalOrders = round(lightningDays * lightningDailyOrders + (stageDays - lightningDays) * nonLightningDailyOrders, 2);
    const totalDailyOrders = round(div(totalOrders, stageDays), 2);
    const dailyReviewOrders = toNum(row.daily_review_orders, 0);
    const totalReviewOrders = round(dailyReviewOrders * stageDays, 2);
    const dailyOffsiteOrders = toNum(row.daily_offsite_orders, 0);
    const adsOrderRatio = toNum(row.ads_order_ratio, 0);
    const stageAdsOrders = round(adsOrderRatio * totalOrders, 2);
    const dailyAdsOrdersCalc = round(div(stageAdsOrders, stageDays), 2);
    const dailyOrganicOrders = round(div(totalOrders - totalReviewOrders - dailyOffsiteOrders * stageDays - stageAdsOrders, stageDays), 2);

    const couponFeePerOrder = round(expectedDiscountPrice * couponCommissionRate, 6);
    const stageRevenue = round(netPrice * (totalOrders - totalReviewOrders) + totalReviewOrders * reviewNetPrice, 6);
    const refundAmount = round(netPrice * (totalOrders - totalReviewOrders) * 0.93 * stageRefundRate, 6);
    const netSales = round(stageRevenue - refundAmount, 6);
    const purchaseCost = round(((totalOrders - totalReviewOrders) * costRmb / exchangeRate) + (totalReviewOrders * reviewProductCost), 6);
    const logisticsCost = round(freightPerUnit * totalOrders / exchangeRate, 6);
    const commissionAmount = round(stageRevenue * commissionRate, 6);
    const fbaAmount = round(fbaFee * totalOrders, 6);
    const storageAmount = round(stageRevenue * storageRate + inboundFee * totalOrders, 6);
    const offsiteAmount = round(netPrice * offsiteCommissionRate * dailyOffsiteOrders * stageDays, 6);
    const otherRate = isBlank(row.other_rate) ? 0.01 : toNum(row.other_rate, 0);
    const otherAmount = round(netPrice * (totalOrders - totalReviewOrders) * otherRate, 6);
    const reviewReturnCost = round(reviewReturnAmount * totalReviewOrders, 6);
    const couponCost = round(couponFeePerOrder * toNum(row.coupon_order_ratio, 0) * Math.max(totalOrders - lightningDays * lightningDailyOrders, 0), 6);
    const lightningVariableFee = lightningDays * lightningDailyOrders * lightningPrice * lightningCommissionRate;
    const lightningCost = round((lightningFeeCap > 0 ? Math.min(lightningVariableFee, lightningFeeCap) : lightningVariableFee) + lightningFixedFee * lightningDays, 6);
    const lightningFeePerOrder = lightningDays && lightningDailyOrders
      ? round(div(lightningCost, lightningDays * lightningDailyOrders), 6)
      : 0;
    const cpc = toNum(row.cpc, 0);
    const cvr = toNum(row.cvr, 0);
    const theoreticalCpa = round(div(cpc, cvr), 6);
    const dailyAdsBudget = round(dailyAdsOrdersCalc * theoreticalCpa, 6);
    const adsCost = round(dailyAdsBudget * stageDays, 6);
    const grossProfit = round(
      netSales - purchaseCost - logisticsCost - commissionAmount - fbaAmount
      - storageAmount - offsiteAmount - otherAmount - reviewReturnCost
      - couponCost - lightningCost - adsCost,
      6,
    );
    const grossProfitRmb = round(grossProfit * exchangeRate, 6);
    cumulative = round(cumulative + grossProfitRmb, 6);
    const adsSalesPrice = round(priceWithTax - div(priceWithTax * taxRate, 1 + taxRate), 6);

    const planDate = formulaPlanDate(row);
    return {
      ...row,
      [AUTO_FORMULA_STATE_FIELD]: {
        ...autoFormulaFields,
        lightning_price: lightningPriceIsAuto,
        review_discount_price: reviewDiscountPriceIsAuto,
      },
      row_no: row.row_no || index + 1,
      plan_date: planDate,
      weekday: weekdayOf(planDate),
      cost_rmb: costRmb,
      exchange_rate: exchangeRate,
      tax_rate: taxRate,
      commission_rate: commissionRate,
      fba_fee: fbaFee,
      storage_rate: storageRate,
      inbound_fee: inboundFee,
      freight_per_unit_rmb: freightPerUnit,
      refund_rate: stageRefundRate,
      offsite_commission_rate: offsiteCommissionRate,
      expected_discount_price: expectedDiscountPrice,
      lp_off_rate: div(listPrice - priceWithTax, listPrice),
      coupon_fee_per_order: couponFeePerOrder,
      coupon_rate: div(couponAmount, priceWithTax),
      lightning_price: lightningPrice,
      lightning_off_rate: div(listPrice - lightningPrice, listPrice),
      tax_amount: taxAmount,
      net_price: netPrice,
      review_discount_price: reviewDiscountPrice,
      review_net_price: reviewNetPrice,
      review_return_amount: reviewReturnAmount,
      review_cashback_amount: reviewCashbackAmount,
      review_product_cost: reviewProductCost,
      review_extra_fee: reviewExtraFee,
      review_cost_rmb: reviewCostRmb,
      review_use_coupon: reviewUseCoupon,
      lightning_fee_per_order: lightningFeePerOrder,
      total_orders: totalOrders,
      total_daily_orders: totalDailyOrders,
      daily_review_orders: dailyReviewOrders,
      daily_ads_orders: dailyAdsOrdersCalc,
      daily_organic_orders: dailyOrganicOrders,
      total_review_orders: totalReviewOrders,
      review_order_ratio: div(totalReviewOrders, totalOrders),
      stage_revenue: stageRevenue,
      cost_ratio: div(purchaseCost, stageRevenue),
      logistics_ratio: div(logisticsCost, stageRevenue),
      fba_ratio: div(fbaAmount, stageRevenue),
      coupon_fee_rate: div(couponCost, netSales),
      lightning_fee_rate: div(lightningCost, netSales),
      ads_rate: div(adsCost, stageRevenue),
      review_rate: div(reviewReturnCost, stageRevenue),
      other_rate: otherRate,
      gross_margin: div(grossProfit, netSales),
      net_sales: netSales,
      refund_amount: refundAmount,
      purchase_cost: purchaseCost,
      logistics_cost: logisticsCost,
      commission_amount: commissionAmount,
      fba_amount: fbaAmount,
      storage_amount: storageAmount,
      offsite_amount: offsiteAmount,
      other_amount: otherAmount,
      review_return_cost: reviewReturnCost,
      coupon_cost: couponCost,
      lightning_cost: lightningCost,
      ads_cost: adsCost,
      gross_profit: grossProfit,
      gross_profit_rmb: grossProfitRmb,
      theoretical_cpa: theoreticalCpa,
      daily_ads_budget: dailyAdsBudget,
      daily_ads_orders_calc: dailyAdsOrdersCalc,
      stage_ads_orders: stageAdsOrders,
      required_daily_organic_orders: dailyOrganicOrders,
      tacos_calculated: cvr ? div(stageAdsOrders / cvr * cpc, stageRevenue) : 0,
      acos_reference: div(dailyAdsBudget, dailyAdsOrdersCalc * adsSalesPrice),
      ads_sales_price: adsSalesPrice,
      cumulative_profit_rmb: cumulative,
    };
  });
}

function getColumnSection(dataIndex) {
  const found = Object.keys(COLUMN_SECTION_FIELDS).find((key) => COLUMN_SECTION_FIELDS[key].includes(dataIndex));
  return found || 'volume';
}

function getColumnTheme(item) {
  const sectionTheme = TABLE_SECTION_COLORS[getColumnSection(item.dataIndex)] || TABLE_SECTION_COLORS.volume;
  return {
    ...sectionTheme,
    header: HEADER_FILL_BY_FIELD[item.dataIndex] || sectionTheme.header,
    text: HEADER_TEXT_BY_FIELD[item.dataIndex] || EXCEL_HEADER_TEXT,
  };
}

function getColumnWidth(item, isNarrow) {
  const baseWidth = COLUMN_WIDTH_OVERRIDES[item.dataIndex] || item.width || 112;
  if (!isNarrow) return baseWidth;
  if (item.fixed) return Math.max(baseWidth, 104);
  if (item.edit === 'text') return Math.max(baseWidth, 164);
  if (item.type === 'number' || item.type === 'percent' || item.edit === 'number' || item.edit === 'percentInput') {
    return Math.max(baseWidth, 108);
  }
  return Math.max(baseWidth, 96);
}

function getStageTone(value) {
  return STAGE_TONES[value] || { color: M.textSecond, bg: '#f8fafc', border: M.borderLight };
}

function normalizeHeaderTitle(item) {
  const rawTitle = HEADER_TITLE_OVERRIDES[item.dataIndex] || item.title;
  return String(rawTitle || '')
    .replace(/\n\s*/g, '\n')
    .replace(/\s*--\s*/g, '\n')
    .replace(/\s*-\(/g, '\n(')
    .replace(/\]\s*/g, ']\n')
    .replace(/\(\(/g, '(')
    .replace(/\)\)/g, ')')
    .trim();
}

function PromotionProfitApp() {
  const [params, setParams] = useState(() => getParams());
  const [paramsSettled, setParamsSettled] = useState(() => Boolean(getAsinCountry(getParams())));
  const asinCountry = getAsinCountry(params);
  const activeTemplate = ACTIVE_TEMPLATE_KEY;
  const [launchDate, setLaunchDate] = useState('');
  const [productConfig, setProductConfig] = useState(null);
  const [reviewPricingMap, setReviewPricingMap] = useState({});
  const [rows, setRows] = useState([]);
  const [activeRowIndex, setActiveRowIndex] = useState(0);
  const [detailExpanded, setDetailExpanded] = useState(true);
  const [editingCell, setEditingCell] = useState(null);
  const [removedIds, setRemovedIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [configSubmitting, setConfigSubmitting] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [configErrorMsg, setConfigErrorMsg] = useState('');
  const [error, setError] = useState('');
  const isNarrow = false;
  const [configForm] = Form.useForm();
  const [createConfigForm] = Form.useForm();

  useEffect(() => {
    let active = true;

    const applyParams = () => {
      const nextParams = getParams();
      const nextAsinCountry = getAsinCountry(nextParams);

      setParams((prev) => {
        const merged = { ...prev };
        mergeUrlParams(merged, nextParams);
        return areUrlParamsSame(prev, merged) ? prev : merged;
      });

      if (nextAsinCountry) setParamsSettled(true);
      return Boolean(nextAsinCountry);
    };

    const timers = [0, 50, 120, 250, 500, 900, 1500, 2500, 4000].map((delay) => (
      setTimeout(() => { if (active) applyParams(); }, delay)
    ));
    const pollTimer = setInterval(() => {
      if (active) applyParams();
    }, 500);
    const settleTimer = setTimeout(() => {
      if (active) {
        clearInterval(pollTimer);
        setParamsSettled(true);
      }
    }, 4500);

    return () => {
      active = false;
      timers.forEach(clearTimeout);
      clearInterval(pollTimer);
      clearTimeout(settleTimer);
    };
  }, []);

  const recalc = (nextRows, cfg = productConfig, pricingMap = reviewPricingMap) => calculateRows(nextRows, cfg || {}, pricingMap || {});

  const fetchProductConfig = async () => {
    if (!asinCountry) return null;
    const configRes = await productConfigRequest({
      url: 'product_config:get',
      params: { filterByTk: asinCountry },
    });
    return configRes?.data?.data || null;
  };

  const fetchReviewPricingMap = async () => {
    if (!asinCountry) return {};
    const res = await apiRequest({
      url: `${PRICING_COLLECTION}:list`,
      params: {
        filter: JSON.stringify({ asin_country: asinCountry, scenario_type: 'review' }),
        pageSize: 999,
      },
    });
    const list = Array.isArray(res?.data?.data)
      ? res.data.data
      : (Array.isArray(res?.data) ? res.data : []);
    return list.reduce((acc, item) => {
      const key = priceKey(item.price_with_tax);
      if (key) acc[key] = item;
      return acc;
    }, {});
  };

  const toProductConfigFormValues = (cfg) => {
    const values = {};
    PRODUCT_CONFIG_FORM_SECTIONS.forEach((section) => {
      section.fields.forEach((field) => {
        const value = cfg ? cfg[field.name] : undefined;
        if (PRODUCT_CONFIG_PERCENT_FIELDS.includes(field.name) && value != null && value !== '') {
          values[field.name] = round(toNum(value) * 100, 4);
        } else if (value != null) {
          values[field.name] = value;
        }
      });
    });
    return values;
  };

  const fromProductConfigFormValues = (values) => {
    const data = {};
    Object.keys(values || {}).forEach((key) => {
      const value = values[key];
      if (value == null || value === '') return;
      data[key] = PRODUCT_CONFIG_PERCENT_FIELDS.includes(key) ? Number(value) / 100 : value;
    });
    return data;
  };

  const getConfigErrorMessage = (e) => e?.response?.data?.errors?.[0]?.message || e?.message || String(e || '未知错误');

  const refreshProductConfig = async (fallbackConfig) => {
    let nextConfig = await fetchProductConfig();
    if (!nextConfig) nextConfig = fallbackConfig || null;
    setProductConfig(nextConfig);
    setRows((prev) => calculateRows(prev, nextConfig || {}, reviewPricingMap));
    return nextConfig;
  };

  const openEditProductConfigModal = () => {
    if (!asinCountry) {
      message.warning('缺少 asin/country 参数，无法编辑 product_config');
      return;
    }
    if (!productConfig) {
      message.warning('未读取到 product_config，请先新建配置');
      return;
    }
    configForm.resetFields();
    configForm.setFieldsValue(toProductConfigFormValues(productConfig));
    setEditModalVisible(true);
  };

  const openCreateProductConfigModal = () => {
    if (!asinCountry) {
      message.warning('缺少 asin/country 参数，无法新建 product_config');
      return;
    }
    if (productConfig) {
      message.warning('已存在 product_config，请使用编辑');
      return;
    }
    setConfigErrorMsg('');
    createConfigForm.resetFields();
    createConfigForm.setFieldsValue(PRODUCT_CONFIG_INITIAL_VALUES);
    setCreateModalVisible(true);
  };

  const createProductConfig = async (values) => {
    if (!asinCountry) {
      message.error('缺少 asin/country 参数，无法新建 product_config');
      return;
    }
    setConfigErrorMsg('');
    setConfigSubmitting(true);
    try {
      const data = fromProductConfigFormValues(values);
      const saveRes = await productConfigRequest({
        url: 'product_config:create',
        method: 'post',
        data: { asin_country: asinCountry, ...data },
      });
      await refreshProductConfig(saveRes?.data?.data || saveRes?.data || { asin_country: asinCountry, ...data });
      setCreateModalVisible(false);
      message.success('product_config 已创建');
    } catch (e) {
      const errMsg = getConfigErrorMessage(e);
      setConfigErrorMsg(`创建失败：${errMsg}`);
      message.error(`product_config 创建失败：${errMsg}`);
    } finally {
      setConfigSubmitting(false);
    }
  };

  const editProductConfig = async (values) => {
    if (!asinCountry) {
      message.error('缺少 asin/country 参数，无法编辑 product_config');
      return;
    }
    if (!productConfig) {
      message.error('未读取到 product_config，请先新建配置');
      return;
    }
    setConfigSubmitting(true);
    try {
      const data = fromProductConfigFormValues(values);
      const saveRes = await productConfigRequest({
        url: 'product_config:update',
        method: 'post',
        params: { filterByTk: asinCountry },
        data,
      });
      await refreshProductConfig(saveRes?.data?.data || saveRes?.data || { ...productConfig, ...data });
      setEditModalVisible(false);
      message.success('product_config 已更新');
    } catch (e) {
      const errMsg = getConfigErrorMessage(e);
      message.error(`product_config 更新失败：${errMsg}`);
    } finally {
      setConfigSubmitting(false);
    }
  };

  const loadData = async (templateKey = activeTemplate) => {
    setLoading(true);
    setError('');
    const def = TEMPLATE_DEFS[templateKey];
    setLaunchDate('');
    try {
      if (!asinCountry) {
        setError('URL 缺少 asin/country 参数，无法读取或保存产品维度数据。');
      }
      let cfg = null;
      if (asinCountry) {
        try {
          cfg = await fetchProductConfig();
        } catch (e) {
          cfg = null;
          setError(`未读取到 product_config：${e.message || e}`);
        }
      }
      setProductConfig(cfg);

      let pricingMap = {};
      if (asinCountry) {
        try {
          pricingMap = await fetchReviewPricingMap();
        } catch (e) {
          pricingMap = {};
          setError((prev) => [prev, `未读取到 review 定价方案：${e.message || e}`].filter(Boolean).join('；'));
        }
      }
      setReviewPricingMap(pricingMap);

      let loaded = [];
      if (asinCountry) {
        const listRes = await apiRequest({
          url: `${COLLECTION}:list`,
          params: {
            filter: JSON.stringify({ asin_country: asinCountry, template_type: templateKey }),
            pageSize: 999,
          },
        });
        loaded = Array.isArray(listRes?.data?.data)
          ? listRes.data.data
          : (Array.isArray(listRes?.data) ? listRes.data : []);
        loaded.sort((a, b) => toNum(a.row_no, 0) - toNum(b.row_no, 0));
      }
      if (loaded.length > 0) {
        const firstLaunchDate = normalizeDate(loaded[0].launch_date || '');
        setLaunchDate(firstLaunchDate);
        setRows(recalc(loaded.map((row) => ({
          ...row,
          model: row.model || params.model || cfg?.model || '',
          launch_date: normalizeDate(row.launch_date),
          plan_date: normalizeDate(row.plan_date),
        })), cfg, pricingMap));
      } else {
        setRows([]);
      }
      setRemovedIds([]);
    } catch (e) {
      setError(e.message || String(e));
      message.error(`加载失败：${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!asinCountry) {
      setRows([]);
      setRemovedIds([]);
      setLaunchDate('');
      setProductConfig(null);
      setReviewPricingMap({});
      setError(paramsSettled ? 'URL 缺少 asin/country 参数，无法读取或保存产品维度数据。' : '');
      setLoading(!paramsSettled);
      return;
    }
    loadData(ACTIVE_TEMPLATE_KEY);
  }, [asinCountry, paramsSettled]);

  useEffect(() => {
    setActiveRowIndex((prev) => {
      if (!rows.length) return 0;
      return Math.max(0, Math.min(prev, rows.length - 1));
    });
  }, [rows.length]);

  const updateRows = (producer) => {
    setRows((prev) => {
      const nextRows = typeof producer === 'function' ? producer(prev) : producer;
      return recalc(nextRows || []);
    });
  };

  const updateRow = (index, field, value) => {
    updateRows((prev) => prev.map((row, i) => {
      if (i !== index) return row;
      const nextRow = { ...row, [field]: value };
      if (AUTO_FORMULA_INPUT_FIELDS.has(field)) {
        nextRow[AUTO_FORMULA_STATE_FIELD] = {
          ...(row[AUTO_FORMULA_STATE_FIELD] || {}),
          [field]: isBlank(value),
        };
      }
      return nextRow;
    }));
  };

  const handleLaunchDateChange = (value) => {
    const normalized = normalizeDate(value);
    setLaunchDate(normalized);
    updateRows((prev) => prev.map((row) => ({
      ...row,
      launch_date: normalized,
      plan_date: addDays(normalized, row.date_offset || 0),
      weekday: weekdayOf(addDays(normalized, row.date_offset || 0)),
    })));
  };

  const addRow = () => {
    if (!asinCountry) {
      message.warning('缺少 asin/country 参数，无法新增可保存行');
      return;
    }
    setActiveRowIndex(rows.length);
    updateRows((prev) => {
      const last = prev[prev.length - 1] || {};
      const nextOffset = toNum(last.date_offset, prev.length - 1) + 1;
      const next = {
        ...createEmptyRow(ACTIVE_TEMPLATE_KEY, asinCountry, launchDate, prev.length + 1, nextOffset),
        model: params.model || productConfig?.model || '',
      };
      return [...prev, next];
    });
  };

  const removeRow = (record, index) => {
    if (record.id) setRemovedIds((ids) => [...ids, record.id]);
    updateRows((prev) => prev.filter((_, i) => i !== index).map((row, i) => ({ ...row, row_no: i + 1 })));
  };

  const clearRows = () => {
    setLaunchDate('');
    setActiveRowIndex(0);
    setRemovedIds(rows.filter((row) => row.id).map((row) => row.id));
    setRows([]);
  };

  const saveRows = async () => {
    if (!asinCountry) {
      message.error('缺少 asin/country 参数，无法保存');
      return;
    }
    if (rows.length === 0 && removedIds.length === 0) {
      message.info('当前没有可保存的数据');
      return;
    }
    if (rows.length > 0 && !launchDate) {
      message.warning('请先填写正式下 LP 日期');
      return;
    }
    setSaving(true);
    try {
      const calculated = recalc(rows);
      for (const id of removedIds) {
        await apiRequest({
          url: `${COLLECTION}:destroy`,
          method: 'POST',
          params: { filterByTk: id },
        });
      }
      for (const row of calculated) {
        const data = compactRecord(row);
        if (row.id) {
          await apiRequest({
            url: `${COLLECTION}:update`,
            method: 'POST',
            params: { filterByTk: row.id },
            data,
          });
        } else {
          await apiRequest({
            url: `${COLLECTION}:create`,
            method: 'POST',
            data,
          });
        }
      }
      message.success('推广利润试算已保存');
      await loadData(activeTemplate);
    } catch (e) {
      message.error(`保存失败：${e.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const controlHeight = 32;
  const controlFontSize = 13;
  const controlStyle = (width) => ({
    width,
    minHeight: controlHeight,
    background: '#fff',
    borderRadius: 6,
    fontSize: controlFontSize,
    borderColor: '#cbd6e2',
    boxShadow: 'none',
  });

  const renderNumberInput = (field, width = 86, step = 1, options = {}) => (_, record, index) => {
    const isPercentInput = options.percentInput === true;
    return R.createElement(InputNumber, {
      size: 'small',
      value: isPercentInput ? toPercentInputValue(record[field]) : record[field],
      step,
      precision: isPercentInput ? 2 : 2,
      style: controlStyle(width),
      stringMode: true,
      controls: false,
      formatter: isPercentInput
        ? (value) => (isBlank(value) ? '' : `${value}%`)
        : undefined,
      parser: isPercentInput
        ? (value) => String(value || '').replace(/[%\s,]/g, '')
        : undefined,
      'aria-label': field,
      onChange: (value) => updateRow(index, field, isPercentInput ? fromPercentInputValue(value) : value),
      onBlur: () => setEditingCell(null),
      onPressEnter: () => setEditingCell(null),
    });
  };

  const renderTextInput = (field, width = 110) => (_, record, index) => R.createElement(Input, {
    size: 'small',
    value: record[field],
    style: controlStyle(width),
    'aria-label': field,
    onChange: (event) => updateRow(index, field, event.target.value),
    onBlur: () => setEditingCell(null),
    onPressEnter: () => setEditingCell(null),
  });

  const renderSelectInput = (field, options, width = 110) => (_, record, index) => {
    const tone = field === 'product_stage' ? getStageTone(record[field]) : { bg: M.inputBg, border: M.border };
    return R.createElement('div', {
      style: {
        width,
        padding: 2,
        borderRadius: M.radiusXs,
        background: field === 'product_stage' ? tone.bg : '#fff',
        border: `1px solid ${field === 'product_stage' ? tone.border : M.border}`,
      },
    },
      R.createElement(Select, {
        size: 'small',
        value: record[field],
        options,
        style: { width: '100%', minHeight: controlHeight },
        allowClear: true,
        bordered: false,
        'aria-label': field,
        onChange: (value) => {
          updateRow(index, field, value);
          setEditingCell(null);
        },
        onBlur: () => setEditingCell(null),
      }),
    );
  };

  const renderDateInput = (_, record, index) => R.createElement(DatePicker, {
    size: 'small',
    value: toDayjs(record.plan_date),
    locale: DATE_PICKER_ZH_CN,
    format: 'YYYY年MM月DD日',
    placeholder: '选择日期',
    inputReadOnly: true,
    allowClear: true,
    style: controlStyle(136),
    onChange: (date) => {
      const nextDate = date ? date.format('YYYY-MM-DD') : '';
      updateRows((prev) => prev.map((row, i) => (
        i === index ? { ...row, plan_date: nextDate, weekday: weekdayOf(nextDate) } : row
      )));
      setEditingCell(null);
    },
    onBlur: () => setEditingCell(null),
  });

  const renderDisplayValue = (item) => (value) => {
    const display = item.type === 'percent' ? percent(value) : (item.type === 'number' ? money(value) : (value ?? '-'));
    const numeric = toNum(value, 0);
    const isMoneyLike = item.type === 'number' || item.type === 'percent';
    const isProfitField = item.highlight || ['gross_profit', 'gross_profit_rmb', 'cumulative_profit_rmb'].includes(item.dataIndex);
    const valueColor = isProfitField
      ? (numeric > 0 ? M.green : (numeric < 0 ? M.red : M.textSecond))
      : (EMPHASIS_FIELDS.has(item.dataIndex) ? getColumnTheme(item).text : M.textPrimary);
    if (item.dataIndex === 'product_stage' && value) {
      const tone = getStageTone(value);
      return R.createElement(Tag, {
        style: {
          margin: 0,
          color: tone.color,
          background: tone.bg,
          borderColor: tone.border,
          borderRadius: 999,
          fontWeight: 700,
        },
      }, value);
    }
    return R.createElement(Text, {
      style: {
        color: valueColor,
        fontFamily: isMoneyLike ? M.fontMono : M.font,
        fontSize: 13,
        lineHeight: 1.45,
        whiteSpace: item.edit === 'text' ? 'normal' : 'nowrap',
        wordBreak: item.edit === 'text' ? 'break-word' : 'normal',
        fontVariantNumeric: isMoneyLike ? 'tabular-nums' : undefined,
      },
      strong: item.highlight || EMPHASIS_FIELDS.has(item.dataIndex),
    }, display);
  };

  const getEditableCellKey = (record, index, field) => `${record?.id || `${activeTemplate}_${index}`}_${field}`;

  const renderEditableDisplay = (item, value, record, index) => {
    const displayNode = renderDisplayValue(item)(value);
    return R.createElement('div', {
      title: '双击编辑',
      style: {
        minHeight: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: (item.type === 'number' || item.type === 'percent') ? 'flex-end' : 'flex-start',
        gap: 6,
        padding: '2px 4px',
        borderRadius: 4,
        cursor: 'text',
      },
      onDoubleClick: (event) => {
        event.stopPropagation();
        setActiveRowIndex(index);
        setEditingCell(getEditableCellKey(record, index, item.dataIndex));
      },
    }, displayNode);
  };

  const renderDetailCell = (item, inputRenderer) => (value, record, index) => {
    const cellKey = getEditableCellKey(record, index, item.dataIndex);
    if (item.edit && editingCell === cellKey) {
      return R.createElement('div', {
        className: 'promotion-detail-editing-cell',
        onClick: (event) => event.stopPropagation(),
        onMouseDown: (event) => event.stopPropagation(),
        onBlurCapture: (event) => {
          const nextTarget = event.relatedTarget;
          if (!nextTarget || !event.currentTarget.contains(nextTarget)) {
            setTimeout(() => setEditingCell(null), 0);
          }
        },
        onKeyDown: (event) => {
          if (event.key === 'Escape') setEditingCell(null);
        },
      }, inputRenderer(value, record, index));
    }
    if (item.edit) return renderEditableDisplay(item, value, record, index);
    return renderDisplayValue(item)(value, record, index);
  };

  const columns = [
    ...EXCEL_TABLE_COLUMNS.map((item) => {
      const width = getColumnWidth(item, isNarrow);
      const inputWidth = Math.max(64, width - 18);
      const theme = getColumnTheme(item);
      const headerTitle = normalizeHeaderTitle(item);
      const headerLines = headerTitle.split('\n').filter(Boolean);
      const numericLike = item.type === 'number' || item.type === 'percent';
      const headerTextColor = HEADER_TEXT_BY_FIELD[item.dataIndex] || EXCEL_HEADER_TEXT;
      const col = {
        title: R.createElement('div', {
          className: 'profit-table-header-title',
          style: {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minWidth: 0,
            minHeight: 72,
            height: '100%',
            padding: '8px 4px',
            textAlign: 'center',
            gap: 2,
          },
        },
          ...headerLines.map((line, lineIndex) => R.createElement('span', {
            key: `${item.dataIndex}_${lineIndex}`,
            style: {
              display: 'block',
              width: '100%',
              color: headerTextColor,
              fontSize: lineIndex === 0 ? 13 : 12,
              fontWeight: lineIndex === 0 ? 700 : 600,
              lineHeight: lineIndex === 0 ? 1.22 : 1.18,
              letterSpacing: 0,
              whiteSpace: 'normal',
              wordBreak: 'normal',
              overflowWrap: 'break-word',
              overflow: 'visible',
              textOverflow: 'clip',
              fontFamily: M.font,
            },
          }, line)),
        ),
        dataIndex: item.dataIndex,
        width,
        fixed: item.fixed || (LEFT_FIXED_FIELDS.has(item.dataIndex) ? 'left' : undefined),
        align: numericLike && !item.edit ? 'right' : 'left',
        onHeaderCell: () => ({
          style: {
            background: theme.header,
            color: theme.text,
            fontSize: 13,
            fontWeight: 700,
            lineHeight: 1.25,
            padding: 0,
            whiteSpace: 'normal',
            borderTop: `1px solid ${M.border}`,
            borderBottom: `1px solid ${M.border}`,
            verticalAlign: 'top',
            overflow: 'visible',
          },
        }),
        onCell: () => ({
          style: {
            background: item.highlight ? '#e2f0d9' : '#fff',
            padding: '6px 7px',
            borderRight: `1px solid ${M.borderLight}`,
            verticalAlign: 'middle',
          },
        }),
      };
      if (item.dataIndex === 'plan_date') {
        col.render = renderDetailCell(item, renderDateInput);
      } else if (item.edit === 'select') {
        col.render = renderDetailCell(item, renderSelectInput(item.dataIndex, item.options || [], inputWidth));
      } else if (item.edit === 'text') {
        col.render = renderDetailCell(item, renderTextInput(item.dataIndex, inputWidth));
      } else if (item.edit === 'number' || item.edit === 'percentInput') {
        col.render = renderDetailCell(item, renderNumberInput(item.dataIndex, inputWidth, item.edit === 'percentInput' ? 0.01 : 1, {
          percentInput: item.edit === 'percentInput',
        }));
      } else {
        col.render = renderDisplayValue(item);
      }
      return col;
    }),
    {
      title: R.createElement('div', {
        className: 'profit-table-header-title',
        style: {
          minHeight: 72,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: TABLE_SECTION_COLORS.action.text,
          fontWeight: 700,
          fontSize: 13,
          letterSpacing: 0,
        },
      }, '操作'),
      width: 96,
      fixed: 'right',
      align: 'center',
      onHeaderCell: () => ({
        style: {
          background: TABLE_SECTION_COLORS.action.header,
          borderTop: `1px solid ${M.border}`,
          borderBottom: `1px solid ${M.border}`,
          fontWeight: 600,
          color: TABLE_SECTION_COLORS.action.text,
          padding: 0,
          verticalAlign: 'top',
        },
      }),
      onCell: () => ({
        style: {
          background: TABLE_SECTION_COLORS.action.cell,
          padding: '6px 7px',
        },
      }),
      render: (_, record, index) => R.createElement(Space, { size: 4, align: 'center' },
        R.createElement(Text, {
          style: {
            fontSize: 11,
            color: M.textMuted,
            fontFamily: M.fontMono,
          },
        }, `#${index + 1}`),
        R.createElement(Popconfirm, {
          title: '删除这一行？',
          okText: '删除',
          cancelText: '取消',
          placement: 'left',
          onConfirm: () => removeRow(record, index),
        }, R.createElement(Button, {
          danger: true,
          type: 'text',
          size: 'small',
          title: '删除行',
          'aria-label': `删除第 ${index + 1} 行`,
          icon: DeleteOutlined ? R.createElement(DeleteOutlined) : null,
          style: {
            minWidth: 30,
            height: 30,
            borderRadius: M.radiusSm,
          },
        })),
      ),
    },
  ];
  const tableScrollX = columns.reduce((total, col) => total + toNum(col.width, 0), 0);
  const tableScroll = { x: tableScrollX };

  const panelStyle = {
    background: M.cardBg,
    borderRadius: M.radius,
    border: `1px solid ${M.border}`,
    boxShadow: M.shadowSm,
  };

  const activeRow = rows[activeRowIndex] || null;

  const renderActionBar = () => R.createElement(Space, { wrap: true, align: 'center', size: 8 },
    R.createElement(Button, {
      icon: ReloadOutlined ? R.createElement(ReloadOutlined) : null,
      size: 'small',
      onClick: () => loadData(activeTemplate),
      style: { borderColor: M.borderLight, color: M.textSecond, borderRadius: M.radiusXs },
    }, '刷新'),
    R.createElement(Button, {
      icon: PlusOutlined ? R.createElement(PlusOutlined) : null,
      size: 'small',
      onClick: addRow,
      style: { borderColor: M.primaryLight, color: M.primary, borderRadius: M.radiusXs, fontWeight: 700 },
    }, '新增阶段'),
    R.createElement(Popconfirm, {
      title: '清空当前页？保存后会删除已落库的当前模板行。',
      okText: '清空',
      cancelText: '取消',
      onConfirm: clearRows,
    }, R.createElement(Button, {
      danger: true,
      size: 'small',
      style: { borderRadius: M.radiusXs },
    }, '清空')),
    R.createElement(Button, {
      type: 'primary',
      loading: saving,
      icon: SaveOutlined ? R.createElement(SaveOutlined) : null,
      size: 'small',
      onClick: saveRows,
      style: { background: M.primary, borderColor: M.primary, fontWeight: 700, borderRadius: M.radiusXs },
    }, '保存'),
  );

  const renderLaunchDateControl = () => R.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      flexWrap: 'wrap',
    },
  },
    R.createElement('span', {
      style: {
        color: M.textSecond,
        fontSize: 12,
        fontWeight: 800,
        whiteSpace: 'nowrap',
      },
    }, '正式下 LP 日期'),
    R.createElement(DatePicker, {
      size: 'small',
      value: toDayjs(launchDate),
      locale: DATE_PICKER_ZH_CN,
      format: 'YYYY-MM-DD',
      placeholder: '选择日期',
      inputReadOnly: true,
      allowClear: true,
      style: controlStyle(136),
      onChange: (date) => handleLaunchDateChange(date ? date.format('YYYY-MM-DD') : ''),
    }),
  );

  const getStageLabel = (row, index) => row?.period || row?.trial_note || `阶段 ${index + 1}`;

  const getMetricColor = (field, value) => {
    const n = toNum(value, 0);
    if (['gross_margin', 'gross_profit_rmb', 'cumulative_profit_rmb', 'daily_organic_orders'].includes(field)) {
      return n > 0 ? M.green : (n < 0 ? M.red : M.textSecond);
    }
    if (['tacos_calculated', 'ads_rate', 'review_order_ratio'].includes(field)) {
      return n >= 0.25 ? M.red : (n >= 0.15 ? M.orange : M.teal);
    }
    return M.textPrimary;
  };

  const formatWorkbenchValue = (value, type) => {
    if (type === 'percent') return percent(value);
    if (type === 'money') return money(value);
    if (type === 'number') return formatFixed(value, 2);
    return value || '-';
  };

  const formatCompactMetricValue = (value, type) => {
    if (value === null || value === undefined || value === '') return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (type === 'percent') return `${formatFixed(n * 100, Math.abs(n) >= 100 ? 0 : 2)}%`;
    const abs = Math.abs(n);
    const sign = n < 0 ? '-' : '';
    const units = [
      [1e12, 'T'],
      [1e9, 'B'],
      [1e6, 'M'],
      [1e3, 'K'],
    ];
    const unit = units.find(([size]) => abs >= size);
    if (unit) return `${sign}${formatFixed(abs / unit[0], abs / unit[0] >= 100 ? 0 : 2)}${unit[1]}`;
    return type === 'money' ? money(n) : formatFixed(n, 2);
  };

  const renderWorkbenchField = (fieldConfig) => {
    if (!activeRow) return null;
    const { field, label, kind, options, primary, wide } = fieldConfig;
    const inputBaseStyle = {
      ...controlStyle('100%'),
      minHeight: 30,
      background: '#fff',
      borderColor: primary ? M.primaryLight : '#cbd6e2',
    };
    const commonProps = {
      size: 'small',
      style: inputBaseStyle,
      'aria-label': label,
    };
    let control;
    if (kind === 'select') {
      const tone = getStageTone(activeRow[field]);
      control = R.createElement('div', {
        style: {
          padding: 2,
          borderRadius: M.radiusXs,
          background: tone.bg,
          border: `1px solid ${tone.border}`,
        },
      }, R.createElement(Select, {
        size: 'small',
        value: activeRow[field],
        options,
        style: { width: '100%', minHeight: 32 },
        allowClear: true,
        bordered: false,
        'aria-label': label,
        onChange: (value) => updateRow(activeRowIndex, field, value),
      }));
    } else if (kind === 'date') {
      control = R.createElement(DatePicker, {
        ...commonProps,
        value: toDayjs(activeRow.plan_date),
        locale: DATE_PICKER_ZH_CN,
        format: 'YYYY年MM月DD日',
        inputReadOnly: true,
        allowClear: true,
        onChange: (date) => {
          const nextDate = date ? date.format('YYYY-MM-DD') : '';
          updateRows((prev) => prev.map((row, i) => (
            i === activeRowIndex ? { ...row, plan_date: nextDate, weekday: weekdayOf(nextDate) } : row
          )));
        },
      });
    } else if (kind === 'number' || kind === 'percent') {
      const isPercentInput = kind === 'percent';
      control = R.createElement(InputNumber, {
        ...commonProps,
        value: isPercentInput ? toPercentInputValue(activeRow[field]) : activeRow[field],
        precision: 2,
        step: isPercentInput ? 0.01 : 1,
        stringMode: true,
        controls: false,
        formatter: isPercentInput ? (value) => (isBlank(value) ? '' : `${value}%`) : undefined,
        parser: isPercentInput ? (value) => String(value || '').replace(/[%\s,]/g, '') : undefined,
        onChange: (value) => updateRow(activeRowIndex, field, isPercentInput ? fromPercentInputValue(value) : value),
      });
    } else {
      control = R.createElement(Input, {
        ...commonProps,
        value: activeRow[field],
        onChange: (event) => updateRow(activeRowIndex, field, event.target.value),
      });
    }
    return R.createElement('div', {
      key: field,
      style: {
        minWidth: 0,
        gridColumn: wide ? 'span 2' : undefined,
        position: 'relative',
        paddingLeft: primary ? 7 : 0,
      },
    },
      primary ? R.createElement('span', {
        style: {
          position: 'absolute',
          left: 0,
          top: 24,
          bottom: 1,
          width: 3,
          borderRadius: 999,
          background: M.primary,
        },
      }) : null,
      R.createElement('div', {
        style: {
          fontSize: 11,
          color: M.textSecond,
          fontWeight: 700,
          marginBottom: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }, label),
      control,
    );
  };

  const renderWorkbenchSection = (section) => R.createElement('section', {
    key: section.title,
    style: {
      padding: '11px 12px',
      border: `1px solid ${M.borderLight}`,
      borderRadius: 8,
      background: '#fbfdff',
    },
  },
    R.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
      },
    },
      R.createElement('span', {
        style: {
          width: 3,
          height: 14,
          borderRadius: 999,
          background: section.accent,
          display: 'inline-block',
        },
      }),
      R.createElement('span', { style: { fontSize: 12, fontWeight: 900, color: section.accent } }, section.title),
    ),
    R.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(138px, 1fr))',
        gap: '8px 9px',
      },
    }, section.fields.map(renderWorkbenchField)),
  );

  const renderStageEditor = () => R.createElement('div', {
    style: {
      ...panelStyle,
      overflow: 'hidden',
      minHeight: 420,
      background: '#fff',
    },
  },
    R.createElement('div', {
      style: {
        padding: '12px 14px',
        borderBottom: `1px solid ${M.borderLight}`,
        background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
      },
    },
      R.createElement('div', null,
        R.createElement('div', { style: { fontSize: 15, fontWeight: 900, color: M.navy } },
          activeRow ? getStageLabel(activeRow, activeRowIndex) : '阶段编辑',
        ),
        R.createElement('div', { style: { marginTop: 2, fontSize: 12, color: M.textMuted } },
          activeRow ? `第 ${activeRowIndex + 1} 阶段 / ${activeRow.plan_date || '未设日期'}` : '暂无阶段',
        ),
      ),
      activeRow ? R.createElement(Popconfirm, {
        title: '删除当前阶段？',
        okText: '删除',
        cancelText: '取消',
        onConfirm: () => removeRow(activeRow, activeRowIndex),
      }, R.createElement(Button, {
        danger: true,
        type: 'text',
        icon: DeleteOutlined ? R.createElement(DeleteOutlined) : null,
        size: 'small',
      }, '删除')) : null,
    ),
    activeRow
      ? R.createElement('div', {
          style: {
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          },
        },
          renderWorkbenchSection({
            title: '快速填写',
            accent: M.primary,
            fields: QUICK_WORKBENCH_FIELDS,
          }),
          WORKBENCH_FIELD_SECTIONS
            .map((section) => ({
              ...section,
              fields: section.fields.filter((item) => !QUICK_WORKBENCH_FIELD_SET.has(item.field)),
            }))
            .filter((section) => section.fields.length > 0)
            .map(renderWorkbenchSection),
        )
      : R.createElement('div', {
          style: {
            minHeight: 320,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: M.textSecond,
          },
        }, '暂无阶段'),
  );

  const getRiskItems = (row) => {
    if (!row) return [];
    const items = [];
    if (toNum(row.gross_profit_rmb, 0) < 0) items.push(['阶段亏损', money(row.gross_profit_rmb), M.red]);
    if (toNum(row.cumulative_profit_rmb, 0) < 0) items.push(['累计未回正', money(row.cumulative_profit_rmb), M.orange]);
    if (toNum(row.daily_organic_orders, 0) < 0) items.push(['自然单缺口', formatFixed(row.daily_organic_orders, 2), M.red]);
    if (toNum(row.tacos_calculated, 0) >= 0.25) items.push(['TACOS 偏高', percent(row.tacos_calculated), M.orange]);
    if (toNum(row.review_order_ratio, 0) >= 0.3) items.push(['测评占比偏高', percent(row.review_order_ratio), M.orange]);
    return items;
  };

  const renderMetricTile = (item) => {
    const value = activeRow?.[item.field];
    const numeric = toNum(value, 0);
    const color = getMetricColor(item.field, value);
    const barWidth = item.type === 'percent'
      ? Math.min(100, Math.max(0, Math.abs(numeric) * 100))
      : Math.min(100, Math.max(0, Math.abs(numeric) / 1000 * 100));
    return R.createElement('div', {
      key: item.field,
      style: {
        border: `1px solid ${M.borderLight}`,
        background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
        borderRadius: 8,
        padding: '9px 10px',
        minHeight: 70,
        boxShadow: '0 1px 0 rgba(15, 23, 42, 0.03)',
      },
    },
      R.createElement('div', { style: { fontSize: 11, color: M.textSecond, fontWeight: 800 } }, item.label),
      R.createElement('div', {
        title: formatWorkbenchValue(value, item.type),
        style: {
          marginTop: 4,
          color,
          fontSize: item.type === 'money' ? 16 : 15,
          fontWeight: 900,
          fontFamily: M.fontMono,
          fontVariantNumeric: 'tabular-nums',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }, formatCompactMetricValue(value, item.type)),
      R.createElement('div', {
        style: {
          height: 3,
          borderRadius: 999,
          background: '#eef2f6',
          overflow: 'hidden',
          marginTop: 7,
        },
      },
        R.createElement('div', {
          style: {
            height: '100%',
            width: `${barWidth}%`,
            borderRadius: 999,
            background: color,
            transition: 'width 180ms ease',
          },
        }),
      ),
    );
  };

  const renderOverviewTable = () => {
    const overviewColumns = [
      {
        title: '日期',
        dataIndex: 'plan_date',
        width: 118,
        render: (_, row) => R.createElement('span', { style: { fontFamily: M.fontMono } },
          [row.plan_date || '-', row.weekday].filter(Boolean).join(' '),
        ),
      },
      {
        title: '定价',
        dataIndex: 'price_with_tax',
        width: 92,
        align: 'right',
        render: (value) => R.createElement('span', { style: { fontFamily: M.fontMono, fontWeight: 800 } }, money(value)),
      },
      {
        title: 'Coupon',
        dataIndex: 'coupon_amount',
        width: 86,
        align: 'right',
        render: (value) => R.createElement('span', { style: { fontFamily: M.fontMono } }, money(value)),
      },
      {
        title: '日均/总量',
        dataIndex: 'total_orders',
        width: 120,
        align: 'right',
        render: (_, row) => R.createElement('span', {
          title: `${formatFixed(row.total_daily_orders, 2)} / ${formatFixed(row.total_orders, 2)}`,
          style: { fontFamily: M.fontMono },
        },
          `${formatCompactMetricValue(row.total_daily_orders, 'number')} / ${formatCompactMetricValue(row.total_orders, 'number')}`,
        ),
      },
      {
        title: '毛利率',
        dataIndex: 'gross_margin',
        width: 92,
        align: 'right',
        render: (value) => R.createElement('span', {
          style: {
            fontFamily: M.fontMono,
            fontWeight: 900,
            color: getMetricColor('gross_margin', value),
          },
        }, formatCompactMetricValue(value, 'percent')),
      },
      {
        title: '毛利 RMB',
        dataIndex: 'gross_profit_rmb',
        width: 118,
        align: 'right',
        render: (value) => R.createElement('span', {
          style: {
            fontFamily: M.fontMono,
            fontWeight: 900,
            color: getMetricColor('gross_profit_rmb', value),
          },
        }, formatCompactMetricValue(value, 'money')),
      },
      {
        title: 'TACOS',
        dataIndex: 'tacos_calculated',
        width: 90,
        align: 'right',
        render: (value) => R.createElement('span', {
          style: {
            fontFamily: M.fontMono,
            fontWeight: 800,
            color: getMetricColor('tacos_calculated', value),
          },
        }, formatCompactMetricValue(value, 'percent')),
      },
      {
        title: '风险',
        dataIndex: 'risk',
        width: 86,
        render: (_, row) => {
          const riskCount = getRiskItems(row).length;
          return R.createElement(Tag, {
            style: {
              margin: 0,
              borderRadius: 999,
              borderColor: riskCount ? M.orangeBd : M.greenBd,
              background: riskCount ? '#fff7e6' : M.greenBg,
              color: riskCount ? M.orange : M.green,
              fontWeight: 800,
            },
          }, riskCount ? `${riskCount} 项` : '正常');
        },
      },
    ];

    return R.createElement('div', {
      style: {
        ...panelStyle,
        overflow: 'hidden',
      },
    },
      R.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          padding: '10px 12px',
          borderBottom: `1px solid ${M.borderLight}`,
          background: '#fff',
        },
      },
        R.createElement('div', null,
          R.createElement('div', { style: { fontSize: 14, fontWeight: 900, color: M.navy } }, '总览'),
          R.createElement('div', { style: { marginTop: 2, color: M.textMuted, fontSize: 12 } },
            rows.length ? `当前第 ${Math.min(activeRowIndex + 1, rows.length)} 条 / 共 ${rows.length} 条` : '暂无记录',
          ),
        ),
        R.createElement(Button, {
          size: 'small',
          icon: PlusOutlined ? R.createElement(PlusOutlined) : null,
          onClick: addRow,
          style: { borderColor: M.primaryLight, color: M.primary, borderRadius: M.radiusXs, fontWeight: 700 },
        }, '新增记录'),
      ),
      R.createElement(Table, {
        className: 'promotion-overview-table',
        rowKey: (record, index) => record.id || `overview_${index}`,
        dataSource: rows,
        columns: overviewColumns,
        size: 'small',
        pagination: rows.length > 8 ? { pageSize: 8, size: 'small', showSizeChanger: false } : false,
        scroll: { x: 730 },
        rowClassName: (_, index) => (index === activeRowIndex ? 'is-active-overview-row' : ''),
        onRow: (_, index) => ({
          onClick: () => setActiveRowIndex(index),
          style: { cursor: 'pointer' },
        }),
        locale: {
          emptyText: R.createElement(Empty, {
            image: Empty.PRESENTED_IMAGE_SIMPLE,
            description: R.createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '12px 8px 18px',
              },
            },
              R.createElement('div', { style: { color: M.textPrimary, fontWeight: 800, fontSize: 15 } }, '暂无推广记录'),
              R.createElement(Button, {
                type: 'primary',
                size: 'small',
                icon: PlusOutlined ? R.createElement(PlusOutlined) : null,
                onClick: addRow,
                style: { background: M.primary, borderColor: M.primary, fontWeight: 700 },
              }, '新增第一条'),
            ),
          }),
        },
      }),
    );
  };

  const renderInsightPanel = () => {
    const risks = getRiskItems(activeRow);
    return R.createElement('div', {
      style: {
        ...panelStyle,
        overflow: 'hidden',
        minHeight: 420,
        background: '#fff',
      },
    },
      R.createElement('div', {
        style: {
          padding: '12px 14px',
          borderBottom: `1px solid ${M.borderLight}`,
          background: 'linear-gradient(180deg, #ffffff 0%, #f8fbfd 100%)',
        },
      },
        R.createElement('div', { style: { fontSize: 15, fontWeight: 900, color: M.navy } }, '实时结果'),
        R.createElement('div', { style: { marginTop: 2, fontSize: 12, color: M.textMuted } },
          activeRow ? `${activeRow.product_stage || '未分阶段'} / ${activeRow.period || '未设周期'}` : '暂无阶段',
        ),
      ),
      activeRow
        ? R.createElement('div', {
            style: {
              padding: 12,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            },
          },
            WORKBENCH_RESULT_SECTIONS.map((section) => R.createElement('section', { key: section.title },
              R.createElement('div', {
                style: {
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 8,
                },
              },
                R.createElement('span', { style: { fontSize: 13, fontWeight: 900, color: M.textPrimary } }, section.title),
              ),
              R.createElement('div', {
                style: {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: 8,
                },
              }, section.items.map(renderMetricTile)),
            )),
            R.createElement('section', null,
              R.createElement('div', { style: { fontSize: 13, fontWeight: 900, color: M.textPrimary, marginBottom: 8 } }, '风险提示'),
              risks.length
                ? R.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8 } },
                    risks.map(([label, value, color]) => R.createElement('div', {
                      key: label,
                      style: {
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 8,
                        border: `1px solid ${color === M.red ? M.redBd : M.orangeBd}`,
                        background: color === M.red ? '#fff2f0' : '#fff7e6',
                      },
                    },
                      R.createElement('span', { style: { color, fontWeight: 800, fontSize: 12 } }, label),
                      R.createElement('span', { style: { color, fontFamily: M.fontMono, fontWeight: 800, fontSize: 12 } }, value),
                    )),
                  )
                : R.createElement('div', {
                    style: {
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: `1px solid ${M.greenBd}`,
                      background: M.greenBg,
                      color: M.green,
                      fontWeight: 800,
                      fontSize: 12,
                    },
                  }, '当前阶段暂无明显风险'),
            ),
          )
        : R.createElement('div', {
            style: {
              minHeight: 320,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: M.textSecond,
            },
          }, '暂无结果'),
    );
  };

  const renderWorkbench = () => R.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    },
  },
    R.createElement('div', {
      style: {
        ...panelStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '13px 14px',
        background: 'linear-gradient(180deg, #ffffff 0%, #f6faf7 100%)',
      },
    },
      R.createElement('div', null,
        R.createElement('div', { style: { fontSize: 16, fontWeight: 900, color: M.navy } }, '推广计划工作台'),
        R.createElement('div', { style: { marginTop: 2, fontSize: 12, color: M.textMuted } },
          activeRow ? `${getStageLabel(activeRow, activeRowIndex)} / ${activeRow.plan_date || '未设日期'}` : '未选择阶段',
        ),
      ),
      renderActionBar(),
    ),
    renderOverviewTable(),
    R.createElement('div', {
      className: 'promotion-workbench-grid',
      style: {},
    },
      renderStageEditor(),
      renderInsightPanel(),
    ),
  );

  const renderDetailTable = () => R.createElement('div', {
    style: {
      ...panelStyle,
      overflow: 'hidden',
    },
  },
    R.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        flexWrap: 'wrap',
        padding: '10px 12px',
        borderBottom: detailExpanded ? `1px solid ${M.borderLight}` : 'none',
        background: '#fff',
      },
    },
      R.createElement('div', null,
        R.createElement('div', { style: { fontSize: 14, fontWeight: 900, color: M.navy } }, '明细表'),
        R.createElement('div', { style: { marginTop: 2, color: M.textMuted, fontSize: 12 } }, `${rows.length} 行 / Excel 口径`),
      ),
      R.createElement(Space, { wrap: true, align: 'center', size: 8 },
        renderLaunchDateControl(),
        R.createElement(Button, {
          size: 'small',
          onClick: () => setDetailExpanded((value) => !value),
          style: { borderColor: M.borderLight, color: M.textSecond, borderRadius: M.radiusXs },
        }, detailExpanded ? '收起明细' : '展开明细'),
      ),
    ),
    detailExpanded ? R.createElement(Table, {
      className: 'promotion-profit-table',
      rowKey: (record, index) => record.id || `${activeTemplate}_${index}`,
      dataSource: rows,
      columns,
      pagination: rows.length > 12
        ? { pageSize: 12, showSizeChanger: true }
        : false,
      size: 'small',
      scroll: tableScroll,
      tableLayout: 'fixed',
      sticky: true,
      bordered: false,
      onRow: (record, index) => ({
        onClick: (event) => {
          setActiveRowIndex(index);
          if (!event.target?.closest?.('.promotion-detail-editing-cell')) setEditingCell(null);
        },
        style: { cursor: 'pointer' },
      }),
      locale: {
        emptyText: R.createElement(Empty, {
          image: Empty.PRESENTED_IMAGE_SIMPLE,
          description: R.createElement('div', {
            style: {
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '16px 8px 24px',
            },
          },
            R.createElement('div', { style: { color: M.textPrimary, fontWeight: 800, fontSize: 15 } }, '暂无试算方案'),
            R.createElement(Button, {
              type: 'primary',
              icon: PlusOutlined ? R.createElement(PlusOutlined) : null,
              size: 'small',
              onClick: addRow,
              style: { background: M.primary, borderColor: M.primary, fontWeight: 700 },
            }, '新增第一行'),
          ),
        }),
      },
    }) : null,
  );

  const fmtConfig = (value, isPercent = false) => {
    if (value === null || value === undefined || value === '') return '-';
    const n = Number(value);
    if (!Number.isFinite(n)) return String(value);
    if (isPercent) return `${round(n * 100, 2).toFixed(2)}%`;
    return Number.isInteger(n) ? n.toLocaleString() : round(n, 2).toLocaleString();
  };

  const renderIdentityBlock = (rightSlot) => R.createElement('div', {
    style: {
      display: 'flex',
      alignItems: 'center',
      background: 'linear-gradient(135deg, #0f3b2e 0%, #1f6f54 58%, #2d8f76 100%)',
      borderRadius: 8,
      padding: '10px 14px',
      gap: 14,
      flexShrink: 0,
      minWidth: 470,
      boxShadow: '0 8px 18px rgba(33, 115, 70, 0.18)',
    },
  },
    ...[
      ['型号', params.model || productConfig?.model || '-', '#ffd666', 74],
      ['国家', params.country || '-', '#ffd666', 62],
      ['ASIN', params.asin || (asinCountry ? asinCountry.split('_')[0] : '-'), '#fff', 120],
      ['销售', params.sale_owner || params.saleOwner || '-', '#ffd6e7', 70],
    ].map(([label, value, color, minWidth], index, arr) => R.createElement(R.Fragment, { key: label },
      R.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          minWidth,
          maxWidth: label === 'ASIN' ? 150 : undefined,
        },
      },
        R.createElement('div', { style: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginBottom: 3 } }, label),
        R.createElement('div', {
          style: {
            color,
            fontSize: 15,
            fontWeight: 800,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        }, value || '-'),
      ),
      index < arr.length - 1
        ? R.createElement('div', { style: { width: 1, height: 34, background: 'rgba(255,255,255,0.24)' } })
        : null,
    )),
    rightSlot ? R.createElement(React.Fragment, null,
      R.createElement('div', { style: { width: 1, height: 34, background: 'rgba(255,255,255,0.24)' } }),
      rightSlot,
    ) : null,
  );

  const configSections = [
    {
      title: '基础成本',
      accent: '#2f6fed',
      bgColor: '#eef6ff',
      divider: '#c9defa',
      fields: [
        ['cost_rmb', '全新机产品成本', 'RMB', false],
        ['detection_machine_cost_rmb', '检测机产品成本', 'RMB', false],
        ['exchange_rate', '汇率', '', false],
        ['freight_per_unit_rmb', '头程费用', 'RMB/台', false],
        ['tax_rate', '税点', '', true],
      ],
    },
    {
      title: '平台费用',
      accent: '#009c8a',
      bgColor: '#effdfa',
      divider: '#bdeee7',
      fields: [
        ['commission_rate', '佣金占比', '', true],
        ['storage_rate', '仓储费占比', '', true],
        ['fba_fee', '配送费', '当地币', false],
        ['inbound_fee', '入库配置费', '当地币', false],
      ],
    },
    {
      title: '促销费用',
      accent: '#d46b08',
      bgColor: '#fff2fb',
      divider: '#f5c9ea',
      fields: [
        ['coupon_commission_rate', 'Coupon 抽佣率', '', true],
        ['offsite_commission_rate', '站外佣金率 (仅 US)', '', true],
        ['lightning_commission_rate', '秒杀抽佣率', '', true],
        ['lightning_fixed_fee', '秒杀每日固定费用', '当地币', false],
        ['lightning_fee_cap', '秒杀变动费用上限', '当地币', false],
      ],
    },
    {
      title: '退款占比',
      accent: '#6f3fd5',
      bgColor: '#f3efff',
      divider: '#d9ccff',
      fields: [
        ['refund_rate_new', '全新品退款占比', '', true],
        ['refund_rate_used', '检测机退款占比', '', true],
        ['refund_rate_review', '测评退款占比', '', true],
      ],
    },
  ];

  const renderProductConfigBar = () => R.createElement('div', {
    style: {
      background: '#fff',
      borderRadius: 8,
      border: '1px solid #c9d8cf',
      boxShadow: '0 6px 18px rgba(33, 115, 70, 0.08)',
      padding: '12px 16px',
      overflowX: 'auto',
    },
  },
    R.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'stretch',
        gap: 10,
        minWidth: 'max-content',
      },
    },
      renderIdentityBlock(productConfig
        ? R.createElement(Button, {
            icon: EditOutlined ? R.createElement(EditOutlined) : null,
            onClick: openEditProductConfigModal,
            size: 'small',
            disabled: !asinCountry,
            style: {
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.42)',
              color: '#fff',
              borderRadius: 6,
              fontWeight: 700,
              minHeight: 30,
            },
          }, '编辑配置')
        : R.createElement(Button, {
            icon: PlusOutlined ? R.createElement(PlusOutlined) : null,
            onClick: openCreateProductConfigModal,
            size: 'small',
            disabled: !asinCountry,
            style: {
              background: 'rgba(255,255,255,0.16)',
              border: '1px solid rgba(255,255,255,0.42)',
              color: '#fff',
              borderRadius: 6,
              fontWeight: 700,
              minHeight: 30,
            },
          }, '新建配置')),
      productConfig
        ? configSections.map((section, sIdx) => R.createElement(R.Fragment, { key: sIdx },
            R.createElement('div', {
              style: {
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                background: section.bgColor,
                border: `1px solid ${section.divider}`,
                borderRadius: 8,
                padding: '8px 10px',
                minWidth: section.fields.length > 4 ? 488 : 360,
              },
            },
              R.createElement('div', {
                style: {
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  marginBottom: 7,
                },
              },
                R.createElement('span', {
                  style: {
                    width: 4,
                    height: 16,
                    borderRadius: 999,
                    background: section.accent,
                    display: 'inline-block',
                  },
                }),
                R.createElement('span', { style: { color: section.accent, fontWeight: 800, fontSize: 13 } }, section.title),
              ),
              R.createElement('div', { style: { display: 'flex', alignItems: 'stretch' } },
                section.fields.map(([key, label, unit, isPercent], fIdx) => R.createElement(R.Fragment, { key },
                  R.createElement('div', {
                    style: {
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      padding: '2px 12px',
                      minWidth: key === 'detection_machine_cost_rmb' || key === 'lightning_fixed_fee' ? 118 : 86,
                    },
                  },
                    R.createElement('div', {
                      style: {
                        fontSize: 11,
                        color: '#6b7280',
                        marginBottom: 3,
                        whiteSpace: 'nowrap',
                      },
                    }, label),
                    R.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 3 } },
                      R.createElement('span', {
                        style: {
                          fontSize: 15,
                          fontWeight: 800,
                          color: '#22144d',
                          whiteSpace: 'nowrap',
                          fontFamily: M.fontMono,
                          fontVariantNumeric: 'tabular-nums',
                        },
                      }, fmtConfig(productConfig[key], isPercent)),
                      unit ? R.createElement('span', { style: { fontSize: 10, color: '#8b8fa3' } }, unit) : null,
                    ),
                  ),
                  fIdx < section.fields.length - 1
                    ? R.createElement('div', {
                      style: {
                        width: 1,
                        alignSelf: 'stretch',
                        background: section.divider,
                        margin: '2px 0',
                      },
                    })
                    : null,
                )),
              ),
            ),
            sIdx < configSections.length - 1 ? null : null,
          ))
        : R.createElement('div', {
            style: {
              minWidth: 260,
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              borderRadius: M.radius,
              border: `1px dashed ${M.border}`,
              color: M.textSecond,
              background: M.sectionBg,
              fontSize: 13,
            },
          }, '还没有产品配置，成本与费率将按默认值试算。'),
    ),
  );

  const renderProductConfigFormSections = () => PRODUCT_CONFIG_FORM_SECTIONS.map((section) => R.createElement(R.Fragment, { key: section.title },
    R.createElement(Divider, {
      orientation: 'left',
      style: { fontSize: 13, color: M.primary, margin: '12px 0 8px', borderColor: '#bfdbfe', fontWeight: 700 },
    }, section.title),
    R.createElement(Row, { gutter: 16 },
      ...section.fields.map((field) => R.createElement(Col, { key: field.name, xs: 24, sm: 12 },
        R.createElement(Form.Item, {
          name: field.name,
          label: field.label,
          rules: field.required ? [{ required: true, message: `请输入${field.label}` }] : [],
          style: { marginBottom: 12 },
        },
          R.createElement(InputNumber, {
            style: { width: '100%' },
            step: field.step,
            stringMode: true,
            addonAfter: field.isPercent ? '%' : undefined,
          }),
        ),
      )),
    ),
  ));

  const renderProductConfigModals = () => R.createElement(R.Fragment, null,
    R.createElement(Modal, {
      title: R.createElement('span', {
        style: { color: M.textPrimary, fontWeight: 800 },
      }, '编辑产品配置'),
      open: editModalVisible,
      onCancel: () => setEditModalVisible(false),
      footer: null,
      width: 760,
      destroyOnClose: true,
    },
      R.createElement(Form, {
        form: configForm,
        layout: 'vertical',
        onFinish: editProductConfig,
      },
        ...renderProductConfigFormSections(),
        R.createElement(Divider, { style: { margin: '12px 0' } }),
        R.createElement(Row, { justify: 'end', gutter: 12 },
          R.createElement(Col, null,
            R.createElement(Button, {
              onClick: () => setEditModalVisible(false),
              style: { marginRight: 8 },
            }, '取消'),
          ),
          R.createElement(Col, null,
            R.createElement(Button, {
              type: 'primary',
              htmlType: 'submit',
              loading: configSubmitting,
              style: { background: M.primary, borderColor: M.primary, minWidth: 100, fontWeight: 700 },
            }, '保存'),
          ),
        ),
      ),
    ),
    R.createElement(Modal, {
      title: R.createElement('span', {
        style: { color: M.textPrimary, fontWeight: 800 },
      }, '新建产品配置'),
      open: createModalVisible,
      onCancel: () => setCreateModalVisible(false),
      footer: null,
      width: 760,
      destroyOnClose: true,
    },
      configErrorMsg
        ? R.createElement('div', {
            style: {
              color: '#ff4d4f',
              marginBottom: 16,
              padding: '8px 12px',
              background: '#fff2f0',
              border: '1px solid #ffccc7',
              borderRadius: 8,
            },
          }, configErrorMsg)
        : null,
      R.createElement(Form, {
        form: createConfigForm,
        layout: 'vertical',
        onFinish: createProductConfig,
        initialValues: PRODUCT_CONFIG_INITIAL_VALUES,
      },
        ...renderProductConfigFormSections(),
        R.createElement(Divider, { style: { margin: '12px 0' } }),
        R.createElement(Row, { justify: 'end', gutter: 12 },
          R.createElement(Col, null,
            R.createElement(Button, {
              onClick: () => setCreateModalVisible(false),
              style: { marginRight: 8 },
            }, '取消'),
          ),
          R.createElement(Col, null,
            R.createElement(Button, {
              type: 'primary',
              htmlType: 'submit',
              loading: configSubmitting,
              style: { background: M.primary, borderColor: M.primary, minWidth: 100, fontWeight: 700 },
            }, '保存'),
          ),
        ),
      ),
    ),
  );

  if (loading) {
    return R.createElement('div', {
      style: { minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    }, R.createElement(Spin, { size: 'large' }));
  }

  return R.createElement('div', {
    className: 'promotion-profit-block',
    style: {
      minHeight: '100%',
      background: M.pageBg,
      padding: 16,
      color: M.textPrimary,
      fontFamily: M.font,
    },
  },
    R.createElement('style', null, `
      .promotion-profit-block {
        -webkit-font-smoothing: antialiased;
        text-rendering: optimizeLegibility;
      }
      .promotion-profit-block .ant-table-wrapper .ant-table {
        color: ${M.textPrimary};
        background: #fff;
        font-family: ${M.font};
        font-size: 13px;
        border: 1px solid ${M.border};
      }
      .promotion-profit-block .ant-table table {
        border-collapse: collapse;
      }
      .promotion-profit-block .ant-table-thead > tr > th {
        transition: background 160ms ease;
        vertical-align: middle !important;
        height: auto !important;
        min-height: 92px;
        padding: 0 !important;
        text-align: center !important;
        overflow: visible !important;
        border-right: 1px solid ${M.border} !important;
        border-bottom: 1px solid ${M.border} !important;
      }
      .promotion-profit-block .ant-table-thead > tr > th .ant-table-column-title {
        display: block;
        width: 100%;
        height: 100%;
        overflow: visible;
      }
      .promotion-profit-block .profit-table-header-title {
        box-sizing: border-box;
        overflow: visible;
      }
      .promotion-profit-block .profit-table-header-title span {
        text-wrap: wrap;
      }
      .promotion-profit-block .ant-table-thead > tr > th::before {
        display: none;
      }
      .promotion-profit-block .ant-table-tbody > tr:hover > td {
        background: #f4f8fb !important;
      }
      .promotion-profit-block .ant-table-cell-fix-left,
      .promotion-profit-block .ant-table-cell-fix-right {
        box-shadow: -6px 0 12px rgba(0,0,0,0.04);
      }
      .promotion-profit-block .ant-input,
      .promotion-profit-block .ant-input-number,
      .promotion-profit-block .ant-select-selector {
        font-family: ${M.font};
        font-size: 12px !important;
        font-variant-numeric: tabular-nums;
        border-color: #cbd6e2 !important;
        box-shadow: none !important;
        background: #fff !important;
        border-radius: 6px !important;
      }
      .promotion-profit-block .ant-input:hover,
      .promotion-profit-block .ant-input-number:hover,
      .promotion-profit-block .ant-select-selector:hover {
        border-color: ${M.primaryLight} !important;
      }
      .promotion-profit-block .ant-input:focus,
      .promotion-profit-block .ant-input-number-focused,
      .promotion-profit-block .ant-select-focused .ant-select-selector {
        border-color: ${M.primary} !important;
        box-shadow: 0 0 0 2px rgba(22,119,255,0.12) !important;
      }
      .promotion-profit-block .ant-table-container {
        border-top: 1px solid ${M.border};
      }
      .promotion-profit-block .ant-table-tbody > tr > td {
        height: 42px;
        border-right: 1px solid ${M.borderLight} !important;
        border-bottom: 1px solid ${M.borderLight} !important;
      }
      .promotion-profit-block .promotion-workbench-grid {
        display: grid;
        grid-template-columns: minmax(620px, 1fr) minmax(420px, 0.62fr);
        gap: 12px;
        align-items: start;
      }
      .promotion-profit-block .promotion-overview-table .ant-table-tbody > tr.is-active-overview-row > td {
        background: #f2fbf5 !important;
      }
      .promotion-profit-block .promotion-overview-table .ant-table-tbody > tr.is-active-overview-row > td:first-child {
        box-shadow: inset 3px 0 0 ${M.primary};
      }
      .promotion-profit-block .promotion-overview-table .ant-table-tbody > tr:hover > td {
        background: #f8fbfd !important;
      }
      @media (max-width: 1280px) {
        .promotion-profit-block .promotion-workbench-grid {
          grid-template-columns: 1fr;
        }
      }
      @media (max-width: 760px) {
        .promotion-profit-block .ant-table-cell {
          font-size: 13px;
        }
        .promotion-profit-block .ant-table-pagination {
          margin: 10px 8px;
        }
      }
    `),
    R.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      },
    },
      renderProductConfigBar(),
      renderProductConfigModals(),

      error && R.createElement(Alert, {
        type: 'warning',
        showIcon: true,
        message: error,
        style: { borderRadius: M.radius, borderColor: M.orangeBd, background: M.orangeBg },
      }),

      renderDetailTable(),
    ),
  );
}

ctx.render(R.createElement(PromotionProfitApp));
