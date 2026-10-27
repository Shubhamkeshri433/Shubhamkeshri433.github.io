/* Editable page text (data/content.json). Every function is optional: if a value is missing, the text already in the HTML stays. */
import { renderMarkdown } from './md.js';

const $ = (s, r = document) => r.querySelector(s);
export async function loadContent(timeout = 2500) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(`data/content.json?v=${Math.floor(Date.now() / 60000)}`, { cache: 'no-cache', signal: ctl.signal });
    return r.ok ? await r.json() : null;
  } catch (e) { return null; } finally { clearTimeout(t); }
}
const text = (el, v) => { if (el && typeof v === 'string' && v) el.textContent = v; };
/* plain text with **bold**, *italic*, `code` and [links](https://…) */
function rich(el, v) {
  if (!el || typeof v !== 'string' || !v) return;
  const p = renderMarkdown(v).firstChild;
  if (!p) return;
  while (el.firstChild) el.removeChild(el.firstChild);
  while (p.firstChild) el.appendChild(p.firstChild);
}

export function applyShell(c) {
  if (!c) return;
  document.querySelectorAll('.brand').forEach((b) => text(b, c.brand));
  const order = ['skills', 'projects', 'blog', 'connect'];
  document.querySelectorAll('.chapters a').forEach((a, i) => text(a, c.nav && c.nav[order[i]]));
  const pf = $('.page-foot span');
  text(pf, c.footer);
  const foot = $('.foot');
  if (foot && c.footer && foot.firstChild && foot.firstChild.nodeType === 3) foot.firstChild.textContent = c.footer + ' · ';
}

export function applyPage(c, name) {
  const p = c && c.pages && c.pages[name];
  if (!p) return;
  text($('.doc-hero .hero-cap'), p.title);
  text($('.doc-hero h1'), p.title);
  text($('.doc-hero p:not(.cap)'), p.intro);
}

export function applyHome(c) {
  const hm = c && c.home;
  if (!hm) return;
  const beat = (id) => document.getElementById(id);
  const section = (sel, o, withBody = true) => {
    const s = $(sel); if (!s || !o) return;
    text($('.cap', s), o.cap); text($('h2', s), o.title);
    if (withBody) rich($('h2 ~ p', s), o.body);
    return s;
  };
  if (hm.hero) { text($('.beat-hero .cap'), hm.hero.cap); const hint = $('.hint'); if (hint && hm.hero.hint) { const a = $('.hint-arrow', hint); hint.textContent = ''; if (a) hint.append(a, ' '); hint.append(hm.hero.hint); } }
  section('#past', hm.past);
  const learn = section('[aria-labelledby="h-learn"]', hm.learn);
  if (learn && Array.isArray(hm.learn.chips)) { const ul = $('.chips', learn); if (ul) { ul.textContent = ''; hm.learn.chips.forEach((t) => { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }); } }
  section('#present', hm.present);
  section('[aria-labelledby="h-kit"]', hm.kit, false);
  section('#future', hm.future);
  text($('.quote'), hm.quote);
  const ct = beat('contact');
  if (ct && hm.contact) {
    text($('.cap', ct), hm.contact.cap); text($('h2', ct), hm.contact.title);
    const [m, g, l] = ct.querySelectorAll('.contact-links a');
    text(m, hm.contact.emailLabel); text(g, hm.contact.githubLabel); text(l, hm.contact.linkedinLabel);
  }
}
