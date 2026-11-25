/* ============================================================
   صفحه ثبت فروش — کارتخوان سریع + سوابق فروش
   ============================================================ */

import { listCategories, listFoods } from '../services/menuService.js';
import { createSale, listSales, deleteSale, receiveCredit, outstandingCredits } from '../services/salesService.js';
import { ICONS, icon, toast, confirmDialog, buildTable, emptyState, openModal, datePickerHTML } from '../ui/components.js';
import { exportReceipt, printReceipt } from '../core/receipt.js';
import { fmtMoney, fmtDate, fmtDateLong, toFa, toEn, num, normalize, todayJalali, escapeHtml, roundToman, formatNumInput } from '../core/utils.js';

export const path = 'sales';
export const title = 'ثبت فروش';
export const iconKey = 'cart';

let state = null;

/* ---------- پیش‌نویس سبد (localStorage) ---------- */
const DRAFT_KEY = 'aftab.cart.draft';

function saveDraft() {
  try {
    if (!state || !state.cart.length) { localStorage.removeItem(DRAFT_KEY); return; }
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      items: state.cart,
      discount: state.discount,
      payments: state.payments,
      customer: state.customer,
      savedAt: Date.now(),
    }));
  } catch { /* noop */ }
}

function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || !Array.isArray(d.items) || !d.items.length) return null;
    return d;
  } catch { return null; }
}

export async function render(root) {
  const [cats, foods, outstanding] = await Promise.all([listCategories(), listFoods(), outstandingCredits()]);

  // بازیابی پیش‌نویس سبد (فقط اقلامی که هنوز در منو هستند)
  const draft = loadDraft();
  const draftItems = draft ? draft.items.filter((i) => foods.some((f) => f.id === i.foodId)) : [];

  state = {
    cats, foods,
    activeCat: 'all',
    search: '',
    cart: draftItems,
    discount: draft ? num(draft.discount, 0) : 0,
    payments: draft
      ? { cash: num(draft.payments?.cash, 0), card: num(draft.payments?.card, 0), credit: num(draft.payments?.credit, 0) }
      : { cash: 0, card: 0, credit: 0 },
    customer: draft && draft.customer ? { name: draft.customer.name || '', phone: draft.customer.phone || '' } : { name: '', phone: '' },
    listDate: todayJalali(),
    sales: await listSales({ date: todayJalali() }),
    outstanding,
  };
  if (draftItems.length) {
    setTimeout(() => toast('پیش‌نویس سبد قبلی بازیابی شد', 'info', 3000), 400);
  }

  root.innerHTML = `
    <div class="page-enter">
      <div class="pos-layout">
        <div>
          <div class="card">
            <div class="card-title">
              ${icon('menuBook')} انتخاب غذا
              <div class="spacer"></div>
              <div class="search-box" style="position:relative;min-width:200px">
                ${icon('search')}
                <input class="input" id="food-search" placeholder="جست‌وجوی غذا…" style="padding-right:36px" />
              </div>
            </div>
            <div class="cat-chips" id="cat-chips"></div>
            <div class="food-grid" id="food-grid"></div>
          </div>

          <div class="card mt-16">
            <div class="card-title">
              ${icon('cart')} سوابق فروش
              <div class="spacer"></div>
              <input class="input" id="list-date" dir="ltr" style="width:140px;min-height:36px;padding:5px 10px" value="${state.listDate}" placeholder="1405-08-03" title="تاریخ سوابق فروش" />
              <button class="btn btn-outline btn-sm" id="btn-excel" type="button">${icon('excel')} اکسل</button>
            </div>
            <div id="credit-bar" class="mb-8"></div>
            <div id="sales-list"></div>
          </div>
        </div>

        <div class="card cart-panel" id="cart-panel">
          <!-- سبد خرید -->
        </div>
      </div>
    </div>

    <div id="cart-fab" role="status" aria-label="سبد خرید">
      <span class="fab-count" id="fab-count">۰</span>
      <span class="fab-total" id="fab-total">۰ تومان</span>
      <button class="btn btn-gold" id="fab-go" type="button">دیدن سبد و پرداخت</button>
    </div>`;

  renderChips();
  renderFoods();
  renderCart();

  root.querySelector('#food-search').addEventListener('input', (e) => {
    state.search = e.target.value;
    renderFoods();
  });

  const dateInput = root.querySelector('#list-date');
  dateInput?.addEventListener('change', async () => {
    const v = normalize(dateInput.value);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { toast('تاریخ را با قالب 1405-08-03 وارد کنید', 'warn'); return; }
    state.listDate = v;
    state.sales = await listSales({ date: v });
    renderSalesList();
  });

  root.querySelector('#btn-excel').addEventListener('click', () => {
    import('../core/exporters.js').then(({ exportTableExcel: ex }) => {
      ex(`frosh-${state.listDate}`, 'فروش', [
        { key: 'time', label: 'ساعت' },
        { key: 'itemsText', label: 'اقلام' },
        { key: 'subtotal', label: 'جمع' },
        { key: 'discount', label: 'تخفیف' },
        { key: 'total', label: 'مبلغ کل' },
        { key: 'cash', label: 'نقدی' },
        { key: 'card', label: 'کارت' },
        { key: 'credit', label: 'نسیه' },
        { key: 'cogs', label: 'بهای تمام‌شده' },
        { key: 'customerName', label: 'مشتری' },
      ], state.sales.map((s) => ({
        time: s.time,
        itemsText: s.items.map((i) => `${i.foodName}×${i.qty}`).join('، '),
        subtotal: s.subtotal, discount: s.discount, total: s.total,
        cash: s.payments.cash, card: s.payments.card, credit: s.payments.credit,
        cogs: s.cogs, customerName: s.customer?.name || '',
      })));
      toast('فایل اکسل ساخته شد');
    });
  });

  renderCreditBar();
  renderSalesList();
}

/** نوار طلب باقی‌مانده نسیه‌ها */
function renderCreditBar() {
  const el = document.getElementById('credit-bar');
  if (!el) return;
  const o = state.outstanding;
  if (!o || !o.total) {
    el.innerHTML = `<div class="alert success" style="padding:8px 13px;font-size:12.5px">${icon('check')}<div>طلب باقی‌مانده‌ای از مشتریان نیست</div></div>`;
    return;
  }
  el.innerHTML = `
    <div class="alert warn" style="padding:9px 13px;font-size:13px;align-items:center">
      ${icon('cart')}
      <div style="flex:1">طلب نسیه باقی‌مانده: <b>${fmtMoney(o.total)} تومان</b> از ${toFa(o.sales.length)} فروش</div>
      <button class="btn btn-gold btn-sm" id="btn-show-credit" type="button">مشاهده و دریافت</button>
    </div>`;
  el.querySelector('#btn-show-credit')?.addEventListener('click', () => showCreditList());
}

/** فهرست فروش‌های دارای طلب باقی‌مانده */
function showCreditList() {
  const rows = state.outstanding.sales;
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert info mb-16">${icon('info')}<div>جمع طلب باقی‌مانده: <b>${fmtMoney(state.outstanding.total)} تومان</b> — دریافت‌ها مستقیماً وارد صندوق می‌شود.</div></div>
    <div class="table-wrap">
      <table class="data">
        <thead><tr><th>تاریخ</th><th>مشتری</th><th>اقلام</th><th class="num">کل فروش</th><th class="num">طلب باقی</th><th></th></tr></thead>
        <tbody>
          ${rows.map((s) => `
            <tr>
              <td>${fmtDate(s.date)}</td>
              <td>${escapeHtml(s.customer?.name || '—')}</td>
              <td class="truncate mw-200">${escapeHtml(s.items.map((i) => i.foodName).join('، '))}</td>
              <td class="num">${fmtMoney(s.total)}</td>
              <td class="num"><b class="text-danger">${fmtMoney(s.creditRemaining)}</b></td>
              <td class="actions"><button class="btn btn-gold btn-sm" data-receive="${s.id}" type="button">دریافت</button></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  const modal = openModal({ title: 'طلبات نسیه', content, size: 'wide' });
  content.querySelectorAll('[data-receive]').forEach((b) => b.addEventListener('click', () => {
    modal.close();
    receiveModal(state.outstanding.sales.find((s) => s.id === b.dataset.receive));
  }));
}

/** مودال دریافت طلب از مشتری */
function receiveModal(sale) {
  if (!sale) return;
  const remaining = num(sale.creditRemaining, 0);
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert warn mb-16">${icon('alert')}<div>
      فروش ${fmtDate(sale.date)}${sale.customer?.name ? ` — ${escapeHtml(sale.customer.name)}` : ''}<br/>
      طلب باقی‌مانده: <b>${fmtMoney(remaining)} تومان</b>
    </div></div>
    <div class="form-grid">
      <div class="field">
        <label for="rc-amount">مبلغ دریافتی (تومان)</label>
        <input class="input num" id="rc-amount" dir="ltr" inputmode="decimal" value="${formatNumInput(remaining)}" />
      </div>
      <div class="field">
        <label for="rc-date-day">تاریخ دریافت</label>
        ${datePickerHTML('rc-date', todayJalali())}
      </div>
    </div>
    <div class="mt-8"><input class="input" id="rc-note" placeholder="یادداشت (اختیاری)" /></div>`;

  const modal = openModal({
    title: 'دریافت طلب نسیه',
    content,
    footer: `<button class="btn btn-primary" data-save type="button">${icon('check')} ثبت دریافت</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const { sale: updated } = await receiveCredit({
        saleId: sale.id,
        amount: content.querySelector('#rc-amount').value,
        date: toEn(content.querySelector('#rc-date').value).trim() || todayJalali(),
        note: content.querySelector('#rc-note').value,
      });
      modal.close();
      toast(updated.creditRemaining > 0
        ? `دریافت ثبت شد؛ باقی‌مانده: ${fmtMoney(updated.creditRemaining)} تومان`
        : 'طلب کاملاً تسویه شد', 'success');
      await refreshAfterChange();
    } catch (e) { toast(e.message, 'error'); }
  });
}

/** به‌روزرسانی فهرست فروش و طلب‌ها پس از تغییر */
async function refreshAfterChange() {
  state.sales = await listSales({ date: state.listDate });
  state.outstanding = await outstandingCredits();
  document.getElementById('fab-go')?.addEventListener('click', () => {
    document.getElementById('cart-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  renderCreditBar();
  renderSalesList();
}

/** به‌روزرسانی نوار سبد شناور (موبایل) */
function updateFab() {
  const fab = document.getElementById('cart-fab');
  if (!fab) return;
  const count = state.cart.reduce((s, l) => s + l.qty, 0);
  document.getElementById('fab-count').textContent = toFa(count);
  document.getElementById('fab-total').textContent = `${fmtMoney(cartTotals().total)} تومان`;
  const show = state.cart.length > 0;
  fab.classList.toggle('visible', show);
  document.getElementById('page')?.classList.toggle('has-cart-fab', show);
}

function renderChips() {
  const el = document.getElementById('cat-chips');
  const chips = [{ id: 'all', name: 'همه' }, ...state.cats];
  el.innerHTML = chips.map((c) =>
    `<button class="chip ${state.activeCat === c.id ? 'active' : ''}" data-cat="${c.id}" type="button">${escapeHtml(c.name)}</button>`
  ).join('');
  el.querySelectorAll('[data-cat]').forEach((b) => b.addEventListener('click', () => {
    state.activeCat = b.dataset.cat;
    renderChips();
    renderFoods();
  }));
}

function renderFoods() {
  const el = document.getElementById('food-grid');
  let foods = state.foods.filter((f) => f.active !== false);
  if (state.activeCat !== 'all') foods = foods.filter((f) => f.categoryId === state.activeCat);
  if (state.search) {
    const q = normalize(state.search);
    foods = foods.filter((f) => normalize(f.name).includes(q));
  }
  const catMap = new Map(state.cats.map((c) => [c.id, c.name]));

  if (!state.cats.length) {
    el.innerHTML = emptyState({
      title: 'منو تعریف نشده',
      text: 'ابتدا از بخش «مدیریت منو» دسته‌بندی و غذا بسازید',
      actionHtml: '<button class="btn btn-primary" id="go-menu" type="button">رفتن به مدیریت منو</button>',
      iconName: 'menuBook',
    });
    document.getElementById('go-menu')?.addEventListener('click', () => { window.location.hash = '#/menu'; });
    return;
  }
  if (!foods.length) {
    el.innerHTML = emptyState({ title: 'غذایی یافت نشد', text: 'دسته یا جست‌وجو را تغییر دهید' });
    return;
  }
  el.innerHTML = foods.map((f) => `
    <button class="food-card" data-food="${f.id}" type="button">
      ${f.image ? `<img src="${escapeHtml(f.image)}" alt="" />` : ''}
      <span class="fc-name">${escapeHtml(f.name)}</span>
      <span class="fc-cat">${escapeHtml(catMap.get(f.categoryId) || '')}</span>
      <span class="fc-price">${fmtMoney(f.price)} تومان</span>
    </button>`).join('');

  el.querySelectorAll('[data-food]').forEach((b) => b.addEventListener('click', () => addToCart(b.dataset.food)));
}

function addToCart(foodId) {
  const food = state.foods.find((f) => f.id === foodId);
  if (!food) return;
  const line = state.cart.find((c) => c.foodId === foodId);
  if (line) line.qty += 1;
  else state.cart.push({ foodId, name: food.name, price: num(food.price, 0), qty: 1 });
  renderCart();
}

function cartTotals() {
  const subtotal = roundToman(state.cart.reduce((s, l) => s + l.price * l.qty, 0));
  const discount = Math.min(roundToman(state.discount || 0), subtotal);
  const total = subtotal - discount;
  return { subtotal, discount, total };
}

function renderCart() {
  const el = document.getElementById('cart-panel');
  if (!el) return;
  const { subtotal, discount, total } = cartTotals();
  const p = state.payments;
  const paySum = roundToman(num(p.cash, 0) + num(p.card, 0) + num(p.credit, 0));

  updateFab();
  saveDraft();

  el.innerHTML = `
    <div class="card-title">${icon('cart')} سبد فروش</div>
    ${state.cart.length ? `
      <div class="cart-lines">
        ${state.cart.map((l, i) => `
          <div class="cart-line" data-i="${i}">
            <div class="cl-name">${escapeHtml(l.name)}<small>${fmtMoney(l.price)} × ${toFa(l.qty)}</small></div>
            <div class="qty-box">
              <button data-dec type="button">−</button>
              <span>${toFa(l.qty)}</span>
              <button data-inc type="button">+</button>
            </div>
            <button class="btn btn-ghost btn-sm" data-del type="button" title="حذف">${icon('trash')}</button>
          </div>`).join('')}
      </div>
      <div class="cart-totals">
        <div class="row"><span>جمع کالاها</span><span class="mono-num">${fmtMoney(subtotal)}</span></div>
        <div class="row">
          <span>تخفیف</span>
          <span><input class="input num" id="discount-input" style="width:110px;min-height:32px;padding:3px 8px;text-align:left" inputmode="decimal" value="${state.discount ? formatNumInput(state.discount) : ''}" placeholder="0" /></span>
        </div>
        <div class="row grand"><span>مبلغ قابل پرداخت</span><span class="mono-num">${fmtMoney(total)}</span></div>
      </div>

      <div class="pay-grid">
        <div class="field"><label>نقدی</label><input class="input num" id="pay-cash" inputmode="decimal" value="${p.cash ? formatNumInput(p.cash) : ''}" placeholder="0" /></div>
        <div class="field"><label>کارت‌خوان</label><input class="input num" id="pay-card" inputmode="decimal" value="${p.card ? formatNumInput(p.card) : ''}" placeholder="0" /></div>
        <div class="field"><label>نسیه</label><input class="input num" id="pay-credit" inputmode="decimal" value="${p.credit ? formatNumInput(p.credit) : ''}" placeholder="0" /></div>
      </div>
      <div class="flex mt-8" style="justify-content:space-between">
        <span class="text-sm ${paySum === total ? 'text-success' : 'text-danger'}">جمع پرداخت: ${fmtMoney(paySum)}</span>
        <button class="btn btn-ghost btn-sm" id="pay-full" type="button">پرداخت کامل نقدی</button>
      </div>

      <div id="credit-fields" class="mt-8 ${num(p.credit, 0) > 0 ? '' : 'hidden'}">
        <div class="field mb-8"><label>نام مشتری (نسیه)</label><input class="input" id="cust-name" value="${escapeHtml(state.customer.name)}" placeholder="اختیاری" /></div>
        <div class="field"><label>تلفن</label><input class="input" id="cust-phone" value="${escapeHtml(state.customer.phone)}" placeholder="اختیاری" dir="ltr" /></div>
      </div>

      <button class="btn btn-gold btn-lg btn-block mt-16" id="btn-submit-sale" type="button">${icon('check')} ثبت فروش — ${fmtMoney(total)} تومان</button>
      <button class="btn btn-ghost btn-block mt-8" id="btn-clear-cart" type="button">خالی کردن سبد</button>
    ` : emptyState({ title: 'سبد خالی است', text: 'از لیست غذاها انتخاب کنید', iconName: 'cart' })}
  `;

  if (!state.cart.length) return;

  el.querySelectorAll('.cart-line').forEach((row) => {
    const i = Number(row.dataset.i);
    row.querySelector('[data-inc]')?.addEventListener('click', () => { state.cart[i].qty += 1; renderCart(); });
    row.querySelector('[data-dec]')?.addEventListener('click', () => {
      state.cart[i].qty -= 1;
      if (state.cart[i].qty <= 0) state.cart.splice(i, 1);
      renderCart();
    });
    row.querySelector('[data-del]')?.addEventListener('click', () => { state.cart.splice(i, 1); renderCart(); });
  });

  const bindNum = (id, fn) => {
    el.querySelector(id)?.addEventListener('input', (e) => {
      fn(num(e.target.value, 0));
      const pos = e.target.selectionStart;
      renderCart();
      const next = document.querySelector(id);
      next?.focus();
      try { next?.setSelectionRange(pos, pos); } catch { /* noop */ }
    });
  };
  bindNum('#discount-input', (v) => { state.discount = v; });
  bindNum('#pay-cash', (v) => { state.payments.cash = v; });
  bindNum('#pay-card', (v) => { state.payments.card = v; });
  bindNum('#pay-credit', (v) => {
    state.payments.credit = v;
  });

  // نمایش فیلدهای مشتری وقتی نسیه > 0 — با re-render ساده
  el.querySelector('#pay-credit')?.addEventListener('change', () => {
    document.getElementById('credit-fields')?.classList.toggle('hidden', num(state.payments.credit, 0) <= 0);
  });

  // همگام‌سازی اطلاعات مشتری با پیش‌نویس (بدون رندر مجدد تا فوکوس از بین نرود)
  el.querySelector('#cust-name')?.addEventListener('input', (e) => { state.customer.name = e.target.value; saveDraft(); });
  el.querySelector('#cust-phone')?.addEventListener('input', (e) => { state.customer.phone = e.target.value; saveDraft(); });

  el.querySelector('#pay-full')?.addEventListener('click', () => {
    state.payments = { cash: cartTotals().total, card: 0, credit: 0 };
    renderCart();
  });

  el.querySelector('#btn-clear-cart')?.addEventListener('click', () => {
    state.cart = [];
    state.discount = 0;
    state.payments = { cash: 0, card: 0, credit: 0 };
    state.customer = { name: '', phone: '' };
    renderCart();
  });

  el.querySelector('#btn-submit-sale')?.addEventListener('click', submitSale);
}

async function submitSale() {
  const { total } = cartTotals();
  if (!state.cart.length) return;

  try {
    const { sale, warnings } = await createSale({
      items: state.cart.map((c) => ({ foodId: c.foodId, qty: c.qty, unitPrice: c.price })),
      discount: state.discount,
      payments: state.payments,
      customer: { name: state.customer.name, phone: state.customer.phone },
    });
    state.cart = [];
    state.discount = 0;
    state.payments = { cash: 0, card: 0, credit: 0 };
    state.customer = { name: '', phone: '' };
    await refreshAfterChange();
    renderCart();
    toast(`فروش ${fmtMoney(sale.total)} تومان ثبت شد`, 'success');
    (warnings || []).forEach((w) => toast(w, 'warn', 5000));
  } catch (e) {
    toast(e.message || 'خطا در ثبت فروش', 'error', 5000);
  }
}

function renderSalesList() {
  const el = document.getElementById('sales-list');
  if (!el) return;
  if (!state.sales.length) {
    el.innerHTML = emptyState({ title: 'فروشی در این تاریخ نیست', text: 'اسناد فروش اینجا نمایش داده می‌شوند' });
    return;
  }
  const table = buildTable({
    columns: [
      { key: 'time', label: 'ساعت', cls: 'num', width: '70px' },
      { key: 'itemsText', label: 'اقلام' },
      { key: 'totalText', label: 'مبلغ', cls: 'num' },
      {
        key: 'payText', label: 'پرداخت',
        render: (r) => `<span class="badge">${escapeHtml(r.payText)}</span>`,
      },
      { key: 'cogsText', label: 'بهای تمام‌شده', cls: 'num' },
      {
        key: 'profitText', label: 'سود', cls: 'num',
        render: (r) => `<b class="${r.profit >= 0 ? 'text-success' : 'text-danger'}">${fmtMoney(r.profit)}</b>`,
      },
    ],
    rows: state.sales.map((s) => ({
      ...s,
      itemsText: s.items.map((i) => `${i.foodName} ×${i.qty}`).join('، '),
      totalText: fmtMoney(s.total),
      payText: [
        s.payments.cash ? `نقد ${fmtMoney(s.payments.cash)}` : '',
        s.payments.card ? `کارت ${fmtMoney(s.payments.card)}` : '',
        s.payments.credit ? `نسیه ${fmtMoney(s.payments.credit)}` : '',
      ].filter(Boolean).join(' + '),
      cogsText: fmtMoney(s.cogs),
      profit: s.total - s.cogs,
      profitText: fmtMoney(s.total - s.cogs),
    })),
    searchKeys: ['itemsText', 'customer'],
    excel: { filename: `sales-${state.listDate}`, sheetName: 'فروش' },
    rowActions: (r) => `
      <div class="row-actions">
        ${num(r.creditRemaining, 0) > 0 ? `<button class="btn btn-gold btn-sm" data-receive="${r.id}" type="button">دریافت ${fmtMoney(r.creditRemaining)}</button>` : ''}
        <button class="btn btn-ghost btn-sm" data-view="${r.id}" type="button" title="جزئیات">${icon('eye')}</button>
        <button class="btn btn-ghost btn-sm text-danger" data-del="${r.id}" type="button" title="حذف">${icon('trash')}</button>
      </div>`,
    caption: fmtDate(state.listDate),
  });

  table.querySelectorAll('[data-receive]').forEach((b) => b.addEventListener('click', () => {
    const s = state.sales.find((x) => x.id === b.dataset.receive);
    if (s) receiveModal(s);
  }));

  table.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    const ok = await confirmDialog('سند فروش حذف و مواد اولیه مصرف‌شده به انبار بازگردانده می‌شود. ادامه می‌دهید؟', { danger: true, confirmText: 'حذف فروش' });
    if (!ok) return;
    try {
      await deleteSale(b.dataset.del);
      await refreshAfterChange();
      toast('فروش حذف و انبار بازگردانی شد');
    } catch (e) { toast(e.message, 'error'); }
  }));

  table.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const s = state.sales.find((x) => x.id === b.dataset.view);
    if (s) showSaleDetail(s);
  }));

  el.innerHTML = '';
  el.appendChild(table);
}

export function showSaleDetail(s) {
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="summary-rows mb-16">
      <div class="s-row"><span class="label">تاریخ</span><span>${fmtDateLong(s.date)} — ${toFa(s.time)}</span></div>
      ${s.customer?.name ? `<div class="s-row"><span class="label">مشتری</span><span>${escapeHtml(s.customer.name)}</span></div>` : ''}
      ${s.note ? `<div class="s-row"><span class="label">یادداشت</span><span>${escapeHtml(s.note)}</span></div>` : ''}
    </div>
    <table class="data" style="min-width:0">
      <thead><tr><th>غذا</th><th class="num">تعداد</th><th class="num">قیمت</th><th class="num">جمع</th><th class="num">بهای تمام‌شده</th></tr></thead>
      <tbody>
        ${s.items.map((i) => `
          <tr>
            <td>${escapeHtml(i.foodName)}</td>
            <td class="num">${toFa(i.qty)}</td>
            <td class="num">${fmtMoney(i.unitPrice)}</td>
            <td class="num">${fmtMoney(i.total)}</td>
            <td class="num">${fmtMoney(i.cost)}</td>
          </tr>`).join('')}
      </tbody>
    </table>
    <div class="summary-rows mt-16">
      <div class="s-row"><span class="label">جمع</span><span class="mono-num">${fmtMoney(s.subtotal)}</span></div>
      ${s.discount ? `<div class="s-row"><span class="label">تخفیف</span><span class="mono-num text-danger">−${fmtMoney(s.discount)}</span></div>` : ''}
      <div class="s-row sub"><span class="label">مبلغ کل</span><span class="mono-num">${fmtMoney(s.total)}</span></div>
      <div class="s-row"><span class="label">نقدی</span><span class="mono-num">${fmtMoney(s.payments.cash)}</span></div>
      <div class="s-row"><span class="label">کارت‌خوان</span><span class="mono-num">${fmtMoney(s.payments.card)}</span></div>
      <div class="s-row"><span class="label">نسیه</span><span class="mono-num">${fmtMoney(s.payments.credit)}</span></div>
      <div class="s-row"><span class="label">بهای تمام‌شده</span><span class="mono-num text-danger">−${fmtMoney(s.cogs)}</span></div>
      <div class="s-row total"><span class="label">سود ناخالص</span><span class="mono-num">${fmtMoney(s.total - s.cogs)}</span></div>
      ${num(s.creditRemaining, 0) > 0 ? `
        <div class="s-row neg"><span class="label">طلب باقی‌مانده از مشتری</span><span class="mono-num"><b>${fmtMoney(s.creditRemaining)}</b></span></div>` : ''}
    </div>
    <div class="flex mt-16 flex-wrap">
      ${num(s.creditRemaining, 0) > 0 ? `<button class="btn btn-gold" id="detail-receive" type="button">${icon('wallet')} دریافت طلب نسیه</button>` : ''}
      <button class="btn btn-outline" id="detail-print" type="button">${icon('pdf')} چاپ فاکتور</button>
      <button class="btn btn-outline" id="detail-pdf" type="button">${icon('pdf')} خروجی PDF فاکتور</button>
    </div>`;

  const modal = openModal({ title: `جزئیات فروش ${toFa(s.id.slice(-6))}`, content, size: 'wide' });
  modal.body.querySelector('#detail-receive')?.addEventListener('click', () => {
    modal.close();
    receiveModal((state?.sales || []).find((x) => x.id === s.id) || s);
  });
  modal.body.querySelector('#detail-print')?.addEventListener('click', () => {
    try {
      printReceipt((state?.sales || []).find((x) => x.id === s.id) || s);
      toast('پنجره چاپ باز شد');
    } catch (e) { toast(e.message || 'خطا در چاپ فاکتور', 'error'); }
  });
  modal.body.querySelector('#detail-pdf')?.addEventListener('click', async () => {
    try {
      toast('در حال ساخت فاکتور…', 'info', 2500);
      await exportReceipt((state?.sales || []).find((x) => x.id === s.id) || s);
      toast('فاکتور PDF ساخته شد');
    } catch (e) { toast(e.message || 'خطا در ساخت فاکتور', 'error'); }
  });
}
