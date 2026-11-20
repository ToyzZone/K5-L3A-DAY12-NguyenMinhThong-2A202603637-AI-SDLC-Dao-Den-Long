/// <reference types="vite/client" />
// Giao diện thêm (sáng tạo, chỉ phần vẽ): phủ lên vật thể main.ts đã dựng, đọc World nhưng không đổi sim.
// Mỗi theme đổi cả môi trường (trời, đảo, cầu, biển mây, cây cỏ: applyEnvironment, mỗi Đêm một bộ) lẫn Mây, đèn, đom đóm, Bóng Mực.
// chayshow: Mây → ca sĩ, Đom đóm → fan, Đèn Lồng → sân khấu, Bóng Mực → antifan, nền giàn thiên lý (mặc định khi vite dev).
// sonmai: sơn mài (mặc định bản build). giaydo: giấy cắt. main.ts tắt hẳn khi ?bench hoặc theme 'classic'.
// Nhạc và câu meme đọc từ music/ (gitignore) và chỉ khi chạy vite dev; repo và bản build không chứa (RULES §8).
import * as THREE from 'three';
import { THEMES, HATER_LINES, applyEnvironment, makePlayer, makeLantern, makeShade, makeFireflies } from './themes.js';
import { fuelOf, type World } from '../sim/game.js';
import { TUNING as T } from '../sim/tuning.js';

interface LanternView { g: THREE.Group; head: THREE.Object3D; core: THREE.Object3D; pips: THREE.Object3D[]; tears: THREE.Object3D[]; safe: THREE.Object3D; light: THREE.PointLight; litAt: number }
export interface Views {
  player: THREE.Group; lanterns: LanternView[]; motes: Map<string, THREE.Object3D>; shades: Map<string, THREE.Object3D>;
  terrain: THREE.Object3D[]; islands: [cx: number, r: number][]; bridges: { x0: number; x1: number; z0: number; z1: number }[];
}
interface Env { root: THREE.Scene; h: ReturnType<typeof applyEnvironment> }

// Cây cỏ chắn giữa camera và Mây thì khoét đi (discard trong shader) để Mây luôn thấy được.
// Chỉ khoét phần cao hơn chân Mây 0.15 m nên mặt đảo, cầu, biển mây không thủng.
const cutAt = { value: new THREE.Vector3() }; // ngực Mây, cập nhật mỗi khung
const patched = new WeakSet<THREE.Material>();
function cutaway<M extends THREE.Material>(m: M): M {
  if (patched.has(m)) return m;
  patched.add(m);
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCut = cutAt;
    sh.vertexShader = 'varying vec3 vCutW;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 cutW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cutW = instanceMatrix * cutW;
      #endif
      vCutW = (modelMatrix * cutW).xyz;`);
    sh.fragmentShader = 'uniform vec3 uCut;\nvarying vec3 vCutW;\n' + sh.fragmentShader.replace('void main() {', `void main() {
      vec3 ab = uCut - cameraPosition;
      float h = clamp(dot(vCutW - cameraPosition, ab) / dot(ab, ab), 0.0, 1.0);
      if (vCutW.y > uCut.y - 0.85 && h < 0.9 && length(vCutW - cameraPosition - ab * h) < 1.3) discard;`);
  };
  m.customProgramCacheKey = () => 'cutaway';
  return m;
}
function addCutaway(root: THREE.Object3D) {
  let ink: THREE.MeshBasicMaterial | undefined; // viền mực dùng chung với Mây: bản riêng cho cây cỏ
  root.traverse((o) => {
    const mesh = o as THREE.Mesh, m = mesh.material as THREE.Material;
    if (!mesh.isMesh || m instanceof THREE.ShaderMaterial) return;
    if (m instanceof THREE.MeshBasicMaterial && m.side === THREE.BackSide) mesh.material = ink ??= cutaway(m.clone());
    else cutaway(m);
  });
}

// Chỗ cây cỏ phải tránh: đèn, điểm xuất phát, bục nhảy, bùa, điểm sinh đom đóm / Bóng Mực, và mọi chỗ đất nhô cao (tầng, dốc Đêm 3).
function avoidSpots(w: World) {
  const pts = [...w.lanterns.map((l) => l.pos), w.map.start, ...w.map.pads.map((p) => p.pos), ...w.charms.map((c) => c.pos), ...w.map.motePoints, ...w.map.shadePoints];
  const out = pts.map((p) => ({ x: p[0], z: p[2] }));
  for (let x = -48; x <= 48; x += 3) for (let z = -48; z <= 48; z += 3) if ((w.map.ground(x, z) ?? 0) > 0.01) out.push({ x, z });
  return out;
}

export function createSkin(key: string | null, scene: THREE.Scene, renderer: THREE.WebGLRenderer, settings: { vol: number; rm?: boolean; cb?: boolean }, backdrop: THREE.Object3D[]) {
  const t = THEMES[key ?? (import.meta.env.DEV ? 'chayshow' : 'sonmai')] ?? THEMES.sonmai;
  for (const o of backdrop) o.visible = false; // biển, mây, sao, 3 đèn cổ điển: môi trường theme thay thế
  const envs = new Map<number, Env>();
  let active: Env | undefined;
  // Font HUD của theme: chỉ đổi họ chữ trên body, giữ nguyên mọi cỡ chữ của index.html (≥ 18 px, ×1.25 khi chữ lớn).
  const fam = /font-family: ([^;]+);/.exec(t.hud.css)?.[1];
  if (fam) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: t.hud.font }),
    Object.assign(document.createElement('style'), { textContent: `body { font-family: ${fam}; }` }));
  const L = t.hud.labels, money = t.hud.formatScore ?? String;
  const singer = makePlayer(t);
  singer.group.remove(singer.light); // giữ đèn của main.ts (chớp khi Tỏa sáng)
  const fans = makeFireflies(t, 64);
  scene.add(fans.points);
  const stages = new WeakMap<LanternView, { s: ReturnType<typeof makeLantern>; litAt: number }>();
  const antis = new WeakMap<THREE.Object3D, ReturnType<typeof makeShade>>();
  // Khởi động sẵn: một Bóng Mực/antifan vẽ khuất dưới đảo vài khung đầu, để lúc con đầu tiên xuất hiện không bị giật
  // (biên dịch shader + tải texture bong bóng mất ~100 ms ở lần đầu).
  const warm = makeShade(t);
  warm.group.position.set(0, -4, 0);
  warm.update(0);
  scene.add(warm.group);
  let frames = 0;

  // Câu meme riêng của người chơi: file gitignore, chỉ đọc khi dev; thiếu file thì chỉ có câu chung chung.
  if (import.meta.env.DEV && t.show) fetch('/music/memes.json').then((r) => r.json()).then((x: string[]) => void HATER_LINES.push(...x), () => {});
  let song: HTMLAudioElement | undefined;
  if (import.meta.env.DEV && t.music) {
    const a = (song = new Audio(t.music));
    a.loop = true;
    const start = () => void a.play().then(stop, () => { /* chưa có cử chỉ người dùng: thử lại lần sau */ });
    const stop = () => { removeEventListener('pointerdown', start); removeEventListener('keydown', start); };
    a.onerror = stop; // thiếu file music/nhac-nen.mp3 thì im lặng
    addEventListener('pointerdown', start);
    addEventListener('keydown', start);
  }

  return {
    key: t.key, // theme đã chọn thật (để Cài đặt đánh dấu đúng)
    /** Gọi cuối draw() của main.ts: ẩn hình mặc định, vẽ hình Chạy Show đúng vị trí/trạng thái main.ts vừa đặt. */
    draw(w: World, now: number, v: Views) {
      // ponytail: bật "Bảng màu dễ phân biệt" (Ticket-03 §6) thì nhường hẳn cho hình gốc của main.ts (đèn xẹp + giấy rách, viền xanh),
      // vì hình theme dùng màu cố định. Muốn theme cũng có bảng mù màu thì truyền settings.cb vào các builder của themes.ts.
      if (++frames === 3) scene.remove(warm.group);
      const on = !settings.cb, tm = settings.rm ? 0 : now; // giảm chuyển động: đứng yên phần trang trí; đèn vẫn nhấp nháy báo hết dầu
      let e = envs.get(w.night);
      if (!e) { // dựng một lần mỗi Đêm, trong Scene con riêng để bật/tắt theo Đêm
        const root = new THREE.Scene();
        const h = applyEnvironment(root, renderer, t, v.islands.map(([cx, r]) => ({ cx, cz: 0, r })), v.bridges, avoidSpots(w));
        addCutaway(root);
        scene.add(root);
        envs.set(w.night, (e = { root, h }));
      }
      if (e !== active) {
        for (const x of envs.values()) x.root.visible = x === e;
        scene.background = e.root.background;
        scene.fog = e.root.fog;
        scene.environment = e.root.environment;
        active = e;
      }
      cutAt.value.set(w.player.pos[0], w.player.pos[1] + 1, w.player.pos[2]);
      for (const o of v.terrain) o.visible = false; // đảo + cầu cổ điển; tầng/dốc/tháp Đêm 3 của main.ts giữ lại
      e.h.setBrightness(w.lanterns.filter((l) => l.lit).length / w.lanterns.length); // Ticket-02 §8: 0.15 + 0.55·đèn sáng/tổng
      scene.environmentIntensity = e.root.environmentIntensity;
      e.h.update(tm);
      if (singer.group.parent !== v.player) v.player.add(singer.group);
      v.player.children.forEach((c) => { if (!(c instanceof THREE.Light)) c.visible = (c === singer.group) === on; });
      singer.update(tm, Math.hypot(w.player.vel[0], w.player.vel[2]) > 0.1);

      w.lanterns.forEach((l, i) => {
        const lv = v.lanterns[i];
        let st = stages.get(lv);
        if (!st) {
          stages.set(lv, (st = { s: makeLantern(t, T.safe_radius), litAt: lv.litAt }));
          lv.g.add(st.s.group);
          st.s.group.remove(st.s.light); // dùng đèn của main.ts: không tăng số PointLight (quá nhiều thì shader vượt giới hạn uniform)
          // Đầu đèn / phông sân khấu sáng bằng texture: bỏ tone map, vì ACES ×1.4 của main.ts làm đèn sáng nhạt khỏi #FFB347 (Ticket-02 §8).
          st.s.group.traverse((o) => { const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined; if (m?.emissiveMap) m.toneMapped = false; });
          // ponytail: sân khấu quay về tâm đảo gần nhất (Đêm 2 có đảo B ở x = 70); đổi bản đồ thì sửa ở đây.
          st.s.group.rotation.y = Math.atan2((l.pos[0] > 35 ? 70 : 0) - l.pos[0], -l.pos[2]);
        }
        st.s.group.visible = on;
        lv.g.children[0].visible = lv.head.visible = !on; // cột + đầu đèn gốc: main.ts không tự bật lại
        if (!on) return; // main.ts tự lo hạt, lõi, vùng an toàn, giấy rách, đèn mỗi khung
        for (const o of [lv.core, lv.safe, ...lv.pips, ...lv.tears]) o.visible = false;
        if (lv.litAt !== st.litAt) { st.litAt = lv.litAt; if (!settings.rm) st.s.burst(now); } // giảm chuyển động: không chớp sáng khi thắp
        st.s.setProgress(l.deposited, l.everLit ? T.relight_cost : T.lantern_cost);
        st.s.setLit(l.lit);
        st.s.setFuel(fuelOf(l) / T.fuel_max);
        st.s.update(now, tm); // nhấp nháy hết dầu theo now (như main.ts), trang trí theo tm
        lv.light.intensity = st.s.light.intensity; // cường độ theo sân khấu, đèn vẫn là của main.ts
      });

      const shown: number[][] = [];
      for (const m of w.motes) {
        const o = v.motes.get(m.id);
        if (!o || !on) continue;
        if (o.visible) shown.push(m.pos); // main.ts cho Đom đóm rơi sắp tắt nhấp nháy bằng visible
        o.visible = false;
      }
      fans.set(shown);
      fans.update(tm);

      for (const s of w.shades) {
        const o = v.shades.get(s.id) as THREE.Mesh | undefined;
        if (!o) continue;
        let a = antis.get(o);
        if (!a) {
          antis.set(o, (a = makeShade(t)));
          a.group.position.y = -1; // sim: tâm Bóng Mực ở y = 1; antifan đặt gốc ở chân
          o.add(a.group);
        }
        a.group.visible = on;
        (o.material as THREE.Material).visible = !on; // viền/mắt dùng chung vật liệu giữa các Bóng Mực
        o.children.forEach((c) => { if (c !== a.group) ((c as THREE.Mesh).material as THREE.Material).visible = !on; });
        a.setState(s.state === 'stunned' ? 'stunned' : s.state === 'drain' ? 'drain' : 'normal');
        a.update(tm);
      }
      if (song) song.volume = Math.min(1, settings.vol * 0.6);
    },
    /** Gọi cuối drawHud() của main.ts: đổi nhãn sang Show / Cát-xê. */
    hud() {
      if (!L || settings.cb) return;
      const tr = document.getElementById('tr')!, pr = document.getElementById('prompt')!;
      tr.innerHTML = tr.innerHTML.replace('Đèn', L.lantern).replace(/Điểm <b>(\d+)<\/b>/, (_, n) => `${L.score} <b>${money(+n)}</b>`);
      pr.textContent = pr.textContent!.replace('Nạp ánh sáng', 'Dẫn fan lên show').replace('Châm dầu', 'Hâm nóng show').replace('Đèn Lồng', 'sân khấu');
      const cu = document.getElementById('cues')!, c = cu.innerHTML;
      const c2 = c.replace(/Bóng Mực/g, 'Antifan').replace(/Đèn (L\d)/g, `${L.lantern} $1`).replace(/Đèn sắp cạn dầu/g, `${L.lantern} sắp nguội`).replace(/Ngọn Lửa/g, L.flame);
      if (c2 !== c) cu.innerHTML = c2; // main.ts chỉ ghi lại #cues khi nội dung của nó đổi
    },
  };
}
