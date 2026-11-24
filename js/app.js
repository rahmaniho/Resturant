/* ============================================================
   صبحانه‌سرای آفتاب — نقطه ورود برنامه (روتر و چیدمان)
   ============================================================ */

import { getSettings, applyTheme } from './core/settings.js';
import { openDB } from './core/db.js';
import { ensureInitialCash } from './services/cashService.js';
import { generateRecurring } from './services/expenseService.js';
import { ICONS, icon, toast, confirmDialog } from './ui/components.js';
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

  // مسیر اولیه
  const initial = pathFromHash();
  const mod = PAGE_MODULES.find((m) => m.path === initial) || dashboard;
  await renderPage(mod);
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
