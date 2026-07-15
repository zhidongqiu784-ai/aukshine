// 全局存储当前记录数据
let currentRecordData = ctx.record;

// 保存当前记录的主键
const parentRecordKey = ctx.record?.month_country_asin || ctx.record?.id;
const parentCollectionName = ctx.collection?.name || 'weekly_asin_data';
const parentDataSourceKey = ctx.dataSource?.key || 'main';

// 封装渲染函数
function renderAsinCards() {
  const asinList = currentRecordData?.have_asin || [];

  if (!asinList || asinList.length === 0) {
    ctx.element.innerHTML = '<span style="color:#bfbfbf;font-size:12px;">暂无ASIN</span>';
    return;
  }

  const asinCards = asinList.map((asinItem, index) => {
    const asin = asinItem?.asin || 'N/A';
    const status = asinItem?.status || '无需';
    const primaryKey = asinItem?.month_country_asin;
    const asinInfoStatus = asinItem?.asin_info?.status || '';
    
    const tagText = asinInfoStatus;
    
    let cardStyle;
    
    if (status && status.includes('审核')) {
      cardStyle = { 
        bg: '#e6f4ff', 
        textColor: '#1d6bc5',
        hoverBg: '#bae0ff', 
        borderColor: '#91caff' 
      };
    } else if (status && status.includes('待')) {
      cardStyle = { 
        bg: '#fff1f0', 
        textColor: '#d02b3d',
        hoverBg: '#ffe4e1', 
        borderColor: '#ffccc7' 
      };
    } else {
      cardStyle = { 
        bg: '#f6ffed', 
        textColor: '#237804',
        hoverBg: '#d9f7be', 
        borderColor: '#b7eb8f' 
      };
    }
    
    let hoverBorderColor;
    if (status && status.includes('审核')) {
      hoverBorderColor = '#69b1ff';
    } else if (status && status.includes('待')) {
      hoverBorderColor = '#ff7875';
    } else {
      hoverBorderColor = '#95de64';
    }

    const tagHtml = asinInfoStatus ? `<span style="color: ${cardStyle.textColor}; font-weight: 500;">${tagText} - </span>` : '';

    return `
      <div 
        class="asin-card"
        data-index="${index}"
        data-primary-key="${primaryKey}"
        style="
          display: inline-flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 6px 10px;
          background: ${cardStyle.bg};
          border: 1px solid ${cardStyle.borderColor};
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s;
          min-width: 70px;
          min-height: 40px;
        "
        onmouseover="this.style.background='${cardStyle.hoverBg}';this.style.borderColor='${hoverBorderColor}';this.style.transform='translateY(-1px)';this.style.boxShadow='0 2px 6px rgba(0,0,0,0.08)';"
        onmouseout="this.style.background='${cardStyle.bg}';this.style.borderColor='${cardStyle.borderColor}';this.style.transform='translateY(0)';this.style.boxShadow='none';"
      >
        <div 
          style="
            font-size: 11px;
            font-weight: 400;
            color: ${cardStyle.textColor};
            opacity: 0.85;
            font-family: '-apple-system', 'BlinkMacSystemFont', serif;
            text-align: center;
            line-height: 1.2;
            display: flex;
            align-items: center;
            justify-content: center;
          "
        >${tagHtml}${status}</div>
        <div 
          style="
            font-size: 13px;
            font-weight: 500;
            color: ${cardStyle.textColor};
            font-family: '-apple-system', 'BlinkMacSystemFont', serif;
            text-align: center;
            line-height: 1.2;
          "
        >${asin}</div>
      </div>
    `;
  }).join('');

  ctx.element.innerHTML = `
    <div style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;padding:2px;">
      ${asinCards}
    </div>
  `;

  ctx.element.querySelectorAll('.asin-card').forEach(card => {
    card.addEventListener('click', handleCardClick);
  });
}

// 刷新数据
async function refreshData() {
  if (!parentRecordKey || !parentCollectionName) return;

  try {
    const response = await ctx.api.request({
      url: `${parentCollectionName}:get`,
      method: 'get',
      params: {
        filterByTk: parentRecordKey,
        appends: ['have_asin', 'have_asin.asin_info'],
        dataSourceKey: parentDataSourceKey
      }
    });
    
    const responseData = response?.data?.data || response?.data;
    
    if (responseData) {
      currentRecordData = responseData;
      renderAsinCards();
    }
  } catch (error) {
    console.error('刷新数据失败:', error);
    ctx.message?.error?.('刷新数据失败');
  }
}

// 点击处理
function handleCardClick(e) {
  e.preventDefault();
  
  const card = e.currentTarget;
  const primaryKey = card.dataset.primaryKey;
  const index = parseInt(card.dataset.index, 10);
  
  const asinList = currentRecordData?.have_asin || [];
  const asinItem = asinList[index];

  if (!primaryKey) return;

  const popupUid = ctx.model?.uid ? `${ctx.model.uid}-asin-detail` : `asin-detail-${primaryKey}`;
  
  ctx.openView(popupUid, {
    mode: 'drawer',
    title: `ASIN详情 - ${asinItem?.asin || 'N/A'}`,
    size: 'large',
    collectionName: 'weekly_asin_data',
    dataSourceKey: 'main',
    filterByTk: primaryKey
  });
}

// 设置事件监听
function setupEventListeners() {
  try {
    // 注意：这里需要替换为实际的表格 UID 和刷新按钮 UID
    const tableBlockUid = 'fa7f1547e49'; // 请替换为实际的表格 UID
    const refreshButtonUid = 'cda01e086ec'; // 请替换为实际的刷新按钮 UID
    
    // 监听刷新按钮
    const checkRefreshButton = setInterval(() => {
      const refreshButton = document.querySelector(`[data-uid="${refreshButtonUid}"]`);
      if (refreshButton && !refreshButton.dataset.listenerAdded) {
        refreshButton.dataset.listenerAdded = 'true';
        refreshButton.addEventListener('click', () => {
          setTimeout(() => refreshData(), 500);
        });
        clearInterval(checkRefreshButton);
      }
    }, 500);
    
    setTimeout(() => clearInterval(checkRefreshButton), 5000);
    
    // 监听表单提交
    const originalConsoleLog = console.log;
    console.log = function(...args) {
      const message = args.join(' ');
      if (message.includes('formSubmitSuccess') || message.includes('submitSettings')) {
        setTimeout(() => refreshData(), 800);
      }
      originalConsoleLog.apply(console, args);
    };
    
    // 监听数据更新请求
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);
      const clonedResponse = response.clone();
      
      try {
        await clonedResponse.json();
        if (args[0] && typeof args[0] === 'string' && 
            (args[0].includes('weekly_asin_data') || args[0].includes(':update'))) {
          setTimeout(() => refreshData(), 500);
        }
      } catch (e) {
        // 忽略非 JSON 响应
      }
      
      return response;
    };
    
    // 监听表格DOM变化
    setTimeout(() => {
      const tableElement = document.querySelector(`[data-uid="${tableBlockUid}"]`);
      if (tableElement) {
        let lastChangeTime = 0;
        const observer = new MutationObserver(() => {
          const now = Date.now();
          if (now - lastChangeTime > 500) {
            lastChangeTime = now;
            setTimeout(() => refreshData(), 300);
          }
        });
        
        observer.observe(tableElement, {
          childList: true,
          subtree: true
        });
      }
    }, 1000);
  } catch (error) {
    console.error('设置事件监听失败:', error);
  }
}

// 初始化
function initialize() {
  renderAsinCards();
  setupEventListeners();
  setTimeout(() => refreshData(), 100);
}

initialize();
