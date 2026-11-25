/* ============================================================
   صفحه مشتریان — پروفایل از روی فروش‌ها، طلب نسیه و تسویه حساب
   ============================================================ */

import { listCustomers, settleCustomer } from '../services/salesService.js';
import { icon, toast, buildTable, emptyState, openModal, fieldNum, fieldText } from '../ui/components.js';
import { fmtMoney, fmtDate, toFa, num, escapeHtml } from '../core/utils.js';

export const path = 'customers';
export const title = 'مشتریان';
export const iconKey = 'users';

let customers = [];

export async function render(root) {
  customers = await listCustomers();
  const debtors = customers.filter((c) => c.credit > 0);
  const totalCredit = debtors.reduce((s, c) => s + c.credit, 0);

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>مشتریان</h2>
        <div class="spacer"></div>
        <span class="badge">داده‌ها از اسناد فروش</span>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${icon('users')} تعداد مشتریان</div><div class="kpi-value">${toFa(customers.length)}</div></div>
        <div class="kpi gold"><div class="kpi-label">${icon('wallet')} بدهکاران نسیه</div><div class="kpi-value">${toFa(debtors.length)}</div></div>
        <div class="kpi ${totalCredit > 0 ? 'bad' : 'good'}"><div class="kpi-label">${icon('chart')} مجموع طلب مشتریان</div><div class="kpi-value">${fmtMoney(totalCredit)}<span class="unit">تومان</span></div></div>
      </div>

      <div class="alert info mb-16">${icon('info')}<div>هر مشتری با اولین فروش نام/تلفن‌دار ساخته می‌شود. با «تسویه حساب» مبلغ دریافتی روی طلب‌های قدیمی‌تر تقسیم و با پرداخت کامل، <b>حساب مشتری صفر</b> می‌شود.</div></div>

      <div class="card" id="customers-body"></div>
    </div>`;

  renderTable();
}

function renderTable() {
  const el = document.getElementById('customers-body');
  if (!customers.length) {
    el.innerHTML = emptyState({
      title: 'مشتری‌ای ثبت نشده',
      text: 'مشتریان با ثبت فروش (نام یا تلفن) به‌صورت خودکار ساخته می‌شوند',
      actionHtml: '<button class="btn btn-primary" id="go-sales" type="button">رفتن به ثبت فروش</button>',
      iconName: 'users',
    });
    el.querySelector('#go-sales')?.addEventListener('click', () => { location.hash = '#/sales'; });
    return;
  }

  const table = buildTable({
    columns: [
      { key: 'name', label: 'نام مشتری', render: (r) => escapeHtml(r.name || '—') },
      { key: 'phone', label: 'تلفن', cls: 'num', render: (r) => (r.phone ? `<span dir="ltr">${escapeHtml(r.phone)}</span>` : '—') },
      { key: 'salesCount', label: 'تعداد خرید', cls: 'num', render: (r) => toFa(r.salesCount) },
      { key: 'totalText', label: 'مجموع خرید', cls: 'num' },
      { key: 'creditText', label: 'طلب باقی‌مانده', cls: 'num', render: (r) => (r.credit > 0 ? `<b class="text-danger">${fmtMoney(r.credit)}</b>` : `<span class="text-success">${fmtMoney(0)}</span>`) },
      { key: 'lastDate', label: 'آخرین خرید', cls: 'num', render: (r) => fmtDate(r.lastDate) },
    ],
    rows: customers.map((c) => ({ ...c, totalText: fmtMoney(c.total), creditText: fmtMoney(c.credit) })),
    searchKeys: ['name', 'phone'],
    excel: { filename: 'customers', sheetName: 'مشتریان' },
    rowActions: (r) => `
      <div class="row-actions">
        ${r.credit > 0 ? `<button class="btn btn-gold btn-sm" data-settle="${escapeHtml(r.key)}" type="button">تسویه حساب</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-view="${escapeHtml(r.key)}" type="button" title="سوابق">${icon('eye')}</button>
      </div>`,
  });

  table.querySelectorAll('[data-settle]').forEach((b) => {
    b.addEventListener('click', () => {
      const c = customers.find((x) => x.key === b.dataset.settle);
      if (c) settleModal(c);
    });
  });
  table.querySelectorAll('[data-view]').forEach((b) => {
    b.addEventListener('click', () => {
      const c = customers.find((x) => x.key === b.dataset.view);
      if (c) detailModal(c);
    });
  });

  el.innerHTML = '';
  el.appendChild(table);
}

/** مودال تسویه حساب — پرداخت کامل = صفر کردن حساب مشتری */
function settleModal(c) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="summary-rows mb-16">
      <div class="s-row"><span class="label">مشتری</span><span>${escapeHtml(c.name || '—')}${c.phone ? ` — <span dir="ltr">${escapeHtml(c.phone)}</span>` : ''}</span></div>
      <div class="s-row"><span class="label">مجموع خرید</span><span class="mono-num">${fmtMoney(c.total)} تومان</span></div>
      <div class="s-row neg"><span class="label"><b>طلب باقی‌مانده</b></span><span class="mono-num"><b>${fmtMoney(c.credit)} تومان</b></span></div>
    </div>
    ${fieldNum({ id: 'settle-amount', label: 'مبلغ دریافتی (تومان)', value: String(c.credit), placeholder: '0', hint: 'مبلغ کامل = صفر کردن حساب؛ کمتر از کل نیز مجاز است' })}
    <div class="mt-8">${fieldText({ id: 'settle-note', label: 'یادداشت', placeholder: 'اختیاری — مثلاً نقدی یا کارت' })}</div>`;

  const modal = openModal({
    title: 'تسویه حساب مشتری',
    content,
    footer: `<button class="btn btn-gold" data-full type="button">${icon('check')} پرداخت کامل و صفر کردن حساب</button>
             <button class="btn btn-primary" data-save type="button">ثبت مبلغ</button>
             <button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);

  const submit = async (amount) => {
    try {
      const r = await settleCustomer({
        key: c.key,
        amount,
        note: content.querySelector('#settle-note').value.trim(),
      });
      modal.close();
      toast(r.cleared ? `حساب ${c.name || 'مشتری'} صفر شد — ${fmtMoney(r.paid)} تومان دریافت شد`
        : `${fmtMoney(r.paid)} تومان دریافت شد؛ باقی‌مانده: ${fmtMoney(r.remainingCredit)}`, 'success');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  };

  modal.foot.querySelector('[data-full]').addEventListener('click', () => submit(c.credit));
  modal.foot.querySelector('[data-save]').addEventListener('click', () => {
    const v = content.querySelector('#settle-amount').value;
    if (num(v, 0) <= 0) { toast('مبلغ را وارد کنید', 'warn'); return; }
    submit(v);
  });
}

/** مودال سوابق خرید مشتری */
function detailModal(c) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="summary-rows mb-16">
      <div class="s-row"><span class="label">نام</span><span>${escapeHtml(c.name || '—')}</span></div>
      <div class="s-row"><span class="label">تلفن</span><span dir="ltr">${escapeHtml(c.phone || '—')}</span></div>
      <div class="s-row"><span class="label">تعداد خرید</span><span>${toFa(c.salesCount)} سند</span></div>
      <div class="s-row"><span class="label">مجموع خرید</span><span class="mono-num">${fmtMoney(c.total)} تومان</span></div>
      <div class="s-row ${c.credit > 0 ? 'neg' : 'pos'}"><span class="label">طلب باقی‌مانده</span><span class="mono-num"><b>${fmtMoney(c.credit)} تومان</b></span></div>
    </div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>تاریخ</th><th>شماره فاکتور</th><th class="num">مبلغ</th><th class="num">باقی‌مانده</th></tr></thead>
        <tbody>
          ${c.sales.map((s) => `
            <tr>
              <td>${fmtDate(s.date)}</td>
              <td dir="ltr">${escapeHtml(s.id.slice(-8))}</td>
              <td class="num">${fmtMoney(s.total)}</td>
              <td class="num">${num(s.creditRemaining, 0) > 0 ? `<b class="text-danger">${fmtMoney(s.creditRemaining)}</b>` : '—'}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;

  const modal = openModal({
    title: `سوابق ${c.name || c.phone || 'مشتری'}`,
    content, size: 'wide',
    footer: `${c.credit > 0 ? `<button class="btn btn-gold" data-settle2 type="button">${icon('wallet')} تسویه حساب</button>` : ''}
             <button class="btn btn-ghost" data-close type="button">بستن</button>`,
  });
  modal.foot.querySelector('[data-close]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-settle2]')?.addEventListener('click', () => { modal.close(); settleModal(c); });
}
