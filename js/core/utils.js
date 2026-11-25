/* ============================================================
   ابزارهای عمومی — ارقام فارسی، قالب‌بندی، تقویم شمسی
   ============================================================ */

const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';

/** تبدیل ارقام لاتین/عربی به فارسی */
export function toFa(value) {
  return String(value == null ? '' : value)
    .replace(/[0-9]/g, (d) => FA_DIGITS[d])
    .replace(/[٠-٩]/g, (d) => AR_DIGITS.indexOf(d) >= 0 ? FA_DIGITS[AR_DIGITS.indexOf(d)] : d);
}

/** تبدیل همه ارقام فارسی/عربی به لاتین */
export function toEn(value) {
  return String(value == null ? '' : value)
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(AR_DIGITS.indexOf(d)));
}

/** نرمال‌سازی متن جست‌وجو */
export function normalize(str) {
  return toEn(str == null ? '' : String(str))
    .replace(/[ي]/g, 'ی').replace(/[ك]/g, 'ک')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** عدد از ورودی کاربر (پشتیبانی از ارقام فارسی و جداکننده هزارگان «٬» و «,») */
export function num(value, fallback = 0) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback;
  let s = toEn(value);
  // حذف جداکننده‌های هزارگان (فارسی٬ لاتین، فاصله) + ممیز عربی و علامت منهای بلند
  s = s.replace(/[,٬\s ]/g, '').replace(/٫/g, '.').replace(/−/g, '-');
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * قالب‌بندی زنده عدد برای ورودی‌ها: ارقام فارسی + جداکننده سه‌رقمی از چپ
 * نمونه: 1234567 → '۱٬۲۳۴٬۵۶۷' | 12.5 → '۱۲٫۵'
 */
export function formatNumInput(value) {
  if (value == null) return '';
  let s = toEn(String(value)).replace(/[,٬\s ]/g, '').replace(/٫/g, '.').replace(/−/g, '-');
  if (s === '' || s === '-' || s === '.') return s === '-' ? '-' : '';
  let neg = false;
  if (s.startsWith('-')) { neg = true; s = s.slice(1); }
  if (!/^\d*\.?\d*$/.test(s)) return toFa(String(value)); // ورودی غیرعددی → فقط تبدیل ارقام
  const [i, f] = s.split('.');
  const grouped = (i || '0').replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const out = s.includes('.') ? `${grouped}٫${f ?? ''}` : grouped;
  return (neg ? '−' : '') + toFa(out);
}

/** گرد کردن مبلغ به تومان (عدد صحیح) */
export function roundToman(n) {
  return Math.round(Number(n) || 0);
}

/** قالب عدد با جداکننده هزارگان فارسی */
export function fmtNum(n, dec = 0) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const x = Number(n);
  const s = Math.abs(x).toFixed(dec);
  const [i, f] = s.split('.');
  const withSep = i.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  const out = f ? `${withSep}.${f}` : withSep;
  return (x < 0 ? '−' : '') + toFa(out);
}

/** قالب مبلغ تومان */
export function fmtMoney(n) {
  return fmtNum(roundToman(n), 0);
}

/** قالب مبلغ همراه با واحد */
export function fmtToman(n) {
  return `${fmtMoney(n)} تومان`;
}

/** قالب مقدار کمی (حذف صفرهای اضافه) */
export function fmtQty(n) {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const x = Number(n);
  const s = Number.isInteger(x) ? String(x) : String(Number(x.toFixed(3)));
  const [i, f] = s.split('.');
  const grouped = i.replace(/\B(?=(\d{3})+(?!\d))/g, '٬');
  return toFa(f ? `${grouped}٫${f}` : grouped);
}

/** درصد */
export function fmtPercent(n, dec = 1) {
  if (!Number.isFinite(Number(n))) return '—';
  return toFa(Number(n).toFixed(dec)) + '٪';
}

export function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function uid(prefix = '') {
  let r;
  try {
    r = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  } catch {
    r = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }
  return prefix ? `${prefix}_${r}` : r;
}

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

export function clone(obj) {
  return obj == null ? obj : JSON.parse(JSON.stringify(obj));
}

/* ============================================================
   تقویم شمسی — الگوریتم رسمی jalaali-js (MIT) به‌صورت محلی
   ============================================================ */

import {
  toJalaali as jalToJalaali,
  toGregorian as jalToGregorian,
  jalaaliMonthLength,
} from './jalaali.js';

/** میلادی → شمسی {jy, jm, jd} */
export function toJalaali(gy, gm, gd) {
  return jalToJalaali(gy, gm, gd);
}

/** شمسی → میلادی {gy, gm, gd} */
export function toGregorian(jy, jm, jd) {
  return jalToGregorian(jy, jm, jd);
}

export function daysInMonth(jy, jm) {
  return jalaaliMonthLength(jy, jm);
}

export function isValidJalali(jy, jm, jd) {
  return jy >= 1 && jm >= 1 && jm <= 12 && jd >= 1 && jd <= daysInMonth(jy, jm);
}

export const MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور', 'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند'];
export const WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه'];

/** Date → 'YYYY-MM-DD' شمسی */
export function dateToJalali(date = new Date()) {
  const { gy, gm, gd } = {
    gy: date.getFullYear(),
    gm: date.getMonth() + 1,
    gd: date.getDate(),
  };
  const { jy, jm, jd } = toJalaali(gy, gm, gd);
  return `${String(jy).padStart(4, '0')}-${String(jm).padStart(2, '0')}-${String(jd).padStart(2, '0')}`;
}

/** 'YYYY-MM-DD' شمسی → Date (نیمه‌شب به وقت محلی) */
export function jalaliToDate(dateStr) {
  const [jy, jm, jd] = String(dateStr).split('-').map(Number);
  const { gy, gm, gd } = toGregorian(jy, jm, jd);
  return new Date(gy, gm - 1, gd);
}

export function todayJalali() {
  return dateToJalali(new Date());
}

/** HH:MM فارسی‌شده (برای نمایش) */
export function nowTime(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** نمایش تاریخ شمسی با فرمت استاندارد: '۳ آذر ۱۴۰۵' */
export function fmtDate(dateStr) {
  if (!dateStr) return '—';
  const s = String(dateStr);
  const [jy, jm, jd] = s.split('-').map(Number);
  if (!isValidJalali(jy, jm, jd)) return toFa(s.replace(/-/g, '/')); // ورودی نامعتبر → مسیر
  return `${toFa(jd)} ${MONTHS[jm - 1]} ${toFa(jy)}`;
}

/** هم‌فرمت fmtDate (نام کامل‌تر در سررسیدها) */
export function fmtDateLong(dateStr) {
  return fmtDate(dateStr);
}

/** نمایش کوتاه برای برچسب نمودار: '۳ آذر' */
export function fmtDateShort(dateStr) {
  if (!dateStr) return '—';
  const [jy, jm, jd] = String(dateStr).split('-').map(Number);
  if (!isValidJalali(jy, jm, jd)) return toFa(String(dateStr).replace(/-/g, '/'));
  return `${toFa(jd)} ${MONTHS[jm - 1]}`;
}

/** نام روز هفته تاریخ شمسی */
export function weekdayOf(dateStr) {
  const d = jalaliToDate(dateStr);
  return WEEKDAYS[d.getDay()];
}

/** افزودن روز به تاریخ شمسی */
export function addDaysJalali(dateStr, days) {
  const d = jalaliToDate(dateStr);
  d.setDate(d.getDate() + days);
  return dateToJalali(d);
}

/** شروع و پایان ماه شمسی */
export function jalaliMonthRange(jy, jm) {
  const from = `${String(jy).padStart(4, '0')}-${String(jm).padStart(2, '0')}-01`;
  const last = daysInMonth(jy, jm);
  const to = `${String(jy).padStart(4, '0')}-${String(jm).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  return { from, to };
}

/** ماه جاری: {jy, jm, from, to} */
export function currentJalaliMonth() {
  const { jy, jm } = toJalaali(new Date().getFullYear(), new Date().getMonth() + 1, new Date().getDate());
  return { jy, jm, ...jalaliMonthRange(jy, jm) };
}

/** کلید ماه: '1405-08' */
export function monthKey(dateStr) {
  return String(dateStr).slice(0, 7);
}

/** بازه ۶ ماه اخیر برای نمودار: [{key,label,from,to}] */
export function lastMonths(n = 6) {
  const out = [];
  const now = new Date();
  let { jy, jm } = toJalaali(now.getFullYear(), now.getMonth() + 1, now.getDate());
  for (let i = 0; i < n; i += 1) {
    out.unshift({ key: `${jy}-${String(jm).padStart(2, '0')}`, label: `${MONTHS[jm - 1]}`, ...jalaliMonthRange(jy, jm) });
    jm -= 1;
    if (jm === 0) { jm = 12; jy -= 1; }
  }
  return out;
}

/** فایل دانلود */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadText(text, filename, type = 'application/json;charset=utf-8') {
  downloadBlob(new Blob([text], { type }), filename);
}

export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsText(file, 'utf-8');
  });
}

export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
