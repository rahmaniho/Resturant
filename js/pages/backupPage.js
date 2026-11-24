/* ============================================================
   صفحه پشتیبان‌گیری — JSON، بازیابی، اکسل، پاک‌سازی
   ============================================================ */

import {
  exportJSON, restoreBackup, exportExcelAll, storageEstimate, wipeAllData, BACKUP_VERSION,
} from '../services/backupService.js';
import { STORE_NAMES } from '../core/db.js';
import * as db from '../core/db.js';
import { getSettings } from '../core/settings.js';
import {
  icon, toast, confirmDialog, openModal, emptyState,
} from '../ui/components.js';
import { fmtDate, fmtMoney, toFa, readFileAsText, escapeHtml, todayJalali } from '../core/utils.js';

export const path = 'backup';
export const title = 'پشتیبان‌گیری';
export const iconKey = 'backup';

let counts = {};
let est = { usage: 0, quota: 0 };

export async function render(root) {
  counts = {};
  for (const s of STORE_NAMES) counts[s] = await db.count(s);
  est = await storageEstimate();

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const lastBackup = getSettings().lastBackupAt;

  const storeCards = Object.entries(counts).map(([k, v]) => `
    <div class="kpi" style="padding:12px 14px">
      <div class="kpi-label">${storeLabel(k)}</div>
      <div class="kpi-value" style="font-size:18px">${toFa(v)}<span class="unit">رکورد</span></div>
    </div>`).join('');

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head">
        <h2>پشتیبان‌گیری و بازیابی</h2>
        <div class="spacer"></div>
        <span class="badge gold">نسخه فرمت ${toFa(BACKUP_VERSION)}</span>
      </div>

      <div class="kpi-grid">
        <div class="kpi gold"><div class="kpi-label">${icon('box')} کل رکوردها</div><div class="kpi-value">${toFa(total)}</div><div class="kpi-sub">${lastBackup ? `آخرین پشتیبان: ${fmtDate(String(lastBackup).slice(0, 10))}` : 'پشتیبانی گرفته نشده'}</div></div>
        <div class="kpi"><div class="kpi-label">${icon('chart')} فضای مصرفی مرورگر</div><div class="kpi-value">${toFa((est.usage / 1024 / 1024).toFixed(2))}<span class="unit">مگابایت</span></div><div class="kpi-sub">سهمیه: ${toFa((est.quota / 1024 / 1024 / 1024).toFixed(1))} گیگابایت</div></div>
        <div class="kpi"><div class="kpi-label">${icon('calendar')} وضعیت ذخیره‌سازی</div><div class="kpi-value" style="font-size:16px">IndexedDB</div><div class="kpi-sub">اطلاعات پس از بستن مرورگر می‌ماند</div></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">${icon('backup')} پشتیبان JSON (پیشنهادی)</div>
          <p class="text-sm text-muted mb-16">یک فایل شامل همه داده‌ها و تنظیمات. برای انتقال بین دستگاه‌ها یا نگهداری امن، دانلود کنید. بازیابی کامل یا ادغام با داده‌های فعلی ممکن است.</p>
          <div class="flex flex-wrap">
            <button class="btn btn-primary" id="btn-export" type="button">${icon('backup')} دانلود پشتیبان</button>
            <label class="btn btn-outline" style="cursor:pointer">
              ${icon('refresh')} بازیابی از فایل
              <input type="file" id="file-import" accept="application/json,.json" hidden />
            </label>
          </div>
        </div>

        <div class="card">
          <div class="card-title">${icon('excel')} خروجی اکسل کامل</div>
          <p class="text-sm text-muted mb-16">هر بخش از داده‌ها در یک برگه جداگانه (فروش، انبار، هزینه‌ها، تاریخچه و…) برای بررسی در Excel.</p>
          <button class="btn btn-gold" id="btn-excel" type="button">${icon('excel')} دانلود فایل اکسل</button>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">${icon('check')} سلامت داده‌ها
          <div class="spacer"></div>
          <button class="btn btn-primary btn-sm" id="btn-integrity" type="button">${icon('refresh')} شروع بررسی</button>
        </div>
        <p class="text-sm text-muted mb-8">راستی‌آزمایی خودکار: تطابق موجودی انبار با گردش اسناد، جمع‌های فروش و پرداخت، طلب نسیه، یکتایی هزینه‌ها و صحت ارجاع‌ها — با امکان اصلاح خودکار موارد قابل ترمیم.</p>
        <div id="integrity-result"></div>
      </div>

      <div class="card mt-16">
        <div class="card-title">${icon('box')} جزئیات داده‌ها</div>
        <div class="grid-4">${storeCards}</div>
      </div>

      <div class="card mt-16" style="border-color:var(--danger)">
        <div class="card-title text-danger">${icon('alert')} منطقه خطر</div>
        <p class="text-sm text-muted mb-16">پاک‌سازی کامل همه داده‌ها را از بین می‌برد. حتماً ابتدا پشتیبان بگیرید.</p>
        <button class="btn btn-danger" id="btn-wipe" type="button">${icon('trash')} پاک‌سازی کامل داده‌ها</button>
      </div>
    </div>`;

  root.querySelector('#btn-export').addEventListener('click', async () => {
    try {
      await exportJSON();
      toast('پشتیبان دانلود شد');
      await render(root);
    } catch (e) { toast(e.message, 'error'); }
  });

  root.querySelector('#btn-excel').addEventListener('click', async () => {
    try {
      toast('در حال ساخت اکسل…', 'info', 2500);
      await exportExcelAll();
      toast('فایل اکسل دانلود شد');
    } catch (e) { toast(e.message, 'error'); }
  });

  root.querySelector('#file-import').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const obj = JSON.parse(text);
      showRestoreModal(obj);
    } catch (err) {
      toast('فایل JSON معتبر نیست: ' + err.message, 'error', 5000);
    }
    e.target.value = '';
  });

  root.querySelector('#btn-integrity').addEventListener('click', async () => {
    const btn = root.querySelector('#btn-integrity');
    const out = root.querySelector('#integrity-result');
    btn.disabled = true;
    out.innerHTML = '<div class="text-muted text-sm">در حال بررسی…</div>';
    try {
      const { runIntegrityCheck, fixIssues } = await import('../services/integrityService.js');
      const result = await runIntegrityCheck();
      renderIntegrity(out, result, async () => {
        const fixed = await fixIssues(result.issues);
        toast(`${toFa(fixed)} مورد اصلاح شد`, 'success');
        const again = await runIntegrityCheck();
        renderIntegrity(out, again, null);
      });
    } catch (e) {
      out.innerHTML = `<div class="alert danger">${icon('alert')}<div>${escapeHtml(e.message || String(e))}</div></div>`;
    } finally {
      btn.disabled = false;
    }
  });

  root.querySelector('#btn-wipe').addEventListener('click', async () => {
    const ok1 = await confirmDialog(
      'همه داده‌ها (فروش، انبار، منو، هزینه‌ها و…) برای همیشه پاک می‌شوند. ادامه می‌دهید؟',
      { title: 'پاک‌سازی کامل', danger: true, confirmText: 'ادامه' }
    );
    if (!ok1) return;
    const ok2 = await confirmDialog('آیا واقعاً مطمئنید؟ این عملیات بازگشت‌پذیر نیست مگر پشتیبان داشته باشید.', { danger: true, confirmText: 'بله، پاک کن' });
    if (!ok2) return;
    try {
      await wipeAllData();
      toast('همه داده‌ها پاک شد');
      await render(root);
    } catch (e) { toast(e.message, 'error'); }
  });
}

function showRestoreModal(obj) {
  const rows = Object.entries(obj.data || {})
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([k, v]) => `<tr><td>${escapeHtml(storeLabel(k))}</td><td class="num">${toFa(v.length)}</td></tr>`).join('');

  const content = document.createElement('div');
  content.innerHTML = `
    <div class="alert info mb-16">${icon('info')}<div>
      فایل متعلق به <b>${escapeHtml(obj.name || '—')}</b> و در تاریخ <b>${escapeHtml(obj.exportedDate || '—')}</b> ساخته شده.
    </div></div>
    <div class="table-wrap mb-16">
      <table class="data" style="min-width:0">
        <thead><tr><th>بخش</th><th class="num">تعداد رکورد</th></tr></thead>
        <tbody>${rows || '<tr><td class="table-empty" colspan="2">داده‌ای در فایل نیست</td></tr>'}</tbody>
      </table>
    </div>
    <div class="field">
      <label>روش بازیابی</label>
      <select class="select" id="restore-mode">
        <option value="replace">جایگزینی کامل (داده‌های فعلی پاک می‌شوند)</option>
        <option value="merge">ادغام (رکوردهای هم‌شناسه بازنویسی می‌شوند)</option>
      </select>
    </div>
    <div class="alert warn mt-16">${icon('alert')}<div>در حالت جایگزینی، تمام داده‌های فعلی حذف می‌شوند. توصیه: قبل از بازیابی، از وضعیت فعلی پشتیبان بگیرید.</div></div>`;

  const modal = openModal({
    title: 'بازیابی از پشتیبان',
    content, size: 'wide',
    footer: `<button class="btn btn-danger" data-restore type="button">بازیابی</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
  });
  modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
  modal.foot.querySelector('[data-restore]').addEventListener('click', async () => {
    const mode = content.querySelector('#restore-mode').value;
    modal.close();
    try {
      await restoreBackup(obj, mode);
      toast('داده‌ها بازیابی شد؛ صفحه تازه می‌شود', 'success', 4000);
      setTimeout(() => window.location.reload(), 900);
    } catch (e) { toast(e.message, 'error', 5000); }
  });
}

/** نمایش نتیجه بررسی سلامت */
function renderIntegrity(out, result, onFix) {
  const s = result.stats;
  const summary = `
    <div class="flex flex-wrap gap-8 text-sm text-muted mb-8">
      <span class="badge">${toFa(s.ingredients)} ماده</span>
      <span class="badge">${toFa(s.movements)} گردش</span>
      <span class="badge">${toFa(s.sales)} فروش</span>
      <span class="badge">${toFa(s.cashEntries)} سند صندوق</span>
      <span class="badge">${toFa(s.expenses)} هزینه</span>
      <span class="badge">${toFa(s.recipes)} رسپی</span>
    </div>`;

  if (result.ok) {
    out.innerHTML = `
      ${summary}
      <div class="alert success">${icon('check')}<div><b>همه بررسی‌ها موفق بود.</b> داده‌ها از نظر انباشت انبار، مالی و ارجاع‌ها سالم هستند.</div></div>`;
    return;
  }

  const fixableCount = result.issues.filter((i) => i.fixable).length;
  out.innerHTML = `
    ${summary}
    <div class="alert warn mb-8">${icon('alert')}<div><b>${toFa(result.issues.length)} مورد</b> پیدا شد${fixableCount ? ` که ${toFa(fixableCount)} مورد آن قابل اصلاح خودکار است` : ''}.</div></div>
    <div class="table-wrap">
      <table class="data" style="min-width:0">
        <thead><tr><th>شدت</th><th>بخش</th><th>شرح</th></tr></thead>
        <tbody>
          ${result.issues.map((i) => `
            <tr>
              <td>${i.severity === 'error' ? '<span class="badge red">بحرانی</span>' : '<span class="badge warn">هشدار</span>'}</td>
              <td>${escapeHtml(categoryLabel(i.category))}</td>
              <td>${escapeHtml(i.label)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
    </div>
    ${fixableCount && onFix ? `<button class="btn btn-gold mt-16" id="btn-fix-issues" type="button">${icon('refresh')} اصلاح ${toFa(fixableCount)} مورد قابل ترمیم</button>` : ''}
  `;
  out.querySelector('#btn-fix-issues')?.addEventListener('click', onFix);
}

function categoryLabel(c) {
  const map = { stock: 'موجودی انبار', sale: 'فروش', cash: 'صندوق', expense: 'هزینه', ref: 'ارجاع‌ها', dup: 'تکراری' };
  return map[c] || c;
}

function storeLabel(k) {
  const map = {
    categories: 'دسته‌بندی', foods: 'غذاها', ingredients: 'مواد اولیه',
    suppliers: 'تأمین‌کنندگان', purchases: 'خریدها', recipes: 'رسپی‌ها',
    sales: 'فروش‌ها', movements: 'گردش انبار', expenses: 'هزینه‌ها',
    expenseTemplates: 'قالب هزینه', cashEntries: 'صندوق', counts: 'شمارش',
    staff: 'پرسنل', history: 'تاریخچه',
  };
  return map[k] || k;
}
