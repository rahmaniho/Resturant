/* ============================================================
   صفحه مدیریت منو — دسته‌بندی و غذا (نامحدود)
   ============================================================ */

import {
  listCategories, addCategory, updateCategory, deleteCategory,
  listFoods, addFood, updateFood, deleteFood, seedSuggestedMenu,
} from '../services/menuService.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldTextarea, fieldSelect,
} from '../ui/components.js';
import { fmtMoney, toFa, escapeHtml, normalize, readFileAsDataURL } from '../core/utils.js';

export const path = 'menu';
export const title = 'مدیریت منو';
export const iconKey = 'menuBook';

let ctx = null;

export async function render(root) {
  ctx = {
    cats: await listCategories(),
    foods: await listFoods(),
    tab: 'foods',
  };
  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>منوی غذایی</h2>
        <div class="spacer"></div>
        <button class="btn btn-outline" id="btn-seed" type="button" title="ساخت دسته‌ها و غذاهای پیشنهادی (قابل حذف)">${icon('plus')} منوی پیشنهادی</button>
        <button class="btn btn-primary" id="btn-new-cat" type="button">${icon('plus')} دسته جدید</button>
        <button class="btn btn-gold" id="btn-new-food" type="button">${icon('plus')} غذای جدید</button>
      </div>

      <div class="tabs">
        <button class="tab ${ctx.tab === 'foods' ? 'active' : ''}" data-tab="foods" type="button">${icon('menuBook')} غذاها (${toFa(ctx.foods.length)})</button>
        <button class="tab ${ctx.tab === 'cats' ? 'active' : ''}" data-tab="cats" type="button">${icon('box')} دسته‌بندی‌ها (${toFa(ctx.cats.length)})</button>
      </div>

      <div class="card" id="tab-content"></div>
    </div>`;

  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    ctx.tab = b.dataset.tab;
    root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === ctx.tab));
    renderTab();
  }));
  root.querySelector('#btn-new-cat').addEventListener('click', () => categoryModal());
  root.querySelector('#btn-new-food').addEventListener('click', () => foodModal());
  root.querySelector('#btn-seed').addEventListener('click', async () => {
    const ok = await confirmDialog(
      'دسته‌ها و غذاهای پیشنهادی (صبحانه، املت، پیتزا و…) به‌عنوان داده اضافه می‌شوند. همه قابل ویرایش و حذف‌اند و چیزی در کد ثابت نمی‌شود. ادامه می‌دهید؟',
      { title: 'منوی پیشنهادی', confirmText: 'ساخت منو' }
    );
    if (!ok) return;
    const r = await seedSuggestedMenu();
    toast(`${toFa(r.addedCats)} دسته و ${toFa(r.addedFoods)} غذا اضافه شد`);
    await refresh();
  });

  renderTab();
}

async function refresh() {
  ctx.cats = await listCategories();
  ctx.foods = await listFoods();
  const root = document.getElementById('page');
  const active = root.querySelector('.tab.active')?.dataset.tab || ctx.tab;
  await render(root);
  ctx.tab = active;
  root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === active));
  renderTab();
}

function renderTab() {
  const el = document.getElementById('tab-content');
  if (ctx.tab === 'cats') renderCats(el);
  else renderFoods(el);
}

function renderCats(el) {
  if (!ctx.cats.length) {
    el.innerHTML = emptyState({
      title: 'دسته‌بندی‌ای وجود ندارد',
      text: 'اولین دسته منو را بسازید یا از منوی پیشنهادی استفاده کنید',
      actionHtml: '<button class="btn btn-primary" id="empty-cat" type="button">ساخت دسته</button>',
      iconName: 'box',
    });
    el.querySelector('#empty-cat')?.addEventListener('click', () => categoryModal());
    return;
  }
  const foodCount = (id) => ctx.foods.filter((f) => f.categoryId === id).length;
  const table = buildTable({
    columns: [
      { key: 'name', label: 'نام دسته' },
      { key: 'count', label: 'تعداد غذا', cls: 'num', render: (r) => toFa(r.count) },
      { key: 'note', label: 'توضیح' },
    ],
    rows: ctx.cats.map((c) => ({ ...c, count: foodCount(c.id) })),
    searchKeys: ['name', 'note'],
    excel: { filename: 'categories', sheetName: 'دسته‌بندی' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });
  table.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => categoryModal(ctx.cats.find((c) => c.id === b.dataset.edit))));
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const c = ctx.cats.find((x) => x.id === b.dataset.del);
    const ok = await confirmDialog(`دسته «${c.name}» حذف شود؟`, { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try { await deleteCategory(c.id); toast('دسته حذف شد'); await refresh(); }
    catch (e) { toast(e.message, 'error'); }
  }));
  el.innerHTML = '';
  el.appendChild(table);
}

function renderFoods(el) {
  if (!ctx.cats.length) {
    el.innerHTML = emptyState({
      title: 'ابتدا دسته‌بندی بسازید',
      text: 'هر غذا باید در یک دسته قرار بگیرد',
      actionHtml: '<button class="btn btn-primary" id="empty-cat2" type="button">ساخت دسته</button>',
      iconName: 'box',
    });
    el.querySelector('#empty-cat2')?.addEventListener('click', () => { ctx.tab = 'cats'; renderTab(); categoryModal(); });
    return;
  }
  const catMap = new Map(ctx.cats.map((c) => [c.id, c.name]));
  const table = buildTable({
    columns: [
      {
        key: 'name', label: 'غذا',
        render: (r) => `<div class="flex" style="gap:9px">${r.image ? `<img src="${escapeHtml(r.image)}" style="width:34px;height:34px;border-radius:8px;object-fit:cover" alt="" />` : ''}<div><b>${escapeHtml(r.name)}</b>${r.description ? `<div class="text-sm text-muted">${escapeHtml(r.description)}</div>` : ''}</div></div>`,
      },
      { key: 'catName', label: 'دسته' },
      { key: 'priceText', label: 'قیمت', cls: 'num' },
      { key: 'status', label: 'وضعیت', render: (r) => (r.active === false ? '<span class="badge red">غیرفعال</span>' : '<span class="badge green">فعال</span>') },
    ],
    rows: ctx.foods.map((f) => ({ ...f, catName: catMap.get(f.categoryId) || '—', priceText: fmtMoney(f.price) })),
    searchKeys: ['name', 'catName', 'description'],
    excel: { filename: 'menu', sheetName: 'غذاها' },
    rowActions: (r) => `
      <div class="row-actions">
        <button class="btn btn-ghost btn-sm" data-edit="${r.id}" type="button">${icon('edit')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button">${icon('trash')}</button>
      </div>`,
  });
  table.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => foodModal(ctx.foods.find((f) => f.id === b.dataset.edit))));
  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const f = ctx.foods.find((x) => x.id === b.dataset.del);
    const ok = await confirmDialog(`غذای «${f.name}» حذف شود؟ رسپی آن نیز حذف می‌شود.`, { danger: true, confirmText: 'حذف' });
    if (!ok) return;
    try { await deleteFood(f.id); toast('غذا حذف شد'); await refresh(); }
    catch (e) { toast(e.message, 'error'); }
  }));
  el.innerHTML = '';
  el.appendChild(table);
}

function categoryModal(cat = null) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldText({ id: 'f-name', label: 'نام دسته‌بندی', value: cat?.name || '', placeholder: 'مثلاً صبحانه' })}
      ${fieldText({ id: 'f-note', label: 'توضیح (اختیاری)', value: cat?.note || '', placeholder: 'اختیاری' })}
    </div>`;
  const modal = openModal({
    title: cat ? 'ویرایش دسته' : 'دسته جدید',
    content,
    footer: `<button class="btn btn-primary" data-save type="button">ذخیره</button><button class="btn btn-outline" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    const name = content.querySelector('#f-name').value;
    const note = content.querySelector('#f-note').value;
    try {
      if (cat) await updateCategory(cat.id, { name, note });
      else await addCategory({ name, note });
      modal.close();
      toast('دسته ذخیره شد');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
  });
}

function foodModal(food = null) {
  if (!ctx.cats.length) {
    toast('ابتدا یک دسته‌بندی بسازید', 'warn');
    ctx.tab = 'cats';
    renderTab();
    categoryModal();
    return;
  }
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldText({ id: 'f-name', label: 'نام غذا', value: food?.name || '', placeholder: 'مثلاً املت گوجه' })}
      ${fieldSelect({ id: 'f-cat', label: 'دسته‌بندی', options: ctx.cats.map((c) => ({ value: c.id, label: c.name })), value: food?.categoryId || ctx.cats[0].id, placeholder: null })}
      ${fieldNum({ id: 'f-price', label: 'قیمت (تومان)', value: food ? String(food.price) : '', placeholder: '0' })}
    </div>
    <div class="form-grid mt-8">
      ${fieldTextarea({ id: 'f-desc', label: 'توضیح', value: food?.description || '', placeholder: 'اختیاری' })}
    </div>
    <div class="flex mt-16" style="gap:16px;flex-wrap:wrap">
      <label class="checkbox-row"><input type="checkbox" id="f-active" ${food?.active !== false ? 'checked' : ''} /> فعال در فروش</label>
      <label class="btn btn-outline btn-sm" style="cursor:pointer">
        ${icon('edit')} تصویر غذا
        <input type="file" accept="image/*" id="f-image" hidden />
      </label>
      <span class="text-sm text-muted" id="img-state">${food?.image ? 'تصویر دارد' : 'بدون تصویر'}</span>
    </div>
    <div id="img-preview" class="mt-8">${food?.image ? `<img src="${escapeHtml(food.image)}" style="height:80px;border-radius:10px" alt="" />` : ''}</div>`;

  let imageData = food?.image || null;
  content.querySelector('#f-image').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 900 * 1024) { toast('حجم تصویر باید کمتر از ۹۰۰ کیلوبایت باشد', 'warn'); return; }
    imageData = await readFileAsDataURL(file);
    content.querySelector('#img-preview').innerHTML = `<img src="${imageData}" style="height:80px;border-radius:10px" alt="" />`;
    content.querySelector('#img-state').textContent = 'تصویر انتخاب شد';
  });

  const modal = openModal({
    title: food ? 'ویرایش غذا' : 'غذای جدید',
    content,
    size: 'wide',
    footer: `<button class="btn btn-primary" data-save type="button">ذخیره</button><button class="btn btn-outline" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    const payload = {
      name: content.querySelector('#f-name').value,
      categoryId: content.querySelector('#f-cat').value,
      price: content.querySelector('#f-price').value,
      description: content.querySelector('#f-desc').value,
      active: content.querySelector('#f-active').checked,
      image: imageData,
    };
    try {
      if (food) await updateFood(food.id, payload);
      else await addFood(payload);
      modal.close();
      toast('غذا ذخیره شد');
      await refresh();
    } catch (e) { toast(e.message, 'error'); }
  });
}
