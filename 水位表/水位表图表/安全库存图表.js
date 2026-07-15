const React = ctx.libs.React;
const { useCallback, useEffect, useMemo, useState } = React;
const antd = ctx.libs.antd || {};
const { Alert, Empty, Spin } = antd;

const TARGET_SAFE_LINES = [
  { value: 7, label: '目标7天', text: '目标安全天数 7 天', color: '#a9473d' },
  { value: 14, label: '目标14天', text: '目标安全天数 14 天', color: '#d97706' },
];
const ESTIMATE_LINE_COLOR = '#d5a044';
const FUTURE_DAYS = 180;
const CHART_WIDTH = 1780;
const CHART_HEIGHT = 640;
const TOOLTIP_WIDTH = 340;
const SHIPMENT_COL_WIDTH = 180;
const SHIPMENT_LABEL_WIDTH = 76;
const PADDING = { top: 104, right: 48, bottom: 54, left: 64 };
const TOTAL_SHOP = '\u5408\u8ba1';

function apiRequest(options) {
  if (typeof ctx.request === 'function') return ctx.request(options);
  return ctx.api.request(options);
}

async function readUrlParams() {
  const params = {
    asin: '',
    country: '',
    shop: '',
  };

  if (typeof ctx.getVar === 'function') {
    params.asin = await ctx.getVar('ctx.urlSearchParams.asin') || '';
    params.country = await ctx.getVar('ctx.urlSearchParams.country') || '';
    params.shop = await ctx.getVar('ctx.urlSearchParams.shop') || '';
  }

  return params;
}

function pickRows(response) {
  const data = response?.data;
  if (Array.isArray(data?.objects)) return data.objects;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data)) return data;
  return [];
}

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayText() {
  if (ctx.dayjs) return ctx.dayjs().format('YYYY-MM-DD');
  return formatLocalDate(new Date());
}

function addDays(dateText, days) {
  const [year, month, day] = String(dateText).split('-').map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return formatLocalDate(date);
}

function formatDate(value) {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 10);
  if (typeof value?.format === 'function') return value.format('YYYY-MM-DD');

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return formatLocalDate(date);
}

function formatShortDate(dateText) {
  return dateText && dateText.length >= 10 ? dateText.slice(5) : '-';
}

function toNumber(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatValue(value, suffix = '') {
  if (value === undefined || value === null || value === '') return '-';
  return `${value}${suffix}`;
}

function normalizeText(value) {
  if (value === undefined || value === null) return '';
  return String(value).trim();
}

function formatShipmentDate(value) {
  const text = formatDate(value);
  return text || '-';
}

function pickLogisticsChannel(row) {
  const relationChannel = row?.logistics_channel;
  return normalizeText(
    row?.logistics_channel_name
      || row?.channel
      || relationChannel?.logistics_days
      || (typeof relationChannel === 'string' ? relationChannel : '')
      || '',
  );
}

function mergeShipmentInfo(items) {
  if (!items.length) {
    return {
      shipDateText: '-',
      channelText: '-',
      totalQuantity: 0,
      items: [],
    };
  }

  const shipDates = Array.from(new Set(items.map((item) => item.shipDate).filter(Boolean)));
  const channels = Array.from(new Set(items.map((item) => item.channel).filter(Boolean)));
  const totalQuantity = items.reduce((total, item) => total + (item.quantity || 0), 0);

  return {
    shipDateText: shipDates.length ? shipDates.join(' / ') : '-',
    channelText: channels.length ? channels.join(' / ') : '-',
    totalQuantity,
    items,
  };
}

function getShipmentNodeDate(row, delivery) {
  if (!normalizeText(row?.shippment_id)) return formatDate(row?.add_date);
  if (!delivery) return '';
  return formatDate(delivery?.estimated_arrival_date || delivery?.expected_storage_time);
}

async function loadShipmentInfo(params, startDate, endDate) {
  if (params.shop === TOTAL_SHOP) {
    params = { ...params, shop: '' };
  }

  const filterItems = [
    { asin: { $eq: params.asin } },
    { country: { $eq: params.country } },
    { add_date: { $dateNotBefore: startDate } },
    {
      $or: [
        { plan_source: { $empty: true } },
        { plan_source: { $ne: 'shipment_plan_v2' } },
      ],
    },
  ];

  if (params.shop && params.shop !== '合计') {
    filterItems.push({ shop: { $eq: params.shop } });
  }

  const simResponse = await apiRequest({
    url: 'simulate_shipment:list',
    method: 'get',
    params: {
      page: 1,
      pageSize: 1000,
      fields: [
        'id',
        'asin',
        'country',
        'shop',
        'add_date',
        'date',
        'number',
        'shippment_id',
        'channel',
        'logistics_channel',
      ].join(','),
      appends: 'logistics_channel',
      filter: JSON.stringify({ $and: filterItems }),
    },
  });

  const simRows = pickRows(simResponse);
  const shipmentIds = Array.from(new Set(simRows
    .map((row) => normalizeText(row?.shippment_id))
    .filter(Boolean)));

  const deliveryByShipmentId = {};
  if (shipmentIds.length) {
    const deliveryResponse = await apiRequest({
      url: 'delivery_note:list',
      method: 'get',
      params: {
        page: 1,
        pageSize: 500,
        fields: [
          'shipment_id',
          'asin',
          'country',
          'estimated_arrival_date',
          'expected_storage_time',
          'shipment_time',
          'logistics_channel_name',
        ].join(','),
        filter: JSON.stringify({
          $and: [
            { shipment_id: { $in: shipmentIds } },
            { asin: { $eq: params.asin } },
            { country: { $eq: params.country } },
          ],
        }),
      },
    });

    pickRows(deliveryResponse).forEach((row) => {
      const shipmentId = normalizeText(row?.shipment_id);
      if (!shipmentId || deliveryByShipmentId[shipmentId]) return;
      deliveryByShipmentId[shipmentId] = row;
    });
  }

  return simRows.reduce((map, row) => {
    const shipmentId = normalizeText(row?.shippment_id);
    const delivery = shipmentId ? deliveryByShipmentId[shipmentId] : null;
    const arrivalDate = getShipmentNodeDate(row, delivery);
    if (!arrivalDate) return map;

    const source = delivery || row;
    const shipDate = delivery ? formatShipmentDate(delivery.shipment_time) : formatShipmentDate(row?.date);
    const channel = pickLogisticsChannel(source);

    if (!map[arrivalDate]) map[arrivalDate] = [];
    map[arrivalDate].push({
      id: row?.id,
      shop: normalizeText(row?.shop) || '-',
      shipmentId,
      nodeDate: arrivalDate,
      shipDate,
      channel: channel || '-',
      quantity: toNumber(row?.number) || 0,
      source: delivery ? 'delivery_note' : 'simulate_shipment',
    });
    return map;
  }, {});
}

async function loadDailySales() {
  const params = await readUrlParams();
  if (!params.asin || !params.country || !params.shop) {
    return { rows: [], params };
  }

  const startDate = todayText();
  const endDate = addDays(startDate, FUTURE_DAYS);
  const response = await apiRequest({
    url: 'daily_sales:list',
    method: 'get',
    params: {
      page: 1,
      pageSize: 300,
      sort: 'date',
      fields: [
        'date',
        'asin',
        'country',
        'shop',
        'days_for_sale',
        'estimate_days_for_sales',
        'weighted_sales',
        'maybe_sales',
        'sale_maybe_sales',
        'add',
        'quantity_receive',
        'inventory',
        'sale_inventory',
        'on_the_way',
      ].join(','),
      filter: JSON.stringify({
        $and: [
          { asin: { $eq: params.asin } },
          { country: { $eq: params.country } },
          { shop: { $eq: params.shop } },
          { date: { $dateNotBefore: startDate } },
          { date: { $dateNotAfter: endDate } },
        ],
      }),
    },
  });

  const rows = pickRows(response);
  const shipmentInfoByDate = await loadShipmentInfo(params, startDate, endDate);
  return { rows, params, shipmentInfoByDate };
}

function normalizeRows(rows, shipmentInfoByDate = {}) {
  return (rows || [])
    .map((row) => {
      const date = formatDate(row?.date);
      const shipmentInfo = mergeShipmentInfo(shipmentInfoByDate[date] || []);
      return {
        ...row,
        __date: date,
        __systemDays: toNumber(row?.days_for_sale),
        __estimateDays: toNumber(row?.estimate_days_for_sales),
        __dailyAdd: toNumber(row?.add),
        __add: shipmentInfo.totalQuantity,
        __shipmentAdd: shipmentInfo.totalQuantity,
        __shipmentItems: shipmentInfo.items,
        __quantityReceive: toNumber(row?.quantity_receive),
        __inventory: toNumber(row?.inventory),
        __saleInventory: toNumber(row?.sale_inventory),
        __onTheWay: toNumber(row?.on_the_way),
        __weightedSales: toNumber(row?.weighted_sales),
        __maybeSales: toNumber(row?.maybe_sales),
        __saleMaybeSales: toNumber(row?.sale_maybe_sales),
        __shipDateText: shipmentInfo.shipDateText,
        __shipChannelText: shipmentInfo.channelText,
      };
    })
    .filter((row) => row.__date)
    .sort((a, b) => a.__date.localeCompare(b.__date));
}

function findAddEvents(rows) {
  return rows
    .map((row, index) => ({ row, index }))
    .filter((item) => (item.row.__add || 0) > 0);
}

function findLowIntervals(rows, field, threshold) {
  const intervals = [];
  let current = null;

  rows.forEach((row, index) => {
    const value = row[field];
    const isLow = value != null && value < threshold;

    if (isLow && !current) {
      current = {
        startIndex: index,
        endIndex: index,
        startDate: row.__date,
        endDate: row.__date,
        startValue: value,
        minValue: value,
        minDate: row.__date,
      };
    } else if (isLow) {
      current.endIndex = index;
      current.endDate = row.__date;
      if (value < current.minValue) {
        current.minValue = value;
        current.minDate = row.__date;
      }
    } else if (current) {
      intervals.push(current);
      current = null;
    }
  });

  if (current) intervals.push(current);
  return intervals;
}

function sumMetric(items, field) {
  return items.reduce((total, item) => total + (item.row[field] || 0), 0);
}

function buildRiskSummary(warningIntervals, criticalIntervals, addEvents) {
  const warningLine = TARGET_SAFE_LINES[1] || TARGET_SAFE_LINES[0];
  const criticalLine = TARGET_SAFE_LINES[0] || TARGET_SAFE_LINES[1];
  const firstWarning = warningIntervals[0];
  const firstCritical = criticalIntervals[0];
  const totalAdd = sumMetric(addEvents, '__add');

  return [
    [`首次低于${warningLine.value}天`, firstWarning ? `${firstWarning.startDate} / 销售 ${firstWarning.startValue} 天` : `未低于${warningLine.value}天`],
    [`首次低于${criticalLine.value}天`, firstCritical ? `${firstCritical.startDate} / 销售 ${firstCritical.startValue} 天` : `未低于${criticalLine.value}天`],
    ['补货节点', `${addEvents.length} 次 / 合计 ${formatValue(totalAdd, ' 台')}`],
  ];
}

function buildTooltipRowsLegacy(row) {
  if (!row) return [];
  return [
    ['系统预估安全天数', formatValue(row.__systemDays, ' 天'), '#6579ea'],
    ['销售预估安全天数', formatValue(row.__estimateDays, ' 天'), ESTIMATE_LINE_COLOR],
    ['补货数量', formatValue(row.__add, ' 台'), '#64748b'],
    ['系统库存', formatValue(row.__inventory, ' 台'), '#64748b'],
    ['销售库存', formatValue(row.__saleInventory, ' 台'), '#64748b'],
    ['在途数量', formatValue(row.__onTheWay, ' 台'), '#64748b'],
  ];
}

function makeChartData(rows) {
  const values = rows.flatMap((row) => [row.__systemDays, row.__estimateDays])
    .filter((value) => value != null);
  const maxValue = Math.max(...TARGET_SAFE_LINES.map((line) => line.value), ...values, 20);
  const yMax = Math.ceil((maxValue + 6) / 10) * 10;
  const xSpan = Math.max(1, rows.length - 1);
  const plotWidth = CHART_WIDTH - PADDING.left - PADDING.right;
  const plotHeight = CHART_HEIGHT - PADDING.top - PADDING.bottom;

  function x(index) {
    return PADDING.left + (index / xSpan) * plotWidth;
  }

  function y(value) {
    const nextValue = value == null ? 0 : value;
    return PADDING.top + plotHeight - (nextValue / yMax) * plotHeight;
  }

  function linePath(field) {
    return rows
      .map((row, index) => {
        const value = row[field];
        if (value == null) return '';
        return `${index === 0 ? 'M' : 'L'} ${x(index).toFixed(2)} ${y(value).toFixed(2)}`;
      })
      .filter(Boolean)
      .join(' ');
  }

  const systemPath = linePath('__systemDays');
  const estimatePath = linePath('__estimateDays');
  const areaPath = systemPath
    ? `${systemPath} L ${x(rows.length - 1).toFixed(2)} ${y(0).toFixed(2)} L ${x(0).toFixed(2)} ${y(0).toFixed(2)} Z`
    : '';

  return {
    yMax,
    x,
    y,
    plotWidth,
    plotHeight,
    systemPath,
    estimatePath,
    areaPath,
    targetLines: TARGET_SAFE_LINES.map((line) => ({
      ...line,
      y: y(line.value),
    })),
  };
}

function buildTooltipRows(row) {
  if (!row) return [];
  return [
    ['系统预估安全天数', formatValue(row.__systemDays, ' 天'), '#6579ea'],
    ['销售预估安全天数', formatValue(row.__estimateDays, ' 天'), ESTIMATE_LINE_COLOR],
    ['补货数量', formatValue(row.__add, ' 台'), '#64748b'],
    ['当天日均预估', formatValue(row.__maybeSales, ' 台/天'), '#64748b'],
    ['发货日期', row.__shipDateText || '-', '#64748b'],
    ['发货渠道', row.__shipChannelText || '-', '#64748b'],
    ['系统库存', formatValue(row.__inventory, ' 台'), '#64748b'],
    ['销售库存', formatValue(row.__saleInventory, ' 台'), '#64748b'],
    ['在途数量', formatValue(row.__onTheWay, ' 台'), '#64748b'],
  ];
}

function buildTooltipBaseRows(row) {
  if (!row) return [];
  return [
    ['系统预估安全天数', formatValue(row.__systemDays, ' 天'), '#6579ea'],
    ['销售预估安全天数', formatValue(row.__estimateDays, ' 天'), ESTIMATE_LINE_COLOR],
    ['补货数量', formatValue(row.__add, ' 台'), '#b45309'],
    ['当天日均预估', formatValue(row.__maybeSales, ' 台/天'), '#64748b'],
    ['系统库存', formatValue(row.__inventory, ' 台'), '#64748b'],
    ['销售库存', formatValue(row.__saleInventory, ' 台'), '#64748b'],
    ['在途数量', formatValue(row.__onTheWay, ' 台'), '#64748b'],
  ];
}

function SafeStockChart() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [params, setParams] = useState({});
  const [hoverIndex, setHoverIndex] = useState(null);

  const requestRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loadDailySales();
      setParams(result.params || {});
      setRows(normalizeRows(result.rows, result.shipmentInfoByDate));
      setHoverIndex(null);
    } catch (err) {
      setRows([]);
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    requestRows();
  }, [requestRows]);

  const chart = useMemo(() => makeChartData(rows), [rows]);
  const warningThreshold = TARGET_SAFE_LINES[1]?.value ?? TARGET_SAFE_LINES[0]?.value ?? 14;
  const criticalThreshold = TARGET_SAFE_LINES[0]?.value ?? TARGET_SAFE_LINES[1]?.value ?? 7;
  const warningIntervals = useMemo(() => findLowIntervals(rows, '__estimateDays', warningThreshold), [rows, warningThreshold]);
  const criticalIntervals = useMemo(() => findLowIntervals(rows, '__estimateDays', criticalThreshold), [rows, criticalThreshold]);
  const addEvents = useMemo(() => findAddEvents(rows), [rows]);
  const panelRows = useMemo(
    () => buildRiskSummary(warningIntervals, criticalIntervals, addEvents),
    [warningIntervals, criticalIntervals, addEvents],
  );
  const tickStep = Math.max(1, Math.ceil(rows.length / 14));
  const addIndexSet = useMemo(() => new Set(addEvents.map((item) => item.index)), [addEvents]);
  const hoverRow = hoverIndex == null ? null : rows[hoverIndex];
  const tooltipRows = useMemo(() => buildTooltipBaseRows(hoverRow), [hoverRow]);
  const shipmentItems = hoverRow?.__shipmentItems || [];
  const shipmentTableHeight = shipmentItems.length ? 132 : 0;
  const tooltipWidth = Math.max(
    TOOLTIP_WIDTH,
    shipmentItems.length ? SHIPMENT_LABEL_WIDTH + shipmentItems.length * SHIPMENT_COL_WIDTH + 20 : TOOLTIP_WIDTH,
  );
  const hoverX = hoverIndex == null ? null : chart.x(hoverIndex);
  const hoverSystemY = hoverRow?.__systemDays == null ? null : chart.y(hoverRow.__systemDays);
  const hoverEstimateY = hoverRow?.__estimateDays == null ? null : chart.y(hoverRow.__estimateDays);
  const tooltipHeight = 58 + tooltipRows.length * 25 + shipmentTableHeight;
  const tooltipX = hoverX == null
    ? 0
    : Math.min(CHART_WIDTH - PADDING.right - tooltipWidth, Math.max(PADDING.left + 8, hoverX + 14));
  const hoverTopY = Math.min(
    hoverSystemY == null ? CHART_HEIGHT : hoverSystemY,
    hoverEstimateY == null ? CHART_HEIGHT : hoverEstimateY,
  );
  const tooltipY = Math.min(
    CHART_HEIGHT - PADDING.bottom - tooltipHeight,
    Math.max(PADDING.top + 8, hoverTopY - tooltipHeight - 12),
  );

  if (loading) {
    return React.createElement('div', { style: styles.stateWrap },
      Spin
        ? React.createElement(Spin, { tip: '安全库存图表加载中...' })
        : React.createElement('div', null, '安全库存图表加载中...'),
    );
  }

  if (error) {
    return Alert
      ? React.createElement(Alert, {
        type: 'error',
        showIcon: true,
        message: '安全库存图表加载失败',
        description: error,
      })
      : React.createElement('div', { style: styles.error }, `安全库存图表加载失败：${error}`);
  }

  if (!rows.length) {
    const description = params.asin && params.country && params.shop
      ? '暂无安全库存数据'
      : '缺少 ASIN / 国家 / 店铺参数';
    return React.createElement('div', { style: styles.stateWrap },
      Empty
        ? React.createElement(Empty, { description })
        : React.createElement('div', null, description),
    );
  }

  return React.createElement('div', { style: styles.wrap },
    React.createElement('div', { style: styles.header },
      React.createElement('div', { style: styles.title },
        React.createElement('span', { style: styles.icon }, '▧'),
        React.createElement('span', null, '库存风险 & 安全天数趋势 · '),
        React.createElement('span', { style: styles.product }, `${params.asin || rows[0]?.asin || '-'} · ${params.country || rows[0]?.country || '-'}`),
      ),
    ),
    React.createElement('div', { style: styles.body },
      React.createElement('div', { style: styles.chartPanel },
          React.createElement('div', { style: styles.chartLegend },
          React.createElement(LegendItem, { color: '#6579ea', label: '系统预估安全天数' }),
          React.createElement(LegendItem, { color: ESTIMATE_LINE_COLOR, label: '销售预估安全天数' }),
          React.createElement(LegendItem, { color: '#b45309', label: '补货节点' }),
          TARGET_SAFE_LINES.map((line) => React.createElement(LegendItem, {
            key: line.label,
            color: line.color,
            label: line.label,
            dashed: true,
          })),
        ),
        React.createElement('svg', {
          viewBox: `0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`,
          style: styles.svg,
          role: 'img',
          onMouseLeave: () => setHoverIndex(null),
        },
          React.createElement('defs', null,
            React.createElement('linearGradient', { id: 'safeStockArea', x1: '0', y1: '0', x2: '0', y2: '1' },
              React.createElement('stop', { offset: '0%', stopColor: '#6579ea', stopOpacity: '0.16' }),
              React.createElement('stop', { offset: '100%', stopColor: '#6579ea', stopOpacity: '0.03' }),
            ),
          ),
          React.createElement('text', { x: 8, y: 20, fill: '#64748b', fontSize: 15, fontWeight: 700 }, '天数'),
          [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const value = Math.round(chart.yMax * (1 - ratio));
            const y = PADDING.top + chart.plotHeight * ratio;
            return React.createElement('g', { key: `grid-${ratio}` },
              React.createElement('line', {
                x1: PADDING.left,
                y1: y,
                x2: CHART_WIDTH - PADDING.right,
                y2: y,
                stroke: '#e9edf5',
                strokeWidth: 1,
              }),
              React.createElement('text', {
                x: PADDING.left - 12,
                y: y + 4,
                textAnchor: 'end',
                fill: '#9aa3b2',
                fontSize: 14,
                fontWeight: 700,
              }, value),
            );
          }),
          chart.targetLines.map((line, index) => React.createElement('g', { key: line.label },
            React.createElement('line', {
              x1: PADDING.left,
              y1: line.y,
              x2: CHART_WIDTH - PADDING.right,
              y2: line.y,
              stroke: line.color,
              strokeWidth: 1.4,
              strokeDasharray: '6 6',
            }),
            React.createElement('text', {
              x: CHART_WIDTH - PADDING.right - 12,
              y: line.y - 8 - index * 2,
              textAnchor: 'end',
              fill: '#8b95a5',
              fontSize: 14,
              fontWeight: 700,
            }, line.text),
          )),
          React.createElement('g', { key: 'risk-summary-in-chart' },
            panelRows.map(([label, value], index) => {
              const cardWidth = 286;
              const cardHeight = 42;
              const gap = 12;
              const totalWidth = cardWidth * panelRows.length + gap * (panelRows.length - 1);
              const cardX = CHART_WIDTH - PADDING.right - totalWidth + index * (cardWidth + gap);
              const cardY = 18;
              const textY = cardY + cardHeight / 2;

              return React.createElement('g', { key: label },
                React.createElement('rect', {
                  x: cardX,
                  y: cardY,
                  width: cardWidth,
                  height: cardHeight,
                  rx: 8,
                  fill: '#ffffff',
                  stroke: '#cfd8e8',
                  strokeWidth: 1,
                }),
                React.createElement('text', {
                  x: cardX + 14,
                  y: textY,
                  fill: '#8b95a5',
                  fontSize: 14,
                  fontWeight: 700,
                  dominantBaseline: 'middle',
                }, label),
                React.createElement('text', {
                  x: cardX + cardWidth - 14,
                  y: textY,
                  fill: '#202938',
                  fontSize: 15,
                  fontWeight: 800,
                  textAnchor: 'end',
                  dominantBaseline: 'middle',
                }, value),
              );
            }),
          ),
          chart.areaPath
            ? React.createElement('path', { d: chart.areaPath, fill: 'url(#safeStockArea)' })
            : null,
          chart.systemPath
            ? React.createElement('path', { d: chart.systemPath, fill: 'none', stroke: '#6579ea', strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' })
            : null,
          chart.estimatePath
            ? React.createElement('path', { d: chart.estimatePath, fill: 'none', stroke: ESTIMATE_LINE_COLOR, strokeWidth: 2.4, strokeLinejoin: 'round', strokeLinecap: 'round' })
            : null,
          rows.map((row, index) => {
            if (index % tickStep !== 0 && index !== rows.length - 1) return null;
            return React.createElement('text', {
              key: `x-${row.__date}`,
              x: chart.x(index),
              y: CHART_HEIGHT - 12,
              textAnchor: 'middle',
              fill: '#9aa3b2',
              fontSize: 13,
              fontWeight: 700,
            }, formatShortDate(row.__date));
          }),
          rows.map((row, index) => {
            if (!addIndexSet.has(index)) return null;
            const value = row.__estimateDays ?? row.__systemDays;
            if (value == null) return null;
            const markerY = Math.max(PADDING.top + 18, chart.y(value) - 12);
            return React.createElement('g', { key: `add-marker-${row.__date}-${index}` },
              React.createElement('circle', {
                cx: chart.x(index),
                cy: chart.y(value),
                r: 6,
                fill: '#ffffff',
                stroke: '#b45309',
                strokeWidth: 2.4,
              }),
              React.createElement('circle', {
                cx: chart.x(index),
                cy: chart.y(value),
                r: 2.2,
                fill: '#b45309',
              }),
              React.createElement('text', {
                x: chart.x(index),
                y: markerY,
                textAnchor: 'middle',
                fill: '#92400e',
                fontSize: 12,
                fontWeight: 800,
              }, formatValue(row.__add)),
              React.createElement('text', {
                x: -9999,
                y: -9999,
                textAnchor: 'middle',
                fill: 'transparent',
                fontSize: 0,
                fontWeight: 800,
              }, `补${row.__add}`),
            );
          }),
          hoverRow ? React.createElement('g', { key: `hover-${hoverRow.__date}`, pointerEvents: 'none' },
            React.createElement('line', {
              x1: hoverX,
              y1: PADDING.top,
              x2: hoverX,
              y2: CHART_HEIGHT - PADDING.bottom,
              stroke: '#94a3b8',
              strokeWidth: 1,
              strokeDasharray: '4 4',
              opacity: 0.75,
            }),
            hoverSystemY == null ? null : React.createElement('circle', {
              cx: hoverX,
              cy: hoverSystemY,
              r: 6,
              fill: '#ffffff',
              stroke: '#6579ea',
              strokeWidth: 3,
            }),
            hoverEstimateY == null ? null : React.createElement('circle', {
              cx: hoverX,
              cy: hoverEstimateY,
              r: 6,
              fill: '#ffffff',
              stroke: ESTIMATE_LINE_COLOR,
              strokeWidth: 3,
            }),
            React.createElement('rect', {
              x: tooltipX,
              y: tooltipY,
              width: tooltipWidth,
              height: tooltipHeight,
              rx: 8,
              fill: '#ffffff',
              stroke: '#dbe3f0',
              strokeWidth: 1,
              opacity: 0.98,
            }),
            React.createElement('text', {
              x: tooltipX + 12,
              y: tooltipY + 22,
              fill: '#1f2937',
              fontSize: 15,
              fontWeight: 800,
            }, hoverRow.__date),
            tooltipRows.map(([label, value, color], index) => React.createElement('g', {
              key: `${label}-${index}`,
              transform: `translate(${tooltipX + 10}, ${tooltipY + 50 + index * 25})`,
            },
              React.createElement('rect', {
                x: 0,
                y: -16,
                width: tooltipWidth - 20,
                height: 24,
                fill: index % 2 === 0 ? '#f8fafc' : '#ffffff',
                stroke: '#e5eaf3',
                strokeWidth: 1,
              }),
              React.createElement('line', {
                x1: 150,
                y1: -16,
                x2: 150,
                y2: 8,
                stroke: '#e5eaf3',
                strokeWidth: 1,
              }),
              React.createElement('circle', { cx: 8, cy: -4, r: 3.5, fill: color }),
              React.createElement('text', {
                x: 18,
                y: 0,
                fill: '#243142',
                fontSize: 14,
                fontWeight: 800,
              }, label),
              React.createElement('text', {
                x: tooltipWidth - 28,
                y: 0,
                fill: '#0f172a',
                fontSize: 14,
                fontWeight: 800,
                textAnchor: 'end',
              }, value),
            )),
            shipmentItems.length ? React.createElement('g', {
              key: 'shipment-detail-table',
              transform: `translate(${tooltipX + 10}, ${tooltipY + 50 + tooltipRows.length * 25 + 12})`,
            },
              [
                ['单据', ...shipmentItems.map((item, index) => `单${index + 1}`)],
                ['单号', ...shipmentItems.map((item) => item.shipmentId || `模拟${item.id || '-'}`)],
                ['店铺', ...shipmentItems.map((item) => item.shop || '-')],
                ['数量', ...shipmentItems.map((item) => formatValue(item.quantity, ' 台'))],
                ['发货日', ...shipmentItems.map((item) => item.shipDate || '-')],
                ['渠道', ...shipmentItems.map((item) => item.channel || '-')],
              ].map((cells, rowIndex) => React.createElement('g', {
                key: `shipment-row-${rowIndex}`,
                transform: `translate(0, ${rowIndex * 20})`,
              },
                cells.map((cell, cellIndex) => {
                  const width = cellIndex === 0 ? SHIPMENT_LABEL_WIDTH : SHIPMENT_COL_WIDTH;
                  const x = cellIndex === 0
                    ? 0
                    : SHIPMENT_LABEL_WIDTH + (cellIndex - 1) * SHIPMENT_COL_WIDTH;
                  return React.createElement('g', { key: `shipment-cell-${rowIndex}-${cellIndex}` },
                    React.createElement('rect', {
                      x,
                      y: 0,
                      width,
                      height: 20,
                      fill: rowIndex === 0 ? '#eef3ff' : (rowIndex % 2 === 0 ? '#f8fafc' : '#ffffff'),
                      stroke: '#e5eaf3',
                      strokeWidth: 1,
                    }),
                    React.createElement('text', {
                      x: x + width / 2,
                      y: 14,
                      fill: rowIndex === 0 || cellIndex === 0 ? '#243142' : '#0f172a',
                      fontSize: 12,
                      fontWeight: rowIndex === 0 || cellIndex === 0 ? 800 : 700,
                      textAnchor: 'middle',
                    }, cell),
                  );
                }),
              )),
            ) : null,
          ) : null,
          rows.map((row, index) => {
            const previousX = index === 0 ? PADDING.left : (chart.x(index - 1) + chart.x(index)) / 2;
            const nextX = index === rows.length - 1 ? CHART_WIDTH - PADDING.right : (chart.x(index) + chart.x(index + 1)) / 2;
            return React.createElement('rect', {
              key: `hover-zone-${row.__date}-${index}`,
              x: previousX,
              y: PADDING.top,
              width: Math.max(1, nextX - previousX),
              height: chart.plotHeight,
              fill: 'transparent',
              onMouseEnter: () => setHoverIndex(index),
              onMouseMove: () => setHoverIndex(index),
            });
          }),
        ),
      ),
      false && React.createElement('div', { style: styles.tracePanel },
        React.createElement('div', { style: styles.traceTitle }, '库存风险摘要'),
        React.createElement('div', { style: styles.traceSubTitle }, `${params.asin || rows[0]?.asin || '-'} / ${params.country || rows[0]?.country || '-'} / ${params.shop || rows[0]?.shop || '-'}`),
        React.createElement('div', { style: styles.traceTable },
          panelRows.map(([label, value]) => React.createElement('div', { key: label, style: styles.traceRow },
            React.createElement('div', { style: styles.traceLabel }, label),
            React.createElement('div', { style: styles.traceValue }, value),
          )),
        ),
      ),
    ),
  );
}

function LegendItem({ color, label, dashed }) {
  return React.createElement('span', { style: styles.legendItem },
    React.createElement('span', {
      style: {
        ...styles.legendLine,
        background: dashed ? 'transparent' : color,
        borderTop: dashed ? `2px dashed ${color}` : 'none',
      },
    }),
    React.createElement('span', null, label),
  );
}

const styles = {
  wrap: {
    width: '100%',
    minHeight: 700,
    padding: '8px 12px 12px',
    background: '#ffffff',
    color: '#202938',
    boxSizing: 'border-box',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 16,
    marginBottom: 8,
    overflow: 'hidden',
  },
  title: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
    color: '#1f2937',
    fontSize: 18,
    fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  icon: {
    color: '#6579ea',
    fontSize: 18,
  },
  product: {
    color: '#5270f3',
  },
  legend: {
    display: 'flex',
    alignItems: 'center',
    gap: 22,
    flexWrap: 'wrap',
    color: '#4b5563',
    fontSize: 13,
    fontWeight: 600,
  },
  chartLegend: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 24,
    flexWrap: 'wrap',
    minHeight: 36,
    padding: '10px 18px 4px',
    color: '#4b5563',
    fontSize: 13,
    fontWeight: 700,
    boxSizing: 'border-box',
  },
  legendItem: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    whiteSpace: 'nowrap',
  },
  legendLine: {
    display: 'inline-block',
    width: 30,
    height: 4,
    borderRadius: 999,
  },
  body: {
    display: 'block',
  },
  chartPanel: {
    minWidth: 0,
    border: '1px solid #dfe5f2',
    borderRadius: 8,
    background: '#ffffff',
    overflow: 'hidden',
  },
  svg: {
    display: 'block',
    width: '100%',
    height: 640,
  },
  tracePanel: {
    border: '1px solid #dfe5f2',
    borderRadius: 8,
    background: '#ffffff',
    padding: '20px 12px 14px',
    boxShadow: '0 1px 3px rgba(15,23,42,0.05)',
    overflow: 'hidden',
  },
  traceTitle: {
    textAlign: 'center',
    color: '#202938',
    fontSize: 18,
    fontWeight: 800,
    lineHeight: '24px',
  },
  traceSubTitle: {
    marginTop: 5,
    marginBottom: 14,
    textAlign: 'center',
    color: '#8b95a5',
    fontSize: 13,
    fontWeight: 600,
  },
  traceTable: {
    border: '1px solid #e7edf7',
    background: '#f3f6fc',
  },
  traceRow: {
    display: 'grid',
    gridTemplateColumns: '102px minmax(0, 1fr)',
    minHeight: 40,
    borderBottom: '1px solid #e7edf7',
  },
  traceLabel: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRight: '1px solid #e7edf7',
    color: '#8b95a5',
    fontSize: 13,
    fontWeight: 700,
  },
  traceValue: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 10px',
    color: '#202938',
    fontSize: 14,
    fontWeight: 800,
    textAlign: 'center',
    overflowWrap: 'anywhere',
  },
  stateWrap: {
    minHeight: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#ffffff',
    border: '1px solid #edf1f7',
    borderRadius: 8,
  },
  error: {
    padding: 16,
    color: '#b42318',
    background: '#fff6f5',
    border: '1px solid #ffd4ce',
    borderRadius: 8,
  },
};

ctx.render(React.createElement(SafeStockChart));
