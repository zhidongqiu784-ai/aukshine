const mountNode = document.createElement('div');
mountNode.style.padding = '16px';
mountNode.innerHTML = '<div style="color:#666;font-size:12px;">正在初始化店铺切换...</div>';

if (ctx && ctx.element) {
  ctx.element.replaceChildren(mountNode);
}

const SHOP_PARAM_KEY = 'shop';
const TOTAL_SHOP_NAME = '合计';
const CACHE_TTL_MS = 5 * 60 * 1000;

const TABLE_UIDS = [
  '18662b522ad', // 未来销量模拟
  '5f9d3d49af7',
  '3764a7be4b0',
];

const CHART_UIDS = [
  '5cf15c3c587', // 安全库存图表
];

if (globalThis.__NOCOBASE_URL_KEEPER__) {
  if (globalThis.__NOCOBASE_URL_KEEPER__.refreshTimerId) {
    clearTimeout(globalThis.__NOCOBASE_URL_KEEPER__.refreshTimerId);
  }
  if (Array.isArray(globalThis.__NOCOBASE_URL_KEEPER__.chartTimerIds)) {
    globalThis.__NOCOBASE_URL_KEEPER__.chartTimerIds.forEach((timerId) => clearTimeout(timerId));
  }
  if (typeof globalThis.__NOCOBASE_URL_KEEPER__.unlisten === 'function') {
    globalThis.__NOCOBASE_URL_KEEPER__.unlisten();
  }
  if (typeof globalThis.__NOCOBASE_URL_KEEPER__.unlistenKeeper === 'function') {
    globalThis.__NOCOBASE_URL_KEEPER__.unlistenKeeper();
  }
}

globalThis.__NOCOBASE_URL_KEEPER__ = {
  refreshTimerId: null,
  chartTimerIds: [],
  navigating: false,
};

globalThis.__NOCOBASE_SHOP_SWITCHER_CACHE__ =
  globalThis.__NOCOBASE_SHOP_SWITCHER_CACHE__ || Object.create(null);

function isShopKey(key) {
  return key === SHOP_PARAM_KEY || /^shop\d+$/.test(key);
}

function parseSearch(search) {
  const params = {};
  try {
    const text = String(search || '').replace(/^\?/, '');
    if (!text) return params;
    text.split('&').forEach((pair) => {
      if (!pair) return;
      const eqIdx = pair.indexOf('=');
      const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
      const value = eqIdx === -1 ? '' : pair.slice(eqIdx + 1);
      const decodedKey = decodeURIComponent(key);
      if (decodedKey) params[decodedKey] = decodeURIComponent(value);
    });
  } catch (error) {
    console.warn('[ShopSwitcher] parse search failed:', error?.message);
  }
  return params;
}

function getRouterSearch(routerLike) {
  return (
    routerLike?.state?.location?.search
    || routerLike?.location?.search
    || ''
  );
}

function getRouterPathname(routerLike) {
  return (
    routerLike?.state?.location?.pathname
    || routerLike?.location?.pathname
    || '/'
  );
}

function getInitialURLParams() {
  const urlParams = {};

  try {
    if (ctx.urlSearchParams && Object.keys(ctx.urlSearchParams).length > 0) {
      Object.assign(urlParams, ctx.urlSearchParams);
      return urlParams;
    }
  } catch (error) {}

  try {
    const location = ctx.app?.router?.location;
    if (location?.query && Object.keys(location.query).length > 0) {
      Object.assign(urlParams, location.query);
      return urlParams;
    }
    Object.assign(urlParams, parseSearch(location?.search || ''));
    if (Object.keys(urlParams).length > 0) return urlParams;
  } catch (error) {}

  try {
    const actualRouter = ctx.app?.router?.router;
    Object.assign(urlParams, parseSearch(getRouterSearch(actualRouter)));
  } catch (error) {}

  return urlParams;
}

function rememberStableParams(params) {
  const stableParams = {};
  Object.keys(params || {}).forEach((key) => {
    const value = params[key];
    if (!isShopKey(key) && value != null && value !== '') {
      stableParams[key] = value;
    }
  });

  if (Object.keys(stableParams).length > 0) {
    globalThis.__NOCOBASE_URL_PARAMS__ = stableParams;
  }

  if (params?.[SHOP_PARAM_KEY]) {
    globalThis.__NOCOBASE_SHOP_PARAM__ = params[SHOP_PARAM_KEY];
  }
}

function buildSearch(shopName) {
  const params = Object.assign({}, globalThis.__NOCOBASE_URL_PARAMS__ || {});
  if (shopName) params[SHOP_PARAM_KEY] = shopName;

  const query = Object.keys(params)
    .filter((key) => params[key] != null && params[key] !== '')
    .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  return query ? `?${query}` : '';
}

rememberStableParams(getInitialURLParams());

const bootstrap = async () => {
  let vueModule;
  try {
    vueModule = await ctx.importAsync('https://esm.sh/vue@3.4.27/dist/vue.runtime.esm-browser.js');
  } catch (error) {
    throw new Error('Vue 资源加载失败，请检查网络或 CDN');
  }

  const { createApp, ref, computed, h, onMounted, onUnmounted } = vueModule;

  const flowCtx = ctx.model.flowEngine._flowContext;
  const router = flowCtx._props.router.get(flowCtx);
  const actualRouter = ctx.app?.router?.router;

  const getModel = (uid) => {
    const instances = ctx.model.flowEngine._modelInstances;
    return typeof instances.get === 'function' ? instances.get(uid) : instances[uid];
  };

  const replaceShopFilter = (value, shopName) => {
    if (!value || typeof value !== 'object') return value;
    if (Array.isArray(value)) return value.map((item) => replaceShopFilter(item, shopName));
    if (value.shop && typeof value.shop === 'object' && '$eq' in value.shop) {
      return Object.assign({}, value, { shop: { $eq: shopName } });
    }

    const next = {};
    Object.keys(value).forEach((key) => {
      next[key] = replaceShopFilter(value[key], shopName);
    });
    return next;
  };

  const refreshTableBlock = (uid, shopName) => {
    const block = getModel(uid);
    const resource = block?.resource;
    if (!resource) {
      console.warn('[ShopSwitcher] table resource not found:', uid);
      return;
    }

    try {
      if (typeof resource.getFilter === 'function' && typeof resource.setFilter === 'function') {
        resource.setFilter(replaceShopFilter(resource.getFilter(), shopName));
      }
    } catch (error) {
      console.warn('[ShopSwitcher] setFilter failed:', uid, error?.message);
    }

    if (typeof resource.refresh === 'function') {
      resource.refresh();
    }
  };

  const refreshChartBlock = (uid) => {
    const block = getModel(uid);
    if (!block) {
      console.warn('[ShopSwitcher] chart model not found:', uid);
      return;
    }

    if (typeof block?.resource?.refresh === 'function') {
      block.resource.refresh();
      return;
    }

    const refreshMethodNames = ['refresh', 'reload', 'run', 'execute'];
    const methodName = refreshMethodNames.find((name) => typeof block[name] === 'function');
    if (methodName) {
      block[methodName]();
      return;
    }

    console.warn('[ShopSwitcher] chart refresh method not found:', uid);
  };

  const scheduleRefreshTables = (shopName) => {
    const keeper = globalThis.__NOCOBASE_URL_KEEPER__;
    if (keeper.refreshTimerId) clearTimeout(keeper.refreshTimerId);

    keeper.refreshTimerId = setTimeout(() => {
      keeper.refreshTimerId = null;
      TABLE_UIDS.forEach((uid) => refreshTableBlock(uid, shopName));
    }, 120);
  };

  const clearChartRefreshTimers = () => {
    const keeper = globalThis.__NOCOBASE_URL_KEEPER__;
    if (!Array.isArray(keeper.chartTimerIds)) keeper.chartTimerIds = [];
    keeper.chartTimerIds.forEach((timerId) => clearTimeout(timerId));
    keeper.chartTimerIds = [];
  };

  const scheduleRefreshCharts = () => {
    const keeper = globalThis.__NOCOBASE_URL_KEEPER__;
    clearChartRefreshTimers();

    const timerId = setTimeout(() => {
      keeper.chartTimerIds = keeper.chartTimerIds.filter((id) => id !== timerId);
      CHART_UIDS.forEach((uid) => refreshChartBlock(uid));
    }, 600);
    keeper.chartTimerIds = [timerId];
  };

  const navigateSearch = (shopName) => {
    const keeper = globalThis.__NOCOBASE_URL_KEEPER__;
    const nextSearch = buildSearch(shopName);
    const currentSearch = getRouterSearch(router);

    if (currentSearch === nextSearch && (!actualRouter || getRouterSearch(actualRouter) === nextSearch)) {
      return;
    }

    keeper.navigating = true;

    try {
      const pathname = getRouterPathname(router);
      if (currentSearch !== nextSearch) {
        router.navigate({ pathname, search: nextSearch, hash: '' }, { replace: true });
      }

      if (actualRouter) {
        const actualSearch = getRouterSearch(actualRouter);
        const actualPathname = getRouterPathname(actualRouter);
        if (actualSearch !== nextSearch) {
          actualRouter.navigate({ pathname: actualPathname, search: nextSearch, hash: '' }, { replace: true });
        }
      }
    } finally {
      Promise.resolve().then(() => {
        keeper.navigating = false;
      });
    }
  };

  const fetchShopRows = async (asin, country, todayStr) => {
    const cacheKey = `${asin}|${country}|${todayStr}`;
    const cache = globalThis.__NOCOBASE_SHOP_SWITCHER_CACHE__;
    const cached = cache[cacheKey];
    const now = Date.now();

    if (cached?.shops && now - cached.time < CACHE_TTL_MS) {
      return cached.shops;
    }

    if (cached?.promise) {
      return cached.promise;
    }

    const promise = ctx.api.request({
      url: 'inventory_base:list',
      method: 'get',
      params: {
        pageSize: 200,
        page: 1,
        filter: JSON.stringify({
          $and: [
            { asin: { $eq: asin } },
            { country: { $eq: country } },
            { date: { $eq: todayStr } },
          ],
        }),
        fields: 'shop',
      },
    }).then(({ data }) => {
      const rows = Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : []);
      const shops = Array.from(new Set(rows.map((row) => row?.shop).filter(Boolean)));
      cache[cacheKey] = { shops, time: Date.now() };
      return shops;
    }).catch((error) => {
      delete cache[cacheKey];
      throw error;
    });

    cache[cacheKey] = { promise, time: now };
    return promise;
  };

  const ShopSwitcher = {
    setup() {
      const allParams = ref({});
      const dbShops = ref([]);
      const dbLoading = ref(false);
      const dbError = ref('');
      const optimisticShop = ref(globalThis.__NOCOBASE_SHOP_PARAM__ || '');
      let unlistenRouter = null;
      let unlistenKeeper = null;
      let lastAsin = '';
      let lastCountry = '';
      let lastSearch = '';
      let lastChartShop = '';
      let requestSeq = 0;

      const todayString = () => {
        const today = new Date();
        return [
          today.getFullYear(),
          String(today.getMonth() + 1).padStart(2, '0'),
          String(today.getDate()).padStart(2, '0'),
        ].join('-');
      };

      const loadShops = async (asin, country) => {
        const seq = ++requestSeq;
        if (!asin || !country) {
          dbShops.value = [];
          dbError.value = 'URL 中未检测到 asin 或 country 参数';
          return;
        }

        dbLoading.value = true;
        dbError.value = '';

        try {
          const shops = await fetchShopRows(asin, country, todayString());
          if (seq !== requestSeq) return;
          dbShops.value = shops;
        } catch (error) {
          if (seq !== requestSeq) return;
          console.error('[ShopSwitcher] query failed:', error?.message || error);
          dbError.value = `查询失败: ${error?.message || String(error)}`;
          dbShops.value = [];
        } finally {
          if (seq === requestSeq) dbLoading.value = false;
        }
      };

      const updateFromRouter = () => {
        const search = getRouterSearch(router);
        if (search === lastSearch) return;
        lastSearch = search;

        const params = parseSearch(search);
        const stableParams = {};
        Object.keys(params).forEach((key) => {
          if (!isShopKey(key)) stableParams[key] = params[key];
        });

        if (Object.keys(stableParams).length > 0) {
          globalThis.__NOCOBASE_URL_PARAMS__ = stableParams;
        }

        allParams.value = params;

        const urlShop = params[SHOP_PARAM_KEY] || globalThis.__NOCOBASE_SHOP_PARAM__ || '';
        if (urlShop) {
          optimisticShop.value = urlShop;
          globalThis.__NOCOBASE_SHOP_PARAM__ = urlShop;
          if (urlShop !== lastChartShop) {
            lastChartShop = urlShop;
            scheduleRefreshCharts();
          }
        }

        const asin = params.asin || '';
        const country = params.country || '';
        if (asin !== lastAsin || country !== lastCountry) {
          lastAsin = asin;
          lastCountry = country;
          loadShops(asin, country);
        }
      };

      const restoreMissingParams = () => {
        const keeper = globalThis.__NOCOBASE_URL_KEEPER__;
        if (keeper.navigating) return;

        const savedParams = globalThis.__NOCOBASE_URL_PARAMS__ || {};
        if (Object.keys(savedParams).length === 0) return;

        const currentSearch = getRouterSearch(actualRouter || router);
        const currentParams = parseSearch(currentSearch);
        const hasMissingStableParam = Object.keys(savedParams).some((key) => currentParams[key] !== savedParams[key]);
        const savedShop = globalThis.__NOCOBASE_SHOP_PARAM__ || '';
        const hasMissingShop = savedShop && currentParams[SHOP_PARAM_KEY] !== savedShop;

        if (!hasMissingStableParam && !hasMissingShop) return;

        const nextSearch = buildSearch(savedShop || currentParams[SHOP_PARAM_KEY] || '');
        if (currentSearch === nextSearch) return;

        keeper.navigating = true;
        try {
          const targetRouter = actualRouter || router;
          targetRouter.navigate(
            { pathname: getRouterPathname(targetRouter), search: nextSearch, hash: '' },
            { replace: true },
          );
        } finally {
          Promise.resolve().then(() => {
            keeper.navigating = false;
          });
        }
      };

      onMounted(() => {
        updateFromRouter();

        if (typeof router.subscribe === 'function') {
          unlistenRouter = router.subscribe(updateFromRouter);
        }

        if (actualRouter && typeof actualRouter.subscribe === 'function') {
          unlistenKeeper = actualRouter.subscribe(restoreMissingParams);
        }

        globalThis.__NOCOBASE_URL_KEEPER__.unlisten = unlistenRouter;
        globalThis.__NOCOBASE_URL_KEEPER__.unlistenKeeper = unlistenKeeper;
      });

      onUnmounted(() => {
        requestSeq += 1;
        if (typeof unlistenRouter === 'function') unlistenRouter();
        if (typeof unlistenKeeper === 'function') unlistenKeeper();
        const keeper = globalThis.__NOCOBASE_URL_KEEPER__;
        if (keeper.refreshTimerId) clearTimeout(keeper.refreshTimerId);
        clearChartRefreshTimers();
      });

      const currentShop = computed(() => optimisticShop.value || allParams.value[SHOP_PARAM_KEY] || '');

      const handleSwitch = (shopName) => {
        if (shopName === currentShop.value) return;

        optimisticShop.value = shopName;
        globalThis.__NOCOBASE_SHOP_PARAM__ = shopName;
        clearChartRefreshTimers();
        navigateSearch(shopName);
        scheduleRefreshTables(shopName);
        scheduleRefreshCharts();
      };

      const styles = `
        .nb-shop-card {
          background: #fff;
          border-radius: 8px;
          border: 1px solid #f0f0f0;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.03);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        .nb-shop-header {
          padding: 12px 20px;
          background: #fff;
          border-bottom: 1px solid #f0f0f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .nb-header-title {
          font-weight: 600;
          color: #1f1f1f;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nb-shop-body {
          padding: 16px 20px;
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          background: #fafafa;
          min-height: 64px;
        }
        .nb-shop-btn {
          display: inline-flex;
          align-items: center;
          height: 34px;
          padding: 0 14px;
          border: 1px solid #d9d9d9;
          border-radius: 17px;
          cursor: pointer;
          font-size: 13px;
          transition: color 0.15s, border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
          user-select: none;
          background: #fff;
          color: #666;
        }
        .nb-shop-btn:hover {
          color: #1677ff;
          border-color: #1677ff;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(22,119,255,0.1);
        }
        .nb-shop-btn.active {
          background: #1677ff;
          border-color: #1677ff;
          color: #fff;
          font-weight: 500;
          cursor: default;
          box-shadow: 0 2px 8px rgba(22,119,255,0.35);
          transform: none;
        }
        .nb-shop-btn.is-total-btn:not(.active) {
          color: #fa8c16;
          border-color: #ffd591;
          background: #fff7e6;
        }
        .nb-shop-btn.is-total-btn.active {
          background: #fa8c16;
          border-color: #fa8c16;
          box-shadow: 0 2px 8px rgba(250,140,22,0.35);
        }
        .nb-empty-state,
        .nb-loading-state,
        .nb-error-state {
          padding: 16px 20px;
          text-align: center;
          font-size: 13px;
          width: 100%;
        }
        .nb-loading-state { color: #1677ff; }
        .nb-error-state { color: #ff4d4f; }
        .nb-empty-state { color: #999; }
        .nb-debug-panel {
          font-size: 12px;
          color: #999;
          margin-top: 6px;
          word-break: break-all;
          background: #f5f5f5;
          padding: 6px 8px;
          border-radius: 4px;
        }
      `;

      return () => {
        const badgeNode = dbLoading.value
          ? h('span', { style: 'font-size:12px;color:#1677ff;background:#e6f4ff;border:1px solid #91caff;padding:2px 8px;border-radius:10px;' }, '查询中...')
          : h('span', { style: 'font-size:12px;color:#52c41a;background:#f6ffed;border:1px solid #b7eb8f;padding:2px 8px;border-radius:10px;' }, '运行中');

        let bodyChildren;
        if (dbLoading.value) {
          bodyChildren = h('div', { class: 'nb-loading-state' }, '正在查询店铺列表...');
        } else if (dbError.value) {
          bodyChildren = h('div', { class: 'nb-error-state' }, [
            h('div', null, dbError.value),
            h('div', { class: 'nb-debug-panel' }, `asin: ${allParams.value.asin || '-'}  country: ${allParams.value.country || '-'}`),
          ]);
        } else if (dbShops.value.length === 0) {
          bodyChildren = h('div', { class: 'nb-empty-state' }, [
            h('div', null, '未查询到匹配的店铺'),
            h('div', { class: 'nb-debug-panel' }, `asin: ${allParams.value.asin || '-'}  country: ${allParams.value.country || '-'}`),
          ]);
        } else {
          const shopList = [TOTAL_SHOP_NAME, ...dbShops.value.filter((shop) => shop !== TOTAL_SHOP_NAME)];
          bodyChildren = shopList.map((shopName) => {
            const isActive = shopName === currentShop.value;
            const isTotal = shopName === TOTAL_SHOP_NAME;
            return h('button', {
              key: shopName,
              class: ['nb-shop-btn', isActive && 'active', isTotal && 'is-total-btn'].filter(Boolean).join(' '),
              onClick: () => handleSwitch(shopName),
              title: isActive ? '当前展示店铺' : '点击切换',
            }, shopName);
          });
        }

        return h('div', { class: 'nb-shop-wrapper' }, [
          h('style', null, styles),
          h('div', { class: 'nb-shop-card' }, [
            h('div', { class: 'nb-shop-header' }, [
              h('div', { class: 'nb-header-title' }, '店铺切换'),
              badgeNode,
            ]),
            h('div', { class: 'nb-shop-body' }, bodyChildren),
          ]),
        ]);
      };
    },
  };

  const app = createApp(ShopSwitcher);
  const appRoot = document.createElement('div');
  mountNode.replaceChildren(appRoot);
  app.mount(appRoot);
};

bootstrap().catch((error) => {
  console.error(error);
  mountNode.innerHTML = `<div style="color:red;padding:10px;">错误: ${error.message}</div>`;
});
