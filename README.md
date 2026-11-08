# Shubham Keshri · Portfolio Website

My personal portfolio site, live at **[shubhamkeshri433.github.io](https://shubhamkeshri433.github.io/)**.

On desktop it is a 3D scroll-through film in a black-and-white manga style. On phones, and for anyone who prefers reduced motion, it is a light, fast page with the same content.

## Pages

- **Home:** the story, featured projects and contact links
- **Skills:** skills grouped by category
- **Projects:** all projects with links
- **Blog:** write-ups and notes
- **Connect:** ways to reach me

## How it works

- **No build step.** Plain HTML, CSS and ES modules. Three.js is bundled in `js/vendor/` for the 3D scene.
- **Content lives in JSON.** Projects, skills, blog posts, page text and profile details are plain files in [`data/`](data). Changing them needs no rebuild.
- **Own dashboard.** An owner-only editor at `/dashboard/`, with a visual blog editor, project and skills managers, history with diffs and a site-health check. It saves straight to this repo through the GitHub API, and it does nothing without my GitHub token.
- **Safe by design.** No server and no database. Strict Content Security Policy, and a Markdown renderer that never uses `innerHTML`.
- **SEO.** Sitemap, canonical links, structured data and per-post descriptions.
- **Hosting.** GitHub Pages.

## Folder guide

```text
├── index.html, blog.html, projects.html, skills.html, connect.html
├── data/        site content (JSON)
├── dashboard/   owner-only editor
├── css/         site theme and dashboard theme
├── js/          site code, Markdown renderer, 3D scene, dashboard
├── sitemap.xml  kept up to date by the dashboard
└── ADMIN.md     how the dashboard works and how to keep it safe
```

## Run it locally

No install needed. From the repo folder:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Contact

[LinkedIn](https://www.linkedin.com/in/shubhamkeshri433/) · [shubhamkeshri.433@gmail.com](mailto:shubhamkeshri.433@gmail.com)
