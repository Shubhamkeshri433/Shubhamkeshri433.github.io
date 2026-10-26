/* GLSL for the sky, cloud puffs, flight trail, dust and the final film grade. */

/* ------------------------------------------------------------------ */
/* Sky dome: gradient, sun/moon, stars, three layers of drifting clouds */
/* ------------------------------------------------------------------ */
export const skyVert = /* glsl */ `
  uniform mat4 uInvProj;
  uniform mat4 uCamWorld;
  varying vec3 vDir;
  void main() {
    gl_Position = vec4(position.xy, 1.0, 1.0);
    vec4 v = uInvProj * vec4(position.xy, 1.0, 1.0);
    vDir = normalize((uCamWorld * vec4(v.xyz / v.w, 0.0)).xyz);
  }
`;

export const skyFrag = /* glsl */ `
  precision highp float;
  varying vec3 vDir;

  uniform float uTime;
  uniform float uFlow;      // accumulated upward cloud travel
  uniform float uCover;     // 1 = whiteout (intro), 0 = clear
  uniform float uStars;
  uniform float uCloudAmt;
  uniform float uOct;
  uniform vec2  uLook;
  uniform vec3  uTop, uMid, uHor, uSunDir, uSunCol, uLit, uShade;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }
  float noise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(i), b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0)), d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
    for (int i = 0; i < 6; i++) {
      if (float(i) >= uOct) break;
      v += a * noise(p);
      p = m * p;
      a *= 0.5;
    }
    return v;
  }

  vec3 skyColor(vec3 d) {
    float e = d.y;
    vec3 c = mix(uHor, uMid, smoothstep(0.0, 0.30, e));
    c = mix(c, uTop, smoothstep(0.20, 0.90, e));
    c = mix(c, uHor * 0.55, smoothstep(0.0, -0.35, e));
    float s = max(dot(d, normalize(uSunDir)), 0.0);
    c += uSunCol * (pow(s, 1400.0) * 4.0 + pow(s, 60.0) * 0.55 + pow(s, 7.0) * 0.22);
    c += uHor * 0.30 * exp(-abs(e) * 7.0);
    return c;
  }

  float stars(vec3 d) {
    vec3 q = d * 170.0;
    vec3 i = floor(q);
    float h = fract(sin(dot(i, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
    float s = step(0.9972, h);
    float m = smoothstep(0.5, 0.0, length(fract(q) - 0.5)) * s;
    return m * (0.55 + 0.45 * sin(uTime * 1.7 + h * 60.0)) * smoothstep(0.0, 0.25, d.y);
  }

  vec4 cloudLayer(vec2 uv, vec2 sunUV, float scale, float speed, float thr, float soft, float mask, float seed) {
    // Pattern moves toward the top of the screen as uFlow grows.
    vec2 p = uv * scale + vec2(seed, -uFlow * speed);
    float w = noise(p * 1.3 + 7.0);
    float d = fbm(p + w * 1.25);
    float den = smoothstep(thr, thr + soft, d) * mask;
    vec2 ts = normalize(sunUV - uv + 0.0001);
    float d2 = fbm(p + w * 1.25 + ts * 0.28);
    float light = clamp(0.5 + (d - d2) * 3.4, 0.0, 1.0);
    vec3 c = mix(uShade, uLit, light);
    c += uSunCol * pow(1.0 - den, 3.0) * 0.16 * light;
    return vec4(c, den);
  }

  void main() {
    vec3 d = normalize(vDir);
    float az = atan(d.x, -d.z);
    float el = asin(clamp(d.y, -1.0, 1.0));
    vec2 uv = vec2(az * 1.4 + uLook.x, el * 2.6 + uLook.y);
    vec3 sd = normalize(uSunDir);
    vec2 sunUV = vec2(atan(sd.x, -sd.z) * 1.4, asin(clamp(sd.y, -1.0, 1.0)) * 2.6);

    vec3 col = skyColor(d);
    col += vec3(0.85, 0.92, 1.0) * stars(d) * uStars * 1.4;

    float e = d.y;
    float amt = uCloudAmt;

    // high, thin cloud
    vec4 L0 = cloudLayer(uv, sunUV, 2.3, 0.045, 0.55 - amt * 0.14 - uCover * 0.6, 0.32,
                         smoothstep(-0.05, 0.22, e) * (1.0 - smoothstep(0.55, 0.95, e)), 11.0);
    col = mix(col, L0.rgb, L0.a * 0.7);

    // mid cloud bank around the horizon
    vec4 L1 = cloudLayer(uv, sunUV, 3.4, 0.090, 0.50 - amt * 0.16 - uCover * 0.62, 0.28,
                         smoothstep(-0.25, 0.10, e) * (1.0 - smoothstep(0.30, 0.75, e)), 3.7);
    col = mix(col, L1.rgb, L1.a * 0.88);

    // the sea of clouds below the horizon
    float sea = smoothstep(0.08, -0.16, e);
    vec4 L2 = cloudLayer(uv, sunUV, 4.6, 0.160, 0.44 - amt * 0.14 - uCover * 0.62, 0.30,
                         max(sea, 0.0) + uCover * 0.5, 27.0);
    col = mix(col, L2.rgb, clamp(L2.a, 0.0, 1.0) * 0.96);

    // whiteout used by the opening shot
    col = mix(col, uLit, clamp(uCover * 1.05 - 0.05, 0.0, 1.0) * 0.55);

    gl_FragColor = vec4(col, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Environment (reflections on the brass rings): simple warm/cool dome  */
/* ------------------------------------------------------------------ */
export const envVert = /* glsl */ `
  varying vec3 vP;
  void main() {
    vP = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;
export const envFrag = /* glsl */ `
  varying vec3 vP;
  uniform vec3 uSun;
  void main() {
    float e = vP.y;
    vec3 hor = vec3(1.35, 0.82, 0.48);
    vec3 top = vec3(0.10, 0.26, 0.50);
    vec3 low = vec3(0.12, 0.10, 0.10);
    vec3 c = mix(hor, top, smoothstep(0.0, 0.7, e));
    c = mix(c, low, smoothstep(0.0, -0.4, e));
    float s = max(dot(vP, normalize(uSun)), 0.0);
    c += vec3(5.0, 3.6, 2.2) * pow(s, 60.0) + vec3(1.2, 0.8, 0.5) * pow(s, 6.0);
    gl_FragColor = vec4(c, 1.0);
  }
`;

/* ------------------------------------------------------------------ */
/* Cloud puffs: camera-facing, instanced, soft, lit from the sun side   */
/* ------------------------------------------------------------------ */
export const puffVert = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iData;   // scale, rotation, tile, opacity
  uniform float uFlowY;   // vertical drift for the camera-following group
  uniform float uWrap;    // height of the wrap box (0 = static puffs)
  uniform vec3 uSunView;
  varying vec2 vUv;
  varying float vFade;
  varying vec2 vTile;
  varying float vOp;
  varying float vFlip;
  void main() {
    vec3 pos = iPos;
    float edge = 1.0;
    if (uWrap > 0.0) {
      float y = mod(iPos.y + uFlowY * (0.6 + iData.z * 0.15) + uWrap * 0.5, uWrap) - uWrap * 0.5;
      pos.y = y;
      edge = smoothstep(0.5, 0.36, abs(y) / uWrap);
    }
    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    float c = cos(iData.y), s = sin(iData.y);
    mv.xy += mat2(c, -s, s, c) * position.xy * iData.x;
    gl_Position = projectionMatrix * mv;
    float dist = -mv.z;
    vFade = smoothstep(iData.x * 0.12, iData.x * 0.55, dist) * (1.0 - smoothstep(70.0, 130.0, dist)) * edge;
    vUv = uv;
    vTile = vec2(mod(iData.z, 2.0), floor(iData.z / 2.0));
    vOp = iData.w;
    vFlip = uSunView.x > 0.0 ? 1.0 : 0.0;
  }
`;
export const puffFrag = /* glsl */ `
  precision highp float;
  uniform sampler2D uAtlas;
  uniform vec3 uLit, uShade;
  uniform float uOpacity;
  varying vec2 vUv;
  varying float vFade;
  varying vec2 vTile;
  varying float vOp;
  varying float vFlip;
  void main() {
    vec2 u = vUv;
    if (vFlip > 0.5) u.x = 1.0 - u.x;
    vec4 t = texture2D(uAtlas, u * 0.5 + vTile * 0.5);
    vec3 c = mix(uShade, uLit, t.r);
    float a = t.a * vFade * vOp * uOpacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(c, a);
  }
`;

/* ------------------------------------------------------------------ */
/* Dotted flight path ahead of the camera                               */
/* ------------------------------------------------------------------ */
export const trailVert = /* glsl */ `
  attribute float aU;
  uniform float uU;
  uniform float uScale;
  varying float vA;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float ahead = aU - uU;
    float a = ahead > -0.004 ? exp(-max(ahead, 0.0) * 16.0) : 0.0;
    vA = a;
    gl_PointSize = clamp((2.0 + 7.0 * a) * uScale * (22.0 / max(-mv.z, 1.0)), 1.0, 9.0 * uScale);
  }
`;
export const trailFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float m = smoothstep(0.5, 0.0, r);
    gl_FragColor = vec4(uColor * (0.6 + vA * 1.6), m * vA * 0.9);
  }
`;

/* ------------------------------------------------------------------ */
/* Dust motes that give a sense of speed and depth                      */
/* ------------------------------------------------------------------ */
export const dustVert = /* glsl */ `
  attribute vec4 aSeed;
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uScale;
  uniform float uBox;
  varying float vA;
  void main() {
    vec3 base = aSeed.xyz * uBox;
    base.y += uTime * (0.25 + aSeed.w * 0.3);
    vec3 p = mod(base - uCam + uBox * 0.5, uBox) - uBox * 0.5 + uCam;
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = -mv.z;
    vA = smoothstep(0.5, 3.0, d) * (1.0 - smoothstep(uBox * 0.28, uBox * 0.5, d)) * (0.45 + 0.55 * sin(uTime * 1.3 + aSeed.w * 40.0));
    gl_PointSize = clamp((1.2 + aSeed.w * 2.6) * uScale * (14.0 / max(d, 0.5)), 1.0, 6.0 * uScale);
  }
`;
export const dustFrag = /* glsl */ `
  precision highp float;
  uniform vec3 uColor;
  varying float vA;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    gl_FragColor = vec4(uColor, smoothstep(0.5, 0.0, r) * vA * 0.55);
  }
`;

/* ------------------------------------------------------------------ */
/* Final grade: chromatic edge, split-tone, vignette, film grain        */
/* ------------------------------------------------------------------ */
export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrain: { value: 0.05 },
    uVignette: { value: 0.45 },
    uChroma: { value: 0.002 },
    uSat: { value: 1.0 },
    uContrast: { value: 1.05 },
    uFade: { value: 1.0 },
    uShadowTint: { value: [0.1, 0.4, 0.45] },
    uHighTint: { value: [1.0, 0.7, 0.4] },
    uRes: { value: [1280, 720] },
    uInk: { value: 1.0 },
    uDots: { value: 1.0 },
    uBands: { value: 5.0 },
    uSpeed: { value: 0.0 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  /* Manga look: cel bands, ink outlines, halftone screentone, radial speed lines. */
  fragmentShader: /* glsl */ `
    precision highp float;
    uniform sampler2D tDiffuse;
    uniform float uTime, uGrain, uVignette, uChroma, uSat, uContrast, uFade, uInk, uDots, uBands, uSpeed;
    uniform vec3 uShadowTint, uHighTint;
    uniform vec2 uRes;
    varying vec2 vUv;
    float hash(vec2 p) {
      vec3 p3 = fract(vec3(p.xyx) * 0.1031);
      p3 += dot(p3, p3.yzx + 33.33);
      return fract((p3.x + p3.y) * p3.z);
    }
    float lum(vec3 c) { return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
    void main() {
      vec2 c = vUv - 0.5;
      float r2 = dot(c, c);
      vec2 off = c * r2 * uChroma * 6.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;

      // ink outlines: Sobel on luminance
      vec2 px = 1.6 / uRes;
      float tl = lum(texture2D(tDiffuse, vUv + vec2(-px.x, px.y)).rgb);
      float t  = lum(texture2D(tDiffuse, vUv + vec2(0.0, px.y)).rgb);
      float tr = lum(texture2D(tDiffuse, vUv + vec2(px.x, px.y)).rgb);
      float lf = lum(texture2D(tDiffuse, vUv + vec2(-px.x, 0.0)).rgb);
      float rt = lum(texture2D(tDiffuse, vUv + vec2(px.x, 0.0)).rgb);
      float bl = lum(texture2D(tDiffuse, vUv + vec2(-px.x, -px.y)).rgb);
      float b  = lum(texture2D(tDiffuse, vUv + vec2(0.0, -px.y)).rgb);
      float br = lum(texture2D(tDiffuse, vUv + vec2(px.x, -px.y)).rgb);
      float gx = -tl - 2.0 * lf - bl + tr + 2.0 * rt + br;
      float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
      float edge = smoothstep(0.85, 1.45, length(vec2(gx, gy)));

      float l = lum(col);
      // black & white, but strongly saturated pixels (the red core and gates) keep their colour
      float chroma = max(max(col.r, col.g), col.b) - min(min(col.r, col.g), col.b);
      col = mix(vec3(l), col, max(uSat, smoothstep(0.22, 0.5, chroma)));

      // cel shading: quantise brightness into flat bands, keep the hue
      float q = floor(l * uBands + 0.5) / uBands;
      float soft = mix(l, q, 0.72);
      col *= soft / max(l, 0.02);

      col = (col - 0.5) * uContrast + 0.5;
      col += uShadowTint * (1.0 - smoothstep(0.0, 0.55, l)) * 0.07;
      col += uHighTint * smoothstep(0.45, 1.0, l) * 0.05;

      // halftone screentone in the shadows (45 degree dot grid)
      float cell = max(5.0, uRes.y / 120.0);
      vec2 g = mat2(0.7071, -0.7071, 0.7071, 0.7071) * (gl_FragCoord.xy / cell);
      vec2 f = fract(g) - 0.5;
      float dotR = (1.0 - smoothstep(0.05, 0.62, l)) * 0.62;
      float dotM = 1.0 - smoothstep(dotR - 0.08, dotR + 0.02, length(f));
      col = mix(col, col * 0.30, dotM * uDots * (1.0 - smoothstep(0.55, 0.75, l)));

      // radial speed lines while moving fast
      float ang = atan(c.y, c.x);
      float rad = length(c);
      float rays = step(0.72, hash(vec2(floor(ang * 64.0), floor(uTime * 12.0))));
      float lines = rays * smoothstep(0.28, 0.62, rad) * uSpeed;
      col = mix(col, vec3(0.97, 0.94, 0.88), lines * 0.55);

      col = mix(col, vec3(0.02, 0.03, 0.05), edge * uInk);
      col *= 1.0 - uVignette * smoothstep(0.22, 0.95, length(c) * 1.45);

      float n = hash(gl_FragCoord.xy + fract(uTime) * 311.0) - 0.5;
      col += n * uGrain * (1.0 - l * 0.5);

      gl_FragColor = vec4(max(col, 0.0) * uFade, 1.0);
    }
  `,
};
