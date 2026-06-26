async function run() {

  const React = ctx.libs.React;
  const { useState, useRef, useMemo, useCallback, useEffect } = React;
  const { Pagination, Input, InputNumber, Select, DatePicker, Drawer, Table, Button, Popconfirm, ConfigProvider, Tooltip, Modal, Form } = ctx.libs.antd;

  const currentUserId    = await ctx.getVar('ctx.user.id') || null;
  const currentUserName  = await ctx.getVar('ctx.user.username') || 'guest';
  const currentUserLevel = Number(await ctx.getVar('ctx.user.level')) || 0;
  const BLOCK_UID        = ctx.model?.uid || 'default_block';
  const DEFAULT_COLUMNS_KEY = `${BLOCK_UID}__default_columns`;
  const BLOCK_NAME       = '目标管理+广告';
  const BLOCK_NAME_SETTING_KEY = `${BLOCK_UID}__block_name`;
  const IS_ADMIN         = currentUserLevel >= 2;

  const FONT_SIZE    = 15;
  const FONT_SIZE_SM = FONT_SIZE - 1;
  const FONT_SIZE_XS = FONT_SIZE - 2;

  const DATE_PICKER_LOCALE = {
    lang: {
      locale: 'zh_CN',
      placeholder: '请选择日期',
      rangePlaceholder: ['开始日期', '结束日期'],
      today: '今天', now: '此刻', backToToday: '返回今天',
      ok: '确定', clear: '清除', month: '月', year: '年',
      yearFormat: 'YYYY年', monthFormat: 'M月',
      monthBeforeYear: false,
      previousMonth: '上个月', nextMonth: '下个月',
      previousYear: '上一年', nextYear: '下一年',
      shortWeekDays: ['日','一','二','三','四','五','六'],
      shortMonths: ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'],
    },
    timePickerLocale: { placeholder: '请选择时间' },
  };

  const GLOBAL_KEY     = '__urlParams_global';
  const SK_MODEL       = '__up_model';
  const SK_COUNTRY     = '__up_country';
  const SK_ASIN        = '__up_asin';
  const SK_SALE_OWNER  = '__up_saleOwner';
  const readGlobal     = ()     => ctx.engine[GLOBAL_KEY] || null;
  const writeGlobal    = (data) => {
    ctx.engine[GLOBAL_KEY] = data ? {
      model: data.model || null,
      country: data.country || null,
      asin: data.asin || null,
      sale_owner: data.saleOwner || data.sale_owner || null,
    } : null;
  };

  function saveToEngine(key, val) {
    if (!val || val === '-') return;
    ctx.engine[key] = val;
  }

  function getFromEngine(key) {
    return ctx.engine[key] || null;
  }

  function saveAllParams(params) {
    saveToEngine(SK_MODEL,      params?.model);
    saveToEngine(SK_COUNTRY,    params?.country);
    saveToEngine(SK_ASIN,       params?.asin);
    saveToEngine(SK_SALE_OWNER, params?.saleOwner || params?.sale_owner);
  }

  function loadCachedParams() {
    const globalParams = readGlobal() || {};
    return {
      model:     getFromEngine(SK_MODEL)      || globalParams.model      || null,
      country:   getFromEngine(SK_COUNTRY)    || globalParams.country    || null,
      asin:      getFromEngine(SK_ASIN)       || globalParams.asin       || null,
      saleOwner: getFromEngine(SK_SALE_OWNER) || globalParams.saleOwner  || globalParams.sale_owner || null,
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

  function resolveParams(search) {
    const p = parseSearch(search);
    const cached = loadCachedParams();

    const model     = p['model']      || cached.model     || null;
    const country   = p['country']    || cached.country   || null;
    const asin      = p['asin']       || cached.asin      || null;
    const saleOwner = p['sale_owner'] || cached.saleOwner || null;

    return { model, country, asin, saleOwner };
  }

  function hasUrlParams(params) {
    return !!(params?.model || params?.country || params?.asin || params?.saleOwner || params?.sale_owner);
  }

  function needPatchSearch(parsed, params) {
    return (
      (!parsed['model']      && params.model)     ||
      (!parsed['country']    && params.country)   ||
      (!parsed['asin']       && params.asin)      ||
      (!parsed['sale_owner'] && params.saleOwner)
    );
  }

  function loadUrlParams() {
    const params = resolveParams(getRouterSearch());
    if (hasUrlParams(params)) {
      saveAllParams(params);
      writeGlobal(params);
      return params;
    }
    return null;
  }

  const COUNTRY_COLORS = {
    US:'#b5796a', CA:'#a0776e', JP:'#c4956a', DE:'#b08a6e',
    FR:'#c4a882', ES:'#7a9e9f', UK:'#7d9b76', IT:'#7b9bb5',
    MX:'#6e8fa3', SE:'#9b8ab4',
  };

  const COLOR_GREEN  = '#8FA382';
  const COLOR_YELLOW = '#D4A76A';
  const COLOR_BLUE   = '#7FA1C3';
  const COLOR_PURPLE = '#A888B5';
  const COLOR_ORANGE = '#C68B5E';
  const COLOR_TEAL   = '#82A0A8';
  const COLOR_GRAY   = '#A0A8B0';
  const COLOR_ROSE   = '#C48B8B';

  const LEGACY_COLOR_MAP = {
    '#f2c150': COLOR_YELLOW,
    '#53c7ea': COLOR_BLUE,
    '#9b59b6': COLOR_PURPLE,
    '#e67e22': COLOR_ORANGE,
  };

  const PRESET_COLORS = [
    { label:'默认自动抓取，也可手动复核',      value:'#9DF29F' },
    { label:'必填',      value:'#EB6793' },
    { label:'选填',      value:'#F2BABA' },
    { label:'重要指标',  value:'#C5DFB4' },
    { label:'日公式1',   value:'#5DBEAC' },
    { label:'日公式2',   value:'#B0D4CC' },
    { label:'日公式3',   value:'#1C5C50' },
    { label:'周公式1',   value:'#00205C' },
    { label:'周公式2',   value:'#035E9B' },
    { label:'周公式3',   value:'#044D72' },
  ];

  const PRESET_COLOR_VALUES = new Set(
    PRESET_COLORS.map((pc) => String(pc.value).toLowerCase())
  );

  const ACTIVE_CROSS_HIGHLIGHT_COLORS = [
    { label:'暖黄', value:'#FFF1B8' },
    { label:'米橙', value:'#FFE7BA' },
    { label:'浅粉', value:'#FFD6E7' },
    { label:'浅蓝', value:'#D6E4FF' },
    { label:'薄荷', value:'#B5F5EC' },
    { label:'亮黄', value:'#FFE58F' },
    { label:'浅橙', value:'#FFD8BF' },
    { label:'玫粉', value:'#FFADD2' },
    { label:'天蓝', value:'#91CAFF' },
    { label:'青绿', value:'#87E8DE' },
  ];
  const DEFAULT_ACTIVE_CROSS_HIGHLIGHT_COLOR = '#D6E4FF';

  const SRC_DEFAULT_COLOR = {
    daily: COLOR_GREEN, weekly: COLOR_ORANGE, target: COLOR_PURPLE,
    orderLink: COLOR_TEAL, profit: COLOR_BLUE,
  };

  const getColHeaderColor = (col) => col.headerColor || SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;

  const PAGE_SIZE_OPTIONS = ['10','20','50','100'];
  const DEFAULT_PAGE_SIZE = 20;

  // 字段集合
  const MONEY_FIELDS = new Set([
    'daily_price','list_price','price_after_discount',
    'guanggaohuafei','ad_direct_sales_amount','ad_sales_amount',
    'ads_sp_cost','ads_sp_sales','ads_sd_cost','ads_sd_sales',
    'shared_ads_sb_cost','shared_ads_sb_sales','shared_ads_sbv_cost','shared_ads_sbv_sales',
    'ideal_cpu_by_margin','target_cpa','cpu','cpc','cpo','cpa',
  ]);
    const RATE_FIELDS  = new Set([
    'off',
    'zongcvr','guanggaocvr','volume_cvr','acos','tacos',
    'weekly_target_completion_rate','target_ad_cvr','target_profit_margin','target_ad_spend_rate',
    'natural_traffic_proportion','return_rate','return_goods_rate',
    'ctr','adv_rate','natural_single_ratio',
    'onsite_organic_orders_ratio',
  ]);
  const NUM_FIELDS   = new Set([
    'star_rating','number_of_comments','promotion_days','lp_duration_days','rsg_number','target_gap',
    'sales','zirandan','guanggaodan','order_items','ranking',
    'ad_direct_order_quantity','indirect_order_volume','impressions','page_views_total','organic_traffic',
    'return_count','return_goods_count',
    'target_subcategory_rank','target_order_qty','goal_subcategory_rank',
    'prev_rank','reviews_count','promotion_volume','b2b_volume',
    'sessions','sessions_mobile','zongliuliang','guanggaodianji','zirandianji',
  ]);
  const ZERO_AS_EMPTY_FIELDS = new Set([
    'target_cpa',
    'ideal_cpu_by_margin',
    'stage_target_cpu',
  ]);
  const isBlankLike = (v) => {
      return v === null || v === undefined || v === '';
  };

  const isZeroAsEmpty = (field, v) => {
    return ZERO_AS_EMPTY_FIELDS.has(field) && Number(v) === 0;
  };

  const isFormulaBlank = (field, v) => {
    return isBlankLike(v) || isZeroAsEmpty(field, v);
  };
  const toFormulaNumber = (v) => {
    if (isBlankLike(v)) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const toDateKey = (v) => v ? String(v).slice(0, 10) : '';
  const dateDiffDays = (endDate, startDate) => {
    const endKey = toDateKey(endDate);
    const startKey = toDateKey(startDate);
    if (!endKey || !startKey) return null;
    const end = new Date(`${endKey}T00:00:00Z`);
    const start = new Date(`${startKey}T00:00:00Z`);
    if (Number.isNaN(end.getTime()) || Number.isNaN(start.getTime())) return null;
    return Math.floor((end.getTime() - start.getTime()) / 86400000);
  };
  const buildDailyOffValue = (row) => {
    const listPrice = toFormulaNumber(row?.list_price);
    const dailyPrice = toFormulaNumber(row?.daily_price);
    if (listPrice == null || dailyPrice == null || listPrice === 0) return null;
    return (listPrice - dailyPrice) / listPrice;
  };
  const buildLpDurationMap = (dailyRecords) => {
    const groups = {};
    (Array.isArray(dailyRecords) ? dailyRecords : []).forEach((row) => {
      const asinCountry = row?.asin_country || (row?.asin && row?.country ? `${row.asin}_${row.country}` : '');
      const dateKey = toDateKey(row?.date);
      if (!asinCountry || !dateKey) return;
      if (!groups[asinCountry]) groups[asinCountry] = [];
      groups[asinCountry].push(row);
    });

    const result = {};
    Object.values(groups).forEach((rows) => {
      const sortedRows = [...rows].sort((a, b) => toDateKey(a.date).localeCompare(toDateKey(b.date)));
      const minDate = toDateKey(sortedRows[0]?.date);
      sortedRows.forEach((row, index) => {
        const key = row?.country_asin_date;
        const rowDate = toDateKey(row?.date);
        const rowListPrice = toFormulaNumber(row?.list_price);
        if (!key || !rowDate || rowListPrice == null) {
          if (key) result[key] = null;
          return;
        }

        let previousDifferentDate = '';
        for (let i = index - 1; i >= 0; i -= 1) {
          const prev = sortedRows[i];
          const prevDate = toDateKey(prev?.date);
          if (!prevDate || prevDate >= rowDate) continue;
          const prevListPrice = toFormulaNumber(prev?.list_price);
          if (prevListPrice == null || prevListPrice !== rowListPrice) {
            previousDifferentDate = prevDate;
            break;
          }
        }

        const durationDays = previousDifferentDate
          ? dateDiffDays(rowDate, previousDifferentDate)
          : dateDiffDays(rowDate, minDate);
        result[key] = durationDays == null ? null : durationDays + (previousDifferentDate ? 0 : 1);
      });
    });
    return result;
  };
  const recalcDailyPriceFormulas = async (context, countryAsinDate) => {
    if (!countryAsinDate) return null;
    const currentRes = await context.request({
      url: 'daily_asins:list',
      method: 'get',
      params: { filter: JSON.stringify({ country_asin_date: { $eq: countryAsinDate } }), pageSize: 1 },
    });
    const currentRow = currentRes?.data?.data?.[0];
    const asinCountry = currentRow?.asin_country || (currentRow?.asin && currentRow?.country ? `${currentRow.asin}_${currentRow.country}` : '');
    if (!asinCountry) return null;

    const allRes = await context.request({
      url: 'daily_asins:list',
      method: 'get',
      params: { filter: JSON.stringify({ asin_country: { $eq: asinCountry } }), pageSize: 1000 },
    });
    const rows = Array.isArray(allRes?.data?.data) ? allRes.data.data : [];
    const lpDurationMap = buildLpDurationMap(rows);
    const updates = {
      off: buildDailyOffValue(currentRow),
      lp_duration_days: lpDurationMap[countryAsinDate] ?? null,
    };

    if (
      String(currentRow.off ?? '') !== String(updates.off ?? '') ||
      String(currentRow.lp_duration_days ?? '') !== String(updates.lp_duration_days ?? '')
    ) {
      await context.request({
        url: 'daily_asins:update',
        method: 'post',
        params: { filterByTk: countryAsinDate },
        data: updates,
      });
    }

    return updates;
  };

  const DATE_FIELDS  = new Set(['date','updatedAt']);
  const ALL_NUMERIC  = new Set([...MONEY_FIELDS, ...RATE_FIELDS, ...NUM_FIELDS]);

  // 只读字段
  const READONLY_FIELDS = new Set([
    'country_asin_date','country_asin_week','id','country','asin','date','updatedAt',
    'goal_subcategory_rank','target_ad_cvr_formula','target_cpa_formula',
    'ideal_cpu_by_margin_formula','stage_target_cpu_formula',
    'target_profit_margin_formula','target_ad_spend_rate_formula',
  ]);

  const INITIAL_COLUMNS = [
    // —— daily ——
    { key:'daily_country',                      src:'daily',  field:'country',                      label:'国家',            hidden:false, pinned:true,  width:70,  editable:false },
    { key:'daily_asin',                         src:'daily',  field:'asin',                         label:'ASIN',            hidden:false, pinned:true,  width:110, editable:false },
    { key:'daily_date',                         src:'daily',  field:'date',                         label:'站点时间',        hidden:false, pinned:true,  width:100, editable:false },
    { key:'daily_sale_owner',                   src:'daily',  field:'sale_owner',                   label:'销售',            hidden:false, pinned:true,  width:80,  editable:false },
    { key:'daily_model',                        src:'daily',  field:'model',                        label:'型号',            hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_activity_annotation',          src:'daily',  field:'activity_annotation',          label:'活动标注',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_daily_price',                  src:'daily',  field:'daily_price',                  label:'购物车价格',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_list_price',                   src:'daily',  field:'list_price',                   label:'LP/WP/TP',         hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_price_after_discount',         src:'daily',  field:'price_after_discount',         label:'折后售价',          hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_off',                          src:'daily',  field:'off',                          label:'Off 力度',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_star_rating',                  src:'daily',  field:'star_rating',                  label:'星级',            hidden:false, pinned:false, width:70,  editable:false },
    { key:'daily_number_of_comments',           src:'daily',  field:'number_of_comments',           label:'评论数',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'daily_selling_accounts',             src:'daily',  field:'selling_accounts',             label:'售卖账号',        hidden:false, pinned:false, width:100, editable:false },
    { key:'daily_promotion_days',               src:'daily',  field:'promotion_days',               label:'推广天数',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_lp_duration_days',             src:'daily',  field:'lp_duration_days',             label:'LP 持续天数',     hidden:false, pinned:false, width:90,  editable:false },
    { key:'daily_rsg_number',                   src:'daily',  field:'rsg_number',                   label:'实际刷单总数',    hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_target_gap',                   src:'daily',  field:'target_gap',                   label:'目标差距',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'daily_today_operation',              src:'daily',  field:'today_operation',              label:'今日操作记录',    hidden:false, pinned:false, width:160, editable:false },
    { key:'daily_updatedAt',                    src:'daily',  field:'updatedAt',                    label:'更新时间',        hidden:false, pinned:false, width:100, editable:false },
    // —— weekly ——
    { key:'weekly_sales',                       src:'weekly', field:'sales',                        label:'销量',            hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_zirandan',                    src:'weekly', field:'zirandan',                     label:'实际自然单',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_guanggaodan',                 src:'weekly', field:'guanggaodan',                  label:'广告总单量',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_order_items',                 src:'weekly', field:'order_items',                  label:'实际总单量',      hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_cpu',                         src:'weekly', field:'cpu',                          label:'CPU',             hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_ranking',                     src:'weekly', field:'ranking',                      label:'小类排名',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_zongcvr',                     src:'weekly', field:'zongcvr',                      label:'总CVR',  hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_guanggaocvr',                 src:'weekly', field:'guanggaocvr',                  label:'CVR',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_volume_cvr',                  src:'weekly', field:'volume_cvr',                   label:'销量 CVR',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_guanggaohuafei',              src:'weekly', field:'guanggaohuafei',               label:'广告花费',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_acos',                        src:'weekly', field:'acos',                         label:'ACOS',            hidden:false, pinned:false, width:80,  editable:false },
    { key:'profit_tacos',                       src:'profit', field:'tacos',                        label:'TACOS',           hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_cpa',                         src:'weekly', field:'cpa',                          label:'CPA',             hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_cpc',                         src:'weekly', field:'cpc',                          label:'CPC',             hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_cpo',                         src:'weekly', field:'cpo',                          label:'CPO',             hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_ad_direct_order_quantity',    src:'weekly', field:'ad_direct_order_quantity',     label:'直接成交订单量',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_ad_direct_sales_amount',      src:'weekly', field:'ad_direct_sales_amount',       label:'直接成交额',      hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_ad_sales_amount',             src:'weekly', field:'ad_sales_amount',              label:'广告销售额',      hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_indirect_order_volume',       src:'weekly', field:'indirect_order_volume',        label:'间接跑单订单量',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_impressions',                 src:'weekly', field:'impressions',                  label:'曝光量',          hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_page_views_total',            src:'weekly', field:'page_views_total',             label:'PV-Total',        hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_organic_traffic',             src:'weekly', field:'organic_traffic',              label:'自然流量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_natural_traffic_proportion',  src:'weekly', field:'natural_traffic_proportion',   label:'自然流量占比',    hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_return_count',                src:'weekly', field:'return_count',                 label:'退款量',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_return_rate',                 src:'weekly', field:'return_rate',                  label:'退款率',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_return_goods_count',          src:'weekly', field:'return_goods_count',           label:'退货量',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_return_goods_rate',           src:'weekly', field:'return_goods_rate',            label:'退货率',          hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_category',                    src:'weekly', field:'category',                     label:'类别',            hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_date',                        src:'weekly', field:'date',                         label:'周日期',          hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_zongliuliang',                src:'weekly', field:'zongliuliang',                 label:'实际流量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_guanggaodianji',              src:'weekly', field:'guanggaodianji',               label:'广告点击',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_zirandianji',                 src:'weekly', field:'zirandianji',                  label:'自然点击',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_ctr',                         src:'weekly', field:'ctr',                          label:'CTR',             hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_adv_rate',                    src:'weekly', field:'adv_rate',                     label:'广告订单量占比',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_prev_rank',                   src:'weekly', field:'prev_rank',                    label:'上一次小类排名',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_prev_star',                   src:'weekly', field:'prev_star',                    label:'前一个评分',      hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_avg_star',                    src:'weekly', field:'avg_star',                     label:'评分',            hidden:false, pinned:false, width:70,  editable:false },
    { key:'weekly_reviews_count',               src:'weekly', field:'reviews_count',                label:'评论数量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_promotion_volume',            src:'weekly', field:'promotion_volume',             label:'促销销量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_b2b_volume',                  src:'weekly', field:'b2b_volume',                   label:'B2B 销量',        hidden:false, pinned:false, width:80,  editable:false },
    { key:'weekly_sessions',                    src:'weekly', field:'sessions',                     label:'Sessions-Browser',hidden:false, pinned:false, width:130, editable:false },
    { key:'weekly_sessions_mobile',             src:'weekly', field:'sessions_mobile',              label:'Sessions-Mobile', hidden:false, pinned:false, width:130, editable:false },
    { key:'weekly_page_views',                  src:'weekly', field:'page_views',                   label:'PV-Browser',      hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_page_views_mobile',           src:'weekly', field:'page_views_mobile',            label:'PV-Mobile',       hidden:false, pinned:false, width:100, editable:false },
    { key:'weekly_ads_sp_cost',                 src:'weekly', field:'ads_sp_cost',                  label:'SP 广告费',       hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_ads_sp_sales',                src:'weekly', field:'ads_sp_sales',                 label:'SP 广告销售额',   hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_ads_sd_cost',                 src:'weekly', field:'ads_sd_cost',                  label:'SD 广告费',       hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_ads_sd_sales',                src:'weekly', field:'ads_sd_sales',                 label:'SD 广告销售额',   hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_shared_ads_sb_cost',          src:'weekly', field:'shared_ads_sb_cost',           label:'SB 广告费',       hidden:false, pinned:false, width:90,  editable:false },
    { key:'weekly_shared_ads_sb_sales',         src:'weekly', field:'shared_ads_sb_sales',          label:'SB 广告销售额',   hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_shared_ads_sbv_cost',         src:'weekly', field:'shared_ads_sbv_cost',         label:'SBV 广告费',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_shared_ads_sbv_sales',         src:'weekly', field:'shared_ads_sbv_sales',         label:'SBV 广告销售额',  hidden:false, pinned:false, width:110, editable:false },
    { key:'weekly_natural_single_ratio',        src:'weekly', field:'natural_single_ratio',         label:'自然单占比',      hidden:false, pinned:false, width:110, editable:false },
    { key:'orderLink_onsite_organic_orders_ratio', src:'orderLink', field:'onsite_organic_orders_ratio', label:'④站内纯自然单占比', hidden:false, pinned:false, width:150, editable:false },
    // —— target ——
    { key:'target_target_subcategory_rank',       src:'target', field:'target_subcategory_rank',       label:'目标拆解 - 小类排名', hidden:false, pinned:false, width:130, editable:false },
    { key:'target_target_order_qty',              src:'target', field:'target_order_qty',              label:'目标拆解 - 单量',     hidden:false, pinned:false, width:110, editable:false },
    { key:'target_weekly_target_completion_rate', src:'target', field:'weekly_target_completion_rate', label:'本周目标完成率',      hidden:false, pinned:false, width:120, editable:false },
    { key:'target_goal_subcategory_rank',         src:'target', field:'goal_subcategory_rank',         label:'目标小类排名',        hidden:false, pinned:false, width:110, editable:false },
    { key:'target_sales_mom_rate',                src:'target', field:'sales_mom_rate',                label:'销量环比变化',        hidden:false, pinned:false, width:90,  editable:false },
    // 公式字段
    { key:'target_target_ad_cvr_formula',         src:'target', field:'target_ad_cvr_formula',         label:'目标广告 CVR', hidden:false, pinned:false, width:140, editable:false },
    { key:'target_target_cpa_formula',            src:'target', field:'target_cpa_formula',            label:'目标 CPA',     hidden:false, pinned:false, width:130, editable:false },
    { key:'target_ideal_cpu_by_margin_formula',   src:'target', field:'ideal_cpu_by_margin_formula',   label:'目标 CPU',     hidden:false, pinned:false, width:130, editable:false },
    { key:'target_target_profit_margin_formula',  src:'target', field:'target_profit_margin_formula',  label:'目标利润率',   hidden:false, pinned:false, width:130, editable:false },
    { key:'target_target_ad_spend_rate_formula',  src:'target', field:'target_ad_spend_rate_formula',  label:'目标广告费率', hidden:false, pinned:false, width:140, editable:false },
  ];

  const FORMULA_DESCRIPTIONS = {
    goal_subcategory_rank:
`【目标小类排名】对比 实际排名 vs 目标排名
对比 weekly_performance.ranking vs target_subcategory_rank
• 未填目标               → "写目标排名"
• 未填实际               → 空
• 实际 > 目标（更差）    → "未达标 - 拉下X名"
• 实际 ≤ 目标            → "√"`,
    target_ad_cvr_formula:
`【目标广告 CVR - 公式】
对比 weekly_performance.guanggaocvr vs target_default.target_ad_cvr
• 实际 ≥ 目标 → "√"
• 实际 < 目标 → "x -X%"（差额百分比）`,
    target_cpa_formula:
`【目标 CPA - 公式】
对比 weekly_performance.cpa vs target_default.target_cpa
• 实际 > 目标 → "CPA 超标X"
• 实际 ≤ 目标 → "√"`,
    ideal_cpu_by_margin_formula:
`【目标 CPU - 公式】
对比 weekly_performance.cpu vs target_default.ideal_cpu_by_margin
• 实际 > 目标 → "CPU 超标X"
• 实际 ≤ 目标 → "√"`,
    stage_target_cpu_formula:
`【阶段目标 CPU - 公式】
对比 weekly_performance.cpu vs stage_target_cpu
• 实际 > 目标 → "CPU 超标X"
• 实际 ≤ 目标 → "√"`,
    target_profit_margin_formula:
`【目标利润率 - 公式】
对比 daily_profit.profit_margin vs target_default.target_profit_margin
• 实际 < 目标 → "X -X%"（差额百分比）
• 实际 ≥ 目标 → "√"`,
    target_ad_spend_rate_formula:
`【目标广告费率 - 公式】
对比 daily_profit.ad_cost_ratio vs target_default.target_ad_spend_rate
• 实际 > 目标 → "X -X%"（超出百分比）
• 实际 ≤ 目标 → "√"`,
  };

  const FORMULA_TOOLTIPS = {
    off: {
      title: 'Off 力度',
      formula: '(LP/WP/TP − 购物车价格) ÷ LP/WP/TP',
      emptyRules: ['LP/WP/TP 为空或为 0', '购物车价格为空'],
      fields: [
        { label: 'LP/WP/TP', field: 'daily_asins.list_price' },
        { label: '购物车价格', field: 'daily_asins.daily_price' },
      ],
      writeBackField: 'daily_asins.off',
    },
    rsg_number: {
      title: '实际刷单总数',
      formula: '引用订单流量转化里的测评单',
      emptyRules: ['daily_asins.rsg_number 为空时按 0 计算'],
      fields: [
        { label: '实际刷单总数', field: 'daily_asins.rsg_number' },
      ],
      writeBackField: 'daily_keyword_tracking.actual_review_qty',
    },
    tacos: {
      title: 'TACOS',
      formula: '广告花费 ÷ 成交额-算费率，保留 4 位小数。',
      emptyRules: ['广告花费为空', '成交额-算费率为空或为 0'],
      fields: [
        { label: '广告花费', field: 'weekly_performance.guanggaohuafei' },
        { label: '成交额-算费率', field: 'daily_profit.gross_revenue_local' },
      ],
      writeBackField: 'daily_profit.tacos',
    },
    goal_subcategory_rank: {
      title: '目标小类排名',
      formula: '对比实际小类排名与目标小类排名，判断是否达标或落后多少名',
      emptyRules: ['目标小类排名未填写时提示写目标排名', '实际小类排名为空时结果为空'],
      fields: [
        { label: '实际小类排名', field: 'weekly_performance.ranking' },
        { label: '目标小类排名', field: 'target_management.target_subcategory_rank' },
      ],
      writeBackField: 'target_management.goal_subcategory_rank',
    },
    target_ad_cvr_formula: {
      title: '目标广告 CVR',
      formula: '对比广告 CVR 与目标广告 CVR，实际达到目标时显示达标，否则显示差额百分比',
      emptyRules: ['广告 CVR 为空', '目标广告 CVR 为空'],
      fields: [
        { label: '广告 CVR', field: 'weekly_performance.guanggaocvr' },
        { label: '目标广告 CVR', field: 'target_default.target_ad_cvr' },
      ],
      writeBackField: 'target_management.target_ad_cvr_formula',
    },
    target_cpa_formula: {
      title: '目标 CPA',
      formula: '对比实际 CPA 与目标 CPA，实际高于目标时显示超标金额，否则显示达标',
      emptyRules: ['实际 CPA 为空', '目标 CPA 为空'],
      fields: [
        { label: '实际 CPA', field: 'weekly_performance.cpa' },
        { label: '目标 CPA', field: 'target_default.target_cpa' },
      ],
      writeBackField: 'target_management.target_cpa_formula',
    },
    ideal_cpu_by_margin_formula: {
      title: '目标 CPU',
      formula: '对比实际 CPU 与按利润率推算的理想 CPU，实际高于目标时显示超标金额，否则显示达标',
      emptyRules: ['实际 CPU 为空', '目标 CPU 为空'],
      fields: [
        { label: '实际 CPU', field: 'weekly_performance.cpu' },
        { label: '目标 CPU', field: 'target_default.ideal_cpu_by_margin' },
      ],
      writeBackField: 'target_management.ideal_cpu_by_margin_formula',
    },
    stage_target_cpu_formula: {
      title: '阶段目标 CPU',
      formula: '对比实际 CPU 与阶段目标 CPU，实际高于目标时显示超标金额，否则显示达标',
      emptyRules: ['实际 CPU 为空', '阶段目标 CPU 为空'],
      fields: [
        { label: '实际 CPU', field: 'weekly_performance.cpu' },
        { label: '阶段目标 CPU', field: 'target_management.stage_target_cpu' },
      ],
      writeBackField: 'target_management.stage_target_cpu_formula',
    },
    target_profit_margin_formula: {
      title: '目标利润率',
      formula: '对比实际利润率与目标利润率，实际低于目标时显示差额百分比，否则显示达标',
      emptyRules: ['实际利润率为空', '目标利润率为空'],
      fields: [
        { label: '实际利润率', field: 'daily_profit.profit_margin' },
        { label: '目标利润率', field: 'target_default.target_profit_margin' },
      ],
      writeBackField: 'target_management.target_profit_margin_formula',
    },
    target_ad_spend_rate_formula: {
      title: '目标广告费率',
      formula: '对比实际广告费率与目标广告费率，实际高于目标时显示超出百分比，否则显示达标',
      emptyRules: ['实际广告费率为空', '目标广告费率为空'],
      fields: [
        { label: '实际广告费率', field: 'daily_profit.ad_cost_ratio' },
        { label: '目标广告费率', field: 'target_default.target_ad_spend_rate' },
      ],
      writeBackField: 'target_management.target_ad_spend_rate_formula',
    },
  };

  const SRC_COLLECTION_NAME = {
    daily: 'daily_asins',
    weekly: 'weekly_performance',
    target: 'target_management',
    orderLink: 'daily_order_link_tracking',
    profit: 'daily_profit',
  };

  const SQL_UPDATED_FIELD_TEXT = {
    'daily.country': '每天自动从 ASIN 表生成，只包含状态为「新品、重点、普通」的产品。',
    'daily.asin': '每天自动从 ASIN 表生成，只包含状态为「新品、重点、普通」的产品。',
    'daily.date': '每天自动生成从今天起未来 3 个月的日期。',
    'daily.model': '每天自动从 ASIN 表同步型号。',
    'daily.sale_owner': '每天自动从 ASIN 表同步销售负责人。',
    'daily.activity_annotation': '自动匹配 BD/LD 活动日期，活动当天显示活动类型。',
    'daily.daily_price': '每天自动同步昨日购物车价格：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.list_price': '每天自动同步昨日 LP/WP/TP：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.star_rating': '每天自动同步昨日星级：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.number_of_comments': '每天自动同步昨日 review 数量：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.selling_accounts': '每天自动同步昨日售卖账号：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.promotion_days': '按该 ASIN/国家的首单日期计算推广天数：非 US/CA 早上 8:30，US/CA 中午 1:00。',
    'daily.lp_duration_days': '按当前 LP/WP/TP 连续未变化的天数自动计算，当天算 1 天。',
    'target.sales_mom_rate': '每天早上 8:30 自动对比当天和前一天实际总单量，计算销量环比变化。',
  };

  const SQL_UPDATED_FIELD_SOURCE = {
    'daily.country': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    'daily.asin': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    'daily.date': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    'daily.model': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    'daily.sale_owner': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '每日asin主表-生成未来 3 个月的数据的asin数据' }],
    'daily.activity_annotation': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '3更新 活动标注' }],
    'daily.daily_price': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.list_price': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.star_rating': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.number_of_comments': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.selling_accounts': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.promotion_days': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '1更新 非US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '1更新 US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号' },
    ],
    'daily.lp_duration_days': [
      { workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', scope: '非 US/CA', node: '2更新 LP持续天数' },
      { workflow: '更新US、CA的推广天数、星级、评论、LP价、购物车价、售卖账号', schedule: '每天中午 1:00', scope: 'US/CA', node: '2更新 LP持续天数' },
    ],
    'target.sales_mom_rate': [{ workflow: '每日生成类型、asin数据', schedule: '每天早上 8:30', node: '更新 目标管理的销量环比' }],
  };

  const SRC_UPDATE_CONFIG = {
    daily:  { url: 'daily_asins:update',        pkField: 'country_asin_date' },
    weekly: { url: 'weekly_performance:update',  pkField: 'country_asin_week' },
    target: { url: 'target_management:update',   pkField: 'country_asin_date' },
  };

  const TARGET_TRIGGER_FIELDS = new Set([
    'target_subcategory_rank','stage_target_cpu',
    'ranking','guanggaocvr','cpa','cpu','ad_cost_ratio','profit_margin',
  ]);
  const DAILY_PRICE_TRIGGER_FIELDS = new Set(['list_price','daily_price']);

  const DYNAMIC_COLOR = { country: (row) => COUNTRY_COLORS[row.country] || null };

  const PUSH_PROP_OPTIONS = [
    { label:'显示/隐藏', value:'hidden'      }, { label:'固定列',    value:'pinned'      },
    { label:'列宽',      value:'width'       }, { label:'表头颜色',  value:'headerColor' },
    { label:'可编辑',    value:'editable'    },
  ];

  const SRC_GROUP_CONFIG = [
    { src:'profit',    label:'每日利润',                  color:COLOR_BLUE   },
    { src:'daily',     label:'📋 每日 ASIN',      color:COLOR_GREEN  },
    { src:'weekly',    label:'📈 周产品表现',       color:COLOR_ORANGE },
    { src:'target',    label:'🎯 目标管理',         color:COLOR_PURPLE },
    { src:'orderLink', label:'🔗 订单链接追踪',     color:COLOR_TEAL   },
  ];

  const buildColumnPayload = (cols) => cols.map((c) => ({
    key: c.key, hidden: c.hidden === true, pinned: c.pinned === true,
    width: Number(c.width) || 80, headerColor: c.headerColor || null,
    editable: c.editable === true,
  }));

  const mergeColumnsWithInitial = (saved) => {
    if (!saved || !Array.isArray(saved) || !saved.length) {
      return INITIAL_COLUMNS.map((c) => ({ ...c }));
    }
    const initMap  = Object.fromEntries(INITIAL_COLUMNS.map((c) => [c.key, c]));
    const savedMap = Object.fromEntries(saved.map((s) => [s.key, s]));
    const result   = [];
    saved.forEach((s) => {
      if (!s?.key || !initMap[s.key]) return;
      result.push({
        ...initMap[s.key],
        hidden: s.hidden === true,
        pinned: s.pinned === true,
        width: Number(s.width) || initMap[s.key].width,
        headerColor: migrateLegacyColor(s.headerColor),
        editable: s.editable === true,
      });
    });
    INITIAL_COLUMNS.forEach((c) => { if (!savedMap[c.key]) result.push({ ...c }); });
    return result;
  };

  const saveColsToUser = async (cols) => {
    if (!currentUserId) return false;
    try {
      const colPayload = buildColumnPayload(cols);
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const existingSetting = userRes?.data?.data?.setting || {};
      await ctx.request({
        url: 'users:update', method: 'post', params: { filterByTk: currentUserId },
        data: { setting: { ...existingSetting, [BLOCK_UID]: colPayload, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } },
      });
      return true;
    } catch { ctx.message.error('列设置保存失败'); return false; }
  };

  const loadColsFromUser = async () => {
    if (!currentUserId) return null;
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const saved = userRes?.data?.data?.setting?.[BLOCK_UID];
      if (!saved || !Array.isArray(saved) || !saved.length) return null;
      return saved;
    } catch { return null; }
  };

  const loadDefaultColsFromUser = async () => {
    if (!currentUserId) return null;
    try {
      const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
      const saved = userRes?.data?.data?.setting?.[DEFAULT_COLUMNS_KEY];
      if (!saved || !Array.isArray(saved) || !saved.length) return null;
      return saved;
    } catch { return null; }
  };

  const saveDefaultColsToAllUsers = async (cols) => {
    if (!IS_ADMIN) return { ok: false, total: 0, failCount: 0 };
    const payload = buildColumnPayload(cols);
    const res = await ctx.request({ url: 'users:list', method: 'get', params: { pageSize: 200 } });
    const userList = Array.isArray(res?.data?.data) ? res.data.data : [];
    const results = await Promise.allSettled(
      userList.map(async (user) => {
        const uid = user?.id;
        if (!uid) return;
        const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
        const existingSetting = userRes?.data?.data?.setting || {};
        await ctx.request({
          url: 'users:update',
          method: 'post',
          params: { filterByTk: uid },
          data: { setting: { ...existingSetting, [DEFAULT_COLUMNS_KEY]: payload, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } },
        });
      })
    );
    const failCount = results.filter((r) => r.status === 'rejected').length;
    return { ok: failCount === 0, total: userList.length, failCount };
  };

  const migrateLegacyColor = (color) => {
    if (!color) return null;
    const normalized = String(color).toLowerCase();
    if (PRESET_COLOR_VALUES.has(normalized)) {
      return color;
    }
    return LEGACY_COLOR_MAP[normalized] || color;
  };

  const buildColumns = async () => {
    const saved = await loadColsFromUser();
    if (saved) return mergeColumnsWithInitial(saved);
    const defaultSaved = await loadDefaultColsFromUser();
    if (defaultSaved) return mergeColumnsWithInitial(defaultSaved);
    return INITIAL_COLUMNS.map((c) => ({ ...c }));
  };

  const formatCell = (col, row) => {
    const v = row[col.field];

    // CPA / CPU 等字段为 0 时，按空值显示
    if (isZeroAsEmpty(col.field, v)) return '—';

    if (MONEY_FIELDS.has(col.field)) {
      return (v != null && v !== '')
        ? Number(v).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        : '—';
    }

    if (RATE_FIELDS.has(col.field)) {
      return (v != null && v !== '')
        ? `${(Number(v) * 100).toFixed(2)}%`
        : '—';
    }

    if (DATE_FIELDS.has(col.field)) {
      if (!v) return '—';
      const d = new Date(v);
      const dateStr = d.toLocaleDateString('zh-CN');
      if (col.field === 'date') {
        const weekDays = ['周日','周一','周二','周三','周四','周五','周六'];
        return `${dateStr} ${weekDays[d.getDay()]}`;
      }
      return dateStr;
    }

    if (v == null || v === '') return '—';
    return String(v);
  };


  const useFloatPos = (btnRef, open) => {
    const [pos, setPos] = useState({ top: 0, left: 0 });
    useEffect(() => {
      if (!open || !btnRef.current) return;
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }, [open]);
    return pos;
  };

  // ════════════════════════════════════════════════════════════
  // 推送配置面板
  // ════════════════════════════════════════════════════════════
  const PushPanel = ({ columns, onClose, anchorPos }) => {
    const [userList, setUserList]           = useState([]);
    const [loadingUsers, setLoadingUsers]   = useState(true);
    const [selectedProps, setSelectedProps] = useState(['hidden','pinned','width','headerColor','editable']);
    const [pushing, setPushing]             = useState(false);

    useEffect(() => {
      (async () => {
        setLoadingUsers(true);
        try {
          const res  = await ctx.request({ url: 'users:list', method: 'get', params: { pageSize: 200 } });
          const list = Array.isArray(res?.data?.data) ? res.data.data : [];
          setUserList(list.filter((u) => String(u.id) !== String(currentUserId)));
        } catch { ctx.message.error('加载用户列表失败'); }
        finally { setLoadingUsers(false); }
      })();
    }, []);

    const buildPayload = useCallback((cols) => cols.map((c) => {
      const item = { key: c.key };
      if (selectedProps.includes('hidden'))      item.hidden      = c.hidden === true;
      if (selectedProps.includes('pinned'))      item.pinned      = c.pinned === true;
      if (selectedProps.includes('width'))       item.width       = Number(c.width) || 80;
      if (selectedProps.includes('headerColor')) item.headerColor = c.headerColor || null;
      if (selectedProps.includes('editable'))    item.editable    = c.editable === true;
      return item;
    }), [selectedProps]);

    const handlePush = useCallback(async () => {
      const targetUserIds = userList.map((u) => u.id);
      if (!targetUserIds.length) { ctx.message.warning('没有可推送的其他用户'); return; }
      if (!selectedProps.length) { ctx.message.warning('请至少选择一个推送属性'); return; }
      setPushing(true);
      try {
        const payload = buildPayload(columns);
        const results = await Promise.allSettled(
          targetUserIds.map(async (uid) => {
            const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: uid } });
            const existingSetting = userRes?.data?.data?.setting || {};
            const existingCols    = existingSetting[BLOCK_UID];
            let mergedPayload = payload;
            if (Array.isArray(existingCols) && existingCols.length > 0) {
              const existingMap = Object.fromEntries(existingCols.map((c) => [c.key, c]));
              mergedPayload = payload.map((p) => {
                const merged = { ...(existingMap[p.key] || {}) };
                selectedProps.forEach((prop) => { if (p[prop] !== undefined) merged[prop] = p[prop]; });
                merged.key = p.key;
                return merged;
              });
            }
            await ctx.request({ url: 'users:update', method: 'post', params: { filterByTk: uid }, data: { setting: { ...existingSetting, [BLOCK_UID]: mergedPayload, [BLOCK_NAME_SETTING_KEY]: BLOCK_NAME } } });
          })
        );
        const failCount = results.filter((r) => r.status === 'rejected').length;
        if (failCount === 0) { ctx.message.success(`推送成功，已推送给 ${targetUserIds.length} 位用户`); onClose(); }
        else ctx.message.warning(`部分推送失败：${failCount}/${targetUserIds.length} 位用户失败`);
      } catch (err) { ctx.message.error(`推送失败：${err?.message || '未知错误'}`); }
      finally { setPushing(false); }
    }, [userList, selectedProps, columns, buildPayload]);

    return React.createElement('div', {
      style: { position: 'fixed', top: `${anchorPos.top}px`, left: `${anchorPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '16px', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', width: '380px', fontSize: `${FONT_SIZE}px` },
      onClick: (e) => e.stopPropagation(),
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '14px', paddingBottom: '10px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
        React.createElement('span', null, '📤 推送列配置给其他用户'),
        React.createElement('span', { onClick: onClose, style: { cursor: 'pointer', color: '#999', fontSize: '18px' } }, '✕'),
      ),
      React.createElement('div', { style: { marginBottom: '14px' } },
        React.createElement('div', { style: { marginBottom: '6px', fontWeight: 600 } }, '推送目标'),
        loadingUsers
          ? React.createElement('div', { style: { textAlign: 'center', padding: '8px', color: '#999' } }, '加载用户中...')
          : React.createElement('div', { style: { padding: '8px 10px', color: '#555', background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: '4px' } }, `将推送给其他全部用户（${userList.length} 位）`)
      ),
      React.createElement('div', { style: { marginBottom: '16px' } },
        React.createElement('div', { style: { marginBottom: '8px', fontWeight: 600 } }, '选择推送的属性'),
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '6px' } },
          PUSH_PROP_OPTIONS.map((opt) =>
            React.createElement('label', { key: opt.value, style: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', userSelect: 'none' } },
              React.createElement('input', { type: 'checkbox', checked: selectedProps.includes(opt.value), onChange: (e) => { if (e.target.checked) setSelectedProps((p) => [...p, opt.value]); else setSelectedProps((p) => p.filter((x) => x !== opt.value)); }, style: { cursor: 'pointer', width: '14px', height: '14px' } }),
              opt.label,
            )
          ),
        ),
      ),
      React.createElement('div', { style: { display: 'flex', gap: '8px', justifyContent: 'flex-end' } },
        React.createElement('button', { onClick: onClose, disabled: pushing, style: { padding: '6px 16px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: pushing ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px` } }, '取消'),
        React.createElement('button', { onClick: handlePush, disabled: pushing || loadingUsers || !userList.length || !selectedProps.length, style: { padding: '6px 16px', color: '#fff', border: 'none', borderRadius: '4px', fontSize: `${FONT_SIZE}px`, fontWeight: 600, background: (pushing || loadingUsers || !userList.length || !selectedProps.length) ? '#b5d8ff' : '#1890ff', cursor: (pushing || loadingUsers || !userList.length || !selectedProps.length) ? 'not-allowed' : 'pointer' } }, pushing ? '推送中...' : '📤 推送给全部用户'),
      ),
    );
  };

  // ════════════════════════════════════════════════════════════
  // TargetDefaultsModal - 目标值管理弹窗（基于 target_default 表）
  // ════════════════════════════════════════════════════════════
  const TargetDefaultsModal = ({ open, onClose, onSaved, initialCountryAsin, currentCountry, currentAsin, currentModel }) => {
      const [targetAdCvr, setTargetAdCvr]       = useState(null);
      const [targetCpa, setTargetCpa]           = useState(null);
      const [idealCpu, setIdealCpu]             = useState(null);
      const [targetProfitMargin, setTargetProfitMargin] = useState(null);
      const [targetAdSpendRate, setTargetAdSpendRate]   = useState(null);
      const [loading, setLoading]               = useState(false);
      const [saving, setSaving]                 = useState(false);
      const [foundRecord, setFoundRecord]       = useState(false);

      const resetForm = useCallback(() => {
        setTargetAdCvr(null);
        setTargetCpa(null);
        setIdealCpu(null);
        setTargetProfitMargin(null);
        setTargetAdSpendRate(null);
        setFoundRecord(false);
      }, []);

      useEffect(() => {
        if (open && initialCountryAsin) {
          setLoading(true);
          setFoundRecord(false);
          (async () => {
            try {
              const filterStr = JSON.stringify({ country_asin: { $eq: initialCountryAsin } });
              const res = await ctx.request({
                url: 'target_default:list', method: 'get',
                params: { filter: filterStr, pageSize: 1 },
              });
              const record = res?.data?.data?.[0];
              if (record) {
                setTargetAdCvr(record.target_ad_cvr != null ? Number(record.target_ad_cvr) * 100 : null);
                setTargetCpa(record.target_cpa ?? null);
                setIdealCpu(record.ideal_cpu_by_margin ?? null);
                setTargetProfitMargin(record.target_profit_margin != null ? Number(record.target_profit_margin) * 100 : null);
                setTargetAdSpendRate(record.target_ad_spend_rate != null ? Number(record.target_ad_spend_rate) * 100 : null);
                setFoundRecord(true);
              } else {
                setTargetAdCvr(null);
                setTargetCpa(null);
                setIdealCpu(null);
                setTargetProfitMargin(null);
                setTargetAdSpendRate(null);
              }
            } catch (err) {
              ctx.message.error(`加载失败：${err?.message || ''}`);
            } finally { setLoading(false); }
          })();
        } else if (!open) {
          resetForm();
        }
      }, [open, initialCountryAsin]);

      const handleSave = useCallback(async () => {
        if (!initialCountryAsin) { ctx.message.warning('缺少国家_ASIN信息'); return; }
        setSaving(true);
        try {
          const filterStr = JSON.stringify({ country_asin: { $eq: initialCountryAsin } });
          const res = await ctx.request({
            url: 'target_default:list', method: 'get',
            params: { filter: filterStr, pageSize: 1 },
          });
          const existing = res?.data?.data?.[0];
          const data = {
            target_ad_cvr: targetAdCvr != null && targetAdCvr !== '' ? Number(targetAdCvr) / 100 : null,
            target_cpa: targetCpa != null ? Number(targetCpa) : null,
            ideal_cpu_by_margin: idealCpu != null ? Number(idealCpu) : null,
            target_profit_margin: targetProfitMargin != null && targetProfitMargin !== '' ? Number(targetProfitMargin) / 100 : null,
            target_ad_spend_rate: targetAdSpendRate != null && targetAdSpendRate !== '' ? Number(targetAdSpendRate) / 100 : null,
          };

          if (existing) {
            await ctx.request({
              url: 'target_default:update', method: 'post',
              params: { filterByTk: existing.id },
              data,
            });
          } else {
            await ctx.request({
              url: 'target_default:create', method: 'post',
              data: { ...data, country_asin: initialCountryAsin },
            });
          }

          ctx.message.success('目标值已保存，正在后台重算公式...');
          onSaved?.();
          onClose();

          // 后台批量重算：先批量读取依赖数据，再分批更新，避免每条记录重复查询。
          setTimeout(async () => {
            try {
              const result = await recalcTargetFormulasForCountryAsin(ctx, initialCountryAsin, data);
              if (result.total > 0) {
                ctx.message.success(`已同步重算 ${result.success}/${result.total} 条目标管理公式`);
                onSaved?.();
              }
            } catch (e) {
              ctx.message.warning(`目标管理公式重算失败：${e?.message || ''}`);
            }
          }, 300);

        } catch (err) {
          ctx.message.error(`保存失败：${err?.message || ''}`);
        } finally { setSaving(false); }
      }, [initialCountryAsin, targetAdCvr, targetCpa, idealCpu, targetProfitMargin, targetAdSpendRate, onClose, onSaved]);

      const commonInputStyle = { width: '100%' };
      const percentInputStyle = { width: '100%' };

      return React.createElement(Modal, {
        title: '🎯 目标值管理',
        open,
        onCancel: onClose,
        width: 560,
        footer: React.createElement('div', { style: { display: 'flex', justifyContent: 'flex-end', gap: '8px' } },
          React.createElement('button', {
            onClick: onClose, disabled: saving,
            style: { padding: '6px 20px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: saving ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px` }
          }, '取消'),
          React.createElement('button', {
            onClick: handleSave, disabled: saving || !initialCountryAsin,
            style: { padding: '6px 20px', background: '#1890ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: (saving || !initialCountryAsin) ? 'not-allowed' : 'pointer', fontSize: `${FONT_SIZE}px`, fontWeight: 600 }
          }, saving ? '保存中...' : '💾 保存'),
        ),
        destroyOnClose: true,
      },
        React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: '16px', fontSize: `${FONT_SIZE}px` } },
          React.createElement('div', {
            style: {
              padding: '12px 14px',
              background: '#f6f8fa',
              borderRadius: '6px',
              border: '1px solid #e1e4e8',
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              fontSize: `${FONT_SIZE_SM}px`,
              flexWrap: 'wrap'
            }
          },
            currentModel && React.createElement('span', { style: { fontWeight: 700, color: '#52c41a', fontSize: `${FONT_SIZE}px` } }, currentModel),
            currentModel && currentCountry && React.createElement('span', { style: { color: '#ccc' } }, '|'),
            currentCountry && React.createElement('span', { style: { fontWeight: 700, color: COUNTRY_COLORS[currentCountry] || '#333', fontSize: `${FONT_SIZE}px` } }, currentCountry),
            (currentModel || currentCountry) && currentAsin && React.createElement('span', { style: { color: '#ccc' } }, '|'),
            currentAsin && React.createElement('span', { style: { fontWeight: 700, color: '#1890ff', fontSize: `${FONT_SIZE}px` } }, currentAsin),
          ),

          loading && React.createElement('div', { style: { textAlign: 'center', padding: '12px', color: '#999' } }, '⏳ 加载中...'),

          !loading && foundRecord && React.createElement('div', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#52c41a', padding: '2px 0' } }, '✅ 已加载现有目标值'),
          !loading && !foundRecord && React.createElement('div', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#fa8c16', padding: '2px 0' } }, '⚠️ 未找到记录，保存后将新建'),

          React.createElement('div', { style: { borderTop: '1px solid #f0f0f0' } }),

          // 第一行：目标广告 CVR | 目标 CPA
          React.createElement('div', { style: { display: 'flex', gap: '16px' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标广告 CVR'),
              React.createElement(InputNumber, {
                value: targetAdCvr, onChange: setTargetAdCvr,
                style: percentInputStyle, step: 0.1, precision: 2, min: 0, max: 100,
                placeholder: '输入百分比数值', size: 'small', addonAfter: '%', disabled: loading,
              }),
            ),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标 CPA'),
              React.createElement(InputNumber, {
                value: targetCpa, onChange: setTargetCpa,
                style: commonInputStyle, step: 0.01, precision: 2, min: 0,
                placeholder: '请输入目标 CPA', size: 'small', disabled: loading,
              }),
            ),
          ),

          // 第二行：目标 CPU | 目标利润率
          React.createElement('div', { style: { display: 'flex', gap: '16px' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标 CPU'),
              React.createElement(InputNumber, {
                value: idealCpu, onChange: setIdealCpu,
                style: commonInputStyle, step: 0.01, precision: 2, min: 0,
                placeholder: '请输入目标 CPU', size: 'small', disabled: loading,
              }),
            ),
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标利润率'),
              React.createElement(InputNumber, {
                value: targetProfitMargin, onChange: setTargetProfitMargin,
                style: percentInputStyle, step: 0.1, precision: 2, min: 0, max: 100,
                placeholder: '输入百分比数值', size: 'small', addonAfter: '%', disabled: loading,
              }),
            ),
          ),

          // 第三行：目标广告费率
          React.createElement('div', { style: { display: 'flex', gap: '16px' } },
            React.createElement('div', { style: { flex: 1 } },
              React.createElement('div', { style: { marginBottom: '4px', fontWeight: 500, fontSize: `${FONT_SIZE_SM}px` } }, '目标广告费率'),
              React.createElement(InputNumber, {
                value: targetAdSpendRate, onChange: setTargetAdSpendRate,
                style: percentInputStyle, step: 0.1, precision: 2, min: 0, max: 100,
                placeholder: '输入百分比数值', size: 'small', addonAfter: '%', disabled: loading,
              }),
            ),
            React.createElement('div', { style: { flex: 1 } }),
          ),
        ),
      );
    };

  // ════════════════════════════════════════════════════════════
  // 目标管理公式计算函数
  // ════════════════════════════════════════════════════════════
  const buildTargetFormulaUpdates = (target, defaults = {}, wp = null, profit = null) => {
      const updates = {};

      // 1. goal_subcategory_rank
      const targetRank = target.target_subcategory_rank;
      const actualRank = wp?.ranking;
      if (targetRank == null || isNaN(Number(targetRank))) {
        updates.goal_subcategory_rank = '写目标排名';
      } else if (actualRank == null || isNaN(Number(actualRank))) {
        updates.goal_subcategory_rank = '';
      } else if (Number(actualRank) > Number(targetRank)) {
        updates.goal_subcategory_rank = `未达标 - 拉下${Number(actualRank) - Number(targetRank)}名`;
      } else {
        updates.goal_subcategory_rank = '√';
      }

      // 2. target_ad_cvr_formula
      const gpCvr = wp?.guanggaocvr;
      const targetAdCvr = defaults.target_ad_cvr;
      if (gpCvr == null || gpCvr === '' || targetAdCvr == null || targetAdCvr === '') {
        updates.target_ad_cvr_formula = '';
      } else if (Number(gpCvr) >= Number(targetAdCvr)) {
        updates.target_ad_cvr_formula = '√';
      } else {
        const diff = ((Number(targetAdCvr) - Number(gpCvr)) * 100).toFixed(1);
        updates.target_ad_cvr_formula = `x -${diff}%`;
      }

      // 3. target_cpa_formula
      const wpCpa = wp?.cpa;
      const targetCpa = defaults.target_cpa;

      if (
        isFormulaBlank('cpa', wpCpa) ||
        isFormulaBlank('target_cpa', targetCpa)
      ) {
        updates.target_cpa_formula = '';
      } else if (Number(wpCpa) > Number(targetCpa)) {
        updates.target_cpa_formula = `CPA 超标${Math.round(Number(wpCpa) - Number(targetCpa))}`;
      } else {
        updates.target_cpa_formula = '√';
      }


      // 4. ideal_cpu_by_margin_formula
      const wpCpu = wp?.cpu;
      const idealCpu = defaults.ideal_cpu_by_margin;

      if (
        isFormulaBlank('cpu', wpCpu) ||
        isFormulaBlank('ideal_cpu_by_margin', idealCpu)
      ) {
        updates.ideal_cpu_by_margin_formula = '';
      } else if (Number(wpCpu) > Number(idealCpu)) {
        updates.ideal_cpu_by_margin_formula = `CPU 超标${Math.round(Number(wpCpu) - Number(idealCpu))}`;
      } else {
        updates.ideal_cpu_by_margin_formula = '√';
      }


      // 5. stage_target_cpu_formula
      const stageTargetCpu = target.stage_target_cpu;
      if (
        isFormulaBlank('cpu', wpCpu) ||
        isFormulaBlank('stage_target_cpu', stageTargetCpu)
      ) {
        updates.stage_target_cpu_formula = '';
      } else if (Number(wpCpu) > Number(stageTargetCpu)) {
        updates.stage_target_cpu_formula = `CPU 超标${Math.round(Number(wpCpu) - Number(stageTargetCpu))}`;
      } else {
        updates.stage_target_cpu_formula = '√';
      }


      // 6. target_ad_spend_rate_formula
      const adCostRatio = profit?.ad_cost_ratio;
      const targetAdSpendRate = defaults.target_ad_spend_rate;
      if (adCostRatio == null || targetAdSpendRate == null) {
        updates.target_ad_spend_rate_formula = '';
      } else if (Number(adCostRatio) > Number(targetAdSpendRate)) {
        const diff = ((Number(adCostRatio) - Number(targetAdSpendRate)) * 100).toFixed(2);
        updates.target_ad_spend_rate_formula = `X -${diff}%`;
      } else {
        updates.target_ad_spend_rate_formula = '√';
      }

      // 7. target_profit_margin_formula
      const profitMargin = profit?.profit_margin;
      const targetProfitMargin = defaults.target_profit_margin;
      if (profitMargin == null || targetProfitMargin == null) {
        updates.target_profit_margin_formula = '';
      } else if (Number(profitMargin) < Number(targetProfitMargin)) {
        const diff = ((Number(targetProfitMargin) - Number(profitMargin)) * 100).toFixed(2);
        updates.target_profit_margin_formula = `X -${diff}%`;
      } else {
        updates.target_profit_margin_formula = '√';
      }

      return updates;
  };

  const updateTargetFormulaRecord = async (context, countryAsinDate, updates) => {
    if (!countryAsinDate || !updates || Object.keys(updates).length === 0) return null;
    await context.request({
      url: 'target_management:update', method: 'post',
      params: { filterByTk: countryAsinDate },
      data: updates,
    });
    return updates;
  };

  const isTargetFormulaBlank = (value) => value === null || value === undefined || value === '';
  const toTargetFormulaNumber = (value) => {
    if (isTargetFormulaBlank(value)) return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  };
  const isSameTargetFormulaValue = (current, next) => {
    if (isTargetFormulaBlank(current) && isTargetFormulaBlank(next)) return true;
    const currentNumber = toTargetFormulaNumber(current);
    const nextNumber = toTargetFormulaNumber(next);
    if (currentNumber != null && nextNumber != null) {
      return Math.abs(currentNumber - nextNumber) < 0.000001;
    }
    return String(current ?? '').trim() === String(next ?? '').trim();
  };
  const pickChangedTargetFormulaFields = (current, updates) => {
    const changed = {};
    Object.entries(updates || {}).forEach(([field, value]) => {
      if (!isSameTargetFormulaValue(current?.[field], value)) changed[field] = value;
    });
    return changed;
  };

  const recalcTargetFormula = async (context, countryAsinDate) => {
    if (!countryAsinDate) return null;
    try {
      const tmFilterStr = JSON.stringify({ country_asin_date: { $eq: countryAsinDate } });
      const targetRes = await context.request({
        url: 'target_management:list', method: 'get',
        params: { filter: tmFilterStr, pageSize: 1 },
      });
      const target = targetRes?.data?.data?.[0];
      if (!target) return null;

      const countryAsin = countryAsinDate.replace(/_\d{4}-\d{2}-\d{2}$/, '');

      const tdFilterStr = JSON.stringify({ country_asin: { $eq: countryAsin } });
      const defRes = await context.request({
        url: 'target_default:list', method: 'get',
        params: { filter: tdFilterStr, pageSize: 1 },
      });
      const defaults = defRes?.data?.data?.[0] || {};

      const wpFilterStr = JSON.stringify({ country_asin_week: { $eq: countryAsinDate } });
      const wpRes = await context.request({
        url: 'weekly_performance:list', method: 'get',
        params: { filter: wpFilterStr, pageSize: 1 },
      });
      const wp = wpRes?.data?.data?.[0] || null;

      const dpFilterStr = JSON.stringify({ country_asin_date: { $eq: countryAsinDate } });
      const profitRes = await context.request({
        url: 'daily_profit:list', method: 'get',
        params: { filter: dpFilterStr, pageSize: 1 },
      });
      const profit = profitRes?.data?.data?.[0] || null;

      const updates = buildTargetFormulaUpdates(target, defaults, wp, profit);
      return await updateTargetFormulaRecord(context, countryAsinDate, updates);
    } catch (err) {
      console.error(`目标公式重算失败：${countryAsinDate}`, err);
      return null;
    }
  };

  const recalcTargetFormulasForCountryAsin = async (context, countryAsin, defaults) => {
    if (!countryAsin) return { total: 0, success: 0 };
    const fetchAll = async (url, params = {}) => {
      const pageSize = 200;
      const rows = [];
      for (let page = 1; page <= 10000; page += 1) {
        const res = await context.request({
          url,
          method: 'get',
          params: { ...params, page, pageSize },
        });
        const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
        rows.push(...batch);
        const totalPage = Number(res?.data?.meta?.totalPage);
        if (batch.length < pageSize || (Number.isFinite(totalPage) && page >= totalPage)) break;
      }
      return rows;
    };

    const tmFilterStr = JSON.stringify({ country_asin_date: { $includes: countryAsin } });
    const tmRecords = await fetchAll('target_management:list', { filter: tmFilterStr });
    const targetKeys = tmRecords.map((tm) => tm.country_asin_date).filter(Boolean);
    if (!targetKeys.length) return { total: 0, success: 0 };

    // ✅ 只用 targetKeys，不加"周"后缀
    const weeklyFilterStr = JSON.stringify({ country_asin_week: { $in: targetKeys } });
    const profitFilterStr = JSON.stringify({ country_asin_date: { $in: targetKeys } });

    const [weeklyRecords, profitRecords] = await Promise.all([
      fetchAll('weekly_performance:list', { filter: weeklyFilterStr }),
      fetchAll('daily_profit:list', { filter: profitFilterStr }),
    ]);
    const weeklyMap = {};
    weeklyRecords.forEach((wp) => {
      if (wp.country_asin_week) weeklyMap[wp.country_asin_week] = wp;  // ✅ 不 replace
    });
    const profitMap = {};
    profitRecords.forEach((profit) => {
      if (profit.country_asin_date) profitMap[profit.country_asin_date] = profit;
    });

    const updateJobs = tmRecords.map((target) => {
      const key = target.country_asin_date;
      const updates = buildTargetFormulaUpdates(target, defaults, weeklyMap[key] || null, profitMap[key] || null);
      return { key, updates: pickChangedTargetFormulaFields(target, updates) };
    }).filter((job) => job.key && job.updates && Object.keys(job.updates).length);

    const batchSize = 10;
    let success = 0;
    for (let i = 0; i < updateJobs.length; i += batchSize) {
      const batch = updateJobs.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map((job) => updateTargetFormulaRecord(context, job.key, job.updates))
      );
      success += results.filter((r) => r.status === 'fulfilled' && r.value).length;
    }

    return { total: updateJobs.length, success };
  };

  // ════════════════════════════════════════════════════════════
  // MergedTable 主组件
  // ════════════════════════════════════════════════════════════
  const MergedTable = () => {
    const [data, setData]                       = useState([]);
    const [loading, setLoading]                 = useState(true);
    const [calcLoading, setCalcLoading]         = useState(false);
    const [calcProgress, setCalcProgress]       = useState('');
    const [refreshingData, setRefreshingData]   = useState(false);
    const [refreshProgress, setRefreshProgress] = useState('');
    const [formulaProgress, setFormulaProgress] = useState({ active: false, label: '', percent: 0 });
    const [showPanel, setShowPanel]             = useState(false);
    const [showPush, setShowPush]               = useState(false);
    const [showTargetDefaults, setShowTargetDefaults] = useState(false);
    const [columns, setColumns]                 = useState(INITIAL_COLUMNS.map((c) => ({ ...c })));
    const [sortConfig, setSortConfig]           = useState({ key: 'daily_date', dir: 'asc' });
    const [curPage, setCurPage]                 = useState(1);
    const [pageSize, setPageSize]               = useState(DEFAULT_PAGE_SIZE);
    const [total, setTotal]                     = useState(0);
    const [collapsedGroups, setCollapsedGroups] = useState({});
    const [editingCell, setEditingCell]         = useState(null);
    const [editValue, setEditValue]             = useState(null);
    const [saving, setSaving]                   = useState(false);
    const [isResizing, setIsResizing]           = useState(false);
    const [dateFilterType, setDateFilterType]   = useState('recent_future');
    const [customDateRange, setCustomDateRange] = useState(null);
    const [selectedRange, setSelectedRange]     = useState(null);
    const [activeCell, setActiveCell]           = useState(null);
    const [crossHighlightEnabled, setCrossHighlightEnabled] = useState(false);
    const [crossHighlightColor, setCrossHighlightColor] = useState(DEFAULT_ACTIVE_CROSS_HIGHLIGHT_COLOR);
    const [showCrossHighlightPanel, setShowCrossHighlightPanel] = useState(false);
    const selectingRef = useRef(false);

    const resizeRef   = useRef(null);
    const dragColKey  = useRef(null);
    const inputRef    = useRef(null);
    const rootRef     = useRef(null);
    const tableWrapRef = useRef(null);
    const clipboardRef = useRef(null);
    const autoRefreshRef = useRef({ lastAt: 0, wasVisible: null });
    const recalcAllTargetFormulasRef = useRef(null);
    const panelBtnRef = useRef(null);
    const pushBtnRef  = useRef(null);
    const crossHighlightBtnRef = useRef(null);
    const panelPos    = useFloatPos(panelBtnRef, showPanel);
    const pushPos     = useFloatPos(pushBtnRef, showPush);
    const crossHighlightPos = useFloatPos(crossHighlightBtnRef, showCrossHighlightPanel);

    const [urlParams, setUrlParams] = useState(() => loadUrlParams());
    const filterAsin         = urlParams?.asin    || null;
    const filterCountry      = urlParams?.country || null;
    const filterModel        = urlParams?.model   || null;
    const filterSaleOwner    = urlParams?.saleOwner || urlParams?.sale_owner || null;

    useEffect(function() {
      function setResolvedParams(search) {
        const merged = resolveParams(search);
        if (hasUrlParams(merged)) {
          saveAllParams(merged);
          writeGlobal(merged);
        }
        setUrlParams(merged);
        return merged;
      }

      function patchUrlIfNeeded(delayMs) {
        setTimeout(function() {
          const search  = getRouterSearch();
          const pathname = getRouterPathname();
          const p = parseSearch(search);
          const merged = setResolvedParams(search);

          if (needPatchSearch(p, merged)) {
            const newSearch = buildSearch(merged);
            ctx.router.navigate(pathname + newSearch, { replace: true });
          }
        }, delayMs);
      }

      const initialSearch = getRouterSearch();
      const initialParams = setResolvedParams(initialSearch);
      const ip = parseSearch(initialSearch);
      if (needPatchSearch(ip, initialParams)) {
        patchUrlIfNeeded(300);
      }

      const unsubscribe = ctx.router.subscribe && ctx.router.subscribe(function(state) {
        const search = (state.location && state.location.search) || '';
        const p = parseSearch(search);

        if (p['model'] || p['asin']) {
          saveAllParams({
            model:     p['model']      || getFromEngine(SK_MODEL),
            country:   p['country']    || getFromEngine(SK_COUNTRY),
            asin:      p['asin']       || getFromEngine(SK_ASIN),
            saleOwner: p['sale_owner'] || getFromEngine(SK_SALE_OWNER),
          });
        }

        setTimeout(function() {
          const latestSearch  = getRouterSearch();
          const latestPathname = getRouterPathname();
          const lp = parseSearch(latestSearch);
          const merged = setResolvedParams(latestSearch);

          if (needPatchSearch(lp, merged)) {
            const newSearch = buildSearch(merged);
            ctx.router.navigate(latestPathname + newSearch, { replace: true });
          }
        }, 400);
      });

      return function() {
        unsubscribe && unsubscribe();
      };
    }, []);
    const computedCountryAsin = useMemo(() => {
      if (filterAsin && filterCountry) return `${filterCountry}_${filterAsin}`;
      return '';
    }, [filterAsin, filterCountry]);

    const showFormulaProgress = useCallback((progress) => {
      const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
      const percent = typeof progress === 'object' && progress !== null
        ? Math.max(0, Math.min(100, Number(progress.percent) || 0))
        : 0;
      setFormulaProgress({ active: true, label, percent });
    }, []);

    const finishFormulaProgress = useCallback((label = '公式同步完成') => {
      setFormulaProgress({ active: true, label, percent: 100 });
      window.setTimeout(() => {
        setFormulaProgress({ active: false, label: '', percent: 0 });
      }, 900);
    }, []);

    const resetFormulaProgress = useCallback(() => {
      setFormulaProgress({ active: false, label: '', percent: 0 });
    }, []);

    const recalcCurrentPageDailyFormulas = useCallback(async (rowsArg = [], options = {}) => {
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
      const sourceRows = Array.isArray(rowsArg) ? rowsArg : [];
      const keys = [...new Set(sourceRows.map((r) => r?.country_asin_date || r?.id).filter(Boolean))];

      if (!keys.length) return true;
      onProgress?.({ label: '正在同步每日公式...', percent: 18 });

      const lpDurationMap = buildLpDurationMap(sourceRows);
      const updateJobs = [];
      const patchMap = {};
      sourceRows.forEach((row) => {
        const key = row?.country_asin_date || row?.id;
        if (!key) return;
        const updates = {
          off: buildDailyOffValue(row),
          lp_duration_days: lpDurationMap[key] ?? null,
        };
        patchMap[key] = updates;
        if (
          String(row.off ?? '') !== String(updates.off ?? '') ||
          String(row.lp_duration_days ?? '') !== String(updates.lp_duration_days ?? '')
        ) {
          updateJobs.push({ key, updates });
        }
      });

      const batchSize = 8;
      let failCount = 0;
      for (let i = 0; i < updateJobs.length; i += batchSize) {
        const batch = updateJobs.slice(i, i + batchSize);
        onProgress?.({
          label: `正在写回每日公式 ${Math.min(i + batch.length, updateJobs.length)}/${updateJobs.length}...`,
          percent: Math.min(45, 18 + (updateJobs.length ? ((i + batch.length) / updateJobs.length) * 27 : 27)),
        });
        const results = await Promise.allSettled(batch.map((job) => ctx.request({
          url: 'daily_asins:update',
          method: 'post',
          params: { filterByTk: job.key },
          data: job.updates,
        })));
        failCount += results.filter((result) => result.status === 'rejected').length;
      }

      if (Object.keys(patchMap).length) {
        setData((prev) => prev.map((row) => {
          const key = row.country_asin_date || row.id;
          return patchMap[key] ? { ...row, ...patchMap[key] } : row;
        }));
      }

      if (failCount > 0) {
        ctx.message.warning(`每日公式同步失败 ${failCount} 条`);
      }
      return failCount === 0;
    }, []);

    const getTextColorForBg = (hexColor) => {
      if (!hexColor || hexColor.length < 7) return '#333';
      const r = parseInt(hexColor.slice(1, 3), 16);
      const g = parseInt(hexColor.slice(3, 5), 16);
      const b = parseInt(hexColor.slice(5, 7), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      return luminance > 0.6 ? '#222' : '#fff';
    };

    const DATE_FILTER_OPTIONS = [
    { label: '近7天及以后', value: 'recent_future' },
      { label: '全部日期',  value: 'all'        }, { label: '今天',      value: 'today'      },
      { label: '昨天',      value: 'yesterday'  }, { label: '近 7 天',   value: '7d'         },
      { label: '近 30 天',  value: '30d'        }, { label: '近 90 天',  value: '90d'        },
      { label: '本月',      value: 'this_month' }, { label: '上月',      value: 'last_month' },
      { label: '自定义',    value: 'custom'     },
    ];

    const getDateRange = useMemo(() => {
      if (dateFilterType === 'all')    return null;
      if (dateFilterType === 'custom') return customDateRange;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const todayStr = fmt(now);
      switch (dateFilterType) {
        case 'recent_future': { const d = new Date(now); d.setDate(d.getDate() - 6); return [fmt(d), null]; }
        case 'today':      return [todayStr, todayStr];
        case 'yesterday':  { const d = new Date(now); d.setDate(d.getDate() - 1); return [fmt(d), fmt(d)]; }
        case '7d':         { const d = new Date(now); d.setDate(d.getDate() - 6); return [fmt(d), todayStr]; }
        case '30d':        { const d = new Date(now); d.setDate(d.getDate() - 29); return [fmt(d), todayStr]; }
        case '90d':        { const d = new Date(now); d.setDate(d.getDate() - 89); return [fmt(d), todayStr]; }
        case 'this_month': { const d = new Date(now.getFullYear(), now.getMonth(), 1); return [fmt(d), todayStr]; }
        case 'last_month': { const s = new Date(now.getFullYear(), now.getMonth() - 1, 1); const e = new Date(now.getFullYear(), now.getMonth(), 0); return [fmt(s), fmt(e)]; }
        default: return null;
      }
    }, [dateFilterType, customDateRange]);

    const toggleGroup = useCallback((src) => { setCollapsedGroups((prev) => ({ ...prev, [src]: !prev[src] })); }, []);

    useEffect(() => { (async () => { const cols = await buildColumns(); setColumns(cols); })(); }, []);
    useEffect(() => { if (editingCell && inputRef.current) { inputRef.current.focus?.(); inputRef.current.select?.(); } }, [editingCell]);

    const updateAndSave = useCallback((updater) => {
      setColumns((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        saveColsToUser(next);
        return next;
      });
    }, []);

    const saveCurrentAsDefaultColumns = useCallback(async () => {
      if (!IS_ADMIN) return;
      try {
        const result = await saveDefaultColsToAllUsers(columns);
        if (result.ok) {
          ctx.message.success(`已设为默认列配置，并同步给 ${result.total} 位用户`);
        } else {
          ctx.message.warning(`默认列配置已部分保存，失败 ${result.failCount}/${result.total} 位用户`);
        }
      } catch (err) {
        ctx.message.error(`设为默认配置失败：${err?.message || '未知错误'}`);
      }
    }, [columns]);

    const restoreDefaultColumns = useCallback(async () => {
      if (!currentUserId) {
        setColumns(INITIAL_COLUMNS.map((c) => ({ ...c })));
        return;
      }
      try {
        const userRes = await ctx.request({ url: 'users:get', method: 'get', params: { filterByTk: currentUserId } });
        const existingSetting = userRes?.data?.data?.setting || {};
        const defaultPayload = existingSetting[DEFAULT_COLUMNS_KEY];
        const nextSetting = { ...existingSetting };
        delete nextSetting[BLOCK_UID];
        await ctx.request({
          url: 'users:update',
          method: 'post',
          params: { filterByTk: currentUserId },
          data: { setting: nextSetting },
        });

        const nextColumns = Array.isArray(defaultPayload) && defaultPayload.length
          ? mergeColumnsWithInitial(defaultPayload)
          : INITIAL_COLUMNS.map((c) => ({ ...c }));
        setColumns(nextColumns);
        ctx.message.success('已恢复默认列配置');
      } catch (err) {
        ctx.message.error(`恢复默认配置失败：${err?.message || '未知错误'}`);
      }
    }, []);

    const curPageRef  = useRef(curPage);
    const pageSizeRef = useRef(pageSize);
    useEffect(() => { curPageRef.current  = curPage;  }, [curPage]);
    useEffect(() => { pageSizeRef.current = pageSize; }, [pageSize]);

    const pickTotalFromResponse = (res) => {
      const count = res?.data?.meta?.count;
      return Number.isFinite(Number(count)) ? Number(count) : 0;
    };

    const loadFormulaRowsForCurrentCountryAsin = useCallback(async (silent = false) => {
      if (!filterCountry || !filterAsin) {
        if (!silent) ctx.message.warning('请先筛选到具体国家和 ASIN，再计算目标管理公式');
        return [];
      }

      const dailyFilterAnd = [
        { country: { $eq: filterCountry } },
        { asin: { $eq: filterAsin } },
      ];
      if (currentUserLevel === 1) dailyFilterAnd.push({ sale_owner: { $eq: currentUserName } });

      const pageSize = 500;
      const rows = [];
      let totalCount = null;
      for (let page = 1; page <= 10000; page += 1) {
        const res = await ctx.request({
          url: 'daily_asins:list',
          method: 'get',
          params: {
            sort: 'date',
            page,
            pageSize,
            filter: JSON.stringify({ $and: dailyFilterAnd }),
          },
        });
        const batch = Array.isArray(res?.data?.data) ? res.data.data : [];
        rows.push(...batch);
        const pickedTotal = pickTotalFromResponse(res);
        if (pickedTotal > 0) totalCount = pickedTotal;
        if (!batch.length || batch.length < pageSize || (totalCount != null && rows.length >= totalCount)) break;
      }
      return rows;
    }, [currentUserLevel, currentUserName, filterAsin, filterCountry]);

    const getDailySort = useCallback(() => {
      if (!sortConfig.key) return 'date';
      const col = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      if (!col || col.src !== 'daily') return 'date';
      return sortConfig.dir === 'desc' ? `-${col.field}` : col.field;
    }, [sortConfig]);

    const loadData = useCallback(async (options = {}) => {
      const page = options.page ?? curPageRef.current;
      const size = options.size ?? pageSizeRef.current;
      const skipFormula = options.skipFormula === true;
      try {
        setLoading(true);
        const dailyFilterAnd = [];
        if (currentUserLevel === 1) dailyFilterAnd.push({ sale_owner: { $eq: currentUserName } });
        if (filterAsin)    dailyFilterAnd.push({ asin:    { $eq: filterAsin    } });
        if (filterCountry) dailyFilterAnd.push({ country: { $eq: filterCountry } });
        const dateRange = getDateRange;
        if (dateRange) {
          if (dateRange[0]) dailyFilterAnd.push({ date: { $gte: dateRange[0] } });
          if (dateRange[1]) dailyFilterAnd.push({ date: { $lte: dateRange[1] } });
        }
        const dailyParams = {
          sort: getDailySort(),
          page,
          pageSize: size,
          ...(dailyFilterAnd.length > 0 ? { filter: JSON.stringify({ $and: dailyFilterAnd }) } : {}),
        };

        const rDaily = await ctx.request({ url: 'daily_asins:list', method: 'get', params: dailyParams });
        const dailyRecords = Array.isArray(rDaily?.data?.data) ? rDaily.data.data : [];
        const totalCount = pickTotalFromResponse(rDaily);
        const dailyKeys = [...new Set(dailyRecords.map(d => d.country_asin_date).filter(Boolean))];

        if (dailyKeys.length === 0) {
          setData([]);
          setTotal(totalCount);
          if (page > 1 && totalCount > 0) {
            const maxPage = Math.max(1, Math.ceil(totalCount / size));
            if (page > maxPage) {
              setCurPage(maxPage);
              return loadData({ page: maxPage, size, skipFormula });
            }
          }
          setLoading(false);
          return [];
        }

        const dailyKeyFilter = JSON.stringify({ country_asin_date: { $in: dailyKeys } });
        const weekKeyFilter = JSON.stringify({ country_asin_week: { $in: dailyKeys } });
        const relatedPageSize = Math.max(size, dailyKeys.length, 100);

        const [rWeekly, rTarget, rOrderLink, rProfit] = await Promise.all([
          ctx.request({ url: 'weekly_performance:list', method: 'get', params: { pageSize: relatedPageSize, filter: weekKeyFilter } }),
          ctx.request({ url: 'target_management:list',  method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
          ctx.request({ url: 'daily_order_link_tracking:list', method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
          ctx.request({ url: 'daily_profit:list', method: 'get', params: { pageSize: relatedPageSize, filter: dailyKeyFilter } }),
        ]);

        const weeklyRecords = Array.isArray(rWeekly?.data?.data) ? rWeekly.data.data : [];
        const targetRecords = Array.isArray(rTarget?.data?.data) ? rTarget.data.data : [];
        const orderLinkRecords = Array.isArray(rOrderLink?.data?.data) ? rOrderLink.data.data : [];
        const profitRecords = Array.isArray(rProfit?.data?.data) ? rProfit.data.data : [];


        const weeklyMap = {};
        weeklyRecords.forEach((w) => {
          if (w.country_asin_week) {
            weeklyMap[w.country_asin_week] = w;
          }
        });

        const targetMap = {};
        targetRecords.forEach((t) => {
          if (t.country_asin_date) {
            targetMap[t.country_asin_date] = t;
          }
        });

        const orderLinkMap = {};
        orderLinkRecords.forEach((o) => {
          if (o.country_asin_date) {
            orderLinkMap[o.country_asin_date] = o;
          }
        });

        const profitMap = {};
        profitRecords.forEach((p) => {
          if (p.country_asin_date) {
            profitMap[p.country_asin_date] = p;
          }
        });


        const mergedData = dailyRecords.map((d) => {
          const key = d.country_asin_date;
          const weeklyData = weeklyMap[key] || {};
          const targetData = targetMap[key] || {};
          const orderLinkData = orderLinkMap[key] || {};
          const profitData = profitMap[key] || {};
          return {
            ...weeklyData,
            ...profitData,
            ...targetData,
            ...orderLinkData,
            ...d,
          };
        });

        setData(mergedData);
        setTotal(totalCount);
        if (skipFormula) return mergedData;

        const formulaResults = await Promise.allSettled(
          dailyKeys.map(async (key) => {
            const [targetUpdates, dailyUpdates] = await Promise.all([
              recalcTargetFormula(ctx, key),
              recalcDailyPriceFormulas(ctx, key),
            ]);
            return {
              key,
              updates: {
                ...(targetUpdates || {}),
                ...(dailyUpdates || {}),
              },
            };
          })
        );
        const formulaPatchMap = {};
        formulaResults.forEach((result) => {
          if (result.status !== 'fulfilled') return;
          const { key, updates } = result.value || {};
          if (key && updates && Object.keys(updates).length) formulaPatchMap[key] = updates;
        });
        if (Object.keys(formulaPatchMap).length) {
          setData((prev) => prev.map((row) => {
            const key = row.country_asin_date || row.id;
            return formulaPatchMap[key] ? { ...row, ...formulaPatchMap[key] } : row;
          }));
        }
        return mergedData.map((row) => {
          const key = row.country_asin_date || row.id;
          return formulaPatchMap[key] ? { ...row, ...formulaPatchMap[key] } : row;
        });
      } catch (err) {
        ctx.message.error(`加载失败：${err?.message || ''}`);
        setData([]); setTotal(0);
        return [];
      } finally { setLoading(false); }
    }, [filterAsin, filterCountry, currentUserName, currentUserLevel, getDateRange, getDailySort]);

    useEffect(() => { setCurPage(1); loadData({ page: 1, skipFormula: true }); }, [loadData]);

    const autoRefreshCurrentPage = useCallback(async () => {
      if (loading || refreshingData || calcLoading || saving || editingCell) return;
      const now = Date.now();
      if (now - (autoRefreshRef.current.lastAt || 0) < 3000) return;
      autoRefreshRef.current.lastAt = now;
      try {
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '切回页面，正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        showFormulaProgress({ label: '正在读取当前 ASIN / 国家全部日期...', percent: 12 });
        const formulaRows = await loadFormulaRowsForCurrentCountryAsin(true);
        const recalc = recalcAllTargetFormulasRef.current;
        if (recalc && Array.isArray(formulaRows) && formulaRows.length) {
          let progressPercent = 15;
          await recalcCurrentPageDailyFormulas(formulaRows, {
            onProgress: (progress) => {
              const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步每日公式...');
              progressPercent = Math.min(45, progressPercent + 10);
              setRefreshProgress(label);
              showFormulaProgress(typeof progress === 'object' && progress !== null ? progress : { label, percent: progressPercent });
            },
          });
          await recalc(formulaRows, {
            allowNonAdmin: true,
            silentSuccess: true,
            onProgress: (progress) => {
              const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
              progressPercent = Math.min(95, progressPercent + 10);
              setRefreshProgress(label);
              showFormulaProgress(typeof progress === 'object' && progress !== null ? progress : { label, percent: progressPercent });
            },
          });
        }
        finishFormulaProgress('切回页面刷新完成');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.warning(`切回页面自动刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshProgress('');
      }
    }, [calcLoading, editingCell, finishFormulaProgress, loadData, loadFormulaRowsForCurrentCountryAsin, loading, recalcCurrentPageDailyFormulas, refreshingData, resetFormulaProgress, saving, showFormulaProgress]);

    const isRootVisible = useCallback(() => {
      const el = rootRef.current;
      if (!el) return true;
      const rect = el.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    }, []);

    useEffect(() => {
      autoRefreshRef.current.wasVisible = isRootVisible();
      const timer = window.setInterval(() => {
        const visible = isRootVisible();
        const wasVisible = autoRefreshRef.current.wasVisible;
        autoRefreshRef.current.wasVisible = visible;
        if (visible && wasVisible === false) autoRefreshCurrentPage();
      }, 1000);
      return () => window.clearInterval(timer);
    }, [autoRefreshCurrentPage, isRootVisible]);

    const onPageChange = useCallback((page, size) => {
      if (size !== pageSizeRef.current) {
        setCurPage(1);
        setPageSize(size);
        loadData({ page: 1, size, skipFormula: true });
      } else {
        setCurPage(page);
        loadData({ page, size, skipFormula: true });
      }
    }, [loadData]);

    const handleSort = useCallback((colKey) => {
      setSortConfig((prev) => {
        if (prev.key !== colKey) return { key: colKey, dir: 'asc' };
        if (prev.dir === 'asc') return { key: colKey, dir: 'desc' };
        return { key: null, dir: null };
      });
      setCurPage(1);
    }, []);

    const sortedData = useMemo(() => {
      if (!sortConfig.key || !data.length) return data;
      const col   = INITIAL_COLUMNS.find((c) => c.key === sortConfig.key);
      const field = col ? col.field : sortConfig.key;
      return [...data].sort((a, b) => {
        let va = a[field], vb = b[field];
        if (ALL_NUMERIC.has(field)) { va = Number(va) || 0; vb = Number(vb) || 0; return sortConfig.dir === 'asc' ? va - vb : vb - va; }
        if (DATE_FIELDS.has(field)) {
          const ta = va ? new Date(va).getTime() : 0;
          const tb = vb ? new Date(vb).getTime() : 0;
          return sortConfig.dir === 'asc' ? ta - tb : tb - ta;
        }
        const cmp = String(va || '').localeCompare(String(vb || '')); return sortConfig.dir === 'asc' ? cmp : -cmp;
      });
    }, [data, sortConfig]);

    const pagedData = sortedData;

    const toggleCol      = (key) => updateAndSave((p) => { const col = p.find((c) => c.key === key); if (!col) return p; if (!col.hidden) return p.map((c) => c.key === key ? { ...c, hidden: true } : c); return [...p.filter((c) => c.key !== key), { ...col, hidden: false }]; });
    const togglePin      = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, pinned: !c.pinned } : c));
    const setHColor      = (key, color) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: color } : c));
    const clearHColor    = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, headerColor: null } : c));
    const toggleEditable = (key) => updateAndSave((p) => p.map((c) => c.key === key ? { ...c, editable: !c.editable } : c));
    const selectAll      = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: false })));
    const deselectAll    = () => updateAndSave((p) => p.map((c) => ({ ...c, hidden: true  })));
    const selectGroup    = (src) => updateAndSave((p) => p.map((c) => c.src === src ? { ...c, hidden: false } : c));
    const deselectGroup  = (src) => updateAndSave((p) => p.map((c) => c.src === src ? { ...c, hidden: true  } : c));

    const visibleCols   = useMemo(() => { const vis = columns.filter((c) => !c.hidden); return [...vis.filter((c) => c.pinned), ...vis.filter((c) => !c.pinned)]; }, [columns]);
    const HEADER_MAIN_HEIGHT = 26;
    const TABLE_VISIBLE_ROWS = 10;
    const TABLE_BODY_ROW_HEIGHT = 66;
    const tableWrapHeight = HEADER_MAIN_HEIGHT + TABLE_BODY_ROW_HEIGHT * TABLE_VISIBLE_ROWS + 2;
    const pinnedLeftMap = useMemo(() => { const map = {}; let left = 0; visibleCols.forEach((col) => { if (col.pinned) { map[col.key] = left; left += col.width || 80; } }); return map; }, [visibleCols]);

    const onDragStart = (e, key) => { if (isResizing) { e.preventDefault(); return; } dragColKey.current = key; e.dataTransfer.effectAllowed = 'move'; };
    const onDragOver  = (e) => e.preventDefault();
    const onDrop      = (e, targetKey) => { e.preventDefault(); const fromKey = dragColKey.current; if (!fromKey || fromKey === targetKey) return; updateAndSave((prev) => { const next = [...prev]; const fi = next.findIndex((c) => c.key === fromKey); const ti = next.findIndex((c) => c.key === targetKey); const [moved] = next.splice(fi, 1); next.splice(ti, 0, moved); return next; }); dragColKey.current = null; };

    const onResizeStart = useCallback((e, colKey) => { e.preventDefault(); e.stopPropagation(); const col = columns.find((c) => c.key === colKey); resizeRef.current = { colKey, startX: e.clientX, startWidth: col?.width || 80 }; setIsResizing(true); }, [columns]);
    const onOverlayMove = useCallback((e) => { if (!resizeRef.current) return; const { colKey, startX, startWidth } = resizeRef.current; const nw = Math.max(40, startWidth + (e.clientX - startX)); updateAndSave((p) => p.map((c) => c.key === colKey ? { ...c, width: nw } : c)); }, []);
    const onOverlayUp   = useCallback(() => { resizeRef.current = null; setIsResizing(false); }, []);

    const isCellEditable = useCallback((col) => { if (READONLY_FIELDS.has(col.field)) return false; return col.editable === true; }, []);

    const normalizeSelection = useCallback((range) => {
      if (!range) return null;
      const r1 = Math.min(range.start.r, range.end.r);
      const r2 = Math.max(range.start.r, range.end.r);
      const c1 = Math.min(range.start.c, range.end.c);
      const c2 = Math.max(range.start.c, range.end.c);
      return { r1, r2, c1, c2 };
    }, []);

    const isCellSelected = useCallback((r, c) => {
      const rect = normalizeSelection(selectedRange);
      return !!rect && r >= rect.r1 && r <= rect.r2 && c >= rect.c1 && c <= rect.c2;
    }, [normalizeSelection, selectedRange]);

    const isActiveCrossCell = useCallback((r, c) => {
      if (!crossHighlightEnabled || !activeCell) return false;
      return r === activeCell.r || c === activeCell.c;
    }, [activeCell, crossHighlightEnabled]);

    const getBodyCellBackground = useCallback((r, c, selected) => {
      if (selected) return '#e6f4ff';
      if (isActiveCrossCell(r, c)) return crossHighlightColor;
      return r % 2 === 0 ? '#fff' : '#fafafa';
    }, [crossHighlightColor, isActiveCrossCell]);

    const getClipboardValue = useCallback((col, row) => {
      const value = row?.[col.field];

      if (value == null || value === '') return '';

      // 与页面展示逻辑一致：这些字段为 0 时复制为空
      if (isZeroAsEmpty(col.field, value)) return '';

      if (RATE_FIELDS.has(col.field)) return String(Number(value) * 100);

      if (DATE_FIELDS.has(col.field)) return String(value).slice(0, 10);

      return String(value);
    }, []);

    const parsePastedValue = useCallback((col, rawValue) => {
      const text = String(rawValue ?? '').trim();
      if (text === '') return null;
      if (RATE_FIELDS.has(col.field)) {
        const num = Number(text.replace('%', '').replace(/,/g, ''));
        return !isNaN(num) ? num / 100 : null;
      }
      if (MONEY_FIELDS.has(col.field) || NUM_FIELDS.has(col.field)) {
        const num = Number(text.replace(/,/g, ''));
        return !isNaN(num) ? num : null;
      }
      if (DATE_FIELDS.has(col.field)) return text || null;
      return text;
    }, []);



    const focusClipboardWithoutScroll = useCallback(() => {
      const el = clipboardRef.current;
      if (!el) return;

      const wrap = tableWrapRef.current;
      const scrollTop = wrap?.scrollTop ?? 0;
      const scrollLeft = wrap?.scrollLeft ?? 0;

      try {
        el.focus({ preventScroll: true });
      } catch {
        el.focus();
      }

      if (wrap) {
        wrap.scrollTop = scrollTop;
        wrap.scrollLeft = scrollLeft;
      }
    }, []);



    const handleCellMouseDown = useCallback((e, r, c) => {
      if (e.button !== 0 || isResizing || editingCell) return;

      const tag = String(e.target?.tagName || '').toLowerCase();
      const closestEl = e.target?.closest?.('.ant-picker, .ant-select, .ant-input-number');

      if (['input', 'textarea', 'select', 'button'].includes(tag) || closestEl) return;

      selectingRef.current = true;
      setActiveCell({ r, c });
      setSelectedRange({ start: { r, c }, end: { r, c } });

      focusClipboardWithoutScroll();  // 原版在 mousedown 时就聚焦

      e.preventDefault();             // 原版阻止默认行为
    }, [editingCell, isResizing, focusClipboardWithoutScroll]);


    const handleCellMouseEnter = useCallback((r, c) => {
      if (!selectingRef.current) return;
      setSelectedRange((prev) => prev ? { ...prev, end: { r, c } } : prev);
    }, []);


    const stopSelecting = useCallback(() => {
      selectingRef.current = false;
    }, []);

    const handleCopy = useCallback((e) => {
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;
      const lines = [];
      for (let r = rect.r1; r <= rect.r2; r++) {
        const row = pagedData[r];
        const cells = [];
        for (let c = rect.c1; c <= rect.c2; c++) {
          const col = visibleCols[c];
          cells.push(col && row ? getClipboardValue(col, row) : '');
        }
        lines.push(cells.join('\t'));
      }
      e.clipboardData.setData('text/plain', lines.join('\n'));
      e.preventDefault();
      ctx.message.success('已复制选区');
    }, [getClipboardValue, normalizeSelection, pagedData, selectedRange, visibleCols]);







    const runPostEditRecalcs = useCallback(async (dailyFormulaRows, recalcRows, options = {}) => {
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
      const dailyRows = [...(dailyFormulaRows || [])];
      const targetRows = [...(recalcRows || [])];
      const totalRows = dailyRows.length + targetRows.length;
      let doneRows = 0;
      const reportProgress = (label) => {
        if (!onProgress || !totalRows) return;
        doneRows += 1;
        onProgress({ label, percent: Math.min(95, 10 + (doneRows / totalRows) * 85) });
      };

      for (const rowId of dailyRows) {
        const dailyUpdates = await recalcDailyPriceFormulas(ctx, rowId);
        if (dailyUpdates) {
          setData((prev) => prev.map((row) => (row.country_asin_date || row.id) === rowId ? { ...row, ...dailyUpdates } : row));
        }
        reportProgress('正在同步每日公式...');
      }

      for (const rowId of targetRows) {
        const updates = await recalcTargetFormula(ctx, rowId);
        if (updates) {
          setData((prev) => prev.map((row) => (row.country_asin_date || row.id) === rowId ? { ...row, ...updates } : row));
        }
        reportProgress('正在同步目标公式...');
      }
    }, []);

    const handlePaste = useCallback(async (e) => {
      if (editingCell || saving) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;

      const text = e.clipboardData.getData('text/plain');
      if (!text) return;
      e.preventDefault();

      const matrix = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map((line) => line.split('\t'));
      while (matrix.length && matrix[matrix.length - 1].length === 1 && matrix[matrix.length - 1][0] === '') matrix.pop();
      if (!matrix.length) return;

      const ops = [];
      const localPatches = new Map();
      const recalcRows = new Set();
      const dailyFormulaRows = new Set();
      const isSingleValuePaste = matrix.length === 1 && matrix[0].length === 1;
      const targetRows = isSingleValuePaste
        ? Array.from({ length: rect.r2 - rect.r1 + 1 }, () => matrix[0])
        : matrix;

      targetRows.forEach((line, rr) => {
        const targetColCount = isSingleValuePaste ? (rect.c2 - rect.c1 + 1) : line.length;
        for (let cc = 0; cc < targetColCount; cc += 1) {
          const cellText = isSingleValuePaste ? matrix[0][0] : line[cc];
          const row = pagedData[rect.r1 + rr];
          const col = visibleCols[rect.c1 + cc];
          if (!row || !col || !isCellEditable(col)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) continue;
          const rowId = row.country_asin_date || row.id;
          const valueToSave = parsePastedValue(col, cellText);
          ops.push({ rowId, field: col.field, updateConfig, pkValue, valueToSave });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: valueToSave });
          if (TARGET_TRIGGER_FIELDS.has(col.field)) recalcRows.add(rowId);
          if (col.src === 'daily' && DAILY_PRICE_TRIGGER_FIELDS.has(col.field)) dailyFormulaRows.add(rowId);
        }
      });

      if (!ops.length) {
        ctx.message.warning('粘贴区域没有可编辑单元格');
        return;
      }

      try {
        setSaving(true);
        for (const op of ops) {
          await ctx.request({
            url: op.updateConfig.url,
            method: 'post',
            params: { filterByTk: op.pkValue },
            data: { [op.field]: op.valueToSave },
          });
        }

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          return patch ? { ...row, ...patch } : row;
        }));

        const formulaRows = new Set([...dailyFormulaRows, ...recalcRows]);
        if (formulaRows.size) {
          showFormulaProgress({ label: '粘贴已保存，正在同步公式...', percent: 8 });
          await runPostEditRecalcs(dailyFormulaRows, recalcRows, { onProgress: showFormulaProgress });
          finishFormulaProgress('粘贴公式同步完成');
        }

        ctx.message.success(`已粘贴 ${ops.length} 个单元格`);
      } catch (err) {
        ctx.message.error(`粘贴失败：${err?.message || '未知错误'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [editingCell, finishFormulaProgress, isCellEditable, normalizeSelection, pagedData, parsePastedValue, resetFormulaProgress, runPostEditRecalcs, saving, selectedRange, showFormulaProgress, visibleCols]);

    const clearSelectedCells = useCallback(async () => {
      if (editingCell || saving) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;

      const ops = [];
      const localPatches = new Map();
      const recalcRows = new Set();
      const dailyFormulaRows = new Set();

      for (let r = rect.r1; r <= rect.r2; r += 1) {
        const row = pagedData[r];
        if (!row) continue;
        for (let c = rect.c1; c <= rect.c2; c += 1) {
          const col = visibleCols[c];
          if (!col || !isCellEditable(col)) continue;
          const updateConfig = SRC_UPDATE_CONFIG[col.src];
          if (!updateConfig) continue;
          const pkValue = row[updateConfig.pkField];
          if (!pkValue) continue;
          const rowId = row.country_asin_date || row.id;
          ops.push({ rowId, field: col.field, updateConfig, pkValue, valueToSave: null });
          localPatches.set(rowId, { ...(localPatches.get(rowId) || {}), [col.field]: null });
          if (TARGET_TRIGGER_FIELDS.has(col.field)) recalcRows.add(rowId);
          if (col.src === 'daily' && DAILY_PRICE_TRIGGER_FIELDS.has(col.field)) dailyFormulaRows.add(rowId);
        }
      }

      if (!ops.length) {
        ctx.message.warning('\u9009\u533a\u6ca1\u6709\u53ef\u5220\u9664\u7684\u53ef\u7f16\u8f91\u5355\u5143\u683c');
        return;
      }

      try {
        setSaving(true);
        for (const op of ops) {
          await ctx.request({
            url: op.updateConfig.url,
            method: 'post',
            params: { filterByTk: op.pkValue },
            data: { [op.field]: op.valueToSave },
          });
        }

        setData((prev) => prev.map((row) => {
          const rowId = row.country_asin_date || row.id;
          const patch = localPatches.get(rowId);
          return patch ? { ...row, ...patch } : row;
        }));

        const formulaRows = new Set([...dailyFormulaRows, ...recalcRows]);
        if (formulaRows.size) {
          showFormulaProgress({ label: '选区已清空，正在同步公式...', percent: 8 });
          await runPostEditRecalcs(dailyFormulaRows, recalcRows, { onProgress: showFormulaProgress });
          finishFormulaProgress('清空后公式同步完成');
        }
        ctx.message.success(`\u5df2\u6e05\u7a7a ${ops.length} \u4e2a\u5355\u5143\u683c`);
      } catch (err) {
        ctx.message.error(`\u6e05\u7a7a\u5931\u8d25\uff1a${err?.message || '\u672a\u77e5\u9519\u8bef'}`);
        resetFormulaProgress();
      } finally {
        setSaving(false);
      }
    }, [editingCell, finishFormulaProgress, isCellEditable, normalizeSelection, pagedData, resetFormulaProgress, runPostEditRecalcs, saving, selectedRange, showFormulaProgress, visibleCols]);

    const handleKeyDown = useCallback((e) => {
      if (editingCell || saving) return;
      if (e.key !== 'Delete' && e.key !== 'Backspace') return;
      const target = e.target;
      const tag = String(target?.tagName || '').toLowerCase();
      const isClipboardTarget = target === clipboardRef.current;
      if (
        !isClipboardTarget &&
        (['input', 'textarea', 'select'].includes(tag) ||
          target?.isContentEditable ||
          target?.closest?.('[contenteditable="true"], .ant-input, .ant-input-number, .ant-select, .ant-picker'))
      ) return;
      const rect = normalizeSelection(selectedRange);
      if (!rect) return;
      e.preventDefault();
      clearSelectedCells();
    }, [clearSelectedCells, editingCell, normalizeSelection, saving, selectedRange]);

    const startEdit = useCallback((rowId, col, currentValue) => {
      if (saving) return;
      setSelectedRange(null);
      setEditingCell({ rowId, colKey: col.key, field: col.field, src: col.src });
      setEditValue(RATE_FIELDS.has(col.field) && currentValue != null && currentValue !== '' ? Number(currentValue) * 100 : (currentValue != null && currentValue !== '' ? currentValue : ''));
    }, [saving]);

    const cancelEdit = useCallback(() => { setEditingCell(null); setEditValue(null); }, []);

    const saveEdit = useCallback(async () => {
      if (!editingCell || saving) return;
      const { rowId, field, src } = editingCell;
      const updateConfig = SRC_UPDATE_CONFIG[src];
      if (!updateConfig) { ctx.message.error(`字段来源 "${src}" 暂不支持编辑`); return; }
      const row = data.find((r) => (r.country_asin_date || r.id) === rowId);
      if (!row) return;
      const pkValue = row[updateConfig.pkField];
      if (!pkValue) { ctx.message.error(`无法找到记录主键（${updateConfig.pkField}）`); cancelEdit(); return; }
      let valueToSave = editValue;
      if (RATE_FIELDS.has(field))                 valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) / 100 : null;
      else if (MONEY_FIELDS.has(field) || NUM_FIELDS.has(field)) valueToSave = (editValue !== '' && editValue !== null) ? Number(editValue) : null;
      else if (DATE_FIELDS.has(field))            valueToSave = editValue || null;
      try {
        setSaving(true);
        await ctx.request({ url: updateConfig.url, method: 'post', params: { filterByTk: pkValue }, data: { [field]: valueToSave } });
        setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, [field]: valueToSave } : r));
        ctx.message.success('保存成功');
        if (src === 'daily' && DAILY_PRICE_TRIGGER_FIELDS.has(field)) {
          try {
            const dailyUpdates = await recalcDailyPriceFormulas(ctx, rowId);
            if (dailyUpdates) {
              setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, ...dailyUpdates } : r));
            }
          } catch (e) {
            ctx.message.warning(`LP/WP/TP 公式重算失败：${e?.message || ''}`);
          }
        }
        if (TARGET_TRIGGER_FIELDS.has(field)) {
          try {
            const updates = await recalcTargetFormula(ctx, rowId);
            if (updates) {
              setData((prev) => prev.map((r) => (r.country_asin_date || r.id) === rowId ? { ...r, ...updates } : r));
            }
          } catch (e) { ctx.message.warning(`公式重算失败：${e?.message || ''}`); }
        }
        setEditingCell(null); setEditValue(null);
      } catch (err) { ctx.message.error(`保存失败：${err?.message || '未知错误'}`); }
      finally { setSaving(false); }
    }, [editingCell, editValue, data, saving]);

    const recalcAllTargetFormulas = useCallback(async (rowsArg = null, options = {}) => {
      const allowNonAdmin = options?.allowNonAdmin === true;
      const silentSuccess = options?.silentSuccess === true;
      const onProgress = typeof options?.onProgress === 'function' ? options.onProgress : null;
      if (!IS_ADMIN && !allowNonAdmin) {
        ctx.message.warning('只有管理员可以执行自动计算');
        return false;
      }
      const sourceRows = Array.isArray(rowsArg) ? rowsArg : data;

      const keys = [
        ...new Set(
          sourceRows
            .map((r) => r.country_asin_date || r.id)
            .filter(Boolean)
        )
      ];

      if (!keys.length) {
        ctx.message.warning('当前没有可计算的数据');
        return false;
      }

      const getCountryAsin = (countryAsinDate) => {
        return String(countryAsinDate || '').replace(/_\d{4}-\d{2}-\d{2}$/, '');
      };

      const parallelLimit = async (items, limit, worker, onProgress) => {
        let index = 0;
        let done = 0;
        const results = [];

        const runners = Array.from(
          { length: Math.min(limit, items.length) },
          async () => {
            while (index < items.length) {
              const currentIndex = index++;
              const item = items[currentIndex];

              try {
                results[currentIndex] = await worker(item, currentIndex);
              } catch (err) {
                results[currentIndex] = { error: err };
              } finally {
                done += 1;
                onProgress?.(done, items.length);
              }
            }
          }
        );

        await Promise.all(runners);
        return results;
      };

      setCalcLoading(true);
      setCalcProgress('准备计算...');
      onProgress?.('准备计算...');

      try {
        setCalcProgress('正在批量读取数据...');
        onProgress?.('正在批量读取数据...');

        const countryAsins = [
          ...new Set(keys.map(getCountryAsin).filter(Boolean))
        ];

        const targetFilterStr = JSON.stringify({
          country_asin_date: { $in: keys }
        });

        const weeklyFilterStr = JSON.stringify({
          country_asin_week: { $in: keys }
        });

        const profitFilterStr = JSON.stringify({
          country_asin_date: { $in: keys }
        });

        const defaultFilterStr = JSON.stringify({
          country_asin: { $in: countryAsins }
        });
        const calcRelatedPageSize = Math.max(keys.length, 100);
        const defaultPageSize = Math.max(countryAsins.length, 100);

        const [targetRes, weeklyRes, profitRes, defaultRes] = await Promise.all([
          ctx.request({
            url: 'target_management:list',
            method: 'get',
            params: {
              filter: targetFilterStr,
              pageSize: calcRelatedPageSize,
            },
          }),

          ctx.request({
            url: 'weekly_performance:list',
            method: 'get',
            params: {
              filter: weeklyFilterStr,
              pageSize: calcRelatedPageSize,
            },
          }),

          ctx.request({
            url: 'daily_profit:list',
            method: 'get',
            params: {
              filter: profitFilterStr,
              pageSize: calcRelatedPageSize,
            },
          }),

          ctx.request({
            url: 'target_default:list',
            method: 'get',
            params: {
              filter: defaultFilterStr,
              pageSize: defaultPageSize,
            },
          }),
        ]);

        const targetRecords = Array.isArray(targetRes?.data?.data)
          ? targetRes.data.data
          : [];

        const weeklyRecords = Array.isArray(weeklyRes?.data?.data)
          ? weeklyRes.data.data
          : [];

        const profitRecords = Array.isArray(profitRes?.data?.data)
          ? profitRes.data.data
          : [];

        const defaultRecords = Array.isArray(defaultRes?.data?.data)
          ? defaultRes.data.data
          : [];

        const targetMap = {};
        targetRecords.forEach((t) => {
          if (t.country_asin_date) {
            targetMap[t.country_asin_date] = t;
          }
        });

        const weeklyMap = {};
        weeklyRecords.forEach((w) => {
          if (w.country_asin_week) {
            weeklyMap[w.country_asin_week] = w;
          }
        });

        const profitMap = {};
        profitRecords.forEach((p) => {
          if (p.country_asin_date) {
            profitMap[p.country_asin_date] = p;
          }
        });

        const defaultMap = {};
        defaultRecords.forEach((d) => {
          if (d.country_asin) {
            defaultMap[d.country_asin] = d;
          }
        });

        setCalcProgress('正在本地计算公式...');
        onProgress?.('正在本地计算公式...');

        const updateJobs = [];
        const patchMap = {};
        let skipCount = 0;

        keys.forEach((key) => {
          const target = targetMap[key];

          if (!target) {
            skipCount += 1;
            return;
          }

          const countryAsin = getCountryAsin(key);
          const defaults = defaultMap[countryAsin] || {};
          const weekly = weeklyMap[key] || null;
          const profit = profitMap[key] || null;

          const updates = buildTargetFormulaUpdates(
            target,
            defaults,
            weekly,
            profit
          );
          const changedUpdates = pickChangedTargetFormulaFields(target, updates);

          if (!changedUpdates || Object.keys(changedUpdates).length === 0) {
            skipCount += 1;
            return;
          }

          patchMap[key] = changedUpdates;

          updateJobs.push({
            key,
            updates: changedUpdates,
          });
        });

        if (!updateJobs.length) {
          return true;
        }

        setCalcProgress(`准备写回 ${updateJobs.length} 条...`);
        onProgress?.(`准备写回 ${updateJobs.length} 条...`);

        let successCount = 0;
        let failCount = 0;

        const CONCURRENCY = 8;

        await parallelLimit(
          updateJobs,
          CONCURRENCY,
          async (job) => {
            try {
              await updateTargetFormulaRecord(ctx, job.key, job.updates);
              successCount += 1;
              return { ok: true };
            } catch (err) {
              console.error('目标公式写回失败:', job.key, err);
              failCount += 1;
              return { ok: false, err };
            }
          },
          (done, totalCount) => {
            setCalcProgress(`正在写回 ${done}/${totalCount}...`);
            onProgress?.(`正在写回 ${done}/${totalCount}...`);
          }
        );

        setData((prev) =>
          prev.map((r) => {
            const key = r.country_asin_date || r.id;
            return patchMap[key] ? { ...r, ...patchMap[key] } : r;
          })
        );

        if (failCount > 0) {
          ctx.message.warning(
            `公式计算完成：成功 ${successCount} 条，失败 ${failCount} 条，跳过 ${skipCount} 条`
          );
        } else if (!silentSuccess) {
          ctx.message.success(
            `公式计算完成：成功 ${successCount} 条，跳过 ${skipCount} 条`
          );
        }
        return failCount === 0;
      } catch (err) {
        console.error(err);
        ctx.message.error(`公式计算失败：${err?.message || '未知错误'}`);
        return false;
      } finally {
        setCalcLoading(false);
        setCalcProgress('');
      }
    }, [data]);

    useEffect(() => {
      recalcAllTargetFormulasRef.current = recalcAllTargetFormulas;
    }, [recalcAllTargetFormulas]);

    const refreshData = useCallback(async (silentArg = false) => {
      const silent = silentArg === true;
      if (refreshingData || calcLoading || loading) return;
      try {
        setRefreshingData(true);
        setRefreshProgress('正在刷新数据...');
        showFormulaProgress({ label: '正在刷新数据...', percent: 5 });
        await loadData({ page: curPageRef.current, size: pageSizeRef.current, skipFormula: true });
        setRefreshProgress('正在读取当前 ASIN / 国家全部日期...');
        showFormulaProgress({ label: '正在读取当前 ASIN / 国家全部日期...', percent: 12 });
        const formulaRows = await loadFormulaRowsForCurrentCountryAsin();
        if (!Array.isArray(formulaRows) || formulaRows.length === 0) {
          if (!silent) ctx.message.success('数据已刷新');
          finishFormulaProgress('数据已刷新');
          return;
        }
        let progressPercent = 15;
        const dailyOk = await recalcCurrentPageDailyFormulas(formulaRows, {
          onProgress: (progress) => {
            const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步每日公式...');
            progressPercent = Math.min(45, progressPercent + 10);
            setRefreshProgress(label);
            showFormulaProgress(typeof progress === 'object' && progress !== null ? progress : { label, percent: progressPercent });
          },
        });
        const ok = (await recalcAllTargetFormulas(formulaRows, {
          allowNonAdmin: true,
          silentSuccess: true,
          onProgress: (progress) => {
            const label = typeof progress === 'string' ? progress : (progress?.label || '正在同步公式...');
            progressPercent = Math.min(95, progressPercent + 10);
            setRefreshProgress(label);
            showFormulaProgress(typeof progress === 'object' && progress !== null ? progress : { label, percent: progressPercent });
          },
        })) && dailyOk;
        if (!silent) ctx.message[ok ? 'success' : 'warning'](ok ? '数据已刷新并重新计算公式' : '数据已刷新，公式计算失败');
        finishFormulaProgress(ok ? '刷新公式计算完成' : '刷新完成，公式失败');
      } catch (err) {
        resetFormulaProgress();
        ctx.message.error(`刷新失败：${err?.message || '未知错误'}`);
      } finally {
        setRefreshingData(false);
        setRefreshProgress('');
      }
    }, [calcLoading, finishFormulaProgress, loadData, loadFormulaRowsForCurrentCountryAsin, loading, recalcAllTargetFormulas, recalcCurrentPageDailyFormulas, refreshingData, resetFormulaProgress, showFormulaProgress]);
    const btnStyle = (bg, color, border) => ({ padding: '5px 12px', background: bg, color, border: `1px solid ${border}`, borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE}px`, whiteSpace: 'nowrap' });

    const renderEditInput = (col) => {
      const commonProps = { ref: inputRef, value: editValue, onBlur: () => saveEdit(), onKeyDown: (e) => { if (e.key === 'Escape') cancelEdit(); }, style: { width: '100%', textAlign: 'center' }, size: 'small' };
      if (RATE_FIELDS.has(col.field))  return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), min: 0, max: 100, step: 0.01, precision: 2, addonAfter: '%' });
      if (MONEY_FIELDS.has(col.field)) return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 0.01, precision: 2 });
      if (NUM_FIELDS.has(col.field))   return React.createElement(InputNumber, { ...commonProps, onChange: (v) => setEditValue(v), onPressEnter: () => saveEdit(), step: 1 });
      if (DATE_FIELDS.has(col.field))  return React.createElement(DatePicker,  { ...commonProps, locale: DATE_PICKER_LOCALE, value: editValue ? ctx.libs.dayjs(editValue) : null, onChange: (date) => setEditValue(date ? date.format('YYYY-MM-DD') : null) });
      return React.createElement(Input, { ...commonProps, onChange: (e) => setEditValue(e.target.value), onPressEnter: () => saveEdit() });
    };

    const renderColRow = (col) => {
      const currentColor = getColHeaderColor(col);
      const srcDefault   = SRC_DEFAULT_COLOR[col.src] || COLOR_GREEN;
      const isCustom     = !!col.headerColor;
      return React.createElement('div', { key: col.key, style: { display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 0 3px 12px', borderBottom: '1px solid #fafafa' } },
        React.createElement('div', { onClick: () => togglePin(col.key), style: { width: '22px', textAlign: 'center', flexShrink: 0, cursor: 'pointer', fontSize: `${FONT_SIZE_SM}px`, opacity: col.pinned ? 1 : 0.2, userSelect: 'none' } }, '📌'),
        React.createElement('input', { type: 'checkbox', checked: !col.hidden, onChange: () => toggleCol(col.key), style: { flexShrink: 0, cursor: 'pointer' } }),
        React.createElement('span', { style: { flex: 1, fontSize: `${FONT_SIZE_SM}px`, color: col.hidden ? '#ccc' : '#333', userSelect: 'none' } }, col.label),
        IS_ADMIN && !READONLY_FIELDS.has(col.field) && React.createElement('label', { title: '双击单元格可编辑', style: { display: 'flex', alignItems: 'center', gap: '3px', cursor: 'pointer', flexShrink: 0 } },
          React.createElement('input', { type: 'checkbox', checked: col.editable === true, onChange: () => toggleEditable(col.key), style: { cursor: 'pointer' } }),
          React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999' } }, '编辑'),
        ),
        IS_ADMIN && React.createElement('div', { style: { display: 'flex', gap: '3px', alignItems: 'center' } },
          PRESET_COLORS.map((pc) => React.createElement('div', { key: pc.value, title: pc.label, onClick: () => setHColor(col.key, pc.value), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: pc.value, border: currentColor === pc.value ? '2px solid #333' : '2px solid transparent', boxSizing: 'border-box' } })),
          isCustom && React.createElement('div', { title: '重置为默认色', onClick: () => clearHColor(col.key), style: { width: '14px', height: '14px', borderRadius: '2px', cursor: 'pointer', flexShrink: 0, background: srcDefault, border: '2px dashed #333', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#fff', fontWeight: 700, lineHeight: 1 } }, '↺'),
        ),
      );
    };

    const panelEl = showPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', { onClick: (e) => e.stopPropagation(), style: { position: 'fixed', top: `${panelPos.top}px`, left: `${panelPos.left}px`, zIndex: 2000, background: '#fff', border: '1px solid #e0e0e0', borderRadius: '8px', padding: '12px', boxShadow: '0 6px 20px rgba(0,0,0,0.15)', width: IS_ADMIN ? '600px' : '520px', maxHeight: '620px', overflowY: 'auto' } },
        React.createElement('div', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: '#555', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement('span', null, '列设置'),
          React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
            React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#aaa', fontWeight: 400 } }, IS_ADMIN ? '📌 固定 | ☑ 显示 | 🎨 颜色 | 编辑' : '📌 固定 | ☑ 显示'),
            IS_ADMIN && React.createElement(Popconfirm, {
              title: '确定把当前列配置设为默认配置吗？会同步给所有用户作为恢复默认的目标。',
              onConfirm: saveCurrentAsDefaultColumns,
              okText: '设为默认',
              cancelText: '取消',
            },
              React.createElement('button', { style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#1890ff', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '设为默认配置')
            ),
            React.createElement(Popconfirm, {
              title: '确定恢复默认列配置吗？当前个人列设置会被清除。',
              onConfirm: restoreDefaultColumns,
              okText: '恢复默认',
              cancelText: '取消',
            },
              React.createElement('button', { style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#fff7e6', color: '#d46b08', border: '1px solid #ffd591', borderRadius: '3px', cursor: 'pointer' } }, '恢复默认配置')
            ),
            React.createElement('button', { onClick: selectAll,   style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全选'),
            React.createElement('button', { onClick: deselectAll, style: { padding: '2px 8px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' } }, '全取消'),
          ),
        ),
        SRC_GROUP_CONFIG.map((group) => {
          const groupCols   = columns.filter((c) => c.src === group.src);
          if (!groupCols.length) return null;
          const isCollapsed = !!collapsedGroups[group.src];
          const visCount    = groupCols.filter((c) => !c.hidden).length;
          return React.createElement('div', { key: group.src, style: { marginBottom: '6px', border: `1px solid ${group.color}40`, borderRadius: '6px', overflow: 'hidden' } },
            React.createElement('div', { onClick: () => toggleGroup(group.src), style: { display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 10px', cursor: 'pointer', userSelect: 'none', background: `${group.color}18`, borderBottom: isCollapsed ? 'none' : `1px solid ${group.color}30` } },
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: group.color, display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' } }, '▼'),
              React.createElement('span', { style: { fontWeight: 700, fontSize: `${FONT_SIZE_SM}px`, color: group.color, flex: 1 } }, group.label),
              React.createElement('span', { style: { fontSize: `${FONT_SIZE_XS}px`, color: '#999', marginRight: '6px' } }, `${visCount}/${groupCols.length}`),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); selectGroup(group.src); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#52c41a', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全选'),
              React.createElement('button', {
                onClick: (e) => { e.stopPropagation(); deselectGroup(group.src); },
                style: { padding: '1px 6px', fontSize: `${FONT_SIZE_XS}px`, background: '#ff4d4f', color: '#fff', border: 'none', borderRadius: '3px', cursor: 'pointer' }
              }, '全取消'),
            ),
            !isCollapsed && React.createElement('div', null, groupCols.map((col) => renderColRow(col))),
          );
        }),
      ),
    );

    const pushPanelEl = showPush && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowPush(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement(PushPanel, { columns, onClose: () => setShowPush(false), anchorPos: pushPos }),
    );

    // 目标值管理 Modal
    const targetDefaultsModalEl = React.createElement(TargetDefaultsModal, {
      open: showTargetDefaults,
      onClose: () => setShowTargetDefaults(false),
      onSaved: () => { refreshData(true); },
      initialCountryAsin: computedCountryAsin,
      currentCountry: filterCountry,
      currentAsin: filterAsin,
      currentModel: filterModel,
    });


    const tableWidth = visibleCols.reduce((s, c) => s + (c.width || 80), 0);

    // 判断是否是公式字段（field 包含 _formula 后缀或等于 goal_subcategory_rank）
    const isFormulaField = (field) => {
      return field && (field.endsWith('_formula') || field === 'goal_subcategory_rank');
    };
    const getSourceFieldName = (col) => {
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      return sourceCollection ? `${sourceCollection}.${col.field}` : col.field;
    };
    const getHeaderTooltipData = (col) => {
      if (FORMULA_TOOLTIPS[col.field]) return { ...FORMULA_TOOLTIPS[col.field], hideEmptyRules: false };
      const sqlSourceKey = `${col.src}.${col.field}`;
      if (SQL_UPDATED_FIELD_TEXT[sqlSourceKey]) {
        return {
          title: col.label,
          formula: SQL_UPDATED_FIELD_TEXT[sqlSourceKey],
          hideEmptyRules: true,
          sourceInfos: SQL_UPDATED_FIELD_SOURCE[sqlSourceKey],
          hideFieldMapping: true,
          fields: [],
          writeBackField: '',
        };
      }
      const sourceCollection = SRC_COLLECTION_NAME[col.src];
      const sourceField = getSourceFieldName(col);
      return {
        title: col.label,
        formula: '直接展示来源字段的值',
        emptyRules: ['来源字段为空时显示为空'],
        hideEmptyRules: true,
        fields: sourceCollection ? [{ label: col.label, field: sourceField }] : [],
        writeBackField: sourceCollection ? sourceField : '无',
      };
    };
    const renderTooltip = ({ title, formula, emptyRules = [], fields = [], writeBackField, hideEmptyRules = false, hideFieldMapping = false, sourceInfos = [] }) => React.createElement('div', {
      style: {
        maxWidth: '360px',
        fontSize: '13px',
        lineHeight: 1.6,
        color: 'inherit',
      },
    },
      React.createElement('div', { style: { fontWeight: 700, marginBottom: '6px' } }, title),
      React.createElement('div', { style: { marginBottom: '6px' } }, formula || '直接展示该指标值'),
      !hideEmptyRules && React.createElement('div', { style: { marginBottom: '2px' } }, '为空条件：'),
      !hideEmptyRules && React.createElement('ul', { style: { margin: '0 0 10px 18px', padding: 0 } },
        (emptyRules.length ? emptyRules : ['无特殊为空条件']).map((rule, idx) =>
          React.createElement('li', { key: `empty_${idx}` }, rule)
        )
      ),
      React.createElement('hr', { style: { border: 0, borderTop: '1px solid rgba(255,255,255,0.22)', margin: '8px 0' } }),
      React.createElement('div', { style: { fontSize: '12px', opacity: 0.75, lineHeight: 1.55 } },
        React.createElement('div', { style: { fontWeight: 700, marginBottom: '4px' } }, '🔧 字段说明（开发用）'),
        Array.isArray(sourceInfos) && sourceInfos.map((source, idx) => React.createElement('div', {
          key: `source_${idx}`,
          style: {
            marginBottom: '6px',
            paddingBottom: '6px',
            borderBottom: idx === sourceInfos.length - 1 ? 'none' : '1px dashed rgba(255,255,255,0.18)',
          },
        },
          React.createElement('div', null,
            React.createElement('span', null, '来源工作流：'),
            React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, source.workflow)
          ),
          source.schedule && React.createElement('div', null, `执行时间：${source.schedule}`),
          source.scope && React.createElement('div', null, `适用站点：${source.scope}`),
          React.createElement('div', null,
            React.createElement('span', null, 'SQL 节点：'),
            React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, source.node)
          )
        )),
        !hideFieldMapping && (fields.length ? fields : [{ label: '字段', field: '无' }]).map((item, idx) => React.createElement('div', { key: `field_${idx}` },
          React.createElement('span', null, `${item.label}：`),
          React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, item.field)
        )),
        !hideFieldMapping && React.createElement('div', { style: { marginTop: '4px' } },
          React.createElement('span', null, '写回字段：'),
          React.createElement('code', { style: { fontFamily: 'monospace', whiteSpace: 'normal', wordBreak: 'break-all' } }, writeBackField || '无')
        )
      )
    );
    const renderHeaderLabel = (label, tooltipData, style = {}) => React.createElement(Tooltip, {
      title: tooltipData ? renderTooltip(tooltipData) : label,
      placement: 'top',
      overlayStyle: { maxWidth: '360px' },
      mouseEnterDelay: 0.15,
    }, React.createElement('span', {
      style: {
        overflow: 'hidden',
        whiteSpace: 'normal',
        lineHeight: '15px',
        maxHeight: '30px',
        wordBreak: 'break-all',
        display: 'block',
        width: '100%',
        textAlign: 'center',
        cursor: tooltipData ? 'help' : 'default',
        ...style,
      }
    }, label));

    const crossHighlightPanelEl = showCrossHighlightPanel && React.createElement(React.Fragment, null,
      React.createElement('div', { onClick: () => setShowCrossHighlightPanel(false), style: { position: 'fixed', inset: 0, zIndex: 1999, background: 'transparent' } }),
      React.createElement('div', {
        onClick: (e) => e.stopPropagation(),
        style: {
          position: 'fixed',
          top: `${crossHighlightPos.top}px`,
          left: `${crossHighlightPos.left}px`,
          zIndex: 2000,
          width: '220px',
          padding: '10px',
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: '8px',
          boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
          fontSize: `${FONT_SIZE_SM}px`,
        },
      },
        React.createElement('div', { style: { marginBottom: '8px', color: '#666', fontWeight: 600 } }, '高亮当前行列'),
        React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px', marginBottom: '10px' } },
          ...ACTIVE_CROSS_HIGHLIGHT_COLORS.map((item) => React.createElement('button', {
            key: item.value,
            title: item.label,
            onClick: () => { setCrossHighlightColor(item.value); setCrossHighlightEnabled(true); },
            style: {
              width: '32px',
              height: '24px',
              borderRadius: '3px',
              background: item.value,
              border: crossHighlightColor === item.value ? '2px solid #1677ff' : '1px solid #d9d9d9',
              cursor: 'pointer',
              boxSizing: 'border-box',
            },
          }))
        ),
        React.createElement('button', {
          onClick: () => { setCrossHighlightEnabled(false); setActiveCell(null); setShowCrossHighlightPanel(false); },
          style: { width: '100%', padding: '5px 8px', background: '#fff', color: '#666', border: '1px solid #d9d9d9', borderRadius: '4px', cursor: 'pointer', fontSize: `${FONT_SIZE_SM}px` },
        }, '取消高亮')
      )
    );

    const topInfoItems = [
      { label: '型号', value: filterModel || '-' },
      { label: '国家', value: filterCountry || '-' },
      { label: 'ASIN', value: filterAsin || '-' },
      { label: '销售', value: filterSaleOwner || '-' },
    ];
    const headerInfoEl = React.createElement('div', {
      style: {
        display: 'inline-flex',
        gap: '10px',
        flexWrap: 'wrap',
        marginBottom: '2px',
        padding: '3px 8px',
        background: '#fafafa',
        border: '1px solid #d9d9d9',
        borderRadius: '4px',
        boxShadow: 'none',
        maxWidth: '100%',
      },
    },
      ...topInfoItems.map((item, index) =>
        React.createElement('div', { key: item.label, style: { minWidth: 0, borderLeft: index === 0 ? 'none' : '1px solid #d9d9d9', paddingLeft: index === 0 ? 0 : '8px', color: '#333', fontSize: `${FONT_SIZE_SM}px`, fontWeight: 600, lineHeight: '17px', whiteSpace: 'nowrap' } },
          React.createElement('span', { style: { color: '#4d7f78', fontWeight: 600 } }, `${item.label}：`),
          React.createElement('span', null, item.value)
        )
      )
    );
    const actionBusy = loading || refreshingData || calcLoading;
    const formulaProgressEl = formulaProgress.active && React.createElement('div', {
      style: {
        width: '260px',
        minWidth: '220px',
        height: '24px',
        border: '1px solid #91caff',
        borderRadius: '4px',
        background: '#f0f7ff',
        overflow: 'hidden',
        position: 'relative',
        flexShrink: 0,
      },
    },
      React.createElement('div', {
        style: {
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: `${Math.max(2, Math.min(100, formulaProgress.percent || 0))}%`,
          background: 'linear-gradient(90deg, #69c0ff, #1677ff)',
          transition: 'width 0.25s ease',
        },
      }),
      React.createElement('div', {
        style: {
          position: 'relative',
          zIndex: 1,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 8px',
          color: formulaProgress.percent >= 55 ? '#fff' : '#0958d9',
          fontSize: `${FONT_SIZE_XS}px`,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          textShadow: formulaProgress.percent >= 55 ? '0 1px 1px rgba(0,0,0,0.25)' : 'none',
        },
      }, `${formulaProgress.label || '正在同步公式...'} ${Math.round(formulaProgress.percent || 0)}%`)
    );

    return React.createElement('div', { ref: rootRef, style: { position: 'relative' } },
      isResizing && React.createElement('div', { onMouseMove: onOverlayMove, onMouseUp: onOverlayUp, onMouseLeave: onOverlayUp, style: { position: 'fixed', inset: 0, zIndex: 9999, cursor: 'col-resize', background: 'transparent' } }),
      

      React.createElement('div', {
        style: { display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', marginBottom: '2px' },
      },
        headerInfoEl,

        React.createElement('div', {
        style: { display: 'inline-flex', width: 'fit-content', maxWidth: '100%', gap: '6px', flexWrap: 'wrap', marginBottom: '2px', padding: '3px 8px', background: '#fafafa', borderRadius: '4px', border: '1px solid #d9d9d9', alignItems: 'center', fontSize: `${FONT_SIZE_XS}px`, boxSizing: 'border-box' }
      },
        React.createElement('span', { style: { fontWeight: 600, color: '#555', marginRight: '4px' } }, '列头颜色：'),
        ...PRESET_COLORS.map(pc =>
          React.createElement('div', { key: pc.value, style: { display: 'flex', alignItems: 'center', gap: '2px' } },
            React.createElement('div', { style: { width: '10px', height: '10px', borderRadius: '2px', background: pc.value, border: '1px solid rgba(0,0,0,0.15)' } }),
            React.createElement('span', { style: { color: '#666' } }, pc.label)
          )
        ),
      )
      ),

      React.createElement('div', { style: { display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px', marginBottom: '4px', alignItems: 'stretch' } },
        React.createElement('div', {
          style: {
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            alignItems: 'center',
            minHeight: '34px',
            boxSizing: 'border-box',
            padding: '5px 8px',
            background: '#ffe1e1',
            border: '2px solid #f5222d',
            borderRadius: '4px',
            boxShadow: '0 0 0 1px rgba(245,34,45,0.12)',
          },
        },
          React.createElement('span', { style: { color: '#a8071a', fontSize: `${FONT_SIZE + 1}px`, fontWeight: 900, marginRight: '4px', whiteSpace: 'nowrap' } }, '需设置：'),
          React.createElement('button', { ref: panelBtnRef, onClick: () => { setShowPanel((v) => !v); setShowPush(false); setShowTargetDefaults(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '👁️ 列设置'),
          IS_ADMIN && React.createElement('button', { ref: pushBtnRef, onClick: () => { setShowPush((v) => !v); setShowPanel(false); setShowTargetDefaults(false); setShowCrossHighlightPanel(false); }, style: btnStyle('#EB6793', '#fff', '#d84f7c') }, '📤 推送配置'),
          React.createElement('button', {
          ref: crossHighlightBtnRef,
          onClick: () => { setShowCrossHighlightPanel((v) => !v); setShowPanel(false); setShowPush(false); setShowTargetDefaults(false); },
          style: btnStyle('#EB6793', '#fff', '#d84f7c'),
        }, crossHighlightEnabled ? '高亮行列：开' : '高亮行列'),
          // 🎯 目标值按钮 - 高亮显示
        React.createElement('button', {
          onClick: () => { setShowTargetDefaults((v) => !v); setShowPanel(false); setShowPush(false); setShowCrossHighlightPanel(false); },
          style: btnStyle('#EB6793', '#fff', '#d84f7c')
        }, '🎯 目标值')
        )
      ,

        React.createElement('div', {
          style: {
            display: 'flex',
            gap: '4px',
            flexWrap: 'wrap',
            alignItems: 'center',
            minHeight: '34px',
            boxSizing: 'border-box',
            padding: '5px 8px',
            background: '#fff',
            border: '1px solid #d9d9d9',
            borderRadius: '4px',
          },
        },
          React.createElement('button', {
            onClick: refreshData,
            disabled: actionBusy,
            style: {
              ...btnStyle(actionBusy ? '#f5f5f5' : '#fff', actionBusy ? '#999' : '#333', actionBusy ? '#d9d9d9' : '#d9d9d9'),
              opacity: actionBusy ? 0.65 : 1,
              cursor: actionBusy ? 'not-allowed' : 'pointer',
            },
          }, refreshingData ? '刷新中...' : '🔄 刷新'),
          React.createElement(Select, { value: dateFilterType, onChange: (v) => { setDateFilterType(v); if (v !== 'custom') setCustomDateRange(null); }, options: DATE_FILTER_OPTIONS, style: { width: '120px' }, size: 'small' }),
          React.createElement('span', {
            style: {
              padding: '2px 6px',
              border: '1px solid #d9d9d9',
              borderRadius: '4px',
              background: '#fafafa',
              color: '#555',
              fontSize: `${FONT_SIZE_XS}px`,
              fontWeight: 700,
              whiteSpace: 'nowrap',
            },
          }, '日期范围'),
          React.createElement(DatePicker.RangePicker, {
            locale: DATE_PICKER_LOCALE,
            value: customDateRange ? [ctx.libs.dayjs(customDateRange[0]), ctx.libs.dayjs(customDateRange[1])] : null,
            onChange: (dates) => {
              if (dates && dates[0] && dates[1]) { const range = [dates[0].format('YYYY-MM-DD'), dates[1].format('YYYY-MM-DD')]; setCustomDateRange(range); setDateFilterType('custom'); }
              else { setCustomDateRange(null); if (dateFilterType === 'custom') setDateFilterType('all'); }
            },
            size: 'small',
            style: {
              width: '240px',
              border: dateFilterType === 'custom' ? '1px solid #1677ff' : '1px solid #bfbfbf',
              background: dateFilterType === 'custom' ? '#f0f7ff' : '#fff',
              boxShadow: dateFilterType === 'custom' ? '0 0 0 2px rgba(22,119,255,0.12)' : 'none',
            },
            placeholder: ['开始日期', '结束日期'],
            allowClear: true,
          }),
          React.createElement('span', { style: { fontSize: `${FONT_SIZE_SM}px`, color: '#888' } }, loading ? '加载中...' : `共 ${total} 条记录`),
          formulaProgressEl
        )),

            panelEl,
      pushPanelEl,
      crossHighlightPanelEl,
      targetDefaultsModalEl,

      React.createElement('textarea', {
        ref: clipboardRef,
        value: '',
        onChange: () => {},
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleKeyDown,
        tabIndex: -1,           // 原版用 -1
        'aria-hidden': true,
        style: {
          position: 'fixed',    // 原版定位方式
          left: '0px',
          top: '0px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none', // 原版不响应鼠标事件
          zIndex: -1,
        }
      }),



      React.createElement('div', {
        ref: tableWrapRef,
        tabIndex: 0,
        onCopy: handleCopy,
        onPaste: handlePaste,
        onKeyDown: handleKeyDown,
        onMouseUp: stopSelecting,
        onMouseLeave: stopSelecting,
        style: {
          overflowX: 'auto',
          overflowY: 'auto',
          height: `${tableWrapHeight}px`,
          borderRadius: '8px',
          border: '1px solid #d9d9d9',
          boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          outline: 'none'
        } },

        loading && data.length === 0
          ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '正在加载数据...')
          : data.length === 0
            ? React.createElement('div', { style: { padding: '40px', textAlign: 'center', color: '#999', fontSize: `${FONT_SIZE}px` } }, '暂无数据')
            : React.createElement('table', {
                style: {
                  borderCollapse: 'separate',
                  borderSpacing: 0,
                  tableLayout: 'fixed',
                  background: '#fff',
                  width: `${tableWidth}px`,
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  MozUserSelect: 'none',
                  msUserSelect: 'none',
                }
              },
              React.createElement('thead', null,
                React.createElement('tr', null,
                  visibleCols.map((col) => {
                    const isPinned = col.pinned;
                    const leftOff  = isPinned ? pinnedLeftMap[col.key] : undefined;
                    const canEdit  = isCellEditable(col);
                    const hdrColor = getColHeaderColor(col);
                    const formulaTooltip = FORMULA_TOOLTIPS[col.field] || null;
                    const headerTooltip = getHeaderTooltipData(col);
                    const isFormula = isFormulaField(col.field);
                    
                    return React.createElement('th', {
                      key: col.key, draggable: true, onDragStart: (e) => onDragStart(e, col.key), onDragOver, onDrop: (e) => onDrop(e, col.key), onClick: () => handleSort(col.key),
                      style: {
                        position: 'sticky',
                        top: 0,
                        left: isPinned ? `${leftOff}px` : undefined,
                        zIndex: isPinned ? 4 : 2,
                        width: `${col.width || 80}px`,
                        padding: '5px 6px',
                        background: hdrColor,
                        color: getTextColorForBg(hdrColor),
                        borderBottom: '2px solid rgba(0,0,0,0.1)',
                        borderRight: isPinned ? '2px solid rgba(0,0,0,0.15)' : '1px solid rgba(0,0,0,0.08)',
                        textAlign: 'center',
                        fontWeight: 600,
                        fontSize: `${FONT_SIZE_SM}px`,
                        userSelect: 'none',
                        cursor: isFormula ? 'default' : 'pointer',
                        whiteSpace: 'nowrap',
                        boxSizing: 'border-box',
                        overflow: 'hidden'
                      },
                    },
                      React.createElement('span', { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: '100%', overflow: 'hidden', verticalAlign: 'middle', pointerEvents: 'auto' } },
                          renderHeaderLabel(col.label, headerTooltip),
                          formulaTooltip && React.createElement(Tooltip, {
                              title: renderTooltip(formulaTooltip),
                              placement: 'top',
                              overlayStyle: { maxWidth: '360px' },
                              mouseEnterDelay: 0.15,
                          },
                              React.createElement('span', {
                                  onClick: (e) => e.stopPropagation(),
                                  onMouseDown: (e) => e.stopPropagation(),
                                  draggable: false,
                                  onDragStart: (e) => { e.preventDefault(); e.stopPropagation(); },
                                  style: {
                                      marginLeft: '4px',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      height: '15px',
                                      minWidth: '20px',
                                      padding: '0 4px',
                                      borderRadius: '999px',
                                      background: 'rgba(255,255,255,0.24)',
                                      border: '1px solid rgba(255,255,255,0.45)',
                                      color: 'currentColor',
                                      fontSize: '10px',
                                      fontWeight: 800,
                                      cursor: 'help',
                                      flexShrink: 0,
                                      lineHeight: '13px',
                                      opacity: 0.78,
                                      letterSpacing: 0,
                                  },
                              }, 'fx')
                          ),
                          React.createElement('span', { 
                              style: { 
                                  marginLeft: '2px',
                                  display: sortConfig.key === col.key ? 'inline-block' : 'none',
                                  opacity: 0.85,
                                  fontSize: `${FONT_SIZE_XS}px`,
                                  flexShrink: 0,
                                  lineHeight: 1,
                              } 
                          }, sortConfig.key === col.key ? (sortConfig.dir === 'asc' ? '▲' : '▼') : ''),
                      ),
                      React.createElement('div', { onMouseDown: (e) => onResizeStart(e, col.key), onClick: (e) => e.stopPropagation(), style: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '6px', cursor: 'col-resize', zIndex: 2, background: 'transparent' } }),
                    );
                  })
                )
              ),
              React.createElement('tbody', null,
                pagedData.map((row, rIdx) => {
                  const rowId = row.country_asin_date || row.id;
                  return React.createElement('tr', { key: rowId || rIdx, style: { background: rIdx % 2 === 0 ? '#fff' : '#fafafa' } },
                    visibleCols.map((col) => {
                      const isPinned  = col.pinned;
                      const leftOff   = isPinned ? pinnedLeftMap[col.key] : undefined;
                      const dynFn     = DYNAMIC_COLOR[col.field] || DYNAMIC_COLOR[col.key];
                      const cellColor = dynFn ? dynFn(row) : null;
                      const isNum     = ALL_NUMERIC.has(col.field);
                      const canEdit   = isCellEditable(col);
                      const isEditing = editingCell && editingCell.rowId === rowId && editingCell.colKey === col.key;
                      const cIdx      = visibleCols.findIndex((c) => c.key === col.key);
                      const selected  = isCellSelected(rIdx, cIdx);
                      const displayContent = formatCell(col, row);

                      return React.createElement('td', {
                        key: col.key, title: typeof displayContent === 'string' ? displayContent : undefined,
                        onMouseDown: (e) => handleCellMouseDown(e, rIdx, cIdx),
                        onDoubleClick: () => { if (canEdit && !isEditing) startEdit(rowId, col, row[col.field]); },
                        style: {
                          position: isPinned ? 'sticky' : undefined,
                          left: isPinned ? `${leftOff}px` : undefined,
                          zIndex: isPinned ? 1 : undefined,
                          background: getBodyCellBackground(rIdx, cIdx, selected),
                          padding: isEditing ? '3px 5px' : '5px 8px',
                          borderBottom: '1px solid #f0f0f0',
                          borderRight: isPinned ? '2px solid rgba(0,0,0,0.08)' : '1px solid #f5f5f5',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          textAlign: 'center',
                          color: cellColor || '#333',
                          fontWeight: cellColor ? 600 : 'normal',
                          fontSize: `${FONT_SIZE}px`,
                          boxSizing: 'border-box',
                          userSelect: isEditing ? 'text' : 'none',
                          WebkitUserSelect: isEditing ? 'text' : 'none',
                          MozUserSelect: isEditing ? 'text' : 'none',
                          msUserSelect: isEditing ? 'text' : 'none',
                          cursor: canEdit && !isEditing ? 'cell' : 'default',
                          outline: canEdit && !isEditing ? '1px dashed transparent' : undefined,
                          boxShadow: selected ? 'inset 0 0 0 2px #1677ff' : undefined
                        },
                        onMouseEnter: (e) => {
                          handleCellMouseEnter(rIdx, cIdx);
                          if (canEdit && !isEditing) e.currentTarget.style.outline = '1px dashed #1890ff';
                        },
                        onMouseLeave: canEdit && !isEditing ? (e) => { e.currentTarget.style.outline = '1px dashed transparent'; } : undefined,
                      }, isEditing ? renderEditInput(col) : displayContent);
                    })
                  );
                })
              )
            )
      ),

      React.createElement('div', { style: { marginTop: '0px', display: 'flex', justifyContent: 'flex-end' } },
        React.createElement(Pagination, { current: curPage, pageSize, total, pageSizeOptions: PAGE_SIZE_OPTIONS, showSizeChanger: true, showQuickJumper: true, showTotal: (t, range) => `第 ${range[0]}-${range[1]} 条，共 ${t} 条`, onChange: onPageChange, onShowSizeChange: onPageChange, disabled: loading })
      )
    );
  };

  const TableApp = () => {
    const zhCN = {
      locale: 'zh_CN',
      DatePicker: DATE_PICKER_LOCALE,
    };
    return React.createElement(ConfigProvider, { locale: zhCN },
      React.createElement('div', { style: { padding: '0', fontFamily: 'system-ui, sans-serif', fontSize: `${FONT_SIZE}px` } },
        React.createElement(MergedTable, null)
      )
    );
  };

  ctx.render(React.createElement(TableApp));
}

run();
