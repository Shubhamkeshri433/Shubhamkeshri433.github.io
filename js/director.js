/**
 * The director: scroll progress in, camera + colour grade out.
 * Grades are keyframed by scroll progress, one look per act of the film.
 */
import * as THREE from './vendor/three.bundle.js';
import { curve, pToU } from './path.js';
import { HERO_CENTER } from './world.js';
import { clamp, lerp, smooth } from './util.js';

const C = (h) => new THREE.Color(h);
const V = (x, y, z) => new THREE.Vector3(x, y, z).normalize();

/* One look per moment. Dawn -> bright day -> amber dusk -> night -> high altitude. */
const KEYS = [
  { p: 0.00, top: '#1f4a78', mid: '#4d7fa8', hor: '#d9a77a', sun: V(-0.45, 0.10, -0.88), sunCol: '#ffd9a0', lit: '#f3e6d0', shade: '#7f90a8',
    stars: 0.0, cloud: 0.55, hemiSky: '#a9c6e4', hemiGround: '#5a4a40', hemiI: 0.6, light: '#ffd7a8', keyI: 2.2, rimI: 2.6, pg: 1, puff: 0.9,
    sat: 0.82, con: 1.06, grain: 0.05, vig: 0.5, chroma: 0.0016, shadow: '#16384a', high: '#ffb978' },
  { p: 0.22, top: '#1d5688', mid: '#5590b8', hor: '#e0bb8c', sun: V(-0.3, 0.35, -0.9), sunCol: '#fff0cf', lit: '#f6efe2', shade: '#8199b3',
    stars: 0.0, cloud: 0.6, hemiSky: '#b6d4ee', hemiGround: '#5f564c', hemiI: 0.7, light: '#fff0d6', keyI: 2.0, rimI: 1.8, pg: 0.8, puff: 0.95,
    sat: 0.84, con: 1.04, grain: 0.045, vig: 0.45, chroma: 0.0012, shadow: '#1b4256', high: '#ffd9a0' },
  { p: 0.42, top: '#274b78', mid: '#6d8fb0', hor: '#dc9560', sun: V(0.25, 0.12, -0.95), sunCol: '#ffb978', lit: '#f0cfae', shade: '#8c9bb5',
    stars: 0.0, cloud: 0.6, hemiSky: '#9db5d6', hemiGround: '#4c3d38', hemiI: 0.55, light: '#ffc995', keyI: 1.9, rimI: 2.8, pg: 0.6, puff: 0.9,
    sat: 0.86, con: 1.08, grain: 0.055, vig: 0.55, chroma: 0.0018, shadow: '#14304a', high: '#ff9f5e' },
  { p: 0.60, top: '#1a2a4d', mid: '#5a5f85', hor: '#e08a5e', sun: V(0.4, 0.04, -0.9), sunCol: '#ff8f55', lit: '#ffcba0', shade: '#6b6f93',
    stars: 0.18, cloud: 0.62, hemiSky: '#7f8fb8', hemiGround: '#3c302f', hemiI: 0.5, light: '#ffb07a', keyI: 1.7, rimI: 2.8, pg: 0.6, puff: 0.9,
    sat: 0.86, con: 1.1, grain: 0.06, vig: 0.6, chroma: 0.002, shadow: '#101d3a', high: '#ff8a50' },
  { p: 0.74, top: '#0b1530', mid: '#1c2b4f', hor: '#4a4f7a', sun: V(-0.2, 0.05, -0.95), sunCol: '#c8d4ff', lit: '#9fb2dd', shade: '#3a4770',
    stars: 0.85, cloud: 0.45, hemiSky: '#5a6fa8', hemiGround: '#1a1a26', hemiI: 0.45, light: '#a8c0ff', keyI: 1.4, rimI: 2.2, pg: 0.8, puff: 0.75,
    sat: 0.83, con: 1.12, grain: 0.07, vig: 0.62, chroma: 0.0022, shadow: '#08122b', high: '#8ec7c4' },
  { p: 0.88, top: '#060b1c', mid: '#0f1b36', hor: '#2c4a6a', sun: V(0.3, 0.2, -0.9), sunCol: '#ffe2b0', lit: '#c0d0f2', shade: '#2a3a60',
    stars: 1.0, cloud: 0.35, hemiSky: '#4b66a0', hemiGround: '#12131d', hemiI: 0.4, light: '#bcd0ff', keyI: 1.3, rimI: 2.4, pg: 1, puff: 0.6,
    sat: 0.81, con: 1.14, grain: 0.07, vig: 0.65, chroma: 0.0024, shadow: '#050b1d', high: '#7fd0cc' },
  { p: 1.00, top: '#03060f', mid: '#091328', hor: '#1e4a63', sun: V(0.1, 0.3, -0.9), sunCol: '#ffeccc', lit: '#d4e0ff', shade: '#243558',
    stars: 1.0, cloud: 0.2, hemiSky: '#3f5f9a', hemiGround: '#0d0f18', hemiI: 0.4, light: '#d0e0ff', keyI: 1.3, rimI: 2.4, pg: 1, puff: 0.5,
    sat: 0.80, con: 1.14, grain: 0.07, vig: 0.7, chroma: 0.0026, shadow: '#030816', high: '#7fe0d8' },
].map((k) => ({
  ...k,
  top: C(k.top), mid: C(k.mid), hor: C(k.hor), sunCol: C(k.sunCol), lit: C(k.lit), shade: C(k.shade),
  hemiSky: C(k.hemiSky), hemiGround: C(k.hemiGround), light: C(k.light), shadow: C(k.shadow), high: C(k.high),
}));

/* black & white film: strip colour from every grade, keep only luminance */
KEYS.forEach((k) => {
  ['top', 'mid', 'hor', 'sunCol', 'lit', 'shade', 'hemiSky', 'hemiGround', 'light'].forEach((n) => {
    const c = k[n]; let l = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;
    if (['top', 'mid', 'hor', 'shade'].includes(n)) l = Math.pow(l, 1.45) * 0.9; // darker sky so white rings and gates pop
    c.setRGB(l, l, l);
  });
  k.shadow.setRGB(0, 0, 0); k.high.setRGB(0, 0, 0);
});

const COLORS = ['top', 'mid', 'hor', 'sunCol', 'lit', 'shade', 'hemiSky', 'hemiGround', 'light', 'shadow', 'high'];
const NUMS = ['stars', 'cloud', 'hemiI', 'keyI', 'rimI', 'pg', 'puff', 'sat', 'con', 'grain', 'vig', 'chroma'];

export function createDirector({ camera }) {
  const grade = {
    top: new THREE.Color(), mid: new THREE.Color(), hor: new THREE.Color(),
    sunDir: new THREE.Vector3(), sunCol: new THREE.Color(), lit: new THREE.Color(), shade: new THREE.Color(),
    hemiSky: new THREE.Color(), hemiGround: new THREE.Color(), lightCol: new THREE.Color(),
    shadow: new THREE.Color(), high: new THREE.Color(),
    stars: 0, cloudAmt: 0, hemiI: 0, keyI: 0, rimI: 0, pointerGain: 1, puffOpacity: 1,
    sat: 1, con: 1, grain: 0.05, vig: 0.5, chroma: 0.0015,
  };

  const camPos = new THREE.Vector3();
  const look = new THREE.Vector3();
  const lookAhead = new THREE.Vector3();
  const side = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  let roll = 0;

  function sample(p) {
    p = clamp(p);
    let i = 0;
    while (i < KEYS.length - 2 && p > KEYS[i + 1].p) i++;
    const a = KEYS[i], b = KEYS[i + 1];
    const t = smooth(0, 1, (p - a.p) / (b.p - a.p));
    COLORS.forEach((k) => {
      const target = k === 'light' ? grade.lightCol : grade[k];
      target.copy(a[k]).lerp(b[k], t);
    });
    grade.sunDir.copy(a.sun).lerp(b.sun, t).normalize();
    NUMS.forEach((k) => {
      const key = k === 'cloud' ? 'cloudAmt' : k === 'pg' ? 'pointerGain' : k === 'puff' ? 'puffOpacity' : k;
      grade[key] = lerp(a[k], b[k], t);
    });
  }

  function update(p, u, pointer, t, dt) {
    sample(p);

    // camera rides the curve, looking a little ahead
    curve.getPointAt(u, camPos);
    curve.getPointAt(Math.min(u + 0.018, 1), lookAhead);

    // near the start, look at the instrument; hand off to the path as we fly
    const handoff = smooth(0.0, 0.1, p);
    look.set(0, 0, 0).lerp(lookAhead, handoff); // look straight ahead; the instrument sits off to the side of the title panel

    // pointer parallax (gentle, so text stays readable)
    side.subVectors(lookAhead, camPos).normalize();
    const right = new THREE.Vector3().crossVectors(side, up).normalize();
    camera.position.copy(camPos)
      .addScaledVector(right, pointer.x * 0.35)
      .addScaledVector(up, pointer.y * 0.2 + Math.sin(t * 0.4) * 0.05);

    // banking into the turns
    const targetRoll = clamp(-side.x * 0.0, -0.1, 0.1);
    roll = lerp(roll, targetRoll, 1 - Math.exp(-dt * 3));
    camera.up.set(Math.sin(roll), Math.cos(roll), 0);
    camera.lookAt(look);

    // lens: a touch wider while flying, tighter at rest
    const speedFeel = clamp(Math.abs(p - (update._pp ?? p)) / Math.max(dt, 1e-3) * 0.4);
    update._pp = p;
    const fov = 52 + speedFeel * 6;
    if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = lerp(camera.fov, fov, 1 - Math.exp(-dt * 4)); camera.updateProjectionMatrix(); }
    return speedFeel;
  }

  return { grade, update, pToU };
}
