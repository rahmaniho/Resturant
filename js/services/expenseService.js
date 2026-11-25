/* ============================================================
   سرویس هزینه‌ها — با جلوگیری از دوباره‌شماری (کلید یکتا)
   ============================================================ */

import * as db from '../core/db.js';
import { getSettings } from '../core/settings.js';
import { uid, num, todayJalali, nowTime, roundToman, monthKey, currentJalaliMonth, daysInMonth } from '../core/utils.js';

/** کلید یکتای سند هزینه — مانع ثبت/شمارش تکراری می‌شود */
function makeUniqueKey(rec) {
  if (rec.recurringId && rec.month) return `rec:${rec.recurringId}:${rec.month}`;
  return `one:${rec.id}`;
}

export async function listExpenses(filters = {}) {
  let rows = await db.getAll('expenses');
  if (filters.from) rows = rows.filter((e) => e.date >= filters.from);
  if (filters.to) rows = rows.filter((e) => e.date <= filters.to);
  if (filters.date) rows = rows.filter((e) => e.date === filters.date);
  if (filters.category) rows = rows.filter((e) => e.category === filters.category);
  if (filters.search) {
    const q = filters.search.trim().toLowerCase();
    rows = rows.filter((e) =>
      String(e.description || '').toLowerCase().includes(q) ||
      String(e.category || '').toLowerCase().includes(q)
    );
  }
  // حذف تکراری‌های احتمالی داده‌های قدیمی (محافظ دوباره‌شماری)
  const seen = new Set();
  rows = rows.filter((e) => {
    const k = e.uniqueKey || makeUniqueKey(e);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return rows.sort((a, b) => b.ts - a.ts || b.id.localeCompare(a.id));
}

export async function addExpense({ date = todayJalali(), category, amount, description = '', source = 'cash', staffId = null }) {
  const amt = roundToman(num(amount, 0));
  if (amt <= 0) throw new Error('مبلغ هزینه باید بزرگ‌تر از صفر باشد');
  const cat = String(category || '').trim();
  if (!cat) throw new Error('دسته هزینه را انتخاب یا تایپ کنید');
  if (!['cash', 'card'].includes(source)) source = 'cash';

  const rec = {
    id: uid('exp'),
    date, time: nowTime(), ts: Date.now(),
    category: cat, amount: amt,
    description: String(description || '').trim(),
    source, // cash → از صندوق | card → از حساب بانکی
    staffId: staffId || null,
    recurringId: null, month: null,
    createdAt: Date.now(),
  };
  rec.uniqueKey = makeUniqueKey(rec);

  // محافظ یکتایی
  const existing = await db.getByIndex('expenses', 'uniqueKey', rec.uniqueKey);
  if (existing.length) throw new Error('این هزینه قبلاً ثبت شده است (جلوگیری از دوباره‌شماری)');

  const ops = [{ store: 'expenses', value: rec }];
  if (source === 'cash') {
    ops.push({
      store: 'cashEntries',
      value: {
        id: uid('cash'), date, time: rec.time, ts: Date.now(),
        type: 'out', amount: amt, category: `هزینه: ${cat}`,
        description: description || cat,
        refType: 'expense', refId: rec.id,
      },
    });
  }
  await db.writeBatch(ops);
  await db.logHistory({ entity: 'expenses', entityId: rec.id, action: 'create', after: rec });
  return rec;
}

export async function updateExpense(id, patch) {
  const before = await db.get('expenses', id);
  if (!before) throw new Error('سند هزینه یافت نشد');
  const after = {
    ...before,
    date: patch.date ?? before.date,
    category: String(patch.category ?? before.category).trim(),
    amount: patch.amount != null ? roundToman(num(patch.amount, 0)) : before.amount,
    description: patch.description ?? before.description,
    source: patch.source ?? before.source,
    updatedAt: Date.now(),
  };
  if (after.amount <= 0) throw new Error('مبلغ هزینه باید بزرگ‌تر از صفر باشد');
  after.uniqueKey = makeUniqueKey(after);

  const ops = [{ store: 'expenses', value: after }];
  // به‌روزرسانی سند صندوق مرتبط
  const cash = await db.getAll('cashEntries');
  const linked = cash.find((c) => c.refType === 'expense' && c.refId === id);
  if (after.source === 'cash') {
    if (linked) {
      ops.push({ store: 'cashEntries', value: { ...linked, amount: after.amount, date: after.date, category: `هزینه: ${after.category}`, description: after.description || after.category } });
    } else {
      ops.push({
        store: 'cashEntries',
        value: {
          id: uid('cash'), date: after.date, time: after.time, ts: Date.now(),
          type: 'out', amount: after.amount, category: `هزینه: ${after.category}`,
          description: after.description || after.category, refType: 'expense', refId: id,
        },
      });
    }
  } else if (linked) {
    ops.push({ store: 'cashEntries', delete: linked.id });
  }
  await db.writeBatch(ops);
  await db.logHistory({ entity: 'expenses', entityId: id, action: 'update', before, after });
  return after;
}

export async function deleteExpense(id) {
  const before = await db.get('expenses', id);
  if (!before) throw new Error('سند هزینه یافت نشد');
  const ops = [{ store: 'expenses', delete: id }];
  const cash = await db.getAll('cashEntries');
  for (const c of cash) {
    if (c.refType === 'expense' && c.refId === id) ops.push({ store: 'cashEntries', delete: c.id });
  }
  await db.writeBatch(ops);
  await db.logHistory({ entity: 'expenses', entityId: id, action: 'delete', before });
  return true;
}

/* ---------- هزینه‌های دوره‌ای (تکرارشونده) ---------- */

export async function listTemplates() {
  const rows = await db.getAll('expenseTemplates');
  return rows.sort((a, b) => a.category.localeCompare(b.category, 'fa'));
}

export async function addTemplate({ category, amount, description = '', source = 'cash', day = 1 }) {
  const amt = roundToman(num(amount, 0));
  if (amt <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد');
  const cat = String(category || '').trim();
  if (!cat) throw new Error('دسته هزینه الزامی است');
  const tpl = {
    id: uid('tpl'), category: cat, amount: amt,
    description: String(description || '').trim(),
    source: source === 'card' ? 'card' : 'cash',
    day: Math.min(31, Math.max(1, num(day, 1))),
    active: true, createdAt: Date.now(),
  };
  await db.put('expenseTemplates', tpl);
  await db.logHistory({ entity: 'expenseTemplates', entityId: tpl.id, action: 'create', after: tpl });
  return tpl;
}

export async function updateTemplate(id, patch) {
  const before = await db.get('expenseTemplates', id);
  if (!before) throw new Error('قالب یافت نشد');
  const after = {
    ...before,
    category: String(patch.category ?? before.category).trim(),
    amount: patch.amount != null ? roundToman(num(patch.amount, 0)) : before.amount,
    description: patch.description ?? before.description,
    source: patch.source === 'card' ? 'card' : patch.source === 'cash' ? 'cash' : before.source,
    day: patch.day != null ? Math.min(31, Math.max(1, num(patch.day, 1))) : before.day,
    updatedAt: Date.now(),
  };
  if (!after.category) throw new Error('دسته هزینه الزامی است');
  if (after.amount <= 0) throw new Error('مبلغ باید بزرگ‌تر از صفر باشد');
  await db.put('expenseTemplates', after);
  await db.logHistory({ entity: 'expenseTemplates', entityId: id, action: 'update', before, after });
  return after;
}

export async function deleteTemplate(id) {
  const before = await db.get('expenseTemplates', id);
  if (!before) throw new Error('قالب یافت نشد');
  await db.del('expenseTemplates', id);
  await db.logHistory({ entity: 'expenseTemplates', entityId: id, action: 'delete', before });
  return true;
}

/**
 * ایجاد اسناد هزینه دوره از روی قالب‌ها — با کلید یکتا؛
 * هر قالب حداکثر یک سند برای هر ماه شمسی ساخته می‌شود (بدون دوباره‌شماری).
 * قانون روز: در ماه جاری، سند فقط در «روز تعیین‌شده یا بعد از آن» ساخته می‌شود
 * (مثل اجاره که هر ماه روز ۵ ثبت می‌شود)؛ برای ماه‌های قبلی همه قالب‌ها بازسازی می‌شوند.
 * روزهای بیشتر از طول ماه (مثلاً ۳۱ در ماه ۳۰روزه) در آخرین روز ماه اعمال می‌شوند.
 */
export async function generateRecurring(month = null) {
  const mk = month || monthKey(todayJalali());
  const isCurrent = mk === monthKey(todayJalali());
  const today = todayJalali();
  const todayDay = Number(today.slice(8, 10));
  const [mjy, mjm] = mk.split('-').map(Number);
  const dim = daysInMonth(mjy, mjm);
  const templates = (await listTemplates()).filter((t) => t.active !== false);
  const created = [];
  let skipped = 0;
  for (const tpl of templates) {
    const day = Math.min(Math.max(1, num(tpl.day, 1)), dim);
    // ماه جاری: هنوز به روز تعیین‌شده نرسیده‌ایم → صبر کن
    if (isCurrent && day > todayDay) { skipped += 1; continue; }
    const uniqueKey = `rec:${tpl.id}:${mk}`;
    const exists = await db.getByIndex('expenses', 'uniqueKey', uniqueKey);
    if (exists.length) { skipped += 1; continue; }
    const date = `${mk}-${String(day).padStart(2, '0')}`;
    const rec = {
      id: uid('exp'),
      date, time: nowTime(), ts: Date.now(),
      category: tpl.category, amount: tpl.amount,
      description: tpl.description || `هزینه دوره‌ای ${tpl.category}`,
      source: tpl.source, staffId: null,
      recurringId: tpl.id, month: mk,
      createdAt: Date.now(),
    };
    rec.uniqueKey = uniqueKey;
    const ops = [{ store: 'expenses', value: rec }];
    if (rec.source === 'cash') {
      ops.push({
        store: 'cashEntries',
        value: {
          id: uid('cash'), date, time: rec.time, ts: Date.now(),
          type: 'out', amount: rec.amount, category: `هزینه: ${rec.category}`,
          description: rec.description, refType: 'expense', refId: rec.id,
        },
      });
    }
    await db.writeBatch(ops);
    created.push(rec);
  }
  if (created.length) {
    await db.logHistory({ entity: 'expenses', entityId: 'recurring', action: 'create', note: `ایجاد ${created.length} هزینه دوره‌ای ${mk}` });
  }
  return { created, skipped, month: mk };
}

/** جمع هزینه‌های یک بازه (بدون احتساب تکراری) */
export async function expensesSum(from, to) {
  const rows = await listExpenses({ from, to });
  return {
    total: roundToman(rows.reduce((s, e) => s + num(e.amount, 0), 0)),
    count: rows.length,
    rows,
  };
}

export function defaultCategories() {
  return getSettings().expenseCategories || [];
}
