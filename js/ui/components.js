/* ============================================================
   اجزای مشترک UI — توست، مودال، تأیید، جدول‌ها، آیکون‌ها
   ============================================================ */

import { escapeHtml, toFa, debounce, normalize, toEn } from '../core/utils.js';

/* ---------- آیکون‌ها (SVG) ---------- */
export const ICONS = {
  dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></svg>',
  cart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="20" r="1.6"/><circle cx="17" cy="20" r="1.6"/><path d="M3 4h2l2.5 11h10L20 8H6.2"/><path d="M9 8V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/></svg>',
  menuBook: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H12v18H6.5A2.5 2.5 0 0 1 4 18.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H12v18h5.5A2.5 2.5 0 0 0 20 18.5z"/></svg>',
  box: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8.5v7L12 21l-9-5.5v-7L12 3z"/><path d="M3 8.5 12 14l9-5.5"/><path d="M12 14v7"/></svg>',
  warehouse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21V9l9-6 9 6v12"/><path d="M8 21v-7h8v7"/><path d="M8 17h8"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6"/><path d="M10 3v6L4.5 18A2 2 0 0 0 6.3 21h11.4a2 2 0 0 0 1.8-3L14 9V3"/><path d="M7.5 15h9"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h11v11H3z"/><path d="M14 10h4l3 3v4h-7z"/><circle cx="7" cy="18.5" r="1.8"/><circle cx="17" cy="18.5" r="1.8"/></svg>',
  wallet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="13" rx="2.5"/><path d="M3 10h18"/><circle cx="16.5" cy="14.5" r="1.3"/></svg>',
  expense: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v10"/><path d="M15 9.5c-.6-1-1.7-1.5-3-1.5-1.7 0-3 .9-3 2.2 0 2.8 6 1.6 6 4.4 0 1.3-1.3 2.4-3 2.4-1.4 0-2.6-.6-3.2-1.6"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.6"/><path d="M18 14.7c2 .8 3.5 2.6 3.5 5.3"/></svg>',
  backup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v11"/><path d="m8 10 4 4 4-4"/><path d="M4 17v2.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V17"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.7 1.7 0 0 0 .35 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.35 1.7 1.7 0 0 0-1.03 1.56V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.35l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .35-1.87 1.7 1.7 0 0 0-1.56-1.03H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.55-1.1 1.7 1.7 0 0 0-.35-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.35H9a1.7 1.7 0 0 0 1.03-1.56V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1.03 1.56 1.7 1.7 0 0 0 1.87-.35l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.35 1.87V9c.27.63.88 1.03 1.56 1.03H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1.03z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/><path d="M6 7l1 13a1.5 1.5 0 0 0 1.5 1.4h7A1.5 1.5 0 0 0 17 20l1-13"/><path d="M10 11v6M14 11v6"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17z"/><path d="M14.5 6.5l3 3"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19z"/><path d="M12 10v4"/><path d="M12 17.5v.5"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.5v.5"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5 5l1.4 1.4M17.6 17.6 19 19M19 5l-1.4 1.4M6.4 17.6 5 19"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5z"/></svg>',
  hamburger: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  excel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/><path d="M9 9v12"/><path d="m13.5 13 4 5M17.5 13l-4 5"/></svg>',
  pdf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/><path d="M9 13h6M9 17h4"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v5h-5"/></svg>',
  arrowIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12"/><path d="m7 11 5 5 5-5"/><path d="M4 20h16"/></svg>',
  arrowOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20V8"/><path d="m7 13 5-5 5 5"/><path d="M4 4h16"/></svg>',
};

export function icon(name, cls = '') {
  return `<span class="ico ${cls}" style="display:inline-flex;width:18px;height:18px">${ICONS[name] || ''}</span>`;
}

/* ---------- توست ---------- */
export function toast(message, type = 'success', ms = 3200) {
  let root = document.getElementById('toast-root');
  if (!root) {
    root = document.createElement('div');
    root.id = 'toast-root';
    document.body.appendChild(root);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const ic = type === 'success' ? 'check' : type === 'error' ? 'alert' : type === 'warn' ? 'alert' : 'info';
  el.innerHTML = `${icon(ic)}<div>${escapeHtml(message)}</div>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => el.remove(), 260);
  }, ms);
  return el;
}

/* ---------- مودال ---------- */
let modalStack = [];

export function openModal({ title, content, footer, size = '', onClose }) {
  const root = document.getElementById('modal-root') || document.body;
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  const sizeCls = size === 'wide' ? ' wide' : size === 'xwide' ? ' xwide' : '';
  backdrop.innerHTML = `
    <div class="modal${sizeCls}" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h3>${escapeHtml(title || '')}</h3>
        <button class="modal-close" data-close type="button" aria-label="بستن">${icon('x')}</button>
      </div>
      <div class="modal-body"></div>
      <div class="modal-foot hidden"></div>
    </div>`;
  const body = backdrop.querySelector('.modal-body');
  if (typeof content === 'string') body.innerHTML = content;
  else if (content) body.appendChild(content);

  const foot = backdrop.querySelector('.modal-foot');
  if (footer) {
    if (typeof footer === 'string') { foot.innerHTML = footer; foot.classList.remove('hidden'); }
    else { foot.appendChild(footer); foot.classList.remove('hidden'); }
  }

  const close = () => {
    backdrop.remove();
    modalStack = modalStack.filter((m) => m !== api);
    document.removeEventListener('keydown', escHandler);
    onClose?.();
  };
  const escHandler = (e) => { if (e.key === 'Escape') close(); };
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) close(); });
  backdrop.querySelector('[data-close]').addEventListener('click', close);
  document.addEventListener('keydown', escHandler);

  root.appendChild(backdrop);
  // نرمال‌سازی ارقام فارسی در فیلدهای تاریخ
  body.querySelectorAll('[data-date]').forEach((inp) => {
    inp.addEventListener('change', () => { inp.value = toEn(inp.value).trim(); });
    inp.addEventListener('blur', () => { inp.value = toEn(inp.value).trim(); });
  });
  const api = { close, body, foot, el: backdrop };
  modalStack.push(api);
  setTimeout(() => body.querySelector('input,select,textarea,button')?.focus(), 50);
  return api;
}

export function closeAllModals() {
  modalStack.slice().forEach((m) => m.close());
}

/** مودال تأیید — Promise<boolean> */
export function confirmDialog(message, { title = 'تأیید عملیات', danger = false, confirmText = 'تأیید' } = {}) {
  return new Promise((resolve) => {
    const content = document.createElement('div');
    content.innerHTML = `
      <div class="flex" style="align-items:flex-start;gap:12px">
        <span style="color:${danger ? 'var(--danger)' : 'var(--gold-text)'};width:26px;height:26px;display:inline-flex">${icon(danger ? 'alert' : 'info')}</span>
        <p style="line-height:1.9">${escapeHtml(message)}</p>
      </div>`;
    let decided = false;
    const modal = openModal({
      title,
      content,
      footer: `
        <button class="btn ${danger ? 'btn-danger' : 'btn-primary'}" data-yes type="button">${escapeHtml(confirmText)}</button>
        <button class="btn btn-outline" data-no type="button">انصراف</button>`,
      onClose: () => { if (!decided) resolve(false); },
    });
    modal.foot.querySelector('[data-yes]').addEventListener('click', () => { decided = true; modal.close(); resolve(true); });
    modal.foot.querySelector('[data-no]').addEventListener('click', () => { decided = true; modal.close(); resolve(false); });
  });
}

/* ---------- جدول داده با جست‌وجو ---------- */

/**
 * ساخت جدول جست‌وجوشونده
 * @param {{
 *   columns: Array<{key:string,label:string,render?:(row)=>string,cls?:string,width?:string}>,
 *   rows: Array<object>,
 *   searchKeys?: string[],
 *   emptyText?: string,
 *   rowActions?: (row)=>string,
 *   onRowClick?: (row)=>void,
 *   toolbarExtra?: string,
 *   excel?: {filename:string, sheetName:string}|null,
 *   caption?: string
 * }} cfg
 * @returns {HTMLElement}
 */
export function buildTable(cfg) {
  const wrap = document.createElement('div');
  const state = { q: '' };

  const render = () => {
    let rows = cfg.rows;
    if (state.q) {
      const q = normalize(state.q);
      const keys = cfg.searchKeys || cfg.columns.map((c) => c.key);
      rows = rows.filter((r) => keys.some((k) => normalize(typeof r[k] === 'object' ? JSON.stringify(r[k]) : r[k] ?? '').includes(q)));
    }

    const body = rows.length
      ? rows.map((r, idx) => `
          <tr class="${cfg.onRowClick ? 'clickable' : ''}" data-idx="${idx}">
            ${cfg.columns.map((c) => `<td class="${c.cls || ''}">${c.render ? c.render(r) : escapeHtml(r[c.key] ?? '—')}</td>`).join('')}
            ${cfg.rowActions ? `<td class="actions">${cfg.rowActions(r)}</td>` : ''}
          </tr>`).join('')
      : `<tr><td class="table-empty" colspan="${cfg.columns.length + (cfg.rowActions ? 1 : 0)}">${escapeHtml(cfg.emptyText || 'موردی یافت نشد')}</td></tr>`;

    wrap.innerHTML = `
      <div class="table-toolbar">
        <div class="search-box">
          ${icon('search')}
          <input class="input" type="search" placeholder="جست‌وجو…" value="${escapeHtml(state.q)}" data-search />
        </div>
        <div class="spacer"></div>
        ${cfg.toolbarExtra || ''}
        ${cfg.excel ? `<button class="btn btn-outline btn-sm" data-excel type="button">${icon('excel')} خروجی اکسل</button>` : ''}
      </div>
      <div class="table-wrap">
        <table class="data">
          <thead><tr>
            ${cfg.columns.map((c) => `<th class="${c.cls || ''}" ${c.width ? `style="width:${c.width}"` : ''}>${escapeHtml(c.label)}</th>`).join('')}
            ${cfg.rowActions ? '<th class="actions">عملیات</th>' : ''}
          </tr></thead>
          <tbody>${body}</tbody>
        </table>
      </div>
      <div class="table-foot">
        <span>${toFa(rows.length)} ردیف${cfg.caption ? ` • ${escapeHtml(cfg.caption)}` : ''}</span>
      </div>`;

    const search = wrap.querySelector('[data-search]');
    search.addEventListener('input', debounce((e) => {
      state.q = e.target.value;
      const pos = e.target.selectionStart;
      render();
      const s = wrap.querySelector('[data-search]');
      s.focus();
      try { s.setSelectionRange(pos, pos); } catch { /* noop */ }
    }, 200));

    wrap.querySelector('[data-excel]')?.addEventListener('click', async () => {
      try {
        const { exportTableExcel } = await import('../core/exporters.js');
        exportTableExcel(cfg.excel.filename, cfg.excel.sheetName, cfg.columns.filter((c) => !c.render || c.exportValue), rows.map((r) => {
          const o = { ...r };
          for (const c of cfg.columns) {
            if (c.exportValue) o[c.key] = c.exportValue(r);
          }
          return o;
        }));
        toast('فایل اکسل ساخته شد', 'success');
      } catch (e) {
        toast(e.message || 'خطا در خروجی اکسل', 'error');
      }
    });

    wrap.querySelectorAll('tbody tr[data-idx]').forEach((tr) => {
      tr.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('a')) return;
        cfg.onRowClick?.(rows[Number(tr.dataset.idx)]);
      });
    });
  };

  render();
  return wrap;
}

/* ---------- عناصر کمکی ---------- */

export function kpiCard({ label, value, unit = '', sub = '', cls = '', iconName = '' }) {
  return `
    <div class="kpi ${cls}">
      <div class="kpi-label">${iconName ? icon(iconName) : ''}${escapeHtml(label)}</div>
      <div class="kpi-value">${value}${unit ? `<span class="unit">${escapeHtml(unit)}</span>` : ''}</div>
      ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    </div>`;
}

export function emptyState({ title, text, actionHtml = '' , iconName = 'info'}) {
  return `
    <div class="empty-state">
      <div class="es-icon">${icon(iconName)}</div>
      <h4>${escapeHtml(title)}</h4>
      ${text ? `<p>${escapeHtml(text)}</p>` : ''}
      ${actionHtml}
    </div>`;
}

export function fieldText({ id, label, value = '', placeholder = '', hint = '', type = 'text', cls = '' }) {
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <input class="input ${cls}" id="${id}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" />
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

export function fieldNum({ id, label, value = '', placeholder = '', hint = '', min = '', step = 'any' }) {
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <input class="input num" id="${id}" type="text" inputmode="decimal" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholder)}" data-num ${min !== '' ? `data-min="${min}"` : ''} />
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

export function fieldSelect({ id, label, options = [], value = '', placeholder = '— انتخاب —', hint = '' }) {
  const opts = options.map((o) => {
    const v = typeof o === 'object' ? o.value : o;
    const t = typeof o === 'object' ? o.label : o;
    return `<option value="${escapeHtml(v)}" ${String(v) === String(value) ? 'selected' : ''}>${escapeHtml(t)}</option>`;
  }).join('');
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <select class="select" id="${id}">
        ${placeholder !== null ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}
        ${opts}
      </select>
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

export function fieldTextarea({ id, label, value = '', placeholder = '', rows = 3 }) {
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <textarea class="textarea" id="${id}" rows="${rows}" placeholder="${escapeHtml(placeholder)}">${escapeHtml(value)}</textarea>
    </div>`;
}

export function fieldDate({ id, label, value = '', hint = '' }) {
  // ورودی تاریخ شمسی به‌صورت متن با الگوی YYYY-MM-DD
  return `
    <div class="field">
      <label for="${id}">${escapeHtml(label)}</label>
      <input class="input" id="${id}" type="text" inputmode="numeric" dir="ltr" placeholder="1405-08-03" value="${escapeHtml(value)}" data-date />
      ${hint ? `<span class="hint">${escapeHtml(hint)}</span>` : ''}
    </div>`;
}

/** خواندن مقدار فیلدها با نرمال‌سازی عدد/تاریخ */
export function readFields(root, ids) {
  const out = {};
  for (const id of ids) {
    const safe = typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id;
    const el = root.querySelector(`#${safe}`) || document.getElementById(id);
    if (!el) continue;
    out[id] = el.value;
  }
  return out;
}

export function fieldNumValue(root, id, fallback = 0) {
  const el = document.getElementById(id);
  if (!el) return fallback;
  const { toEn } = { toEn: (s) => String(s).replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) };
  const n = parseFloat(toEn(el.value));
  return Number.isFinite(n) ? n : fallback;
}
