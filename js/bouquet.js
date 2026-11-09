import * as THREE from 'three';
import { TYPES, buildFlower, buildStemLeaf, disposeTree, mulberry32 } from './flowers.js';

const UP = new THREE.Vector3(0, 1, 0);
export const PAPER_STYLES = {
  cone: { H: 1.5, R0: 0.12, R1: 1.1, p: 0.8, wave: 1, pleat: 0.045 },
  wide: { H: 1.4, R0: 0.15, R1: 1.35, p: 1.25, wave: 1.2, pleat: 0.05 },
  tube: { H: 1.5, R0: 0.3, R1: 0.82, p: 0.4, wave: 0.8, pleat: 0.03 },
  tray: { H: 0.75, R0: 0.9, R1: 1.3, p: 0.9, wave: 1.3, pleat: 0.05, tray: true },
  frill: { H: 1.5, R0: 0.12, R1: 1.15, p: 0.8, wave: 2.4, pleat: 0.09 },
};
export const BASKET_STYLES = {
  round: { H: 0.9, rt: 1.0, rb: 0.78, seg: 56 },
  tall: { H: 1.35, rt: 0.92, rb: 0.8, seg: 56 },
  bowl: { H: 0.55, rt: 1.2, rb: 0.6, seg: 56 },
  square: { H: 0.85, rt: 1.05, rb: 0.85, seg: 4 },
};
let PS = PAPER_STYLES.cone, BS = BASKET_STYLES.round;
export const FLAT = { x: 1.2, z: 0.42 };

export const coneRadius = (y) => PS.R0 + (PS.R1 - PS.R0) * Math.pow(Math.max(0, Math.min(1, y / PS.H)), PS.p);

/* ---------- procedural textures ---------- */
function canvasTex(w, h, draw, repeat = [1, 1], srgb = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(...repeat);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function paperTexture(color, pattern) {
  if (pattern === 'plain') return null;
  const base = new THREE.Color(color);
  const light = '#' + base.clone().lerp(new THREE.Color(1, 1, 1), 0.75).getHexString();
  const dark = '#' + base.clone().multiplyScalar(0.7).getHexString();
  const baseHex = '#' + base.getHexString();
  const rep = pattern === 'stripes' ? [8, 2] : pattern === 'hearts' ? [10, 3] : [10, 3];
  return canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = baseHex; x.fillRect(0, 0, w, h);
    if (pattern === 'dots') {
      x.fillStyle = light;
      [[32, 32], [96, 96]].forEach(([a, b]) => { x.beginPath(); x.arc(a, b, 12, 0, 7); x.fill(); });
    } else if (pattern === 'stripes') {
      x.fillStyle = light; x.fillRect(0, 0, 40, h);
    } else if (pattern === 'hearts') {
      x.fillStyle = light;
      [[32, 34], [96, 98]].forEach(([a, b]) => {
        x.beginPath(); x.moveTo(a, b + 12);
        x.bezierCurveTo(a - 22, b - 4, a - 10, b - 22, a, b - 8);
        x.bezierCurveTo(a + 10, b - 22, a + 22, b - 4, a, b + 12); x.fill();
      });
    } else if (pattern === 'check') {
      x.fillStyle = dark; x.globalAlpha = 0.25;
      x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64);
    }
  }, rep);
}

const noiseTex = (() => {
  let t;
  return () => t || (t = canvasTex(256, 256, (x, w, h) => {
    const d = x.createImageData(w, h);
    for (let i = 0; i < d.data.length; i += 4) { const v = 120 + Math.random() * 90; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
    x.putImageData(d, 0, 0);
  }, [6, 6], false));
})();

function wickerTexture(color) {
  const b = new THREE.Color(color);
  const l = '#' + b.clone().multiplyScalar(1.15).getHexString();
  const d = '#' + b.clone().multiplyScalar(0.7).getHexString();
  return canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = d; x.fillRect(0, 0, w, h);
    const rows = 8, rh = h / rows;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < 4; c++) {
        const off = (r % 2) * 16;
        x.fillStyle = (c + r) % 2 ? l : '#' + b.getHexString();
        x.fillRect(c * 32 + off + 1, r * rh + 1, 30, rh - 2);
      }
    }
  }, [10, 2.2]);
}

function foamTexture(color) {
  const b = new THREE.Color(color);
  return canvasTex(128, 128, (x, w, h) => {
    x.fillStyle = '#' + b.getHexString(); x.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      x.fillStyle = Math.random() > 0.5 ? '#' + b.clone().multiplyScalar(0.8).getHexString() : '#' + b.clone().lerp(new THREE.Color(1, 1, 1), 0.3).getHexString();
      x.globalAlpha = 0.5;
      x.beginPath(); x.arc(Math.random() * w, Math.random() * h, 0.6 + Math.random() * 1.6, 0, 7); x.fill();
    }
  }, [3, 3]);
}

/* ---------- paper geometry ---------- */
function wrapGeometry({ a0, a1, y0, topFn, radiusFn, pleat, segT = 36, segA = 160 }) {
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= segA; j++) {
    const th = a0 + (a1 - a0) * (j / segA);
    const yTop = topFn(th);
    for (let i = 0; i <= segT; i++) {
      const t = i / segT, y = y0 + t * (yTop - y0);
      const p = 1 + pleat * Math.pow(t, 1.6) * (0.55 * Math.sin(7 * th + t * 2) + 0.45 * Math.sin(13 * th - t * 3));
      const r = radiusFn(t, y) * p;
      pos.push(r * Math.sin(th), y, r * Math.cos(th));
      uv.push(j / segA, t);
    }
  }
  for (let j = 0; j < segA; j++) for (let i = 0; i < segT; i++) {
    const a = j * (segT + 1) + i, b = (j + 1) * (segT + 1) + i, c = a + 1, d = b + 1;
    idx.push(a, b, c, b, d, c);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}

function closeSeam(g, segT, segA) {
  const n = g.attributes.normal;
  for (let i = 0; i <= segT; i++) {
    const a = i, b = segA * (segT + 1) + i;
    const v = new THREE.Vector3(n.getX(a) + n.getX(b), n.getY(a) + n.getY(b), n.getZ(a) + n.getZ(b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z); n.setXYZ(b, v.x, v.y, v.z);
  }
}

/* ---------- containers ---------- */
function buildPaper(st, flat) {
  const g = new THREE.Group();
  if (PS.tray) g.scale.set(flat ? FLAT.x : 1.15, 1, flat ? 0.55 : 0.8);
  else if (flat) g.scale.set(FLAT.x, 1, FLAT.z);
  const noise = noiseTex();
  const topMain = (th) => PS.H - 0.1 * Math.cos(th) + PS.wave * (0.06 * Math.sin(5 * th + 1) + 0.04 * Math.sin(11 * th)) + (PS.wave > 2 ? 0.05 * Math.sin(19 * th) : 0);
  const geo = wrapGeometry({
    a0: 0, a1: Math.PI * 2, y0: 0, topFn: topMain, pleat: PS.pleat,
    radiusFn: (t) => coneRadius(t * PS.H) + 0.04 * Math.pow(t, 4),
  });
  closeSeam(geo, 36, 160);
  const outerMat = new THREE.MeshStandardMaterial({
    color: st.pattern === 'plain' ? st.outer : 0xffffff, map: paperTexture(st.outer, st.pattern),
    roughness: 0.85, bumpMap: noise, bumpScale: 0.6, side: THREE.FrontSide,
  });
  const innerMat = new THREE.MeshStandardMaterial({ color: st.inner, roughness: 0.85, bumpMap: noise, bumpScale: 0.6, side: THREE.BackSide });
  g.add(new THREE.Mesh(geo, outerMat), new THREE.Mesh(geo, innerMat));

  if (PS.tray) {
    const bot = new THREE.Mesh(new THREE.CircleGeometry(PS.R0, 48), innerMat.clone());
    bot.material.side = THREE.DoubleSide;
    bot.rotation.x = -Math.PI / 2; bot.position.y = 0.01;
    g.add(bot);
    const fm = new THREE.MeshStandardMaterial({ map: foamTexture(st.foamColor || '#8bb56a'), roughness: 1 });
    const foam = new THREE.Mesh(new THREE.CylinderGeometry(coneRadius(PS.H - 0.2) - 0.06, PS.R0 - 0.05, PS.H - 0.22, 48), fm);
    foam.position.y = (PS.H - 0.22) / 2 + 0.03;
    g.add(foam);
  }
  if (st.back && !PS.tray) {
    const half = 1.9;
    const bg = wrapGeometry({
      a0: Math.PI - half, a1: Math.PI + half, y0: 0.25, pleat: 0.08, segA: 120,
      topFn: (th) => PS.H + 0.15 + 0.95 * Math.pow(Math.max(0, Math.cos(((th - Math.PI) / half) * Math.PI / 2)), 1.3) + 0.04 * Math.sin(9 * th),
      radiusFn: (t) => coneRadius(t * PS.H) + 0.05 + 0.32 * t * t,
    });
    const bm = new THREE.MeshStandardMaterial({ color: st.backColor, roughness: 0.85, bumpMap: noise, bumpScale: 0.6, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(bg, bm));
  }
  return g;
}

function buildBasket(st, flat) {
  const g = new THREE.Group();

  const wick = wickerTexture(st.basketColor);
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(BS.rt, BS.rb, BS.H, BS.seg, 1, true),
    new THREE.MeshStandardMaterial({ map: wick, roughness: 0.9, bumpMap: wick, bumpScale: 1.5, side: THREE.FrontSide }));
  body.position.y = BS.H / 2;
  const inside = new THREE.Mesh(body.geometry, new THREE.MeshStandardMaterial({ color: new THREE.Color(st.basketColor).multiplyScalar(0.45), roughness: 1, side: THREE.BackSide }));
  inside.position.copy(body.position);
  const bottom = new THREE.Mesh(new THREE.CircleGeometry(BS.rb, BS.seg === 4 ? 4 : 40), new THREE.MeshStandardMaterial({ color: new THREE.Color(st.basketColor).multiplyScalar(0.6), roughness: 1 }));
  bottom.rotation.x = Math.PI / 2; bottom.position.y = 0.01;
  const rimMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(st.basketColor).multiplyScalar(0.9), roughness: 0.85 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(BS.rt, 0.045, 10, BS.seg === 4 ? 4 : 64), rimMat);
  rim.rotation.x = Math.PI / 2; rim.position.y = BS.H;
  const base = new THREE.Mesh(new THREE.TorusGeometry(BS.rb, 0.04, 10, BS.seg === 4 ? 4 : 64), rimMat);
  base.rotation.x = Math.PI / 2; base.position.y = 0.03;
  g.add(body, inside, bottom, rim, base);

  // foam block (floral foam)
  const fm = new THREE.MeshStandardMaterial({ map: foamTexture(st.foamColor), roughness: 1 });
  const foam = new THREE.Mesh(new THREE.CylinderGeometry(BS.rt - 0.05, BS.rb - 0.06, BS.H - 0.1, BS.seg === 4 ? 4 : 48), fm);
  foam.position.y = (BS.H - 0.1) / 2 + 0.06 + 0.06;
  const cap = new THREE.Mesh(new THREE.SphereGeometry(BS.rt - 0.06, 40, 10, 0, Math.PI * 2, 0, 0.32), fm);
  cap.scale.y = 0.5; cap.position.y = foam.position.y + (BS.H - 0.1) / 2 - 0.02;
  g.add(foam);
  if (BS.seg !== 4) g.add(cap);

  if (st.handle) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(BS.rt - 0.02, 0.05, 10, 56, Math.PI), rimMat);
    h.scale.y = 0.85;
    const pivot = new THREE.Group();
    pivot.position.set(0, BS.H, 0);
    pivot.rotation.x = -1.15; // fold back behind flowers
    pivot.add(h);
    g.add(pivot);
  }
  const outer = new THREE.Group();
  if (flat) outer.scale.set(FLAT.x, 1, FLAT.z + 0.15);
  if (BS.seg === 4) g.rotation.y = Math.PI / 4;
  outer.add(g);
  return outer;
}

function buildRibbon(st, mode, flat) {
  const trayP = mode === 'paper' && PS.tray;
  const fz = flat ? (trayP ? 0.55 : mode === 'paper' ? FLAT.z : FLAT.z + 0.15) : trayP ? 0.8 : 1, fx = flat ? FLAT.x : trayP ? 1.15 : 1;
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: st.color, roughness: 0.4, side: THREE.DoubleSide });
  let bowPos, tilt;
  if (mode === 'paper') {
    const y = PS.tray ? PS.H * 0.45 : 0.5;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(coneRadius(y + 0.07) + 0.03, coneRadius(y - 0.07) + 0.03, 0.14, 56, 1, true), mat);
    band.position.y = y; band.scale.set(fx, 1, fz);
    g.add(band);
    bowPos = new THREE.Vector3(0, y, coneRadius(y) * fz + 0.06);
    tilt = Math.atan(((coneRadius(y + 0.05) - coneRadius(y - 0.05)) / 0.1) * fz);
  } else {
    const y = Math.min(0.5, BS.H * 0.55), r = (BS.rb + (BS.rt - BS.rb) * (y / BS.H)) * (BS.seg === 4 ? 0.72 : 1);
    bowPos = new THREE.Vector3(0, y, r * fz + 0.06);
    tilt = Math.atan(((BS.rt - BS.rb) / BS.H) * fz);
  }
  const bow = new THREE.Group();
  const loopGeo = new THREE.TorusGeometry(0.14, 0.03, 10, 30);
  for (const s of [-1, 1]) {
    const l = new THREE.Mesh(loopGeo, mat);
    l.scale.set(1.15, 1, 0.55); l.position.set(s * 0.17, 0.03, 0); l.rotation.z = s * -0.25;
    bow.add(l);
    const tg = new THREE.PlaneGeometry(0.1, 0.5, 1, 8);
    tg.translate(0, -0.25, 0);
    const p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) { const u = -p.getY(i) / 0.5; p.setZ(i, 0.07 * u * u); }
    tg.computeVertexNormals();
    const tail = new THREE.Mesh(tg, mat);
    tail.position.set(s * 0.05, -0.02, 0.01); tail.rotation.z = s * 0.28;
    bow.add(tail);
  }
  const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), mat);
  knot.scale.set(1.1, 1, 0.9);
  bow.add(knot);
  bow.position.copy(bowPos);
  bow.rotation.x = tilt;
  g.add(bow);
  return g;
}

/* ---------- main class ---------- */
export class Bouquet {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.flowersRoot = new THREE.Group();
    this.root.add(this.flowersRoot);
    this.entries = new Map();
    this.containerGroup = null;
    this.ribbonGroup = null;
    this.containerKey = '';
    this.ribbonKey = '';
    this.stemMat = new THREE.MeshStandardMaterial({ color: '#4f7d3a', roughness: 0.7 });
    this.marker = new THREE.Mesh(new THREE.TorusGeometry(1, 0.012, 8, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, depthTest: false }));
    this.marker.renderOrder = 20;
    this.marker.rotation.x = Math.PI / 2;
    this.markerHolder = new THREE.Group();
    this.markerHolder.add(this.marker);
  }

  get rootsForPicking() { return [...this.entries.values()].map((e) => e.root); }

  /* head positions for all flowers */
  layout(flowers, mode, shape) {
    const slots = new Map();
    const mains = flowers.filter((f) => !TYPES[f.type].greens);
    const greens = flowers.filter((f) => TYPES[f.type].greens);
    const n = mains.length;
    const paper = mode === 'paper' && !PS.tray, tray = mode === 'paper' && PS.tray;
    const flat = shape === 'flat';
    const top = tray ? 1.75 : paper ? 2.3 : 2.1, drop = paper ? 0.75 : tray ? 0.55 : 0.6;
    this.top = top; this.flat = flat;
    const c = n > 1 ? Math.min(0.42, 0.82 / Math.sqrt(n - 1)) : 0;
    const cf = n > 1 ? Math.min(0.5, 1.0 / Math.sqrt(n - 1)) : 0;
    const rad = (f) => (TYPES[f.type].group === 'flower' ? 0.3 : 0.15) * (TYPES[f.type].scale || 1) * (f.scale || 1);
    const radLeaf = (f) => 0.22 * (f.scale || 1);
    const leafNeed = (l, m) => 0.5 * (radLeaf(l.f) + rad(m.f));
    const FV = 0.4; // flat: greens' v-plane is offset from the flowers' v-plane

    // 1. auto positions in layout plane (u,v)
    const P = mains.map((f, i) => {
      const phi = i * 2.39996;
      let u, v;
      if (flat) { const rho = cf * Math.sqrt(i); u = rho * Math.cos(phi) * 1.3; v = rho * Math.sin(phi) * 0.85; }
      else { const rho = c * Math.sqrt(i); u = rho * Math.cos(phi); v = rho * Math.sin(phi); }
      const man = f.man && f.man[flat ? 'flat' : 'round'];
      return { f, u, v, fixed: !!man, ...(man ? { u: man[0], v: man[1] } : {}), u0: u, v0: v };
    });
    const G = greens.map((f, i) => {
      const man = f.man && f.man[flat ? 'flat' : 'round'];
      let u, v;
      if (flat) {
        const a = THREE.MathUtils.degToRad(12 + (greens.length > 1 ? (i / (greens.length - 1)) * 156 : 78));
        u = Math.cos(a) * 1.45; v = Math.sin(a) * 0.85 - FV;
      } else {
        const phi = ((i + 0.5) / greens.length) * Math.PI * 2 + 0.4, rho = paper ? 0.82 : tray ? 1.0 : 0.78;
        u = rho * Math.cos(phi); v = rho * Math.sin(phi);
      }
      if (man) { u = man[0]; v = flat ? man[1] - FV : man[1]; }
      return { f, u, v, fixed: !!man };
    });
    const push = (a, b, need, moveA, moveB) => {
      let dx = b.u - a.u, dy = b.v - a.v, d = Math.hypot(dx, dy);
      if (d >= need) return;
      if (d < 1e-4) { dx = 1; dy = 0; d = 1; }
      const amt = need - d, nx = dx / d, ny = dy / d;
      if (moveA && moveB) { a.u -= nx * amt / 2; a.v -= ny * amt / 2; b.u += nx * amt / 2; b.v += ny * amt / 2; }
      else if (moveB) { b.u += nx * amt; b.v += ny * amt; }
      else if (moveA) { a.u -= nx * amt; a.v -= ny * amt; }
    };
    const fixedLeaves = G.filter((g) => g.fixed);
    // 2. manual moves push neighbouring flowers away (never demanding more room than the auto layout had)
    if (P.some((p) => p.fixed) || fixedLeaves.length) {
      const d0 = P.map((a) => P.map((b) => Math.min(0.55 * (rad(a.f) + rad(b.f)), Math.hypot(a.u0 - b.u0, a.v0 - b.v0))));
      for (let it = 0; it < 40; it++) {
        for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
          const a = P[i], b = P[j];
          if (a.fixed && b.fixed) continue;
          push(a, b, d0[i][j], !a.fixed, !b.fixed);
        }
        for (const l of fixedLeaves) for (const m of P) if (!m.fixed) push(l, m, leafNeed(l, m), false, true);
        for (const p of P) if (!p.fixed) {
          if (flat) { p.u = Math.max(-1.3, Math.min(1.3, p.u)); p.v = Math.max(-0.9, Math.min(0.9, p.v)); }
          else { const r = Math.hypot(p.u, p.v); if (r > 0.95) { p.u *= 0.95 / r; p.v *= 0.95 / r; } }
        }
      }
    }
    // 2b. free leaves get out of the way of flowers and of each other
    const free = G.filter((g) => !g.fixed);
    for (let it = 0; it < 40 && free.length; it++) {
      for (const g of free) {
        for (const m of P) push(m, g, leafNeed(g, m), false, true);
        for (const h of G) if (h !== g) push(h, g, 0.5 * (radLeaf(g.f) + radLeaf(h.f)), false, true);
        if (flat) { g.u = Math.max(-1.9, Math.min(1.9, g.u)); g.v = Math.max(-1.4, Math.min(0.9, g.v)); }
        else { const r = Math.hypot(g.u, g.v), lr = 1.2; if (r > lr) { g.u *= lr / r; g.v *= lr / r; } }
      }
    }
    // 3. to 3D
    for (const p of P) {
      const f = p.f, h = mulberry32(f.seed * 7 + 1)(), lift = TYPES[f.type].lift || 0, dy = f.dy || 0;
      if (flat) {
        const y = top - 0.1 + p.v + lift * 0.5 + dy;
        slots.set(f.id, { head: new THREE.Vector3(p.u, y, -(y - top) * 0.3 + (h - 0.5) * 0.05), face: true });
      } else {
        const rho = Math.hypot(p.u, p.v);
        const y = top - drop * Math.pow(rho / 0.85, 2) + lift + (h - 0.5) * 0.1 + dy;
        slots.set(f.id, { head: new THREE.Vector3(p.u, y, p.v) });
      }
    }
    for (const g of G) {
      const dy = g.f.dy || 0;
      if (flat) slots.set(g.f.id, { head: new THREE.Vector3(g.u, top - 0.5 + g.v + FV + dy, -0.2), green: true });
      else slots.set(g.f.id, { head: new THREE.Vector3(g.u, (paper ? 1.7 : tray ? 1.1 : 1.25) + dy, g.v), green: true });
    }
    return slots;
  }

  /* world point on the drag plane -> layout-plane coords for flower f */
  planeCoords(f, p) {
    if (!this.flat) return [p.x, p.z];
    if (TYPES[f.type].greens) return [p.x, p.y - (this.top - 0.5 + (f.dy || 0))];
    const lift = TYPES[f.type].lift || 0;
    return [p.x, p.y - (this.top - 0.1 + lift * 0.5 + (f.dy || 0))];
  }

  stemCurve(slot, f, mode) {
    const rand = mulberry32(f.seed * 13 + 5);
    const head = slot.head;
    let pts;
    if (mode === 'paper' && !PS.tray) {
      const g = new THREE.Vector3((rand() - 0.5) * 0.08, 0.4, (rand() - 0.5) * 0.08);
      const b = new THREE.Vector3((rand() - 0.5) * 0.05, -0.28, (rand() - 0.5) * 0.05);
      const mid = g.clone().lerp(head, 0.5).add(new THREE.Vector3((rand() - 0.5) * 0.08, 0, (rand() - 0.5) * 0.08));
      pts = [b, g, mid, head];
    } else {
      const s = new THREE.Vector3(head.x * 0.45, (mode === 'paper' ? PS.H - 0.12 : BS.H - 0.1), head.z * 0.45);
      const mid = s.clone().lerp(head, 0.5).add(new THREE.Vector3((rand() - 0.5) * 0.06, 0, (rand() - 0.5) * 0.06));
      pts = [s, mid, head];
    }
    return new THREE.CatmullRomCurve3(pts, false, 'centripetal');
  }

  sync(state) {
    PS = PAPER_STYLES[state.paper.style] || PAPER_STYLES.cone;
    BS = BASKET_STYLES[state.basket.style] || BASKET_STYLES.round;
    const mode = state.container, shape = state.shape || 'round', flat = shape === 'flat';
    this.markerHolder.parent?.remove(this.markerHolder);
    // container
    const pp = { ...state.paper, foamColor: state.basket.foamColor };
    const ck = JSON.stringify([mode, flat, mode === 'paper' ? [pp] : [state.basket]]);
    if (ck !== this.containerKey) {
      this.containerKey = ck;
      if (this.containerGroup) { this.root.remove(this.containerGroup); disposeTree(this.containerGroup); }
      this.containerGroup = mode === 'paper' ? buildPaper(pp, flat) : buildBasket(state.basket, flat);
      this.containerGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      this.root.add(this.containerGroup);
    }
    const rk = JSON.stringify([mode, flat, state.ribbon, state.paper.style, state.basket.style]);
    if (rk !== this.ribbonKey) {
      this.ribbonKey = rk;
      if (this.ribbonGroup) { this.root.remove(this.ribbonGroup); disposeTree(this.ribbonGroup); this.ribbonGroup = null; }
      if (state.ribbon.on) {
        this.ribbonGroup = buildRibbon(state.ribbon, mode, flat);
        this.ribbonGroup.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
        this.root.add(this.ribbonGroup);
      }
    }

    // flowers
    const ids = new Set(state.flowers.map((f) => f.id));
    for (const [id, e] of this.entries) {
      if (!ids.has(id)) { this.flowersRoot.remove(e.root); disposeTree(e.root); this.entries.delete(id); }
    }
    const slots = this.layout(state.flowers, mode, shape);
    for (const f of state.flowers) {
      let e = this.entries.get(f.id);
      const headKey = [f.type, f.color, f.color2, f.seed].join('|');
      if (!e) {
        e = { root: new THREE.Group(), head: null, stem: null, leaf: null, headKey: '', stemKey: '' };
        e.root.userData.fid = f.id;
        this.flowersRoot.add(e.root);
        this.entries.set(f.id, e);
      }
      if (e.headKey !== headKey) {
        if (e.head) { e.root.remove(e.head); disposeTree(e.head); }
        const inner = buildFlower(f);
        e.ringInfo = inner.userData;
        e.head = new THREE.Group();
        e.head.add(inner);
        inner.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        e.root.add(e.head);
        e.headKey = headKey;
      }
      const slot = slots.get(f.id);
      const stemKey = [slot.head.toArray().join(','), mode, shape, f.seed, f.type].join('|');
      if (e.stemKey !== stemKey) {
        e.stemKey = stemKey;
        if (e.stem) { e.root.remove(e.stem); e.stem.geometry.dispose(); }
        if (e.leaf) { e.root.remove(e.leaf); disposeTree(e.leaf); e.leaf = null; }
        const curve = this.stemCurve(slot, f, mode);
        const T = TYPES[f.type];
        e.stem = new THREE.Mesh(new THREE.TubeGeometry(curve, 28, T.stemR, 6), this.stemMat);
        e.stem.castShadow = true;
        e.root.add(e.stem);
        e.curve = curve;
        const tan = curve.getTangentAt(1).normalize();
        e.headBase = slot.head.clone();
        e.tan = tan;
        e.face = slot.face ? tan.clone().multiplyScalar(0.45).add(new THREE.Vector3(0, 0.4, 1)).normalize() : tan;
        // optional leaf on the visible part of the stem
        if (!T.noLeaf && !e.ringInfo?.noLeaf) {
          const mouth = mode === 'paper' ? PS.H : BS.H;
          let tm = 0;
          for (let s = 0; s <= 40; s++) { if (curve.getPointAt(s / 40).y >= mouth + 0.02) { tm = s / 40; break; } }
          const tl = tm + (1 - tm) * 0.35;
          if (tl < 0.98) {
            const lf = buildStemLeaf(f.type, f.seed);
            lf.position.copy(curve.getPointAt(tl));
            lf.quaternion.setFromUnitVectors(UP, curve.getTangentAt(tl).normalize());
            lf.rotateY(f.seed * 2.1);
            lf.traverse((o) => { if (o.isMesh) o.castShadow = true; });
            e.root.add(lf); e.leaf = lf;
          }
        }
      }
      e.head.position.copy(e.headBase);
      e.head.quaternion.setFromUnitVectors(UP, e.face);
      e.head.rotateY(f.seed * 6.28);
      const s = (TYPES[f.type].scale || 1) * (f.scale || 1);
      e.head.scale.setScalar(s);
    }

    // selection marker
    const sel = this.entries.get(state.selectedId);
    if (sel && sel.head) {
      const s = sel.ringInfo || {};
      this.markerHolder.position.set(0, s.ringY || 0, 0);
      this.markerHolder.scale.setScalar(s.ringR || 0.3);
      sel.head.add(this.markerHolder);
    }
  }
}
