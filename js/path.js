/**
 * The camera's flight path and the scroll-to-path mapping.
 *
 * Scroll progress `p` (0 to 1) is mapped to a distance `u` (0 to 1) along the
 * curve. Keeping the table here means the HTML beats, the glowing gates and the
 * project frames all line up with the same moments of the film.
 */
import * as THREE from './vendor/three.bundle.js';

export const POINTS = [
  [0.0, 0.3, 12.0],
  [-1.0, 0.6, 9.0],
  [-5.0, 1.0, 3.5],
  [-8.0, 0.6, -4.0],
  [-7.0, 0.0, -12.0],
  [-2.5, -0.5, -20.0],
  [3.0, 0.0, -28.0],
  [6.0, 1.2, -36.0],
  [4.0, 2.2, -44.0],
  [-0.5, 1.8, -52.0],
  [-5.5, 2.4, -60.0],
  [-6.0, 3.6, -68.0],
  [-2.0, 6.0, -75.0],
  [1.5, 11.0, -80.0],
  [1.0, 19.0, -84.0],
  [-1.5, 28.0, -87.0],
  [-1.0, 38.0, -89.0],
  [0.5, 48.0, -90.0],
  [0.5, 58.0, -91.0],
  [0.0, 64.0, -92.0],
].map((v) => new THREE.Vector3(...v));

export const curve = new THREE.CatmullRomCurve3(POINTS, false, 'centripetal');
curve.arcLengthDivisions = 1200;

/** [progress, distance along path]. Piecewise linear, monotone. */
const TABLE = [
  [0, 0], [0.08, 0.015], [0.105, 0.035], [0.19, 0.17], [0.255, 0.26], [0.32, 0.34],
  [0.375, 0.39], [0.43, 0.44], [0.475, 0.48], [0.625, 0.63], [0.675, 0.66], [0.735, 0.70],
  [0.79, 0.755], [0.85, 0.83], [0.905, 0.91], [0.965, 0.985], [1, 1],
];

export function pToU(p) {
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  for (let i = 1; i < TABLE.length; i++) {
    if (p <= TABLE[i][0]) {
      const [p0, u0] = TABLE[i - 1];
      const [p1, u1] = TABLE[i];
      return u0 + ((p - p0) / (p1 - p0)) * (u1 - u0);
    }
  }
  return 1;
}

/** Moments (scroll progress) where the camera flies through a glowing gate. */
export const GATE_P = [0.19, 0.255, 0.32, 0.79, 0.85, 0.905];

/** Moments where a project frame floats beside the path. */
export const FRAME_P = [0.485, 0.52, 0.555, 0.59, 0.625, 0.66];
/** Spread the project frames evenly over the "present" stretch for however many projects there are (1 to 8). */
export function setFrameCount(n) {
  n = Math.max(1, Math.min(8, n | 0));
  const a = 0.485, b = 0.66;
  FRAME_P.length = 0;
  for (let i = 0; i < n; i++) FRAME_P.push(n === 1 ? (a + b) / 2 : a + ((b - a) * i) / (n - 1));
}
