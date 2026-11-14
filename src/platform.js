// Save data, audio (synthesised, no assets) and input.
import { canvas, view } from './gfx.js';

// ---- save -------------------------------------------------------------------
const KEY = 'vapekayak.v1';
const fresh = () => ({ cash: 0, best: 0, bestDist: 0, runs: 0, shop: {}, sound: true, tilt: false, sideArt: true, seenIntro: false });
export const save = fresh();
export function loadSave() { try { Object.assign(save, JSON.parse(localStorage.getItem(KEY) || localStorage.getItem('vapecanoe.v1') || '{}')); }   // falls back to the pre-rename save
  catch { /* private mode */ } }
export function writeSave() { try { localStorage.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ } }
export function resetSave() { Object.assign(save, fresh()); writeSave(); }
export const shopLvl = (id) => save.shop[id] || 0;

// ---- audio ------------------------------------------------------------------
let ac = null, noiseBuf = null, lastKill = 0;
export const getAC = () => ac;
export function unlockAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ac = new AC();
  noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
  const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
function tone(freq, dur, vol = 0.06, type = 'square', slide = 0, delay = 0) {
  if (!ac || !save.sound) return;
  const t = ac.currentTime + delay, o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
}
function hiss(dur, vol = 0.05, delay = 0) {
  if (!ac || !save.sound) return;
  const t = ac.currentTime + delay, s = ac.createBufferSource(), g = ac.createGain();
  s.buffer = noiseBuf; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(g).connect(ac.destination); s.start(t); s.stop(t + dur + 0.02);
}
export const sfx = {
  vape: (combo) => tone(520 * Math.pow(2, Math.min(combo, 14) / 12), 0.07, 0.05),
  big: () => { tone(660, 0.08, 0.06); tone(990, 0.12, 0.06, 'square', 0, 0.07); },
  cash: () => { tone(1320, 0.05, 0.05); tone(1760, 0.1, 0.05, 'square', 0, 0.05); },
  puff: () => hiss(0.08, 0.012),
  nova: () => { hiss(0.4, 0.07); tone(110, 0.4, 0.07, 'triangle', 0.4); },
  kill: () => { if (!ac || ac.currentTime - lastKill < 0.05) return; lastKill = ac.currentTime; hiss(0.05, 0.035); tone(200, 0.05, 0.03, 'square', 0.5); },
  heal: () => [392, 523, 659].forEach((f, i) => tone(f, 0.14, 0.07, 'triangle', 0, i * 0.08)),
  hurt: () => { tone(160, 0.25, 0.1, 'sawtooth', 0.4); hiss(0.2, 0.08); },
  level: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 0.06, 'square', 0, i * 0.07)),
  pick: () => { tone(784, 0.06, 0.06); tone(1175, 0.14, 0.06, 'square', 0, 0.06); },
  ui: () => tone(440, 0.04, 0.04),
  no: () => tone(140, 0.12, 0.06),
  buy: () => [659, 880, 1319].forEach((f, i) => tone(f, 0.1, 0.06, 'square', 0, i * 0.06)),
  death: () => { tone(300, 0.9, 0.12, 'sawtooth', 0.1); hiss(0.7, 0.12); },
};

// ---- input ------------------------------------------------------------------
export const input = { taps: [], dir: 0, tilt: 0, pause: false };
const pointers = new Map();
function refreshDir() { let d = 0; for (const v of pointers.values()) d = v; input.dir = d; }
export function initInput() {
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * view.W, y: (e.clientY - r.top) / r.height * view.H }; };
  window.addEventListener('pointerdown', (e) => {
    unlockAudio(); const p = pos(e); input.taps.push(p);
    pointers.set(e.pointerId, p.x < view.W / 2 ? -1 : 1); refreshDir(); e.preventDefault();
  }, { passive: false });
  const up = (e) => { pointers.delete(e.pointerId); refreshDir(); };
  window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
  window.addEventListener('blur', () => { pointers.clear(); refreshDir(); });
  const keyDir = (k) => (k === 'ArrowLeft' || k === 'a' || k === 'A') ? -1 : (k === 'ArrowRight' || k === 'd' || k === 'D') ? 1 : 0;
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return; unlockAudio();
    const d = keyDir(e.key);
    if (d) { input.taps.push({ x: d < 0 ? 40 : view.W - 40, y: view.H * 0.6, key: true }); pointers.set('k' + d, d); refreshDir(); }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') input.pause = true;
  });
  window.addEventListener('keyup', (e) => { const d = keyDir(e.key); if (d) { pointers.delete('k' + d); refreshDir(); } });
  window.addEventListener('deviceorientation', (e) => {
    if (e.gamma == null) return;
    const land = Math.abs(window.orientation || 0) === 90;
    input.tilt = land ? (e.beta || 0) : e.gamma;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}
/** iOS needs a permission prompt from a user gesture. Resolves to true if tilt is usable. */
export async function requestTilt() {
  try {
    const D = window.DeviceOrientationEvent;
    if (!D) return false;
    if (typeof D.requestPermission === 'function') return (await D.requestPermission()) === 'granted';
    return true;
  } catch { return false; }
}
