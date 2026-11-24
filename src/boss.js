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
import { G, enemies, clouds, burst, addFloater, addPart, die, hurt, calcStats } from './game.js';
import { ctx, rect, textO, SPR } from './gfx.js';
import { sfx } from './platform.js';

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
  G.banner = 'LIGHTHOUSE BOSS 1: SNAKE\nEAT EGGS. GROW A TAIL. CUT HIM OFF.'; G.bannerT = SN.INTRO + 0.5;
  sfx.level(); G.shake = 6;
}

const cx = (B, i) => B.x0 + (i + 0.5) * SN.CELL, cy = (B, j) => B.y0 + (j + 0.5) * SN.CELL;
const inside = (B, i, j) => i >= 0 && j >= 0 && i < B.N && j < B.N;
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
    for (const [dx, dy] of DIRS) {
      const ni = ci + dx, nj = cj + dy; if (!inside(B, ni, nj)) continue;
      const n = nj * N + ni; if (dist[n] >= 0 || (g[n] && !T.has(n))) continue;
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
    for (const [dx, dy] of DIRS) {
      const ni = ci + dx, nj = cj + dy; if (!inside(B, ni, nj)) continue;
      const n = nj * N + ni; if (seen[n] || g[n]) continue; seen[n] = 1; q.push(n);
    }
  }
  return q.length;
}

function think(B) {
  const g = grid(B), head = B.cells[0], len = B.cells.length;
  const [pi, pj] = cellOf(B, G.px, G.dist);
  const near = Math.abs(pi - head[0]) + Math.abs(pj - head[1]);
  const hunt = !B.eggs.length || (near <= SN.AGGRO_CELLS && len >= (G.tailN || 0));    // confident: go for you
  const targets = hunt && inside(B, pi, pj) ? [[pi, pj]] : B.eggs;
  let best = null, costly = null;
  for (const d of DIRS) {
    if (d[0] === -B.dir[0] && d[1] === -B.dir[1]) continue;                             // no reversing, it's Snake
    const ni = head[0] + d[0], nj = head[1] + d[1];
    if (!inside(B, ni, nj)) continue;
    const v = g[nj * B.N + ni];
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
  for (let c = 0; c < SN.CUT && B.cells.length; c++) { const s = B.cells.pop(); burst(cx(B, s[0]), cy(B, s[1]), 6, 90, 0.35); }
  B.cuts++; B.stun = SN.STUN; B.grow = 0;
  sfx.nova(); G.shake = Math.max(G.shake, 5);
  addFloater('CUT OFF!', cx(B, ni), cy(B, nj) + 20, 2);
  if (B.cells.length <= SN.DIE_AT) win(B, 'CUT TO PIECES');
}
function slice(B, k, p) {
  const gone = B.cells.splice(k);
  gone.forEach((s, i) => { burst(cx(B, s[0]), cy(B, s[1]), 5, 70 + i * 4, 0.4); addPart(cx(B, s[0]), cy(B, s[1]), 0, 0, 0.3, 8, 3); });
  burst(p.x, p.wy, 14, 130, 0.45); addFloater('SLICED! -' + gone.length, p.x, p.wy + 18, 2);
  G.tailN = Math.max(0, (G.tailN || 0) - 1); B.grow = 0; B.stun = SN.STUN * 0.6; B.sliceCd = SN.SLICE_CD; B.cuts++;
  sfx.nova(); G.shake = Math.max(G.shake, 6);
  if (B.cells.length <= SN.DIE_AT) win(B, 'SLICED TO BITS');
}
function win(B, how) {
  if (B.phase === 'won') return;
  B.phase = 'won'; B.deadT = 0; B.how = how;
  G.banner = 'SNAKE DEFEATED!\n' + how; G.bannerT = 3.5;
  sfx.big(); G.shake = 8; G.flash = 0.15; G.grinT = 3;
}

export function updateBoss(dt) {
  const B = G.boss; if (!B) return;
  B.t += dt;
  // keep her inside the arena
  const C = SN.CELL, x1 = B.x0 + B.N * C, y1 = B.y0 + B.N * C;
  if (G.px < B.x0 + 8) { G.px = B.x0 + 8; G.mvx = Math.max(0, G.mvx); } else if (G.px > x1 - 8) { G.px = x1 - 8; G.mvx = Math.min(0, G.mvx); }
  if (G.dist < B.y0 + 8) { G.dist = B.y0 + 8; G.mvy = Math.max(0, G.mvy); } else if (G.dist > y1 - 8) { G.dist = y1 - 8; G.mvy = Math.min(0, G.mvy); }
  // your tail: kayaks spaced along your wake, like Snake
  const tr = G.trail, last = tr[tr.length - 1];
  if (Math.hypot(G.px - last.x, G.dist - last.wy) > 2) tr.push({ x: G.px, wy: G.dist });
  const need = ((G.tailN || 0) + 2) * SN.TAIL_GAP;
  let acc = 0, k = 1, prev = { x: G.px, wy: G.dist }; G.tailPos = [];
  for (let i = tr.length - 1; i >= 0 && k <= (G.tailN || 0); i--) {
    const p = tr[i], d = Math.hypot(prev.x - p.x, prev.wy - p.wy); acc += d;
    while (acc >= k * SN.TAIL_GAP && k <= G.tailN) { G.tailPos.push({ x: p.x, wy: p.wy, a: Math.atan2(prev.x - p.x, prev.wy - p.wy) }); k++; }
    prev = p;
  }
  let total = 0, cutAt = 0;                                        // forget wake older than the tail needs
  for (let i = tr.length - 1; i > 0; i--) { total += Math.hypot(tr[i].x - tr[i - 1].x, tr[i].wy - tr[i - 1].wy); if (total > need + 40) { cutAt = i - 1; break; } }
  if (cutAt > 0) tr.splice(0, cutAt);

  if (B.phase === 'won') {
    B.deadT += dt;
    if (B.cells.length && B.deadT > 0.06) {                                 // it comes apart segment by segment
      B.deadT = 0; const s = B.cells.shift(); burst(cx(B, s[0]), cy(B, s[1]), 10, 130, 0.45, 3); addPart(cx(B, s[0]), cy(B, s[1]), 0, 0, 0.35, 10, 3); sfx.kill();
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
  if (B.phase === 'intro') { if (B.t >= SN.INTRO) B.phase = 'fight'; return; }

  // eggs: whoever gets there first
  for (let e = B.eggs.length - 1; e >= 0; e--) {
    const [i, j] = B.eggs[e];
    if (Math.hypot(G.px - cx(B, i), G.dist - cy(B, j)) < SN.EGG_R) {
      B.eggs.splice(e, 1); G.tailN = (G.tailN || 0) + SN.PLAYER_EGG; spawnEgg(B);
      addFloater('+1 TAIL', G.px, G.dist + 24, 2); burst(G.px, G.dist, 10, 90); sfx.big(); G.grinT = 1;
    }
  }
  // your tail is a blade: drag a kayak through the snake's body and you slice it there. Everything behind the
  // cut falls away, and that kayak is sacrificed
  B.sliceCd = Math.max(0, (B.sliceCd || 0) - dt);
  if (B.sliceCd <= 0 && G.tailPos.length && B.cells.length > SN.DIE_AT) {
    outer: for (let t = 0; t < G.tailPos.length; t++) {
      const p = G.tailPos[t];
      for (let k = SN.SLICE_FROM; k < B.cells.length; k++) {
        const s = B.cells[k];
        if (Math.hypot(p.x - cx(B, s[0]), p.wy - cy(B, s[1])) < SN.SLICE_R) { slice(B, k, p); break outer; }
      }
    }
  }
  // the snake moves on its own clock, faster the longer it gets
  if (B.stun > 0) B.stun -= dt;
  else {
    B.tickT += dt;
    const tick = Math.max(SN.TICK_MIN, SN.TICK - B.cells.length * SN.TICK_PER_SEG);
    while (B.tickT >= tick && B.phase === 'fight' && B.stun <= 0) {
      B.tickT -= tick;
      const m = think(B);
      if (!m) { win(B, 'TRAPPED AND CRASHED'); break; }
      if (m.tail) { cut(B, m.ni, m.nj); break; }
      B.dir = m.d; B.cells.unshift([m.ni, m.nj]);
      const egg = B.eggs.findIndex((e) => e[0] === m.ni && e[1] === m.nj);
      if (egg >= 0) { B.eggs.splice(egg, 1); B.grow += SN.EGG_GROW; B.eaten++; spawnEgg(B); sfx.no(); addFloater('GULP', cx(B, m.ni), cy(B, m.nj) + 16, 1); }
      if (B.grow > 0) B.grow--; else B.cells.pop();
    }
  }
  // contact: the head is death, the body bites
  if (B.phase === 'fight' && G.dashT <= 0 && !G.dead) {
    const h = B.cells[0];
    if (h && Math.hypot(G.px - cx(B, h[0]), G.dist - cy(B, h[1])) < SN.HEAD_R) { G.inv = 0; die('snake'); return; }
    for (let k = 1; k < B.cells.length; k++) {
      const s = B.cells[k], dx = G.px - cx(B, s[0]), dy = G.dist - cy(B, s[1]), d = Math.hypot(dx, dy);
      if (d < SN.BODY_R) { hurt(1, 'snake'); G.mvx = dx / (d || 1) * 220; G.mvy = dy / (d || 1) * 220; break; }
    }
  }
}

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
  // a Nokia-green LCD floor with a faint cell grid, inside a chunky bezel
  rect(x0 - 8, top - 8, W + 16, W + 16, '#000'); rect(x0 - 6, top - 6, W + 12, W + 12, LCD.EDGE); rect(x0 - 2, top - 2, W + 4, W + 4, '#000');
  rect(x0, top, W, W, LCD.FLOOR);
  ctx.fillStyle = LCD.GRID;
  for (let i = 0; i <= B.N; i++) for (let j = 0; j <= B.N; j++) ctx.fillRect(x0 + i * C - 1, sy(B.y0 + j * C) - 1, 2, 2);
}
/** everything that moves, drawn over the lighthouse so nothing hides behind the tower */
export function drawBossTop(sy) {
  const B = G.boss; if (!B) return;
  // eggs: speckled, wobbling
  for (const [i, j] of B.eggs) {
    const x = Math.round(cx(B, i)), y = sy(cy(B, j)) + Math.round(Math.sin(B.t * 6 + i) * 1);
    rect(x - 4, y - 5, 8, 10, '#f4f1e1'); rect(x - 3, y - 6, 6, 1, '#f4f1e1'); rect(x - 3, y + 5, 6, 1, '#f4f1e1');
    rect(x - 2, y - 2, 1, 1, LCD.SNAKE_DARK); rect(x + 1, y + 1, 1, 1, LCD.SNAKE_DARK); rect(x - 1, y + 3, 1, 1, LCD.SNAKE_DARK);
  }
  // the snake: chunky LCD blocks, a head with eyes and a flicking tongue
  const flash = B.stun > 0 && ((B.t * 16) & 1);
  for (let k = B.cells.length - 1; k >= 0; k--) {
    const [i, j] = B.cells[k], x = Math.round(cx(B, i)), y = sy(cy(B, j));
    rect(x - 7, y - 7, 14, 14, LCD.SNAKE_DARK);
    rect(x - 6, y - 6, 12, 12, flash ? '#fff' : k ? LCD.SNAKE : LCD.HEAD);
    if (k && (k & 1)) rect(x - 2, y - 2, 4, 4, LCD.SNAKE_DARK);
  }
  const h = B.cells[0];
  if (h) {
    const x = Math.round(cx(B, h[0])), y = sy(cy(B, h[1])), dx = B.dir[0], dy = -B.dir[1];
    const px = -dy, py = dx;                                        // perpendicular, for the two eyes
    rect(x + dx * 2 + px * 3 - 1, y + dy * 2 + py * 3 - 1, 3, 3, '#000'); rect(x + dx * 2 - px * 3 - 1, y + dy * 2 - py * 3 - 1, 3, 3, '#000');
    if (((B.t * 5) | 0) & 1) { rect(x + dx * 8 - (dx ? 0 : 1), y + dy * 8 - (dy ? 0 : 1), dx ? 5 : 2, dy ? 5 : 2, COLORS.ENEMY); }
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
  const s = 'SNAKE ' + B.cells.length + '   YOUR TAIL ' + (G.tailN || 0);
  rect(W / 2 - 92, 36, 184, 16, '#000'); textO(s, W / 2, 40, 2, (G.tailN || 0) >= B.cells.length ? COLORS.GINGER : '#fff', 0.5);
}
