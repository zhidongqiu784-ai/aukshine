const React = ctx.libs.React;
const { useCallback, useEffect, useMemo, useRef, useState } = React;
const {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} = ctx.libs.antd;
const dayjs = ctx.dayjs;
const MSKU_PAGE_SIZE = 1000;

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

dayjs?.locale?.('zh-cn');

function apiRequest(options) {
  if (typeof ctx.request === 'function') return ctx.request(options);
  return ctx.api.request(options);
}

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

function pickRows(response) {
  const data = response?.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function pickMeta(response) {
  return response?.data?.meta || response?.meta || {};
}

function optionByValue(options, value) {
  return options.find((option) => String(option.value) === String(value));
}

function refreshSalesTableBlock() {
  const host = ctx.element;
  const root = host?.getRootNode?.();
  if (!root || typeof root.querySelector !== 'function') return false;

  const selectors = [
    '[data-uid="a2be4eb347e"]',
    '[data-schema-uid="a2be4eb347e"]',
    '[data-block-uid="a2be4eb347e"]',
    '[data-node-id="a2be4eb347e"]',
    '#a2be4eb347e',
  ];
  const block = selectors.map((selector) => root.querySelector(selector)).find(Boolean);
  if (!block || typeof block.querySelectorAll !== 'function') return false;

  const buttons = Array.from(block.querySelectorAll('button'));
  const refreshButton = buttons.find((button) => String(button.textContent || '').includes('全部刷新'))
    || buttons.find((button) => String(button.textContent || '').includes('刷新'));
  if (!refreshButton || typeof refreshButton.click !== 'function') return false;
  refreshButton.click();
  return true;
}

function getValue(row, path) {
  return String(path).split('.').reduce((value, key) => (value == null ? undefined : value[key]), row);
}

function getColumnValue(row, column) {
  if (column.key === 'expected_storage_time') {
    return getValue(row, 'invoice_information.estimated_arrival_date')
      || getValue(row, 'invoice_information.expected_storage_time');
  }
  return getValue(row, column.path);
}

function toDateText(value) {
  if (!value) return undefined;
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value?.format === 'function') return value.format('YYYY-MM-DD');
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString().slice(0, 10);
}

function toDayjs(value) {
  if (!value || !dayjs) return undefined;
  const parsed = dayjs(value);
  return parsed?.isValid?.() ? parsed : undefined;
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
      return { value: String(value), label: String(row?.shop || value), row };
    })
    .filter(Boolean);
}

function formatCell(value) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function getCellDisplayText(row, column) {
  const value = getColumnValue(row, column);
  if (column.date) return toDateText(value) || '-';
  return formatCell(value);
}

function measureTextWidth(text) {
  return Array.from(String(text || '')).reduce((width, char) => {
    const code = char.charCodeAt(0);
    if (code > 255) return width + 14;
    if (/[A-Z0-9]/.test(char)) return width + 8;
    if (/[a-z]/.test(char)) return width + 7;
    return width + 6;
  }, 0);
}

function calculateColumnWidth(column, rows, optionTexts = []) {
  const sortIconWidth = SORTABLE_FIELDS[column.key] ? 24 : 0;
  const titleWidth = measureTextWidth(column.title) + (column.editable ? 18 : 0) + sortIconWidth;
  const contentWidth = rows.reduce((maxWidth, row) => {
    return Math.max(maxWidth, measureTextWidth(getCellDisplayText(row, column)));
  }, 0);
  const optionWidth = optionTexts.reduce((maxWidth, text) => {
    return Math.max(maxWidth, measureTextWidth(text));
  }, 0);
  const padding = column.align === 'right' ? 34 : 30;
  const minWidth = column.minWidth || (column.editable ? 90 : 75);
  const maxWidth = column.maxWidth || 260;
  return Math.min(maxWidth, Math.max(minWidth, titleWidth, contentWidth, optionWidth) + padding);
}

function calculateEditorWidth(row, column, editValue, optionTexts = []) {
  const currentWidth = measureTextWidth(getCellDisplayText(row, column));
  const valueWidth = measureTextWidth(column.type === 'date' ? toDateText(editValue) : editValue);
  const optionWidth = optionTexts.reduce((maxWidth, text) => {
    return Math.max(maxWidth, measureTextWidth(text));
  }, 0);
  const minWidthByType = {
    text: 150,
    msku: 200,
    sku: 82,
    channel: 180,
    season: 110,
    number: 110,
    date: 140,
  };
  const maxWidthByType = {
    sku: 140,
    msku: 360,
    channel: 300,
    text: 260,
  };
  return Math.min(maxWidthByType[column.type] || 420, Math.max(minWidthByType[column.type] || 160, currentWidth, valueWidth, optionWidth) + 44);
}

const TABLE_COLUMNS = [
  { key: 'shippment_id', title: 'FBA货件单号', path: 'shippment_id', editable: true, type: 'text', field: 'shippment_id', minWidth: 150, maxWidth: 150 },
  { key: 'country_info', title: '国家', path: 'country_info.country_code' , maxWidth: 60},
  { key: 'asin', title: 'ASIN', path: 'asin', minWidth: 100, maxWidth: 180 },
  { key: 'shop_info', title: '店铺', path: 'shop_info.short_name' },
  { key: 'season', title: '淡旺季', path: 'season' },
  { key: 'msku', title: 'MSKU', path: 'msku', editable: true, type: 'msku', field: 'msku', minWidth: 255, maxWidth: 270 },
  { key: 'sku', title: 'SKU信息', path: 'sku.sku', editable: true, type: 'sku', field: 'sku_1', required: true, maxWidth: 220 },
  { key: 'number', title: '发货量', path: 'number', align: 'right', editable: true, type: 'number', field: 'number', required: true },
  { key: 'date', title: '发货日期', path: 'date', date: true, editable: true, type: 'date', field: 'date', required: true },
  { key: 'logistics_channel', title: '物流渠道信息', path: 'logistics_channel.logistics_days', editable: true, type: 'channel', field: 'channel', required: true, maxWidth: 300 },
  { key: 'days', title: '天数', path: 'logistics_channel.days', align: 'right' },
  { key: 'warehouse_days', title: '入库时效', path: 'warehouse_days', align: 'right' },
  { key: 'add_date', title: '模拟入库日期', path: 'add_date', date: true },
  { key: 'expected_storage_time', title: '发货单入库日期', path: 'invoice_information.expected_storage_time', date: true },
  { key: 'f_vhtze52n07d', title: '最后修改日期', path: 'f_vhtze52n07d', date: true, maxWidth: 180 },
  { key: 'f_i4gws625myg', title: '最后修改人', path: 'f_i4gws625myg.username' },
];

const SORTABLE_FIELDS = {
  date: 'date',
  add_date: 'add_date',
};

function getEditValue(row, column) {
  if (column.key === 'sku') return row.sku_1 || row.sku?.sku || undefined;
  if (column.key === 'logistics_channel') return row.channel || row.logistics_channel?.logistics_days || undefined;
  if (column.key === 'date') return toDayjs(row.date);
  return getValue(row, column.path);
}

function normalizeEditValue(column, value) {
  if (column.type === 'date') return toDateText(value);
  if (column.type === 'number') return value;
  return value === undefined || value === null ? '' : String(value);
}

function getSortParam(sortState) {
  if (!sortState?.field || !sortState.order) return undefined;
  return sortState.order === 'descend' ? `-${sortState.field}` : sortState.field;
}

function ShipmentPlanBlock() {
  const [copyForm] = Form.useForm();
  const datePickerOpenRef = useRef(false);
  const selectCommitRef = useRef(false);
  const [params, setParams] = useState(readUrlParams);
  const [rows, setRows] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyModalOpen, setCopyModalOpen] = useState(false);
  const [copySourceRow, setCopySourceRow] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState(undefined);
  const [savingCell, setSavingCell] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [skuOptions, setSkuOptions] = useState([]);
  const [currentInventoryOptions, setCurrentInventoryOptions] = useState([]);
  const [channelOptions, setChannelOptions] = useState([]);
  const [mskuOptions, setMskuOptions] = useState([]);
  const [mskuLoadingMore, setMskuLoadingMore] = useState(false);
  const [sortState, setSortState] = useState({ field: '', order: null });
  const mskuPageRef = useRef(1);
  const mskuHasMoreRef = useRef(false);
  const mskuLoadingRef = useRef(false);
  const mskuParamsRef = useRef(params);

  async function resolveParams() {
    const next = readUrlParams();
    if (typeof ctx.getVar === 'function') {
      next.asin = next.asin || await ctx.getVar('ctx.urlSearchParams.asin') || '';
      next.country = next.country || await ctx.getVar('ctx.urlSearchParams.country') || '';
      next.shop = next.shop || await ctx.getVar('ctx.urlSearchParams.shop') || '';
    }
    setParams(next);
    return next;
  }

  const requestRows = useCallback(async (nextPage = page, nextPageSize = pageSize, activeParams = params, activeSort = sortState, options = {}) => {
    if (!activeParams.asin || !activeParams.country) {
      setRows([]);
      setTotal(0);
      return;
    }

    if (!options.silent) setLoading(true);
    try {
      const sort = getSortParam(activeSort);
      const response = await apiRequest({
        url: 'simulate_shipment:list',
        method: 'get',
        params: {
          page: nextPage,
          pageSize: nextPageSize,
          ...(sort ? { sort } : {}),
          appends: 'shop_info,current_inventory_info,country_info,logistics_channel,invoice_information,f_i4gws625myg,sku',
          filter: JSON.stringify({
            $and: [
              { asin: { $eq: activeParams.asin } },
              { country: { $eq: activeParams.country } },
            ],
          }),
        },
      });
      const meta = pickMeta(response);
      setRows(pickRows(response));
      setTotal(Number(meta.count || meta.total || 0));
    } catch (error) {
      ctx.message?.error?.(`模拟发货计划加载失败：${error.message || error}`);
    } finally {
      if (!options.silent) setLoading(false);
    }
  }, [page, pageSize, params.asin, params.country, sortState]);

  useEffect(() => {
    const host = ctx.element;
    const root = host?.getRootNode?.();
    if (!root) return undefined;

    const registry = root.__aukshineRefreshBlocks || {};
    const refreshSelf = () => requestRows(page, pageSize, params);
    registry.a321504fa79 = refreshSelf;
    root.__aukshineRefreshBlocks = registry;

    return () => {
      if (root.__aukshineRefreshBlocks?.a321504fa79 === refreshSelf) {
        delete root.__aukshineRefreshBlocks.a321504fa79;
      }
    };
  }, [requestRows, page, pageSize, params]);

  async function loadOptions(activeParams = params) {
    mskuParamsRef.current = activeParams;
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
      apiRequest({
        url: 'sku:list',
        method: 'get',
        params: { page: 1, pageSize: 1000 },
      }).then(pickRows).catch(() => []),
      apiRequest({
        url: 'current_stock:list',
        method: 'get',
        params: {
          page: 1,
          pageSize: 1000,
          filter: JSON.stringify(currentInventoryFilter),
        },
      }).then(pickRows).catch(() => []),
      apiRequest({
        url: 'logistics_days:list',
        method: 'get',
        params: { page: 1, pageSize: 1000 },
      }).then(pickRows).catch(() => []),
      apiRequest({
        url: 'msku:list',
        method: 'get',
        params: {
          page: 1,
          pageSize: MSKU_PAGE_SIZE,
          filter: JSON.stringify(mskuFilter),
        },
      }).then(pickRows).catch(() => []),
    ]);

    setSkuOptions(uniqueOptions(skuRows, 'sku', 'sku'));
    setCurrentInventoryOptions(makeCurrentInventoryOptions(currentInventoryRows));
    setChannelOptions(uniqueOptions(channelRows, 'logistics_days', 'logistics_days'));
    setMskuOptions(uniqueOptions(mskuRows, 'msku', 'msku'));
    mskuPageRef.current = 1;
    mskuHasMoreRef.current = mskuRows.length >= MSKU_PAGE_SIZE;
  }

  async function loadMoreMskuOptions() {
    if (mskuLoadingRef.current || !mskuHasMoreRef.current) return;
    mskuLoadingRef.current = true;
    setMskuLoadingMore(true);
    const nextPage = mskuPageRef.current + 1;
    try {
      const rows = await apiRequest({
        url: 'msku:list',
        method: 'get',
        params: {
          page: nextPage,
          pageSize: MSKU_PAGE_SIZE,
          filter: JSON.stringify(makeMskuFilter(mskuParamsRef.current)),
        },
      }).then(pickRows).catch(() => []);
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
      const nextParams = await resolveParams();
      await Promise.all([
        requestRows(1, pageSize, nextParams),
        loadOptions(nextParams),
      ]);
    }
    boot();
  }, []);

  function getCopyInitialValues(row) {
    const currentInventoryValue = row.sid_msku
      || row.current_inventory_info?.sid_msku
      || currentInventoryOptions.find((option) => {
        return option.row?.shop === row.shop_info?.short_name
          || option.row?.sid === row.shop_id
          || option.row?.sid === row.shop_info?.sid;
      })?.value;
    return {
      sku: row.sku_1 || row.sku?.sku || undefined,
      current_inventory_info: currentInventoryValue,
      date: toDayjs(row.date),
      number: row.number,
      logistics_channel: row.channel || row.logistics_channel?.logistics_days || undefined,
      msku_info: row.msku || undefined,
    };
  }

  function openCopyModal(row) {
    cancelCellEdit();
    setCopySourceRow(row);
    copyForm.setFieldsValue(getCopyInitialValues(row));
    setCopyModalOpen(true);
  }

  function closeCopyModal() {
    if (copying) return;
    setCopyModalOpen(false);
    setCopySourceRow(null);
    copyForm.resetFields();
  }

  async function submitCopy() {
    if (!copySourceRow || copying) return;
    let values;
    try {
      values = await copyForm.validateFields();
    } catch {
      return;
    }

    const currentInventoryOption = optionByValue(currentInventoryOptions, values.current_inventory_info);
    const payload = {
      shop: currentInventoryOption?.row?.shop || copySourceRow.shop_info?.short_name || copySourceRow.shop || null,
      sku_1: values.sku || copySourceRow.sku_1 || copySourceRow.sku?.sku || null,
      shop_id: currentInventoryOption?.row?.sid || copySourceRow.shop_id || copySourceRow.shop_info?.sid || null,
      sid_msku: values.current_inventory_info || copySourceRow.sid_msku || null,
      date: toDateText(values.date),
      number: values.number,
      channel: values.logistics_channel || copySourceRow.channel || copySourceRow.logistics_channel?.logistics_days || null,
      msku: values.msku_info || copySourceRow.msku || null,
      asin: params.asin || copySourceRow.asin || null,
      country: params.country || copySourceRow.country_info?.country_code || copySourceRow.country || null,
    };

    setCopying(true);
    try {
      await apiRequest({
        url: 'simulate_shipment:create',
        method: 'post',
        data: payload,
      });
      ctx.message?.success?.('复制创建成功，新增工作流已触发');
      setCopyModalOpen(false);
      setCopySourceRow(null);
      copyForm.resetFields();
      const copySortState = { field: 'date', order: 'ascend' };
      setSortState(copySortState);
      await requestRows(page, pageSize, params, copySortState);
      setTimeout(() => {
        requestRows(page, pageSize, params, copySortState);
        refreshSalesTableBlock();
      }, 1500);
    } catch (error) {
      ctx.message?.error?.(`复制创建失败：${error.message || error}`);
    } finally {
      setCopying(false);
    }
  }

  function startCellEdit(row, column) {
    if (!column.editable || savingCell) return;
    setEditingCell({ rowId: row.id, columnKey: column.key });
    setEditingValue(getEditValue(row, column));
  }

  function cancelCellEdit() {
    setEditingCell(null);
    setEditingValue(undefined);
  }

  function getOptimisticRowPatch(row, column, value) {
    if (column.key === 'sku') {
      return { sku_1: value, sku: { ...(row.sku || {}), sku: value } };
    }
    if (column.key === 'logistics_channel') {
      return {
        channel: value,
        logistics_channel: { ...(row.logistics_channel || {}), logistics_days: value },
      };
    }
    return { [column.field]: value };
  }

  async function commitCellEdit(row, column, nextValue = editingValue) {
    if (!editingCell || savingCell) return;
    const normalized = normalizeEditValue(column, nextValue);
    const isEmpty = normalized === undefined || normalized === null || normalized === '';

    if (column.required && isEmpty) {
      ctx.message?.warning?.(`${column.title}不能为空`);
      return;
    }

    selectCommitRef.current = true;
    setSavingCell(true);
    try {
      await apiRequest({
        url: 'simulate_shipment:update',
        method: 'post',
        params: { filterByTk: row.id },
        data: { [column.field]: column.key === 'shippment_id' && isEmpty ? null : normalized },
      });
      const savedValue = column.key === 'shippment_id' && isEmpty ? null : normalized;
      setRows((currentRows) => currentRows.map((item) => {
        return item.id === row.id ? { ...item, ...getOptimisticRowPatch(item, column, savedValue) } : item;
      }));
      cancelCellEdit();
      requestRows(page, pageSize, params, sortState, { silent: true });
      setTimeout(refreshSalesTableBlock, 1500);
    } catch (error) {
      ctx.message?.error?.(`保存失败：${error.message || error}`);
    } finally {
      setSavingCell(false);
      selectCommitRef.current = false;
    }
  }

  function handleSelectEditorBlur() {
    setTimeout(() => {
      if (!selectCommitRef.current) cancelCellEdit();
    }, 120);
  }

  async function deleteSelected() {
    if (!selectedRowKeys.length) return;
    setDeleting(true);
    try {
      await apiRequest({
        url: 'simulate_shipment:destroy',
        method: 'post',
        params: {
          filter: JSON.stringify({ id: { $in: selectedRowKeys } }),
        },
      });
      ctx.message?.success?.('删除成功');
      setSelectedRowKeys([]);
      requestRows(page, pageSize);
      setTimeout(refreshSalesTableBlock, 1500);
    } catch (error) {
      ctx.message?.error?.(`删除失败：${error.message || error}`);
    } finally {
      setDeleting(false);
    }
  }

  function handleTableChange(nextPagination, _filters, sorter, extra) {
    cancelCellEdit();
    const nextPage = extra?.action === 'sort' ? 1 : nextPagination.current;
    const nextPageSize = nextPagination.pageSize;
    const sortField = SORTABLE_FIELDS[sorter?.columnKey] || '';
    const nextSortState = sorter?.order && sortField
      ? { field: sortField, order: sorter.order }
      : { field: '', order: null };

    setPage(nextPage);
    setPageSize(nextPageSize);
    setSortState(nextSortState);
    requestRows(nextPage, nextPageSize, params, nextSortState);
  }

  function renderEditor(row, column) {
    const optionTexts = column.type === 'sku'
      ? skuOptions.map((option) => option.label)
      : column.type === 'channel'
        ? channelOptions.map((option) => option.label)
        : column.type === 'season'
          ? ['淡季', '旺季']
          : [];
    const editorWidth = calculateEditorWidth(row, column, editingValue, optionTexts);
    const dropdownWidth = Math.max(180, Math.min(420, editorWidth + 36));
    const commonProps = {
      size: 'small',
      autoFocus: true,
      onClick: (event) => event.stopPropagation(),
      onDoubleClick: (event) => event.stopPropagation(),
      style: { width: '100%', minWidth: editorWidth },
    };

    if (column.type === 'sku') {
      return React.createElement(Select, {
        ...commonProps,
        showSearch: true,
        optionFilterProp: 'label',
        options: skuOptions,
        popupMatchSelectWidth: false,
        dropdownStyle: { minWidth: dropdownWidth, maxWidth: 420 },
        value: editingValue,
        onChange: (value) => commitCellEdit(row, column, value),
        onBlur: handleSelectEditorBlur,
      });
    }

    if (column.type === 'channel') {
      return React.createElement(Select, {
        ...commonProps,
        showSearch: true,
        optionFilterProp: 'label',
        options: channelOptions,
        popupMatchSelectWidth: false,
        dropdownStyle: { minWidth: dropdownWidth, maxWidth: 420 },
        value: editingValue,
        onChange: (value) => commitCellEdit(row, column, value),
        onBlur: handleSelectEditorBlur,
      });
    }

    if (column.type === 'msku') {
      return React.createElement(Select, {
        ...commonProps,
        showSearch: true,
        allowClear: true,
        optionFilterProp: 'label',
        options: mskuOptions,
        loading: mskuLoadingMore,
        onPopupScroll: handleMskuPopupScroll,
        popupMatchSelectWidth: false,
        dropdownStyle: { minWidth: dropdownWidth, maxWidth: 520 },
        value: editingValue || undefined,
        onChange: (value) => commitCellEdit(row, column, value || ''),
        onBlur: handleSelectEditorBlur,
      });
    }

    if (column.type === 'season') {
      return React.createElement(Select, {
        ...commonProps,
        options: [
          { label: '淡季', value: '淡季' },
          { label: '旺季', value: '旺季' },
        ],
        popupMatchSelectWidth: false,
        dropdownStyle: { minWidth: dropdownWidth },
        value: editingValue,
        onChange: (value) => commitCellEdit(row, column, value),
        onBlur: handleSelectEditorBlur,
      });
    }

    if (column.type === 'number') {
      return React.createElement(InputNumber, {
        ...commonProps,
        min: 0,
        precision: 0,
        step: 1,
        stringMode: true,
        value: editingValue,
        onChange: setEditingValue,
        onPressEnter: () => commitCellEdit(row, column),
        onBlur: () => commitCellEdit(row, column),
      });
    }

    if (column.type === 'date') {
      return React.createElement(DatePicker, {
        ...commonProps,
        locale: DATE_PICKER_LOCALE,
        format: 'YYYY-MM-DD',
        value: editingValue,
        onChange: (value) => commitCellEdit(row, column, value),
        onOpenChange: (open) => {
          datePickerOpenRef.current = open;
          if (!open) setTimeout(() => cancelCellEdit(), 0);
        },
        onBlur: () => {
          if (datePickerOpenRef.current) return;
          cancelCellEdit();
        },
      });
    }

    return React.createElement(Input, {
      ...commonProps,
      value: editingValue,
      onChange: (event) => setEditingValue(event.target.value),
      onPressEnter: () => commitCellEdit(row, column),
      onBlur: () => commitCellEdit(row, column),
    });
  }

  const tableColumns = useMemo(() => {
    const indexColumn = {
      title: '#',
      key: '__index',
      width: 48,
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    };
    const actionColumn = {
      title: '操作',
      key: '__actions',
      width: 72,
      fixed: 'right',
      render: (_, row) => React.createElement(Button, {
        size: 'small',
        type: 'link',
        onClick: () => openCopyModal(row),
        style: { padding: 0 },
      }, '复制'),
    };

    return [indexColumn].concat(TABLE_COLUMNS.map((column) => {
      const optionTexts = column.type === 'sku'
        ? skuOptions.map((option) => option.label)
        : column.type === 'channel'
          ? channelOptions.map((option) => option.label)
          : column.type === 'season'
            ? ['淡季', '旺季']
            : [];
      const width = calculateColumnWidth(column, rows, optionTexts);
      const sortField = SORTABLE_FIELDS[column.key];

      return ({
      title: column.editable
        ? React.createElement('span', {
          title: '可双击编辑',
          style: {
            color: '#1677ff',
            fontWeight: 600,
            whiteSpace: 'nowrap',
          },
        },
          column.title,
          React.createElement('span', {
            style: {
              display: 'inline-block',
              width: 6,
              height: 6,
              marginLeft: 4,
              borderRadius: 6,
              background: '#1677ff',
              verticalAlign: 'middle',
            },
          }),
        )
        : column.title,
      key: column.key,
      width,
      align: column.align,
      ellipsis: column.editable ? false : true,
      sorter: sortField ? true : undefined,
      sortOrder: sortField && sortState.field === sortField ? sortState.order : null,
      sortDirections: sortField ? ['ascend', 'descend', null] : undefined,
      onCell: column.editable ? () => ({ style: { overflow: 'visible' } }) : undefined,
      render: (_, row) => {
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnKey === column.key;
        if (isEditing) {
          return React.createElement('div', {
            style: {
              position: 'relative',
              zIndex: 5,
              minWidth: calculateEditorWidth(row, column, editingValue, optionTexts),
              background: '#fff',
              padding: '1px 0',
            },
          }, renderEditor(row, column));
        }

        const value = getColumnValue(row, column);
        const content = column.key === 'season' && value
          ? React.createElement(Tag, {
            color: value === '旺季' ? 'red' : 'lime',
            style: { marginInlineEnd: 0 },
          }, value)
          : getCellDisplayText(row, column);

        if (!column.editable) return content;
        return React.createElement('div', {
          onDoubleClick: () => startCellEdit(row, column),
          style: {
            minHeight: 22,
            cursor: 'text',
            padding: '1px 6px',
            margin: '-1px -6px',
            borderRadius: 4,
            whiteSpace: 'nowrap',
            background: 'rgba(22, 119, 255, 0.06)',
            boxShadow: 'inset 2px 0 0 rgba(22, 119, 255, 0.65)',
          },
        }, content);
      },
    });
    }), actionColumn);
  }, [page, pageSize, rows, editingCell, editingValue, skuOptions, channelOptions, savingCell, sortState]);

  const tableScrollX = useMemo(() => {
    return 120 + TABLE_COLUMNS.reduce((totalWidth, column) => {
      const optionTexts = column.type === 'sku'
        ? skuOptions.map((option) => option.label)
        : column.type === 'channel'
          ? channelOptions.map((option) => option.label)
          : column.type === 'season'
            ? ['淡季', '旺季']
            : [];
      return totalWidth + calculateColumnWidth(column, rows, optionTexts);
    }, 0);
  }, [rows, skuOptions, channelOptions]);

  return React.createElement(Card, {
    size: 'small',
    title: '模拟发货计划',
    bodyStyle: { padding: 0 },
    extra: React.createElement(Space, { size: 8 },
      React.createElement(Popconfirm, {
        title: `确认删除选中的 ${selectedRowKeys.length} 条记录？`,
        disabled: !selectedRowKeys.length,
        onConfirm: deleteSelected,
      },
        React.createElement(Button, {
          size: 'small',
          danger: true,
          loading: deleting,
          disabled: !selectedRowKeys.length,
        }, '批量删除'),
      ),
      React.createElement(Button, {
        size: 'small',
        onClick: () => requestRows(page, pageSize),
        loading,
      }, '刷新'),
    ),
  },
    React.createElement(Table, {
      size: 'small',
      rowKey: 'id',
      loading,
      columns: tableColumns,
      dataSource: rows,
      tableLayout: 'fixed',
      rowHoverable: false,
      rowSelection: {
        selectedRowKeys,
        onChange: setSelectedRowKeys,
      },
      scroll: { x: tableScrollX },
      pagination: {
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        size: 'small',
      },
      onChange: handleTableChange,
    }),
    React.createElement(Modal, {
      title: '复制发货计划',
      open: copyModalOpen,
      onCancel: closeCopyModal,
      onOk: submitCopy,
      confirmLoading: copying,
      okText: '确认新增',
      cancelText: '取消',
      destroyOnClose: true,
      width: 560,
    },
      React.createElement('div', {
        style: {
          marginBottom: 12,
          color: '#667085',
          fontSize: 13,
          lineHeight: '20px',
        },
      }, '请先确认复制后的店铺、发货日期等信息。点击确认后才会新增记录，并触发 NocoBase 新增工作流。'),
      React.createElement(Form, {
        form: copyForm,
        layout: 'vertical',
        size: 'small',
      },
        React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            columnGap: 12,
          },
        },
          React.createElement(Form.Item, {
            name: 'sku',
            label: 'SKU信息',
            rules: [{ required: true, message: '请选择SKU信息' }],
          },
            React.createElement(Select, {
              showSearch: true,
              allowClear: true,
              optionFilterProp: 'label',
              options: skuOptions,
              placeholder: '请选择SKU信息',
            }),
          ),
          React.createElement(Form.Item, {
            name: 'current_inventory_info',
            label: '店铺',
            rules: [{ required: true, message: '请选择店铺' }],
          },
            React.createElement(Select, {
              showSearch: true,
              allowClear: true,
              optionFilterProp: 'label',
              options: currentInventoryOptions,
              placeholder: '请选择店铺',
            }),
          ),
        ),
        React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            columnGap: 12,
          },
        },
          React.createElement(Form.Item, {
            name: 'date',
            label: '发货日期',
            rules: [{ required: true, message: '请选择发货日期' }],
          },
            React.createElement(DatePicker, {
              locale: DATE_PICKER_LOCALE,
              format: 'YYYY-MM-DD',
              style: { width: '100%' },
            }),
          ),
          React.createElement(Form.Item, {
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
        React.createElement(Form.Item, {
          name: 'logistics_channel',
          label: '物流渠道信息',
          rules: [{ required: true, message: '请选择物流渠道信息' }],
        },
          React.createElement(Select, {
            showSearch: true,
            allowClear: true,
            optionFilterProp: 'label',
            options: channelOptions,
            placeholder: '请选择物流渠道信息',
          }),
        ),
        React.createElement(Form.Item, {
          name: 'msku_info',
          label: 'MSKU信息',
        },
          React.createElement(Select, {
            showSearch: true,
            allowClear: true,
            optionFilterProp: 'label',
            options: mskuOptions,
            loading: mskuLoadingMore,
            onPopupScroll: handleMskuPopupScroll,
            placeholder: '请选择MSKU信息',
          }),
        ),
      ),
    ),
  );
}

ctx.render(React.createElement(ShipmentPlanBlock));
