/* ============================================================
   صفحه گزارش سود و زیان
   ============================================================ */

import { profitLoss, compareWithPrevious } from '../services/reportService.js';
import { getSettings } from '../core/settings.js';
import { icon, toast, fieldDate, emptyState, buildTable } from '../ui/components.js';
import { fmtMoney, fmtPercent, fmtDate, toFa, escapeHtml, todayJalali, currentJalaliMonth, downloadBlob, toEn, addDaysJalali, daysInMonth } from '../core/utils.js';

export const path = 'profitloss';
export const title = 'گزارش سود و زیان';
export const iconKey = 'chart';

let range = null;

export async function render(root) {
  const m = currentJalaliMonth();
  range = range || { from: m.from, to: m.to };

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>گزارش سود و زیان</h2>
        <div class="spacer"></div>
        <div class="flex" style="gap:8px;flex-wrap:wrap">
          <input class="input" id="r-from" dir="ltr" style="width:130px;min-height:38px" value="${toFa(range.from)}" placeholder="1405-01-01" />
          <span class="text-muted">تا</span>
          <input class="input" id="r-to" dir="ltr" style="width:130px;min-height:38px" value="${toFa(range.to)}" placeholder="1405-12-29" />
          <button class="btn btn-primary btn-sm" id="r-apply" type="button">نمایش</button>
          <button class="btn btn-outline btn-sm" id="r-month" type="button">ماه جاری</button>
          <button class="btn btn-outline btn-sm" id="r-excel" type="button">${icon('excel')} اکسل</button>
          <button class="btn btn-outline btn-sm" id="r-pdf" type="button">${icon('pdf')} PDF</button>
        </div>
      </div>

      <div class="flex flex-wrap mb-16" style="gap:7px">
        <span class="text-sm text-muted">بازه سریع:</span>
        <button class="chip" data-preset="today" type="button">امروز</button>
        <button class="chip" data-preset="7" type="button">۷ روز اخیر</button>
        <button class="chip" data-preset="30" type="button">۳۰ روز اخیر</button>
        <button class="chip" data-preset="month" type="button">ماه جاری</button>
        <button class="chip" data-preset="year" type="button">سال جاری</button>
      </div>

      <div id="report-area"><div class="empty-state"><p>در حال محاسبه…</p></div></div>
    </div>`;

  root.querySelector('#r-apply').addEventListener('click', () => {
    const from = toEn(root.querySelector('#r-from').value).trim();
    const to = toEn(root.querySelector('#r-to').value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      toast('تاریخ‌ها را با قالب 1405-08-03 وارد کنید', 'warn');
      return;
    }
    range = { from, to };
    load();
  });
  root.querySelector('#r-month').addEventListener('click', () => {
    const mm = currentJalaliMonth();
    range = { from: mm.from, to: mm.to };
    root.querySelector('#r-from').value = toFa(range.from);
    root.querySelector('#r-to').value = toFa(range.to);
    load();
  });

  // بازه‌های سریع
  root.querySelectorAll('[data-preset]').forEach((b) => b.addEventListener('click', () => {
    const kind = b.dataset.preset;
    const today = todayJalali();
    if (kind === 'today') range = { from: today, to: today };
    else if (kind === '7') range = { from: addDaysJalali(today, -6), to: today };
    else if (kind === '30') range = { from: addDaysJalali(today, -29), to: today };
    else if (kind === 'month') { const m = currentJalaliMonth(); range = { from: m.from, to: m.to }; }
    else if (kind === 'year') {
      const m = currentJalaliMonth();
      const last = daysInMonth(m.jy, 12);
      range = { from: `${m.jy}-01-01`, to: `${m.jy}-12-${String(last).padStart(2, '0')}` };
    }
    root.querySelector('#r-from').value = toFa(range.from);
    root.querySelector('#r-to').value = toFa(range.to);
    root.querySelectorAll('[data-preset]').forEach((x) => x.classList.toggle('active', x === b));
    load();
  }));
  root.querySelector('#r-excel').addEventListener('click', exportExcel);
  root.querySelector('#r-pdf').addEventListener('click', exportPdf);

  await load();
}

let lastData = null;
let lastCmp = null;

async function load() {
  const area = document.getElementById('report-area');
  const data = await profitLoss(range.from, range.to);
  const cmp = await compareWithPrevious(range.from, range.to);
  lastData = data;
  lastCmp = cmp;
  const p = data.profit;

  area.innerHTML = `
    <div class="export-sheet" id="pnl-sheet">
      <div class="section-head">
        <h2>سود و زیان ${escapeHtml(data.from)} تا ${escapeHtml(data.to)}</h2>
        <div class="spacer"></div>
        <span class="badge">${toFa(data.salesCount)} سند فروش</span>
      </div>

      <div class="kpi-grid">
        <div class="kpi gold"><div class="kpi-label">درآمد فروش</div><div class="kpi-value">${fmtMoney(data.revenue)}<span class="unit">تومان</span></div></div>
        <div class="kpi"><div class="kpi-label">سود ناخالص</div><div class="kpi-value ${p.gross >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(p.gross)}<span class="unit">تومان</span></div><div class="kpi-sub">حاشیه: ${fmtPercent(p.grossMargin)}</div></div>
        <div class="kpi ${p.net >= 0 ? 'good' : 'bad'}"><div class="kpi-label">سود خالص</div><div class="kpi-value">${fmtMoney(p.net)}<span class="unit">تومان</span></div><div class="kpi-sub">حاشیه: ${fmtPercent(p.netMargin)}</div></div>
      </div>

      ${renderComparison(cmp)}

      <div class="grid-2">
        <div class="card">
          <div class="card-title">محاسبه سود</div>
          <div class="summary-rows">
            <div class="s-row"><span class="label">جمع فروش (بدون تخفیف)</span><span class="mono-num">${fmtMoney(data.grossSales)}</span></div>
            <div class="s-row"><span class="label">تخفیفات</span><span class="mono-num text-danger">−${fmtMoney(data.discount)}</span></div>
            <div class="s-row sub"><span class="label">درآمد خالص فروش</span><span class="mono-num">${fmtMoney(data.revenue)}</span></div>
            <div class="s-row"><span class="label">بهای تمام‌شده کالای فروخته‌شده</span><span class="mono-num text-danger">−${fmtMoney(data.cogs)}</span></div>
            <div class="s-row pos"><span class="label"><b>سود ناخالص</b></span><span class="mono-num"><b>${fmtMoney(p.gross)}</b></span></div>
            <div class="s-row"><span class="label">ضایعات انبار</span><span class="mono-num text-danger">−${fmtMoney(data.waste)}</span></div>
            <div class="s-row"><span class="label">مجموع هزینه‌ها (${toFa(data.expensesByCategory.length)} دسته)</span><span class="mono-num text-danger">−${fmtMoney(data.expensesTotal)}</span></div>
            <div class="s-row total"><span class="label">سود خالص</span><span class="mono-num">${fmtMoney(p.net)}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">ترکیب پرداخت خریداران</div>
          <div class="summary-rows">
            <div class="s-row"><span class="label">نقدی</span><span class="mono-num">${fmtMoney(data.payments.cash)}</span></div>
            <div class="s-row"><span class="label">کارت‌خوان</span><span class="mono-num">${fmtMoney(data.payments.card)}</span></div>
            <div class="s-row"><span class="label">نسیه (دریافت‌نشده)</span><span class="mono-num">${fmtMoney(data.payments.credit)}</span></div>
            <div class="s-row sub"><span class="label">جمع</span><span class="mono-num">${fmtMoney(data.revenue)}</span></div>
          </div>
          <div class="card-title mt-16">گردش نقدی بازه</div>
          <div class="summary-rows">
            <div class="s-row pos"><span class="label">ورودی صندوق</span><span class="mono-num">${fmtMoney(data.cashflow.in)}</span></div>
            <div class="s-row neg"><span class="label">خروجی صندوق</span><span class="mono-num">${fmtMoney(data.cashflow.out)}</span></div>
            <div class="s-row"><span class="label">خالص گردش</span><span class="mono-num"><b>${fmtMoney(data.cashflow.net)}</b></span></div>
          </div>
        </div>
      </div>

      <div class="grid-2 mt-16">
        <div class="card">
          <div class="card-title">هزینه‌ها به تفکیک</div>
          ${data.expensesByCategory.length ? `
            <table class="data" style="min-width:0">
              <thead><tr><th>دسته</th><th class="num">مبلغ</th><th class="num">سهم</th></tr></thead>
              <tbody>
                ${data.expensesByCategory.map((c) => `
                  <tr>
                    <td>${escapeHtml(c.name)}</td>
                    <td class="num">${fmtMoney(c.amount)}</td>
                    <td class="num">${fmtPercent(data.expensesTotal ? (c.amount / data.expensesTotal) * 100 : 0, 0)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` : '<div class="text-muted text-sm">هزینه‌ای در این بازه ثبت نشده</div>'}
        </div>
        <div class="card">
          <div class="card-title">روند ۶ ماه اخیر (سود خالص)</div>
          <div class="chart-box sm"><canvas id="ch-trend"></canvas></div>
        </div>
      </div>
    </div>`;

  drawTrend(data.trend);
}

/**
 * کارت مقایسه با بازه قبلی هم‌طول
 * good=true یعنی افزایش خوب است (درآمد/سود)؛ false یعنی کاهش خوب (هزینه/ضایعات)
 */
function renderComparison(cmp) {
  const rows = [
    { label: 'درآمد فروش', key: 'revenue', money: true, good: true },
    { label: 'سود ناخالص', key: 'gross', money: true, good: true },
    { label: 'سود خالص', key: 'net', money: true, good: true },
    { label: 'تعداد فروش', key: 'salesCount', money: false, good: true },
    { label: 'مجموع هزینه‌ها', key: 'expenses', money: true, good: false },
    { label: 'ضایعات انبار', key: 'waste', money: true, good: false },
  ];
  const cell = (v, money) => (money ? `${fmtMoney(v)} <span style="color:#888;font-size:11px">تومان</span>` : toFa(v));
  const deltaHtml = (cur, prev, good) => {
    const diff = cur - prev;
    if (prev === 0) {
      if (cur === 0) return '<span class="text-muted">بدون تغییر</span>';
      return `<span class="${good ? 'text-success' : 'text-danger'}">${good ? '↑' : '↓'} جدید</span>`;
    }
    const pct = (diff / Math.abs(prev)) * 100;
    const up = diff > 0;
    const neutral = diff === 0;
    const cls = neutral ? 'text-muted' : ((up === good) ? 'text-success' : 'text-danger');
    const arrow = neutral ? '→' : (up ? '↑' : '↓');
    const sign = up ? '+' : '−';
    return `<span class="${cls}"><b>${arrow} ${fmtPercent(Math.abs(pct), 0)}</b></span>
      <span style="color:#999;font-size:11px" dir="ltr">(${sign}${fmtMoney(Math.abs(diff))})</span>`;
  };
  return `
    <div class="card mt-16" id="compare-card">
      <div class="card-title">مقایسه با بازه قبلی (${toFa(cmp.days)} روز)</div>
      <div class="text-muted text-sm" style="margin-bottom:10px">
        بازه فعلی ${fmtDate(cmp.from)} تا ${fmtDate(cmp.to)} &nbsp;در برابر&nbsp; بازه قبلی ${fmtDate(cmp.prevFrom)} تا ${fmtDate(cmp.prevTo)}
      </div>
      <table class="data" style="min-width:0">
        <thead>
          <tr>
            <th>شاخص</th>
            <th class="num">بازه فعلی</th>
            <th class="num">بازه قبلی</th>
            <th class="num">تغییر</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((r) => `
            <tr>
              <td>${r.label}</td>
              <td class="num">${cell(cmp.curr[r.key], r.money)}</td>
              <td class="num">${cell(cmp.prev[r.key], r.money)}</td>
              <td class="num">${deltaHtml(cmp.curr[r.key], cmp.prev[r.key], r.good)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
}

function drawTrend(trend) {
  const Chart = window.Chart;
  if (!Chart || !document.getElementById('ch-trend')) return;
  const cs = getComputedStyle(document.documentElement);
  const gold = cs.getPropertyValue('--gold-500').trim() || '#d4a017';
  const green = cs.getPropertyValue('--green-700').trim() || '#14503d';
  const grid = cs.getPropertyValue('--chart-grid').trim() || '#eee';
  const text = cs.getPropertyValue('--chart-text').trim() || '#666';
  Chart.defaults.font.family = "'Vazirmatn', Tahoma, sans-serif";
  Chart.defaults.color = text;

  new Chart(document.getElementById('ch-trend'), {
    type: 'line',
    data: {
      labels: trend.map((t) => t.label),
      datasets: [
        { label: 'درآمد', data: trend.map((t) => t.revenue), borderColor: green, backgroundColor: 'transparent', tension: 0.35, borderWidth: 2 },
        { label: 'سود خالص', data: trend.map((t) => t.net), borderColor: gold, backgroundColor: 'transparent', tension: 0.35, borderWidth: 2 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { rtl: true, position: 'bottom' }, tooltip: { rtl: true } },
      scales: {
        x: { grid: { display: false } },
        y: { grid: { color: grid }, ticks: { callback: (v) => toFa(Number(v).toLocaleString('en-US')) } },
      },
    },
  });
}

function exportExcel() {
  if (!lastData) return;
  import('../core/exporters.js').then(({ exportTableExcel }) => {
    const d = lastData;
    exportTableExcel(`profit-loss-${d.from}-${d.to}`, 'سود و زیان', [
      { key: 'item', label: 'شرح' },
      { key: 'value', label: 'مبلغ (تومان)' },
    ], [
      { item: 'جمع فروش', value: d.grossSales },
      { item: 'تخفیفات', value: -d.discount },
      { item: 'درآمد خالص فروش', value: d.revenue },
      { item: 'بهای تمام‌شده', value: -d.cogs },
      { item: 'سود ناخالص', value: d.profit.gross },
      { item: 'ضایعات', value: -d.waste },
      { item: 'مجموع هزینه‌ها', value: -d.expensesTotal },
      { item: 'سود خالص', value: d.profit.net },
      ...d.expensesByCategory.map((c) => ({ item: `هزینه: ${c.name}`, value: -c.amount })),
      { item: 'نقدی دریافتی', value: d.payments.cash },
      { item: 'کارت‌خوان', value: d.payments.card },
      { item: 'نسیه', value: d.payments.credit },
      ...(lastCmp ? [
        { item: `بازه قبلی (${lastCmp.prevFrom} تا ${lastCmp.prevTo}) — درآمد`, value: lastCmp.prev.revenue },
        { item: 'بازه قبلی — سود ناخالص', value: lastCmp.prev.gross },
        { item: 'بازه قبلی — سود خالص', value: lastCmp.prev.net },
        { item: 'بازه قبلی — هزینه‌ها', value: -lastCmp.prev.expenses },
      ] : []),
    ]);
    toast('فایل اکسل ساخته شد');
  });
}

async function exportPdf() {
  if (!lastData) return;
  try {
    const { exportReportPdf } = await import('../core/exporters.js');
    toast('در حال ساخت PDF…', 'info', 2500);
    const d = lastData;
    const cmp = lastCmp;
    const s = getSettings();
    const money = (n) => fmtMoney(n);
    const deltaCell = (cur, prev) => {
      if (!prev) return cur ? 'جدید' : '۰';
      const diff = cur - prev;
      const pct = (diff / Math.abs(prev)) * 100;
      return `${diff >= 0 ? '+' : '−'}${fmtPercent(Math.abs(pct), 0)} (${diff >= 0 ? '+' : '−'}${money(Math.abs(diff))})`;
    };

    const blocks = [
      { type: 'kpis', items: [
        { label: 'درآمد فروش', value: `${money(d.revenue)} تومان` },
        { label: 'سود ناخالص', value: `${money(d.profit.gross)} تومان` },
        { label: 'سود خالص', value: `${money(d.profit.net)} تومان` },
      ] },
      { type: 'table', title: 'محاسبه سود', columns: [{ label: 'شرح' }, { label: 'مبلغ (تومان)', align: 'num' }],
        rows: [
          ['جمع فروش (بدون تخفیف)', money(d.grossSales)],
          ['تخفیفات', `−${money(d.discount)}`],
          ['درآمد خالص فروش', money(d.revenue)],
          ['بهای تمام‌شده کالای فروخته‌شده', `−${money(d.cogs)}`],
          ['سود ناخالص', money(d.profit.gross)],
          ['ضایعات انبار', `−${money(d.waste)}`],
          ['مجموع هزینه‌ها', `−${money(d.expensesTotal)}`],
        ],
        totals: ['سود خالص', money(d.profit.net)] },
      ...(cmp ? [{ type: 'table', title: `مقایسه با بازه قبلی (${toFa(cmp.days)} روز: ${cmp.prevFrom} تا ${cmp.prevTo})`,
        columns: [{ label: 'شاخص' }, { label: 'بازه فعلی', align: 'num' }, { label: 'بازه قبلی', align: 'num' }, { label: 'تغییر', align: 'num' }],
        rows: [
          ['درآمد فروش', money(cmp.curr.revenue), money(cmp.prev.revenue), deltaCell(cmp.curr.revenue, cmp.prev.revenue)],
          ['سود ناخالص', money(cmp.curr.gross), money(cmp.prev.gross), deltaCell(cmp.curr.gross, cmp.prev.gross)],
          ['سود خالص', money(cmp.curr.net), money(cmp.prev.net), deltaCell(cmp.curr.net, cmp.prev.net)],
          ['تعداد فروش', toFa(cmp.curr.salesCount), toFa(cmp.prev.salesCount), deltaCell(cmp.curr.salesCount, cmp.prev.salesCount)],
          ['مجموع هزینه‌ها', money(cmp.curr.expenses), money(cmp.prev.expenses), deltaCell(cmp.curr.expenses, cmp.prev.expenses)],
          ['ضایعات انبار', money(cmp.curr.waste), money(cmp.prev.waste), deltaCell(cmp.curr.waste, cmp.prev.waste)],
        ] }] : []),
      { type: 'table', title: 'هزینه‌ها به تفکیک', columns: [{ label: 'دسته' }, { label: 'مبلغ (تومان)', align: 'num' }],
        rows: d.expensesByCategory.length
          ? d.expensesByCategory.map((c) => [c.name, money(c.amount)])
          : [['هزینه‌ای در این بازه ثبت نشده', '—']],
        totals: ['جمع هزینه‌ها', money(d.expensesTotal)] },
      { type: 'table', title: 'ترکیب پرداخت خریداران', columns: [{ label: 'شیوه' }, { label: 'مبلغ (تومان)', align: 'num' }],
        rows: [
          ['نقدی', money(d.payments.cash)],
          ['کارت‌خوان', money(d.payments.card)],
          ['نسیه (دریافت‌نشده)', money(d.payments.credit)],
        ],
        totals: ['جمع', money(d.revenue)] },
      { type: 'table', title: 'گردش نقدی بازه', columns: [{ label: 'ردیف' }, { label: 'مبلغ (تومان)', align: 'num' }],
        rows: [
          ['ورودی صندوق', money(d.cashflow.in)],
          ['خروجی صندوق', `−${money(d.cashflow.out)}`],
        ],
        totals: ['خالص گردش', money(d.cashflow.net)] },
      { type: 'note', text: `تعداد اسناد فروش: ${toFa(d.salesCount)} | بازه گزارش: ${d.from} تا ${d.to}` },
    ];

    await exportReportPdf({
      title: 'گزارش سود و زیان',
      subtitle: 'گزارش رسمی مالی',
      range: `${d.from} تا ${d.to}`,
      brand: s.restaurantName || 'صبحانه‌سرای آفتاب',
      logo: s.restaurantLogo || './icons/icon-192.png',
      blocks,
    }, `profit-loss-${d.from}-${d.to}.pdf`);
    toast('PDF ساخته شد');
  } catch (e) {
    toast(e.message || 'خطا در ساخت PDF', 'error');
  }
}
