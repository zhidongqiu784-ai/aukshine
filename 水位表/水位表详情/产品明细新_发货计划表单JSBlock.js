  const React = ctx.libs.React;
  const { useEffect, useMemo, useRef, useState } = React;
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

  const DATE_PICKER_LOCALE = {
    lang: {
      locale: 'zh_CN',
      placeholder: '请选择日期',
      rangePlaceholder: ['开始日期', '结束日期'],
      today: '今天',
      now: '此刻',
      backToToday: '返回今天',
      ok: '确定',
      clear: '清除',
      month: '月',
      year: '年',
      yearFormat: 'YYYY年',
      monthFormat: 'M月',
      monthBeforeYear: false,
      previousMonth: '上个月',
      nextMonth: '下个月',
      previousYear: '上一年',
      nextYear: '下一年',
      shortWeekDays: ['日', '一', '二', '三', '四', '五', '六'],
      shortMonths: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    },
    timePickerLocale: { placeholder: '请选择时间' },
  };

  ctx.dayjs?.locale?.('zh-cn');

  const FIELD_LAYOUT = {
    labelCol: { style: { paddingBottom: 0 } },
    style: { marginBottom: 10 },
  };
  const MSKU_PAGE_SIZE = 1000;

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

  function clickRefreshButton(block) {
    if (!block || typeof block.querySelectorAll !== 'function') return false;
    const buttons = Array.from(block.querySelectorAll('button'));
    const refreshButton = buttons.find((button) => String(button.textContent || '').includes('全部刷新'))
      || buttons.find((button) => String(button.textContent || '').includes('刷新'));
    if (!refreshButton || typeof refreshButton.click !== 'function') return false;
    refreshButton.click();
    return true;
  }

  function refreshBlockByUid(uid) {
    const host = ctx.element;
    const root = host?.getRootNode?.();
    if (!root || typeof root.querySelector !== 'function') return false;

    const selectors = [
      `[data-uid="${uid}"]`,
      `[data-schema-uid="${uid}"]`,
      `[data-block-uid="${uid}"]`,
      `[data-node-id="${uid}"]`,
      `#${uid}`,
    ];
    const block = selectors.map((selector) => root.querySelector(selector)).find(Boolean);
    return clickRefreshButton(block);
  }

  function refreshBlockByTitle(title) {
    const host = ctx.element;
    const root = host?.getRootNode?.();
    if (!root || typeof root.querySelectorAll !== 'function') return false;

    const cards = Array.from(root.querySelectorAll('.ant-card'));
    const card = cards.find((item) => {
      const titleNode = item.querySelector?.('.ant-card-head-title');
      return String(titleNode?.textContent || item.textContent || '').includes(title);
    });
    return clickRefreshButton(card);
  }

  function refreshRegisteredBlock(uid) {
    const host = ctx.element;
    const root = host?.getRootNode?.();
    const refresh = root?.__aukshineRefreshBlocks?.[uid];
    if (typeof refresh !== 'function') return false;

    Promise.resolve(refresh()).catch((error) => {
      console.warn(`[shipment form] refresh ${uid} failed`, error);
    });
    return true;
  }

  function refreshRelatedBlocks() {
    refreshBlockByUid('a2be4eb347e');
    if (!refreshRegisteredBlock('a321504fa79') && !refreshBlockByTitle('模拟发货计划')) {
      refreshBlockByUid('a321504fa79');
    }
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

  function mergeUniqueOptions(currentOptions, rows, valueKey, labelKey) {
    const seen = new Set(currentOptions.map((option) => String(option.value)));
    const nextOptions = currentOptions.slice();
    rows.forEach((row) => {
      const rawValue = row?.[valueKey];
      const rawLabel = row?.[labelKey] || rawValue;
      if (rawValue === undefined || rawValue === null || rawValue === '') return;
      const value = String(rawValue);
      if (seen.has(value)) return;
      seen.add(value);
      nextOptions.push({ value, label: String(rawLabel), row });
    });
    return nextOptions;
  }

  function makeMskuFilter(activeParams) {
    return {
      $and: [
        { asin: { $eq: activeParams.asin || '' } },
      ],
    };
  }

  function makeCurrentInventoryOptions(rows) {
    const seen = new Set();
    return rows
      .map((row) => {
        const value = row?.sid_msku;
        if (value === undefined || value === null || value === '') return null;
        if (seen.has(value)) return null;
        seen.add(value);
        const label = row?.shop || value;
        return { value: String(value), label: String(label), row };
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
      current_inventory_info: undefined,
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
      sid_msku: '',
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
    const [currentInventoryOptions, setCurrentInventoryOptions] = useState([]);
    const [channelOptions, setChannelOptions] = useState([]);
    const [mskuOptions, setMskuOptions] = useState([]);
    const [mskuLoadingMore, setMskuLoadingMore] = useState(false);
    const mskuPageRef = useRef(1);
    const mskuHasMoreRef = useRef(false);
    const mskuLoadingRef = useRef(false);
    const mskuParamsRef = useRef(runtimeParams);

    const initialValues = useMemo(() => makeInitialValues(runtimeParams), [
      runtimeParams.asin,
      runtimeParams.country,
      runtimeParams.shop,
    ]);

    async function loadSelectOptions(activeParams = runtimeParams) {
      setLoading(true);
      mskuParamsRef.current = activeParams;
      const activeInitialValues = makeInitialValues(activeParams);
      form.setFieldsValue(activeInitialValues);

      const mskuFilter = makeMskuFilter(activeParams);

      const currentInventoryFilterItems = [
        { country: { $eq: activeParams.country || '' } },
        { asin: { $eq: activeParams.asin || '' } },
        { shop: { $ne: '合计' } },
        { shop_country_asin: { $notEmpty: true } },
      ];
      if (activeParams.shop && activeParams.shop !== '合计') {
        currentInventoryFilterItems.push({ shop: { $eq: activeParams.shop } });
      }
      const currentInventoryFilter = { $and: currentInventoryFilterItems };

      const [skuRows, currentInventoryRows, channelRows, mskuRows] = await Promise.all([
        safeRequestList('sku', {
          page: 1,
          pageSize: 1000,
        }),
        safeRequestList('current_stock', {
          page: 1,
          pageSize: 1000,
          filter: toFilter(currentInventoryFilter),
        }),
        safeRequestList('logistics_days', {
          page: 1,
          pageSize: 1000,
        }),
        safeRequestList('msku', {
          page: 1,
          pageSize: MSKU_PAGE_SIZE,
          filter: toFilter(mskuFilter),
        }),
      ]);

      const nextSkuOptions = uniqueOptions(skuRows, 'sku', 'sku');
      const nextCurrentInventoryOptions = makeCurrentInventoryOptions(currentInventoryRows);
      const nextChannelOptions = uniqueOptions(channelRows, 'logistics_days', 'logistics_days');
      const nextMskuOptions = uniqueOptions(mskuRows, 'msku', 'msku');

      setSkuOptions(nextSkuOptions);
      setCurrentInventoryOptions(nextCurrentInventoryOptions);
      setChannelOptions(nextChannelOptions);
      setMskuOptions(nextMskuOptions);
      mskuPageRef.current = 1;
      mskuHasMoreRef.current = mskuRows.length >= MSKU_PAGE_SIZE;

      const matchedInventory = activeParams.shop && activeParams.shop !== '合计'
        ? nextCurrentInventoryOptions.find((item) => item.row?.shop === activeParams.shop)
        : undefined;
      form.setFieldsValue({
        ...activeInitialValues,
        current_inventory_info: matchedInventory?.value,
        shop_id: matchedInventory?.row?.sid || '',
        shop: matchedInventory?.row?.shop || '',
        sid_msku: matchedInventory?.row?.sid_msku || '',
      });
      setLoading(false);
    }

    async function loadMoreMskuOptions() {
      if (mskuLoadingRef.current || !mskuHasMoreRef.current) return;
      mskuLoadingRef.current = true;
      setMskuLoadingMore(true);
      const nextPage = mskuPageRef.current + 1;
      try {
        const rows = await safeRequestList('msku', {
          page: nextPage,
          pageSize: MSKU_PAGE_SIZE,
          filter: toFilter(makeMskuFilter(mskuParamsRef.current)),
        });
        setMskuOptions((currentOptions) => mergeUniqueOptions(currentOptions, rows, 'msku', 'msku'));
        mskuPageRef.current = nextPage;
        mskuHasMoreRef.current = rows.length >= MSKU_PAGE_SIZE;
      } finally {
        mskuLoadingRef.current = false;
        setMskuLoadingMore(false);
      }
    }

    function handleMskuPopupScroll(event) {
      const target = event?.target;
      if (!target) return;
      if (target.scrollTop + target.offsetHeight < target.scrollHeight - 48) return;
      loadMoreMskuOptions();
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

    function handleCurrentInventoryChange(value, option) {
      const row = option?.row || currentInventoryOptions.find((item) => item.value === value)?.row;
      form.setFieldsValue({
        current_inventory_info: value,
        shop_id: row?.sid || '',
        shop: row?.shop || '',
        sid_msku: row?.sid_msku || '',
      });
    }

    function handleMskuChange(value) {
      form.setFieldsValue({ msku_info: value, msku: value || '' });
    }

    async function handleSubmit(values) {
      const currentInventoryOption = currentInventoryOptions.find((item) => item.value === values.current_inventory_info);
      const currentInventoryRow = currentInventoryOption?.row;
      const payload = {
        shop: currentInventoryRow?.shop || values.shop || null,
        sku_1: values.sku || values.sku_1 || null,
        shop_id: currentInventoryRow?.sid || values.shop_id || null,
        sid_msku: values.current_inventory_info || values.sid_msku || null,
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
        setTimeout(refreshRelatedBlocks, 1500);
        form.resetFields(['sku', 'current_inventory_info', 'date', 'number', 'logistics_channel', 'msku_info']);
        form.setFieldsValue({
          shop: '',
          asin: runtimeParams.asin || '',
          country: runtimeParams.country || '',
          sku_1: '',
          shop_id: '',
          channel: '',
          msku: '',
          sid_msku: '',
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
        onClick: () => loadSelectOptions(runtimeParams),
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
              name: 'current_inventory_info',
              label: '店铺',
              rules: [{ required: true, message: '请选择店铺' }],
            },
              React.createElement(Select, {
                showSearch: true,
                allowClear: true,
                optionFilterProp: 'label',
                options: currentInventoryOptions,
                onChange: handleCurrentInventoryChange,
                placeholder: '请选择店铺',
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
                locale: DATE_PICKER_LOCALE,
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
                loading: mskuLoadingMore,
                onPopupScroll: handleMskuPopupScroll,
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
          React.createElement(Form.Item, { name: 'sid_msku', hidden: true }, React.createElement(Input)),
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
