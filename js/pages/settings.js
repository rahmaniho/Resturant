/* ============================================================
   صفحه تنظیمات — هویت برند، ظاهر، صندوق، سیستم
   ============================================================ */

import { getSettings, saveSettings, resetSettings, applyTheme } from '../core/settings.js';
import { ensureInitialCash, cashBalance } from '../services/cashService.js';
import { getHistory } from '../core/db.js';
import {
  icon, toast, confirmDialog, buildTable, openModal,
  fieldText, fieldNum, fieldSelect,
} from '../ui/components.js';
import { fmtMoney, fmtDate, toFa, escapeHtml, num, todayJalali } from '../core/utils.js';

export const path = 'settings';
export const title = 'تنظیمات';
export const iconKey = 'settings';

let ctx = null;

export async function render(root) {
  ctx = {
    settings: getSettings(),
    balance: await cashBalance(),
    history: await getHistory(300),
  };
  const s = ctx.settings;

  root.innerHTML = `
    <div class="page-enter">
      <div class="section-head"><h2>تنظیمات</h2></div>

      <div class="grid-2">
        <div class="card">
          <div class="card-title">${icon('settings')} هویت و ظاهر</div>
          <div class="form-grid">
            <div class="field">
              <label for="set-name">نام مجموعه</label>
              <input class="input" id="set-name" value="${escapeHtml(s.restaurantName)}" />
            </div>
            <div class="field">
              <label for="set-phone">تلفن (روی فاکتور)</label>
              <input class="input" id="set-phone" dir="ltr" value="${escapeHtml(s.restaurantPhone || '')}" placeholder="021-…" />
            </div>
            <div class="field">
              <label for="set-address">نشانی (روی فاکتور)</label>
              <input class="input" id="set-address" value="${escapeHtml(s.restaurantAddress || '')}" placeholder="استان، شهر، خیابان" />
            </div>
            <div class="field">
              <label for="set-theme">حالت نمایش</label>
              <select class="select" id="set-theme">
                <option value="light" ${s.theme === 'light' ? 'selected' : ''}>روشن</option>
                <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>تاریک</option>
              </select>
            </div>
            <div class="field">
              <label for="set-expiry">هشدار انقضا (روز قبل از تاریخ)</label>
              <input class="input num" id="set-expiry" dir="ltr" value="${toFa(s.expiryAlertDays)}" inputmode="decimal" />
            </div>
            <div class="field">
              <label>&nbsp;</label>
              <label class="checkbox-row"><input type="checkbox" id="set-lowstock" ${s.lowStockAlerts ? 'checked' : ''} /> نمایش هشدار کمبود موجودی</label>
            </div>
          </div>
          <button class="btn btn-primary mt-16" id="save-appearance" type="button">ذخیره تنظیمات</button>
        </div>

        <div class="card">
          <div class="card-title">${icon('wallet')} صندوق</div>
          <div class="form-grid">
            <div class="field">
              <label for="set-cash">موجودی ابتدای صندوق (تومان)</label>
              <input class="input num" id="set-cash" dir="ltr" value="${fmtMoney(s.initialCash)}" inputmode="decimal" />
              <span class="hint">پس از ذخیره، یک سند «سرمایه اولیه» در صندوق ثبت می‌شود</span>
            </div>
            <div class="field">
              <label>مانده فعلی صندوق</label>
              <input class="input" value="${fmtMoney(ctx.balance)} تومان" disabled />
            </div>
          </div>
          <div class="flex mt-16">
            <button class="btn btn-primary" id="save-cash" type="button">ذخیره و ثبت</button>
            <label class="checkbox-row"><input type="checkbox" id="set-recurring" ${s.recurringAuto ? 'checked' : ''} /> ایجاد خودکار هزینه‌های دوره‌ای هنگام باز شدن برنامه</label>
          </div>
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">${icon('expense')} دسته‌های هزینه
          <div class="spacer"></div>
          <button class="btn btn-outline btn-sm" id="add-exp-cat" type="button">${icon('plus')} دسته</button>
        </div>
        <div class="flex flex-wrap" style="gap:8px" id="exp-cats">
          ${(s.expenseCategories || []).map((c) => `<span class="badge" style="padding:6px 12px">${escapeHtml(c)}</span>`).join('') || '<span class="text-muted text-sm">بدون دسته</span>'}
        </div>
      </div>

      <div class="card mt-16">
        <div class="card-title">${icon('refresh')} سیستم</div>
        <div class="flex flex-wrap">
          <button class="btn btn-outline" id="btn-update-sw" type="button">${icon('refresh')} بروزرسانی برنامه (Service Worker)</button>
          <button class="btn btn-outline" id="btn-history" type="button">${icon('eye')} تاریخچه تغییرات (${toFa(ctx.history.length)})</button>
          <button class="btn btn-danger-outline btn-outline" id="btn-reset-settings" type="button">بازنشانی تنظیمات</button>
        </div>
        <div class="alert info mt-16">${icon('info')}<div>
          ذخیره‌سازی داده‌ها: <b>IndexedDB</b> • تنظیمات: <b>LocalStorage</b> • اجرا: وب‌اپلیکیشن استاتیک (قابل انتشار روی GitHub Pages)
        </div></div>
      </div>

      <div class="card mt-16" id="history-card">
        <div class="card-title">${icon('eye')} تاریخچه تغییرات اخیر</div>
        <div id="history-box"><div class="text-muted text-sm">برای نمایش، دکمه «تاریخچه تغییرات» را بزنید</div></div>
      </div>
    </div>`;

  root.querySelector('#save-appearance').addEventListener('click', () => {
    const theme = root.querySelector('#set-theme').value;
    saveSettings({
      restaurantName: root.querySelector('#set-name').value.trim() || 'صبحانه‌سرای آفتاب',
      restaurantPhone: root.querySelector('#set-phone').value.trim(),
      restaurantAddress: root.querySelector('#set-address').value.trim(),
      expiryAlertDays: Math.max(0, num(root.querySelector('#set-expiry').value, 7)),
      lowStockAlerts: root.querySelector('#set-lowstock').checked,
    });
    applyTheme(theme);
    document.querySelector('.brand-title').textContent = getSettings().restaurantName;
    document.title = `${getSettings().restaurantName} — نرم‌افزار مدیریت`;
    toast('تنظیمات ذخیره شد');
  });

  root.querySelector('#save-cash').addEventListener('click', async () => {
    try {
      const amount = Math.round(num(root.querySelector('#set-cash').value, 0));
      if (amount < 0) throw new Error('مبلغ نمی‌تواند منفی باشد');
      saveSettings({ initialCash: amount, recurringAuto: root.querySelector('#set-recurring').checked });
      const entry = await ensureInitialCash();
      toast(entry ? 'موجودی ابتدای صندوق ثبت شد' : 'تنظیمات صندوق ذخیره شد');
      await render(root);
    } catch (e) { toast(e.message, 'error'); }
  });

  root.querySelector('#add-exp-cat').addEventListener('click', () => {
    const content = document.createElement('div');
    content.innerHTML = fieldText({ id: 'ec-name', label: 'نام دسته هزینه' });
    const modal = openModal({
      title: 'دسته هزینه جدید', content,
      footer: `<button class="btn btn-primary" data-save type="button">افزودن</button><button class="btn btn-ghost" data-cancel type="button">انصراف</button>`,
    });
    modal.foot.querySelector('[data-cancel]').addEventListener('click', modal.close);
    modal.foot.querySelector('[data-save]').addEventListener('click', () => {
      const name = content.querySelector('#ec-name').value.trim();
      if (!name) return;
      const list = getSettings().expenseCategories || [];
      if (!list.includes(name)) saveSettings({ expenseCategories: [...list, name] });
      modal.close();
      toast('افزوده شد');
      render(root);
    });
  });

  root.querySelector('#btn-update-sw').addEventListener('click', async () => {
    try {
      if (!('serviceWorker' in navigator)) { toast('Service Worker در این مرورگر پشتیبانی نمی‌شود', 'warn'); return; }
      const reg = await navigator.serviceWorker.getRegistration();
      if (!reg) { toast('Service Worker هنوز ثبت نشده؛ صفحه را یک بار باز و بسته کنید', 'warn'); return; }
      await reg.update();
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        toast('نسخه جدید فعال شد؛ صفحه تازه می‌شود', 'success');
        setTimeout(() => window.location.reload(), 700);
      } else {
        toast('برنامه در آخرین نسخه است', 'info');
      }
    } catch (e) { toast(e.message, 'error'); }
  });

  root.querySelector('#btn-history').addEventListener('click', () => {
    const box = root.querySelector('#history-box');
    if (!ctx.history.length) { box.innerHTML = '<div class="text-muted text-sm">هنوز تغییری ثبت نشده</div>'; return; }
    const table = buildTable({
      columns: [
        { key: 'atText', label: 'زمان' },
        { key: 'entityLabel', label: 'بخش' },
        { key: 'actionLabel', label: 'عملیات' },
        { key: 'note', label: 'شرح' },
      ],
      rows: ctx.history.map((h) => ({
        ...h,
        atText: new Date(h.ts).toLocaleString('fa-IR'),
        entityLabel: entityLabel(h.entity),
        actionLabel: actionLabel(h.action),
        note: h.note || (h.after?.name || h.before?.name || h.entityId || ''),
      })),
      searchKeys: ['entityLabel', 'actionLabel', 'note'],
      excel: { filename: `history-${todayJalali()}`, sheetName: 'تاریخچه' },
    });
    box.innerHTML = '';
    box.appendChild(table);
  });

  root.querySelector('#btn-reset-settings').addEventListener('click', async () => {
    const ok = await confirmDialog('تنظیمات به حالت پیش‌فرض بازنشانی شود؟ داده‌ها دست‌نخورده می‌مانند.', { danger: true, confirmText: 'بازنشانی' });
    if (!ok) return;
    resetSettings();
    applyTheme('light');
    toast('تنظیمات بازنشانی شد');
    setTimeout(() => window.location.reload(), 600);
  });
}

function entityLabel(e) {
  const map = {
    categories: 'دسته‌بندی', foods: 'غذا', ingredients: 'ماده اولیه',
    suppliers: 'تأمین‌کننده', purchases: 'خرید', recipes: 'رسپی',
    sales: 'فروش', movements: 'گردش انبار', expenses: 'هزینه',
    expenseTemplates: 'قالب هزینه', cashEntries: 'صندوق', counts: 'شمارش',
    staff: 'پرسنل', history: 'تاریخچه', backup: 'پشتیبان', menu: 'منو',
  };
  return map[e] || e;
}

function actionLabel(a) {
  const map = { create: 'ایجاد', update: 'ویرایش', delete: 'حذف', import: 'بازیابی', system: 'سیستم' };
  return map[a] || a;
}
