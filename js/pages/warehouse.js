/* ============================================================
   صفحه مدیریت انبار — گردش، ورود/خروج، ضایعات، شمارش، انقضا
   ============================================================ */

import {
  listIngredients, listMovements, manualIn, manualOut,
  recordWaste, applyCount, expiryList, lowStockList, toBaseQty, unitsFor,
} from '../services/inventoryService.js';
import {
  icon, toast, confirmDialog, buildTable, emptyState, openModal,
  fieldText, fieldNum, fieldTextarea, fieldSelect, fieldDate,
} from '../ui/components.js';
import { fmtMoney, fmtQty, toFa, escapeHtml, num, todayJalali, fmtDate } from '../core/utils.js';
import { exportTableExcel } from '../core/exporters.js';

export const path = 'warehouse';
export const title = 'مدیریت انبار';
export const iconKey = 'warehouse';

let ctx = null;
let tab = 'movements';

export async function render(root) {
  ctx = {
    ings: await listIngredients(),
    movs: await listMovements(),
    expiring: await expiryList(7),
    low: await lowStockList(),
  };

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>گردش انبار</h2>
        <div class="spacer"></div>
        <button class="btn btn-primary" id="btn-in" type="button">${icon('arrowIn')} ورود کالا</button>
        <button class="btn btn-outline" id="btn-out" type="button">${icon('arrowOut')} خروج کالا</button>
        <button class="btn btn-danger" id="btn-waste" type="button">${icon('trash')} ثبت ضایعات</button>
        <button class="btn btn-gold" id="btn-count" type="button">${icon('check')} شمارش موجودی</button>
      </div>

      <div class="tabs">
        <button class="tab ${tab === 'movements' ? 'active' : ''}" data-tab="movements" type="button">${icon('refresh')} گردش مواد</button>
        <button class="tab ${tab === 'expiry' ? 'active' : ''}" data-tab="expiry" type="button">${icon('calendar')} انقضا و کمبود ${ctx.expiring.length + ctx.low.length ? `<span class="badge red">${toFa(ctx.expiring.length + ctx.low.length)}</span>` : ''}</button>
      </div>

      <div class="card" id="tab-body"></div>
    </div>`;

  root.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => {
    tab = b.dataset.tab;
    root.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    renderTab();
  }));

  root.querySelector('#btn-in').addEventListener('click', () => ioModal('in'));
  root.querySelector('#btn-out').addEventListener('click', () => ioModal('out'));
  root.querySelector('#btn-waste').addEventListener('click', () => wasteModal());
  root.querySelector('#btn-count').addEventListener('click', () => countModal());

  renderTab();
}

function renderTab() {
  const el = document.getElementById('tab-body');
  if (tab === 'expiry') renderExpiry(el);
  else renderMovements(el);
}

function renderMovements(el) {
  if (!ctx.movs.length) {
    el.innerHTML = emptyState({
      title: 'هنوز گردشی ثبت نشده',
      text: 'ورود از خرید، فروش، ورود/خروج دستی و شمارش اینجا ثبت می‌شوند',
      iconName: 'warehouse',
    });
    return;
  }
  const typeBadge = (t) => {
    const map = { in: ['green', 'ورود'], out: ['blue', 'خروج'], waste: ['red', 'ضایعات'], adjust: ['gold', 'اصلاح'] };
    const [cls, label] = map[t] || ['', t];
    return `<span class="badge ${cls}">${label}</span>`;
  };
  const table = buildTable({
    columns: [
      { key: 'date', label: 'تاریخ', cls: 'num', width: '95px' },
      { key: 'ingredientName', label: 'ماده' },
      { key: 'type', label: 'نوع', render: (r) => typeBadge(r.type) },
      { key: 'qtyText', label: 'مقدار', cls: 'num' },
      { key: 'valueText', label: 'ارزش', cls: 'num' },
      { key: 'note', label: 'شرح' },
      { key: 'stockAfterText', label: 'موجودی بعد', cls: 'num' },
    ],
    rows: ctx.movs.map((m) => ({
      ...m,
      qtyText: `${m.qty > 0 ? '+' : ''}${fmtQty(m.qty)}`,
      valueText: fmtMoney(Math.abs(num(m.value, 0))),
      stockAfterText: fmtQty(m.stockAfter),
    })),
    searchKeys: ['ingredientName', 'note'],
    excel: { filename: `movements-${todayJalali()}`, sheetName: 'گردش انبار' },
    caption: `${toFa(ctx.movs.length)} حرکت`,
  });
  el.innerHTML = '';
  el.appendChild(table);
}

function renderExpiry(el) {
  el.innerHTML = `
    <div class="grid-2">
      <div>
        <div class="card-title">${icon('alert')} کمبود موجودی (${toFa(ctx.low.length)})</div>
        ${ctx.low.length ? `
          <table class="data" style="min-width:0">
            <thead><tr><th>ماده</th><th class="num">موجودی</th><th class="num">حداقل</th></tr></thead>
            <tbody>${ctx.low.map((i) => `
              <tr><td>${escapeHtml(i.name)}</td>
              <td class="num text-danger">${fmtQty(i.stock)} ${escapeHtml(i.baseUnit)}</td>
              <td class="num">${fmtQty(i.minStock)}</td></tr>`).join('')}
            </tbody>
          </table>` : '<div class="alert success">' + icon('check') + '<div>همه مواد بالای حداقل موجودی هستند</div></div>'}
      </div>
      <div>
        <div class="card-title">${icon('calendar')} انقضای نزدیک (${toFa(ctx.expiring.length)})</div>
        ${ctx.expiring.length ? `
          <table class="data" style="min-width:0">
            <thead><tr><th>ماده</th><th class="num">انقضا</th><th>وضعیت</th></tr></thead>
            <tbody>${ctx.expiring.map((i) => `
              <tr><td>${escapeHtml(i.name)}</td>
              <td class="num">${fmtDate(i.expiryDate)}</td>
              <td>${i.expired ? '<span class="badge red">منقضی</span>' : '<span class="badge warn">نزدیک</span>'}</td></tr>`).join('')}
            </tbody>
          </table>` : '<div class="alert success">' + icon('check') + '<div>ماده منقضی یا رو به انقضا نیست</div></div>'}
      </div>
    </div>
    <div class="mt-16">
      <button class="btn btn-outline" id="btn-flow-report" type="button">${icon('excel')} گزارش گردش مواد (اکسل)</button>
    </div>
    <div id="flow-area" class="mt-16"></div>`;

  el.querySelector('#btn-flow-report').addEventListener('click', async () => {
    const movs = await listMovements();
    exportTableExcel(`material-flow-${todayJalali()}`, 'گردش مواد', [
      { key: 'date', label: 'تاریخ' },
      { key: 'ingredientName', label: 'ماده' },
      { key: 'type', label: 'نوع' },
      { key: 'qty', label: 'مقدار' },
      { key: 'value', label: 'ارزش' },
      { key: 'note', label: 'شرح' },
      { key: 'stockAfter', label: 'موجودی بعد' },
    ], movs);
    toast('گزارش گردش مواد ساخته شد');
  });
}

/* ---------- ورود/خروج دستی ---------- */

function ioModal(kind) {
  if (!ctx.ings.length) { toast('ابتدا ماده اولیه تعریف کنید', 'warn'); return; }
  const isIn = kind === 'in';
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldSelect({ id: 'io-ing', label: 'ماده اولیه', options: ctx.ings.map((i) => ({ value: i.id, label: `${i.name} (${fmtQty(i.stock)} ${i.baseUnit})` })), placeholder: null })}
      ${fieldSelect({ id: 'io-unit', label: 'واحد', options: [], placeholder: null })}
      ${fieldNum({ id: 'io-qty', label: 'مقدار', placeholder: '0' })}
      ${isIn ? fieldNum({ id: 'io-cost', label: 'بهای کل خرید (تومان، اختیاری)', placeholder: 'برای به‌روزرسانی میانگین' }) : ''}
      ${fieldDate({ id: 'io-date', label: 'تاریخ', value: todayJalali() })}
    </div>
    <div class="mt-8">${fieldText({ id: 'io-note', label: 'شرح', placeholder: isIn ? 'مثلاً خرید از بازار' : 'مثلاً مصرف آشپزخانه' })}</div>
    <div class="alert info mt-8">${icon('info')}<div id="io-hint">موجودی فعلی نمایش داده می‌شود</div></div>`;

  const ingSel = content.querySelector('#io-ing');
  const unitSel = content.querySelector('#io-unit');
  const syncUnits = () => {
    const ing = ctx.ings.find((i) => i.id === ingSel.value);
    if (!ing) return;
    unitSel.innerHTML = unitsFor(ing).map((u) => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join('');
    content.querySelector('#io-hint').innerHTML = `موجودی فعلی: <b>${fmtQty(ing.stock)} ${escapeHtml(ing.baseUnit)}</b> — بهای میانگین: <b>${fmtMoney(ing.wac)}</b> تومان`;
  };
  ingSel.addEventListener('change', syncUnits);
  setTimeout(syncUnits, 30);

  const modal = openModal({
    title: isIn ? 'ورود کالا به انبار' : 'خروج کالا از انبار',
    content,
    footer: `<button class="btn ${isIn ? 'btn-primary' : 'btn-outline'}" data-save type="button">${isIn ? 'ثبت ورود' : 'ثبت خروج'}</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      const payload = {
        ingredientId: ingSel.value,
        qty: content.querySelector('#io-qty').value,
        unit: unitSel.value,
        date: content.querySelector('#io-date').value.trim() || todayJalali(),
        note: content.querySelector('#io-note').value,
      };
      let r;
      if (isIn) {
        payload.unitCost = content.querySelector('#io-cost').value || null;
        r = await manualIn(payload);
      } else {
        r = await manualOut(payload);
      }
      modal.close();
      toast(isIn ? 'ورود ثبت شد' : 'خروج ثبت شد');
      if (r?.warn) toast(r.warn, 'warn', 5000);
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------- ضایعات ---------- */

function wasteModal() {
  if (!ctx.ings.length) { toast('ابتدا ماده اولیه تعریف کنید', 'warn'); return; }
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldSelect({ id: 'w-ing', label: 'ماده اولیه', options: ctx.ings.map((i) => ({ value: i.id, label: `${i.name} (${fmtQty(i.stock)} ${i.baseUnit})` })), placeholder: null })}
      ${fieldSelect({ id: 'w-unit', label: 'واحد', options: [], placeholder: null })}
      ${fieldNum({ id: 'w-qty', label: 'مقدار ضایعات', placeholder: '0' })}
      ${fieldDate({ id: 'w-date', label: 'تاریخ', value: todayJalali() })}
    </div>
    <div class="mt-8">${fieldText({ id: 'w-reason', label: 'دلیل', placeholder: 'مثلاً فاسد شدن یا سوختن' })}</div>
    <div class="alert warn mt-8">${icon('alert')}<div>ارزش ضایعات با بهای میانگین موزون محاسبه و در گزارش سود و زیان لحاظ می‌شود.</div></div>`;

  const ingSel = content.querySelector('#w-ing');
  const unitSel = content.querySelector('#w-unit');
  const sync = () => {
    const ing = ctx.ings.find((i) => i.id === ingSel.value);
    if (ing) unitSel.innerHTML = unitsFor(ing).map((u) => `<option value="${escapeHtml(u.name)}">${escapeHtml(u.name)}</option>`).join('');
  };
  ingSel.addEventListener('change', sync);
  setTimeout(sync, 30);

  const modal = openModal({
    title: 'ثبت ضایعات',
    content,
    footer: `<button class="btn btn-danger" data-save type="button">ثبت ضایعات</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    try {
      await recordWaste({
        ingredientId: ingSel.value,
        qty: content.querySelector('#w-qty').value,
        unit: unitSel.value,
        reason: content.querySelector('#w-reason').value,
        date: content.querySelector('#w-date').value.trim() || todayJalali(),
      });
      modal.close();
      toast('ضایعات ثبت شد');
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}

/* ---------- شمارش موجودی ---------- */

function countModal() {
  if (!ctx.ings.length) { toast('ابتدا ماده اولیه تعریف کنید', 'warn'); return; }
  const content = document.createElement('div');
  content.innerHTML = `
    <div class="form-grid">
      ${fieldDate({ id: 'c-date', label: 'تاریخ شمارش', value: todayJalali() })}
      ${fieldText({ id: 'c-note', label: 'یادداشت', placeholder: 'اختیاری' })}
    </div>
    <div class="table-wrap mt-16" style="max-height:44vh;overflow:auto">
      <table class="data">
        <thead><tr><th>ماده</th><th class="num">سیستمی</th><th class="num">واقعی</th></tr></thead>
        <tbody>
          ${ctx.ings.map((i) => `
            <tr>
              <td>${escapeHtml(i.name)} <span class="text-muted text-sm">${escapeHtml(i.baseUnit)}</span></td>
              <td class="num">${fmtQty(i.stock)}</td>
              <td class="num"><input class="input num" data-count="${i.id}" data-sys="${num(i.stock, 0)}" value="${fmtQty(i.stock).replace(/,/g, '')}" style="min-height:34px;width:110px;padding:4px 8px" inputmode="decimal" /></td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="alert info mt-8">${icon('info')}<div>فقط اختلافات اعمال می‌شوند؛ سند شمارش و تغییرات در تاریخچه ثبت می‌‌شود.</div></div>`;

  const modal = openModal({
    title: 'شمارش واقعی موجودی',
    content, size: 'wide',
    footer: `<button class="btn btn-gold" data-save type="button">اعمال اختلافات</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-save]').addEventListener('click', async () => {
    const items = [];
    content.querySelectorAll('[data-count]').forEach((inp) => {
      const sys = num(inp.dataset.sys, 0);
      const val = num(inp.value, sys);
      if (Math.abs(val - sys) > 1e-9) items.push({ ingredientId: inp.dataset.count, countQty: val });
    });
    if (!items.length) { modal.close(); toast('اختلافی وجود نداشت', 'info'); return; }
    try {
      const ok = await confirmDialog(`${toFa(items.length)} مورد اختلاف اعمال شود؟`, { title: 'اعمال شمارش', confirmText: 'اعمال' });
      if (!ok) return;
      await applyCount({
        date: content.querySelector('#c-date').value.trim() || todayJalali(),
        note: content.querySelector('#c-note').value,
        items,
      });
      modal.close();
      toast(`اختلاف ${toFa(items.length)} ماده اعمال شد`);
      await render(document.getElementById('page'));
    } catch (e) { toast(e.message, 'error'); }
  });
}
