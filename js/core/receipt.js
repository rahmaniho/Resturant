/* ============================================================
   فاکتور/رسید مشتری — ساخت المان، چاپ و خروجی PDF
   ============================================================ */

import { getSettings } from './settings.js';
import {
  fmtMoney, fmtDateLong, weekdayOf, toFa, num, escapeHtml,
} from './utils.js';

/** ساخت رسید/فاکتور مشتری به‌صورت PDF */
export async function exportReceipt(sale) {
  const wrap = buildReceiptElement(sale);
  document.body.appendChild(wrap);
  try {
    const { exportElementPdf } = await import('./exporters.js');
    await exportElementPdf(wrap, `factor-${sale.date}-${sale.id.slice(-6)}.pdf`);
  } finally {
    wrap.remove();
  }
}

/**
 * چاپ فاکتور — المان فاکتور فقط هنگام چاپ دیده می‌شود (CSS @media print).
 * پس از بازگشت از پنجره چاپ، المان پاک می‌شود.
 */
export function printReceipt(sale) {
  const wrap = buildReceiptElement(sale);
  wrap.id = 'print-root';
  wrap.style.position = 'static';
  wrap.style.right = 'auto';
  wrap.style.padding = '0';
  wrap.style.width = '100%';
  wrap.style.background = 'transparent';
  document.body.appendChild(wrap);
  try {
    if (typeof window.print === 'function') window.print();
  } finally {
    wrap.remove();
  }
}

/**
 * ساخت المان فاکتور رسمی (برای PDF، چاپ و تست).
 * لوگوی مجموعه (از تنظیمات یا پیش‌فرض) + هویت کامل + جدول اقلام + امضا.
 */
export function buildReceiptElement(sale) {
  const s = getSettings();
  const brand = s.restaurantName || 'صبحانه‌سرای آفتاب';
  const logo = s.restaurantLogo || './icons/icon-192.png';
  const line = 'border:1px solid #d9d2c2;border-collapse:collapse;width:100%';
  const cell = 'padding:6px 8px;font-size:12.5px';
  const wrap = document.createElement('div');
  wrap.className = 'export-sheet';
  wrap.setAttribute('data-receipt', sale.id);
  wrap.style.cssText = 'position:fixed;right:-10000px;top:0;width:480px;background:#fff;padding:28px 26px;font-family:Vazirmatn,Tahoma,sans-serif;color:#14231d';
  wrap.innerHTML = `
    <div style="text-align:center;border-bottom:3px double #0f3d2e;padding-bottom:14px;margin-bottom:12px">
      <img src="${escapeHtml(logo)}" alt="" width="56" height="56"
           style="border-radius:14px;box-shadow:0 2px 8px rgba(15,61,46,.25);margin-bottom:6px;object-fit:cover;background:#fff" />
      <div style="font-size:21px;font-weight:800;color:#0f3d2e;letter-spacing:-.2px">${escapeHtml(brand)}</div>
      <div style="display:inline-block;margin-top:6px;padding:3px 14px;background:#0f3d2e;color:#f2d98c;border-radius:999px;font-size:12px;font-weight:700">فاکتور فروش رسمی</div>
      ${s.restaurantPhone ? `<div style="font-size:11.5px;color:#555;margin-top:8px" dir="ltr">تلفن: ${escapeHtml(s.restaurantPhone)}</div>` : ''}
      ${s.restaurantAddress ? `<div style="font-size:11.5px;color:#555;margin-top:2px">${escapeHtml(s.restaurantAddress)}</div>` : ''}
    </div>

    <table style="${line};margin-bottom:12px">
      <tbody>
        <tr>
          <td style="${cell};background:#f7f4ec;width:33%"><b>شماره فاکتور</b></td>
          <td style="${cell}" dir="ltr">${escapeHtml(sale.id.slice(-8))}</td>
          <td style="${cell};background:#f7f4ec;width:26%"><b>تاریخ صدور</b></td>
          <td style="${cell}">${fmtDateLong(sale.date)} (${weekdayOf(sale.date)})</td>
        </tr>
        <tr>
          <td style="${cell};background:#f7f4ec"><b>ساعت</b></td>
          <td style="${cell}" dir="ltr">${toFa(sale.time || '')}</td>
          <td style="${cell};background:#f7f4ec"><b>مشتری</b></td>
          <td style="${cell}">${sale.customer?.name ? escapeHtml(sale.customer.name) : '—'}${sale.customer?.phone ? `<br/><span dir="ltr" style="font-size:11.5px;color:#555">${escapeHtml(sale.customer.phone)}</span>` : ''}</td>
        </tr>
      </tbody>
    </table>

    <table style="${line}">
      <thead>
        <tr style="background:#0f3d2e;color:#fff">
          <th style="${cell};text-align:center;width:34px">ردیف</th>
          <th style="${cell};text-align:right">شرح کالا</th>
          <th style="${cell};text-align:center;width:56px">تعداد</th>
          <th style="${cell};text-align:left;width:96px">مبلغ</th>
        </tr>
      </thead>
      <tbody>
        ${sale.items.map((i, idx) => `
          <tr style="border-bottom:1px solid #eee">
            <td style="${cell};text-align:center;color:#777">${toFa(idx + 1)}</td>
            <td style="${cell}">${escapeHtml(i.foodName)}</td>
            <td style="${cell};text-align:center">${toFa(i.qty)}</td>
            <td style="${cell};text-align:left" dir="ltr">${fmtMoney(i.total)}</td>
          </tr>`).join('')}
      </tbody>
    </table>

    <div style="margin-top:10px;font-size:13px">
      <div style="display:flex;justify-content:space-between;padding:4px 2px"><span>جمع کل</span><span dir="ltr">${fmtMoney(sale.subtotal)} تومان</span></div>
      ${num(sale.discount, 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 2px;color:#b3261e"><span>تخفیف</span><span dir="ltr">−${fmtMoney(sale.discount)} تومان</span></div>` : ''}
      <div style="display:flex;justify-content:space-between;padding:9px 10px;background:#0f3d2e;color:#fff;border-radius:8px;margin-top:6px;font-weight:800;font-size:15.5px">
        <span>مبلغ قابل پرداخت</span><span dir="ltr">${fmtMoney(sale.total)} تومان</span>
      </div>
    </div>

    <div style="margin-top:10px;font-size:12.5px;color:#333;border:1px dashed #ccc;border-radius:8px;padding:8px 10px">
      <div style="font-weight:700;margin-bottom:4px">شیوه پرداخت</div>
      ${num(sale.payments.cash, 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>نقدی</span><span dir="ltr">${fmtMoney(sale.payments.cash)} تومان</span></div>` : ''}
      ${num(sale.payments.card, 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>کارت‌خوان</span><span dir="ltr">${fmtMoney(sale.payments.card)} تومان</span></div>` : ''}
      ${num(sale.payments.credit, 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:2px 0"><span>نسیه</span><span dir="ltr">${fmtMoney(sale.payments.credit)} تومان</span></div>` : ''}
      ${num(sale.payments.cash, 0) + num(sale.payments.card, 0) + num(sale.payments.credit, 0) === 0 ? '<div style="color:#999">—</div>' : ''}
      ${num(sale.creditRemaining, 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0 0;margin-top:4px;border-top:1px solid #eee;color:#b3261e"><span><b>مانده طلب مشتری</b></span><span dir="ltr"><b>${fmtMoney(sale.creditRemaining)} تومان</b></span></div>` : ''}
    </div>

    <table style="${line};margin-top:16px;border:none">
      <tbody>
        <tr>
          <td style="${cell};border:none;border-top:1px solid #999;text-align:center;width:45%;padding-top:6px;font-size:11.5px;color:#555">امضای صندوقدار</td>
          <td style="${cell};border:none;width:10%"></td>
          <td style="${cell};border:none;border-top:1px solid #999;text-align:center;padding-top:6px;font-size:11.5px;color:#555">امضای مشتری</td>
        </tr>
      </tbody>
    </table>

    <div style="text-align:center;margin-top:14px;font-size:11.5px;color:#666;border-top:1px solid #eee;padding-top:10px">
      از خرید شما سپاسگزاریم ✿<br/>
      <span dir="ltr" style="font-size:10.5px;color:#999">سند ${escapeHtml(sale.id)} — ${escapeHtml(brand)}</span>
    </div>`;
  return wrap;
}
