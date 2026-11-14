// Canvas, pixel font, sprites. Everything is hard-edged: no arcs, no fillText.
import { VIEW, COLORS } from './config.js';

const { BG, FG, GINGER, ENEMY } = COLORS;
export const canvas = document.getElementById('game');
export const ctx = canvas.getContext('2d', { alpha: false });
export const view = { W: VIEW.W, H: VIEW.H_MIN };

export function resize() {
  const vw = window.innerWidth, vh = window.innerHeight;
  const h = Math.max(VIEW.H_MIN, Math.min(VIEW.H_MAX, Math.round(VIEW.W * vh / vw)));
  if (canvas.width !== VIEW.W || canvas.height !== h) { canvas.width = VIEW.W; canvas.height = h; }
  view.H = h;
  const s = Math.min(vw / VIEW.W, vh / h);
  canvas.style.width = Math.floor(VIEW.W * s) + 'px';
  canvas.style.height = Math.floor(h * s) + 'px';
  ctx.imageSmoothingEnabled = false;
}

function mk(w, h) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  return [c, g];
}

export function rect(x, y, w, h, c = FG) { ctx.fillStyle = c; ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }
export function box(x, y, w, h, c = FG, t = 1) {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c); rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}

// ---- 3x5 pixel font ---------------------------------------------------------
const GL = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101110011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010010010',
  8: '111101111101111', 9: '111101111001110',
  '+': '000010111010000', '-': '000000111000000', '.': '000000000000010', ',': '000000000010100',
  '!': '010010010000010', '?': '110001010000010', ':': '000010000010000', "'": '010010000000000',
  '/': '001001010100100', '%': '101001010100101', '£': '011010111010111', '>': '100010001010100',
  '<': '001010100010001', '(': '010100100100010', ')': '010001001001010', '*': '000101010101000',
  '=': '000111000111000', '#': '101111101111101',
};
const CH = Object.keys(GL);
const IDX = {}; CH.forEach((c, i) => IDX[c] = i);
const atlases = {};
function atlas(color) {
  if (atlases[color]) return atlases[color];
  const [c, g] = mk(CH.length * 4, 5);
  g.fillStyle = color;
  CH.forEach((ch, i) => { for (let p = 0; p < 15; p++) if (GL[ch][p] === '1') g.fillRect(i * 4 + p % 3, (p / 3) | 0, 1, 1); });
  return atlases[color] = c;
}
export function textW(str, s = 1) { return String(str).length * 4 * s - s; }
/** align: 0 left, 0.5 centre, 1 right */
export function text(str, x, y, s = 1, color = FG, align = 0) {
  str = String(str).toUpperCase();
  x = Math.round(x - textW(str, s) * align); y = Math.round(y);
  const at = atlas(color);
  for (let i = 0; i < str.length; i++) {
    const k = IDX[str[i]];
    if (k !== undefined) ctx.drawImage(at, k * 4, 0, 3, 5, x + i * 4 * s, y, 3 * s, 5 * s);
  }
}
/** text with a black outline so it reads over anything */
export function textO(str, x, y, s = 1, color = FG, align = 0) {
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) if (dx || dy) text(str, x + dx, y + dy, s, BG, align);
  text(str, x, y, s, color, align);
}
export function wrap(str, maxChars) {
  const out = []; let line = '';
  for (const w of str.split(' ')) {
    if (line && (line + ' ' + w).length > maxChars) { out.push(line); line = w; } else line = line ? line + ' ' + w : w;
  }
  if (line) out.push(line);
  return out;
}

// ---- sprite building --------------------------------------------------------
/** add a 1px black outline around every opaque pixel */
function outlined(src, col = BG) {
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const [c, g] = mk(w + 2, h + 2);
  g.fillStyle = col;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3]) g.fillRect(x, y, 3, 3);
  g.drawImage(src, 1, 1);
  return c;
}
/** '#' white, 'o' ginger, 'x' black, anything else transparent */
function art(rows, outline = true) {
  const [c, g] = mk(Math.max(...rows.map(r => r.length)), rows.length);
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x++) {
    const ch = r[x]; if (ch === '.' || ch === ' ') continue;
    g.fillStyle = ch === 'o' ? GINGER : ch === 'x' ? BG : FG; g.fillRect(x, y, 1, 1);
  } });
  return outline ? outlined(c, outline === true ? BG : outline) : c;
}
function hash(n) { n = Math.imul(n ^ (n >>> 15), 0x2c1b3c6d); n = Math.imul(n ^ (n >>> 12), 0x297a2d39); return ((n ^ (n >>> 15)) >>> 0) / 4294967296; }
export { hash };

function makeCanoe(frame) {
  const [c, g] = mk(25, 40), cx = 12;
  const hw = (y) => (y < 1 || y > 38) ? -1 : Math.round(6.5 * Math.pow(Math.sin(Math.PI * (y - 1) / 37), 0.55));
  g.fillStyle = FG;
  for (let y = 1; y <= 38; y++) g.fillRect(cx - hw(y), y, hw(y) * 2 + 1, 1);
  g.fillStyle = BG;
  for (let y = 2; y <= 37; y++) { const i = Math.min(hw(y - 1), hw(y), hw(y + 1)) - 1; if (i >= 0) g.fillRect(cx - i, y, i * 2 + 1, 1); }
  g.fillStyle = FG;
  g.fillRect(cx - 4, 10, 9, 1); g.fillRect(cx - 4, 31, 9, 1);         // thwarts
  // paddle: shaft across the body, blade in the water on one side
  const dir = frame ? 1 : -1;
  for (let i = -10; i <= 10; i++) g.fillRect(cx + i, Math.round(22 - i * dir * 0.35), 1, 1);
  g.fillRect(cx - dir * 12 + (dir > 0 ? 0 : -1), 23, 3, 5);
  g.fillRect(cx - 3, 19, 7, 5);                                         // shoulders
  g.fillStyle = GINGER;                                                 // THE hair
  g.fillRect(cx - 2, 17, 5, 6); g.fillRect(cx - 1, 16, 3, 1);
  g.fillRect(cx - 1, 23, 3, 3); g.fillRect(cx, 26, 1, 2);
  g.fillStyle = FG; g.fillRect(cx + 3, 16, 1, 3);                       // the vape
  return outlined(c);
}

function makeVapeFrames(len, wid, n = 16) {
  const size = len + 3, c0 = (size - 1) / 2, frames = [];
  for (let f = 0; f < n; f++) {
    const a = f / n * Math.PI * 2, cs = Math.cos(a), sn = Math.sin(a);
    const [c, g] = mk(size, size);
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const u = (x - c0) * cs + (y - c0) * sn, v = -(x - c0) * sn + (y - c0) * cs;
      if (Math.abs(u) > len / 2 || Math.abs(v) > wid / 2) continue;
      g.fillStyle = (u > len / 2 - 3.6 && u < len / 2 - 2.2) ? BG : FG;
      g.fillRect(x, y, 1, 1);
    }
    frames.push(outlined(c));
  }
  return frames;
}

function makeBarge(len) {
  const w = 30, [c, g] = mk(w, len);
  g.fillStyle = FG; g.fillRect(2, 0, w - 4, len); g.fillRect(0, 4, w, len - 8); g.fillRect(1, 2, w - 2, len - 4);
  g.fillStyle = BG; g.fillRect(3, 4, w - 6, len - 8);
  g.fillStyle = FG;
  g.fillRect(6, 12, w - 12, len - 30);                                  // cabin roof
  g.fillStyle = BG;
  for (let y = 16; y < len - 24; y += 9) { g.fillRect(8, y, 4, 4); g.fillRect(w - 12, y, 4, 4); }   // skylights
  g.fillRect(w / 2 - 1, 12, 2, len - 30);
  g.fillStyle = FG; g.fillRect(w / 2 - 3, len - 13, 6, 2); g.fillRect(w / 2 - 1, len - 11, 2, 5);   // tiller
  return outlined(c);
}
function makeSandbar(seed) {
  const w = 60, h = 20, [c, g] = mk(w, h);
  g.fillStyle = FG;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = ((x - 29.5) / 30) ** 2 + ((y - 9.5) / 10) ** 2;
    if (d > 1) continue;
    if (d > 0.72 || hash(seed * 7919 + y * 61 + x) < 0.22) g.fillRect(x, y, 1, 1);
  }
  return c;
}
function makePier() {
  const [c, g] = mk(14, 22);
  g.fillStyle = FG; g.fillRect(0, 0, 14, 22);
  g.fillStyle = BG;
  for (let y = 3; y < 22; y += 4) { g.fillRect(1, y, 12, 1); for (let x = ((y / 4) & 1) ? 3 : 7; x < 13; x += 7) g.fillRect(x, y - 3, 1, 3); }
  return outlined(c);
}

const discs = new Map();
/** hard-edged disc. style 0 solid, 1 checker + rim, 2 sparse dots, 3 rim only */
export function disc(r, style) {
  r = Math.max(1, Math.min(150, r | 0));
  const key = r * 4 + style;
  let c = discs.get(key);
  if (c) return c;
  const s = r * 2 + 1; let g;
  [c, g] = mk(s, s);
  const img = g.createImageData(s, s), d = img.data, r2 = r * r + r * 0.8, rin = (r - 1.2) * (r - 1.2);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const q = (x - r) * (x - r) + (y - r) * (y - r);
    if (q > r2) continue;
    const rim = q >= rin;
    const on = style === 0 || (style === 1 && (rim || ((x + y) & 1) === 0)) || (style === 2 && (x & 1) === 0 && (y & 1) === 0 && (((x + y) >> 1) & 1) === 0) || (style === 3 && rim);
    if (on) { const i = (y * s + x) * 4; d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 255; }
  }
  g.putImageData(img, 0, 0);
  discs.set(key, c);
  return c;
}
export function drawDisc(x, y, r, style) { const c = disc(r, style); ctx.drawImage(c, Math.round(x) - (c.width >> 1), Math.round(y) - (c.height >> 1)); }
export function draw(s, x, y) { ctx.drawImage(s, Math.round(x - s.width / 2), Math.round(y - s.height / 2)); }

// ---- status-bar portrait: 36x44, drawn by code so every expression shares one head ----
const faces = {};
/** tier 0 (fine) .. 4 (wrecked). mode: 'c' | 'l' | 'r' (gaze), 'ouch', 'grin', 'drag', 'puff', 'dead' */
export function face(tier, mode) {
  const key = tier + mode;
  if (faces[key]) return faces[key];
  const [c, g] = mk(36, 44);
  const P = (x, y, w = 1, h = 1, col = BG) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  // hair mass
  const top = [[10, 25], [7, 28], [5, 30], [4, 31], [3, 32]];
  for (let y = 0; y < 44; y++) {
    let [a, b] = top[y] || [2, 33];
    if (y >= 5) { a += hash(y * 7) < 0.4 ? 1 : 0; b -= hash(y * 13) < 0.4 ? 1 : 0; if (y > 30) { a -= 1; b += 1; } }
    P(a, y, b - a + 1, 1, GINGER);
  }
  for (const x of [5, 8, 28, 31]) for (let y = 6; y < 44; y++) if (hash(x * 31 + (y >> 2)) < 0.75) P(x + (((y + x) >> 3) & 1), y);   // strands
  for (const x of [13, 18, 23]) P(x, 2, 1, 6);
  // face, neck, top
  P(10, 11, 16, 15, FG); P(11, 26, 14, 2, FG); P(12, 28, 12, 2, FG); P(14, 30, 8, 1, FG); P(15, 31, 6, 1, FG);
  P(15, 32, 6, 4, FG); P(14, 32, 1, 4); P(21, 32, 1, 4);
  P(9, 36, 18, 8); for (let i = 0; i < 4; i++) { P(13 + i, 36 + i * 2, 1, 2, FG); P(22 - i, 36 + i * 2, 1, 2, FG); }
  for (let x = 10; x < 26; x++) { if (x % 3) P(x, 11, 1, 1, GINGER); if (x % 3 === 1) P(x, 12, 1, 2, GINGER); if (x % 6 === 4) P(x, 14, 1, 1, GINGER); }   // fringe
  P(25, 16, 1, 9); P(24, 24, 1, 3);                                                 // cheek shadow
  // features
  const dead = mode === 'dead', ouch = mode === 'ouch', grin = mode === 'grin', drag = mode === 'drag', puff = mode === 'puff';
  const gaze = mode === 'l' ? 0 : mode === 'r' ? 2 : 1, browY = ouch ? 15 : 16;
  for (const ex of [12, 20]) {
    const left = ex === 12;
    if (dead) { for (let i = 0; i < 4; i++) { P(ex + i, 18 + i); P(ex + 3 - i, 18 + i); } continue; }
    if (tier >= 3 && !ouch) P(left ? ex + 0 : ex, browY + (left ? 0 : 0), 4, 1); else P(ex, browY, 4, 1);
    if (tier >= 3 && !ouch) P(left ? ex + 3 : ex, browY + 1, 1, 1);                 // furrowed
    if (tier >= 4 && !left && !ouch) { P(ex - 1, 20, 6, 1); continue; }             // swollen shut
    P(ex - 1, 18, 6, 1); P(ex - 1, 19, 1, 2); P(ex + 4, 19, 1, 2); P(ex, 21, 4, 1);
    P(ex + gaze, 19, 2, 2);
    if (drag) P(ex, 19, 4, 1);                                                      // eyes half shut, savouring it
  }
  P(18, 22, 1, 2); P(17, 24, 2, 1);                                                 // nose
  if (drag) {                                                                        // vape to the lips
    P(16, 27, 4, 2);
    for (let i = 0; i < 9; i++) { P(18 + i, 26 + i, 4, 4); }
    for (let i = 0; i < 9; i++) { P(19 + i, 27 + i, 2, 2, FG); }
    P(25, 33, 2, 2); P(18, 26, 2, 2);
  } else if (puff) {                                                                 // pursed lips, cloud rolling off
    P(17, 26, 3, 3); P(18, 27, 1, 1, FG);
    for (const [cx, cy, r] of [[24, 29, 4], [29, 25, 5], [31, 33, 5], [26, 36, 4]])
      for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
        const q = (x - cx) * (x - cx) + (y - cy) * (y - cy);
        if (q <= r * r + 1) P(x, y, 1, 1, q >= (r - 1) * (r - 1) || ((x + y) & 1) ? FG : BG);
      }
  } else if (ouch) { P(16, 26, 5, 4); P(17, 27, 3, 2, FG); P(17, 28, 3, 1); }
  else if (grin) { P(13, 26, 1, 1); P(22, 26, 1, 1); P(14, 27, 8, 1); P(15, 29, 6, 1); P(14, 28, 1, 1); P(21, 28, 1, 1); }
  else if (tier >= 3 && !dead) { P(14, 26, 8, 3); for (let x = 15; x < 21; x += 2) P(x, 27, 1, 1, FG); }   // gritted teeth
  else if (dead) P(15, 28, 6, 1);
  else { P(15, 27, 6, 1); P(16, 28, 4, 1); }
  // damage
  if (tier >= 1) { P(22, 23); P(23, 24); P(24, 25); P(11, 22); P(12, 23); }
  if (tier >= 2) { for (let y = 21; y < 24; y++) for (let x = 19; x < 25; x++) if ((x + y) & 1) P(x, y); P(13, 14, 1, 3); P(14, 16); }
  if (tier >= 3) { for (let y = 22; y < 29; y++) for (let x = 10; x < 15; x++) if (((x + y) & 1) && hash(x * 9 + y) < 0.8) P(x, y); P(20, 13); P(21, 14); P(22, 15); }
  if (tier >= 4 || dead) { for (let y = 15; y < 31; y++) for (let x = 10; x < 26; x++) if ((x & 1) === 0 && (y & 1) === 0 && hash(x * 5 + y * 3) < 0.7) P(x, y); P(16, 30, 1, 3); P(19, 29, 1, 2); }
  if (tier >= 2) for (let i = 0; i < tier * 5; i++) { const y = 2 + ((hash(i * 17) * 40) | 0), l = hash(i * 29) < 0.5; P(l ? (hash(i) * 3) | 0 : 33 + ((hash(i) * 3) | 0), y, 1, 1, GINGER); P(l ? 3 + ((hash(i * 3) * 5) | 0) : 28 + ((hash(i * 3) * 5) | 0), y, 2, 1); }
  return faces[key] = c;
}

export const SPR = {};
export function buildSprites() {
  SPR.canoe = [makeCanoe(0), makeCanoe(1)];
  SPR.vape = makeVapeFrames(11, 3);
  SPR.bigVape = makeVapeFrames(19, 5);
  SPR.barge = { 70: makeBarge(70), 90: makeBarge(90), 110: makeBarge(110) };
  SPR.sandbar = [makeSandbar(1), makeSandbar(2), makeSandbar(3)];
  SPR.pier = makePier();
  SPR.cash = art([
    '..##.##..', '...###...', '...###...', '..#####..', '.###xx##.', '.##x####.', '.#xxx###.', '.##x####.', '.#xxxx##.', '..#####..']);
  SPR.heart = art(['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'], false);
  SPR.heartEmpty = art(['.##.##.', '#..#..#', '#.....#', '.#...#.', '..#.#..', '...#...'], false);
  SPR.swan = art([
    '...##......', '..####.....', '..#x##.....', '...##......', '...##......', '...##..###.', '...#######.', '..#########', '..#########', '...#######.'], ENEMY);
  SPR.pap = art([
    '.....##.....', '....####....', '....####....', '..########..', '.##.####.##.', '.#..#xx#..#.', '.#..#xx#..#.', '.##......##.', '..########..', '...######...'], ENEMY);
  SPR.tumble = art([
    '...####...', '..#.#..#..', '.#.#.##.#.', '#.#.#..#.#', '#..#.#.#.#', '#.#.#.#..#', '#.#..#.#.#', '.#.##.#.#.', '..#..#.#..', '...####...'], ENEMY);
  SPR.piranha = art([
    '..####....', '.######..#', '#x####.###', '#######.##', '#.#.##.###', '.######..#', '..####....'], ENEMY);
  SPR.mozzie = art(['#.#.#', '.###.', '#.#.#'], ENEMY);
  SPR.croc = art([
    '...####...', '...#..#...', '...####...', '...####...', '..#x##x#..', '..######..', '.########.', '##########', '.########.',
    '.########.', '##########', '.########.', '..######..', '...####...', '...###....', '....##....', '....#.....'], ENEMY);
  SPR.trolley = art([
    '#...........', '.##########.', '..#.#.#.#.#.', '..#########.', '..#.#.#.#.#.', '..########..', '...#.....#..', '..##....##..']);
  SPR.barrel = art(['.######.', '########', '#......#', '########', '########', '#......#', '########', '.######.']);
  SPR.cone = art(['...##...', '...##...', '..####..', '..#..#..', '.######.', '.#....#.', '########']);
  SPR.cactus = art(['..##..', '..##.#', '#.##.#', '#.####', '####..', '..##..', '..##..', '..##..'], false);
  SPR.palm = art(['.##..##..', '#..##..#.', '.######..', '#..##.##.', '.#.##..#.', '...#.....', '...##....', '....#....', '....##...'], false);
  SPR.lamp = art(['.###.', '#####', '.#.#.', '..#..', '..#..', '..#..', '..#..', '.###.'], false);
  SPR.signs = ['SOLD', 'TO LET'].map((word) => {                       // estate agents love a towpath
    const w = word.length * 4 + 3, [c, g] = mk(w, 14);
    g.fillStyle = FG; g.fillRect(0, 0, w, 9); g.fillRect((w >> 1) - 1, 9, 2, 5);
    g.fillStyle = BG;
    for (let i = 0; i < word.length; i++) { const gl = GL[word[i]]; if (gl) for (let p = 0; p < 15; p++) if (gl[p] === '1') g.fillRect(2 + i * 4 + p % 3, 2 + ((p / 3) | 0), 1, 1); }
    return c;
  });
  SPR.bollard = art(['.##.', '####', '.##.', '.##.', '####'], false);
}
