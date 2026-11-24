/* ============================================================
   سرویس گزارش‌ها — داشبورد، سود و زیان، گزارش روزانه
   ============================================================ */

import * as db from '../core/db.js';
import { computeProfit as profit } from '../core/money.js';
import { cashFlow, cashBalance } from './cashService.js';
import { lowStockList, expiryList } from './inventoryService.js';
import { listSuppliers } from './purchaseService.js';
import {
  num, roundToman, todayJalali, addDaysJalali, lastMonths,
  currentJalaliMonth, jalaliToDate,
} from '../core/utils.js';

/* ---------- داشبورد ---------- */

export async function dashboardData() {
  const today = todayJalali();
  const from14 = addDaysJalali(today, -13);

  const [sales, expenses, ingredients, categories, foods, cashEntries, suppliers, recipes] = await Promise.all([
    db.getAll('sales'), db.getAll('expenses'), db.getAll('ingredients'),
    db.getAll('categories'), db.getAll('foods'), db.getAll('cashEntries'),
    listSuppliers(), db.getAll('recipes'),
  ]);

  const todaySales = sales.filter((s) => s.date === today);
  const todayExp = expenses.filter((e) => e.date === today);

  const revenueToday = roundToman(todaySales.reduce((s, x) => s + num(x.total, 0), 0));
  const cogsToday = roundToman(todaySales.reduce((s, x) => s + num(x.cogs, 0), 0));
  const discountToday = roundToman(todaySales.reduce((s, x) => s + num(x.discount, 0), 0));
  const wasteToday = await wasteValueBetween(today, today);

  // سری ۱۴ روز
  const series = [];
  for (let i = 0; i < 14; i += 1) {
    const d = addDaysJalali(from14, i);
    const daySales = sales.filter((s) => s.date === d);
    series.push({
      date: d,
      revenue: roundToman(daySales.reduce((s, x) => s + num(x.total, 0), 0)),
      count: daySales.length,
    });
  }

  // ترکیب پرداخت (امروز)
  const paySplit = {
    cash: roundToman(todaySales.reduce((s, x) => s + num(x.payments?.cash, 0), 0)),
    card: roundToman(todaySales.reduce((s, x) => s + num(x.payments?.card, 0), 0)),
    credit: roundToman(todaySales.reduce((s, x) => s + num(x.payments?.credit, 0), 0)),
  };

  // پرفروش‌ترین غذاها (۳۰ روز)
  const from30 = addDaysJalali(today, -29);
  const foodCount = new Map();
  for (const s of sales) {
    if (s.date < from30 || s.date > today) continue;
    for (const it of s.items || []) {
      const cur = foodCount.get(it.foodName) || { name: it.foodName, qty: 0, revenue: 0 };
      cur.qty += num(it.qty, 0);
      cur.revenue += num(it.total, 0);
      foodCount.set(it.foodName, cur);
    }
  }
  const topFoods = [...foodCount.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 7);

  const balance = await cashBalance();
  const supplierDebt = roundToman(suppliers.reduce((s, x) => s + num(x.debt, 0), 0));
  const creditReceivable = roundToman(sales.reduce((s, x) => s + num(x.creditRemaining, 0), 0));
  const lowStock = await lowStockList();
  const expiring = await expiryList(getExpiryDays());

  const recentSales = sales.sort((a, b) => b.ts - a.ts).slice(0, 6);

  const profitToday = profit({ revenue: revenueToday, cogs: cogsToday, waste: wasteToday, expenses: todayExp.reduce((s, e) => s + num(e.amount, 0), 0) });

  return {
    today, revenueToday, cogsToday, discountToday, wasteToday,
    profitToday, salesCountToday: todaySales.length,
    series, paySplit, topFoods,
    balance, supplierDebt, creditReceivable,
    lowStock, expiring,
    counts: {
      categories: categories.length, foods: foods.length,
      ingredients: ingredients.length, recipes: recipes.length,
      activeFoods: foods.filter((f) => f.active !== false).length,
    },
    recentSales,
    month: await monthSummary(currentJalaliMonth().from, currentJalaliMonth().to),
  };
}

function getExpiryDays() {
  try {
    const s = JSON.parse(localStorage.getItem('aftab.settings.v1') || '{}');
    return num(s.expiryAlertDays, 7);
  } catch { return 7; }
}

/** ارزش ضایعات در بازه (از روی حرکات انبار) */
export async function wasteValueBetween(from, to) {
  const movs = await db.getAll('movements');
  return roundToman(movs
    .filter((m) => m.type === 'waste' && m.date >= from && m.date <= to)
    .reduce((s, m) => s + Math.abs(num(m.value, 0)), 0));
}

/* ---------- خلاصه مالی یک بازه ---------- */

async function rangeCore(from, to) {
  const [sales, expenses] = await Promise.all([db.getAll('sales'), db.getAll('expenses')]);
  const inRange = (d) => d >= from && d <= to;
  const s = sales.filter((x) => inRange(x.date));
  const e = expenses.filter((x) => inRange(x.date));

  const revenue = roundToman(s.reduce((sum, x) => sum + num(x.total, 0), 0));
  const grossSales = roundToman(s.reduce((sum, x) => sum + num(x.subtotal, 0), 0));
  const discount = roundToman(s.reduce((sum, x) => sum + num(x.discount, 0), 0));
  const cogs = roundToman(s.reduce((sum, x) => sum + num(x.cogs, 0), 0));
  const payments = {
    cash: roundToman(s.reduce((sum, x) => sum + num(x.payments?.cash, 0), 0)),
    card: roundToman(s.reduce((sum, x) => sum + num(x.payments?.card, 0), 0)),
    credit: roundToman(s.reduce((sum, x) => sum + num(x.payments?.credit, 0), 0)),
  };
  const waste = await wasteValueBetween(from, to);
  const expByCat = new Map();
  for (const x of e) expByCat.set(x.category, (expByCat.get(x.category) || 0) + num(x.amount, 0));
  const expensesTotal = roundToman([...expByCat.values()].reduce((a, b) => a + b, 0));
  const flow = await cashFlow(from, to);

  return {
    from, to,
    salesCount: s.length,
    grossSales, discount, revenue, cogs, payments,
    waste, expensesTotal,
    expensesByCategory: [...expByCat.entries()].map(([name, amount]) => ({ name, amount: roundToman(amount) })).sort((a, b) => b.amount - a.amount),
    cashflow: flow,
    profit: profit({ revenue, cogs, waste, expenses: expensesTotal }),
    sales: s, expenses: e,
  };
}

/** گزارش سود و زیان بازه */
export async function profitLoss(from, to) {
  const core = await rangeCore(from, to);
  // روند ۶ ماه اخیر برای نمودار
  const months = lastMonths(6);
  const sales = await db.getAll('sales');
  const expenses = await db.getAll('expenses');
  const trend = [];
  for (const m of months) {
    const rev = roundToman(sales.filter((s) => s.date >= m.from && s.date <= m.to).reduce((a, s) => a + num(s.total, 0), 0));
    const cg = roundToman(sales.filter((s) => s.date >= m.from && s.date <= m.to).reduce((a, s) => a + num(s.cogs, 0), 0));
    const ex = roundToman(expenses.filter((s) => s.date >= m.from && s.date <= m.to).reduce((a, s) => a + num(s.amount, 0), 0));
    trend.push({ label: m.label, key: m.key, revenue: rev, cogs: cg, expenses: ex, net: rev - cg - ex });
  }
  return { ...core, trend };
}

/** خلاصه یک ماه */
async function monthSummary(from, to) {
  const core = await rangeCore(from, to);
  return {
    from, to,
    revenue: core.revenue, cogs: core.cogs,
    expenses: core.expensesTotal, waste: core.waste,
    profit: core.profit, salesCount: core.salesCount,
  };
}

/** تعداد روز یک بازه شمسی (شامل هر دو سر) */
function dayCount(from, to) {
  const ms = jalaliToDate(to) - jalaliToDate(from);
  return Math.max(1, Math.round(ms / 86400000) + 1);
}

/**
 * مقایسه بازه جاری با بازه قبلی هم‌طول (بلافاصله قبل از آن).
 * مثال: ۷ روز اخیر در برابر ۷ روز پیش از آن.
 */
export async function compareWithPrevious(from, to) {
  const days = dayCount(from, to);
  const prevTo = addDaysJalali(from, -1);
  const prevFrom = addDaysJalali(prevTo, -(days - 1));
  const [a, b] = await Promise.all([rangeCore(from, to), rangeCore(prevFrom, prevTo)]);
  const pick = (r) => ({
    revenue: r.revenue,
    cogs: r.cogs,
    gross: r.profit.gross,
    net: r.profit.net,
    expenses: r.expensesTotal,
    waste: r.waste,
    salesCount: r.salesCount,
  });
  return { days, from, to, prevFrom, prevTo, curr: pick(a), prev: pick(b) };
}

/* ---------- گزارش روزانه ---------- */

export async function dailyReport(date = todayJalali()) {
  const core = await rangeCore(date, date);
  const [movs, counts, purchases] = await Promise.all([
    db.getAll('movements'), db.getAll('counts'), db.getAll('purchases'),
  ]);
  const dayMovs = movs.filter((m) => m.date === date);
  const wasteMovs = dayMovs.filter((m) => m.type === 'waste');

  // پرفروش‌ترین غذاهای روز
  const foodMap = new Map();
  for (const s of core.sales) {
    for (const it of s.items || []) {
      const cur = foodMap.get(it.foodName) || { name: it.foodName, qty: 0, revenue: 0, cost: 0 };
      cur.qty += num(it.qty, 0);
      cur.revenue += num(it.total, 0);
      cur.cost += num(it.cost, 0);
      foodMap.set(it.foodName, cur);
    }
  }
  const topFoods = [...foodMap.values()].sort((a, b) => b.revenue - a.revenue);

  const dayPurchases = purchases.filter((p) => p.date === date);
  const prevDate = addDaysJalali(date, -1);
  const prevCore = await rangeCore(prevDate, prevDate);

  return {
    date,
    ...core,
    wasteMovs,
    wasteValue: core.waste,
    topFoods,
    purchases: dayPurchases,
    purchaseTotal: roundToman(dayPurchases.reduce((a, p) => a + num(p.total, 0), 0)),
    countsToday: counts.filter((c) => c.date === date),
    vsPrev: {
      revenueDelta: core.revenue - prevCore.revenue,
      countDelta: core.salesCount - prevCore.salesCount,
    },
    lowStock: await lowStockList(),
  };
}

/** جست‌وجوی سریع داشبورد: خلاصه موجودی */
export async function inventorySummary() {
  const ingredients = await db.getAll('ingredients');
  return {
    count: ingredients.length,
    value: roundToman(ingredients.reduce((s, i) => s + num(i.stock, 0) * num(i.wac, 0), 0)),
    low: await lowStockList(),
  };
}
