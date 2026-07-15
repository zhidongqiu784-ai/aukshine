// 配置中心 Tab4 — 产品阶段配置
async function run() {
  const React = ctx.libs.React;
  const { useState } = React;
  const { Table, Select, ConfigProvider, Button, Spin, message, Popconfirm } = ctx.libs.antd;
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const IS_ADMIN = currentUserLevel === 3;

  const C = {
    text: '#18181b',
    muted: '#52525b',
    border: '#e4e4e7',
    bgSubtle: '#f4f4f5',
    blue: '#2563eb',
    blueBg: '#eff6ff',
    green: '#059669',
    greenBg: '#ecfdf5',
    amber: '#d97706',
    amberBg: '#fffbeb',
    red: '#dc2626',
    redBg: '#fef2f2',
    gray: '#71717a',
    grayBg: '#f4f4f5',
  };

  const PRODUCT_LABEL_COLLECTION = 'product_label_cfg';
  const SALE_MODEL_COLLECTION = 'sale_model';
  const countryOptions = ['US', 'CA', 'JP', 'FR', 'DE'].map(v => ({ value: v, label: v }));
  const labelOptions = ['淘汰期', '新品期', '成长期', '成熟期'].map(v => ({ value: v, label: v }));
  const fmt = v => (v === null || v === undefined || v === '' ? '-' : v);
  const buildKey = row => [row.country, row.model].map(v => String(v || '').trim()).filter(Boolean).join('_');
  const pill = (bg, color, text) => React.createElement('span', {
    style: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 14,
      fontWeight: 600,
      background: bg,
      color,
      whiteSpace: 'nowrap',
    },
  }, text);
  const labelPill = v => {
    if (v === '淘汰期') return pill(C.redBg, C.red, v);
    if (v === '新品期') return pill(C.greenBg, C.green, v);
    if (v === '成长期') return pill(C.amberBg, C.amber, v);
    if (v === '成熟期') return pill(C.blueBg, C.blue, v);
    return pill(C.grayBg, C.gray, fmt(v));
  };
  const lh = hue => () => ({ className: 'aok-c-' + hue });
  const aokCfgCss = [
    '.aok-cfg-wrap .ant-table-thead .aok-c-slate{background:#eef1f5;color:#475569;font-weight:700;font-size:15px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-red{background:#fde8e6;color:#9b2c24;font-weight:700;font-size:15px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-amber{background:#fdf1da;color:#9a6512;font-weight:700;font-size:15px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-green{background:#e3f3eb;color:#2c6e54;font-weight:700;font-size:15px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-blue{background:#e6effd;color:#1e478e;font-weight:700;font-size:15px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-thead .aok-c-pink{background:#fbe7ed;color:#a64a66;font-weight:700;font-size:15px;white-space:normal;line-height:1.35;}',
    '.aok-cfg-wrap .ant-table-tbody > tr > td{font-size:15px;font-weight:500;line-height:1.55;}',
    '.aok-cfg-wrap .ant-select-selection-item,.aok-cfg-wrap .ant-select-selection-placeholder{font-size:14px !important;}',
    '.aok-cfg-wrap .ant-btn{font-size:14px;}',
    '.aok-cfg-wrap .ant-table-tbody > tr.aok-row-odd > td{background:#f8fafb;}',
    '.aok-cfg-wrap .ant-table-tbody > tr.aok-row-even > td{background:#fff;}',
    '.aok-cfg-wrap .ant-table-tbody > tr:hover > td{background:#eef4ff !important;}',
    '.ant-tabs-nav{background:linear-gradient(180deg,#ffffff,#f3f6fb);border-radius:10px;padding:3px 6px;box-shadow:0 1px 2px rgba(20,30,50,.05),0 2px 8px rgba(20,30,50,.05);}',
    '.ant-tabs-tab{font-size:14px !important;font-weight:600 !important;color:#5b6472 !important;border-radius:8px !important;padding:6px 14px !important;}',
    '.ant-tabs-tab:hover{background:#eef4ff !important;}',
    '.ant-tabs-tab.ant-tabs-tab-active{background:#eff6ff !important;box-shadow:0 1px 3px rgba(37,99,235,.18);}',
    '.ant-tabs-tab.ant-tabs-tab-active .ant-tabs-tab-btn{color:#2563eb !important;font-weight:800 !important;}',
    '.ant-tabs-ink-bar{height:3px !important;background:#2563eb !important;border-radius:2px;}',
  ].join('\n');

  const btnEdit = {
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    padding: '3px 12px',
    borderRadius: 6,
    border: '1px solid #cfe0ff',
    background: '#eff6ff',
    color: '#2563eb',
    whiteSpace: 'nowrap',
  };
  const btnSave = {
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    padding: '3px 12px',
    borderRadius: 6,
    border: '1px solid #047857',
    background: '#059669',
    color: '#fff',
    whiteSpace: 'nowrap',
  };
  const btnGhost = {
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 600,
    padding: '3px 12px',
    borderRadius: 6,
    border: '1px solid #e4e4e7',
    background: '#fff',
    color: '#52525b',
    whiteSpace: 'nowrap',
  };
  const btnDelete = {
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 700,
    padding: '3px 12px',
    borderRadius: 6,
    border: '1px solid #fecaca',
    background: '#fef2f2',
    color: '#dc2626',
    whiteSpace: 'nowrap',
    marginLeft: 6,
  };

  const toViewRow = row => ({
    country_model: row.country_model,
    country: row.country,
    model: row.model,
    label: row.label,
  });

  async function readRows() {
    const res = await ctx.api.request({
      url: PRODUCT_LABEL_COLLECTION + ':list',
      params: { pageSize: 500, sort: 'country_model' },
    });
    return (res?.data?.data || []).map(toViewRow);
  }

  async function readModelOptions() {
    const res = await ctx.api.request({
      url: SALE_MODEL_COLLECTION + ':list',
      params: { pageSize: 500, sort: 'model' },
    });
    const seen = new Set();
    return (res?.data?.data || [])
      .map(row => String(row?.model || '').trim())
      .filter(model => {
        if (!model || seen.has(model)) return false;
        seen.add(model);
        return true;
      })
      .map(model => ({ value: model, label: model }));
  }

  async function writeApi(action, row, payload) {
    const req = {
      url: PRODUCT_LABEL_COLLECTION + ':' + action,
      method: 'post',
      data: payload,
    };
    if (action !== 'create') {
      req.params = { filterByTk: row.country_model };
    }
    return ctx.api.request(req);
  }

  function App() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({});
    const [country, setCountry] = useState('全部');
    const [modelOptions, setModelOptions] = useState([]);
    const [modelOptionsLoading, setModelOptionsLoading] = useState(true);
    const [deletingId, setDeletingId] = useState(null);

    async function reload() {
      setLoading(true);
      try {
        setRows(await readRows());
      } catch (e) {
        message.error('读取失败:' + (e?.message || e));
      }
      setLoading(false);
    }

    async function loadModelOptions() {
      setModelOptionsLoading(true);
      try {
        setModelOptions(await readModelOptions());
      } catch (e) {
        message.error('型号读取失败:' + (e?.message || e));
      }
      setModelOptionsLoading(false);
    }

    React.useEffect(() => {
      reload();
      loadModelOptions();
    }, []);

    function countryNode(row) {
      const isNew = row.country_model === '__new';
      const r = editingId === row.country_model ? draft : row;
      if (editingId !== row.country_model || !isNew) {
        return React.createElement('span', null, fmt(r.country));
      }
      return React.createElement(Select, {
        size: 'small',
        value: r.country,
        style: { width: '100%' },
        options: countryOptions,
        showSearch: true,
        placeholder: '请选择国家',
        onChange: v => setDraft(Object.assign({}, draft, { country: v })),
      });
    }

    function modelNode(row) {
      const isNew = row.country_model === '__new';
      const r = editingId === row.country_model ? draft : row;
      if (editingId !== row.country_model || !isNew) {
        return React.createElement('span', null, fmt(r.model));
      }
      return React.createElement(Select, {
        size: 'small',
        value: r.model || undefined,
        style: { width: '100%' },
        options: modelOptions,
        loading: modelOptionsLoading,
        showSearch: true,
        optionFilterProp: 'label',
        placeholder: '请选择型号',
        notFoundContent: modelOptionsLoading ? '型号加载中...' : '暂无可选型号',
        onChange: v => setDraft(Object.assign({}, draft, { model: v })),
      });
    }

    function labelNode(row) {
      const r = editingId === row.country_model ? draft : row;
      if (editingId !== row.country_model) {
        return labelPill(r.label);
      }
      return React.createElement(Select, {
        size: 'small',
        value: r.label,
        style: { width: '100%' },
        options: labelOptions,
        showSearch: true,
        allowClear: false,
        placeholder: '请选择标签',
        onChange: v => setDraft(Object.assign({}, draft, { label: v })),
      });
    }

    async function save(row) {
      const isNew = row.country_model === '__new';
      const nextCountry = String(draft.country || '').trim();
      const nextModel = String(draft.model || '').trim();
      const nextLabel = String(draft.label || '').trim();
      const nextKey = buildKey({ country: nextCountry, model: nextModel });

      if (!nextCountry || !nextModel || !nextLabel) {
        message.warning('国家、型号、标签不能为空');
        return;
      }

      const payload = {
        country_model: isNew ? nextKey : row.country_model,
        country: isNew ? nextCountry : row.country,
        model: isNew ? nextModel : row.model,
        label: nextLabel,
      };

      try {
        await writeApi(isNew ? 'create' : 'update', row, payload);
        message.success('已保存');
        setEditingId(null);
        setDraft({});
        await reload();
      } catch (e) {
        message.error('保存失败:' + (e?.message || e));
      }
    }

    function cancelEdit() {
      setEditingId(null);
      setDraft({});
    }

    async function remove(row) {
      setDeletingId(row.country_model);
      try {
        await writeApi('destroy', row);
        message.success('已删除');
        await reload();
      } catch (e) {
        message.error('删除失败:' + (e?.message || e));
      }
      setDeletingId(null);
    }

    const view = country === '全部' ? rows : rows.filter(r => r.country === country);
    const data = editingId === '__new' ? [draft].concat(view) : view;
    const filterCountryOptions = [{ value: '全部', label: '全部' }].concat(countryOptions);
    const columns = [
      {
        title: '国家',
        dataIndex: 'country',
        width: 110,
        onHeaderCell: lh('slate'),
        render: (_, r) => countryNode(r),
      },
      {
        title: '型号',
        dataIndex: 'model',
        width: 180,
        onHeaderCell: lh('blue'),
        render: (_, r) => modelNode(r),
      },
      {
        title: '产品阶段',
        dataIndex: 'label',
        width: 140,
        onHeaderCell: lh('red'),
        render: (_, r) => labelNode(r),
      },
      {
        title: '操作',
        width: 150,
        onHeaderCell: lh('pink'),
        render: (_, r) => editingId === r.country_model
          ? React.createElement('span', null,
            React.createElement('button', { onClick: () => save(r), style: btnSave }, '✓ 保存'),
            React.createElement('button', { onClick: cancelEdit, style: btnGhost }, '取消'))
          : React.createElement('span', null,
            React.createElement('button', {
              onClick: () => {
                setEditingId(r.country_model);
                setDraft(Object.assign({}, r));
              },
              style: btnEdit,
            }, '✎ 编辑'),
            React.createElement(Popconfirm, {
              title: '确认删除这条配置？',
              description: r.country_model,
              okText: '删除',
              cancelText: '取消',
              okButtonProps: { danger: true },
              disabled: deletingId !== null,
              onConfirm: () => remove(r),
            }, React.createElement('button', {
              disabled: deletingId !== null,
              style: btnDelete,
            }, deletingId === r.country_model ? '删除中...' : '⌫ 删除'))),
      },
    ];

    return React.createElement(ConfigProvider, null,
      React.createElement('div', {
        className: 'aok-cfg-wrap',
        style: {
          fontFamily: "'PingFang SC','Microsoft YaHei',-apple-system,sans-serif",
          color: C.text,
        },
      },
        React.createElement('style', null, aokCfgCss),
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            flexWrap: 'wrap',
            gap: 10,
            margin: '2px 0 10px',
          },
        }, React.createElement('span', {
          style: { fontSize: 20, fontWeight: 800, color: C.text },
        }, '🏷 产品阶段配置')),
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: 10,
          },
        },
          React.createElement('span', { style: { fontSize: 14, color: C.muted } }, '当前国家'),
          React.createElement(Select, {
            size: 'small',
            value: country,
            style: { width: 150 },
            options: filterCountryOptions,
            onChange: setCountry,
          }),
          React.createElement(Button, {
            size: 'small',
            type: 'primary',
            style: { marginLeft: 'auto' },
            disabled: editingId !== null,
            onClick: () => {
              const row = {
                country_model: '__new',
                country: country === '全部' ? 'US' : country,
                model: '',
                label: '淘汰期',
              };
              setEditingId('__new');
              setDraft(row);
            },
          }, '+ 添加')),
        loading
          ? React.createElement(Spin, null)
          : React.createElement(Table, {
            rowClassName: (r, i) => i % 2 ? 'aok-row-odd' : 'aok-row-even',
            size: 'small',
            columns,
            dataSource: data,
            rowKey: 'country_model',
            pagination: false,
            scroll: { x: 580 },
            bordered: true,
          }),
        IS_ADMIN && React.createElement('div', {
          style: {
            background: '#eff6ff',
            borderLeft: '3px solid #2563eb',
            borderRadius: 6,
            padding: '10px 14px',
            fontSize: 14,
            lineHeight: 1.8,
            marginTop: 12,
          },
        },
          React.createElement('div', null, '说明:新增时自动生成 country_model,格式为 国家_型号。已有记录编辑时仅调整产品阶段标签,避免修改主键影响历史配置。'),
          React.createElement('div', { style: { marginTop: 4 } }, '按国家和型号维护人工产品阶段。命中配置后,水位表一栏优先显示这里的标签。 运营维护 · 改动将生效于水位表 product_label'))));
  }

  ctx.render(React.createElement(App));
}

ctx.render(null);
run();
