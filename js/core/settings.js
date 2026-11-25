/* ============================================================
   تنظیمات برنامه — LocalStorage
   ============================================================ */

const KEY = 'aftab.settings.v1';

export const DEFAULT_SETTINGS = {
  restaurantName: 'صبحانه‌سرای آفتاب',
  restaurantPhone: '', // تلفن چاپ‌شونده روی فاکتور
  restaurantAddress: '', // نشانی چاپ‌شونده روی فاکتور
  restaurantLogo: null, // dataURL لوگو (چاپ فاکتور و سربرگ گزارش‌ها)
  theme: 'light', // light | dark
  initialCash: 0, // موجودی ابتدای صندوق (تومان)
  expenseCategories: ['اجاره', 'حقوق', 'قبوض', 'حمل‌ونقل', 'تعمیرات', 'لوازم آشپزخانه', 'بهداشتی', 'متفرقه'],
  recurringAuto: true, // ایجاد خودکار هزینه‌های دوره جاری
  lowStockAlerts: true,
  expiryAlertDays: 7,
  lastBackupAt: null,
};

let cache = null;

export function getSettings() {
  if (cache) return cache;
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
  } catch {
    stored = {};
  }
  cache = { ...DEFAULT_SETTINGS, ...stored };
  return cache;
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  cache = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch (e) {
    console.warn('ذخیره تنظیمات ناموفق', e);
  }
  return next;
}

export function resetSettings() {
  cache = null;
  try { localStorage.removeItem(KEY); } catch { /* noop */ }
  return { ...DEFAULT_SETTINGS };
}

/** همگام‌سازی لوگوی فروشگاه در نوار کناری (تنظیمات ← لوگو) */
export function syncBrandLogo() {
  const el = document.querySelector('.brand-logo');
  if (!el) return;
  const logo = getSettings().restaurantLogo;
  el.src = logo || './icons/logo.png';
}

export function applyTheme(theme) {
  const t = theme === 'dark' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'dark' ? '#0a1712' : '#0f3d2e');
  saveSettings({ theme: t });
}
