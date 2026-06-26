function MonthlyReportAndPlanDisplay() {
  const record = ctx.record || {};
  const formValues = ctx.formValues || {};

  // ===== 本月数据 (从表单读)=====
  const monthlyGoal = formValues.mian_goal || '';
  const monthlySummary = formValues.month_summary || '';
  const currentMonthNumber = record.month || '';
  const currentStatus = record.status || '';
  const currentMonthSales = record.true_sales || 0;

  // ===== 下月数据 (从表单读)=====
  const nextMonthInfo = formValues.nextmonth_info || {};
  const hasNextMonthInfo = nextMonthInfo && (nextMonthInfo.id || Object.keys(nextMonthInfo).length > 0);

  const nextMonthGoal = nextMonthInfo.mian_goal || '';
  const nextMonthTotalTargetSales = nextMonthInfo.total_target_sales || '';
  const nextMonthPrice = nextMonthInfo.price || '';
  const nextMonthTargetRank = nextMonthInfo.target_rank || '';
  const nextMonthNumber = nextMonthInfo.month || '';
  const estimatedSales = nextMonthInfo.yugusales || 0;
  const baseDailySales = nextMonthInfo.base_dailysales || 0;
  const deviationReason = nextMonthInfo.reason || '';

  // ===== 异常指标数据 =====
  const performanceData = record.performance || {};
  const cpuValue = performanceData.cpu || 0;
  const cpuThreshold = record.asin_info?.cpu_threshold || record.cpu_threshold || performanceData.cpu_threshold || 0;
  const isCpuExceedThreshold = cpuValue > cpuThreshold && cpuThreshold > 0;

  const targetCompletionRate = record.target_rate || 0;
  const currentCompletionRate = record.completion_rate || 0;
  const isCompletionRateLow = currentCompletionRate < targetCompletionRate && targetCompletionRate > 0;

  // ===== 库存风险计算 =====
  const stockInfo = record.stock_info || {};
  const totalStock = stockInfo.total || 0;
  const totalTargetSales = record.total_target_sales || 0;
  const trueSales = record.true_sales || 0;
  const targetMonthEndStock = totalStock - totalTargetSales + trueSales;
  const baseDailySalesForRisk = record.base_dailysales || 0;

  let monthsAfterThisMonth = 0;
  if (baseDailySalesForRisk > 0) {
    monthsAfterThisMonth = targetMonthEndStock / 30 / baseDailySalesForRisk;
  }

  let inventoryRisk = '正常';
  if (monthsAfterThisMonth > 2) inventoryRisk = '滞销';
  else if (monthsAfterThisMonth < 1) inventoryRisk = '断货';

  const isInventoryRiskAbnormal = inventoryRisk === '滞销' || inventoryRisk === '断货';
  const over180DaysStock = record.stock_over180 || 0;
  const isOver180DaysAbnormal = over180DaysStock > 0;

  // ===== 异常提示列表 =====
  const abnormalAlerts = [];
  if (isCpuExceedThreshold) abnormalAlerts.push(`CPU 值 (${cpuValue.toFixed(2)}) 超过阈值 (${cpuThreshold.toFixed(2)})`);
  if (isCompletionRateLow) abnormalAlerts.push(`当前完成率 (${(currentCompletionRate * 100).toFixed(1)}%) 低于目标完成率 (${(targetCompletionRate * 100).toFixed(1)}%)`);
  if (isInventoryRiskAbnormal) abnormalAlerts.push(`库存风险：${inventoryRisk}`);
  if (isOver180DaysAbnormal) abnormalAlerts.push(`超 180 天库龄库存：${over180DaysStock.toLocaleString('en-US')}件`);

  // ===== 工具函数 =====
  const cleanText = (text) => {
    if (!text) return '';
    return text
      .replace(/^\s+/g, '')
      .replace(/\s+$/g, '')
      .replace(/\n\s*\n\s*\n/g, '\n\n')
      .replace(/\n\s+\n/g, '\n\n')
      .trim();
  };

  const formatMonthDisplay = (monthString, showYear = true) => {
    if (!monthString) return '';
    const match = monthString.match(/^(\d{4})-(\d{2})$/);
    if (match) {
      const [, year, month] = match;
      return showYear ? `${year}年${parseInt(month)}月` : `${parseInt(month)}月`;
    }
    return monthString;
  };

  const calculateTargetAmount = (sales, price) => (parseFloat(sales) || 0) * (parseFloat(price) || 0);

  const calculateDeviation = (targetSales, estSales) => {
    const target = parseFloat(targetSales) || 0;
    const estimated = parseFloat(estSales) || 0;
    if (estimated === 0) return { hasDeviation: false, percentage: 0, direction: '' };
    const deviation = ((target - estimated) / estimated) * 100;
    const absDeviation = Math.abs(deviation);
    if (absDeviation > 20) {
      return { hasDeviation: true, percentage: absDeviation.toFixed(1), direction: deviation > 0 ? 'exceed' : 'below' };
    }
    return { hasDeviation: false, percentage: 0, direction: '' };
  };

  const getStatusStyle = (status) => {
    const statusMap = {
      '待填写': { background: '#fff1f0', color: '#fe5050', border: '1px solid #ffccc7' },
      '待主管审核': { background: '#e6f4ff', color: '#4989d2', border: '1px solid #91caff' },
      '已完成': { background: '#f6ffed', color: '#49912e', border: '1px solid #b7eb8f' },
    };
    return statusMap[status] || { background: '#f5f5f5', color: '#8c8c8c', border: '1px solid #d9d9d9' };
  };

  const cleanMonthlyGoal = cleanText(monthlyGoal);
  const cleanMonthlySummary = cleanText(monthlySummary);
  const cleanNextMonthGoal = cleanText(nextMonthGoal);
  const currentMonthDisplay = formatMonthDisplay(currentMonthNumber);
  const nextMonthDisplay = formatMonthDisplay(nextMonthNumber, false);
  const calculatedAmount = calculateTargetAmount(nextMonthTotalTargetSales, nextMonthPrice);
  const deviationInfo = calculateDeviation(nextMonthTotalTargetSales, estimatedSales);

  // ===== 异常提示 HTML =====
  const abnormalAlertsHTML = abnormalAlerts.length > 0 ? `
    <div style="margin-bottom:12px;padding:12px;background:#fff2f0;border:1px solid #ffccc7;border-radius:8px;">
      <div style="font-size:13px;font-weight:600;color:#ff4d4f;margin-bottom:8px;display:flex;align-items:center;gap:4px;">
        <span style="font-size:16px;">⚠️</span>
        <span>以下指标异常，请重点复盘：</span>
      </div>
      <ul style="margin:0;padding-left:20px;color:#ff4d4f;font-size:13px;line-height:1.8;">
        ${abnormalAlerts.map(alert => `<li>${alert}</li>`).join('')}
      </ul>
    </div>
  ` : '';

  // ===== HTML 区块构建 =====
  const readOnlySection = hasNextMonthInfo ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:#595959;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span style="width:4px;height:14px;background:#52c41a;border-radius:2px;"></span>
        本月核心目标${currentMonthDisplay ? `（${currentMonthDisplay}）` : ''}
      </div>
      <div style="padding:12px;background:white;border:none;border-radius:8px;min-height:80px;color:#262626;line-height:1.6;white-space:pre-wrap;word-break:break-word;">
        ${cleanMonthlyGoal || '暂无本月核心目标'}
      </div>
    </div>
  ` : `
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:#595959;margin-bottom:8px;display:flex;align-items:center;gap:6px;">
        <span style="width:4px;height:14px;background:#52c41a;border-radius:2px;"></span>
        本月核心目标${currentMonthDisplay ? `（${currentMonthDisplay}）` : ''}
      </div>
      <textarea id="monthlyGoalInput" style="width:100%;min-height:300px;padding:12px;border:1px solid #d9d9d9;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#262626;resize:vertical;box-sizing:border-box;" placeholder="请输入本月核心目标...">${cleanMonthlyGoal || ''}</textarea>
    </div>
  `;

  const editableSection = hasNextMonthInfo ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:#595959;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <span style="width:4px;height:14px;background:#fa8c16;border-radius:2px;"></span>
        本月复盘${currentMonthDisplay ? `（${currentMonthDisplay}）` : ''}
      </div>
      ${abnormalAlertsHTML}
      <textarea id="monthlySummaryInput" style="width:100%;min-height:120px;padding:12px;border:1px solid #d9d9d9;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#262626;resize:vertical;box-sizing:border-box;" placeholder="请输入本月复盘内容...">${cleanMonthlySummary || ''}</textarea>
    </div>
  ` : '';

  const statusStyle = getStatusStyle(currentStatus);
  const nextMonthTitleSection = hasNextMonthInfo ? `
    <div style="padding-top:24px;border-top:2px solid #f0f0f0;margin:50px 0 24px 0;">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:24px;">
        <div style="font-size:20px;font-weight:bold;color:#625c5a;">下月计划</div>
        <div id="statusBadge" style="display:inline-block;padding:6px 16px;border-radius:4px;font-size:14px;font-weight:500;background:${statusStyle.background};color:${statusStyle.color};border:${statusStyle.border};">
          ${currentStatus || '待填写'}
        </div>
      </div>
      <div id="missingFieldsContainer" style="display:flex;align-items:center;justify-content:center;gap:8px;flex-wrap:wrap;margin-bottom:16px;"></div>
    </div>
  ` : '';

  const referenceInfoSection = hasNextMonthInfo ? `
    <div style="margin-bottom:24px;">
      <div style="font-size:14px;font-weight:600;color:#595959;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <span style="width:4px;height:14px;background:#13c2c2;border-radius:2px;"></span>
        参考信息
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;padding:12px;background:#fafafa;border-radius:8px;">
        <div>
          <div style="font-size:12px;color:#8c8c8c;margin-bottom:4px;">本月销量</div>
          <div style="font-size:16px;font-weight:600;color:#262626;">${currentMonthSales.toLocaleString('en-US')}</div>
        </div>
        <div>
          <div style="font-size:12px;color:#8c8c8c;margin-bottom:4px;">水位表预估销量</div>
          <div style="font-size:16px;font-weight:600;color:#262626;">${estimatedSales.toLocaleString('en-US')}</div>
        </div>
        <div>
          <div style="font-size:12px;color:#8c8c8c;margin-bottom:4px;">当前基准日均销量</div>
          <div style="font-size:16px;font-weight:600;color:#262626;">${baseDailySales.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
        </div>
      </div>
    </div>
  ` : '';

  const nextMonthSection = hasNextMonthInfo ? `
    <div style="margin-bottom:16px;">
      <div style="font-size:14px;font-weight:600;color:#595959;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <span style="width:4px;height:14px;background:#722ed1;border-radius:2px;"></span>
        下月核心目标${nextMonthDisplay ? `（${nextMonthDisplay}）` : ''}
      </div>
      <textarea id="nextMonthGoalInput" style="width:100%;min-height:100px;padding:12px;border:1px solid #d9d9d9;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#262626;resize:vertical;box-sizing:border-box;" placeholder="请输入下月核心目标...">${cleanNextMonthGoal || ''}</textarea>
    </div>
    <div style="margin-bottom:16px;display:flex;gap:12px;flex-wrap:wrap;">
      <div style="flex:1;min-width:200px;">
        <div style="font-size:13px;font-weight:600;color:#595959;margin-bottom:8px;">下月目标销量</div>
        <input type="number" id="totalTargetSalesInput" style="width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#262626;box-sizing:border-box;" placeholder="请输入目标销量" value="${nextMonthTotalTargetSales}" />
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="font-size:13px;font-weight:600;color:#595959;margin-bottom:8px;">下月折扣价 (当地币种)</div>
        <input type="number" id="priceInput" step="0.01" style="width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#262626;box-sizing:border-box;" placeholder="请输入折扣价" value="${nextMonthPrice}" />
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="font-size:13px;font-weight:600;color:#595959;margin-bottom:8px;">下月小类排名目标</div>
        <input type="number" id="targetRankInput" style="width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#262626;box-sizing:border-box;" placeholder="请输入排名目标" value="${nextMonthTargetRank}" />
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="font-size:13px;font-weight:600;color:#595959;margin-bottom:8px;">下月目标销售额 (当地币种)</div>
        <input type="number" id="targetMonthlyAmountInput" step="0.01" readonly style="width:100%;padding:8px 12px;border:1px solid #d9d9d9;border-radius:6px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;color:#262626;background-color:#f5f5f5;cursor:not-allowed;box-sizing:border-box;" placeholder="自动计算" value="${calculatedAmount.toFixed(2)}" />
      </div>
    </div>
  ` : '';

  const deviationReasonSection = hasNextMonthInfo ? `
    <div id="deviationReasonContainer" style="margin-bottom:24px;display:${deviationInfo.hasDeviation ? 'block' : 'none'};">
      <div style="font-size:14px;font-weight:600;color:#595959;margin-bottom:12px;display:flex;align-items:center;gap:6px;">
        <span style="width:4px;height:14px;background:#fa8c16;border-radius:2px;"></span>
        <span id="deviationReasonTitle">${
          deviationInfo.direction === 'exceed'
            ? `超出水位表预估${deviationInfo.percentage}%的原因`
            : `低于水位表预估${deviationInfo.percentage}%的原因`
        }</span>
      </div>
      <textarea id="deviationReasonInput" style="width:100%;min-height:80px;padding:12px;border:1px solid #d9d9d9;border-radius:8px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:14px;line-height:1.6;color:#262626;resize:vertical;box-sizing:border-box;" placeholder="请说明原因...">${deviationReason || ''}</textarea>
    </div>
  ` : '';

  const fullHTML = readOnlySection + editableSection + nextMonthTitleSection + referenceInfoSection + nextMonthSection + deviationReasonSection;

  return (
    <div
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        lineHeight: 1.6,
        color: '#262626',
        padding: '20px',
        background: 'white',
        border: '1px solid #d9d9d9',
        borderRadius: '12px',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
      }}
      ref={(element) => {
        if (!element) {
          ctx.element._initialized = false;
          return;
        }

        // innerHTML 只在首次写入
        if (!ctx.element._initialized) {
          element.innerHTML = fullHTML;
        }

        if (ctx.element._initialized) return;
        ctx.element._initialized = true;

        // ===== 防抖工具 =====
        const debounce = (fn, delay) => {
          let timer = null;
          return (...args) => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
          };
        };

        // ===== 获取 DOM 元素 =====
        const monthlySummaryInput = element.querySelector('#monthlySummaryInput');
        const nextMonthGoalInput = element.querySelector('#nextMonthGoalInput');
        const totalTargetSalesInput = element.querySelector('#totalTargetSalesInput');
        const priceInput = element.querySelector('#priceInput');
        const targetRankInput = element.querySelector('#targetRankInput');
        const targetMonthlyAmountInput = element.querySelector('#targetMonthlyAmountInput');
        const deviationReasonInput = element.querySelector('#deviationReasonInput');
        const statusBadge = element.querySelector('#statusBadge');
        const missingFieldsContainer = element.querySelector('#missingFieldsContainer');
        const deviationReasonContainer = element.querySelector('#deviationReasonContainer');
        const deviationReasonTitle = element.querySelector('#deviationReasonTitle');

        // ===== hasNextMonthInfo 不存在时：只同步本月核心目标 =====
        const monthlyGoalInput = element.querySelector('#monthlyGoalInput');
        if (!hasNextMonthInfo) {
          if (monthlyGoalInput) {
            const debouncedSyncGoal = debounce((val) => {
              ctx.form.setFieldValue('mian_goal', val);
            }, 300);
            monthlyGoalInput.addEventListener('input', (e) => {
              debouncedSyncGoal(e.target.value);
            });
          }
          return;
        }

        // ===== 以下仅 hasNextMonthInfo 存在时执行 =====

        // ===== 各字段防抖同步到表单 =====
        const debouncedSyncSummary = debounce((val) => {
          ctx.form.setFieldValue('month_summary', val);
        }, 300);

        const debouncedSyncNextGoal = debounce((val) => {
          const cur = ctx.form.getFieldValue('nextmonth_info') || {};
          ctx.form.setFieldValue('nextmonth_info', { ...cur, mian_goal: val });
        }, 300);

        const debouncedSyncTotalSales = debounce((val) => {
          const cur = ctx.form.getFieldValue('nextmonth_info') || {};
          ctx.form.setFieldValue('nextmonth_info', { ...cur, total_target_sales: val });
        }, 300);

        const debouncedSyncPrice = debounce((val) => {
          const cur = ctx.form.getFieldValue('nextmonth_info') || {};
          ctx.form.setFieldValue('nextmonth_info', { ...cur, price: val });
        }, 300);

        const debouncedSyncRank = debounce((val) => {
          const cur = ctx.form.getFieldValue('nextmonth_info') || {};
          ctx.form.setFieldValue('nextmonth_info', { ...cur, target_rank: val });
        }, 300);

        const debouncedSyncReason = debounce((val) => {
          const cur = ctx.form.getFieldValue('nextmonth_info') || {};
          ctx.form.setFieldValue('nextmonth_info', { ...cur, reason: val });
        }, 300);

        const debouncedSyncTargetAmount = debounce((val) => {
          const cur = ctx.form.getFieldValue('nextmonth_info') || {};
          ctx.form.setFieldValue('nextmonth_info', { ...cur, target_monthly_amount: val });
        }, 300);

        // ===== 偏差显示更新 =====
        const updateDeviationDisplay = () => {
          const targetSales = totalTargetSalesInput ? parseFloat(totalTargetSalesInput.value) || 0 : 0;
          const deviation = calculateDeviation(targetSales, parseFloat(estimatedSales) || 0);
          if (deviationReasonContainer) {
            deviationReasonContainer.style.display = deviation.hasDeviation ? 'block' : 'none';
          }
          if (deviation.hasDeviation && deviationReasonTitle) {
            deviationReasonTitle.textContent = deviation.direction === 'exceed'
              ? `超出水位表预估${deviation.percentage}%的原因`
              : `低于水位表预估${deviation.percentage}%的原因`;
          }
          return deviation;
        };

        // ===== 字段完整性检查 =====
        const checkFieldsCompleteness = () => {
          const missingFields = [];
          if (!monthlySummaryInput || !monthlySummaryInput.value.trim()) missingFields.push('本月复盘');
          if (!nextMonthGoalInput || !nextMonthGoalInput.value.trim()) missingFields.push('下月核心目标');
          if (!totalTargetSalesInput || !totalTargetSalesInput.value) missingFields.push('下月目标销量');
          if (!priceInput || !priceInput.value) missingFields.push('下月折扣价');
          if (!targetRankInput || !targetRankInput.value) missingFields.push('下月小类排名目标');
          if (!targetMonthlyAmountInput || !targetMonthlyAmountInput.value || parseFloat(targetMonthlyAmountInput.value) === 0) missingFields.push('下月目标销售额');
          const isDeviationVisible = deviationReasonContainer && deviationReasonContainer.style.display !== 'none';
          if (isDeviationVisible && (!deviationReasonInput || !deviationReasonInput.value.trim())) missingFields.push('偏差原因说明');
          return missingFields;
        };

        // ===== 状态显示更新 =====
        const updateStatusDisplay = () => {
          updateDeviationDisplay();
          const missingFields = checkFieldsCompleteness();
          const newStatus = missingFields.length === 0 ? '待主管审核' : '待填写';
          const style = getStatusStyle(newStatus);
          if (statusBadge) {
            statusBadge.textContent = newStatus;
            statusBadge.style.background = style.background;
            statusBadge.style.color = style.color;
            statusBadge.style.border = style.border;
          }
          if (missingFieldsContainer) {
            if (missingFields.length === 0) {
              missingFieldsContainer.innerHTML = '';
            } else {
              missingFieldsContainer.innerHTML = `
                <span style="font-size:13px;color:#fa8c16;font-weight:500;">未填写：</span>
                ${missingFields.map(field => `<span style="display:inline-block;padding:4px 8px;background:#fff7e6;border:1px solid #ffd591;border-radius:4px;font-size:12px;color:#fa8c16;">${field}</span>`).join('')}
              `;
            }
          }
          
          // 🔥 关键修复：同步更新表单的 status 字段值
          ctx.form.setFieldValue('status', newStatus);
        };

        // ===== 目标销售额实时计算 =====
        const updateTargetAmount = () => {
          const sales = totalTargetSalesInput ? parseFloat(totalTargetSalesInput.value) || 0 : 0;
          const price = priceInput ? parseFloat(priceInput.value) || 0 : 0;
          const amount = sales * price;
          if (targetMonthlyAmountInput) targetMonthlyAmountInput.value = amount.toFixed(2);
          debouncedSyncTargetAmount(amount);
          updateStatusDisplay();
        };

        // ===== 事件监听 =====
        if (monthlySummaryInput) {
          monthlySummaryInput.addEventListener('input', () => {
            updateStatusDisplay();
            debouncedSyncSummary(monthlySummaryInput.value);
          });
        }
        if (nextMonthGoalInput) {
          nextMonthGoalInput.addEventListener('input', () => {
            updateStatusDisplay();
            debouncedSyncNextGoal(nextMonthGoalInput.value);
          });
        }
        if (totalTargetSalesInput) {
          totalTargetSalesInput.addEventListener('input', () => {
            updateTargetAmount();
            debouncedSyncTotalSales(totalTargetSalesInput.value ? parseFloat(totalTargetSalesInput.value) : null);
          });
        }
        if (priceInput) {
          priceInput.addEventListener('input', () => {
            updateTargetAmount();
            debouncedSyncPrice(priceInput.value ? parseFloat(priceInput.value) : null);
          });
        }
        if (targetRankInput) {
          targetRankInput.addEventListener('input', () => {
            updateStatusDisplay();
            debouncedSyncRank(targetRankInput.value ? parseInt(targetRankInput.value) : null);
          });
        }
        if (deviationReasonInput) {
          deviationReasonInput.addEventListener('input', () => {
            updateStatusDisplay();
            debouncedSyncReason(deviationReasonInput.value);
          });
        }

        // ===== 初始化 UI 状态 =====
        updateStatusDisplay();
      }}
    />
  );
}

ctx.render(<MonthlyReportAndPlanDisplay />);