const React = ctx.React;
const { useMemo, useState, useEffect } = React;
const { Button, DatePicker, Tag } = ctx.antd;
const dayjs = ctx.libs.dayjs;

const COLLECTION_NAME = 'rsg_plan';

const EVENT_SCALE = 1.5;
const CELL_SIZE_SCALE = 0.8;     // 格子大小缩放比例，1.0 为原始大小，越小格子越小，字体不受影响
const CALENDAR_MIN_WIDTH = 980;

const EVENT_FONT_L        = Math.round(11 * EVENT_SCALE);
const EVENT_FONT_S        = Math.round(10 * EVENT_SCALE);
const EVENT_ITEM_GAP      = 2;
const DAY_TOTAL_FONT_SIZE = 18;  // 当天总量字体大小，可按需调整
const DATE_NUM_FONT_SIZE  = 16;  // 格子内日期数字字体大小，可按需调整
const WEEKDAY_FONT_SIZE   = 16;  // 顶部星期标签字体大小，可按需调整

const COLOR_PALETTE = [
  { solid: '#FFF1F0', solidText: '#DD3922' },
  { solid: '#FFF7E6', solidText: '#8B5E00' },
  { solid: '#FCFFE6', solidText: '#4A6000' },
  { solid: '#F0F1D1', solidText: '#3A4200' },
  { solid: '#E6F4FF', solidText: '#1A5FA8' },
  { solid: '#FFF0F6', solidText: '#8B1A4A' },
  { solid: '#F6FFED', solidText: '#2A6B00' },
  { solid: '#F0F5FF', solidText: '#2A3FA8' },
  { solid: '#FFF9E6', solidText: '#7A5000' },
  { solid: '#FFF1F8', solidText: '#8B0055' },
  { solid: '#E8FFF0', solidText: '#006B3A' },
  { solid: '#FFF3E0', solidText: '#8B4500' },
  { solid: '#EEF2FF', solidText: '#2D3AAA' },
  { solid: '#FFFBE6', solidText: '#6B5000' },
  { solid: '#FDE8E8', solidText: '#8B1A1A' },
];

const COUNTRY_COLOR_MAP = {
  UK: { solid: '#FFF1F0', solidText: '#D4380D' },
  US: { solid: '#FFF0F6', solidText: '#C41D7F' },
  JP: { solid: '#FFF2E8', solidText: '#D46B08' },
  CA: { solid: '#FFF7E6', solidText: '#D48806' },
  DE: { solid: '#FFFBE6', solidText: '#AD8B00' },
  FR: { solid: '#FCFFE6', solidText: '#7CB305' },
  ES: { solid: '#F6FFED', solidText: '#389E0D' },
  IT: { solid: '#E6FFFB', solidText: '#08979C' },
};

function getCountryColor(country) {
  return COUNTRY_COLOR_MAP[country] || COLOR_PALETTE[0];
}

// 截取括号前的内容，同时兼容英文括号 ( 和中文括号 （
function formatType(type) {
  if (!type) return '-';
  const idx = Math.min(
    type.indexOf('(') === -1 ? Infinity : type.indexOf('('),
    type.indexOf('（') === -1 ? Infinity : type.indexOf('（')
  );
  return idx === Infinity ? type.trim() : type.slice(0, idx).trim();
}

function formatAmount(num) {
  return String(Math.round(Number(num || 0)));
}

function getDateList(startDate, endDate) {
  const start = dayjs(startDate).startOf('day');
  const end = dayjs(endDate).startOf('day');
  const days = [];
  let current = start;
  while (current.isBefore(end) || current.isSame(end, 'day')) {
    days.push(current.format('YYYY-MM-DD'));
    current = current.add(1, 'day');
  }
  return days;
}

function distributeAmount(amount, daysCount) {
  if (!daysCount || daysCount <= 0) return [];
  const total = Math.round(Number(amount || 0));
  if (daysCount === 1) return [total];
  const totalParts = (daysCount * (daysCount + 1)) / 2;
  const result = [];
  let allocated = 0;
  for (let i = 1; i <= daysCount; i++) {
    if (i === daysCount) {
      result.push(total - allocated);
    } else {
      const dayAmount = Math.round((i / totalParts) * total);
      result.push(dayAmount);
      allocated += dayAmount;
    }
  }
  return result;
}

function buildDailyMap(records) {
  const map = {};
  (records || []).forEach((plan) => {
    const id = plan.id;
    const country = plan.country || '-';
    const colorObj = getCountryColor(country);
    const startDate = plan.start_date;
    const endDate = plan.end_date;
    const amount = Number(plan.amount || 0);
    if (!startDate || !endDate) return;
    const dateList = getDateList(startDate, endDate);
    if (!dateList.length) return;
    const dailyAmounts = distributeAmount(amount, dateList.length);
    dateList.forEach((dateStr, index) => {
      const dailyAmount = dailyAmounts[index];
      if (Math.round(Number(dailyAmount || 0)) === 0) return;
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push({
        id,
        country,
        model: plan.model || '-',
        sale: plan.sale || '-',
        asin: plan.asin_info?.asin || '-',
        type: formatType(plan.type),
        totalAmount: amount,
        colorObj,
        dailyAmount,
        dayIndex: index + 1,
        totalDays: dateList.length,
      });
    });
  });
  return map;
}

function getMonthCells(year, month) {
  const firstDay = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
  const daysInMonth = firstDay.daysInMonth();
  let firstWeekday = firstDay.day();
  firstWeekday = firstWeekday === 0 ? 6 : firstWeekday - 1;
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(dayjs(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function chunkRows(cells) {
  const rows = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }
  return rows;
}

const EVENT_BAR_LINE_H  = Math.round(18 * EVENT_SCALE);
const EVENT_BAR_PADDING_V = 4;
const EVENT_BAR_H       = EVENT_BAR_LINE_H * 2 + EVENT_BAR_PADDING_V * 2;

// 格子高度计算时乘以 CELL_SIZE_SCALE，字体相关常量不参与缩放
function calcCellHeight(maxItems) {
  const dateRowH = 30;
  const paddingV = 8;
  const minH = 90;
  const computed = dateRowH + maxItems * (EVENT_BAR_H + EVENT_ITEM_GAP) + paddingV;
  return Math.max(computed, minH) * CELL_SIZE_SCALE;
}

function EventBar({ item }) {
  const line1 = `${item.sale}-${item.country}-${item.model}`;
  const line2 = `${item.asin}-${item.type}-${formatAmount(item.totalAmount)}`;

  return React.createElement('div', {
    title: `${line1}\n${line2}\n今日: ${formatAmount(item.dailyAmount)} / 总额: ${formatAmount(item.totalAmount)}`,
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      background: item.colorObj.solid,
      border: `1px solid ${item.colorObj.solidText}22`,
      borderRadius: 3,
      padding: `${EVENT_BAR_PADDING_V}px 6px`,
      marginBottom: EVENT_ITEM_GAP,
      minHeight: EVENT_BAR_H * CELL_SIZE_SCALE,
      cursor: 'default',
      overflow: 'hidden',
      flexShrink: 0,
      gap: 4,
      boxSizing: 'border-box',
    },
  },
    // 左侧：两行文字
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        flex: 1,
        overflow: 'hidden',
        gap: 1,
      },
    },
      // 第一行：sale-country-model
      React.createElement('span', {
        style: {
          fontSize: EVENT_FONT_L,
          fontWeight: 600,
          color: item.colorObj.solidText,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          lineHeight: `${EVENT_BAR_LINE_H}px`,
        },
      }, line1),
      // 第二行：asin-type-totalAmount
      React.createElement('span', {
        style: {
          fontSize: EVENT_FONT_S,
          fontWeight: 500,
          color: item.colorObj.solidText,
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          textOverflow: 'ellipsis',
          lineHeight: `${EVENT_BAR_LINE_H}px`,
          opacity: 0.85,
        },
      }, line2)
    ),
    // 右侧：dailyAmount（当天量）
    React.createElement('span', {
      style: {
        fontSize: EVENT_FONT_S,
        fontWeight: 700,
        color: item.colorObj.solidText,
        whiteSpace: 'nowrap',
        flexShrink: 0,
        borderLeft: `1px solid ${item.colorObj.solidText}33`,
        paddingLeft: 5,
        marginLeft: 2,
        opacity: 0.9,
        alignSelf: 'center',
      },
    }, formatAmount(item.dailyAmount))
  );
}

function DayCell({ dateObj, items, isToday, cellHeight }) {
  const weekday = dateObj.day();
  const isWeekend = weekday === 0 || weekday === 6;

  const dayTotal = items.reduce((sum, item) => sum + Math.round(Number(item.dailyAmount || 0)), 0);
  const dateLabel = dateObj.format('MM-DD');

  const bgColor = isToday ? '#F0F5FF' : isWeekend ? '#F7F7F5' : '#FFFFFF';
  const dateNumColor = isToday ? '#1A5FA8' : isWeekend ? '#AAAAAA' : '#333333';

  return React.createElement('div', {
    style: {
      borderRight: '1px solid #E8E4DF',
      borderBottom: '1px solid #E8E4DF',
      padding: '4px 4px 4px 5px',
      background: bgColor,
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      width: 'calc(100% / 7)',
      flex: '0 0 calc(100% / 7)',
      minHeight: cellHeight,
      },
  },
    // 日期行（含当天总量）
    React.createElement('div', {
      style: {
        display: 'grid',
        gridTemplateColumns: '58px 1fr 58px',
        alignItems: 'center',
        marginBottom: 4,
        flexShrink: 0,
        minHeight: 24,
      },
    },
      // 左侧：日期
      isToday
        ? React.createElement('span', {
            style: {
              background: '#1A5FA8',
              color: '#fff',
              borderRadius: 10,
              height: 20,
              padding: '0 6px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: DATE_NUM_FONT_SIZE - 3,
              fontWeight: 700,
              lineHeight: 1,
              justifySelf: 'start',
            },
          }, dateLabel)
        : React.createElement('span', {
            style: {
              fontSize: DATE_NUM_FONT_SIZE - 3,
              fontWeight: 700,
              color: dateNumColor,
              lineHeight: '20px',
              justifySelf: 'start',
            },
          }, dateLabel),
      // 中间：当天总量（有数据才显示）
      items.length > 0
        ? React.createElement(Tag, {
            color: isToday ? 'blue' : 'default',
            style: {
              margin: 0,
              justifySelf: 'center',
              fontSize: DAY_TOTAL_FONT_SIZE - 6,
              fontWeight: 700,
              lineHeight: '20px',
              whiteSpace: 'nowrap',
              padding: '0 8px',
            },
          }, `当天总量: ${dayTotal}`)
        : React.createElement('span', null),
      React.createElement('span', null)
    ),

    // 条目列表
    React.createElement('div', {
      style: {
        display: 'flex',
        flexDirection: 'column',
      },
    },
      ...items.map((item, i) => React.createElement(EventBar, { key: i, item }))
    )
  );
}

function CalendarBlock() {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState([]);
  const [errorText, setErrorText] = useState('');
  const [currentMonth, setCurrentMonth] = useState(dayjs().startOf('month'));
  const [selectedCountry, setSelectedCountry] = useState(null);

  useEffect(() => {
    let mounted = true;
    async function fetchData() {
      try {
        setLoading(true);
        setErrorText('');
        const res = await ctx.request({
          url: `${COLLECTION_NAME}:list`,
          method: 'GET',
          params: {
            pageSize: 1000,
            sort: ['start_date'],
            fields: ['id', 'country', 'model', 'sale', 'start_date', 'end_date', 'amount', 'type'],
            appends: ['asin_info'],
          },
        });
        const data = res?.data?.data || res?.data || [];
        const filtered = (Array.isArray(data) ? data : []).filter((r) => {
          const typeText = r.type || '';
          return !typeText.includes('日常维持LP') && !typeText.includes('高价单');
        });
        if (mounted) setRecords(filtered);
      } catch (error) {
        const message =
          error?.response?.data?.errors?.[0]?.message ||
          error?.response?.data?.message ||
          error?.message ||
          '未知错误';
        if (mounted) { setRecords([]); setErrorText(message); }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchData();
    return () => { mounted = false; };
  }, []);

  const countries = useMemo(() => {
    const set = new Set();
    records.forEach(r => { if (r.country) set.add(r.country); });
    return Array.from(set).sort();
  }, [records]);

  const filteredRecords = useMemo(() =>
    selectedCountry ? records.filter(r => r.country === selectedCountry) : records,
    [records, selectedCountry]
  );

  const dailyMap = useMemo(() => buildDailyMap(filteredRecords), [filteredRecords]);
  const cells = useMemo(() => getMonthCells(currentMonth.year(), currentMonth.month() + 1), [currentMonth]);
  const today = dayjs().format('YYYY-MM-DD');
  const rows = useMemo(() => chunkRows(cells), [cells]);

  const weekLabels = [
    { label: '周一', weekend: false },
    { label: '周二', weekend: false },
    { label: '周三', weekend: false },
    { label: '周四', weekend: false },
    { label: '周五', weekend: false },
    { label: '周六', weekend: true },
    { label: '周日', weekend: true },
  ];

  return React.createElement('div', {
    style: {
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      background: '#F5F4F2',
      width: '100%',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    },
  },
    // 顶部工具栏
    React.createElement('div', {
      style: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        padding: '6px 10px',
        borderBottom: '1px solid #E8E4DF',
        gap: 5,
        background: '#FFFFFF',
        boxSizing: 'border-box',
        width: '100%',
        maxWidth: '100%',
      },
    },
      React.createElement(Button, {
        size: 'small',
        onClick: () => setCurrentMonth(m => m.subtract(1, 'month')),
        style: { fontWeight: 700, fontSize: 15 },
      }, '‹'),
      React.createElement(Button, {
        size: 'small',
        onClick: () => setCurrentMonth(dayjs().startOf('month')),
      }, '今天'),
      React.createElement(Button, {
        size: 'small',
        onClick: () => setCurrentMonth(m => m.add(1, 'month')),
        style: { fontWeight: 700, fontSize: 15 },
      }, '›'),
      React.createElement(DatePicker, {
        picker: 'month',
        value: currentMonth,
        onChange: (val) => { if (val) setCurrentMonth(val.startOf('month')); },
        allowClear: false,
        style: { width: 120 },
        size: 'small',
        locale: {
          lang: {
            locale: 'zh_CN',
            placeholder: '请选择月份',
            monthPlaceholder: '请选择月份',
            today: '今天',
            now: '此刻',
            backToToday: '返回今天',
            ok: '确定',
            clear: '清除',
            month: '月',
            year: '年',
            timeSelect: '选择时间',
            dateSelect: '选择日期',
            monthSelect: '选择月份',
            yearSelect: '选择年份',
            decadeSelect: '选择年代',
            yearFormat: 'YYYY年',
            dateFormat: 'YYYY年M月D日',
            dayFormat: 'D日',
            dateTimeFormat: 'YYYY年M月D日 HH时mm分ss秒',
            monthBeforeYear: true,
            previousMonth: '上个月',
            nextMonth: '下个月',
            previousYear: '上一年',
            nextYear: '下一年',
            previousDecade: '上一年代',
            nextDecade: '下一年代',
            previousCentury: '上一世纪',
            nextCentury: '下一世纪',
            shortWeekDays: ['日', '一', '二', '三', '四', '五', '六'],
            shortMonths: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
          },
          timePickerLocale: { placeholder: '请选择时间' },
        },
      }),
      React.createElement('div', { style: { width: 1, height: 18, background: '#E8E4DF', margin: '0 2px' } }),
      React.createElement(Button, {
        size: 'small',
        type: selectedCountry === null ? 'primary' : 'default',
        onClick: () => setSelectedCountry(null),
      }, '全部'),
      ...countries.map(c =>
        React.createElement(Button, {
          key: c,
          size: 'small',
          type: selectedCountry === c ? 'primary' : 'default',
          onClick: () => setSelectedCountry(prev => prev === c ? null : c),
        }, c)
      )
    ),

    // 日历主体
    React.createElement('div', {
      style: {
        overflowX: 'auto',
        width: '100%',
        boxSizing: 'border-box',
        display: 'flex',
        justifyContent: 'center',
      },
    },
      React.createElement('div', {
        style: {
          width: '100%',
          minWidth: CALENDAR_MIN_WIDTH,
          flexShrink: 0,
        },
      },
        // 星期头部
        React.createElement('div', {
          style: {
            display: 'flex',
            borderLeft: '1px solid #E8E4DF',
            borderTop: '1px solid #E8E4DF',
            position: 'sticky',
            top: 0,
            zIndex: 10,
            width: '100%',
          },
        },
          weekLabels.map(({ label, weekend }) =>
            React.createElement('div', {
              key: label,
              style: {
                textAlign: 'center',
                padding: '7px 0',
                fontSize: WEEKDAY_FONT_SIZE,
                fontWeight: 700,
                color: weekend ? '#AAAAAA' : '#555555',
                background: weekend ? '#F2F0EE' : '#FAFAFA',
                borderRight: '1px solid #E8E4DF',
                borderBottom: '1px solid #E8E4DF',
                letterSpacing: 1,
                width: 'calc(100% / 7)',
                flex: '0 0 calc(100% / 7)',
                boxSizing: 'border-box',
              },
            }, label)
          )
        ),

        loading
          ? React.createElement('div', { style: { padding: 40, textAlign: 'center', color: '#999' } }, '加载中...')
          : errorText
          ? React.createElement('div', { style: { padding: 16, color: 'red' } }, `错误：${errorText}`)
          : React.createElement('div', {
              style: { borderLeft: '1px solid #E8E4DF' },
            },
              rows.map((row, rowIdx) =>
                React.createElement('div', {
                  key: rowIdx,
                  style: { display: 'flex' },
                },
                  row.map((dateObj, colIdx) => {
                    if (!dateObj) {
                      return React.createElement('div', {
                        key: `empty-${rowIdx}-${colIdx}`,
                        style: {
                          borderRight: '1px solid #E8E4DF',
                          borderBottom: '1px solid #E8E4DF',
                          background: '#EEECE9',
                          width: 'calc(100% / 7)',
                          flex: '0 0 calc(100% / 7)',
                          minHeight: calcCellHeight(0),
                          boxSizing: 'border-box',
                        },
                      });
                    }
                    const dateStr = dateObj.format('YYYY-MM-DD');
                    const items = dailyMap[dateStr] || [];
                    const isToday = dateStr === today;
                    const cellHeight = calcCellHeight(items.length);
                    return React.createElement(DayCell, {
                      key: dateStr,
                      dateObj,
                      items,
                      isToday,
                      cellHeight,
                    });
                  })
                )
              )
            )
      )
    )
  );
}

ctx.render(React.createElement(CalendarBlock, {}));
