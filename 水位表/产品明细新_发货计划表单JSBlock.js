  const React = ctx.libs.React;
  const { useEffect, useMemo, useState } = React;
  const {
    Button,
    Card,
    DatePicker,
    Form,
    Input,
    InputNumber,
    Select,
    Spin,
    Typography,
  } = ctx.libs.antd;

  const FIELD_LAYOUT = {
    labelCol: { style: { paddingBottom: 0 } },
    style: { marginBottom: 10 },
  };

  function readDirectParam(source, name) {
    if (!source) return '';
    if (typeof source.get === 'function') return source.get(name) || '';
    return source[name] || '';
  }

  function readUrlParams() {
    const direct = ctx.urlSearchParams || {};
    return {
      asin: readDirectParam(direct, 'asin'),
      country: readDirectParam(direct, 'country'),
      shop: readDirectParam(direct, 'shop'),
    };
  }

  const urlParams = readUrlParams();

  function apiRequest(options) {
    if (typeof ctx.request === 'function') return ctx.request(options);
    return ctx.api.request(options);
  }

  function pickRows(response) {
    const data = response?.data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  }

  function toFilter(filter) {
    if (!filter) return undefined;
    return JSON.stringify(filter);
  }

  async function requestList(resource, params) {
    const response = await apiRequest({
      url: `${resource}:list`,
      method: 'get',
      params,
    });
    return pickRows(response);
  }

  async function safeRequestList(resource, params) {
    try {
      return await requestList(resource, params);
    } catch (error) {
      console.warn(`[shipment form] ${resource}:list failed`, error);
      return [];
    }
  }

  function uniqueOptions(rows, valueKey, labelKey) {
    const seen = new Set();
    return rows
      .map((row) => {
        const rawValue = row?.[valueKey];
        const rawLabel = row?.[labelKey] || rawValue;
        if (rawValue === undefined || rawValue === null || rawValue === '') return null;
        const value = String(rawValue);
        if (seen.has(value)) return null;
        seen.add(value);
        return { value, label: String(rawLabel), row };
      })
      .filter(Boolean);
  }

  function toDateText(value) {
    if (!value) return undefined;
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.format === 'function') return value.format('YYYY-MM-DD');
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return undefined;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function rowStyle(columns) {
    return {
      display: 'grid',
      gridTemplateColumns: columns === 1 ? '1fr' : 'minmax(0, 1fr) minmax(0, 1fr)',
      columnGap: 16,
      width: '100%',
    };
  }

  function makeInitialValues(params) {
    return {
      shop: '',
      sku: undefined,
      shop_info: undefined,
      date: undefined,
      number: undefined,
      logistics_channel: undefined,
      msku_info: undefined,
      asin: params.asin || '',
      country: params.country || '',
      sku_1: '',
      shop_id: '',
      channel: '',
      msku: '',
    };
  }

  async function readRuntimeParams(fallbackParams) {
    const next = { ...fallbackParams };
    if (typeof ctx.getVar === 'function') {
      next.asin = next.asin || await ctx.getVar('ctx.urlSearchParams.asin') || '';
      next.country = next.country || await ctx.getVar('ctx.urlSearchParams.country') || '';
      next.shop = next.shop || await ctx.getVar('ctx.urlSearchParams.shop') || '';
    }
    return next;
  }

  function ShipmentCreateForm() {
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [runtimeParams, setRuntimeParams] = useState(urlParams);
    const [skuOptions, setSkuOptions] = useState([]);
    const [shopOptions, setShopOptions] = useState([]);
    const [channelOptions, setChannelOptions] = useState([]);
    const [mskuOptions, setMskuOptions] = useState([]);

    const initialValues = useMemo(() => makeInitialValues(runtimeParams), [
      runtimeParams.asin,
      runtimeParams.country,
      runtimeParams.shop,
    ]);

    async function loadSelectOptions(activeParams = runtimeParams) {
      setLoading(true);
      const activeInitialValues = makeInitialValues(activeParams);
      form.setFieldsValue(activeInitialValues);

      const mskuFilter = {
        $and: [
          { country: { $eq: activeParams.country || '' } },
          { asin: { $eq: activeParams.asin || '' } },
        ],
      };

      const shopFilter = {
        country: { $eq: activeParams.country || '' },
      };

      const [skuRows, shopRows, channelRows, mskuRows] = await Promise.all([
        safeRequestList('sku', {
          page: 1,
          pageSize: 1000,
        }),
        safeRequestList('shop', {
          page: 1,
          pageSize: 1000,
          filter: toFilter(shopFilter),
        }),
        safeRequestList('logistics_days', {
          page: 1,
          pageSize: 1000,
        }),
        safeRequestList('msku', {
          page: 1,
          pageSize: 1000,
          filter: toFilter(mskuFilter),
        }),
      ]);

      const nextSkuOptions = uniqueOptions(skuRows, 'sku', 'sku');
      const nextShopOptions = uniqueOptions(shopRows, 'sid', 'short_name');
      const nextChannelOptions = uniqueOptions(channelRows, 'logistics_days', 'logistics_days');
      const nextMskuOptions = uniqueOptions(mskuRows, 'msku', 'msku');

      setSkuOptions(nextSkuOptions);
      setShopOptions(nextShopOptions);
      setChannelOptions(nextChannelOptions);
      setMskuOptions(nextMskuOptions);

      const matchedShop = nextShopOptions.find((item) => item.row?.short_name === activeParams.shop);
      form.setFieldsValue({
        ...activeInitialValues,
        shop_info: matchedShop?.value,
        shop_id: matchedShop?.row?.sid || '',
      });
      setLoading(false);
    }

    useEffect(() => {
      async function boot() {
        const nextParams = await readRuntimeParams(urlParams);
        setRuntimeParams(nextParams);
        form.setFieldsValue(makeInitialValues(nextParams));
        loadSelectOptions(nextParams);
      }
      boot();
    }, []);

    function handleSkuChange(value) {
      form.setFieldsValue({ sku: value, sku_1: value || '' });
    }

    function handleLogisticsChange(value) {
      form.setFieldsValue({ logistics_channel: value, channel: value || '' });
    }

    function handleShopInfoChange(value, option) {
      const row = option?.row || shopOptions.find((item) => item.value === value)?.row;
      form.setFieldsValue({
        shop_info: value,
        shop_id: row?.sid || '',
        shop: row?.short_name || form.getFieldValue('shop') || '',
      });
    }

    function handleMskuChange(value) {
      form.setFieldsValue({ msku_info: value, msku: value || '' });
    }

    async function handleSubmit(values) {
      const payload = {
        shop: values.shop || null,
        sku_1: values.sku || values.sku_1 || null,
        shop_id: values.shop_info || values.shop_id || null,
        date: toDateText(values.date),
        number: values.number,
        channel: values.logistics_channel || values.channel || null,
        msku: values.msku_info || values.msku || null,
        asin: values.asin || null,
        country: values.country || null,
      };

      setSubmitting(true);
      try {
        await apiRequest({
          url: 'simulate_shipment:create',
          method: 'post',
          data: payload,
        });
        ctx.message?.success?.('提交成功');
        form.resetFields(['sku', 'shop_info', 'date', 'number', 'logistics_channel', 'msku_info']);
        form.setFieldsValue({
          shop: '',
          asin: runtimeParams.asin || '',
          country: runtimeParams.country || '',
          sku_1: '',
          shop_id: '',
          channel: '',
          msku: '',
        });
      } catch (error) {
        ctx.message?.error?.(`提交失败：${error.message || error}`);
      } finally {
        setSubmitting(false);
      }
    }

    return React.createElement(Card, {
      size: 'small',
      title: '新增发货计划',
      bodyStyle: { padding: 12 },
      extra: React.createElement(Button, {
        size: 'small',
        onClick: loadSelectOptions,
        loading,
      }, '刷新'),
    },
      loading
        ? React.createElement(Spin, { size: 'small' })
        : React.createElement(Form, {
          form,
          layout: 'vertical',
          size: 'small',
          initialValues,
          onFinish: handleSubmit,
        },
          React.createElement('div', { style: rowStyle(2) },
            React.createElement(Form.Item, {
              ...FIELD_LAYOUT,
              name: 'sku',
              label: 'SKU信息',
              rules: [{ required: true, message: '请选择SKU信息' }],
            },
              React.createElement(Select, {
                showSearch: true,
                allowClear: true,
                optionFilterProp: 'label',
                options: skuOptions,
                onChange: handleSkuChange,
                placeholder: '请选择SKU信息',
              }),
            ),
            React.createElement(Form.Item, {
              ...FIELD_LAYOUT,
              name: 'shop_info',
              label: '店铺信息',
              rules: [{ required: true, message: '请选择店铺信息' }],
            },
              React.createElement(Select, {
                showSearch: true,
                allowClear: true,
                optionFilterProp: 'label',
                options: shopOptions,
                onChange: handleShopInfoChange,
                placeholder: '请选择店铺信息',
              }),
            ),
          ),
          React.createElement('div', { style: rowStyle(2) },
            React.createElement(Form.Item, {
              ...FIELD_LAYOUT,
              name: 'date',
              label: '发货日期',
              rules: [{ required: true, message: '请选择发货日期' }],
            },
              React.createElement(DatePicker, {
                style: { width: '100%' },
                format: 'YYYY-MM-DD',
              }),
            ),
            React.createElement(Form.Item, {
              ...FIELD_LAYOUT,
              name: 'number',
              label: '发货量',
              rules: [{ required: true, message: '请输入发货量' }],
            },
              React.createElement(InputNumber, {
                min: 0,
                precision: 0,
                step: 1,
                stringMode: true,
                style: { width: '100%' },
              }),
            ),
          ),
          React.createElement('div', { style: rowStyle(2) },
            React.createElement(Form.Item, {
              ...FIELD_LAYOUT,
              name: 'logistics_channel',
              label: '物流渠道信息',
              rules: [{ required: true, message: '请选择物流渠道信息' }],
            },
              React.createElement(Select, {
                showSearch: true,
                allowClear: true,
                optionFilterProp: 'label',
                options: channelOptions,
                onChange: handleLogisticsChange,
                placeholder: '请选择物流渠道信息',
              }),
            ),
            React.createElement(Form.Item, { ...FIELD_LAYOUT, name: 'msku_info', label: 'MSKU信息' },
              React.createElement(Select, {
                showSearch: true,
                allowClear: true,
                optionFilterProp: 'label',
                options: mskuOptions,
                onChange: handleMskuChange,
                placeholder: '请选择MSKU信息',
              }),
            ),
          ),
          React.createElement(Form.Item, { name: 'shop', hidden: true, preserve: true },
            React.createElement(Input),
          ),
          React.createElement(Form.Item, {
            name: 'asin',
            hidden: true,
            preserve: true,
            rules: [{ required: true, message: '请输入ASIN' }],
          },
            React.createElement(Input),
          ),
          React.createElement(Form.Item, {
            name: 'country',
            hidden: true,
            preserve: true,
            rules: [{ required: true, message: '请输入国家' }],
          },
            React.createElement(Input),
          ),
          React.createElement(Form.Item, { name: 'sku_1', hidden: true }, React.createElement(Input)),
          React.createElement(Form.Item, { name: 'shop_id', hidden: true }, React.createElement(Input)),
          React.createElement(Form.Item, { name: 'channel', hidden: true }, React.createElement(Input)),
          React.createElement(Form.Item, { name: 'msku', hidden: true }, React.createElement(Input)),
          React.createElement(Typography.Text, {
            type: 'secondary',
            style: { display: 'block', marginBottom: 8, fontSize: 12 },
          }, `${runtimeParams.asin || '-'} / ${runtimeParams.country || '-'} / ${runtimeParams.shop || '-'}`),
          React.createElement(Button, {
            type: 'primary',
            htmlType: 'submit',
            loading: submitting,
            block: true,
          }, '提交'),
        ),
    );
  }

  ctx.render(React.createElement(ShipmentCreateForm));
