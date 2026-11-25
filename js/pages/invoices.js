/* ============================================================
   صفحه فاکتورها — فهرست اسناد فروش با چاپ و دانلود PDF
   ============================================================ */

import { listSales } from '../services/salesService.js';
import { exportReceipt, printReceipt } from '../core/receipt.js';
import { showSaleDetail } from './sales.js';
import { icon, toast, buildTable, emptyState } from '../ui/components.js';
import { fmtMoney, fmtDate, toFa, num, todayJalali, addDaysJalali, escapeHtml, toEn } from '../core/utils.js';

export const path = 'invoices';
export const title = 'فاکتورها';
export const iconKey = 'pdf';

let rows = [];
let range = null;

export async function render(root) {
  if (!range) {
    const from = addDaysJalali(todayJalali(), -29);
    range = { from, to: todayJalali() };
  }

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>فاکتورها</h2>
        <div class="spacer"></div>
        <input class="input" id="iv-from" dir="ltr" style="width:130px;min-height:38px" value="${range.from}" placeholder="1405-01-01" />
        <span class="text-muted">تا</span>
        <input class="input" id="iv-to" dir="ltr" style="width:130px;min-height:38px" value="${range.to}" placeholder="1405-12-29" />
        <button class="btn btn-primary btn-sm" id="iv-apply" type="button">نمایش</button>
        <button class="btn btn-outline btn-sm" id="iv-all" type="button">همه</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi gold"><div class="kpi-label">${icon('pdf')} فاکتورها در بازه</div><div class="kpi-value">${toFa(rows.length)}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('cart')} مجموع مبالغ</div><div class="kpi-value">${fmtMoney(rows.reduce((s, r) => s + num(r.total, 0), 0))}<span class="unit">تومان</span></div></div>
        <div class="kpi ${rows.some((r) => num(r.creditRemaining, 0) > 0) ? 'bad' : 'good'}"><div class="kpi-label">${icon('wallet')} طلب باقی‌مانده</div><div class="kpi-value">${fmtMoney(rows.reduce((s, r) => s + num(r.creditRemaining, 0), 0))}<span class="unit">تومان</span></div></div>
      </div>

      <div class="card" id="invoices-body"></div>
    </div>`;

  root.querySelector('#iv-apply').addEventListener('click', () => {
    const from = toEn(root.querySelector('#iv-from').value).trim();
    const to = toEn(root.querySelector('#iv-to').value).trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      toast('تاریخ‌ها را با قالب 1405-08-03 وارد کنید', 'warn'); return;
    }
    if (from > to) { toast('تاریخ شروع بعد از پایان است', 'warn'); return; }
    range = { from, to };
    load();
  });
  root.querySelector('#iv-all').addEventListener('click', () => {
    range = { from: '0000-01-01', to: '9999-12-29' };
    root.querySelector('#iv-from').value = '';
    root.querySelector('#iv-to').value = '';
    load();
  });

  await load();
}

async function load() {
  rows = await listSales({ from: range.from, to: range.to });
  // به‌روزرسانی KPIها
  const page = document.getElementById('page');
  const kpis = page?.querySelectorAll('.kpi-value');
  if (kpis && kpis.length >= 3) {
    kpis[0].textContent = toFa(rows.length);
    kpis[1].innerHTML = `${fmtMoney(rows.reduce((s, r) => s + num(r.total, 0), 0))}<span class="unit">تومان</span>`;
    kpis[2].innerHTML = `${fmtMoney(rows.reduce((s, r) => s + num(r.creditRemaining, 0), 0))}<span class="unit">تومان</span>`;
  }
  renderTable();
}

function statusBadge(r) {
  const credit = num(r.creditRemaining, 0);
  const paid = num(r.payments.cash, 0) + num(r.payments.card, 0) + num(r.received, 0);
  if (credit > 0) return '<span class="badge red">نسیه</span>';
  if (paid >= num(r.total, 0)) return '<span class="badge green">تسویه‌شده</span>';
  return '<span class="badge gold">ترکیبی</span>';
}

function renderTable() {
  const el = document.getElementById('invoices-body');
  if (!rows.length) {
    el.innerHTML = emptyState({
      title: 'فاکتوری در این بازه نیست',
      text: 'با ثبت فروش، فاکتورها اینجا فهرست می‌شوند',
      actionHtml: '<button class="btn btn-primary" id="iv-go-sales" type="button">ثبت فروش</button>',
      iconName: 'pdf',
    });
    el.querySelector('#iv-go-sales')?.addEventListener('click', () => { location.hash = '#/sales'; });
    return;
  }

  const table = buildTable({
    columns: [
      { key: 'number', label: 'شماره فاکتور', cls: 'num', render: (r) => `<span dir="ltr">${escapeHtml(r.id.slice(-8))}</span>` },
      { key: 'date', label: 'تاریخ', cls: 'num', render: (r) => fmtDate(r.date) },
      { key: 'customer', label: 'مشتری', render: (r) => escapeHtml(r.customer?.name || '—') },
      { key: 'itemsCount', label: 'اقلام', cls: 'num', render: (r) => toFa((r.items || []).length) },
      { key: 'totalText', label: 'مبلغ', cls: 'num' },
      { key: 'creditText', label: 'باقی‌مانده', cls: 'num', render: (r) => (num(r.creditRemaining, 0) > 0 ? `<b class="text-danger">${fmtMoney(r.creditRemaining)}</b>` : '—') },
      { key: 'status', label: 'وضعیت', render: (r) => statusBadge(r) },
    ],
    rows: rows.map((r) => ({ ...r, number: r.id.slice(-8), totalText: fmtMoney(r.total), creditText: fmtMoney(r.creditRemaining) })),
    searchKeys: ['number', 'customer', 'date'],
    excel: { filename: `invoices-${range.from}-${range.to}`, sheetName: 'فاکتورها' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-view="${r.id}" type="button" title="جزئیات">${icon('eye')}</button>
        <button class="btn btn-ghost btn-sm" data-print="${r.id}" type="button" title="چاپ فاکتور">${icon('pdf')}</button>
        <button class="btn btn-ghost btn-sm" data-pdf="${r.id}" type="button" title="دانلود PDF">${icon('backup')}</button>
      </div>`,
  });

  const find = (id) => rows.find((x) => x.id === id);
  table.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const s = find(b.dataset.view);
    if (s) showSaleDetail(s);
  }));
  table.querySelectorAll('[data-print]').forEach((b) => b.addEventListener('click', () => {
    const s = find(b.dataset.print);
    if (!s) return;
    try { printReceipt(s); toast('پنجره چاپ باز شد'); }
    catch (e) { toast(e.message || 'خطا در چاپ', 'error'); }
  }));
  table.querySelectorAll('[data-pdf]').forEach((b) => b.addEventListener('click', async () => {
    const s = find(b.dataset.pdf);
    if (!s) return;
    try {
      toast('در حال ساخت فاکتور…', 'info', 2500);
      await exportReceipt(s);
      toast('فاکتور PDF ساخته شد');
    } catch (e) { toast(e.message || 'خطا در ساخت PDF', 'error'); }
  }));

  el.innerHTML = '';
  el.appendChild(table);
}
