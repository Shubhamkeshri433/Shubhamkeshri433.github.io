# Shubham Keshri — portfolio

A scroll-driven, manga-style film of my journey (past, present, future), built with plain HTML, CSS and JavaScript plus a self-hosted Three.js bundle. Deployed on GitHub Pages.

## Design
Black-and-white manga page: angled panels, speed-line bursts, speech bubbles, halftone texture and a single red accent. The 3D sky, clouds and instrument are rendered in black and white with ink outlines, halftone dots and cel-shaded bands (see `GradeShader` in `js/shaders.js`).

## Structure
- `index.html` the scroll film. Its text is the fallback; `js/hydrate.js` fills name, role, contact links, toolbox and projects from `data/*.json` before the 3D scene starts.
- `skills.html`, `projects.html`, `blog.html`, `connect.html` content pages rendered by `js/pages.js` from the JSON files (DOM nodes only, no innerHTML). `js/md.js` is a safe Markdown renderer for blog posts; `js/dom.js` has small helpers.
- `data/site.json`, `skills.json`, `projects.json`, `posts.json` all editable content. Set `"draft": true` on a post to hide it.
- `css/manga.css` all styling, including the 404 and privacy pages.
- `js/main.js` entry, renderer and scroll smoothing. `js/world.js` the 3D scene. `js/director.js` camera path and per-chapter grading. `js/ui.js` fades story panels and drives the project card. `js/path.js` flight path and timing tables. `js/shaders.js` sky, clouds and the manga post-process.
- `js/vendor/three.bundle.js` Three.js r186, bundled by `tools/build.sh`.
- `404.html`, `privacy.html` standalone pages.

- `admin/index.html`, `css/admin.css`, `js/admin.js`, `js/config.js` owner-only dashboard that edits `data/*.json` through the GitHub API. Setup and security notes: `ADMIN.md`.

## Behaviour
- Without WebGL, with reduced motion, or with `?static`, the page shows a readable static layout with every project and link.
- `?fast` is a testing flag that skips the intro and snaps the scroll.

## Run locally
ES modules need a server: `python3 -m http.server`, then open http://localhost:8000.

## Rebuild the Three.js bundle
`THREE_SRC=/path/to/three.js ESBUILD=esbuild tools/build.sh`
