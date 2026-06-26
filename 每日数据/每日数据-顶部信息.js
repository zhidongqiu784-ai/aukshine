const { React } = ctx.libs;
const { useState, useEffect } = React;

// 分别缓存每个参数，互不干扰
const SK_MODEL      = '__up_model';
const SK_COUNTRY    = '__up_country';
const SK_ASIN       = '__up_asin';
const SK_SALE_OWNER = '__up_saleOwner';

function saveToEngine(key, val) {
  if (!val || val === '-') return;
  ctx.engine[key] = val;
}

function getFromEngine(key) {
  return ctx.engine[key] || null;
}

function saveAllParams(params) {
  saveToEngine(SK_MODEL,      params.model);
  saveToEngine(SK_COUNTRY,    params.country);
  saveToEngine(SK_ASIN,       params.asin);
  saveToEngine(SK_SALE_OWNER, params.saleOwner);
}

function loadCachedParams() {
  return {
    model:     getFromEngine(SK_MODEL),
    country:   getFromEngine(SK_COUNTRY),
    asin:      getFromEngine(SK_ASIN),
    saleOwner: getFromEngine(SK_SALE_OWNER),
  };
}

function parseSearch(search) {
  const result = {};
  if (!search || search.length < 2) return result;
  const qs = search.charAt(0) === '?' ? search.slice(1) : search;
  qs.split('&').forEach(part => {
    const eqIdx = part.indexOf('=');
    if (eqIdx === -1) return;
    const key = decodeURIComponent(part.slice(0, eqIdx).replace(/\+/g, ' '));
    const val = decodeURIComponent(part.slice(eqIdx + 1).replace(/\+/g, ' '));
    if (key) result[key] = val;
  });
  return result;
}

function buildSearch(params) {
  const parts = [];
  if (params.model)     parts.push('model='      + encodeURIComponent(params.model));
  if (params.country)   parts.push('country='    + encodeURIComponent(params.country));
  if (params.asin)      parts.push('asin='       + encodeURIComponent(params.asin));
  if (params.saleOwner) parts.push('sale_owner=' + encodeURIComponent(params.saleOwner));
  return parts.length ? '?' + parts.join('&') : '';
}

function getRouterSearch() {
  const loc = ctx.router.state && ctx.router.state.location;
  return (loc && loc.search) || '';
}

function getRouterPathname() {
  const loc = ctx.router.state && ctx.router.state.location;
  return (loc && loc.pathname) || '';
}

// 从 URL 提取参数，缺失的字段从缓存补全
function resolveParams(search) {
  const p = parseSearch(search);
  const cached = loadCachedParams();

  const model     = p['model']      || cached.model     || null;
  const country   = p['country']    || cached.country   || null;
  const asin      = p['asin']       || cached.asin      || null;
  const saleOwner = p['sale_owner'] || cached.saleOwner || null;

  return { model, country, asin, saleOwner };
}

function HeaderPanel() {
  const [params, setParams] = useState({
    model: '-', country: '-', asin: '-', saleOwner: '-'
  });

  useEffect(function() {

    // 延迟补写 URL，等 NocoBase 自己把参数写回 URL 后再执行
    function patchUrlIfNeeded(delayMs) {
      setTimeout(function() {
        const search  = getRouterSearch();
        const pathname = getRouterPathname();
        const p = parseSearch(search);
        const cached = loadCachedParams();

        // 用 URL 现有参数 + 缓存 合并出完整参数
        const merged = {
          model:     p['model']      || cached.model     || null,
          country:   p['country']    || cached.country   || null,
          asin:      p['asin']       || cached.asin      || null,
          saleOwner: p['sale_owner'] || cached.saleOwner || null,
        };

        const needPatch = (
          (!p['model']      && merged.model)     ||
          (!p['country']    && merged.country)   ||
          (!p['asin']       && merged.asin)      ||
          (!p['sale_owner'] && merged.saleOwner)
        );

        if (needPatch) {
          const newSearch = buildSearch(merged);
          console.log('[详情页] 延迟补写 URL ->', pathname + newSearch);
          ctx.router.navigate(pathname + newSearch, { replace: true });
          setParams(merged);
        }
      }, delayMs);
    }

    // 首次加载
    const initialSearch = getRouterSearch();
    const initialParams = resolveParams(initialSearch);
    setParams(initialParams);
    // 有值就缓存
    saveAllParams(initialParams);
    console.log('[详情页] 初始参数:', JSON.stringify(initialParams));

    // 首次如果 URL 不完整，延迟补写
    const ip = parseSearch(initialSearch);
    const initialNeedPatch = (
      (!ip['model']      && initialParams.model)     ||
      (!ip['country']    && initialParams.country)   ||
      (!ip['asin']       && initialParams.asin)      ||
      (!ip['sale_owner'] && initialParams.saleOwner)
    );
    if (initialNeedPatch) {
      patchUrlIfNeeded(300);
    }

    // 监听路由变化（Tab 切换）
    const unsubscribe = ctx.router.subscribe(function(state) {
      const search  = (state.location && state.location.search)  || '';
      const pathname = (state.location && state.location.pathname) || '';
      const p = parseSearch(search);

      console.log('[路由变化] pathname:', pathname, '| search:', search);

      // 有完整业务参数（至少有 model 或 asin），更新缓存
      if (p['model'] || p['asin']) {
        const fresh = {
          model:     p['model']      || null,
          country:   p['country']    || null,
          asin:      p['asin']       || null,
          saleOwner: p['sale_owner'] || null,
        };
        // 合并写入缓存（只增不减）
        saveAllParams({
          model:     fresh.model     || getFromEngine(SK_MODEL),
          country:   fresh.country   || getFromEngine(SK_COUNTRY),
          asin:      fresh.asin      || getFromEngine(SK_ASIN),
          saleOwner: fresh.saleOwner || getFromEngine(SK_SALE_OWNER),
        });
      }

      // 无论如何，延迟补写缺失参数
      // 延迟 400ms 等 NocoBase 把它自己的参数（model/country/asin）写回 URL
      setTimeout(function() {
        const latestSearch  = getRouterSearch();
        const latestPathname = getRouterPathname();
        const lp = parseSearch(latestSearch);
        const cached = loadCachedParams();

        const merged = {
          model:     lp['model']      || cached.model     || null,
          country:   lp['country']    || cached.country   || null,
          asin:      lp['asin']       || cached.asin      || null,
          saleOwner: lp['sale_owner'] || cached.saleOwner || null,
        };

        const needPatch = (
          (!lp['model']      && merged.model)     ||
          (!lp['country']    && merged.country)   ||
          (!lp['asin']       && merged.asin)      ||
          (!lp['sale_owner'] && merged.saleOwner)
        );

        if (needPatch) {
          const newSearch = buildSearch(merged);
          console.log('[详情页] Tab切换延迟补写 ->', latestPathname + newSearch);
          ctx.router.navigate(latestPathname + newSearch, { replace: true });
        }

        setParams(merged);
        console.log('[详情页] 最终展示参数:', JSON.stringify(merged));
      }, 400);
    });

    return function() {
      unsubscribe && unsubscribe();
    };
  }, []);

  const { model, country, asin, saleOwner } = params;

  return React.createElement('div', {
    style: {
      padding: '16px',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: '12px',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
    }
  },
    React.createElement('div', {
      style: { display: 'flex', gap: '24px', flexWrap: 'wrap' }
    },
      React.createElement('div', { style: { flex: 1, minWidth: '120px' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '4px' } }, '型号'),
        React.createElement('div', { style: { color: '#ffa940', fontSize: '18px', fontWeight: 600 } }, model || '-')
      ),
      React.createElement('div', { style: { flex: 1, minWidth: '120px' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '4px' } }, '国家'),
        React.createElement('div', { style: { color: '#ffd700', fontSize: '18px', fontWeight: 600, textTransform: 'uppercase' } }, country || '-')
      ),
      React.createElement('div', { style: { flex: 1, minWidth: '120px' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '4px' } }, 'ASIN'),
        React.createElement('div', { style: { color: '#fff', fontSize: '18px', fontWeight: 600, letterSpacing: '0.5px' } }, asin || '-')
      ),
      React.createElement('div', { style: { flex: 1, minWidth: '120px' } },
        React.createElement('div', { style: { color: 'rgba(255,255,255,0.8)', fontSize: '12px', marginBottom: '4px' } }, '销售'),
        React.createElement('div', { style: { color: '#ffb3c6', fontSize: '18px', fontWeight: 600 } }, saleOwner || '-')
      )
    )
  );
}

ctx.render(React.createElement(HeaderPanel));