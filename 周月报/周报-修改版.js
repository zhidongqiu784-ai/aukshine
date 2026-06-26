// 周报复盘与计划组件
function WeeklyReviewAndPlanDisplay() {
  const { React } = ctx.libs;
  
  // 防抖函数
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };
  
  // 保存到数据库的函数
  const saveToDatabase = async (recordId, updates) => {
    let apiClient = null;
    try {
      apiClient = ctx.libs.app?.apiClient || ctx.app?.apiClient;
    } catch (e) {
      return;
    }
    
    if (!apiClient) return;
    
    try {
      await apiClient.request({
        url: `weekly_report:update/${recordId}`,
        method: 'post',
        data: updates,
      });
    } catch (error) {
      // 静默处理错误
    }
  };
  
  // 创建防抖保存函数（5秒防抖）
  const debouncedSave = debounce(saveToDatabase, 5000);
  const debouncedSaveQuick = debounce(saveToDatabase, 800);
  
  // 获取数据
  const record = ctx.record || {};
  const formValues = ctx.formValues || {};
  
  // 本周数据
  const weeklyPlan = record.plan || '';
  const weeklySummary = record.summary || '';
  const mondayDate = record.monday || '';
  const nextMondayDate = record.nextmonday || '';
  
  // 下周数据
  const nextWeekInfo = formValues.nextweek_info || {};
  const hasNextWeekInfo = nextWeekInfo && (nextWeekInfo.month_country_asin_week || Object.keys(nextWeekInfo).length > 0);
  const nextWeekPlan = nextWeekInfo.plan || '';
  const nextWeekPlanInfo = nextWeekInfo.week_plan || {};
  const nextWeekGoal = nextWeekPlanInfo.week_goal || '';
  
  // 关联字段数据（用于异常指标）
  const relationData = record.f_h7vx7vd9lvn || {};
  
  // 异常指标数据
  const performanceData = relationData.performance || {};
  const cpuValue = performanceData.cpu || 0;
  const cpuThreshold = record.asin_info?.cpu_threshold || 0;
  const isCpuExceedThreshold = cpuValue > cpuThreshold && cpuThreshold > 0;

  const targetCompletionRate = relationData.target_rate || 0;
  const currentCompletionRate = relationData.completion_rate || 0;
  const isCompletionRateLow = currentCompletionRate < targetCompletionRate && targetCompletionRate > 0;

  // 库存风险计算
  const stockInfo = relationData.stock_info || {};
  const totalStock = stockInfo.total || 0;
  const totalTargetSales = relationData.total_target_sales || 0;
  const trueSales = relationData.true_sales || 0;
  const targetMonthEndStock = totalStock - totalTargetSales + trueSales;
  const baseDailySales = relationData.base_dailysales || 0;
  
  let monthsAfterThisMonth = 0;
  if (baseDailySales > 0) {
    monthsAfterThisMonth = targetMonthEndStock / 30 / baseDailySales;
  }

  let inventoryRisk = '正常';
  if (monthsAfterThisMonth > 2) {
    inventoryRisk = '滞销';
  } else if (monthsAfterThisMonth < 1) {
    inventoryRisk = '断货';
  }

  const isInventoryRiskAbnormal = inventoryRisk === '滞销' || inventoryRisk === '断货';
  const over180DaysStock = relationData.stock_over180 || 0;
  const isOver180DaysAbnormal = over180DaysStock > 0;
  
  // 构建异常提示信息
  const abnormalAlerts = [];
  if (isCpuExceedThreshold) {
    abnormalAlerts.push(`CPU值(${cpuValue.toFixed(2)})超过阈值(${cpuThreshold.toFixed(2)})`);
  }
  if (isCompletionRateLow) {
    abnormalAlerts.push(`当前完成率(${(currentCompletionRate * 100).toFixed(1)}%)低于目标完成率(${(targetCompletionRate * 100).toFixed(1)}%)`);
  }
  if (isInventoryRiskAbnormal) {
    abnormalAlerts.push(`库存风险：${inventoryRisk}`);
  }
  if (isOver180DaysAbnormal) {
    abnormalAlerts.push(`超180天库龄库存：${over180DaysStock.toLocaleString('en-US')}件`);
  }
  
  // 工具函数
  const cleanText = (text) => {
    if (!text) return '';
    return text
      .replace(/^\s+/g, '')
      .replace(/\s+$/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s+\n/g, '\n\n')
      .trim();
  };
  
  const parseDate = (dateString) => {
    if (!dateString) return null;
    if (dateString instanceof Date) return dateString;
    const date = new Date(dateString);
    return isNaN(date.getTime()) ? null : date;
  };
  
  const addDays = (date, days) => {
    if (!date) return null;
    const newDate = new Date(date.getTime());
    newDate.setDate(newDate.getDate() + days);
    return newDate;
  };
  
  const formatWeekRange = (mondayDateString, nextMondayDateString) => {
    const mondayDateObj = parseDate(mondayDateString);
    const nextMondayDateObj = parseDate(nextMondayDateString);
    
    if (!mondayDateObj || !nextMondayDateObj) return '';
    
    const startDate = addDays(mondayDateObj, -1);
    const endDate = addDays(nextMondayDateObj, -2);
    
    if (!startDate || !endDate) return '';
    
    const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const startDay = startDate.getDate().toString().padStart(2, '0');
    const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const endDay = endDate.getDate().toString().padStart(2, '0');
    
    return `${startMonth}/${startDay}~${endMonth}/${endDay}`;
  };
  
  const formatNextWeekRange = (mondayDateString, nextMondayDateString) => {
    const mondayDateObj = parseDate(mondayDateString);
    const nextMondayDateObj = parseDate(nextMondayDateString);
    
    if (!mondayDateObj || !nextMondayDateObj) return '';
    
    const startDate = addDays(mondayDateObj, 6);
    const endDate = addDays(nextMondayDateObj, 5);
    
    if (!startDate || !endDate) return '';
    
    const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
    const startDay = startDate.getDate().toString().padStart(2, '0');
    const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
    const endDay = endDate.getDate().toString().padStart(2, '0');
    
    return `${startMonth}/${startDay}~${endMonth}/${endDay}`;
  };
  
  const checkAndUpdateStatus = (summaryValue, nextPlanValue) => {
    const summaryTrimmed = (summaryValue || '').trim();
    const nextPlanTrimmed = (nextPlanValue || '').trim();
    
    if (summaryTrimmed && nextPlanTrimmed) {
      ctx.form.setFieldValue('status', '待主管审核');
      return true;
    }
    return false;
  };
  
  const generateBottomTip = (summaryValue, nextPlanValue) => {
    const summaryTrimmed = (summaryValue || '').trim();
    const nextPlanTrimmed = (nextPlanValue || '').trim();
    
    const missingFields = [];
    if (!summaryTrimmed) missingFields.push('本周复盘');
    if (!nextPlanTrimmed) missingFields.push('下周计划');
    
    if (missingFields.length === 0) {
      return '';
    } else {
      return `
        <div style="
          margin-top: 16px;
          padding: 12px;
          background: #fffbe6;
          border: 1px solid #ffe58f;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
        ">
          <span style="font-size: 16px;">⚠️</span>
          <span style="color: #faad14; font-size: 14px; font-weight: 500;">
            请完成以下字段后才能提交至主管审核：${missingFields.join('、')}
          </span>
        </div>
      `;
    }
  };
  
  const cleanWeeklyPlan = cleanText(weeklyPlan);
  const cleanWeeklySummary = cleanText(weeklySummary);
  const cleanNextWeekPlan = cleanText(nextWeekPlan);
  const cleanNextWeekGoal = cleanText(nextWeekGoal);
  const currentWeekRange = formatWeekRange(mondayDate, nextMondayDate);
  const nextWeekRange = formatNextWeekRange(mondayDate, nextMondayDate);
  
  const abnormalAlertsHTML = hasNextWeekInfo && abnormalAlerts.length > 0 ? `
    <div style="
      margin-bottom: 12px;
      padding: 12px;
      background: #fff2f0;
      border: 1px solid #ffccc7;
      border-radius: 8px;
    ">
      <div style="
        font-size: 13px;
        font-weight: 600;
        color: #ff4d4f;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        <span style="font-size: 16px;">⚠️</span>
        <span>以下指标异常，请重点复盘：</span>
      </div>
      <ul style="
        margin: 0;
        padding-left: 20px;
        color: #ff4d4f;
        font-size: 13px;
        line-height: 1.8;
      ">
        ${abnormalAlerts.map(alert => `<li>${alert}</li>`).join('')}
      </ul>
    </div>
  ` : '';
  
  // 本周复盘区域
  const secondRowSection = hasNextWeekInfo ? `
    <div style="margin-bottom: 28px;">
      <div style="
        font-size: 16px; 
        font-weight: 700; 
        color: #262626; 
        margin-bottom: 16px; 
        padding-bottom: 8px;
        border-bottom: 2px solid #fa8c16;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span style="font-size: 18px;">📝</span>
        <span>本周复盘${currentWeekRange ? `（${currentWeekRange}）` : ''}</span>
      </div>
      ${abnormalAlertsHTML}
      <div style="display: flex; gap: 16px; align-items: stretch;">
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
          <div style="font-size: 14px; font-weight: 600; color: #595959; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="width: 4px; height: 14px; background: #722ed1; border-radius: 2px;"></span>
            本周计划
          </div>
          <div style="flex: 1; padding: 12px 0; color: #262626; line-height: 1.8; white-space: pre-wrap; word-break: break-word; font-size: 14px;">${cleanWeeklyPlan || '暂无本周计划'}</div>
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
          <div style="font-size: 14px; font-weight: 600; color: #595959; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="width: 4px; height: 14px; background: #fa8c16; border-radius: 2px;"></span>
            本周复盘
          </div>
          <textarea id="weeklySummaryInput" style="flex: 1; width: 100%; min-height: 300px; padding: 12px; border: 1px solid #d9d9d9; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #262626; resize: vertical; box-sizing: border-box;" placeholder="请输入本周复盘内容...">${cleanWeeklySummary || ''}</textarea>
        </div>
      </div>
    </div>
  ` : `
    <div style="margin-bottom: 28px;">
      <div style="
        font-size: 16px; 
        font-weight: 700; 
        color: #262626; 
        margin-bottom: 16px; 
        padding-bottom: 8px;
        border-bottom: 2px solid #722ed1;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span style="font-size: 18px;">📝</span>
        <span>本周计划${currentWeekRange ? `（${currentWeekRange}）` : ''}</span>
      </div>
      <div style="font-size: 14px; font-weight: 600; color: #595959; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
        <span style="width: 4px; height: 14px; background: #722ed1; border-radius: 2px;"></span>
        本周计划
      </div>
      <textarea id="weeklyPlanInput" style="width: 100%; min-height: 300px; padding: 12px; border: 1px solid #d9d9d9; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #262626; resize: vertical; box-sizing: border-box;" placeholder="请输入本周计划...">${cleanWeeklyPlan || ''}</textarea>
    </div>
  `;
  
  // 下周计划区域
  const thirdRowSection = hasNextWeekInfo ? `
    <div style="margin-bottom: 24px;">
      <div style="
        font-size: 16px; 
        font-weight: 700; 
        color: #262626; 
        margin-bottom: 16px; 
        padding-bottom: 8px;
        border-bottom: 2px solid #13c2c2;
        display: flex;
        align-items: center;
        gap: 8px;
      ">
        <span style="font-size: 18px;">🎯</span>
        <span>下周计划${nextWeekRange ? `（${nextWeekRange}）` : ''}</span>
      </div>
      <div style="display: flex; gap: 16px; align-items: stretch;">
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
          <div style="font-size: 14px; font-weight: 600; color: #595959; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="width: 4px; height: 14px; background: #13c2c2; border-radius: 2px;"></span>
            月初拟定的下周个人目标
          </div>
          <div style="flex: 1; padding: 12px 0; color: #262626; line-height: 1.8; white-space: pre-wrap; word-break: break-word; font-size: 14px;">${cleanNextWeekGoal || '暂无下周大致目标'}</div>
        </div>
        <div style="flex: 1; min-width: 0; display: flex; flex-direction: column;">
          <div style="font-size: 14px; font-weight: 600; color: #595959; margin-bottom: 8px; display: flex; align-items: center; gap: 6px;">
            <span style="width: 4px; height: 14px; background: #722ed1; border-radius: 2px;"></span>
            下周计划
          </div>
          <textarea id="nextWeekPlanInput" style="flex: 1; width: 100%; min-height: 300px; padding: 12px; border: 1px solid #d9d9d9; border-radius: 8px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 14px; line-height: 1.6; color: #262626; resize: vertical; box-sizing: border-box;" placeholder="请输入下周计划...">${cleanNextWeekPlan || ''}</textarea>
        </div>
      </div>
    </div>
  ` : '';
  
  const bottomTipSection = hasNextWeekInfo ? `
    <div id="bottomTipContainer">
      ${generateBottomTip(cleanWeeklySummary, cleanNextWeekPlan)}
    </div>
  ` : '';
  
  return (
    <div style={{
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      lineHeight: 1.6,
      color: '#262626',
      padding: '20px 0',
    }}
    data-record-id={record.month_country_asin_week}
    data-nextweek-id={nextWeekInfo.month_country_asin_week}
    dangerouslySetInnerHTML={{
      __html: secondRowSection + thirdRowSection + bottomTipSection
    }}
    ref={(element) => {
      if (!element) return;
      
      const weeklyPlanInput = element.querySelector('#weeklyPlanInput');
      const weeklySummaryInput = element.querySelector('#weeklySummaryInput');
      const nextWeekPlanInput = element.querySelector('#nextWeekPlanInput');
      const bottomTipContainer = element.querySelector('#bottomTipContainer');
      
      const updateBottomTip = (summaryValue, nextPlanValue) => {
        if (bottomTipContainer) {
          bottomTipContainer.innerHTML = generateBottomTip(summaryValue, nextPlanValue);
        }
      };
      
      // 本周计划输入（仅当没有下周信息时显示）
      if (weeklyPlanInput && !hasNextWeekInfo && !weeklyPlanInput.__weeklyReviewBound) {
        weeklyPlanInput.__weeklyReviewBound = true;
        weeklyPlanInput.addEventListener('input', (e) => {
          const planValue = e.target.value;
          ctx.form.setFieldValue('plan', planValue);
          
          const currentRecordId = element.dataset.recordId;
          if (currentRecordId) {
            debouncedSave(currentRecordId, { plan: planValue });
          }
        });
      }
      
      if (!hasNextWeekInfo) return;

      if (!element.__weeklyReviewNextweekSlimmed) {
        element.__weeklyReviewNextweekSlimmed = true;
        const currentNextWeekInfo = ctx.form.getFieldValue('nextweek_info') || {};
        const nextWeekKey = currentNextWeekInfo.month_country_asin_week || nextWeekInfo.month_country_asin_week;
        if (nextWeekKey) {
          ctx.form.setFieldValue('nextweek_info', {
            month_country_asin_week: nextWeekKey,
            plan: currentNextWeekInfo.plan || nextWeekInfo.plan || '',
          });
        }
      }

      // 初始检查状态
      checkAndUpdateStatus(cleanWeeklySummary, cleanNextWeekPlan);
      
      // 本周复盘输入
      if (weeklySummaryInput && !weeklySummaryInput.__weeklyReviewBound) {
        weeklySummaryInput.__weeklyReviewBound = true;
        weeklySummaryInput.addEventListener('input', (e) => {
          const summaryValue = e.target.value;
          ctx.form.setFieldValue('summary', summaryValue);
          
          const currentNextPlanValue = nextWeekPlanInput ? nextWeekPlanInput.value : '';
          checkAndUpdateStatus(summaryValue, currentNextPlanValue);
          updateBottomTip(summaryValue, currentNextPlanValue);
          
          const currentRecordId = element.dataset.recordId;
          if (currentRecordId) {
            debouncedSave(currentRecordId, { summary: summaryValue });
          }
        });
      }
      
      // 下周计划输入
      if (nextWeekPlanInput && !nextWeekPlanInput.__weeklyReviewBound) {
        nextWeekPlanInput.__weeklyReviewBound = true;
        nextWeekPlanInput.addEventListener('input', (e) => {
          const nextPlanValue = e.target.value;
          
          const currentSummaryValue = weeklySummaryInput ? weeklySummaryInput.value : '';
          checkAndUpdateStatus(currentSummaryValue, nextPlanValue);
          updateBottomTip(currentSummaryValue, nextPlanValue);

          const currentNextWeekId = element.dataset.nextweekId;
          if (currentNextWeekId) {
            debouncedSaveQuick(currentNextWeekId, { plan: nextPlanValue });
          }
        });
        nextWeekPlanInput.addEventListener('blur', (e) => {
          const currentNextWeekId = element.dataset.nextweekId;
          if (currentNextWeekId) {
            saveToDatabase(currentNextWeekId, { plan: e.target.value });
          }
        });
      }
    }}
    />
  );
}

ctx.render(<WeeklyReviewAndPlanDisplay />);
