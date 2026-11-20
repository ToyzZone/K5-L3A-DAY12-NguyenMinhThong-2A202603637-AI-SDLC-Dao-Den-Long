// Giao diện 3D: chỉ dựng Input mỗi tick và vẽ World. Luật nằm hết trong src/sim/game.ts.
import * as THREE from 'three';
import { createWorld, step, hasNight, distXZ, fuelOf, hasSafeZone, capacityOf, idleInput, type Input, type Lantern, type Vec3, type World } from '../sim/game.js';
import { benchWorld } from '../sim/bench.js';
import { TUNING as T, RULES as R, TPS } from '../sim/tuning.js';
import { sfx, setVolume, unlockAudio } from './audio.js';
import { createSkin } from './skin.js';
import { NAME_RE, isoNow, rank } from '../../scripts/leaderboard.mjs';

const $ = (id: string) => document.getElementById(id)!;
const params = new URLSearchParams(location.search);
// Benchmark Ticket-04 §1 (?bench&seed=42&duration=30, do scripts/bench.mjs mở): cảnh chuẩn, khung 1280×720, không HUD/menu/sáng tạo thêm.
const BENCH = params.has('bench');
const newSeed = () => Math.floor(Math.random() * 2 ** 31);
const C = { sky: 0x0e1430, fog: 0x1b2350, grass: 0x2f5d50, sand: 0xc9b48a, wood: 0x6b4a2f, sea: 0x12384a, lit: 0xffb347, core: 0xffe9b0, unlit: 0x5b5f6e, moteCore: 0xfff6c2, moteHalo: 0xffe58a, shade: 0x120a1a, shadeRim: 0x7a3cff, stunned: 0x3a3450, shirt: 0xe8e2d0, red: 0xc8102e, gold: 0xf2c14e };
const ISLAND: Record<number, string> = { 1: 'Đảo Bến', 2: 'Đảo Cau', 3: 'Đảo Chuông' };
const DANG: Record<number, string> = {
  1: 'Thắp đèn rồi nhớ châm dầu, giữ đảo sáng tới bình minh con nhé.',
  2: 'Đảo Cau có hai bờ: đi cầu gỗ hoặc nhảy bàn đá, chớ rơi xuống biển mây.',
  3: 'Gió Đảo Chuông thổi từng cơn: nghe gió rít thì đứng vững, đừng để Gió Lạc cướp đom đóm.',
};
// ponytail: hình đảo vẽ tay theo maps.ts (ground() không liệt kê đảo); đổi bản đồ thì sửa cả ở đây.
const ISLANDS: Record<number, [number, number][]> = { 1: [[0, 40]], 2: [[0, 28], [70, 28]], 3: [[0, 45]] };
const BRIDGES: Record<number, { x0: number; x1: number; z0: number; z1: number }[]> = { 2: [{ x0: 26, x1: 44, z0: -2, z1: 2 }] };

// --- Cài đặt (lưu localStorage) ---
// Đổi phím (Ticket-04 §4): mỗi hành động một phím theo e.code; Esc luôn tạm dừng và hủy đổi phím.
const DEFAULT_KEYS = { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', jump: 'Space', dash: 'ShiftLeft', interact: 'KeyE', pulse: 'KeyF', pause: 'KeyP', camL: 'ArrowLeft', camR: 'ArrowRight' };
type Action = keyof typeof DEFAULT_KEYS;
const ACTIONS = Object.keys(DEFAULT_KEYS) as Action[];
const ACTION_NAME: Record<Action, string> = { up: 'Đi lên', down: 'Đi xuống', left: 'Sang trái', right: 'Sang phải', jump: 'Nhảy', dash: 'Lướt', interact: 'Tương tác', pulse: 'Tỏa sáng', pause: 'Tạm dừng', camL: 'Xoay camera trái', camR: 'Xoay camera phải' };
const KEY_LABEL: Record<string, string> = { ShiftLeft: 'Shift trái', ShiftRight: 'Shift phải', ControlLeft: 'Ctrl trái', ControlRight: 'Ctrl phải', AltLeft: 'Alt trái', AltRight: 'Alt phải', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓' };
const keyName = (c: string) => KEY_LABEL[c] ?? c.replace(/^(Key|Digit)/, '');
// cb: Bảng màu dễ phân biệt (Ticket-03 §6); rm: giảm chuyển động; big: chữ lớn ×1.25.
const settings = { vol: 0.6, sens: 0.3, cb: false, rm: matchMedia('(prefers-reduced-motion: reduce)').matches, big: false, theme: '', keys: { ...DEFAULT_KEYS } };
try {
  const saved = JSON.parse(localStorage.getItem('ddl-settings') ?? '{}');
  Object.assign(settings, saved, { keys: { ...DEFAULT_KEYS, ...saved.keys } });
} catch { /* chạy với mặc định */ }
// Các nhóm hành động đang dùng chung một phím (báo cho người chơi, không chặn).
function dupKeys(): Action[][] {
  const by = new Map<string, Action[]>();
  for (const a of ACTIONS) by.set(settings.keys[a], [...(by.get(settings.keys[a]) ?? []), a]);
  return [...by.values()].filter((as) => as.length > 1);
}
let rebinding: Action | null = null;
const saveSettings = () => { try { localStorage.setItem('ddl-settings', JSON.stringify(settings)); } catch { /* bỏ qua */ } };
setVolume(settings.vol);

// --- Cảnh ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(BENCH ? 1 : Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.4;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(C.sky);
const fog = new THREE.FogExp2(C.fog, 0.018);
scene.fog = fog;
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
const resize = () => {
  const [cw, ch] = BENCH ? [1280, 720] : [innerWidth, innerHeight];
  renderer.setSize(cw, ch);
  camera.aspect = cw / ch;
  camera.updateProjectionMatrix();
};
addEventListener('resize', resize);
resize();

const backdrop: THREE.Object3D[] = []; // biển, mây, sao, 3 đèn của cảnh cổ điển: theme ẩn đi
const ambient = new THREE.AmbientLight(0xfff0dd, 0.15); // = 0.15 + 0.55 × đèn sáng / tổng (Ticket-02 mục 8)
const sky = new THREE.HemisphereLight(0x8a90d0, 0x2a2010, 1);
const moon = new THREE.DirectionalLight(0x9fb0ff, 1.2);
moon.position.set(-20, 30, -10);
scene.add(ambient, sky, moon);
backdrop.push(ambient, sky, moon);

const std = (color: number, emissive = 0, ei = 1, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85, ...extra });
const flat = (color: number, opacity: number, extra: THREE.MeshBasicMaterialParameters = {}) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false, ...extra });
function add<M extends THREE.Material | THREE.Material[]>(g: THREE.BufferGeometry, m: M, parent: THREE.Object3D = scene, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
const ring = (r0: number, r1: number) => new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2);

// Biển mây + sao.
backdrop.push(add(new THREE.PlaneGeometry(800, 800).rotateX(-Math.PI / 2), std(C.sea), scene, 35, -16, 0));
const cloudGeo = new THREE.SphereGeometry(1, 12, 8), cloudMat = std(C.sea, C.sea, 0.5);
for (let i = 0; i < 90; i++) {
  const a = Math.random() * Math.PI * 2, r = 50 + Math.random() * 110, s = 4 + Math.random() * 8;
  const cl = add(cloudGeo, cloudMat, scene, 35 + Math.cos(a) * r, -14 + Math.random() * 3, Math.sin(a) * r);
  cl.scale.set(s * 1.6, s * 0.4, s);
  backdrop.push(cl);
}
const starPos = Array.from({ length: 700 * 3 }, (_, i) => {
  const k = Math.floor(i / 3), a = k * 2.399, y = 0.15 + 0.85 * ((k * 0.618) % 1);
  return [Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y)][i % 3] * 300;
});
const stars = new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
  new THREE.PointsMaterial({ color: 0xfff0d0, size: 2, sizeAttenuation: false, fog: false }),
);
scene.add(stars);
backdrop.push(stars);

// --- Mây: áo, khăn đỏ, nón lá, đèn nhỏ treo vành nón ---
const player = new THREE.Group();
scene.add(player);
add(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), std(C.shirt), player, 0, 0.65, 0);
const scarf = add(new THREE.TorusGeometry(0.27, 0.08, 8, 16).rotateX(Math.PI / 2), std(C.red, C.red, 0), player, 0, 1.12, 0);
add(new THREE.SphereGeometry(0.28, 16, 12), std(0xffd9b0), player, 0, 1.35, 0);
add(new THREE.ConeGeometry(0.95, 0.45, 28), std(0xe3c98a), player, 0, 1.68, 0);
add(new THREE.CylinderGeometry(0.012, 0.012, 0.3), std(C.wood), player, 0.55, 1.31, 0.55);
const hatLantern = add(new THREE.SphereGeometry(0.11, 12, 8), std(C.lit, C.lit, 3), player, 0.55, 1.1, 0.55);
const playerLight = new THREE.PointLight(0xffaa55, 15, 14);
playerLight.position.copy(hatLantern.position);
player.add(playerLight);

// --- Màn chơi theo Đêm (dựng một lần, dùng lại khi chơi lại) ---
const postGeo = new THREE.CylinderGeometry(0.1, 0.14, 2.4, 8), headGeo = new THREE.SphereGeometry(0.38, 16, 12);
const tearGeo = new THREE.BoxGeometry(0.07, 0.4, 0.04), tearMat = new THREE.MeshBasicMaterial({ color: 0x0b0710 }), BAR_W = 1.4;
const coreGeo = new THREE.SphereGeometry(0.2, 10, 8), pipGeo = new THREE.SphereGeometry(0.07, 8, 6), safeGeo = ring(T.safe_radius - 0.12, T.safe_radius);
interface Level { g: THREE.Group; terrain: THREE.Object3D[]; lanterns: ReturnType<typeof makeLantern>[]; charms: THREE.Object3D[]; pads: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] }
function makeLantern(parent: THREE.Object3D) {
  const g = new THREE.Group();
  parent.add(g);
  add(postGeo, std(C.wood), g, 0, 1.2, 0);
  const head = add(headGeo, std(C.unlit, C.lit, 0, { transparent: true, opacity: 0.9 }), g, 0, 2.75, 0);
  head.scale.y = 1.25;
  const core = add(coreGeo, new THREE.MeshBasicMaterial({ color: C.core }), g, 0, 2.75, 0);
  const light = new THREE.PointLight(C.lit, 0, 26);
  light.position.y = 2.75;
  g.add(light);
  const pips = Array.from({ length: T.lantern_cost }, (_, i) => {
    const a = (i / T.lantern_cost) * Math.PI * 2;
    return add(pipGeo, std(0x333333, C.moteHalo, 0), g, Math.sin(a) * 0.7, 3.45, Math.cos(a) * 0.7);
  });
  const safe = add(safeGeo, flat(C.lit, 0.28), g, 0, 0.04, 0);
  // Vết rách giấy (chế độ mù màu, đèn tắt): hai khe tối hai mặt đầu đèn.
  const tears = [0.36, -0.36].map((z) => { const m = add(tearGeo, tearMat, g, 0.05, 2.75, z); m.rotation.z = 0.5; return m; });
  // Thanh dầu: 2 sprite luôn quay về camera; fill neo mép trái bằng center.x.
  const barBg = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0x0e1430, opacity: 0.8, transparent: true, fog: false }));
  const bar = new THREE.Sprite(new THREE.SpriteMaterial({ color: C.lit, fog: false }));
  barBg.scale.set(BAR_W + 0.08, 0.2, 1);
  barBg.position.y = bar.position.y = 3.8;
  bar.renderOrder = 1;
  g.add(barBg, bar);
  return { g, head, core, light, pips, safe, tears, barBg, bar, litAt: -9 };
}
const levels = new Map<number, Level>();
// Đêm 3 Đảo Chuông: khối đặc vách đứng theo night3Ground (maps.ts).
function buildNight3(g: THREE.Group) {
  const cliff = std(0x8a7f6a), top = std(C.grass), stone = std(0x6d6878);
  const half = new THREE.Shape(); // tầng 1: nửa vành khăn r 12–24, z > 0, Y 3
  half.absarc(0, 0, 24, 0, Math.PI, false);
  half.absarc(0, 0, 12, Math.PI, 0, true);
  // rotateX(+90°): hình (x, y) -> (x, ·, y) nên z > 0; khối đùn xuống [-3, 0] rồi đặt ở Y 3.
  add(new THREE.ExtrudeGeometry(half, { depth: 3, bevelEnabled: false, curveSegments: 48 }).rotateX(Math.PI / 2), [top, cliff], g, 0, 3, 0);
  add(new THREE.CylinderGeometry(8, 8, 6, 48), [cliff, top, top], g, 0, 3, 0); // tầng 2: r ≤ 8, Y 6
  add(new THREE.CylinderGeometry(2, 2, 8, 24), stone, g, 0, 10, 0); // tháp chuông: đỉnh Y 14
  add(new THREE.TorusGeometry(2.05, 0.12, 8, 32).rotateX(Math.PI / 2), std(C.gold, C.gold, 1.5), g, 0, 12.6, 0);
  add(new THREE.ConeGeometry(2.8, 2.2, 24), std(C.red), g, 0, 15.1, 0);
  const wedge = new THREE.Shape([new THREE.Vector2(24, 0), new THREE.Vector2(30, 0), new THREE.Vector2(24, 3)]);
  const rampGeo = new THREE.ExtrudeGeometry(wedge, { depth: 3, bevelEnabled: false }).translate(0, 0, -1.5);
  for (const deg of [30, 150]) add(rampGeo, [std(C.wood), std(C.wood)], g).rotation.y = (-deg * Math.PI) / 180; // +X -> (cos, sin)
}
function level(w: World): Level {
  for (const [n, l] of levels) l.g.visible = n === w.night;
  const cached = levels.get(w.night);
  if (cached) return cached;
  const g = new THREE.Group();
  scene.add(g);
  const terrain: THREE.Object3D[] = [];
  for (const [cx, r] of ISLANDS[w.night] ?? ISLANDS[1]) {
    terrain.push(add(new THREE.CylinderGeometry(r, r * 0.88, 3, 64), std(C.sand), g, cx, -1.5, 0));
    terrain.push(add(new THREE.ConeGeometry(r * 0.88, r * 0.5, 24).rotateX(Math.PI), std(0x2a2638), g, cx, -3 - r * 0.25, 0));
    terrain.push(add(new THREE.CircleGeometry(r - 1.6, 64).rotateX(-Math.PI / 2), std(C.grass), g, cx, 0.02, 0));
  }
  if (w.night === 2) { // cầu gỗ x ∈ [26, 44], |z| ≤ 2
    terrain.push(add(new THREE.BoxGeometry(18, 0.3, 4), std(C.wood), g, 35, -0.15, 0));
    for (const x of [26.5, 31, 35.5, 40, 43.5]) for (const z of [-1.9, 1.9]) terrain.push(add(new THREE.CylinderGeometry(0.08, 0.08, 1), std(C.wood), g, x, 0.5, z));
  }
  if (w.night === 3) buildNight3(g);
  const pads = w.map.pads.map((p) => add(new THREE.CylinderGeometry(1, 1.1, 0.16, 24), std(0x8a8170, C.gold, 1), g, p.pos[0], p.pos[1] + 0.08, p.pos[2]));
  const charms = w.charms.map((c) => {
    const o = new THREE.Group();
    add(new THREE.BoxGeometry(0.62, 0.82, 0.04), std(C.gold, C.gold, 0.6), o);
    add(new THREE.BoxGeometry(0.5, 0.7, 0.06), std(C.red, C.red, 0.5), o);
    o.position.set(c.pos[0], c.pos[1] + 1, c.pos[2]);
    g.add(o);
    return o;
  });
  const l: Level = { g, terrain, lanterns: w.lanterns.map(() => makeLantern(g)), charms, pads };
  levels.set(w.night, l);
  return l;
}

// --- Đom đóm & Bóng Mực: mesh theo id ---
function sync<O extends THREE.Object3D, I extends { id: string; pos: Vec3 }>(map: Map<string, O>, items: I[], make: () => O, update: (o: O, it: I) => void) {
  const seen = new Set<string>();
  for (const it of items) {
    seen.add(it.id);
    let o = map.get(it.id);
    if (!o) { o = make(); scene.add(o); map.set(it.id, o); }
    o.position.set(...it.pos);
    update(o, it);
  }
  for (const [id, o] of map) if (!seen.has(id)) { scene.remove(o); map.delete(id); }
}
const moteGeo = new THREE.SphereGeometry(0.14, 10, 8), haloGeo = new THREE.SphereGeometry(0.34, 12, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: C.moteCore, fog: false });
const haloMat = flat(C.moteHalo, 0.35, { blending: THREE.AdditiveBlending, fog: false });
const motes = new Map<string, THREE.Group>();
const makeMote = () => { const g = new THREE.Group(); add(moteGeo, moteMat, g); add(haloGeo, haloMat, g); return g; };
const shadeGeo = new THREE.SphereGeometry(0.8, 20, 14), eyeGeo = new THREE.SphereGeometry(0.09, 8, 6);
type ShadeMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
const shades = new Map<string, ShadeMesh>();
const makeShade = (): ShadeMesh => {
  const m = new THREE.Mesh(shadeGeo, std(C.shade, C.shadeRim, 0.25, { transparent: true, opacity: 0.9 }));
  add(shadeGeo, rimMat, m).scale.setScalar(1.08); // viền
  add(eyeGeo, eyeMat, m, -0.25, 0.2, 0.72);
  add(eyeGeo, eyeMat, m, 0.25, 0.2, 0.72);
  return m;
};
const rimMat = new THREE.MeshBasicMaterial({ color: C.shadeRim, side: THREE.BackSide, transparent: true, opacity: 0.8 });
const eyeMat = new THREE.MeshBasicMaterial({ color: C.shadeRim });
// Bóng Mực đang hút dầu: đường mảnh từ Bóng tới đèn.
const drainGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(32 * 6), 3));
const drainMat = new THREE.LineBasicMaterial({ color: C.shadeRim, fog: false });
const drainLines = new THREE.LineSegments(drainGeo, drainMat);
drainLines.frustumCulled = false; // vị trí đổi mỗi khung, bounding sphere ban đầu không đúng
scene.add(drainLines);
const rimColor = () => (settings.cb ? 0x00b3ff : C.shadeRim);
function applyPalette() {
  rimMat.color.set(rimColor());
  eyeMat.color.set(rimColor());
  drainMat.color.set(rimColor());
  document.body.classList.toggle('cb', settings.cb);
  document.body.classList.toggle('big', settings.big);
  document.body.classList.toggle('rm', settings.rm);
  const K = (a: Action) => keyName(settings.keys[a]);
  $('help').textContent = `${K('up')} ${K('left')} ${K('down')} ${K('right')} di chuyển · kéo chuột hoặc ${K('camL')}/${K('camR')} xoay camera · ${K('jump')} nhảy · ${K('dash')} lướt · ${K('interact')} nạp đèn · ${K('pulse')} tỏa sáng · ${K('pause')}/Esc tạm dừng`;
}
applyPalette();
// Giao diện thêm (sáng tạo): ?theme= thắng lựa chọn trong Cài đặt; 'classic' hoặc ?bench thì không chạy dòng theme nào.
const themeWant = params.get('theme') ?? (settings.theme || null);
const skin = BENCH || themeWant === 'classic' ? null : createSkin(themeWant, scene, renderer, settings, backdrop);
if (skin) { camera.far = 600; camera.updateProjectionMatrix(); } // vòm trời theme r 420 quanh gốc; Đêm 2 camera đi tới x ≈ 100
const THEME_NAMES: Record<string, string> = { sonmai: 'Sơn Mài', giaydo: 'Giấy Dó', chayshow: 'Đom Đóm · Chạy Show', classic: 'Cổ điển' };

// Gió Lạc: dải lụa xám xanh (một hình học chung, uốn sóng mỗi khung).
const ribbonGeo = new THREE.PlaneGeometry(0.45, 2.4, 1, 12);
const ribbonBase = Float32Array.from(ribbonGeo.getAttribute('position').array);
const ribbonMat = std(0x8fa3b8, 0x8fa3b8, 0.35, { side: THREE.DoubleSide, transparent: true, opacity: 0.85 });
const drifters = new Map<string, THREE.Group>();
const makeDrifter = () => {
  const g = new THREE.Group();
  add(ribbonGeo, ribbonMat, g).rotation.z = 1.25;
  add(ribbonGeo, ribbonMat, g, 0.3, -0.2, 0.2).rotation.z = 1.0;
  add(moteGeo, moteMat, g, 0, 0.2, 0).name = 'loot'; // đang mang đom đóm cướp được
  return g;
};
// Gió: vệt gió quanh Mây theo hướng gió khi có cơn; báo trước 2 s.
const WIND_N = 140, windBase = Float32Array.from({ length: WIND_N * 3 }, (_, i) => (i % 3 === 1 ? 0.3 + Math.random() * 5 : (Math.random() - 0.5) * 40));
const windGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(WIND_N * 6), 3));
const windMat = new THREE.LineBasicMaterial({ color: 0xe4ecff, transparent: true, opacity: 0.55 });
const windLines = new THREE.LineSegments(windGeo, windMat);
windLines.frustumCulled = false;
scene.add(windLines);

// --- Hiệu ứng ---
const pulseRing = add(ring(0.85, 1), flat(0xffc870, 1));
let pulseAt = -9, hitAt = -9;

// --- Luồng màn hình: menu → giới thiệu Đêm → chơi → kết quả → Đêm kế / Bình Minh ---
type Screen = 'menu' | 'intro' | 'play' | 'result' | 'dawn' | 'bench' | 'board';
let screen: Screen = BENCH ? 'bench' : 'menu', settingsOpen = false, total = 0, night = 1, endReason = '';
const needLit = (n: number) => Math.ceil(T.win_ratio * n);
let world: World = BENCH ? benchWorld(Number(params.get('seed') ?? 42)) : createWorld(newSeed(), {}, 1);
let lv = level(world);
const startNight = (n: number, to: Screen) => { night = n; world = createWorld(runSeed + n - 1, {}, n); lv = level(world); screen = to; acc = 0; };

// --- Bảng xếp hạng (Ticket-04 §3): server của `npm run play` lưu ra đĩa; không có server (vite dev) thì lưu localStorage ---
type Entry = { name: string; score: number; nights_won: number; achieved_at: string; seed: number };
const LB_KEY = 'ddl-leaderboard';
let runSeed = newSeed(), nightsWon = 0, savedName = false, board: Entry[] | null = null, boardLocal = false, mine = '', panelRev = 0;
const localBoard = (): Entry[] => { try { return rank(JSON.parse(localStorage.getItem(LB_KEY) ?? '[]')); } catch { return []; } };
async function loadBoard() {
  board = null;
  try {
    const r = await fetch('/api/leaderboard');
    board = (await r.json()).entries;
    boardLocal = false;
  } catch { board = localBoard(); boardLocal = true; }
  panelRev++;
}
async function submitName() {
  const input = document.getElementById('lbname') as HTMLInputElement | null, err = document.getElementById('lberr');
  if (!input || !err || savedName) return;
  const name = input.value.trim();
  if (!NAME_RE.test(name)) { err.textContent = 'Tên cần 3–12 ký tự: chữ không dấu A–Z, số 0–9 hoặc dấu _'; return; }
  const entry: Entry = { name, score: total, nights_won: nightsWon, achieved_at: isoNow(), seed: runSeed };
  try {
    const r = await fetch('/api/leaderboard', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(entry) });
    const body = await r.json();
    if (r.status === 400) { err.textContent = body.error; return; }
    board = body.entries;
    boardLocal = false;
  } catch {
    board = rank([...localBoard(), entry]);
    try { localStorage.setItem(LB_KEY, JSON.stringify(board)); } catch { /* bỏ qua */ }
    boardLocal = true;
  }
  savedName = true;
  mine = entry.achieved_at + entry.name;
  screen = 'board';
  panelRev++;
}
const nameForm = () => savedName ? '<p>Đã lưu điểm vào Bảng xếp hạng.</p>'
  : `<p>Lưu vào Bảng xếp hạng: tổng <b>${total}</b> điểm, thắng ${nightsWon}/3 Đêm</p>` +
    `<div class="row"><input type="text" id="lbname" maxlength="12" placeholder="Tên 3–12 ký tự" autocomplete="off" spellcheck="false" aria-label="Tên người chơi">${btn('save', 'Lưu điểm')}</div><p class="err" id="lberr" role="alert"></p>`;
function boardHtml(): string {
  if (board === null) return '<p>Đang tải…</p>';
  if (!board.length) return '<p>Chưa có ai. Hãy là người đầu tiên!</p>';
  return `<table><tr><th>#</th><th>Tên</th><th>Điểm</th><th>Đêm thắng</th><th>Lúc</th></tr>${board.map((e, i) =>
    `<tr${e.achieved_at + e.name === mine ? ' class="me"' : ''}><td>${i + 1}</td><td>${e.name}</td><td>${e.score}</td><td>${e.nights_won}/3</td><td>${e.achieved_at.slice(0, 16).replace('T', ' ')}</td></tr>`).join('')}</table>` +
    (boardLocal ? '<p><small>Không có server nên đang lưu trong trình duyệt. Chạy <code>npm run play</code> để lưu ra đĩa.</small></p>' : '');
}

const btn = (act: string, label: string) => `<button data-act="${act}">${label}</button>`;
function panelHtml(): string {
  if (settingsOpen) {
    const dups = dupKeys(), dupSet = new Set(dups.flat()), chk = (id: string, on: boolean, label: string) => `<label><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${label}</label>`;
    return `<h1>Cài đặt</h1><label>Âm lượng <input type="range" id="vol" min="0" max="1" step="0.05" value="${settings.vol}"></label>` +
      `<label>Độ nhạy chuột <input type="range" id="sens" min="0.05" max="1" step="0.05" value="${settings.sens}"></label>` +
      chk('cb', settings.cb, 'Bảng màu dễ phân biệt') + chk('rm', settings.rm, 'Giảm chuyển động (tắt chớp màn hình, nhấp nháy)') + chk('big', settings.big, 'Chữ lớn (×1.25)') +
      `<label>Giao diện <select id="theme">${Object.entries(THEME_NAMES).map(([k, v]) => `<option value="${k}"${k === (skin?.key ?? 'classic') ? ' selected' : ''}>${v}</option>`).join('')}</select></label>` +
      `<h2>Phím</h2><div class="keys">${ACTIONS.map((a) => `<span>${ACTION_NAME[a]}</span><button data-key="${a}"${dupSet.has(a) ? ' class="dup"' : ''}>${rebinding === a ? 'Nhấn phím…' : keyName(settings.keys[a])}</button>`).join('')}</div>` +
      `<p class="err" role="alert">${dups.map((as) => `Trùng phím ${keyName(settings.keys[as[0]])}: ${as.map((a) => ACTION_NAME[a]).join(', ')}`).join('<br>')}</p>` +
      `<p><small>Bấm một ô rồi nhấn phím mới. Esc: hủy (Esc luôn tạm dừng game).</small></p>` +
      `<div class="row">${btn('keys-reset', 'Khôi phục mặc định')}${btn('back', 'Quay lại')}</div>`;
  }
  const won = world.state === 'won', n = world.lanterns.length;
  const litNow = `Đèn sáng lúc kết thúc: ${world.lanterns.filter((l) => l.lit).length}/${n} (cần ${needLit(n)})`;
  switch (screen) {
    case 'menu': return `<h1>Đảo Đèn Lồng</h1><p>Gom đom đóm, thắp đèn lồng, xua Bóng Mực và đón Bình Minh.</p>` + btn('start', 'Bắt đầu') + btn('board', 'Bảng xếp hạng') + btn('settings', 'Cài đặt');
    case 'board': return `<h1>Bảng xếp hạng</h1>${boardHtml()}` + btn('menu', 'Về menu');
    case 'intro': return `<h2>ĐÊM ${night}</h2><h1>${ISLAND[night] ?? ''}</h1><p class="quote">Ông Đăng: “${DANG[night] ?? ''}”</p>` + btn('play', 'Vào Đêm');
    case 'play': return world.state !== 'paused' ? '' :
      `<h1>Tạm dừng</h1>` + btn('resume', 'Tiếp tục') + btn('retry', 'Chơi lại Đêm') + btn('settings', 'Cài đặt') + btn('menu', 'Về menu');
    case 'result': return won
      ? `<h1>Thắng Đêm ${night}</h1><p>Giữ đảo sáng tới bình minh</p><p>${litNow}</p><p>Điểm Đêm: ${world.score} · Tổng: ${total}</p>` + btn('next', hasNight(night + 1) ? 'Đêm tiếp theo' : 'Đón Bình Minh') + btn('menu', 'Về menu')
      : `<h1>Thua</h1><p>${endReason === 'no_flames' ? 'Hết Ngọn Lửa' : 'Bình minh tới nhưng chưa đủ đèn sáng'}</p><p>${litNow}</p><p>Điểm Đêm: ${world.score} · Tổng: ${total}</p>` + nameForm() + btn('retry', `Chơi lại Đêm ${night}`) + btn('menu', 'Về menu');
    case 'dawn': return `<h1>Bình Minh</h1><p>Mặt trời lên, các đảo đã sáng đèn.</p><p>Tổng điểm: <b>${total}</b></p>` + nameForm() +
      btn('board', 'Bảng xếp hạng') + btn('menu', 'Về menu');
    case 'bench': return '';
  }
}
const panel = $('panel');
let panelKey = '';
function renderPanel() {
  const key = `${screen}|${world.state}|${settingsOpen}|${panelRev}`;
  if (key === panelKey) return;
  panelKey = key;
  const html = panelHtml();
  panel.innerHTML = html;
  panel.style.display = html ? 'flex' : 'none';
  if (!settingsOpen) (panel.querySelector<HTMLElement>('#lbname') ?? panel.querySelector('button'))?.focus();
}
let tapPause = false; // nút trên menu gửi 1 cạnh pause cho sim
panel.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (b?.dataset.key) { rebinding = b.dataset.key as Action; panelRev++; return; }
  const act = b?.dataset.act;
  if (act === 'start') { total = 0; nightsWon = 0; savedName = false; runSeed = newSeed(); startNight(1, 'intro'); }
  else if (act === 'board') { screen = 'board'; loadBoard(); }
  else if (act === 'save') submitName();
  else if (act === 'keys-reset') { settings.keys = { ...DEFAULT_KEYS }; saveSettings(); applyPalette(); panelRev++; }
  else if (act === 'play') { screen = 'play'; acc = 0; }
  else if (act === 'resume') tapPause = true;
  else if (act === 'retry') startNight(night, 'play');
  else if (act === 'next') { if (hasNight(night + 1)) startNight(night + 1, 'intro'); else screen = 'dawn'; }
  else if (act === 'menu') screen = 'menu';
  else if (act === 'settings') settingsOpen = true;
  else if (act === 'back') settingsOpen = false;
});
panel.addEventListener('input', (e) => {
  const el = e.target as HTMLInputElement;
  if (el.id === 'vol') setVolume((settings.vol = +el.value));
  if (el.id === 'sens') settings.sens = +el.value;
  if (el.id === 'cb' || el.id === 'rm' || el.id === 'big') { settings[el.id] = el.checked; applyPalette(); }
  if (el.id === 'lbname') return; // ô tên không phải cài đặt
  if (el.id === 'theme') { // dựng lại cảnh bằng cách tải lại trang; bỏ ?theme= để lựa chọn có hiệu lực
    settings.theme = el.value;
    saveSettings();
    const u = new URL(location.href);
    u.searchParams.delete('theme');
    location.replace(u.href);
    return;
  }
  saveSettings();
});

// --- Điều khiển ---
const keys = new Set<string>();
const k = (c: string) => (keys.has(c) ? 1 : 0);
let yaw = 0, dragging = false, dragX = 0, acc = 0, last = performance.now();
addEventListener('keydown', (e) => {
  if (rebinding) { // đang đổi phím: phím này là phím mới (Esc = hủy)
    e.preventDefault();
    if (e.code !== 'Escape') { settings.keys[rebinding] = e.code; saveSettings(); applyPalette(); }
    rebinding = null;
    panelRev++;
    return;
  }
  if ((e.target as HTMLElement).id === 'lbname') { if (e.code === 'Enter') submitName(); return; } // đang gõ tên
  if ((e.target as HTMLElement).tagName === 'SELECT') return; // ô Giao diện: mũi tên/Space dùng để chọn, không điều khiển Mây
  unlockAudio();
  if (e.code === 'Space' || e.code.startsWith('Arrow') || Object.values(settings.keys).includes(e.code)) e.preventDefault();
  keys.add(e.code); // e.code, không phải e.key: bộ gõ Telex/VNI không làm lệch phím
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('pointerdown', unlockAudio);
addEventListener('blur', () => { keys.clear(); dragging = false; if (!BENCH && screen === 'play' && world.state === 'playing') tapPause = true; });
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { dragging = true; dragX = e.clientX; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointercancel', () => (dragging = false));
cv.addEventListener('pointerup', () => (dragging = false));
cv.addEventListener('pointermove', (e) => { if (dragging) { yaw -= (e.clientX - dragX) * settings.sens; dragX = e.clientX; } }); // kéo phải = quay phải

// Sim: θ tăng thì hướng trước (sinθ, cosθ) quay sang TRÁI màn hình, và x = +1 đi sang trái màn hình
// (camera nhìn theo +Z có phải-màn-hình = −X). Nên A → x = +1, D → x = −1; kéo phải / → giảm yaw.
const kb = (a: Action) => k(settings.keys[a]);
const readInput = (): Input => ({
  move: [kb('left') - kb('right'), kb('up') - kb('down')],
  cam_yaw_deg: yaw,
  jump: kb('jump') === 1,
  interact: kb('interact') === 1,
  pulse: kb('pulse') === 1,
  dash: kb('dash') === 1,
  pause: kb('pause') === 1 || keys.has('Escape') || tapPause,
});

// --- HUD ---
const hud = $('hud'), flash = $('flash'), arrow = $('arrow'), sarrow = $('sarrow'), cuesEl = $('cues');
const moteSlots = Array.from({ length: T.capacity_max }, () => $('motebar').appendChild(document.createElement('i')));
const carryText = $('motebar').appendChild(document.createElement('b'));
const cdDash = $('cd-dash'), cdPulse = $('cd-pulse');
const cdStyle = (el: HTMLElement, left: number, total: number) =>
  (el.style.background = left > 0 ? `conic-gradient(#0E1430dd ${(left / total) * 360}deg, #FFB34755 0)` : '');
const tmp = new THREE.Vector3();
const costOf = (l: Lantern) => (l.everLit ? T.relight_cost : T.lantern_cost);
let lastBeep = -1;
// Phụ đề / chỉ báo hình (Ticket-04 §4): dòng theo sự kiện (có hạn) + dòng theo trạng thái (mỗi khung).
const timedCues = new Map<string, { text: string; cls: string; until: number }>();
const cue = (key: string, text: string, secs: number, cls = 'warn') => timedCues.set(key, { text, cls, until: performance.now() / 1000 + secs });
let cuesHtml = '', windCue = '', shadeAlert = { id: '', until: 0 };
// Mũi tên ở mép màn hình chỉ tới `pos` khi nó nằm ngoài khung nhìn.
function edgeArrow(el: HTMLElement, pos: Vec3 | null) {
  el.style.display = 'none';
  if (!pos) return;
  tmp.set(...pos).project(camera);
  if (tmp.z <= 1 && Math.abs(tmp.x) <= 1 && Math.abs(tmp.y) <= 1) return;
  tmp.set(...pos).applyMatrix4(camera.matrixWorldInverse);
  const a = Math.atan2(tmp.y, tmp.x), cx = Math.cos(a), cy = Math.sin(a), sc = 0.88 / Math.max(Math.abs(cx), Math.abs(cy));
  el.style.display = 'block';
  el.style.left = `${((cx * sc + 1) / 2) * innerWidth - 13}px`;
  el.style.top = `${((1 - cy * sc) / 2) * innerHeight - 13}px`;
  el.style.transform = `rotate(${-a}rad)`;
}

function drawHud(w: World) {
  const p = w.player, t = w.simTick, lit = w.lanterns.filter((l) => l.lit).length;
  $('flames').innerHTML = Array.from({ length: T.flames }, (_, i) => `<i class="fl${i < p.flames ? '' : ' off'}"></i>`).join('');
  const s = Math.ceil(Math.max(0, w.ticksLeft) / TPS);
  const timer = $('timer');
  timer.textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  timer.classList.toggle('danger', s <= 30);
  $('tr').innerHTML = `Đèn <b>${lit}/${w.map.lanterns.length}</b> <small>(cần ${needLit(w.lanterns.length)})</small><br>Điểm <b>${w.score}</b><br><small>Tổng ${total}</small>`;
  const cap = capacityOf(p);
  moteSlots.forEach((el, i) => { el.classList.toggle('on', i < p.carried); el.style.display = i < cap ? '' : 'none'; });
  carryText.textContent = `${p.carried}/${cap}`;
  const charm = t < p.charmUntil;
  cdStyle(cdDash, charm ? 0 : p.dashCdUntil - t, R.dash_cd_ticks);
  cdDash.classList.toggle('charm', charm);
  cdDash.textContent = charm ? `Bùa ${Math.ceil((p.charmUntil - t) / TPS)}s` : 'Lướt';
  cdStyle(cdPulse, p.pulseCdUntil - t, R.pulse_cd_ticks);
  cdPulse.classList.toggle('off', p.carried < T.pulse_cost);
  // Cùng cách chọn đèn như sim: chỉ đèn nhận được (chưa sáng, hoặc sáng mà chưa đầy dầu), gần nhất.
  const near = w.lanterns.filter((l) => (!l.lit || fuelOf(l) < T.fuel_max) && distXZ(l.pos, p.pos) <= T.interact_radius)
    .sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos))[0];
  $('prompt').textContent = near ? (near.lit ? 'E — Châm dầu' : `E — Nạp ánh sáng (${near.deposited}/${costOf(near)})`)
    : p.carried >= cap ? 'Túi đầy – mang tới Đèn Lồng để nạp' : '';

  // Mũi tên tới đèn chưa sáng gần nhất khi đèn ở ngoài màn hình.
  const target = w.lanterns.filter((l) => !l.lit).sort((a, b) => distXZ(a.pos, p.pos) - distXZ(b.pos, p.pos))[0];
  edgeArrow(arrow, target ? [target.pos[0], target.pos[1] + 2.75, target.pos[2]] : null);
  const nowS = performance.now() / 1000;
  const sh = nowS < shadeAlert.until ? w.shades.find((x) => x.id === shadeAlert.id) : undefined; // Bóng Mực vừa xuất hiện
  edgeArrow(sarrow, sh ? [sh.pos[0], sh.pos[1] + 0.8, sh.pos[2]] : null);
  if (w.state === 'playing' && s <= 10 && s !== lastBeep) { lastBeep = s; sfx.tick(); }

  const lines: [string, string][] = [];
  if (windCue) lines.push([windCue, 'wind']);
  if (w.state === 'playing' && s <= 10) lines.push([`Còn ${s} giây tới bình minh!`, 'danger']);
  const low = w.lanterns.filter((l) => l.lit && fuelOf(l) < T.low_fuel_threshold).map((l) => l.id);
  if (low.length) lines.push([`Đèn sắp cạn dầu: ${low.join(', ')}`, 'warn']);
  for (const [key, c] of timedCues) if (c.until < nowS) timedCues.delete(key); else lines.push([c.text, c.cls]);
  const html = lines.map(([t, c]) => `<div class="${c}">${t}</div>`).join('');
  if (html !== cuesHtml) cuesEl.innerHTML = cuesHtml = html;
  skin?.hud();
}

// --- Vẽ thế giới ---
let camY = 0;
function draw(now: number, dt: number) {
  const w = world, p = w.player, t = w.simTick, [px, py, pz] = p.pos;
  const f = w.lanterns.filter((l) => l.lit).length / w.lanterns.length;
  ambient.intensity = 0.15 + 0.55 * f;
  fog.density = 0.018 - 0.008 * f;

  player.position.set(px, py, pz);
  player.rotation.y = Math.atan2(p.facing[0], p.facing[1]);
  player.scale.z = t < p.dashUntil ? 1.4 : 1;
  player.visible = w.state !== 'playing' || t >= p.invulnUntil || settings.rm || Math.floor(now * 12) % 2 === 0;
  scarf.material.emissiveIntensity = t < p.charmUntil ? 1.5 + Math.sin(now * 10) : 0;

  const th = (yaw * Math.PI) / 180;
  camY += (py - camY) * Math.min(1, dt * 4); // bám độ cao tầng/bục êm, nhảy chỉ nhích nhẹ
  camera.position.set(px - Math.sin(th) * 9, camY + 6, pz - Math.cos(th) * 9);
  camera.lookAt(px, camY + 1, pz);
  camera.updateMatrixWorld();

  w.lanterns.forEach((l, i) => {
    const v = lv.lanterns[i], burst = Math.max(0, 1 - (now - v.litAt) / 1.2);
    v.g.position.set(...l.pos);
    const fuel = fuelOf(l), low = l.lit && fuel < T.low_fuel_threshold, off = low && Math.floor(now * 2) % 2 === 1; // nhấp nháy 1 Hz
    v.head.material.color.set(l.lit ? C.lit : C.unlit);
    v.head.material.emissiveIntensity = off ? 0.15 : l.lit ? 1.6 + 0.3 * Math.sin(now * 3 + i) : (0.6 * l.deposited) / costOf(l);
    v.head.scale.y = 1.25 * (settings.cb && !l.lit ? 0.8 : 1); // mù màu: đèn tắt xẹp 20% + giấy rách
    v.tears.forEach((m) => (m.visible = settings.cb && !l.lit));
    v.core.visible = l.lit && !off;
    v.light.intensity = (l.lit && !off ? 25 + 45 * (fuel / T.fuel_max) : 0) + (settings.rm ? 0 : 400 * burst); // giảm chuyển động: không chớp sáng
    v.pips.forEach((pip, j) => { pip.visible = !l.lit && j < costOf(l); pip.material.emissiveIntensity = j < l.deposited ? 3 : 0; });
    v.safe.visible = hasSafeZone(l);
    const frac = fuel / T.fuel_max;
    v.barBg.visible = v.bar.visible = l.lit && !off;
    v.bar.visible &&= frac > 0;
    v.bar.scale.set(BAR_W * frac, 0.12, 1);
    v.bar.center.set(0.5 / Math.max(frac, 1e-3), 0.5);
    v.bar.material.color.set(low ? (settings.cb ? 0xffffff : 0xff5a5f) : C.lit);
  });
  w.charms.forEach((c, i) => { const o = lv.charms[i]; o.visible = c.available; o.rotation.y = now * 2; o.position.y = c.pos[1] + 1 + 0.15 * Math.sin(now * 2); });
  lv.pads.forEach((m) => (m.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(now * 4)));

  sync(motes, w.motes, makeMote, (o, m) => {
    o.position.y += 0.6 + 0.15 * Math.sin(now * 3 + Number(m.id.slice(1)));
    o.visible = m.kind !== 'dropped' || m.expires - t > 120 || settings.rm || Math.floor(now * 8) % 2 === 0; // sắp tắt thì nhấp nháy
  });
  sync(shades, w.shades, makeShade, (o, s) => {
    const stunned = s.state === 'stunned', n = Number(s.id.slice(1));
    o.material.color.set(stunned ? C.stunned : C.shade);
    o.material.emissive.set(rimColor());
    o.material.opacity = stunned ? (settings.rm ? 0.5 : 0.45 + 0.25 * Math.sin(now * 25)) : 0.9;
    o.children[0].visible = !stunned;
    const grow = s.state === 'spawning' ? 0.4 : 1;
    o.scale.set(grow, grow * (1 + 0.08 * Math.sin(now * 4 + n)), grow);
    o.lookAt(px, s.pos[1], pz);
  });

  const lines = drainGeo.getAttribute('position') as THREE.BufferAttribute;
  let nLines = 0;
  for (const s of w.shades) {
    const l = s.state === 'drain' && nLines < 32 ? w.lanterns.find((x) => x.id === s.target) : undefined;
    if (!l) continue;
    lines.setXYZ(nLines * 2, s.pos[0], s.pos[1], s.pos[2]);
    lines.setXYZ(nLines * 2 + 1, l.pos[0], l.pos[1] + 2.75, l.pos[2]);
    nLines++;
  }
  lines.needsUpdate = true;
  drainGeo.setDrawRange(0, nLines * 2);

  // Gió Lạc
  const pos = ribbonGeo.getAttribute('position') as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setZ(i, ribbonBase[i * 3 + 2] + 0.25 * Math.sin(ribbonBase[i * 3 + 1] * 3 + now * 7));
  pos.needsUpdate = true;
  sync(drifters, w.drifters.filter((d) => d.state !== 'removed'), makeDrifter, (o, d) => {
    o.rotation.y = Math.atan2(d.dir[0], d.dir[1]) + 0.3 * Math.sin(now * 2 + Number(d.id.slice(1)));
    o.position.y += 0.2 * Math.sin(now * 3);
    o.getObjectByName('loot')!.visible = d.stolen > 0;
  });

  // Gió: vệt theo hướng gió khi có cơn; 2 s trước cơn thì vệt lưa thưa xoáy nhẹ (chưa biết hướng).
  const gust = w.windEnabled && t < w.windUntil, warn = w.windEnabled && !gust && t % R.wind_every >= R.wind_every - 120;
  windLines.visible = gust || warn;
  if (windLines.visible) {
    const a = (w.windDir * Math.PI) / 180, dx = gust ? Math.cos(a) : Math.cos(now), dz = gust ? Math.sin(a) : Math.sin(now);
    const v = gust ? 16 : 3, len = gust ? 1.6 : 0.5, wp = windGeo.getAttribute('position') as THREE.BufferAttribute;
    for (let i = 0; i < WIND_N; i++) {
      const b = i * 3;
      windBase[b] = ((windBase[b] + dx * v * dt + 60) % 40) - 20; // quấn trong ô 40 m quanh Mây
      windBase[b + 2] = ((windBase[b + 2] + dz * v * dt + 60) % 40) - 20;
      const x = px + windBase[b], y = camY + windBase[b + 1], z = pz + windBase[b + 2];
      wp.setXYZ(i * 2, x, y, z);
      wp.setXYZ(i * 2 + 1, x - dx * len, y, z - dz * len);
    }
    wp.needsUpdate = true;
    windMat.opacity = gust ? 0.55 : 0.25;
  }
  windCue = gust ? 'Gió mạnh! Đứng vững' : warn ? 'Gió sắp thổi!' : '';

  const pa = (now - pulseAt) / 0.6;
  pulseRing.visible = pa < 1;
  if (pulseRing.visible) {
    const s = T.pulse_radius * (1 - (1 - pa) ** 3);
    pulseRing.scale.set(s, 1, s);
    pulseRing.material.opacity = 1 - pa;
  }
  playerLight.intensity = 15 + 120 * Math.max(0, 1 - pa);
  flash.style.opacity = settings.rm ? '0' : String(Math.max(0, 1 - (now - hitAt) / 0.6)); // giảm chuyển động: không chớp màn hình
  skin?.draw(w, now, { player, lanterns: lv.lanterns, motes, shades, terrain: lv.terrain, islands: ISLANDS[w.night] ?? ISLANDS[1], bridges: BRIDGES[w.night] ?? [] });
}

// --- FPS (?fps): trung bình 5 giây ---
const showFps = new URLSearchParams(location.search).has('fps');
let fpsFrames = 0, fpsStart = performance.now();

// --- Benchmark: 3 s khởi động rồi đo đúng `duration` giây; dt lấy giữa hai lần gọi rAF liên tiếp ---
const benchMs = Number(params.get('duration') ?? 30) * 1000, WARM_MS = 3000;
let benchT0 = -1, benchPrev = 0;
const benchDts: number[] = [];
const post = (path: string, body: unknown) => fetch(path, { method: 'POST', body: JSON.stringify(body) }).catch(() => { /* chạy tay bằng vite dev: không có server bench */ });
function glName() {
  const gl = renderer.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
  return `WebGL${renderer.capabilities.isWebGL2 ? 2 : 1} ${ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`;
}
// Bước sim cố định 60 Hz không input (bench tắt sát thương/nhặt/hao dầu/kết thúc trong sim). Trả true khi đo xong.
function benchFrame(ms: number, dt: number): boolean {
  if (benchT0 < 0) { benchT0 = benchPrev = ms; post('/bench/first', {}); }
  const t = ms - benchT0;
  if (t >= WARM_MS) benchDts.push(ms - benchPrev);
  benchPrev = ms;
  if (t >= WARM_MS + benchMs) {
    post('/bench/result', { dts: benchDts, renderer: glName() });
    console.log(`bench: ${benchDts.length} khung, TB ${((1000 * benchDts.length) / benchDts.reduce((a, b) => a + b, 0)).toFixed(1)} FPS`);
    return true;
  }
  acc += dt;
  for (let n = 0; acc >= 1 / TPS && n < 5; n++, acc -= 1 / TPS) step(world, idleInput());
  if (acc >= 1 / TPS) acc = 0;
  return false;
}
// Camera bay vòng: tâm (0,0,0), r 30 m, Y 15 m, bắt đầu ở (30,15,0), ngược chiều kim đồng hồ nhìn từ trên (quay dương quanh +Y), 15 s/vòng.
function orbitCamera(ms: number) {
  const a = (((ms - benchT0) / 15000) % 1) * Math.PI * 2;
  camera.position.set(30 * Math.cos(a), 15, -30 * Math.sin(a));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}

// --- Vòng lặp: bước cố định 60 Hz, tối đa 5 bước mỗi khung hình ---
function frame(ms: number) {
  const dt = Math.min((ms - last) / 1000, 0.25), now = ms / 1000;
  last = ms;
  yaw += (kb('camL') - kb('camR')) * 120 * dt + (screen === 'play' || settings.rm ? 0 : 6 * dt);
  if (screen === 'play') {
    acc += dt;
    for (let n = 0; acc >= 1 / TPS && n < 5; n++, acc -= 1 / TPS) {
      const wasGrounded = world.player.grounded;
      const evs = step(world, readInput());
      tapPause = false;
      if (wasGrounded && !world.player.grounded && world.player.vel[1] > 0) sfx.jump();
      if (world.windUntil === world.simTick + R.wind_ticks) sfx.wind(); // cơn gió vừa nổi tick này
      for (const e of evs) {
        if (e.name === 'pulse') { pulseAt = now; sfx.pulse(); pulseRing.position.set(world.player.pos[0], world.player.pos[1] + 0.08, world.player.pos[2]); }
        else if (e.name === 'player_hit') { hitAt = now; sfx.hit(); cue('hit', 'Mất 1 Ngọn Lửa!', 2, 'danger'); }
        else if (e.name === 'lantern_out') cue(`out-${e.data.lantern_id}`, `Đèn ${e.data.lantern_id} đã tắt!`, 3, 'danger');
        else if (e.name === 'lantern_lit') { lv.lanterns[world.lanterns.findIndex((l) => l.id === e.data.lantern_id)].litAt = now; sfx.lit(); }
        else if (e.name === 'mote_picked') sfx.pickup();
        else if (e.name === 'dash') sfx.dash();
        else if (e.name === 'charm_picked') sfx.charm();
        else if (e.name === 'shade_spawned') { sfx.shade(); cue('shade', 'Bóng Mực xuất hiện!', 3, 'danger'); shadeAlert = { id: String(e.data.id), until: performance.now() / 1000 + 4 }; }
        else if (e.name === 'drifter_steal') sfx.steal();
        else if (e.name === 'game_over') {
          screen = 'result';
          endReason = String(e.data.reason); // dawn_survived | dawn | no_flames
          if (e.data.result === 'won') { total += world.score; nightsWon++; sfx.win(); } else sfx.lose();
        }
      }
    }
    if (acc >= 1 / TPS) acc = 0; // ponytail: bỏ phần dồn khi máy chậm thay vì đuổi theo
  }
  if (BENCH && benchFrame(ms, dt)) return;
  draw(now, dt);
  if (BENCH) orbitCamera(ms);
  hud.style.display = screen === 'play' ? 'block' : 'none';
  if (screen === 'play') drawHud(world);
  renderPanel();
  renderer.render(scene, camera);
  if (showFps && ++fpsFrames && ms - fpsStart >= 5000) {
    $('fps').textContent = `${((fpsFrames * 1000) / (ms - fpsStart)).toFixed(1)} FPS (TB 5 s)`;
    fpsFrames = 0;
    fpsStart = ms;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
