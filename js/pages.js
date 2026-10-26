/* Renders Skills, Projects, Blog and Connect from data/*.json. All text is inserted as text nodes. */
import { h, clear, safeUrl } from './dom.js';
import { renderMarkdown } from './md.js';

const v = () => Math.floor(Date.now() / 60000); // cache-bust at most once a minute
async function load(name) {
  const r = await fetch(`data/${name}.json?v=${v()}`, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`${name}: ${r.status}`);
  return r.json();
}
const fmtDate = (d) => { const t = new Date(d + 'T00:00:00'); return isNaN(t) ? d : t.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); };
const chips = (arr) => h('ul', { class: 'chips' }, (arr || []).map((t) => h('li', null, t)));
const fail = (root, msg) => { clear(root).appendChild(h('p', { class: 'empty' }, msg)); };

const pages = {
  async skills(root) {
    const data = await load('skills');
    clear(root);
    if (!data.length) return fail(root, 'Skills are coming soon.');
    data.forEach((g, i) => root.appendChild(h('section', { class: 'sec' + (i % 3 === 1 ? ' dark' : '') },
      h('p', { class: 'cap' }, String(i + 1).padStart(2, '0')), h('h2', null, g.category), chips(g.items))));
  },

  async projects(root) {
    const data = await load('projects');
    clear(root);
    if (!data.length) return fail(root, 'Projects are coming soon.');
    data.forEach((p, i) => root.appendChild(h('article', { class: 'sec' + (i % 4 === 0 || i % 4 === 3 ? '' : ' dark') },
      h('p', { class: 'cap' }, `${String(i + 1).padStart(2, '0')} · ${p.badge || 'Project'}`),
      h('h2', null, p.title), h('p', null, p.desc), chips(p.tech),
      h('p', { class: 'row-cta' }, h('a', { class: 'btn', href: safeUrl(p.url), target: '_blank', rel: 'noopener noreferrer' }, 'Open repository ↗')))));
  },

  async blog(root) {
    const all = (await load('posts')).filter((p) => !p.draft).sort((a, b) => (a.date < b.date ? 1 : -1));
    const slug = new URLSearchParams(location.search).get('post');
    clear(root);
    if (slug) {
      const p = all.find((x) => x.slug === slug);
      if (!p) return root.appendChild(h('section', { class: 'sec full' }, h('h2', null, 'Post not found'), h('p', null, 'That post does not exist or is not published.'), h('a', { class: 'btn btn-alt', href: 'blog.html' }, 'All posts')));
      document.title = `${p.title} — Shubham Keshri`;
      const body = h('div', { class: 'prose' }); body.appendChild(renderMarkdown(p.body));
      root.classList.add('single');
      return root.appendChild(h('article', { class: 'sec full' },
        h('p', { class: 'cap' }, fmtDate(p.date)), h('h2', { class: 'post-title' }, p.title), chips(p.tags), body,
        h('p', { class: 'row-cta' }, h('a', { class: 'btn btn-alt', href: 'blog.html' }, '← All posts'))));
    }
    if (!all.length) return fail(root, 'No posts yet. Check back soon.');
    all.forEach((p, i) => root.appendChild(h('a', { class: 'sec post-card' + (i % 2 ? ' dark' : ''), href: `blog.html?post=${encodeURIComponent(p.slug)}` },
      h('p', { class: 'cap' }, fmtDate(p.date)), h('h2', null, p.title), h('p', null, p.summary), chips(p.tags),
      h('span', { class: 'more' }, 'Read ↗'))));
  },

  async connect(root) {
    const s = await load('site');
    clear(root);
    const card = (cap, title, body, dark) => h('section', { class: 'sec' + (dark ? ' dark' : '') }, h('p', { class: 'cap' }, cap), h('h2', null, title), ...body);
    const copy = h('button', { class: 'btn btn-alt', type: 'button' }, 'Copy email');
    copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText(s.email); copy.textContent = 'Copied!'; } catch { copy.textContent = s.email; } setTimeout(() => (copy.textContent = 'Copy email'), 2200); });
    root.appendChild(card('Say hello', 'Email', [h('p', null, s.availability), h('p', { class: 'row-cta' }, h('a', { class: 'btn', href: `mailto:${s.email}` }, 'Email me'), copy)], true));
    root.appendChild(card('Find me', 'Elsewhere', [
      h('p', null, s.location),
      h('p', { class: 'row-cta' },
        s.github && h('a', { class: 'btn btn-alt', href: safeUrl(s.github), target: '_blank', rel: 'noopener noreferrer' }, 'GitHub'),
        s.linkedin && h('a', { class: 'btn btn-alt', href: safeUrl(s.linkedin), target: '_blank', rel: 'noopener noreferrer' }, 'LinkedIn'),
        (s.extra || []).map((l) => h('a', { class: 'btn btn-alt', href: safeUrl(l.url), target: '_blank', rel: 'noopener noreferrer' }, l.label)))]));
    if (s.education) root.appendChild(h('section', { class: 'sec full' }, h('p', { class: 'cap' }, 'Background'), h('h2', null, s.name), h('p', null, `${s.role}. ${s.education}`)));
  },
};

const root = document.getElementById('content');
const page = document.body.dataset.page;
if (root && pages[page]) pages[page](root).catch(() => fail(root, 'Could not load this page. Please try again in a moment.'));
