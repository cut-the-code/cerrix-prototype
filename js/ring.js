// Overgenomen uit het prototype van 30-10 (oud/index.html); alleen de DOM-koppelingen zijn aangepast aan het ontwerp.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const params = new URLSearchParams(location.search);
const freezeT = parseFloat(params.get('t'));   // ?t=1.2 freezes the timeline, for review
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ============================================================================
// Donut
// ============================================================================
const CONFIG = {
  count: 30,              // number of discs
  ringRadius: 1.6,        // radius of the circle the discs sit on
  discRadius: 0.68,       // radius of each disc (smaller = bigger hole)
  thickness: 0.046,
  bevel: 0.014,           // rounded edge, so the discs aren't razor-sharp coins
  capColor: 0x91a6c2,     // face colour (lit faces read as pale grey-blue)
  rimColor: 0x5a729c,     // thin blue edge
  // orientation, starting from the ring facing the camera (looking through the hole):
  // first rolled in the screen plane (positive = counter-clockwise), then tipped
  // backwards around the centre. Tuned against the live hero image.
  rollDeg: -60,
  tiltBackDeg: 47,
  offset: [-0.08, 0.12],  // nudge within the frame to line up with the original image
  spinSpeed: 0.1,         // rad/s the discs travel along the ring
  introDuration: 2.6,     // seconds
  cameraDistance: 12.2,
};

const canvas = document.getElementById('donut');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;   // variance shadows: blurrable, soft edges

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.08;

const BLEED = 1.3;   // canvas is 130% of the image frame (see CSS)
const camera = new THREE.PerspectiveCamera(
  THREE.MathUtils.radToDeg(2 * Math.atan(BLEED * Math.tan(THREE.MathUtils.degToRad(11)))), 1, 0.1, 100);
camera.position.set(0, 0, CONFIG.cameraDistance);

// Two spotlights close to the ring, like the original: one from above, one
// from below. Because they sit close, the light angle and falloff change around the
// ring, so some discs catch light and others fall into shadow.
function spot(color, intensity, pos, target) {
  const l = new THREE.SpotLight(color, intensity, 0, 0.55, 1, 2);
  l.position.set(...pos);
  l.target.position.set(...target);
  l.castShadow = true;
  l.shadow.mapSize.set(256, 256);
  l.shadow.bias = -0.0004;
  l.shadow.radius = 22;        // softness of the shadow edge
  l.shadow.blurSamples = 24;
  scene.add(l, l.target);
  return l;
}
spot(0xd0e3fb, 120, [0.5, 4.0, 3.5], [0, 1.3, 0]);      // above
spot(0xcde0fa, 65, [-0.6, -3.6, 2.4], [0, -1.0, 0]);  // below
// faint blue backlight catches the rims; low fill keeps shadows navy, not black
const back = new THREE.DirectionalLight(0x8d9cd0, 1.2);
back.position.set(-2, -1, -6);
scene.add(back);
scene.add(new THREE.HemisphereLight(0x4d64a8, 0x08102a, 0.55));

// seeded random so the irregularity is the same on every load
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// Procedural powder-coat / sandblasted texture: layered noise at a few scales for
// soft mottling, plus fine speckle for grain.
function grainTextures(size = 512) {
  const layer = n => {
    const c = document.createElement('canvas');
    c.width = c.height = n;
    const x = c.getContext('2d');
    const img = x.createImageData(n, n);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = rand() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
      img.data[i + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    return c;
  };
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  // [cells, weight]: large soft blotches -> fine grain
  for (const [n, w] of [[6, 0.35], [24, 0.25], [96, 0.2], [size, 0.45]]) {
    ctx.globalAlpha = w;
    ctx.drawImage(layer(n), 0, 0, size, size);
  }
  ctx.globalAlpha = 1;
  const make = (repeat) => {
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat, repeat);
    t.anisotropy = 4;
    return t;
  };
  // colour map: same noise, washed towards white so it only mottles lightly
  ctx.globalAlpha = 0.7;
  ctx.fillStyle = '#fff';
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = bumpCanvas.height = size;
  bumpCanvas.getContext('2d').drawImage(c, 0, 0);
  ctx.fillRect(0, 0, size, size);
  ctx.globalAlpha = 1;
  const colorMap = make(1);
  colorMap.colorSpace = THREE.SRGBColorSpace;
  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping;
  bump.repeat.set(2, 2);
  return { bump, rough: bump, color: colorMap };
}
const tex = grainTextures();

const capMat = new THREE.MeshStandardMaterial({
  color: CONFIG.capColor, map: tex.color,   // slight mottling in the colour
  roughness: 0.92, roughnessMap: tex.rough, metalness: 0.0,
  bumpMap: tex.bump, bumpScale: 0.7,
});
const capBase = capMat.color.clone();
const rimMat = new THREE.MeshStandardMaterial({
  color: CONFIG.rimColor, roughness: 0.45, metalness: 0.25,
  emissive: new THREE.Color(0x1d44e0), emissiveIntensity: 0.0,
});
// Disc with a rounded (bevelled) edge: an extruded circle. Group 0 = flat faces,
// group 1 = edge + bevel (gets the blue rim material).
function bevelledDisc(r, thickness, bevel) {
  const shape = new THREE.Shape().absarc(0, 0, r - bevel, 0, Math.PI * 2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: Math.max(thickness - bevel * 2, 0.001),
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4,
    curveSegments: 96,
  });
  // planar UVs across the face so the grain texture maps like on a coin
  const pos = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (2 * r) + .5, pos.getY(i) / (2 * r) + .5);
  geo.center();
  geo.rotateX(-Math.PI / 2);   // face normal along Y, like the cylinder it replaces
  return geo;
}
const rimBase = rimMat.color.clone();
const discGeo = bevelledDisc(CONFIG.discRadius, CONFIG.thickness, CONFIG.bevel);

const ring = new THREE.Group();   // spins on its own axis: discs travel along the circle
const tilt = new THREE.Group();   // fixed presentation angle
// ?roll=45&tilt=45 overrides the angles, handy while fine-tuning
const deg = THREE.MathUtils.degToRad;
const rollDeg = parseFloat(params.get('roll') ?? CONFIG.rollDeg);
const tiltBackDeg = parseFloat(params.get('tilt') ?? CONFIG.tiltBackDeg);
// 'ZXY': roll in the screen plane first, then tip back around the ring's own horizontal axis
tilt.rotation.set(-deg(tiltBackDeg), 0, deg(rollDeg), 'ZXY');
tilt.add(ring);
// parallax group: follows the cursor a little; the lights stay put, so the light
// shifts subtly over the discs as you move
const parallax = new THREE.Group();
parallax.add(tilt);
scene.add(parallax);

const Y = new THREE.Vector3(0, 1, 0);
const discs = [];
for (let i = 0; i < CONFIG.count; i++) {
  const pivot = new THREE.Group();
  const mats = [capMat.clone(), rimMat.clone()];   // per disc, for the intro fade
  const mesh = new THREE.Mesh(discGeo, mats);
  mesh.castShadow = mesh.receiveShadow = true;
  pivot.add(mesh);
  ring.add(pivot);
  discs.push({
    pivot, mesh, mats,
    theta: (i / CONFIG.count) * Math.PI * 2 + (rand() - .5) * 0.05,
    jx: (rand() - .5) * 0.16, jz: (rand() - .5) * 0.16,
  });
}

const tangent = new THREE.Vector3();
const q = new THREE.Quaternion();
function placeDisc(d, theta, scale, open) {
  const r = CONFIG.ringRadius;
  d.pivot.position.set(Math.cos(theta) * r, Math.sin(theta) * r, 0);
  tangent.set(-Math.sin(theta), Math.cos(theta), 0);
  q.setFromUnitVectors(Y, tangent);
  d.pivot.quaternion.copy(q);
  // 'open' flips the disc from lying in the ring plane to upright
  d.mesh.rotation.set(d.jx + (1 - open) * Math.PI / 2, 0, d.jz);
  d.mesh.scale.setScalar(Math.max(scale, 0.0001));
}

const easeOutCubic = t => 1 - Math.pow(1 - t, 3);
const easeOutBack = t => { const c = 1.3; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const clamp01 = t => Math.min(1, Math.max(0, t));

let introStart = performance.now();
let spin = 0;

function updateDonut(t, dt) {
  const stagger = CONFIG.introDuration * 0.55 / CONFIG.count;
  const each = CONFIG.introDuration * 0.45;
  for (let i = 0; i < discs.length; i++) {
    const d = discs[i];
    const p = clamp01((t - i * stagger) / each);
    placeDisc(d, d.theta + (1 - easeOutCubic(p)) * -0.5, easeOutBack(p), easeOutCubic(p));
    // rise out of the shadow: stay dark while flat, brighten as the disc stands up
    const lum = p * p * p;
    d.mats[0].color.copy(capBase).multiplyScalar(lum);
    d.mats[1].color.copy(rimBase).multiplyScalar(lum);
  }
  const done = clamp01(t / (CONFIG.introDuration + 0.4));
  spin += dt * (CONFIG.spinSpeed * (0.25 + 0.75 * done) + scroll.boost);
  ring.rotation.z = spin;
  tilt.position.set(...CONFIG.offset, (1 - easeOutCubic(done)) * -1.5);
  renderer.render(scene, camera);
  // copy for the depth-of-field layer (half resolution is plenty once blurred)
  bctx.clearRect(0, 0, blurCanvas.width, blurCanvas.height);
  bctx.drawImage(canvas, 0, 0, blurCanvas.width, blurCanvas.height);
}

const blurCanvas = document.getElementById('donut-blur');
const bctx = blurCanvas.getContext('2d');
function resizeDonut() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (!w || !h) return;
  blurCanvas.width = Math.round(w * renderer.getPixelRatio() / 2);
  blurCanvas.height = Math.round(h * renderer.getPixelRatio() / 2);
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}

// ============================================================================
// Dust: tiny white specks drifting down, densest top-right (like Stars.avif)
// ============================================================================
const dustCanvas = document.getElementById('dust');
const dctx = dustCanvas.getContext('2d');
let specks = [], dw = 0, dh = 0, dpr = 1;

function spawn(s, anywhere) {
  // bias towards the top-right corner
  s.x = (1 - Math.pow(rand(), 1.5) * 0.45) * dw;
  s.y = anywhere ? Math.pow(rand(), 1.4) * dh * 0.6 : -5;
  s.r = 1 + Math.round(Math.pow(rand(), 5) * 1.6);   // size in device pixels
  s.vy = 2 + rand() * 7;              // px/s, very slow fall
  s.sway = 4 + rand() * 10;
  s.phase = rand() * Math.PI * 2;
  s.freq = 0.15 + rand() * 0.35;
  s.a = 0.6 + rand() * 0.4;
  return s;
}
function resizeDust() {
  dpr = Math.min(devicePixelRatio, 2);
  dw = dustCanvas.clientWidth; dh = dustCanvas.clientHeight;
  dustCanvas.width = dw * dpr; dustCanvas.height = dh * dpr;
  const n = Math.round(Math.min(420, dw * dh / 3000));
  specks = Array.from({ length: n }, () => spawn({}, true));
}
function updateDust(t, dt) {
  dctx.setTransform(1, 0, 0, 1, 0, 0);
  dctx.clearRect(0, 0, dustCanvas.width, dustCanvas.height);
  dctx.fillStyle = '#fff';
  for (const s of specks) {
    s.y += s.vy * dt;
    if (s.y > dh * 0.65) spawn(s, false);
    const x = s.x + Math.sin(t * s.freq + s.phase) * s.sway + follow.x * PARALLAX.dust * s.r;
    // fade out towards the bottom and the left, twinkle a little
    const fade = clamp01((1 - s.y / (dh * 0.65)) * 1.5) * clamp01((x / dw - 0.55) * 5);
    const tw = 0.75 + 0.25 * Math.sin(t * 1.7 + s.phase * 3);
    dctx.globalAlpha = s.a * fade * tw;
    // snapped to whole device pixels so the specks stay crisp
    dctx.fillRect(Math.round(x * dpr), Math.round((s.y + follow.y * PARALLAX.dust * 0.6 * s.r) * dpr), s.r, s.r);
  }
  dctx.globalAlpha = 1;
}

// ============================================================================
// Loop
// ============================================================================
function resize() { resizeDonut(); resizeDust(); }
addEventListener('resize', resize);
resize();

let last = performance.now(), visible = true;
// cursor position, -1..1 from the viewport centre (mouse only, not touch)
const pointer = { x: 0, y: 0 }, follow = { x: 0, y: 0 };
const PARALLAX = { rotY: 0.09, rotX: 0.06, moveX: 0.2, moveY: 0.15, dust: 8 };   // rotation (rad, ~5°), shift (world units, ~20px), dust px
if (!reduceMotion) {
  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = e.clientX / innerWidth * 2 - 1;
    pointer.y = e.clientY / innerHeight * 2 - 1;
  });
  document.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });
}
// ?px=1&py=-1 pins the cursor position, for review screenshots
if (params.has('px')) {
  follow.x = pointer.x = parseFloat(params.get('px'));
  follow.y = pointer.y = parseFloat(params.get('py') ?? 0);
}
function updateParallax(dt) {
  const k = 1 - Math.exp(-dt * 2.5);   // slow, damped follow
  follow.x += (pointer.x - follow.x) * k;
  follow.y += (pointer.y - follow.y) * k;
  parallax.rotation.set(follow.y * PARALLAX.rotX + scroll.tilt, follow.x * PARALLAX.rotY, 0);
  parallax.position.set(follow.x * PARALLAX.moveX, -follow.y * PARALLAX.moveY, 0);
}

// Scroll: the ring trails the page (moves down at a fraction of the scroll, so it drifts
// behind the video), tips back a little, and its discs speed up in the scroll direction.
const SCROLL = { follow: 0.38, tiltMax: 0.35, tiltPerPx: 0.0006, boostPerPxs: 0.0016, boostMax: 2.2 };
const scroll = { y: scrollY, last: scrollY, boost: 0, tilt: 0 };
const ringWrap = document.querySelector('.proto-ring');
if (params.has('scrollto')) setTimeout(() => scrollTo(0, +params.get('scrollto')), 300);   // review only
function updateScroll(dt) {
  const y = scrollY;
  const v = dt > 0 ? (y - scroll.last) / dt : 0;   // px/s, signed
  scroll.last = y;
  const target = Math.max(-SCROLL.boostMax, Math.min(SCROLL.boostMax, v * SCROLL.boostPerPxs));
  scroll.boost += (target - scroll.boost) * (1 - Math.exp(-dt * (Math.abs(target) > Math.abs(scroll.boost) ? 6 : 1.5)));
  scroll.tilt = Math.min(SCROLL.tiltMax, y * SCROLL.tiltPerPx);
  ringWrap.style.transform = `translate3d(0, ${(y * SCROLL.follow).toFixed(1)}px, 0)`;
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  const live = !reduceMotion && isNaN(freezeT);
  if (!reduceMotion) updateScroll(dt);
  updateParallax(dt);
  const t = !isNaN(freezeT) ? freezeT : reduceMotion ? 999 : (now - introStart) / 1000;
  updateDonut(t, live ? dt : 0);
  updateDust(now / 1000, live ? dt : 0);
  if (visible) requestAnimationFrame(frame);
}
new IntersectionObserver(([e]) => {
  const was = visible;
  visible = e.isIntersecting;
  if (visible && !was) { last = performance.now(); requestAnimationFrame(frame); }
}).observe(document.querySelector('.ds-band'));
requestAnimationFrame(frame);


