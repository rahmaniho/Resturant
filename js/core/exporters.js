/* ============================================================
   خروجی‌ها — اکسل (SheetJS) و PDF (jsPDF + html2canvas)
   ============================================================ */

import { downloadBlob, escapeHtml, toFa } from './utils.js';

/**
 * خروجی اکسل از یک جدول
 * @param {string} filename
 * @param {string} sheetName
 * @param {Array<{key:string,label:string}>} columns
 * @param {Array<object>} rows
 */
export function exportTableExcel(filename, sheetName, columns, rows) {
  const XLSX = window.XLSX;
  if (!XLSX) throw new Error('کتابخانه اکسل بارگذاری نشده است');
  const data = rows.map((r) => {
    const o = {};
    for (const c of columns) o[c.label] = r[c.key] == null ? '' : r[c.key];
    return o;
  });
  const ws = data.length
    ? XLSX.utils.json_to_sheet(data)
    : XLSX.utils.aoa_to_sheet(columns.map((c) => [c.label]) .concat([columns.map(() => '')]));
  ws['!cols'] = columns.map((c) => ({ wch: Math.max(12, Math.min(34, (c.label || '').length + 14)) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, (sheetName || 'Sheet').slice(0, 28));
  XLSX.writeFile(wb, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`);
}

/**
 * خروجی PDF از یک عنصر DOM (متن فارسی از طریق رندر مرورگر شکل می‌گیرد)
 * @param {HTMLElement} element
 * @param {string} filename
 * @param {{title?:string, subtitle?:string, landscape?:boolean}} opts
 */
export async function exportElementPdf(element, filename, opts = {}) {
  const html2canvas = window.html2canvas;
  const jsPDF = window.jspdf?.jsPDF;
  if (!html2canvas || !jsPDF) throw new Error('کتابخانه PDF بارگذاری نشده است');

  const prev = element.style.cssText;
  element.style.width = element.style.width || '794px';
  const canvas = await html2canvas(element, {
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    useCORS: true,
    backgroundColor: '#ffffff',
    logging: false,
  });
  element.style.cssText = prev;

  const landscape = !!opts.landscape;
  const pdf = new jsPDF({ orientation: landscape ? 'l' : 'p', unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 6;
  const imgW = pageW - margin * 2;
  const imgH = (canvas.height * imgW) / canvas.width;

  let heightLeft = imgH;
  let position = margin;
  const imgData = canvas.toDataURL('image/jpeg', 0.92);

  pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
  heightLeft -= pageH - margin * 2;

  while (heightLeft > 0) {
    position = heightLeft - imgH + margin;
    pdf.addPage();
    pdf.addImage(imgData, 'JPEG', margin, position, imgW, imgH);
    heightLeft -= pageH - margin * 2;
  }

  pdf.save(filename.endsWith('.pdf') ? filename : `${filename}.pdf`);
}

/**
 * ساخت جدول موقت در DOM برای خروجی PDF
 * @param {{title:string, subtitle?:string, head:string[], rows:Array<Array<string|number>>, totals?:Array<string|number>}} cfg
 */
export function buildPdfSheet(cfg) {
  const wrap = document.createElement('div');
  wrap.className = 'export-sheet';
  wrap.style.position = 'fixed';
  wrap.style.right = '-10000px';
  wrap.style.top = '0';
  wrap.style.width = '794px';
  wrap.style.background = '#fff';
  wrap.style.fontFamily = "'Vazirmatn', Tahoma, sans-serif";
  wrap.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #0f3d2e;padding-bottom:10px;margin-bottom:14px">
      <div>
        <h3 style="font-size:20px;color:#0f3d2e">${escapeHtml(cfg.title)}</h3>
        <div style="font-size:12px;color:#666">${escapeHtml(cfg.subtitle || '')}</div>
      </div>
      <div style="font-size:11px;color:#888;text-align:left">صبحانه‌سرای آفتاب<br/>${toFa(new Date().toLocaleDateString('fa-IR'))}</div>
    </div>
    <table class="data" style="min-width:0">
      <thead><tr>${cfg.head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
      <tbody>
        ${(cfg.rows || []).map((r) => `<tr>${r.map((c, i) => `<td class="${i > 0 ? 'num' : ''}">${escapeHtml(c == null ? '' : String(c))}</td>`).join('')}</tr>`).join('')}
        ${cfg.totals ? `<tr style="background:#efe8d8;font-weight:800">${cfg.totals.map((c, i) => `<td class="${i > 0 ? 'num' : ''}">${escapeHtml(c == null ? '' : String(c))}</td>`).join('')}</tr>` : ''}
      </tbody>
    </table>
    <div style="margin-top:14px;font-size:11px;color:#888">تاریخ تولید گزارش: ${toFa(new Date().toLocaleString('fa-IR'))}</div>
  `;
  document.body.appendChild(wrap);
  return wrap;
}
