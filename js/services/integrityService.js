/* ============================================================
   سرویس سلامت داده‌ها — راستی‌آزمایی و اصلاح خودکار
   ============================================================ */

import * as db from '../core/db.js';
import { num, roundToman, normalize } from '../core/utils.js';

/**
 * بررسی سلامت کل داده‌ها:
 * - موجودی ذخیره‌شده مواد = جمع گردش انبار
 * - تطابق اقلام/تخفیف/کل/پرداخت/بهای تمام‌شده فروش‌ها
 * - طلب باقی‌مانده نسیه = اعتبار − دریافت‌های ثبت‌شده
 * - یکتای کلید هزینه‌ها (جلوگیری از دوباره‌شماری)
 * - صحت ارجاع‌ها (دسته غذا، رسپی، گردش، خطوط خرید)
 * - مبالغ معتبر (غیرمنفی و غیرصفر در اسناد مالی)
 * @returns {Promise<{ok:boolean, issues:Array, stats:object}>}
 */
export async function runIntegrityCheck() {
  const [
    ings, movs, sales, cash, exps, foods, cats, recipes, purs, sups, tpls,
  ] = await Promise.all([
    db.getAll('ingredients'), db.getAll('movements'), db.getAll('sales'),
    db.getAll('cashEntries'), db.getAll('expenses'), db.getAll('foods'),
    db.getAll('categories'), db.getAll('recipes'), db.getAll('purchases'),
    db.getAll('suppliers'), db.getAll('expenseTemplates'),
  ]);

  const issues = [];
  const add = (severity, category, label, fix = null, fixable = false) => {
    issues.push({ severity, category, label, fix, fixable });
  };

  /* ---------- ۱) موجودی مواد اولیه در برابر گردش انبار ---------- */
  const ledger = new Map();
  for (const m of movs) {
    ledger.set(m.ingredientId, (ledger.get(m.ingredientId) || 0) + num(m.qty, 0));
  }
  for (const ing of ings) {
    const sum = Number((ledger.get(ing.id) || 0).toFixed(3));
    const stored = Number(num(ing.stock, 0).toFixed(3));
    if (Math.abs(sum - stored) > 1e-6) {
      add('error', 'stock',
        `موجودی «${ing.name}» ناهماهنگ است: ثبت‌شده ${stored} ← گردش ${sum} ${ing.baseUnit}`,
        { type: 'stock', ingredientId: ing.id, value: sum }, true);
    }
    if (num(ing.minStock, 0) < 0) add('warn', 'stock', `حداقل موجودی «${ing.name}» منفی است`);
  }

  /* ---------- ۲) فروش‌ها ---------- */
  const creditReceived = new Map(); // saleId → مجموع دریافت‌ها
  for (const c of cash) {
    if (c.refType === 'creditPayment' && c.refId) {
      creditReceived.set(c.refId, (creditReceived.get(c.refId) || 0) + num(c.amount, 0));
    }
  }
  for (const s of sales) {
    const itemsSum = roundToman((s.items || []).reduce((a, i) => a + num(i.total, 0), 0));
    if (itemsSum !== roundToman(num(s.subtotal, 0))) {
      add('error', 'sale', `فروش ${s.date} ${s.time || ''}: جمع اقلام (${itemsSum}) ≠ جمع کل (${roundToman(num(s.subtotal, 0))})`);
    }
    const net = roundToman(num(s.subtotal, 0)) - roundToman(num(s.discount, 0));
    if (net !== roundToman(num(s.total, 0))) {
      add('error', 'sale', `فروش ${s.date}: کل − تخفیف (${net}) ≠ مبلغ کل (${roundToman(num(s.total, 0))})`);
    }
    const p = s.payments || {};
    const paySum = roundToman(num(p.cash, 0)) + roundToman(num(p.card, 0)) + roundToman(num(p.credit, 0));
    if (paySum !== roundToman(num(s.total, 0))) {
      add('error', 'sale', `فروش ${s.date}: جمع پرداخت‌ها (${paySum}) ≠ مبلغ کل (${roundToman(num(s.total, 0))})`);
    }
    const cogsSum = roundToman((s.items || []).reduce((a, i) => a + num(i.cost, 0), 0));
    if (cogsSum !== roundToman(num(s.cogs, 0))) {
      add('warn', 'sale', `فروش ${s.date}: بهای تمام‌شده اقلام (${cogsSum}) ≠ سند (${roundToman(num(s.cogs, 0))})`);
    }
    // طلب باقی‌مانده نسیه
    const credit = roundToman(num(p.credit, 0));
    const received = roundToman(creditReceived.get(s.id) || 0);
    const expected = Math.max(0, credit - received);
    const current = roundToman(num(s.creditRemaining, 0));
    if (current !== expected) {
      add('error', 'sale', `فروش ${s.date}: طلب باقی‌مانده (${current}) ≠ محاسبه (${expected})`,
        { type: 'creditRemaining', saleId: s.id, value: expected }, true);
    }
    if (current < 0) {
      add('error', 'sale', `فروش ${s.date}: طلب باقی‌مانده منفی است`);
    }
  }

  /* ---------- ۳) اسناد صندوق ---------- */
  for (const c of cash) {
    if (!(num(c.amount, 0) > 0)) {
      add('error', 'cash', `سند صندوق با مبلغ نامعتبر (${c.amount}) در ${c.date}`);
    }
    if (c.type !== 'in' && c.type !== 'out') {
      add('error', 'cash', `نوع تراکنش نامعتبر در سند صندوق ${c.date}`);
    }
  }

  /* ---------- ۴) هزینه‌ها — یکتایی کلید ---------- */
  const keyMap = new Map();
  for (const e of exps) {
    const k = e.uniqueKey || `one:${e.id}`;
    if (keyMap.has(k)) {
      add('error', 'expense', `کلید تکراری هزینه: «${e.category}» ${e.date} (دوباره‌شماری!)`);
    }
    keyMap.set(k, e.id);
    if (!(num(e.amount, 0) > 0)) add('error', 'expense', `هزینه «${e.category}» ${e.date} مبلغ نامعتبر دارد`);
  }

  /* ---------- ۵) ارجاع‌ها ---------- */
  const catIds = new Set(cats.map((c) => c.id));
  const foodIds = new Set(foods.map((f) => f.id));
  const ingIds = new Set(ings.map((i) => i.id));
  const supIds = new Set(sups.map((s) => s.id));

  for (const f of foods) {
    if (!catIds.has(f.categoryId)) add('error', 'ref', `غذای «${f.name}» به دسته حذف‌شده متصل است`);
    if (!(num(f.price, 0) >= 0)) add('warn', 'ref', `غذای «${f.name}» قیمت نامعتبر دارد`);
  }
  for (const r of recipes) {
    if (!foodIds.has(r.foodId)) add('warn', 'ref', `رسپی‌ای برای غذای حذف‌شده باقی مانده است`, { type: 'recipe', recipeId: r.id }, true);
    for (const it of r.items || []) {
      if (!ingIds.has(it.ingredientId)) add('error', 'ref', `رسپی به ماده حذف‌شده اشاره دارد`);
    }
  }
  for (const m of movs) {
    if (!ingIds.has(m.ingredientId)) add('error', 'ref', `گردش انبار به ماده حذف‌شده اشاره دارد`);
  }
  for (const p of purs) {
    if (p.supplierId && !supIds.has(p.supplierId)) add('warn', 'ref', `خرید ${p.date} به تأمین‌کننده حذف‌شده اشاره دارد`);
    for (const line of p.lines || []) {
      if (!ingIds.has(line.ingredientId)) add('error', 'ref', `سند خرید ${p.date} به ماده حذف‌شده اشاره دارد`);
      const expect = roundToman(num(line.qty, 0) * num(line.unitPrice, 0));
      if (expect !== roundToman(num(line.total, 0))) {
        add('warn', 'ref', `خط خرید ${p.date}: جمع خط (${line.total}) با مقدار×قیمت (${expect}) نمی‌خواند`);
      }
    }
  }

  /* ---------- ۶) یکتایی نام‌ها ---------- */
  const nameCheck = (rows, label) => {
    const seen = new Map();
    for (const r of rows) {
      const n = normalize(r.name || '');
      if (seen.has(n)) add('warn', 'dup', `${label} تکراری: «${r.name}»`);
      seen.set(n, r.id);
    }
  };
  nameCheck(cats, 'دسته‌بندی');
  nameCheck(ings, 'ماده اولیه');

  const stats = {
    ingredients: ings.length, movements: movs.length, sales: sales.length,
    cashEntries: cash.length, expenses: exps.length, foods: foods.length,
    recipes: recipes.length, purchases: purs.length,
    fixedCount: issues.filter((i) => i.fixable).length,
  };

  return { ok: issues.length === 0, issues, stats };
}

/**
 * اعمال اصلاحات خودکار (فروض با fixable)
 * @param {Array} issues همان خروجی runIntegrityCheck
 */
export async function fixIssues(issues) {
  const fixable = (issues || []).filter((i) => i.fixable && i.fix);
  const ops = [];
  let fixed = 0;

  for (const issue of fixable) {
    const f = issue.fix;
    if (f.type === 'stock') {
      const ing = await db.get('ingredients', f.ingredientId);
      if (!ing) continue;
      ops.push({ store: 'ingredients', value: { ...ing, stock: f.value, updatedAt: Date.now() } });
      fixed += 1;
    } else if (f.type === 'creditRemaining') {
      const sale = await db.get('sales', f.saleId);
      if (!sale) continue;
      ops.push({ store: 'sales', value: { ...sale, creditRemaining: f.value, updatedAt: Date.now() } });
      fixed += 1;
    } else if (f.type === 'recipe') {
      ops.push({ store: 'recipes', delete: f.recipeId });
      fixed += 1;
    }
  }

  if (ops.length) await db.writeBatch(ops);
  await db.logHistory({
    entity: 'integrity', entityId: 'fix', action: 'update',
    note: `اصلاح ${fixed} مورد ناهماهنگی داده‌ها`,
    after: { fixed },
  });
  return fixed;
}
