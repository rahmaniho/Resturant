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
 * سند گزارش «تمیز» برای PDF: صفحه سفید، متن مشکی، جدول‌های اختصاصی همان گزارش
 * (نه اسکرین‌شات صفحه برنامه).
 *
 * cfg: {
 *   title, subtitle?, range?, brand?, logo?,
 *   blocks: Array<
 *     {type:'kpis', items:[{label, value}]},
 *     {type:'table', title?, columns:[{label, align?:'num'|'center'}], rows:Array<Array<string>>, totals?:Array<string>},
 *     {type:'note', text},
 *     {type:'text', text}
 *   >
 * }
 * @returns {HTMLElement} عنصر آماده (باید append و سپس حذف شود)
 */
export function buildReportDocument(cfg) {
  const brand = cfg.brand || 'صبحانه‌سرای آفتاب';
  const logo = cfg.logo || './icons/logo.png';
  const wrap = document.createElement('div');
  wrap.className = 'report-doc';
  wrap.style.cssText = 'background:#fff;color:#111;font-family:Vazirmatn,Tahoma,sans-serif';

  const cellCls = (a) => (a === 'num' ? 'text-align:left;direction:ltr' : a === 'center' ? 'text-align:center' : 'text-align:right');

  const blockHtml = (b) => {
    if (b.type === 'kpis') {
      return `<table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tbody><tr>
          ${b.items.map((k) => `<td style="border:1px solid #333;padding:10px;text-align:center;width:${Math.max(20, Math.floor(100 / b.items.length))}%">
            <div style="font-size:11px;color:#333">${escapeHtml(k.label)}</div>
            <div style="font-size:15px;font-weight:800;color:#000;margin-top:4px">${escapeHtml(String(k.value))}</div>
          </td>`).join('')}
        </tr></tbody>
      </table>`;
    }
    if (b.type === 'table') {
      return `${b.title ? `<div style="font-size:13.5px;font-weight:800;color:#000;margin:16px 0 6px;border-right:4px solid #000;padding-right:8px">${escapeHtml(b.title)}</div>` : ''}
      <table style="width:100%;border-collapse:collapse;margin-bottom:6px">
        <thead><tr>
          ${b.columns.map((c) => `<th style="border:1px solid #333;background:#ececec;color:#000;padding:7px 8px;font-size:12px;${cellCls(c.align)}">${escapeHtml(c.label)}</th>`).join('')}
        </tr></thead>
        <tbody>
          ${b.rows.map((r) => `<tr>${r.map((c, i) => `<td style="border:1px solid #555;color:#000;padding:6px 8px;font-size:12.5px;${cellCls(b.columns[i]?.align)}">${escapeHtml(c == null ? '' : String(c))}</td>`).join('')}</tr>`).join('')}
          ${b.totals ? `<tr>${b.totals.map((c, i) => `<td style="border:1px solid #333;background:#f5f5f5;color:#000;padding:7px 8px;font-size:12.5px;font-weight:800;${cellCls(b.columns[i]?.align)}">${escapeHtml(c == null ? '' : String(c))}</td>`).join('')}</tr>` : ''}
        </tbody>
      </table>`;
    }
    if (b.type === 'note') {
      return `<div style="font-size:11.5px;color:#333;border:1px dashed #777;padding:8px 10px;margin:10px 0;white-space:pre-wrap">${escapeHtml(b.text)}</div>`;
    }
    if (b.type === 'text') {
      return `<div style="font-size:12.5px;color:#111;margin:8px 0;white-space:pre-wrap">${escapeHtml(b.text)}</div>`;
    }
    return '';
  };

  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;border-bottom:3px solid #000;padding-bottom:10px">
      <img src="${escapeHtml(logo)}" alt="" style="width:46px;height:46px;border-radius:8px;object-fit:cover;border:1px solid #999" />
      <div style="flex:1">
        <div style="font-size:16px;font-weight:800;color:#000">${escapeHtml(brand)}</div>
        <div style="font-size:11px;color:#444">${escapeHtml(cfg.subtitle || 'گزارش رسمی')}</div>
      </div>
      <div style="text-align:left;font-size:11px;color:#444">
        ${cfg.range ? `<div>${escapeHtml(cfg.range)}</div>` : ''}
        <div>${escapeHtml(new Date().toLocaleDateString('fa-IR'))}</div>
      </div>
    </div>
    <div style="font-size:19px;font-weight:800;color:#000;margin:14px 0 4px;text-align:center">${escapeHtml(cfg.title || '')}</div>
    ${(cfg.blocks || []).map(blockHtml).join('')}
    <div style="margin-top:18px;border-top:1px solid #999;padding-top:6px;font-size:10.5px;color:#555;display:flex;justify-content:space-between">
      <span>${escapeHtml(brand)} — چاپ‌شده از میزینو</span>
      <span>تولید: ${escapeHtml(new Date().toLocaleString('fa-IR'))}</span>
    </div>`;
  return wrap;
}

/**
 * خروجی PDF یک سند گزارش تمیز (سفید/مشکی + جدول‌ها)
 */
export async function exportReportPdf(cfg, filename) {
  const doc = buildReportDocument(cfg);
  doc.style.position = 'fixed';
  doc.style.right = '-10000px';
  doc.style.top = '0';
  doc.style.width = '794px';
  doc.style.padding = '26px 30px';
  document.body.appendChild(doc);
  try {
    await exportElementPdf(doc, filename);
  } finally {
    doc.remove();
  }
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
      <div style="font-size:11px;color:#888;text-align:left">${escapeHtml(brand)}<br/>${toFa(new Date().toLocaleDateString('fa-IR'))}</div>
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
