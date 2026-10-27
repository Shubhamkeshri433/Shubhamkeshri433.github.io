/**
 * Entry point. Starts the 3D film if the browser can run it; otherwise the page
 * simply stays as the readable static layout (no JS needed for any content).
 */
const params = location.search;
/* The inline script in index.html decided before first paint whether this visitor gets the 3D film (class "cine").
   Phones, reduced-motion and ?static get the light page: no 3D code is downloaded, only the text is filled in. */
if (document.documentElement.classList.contains('cine')) {
  start().catch((err) => {
    console.warn('Cinematic mode unavailable, showing static page.', err);
    document.documentElement.classList.remove('cine');
    import('./hydrate.js').then((m) => m.hydrate()).catch(() => {});
  });
} else {
  import('./hydrate.js').then((m) => m.hydrate()).catch(() => {});
}

async function start() {
  const THREE = await import('./vendor/three.bundle.js');
  const { createWorld } = await import('./world.js');
  const { createDirector } = await import('./director.js');
  const { createUI } = await import('./ui.js');
  const { GradeShader } = await import('./shaders.js');
  const { pToU, setFrameCount } = await import('./path.js');
  const { hydrate } = await import('./hydrate.js');
  await hydrate().catch(() => {});
  const { smooth, clamp, lerp } = await import('./util.js');

  const canvas = document.getElementById('gl');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', alpha: false });
  if (!renderer.capabilities.isWebGL2 && renderer.capabilities.maxTextures < 8) throw new Error('weak GPU');
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  const small = Math.min(innerWidth, innerHeight) < 700;
  const weak = (navigator.hardwareConcurrency || 4) <= 4 || small;
  const quality = { low: weak, puffs: weak ? 110 : 190, octaves: weak ? 3 : 5 };
  let maxDpr = Math.min(devicePixelRatio || 1, weak ? 1.25 : 1.75);
  let dpr = maxDpr;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(52, innerWidth / innerHeight, 0.1, 400);
  camera.position.set(0, 0.3, 12);

  const projects = [...document.querySelectorAll('.work-list li')].map((li) => ({
    title: li.querySelector('strong').textContent.trim(),
    desc: li.querySelector('span').textContent.trim(),
    badge: li.dataset.badge,
    tech: li.dataset.tech.split(','),
    url: li.querySelector('a').href,
  }));

  setFrameCount(projects.length);
  const world = createWorld({ scene, camera, renderer, quality, projects });
  const director = createDirector({ camera });
  const ui = createUI();

  const composer = new THREE.EffectComposer(renderer);
  composer.addPass(new THREE.RenderPass(scene, camera));
  const bloom = new THREE.UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.45, 0.55, 0.9);
  composer.addPass(bloom);
  composer.addPass(new THREE.OutputPass());
  const gradePass = new THREE.ShaderPass(GradeShader);
  composer.addPass(gradePass);
  const GU = gradePass.uniforms;

  function resize() {
    const w = innerWidth, h = innerHeight;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    composer.setPixelRatio(dpr);
    composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    world.resize(camera.aspect, dpr);
    GU.uRes.value = [w * dpr, h * dpr];
  }
  resize();
  addEventListener('resize', resize);

  /* pointer */
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = -((e.clientY / innerHeight) * 2 - 1);
  }, { passive: true });

  /* scroll */
  let target = 0;
  const readScroll = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    target = max > 0 ? clamp(scrollY / max) : 0;
  };
  readScroll();
  addEventListener('scroll', readScroll, { passive: true });
  addEventListener('resize', readScroll);
  ui.bind((p) => {
    const max = document.documentElement.scrollHeight - innerHeight;
    window.scrollTo({ top: p * max, behavior: 'smooth' });
  });

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    document.documentElement.classList.remove('cine');
  });

  /* fonts for the 3D frames, then go */
  await Promise.race([
    document.fonts ? Promise.all([document.fonts.load('40px Bangers'), document.fonts.load('20px "DM Sans"'), document.fonts.load('18px "JetBrains Mono"')]) : null,
    new Promise((r) => setTimeout(r, 1800)),
  ]).catch(() => {});
  world.drawTextures();

  document.documentElement.classList.add('cine');
  window.__cineReady = true;
  readScroll();
  resize();

  const state = {
    p: target, u: 0, t: 0, dt: 0.016, flow: 0, pointer,
    grade: director.grade, intro: { t: 0, cover: 1 },
  };
  const FAST = /[?&]fast\b/.test(params); // test flag: skip intro, snap scroll
  if (FAST) state.intro.t = 6;
  let last = performance.now(), frames = 0, acc = 0, started = false;
  const cover = document.querySelector('.intro-cover');

  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, FAST ? 0.5 : 0.1);
    last = now;
    state.dt = dt;
    state.t += dt;

    pointer.x = lerp(pointer.x, pointer.tx, 1 - Math.exp(-dt * 6));
    pointer.y = lerp(pointer.y, pointer.ty, 1 - Math.exp(-dt * 6));

    const prev = state.p;
    state.p += (target - state.p) * (FAST ? 1 : 1 - Math.exp(-dt * 4.5));
    if (Math.abs(target - state.p) < 0.00005) state.p = target;
    state.u = pToU(state.p);

    const speed = clamp(Math.abs(state.p - prev) / Math.max(dt, 1e-3) * 0.9);
    state.flow += dt * (0.1 + speed * 0.9);

    if (started) state.intro.t += dt;
    state.intro.cover = 1 - smooth(0.45, 2.7, state.intro.t);

    const fast = director.update(state.p, state.u, pointer, state.t, dt);
    world.update(state);

    const g = director.grade;
    GU.uTime.value = state.t;
    GU.uGrain.value = g.grain;
    GU.uVignette.value = g.vig;
    GU.uChroma.value = g.chroma;
    GU.uSat.value = 0;
    GU.uContrast.value = g.con;
    GU.uShadowTint.value = g.shadow;
    GU.uHighTint.value = g.high;
    GU.uFade.value = 0.9;
    GU.uSpeed.value = clamp(fast * 1.2 - 0.25) * (1 - state.intro.cover);

    ui.update(state.p);

    composer.render(dt);

    if (!started && ++frames === 3) {
      started = true;
      cover.classList.add('gone');
      document.documentElement.classList.add('ready');
    }

    // adaptive resolution
    acc += dt;
    if (frames > 40 && acc > 1.5) {
      const fps = 1 / dt;
      if (dt > 0.034 && dpr > 0.65) { dpr = Math.max(0.65, dpr - 0.15); resize(); }
      else if (dt < 0.019 && dpr < maxDpr) { dpr = Math.min(maxDpr, dpr + 0.1); resize(); }
      acc = 0;
    }
  }
  requestAnimationFrame(frame);
  window.__cine = { state, world, renderer, camera };
}
