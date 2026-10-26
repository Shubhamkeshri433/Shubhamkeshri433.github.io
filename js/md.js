/* Tiny, safe Markdown renderer. Builds DOM nodes (no innerHTML), only http/https/mailto links. */
const SAFE_URL = /^(https?:\/\/|mailto:)/i;

function inline(text, parent) {
  const re = /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*)|(\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    const t = m[0];
    if (m[1]) { const c = document.createElement('code'); c.textContent = t.slice(1, -1); parent.appendChild(c); }
    else if (m[2]) { const b = document.createElement('strong'); inline(t.slice(2, -2), b); parent.appendChild(b); }
    else if (m[3]) { const i = document.createElement('em'); inline(t.slice(1, -1), i); parent.appendChild(i); }
    else {
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

export function renderMarkdown(src) {
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
