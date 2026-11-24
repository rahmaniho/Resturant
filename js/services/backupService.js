/* ============================================================
   سرویس پشتیبان‌گیری — JSON، بازیابی، خروجی اکسل کامل
   ============================================================ */

import * as db from '../core/db.js';
import { STORE_NAMES } from '../core/db.js';
import { getSettings, saveSettings } from '../core/settings.js';
import { downloadText, todayJalali } from '../core/utils.js';

export const BACKUP_VERSION = 1;

/** ساخت شیء پشتیبان کامل */
export async function buildBackup() {
  const data = {};
  for (const s of STORE_NAMES) data[s] = await db.getAll(s);
  return {
    app: 'aftab-breakfast',
    name: getSettings().restaurantName,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    exportedDate: todayJalali(),
    settings: getSettings(),
    data,
  };
}

export async function exportJSON() {
  const backup = await buildBackup();
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  downloadText(JSON.stringify(backup, null, 2), `aftab-backup-${stamp}.json`);
  saveSettings({ lastBackupAt: new Date().toISOString() });
  await db.logHistory({ entity: 'backup', entityId: 'export', action: 'create', note: 'خروجی JSON' });
  return backup;
}

function validateBackup(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('فایل پشتیبان معتبر نیست');
  if (obj.app !== 'aftab-breakfast') throw new Error('این فایل پشتیبان این برنامه نیست');
  if (!obj.data || typeof obj.data !== 'object') throw new Error('بخش data در فایل یافت نشد');
  for (const s of STORE_NAMES) {
    if (obj.data[s] !== undefined && !Array.isArray(obj.data[s])) {
      throw new Error(`بخش ${s} نامعتبر است`);
    }
  }
  return true;
}

/**
 * بازیابی از فایل پشتیبان
 * @param {object} obj محتوای JSON
 * @param {'replace'|'merge'} mode جایگزینی کامل یا ادغام
 */
export async function restoreBackup(obj, mode = 'replace') {
  validateBackup(obj);
  const beforeCounts = {};
  for (const s of STORE_NAMES) beforeCounts[s] = await db.count(s);

  if (mode === 'replace') {
    await db.clearAll();
    for (const s of STORE_NAMES) {
      const rows = obj.data[s] || [];
      if (rows.length) await db.putMany(s, rows);
    }
  } else {
    for (const s of STORE_NAMES) {
      const rows = obj.data[s] || [];
      if (rows.length) await db.putMany(s, rows);
    }
  }

  if (obj.settings) {
    const cur = getSettings();
    saveSettings({ ...obj.settings, theme: cur.theme }); // تم دستگاه حفظ می‌شود
  }

  const afterCounts = {};
  for (const s of STORE_NAMES) afterCounts[s] = await db.count(s);
  await db.logHistory({
    entity: 'backup', entityId: 'restore', action: 'import',
    note: `${mode === 'replace' ? 'بازیابی کامل' : 'ادغام'} از نسخه ${obj.exportedDate || '—'}`,
    before: beforeCounts, after: afterCounts,
  });
  return { beforeCounts, afterCounts };
}

/** خروجی اکسل چندبرگه از همه داده‌ها */
export async function exportExcelAll() {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('کتابخانه اکسل بارگذاری نشده است');
  const wb = XLSX.utils.book_new();
  const backup = await buildBackup();
  for (const [name, rows] of Object.entries(backup.data)) {
    const flat = rows.map(flatten);
    const ws = flat.length
      ? XLSX.utils.json_to_sheet(flat)
      : XLSX.utils.aoa_to_sheet([['بدون داده']]);
    XLSX.utils.book_append_sheet(wb, ws, sheetTitle(name));
  }
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `aftab-data-${stamp}.xlsx`);
  await db.logHistory({ entity: 'backup', entityId: 'excel', action: 'create', note: 'خروجی اکسل کامل' });
}

export function sheetTitle(name) {
  const map = {
    categories: 'دسته‌بندی‌ها', foods: 'غذاها', ingredients: 'مواد اولیه',
    suppliers: 'تأمین‌کنندگان', purchases: 'خریدها', recipes: 'رسپی‌ها',
    sales: 'فروش‌ها', movements: 'گردش انبار', expenses: 'هزینه‌ها',
    expenseTemplates: 'قالب هزینه', cashEntries: 'صندوق', counts: 'شمارش',
    staff: 'پرسنل', history: 'تاریخچه',
  };
  return map[name] || name;
}

/** ساده‌سازی رکورد برای اکسل (باز کردن آرایه‌ها) */
export function flatten(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v == null) { out[k] = ''; continue; }
    if (Array.isArray(v)) out[k] = JSON.stringify(v, null, 0);
    else if (typeof v === 'object') out[k] = JSON.stringify(v, null, 0);
    else out[k] = v;
  }
  return out;
}

/** برآورد فضای مصرفی مرورگر */
export async function storageEstimate() {
  if (navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    return { usage: est.usage || 0, quota: est.quota || 0 };
  }
  return { usage: 0, quota: 0 };
}

/** پاک‌سازی کامل داده‌ها (با ثبت در تاریخچه) */
export async function wipeAllData() {
  const backup = await buildBackup();
  await db.clearAll();
  await db.logHistory({
    entity: 'backup', entityId: 'wipe', action: 'delete',
    note: 'پاک‌سازی کامل داده‌ها',
    before: Object.fromEntries(Object.entries(backup.data).map(([k, v]) => [k, v.length])),
  });
  return true;
}
