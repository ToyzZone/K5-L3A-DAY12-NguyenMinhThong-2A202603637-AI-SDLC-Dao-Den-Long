// Âm thanh tổng hợp bằng WebAudio, không có file. Mở AudioContext sau thao tác đầu tiên (luật autoplay).
let ctx: AudioContext | null = null;
let master: GainNode;
let volume = 0.6;

export function setVolume(v: number) {
  volume = v;
  if (ctx) master.gain.value = v;
}

export function unlockAudio() {
  if (ctx) { if (ctx.state === 'suspended') void ctx.resume(); return; }
  ctx = new AudioContext();
  master = ctx.createGain();
  master.gain.value = volume;
  master.connect(ctx.destination);
  // Nhạc nền đêm: vài sóng sin trầm qua lọc thấp, "thở" chậm bằng LFO.
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  const g = ctx.createGain();
  g.gain.value = 0.06;
  lp.connect(g).connect(master);
  for (const f of [55, 82.4, 110.3]) { const o = ctx.createOscillator(); o.frequency.value = f; o.connect(lp); o.start(); }
  const lfo = ctx.createOscillator(), lg = ctx.createGain();
  lfo.frequency.value = 0.1;
  lg.gain.value = 0.03;
  lfo.connect(lg).connect(g.gain);
  lfo.start();
}

function tone(f0: number, f1: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur);
}
const arp = (notes: number[], gap: number, type: OscillatorType, vol: number) =>
  notes.forEach((f, i) => tone(f, f, gap * 2, type, vol, i * gap));

export const sfx = {
  pickup: () => tone(880, 1400, 0.09, 'sine', 0.15),
  lit: () => arp([523, 659, 784, 1047], 0.08, 'triangle', 0.2),
  pulse: () => tone(260, 900, 0.4, 'sine', 0.25),
  hit: () => tone(240, 90, 0.3, 'square', 0.1),
  jump: () => tone(380, 720, 0.12, 'triangle', 0.15),
  dash: () => tone(900, 250, 0.15, 'sawtooth', 0.07),
  charm: () => arp([784, 988, 1175], 0.06, 'triangle', 0.15),
  win: () => arp([523, 659, 784, 1047, 1319], 0.12, 'triangle', 0.22),
  lose: () => arp([440, 392, 330, 262], 0.18, 'sine', 0.22),
  shade: () => tone(110, 65, 0.7, 'sawtooth', 0.07),
  tick: () => tone(1200, 1200, 0.05, 'square', 0.07),
  steal: () => tone(1300, 380, 0.3, 'triangle', 0.16),
  wind: () => tone(180, 520, 1.4, 'sawtooth', 0.04),
};
