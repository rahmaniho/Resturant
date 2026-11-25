/* ============================================================
   سرویس مواد اولیه و انبار — گردش، میانگین موزون، ضایعات، شمارش
   ============================================================ */

import * as db from '../core/db.js';
import { wacIn, wacOut, wacReverse } from '../core/money.js';
import { uid, num, normalize, todayJalali, nowTime, addDaysJalali } from '../core/utils.js';

export const BASE_UNITS = ['گرم', 'میلی‌لیتر', 'عدد', 'کیلوگرم', 'لیتر'];
/** عوامل تبدیل نسبت به واحد پایه (کیلوگرم→گرم ۱۰۰۰ و…) — در لایه انتخاب واحد استفاده می‌شود */
export const COMMON_UNITS = [
  { name: 'گرم', factorToBase: { گرم: 1 } },
  { name: 'کیلوگرم', factorToBase: { گرم: 1000, کیلوگرم: 1 } },
  { name: 'میلی‌لیتر', factorToBase: { 'میلی‌لیتر': 1 } },
  { name: 'لیتر', factorToBase: { 'میلی‌لیتر': 1000, لیتر: 1 } },
  { name: 'عدد', factorToBase: { عدد: 1 } },
  { name: 'بسته', factorToBase: { عدد: 1, 'بسته': 1 } },
  { name: 'قلم', factorToBase: { عدد: 1, قلم: 1 } },
  { name: 'شیشه', factorToBase: { 'میلی‌لیتر': 1, شیشه: 1 } },
];

/** تبدیل مقدار به واحد پایه مواد اولیه */
export function toBaseQty(ingredient, qty, unit) {
  const q = num(qty, 0);
  const base = ingredient.baseUnit || 'گرم';
  const u = String(unit || base);
  if (u === base) return q;
  const custom = (ingredient.units || []).find((x) => x.name === u);
  if (custom) return q * num(custom.factor, 1);
  const common = COMMON_UNITS.find((x) => x.name === u);
  if (common && common.factorToBase[base] != null) return q * common.factorToBase[base];
  // تبدیل نامشخص: فرض برابری
  return q;
}

/** واحدهای قابل انتخاب برای یک ماده */
export function unitsFor(ingredient) {
  const base = ingredient.baseUnit || 'گرم';
  const list = [{ name: base, factor: 1 }];
  for (const u of ingredient.units || []) {
    if (u.name && u.name !== base) list.push({ name: u.name, factor: num(u.factor, 1) });
  }
  return list;
}

async function joinIngredientName(items) {
  const ings = await db.getAll('ingredients');
  const map = new Map(ings.map((i) => [i.id, i]));
  return items.map((m) => ({ ...m, ingredientName: map.get(m.ingredientId)?.name || '—', baseUnit: map.get(m.ingredientId)?.baseUnit || '' }));
}

/* ---------- مواد اولیه ---------- */

export async function listIngredients() {
  const all = await db.getAll('ingredients');
  return all.sort((a, b) => a.name.localeCompare(b.name, 'fa'));
}

export async function addIngredient({ name, baseUnit, units = [], minStock = 0, expiryDate = null, notes = '' }) {
  const n = String(name || '').trim();
  if (!n) throw new Error('نام ماده اولیه الزامی است');
  if (!baseUnit) throw new Error('واحد پایه را انتخاب کنید');
  const all = await db.getAll('ingredients');
  if (all.some((i) => normalize(i.name) === normalize(n))) throw new Error('ماده اولیه با این نام وجود دارد');
  const ing = {
    id: uid('ing'), name: n, baseUnit,
    units: (units || []).filter((u) => u.name && num(u.factor, 0) > 0).map((u) => ({ name: String(u.name).trim(), factor: num(u.factor, 1) })),
    minStock: num(minStock, 0),
    expiryDate: expiryDate || null,
    notes: String(notes || '').trim(),
    stock: 0, wac: 0,
    createdAt: Date.now(), updatedAt: Date.now(),
  };
  await db.put('ingredients', ing);
  await db.logHistory({ entity: 'ingredients', entityId: ing.id, action: 'create', after: ing });
  return ing;
}

export async function updateIngredient(id, patch) {
  const before = await db.get('ingredients', id);
  if (!before) throw new Error('ماده اولیه یافت نشد');
  const name = String(patch.name ?? before.name).trim();
  if (!name) throw new Error('نام ماده اولیه الزامی است');
  const all = await db.getAll('ingredients');
  if (all.some((i) => i.id !== id && normalize(i.name) === normalize(name))) throw new Error('ماده اولیه با این نام وجود دارد');
  const after = {
    ...before,
    name,
    baseUnit: patch.baseUnit ?? before.baseUnit,
    units: patch.units !== undefined ? patch.units.filter((u) => u.name && num(u.factor, 0) > 0) : before.units,
    minStock: patch.minStock != null ? num(patch.minStock, 0) : before.minStock,
    expiryDate: patch.expiryDate !== undefined ? patch.expiryDate : before.expiryDate,
    notes: patch.notes ?? before.notes,
    updatedAt: Date.now(),
  };
  // تغییر واحد پایه فقط بدون گردش مجاز است
  if (after.baseUnit !== before.baseUnit) {
    const mv = await db.getByIndex('movements', 'ingredientId', id);
    if (mv.length) throw new Error('واحد پایه پس از ثبت گردش قابل تغییر نیست');
  }
  await db.put('ingredients', after);
  await db.logHistory({ entity: 'ingredients', entityId: id, action: 'update', before, after });
  return after;
}

export async function deleteIngredient(id) {
  const before = await db.get('ingredients', id);
  if (!before) throw new Error('ماده اولیه یافت نشد');
  const mv = await db.getByIndex('movements', 'ingredientId', id);
  if (mv.length) throw new Error('این ماده گردش انبار دارد و قابل حذف نیست؛ برای حفظ سوابق غیرفعال کنید');
  const recipes = await db.getAll('recipes');
  if (recipes.some((r) => (r.items || []).some((i) => i.ingredientId === id))) {
    throw new Error('این ماده در رسپی استفاده شده و قابل حذف نیست');
  }
  await db.del('ingredients', id);
  await db.logHistory({ entity: 'ingredients', entityId: id, action: 'delete', before });
  return true;
}

/* ---------- گردش انبار ---------- */

export async function listMovements(filters = {}) {
  let rows = await db.getAll('movements');
  if (filters.ingredientId) rows = rows.filter((m) => m.ingredientId === filters.ingredientId);
  if (filters.type) rows = rows.filter((m) => m.type === filters.type);
  if (filters.from) rows = rows.filter((m) => m.date >= filters.from);
  if (filters.to) rows = rows.filter((m) => m.date <= filters.to);
  rows.sort((a, b) => b.ts - a.ts || (b.id > a.id ? 1 : -1));
  if (filters.limit) rows = rows.slice(0, filters.limit);
  return joinIngredientName(rows);
}

async function applyMovement({ ingredientId, type, signedQty, date, time, refType = '', refId = '', note = '', unitCost = null, value = null }) {
  const ing = await db.get('ingredients', ingredientId);
  if (!ing) throw new Error('ماده اولیه یافت نشد');
  const qty = num(signedQty, 0);
  let state = { stock: num(ing.stock, 0), wac: num(ing.wac, 0) };
  let val = value;

  if (qty > 0) {
    // ورود: unitCost (تومان هر واحد پایه) یا value کل
    const inValue = val != null ? num(val, 0) : num(unitCost, 0) * qty;
    state = wacIn(state, qty, inValue);
    val = inValue;
  } else if (qty < 0) {
    const out = wacOut(state, qty);
    state = { stock: out.stock, wac: out.wac };
    val = out.value;
  }

  ing.stock = state.stock;
  ing.wac = state.wac;
  ing.updatedAt = Date.now();

  const mv = {
    id: uid('mv'), ingredientId, type,
    qty, date, time: time || nowTime(),
    ts: Date.now(), refType, refId,
    note: String(note || ''),
    value: Math.round(num(val, 0)),
    stockAfter: ing.stock,
    wacAfter: Number(ing.wac.toFixed(4)),
  };
  await db.writeBatch([
    { store: 'ingredients', value: ing },
    { store: 'movements', value: mv },
  ]);
  return { movement: mv, ingredient: ing };
}

/** ورود دستی (با امکان ثبت بهای خرید برای به‌روزرسانی میانگین) */
export async function manualIn({ ingredientId, qty, unit = null, unitCost = null, date = todayJalali(), note = '' }) {
  const ing = await db.get('ingredients', ingredientId);
  if (!ing) throw new Error('ماده اولیه یافت نشد');
  const q = num(qty, 0);
  if (q <= 0) throw new Error('مقدار ورود باید بزرگ‌تر از صفر باشد');
  const baseQty = toBaseQty(ing, q, unit || ing.baseUnit);
  const r = await applyMovement({
    ingredientId, type: 'in', signedQty: baseQty, date, refType: 'manual',
    note: note || `ورود دستی ${fmtQtyLocal(q)} ${unit || ing.baseUnit}`,
    unitCost: unitCost != null && unitCost !== '' ? num(unitCost, 0) / baseQty : null,
  });
  await db.logHistory({ entity: 'movements', entityId: r.movement.id, action: 'create', after: r.movement, note: 'ورود دستی' });
  return r;
}

/** خروج دستی (مصرف بدون فروش) */
export async function manualOut({ ingredientId, qty, unit = null, date = todayJalali(), note = '' }) {
  const ing = await db.get('ingredients', ingredientId);
  if (!ing) throw new Error('ماده اولیه یافت نشد');
  const q = num(qty, 0);
  if (q <= 0) throw new Error('مقدار خروج باید بزرگ‌تر از صفر باشد');
  const baseQty = toBaseQty(ing, q, unit || ing.baseUnit);
  const r = await applyMovement({
    ingredientId, type: 'out', signedQty: -baseQty, date, refType: 'manual',
    note: note || `خروج دستی ${fmtQtyLocal(q)} ${unit || ing.baseUnit}`,
  });
  await db.logHistory({ entity: 'movements', entityId: r.movement.id, action: 'create', after: r.movement, note: 'خروج دستی' });
  if (r.ingredient.stock < 0) {
    return { ...r, warn: `موجودی «${ing.name}» منفی شد (${fmtQtyLocal(r.ingredient.stock)} ${ing.baseUnit})` };
  }
  return r;
}

/** ثبت ضایعات */
export async function recordWaste({ ingredientId, qty, unit = null, reason = '', date = todayJalali() }) {
  const ing = await db.get('ingredients', ingredientId);
  if (!ing) throw new Error('ماده اولیه یافت نشد');
  const q = num(qty, 0);
  if (q <= 0) throw new Error('مقدار ضایعات باید بزرگ‌تر از صفر باشد');
  const baseQty = toBaseQty(ing, q, unit || ing.baseUnit);
  const r = await applyMovement({
    ingredientId, type: 'waste', signedQty: -baseQty, date, refType: 'waste',
    note: reason || 'ضایعات',
  });
  await db.logHistory({ entity: 'movements', entityId: r.movement.id, action: 'create', after: r.movement, note: 'ضایعات' });
  return r;
}

/** شمارش واقعی و اعمال اختلاف */
export async function applyCount({ date = todayJalali(), items = [], note = '' }) {
  const ops = [];
  const results = [];
  for (const it of items) {
    const ing = await db.get('ingredients', it.ingredientId);
    if (!ing) continue;
    const countQty = num(it.countQty, 0);
    const sys = num(ing.stock, 0);
    const diff = Number((countQty - sys).toFixed(3));
    if (Math.abs(diff) < 1e-9) continue;
    const r = await applyMovement({
      ingredientId: ing.id, type: 'adjust', signedQty: diff, date, refType: 'count',
      note: note || `شمارش: سیستمی ${fmtQtyLocal(sys)} ← واقعی ${fmtQtyLocal(countQty)}`,
    });
    results.push(r);
    ops.push({ ingredientId: ing.id, sys, countQty, diff, after: r.ingredient.stock });
  }
  const countRec = {
    id: uid('cnt'), date, ts: Date.now(), note: String(note || '').trim(),
    items: results.map((r) => ({ ingredientId: r.movement.ingredientId, after: r.ingredient.stock })),
    diffs: ops,
  };
  await db.put('counts', countRec);
  await db.logHistory({ entity: 'counts', entityId: countRec.id, action: 'create', after: countRec, note: 'شمارش موجودی' });
  return { count: countRec, results };
}

/** بازگردانی خرید (توسط purchaseService) */
export async function reversePurchaseLine(ingredientId, qtyBase, lineTotal) {
  const ing = await db.get('ingredients', ingredientId);
  if (!ing) return null;
  const state = wacReverse({ stock: num(ing.stock, 0), wac: num(ing.wac, 0) }, qtyBase, lineTotal);
  ing.stock = state.stock;
  ing.wac = state.wac;
  ing.updatedAt = Date.now();
  await db.put('ingredients', ing);
  return ing;
}

/* ---------- گزارش‌ها ---------- */

export async function lowStockList() {
  const all = await listIngredients();
  return all.filter((i) => i.minStock > 0 && num(i.stock, 0) <= num(i.minStock, 0));
}

export async function expiryList(days = 7) {
  const all = await listIngredients();
  const today = todayJalali();
  const limit = addDaysJalali(today, days);
  return all
    .filter((i) => i.expiryDate)
    .map((i) => ({ ...i, expired: i.expiryDate < today, soon: i.expiryDate >= today && i.expiryDate <= limit }))
    .filter((i) => i.expired || i.soon)
    .sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));
}

/** گردش یک ماده در بازه */
export async function materialFlow(ingredientId, from, to) {
  const ing = await db.get('ingredients', ingredientId);
  if (!ing) throw new Error('ماده اولیه یافت نشد');
  const rows = (await db.getByIndex('movements', 'ingredientId', ingredientId))
    .filter((m) => (!from || m.date >= from) && (!to || m.date <= to))
    .sort((a, b) => a.ts - b.ts);
  return { ingredient: ing, rows };
}

/* کمکی محلی */
function fmtQtyLocal(n) {
  const x = num(n, 0);
  return Number.isInteger(x) ? String(x) : String(Number(x.toFixed(3)));
}
