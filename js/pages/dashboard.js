/* ============================================================
   صفحه داشبورد — آمار، نمودارها و هشدارها
   ============================================================ */

import { dashboardData } from '../services/reportService.js';
import { ICONS, kpiCard, emptyState, icon, toast } from '../ui/components.js';
import { fmtMoney, fmtToman, fmtDate, fmtDateLong, toFa, weekdayOf, escapeHtml, num } from '../core/utils.js';

export const path = 'dashboard';
export const title = 'داشبورد';
export const iconKey = 'dashboard';

export async function render(root) {
  root.innerHTML = `<div class="page-enter"><div class="empty-state"><p>در حال بارگذاری…</p></div></div>`;
  const d = await dashboardData();

  const goodToday = d.profitToday.net >= 0;
  const chartCards = `
    <div class="grid-2 mt-16">
      <div class="card">
        <div class="card-title">${icon('chart')} فروش ۱۴ روز اخیر</div>
        <div class="chart-box"><canvas id="ch-sales14"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">${icon('wallet')} ترکیب پرداخت امروز</div>
        <div class="chart-box"><canvas id="ch-pay"></canvas></div>
      </div>
    </div>
    <div class="card mt-16">
      <div class="card-title">${icon('menuBook')} پرفروش‌ترین غذاها (۳۰ روز اخیر)</div>
      <div class="chart-box sm"><canvas id="ch-top"></canvas></div>
    </div>`;

  const alerts = [];
  if (d.lowStock.length) {
    alerts.push(`<div class="alert warn">${icon('alert')}<div><b>کمبود موجودی:</b> ${d.lowStock.slice(0, 5).map((i) => escapeHtml(`${i.name} (${fmtMoney(i.stock)} ${escapeHtml(i.baseUnit)})`)).join('، ')}${d.lowStock.length > 5 ? ` و ${toFa(d.lowStock.length - 5)} مورد دیگر` : ''}</div></div>`);
  }
  if (d.expiring.length) {
    const expired = d.expiring.filter((e) => e.expired).length;
    alerts.push(`<div class="alert ${expired ? 'danger' : 'warn'}">${icon('alert')}<div><b>انقضای مواد:</b> ${d.expiring.slice(0, 5).map((i) => escapeHtml(`${i.name}${i.expired ? ' (منقضی)' : ` تا ${fmtDate(i.expiryDate)}`}`)).join('، ')}</div></div>`);
  }
  if (d.supplierDebt > 0) {
    alerts.push(`<div class="alert info">${icon('info')}<div><b>بدهی تأمین‌کنندگان:</b> ${fmtToman(d.supplierDebt)}</div></div>`);
  }
  if (d.creditReceivable > 0) {
    alerts.push(`<div class="alert info">${icon('info')}<div><b>طلب از مشتریان (نسیه):</b> ${fmtToman(d.creditReceivable)}</div></div>`);
  }

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>${escapeHtml(fmtDateLong(d.today))} — ${escapeHtml(weekdayOf(d.today))}</h2>
        <div class="spacer"></div>
        <button class="btn btn-gold" id="btn-new-sale" type="button">${icon('cart')} ثبت فروش سریع</button>
      </div>

      <div class="kpi-grid">
        ${kpiCard({ label: 'فروش امروز', value: fmtMoney(d.revenueToday), unit: 'تومان', iconName: 'wallet', sub: `${toFa(d.salesCountToday)} سند فروش` })}
        ${kpiCard({ label: 'سود خالص امروز', value: fmtMoney(d.profitToday.net), unit: 'تومان', cls: goodToday ? 'good' : 'bad', iconName: 'chart', sub: `ناخالص: ${fmtMoney(d.profitToday.gross)}` })}
        ${kpiCard({ label: 'موجودی صندوق', value: fmtMoney(d.balance), unit: 'تومان', iconName: 'wallet' })}
        ${kpiCard({ label: 'بدهی تأمین‌کنندگان', value: fmtMoney(d.supplierDebt), unit: 'تومان', cls: d.supplierDebt > 0 ? 'bad' : '', iconName: 'truck' })}
        ${kpiCard({ label: 'طلب نسیه', value: fmtMoney(d.creditReceivable), unit: 'تومان', cls: 'gold', iconName: 'cart' })}
        ${kpiCard({ label: 'هشدار موجودی', value: toFa(d.lowStock.length), unit: 'مورد', cls: d.lowStock.length ? 'bad' : 'good', iconName: 'alert', sub: `${toFa(d.counts.activeFoods)} غذای فعال` })}
      </div>

      ${alerts.length ? `<div class="grid-3 mb-16">${alerts.join('')}</div>` : `<div class="alert success mb-16">${icon('check')}<div>همه هشدارها مردود است؛ وضعیت انبار و مالی نرمال است.</div></div>`}

      <div class="grid-2">
        <div class="card">
          <div class="card-title">${icon('chart')} خلاصه ماه جاری</div>
          <div class="summary-rows">
            <div class="s-row"><span class="label">درآمد فروش</span><span class="value mono-num">${fmtMoney(d.month.revenue)}</span></div>
            <div class="s-row"><span class="label">بهای تمام‌شده</span><span class="value mono-num text-danger">−${fmtMoney(d.month.cogs)}</span></div>
            <div class="s-row"><span class="label">ضایعات</span><span class="value mono-num text-danger">−${fmtMoney(d.month.waste)}</span></div>
            <div class="s-row"><span class="label">هزینه‌ها</span><span class="value mono-num text-danger">−${fmtMoney(d.month.expenses)}</span></div>
            <div class="s-row total"><span class="label">سود خالص ماه</span><span class="value mono-num">${fmtMoney(d.month.profit.net)}</span></div>
          </div>
        </div>
        <div class="card">
          <div class="card-title">${icon('cart')} آخرین فروش‌ها</div>
          ${d.recentSales.length ? `
            <table class="data" style="min-width:0">
              <thead><tr><th>زمان</th><th>اقلام</th><th class="num">مبلغ</th></tr></thead>
              <tbody>
                ${d.recentSales.map((s) => `
                  <tr>
                    <td>${toFa(s.time)} <span class="text-muted text-sm">${fmtDate(s.date)}</span></td>
                    <td class="truncate mw-200">${escapeHtml(s.items.map((i) => i.foodName).join('، '))}</td>
                    <td class="num">${fmtMoney(s.total)}</td>
                  </tr>`).join('')}
              </tbody>
            </table>` : emptyState({ title: 'هنوز فروشی ثبت نشده', text: 'اولین فروش خود را ثبت کنید' })}
        </div>
      </div>

      ${chartCards}
    </div>`;

  root.querySelector('#btn-new-sale').addEventListener('click', () => {
    window.location.hash = '#/sales';
  });

  drawCharts(d);
}

function drawCharts(d) {
  const Chart = window.Chart;
  if (!Chart) { toast('نمودارها بارگذاری نشدند', 'warn'); return; }
  const cs = getComputedStyle(document.documentElement);
  const gold = cs.getPropertyValue('--gold-500').trim() || '#d4a017';
  const green = cs.getPropertyValue('--green-700').trim() || '#14503d';
  const grid = cs.getPropertyValue('--chart-grid').trim() || 'rgba(0,0,0,.08)';
  const text = cs.getPropertyValue('--chart-text').trim() || '#666';
  Chart.defaults.font.family = "'Vazirmatn', Tahoma, sans-serif";
  Chart.defaults.color = text;

  const baseOpts = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { rtl: true, labels: { font: { family: "'Vazirmatn'" } } } },
  };

  destroy('ch-sales14');
  new Chart(document.getElementById('ch-sales14'), {
    type: 'bar',
    data: {
      labels: d.series.map((s) => fmtDate(s.date).slice(5)),
      datasets: [{
        label: 'فروش (تومان)',
        data: d.series.map((s) => s.revenue),
        backgroundColor: gold,
        borderRadius: 6,
        maxBarThickness: 26,
      }],
    },
    options: {
      ...baseOpts,
      plugins: { ...baseOpts.plugins, legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 10 } } },
        y: { grid: { color: grid }, ticks: { callback: (v) => toFa(Number(v).toLocaleString('en-US')), font: { size: 10 } } },
      },
    },
  });

  const split = d.paySplit;
  const hasPay = split.cash + split.card + split.credit > 0;
  destroy('ch-pay');
  new Chart(document.getElementById('ch-pay'), {
    type: 'doughnut',
    data: {
      labels: ['نقدی', 'کارت‌خوان', 'نسیه'],
      datasets: [{
        data: hasPay ? [split.cash, split.card, split.credit] : [1],
        backgroundColor: hasPay ? [green, gold, '#8aa396'] : ['#e6e2d8'],
        borderWidth: 0,
      }],
    },
    options: {
      ...baseOpts,
      cutout: '62%',
      plugins: {
        legend: { position: 'bottom', rtl: true },
        tooltip: { rtl: true, callbacks: { label: (c) => ` ${c.label}: ${fmtMoney(c.raw)} تومان` } },
      },
    },
  });

  destroy('ch-top');
  new Chart(document.getElementById('ch-top'), {
    type: 'bar',
    data: {
      labels: d.topFoods.map((f) => f.name),
      datasets: [{
        label: 'درآمد (تومان)',
        data: d.topFoods.map((f) => f.revenue),
        backgroundColor: green,
        borderRadius: 6,
      }],
    },
    options: {
      ...baseOpts,
      indexAxis: 'y',
      plugins: { legend: { display: false }, tooltip: { rtl: true } },
      scales: {
        x: { grid: { color: grid }, ticks: { callback: (v) => toFa(Number(v).toLocaleString('en-US')) } },
        y: { grid: { display: false } },
      },
    },
  });
}

function destroy(id) {
  const c = window.Chart?.getChart?.(document.getElementById(id));
  c?.destroy();
}
