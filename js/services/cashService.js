/* ============================================================
   سرویس صندوق (دخل) — گردش نقدی
   ============================================================ */

import * as db from '../core/db.js';
import { getSettings } from '../core/settings.js';
import { uid, num, todayJalali, nowTime, roundToman } from '../core/utils.js';

/**
 * مانده صندوق = ورودی‌های نقدی − خروجی‌های نقدی
 * (فروش کارت‌خوان با excludeFromCashbox ثبت می‌شود و در گردش صندوق لحاظ نمی‌شود)
 */
export async function cashBalance() {
  const entries = await db.getAll('cashEntries');
  let bal = 0;
  for (const e of entries) {
    if (e.excludeFromCashbox) continue;
    bal += e.type === 'in' ? num(e.amount, 0) : -num(e.amount, 0);
  }
  return roundToman(bal);
}

/** مانده صندوق تا پایان یک تاریخ */
export async function cashBalanceTo(date) {
  const entries = await db.getAll('cashEntries');
  let bal = 0;
  for (const e of entries) {
    if (e.excludeFromCashbox || e.date > date) continue;
    bal += e.type === 'in' ? num(e.amount, 0) : -num(e.amount, 0);
  }
  return roundToman(bal);
}

/** ایجاد/همگام‌سازی موجودی ابتدای صندوق با تنظیمات */
export async function ensureInitialCash() {
  const entries = await db.getAll('cashEntries');
  const existing = entries.find((e) => e.refType === 'initial');
  const amount = roundToman(num(getSettings().initialCash, 0));

  if (existing) {
    // فقط مقادیر مثبت تنظیمات اعمال می‌شوند تا پاک‌شدن تصادفی LocalStorage سرمایه را از بین نبرد
    if (amount > 0 && num(existing.amount, 0) !== amount) {
      const updated = { ...existing, amount, ts: Date.now() };
      await db.put('cashEntries', updated);
      await db.logHistory({ entity: 'cashEntries', entityId: existing.id, action: 'update', before: existing, after: updated, note: 'اصلاح سرمایه اولیه صندوق' });
      return updated;
    }
    return null;
  }
  if (amount <= 0) return null;
  const entry = {
    id: uid('cash'), date: todayJalali(), time: nowTime(), ts: Date.now(),
    type: 'in', amount, category: 'سرمایه اولیه',
    description: 'موجودی ابتدای صندوق',
    refType: 'initial', refId: 'initial',
  };
  await db.put('cashEntries', entry);
  await db.logHistory({ entity: 'cashEntries', entityId: entry.id, action: 'create', after: entry, note: 'سرمایه اولیه صندوق' });
  return entry;
}

export async function listCashEntries(filters = {}) {
  let rows = await db.getAll('cashEntries');
  if (filters.from) rows = rows.filter((e) => e.date >= filters.from);
  if (filters.to) rows = rows.filter((e) => e.date <= filters.to);
  if (filters.date) rows = rows.filter((e) => e.date === filters.date);
  if (filters.type) rows = rows.filter((e) => e.type === filters.type);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter((e) =>
      String(e.description || '').toLowerCase().includes(q) ||
      String(e.category || '').toLowerCase().includes(q)
    );
  }
  return rows.sort((a, b) => b.ts - a.ts);
}

/** ثبت دستی در صندوق */
export async function addCashEntry({ type, amount, category = 'دستی', description = '', date = todayJalali() }) {
  if (type !== 'in' && type !== 'out') throw new Error('نوع تراکنش نامعتبر است');
  const amt = roundToman(num(amount, 0));
  if (amt <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد');
  const entry = {
    id: uid('cash'), date, time: nowTime(), ts: Date.now(),
    type, amount: amt,
    category: String(category || 'دستی').trim(),
    description: String(description || '').trim(),
    refType: 'manual', refId: null,
  };
  await db.put('cashEntries', entry);
  await db.logHistory({ entity: 'cashEntries', entityId: entry.id, action: 'create', after: entry, note: 'ثبت دستی صندوق' });
  return entry;
}

export async function deleteCashEntry(id) {
  const before = await db.get('cashEntries', id);
  if (!before) throw new Error('سند یافت نشد');
  if (['sale', 'saleCard', 'creditPayment', 'purchase', 'expense', 'supplierPayment', 'staffPayment', 'initial'].includes(before.refType)) {
    throw new Error('این سند به یک عملیات اصلی متصل است؛ از همان بخش قابل حذف/انصراف است');
  }
  await db.del('cashEntries', id);
  await db.logHistory({ entity: 'cashEntries', entityId: id, action: 'delete', before });
  return true;
}

/** گردش نقدی یک بازه: {in, out, net} */
export async function cashFlow(from, to) {
  const rows = await listCashEntries({ from, to });
  let inc = 0, out = 0;
  for (const e of rows) {
    if (e.excludeFromCashbox) continue;
    if (e.type === 'in') inc += num(e.amount, 0);
    else out += num(e.amount, 0);
  }
  return { in: roundToman(inc), out: roundToman(out), net: roundToman(inc - out) };
}
