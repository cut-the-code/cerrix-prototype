// 06-11: 3D-object in de hero van de sectorpagina. Hetzelfde object als bij de hover in "Gebouwd voor jouw sector"
// op de homepage (js/forms.js), zodat je de sector herkent waar je vandaan komt. Groot, in een schuine stand en met
// de lichtopstelling van de hero-ring (js/ring.js). Beweging: alleen cursor-parallax (zoals de ring) en een rustige
// verticale zweefbeweging; geen draaien of andere animatie.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createForms, FORM_INDEX } from './forms.js';

const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const wrap = document.querySelector('.proto-hero-obj');
const canvas = wrap && wrap.querySelector('canvas');

const C = {
  // schuine stand: top naar de kijker (je ziet het bovenblad), as naar rechts gekanteld, iets gedraaid
  tilt: [0.42, 0.35, -0.38],   // x, y, z in radialen
  fill: 0.76,                  // objecthoogte als deel van de canvashoogte (06-11: groter, was 0.62)
  // licht: zelfde opbouw als de hero-ring (boven, onder, blauw tegenlicht, navy vulling), maar smalle bundels van
  // rechtsboven en bijna geen vullicht, zodat hals en voet in diepe navy schaduw vallen zoals de schijven van de ring
  // (06-11: variant E gekozen uit vier; was top 120/bottom 65/angle 0.6/back 1.2/hemi 0.55/env 0.08)
  light: { top: 170, bottom: 25, angle: 0.3, back: 3.5, hemi: 0.08, env: 0.02, exposure: 1.0,
           topPos: [2.2, 3.2, 2.2], bottomPos: [-1.6, -3.0, 1.2] },
  bob: { amp: 0.07, period: 5.2 },               // wereldeenheden (~2% van de canvashoogte), seconden per op-en-neer
  parallax: { rotY: 0.12, rotX: 0.08, moveX: 0.12, moveY: 0.09 },   // als de hero-ring, iets meer draai
  follow: 3,                   // hoe snel het object de cursor volgt
};
// ?cfg={"fill":0.8,"light":{...}} overschrijft waarden, om varianten te beoordelen
try { const o = JSON.parse(params.get('cfg') || '{}'); Object.assign(C, o, { light: { ...C.light, ...(o.light || {}) } }); } catch (e) {}
const UNIT = 2.4;              // vormen zijn gemodelleerd op een kader van ~2,4 eenheden (zie forms.js)

if (canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = C.light.exposure;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.VSMShadowMap;

  const scene = new THREE.Scene();
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = C.light.env;

  const FOV = 18;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 100);
  const dist = (UNIT / C.fill / 2) / Math.tan(THREE.MathUtils.degToRad(FOV / 2));
  camera.position.set(0, 0, dist);

  // lichtopstelling van de hero-ring: spot van boven, spot van onder, blauw tegenlicht, navy vulling
  function spot(color, intensity, pos, target) {
    const l = new THREE.SpotLight(color, intensity, 0, C.light.angle, 1, 2);
    l.position.set(...pos); l.target.position.set(...target);
    l.castShadow = true;
    l.shadow.mapSize.set(512, 512); l.shadow.bias = -0.0004; l.shadow.radius = 22; l.shadow.blurSamples = 24;
    scene.add(l, l.target);
  }
  spot(0xd0e3fb, C.light.top, C.light.topPos, [0, 0.5, 0]);          // boven
  spot(0xcde0fa, C.light.bottom, C.light.bottomPos, [0, -0.5, 0]);   // onder
  const back = new THREE.DirectionalLight(0x8d9cd0, C.light.back);
  back.position.set(-2, -1, -6);
  scene.add(back, new THREE.HemisphereLight(0x4d64a8, 0x08102a, C.light.hemi));

  const { BUILD } = createForms();
  const { g } = BUILD[FORM_INDEX[wrap.dataset.form] ?? 2]();
  const tilt = new THREE.Group(); tilt.rotation.set(...C.tilt); tilt.add(g);
  const bob = new THREE.Group(); bob.add(tilt);
  const parallax = new THREE.Group(); parallax.add(bob);
  scene.add(parallax);

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  addEventListener('resize', resize);
  new ResizeObserver(resize).observe(canvas);
  resize();

  // cursor: -1..1 vanaf het midden van het venster, alleen muis (zoals de hero-ring)
  const pointer = { x: 0, y: 0 }, follow = { x: 0, y: 0 };
  if (!reduceMotion) {
    addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      pointer.x = e.clientX / innerWidth * 2 - 1; pointer.y = e.clientY / innerHeight * 2 - 1;
    });
    document.addEventListener('pointerleave', () => { pointer.x = pointer.y = 0; });
  }
  // ?px=..&py=.. zet de cursor vast, ?t=.. bevriest de zweefbeweging (voor screenshots)
  if (params.has('px')) { follow.x = pointer.x = parseFloat(params.get('px')); follow.y = pointer.y = parseFloat(params.get('py') ?? 0); }
  const freezeT = parseFloat(params.get('t'));

  function pose(t, dt) {
    const k = 1 - Math.exp(-dt * C.follow);
    follow.x += (pointer.x - follow.x) * k; follow.y += (pointer.y - follow.y) * k;
    const P = C.parallax;
    parallax.rotation.set(follow.y * P.rotX, follow.x * P.rotY, 0);
    parallax.position.set(follow.x * P.moveX, -follow.y * P.moveY, 0);
    bob.position.y = reduceMotion ? 0 : Math.sin(t / C.bob.period * Math.PI * 2) * C.bob.amp;
  }

  let visible = false, last = performance.now(), t0 = performance.now();
  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    pose(isNaN(freezeT) ? (now - t0) / 1000 : freezeT, dt);
    renderer.render(scene, camera);
    if (visible) requestAnimationFrame(frame);
  }
  new IntersectionObserver(([e]) => {
    const was = visible; visible = e.isIntersecting;
    if (visible && !was) { last = performance.now(); resize(); requestAnimationFrame(frame); }
  }).observe(wrap);
  wrap.classList.add('is-live');

  // stilstaand beeld voor het ontwerp/Figma: middenstand, zonder cursor, als transparante PNG
  window.__heroObjPNG = () => {
    follow.x = follow.y = pointer.x = pointer.y = 0;
    pose(0, 1); renderer.render(scene, camera);
    return canvas.toDataURL('image/png');
  };
}
