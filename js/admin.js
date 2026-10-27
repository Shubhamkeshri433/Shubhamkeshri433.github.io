import { CONFIG } from './config.js';
import { h, clear } from './dom.js';
import { renderMarkdown } from './md.js';

const API = 'https://api.github.com';
const VAULT_KEY = 'sk_admin_vault';
const FILES = ['site', 'skills', 'projects', 'posts', 'content'];
const $app = document.getElementById('app');

const S = { token: null, user: null, files: {}, tab: 'overview', postIdx: 0, msg: {}, idle: null, fails: 0 };

/* ---------- helpers ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
const toB64 = (str) => { let s = ''; enc.encode(str).forEach((b) => (s += String.fromCharCode(b))); return btoa(s); };
const fromB64 = (b) => { const s = atob(b.replace(/\s/g, '')); return dec.decode(Uint8Array.from(s, (c) => c.charCodeAt(0))); };
const bytesB64 = (u8) => { let s = ''; u8.forEach((b) => (s += String.fromCharCode(b))); return btoa(s); };
const b64Bytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const clone = (x) => JSON.parse(JSON.stringify(x));
const list = (s) => String(s).split(',').map((x) => x.trim()).filter(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isHttps = (u) => /^https:\/\/\S+$/i.test(u);

async function gh(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + S.token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
    cache: 'no-store', referrerPolicy: 'no-referrer',
  });
  let body = null;
  try { body = await res.json(); } catch (e) { /* empty */ }
  if (!res.ok) { const e = new Error((body && body.message) || 'GitHub error ' + res.status); e.status = res.status; throw e; }
  return body;
}
const repoPath = `/repos/${CONFIG.owner}/${CONFIG.repo}`;

/* ---------- vault (optional, encrypted token on this device) ---------- */
async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
async function vaultSave(token, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)));
  localStorage.setItem(VAULT_KEY, JSON.stringify({ s: bytesB64(salt), i: bytesB64(iv), c: bytesB64(ct) }));
}
async function vaultOpen(pass) {
  const v = JSON.parse(localStorage.getItem(VAULT_KEY));
  const key = await deriveKey(pass, b64Bytes(v.s));
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64Bytes(v.i) }, key, b64Bytes(v.c)));
}
const hasVault = () => { try { return !!localStorage.getItem(VAULT_KEY); } catch (e) { return false; } };
const vaultForget = () => { try { localStorage.removeItem(VAULT_KEY); } catch (e) { /* ignore */ } };

/* ---------- auth ---------- */
async function failDelay() { S.fails++; await sleep(Math.min(1000 * 2 ** (S.fails - 1), 30000)); }

async function verifyToken(token) {
  S.token = token;
  try {
    const user = await gh('/user');
    if (String(user.login).toLowerCase() !== CONFIG.owner.toLowerCase()) throw new Error('This token belongs to a different GitHub account. Access denied.');
    const repo = await gh(repoPath);
    if (!repo.permissions || !repo.permissions.push) throw new Error('This token cannot write to the repository.');
    S.user = user.login;
  } catch (e) { S.token = null; S.user = null; throw e; }
}

function lock(reason) {
  S.token = null; S.user = null; S.files = {}; S.msg = {};
  clearTimeout(S.idle);
  renderLogin(reason);
}
function touch() {
  if (!S.token) return;
  clearTimeout(S.idle);
  S.idle = setTimeout(() => lock('Locked after ' + CONFIG.idleMinutes + ' minutes of inactivity.'), CONFIG.idleMinutes * 60000);
}
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, touch, true));

/* ---------- data ---------- */
const DEFAULTS = { site: {}, skills: [], projects: [], posts: [], content: {} };
async function loadAll() {
  await Promise.all(FILES.map(async (n) => {
    try {
      const r = await gh(`${repoPath}/contents/${CONFIG.dataDir}/${n}.json?ref=${encodeURIComponent(CONFIG.branch)}`);
      const data = JSON.parse(fromB64(r.content));
      S.files[n] = { data: clone(data), sha: r.sha, orig: JSON.stringify(data) };
    } catch (e) {
      if (e.status !== 404) throw e;
      S.files[n] = { data: clone(DEFAULTS[n]), sha: null, orig: JSON.stringify(DEFAULTS[n]) };
    }
  }));
}
const dirty = (n) => S.files[n] && JSON.stringify(S.files[n].data) !== S.files[n].orig;

async function saveFile(n, message) {
  const f = S.files[n];
  const body = { message: message || `Dashboard: update ${n}.json`, content: toB64(JSON.stringify(f.data, null, 2) + '\n'), branch: CONFIG.branch };
  if (f.sha) body.sha = f.sha;
  try {
    const r = await gh(`${repoPath}/contents/${CONFIG.dataDir}/${n}.json`, { method: 'PUT', body: JSON.stringify(body) });
    f.sha = r.content.sha; f.orig = JSON.stringify(f.data);
    return 'Saved. The live site updates in about a minute.';
  } catch (e) {
    if (e.status === 409 || e.status === 422) throw new Error('This file changed on GitHub since you opened it. Use "Reload from GitHub", then re-apply your edit.');
    throw e;
  }
}

/* ---------- UI building blocks ---------- */
const msgEl = (key) => h('p', { class: 'msg' + (S.msg[key] ? ' ' + S.msg[key].kind : ''), role: 'status' }, S.msg[key] ? S.msg[key].text : '');
const setMsg = (key, kind, text) => { S.msg[key] = { kind, text }; };

function field(label, value, onInput, opts = {}) {
  const tag = opts.area ? 'textarea' : 'input';
  const el = h(tag, { value, type: opts.area ? null : (opts.type || 'text'), class: opts.big ? 'big' : null, placeholder: opts.ph || null, autocomplete: 'off', spellcheck: opts.area ? 'true' : 'false' });
  el.addEventListener('input', () => { onInput(el.value); markDirty(); });
  const id = 'f' + Math.random().toString(36).slice(2, 8);
  el.id = id;
  return h('div', null, h('label', { for: id }, label), el);
}
function check(label, value, onChange) {
  const el = h('input', { type: 'checkbox', checked: value });
  el.addEventListener('change', () => { onChange(el.checked); markDirty(); });
  return h('label', null, el, label);
}
function markDirty() {
  const d = document.getElementById('dirtyflag');
  if (d) d.textContent = dirty(S.tab === 'raw' ? S.raw : S.tab) ? 'Unsaved changes' : '';
}
function saveBar(n, validate) {
  const btn = h('button', { type: 'button' }, 'Save to GitHub');
  btn.addEventListener('click', async () => {
    const err = validate ? validate() : null;
    if (err) { setMsg(n, 'err', err); return render(); }
    btn.disabled = true; setMsg(n, '', 'Saving…'); render();
    try { setMsg(n, 'ok', await saveFile(n)); } catch (e) { setMsg(n, 'err', e.message); }
    render();
  });
  const rel = h('button', { type: 'button', class: 'alt' }, 'Reload from GitHub');
  rel.addEventListener('click', async () => {
    try { await loadAll(); setMsg(n, 'ok', 'Reloaded.'); } catch (e) { setMsg(n, 'err', e.message); }
    render();
  });
  return h('div', null, btn, rel, h('span', { class: 'dirty', id: 'dirtyflag' }, dirty(n) ? 'Unsaved changes' : ''), msgEl(n));
}
function mover(arr, i, after) {
  const mk = (txt, fn, cls) => { const b = h('button', { type: 'button', class: cls || 'alt', 'aria-label': txt }, txt); b.addEventListener('click', () => { fn(); after(); }); return b; };
  return [
    i > 0 && mk('↑', () => arr.splice(i - 1, 0, arr.splice(i, 1)[0])),
    i < arr.length - 1 && mk('↓', () => arr.splice(i + 1, 0, arr.splice(i, 1)[0])),
    mk('Delete', () => { if (confirm('Delete this item?')) arr.splice(i, 1); }, 'danger'),
  ];
}

/* ---------- tabs ---------- */
function tabOverview() {
  const f = S.files;
  const pub = (f.posts.data || []).filter((p) => !p.draft).length;
  return h('div', { class: 'card' }, h('h2', null, 'Overview'),
    h('div', { class: 'stats' },
      ...[['Skill groups', f.skills.data.length], ['Projects', f.projects.data.length], ['Posts live', pub], ['Drafts', f.posts.data.length - pub]]
        .map(([k, v]) => h('div', { class: 'stat' }, h('b', null, v), k))),
    h('p', { class: 'note' }, `Signed in as ${S.user}. Every save is a commit to ${CONFIG.owner}/${CONFIG.repo} on "${CONFIG.branch}".`));
}

function tabProfile() {
  const d = S.files.site.data;
  d.extra = d.extra || [];
  const rows = [['Name', 'name'], ['Role', 'role'], ['Location', 'location'], ['Email', 'email'], ['GitHub URL', 'github'], ['LinkedIn URL', 'linkedin'], ['Education line', 'education'], ['Availability line', 'availability']];
  return h('div', { class: 'card' }, h('h2', null, 'Profile & Contact'),
    h('div', { class: 'row' }, ...rows.map(([l, k]) => field(l, d[k] || '', (v) => (d[k] = v)))),
    field('Intro (home page lead)', d.lead || '', (v) => (d.lead = v), { area: true }),
    h('h3', null, 'Extra links'),
    ...d.extra.map((l, i) => h('div', { class: 'item' }, h('div', { class: 'row' }, field('Label', l.label || '', (v) => (l.label = v)), field('URL', l.url || '', (v) => (l.url = v))), ...mover(d.extra, i, render))),
    (() => { const b = h('button', { type: 'button', class: 'alt' }, '+ Add link'); b.addEventListener('click', () => { d.extra.push({ label: '', url: 'https://' }); render(); }); return b; })(),
    saveBar('site', () => {
      if (!d.name.trim()) return 'Name is required.';
      if (d.email && !/^\S+@\S+\.\S+$/.test(d.email)) return 'Email looks invalid.';
      for (const u of [d.github, d.linkedin, ...d.extra.map((l) => l.url)]) if (u && !isHttps(u)) return 'Links must start with https://';
      return null;
    }));
}

function tabSkills() {
  const d = S.files.skills.data;
  return h('div', { class: 'card' }, h('h2', null, 'Skills'),
    ...d.map((c, i) => h('div', { class: 'item' },
      field('Category', c.category || '', (v) => (c.category = v)),
      field('Items (comma separated)', (c.items || []).join(', '), (v) => (c.items = list(v)), { area: true }),
      ...mover(d, i, render))),
    (() => { const b = h('button', { type: 'button', class: 'alt' }, '+ Add category'); b.addEventListener('click', () => { d.push({ category: '', items: [] }); render(); }); return b; })(),
    saveBar('skills', () => (d.some((c) => !c.category.trim()) ? 'Every category needs a name.' : null)));
}

const slugOk = (s) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(s);
function tabProjects() {
  const d = S.files.projects.data;
  return h('div', { class: 'card' }, h('h2', null, 'Projects'),
    h('p', { class: 'note' }, 'Featured projects appear in the home-page film (the first 8).'),
    ...d.map((p, i) => h('div', { class: 'item' },
      h('div', { class: 'row' }, field('Title', p.title || '', (v) => (p.title = v)), field('ID (lowercase-with-dashes)', p.id || '', (v) => (p.id = v)),
        field('Badge / category', p.badge || '', (v) => (p.badge = v)), field('Repository / link (https)', p.url || '', (v) => (p.url = v))),
      field('Description', p.desc || '', (v) => (p.desc = v), { area: true }),
      field('Tech (comma separated)', (p.tech || []).join(', '), (v) => (p.tech = list(v))),
      check('Featured on home page', p.featured, (v) => (p.featured = v)),
      h('div', null, ...mover(d, i, render)))),
    (() => { const b = h('button', { type: 'button', class: 'alt' }, '+ Add project'); b.addEventListener('click', () => { d.push({ id: '', title: '', badge: '', desc: '', tech: [], url: 'https://', featured: true }); render(); }); return b; })(),
    saveBar('projects', () => {
      const ids = new Set();
      for (const p of d) {
        if (!p.title.trim()) return 'Every project needs a title.';
        if (!slugOk(p.id)) return `Project ID "${p.id}" must be lowercase letters, numbers and dashes.`;
        if (ids.has(p.id)) return `Duplicate project ID "${p.id}".`;
        ids.add(p.id);
        if (p.url && !isHttps(p.url)) return `"${p.title}": link must start with https://`;
      }
      return null;
    }));
}

function tabBlog() {
  const d = S.files.posts.data;
  if (S.postIdx >= d.length) S.postIdx = Math.max(0, d.length - 1);
  const p = d[S.postIdx];
  const sel = h('select', { 'aria-label': 'Choose post' }, ...d.map((x, i) => h('option', { value: i }, (x.draft ? '[draft] ' : '') + (x.title || x.slug || 'untitled'))));
  sel.value = String(S.postIdx);
  sel.addEventListener('change', () => { S.postIdx = +sel.value; render(); });
  const add = h('button', { type: 'button', class: 'alt' }, '+ New post');
  add.addEventListener('click', () => { d.unshift({ slug: '', title: '', date: new Date().toISOString().slice(0, 10), summary: '', tags: [], draft: true, body: '' }); S.postIdx = 0; render(); });
  const parts = [h('h2', null, 'Blog'), h('label', null, 'Post'), sel, add];
  if (p) {
    const prev = h('div', { class: 'preview', 'aria-label': 'Preview' });
    const upd = () => { clear(prev); prev.appendChild(renderMarkdown(p.body)); };
    upd();
    const bodyField = field('Body (Markdown)', p.body || '', (v) => { p.body = v; upd(); }, { area: true, big: true });
    const del = h('button', { type: 'button', class: 'danger' }, 'Delete post');
    del.addEventListener('click', () => { if (confirm('Delete this post?')) { d.splice(S.postIdx, 1); render(); } });
    parts.push(
      h('div', { class: 'row' }, field('Title', p.title || '', (v) => (p.title = v)), field('Slug (lowercase-with-dashes)', p.slug || '', (v) => (p.slug = v)),
        field('Date (YYYY-MM-DD)', p.date || '', (v) => (p.date = v)), field('Tags (comma separated)', (p.tags || []).join(', '), (v) => (p.tags = list(v)))),
      field('Summary', p.summary || '', (v) => (p.summary = v), { area: true }),
      check('Draft (hidden from the public site)', p.draft, (v) => (p.draft = v)),
      bodyField, h('label', null, 'Preview'), prev, del);
  } else parts.push(h('p', { class: 'note' }, 'No posts yet. Click "New post".'));
  parts.push(saveBar('posts', () => {
    const slugs = new Set();
    for (const x of d) {
      if (!x.title.trim()) return 'Every post needs a title.';
      if (!slugOk(x.slug)) return `Slug "${x.slug}" must be lowercase letters, numbers and dashes.`;
      if (slugs.has(x.slug)) return `Duplicate slug "${x.slug}".`;
      slugs.add(x.slug);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(x.date)) return `"${x.title}": date must look like 2026-10-26.`;
    }
    return null;
  }));
  return h('div', { class: 'card' }, ...parts);
}

function tabSecurity() {
  const forget = h('button', { type: 'button', class: 'alt' }, 'Forget this device');
  forget.addEventListener('click', () => { vaultForget(); setMsg('sec', 'ok', 'Stored token removed from this browser.'); render(); });
  const out = h('button', { type: 'button', class: 'danger' }, 'Sign out & lock');
  out.addEventListener('click', () => { vaultForget(); lock('Signed out.'); });
  const lk = h('button', { type: 'button' }, 'Lock now');
  lk.addEventListener('click', () => lock('Locked.'));
  return h('div', { class: 'card' }, h('h2', null, 'Security'),
    h('p', { class: 'note' }, `Only a token for ${CONFIG.owner} with write access to ${CONFIG.repo} can unlock this dashboard. It auto-locks after ${CONFIG.idleMinutes} idle minutes.`),
    h('p', { class: 'note' }, hasVault() ? 'An encrypted token is stored in this browser (passphrase protected).' : 'No token is stored in this browser.'),
    lk, forget, out, msgEl('sec'),
    h('h3', null, 'Good practice'),
    h('p', { class: 'note' }, 'Use a fine-grained token limited to this repository with only "Contents: Read and write", set an expiry, and keep GitHub two-factor authentication on. Revoke the token in GitHub settings if a device is lost.'));
}

/* Page text: a form built from data/content.json, so every word on the site can be changed. */
const humanize = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/^./, (c) => c.toUpperCase());
function deepFields(obj, depth = 0) {
  const out = [];
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      out.push(h('fieldset', { class: 'group' }, h('legend', null, humanize(k)), ...deepFields(v, depth + 1)));
    } else if (Array.isArray(v)) {
      out.push(field(humanize(k) + ' (comma separated)', v.join(', '), (x) => (obj[k] = list(x))));
    } else {
      const val = v == null ? '' : String(v);
      out.push(field(humanize(k), val, (x) => (obj[k] = x), { area: val.length > 70 || /body|intro|quote/i.test(k) }));
    }
  }
  return out;
}
function tabContent() {
  const d = S.files.content.data;
  return h('div', { class: 'card' }, h('h2', null, 'Page text'),
    h('p', { class: 'note' }, 'Every heading, caption and paragraph on the home story and the Skills, Projects, Blog and Connect pages. In paragraphs you can use **bold**, *italic* and [links](https://…). Leave a box empty to keep the built-in text.'),
    ...deepFields(d), saveBar('content', null));
}

/* Raw JSON: edit any data file directly, for anything the forms do not cover. */
function tabRaw() {
  const names = FILES;
  S.raw = S.raw || names[0];
  const sel = h('select', { 'aria-label': 'Choose data file' }, ...names.map((n) => h('option', { value: n }, `data/${n}.json`)));
  sel.value = S.raw;
  sel.addEventListener('change', () => { S.raw = sel.value; render(); });
  const f = S.files[S.raw];
  const ta = h('textarea', { class: 'big', spellcheck: 'false', 'aria-label': 'JSON' });
  ta.value = JSON.stringify(f.data, null, 2);
  const note = h('p', { class: 'msg' });
  ta.addEventListener('input', () => {
    try { f.data = JSON.parse(ta.value); note.className = 'msg ok'; note.textContent = 'Valid JSON'; } catch (e) { note.className = 'msg err'; note.textContent = 'Not valid JSON yet: ' + e.message; }
    markDirty();
  });
  const raw = S.raw;
  return h('div', { class: 'card' }, h('h2', null, 'Raw JSON'),
    h('p', { class: 'note' }, 'Advanced. Changes apply only while the JSON is valid. Keep the same shape as the original or the site may show less.'),
    sel, ta, note,
    saveBar(raw, () => {
      try { JSON.parse(ta.value); } catch (e) { return 'Fix the JSON first: ' + e.message; }
      return Array.isArray(DEFAULTS[raw]) !== Array.isArray(f.data) ? 'This file must stay a ' + (Array.isArray(DEFAULTS[raw]) ? 'list [ ]' : 'object { }') + '.' : null;
    }));
}

const TABS = [['overview', 'Overview', tabOverview], ['site', 'Profile', tabProfile], ['skills', 'Skills', tabSkills], ['projects', 'Projects', tabProjects], ['posts', 'Blog', tabBlog], ['content', 'Page text', tabContent], ['raw', 'Raw JSON', tabRaw], ['security', 'Security', tabSecurity]];

function render() {
  if (!S.token) return;
  const y = window.scrollY;
  const view = TABS.find((t) => t[0] === S.tab) || TABS[0];
  clear($app).appendChild(h('div', { class: 'wrap' },
    h('div', { class: 'bar' }, h('h1', null, 'Dashboard'), h('span', { class: 'who' }, 'Signed in: ' + S.user)),
    h('nav', { class: 'tabs', 'aria-label': 'Sections' }, ...TABS.map(([k, label]) => {
      const b = h('button', { type: 'button', class: S.tab === k ? 'on' : '', 'aria-current': S.tab === k ? 'page' : null }, label);
      b.addEventListener('click', () => { S.tab = k; render(); window.scrollTo(0, 0); });
      return b;
    })),
    view[2]()));
  window.scrollTo(0, y);
}

/* ---------- login / unlock ---------- */
function renderLogin(notice) {
  const vault = hasVault();
  const box = h('div', { class: 'card login' }, h('h1', null, 'Owner login'));
  const msg = h('p', { class: 'msg err', role: 'alert' }, notice || '');
  const go = async (fn, btn) => {
    btn.disabled = true; msg.className = 'msg'; msg.textContent = 'Checking…';
    try { await fn(); S.fails = 0; await loadAll(); touch(); render(); }
    catch (e) { await failDelay(); S.token = null; msg.className = 'msg err'; msg.textContent = e.message; btn.disabled = false; }
  };
  if (vault) {
    const pass = h('input', { type: 'password', id: 'pp', autocomplete: 'current-password' });
    const b = h('button', { type: 'submit' }, 'Unlock');
    const other = h('button', { type: 'button', class: 'alt' }, 'Use a different token');
    other.addEventListener('click', () => { vaultForget(); renderLogin(); });
    box.append(h('p', { class: 'note' }, 'Enter your passphrase to unlock the token stored on this device.'), h('form', { id: 'lf' }, h('label', { for: 'pp' }, 'Passphrase'), pass, b, other));
    box.querySelector('#lf').addEventListener('submit', (e) => { e.preventDefault(); go(async () => { let t; try { t = await vaultOpen(pass.value); } catch (x) { throw new Error('Wrong passphrase.'); } await verifyToken(t); }, b); });
  } else {
    const tok = h('input', { type: 'password', id: 'tk', autocomplete: 'off', spellcheck: 'false' });
    const rem = h('input', { type: 'checkbox', id: 'rm' });
    const pp = h('input', { type: 'password', id: 'np', autocomplete: 'new-password', placeholder: 'Passphrase (min 10 characters)' });
    const b = h('button', { type: 'submit' }, 'Sign in');
    box.append(h('p', { class: 'note' }, `Paste a GitHub fine-grained personal access token for ${CONFIG.owner}/${CONFIG.repo} (Contents: read and write). It stays in memory unless you choose to remember it.`),
      h('form', { id: 'lf' }, h('label', { for: 'tk' }, 'GitHub token'), tok,
        h('label', { for: 'rm' }, rem, 'Remember on this device (encrypted)'), pp, b));
    box.querySelector('#lf').addEventListener('submit', (e) => {
      e.preventDefault();
      go(async () => {
        const t = tok.value.trim();
        if (!t) throw new Error('Paste your token first.');
        if (rem.checked && pp.value.length < 10) throw new Error('Choose a passphrase of at least 10 characters.');
        await verifyToken(t);
        if (rem.checked) await vaultSave(t, pp.value);
        tok.value = '';
      }, b);
    });
  }
  box.append(msg);
  clear($app).appendChild(box);
}

renderLogin();
