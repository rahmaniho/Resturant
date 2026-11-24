/* ============================================================
   محاسبات مالی — بهای تمام‌شده، میانگین موزون، سود
   ============================================================ */

import { roundToman, num } from './utils.js';

/**
 * اعمال ورود کالا روی میانگین موزون
 * @param {{stock:number, wac:number}} state موجودی فعلی (واحد پایه) و بهای میانگین هر واحد
 * @param {number} inQty مقدار ورود (واحد پایه، مثبت)
 * @param {number} inValue ارزش ریالی ورود (تومان)
 * @returns {{stock:number, wac:number, value:number}}
 */
export function wacIn(state, inQty, inValue) {
  const stock = num(state.stock, 0);
  const wac = num(state.wac, 0);
  const q = num(inQty, 0);
  const v = num(inValue, 0);
  if (q <= 0) return { stock, wac, value: stock * wac };
  const oldV = stock > 0 ? stock * wac : 0;
  const newQty = stock + q;
  const newValue = oldV + v;
  const newWac = newQty > 0 ? newValue / newQty : 0;
  return { stock: newQty, wac: newWac, value: newValue };
}

/**
 * خروج از انبار (مصرف/ضایعات) — بهای تمام‌شده خروج با میانگین فعلی
 * خروج از موجودی منفی مجاز است (با هشدار در لایه UI)
 */
export function wacOut(state, outQty) {
  const stock = num(state.stock, 0);
  const wac = num(state.wac, 0);
  const q = Math.abs(num(outQty, 0));
  const value = q * wac;
  const newQty = stock - q;
  // اگر موجودی صفر شد، میانگین را نگه می‌داریم تا ادامه محاسبات سالم بماند
  return { stock: newQty, wac, value, outValue: value };
}

/**
 * بازگردانی خرید (حذف سند خرید): ارزش خرید از مخزن کم می‌شود
 */
export function wacReverse(state, qty, lineTotal) {
  const stock = num(state.stock, 0);
  const wac = num(state.wac, 0);
  const q = Math.abs(num(qty, 0));
  const t = Math.abs(num(lineTotal, 0));
  const newQty = stock - q;
  let newValue = stock * wac - t;
  if (newQty <= 0) return { stock: newQty, wac: 0, value: Math.max(0, newValue) };
  newValue = Math.max(0, newValue);
  return { stock: newQty, wac: newValue / newQty, value: newValue };
}

/** ارزش فعلی موجودی انبار */
export function stockValue(ingredients) {
  return (ingredients || []).reduce((s, it) => s + (num(it.stock, 0) * num(it.wac, 0)), 0);
}

/**
 * بهای تمام‌شده یک پرسیشن غذا از روی رسپی
 * @param {Array<{qty:number, wac:number}>} items اقلام رسپی با مقدار به واحد پایه و بهای میانگین
 * @returns {number} تومان (گردشده)
 */
export function recipeCost(items) {
  const total = (items || []).reduce((s, it) => s + num(it.qty, 0) * num(it.wac, 0), 0);
  return roundToman(total);
}

/** جمع فروش از اقلام */
export function linesTotal(items) {
  return (items || []).reduce((s, it) => s + num(it.qty, 0) * num(it.unitPrice, 0), 0);
}

/**
 * اعتبارسنجی پرداخت‌های ترکیبی: نقدی + کارت + نسیه === مبلغ کل
 */
export function validatePayments(total, payments) {
  const cash = num(payments?.cash, 0);
  const card = num(payments?.card, 0);
  const credit = num(payments?.credit, 0);
  if (cash < 0 || card < 0 || credit < 0) return { ok: false, msg: 'مبالغ پرداخت نمی‌توانند منفی باشند' };
  const sum = roundToman(cash) + roundToman(card) + roundToman(credit);
  const t = roundToman(total);
  if (sum !== t) {
    return { ok: false, msg: `جمع پرداخت‌ها (${sum}) با مبلغ کل (${t}) برابر نیست` };
  }
  return { ok: true, cash: roundToman(cash), card: roundToman(card), credit: roundToman(credit) };
}

/** سود ناخالص و خالص */
export function computeProfit({ revenue = 0, cogs = 0, waste = 0, expenses = 0 }) {
  const gross = roundToman(revenue) - roundToman(cogs);
  const net = gross - roundToman(waste) - roundToman(expenses);
  return {
    revenue: roundToman(revenue),
    cogs: roundToman(cogs),
    gross,
    waste: roundToman(waste),
    expenses: roundToman(expenses),
    net,
    grossMargin: revenue > 0 ? (gross / revenue) * 100 : 0,
    netMargin: revenue > 0 ? (net / revenue) * 100 : 0,
  };
}
