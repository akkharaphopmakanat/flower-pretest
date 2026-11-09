import * as THREE from 'three';

export function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

export function tint(hex, f) {
  const c = new THREE.Color(hex);
  const h = {};
  c.getHSL(h);
  c.setHSL(h.h, h.s, Math.min(1, Math.max(0, h.l * f)));
  return c;
}

/* ---------- petal / leaf surface ---------- */
export function petalGeometry(o) {
  const {
    length = 1, width = 0.5, bend = 0, cup = 0, round = 0.8,
    segU = 10, segV = 6, grad = [0.8, 1.05], baseW = 0.12, wave = 0,
  } = o;
  const pos = [], col = [], uv = [], idx = [];
  const k = Math.log(0.5) / Math.log(0.6);
  let y = 0, z = 0;
  const du = 1 / segU;
  for (let i = 0; i <= segU; i++) {
    const u = i / segU;
    if (i > 0) {
      const a = bend * (u - du / 2);
      y += Math.cos(a) * du * length;
      z += Math.sin(a) * du * length;
    }
    const s = Math.pow(Math.max(Math.sin(Math.PI * Math.pow(u, k)), 0), round);
    const hw = (width / 2) * (s + baseW * (1 - u) * (1 - u));
    const g = grad[0] + (grad[1] - grad[0]) * u;
    for (let j = 0; j <= segV; j++) {
      const v = (j / segV) * 2 - 1;
      const zz = z - cup * hw * v * v + wave * hw * Math.sin(u * 10) * v * v;
      pos.push(v * hw, y, zz);
      col.push(g, g, g);
      uv.push(j / segV, u);
    }
  }
  for (let i = 0; i < segU; i++) {
    for (let j = 0; j < segV; j++) {
      const a = i * (segV + 1) + j, b = a + 1, c = a + segV + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function petalMat(color, o = {}) {
  const c = new THREE.Color(color);
  return new THREE.MeshPhysicalMaterial({
    color: c, vertexColors: true, side: THREE.DoubleSide, roughness: 0.6,
    sheen: 0.6, sheenRoughness: 0.5, sheenColor: c.clone().lerp(new THREE.Color(1, 1, 1), 0.4),
    ...o,
  });
}

function ringPetals(g, geo, mat, n, { tilt = 0, yaw0 = 0, y = 0, r = 0, rand, tj = 0, sj = 0 }) {
  for (let i = 0; i < n; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = yaw0 + (i / n) * Math.PI * 2 + (rand ? (rand() - 0.5) * 0.12 : 0);
    pivot.position.y = y;
    const m = new THREE.Mesh(geo, mat);
    m.position.z = r;
    m.rotation.x = tilt + (rand ? (rand() - 0.5) * tj : 0);
    if (sj && rand) { const s = 1 + (rand() - 0.5) * sj; m.scale.setScalar(s); }
    pivot.add(m);
    g.add(pivot);
  }
}

const GREEN = '#4f8a3c';

function mesh(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

function leafMat(color) {
  return new THREE.MeshStandardMaterial({ color, vertexColors: true, side: THREE.DoubleSide, roughness: 0.55 });
}

/* ---------- flowers ---------- */
function buildRose({ color, rand }) {
  const g = new THREE.Group();
  const defs = [
    { n: 3, tilt: 0.0, len: 0.20, w: 0.18, bend: -1.1, cup: 1.0, y: 0.0, r: 0.0, shade: 0.78 },
    { n: 4, tilt: 0.08, len: 0.24, w: 0.22, bend: -0.9, cup: 0.9, y: -0.02, r: 0.02, shade: 0.84 },
    { n: 5, tilt: 0.2, len: 0.27, w: 0.27, bend: -0.6, cup: 0.8, y: -0.04, r: 0.05, shade: 0.9 },
    { n: 6, tilt: 0.4, len: 0.30, w: 0.32, bend: -0.3, cup: 0.7, y: -0.06, r: 0.07, shade: 0.96 },
    { n: 7, tilt: 0.65, len: 0.32, w: 0.35, bend: 0.1, cup: 0.6, y: -0.08, r: 0.09, shade: 1.02 },
    { n: 8, tilt: 0.95, len: 0.33, w: 0.37, bend: 0.45, cup: 0.5, y: -0.1, r: 0.1, shade: 1.06 },
  ];
  defs.forEach((d, k) => {
    const geo = petalGeometry({ length: d.len, width: d.w, bend: d.bend, cup: d.cup, round: 0.55, grad: [0.75, 1.08] });
    ringPetals(g, geo, petalMat(tint(color, d.shade)), d.n, { tilt: d.tilt, y: d.y, r: d.r, yaw0: k * 0.9, rand, tj: 0.12 });
  });
  g.add(mesh(new THREE.SphereGeometry(0.05, 12, 8), new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.7 }), 0, -0.1, 0));
  g.userData = { ringY: 0.12, ringR: 0.34 };
  return g;
}

function buildTulip({ color, rand }) {
  const g = new THREE.Group();
  const mk = (yaw0, tilt, len, w, bend, shade) => {
    const geo = petalGeometry({ length: len, width: w, bend, cup: 0.9, round: 0.75, grad: [0.7, 1.1], segU: 12 });
    ringPetals(g, geo, petalMat(tint(color, shade)), 3, { tilt, yaw0, r: 0.03, rand, tj: 0.05 });
  };
  mk(0, 0.14, 0.55, 0.36, -0.4, 0.92);
  mk(Math.PI / 3, 0.02, 0.5, 0.34, -0.55, 1.0);
  g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.7 }), 0, -0.02, 0));
  g.userData = { ringY: 0.26, ringR: 0.24 };
  return g;
}

function buildDaisy({ color, color2, rand }) {
  const g = new THREE.Group();
  const geo = petalGeometry({ length: 0.27, width: 0.075, bend: 0.15, round: 0.5, grad: [0.9, 1.05], segU: 6, segV: 2 });
  const mat = petalMat(color);
  ringPetals(g, geo, mat, 17, { tilt: 1.5, r: 0.05, rand, tj: 0.1 });
  ringPetals(g, geo, mat, 17, { tilt: 1.42, y: -0.012, r: 0.05, yaw0: Math.PI / 17, rand, tj: 0.1 });
  const disc = mesh(new THREE.SphereGeometry(0.075, 24, 12), new THREE.MeshStandardMaterial({ color: color2, roughness: 0.8 }), 0, 0.0, 0);
  disc.scale.y = 0.55;
  g.add(disc);
  g.add(mesh(new THREE.SphereGeometry(0.04, 10, 8), new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.7 }), 0, -0.04, 0));
  g.userData = { ringY: 0.0, ringR: 0.36 };
  return g;
}

function seedTexture(base) {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const b = new THREE.Color(base);
  const dark = '#' + tint(b, 0.6).getHexString();
  const light = '#' + tint(b, 1.5).getHexString();
  x.clearRect(0, 0, 256, 256);
  x.save(); x.beginPath(); x.arc(128, 128, 126, 0, Math.PI * 2); x.clip();
  x.fillStyle = dark; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    const r = Math.sqrt(i / 700) * 118, a = i * 2.39996;
    x.fillStyle = i % 2 ? light : '#' + b.getHexString();
    x.beginPath(); x.arc(128 + Math.cos(a) * r, 128 + Math.sin(a) * r, 3.2, 0, Math.PI * 2); x.fill();
  }
  x.restore();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function buildSunflower({ color, color2, rand }) {
  const g = new THREE.Group();
  const geo = petalGeometry({ length: 0.3, width: 0.11, bend: 0.2, round: 1.1, grad: [0.85, 1.08], segU: 6, segV: 2 });
  ringPetals(g, geo, petalMat(color), 20, { tilt: 1.48, r: 0.16, rand, tj: 0.14 });
  ringPetals(g, geo, petalMat(tint(color, 0.93)), 20, { tilt: 1.36, y: -0.015, r: 0.16, yaw0: Math.PI / 20, rand, tj: 0.14 });
  const green = new THREE.MeshStandardMaterial({ color: '#4d7a33', roughness: 0.7, vertexColors: true, side: THREE.DoubleSide });
  const bgeo = petalGeometry({ length: 0.17, width: 0.08, round: 1.2, segU: 5, segV: 2, grad: [0.8, 1] });
  ringPetals(g, bgeo, green, 14, { tilt: 2.0, y: -0.03, r: 0.12, rand, tj: 0.2 });
  const pg = new THREE.PlaneGeometry(0.4, 0.4, 28, 28);
  const p = pg.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const d = Math.hypot(p.getX(i), p.getY(i)) / 0.19;
    p.setZ(i, d < 1 ? 0.05 * (1 - d * d) : 0);
  }
  pg.computeVertexNormals();
  pg.rotateX(-Math.PI / 2);
  g.add(mesh(pg, new THREE.MeshStandardMaterial({ map: seedTexture(color2), alphaTest: 0.5, roughness: 0.9, side: THREE.DoubleSide }), 0, 0.005, 0));
  const back = mesh(new THREE.CylinderGeometry(0.2, 0.15, 0.05, 28), new THREE.MeshStandardMaterial({ color: '#4d7a33', roughness: 0.8 }), 0, -0.03, 0);
  g.add(back);
  g.userData = { ringY: 0.0, ringR: 0.5 };
  return g;
}

function buildLily({ color, color2, rand }) {
  const g = new THREE.Group();
  const mk = (yaw0, len, w, tilt, shade) => {
    const geo = petalGeometry({ length: len, width: w, bend: 0.9, cup: 0.35, round: 0.8, grad: [0.62, 1.1], segU: 12, wave: 0.15 });
    ringPetals(g, geo, petalMat(tint(color, shade)), 3, { tilt, yaw0, r: 0.02, rand, tj: 0.06 });
  };
  mk(0, 0.52, 0.2, 0.75, 0.97);
  mk(Math.PI / 3, 0.5, 0.25, 0.6, 1.03);
  const fil = new THREE.CylinderGeometry(0.005, 0.005, 0.34, 5);
  fil.translate(0, 0.17, 0);
  const anther = new THREE.CapsuleGeometry(0.014, 0.05, 3, 8);
  const fm = new THREE.MeshStandardMaterial({ color: '#d7e9c0', roughness: 0.7 });
  const am = new THREE.MeshStandardMaterial({ color: color2, roughness: 0.8 });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Group();
    p.rotation.y = (i / 6) * Math.PI * 2 + 0.3;
    const s = new THREE.Group();
    s.rotation.x = 0.22 + (rand() - 0.5) * 0.12;
    s.add(new THREE.Mesh(fil, fm));
    const a = new THREE.Mesh(anther, am);
    a.position.y = 0.35; a.rotation.z = Math.PI / 2 + 0.2;
    s.add(a);
    p.add(s); g.add(p);
  }
  g.add(mesh(new THREE.SphereGeometry(0.035, 10, 8), new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.7 }), 0, -0.02, 0));
  g.userData = { ringY: 0.3, ringR: 0.52 };
  return g;
}

/* ---------- fillers ---------- */
function buildGypsophila({ color, rand }) {
  const g = new THREE.Group();
  const bm = new THREE.MeshStandardMaterial({ color: '#6b8f4e', roughness: 0.8 });
  const branches = 9, per = 7;
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.7 }), branches * per);
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), c = new THREE.Color();
  let n = 0;
  for (let b = 0; b < branches; b++) {
    const az = rand() * Math.PI * 2, el = 0.25 + rand() * 0.75, len = 0.26 + rand() * 0.2;
    const dir = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, len, 4), bm);
    cyl.position.copy(dir).multiplyScalar(len / 2);
    cyl.quaternion.setFromUnitVectors(up, dir);
    g.add(cyl);
    const tip = dir.clone().multiplyScalar(len);
    for (let k = 0; k < per; k++) {
      const p = tip.clone().add(new THREE.Vector3((rand() - 0.5) * 0.09, (rand() - 0.5) * 0.09, (rand() - 0.5) * 0.09));
      const s = 0.6 + rand() * 0.7;
      m4.compose(p, q.identity(), sc.set(s, s, s));
      inst.setMatrixAt(n, m4);
      c.set(color).multiplyScalar(0.9 + rand() * 0.15);
      inst.setColorAt(n, c);
      n++;
    }
  }
  g.add(inst);
  g.userData = { ringY: 0.3, ringR: 0.3 };
  return g;
}

function buildLavender({ color, rand }) {
  const g = new THREE.Group();
  const sm = new THREE.MeshStandardMaterial({ color: '#6f9a58', roughness: 0.8 });
  const whorls = 11, buds = 6;
  const inst = new THREE.InstancedMesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), 3 * whorls * buds);
  const up = new THREE.Vector3(0, 1, 0);
  const m4 = new THREE.Matrix4(), c = new THREE.Color(), sc = new THREE.Vector3(1, 1.6, 1);
  let n = 0;
  for (let s = 0; s < 3; s++) {
    const az = (s / 3) * Math.PI * 2 + rand(), el = 0.08 + rand() * 0.2;
    const dir = new THREE.Vector3(Math.sin(el) * Math.cos(az), Math.cos(el), Math.sin(el) * Math.sin(az));
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(q), fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.005, 0.62, 5), sm);
    cyl.position.copy(dir).multiplyScalar(0.31); cyl.quaternion.copy(q);
    g.add(cyl);
    for (let w = 0; w < whorls; w++) {
      const t = 0.17 + (w / (whorls - 1)) * 0.45;
      const rad = 0.03 * (1 - 0.6 * (w / whorls));
      for (let b = 0; b < buds; b++) {
        const a = (b / buds) * Math.PI * 2 + w * 0.7;
        const p = dir.clone().multiplyScalar(t).addScaledVector(right, Math.cos(a) * rad).addScaledVector(fwd, Math.sin(a) * rad);
        m4.compose(p, q, sc);
        inst.setMatrixAt(n, m4);
        c.set(color).multiplyScalar(0.85 + rand() * 0.3);
        inst.setColorAt(n, c);
        n++;
      }
    }
  }
  g.add(inst);
  g.userData = { ringY: 0.3, ringR: 0.22 };
  return g;
}

/* ---------- leaves / greenery ---------- */
function axisPoint(s, curve) { return new THREE.Vector3(0, s, curve * s * s); }

function buildEucalyptus({ color, rand }) {
  const g = new THREE.Group();
  const sm = new THREE.MeshStandardMaterial({ color: '#7c8f62', roughness: 0.8 });
  const L = 0.85;
  const axis = new THREE.CatmullRomCurve3([0, 0.25, 0.5, 0.75, 1].map((t) => axisPoint(t * L, 0.35)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axis, 12, 0.006, 5), sm));
  const geo = petalGeometry({ length: 0.16, width: 0.16, bend: 0.3, cup: 0.5, round: 0.45, grad: [0.85, 1.05], segU: 6, segV: 4 });
  const mats = [leafMat(color), leafMat(tint(color, 0.88)), leafMat(tint(color, 1.1))];
  const N = 15;
  for (let i = 0; i < N; i++) {
    const t = 0.12 + (i / (N - 1)) * 0.86;
    const p = axis.getPointAt(t), tan = axis.getTangentAt(t);
    const pivot = new THREE.Group();
    pivot.position.copy(p);
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    pivot.rotateY(i * 2.4 + rand() * 0.3);
    const m = new THREE.Mesh(geo, mats[i % 3]);
    m.rotation.x = 0.95 + rand() * 0.2;
    m.scale.setScalar((1.15 - t * 0.5) * (0.9 + rand() * 0.2));
    pivot.add(m); g.add(pivot);
  }
  g.userData = { ringY: 0.4, ringR: 0.25, noLeaf: true };
  return g;
}

function buildRuscus({ color, rand }) {
  const g = new THREE.Group();
  const sm = new THREE.MeshStandardMaterial({ color: '#3f6a35', roughness: 0.8 });
  const L = 0.8;
  const axis = new THREE.CatmullRomCurve3([0, 0.3, 0.6, 1].map((t) => axisPoint(t * L, 0.2)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axis, 10, 0.006, 5), sm));
  const geo = petalGeometry({ length: 0.2, width: 0.1, bend: 0.2, round: 1.0, grad: [0.75, 1.1], segU: 6, segV: 3 });
  const mats = [leafMat(color), leafMat(tint(color, 0.85))];
  const N = 11;
  for (let i = 0; i < N; i++) {
    const t = 0.15 + (i / (N - 1)) * 0.8;
    const p = axis.getPointAt(t), tan = axis.getTangentAt(t);
    const pivot = new THREE.Group();
    pivot.position.copy(p);
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    pivot.rotateY(i * Math.PI + 0.5);
    const m = new THREE.Mesh(geo, mats[i % 2]);
    m.rotation.x = 0.7;
    m.scale.setScalar(1.1 - t * 0.35);
    pivot.add(m); g.add(pivot);
  }
  g.userData = { ringY: 0.4, ringR: 0.22, noLeaf: true };
  return g;
}

function buildFern({ color, rand }) {
  const g = new THREE.Group();
  const sm = new THREE.MeshStandardMaterial({ color: '#4c7a3b', roughness: 0.8 });
  const L = 0.95;
  const axis = new THREE.CatmullRomCurve3([0, 0.3, 0.6, 1].map((t) => axisPoint(t * L, 0.5)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axis, 12, 0.005, 5), sm));
  const geo = petalGeometry({ length: 0.18, width: 0.05, bend: 0.25, round: 0.8, grad: [0.85, 1.05], segU: 4, segV: 2 });
  const mats = [leafMat(color), leafMat(tint(color, 0.9))];
  const N = 20;
  for (let i = 0; i < N; i++) {
    const t = 0.1 + (i / (N - 1)) * 0.88;
    const p = axis.getPointAt(t), tan = axis.getTangentAt(t);
    const size = Math.sin(Math.PI * (0.15 + 0.85 * (1 - t) ** 0.9 * 0.9 + 0.1)) * 0.9 + 0.25;
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.copy(p);
      pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      pivot.rotateY(side > 0 ? Math.PI / 2 : -Math.PI / 2);
      const m = new THREE.Mesh(geo, mats[i % 2]);
      m.rotation.x = 1.15;
      m.scale.set(1, (1.0 - t * 0.7) * size, 1);
      pivot.add(m); g.add(pivot);
    }
  }
  const tip = new THREE.Mesh(geo, mats[0]);
  tip.position.copy(axis.getPointAt(1)); tip.scale.setScalar(0.7);
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.getTangentAt(1));
  g.add(tip);
  g.userData = { ringY: 0.4, ringR: 0.28, noLeaf: true };
  return g;
}

function monsteraAlpha() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#fff'; x.fillRect(0, 0, 256, 256);
  x.fillStyle = '#000';
  // u (canvas x) = across leaf (0..1), v (canvas y) = along length; canvas y flipped by flipY
  for (let k = 0; k < 5; k++) {
    const y = 256 - (60 + k * 32);
    for (const side of [0, 1]) {
      x.beginPath();
      const x0 = 128 + (side ? 22 : -22), x1 = side ? 262 : -6;
      x.moveTo(x0, y - 2); x.lineTo(x1, y - 15); x.lineTo(x1, y + 7); x.lineTo(x0, y + 2);
      x.closePath(); x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  return t;
}

function buildMonstera({ color, rand }) {
  const g = new THREE.Group();
  const sm = new THREE.MeshStandardMaterial({ color: tint(color, 0.8), roughness: 0.8 });
  const pet = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.014, 0.3, 6), sm);
  pet.position.y = 0.15; g.add(pet);
  const geo = petalGeometry({ length: 0.62, width: 0.62, bend: 0.5, cup: -0.25, round: 0.45, grad: [0.8, 1.05], segU: 14, segV: 10, baseW: 0.5 });
  const mat = new THREE.MeshStandardMaterial({ color, vertexColors: true, side: THREE.DoubleSide, roughness: 0.4, alphaMap: monsteraAlpha(), alphaTest: 0.5 });
  const leaf = new THREE.Mesh(geo, mat);
  leaf.position.y = 0.28; leaf.rotation.x = 1.0;
  g.add(leaf);
  g.userData = { ringY: 0.5, ringR: 0.4, noLeaf: true };
  return g;
}

/* ---------- more flowers ---------- */
function buildCarnation({ color, rand }) {
  const g = new THREE.Group();
  const rings = [
    { n: 6, tilt: 0.15, len: 0.16, w: 0.17, y: 0.02, sh: 0.8 }, { n: 8, tilt: 0.4, len: 0.2, w: 0.2, y: 0, sh: 0.88 },
    { n: 9, tilt: 0.7, len: 0.24, w: 0.23, y: -0.02, sh: 0.96 }, { n: 10, tilt: 1.0, len: 0.26, w: 0.25, y: -0.04, sh: 1.04 },
    { n: 11, tilt: 1.3, len: 0.26, w: 0.26, y: -0.05, sh: 1.08 },
  ];
  rings.forEach((d, k) => {
    const geo = petalGeometry({ length: d.len, width: d.w, bend: 0.25, cup: 0.3, round: 0.4, wave: 0.9, grad: [0.8, 1.1], segU: 6, segV: 6 });
    ringPetals(g, geo, petalMat(tint(color, d.sh)), d.n, { tilt: d.tilt, y: d.y, r: 0.02 + k * 0.012, yaw0: k * 0.7, rand, tj: 0.2 });
  });
  g.add(mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.14, 8), new THREE.MeshStandardMaterial({ color: '#5d8f45', roughness: 0.7 }), 0, -0.09, 0));
  g.userData = { ringY: 0.08, ringR: 0.32 };
  return g;
}

function buildPeony({ color, rand }) {
  const g = new THREE.Group();
  const defs = [
    { n: 5, tilt: 0.0, len: 0.18, w: 0.22, bend: -1.0, y: 0.0, r: 0.0, sh: 0.85 }, { n: 6, tilt: 0.1, len: 0.24, w: 0.3, bend: -0.7, y: -0.02, r: 0.02, sh: 0.9 },
    { n: 8, tilt: 0.3, len: 0.28, w: 0.34, bend: -0.4, y: -0.04, r: 0.05, sh: 0.95 }, { n: 10, tilt: 0.55, len: 0.32, w: 0.38, bend: -0.1, y: -0.06, r: 0.08, sh: 1.0 },
    { n: 11, tilt: 0.85, len: 0.35, w: 0.42, bend: 0.2, y: -0.08, r: 0.1, sh: 1.05 }, { n: 12, tilt: 1.15, len: 0.36, w: 0.42, bend: 0.45, y: -0.1, r: 0.12, sh: 1.08 },
  ];
  defs.forEach((d, k) => {
    const geo = petalGeometry({ length: d.len, width: d.w, bend: d.bend, cup: 0.7, round: 0.5, wave: 0.6, grad: [0.78, 1.1], segU: 8, segV: 6 });
    ringPetals(g, geo, petalMat(tint(color, d.sh)), d.n, { tilt: d.tilt, y: d.y, r: d.r, yaw0: k * 0.8, rand, tj: 0.15, sj: 0.12 });
  });
  g.add(mesh(new THREE.SphereGeometry(0.05, 10, 8), new THREE.MeshStandardMaterial({ color: GREEN, roughness: 0.7 }), 0, -0.12, 0));
  g.userData = { ringY: 0.1, ringR: 0.42 };
  return g;
}

function buildHydrangea({ color, rand }) {
  const g = new THREE.Group();
  const N = 110, R = 0.3;
  const geo = new THREE.SphereGeometry(0.055, 8, 6); geo.scale(1, 0.4, 1);
  const inst = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }), N);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), c = new THREE.Color(), up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) / N, ct = 1 - t, st = Math.sqrt(1 - ct * ct), phi = i * 2.39996;
    const p = new THREE.Vector3(R * st * Math.cos(phi), R * ct * 0.85, R * st * Math.sin(phi));
    const n = p.clone().sub(new THREE.Vector3(0, -0.05, 0)).normalize();
    q.setFromUnitVectors(up, n);
    const s = 0.8 + rand() * 0.45;
    m4.compose(p, q, new THREE.Vector3(s, s, s));
    inst.setMatrixAt(i, m4);
    c.set(color); const h = {}; c.getHSL(h); c.setHSL(h.h + (rand() - 0.5) * 0.03, h.s, Math.min(1, h.l * (0.85 + rand() * 0.3)));
    inst.setColorAt(i, c);
  }
  g.add(inst);
  const core = mesh(new THREE.SphereGeometry(R * 0.95, 16, 10), new THREE.MeshStandardMaterial({ color: tint(color, 0.55), roughness: 0.8 }), 0, 0, 0);
  core.scale.y = 0.8;
  g.add(core);
  g.userData = { ringY: 0.12, ringR: 0.42 };
  return g;
}

function buildGerbera({ color, color2, rand }) {
  const g = new THREE.Group();
  const geo = petalGeometry({ length: 0.3, width: 0.075, bend: 0.1, round: 0.6, grad: [0.85, 1.08], segU: 6, segV: 2 });
  const mat = petalMat(color);
  ringPetals(g, geo, mat, 22, { tilt: 1.5, r: 0.07, rand, tj: 0.1 });
  ringPetals(g, geo, petalMat(tint(color, 0.95)), 22, { tilt: 1.38, y: -0.012, r: 0.07, yaw0: Math.PI / 22, rand, tj: 0.1 });
  ringPetals(g, geo, petalMat(tint(color, 0.9)), 22, { tilt: 1.26, y: -0.024, r: 0.07, yaw0: Math.PI / 44, rand, tj: 0.1 });
  const inner = petalGeometry({ length: 0.1, width: 0.035, round: 0.7, segU: 4, segV: 2, grad: [1, 1] });
  ringPetals(g, inner, petalMat(tint(color2, 1.5)), 18, { tilt: 1.0, y: 0.005, r: 0.04, rand, tj: 0.2 });
  const disc = mesh(new THREE.SphereGeometry(0.075, 20, 10), new THREE.MeshStandardMaterial({ color: color2, roughness: 0.8 }), 0, 0.005, 0);
  disc.scale.y = 0.5; g.add(disc);
  g.userData = { ringY: 0.0, ringR: 0.4 };
  return g;
}

function buildCosmos({ color, color2, rand }) {
  const g = new THREE.Group();
  const geo = petalGeometry({ length: 0.24, width: 0.17, bend: 0.1, cup: 0.2, round: 0.45, wave: 0.4, grad: [0.8, 1.08], segU: 8, segV: 4 });
  ringPetals(g, geo, petalMat(color), 8, { tilt: 1.4, r: 0.04, rand, tj: 0.1 });
  ringPetals(g, geo, petalMat(tint(color, 0.93)), 8, { tilt: 1.3, y: -0.01, r: 0.04, yaw0: Math.PI / 8, rand, tj: 0.1 });
  const disc = mesh(new THREE.SphereGeometry(0.045, 14, 8), new THREE.MeshStandardMaterial({ color: color2, roughness: 0.8 }), 0, 0.005, 0);
  disc.scale.y = 0.6; g.add(disc);
  g.userData = { ringY: 0.0, ringR: 0.32 };
  return g;
}

/* ---------- more leaves ---------- */
function frond({ color, rand, L, curve, N, leafLen, leafW, tilt, sizeMin = 0.3, stem = '#4c7a3b', tipScale = 0.7 }) {
  const g = new THREE.Group();
  const axis = new THREE.CatmullRomCurve3([0, 0.3, 0.6, 1].map((t) => axisPoint(t * L, curve)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axis, 12, 0.006, 5), new THREE.MeshStandardMaterial({ color: stem, roughness: 0.8 })));
  const geo = petalGeometry({ length: leafLen, width: leafW, bend: 0.25, round: 0.8, grad: [0.85, 1.05], segU: 4, segV: 2 });
  const mats = [leafMat(color), leafMat(tint(color, 0.9))];
  for (let i = 0; i < N; i++) {
    const t = 0.08 + (i / (N - 1)) * 0.9;
    const p = axis.getPointAt(t), tan = axis.getTangentAt(t);
    const size = sizeMin + (1 - sizeMin) * Math.sin(Math.PI * Math.min(1, t * 0.9 + 0.1));
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.copy(p);
      pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
      pivot.rotateY(side * Math.PI / 2);
      const m = new THREE.Mesh(geo, mats[i % 2]);
      m.rotation.x = tilt; m.scale.set(1, size * (1 - t * 0.5), 1);
      pivot.add(m); g.add(pivot);
    }
  }
  const tip = new THREE.Mesh(geo, mats[0]);
  tip.position.copy(axis.getPointAt(1)); tip.scale.setScalar(tipScale);
  tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.getTangentAt(1));
  g.add(tip);
  g.userData = { ringY: 0.45, ringR: 0.3, noLeaf: true };
  return g;
}
const buildPalm = (o) => frond({ ...o, L: 1.0, curve: 0.35, N: 16, leafLen: 0.38, leafW: 0.05, tilt: 1.0, sizeMin: 0.5 });

function buildIvy({ color, rand }) {
  const g = new THREE.Group();
  const L = 0.85;
  const axis = new THREE.CatmullRomCurve3([0, 0.3, 0.6, 1].map((t) => new THREE.Vector3(0, L * (t - 0.3 * t * t), L * 0.55 * t * t)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axis, 14, 0.005, 5), new THREE.MeshStandardMaterial({ color: '#5a6b3a', roughness: 0.8 })));
  const geo = petalGeometry({ length: 0.2, width: 0.2, bend: 0.4, cup: 0.3, round: 0.45, grad: [0.8, 1.05], segU: 6, segV: 4 });
  const mats = [leafMat(color), leafMat(tint(color, 0.85)), leafMat(tint(color, 1.12))];
  const N = 13;
  for (let i = 0; i < N; i++) {
    const t = 0.1 + (i / (N - 1)) * 0.88;
    const p = axis.getPointAt(t), tan = axis.getTangentAt(t);
    const pivot = new THREE.Group();
    pivot.position.copy(p);
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tan);
    pivot.rotateY(i * Math.PI + rand() * 0.4);
    const m = new THREE.Mesh(geo, mats[i % 3]);
    m.rotation.x = 1.1; m.scale.setScalar((1.1 - t * 0.45) * (0.85 + rand() * 0.3));
    pivot.add(m); g.add(pivot);
  }
  g.userData = { ringY: 0.4, ringR: 0.3, noLeaf: true };
  return g;
}

function buildSalal({ color, rand }) {
  const g = new THREE.Group();
  const L = 0.6;
  const axis = new THREE.CatmullRomCurve3([0, 0.35, 0.7, 1].map((t) => axisPoint(t * L, 0.4)));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(axis, 10, 0.007, 5), new THREE.MeshStandardMaterial({ color: '#4a5b30', roughness: 0.8 })));
  const geo = petalGeometry({ length: 0.34, width: 0.3, bend: 0.4, cup: 0.35, round: 0.5, grad: [0.75, 1.1], segU: 8, segV: 6 });
  const mat = new THREE.MeshStandardMaterial({ color, vertexColors: true, side: THREE.DoubleSide, roughness: 0.3 });
  const N = 6;
  for (let i = 0; i < N; i++) {
    const t = 0.2 + (i / (N - 1)) * 0.78;
    const pivot = new THREE.Group();
    pivot.position.copy(axis.getPointAt(t));
    pivot.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), axis.getTangentAt(t));
    pivot.rotateY(i * Math.PI + 0.4);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = 0.95; m.scale.setScalar(1.05 - t * 0.35);
    pivot.add(m); g.add(pivot);
  }
  g.userData = { ringY: 0.35, ringR: 0.3, noLeaf: true };
  return g;
}

function buildGrass({ color, rand }) {
  const g = new THREE.Group();
  const mats = [leafMat(color), leafMat(tint(color, 0.88)), leafMat(tint(color, 1.12))];
  for (let i = 0; i < 10; i++) {
    const len = 0.7 + rand() * 0.35;
    const geo = petalGeometry({ length: len, width: 0.045, bend: 0.4 + rand() * 0.7, round: 1.1, grad: [0.85, 1.1], segU: 12, segV: 1 });
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 10) * Math.PI * 2 + rand();
    const m = new THREE.Mesh(geo, mats[i % 3]);
    m.rotation.x = 0.06 + rand() * 0.3;
    pivot.add(m); g.add(pivot);
  }
  g.userData = { ringY: 0.4, ringR: 0.25, noLeaf: true };
  return g;
}

/* ---------- registry ---------- */
export const TYPES = {
  rose: { name: 'กุหลาบ', group: 'flower', build: buildRose, color: '#d62839', scale: 1, stemR: 0.016, lift: 0 },
  tulip: { name: 'ทิวลิป', group: 'flower', build: buildTulip, color: '#f4a3c0', scale: 1, stemR: 0.014, lift: 0.05, leafSize: 'long' },
  daisy: { name: 'เดซี่', group: 'flower', build: buildDaisy, color: '#ffffff', color2: '#f6c90e', color2Name: 'กลางดอก', scale: 1, stemR: 0.01, lift: -0.05 },
  sunflower: { name: 'ทานตะวัน', group: 'flower', build: buildSunflower, color: '#f9b800', color2: '#4a2c12', color2Name: 'กลางดอก', scale: 1.15, stemR: 0.02, lift: 0 },
  carnation: { name: 'คาร์เนชั่น', group: 'flower', build: buildCarnation, color: '#f08aa3', scale: 1, stemR: 0.01, lift: 0 },
  peony: { name: 'พีโอนี', group: 'flower', build: buildPeony, color: '#f6a5b8', scale: 1.1, stemR: 0.016, lift: 0 },
  hydrangea: { name: 'ไฮเดรนเยีย', group: 'flower', build: buildHydrangea, color: '#7aa7e8', scale: 1.15, stemR: 0.018, lift: -0.05 },
  gerbera: { name: 'เจอเบอร่า', group: 'flower', build: buildGerbera, color: '#ff6f3c', color2: '#3b2a1a', color2Name: 'กลางดอก', scale: 1, stemR: 0.01, lift: -0.03 },
  cosmos: { name: 'คอสมอส', group: 'flower', build: buildCosmos, color: '#f08aa3', color2: '#f6c90e', color2Name: 'กลางดอก', scale: 1, stemR: 0.008, lift: -0.03 },
  lily: { name: 'ลิลลี่', group: 'flower', build: buildLily, color: '#fff1f4', color2: '#b45a1f', color2Name: 'เกสร', scale: 1, stemR: 0.016, lift: 0.1 },
  gypsophila: { name: 'ยิปโซ', group: 'filler', build: buildGypsophila, color: '#ffffff', scale: 1, stemR: 0.007, lift: -0.05, noLeaf: true },
  lavender: { name: 'ลาเวนเดอร์', group: 'filler', build: buildLavender, color: '#8e6bd1', scale: 1, stemR: 0.008, lift: 0.05, noLeaf: true },
  eucalyptus: { name: 'ยูคาลิปตัส', group: 'leaf', greens: true, build: buildEucalyptus, color: '#8fb39a', scale: 1, stemR: 0.008 },
  fern: { name: 'เฟิร์น', group: 'leaf', greens: true, build: buildFern, color: '#5c9a45', scale: 1, stemR: 0.007 },
  ruscus: { name: 'รัสคัส', group: 'leaf', greens: true, build: buildRuscus, color: '#3f7a3a', scale: 1, stemR: 0.008 },
  palm: { name: 'ใบปาล์ม', group: 'leaf', greens: true, build: buildPalm, color: '#3f8a3a', scale: 1, stemR: 0.008 },
  ivy: { name: 'ไอวี่', group: 'leaf', greens: true, build: buildIvy, color: '#4a7a3a', scale: 1, stemR: 0.006 },
  salal: { name: 'ใบเลเธอร์', group: 'leaf', greens: true, build: buildSalal, color: '#2f6a35', scale: 1, stemR: 0.008 },
  grass: { name: 'ใบหญ้า', group: 'leaf', greens: true, build: buildGrass, color: '#7fb04e', scale: 1, stemR: 0.006 },
  monstera: { name: 'มอนสเตอร่า', group: 'leaf', greens: true, build: buildMonstera, color: '#2f7d3a', scale: 1, stemR: 0.012 },
};

export function buildFlower(f) {
  const t = TYPES[f.type];
  const g = t.build({ color: f.color, color2: f.color2 || t.color2, rand: mulberry32(f.seed || 1) });
  g.userData.type = f.type;
  return g;
}

export function buildStemLeaf(type, seed) {
  const rand = mulberry32((seed || 1) + 77);
  const long = TYPES[type].leafSize === 'long';
  const geo = petalGeometry({ length: long ? 0.7 : 0.38, width: long ? 0.17 : 0.15, bend: long ? 0.7 : 0.45, cup: 0.6, round: 0.8, grad: [0.7, 1.1], segU: 10 });
  const m = new THREE.Mesh(geo, leafMat('#4f8a3c'));
  m.rotation.x = 0.55 + rand() * 0.2;
  const g = new THREE.Group();
  g.add(m);
  return g;
}

export function disposeTree(o) {
  const seenG = new Set(), seenM = new Set();
  o.traverse((c) => {
    if (c.geometry && !seenG.has(c.geometry)) { seenG.add(c.geometry); c.geometry.dispose(); }
    if (c.material) {
      for (const m of [].concat(c.material)) {
        if (seenM.has(m)) continue;
        seenM.add(m);
        ['map', 'alphaMap', 'bumpMap'].forEach((k) => m[k] && m[k].dispose());
        m.dispose();
      }
    }
    if (c.isInstancedMesh) c.dispose();
  });
}

/* thumbnails: render each type once to a data URL */
export function makeThumbnails(size = 112) {
  const out = {};
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size); r.setPixelRatio(1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x998877, 2.2));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 4, 3); scene.add(d);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  for (const [key, t] of Object.entries(TYPES)) {
    const g = buildFlower({ type: key, color: t.color, color2: t.color2, seed: 3 });
    if (t.group === 'flower') g.rotation.x = 0; // faces +Y
    scene.add(g);
    const box = new THREE.Box3().setFromObject(g);
    const ctr = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    const R = Math.max(sz.x, sz.y, sz.z) * 0.62;
    const dist = R / Math.tan(THREE.MathUtils.degToRad(15));
    const dir = t.group === 'flower' || key === 'gypsophila' ? new THREE.Vector3(0.35, 0.95, 0.8) : new THREE.Vector3(0.3, 0.2, 1);
    cam.position.copy(ctr).addScaledVector(dir.normalize(), dist);
    cam.lookAt(ctr);
    r.setClearColor(0x000000, 0);
    r.render(scene, cam);
    out[key] = r.domElement.toDataURL('image/png');
    scene.remove(g); disposeTree(g);
  }
  r.dispose();
  return out;
}
