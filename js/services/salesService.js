/* ============================================================
   سرویس فروش — ثبت فروش، بهای تمام‌شده، کسر خودکار انبار
   ============================================================ */

import * as db from '../core/db.js';
import { getRecipe } from './recipeService.js';
import { toBaseQty } from './inventoryService.js';
import { validatePayments } from '../core/money.js';
import { uid, num, todayJalali, nowTime, roundToman, normalize } from '../core/utils.js';

/**
 * ثبت فروش
 * @param {{
 *   date?: string,
 *   items: Array<{foodId:string, qty:number, unitPrice?:number}>,
 *   discount?: number,
 *   payments: {cash?:number, card?:number, credit?:number},
 *   customer?: {name?:string, phone?:string},
 *   note?: string
 * }} input
 * @returns {Promise<object>} سند فروش
 */
export async function createSale(input) {
  const date = input.date || todayJalali();
  const rawItems = input.items || [];
  if (!rawItems.length) throw new Error('حداقل یک قلم غذا انتخاب کنید');

  const foods = await db.getAll('foods');
  const foodMap = new Map(foods.map((f) => [f.id, f]));

  // ساخت اقلام با قیمت و بهای تمام‌شده لحظه‌ای
  const items = [];
  const stockOps = [];
  const warnings = [];

  for (const raw of rawItems) {
    const food = foodMap.get(raw.foodId);
    if (!food) throw new Error('غذایی در منو یافت نشد؛ منو را بررسی کنید');
    if (food.active === false) throw new Error(`«${food.name}» غیرفعال است`);
    const qty = num(raw.qty, 0);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error('تعداد باید عدد صحیح مثبت باشد');
    const unitPrice = raw.unitPrice != null ? roundToman(raw.unitPrice) : roundToman(food.price);
    if (unitPrice < 0) throw new Error('قیمت نمی‌تواند منفی باشد');

    // بهای تمام‌شده از رسپی
    let costPerServing = 0;
    const recipe = await getRecipe(food.id);
    if (recipe && recipe.items.length) {
      let cost = 0;
      for (const ri of recipe.items) {
        const ing = await db.get('ingredients', ri.ingredientId);
        if (!ing) { warnings.push(`ماده اولیه رسپی «${food.name}» یافت نشد`); continue; }
        const baseQty = toBaseQty(ing, ri.qty, ri.unit);
        cost += baseQty * num(ing.wac, 0);
        // کسر خودکار انبار (مقدار کل = بهای هر پرس × تعداد)
        stockOps.push({
          ing, baseQty, qtySold: qty,
          movement: {
            id: uid('mv'), ingredientId: ing.id, type: 'out',
            qty: -(baseQty * qty), date, time: nowTime(), ts: Date.now(),
            refType: 'sale', refId: null, // refId پس از ساخت sale
            note: `فروش ${food.name} ×${qty}`,
            value: Math.round(baseQty * num(ing.wac, 0) * qty),
          },
        });
      }
      costPerServing = roundToman(cost);
    } else {
      warnings.push(`«${food.name}» رسپی ندارد؛ بهای تمام‌شده صفر ثبت شد`);
    }

    items.push({
      foodId: food.id, foodName: food.name, categoryId: food.categoryId,
      qty, unitPrice, total: roundToman(unitPrice * qty),
      costPerServing, cost: roundToman(costPerServing * qty),
    });
  }

  const subtotal = roundToman(items.reduce((s, i) => s + i.total, 0));
  const discount = roundToman(num(input.discount, 0));
  if (discount < 0) throw new Error('تخفیف نمی‌تواند منفی باشد');
  if (discount > subtotal) throw new Error('تخفیف از مبلغ کل بیشتر است');
  const total = subtotal - discount;

  const pay = validatePayments(total, input.payments || {});
  if (!pay.ok) throw new Error(pay.msg);

  const sale = {
    id: uid('sale'),
    date, time: nowTime(), ts: Date.now(),
    items, subtotal, discount, total,
    payments: { cash: pay.cash, card: pay.card, credit: pay.credit },
    cogs: roundToman(items.reduce((s, i) => s + i.cost, 0)),
    customer: {
      name: String(input.customer?.name || '').trim(),
      phone: String(input.customer?.phone || '').trim(),
    },
    received: pay.cash + pay.card,
    creditRemaining: pay.credit,
    note: String(input.note || '').trim(),
    warnings,
    createdAt: Date.now(),
  };

  // اعمال کسر انبار در یک تراکنش + اسناد فروش و صندوق
  const ops = [{ store: 'sales', value: sale }];
  const seen = new Map(); // جمع‌بندی کسر هر ماده در همین فروش
  for (const op of stockOps) {
    const totalBase = op.baseQty * op.qtySold;
    const cur = seen.get(op.ing.id) || { ing: op.ing, qty: 0 };
    cur.qty += totalBase;
    seen.set(op.ing.id, cur);
  }
  for (const { ing, qty } of seen.values()) {
    const newStock = num(ing.stock, 0) - qty;
    const newWac = num(ing.wac, 0); // خروج، میانگین را تغییر نمی‌دهد
    const value = Math.round(qty * newWac);
    const updated = { ...ing, stock: newStock, wac: newWac, updatedAt: Date.now() };
    ops.push({ store: 'ingredients', value: updated });
    ops.push({
      store: 'movements',
      value: {
        id: uid('mv'), ingredientId: ing.id, type: 'out',
        qty: -qty, date, time: sale.time, ts: Date.now(),
        refType: 'sale', refId: sale.id,
        note: `فروش ${sale.items.map((i) => i.foodName).join('، ').slice(0, 60)}`,
        value, stockAfter: newStock, wacAfter: Number(newWac.toFixed(4)),
      },
    });
    if (newStock < 0) warnings.push(`موجودی «${ing.name}» منفی شد`);
  }

  // ورود نقدی به صندوق (کارت‌خوان جداگانه ثبت می‌شود و وارد صندوق نمی‌شود)
  if (pay.cash > 0) {
    ops.push({
      store: 'cashEntries',
      value: {
        id: uid('cash'), date, time: sale.time, ts: Date.now(),
        type: 'in', amount: pay.cash, category: 'فروش نقدی',
        description: `فروش ${sale.items.reduce((s, i) => s + i.qty, 0)} قلم غذا`,
        refType: 'sale', refId: sale.id,
      },
    });
  }
  if (pay.card > 0) {
    ops.push({
      store: 'cashEntries',
      value: {
        id: uid('cash'), date, time: sale.time, ts: Date.now(),
        type: 'in', amount: pay.card, category: 'فروش کارت‌خوان',
        description: `کارت‌خوان — فروش ${sale.items.reduce((s, i) => s + i.qty, 0)} قلم`,
        refType: 'saleCard', refId: sale.id, excludeFromCashbox: true,
      },
    });
  }

  await db.writeBatch(ops);
  await db.logHistory({ entity: 'sales', entityId: sale.id, action: 'create', after: sale });
  return { sale, warnings };
}

/**
 * دریافت طلب نسیه از مشتری
 * مبلغ دریافتی وارد صندوق می‌شود و طلب باقی‌مانده فروش کاهش می‌یابد
 */
export async function receiveCredit({ saleId, amount, date = todayJalali(), note = '' }) {
  const sale = await db.get('sales', saleId);
  if (!sale) throw new Error('سند فروش یافت نشد');
  const remaining = roundToman(num(sale.creditRemaining, 0));
  if (remaining <= 0) throw new Error('طلبی برای این فروش باقی نمانده است');
  const amt = roundToman(num(amount, 0));
  if (amt <= 0) throw new Error('مبلغ دریافتی باید بزرگ‌تر از صفر باشد');
  if (amt > remaining) throw new Error(`مبلغ دریافتی از طلب باقی‌مانده (${fmtMoneyLocal(remaining)}) بیشتر است`);

  const entry = {
    id: uid('cash'), date, time: nowTime(), ts: Date.now(),
    type: 'in', amount: amt,
    category: 'دریافت نسیه',
    description: `دریافت از ${sale.customer?.name?.trim() || 'مشتری'}${note ? ` — ${note}` : ''}`,
    refType: 'creditPayment', refId: sale.id,
  };
  const after = {
    ...sale,
    creditRemaining: remaining - amt,
    received: roundToman(num(sale.received, 0)) + amt,
    updatedAt: Date.now(),
  };
  await db.writeBatch([
    { store: 'sales', value: after },
    { store: 'cashEntries', value: entry },
  ]);
  await db.logHistory({
    entity: 'sales', entityId: saleId, action: 'update',
    before: sale, after, note: `دریافت طلب ${amt} تومان`,
  });
  return { sale: after, entry };
}

/** فروش‌های دارای طلب باقی‌مانده */
export async function outstandingCredits() {
  const rows = (await db.getAll('sales')).filter((s) => num(s.creditRemaining, 0) > 0);
  return {
    sales: rows.sort((a, b) => b.ts - a.ts),
    total: roundToman(rows.reduce((s, x) => s + num(x.creditRemaining, 0), 0)),
  };
}

/**
 * فهرست مشتریان (استخراج از اسناد فروش — بدون جدول جداگانه)
 * کلید: شماره تلفن (در صورت وجود) وگرنه نام؛ مرتب‌شده بر اساس طلب باقی‌مانده.
 */
export async function listCustomers() {
  const sales = await db.getAll('sales');
  const map = new Map();
  for (const s of sales) {
    const name = String(s.customer?.name || '').trim();
    const phoneRaw = String(s.customer?.phone || '').trim();
    const phone = phoneRaw.replace(/[^\d۰-۹]/g, '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
    if (!name && !phone) continue; // فروش بدون هویت مشتری
    const key = phone || normalize(name);
    let c = map.get(key);
    if (!c) {
      c = { key, name: '', phone: '', salesCount: 0, total: 0, credit: 0, lastDate: '', sales: [] };
      map.set(key, c);
    }
    if (!c.name && name) c.name = name;
    if (!c.phone && phoneRaw) c.phone = phoneRaw;
    c.salesCount += 1;
    c.total = roundToman(c.total + num(s.total, 0));
    c.credit = roundToman(c.credit + num(s.creditRemaining, 0));
    c.sales.push(s);
    if (s.date > c.lastDate) c.lastDate = s.date;
  }
  return [...map.values()]
    .map((c) => ({ ...c, sales: c.sales.sort((a, b) => a.date.localeCompare(b.date) || a.ts - b.ts) }))
    .sort((a, b) => b.credit - a.credit || b.total - a.total);
}

/**
 * تسویه حساب مشتری: تقسیم مبلغ پرداختی روی طلب‌های قدیمی‌تر ( FIFO )
 * تا سقف طلب باقی‌مانده — با پرداخت کامل، حساب مشتری صفر می‌شود.
 */
export async function settleCustomer({ key, amount, date = todayJalali(), note = '' }) {
  const customers = await listCustomers();
  const customer = customers.find((c) => c.key === key);
  if (!customer) throw new Error('مشتری یافت نشد');
  const outstanding = customer.sales.filter((s) => num(s.creditRemaining, 0) > 0);
  const totalCredit = roundToman(outstanding.reduce((sum, s) => sum + num(s.creditRemaining, 0), 0));
  if (totalCredit <= 0) throw new Error('طلبی برای این مشتری باقی نمانده است');
  const amt = roundToman(num(amount, 0));
  if (amt <= 0) throw new Error('مبلغ پرداختی باید بزرگ‌تر از صفر باشد');
  if (amt > totalCredit) throw new Error(`مبلغ پرداختی از طلب باقی‌مانده (${fmtMoneyLocal(totalCredit)}) بیشتر است`);

  let left = amt;
  const results = [];
  for (const s of outstanding) { // قدیمی‌ترین اول
    const take = Math.min(left, num(s.creditRemaining, 0));
    if (take <= 0) continue;
    const r = await receiveCredit({
      saleId: s.id, amount: take, date,
      note: note || `تسویه حساب${customer.name ? ` ${customer.name}` : ''}`,
    });
    results.push(r);
    left = roundToman(left - take);
    if (left <= 0) break;
  }
  const paid = roundToman(amt - left);
  return {
    customer,
    paid,
    settledSales: results.length,
    cleared: roundToman(totalCredit - paid) === 0,
    remainingCredit: roundToman(totalCredit - paid),
  };
}

function fmtMoneyLocal(n) {
  return `${Number(n).toLocaleString('fa-IR')} تومان`;
}

/** لیست فروش‌ها با فیلتر */
export async function listSales(filters = {}) {
  let rows = await db.getAll('sales');
  if (filters.from) rows = rows.filter((s) => s.date >= filters.from);
  if (filters.to) rows = rows.filter((s) => s.date <= filters.to);
  if (filters.date) rows = rows.filter((s) => s.date === filters.date);
  if (filters.search) {
    const q = normalize(filters.search);
    rows = rows.filter((s) =>
      normalize(s.customer?.name || '').includes(q) ||
      normalize(s.customer?.phone || '').includes(q) ||
      s.items.some((i) => normalize(i.foodName).includes(q)) ||
      normalize(s.id).includes(q)
    );
  }
  return rows.sort((a, b) => b.ts - a.ts);
}

/** حذف فروش با بازگردانی کامل انبار و صندوق */
export async function deleteSale(id) {
  const sale = await db.get('sales', id);
  if (!sale) throw new Error('سند فروش یافت نشد');

  const ops = [{ store: 'sales', delete: id }];

  // بازگردانی مواد اولیه
  const movs = await db.getByIndex('movements', 'refId', id);
  const byIng = new Map();
  for (const m of movs) {
    if (m.refType !== 'sale') continue;
    const cur = byIng.get(m.ingredientId) || 0;
    byIng.set(m.ingredientId, cur + Math.abs(m.qty));
  }
  for (const [ingId, qtyBack] of byIng) {
    const ing = await db.get('ingredients', ingId);
    if (!ing) continue;
    const newStock = num(ing.stock, 0) + qtyBack;
    const updated = { ...ing, stock: newStock, updatedAt: Date.now() };
    ops.push({ store: 'ingredients', value: updated });
    ops.push({
      store: 'movements',
      value: {
        id: uid('mv'), ingredientId: ingId, type: 'in',
        qty: qtyBack, date: sale.date, time: nowTime(), ts: Date.now(),
        refType: 'saleReversal', refId: sale.id,
        note: `انصراف فروش ${sale.items.map((i) => i.foodName).join('، ').slice(0, 50)}`,
        value: Math.round(qtyBack * num(ing.wac, 0)),
        stockAfter: newStock, wacAfter: Number(num(ing.wac, 0).toFixed(4)),
      },
    });
  }

  // حذف اسناد صندوق (فروش نقدی/کارت و دریافت‌های طلب مرتبط)
  const cash = await db.getAll('cashEntries');
  for (const c of cash) {
    if ((c.refType === 'sale' || c.refType === 'saleCard' || c.refType === 'creditPayment') && c.refId === id) {
      ops.push({ store: 'cashEntries', delete: c.id });
    }
  }

  await db.writeBatch(ops);
  await db.logHistory({ entity: 'sales', entityId: id, action: 'delete', before: sale });
  return true;
}

/** دریافت یک سند فروش */
export async function getSale(id) {
  return db.get('sales', id);
}
