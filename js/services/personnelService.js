/* ============================================================
   سرویس پرسنل — حقوق و پرداخت‌ها
   ============================================================ */

import * as db from '../core/db.js';
import { uid, num, todayJalali, nowTime, roundToman, monthKey, normalize } from '../core/utils.js';

export async function listStaff() {
  const rows = await db.getAll('staff');
  return rows.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

export async function addStaff({ name, role = '', phone = '', salary = 0, notes = '' }) {
  const n = String(name || '').trim();
  if (!n) throw new Error('نام پرسنل الزامی است');
  const all = await db.getAll('staff');
  if (all.some((s) => normalize(s.name) === normalize(n))) throw new Error('پرسنلی با این نام وجود دارد');
  const st = {
    id: uid('stf'), name: n,
    role: String(role || '').trim(),
    phone: String(phone || '').trim(),
    salary: roundToman(num(salary, 0)),
    notes: String(notes || '').trim(),
    active: true, createdAt: Date.now(),
  };
  await db.put('staff', st);
  await db.logHistory({ entity: 'staff', entityId: st.id, action: 'create', after: st });
  return st;
}

export async function updateStaff(id, patch) {
  const before = await db.get('staff', id);
  if (!before) throw new Error('پرسنل یافت نشد');
  const after = {
    ...before,
    name: String(patch.name ?? before.name).trim(),
    role: patch.role ?? before.role,
    phone: patch.phone ?? before.phone,
    salary: patch.salary != null ? roundToman(num(patch.salary, 0)) : before.salary,
    notes: patch.notes ?? before.notes,
    active: patch.active !== undefined ? patch.active : before.active,
    updatedAt: Date.now(),
  };
  if (!after.name) throw new Error('نام پرسنل الزامی است');
  await db.put('staff', after);
  await db.logHistory({ entity: 'staff', entityId: id, action: 'update', before, after });
  return after;
}

export async function deleteStaff(id) {
  const before = await db.get('staff', id);
  if (!before) throw new Error('پرسنل یافت نشد');
  const payments = (await db.getAll('expenses')).filter((e) => e.staffId === id);
  if (payments.length) throw new Error('پرداخت حقوق برای این پرسنل ثبت شده است؛ برای حفظ سوابق غیرفعال کنید');
  await db.del('staff', id);
  await db.logHistory({ entity: 'staff', entityId: id, action: 'delete', before });
  return true;
}

/** پرداخت حقوق — با کلید یکتا برای هر ماه (جلوگیری از پرداخت تکراری) */
export async function paySalary({ staffId, month = null, amount = null, date = todayJalali() }) {
  const st = await db.get('staff', staffId);
  if (!st) throw new Error('پرسنل یافت نشد');
  const mk = month || monthKey(date);
  const amt = roundToman(amount != null ? num(amount, 0) : st.salary);
  if (amt <= 0) throw new Error('مبلغ حقوق باید بزرگ‌تر از صفر باشد');

  const uniqueKey = `salary:${staffId}:${mk}`;
  const exists = await db.getByIndex('expenses', 'uniqueKey', uniqueKey);
  if (exists.length) throw new Error(`حقوق ${st.name} برای ماه ${mk} قبلاً پرداخت شده است`);

  const rec = {
    id: uid('exp'),
    date, time: nowTime(), ts: Date.now(),
    category: 'حقوق', amount: amt,
    description: `حقوق ${st.name} — ${mk}`,
    source: 'cash', staffId,
    recurringId: null, month: mk,
    createdAt: Date.now(),
  };
  rec.uniqueKey = uniqueKey;

  const ops = [
    { store: 'expenses', value: rec },
    {
      store: 'cashEntries',
      value: {
        id: uid('cash'), date, time: rec.time, ts: Date.now(),
        type: 'out', amount: amt, category: 'حقوق',
        description: rec.description,
        refType: 'staffPayment', refId: staffId, expenseId: rec.id,
      },
    },
  ];
  await db.writeBatch(ops);
  await db.logHistory({ entity: 'expenses', entityId: rec.id, action: 'create', after: rec, note: 'پرداخت حقوق' });
  return rec;
}

/** لیست پرداخت‌های یک پرسنل */
export async function staffPayments(staffId) {
  const rows = await db.getAll('expenses');
  return rows
    .filter((e) => e.staffId === staffId)
    .sort((a, b) => b.ts - a.ts);
}

/** حذف پرداخت حقوق */
export async function deleteSalaryPayment(expenseId) {
  const before = await db.get('expenses', expenseId);
  if (!before || !before.staffId) throw new Error('سند پرداخت یافت نشد');
  const ops = [{ store: 'expenses', delete: expenseId }];
  const cash = await db.getAll('cashEntries');
  for (const c of cash) {
    if (c.expenseId === expenseId) ops.push({ store: 'cashEntries', delete: c.id });
  }
  await db.writeBatch(ops);
  await db.logHistory({ entity: 'expenses', entityId: expenseId, action: 'delete', before, note: 'حذف پرداخت حقوق' });
  return true;
}
