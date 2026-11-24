/* ============================================================
   صفحه خرید و تأمین‌کنندگان — اسناد خرید، بدهی، پرداخت
   ============================================================ */

import {
  listSuppliers, addSupplier, updateSupplier, deleteSupplier,
  createPurchase, listPurchases, deletePurchase, paySupplier,
} from '../services/purchaseService.js';
import { listIngredients, unitsFor } from '../services/inventoryService.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldTextarea, fieldSelect, fieldDate,
} from '../ui/components.js';
import { fmtMoney, fmtQty, toFa, escapeHtml, num, todayJalali, roundToman } from '../core/utils.js';

export const path = 'purchases';
export const title = 'خرید و تأمین‌کنندگان';
export const iconKey = 'truck';

let ctx = null;
let tab = 'purchases';

export async function render(root) {
  ctx = {
    sups: await listSuppliers(),
    ings: await listIngredients(),
    purchases: await listPurchases(),
  };

  const totalDebt = ctx.sups.reduce((s, x) => s + num(x.debt, 0), 0);

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>خرید و تأمین‌کنندگان</h2>
        <div class="spacer"></div>
        <button class="btn btn-outline" id="btn-new-sup" type="button">${icon('plus')} تأمین‌کننده جدید</button>
        <button class="btn btn-gold" id="btn-new-pur" type="button">${icon('plus')} ثبت خرید</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${icon('truck')} تأمین‌کنندگان</div><div class="kpi-value">${toFa(ctx.sups.length)}</div></div>
        <div class="kpi ${totalDebt > 0 ? 'bad' : 'good'}"><div class="kpi-label">${icon('expense')} جمع بدهی</div><div class="kpi-value">${fmtMoney(totalDebt)}<span class="unit">تومان</span></div></div>
        <div class="kpi"><div class="kpi-label">${icon('box')} اسناد خرید</div><div class="kpi-value">${toFa(ctx.purchases.length)}</div></div>
      </div>

      <div class="tabs">
        <button class="tab ${tab === 'purchases' ? 'active' : ''}" data-tab="purchases" type="button">${icon('box')} اسناد خرید</button>
        <button class="tab ${tab === 'suppliers' ? 'active' : ''}" data-tab="suppliers" type="button">${icon('truck')} تأمین‌کنندگان</button>
      </div>

      <div class="card" id="tab-body"></div>
    </div>`;

  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    renderTab();
  }));
  root.querySelector('#btn-new-sup').addEventListener('click', () => supModal());
  root.querySelector('#btn-new-pur').addEventListener('click', () => purchaseModal());

  renderTab();
}

function renderTab() {
  const el = document.getElementById('tab-body');
  if (tab === 'suppliers') renderSuppliers(el);
  else renderPurchases(el);
}

function renderPurchases(el) {
  if (!ctx.purchases.length) {
    el.innerHTML = emptyState({
      title: 'سند خریدی ثبت نشده',
      text: 'خرید مواد اولیه را ثبت کنید تا به انبار اضافه و بدهی تأمین‌کننده محاسبه شود',
      actionHtml: '<button class="btn btn-primary" id="empty-pur" type="button">ثبت خرید</button>',
      iconName: 'truck',
    });
    el.querySelector('#empty-pur')?.addEventListener('click', () => purchaseModal());
    return;
  }
  const table = buildTable({
    columns: [
      { key: 'date', label: 'تاریخ', cls: 'num', width: '95px' },
      { key: 'supplierName', label: 'تأمین‌کننده' },
      { key: 'linesText', label: 'اقلام' },
      { key: 'totalText', label: 'کل', cls: 'num' },
      { key: 'paidText', label: 'پرداخت', cls: 'num' },
      { key: 'remainText', label: 'بدهی', cls: 'num', render: (r) => (r.remaining > 0 ? `<b class="text-danger">${fmtMoney(r.remaining)}</b>` : '—') },
    ],
    rows: ctx.purchases.map((p) => ({
      ...p,
      linesText: p.lines.map((l) => `${l.ingredientName} ${fmtQty(l.qty)}${l.unit ? ' ' + l.unit : ''}`).join('، '),
      totalText: fmtMoney(p.total),
      paidText: fmtMoney(p.paid),
      remainText: fmtMoney(p.remaining),
    })),
    searchKeys: ['supplierName', 'linesText', 'note'],
    excel: { filename: `purchases-${todayJalali()}`, sheetName: 'خریدها' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-view="${r.id}" type="button">${icon('eye')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });

  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog(
      'سند خرید حذف و کالاها از انبار برگردانده می‌شود (بازگردانی میانگین موزون). ادامه؟',
      { danger: true, confirmText: 'حذف سند' }
    );
    if (!ok) return;
    try { await deletePurchase(b.dataset.del); toast('سند حذف و انبار بازگردانی شد'); await render(document.getElementById('page')); }
    catch (e) { toast(e.message, 'error'); }
  }));

  table.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const p = ctx.purchases.find((x) => x.id === b.dataset.view);
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="summary-rows mb-16">
        <div class="s-row"><span class="label">تأمین‌کننده</span><span>${escapeHtml(p.supplierName)}</span></div>
        <div class="s-row"><span class="label">تاریخ</span><span>${escapeHtml(p.date)} — ${toFa(p.time)}</span></div>
        ${p.note ? `<div class="s-row"><span class="label">یادداشت</span><span>${escapeHtml(p.note)}</span></div>` : ''}
      </div>
      <table class="data" style="min-width:0">
        <thead><tr><th>ماده</th><th class="num">مقدار</th><th class="num">واحد پایه</th><th class="num">قیمت واحد</th><th class="num">جمع</th></tr></thead>
        <tbody>${p.lines.map((l) => `
          <tr>
            <td>${escapeHtml(l.ingredientName)}</td>
            <td class="num">${fmtQty(l.qty)} ${escapeHtml(l.unit)}</td>
            <td class="num">${fmtQty(l.qtyBase)}</td>
            <td class="num">${fmtMoney(l.unitPrice)}</td>
            <td class="num">${fmtMoney(l.total)}</td>
          </tr>`).join('')}</tbody>
      </table>
      <div class="summary-rows mt-16">
        <div class="s-row sub"><span class="label">جمع کل</span><span class="mono-num">${fmtMoney(p.total)}</span></div>
        <div class="s-row"><span class="label">پرداخت‌شده</span><span class="mono-num">${fmtMoney(p.paid)}</span></div>
        <div class="s-row"><span class="label">بدهی باقی‌مانده</span><span class="mono-num text-danger">${fmtMoney(p.remaining)}</span></div>
      </div>`;
    openModal({ title: 'جزئیات سند خرید', content, size: 'wide' });
  }));

  el.innerHTML = '';
  el.appendChild(table);
}

function renderSuppliers(el) {
  if (!ctx.sups.length) {
    el.innerHTML = emptyState({
      title: 'تأمین‌کننده‌ای ثبت نشده',
      text: 'تأمین‌کنندگان را ثبت کنید تا بدهی و پرداخت‌ها مدیریت شود',
      actionHtml: '<button class="btn btn-primary" id="empty-sup" type="button">ثبت تأمین‌کننده</button>',
      iconName: 'truck',
    });
    el.querySelector('#empty-sup')?.addEventListener('click', () => supModal());
    return;
  }
  const table = buildTable({
    columns: [
      { key: 'name', label: 'نام' },
      { key: 'phone', label: 'تلفن', cls: 'num' },
      { key: 'address', label: 'آدرس' },
      { key: 'debtText', label: 'بدهی', cls: 'num', render: (r) => (r.debt > 0 ? `<b class="text-danger">${fmtMoney(r.debt)}</b>` : '<span class="badge green">تسویه</span>') },
    ],
    rows: ctx.sups.map((s) => ({ ...s, debtText: fmtMoney(s.debt) })),
    searchKeys: ['name', 'phone', 'address'],
    excel: { filename: 'suppliers', sheetName: 'تأمین‌کنندگان' },
    rowActions: (r) => `
      <div class="row-actions">
        ${r.debt > 0 ? `<button class="btn btn-ghost btn-sm text-success" data-pay="${r.id}" type="button">پرداخت</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });

  table.querySelectorAll('[data-pay]').forEach((b) => b.addEventListener('click', () => payModal(ctx.sups.find((s) => s.id === b.dataset.pay))));
  table.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => supModal(ctx.sups.find((s) => s.id === b.dataset.edit))));
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog('تأمین‌کننده حذف شود؟', { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try { await deleteSupplier(b.dataset.del); toast('حذف شد'); await render(document.getElementById('page')); }
    catch (e) { toast(e.message, 'error'); }
  }));

  el.innerHTML = '';
  el.appendChild(table);
}

function supModal(sup = null) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldText({ id: 's-name', label: 'نام تأمین‌کننده', value: sup?.name || '' })}
      ${fieldText({ id: 's-phone', label: 'تلفن', value: sup?.phone || '', placeholder: '09…' })}
    </div>
    <div class="mt-8">${fieldText({ id: 's-address', label: 'آدرس', value: sup?.address || '' })}</div>
    <div class="mt-8">${fieldTextarea({ id: 's-notes', label: 'یادداشت', value: sup?.notes || '' })}</div>`;
  const modal = openModal({
    title: sup ? 'ویرایش تأمین‌کننده' : 'تأمین‌کننده جدید',
    content,
    footer: `<button class="btn btn-primary" data-save type="button">ذخیره</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const payload = {
        name: content.querySelector('#s-name').value,
        phone: content.querySelector('#s-phone').value,
        address: content.querySelector('#s-address').value,
        notes: content.querySelector('#s-notes').value,
      };
      if (sup) await updateSupplier(sup.id, payload);
      else await addSupplier(payload);
      modal.close();
      toast('ذخیره شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

function payModal(sup) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert warn mb-16">${icon('alert')}<div>بدهی فعلی <b>${escapeHtml(sup.name)}:</b> ${fmtMoney(sup.debt)} تومان</div></div>
    <div class="form-grid">
      ${fieldNum({ id: 'p-amount', label: 'مبلغ پرداخت (تومان)', placeholder: String(sup.debt) })}
      ${fieldDate({ id: 'p-date', label: 'تاریخ', value: todayJalali() })}
    </div>
    <div class="mt-8">${fieldText({ id: 'p-note', label: 'یادداشت', placeholder: 'اختیاری' })}</div>`;
  const modal = openModal({
    title: `پرداخت به ${sup.name}`,
    content,
    footer: `<button class="btn btn-primary" data-save type="button">ثبت پرداخت</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      await paySupplier({
        supplierId: sup.id,
        amount: content.querySelector('#p-amount').value || sup.debt,
        date: content.querySelector('#p-date').value.trim() || todayJalali(),
        note: content.querySelector('#p-note').value,
      });
      modal.close();
      toast('پرداخت ثبت شد و بدهی کاهش یافت');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

function purchaseModal() {
  if (!ctx.ings.length) {
    toast('ابتدا ماده اولیه تعریف کنید', 'warn');
    return;
  }
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldSelect({ id: 'pu-sup', label: 'تأمین‌کننده', options: ctx.sups.map((s) => ({ value: s.id, label: s.name })), placeholder: 'بدون تأمین‌کننده' })}
      ${fieldDate({ id: 'pu-date', label: 'تاریخ خرید', value: todayJalali() })}
    </div>

    <div class="card-title mt-16" style="font-size:13.5px">اقلام خرید
      <div class="spacer"></div>
      <button class="btn btn-outline btn-sm" id="add-line" type="button">${icon('plus')} قلم</button>
    </div>
    <div id="pu-lines"></div>

    <div class="flex mt-16" style="justify-content:space-between;background:var(--surface-2);padding:14px;border-radius:12px;flex-wrap:wrap;gap:10px">
      <div><div class="text-sm text-muted">جمع کل خرید</div><div class="text-bold text-gold" style="font-size:19px" id="pu-total">۰ تومان</div></div>
      <div style="min-width:200px">
        ${fieldNum({ id: 'pu-paid', label: 'پرداخت نقدی (تومان)', placeholder: 'بقیه بدهی می‌شود' })}
      </div>
    </div>
    <div class="mt-8">${fieldText({ id: 'pu-note', label: 'یادداشت', placeholder: 'اختیاری' })}</div>`;

  const linesBox = content.querySelector('#pu-lines');

  const addLine = () => {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap mb-8';
    row.style.gap = '8px';
    row.innerHTML = `
      <select class="select" data-p-ing style="flex:2;min-width:180px;min-height:38px">
        ${ctx.ings.map((i) => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join('')}
      </select>
      <input class="input num" data-p-qty placeholder="مقدار" inputmode="decimal" style="width:92px;min-height:38px" />
      <select class="select" data-p-unit style="width:110px;min-height:38px"></select>
      <input class="input num" data-p-price placeholder="قیمت واحد" inputmode="decimal" style="width:110px;min-height:38px" />
      <span class="text-sm text-muted" data-p-sum style="align-self:center;min-width:90px">—</span>
      <button class="btn btn-ghost btn-sm" data-p-del type="button">${icon('trash')}</button>`;

    const ingSel = row.querySelector('[data-p-ing]');
    const unitSel = row.querySelector('[data-p-unit]');
    const sync = () => {
      const ing = ctx.ings.find((i) => i.id === ingSel.value);
      if (ing) unitSel.innerHTML = unitsFor(ing).map((u) => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join('');
      updateTotal();
    };
    ingSel.addEventListener('change', sync);
    row.querySelectorAll('[data-p-qty],[data-p-price]').forEach((i) => i.addEventListener('input', updateTotal));
    row.querySelector('[data-p-del]').addEventListener('click', () => { row.remove(); updateTotal(); });
    linesBox.appendChild(row);
    sync();
  };

  const collect = () => [...linesBox.querySelectorAll('[data-p-ing]')].map((sel) => {
    const row = sel.closest('div');
    return {
      ingredientId: sel.value,
      qty: num(row.querySelector('[data-p-qty]').value, 0),
      unit: row.querySelector('[data-p-unit]').value,
      unitPrice: num(row.querySelector('[data-p-price]').value, 0),
    };
  }).filter((l) => l.qty > 0);

  function updateTotal() {
    let total = 0;
    linesBox.querySelectorAll('[data-p-ing]').forEach((sel) => {
      const row = sel.closest('div');
      const q = num(row.querySelector('[data-p-qty]').value, 0);
      const p = num(row.querySelector('[data-p-price]').value, 0);
      const sum = roundToman(q * p);
      row.querySelector('[data-p-sum]').textContent = q > 0 ? fmtMoney(sum) : '—';
      total += sum;
    });
    content.querySelector('#pu-total').textContent = `${fmtMoney(total)} تومان`;
    return total;
  }

  content.querySelector('#add-line').addEventListener('click', addLine);
  addLine();

  const modal = openModal({
    title: 'ثبت سند خرید',
    content, size: 'wide',
    footer: `<button class="btn btn-gold" data-save type="button">ثبت خرید و ورود به انبار</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const items = collect();
      if (!items.length) throw new Error('حداقل یک قلم با مقدار معتبر وارد کنید');
      await createPurchase({
        supplierId: content.querySelector('#pu-sup').value || null,
        date: content.querySelector('#pu-date').value.trim() || todayJalali(),
        items,
        paid: content.querySelector('#pu-paid').value || 0,
        note: content.querySelector('#pu-note').value,
      });
      modal.close();
      toast('خرید ثبت و کالاها وارد انبار شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}
