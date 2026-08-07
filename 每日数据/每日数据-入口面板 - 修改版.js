const React = ctx.libs.React;
const {
  Alert,
  Button,
  Card,
  Empty,
  Popover,
  Skeleton,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} = ctx.libs.antd;
const { DownOutlined, RightOutlined } = ctx.libs.antdIcons;

const DETAIL_ROUTE = '/admin/d7djduic5ca';
const ACTIVE_STATUSES = ['重点', '普通', '新品'];
const HISTORY_STATUS = '无需关注';
const PAGE_SIZE = 500;
const MAX_PAGES = 5;

const normalizeText = (value) => String(value ?? '').trim();
const normalizeSearch = (value) => normalizeText(value).toLowerCase();

function safeGetVar(path) {
  return Promise.resolve()
    .then(() => ctx.getVar(path))
    .catch(() => null);
}

function extractArrayResponse(res) {
  const data = res?.data?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res)) return res;
  return [];
}

async function fetchAllList(resourceName, params = {}) {
  const rows = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const res = await ctx.request({
      url: `${resourceName}:list`,
      method: 'get',
      params: {
        page,
        pageSize: PAGE_SIZE,
        ...params,
      },
    });
    const pageRows = extractArrayResponse(res);
    rows.push(...pageRows);
    if (pageRows.length < PAGE_SIZE) break;
  }
  return rows;
}

async function loadDailyAsinKeys() {
  const res = await ctx.request({
    url: 'daily_asins:query',
    method: 'post',
    data: {
      dimensions: [
        { field: ['asin_country'], alias: 'asin_country' },
      ],
      measures: [
        { field: ['country_asin_date'], aggregation: 'count', alias: 'row_count' },
      ],
      limit: 5000,
    },
  });
  return new Set(
    extractArrayResponse(res)
      .map((row) => normalizeText(row?.asin_country))
      .filter(Boolean)
  );
}

async function loadCurrentUser() {
  return {
    id: await safeGetVar('ctx.user.id'),
    username: normalizeText(await safeGetVar('ctx.user.username')) || 'guest',
    nickname: normalizeText(await safeGetVar('ctx.user.nickname')),
    level: Number(await safeGetVar('ctx.user.level')) || 0,
    roles: await safeGetVar('ctx.user.roles'),
    raw: await safeGetVar('ctx.user'),
  };
}

function getUserAliases(user) {
  return [
    user?.username,
    user?.nickname,
  ].map(normalizeText).filter(Boolean);
}

function getUserDepartments(user) {
  const department = normalizeText(user?.department);
  return department ? [department] : [];
}

function getRoleNames(source) {
  const rawRoles = source?.roles ?? source?.role ?? source?.appRoles ?? source?.raw?.roles;
  const list = Array.isArray(rawRoles) ? rawRoles : [rawRoles];
  return list.map((role) => {
    if (!role) return '';
    if (typeof role === 'object') {
      return normalizeText(role.name || role.title || role.roleName || role.key);
    }
    return normalizeText(role);
  }).filter(Boolean);
}

function hasAdminRole(user) {
  return getRoleNames(user).some((role) => {
    const text = normalizeSearch(role);
    return ['admin', 'root', 'super-admin', 'administrator', '系统管理员', '管理员']
      .some((word) => text.includes(word));
  });
}

function getCurrentUserRecord(users, currentUser) {
  const currentId = normalizeText(currentUser.id);
  const currentNameSet = new Set(getUserAliases(currentUser.raw || currentUser).concat(currentUser.username));
  return users.find((user) => currentId && normalizeText(user?.id) === currentId)
    || users.find((user) => getUserAliases(user).some((name) => currentNameSet.has(name)))
    || currentUser.raw
    || currentUser;
}

function buildScope(users, currentUser) {
  const userRecord = getCurrentUserRecord(users, currentUser);
  const level = Number(userRecord?.level ?? currentUser.level) || currentUser.level;
  const isAdmin = level >= 3 || hasAdminRole(userRecord) || hasAdminRole(currentUser);
  if (isAdmin) {
    return {
      mode: 'admin',
      label: '管理员视图',
      helper: '显示全部销售数据',
      allowedSaleNames: null,
    };
  }

  const currentNameSet = new Set(getUserAliases(userRecord).concat(getUserAliases(currentUser)).filter(Boolean));
  const managedUsers = users.filter((user) => currentNameSet.has(normalizeText(user?.department_manager)));
  if (managedUsers.length) {
    const names = new Set();
    managedUsers.forEach((user) => getUserAliases(user).forEach((name) => names.add(name)));
    getUserAliases(userRecord).forEach((name) => names.add(name));
    const managedDepartments = Array.from(new Set(managedUsers.flatMap(getUserDepartments)));
    return {
      mode: 'manager',
      label: '部门主管视图',
      helper: managedDepartments.length
        ? `显示 ${managedDepartments.join(' / ')} 部门销售数据`
        : '显示部门主管负责的销售数据',
      allowedSaleNames: names,
    };
  }

  return {
    mode: 'sales',
    label: '销售视图',
    helper: '仅显示当前销售数据',
    allowedSaleNames: new Set(getUserAliases(userRecord).concat(currentUser.username).filter(Boolean)),
  };
}

function isValidAsinItem(item, dailyAsinKeys) {
  const status = normalizeText(item?.status);
  const maintenanceLevel = normalizeText(item?.maintenance_level);
  if (maintenanceLevel === '变体') return false;
  if (ACTIVE_STATUSES.includes(status)) return true;
  if (status !== HISTORY_STATUS) return false;
  return dailyAsinKeys.has(normalizeText(item?.unique));
}

function flattenAsinRows(rows, dailyAsinKeys) {
  const map = new Map();
  rows.forEach((row) => {
    const model = normalizeText(row?.model);
    const saleName = normalizeText(row?.sale_owner);
    if (!model || !saleName) return;
    const data = {
      country: normalizeText(row?.country) || '未填站点',
      saleName,
      model,
      asin: normalizeText(row?.asin),
      status: normalizeText(row?.status) || '未填状态',
      maintenanceLevel: normalizeText(row?.maintenance_level),
      unique: normalizeText(row?.unique),
    };
    if (!data.asin || !isValidAsinItem({
      status: data.status,
      maintenance_level: data.maintenanceLevel,
      unique: data.unique,
    }, dailyAsinKeys)) return;
    const key = [data.country, data.saleName, data.model, data.asin].join('__');
    if (!map.has(key)) map.set(key, data);
  });
  return Array.from(map.values()).sort((a, b) => (
    a.country.localeCompare(b.country)
    || a.saleName.localeCompare(b.saleName)
    || a.model.localeCompare(b.model)
    || a.asin.localeCompare(b.asin)
  ));
}

function buildTree(items) {
  const tree = {};
  items.forEach((item) => {
    if (!tree[item.country]) tree[item.country] = {};
    if (!tree[item.country][item.saleName]) tree[item.country][item.saleName] = {};
    if (!tree[item.country][item.saleName][item.model]) tree[item.country][item.saleName][item.model] = [];
    tree[item.country][item.saleName][item.model].push(item);
  });
  return tree;
}

function makeDetailUrl(item) {
  const query = [
    ['model', item.model],
    ['country', item.country],
    ['asin', item.asin],
    ['sale_owner', item.saleName],
    ['status', item.status],
  ].map(([key, value]) => `${key}=${encodeURIComponent(value || '')}`).join('&');
  return `${DETAIL_ROUTE}?${query}`;
}

function countTree(tree) {
  const countryEntries = Object.entries(tree);
  let saleCount = 0;
  let modelCount = 0;
  countryEntries.forEach(([, sales]) => {
    const saleEntries = Object.entries(sales);
    saleCount += saleEntries.length;
    saleEntries.forEach(([, models]) => {
      modelCount += Object.keys(models).length;
    });
  });
  return {
    countryCount: countryEntries.length,
    saleCount,
    modelCount,
  };
}

const statusStyleMap = {
  '\u91cd\u70b9': { color: '#c41d7f', background: '#fff0f6' },
  '\u65b0\u54c1': { color: '#d46b08', background: '#fff7e6' },
  '\u666e\u901a': { color: '#0958d9', background: '#e6f4ff' },
  '\u65e0\u9700\u5173\u6ce8': { color: '#64748b', background: '#f1f5f9' },
};

const countryColorMap = {
  US: { border: '#91caff', text: '#0958d9', soft: '#f5fbff' },
  CA: { border: '#b7eb8f', text: '#389e0d', soft: '#fbfff7' },
  DE: { border: '#d3adf7', text: '#722ed1', soft: '#fdfaff' },
  FR: { border: '#ffd591', text: '#d46b08', soft: '#fffaf0' },
  JP: { border: '#ffa39e', text: '#cf1322', soft: '#fff8f7' },
};

function getCountryColor(country) {
  return countryColorMap[normalizeText(country).toUpperCase()] || {
    border: '#d9e2ec',
    text: '#475569',
    soft: '#fbfcfe',
  };
}

const asinLinkStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  minHeight: 24,
  padding: '2px 4px 2px 7px',
  border: '1px solid #dbe4ee',
  borderRadius: 4,
  background: '#fff',
  textDecoration: 'none',
  boxShadow: '0 1px 2px rgba(15, 23, 42, 0.06)',
};

function renderAsin(item) {
  const statusStyle = statusStyleMap[item.status] || {
    color: '#64748b',
    background: '#f1f5f9',
  };
  return React.createElement(Tooltip, {
    key: `${item.country}_${item.saleName}_${item.model}_${item.asin}`,
    title: '进入每日数据详情',
  },
    React.createElement('a', {
      href: makeDetailUrl(item),
      target: '_blank',
      rel: 'noreferrer',
      style: asinLinkStyle,
    },
      React.createElement('span', {
        style: {
          color: '#2563eb',
          fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
          fontSize: 14,
          fontWeight: 650,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: 0,
          lineHeight: '18px',
          whiteSpace: 'nowrap',
        },
      }, item.asin),
      React.createElement(Tag, {
        bordered: false,
        style: {
          marginInlineEnd: 0,
          borderRadius: 3,
          color: statusStyle.color,
          background: statusStyle.background,
          fontSize: 11,
          fontWeight: 600,
          lineHeight: '18px',
          paddingInline: 5,
        },
      }, item.status)
    )
  );
}

function renderModelRow(row, index) {
  return React.createElement('div', {
    key: row.model,
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      padding: '4px 6px',
      borderTop: index === 0 ? 'none' : '1px solid #edf1f5',
      background: index % 2 === 0 ? '#fff' : '#fcfdff',
      minWidth: 0,
    },
  },
    React.createElement(Tag, {
      style: {
        marginInlineEnd: 0,
        fontSize: 13,
        lineHeight: '21px',
        color: '#475569',
        background: '#f1f5f9',
        borderColor: '#cbd5e1',
        borderRadius: 10,
        width: 92,
        flex: '0 0 92px',
        textAlign: 'center',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        fontWeight: 700,
      },
    }, row.model),
    React.createElement('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 4,
        minWidth: 0,
        overflow: 'visible',
      },
    }, row.asinItems.map(renderAsin))
  );
}

function renderHistoryAsins(historyRows) {
  return React.createElement('div', {
    style: {
      width: 420,
      maxWidth: 'calc(100vw - 64px)',
      maxHeight: 240,
      overflowY: 'auto',
      overflowX: 'hidden',
    },
  }, historyRows.map(renderModelRow));
}

function HistoryAsinPopover({ historyRows, historyCount, hasActiveRows }) {
  const [open, setOpen] = React.useState(false);
  const ExpandIcon = open ? DownOutlined : RightOutlined;
  return React.createElement(Popover, {
    content: renderHistoryAsins(historyRows),
    trigger: 'click',
    placement: 'bottomLeft',
    open,
    onOpenChange: setOpen,
    overlayStyle: {
      maxWidth: 'calc(100vw - 32px)',
    },
  },
    React.createElement(Button, {
      type: 'text',
      block: true,
      'aria-expanded': open,
      style: {
        height: 40,
        marginTop: 'auto',
        paddingInline: 10,
        borderTop: hasActiveRows ? '1px solid #edf1f5' : 'none',
        borderRadius: 0,
        background: '#fafafa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        color: '#475569',
      },
    },
      React.createElement('span', {
        style: {
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 13,
          fontWeight: 600,
        },
      },
        React.createElement(ExpandIcon, {
          style: {
            fontSize: 12,
            color: '#64748b',
          },
        }),
        React.createElement('span', null, open ? '收起【无需关注】ASIN' : '展开【无需关注】ASIN')
      ),
      React.createElement(Tag, {
        style: {
          marginInlineEnd: 0,
          fontSize: 12,
          lineHeight: '20px',
          fontVariantNumeric: 'tabular-nums',
        },
      }, `${historyCount} 个 ASIN`)
    )
  );
}

function renderSaleGroup(saleName, models, index) {
  const rows = Object.keys(models).sort((a, b) => a.localeCompare(b)).map((model) => ({
    model,
    asinItems: models[model],
  }));
  const activeRows = rows.map((row) => ({
    ...row,
    asinItems: row.asinItems.filter((item) => item.status !== HISTORY_STATUS),
  })).filter((row) => row.asinItems.length);
  const historyRows = rows.map((row) => ({
    ...row,
    asinItems: row.asinItems.filter((item) => item.status === HISTORY_STATUS),
  })).filter((row) => row.asinItems.length);
  const historyCount = historyRows.reduce((sum, row) => sum + row.asinItems.length, 0);
  return React.createElement('div', {
    key: saleName,
    style: {
      display: 'flex',
      flexDirection: 'column',
      flex: '0 1 380px',
      width: 380,
      maxWidth: '100%',
      minWidth: 0,
      border: '1px solid #e6ebf1',
      borderRadius: 5,
      background: '#fff',
      overflow: 'hidden',
    },
  },
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        minHeight: 28,
        padding: '4px 8px',
        background: '#f8fafc',
        gap: 8,
      },
    },
      React.createElement(Typography.Text, {
        strong: true,
        ellipsis: true,
        style: {
        fontSize: 14,
        color: '#1f2937',
        minWidth: 70,
      },
    }, saleName)
    ),
    activeRows.map(renderModelRow),
    historyCount ? React.createElement(HistoryAsinPopover, {
      historyRows,
      historyCount,
      hasActiveRows: activeRows.length > 0,
    }) : null
  );
}

function renderTooltipRow(label, value) {
  return React.createElement('div', {
    style: {
      display: 'grid',
      gridTemplateColumns: '70px minmax(0, 1fr)',
      columnGap: 8,
      alignItems: 'start',
      marginTop: 3,
      color: '#fff',
      lineHeight: '18px',
    },
  },
    React.createElement('span', {
      style: {
        color: '#c7d2fe',
        whiteSpace: 'nowrap',
      },
    }, label),
    React.createElement('span', {
      style: {
        color: '#fff',
        minWidth: 0,
      },
    }, value)
  );
}

function renderTooltipSection(title, rows) {
  return React.createElement('div', {
    style: {
      marginTop: 8,
      paddingTop: 8,
      borderTop: '1px solid rgba(255,255,255,0.16)',
    },
  },
    React.createElement('div', {
      style: {
        color: '#bae0ff',
        fontWeight: 700,
        lineHeight: '18px',
        marginBottom: 3,
      },
    }, title),
    rows.map(([label, value]) => React.createElement(React.Fragment, {
      key: `${title}_${label}`,
    }, renderTooltipRow(label, value)))
  );
}

function renderSourceTooltip() {
  const content = React.createElement('div', {
    style: {
      width: 390,
      maxWidth: 390,
      color: '#fff',
      fontSize: 12,
    },
  },
    React.createElement('div', {
      style: {
        fontWeight: 700,
        fontSize: 13,
        lineHeight: '20px',
      },
    }, '入口数据口径'),
    renderTooltipSection('来源', [
      ['业务数据', 'asin表 + daily_asins表'],
      ['人员范围', 'users表'],
    ]),
    renderTooltipSection('字段', [
      ['站点', 'asin.country'],
      ['销售', 'asin.sale_owner'],
      ['型号', 'asin.model'],
      ['ASIN', 'asin.asin'],
      ['历史组合', 'daily_asins.asin_country'],
    ]),
    renderTooltipSection('人员', [
      ['销售身份', 'users.username'],
      ['部门主管', 'users.department_manager'],
    ]),
    renderTooltipSection('筛选', [
      ['直接显示', '重点 / 普通 / 新品'],
      ['折叠显示', '有每日数据历史的无需关注'],
      ['排除', '变体、无销售、无型号、无 ASIN'],
    ]),
    renderTooltipSection('权限', [
      ['管理员', '全部数据'],
      ['主管', '本部门数据'],
      ['销售', '本人数据'],
    ])
  );
  return React.createElement(Tooltip, {
    title: content,
    placement: 'bottom',
    overlayStyle: {
      maxWidth: 430,
    },
  },
    React.createElement('span', {
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 18,
        height: 18,
        borderRadius: '50%',
        border: '1px solid #1677ff',
        color: '#1677ff',
        background: '#fff',
        fontSize: 12,
        fontWeight: 700,
        cursor: 'help',
        lineHeight: '18px',
      },
    }, '?')
  );
}

function renderCountry(country, sales) {
  const saleEntries = Object.entries(sales).sort(([a, aModels], [b, bModels]) => {
    const modelDiff = Object.keys(bModels).length - Object.keys(aModels).length;
    return modelDiff || a.localeCompare(b);
  });
  const countryColor = getCountryColor(country);
  return React.createElement('section', {
    key: country,
    style: {
      border: '1px solid #e6ebf1',
      borderLeft: `4px solid ${countryColor.text}`,
      borderRadius: 6,
      background: '#fff',
      overflow: 'hidden',
      minWidth: 0,
    },
  },
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '6px 8px',
        background: countryColor.soft,
        borderBottom: `1px solid ${countryColor.border}`,
      },
    },
      React.createElement(Tag, {
        color: countryColor.text,
        style: {
          marginInlineEnd: 0,
          minWidth: 42,
          textAlign: 'center',
          fontWeight: 700,
          fontSize: 14,
        },
      }, country),
      React.createElement('span', {
        style: {
          flex: 1,
        },
      })
    ),
    React.createElement('div', {
      style: {
        display: 'flex',
        flexWrap: 'wrap',
        gap: 8,
        padding: 8,
        alignItems: 'stretch',
      },
    }, saleEntries.map(([saleName, models], index) => renderSaleGroup(saleName, models, index)))
  );
}

function renderPanel(scope, items) {
  const tree = buildTree(items);
  const countryEntries = Object.entries(tree).sort(([a], [b]) => a.localeCompare(b));
  const counts = countTree(tree);
  const scopeColor = scope.mode === 'admin' ? 'red' : scope.mode === 'manager' ? 'gold' : 'blue';
  const showSummary = scope.mode !== 'sales';
  return React.createElement('div', {
    style: {
      padding: 8,
      background: '#f6f7f9',
      minHeight: 120,
    },
  },
    showSummary ? React.createElement(Card, {
      size: 'small',
      style: {
        marginBottom: 8,
        borderRadius: 6,
      },
      bodyStyle: {
        padding: '7px 10px',
      },
    },
      React.createElement(Space, { size: 8, wrap: true },
        React.createElement(Tag, { color: scopeColor }, scope.label),
        React.createElement(Typography.Text, { type: 'secondary' }, scope.helper),
        scope.mode === 'admin' ? renderSourceTooltip() : null,
        React.createElement(Typography.Text, { strong: true }, `${counts.countryCount} 个站点 / ${counts.saleCount} 位销售 / ${counts.modelCount} 个型号`)
      )
    ) : null,
    countryEntries.length
      ? React.createElement('div', {
        style: {
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        },
      }, countryEntries.map(([country, sales]) => renderCountry(country, sales)))
      : React.createElement(Card, { size: 'small' }, React.createElement(Empty, { description: '当前范围内没有可展示 ASIN' }))
  );
}

ctx.render(React.createElement(Card, { size: 'small' },
  React.createElement(Spin, { spinning: true },
    React.createElement(Skeleton, { active: true, paragraph: { rows: 4 } })
  )
));

Promise.resolve().then(async () => {
  try {
    const currentUser = await loadCurrentUser();
    const users = await fetchAllList('users', { sort: ['id'] }).catch(() => []);
    const scope = buildScope(users, currentUser);
    const [asinRows, dailyAsinKeys] = await Promise.all([
      fetchAllList('asin', { sort: ['country', 'sale_owner', 'model', 'asin'] }),
      loadDailyAsinKeys(),
    ]);
    let items = flattenAsinRows(asinRows, dailyAsinKeys);
    if (scope.allowedSaleNames) {
      items = items.filter((item) => scope.allowedSaleNames.has(item.saleName));
    }
    ctx.render(renderPanel(scope, items));
  } catch (err) {
    ctx.render(React.createElement(Alert, {
      type: 'error',
      showIcon: true,
      message: `入口面板加载失败：${err?.message || '未知错误'}`,
    }));
  }
});
