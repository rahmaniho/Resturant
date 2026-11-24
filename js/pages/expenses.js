/* ============================================================
   صفحه هزینه‌ها — ثبت، دوره‌ای، جلوگیری از دوباره‌شماری
   ============================================================ */

import {
  listExpenses, addExpense, updateExpense, deleteExpense,
  listTemplates, addTemplate, deleteTemplate, generateRecurring,
} from '../services/expenseService.js';
import { getSettings, saveSettings } from '../core/settings.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldTextarea, fieldSelect, fieldDate,
} from '../ui/components.js';
import { fmtMoney, toFa, escapeHtml, num, todayJalali, monthKey } from '../core/utils.js';

export const path = 'expenses';
export const title = 'هزینه‌ها';
export const iconKey = 'expense';

let ctx = null;
let tab = 'list';

export async function render(root) {
  const month = monthKey(todayJalali());
  ctx = {
    expenses: await listExpenses(),
    templates: await listTemplates(),
    settings: getSettings(),
    month,
  };

  const monthRows = ctx.expenses.filter((e) => (e.month || monthKey(e.date)) === month);
  const monthTotal = monthRows.reduce((s, e) => s + num(e.amount, 0), 0);

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>هزینه‌ها</h2>
        <div class="spacer"></div>
        <button class="btn btn-outline" id="btn-tpl" type="button">${icon('refresh')} قالب‌های دوره‌ای</button>
        <button class="btn btn-primary" id="btn-new" type="button">${icon('plus')} هزینه جدید</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi bad"><div class="kpi-label">${icon('expense')} هزینه ماه جاری (${toFa(month.slice(5))})</div><div class="kpi-value">${fmtMoney(monthTotal)}<span class="unit">تومان</span></div></div>
        <div class="kpi"><div class="kpi-label">${icon('box')} تعداد اسناد</div><div class="kpi-value">${toFa(ctx.expenses.length)}</div></div>
        <div class="kpi gold"><div class="kpi-label">${icon('refresh')} قالب دوره‌ای فعال</div><div class="kpi-value">${toFa(ctx.templates.filter((t) => t.active !== false).length)}</div></div>
      </div>

      <div class="alert info mb-16">${icon('info')}<div>برای جلوگیری از دوباره‌شماری، هر سند هزینه کلید یکتای خود را دارد؛ هزینه‌های دوره‌ای (اجاره، حقوق و…) حداکثر یک بار برای هر ماه شمسی ایجاد می‌شوند.
        <button class="btn btn-outline btn-sm mr-8" id="btn-gen" type="button" style="margin-right:8px">ایجاد هزینه‌های دوره جاری</button>
      </div></div>

      <div class="tabs">
        <button class="tab ${tab === 'list' ? 'active' : ''}" data-tab="list" type="button">${icon('expense')} اسناد هزینه</button>
        <button class="tab ${tab === 'cats' ? 'active' : ''}" data-tab="cats" type="button">${icon('settings')} دسته‌های هزینه</button>
      </div>

      <div class="card" id="tab-body"></div>
    </div>`;

  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    renderTab();
  }));
  root.querySelector('#btn-new').addEventListener('click', () => expenseModal());
  root.querySelector('#btn-tpl').addEventListener('click', () => { tab = 'list'; templatesModal(); });
  root.querySelector('#btn-gen').addEventListener('click', async () => {
    try {
      const r = await generateRecurring(ctx.month);
      if (r.created.length) toast(`${toFa(r.created.length)} هزینه دوره‌ای برای ${ctx.month} ایجاد شد`);
      else toast('هزینه‌های این دوره قبلاً ثبت شده‌اند (بدون تکرار)', 'info');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });

  renderTab();
}

function renderTab() {
  const el = document.getElementById('tab-body');
  if (tab === 'cats') renderCats(el);
  else renderList(el);
}

function renderList(el) {
  if (!ctx.expenses.length) {
    el.innerHTML = emptyState({
      title: 'هزینه‌ای ثبت نشده',
      text: 'اجاره، قبوض، حقوق و سایر هزینه‌ها را ثبت کنید',
      actionHtml: '<button class="btn btn-primary" id="empty-new" type="button">ثبت هزینه</button>',
      iconName: 'expense',
    });
    el.querySelector('#empty-new')?.addEventListener('click', () => expenseModal());
    return;
  }
  const table = buildTable({
    columns: [
      { key: 'date', label: 'تاریخ', cls: 'num', width: '95px' },
      { key: 'category', label: 'دسته' },
      { key: 'description', label: 'شرح' },
      { key: 'sourceLabel', label: 'پرداخت از', render: (r) => (r.source === 'cash' ? '<span class="badge green">صندوق</span>' : '<span class="badge blue">بانک</span>') },
      { key: 'typeLabel', label: 'نوع', render: (r) => (r.recurringId ? '<span class="badge gold">دوره‌ای</span>' : '') },
      { key: 'amountText', label: 'مبلغ', cls: 'num' },
    ],
    rows: ctx.expenses.map((e) => ({
      ...e,
      amountText: fmtMoney(e.amount),
      sourceLabel: e.source === 'cash' ? 'صندوق' : 'بانک',
      typeLabel: e.recurringId ? 'دوره‌ای' : 'عادی',
    })),
    searchKeys: ['description', 'category'],
    excel: { filename: `expenses-${ctx.month}`, sheetName: 'هزینه‌ها' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });
  table.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => expenseModal(ctx.expenses.find((x) => x.id === b.dataset.edit))));
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog('سند هزینه حذف شود؟ از صندوق نیز کسر خواهد شد.', { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try { await deleteExpense(b.dataset.del); toast('هزینه حذف شد'); await render(document.getElementById('page')); }
    catch (e) { toast(e.message, 'error'); }
  }));
  el.innerHTML = '';
  el.appendChild(table);
}

function renderCats(el) {
  const cats = ctx.settings.expenseCategories || [];
  el.innerHTML = `
    <div class="card-title">${icon('settings')} دسته‌بندی هزینه‌ها
      <div class="spacer"></div>
      <button class="btn btn-outline btn-sm" id="add-cat" type="button">${icon('plus')} دسته جدید</button>
    </div>
    <div class="flex flex-wrap" style="gap:9px">
      ${cats.map((c) => `
        <span class="badge" style="font-size:13px;padding:7px 14px">
          ${escapeHtml(c)}
          <button class="btn btn-ghost btn-sm" data-del-cat="${escapeHtml(c)}" type="button" style="padding:0 4px;color:var(--danger)">${icon('x')}</button>
        </span>`).join('') || '<span class="text-muted">دسته‌ای ثبت نشده</span>'}
    </div>
    <div class="alert info mt-16">${icon('info')}<div>این دسته‌ها در فرم ثبت هزینه به‌صورت پیشنهادی نمایش داده می‌شوند.</div></div>`;

  el.querySelector('#add-cat').addEventListener('click', async () => {
    const content = document.createElement('div');
    content.innerHTML = fieldText({ id: 'nc-name', label: 'نام دسته هزینه', placeholder: 'مثلاً بیمه' });
    const modal = openModal({
      title: 'دسته هزینه جدید', content,
      footer: `<button class="btn btn-primary" data-save type="button">افزودن</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
    });
    modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
    modal.foot.querySelector('[data-save]').addEventListener('click', () => {
      const name = content.querySelector('#nc-name').value.trim();
      if (!name) { toast('نام دسته را وارد کنید', 'warn'); return; }
      const list = getSettings().expenseCategories || [];
      if (!list.includes(name)) saveSettings({ expenseCategories: [...list, name] });
      modal.close();
      toast('دسته افزوده شد');
      render(document.getElementById('page'));
    });
  });

  el.querySelectorAll('[data-del-cat]').forEach((b) => b.addEventListener('click', async () => {
    const name = b.dataset.delCat;
    const used = ctx.expenses.some((e) => e.category === name);
    if (used) { toast('این دسته در اسناد هزینه استفاده شده و قابل حذف نیست', 'warn'); return; }
    const ok = await confirmDialog(`دسته «${name}» حذف شود؟`, { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    saveSettings({ expenseCategories: (getSettings().expenseCategories || []).filter((c) => c !== name) });
    toast('حذف شد');
    render(document.getElementById('page'));
  }));
}

function expenseModal(exp = null) {
  const cats = getSettings().expenseCategories || [];
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldDate({ id: 'x-date', label: 'تاریخ', value: exp?.date || todayJalali() })}
      ${fieldText({ id: 'x-cat', label: 'دسته', value: exp?.category || '', placeholder: 'انتخاب یا تایپ' , hint: cats.length ? `پیشنهادی: ${cats.slice(0, 4).join('، ')}` : ''})}
      ${fieldNum({ id: 'x-amount', label: 'مبلغ (تومان)', value: exp ? String(exp.amount) : '', placeholder: '0' })}
      ${fieldSelect({ id: 'x-source', label: 'منبع پرداخت', options: [{ value: 'cash', label: 'صندوق (نقدی)' }, { value: 'card', label: 'حساب بانکی' }], value: exp?.source || 'cash', placeholder: null, hint: 'پرداخت از صندوق در گردش نقدی لحاظ می‌شود' })}
    </div>
    <div class="mt-8">${fieldTextarea({ id: 'x-desc', label: 'شرح', value: exp?.description || '', placeholder: 'مثلاً قبض برق مهر' })}</div>
    ${exp?.recurringId ? `<div class="alert warn mt-8">${icon('refresh')}<div>این سند دوره‌ای است و برای ماه ${escapeHtml(exp.month || '')} ثبت شده (کلید یکتا: بدون امکان دوباره‌شماری)</div></div>` : ''}`;

  const modal = openModal({
    title: exp ? 'ویرایش هزینه' : 'ثبت هزینه جدید',
    content,
    footer: `<button class="btn btn-primary" data-save type="button">ذخیره</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const payload = {
        date: content.querySelector('#x-date').value.trim() || todayJalali(),
        category: content.querySelector('#x-cat').value,
        amount: content.querySelector('#x-amount').value,
        source: content.querySelector('#x-source').value,
        description: content.querySelector('#x-desc').value,
      };
      if (exp) await updateExpense(exp.id, payload);
      else await addExpense(payload);
      modal.close();
      toast('هزینه ذخیره شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

function templatesModal() {
  const renderBody = async () => {
    const tpls = await listTemplates();
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="alert info mb-16">${icon('info')}<div>قالب‌ها هر ماه یک بار به‌صورت خودکار یا با دکمه «ایجاد هزینه‌های دوره جاری» به سند هزینه تبدیل می‌شوند؛ کلید یکتا مانع ثبت تکراری می‌شود.</div></div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr><th>دسته</th><th class="num">مبلغ</th><th>منبع</th><th class="num">روز</th><th></th></tr></thead>
          <tbody>
            ${tpls.length ? tpls.map((t) => `
              <tr>
                <td>${escapeHtml(t.category)}${t.description ? `<div class="text-sm text-muted">${escapeHtml(t.description)}</div>` : ''}</td>
                <td class="num">${fmtMoney(t.amount)}</td>
                <td>${t.source === 'cash' ? 'صندوق' : 'بانک'}</td>
                <td class="num">${toFa(t.day)}</td>
                <td class="actions"><button class="btn btn-ghost btn-sm text-danger" data-del-tpl="${t.id}" type="button">${icon('trash')}</button></td>
              </tr>`).join('') : '<tr><td class="table-empty" colspan="5">قالبی ثبت نشده</td></tr>'}
          </tbody>
        </table>
      </div>
      <div class="form-grid mt-16" id="tpl-form">
        ${fieldText({ id: 't-cat', label: 'دسته', placeholder: 'مثلاً اجاره' })}
        ${fieldNum({ id: 't-amount', label: 'مبلغ ماهانه', placeholder: '0' })}
        ${fieldSelect({ id: 't-source', label: 'منبع', options: [{ value: 'cash', label: 'صندوق' }, { value: 'card', label: 'بانک' }], placeholder: null })}
        ${fieldNum({ id: 't-day', label: 'روز ماه', value: '1', min: '1' })}
      </div>
      <div class="mt-8">${fieldText({ id: 't-desc', label: 'شرح', placeholder: 'اختیاری' })}</div>`;

    content.querySelectorAll('[data-del-tpl]').forEach((b) => b.addEventListener('click', async () => {
      const ok = await confirmDialog('قالب حذف شود؟ اسناد ثبت‌شده قبلی باقی می‌مانند.', { danger: true, confirmText: 'حذف' });
      if (!ok) return;
      await deleteTemplate(b.dataset.delTpl);
      toast('قالب حذف شد');
      modal.close();
      templatesModal();
    }));

    return content;
  };

  const holder = document.createElement('div');
  const modal = openModal({
    title: 'قالب هزینه‌های دوره‌ای',
    content: holder,
    size: 'wide',
    footer: `<button class="btn btn-primary" data-add type="button">${icon('plus')} افزودن قالب</button><button class="btn btn-ghost" data-close2 type="button">بستن</button>`,
  });
  renderBody().then((c) => holder.appendChild(c));
  modal.foot.querySelector('[data-close2]').addEventListener('click', () => { modal.close(); render(document.getElementById('page')); });
  modal.foot.querySelector('[data-add]').addEventListener('click', async () => {
    try {
      await addTemplate({
        category: holder.querySelector('#t-cat')?.value,
        amount: holder.querySelector('#t-amount')?.value,
        source: holder.querySelector('#t-source')?.value,
        day: holder.querySelector('#t-day')?.value,
        description: holder.querySelector('#t-desc')?.value,
      });
      toast('قالب افزوده شد');
      modal.close();
      templatesModal();
    } catch (e) { toast(e.message, 'error'); }
  });
}
