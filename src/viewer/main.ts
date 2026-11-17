import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import './viewer.css';
import { tr, num, langSwitch } from '../i18n';
import { PAL } from '../render/palette';
import { loadModels, Models } from '../render/assets';
import { loadCraftModels } from '../craft/render/craftModels';
import { loadStationModels } from '../game/render/station/models';
import { proceduralEntries, GROUPS, Entry, Exhibit, Param, Ctx } from './catalog';
import { glbEntries, rawCopy, GlbEntry } from './glb';
import { parseHash, formatHash, matches, frameDistance, Clock, Params } from './state';

/**
 * The model viewer (/viewer/): every model of the game and the demos up close, orbit and
 * zoom, play the animations slowly or frame by frame, change what drives them. A link
 * (#id&param=value) opens the same model in the same state, for bug reports.
 */

const FOV = 40;
const DEFAULT_DIR = new THREE.Vector3(1, 0.55, 1.25).normalize();
type Light = 'studio' | 'ash' | 'night';
const LIGHTS: Record<Light, { bg: number; hemi: number; sun: number; fog: boolean }> = {
  studio: { bg: 0x8d8a84, hemi: 1.6, sun: 2.4, fog: false },
  ash: { bg: PAL.sky, hemi: 1.3, sun: 1.6, fog: true },
  night: { bg: 0x121416, hemi: 0.12, sun: 0.15, fog: false },
};

// ---------------------------------------------------------------- three

const app = document.getElementById('app')!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(FOV, 1, 0.01, 2000);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.zoomToCursor = true;

const hemi = new THREE.HemisphereLight(0xf2efe8, 0x6b665c, 1.4);
const sun = new THREE.DirectionalLight(0xfff4e2, 2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
scene.add(hemi, sun, sun.target);

const ground = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: PAL.ground, roughness: 1 }));
ground.receiveShadow = true;
scene.add(ground);
let grid = new THREE.GridHelper(10, 10, 0x2b2d2f, 0x5d5b56);
scene.add(grid);
const axes = new THREE.AxesHelper(1);
scene.add(axes);
const boxHelper = new THREE.Box3Helper(new THREE.Box3(), 0xf08c35);
scene.add(boxHelper);

// ---------------------------------------------------------------- state

const entries: Entry[] = [...proceduralEntries(), ...glbEntries()];
const byId = new Map(entries.map(e => [e.id, e]));
const groupName = (g: string) => GROUPS[g] ?? (g.startsWith('glb:') ? 'GLB · ' + g.slice(4) : g);

const clock = new Clock();
const view = { light: 'studio' as Light, grid: true, axes: false, bbox: false, wire: false, original: false, rotate: false, shadows: true };
let ctx: Ctx;
let current: { entry: Entry; ex: Exhibit; p: Params; defaults: Params; mixer?: THREE.AnimationMixer; action?: THREE.AnimationAction } | null = null;
let loadToken = 0;
let query = '';

// ---------------------------------------------------------------- page

document.title = tr('Popiół i Prąd · Podgląd modeli', 'Ash and Power · Model viewer');
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
$('title').textContent = tr('Podgląd modeli i animacji', 'Models and animations');
$('top').appendChild(langSwitch());
const search = $<HTMLInputElement>('search');
search.placeholder = tr('szukaj (np. wolt, beczka, kaykit)', 'search (e.g. wolt, barrel, kaykit)');
$('listBtn').textContent = tr('Lista', 'List');
$('sideBtn').textContent = tr('Panel', 'Panel');
$('help').innerHTML = tr(
  '<b>LPM</b> obrót · <b>PPM</b> przesuw · <b>kółko</b> przybliżenie · <b>spacja</b> pauza · <b>.</b> klatka · <b>F</b> wyśrodkuj · <b>R</b> obracanie · <b>↑↓</b> poprzedni/następny',
  '<b>LMB</b> orbit · <b>RMB</b> pan · <b>wheel</b> zoom · <b>space</b> pause · <b>.</b> frame step · <b>F</b> frame · <b>R</b> turntable · <b>↑↓</b> previous/next');

function renderList() {
  const list = $('list');
  const shown = entries.filter(e => matches(query, e.name, e.id, groupName(e.group), e.src));
  const groups = new Map<string, Entry[]>();
  for (const e of shown) { if (!groups.has(e.group)) groups.set(e.group, []); groups.get(e.group)!.push(e); }
  list.innerHTML = [...groups].map(([g, es]) => `<details open><summary>${esc(groupName(g))} <span class="dim">${es.length}</span></summary>${es.map(e =>
    `<button type="button" data-id="${esc(e.id)}" class="${current?.entry.id === e.id ? 'on' : ''}">${e.animated ? '<i>▶</i>' : ''}${esc(e.name)}</button>`).join('')}</details>`).join('')
    || `<p class="dim">${tr('Nic nie pasuje.', 'Nothing matches.')}</p>`;
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));
const visibleIds = () => [...$('list').querySelectorAll<HTMLButtonElement>('button[data-id]')].map(b => b.dataset.id!);

$('list').addEventListener('click', e => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-id]');
  if (b) { select(b.dataset.id!); if (innerWidth < 760) document.body.classList.remove('show-list'); }
});
search.addEventListener('input', () => { query = search.value; renderList(); });
$('listBtn').addEventListener('click', () => document.body.classList.toggle('show-list'));
$('sideBtn').addEventListener('click', () => document.body.classList.toggle('hide-side'));

// ---------------------------------------------------------------- selecting

async function select(id: string, fromHash?: Params) {
  const entry = byId.get(id);
  if (!entry) return;
  const token = ++loadToken;
  $('status').textContent = tr('Ładuję…', 'Loading…');
  let ex: Exhibit;
  try {
    ex = await entry.build(ctx);
    if (view.original && isGlb(entry)) ex = { ...ex, object: await rawCopy(entry) };
  } catch (err) {
    $('status').textContent = tr('Błąd ładowania: ', 'Load error: ') + String(err);
    return;
  }
  if (token !== loadToken) return; // a newer pick won
  $('status').textContent = '';
  if (current) { setWire(current.ex.object, false); scene.remove(current.ex.object); current.mixer?.stopAllAction(); }
  const defaults: Params = {};
  for (const q of ex.params ?? []) if (q.kind !== 'button') defaults[q.key] = q.value;
  const p: Params = { ...defaults, ...(fromHash ?? {}) };
  ex.object.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
  scene.add(ex.object);
  current = { entry, ex, p, defaults };
  if (ex.clips?.length) {
    current.mixer = new THREE.AnimationMixer(ex.object);
    playClip(ex.clips[0].name);
  }
  ex.update?.(0, clock.t, p);
  setWire(ex.object, view.wire);
  frame();
  buildSide();
  renderList();
  writeHash();
}
const isGlb = (e: Entry): e is GlbEntry => e.id.startsWith('glb:');

function playClip(name: string) {
  if (!current?.mixer) return;
  current.mixer.stopAllAction();
  const clip = current.ex.clips!.find(c => c.name === name);
  if (!clip) return;
  current.action = current.mixer.clipAction(clip).reset().play();
}

/** Bounds of what is drawn (Box3.setFromObject also counts hidden parts, e.g. Wolt's cable peg). */
function visibleBox(root: THREE.Object3D, out = new THREE.Box3()): THREE.Box3 {
  out.makeEmpty();
  root.updateWorldMatrix(true, true);
  const walk = (o: THREE.Object3D) => {
    if (!o.visible) return;
    const m = o as THREE.Mesh;
    if (m.isMesh || (o as THREE.Line).isLine) {
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      out.union(tmpBox.copy(g.boundingBox!).applyMatrix4(o.matrixWorld));
    }
    o.children.forEach(walk);
  };
  walk(root);
  return out;
}
const tmpBox = new THREE.Box3();

/** Point the camera at the whole model, keeping the direction it looks from. */
function frame() {
  if (!current) return;
  const box = visibleBox(current.ex.object);
  if (box.isEmpty()) box.set(new THREE.Vector3(-0.5, 0, -0.5), new THREE.Vector3(0.5, 1, 0.5));
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const r = Math.max(0.05, sphere.radius);
  const dir = camera.position.clone().sub(controls.target);
  if (dir.lengthSq() < 1e-6) dir.copy(DEFAULT_DIR); else dir.normalize();
  const d = frameDistance(r, FOV, camera.aspect);
  controls.target.copy(sphere.center);
  camera.position.copy(sphere.center).addScaledVector(dir, d);
  camera.near = Math.max(0.005, r * 0.01); camera.far = r * 200 + 50;
  camera.updateProjectionMatrix();
  controls.minDistance = r * 0.08; controls.maxDistance = r * 30;
  // the floor, grid and shadow follow the model's size
  const span = Math.max(4, Math.ceil(r * 6));
  ground.scale.setScalar(span);
  scene.remove(grid);
  const cells = span * 2 <= 40 ? span * 2 : Math.ceil(span / 5) * 2;
  grid = new THREE.GridHelper(span * 2, cells, 0x2b2d2f, 0x5d5b56);
  grid.position.y = 0.002; grid.visible = view.grid; scene.add(grid);
  axes.scale.setScalar(Math.max(0.5, r));
  sun.position.copy(sphere.center).add(new THREE.Vector3(r * 2, r * 3.5, r * 1.5));
  sun.target.position.copy(sphere.center);
  const sc = sun.shadow.camera;
  sc.left = sc.bottom = -r * 2; sc.right = sc.top = r * 2; sc.near = 0.01; sc.far = r * 10;
  sc.updateProjectionMatrix();
  boxHelper.box.copy(box);
  info(box);
}

function info(box: THREE.Box3) {
  if (!current) return;
  let tris = 0, meshes = 0;
  const mats = new Set<THREE.Material>();
  current.ex.object.traverse(o => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    meshes++;
    const g = m.geometry;
    tris += (g.index ? g.index.count : g.attributes.position.count) / 3;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => mats.add(x));
  });
  const s = box.getSize(new THREE.Vector3());
  $('info').innerHTML = `<div class="name">${esc(current.entry.name)}</div>
    <div class="dim">${esc(groupName(current.entry.group))}</div>
    <code>${esc(current.entry.src)}</code>
    <div class="row"><span>${tr('rozmiar', 'size')}</span><span>${num(s.x, 2)} × ${num(s.y, 2)} × ${num(s.z, 2)} m</span></div>
    <div class="row"><span>${tr('trójkąty', 'triangles')}</span><span>${Math.round(tris).toLocaleString()}</span></div>
    <div class="row"><span>${tr('siatki / materiały', 'meshes / materials')}</span><span>${meshes} / ${mats.size}</span></div>`;
}

function setWire(o: THREE.Object3D, on: boolean) {
  o.traverse(x => {
    const m = x as THREE.Mesh;
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => { if ('wireframe' in mt) (mt as THREE.MeshStandardMaterial).wireframe = on; });
  });
}

// ---------------------------------------------------------------- side panel

function buildSide() {
  if (!current) return;
  const { ex, p } = current;
  const glb = isGlb(current.entry);
  const toggles: [keyof typeof view, string][] = [
    ['rotate', tr('obracaj (R)', 'turntable (R)')], ['grid', tr('siatka 1 m', '1 m grid')], ['axes', tr('osie', 'axes')],
    ['bbox', tr('obrys', 'bounds')], ['wire', tr('siatka trójkątów', 'wireframe')], ['shadows', tr('cienie', 'shadows')],
  ];
  if (glb) toggles.push(['original', tr('oryginalne kolory (bez popiołu)', 'original colours (no ash fade)')]);
  const clips = ex.clips ?? [];
  $('side-body').innerHTML = `
    <section><div class="lbl">${tr('ODTWARZANIE', 'PLAYBACK')}</div>
      <div class="btns"><button type="button" id="play">${clock.playing ? tr('❚❚ pauza', '❚❚ pause') : tr('▶ graj', '▶ play')}</button>
        <button type="button" id="step">${tr('+1 klatka', '+1 frame')}</button><button type="button" id="frame">${tr('wyśrodkuj', 'frame')}</button></div>
      <label class="rng"><span>${tr('tempo', 'speed')} <b id="speedV">${num(clock.speed, 2)}×</b></span><input type="range" id="speed" min="0.05" max="3" step="0.05" value="${clock.speed}"></label>
      ${clips.length ? `<label class="sel"><span>${tr('klip animacji', 'animation clip')}</span><select id="clip">${clips.map(c => `<option>${esc(c.name)}</option>`).join('')}</select></label>` : ''}
    </section>
    ${ex.params?.length ? `<section><div class="lbl">${tr('PARAMETRY', 'PARAMETERS')}</div>${ex.params.map(paramHtml).join('')}
      <button type="button" id="resetP" class="small">${tr('domyślne', 'defaults')}</button></section>` : ''}
    <section><div class="lbl">${tr('WIDOK', 'VIEW')}</div>
      <label class="sel"><span>${tr('światło', 'lighting')}</span><select id="light">
        <option value="studio">${tr('studio', 'studio')}</option><option value="ash">${tr('popiół (jak w grze)', 'ash (as in game)')}</option><option value="night">${tr('noc (widać świecące)', 'night (shows glow)')}</option></select></label>
      ${toggles.map(([k, l]) => `<label class="chk"><input type="checkbox" data-view="${k}" ${view[k] ? 'checked' : ''}><span>${l}</span></label>`).join('')}
      <button type="button" id="copy" class="small">${tr('kopiuj link do tego widoku', 'copy link to this view')}</button>
    </section>`;
  $<HTMLSelectElement>('light').value = view.light;
  $('play').onclick = togglePlay;
  $('step').onclick = () => { clock.playing = false; clock.step(); buildPlay(); };
  $('frame').onclick = frame;
  $<HTMLInputElement>('speed').oninput = e => { clock.speed = Number((e.target as HTMLInputElement).value); $('speedV').textContent = num(clock.speed, 2) + '×'; };
  if (clips.length) $<HTMLSelectElement>('clip').onchange = e => playClip((e.target as HTMLSelectElement).value);
  $<HTMLSelectElement>('light').onchange = e => { view.light = (e.target as HTMLSelectElement).value as Light; applyLight(); };
  $('side-body').querySelectorAll<HTMLInputElement>('input[data-view]').forEach(inp => inp.onchange = () => {
    const k = inp.dataset.view as keyof typeof view;
    (view as Record<string, unknown>)[k] = inp.checked;
    if (k === 'original') { if (current) select(current.entry.id, current.p); return; }
    applyView();
  });
  $('copy').onclick = () => { writeHash(); navigator.clipboard?.writeText(location.href).catch(() => { /* not allowed: the address bar has it */ }); };
  const reset = document.getElementById('resetP');
  if (reset) reset.onclick = () => { Object.assign(p, current!.defaults); syncInputs(true); writeHash(); };
  for (const q of ex.params ?? []) bindParam(q);
  syncInputs(true);
}
const buildPlay = () => { const b = document.getElementById('play'); if (b) b.textContent = clock.playing ? tr('❚❚ pauza', '❚❚ pause') : tr('▶ graj', '▶ play'); };
function togglePlay() { clock.playing = !clock.playing; buildPlay(); }

function paramHtml(q: Param): string {
  const id = 'p_' + q.key;
  switch (q.kind) {
    case 'range': return `<label class="rng"><span>${esc(q.label)} <b id="${id}_v"></b></span><input type="range" id="${id}" min="${q.min}" max="${q.max}" step="${q.step}"></label>`;
    case 'select': return `<label class="sel"><span>${esc(q.label)}</span><select id="${id}">${q.options.map(([v, l]) => `<option value="${esc(v)}">${esc(l)}</option>`).join('')}</select></label>`;
    case 'check': return `<label class="chk"><input type="checkbox" id="${id}"><span>${esc(q.label)}</span></label>`;
    case 'button': return `<button type="button" id="${id}" class="act">${esc(q.label)}</button>`;
  }
}

function bindParam(q: Param) {
  const el = document.getElementById('p_' + q.key) as HTMLInputElement | HTMLSelectElement | HTMLButtonElement | null;
  if (!el || !current) return;
  const p = current.p;
  if (q.kind === 'button') { el.addEventListener('click', () => q.run(p)); return; }
  el.addEventListener('input', () => {
    if (q.kind === 'range') p[q.key] = Number((el as HTMLInputElement).value);
    else if (q.kind === 'check') p[q.key] = (el as HTMLInputElement).checked;
    else { p[q.key] = el.value; q.apply?.(el.value, p); }
    syncInputs(q.kind === 'select');
    writeHashSoon();
  });
}

/** Show the parameter values in the inputs (buttons and docking change them from the code). */
function syncInputs(all = false) {
  if (!current) return;
  for (const q of current.ex.params ?? []) {
    if (q.kind === 'button') continue;
    const el = document.getElementById('p_' + q.key) as HTMLInputElement | HTMLSelectElement | null;
    if (!el) continue;
    const v = current.p[q.key];
    if (q.kind === 'check') { const c = el as HTMLInputElement; if (all || c.checked !== !!v) c.checked = !!v; }
    else if (all || el.value !== String(v)) {
      if (document.activeElement !== el || all) el.value = String(v);
    }
    if (q.kind === 'range') { const o = document.getElementById(`p_${q.key}_v`); if (o) o.textContent = num(Number(v), q.step < 0.1 ? 2 : q.step < 1 ? 1 : 0) + (q.unit ? ' ' + q.unit : ''); }
  }
}

function applyLight() {
  const L = LIGHTS[view.light];
  scene.background = new THREE.Color(L.bg);
  scene.fog = L.fog && current ? new THREE.Fog(L.bg, camera.position.distanceTo(controls.target) * 1.2, camera.position.distanceTo(controls.target) * 6) : null;
  hemi.intensity = L.hemi; sun.intensity = L.sun;
  (ground.material as THREE.MeshStandardMaterial).color.setHex(view.light === 'night' ? 0x2a2a28 : PAL.ground);
}
function applyView() {
  grid.visible = view.grid; axes.visible = view.axes; boxHelper.visible = view.bbox;
  controls.autoRotate = view.rotate; controls.autoRotateSpeed = 1.5;
  renderer.shadowMap.enabled = view.shadows; sun.castShadow = view.shadows;
  scene.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(x => (x.needsUpdate = true)); });
  if (current) setWire(current.ex.object, view.wire);
}

// ---------------------------------------------------------------- the link

const VIEW_KEYS = ['light', 'rotate', 'wire', 'original'] as const;
const VIEW_DEFAULTS: Params = { light: 'studio', rotate: false, wire: false, original: false };
function writeHash() {
  if (!current) return;
  const v: Params = {};
  for (const k of VIEW_KEYS) v['v_' + k] = view[k];
  const dv: Params = {};
  for (const k of VIEW_KEYS) dv['v_' + k] = VIEW_DEFAULTS[k];
  history.replaceState(null, '', formatHash(current.entry.id, { ...current.p, ...v }, { ...current.defaults, ...dv }) + '');
}
let hashTimer = 0;
const writeHashSoon = () => { clearTimeout(hashTimer); hashTimer = window.setTimeout(writeHash, 250); };

function readHash(): { id: string; params: Params } {
  const h = parseHash(location.hash);
  const params: Params = {};
  for (const [k, val] of Object.entries(h.params)) {
    if (k.startsWith('v_')) (view as Record<string, unknown>)[k.slice(2)] = val;
    else params[k] = val;
  }
  return { id: h.id && byId.has(h.id) ? h.id : 'wolt', params };
}
addEventListener('hashchange', () => { const h = readHash(); if (h.id !== current?.entry.id) select(h.id, h.params); });

// ---------------------------------------------------------------- keys, resize, loop

addEventListener('keydown', e => {
  if ((e.target as HTMLElement).closest('input[type=text], input[type=search], select')) return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === '.') { clock.playing = false; clock.step(); buildPlay(); }
  else if (e.key === 'f' || e.key === 'F') frame();
  else if (e.key === 'r' || e.key === 'R') { view.rotate = !view.rotate; applyView(); buildSide(); }
  else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const ids = visibleIds(), i = ids.indexOf(current?.entry.id ?? '');
    const next = ids[(i + (e.key === 'ArrowDown' ? 1 : -1) + ids.length) % ids.length];
    if (next) select(next);
  }
});

function resize() {
  const r = app.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / Math.max(1, r.height);
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(app);

let last = performance.now(), syncAcc = 0;
renderer.setAnimationLoop(now => {
  const dt = clock.advance((now - last) / 1000);
  last = now;
  if (current) {
    current.ex.update?.(dt, clock.t, current.p);
    current.mixer?.update(dt);
    if (view.bbox) visibleBox(current.ex.object, boxHelper.box);
    syncAcc += 1 / 60;
    if (syncAcc > 0.1) { syncAcc = 0; syncInputs(); }
  }
  if (scene.fog instanceof THREE.Fog) { const d = camera.position.distanceTo(controls.target); scene.fog.near = d * 1.2; scene.fog.far = d * 6; }
  controls.update();
  renderer.render(scene, camera);
});

// ---------------------------------------------------------------- start

async function start() {
  resize();
  const bar = $('loadBar');
  $('loadText').textContent = tr('Ładuję modele…', 'Loading models…');
  const tally: Record<string, [number, number]> = {};
  const prog = (k: string) => (d: number, t: number) => {
    tally[k] = [d, t];
    const [a, b] = Object.values(tally).reduce(([x, y], [p, q]) => [x + p, y + q], [0, 0]);
    bar.style.width = `${(a / Math.max(1, b)) * 100}%`;
  };
  const [base, craft, station] = await Promise.all([
    loadModels(prog('base')),
    (async () => { const m: Models = new Map(); await loadCraftModels(m, prog('craft')); return m; })(),
    (async () => { const m: Models = new Map(); await loadStationModels(m, prog('station')); return m; })(),
  ]);
  ctx = { models: new Map([...base, ...craft]), station };
  $('loading').hidden = true;
  applyLight(); applyView();
  const h = readHash();
  renderList();
  await select(h.id, h.params);
  applyLight();
}
start().catch(err => { $('loadText').textContent = String(err); });
