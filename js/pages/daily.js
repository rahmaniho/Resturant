/* ============================================================
   صفحه گزارش روزانه
   ============================================================ */

import { dailyReport } from '../services/reportService.js';
import { getSettings } from '../core/settings.js';
import { icon, toast, emptyState } from '../ui/components.js';
import { fmtMoney, fmtDateLong, toFa, escapeHtml, todayJalali, weekdayOf, fmtQty, toEn } from '../core/utils.js';

export const path = 'daily';
export const title = 'گزارش روزانه';
export const iconKey = 'calendar';

let date = todayJalali();

export async function render(root) {
  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>گزارش روزانه</h2>
        <div class="spacer"></div>
        <input class="input" id="d-date" dir="ltr" style="width:140px;min-height:38px" value="${toFa(date)}" placeholder="1405-08-03" />
        <button class="btn btn-primary btn-sm" id="d-apply" type="button">نمایش</button>
        <button class="btn btn-outline btn-sm" id="d-today" type="button">امروز</button>
        <button class="btn btn-outline btn-sm" id="d-excel" type="button">${icon('excel')} اکسل</button>
        <button class="btn btn-outline btn-sm" id="d-pdf" type="button">${icon('pdf')} PDF</button>
      </div>
      <div id="daily-area"><div class="empty-state"><p>در حال محاسبه…</p></div></div>
    </div>`;

  root.querySelector('#d-apply').addEventListener('click', () => {
    const v = toEn(root.querySelector('#d-date').value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { toast('تاریخ را با قالب 1405-08-03 وارد کنید', 'warn'); return; }
    date = v;
    load();
  });
  root.querySelector('#d-today').addEventListener('click', () => {
    date = todayJalali();
    root.querySelector('#d-date').value = toFa(date);
    load();
  });
  root.querySelector('#d-excel').addEventListener('click', exportExcel);
  root.querySelector('#d-pdf').addEventListener('click', exportPdf);

  await load();
}

let lastData = null;

async function load() {
  const area = document.getElementById('daily-area');
  const d = await dailyReport(date);
  lastData = d;
  const p = d.profit;
  const revDelta = d.vsPrev.revenueDelta;

  area.innerHTML = `
    <div class="export-sheet" id="daily-sheet">
      <div class="section-head">
        <h2>گزارش ${fmtDateLong(d.date)} — ${weekdayOf(d.date)}</h2>
        <div class="spacer"></div>
        ${revDelta !== 0 ? `<span class="badge ${revDelta > 0 ? 'green' : 'red'}">${revDelta > 0 ? '▲' : '▼'} ${fmtMoney(Math.abs(revDelta))} نسبت به روز قبل</span>` : ''}
      </div>

      <div class="kpi-grid">
        <div class="kpi gold"><div class="kpi-label">فروش امروز</div><div class="kpi-value">${fmtMoney(d.revenue)}<span class="unit">تومان</span></div><div class="kpi-sub">${toFa(d.salesCount)} سند</div></div>
        <div class="kpi"><div class="kpi-label">سود ناخالص</div><div class="kpi-value ${p.gross >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(p.gross)}</div></div>
        <div class="kpi ${p.net >= 0 ? 'good' : 'bad'}"><div class="kpi-label">سود خالص روز</div><div class="kpi-value">${fmtMoney(p.net)}</div></div>
        <div class="kpi"><div class="kpi-label">گردش نقدی</div><div class="kpi-value ${d.cashflow.net >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(d.cashflow.net)}</div><div class="kpi-sub">ورود ${fmtMoney(d.cashflow.in)} / خروج ${fmtMoney(d.cashflow.out)}</div></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">خلاصه مالی روز</div>
          <div class="summary-rows">
            <div class="s-row"><span class="label">نقدی</span><span class="mono-num">${fmtMoney(d.payments.cash)}</span></div>
            <div class="s-row"><span class="label">کارت‌خوان</span><span class="mono-num">${fmtMoney(d.payments.card)}</span></div>
            <div class="s-row"><span class="label">نسیه</span><span class="mono-num">${fmtMoney(d.payments.credit)}</span></div>
            <div class="s-row sub"><span class="label">درآمد</span><span class="mono-num">${fmtMoney(d.revenue)}</span></div>
            <div class="s-row"><span class="label">بهای تمام‌شده</span><span class="mono-num text-danger">−${fmtMoney(d.cogs)}</span></div>
            <div class="s-row"><span class="label">ضایعات</span><span class="mono-num text-danger">−${fmtMoney(d.wasteValue)}</span></div>
            <div class="s-row"><span class="label">هزینه‌های روز</span><span class="mono-num text-danger">−${fmtMoney(d.expensesTotal)}</span></div>
            <div class="s-row total"><span class="label">سود خالص</span><span class="mono-num">${fmtMoney(p.net)}</span></div>
          </div>
        </div>

        <div class="card">
          <div class="card-title">عملیات انبار و خرید</div>
          <div class="summary-rows">
            <div class="s-row"><span class="label">خریدهای روز</span><span class="mono-num">${toFa(d.purchases.length)} سند — ${fmtMoney(d.purchaseTotal)} تومان</span></div>
            <div class="s-row"><span class="label">ضایعات ثبت‌شده</span><span class="mono-num">${toFa(d.wasteMovs.length)} مورد</span></div>
            <div class="s-row"><span class="label">شمارش موجودی</span><span class="mono-num">${toFa(d.countsToday.length)} سند</span></div>
            <div class="s-row"><span class="label">کمبود موجودی فعلی</span><span class="mono-num ${d.lowStock.length ? 'text-danger' : 'text-success'}">${toFa(d.lowStock.length)} مورد</span></div>
          </div>
          ${d.wasteMovs.length ? `
            <div class="card-title mt-16" style="font-size:13.5px">جزئیات ضایعات</div>
            <table class="data" style="min-width:0">
              <tbody>${d.wasteMovs.map((w) => `
                <tr><td>${escapeHtml(w.note)}</td><td class="num">${fmtQty(Math.abs(w.qty))}</td><td class="num">${fmtMoney(Math.abs(w.value))}</td></tr>`).join('')}
              </tbody>
            </table>` : ''}
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">فروش به تفکیک غذا</div>
        ${d.topFoods.length ? `
          <table class="data" style="min-width:0">
            <thead><tr><th>غذا</th><th class="num">تعداد</th><th class="num">درآمد</th><th class="num">بهای تمام‌شده</th><th class="num">سود</th></tr></thead>
            <tbody>
              ${d.topFoods.map((f) => `
                <tr>
                  <td>${escapeHtml(f.name)}</td>
                  <td class="num">${toFa(f.qty)}</td>
                  <td class="num">${fmtMoney(f.revenue)}</td>
                  <td class="num">${fmtMoney(f.cost)}</td>
                  <td class="num"><b class="${f.revenue - f.cost >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(f.revenue - f.cost)}</b></td>
                </tr>`).join('')}
            </tbody>
          </table>` : '<div class="text-muted text-sm">فروشی در این روز ثبت نشده</div>'}
      </div>

      ${d.purchases.length ? `
      <div class="card mt-16">
        <div class="card-title">خریدهای روز</div>
        <table class="data" style="min-width:0">
          <thead><tr><th>تأمین‌کننده</th><th class="num">مبلغ</th><th class="num">پرداخت</th><th class="num">بدهی</th></tr></thead>
          <tbody>${d.purchases.map((pu) => `
            <tr>
              <td>${escapeHtml(pu.supplierName)}</td>
              <td class="num">${fmtMoney(pu.total)}</td>
              <td class="num">${fmtMoney(pu.paid)}</td>
              <td class="num">${fmtMoney(pu.remaining)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>` : ''}
    </div>`;
}

function exportExcel() {
  if (!lastData) return;
  import('../core/exporters.js').then(({ exportTableExcel }) => {
    const d = lastData;
    exportTableExcel(`daily-${d.date}`, 'گزارش روزانه', [
      { key: 'item', label: 'شرح' }, { key: 'value', label: 'مقدار' },
    ], [
      { item: 'درآمد فروش', value: d.revenue },
      { item: 'بهای تمام‌شده', value: -d.cogs },
      { item: 'سود ناخالص', value: d.profit.gross },
      { item: 'ضایعات', value: -d.wasteValue },
      { item: 'هزینه‌ها', value: -d.expensesTotal },
      { item: 'سود خالص', value: d.profit.net },
      { item: 'نقدی', value: d.payments.cash },
      { item: 'کارت‌خوان', value: d.payments.card },
      { item: 'نسیه', value: d.payments.credit },
      { item: 'ورودی صندوق', value: d.cashflow.in },
      { item: 'خروجی صندوق', value: d.cashflow.out },
      ...d.topFoods.map((f) => ({ item: `فروش ${f.name} ×${f.qty}`, value: f.revenue })),
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
    const s = getSettings();
    const money = (n) => fmtMoney(n);
    const p = d.profit;

    const blocks = [
      { type: 'kpis', items: [
        { label: 'درآمد روز', value: `${money(d.revenue)} تومان` },
        { label: 'سود ناخالص', value: `${money(p.gross)} تومان` },
        { label: 'سود خالص روز', value: `${money(p.net)} تومان` },
        { label: 'اسناد فروش', value: `${toFa(d.salesCount)} سند` },
      ] },
      { type: 'table', title: 'خلاصه مالی روز', columns: [{ label: 'شرح' }, { label: 'مبلغ (تومان)', align: 'num' }],
        rows: [
          ['نقدی دریافتی', money(d.payments.cash)],
          ['کارت‌خوان', money(d.payments.card)],
          ['نسیه', money(d.payments.credit)],
          ['درآمد', money(d.revenue)],
          ['بهای تمام‌شده', `−${money(d.cogs)}`],
          ['ضایعات', `−${money(d.wasteValue)}`],
          ['هزینه‌های روز', `−${money(d.expensesTotal)}`],
        ],
        totals: ['سود خالص', money(p.net)] },
      { type: 'table', title: 'فروش به تفکیک غذا', columns: [
        { label: 'غذا' }, { label: 'تعداد', align: 'num' }, { label: 'درآمد', align: 'num' },
        { label: 'بهای تمام‌شده', align: 'num' }, { label: 'سود', align: 'num' },
      ],
        rows: d.topFoods.length
          ? d.topFoods.map((f) => [f.name, toFa(f.qty), money(f.revenue), money(f.cost), money(f.revenue - f.cost)])
          : [['فروشی در این روز ثبت نشده', '—', '—', '—', '—']] },
      ...(d.purchases.length ? [{ type: 'table', title: 'خریدهای روز', columns: [
        { label: 'تأمین‌کننده' }, { label: 'مبلغ', align: 'num' }, { label: 'پرداخت', align: 'num' }, { label: 'بدهی', align: 'num' },
      ],
        rows: d.purchases.map((pu) => [pu.supplierName || '—', money(pu.total), money(pu.paid), money(pu.remaining)]) }] : []),
      { type: 'table', title: 'گردش نقدی روز', columns: [{ label: 'ردیف' }, { label: 'مبلغ (تومان)', align: 'num' }],
        rows: [
          ['ورودی صندوق', money(d.cashflow.in)],
          ['خروجی صندوق', `−${money(d.cashflow.out)}`],
        ],
        totals: ['خالص گردش', money(d.cashflow.net)] },
      { type: 'note', text: `تاریخ: ${fmtDateLong(d.date)} — ${weekdayOf(d.date)} | ضایعات ثبت‌شده: ${toFa(d.wasteMovs.length)} مورد | کمبود موجودی فعلی: ${toFa(d.lowStock.length)} مورد` },
    ];

    await exportReportPdf({
      title: 'گزارش روزانه',
      subtitle: 'گزارش رسمی یک روز',
      range: fmtDateLong(d.date),
      brand: s.restaurantName || 'صبحانه‌سرای آفتاب',
      logo: s.restaurantLogo || './icons/icon-192.png',
      blocks,
    }, `daily-${d.date}.pdf`);
    toast('PDF ساخته شد');
  } catch (e) {
    toast(e.message || 'خطا در ساخت PDF', 'error');
  }
}
