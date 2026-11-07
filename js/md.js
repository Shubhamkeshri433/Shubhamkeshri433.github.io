/* Tiny, safe Markdown renderer. Builds DOM nodes (no innerHTML), only http/https/mailto links.
   Extras: ++underline++  ~~strike~~  ==highlight==  {{display: text}} {{mono: text}} {{big: text}} {{small: text}}
   Blocks:  ![caption](assets/blog/photo.webp)   @[youtube](link-or-id)   ":: centred paragraph"  */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;
const SAFE_IMG = /^(assets\/blog\/[A-Za-z0-9._-]+|https:\/\/[^\s"'<>]+)$/;
const FX = new Set(['display', 'mono', 'big', 'small']);
let OPTS = {};

function inline(text, parent) {
  /* groups: 1 code, 2 bold+italic, 3 bold, 4 italic, 5 underline, 6 strike, 7 highlight, 8 font style, 9 link */
  const re = /(`[^`]+`)|(\*\*\*[^*]+\*\*\*)|(\*\*(?:[^*]|\*(?!\*))+\*\*)|(\*(?!\*)(?:\*\*[^*]+\*\*|[^*])+\*)|(\+\+[^+]+\+\+)|(~~[^~]+~~)|(==[^=]+==)|(\{\{[a-z]+:\s*[^}]+\}\})|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0, m;
  const wrap = (tag, inner) => { const el = document.createElement(tag); inline(inner, el); parent.appendChild(el); return el; };
  while ((m = re.exec(text))) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    const t = m[0];
    if (m[1]) { const c = document.createElement('code'); c.textContent = t.slice(1, -1); parent.appendChild(c); }
    else if (m[2]) { const b = document.createElement('strong'); const i = document.createElement('em'); inline(t.slice(3, -3), i); b.appendChild(i); parent.appendChild(b); }
    else if (m[3]) wrap('strong', t.slice(2, -2));
    else if (m[4]) wrap('em', t.slice(1, -1));
    else if (m[5]) wrap('u', t.slice(2, -2));
    else if (m[6]) wrap('s', t.slice(2, -2));
    else if (m[7]) wrap('mark', t.slice(2, -2));
    else if (m[8]) {
      const fx = /^\{\{([a-z]+):\s*([^}]+)\}\}$/.exec(t);
      if (fx && FX.has(fx[1])) { const sp = wrap('span', fx[2]); sp.className = 'fx-' + fx[1]; }
      else parent.appendChild(document.createTextNode(t));
    } else {
      const [, label, url] = /\[([^\]]+)\]\(([^)\s]+)\)/.exec(t);
      if (SAFE_URL.test(url)) {
        const a = document.createElement('a'); a.href = url; a.textContent = label;
        if (/^https?:/i.test(url)) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
        parent.appendChild(a);
      } else parent.appendChild(document.createTextNode(label));
    }
    last = m.index + t.length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

function ytId(v) {
  const m = /^(?:https?:\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/))?([A-Za-z0-9_-]{11})(?:[?&#\/][^\s]*)?$/.exec(v.trim());
  return m ? m[1] : null;
}

/* opts.base: prefix for assets/blog paths (the dashboard lives one folder deeper). opts.resolve(path): optional local preview source. */
export function renderMarkdown(src, opts) {
  OPTS = opts || {};
  const frag = document.createDocumentFragment();
  const lines = String(src || '').replace(/\r\n?/g, '\n').split('\n');
  let i = 0;
  const para = [];
  const flush = () => { if (para.length) { const p = document.createElement('p'); inline(para.join(' '), p); frag.appendChild(p); para.length = 0; } };
  while (i < lines.length) {
    const line = lines[i];
    if (/^```/.test(line)) {
      flush(); const buf = []; i++;
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
      i++;
      const pre = document.createElement('pre'), code = document.createElement('code');
      code.textContent = buf.join('\n'); pre.appendChild(code); frag.appendChild(pre); continue;
    }
    const im = /^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/.exec(line);
    if (im) {
      flush(); i++;
      if (SAFE_IMG.test(im[2])) {
        const fig = document.createElement('figure'), img = document.createElement('img');
        const local = OPTS.resolve && OPTS.resolve(im[2]);
        img.src = local || (/^https:/.test(im[2]) ? im[2] : (OPTS.base || '') + im[2]);
        img.alt = im[1]; img.loading = 'lazy'; img.decoding = 'async'; img.dataset.path = im[2];
        fig.appendChild(img);
        if (im[1]) { const fc = document.createElement('figcaption'); fc.textContent = im[1]; fig.appendChild(fc); }
        frag.appendChild(fig);
      }
      continue;
    }
    const yt = /^@\[youtube\]\(([^)\s]+)\)\s*$/.exec(line);
    if (yt) {
      flush(); i++;
      const id = ytId(yt[1]);
      if (id) {
        const box = document.createElement('div'); box.className = 'video';
        const f = document.createElement('iframe');
        f.src = 'https://www.youtube-nocookie.com/embed/' + id; f.title = 'YouTube video'; f.loading = 'lazy';
        f.allow = 'accelerometer; encrypted-media; picture-in-picture'; f.referrerPolicy = 'strict-origin-when-cross-origin';
        f.setAttribute('allowfullscreen', ''); f.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-presentation');
        box.dataset.yt = id; box.appendChild(f); frag.appendChild(box);
      }
      continue;
    }
    const ct = /^::\s?(.*)$/.exec(line);
    if (ct) { flush(); const p = document.createElement('p'); p.className = 'center'; inline(ct[1], p); frag.appendChild(p); i++; continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { flush(); const e = document.createElement('h' + (h[1].length + 1)); inline(h[2], e); frag.appendChild(e); i++; continue; }
    if (/^---+\s*$/.test(line)) { flush(); frag.appendChild(document.createElement('hr')); i++; continue; }
    if (/^>\s?/.test(line)) {
      flush(); const buf = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ''));
      const q = document.createElement('blockquote'); inline(buf.join(' '), q); frag.appendChild(q); continue;
    }
    const ul = /^\s*[-*]\s+/.test(line), ol = /^\s*\d+\.\s+/.test(line);
    if (ul || ol) {
      flush(); const list = document.createElement(ul ? 'ul' : 'ol'); const rx = ul ? /^\s*[-*]\s+/ : /^\s*\d+\.\s+/;
      while (i < lines.length && rx.test(lines[i])) { const li = document.createElement('li'); inline(lines[i].replace(rx, ''), li); list.appendChild(li); i++; }
      frag.appendChild(list); continue;
    }
    if (!line.trim()) { flush(); i++; continue; }
    para.push(line.trim()); i++;
  }
  flush();
  return frag;
}
