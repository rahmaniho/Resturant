/* ============================================================
   سرویس دستور پخت (رسپی) — محاسبه بهای تمام‌شده غذا
   ============================================================ */

import * as db from '../core/db.js';
import { toBaseQty } from './inventoryService.js';
import { recipeCost } from '../core/money.js';
import { uid, num } from '../core/utils.js';

/** رسپی یک غذا (کلید = foodId) */
export async function getRecipe(foodId) {
  return db.get('recipes', foodId);
}

export async function listRecipes() {
  return db.getAll('recipes');
}

/**
 * ذخیره رسپی یک غذا
 * @param {string} foodId
 * @param {Array<{ingredientId:string, qty:number, unit:string}>} items
 */
export async function saveRecipe(foodId, items = [], notes = '') {
  const food = await db.get('foods', foodId);
  if (!food) throw new Error('غذا یافت نشد');
  const clean = [];
  for (const it of items) {
    if (!it.ingredientId) continue;
    const q = num(it.qty, 0);
    if (q <= 0) throw new Error('مقدار اقلام رسپی باید بزرگ‌تر از صفر باشد');
    const ing = await db.get('ingredients', it.ingredientId);
    if (!ing) throw new Error('ماده اولیه یافت نشد');
    clean.push({ ingredientId: it.ingredientId, qty: q, unit: it.unit || ing.baseUnit });
  }
  const before = await db.get('recipes', foodId);
  const recipe = {
    id: foodId,
    foodId,
    items: clean,
    notes: String(notes || '').trim(),
    updatedAt: Date.now(),
    createdAt: before?.createdAt || Date.now(),
  };
  await db.put('recipes', recipe);
  await db.logHistory({ entity: 'recipes', entityId: foodId, action: before ? 'update' : 'create', before, after: recipe });
  return recipe;
}

export async function deleteRecipe(foodId) {
  const before = await db.get('recipes', foodId);
  if (!before) return false;
  await db.del('recipes', foodId);
  await db.logHistory({ entity: 'recipes', entityId: foodId, action: 'delete', before });
  return true;
}

/**
 * جزئیات بهای تمام‌شده یک غذا با قیمت‌های به‌روز میانگین موزون
 * @returns {{hasRecipe:boolean, cost:number, lines:Array, warnings:string[]}}
 */
export async function foodCost(foodId) {
  const recipe = await db.get('recipes', foodId);
  if (!recipe || !recipe.items.length) return { hasRecipe: false, cost: 0, lines: [], warnings: ['رسپی ثبت نشده است'] };
  const warnings = [];
  const lines = [];
  for (const it of recipe.items) {
    const ing = await db.get('ingredients', it.ingredientId);
    if (!ing) {
      warnings.push('ماده اولیه‌ای حذف شده است');
      continue;
    }
    const baseQty = toBaseQty(ing, it.qty, it.unit);
    const value = baseQty * num(ing.wac, 0);
    lines.push({
      ingredientId: ing.id, name: ing.name,
      qty: it.qty, unit: it.unit, baseQty,
      wac: num(ing.wac, 0), value,
      stockLeft: num(ing.stock, 0) - baseQty,
    });
    if (num(ing.wac, 0) <= 0) warnings.push(`بهای میانگین «${ing.name}» صفر است`);
    if (num(ing.stock, 0) - baseQty < 0) warnings.push(`موجودی «${ing.name}» برای یک پرس کافی نیست`);
  }
  return { hasRecipe: true, cost: recipeCost(lines.map((l) => ({ qty: l.baseQty, wac: l.wac }))), lines, warnings };
}

/** فهرست همه غذاها همراه بهای تمام‌شده و حاشیه سود */
export async function menuCosts() {
  const foods = await db.getAll('foods');
  const cats = await db.getAll('categories');
  const catMap = new Map(cats.map((c) => [c.id, c.name]));
  const out = [];
  for (const f of foods) {
    const c = await foodCost(f.id);
    const price = num(f.price, 0);
    out.push({
      food: f,
      categoryName: catMap.get(f.categoryId) || '—',
      hasRecipe: c.hasRecipe,
      cost: c.cost,
      profit: price - c.cost,
      margin: price > 0 ? ((price - c.cost) / price) * 100 : 0,
      warnings: c.warnings,
    });
  }
  return out.sort((a, b) => a.food.name.localeCompare(b.food.name, 'fa'));
}
