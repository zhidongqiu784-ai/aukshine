const React = ctx.libs.React;
const { useState, useEffect } = React;
const {
  Form,
  InputNumber,
  Button,
  Card,
  Tag,
  Spin,
  Row,
  Col,
  Divider,
  Modal,
  Typography,
  Table,
  message,
  Tabs,
  Popconfirm,
  Radio,
} = ctx.libs.antd;
const { EditOutlined, PlusOutlined } = ctx.libs.antdIcons;
const { Title, Text } = Typography;
const PAGE_TITLE = '利润&测评试算';

// ===================== 全局参数与常量 =====================
const URL_PARAMS_GLOBAL_KEY = '__urlParams_global';
const URL_PARAM_KEYS = ['model', 'country', 'asin', 'sale_owner', 'status'];

const getParamValue = (source, key) => {
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
};

const normalizeUrlParams = (source) => {
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
};

const mergeUrlParams = (target, source) => {
  const params = normalizeUrlParams(source);
  URL_PARAM_KEYS.forEach((key) => {
    if (params[key]) target[key] = params[key];
  });
  return target;
};

const parseSearchToParams = (value) => {
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
};

const readLocationParams = (loc) => {
  const result = {};
  if (!loc) return result;
  mergeUrlParams(result, loc.query);
  mergeUrlParams(result, parseSearchToParams(loc.search));
  mergeUrlParams(result, parseSearchToParams(loc.hash));
  mergeUrlParams(result, parseSearchToParams(loc.href));
  return result;
};

const readStoredUrlParams = () => {
  try {
    if (ctx.engine?.[URL_PARAMS_GLOBAL_KEY]) return ctx.engine[URL_PARAMS_GLOBAL_KEY];
  } catch (_) {}
  return {};
};

const rememberUrlParams = (params) => {
  if (!params || (!params.asin && !params.country && !params.model)) return;
  const saved = { ...readStoredUrlParams(), ...params };
  try {
    if (ctx.engine) ctx.engine[URL_PARAMS_GLOBAL_KEY] = saved;
  } catch (_) {}
};

const readUrlParamsSync = ({ includeStored = false } = {}) => {
  const result = {};
  const add = (source) => mergeUrlParams(result, source);

  try { add(ctx.urlSearchParams); } catch (_) {}
  try { if (typeof window !== 'undefined') add(readLocationParams(window.location)); } catch (_) {}

  if (includeStored && (!result.asin || !result.country)) add(readStoredUrlParams());
  rememberUrlParams(result);
  return result;
};

const resolveUrlParams = async () => {
  const result = {};
  try {
    if (ctx.getVar) addUrlParamsFromGetVar(result, await ctx.getVar('ctx.urlSearchParams'));
  } catch (_) {}
  try {
    if (ctx.getVar) {
      const byKey = {};
      for (const key of URL_PARAM_KEYS) {
        const value = await ctx.getVar(`ctx.urlSearchParams.${key}`);
        if (value) byKey[key] = value;
      }
      addUrlParamsFromGetVar(result, byKey);
    }
  } catch (_) {}
  mergeUrlParams(result, readUrlParamsSync());
  rememberUrlParams(result);
  return result;
};

const addUrlParamsFromGetVar = (target, source) => mergeUrlParams(target, source);

const getAsinCountry = (params) => {
  const asinValue = params?.asin || '';
  const countryValue = params?.country || '';
  return asinValue && countryValue ? `${asinValue}_${countryValue}` : '';
};

const mergePageParams = (base, incoming) => {
  const result = { ...(base || {}) };
  mergeUrlParams(result, incoming);
  return result;
};

const areUrlParamsSame = (a, b) => URL_PARAM_KEYS.every((key) => (a?.[key] || '') === (b?.[key] || ''));

const urlParams = await resolveUrlParams();

const FONT_SIZE = {
  dataLabel:     13,
  dataValue:     15,
  dataHighlight: 22,
  tableCell:     13,
  sectionTitle:  15,
  inputLabel:    15,
  cardTitle:     15,
};

const NORMAL_DEFAULTS = {
  type: 'new',
  shop_type: 'normal',
  quantity: 1,
  ads_rate: 0,
  review_rate: 0,
  other_rate: 1,
  use_coupon: 0,
  review_extra_fee: 0,
  price_with_tax: null,
};

const REVIEW_DEFAULTS = {
  type: 'new',
  shop_type: 'normal',
  quantity: 1,
  ads_rate: 0,
  review_rate: 0,
  other_rate: 0,
  use_coupon: 0,
  review_extra_fee: 0,
  price_with_tax: null,
};

const M = {
  primary:      '#8fa7c0',
  primaryLight: '#b3cdeb',
  primaryBg:    '#eef3f8',
  pageBg:       '#f0ece8',
  cardBg:       '#faf8f6',
  sectionBg:    '#f2ede9',
  inputBg:      '#fdfcfb',
  disabledBg:   '#f0ece8',
  green:        '#8ab5a0',
  greenBg:      '#eaf3ee',
  greenBd:      '#b8d2c7',
  red:          '#c49090',
  redBg:        '#f7efef',
  redBd:        '#ddbfbf',
  orange:       '#c9a882',
  orangeBg:     '#fdf5ec',
  orangeBd:     '#e8d0b0',
  textPrimary:  '#4a4540',
  textSecond:   '#7a736c',
  textMuted:    '#a89f98',
  border:       '#ddd8d2',
  borderLight:  '#eae6e1',
  radius:       '10px',
  radiusSm:     '7px',
  radiusXs:     '5px',
  font:         '-apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  fontMono:     '"SF Mono", "Fira Code", Consolas, monospace',
  shadow:       '0 1px 6px rgba(100,85,70,0.08)',
  shadowSm:     '0 1px 3px rgba(100,85,70,0.06)',
};


// ===================== 组件一：产品配置看板 =====================
const ProductConfigDashboard = ({ onUpdate, pageParams }) => {
  const params = React.useMemo(() => {
    return mergePageParams(pageParams, readUrlParamsSync());
  }, [pageParams?.model, pageParams?.country, pageParams?.asin, pageParams?.sale_owner, pageParams?.status]);

  const [existingConfig, setExistingConfig] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState('');
  const [editModalVisible, setEditModalVisible] = React.useState(false);
  
  const [createModalVisible, setCreateModalVisible] = React.useState(false);
  
  const [form] = Form.useForm();
  const [createForm] = Form.useForm();

  const asinCountry = getAsinCountry(params);

  const percentFields = [
    'tax_rate', 'commission_rate', 'storage_rate',
    'coupon_commission_rate', 'lightning_commission_rate',
    'offsite_commission_rate', 'refund_rate_new',
    'refund_rate_used', 'refund_rate_review',
  ];

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const response = await ctx.api.request({
        url: 'product_config:get',
        method: 'get',
        params: { filterByTk: asinCountry },
      });
      setExistingConfig(response?.data?.data || null);
    } catch (e) {
      setExistingConfig(null);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (!asinCountry) { setLoading(false); return; }
    fetchConfig();
  }, [asinCountry]);

  const handleCreate = async (values) => {
    setSubmitLoading(true);
    setErrorMsg('');
    try {
      const submitData = { asin_country: asinCountry };
      Object.keys(values).forEach(key => {
        if (percentFields.includes(key) && values[key] != null) {
          submitData[key] = Number(values[key]) / 100;
        } else {
          submitData[key] = values[key];
        }
      });
      await ctx.api.request({ url: 'product_config:create', method: 'post', data: submitData });
      ctx.message.success(ctx.t('创建成功'));
      setCreateModalVisible(false);
      await fetchConfig();
      if (onUpdate) onUpdate();
    } catch (error) {
      const errMsg = error?.response?.data?.errors?.[0]?.message || error.message || ctx.t('未知错误');
      setErrorMsg(ctx.t('创建失败') + ': ' + errMsg);
      ctx.message.error(ctx.t('创建失败') + ': ' + errMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenEdit = () => {
    const formValues = {};
    Object.keys(existingConfig).forEach(key => {
      if (percentFields.includes(key) && existingConfig[key] != null) {
        formValues[key] = parseFloat((existingConfig[key] * 100).toFixed(4));
      } else {
        formValues[key] = existingConfig[key];
      }
    });
    form.setFieldsValue(formValues);
    setEditModalVisible(true);
  };

  const handleEdit = async (values) => {
    setSubmitLoading(true);
    try {
      const submitData = {};
      Object.keys(values).forEach(key => {
        if (percentFields.includes(key) && values[key] != null) {
          submitData[key] = Number(values[key]) / 100;
        } else {
          submitData[key] = values[key];
        }
      });
      await ctx.api.request({
        url: 'product_config:update',
        method: 'post',
        params: { filterByTk: asinCountry },
        data: submitData,
      });
      ctx.message.success(ctx.t('更新成功'));
      setEditModalVisible(false);
      await fetchConfig();
      if (onUpdate) onUpdate();
    } catch (error) {
      const errMsg = error?.response?.data?.errors?.[0]?.message || error.message || ctx.t('未知错误');
      ctx.message.error(ctx.t('更新失败') + ': ' + errMsg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const purple    = '#6c3fc5';
  const purpleMid = '#9b72e8';

  const labelStyle = { fontSize: 11, color: '#888', marginBottom: 2, whiteSpace: 'nowrap' };
  const valueStyle = { fontSize: 16, fontWeight: 700, color: '#2d1b6e', whiteSpace: 'nowrap' };

  const fmt = (val, isPercent) => {
    if (val == null) return '-';
    if (isPercent) return `${(val * 100).toFixed(2)}%`;
    return Number(val).toLocaleString();
  };

  const GLOBAL_KEY = '__urlParams_global';
  const readGlobal  = () => ctx.engine[GLOBAL_KEY] || null;
  const writeGlobal = (data) => { ctx.engine[GLOBAL_KEY] = data; };

  const parseSearch = (search) => {
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
  };

  const tryParseCurrentSearch = () => {
    const p = readUrlParamsSync();
    const model     = p['model']      || null;
    const country   = p['country']    || null;
    const asin      = p['asin']       || null;
    const saleOwner = p['sale_owner'] || null;
    if (!model && !country && !asin && !saleOwner) return null;
    return { model, country, asin, saleOwner };
  };

  const buildSearch = (p) => {
    const parts = [];
    if (p.model)     parts.push('model='      + encodeURIComponent(p.model));
    if (p.country)   parts.push('country='    + encodeURIComponent(p.country));
    if (p.asin)      parts.push('asin='       + encodeURIComponent(p.asin));
    if (p.saleOwner) parts.push('sale_owner=' + encodeURIComponent(p.saleOwner));
    return parts.length ? '?' + parts.join('&') : '';
  };

  const loadParams = () => {
    const fromProps = {
      model: params.model || null,
      country: params.country || null,
      asin: params.asin || null,
      saleOwner: params.sale_owner || params.saleOwner || null,
    };
    if (fromProps.model || fromProps.country || fromProps.asin || fromProps.saleOwner) {
      writeGlobal(fromProps);
      return { params: fromProps, source: 'props' };
    }
    const fromSearch = tryParseCurrentSearch();
    if (fromSearch) { writeGlobal(fromSearch); return { params: fromSearch, source: 'url' }; }
    const cached = readGlobal();
    if (cached) return { params: cached, source: 'cache' };
    return { params: { model: '-', country: '-', asin: '-', saleOwner: '-' }, source: 'default' };
  };

  const [headerParams, setHeaderParams] = React.useState({ model: '-', country: '-', asin: '-', saleOwner: '-' });

  React.useEffect(() => {
    const { params: result } = loadParams();
    setHeaderParams(result);
    return undefined;
  }, [params.model, params.country, params.asin, params.sale_owner, params.saleOwner]);

  const renderHeaderBlock = (rightSlot) =>
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 8,
        padding: '8px 16px',
        gap: 16,
        flexShrink: 0,
        marginRight: 12,
        boxShadow: '0 2px 8px rgba(102, 126, 234, 0.2)',
      }
    },
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 2 } }, ctx.t('型号')),
        React.createElement('div', { style: { color: '#ffa940', fontSize: 15, fontWeight: 600 } }, headerParams.model || '-')
      ),
      React.createElement('div', { style: { width: 1, height: 24, background: 'rgba(255,255,255,0.2)' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 2 } }, ctx.t('国家')),
        React.createElement('div', { style: { color: '#ffd700', fontSize: 15, fontWeight: 600, textTransform: 'uppercase' } }, headerParams.country || '-')
      ),
      React.createElement('div', { style: { width: 1, height: 24, background: 'rgba(255,255,255,0.2)' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 2 } }, ctx.t('ASIN')),
        React.createElement('div', { style: { color: '#fff', fontSize: 15, fontWeight: 600, letterSpacing: '0.5px' } }, headerParams.asin || '-')
      ),
      React.createElement('div', { style: { width: 1, height: 24, background: 'rgba(255,255,255,0.2)' } }),
      React.createElement('div', { style: { display: 'flex', flexDirection: 'column' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginBottom: 2 } }, ctx.t('销售')),
        React.createElement('div', { style: { color: '#ffb3c6', fontSize: 15, fontWeight: 600 } }, headerParams.saleOwner || '-')
      ),
      React.createElement('div', { style: { width: 1, height: 24, background: 'rgba(255,255,255,0.2)' } }),
      rightSlot
    );

  const sections = [
    {
      title: ctx.t('基础成本'), color: '#6c3fc5', bgColor: '#f3eeff',
      fields: [
        { key: 'cost_rmb',                   label: ctx.t('全新机产品成本'),   unit: ctx.t('RMB'),    isPercent: false },
        { key: 'detection_machine_cost_rmb', label: ctx.t('检测机产品成本'),   unit: ctx.t('RMB'),    isPercent: false },
        { key: 'exchange_rate',              label: ctx.t('汇率'),             unit: '',               isPercent: false },
        { key: 'freight_per_unit_rmb',       label: ctx.t('头程费用'),         unit: ctx.t('RMB/台'), isPercent: false },
        { key: 'tax_rate',                   label: ctx.t('税点'),             unit: '',               isPercent: true  },
      ],
    },
    {
      title: ctx.t('平台费用'), color: '#7c4dff', bgColor: '#ede8fb',
      fields: [
        { key: 'commission_rate', label: ctx.t('佣金占比'),   unit: '',       isPercent: true  },
        { key: 'storage_rate',   label: ctx.t('仓储费占比'), unit: '',       isPercent: true  },
        { key: 'fba_fee',        label: ctx.t('配送费'),     unit: ctx.t('当地币'), isPercent: false },
        { key: 'inbound_fee',    label: ctx.t('入库配置费'), unit: ctx.t('当地币'), isPercent: false },
      ],
    },
    {
      title: ctx.t('促销费用'), color: '#9c27b0', bgColor: '#fce4ff',
      fields: [
        { key: 'coupon_commission_rate',    label: ctx.t('Coupon 抽佣率'),     unit: '',       isPercent: true  },
        { key: 'offsite_commission_rate',   label: ctx.t('站外佣金率 (仅 US)'), unit: '',       isPercent: true  },
        { key: 'lightning_commission_rate', label: ctx.t('秒杀抽佣率'),       unit: '',       isPercent: true  },
        { key: 'lightning_fixed_fee',       label: ctx.t('秒杀每日固定费用'), unit: ctx.t('当地币'), isPercent: false },
        { key: 'lightning_fee_cap',         label: ctx.t('秒杀变动费用上限'), unit: ctx.t('当地币'), isPercent: false },
      ],
    },
    {
      title: ctx.t('退款占比'), color: '#5c35a8', bgColor: '#eee8ff',
      fields: [
        { key: 'refund_rate_new',    label: ctx.t('全新品退款占比'), unit: '', isPercent: true },
        { key: 'refund_rate_used',   label: ctx.t('检测机退款占比'), unit: '', isPercent: true },
        { key: 'refund_rate_review', label: ctx.t('测评退款占比'),   unit: '', isPercent: true },
      ],
    },
  ];

  const formSections = [
    {
      title: ctx.t('基础成本'),
      fields: [
        { name: 'cost_rmb',                       label: ctx.t('产品成本（RMB）'),                required: true, step: 0.01,   isPercent: false },
        { name: 'detection_machine_cost_rmb',     label: ctx.t('检测机产品成本（RMB）'),          step: 0.01,     isPercent: false },
        { name: 'exchange_rate',                  label: ctx.t('汇率'),                           step: 0.0001,   isPercent: false },
        { name: 'freight_per_unit_rmb',           label: ctx.t('头程费用（单台 RMB）'),            step: 0.01,     isPercent: false },
        { name: 'tax_rate',                       label: ctx.t('税点'),                           step: 0.01,     isPercent: true  },
      ],
    },
    {
      title: ctx.t('平台费用'),
      fields: [
        { name: 'commission_rate', label: ctx.t('佣金占比'),             step: 0.01, isPercent: true  },
        { name: 'storage_rate',   label: ctx.t('仓储费占比'),           step: 0.01, isPercent: true  },
        { name: 'fba_fee',        label: ctx.t('配送费（当地币）'),     step: 0.01, isPercent: false },
        { name: 'inbound_fee',    label: ctx.t('入库配置费（当地币）'), step: 0.01, isPercent: false },
      ],
    },
    {
      title: ctx.t('促销费用'),
      fields: [
        { name: 'coupon_commission_rate',    label: ctx.t('Coupon 抽佣率'),               step: 0.01, isPercent: true  },
        { name: 'offsite_commission_rate',   label: ctx.t('站外佣金率（仅 US）'),         step: 0.01, isPercent: true  },
        { name: 'lightning_commission_rate', label: ctx.t('秒杀抽佣率'),                 step: 0.01, isPercent: true  },
        { name: 'lightning_fixed_fee',       label: ctx.t('秒杀每日固定费用（当地币）'), step: 0.01, isPercent: false },
        { name: 'lightning_fee_cap',         label: ctx.t('秒杀变动费用上限（当地币）'), step: 0.01, isPercent: false },
      ],
    },
    {
      title: ctx.t('退款占比'),
      fields: [
        { name: 'refund_rate_new',    label: ctx.t('全新品退款占比'), step: 0.01, isPercent: true },
        { name: 'refund_rate_used',   label: ctx.t('检测机退款占比'), step: 0.01, isPercent: true },
        { name: 'refund_rate_review', label: ctx.t('测评退款占比'),   step: 0.01, isPercent: true },
      ],
    },
  ];

  const renderFormSections = (formInstance) =>
    formSections.map(section =>
      React.createElement(React.Fragment, { key: section.title },
        React.createElement(Divider, {
          orientation: 'left',
          style: { fontSize: 13, color: purple, margin: '12px 0 8px', borderColor: purpleMid },
        }, section.title),
        React.createElement(Row, { gutter: 16 },
          ...section.fields.map(field =>
            React.createElement(Col, { key: field.name, span: 12 },
              React.createElement(Form.Item, {
                name: field.name,
                label: field.label,
                rules: field.required ? [{ required: true, message: ctx.t('请输入') + field.label }] : [],
                style: { marginBottom: 12 },
              },
                React.createElement(InputNumber, {
                  style: { width: '100%' },
                  step: field.step,
                  stringMode: true,
                  addonAfter: field.isPercent ? '%' : undefined,
                })
              )
            )
          )
        )
      )
    );

  if (loading) {
    return React.createElement('div', {
      style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }
    }, React.createElement(Spin, { size: 'large', tip: ctx.t('加载中...') }));
  }

  if (!asinCountry) {
    return React.createElement(Card, { style: { maxWidth: 600, margin: '20px auto' } },
      React.createElement('div', { style: { color: '#ff4d4f' } }, ctx.t('未找到 URL 参数'))
    );
  }

  if (existingConfig) {
    const renderCombinedMetrics = () =>
      React.createElement('div', {
        style: {
          background: '#fff',
          borderRadius: 12,
          border: '1px solid #ede8fb',
          boxShadow: '0 2px 12px rgba(108,63,197,0.08)',
          padding: '12px 16px',
          overflowX: 'auto',
          marginBottom: 16,
        }
      },
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'stretch',
            gap: 0,
            minWidth: 'max-content',
          }
        },
          renderHeaderBlock(
            React.createElement(Button, {
              icon: React.createElement(EditOutlined),
              onClick: handleOpenEdit,
              size: 'small',
              style: {
                background: 'rgba(255,255,255,0.15)',
                border: '1px solid rgba(255,255,255,0.4)',
                color: '#fff',
                borderRadius: 6,
                fontWeight: 600,
              },
            }, ctx.t('编辑'))
          ),
          ...sections.map((section, sIdx) =>
            React.createElement(React.Fragment, { key: section.title },
              React.createElement('div', {
                style: {
                  display: 'flex',
                  alignItems: 'stretch',
                  background: section.bgColor,
                  borderRadius: 8,
                  padding: '6px 4px',
                  gap: 0,
                }
              },
                ...section.fields.map((field, fIdx) =>
                  React.createElement(React.Fragment, { key: field.key },
                    React.createElement('div', {
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px 14px',
                        minWidth: 80,
                      }
                    },
                      React.createElement('div', { style: labelStyle }, field.label),
                      React.createElement('div', {
                        style: { display: 'flex', alignItems: 'baseline', gap: 2 }
                      },
                        React.createElement('span', { style: valueStyle },
                          fmt(existingConfig[field.key], field.isPercent)
                        ),
                        field.unit
                          ? React.createElement('span', { style: { fontSize: 10, color: '#aaa' } }, field.unit)
                          : null
                      )
                    ),
                    fIdx < section.fields.length - 1
                      ? React.createElement('div', {
                          style: {
                            width: 1,
                            alignSelf: 'stretch',
                            background: `${section.color}30`,
                            margin: '4px 0',
                          }
                        })
                      : null
                  )
                )
              ),
              sIdx < sections.length - 1
                ? React.createElement('div', { style: { width: 10, flexShrink: 0 } })
                : null
            )
          )
        )
      );

    return React.createElement('div', { style: { padding: '0 4px' } },
      renderCombinedMetrics(),
      React.createElement(Modal, {
        title: React.createElement('span', { style: { color: purple, fontWeight: 700 } }, ctx.t('编辑产品配置')),
        open: editModalVisible,
        onCancel: () => setEditModalVisible(false),
        footer: null,
        width: 760,
        destroyOnClose: true,
      },
        React.createElement(Form, {
          form: form,
          layout: 'vertical',
          onFinish: handleEdit,
        },
          ...renderFormSections(form),
          React.createElement(Divider, { style: { margin: '12px 0' } }),
          React.createElement(Row, { justify: 'end', gutter: 12 },
            React.createElement(Col, null,
              React.createElement(Button, {
                onClick: () => setEditModalVisible(false),
                style: { marginRight: 8 }
              }, ctx.t('取消'))
            ),
            React.createElement(Col, null,
              React.createElement(Button, {
                type: 'primary',
                htmlType: 'submit',
                loading: submitLoading,
                style: { background: purple, borderColor: purple, minWidth: 100 },
              }, ctx.t('保存'))
            )
          )
        )
      )
    );
  }

  const initialValues = {
    exchange_rate: 7.2, commission_rate: 15,
    tax_rate: 0, storage_rate: 0, fba_fee: 0,
    freight_per_unit_rmb: 0, cost_rmb: 0,
    detection_machine_cost_rmb: 0,
    refund_rate_new: 0, refund_rate_used: 0, refund_rate_review: 0,
    inbound_fee: 0, coupon_commission_rate: 0,
    lightning_commission_rate: 0, lightning_fixed_fee: 0,
    lightning_fee_cap: 0, offsite_commission_rate: 0,
  };

  return React.createElement('div', { style: { padding: '0 4px' } },
    React.createElement('div', {
      style: {
        background: '#fff',
        borderRadius: 12,
        border: '1px solid #ede8fb',
        boxShadow: '0 2px 12px rgba(108,63,197,0.08)',
        padding: '12px 16px',
        overflowX: 'auto',
        marginBottom: 16,
      }
    },
      React.createElement('div', { style: { display: 'flex', minWidth: 'max-content' } },
        renderHeaderBlock(
          React.createElement(Button, {
            icon: React.createElement(PlusOutlined),
            onClick: () => setCreateModalVisible(true),
            size: 'small',
            style: {
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              borderRadius: 6,
              fontWeight: 600,
            }
          }, ctx.t('待创建 (点击新建)'))
        )
      )
    ),
    
    React.createElement(Modal, {
      title: React.createElement('span', { style: { color: purple, fontWeight: 700 } }, ctx.t('新建产品配置')),
      open: createModalVisible,
      onCancel: () => setCreateModalVisible(false),
      footer: null,
      width: 760,
      destroyOnClose: true,
    },
      errorMsg
        ? React.createElement('div', {
            style: {
              color: '#ff4d4f', marginBottom: 16,
              padding: '8px 12px', background: '#fff2f0',
              border: '1px solid #ffccc7', borderRadius: 8,
            }
          }, errorMsg)
        : null,
      React.createElement(Form, {
        form: createForm,
        layout: 'vertical',
        onFinish: handleCreate,
        initialValues,
      },
        ...renderFormSections(createForm),
        React.createElement(Divider, { style: { margin: '12px 0' } }),
        React.createElement(Row, { justify: 'end', gutter: 12 },
          React.createElement(Col, null,
            React.createElement(Button, {
              onClick: () => setCreateModalVisible(false),
              style: { marginRight: 8 }
            }, ctx.t('取消'))
          ),
          React.createElement(Col, null,
            React.createElement(Button, {
              type: 'primary',
              htmlType: 'submit',
              loading: submitLoading,
              style: { background: purple, borderColor: purple, minWidth: 100 },
            }, ctx.t('保存'))
          )
        )
      )
    )
  );
};


// ===================== 组件二：定价计算器 =====================
function PricingCalculator({ configRefresh, asinCountry }) {
  const [normalForm] = Form.useForm();
  const [reviewForm] = Form.useForm();
  const [activeTab, setActiveTab] = useState('normal');
  const [normalScenarios, setNormalScenarios] = useState([]);
  const [reviewScenarios, setReviewScenarios] = useState([]);
  const [activeNormalScenario, setActiveNormalScenario] = useState(null);
  const [activeReviewScenario, setActiveReviewScenario] = useState(null);
  const [loading, setLoading] = useState(true);
  const [productConfig, setProductConfig] = useState(null);
  const [normalCalc, setNormalCalc] = useState({});
  const [reviewCalc, setReviewCalc] = useState({});

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      if (!asinCountry) {
        setNormalScenarios([]);
        setReviewScenarios([]);
        setActiveNormalScenario(null);
        setActiveReviewScenario(null);
        setNormalCalc({});
        setReviewCalc({});
        setLoading(false);
        return;
      }
      /*
      if (!asinCountry) {
        message.error('缺少 ASIN 或国家参数');
        setLoading(false);
        return;
      }
      */
      try {
        setNormalScenarios([]);
        setReviewScenarios([]);
        setActiveNormalScenario(null);
        setActiveReviewScenario(null);
        setNormalCalc({});
        setReviewCalc({});
        const configResult = await ctx.request({
          url: 'product_config:get',
          params: { filterByTk: asinCountry }
        });
        const productData = configResult?.data?.data || configResult?.data;
        setProductConfig(productData);

        const scenariosResult = await ctx.request({
          url: 'pricing_scenarios:list',
          params: {
            filter: JSON.stringify({ asin_country: asinCountry }),
            pageSize: 999
          }
        });
        const all = Array.isArray(scenariosResult?.data?.data)
          ? scenariosResult.data.data
          : (Array.isArray(scenariosResult?.data) ? scenariosResult.data : []);

        const normals = all.filter(s => s.scenario_type === 'normal');
        const reviews = all.filter(s => s.scenario_type === 'review');
        setNormalScenarios(normals);
        setReviewScenarios(reviews);

        if (normals.length > 0) {
          setActiveNormalScenario(normals[0]);
          normalForm.setFieldsValue(normals[0]);
          setNormalCalc(calculateFields(normals[0], 'normal', productData));
        }
        if (reviews.length > 0) {
          setActiveReviewScenario(reviews[0]);
          reviewForm.setFieldsValue(reviews[0]);
          setReviewCalc(calculateFields(reviews[0], 'review', productData));
        }
      } catch (err) {
        console.error('加载数据失败', err);
        message.error('加载数据失败：' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [asinCountry]);

  useEffect(() => {
    if (configRefresh > 0 && asinCountry) {
      async function updateConfig() {
        try {
          const configResult = await ctx.request({
            url: 'product_config:get',
            params: { filterByTk: asinCountry }
          });
          const productData = configResult?.data?.data || configResult?.data;
          setProductConfig(productData);

          const currentNormalVals = normalForm.getFieldsValue();
          if (currentNormalVals.price_with_tax) {
            setNormalCalc(calculateFields(currentNormalVals, 'normal', productData));
          }
          const currentReviewVals = reviewForm.getFieldsValue();
          if (currentReviewVals.price_with_tax) {
            setReviewCalc(calculateFields(currentReviewVals, 'review', productData));
          }
        } catch (e) {
          console.error('静默更新配置失败', e);
        }
      }
      updateConfig();
    }
  }, [configRefresh, asinCountry]);

  const calculateFields = (values, scenarioType, config, changedValues = {}) => {
    const cfg = config || productConfig;
    const priceWithTax = Number(values.price_with_tax) || 0;
    if (!cfg || priceWithTax === 0) return {};

    const machineType = values.type || 'new'; 
    const isWoot = values.shop_type === 'woot'; 

    const costRmb = machineType === 'used' 
      ? (Number(cfg.detection_machine_cost_rmb) || 0) 
      : (Number(cfg.cost_rmb) || 0);

    const quantity       = Number(values.quantity) || 1;
    const adsRate        = (Number(values.ads_rate) || 0) / 100;
    const reviewRate     = (Number(values.review_rate) || 0) / 100;
    const otherRate      = (Number(values.other_rate) || 0) / 100;
    const useCoupon      = Number(values.use_coupon) || 0;
    const reviewExtraFee = Number(values.review_extra_fee) || 0;

    const taxRate              = Number(cfg.tax_rate) || 0;
    const commissionRate       = isWoot ? 0 : (Number(cfg.commission_rate) || 0);
    const fbaFee               = isWoot ? 0 : (Number(cfg.fba_fee) || 0);
    const storageRate          = isWoot ? 0 : (Number(cfg.storage_rate) || 0);
    
    const refundRateNew        = isWoot ? (Number(cfg.refund_rate_new) || 0) / 2 : (Number(cfg.refund_rate_new) || 0);
    const refundRateUsed       = isWoot ? (Number(cfg.refund_rate_used) || 0) / 2 : (Number(cfg.refund_rate_used) || 0);
    
    const exchangeRate         = Number(cfg.exchange_rate) || 1;
    const freightPerUnit       = Number(cfg.freight_per_unit_rmb) || 0;
    const inboundFee           = Number(cfg.inbound_fee) || 0;
    const refundRateReview     = Number(cfg.refund_rate_review) || 0;
    const couponCommissionRate = Number(cfg.coupon_commission_rate) || 0;

    const round4 = v => Math.round(v * 10000) / 10000;
    const round2 = v => Math.round(v * 100) / 100;

    const taxAmount = round2(priceWithTax * taxRate / (1 + taxRate));
    let netPrice    = round2(priceWithTax - taxAmount);
    
    if (isWoot) {
      if (
        changedValues.price_with_tax !== undefined ||
        changedValues.shop_type !== undefined ||
        values.net_price === undefined ||
        values.net_price === null
      ) {
        netPrice = round2(netPrice * 0.63);
      } else {
        netPrice = Number(values.net_price);
      }
    }

    const monthlyRevenue = round2(netPrice * quantity);
    
    const baseRefundRate = machineType === 'used' ? refundRateUsed : refundRateNew;
    const refundRate     = scenarioType === 'review' ? refundRateReview : baseRefundRate;
    
    const monthlyRefund  = round2(monthlyRevenue * refundRate * 0.93);
    const netSales       = round2(monthlyRevenue - monthlyRefund);

    const monthlyCogs       = round2(quantity * costRmb / exchangeRate);
    const monthlyFreight    = round2(freightPerUnit * quantity / exchangeRate);
    const monthlyCommission = round2(monthlyRevenue * commissionRate);
    const monthlyFba        = round2(fbaFee * quantity);
    const monthlyStorage    = round2(monthlyRevenue * storageRate + inboundFee);
    const monthlyAds        = round2(monthlyRevenue * adsRate);
    const monthlyReview     = round2(monthlyRevenue * reviewRate);
    const monthlyOther      = round2(monthlyRevenue * otherRate);
    const couponFee         = round2(netPrice * useCoupon * couponCommissionRate);

    const couponDeduction = scenarioType === 'review' ? couponFee : 0;
    const grossProfit = round2(
      netSales - monthlyCogs - monthlyFreight - monthlyCommission
      - monthlyFba - monthlyStorage - monthlyAds - monthlyReview - monthlyOther
      - couponDeduction
    );

    const grossMargin           = netSales > 0 ? round4(grossProfit / netSales) : 0;
    const costRatio             = monthlyRevenue > 0 ? round4((costRmb * quantity) / exchangeRate / monthlyRevenue) : 0;
    const grossProfitRmb        = round2(grossProfit * exchangeRate);
    const monthlyLogisticsRatio = monthlyRevenue > 0 ? round4(monthlyFreight / monthlyRevenue) : 0;
    const monthlyShippingRatio  = monthlyRevenue > 0 ? round4(monthlyFba / monthlyRevenue) : 0;
    const reviewReturnAmount    = round2(priceWithTax + reviewExtraFee);
    const reviewNetCost         = round2(grossProfit - reviewReturnAmount);

    return {
      tax_amount: taxAmount,
      net_price: netPrice, 
      monthly_revenue: monthlyRevenue,
      monthly_refund: monthlyRefund,
      net_sales: netSales,
      monthly_cogs: monthlyCogs,
      monthly_freight: monthlyFreight,
      monthly_commission: monthlyCommission,
      monthly_fba: monthlyFba,
      monthly_storage: monthlyStorage,
      monthly_ads: monthlyAds,
      monthly_review: monthlyReview,
      monthly_other: monthlyOther,
      coupon_fee: couponFee,
      gross_profit: grossProfit,
      gross_margin: grossMargin,
      gross_profit_rmb: grossProfitRmb,
      review_return_amount: reviewReturnAmount,
      review_net_cost: reviewNetCost,
      review_order_profit_local: grossProfit,
      cost_ratio: costRatio,
      monthly_logistics_ratio: monthlyLogisticsRatio,
      monthly_shipping_ratio: monthlyShippingRatio,
    };
  };

  const handleNormalValuesChange = (changedValues, allValues) => {
    const result = calculateFields(allValues, 'normal', null, changedValues);
    normalForm.setFieldsValue(result);
    setNormalCalc(result);
  };

  const handleReviewValuesChange = (changedValues, allValues) => {
    const result = calculateFields(allValues, 'review', null, changedValues);
    reviewForm.setFieldsValue(result);
    setReviewCalc(result);
  };

  const refreshScenarios = async () => {
    const listResult = await ctx.request({
      url: 'pricing_scenarios:list',
      params: { filter: JSON.stringify({ asin_country: asinCountry }), pageSize: 999 }
    });
    const all = Array.isArray(listResult?.data?.data) ? listResult.data.data : [];
    setNormalScenarios(all.filter(s => s.scenario_type === 'normal'));
    setReviewScenarios(all.filter(s => s.scenario_type === 'review'));
  };

  const handleSave = async (scenarioType) => {
    const isReview       = scenarioType === 'review';
    const form           = isReview ? reviewForm : normalForm;
    const activeScenario = isReview ? activeReviewScenario : activeNormalScenario;
    const setActive      = isReview ? setActiveReviewScenario : setActiveNormalScenario;
    const calcData       = isReview ? reviewCalc : normalCalc;
    const scenarios      = isReview ? reviewScenarios : normalScenarios;

    try {
      const values   = await form.validateFields();
      const inputPrice = Number(values.price_with_tax);

      const duplicate = scenarios.find(s => Number(s.price_with_tax) === inputPrice);
      if (duplicate && duplicate.id !== activeScenario?.id) {
        message.warning(`该折后价 (${inputPrice}) 已存在，请修改价格或编辑原有方案`);
        return;
      }

      const saveData = {
        ...values,
        ...calcData,
        asin_country: asinCountry,
        scenario_type: scenarioType,
      };
      if (activeScenario?.id) {
        await ctx.request({
          url: 'pricing_scenarios:update',
          params: { filterByTk: activeScenario.id },
          method: 'POST',
          data: saveData
        });
        message.success('更新成功');
      } else {
        const result  = await ctx.request({
          url: 'pricing_scenarios:create',
          method: 'POST',
          data: saveData
        });
        const created = result?.data?.data || result?.data;
        setActive(created);
        message.success('创建成功');
      }
      await refreshScenarios();
    } catch (err) {
      if (err.errorFields) return; 
      message.error('保存失败：' + err.message);
    }
  };

  const handleDelete = async (record, scenarioType) => {
    try {
      await ctx.request({
        url: 'pricing_scenarios:destroy',
        params: { filterByTk: record.id },
        method: 'POST',
      });
      message.success('删除成功');

      const activeScenario = scenarioType === 'normal' ? activeNormalScenario : activeReviewScenario;
      if (activeScenario?.id === record.id) {
        const defaults = scenarioType === 'normal' ? NORMAL_DEFAULTS : REVIEW_DEFAULTS;
        if (scenarioType === 'normal') {
          setActiveNormalScenario(null);
          normalForm.resetFields();
          normalForm.setFieldsValue(defaults);
          setNormalCalc({});
        } else {
          setActiveReviewScenario(null);
          reviewForm.resetFields();
          reviewForm.setFieldsValue(defaults);
          setReviewCalc({});
        }
      }
      await refreshScenarios();
    } catch (err) {
      message.error('删除失败：' + err.message);
    }
  };

  const handleCreateNew = (scenarioType) => {
    const defaults = scenarioType === 'normal' ? NORMAL_DEFAULTS : REVIEW_DEFAULTS;
    if (scenarioType === 'normal') {
      setActiveNormalScenario(null);
      normalForm.resetFields();
      normalForm.setFieldsValue(defaults);
      setNormalCalc({});
    } else {
      setActiveReviewScenario(null);
      reviewForm.resetFields();
      reviewForm.setFieldsValue(defaults);
      setReviewCalc({});
    }
  };

  const handleSelectScenario = (record, scenarioType) => {
    if (scenarioType === 'normal') {
      setActiveNormalScenario(record);
      normalForm.setFieldsValue(record);
      setNormalCalc(calculateFields(record, 'normal'));
    } else {
      setActiveReviewScenario(record);
      reviewForm.setFieldsValue(record);
      setReviewCalc(calculateFields(record, 'review'));
    }
  };

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'normal') {
      setActiveNormalScenario(null);
      normalForm.resetFields();
      normalForm.setFieldsValue(NORMAL_DEFAULTS);
      setNormalCalc({});
    } else {
      setActiveReviewScenario(null);
      reviewForm.resetFields();
      reviewForm.setFieldsValue(REVIEW_DEFAULTS);
      setReviewCalc({});
    }
  };

  const R = React;

  const panelStyle = {
    background: M.cardBg,
    borderRadius: M.radius,
    border: `1px solid ${M.border}`,
    boxShadow: M.shadow,
    padding: '16px 16px 12px',
    fontFamily: M.font,
  };

  const inputStyle = {
    width: '100%',
    borderRadius: M.radiusSm,
    background: M.inputBg,
    fontFamily: M.font,
    fontSize: FONT_SIZE.inputLabel,
  };

  const highlightInputStyle = {
    width: '100%',
    borderRadius: M.radiusSm,
    background: M.orangeBg,
    borderColor: M.orangeBd,
    fontFamily: M.font,
    fontSize: FONT_SIZE.inputLabel,
  };

  const sectionTitleStyle = {
    fontSize: FONT_SIZE.sectionTitle,
    fontWeight: 700,
    color: M.textMuted,
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    marginBottom: 10,
    fontFamily: M.font,
  };

  const saveBtnStyle = {
    background: M.primary,
    border: 'none',
    borderRadius: M.radiusSm,
    fontSize: FONT_SIZE.cardTitle,
    fontWeight: 600,
    height: 34,
    padding: '0 22px',
    color: '#fff',
    cursor: 'pointer',
    fontFamily: M.font,
    boxShadow: '0 2px 6px rgba(143,167,192,0.35)',
    marginTop: 8,
  };

  const renderMonoVal = (v) => R.createElement('span', {
    style: { fontFamily: M.fontMono, fontSize: FONT_SIZE.tableCell }
  }, v ?? '—');

  const renderColorVal = (v) => {
    if (v == null) return '—';
    const color = v >= 0 ? M.green : M.red;
    return R.createElement('span', {
      style: { color, fontWeight: 600, fontFamily: M.fontMono, fontSize: FONT_SIZE.tableCell }
    }, v);
  };

  const renderPctVal = (v) => {
    if (v == null) return '—';
    const pct   = (v * 100).toFixed(1);
    const color = v >= 0 ? M.green : M.red;
    return R.createElement('span', {
      style: { color, fontWeight: 600, fontSize: FONT_SIZE.tableCell }
    }, `${pct}%`);
  };

  const makeDeleteCol = (scenarioType) => ({
    title: '',
    dataIndex: 'action',
    width: 64,
    render: (_, record) => R.createElement(
      Popconfirm,
      {
        title: '确认删除该方案？',
        onConfirm: (e) => { e.stopPropagation(); handleDelete(record, scenarioType); },
        onCancel:  (e) => e.stopPropagation(),
        okText: '删除',
        cancelText: '取消',
        okButtonProps: { danger: true },
      },
      R.createElement('span', {
        onClick: (e) => e.stopPropagation(),
        style: {
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
          padding: '3px 8px',
          borderRadius: M.radiusSm,
          background: M.redBg,
          border: `1px solid ${M.redBd}`,
          color: M.red,
          fontSize: 12,
          fontWeight: 600,
          fontFamily: M.font,
          whiteSpace: 'nowrap',
        }
      }, '🗑 删除')
    )
  });

  const renderTypeCol = (record) => {
    const isWoot = record.shop_type === 'woot';
    const isUsed = record.type === 'used';
    
    return R.createElement('div', { style: { display: 'flex', gap: 4, flexWrap: 'wrap' } },
      R.createElement('span', {
        style: { 
          background: isUsed ? M.orange : M.primary, 
          color: '#fff', fontSize: 10, padding: '2px 4px', 
          borderRadius: 4, lineHeight: 1, whiteSpace: 'nowrap' 
        }
      }, isUsed ? '检测机' : '全新机'),
      isWoot && R.createElement('span', {
        style: { 
          background: '#6c3fc5', color: '#fff', fontSize: 10, 
          padding: '2px 4px', borderRadius: 4, lineHeight: 1, whiteSpace: 'nowrap' 
        }
      }, 'Woot')
    );
  };

  const makeNormalColumns = (activeScenario) => [
    {
      title: '折后售价', dataIndex: 'price_with_tax', width: 100,
      render: (v, record) => R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
        R.createElement('span', { style: { fontFamily: M.fontMono, fontSize: FONT_SIZE.tableCell } }, v ?? '—'),
        activeScenario?.id === record.id && R.createElement('span', {
          style: { background: '#235e36', color: '#fff', fontSize: 10, padding: '2px 4px', borderRadius: 4, lineHeight: 1, whiteSpace: 'nowrap' }
        }, '当前售价')
      ),
    },
    {
      title: '类型', width: 100,
      render: (_, record) => renderTypeCol(record)
    },
    { title: '销量', dataIndex: 'quantity', width: 60 },
    {
      title: '单台利润 (当地币)', dataIndex: 'gross_profit', width: 90,
      render: renderColorVal,
    },
    {
      title: '单台利润 (RMB)', dataIndex: 'gross_profit_rmb', width: 110,
      render: v => {
        if (v == null) return '—';
        const color = v >= 0 ? M.green : M.red;
        return R.createElement('span', {
          style: { color, fontWeight: 600, fontFamily: M.fontMono, fontSize: FONT_SIZE.tableCell }
        }, `¥ ${v}`);
      },
    },
    {
      title: '利润率', dataIndex: 'gross_margin', width: 80,
      render: renderPctVal,
    },
    makeDeleteCol('normal'),
  ];

  const makeReviewColumns = (activeScenario) => [
    {
      title: '测评折后价', dataIndex: 'price_with_tax', width: 100,
      render: (v, record) => R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' } },
        R.createElement('span', { style: { fontFamily: M.fontMono, fontSize: FONT_SIZE.tableCell } }, v ?? '—'),
        activeScenario?.id === record.id && R.createElement('span', {
          style: { background: '#8c2828', color: '#fff', fontSize: 10, padding: '2px 4px', borderRadius: 4, lineHeight: 1, whiteSpace: 'nowrap' }
        }, '主档位')
      ),
    },
    {
      title: '类型', width: 100,
      render: (_, record) => renderTypeCol(record)
    },
    { title: '销量', dataIndex: 'quantity', width: 60 },
    {
      title: '返款总金额（当地币）', dataIndex: 'review_return_amount', width: 120,
      render: renderMonoVal,
    },
    {
      title: '回款利润（当地币）', dataIndex: 'review_order_profit_local', width: 110,
      render: renderColorVal,
    },
    {
      title: '刷单净成本（当地币）', dataIndex: 'review_net_cost', width: 120,
      render: (v) => {
        if (v == null) return '—';
        const displayVal = Math.abs(v).toFixed(2);
        const color = v < 0 ? M.red : M.green;
        return R.createElement('span', {
          style: { color, fontWeight: 600, fontFamily: M.fontMono, fontSize: FONT_SIZE.tableCell }
        }, displayVal);
      },
    },
    makeDeleteCol('review'),
  ];

  const DataItem = ({ label, value, isPercent, isMoney, highlight, span }) => {
    const displayVal = value === undefined || value === null || value === ''
      ? '—'
      : isPercent
        ? `${(Number(value) * 100).toFixed(2)}%`
        : isMoney
          ? `${value}`
          : String(value);

    const isNeg    = typeof value === 'number' && value < 0;
    const valColor = highlight ? (isNeg ? M.red : M.green) : M.textPrimary;

    return R.createElement(Col, { span: span || 6 },
      R.createElement('div', {
        style: {
          background: highlight ? (isNeg ? M.redBg : M.greenBg) : M.sectionBg,
          border: `1px solid ${highlight ? (isNeg ? M.redBd : M.greenBd) : M.borderLight}`,
          borderRadius: M.radiusSm,
          padding: '8px 12px',
          marginBottom: 8,
        }
      },
        R.createElement('div', {
          style: {
            fontSize: FONT_SIZE.dataLabel,
            color: M.textMuted,
            fontWeight: 600,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            marginBottom: 4,
            fontFamily: M.font,
          }
        }, label),
        R.createElement('div', {
          style: {
            fontSize: highlight ? FONT_SIZE.dataHighlight : FONT_SIZE.dataValue,
            fontWeight: highlight ? 700 : 600,
            color: valColor,
            fontFamily: highlight ? M.font : M.fontMono,
            letterSpacing: highlight ? '-0.3px' : '0',
            lineHeight: 1.2,
          }
        }, displayVal)
      )
    );
  };

  const renderResultPanel = (calcData, scenarioType) => {
    const hasData = calcData && calcData.gross_profit !== undefined;

    if (!hasData) {
      return R.createElement('div', {
        style: {
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', minHeight: 200,
          color: M.textMuted, fontSize: FONT_SIZE.cardTitle, fontFamily: M.font,
          flexDirection: 'column', gap: 8,
        }
      },
        R.createElement('div', { style: { fontSize: 28, opacity: 0.3 } }, '📊'),
        R.createElement('div', null, '输入含税价格后自动计算')
      );
    }

    const fmt2   = v => (v === undefined || v === null) ? '—' : String(v);
    const fmtPct = v => (v === undefined || v === null) ? '—' : `${(Number(v) * 100).toFixed(2)}%`;

    return R.createElement('div', { style: { fontFamily: M.font } },
      
      // 👇 核心修改点：如果是测评场景，优先展示测评专属核心指标
      scenarioType === 'review' && R.createElement('div', { style: { marginBottom: 12 } },
        R.createElement('div', { style: sectionTitleStyle }, '测评专属核心指标'),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: '测评返款金额 (当地币)', value: fmt2(calcData.review_return_amount), highlight: true, span: 8 }),
          R.createElement(DataItem, { label: '测评订单的售价回款利润金额 (当地币)', value: fmt2(calcData.review_order_profit_local), highlight: true, span: 8 }),
          R.createElement(DataItem, { label: '测评实际成本 (当地币)', value: fmt2(calcData.review_net_cost), isMoney: true, highlight: true, span: 8 })
        )
      ),

      // 👇 核心修改点：无论什么场景，都展示基础核心指标（测评场景下紧随其后）
      R.createElement('div', { style: { marginBottom: 12 } },
        R.createElement('div', { style: sectionTitleStyle }, scenarioType === 'review' ? '基础核心指标' : '核心指标'),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: '月毛利 (当地币)', value: calcData.gross_profit, highlight: true, span: 8 }),
          R.createElement(DataItem, { label: '毛利率', value: calcData.gross_margin, isPercent: true, highlight: true, span: 8 }),
          R.createElement(DataItem, { label: '月毛利 (RMB)', value: calcData.gross_profit_rmb, isMoney: true, highlight: true, span: 8 })
        )
      ),

      R.createElement('div', { style: { marginBottom: 10 } },
        R.createElement('div', { style: sectionTitleStyle }, '收入'),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: '税费', value: fmt2(calcData.tax_amount), span: 6 }),
          R.createElement(DataItem, { label: '成交售价(不含税)', value: fmt2(calcData.net_price), span: 6 }),
          R.createElement(DataItem, { label: '月成交额', value: fmt2(calcData.monthly_revenue), span: 6 }),
          R.createElement(DataItem, { label: '月退款', value: fmt2(calcData.monthly_refund), span: 6 })
        ),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: '月销售收入', value: fmt2(calcData.net_sales), span: 6 })
        )
      ),
      
      R.createElement('div', { style: { marginBottom: 10 } },
        R.createElement('div', { style: sectionTitleStyle }, '成本明细'),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: '月采购成本', value: fmt2(calcData.monthly_cogs), span: 6 }),
          R.createElement(DataItem, { label: '月物流成本', value: fmt2(calcData.monthly_freight), span: 6 }),
          R.createElement(DataItem, { label: '月佣金', value: fmt2(calcData.monthly_commission), span: 6 }),
          R.createElement(DataItem, { label: '月配送费', value: fmt2(calcData.monthly_fba), span: 6 })
        ),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: '月仓储+配置费', value: fmt2(calcData.monthly_storage), span: 6 }),
          R.createElement(DataItem, { label: '月广告费', value: fmt2(calcData.monthly_ads), span: 6 }),
          R.createElement(DataItem, { label: '月测评推广费', value: fmt2(calcData.monthly_review), span: 6 }),
          R.createElement(DataItem, { label: '月其他费用', value: fmt2(calcData.monthly_other), span: 6 })
        )
      ),
      
      R.createElement('div', { style: { marginBottom: scenarioType === 'review' ? 10 : 0 } },
        R.createElement('div', { style: sectionTitleStyle }, '占比分析'),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: '成本占比', value: fmtPct(calcData.cost_ratio), span: 8 }),
          R.createElement(DataItem, { label: '月物流占比', value: fmtPct(calcData.monthly_logistics_ratio), span: 8 }),
          R.createElement(DataItem, { label: '配送费占比', value: fmtPct(calcData.monthly_shipping_ratio), span: 8 })
        )
      ),
      
      scenarioType === 'review' && R.createElement('div', null,
        R.createElement('div', { style: sectionTitleStyle }, '测评专属其他明细'),
        R.createElement(Row, { gutter: 8 },
          R.createElement(DataItem, { label: 'Coupon 费用', value: fmt2(calcData.coupon_fee), span: 6 })
        )
      )
    );
  };

  const renderInputPanel = (scenarioType) => {
    const isReview       = scenarioType === 'review';
    const form           = isReview ? reviewForm : normalForm;
    const activeScenario = isReview ? activeReviewScenario : activeNormalScenario;
    const onValChange    = isReview ? handleReviewValuesChange : handleNormalValuesChange;
    const defaults       = isReview ? REVIEW_DEFAULTS : NORMAL_DEFAULTS;

    const labelStyle    = { fontSize: FONT_SIZE.inputLabel, color: M.textSecond, fontWeight: 500, fontFamily: M.font };
    const formItemStyle = { marginBottom: 10 };

    return R.createElement(Form, {
      form,
      layout: 'vertical',
      onValuesChange: onValChange,
      initialValues: defaults,
      size: 'small',
    },
      R.createElement('div', { style: sectionTitleStyle }, '基础参数'),
      
      R.createElement(Form.Item, {
        label: R.createElement('span', { style: labelStyle }, '产品类型'),
        name: 'type',
        style: formItemStyle
      },
        R.createElement(Radio.Group, { 
          optionType: "button", 
          buttonStyle: "solid",
          style: { width: '100%', display: 'flex' }
        },
          R.createElement(Radio.Button, { value: 'new', style: { flex: 1, textAlign: 'center' } }, '全新机'),
          R.createElement(Radio.Button, { value: 'used', style: { flex: 1, textAlign: 'center' } }, '检测机')
        )
      ),

      R.createElement(Form.Item, {
        label: R.createElement('span', { style: labelStyle }, '店铺类型'),
        name: 'shop_type',
        style: formItemStyle
      },
        R.createElement(Radio.Group, { 
          optionType: "button", 
          buttonStyle: "solid",
          style: { width: '100%', display: 'flex' }
        },
          R.createElement(Radio.Button, { value: 'normal', style: { flex: 1, textAlign: 'center' } }, '正常'),
          R.createElement(Radio.Button, { value: 'woot', style: { flex: 1, textAlign: 'center' } }, 'Woot')
        )
      ),

      R.createElement(Form.Item, {
        label: R.createElement('span', { style: labelStyle }, '预计折后价（含税，当地币）'),
        name: 'price_with_tax', style: formItemStyle
      },
        R.createElement(InputNumber, { min: 0, precision: 2, style: highlightInputStyle, placeholder: '请输入含税价格' })
      ),

      R.createElement(Form.Item, {
        noStyle: true,
        shouldUpdate: (prevValues, currentValues) => prevValues.shop_type !== currentValues.shop_type,
      },
        ({ getFieldValue }) => {
          const isWoot = getFieldValue('shop_type') === 'woot';
          if (!isWoot) return null;
          return R.createElement(Form.Item, {
            label: R.createElement('span', { style: labelStyle }, '成交售价（不含税）'),
            name: 'net_price', style: formItemStyle,
            help: '默认 = (含税价 - 税) * 0.63，可手动修改'
          },
            R.createElement(InputNumber, { min: 0, precision: 2, style: { ...highlightInputStyle, background: '#f3eeff', borderColor: '#d9cbf2' } })
          );
        }
      ),

      R.createElement(Form.Item, {
        label: R.createElement('span', { style: labelStyle }, '销量'),
        name: 'quantity', style: formItemStyle
      },
        R.createElement(InputNumber, { min: 1, style: inputStyle })
      ),

      isReview && R.createElement(R.Fragment, null,
        R.createElement('div', { style: { ...sectionTitleStyle, marginTop: 12 } }, '测评专属参数'),
        R.createElement(Form.Item, {
          label: R.createElement('span', { style: labelStyle }, '是否使用 Coupon（1=是，0=否）'),
          name: 'use_coupon', style: formItemStyle
        },
          R.createElement(InputNumber, { min: 0, max: 1, style: highlightInputStyle })
        ),
        R.createElement(Form.Item, {
          label: R.createElement('span', { style: labelStyle }, '测评额外佣金手续费（当地币）'),
          name: 'review_extra_fee', style: formItemStyle
        },
          R.createElement(InputNumber, { min: 0, precision: 2, style: highlightInputStyle })
        )
      ),

      R.createElement('div', { style: { ...sectionTitleStyle, marginTop: 12 } }, '费用占比设置'),
      R.createElement(Form.Item, {
        label: R.createElement('span', { style: labelStyle }, '广告费占比（TACOS）%'),
        name: 'ads_rate', style: formItemStyle
      },
        R.createElement(InputNumber, { min: 0, max: 100, precision: 2, style: inputStyle })
      ),
      R.createElement(Form.Item, {
        label: R.createElement('span', { style: labelStyle }, '测评费占比 %'),
        name: 'review_rate', style: formItemStyle
      },
        R.createElement(InputNumber, { min: 0, max: 100, precision: 2, style: inputStyle })
      ),
      R.createElement(Form.Item, {
        label: R.createElement('span', { style: labelStyle }, '其他费用占比 %'),
        name: 'other_rate', style: formItemStyle
      },
        R.createElement(InputNumber, {
          disabled: true,
          value: isReview ? 0 : 1,
          style: { ...inputStyle, background: M.disabledBg, color: M.textMuted }
        })
      ),

      R.createElement('div', { style: { marginTop: 16, borderTop: `1px solid ${M.borderLight}`, paddingTop: 12 } },
        R.createElement('button', { onClick: () => handleSave(scenarioType), style: saveBtnStyle },
          activeScenario ? '更新方案' : '保存方案'
        )
      )
    );
  };

  const renderVisualComparison = (scenarios, scenarioType, activeScenario) => {
    if (!scenarios || scenarios.length === 0) return null;

    const isReview = scenarioType === 'review';
    const title = isReview ? '刷单净成本可视化对比' : '利润率可视化对比';
    
    const barColor = isReview ? '#8c2828' : '#235e36'; 
    const trackBg  = isReview ? '#f2e8e8' : '#eaf2ec'; 

    const sortedScenarios = [...scenarios].sort((a, b) => {
      const priceA = Number(a.price_with_tax) || 0;
      const priceB = Number(b.price_with_tax) || 0;
      return priceB - priceA;
    });

    const maxCost = isReview 
      ? Math.max(...sortedScenarios.map(s => Math.abs(Number(s.review_net_cost) || 0))) 
      : 0;

    return R.createElement('div', { style: { marginTop: 24, padding: '0 8px' } },
      R.createElement('div', { 
        style: { fontSize: 14, fontWeight: 700, color: M.textPrimary, marginBottom: 16 } 
      }, title),
      
      R.createElement('div', { 
        style: { 
          display: 'flex', 
          flexDirection: 'column', 
          gap: 12,
          maxHeight: 320, 
          overflowY: 'auto', 
          paddingRight: 8 
        } 
      },
        sortedScenarios.map((s, idx) => {
          const price = s.price_with_tax || '0.00';
          let barWidth = '0%';
          let innerText = '';
          let rightText = '';

          if (isReview) {
            const cost = Number(s.review_net_cost) || 0;
            const absCost = Math.abs(cost);
            const pct = maxCost > 0 ? (absCost / maxCost) * 100 : 0;
            barWidth = `${Math.min(Math.max(pct, 0), 100)}%`;
            innerText = `亏 ${absCost.toFixed(2)}`;
            rightText = `返款 ${Number(s.review_return_amount || 0).toFixed(2)}`;
          } else {
            const margin = Number(s.gross_margin) || 0;
            barWidth = `${Math.min(Math.max(margin * 100, 0), 100)}%`;
            innerText = `${(margin * 100).toFixed(1)}%`;
            rightText = `利润 ${Number(s.gross_profit || 0).toFixed(1)}`;
          }

          const isActive = s.id === activeScenario?.id;
          const tagText = isReview ? '主档位' : '当前售价';

          return R.createElement('div', { 
            key: s.id || idx, 
            style: { display: 'flex', alignItems: 'center', fontSize: 13 } 
          },
            R.createElement('div', { 
              style: { width: 60, color: M.textSecond, fontFamily: M.fontMono, textAlign: 'right' } 
            }, price),
            
            R.createElement('div', { 
              style: { 
                flex: 1, 
                display: 'flex', 
                alignItems: 'center', 
                background: trackBg, 
                borderRadius: 4, 
                height: 24, 
                overflow: 'hidden', 
                margin: '0 16px' 
              } 
            },
              R.createElement('div', { 
                style: { 
                  width: barWidth, 
                  background: barColor, 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  paddingLeft: 8, 
                  color: '#fff', 
                  fontWeight: 600, 
                  transition: 'width 0.4s ease',
                  borderRadius: 4,
                  minWidth: 'fit-content',
                  paddingRight: 8
                } 
              }, innerText)
            ),
            
            R.createElement('div', { 
              style: { width: 110, color: M.textSecond, display: 'flex', alignItems: 'center', gap: 8 } 
            },
              R.createElement('span', { style: { fontFamily: M.fontMono } }, rightText),
              isActive && R.createElement('span', { 
                style: { 
                  background: barColor, 
                  color: '#fff', 
                  padding: '2px 6px', 
                  borderRadius: 4, 
                  fontSize: 11, 
                  fontWeight: 600,
                  whiteSpace: 'nowrap'
                } 
              }, tagText)
            )
          );
        })
      )
    );
  };

  const renderTab = (scenarioType) => {
    const isReview       = scenarioType === 'review';
    const scenarios      = isReview ? reviewScenarios : normalScenarios;
    const activeScenario = isReview ? activeReviewScenario : activeNormalScenario;
    const calcData       = isReview ? reviewCalc : normalCalc;
    const columns        = isReview ? makeReviewColumns(activeScenario) : makeNormalColumns(activeScenario);

    const paginationConfig = scenarios.length > 5
      ? {
          pageSize: 5,
          size: 'small',
          showTotal: (total) => `共 ${total} 条`,
          style: { marginBottom: 0 },
        }
      : false;

    return R.createElement('div', { 
      style: { 
        fontFamily: M.font, 
        display: 'flex', 
        gap: 16, 
        alignItems: 'flex-start',
        overflowX: 'auto', 
        paddingBottom: 8
      } 
    },
      R.createElement('div', {
        style: {
          ...panelStyle,
          width: 260,
          flexShrink: 0,
        }
      },
        R.createElement('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }
        },
          R.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 6 } },
            R.createElement('span', { style: { fontSize: FONT_SIZE.cardTitle, fontWeight: 600, color: M.textPrimary } },
              activeScenario ? '编辑方案' : '新建方案'),
            activeScenario && R.createElement('span', {
              style: {
                fontSize: 11, color: M.primary,
                background: M.primaryBg,
                padding: '1px 8px', borderRadius: 20, fontWeight: 500,
              }
            }, `#${activeScenario.id}`)
          ),
          R.createElement(Button, { 
            type: 'primary',
            icon: R.createElement(PlusOutlined),
            onClick: () => handleCreateNew(scenarioType), 
            size: 'small',
            style: {
              background: M.green,
              borderColor: M.green,
              borderRadius: M.radiusSm,
              fontWeight: 600,
              boxShadow: '0 2px 6px rgba(138, 181, 160, 0.4)'
            } 
          }, '新建')
        ),
        renderInputPanel(scenarioType)
      ),

      R.createElement('div', {
        style: {
          ...panelStyle,
          flex: 1.2,
          minWidth: 400,
        }
      },
        R.createElement('div', {
          style: { fontSize: FONT_SIZE.cardTitle, fontWeight: 600, color: M.textPrimary, marginBottom: 12 }
        }, '计算结果'),
        renderResultPanel(calcData, scenarioType)
      ),

      R.createElement('div', { 
        style: { 
          ...panelStyle,
          flex: 1.5,
          minWidth: 500,
        } 
      },
        R.createElement('div', {
          style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }
        },
          R.createElement('span', {
            style: { fontSize: FONT_SIZE.cardTitle, fontWeight: 600, color: M.textPrimary, fontFamily: M.font }
          }, '方案列表')
        ),
        R.createElement(Table, {
          dataSource: scenarios,
          columns,
          rowKey: 'id',
          size: 'small',
          pagination: paginationConfig,
          scroll: { x: 'max-content' },
          locale: { emptyText: R.createElement('span', { style: { color: M.textMuted, fontSize: 12 } }, '暂无方案，点击新建') },
          onRow: (record) => ({
            onClick: () => handleSelectScenario(record, scenarioType),
            style: {
              cursor: 'pointer',
              background: activeScenario?.id === record.id ? M.primaryBg : 'transparent',
              transition: 'background 0.15s',
            }
          })
        }),
        renderVisualComparison(scenarios, scenarioType, activeScenario)
      )
    );
  };

  if (loading) {
    return R.createElement('div', {
      style: { display: 'flex', justifyContent: 'center', alignItems: 'center', height: 200 }
    }, R.createElement(Spin, { size: 'large' }));
  }
  if (!asinCountry) {
    return R.createElement('div', {
      style: {
        padding: 20, color: M.red, background: M.redBg,
        borderRadius: M.radius, border: `1px solid ${M.redBd}`,
        fontFamily: M.font, fontWeight: 500,
      }
    }, '错误：URL 缺少 ASIN 或 country 参数');
  }

  const tabItems = [
    { key: 'normal', label: '利润试算', children: renderTab('normal') },
    { key: 'review', label: '测评试算', children: renderTab('review') },
  ];

  return R.createElement('div', {
    style: { padding: 16, background: M.pageBg, minHeight: '100%', fontFamily: M.font }
  },
    R.createElement('div', {
      style: {
        background: M.cardBg,
        borderRadius: M.radius,
        border: `1px solid ${M.border}`,
        boxShadow: M.shadow,
        overflow: 'hidden',
        padding: '0 16px',
      }
    },
      R.createElement(Tabs, {
        activeKey: activeTab,
        onChange: handleTabChange,
        items: tabItems,
        tabBarStyle: { marginBottom: 0, paddingTop: 2 },
      })
    )
  );
}

const App = () => {
  const [configRefresh, setConfigRefresh] = useState(0);
  const [pageParams, setPageParams] = useState(() => mergePageParams(urlParams, readUrlParamsSync()));
  const [paramsSettled, setParamsSettled] = useState(() => Boolean(getAsinCountry(mergePageParams(urlParams, readUrlParamsSync()))));

  useEffect(() => {
    let active = true;

    const applyParams = () => {
      const nextParams = mergePageParams(urlParams, readUrlParamsSync());
      const nextAsinCountry = getAsinCountry(nextParams);

      setPageParams((prev) => {
        const merged = mergePageParams(prev, nextParams);
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

  const handleConfigUpdate = () => {
    setConfigRefresh(prev => prev + 1);
  };

  const pageAsinCountry = getAsinCountry(pageParams);

  if (!pageAsinCountry && !paramsSettled) {
    return React.createElement('div', {
      style: { display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 240 }
    }, React.createElement(Spin, { size: 'large' }));
  }

  if (!pageAsinCountry) {
    return React.createElement('div', {
      style: {
        padding: 20,
        color: M.red,
        background: M.redBg,
        borderRadius: M.radius,
        border: `1px solid ${M.redBd}`,
        fontFamily: M.font,
        fontWeight: 500,
      }
    }, 'URL missing ASIN or country parameter');
  }

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      paddingBottom: '20px'
    }
  },
    React.createElement(ProductConfigDashboard, {
      key: `config-${pageAsinCountry}`,
      onUpdate: handleConfigUpdate,
      pageParams,
    }),
    React.createElement(PricingCalculator, {
      key: `pricing-${pageAsinCountry}`,
      configRefresh,
      asinCountry: pageAsinCountry,
    })
  );
};

ctx.render(React.createElement(App));
