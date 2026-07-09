const React = ctx.libs.React;
const {
  Alert,
  Card,
  Empty,
  Skeleton,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
} = ctx.libs.antd;

const DETAIL_ROUTE = '/admin/d7djduic5ca';
const VALID_STATUSES = ['重点', '普通', '新品'];
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

function isValidAsinItem(item) {
  const status = normalizeText(item?.status);
  const maintenanceLevel = normalizeText(item?.maintenance_level);
  return VALID_STATUSES.includes(status) && maintenanceLevel !== '变体';
}

function flattenAsinRows(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const model = normalizeText(row?.model);
    if (!model) return;
    const data = {
      country: normalizeText(row?.country) || '未填站点',
      saleName: normalizeText(row?.sale_owner) || '未填销售',
      model,
      asin: normalizeText(row?.asin),
      status: normalizeText(row?.status) || '未填状态',
      maintenanceLevel: normalizeText(row?.maintenance_level),
    };
    if (!data.asin || !isValidAsinItem({ status: data.status, maintenance_level: data.maintenanceLevel })) return;
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

const statusColorMap = {
  '\u91cd\u70b9': 'purple',
  '\u65b0\u54c1': 'orange',
  '\u666e\u901a': 'blue',
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
  gap: 4,
  minHeight: 23,
  padding: '1px 6px',
  border: '1px solid #d9d9d9',
  borderRadius: 4,
  background: '#fff',
  color: '#1677ff',
  fontSize: 13,
  fontWeight: 600,
  textDecoration: 'none',
  lineHeight: '19px',
};

function renderAsin(item) {
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
      React.createElement('span', null, item.asin),
      React.createElement(Tag, {
        color: statusColorMap[item.status] || 'default',
        style: {
          marginInlineEnd: 0,
          marginLeft: 2,
          fontSize: 13,
          lineHeight: '19px',
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
        gap: 3,
        minWidth: 0,
        overflow: 'visible',
      },
    }, row.asinItems.map(renderAsin))
  );
}

function renderSaleGroup(saleName, models, index) {
  const rows = Object.keys(models).sort((a, b) => a.localeCompare(b)).map((model) => ({
    model,
    asinItems: models[model],
  }));
  const modelCount = rows.length;
  const maxAsinCount = rows.reduce((max, row) => Math.max(max, row.asinItems.length), 1);
  const basisWidth = Math.min(660, Math.max(370, 260 + modelCount * 56 + maxAsinCount * 86));
  return React.createElement('div', {
    key: saleName,
    style: {
      flex: `0 0 ${basisWidth}px`,
      width: basisWidth,
      maxWidth: '100%',
      minWidth: 300,
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
    rows.map(renderModelRow)
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
      ['业务数据', 'asin表'],
      ['人员范围', 'users表'],
    ]),
    renderTooltipSection('字段', [
      ['站点', 'asin.country'],
      ['销售', 'asin.sale_owner'],
      ['型号', 'asin.model'],
      ['ASIN', 'asin.asin'],
    ]),
    renderTooltipSection('人员', [
      ['销售身份', 'users.username'],
      ['部门主管', 'users.department_manager'],
    ]),
    renderTooltipSection('筛选', [
      ['状态', '重点 / 普通 / 新品'],
      ['排除', '变体、无型号、无 ASIN'],
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
        alignItems: 'flex-start',
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
    const asinRows = await fetchAllList('asin', { sort: ['country', 'sale_owner', 'model', 'asin'] });
    let items = flattenAsinRows(asinRows);
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
