// Overgenomen uit het prototype van 30-10 (oud/index.html); alleen de DOM-koppelingen zijn aangepast aan het ontwerp.
// ============================================================================
// Sector objects: a simple 3D form per sector grows out of the cursor while you
// hover its row, spins at a constant speed, and swaps quickly to the next row.
// Same material and light rig as the hero ring, so they read as one family.
// ============================================================================
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createForms } from './forms.js';

const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const section = document.querySelector('.hp-s3');
const canvas = document.getElementById('sector-canvas');
const rows = [...document.querySelectorAll('.hp-srow')];

const S = {
  sizePx: 120,           // on-screen size of an object (06-11: 20% kleiner, was 150)
  offset: [56, -8],      // object centre relative to the cursor (px, right / down)
  // lean: the object tilts in the direction the cursor moves and springs back upright
  leanPerPx: 0.0011,     // radians of tilt per px/s of cursor speed
  leanMax: 0.55,         // cap, ~30 degrees
  leanStiffness: 90, leanDamping: 11,   // spring back: a little wobble before settling
  spin: 0.8,             // rad/s, identical for every object so a swap keeps the rhythm
  follow: 10,            // how quickly the object trails the cursor
  stiffness: 320,        // grow/shrink spring: higher = snappier
  damping: 22,           // lower = more overshoot
  capColor: 0x91a6c2, rimColor: 0x5a729c,   // as the hero ring
};
const UNIT = 2.4;        // every object is modelled to fit roughly a 2.4-unit box

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;

const scene = new THREE.Scene();
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.08;
scene.add(new THREE.HemisphereLight(0x4d64a8, 0x08102a, 0.55));

// narrow lens from far away: close to orthographic, so an object looks the same
// wherever the cursor is in the section
const FOV = 12;
const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 400);

// the follower carries the object AND its lights, so the lighting stays identical
// wherever the object is on screen
const follower = new THREE.Group();
scene.add(follower);
function spot(color, intensity, pos, target) {
  const l = new THREE.SpotLight(color, intensity, 0, 0.6, 1, 2);
  l.position.set(...pos);
  l.target.position.set(...target);
  l.castShadow = true;
  l.shadow.mapSize.set(256, 256);
  l.shadow.bias = -0.0004;
  l.shadow.radius = 18;
  l.shadow.blurSamples = 20;
  follower.add(l, l.target);
}
spot(0xd0e3fb, 120, [0.6, 4.2, 3.8], [0, 0.4, 0]);    // above
spot(0xcde0fa, 55, [-0.8, -3.8, 2.8], [0, -0.4, 0]);  // below
const back = new THREE.PointLight(0x8d9cd0, 18, 0, 2);
back.position.set(-2.5, 1, -4);
follower.add(back);

const { BUILD } = createForms(S);

// lean group: tilts with the cursor's speed (the lights stay put, so the light
// also slides over the object while it leans)
const lean = new THREE.Group();
follower.add(lean);
const L = { x: 0, vx: 0, y: 0, vy: 0, z: 0, vz: 0 };

const objects = BUILD.map(build => {
  const { g, tilt } = build();
  const spinner = new THREE.Group(); spinner.add(g);
  const tiltG = new THREE.Group(); tiltG.rotation.set(tilt, 0, -0.08); tiltG.add(spinner);
  const holder = new THREE.Group(); holder.add(tiltG); holder.visible = false;
  lean.add(holder);
  return { holder, spinner, s: 0, v: 0 };
});

// ---- sizing: camera distance chosen so 1 world unit = sizePx / UNIT pixels ----
let W = 1, H = 1, wpp = 1;
function resize() {
  W = canvas.clientWidth; H = canvas.clientHeight;
  if (!W || !H) return;
  renderer.setSize(W, H, false);
  wpp = UNIT / S.sizePx;                                  // world units per pixel
  camera.aspect = W / H;
  camera.position.set(0, 0, (H * wpp / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2)));
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize);
resize();

// ---- interaction ----
let active = -1;
const cursor = { x: W / 2, y: H / 2 }, pos = { x: W / 2, y: H / 2 }, prev = { x: W / 2, y: H / 2 };
const toWorld = (px, py) => [(px - W / 2) * wpp, -(py - H / 2) * wpp];
section.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse') return;
  const r = canvas.getBoundingClientRect();
  cursor.x = e.clientX - r.left + S.offset[0];
  cursor.y = e.clientY - r.top + S.offset[1];
});
rows.forEach((row, i) => row.addEventListener('pointerenter', e => {
  if (e.pointerType !== 'mouse') return;
  // nothing visible yet: start right at the cursor instead of sliding in from afar
  if (objects.every(o => o.s < 0.02)) { pos.x = prev.x = cursor.x; pos.y = prev.y = cursor.y; }
  active = i;
}));
document.querySelector('.hp-srows').addEventListener('pointerleave', () => { active = -1; });

// ?lean=0.4 shows a fixed lean, ?sector=2 pins a sector open (for review screenshots)
const leanFix = parseFloat(params.get('lean'));
if (params.has('sector')) {
  active = parseInt(params.get('sector'), 10);
  const r = rows[active].getBoundingClientRect(), c = canvas.getBoundingClientRect();
  cursor.x = pos.x = r.left - c.left + r.width * 0.42 + S.offset[0];
  cursor.y = pos.y = r.top - c.top + r.height / 2 + S.offset[1];
  objects[active].s = 1;
}

// ---- loop ----
let angle = parseFloat(params.get('spin') ?? 0), last = performance.now(), visible = false;
const spinFrozen = params.has('spin');
function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  if (!reduceMotion && !spinFrozen) angle += dt * S.spin;

  const k = 1 - Math.exp(-dt * S.follow);
  pos.x += (cursor.x - pos.x) * k;
  pos.y += (cursor.y - pos.y) * k;
  const [wx, wy] = toWorld(pos.x, pos.y);
  follower.position.set(wx, wy, 0);

  // lean into the movement: right -> top falls back to the left, down -> top tips away,
  // plus a little turn; when the cursor stops the spring brings it back upright
  if (!reduceMotion && dt > 0) {
    const vx = (pos.x - prev.x) / dt, vy = (pos.y - prev.y) / dt;
    const c = v => Math.max(-S.leanMax, Math.min(S.leanMax, v * S.leanPerPx));
    for (const [axis, target] of [['z', c(vx)], ['x', c(vy)], ['y', c(vx) * 0.6]]) {
      const v = 'v' + axis;
      L[v] += (target - L[axis]) * S.leanStiffness * dt;
      L[v] *= Math.exp(-S.leanDamping * dt);
      L[axis] += L[v] * dt;
    }
    lean.rotation.set(L.x, L.y, L.z);
  }
  prev.x = pos.x; prev.y = pos.y;
  if (!isNaN(leanFix)) lean.rotation.set(leanFix * 0.5, leanFix * 0.6, leanFix);

  objects.forEach((o, i) => {
    const target = i === active ? 1 : 0;
    if (reduceMotion) o.s = target;
    else {
      // spring: grows with a little overshoot, shrinks fast
      o.v += (target - o.s) * S.stiffness * dt;
      o.v *= Math.exp(-S.damping * dt);
      o.s += o.v * dt;
    }
    const s = Math.max(o.s, 0);
    o.holder.visible = s > 0.003;
    o.holder.scale.setScalar(Math.max(s, 0.0001));
    o.spinner.rotation.y = angle;   // shared angle: a new object picks up the same rotation
  });

  renderer.render(scene, camera);
  if (visible) requestAnimationFrame(frame);
}
new IntersectionObserver(([e]) => {
  const was = visible;
  visible = e.isIntersecting;
  if (visible && !was) { last = performance.now(); resize(); requestAnimationFrame(frame); }
}).observe(section);
// 03-11: de sectie groeit als 'Bekijk meer sectoren' de andere drie rijen toont; het canvas moet dan mee,
// anders tekent het object uitgerekt en op de verkeerde plek
new ResizeObserver(() => resize()).observe(section);

