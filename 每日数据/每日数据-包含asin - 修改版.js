const asins = ctx.record?.asin_info || [];

const validStatuses = ['重点', '普通', '新品'];

const filteredAsins = asins.filter(item =>
  validStatuses.includes(item.status) &&
  String(item.maintenance_level ?? '').trim() !== '变体'
);

if (!filteredAsins.length) {
  ctx.element.innerHTML = '<span style="color:#bfbfbf;font-size:12px;">无ASIN</span>';
  return;
}

// 父记录字段
const model = ctx.record?.model || '';
const sale_owner = ctx.record?.sale_owner || '';

// status 对应颜色
const statusColorMap = {
  '重点': '#722ed1',
  '新品': '#d46b08',
  '普通': '#597ef7',
};

ctx.element.innerHTML = `
  <div style="display:flex;gap:6px;flex-wrap:wrap;">
    ${filteredAsins.map((item, idx) => `
      <span
        class="asin-tag"
        data-index="${idx}"
        style="
          display:inline-flex;
          align-items:center;
          gap:4px;
          padding:2px 8px;
          background:#fafafa;
          border:1px solid #d9d9d9;
          border-radius:4px;
          cursor:pointer;
          transition:all 0.2s;
          font-size:12px;
        "
        onmouseover="this.style.background='#f0f5ff';this.style.borderColor='#91caff'"
        onmouseout="this.style.background='#fafafa';this.style.borderColor='#d9d9d9'"
      >
        <span style="color:#595959;">${item.country || 'N/A'}</span>
        <span style="color:#bfbfbf;">|</span>
        <span style="color:#1677ff;font-weight:500;">${item.asin || 'N/A'}</span>
        <span style="color:#bfbfbf;">|</span>
        <span style="color:${statusColorMap[item.status] || '#333'};font-size:11px;">${item.status || 'N/A'}</span>
      </span>
    `).join('')}
  </div>
`;

const encode = (v) => encodeURIComponent(v ?? '');

ctx.element.querySelectorAll('.asin-tag').forEach(tag => {
  const idx = parseInt(tag.dataset.index);
  const asinItem = filteredAsins[idx];

  tag.addEventListener('click', () => {
    const qs = [
      `model=${encode(model)}`,
      `country=${encode(asinItem.country || '')}`,
      `asin=${encode(asinItem.asin || '')}`,
      `sale_owner=${encode(sale_owner)}`,
      `status=${encode(asinItem.status || '')}`,
    ].join('&');

    const url = `/admin/d7djduic5ca?${qs}`;
    window.open(url, '_blank');
  });
});
