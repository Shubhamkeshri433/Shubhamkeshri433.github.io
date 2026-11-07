/* Dashboard UI kit: icons, fields, chips, switches, modals, diff, drag-sort. No innerHTML anywhere. */
import { h, clear, S, autosave } from './core.js';

const ICONS = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  skills: 'M4 7h10M18 7h2M4 17h2M10 17h10M14 4v6M8 14v6',
  folder: 'M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z',
  pen: 'M4 20l4-1 11-11-3-3L5 16l-1 4zM14 6l3 3',
  image: 'M4 5h16v14H4zM8 10a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM4 17l5-5 4 4 3-3 4 4',
  type: 'M5 6V4h14v2M12 4v16M9 20h6',
  clock: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5l3 2',
  heart: 'M12 20s-7-4.5-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.5-7 10-7 10z',
  archive: 'M3 5h18v4H3zM5 9v10h14V9M10 13h4',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12l2-1-2-4-2 1a7 7 0 00-2-1l-.5-2h-4L10 7a7 7 0 00-2 1L6 7 4 11l2 1a7 7 0 000 2l-2 1 2 4 2-1a7 7 0 002 1l.5 2h4l.5-2a7 7 0 002-1l2 1 2-4-2-1a7 7 0 000-2z',
  search: 'M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5',
  sun: 'M12 16a4 4 0 100-8 4 4 0 000 8zM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  moon: 'M20 14A8 8 0 019.5 4 8 8 0 1020 14z',
  plus: 'M12 5v14M5 12h14',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  save: 'M5 4h12l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 118 0v3',
  menu: 'M4 6h16M4 12h16M4 18h16',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  github: 'M9 19c-4 1-4-2-6-2m12 4v-3a3 3 0 00-1-2c3 0 6-1.5 6-6a5 5 0 00-1.5-3.5 4.5 4.5 0 000-3.5s-1 0-3.5 1.5a12 12 0 00-6 0C6.5 3 5.5 3 5.5 3a4.5 4.5 0 000 3.5A5 5 0 004 10c0 4.5 3 6 6 6a3 3 0 00-1 2v3',
  check: 'M5 12l5 5 9-10',
  x: 'M6 6l12 12M18 6L6 18',
  grip: 'M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01',
  star: 'M12 3l2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8 6.6 19.7l1.1-6.1L3.2 9.4l6.1-.8z',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3A4 4 0 0011 18.7l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16v4z',
  up: 'M6 15l6-6 6 6', down: 'M6 9l6 6 6-6',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 100-6 3 3 0 000 6z',
  undo: 'M9 7L4 12l5 5M4 12h11a5 5 0 010 10h-2',
  code: 'M8 8l-5 4 5 4M16 8l5 4-5 4M14 5l-4 14',
  refresh: 'M20 12a8 8 0 10-2.5 5.8M20 5v7h-7',
  warn: 'M12 3l10 18H2L12 3zM12 10v5M12 18h.01',
};
export function icon(name, size = 18) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round'); svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path'); p.setAttribute('d', ICONS[name] || ICONS.x); svg.appendChild(p);
  return svg;
}

/* every edit calls this: schedules a local draft and refreshes the "unsaved" chip */
export function changed() { autosave(); if (S.refreshBar) S.refreshBar(); }

export function btn(label, opts = {}) {
  const b = h('button', { type: 'button', class: 'btn ' + (opts.kind || ''), title: opts.title || null, 'aria-label': opts.aria || null });
  if (opts.icon) b.appendChild(icon(opts.icon, opts.size || 16));
  if (label) b.appendChild(h('span', null, label));
  if (opts.onClick) b.addEventListener('click', async (e) => { if (opts.busy) b.disabled = true; try { await opts.onClick(e, b); } finally { b.disabled = false; } });
  return b;
}
export const iconBtn = (name, title, onClick, kind = '') => btn('', { icon: name, title, aria: title, onClick, kind: 'icon ' + kind });

let uid = 0;
export function fld(label, obj, key, o = {}) {
  const id = 'f' + ++uid;
  const el = h(o.area ? 'textarea' : 'input', { id, type: o.area ? null : (o.type || 'text'), placeholder: o.ph || null, autocomplete: 'off', spellcheck: o.area ? 'true' : 'false', rows: o.rows || null });
  el.value = obj[key] == null ? '' : obj[key];
  el.addEventListener('input', () => { obj[key] = el.value; if (o.onInput) o.onInput(el.value); changed(); });
  return h('div', { class: 'fld' + (o.wide ? ' wide' : '') }, h('label', { for: id }, label), el, o.hint ? h('small', null, o.hint) : null);
}
export function selectFld(label, value, options, onChange) {
  const id = 'f' + ++uid;
  const el = h('select', { id }, ...options.map(([v, t]) => h('option', { value: v }, t)));
  el.value = value; el.addEventListener('change', () => onChange(el.value));
  return h('div', { class: 'fld' }, h('label', { for: id }, label), el);
}
export function chips(label, arr, onChange, ph = 'Type and press Enter') {
  const wrap = h('div', { class: 'chips-in' });
  const input = h('input', { type: 'text', placeholder: ph, autocomplete: 'off', 'aria-label': label });
  const paint = () => {
    clear(wrap);
    arr.forEach((t, i) => {
      const x = h('button', { type: 'button', 'aria-label': 'Remove ' + t }, '×');
      x.addEventListener('click', () => { arr.splice(i, 1); onChange(arr); paint(); changed(); });
      wrap.appendChild(h('span', { class: 'chip-t' }, t, x));
    });
    wrap.appendChild(input);
  };
  const add = () => { const parts = input.value.split(',').map((s) => s.trim()).filter(Boolean); if (!parts.length) return; parts.forEach((p) => { if (!arr.includes(p)) arr.push(p); }); input.value = ''; onChange(arr); paint(); changed(); input.focus(); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } else if (e.key === 'Backspace' && !input.value && arr.length) { arr.pop(); onChange(arr); paint(); changed(); input.focus(); } });
  input.addEventListener('blur', add);
  paint();
  return h('div', { class: 'fld wide' }, h('label', null, label), wrap);
}
export function sw(label, desc, value, onChange) {
  const b = h('button', { type: 'button', class: 'sw', role: 'switch', 'aria-checked': String(!!value), 'aria-label': label });
  b.addEventListener('click', () => { value = !value; b.setAttribute('aria-checked', String(value)); onChange(value); changed(); });
  return h('div', { class: 'sw-row' }, h('div', null, h('b', null, label), desc ? h('small', null, desc) : null), b);
}
export const card = (title, right, ...kids) => h('section', { class: 'card' }, (title || right) ? h('h3', null, h('span', null, title), right || null) : null, ...kids);
export const empty = (text, action) => h('div', { class: 'empty' }, h('p', null, text), action || null);

/* ---------- modal ---------- */
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const prev = document.activeElement;
  const back = h('div', { class: 'modal-back' });
  const box = h('div', { class: 'modal' + (wide ? ' wide' : ''), role: 'dialog', 'aria-modal': 'true', 'aria-label': title || 'Dialog' });
  const close = () => { back.remove(); document.removeEventListener('keydown', onKey, true); if (prev && prev.focus) prev.focus(); if (onClose) onClose(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  document.addEventListener('keydown', onKey, true);
  back.addEventListener('mousedown', (e) => { if (e.target === back) close(); });
  box.append(h('div', { class: 'modal-h' }, h('h3', null, title || ''), iconBtn('x', 'Close', close)), h('div', { class: 'modal-b' }, body), actions.length ? h('div', { class: 'modal-f' }, ...actions) : null);
  back.appendChild(box); document.body.appendChild(back);
  const f = box.querySelector('input,textarea,select,button.btn.primary,button'); if (f) setTimeout(() => f.focus(), 30);
  return { close, box };
}
export function confirmBox(title, text, ok = 'Confirm', danger = false) {
  return new Promise((res) => {
    let done = false;
    const m = modal({ title, body: h('p', null, text), onClose: () => { if (!done) res(false); },
      actions: [btn('Cancel', { onClick: () => { done = true; m.close(); res(false); } }), btn(ok, { kind: danger ? 'danger' : 'primary', onClick: () => { done = true; m.close(); res(true); } })] });
  });
}
export function promptBox(title, label, value = '', ok = 'OK') {
  return new Promise((res) => {
    let done = false; const o = { v: value };
    const inp = fld(label, o, 'v');
    const m = modal({ title, body: inp, onClose: () => { if (!done) res(null); },
      actions: [btn('Cancel', { onClick: () => { done = true; m.close(); res(null); } }), btn(ok, { kind: 'primary', onClick: () => { done = true; m.close(); res(o.v.trim()); } })] });
    inp.querySelector('input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { done = true; m.close(); res(o.v.trim()); } });
  });
}

/* ---------- diff (line based, for the "review changes" screen) ---------- */
export function diffLines(a, b) {
  const x = a.split('\n'), y = b.split('\n'), n = x.length, m = y.length;
  const L = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = x[i] === y[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const ops = []; let i = 0, j = 0;
  while (i < n && j < m) { if (x[i] === y[j]) { ops.push([' ', x[i]]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) ops.push(['-', x[i++]]); else ops.push(['+', y[j++]]); }
  while (i < n) ops.push(['-', x[i++]]); while (j < m) ops.push(['+', y[j++]]);
  return ops;
}
export function diffView(oldStr, newStr) {
  const ops = diffLines(oldStr, newStr), keep = new Set();
  ops.forEach(([t], i) => { if (t !== ' ') for (let k = Math.max(0, i - 2); k <= Math.min(ops.length - 1, i + 2); k++) keep.add(k); });
  const box = h('div', { class: 'diff', role: 'region', 'aria-label': 'Changes' }); let skipped = false;
  ops.forEach(([t, line], i) => {
    if (!keep.has(i)) { if (!skipped) box.appendChild(h('div', { class: 'dl skip' }, '⋯')); skipped = true; return; }
    skipped = false; box.appendChild(h('div', { class: 'dl ' + (t === '+' ? 'add' : t === '-' ? 'del' : '') }, h('i', null, t === ' ' ? '' : t), h('code', null, line || ' ')));
  });
  if (!ops.some(([t]) => t !== ' ')) box.appendChild(h('p', { class: 'muted' }, 'No changes.'));
  return box;
}

/* ---------- drag to reorder (mouse) + move buttons (touch / keyboard) ---------- */
export function dragList(container, onMove) {
  let from = -1;
  [...container.children].forEach((item, i) => {
    const grip = item.querySelector('.grip');
    if (grip) {
      grip.addEventListener('mousedown', () => { item.draggable = true; });
      item.addEventListener('dragend', () => { item.draggable = false; item.classList.remove('dragging'); container.querySelectorAll('.over').forEach((e) => e.classList.remove('over')); });
    }
    item.addEventListener('dragstart', (e) => { from = i; item.classList.add('dragging'); if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } });
    item.addEventListener('dragover', (e) => { if (from < 0) return; e.preventDefault(); item.classList.add('over'); });
    item.addEventListener('dragleave', () => item.classList.remove('over'));
    item.addEventListener('drop', (e) => { e.preventDefault(); const f = from; from = -1; if (f >= 0 && f !== i) onMove(f, i); });
  });
}
export const gripEl = () => h('span', { class: 'grip', title: 'Drag to reorder', 'aria-hidden': 'true' }, icon('grip', 16));
export const moveArr = (arr, f, t) => arr.splice(t, 0, arr.splice(f, 1)[0]);
