/* ============================================================
   صفحه دستور پخت — رسپی غذاها و بهای تمام‌شده
   ============================================================ */

import { listRecipes, saveRecipe, deleteRecipe, foodCost, menuCosts } from '../services/recipeService.js';
import { listFoods } from '../services/menuService.js';
import { listIngredients, unitsFor, toBaseQty } from '../services/inventoryService.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldSelect, fieldNum, fieldTextarea,
} from '../ui/components.js';
import { fmtMoney, fmtQty, fmtPercent, toFa, escapeHtml, num } from '../core/utils.js';

export const path = 'recipes';
export const title = 'دستور پخت';
export const iconKey = 'flask';

let ctx = null;

export async function render(root) {
  ctx = {
    foods: await listFoods(),
    ings: await listIngredients(),
    recipes: await listRecipes(),
    costs: await menuCosts(),
  };

  const withRecipe = ctx.costs.filter((c) => c.hasRecipe).length;

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>دستور پخت و رسپی</h2>
        <div class="spacer"></div>
        <span class="badge gold">${toFa(withRecipe)} غذا دارای رسپی</span>
        <button class="btn btn-gold" id="btn-new" type="button">${icon('plus')} رسپی جدید</button>
      </div>

      <div class="alert info mb-16">${icon('info')}<div>با ثبت رسپی، بهای تمام‌شده غذا به‌صورت خودکار از بهای میانگین موزون مواد محاسبه می‌شود و پس از هر فروش، مواد اولیه از انبار کسر خواهد شد.</div></div>

      <div class="card" id="list"></div>
    </div>`;

  root.querySelector('#btn-new').addEventListener('click', () => pickFoodModal());
  renderList();
}

function renderList() {
  const el = document.getElementById('list');
  if (!ctx.foods.length) {
    el.innerHTML = emptyState({
      title: 'غذایی در منو نیست',
      text: 'ابتدا از بخش مدیریت منو غذا تعریف کنید',
      actionHtml: '<button class="btn btn-primary" id="go-menu" type="button">مدیریت منو</button>',
      iconName: 'flask',
    });
    el.querySelector('#go-menu')?.addEventListener('click', () => { window.location.hash = '#/menu'; });
    return;
  }

  const table = buildTable({
    columns: [
      { key: 'name', label: 'غذا' },
      { key: 'catName', label: 'دسته' },
      { key: 'recipeText', label: 'اقلام رسپی' },
      { key: 'costText', label: 'بهای تمام‌شده', cls: 'num' },
      { key: 'priceText', label: 'قیمت فروش', cls: 'num' },
      {
        key: 'marginText', label: 'حاشیه سود', cls: 'num',
        render: (r) => r.hasRecipe ? `<b class="${r.margin >= 40 ? 'text-success' : r.margin >= 15 ? 'text-gold' : 'text-danger'}">${fmtPercent(r.margin)}</b>` : '—',
      },
    ],
    rows: ctx.costs.map((c) => {
      const rec = ctx.recipes.find((x) => x.foodId === c.food.id);
      return {
        id: c.food.id,
        name: c.food.name,
        catName: c.categoryName,
        hasRecipe: c.hasRecipe,
        recipeText: rec && rec.items.length ? `${toFa(rec.items.length)} قلم` : '—',
        costText: c.hasRecipe ? fmtMoney(c.cost) : 'بدون رسپی',
        priceText: fmtMoney(c.food.price),
        margin: c.margin,
        marginText: fmtPercent(c.margin),
      };
    }),
    searchKeys: ['name', 'catName'],
    excel: { filename: 'recipes-costs', sheetName: 'رسپی و بهای تمام‌شده' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')} رسپی</button>
        ${r.hasRecipe ? `<button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>` : ''}
      </div>`,
  });

  table.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => openRecipe(b.dataset.edit)));
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog('رسپی این غذا حذف شود؟ فروش‌های قبلی تغییری نمی‌کنند.', { danger: true, confirmText: 'حذف رسپی' });
    if (!ok) return;
    try { await deleteRecipe(b.dataset.del); toast('رسپی حذف شد'); await render(document.getElementById('page')); }
    catch (e) { toast(e.message, 'error'); }
  }));

  el.innerHTML = '';
  el.appendChild(table);
}

function pickFoodModal() {
  if (!ctx.foods.length) { toast('ابتدا غذا تعریف کنید', 'warn'); return; }
  const content = document.createElement('div');
  content.innerHTML = fieldSelect({
    id: 'p-food', label: 'انتخاب غذا',
    options: ctx.foods.map((f) => ({ value: f.id, label: f.name })),
    placeholder: null,
  });
  const modal = openModal({
    title: 'انتخاب غذا برای رسپی',
    content,
    footer: `<button class="btn btn-primary" data-ok type="button">ادامه</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-ok]').addEventListener('click', () => {
    const id = content.querySelector('#p-food').value;
    modal.close();
    openRecipe(id);
  });
}

async function openRecipe(foodId) {
  const food = ctx.foods.find((f) => f.id === foodId);
  if (!food) return;
  if (!ctx.ings.length) {
    toast('ابتدا مواد اولیه تعریف کنید', 'warn');
    return;
  }
  const existing = await listRecipes().then((rs) => rs.find((r) => r.foodId === foodId));
  let lines = existing?.items ? JSON.parse(JSON.stringify(existing.items)) : [];

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert info mb-16">${icon('info')}<div>غذا: <b>${escapeHtml(food.name)}</b> — قیمت فروش: <b>${fmtMoney(food.price)} تومان</b></div></div>
    <div id="lines"></div>
    <button class="btn btn-outline btn-sm mt-8" id="add-line" type="button">${icon('plus')} افزودن قلم</button>
    <div class="flex mt-16" style="justify-content:space-between;background:var(--surface-2);padding:12px 14px;border-radius:12px">
      <span class="text-bold">بهای تمام‌شده یک پرس:</span>
      <span class="text-gold text-bold" id="cost-live">—</span>
    </div>
    <div class="mt-8">${fieldTextarea({ id: 'r-notes', label: 'نکات پخت', value: existing?.notes || '', placeholder: 'اختیاری' })}</div>
    <div id="cost-detail" class="mt-8"></div>`;

  const linesBox = content.querySelector('#lines');

  const ingOptions = (selected) => ctx.ings.map((i) =>
    `<option value="${i.id}" ${i.id === selected ? 'selected' : ''}>${escapeHtml(i.name)}</option>`).join('');

  const addLine = (line = null) => {
    const row = document.createElement('div');
    row.className = 'flex flex-wrap gap-8 mb-8';
    row.style.gap = '8px';
    row.innerHTML = `
      <select class="select" data-l-ing style="flex:2;min-width:170px;min-height:38px">${ingOptions(line?.ingredientId)}</select>
      <input class="input num" data-l-qty value="${line ? line.qty : ''}" placeholder="مقدار" inputmode="decimal" style="width:96px;min-height:38px" />
      <select class="select" data-l-unit style="width:120px;min-height:38px"></select>
      <button class="btn btn-ghost btn-sm" data-l-del type="button">${icon('trash')}</button>`;

    const unitSel = row.querySelector('[data-l-unit]');
    const syncUnits = () => {
      const ing = ctx.ings.find((i) => i.id === row.querySelector('[data-l-ing]').value);
      if (!ing) return;
      unitSel.innerHTML = unitsFor(ing).map((u) =>
        `<option value="${escapeHtml(u.name)}" ${line && line.unit === u.name ? 'selected' : (!line && u.name === ing.baseUnit ? 'selected' : '')}>${escapeHtml(u.name)}</option>`).join('');
    };
    row.querySelector('[data-l-ing]').addEventListener('change', syncUnits);
    syncUnits();

    row.querySelector('[data-l-del]').addEventListener('click', () => { row.remove(); updateCost(); });
    row.querySelectorAll('input,select').forEach((i) => i.addEventListener('input', updateCost));
    linesBox.appendChild(row);
  };

  const collect = () => [...linesBox.querySelectorAll('[data-l-ing]')].map((sel) => {
    const row = sel.closest('div');
    return {
      ingredientId: sel.value,
      qty: num(row.querySelector('[data-l-qty]').value, 0),
      unit: row.querySelector('[data-l-unit]').value,
    };
  }).filter((l) => l.qty > 0);

  const updateCost = async () => {
    const items = collect();
    let total = 0;
    const rows = [];
    for (const it of items) {
      const ing = ctx.ings.find((i) => i.id === it.ingredientId);
      if (!ing) continue;
      const baseQty = toBaseQty(ing, it.qty, it.unit);
      const v = baseQty * num(ing.wac, 0);
      total += v;
      rows.push(`<div class="s-row"><span class="label">${escapeHtml(ing.name)} (${fmtQty(it.qty)} ${escapeHtml(it.unit)})</span><span class="mono-num">${fmtMoney(v)}</span></div>`);
    }
    content.querySelector('#cost-live').textContent = `${fmtMoney(Math.round(total))} تومان`;
    content.querySelector('#cost-detail').innerHTML = rows.length
      ? `<div class="summary-rows">${rows.join('')}</div>`
      : '<div class="text-sm text-muted">اقلام رسپی را وارد کنید تا بهای تمام‌شده نمایش داده شود.</div>';
  };

  content.querySelector('#add-line').addEventListener('click', () => { addLine(); updateCost(); });
  lines.forEach((l) => addLine(l));
  updateCost();

  const modal = openModal({
    title: `رسپی «${food.name}»`,
    content, size: 'wide',
    footer: `<button class="btn btn-primary" data-save type="button">ذخیره رسپی</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      await saveRecipe(foodId, collect(), content.querySelector('#r-notes').value);
      modal.close();
      toast('رسپی ذخیره شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}
