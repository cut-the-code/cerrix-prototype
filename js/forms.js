// 06-11: gedeeld door de sectorhover op de homepage (sectors.js) en de 3D-hero op de sectorpagina (hero-obj.js),
// zodat beide exact hetzelfde object tonen. Materialen en vormen ongewijzigd uit sectors.js gehaald.
import * as THREE from 'three';

export const FORM_INDEX = { banken: 0, verzekeraars: 1, pensioenfondsen: 2, crypto: 3, vermogensbeheer: 4, 'financiele-dienstverlening': 5 };

export function createForms(S = { capColor: 0x91a6c2, rimColor: 0x5a729c }) {
  // ---- material (same powder-coat grain as the hero) ----
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  function grainTextures(size = 512) {
    const layer = n => {
      const c = document.createElement('canvas'); c.width = c.height = n;
      const x = c.getContext('2d'); const img = x.createImageData(n, n);
      for (let i = 0; i < img.data.length; i += 4) { const v = rand() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      x.putImageData(img, 0, 0); return c;
    };
    const c = document.createElement('canvas'); c.width = c.height = size;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, size, size);
    for (const [n, w] of [[6, 0.35], [24, 0.25], [96, 0.2], [size, 0.45]]) { ctx.globalAlpha = w; ctx.drawImage(layer(n), 0, 0, size, size); }
    const bumpCanvas = document.createElement('canvas'); bumpCanvas.width = bumpCanvas.height = size;
    ctx.globalAlpha = 1; bumpCanvas.getContext('2d').drawImage(c, 0, 0);
    ctx.globalAlpha = 0.7; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size); ctx.globalAlpha = 1;
    const color = new THREE.CanvasTexture(c); color.colorSpace = THREE.SRGBColorSpace;
    const bump = new THREE.CanvasTexture(bumpCanvas); bump.wrapS = bump.wrapT = THREE.RepeatWrapping; bump.repeat.set(2, 2);
    return { color, bump };
  }
  const tex = grainTextures();
  const cap = new THREE.MeshStandardMaterial({
    color: S.capColor, map: tex.color, roughness: 0.92, roughnessMap: tex.bump, metalness: 0,
    bumpMap: tex.bump, bumpScale: 0.7,
  });
  const rim = new THREE.MeshStandardMaterial({ color: S.rimColor, roughness: 0.45, metalness: 0.25 });
  const capFlat = cap.clone(); capFlat.flatShading = true;

  const mesh = (geo, mat) => { const m = new THREE.Mesh(geo, mat); m.castShadow = m.receiveShadow = true; return m; };
  // planar UVs so the grain maps evenly across flat faces
  function planarUV(geo, size) {
    const p = geo.attributes.position, uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / size + .5, p.getY(i) / size + .5);
    return geo;
  }
  function extrude(shape, depth, bevel, size, center = true) {
    const g = new THREE.ExtrudeGeometry(shape, {
      depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 4, curveSegments: 64,
    });
    planarUV(g, size);
    if (center) g.center(); else g.translate(0, 0, -depth / 2);
    return g;
  }
  function coin(r, h, bevel = 0.05) {
    const g = extrude(new THREE.Shape().absarc(0, 0, r - bevel, 0, Math.PI * 2), Math.max(h - bevel * 2, 0.001), bevel, r * 2);
    g.rotateX(-Math.PI / 2);
    return g;
  }

  // ---- the six forms ---------------------------------------------------------
  // Outline of a character in the site font, traced from a canvas render, as a
  // THREE.Path in object units (max dimension = size). Used to cut the euro out of the coin.
  async function glyphPath(ch, size, weight = 600) {
    const font = `${weight} 200px "Inter 18 Pt"`;
    await document.fonts.load(font, ch);
    const N = 256, c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    x.font = font; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = '#000';
    x.fillText(ch, N / 2, N / 2);
    const a = x.getImageData(0, 0, N, N).data;
    const inside = (px, py) => px >= 0 && py >= 0 && px < N && py < N && a[(py * N + px) * 4 + 3] > 127;
    // start: first filled pixel, scanning rows from the top
    let start = null;
    for (let py = 0; py < N && !start; py++) for (let px = 0; px < N; px++) if (inside(px, py)) { start = [px, py]; break; }
    // Moore-neighbour tracing (8 directions, clockwise on screen)
    const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const pts = [];
    let cur = start, dir = 7;
    for (let guard = 0; guard < 20000; guard++) {
      pts.push(cur);
      let moved = false;
      for (let k = 0; k < 8; k++) {
        const d = (dir + 6 + k) % 8, nx = cur[0] + D[d][0], ny = cur[1] + D[d][1];
        if (inside(nx, ny)) { cur = [nx, ny]; dir = d; moved = true; break; }
      }
      if (!moved || (cur[0] === start[0] && cur[1] === start[1] && pts.length > 2)) break;
    }
    // simplify (Ramer-Douglas-Peucker), then scale/centre into object units
    const rdp = (p, eps) => {
      if (p.length < 3) return p;
      const [ax, ay] = p[0], [bx, by] = p[p.length - 1];
      let max = 0, idx = 0;
      for (let i = 1; i < p.length - 1; i++) {
        const dd = Math.abs((by - ay) * p[i][0] - (bx - ax) * p[i][1] + bx * ay - by * ax) / (Math.hypot(bx - ax, by - ay) || 1);
        if (dd > max) { max = dd; idx = i; }
      }
      return max > eps ? [...rdp(p.slice(0, idx + 1), eps).slice(0, -1), ...rdp(p.slice(idx), eps)] : [p[0], p[p.length - 1]];
    };
    const simple = rdp(pts, 0.7);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const [px, py] of simple) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
    const k = size / Math.max(x1 - x0, y1 - y0), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return new THREE.Path(simple.map(([px, py]) => new THREE.Vector2((px - cx) * k, -(py - cy) * k)));
  }

  // 3D versions of the list icons: extruded solids with a rounded edge, small and simple
  function roundedRect(w, h, r) {
    const p = new THREE.Shape(), x = -w / 2, y = -h / 2;
    p.moveTo(x + r, y); p.lineTo(x + w - r, y); p.absarc(x + w - r, y + r, r, -Math.PI / 2, 0);
    p.lineTo(x + w, y + h - r); p.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2);
    p.lineTo(x + r, y + h); p.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
    p.lineTo(x, y + r); p.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5);
    return p;
  }
  const BUILD = [
    // Banken: a coin with a raised rim and a raised euro sign on both faces
    () => {
      const g = new THREE.Group();
      g.add(mesh(extrude(new THREE.Shape().absarc(0, 0, 1.0, 0, Math.PI * 2), 0.16, 0.06, 2.1), [cap, rim]));
      const FACE = 0.14;   // half the coin thickness (depth 0.16 + 2 x bevel 0.06)
      const ring = new THREE.TorusGeometry(0.8, 0.04, 16, 96);
      for (const z of [-FACE + 0.01, FACE - 0.01]) { const m = mesh(ring, cap); m.position.z = z; g.add(m); }
      // the euro arrives once the font is loaded
      glyphPath('€', 0.9).then(euro => {
        const geo = extrude(new THREE.Shape(euro.getPoints()), 0.06, 0.02, 1.0);
        // optical centre: a hair left of the bounding-box centre (tuned by eye on a face-on render)
        geo.translate(-0.015, 0, 0);
        const front = mesh(geo, [cap, rim]); front.position.z = FACE + 0.045;
        const back = mesh(geo, [cap, rim]); back.position.z = -FACE - 0.045; back.rotation.y = Math.PI;   // reads correctly from behind
        g.add(front, back);
      });
      return { g, tilt: 0.18 };
    },
    // Verzekeraars: a shield with a raised plus on both faces
    () => {
      const s = new THREE.Shape();
      s.moveTo(0, 1.12);
      s.bezierCurveTo(0.35, 0.98, 0.68, 0.94, 0.9, 0.94);
      s.lineTo(0.9, 0.18);
      s.bezierCurveTo(0.9, -0.48, 0.48, -0.88, 0, -1.12);
      s.bezierCurveTo(-0.48, -0.88, -0.9, -0.48, -0.9, 0.18);
      s.lineTo(-0.9, 0.94);
      s.bezierCurveTo(-0.68, 0.94, -0.35, 0.98, 0, 1.12);
      const a = 0.17, l = 0.52, cy = 0.06;     // half arm width, half arm length
      const plusPts = [[-a, l], [a, l], [a, a], [l, a], [l, -a], [a, -a], [a, -l], [-a, -l], [-a, -a], [-l, -a], [-l, a], [-a, a]]
        .map(([x, y]) => new THREE.Vector2(x, y));
      const g = new THREE.Group();
      g.add(mesh(extrude(s, 0.22, 0.06, 2.2), [cap, rim]));
      const FACE = 0.17;   // half the shield thickness (depth 0.22 + 2 x bevel 0.06)
      const plusGeo = extrude(new THREE.Shape(plusPts), 0.06, 0.02, 1.1);
      for (const side of [1, -1]) {
        const m = mesh(plusGeo, [cap, rim]);
        m.position.set(0, cy, side * (FACE + 0.045));
        g.add(m);
      }
      return { g, tilt: 0.12 };
    },
    // Pensioenfondsen: an hourglass, as in the icon - two plates and a slim glass
    () => {
      const g = new THREE.Group();
      const pts = [new THREE.Vector2(0, -0.86)];
      for (let i = 0; i <= 40; i++) {
        const y = -0.86 + (i / 40) * 1.72;
        pts.push(new THREE.Vector2(0.1 + 0.48 * Math.pow(Math.abs(y) / 0.86, 1.3), y));
      }
      pts.push(new THREE.Vector2(0, 0.86));
      g.add(mesh(new THREE.LatheGeometry(pts, 64), cap));
      const plate = coin(0.68, 0.14, 0.045);
      for (const y of [-0.93, 0.93]) { const m = mesh(plate, [cap, rim]); m.position.y = y; g.add(m); }
      return { g, tilt: 0.22 };
    },
    // Crypto: a faceted crystal / token
    () => {
      const geo = new THREE.OctahedronGeometry(1.0, 0);
      geo.scale(0.9, 1.2, 0.9);
      const g = new THREE.Group();
      g.add(mesh(geo, capFlat));
      return { g, tilt: 0.1 };
    },
    // Vermogensbeheer: a pie with one slice pulled out, as in the icon
    () => {
      const g = new THREE.Group();
      const slice = (a0, a1) => {
        const s = new THREE.Shape(); s.moveTo(0, 0); s.absarc(0, 0, 0.92, a0, a1, false); s.lineTo(0, 0);
        return mesh(extrude(s, 0.18, 0.05, 1.9, false), [cap, rim]);   // keep the shared pie centre
      };
      const big = slice(Math.PI / 2 + 0.05, Math.PI * 2 - 0.05);
      const wedge = slice(0.05, Math.PI / 2 - 0.05);
      wedge.position.set(0.14, 0.14, 0);   // pulled out along its middle (45 degrees)
      g.add(big, wedge);
      g.position.set(-0.06, -0.06, 0);     // re-centre the whole
      return { g, tilt: 0.12 };
    },
    // Financiële dienstverlening: two interlocking links, as in the icon
    () => {
      const g = new THREE.Group();
      const s = roundedRect(1.25, 0.8, 0.4);
      s.holes.push(roundedRect(0.85, 0.4, 0.2));
      const geo = extrude(s, 0.16, 0.05, 1.3);
      const a = mesh(geo, [cap, rim]); a.position.x = -0.36;
      const b = mesh(geo, [cap, rim]); b.position.x = 0.36; b.rotation.x = Math.PI / 2;
      g.add(a, b);
      return { g, tilt: 0.3 };
    },
  ];
  return { BUILD, cap, rim };
}
