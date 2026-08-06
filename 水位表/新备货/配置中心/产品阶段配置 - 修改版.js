// 配置中心 Tab4 — 产品阶段配置
async function run() {
  const React = ctx.libs.React;
  const { useState } = React;
  const { Table, Select, ConfigProvider, Button, Spin, message, Popconfirm, Tooltip } = ctx.libs.antd;
  const { ReloadOutlined, PlusOutlined } = ctx.libs.antdIcons;
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
  const productLevelOptions = ['S', 'A', 'B', 'C'].map(v => ({ value: v, label: v }));
  const ALL_FILTER = '全部';
  const UNSET_FILTER = '未设置';
  const filterCountryOptions = [
    { value: ALL_FILTER, label: ALL_FILTER, color: '#94a3b8' },
  ].concat(countryOptions.map(option => Object.assign({}, option, { color: '#3b82f6' })));
  const filterLabelOptions = [
    { value: ALL_FILTER, label: ALL_FILTER, color: '#94a3b8' },
    { value: UNSET_FILTER, label: UNSET_FILTER, color: '#a1a1aa' },
    { value: '淘汰期', label: '淘汰期', color: '#ef4444' },
    { value: '新品期', label: '新品期', color: '#10b981' },
    { value: '成长期', label: '成长期', color: '#f59e0b' },
    { value: '成熟期', label: '成熟期', color: '#3b82f6' },
  ];
  const filterLevelOptions = [
    { value: ALL_FILTER, label: ALL_FILTER, color: '#94a3b8' },
    { value: UNSET_FILTER, label: UNSET_FILTER, color: '#a1a1aa' },
    { value: 'S', label: 'S', color: '#ef4444' },
    { value: 'A', label: 'A', color: '#f59e0b' },
    { value: 'B', label: 'B', color: '#3b82f6' },
    { value: 'C', label: 'C', color: '#71717a' },
  ];
  const fmt = v => (v === null || v === undefined || v === '' ? '-' : v);
  const isUnset = v => v === null || v === undefined || String(v).trim() === '';
  const matchesFilter = (value, filter) => {
    if (filter === ALL_FILTER) return true;
    if (filter === UNSET_FILTER) return isUnset(value);
    return String(value || '').trim() === filter;
  };
  const renderFilterOption = option => React.createElement('span', {
    style: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 600 },
  },
    React.createElement('span', {
      style: {
        width: 8,
        height: 8,
        borderRadius: '50%',
        flex: '0 0 8px',
        background: option.data?.color || '#94a3b8',
        boxShadow: '0 0 0 2px rgba(255,255,255,.9)',
      },
    }),
    option.label);
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
    '.aok-filter-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px 12px;padding:6px 10px;margin-bottom:12px;background:#f8fafc;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(148,163,184,.22),0 1px 2px rgba(15,23,42,.04);}',
    '.aok-filter-item{display:grid;grid-template-columns:52px auto;align-items:center;column-gap:6px;min-width:0;}',
    '.aok-filter-label{font-size:13px;font-weight:700;color:#475569;line-height:32px;text-align:right;white-space:nowrap;}',
    '.aok-filter-select .ant-select-selector{height:32px !important;min-height:32px !important;border-color:#dbe3ee !important;border-radius:6px !important;box-shadow:0 1px 2px rgba(15,23,42,.04) !important;transition-property:border-color,box-shadow;transition-duration:.16s;transition-timing-function:cubic-bezier(.2,0,0,1);}',
    '.aok-filter-select:hover .ant-select-selector{border-color:#94a3b8 !important;}',
    '.aok-filter-select.ant-select-focused .ant-select-selector{border-color:#2563eb !important;box-shadow:0 0 0 3px rgba(37,99,235,.12) !important;}',
    '.aok-filter-select .ant-select-selection-item,.aok-filter-select .ant-select-selection-placeholder{line-height:30px !important;font-size:13px !important;font-weight:600;color:#334155;}',
    '.aok-filter-reset.ant-btn{width:32px;height:32px;border-radius:6px;border-color:#dbe3ee;color:#64748b;box-shadow:0 1px 2px rgba(15,23,42,.04);transition-property:transform,color,border-color,box-shadow;transition-duration:.16s;transition-timing-function:cubic-bezier(.2,0,0,1);}',
    '.aok-filter-reset.ant-btn:not(:disabled):hover{color:#2563eb;border-color:#93b4f8;box-shadow:0 2px 6px rgba(37,99,235,.12);}',
    '.aok-filter-reset.ant-btn:not(:disabled):active{transform:scale(.96);}',
    '.aok-filter-add.ant-btn{height:32px;border-radius:6px;font-weight:700;box-shadow:0 1px 2px rgba(37,99,235,.18);transition-property:transform,box-shadow;transition-duration:.16s;transition-timing-function:cubic-bezier(.2,0,0,1);}',
    '.aok-filter-add.ant-btn:not(:disabled):hover{box-shadow:0 3px 8px rgba(37,99,235,.2);}',
    '.aok-filter-add.ant-btn:not(:disabled):active{transform:scale(.96);}',
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
    product_level: row.product_level,
  });

  const productLabelResource = ctx.makeResource('MultiRecordResource');
  productLabelResource.setDataSourceKey?.('main');
  productLabelResource.setResourceName(PRODUCT_LABEL_COLLECTION);
  productLabelResource.setPageSize(500);
  productLabelResource.setSort(['country_model']);

  const saleModelResource = ctx.makeResource('MultiRecordResource');
  saleModelResource.setDataSourceKey?.('main');
  saleModelResource.setResourceName(SALE_MODEL_COLLECTION);
  saleModelResource.setPageSize(500);
  saleModelResource.setSort(['model']);

  async function readRows() {
    await productLabelResource.refresh();
    return (productLabelResource.getData() || []).map(toViewRow);
  }

  async function readModelOptions() {
    await saleModelResource.refresh();
    const seen = new Set();
    return (saleModelResource.getData() || [])
      .map(row => String(row?.model || '').trim())
      .filter(model => {
        if (!model || seen.has(model)) return false;
        seen.add(model);
        return true;
      })
      .map(model => ({ value: model, label: model }));
  }

  async function writeRow(action, row, payload) {
    if (action === 'create') return productLabelResource.create(payload, { refresh: false });
    if (action === 'update') return productLabelResource.update(row.country_model, payload, { refresh: false });
    if (action === 'destroy') return productLabelResource.destroy(row.country_model);
    throw new Error('不支持的操作:' + action);
  }

  function App() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState(null);
    const [draft, setDraft] = useState({});
    const [country, setCountry] = useState(ALL_FILTER);
    const [modelFilter, setModelFilter] = useState(ALL_FILTER);
    const [labelFilter, setLabelFilter] = useState(ALL_FILTER);
    const [levelFilter, setLevelFilter] = useState(ALL_FILTER);
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
        value: r.label || undefined,
        style: { width: '100%' },
        options: labelOptions,
        showSearch: true,
        allowClear: true,
        placeholder: '未设置',
        onChange: v => setDraft(Object.assign({}, draft, { label: v })),
      });
    }

    function productLevelNode(row) {
      const r = editingId === row.country_model ? draft : row;
      if (editingId !== row.country_model) {
        return React.createElement('span', null, fmt(r.product_level));
      }
      return React.createElement(Select, {
        size: 'small',
        value: r.product_level || undefined,
        style: { width: '100%' },
        options: productLevelOptions,
        allowClear: true,
        placeholder: '未设置',
        onChange: v => setDraft(Object.assign({}, draft, { product_level: v })),
      });
    }

    async function save(row) {
      const isNew = row.country_model === '__new';
      const nextCountry = String(draft.country || '').trim();
      const nextModel = String(draft.model || '').trim();
      const nextLabel = String(draft.label || '').trim();
      const nextProductLevel = String(draft.product_level || '').trim();
      const nextKey = buildKey({ country: nextCountry, model: nextModel });

      if (!nextCountry || !nextModel) {
        message.warning('国家、型号不能为空');
        return;
      }
      if (!nextLabel && !nextProductLevel) {
        message.warning('产品阶段、产品等级至少填写一项');
        return;
      }

      const payload = {
        country_model: isNew ? nextKey : row.country_model,
        country: isNew ? nextCountry : row.country,
        model: isNew ? nextModel : row.model,
        label: nextLabel,
        product_level: nextProductLevel || null,
      };

      try {
        await writeRow(isNew ? 'create' : 'update', row, payload);
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
        await writeRow('destroy', row);
        message.success('已删除');
        await reload();
      } catch (e) {
        message.error('删除失败:' + (e?.message || e));
      }
      setDeletingId(null);
    }

    const filterModelOptions = [{ value: ALL_FILTER, label: ALL_FILTER }].concat(
      Array.from(new Set(rows.map(r => String(r.model || '').trim()).filter(Boolean)))
        .sort((a, b) => a.localeCompare(b))
        .map(model => ({ value: model, label: model })),
    );
    const view = rows.filter(r => (
      matchesFilter(r.country, country)
      && matchesFilter(r.model, modelFilter)
      && matchesFilter(r.label, labelFilter)
      && matchesFilter(r.product_level, levelFilter)
    ));
    const data = editingId === '__new' ? [draft].concat(view) : view;
    const hasActiveFilters = [country, modelFilter, labelFilter, levelFilter]
      .some(value => value !== ALL_FILTER);
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
        title: '产品等级',
        dataIndex: 'product_level',
        width: 110,
        onHeaderCell: lh('green'),
        render: (_, r) => productLevelNode(r),
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
        React.createElement('div', { className: 'aok-filter-bar' },
          React.createElement('div', { className: 'aok-filter-item' },
            React.createElement('span', { className: 'aok-filter-label' }, '国家'),
            React.createElement(Select, {
              className: 'aok-filter-select',
              value: country,
              style: { width: 100 },
              options: filterCountryOptions,
              optionRender: renderFilterOption,
              onChange: setCountry,
            })),
          React.createElement('div', { className: 'aok-filter-item' },
            React.createElement('span', { className: 'aok-filter-label' }, '型号'),
            React.createElement(Select, {
              className: 'aok-filter-select',
              value: modelFilter,
              style: { width: 140 },
              options: filterModelOptions,
              showSearch: true,
              optionFilterProp: 'label',
              listHeight: 280,
              onChange: setModelFilter,
            })),
          React.createElement('div', { className: 'aok-filter-item' },
            React.createElement('span', { className: 'aok-filter-label' }, '产品阶段'),
            React.createElement(Select, {
              className: 'aok-filter-select',
              value: labelFilter,
              style: { width: 120 },
              options: filterLabelOptions,
              optionRender: renderFilterOption,
              showSearch: true,
              optionFilterProp: 'label',
              onChange: setLabelFilter,
            })),
          React.createElement('div', { className: 'aok-filter-item' },
            React.createElement('span', { className: 'aok-filter-label' }, '产品等级'),
            React.createElement(Select, {
              className: 'aok-filter-select',
              value: levelFilter,
              style: { width: 100 },
              options: filterLevelOptions,
              optionRender: renderFilterOption,
              showSearch: true,
              optionFilterProp: 'label',
              onChange: setLevelFilter,
            })),
          React.createElement(Tooltip, { title: '重置筛选' },
            React.createElement(Button, {
              className: 'aok-filter-reset',
              icon: React.createElement(ReloadOutlined),
              disabled: !hasActiveFilters,
              'aria-label': '重置筛选',
              onClick: () => {
                setCountry(ALL_FILTER);
                setModelFilter(ALL_FILTER);
                setLabelFilter(ALL_FILTER);
                setLevelFilter(ALL_FILTER);
              },
            })),
          React.createElement(Button, {
            className: 'aok-filter-add',
            type: 'primary',
            style: { marginLeft: 'auto' },
            icon: React.createElement(PlusOutlined),
            disabled: editingId !== null,
            onClick: () => {
              const row = {
                country_model: '__new',
                country: country === ALL_FILTER ? 'US' : country,
                model: '',
                label: '',
                product_level: undefined,
              };
              setEditingId('__new');
              setDraft(row);
            },
          }, '添加')),
        loading
          ? React.createElement(Spin, null)
          : React.createElement(Table, {
            rowClassName: (r, i) => i % 2 ? 'aok-row-odd' : 'aok-row-even',
            size: 'small',
            columns,
            dataSource: data,
            rowKey: 'country_model',
            pagination: false,
            scroll: { x: 690 },
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
          React.createElement('div', { style: { marginTop: 4 } }, '按国家和型号维护人工产品阶段与等级。产品阶段留空时不会覆盖水位表自动计算结果。'))));
  }

  ctx.render(React.createElement(App));
}

ctx.render(null);
run();
