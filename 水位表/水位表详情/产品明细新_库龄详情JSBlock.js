const React = ctx.libs.React;
const { useCallback, useEffect, useMemo, useState } = React;
const { Button, Card, Table } = ctx.libs.antd;

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

function formatValue(value) {
  if (value === undefined || value === null || value === '') return '-';
  return String(value);
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

function calculateColumnWidth(column, rows) {
  const titleWidth = measureTextWidth(column.title);
  const contentWidth = rows.reduce((maxWidth, row) => {
    return Math.max(maxWidth, measureTextWidth(formatValue(row?.[column.dataIndex])));
  }, 0);
  const padding = column.align === 'right' ? 38 : 34;
  const minWidth = column.width || 72;
  const maxWidth = column.maxWidth || 320;
  return Math.min(maxWidth, Math.max(minWidth, titleWidth, contentWidth) + padding);
}

const TABLE_COLUMNS = [
  { title: 'ASIN', dataIndex: 'asin', width: 110 },
  { title: 'MSKU', dataIndex: 'msku', width: 150 },
  { title: '店铺', dataIndex: 'shop', width: 80 },
  { title: '总库存', dataIndex: 'total', width: 80, align: 'right' },
  { title: '总可用库存', dataIndex: 'total_fulfillable_quantity', width: 90, align: 'right' },
  { title: 'FBA可售', dataIndex: 'afn_fulfillable_quantity', width: 90, align: 'right' },
  { title: 'FBA实际在途', dataIndex: 'afn_erp_real_shipped_quantity', width: 100, align: 'right' },
  { title: 'FBA待发货', dataIndex: 'reserved_customerorders', width: 100, align: 'right' },
  { title: 'FBA待调仓', dataIndex: 'reserved_fc_transfers', width: 100, align: 'right' },
  { title: 'FBA调仓中', dataIndex: 'reserved_fc_processing', width: 100, align: 'right' },
  { title: 'FBA调查中数量', dataIndex: 'afn_researching_quantity', width: 120, align: 'right' },
  { title: '1-2个月', dataIndex: 'inv_age_31_to_60_days', width: 80, align: 'right' },
  { title: '2-3个月', dataIndex: 'inv_age_61_to_90_days', width: 80, align: 'right' },
  { title: '3-6个月', dataIndex: 'inv_age_91_to_180_days', width: 80, align: 'right' },
  { title: '6-9个月', dataIndex: 'inv_age_181_to_270_days', width: 80, align: 'right' },
  { title: '9-12个月', dataIndex: 'inv_age_271_to_365_days', width: 80, align: 'right' },
  { title: '12个月以上', dataIndex: 'inv_age_365_plus_days', width: 100, align: 'right' },
];

function StockAgeTable() {
  const [params, setParams] = useState(readUrlParams);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [columnWidths, setColumnWidths] = useState({});

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
        url: 'current_stock:list',
        method: 'get',
        params: {
          page: nextPage,
          pageSize: nextPageSize,
          filter: JSON.stringify({
            $and: [
              { asin: { $eq: activeParams.asin } },
              { country: { $eq: activeParams.country } },
              { shop_country_asin: { $notEmpty: true } },
            ],
          }),
        },
      });
      const meta = pickMeta(response);
      setRows(pickRows(response));
      setTotal(Number(meta.count || meta.total || 0));
    } catch (error) {
      ctx.message?.error?.(`库龄详情加载失败：${error.message || error}`);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, params.asin, params.country]);

  useEffect(() => {
    async function boot() {
      const nextParams = await resolveParams();
      requestRows(1, pageSize, nextParams);
    }
    boot();
  }, []);

  function startResize(event, column) {
    const doc = event.currentTarget?.ownerDocument;
    if (!doc) return;

    event.preventDefault();
    event.stopPropagation();

    const startX = event.clientX;
    const startWidth = columnWidths[column.dataIndex] || calculateColumnWidth(column, rows);
    const previousCursor = doc.body?.style?.cursor || '';
    const previousUserSelect = doc.body?.style?.userSelect || '';

    if (doc.body?.style) {
      doc.body.style.cursor = 'col-resize';
      doc.body.style.userSelect = 'none';
    }

    function move(moveEvent) {
      const nextWidth = Math.max(56, Math.round(startWidth + moveEvent.clientX - startX));
      setColumnWidths((current) => ({
        ...current,
        [column.dataIndex]: nextWidth,
      }));
    }

    function up() {
      doc.removeEventListener('mousemove', move);
      doc.removeEventListener('mouseup', up);
      if (doc.body?.style) {
        doc.body.style.cursor = previousCursor;
        doc.body.style.userSelect = previousUserSelect;
      }
    }

    doc.addEventListener('mousemove', move);
    doc.addEventListener('mouseup', up);
  }

  function renderResizableTitle(column) {
    return React.createElement('div', {
      style: {
        position: 'relative',
        paddingRight: 10,
        whiteSpace: 'nowrap',
      },
    },
      column.title,
      React.createElement('span', {
        title: '拖拽调整列宽',
        onMouseDown: (event) => startResize(event, column),
        onClick: (event) => event.stopPropagation(),
        style: {
          position: 'absolute',
          top: -6,
          right: -8,
          width: 10,
          height: 30,
          cursor: 'col-resize',
          userSelect: 'none',
          borderRight: '2px solid rgba(22, 119, 255, 0.45)',
        },
      }),
    );
  }

  const columns = useMemo(() => {
    const indexColumn = {
      title: '#',
      key: '__index',
      width: 48,
      render: (_, __, index) => (page - 1) * pageSize + index + 1,
    };

    return [indexColumn].concat(TABLE_COLUMNS.map((column) => ({
      ...column,
      title: renderResizableTitle(column),
      width: columnWidths[column.dataIndex] || calculateColumnWidth(column, rows),
      ellipsis: true,
      render: (value) => formatValue(value),
    })));
  }, [page, pageSize, rows, columnWidths]);

  const tableScrollX = useMemo(() => {
    return 48 + TABLE_COLUMNS.reduce((totalWidth, column) => {
      return totalWidth + (columnWidths[column.dataIndex] || calculateColumnWidth(column, rows));
    }, 0);
  }, [rows, columnWidths]);

  return React.createElement(Card, {
    size: 'small',
    title: '库龄详情',
    bodyStyle: { padding: 0 },
    extra: React.createElement(Button, {
      size: 'small',
      onClick: () => requestRows(page, pageSize),
      loading,
    }, '刷新'),
  },
    React.createElement(Table, {
      size: 'small',
      rowKey: (row) => row.sid_msku || `${row.sid || ''}_${row.msku || ''}_${row.asin || ''}`,
      loading,
      columns,
      dataSource: rows,
      tableLayout: 'fixed',
      rowHoverable: false,
      scroll: { x: tableScrollX },
      pagination: {
        current: page,
        pageSize,
        total,
        showSizeChanger: true,
        pageSizeOptions: [10, 20, 50],
        size: 'small',
        onChange: (nextPage, nextPageSize) => {
          setPage(nextPage);
          setPageSize(nextPageSize);
          requestRows(nextPage, nextPageSize);
        },
      },
    }),
  );
}

ctx.render(React.createElement(StockAgeTable));
