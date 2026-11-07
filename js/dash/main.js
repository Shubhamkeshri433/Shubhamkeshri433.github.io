/* Dashboard v2: sign-in, shell (sidebar, top bar, search), router, review-and-save. */
import { CONFIG, h, clear, S, FILES, initTheme, toggleTheme, toast, hasVault, vaultOpen, vaultSave, vaultForget, failDelay, verifyToken, lock, touch, loadAll, dirty, dirtyNames, saveFile, restoreDraft, dropDraft, pagesStatus, ago } from './core.js';
import { icon, btn, iconBtn, modal, diffView, fld, changed } from './ui.js';
import { VIEWS, validate, go, newPost, importRepos } from './views.js';

initTheme();
const app = document.getElementById('app');
const D = (n) => S.files[n].data;

/* ---------- sign-in ---------- */
function logo(size = 40) { return h('img', { class: 'logo', src: '../favicon-192.png', width: size, height: size, alt: 'SK logo' }); }
function loginScreen(note) {
  clear(app);
  if (S.cleanup) { S.cleanup(); S.cleanup = null; }
  const o = { token: '', pass: '', remember: false };
  const msg = h('p', { class: 'msg', role: 'alert' }, note || '');
  const tok = fld('GitHub access token', o, 'token', { type: 'password', ph: 'github_pat_…', hint: 'Fine-grained token with Contents: read & write on this repository only. Kept in memory.' });
  const pass = fld('Passphrase (only if you tick "remember")', o, 'pass', { type: 'password' });
  const rem = h('input', { type: 'checkbox', id: 'rem' }); rem.addEventListener('change', () => (o.remember = rem.checked));
  const unlockPass = { p: '' };
  const finish = async (token) => {
    await verifyToken(token); await loadAll(); S.fails = 0; touch(); start();
  };
  const submit = async (b) => {
    msg.textContent = '';
    try {
      if (!o.token.trim()) throw new Error('Paste your token first.');
      if (o.remember && o.pass.length < 10) throw new Error('Passphrase must be at least 10 characters.');
      await verifyToken(o.token.trim());
      if (o.remember) await vaultSave(o.token.trim(), o.pass);
      await loadAll(); S.fails = 0; touch(); start();
    } catch (e) { await failDelay(); msg.textContent = e.message; }
  };
  const form = h('div', { class: 'login-card' }, logo(56), h('h1', null, 'Shubham Keshri'), h('p', { class: 'sub' }, 'Owner dashboard'),
    hasVault() ? h('div', { class: 'stack' }, fld('Passphrase to unlock saved token', unlockPass, 'p', { type: 'password' }),
      btn('Unlock', { kind: 'primary', onClick: async () => { msg.textContent = ''; try { const t = await vaultOpen(unlockPass.p); await finish(t); } catch (e) { await failDelay(); msg.textContent = e.name === 'OperationError' ? 'Wrong passphrase.' : e.message; } } }),
      btn('Forget saved token', { onClick: () => { vaultForget(); loginScreen('Saved token removed.'); } }), h('hr')) : null,
    h('div', { class: 'stack' }, tok, h('label', { class: 'check', for: 'rem' }, rem, ' Remember on this device (encrypted)'), pass,
      btn('Sign in', { kind: 'primary', onClick: (e, b) => submit(b) })),
    msg, h('div', { class: 'login-foot' }, iconBtn('sun', 'Toggle light / dark', () => toggleTheme())));
  app.appendChild(h('div', { class: 'login' }, form));
  setTimeout(() => { const i = app.querySelector('input'); if (i) i.focus(); }, 30);
}
S.onLock = (reason) => { loginScreen(reason); };

/* ---------- shell ---------- */
let bar = {};
function counts() {
  return { blog: D('posts').length, projects: D('projects').length, skills: D('skills').reduce((a, c) => a + (c.items || []).length, 0) };
}
function refreshBar() {
  if (!bar.chip) return;
  const n = dirtyNames();
  bar.chip.textContent = n.length ? `${n.length} unsaved` : 'All saved';
  bar.chip.className = 'chip-status ' + (n.length ? 'warn' : 'ok');
  bar.review.disabled = !n.length; bar.save.disabled = !n.length;
  const c = counts();
  document.querySelectorAll('[data-count]').forEach((el) => { el.textContent = c[el.dataset.count]; });
}
S.refreshBar = refreshBar;

function route() {
  const t = (location.hash.match(/^#\/(\w+)/) || [])[1];
  S.tab = VIEWS.some((v) => v[0] === t) ? t : (S.tab || 'overview');
}
function render() {
  if (!S.token) return;
  const y = document.querySelector('.main') ? document.querySelector('.main').scrollTop : 0;
  if (S.cleanup) { S.cleanup(); S.cleanup = null; }
  clear(app);
  route();
  const c = counts();
  let lastSection = null;
  const nav = h('nav', { class: 'side', 'aria-label': 'Sections' }, h('div', { class: 'brand' }, logo(34), h('div', null, h('b', null, 'SK Dashboard'), h('small', null, CONFIG.owner))));
  VIEWS.forEach(([id, title, ic, , section]) => {
    if (section && section !== lastSection) { nav.appendChild(h('div', { class: 'nav-sec' }, section)); lastSection = section; }
    const a = h('a', { href: '#/' + id, class: 'nav' + (S.tab === id ? ' on' : '') }, icon(ic, 18), h('span', null, title), c[id] != null ? h('em', { 'data-count': id }, String(c[id])) : null);
    a.addEventListener('click', () => document.body.classList.remove('drawer'));
    nav.appendChild(a);
  });
  nav.appendChild(h('div', { class: 'side-foot' }, h('a', { href: '../', target: '_blank', rel: 'noopener' }, 'View site ↗'), h('button', { type: 'button', class: 'linkish', onClick: null }, 'Lock')));
  nav.querySelector('.linkish').addEventListener('click', () => lock('Locked.'));

  const chip = h('span', { class: 'chip-status ok' }, 'All saved');
  const live = h('span', { class: 'chip-status' }, 'Site');
  pagesStatus().then((p) => { if (!live.isConnected) return; if (p) { live.textContent = p.status === 'built' ? 'Live' : p.status === 'errored' ? 'Build failed' : 'Publishing…'; live.className = 'chip-status ' + (p.status === 'built' ? 'ok' : p.status === 'errored' ? 'bad' : 'warn'); } else live.remove(); });
  const review = btn('Review changes', { icon: 'eye', onClick: reviewModal });
  const save = btn('Save to GitHub', { icon: 'save', kind: 'primary', onClick: reviewModal });
  const searchBtn = h('button', { type: 'button', class: 'searchbox' }, icon('search', 16), h('span', null, 'Search or jump to…'), h('kbd', null, 'Ctrl K'));
  searchBtn.addEventListener('click', palette);
  const burger = iconBtn('menu', 'Menu', () => document.body.classList.toggle('drawer'));
  burger.classList.add('burger');
  const top = h('header', { class: 'top' }, burger, searchBtn, h('span', { class: 'grow' }), live, chip, iconBtn('sun', 'Switch light / dark theme', () => toggleTheme()), review, save);
  bar = { chip, review, save };

  const view = VIEWS.find((v) => v[0] === S.tab)[3];
  const main = h('main', { class: 'main', id: 'main' }, banner(), view());
  app.appendChild(h('div', { class: 'shell' }, nav, h('div', { class: 'col' }, top, main), h('div', { class: 'scrim' })));
  app.querySelector('.scrim').addEventListener('click', () => document.body.classList.remove('drawer'));
  refreshBar();
  main.scrollTop = y;
}
S.rerender = render;

function banner() {
  const names = Object.keys(S.drafts || {});
  if (!names.length) return null;
  return h('div', { class: 'banner' }, h('span', null, `Unsaved draft found for ${names.join(', ')} (from ${ago(new Date(Math.max(...names.map((n) => S.drafts[n].t))).toISOString())}).`),
    btn('Restore', { kind: 'primary', onClick: () => { names.forEach(restoreDraft); render(); } }), btn('Discard', { onClick: () => { names.forEach(dropDraft); render(); } }));
}

/* ---------- review & save ---------- */
function reviewModal() {
  const names = dirtyNames();
  if (!names.length) { toast('Nothing to save.', 'warn'); return; }
  for (const n of names) { const err = validate(n); if (err) { toast(err, 'err', 7000); return; } }
  const o = { msg: names.length === 1 ? `Dashboard: update ${names[0]}.json` : `Dashboard: update ${names.map((n) => n + '.json').join(', ')}` };
  const status = h('p', { class: 'msg' });
  const body = h('div', { class: 'stack' }, ...names.map((n) => h('details', { class: 'acc', open: names.length === 1 }, h('summary', null, `${n}.json`),
    diffView(JSON.stringify(JSON.parse(S.files[n].orig), null, 2), JSON.stringify(S.files[n].data, null, 2)))), fld('Commit message', o, 'msg'), status);
  const m = modal({ title: 'Review changes', body, wide: true, actions: [btn('Cancel', { onClick: () => m.close() }),
    btn('Save to GitHub', { icon: 'save', kind: 'primary', onClick: async (e, b) => {
      b.disabled = true; status.className = 'msg'; status.textContent = 'Saving…';
      try {
        for (const n of names) await saveFile(n, o.msg || undefined);
        m.close(); toast('Saved. Your site will update in about a minute.'); render();
      } catch (er) { status.className = 'msg err'; status.textContent = er.message; }
    } })] });
}
document.addEventListener('keydown', (e) => {
  if (!S.token) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); reviewModal(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); palette(); }
});
window.addEventListener('beforeunload', (e) => { if (S.token && dirtyNames().length) { e.preventDefault(); e.returnValue = ''; } });
window.addEventListener('hashchange', () => { if (S.token) render(); });

/* ---------- command palette ---------- */
function palette() {
  const items = [
    ...VIEWS.map((v) => ({ t: v[1], k: 'Go to', ic: v[2], run: () => go(v[0]) })),
    ...D('posts').map((p, i) => ({ t: p.title || 'Untitled', k: 'Post', ic: 'pen', run: () => { S.postIdx = i; go('blog'); } })),
    ...D('projects').map((p) => ({ t: p.title, k: 'Project', ic: 'folder', run: () => go('projects') })),
    { t: 'New post', k: 'Action', ic: 'plus', run: () => { S.tab = 'blog'; go('blog'); newPost(); } },
    { t: 'Import repos from GitHub', k: 'Action', ic: 'github', run: () => { go('projects'); importRepos(); } },
    { t: 'Toggle light / dark', k: 'Action', ic: 'sun', run: () => toggleTheme() },
    { t: 'Review & save changes', k: 'Action', ic: 'save', run: reviewModal },
  ];
  const q = { v: '' }; let sel = 0, shown = items;
  const input = h('input', { type: 'text', placeholder: 'Type to search…', 'aria-label': 'Search', autocomplete: 'off' });
  const list = h('div', { class: 'pal-list' });
  let m;
  const paint = () => {
    clear(list);
    shown = items.filter((i) => (i.t + ' ' + i.k).toLowerCase().includes(input.value.toLowerCase())).slice(0, 12);
    sel = Math.min(sel, Math.max(0, shown.length - 1));
    shown.forEach((it, i) => { const r = h('button', { type: 'button', class: 'pal-it' + (i === sel ? ' on' : '') }, icon(it.ic, 16), h('span', null, it.t), h('small', null, it.k)); r.addEventListener('click', () => { m.close(); it.run(); }); list.appendChild(r); });
    if (!shown.length) list.appendChild(h('p', { class: 'muted' }, 'No matches.'));
  };
  m = modal({ title: 'Search', body: h('div', null, input, list) });
  m.box.classList.add('pal');
  input.addEventListener('input', () => { sel = 0; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, shown.length - 1); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); paint(); }
    else if (e.key === 'Enter' && shown[sel]) { const it = shown[sel]; m.close(); it.run(); }
  });
  input.focus(); paint();
}

function start() { route(); if (!location.hash) location.hash = '#/overview'; render(); }
loginScreen();
