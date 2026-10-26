/** DOM side of the film: fades each beat in and out by scroll progress, drives HUD. */
import { smooth, easeOutBack, clamp } from './util.js';
import { FRAME_P } from './path.js';

export function createUI() {
  const FADE = 0.022;
  const beats = [...document.querySelectorAll('.beat')].map((el) => ({
    el,
    a: parseFloat(el.dataset.a),
    b: parseFloat(el.dataset.b),
    sfx: el.querySelector('.sfx'),
    op: -1,
  }));

  /* project card: content follows scroll position, so nothing depends on hovering */
  const items = [...document.querySelectorAll('.work-list li')].map((li) => ({
    title: li.querySelector('strong').textContent.trim(),
    desc: li.querySelector('span').textContent.trim(),
    badge: li.dataset.badge,
    tech: li.dataset.tech.split(','),
    url: li.querySelector('a').href,
  }));
  const card = document.querySelector('.work-card');
  const wc = { cap: document.getElementById('wcCap'), title: document.getElementById('wcTitle'), desc: document.getElementById('wcDesc'),
    tech: document.getElementById('wcTech'), link: document.getElementById('wcLink'), nav: document.getElementById('wcNav') };
  let activeProject = -1, jump = () => {};
  const navBtns = items.map((it, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = String(i + 1).padStart(2, '0'); b.title = it.title; b.setAttribute('aria-label', `Project ${i + 1}: ${it.title}`);
    b.addEventListener('click', () => jump(FRAME_P[i]));
    wc.nav.appendChild(b);
    return b;
  });
  function showProject(i) {
    const it = items[i];
    wc.cap.textContent = `Project ${String(i + 1).padStart(2, '0')} / ${String(items.length).padStart(2, '0')} \u00b7 ${it.badge}`;
    wc.title.textContent = it.title;
    wc.desc.textContent = it.desc;
    wc.tech.replaceChildren(...it.tech.map((t) => { const li = document.createElement('li'); li.textContent = t; return li; }));
    wc.link.href = it.url;
    wc.link.setAttribute('aria-label', `Open ${it.title} repository on GitHub`);
    navBtns.forEach((b, k) => { b.classList.toggle('on', k === i); if (k === i) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
    card.classList.remove('swap'); void card.offsetWidth; card.classList.add('swap');
  }

  function update(p) {
    for (const b of beats) {
      const inn = b.a <= 0 ? 1 : smooth(b.a, b.a + FADE, p);
      const out = b.b >= 1 ? 1 : 1 - smooth(b.b - FADE, b.b, p);
      const op = Math.min(inn, out);
      const ty = (1 - inn) * 26 - (1 - out) * 26;
      if (Math.abs(op - b.op) > 0.002 || b.op < 0) {
        b.op = op;
        b.el.style.opacity = op.toFixed(3);
        b.el.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0)`;
        b.el.classList.toggle('live', op > 0.01);
        b.el.inert = op < 0.4;
        if (b.sfx) {
          const k = 0.55 + 0.45 * easeOutBack(clamp((p - b.a - 0.01) / 0.03));
          b.sfx.style.setProperty('--k', k.toFixed(3));
        }
      }
    }
    let near = 0, nd = 9;
    FRAME_P.forEach((fp, i) => { const d = Math.abs(p - fp); if (d < nd) { nd = d; near = i; } });
    if (near !== activeProject && items.length) { activeProject = near; showProject(near); }
  }

  function bind(scrollToP) {
    jump = scrollToP;
    document.querySelectorAll('[data-go]').forEach((a) => {
      a.addEventListener('click', (e) => { e.preventDefault(); scrollToP(parseFloat(a.dataset.go)); });
    });
  }

  return { update, bind };
}
