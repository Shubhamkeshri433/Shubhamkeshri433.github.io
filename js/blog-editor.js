/* Blog writing tools for the dashboard: formatting toolbar and an in-browser photo editor (crop, rotate, flip, brightness, contrast, resize, compress).
   Everything runs in the browser; nothing is sent anywhere until you press "Upload & insert". */
import { h } from './dom.js';

const fire = (ta) => ta.dispatchEvent(new Event('input', { bubbles: true }));

export function wrapSel(ta, before, after, ph) {
  const s = ta.selectionStart, e = ta.selectionEnd, sel = ta.value.slice(s, e) || ph;
  ta.value = ta.value.slice(0, s) + before + sel + after + ta.value.slice(e);
  ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); fire(ta);
}
export function prefixLines(ta, fn) {
  const v = ta.value;
  const s = v.lastIndexOf('\n', ta.selectionStart - 1) + 1;
  let e = v.indexOf('\n', ta.selectionEnd); if (e < 0) e = v.length;
  const out = v.slice(s, e).split('\n').map(fn).join('\n');
  ta.value = v.slice(0, s) + out + v.slice(e);
  ta.focus(); ta.setSelectionRange(s, s + out.length); fire(ta);
}
export function insertBlock(ta, text) {
  const s = ta.selectionEnd, v = ta.value;
  const pre = s === 0 || v.slice(Math.max(0, s - 2), s) === '\n\n' ? '' : (v[s - 1] === '\n' ? '\n' : '\n\n');
  const post = v.slice(s, s + 2) === '\n\n' ? '' : (v[s] === '\n' ? '\n' : '\n\n');
  ta.value = v.slice(0, s) + pre + text + post + v.slice(s);
  const pos = s + pre.length + text.length + post.length;
  ta.focus(); ta.setSelectionRange(pos, pos); fire(ta);
}

export function buildToolbar(ta, { onPickImage, onLibrary }) {
  const btn = (label, title, fn) => {
    const b = h('button', { type: 'button', class: 'alt tbtn', title, 'aria-label': title }, label);
    b.addEventListener('mousedown', (e) => e.preventDefault()); // keep the text selection
    b.addEventListener('click', fn); return b;
  };
  const askUrl = (msg) => { const u = (prompt(msg, 'https://') || '').trim(); return /^https?:\/\/\S+$/i.test(u) ? u : null; };
  const fx = h('select', { class: 'tbsel', 'aria-label': 'Font style' },
    h('option', { value: '' }, 'Font…'), h('option', { value: 'display' }, 'Comic'), h('option', { value: 'mono' }, 'Code font'),
    h('option', { value: 'big' }, 'Big'), h('option', { value: 'small' }, 'Small'));
  fx.addEventListener('change', () => { if (fx.value) wrapSel(ta, `{{${fx.value}: `, '}}', 'text'); fx.value = ''; });
  ta.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'b') { e.preventDefault(); wrapSel(ta, '**', '**', 'bold'); }
    if (k === 'i') { e.preventDefault(); wrapSel(ta, '*', '*', 'italic'); }
    if (k === 'u') { e.preventDefault(); wrapSel(ta, '++', '++', 'underline'); }
  });
  const file = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', class: 'hidden', 'aria-label': 'Choose a photo' });
  file.addEventListener('change', () => { if (file.files[0]) onPickImage(file.files[0]); file.value = ''; });
  return h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Formatting' },
    btn('B', 'Bold (Ctrl+B)', () => wrapSel(ta, '**', '**', 'bold')),
    btn('I', 'Italic (Ctrl+I)', () => wrapSel(ta, '*', '*', 'italic')),
    btn('U', 'Underline (Ctrl+U)', () => wrapSel(ta, '++', '++', 'underline')),
    btn('S', 'Strikethrough', () => wrapSel(ta, '~~', '~~', 'text')),
    btn('Mark', 'Highlight', () => wrapSel(ta, '==', '==', 'text')),
    fx,
    btn('H2', 'Big heading', () => prefixLines(ta, (l) => '## ' + l.replace(/^#{1,3}\s+/, ''))),
    btn('H3', 'Small heading', () => prefixLines(ta, (l) => '### ' + l.replace(/^#{1,3}\s+/, ''))),
    btn('• List', 'Bullet list', () => prefixLines(ta, (l) => '- ' + l.replace(/^\s*[-*]\s+/, ''))),
    btn('1. List', 'Numbered list', () => prefixLines(ta, (l, i) => `${i + 1}. ` + l.replace(/^\s*\d+\.\s+/, ''))),
    btn('Quote', 'Quote', () => prefixLines(ta, (l) => '> ' + l.replace(/^>\s?/, ''))),
    btn('Center', 'Centre the paragraph', () => prefixLines(ta, (l) => (/^::\s?/.test(l) ? l.replace(/^::\s?/, '') : ':: ' + l))),
    btn('Link', 'Link', () => { const u = askUrl('Link address (https://…)'); if (u) wrapSel(ta, '[', `](${u})`, 'link text'); }),
    btn('Code', 'Code', () => wrapSel(ta, '`', '`', 'code')),
    btn('Line', 'Divider line', () => insertBlock(ta, '---')),
    btn('Photo', 'Add a photo (opens the photo editor)', () => file.click()),
    btn('Library', 'Photos you already uploaded', onLibrary),
    btn('Video', 'YouTube video', () => { const u = askUrl('YouTube link'); if (u) insertBlock(ta, `@[youtube](${u})`); }),
    file);
}

/* ---------- photo editor ---------- */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function adjust(ctx, w, h2, bright, contrast) {
  if (!bright && !contrast) return;
  const img = ctx.getImageData(0, 0, w, h2), d = img.data;
  const f = (259 * (contrast + 255)) / (255 * (259 - contrast)), add = bright * 2.55;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = clamp(f * (d[i + k] - 128) + 128 + add, 0, 255);
  ctx.putImageData(img, 0, 0);
}

export async function createImageEditor(file, { onDone, onCancel }) {
  let bmp;
  try { bmp = await createImageBitmap(file); } catch (e) { throw new Error('Could not open this photo. Use a JPG, PNG or WebP (convert iPhone HEIC photos first).'); }
  const mk = (w, h2) => { const c = document.createElement('canvas'); c.width = w; c.height = h2; return c; };
  const sc0 = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  let base = mk(Math.round(bmp.width * sc0), Math.round(bmp.height * sc0));
  base.getContext('2d').drawImage(bmp, 0, 0, base.width, base.height);
  const st = { crop: null, bright: 0, contrast: 0, ratio: 0, maxw: 1600, q: 82 };
  const view = mk(10, 10); view.className = 'editor-canvas';
  let vs = 1, drag = null, sizeTimer = 0;
  const sizeEl = h('span', { class: 'note' }, '');

  function layout() { vs = Math.min(1, 640 / base.width, 400 / base.height); view.width = Math.round(base.width * vs); view.height = Math.round(base.height * vs); }
  function draw() {
    const ctx = view.getContext('2d');
    ctx.clearRect(0, 0, view.width, view.height);
    ctx.drawImage(base, 0, 0, view.width, view.height);
    adjust(ctx, view.width, view.height, st.bright, st.contrast);
    const c = st.crop;
    if (c) {
      const x = c.x * vs, y = c.y * vs, w = c.w * vs, h2 = c.h * vs;
      ctx.fillStyle = 'rgba(0,0,0,.55)';
      ctx.fillRect(0, 0, view.width, y); ctx.fillRect(0, y + h2, view.width, view.height - y - h2);
      ctx.fillRect(0, y, x, h2); ctx.fillRect(x + w, y, view.width - x - w, h2);
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, h2);
    }
  }
  function render() {
    const c = st.crop || { x: 0, y: 0, w: base.width, h: base.height };
    const sc = Math.min(1, st.maxw / c.w), out = mk(Math.max(1, Math.round(c.w * sc)), Math.max(1, Math.round(c.h * sc)));
    const ctx = out.getContext('2d');
    ctx.drawImage(base, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);
    adjust(ctx, out.width, out.height, st.bright, st.contrast);
    return out;
  }
  async function toBlob() {
    const out = render();
    let b = await new Promise((r) => out.toBlob(r, 'image/webp', st.q / 100)), ext = 'webp';
    if (!b || b.type !== 'image/webp') { b = await new Promise((r) => out.toBlob(r, 'image/jpeg', st.q / 100)); ext = 'jpg'; }
    return { blob: b, ext, w: out.width, h: out.height };
  }
  function updSize() {
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(async () => { const r = await toBlob(); sizeEl.textContent = `Result: ${r.w} × ${r.h}px, about ${Math.round(r.blob.size / 1024)} KB${r.blob.size > 700 * 1024 ? ' (large: lower the quality or width)' : ''}`; }, 250);
  }
  const redraw = () => { draw(); updSize(); };
  function transform(fn, nw, nh) {
    const n = mk(nw, nh), ctx = n.getContext('2d'); fn(ctx); base = n; st.crop = null; layout(); redraw();
  }
  const rotate = (dir) => transform((ctx) => { ctx.translate(base.height / 2, base.width / 2); ctx.rotate(dir * Math.PI / 2); ctx.drawImage(base, -base.width / 2, -base.height / 2); }, base.height, base.width);
  const flip = (horiz) => transform((ctx) => { if (horiz) { ctx.translate(base.width, 0); ctx.scale(-1, 1); } else { ctx.translate(0, base.height); ctx.scale(1, -1); } ctx.drawImage(base, 0, 0); }, base.width, base.height);

  const pt = (e) => { const r = view.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * (view.width / r.width), 0, view.width), y: clamp((e.clientY - r.top) * (view.height / r.height), 0, view.height) }; };
  view.addEventListener('pointerdown', (e) => { view.setPointerCapture(e.pointerId); drag = pt(e); });
  view.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const p = pt(e); let w = p.x - drag.x, hh = p.y - drag.y;
    if (st.ratio) {
      const sx = Math.sign(w) || 1, sy = Math.sign(hh) || 1;
      let aw = Math.abs(w), ah = aw / st.ratio;
      const maxW = sx > 0 ? view.width - drag.x : drag.x, maxH = sy > 0 ? view.height - drag.y : drag.y;
      if (ah > maxH) { ah = maxH; aw = ah * st.ratio; }
      if (aw > maxW) { aw = maxW; ah = aw / st.ratio; }
      w = sx * aw; hh = sy * ah;
    }
    const x = Math.min(drag.x, drag.x + w), y = Math.min(drag.y, drag.y + hh);
    st.crop = { x: x / vs, y: y / vs, w: Math.abs(w) / vs, h: Math.abs(hh) / vs }; draw();
  });
  const end = () => { if (!drag) return; drag = null; if (st.crop && (st.crop.w < 12 || st.crop.h < 12)) st.crop = null; redraw(); };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);

  const btn = (label, fn, cls) => { const b = h('button', { type: 'button', class: cls || 'alt tbtn' }, label); b.addEventListener('click', fn); return b; };
  const range = (label, min, max, val, fn) => {
    const r = h('input', { type: 'range', min, max, value: val, 'aria-label': label });
    const out = h('span', { class: 'note' }, String(val));
    r.addEventListener('input', () => { out.textContent = r.value; fn(+r.value); redraw(); });
    return h('div', null, h('label', null, label, ' ', out), r);
  };
  const ratio = h('select', { 'aria-label': 'Crop shape' }, ...[['Free', 0], ['Square 1:1', 1], ['Wide 16:9', 16 / 9], ['Photo 3:2', 3 / 2], ['Classic 4:3', 4 / 3], ['Tall 3:4', 3 / 4]].map(([t, v]) => h('option', { value: v }, t)));
  ratio.addEventListener('change', () => { st.ratio = +ratio.value; });
  const maxw = h('select', { 'aria-label': 'Maximum width' }, ...[800, 1200, 1600, 2000].map((v) => h('option', { value: v }, v + ' px')));
  maxw.value = '1600'; maxw.addEventListener('change', () => { st.maxw = +maxw.value; updSize(); });
  const alt = h('input', { type: 'text', placeholder: 'Caption (also read aloud for accessibility)', 'aria-label': 'Caption', autocomplete: 'off' });
  const go = btn('Upload & insert', async () => {
    go.disabled = true;
    try { const r = await toBlob(); await onDone(r.blob, r.ext, alt.value.replace(/[\[\]\n]/g, ' ').trim()); } finally { go.disabled = false; }
  }, 'go');

  layout(); draw(); updSize();
  return h('div', { class: 'item imged' }, h('h3', null, 'Photo editor'),
    h('p', { class: 'note' }, 'Drag on the photo to choose the crop. Change the sliders, then upload.'),
    view,
    h('div', { class: 'toolbar' }, btn('⟲ Rotate left', () => rotate(-1)), btn('⟳ Rotate right', () => rotate(1)), btn('↔ Flip', () => flip(true)), btn('↕ Flip', () => flip(false)),
      btn('Clear crop', () => { st.crop = null; redraw(); })),
    h('div', { class: 'row' }, h('div', null, h('label', null, 'Crop shape'), ratio), h('div', null, h('label', null, 'Maximum width'), maxw),
      range('Brightness', -100, 100, 0, (v) => (st.bright = v)), range('Contrast', -100, 100, 0, (v) => (st.contrast = v)),
      range('Quality', 50, 95, 82, (v) => (st.q = v))),
    sizeEl, h('label', null, 'Caption'), alt, go, btn('Cancel', onCancel, 'alt'));
}
