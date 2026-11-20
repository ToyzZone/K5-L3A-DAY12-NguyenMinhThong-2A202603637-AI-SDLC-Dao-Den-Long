/// <reference types="vite/client" />
// Trang xem trước 3 giao diện: một góc đảo dựng sẵn, camera tự quay chậm. Không chạy sim.
// Đổi theme bằng ?theme=<key> (tải lại trang nên không cần dọn scene, nhạc tự dừng).
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { HUD_LABELS, THEMES, applyEnvironment, applyHud, makeCharm, makeDrifter, makeFireflies, makeJumpPad, makeLantern, makePlayer, makeShade } from './themes.js';

const $ = (id: string) => document.getElementById(id)!;
const theme = THEMES[new URLSearchParams(location.search).get('theme') ?? ''] ?? THEMES.sonmai;

// Ghi công chỉ nằm ở trang xem trước, không vào cảnh 3D hay HUD.
const CREDIT: Record<string, string> = {
  chayshow: 'Chạy Show: ca sĩ cách điệu chung (không phải chân dung người thật), fan đom đóm giơ tim, mỗi đèn là một sân khấu, antifan chê chung chung; trong game khi chạy dev có thêm câu riêng từ music/memes.json (không nằm trong repo). Không dùng hình, logo hay lời bài hát. Nhạc chỉ phát khi chạy dev (vite) và có file music/nhac-nen.mp3 do bạn tự đặt; bản build không phát nhạc.',
};

applyHud(theme);
$('tabs').innerHTML = Object.values(THEMES).map((t) => `<a href="?theme=${t.key}"${t === theme ? ' aria-current="page"' : ''}>${t.name}</a>`).join('');
$('blurb').textContent = theme.blurb;
if (CREDIT[theme.key]) { $('credit').textContent = CREDIT[theme.key]; $('credit').hidden = false; }

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 500);
camera.position.set(16, 9, 18);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(1, 1.2, 0);
controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
controls.autoRotateSpeed = 0.35;
controls.enableDamping = true;
controls.maxPolarAngle = 1.5;
controls.minDistance = 5;
controls.maxDistance = 70;
const resize = () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); };
addEventListener('resize', resize);
resize();

// Bố cục: đảo r=16 và đảo nhỏ r=9 nối bằng cầu tre (giống Đêm 2, thu nhỏ).
const P = { player: [0, 0], lit: [-6, 4], half: [6, -5], shade: [8, 7], drain: [-4.2, 4.85], pad: [11, -4], drifter: [4, 10], charm: [2, -6] };
const env = applyEnvironment(scene, renderer, theme, [{ cx: 0, cz: 0, r: 16 }, { cx: 35, cz: 0, r: 9 }], [{ x0: 14, x1: 28, z0: -2, z1: 2 }],
  Object.values(P).map(([x, z]) => ({ x, z })));
const place = <T extends { group: THREE.Object3D }>(o: T, [x, z]: number[]) => { o.group.position.set(x, 0, z); scene.add(o.group); return o; };
const player = place(makePlayer(theme), P.player);
const lit = place(makeLantern(theme), P.lit);
lit.setLit(true);
lit.burst(0.4);
const half = place(makeLantern(theme), P.half);
half.setProgress(5, 10);
const shade = place(makeShade(theme), P.shade);
const drainer = place(makeShade(theme), P.drain);
drainer.group.lookAt(P.lit[0], 0, P.lit[1]);
const pad = place(makeJumpPad(theme), P.pad);
const drifter = place(makeDrifter(theme), P.drifter);
drifter.group.rotation.y = 2.2;
const charm = place(makeCharm(theme), P.charm);
const motes = makeFireflies(theme, 32);
motes.set(Array.from({ length: 15 }, (_, i) => { const a = i * 2.4, d = 3.5 + ((i * 3.7) % 10); return [Math.cos(a) * d, 0, Math.sin(a) * d]; }));
scene.add(motes.points);

const litIn = $('lit') as HTMLInputElement;
let litCount = 1;
const onLit = () => { litCount = +litIn.value; env.setBrightness(litCount / 5); $('lit-out').textContent = `${litCount}/5`; };
litIn.addEventListener('input', onLit);
onLit();

const endBtn = $('end-btn');
endBtn.addEventListener('click', () => {
  const on = $('end').style.display !== 'flex';
  $('end').style.display = on ? 'flex' : 'none';
  endBtn.textContent = on ? 'Ẩn màn kết thúc' : 'Xem màn kết thúc';
});

// Nhạc (chỉ theme có `music`, chỉ khi dev): bắt đầu ở lần bấm / gõ phím đầu tiên; thiếu file thì im lặng và ẩn nút.
const mute = $('mute') as HTMLButtonElement;
if (import.meta.env.DEV && theme.music) {
  const url = theme.music;
  let audio: HTMLAudioElement | undefined;
  const start = () => {
    if (audio) return;
    audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.5;
    const a = audio;
    a.addEventListener('error', () => (mute.hidden = true)); // thiếu file / không giải mã được
    a.play().catch(() => { if (!a.error) audio = undefined; }); // bị chặn autoplay: thử lại ở lần bấm sau
  };
  mute.hidden = false;
  addEventListener('pointerdown', start);
  addEventListener('keydown', start);
  mute.addEventListener('click', () => { start(); audio!.muted = !audio!.muted; mute.textContent = audio!.muted ? 'Bật nhạc' : 'Tắt nhạc'; });
}

// HUD giả: chữ thật như trong game; đồng hồ đếm 0:45 → 0:00 lặp lại để thấy trạng thái nguy hiểm (≤ 30 s).
const L = theme.hud.labels ?? HUD_LABELS, score = theme.hud.formatScore?.(1250) ?? '1250';
$('end-score').textContent = `${L.score}: ${score}`;
let hudText = '';
function drawHud(now: number) {
  const s = 45 - (Math.floor(now) % 46);
  const html = `${L.flame}: <b>3</b><br>${L.mote}: <b>4/10</b><span class="cells">${'<i class="on"></i>'.repeat(4)}${'<i></i>'.repeat(6)}</span><br>` +
    `${L.lantern}: <b>${litCount}/5</b><br>Thời gian: <b${s <= 30 ? ' class="danger"' : ''}>0:${String(s).padStart(2, '0')}</b><br>${L.score}: <b>${score}</b><br>Tỏa sáng (F): <b>Sẵn sàng</b>`;
  if (html !== hudText) $('hud').innerHTML = hudText = html;
}

let angle = 0, last = 0;
function render(ms: number) {
  const now = ms / 1000, dt = Math.min(0.1, now - last), moving = now % 10 < 6;
  last = now;
  if (moving) angle += dt * 0.9; // Mây đi vòng tròn bán kính 2 m, 6 s đi / 4 s đứng
  player.group.position.set(Math.cos(angle) * 2, 0, Math.sin(angle) * 2);
  player.group.rotation.y = Math.atan2(-Math.sin(angle), Math.cos(angle));
  player.update(now, moving);
  shade.group.lookAt(player.group.position.x, 0, player.group.position.z);
  // Bóng Mực thứ hai đổi 4 s một lần: hút dầu đèn (đèn yếu < 30%, nhấp nháy, mất vùng an toàn) ↔ bị Choáng.
  const draining = Math.floor(now / 4) % 2 === 0;
  drainer.setState(draining ? 'drain' : 'stunned');
  lit.setFuel(draining ? 0.28 - 0.02 * (now % 4) : 1);
  for (const o of [lit, half, shade, drainer, pad, drifter, charm, motes, env]) o.update(now);
  drawHud(now);
  controls.update(dt);
  renderer.render(scene, camera);
}
render(performance.now()); // vẽ ngay một khung, kể cả khi tab đang nền
renderer.setAnimationLoop(render);
