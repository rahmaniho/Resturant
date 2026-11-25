/* ============================================================
   صفحه مواد اولیه — تعریف، واحدها، موجودی، هشدارها
   ============================================================ */

import {
  listIngredients, addIngredient, updateIngredient, deleteIngredient,
  unitsFor, BASE_UNITS, toBaseQty, materialFlow,
} from '../services/inventoryService.js';
import { listPurchases } from '../services/purchaseService.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldTextarea, fieldSelect, fieldDate,
} from '../ui/components.js';
import { fmtMoney, fmtQty, fmtPercent, toFa, toEn, escapeHtml, num, fmtDate } from '../core/utils.js';
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
        <button class="btn btn-ghost btn-sm" data-flow="${r.id}" type="button" title="گردش و سابقه قیمت">${icon('refresh')}</button>
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });

  table.querySelectorAll('[data-flow]').forEach((b) => b.addEventListener('click', () => flowModal(b.dataset.flow)));
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
      expiryDate: toEn(content.querySelector('#i-exp').value).trim() || null,
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

/* ---------- گردش ماده و سابقه قیمت خرید ---------- */

async function flowModal(ingId) {
  const ing = ctx.items.find((i) => i.id === ingId);
  if (!ing) return;
  const [{ ingredient, rows }, purchases] = await Promise.all([
    materialFlow(ingId),
    listPurchases(),
  ]);

  // سابقه قیمت خرید این ماده
  const priceHistory = [];
  for (const p of purchases) {
    for (const line of p.lines || []) {
      if (line.ingredientId !== ingId) continue;
      priceHistory.push({
        date: p.date, supplier: p.supplierName,
        qty: line.qty, unit: line.unit,
        unitPrice: line.unitPrice, total: line.total,
        wacBefore: line.wacBefore,
      });
    }
  }
  priceHistory.sort((a, b) => b.date.localeCompare(a.date));

  const typeBadge = (t) => {
    const map = { in: ['green', 'ورود'], out: ['blue', 'خروج'], waste: ['red', 'ضایعات'], adjust: ['gold', 'اصلاح'] };
    const [cls, label] = map[t] || ['', t];
    return `<span class="badge ${cls}">${label}</span>`;
  };

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="kpi-grid" style="grid-template-columns:repeat(auto-fill,minmax(160px,1fr))">
      <div class="kpi"><div class="kpi-label">موجودی فعلی</div><div class="kpi-value" style="font-size:18px">${fmtQty(ingredient.stock)} <span class="unit">${escapeHtml(ingredient.baseUnit)}</span></div></div>
      <div class="kpi gold"><div class="kpi-label">بهای میانگین</div><div class="kpi-value" style="font-size:18px">${fmtMoney(ingredient.wac)}</div></div>
      <div class="kpi"><div class="kpi-label">ارزش موجودی</div><div class="kpi-value" style="font-size:18px">${fmtMoney(num(ingredient.stock, 0) * num(ingredient.wac, 0))}</div></div>
      <div class="kpi"><div class="kpi-label">تعداد گردش</div><div class="kpi-value" style="font-size:18px">${toFa(rows.length)}</div></div>
    </div>

    <div class="card-title mt-16">${icon('truck')} سابقه قیمت خرید (${toFa(priceHistory.length)} سند)</div>
    ${priceHistory.length ? `
      <div class="table-wrap">
        <table class="data" style="min-width:0">
          <thead><tr><th>تاریخ</th><th>تأمین‌کننده</th><th class="num">مقدار</th><th class="num">قیمت واحد</th><th class="num">جمع</th></tr></thead>
          <tbody>
            ${priceHistory.map((h) => `
              <tr>
                <td>${fmtDate(h.date)}</td>
                <td>${escapeHtml(h.supplier)}</td>
                <td class="num">${fmtQty(h.qty)} ${escapeHtml(h.unit)}</td>
                <td class="num">${fmtMoney(h.unitPrice)}</td>
                <td class="num">${fmtMoney(h.total)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      <div class="text-sm text-muted mt-8">میانگین بهای خرید اخیر: <b class="text-gold">${fmtMoney(priceHistory.slice(0, 5).reduce((s, h) => s + num(h.unitPrice, 0), 0) / Math.min(5, priceHistory.length))}</b> تومان (۵ خرید آخر)</div>
    ` : '<div class="text-muted text-sm">هنوز خریدی برای این ماده ثبت نشده است</div>'}

    <div class="card-title mt-16">${icon('refresh')} گردش انبار (${toFa(rows.length)} حرکت)</div>
    ${rows.length ? `
      <div class="table-wrap" style="max-height:300px;overflow:auto">
        <table class="data" style="min-width:0">
          <thead><tr><th>تاریخ</th><th>نوع</th><th class="num">مقدار</th><th class="num">ارزش</th><th>شرح</th><th class="num">موجودی بعد</th></tr></thead>
          <tbody>
            ${rows.slice().reverse().map((m) => `
              <tr>
                <td>${fmtDate(m.date)} <span class="text-muted text-sm">${toFa(m.time || '')}</span></td>
                <td>${typeBadge(m.type)}</td>
                <td class="num">${m.qty > 0 ? '+' : ''}${fmtQty(m.qty)}</td>
                <td class="num">${fmtMoney(Math.abs(num(m.value, 0)))}</td>
                <td class="truncate mw-200">${escapeHtml(m.note || '—')}</td>
                <td class="num">${fmtQty(m.stockAfter)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>` : '<div class="text-muted text-sm">گردشی ثبت نشده است</div>'}
  `;

  openModal({ title: `گردش «${ing.name}»`, content, size: 'xwide' });
}

/* کمکی‌های تاریخ محلی */
import { todayJalali, addDaysJalali } from '../core/utils.js';
function todayJ() { return todayJalali(); }
function addDays(d, n) { return addDaysJalali(d, n); }
function fmtDateShort(d) { return d ? d.slice(5).replace('-', '/') : ''; }
