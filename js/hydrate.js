/* Fills the home page from data/*.json before the 3D film starts. If anything fails, the text already in index.html stays. */
import { h, clear, safeUrl } from './dom.js';
import { loadContent, applyShell, applyHome } from './content.js';

const v = () => Math.floor(Date.now() / 60000);
async function load(name) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 2500);
  try {
    const r = await fetch(`data/${name}.json?v=${v()}`, { cache: 'no-cache', signal: ctl.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}
const $ = (s) => document.querySelector(s);

export async function hydrate() {
  const [site, skills, projects, content] = await Promise.all([load('site').catch(() => null), load('skills').catch(() => null), load('projects').catch(() => null), loadContent()]);
  applyShell(content);
  applyHome(content);

  if (site) {
    const [first, ...rest] = String(site.name || '').trim().split(/\s+/);
    const h1 = $('#h-hero');
    if (h1 && first) { clear(h1); h1.append(first, h('br'), h('span', null, rest.join(' ') || '')); }
    if ($('.role') && site.role) $('.role').textContent = site.role;
    if ($('.lead') && site.lead) $('.lead').textContent = site.lead;
    const c = $('#contact');
    if (c) {
      const ps = c.querySelectorAll('.panel > p');
      if (site.availability && ps[1]) ps[1].textContent = `${site.availability}${site.location ? ' · ' + site.location : ''}`;
      const [mail, gh, li] = c.querySelectorAll('.contact-links a');
      if (mail && site.email) mail.href = `mailto:${site.email}`;
      if (gh && site.github) gh.href = safeUrl(site.github);
      if (li && site.linkedin) li.href = safeUrl(site.linkedin);
    }
    if ($('.meta') && site.education) $('.meta').textContent = site.education;
  }

  if (skills && skills.length) {
    const kit = $('.kit');
    if (kit) {
      clear(kit);
      skills.slice(0, 4).forEach((g) => kit.appendChild(h('div', null, h('dt', null, g.category), h('dd', null, (g.items || []).slice(0, 4).join(' · ')))));
    }
  }

  if (projects && projects.length) {
    const list = $('.work-list');
    if (list) {
      const featured = projects.filter((p) => p.featured !== false).slice(0, 8);
      const use = featured.length ? featured : projects.slice(0, 8);
      clear(list);
      use.forEach((p) => list.appendChild(h('li', { 'data-badge': p.badge || 'Project', 'data-tech': (p.tech || []).join(',') },
        h('a', { href: safeUrl(p.url), target: '_blank', rel: 'noopener noreferrer' }, h('strong', null, p.title)), h('span', null, p.desc))));
    }
  }
}
