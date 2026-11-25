// Lighthouse bosses. Out at sea, every lighthouse you reach starts a boss fight, each one a homage to a retro
// classic, getting harder as you go. Only #1 exists so far:
//
// #1 SNAKE. A Nokia-green arena drops round the lighthouse. The snake moves cell by cell and hunts its eggs,
// growing with each one. You race it for them: every egg YOU grab grows you a tail, a line of Angies in kayaks
// following your wake, exactly like Snake. The snake can't touch your tail: if it runs into one, that kayak is
// sacrificed and the snake is cut short. Better still, drag your tail through its body to slice it in two: the
// back half falls away and the kayak that did it is sacrificed. Cut it down to nothing, or trap it so it crashes.
// Its head is instant death. It is smart: it won't walk into a space too small for it, so you need a long
// enough tail to box it in. Vapes are useless against it.
import { COLORS, BOSS } from './config.js';
import { G, enemies, clouds, vapes, hazards, orbs, burst, addFloater, addPart, die, hurt, calcStats } from './game.js';
import { ctx, rect, box, text, textO, view, SPR } from './gfx.js';
import { sfx, nokia } from './platform.js';

const SN = BOSS.SNAKE, LCD = BOSS.LCD;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** which boss guards lighthouse number `index` (0-based); null means none yet */
export function bossFor(index) { return BOSS.ORDER[index] || null; }
export const bossActive = () => !!G.boss;

export function startBoss(kind, light) {
  if (kind !== 'snake') return;
  const N = SN.N, C = SN.CELL;
  const B = G.boss = {
    kind, t: 0, phase: 'intro', light, N, x0: light.x - N * C / 2, y0: light.wy - N * C / 2,
    cells: [], dir: [1, 0], tickT: 0, stun: 0, eggs: [], grow: 0, deadT: 0, cuts: 0, eaten: 0,
    hp: SN.HP, inv: 0, wrap: false, breakT: -1, hitT: -9,
  };
  // the snake starts in the far corner from you, heading along the wall
  const youRight = G.px > light.x, youUp = G.dist > light.wy, L = SN.START_LEN;
  const j0 = youUp ? 2 : N - 3, i0 = youRight ? L + 1 : N - 2 - L;
  B.dir = [youRight ? 1 : -1, 0];
  for (let k = 0; k < L; k++) B.cells.push([i0 - B.dir[0] * k, j0]);
  for (let k = 0; k < SN.EGGS; k++) spawnEgg(B);
  G.tailN = 0; G.trail = [{ x: G.px, wy: G.dist }]; G.tailPos = [];
  // the sea goes quiet for the duel
  for (let i = 0; i < enemies.n; i++) { const e = enemies.items[i]; burst(e.x, e.wy, 4, 60, 0.3); e.dead = true; }
  enemies.sweep(); clouds.n = 0; G.pods = []; G.shots = [];
  for (let i = 0; i < vapes.n; i++) { const v = vapes.items[i]; addPart(v.x, v.wy, 0, 0, 0.3, 4, 3); }   // the sea's vapes and whirlpools go too
  vapes.n = 0; hazards.n = 0;
  for (const o of orbs) addPart(o.x, o.wy, 0, 0, 0.35, o.r, 3);        // her orbiting storm clouds too: weapons rest during a duel
  orbs.length = 0; G.orbState = [];
  G.banner = ''; G.bannerT = 0; B.cue = 0;
  G.flash = 0.2; G.shake = 6; nokia.slam();
}

const cx = (B, i) => B.x0 + (i + 0.5) * SN.CELL, cy = (B, j) => B.y0 + (j + 0.5) * SN.CELL;
const inside = (B, i, j) => i >= 0 && j >= 0 && i < B.N && j < B.N;
/** the next cell in a direction: off the edge is a wall, until he smashes the walls; then it wraps round */
function nb(B, i, j, d) {
  const ni = i + d[0], nj = j + d[1];
  if (B.wrap) return [(ni + B.N) % B.N, (nj + B.N) % B.N];
  return inside(B, ni, nj) ? [ni, nj] : null;
}
/** shortest separation along one axis: across the seam once the arena wraps */
function wd(B, a) { const W = B.N * SN.CELL; if (B.wrap) { a = ((a % W) + W * 1.5) % W - W / 2; } return a; }
const sep = (B, x1, y1, x2, y2) => Math.hypot(wd(B, x1 - x2), wd(B, y1 - y2));
const anger = (B) => SN.HP - B.hp;                                          // 0 calm, 1 angry, 2 furious
const isLight = (B, i, j) => (i === B.N / 2 - 1 || i === B.N / 2) && (j === B.N / 2 - 1 || j === B.N / 2);
function cellOf(B, x, wy) { return [Math.floor((x - B.x0) / SN.CELL), Math.floor((wy - B.y0) / SN.CELL)]; }

function spawnEgg(B) {
  for (let tries = 0; tries < 200; tries++) {
    const i = 1 + ((Math.random() * (B.N - 2)) | 0), j = 1 + ((Math.random() * (B.N - 2)) | 0);
    if (isLight(B, i, j) || B.cells.some((c) => c[0] === i && c[1] === j) || B.eggs.some((e) => e[0] === i && e[1] === j)) continue;
    const h = B.cells[0];
    if (h && Math.abs(h[0] - i) + Math.abs(h[1] - j) < 5) continue;                 // never right under its nose
    B.eggs.push([i, j]); return;
  }
}

/** occupancy for the snake's thinking: 1 wall/lighthouse, 2 its own body, 3 your tail */
function grid(B) {
  const N = B.N, g = new Uint8Array(N * N);
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) if (isLight(B, i, j)) g[j * N + i] = 1;
  const keepTail = B.grow > 0;
  B.cells.forEach((c, k) => { if (k < B.cells.length - 1 || keepTail) g[c[1] * N + c[0]] = 2; });
  for (const p of G.tailPos) { const [i, j] = cellOf(B, p.x, p.wy); if (inside(B, i, j) && !g[j * N + i]) g[j * N + i] = 3; }
  return g;
}
/** breadth-first: distance from (i,j) to the nearest target cell, through free water */
function bfs(B, g, i, j, targets) {
  const N = B.N, dist = new Int16Array(N * N).fill(-1), q = [j * N + i]; dist[q[0]] = 0;
  const T = new Set(targets.map(([a, b]) => b * N + a));
  for (let h = 0; h < q.length; h++) {
    const c = q[h]; if (T.has(c)) return dist[c];
    const ci = c % N, cj = (c / N) | 0;
    for (const d of DIRS) {
      const c2 = nb(B, ci, cj, d); if (!c2) continue;
      const n = c2[1] * N + c2[0]; if (dist[n] >= 0 || (g[n] && !T.has(n))) continue;
      dist[n] = dist[c] + 1; q.push(n);
    }
  }
  return Infinity;
}
/** how much room there is from (i,j): the snake won't enter a pocket smaller than itself */
function room(B, g, i, j, cap) {
  const N = B.N, seen = new Uint8Array(N * N), q = [j * N + i]; seen[q[0]] = 1;
  for (let h = 0; h < q.length && q.length < cap; h++) {
    const c = q[h], ci = c % N, cj = (c / N) | 0;
    for (const d of DIRS) {
      const c2 = nb(B, ci, cj, d); if (!c2) continue;
      const n = c2[1] * N + c2[0]; if (seen[n] || g[n]) continue; seen[n] = 1; q.push(n);
    }
  }
  return q.length;
}

function think(B) {
  const g = grid(B), head = B.cells[0], len = B.cells.length;
  const lv = anger(B), N = B.N, look = SN.LOOK[lv];
  const [pi, pj] = cellOf(B, G.px, G.dist);
  const near = Math.abs(wd(B, (pi - head[0]) * SN.CELL)) / SN.CELL + Math.abs(wd(B, (pj - head[1]) * SN.CELL)) / SN.CELL;
  const hunt = !B.eggs.length || lv >= 2 || (near <= SN.HIT_AGGRO[lv] && (lv > 0 || len >= (G.tailN || 0)));   // calm: only when confident
  if (hunt && !B.hunting) nokia.hiss();
  B.hunting = hunt;
  // angry, he aims where you're going, not where you are; furious, he'll use the seams to cut you off
  let [ti, tj] = cellOf(B, G.px + G.mvx * look, G.dist + G.mvy * look);
  if (B.wrap) { ti = (ti % N + N) % N; tj = (tj % N + N) % N; } else { ti = Math.max(0, Math.min(N - 1, ti)); tj = Math.max(0, Math.min(N - 1, tj)); }
  const targets = hunt ? [[ti, tj]] : B.eggs;
  let best = null, costly = null;
  for (const d of DIRS) {
    if (d[0] === -B.dir[0] && d[1] === -B.dir[1]) continue;                             // no reversing, it's Snake
    const c2 = nb(B, head[0], head[1], d); if (!c2) continue;
    const [ni, nj] = c2, v = g[nj * B.N + ni];
    if (v === 1 || v === 2) continue;
    if (v === 3) { costly = costly || { d, ni, nj }; continue; }
    const safe = room(B, g, ni, nj, len * 3 + 20) >= len + 2;
    const dist = targets.length ? bfs(B, g, ni, nj, targets) : 0;
    const score = (safe ? 0 : 500) + (dist === Infinity ? 200 : dist) + Math.random() * 0.6;
    if (!best || score < best.score) best = { d, ni, nj, score };
  }
  return best || (costly && { ...costly, tail: true }) || null;
}

function cut(B, ni, nj) {
  // it ran into your tail: that kayak is sacrificed, and the snake loses its end
  let k = -1, bd = 1e9;
  G.tailPos.forEach((p, i) => { const d = Math.hypot(p.x - cx(B, ni), p.wy - cy(B, nj)); if (d < bd) { bd = d; k = i; } });
  if (k >= 0) { const p = G.tailPos[k]; burst(p.x, p.wy, 14, 120, 0.4); addFloater('SACRIFICED!', p.x, p.wy + 16, 1); }
  G.tailN = Math.max(0, (G.tailN || 0) - 1);
  for (let c = 0; c < SN.CUT && B.cells.length > SN.SLICE_FROM; c++) { const s = B.cells.pop(); burst(cx(B, s[0]), cy(B, s[1]), 6, 90, 0.35); }
  B.cuts++; B.grow = 0; B.lumps = [];
  nokia.cut(); G.shake = Math.max(G.shake, 5);
  addFloater('CUT OFF!', cx(B, ni), cy(B, nj) + 20, 2);
  hit(B, 'CUT TO PIECES');
}
function slice(B, k, p) {
  const gone = B.cells.splice(k);
  gone.forEach((s, i) => { burst(cx(B, s[0]), cy(B, s[1]), 5, 70 + i * 4, 0.4); addPart(cx(B, s[0]), cy(B, s[1]), 0, 0, 0.3, 8, 3); });
  burst(p.x, p.wy, 14, 130, 0.45); addFloater('SLICED! -' + gone.length, p.x, p.wy + 18, 2);
  G.tailN = Math.max(0, (G.tailN || 0) - 1); B.grow = 0; B.sliceCd = SN.SLICE_CD; B.cuts++;
  B.lumps = (B.lumps || []).filter((k) => k < B.cells.length);
  nokia.slice(); G.shake = Math.max(G.shake, 6);
  hit(B, 'SLICED TO BITS');
}
/** a hit: one life gone. He comes back faster and angrier; on his last life he smashes the walls */
function hit(B, how) {
  if (B.inv > 0 || B.phase !== 'fight') return;
  B.hp--; B.inv = SN.HIT_INV; B.stun = SN.STUN; B.hitT = B.t;
  const h = B.cells[0];
  if (h) addFloater(B.hp > 0 ? 'HIT! ' + B.hp + ' LEFT' : 'FINISHED!', cx(B, h[0]), cy(B, h[1]) + 24, 2);
  G.shake = Math.max(G.shake, 9); G.flash = 0.1;
  if (B.hp <= 0) { win(B, how); return; }
  nokia.cut(); setTimeout(() => nokia.hiss(), 250);
  if (B.hp === SN.BREAK_AT) breakWalls(B);
  else { G.banner = "HE'S ANGRY NOW\nFASTER. SMARTER. HUNTING YOU."; G.bannerT = 2.5; }
}
/** the final phase: the walls shatter and the arena wraps round, left to right and top to bottom */
function breakWalls(B) {
  B.wrap = true; B.breakT = 0;
  const C = SN.CELL, W = B.N * C;
  for (let k = 0; k < 80; k++) {                                  // the border bursts into pixels
    const side = k & 3, f = Math.random();
    const x = side === 0 ? B.x0 + f * W : side === 1 ? B.x0 + W : side === 2 ? B.x0 + f * W : B.x0;
    const y = side === 0 ? B.y0 + W : side === 1 ? B.y0 + f * W : side === 2 ? B.y0 : B.y0 + f * W;
    const out = [[0, 1], [1, 0], [0, -1], [-1, 0]][side];
    addPart(x, y, out[0] * (60 + Math.random() * 140) + (Math.random() - 0.5) * 60, out[1] * (60 + Math.random() * 140) + (Math.random() - 0.5) * 60, 0.6 + Math.random() * 0.6, 3);
  }
  nokia.slam(); setTimeout(() => nokia.over(), 120);
  G.shake = 14; G.flash = 0.2;
  G.banner = "HE'S SMASHED THE WALLS!\nTHE EDGES WRAP ROUND NOW"; G.bannerT = 3.5;
}
function win(B, how) {
  if (B.phase === 'won') return;
  B.phase = 'won'; B.deadT = 0; B.how = how;
  G.banner = 'SNAKE DEFEATED!\n' + how; G.bannerT = 3.5;
  nokia.win(); G.shake = 8; G.flash = 0.15; G.grinT = 3;
}

export function updateBoss(dt) {
  const B = G.boss; if (!B) return;
  B.t += dt;
  // keep her inside the arena
  const C = SN.CELL, x1 = B.x0 + B.N * C, y1 = B.y0 + B.N * C;
  if (B.wrap) {                                                   // the walls are gone: off one edge, on at the other
    const W = B.N * C;
    if (G.px < B.x0) G.px += W; else if (G.px >= x1) G.px -= W;
    if (G.dist < B.y0) G.dist += W; else if (G.dist >= y1) G.dist -= W;
  } else {
    if (G.px < B.x0 + 8) { G.px = B.x0 + 8; G.mvx = Math.max(0, G.mvx); } else if (G.px > x1 - 8) { G.px = x1 - 8; G.mvx = Math.min(0, G.mvx); }
    if (G.dist < B.y0 + 8) { G.dist = B.y0 + 8; G.mvy = Math.max(0, G.mvy); } else if (G.dist > y1 - 8) { G.dist = y1 - 8; G.mvy = Math.min(0, G.mvy); }
  }
  if (B.inv > 0) B.inv -= dt;
  if (B.breakT >= 0) B.breakT += dt;
  // your tail: kayaks spaced along your wake, like Snake
  const tr = G.trail, last = tr[tr.length - 1];
  if (sep(B, G.px, G.dist, last.x, last.wy) > 2) tr.push({ x: G.px, wy: G.dist });
  const need = ((G.tailN || 0) + 2) * SN.TAIL_GAP;
  let acc = 0, k = 1, prev = { x: G.px, wy: G.dist }; G.tailPos = [];
  for (let i = tr.length - 1; i >= 0 && k <= (G.tailN || 0); i--) {
    const p = tr[i], d = sep(B, prev.x, prev.wy, p.x, p.wy); acc += d;
    while (acc >= k * SN.TAIL_GAP && k <= G.tailN) { G.tailPos.push({ x: p.x, wy: p.wy, a: Math.atan2(wd(B, prev.x - p.x), wd(B, prev.wy - p.wy)) }); k++; }
    prev = p;
  }
  let total = 0, cutAt = 0;                                        // forget wake older than the tail needs
  for (let i = tr.length - 1; i > 0; i--) { total += sep(B, tr[i].x, tr[i].wy, tr[i - 1].x, tr[i - 1].wy); if (total > need + 40) { cutAt = i - 1; break; } }
  if (cutAt > 0) tr.splice(0, cutAt);

  if (B.phase === 'won') {
    B.deadT += dt;
    if (B.cells.length && B.deadT > 0.06) {                                 // it comes apart segment by segment
      B.deadT = 0; const s = B.cells.shift(); burst(cx(B, s[0]), cy(B, s[1]), 10, 130, 0.45, 3); addPart(cx(B, s[0]), cy(B, s[1]), 0, 0, 0.35, 10, 3); nokia.key();
    }
    if (!B.cells.length && (B.endT = (B.endT || 0) + dt) > 1.4) {
      // the prize: every tail kayak paddles off with a vape, plus levels, cash and a full heal
      for (const p of G.tailPos) { addFloater('+5', p.x, p.wy + 10, 1); burst(p.x, p.wy, 8, 90); }
      G.vapes += (G.tailN || 0) * 5; G.cash += SN.REWARD_CASH; G.pending += SN.REWARD_LEVELS; G.hp = G.maxHp;
      addFloater('+£' + SN.REWARD_CASH + '  +' + SN.REWARD_LEVELS + ' LEVELS', G.px, G.dist + 40, 2);
      G.tailN = 0; G.tailPos = []; G.boss = null; G.waveT = Math.max(G.waveT, 8); G.orcaT = Math.max(G.orcaT, 12);
      G.banner = "AWHHH, THIS ISN'T A VAPE SHOP :(\nFOLLOW THE LIGHT TO THE NEXT ONE"; G.bannerT = 4;
      calcStats();
    }
    return;
  }
  if (B.phase === 'intro') {
    // the arrival's sound and shake land on its beats
    const g = SN.T_GRID, w = SN.T_WALL;
    const beats = [...Array.from({ length: 10 }, (_, k) => [g[0] + (g[1] - g[0]) * k / 10, () => nokia.build(k)]),   // ticking outward, rising
      ...Array.from({ length: 6 }, (_, k) => [w[0] + (w[1] - w[0]) * k / 6, () => nokia.key()]),                 // the sparks racing round
      [w[1], () => { nokia.slam(); G.shake = 10; G.flash = 0.12; }],
      ...[0, 1, 2, 3, 4, 5].map((k) => [SN.T_CARD[0] + 0.2 + k * 0.3, () => nokia.key()]),
      ...Array.from({ length: SN.START_LEN }, (_, k) => [SN.T_SNAKE + k * 0.13, () => nokia.build(12 + k)]),   // the snake materialising
      [SN.T_READY, () => nokia.ready()], [SN.INTRO - 0.35, () => { nokia.go(); G.shake = 5; }]];
    while (B.cue < beats.length && B.t >= beats[B.cue][0]) beats[B.cue++][1]();
    if (B.t >= SN.INTRO) B.phase = 'fight';
    return;
  }

  // eggs: whoever gets there first
  for (let e = B.eggs.length - 1; e >= 0; e--) {
    const [i, j] = B.eggs[e];
    if (Math.hypot(G.px - cx(B, i), G.dist - cy(B, j)) < SN.EGG_R) {
      B.eggs.splice(e, 1); G.tailN = (G.tailN || 0) + SN.PLAYER_EGG; spawnEgg(B);
      addFloater('+1 TAIL', G.px, G.dist + 24, 2); burst(G.px, G.dist, 10, 90); nokia.egg(); G.grinT = 1;
    }
  }
  // your tail is a blade: drag a kayak through the snake's body and you slice it there. Everything behind the
  // cut falls away, and that kayak is sacrificed
  B.sliceCd = Math.max(0, (B.sliceCd || 0) - dt);
  if (B.sliceCd <= 0 && B.inv <= 0 && G.tailPos.length && B.cells.length > SN.SLICE_FROM) {
    outer: for (let t = 0; t < G.tailPos.length; t++) {
      const p = G.tailPos[t];
      for (let k = SN.SLICE_FROM; k < B.cells.length; k++) {
        const s = B.cells[k];
        if (sep(B, p.x, p.wy, cx(B, s[0]), cy(B, s[1])) < SN.SLICE_R) { slice(B, k, p); break outer; }
      }
    }
  }
  // the snake moves on its own clock, faster the longer it gets
  if (B.stun > 0) B.stun -= dt;
  else if (B.frozen) { /* developer: frozen in place */ }
  else {
    B.tickT += dt;
    const tick = Math.max(SN.TICK_MIN, SN.TICK - B.cells.length * SN.TICK_PER_SEG) * SN.HIT_SPEED[anger(B)];
    while (B.tickT >= tick && B.phase === 'fight' && B.stun <= 0) {
      B.tickT -= tick;
      const m = think(B);
      if (!m) {                                                   // boxed in: he crashes, it costs him a life, and he turns round
        B.cells.reverse(); const a = B.cells[0], b = B.cells[1]; if (b) B.dir = [a[0] - b[0], a[1] - b[1]];
        if (Math.abs(B.dir[0]) > 1 || Math.abs(B.dir[1]) > 1) B.dir = [-Math.sign(B.dir[0]), -Math.sign(B.dir[1])];
        addFloater('CRASHED!', cx(B, a[0]), cy(B, a[1]) + 20, 2); hit(B, 'TRAPPED AND CRASHED'); break;
      }
      if (m.tail) { cut(B, m.ni, m.nj); break; }
      B.dir = m.d; B.cells.unshift([m.ni, m.nj]);
      B.lumps = (B.lumps || []).map((k) => k + 1).filter((k) => k < B.cells.length);   // swallowed eggs travel down the body
      const egg = B.eggs.findIndex((e) => e[0] === m.ni && e[1] === m.nj);
      if (egg >= 0) { B.eggs.splice(egg, 1); B.grow += SN.EGG_GROW; B.eaten++; spawnEgg(B); nokia.eat(); (B.lumps = B.lumps || []).push(0); addFloater('GULP', cx(B, m.ni), cy(B, m.nj) + 16, 1); }
      if (B.grow > 0) B.grow--; else B.cells.pop();
    }
  }
  // contact: the head is death, the body bites
  if (B.phase === 'fight' && G.dashT <= 0 && !G.dead) {
    const h = B.cells[0];
    if (h && sep(B, G.px, G.dist, cx(B, h[0]), cy(B, h[1])) < SN.HEAD_R) { G.inv = 0; die('snake'); if (G.dead) nokia.over(); return; }
    for (let k = 1; k < B.cells.length; k++) {
      const s = B.cells[k], dx = wd(B, G.px - cx(B, s[0])), dy = wd(B, G.dist - cy(B, s[1])), d = Math.hypot(dx, dy);
      if (d < SN.BODY_R) { hurt(1, 'snake'); G.mvx = dx / (d || 1) * 220; G.mvy = dy / (d || 1) * 220; break; }
    }
  }
}

// ---- developer shortcuts (dev.js BOSS tab) ------------------------------------------------
export const bossDev = {
  skipIntro() { const B = G.boss; if (B && B.phase === 'intro') { B.t = SN.INTRO; B.cue = 999; B.phase = 'fight'; } },
  hit() { const B = G.boss; if (B && B.phase === 'fight') { B.inv = 0; hit(B, 'DEVELOPER HIT'); } },
  phase(lv) {                                                      // 0 calm, 1 angry, 2 furious (walls down)
    const B = G.boss; if (!B || B.phase === 'won') return;
    if (B.phase === 'intro') this.skipIntro();
    B.hp = SN.HP - lv; B.inv = 0;
    if (B.hp <= SN.BREAK_AT && !B.wrap) breakWalls(B); else if (B.hp > SN.BREAK_AT) { B.wrap = false; B.breakT = -1; }
  },
  smash() { const B = G.boss; if (B && !B.wrap) breakWalls(B); },
  tail(n) { G.tailN = Math.max(0, (G.tailN || 0) + n); },
  grow(n) { const B = G.boss; if (B) B.grow += n; },
  eggs() { const B = G.boss; if (B) for (let k = 0; k < 6; k++) spawnEgg(B); },
  freeze() { const B = G.boss; if (B) B.frozen = !B.frozen; return B && B.frozen; },
  win() { const B = G.boss; if (!B) return; if (B.phase === 'intro') this.skipIntro(); B.hp = 1; B.inv = 0; hit(B, 'DEVELOPER WIN'); },
  quit() { if (!G.boss) return; G.boss = null; G.tailN = 0; G.tailPos = []; G.trail = []; },
  info() {
    const B = G.boss; if (!B) return 'NO BOSS';
    return B.kind.toUpperCase() + ' ' + B.phase.toUpperCase() + '  LIVES ' + B.hp + '/' + SN.HP + '  LEN ' + B.cells.length + '  TAIL ' + (G.tailN || 0) +
      '  ' + (B.wrap ? 'WRAP ' : '') + (B.hunting ? 'HUNT ' : '') + (B.frozen ? 'FROZEN' : '');
  },
};

/** open-water autopilot during the boss: race for eggs, keep clear of the head */
export function bossBotStick() {
  const B = G.boss; if (!B || !B.cells.length) return { x: 0, y: 0 };
  let tx = 0, ty = 0;
  if (B.eggs.length) {
    let best = null; for (const [i, j] of B.eggs) { const d = Math.hypot(cx(B, i) - G.px, cy(B, j) - G.dist); if (!best || d < best.d) best = { d, x: cx(B, i), y: cy(B, j) }; }
    tx = best.x - G.px; ty = best.y - G.dist;
  }
  let n = Math.hypot(tx, ty) || 1; tx /= n; ty /= n;
  B.cells.forEach((s, k) => {
    const dx = G.px - cx(B, s[0]), dy = G.dist - cy(B, s[1]), d = Math.hypot(dx, dy), R = k ? 34 : 90;
    if (d < R && d > 0) { tx += dx / d * (k ? 1.2 : 3.5); ty += dy / d * (k ? 1.2 : 3.5); }
  });
  n = Math.hypot(tx, ty) || 1;
  return { x: tx / n, y: ty / n };
}
export function bossBotDash() {
  const B = G.boss; if (!B || !B.cells.length || B.phase !== 'fight') return false;
  const h = B.cells[0]; return Math.hypot(G.px - cx(B, h[0]), G.dist - cy(B, h[1])) < 36;
}

// ---- drawing (world space; `sy` maps world y to the screen) ---------------------------------
export function drawBoss(sy) {
  const B = G.boss; if (!B) return;
  const C = SN.CELL, W = B.N * C, x0 = Math.round(B.x0), top = sy(B.y0 + W), bot = sy(B.y0);
  const t = B.t, prog = (a) => Math.max(0, Math.min(1, (t - a[0]) / (a[1] - a[0])));
  const grid = prog(SN.T_GRID), wall = prog(SN.T_WALL), N = B.N, mid = (N - 1) / 2, maxR = Math.hypot(mid, mid) + 1;
  // the grid: cell by cell, rippling out from the lighthouse, the leading edge burning bright
  if (grid >= 1) rect(x0, top, W, W, LCD.FLOOR);
  else for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const d = Math.hypot(i - mid, j - mid) / maxR - grid; if (d > 0) continue;
    rect(x0 + i * C, sy(B.y0 + (j + 1) * C), C - (d > -0.06 ? 2 : 0), C - (d > -0.06 ? 2 : 0), d > -0.06 ? LCD.HEAD : LCD.FLOOR);
  }
  ctx.fillStyle = LCD.GRID;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) if (grid >= 1 || Math.hypot(i - mid - 0.5, j - mid - 0.5) / maxR < grid) ctx.fillRect(x0 + i * C - 1, sy(B.y0 + j * C) - 1, 2, 2);
  // the border: racing round the edge from opposite corners, then slamming shut
  if (wall <= 0) return;
  const slam = t >= SN.T_WALL[1] && t < SN.T_WALL[1] + 0.25, col = slam ? '#fff' : LCD.EDGE;
  if (B.wrap) {                                                   // smashed: a broken, flickering edge you can cross
    const on = ((t * 8) | 0) & 1;
    for (let k = 0; k < B.N; k++) {
      if (((k + (on ? 1 : 0)) % 3) === 0) continue;
      const c = (k + ((t * 6) | 0)) % 4 ? LCD.EDGE : '#fff';
      rect(x0 + k * C + 2, top - 5, C - 4, 2, c); rect(x0 + k * C + 2, top + W + 3, C - 4, 2, c);
      rect(x0 - 5, top + k * C + 2, 2, C - 4, c); rect(x0 + W + 3, top + k * C + 2, 2, C - 4, c);
    }
    const a = ((t * 3) | 0) & 1 ? COLORS.GINGER : LCD.HEAD, m = W / 2;                 // wrap arrows on every side
    for (const [ax, ay, dx, dy] of [[x0 - 12, top + m, -1, 0], [x0 + W + 12, top + m, 1, 0], [x0 + m, top - 12, 0, -1], [x0 + m, top + W + 12, 0, 1]])
      for (let k = 0; k < 4; k++) rect(ax + dx * k * 2 - (dy ? k : 0) - 1, ay + dy * k * 2 - (dx ? k : 0) - 1, dy ? k * 2 + 2 : 2, dx ? k * 2 + 2 : 2, a);
    return;
  }
  if (wall >= 1) { rect(x0 - 8, top - 8, W + 16, 6, '#000'); rect(x0 - 8, top + W + 2, W + 16, 6, '#000'); rect(x0 - 8, top - 8, 6, W + 16, '#000'); rect(x0 + W + 2, top - 8, 6, W + 16, '#000');
    rect(x0 - 6, top - 6, W + 12, 4, col); rect(x0 - 6, top + W + 2, W + 12, 4, col); rect(x0 - 6, top - 6, 4, W + 12, col); rect(x0 + W + 2, top - 6, 4, W + 12, col);
    if (slam) for (let k = 0; k < 4; k++) rect(x0 - 10 - k * 6, top - 10 - k * 6, W + 20 + k * 12, 1, '#fff');
    return; }
  const P = 2 * W * wall;                                       // each runner covers half the perimeter
  const run = (sx, sy0, dirs) => {
    let left = P, x = sx, y = sy0;
    for (const [dx, dy] of dirs) {
      const seg = Math.min(left, W); if (seg <= 0) break;
      const ex = x + dx * seg, ey = y + dy * seg;
      rect(Math.min(x, ex) - 2, Math.min(y, ey) - 2, Math.abs(ex - x) + 4, Math.abs(ey - y) + 4, LCD.EDGE);
      left -= seg; x = ex; y = ey;
    }
    rect(x - 5, y - 5, 10, 10, '#fff'); rect(x - 2, y - 2, 4, 4, COLORS.GINGER);     // the spark
  };
  run(x0 - 4, top - 4, [[1, 0], [0, 1]]); run(x0 + W + 4, top + W + 4, [[-1, 0], [0, -1]]);
}
/** everything that moves, drawn over the lighthouse so nothing hides behind the tower */
export function drawBossTop(sy) {
  const B = G.boss; if (!B) return;
  if (B.phase === 'intro' && B.t < SN.T_GRID[1]) return;                  // nothing until the grid is built
  // eggs: speckled, wobbling
  for (const [i, j] of B.eggs) {
    const x = Math.round(cx(B, i)), y = sy(cy(B, j)) + Math.round(Math.sin(B.t * 6 + i) * 1);
    rect(x - 4, y - 5, 8, 10, '#f4f1e1'); rect(x - 3, y - 6, 6, 1, '#f4f1e1'); rect(x - 3, y + 5, 6, 1, '#f4f1e1');
    rect(x - 2, y - 2, 1, 1, LCD.SNAKE_DARK); rect(x + 1, y + 1, 1, 1, LCD.SNAKE_DARK); rect(x - 1, y + 3, 1, 1, LCD.SNAKE_DARK);
  }
  // the snake: chunky LCD blocks, a head with eyes and a flicking tongue
  const lv = anger(B), body = [LCD.SNAKE, '#e0b83a', ((B.t * 6) | 0) & 1 ? '#ff5a3c' : '#d83a2a'][lv], headC = [LCD.HEAD, '#ffd75a', '#ff8a5a'][lv];
  const flash = (B.stun > 0 || B.inv > 0) && ((B.t * 16) & 1);
  const vis = B.phase === 'intro' ? Math.max(0, Math.min(B.cells.length, Math.floor((B.t - SN.T_SNAKE) / 0.13))) : B.cells.length;
  for (let k = B.cells.length - 1; k >= 0; k--) {
    if (k >= vis) continue;
    const [i, j] = B.cells[k], x = Math.round(cx(B, i)), y = sy(cy(B, j)), lump = k && B.lumps && B.lumps.includes(k) ? 2 : 0;
    rect(x - 7 - lump, y - 7 - lump, 14 + lump * 2, 14 + lump * 2, LCD.SNAKE_DARK);                // a swallowed egg bulges as it travels down
    rect(x - 6 - lump, y - 6 - lump, 12 + lump * 2, 12 + lump * 2, flash ? '#fff' : k ? body : headC);
    if (lump) rect(x - 3, y - 3, 6, 6, '#f4f1e1');
    else if (k && (k & 1)) rect(x - 2, y - 2, 4, 4, LCD.SNAKE_DARK);
  }
  const h = B.cells[0];
  if (h && vis) {
    const x = Math.round(cx(B, h[0])), y = sy(cy(B, h[1])), dx = B.dir[0], dy = -B.dir[1];
    const px = -dy, py = dx;                                        // perpendicular, for the two eyes
    const eye = B.hunting ? COLORS.ENEMY : '#000';                   // red eyes: it's hunting you
    rect(x + dx * 2 + px * 3 - 1, y + dy * 2 + py * 3 - 1, 3, 3, eye); rect(x + dx * 2 - px * 3 - 1, y + dy * 2 - py * 3 - 1, 3, 3, eye);
    const ahead = B.eggs.some((e) => e[0] === h[0] + B.dir[0] && e[1] === h[1] + B.dir[1]);
    if (ahead) {                                                     // an egg right in front: the mouth opens, like the original
      for (let k = 0; k < 4; k++) rect(x + dx * (6 - k) + px * (-k) - 1 + (dx < 0 ? 1 : 0), y + dy * (6 - k) + py * (-k) - 1 + (dy < 0 ? 1 : 0), dx ? 2 : k * 2 + 1, dy ? 2 : k * 2 + 1, LCD.FLOOR);
    } else if (((B.t * 5) | 0) & 1) { rect(x + dx * 8 - (dx ? 0 : 1), y + dy * 8 - (dy ? 0 : 1), dx ? 5 : 2, dy ? 5 : 2, COLORS.ENEMY); }
  }
  // across a seam you're on both sides at once, so you can see where you'll come out
  if (B.wrap) {
    const Wd = B.N * SN.CELL, k = SPR.kayak[G.paddle], gx = G.px - B.x0 < 26 ? Wd : B.x0 + Wd - G.px < 26 ? -Wd : 0, gy = G.dist - B.y0 < 26 ? Wd : B.y0 + Wd - G.dist < 26 ? -Wd : 0;
    ctx.globalAlpha = 0.55;
    for (const [ox, oy] of [[gx, 0], [0, gy], [gx, gy]]) if (ox || oy) { ctx.save(); ctx.translate(Math.round(G.px + ox), sy(G.dist + oy)); ctx.rotate(G.heading || 0); ctx.drawImage(k, -(k.width >> 1), -(k.height >> 1)); ctx.restore(); }
    ctx.globalAlpha = 1;
  }
  // your tail: a line of Angies in kayaks following your wake
  for (const p of G.tailPos) {
    const k = SPR.kayak[((B.t * 3) | 0) & 1];
    ctx.save(); ctx.translate(Math.round(p.x), sy(p.wy)); ctx.rotate(p.a); ctx.drawImage(k, -(k.width >> 1), -(k.height >> 1)); ctx.restore();
  }
}
/** a strip under the banner: who's longer is who's winning */
export function bossHud(W) {
  const B = G.boss; if (!B || B.phase === 'won') return;
  const t = B.t, H = view.H;
  if (B.phase === 'intro' && t >= SN.T_CARD[0] && t < SN.T_CARD[1]) {
    // NEW ZONE, NEW RULES: a card that writes itself, line by line
    ctx.fillStyle = '#000'; for (let y = 0; y < H; y += 2) ctx.fillRect(0, y, W, 1);
    const k = t - SN.T_CARD[0], out = SN.T_CARD[1] - t, slide = Math.round(Math.max(0, 1 - k * 5) * -60 + Math.max(0, 1 - out * 5) * 60);
    const y0 = Math.round(H * 0.24) + slide, w = W - 40;
    rect(20, y0, w, 250, '#000'); box(20, y0, w, 250, LCD.EDGE, 3); box(26, y0 + 6, w - 12, 238, LCD.GRID, 1);
    text('LIGHTHOUSE 1 - NEW ZONE', W / 2, y0 + 16, 2, COLORS.GINGER, 0.5);
    textO('SNAKE', W / 2, y0 + 34, 8, LCD.SNAKE, 0.5);
    text("YOU'RE LOCKED IN. NEW RULES:", W / 2, y0 + 82, 2, '#fff', 0.5);
    const rules = [['EAT EGGS: GROW A TAIL', '#f4f1e1'], ['DRAG YOUR TAIL THROUGH HIM', LCD.HEAD], ['EACH SLICE COSTS ONE KAYAK', LCD.HEAD],
      ['HIS HEAD IS INSTANT DEATH', COLORS.ENEMY], ["VAPES DON'T WORK IN HERE", '#9aa7b0'], ['DASH TO SLIP PAST HIM', '#fff']];
    rules.forEach(([s, c], i) => {
      const at = 0.2 + i * 0.3; if (k < at) return;
      const n = Math.min(s.length, Math.floor((k - at) * 60)), y = y0 + 104 + i * 22;
      rect(34, y + 1, 8, 8, c); text(s.slice(0, n), 50, y, 2, c);
    });
    return;
  }
  if (t >= SN.T_READY && t < SN.INTRO + 0.6) {
    const go = t >= SN.INTRO - 0.35, s = go ? 'GO!' : 'READY...', sc = go ? 10 : 5;
    if (!go || ((t * 10) | 0) & 1 || t < SN.INTRO) textO(s, W / 2, H * 0.3, sc, go ? LCD.HEAD : '#fff', 0.5);
  }
  if (B.phase === 'intro') return;
  // the score, on a little phone screen: green LCD, dark pixels
  const ahead = (G.tailN || 0) >= B.cells.length, x0 = W / 2 - 100, y0 = 34;
  rect(x0 - 3, y0 - 3, 206, 30, '#000'); rect(x0 - 1, y0 - 1, 202, 26, LCD.EDGE); rect(x0, y0, 200, 24, '#9bbc0f');
  text('SNAKE', x0 + 6, y0 + 3, 1, LCD.SNAKE_DARK); text(String(B.cells.length).padStart(3, '0'), x0 + 6, y0 + 11, 2, LCD.SNAKE_DARK);
  text('YOUR TAIL', x0 + 194, y0 + 3, 1, LCD.SNAKE_DARK, 1); text(String(G.tailN || 0).padStart(3, '0'), x0 + 194, y0 + 11, 2, LCD.SNAKE_DARK, 1);
  text(ahead ? '>' : '<', W / 2, y0 + 8, 2, ahead ? '#306230' : '#0f380f', 0.5);
  // his lives: three chunky LCD blocks; a fresh loss blinks
  const hx = W / 2 - 46, hy = y0 + 28, lost = t - B.hitT < 1.2 && ((t * 10) | 0) & 1;
  rect(hx - 3, hy - 2, 98, 14, '#000');
  for (let k = 0; k < SN.HP; k++) {
    const alive = k < B.hp || (lost && k === B.hp);
    rect(hx + k * 32, hy, 28, 10, LCD.SNAKE_DARK);
    rect(hx + k * 32 + 1, hy + 1, 26, 8, alive ? ['#9bbc0f', '#e0b83a', '#ff5a3c'][anger(B)] : '#1c2a1c');
  }
  if (B.hunting && ((t * 4) | 0) & 1) text(anger(B) >= 2 ? 'FURIOUS!' : 'HUNTING!', W / 2, y0 + 44, 1, COLORS.ENEMY, 0.5);
}
