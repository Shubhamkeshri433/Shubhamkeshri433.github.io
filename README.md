# Shubham Keshri — portfolio

A scroll-driven, manga-style film of my journey (past, present, future), plus Skills, Projects, Blog and Connect pages and an owner-only dashboard. Plain HTML, CSS and JavaScript with a self-hosted Three.js bundle. Hosted on GitHub Pages: https://shubhamkeshri433.github.io

## What visitors see
- **Desktop:** the 3D scroll film (black-and-white manga look).
- **Phones, reduced-motion and `?static`:** a light page with the same content and no 3D (smooth, no battery drain). Add `?3d` to a phone address to force the animation.
- **Link previews** (WhatsApp, LinkedIn, X): `og-image.png` plus the Open Graph tags in every page head.

## Everything is editable from the dashboard
All text lives in `data/*.json`, so nothing needs code edits:

| File | Controls |
|---|---|
| `data/site.json` | name, role, intro, email, links, education, extra links |
| `data/skills.json` | skill categories and items |
| `data/projects.json` | projects (title, text, tech, link, featured) |
| `data/posts.json` | blog posts (Markdown, drafts) |
| `data/content.json` | every heading, caption and paragraph of the home story, page headings and intros, nav labels, footer, button labels |

Open `/admin/` (see `ADMIN.md` for setup). Tabs: Overview, Profile, Skills, Projects, Blog, Page text, Raw JSON, Security. **Raw JSON** edits any data file directly.

Things that stay in code (change the files by hand): the 3D scene, colours and layout (`css/manga.css`), the link-preview image (`og-image.png`) and the meta tags in each page head.

## Structure
- `index.html` the scroll film; its text is the fallback if data fails to load.
- `skills.html`, `projects.html`, `blog.html`, `connect.html` content pages (rendered by `js/pages.js`).
- `privacy.html`, `404.html` standalone pages.
- `admin/index.html`, `css/admin.css`, `js/admin.js`, `js/config.js` dashboard.
- `js/content.js` applies `content.json`; `js/hydrate.js` fills the home page; `js/md.js` safe Markdown; `js/dom.js` helpers (no `innerHTML` anywhere).
- `js/main.js`, `world.js`, `director.js`, `ui.js`, `path.js`, `shaders.js` the 3D film; `js/vendor/three.bundle.js` Three.js r186.
- `og-image.png` link preview, `favicon-32.png`, `favicon-192.png`, `favicon.ico`, `apple-touch-icon.png` tab icons (the SK logo), `robots.txt`.

## Security notes (this repo is public)
- No secrets are stored in the repo. The dashboard needs your own GitHub token, typed in the browser; it is never in a file. See `ADMIN.md`.
- Everything in `data/` is public. Only write what you want everyone to read.
- Never commit tokens, `.env` files or keys. `.gitignore` already skips build leftovers.

## Run locally
ES modules need a server: `python3 -m http.server`, then open http://localhost:8000.

## Rebuild the Three.js bundle
`THREE_SRC=/path/to/three.js ESBUILD=esbuild tools/build.sh`
