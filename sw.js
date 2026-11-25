/* ============================================================
   Service Worker — اجرای آفلاین پس از اولین بارگذاری
   ============================================================ */

const CACHE = 'aftab-cache-v1';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './css/theme.css',
  './css/base.css',
  './css/components.css',
  './js/app.js',
  './js/core/utils.js',
  './js/core/jalaali.js',
  './js/core/db.js',
  './js/core/settings.js',
  './js/core/money.js',
  './js/core/exporters.js',
  './js/core/receipt.js',
  './js/services/menuService.js',
  './js/services/inventoryService.js',
  './js/services/recipeService.js',
  './js/services/purchaseService.js',
  './js/services/salesService.js',
  './js/services/cashService.js',
  './js/services/expenseService.js',
  './js/services/personnelService.js',
  './js/services/reportService.js',
  './js/services/backupService.js',
  './js/services/integrityService.js',
  './js/ui/components.js',
  './js/pages/dashboard.js',
  './js/pages/sales.js',
  './js/pages/invoices.js',
  './js/pages/customers.js',
  './js/pages/menu.js',
  './js/pages/ingredients.js',
  './js/pages/warehouse.js',
  './js/pages/recipes.js',
  './js/pages/purchases.js',
  './js/pages/cashbox.js',
  './js/pages/expenses.js',
  './js/pages/profitloss.js',
  './js/pages/daily.js',
  './js/pages/personnel.js',
  './js/pages/backupPage.js',
  './js/pages/settings.js',
  './vendor/chart.umd.js',
  './vendor/xlsx.full.min.js',
  './vendor/jspdf.umd.min.js',
  './vendor/html2canvas.min.js',
  './fonts/Vazirmatn[wght].woff2',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch((err) => console.warn('precache failed (some assets skipped):', err))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // ناوبری: شبکه اول، در نبود شبکه کش محلی
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // بقیه درخواست‌ها: کش اول، سپس شبکه (و به‌روزرسانی پس‌زمینه)
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
