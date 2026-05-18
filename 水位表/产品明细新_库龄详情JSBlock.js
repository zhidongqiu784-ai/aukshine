async function run() {
  const React = ctx.libs.React;
  const { useCallback, useEffect, useMemo, useState } = React;
  const { Button, Card, Table } = ctx.libs.antd;

  const apiRequest = (options) => {
    if (typeof ctx.request === 'function') return ctx.request(options);
    return ctx.api.request(options);
  };

  function parseSearch(search) {
    const result = {};
    String(search || '').replace(/^\?/, '').split('&').forEach((part) => {
      if (!part) return;
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
      if (key) result[decodeURIComponent(key)] = decodeURIComponent(value);
    });
    return result;
  }

  function readUrlParams() {
    return { ...(ctx.urlSearchParams || {}) };
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

  const columnsMeta = [
    { title: 'ASIN', dataIndex: 'asin', width: 122 },
    { title: '店铺', dataIndex: 'shop', width: 78 },
    { title: '总库存', dataIndex: 'total', width: 82, align: 'right' },
    { title: '总可用', dataIndex: 'total_fulfillable_quantity', width: 82, align: 'right' },
    { title: 'FBA可售', dataIndex: 'afn_fulfillable_quantity', width: 82, align: 'right' },
    { title: 'FBA在途', dataIndex: 'afn_erp_real_shipped_quantity', width: 82, align: 'right' },
    { title: 'FBA待发货', dataIndex: 'reserved_customerorders', width: 92, align: 'right' },
    { title: 'FBA待调仓', dataIndex: 'reserved_fc_transfers', width: 92, align: 'right' },
    { title: 'FBA调仓中', dataIndex: 'reserved_fc_processing', width: 92, align: 'right' },
    { title: '调查中', dataIndex: 'afn_researching_quantity', width: 82, align: 'right' },
    { title: '1-2个月', dataIndex: 'inv_age_31_to_60_days', width: 82, align: 'right' },
    { title: '2-3个月', dataIndex: 'inv_age_61_to_90_days', width: 82, align: 'right' },
    { title: '3-6个月', dataIndex: 'inv_age_91_to_180_days', width: 82, align: 'right' },
    { title: '6-9个月', dataIndex: 'inv_age_181_to_270_days', width: 82, align: 'right' },
    { title: '9-12个月', dataIndex: 'inv_age_271_to_365_days', width: 88, align: 'right' },
    { title: '12个月+', dataIndex: 'inv_age_365_plus_days', width: 82, align: 'right' },
    { title: 'MSKU', dataIndex: 'msku', width: 160 },
  ];

  function StockAgeTable() {
    const params = useMemo(readUrlParams, []);
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [total, setTotal] = useState(0);

    const requestRows = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
      if (!params.asin || !params.country) {
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
                { asin: { $eq: params.asin } },
                { country: { $eq: params.country } },
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
    }, [params.asin, params.country, page, pageSize]);

    useEffect(() => {
      requestRows(1, pageSize);
    }, [requestRows]);

    return React.createElement(Card, {
      size: 'small',
      title: '库龄详情',
      extra: React.createElement(Button, { size: 'small', onClick: () => requestRows(page, pageSize) }, '刷新'),
      bodyStyle: { padding: 0 },
    },
      React.createElement(Table, {
        size: 'small',
        rowKey: (row) => row.sid_msku || `${row.shop || ''}_${row.asin || ''}_${row.msku || ''}`,
        loading,
        columns: columnsMeta.map((column) => ({
          ...column,
          ellipsis: true,
          render: (value) => value == null || value === '' ? '-' : String(value),
        })),
        dataSource: rows,
        scroll: { x: 1500, y: 360 },
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
}

run();
