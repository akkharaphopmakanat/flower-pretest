import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { TYPES, makeThumbnails } from './flowers.js';
import { Bouquet } from './bouquet.js';

const $ = (s) => document.querySelector(s);
const SWATCHES = ['#d62839', '#f08aa3', '#ff6f91', '#f9a78a', '#f9b800', '#fff1f4', '#ffffff', '#8e6bd1', '#6a8fd8', '#2f7d3a', '#8fb39a', '#222222'];
const GREENS = ['#2f7d3a', '#3f7a3a', '#5c9a45', '#8fb39a', '#a5b98a', '#6b8f4e'];
const KEY = 'flowerpre.v2';

let uid = 1;
const newFlower = (type, o = {}) => ({
  id: 'f' + Date.now().toString(36) + (uid++), type, color: TYPES[type].color, color2: TYPES[type].color2 || null,
  scale: 1, seed: Math.floor(Math.random() * 9999) + 1, ...o,
});

const defaults = () => ({
  container: 'paper',
  shape: 'round',
  flowers: [],
  selectedId: null,
  paper: { style: 'cone', outer: '#f4b6c2', inner: '#ffffff', pattern: 'plain', back: true, backColor: '#fff3e0' },
  basket: { style: 'round', basketColor: '#b98a55', foamColor: '#8bb56a', handle: true },
  ribbon: { on: true, color: '#c9184a' },
});

let state = defaults();
try {
  const saved = JSON.parse(localStorage.getItem(KEY));
  if (saved && Array.isArray(saved.flowers)) state = { ...defaults(), ...saved, paper: { ...defaults().paper, ...saved.paper }, basket: { ...defaults().basket, ...saved.basket }, ribbon: { ...defaults().ribbon, ...saved.ribbon } };
} catch (e) { /* ignore */ }

/* ---------- three scene ---------- */
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.7;

const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.position.set(3, 6, 4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: 0.5, far: 20 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0xffffff, 0xf3d3da, 0.6));

const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.ShadowMaterial({ opacity: 0.18 }));
floor.rotation.x = -Math.PI / 2; floor.position.y = -0.3; floor.receiveShadow = true;
scene.add(floor);

const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.minDistance = 2; controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.62;
controls.autoRotateSpeed = 1.2;

function resetCamera() {
  const basket = state.container === 'basket';
  controls.target.set(0, basket ? 1.35 : 1.45, 0);
  camera.position.set(0, basket ? 3.0 : 2.6, basket ? 6.6 : 6.8);
  controls.update();
}

const bouquet = new Bouquet(scene);

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
}
addEventListener('resize', resize);

/* ---------- state helpers ---------- */
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* ignore */ } }
const sel = () => state.flowers.find((f) => f.id === state.selectedId);

function commit(rebuildUI = true) {
  bouquet.sync(state);
  save();
  if (rebuildUI) renderUI(); else renderEditor();
}

/* ---------- UI ---------- */
let thumbs = {};

function renderPalette() {
  const el = $('#palette'); el.innerHTML = '';
  const groups = [['flower', 'ดอกไม้'], ['filler', 'ดอกไม้เสริม'], ['leaf', 'ใบไม้']];
  for (const [g, title] of groups) {
    const h = document.createElement('div'); h.className = 'group-title'; h.textContent = title; el.appendChild(h);
    const grid = document.createElement('div'); grid.className = 'pal';
    for (const [key, t] of Object.entries(TYPES)) {
      if (t.group !== g) continue;
      const b = document.createElement('button');
      b.innerHTML = `<img src="${thumbs[key] || ''}" alt=""><span>${t.name}</span>`;
      b.onclick = () => addFlower(key);
      grid.appendChild(b);
    }
    el.appendChild(grid);
  }
}

function addFlower(type) {
  const f = newFlower(type);
  state.flowers.push(f);
  state.selectedId = f.id;
  commit();
}

function renderList() {
  const el = $('#list'); el.innerHTML = '';
  $('#count').textContent = state.flowers.length;
  if (!state.flowers.length) { el.innerHTML = '<div class="empty">ยังไม่มีดอกไม้ — กดเลือกจากด้านบนได้เลย</div>'; return; }
  state.flowers.forEach((f) => {
    const d = document.createElement('div'); d.className = 'item' + (f.id === state.selectedId ? ' sel' : '');
    d.innerHTML = `<img src="${thumbs[f.type] || ''}"><span class="nm">${TYPES[f.type].name}</span><span class="dot" style="background:${f.color}"></span><button class="x">✕</button>`;
    d.onclick = () => { state.selectedId = f.id; commit(); };
    d.querySelector('.x').onclick = (e) => { e.stopPropagation(); removeFlower(f.id); };
    el.appendChild(d);
  });
}

function removeFlower(id) {
  state.flowers = state.flowers.filter((f) => f.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  commit();
}

function renderEditor() {
  const f = sel();
  $('#editor').hidden = !f;
  if (!f) return;
  const t = TYPES[f.type];
  $('#edName').textContent = t.name;
  $('#colorLabel').textContent = t.group === 'leaf' ? 'สีใบ' : 'สี';
  $('#edColor').value = f.color;
  $('#edScale').value = f.scale;
  $('#edDy').value = f.dy || 0;
  $('#manualRow').hidden = !!TYPES[f.type].greens;
  $('#color2Row').hidden = !t.color2;
  if (t.color2) { $('#color2Label').textContent = 'สี' + t.color2Name; $('#edColor2').value = f.color2 || t.color2; }
  const sw = $('#edSwatches'); sw.innerHTML = '';
  (t.group === 'leaf' ? GREENS : SWATCHES).forEach((c) => {
    const i = document.createElement('i'); i.style.background = c; i.onclick = () => { f.color = c; commit(); };
    sw.appendChild(i);
  });
}

function renderSummary() {
  const m = new Map();
  state.flowers.forEach((f) => { const k = TYPES[f.type].name + ' ' + f.color; m.set(k, (m.get(k) || 0) + 1); });
  const lines = [...m].map(([k, n]) => `${k} × ${n}`);
  const cont = state.container === 'paper' ? `ห่อกระดาษ ${state.paper.outer}/${state.paper.inner}${state.paper.back ? ' + แผ่นหลัง' : ''}` : `ตะกร้า ${state.basket.basketColor} + โฟม`;
  $('#summary').textContent = (lines.length ? lines.join('\n') : '(ยังไม่มีดอกไม้)') + '\n—\n' + cont + (state.ribbon.on ? `\nริบบิ้น ${state.ribbon.color}` : '');
}

function syncControls() {
  document.querySelectorAll('#containerSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.container));
  document.querySelectorAll('#shapeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.v === state.shape));
  $('#paperSec').hidden = state.container !== 'paper';
  $('#basketSec').hidden = state.container !== 'basket';
  $('#pStyle').value = state.paper.style; $('#bStyle').value = state.basket.style;
  $('#pOuter').value = state.paper.outer; $('#pInner').value = state.paper.inner; $('#pPattern').value = state.paper.pattern;
  $('#pBack').checked = state.paper.back; $('#pBackColor').value = state.paper.backColor; $('#pBackRow').hidden = !state.paper.back;
  $('#bColor').value = state.basket.basketColor; $('#bFoam').value = state.basket.foamColor; $('#bHandle').checked = state.basket.handle;
  $('#rOn').checked = state.ribbon.on; $('#rColor').value = state.ribbon.color;
}

function renderUI() { renderList(); renderEditor(); renderSummary(); syncControls(); }

/* ---------- wiring ---------- */
document.querySelectorAll('#containerSeg button').forEach((b) => {
  b.onclick = () => { state.container = b.dataset.v; resetCamera(); commit(); };
});
document.querySelectorAll('#shapeSeg button').forEach((b) => { b.onclick = () => { state.shape = b.dataset.v; commit(); }; });
const bindInput = (sel_, apply) => $(sel_).addEventListener('input', (e) => { apply(e.target.type === 'checkbox' ? e.target.checked : e.target.value); commit(false); renderSummary(); syncControls(); });
bindInput('#pStyle', (v) => (state.paper.style = v));
bindInput('#bStyle', (v) => (state.basket.style = v));
bindInput('#pOuter', (v) => (state.paper.outer = v));
bindInput('#pInner', (v) => (state.paper.inner = v));
bindInput('#pPattern', (v) => (state.paper.pattern = v));
bindInput('#pBack', (v) => (state.paper.back = v));
bindInput('#pBackColor', (v) => (state.paper.backColor = v));
bindInput('#bColor', (v) => (state.basket.basketColor = v));
bindInput('#bFoam', (v) => (state.basket.foamColor = v));
bindInput('#bHandle', (v) => (state.basket.handle = v));
bindInput('#rOn', (v) => (state.ribbon.on = v));
bindInput('#rColor', (v) => (state.ribbon.color = v));

$('#edColor').addEventListener('input', (e) => { const f = sel(); if (f) { f.color = e.target.value; bouquet.sync(state); save(); renderList(); renderSummary(); } });
$('#edColor2').addEventListener('input', (e) => { const f = sel(); if (f) { f.color2 = e.target.value; bouquet.sync(state); save(); } });
$('#edScale').addEventListener('input', (e) => { const f = sel(); if (f) { f.scale = +e.target.value; bouquet.sync(state); save(); } });
$('#edDel').onclick = () => state.selectedId && removeFlower(state.selectedId);
$('#edDup').onclick = () => { const f = sel(); if (!f) return; const c = newFlower(f.type, { color: f.color, color2: f.color2, scale: f.scale }); state.flowers.push(c); state.selectedId = c.id; commit(); };
const move = (d) => { const i = state.flowers.findIndex((f) => f.id === state.selectedId); const j = i + d; if (i < 0 || j < 0 || j >= state.flowers.length) return; [state.flowers[i], state.flowers[j]] = [state.flowers[j], state.flowers[i]]; commit(); };
$('#edPrev').onclick = () => move(-1);
$('#edNext').onclick = () => move(1);
$('#shuffle').onclick = () => { for (let i = state.flowers.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [state.flowers[i], state.flowers[j]] = [state.flowers[j], state.flowers[i]]; } commit(); };
$('#clear').onclick = () => { state.flowers = []; state.selectedId = null; commit(); };
$('#copySummary').onclick = () => navigator.clipboard?.writeText($('#summary').textContent);
$('#autoRot').onclick = () => { controls.autoRotate = !controls.autoRotate; $('#autoRot').classList.toggle('on', controls.autoRotate); };
$('#resetCam').onclick = resetCamera;
$('#shot').onclick = () => {
  renderer.render(scene, camera);
  canvas.toBlob((b) => { const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'bouquet.png'; a.click(); });
};

/* presets */
const PRESETS = {
  'กุหลาบแดงหวาน': { container: 'paper', paper: { outer: '#f4b6c2', inner: '#ffffff', pattern: 'plain', back: true, backColor: '#fff3e0' }, list: [['rose', '#d62839'], ['rose', '#d62839'], ['rose', '#e84a5f'], ['rose', '#d62839'], ['rose', '#f08aa3'], ['rose', '#d62839'], ['gypsophila', '#ffffff'], ['gypsophila', '#ffffff'], ['eucalyptus'], ['eucalyptus'], ['eucalyptus']] },
  'พาสเทลสดใส': { container: 'paper', paper: { outer: '#cfe6f5', inner: '#fff7ee', pattern: 'dots', back: true, backColor: '#ffffff' }, list: [['tulip', '#f4a3c0'], ['tulip', '#f9d6a5'], ['rose', '#f9a78a'], ['daisy', '#ffffff'], ['daisy', '#ffffff'], ['lily', '#fff1f4'], ['lavender', '#8e6bd1'], ['gypsophila'], ['fern'], ['ruscus']] },
  'ช่อแบนทิวลิป': { container: 'paper', shape: 'flat', paper: { outer: '#e9d8c4', inner: '#ffffff', pattern: 'plain', back: false, backColor: '#ffffff' }, list: [['tulip', '#f4a3c0'], ['tulip', '#fff1f4'], ['tulip', '#f9a78a'], ['tulip', '#f4a3c0'], ['tulip', '#fff1f4'], ['tulip', '#f9a78a'], ['daisy', '#ffffff'], ['gypsophila'], ['eucalyptus'], ['eucalyptus'], ['ruscus']] },
  'ตะกร้าทุ่งทานตะวัน': { container: 'basket', list: [['sunflower'], ['sunflower'], ['sunflower'], ['daisy', '#ffffff'], ['daisy', '#ffffff'], ['lavender', '#8e6bd1'], ['lavender', '#8e6bd1'], ['monstera'], ['fern'], ['eucalyptus']] },
};
for (const name of Object.keys(PRESETS)) {
  const b = document.createElement('button'); b.textContent = name;
  b.onclick = () => {
    const p = PRESETS[name];
    state.container = p.container;
    state.shape = p.shape || 'round';
    if (p.paper) state.paper = { ...defaults().paper, ...p.paper };
    state.flowers = p.list.map(([t, c]) => newFlower(t, c ? { color: c } : {}));
    state.selectedId = null;
    resetCamera(); commit();
  };
  $('#presets').appendChild(b);
}

/* picking + manual drag */
let down = null, drag = null;
const rc = new THREE.Raycaster();
const ndcOf = (e) => { const r = canvas.getBoundingClientRect(); return new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
function pickFlower(e) {
  rc.setFromCamera(ndcOf(e), camera);
  for (const h of rc.intersectObjects(bouquet.rootsForPicking, true)) {
    let o = h.object;
    while (o && !o.userData.fid) o = o.parent;
    if (o) return o.userData.fid;
  }
  return null;
}
canvas.addEventListener('pointerdown', (e) => {
  down = { x: e.clientX, y: e.clientY, t: performance.now(), id: pickFlower(e) };
  const f = state.flowers.find((q) => q.id === down.id);
  // only flowers that are not greenery can be moved by hand
  if (f && !TYPES[f.type].greens) {
    drag = { f, active: false };
    controls.enabled = false;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag || !down) return;
  if (!drag.active) { if (Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) return; drag.active = true; state.selectedId = drag.f.id; }
  const en = bouquet.entries.get(drag.f.id);
  if (!en) return;
  const hb = en.headBase;
  const plane = bouquet.flat ? new THREE.Plane(new THREE.Vector3(0, 0, 1), -hb.z) : new THREE.Plane(new THREE.Vector3(0, 1, 0), -hb.y);
  rc.setFromCamera(ndcOf(e), camera);
  const pt = new THREE.Vector3();
  if (!rc.ray.intersectPlane(plane, pt)) return;
  let [u, v] = bouquet.planeCoords(drag.f, pt);
  if (bouquet.flat) { u = Math.max(-1.4, Math.min(1.4, u)); v = Math.max(-1.0, Math.min(1.0, v)); }
  else { const r = Math.hypot(u, v); if (r > 1.0) { u /= r; v /= r; } }
  drag.f.man = { ...(drag.f.man || {}), [bouquet.flat ? 'flat' : 'round']: [u, v] };
  bouquet.sync(state);
});
addEventListener('pointerup', (e) => {
  const wasDrag = drag && drag.active;
  drag = null; controls.enabled = true;
  if (wasDrag) { commit(); return; }
  if (!down || e.target !== canvas) { down = null; return; }
  const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5 || performance.now() - down.t > 500;
  const id = down.id; down = null;
  if (moved) return;
  if (id) { state.selectedId = id; commit(); }
  else if (state.selectedId) { state.selectedId = null; commit(); }
});

/* manual-position controls */
$('#edDy').addEventListener('input', (e) => { const f = sel(); if (f) { f.dy = +e.target.value; bouquet.sync(state); save(); } });
$('#edAuto').onclick = () => { const f = sel(); if (f) { delete f.man; f.dy = 0; commit(); } };
$('#allAuto').onclick = () => { state.flowers.forEach((f) => { delete f.man; f.dy = 0; }); commit(); };

/* random idea */
const PALETTES = [
  { f: ['#d62839', '#f08aa3', '#fff1f4'], paper: ['#f4b6c2', '#ffffff'], back: '#fff3e0', rib: '#c9184a' },
  { f: ['#f4a3c0', '#fff1f4', '#f9d6a5'], paper: ['#cfe6f5', '#fff7ee'], back: '#ffffff', rib: '#ffffff' },
  { f: ['#f9b800', '#f9a78a', '#ffffff'], paper: ['#e9d8c4', '#fff3d6'], back: '#fff8e8', rib: '#2f7d3a' },
  { f: ['#8e6bd1', '#f08aa3', '#ffffff'], paper: ['#d9c8f0', '#ffffff'], back: '#f5eefc', rib: '#6a4bb0' },
  { f: ['#ff6f91', '#d62839', '#f9a78a'], paper: ['#222222', '#f4b6c2'], back: '#3a2a30', rib: '#ff6f91' },
  { f: ['#ffffff', '#f6c90e', '#8fb39a'], paper: ['#c8e0c4', '#ffffff'], back: '#f3f8ef', rib: '#f6c90e' },
];
const pick = (a) => a[Math.floor(Math.random() * a.length)];
function randomIdea() {
  const pal = pick(PALETTES);
  state.container = Math.random() < 0.75 ? 'paper' : 'basket';
  state.shape = Math.random() < 0.5 ? 'round' : 'flat';
  state.paper = { style: pick(['cone', 'cone', 'wide', 'tube', 'frill']), outer: pal.paper[0], inner: pal.paper[1], pattern: pick(['plain', 'plain', 'dots', 'stripes', 'hearts', 'check']), back: state.shape === 'round' && Math.random() < 0.7, backColor: pal.back };
  state.basket = { style: pick(['round', 'tall', 'bowl', 'square']), basketColor: pick(['#b98a55', '#c9a06a', '#8d6a42', '#e4cfa3']), foamColor: pick(['#8bb56a', '#8bb56a', '#d9b8c4']), handle: Math.random() < 0.6 };
  state.ribbon = { on: Math.random() < 0.85, color: pal.rib };
  const mainTypes = [...new Set([pick(['rose', 'rose', 'tulip', 'lily']), pick(['rose', 'tulip', 'daisy', 'sunflower', 'lily']), Math.random() < 0.3 ? 'sunflower' : 'rose'])];
  const total = 8 + Math.floor(Math.random() * 8);
  const list = [];
  const nMain = Math.round(total * 0.6), nFill = Math.round(total * 0.2), nLeaf = total - nMain - nFill;
  for (let i = 0; i < nMain; i++) {
    const t = pick(mainTypes);
    list.push(newFlower(t, t === 'sunflower' ? {} : t === 'daisy' ? { color: '#ffffff' } : { color: pick(pal.f) }));
  }
  const fills = [pick(['gypsophila', 'lavender']), pick(['gypsophila', 'gypsophila', 'lavender'])];
  for (let i = 0; i < nFill; i++) list.push(newFlower(pick(fills)));
  const leaves = ['eucalyptus', 'fern', 'ruscus', 'monstera'].sort(() => Math.random() - 0.5).slice(0, 2);
  for (let i = 0; i < Math.max(2, nLeaf); i++) list.push(newFlower(pick(leaves)));
  list.sort(() => Math.random() - 0.5);
  state.flowers = list;
  state.selectedId = null;
  resetCamera(); commit();
}
$('#random').onclick = randomIdea;
$('#random2').onclick = randomIdea;

/* ---------- boot ---------- */
resize();
thumbs = makeThumbnails();
renderPalette();
resetCamera();
bouquet.sync(state);
renderUI();
if (!state.flowers.length) document.querySelector('#presets button').click();

renderer.setAnimationLoop(() => { controls.update(); renderer.render(scene, camera); });
window.__app = { state: () => state, THREE, camera, controls, bouquet, resetCamera };
