// Music: two looping game tracks (decoded buffers, sample-accurate loop points),
// a synthesised menu chiptune, crossfades, and a low-pass "muffle" for menus.
import { MUSIC } from './config.js';
import { save, getAC } from './platform.js';

let ac = null, bus = null, filter = null;
const raw = {}, buffers = {}, decoding = {};
let cur = null, curGain = null, curSrc = null, openerDone = false;
/** true once the opening track has played all the way through (or could not be loaded) */
export const openerFinished = () => openerDone;

export const musicState = () => ({ cur, loaded: Object.keys(buffers), ctx: ac && ac.state, cutoff: filter && Math.round(filter.frequency.value) });
export function preloadMusic() {
  for (const k in MUSIC.TRACKS) {
    const url = (window.__MUSIC && window.__MUSIC[k]) || MUSIC.TRACKS[k].src;
    fetch(url).then((r) => r.arrayBuffer()).then((b) => { raw[k] = b; }).catch(() => { if (k === MUSIC.OPENER) openerDone = true; });
  }
}
function decodePending() {
  for (const k in raw) {
    if (buffers[k] || decoding[k]) continue;
    decoding[k] = true;
    ac.decodeAudioData(raw[k].slice(0), (b) => { buffers[k] = b; }, () => { if (k === MUSIC.OPENER) openerDone = true; });
  }
}
function fadeOut() {
  if (!curGain) return;
  const t = ac.currentTime, g = curGain, s = curSrc;
  g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + MUSIC.XFADE);
  if (s) s.stop(t + MUSIC.XFADE + 0.05);
  setTimeout(() => g.disconnect(), (MUSIC.XFADE + 0.2) * 1000);
  curGain = curSrc = null;
}
function start(track) {
  fadeOut();
  cur = track;
  if (!track) return;
  const t = ac.currentTime, g = ac.createGain();
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + (track === 'menu' ? 0.3 : MUSIC.XFADE * 0.5));
  g.connect(filter); curGain = g;
  if (track === 'menu') { chip.gain = g; chip.next = t + 0.1; chip.step = 0; return; }
  const def = MUSIC.TRACKS[track], s = ac.createBufferSource();
  s.buffer = buffers[track];
  if (def.once) s.onended = () => { if (track === MUSIC.OPENER) openerDone = true; };
  else { s.loop = true; s.loopStart = def.loopStart; s.loopEnd = def.loopEnd; }
  const trim = ac.createGain(); trim.gain.value = def.gain || 1;
  s.connect(trim).connect(g); s.start(t); curSrc = s;
}

/** Call every frame with the track that should be playing ('menu' | track id | null). */
export function musicFrame(track, muffle) {
  ac = getAC(); if (!ac) return;
  if (!bus) {
    bus = ac.createGain(); bus.gain.value = 0; bus.connect(ac.destination);
    filter = ac.createBiquadFilter(); filter.type = 'lowpass'; filter.frequency.value = 20000; filter.Q.value = 0.7; filter.connect(bus);
  }
  decodePending();
  const t = ac.currentTime;
  bus.gain.setTargetAtTime(save.sound ? (muffle ? MUSIC.VOLUME * MUSIC.MUFFLE_GAIN : MUSIC.VOLUME) : 0, t, 0.08);
  filter.frequency.setTargetAtTime(muffle ? MUSIC.MUFFLE_HZ : 20000, t, 0.1);
  if (track !== cur && (!track || track === 'menu' || buffers[track])) start(track);
  if (cur === 'menu') chipSchedule();
}

// ---- menu chiptune ---------------------------------------------------------------
// Original 8-bar loop written for this game. It borrows the feel of the two game
// tracks: A minor, an E-major turnaround (the harmonic-minor colour), square lead,
// triangle bass, busy arpeggios.
const N = { A: 9, 'A#': 10, B: 11, C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8 };
const hz = (n) => { const m = /^([A-G]#?)(\d)$/.exec(n); return 440 * Math.pow(2, (N[m[1]] - 9) / 12 + (+m[2] - 4)); };
const CHORDS = [
  { bass: 'A2', arp: ['A4', 'C5', 'E5', 'C5'] }, { bass: 'F2', arp: ['A4', 'C5', 'F5', 'C5'] },
  { bass: 'G2', arp: ['B4', 'D5', 'G5', 'D5'] }, { bass: 'E2', arp: ['B4', 'E5', 'G#5', 'E5'] },
];
// [note, length in beats] per bar; each bar is 4 beats
const LEAD = [
  [['E5', 1], ['A5', 1], ['G5', 0.5], ['E5', 0.5], ['C5', 1]],
  [['D5', 0.5], ['C5', 0.5], ['A4', 1], ['C5', 1], ['F5', 1]],
  [['G5', 1.5], ['F5', 0.5], ['D5', 1], ['B4', 1]],
  [['E5', 1], ['G#5', 1], ['B5', 1], ['G#5', 0.5], ['E5', 0.5]],
  [['A5', 1], ['C6', 1], ['B5', 0.5], ['A5', 0.5], ['E5', 1]],
  [['F5', 0.5], ['A5', 0.5], ['C6', 1], ['A5', 1], ['F5', 1]],
  [['G5', 1], ['B5', 1], ['D6', 1], ['B5', 0.5], ['G5', 0.5]],
  [['G#5', 0.5], ['F5', 0.5], ['E5', 0.5], ['D5', 0.5], ['B4', 1], ['E5', 1]],
];
const chip = { gain: null, next: 0, step: 0 };   // step = 16th-note index within the 8 bars
let leadAt = null;
function leadTable() {
  if (leadAt) return leadAt;
  leadAt = {};
  LEAD.forEach((bar, b) => { let pos = 0; for (const [n, len] of bar) { leadAt[b * 16 + Math.round(pos * 4)] = [n, len]; pos += len; } });
  return leadAt;
}
function voice(type, freq, t, dur, vol) {
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(vol, t); g.gain.setValueAtTime(vol * 0.7, t + dur * 0.5); g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(chip.gain); o.start(t); o.stop(t + dur + 0.02);
}
let hatBuf = null;
function hat(t, vol) {
  if (!hatBuf) { hatBuf = ac.createBuffer(1, 2205, 44100); const d = hatBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length); }
  const s = ac.createBufferSource(), g = ac.createGain(); s.buffer = hatBuf; g.gain.value = vol; s.connect(g).connect(chip.gain); s.start(t);
}
function chipSchedule() {
  const sixteenth = 60 / MUSIC.MENU_BPM / 4, table = leadTable();
  if (chip.next < ac.currentTime - 0.5) chip.next = ac.currentTime + 0.05;      // tab was asleep: don't burst-catch-up
  while (chip.next < ac.currentTime + 0.25) {
    const s = chip.step, bar = (s >> 4) & 7, in16 = s & 15, ch = CHORDS[bar & 3], t = chip.next;
    voice('square', hz(ch.arp[in16 & 3]), t, sixteenth * 0.9, 0.035);                       // arpeggio
    if ((in16 & 1) === 0) voice('triangle', hz(ch.bass) * ((in16 & 7) === 6 ? 2 : 1), t, sixteenth * 1.8, 0.16);   // bass
    const l = table[s & 127];
    if (l) voice('square', hz(l[0]), t, l[1] * sixteenth * 4 * 0.92, 0.07);                 // lead
    if ((in16 & 3) === 2) hat(t, 0.05); else if ((in16 & 3) === 0) hat(t, 0.02);
    chip.next += sixteenth; chip.step = (s + 1) & 127;
  }
}
