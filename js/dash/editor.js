/* Visual (WYSIWYG) blog editor. The post is still stored as Markdown; this editor shows it the way the site shows it,
   and turns what you type back into Markdown. Content is rendered with the same safe renderer the website uses. */
import { h, clear } from './core.js';
import { icon, promptBox } from './ui.js';
import { renderMarkdown } from '../md.js';

const FXS = ['display', 'mono', 'big', 'small'];
const BLOCK = new Set(['P', 'DIV', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'PRE', 'HR', 'FIGURE']);

/* ---------- DOM -> Markdown ---------- */
function inl(node) {
  let out = '';
  node.childNodes.forEach((c) => {
    if (c.nodeType === 3) { out += c.nodeValue.replace(/ /g, ' ').replace(/\s*\n\s*/g, ' '); return; }
    if (c.nodeType !== 1) return;
    const t = c.tagName, inner = inl(c);
    if (t === 'BR') out += ' ';
    else if (!inner.trim() && !/^(IMG)$/.test(t)) out += inner;
    else if (t === 'B' || t === 'STRONG') out += `**${inner}**`;
    else if (t === 'I' || t === 'EM') out += `*${inner}*`;
    else if (t === 'U') out += `++${inner}++`;
    else if (t === 'S' || t === 'STRIKE' || t === 'DEL') out += `~~${inner}~~`;
    else if (t === 'MARK') out += `==${inner}==`;
    else if (t === 'CODE') out += '`' + c.textContent.replace(/`/g, "'") + '`';
    else if (t === 'A') { const href = c.getAttribute('href') || ''; out += /^(https?:\/\/|mailto:)\S+$/i.test(href) ? `[${inner.replace(/[\[\]]/g, '')}](${href})` : inner; }
    else if (t === 'SPAN') { const fx = FXS.find((f) => c.classList.contains('fx-' + f)); out += fx ? `{{${fx}: ${inner.replace(/[{}]/g, '')}}}` : inner; }
    else out += inner;
  });
  return out;
}
function blocks(root) {
  const out = [];
  const flushInline = (nodes) => { const tmp = document.createElement('div'); nodes.forEach((n) => tmp.appendChild(n.cloneNode(true))); const s = inl(tmp).trim(); if (s) out.push(s); };
  let run = [];
  root.childNodes.forEach((n) => {
    const isBlock = n.nodeType === 1 && (BLOCK.has(n.tagName));
    if (!isBlock) { run.push(n); return; }
    if (run.length) { flushInline(run); run = []; }
    const t = n.tagName;
    if (t === 'P' || (t === 'DIV' && !n.dataset.yt && !n.querySelector('p,div,ul,ol,h2,h3,h4,figure'))) { const s = inl(n).trim(); if (s) out.push((n.classList.contains('center') ? ':: ' : '') + s); }
    else if (/^H[1-6]$/.test(t)) { const lvl = Math.min(3, Math.max(1, +t[1] - 1)); const s = inl(n).trim(); if (s) out.push('#'.repeat(lvl) + ' ' + s); }
    else if (t === 'UL' || t === 'OL') { let i = 0; const lines = []; n.querySelectorAll(':scope > li').forEach((li) => { const s = inl(li).trim(); if (s) lines.push(t === 'UL' ? `- ${s}` : `${++i}. ${s}`); }); if (lines.length) out.push(lines.join('\n')); }
    else if (t === 'BLOCKQUOTE') { const s = inl(n).trim(); if (s) out.push('> ' + s); }
    else if (t === 'PRE') out.push('```\n' + n.textContent.replace(/\n$/, '') + '\n```');
    else if (t === 'HR') out.push('---');
    else if (t === 'FIGURE') {
      const img = n.querySelector('img'), path = img && img.dataset.path;
      if (path) { const cap = (n.querySelector('figcaption') || { textContent: '' }).textContent.replace(/[\[\]\n]/g, ' ').trim(); const wp = parseInt(n.dataset.w, 10); out.push(`![${cap}](${path})${wp && wp < 100 ? `{w=${wp}}` : ''}`); }
    } else if (t === 'DIV' && n.dataset.yt) out.push(`@[youtube](${n.dataset.yt})`);
    else out.push(...blocks(n));
  });
  if (run.length) flushInline(run);
  return out;
}
export const toMarkdown = (root) => blocks(root).join('\n\n');

/* ---------- editor ---------- */
export function createVisualEditor({ markdown, base = '../', resolve, onChange, onPhoto, onEditPhoto, onLibrary, toast }) {
  const ed = h('div', { class: 've prose', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Post body', spellcheck: 'true' });
  const src = h('textarea', { class: 'src', 'aria-label': 'Markdown source', spellcheck: 'false' });
  let sourceMode = false, figUi = null, selFig = null, menu = null, anchor = null;

  const prep = () => {
    ed.querySelectorAll('figure').forEach((f) => {
      f.setAttribute('contenteditable', 'false');
      let c = f.querySelector('figcaption');
      if (!c) { c = document.createElement('figcaption'); f.appendChild(c); }
      c.setAttribute('contenteditable', 'true'); c.setAttribute('data-ph', 'Add a caption');
    });
    ed.querySelectorAll('figure img').forEach((i) => { i.draggable = false; });
    ed.querySelectorAll('.video').forEach((v) => { v.setAttribute('contenteditable', 'false'); if (!v.querySelector('.vshield')) v.appendChild(h('div', { class: 'vshield', title: 'Click to select, drag to move' })); });
    if (!ed.firstChild || !ed.lastChild || ed.lastChild.nodeName !== 'P') ed.appendChild(h('p', null, h('br')));
  };
  const load = (md) => { menu = null; figUi = null; selFig = null; clear(ed); ed.appendChild(renderMarkdown(md, { base, resolve })); prep(); };
  const emit = () => onChange(toMarkdown(ed));
  load(markdown);
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch (e) { /* ignore */ }

  ed.addEventListener('input', emit);
  ed.addEventListener('paste', (e) => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
  ed.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  ed.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); onPhoto(f); } });
  /* ----- selecting a picture: resize handles and a small toolbar ----- */
  function deselect() {
    if (figUi) { figUi.remove(); figUi = null; }
    ed.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel')); selFig = null;
  }
  const setWidth = (fig, pct) => {
    pct = Math.round(Math.min(100, Math.max(10, pct)));
    if (pct >= 100) { delete fig.dataset.w; fig.style.removeProperty('width'); } else { fig.dataset.w = String(pct); fig.style.width = pct + '%'; fig.style.marginLeft = fig.style.marginRight = 'auto'; }
    placeUi(); emit();
  };
  function placeUi() {
    if (!figUi || !selFig) return;
    const img = selFig.querySelector('img'); if (!img) return;
    figUi.style.height = img.offsetHeight + 'px';
    const wpx = Math.round(img.getBoundingClientRect().width), nat = img.naturalWidth;
    figUi.querySelector('.fig-badge').textContent = `${wpx} px wide · ${selFig.dataset.w || 100}%${nat ? ' · photo ' + nat + ' px' : ''}`;
    figUi.querySelectorAll('.fig-sz').forEach((b) => b.classList.toggle('on', (+(selFig.dataset.w || 100)) === +b.dataset.pct));
  }
  function startResize(e, side) {
    e.preventDefault(); e.stopPropagation();
    const fig = selFig, hd = e.currentTarget, cs = getComputedStyle(ed);
    const edW = ed.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const startW = fig.getBoundingClientRect().width, x0 = e.clientX, dir = side.includes('w') ? -1 : 1;
    try { hd.setPointerCapture(e.pointerId); } catch (er) { /* ignore */ }
    fig.classList.add('resizing');
    const mv = (ev) => setWidthLive(fig, ((startW + dir * (ev.clientX - x0) * 2) / edW) * 100);
    const up = () => { hd.removeEventListener('pointermove', mv); hd.removeEventListener('pointerup', up); hd.removeEventListener('pointercancel', up); fig.classList.remove('resizing'); emit(); };
    hd.addEventListener('pointermove', mv); hd.addEventListener('pointerup', up); hd.addEventListener('pointercancel', up);
  }
  function setWidthLive(fig, pct) {
    pct = Math.round(Math.min(100, Math.max(10, pct)));
    if (pct >= 100) { delete fig.dataset.w; fig.style.removeProperty('width'); } else { fig.dataset.w = String(pct); fig.style.width = pct + '%'; fig.style.marginLeft = fig.style.marginRight = 'auto'; }
    placeUi();
  }
  function selectFig(fig) {
    deselect(); selFig = fig; fig.classList.add('sel');
    if (fig.tagName !== 'FIGURE') return;
    const tb = (label, fn, cls = '') => { const b = h('button', { type: 'button', class: 'fig-btn ' + cls }, label); b.addEventListener('mousedown', (ev) => ev.preventDefault()); b.addEventListener('click', (ev) => { ev.stopPropagation(); fn(); }); return b; };
    const sizes = [[50, 'Small'], [75, 'Medium'], [100, 'Full']].map(([v, l]) => { const b = tb(l, () => setWidth(fig, v), 'fig-sz'); b.dataset.pct = String(v); return b; });
    const bar = h('div', { class: 'fig-bar', role: 'toolbar', 'aria-label': 'Picture' }, ...sizes, h('span', { class: 'tsep' }),
      tb('Edit photo', () => onEditPhoto && onEditPhoto(fig.querySelector('img'), fig)), tb('Replace', () => onPhoto(null, fig)), h('span', { class: 'tsep' }),
      tb('Delete', () => { deselect(); fig.remove(); prep(); emit(); }, 'danger'));
    figUi = h('div', { class: 'fig-ui', contenteditable: 'false' }, bar, h('div', { class: 'fig-badge' }),
      ...['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((sd) => { const hd = h('div', { class: 'fig-h fig-' + sd }); hd.addEventListener('pointerdown', (ev) => startResize(ev, sd === 'n' || sd === 's' ? 'e' : sd)); return hd; }));
    fig.appendChild(figUi); placeUi();
  }
  ed.addEventListener('click', (e) => {
    const fig = e.target.closest && e.target.closest('figure, .video');
    if (fig && !e.target.closest('figcaption') && !e.target.closest('.fig-ui')) selectFig(fig);
    else if (!e.target.closest('.fig-ui')) deselect();
    plusUpdate();
  });
  window.addEventListener('resize', placeUi);
  ed.addEventListener('keydown', (e) => {
    const sel = ed.querySelector('.sel');
    if (menu && menuKey(e)) return;
    if (sel && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); deselect(); sel.remove(); prep(); emit(); return; }
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'u') { e.preventDefault(); cmd('underline'); }
  });

  /* helpers */
  const rangeNow = () => { const s = getSelection(); return s.rangeCount && ed.contains(s.anchorNode) ? s.getRangeAt(0) : null; };
  const topBlock = (node) => { let n = node; while (n && n.parentNode !== ed) n = n.parentNode; return n; };
  const focusEnd = () => { ed.focus(); const r = document.createRange(); r.selectNodeContents(ed.lastChild); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); };
  function cmd(c, v) { ed.focus(); document.execCommand(c, false, v); emit(); refreshState(); }
  function toggleWrap(tag, cls) {
    const r = rangeNow(); if (!r) { ed.focus(); return toast('Select some text first.', 'warn'); }
    const anc = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode;
    const existing = anc.closest && anc.closest(cls ? `${tag}.${cls}` : tag);
    if (existing && ed.contains(existing)) { const p = existing.parentNode; while (existing.firstChild) p.insertBefore(existing.firstChild, existing); existing.remove(); emit(); return; }
    if (r.collapsed) return toast('Select some text first.', 'warn');
    if (topBlock(r.startContainer) !== topBlock(r.endContainer)) return toast('Select text inside one paragraph for this style.', 'warn');
    const el = document.createElement(tag); if (cls) el.className = cls;
    el.appendChild(r.extractContents()); r.insertNode(el);
    const s = getSelection(); s.removeAllRanges(); const nr = document.createRange(); nr.selectNodeContents(el); s.addRange(nr); emit();
  }
  function insertBlockEl(node) {
    const r = rangeNow(); let ref = anchor && anchor.isConnected ? anchor : (r ? topBlock(r.endContainer) : ed.lastChild); anchor = null;
    if (ref && ref.nodeName === 'P' && !ref.textContent.trim() && ref.parentNode === ed) { ed.replaceChild(node, ref); } else ed.insertBefore(node, ref ? ref.nextSibling : null);
    prep();
    const nxt = node.nodeName === 'PRE' ? node.firstChild : node.nextSibling;
    if (nxt && node.nodeName !== 'FIGURE' && !node.classList.contains('video')) { const rg = document.createRange(); rg.selectNodeContents(nxt); rg.collapse(true); const sl = getSelection(); ed.focus(); sl.removeAllRanges(); sl.addRange(rg); }
    emit();
  }
  const fmtBlock = (tag) => { const r = rangeNow(); const cur = r && topBlock(r.startContainer); const same = cur && cur.nodeName === tag.toUpperCase(); cmd('formatBlock', same ? 'p' : tag); };
  function link() {
    const r = rangeNow(); if (!r) { ed.focus(); return toast('Select the words to link first.', 'warn'); }
    const saved = r.cloneRange();
    promptBox('Add link', 'Address (https://…)', 'https://').then((u) => {
      if (!u) return; if (!/^https?:\/\/\S+$/i.test(u)) return toast('Links must start with https:// or http://', 'warn');
      ed.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(saved); cmd('createLink', u);
    });
  }
  function addVideo() {
    promptBox('Add YouTube video', 'YouTube link', 'https://').then((u) => {
      if (!u) return; const m = /^(?:https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/))?([A-Za-z0-9_-]{11})(?:[?&#\/]\S*)?$/.exec(u);
      if (!m) return toast('That does not look like a YouTube link.', 'warn');
      const box = renderMarkdown(`@[youtube](${m[1]})`).firstChild; insertBlockEl(box);
    });
  }

  /* ----- drag a block (picture, video, paragraph...) to a new place ----- */
  const dropLine = h('div', { class: 'drop-line', hidden: true });
  function startMove(blk, e0) {
    deselectUi();
    root.appendChild(dropLine); dropLine.hidden = false; blk.classList.add('moving'); root.classList.add('is-moving');
    let target = blk.nextSibling;
    const scroller = document.querySelector('.main');
    const mv = (e) => {
      const kids = [...ed.children].filter((k) => k !== blk); let before = null;
      for (const k of kids) { const r = k.getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) { before = k; break; } }
      target = before;
      const rr = root.getBoundingClientRect(), last = kids[kids.length - 1];
      const y = before ? before.getBoundingClientRect().top - 4 : (last ? last.getBoundingClientRect().bottom + 4 : rr.top);
      dropLine.style.top = (y - rr.top) + 'px';
      if (scroller) { if (e.clientY < 110) scroller.scrollTop -= 14; else if (e.clientY > innerHeight - 90) scroller.scrollTop += 14; }
    };
    const up = () => {
      document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
      dropLine.hidden = true; blk.classList.remove('moving'); root.classList.remove('is-moving');
      if (target !== blk.nextSibling && target !== blk) { ed.insertBefore(blk, target); prep(); emit(); if (blk.tagName === 'FIGURE') selectFig(blk); }
    };
    document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
    mv(e0);
  }
  function deselectUi() { if (figUi) { figUi.remove(); figUi = null; } }
  ed.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || !e.target.closest) return;
    const hitEl = e.target.closest('figure img, .video');
    if (!hitEl || e.target.closest('.fig-ui')) return;
    const blk = hitEl.closest('figure, .video'), x0 = e.clientX, y0 = e.clientY;
    const clean = () => { document.removeEventListener('pointermove', pm); document.removeEventListener('pointerup', clean); };
    const pm = (ev) => { if (Math.hypot(ev.clientX - x0, ev.clientY - y0) > 6) { clean(); startMove(blk, ev); } };
    document.addEventListener('pointermove', pm); document.addEventListener('pointerup', clean);
  });
  /* grip shown at the left of whichever block the mouse is over */
  const grip = h('button', { type: 'button', class: 'blk-grip', 'aria-label': 'Drag to move this block', title: 'Drag to move', hidden: true }, icon('grip', 16));
  let gripBlk = null;
  ed.addEventListener('mousemove', (e) => {
    if (sourceMode || root.classList.contains('is-moving')) return;
    let n = e.target; while (n && n.parentNode !== ed) n = n.parentNode;
    if (!n || n === gripBlk) return;
    if (n.nodeName === 'P' && !n.textContent.trim()) { grip.hidden = true; gripBlk = null; return; }
    gripBlk = n; const rr = root.getBoundingClientRect(), br = n.getBoundingClientRect();
    grip.hidden = false; grip.style.top = (br.top - rr.top + 6) + 'px'; grip.style.left = '14px';
  });
  const hideGrip = () => { if (!root.classList.contains('is-moving')) { grip.hidden = true; gripBlk = null; } };
  grip.addEventListener('pointerdown', (e) => { if (e.button !== 0 || !gripBlk) return; e.preventDefault(); const b2 = gripBlk; grip.hidden = true; startMove(b2, e); });
  document.addEventListener('pointerup', () => { gripBlk = null; });

  /* ----- bubble toolbar over selected text ----- */
  const keepAnchor = () => { const r = rangeNow(); anchor = r ? topBlock(r.endContainer) : null; };
  const clampN = (v, a, b2) => Math.max(a, Math.min(b2, v));
  const bubbleStates = [];
  const bb = (label, title, fn, st, cls = '') => {
    const el = h('button', { type: 'button', class: 'bb ' + cls, title, 'aria-label': title }, label);
    el.addEventListener('mousedown', (e) => e.preventDefault()); el.addEventListener('click', fn);
    if (st) bubbleStates.push([el, st]); return el;
  };
  const bubble = h('div', { class: 'bubble', role: 'toolbar', 'aria-label': 'Text formatting', hidden: true },
    bb('B', 'Bold', () => cmd('bold'), () => document.queryCommandState('bold'), 'b-b'), bb('I', 'Italic', () => cmd('italic'), () => document.queryCommandState('italic'), 'b-i'),
    bb('U', 'Underline', () => cmd('underline'), () => document.queryCommandState('underline'), 'b-u'), bb('S', 'Strikethrough', () => cmd('strikeThrough'), () => document.queryCommandState('strikeThrough'), 'b-s'),
    h('span', { class: 'tsep' }), bb('H2', 'Big heading', () => fmtBlock('h2')), bb('Link', 'Link', link), bb('Highlight', 'Highlight', () => toggleWrap('mark')));
  function bubbleUpdate() {
    const r = rangeNow();
    const anc = r && (r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentNode);
    if (!r || r.collapsed || sourceMode || (anc.closest && anc.closest('figure, .video'))) { bubble.hidden = true; return; }
    const rc = r.getBoundingClientRect(), rr = root.getBoundingClientRect();
    bubble.hidden = false;
    bubble.style.left = clampN(rc.left - rr.left + rc.width / 2 - bubble.offsetWidth / 2, 8, Math.max(8, rr.width - bubble.offsetWidth - 8)) + 'px';
    bubble.style.top = Math.max(50, rc.top - rr.top - bubble.offsetHeight - 10) + 'px';
    bubbleStates.forEach(([el, st]) => { let on = false; try { on = st(); } catch (e) { /* ignore */ } el.classList.toggle('on', on); });
  }

  /* ----- "+" button and block menu ("/" also opens it) ----- */
  const curEmpty = () => { const r = rangeNow(); const b2 = r && topBlock(r.startContainer); return b2 && b2.parentNode === ed && b2.nodeName === 'P' && !b2.textContent.trim() ? b2 : null; };
  const plus = h('button', { type: 'button', class: 'plus', title: 'Add a block (or type /)', 'aria-label': 'Add a block', hidden: true }, '+');
  plus.addEventListener('mousedown', (e) => e.preventDefault());
  plus.addEventListener('click', () => { const b2 = curEmpty(); if (b2) openMenu('', b2, false); });
  function plusUpdate() {
    const b2 = !sourceMode && curEmpty();
    if (!b2) { plus.hidden = true; return; }
    const rr = root.getBoundingClientRect(), br = b2.getBoundingClientRect();
    plus.hidden = false; plus.style.top = (br.top - rr.top + 4) + 'px'; plus.style.left = '12px';
  }
  const fmtAt = (b2, f) => { const rg = document.createRange(); rg.selectNodeContents(b2); rg.collapse(true); const sl = getSelection(); sl.removeAllRanges(); sl.addRange(rg); ed.focus(); f(); };
  const ITEMS = [
    ['Media', 'Image', 'Upload, crop, resize', 'image', (b2) => { anchor = b2; onPhoto(null); }],
    ['Media', 'Photo library', 'Use an uploaded photo', 'folder', (b2) => { anchor = b2; onLibrary(); }],
    ['Media', 'Video', 'YouTube link', '▶', (b2) => { anchor = b2; addVideo(); }],
    ['Text', 'Heading', 'Big section title', 'H2', (b2) => fmtAt(b2, () => cmd('formatBlock', 'h2'))],
    ['Text', 'Subheading', 'Smaller title', 'H3', (b2) => fmtAt(b2, () => cmd('formatBlock', 'h3'))],
    ['Text', 'Bullet list', 'Simple points', '•', (b2) => fmtAt(b2, () => cmd('insertUnorderedList'))],
    ['Text', 'Numbered list', 'Steps in order', '1.', (b2) => fmtAt(b2, () => cmd('insertOrderedList'))],
    ['Text', 'Quote', 'Pull out a line', '❝', (b2) => fmtAt(b2, () => cmd('formatBlock', 'blockquote'))],
    ['More', 'Code block', 'Monospace snippet', 'code', (b2) => { anchor = b2; insertBlockEl(h('pre', null, h('code', null, h('br')))); }],
    ['More', 'Divider', 'Horizontal line', '—', (b2) => { anchor = b2; insertBlockEl(document.createElement('hr')); }],
  ];
  function openMenu(filter, blk, slash) {
    closeMenu();
    menu = { blk, filter, sel: 0, slash, el: h('div', { class: 'blockmenu', role: 'listbox', 'aria-label': 'Add a block' }) };
    root.appendChild(menu.el); paintMenu(); placeMenu();
  }
  function placeMenu() {
    if (!menu) return;
    const rr = root.getBoundingClientRect(), br = menu.blk.getBoundingClientRect();
    menu.el.style.left = '12px'; menu.el.style.top = (br.bottom - rr.top + 8) + 'px';
  }
  const shownItems = () => ITEMS.filter((it) => (it[1] + ' ' + it[2]).toLowerCase().includes(menu.filter.toLowerCase()));
  function paintMenu() {
    const items = shownItems(); menu.sel = Math.min(menu.sel, Math.max(0, items.length - 1));
    clear(menu.el);
    if (!items.length) { menu.el.appendChild(h('p', { class: 'muted bm-none' }, 'No block matches. Keep typing, or press Esc.')); return; }
    let g = '';
    items.forEach((it, i) => {
      if (it[0] !== g) { g = it[0]; menu.el.appendChild(h('div', { class: 'bm-group' }, g)); }
      const ic = ['image', 'folder', 'code'].includes(it[3]) ? icon(it[3], 18) : h('span', { class: 'bm-glyph' }, it[3]);
      const b2 = h('button', { type: 'button', class: 'bm-item' + (i === menu.sel ? ' on' : ''), role: 'option' }, h('span', { class: 'bm-ic' }, ic), h('span', { class: 'bm-tx' }, h('b', null, it[1]), h('small', null, it[2])));
      b2.addEventListener('mousedown', (e) => e.preventDefault()); b2.addEventListener('click', () => choose(it));
      menu.el.appendChild(b2);
    });
  }
  function closeMenu() { if (menu && menu.el) menu.el.remove(); menu = null; }
  function choose(it) {
    const blk = menu.blk; closeMenu();
    if (blk.isConnected) { blk.innerHTML = ''; blk.appendChild(h('br')); }
    it[4](blk);
  }
  function menuKey(e) {
    if (!menu) return false;
    const items = shownItems();
    if (e.key === 'ArrowDown') { e.preventDefault(); menu.sel = (menu.sel + 1) % Math.max(1, items.length); paintMenu(); return true; }
    if (e.key === 'ArrowUp') { e.preventDefault(); menu.sel = (menu.sel - 1 + items.length) % Math.max(1, items.length); paintMenu(); return true; }
    if (e.key === 'Enter') { if (items[menu.sel]) { e.preventDefault(); choose(items[menu.sel]); return true; } closeMenu(); return false; }
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return true; }
    return false;
  }
  ed.addEventListener('input', () => {
    const r = rangeNow(); const b2 = r && topBlock(r.startContainer);
    if (b2 && b2.parentNode === ed && b2.nodeName === 'P' && /^\/[\w ]{0,20}$/.test(b2.textContent)) {
      const f = b2.textContent.slice(1);
      if (menu) { menu.blk = b2; menu.filter = f; paintMenu(); placeMenu(); } else openMenu(f, b2, true);
    } else if (menu && menu.slash) closeMenu();
    plusUpdate();
  });
  const outside = (e) => { if (menu && !e.target.closest('.blockmenu, .plus')) closeMenu(); };
  document.addEventListener('pointerdown', outside);

  /* toolbar */
  const tbs = [];
  const b = (name, label, title, fn, state) => {
    const el = h('button', { type: 'button', class: 'tb', title, 'aria-label': title }, name ? icon(name, 16) : null, label ? h('span', null, label) : null);
    el.addEventListener('mousedown', (e) => e.preventDefault()); el.addEventListener('click', fn);
    if (state) tbs.push([el, state]); return el;
  };
  const sep = () => h('span', { class: 'tsep' });
  const fx = h('select', { class: 'tb-sel', 'aria-label': 'Font style' }, h('option', { value: '' }, 'Font…'), h('option', { value: 'display' }, 'Comic'), h('option', { value: 'mono' }, 'Code font'), h('option', { value: 'big' }, 'Big'), h('option', { value: 'small' }, 'Small'));
  fx.addEventListener('mousedown', () => { saveSel = rangeNow() && rangeNow().cloneRange(); });
  fx.addEventListener('change', () => { if (fx.value) { if (saveSel) { ed.focus(); const s = getSelection(); s.removeAllRanges(); s.addRange(saveSel); } toggleWrap('span', 'fx-' + fx.value); } fx.value = ''; });
  let saveSel = null;
  const toolbar = h('div', { class: 'tools', role: 'toolbar', 'aria-label': 'Formatting' },
    b(null, 'B', 'Bold (Ctrl+B)', () => cmd('bold'), () => document.queryCommandState('bold')),
    b(null, 'I', 'Italic (Ctrl+I)', () => cmd('italic'), () => document.queryCommandState('italic')),
    b(null, 'U', 'Underline (Ctrl+U)', () => cmd('underline'), () => document.queryCommandState('underline')),
    b(null, 'S', 'Strikethrough', () => cmd('strikeThrough'), () => document.queryCommandState('strikeThrough')),
    b(null, 'Mark', 'Highlight', () => toggleWrap('mark')), fx, sep(),
    b(null, 'H2', 'Big heading', () => fmtBlock('h2')), b(null, 'H3', 'Small heading', () => fmtBlock('h3')), sep(),
    b(null, '• List', 'Bullet list', () => cmd('insertUnorderedList')), b(null, '1. List', 'Numbered list', () => cmd('insertOrderedList')),
    b(null, '❝', 'Quote', () => fmtBlock('blockquote')),
    b(null, 'Center', 'Centre the paragraph', () => { const r = rangeNow(); const blk = r && topBlock(r.startContainer); if (blk && blk.nodeName === 'P') { blk.classList.toggle('center'); emit(); } }),
    b('link', '', 'Link', link), b(null, 'Code', 'Code', () => toggleWrap('code')),
    h('span', { class: 'grow' }),
    b('code', 'Source', 'Switch between visual and Markdown source', () => toggleSource()));
  function refreshState() { tbs.forEach(([el, st]) => { let on = false; try { on = rangeNow() ? st() : false; } catch (e) { /* ignore */ } el.classList.toggle('on', on); }); }
  const onSel = () => { refreshState(); bubbleUpdate(); plusUpdate(); };
  document.addEventListener('selectionchange', onSel);

  function toggleSource() {
    sourceMode = !sourceMode;
    if (sourceMode) { src.value = toMarkdown(ed); ed.hidden = true; src.hidden = false; src.focus(); }
    else { load(src.value); onChange(src.value); src.hidden = true; ed.hidden = false; ed.focus(); }
    root.classList.toggle('source', sourceMode);
  }
  src.hidden = true;
  src.addEventListener('input', () => onChange(src.value));

  const root = h('div', { class: 've-wrap' }, toolbar, ed, src, bubble, plus, grip, dropLine);
  root.addEventListener('mouseleave', hideGrip);
  return {
    el: root,
    insertPhoto(path, alt) { if (sourceMode) { src.value += `\n\n![${alt || ''}](${path})\n`; onChange(src.value); return; } insertBlockEl(renderMarkdown(`![${alt || ''}](${path})`, { base, resolve }).firstChild); },
    markdown: () => (sourceMode ? src.value : toMarkdown(ed)),
    destroy() { document.removeEventListener('selectionchange', onSel); document.removeEventListener('pointerdown', outside); window.removeEventListener('resize', placeUi); },
    items: ITEMS.map((it) => ({ group: it[0], label: it[1], hint: it[2], glyph: it[3] })),
    addBlock(label) {
      const it = ITEMS.find((i) => i[1] === label); if (!it) return;
      if (sourceMode) return toast('Switch back from Source mode first.', 'warn');
      let blk = curEmpty();
      if (!blk) { const r = rangeNow(); const ref = r ? topBlock(r.endContainer) : ed.lastChild; blk = h('p', null, h('br')); ed.insertBefore(blk, ref ? ref.nextSibling : null); }
      it[4](blk);
    },
    replacePhoto(fig, path) { const img = fig.querySelector('img'); if (!img) return; img.dataset.path = path; img.src = (resolve && resolve(path)) || base + path; emit(); },
    focusEnd,
  };
}
