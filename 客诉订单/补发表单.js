const React = ctx.libs.React;
const {
  Button,
  Form,
    Input,
    Select,
    Spin,
    Space,
    Tag,
    Typography,
    message,
  } = ctx.libs.antd;

const FORM_UID = 'c4d5c6510a0';
const NOCOBASE_FORM_BLOCK_UID = 'vuzfot2adsh';
const REFRESH_BLOCK_UID = '870crh7hd7m';
const COLLECTION = 'refund';
const GET_VAR_TIMEOUT_MS = 300;

  const TEXT = {
    orderNumber: '订单号',
    customerName: '客户姓名',
    email: '邮箱',
    sales: '销售',
    status: '状态',
    reason: '详细原因',
    country: '国家',
    giftType: '礼物类型',
    address: '地址1',
    address2: '地址2',
    state: '州/省',
    city: '城市',
    phone: '手机号',
    postCode: '邮编',
    sku: 'SKU',
    accessories: '配件',
    sendingMethod: '寄送方式',
    refundType: '退款类型',
    mark: '备注',
  submit: '提交',
  submitSuccess: '提交成功',
  submitFailed: '提交失败',
  orderNotFound: '订单号不存在，请检查后再提交',
  requiredPrefix: '请填写',
};

const EN_TEXT = {
  orderNumber: 'Order No.',
  customerName: 'Customer Name',
  email: 'Email',
  sales: 'Sales',
  status: 'Status',
  reason: 'Reason',
  country: 'Country',
  giftType: 'Gift Type',
  address: 'Address 1',
  address2: 'Address 2',
  state: 'State / Province',
  city: 'City',
  phone: 'Phone',
  postCode: 'Post Code',
  sku: 'SKU',
  accessories: 'Accessories',
  sendingMethod: 'Sending Method',
  refundType: 'Refund Type',
  mark: 'Remark',
  submit: 'Submit',
  submitSuccess: 'Submitted successfully',
  submitFailed: 'Submit failed',
  orderNotFound: 'Order number does not exist. Please check and submit again.',
  requiredPrefix: 'Please fill in ',
};

const TEXT_BY_LANGUAGE = {
  zh: TEXT,
  en: EN_TEXT,
};

const FIELD_TEXT_KEYS = {
  order_number: 'orderNumber',
  customer_name: 'customerName',
  email: 'email',
  sales: 'sales',
  status: 'status',
  reason: 'reason',
  country: 'country',
  type: 'giftType',
  address: 'address',
  address2: 'address2',
  state: 'state',
  city: 'city',
  phone: 'phone',
  post_code: 'postCode',
  sku: 'sku',
  accessories: 'accessories',
  sending_method: 'sendingMethod',
  refund_type: 'refundType',
  mark: 'mark',
};

  const ACCESSORIES_FILTER_RULE = {
    $and: [
      { country: { $eq: '{{$nPopupRecord.order_info.country_code}}' } },
      {
        $or: [
          { model: { $eq: '{{$nPopupRecord.order_info.model}}' } },
          { model: { $includes: '通用' } },
        ],
      },
    ],
  };

  const ACCESSORIES_FIELD_NAMES = {
    label: 'country_model_category',
    value: 'country_model_category',
  };

  const STATUS_OPTIONS = [
    '待确认',
    '需发送',
    '已提交',
    '已完成',
    '搁置',
    '驳回',
    '评论审核中',
    '待确认支付信息',
    '待检查review',
    '待上传物流单',
    '待物流信息更新',
  ];

  const REASON_OPTIONS = [
    '邀评',
    '测评',
    '客诉/差评补偿',
    '佣金',
    '直评',
    '留Feedback',
    '免评/取消单',
    '秒杀进度条',
    '混秒',
    '查差评邮箱',
    '踩差评',
    '加购/心愿单',
    'QA',
    '站外推广（需备注）',
    '追加返款（需备注）',
    '其他（需备注）',
  ];

  const COUNTRY_OPTIONS = ['US', 'CA', 'JP', 'FR', 'DE', 'ES', 'IT', 'UK', 'CH'];

  const TYPE_OPTIONS = [
    '中介',
    'PayPal',
    'Zelle',
    'Venmo',
    '银行卡',
    '支付宝/微信',
    '亚马逊礼品卡',
    '沃尔玛礼品卡',
    '乐天礼品卡',
    'TV棒',
    '折叠支架',
    '幕布',
    '相机支架',
    '32G内存卡',
    '一年延保',
    '180天更换',
    '遥控器',
    '补发/换货',
    '其他配件',
    '无需送礼',
    'Visa预付卡',
    '支架及配件',
    '除尘口底盖',
    '投影仪本体',
    '通用支架',
    '电源线',
    'HDMI线',
    '便携背带',
    '螺丝',
    '说明书',
    '调焦齿轮',
    '适配器',
    '防尘网',
    '防滑底垫',
    '镜头盖',
  ];

  const SENDING_METHOD_OPTIONS = ['邮寄', '返款', '无需'];

  const FIELD_VALUE_RULES = {
    order_number: {
      field: 'refund.order_number',
      uid: 'fgukq0l4x2e',
      label: TEXT.orderNumber,
    required: true,
    mode: 'expression',
    expression: '{{$nPopupRecord.order_info.order_number}}',
    component: 'Input',
    readOnly: false,
    readOnlyWhenInitialFilled: true,
    visible: true,
  },
    customer_name: {
      field: '$nPopupRecord.customer.name',
      label: TEXT.customerName,
      required: true,
      mode: 'expression',
      expression: '{{$nPopupRecord.customer.name}}',
      component: 'Input',
      readOnly: false,
      readOnlyWhenInitialFilled: true,
      sourceOnly: true,
      visible: true,
    },
    email: {
      field: 'refund.email',
      uid: '7r2sv99avhs',
      label: TEXT.email,
      required: false,
      mode: 'expression',
      expression: '{{$nPopupRecord.email}}',
      component: 'Input',
      readOnly: true,
      visible: true,
    },
    sales: {
      field: 'refund.sales',
      uid: '5nsemnlor96',
      label: TEXT.sales,
      required: true,
      mode: 'computed',
      component: 'Select',
      options: [],
      showSearch: true,
      readOnly: false,
      visible: true,
    },
    status: {
      field: 'refund.status',
      uid: '7vd59jy8xvr',
      label: TEXT.status,
      required: false,
      mode: 'constant',
      value: '需发送',
      component: 'Select',
      options: STATUS_OPTIONS,
      readOnly: true,
      visible: true,
    },
    reason: {
      field: 'refund.reason',
      uid: 'g6b8yewen5c',
      label: TEXT.reason,
      required: false,
      mode: 'constant',
      value: ['客诉/差评补偿'],
      component: 'Select',
      selectMode: 'multiple',
      options: REASON_OPTIONS,
      readOnly: true,
      visible: true,
    },
    country: {
      field: 'refund.country',
      uid: 'aspm7fz5f35',
      label: TEXT.country,
      required: true,
      mode: 'expression',
      expression: '{{$nPopupRecord.order_info.country_code}}',
      component: 'Select',
      options: COUNTRY_OPTIONS,
      readOnly: false,
      visible: true,
    },
  type: {
    field: 'refund.type',
    uid: 'cxzw9n8v9c9',
    label: TEXT.giftType,
    required: true,
    mode: 'computed',
    component: 'Select',
    options: TYPE_OPTIONS,
    readOnly: true,
      visible: false,
    },
    address: {
      field: 'refund.address',
      uid: 'oxtuvjkhy8h',
      label: TEXT.address,
      required: true,
      mode: 'none',
      component: 'Input',
      visible: true,
    },
    address2: {
      field: 'refund.address2',
      uid: 'tg6b0a7d2fc',
      label: TEXT.address2,
      required: false,
      mode: 'none',
      component: 'Input',
      visible: true,
    },
    state: {
      field: 'refund.state',
      uid: 'f21me0bsgw5',
      label: TEXT.state,
      required: false,
      mode: 'none',
      component: 'Input',
      visible: true,
    },
    city: {
      field: 'refund.city',
      uid: 'abqyzscz91u',
      label: TEXT.city,
      required: true,
      mode: 'none',
      component: 'Input',
      visible: true,
    },
    phone: {
      field: 'refund.phone',
      uid: 'vuf1ic33lkh',
      label: TEXT.phone,
      required: false,
      mode: 'none',
      component: 'Input',
      visible: true,
    },
    post_code: {
      field: 'refund.post_code',
      uid: 'h4owx0wni5p',
      label: TEXT.postCode,
      required: false,
      mode: 'none',
      component: 'Input',
      visible: true,
    },
    sku: {
      field: 'refund.sku',
      label: TEXT.sku,
      required: false,
      mode: 'expression',
      expression: '{{$nPopupRecord.order_info.sku}}',
      component: 'Input',
      readOnly: true,
      sourceOnly: true,
      visible: true,
    },
    accessories: {
      field: 'refund.accessories',
      uid: 'tc4wtjx4lkg',
      label: TEXT.accessories,
      required: true,
      mode: 'none',
      component: 'Select',
      service: {
        params: {
          filter: ACCESSORIES_FILTER_RULE,
        },
        fieldNames: ACCESSORIES_FIELD_NAMES,
      },
      visible: true,
    },
    unique: {
      field: 'refund.unique',
      uid: 'nejuflejf93',
      label: '订单号+账号+原因+日期',
      required: true,
      mode: 'computed',
      visible: false,
    },
  sending_method: {
      field: 'refund.sending_method',
      uid: 'lis8mub5n77',
      label: TEXT.sendingMethod,
      required: false,
      mode: 'constant',
      value: '邮寄',
      component: 'Select',
      options: SENDING_METHOD_OPTIONS,
      readOnly: true,
      visible: false,
    },
  refund_type: {
    field: 'refund.refund_type',
    uid: 'jb86dgu4fov',
    label: TEXT.refundType,
    required: false,
    mode: 'constant',
    value: '客诉/差评',
    component: 'Select',
    visible: false,
  },
    mark: {
      field: 'refund.mark',
      uid: 'nu2pigi9gxt',
      label: TEXT.mark,
      required: false,
      mode: 'none',
      component: 'RichText',
      visible: true,
    },
  ticket_id: {
    field: 'refund.ticket_id',
    uid: 'msjvxdxzyza',
    label: 'ticket_id',
    required: false,
    mode: 'expression',
    expression: '{{$nPopupRecord.ID}}',
    visible: false,
  },
  };

  const EXPRESSION_PATHS = {
    '{{$nPopupRecord.order_info.order_number}}': [
      '$nPopupRecord.order_info.order_number',
      'ctx.popup.record.order_info.order_number',
    ],
    '{{$nPopupRecord.customer.name}}': [
      '$nPopupRecord.customer.name',
      '$nPopupRecord.customer.nickname',
      '$nPopupRecord.customer.customer_name',
      'ctx.popup.record.customer.name',
      'ctx.popup.record.customer.nickname',
    'ctx.popup.record.customer.customer_name',
  ],
  '{{$nPopupRecord.customer.email}}': [
    '$nPopupRecord.customer.email',
    '$nPopupRecord.email',
    'ctx.popup.record.customer.email',
    'ctx.popup.record.email',
  ],
  '{{$nPopupRecord.email}}': [
    '$nPopupRecord.email',
    'ctx.popup.record.email',
    ],
    '{{$user.username}}': [
      '$user.username',
      'ctx.user.username',
    ],
    '{{$nPopupRecord.order_info.country_code}}': [
      '$nPopupRecord.order_info.country_code',
      'ctx.popup.record.order_info.country_code',
    ],
    '{{$nPopupRecord.order_info.model}}': [
      '$nPopupRecord.order_info.model',
      'ctx.popup.record.order_info.model',
    ],
  '{{$nPopupRecord.order_info.sku}}': [
    '$nPopupRecord.order_info.sku',
    '$nPopupRecord.order_info.sku_1',
    '$nPopupRecord.order_info.SKU',
    '$nPopupRecord.order_info.msku',
    '$nPopupRecord.order_info.seller_sku',
    'ctx.popup.record.order_info.sku',
    'ctx.popup.record.order_info.sku_1',
    'ctx.popup.record.order_info.SKU',
    'ctx.popup.record.order_info.msku',
    'ctx.popup.record.order_info.seller_sku',
  ],
  '{{$nPopupRecord.order_info.asin}}': [
    '$nPopupRecord.order_info.asin',
    '$nPopupRecord.order_info.ASIN',
    'ctx.popup.record.order_info.asin',
    'ctx.popup.record.order_info.ASIN',
  ],
  '{{$nPopupRecord.id}}': [
    '$nPopupRecord.id',
    'ctx.popup.record.id',
  ],
  '{{$nPopupRecord.ID}}': [
    '$nPopupRecord.ID',
    '$nPopupRecord.id',
    'ctx.popup.record.ID',
    'ctx.popup.record.id',
  ],
};

  const FIELD_ORDER = [
    'order_number',
    'customer_name',
    'email',
    'sales',
    'status',
    'reason',
    'country',
    'type',
    'state',
    'city',
    'address',
    'address2',
    'phone',
    'post_code',
    'sku',
    'accessories',
    'unique',
    'sending_method',
    'refund_type',
    'mark',
    'ticket_id',
  ];

  const VISIBLE_FIELD_ORDER = [
    'order_number',
    'customer_name',
    'email',
    'reason',
    'status',
    'sales',
    'country',
    'state',
    'city',
    'address',
    'address2',
    'phone',
    'post_code',
    'sku',
    'accessories',
  ];

  const FIELD_LAYOUT = {
    order_number: { column: '1', row: '1' },
    customer_name: { column: '2', row: '1' },
    email: { column: '3', row: '1' },
    reason: { column: '1', row: '2' },
    status: { column: '2', row: '2' },
    sales: { column: '3', row: '2' },
    country: { column: '1', row: '3' },
    state: { column: '2', row: '3' },
    city: { column: '3', row: '3' },
    address: { column: '1', row: '4' },
    address2: { column: '2', row: '4' },
    post_code: { column: '3', row: '4' },
    phone: { column: '1', row: '5' },
    sku: { column: '2', row: '5' },
    accessories: { column: '3', row: '5' },
  };

  const DEFAULT_FORM_VALUES = Object.fromEntries(
    FIELD_ORDER.map((fieldName) => {
      const rule = FIELD_VALUE_RULES[fieldName];
      return [fieldName, rule.mode === 'constant' ? rule.value : undefined];
    }),
  );

  function hasInitialPopupValues(values) {
    return !isEmpty(values.ticket_id)
      || !isEmpty(values.order_number)
      || !isEmpty(values.customer_name)
      || !isEmpty(values.email);
  }

  function apiRequest(options) {
    if (typeof ctx.request === 'function') return ctx.request(options);
    return ctx.api.request(options);
  }

  function toOptions(values) {
    return (values || []).map((value) => ({ label: value, value }));
  }

  function normalizeLanguage(value) {
    const text = String(value || '').trim().toLowerCase();
    if (!text) return undefined;
    if (text.startsWith('en') || text.includes('english')) return 'en';
    return 'zh';
  }

  function getCurrentLanguage() {
    const candidates = [
      ctx.i18n?.language,
      ctx.i18n?.resolvedLanguage,
      ctx.i18n?.options?.lng,
      ctx.i18n?.options?.fallbackLng,
    ];

    for (const candidate of candidates) {
      const language = normalizeLanguage(candidate);
      if (language) return language;
    }

    return 'zh';
  }

  function getText(language) {
    return TEXT_BY_LANGUAGE[language] || TEXT;
  }

  function getFieldLabel(fieldName, language) {
    const text = getText(language);
    const textKey = FIELD_TEXT_KEYS[fieldName] || fieldName;
    return text[textKey] || FIELD_VALUE_RULES[fieldName]?.label || fieldName;
  }

  function getOptionLabel(value, language) {
    if (language !== 'en') return value;
    const text = String(value || '');
    return ctx.t(text, { ns: 'lm-collections', defaultValue: text });
  }

  function toLocalizedOptions(values, language) {
    return (values || []).map((value) => ({
      label: getOptionLabel(value, language),
      value,
    }));
  }

  function localizeOption(option, language) {
    const label = String(option.label || '');
    const category = String(option.category || '');
    const localizedCategory = getOptionLabel(category, language);
    const localizedLabel = category && label.includes(category)
      ? label.split(category).join(localizedCategory)
      : getOptionLabel(label, language);

    return {
      ...option,
      label: language === 'en'
        ? localizedLabel.split('投影仪通用').join('Projector Universal')
        : localizedLabel,
    };
  }

  function getResponseRows(response) {
    const payload = response?.data;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data?.data)) return payload.data.data;
    return [];
  }

  function ensureCurrentOptions(options, value) {
    const optionMap = new Map((options || []).map((option) => [option.value, option]));
    const values = Array.isArray(value) ? value : [value];

    values
      .filter((item) => !isEmpty(item))
      .forEach((item) => {
        if (!optionMap.has(item)) optionMap.set(item, { label: item, value: item });
      });

    return Array.from(optionMap.values());
  }

  function normalizeLookupValue(value) {
    return String(value === undefined || value === null ? '' : value).trim();
  }

  function pickFirstText(...values) {
    for (const value of values) {
      const text = normalizeLookupValue(value);
      if (text) return text;
    }

    return undefined;
  }

  function mergeDefinedValues(base, next) {
    const merged = { ...base };

    for (const [key, value] of Object.entries(next || {})) {
      if (!isEmpty(value)) merged[key] = value;
    }

    return merged;
  }

  function fillEmptyValues(base, next) {
    const merged = { ...base };

    for (const [key, value] of Object.entries(next || {})) {
      if (isEmpty(merged[key]) && !isEmpty(value)) merged[key] = value;
    }

    return merged;
  }

  function isEmpty(value) {
    return value === undefined || value === null || value === '';
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function readExpression(expression) {
    const paths = EXPRESSION_PATHS[expression] || [];
    const candidates = [expression, ...paths];

    const values = await Promise.all(candidates.map(async (path) => {
      try {
        return await Promise.race([
          ctx.getVar(path),
          new Promise((resolve) => setTimeout(() => resolve(undefined), GET_VAR_TIMEOUT_MS)),
        ]);
      } catch (error) {
        // Keep the field empty when this exact NocoBase variable is unavailable.
        return undefined;
      }
    }));

    return values.find((value) => !isEmpty(value));
  }

  async function resolveValueRule(rule) {
    if (rule.mode === 'constant') return rule.value;
    if (rule.mode === 'expression') return readExpression(rule.expression);
    if (rule.mode === 'computed') return undefined;
    return undefined;
  }

  async function buildFieldValues() {
    const entries = await Promise.all(FIELD_ORDER.map(async (fieldName) => {
      const value = await resolveValueRule(FIELD_VALUE_RULES[fieldName]);
      return [fieldName, value];
    }));

    return Object.fromEntries(entries);
  }

  function toSubmitValues(values) {
    const submitValues = {};

    for (const fieldName of FIELD_ORDER) {
      if (!FIELD_VALUE_RULES[fieldName].sourceOnly) {
        submitValues[fieldName] = values[fieldName];
      }
    }

    return submitValues;
  }

function normalizeReason(reason) {
  if (Array.isArray(reason)) return reason.join(',');
  return reason || '';
}

function formatCreateMinuteKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
  ].join('');
}

function formatCreateDateKey(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('');
}

function buildUniqueValue(values) {
  const orderNumber = values.order_number || '';
  const reason = normalizeReason(values.reason);
  const type = values.type || '';
  return `${orderNumber}${reason}${type}${formatCreateMinuteKey()}`;
}

function getAccessoryCategory(accessoriesValue, options) {
  const matched = options.find((option) => option.value === accessoriesValue);
  return matched?.category || matched?.label || accessoriesValue || '';
}

function buildComputedSubmitValues(values, options) {
  const type = getAccessoryCategory(values.accessories, options);
  return {
    ...values,
    type,
    country_model_category: values.accessories,
  };
}

function buildAccessoriesDateValue(values, language) {
  const accessoryText = getOptionLabel(values.type || values.accessories, language);
  if (isEmpty(accessoryText)) return undefined;
  return `${accessoryText}_${formatCreateDateKey()}`;
}

function pickOrderSku(record) {
  return record?.sku || record?.sku_1 || record?.SKU || record?.msku || record?.seller_sku;
}

function parseAsinFromJoinedKey(value, countryCode) {
  const key = normalizeLookupValue(value);
  const country = normalizeLookupValue(countryCode);
  if (!key || !country || !key.includes('_')) return undefined;

  const parts = key.split('_').filter(Boolean);
  if (parts[0] === country) return parts.slice(1).join('_');
  if (parts[parts.length - 1] === country) return parts.slice(0, -1).join('_');
  return undefined;
}

function pickOrderAsin(record, countryCode) {
  const country = countryCode || record?.country_code || record?.country;
  return record?.asin
    || record?.ASIN
    || record?.order_asin
    || record?.product_asin
    || parseAsinFromJoinedKey(record?.asin_country_code, country)
    || parseAsinFromJoinedKey(record?.country_asin, country)
    || parseAsinFromJoinedKey(record?.unique, country);
}

function pickOwnerText(value) {
  if (Array.isArray(value)) return pickOwnerText(value[0]);
  if (value && typeof value === 'object') {
    return pickFirstText(value.username, value.nickname, value.name, value.email, value.id);
  }

  return pickFirstText(value);
}

function pickSaleOwner(row) {
  return pickOwnerText(row?.sale_owner)
    || pickOwnerText(row?.saleOwner)
    || pickOwnerText(row?.sales)
    || pickOwnerText(row?.owner);
}

function buildCountryAsinKey(countryCode, asin) {
  const country = normalizeLookupValue(countryCode);
  const asinCode = normalizeLookupValue(asin);
  if (!country || !asinCode) return '';
  return `${country}_${asinCode}`;
}

async function fetchSaleOwnerByFilter(filter) {
  const response = await apiRequest({
    method: 'get',
    url: '/asin:list',
    params: {
      filter,
      pageSize: 5,
    },
  });

  const rows = getResponseRows(response);
  const matched = rows.find((row) => !isEmpty(pickSaleOwner(row)));
  return pickSaleOwner(matched);
}

async function fetchSaleOwnerByCountryAsin(countryCode, asin) {
  const country = normalizeLookupValue(countryCode);
  const asinCode = normalizeLookupValue(asin);
  const countryAsinKey = buildCountryAsinKey(country, asinCode);
  if (!countryAsinKey) return undefined;

  const filters = [
    { unique: { $eq: countryAsinKey } },
    {
      $and: [
        { country: { $eq: country } },
        { asin: { $eq: asinCode } },
      ],
    },
  ];

  for (const filter of filters) {
    try {
      const saleOwner = await fetchSaleOwnerByFilter(filter);
      if (!isEmpty(saleOwner)) return saleOwner;
    } catch (error) {
      // Continue with the next filter shape when a collection index/key is unavailable.
    }
  }

  return undefined;
}

async function enrichSalesValue(values, orderRecord) {
  const countryCode = orderRecord?.country_code
    || orderRecord?.country
    || values.country
    || await readExpression('{{$nPopupRecord.order_info.country_code}}');
  const asin = values.order_asin
    || pickOrderAsin(orderRecord, countryCode)
    || await readExpression('{{$nPopupRecord.order_info.asin}}');
  if (!isEmpty(values.sales)) {
    return {
      ...values,
      order_asin: asin || values.order_asin,
    };
  }

  const saleOwner = await fetchSaleOwnerByCountryAsin(countryCode, asin);

  return {
    ...values,
    order_asin: asin || values.order_asin,
    sales: saleOwner || undefined,
  };
}

async function loadSalesOptions() {
  const users = [];
  const pageSize = 200;
  let page = 1;

  for (;;) {
    const response = await apiRequest({
      method: 'get',
      url: '/users:list',
      params: { page, pageSize },
    });
    const rows = getResponseRows(response);
    users.push(...rows);
    if (rows.length < pageSize || page >= 100) break;
    page += 1;
  }

  const options = users
    .map((user) => {
      const username = pickFirstText(user?.username);
      const displayName = pickFirstText(user?.nickname, user?.name);
      const email = pickFirstText(user?.email);
      const value = username || displayName || email || pickFirstText(user?.id);
      if (!value) return undefined;

      return {
        label: displayName && username && displayName !== username
          ? `${displayName} (${username})`
          : displayName || username || email || value,
        value,
      };
    })
    .filter(Boolean);

  return Array.from(new Map(options.map((option) => [option.value, option])).values());
}

async function readCustomerEmail(values) {
  if (!isEmpty(values.email)) return values.email;
  return readExpression('{{$nPopupRecord.customer.email}}');
}

async function updateCustomerName(values) {
  const name = values.customer_name;
  if (isEmpty(name)) return;

  const email = await readCustomerEmail(values);
  if (isEmpty(email)) return;

  await apiRequest({
    method: 'post',
    url: `/customer:update?filterByTk=${encodeURIComponent(email)}`,
    data: {
      name,
    },
  });
}

async function readPopupRecordId(values) {
  if (!isEmpty(values.ticket_id)) return values.ticket_id;
  return readExpression('{{$nPopupRecord.ID}}');
}

async function fetchOrderRecord(orderNumber) {
  if (isEmpty(orderNumber)) return undefined;

  const response = await apiRequest({
    method: 'get',
    url: `/order_list:get?filterByTk=${encodeURIComponent(orderNumber)}`,
  });

  const payload = response?.data;
  const record = Object.prototype.hasOwnProperty.call(payload || {}, 'data')
    ? payload.data
    : payload;

  return isEmpty(record) ? undefined : record;
}

async function ensureOrderExists(orderNumber) {
  return !isEmpty(await fetchOrderRecord(orderNumber));
}

async function enrichOrderValues(values) {
  if (isEmpty(values.order_number)) return values;

  const orderRecord = await fetchOrderRecord(values.order_number);
  if (isEmpty(orderRecord)) return values;

  return {
    ...values,
    country: values.country || orderRecord.country_code || orderRecord.country,
    sku: values.sku || pickOrderSku(orderRecord),
    order_asin: values.order_asin || pickOrderAsin(orderRecord, values.country || orderRecord.country_code || orderRecord.country),
  };
}

async function updatePopupOrderNumber(values, initialValues) {
  if (!isEmpty(initialValues.order_number)) return;
  if (isEmpty(values.order_number)) return;

  const recordId = await readPopupRecordId(values);
  if (isEmpty(recordId)) return;

  await apiRequest({
    method: 'post',
    url: `/ticket:update?filterByTk=${encodeURIComponent(recordId)}`,
    data: {
      order_number: values.order_number,
    },
  });
}

function closeCurrentPopup(rootElement) {
  if (typeof ctx.view?.close === 'function') {
    ctx.view.close();
    return true;
  }

  if (typeof ctx.popup?.close === 'function') {
    ctx.popup.close();
    return true;
  }

  if (typeof ctx.popup?.destroy === 'function') {
    ctx.popup.destroy();
    return true;
  }

  const currentPopup = rootElement?.closest?.(
    '.ant-modal-content, .ant-modal, .ant-modal-wrap, .ant-drawer-content, .ant-drawer',
  );
  const closeButton = currentPopup?.querySelector?.(
    '.ant-modal-close, .ant-drawer-close, button[aria-label="Close"]',
  );
  if (closeButton) {
    closeButton.click();
    return true;
  }

  return false;
}

async function refreshTargetBlock() {
  const targetBlock = typeof ctx.getModel === 'function'
    ? ctx.getModel(REFRESH_BLOCK_UID, true)
    : undefined;

  if (targetBlock?.resource?.refresh) {
    await targetBlock.resource.refresh();
    return true;
  }

  if (targetBlock?.rerender) {
    targetBlock.rerender();
    return true;
  }

  if (ctx.resource?.refresh) {
    await ctx.resource.refresh();
    return true;
  }

  return false;
}

  async function resolveFilterValue(value) {
    if (typeof value !== 'string' || !value.startsWith('{{')) return value;
    return readExpression(value);
  }

  async function buildAccessoriesFilter(countryValue) {
    const countryCode = countryValue || await resolveFilterValue('{{$nPopupRecord.order_info.country_code}}');
    const model = await resolveFilterValue('{{$nPopupRecord.order_info.model}}');

    return {
      $and: [
        { country: { $eq: countryCode } },
        {
          $or: [
            { model: { $eq: model } },
            { model: { $includes: '通用' } },
          ],
        },
      ],
    };
  }

  async function loadAccessoriesOptions(countryValue) {
    const filter = await buildAccessoriesFilter(countryValue);
    const response = await apiRequest({
      method: 'get',
      url: '/accessory_sku:list',
      params: {
        filter,
        pageSize: 200,
      },
    });

    const rows = response?.data?.data || response?.data || [];
    const options = rows
      .map((row) => ({
        label: row[ACCESSORIES_FIELD_NAMES.label] || row[ACCESSORIES_FIELD_NAMES.value],
        value: row[ACCESSORIES_FIELD_NAMES.value],
        category: row.category,
      }))
      .filter((option) => !isEmpty(option.label) && !isEmpty(option.value));

    return Array.from(
      new Map(options.map((option) => [option.value, option])).values(),
    );
  }

function FieldControl({ field, accessoriesOptions, salesOptions, value, onChange, onBlur, initialValue, language }) {
    const disabled = field.readOnly === true || (field.readOnlyWhenInitialFilled === true && !isEmpty(initialValue));

    if (disabled) {
      const values = Array.isArray(value) ? value : [value];
      const displayValues = values.filter((item) => !isEmpty(item));

      if (field.component === 'Select') {
        return (
          <div style={{ minHeight: 32, paddingTop: 4 }}>
            {displayValues.map((item) => (
              <Tag key={item} color="blue" style={{ marginBottom: 4 }}>
                {getOptionLabel(item, language)}
              </Tag>
            ))}
          </div>
        );
      }

      return (
        <Typography.Text style={{ display: 'block', minHeight: 32, paddingTop: 5 }}>
          {displayValues[0] || ''}
        </Typography.Text>
      );
    }

    if (field.component === 'Select') {
      const options = field.name === 'accessories'
        ? accessoriesOptions.map((option) => localizeOption(option, language))
        : field.name === 'sales'
          ? ensureCurrentOptions(salesOptions, value)
          : toLocalizedOptions(field.options, language);

      return (
        <Select
          allowClear
          mode={field.selectMode}
          value={value}
          onChange={onChange}
          options={options}
          showSearch={field.showSearch}
          optionFilterProp="label"
          placeholder=""
          style={{ width: '100%' }}
        />
      );
    }

  return (
    <Input
      disabled={disabled}
      value={value}
      onBlur={onBlur}
      onChange={(event) => onChange(event.target.value)}
    />
  );
}

  function ReissueForm() {
    const [language, setLanguage] = React.useState(getCurrentLanguage);
    const [formValues, setFormValues] = React.useState(DEFAULT_FORM_VALUES);
  const [initialFormValues, setInitialFormValues] = React.useState(DEFAULT_FORM_VALUES);
  const [submitting, setSubmitting] = React.useState(false);
  const [loadingValues, setLoadingValues] = React.useState(true);
  const [accessoriesOptions, setAccessoriesOptions] = React.useState([]);
  const [salesOptions, setSalesOptions] = React.useState([]);
  const [salesAutoMatched, setSalesAutoMatched] = React.useState(false);
  const formRootRef = React.useRef(null);
  const orderEnrichKeyRef = React.useRef('');
  const salesLookupKeyRef = React.useRef('');
  const uiText = getText(language);
  const [orderNumberStatus, setOrderNumberStatus] = React.useState({
    checkedValue: undefined,
    exists: undefined,
    checking: false,
  });

  function setFieldValue(fieldName, value) {
    setFormValues((current) => {
      const next = {
        ...current,
        [fieldName]: value,
      };

      if (fieldName === 'order_number') {
        next.sales = undefined;
        next.order_asin = undefined;
      }

      return next;
    });

    if (fieldName === 'order_number') {
      setSalesAutoMatched(false);
      setOrderNumberStatus({
        checkedValue: undefined,
        exists: undefined,
        checking: false,
      });
    }
  }

  async function validateOrderNumberOnBlur() {
    const orderNumber = formValues.order_number;
    if (isEmpty(orderNumber)) return;

    setOrderNumberStatus({
      checkedValue: orderNumber,
      exists: undefined,
      checking: true,
    });

    try {
      const orderRecord = await fetchOrderRecord(orderNumber);
      const exists = !isEmpty(orderRecord);
      setOrderNumberStatus({
        checkedValue: orderNumber,
        exists,
        checking: false,
      });
      if (!exists) message.error(uiText.orderNotFound);
      if (exists) {
        const nextValues = {
          ...formValues,
          country: orderRecord.country_code || orderRecord.country || formValues.country,
          sku: pickOrderSku(orderRecord) || formValues.sku,
          order_asin: pickOrderAsin(orderRecord, orderRecord.country_code || orderRecord.country || formValues.country) || formValues.order_asin,
        };
        setSalesAutoMatched(false);
        setFormValues((current) => ({
          ...current,
          country: nextValues.country || current.country,
          sku: nextValues.sku || current.sku,
          order_asin: nextValues.order_asin || current.order_asin,
          sales: current.sales,
        }));
      }
    } catch (error) {
      setOrderNumberStatus({
        checkedValue: orderNumber,
        exists: false,
        checking: false,
      });
      message.error(error?.message || uiText.orderNotFound);
    }
  }

    React.useEffect(() => {
      const syncLanguage = () => {
        setLanguage((current) => {
          const next = getCurrentLanguage();
          return next === current ? current : next;
        });
      };
      const i18n = ctx.i18n;
      const timer = setInterval(syncLanguage, 1000);

      syncLanguage();
      if (i18n?.on) i18n.on('languageChanged', syncLanguage);

      return () => {
        clearInterval(timer);
        if (i18n?.off) i18n.off('languageChanged', syncLanguage);
      };
    }, []);

    React.useEffect(() => {
      let mounted = true;

      async function refreshOrderValues() {
        if (loadingValues || isEmpty(formValues.order_number)) return;
        if (!isEmpty(formValues.country) && !isEmpty(formValues.sku) && !isEmpty(formValues.order_asin)) return;
        if (orderEnrichKeyRef.current === formValues.order_number) return;
        orderEnrichKeyRef.current = formValues.order_number;

        try {
          const orderRecord = await fetchOrderRecord(formValues.order_number);
          if (!mounted || isEmpty(orderRecord)) return;

          const nextValues = {
            country: orderRecord.country_code || orderRecord.country,
            sku: pickOrderSku(orderRecord),
            order_asin: pickOrderAsin(orderRecord, orderRecord.country_code || orderRecord.country || formValues.country),
          };

          setInitialFormValues((current) => fillEmptyValues(current, nextValues));
          setFormValues((current) => fillEmptyValues(current, nextValues));
        } catch (error) {
          // The order number itself remains editable/validated by the submit and blur flows.
        }
      }

      refreshOrderValues();

      return () => {
        mounted = false;
      };
    }, [
      loadingValues,
      formValues.country,
      formValues.order_asin,
      formValues.order_number,
      formValues.sku,
    ]);

    React.useEffect(() => {
      let mounted = true;

      async function refreshSalesOwner() {
        if (loadingValues || !isEmpty(formValues.sales)) return;

        const lookupKey = [
          formValues.country || '',
          formValues.order_asin || '',
          formValues.order_number || '',
          formValues.sku || '',
        ].join('|');
        if (lookupKey === salesLookupKeyRef.current) return;
        salesLookupKeyRef.current = lookupKey;

        try {
          const nextValues = await enrichSalesValue(formValues);
          if (!mounted || isEmpty(nextValues.sales)) return;

          setSalesAutoMatched(true);
          setInitialFormValues((current) => fillEmptyValues(current, nextValues));
          setFormValues((current) => (
            isEmpty(current.sales)
              ? {
                ...current,
                order_asin: nextValues.order_asin || current.order_asin,
                sales: nextValues.sales,
              }
              : current
          ));
        } catch (error) {
          // Keep the sales field selectable when the automatic owner lookup is unavailable.
        }
      }

      refreshSalesOwner();

      return () => {
        mounted = false;
      };
    }, [
      loadingValues,
      formValues.country,
      formValues.order_asin,
      formValues.order_number,
      formValues.sales,
      formValues.sku,
    ]);

    React.useEffect(() => {
      let mounted = true;

      async function refreshSalesOptions() {
        try {
          const options = await loadSalesOptions();
          if (mounted) setSalesOptions(options);
        } catch (error) {
          if (mounted) setSalesOptions([]);
        }
      }

      refreshSalesOptions();

      return () => {
        mounted = false;
      };
    }, []);

    React.useEffect(() => {
      let mounted = true;
      const retryDelays = [0, 120, 240, 480, 800, 1200];

      async function initialize() {
        if (mounted) setFormValues(DEFAULT_FORM_VALUES);

        let resolvedValues = DEFAULT_FORM_VALUES;

        for (let index = 0; index < retryDelays.length && mounted; index += 1) {
          if (retryDelays[index] > 0) await wait(retryDelays[index]);

          const values = await buildFieldValues();
          const baseValues = index === 0
            ? mergeDefinedValues(DEFAULT_FORM_VALUES, values)
            : fillEmptyValues(resolvedValues, values);
          const nextValues = baseValues;
          resolvedValues = index === 0
            ? nextValues
            : fillEmptyValues(resolvedValues, nextValues);

          if (mounted) {
            setInitialFormValues((current) => (index === 0
              ? resolvedValues
              : fillEmptyValues(current, nextValues)));
            setFormValues((current) => (index === 0
              ? resolvedValues
              : fillEmptyValues(current, nextValues)));
          }

          if (hasInitialPopupValues(resolvedValues)) break;
        }

        if (mounted) {
          let hydratedValues = resolvedValues;
          let salesMatched = false;

          try {
            const salesValues = await enrichSalesValue(hydratedValues);
            salesMatched = isEmpty(hydratedValues.sales) && !isEmpty(salesValues.sales);
            hydratedValues = fillEmptyValues(hydratedValues, salesValues);

            const needsOrderRecord = !isEmpty(hydratedValues.order_number)
              && (
                isEmpty(hydratedValues.country)
                || isEmpty(hydratedValues.sku)
                || (isEmpty(hydratedValues.sales) && isEmpty(hydratedValues.order_asin))
              );

            if (needsOrderRecord) {
              const orderRecord = await fetchOrderRecord(hydratedValues.order_number);

              if (!isEmpty(orderRecord)) {
                const orderValues = {
                  country: orderRecord.country_code || orderRecord.country,
                  sku: pickOrderSku(orderRecord),
                  order_asin: pickOrderAsin(
                    orderRecord,
                    hydratedValues.country || orderRecord.country_code || orderRecord.country,
                  ),
                };
                hydratedValues = fillEmptyValues(hydratedValues, orderValues);

                if (isEmpty(hydratedValues.sales)) {
                  const orderSalesValues = await enrichSalesValue(hydratedValues, orderRecord);
                  salesMatched = isEmpty(hydratedValues.sales) && !isEmpty(orderSalesValues.sales);
                  hydratedValues = fillEmptyValues(hydratedValues, orderSalesValues);
                }
              }
            }
          } catch (error) {
            // Keep showing the form if the optional order/sales lookup is unavailable.
          }

          resolvedValues = hydratedValues;
          salesLookupKeyRef.current = [
            resolvedValues.country || '',
            resolvedValues.order_asin || '',
            resolvedValues.order_number || '',
            resolvedValues.sku || '',
          ].join('|');

          setInitialFormValues((current) => fillEmptyValues(current, resolvedValues));
          setFormValues((current) => fillEmptyValues(current, resolvedValues));
          setSalesAutoMatched(salesMatched);
          setLoadingValues(false);
        }
      }

      initialize();

      return () => {
        mounted = false;
      };
    }, []);

    React.useEffect(() => {
      let mounted = true;

      async function refreshAccessories() {
        try {
          const options = await loadAccessoriesOptions(formValues.country);
          if (mounted) setAccessoriesOptions(options);
        } catch (error) {
          if (mounted) setAccessoriesOptions([]);
        }
      }

      refreshAccessories();

      return () => {
        mounted = false;
      };
    }, [formValues.country]);

    async function handleSubmit() {
      const missingField = VISIBLE_FIELD_ORDER
        .find((fieldName) => {
          const field = FIELD_VALUE_RULES[fieldName];
          return field.required && isEmpty(formValues[fieldName]);
        });

      if (missingField) {
        message.error(`${uiText.requiredPrefix}${getFieldLabel(missingField, language)}`);
        return;
      }

    setSubmitting(true);

    try {
      const schemaValues = await buildFieldValues();
      const resolvedValues = mergeDefinedValues(schemaValues, formValues);
      const orderExists =
        orderNumberStatus.checkedValue === resolvedValues.order_number &&
        orderNumberStatus.exists === true
          ? true
          : await ensureOrderExists(resolvedValues.order_number);
      if (!orderExists) {
        message.error(uiText.orderNotFound);
        setSubmitting(false);
        return;
      }

      await updatePopupOrderNumber(
        resolvedValues,
        initialFormValues,
      );
      const submitValues = buildComputedSubmitValues({
        ...mergeDefinedValues(DEFAULT_FORM_VALUES, schemaValues),
        ...toSubmitValues(formValues),
      }, accessoriesOptions);
      submitValues.accessories_date = buildAccessoriesDateValue(submitValues, language);
      submitValues.unique = buildUniqueValue(submitValues);

        await apiRequest({
          method: 'post',
          url: '/refund:create',
        data: {
          ...submitValues,
          formUid: FORM_UID,
          formBlockUid: NOCOBASE_FORM_BLOCK_UID,
        },
      });
      await updateCustomerName(formValues);
      await refreshTargetBlock();
      message.success(uiText.submitSuccess);
      setTimeout(() => closeCurrentPopup(formRootRef.current), 200);
    } catch (error) {
        message.error(error?.message || uiText.submitFailed);
      } finally {
        setSubmitting(false);
      }
    }

    return (
      <div ref={formRootRef} style={{ padding: 16 }}>
        {loadingValues ? (
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'center',
              minHeight: 320,
            }}
          >
            <Spin />
          </div>
        ) : (
        <Space direction="vertical" size={12} style={{ width: '100%' }}>
          <Form
            layout="vertical"
            onFinish={handleSubmit}
          >
            <div
              style={{
                display: 'grid',
                gap: '10px 12px',
                gridTemplateColumns: '1fr 1fr 1fr',
              }}
            >
              {VISIBLE_FIELD_ORDER.map((fieldName) => {
                const field = { ...FIELD_VALUE_RULES[fieldName], name: fieldName };
                if (fieldName === 'sales' && salesAutoMatched) field.readOnly = true;
                const layout = FIELD_LAYOUT[fieldName] || {};
                return (
                <Form.Item
                  key={fieldName}
                  label={getFieldLabel(fieldName, language)}
                  required={field.required}
                  validateStatus={
                    fieldName === 'order_number' && orderNumberStatus.exists === false
                      ? 'error'
                      : undefined
                  }
                  help={
                    fieldName === 'order_number' && orderNumberStatus.exists === false
                      ? uiText.orderNotFound
                      : undefined
                  }
                  style={{
                    gridColumn: layout.column,
                    gridRow: layout.row,
                      marginBottom: 0,
                    }}
                  >
                    <FieldControl
                      field={field}
                    language={language}
                    accessoriesOptions={accessoriesOptions}
                    salesOptions={salesOptions}
                    value={formValues[fieldName]}
                    initialValue={initialFormValues[fieldName]}
                    onBlur={fieldName === 'order_number' ? validateOrderNumberOnBlur : undefined}
                    onChange={(value) => setFieldValue(fieldName, value)}
                  />
                </Form.Item>
                );
              })}
            </div>

            <Form.Item
              label={uiText.mark}
              required={FIELD_VALUE_RULES.mark.required}
              style={{ marginTop: 10, marginBottom: 14 }}
            >
              <Input.TextArea
                autoSize={{ minRows: 6 }}
                value={formValues.mark}
                onChange={(event) => setFieldValue('mark', event.target.value)}
              />
            </Form.Item>

            <div style={{ marginTop: 14 }}>
              <Button type="primary" htmlType="submit" loading={submitting || loadingValues}>
                {uiText.submit}
              </Button>
            </div>
          </Form>
        </Space>
        )}
      </div>
    );
  }

  ctx.render(<ReissueForm />);
