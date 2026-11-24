/* ============================================================
   صبحانه‌سرای آفتاب — نقطه ورود برنامه (روتر و چیدمان)
   ============================================================ */

import { getSettings, applyTheme } from './core/settings.js';
import { openDB } from './core/db.js';
import { ensureInitialCash } from './services/cashService.js';
import { generateRecurring } from './services/expenseService.js';
import { ICONS, icon, toast, confirmDialog, openModal } from './ui/components.js';
import { todayJalali, fmtDateLong, weekdayOf, toFa, monthKey, escapeHtml } from './core/utils.js';

import * as dashboard from './pages/dashboard.js';
import * as sales from './pages/sales.js';
import * as menu from './pages/menu.js';
import * as ingredients from './pages/ingredients.js';
import * as warehouse from './pages/warehouse.js';
import * as recipes from './pages/recipes.js';
import * as purchases from './pages/purchases.js';
import * as cashbox from './pages/cashbox.js';
import * as expenses from './pages/expenses.js';
import * as profitloss from './pages/profitloss.js';
import * as daily from './pages/daily.js';
import * as personnel from './pages/personnel.js';
import * as backupPage from './pages/backupPage.js';
import * as settingsPage from './pages/settings.js';

/** نقشه مسیرها — ترتیب نمایش در سایدبار */
export const ROUTES = [
  { group: 'عمومی', modules: [dashboard, sales] },
  { group: 'منو و انبار', modules: [menu, ingredients, warehouse, recipes, purchases] },
  { group: 'مالی', modules: [cashbox, expenses, profitloss, daily] },
  { group: 'سیستم', modules: [personnel, backupPage, settingsPage] },
];

const PAGE_MODULES = ROUTES.flatMap((g) => g.modules);
let currentPath = null;
let booted = false;
let deferredInstallPrompt = null;

/* ---------- سایدبار ---------- */

function renderSidebar() {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.innerHTML = ROUTES.map((g) => `
    <div class="nav-group-label">${escapeHtml(g.group)}</div>
    ${g.modules.map((m) => `
      <button class="nav-item" data-route="${m.path}" type="button">
        <span class="nav-icon">${ICONS[m.iconKey] || ICONS.dashboard}</span>
        <span>${escapeHtml(m.title)}</span>
      </button>`).join('')}
  `).join('');

  nav.querySelectorAll('[data-route]').forEach((b) => {
    b.addEventListener('click', () => {
      navigate(b.dataset.route);
      document.getElementById('app')?.classList.remove('sidebar-open');
    });
  });
}

function setActive(path) {
  document.querySelectorAll('.nav-item').forEach((b) => {
    b.classList.toggle('active', b.dataset.route === path);
  });
}

/* ---------- ناوبری ---------- */

export async function navigate(path) {
  const mod = PAGE_MODULES.find((m) => m.path === path) || dashboard;
  if (window.location.hash !== `#/${mod.path}`) {
    window.location.hash = `#/${mod.path}`;
  }
  await renderPage(mod);
}

async function renderPage(mod) {
  currentPath = mod.path;
  setActive(mod.path);
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = mod.title;
  const root = document.getElementById('page');
  if (!root) return;
  root.innerHTML = '<div class="empty-state"><p>در حال بارگذاری…</p></div>';
  try {
    await mod.render(root);
  } catch (e) {
    console.error(e);
    root.innerHTML = `<div class="alert danger">${icon('alert')}<div><b>خطا در نمایش صفحه:</b> ${escapeHtml(e.message || String(e))}</div></div>`;
  }
}

function pathFromHash() {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h || dashboard.path;
}

/* ---------- راه‌اندازی ---------- */

export async function initApp() {
  if (booted) return;
  booted = true;

  // تنظیمات و تم
  const settings = getSettings();
  applyTheme(settings.theme);
  document.querySelector('.brand-title').textContent = settings.restaurantName;
  document.title = `${settings.restaurantName} — نرم‌افزار مدیریت`;

  // پایگاه داده
  try {
    await openDB();
  } catch (e) {
    document.getElementById('page').innerHTML =
      `<div class="alert danger">${icon('alert')}<div><b>خطا در باز کردن پایگاه داده:</b> ${escapeHtml(e.message || '')}<br/>مرورگر خود را به‌روز کنید یا حالت خصوصی را ببندید.</div></div>`;
    return;
  }

  // صندوق و هزینه‌های دوره‌ای
  try {
    await ensureInitialCash();
    if (settings.recurringAuto) {
      const r = await generateRecurring(monthKey(todayJalali()));
      if (r.created.length) toast(`${toFa(r.created.length)} هزینه دوره‌ای ایجاد شد`, 'info');
    }
  } catch (e) {
    console.warn('راه‌اندازی اولیه:', e);
  }

  // نوار بالا — تاریخ امروز
  const dateEl = document.getElementById('topbar-date');
  if (dateEl) dateEl.textContent = `${fmtDateLong(todayJalali())} — ${weekdayOf(todayJalali())}`;

  // سایدبار و ناوبری
  renderSidebar();
  window.addEventListener('hashchange', () => {
    const p = pathFromHash();
    if (p !== currentPath) {
      const mod = PAGE_MODULES.find((m) => m.path === p) || dashboard;
      renderPage(mod);
    }
  });

  // دکمه‌های نوار بالا
  document.getElementById('menu-toggle')?.addEventListener('click', () => {
    document.getElementById('app')?.classList.toggle('sidebar-open');
  });
  document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
    document.getElementById('app')?.classList.remove('sidebar-open');
  });
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const next = getSettings().theme === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    toast(next === 'dark' ? 'حالت تاریک فعال شد' : 'حالت روشن فعال شد', 'info', 1600);
    if (currentPath === 'dashboard' || currentPath === 'profitloss') {
      const mod = PAGE_MODULES.find((m) => m.path === currentPath);
      renderPage(mod);
    }
  });

  // Service Worker (آفلاین)
  registerSW();

  // دکمه نصب PWA
  setupInstallPrompt();

  // راهنمای استفاده
  document.getElementById('btn-guide')?.addEventListener('click', openGuide);

  // یادآوری پشتیبان‌گیری (یک بار در هر نشست)
  remindBackup();

  // مسیر اولیه
  const initial = pathFromHash();
  const mod = PAGE_MODULES.find((m) => m.path === initial) || dashboard;
  await renderPage(mod);
}

/** نصب PWA — نمایش دکمه فقط وقتی مرورگر اجازه نصب بدهد */
function setupInstallPrompt() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('btn-install')?.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    document.getElementById('btn-install')?.classList.add('hidden');
    toast('برنامه با موفقیت روی دستگاه نصب شد', 'success');
  });
  document.getElementById('btn-install')?.addEventListener('click', async () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      try {
        const choice = await deferredInstallPrompt.userChoice;
        if (choice?.outcome === 'accepted') toast('در حال نصب…', 'info');
      } catch { /* noop */ }
      deferredInstallPrompt = null;
      document.getElementById('btn-install')?.classList.add('hidden');
    } else {
      toast('از منوی مرورگر گزینه «Add to Home Screen» یا «نصب برنامه» را بزنید', 'info', 5000);
    }
  });
}

/** یادآوری دوره‌ای پشتیبان‌گیری */
async function remindBackup() {
  try {
    const { getSettings } = await import('./core/settings.js');
    const { count } = await import('./core/db.js');
    const s = getSettings();
    const salesCount = await count('sales');
    if (!salesCount) return; // داده‌ای نیست؛ یادآوری لازم نیست
    const last = s.lastBackupAt ? new Date(s.lastBackupAt).getTime() : 0;
    const stale = !last || Date.now() - last > 7 * 24 * 3600 * 1000;
    if (stale) {
      setTimeout(() => toast(
        last ? 'هفته‌ای یک‌بار پشتیبان بگیرید؛ آخرین پشتیبان مربوط به بیش از ۷ روز پیش است'
             : 'هنوز پشتیبانی نگرفته‌اید؛ از بخش «پشتیبان‌گیری» فایل JSON دانلود کنید',
        'warn', 7000
      ), 2500);
    }
  } catch { /* noop */ }
}

/** راهنمای کاربری درون‌برنامه‌ای */
function openGuide() {
  const sections = [
    ['dashboard', 'داشبورد', 'نمای کلی امروز: فروش، سود، صندوق و هشدارهای انبار.'],
    ['sales', 'ثبت فروش', 'غذا را انتخاب کنید، تعداد و تخفیف و نحوه پرداخت (نقدی/کارت/نسیه) را مشخص و ثبت کنید. مواد اولیه خودکار کسر می‌شود.'],
    ['menu', 'مدیریت منو', 'دسته‌بندی و غذای نامحدود بسازید؛ یا از «منوی پیشنهادی» شروع کنید و ویرایش کنید.'],
    ['ingredients', 'مواد اولیه', 'هر ماده را با واحد پایه و واحدهای تبدیل تعریف کنید؛ حداقل موجودی و تاریخ انقضا بدهید.'],
    ['warehouse', 'مدیریت انبار', 'ورود/خروج دستی، ثبت ضایعات، شمارش واقعی موجودی و گردش مواد.'],
    ['recipes', 'دستور پخت', 'برای هر غذا مواد و مقادیر را ثبت کنید تا بهای تمام‌شده و سود خودکار محاسبه شود.'],
    ['purchases', 'خرید و تأمین‌کنندگان', 'ثبت خرید، ورود کالا با میانگین موزون، بدهی و پرداخت تأمین‌کنندگان.'],
    ['cashbox', 'دخل و صندوق', 'گردش نقدی صندوق: ورودی‌ها و خروجی‌ها با فیلتر تاریخ.'],
    ['expenses', 'هزینه‌ها', 'ثبت هزینه‌ها با دسته دلخواه؛ برای اجاره و حقوق از «قالب دوره‌ای» استفاده کنید تا هر ماه فقط یک بار ثبت شود.'],
    ['profitloss', 'گزارش سود و زیان', 'درآمد، بهای تمام‌شده، ضایعات، هزینه‌ها و سود خالص بازه دلخواه + خروجی اکسل و PDF.'],
    ['daily', 'گزارش روزانه', 'خلاصه کامل یک روز: فروش به تفکیک غذا، پرداخت‌ها، خرید و ضایعات.'],
    ['personnel', 'مدیریت پرسنل', 'پرسنل و حقوق ماهانه؛ پرداخت حقوق هر ماه فقط یک بار پذیرفته می‌شود.'],
    ['backup', 'پشتیبان‌گیری', 'دانلود JSON، بازیابی کامل یا ادغام، خروجی اکسل کامل و بررسی سلامت داده‌ها.'],
    ['settings', 'تنظیمات', 'نام مجموعه، تم روشن/تاریک، موجودی ابتدای صندوق و دسته‌های هزینه.'],
  ];

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert info mb-16">${icon('info')}<div><b>به نرم‌افزار صبحانه‌سرای آفتاب خوش آمدید.</b> همه داده‌ها روی همین دستگاه ذخیره می‌شوند و برای انتقال بین دستگاه‌ها حتماً پشتیبان بگیرید.</div></div>

    <div class="card-title">مسیر پیشنهادی راه‌اندازی (یک‌بار)</div>
    <div class="summary-rows mb-16">
      <div class="s-row"><span class="label"><b>۱.</b> تنظیمات</span><span class="text-sm">نام مجموعه، تم و <b>موجودی ابتدای صندوق</b> را وارد کنید</span></div>
      <div class="s-row"><span class="label"><b>۲.</b> مدیریت منو</span><span class="text-sm">دسته‌ها و غذاها را بسازید یا «منوی پیشنهادی» را بزنید</span></div>
      <div class="s-row"><span class="label"><b>۳.</b> مواد اولیه + رسپی</span><span class="text-sm">مواد را تعریف و برای غذاهای پرتقاضا دستور پخت ثبت کنید</span></div>
      <div class="s-row"><span class="label"><b>۴.</b> خرید</span><span class="text-sm">اولین خرید را ثبت کنید تا کالا وارد انبار و بدهی محاسبه شود</span></div>
      <div class="s-row"><span class="label"><b>۵.</b> ثبت فروش</span><span class="text-sm">هر روز فروش‌ها را ثبت و از گزارش‌ها استفاده کنید</span></div>
    </div>

    <div class="card-title">راهنمای بخش‌ها</div>
    <div class="summary-rows mb-16">
      ${sections.map(([key, title, desc]) => `
        <div class="s-row" style="align-items:flex-start">
          <span class="label" style="white-space:nowrap"><button class="btn btn-ghost btn-sm" data-goto="${key}" type="button" style="padding:0 6px;color:var(--gold-text);font-weight:700">${escapeHtml(title)} ›</button></span>
          <span class="text-sm" style="text-align:left;flex:1">${escapeHtml(desc)}</span>
        </div>`).join('')}
    </div>

    <div class="card-title">نکات کلیدی</div>
    <div class="alert warn mb-8">${icon('alert')}<div><b>پرداخت ترکیبی:</b> در ثبت فروش می‌توانید نقدی، کارت و نسیه را با هم وارد کنید؛ جمع باید با مبلغ کل برابر باشد.</div></div>
    <div class="alert warn mb-8">${icon('alert')}<div><b>نسیه:</b> مبلغ نسیه در «طلب مشتری» می‌ماند و از دکمه «دریافت» در سوابق فروش، مستقیماً وارد صندوق می‌شود.</div></div>
    <div class="alert warn mb-8">${icon('alert')}<div><b>ضایعات و شمارش:</b> از بخش انبار ثبت کنید؛ ارزش ضایعات در سود و زیان لحاظ می‌شود.</div></div>
    <div class="alert success mb-8">${icon('check')}<div><b>آفلاین:</b> پس از یک بار بازدید، برنامه بدون اینترنت هم کار می‌کند و به صفحه اصلی گوشی قابل نصب است.</div></div>
    <div class="alert info">${icon('backup')}<div><b>پشتیبانی:</b> هفته‌ای یک‌بار از بخش «پشتیبان‌گیری» فایل JSON دانلود و نگه‌داری کنید.</div></div>`;

  const modal = openModal({ title: 'راهنمای استفاده', content, size: 'wide' });
  content.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => {
    modal.close();
    navigate(b.dataset.goto);
  }));
}

async function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (!/^https?:$/.test(location.protocol)) return;
  try {
    const reg = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    reg.addEventListener('updatefound', () => {
      const sw = reg.installing;
      sw?.addEventListener('statechange', () => {
        if (sw.state === 'installed' && navigator.serviceWorker.controller) {
          toast('نسخه جدیدی آماده است؛ از تنظیمات می‌توانید بروزرسانی کنید', 'info', 5000);
        }
      });
    });
    // پیام فعال‌سازی فوری نسخه جدید
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.type === 'SKIP_WAITING') window.location.reload();
    });
  } catch (e) {
    console.warn('ثبت Service Worker ناموفق', e);
  }
}

/* ---------- اجرا ---------- */
if (typeof document !== 'undefined' && !globalThis.__AFTAB_TEST__) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }
}
