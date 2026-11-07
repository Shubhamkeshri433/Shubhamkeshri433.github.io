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
      if (path) { const cap = (n.querySelector('figcaption') || { textContent: '' }).textContent.replace(/[\[\]\n]/g, ' ').trim(); out.push(`![${cap}](${path})`); }
    } else if (t === 'DIV' && n.dataset.yt) out.push(`@[youtube](${n.dataset.yt})`);
    else out.push(...blocks(n));
  });
  if (run.length) flushInline(run);
  return out;
}
export const toMarkdown = (root) => blocks(root).join('\n\n');

/* ---------- editor ---------- */
export function createVisualEditor({ markdown, base = '../', resolve, onChange, onPhoto, onLibrary, toast }) {
  const ed = h('div', { class: 've prose', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Post body', spellcheck: 'true' });
  const src = h('textarea', { class: 'src', 'aria-label': 'Markdown source', spellcheck: 'false' });
  let sourceMode = false;

  const prep = () => {
    ed.querySelectorAll('figure').forEach((f) => {
      f.setAttribute('contenteditable', 'false');
      let c = f.querySelector('figcaption');
      if (!c) { c = document.createElement('figcaption'); f.appendChild(c); }
      c.setAttribute('contenteditable', 'true'); c.setAttribute('data-ph', 'Add a caption');
    });
    ed.querySelectorAll('.video').forEach((v) => v.setAttribute('contenteditable', 'false'));
    if (!ed.firstChild || !ed.lastChild || ed.lastChild.nodeName !== 'P') ed.appendChild(h('p', null, h('br')));
  };
  const load = (md) => { clear(ed); ed.appendChild(renderMarkdown(md, { base, resolve })); prep(); };
  const emit = () => onChange(toMarkdown(ed));
  load(markdown);
  try { document.execCommand('defaultParagraphSeparator', false, 'p'); document.execCommand('styleWithCSS', false, false); } catch (e) { /* ignore */ }

  ed.addEventListener('input', emit);
  ed.addEventListener('paste', (e) => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
  ed.addEventListener('dragover', (e) => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
  ed.addEventListener('drop', (e) => { const f = e.dataTransfer && e.dataTransfer.files[0]; if (f && /^image\//.test(f.type)) { e.preventDefault(); onPhoto(f); } });
  ed.addEventListener('click', (e) => {
    ed.querySelectorAll('.sel').forEach((n) => n.classList.remove('sel'));
    const fig = e.target.closest && e.target.closest('figure, .video');
    if (fig && !e.target.closest('figcaption')) fig.classList.add('sel');
  });
  ed.addEventListener('keydown', (e) => {
    const sel = ed.querySelector('.sel');
    if (sel && (e.key === 'Backspace' || e.key === 'Delete')) { e.preventDefault(); sel.remove(); prep(); emit(); return; }
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
    const r = rangeNow(); let ref = r ? topBlock(r.endContainer) : ed.lastChild;
    if (ref && ref.nodeName === 'P' && !ref.textContent.trim() && ref.parentNode === ed && ref !== ed.lastChild) { ed.replaceChild(node, ref); } else ed.insertBefore(node, ref ? ref.nextSibling : null);
    prep(); emit();
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
    b(null, '—', 'Divider line', () => insertBlockEl(document.createElement('hr'))), sep(),
    b('image', 'Photo', 'Add a photo (opens the photo editor)', () => onPhoto(null)), b('folder', 'Library', 'Your uploaded photos', onLibrary), b(null, '▶ Video', 'YouTube video', addVideo),
    h('span', { class: 'grow' }),
    b('code', 'Source', 'Switch between visual and Markdown source', () => toggleSource()));
  function refreshState() { tbs.forEach(([el, st]) => { let on = false; try { on = rangeNow() ? st() : false; } catch (e) { /* ignore */ } el.classList.toggle('on', on); }); }
  document.addEventListener('selectionchange', refreshState);

  function toggleSource() {
    sourceMode = !sourceMode;
    if (sourceMode) { src.value = toMarkdown(ed); ed.hidden = true; src.hidden = false; src.focus(); }
    else { load(src.value); onChange(src.value); src.hidden = true; ed.hidden = false; ed.focus(); }
    root.classList.toggle('source', sourceMode);
  }
  src.hidden = true;
  src.addEventListener('input', () => onChange(src.value));

  const root = h('div', { class: 've-wrap' }, toolbar, ed, src);
  return {
    el: root,
    insertPhoto(path, alt) { if (sourceMode) { src.value += `\n\n![${alt || ''}](${path})\n`; onChange(src.value); return; } insertBlockEl(renderMarkdown(`![${alt || ''}](${path})`, { base, resolve }).firstChild); },
    markdown: () => (sourceMode ? src.value : toMarkdown(ed)),
    destroy() { document.removeEventListener('selectionchange', refreshState); },
    focusEnd,
  };
}
