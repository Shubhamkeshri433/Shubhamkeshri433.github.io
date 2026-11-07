/* Dashboard pages. Each view returns a DOM node. Data is edited in place (S.files[name].data) and saved from the top bar. */
import { CONFIG, h, clear, S, FILES, DEFAULTS, clone, slugify, humanize, isHttps, ago, gh, repoPath, loadFile, listCommits, fileAt, dirty, dirtyNames, loadMedia, uploadPhoto, deletePhoto, usedPhotos, loadRepos, toast, lock, vaultForget, hasVault, toggleTheme, restoreDraft, dropDraft } from './core.js';
import { icon, btn, iconBtn, fld, selectFld, chips, sw, card, empty, modal, confirmBox, promptBox, diffView, dragList, gripEl, moveArr, changed } from './ui.js';
import { createVisualEditor } from './editor.js';
import { createImageEditor } from '../blog-editor.js';
import { renderMarkdown } from '../md.js';

const pretty = (o) => JSON.stringify(o, null, 2);
const head = (title, sub, ...actions) => h('div', { class: 'page-head' }, h('div', null, h('h1', null, title), sub ? h('p', { class: 'sub' }, sub) : null), h('div', { class: 'actions' }, ...actions));
const prevT = new WeakMap(); // previous title per item, used to keep auto-made slugs in sync
const rerender = () => S.rerender();
const D = (n) => S.files[n].data;
const kb = (n) => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const slot = (kid) => { const el = h('div', null, kid); return el; };
function fill(node, promise, build) { // show a placeholder, replace it when the promise is done
  promise.then((v) => { if (node.isConnected) { node.classList.remove('skeleton'); clear(node); node.appendChild(build(v)); } }).catch((e) => { if (node.isConnected) { clear(node); node.appendChild(h('p', { class: 'muted err' }, e.message)); } });
  return node;
}

/* ---------- validation (used before saving) ---------- */
export function validate(n) {
  const d = D(n);
  if (n === 'site') {
    if (!String(d.name || '').trim()) return 'Profile: name is required.';
    if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) return 'Profile: email looks invalid.';
    for (const u of [d.github, d.linkedin, ...(d.extra || []).map((l) => l.url)]) if (u && !isHttps(u)) return 'Profile: links must start with https://';
  } else if (n === 'skills') {
    if (d.some((c) => !String(c.category || '').trim())) return 'Skills: every category needs a name.';
  } else if (n === 'projects') {
    const ids = new Set();
    for (const p of d) {
      if (!String(p.title || '').trim()) return 'Projects: every project needs a title.';
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.id || '')) return `Projects: ID "${p.id}" must be lowercase letters, numbers and dashes.`;
      if (ids.has(p.id)) return `Projects: duplicate ID "${p.id}".`;
      ids.add(p.id);
      if (p.url && !isHttps(p.url)) return `Projects: "${p.title}" link must start with https://`;
    }
  } else if (n === 'posts') {
    const slugs = new Set();
    for (const x of d) {
      if (!String(x.title || '').trim()) return 'Blog: every post needs a title.';
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(x.slug || '')) return `Blog: slug "${x.slug}" must be lowercase letters, numbers and dashes.`;
      if (slugs.has(x.slug)) return `Blog: duplicate slug "${x.slug}".`;
      slugs.add(x.slug);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date || '')) return `Blog: "${x.title}" date must look like 2026-11-06.`;
    }
  } else if (n === 'content') {
    if (!d || Array.isArray(d) || typeof d !== 'object') return 'Page text must be an object.';
  }
  return null;
}

/* ---------- overview ---------- */
function overview() {
  const posts = D('posts'), live = posts.filter((p) => !p.draft).length;
  const stat = (label, val, note, cls = '') => h('div', { class: 'card stat' }, h('span', { class: 'lbl' }, label), h('b', null, String(val)), h('em', { class: cls }, note));
  const hour = new Date().getHours();
  const photos = S.media ? S.media.length : '…';
  const recent = h('div', { class: 'skeleton' }, 'Loading…');
  fill(recent, listCommits(null, 8), (cs) => h('div', null, ...cs.map((c) => h('div', { class: 'row' }, h('span', { class: 'pill ac' }, c.commit.message.startsWith('Dashboard') ? 'dashboard' : 'repo'),
    h('div', { class: 't' }, c.commit.message.split('\n')[0], h('small', null, `${c.commit.author.name} · ${ago(c.commit.author.date)}`)),
    /^https:\/\/github\.com\//.test(c.html_url) ? h('a', { class: 'btn', href: c.html_url, target: '_blank', rel: 'noopener noreferrer' }, 'GitHub ↗') : null))));
  if (S.media === null) loadMedia().then(rerender).catch(() => {});
  return h('div', { class: 'page' },
    head(`Good ${hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'}, ${(D('site').name || '').split(' ')[0] || 'there'}`, 'Everything you change here is saved to GitHub and goes live in about a minute.', btn('New post', { icon: 'plus', kind: 'primary', onClick: () => { S.tab = 'blog'; newPost(); } })),
    h('div', { class: 'grid4' },
      stat('Posts live', live, `${posts.length} in total`), stat('Drafts', posts.length - live, posts.length - live ? 'not public yet' : 'all published', posts.length - live ? 'warn' : ''),
      stat('Projects', D('projects').length, `${D('projects').filter((p) => p.featured).length} on the home page`), stat('Photos', photos, S.media ? kb(S.media.reduce((a, m) => a + m.size, 0)) + ' total' : 'loading')),
    h('div', { class: 'grid2' }, card('Recent changes', btn('History', { onClick: () => go('history') }), recent),
      card('Quick actions', null,
        h('div', { class: 'quick' },
          btn('Import repos from GitHub', { icon: 'github', onClick: () => { S.tab = 'projects'; rerender(); importRepos(); } }),
          btn('Upload a photo', { icon: 'image', onClick: () => go('media') }),
          btn('Run site health check', { icon: 'heart', onClick: () => go('health') }),
          btn('Download a backup', { icon: 'download', onClick: () => go('backup') })))));
}
export const go = (tab) => { S.tab = tab; location.hash = '#/' + tab; rerender(); };

/* ---------- profile ---------- */
function profile() {
  const d = D('site'); d.extra = d.extra || [];
  const extra = h('div', { class: 'stack' });
  const paint = () => {
    clear(extra);
    d.extra.forEach((l, i) => extra.appendChild(h('div', { class: 'item row2' }, fld('Label', l, 'label'), fld('Link (https)', l, 'url'), h('div', { class: 'item-actions' },
      i > 0 ? iconBtn('up', 'Move up', () => { moveArr(d.extra, i, i - 1); changed(); paint(); }) : null, i < d.extra.length - 1 ? iconBtn('down', 'Move down', () => { moveArr(d.extra, i, i + 1); changed(); paint(); }) : null,
      iconBtn('trash', 'Remove', () => { d.extra.splice(i, 1); changed(); paint(); }, 'danger')))));
  };
  paint();
  return h('div', { class: 'page' }, head('Profile & contact', 'Your name, role and links. They appear on the home page and the Connect page.'),
    card('Basics', null, h('div', { class: 'form' }, fld('Name', d, 'name'), fld('Role', d, 'role'), fld('Location', d, 'location'), fld('Email', d, 'email'), fld('GitHub link', d, 'github'), fld('LinkedIn link', d, 'linkedin'),
      fld('Education line', d, 'education', { wide: true }), fld('Availability line', d, 'availability', { wide: true }), fld('Intro (home page)', d, 'lead', { area: true, wide: true }))),
    card('Extra links', btn('Add link', { icon: 'plus', onClick: () => { d.extra.push({ label: '', url: 'https://' }); changed(); paint(); } }), extra));
}

/* ---------- skills ---------- */
function skills() {
  const d = D('skills');
  const list = h('div', { class: 'stack' });
  d.forEach((c, i) => {
    c.items = c.items || [];
    list.appendChild(h('div', { class: 'item' }, h('div', { class: 'item-head' }, gripEl(), h('div', { class: 'grow' }, fld('Category', c, 'category')),
      h('div', { class: 'item-actions' }, i > 0 ? iconBtn('up', 'Move up', () => { moveArr(d, i, i - 1); changed(); rerender(); }) : null, i < d.length - 1 ? iconBtn('down', 'Move down', () => { moveArr(d, i, i + 1); changed(); rerender(); }) : null,
        iconBtn('trash', 'Delete category', async () => { if (await confirmBox('Delete category', `Delete "${c.category || 'this category'}" and its skills?`, 'Delete', true)) { d.splice(i, 1); changed(); rerender(); } }, 'danger'))),
      chips('Skills', c.items, (v) => (c.items = v), 'Add a skill, press Enter')));
  });
  dragList(list, (f, t) => { moveArr(d, f, t); changed(); rerender(); });
  return h('div', { class: 'page' }, head('Skills', 'Grouped by what they are for. Drag the handle to reorder.', btn('Add category', { icon: 'plus', kind: 'primary', onClick: () => { d.push({ category: '', items: [] }); changed(); rerender(); } })),
    d.length ? list : empty('No skills yet.'));
}

/* ---------- projects ---------- */
function projectForm(p) {
  p.tech = p.tech || [];
  return h('div', { class: 'form' }, fld('Title', p, 'title'), fld('ID (lowercase-with-dashes)', p, 'id'), fld('Badge / category', p, 'badge'), fld('Repository / link (https)', p, 'url'),
    fld('Description', p, 'desc', { area: true, wide: true }), chips('Tech', p.tech, (v) => (p.tech = v)), sw('Featured on the home page', 'The home page shows the first 8 featured projects', p.featured, (v) => (p.featured = v)));
}
function projects() {
  const d = D('projects');
  const q = h('input', { type: 'search', placeholder: 'Search projects…', 'aria-label': 'Search projects', value: S.projQ || '' });
  const list = h('div', { class: 'cards' });
  const paint = () => {
    clear(list);
    const term = (S.projQ || '').toLowerCase();
    const shown = d.map((p, i) => [p, i]).filter(([p]) => !term || [p.title, p.badge, p.desc, (p.tech || []).join(' ')].join(' ').toLowerCase().includes(term));
    if (!shown.length) { list.appendChild(empty(term ? 'No project matches your search.' : 'No projects yet. Add one or import your GitHub repos.')); return; }
    shown.forEach(([p, i]) => list.appendChild(h('article', { class: 'pcard' + (p.featured ? ' feat' : '') },
      h('div', { class: 'pc-top' }, term ? null : gripEl(), h('span', { class: 'pill ac' }, p.badge || 'Project'), h('span', { class: 'grow' }),
        iconBtn('star', p.featured ? 'Featured (click to remove)' : 'Not featured (click to feature)', () => { p.featured = !p.featured; changed(); paint(); }, p.featured ? 'on' : '')),
      h('h4', null, p.title || 'Untitled'), h('p', { class: 'muted clamp' }, p.desc || 'No description'),
      h('div', { class: 'tags' }, ...(p.tech || []).slice(0, 5).map((t) => h('span', { class: 'tag' }, t))),
      h('div', { class: 'pc-foot' }, p.url ? h('a', { class: 'muted', href: isHttps(p.url) ? p.url : '#', target: '_blank', rel: 'noopener noreferrer' }, p.url.replace('https://', '').slice(0, 34)) : h('span', { class: 'muted' }, 'No link'),
        h('span', { class: 'grow' }), btn('Edit', { icon: 'edit', onClick: () => editProject(p, paint) }),
        iconBtn('trash', 'Delete project', async () => { if (await confirmBox('Delete project', `Delete "${p.title}"?`, 'Delete', true)) { d.splice(i, 1); changed(); paint(); } }, 'danger')))));
    if (!term) dragList(list, (f, t) => { moveArr(d, f, t); changed(); paint(); });
  };
  q.addEventListener('input', () => { S.projQ = q.value; paint(); });
  paint();
  return h('div', { class: 'page' }, head('Projects', `${d.length} projects. Drag to reorder, star to show on the home page.`,
    btn('Import from GitHub', { icon: 'github', onClick: importRepos }),
    btn('Add project', { icon: 'plus', kind: 'primary', onClick: () => { const p = { id: '', title: '', badge: '', desc: '', tech: [], url: 'https://', featured: false }; d.unshift(p); changed(); paint(); editProject(p, paint); } })),
    h('div', { class: 'toolbar-row' }, h('div', { class: 'search-in' }, icon('search', 16), q)), list);
}
function editProject(p, after) {
  const form = projectForm(p);
  const m = modal({ title: p.title || 'New project', body: form, wide: true, onClose: after, actions: [btn('Done', { kind: 'primary', onClick: () => m.close() })] });
  const t = form.querySelector('input'); t && t.addEventListener('input', () => { const idEl = form.querySelectorAll('input')[1]; if (idEl && (!p.id || p.id === slugify(prevT.get(p) || ''))) { p.id = slugify(t.value); idEl.value = p.id; } prevT.set(p, t.value); });
}
async function importRepos() {
  const body = h('div', { class: 'skeleton' }, 'Loading your GitHub repositories…');
  const m = modal({ title: 'Import from GitHub', body, wide: true });
  try { if (!S.repos) await loadRepos(); } catch (e) { clear(body); body.appendChild(h('p', { class: 'err' }, e.message)); return; }
  const have = new Set(D('projects').map((p) => String(p.url || '').toLowerCase()));
  const o = { forks: false, q: '' };
  const picked = new Set();
  const list = h('div', { class: 'repo-list' }), count = h('span', { class: 'muted' });
  const isSelf = (r) => r.name.toLowerCase() === CONFIG.repo.toLowerCase() || r.name.toLowerCase() === CONFIG.owner.toLowerCase();
  const avail = () => S.repos.filter((r) => (o.forks || !r.fork) && !have.has(r.html_url.toLowerCase()) && (!o.q || (r.name + ' ' + (r.description || '')).toLowerCase().includes(o.q)));
  S.repos.forEach((r) => { if (!r.fork && !isSelf(r) && !have.has(r.html_url.toLowerCase())) picked.add(r.id); });
  const importBtn = btn('', { kind: 'primary', icon: 'download' });
  const paint = () => {
    clear(list);
    S.repos.filter((r) => (o.forks || !r.fork) && (!o.q || (r.name + ' ' + (r.description || '')).toLowerCase().includes(o.q))).forEach((r) => {
      const already = have.has(r.html_url.toLowerCase());
      const cb = h('input', { type: 'checkbox', checked: picked.has(r.id) && !already, disabled: already, 'aria-label': r.name });
      cb.addEventListener('change', () => { cb.checked ? picked.add(r.id) : picked.delete(r.id); upd(); });
      list.appendChild(h('label', { class: 'repo' + (already ? ' done' : '') }, cb, h('div', { class: 'grow' }, h('b', null, r.name), h('small', null, r.description || 'No description')),
        r.language ? h('span', { class: 'tag' }, r.language) : null, r.fork ? h('span', { class: 'tag' }, 'fork') : null, already ? h('span', { class: 'pill ok' }, 'added') : h('span', { class: 'muted' }, `★ ${r.stargazers_count}`)));
    });
    upd();
  };
  const upd = () => { const n = [...picked].filter((id) => avail().some((r) => r.id === id)).length; count.textContent = `${S.repos.length} repositories found · ${n} selected`; clear(importBtn); importBtn.append(icon('download', 16), h('span', null, `Import ${n} project${n === 1 ? '' : 's'}`)); importBtn.disabled = !n; };
  const search = h('input', { type: 'search', placeholder: 'Search repositories…', 'aria-label': 'Search repositories' });
  search.addEventListener('input', () => { o.q = search.value.toLowerCase(); paint(); });
  const forks = h('input', { type: 'checkbox', id: 'forks' });
  forks.addEventListener('change', () => { o.forks = forks.checked; paint(); });
  importBtn.addEventListener('click', () => {
    const ids = new Set(D('projects').map((p) => p.id));
    const rows = avail().filter((r) => picked.has(r.id)); const add = [];
    rows.forEach((r) => {
      let id = slugify(r.name) || 'project', k = 2; while (ids.has(id)) id = `${slugify(r.name)}-${k++}`; ids.add(id);
      const tech = [...new Set([r.language, ...(r.topics || [])].filter(Boolean))].slice(0, 6);
      add.push({ id, title: humanize(r.name), badge: r.language || 'Project', desc: r.description || '', tech, url: r.html_url, featured: false });
    });
    D('projects').push(...add); changed(); m.close(); toast(`Imported ${add.length} project${add.length === 1 ? '' : 's'}. Edit or delete them, then save. They are not on the home page until you star them.`);
    rerender();
  });
  clear(body);
  body.append(h('p', { class: 'muted' }, 'Choose the repositories to add as projects. Each one is added with its name, description, language and topics, and you can edit or delete it afterwards. Imported projects are not featured on the home page until you star them.'),
    h('div', { class: 'toolbar-row' }, h('div', { class: 'search-in' }, icon('search', 16), search), h('label', { class: 'inline' }, forks, ' Include forks'),
      btn('Select all', { onClick: () => { avail().forEach((r) => picked.add(r.id)); paint(); } }), btn('None', { onClick: () => { picked.clear(); paint(); } })), list, h('div', { class: 'modal-foot-row' }, count, h('span', { class: 'grow' }), btn('Cancel', { onClick: () => m.close() }), importBtn));
  paint();
}

/* ---------- blog ---------- */
function newPost() {
  const d = D('posts');
  d.unshift({ slug: '', title: '', date: new Date().toISOString().slice(0, 10), summary: '', tags: [], draft: true, body: '' });
  S.postIdx = 0; changed(); rerender();
}
function photoFlow(file, ed) {
  const run = async (f) => {
    if (f.size > 25 * 1024 * 1024) return toast('That photo is too big (max 25 MB).', 'err');
    let m;
    try {
      const panel = await createImageEditor(f, {
        onCancel: () => m.close(),
        onDone: async (blob, ext, alt) => {
          try { const name = await uploadPhoto(blob, ext); if (ed) ed.insertPhoto('assets/blog/' + name, alt); toast('Photo uploaded' + (ed ? ' and added to the post.' : '.')); m.close(); if (S.tab === 'media') rerender(); }
          catch (e) { toast(e.message, 'err'); }
        } });
      m = modal({ title: 'Edit photo', body: panel, wide: true });
    } catch (e) { toast(e.message, 'err'); }
  };
  if (file) return run(file);
  const inp = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', class: 'hidden', 'aria-label': 'Choose a photo' });
  document.body.appendChild(inp);
  inp.addEventListener('change', () => { if (inp.files[0]) run(inp.files[0]); inp.remove(); });
  inp.click();
}
function library(ed) {
  const body = h('div', { class: 'skeleton' }, 'Loading your photos…');
  const m = modal({ title: 'Your photos', body, wide: true });
  const paint = () => {
    clear(body);
    if (!S.media.length) return body.appendChild(empty('No photos yet. Use the Photo button to add one.'));
    const used = usedPhotos();
    body.appendChild(h('div', { class: 'thumbs' }, ...S.media.map((p) => h('div', { class: 'thumb' }, h('img', { src: S.local['assets/blog/' + p.name] || '../assets/blog/' + p.name, alt: p.name, loading: 'lazy' }),
      h('small', null, `${p.name} · ${kb(p.size)}`), h('div', { class: 'row-btns' }, ed ? btn('Insert', { kind: 'primary', onClick: () => { ed.insertPhoto('assets/blog/' + p.name, ''); m.close(); } }) : null,
        iconBtn('trash', 'Delete photo', async () => { if (await confirmBox('Delete photo', `Delete ${p.name}? ${used.has(p.name) ? 'It is used in a post, which will lose the picture.' : ''}`, 'Delete', true)) { try { await deletePhoto(p); paint(); } catch (e) { toast(e.message, 'err'); } } }, 'danger'))))));
  };
  (S.media ? Promise.resolve() : loadMedia()).then(paint).catch((e) => { clear(body); body.appendChild(h('p', { class: 'err' }, e.message)); });
}
function previewPost(p) {
  const wrap = h('div', { class: 'prev-frame' });
  const art = h('article', { class: 'prose' }, h('p', { class: 'muted' }, p.date), h('h2', null, p.title || 'Untitled'), renderMarkdown(p.body || '', { base: '../', resolve: (x) => S.local[x] }));
  wrap.appendChild(art);
  const dev = selectFld('Device', 'desktop', [['desktop', 'Desktop'], ['phone', 'Phone']], (v) => wrap.classList.toggle('phone', v === 'phone'));
  modal({ title: 'Preview', body: h('div', null, dev, wrap), wide: true });
}
function blog() {
  const d = D('posts');
  if (S.postIdx == null || S.postIdx >= d.length) S.postIdx = 0;
  const p = d[S.postIdx];
  const list = h('div', { class: 'plist' }, ...d.map((x, i) => {
    const b = h('button', { type: 'button', class: 'pl-item' + (i === S.postIdx ? ' on' : '') }, h('b', null, x.title || 'Untitled'), h('small', null, `${x.date || ''} · ${x.draft ? 'draft' : 'live'}`));
    b.addEventListener('click', () => { S.postIdx = i; rerender(); }); return b;
  }));
  let center, side;
  if (p) {
    const ed = createVisualEditor({ markdown: p.body || '', base: '../', resolve: (x) => S.local[x], toast, onChange: (md) => { p.body = md; changed(); }, onPhoto: (f) => photoFlow(f, ed), onLibrary: () => library(ed) });
    S.cleanup = () => ed.destroy();
    const slugEl = fld('Slug (web address)', p, 'slug', { hint: 'lowercase-with-dashes' });
    center = h('div', { class: 'editor-col' }, h('div', { class: 'title-in' }, (() => { const t = h('input', { type: 'text', value: p.title || '', placeholder: 'Post title', 'aria-label': 'Post title' }); t.addEventListener('input', () => { const auto = !p.slug || p.slug === slugify(prevT.get(p) || ''); p.title = t.value; const li = document.querySelector('.pl-item.on b'); if (li) li.textContent = t.value || 'Untitled'; if (auto) { p.slug = slugify(t.value); slugEl.querySelector('input').value = p.slug; } prevT.set(p, t.value); changed(); }); prevT.set(p, p.title); return t; })()), ed.el);
    side = h('aside', { class: 'side card' }, h('h3', null, h('span', null, 'Post settings')), slugEl, fld('Date (YYYY-MM-DD)', p, 'date'), chips('Tags', p.tags = p.tags || [], (v) => (p.tags = v)),
      fld('Summary', p, 'summary', { area: true, rows: 3, hint: 'Shown on the blog list and in link previews.' }), sw('Draft', 'Hidden from the public site', p.draft, (v) => { p.draft = v; rerender(); }),
      h('div', { class: 'stack-btns' }, btn('Preview', { icon: 'eye', onClick: () => previewPost(p) }), btn('Delete post', { icon: 'trash', kind: 'danger', onClick: async () => { if (await confirmBox('Delete post', `Delete "${p.title || 'this post'}"?`, 'Delete', true)) { d.splice(S.postIdx, 1); changed(); rerender(); } } })));
  } else { center = h('div', { class: 'editor-col' }, empty('No posts yet.', btn('Write your first post', { kind: 'primary', icon: 'plus', onClick: newPost }))); side = h('div'); }
  return h('div', { class: 'page wide-page' }, head('Blog', `${d.length} posts. Write it here exactly as it will look on the site.`, btn('New post', { icon: 'plus', kind: 'primary', onClick: newPost })),
    h('div', { class: 'blog-grid' }, h('aside', { class: 'card plist-card' }, h('h3', null, h('span', null, 'Posts')), list), center, side));
}

/* ---------- media ---------- */
function media() {
  const box = h('div', { class: 'skeleton' }, 'Loading photos…');
  const paint = () => {
    clear(box);
    if (!S.media.length) return box.appendChild(empty('No photos yet. Upload one, or add one from the Blog editor.'));
    const used = usedPhotos();
    box.appendChild(h('div', { class: 'thumbs big' }, ...S.media.map((p) => h('div', { class: 'thumb' }, h('img', { src: S.local['assets/blog/' + p.name] || '../assets/blog/' + p.name, alt: p.name, loading: 'lazy' }),
      h('small', null, `${p.name} · ${kb(p.size)}`), h('div', null, used.has(p.name) ? h('span', { class: 'pill ok' }, 'used in ' + used.get(p.name)[0]) : h('span', { class: 'pill wn' }, 'not used'), p.size > 700 * 1024 ? h('span', { class: 'pill wn' }, 'large') : null),
      h('div', { class: 'row-btns' }, btn('Copy path', { onClick: async () => { try { await navigator.clipboard.writeText('assets/blog/' + p.name); toast('Path copied.'); } catch (e) { toast('Could not copy.', 'warn'); } } }),
        iconBtn('trash', 'Delete', async () => { if (await confirmBox('Delete photo', `Delete ${p.name}?`, 'Delete', true)) { try { await deletePhoto(p); paint(); } catch (e) { toast(e.message, 'err'); } } }, 'danger'))))));
  };
  (S.media ? Promise.resolve() : loadMedia()).then(() => { if (box.isConnected) paint(); }).catch((e) => { clear(box); box.appendChild(h('p', { class: 'err' }, e.message)); });
  return h('div', { class: 'page' }, head('Media', 'Photos used in blog posts. They live in assets/blog/ in your repository.',
    btn('Delete unused', { icon: 'trash', onClick: async () => { if (!S.media) return; const used = usedPhotos(); const un = S.media.filter((m) => !used.has(m.name)); if (!un.length) return toast('No unused photos.'); if (!(await confirmBox('Delete unused photos', `Delete ${un.length} photo${un.length === 1 ? '' : 's'} that no post uses?`, 'Delete', true))) return; for (const m of un) { try { await deletePhoto(m); } catch (e) { toast(e.message, 'err'); break; } } rerender(); } }),
    btn('Upload photo', { icon: 'upload', kind: 'primary', onClick: () => photoFlow(null, null) })), box);
}

/* ---------- page text ---------- */
function tree(obj, path = []) {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) out.push(h('fieldset', { class: 'group' }, h('legend', null, humanize(k)), h('div', { class: 'form' }, ...tree(v, [...path, k]))));
    else if (Array.isArray(v)) out.push(chips(humanize(k), v, (x) => (obj[k] = x)));
    else { const long = String(v).length > 70 || /body|intro|quote/i.test(k); out.push(fld(humanize(k), obj, k, { area: long, wide: long })); }
  }
  return out;
}
function pageText() {
  const d = D('content');
  const sections = Object.keys(d).map((k, i) => {
    const v = d[k], det = h('details', { class: 'acc', open: i < 1 }, h('summary', null, humanize(k)));
    if (v && typeof v === 'object' && !Array.isArray(v)) det.appendChild(h('div', { class: 'form' }, ...tree(v))); else { const o = { [k]: v }; det.appendChild(h('div', { class: 'form' }, ...tree(o))); const f = det.querySelector('input,textarea'); if (f) f.addEventListener('input', () => { d[k] = o[k]; }); }
    return det;
  });
  return h('div', { class: 'page' }, head('Page text', 'Every heading and paragraph on the home story, the page titles, menu names and footer. In paragraphs you can use **bold**, *italic* and [links](https://…). Leave a box empty to keep the built-in text.'), ...sections);
}

/* ---------- history ---------- */
function history() {
  const sel = S.histFile || 'projects';
  const out = h('div', { class: 'skeleton' }, 'Loading history…');
  const pick = selectFld('File', sel, FILES.map((n) => [n, `data/${n}.json`]), (v) => { S.histFile = v; rerender(); });
  fill(out, listCommits(`${CONFIG.dataDir}/${sel}.json`, 20), (cs) => cs.length ? h('div', null, ...cs.map((c) => h('div', { class: 'row' }, h('div', { class: 't' }, c.commit.message.split('\n')[0], h('small', null, `${c.commit.author.name} · ${ago(c.commit.author.date)} · ${c.sha.slice(0, 7)}`)),
    btn('Compare', { onClick: async (e, b) => { try { const old = await fileAt(sel, c.sha); modal({ title: `${sel}.json at ${c.sha.slice(0, 7)} vs your current version`, body: diffView(pretty(old), pretty(D(sel))), wide: true }); } catch (x) { toast(x.message, 'err'); } }, busy: true }),
    btn('Restore', { icon: 'undo', onClick: async () => { if (!(await confirmBox('Restore this version', `Load ${sel}.json from ${ago(c.commit.author.date)} into the dashboard? It stays unsaved until you press Save, so you can review it first.`, 'Restore'))) return; try { S.files[sel].data = await fileAt(sel, c.sha); changed(); toast('Version loaded. Review it and save.'); rerender(); } catch (x) { toast(x.message, 'err'); } }, busy: true })))) : empty('No history for this file yet.'));
  return h('div', { class: 'page' }, head('History', 'Every save is a commit. Compare old versions or bring one back.'), card(null, null, pick, out));
}

/* ---------- site health ---------- */
function health() {
  const res = h('div', null, empty('Press "Run check" to test your site.'));
  const row = (lvl, text, sub) => h('div', { class: 'row' }, h('span', { class: 'pill ' + (lvl === 'ok' ? 'ok' : lvl === 'warn' ? 'wn' : 'bad') }, lvl === 'ok' ? 'OK' : lvl === 'warn' ? 'WARN' : 'FIX'), h('div', { class: 't' }, text, sub ? h('small', null, sub) : null));
  const run = async (e, b) => {
    clear(res); const rows = [];
    const proj = D('projects'), posts = D('posts'), site = D('site');
    // project links that point at GitHub can be verified through the API
    let okLinks = 0, bad = [], other = 0;
    for (const p of proj) {
      const m = /^https:\/\/github\.com\/([^/]+)\/([^/#?]+)/i.exec(p.url || '');
      if (!m) { other++; continue; }
      try { await gh(`/repos/${m[1]}/${m[2]}`); okLinks++; } catch (x) { bad.push(p.title); }
    }
    rows.push(bad.length ? row('fix', `${bad.length} project link${bad.length > 1 ? 's' : ''} do not open`, bad.join(', ')) : row('ok', `${okLinks} GitHub project links open`, other ? `${other} other links could not be checked here` : null));
    try { await gh(`${repoPath}/contents/og-image.png?ref=${CONFIG.branch}`); rows.push(row('ok', 'Link preview image found (og-image.png)')); } catch (x) { rows.push(row('fix', 'Link preview image missing', 'Upload og-image.png to the root of the repository.')); }
    if (!S.media) { try { await loadMedia(); } catch (x) { S.media = []; } }
    const big = S.media.filter((m) => m.size > 700 * 1024); rows.push(big.length ? row('warn', `${big.length} photo${big.length > 1 ? 's are' : ' is'} over 700 KB`, big.map((m) => m.name).join(', ')) : row('ok', 'All photos are a good size'));
    const used = usedPhotos(); const un = S.media.filter((m) => !used.has(m.name)); rows.push(un.length ? row('warn', `${un.length} photo${un.length > 1 ? 's are' : ' is'} not used in any post`, 'Clean them up in Media.') : row('ok', 'No unused photos'));
    const old = posts.filter((x) => x.draft && (Date.now() - new Date(x.date).getTime()) / 864e5 > 14); rows.push(old.length ? row('warn', `${old.length} draft${old.length > 1 ? 's' : ''} older than 14 days`, old.map((x) => x.title).join(', ')) : row('ok', 'No stale drafts'));
    const miss = posts.filter((x) => !x.draft && (!x.summary || !(x.tags || []).length)); rows.push(miss.length ? row('warn', `${miss.length} live post${miss.length > 1 ? 's' : ''} without a summary or tags`, miss.map((x) => x.title).join(', ')) : row('ok', 'Live posts have summaries and tags'));
    const thin = proj.filter((x) => !x.desc || !(x.tech || []).length); rows.push(thin.length ? row('warn', `${thin.length} project${thin.length > 1 ? 's' : ''} without a description or tech`, thin.map((x) => x.title).join(', ')) : row('ok', 'Projects are fully described'));
    rows.push(!site.email || !site.lead ? row('warn', 'Profile is missing an email or intro') : row('ok', 'Profile has an email and an intro'));
    const feat = proj.filter((x) => x.featured).length; rows.push(feat > 8 ? row('warn', `${feat} featured projects, the home page shows 8`) : row('ok', `${feat} featured project${feat === 1 ? '' : 's'} on the home page`));
    rows.push(S.tokenExp ? row(new Date(S.tokenExp) - Date.now() < 7 * 864e5 ? 'warn' : 'ok', 'Token expires ' + new Date(S.tokenExp).toLocaleDateString(), 'Make a new token before this date.') : row('ok', 'Token expiry is not reported by GitHub for this token'));
    res.append(...rows);
  };
  return h('div', { class: 'page' }, head('Site health', 'A quick checkup of your content.', btn('Run check', { icon: 'refresh', kind: 'primary', onClick: run, busy: true })), card(null, null, res));
}

/* ---------- backup ---------- */
function backup() {
  const exportAll = () => {
    const data = { exportedAt: new Date().toISOString(), repo: `${CONFIG.owner}/${CONFIG.repo}`, files: {} };
    FILES.forEach((n) => (data.files[n] = D(n)));
    const a = h('a', { href: URL.createObjectURL(new Blob([pretty(data)], { type: 'application/json' })), download: `portfolio-backup-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const inp = h('input', { type: 'file', accept: 'application/json,.json', class: 'hidden', 'aria-label': 'Choose a backup file' });
  inp.addEventListener('change', async () => {
    const f = inp.files[0]; if (!f) return;
    try {
      const j = JSON.parse(await f.text()); if (!j.files) throw new Error('This is not a backup from this dashboard.');
      const names = Object.keys(j.files).filter((n) => FILES.includes(n));
      for (const n of names) if (Array.isArray(DEFAULTS[n]) !== Array.isArray(j.files[n])) throw new Error(`${n}.json has the wrong shape.`);
      if (!(await confirmBox('Import backup', `Load ${names.join(', ')} from this backup? It stays unsaved until you review and save.`, 'Load'))) return;
      names.forEach((n) => (S.files[n].data = clone(j.files[n]))); changed(); toast('Backup loaded. Review the changes and save.'); rerender();
    } catch (e) { toast(e.message, 'err'); }
    inp.value = '';
  });
  return h('div', { class: 'page' }, head('Backup', 'Keep a copy of all your content on your computer.'),
    h('div', { class: 'grid2' }, card('Download', null, h('p', { class: 'muted' }, 'One file with your profile, skills, projects, posts and page text. Photos are not included, they stay in your repository.'), btn('Download backup', { icon: 'download', kind: 'primary', onClick: exportAll })),
      card('Import', null, h('p', { class: 'muted' }, 'Load a backup file into the dashboard. Nothing changes on the site until you review and save.'), btn('Choose backup file', { icon: 'upload', onClick: () => inp.click() }), inp)),
    card('Unsaved changes', null, h('p', { class: 'muted' }, dirtyNames().length ? `Unsaved: ${dirtyNames().join(', ')}` : 'You have no unsaved changes.'), btn('Discard all unsaved changes', { icon: 'undo', kind: 'danger', onClick: async () => { if (!dirtyNames().length) return; if (await confirmBox('Discard changes', 'Throw away every unsaved change and reload from GitHub?', 'Discard', true)) { for (const n of dirtyNames()) { dropDraft(n); await loadFile(n); } changed(); rerender(); toast('Reloaded from GitHub.'); } } })));
}

/* ---------- raw json ---------- */
function raw() {
  const n = S.rawFile || 'projects';
  const ta = h('textarea', { class: 'code', spellcheck: 'false', 'aria-label': 'JSON', rows: 24 }); ta.value = pretty(D(n));
  const note = h('p', { class: 'msg' });
  ta.addEventListener('input', () => {
    try { const v = JSON.parse(ta.value); if (Array.isArray(DEFAULTS[n]) !== Array.isArray(v)) throw new Error('Must stay a ' + (Array.isArray(DEFAULTS[n]) ? 'list [ ]' : 'object { }')); S.files[n].data = v; note.className = 'msg ok'; note.textContent = 'Valid JSON, applied (unsaved)'; changed(); }
    catch (e) { note.className = 'msg err'; note.textContent = 'Not applied: ' + e.message; }
  });
  return h('div', { class: 'page' }, head('Raw JSON', 'Advanced. Edit any data file directly. Changes apply only while the JSON is valid.', btn('Format', { icon: 'code', onClick: () => { try { ta.value = pretty(JSON.parse(ta.value)); } catch (e) { toast('Fix the JSON first.', 'warn'); } } })),
    card(null, null, selectFld('File', n, FILES.map((f) => [f, `data/${f}.json`]), (v) => { S.rawFile = v; rerender(); }), ta, note));
}

/* ---------- settings ---------- */
function settings() {
  return h('div', { class: 'page' }, head('Settings & security'),
    h('div', { class: 'grid2' },
      card('Appearance', null, h('p', { class: 'muted' }, 'Switch between dark and light. Your choice is remembered on this device.'), btn('Switch theme', { icon: document.documentElement.dataset.theme === 'light' ? 'moon' : 'sun', onClick: () => { toggleTheme(); rerender(); } })),
      card('Session', null, h('p', { class: 'muted' }, `Signed in as ${S.user}. Locks after ${CONFIG.idleMinutes} idle minutes. ${S.tokenExp ? 'Token expires ' + new Date(S.tokenExp).toLocaleDateString() + '.' : ''}`),
        h('p', { class: 'muted' }, hasVault() ? 'An encrypted token is stored in this browser.' : 'No token is stored in this browser.'),
        h('div', { class: 'row-btns' }, btn('Lock now', { icon: 'lock', onClick: () => lock('Locked.') }), btn('Forget this device', { onClick: () => { vaultForget(); toast('Stored token removed.'); rerender(); } }), btn('Sign out', { kind: 'danger', onClick: () => { vaultForget(); lock('Signed out.'); } }))),
      card('Repository', null, h('p', { class: 'muted' }, `${CONFIG.owner}/${CONFIG.repo}`), h('p', { class: 'muted' }, `Branch: ${CONFIG.branch} · data folder: ${CONFIG.dataDir}/`), h('p', { class: 'muted' }, 'Every save is a commit to this branch.')),
      card('Shortcuts', null, h('p', { class: 'muted' }, 'Ctrl K  search and jump'), h('p', { class: 'muted' }, 'Ctrl S  review and save'), h('p', { class: 'muted' }, 'Ctrl B / I / U  bold, italic, underline in the editor'), h('p', { class: 'muted' }, 'Esc  close a window'))),
    card('Good practice', null, h('p', { class: 'muted' }, 'Use a fine-grained token limited to this repository with only "Contents: Read and write". Add "Pages: Read" if you want publish status. Set an expiry and keep GitHub two-factor on. Revoke the token in GitHub settings if a device is lost.')));
}

export const VIEWS = [
  ['overview', 'Overview', 'home', overview], ['site', 'Profile', 'user', profile], ['skills', 'Skills', 'skills', skills], ['projects', 'Projects', 'folder', projects],
  ['blog', 'Blog', 'pen', blog], ['media', 'Media', 'image', media], ['content', 'Page text', 'type', pageText],
  ['history', 'History', 'clock', history, 'Tools'], ['health', 'Site health', 'heart', health], ['backup', 'Backup', 'archive', backup], ['raw', 'Raw JSON', 'code', raw], ['settings', 'Settings', 'gear', settings],
];
export { newPost, importRepos };
