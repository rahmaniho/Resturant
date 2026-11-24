/* ============================================================
   صفحه مواد اولیه — تعریف، واحدها، موجودی، هشدارها
   ============================================================ */

import {
  listIngredients, addIngredient, updateIngredient, deleteIngredient,
  unitsFor, BASE_UNITS, toBaseQty,
} from '../services/inventoryService.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldTextarea, fieldSelect, fieldDate,
} from '../ui/components.js';
import { fmtMoney, fmtQty, fmtPercent, toFa, escapeHtml, num } from '../core/utils.js';
import { stockValue } from '../core/money.js';

export const path = 'ingredients';
export const title = 'مواد اولیه';
export const iconKey = 'box';

let ctx = null;

export async function render(root) {
  ctx = { items: await listIngredients() };
  const totalVal = stockValue(ctx.items);
  const low = ctx.items.filter((i) => i.minStock > 0 && num(i.stock, 0) <= num(i.minStock, 0));
  const expiring = ctx.items.filter((i) => i.expiryDate);

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>مواد اولیه</h2>
        <div class="spacer"></div>
        <button class="btn btn-gold" id="btn-new" type="button">${icon('plus')} ماده جدید</button>
      </div>

      <div class="kpi-grid">
        <div class="kpi"><div class="kpi-label">${icon('box')} تعداد مواد</div><div class="kpi-value">${toFa(ctx.items.length)}</div></div>
        <div class="kpi gold"><div class="kpi-label">${icon('wallet')} ارزش موجودی انبار</div><div class="kpi-value">${fmtMoney(totalVal)}<span class="unit">تومان</span></div></div>
        <div class="kpi ${low.length ? 'bad' : 'good'}"><div class="kpi-label">${icon('alert')} کمبود موجودی</div><div class="kpi-value">${toFa(low.length)}<span class="unit">مورد</span></div></div>
        <div class="kpi"><div class="kpi-label">${icon('calendar')} دارای تاریخ انقضا</div><div class="kpi-value">${toFa(expiring.length)}<span class="unit">مورد</span></div></div>
      </div>

      <div class="card" id="list"></div>
    </div>`;

  root.querySelector('#btn-new').addEventListener('click', () => modal());
  renderList();
}

function renderList() {
  const el = document.getElementById('list');
  if (!ctx.items.length) {
    el.innerHTML = emptyState({
      title: 'ماده اولیه‌ای ثبت نشده',
      text: 'موادی مثل تخم‌مرغ، گوجه، نان و پنیر را تعریف کنید تا انبار و فروش خودکار شود',
      actionHtml: '<button class="btn btn-primary" id="empty-new" type="button">ثبت ماده اولیه</button>',
      iconName: 'box',
    });
    el.querySelector('#empty-new')?.addEventListener('click', () => modal());
    return;
  }

  const table = buildTable({
    columns: [
      {
        key: 'name', label: 'ماده اولیه',
        render: (r) => `<b>${escapeHtml(r.name)}</b>${r.notes ? `<div class="text-sm text-muted">${escapeHtml(r.notes)}</div>` : ''}`,
      },
      { key: 'baseUnit', label: 'واحد پایه' },
      { key: 'unitsText', label: 'واحدها', render: (r) => `<span class="text-sm text-muted">${escapeHtml(r.unitsText)}</span>` },
      { key: 'stockText', label: 'موجودی', cls: 'num' },
      { key: 'wacText', label: 'بهای میانگین', cls: 'num' },
      { key: 'valueText', label: 'ارزش', cls: 'num' },
      {
        key: 'status', label: 'وضعیت',
        render: (r) => {
          if (r.low) return '<span class="badge red">کمبود</span>';
          if (r.expired) return '<span class="badge red">منقضی</span>';
          if (r.soon) return `<span class="badge warn">انقضا ${fmtDateShort(r.expiryDate)}</span>`;
          return '<span class="badge green">نرمال</span>';
        },
      },
    ],
    rows: ctx.items.map((i) => {
      const stock = num(i.stock, 0);
      const low = i.minStock > 0 && stock <= num(i.minStock, 0);
      const today = new Date();
      const exp = i.expiryDate;
      return {
        ...i,
        unitsText: unitsFor(i).filter((u) => u.factor !== 1).map((u) => `${u.name}(${fmtQty(u.factor)})`).join('، ') || '—',
        stockText: `${fmtQty(stock)} ${i.baseUnit}`,
        wacText: fmtMoney(i.wac),
        valueText: fmtMoney(stock * num(i.wac, 0)),
        low, expired: exp && exp < todayJ(), soon: exp && !low && exp <= addDays(todayJ(), 7),
      };
    }),
    searchKeys: ['name', 'notes', 'baseUnit'],
    excel: { filename: 'ingredients', sheetName: 'مواد اولیه' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });

  table.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => modal(ctx.items.find((i) => i.id === b.dataset.edit))));
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const it = ctx.items.find((x) => x.id === b.dataset.del);
    const ok = await confirmDialog(`ماده «${it.name}» حذف شود؟ (فقط در صورت نبود گردش انبار)`, { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try { await deleteIngredient(it.id); toast('ماده حذف شد'); await render(document.getElementById('page')); }
    catch (e) { toast(e.message, 'error'); }
  }));

  el.innerHTML = '';
  el.appendChild(table);
}

function modal(ing = null) {
  const content = document.createElement('div');
  const units = ing ? unitsFor(ing).filter((u) => u.factor !== 1) : [];
  content.innerHTML = `
    <div class="form-grid">
      ${fieldText({ id: 'i-name', label: 'نام ماده اولیه', value: ing?.name || '', placeholder: 'مثلاً تخم‌مرغ' })}
      ${fieldSelect({ id: 'i-base', label: 'واحد پایه', options: BASE_UNITS, value: ing?.baseUnit || 'گرم', placeholder: null, hint: 'موجودی به این واحد نگهداری می‌شود' })}
      ${fieldNum({ id: 'i-min', label: 'حداقل موجودی (هشدار)', value: ing ? String(ing.minStock) : '0' })}
      ${fieldDate({ id: 'i-exp', label: 'تاریخ انقضا (اختیاری)', value: ing?.expiryDate || '', hint: 'انقضای آخرین محموله' })}
    </div>

    <div class="card-title mt-16" style="font-size:13.5px">واحدهای تبدیل <span class="text-sm text-muted">نسبت به واحد پایه</span>
      <div class="spacer"></div>
      <button class="btn btn-outline btn-sm" id="add-unit" type="button">${icon('plus')} واحد</button>
    </div>
    <div id="unit-rows" class="flex flex-wrap" style="gap:8px;align-items:flex-end"></div>

    <div class="mt-16">${fieldTextarea({ id: 'i-notes', label: 'یادداشت', value: ing?.notes || '', placeholder: 'اختیاری' })}</div>
    ${ing ? `<div class="alert info mt-16">${icon('info')}<div>موجودی فعلی: <b>${fmtQty(ing.stock)} ${escapeHtml(ing.baseUnit)}</b> — بهای میانگین: <b>${fmtMoney(ing.wac)}</b> تومان (از بخش انبار قابل شمارش و اصلاح است)</div></div>` : ''}
  `;

  const unitsBox = content.querySelector('#unit-rows');
  const addUnitRow = (name = '', factor = '') => {
    const row = document.createElement('div');
    row.className = 'field';
    row.style.width = '190px';
    row.innerHTML = `
      <label>واحد / ضریب</label>
      <div class="flex" style="gap:6px">
        <input class="input" placeholder="مثلاً کیلوگرم" value="${escapeHtml(name)}" data-u-name style="min-height:38px" />
        <input class="input num" placeholder="ضریب" value="${escapeHtml(factor)}" data-u-factor inputmode="decimal" style="width:86px;min-height:38px" />
        <button class="btn btn-ghost btn-sm" data-u-del type="button">${icon('x')}</button>
      </div>`;
    row.querySelector('[data-u-del]').addEventListener('click', () => row.remove());
    unitsBox.appendChild(row);
  };
  units.forEach((u) => addUnitRow(u.name, String(u.factor)));
  content.querySelector('#add-unit').addEventListener('click', () => addUnitRow());

  const modalApi = openModal({
    title: ing ? 'ویرایش ماده اولیه' : 'ماده اولیه جدید',
    content, size: 'wide',
    footer: `<button class="btn btn-primary" data-save type="button">ذخیره</button><button class="btn btn-outline" data-cancel type="button">انصراف</button>`,
  });
  modalApi.foot.querySelector('[data-cancel]').addEventListener('click', modalApi.close);
  modalApi.foot.querySelector('[data-save]').addEventListener('click', async () => {
    const customUnits = [...unitsBox.querySelectorAll('.field')].map((row) => ({
      name: row.querySelector('[data-u-name]').value.trim(),
      factor: num(row.querySelector('[data-u-factor]').value, 0),
    })).filter((u) => u.name);
    const payload = {
      name: content.querySelector('#i-name').value,
      baseUnit: content.querySelector('#i-base').value,
      minStock: content.querySelector('#i-min').value,
      expiryDate: content.querySelector('#i-exp').value.trim() || null,
      units: customUnits,
      notes: content.querySelector('#i-notes').value,
    };
    try {
      if (ing) await updateIngredient(ing.id, payload);
      else await addIngredient(payload);
      modalApi.close();
      toast('ماده اولیه ذخیره شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* کمکی‌های تاریخ محلی */
import { todayJalali, addDaysJalali } from '../core/utils.js';
function todayJ() { return todayJalali(); }
function addDays(d, n) { return addDaysJalali(d, n); }
function fmtDateShort(d) { return d ? d.slice(5).replace('-', '/') : ''; }
