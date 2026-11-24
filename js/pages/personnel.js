/* ============================================================
   صفحه مدیریت پرسنل
   ============================================================ */

import {
  listStaff, addStaff, updateStaff, deleteStaff, paySalary, staffPayments, deleteSalaryPayment,
} from '../services/personnelService.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldTextarea, fieldDate,
} from '../ui/components.js';
import { fmtMoney, toFa, escapeHtml, num, todayJalali, monthKey } from '../core/utils.js';

export const path = 'personnel';
export const title = 'مدیریت پرسنل';
export const iconKey = 'users';

let ctx = null;

export async function render(root) {
  ctx = { staff: await listStaff() };
  const totalSalary = ctx.staff.reduce((s, x) => s + num(x.salary, 0), 0);

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>پرسنل</h2>
        <div class="spacer"></div>
        <button class="btn btn-gold" id="btn-new" type="button">${icon('plus')} افزودن پرسنل</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${icon('users')} تعداد پرسنل</div><div class="kpi-value">${toFa(ctx.staff.length)}</div></div>
        <div class="kpi gold"><div class="kpi-label">${icon('wallet')} جمع حقوق ماهانه</div><div class="kpi-value">${fmtMoney(totalSalary)}<span class="unit">تومان</span></div></div>
      </div>

      <div class="card" id="list"></div>
    </div>`;

  root.querySelector('#btn-new').addEventListener('click', () => modal());
  renderList();
}

function renderList() {
  const el = document.getElementById('list');
  if (!ctx.staff.length) {
    el.innerHTML = emptyState({
      title: 'پرسنلی ثبت نشده',
      text: 'اطلاعات پرسنل و حقوق ماهانه را ثبت کنید',
      actionHtml: '<button class="btn btn-primary" id="empty-new" type="button">افزودن پرسنل</button>',
      iconName: 'users',
    });
    el.querySelector('#empty-new')?.addEventListener('click', () => modal());
    return;
  }

  const table = buildTable({
    columns: [
      { key: 'name', label: 'نام' },
      { key: 'role', label: 'سمت' },
      { key: 'phone', label: 'تلفن', cls: 'num' },
      { key: 'salaryText', label: 'حقوق ماهانه', cls: 'num' },
      { key: 'status', label: 'وضعیت', render: (r) => (r.active === false ? '<span class="badge red">غیرفعال</span>' : '<span class="badge green">فعال</span>') },
    ],
    rows: ctx.staff.map((s) => ({ ...s, salaryText: fmtMoney(s.salary) })),
    searchKeys: ['name', 'role', 'phone'],
    excel: { filename: 'staff', sheetName: 'پرسنل' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm text-success" data-pay="${r.id}" type="button">پرداخت حقوق</button>
        <button class="btn btn-ghost btn-sm" data-hist="${r.id}" type="button">${icon('eye')}</button>
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });

  table.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => payModal(ctx.staff.find((s) => s.id === b.dataset.pay))));
  table.querySelectorAll('[data-hist]').forEach((b) => b.addEventListener('click', async () => {
    const st = ctx.staff.find((s) => s.id === b.dataset.hist);
    const pays = await staffPayments(st.id);
    const content = document.createElement('div');
    content.innerHTML = pays.length ? `
      <table class="data" style="min-width:0">
        <thead><tr><th>تاریخ</th><th>ماه</th><th class="num">مبلغ</th><th></th></tr></thead>
        <tbody>${pays.map((p) => `
          <tr>
            <td>${escapeHtml(p.date)}</td>
            <td>${escapeHtml(p.month || '—')}</td>
            <td class="num">${fmtMoney(p.amount)}</td>
            <td class="actions"><button class="btn btn-ghost btn-sm text-danger" data-del-pay="${p.id}" type="button">${icon('trash')}</button></td>
          </tr>`).join('')}</tbody>
      </table>` : '<div class="text-muted">پرداختی ثبت نشده</div>';
    const modal = openModal({ title: `پرداخت‌های ${st.name}`, content, size: 'wide' });
    content.querySelectorAll('[data-del-pay]').forEach((btn) => btn.addEventListener('click', async () => {
      const ok = await confirmDialog('سند پرداخت حذف و مبلغ از صندوق برداشته شود؟', { danger: true, confirmText: 'حذف' });
      if (!ok) return;
      try { await deleteSalaryPayment(btn.dataset.delPay); modal.close(); toast('پرداخت حذف شد'); await render(document.getElementById('page')); }
      catch (e) { toast(e.message, 'error'); }
    }));
  }));
  table.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => modal(ctx.staff.find((s) => s.id === b.dataset.edit))));
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog('این پرسنل حذف شود؟', { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try { await deleteStaff(b.dataset.del); toast('حذف شد'); await render(document.getElementById('page')); }
    catch (e) { toast(e.message, 'error'); }
  }));

  el.innerHTML = '';
  el.appendChild(table);
}

function modal(st = null) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldText({ id: 'st-name', label: 'نام و نام خانوادگی', value: st?.name || '' })}
      ${fieldText({ id: 'st-role', label: 'سمت', value: st?.role || '', placeholder: 'مثلاً آشپز' })}
      ${fieldText({ id: 'st-phone', label: 'تلفن', value: st?.phone || '' })}
      ${fieldNum({ id: 'st-salary', label: 'حقوق ماهانه (تومان)', value: st ? String(st.salary) : '', placeholder: '0' })}
    </div>
    <div class="mt-8">${fieldTextarea({ id: 'st-notes', label: 'یادداشت', value: st?.notes || '' })}</div>
    ${st ? `<label class="checkbox-row mt-16"><input type="checkbox" id="st-active" ${st.active !== false ? 'checked' : ''} /> فعال</label>` : ''}`;

  const modalApi = openModal({
    title: st ? 'ویرایش پرسنل' : 'پرسنل جدید',
    content,
    footer: `<button class="btn btn-primary" data-save type="button">ذخیره</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modalApi.foot.querySelector('[data-cancel]').addEventListener('click', modalApi.close);
  modalApi.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const payload = {
        name: content.querySelector('#st-name').value,
        role: content.querySelector('#st-role').value,
        phone: content.querySelector('#st-phone').value,
        salary: content.querySelector('#st-salary').value,
        notes: content.querySelector('#st-notes').value,
      };
      if (st) { payload.active = content.querySelector('#st-active').checked; await updateStaff(st.id, payload); }
      else await addStaff(payload);
      modalApi.close();
      toast('ذخیره شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

function payModal(st) {
  const mk = monthKey(todayJalali());
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert info mb-16">${icon('info')}<div>پرداخت حقوق <b>${escapeHtml(st.name)}</b> برای ماه <b>${toFa(mk)}</b> — با کلید یکتا؛ در ماه تکراری پرداخت نمی‌شود.</div></div>
    <div class="form-grid">
      ${fieldNum({ id: 'sp-amount', label: 'مبلغ (تومان)', value: String(st.salary) })}
      ${fieldDate({ id: 'sp-date', label: 'تاریخ پرداخت', value: todayJalali() })}
    </div>`;
  const modalApi = openModal({
    title: 'پرداخت حقوق',
    content,
    footer: `<button class="btn btn-gold" data-save type="button">ثبت پرداخت</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modalApi.foot.querySelector('[data-cancel]').addEventListener('click', modalApi.close);
  modalApi.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      await paySalary({
        staffId: st.id,
        amount: content.querySelector('#sp-amount').value,
        date: content.querySelector('#sp-date').value.trim() || todayJalali(),
      });
      modalApi.close();
      toast('حقوق پرداخت شد و از صندوق کسر گردید');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}
