/* ============================================================
   صفحه دخل و صندوق — گردش نقدی
   ============================================================ */

import {
  cashBalance, listCashEntries, addCashEntry, deleteCashEntry, cashFlow, ensureInitialCash,
} from '../services/cashService.js';
import { getSettings } from '../core/settings.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldDate, fieldSelect,
} from '../ui/components.js';
import { fmtMoney, toFa, escapeHtml, num, todayJalali, addDaysJalali, currentJalaliMonth, toEn } from '../core/utils.js';

export const path = 'cashbox';
export const title = 'دخل و صندوق';
export const iconKey = 'wallet';

let ctx = null;
let filters = { from: '', to: '', type: '' };

export async function render(root) {
  await ensureInitialCash();
  ctx = {
    balance: await cashBalance(),
    entries: await listCashEntries(),
    monthFlow: await cashFlow(currentMonth().from, currentMonth().to),
  };

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>صندوق و گردش نقدی</h2>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="btn-add" type="button">${icon('plus')} ثبت دریافت/پرداخت</button>
        <button class="btn btn-outline" id="btn-excel" type="button">${icon('excel')} اکسل</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi gold"><div class="kpi-label">${icon('wallet')} مانده صندوق</div><div class="kpi-value">${fmtMoney(ctx.balance)}<span class="unit">تومان</span></div></div>
        <div class="kpi good"><div class="kpi-label">${icon('arrowIn')} ورودی ماه جاری</div><div class="kpi-value">${fmtMoney(ctx.monthFlow.in)}<span class="unit">تومان</span></div></div>
        <div class="kpi bad"><div class="kpi-label">${icon('arrowOut')} خروجی ماه جاری</div><div class="kpi-value">${fmtMoney(ctx.monthFlow.out)}<span class="unit">تومان</span></div></div>
        <div class="kpi"><div class="kpi-label">${icon('chart')} خالص ماه جاری</div><div class="kpi-value ${ctx.monthFlow.net >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(ctx.monthFlow.net)}<span class="unit">تومان</span></div></div>
      </div>

      <div class="alert info mb-16">${icon('info')}<div>صندوق فقط تراکنش‌های نقدی را ثبت می‌کند؛ مبالغ کارت‌خوان در فروش ثبت می‌شوند و در این گردش لحاظ نمی‌شوند. ${getSettings().initialCash > 0 ? '' : 'موجودی ابتدای صندوق را از بخش تنظیمات تعیین کنید.'}</div></div>

      <div class="card">
        <div class="table-toolbar">
          <div class="field" style="width:150px"><label>از تاریخ</label><input class="input" id="f-from" dir="ltr" placeholder="1405-01-01" value="${filters.from}" /></div>
          <div class="field" style="width:150px"><label>تا تاریخ</label><input class="input" id="f-to" dir="ltr" placeholder="1405-12-29" value="${filters.to}" /></div>
          <div class="field" style="width:140px"><label>نوع</label>
            <select class="select" id="f-type">
              <option value="">همه</option>
              <option value="in" ${filters.type === 'in' ? 'selected' : ''}>ورود</option>
              <option value="out" ${filters.type === 'out' ? 'selected' : ''}>خروج</option>
            </select>
          </div>
          <button class="btn btn-outline btn-sm" id="f-apply" type="button" style="align-self:flex-end">اعمال</button>
          <button class="btn btn-ghost btn-sm" id="f-clear" type="button" style="align-self:flex-end">پاک‌سازی</button>
        </div>
        <div id="list"></div>
      </div>
    </div>`;

  root.querySelector('#btn-add').addEventListener('click', () => entryModal());
  root.querySelector('#btn-excel').addEventListener('click', async () => {
    const { exportTableExcel } = await import('../core/exporters.js');
    const rows = await listCashEntries(filters);
    exportTableExcel(`cashbox-${todayJalali()}`, 'صندوق', [
      { key: 'date', label: 'تاریخ' }, { key: 'time', label: 'ساعت' },
      { key: 'typeLabel', label: 'نوع' }, { key: 'category', label: 'دسته' },
      { key: 'amount', label: 'مبلغ' }, { key: 'description', label: 'شرح' },
    ], rows.map((r) => ({ ...r, typeLabel: r.type === 'in' ? 'ورود' : 'خروج' })));
    toast('فایل اکسل ساخته شد');
  });
  root.querySelector('#f-apply').addEventListener('click', async () => {
    filters = {
      from: toEn(root.querySelector('#f-from').value).trim(),
      to: toEn(root.querySelector('#f-to').value).trim(),
      type: root.querySelector('#f-type').value,
    };
    await renderList();
  });
  root.querySelector('#f-clear').addEventListener('click', async () => {
    filters = { from: '', to: '', type: '' };
    await render(document.getElementById('page'));
  });

  await renderList();
}

async function renderList() {
  const el = document.getElementById('list');
  const rows = await listCashEntries(filters);
  if (!rows.length) {
    el.innerHTML = emptyState({ title: 'تراکنشی یافت نشد', text: 'فروش نقدی، خرید، هزینه و ثبت‌های دستی اینجا دیده می‌شوند', iconName: 'wallet' });
    return;
  }
  const table = buildTable({
    columns: [
      { key: 'date', label: 'تاریخ', cls: 'num', width: '95px' },
      { key: 'time', label: 'ساعت', cls: 'num', width: '70px' },
      { key: 'typeLabel', label: 'نوع', render: (r) => (r.type === 'in' ? '<span class="badge green">ورود</span>' : '<span class="badge red">خروج</span>') },
      { key: 'category', label: 'دسته' },
      { key: 'description', label: 'شرح' },
      { key: 'amountText', label: 'مبلغ', cls: 'num', render: (r) => `<b class="${r.type === 'in' ? 'text-success' : 'text-danger'}">${r.type === 'in' ? '+' : '−'}${fmtMoney(r.amount)}</b>` },
    ],
    rows: rows.map((r) => ({ ...r, amountText: fmtMoney(r.amount) })),
    searchKeys: ['description', 'category'],
    excel: { filename: `cash-${todayJalali()}`, sheetName: 'صندوق' },
    rowActions: (r) => (r.refType === 'manual'
      ? `<button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>` : ''),
  });
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog('این ثبت دستی حذف شود؟', { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try { await deleteCashEntry(b.dataset.del); toast('حذف شد'); await render(document.getElementById('page')); }
    catch (e) { toast(e.message, 'error'); }
  }));
  el.innerHTML = '';
  el.appendChild(table);
}

function entryModal() {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldSelect({ id: 'e-type', label: 'نوع', options: [{ value: 'in', label: 'دریافت (ورود)' }, { value: 'out', label: 'پرداخت (خروج)' }], placeholder: null })}
      ${fieldNum({ id: 'e-amount', label: 'مبلغ (تومان)', placeholder: '0' })}
      ${fieldText({ id: 'e-cat', label: 'دسته', placeholder: 'مثلاً تنخواه' })}
      ${fieldDate({ id: 'e-date', label: 'تاریخ', value: todayJalali() })}
    </div>
    <div class="mt-8">${fieldText({ id: 'e-desc', label: 'شرح', placeholder: 'اختیاری' })}</div>
    <div class="alert warn mt-8">${icon('alert')}<div>ثبت دستی فقط برای موارد خارج از فروش/خرید/هزینه است؛ عملیات اصلی از بخش خودشان ثبت می‌شوند.</div></div>`;
  const modal = openModal({
    title: 'ثبت تراکنش صندوق',
    content,
    footer: `<button class="btn btn-primary" data-save type="button">ثبت</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      await addCashEntry({
        type: content.querySelector('#e-type').value,
        amount: content.querySelector('#e-amount').value,
        category: content.querySelector('#e-cat').value || 'دستی',
        description: content.querySelector('#e-desc').value,
        date: content.querySelector('#e-date').value.trim() || todayJalali(),
      });
      modal.close();
      toast('تراکنش ثبت شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

function currentMonth() {
  const { from, to } = currentJalaliMonth();
  return { from, to };
}
