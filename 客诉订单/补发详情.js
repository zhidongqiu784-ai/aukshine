const React = ctx.libs.React;
const {
  Button,
  Form,
  Input,
  Select,
  Space,
  Spin,
  Tag,
  Typography,
  message,
} = ctx.libs.antd;

const REFRESH_BLOCK_UID = '870crh7hd7m';
const EDITABLE_STATUS = '需发送';
const SUBMITTED_STATUS = '已提交';
const COMPLETED_STATUS = '已完成';

const TEXT = {
  orderNumber: '订单号',
  customerName: '客户姓名',
  email: '邮箱',
  sales: '销售',
  status: '状态',
  reason: '详细原因',
  country: '国家',
  address: '地址1',
  address2: '地址2',
  state: '州/省',
  city: '城市',
  phone: '手机号',
  postCode: '邮编',
  sku: 'SKU',
  accessories: '配件',
  logisticsNumber: '运单号',
  trackingNo: '跟踪号',
  mark: '备注',
  orderInfo: '订单信息',
  addressInfo: '地址信息',
  reissueInfo: '补发信息',
  logisticsInfo: '物流信息',
  save: '保存',
  saveSuccess: '保存成功',
  saveFailed: '保存失败',
  loading: '加载中...',
  noRecord: '未找到当前返款单',
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
  address: 'Address 1',
  address2: 'Address 2',
  state: 'State / Province',
  city: 'City',
  phone: 'Phone',
  postCode: 'Post Code',
  sku: 'SKU',
  accessories: 'Accessories',
  logisticsNumber: 'Logistics No.',
  trackingNo: 'Tracking No.',
  mark: 'Remark',
  orderInfo: 'Order Information',
  addressInfo: 'Address Information',
  reissueInfo: 'Reissue Information',
  logisticsInfo: 'Logistics Information',
  save: 'Save',
  saveSuccess: 'Saved successfully',
  saveFailed: 'Save failed',
  loading: 'Loading...',
  noRecord: 'No refund record found.',
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
  reason: 'reason',
  status: 'status',
  sales: 'sales',
  country: 'country',
  state: 'state',
  city: 'city',
  address: 'address',
  address2: 'address2',
  phone: 'phone',
  post_code: 'postCode',
  sku: 'sku',
  accessories: 'accessories',
  logistics_number: 'logisticsNumber',
  tracking_no: 'trackingNo',
  mark: 'mark',
};

const OPTION_LABELS_EN = {
  待确认: 'Pending Confirmation',
  需发送: 'Need to Send',
  已提交: 'Submitted',
  已完成: 'Completed',
  搁置: 'On Hold',
  驳回: 'Rejected',
  评论审核中: 'Review in Progress',
  待确认支付信息: 'Pending Payment Info',
  待检查review: 'Pending Review Check',
  待上传物流单: 'Pending Tracking Upload',
  待物流信息更新: 'Pending Logistics Update',
  邀评: 'Review Invitation',
  测评: 'Review Order',
  '客诉/差评补偿': 'Complaint / Negative Review Compensation',
  佣金: 'Commission',
  直评: 'Direct Review',
  留Feedback: 'Leave Feedback',
  '免评/取消单': 'No Review / Cancel Order',
  秒杀进度条: 'Deal Progress Bar',
  混秒: 'Mixed Deal',
  查差评邮箱: 'Find Negative Review Email',
  踩差评: 'Downvote Negative Review',
  '加购/心愿单': 'Add to Cart / Wishlist',
  QA: 'QA',
  '站外推广（需备注）': 'Off-site Promotion (Remark Required)',
  '追加返款（需备注）': 'Additional Refund (Remark Required)',
  '其他（需备注）': 'Other (Remark Required)',
  投影仪本体: 'Projector Body',
  投影仪通用: 'Projector Universal',
  投影仪: 'Projector',
  通用: 'Universal',
  通用支架: 'Universal Stand',
  电源线: 'Power Cable',
  HDMI线: 'HDMI Cable',
  便携背带: 'Portable Strap',
  螺丝: 'Screws',
  说明书: 'Manual',
  调焦齿轮: 'Focus Gear',
  适配器: 'Adapter',
  防尘网: 'Dust Filter',
  防滑底垫: 'Anti-slip Bottom Pad',
  镜头盖: 'Lens Cover',
  折叠支架: 'Foldable Stand',
  幕布: 'Projection Screen',
  相机支架: 'Camera Stand',
  遥控器: 'Remote Control',
  补发: 'Reissue',
  换货: 'Exchange',
};

const FIELD_ORDER = [
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
  'logistics_number',
  'tracking_no',
  'created_at',
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
  logistics_number: { column: '1', row: '6' },
  tracking_no: { column: '2', row: '6' },
  created_at: { column: '3', row: '6' },
};

const SHIPMENT_VISIBLE_FIELDS = new Set(['logistics_number', 'tracking_no']);
const SELECT_FIELDS = new Set(['reason', 'status', 'country', 'accessories']);
const EDITABLE_FIELDS = new Set([
  'country',
  'state',
  'city',
  'address',
  'address2',
  'phone',
  'post_code',
  'accessories',
  'mark',
]);
const READ_ONLY_FIELDS = new Set(['email', 'reason', 'status', 'sales']);
const COUNTRY_OPTIONS = ['US', 'CA', 'JP', 'FR', 'DE', 'ES', 'IT', 'UK', 'CH'];
const REQUIRED_FIELDS = new Set([
  'order_number',
  'customer_name',
  'country',
  'city',
  'address',
  'accessories',
]);

const DETAIL_SECTIONS = [
  {
    titleKey: 'orderInfo',
    fields: [
      'order_number',
      'customer_name',
      'email',
      'status',
      'sales',
      'reason',
      'sku',
      'accessories',
      'created_at',
    ],
  },
  {
    titleKey: 'addressInfo',
    fields: ['country', 'state', 'city', 'address', 'address2', 'post_code', 'phone'],
  },
  {
    titleKey: 'logisticsInfo',
    fields: ['logistics_number', 'tracking_no'],
  },
];

function apiRequest(options) {
  if (typeof ctx.request === 'function') return ctx.request(options);
  return ctx.api.request(options);
}

function isEmpty(value) {
  return value === undefined || value === null || value === '';
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
  if (fieldName === 'created_at') {
    return language === 'en' ? 'Created At' : '创建时间';
  }

  const text = getText(language);
  return text[FIELD_TEXT_KEYS[fieldName]] || fieldName;
}

function getOptionLabel(value, language) {
  if (language !== 'en') return value;
  const exactLabel = OPTION_LABELS_EN[value];
  if (exactLabel) return exactLabel;

  return Object.keys(OPTION_LABELS_EN)
    .sort((left, right) => right.length - left.length)
    .reduce(
      (label, optionText) => label.split(optionText).join(OPTION_LABELS_EN[optionText]),
      String(value || ''),
    );
}

function localizeOption(option, language) {
  return {
    ...option,
    label: getOptionLabel(option.label, language),
  };
}

async function readVar(paths) {
  for (const path of paths) {
    try {
      const value = await Promise.race([
        ctx.getVar(path),
        new Promise((resolve) => setTimeout(() => resolve(undefined), 500)),
      ]);
      if (!isEmpty(value)) return value;
    } catch (error) {
      // Try the next possible NocoBase record path.
    }
  }

  return undefined;
}

async function readCurrentRecord() {
  const record = await readVar([
    'ctx.popup.record',
    '$nPopupRecord',
    '$nRecord',
    'ctx.record',
    'ctx.record.data',
    'ctx.inputArgs.record',
    'ctx.inputArgs.data',
    'ctx.inputArgs.values',
    'ctx.popup.parent.record',
  ]);

  if (record && typeof record === 'object') return unwrapRecord(record);
  if (ctx.record && typeof ctx.record === 'object') return ctx.record;
  return undefined;
}

function unwrapRecord(record) {
  if (record?.data && typeof record.data === 'object') return record.data;
  if (record?.record && typeof record.record === 'object') return record.record;
  return record;
}

function pick(record, keys) {
  for (const key of keys) {
    const value = key.split('.').reduce(
      (current, part) => (current == null ? undefined : current[part]),
      record,
    );
    if (!isEmpty(value)) return value;
  }

  return undefined;
}

function normalizeReason(reason) {
  if (Array.isArray(reason)) return reason;
  if (typeof reason === 'string' && reason.includes(',')) {
    return reason.split(',').map((item) => item.trim()).filter(Boolean);
  }
  return isEmpty(reason) ? undefined : [reason];
}

function normalizeSingleValue(value) {
  if (Array.isArray(value)) {
    for (const item of value) {
      const normalized = normalizeSingleValue(item);
      if (!isEmpty(normalized)) return normalized;
    }
    return undefined;
  }
  if (value && typeof value === 'object') {
    return pick(value, ['country_model_category', 'value', 'name', 'category', 'label', 'id']);
  }
  return value;
}

function normalizeDateTimeValue(value) {
  if (isEmpty(value)) return undefined;
  if (value instanceof Date || typeof value !== 'object') return value;
  return pick(value, ['value', 'date', 'datetime', 'created_at']) || value;
}

function formatDateTime(value) {
  const normalized = normalizeDateTimeValue(value);
  if (isEmpty(normalized)) return '';

  const date = normalized instanceof Date ? normalized : new Date(normalized);
  if (Number.isNaN(date.getTime())) return String(normalized);

  const pad = (number) => String(number).padStart(2, '0');
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join('-') + ' ' + [
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join(':');
}

function normalizeRecord(record) {
  const source = unwrapRecord(record);
  return {
    id: pick(source, ['id', 'ID', 'filterByTk', '__primaryKey']),
    unique: pick(source, ['unique']),
    order_number: pick(source, ['order_number', 'order_info.order_number']),
    customer_name: pick(source, ['customer_name', 'customer.name', 'name']),
    email: pick(source, ['email', 'customer.email']),
    reason: normalizeReason(pick(source, ['reason'])),
    status: pick(source, ['status']),
    sales: pick(source, ['sales']),
    country: pick(source, ['country', 'order_info.country_code']),
    state: pick(source, ['state']),
    city: pick(source, ['city']),
    address: pick(source, ['address']),
    address2: pick(source, ['address2']),
    phone: pick(source, ['phone']),
    post_code: pick(source, ['post_code']),
    sku: pick(source, ['sku', 'sku_1', 'SKU', 'msku', 'seller_sku', 'order_info.sku', 'order_info.sku_1', 'order_info.SKU', 'order_info.msku', 'order_info.seller_sku']),
    accessories: normalizeSingleValue(pick(source, [
      'country_model_category',
      'accessories',
      'accessory',
      'accessories.country_model_category',
      'accessories.value',
      'accessories.label',
    ])),
    logistics_number: pick(source, ['logistics_number']),
    tracking_no: pick(source, ['tracking_no']),
    created_at: normalizeDateTimeValue(pick(source, [
      'created_at',
      'created_at.value',
      'created_at.date',
      'refund.created_at',
      'refund.created_at.value',
      'refund.created_at.date',
    ])),
    type: pick(source, ['type']),
    model: pick(source, ['model', 'order_info.model']),
    mark: pick(source, ['mark']),
  };
}

async function fetchRefundRecord(recordId) {
  if (isEmpty(recordId)) return undefined;

  const response = await apiRequest({
    method: 'get',
    url: `/refund:get?filterByTk=${encodeURIComponent(recordId)}&_t=${Date.now()}`,
  });

  const payload = response?.data;
  const record = Object.prototype.hasOwnProperty.call(payload || {}, 'data')
    ? payload.data
    : payload;

  return record && typeof record === 'object' ? record : undefined;
}

async function fetchRefundRecordByOrderNumber(orderNumber) {
  if (isEmpty(orderNumber)) return undefined;

  const response = await apiRequest({
    method: 'get',
    url: '/refund:list',
    params: {
      filter: {
        order_number: {
          $eq: orderNumber,
        },
      },
      pageSize: 1,
    },
  });

  const rows = response?.data?.data || response?.data || [];
  return Array.isArray(rows) ? rows[0] : undefined;
}

async function fetchRefundCreatedAtByUnique(unique) {
  if (isEmpty(unique)) return undefined;

  try {
    const response = await apiRequest({
      method: 'get',
      url: `/refund:get?filterByTk=${encodeURIComponent(unique)}&fields=created_at&_t=${Date.now()}`,
    });

    const payload = response?.data;
    const record = Object.prototype.hasOwnProperty.call(payload || {}, 'data')
      ? payload.data
      : payload;

    return normalizeDateTimeValue(pick(record || {}, [
      'created_at',
      'created_at.value',
      'created_at.date',
    ]));
  } catch (error) {
    return undefined;
  }
}

async function fetchRefundRecordByUniqueCandidate(values, accessoriesOptions) {
  const unique = values.unique || buildUniqueValue(values, accessoriesOptions);
  return fetchRefundRecord(unique);
}

async function fetchCustomerRecord(email) {
  if (isEmpty(email)) return undefined;

  const response = await apiRequest({
    method: 'get',
    url: `/customer:get?filterByTk=${encodeURIComponent(email)}`,
  });

  const payload = response?.data;
  const record = Object.prototype.hasOwnProperty.call(payload || {}, 'data')
    ? payload.data
    : payload;

  return record && typeof record === 'object' ? record : undefined;
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

  return record && typeof record === 'object' ? record : undefined;
}

async function enrichOrderInfo(values) {
  if (!isEmpty(values.model) && !isEmpty(values.country)) return values;

  const order = await fetchOrderRecord(values.order_number);
  if (!order) return values;

  return {
    ...values,
    country: values.country || pick(order, ['country_code', 'country']),
    model: values.model || pick(order, ['model']),
    sku: values.sku || pick(order, ['sku', 'sku_1', 'SKU', 'msku', 'seller_sku']),
  };
}

async function enrichCustomerName(values) {
  if (!isEmpty(values.customer_name)) return values;

  const customer = await fetchCustomerRecord(values.email);
  const name = pick(customer || {}, ['name', 'nickname', 'customer_name']);

  return isEmpty(name)
    ? values
    : {
      ...values,
      customer_name: name,
    };
}

async function buildAccessoriesFilter(values) {
  return {
    $and: [
      { country: { $eq: values.country } },
      {
        $or: [
          { model: { $eq: values.model } },
          { model: { $includes: '通用' } },
        ],
      },
    ],
  };
}

async function loadAccessoriesOptions(values) {
  if (isEmpty(values.country)) return [];

  const response = await apiRequest({
    method: 'get',
    url: '/accessory_sku:list',
    params: {
      filter: await buildAccessoriesFilter(values),
      pageSize: 200,
    },
  });

  const rows = response?.data?.data || response?.data || [];
  const options = rows
    .map((row) => ({
      label: row.country_model_category,
      value: row.country_model_category,
      category: row.category,
    }))
    .filter((option) => !isEmpty(option.label) && !isEmpty(option.value));

  return Array.from(new Map(options.map((option) => [option.value, option])).values());
}

function getAccessoryCategory(accessoriesValue, options) {
  const matched = options.find((option) => option.value === accessoriesValue);
  return matched?.category || accessoriesValue || '';
}

function normalizeReasonText(reason) {
  if (Array.isArray(reason)) return reason.join(',');
  return reason || '';
}

function buildUniqueValue(values, accessoriesOptions) {
  const orderNumber = values.order_number || '';
  const reason = normalizeReasonText(values.reason);
  const type = getAccessoryCategory(values.accessories, accessoriesOptions);
  return `${orderNumber}${reason}${type}`;
}

function withCurrentAccessoryOption(options, values) {
  if (isEmpty(values.accessories)) return options;
  if (options.some((option) => option.value === values.accessories)) return options;

  return [
    {
      label: values.accessories,
      value: values.accessories,
      category: values.type || values.accessories,
    },
    ...options,
  ];
}

function inferAccessoryFromType(options, values) {
  if (!isEmpty(values.accessories) || isEmpty(values.type)) return undefined;

  const matchedOptions = options.filter((option) => (
    option.category === values.type ||
    option.value === values.type ||
    String(option.value || '').includes(values.type) ||
    String(option.label || '').includes(values.type)
  ));

  return matchedOptions.length === 1 ? matchedOptions[0].value : undefined;
}

function isFieldEditable(fieldName, values, initialValues) {
  if (values.status !== EDITABLE_STATUS) return false;
  if (READ_ONLY_FIELDS.has(fieldName)) return false;
  if (fieldName === 'order_number') return isEmpty(initialValues.order_number);
  if (fieldName === 'customer_name') return isEmpty(initialValues.customer_name);
  return EDITABLE_FIELDS.has(fieldName);
}

function buildUpdatePayload(values, accessoriesOptions) {
  const type = getAccessoryCategory(values.accessories, accessoriesOptions);

  return {
    order_number: values.order_number,
    country: values.country,
    state: values.state,
    city: values.city,
    address: values.address,
    address2: values.address2,
    phone: values.phone,
    post_code: values.post_code,
    country_model_category: values.accessories,
    accessories: values.accessories,
    type,
    mark: values.mark,
  };
}

function buildUpdateKey(values, initialValues, accessoriesOptions) {
  return (
    initialValues.unique ||
    values.unique ||
    buildUniqueValue(initialValues, accessoriesOptions) ||
    buildUniqueValue(values, accessoriesOptions)
  );
}

function findMissingRequiredField(values) {
  return FIELD_ORDER.find((fieldName) => (
    REQUIRED_FIELDS.has(fieldName) &&
    isEmpty(values[fieldName])
  ));
}

async function updateCustomerName(values) {
  if (isEmpty(values.email) || isEmpty(values.customer_name)) return;

  await apiRequest({
    method: 'post',
    url: `/customer:update?filterByTk=${encodeURIComponent(values.email)}`,
    data: {
      name: values.customer_name,
    },
  });
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

function getVisibleSections(visibleFieldOrder) {
  const visibleFields = new Set(visibleFieldOrder);
  return DETAIL_SECTIONS
    .map((section) => ({
      ...section,
      fields: section.fields.filter((fieldName) => visibleFields.has(fieldName)),
    }))
    .filter((section) => section.fields.length > 0);
}

function getFieldGridColumn(fieldName) {
  return undefined;
}

function SectionCard({ title, children }) {
  return (
    <div
      style={{
        border: '1px solid #e5e7eb',
        borderRadius: 8,
        background: '#ffffff',
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '7px 10px',
          borderBottom: '1px solid #eef2f7',
          background: '#f8fafc',
          color: '#0f172a',
          fontSize: 13,
          fontWeight: 600,
          lineHeight: '18px',
        }}
      >
        {title}
      </div>
      <div style={{ padding: 10 }}>
        {children}
      </div>
    </div>
  );
}

function DisplayValue({ fieldName, value, language }) {
  const values = Array.isArray(value) ? value : [value];
  const displayValues = values
    .filter((item) => !isEmpty(item))
    .map((item) => (fieldName === 'created_at' ? formatDateTime(item) : item));

  if (SELECT_FIELDS.has(fieldName)) {
    return (
      <div style={{ minHeight: 20 }}>
        {displayValues.map((item) => (
          <Tag key={item} color="blue" style={{ marginBottom: 0 }}>
            {getOptionLabel(item, language)}
          </Tag>
        ))}
      </div>
    );
  }

  return (
    <Typography.Text style={{ display: 'block', minHeight: 20 }}>
      {displayValues[0] || ''}
    </Typography.Text>
  );
}

function ReadonlyDetailItem({ fieldName, values, language }) {
  const isShipmentNumber = SHIPMENT_VISIBLE_FIELDS.has(fieldName);

  return (
    <div
      style={{
        border: isShipmentNumber ? '1px solid #2563eb' : '1px solid #e5e7eb',
        borderRadius: 6,
        background: isShipmentNumber ? '#eff6ff' : '#ffffff',
        padding: isShipmentNumber ? '8px 10px' : '7px 9px',
        minHeight: isShipmentNumber ? 48 : 42,
        boxShadow: isShipmentNumber ? '0 1px 3px rgba(37, 99, 235, 0.14)' : undefined,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        gridColumn: getFieldGridColumn(fieldName),
      }}
    >
      <div
        style={{
          color: isShipmentNumber ? '#1d4ed8' : '#0f172a',
          background: isShipmentNumber ? '#dbeafe' : '#f1f5f9',
          borderRadius: 4,
          padding: '1px 5px',
          fontSize: 12,
          fontWeight: 700,
          lineHeight: '18px',
          minWidth: 58,
          flex: '0 0 auto',
          whiteSpace: 'nowrap',
        }}
      >
        {getFieldLabel(fieldName, language)}
      </div>
      <div
        style={{
          color: isShipmentNumber ? '#111827' : '#111827',
          fontSize: isShipmentNumber ? 14 : 12,
          fontWeight: isShipmentNumber ? 700 : 400,
          lineHeight: '20px',
          wordBreak: 'break-word',
          letterSpacing: 0,
          minWidth: 0,
          flex: 1,
        }}
      >
        <DisplayValue
          fieldName={fieldName}
          value={values[fieldName]}
          language={language}
        />
      </div>
    </div>
  );
}

function ReadonlySection({ section, values, language, uiText }) {
  return (
    <SectionCard title={uiText[section.titleKey]}>
      <div
        style={{
          display: 'grid',
          gap: 8,
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        }}
      >
        {section.fields.map((fieldName) => (
          <ReadonlyDetailItem
            key={fieldName}
            fieldName={fieldName}
            values={values}
            language={language}
          />
        ))}
      </div>
    </SectionCard>
  );
}

function ReadonlyRemark({ values, uiText }) {
  return (
    <SectionCard title={uiText.mark}>
      <Typography.Paragraph
        style={{
          marginBottom: 0,
          minHeight: 48,
          whiteSpace: 'pre-wrap',
          color: '#111827',
          lineHeight: '20px',
        }}
      >
        {values.mark || ''}
      </Typography.Paragraph>
    </SectionCard>
  );
}

function DetailField({ fieldName, values, accessoriesOptions, language, editable, onChange }) {
  if (!editable) {
    return (
      <DisplayValue
        fieldName={fieldName}
        value={values[fieldName]}
        language={language}
      />
    );
  }

  if (fieldName === 'accessories') {
    return (
      <Select
        allowClear
        value={values.accessories}
        onChange={(value) => onChange(fieldName, value)}
        options={accessoriesOptions.map((option) => localizeOption(option, language))}
        placeholder=""
        style={{ width: '100%' }}
      />
    );
  }

  if (fieldName === 'country') {
    return (
      <Select
        allowClear
        value={values.country}
        onChange={(value) => onChange(fieldName, value)}
        options={COUNTRY_OPTIONS.map((value) => ({ label: value, value }))}
        placeholder=""
        style={{ width: '100%' }}
      />
    );
  }

  return (
    <Input
      value={values[fieldName]}
      onChange={(event) => onChange(fieldName, event.target.value)}
    />
  );
}

function EditableSection({
  section,
  values,
  initialValues,
  accessoriesOptions,
  language,
  uiText,
  formEditable,
  onChange,
}) {
  const labelWidth = language === 'en' ? 124 : 76;

  return (
    <SectionCard title={uiText[section.titleKey]}>
      <div
        style={{
          display: 'grid',
          gap: '8px 10px',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        }}
      >
        {section.fields.map((fieldName) => (
          <div
            key={fieldName}
            style={{
              gridColumn: getFieldGridColumn(fieldName),
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              minHeight: 32,
            }}
          >
            <div
              style={{
                color: '#111827',
                background: '#f1f5f9',
                borderRadius: 4,
                padding: '1px 4px',
                fontSize: 12,
                fontWeight: 700,
                lineHeight: '18px',
                width: labelWidth,
                flex: `0 0 ${labelWidth}px`,
                display: 'grid',
                gridTemplateColumns: '8px 1fr',
                alignItems: 'start',
                paddingTop: 5,
                boxSizing: 'border-box',
              }}
            >
              <span style={{ color: '#ff4d4f' }}>
                {formEditable && REQUIRED_FIELDS.has(fieldName) ? '*' : ''}
              </span>
              <span
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {getFieldLabel(fieldName, language)}
              </span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <DetailField
                fieldName={fieldName}
                values={values}
                accessoriesOptions={accessoriesOptions}
                language={language}
                editable={isFieldEditable(fieldName, values, initialValues)}
                onChange={onChange}
              />
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function ReissueDetail() {
  const [language, setLanguage] = React.useState(getCurrentLanguage);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState({});
  const [initialValues, setInitialValues] = React.useState({});
  const [accessoriesOptions, setAccessoriesOptions] = React.useState([]);
  const detailRootRef = React.useRef(null);
  const uiText = getText(language);
  const formEditable = values.status === EDITABLE_STATUS;
  const changed = JSON.stringify(buildUpdatePayload(values, accessoriesOptions)) !==
    JSON.stringify(buildUpdatePayload(initialValues, accessoriesOptions)) ||
    values.customer_name !== initialValues.customer_name;
  const visibleFieldOrder = FIELD_ORDER.filter(
    (fieldName) => (
      !SHIPMENT_VISIBLE_FIELDS.has(fieldName) ||
      values.status === SUBMITTED_STATUS ||
      values.status === COMPLETED_STATUS
    ),
  );
  const visibleSections = getVisibleSections(visibleFieldOrder);

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

    async function initialize() {
      const record = await readCurrentRecord();
      if (!mounted) return;

      if (!record) {
        setValues({});
        setLoading(false);
        return;
      }

      const baseValues = normalizeRecord(record);
      const fullRecord = await fetchRefundRecord(baseValues.unique) ||
        await fetchRefundRecord(baseValues.id) ||
        await fetchRefundRecordByOrderNumber(baseValues.order_number);
      const normalized = fullRecord
        ? {
          ...baseValues,
          ...normalizeRecord(fullRecord),
        }
        : baseValues;
      const withOrderInfo = await enrichOrderInfo(normalized);
      const withCreatedAt = isEmpty(withOrderInfo.created_at)
        ? {
          ...withOrderInfo,
          created_at: await fetchRefundCreatedAtByUnique(withOrderInfo.unique || baseValues.unique),
        }
        : withOrderInfo;
      const enriched = await enrichCustomerName(withCreatedAt);
      setValues(enriched);
      setInitialValues(enriched);
      setLoading(false);
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
        const options = withCurrentAccessoryOption(
          await loadAccessoriesOptions(values),
          values,
        );
        const inferredAccessory = undefined;
        if (mounted) {
          setAccessoriesOptions(options);
          if (!isEmpty(inferredAccessory)) {
            setValues((current) => ({
              ...current,
              accessories: current.accessories || inferredAccessory,
            }));
            setInitialValues((current) => ({
              ...current,
              accessories: current.accessories || inferredAccessory,
            }));
          }
        }
      } catch (error) {
        if (mounted) setAccessoriesOptions([]);
      }
    }

    refreshAccessories();

    return () => {
      mounted = false;
    };
  }, [values.country, values.model]);

  function setFieldValue(fieldName, value) {
    setValues((current) => ({
      ...current,
      [fieldName]: value,
    }));
  }

  async function handleSave() {
    if (!formEditable || !changed) return;

    const missingField = findMissingRequiredField(values);
    if (missingField) {
      message.error(`${uiText.requiredPrefix}${getFieldLabel(missingField, language)}`);
      return;
    }

    setSaving(true);
    try {
      const targetRecord = !isEmpty(values.unique) || !isEmpty(initialValues.unique)
        ? initialValues
        : normalizeRecord(await fetchRefundRecordByOrderNumber(values.order_number) || {});
      const targetUnique = targetRecord.unique || buildUpdateKey(values, initialValues, accessoriesOptions);
      if (isEmpty(targetUnique)) throw new Error(uiText.noRecord);

      const updatePayload = buildUpdatePayload(values, accessoriesOptions);
      await apiRequest({
        method: 'post',
        url: `/refund:update?filterByTk=${encodeURIComponent(targetUnique)}`,
        data: updatePayload,
      });
      const savedRecord = await fetchRefundRecord(targetUnique);
      if (!savedRecord) throw new Error(uiText.saveFailed);
      await updateCustomerName(values);
      setInitialValues({
        ...values,
        unique: targetUnique,
      });
      setValues((current) => ({
        ...current,
        unique: targetUnique,
      }));
      await refreshTargetBlock();
      message.success(uiText.saveSuccess);
      setTimeout(() => closeCurrentPopup(detailRootRef.current), 200);
    } catch (error) {
      message.error(error?.message || uiText.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div ref={detailRootRef} style={{ padding: 16 }}>
        <Spin size="small" /> <Typography.Text>{uiText.loading}</Typography.Text>
      </div>
    );
  }

  if (!values.id && !values.order_number) {
    return (
      <div style={{ padding: 16 }}>
        <Typography.Text type="secondary">{uiText.noRecord}</Typography.Text>
      </div>
    );
  }

  if (!formEditable) {
    return (
      <div style={{ padding: 10, background: '#f8fafc' }}>
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          {visibleSections.map((section) => (
            <ReadonlySection
              key={section.titleKey}
              section={section}
              values={values}
              language={language}
              uiText={uiText}
            />
          ))}
          <ReadonlyRemark values={values} uiText={uiText} />
        </Space>
      </div>
    );
  }

  return (
    <div ref={detailRootRef} style={{ padding: 10, background: '#f8fafc' }}>
      <Space direction="vertical" size={8} style={{ width: '100%' }}>
        <Form layout="vertical">
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {visibleSections.map((section) => (
              <EditableSection
                key={section.titleKey}
                section={section}
                values={values}
                initialValues={initialValues}
                accessoriesOptions={accessoriesOptions}
                language={language}
                uiText={uiText}
                formEditable={formEditable}
                onChange={setFieldValue}
              />
            ))}

            <SectionCard title={uiText.mark}>
              <Form.Item style={{ marginBottom: 0 }}>
                <Input.TextArea
                  readOnly={!formEditable}
                  autoSize={{ minRows: 3 }}
                  value={values.mark}
                  onChange={(event) => setFieldValue('mark', event.target.value)}
                />
              </Form.Item>
            </SectionCard>

            {formEditable ? (
              <Button
                type="primary"
                loading={saving}
                disabled={!changed}
                onClick={handleSave}
              >
                {uiText.save}
              </Button>
            ) : null}
          </Space>
        </Form>
      </Space>
    </div>
  );
}

ctx.render(<ReissueDetail />);
