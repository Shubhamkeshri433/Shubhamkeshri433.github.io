/* Dashboard core: state, GitHub API, sign-in, encrypted "remember me", saving, history, theme, toasts. */
import { CONFIG } from '../config.js';
import { h, clear } from '../dom.js';

export { CONFIG, h, clear };
export const API = 'https://api.github.com';
export const FILES = ['site', 'skills', 'projects', 'posts', 'content'];
export const DEFAULTS = { site: {}, skills: [], projects: [], posts: [], content: {} };
export const repoPath = `/repos/${CONFIG.owner}/${CONFIG.repo}`;
export const S = { token: null, user: null, tokenExp: null, files: {}, local: {}, fails: 0, idle: null, rerender: () => {}, onLock: () => {} };

/* ---------- small helpers ---------- */
const enc = new TextEncoder(), dec = new TextDecoder();
export const toB64 = (str) => bytesB64(enc.encode(str));
export const fromB64 = (b) => dec.decode(b64Bytes(b.replace(/\s/g, '')));
export function bytesB64(u8) { let s = ''; const n = 0x8000; for (let i = 0; i < u8.length; i += n) s += String.fromCharCode.apply(null, u8.subarray(i, i + n)); return btoa(s); }
export const b64Bytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
export const clone = (x) => JSON.parse(JSON.stringify(x));
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const slugify = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const humanize = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
export const isHttps = (u) => /^https:\/\/\S+$/i.test(u);
export const ago = (iso) => {
  const s = Math.max(1, (Date.now() - new Date(iso).getTime()) / 1000);
  const t = [[60, 's'], [60, 'min'], [24, 'h'], [30, 'd'], [12, 'mo']]; let v = s, u = 's';
  for (const [d, n] of t) { u = n; if (v < d) break; v /= d; u = n === 'mo' ? 'y' : n; }
  return `${Math.floor(v)} ${u} ago`;
};

/* ---------- GitHub API ---------- */
export async function gh(path, opts = {}) {
  const res = await fetch(path.startsWith('http') ? path : API + path, {
    ...opts,
    headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + S.token, 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) },
    cache: 'no-store', referrerPolicy: 'no-referrer',
  });
  let body = null;
  try { body = await res.json(); } catch (e) { /* empty */ }
  if (!res.ok) { const e = new Error((body && body.message) || 'GitHub error ' + res.status); e.status = res.status; throw e; }
  gh.last = res;
  return body;
}

/* ---------- theme ---------- */
export function initTheme() {
  let t = null;
  try { t = localStorage.getItem('sk_dash_theme'); } catch (e) { /* ignore */ }
  if (t !== 'light' && t !== 'dark') t = matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
}
export function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('sk_dash_theme', t); } catch (e) { /* ignore */ }
  return t;
}

/* ---------- toasts ---------- */
export function toast(text, kind = 'ok', ms = 4200) {
  let box = document.getElementById('toasts');
  if (!box) { box = h('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.appendChild(box); }
  const t = h('div', { class: 'toast ' + kind }, text);
  box.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

/* ---------- vault (optional, encrypted token on this device) ---------- */
const VAULT_KEY = 'sk_admin_vault'; // same key as the old dashboard, so one passphrase works for both
async function deriveKey(pass, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function vaultSave(token, pass) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pass, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)));
  localStorage.setItem(VAULT_KEY, JSON.stringify({ s: bytesB64(salt), i: bytesB64(iv), c: bytesB64(ct) }));
}
export async function vaultOpen(pass) {
  const v = JSON.parse(localStorage.getItem(VAULT_KEY));
  const key = await deriveKey(pass, b64Bytes(v.s));
  return dec.decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64Bytes(v.i) }, key, b64Bytes(v.c)));
}
export const hasVault = () => { try { return !!localStorage.getItem(VAULT_KEY); } catch (e) { return false; } };
export const vaultForget = () => { try { localStorage.removeItem(VAULT_KEY); } catch (e) { /* ignore */ } };

/* ---------- sign-in, lock ---------- */
export async function failDelay() { S.fails++; await sleep(Math.min(1000 * 2 ** (S.fails - 1), 30000)); }
export async function verifyToken(token) {
  S.token = token;
  try {
    const user = await gh('/user');
    S.tokenExp = gh.last.headers.get('github-authentication-token-expiration');
    if (String(user.login).toLowerCase() !== CONFIG.owner.toLowerCase()) throw new Error('This token belongs to a different GitHub account. Access denied.');
    const repo = await gh(repoPath);
    if (!repo.permissions || !repo.permissions.push) throw new Error('This token cannot write to the repository.');
    S.user = user.login; S.avatar = user.avatar_url;
  } catch (e) { S.token = null; S.user = null; throw e; }
}
export function lock(reason) {
  S.token = null; S.user = null; S.files = {}; S.local = {}; S.media = null; S.repos = null;
  clearTimeout(S.idle);
  S.onLock(reason);
}
export function touch() {
  if (!S.token) return;
  clearTimeout(S.idle);
  S.idle = setTimeout(() => lock('Locked after ' + CONFIG.idleMinutes + ' minutes of inactivity.'), CONFIG.idleMinutes * 60000);
}
['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, touch, true));

/* ---------- data files ---------- */
const draftKey = (n) => 'sk_dash_draft_' + n;
export async function loadFile(n) {
  try {
    const r = await gh(`${repoPath}/contents/${CONFIG.dataDir}/${n}.json?ref=${encodeURIComponent(CONFIG.branch)}`);
    const data = JSON.parse(fromB64(r.content));
    S.files[n] = { data: clone(data), sha: r.sha, orig: JSON.stringify(data) };
  } catch (e) {
    if (e.status !== 404) throw e;
    S.files[n] = { data: clone(DEFAULTS[n]), sha: null, orig: JSON.stringify(DEFAULTS[n]) };
  }
}
export async function loadAll() { await Promise.all(FILES.map(loadFile)); S.drafts = {}; FILES.forEach(findDraft); }
export const dirty = (n) => !!S.files[n] && JSON.stringify(S.files[n].data) !== S.files[n].orig;
export const dirtyNames = () => FILES.filter(dirty);

/* autosave drafts: kept only in this browser, offered back after a crash or accidental close */
let draftTimer = 0;
export function autosave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(() => {
    try { FILES.forEach((n) => { if (dirty(n)) localStorage.setItem(draftKey(n), JSON.stringify({ base: S.files[n].orig, data: S.files[n].data, t: Date.now() })); else localStorage.removeItem(draftKey(n)); }); } catch (e) { /* ignore */ }
  }, 700);
}
function findDraft(n) {
  try {
    const d = JSON.parse(localStorage.getItem(draftKey(n)) || 'null');
    if (d && d.base === S.files[n].orig && JSON.stringify(d.data) !== S.files[n].orig) S.drafts[n] = d;
    else localStorage.removeItem(draftKey(n));
  } catch (e) { /* ignore */ }
}
export function restoreDraft(n) { if (S.drafts[n]) { S.files[n].data = clone(S.drafts[n].data); delete S.drafts[n]; } }
export function dropDraft(n) { try { localStorage.removeItem(draftKey(n)); } catch (e) { /* ignore */ } delete (S.drafts || {})[n]; }

export async function saveFile(n, message) {
  const f = S.files[n];
  const body = { message: message || `Dashboard: update ${n}.json`, content: toB64(JSON.stringify(f.data, null, 2) + '\n'), branch: CONFIG.branch };
  if (f.sha) body.sha = f.sha;
  try {
    const r = await gh(`${repoPath}/contents/${CONFIG.dataDir}/${n}.json`, { method: 'PUT', body: JSON.stringify(body) });
    f.sha = r.content.sha; f.orig = JSON.stringify(f.data); dropDraft(n);
  } catch (e) {
    if (e.status === 409 || e.status === 422) throw new Error(`${n}.json changed on GitHub since you opened it. Reload it from the History page, then redo your edit.`);
    throw e;
  }
}

/* sitemap.xml lists the published posts, so search engines find new ones */
export async function saveSitemap() {
  const B = `https://${CONFIG.owner.toLowerCase()}.github.io/`, esc = (u) => u.replace(/&/g, '&amp;');
  const urls = [[B], [B + 'projects.html'], [B + 'skills.html'], [B + 'blog.html'], [B + 'connect.html'],
    ...(S.files.posts.data || []).filter((p) => !p.draft && p.slug).map((p) => [B + 'blog.html?post=' + encodeURIComponent(p.slug), p.date])];
  const xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map(([u, d]) => `  <url><loc>${esc(u)}</loc>${d ? `<lastmod>${d}</lastmod>` : ''}</url>\n`).join('') + '</urlset>\n';
  let sha;
  try { const cur = await gh(`${repoPath}/contents/sitemap.xml?ref=${encodeURIComponent(CONFIG.branch)}`); if (fromB64(cur.content) === xml) return; sha = cur.sha; } catch (e) { /* not there yet */ }
  const body = { message: 'Dashboard: update sitemap.xml', content: toB64(xml), branch: CONFIG.branch }; if (sha) body.sha = sha;
  await gh(`${repoPath}/contents/sitemap.xml`, { method: 'PUT', body: JSON.stringify(body) });
}

/* ---------- history ---------- */
export async function listCommits(path, n = 20) {
  const q = new URLSearchParams({ sha: CONFIG.branch, per_page: String(n) });
  if (path) q.set('path', path);
  return gh(`${repoPath}/commits?${q}`);
}
export async function fileAt(n, ref) {
  const r = await gh(`${repoPath}/contents/${CONFIG.dataDir}/${n}.json?ref=${encodeURIComponent(ref)}`);
  return JSON.parse(fromB64(r.content));
}

/* ---------- publish status (needs "Pages: read"; silently skipped otherwise) ---------- */
export async function pagesStatus() {
  try { const b = await gh(`${repoPath}/pages/builds/latest`); return { status: b.status, at: b.updated_at }; } catch (e) { return null; }
}

/* ---------- media in assets/blog ---------- */
export const mediaDir = `${repoPath}/contents/assets/blog`;
export async function loadMedia() {
  try {
    const r = await gh(`${mediaDir}?ref=${encodeURIComponent(CONFIG.branch)}`);
    S.media = (Array.isArray(r) ? r : []).filter((x) => x.type === 'file' && /\.(webp|jpe?g|png|gif)$/i.test(x.name)).map((x) => ({ name: x.name, sha: x.sha, size: x.size }));
  } catch (e) { if (e.status === 404) S.media = []; else throw e; }
}
export async function uploadPhoto(blob, ext) {
  const rnd = crypto.getRandomValues(new Uint32Array(1))[0].toString(36).slice(0, 5);
  const name = `${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${rnd}.${ext}`;
  const content = bytesB64(new Uint8Array(await blob.arrayBuffer()));
  const r = await gh(`${mediaDir}/${name}`, { method: 'PUT', body: JSON.stringify({ message: `Dashboard: add photo ${name}`, content, branch: CONFIG.branch }) });
  const url = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(blob); });
  S.local['assets/blog/' + name] = url;
  if (S.media) S.media.unshift({ name, sha: r.content.sha, size: blob.size });
  return name;
}
export async function deletePhoto(m) {
  await gh(`${mediaDir}/${m.name}`, { method: 'DELETE', body: JSON.stringify({ message: `Dashboard: delete photo ${m.name}`, sha: m.sha, branch: CONFIG.branch }) });
  S.media = S.media.filter((x) => x !== m);
}
export const usedPhotos = () => {
  const used = new Map();
  for (const p of (S.files.posts ? S.files.posts.data : [])) for (const m of String(p.body || '').matchAll(/assets\/blog\/[A-Za-z0-9._-]+/g)) { const k = m[0].slice(12); (used.get(k) || used.set(k, []).get(k)).push(p.title || p.slug); }
  return used;
};

/* ---------- GitHub repos (for "Import from GitHub") ---------- */
export async function loadRepos() {
  const out = [];
  for (let page = 1; page <= 3; page++) {
    const r = await gh(`/users/${CONFIG.owner}/repos?per_page=100&sort=pushed&type=owner&page=${page}`);
    out.push(...r); if (r.length < 100) break;
  }
  S.repos = out;
}
