async function run() {
  const React = ctx.libs.React;
  const { useCallback, useEffect, useMemo, useRef, useState } = React;
  const { Button, ConfigProvider, Modal, Pagination, Select, Tag } = ctx.libs.antd;

  const currentUserId = typeof ctx.getVar === 'function' ? await ctx.getVar('ctx.user.id') : null;
  const currentUserLevel = typeof ctx.getVar === 'function' ? Number(await ctx.getVar('ctx.user.level')) || 0 : 0;
  const IS_ADMIN = currentUserLevel >= 3;
  const BLOCK_UID = ctx.model?.uid || 'water_level_sales_table';
  const FONT_SIZE = 13;
  const TOTAL_SHOP_NAME = '合计';
  const INVENTORY_WORKFLOW_KEY = 'rnrq9biwydo';
  const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];
  const EXPORT_PAGE_SIZE = 1000;
  const PRESET_COLORS = [
    { label: '基础', value: '#9DF29F' },
    { label: '必填', value: '#EB6793' },
    { label: '选填', value: '#F2BABA' },
    { label: '重要指标', value: '#C5DFB4' },
    { label: '日公式1', value: '#5DBEAC' },
    { label: '日公式2', value: '#B0D4CC' },
    { label: '日公式3', value: '#1C5C50' },
    { label: '周公式1', value: '#00205C' },
    { label: '周公式2', value: '#035E9B' },
    { label: '周公式3', value: '#044D72' },
  ];
  const DEFAULT_HEADER_COLOR = '#fafafa';
  const IMPORTANT_COLUMN_BG = '#fffbe6';
  const PUSH_PROP_OPTIONS = [
    { label: '显示/隐藏', value: 'hidden' },
    { label: '列宽', value: 'width' },
    { label: '表头名称', value: 'title' },
    { label: '表头颜色', value: 'headerColor' },
    { label: '重点列', value: 'important' },
  ];
  const apiRequest = (options) => {
    if (typeof ctx.request === 'function') return ctx.request(options);
    return ctx.api.request(options);
  };

  const FIELD_TITLES = {
    country: '国家',
    shop: '店铺',
    asin: 'ASIN',
    model: '型号',
    date: '日期',
    week: '周几',
    type: '日类型',
    weighted_sales: '加权基准销量',
    coefficient: '类型系数',
    maybe_sales: '预估销量',
    inventory: '库存',
    add: '补货',
    sale_maybe_sales: '销售预估销量',
    on_the_way: '在途',
    sales_store: '销售店铺',
    quantity_receive: '待交付',
    overseas_warehouse_test_product: '海外仓检测品库存',
    overseas_warehouse_new_product: '海外仓全新品库存',
    days_for_sale: '安全库存天数',
    estimate_days_for_sales: '销售预估安全库存天数',
    sale_inventory: '销售预估库存',
    sales: '实际销量',
    base_sales: '基准销量',
  };

  const TYPE_COLORS = {
    日常: 'default',
    淡季: 'green',
    淡季过渡: 'lime',
    '7月PD': 'orange',
    '10月秋促': 'gold',
    黑五网一: 'magenta',
    BD: 'cyan',
    LD: 'blue',
    'BD (7月PD)': 'volcano',
    'LD (7月PD)': 'red',
    'BD (10月秋促)': 'volcano',
    'LD (10月秋促)': 'red',
    'BD (黑五网一)': 'volcano',
    'LD (黑五网一)': 'red',
    'BD（淡季）': 'green',
    'LD（淡季）': 'green',
    '10月秋促(专享)': 'orange',
    '7月PD(专享)': 'gold',
    '黑五网一(专享)': 'magenta',
    woot: 'geekblue',
    旺季: 'purple',
  };

  const TYPE_STYLES = {
    日常: { bg: '#f5f7fa', border: '#d9dee7', text: '#344054' },
    淡季: { bg: '#ecfdf3', border: '#abefc6', text: '#067647' },
    淡季过渡: { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    '7月PD': { bg: '#fff7ed', border: '#fed7aa', text: '#c2410c' },
    '10月秋促': { bg: '#fefce8', border: '#fde68a', text: '#a16207' },
    黑五网一: { bg: '#fdf2f8', border: '#fbcfe8', text: '#be185d' },
    BD: { bg: '#ecfeff', border: '#a5f3fc', text: '#0e7490' },
    LD: { bg: '#eff6ff', border: '#bfdbfe', text: '#1d4ed8' },
    'BD (7月PD)': { bg: '#fff1f2', border: '#fecdd3', text: '#be123c' },
    'LD (7月PD)': { bg: '#fef2f2', border: '#fecaca', text: '#b91c1c' },
    'BD (10月秋促)': { bg: '#fff7ed', border: '#fdba74', text: '#c2410c' },
    'LD (10月秋促)': { bg: '#fff1f2', border: '#fda4af', text: '#be123c' },
    'BD (黑五网一)': { bg: '#fdf2f8', border: '#f9a8d4', text: '#be185d' },
    'LD (黑五网一)': { bg: '#fdf2f8', border: '#f0abfc', text: '#a21caf' },
    'BD（淡季）': { bg: '#ecfdf3', border: '#86efac', text: '#166534' },
    'LD（淡季）': { bg: '#f0fdf4', border: '#bbf7d0', text: '#15803d' },
    '10月秋促(专享)': { bg: '#fffbeb', border: '#fcd34d', text: '#92400e' },
    '7月PD(专享)': { bg: '#fff7ed', border: '#fb923c', text: '#9a3412' },
    '黑五网一(专享)': { bg: '#fce7f3', border: '#f472b6', text: '#9d174d' },
    woot: { bg: '#eef2ff', border: '#c7d2fe', text: '#3730a3' },
    旺季: { bg: '#f5f3ff', border: '#c4b5fd', text: '#6d28d9' },
  };

  function getTypeStyle(type) {
    return TYPE_STYLES[type] || { bg: '#f8fafc', border: '#e2e8f0', text: '#475467' };
  }

  const FUTURE_COLUMNS = [
    { field: 'shop', width: 78 },
    { field: 'date', width: 118 },
    { field: 'type', width: 112 },
    { field: 'weighted_sales', width: 106, align: 'right' },
    { field: 'coefficient', width: 86, align: 'right' },
    { field: 'maybe_sales', width: 86, align: 'right' },
    { field: 'inventory', width: 76, align: 'right' },
    { field: 'add', width: 70, align: 'right' },
    { field: 'sale_maybe_sales', width: 110, align: 'right' },
    { field: 'on_the_way', width: 76, align: 'right' },
    { field: 'sales_store', width: 92 },
    { field: 'quantity_receive', width: 82, align: 'right' },
    { field: 'overseas_warehouse_test_product', width: 130 },
    { field: 'overseas_warehouse_new_product', width: 130 },
    { field: 'days_for_sale', width: 106, align: 'right' },
    { field: 'estimate_days_for_sales', width: 138, align: 'right' },
    { field: 'sale_inventory', width: 104, align: 'right' },
  ];

  const PAST_COLUMNS = [
    { field: 'shop', width: 78 },
    { field: 'date', width: 118 },
    { field: 'sales', width: 78, align: 'right' },
    { field: 'maybe_sales', width: 86, align: 'right' },
    { field: 'sale_maybe_sales', width: 110, align: 'right' },
    { field: 'type', width: 112 },
    { field: 'weighted_sales', width: 106, align: 'right' },
    { field: 'coefficient', width: 86, align: 'right' },
    { field: 'inventory', width: 76, align: 'right' },
    { field: 'base_sales', width: 86, align: 'right' },
  ];

  const EXPORT_LOGISTICS_FIELDS = [
    'country', 'shop', 'asin', 'model', 'date', 'type', 'coefficient', 'weighted_sales',
    'maybe_sales', 'inventory', 'sale_maybe_sales', 'sale_inventory', 'add', 'on_the_way',
    'days_for_sale', 'estimate_days_for_sales', 'quantity_receive',
    'overseas_warehouse_test_product', 'overseas_warehouse_new_product',
  ];

  const EXPORT_SALES_FIELDS = [
    'country', 'shop', 'asin', 'date', 'week', 'type', 'maybe_sales', 'sale_maybe_sales', 'sales_store',
  ];

  function parseSearch(search) {
    const result = {};
    if (!search) return result;
    String(search).replace(/^\?/, '').split('&').forEach((part) => {
      if (!part) return;
      const eqIdx = part.indexOf('=');
      const key = eqIdx === -1 ? part : part.slice(0, eqIdx);
      const value = eqIdx === -1 ? '' : part.slice(eqIdx + 1);
      if (key) result[decodeURIComponent(key)] = decodeURIComponent(value);
    });
    return result;
  }

  function getRouterSearch() {
    return (
      ctx.router?.state?.location?.search
      || ctx.app?.router?.router?.state?.location?.search
      || ctx.app?.router?.location?.search
      || ''
    );
  }

  function getRouterPathname() {
    return (
      ctx.router?.state?.location?.pathname
      || ctx.app?.router?.router?.state?.location?.pathname
      || ctx.app?.router?.location?.pathname
      || '/'
    );
  }

  function readUrlParams() {
    return { ...(ctx.urlSearchParams || {}), ...parseSearch(getRouterSearch()) };
  }

  function buildSearch(params) {
    const query = Object.keys(params)
      .filter((key) => params[key] != null && params[key] !== '')
      .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    return query ? `?${query}` : '';
  }

  function replaceUrlParams(params) {
    const search = buildSearch(params);
    const pathname = getRouterPathname();
    const routers = [ctx.router, ctx.app?.router?.router].filter(Boolean);
    routers.forEach((router) => {
      if (typeof router.navigate === 'function') {
        router.navigate({ pathname, search, hash: '' }, { replace: true });
      }
    });
  }

  function todayString() {
    const today = new Date();
    return [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0'),
    ].join('-');
  }

  function formatDateYMD(value) {
    if (!value) return '';
    const text = String(value);
    return text.length >= 10 ? text.slice(0, 10) : text;
  }

  function formatDateKey(value) {
    const text = formatDateYMD(value);
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text.replace(/-/g, '');
    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return text.replace(/\D/g, '');
    return [
      parsed.getFullYear(),
      String(parsed.getMonth() + 1).padStart(2, '0'),
      String(parsed.getDate()).padStart(2, '0'),
    ].join('');
  }

  function formatNumber(value) {
    if (value === null || value === undefined || value === '') return '';
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) return String(value);
    return Number.isInteger(numberValue)
      ? String(numberValue)
      : numberValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }

  function renderValue(field, value) {
    if (field === 'date') {
      const dateText = formatDateYMD(value);
      if (!dateText) return '';
      const parsed = new Date(dateText);
      if (Number.isNaN(parsed.getTime())) return dateText;
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${dateText} ${weekDays[parsed.getDay()]}`;
    }
    if (field === 'type') {
      if (!value) return '';
      const style = getTypeStyle(value);
      return React.createElement('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          maxWidth: '100%',
          padding: '1px 7px',
          borderRadius: 4,
          border: `1px solid ${style.border}`,
          background: style.bg,
          color: style.text,
          fontWeight: 600,
          fontSize: 12,
          lineHeight: 1.6,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        },
      }, String(value));
    }
    if (
      field.includes('sales')
      || field.includes('inventory')
      || field === 'coefficient'
      || field === 'add'
      || field === 'on_the_way'
      || field === 'quantity_receive'
      || field === 'base_sales'
    ) {
      return formatNumber(value);
    }
    return value == null ? '' : String(value);
  }

  function getTextColorForBg(color) {
    if (!color || !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(color)) return '#333';
    let hex = color.slice(1);
    if (hex.length === 3) {
      hex = hex.split('').map((char) => char + char).join('');
    }
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#333' : '#fff';
  }

  function getColumnHeaderColor(col) {
    return col.headerColor || (col.important ? '#fff1b8' : DEFAULT_HEADER_COLOR);
  }

  function isNumericField(field) {
    return (
      field.includes('sales')
      || field.includes('inventory')
      || field === 'coefficient'
      || field === 'add'
      || field === 'on_the_way'
      || field === 'quantity_receive'
      || field === 'base_sales'
    );
  }

  function getAutoWidthText(field, value) {
    if (field === 'date') {
      const dateText = formatDateYMD(value);
      if (!dateText) return '';
      const parsed = new Date(dateText);
      if (Number.isNaN(parsed.getTime())) return dateText;
      const weekDays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
      return `${dateText} ${weekDays[parsed.getDay()]}`;
    }
    if (isNumericField(field)) return formatNumber(value);
    return value == null ? '' : String(value);
  }

  function estimateTextWidth(text, fontSize = FONT_SIZE) {
    if (text == null) return 0;
    if (typeof document !== 'undefined') {
      const canvas = estimateTextWidth._canvas || document.createElement('canvas');
      estimateTextWidth._canvas = canvas;
      const context = canvas.getContext?.('2d');
      if (context) {
        context.font = `${fontSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
        return Math.ceil(context.measureText(String(text)).width);
      }
    }
    let width = 0;
    String(text).split('').forEach((char) => {
      if (/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(char)) width += 1.05;
      else if (/[A-Z]/.test(char)) width += 0.72;
      else if (/[a-z0-9]/.test(char)) width += 0.62;
      else width += 0.5;
    });
    return Math.ceil(width * fontSize);
  }

  function getAutoWidthBounds(col) {
    const field = col.field;
    if (field === 'date') return { min: 108, max: 150 };
    if (field === 'type') return { min: 58, max: 150 };
    if (field === 'shop' || field === 'sales_store') return { min: 50, max: 180 };
    if (field === 'model') return { min: 58, max: 200 };
    if (field === 'asin') return { min: 104, max: 180 };
    if (field?.startsWith('overseas_warehouse')) return { min: 58, max: 220 };
    if (field === 'days_for_sale' || field === 'estimate_days_for_sales' || field === 'sale_inventory') {
      return { min: 58, max: 220 };
    }
    if (isNumericField(field)) return { min: 50, max: 180 };
    return { min: 50, max: 220 };
  }

  function clampWidth(width, bounds) {
    return Math.max(bounds.min, Math.min(bounds.max, width));
  }

  const useFloatPos = (btnRef, open) => {
    const [pos, setPos] = useState({ top: 0, left: 0 });
    useEffect(() => {
      if (!open || !btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }, [btnRef, open]);
    return pos;
  };

  const PushPanel = ({ mode, columns, onClose, anchorPos }) => {
    const [userList, setUserList] = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(true);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [selectedProps, setSelectedProps] = useState(['hidden', 'width', 'title', 'headerColor', 'important']);
    const [pushing, setPushing] = useState(false);

    useEffect(() => {
      let alive = true;
      (async () => {
        setLoadingUsers(true);
        try {
          const res = await apiRequest({ url: 'users:list', method: 'get', params: { pageSize: 200, 'filter[level][$ne]': 3 } });
          const list = Array.isArray(res?.data?.data) ? res.data.data : [];
          if (alive) setUserList(list.filter((user) => String(user.id) !== String(currentUserId)));
        } catch {
          ctx.message?.error?.('加载用户列表失败');
        } finally {
          if (alive) setLoadingUsers(false);
        }
      })();
      return () => { alive = false; };
    }, []);

    const buildPayload = useCallback((cols) => cols.map((col) => {
      const item = { key: col.key || col.field, field: col.field };
      if (selectedProps.includes('hidden')) item.hidden = col.hidden === true;
      if (selectedProps.includes('width')) item.width = Number(col.width) || 100;
      if (selectedProps.includes('title')) item.title = col.title || '';
      if (selectedProps.includes('headerColor')) item.headerColor = col.headerColor || null;
      if (selectedProps.includes('important')) item.important = col.important === true;
      return item;
    }), [selectedProps]);

    const handlePush = useCallback(async () => {
      if (!selectedUsers.length) { ctx.message?.warning?.('请先选择目标用户'); return; }
      if (!selectedProps.length) { ctx.message?.warning?.('请至少选择一个推送属性'); return; }
      setPushing(true);
      try {
        const storageKey = getColumnStorageKey(mode);
        const payload = buildPayload(columns);
        const results = await Promise.allSettled(selectedUsers.map(async (uid) => {
          const userRes = await apiRequest({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
          const existingSetting = userRes?.data?.data?.setting || {};
          const existingCols = existingSetting[storageKey];
          let mergedPayload = payload;
          if (Array.isArray(existingCols) && existingCols.length > 0) {
            const existingMap = Object.fromEntries(existingCols.map((col) => [col.key || col.field, col]));
            mergedPayload = payload.map((item) => {
              const merged = { ...(existingMap[item.key] || {}) };
              selectedProps.forEach((prop) => {
                if (item[prop] !== undefined) merged[prop] = item[prop];
              });
              merged.key = item.key;
              merged.field = item.field;
              return merged;
            });
          }
          await apiRequest({
            url: 'users:update',
            method: 'post',
            params: { filterByTk: uid },
            data: { setting: { ...existingSetting, [storageKey]: mergedPayload } },
          });
        }));
        const failCount = results.filter((item) => item.status === 'rejected').length;
        if (!failCount) {
          ctx.message?.success?.(`推送成功，已推送给 ${selectedUsers.length} 位用户`);
          onClose();
        } else {
          ctx.message?.warning?.(`部分推送失败：${failCount}/${selectedUsers.length} 位用户失败`);
        }
      } catch (error) {
        ctx.message?.error?.(`推送失败：${error?.message || '未知错误'}`);
      } finally {
        setPushing(false);
      }
    }, [buildPayload, columns, mode, onClose, selectedProps, selectedUsers]);

    const userOptions = userList.map((user) => ({
      label: user.nickname || user.username || `用户${user.id}`,
      value: user.id,
    }));

    return React.createElement('div', {
      style: {
        position: 'fixed',
        top: `${anchorPos.top}px`,
        left: `${anchorPos.left}px`,
        zIndex: 2000,
        width: 380,
        padding: 16,
        border: '1px solid #e0e0e0',
        borderRadius: 8,
        background: '#fff',
        boxShadow: '0 6px 20px rgba(0,0,0,0.18)',
        fontSize: FONT_SIZE,
      },
      onClick: (event) => event.stopPropagation(),
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          paddingBottom: 10,
          borderBottom: '1px solid #f0f0f0',
          fontWeight: 700,
        },
      },
        React.createElement('span', null, '📤 推送列配置给其他用户'),
        React.createElement('span', { onClick: onClose, style: { cursor: 'pointer', color: '#999', fontSize: 18 } }, '×'),
      ),
      React.createElement('div', { style: { marginBottom: 14 } },
        React.createElement('div', { style: { marginBottom: 6, fontWeight: 600 } }, '选择目标用户'),
        loadingUsers
          ? React.createElement('div', { style: { textAlign: 'center', padding: 8, color: '#999' } }, '加载用户中...')
          : React.createElement(Select, {
            mode: 'multiple',
            allowClear: true,
            style: { width: '100%' },
            placeholder: '请选择要推送的用户',
            value: selectedUsers,
            onChange: setSelectedUsers,
            options: userOptions,
            maxTagCount: 'responsive',
            showSearch: true,
            optionFilterProp: 'label',
            getPopupContainer: (trigger) => trigger.parentElement || trigger,
          }),
      ),
      React.createElement('div', { style: { marginBottom: 16 } },
        React.createElement('div', { style: { marginBottom: 8, fontWeight: 600 } }, '选择推送的属性'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 6 } },
          PUSH_PROP_OPTIONS.map((opt) => React.createElement('label', {
            key: opt.value,
            style: { display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' },
          },
            React.createElement('input', {
              type: 'checkbox',
              checked: selectedProps.includes(opt.value),
              onChange: (event) => {
                if (event.target.checked) setSelectedProps((prev) => [...prev, opt.value]);
                else setSelectedProps((prev) => prev.filter((value) => value !== opt.value));
              },
              style: { cursor: 'pointer', width: 14, height: 14 },
            }),
            opt.label,
          )),
        ),
      ),
      React.createElement('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
        React.createElement('button', {
          onClick: onClose,
          disabled: pushing,
          style: { padding: '6px 16px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: 4, cursor: pushing ? 'not-allowed' : 'pointer', fontSize: FONT_SIZE },
        }, '取消'),
        React.createElement('button', {
          onClick: handlePush,
          disabled: pushing || !selectedUsers.length || !selectedProps.length,
          style: {
            padding: '6px 16px',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            fontSize: FONT_SIZE,
            fontWeight: 600,
            background: (pushing || !selectedUsers.length || !selectedProps.length) ? '#b5d8ff' : '#1890ff',
            cursor: (pushing || !selectedUsers.length || !selectedProps.length) ? 'not-allowed' : 'pointer',
          },
        }, pushing ? '推送中...' : '📤 确认推送'),
      ),
    );
  };

  function pickRows(response) {
    const data = response?.data;
    if (Array.isArray(data?.data)) return data.data;
    if (Array.isArray(data)) return data;
    return [];
  }

  function pickTotal(response, fallback) {
    const meta = response?.data?.meta || response?.meta || {};
    return Number(meta.count || meta.total || fallback || 0);
  }

  function pickReportedTotal(response) {
    const meta = response?.data?.meta || response?.meta || {};
    const value = meta.count ?? meta.total;
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
  }

  function getResponseError(response) {
    const successFlag = response?.data?.success ?? response?.success;
    return (
      response?.data?.errors?.[0]?.message
      || response?.data?.error?.message
      || response?.error?.message
      || (successFlag === false ? (response?.data?.message || response?.message) : '')
      || ''
    );
  }

  function notifyTask(key, message, description, duration = 0) {
    ctx.notification?.open?.({
      key,
      message,
      description,
      duration,
      placement: 'topRight',
    });
  }

  function buildFilter(params, mode) {
    const items = [];
    if (params.asin) items.push({ asin: { $eq: params.asin } });
    if (params.country) items.push({ country: { $eq: params.country } });
    if (params.shop) items.push({ shop: { $eq: params.shop } });

    items.push(
      mode === 'future'
        ? { date: { $dateNotBefore: todayString() } }
        : { date: { $dateNotAfter: todayString() } },
    );

    return JSON.stringify({ $and: items });
  }

  function getColumnStorageKey(mode) {
    return `${BLOCK_UID}_${mode}_columns`;
  }

  function normalizeColumnDefs(columnDefs) {
    return columnDefs.map((col) => ({
      key: col.key || col.field,
      ...col,
      width: Number(col.width) || 100,
      hidden: col.hidden === true,
      headerColor: col.headerColor || null,
      important: col.important === true,
      title: col.title || FIELD_TITLES[col.field] || col.field,
    }));
  }

  function getColumnTitle(col) {
    return col.title || FIELD_TITLES[col.field] || col.field;
  }

  function buildColumnPayload(cols) {
    return cols.map((col) => ({
      key: col.key || col.field,
      field: col.field,
      title: col.title || '',
      width: Number(col.width) || 100,
      hidden: col.hidden === true,
      headerColor: col.headerColor || null,
      important: col.important === true,
    }));
  }

  async function saveColumnSettings(mode, cols) {
    if (!currentUserId || !IS_ADMIN) return false;
    try {
      const userRes = await apiRequest({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      await apiRequest({
        url: 'users:update',
        method: 'post',
        params: { filterByTk: currentUserId },
        data: { setting: { ...existingSetting, [getColumnStorageKey(mode)]: buildColumnPayload(cols) } },
      });
      return true;
    } catch (error) {
      console.warn('[WaterLevel] save column settings failed:', error?.message);
      ctx.message?.error?.('列设置保存失败');
      return false;
    }
  }

  async function loadColumnSettings(mode, columnDefs) {
    const defaults = normalizeColumnDefs(columnDefs);
    if (!currentUserId) return { columns: defaults, hasSaved: false };
    try {
      const userRes = await apiRequest({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const saved = userRes?.data?.data?.setting?.[getColumnStorageKey(mode)];
      if (!Array.isArray(saved) || !saved.length) return { columns: defaults, hasSaved: false };

      const defaultMap = Object.fromEntries(defaults.map((col) => [col.key, col]));
      const savedMap = Object.fromEntries(saved.map((item) => [item?.key || item?.field, item]));
      const result = [];
      saved.forEach((item) => {
        const key = item?.key || item?.field;
        if (!key || !defaultMap[key]) return;
        result.push({
          ...defaultMap[key],
          title: item.title || defaultMap[key].title || FIELD_TITLES[defaultMap[key].field] || defaultMap[key].field,
          width: Math.max(48, Number(item.width) || defaultMap[key].width || 100),
          hidden: item.hidden === true,
          headerColor: item.headerColor || null,
          important: item.important === true,
        });
      });
      defaults.forEach((col) => {
        if (!savedMap[col.key]) result.push(col);
      });
      return { columns: result, hasSaved: true };
    } catch (error) {
      console.warn('[WaterLevel] load column settings failed:', error?.message);
      return { columns: defaults, hasSaved: false };
    }
  }

  function makeColumns(columnDefs, columnActions = {}) {
    return columnDefs.map((col) => ({
      key: col.key || col.field,
      dataIndex: col.field,
      title: React.createElement('div', {
        draggable: !columnActions.isResizing,
        onDragStart: (event) => columnActions.onDragStart?.(event, col.key || col.field),
        onDragOver: columnActions.onDragOver,
        onDrop: (event) => columnActions.onDrop?.(event, col.key || col.field),
        style: {
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          minWidth: 0,
          paddingRight: 8,
          cursor: columnActions.isResizing ? 'col-resize' : 'move',
          userSelect: 'none',
        },
      },
        React.createElement('span', {
          style: {
            flex: 1,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          },
          title: getColumnTitle(col),
        }, getColumnTitle(col)),
        React.createElement('div', {
          onMouseDown: (event) => columnActions.onResizeStart?.(event, col.key || col.field),
          onClick: (event) => event.stopPropagation(),
          draggable: false,
          style: {
            position: 'absolute',
            right: -8,
            top: -8,
            bottom: -8,
            width: 10,
            cursor: 'col-resize',
            zIndex: 3,
          },
        }),
      ),
      width: col.width || 100,
      align: col.align || 'left',
      ellipsis: true,
      onHeaderCell: () => ({
        style: {
          width: col.width || 100,
          minWidth: col.width || 100,
          maxWidth: col.width || 100,
          padding: '6px 8px',
        },
      }),
      render: (value) => renderValue(col.field, value),
    }));
  }

  async function requestDailySales(mode, params, page, pageSize, fields) {
    return apiRequest({
      url: 'daily_sales:list',
      method: 'get',
      params: {
        page,
        pageSize,
        sort: mode === 'future' ? 'date' : '-date',
        filter: buildFilter(params, mode),
        ...(fields ? { fields: fields.join(',') } : {}),
      },
    });
  }

  async function requestShopList(asin, country) {
    if (!asin || !country) return [];
    const response = await apiRequest({
      url: 'inventory_base:list',
      method: 'get',
      params: {
        page: 1,
        pageSize: 200,
        fields: 'shop',
        filter: JSON.stringify({
          $and: [
            { asin: { $eq: asin } },
            { country: { $eq: country } },
            { date: { $eq: todayString() } },
          ],
        }),
      },
    });
    return Array.from(new Set(pickRows(response).map((row) => row.shop).filter(Boolean)));
  }

  async function requestSalesCoefficientList(asin, country) {
    if (!asin || !country) return [];
    const response = await apiRequest({
      url: 'sales_coefficient:list',
      method: 'get',
      params: {
        page: 1,
        pageSize: 200,
        fields: 'country,asin,type,coefficient,country_asin_type,last_modified_date',
        filter: JSON.stringify({
          $and: [
            { asin: { $eq: asin } },
            { country: { $eq: country } },
          ],
        }),
      },
    });

    const rows = pickRows(response);
    const seen = new Set();
    const orderedTypes = Object.keys(TYPE_COLORS);

    return rows
      .filter((row) => row.type)
      .filter((row) => {
        if (seen.has(row.type)) return false;
        seen.add(row.type);
        return true;
      })
      .sort((a, b) => {
        const ai = orderedTypes.indexOf(a.type);
        const bi = orderedTypes.indexOf(b.type);
        if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
        return String(a.type).localeCompare(String(b.type), 'zh-CN');
      });
  }

  function toCsvCell(value) {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  }

  function safeFilenamePart(value) {
    return String(value || '')
      .trim()
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ');
  }

  function downloadCsv(filename, fields, rows) {
    const header = fields.map((field) => FIELD_TITLES[field] || field);
    const lines = [
      header.map(toCsvCell).join(','),
      ...rows.map((row) => fields.map((field) => toCsvCell(field === 'date' ? formatDateYMD(row[field]) : row[field])).join(',')),
    ];
    const blob = new Blob([`\uFEFF${lines.join('\n')}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';

    const host = ctx.element;
    if (host && typeof host.appendChild === 'function') {
      host.appendChild(link);
      link.click();
      link.remove();
    } else {
      link.click();
    }

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function requestAllDailySales(mode, params, fields) {
    const allRows = [];
    let page = 1;
    let reportedTotal = null;

    while (true) {
      const response = await requestDailySales(mode, params, page, EXPORT_PAGE_SIZE, fields);
      const errorMessage = getResponseError(response);
      if (errorMessage) throw new Error(errorMessage);

      const rows = pickRows(response);
      allRows.push(...rows);
      reportedTotal = pickReportedTotal(response);

      if (
        !rows.length
        || rows.length < EXPORT_PAGE_SIZE
        || (reportedTotal != null && allRows.length >= reportedTotal)
      ) break;
      page += 1;
    }

    return allRows;
  }

  async function exportRows(params, type) {
    if (!params.asin || !params.country) {
      ctx.message?.warning?.('请先选择 ASIN 和国家后再导出');
      return;
    }

    const fields = type === 'sales' ? EXPORT_SALES_FIELDS : EXPORT_LOGISTICS_FIELDS;
    const label = type === 'sales' ? '销售' : '物流';
    notifyTask(`export-${type}`, `导出执行中 - ${label}`, '正在拉取数据并生成 CSV，请稍候...');

    const rows = await requestAllDailySales('future', params, fields);
    const filename = [
      '未来销量模拟',
      label,
      safeFilenamePart(params.asin),
      safeFilenamePart(params.country),
      safeFilenamePart(params.shop || TOTAL_SHOP_NAME),
    ].filter(Boolean).join('-');

    downloadCsv(`${filename}.csv`, fields, rows);
    notifyTask(`export-${type}`, `导出完成 - ${label}`, `已导出 ${rows.length} 条`, 4.5);
    ctx.message?.success?.(`已导出 ${rows.length} 条`);
  }

  function detectDelimiter(headerLine) {
    const candidates = [',', ';', '\t'];
    const counts = candidates.map((delimiter) => headerLine.split(delimiter).length - 1);
    const max = Math.max(...counts);
    return max > 0 ? candidates[counts.indexOf(max)] : ',';
  }

  function cleanCell(value) {
    let text = String(value == null ? '' : value).trim();
    if (text.length >= 2 && text.startsWith('"') && text.endsWith('"')) text = text.slice(1, -1);
    if (text.length >= 2 && text.startsWith("'") && text.endsWith("'")) text = text.slice(1, -1);
    return text.trim();
  }

  function parseCsvLine(line, delimiter) {
    return line.split(delimiter).map(cleanCell);
  }

  async function runWithConcurrency(tasks, concurrency) {
    const results = [];
    const executing = new Set();
    for (const task of tasks) {
      const promise = task()
        .then((value) => {
          executing.delete(promise);
          return { status: 'fulfilled', value };
        })
        .catch((reason) => {
          executing.delete(promise);
          return { status: 'rejected', reason };
        });
      results.push(promise);
      executing.add(promise);
      if (executing.size >= concurrency) await Promise.race(executing);
    }
    return Promise.all(results);
  }

  async function updateDailySalesRows(updates, buildData, label) {
    let successCount = 0;
    let failCount = 0;
    notifyTask(`import-${label}`, `导入进度 - ${label}`, `执行中，共 ${updates.length} 条...`);

    const tasks = updates.map((update) => async () => {
      await apiRequest({
        url: 'daily_sales:update',
        method: 'post',
        params: { filterByTk: update.shop_country_asin_date },
        data: buildData(update),
      });
    });

    const results = await runWithConcurrency(tasks, 15);
    results.forEach((result) => {
      if (result.status === 'fulfilled') successCount += 1;
      else failCount += 1;
    });

    ctx.notification?.open?.({
      key: `import-${label}`,
      message: `导入进度 - ${label}`,
      description: `成功 ${successCount} 条，失败 ${failCount} 条`,
      duration: 4.5,
    });
    return { successCount, failCount };
  }

  async function importSalesCsv(file, onDone) {
    const requiredColumns = ['国家', '店铺', 'ASIN', '日期', '周几', '日类型', '预估销量', '销售预估销量', '销售店铺'];
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const lines = text.split('\n').map((line) => line.replace(/\r$/, '')).filter((line) => line.trim());
    if (lines.length < 2) throw new Error('CSV 文件内容为空或格式不正确');

    const delimiter = detectDelimiter(lines[0]);
    const headers = parseCsvLine(lines[0], delimiter);
    const missing = requiredColumns.filter((column) => !headers.includes(column));
    if (missing.length) throw new Error(`CSV 文件缺少必需列: ${missing.join(', ')}`);

    const updatesHeji = [];
    const updatesSalesStore = [];
    const mainStoreMap = {};
    notifyTask('sales-import-main', 'CSV 导入执行中', '正在读取 CSV 并准备更新数据...');

    for (let index = 1; index < lines.length; index += 1) {
      const values = parseCsvLine(lines[index], delimiter);
      if (values.length !== headers.length) continue;
      const row = {};
      headers.forEach((header, valueIndex) => {
        row[header] = values[valueIndex];
      });

      const saleMaybeSalesRaw = String(row['销售预估销量'] || '').trim();
      const salesStoreRaw = String(row['销售店铺'] || '').trim();
      if (!saleMaybeSalesRaw || !salesStoreRaw) continue;

      const dateKey = formatDateKey(row['日期']);
      const saleValue = parseInt(saleMaybeSalesRaw, 10) || 0;
      const comboKey = `${row['国家']}_${row['ASIN']}_${dateKey}`;
      if (!mainStoreMap[comboKey]) mainStoreMap[comboKey] = salesStoreRaw;

      updatesHeji.push({
        shop_country_asin_date: `${TOTAL_SHOP_NAME}_${row['国家']}_${row['ASIN']}_${dateKey}`,
        sales_store: salesStoreRaw,
        sale_maybe_sales: saleValue,
      });
      updatesSalesStore.push({
        shop_country_asin_date: `${salesStoreRaw}_${row['国家']}_${row['ASIN']}_${dateKey}`,
        sale_maybe_sales: saleValue,
      });
    }

    if (!updatesHeji.length) throw new Error('没有找到有效数据行');
    notifyTask(
      'sales-import-main',
      'CSV 导入执行中',
      `已解析 ${updatesHeji.length} 条有效数据，正在更新合计店铺和销售店铺...`,
    );

    const resultA = await updateDailySalesRows(
      updatesHeji,
      (update) => ({ sales_store: update.sales_store, sale_maybe_sales: update.sale_maybe_sales }),
      '合计店铺',
    );
    const resultB = await updateDailySalesRows(
      updatesSalesStore,
      (update) => ({ sale_maybe_sales: update.sale_maybe_sales }),
      '销售店铺',
    );

    const zeroUpdates = [];
    notifyTask('sales-import-main', 'CSV 导入执行中', '正在查询并置零非主销售店铺...');
    for (const comboKey of Object.keys(mainStoreMap)) {
      const parts = comboKey.split('_');
      const country = parts[0];
      const dateKey = parts[parts.length - 1];
      const asin = parts.slice(1, -1).join('_');
      const mainStore = mainStoreMap[comboKey];

      try {
        const response = await apiRequest({
          url: 'daily_sales:list',
          method: 'get',
          params: {
            pageSize: 200,
            fields: 'shop,country,asin,date',
            filter: JSON.stringify({ country, asin, date: dateKey }),
          },
        });
        pickRows(response).forEach((record) => {
          if (!record.shop || record.shop === mainStore || record.shop === TOTAL_SHOP_NAME) return;
          zeroUpdates.push({
            shop_country_asin_date: `${record.shop}_${country}_${asin}_${dateKey}`,
            sale_maybe_sales: 0,
          });
        });
      } catch (error) {
        console.warn('[WaterLevel] zero-out query failed:', comboKey, error?.message);
      }
    }

    const resultC = zeroUpdates.length
      ? await updateDailySalesRows(zeroUpdates, () => ({ sale_maybe_sales: 0 }), '非主非合置零')
      : { successCount: 0, failCount: 0 };

    notifyTask(
      'sales-import-main',
      'CSV 导入完成',
      `合计 ${resultA.successCount} 条，销售店铺 ${resultB.successCount} 条，置零 ${resultC.successCount} 条`,
      4.5,
    );
    ctx.message?.success?.(
      `导入完成：合计 ${resultA.successCount} 条，销售店铺 ${resultB.successCount} 条，置零 ${resultC.successCount} 条`,
    );
    if (typeof onDone === 'function') onDone();
  }

  function chooseImportFile(onDone) {
    Modal.confirm({
      title: '导入提示',
      content: '导入格式：CSV UTF-8（逗号分隔）。将更新 daily_sales 的销售预估销量与销售店铺。',
      okText: '我知道了，开始导入',
      cancelText: '取消',
      onOk: () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.csv,text/csv';
        input.style.display = 'none';
        input.onchange = async (event) => {
          const file = event.target.files?.[0];
          input.remove();
          if (!file) return;
          try {
            await importSalesCsv(file, onDone);
          } catch (error) {
            notifyTask('sales-import-main', 'CSV 导入失败', error?.message || String(error), 8);
            ctx.message?.error?.(`CSV 导入失败: ${error?.message || error}`);
          }
        };

        const host = ctx.element;
        if (host && typeof host.appendChild === 'function') {
          host.appendChild(input);
          input.click();
        } else {
          input.click();
        }
      },
    });
  }

  async function triggerInventoryWorkflow(params, onDone) {
    if (!params.asin || !params.country) {
      ctx.message?.warning?.('请先选择 ASIN 和国家后再更新库存');
      return;
    }

    const contextValues = {
      asin: params.asin || '',
      country: params.country || '',
      shop: params.shop || TOTAL_SHOP_NAME,
    };

    notifyTask('inventory-update', '预估库存更新执行中', '已开始触发预估库存更新，请稍候...');

    const response = await apiRequest({
      url: 'workflows:trigger',
      method: 'post',
      params: { triggerWorkflows: INVENTORY_WORKFLOW_KEY },
      data: { values: contextValues },
    });

    const errorMessage = getResponseError(response);
    if (errorMessage) throw new Error(errorMessage);

    notifyTask('inventory-update', '预估库存更新已触发', '后台 workflow 已开始执行，稍后请刷新查看结果。', 4.5);
    ctx.message?.success?.('已触发预估库存更新');
    if (typeof onDone === 'function') onDone();
  }

  async function refreshAndTriggerInventory(params, reloadAll) {
    if (typeof reloadAll === 'function') reloadAll();
    try {
      await triggerInventoryWorkflow(params, reloadAll);
    } catch (error) {
      notifyTask('inventory-update', '预估库存更新失败', error?.message || String(error), 8);
      ctx.message?.error?.(`预估库存更新失败: ${error?.message || error}`);
    }
  }

  const SalesTable = ({ title, mode, columns, pageSizeDefault, params, refreshKey, toolbar }) => {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(pageSizeDefault);
    const [total, setTotal] = useState(0);
    const [columnDefs, setColumnDefs] = useState(() => normalizeColumnDefs(columns));
    const [isResizing, setIsResizing] = useState(false);
    const [editingHeader, setEditingHeader] = useState(null);
    const [showPanel, setShowPanel] = useState(false);
    const [showPush, setShowPush] = useState(false);
    const requestSeqRef = useRef(0);
    const panelBtnRef = useRef(null);
    const pushBtnRef = useRef(null);
    const panelPos = useFloatPos(panelBtnRef, showPanel);
    const pushPos = useFloatPos(pushBtnRef, showPush);
    const dragColKeyRef = useRef(null);
    const resizeRef = useRef(null);
    const manuallyResizedRef = useRef(new Set());
    const saveTimerRef = useRef(null);

    const queueSaveColumns = useCallback((nextColumns) => {
      if (!IS_ADMIN) return;
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        saveTimerRef.current = null;
        saveColumnSettings(mode, nextColumns);
      }, 250);
    }, [mode]);

    const updateColumns = useCallback((updater, shouldSave = true) => {
      setColumnDefs((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        if (shouldSave) queueSaveColumns(next);
        return next;
      });
    }, [queueSaveColumns]);

    const autoFitColumns = useCallback((cols, sampleRows) => cols.map((col) => {
      if (manuallyResizedRef.current.has(col.key)) return col;
      const headerText = getColumnTitle(col);
      const bounds = getAutoWidthBounds(col);
      const headerPadding = IS_ADMIN ? 28 : 18;
      const cellPadding = 18;
      const headerWidth = estimateTextWidth(headerText, FONT_SIZE) + headerPadding;
      const contentWidth = (sampleRows || []).reduce((max, row) => {
        const text = getAutoWidthText(col.field, row?.[col.field]);
        const extra = col.field === 'type' ? 18 : cellPadding;
        return Math.max(max, estimateTextWidth(text, FONT_SIZE) + extra);
      }, 0);
      return { ...col, width: clampWidth(Math.ceil(Math.max(headerWidth, contentWidth)), bounds) };
    }), []);

    const applyAutoWidths = useCallback(() => {
      manuallyResizedRef.current.clear();
      updateColumns((prev) => autoFitColumns(prev, rows));
      ctx.message?.success?.(`${title}列宽已自动调整`);
    }, [autoFitColumns, rows, title, updateColumns]);

    const loadData = useCallback(async (nextPage = page, nextPageSize = pageSize) => {
      const seq = ++requestSeqRef.current;
      if (!params.asin || !params.country) {
        setRows([]);
        setTotal(0);
        return;
      }

      setLoading(true);
      try {
        const response = await requestDailySales(mode, params, nextPage, nextPageSize);
        if (seq !== requestSeqRef.current) return;
        const nextRows = pickRows(response);
        setRows(nextRows);
        setTotal(pickTotal(response, nextRows.length));
      } catch (error) {
        if (seq !== requestSeqRef.current) return;
        ctx.message?.error?.(`${title}加载失败: ${error?.message || ''}`);
        setRows([]);
        setTotal(0);
      } finally {
        if (seq === requestSeqRef.current) setLoading(false);
      }
    }, [mode, page, pageSize, params.asin, params.country, params.shop, title]);

    useEffect(() => {
      setPage(1);
      loadData(1, pageSize);
    }, [loadData, pageSize, refreshKey]);

    useEffect(() => {
      let alive = true;
      manuallyResizedRef.current.clear();
      loadColumnSettings(mode, columns).then(({ columns: nextColumns, hasSaved }) => {
        if (!alive) return;
        if (hasSaved) {
          manuallyResizedRef.current = new Set(nextColumns.map((col) => col.key));
          setColumnDefs(nextColumns);
        } else {
          setColumnDefs(autoFitColumns(nextColumns, rows));
        }
      });
      return () => {
        alive = false;
        if (saveTimerRef.current) {
          clearTimeout(saveTimerRef.current);
          saveTimerRef.current = null;
        }
      };
    }, [autoFitColumns, columns, mode]);

    useEffect(() => {
      setColumnDefs((prev) => autoFitColumns(prev, rows));
    }, [autoFitColumns, rows]);

    const onDragStart = useCallback((event, key) => {
      if (!IS_ADMIN || isResizing) {
        event.preventDefault();
        return;
      }
      dragColKeyRef.current = key;
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', key);
      }
    }, [isResizing]);

    const onDragOver = useCallback((event) => {
      if (!IS_ADMIN) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    }, []);

    const onDrop = useCallback((event, targetKey) => {
      event.preventDefault();
      if (!IS_ADMIN) return;
      const fromKey = dragColKeyRef.current || event.dataTransfer?.getData('text/plain');
      dragColKeyRef.current = null;
      if (!fromKey || fromKey === targetKey) return;

      updateColumns((prev) => {
        const next = [...prev];
        const fromIndex = next.findIndex((col) => col.key === fromKey);
        const targetIndex = next.findIndex((col) => col.key === targetKey);
        if (fromIndex < 0 || targetIndex < 0) return prev;
        const [moved] = next.splice(fromIndex, 1);
        next.splice(targetIndex, 0, moved);
        return next;
      });
    }, [updateColumns]);

    const onResizeStart = useCallback((event, key) => {
      event.preventDefault();
      event.stopPropagation();
      if (!IS_ADMIN) return;
      const col = columnDefs.find((item) => item.key === key);
      manuallyResizedRef.current.add(key);
      resizeRef.current = {
        key,
        startX: event.clientX,
        startWidth: Number(col?.width) || 100,
      };
      setIsResizing(true);
    }, [columnDefs]);

    const onResizeMove = useCallback((event) => {
      if (!resizeRef.current) return;
      const { key, startX, startWidth } = resizeRef.current;
      const nextWidth = Math.max(48, Math.round(startWidth + event.clientX - startX));
      updateColumns((prev) => prev.map((col) => (
        col.key === key ? { ...col, width: nextWidth } : col
      )), false);
    }, [updateColumns]);

    const onResizeEnd = useCallback(() => {
      if (resizeRef.current) {
        resizeRef.current = null;
        setColumnDefs((prev) => {
          queueSaveColumns(prev);
          return prev;
        });
      }
      setIsResizing(false);
    }, [queueSaveColumns]);

    const startEditHeader = useCallback((event, col) => {
      event.preventDefault();
      event.stopPropagation();
      if (!IS_ADMIN) return;
      setEditingHeader({ key: col.key, value: getColumnTitle(col) });
    }, []);

    const commitHeaderTitle = useCallback(() => {
      if (!editingHeader) return;
      const nextTitle = String(editingHeader.value || '').trim();
      updateColumns((prev) => prev.map((col) => (
        col.key === editingHeader.key
          ? { ...col, title: nextTitle || FIELD_TITLES[col.field] || col.field }
          : col
      )));
      setEditingHeader(null);
    }, [editingHeader, updateColumns]);

    const cancelHeaderEdit = useCallback(() => {
      setEditingHeader(null);
    }, []);

    const visibleColumnDefs = useMemo(() => {
      const visible = columnDefs.filter((col) => col.hidden !== true);
      return visible.length ? visible : columnDefs;
    }, [columnDefs]);

    const toggleColumnVisible = useCallback((key) => {
      if (!IS_ADMIN) return;
      updateColumns((prev) => {
        const visibleCount = prev.filter((col) => col.hidden !== true).length;
        return prev.map((col) => {
          if (col.key !== key) return col;
          if (col.hidden !== true && visibleCount <= 1) {
            ctx.message?.warning?.('至少保留一列显示');
            return col;
          }
          return { ...col, hidden: col.hidden !== true };
        });
      });
    }, [updateColumns]);

    const showAllColumns = useCallback(() => {
      if (!IS_ADMIN) return;
      updateColumns((prev) => prev.map((col) => ({ ...col, hidden: false })));
    }, [updateColumns]);

    const resetColumns = useCallback(() => {
      if (!IS_ADMIN) return;
      manuallyResizedRef.current.clear();
      updateColumns(autoFitColumns(normalizeColumnDefs(columns), rows));
      setEditingHeader(null);
      ctx.message?.success?.(`${title}列配置已重置`);
    }, [autoFitColumns, columns, rows, title, updateColumns]);

    const togglePanel = useCallback((event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      setShowPanel((value) => !value);
      setShowPush(false);
    }, []);

    const togglePush = useCallback((event) => {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      setShowPush((value) => !value);
      setShowPanel(false);
    }, []);

    const setHeaderColor = useCallback((key, color) => {
      if (!IS_ADMIN) return;
      updateColumns((prev) => prev.map((col) => (
        col.key === key ? { ...col, headerColor: color } : col
      )));
    }, [updateColumns]);

    const clearHeaderColor = useCallback((key) => {
      if (!IS_ADMIN) return;
      updateColumns((prev) => prev.map((col) => (
        col.key === key ? { ...col, headerColor: null } : col
      )));
    }, [updateColumns]);

    const toggleImportantColumn = useCallback((key) => {
      if (!IS_ADMIN) return;
      updateColumns((prev) => prev.map((col) => (
        col.key === key ? { ...col, important: col.important !== true } : col
      )));
    }, [updateColumns]);

    const panelEl = IS_ADMIN && showPanel
      ? React.createElement(React.Fragment, null,
        React.createElement('div', {
          onClick: () => setShowPanel(false),
          style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' },
        }),
        React.createElement('div', {
          onClick: (event) => event.stopPropagation(),
          style: {
            position: 'fixed',
            top: `${panelPos.top}px`,
            left: `${panelPos.left}px`,
            zIndex: 2000,
            width: 600,
            maxWidth: 'calc(100vw - 24px)',
            maxHeight: 620,
            overflowY: 'auto',
            padding: 12,
            border: '1px solid #e0e0e0',
            borderRadius: 8,
            background: '#fff',
            boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          },
        },
          React.createElement('div', {
            style: {
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 8,
              marginBottom: 8,
              paddingBottom: 8,
              borderBottom: '1px solid #f0f0f0',
            },
          },
            React.createElement('span', { style: { fontWeight: 700, color: '#555' } }, `${title} 列设置`),
            React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
              React.createElement('span', { style: { color: '#aaa', fontSize: 12 } }, '★ 重点 | ☑ 显示 | 🎨 颜色'),
              React.createElement(Button, { size: 'small', onClick: applyAutoWidths }, '自动列宽'),
              React.createElement(Button, { size: 'small', onClick: showAllColumns }, '全显示'),
              React.createElement(Button, { size: 'small', onClick: resetColumns }, '重置列'),
            ),
          ),
          columnDefs.map((col) => {
            const headerColor = getColumnHeaderColor(col);
            const isCustomColor = !!col.headerColor;
            return React.createElement('div', {
              key: col.key,
              style: {
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 0 4px 8px',
                borderBottom: '1px solid #fafafa',
              },
            },
              React.createElement('input', {
                type: 'checkbox',
                checked: col.hidden !== true,
                onChange: () => toggleColumnVisible(col.key),
                style: { flexShrink: 0, cursor: 'pointer' },
              }),
              React.createElement('span', {
                title: getColumnTitle(col),
                style: {
                  flex: 1,
                  minWidth: 0,
                  color: col.hidden ? '#bbb' : '#333',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  userSelect: 'none',
                },
              }, getColumnTitle(col)),
              React.createElement('div', { style: { display: 'flex', gap: 3, alignItems: 'center', flexShrink: 0 } },
                PRESET_COLORS.map((pc) => React.createElement('div', {
                  key: pc.value,
                  title: pc.label,
                  onClick: () => setHeaderColor(col.key, pc.value),
                  style: {
                    width: 14,
                    height: 14,
                    borderRadius: 2,
                    cursor: 'pointer',
                    background: pc.value,
                    border: headerColor === pc.value ? '2px solid #333' : '2px solid transparent',
                    boxSizing: 'border-box',
                  },
                })),
                isCustomColor
                  ? React.createElement('div', {
                    title: '重置为默认色',
                    onClick: () => clearHeaderColor(col.key),
                    style: {
                      width: 14,
                      height: 14,
                      borderRadius: 2,
                      cursor: 'pointer',
                      background: col.important ? '#fff1b8' : DEFAULT_HEADER_COLOR,
                      border: '2px dashed #333',
                      boxSizing: 'border-box',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 9,
                      color: '#666',
                      fontWeight: 700,
                      lineHeight: 1,
                    },
                  }, '↺')
                  : null,
              ),
            );
          }),
        ),
      )
      : null;

    const pushPanelEl = IS_ADMIN && showPush
      ? React.createElement(React.Fragment, null,
        React.createElement('div', {
          onClick: () => setShowPush(false),
          style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' },
        }),
        React.createElement(PushPanel, {
          mode,
          columns: columnDefs,
          onClose: () => setShowPush(false),
          anchorPos: pushPos,
        }),
      )
      : null;

    const scrollX = useMemo(() => visibleColumnDefs.reduce((sum, col) => sum + (col.width || 100), 0), [visibleColumnDefs]);
    const rowKeyOf = useCallback((row, index) => (
      row.shop_country_asin_date || row.country_asin_date || row.id || `${mode}-${index}`
    ), [mode]);
    const paginationTotal = total || rows.length;

    return React.createElement('section', {
      style: {
        minWidth: 0,
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        padding: 12,
      },
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 8,
          marginBottom: 8,
        },
      },
        React.createElement('div', { style: { fontWeight: 600, fontSize: 14, whiteSpace: 'nowrap' } }, title),
        React.createElement('div', {
          style: {
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'flex-end',
            flexWrap: 'wrap',
          },
        },
          toolbar ? toolbar({ rows, reload: () => loadData(page, pageSize) }) : null,
          IS_ADMIN
            ? React.createElement('button', {
              type: 'button',
              ref: panelBtnRef,
              onMouseDown: togglePanel,
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
              },
              style: {
                padding: '2px 8px',
                height: 24,
                border: showPanel ? '1px solid #1677ff' : '1px solid #d9d9d9',
                borderRadius: 4,
                background: showPanel ? '#e6f7ff' : '#fff',
                color: '#333',
                fontSize: 12,
                lineHeight: '20px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              },
            }, '👁️ 列设置')
            : null,
          IS_ADMIN
            ? React.createElement('button', {
              type: 'button',
              ref: pushBtnRef,
              onMouseDown: togglePush,
              onClick: (event) => {
                event.preventDefault();
                event.stopPropagation();
              },
              style: {
                padding: '2px 8px',
                height: 24,
                border: showPush ? '1px solid #fa8c16' : '1px solid #d9d9d9',
                borderRadius: 4,
                background: showPush ? '#fff7e6' : '#fff',
                color: showPush ? '#fa8c16' : '#333',
                fontSize: 12,
                lineHeight: '20px',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
              },
            }, '📤 推送配置')
            : null,
          React.createElement(Button, {
            size: 'small',
            onClick: () => loadData(page, pageSize),
            disabled: loading,
          }, '刷新'),
        ),
      ),
      panelEl,
      pushPanelEl,
      React.createElement('div', {
        style: {
          position: 'relative',
          border: '1px solid #f0f0f0',
          borderRadius: 6,
          overflow: 'hidden',
          background: '#fff',
        },
      },
        React.createElement('div', {
          style: {
            overflowX: 'auto',
            overflowY: 'auto',
            maxHeight: mode === 'future' ? 560 : 560,
            transform: 'translateZ(0)',
          },
        },
          React.createElement('table', {
            style: {
              width: scrollX,
              minWidth: '100%',
              borderCollapse: 'separate',
              borderSpacing: 0,
              tableLayout: 'fixed',
              background: '#fff',
            },
          },
            React.createElement('colgroup', null,
              visibleColumnDefs.map((col) => React.createElement('col', {
                key: col.key,
                style: { width: col.width || 100 },
              })),
            ),
            React.createElement('thead', null,
              React.createElement('tr', null,
                visibleColumnDefs.map((col) => React.createElement('th', {
                  key: col.key,
                  draggable: IS_ADMIN && !isResizing && editingHeader?.key !== col.key,
                  onDragStart: (event) => onDragStart(event, col.key),
                  onDragOver,
                  onDrop: (event) => onDrop(event, col.key),
                  onDoubleClick: (event) => startEditHeader(event, col),
                  style: {
                    position: 'sticky',
                    top: 0,
                    zIndex: 2,
                    width: col.width || 100,
                    padding: IS_ADMIN ? '7px 18px 7px 8px' : '7px 8px',
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: col.important ? '2px solid #faad14' : '1px solid #e8e8e8',
                    background: getColumnHeaderColor(col),
                    color: getTextColorForBg(getColumnHeaderColor(col)),
                    fontWeight: 600,
                    fontSize: FONT_SIZE,
                    textAlign: col.align || 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxSizing: 'border-box',
                    cursor: IS_ADMIN ? (isResizing ? 'col-resize' : 'move') : 'default',
                    userSelect: 'none',
                  },
                  title: getColumnTitle(col),
                },
                  editingHeader?.key === col.key
                    ? React.createElement('input', {
                      autoFocus: true,
                      value: editingHeader.value,
                      onChange: (event) => setEditingHeader({ key: col.key, value: event.target.value }),
                      onBlur: commitHeaderTitle,
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') commitHeaderTitle();
                        if (event.key === 'Escape') cancelHeaderEdit();
                      },
                      onClick: (event) => event.stopPropagation(),
                      onMouseDown: (event) => event.stopPropagation(),
                      draggable: false,
                      style: {
                        width: '100%',
                        height: 22,
                        border: '1px solid #1677ff',
                        borderRadius: 3,
                        padding: '0 4px',
                        fontSize: FONT_SIZE,
                        outline: 'none',
                        boxSizing: 'border-box',
                      },
                    })
                    : React.createElement('span', {
                      style: {
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        maxWidth: '100%',
                        minWidth: 0,
                      },
                    },
                      col.important
                        ? React.createElement('span', { style: { color: '#fa8c16', flexShrink: 0 } }, '★')
                        : null,
                      React.createElement('span', {
                        style: {
                          minWidth: 0,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        },
                      }, getColumnTitle(col)),
                    ),
                  IS_ADMIN
                    ? React.createElement('div', {
                      onMouseDown: (event) => onResizeStart(event, col.key),
                      onClick: (event) => event.stopPropagation(),
                      draggable: false,
                      style: {
                        position: 'absolute',
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: 8,
                        cursor: 'col-resize',
                        zIndex: 3,
                      },
                    })
                    : null,
                )),
              ),
            ),
            React.createElement('tbody', null,
              loading && !rows.length
                ? React.createElement('tr', null,
                  React.createElement('td', {
                    colSpan: visibleColumnDefs.length,
                    style: {
                      padding: 32,
                      textAlign: 'center',
                      color: '#999',
                      borderBottom: '1px solid #f0f0f0',
                    },
                  }, '正在加载数据...'),
                )
                : null,
              !loading && !rows.length
                ? React.createElement('tr', null,
                  React.createElement('td', {
                    colSpan: visibleColumnDefs.length,
                    style: {
                      padding: 32,
                      textAlign: 'center',
                      color: '#999',
                      borderBottom: '1px solid #f0f0f0',
                    },
                  }, '暂无数据'),
                )
                : null,
              rows.map((row, rowIndex) => React.createElement('tr', {
                key: rowKeyOf(row, rowIndex),
                style: { background: rowIndex % 2 === 0 ? '#fff' : '#fcfcfc' },
              },
                visibleColumnDefs.map((col) => React.createElement('td', {
                  key: col.key,
                  style: {
                    width: col.width || 100,
                    padding: '6px 8px',
                    borderRight: '1px solid #f0f0f0',
                    borderBottom: '1px solid #f0f0f0',
                    background: col.important ? IMPORTANT_COLUMN_BG : undefined,
                    color: '#333',
                    fontWeight: col.important ? 600 : 400,
                    fontSize: FONT_SIZE,
                    textAlign: col.align || 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    boxSizing: 'border-box',
                  },
                  title: typeof row[col.field] === 'object' ? '' : String(row[col.field] ?? ''),
                }, renderValue(col.field, row[col.field]))),
              )),
            ),
          ),
        ),
        loading && rows.length
          ? React.createElement('div', {
            style: {
              position: 'absolute',
              right: 10,
              top: 10,
              padding: '2px 8px',
              borderRadius: 4,
              background: 'rgba(24,144,255,0.08)',
              color: '#1677ff',
              fontSize: 12,
            },
          }, '刷新中')
          : null,
      ),
      React.createElement('div', {
        style: {
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingTop: 10,
        },
      },
        React.createElement(Pagination, {
          current: page,
          pageSize,
          total: paginationTotal,
          pageSizeOptions: PAGE_SIZE_OPTIONS,
          showSizeChanger: true,
          showQuickJumper: true,
          size: 'small',
          showTotal: (count, range) => `第 ${range[0]}-${range[1]} 条，共 ${count} 条`,
          onChange: (nextPage, nextPageSize) => {
            setPage(nextPage);
            setPageSize(nextPageSize);
            loadData(nextPage, nextPageSize);
          },
        }),
      ),
      isResizing
        ? React.createElement('div', {
          onMouseMove: onResizeMove,
          onMouseUp: onResizeEnd,
          onMouseLeave: onResizeEnd,
          style: {
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            cursor: 'col-resize',
            background: 'transparent',
          },
        })
        : null,
    );
  };

  const ShopSwitcher = ({ params, onChange, shops, loading, onRefresh }) => {
    const shopList = [TOTAL_SHOP_NAME, ...shops.filter((shop) => shop !== TOTAL_SHOP_NAME)];
    const currentShop = params.shop || TOTAL_SHOP_NAME;

    return React.createElement('section', {
      style: {
        background: '#fff',
        border: '1px solid #f0f0f0',
        borderRadius: 8,
        marginBottom: 12,
        padding: 12,
      },
    },
      React.createElement('div', {
        style: {
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          marginBottom: 10,
        },
      },
        React.createElement('div', {
          style: {
            display: 'flex',
            alignItems: 'baseline',
            gap: 8,
          },
        },
          React.createElement('span', { style: { fontWeight: 700, fontSize: 14 } }, '店铺切换'),
          React.createElement('span', { style: { color: '#999', fontSize: 12 } }, `${shopList.length} 个店铺`),
        ),
        React.createElement(Button, { size: 'small', onClick: onRefresh }, '全部刷新'),
      ),
      React.createElement('div', {
        style: {
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          overflowY: 'hidden',
          padding: '2px 0 3px',
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        },
      },
        shopList.map((shop) => {
          const active = shop === currentShop;
          return React.createElement('button', {
            key: shop,
            onClick: () => onChange(shop),
            style: {
              flex: '0 0 auto',
              minWidth: 54,
              padding: '5px 12px',
              borderRadius: 6,
              border: active ? '1px solid #1677ff' : '1px solid #e5e7eb',
              background: active ? '#eaf3ff' : '#fff',
              color: active ? '#0958d9' : '#4b5563',
              fontWeight: active ? 700 : 500,
              fontSize: 13,
              lineHeight: 1.35,
              cursor: 'pointer',
              boxShadow: active ? '0 1px 3px rgba(22,119,255,0.18)' : 'none',
              whiteSpace: 'nowrap',
            },
          }, shop);
        }),
      ),
    );
  };

  const CoefficientPanel = ({ rows, loading }) => React.createElement('section', {
    style: {
      background: '#fff',
      border: '1px solid #f0f0f0',
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
  },
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: rows.length || loading ? 10 : 0,
      },
    },
      React.createElement('div', null,
        React.createElement('div', { style: { fontWeight: 700, fontSize: 14 } }, '销售系数'),
        React.createElement('div', { style: { color: '#999', fontSize: 12, marginTop: 2 } },
          loading ? '正在读取 sales_coefficient' : rows.length ? '' : '当前 ASIN / 国家暂无配置',
        ),
      ),
    ),
    loading || !rows.length
      ? null
      : React.createElement('div', {
        style: {
          display: 'flex',
          gap: 8,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 2,
          scrollbarWidth: 'thin',
          WebkitOverflowScrolling: 'touch',
        },
      },
        rows.map((row) => {
          const style = getTypeStyle(row.type);
          return React.createElement('div', {
            key: row.type,
            title: `${row.type}: ${formatNumber(row.coefficient)}`,
            style: {
              flex: '0 0 auto',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              minWidth: 128,
              maxWidth: 220,
              padding: '7px 10px',
              border: `1px solid ${style.border}`,
              borderRadius: 6,
              background: style.bg,
              color: style.text,
              boxShadow: '0 1px 2px rgba(15,23,42,0.04)',
              whiteSpace: 'nowrap',
            },
          },
            React.createElement('span', {
              style: {
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                fontSize: 12,
                fontWeight: 600,
              },
            }, row.type),
            React.createElement('strong', {
              style: {
                marginLeft: 'auto',
                fontSize: 17,
                lineHeight: 1,
                fontVariantNumeric: 'tabular-nums',
              },
            }, formatNumber(row.coefficient)),
          );
        }),
      ),
  );

  const WaterLevelTables = () => {
    const [params, setParams] = useState(readUrlParams());
    const [shops, setShops] = useState([]);
    const [shopLoading, setShopLoading] = useState(false);
    const [coefficientRows, setCoefficientRows] = useState([]);
    const [coefficientLoading, setCoefficientLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const reloadAll = useCallback(() => setRefreshKey((value) => value + 1), []);

    const updateParams = useCallback((nextParams, shouldNavigate = false) => {
      setParams(nextParams);
      if (shouldNavigate) replaceUrlParams(nextParams);
      setRefreshKey((value) => value + 1);
    }, []);

    useEffect(() => {
      const router = ctx.router || ctx.app?.router?.router;
      if (!router || typeof router.subscribe !== 'function') return undefined;
      return router.subscribe(() => updateParams(readUrlParams(), false));
    }, [updateParams]);

    useEffect(() => {
      let alive = true;
      setShopLoading(true);
      requestShopList(params.asin, params.country)
        .then((list) => {
          if (alive) setShops(list);
        })
        .catch((error) => {
          if (alive) {
            setShops([]);
            ctx.message?.warning?.(`店铺列表加载失败: ${error?.message || ''}`);
          }
        })
        .finally(() => {
          if (alive) setShopLoading(false);
        });
      return () => { alive = false; };
    }, [params.asin, params.country]);

    useEffect(() => {
      let alive = true;
      if (!params.asin || !params.country) {
        setCoefficientRows([]);
        setCoefficientLoading(false);
        return () => { alive = false; };
      }

      setCoefficientLoading(true);
      requestSalesCoefficientList(params.asin, params.country)
        .then((list) => {
          if (alive) setCoefficientRows(list);
        })
        .catch((error) => {
          if (alive) {
            setCoefficientRows([]);
            ctx.message?.warning?.(`销售系数加载失败: ${error?.message || ''}`);
          }
        })
        .finally(() => {
          if (alive) setCoefficientLoading(false);
        });

      return () => { alive = false; };
    }, [params.asin, params.country, refreshKey]);

    const currentShop = params.shop || TOTAL_SHOP_NAME;
    const missingRequired = !params.asin || !params.country;

    const futureToolbar = () => React.createElement(React.Fragment, null,
      React.createElement(Button, {
        size: 'small',
        onClick: () => exportRows(params, 'logistics').catch((error) => {
          notifyTask('export-logistics', '导出失败 - 物流', error?.message || String(error), 8);
          ctx.message?.error?.(`导出失败: ${error?.message || error}`);
        }),
      }, '导出-物流'),
      React.createElement(Button, {
        size: 'small',
        onClick: () => exportRows(params, 'sales').catch((error) => {
          notifyTask('export-sales', '导出失败 - 销售', error?.message || String(error), 8);
          ctx.message?.error?.(`导出失败: ${error?.message || error}`);
        }),
      }, '导出-销售'),
      currentShop === TOTAL_SHOP_NAME
        ? React.createElement(Button, {
          size: 'small',
          onClick: () => chooseImportFile(() => refreshAndTriggerInventory(params, reloadAll)),
        }, '导入')
        : null,
      React.createElement(Button, {
        size: 'small',
        onClick: () => triggerInventoryWorkflow(params, reloadAll).catch((error) => {
          notifyTask('inventory-update', '预估库存更新失败', error?.message || String(error), 8);
          ctx.message?.error?.(`预估库存更新失败: ${error?.message || ''}`);
        }),
      }, '预估库存更新'),
    );

    return React.createElement('div', {
      style: {
        padding: 16,
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: FONT_SIZE,
        background: '#fafafa',
      },
    },
      React.createElement(ShopSwitcher, {
        params: { ...params, shop: currentShop },
        shops,
        loading: shopLoading,
        onChange: (shop) => updateParams({ ...params, shop }, true),
        onRefresh: reloadAll,
      }),
      !missingRequired
        ? React.createElement(CoefficientPanel, {
          rows: coefficientRows,
          loading: coefficientLoading,
        })
        : null,
      missingRequired
        ? React.createElement('div', {
          style: {
            padding: 24,
            textAlign: 'center',
            color: '#999',
            border: '1px solid #f0f0f0',
            borderRadius: 8,
            background: '#fff',
          },
        }, 'URL 中缺少 asin 或 country 参数')
        : React.createElement('div', {
          style: {
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 0.85fr)',
            gap: 16,
            alignItems: 'start',
          },
        },
          React.createElement(SalesTable, {
            title: '未来销量模拟',
            mode: 'future',
            columns: FUTURE_COLUMNS,
            pageSizeDefault: 100,
            params: { ...params, shop: currentShop },
            refreshKey,
            toolbar: futureToolbar,
          }),
          React.createElement(SalesTable, {
            title: '过去销量',
            mode: 'past',
            columns: PAST_COLUMNS,
            pageSizeDefault: 50,
            params: { ...params, shop: currentShop },
            refreshKey,
          }),
        ),
    );
  };

  ctx.render(
    React.createElement(ConfigProvider, { locale: { locale: 'zh_CN' } },
      React.createElement(WaterLevelTables),
    ),
  );
}

run();
