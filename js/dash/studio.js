/* Image studio: crop (move and resize the box), rotate, flip, adjust, resize, quality and format, with a live size readout.
   Runs fully in the browser; nothing is uploaded until "Apply & insert". */
import { h } from './core.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const mk = (w, h2) => { const c = document.createElement('canvas'); c.width = w; c.height = h2; return c; };
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');

function adjust(ctx, w, h2, bright, contrast) {
  if (!bright && !contrast) return;
  const img = ctx.getImageData(0, 0, w, h2), d = img.data;
  const f = (259 * (contrast + 255)) / (255 * (259 - contrast)), add = bright * 2.55;
  for (let i = 0; i < d.length; i += 4) for (let k = 0; k < 3; k++) d[i + k] = clamp(f * (d[i + k] - 128) + 128 + add, 0, 255);
  ctx.putImageData(img, 0, 0);
}

const RATIOS = [['Free', 0], ['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['3:4', 3 / 4]];
const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export async function createStudio(source, { name = 'photo', originalSize = 0, onDone, onCancel }) {
  let bmp;
  try { bmp = await createImageBitmap(source); } catch (e) { throw new Error('Could not open this photo. Use a JPG, PNG or WebP (convert iPhone HEIC photos first).'); }
  const sc0 = Math.min(1, 2800 / Math.max(bmp.width, bmp.height));
  let base = mk(Math.round(bmp.width * sc0), Math.round(bmp.height * sc0));
  base.getContext('2d').drawImage(bmp, 0, 0, base.width, base.height);
  const original = base;
  const st = { crop: { x: 0, y: 0, w: base.width, h: base.height }, ratio: 0, bright: 0, contrast: 0, width: 1200, q: 82, fmt: 'webp', comparing: false, tab: 'crop' };

  const view = mk(10, 10); view.className = 'st-canvas';
  let vs = 1, drag = null, sizeTimer = 0, last = null;
  const layout = () => { vs = Math.min(1, 720 / base.width, 440 / base.height); view.width = Math.round(base.width * vs); view.height = Math.round(base.height * vs); };

  /* ----- drawing ----- */
  function draw() {
    const ctx = view.getContext('2d'), W = view.width, H = view.height;
    ctx.clearRect(0, 0, W, H);
    if (st.comparing) { ctx.drawImage(original, 0, 0, W, H); return; }
    ctx.drawImage(base, 0, 0, W, H);
    adjust(ctx, W, H, st.bright, st.contrast);
    const c = st.crop, x = c.x * vs, y = c.y * vs, w = c.w * vs, hh = c.h * vs;
    ctx.fillStyle = 'rgba(0,0,0,.58)';
    ctx.fillRect(0, 0, W, y); ctx.fillRect(0, y + hh, W, H - y - hh); ctx.fillRect(0, y, x, hh); ctx.fillRect(x + w, y, W - x - w, hh);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1; ctx.beginPath();
    for (let i = 1; i < 3; i++) { ctx.moveTo(x + (w * i) / 3, y); ctx.lineTo(x + (w * i) / 3, y + hh); ctx.moveTo(x, y + (hh * i) / 3); ctx.lineTo(x + w, y + (hh * i) / 3); }
    ctx.stroke();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.strokeRect(x, y, w, hh);
    ctx.fillStyle = '#fff';
    handlePts().forEach(([, hx, hy]) => ctx.fillRect(hx - 5, hy - 5, 10, 10));
  }
  function handlePts() {
    const c = st.crop, x = c.x * vs, y = c.y * vs, w = c.w * vs, hh = c.h * vs, mx = x + w / 2, my = y + hh / 2;
    return [['nw', x, y], ['n', mx, y], ['ne', x + w, y], ['e', x + w, my], ['se', x + w, y + hh], ['s', mx, y + hh], ['sw', x, y + hh], ['w', x, my]];
  }

  /* ----- output ----- */
  function render() {
    const c = st.crop, sc = Math.min(1, st.width > 0 ? st.width / c.w : 1);
    const out = mk(Math.max(1, Math.round(c.w * sc)), Math.max(1, Math.round(c.h * sc)));
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(base, c.x, c.y, c.w, c.h, 0, 0, out.width, out.height);
    adjust(ctx, out.width, out.height, st.bright, st.contrast);
    return out;
  }
  async function toBlob() {
    const out = render(), q = st.q / 100;
    const enc = (type) => new Promise((r) => out.toBlob(r, type, q));
    let b, ext;
    if (st.fmt === 'png') { b = await new Promise((r) => out.toBlob(r, 'image/png')); ext = 'png'; }
    else if (st.fmt === 'jpeg') { b = await enc('image/jpeg'); ext = 'jpg'; }
    else { b = await enc('image/webp'); ext = 'webp'; if (!b || b.type !== 'image/webp') { b = await enc('image/jpeg'); ext = 'jpg'; } }
    return { blob: b, ext, w: out.width, h: out.height };
  }
  const sizeBig = h('b', null, '…'), sizeNote = h('span', { class: 'st-pill' }, ''), sizeBar = h('div', { class: 'st-barfill' }), sizeWas = h('s', null, ''), dims = h('span', { class: 'st-mono' }, '');
  const cropTag = h('span', { class: 'st-tag' }, '');
  function updSize() {
    const c = st.crop; cropTag.textContent = `${Math.round(c.w)} × ${Math.round(c.h)}`;
    clearTimeout(sizeTimer);
    sizeTimer = setTimeout(async () => {
      last = await toBlob();
      sizeBig.textContent = kb(last.blob.size); dims.textContent = `${last.w} × ${last.h} px · ${last.ext.toUpperCase()}`;
      const ref = originalSize || 0;
      sizeWas.textContent = ref ? kb(ref) : '';
      const pct = ref ? Math.round((1 - last.blob.size / ref) * 100) : null;
      sizeNote.textContent = pct == null ? (last.blob.size > 700 * 1024 ? 'Large: lower quality or width' : 'Good size') : pct > 0 ? `${pct}% smaller` : 'Larger than the original';
      sizeNote.className = 'st-pill ' + (last.blob.size > 700 * 1024 ? 'wn' : 'ok');
      sizeBar.className = 'st-barfill ' + (last.blob.size > 700 * 1024 ? 'wn' : '');
      sizeBar.style.width = Math.min(100, Math.max(3, (last.blob.size / (ref || 2 * 1048576)) * 100)) + '%';
    }, 200);
  }
  const redraw = () => { draw(); updSize(); };

  /* ----- transforms ----- */
  function transform(fn, nw, nh) { const n = mk(nw, nh); fn(n.getContext('2d')); base = n; st.crop = { x: 0, y: 0, w: nw, h: nh }; layout(); redraw(); }
  const rotate = (dir) => transform((ctx) => { ctx.translate(base.height / 2, base.width / 2); ctx.rotate((dir * Math.PI) / 2); ctx.drawImage(base, -base.width / 2, -base.height / 2); }, base.height, base.width);
  const flip = () => transform((ctx) => { ctx.translate(base.width, 0); ctx.scale(-1, 1); ctx.drawImage(base, 0, 0); }, base.width, base.height);

  /* ----- crop by pointer: move, resize by handles, or draw a new box ----- */
  const pt = (e) => { const r = view.getBoundingClientRect(); return { x: clamp((e.clientX - r.left) * (view.width / r.width), 0, view.width) / vs, y: clamp((e.clientY - r.top) * (view.height / r.height), 0, view.height) / vs }; };
  const hit = (e) => {
    const r = view.getBoundingClientRect(), px = (e.clientX - r.left) * (view.width / r.width), py = (e.clientY - r.top) * (view.height / r.height);
    for (const [id, hx, hy] of handlePts()) if (Math.abs(px - hx) < 12 && Math.abs(py - hy) < 12) return id;
    const c = st.crop; const p = pt(e);
    return p.x > c.x && p.x < c.x + c.w && p.y > c.y && p.y < c.y + c.h ? 'move' : 'new';
  };
  const CUR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move', new: 'crosshair' };
  const MIN = 24;
  function applyDrag(p) {
    const d = drag, o = d.orig, W = base.width, H = base.height;
    if (d.mode === 'move') { st.crop = { x: clamp(o.x + (p.x - d.start.x), 0, W - o.w), y: clamp(o.y + (p.y - d.start.y), 0, H - o.h), w: o.w, h: o.h }; return; }
    let l = o.x, t = o.y, r = o.x + o.w, b = o.y + o.h;
    if (d.mode === 'new') { l = r = d.start.x; t = b = d.start.y; }
    const m = d.mode === 'new' ? 'se' : d.mode;
    if (m.includes('w')) l = clamp(p.x, 0, r - MIN); if (m.includes('e')) r = clamp(p.x, l + MIN, W);
    if (m.includes('n')) t = clamp(p.y, 0, b - MIN); if (m.includes('s')) b = clamp(p.y, t + MIN, H);
    if (d.mode === 'new') { l = Math.min(d.start.x, p.x); r = Math.max(d.start.x, p.x); t = Math.min(d.start.y, p.y); b = Math.max(d.start.y, p.y); }
    if (st.ratio) {
      let w = r - l, hh = b - t;
      if (m === 'n' || m === 's') w = hh * st.ratio; else hh = w / st.ratio;
      if (d.mode === 'new' || m.length === 2 || m === 'e' || m === 'w' || m === 'n' || m === 's') {
        if (m.includes('w')) l = r - w; else if (m.includes('e') || d.mode === 'new') r = l + w; else { const cx = (l + r) / 2; l = cx - w / 2; r = cx + w / 2; }
        if (m.includes('n')) t = b - hh; else if (m.includes('s') || d.mode === 'new') b = t + hh; else { const cy = (t + b) / 2; t = cy - hh / 2; b = cy + hh / 2; }
      }
      if (l < 0) { const k = -l; l = 0; r = Math.min(W, r + k); } if (t < 0) { const k = -t; t = 0; b = Math.min(H, b + k); }
      if (r > W || b > H) { const sc = Math.min(W - l, (H - t) * st.ratio) / (r - l); r = l + (r - l) * sc; b = t + (b - t) * sc; }
    }
    st.crop = { x: l, y: t, w: Math.max(MIN, r - l), h: Math.max(MIN, b - t) };
  }
  view.addEventListener('pointermove', (e) => {
    if (st.comparing) return;
    if (!drag) { view.style.cursor = CUR[hit(e)]; return; }
    applyDrag(pt(e)); draw();
  });
  view.addEventListener('pointerdown', (e) => {
    if (st.comparing) return;
    view.setPointerCapture(e.pointerId);
    drag = { mode: hit(e), start: pt(e), orig: { ...st.crop } };
    e.preventDefault();
  });
  const end = () => { if (!drag) return; drag = null; updSize(); };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);

  /* ----- some helpers for the side panel ----- */
  const chip = (label, on, fn) => { const b = h('button', { type: 'button', class: 'st-chip' + (on ? ' on' : '') }, label); b.addEventListener('click', fn); return b; };
  const sbtn = (label, fn, cls = '') => { const b = h('button', { type: 'button', class: 'btn ' + cls }, label); b.addEventListener('click', fn); return b; };
  const slider = (label, min, max, val, fmt, fn) => {
    const r = h('input', { type: 'range', min, max, value: val, 'aria-label': label, class: 'st-range' }), out = h('span', { class: 'st-mono' }, fmt(val));
    const paintFill = () => { r.style.setProperty('--p', ((r.value - min) / (max - min)) * 100 + '%'); };
    r.addEventListener('input', () => { out.textContent = fmt(+r.value); paintFill(); fn(+r.value); });
    paintFill();
    return { el: h('div', { class: 'st-field' }, h('div', { class: 'st-lab' }, h('span', null, label), out), r), set(v) { r.value = v; out.textContent = fmt(v); paintFill(); } };
  };

  const ratioRow = h('div', { class: 'st-row' });
  const paintRatios = () => { ratioRow.replaceChildren(...RATIOS.map(([t, v]) => chip(t, st.ratio === v, () => { st.ratio = v; if (v) fitRatio(); paintRatios(); redraw(); }))); };
  function fitRatio() {
    const c = st.crop, cx = c.x + c.w / 2, cy = c.y + c.h / 2; let w = c.w, hh = w / st.ratio;
    if (hh > base.height) { hh = base.height; w = hh * st.ratio; } if (w > base.width) { w = base.width; hh = w / st.ratio; }
    st.crop = { x: clamp(cx - w / 2, 0, base.width - w), y: clamp(cy - hh / 2, 0, base.height - hh), w, h: hh };
  }
  paintRatios();

  const bright = slider('Brightness', -100, 100, 0, (v) => String(v), (v) => { st.bright = v; draw(); updSize(); });
  const contrast = slider('Contrast', -100, 100, 0, (v) => String(v), (v) => { st.contrast = v; draw(); updSize(); });
  const quality = slider('Quality', 40, 95, st.q, (v) => v + '%', (v) => { st.q = v; updSize(); });
  const wInput = h('input', { type: 'text', inputmode: 'numeric', value: String(st.width), 'aria-label': 'Width in pixels', class: 'st-num' });
  const wRow = h('div', { class: 'st-row' }), fmtRow = h('div', { class: 'st-seg' });
  const paintW = () => wRow.replaceChildren(...[[800, '800'], [1200, '1200'], [1600, '1600'], [0, 'Original']].map(([v, t]) => chip(t, st.width === v, () => { st.width = v; wInput.value = v ? String(v) : 'Original'; paintW(); updSize(); })));
  wInput.addEventListener('input', () => { const n = parseInt(wInput.value.replace(/\D/g, ''), 10); if (n >= 16) { st.width = Math.min(n, 4000); paintW(); updSize(); } });
  paintW();
  const paintFmt = () => fmtRow.replaceChildren(...[['webp', 'WebP'], ['jpeg', 'JPEG'], ['png', 'PNG']].map(([v, t]) => { const b = h('button', { type: 'button', class: st.fmt === v ? 'on' : '' }, t); b.addEventListener('click', () => { st.fmt = v; paintFmt(); updSize(); }); return b; }));
  paintFmt();

  const compare = h('button', { type: 'button', class: 'btn st-compare' }, 'Hold to compare');
  const cmp = (on) => { st.comparing = on; compare.classList.toggle('on', on); draw(); };
  compare.addEventListener('pointerdown', () => cmp(true)); ['pointerup', 'pointerleave', 'pointercancel', 'blur'].forEach((ev) => compare.addEventListener(ev, () => st.comparing && cmp(false)));

  const alt = h('input', { type: 'text', placeholder: 'Caption (also used as alt text)', 'aria-label': 'Caption', autocomplete: 'off', class: 'st-cap' });

  const panels = {
    crop: h('div', { class: 'st-panel' }, h('div', { class: 'st-lab' }, h('span', null, 'SHAPE')), ratioRow,
      h('div', { class: 'st-lab' }, h('span', null, 'ROTATE AND FLIP')), h('div', { class: 'st-row' }, sbtn('Rotate left', () => rotate(-1)), sbtn('Rotate right', () => rotate(1)), sbtn('Flip', flip)),
      h('p', { class: 'muted' }, 'Drag inside the box to move it. Drag a corner or an edge to resize it. Drag outside to draw a new box.'),
      sbtn('Reset crop', () => { st.crop = { x: 0, y: 0, w: base.width, h: base.height }; st.ratio = 0; paintRatios(); redraw(); })),
    adjust: h('div', { class: 'st-panel' }, bright.el, contrast.el, sbtn('Reset adjustments', () => { st.bright = st.contrast = 0; bright.set(0); contrast.set(0); redraw(); })),
    size: h('div', { class: 'st-panel' },
      h('div', { class: 'st-lab' }, h('span', null, 'WIDTH (PX)')), wInput, wRow,
      quality.el,
      h('div', { class: 'st-lab' }, h('span', null, 'FORMAT')), fmtRow,
      h('div', { class: 'st-sum' }, h('div', { class: 'st-sumtop' }, sizeWas, sizeBig, sizeNote), h('div', { class: 'st-bar' }, sizeBar), dims, compare)),
  };
  const tabs = h('div', { class: 'st-tabs', role: 'tablist' });
  const body = h('div', { class: 'st-side-body' });
  const showTab = (t) => {
    st.tab = t; body.replaceChildren(panels[t]);
    tabs.replaceChildren(...[['crop', 'Crop'], ['adjust', 'Adjust'], ['size', 'Size & quality']].map(([k, l]) => { const b = h('button', { type: 'button', role: 'tab', 'aria-selected': String(k === t), class: k === t ? 'on' : '' }, l); b.addEventListener('click', () => showTab(k)); return b; }));
  };
  showTab('crop');

  const go = sbtn('Apply & insert', async () => {
    go.disabled = true;
    try { const r = last || (await toBlob()); await onDone(r.blob, r.ext, alt.value.replace(/[\[\]\n]/g, ' ').trim()); } finally { go.disabled = false; }
  }, 'primary');

  layout(); draw(); updSize();
  return h('div', { class: 'studio' },
    h('div', { class: 'st-stage' },
      h('div', { class: 'st-meta' }, h('span', { class: 'st-mono' }, `${name} · ${bmp.width} × ${bmp.height}${originalSize ? ' · ' + kb(originalSize) : ''}`), cropTag),
      h('div', { class: 'st-canvaswrap' }, view),
      h('div', { class: 'st-hint' }, 'Tip: hold "Hold to compare" in the Size & quality tab to see the original.')),
    h('div', { class: 'st-side' }, tabs, body,
      h('div', { class: 'st-foot' }, alt, h('div', { class: 'st-actions' }, sbtn('Cancel', onCancel), go))));
}
