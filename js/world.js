/**
 * Everything you can see: sky, clouds, the brass instrument, gates, project
 * frames, flight-path trail and dust. `update(state)` is called every frame.
 */
import * as THREE from './vendor/three.bundle.js';
import {
  skyVert, skyFrag, envVert, envFrag, puffVert, puffFrag,
  trailVert, trailFrag, dustVert, dustFrag,
} from './shaders.js';
import { curve, GATE_P, FRAME_P, pToU } from './path.js';
import { rng, clamp, lerp, smooth, easeOutBack } from './util.js';

/** Where the brass instrument sits. Moved on resize so text and object never overlap. */
export const HERO_CENTER = new THREE.Vector3(2.6, 0, 0);

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
function makePuffAtlas() {
  const S = 256, W = S * 2;
  const data = new Uint8Array(W * W * 4);
  const h = (x, y, s) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const vn = (x, y, s) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi, s), b = h(xi + 1, yi, s), c = h(xi, yi + 1, s), d = h(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const fbm = (x, y, s) => {
    let v = 0, a = 0.5;
    for (let i = 0; i < 5; i++) { v += a * vn(x, y, s); x = x * 1.9 + 3.1; y = y * 1.9 + 1.7; a *= 0.5; }
    return v;
  };
  const dens = (x, y, s) => {
    const r = Math.sqrt(x * x + y * y);
    const n = (fbm(x * 2.4 + 5, y * 2.4 + 5, s) - 0.45) * 1.15;
    const t = clamp((r * 1.05 - n - 0.15) / 0.85);
    const d = 1 - t * t * (3 - 2 * t);
    return clamp(d * 1.35 - 0.05);
  };
  for (let tile = 0; tile < 4; tile++) {
    const tx = tile % 2, ty = Math.floor(tile / 2);
    const seed = tile * 9.7 + 1.3;
    for (let j = 0; j < S; j++) {
      for (let i = 0; i < S; i++) {
        const x = (i / (S - 1)) * 2 - 1, y = (j / (S - 1)) * 2 - 1;
        const d = dens(x, y, seed);
        const d2 = dens(x - 0.11, y + 0.11, seed);
        const lit = clamp(0.5 + (d - d2) * 3.4 + y * 0.12);
        const o = ((ty * S + j) * W + (tx * S + i)) * 4;
        const v = Math.round(lit * 255);
        data[o] = v; data[o + 1] = v; data[o + 2] = v;
        data[o + 3] = Math.round(d * 255);
      }
    }
  }
  const tex = new THREE.DataTexture(data, W, W, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  return tex;
}

function wrapText(ctx, text, maxW) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
  }
  if (line) lines.push(line);
  return lines;
}

function drawFrameTexture(project, index, total) {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 576;
  const x = c.getContext('2d');
  const INK = '#0b0d12', PAPER = '#fbfbf8';
  x.fillStyle = PAPER; x.fillRect(0, 0, 1024, 576);
  // halftone corner
  x.fillStyle = 'rgba(11,13,18,0.20)';
  for (let yy = 0; yy < 576; yy += 14) for (let xx = (yy / 14) % 2 ? 7 : 0; xx < 1024; xx += 14) {
    const d = Math.max(0, (xx / 1024 + yy / 576 - 1.0)) * 5.2;
    if (d > 0.3) { x.beginPath(); x.arc(xx, yy, d, 0, 6.283); x.fill(); }
  }
  // speed-line burst behind the number
  x.save(); x.translate(900, 90); x.fillStyle = '#ffffff';
  for (let k = 0; k < 18; k++) { x.rotate(6.283 / 18); x.beginPath(); x.moveTo(40, 0); x.lineTo(110, -9); x.lineTo(110, 9); x.fill(); }
  x.beginPath(); x.arc(0, 0, 52, 0, 6.283); x.fill(); x.lineWidth = 5; x.strokeStyle = INK; x.stroke(); x.restore();
  x.fillStyle = INK; x.font = '400 54px Bangers, Impact, sans-serif'; x.textAlign = 'center';
  x.fillText(String(index + 1).padStart(2, '0'), 900, 108); x.textAlign = 'left';

  x.lineWidth = 14; x.strokeStyle = INK; x.strokeRect(7, 7, 1010, 562);

  x.fillStyle = '#ffffff'; x.fillRect(46, 40, 330, 40);
  x.lineWidth = 4; x.strokeRect(46, 40, 330, 40);
  x.fillStyle = INK; x.font = '500 20px "JetBrains Mono", monospace';
  x.fillText(project.badge.toUpperCase(), 60, 67);

  x.font = '400 78px Bangers, Impact, sans-serif';
  const titleLines = wrapText(x, project.title.toUpperCase(), 800).slice(0, 2);
  titleLines.forEach((l, i) => x.fillText(l, 46, 168 + i * 78));

  const dy = 168 + titleLines.length * 78 - 6;
  x.font = '500 26px "DM Sans", system-ui, sans-serif';
  wrapText(x, project.desc, 800).slice(0, 3).forEach((l, i) => x.fillText(l, 46, dy + i * 36));

  let tx = 46;
  x.font = '500 19px "JetBrains Mono", monospace';
  for (const t of project.tech.slice(0, 4)) {
    const w = x.measureText(t).width + 26;
    if (tx + w > 980) break;
    x.fillStyle = '#e8e8e2'; x.fillRect(tx, 462, w, 38);
    x.lineWidth = 3; x.strokeStyle = INK; x.strokeRect(tx, 462, w, 38);
    x.fillStyle = INK; x.fillText(t, tx + 13, 488);
    tx += w + 10;
  }
  x.fillStyle = '#e63b2e'; x.fillRect(46, 516, 330, 34);
  x.strokeRect(46, 516, 330, 34);
  x.fillStyle = '#fff'; x.font = '400 26px Bangers, Impact, sans-serif';
  x.fillText('OPEN REPOSITORY  \u2197', 60, 542);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ------------------------------------------------------------------ */
/* world                                                               */
/* ------------------------------------------------------------------ */
export function createWorld({ scene, camera, renderer, quality, projects }) {
  const rand = rng(7);
  const up = new THREE.Vector3(0, 1, 0);

  /* --- environment for metal reflections --- */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envMat = new THREE.ShaderMaterial({
    vertexShader: envVert, fragmentShader: envFrag, side: THREE.BackSide,
    uniforms: { uSun: { value: new THREE.Vector3(-0.35, 0.18, -0.9) } },
  });
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(50, 48, 24), envMat));
  scene.environment = pmrem.fromScene(envScene, 0.03).texture;
  scene.environmentIntensity = 1.0;

  /* --- sky dome (full-screen shader) --- */
  const skyMat = new THREE.ShaderMaterial({
    vertexShader: skyVert, fragmentShader: skyFrag, depthTest: false, depthWrite: false,
    uniforms: {
      uInvProj: { value: camera.projectionMatrixInverse },
      uCamWorld: { value: camera.matrixWorld },
      uTime: { value: 0 }, uFlow: { value: 0 }, uCover: { value: 1 }, uStars: { value: 0 },
      uCloudAmt: { value: 0.5 }, uOct: { value: quality.octaves }, uLook: { value: new THREE.Vector2() },
      uTop: { value: new THREE.Color() }, uMid: { value: new THREE.Color() }, uHor: { value: new THREE.Color() },
      uSunDir: { value: new THREE.Vector3(0, 0.1, -1) }, uSunCol: { value: new THREE.Color() },
      uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
    },
  });
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), skyMat);
  sky.frustumCulled = false;
  sky.renderOrder = -1000;
  scene.add(sky);

  /* --- lights --- */
  const hemi = new THREE.HemisphereLight(0x9bbbe0, 0x3a2e28, 0.55);
  const key = new THREE.DirectionalLight(0xffd6a0, 2.2);
  key.position.set(-6, 6, 12);
  const rim = new THREE.DirectionalLight(0xffc88a, 2.6);
  const pointer = new THREE.PointLight(0xffffff, 30, 16, 2);
  scene.add(hemi, key, rim, pointer);

  /* --- the brass instrument --- */
  const hero = new THREE.Group();
  scene.add(hero);
  const brass = new THREE.MeshStandardMaterial({ color: 0xe6e6e6, metalness: 0.96, roughness: 0.28, envMapIntensity: 1.4 });
  const RING_DEFS = [
    { R: 3.2, t: 0.042, tilt: [0.42, 0.0, 0.18], speed: 0.10 },
    { R: 2.55, t: 0.036, tilt: [1.25, 0.35, 0.0], speed: -0.16 },
    { R: 1.9, t: 0.03, tilt: [0.25, 1.15, 0.5], speed: 0.24 },
  ];
  const spinners = [];
  const nodeLocal = [];
  const nodeSpin = [];
  const nodeGeo = new THREE.SphereGeometry(0.07, 14, 10);
  const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const nodes = new THREE.InstancedMesh(nodeGeo, nodeMat, RING_DEFS.length * 12);
  nodes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(nodes.count * 3), 3);
  let ni = 0;
  const m4 = new THREE.Matrix4();
  RING_DEFS.forEach((d, ri) => {
    const g = new THREE.Group();
    g.rotation.set(...d.tilt);
    const s = new THREE.Group();
    g.add(s);
    s.add(new THREE.Mesh(new THREE.TorusGeometry(d.R, d.t, 14, 220), brass));
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      nodeLocal.push(new THREE.Vector3(Math.cos(a) * d.R, Math.sin(a) * d.R, 0));
      nodeSpin.push(s);
      m4.setPosition(Math.cos(a) * d.R, Math.sin(a) * d.R, 0);
      nodes.setMatrixAt(ni, m4);
      nodes.setColorAt(ni, new THREE.Color(0.6, 0.6, 0.6));
      ni++;
    }
    if (ri === 0) {
      // scale ticks on the outer ring, like an astrolabe
      const tickGeo = new THREE.BoxGeometry(0.014, 0.1, 0.022);
      const ticks = new THREE.InstancedMesh(tickGeo, brass, 120);
      const tm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), ps = new THREE.Vector3();
      for (let k = 0; k < 120; k++) {
        const a = (k / 120) * Math.PI * 2;
        const long = k % 5 === 0 ? 1.7 : 1;
        q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), a - Math.PI / 2);
        sc.set(1, long, 1);
        ps.set(Math.cos(a) * (d.R + 0.11), Math.sin(a) * (d.R + 0.11), 0);
        tm.compose(ps, q, sc);
        ticks.setMatrixAt(k, tm);
      }
      s.add(ticks);
    }
    spinners.push({ g, s, speed: d.speed });
    hero.add(g);
  });
  nodes.instanceMatrix.needsUpdate = true;
  // nodes ride on the spinners: parent each group of 12 to its spinner
  const nodeHolders = [];
  RING_DEFS.forEach((d, ri) => {
    const sub = new THREE.InstancedMesh(nodeGeo, nodeMat, 12);
    sub.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(12 * 3), 3);
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      m4.setPosition(Math.cos(a) * d.R, Math.sin(a) * d.R, 0);
      sub.setMatrixAt(k, m4);
      sub.setColorAt(k, new THREE.Color(0.6, 0.6, 0.6));
    }
    sub.instanceMatrix.needsUpdate = true;
    spinners[ri].s.add(sub);
    nodeHolders.push(sub);
  });

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(0.34, 32, 20),
    new THREE.MeshBasicMaterial({ color: new THREE.Color(3.2, 0.42, 0.3), toneMapped: false }),
  );
  const lattice = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.98, 1)),
    new THREE.LineBasicMaterial({ color: new THREE.Color(1.8, 1.8, 1.8), transparent: true, opacity: 0.85 }),
  );
  hero.add(core, lattice);

  // a shell of fine data points around the instrument
  const shellN = quality.low ? 260 : 520;
  const shellPos = new Float32Array(shellN * 3);
  for (let i = 0; i < shellN; i++) {
    const r = 4.2 + rand() * 3.6, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
    shellPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
    shellPos[i * 3 + 1] = r * Math.cos(ph) * 0.8;
    shellPos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.BufferAttribute(shellPos, 3));
  const shell = new THREE.Points(shellGeo, new THREE.PointsMaterial({
    color: new THREE.Color(1.5, 1.5, 1.5), size: 0.045, transparent: true, opacity: 0.7,
    blending: THREE.AdditiveBlending, depthWrite: false,
  }));
  hero.add(shell);

  /* --- gates the camera flies through --- */
  const gates = GATE_P.map((gp) => {
    const u = pToU(gp);
    const pos = curve.getPointAt(u);
    const tan = curve.getTangentAt(u);
    const g = new THREE.Group();
    const m1 = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.0, 0.42, 0.3), toneMapped: false, transparent: true });
    const m2 = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.7, 1.7), toneMapped: false, transparent: true, opacity: 0.6 });
    g.add(new THREE.Mesh(new THREE.TorusGeometry(2.7, 0.028, 10, 180), m1));
    const inner = new THREE.Mesh(new THREE.TorusGeometry(2.28, 0.012, 8, 150), m2);
    g.add(inner);
    g.position.copy(pos);
    g.lookAt(pos.clone().add(tan));
    scene.add(g);
    return { g, m1, m2, inner, gp };
  });

  /* --- project frames: a calm, non-interactive backdrop; the DOM card carries the text --- */
  const frames = projects.map((pr, i) => {
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ transparent: true, toneMapped: false, opacity: 0, depthWrite: false });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.8, 2.7), mat);
    const edgeMat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(1.8, 1.8, 1.8), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
    });
    const edge = new THREE.Mesh(new THREE.PlaneGeometry(5.0, 2.9), edgeMat);
    edge.position.z = -0.03;
    grp.add(edge, mesh);
    grp.visible = false;
    scene.add(grp);
    return { grp, mesh, mat, edgeMat, act: 0, project: pr, fp: FRAME_P[i] ?? 0.5, quat: new THREE.Quaternion(), base: new THREE.Vector3() };
  });
  function drawTextures() {
    frames.forEach((f, i) => {
      if (f.mat.map) f.mat.map.dispose();
      f.mat.map = drawFrameTexture(f.project, i, frames.length);
      f.mat.needsUpdate = true;
    });
  }

  const layout = { aspect: 1.6 };
  const fwdPt = new THREE.Vector3();
  function layoutFrames() {
    const portrait = layout.aspect < 0.9;
    frames.forEach((f, i) => {
      const u = pToU(f.fp);
      const here = curve.getPointAt(u);
      curve.getPointAt(Math.min(u + (portrait ? 0.05 : 0.04), 1), fwdPt);
      const tan = curve.getTangentAt(u);
      const sideVec = new THREE.Vector3().crossVectors(tan, up).normalize();
      // ahead of the camera and to its right, so the text card on the left never sits on top of it
      const side = portrait ? 0 : 2.7;
      const lift = portrait ? 1.9 : [0.3, -0.2, 0.4, -0.1, 0.35, -0.15][i % 6];
      f.base.copy(fwdPt).addScaledVector(sideVec, side).addScaledVector(up, lift);
      f.grp.position.copy(f.base);
      f.grp.lookAt(here.x + (portrait ? 0 : -1.2), here.y, here.z);
      f.quat.copy(f.grp.quaternion);
      f.grp.scale.setScalar(portrait ? 0.62 : 1);
    });
  }
  layoutFrames();

  /* --- flight-path trail --- */
  const TRAIL_N = 900;
  const tpos = new Float32Array(TRAIL_N * 3), tu = new Float32Array(TRAIL_N);
  for (let i = 0; i < TRAIL_N; i++) {
    const u = i / (TRAIL_N - 1);
    const p = curve.getPointAt(u);
    tpos.set([p.x, p.y, p.z], i * 3);
    tu[i] = u;
  }
  const trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3));
  trailGeo.setAttribute('aU', new THREE.BufferAttribute(tu, 1));
  const trailMat = new THREE.ShaderMaterial({
    vertexShader: trailVert, fragmentShader: trailFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uU: { value: 0 }, uScale: { value: 1 }, uColor: { value: new THREE.Color(1.8, 1.8, 1.8) } },
  });
  const trail = new THREE.Points(trailGeo, trailMat);
  trail.frustumCulled = false;
  scene.add(trail);

  /* --- cloud puffs --- */
  const atlas = makePuffAtlas();
  function puffMaterial(wrap, opacity) {
    return new THREE.ShaderMaterial({
      vertexShader: puffVert, fragmentShader: puffFrag, transparent: true, depthWrite: false,
      uniforms: {
        uAtlas: { value: atlas }, uLit: { value: new THREE.Color() }, uShade: { value: new THREE.Color() },
        uOpacity: { value: opacity }, uFlowY: { value: 0 }, uWrap: { value: wrap }, uSunView: { value: new THREE.Vector3(0, 0, -1) },
      },
    });
  }
  function puffMesh(count, build, mat) {
    const geo = new THREE.InstancedBufferGeometry();
    const base = new THREE.PlaneGeometry(1, 1);
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    const pos = new Float32Array(count * 3), dat = new Float32Array(count * 4);
    for (let i = 0; i < count; i++) build(i, pos, dat);
    geo.setAttribute('iPos', new THREE.InstancedBufferAttribute(pos, 3));
    geo.setAttribute('iData', new THREE.InstancedBufferAttribute(dat, 4));
    geo.instanceCount = count;
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.renderOrder = -500;
    return m;
  }
  // clouds along the whole flight
  const worldPuffs = puffMesh(quality.puffs, (i, pos, dat) => {
    const u = rand();
    const b = curve.getPointAt(u);
    const sea = rand() < 0.38;
    const a = rand() * Math.PI * 2;
    const rr = 8 + rand() * 34;
    pos[i * 3] = b.x + Math.cos(a) * rr;
    pos[i * 3 + 1] = b.y + (sea ? -16 - rand() * 26 : (rand() - 0.5) * rr * 0.7);
    pos[i * 3 + 2] = b.z + Math.sin(a) * rr * 0.7;
    dat[i * 4] = sea ? 26 + rand() * 38 : 9 + rand() * 24;
    dat[i * 4 + 1] = rand() * 6.28;
    dat[i * 4 + 2] = Math.floor(rand() * 4);
    dat[i * 4 + 3] = sea ? 0.55 + rand() * 0.3 : 0.28 + rand() * 0.4;
  }, puffMaterial(0, 1));
  scene.add(worldPuffs);
  // clouds that always drift upward around the camera
  const driftMat = puffMaterial(60, 0.8);
  const driftPuffs = puffMesh(quality.low ? 36 : 64, (i, pos, dat) => {
    pos[i * 3] = (rand() - 0.5) * 80;
    pos[i * 3 + 1] = (rand() - 0.5) * 60;
    pos[i * 3 + 2] = -6 - rand() * 55;
    dat[i * 4] = 7 + rand() * 20;
    dat[i * 4 + 1] = rand() * 6.28;
    dat[i * 4 + 2] = Math.floor(rand() * 4);
    dat[i * 4 + 3] = 0.25 + rand() * 0.4;
  }, driftMat);
  scene.add(driftPuffs);

  /* --- dust motes --- */
  const DUST_N = quality.low ? 220 : 480;
  const dseed = new Float32Array(DUST_N * 4);
  for (let i = 0; i < DUST_N; i++) dseed.set([rand(), rand(), rand(), rand()], i * 4);
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(DUST_N * 3), 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 4));
  const dustMat = new THREE.ShaderMaterial({
    vertexShader: dustVert, fragmentShader: dustFrag, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uScale: { value: 1 }, uBox: { value: 40 }, uColor: { value: new THREE.Color(1.6, 1.6, 1.6) } },
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  scene.add(dust);

  /* --- interaction --- */
  const raycaster = new THREE.Raycaster();
  const sphere = new THREE.Sphere(new THREE.Vector3(), 4.4);
  const tmpV = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const ndc = new THREE.Vector2();
  const hitPoint = new THREE.Vector3();
  const nodeCol = new THREE.Color();
  const camDir = new THREE.Vector3();
  const focusTarget = new THREE.Vector3();
  let heroHover = 0;
  let hoverFrame = -1;

  function resize(aspect, dpr) {
    layout.aspect = aspect;
    if (aspect > 1.35) HERO_CENTER.set(3.5, 0, 0);
    else if (aspect > 0.9) HERO_CENTER.set(1.2, 0.2, 0);
    else HERO_CENTER.set(0, 1.1, 0);
    layoutFrames();
    trailMat.uniforms.uScale.value = dpr;
    dustMat.uniforms.uScale.value = dpr;
  }

  function update(s) {
    const { p, u, t, dt, grade, intro, pointer: pt } = s;
    ndc.set(pt.x, pt.y);

    // --- sky ---
    const U = skyMat.uniforms;
    U.uTime.value = t;
    U.uFlow.value = s.flow;
    U.uCover.value = intro.cover;
    U.uStars.value = grade.stars;
    U.uCloudAmt.value = grade.cloudAmt;
    U.uLook.value.set(pt.x * 0.05, pt.y * 0.03);
    U.uTop.value.copy(grade.top); U.uMid.value.copy(grade.mid); U.uHor.value.copy(grade.hor);
    U.uSunDir.value.copy(grade.sunDir); U.uSunCol.value.copy(grade.sunCol);
    U.uLit.value.copy(grade.lit); U.uShade.value.copy(grade.shade);

    // --- lights ---
    hemi.color.copy(grade.hemiSky); hemi.groundColor.copy(grade.hemiGround); hemi.intensity = grade.hemiI;
    key.color.copy(grade.lightCol); key.intensity = grade.keyI;
    rim.color.copy(grade.sunCol); rim.intensity = grade.rimI;
    rim.position.copy(grade.sunDir).multiplyScalar(40).add(HERO_CENTER);
    key.position.set(-6, 6, 12).add(HERO_CENTER);

    // --- the instrument ---
    const showHero = p < 0.26;
    hero.visible = showHero;
    if (showHero) {
      hero.position.copy(HERO_CENTER);
      const sc = lerp(0.35, 1, easeOutBack(clamp((intro.t - 1.0) / 2.8))) * (1 - smooth(0.12, 0.24, p) * 0.15);
      hero.scale.setScalar(sc);

      raycaster.setFromCamera(ndc, camera);
      sphere.center.copy(HERO_CENTER);
      const hit = raycaster.ray.intersectSphere(sphere, hitPoint);
      const hTarget = hit && p < 0.14 ? 1 : 0;
      heroHover = lerp(heroHover, hTarget, 1 - Math.exp(-dt * 5));

      const spin = 1 + heroHover * 3.2 + (1 - clamp(intro.t / 4.5)) * 5;
      spinners.forEach((sp, i) => { sp.s.rotation.z += dt * sp.speed * spin; });
      const ry = Math.sin(t * 0.13) * 0.18 + pt.x * 0.4;
      const rx = -pt.y * 0.28 + Math.cos(t * 0.11) * 0.06;
      hero.rotation.y = lerp(hero.rotation.y, ry, 1 - Math.exp(-dt * 3));
      hero.rotation.x = lerp(hero.rotation.x, rx, 1 - Math.exp(-dt * 3));
      shell.rotation.y += dt * (0.02 + heroHover * 0.15);
      core.scale.setScalar(1 + Math.sin(t * 2.2) * 0.05 + heroHover * 0.22);
      lattice.rotation.y += dt * (0.12 + heroHover * 0.6);
      lattice.rotation.x += dt * 0.07;

      // pointer glint
      tmpV.copy(camera.position).addScaledVector(raycaster.ray.direction, Math.max(camera.position.distanceTo(HERO_CENTER) - 3.2, 2));
      pointer.position.copy(tmpV);
      pointer.intensity = lerp(8, 70, heroHover) * grade.pointerGain;

      // nodes light up near the cursor
      hero.updateMatrixWorld(true);
      nodeHolders.forEach((holder, ri) => {
        for (let k = 0; k < 12; k++) {
          holder.getMatrixAt(k, m4);
          tmpV.setFromMatrixPosition(m4).applyMatrix4(spinners[ri].s.matrixWorld).project(camera);
          const d = Math.hypot(tmpV.x - ndc.x, (tmpV.y - ndc.y) * 0.8);
          const glow = smooth(0.34, 0.0, d) * (0.25 + heroHover * 0.75);
          const base = 0.5 + Math.sin(t * 1.2 + k * 0.9 + ri) * 0.12;
          holder.setColorAt(k, nodeCol.setRGB(base + glow * 3.2, base + glow * 0.3, base + glow * 0.25));
        }
        holder.instanceColor.needsUpdate = true;
      });
    } else {
      pointer.intensity = 0;
    }

    // --- gates ---
    gates.forEach((gt) => {
      const d = (p - gt.gp) / 0.02;
      const pulse = Math.exp(-d * d);
      const vis = 1 - smooth(0.12, 0.22, Math.abs(p - gt.gp));
      gt.g.visible = vis > 0.01;
      gt.m1.opacity = (0.55 + pulse * 0.45) * vis;
      gt.m2.opacity = (0.35 + pulse * 0.4) * vis;
      gt.g.scale.setScalar(1 + pulse * 0.08);
      gt.inner.rotation.z = t * 0.2;
    });

    // --- frames: the one nearest the camera's scroll position is "active" ---
    let nearest = 0, nd = 9;
    frames.forEach((f, i) => { const d = Math.abs(p - f.fp); if (d < nd) { nd = d; nearest = i; } });
    frames.forEach((f, i) => {
      const dist = Math.abs(p - f.fp);
      const vis = 1 - smooth(0.014, 0.036, dist);
      f.grp.visible = vis > 0.01;
      f.act = lerp(f.act, i === nearest && nd < 0.02 ? 1 : 0, 1 - Math.exp(-dt * 5));
      f.mat.opacity = vis * (0.85 + f.act * 0.15);
      f.mat.color.setScalar(0.74 + f.act * 0.12);
      f.edgeMat.opacity = vis * (0.1 + f.act * 0.4);
      const bob = Math.sin(t * 0.6 + i * 1.7) * 0.06;
      f.grp.position.set(f.base.x, f.base.y + bob, f.base.z);
      f.grp.quaternion.copy(f.quat);
      f.grp.scale.setScalar((layout.aspect < 0.9 ? 0.62 : 1) * (1 + f.act * 0.05));
    });
    hoverFrame = -1;

    // --- trail, dust ---
    trailMat.uniforms.uU.value = u;
    dustMat.uniforms.uCam.value.copy(camera.position);
    dustMat.uniforms.uTime.value = t;

    // --- clouds ---
    const sunView = tmpV.copy(grade.sunDir).transformDirection(camera.matrixWorldInverse);
    [worldPuffs.material, driftMat].forEach((m) => {
      m.uniforms.uLit.value.copy(grade.lit);
      m.uniforms.uShade.value.copy(grade.shade);
      m.uniforms.uSunView.value.copy(sunView);
    });
    worldPuffs.material.uniforms.uOpacity.value = grade.puffOpacity;
    driftMat.uniforms.uOpacity.value = grade.puffOpacity * 0.85;
    driftMat.uniforms.uFlowY.value = s.flow * 2.2;
    driftPuffs.position.copy(camera.position);
  }

  return {
    update, resize, drawTextures,
    get hoverFrame() { return hoverFrame; },
    get heroHover() { return heroHover; },
    frames,
    envMat,
  };
}
