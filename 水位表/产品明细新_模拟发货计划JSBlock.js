const React = ctx.libs.React;
const { useCallback, useEffect, useMemo, useState } = React;
const {
  Button,
  Card,
  DatePicker,
  Input,
  InputNumber,
  Popconfirm,
  Select,
  Space,
  Table,
  Tag,
} = ctx.libs.antd;
const dayjs = ctx.dayjs;

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

function getValue(row, path) {
  return String(path).split('.').reduce((value, key) => (value == null ? undefined : value[key]), row);
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

function formatCell(value) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
}

function getCellDisplayText(row, column) {
  const value = getValue(row, column.path);
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
  const titleWidth = measureTextWidth(column.title) + (column.editable ? 18 : 0);
  const contentWidth = rows.reduce((maxWidth, row) => {
    return Math.max(maxWidth, measureTextWidth(getCellDisplayText(row, column)));
  }, 0);
  const optionWidth = optionTexts.reduce((maxWidth, text) => {
    return Math.max(maxWidth, measureTextWidth(text));
  }, 0);
  const padding = column.align === 'right' ? 34 : 30;
  const minWidth = column.editable ? 86 : 56;
  const maxWidth = column.maxWidth || 260;
  return Math.min(maxWidth, Math.max(minWidth, titleWidth, contentWidth, optionWidth) + padding);
}

const TABLE_COLUMNS = [
  { key: 'shippment_id', title: 'FBA货件单号', path: 'shippment_id', editable: true, type: 'text', field: 'shippment_id', maxWidth: 180 },
  { key: 'country_info', title: '国家', path: 'country_info.country_code' },
  { key: 'asin', title: 'ASIN', path: 'asin', maxWidth: 130 },
  { key: 'shop_info', title: '店铺', path: 'shop_info.short_name' },
  { key: 'msku', title: 'MSKU', path: 'msku', maxWidth: 190 },
  { key: 'season', title: '淡旺季', path: 'season', editable: true, type: 'season', field: 'season', required: true },
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

function ShipmentPlanBlock() {
  const [params, setParams] = useState(readUrlParams);
  const [rows, setRows] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCell, setEditingCell] = useState(null);
  const [editingValue, setEditingValue] = useState(undefined);
  const [savingCell, setSavingCell] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [skuOptions, setSkuOptions] = useState([]);
  const [channelOptions, setChannelOptions] = useState([]);

  async function resolveParams() {
    const next = readUrlParams();
    if (typeof ctx.getVar === 'function') {
      next.asin = next.asin || await ctx.getVar('ctx.urlSearchParams.asin') || '';
      next.country = next.country || await ctx.getVar('ctx.urlSearchParams.country') || '';
    }
    setParams(next);
    return next;
  }

  const requestRows = useCallback(async (nextPage = page, nextPageSize = pageSize, activeParams = params) => {
    if (!activeParams.asin || !activeParams.country) {
      setRows([]);
      setTotal(0);
      return;
    }

    setLoading(true);
    try {
      const response = await apiRequest({
        url: 'simulate_shipment:list',
        method: 'get',
        params: {
          page: nextPage,
          pageSize: nextPageSize,
          sort: 'add_date',
          appends: 'shop_info,country_info,logistics_channel,invoice_information,f_i4gws625myg,sku',
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
      setLoading(false);
    }
  }, [page, pageSize, params.asin, params.country]);

  async function loadOptions() {
    const [skuRows, channelRows] = await Promise.all([
      apiRequest({
        url: 'sku:list',
        method: 'get',
        params: { page: 1, pageSize: 1000 },
      }).then(pickRows).catch(() => []),
      apiRequest({
        url: 'logistics_days:list',
        method: 'get',
        params: { page: 1, pageSize: 1000 },
      }).then(pickRows).catch(() => []),
    ]);

    setSkuOptions(uniqueOptions(skuRows, 'sku', 'sku'));
    setChannelOptions(uniqueOptions(channelRows, 'logistics_days', 'logistics_days'));
  }

  useEffect(() => {
    async function boot() {
      const nextParams = await resolveParams();
      await Promise.all([
        requestRows(1, pageSize, nextParams),
        loadOptions(),
      ]);
    }
    boot();
  }, []);

  function startCellEdit(row, column) {
    if (!column.editable || savingCell) return;
    setEditingCell({ rowId: row.id, columnKey: column.key });
    setEditingValue(getEditValue(row, column));
  }

  function cancelCellEdit() {
    setEditingCell(null);
    setEditingValue(undefined);
  }

  async function commitCellEdit(row, column, nextValue = editingValue) {
    if (!editingCell || savingCell) return;
    const normalized = normalizeEditValue(column, nextValue);
    const isEmpty = normalized === undefined || normalized === null || normalized === '';

    if (column.required && isEmpty) {
      ctx.message?.warning?.(`${column.title}不能为空`);
      return;
    }

    setSavingCell(true);
    try {
      await apiRequest({
        url: 'simulate_shipment:update',
        method: 'post',
        params: { filterByTk: row.id },
        data: { [column.field]: column.key === 'shippment_id' && isEmpty ? null : normalized },
      });
      cancelCellEdit();
      await requestRows(page, pageSize);
    } catch (error) {
      ctx.message?.error?.(`保存失败：${error.message || error}`);
    } finally {
      setSavingCell(false);
    }
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
    } catch (error) {
      ctx.message?.error?.(`删除失败：${error.message || error}`);
    } finally {
      setDeleting(false);
    }
  }

  function renderEditor(row, column) {
    const optionTexts = column.type === 'sku'
      ? skuOptions.map((option) => option.label)
      : column.type === 'channel'
        ? channelOptions.map((option) => option.label)
        : column.type === 'season'
          ? ['淡季', '旺季']
          : [];
    const dropdownWidth = Math.max(180, Math.min(360, calculateColumnWidth(column, rows, optionTexts) + 36));
    const commonProps = {
      size: 'small',
      autoFocus: true,
      onClick: (event) => event.stopPropagation(),
      onDoubleClick: (event) => event.stopPropagation(),
      style: { width: '100%' },
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
        onBlur: () => cancelCellEdit(),
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
        onBlur: () => cancelCellEdit(),
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
        onBlur: () => cancelCellEdit(),
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
        format: 'YYYY-MM-DD',
        value: editingValue,
        onChange: (value) => commitCellEdit(row, column, value),
        onBlur: () => cancelCellEdit(),
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

    return [indexColumn].concat(TABLE_COLUMNS.map((column) => {
      const optionTexts = column.type === 'sku'
        ? skuOptions.map((option) => option.label)
        : column.type === 'channel'
          ? channelOptions.map((option) => option.label)
          : column.type === 'season'
            ? ['淡季', '旺季']
            : [];
      const width = calculateColumnWidth(column, rows, optionTexts);

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
      ellipsis: true,
      render: (_, row) => {
        const isEditing = editingCell?.rowId === row.id && editingCell?.columnKey === column.key;
        if (isEditing) return renderEditor(row, column);

        const value = getValue(row, column.path);
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
            background: 'rgba(22, 119, 255, 0.06)',
            boxShadow: 'inset 2px 0 0 rgba(22, 119, 255, 0.65)',
          },
        }, content);
      },
    });
    }));
  }, [page, pageSize, rows, editingCell, editingValue, skuOptions, channelOptions, savingCell]);

  const tableScrollX = useMemo(() => {
    return 48 + TABLE_COLUMNS.reduce((totalWidth, column) => {
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
      rowSelection: {
        selectedRowKeys,
        onChange: setSelectedRowKeys,
      },
      scroll: { x: tableScrollX, y: 360 },
      pagination: {
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50, 100],
        size: 'small',
        onChange: (nextPage, nextPageSize) => {
          cancelCellEdit();
          setPage(nextPage);
          setPageSize(nextPageSize);
          requestRows(nextPage, nextPageSize);
        },
      },
    }),
  );
}

ctx.render(React.createElement(ShipmentPlanBlock));
