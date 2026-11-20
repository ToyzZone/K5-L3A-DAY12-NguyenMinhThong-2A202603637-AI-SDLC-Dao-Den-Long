// Giao diện 3D: chỉ dựng Input mỗi tick và vẽ World. Luật nằm hết trong src/sim/game.ts.
import * as THREE from 'three';
import { createWorld, step, isStunned, distXZ, type Input, type Vec3, type World } from '../sim/game.js';
import { TUNING as T, WORLD as W, TPS } from '../sim/tuning.js';

const $ = (id: string) => document.getElementById(id)!;
const newSeed = () => Math.floor(Math.random() * 2 ** 31);
let world: World = createWorld(newSeed());

// --- Cảnh, đèn, sương ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x07050f);
const fog = new THREE.FogExp2(0x07050f, 0.025);
scene.fog = fog;
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize);
resize();

const COLD = new THREE.Color(0x7a6ad0), WARM = new THREE.Color(0xffc27a);
const hemi = new THREE.HemisphereLight(COLD, 0x3a2410, 2);
const moon = new THREE.DirectionalLight(0x8090ff, 1.5);
moon.position.set(-20, 30, -10);
scene.add(hemi, moon);

const std = (color: number, emissive = 0, ei = 1, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85, ...extra });
const flat = (color: number, opacity: number) =>
  new THREE.MeshBasicMaterial({ color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false });
function add<M extends THREE.Material>(g: THREE.BufferGeometry, m: M, parent: THREE.Object3D = scene, x = 0, y = 0, z = 0) {
  const o = new THREE.Mesh(g, m);
  o.position.set(x, y, z);
  parent.add(o);
  return o;
}
const ring = (r0: number, r1: number) => new THREE.RingGeometry(r0, r1, 64).rotateX(-Math.PI / 2);

// Đảo tròn trên biển mây.
add(new THREE.CylinderGeometry(W.island_radius, W.island_radius * 0.85, 3, 64), std(0x4a5a36), scene, 0, -1.5, 0);
add(ring(W.island_radius - 0.6, W.island_radius), flat(0xffb060, 0.12), scene, 0, 0.02, 0);
add(new THREE.PlaneGeometry(600, 600).rotateX(-Math.PI / 2), std(0x1c1636), scene, 0, -7, 0);
const cloudGeo = new THREE.SphereGeometry(1, 12, 8), cloudMat = std(0x3a3060, 0x221a40, 0.6);
for (let i = 0; i < 70; i++) {
  const a = Math.random() * Math.PI * 2, r = 46 + Math.random() * 90, s = 4 + Math.random() * 8;
  add(cloudGeo, cloudMat, scene, Math.sin(a) * r, -6 + Math.random() * 2, Math.cos(a) * r).scale.set(s * 1.6, s * 0.4, s);
}
const starPos = Array.from({ length: 700 * 3 }, (_, i) => {
  const k = Math.floor(i / 3), a = k * 2.399, y = 0.15 + 0.85 * ((k * 0.618) % 1);
  return [Math.cos(a) * Math.sqrt(1 - y * y), y, Math.sin(a) * Math.sqrt(1 - y * y)][i % 3] * 300;
});
scene.add(new THREE.Points(
  new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3)),
  new THREE.PointsMaterial({ color: 0xfff0d0, size: 2, sizeAttenuation: false, fog: false }),
));

// --- Mây: thân, đầu, nón lá, đèn nhỏ treo vành nón ---
const player = new THREE.Group();
scene.add(player);
add(new THREE.CapsuleGeometry(0.35, 0.6, 4, 12), std(0xf4e6c8), player, 0, 0.65, 0);
add(new THREE.SphereGeometry(0.28, 16, 12), std(0xffd9b0), player, 0, 1.35, 0);
add(new THREE.ConeGeometry(0.95, 0.45, 28), std(0xe8c27a), player, 0, 1.68, 0);
add(new THREE.CylinderGeometry(0.012, 0.012, 0.3), std(0x553311), player, 0.55, 1.31, 0.55);
const hatLantern = add(new THREE.SphereGeometry(0.11, 12, 8), std(0xffa040, 0xff8a20, 3), player, 0.55, 1.1, 0.55);
const playerLight = new THREE.PointLight(0xffaa55, 15, 14);
playerLight.position.copy(hatLantern.position);
player.add(playerLight);

// --- Đèn Lồng: cột + đầu đèn + 5 hạt tiến độ + vùng an toàn ---
const lanternViews = world.lanterns.map(() => {
  const g = new THREE.Group();
  scene.add(g);
  add(new THREE.CylinderGeometry(0.1, 0.14, 2.4, 8), std(0x3a2a1a), g, 0, 1.2, 0);
  const head = add(new THREE.SphereGeometry(0.38, 16, 12), std(0x666666, 0xff8a2a, 0), g, 0, 2.75, 0);
  head.scale.y = 1.25;
  const light = new THREE.PointLight(0xffa64d, 0, 24);
  light.position.y = 2.75;
  g.add(light);
  const pips = Array.from({ length: T.lantern_cost }, (_, i) => {
    const a = (i / T.lantern_cost) * Math.PI * 2;
    return add(new THREE.SphereGeometry(0.08, 8, 6), std(0x333333, 0xffc060, 0), g, Math.sin(a) * 0.6, 3.45, Math.cos(a) * 0.6);
  });
  const safe = add(ring(T.safe_radius - 0.12, T.safe_radius), flat(0xffb050, 0.3), g, 0, 0.04, 0);
  return { g, head, light, pips, safe, litAt: -9 };
});

// --- Hạt sáng & Bóng Mực: mesh theo id ---
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
const moteGeo = new THREE.SphereGeometry(0.18, 10, 8), moteMat = new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false });
const motes = new Map<string, THREE.Mesh>();
const shadeGeo = new THREE.SphereGeometry(0.8, 20, 14), eyeGeo = new THREE.SphereGeometry(0.09, 8, 6), eyeMat = new THREE.MeshBasicMaterial({ color: 0xd080ff });
const shades = new Map<string, THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>>();
const makeShade = () => {
  const m = new THREE.Mesh(shadeGeo, std(0x1a0826, 0x5a1f8a, 0.7, { transparent: true, opacity: 0.85 }));
  add(eyeGeo, eyeMat, m, -0.25, 0.2, 0.72);
  add(eyeGeo, eyeMat, m, 0.25, 0.2, 0.72);
  return m;
};

// --- Hiệu ứng: vòng Tỏa sáng, chớp khi bị chạm ---
const pulseRing = add(ring(0.85, 1), flat(0xffc870, 1));
let pulseAt = -9, hitAt = -9;

// --- Điều khiển ---
const keys = new Set<string>();
const k = (c: string) => (keys.has(c) ? 1 : 0);
let yaw = 0, dragging = false, dragX = 0, acc = 0, last = performance.now();
addEventListener('keydown', (e) => {
  if (['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault();
  keys.add(e.code); // e.code, không phải e.key: bộ gõ Telex/VNI không làm lệch phím
  if (e.code === 'KeyR' && world.state !== 'playing') { world = createWorld(newSeed()); acc = 0; }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); dragging = false; });
const cv = renderer.domElement;
cv.addEventListener('pointerdown', (e) => { dragging = true; dragX = e.clientX; cv.setPointerCapture(e.pointerId); });
cv.addEventListener('pointercancel', () => (dragging = false));
cv.addEventListener('pointerup', () => (dragging = false));
cv.addEventListener('pointermove', (e) => { if (dragging) { yaw -= (e.clientX - dragX) * 0.3; dragX = e.clientX; } }); // kéo phải = quay phải

// Sim: θ tăng thì hướng trước (sinθ, cosθ) quay sang TRÁI màn hình, và x = +1 đi sang trái màn hình
// (camera nhìn theo +Z có phải-màn-hình = −X). Nên A → x = +1, D → x = −1; kéo phải / → giảm yaw.
const readInput = (): Input => ({
  move: [k('KeyA') - k('KeyD'), k('KeyW') - k('KeyS')],
  cam_yaw_deg: yaw,
  jump: keys.has('Space'),
  interact: keys.has('KeyE'),
  pulse: keys.has('KeyF'),
  dash: false,
});

// --- Vẽ ---
const hud = $('hud'), prompt = $('prompt'), end = $('end'), flash = $('flash');
const REASON: Record<string, string> = { all_lit: 'Đã thắp hết đèn', no_flames: 'Hết Flame', dawn: 'Trời đã sáng' };
let lastPos: Vec3 = [0, 0, 0];

function draw(now: number) {
  const w = world, p = w.player, [px, py, pz] = p.pos;
  const lit = w.lanterns.filter((l) => l.lit).length, f = lit / w.lanterns.length;
  hemi.intensity = 2 + 4 * f; // đảo sáng dần theo số đèn đã thắp
  hemi.color.lerpColors(COLD, WARM, f);
  fog.density = 0.025 - 0.013 * f;

  player.position.set(px, py, pz);
  if (Math.hypot(px - lastPos[0], pz - lastPos[2]) > 1e-4) player.rotation.y = Math.atan2(px - lastPos[0], pz - lastPos[2]);
  lastPos = [px, py, pz];
  player.visible = w.state !== 'playing' || w.tick >= p.invulnUntil || Math.floor(now * 12) % 2 === 0;

  const th = (yaw * Math.PI) / 180;
  camera.position.set(px - Math.sin(th) * 9, 6 + py * 0.3, pz - Math.cos(th) * 9);
  camera.lookAt(px, 1 + py * 0.3, pz);

  w.lanterns.forEach((l, i) => {
    const v = lanternViews[i], burst = Math.max(0, 1 - (now - v.litAt) / 1.2);
    v.g.position.set(...l.pos);
    v.head.material.color.set(l.lit ? 0xffb060 : 0x666666);
    v.head.material.emissiveIntensity = l.lit ? 2.5 + 0.3 * Math.sin(now * 3 + i) : (0.6 * l.deposited) / T.lantern_cost;
    v.light.intensity = (l.lit ? 70 : 0) + 400 * burst;
    v.pips.forEach((pip, j) => (pip.material.emissiveIntensity = j < l.deposited ? 3 : 0));
    v.safe.visible = l.lit;
  });

  sync(motes, w.motes, () => new THREE.Mesh(moteGeo, moteMat), (o, m) => {
    o.position.y = 0.6 + 0.15 * Math.sin(now * 3 + Number(m.id.slice(1)));
  });
  sync(shades, w.shades, makeShade, (o, s) => {
    const stunned = isStunned(s, w.tick), n = Number(s.id.slice(1));
    o.material.color.set(stunned ? 0xb8a0d8 : 0x1a0826);
    o.material.emissiveIntensity = stunned ? 0.15 : 0.7;
    o.material.opacity = stunned ? 0.3 + 0.2 * Math.sin(now * 25) : 0.85;
    o.scale.set(1, 1 + 0.08 * Math.sin(now * 4 + n), 1);
    o.lookAt(px, 1, pz);
  });

  const pa = (now - pulseAt) / 0.6;
  pulseRing.visible = pa < 1;
  if (pulseRing.visible) {
    const s = T.pulse_radius * (1 - (1 - pa) ** 3);
    pulseRing.scale.set(s, 1, s);
    pulseRing.material.opacity = 1 - pa;
  }
  playerLight.intensity = 15 + 120 * Math.max(0, 1 - pa);
  flash.style.opacity = String(Math.max(0, 1 - (now - hitAt) / 0.6));

  const s = Math.ceil(Math.max(0, w.ticksLeft) / TPS);
  const pulse = p.carried < T.pulse_cost ? 'Thiếu ánh sáng' : w.tick < p.pulseReadyAt ? 'Đang hồi' : 'Sẵn sàng';
  hud.innerHTML = `Flame: <b>${p.flames}</b><br>Ánh sáng: <b>${p.carried}/${T.carry_capacity}</b><br>` +
    `Đèn đã thắp: <b>${lit}/${w.lanterns.length}</b><br>Thời gian: <b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}</b><br>` +
    `Điểm: <b>${w.score}</b><br>Tỏa sáng (F): <b>${pulse}</b>`;
  const near = w.lanterns.find((l) => !l.lit && distXZ(l.pos, p.pos) <= T.interact_radius);
  prompt.innerHTML = [
    p.carried === T.carry_capacity && 'Túi đầy – mang tới Đèn Lồng để nạp',
    near && `E: nạp đèn (${near.deposited}/${T.lantern_cost})`,
  ].filter(Boolean).join('<br>');
  end.style.display = w.state === 'playing' ? 'none' : 'flex';
  if (w.state !== 'playing') {
    $('end-title').textContent = w.state === 'won' ? 'Thắng!' : 'Thua';
    $('end-reason').textContent = REASON[w.state === 'won' ? 'all_lit' : p.flames <= 0 ? 'no_flames' : 'dawn'];
    $('end-score').textContent = `Điểm: ${w.score}`;
  }
}

// --- Vòng lặp: bước cố định 60 Hz, tối đa 5 bước mỗi khung hình ---
function frame(ms: number) {
  const dt = Math.min((ms - last) / 1000, 0.25), now = ms / 1000;
  last = ms;
  acc += dt;
  yaw += (k('ArrowLeft') - k('ArrowRight')) * 120 * dt;
  for (let n = 0; acc >= 1 / TPS && n < 5; n++, acc -= 1 / TPS) {
    for (const e of step(world, readInput())) {
      if (e.name === 'pulse') { pulseAt = now; pulseRing.position.set(world.player.pos[0], 0.08, world.player.pos[2]); }
      else if (e.name === 'player_hit') hitAt = now;
      else if (e.name === 'lantern_lit') lanternViews[world.lanterns.findIndex((l) => l.id === e.data.lantern_id)].litAt = now;
    }
  }
  if (acc >= 1 / TPS) acc = 0; // ponytail: bỏ phần dồn khi máy chậm thay vì đuổi theo
  draw(now);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
