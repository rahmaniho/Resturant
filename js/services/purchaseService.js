/* ============================================================
   سرویس خرید و تأمین‌کنندگان — ورود کالا، بدهی، بازگردانی
   ============================================================ */

import * as db from '../core/db.js';
import { toBaseQty } from './inventoryService.js';
import { reversePurchaseLine } from './inventoryService.js';
import { wacIn } from '../core/money.js';
import { uid, num, todayJalali, nowTime, roundToman } from '../core/utils.js';

/* ---------- تأمین‌کنندگان ---------- */

export async function listSuppliers() {
  const suppliers = await db.getAll('suppliers');
  const purchases = await db.getAll('purchases');
  const cash = await db.getAll('cashEntries');
  return suppliers
    .map((s) => {
      const owed = purchases
        .filter((p) => p.supplierId === s.id)
        .reduce((sum, p) => sum + (num(p.total, 0) - num(p.paid, 0)), 0);
      const paidOut = cash
        .filter((c) => c.type === 'out' && c.refType === 'supplierPayment' && c.refId === s.id)
        .reduce((sum, c) => sum + num(c.amount, 0), 0);
      return { ...s, debt: Math.max(0, roundToman(owed - paidOut)) };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

export async function addSupplier({ name, phone = '', address = '', notes = '' }) {
  const n = String(name || '').trim();
  if (!n) throw new Error('نام تأمین‌کننده الزامی است');
  const all = await db.getAll('suppliers');
  if (all.some((s) => s.name.trim() === n)) throw new Error('تأمین‌کننده‌ای با این نام وجود دارد');
  const sup = { id: uid('sup'), name: n, phone: String(phone || '').trim(), address: String(address || '').trim(), notes: String(notes || '').trim(), createdAt: Date.now() };
  await db.put('suppliers', sup);
  await db.logHistory({ entity: 'suppliers', entityId: sup.id, action: 'create', after: sup });
  return sup;
}

export async function updateSupplier(id, patch) {
  const before = await db.get('suppliers', id);
  if (!before) throw new Error('تأمین‌کننده یافت نشد');
  const after = { ...before, ...patch, name: String(patch.name ?? before.name).trim(), updatedAt: Date.now() };
  if (!after.name) throw new Error('نام تأمین‌کننده الزامی است');
  await db.put('suppliers', after);
  await db.logHistory({ entity: 'suppliers', entityId: id, action: 'update', before, after });
  return after;
}

export async function deleteSupplier(id) {
  const before = await db.get('suppliers', id);
  if (!before) throw new Error('تأمین‌کننده یافت نشد');
  const purchases = await db.getByIndex('purchases', 'supplierId', id);
  if (purchases.length) throw new Error('این تأمین‌کننده سند خرید دارد و قابل حذف نیست');
  await db.del('suppliers', id);
  await db.logHistory({ entity: 'suppliers', entityId: id, action: 'delete', before });
  return true;
}

/* ---------- اسناد خرید ---------- */

/**
 * ثبت خرید: ورود کالا به انبار با میانگین موزون + پرداخت نقدی + بدهی
 * @param {{supplierId:string, date:string, items:Array, paid:number, note?:string}} input
 */
export async function createPurchase({ supplierId, date = todayJalali(), items = [], paid = 0, note = '' }) {
  if (!items.length) throw new Error('حداقل یک قلم کالا ثبت کنید');
  const supplier = supplierId ? await db.get('suppliers', supplierId) : null;
  if (supplierId && !supplier) throw new Error('تأمین‌کننده یافت نشد');

  const lines = [];
  for (const it of items) {
    if (!it.ingredientId) throw new Error('ماده اولیه را انتخاب کنید');
    const ing = await db.get('ingredients', it.ingredientId);
    if (!ing) throw new Error('ماده اولیه یافت نشد');
    const q = num(it.qty, 0);
    if (q <= 0) throw new Error('مقدار خرید باید بزرگ‌تر از صفر باشد');
    const unitPrice = num(it.unitPrice, 0);
    if (unitPrice < 0) throw new Error('قیمت واحد نمی‌تواند منفی باشد');
    const qtyBase = toBaseQty(ing, q, it.unit || ing.baseUnit);
    const total = roundToman(q * unitPrice);
    lines.push({
      ingredientId: ing.id, ingredientName: ing.name,
      qty: q, unit: it.unit || ing.baseUnit, qtyBase,
      unitPrice: roundToman(unitPrice), total,
      wacBefore: num(ing.wac, 0),
    });
  }

  const total = roundToman(lines.reduce((s, l) => s + l.total, 0));
  const paidN = roundToman(num(paid, 0));
  if (paidN < 0) throw new Error('مبلغ پرداخت‌شده نمی‌تواند منفی باشد');
  if (paidN > total) throw new Error('مبلغ پرداخت‌شده از کل خرید بیشتر است');
  const remaining = total - paidN;

  const purchase = {
    id: uid('pur'),
    supplierId: supplierId || '',
    supplierName: supplier?.name || '—',
    date, time: nowTime(), ts: Date.now(),
    lines, total, paid: paidN, remaining,
    note: String(note || '').trim(),
    createdAt: Date.now(),
  };

  // ورود کالا به انبار + ثبت اسناد در یک جریان
  const ops = [{ store: 'purchases', value: purchase }];
  for (const line of lines) {
    const ing = await db.get('ingredients', line.ingredientId);
    const state = wacIn({ stock: num(ing.stock, 0), wac: num(ing.wac, 0) }, line.qtyBase, line.total);
    ing.stock = state.stock;
    ing.wac = state.wac;
    ing.updatedAt = Date.now();
    ops.push({ store: 'ingredients', value: ing });
    ops.push({
      store: 'movements',
      value: {
        id: uid('mv'), ingredientId: ing.id, type: 'in',
        qty: line.qtyBase, date, time: purchase.time, ts: Date.now(),
        refType: 'purchase', refId: purchase.id,
        note: `خرید ${purchase.supplierName}`,
        value: line.total, stockAfter: ing.stock,
        wacAfter: Number(ing.wac.toFixed(4)),
      },
    });
  }
  if (paidN > 0) {
    ops.push({
      store: 'cashEntries',
      value: {
        id: uid('cash'), date, time: purchase.time, ts: Date.now(),
        type: 'out', amount: paidN,
        category: 'خرید کالا',
        description: `پرخت به ${purchase.supplierName}`,
        refType: 'purchase', refId: purchase.id,
      },
    });
  }
  await db.writeBatch(ops);
  await db.logHistory({ entity: 'purchases', entityId: purchase.id, action: 'create', after: purchase });
  return purchase;
}

export async function listPurchases(filters = {}) {
  let rows = await db.getAll('purchases');
  if (filters.supplierId) rows = rows.filter((p) => p.supplierId === filters.supplierId);
  if (filters.from) rows = rows.filter((p) => p.date >= filters.from);
  if (filters.to) rows = rows.filter((p) => p.date <= filters.to);
  return rows.sort((a, b) => b.ts - a.ts);
}

export async function deletePurchase(id) {
  const before = await db.get('purchases', id);
  if (!before) throw new Error('سند خرید یافت نشد');
  const ops = [];
  for (const line of before.lines) {
    const ing = await reversePurchaseLine(line.ingredientId, line.qtyBase, line.total);
    if (ing) {
      ops.push({ store: 'ingredients', value: ing });
      ops.push({
        store: 'movements',
        value: {
          id: uid('mv'), ingredientId: line.ingredientId, type: 'in',
          qty: -line.qtyBase, date: before.date, time: nowTime(), ts: Date.now(),
          refType: 'purchaseReversal', refId: before.id,
          note: `انصراف خرید ${before.supplierName}`,
          value: -line.total, stockAfter: ing.stock,
          wacAfter: Number(ing.wac.toFixed(4)),
        },
      });
    }
  }
  ops.push({ store: 'purchases', delete: id });
  // حذف ورودی صندوق مرتبط
  const cash = await db.getAll('cashEntries');
  for (const c of cash) {
    if (c.refType === 'purchase' && c.refId === id) ops.push({ store: 'cashEntries', delete: c.id });
  }
  await db.writeBatch(ops);
  await db.logHistory({ entity: 'purchases', entityId: id, action: 'delete', before });
  return true;
}

/** پرداخت بدهی به تأمین‌کننده */
export async function paySupplier({ supplierId, amount, date = todayJalali(), note = '' }) {
  const sup = await db.get('suppliers', supplierId);
  if (!sup) throw new Error('تأمین‌کننده یافت نشد');
  const amt = roundToman(num(amount, 0));
  if (amt <= 0) throw new Error('مبلغ پرداختی باید بزرگ‌تر از صفر باشد');
  const suppliers = await listSuppliers();
  const me = suppliers.find((s) => s.id === supplierId);
  if (amt > (me?.debt || 0)) throw new Error('مبلغ پرداختی از بدهی بیشتر است');

  const entry = {
    id: uid('cash'), date, time: nowTime(), ts: Date.now(),
    type: 'out', amount: amt,
    category: 'پرداخت بدهی',
    description: `پرداخت به ${sup.name}${note ? ` — ${note}` : ''}`,
    refType: 'supplierPayment', refId: supplierId,
  };
  await db.put('cashEntries', entry);
  await db.logHistory({ entity: 'cashEntries', entityId: entry.id, action: 'create', after: entry, note: 'پرداخت تأمین‌کننده' });
  return entry;
}
