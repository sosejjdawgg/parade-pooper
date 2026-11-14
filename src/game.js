// Simulation: canal, chunks, pickups, enemies, weapons, level-ups. No drawing here.
import {
  VIEW, WORLD, PLAYER, ENGINE, XP, PICKUPS, BIOMES, HAZARDS, ENEMIES, SPAWN,
  WEAPONS, PASSIVES, EVOLUTIONS, LEVELUP, REWARD, JUICE, VAPING, FLAVOUR,
} from './config.js';
import { view } from './gfx.js';
import { save, shopLvl, writeSave, sfx, input } from './platform.js';

class Pool {
  constructor(max) { this.items = []; this.n = 0; this.max = max; }
  spawn() {
    if (this.n >= this.max) return null;
    let o = this.items[this.n];
    if (!o) o = this.items[this.n] = {};
    this.n++; o.dead = false; return o;
  }
  sweep() {
    let i = 0;
    while (i < this.n) {
      const o = this.items[i];
      if (o.dead) { this.n--; this.items[i] = this.items[this.n]; this.items[this.n] = o; } else i++;
    }
  }
}
export const vapes = new Pool(400), enemies = new Pool(SPAWN.MAX_ALIVE + 20), hazards = new Pool(160),
  clouds = new Pool(600), parts = new Pool(JUICE.MAX_PARTICLES), floaters = new Pool(JUICE.MAX_FLOATERS);
const pools = [vapes, enemies, hazards, clouds, parts, floaters];

export const G = { mode: 'title', ph: [0, 0, 0], dist: 0, t: 0, bot: false };
export const S = { area: 1, dmg: 1, cd: 1, dur: 1, magnet: 1, nudge: 1, xp: 1, cash: 1 };
export const orbs = [];

const rnd = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
const pick = (arr) => arr[(Math.random() * arr.length) | 0];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const lerp3 = (a, b) => b <= 1 ? a[0] + (a[1] - a[0]) * b : a[1] + (a[2] - a[1]) * (b - 1);
export const playerY = () => Math.round(view.H * VIEW.PLAYER_Y);
export const metres = () => Math.floor(G.dist / WORLD.PX_PER_M);

// ---- canal shape: pure functions of world-y, so nothing needs storing --------
export function biomeAt(wy) {
  const m = wy / WORLD.PX_PER_M;
  return smooth((m - BIOMES.DESERT_AT) / BIOMES.BLEND) + smooth((m - BIOMES.JUNGLE_AT) / BIOMES.BLEND);
}
export function widthAt(wy) { return lerp3(BIOMES.WIDTH, biomeAt(wy)) + 10 * Math.sin(wy * 0.0037 + G.ph[2]); }
export function centreAt(wy) {
  const amp = clamp((VIEW.W - widthAt(wy)) / 2 - 24, 0, BIOMES.MEANDER);
  return VIEW.W / 2 + amp * (0.6 * Math.sin(wy * 0.0052 + G.ph[0]) + 0.4 * Math.sin(wy * 0.0113 + G.ph[1]));
}
export const leftAt = (wy) => centreAt(wy) - widthAt(wy) / 2;
export const rightAt = (wy) => centreAt(wy) + widthAt(wy) / 2;
const laneX = (wy, f, margin = 18) => { const l = leftAt(wy) + margin, r = rightAt(wy) - margin; return l + (r - l) * f; };

// ---- run lifecycle ------------------------------------------------------------
export function newRun() {
  for (const p of pools) p.n = 0;
  orbs.length = 0;
  Object.assign(G, {
    t: 0, dist: 0, speed: PLAYER.SPEED_START, burst: 0, slow: 1, snag: 0, pvx: 0, holdT: 0, paddle: 0, paddleT: 0,
    hp: 0, maxHp: 0, inv: 1, vapes: 0, cash: 0, xp: 0, level: 1, xpNeed: XP.need(1), kills: 0, combo: 0, comboT: 0,
    weapons: { cloud: 1 + shopLvl('starter') }, passives: {}, evo: {},
    cd: { cloud: 0.5, trail: 0, nova: 1.5, rings: 0.5 }, orbA: 0, orbTick: 0, cloudId: 0,
    genY: 240, chunkN: 0, spawnT: 0, shake: 0, flash: 0, hitstop: 0, dead: false, deadT: 0,
    banner: BIOMES.NAMES[0], bannerT: 2.5, biomeIdx: 0, pending: 0, choices: null, cause: '', result: null, puffT: 0, vapeT: 2.5, dragT: 0, hurtT: 0, grinT: 0,
  });
  G.ph = [rnd(6.28), rnd(6.28), rnd(6.28)];
  G.px = centreAt(0);
  calcStats();
  G.hp = G.maxHp;
  G.mode = 'play';
}
const plvl = (id) => G.passives[id] || 0;
function calcStats() {
  S.area = 1 + plvl('lungs') * PASSIVES.lungs.per;
  S.dmg = 1;
  S.cd = Math.pow(1 - PASSIVES.chain.per, plvl('chain'));
  S.dur = 1 + plvl('linger') * PASSIVES.linger.per;
  S.magnet = (1 + plvl('magnet') * PASSIVES.magnet.per) * (1 + shopLvl('magnet') * 0.15);
  S.nudge = 1 + plvl('paddle') * PASSIVES.paddle.per;
  S.xp = 1 + shopLvl('xp') * 0.1;
  S.cash = 1 + shopLvl('cash') * 0.2;
  G.maxHp = PLAYER.HEARTS + shopLvl('heart') + plvl('hivis');
}
/** current stats of a weapon (evolved form if evolved) */
export function wp(id) {
  const w = WEAPONS[id];
  return G.evo[id] ? { ...w.levels[w.maxLvl - 1], ...w.evo, prox: 0 } : w.levels[G.weapons[id] - 1];
}

// ---- spawning helpers ---------------------------------------------------------
function addPickup(kind, x, wy) {
  const v = vapes.spawn(); if (!v) return;
  v.kind = kind; v.wy = wy; v.x = clamp(x, leftAt(wy) + 10, rightAt(wy) - 10);
  v.age = 0; v.ang = rnd(6.28); v.mag = false;
}
const addVape = (x, wy, big) => addPickup(big || Math.random() < PICKUPS.BIG_CHANCE ? 'big' : 'vape', x, wy);
function addHazard(type, x, wy, hw, hh, extra) {
  const h = hazards.spawn(); if (!h) return null;
  h.type = type; h.x = x; h.wy = wy; h.hw = hw; h.hh = hh; h.vx = 0; h.fake = false; h.seed = (Math.random() * 1e6) | 0; h.len = 0; h.side = 0;
  if (extra) Object.assign(h, extra);
  return h;
}
export function addPart(x, wy, vx, vwy, life, size = 2, spr = 0) {
  const p = parts.spawn(); if (!p) return;
  p.x = x; p.wy = wy; p.vx = vx; p.vwy = vwy; p.age = 0; p.life = life; p.size = size; p.spr = spr;
}
function burst(x, wy, n, speed, life = 0.4, size = 2) {
  for (let i = 0; i < n; i++) { const a = rnd(6.28), s = rnd(0.3, 1) * speed; addPart(x, wy, Math.cos(a) * s, Math.sin(a) * s + G.speed, rnd(0.5, 1) * life, size); }
}
function addFloater(txt, x, wy, scale = 1) {
  const f = floaters.spawn(); if (!f) return;
  f.txt = txt; f.x = x + rnd(-4, 4); f.wy = wy; f.age = 0; f.life = 0.7; f.scale = scale;
}
function addCloud(kind, x, wy, vx, vwy, r0, r1, life, dmg, tick) {
  const c = clouds.spawn(); if (!c) return;
  c.kind = kind; c.x = x; c.wy = wy; c.vx = vx; c.vwy = vwy; c.r0 = r0; c.r1 = r1; c.r = r0; c.life = life; c.age = 0;
  c.dmg = dmg; c.tick = tick; c.tickT = 0; c.id = ++G.cloudId;
}
function addEnemy(type, x, wy, behind) {
  const e = enemies.spawn(); if (!e) return;
  const d = ENEMIES[type];
  e.type = type; e.wy = wy; e.x = clamp(x, leftAt(wy) + d.r + 2, rightAt(wy) - d.r - 2);
  e.hp = e.maxHp = d.hp * (1 + G.dist / WORLD.PX_PER_M / 1000 * SPAWN.HP_GROWTH_PER_KM);
  e.r = d.r; e.chasing = !!behind; e.vx = (Math.random() < 0.5 ? -1 : 1) * d.steer; e.seed = rnd(100);
  e.ox = rnd(-9, 9); e.oy = rnd(-12, 12); e.novaId = -1; e.flash = 0; e.chaseT = 0; e.gaveUp = false;
  e.ang = Math.atan2(G.dist - wy, G.px - e.x);
}

// ---- procedural chunks ----------------------------------------------------------
// Every pattern leaves a clear route: hard hazards never span more than ~half the canal,
// bridges and locks always keep gaps far wider than the canoe.
const CHUNKS = {
  snake(y, dens) {
    const n = Math.round(rnd(10, 16) * dens), ph = rnd(6.28), amp = rnd(0.2, 0.36);
    for (let i = 0; i < n; i++) { const wy = y + i * 24; addVape(laneX(wy, 0.5 + amp * Math.sin(i * 0.45 + ph)), wy); }
    return n * 24;
  },
  lanes(y, dens) {
    const n = Math.round(6 * dens), bigSide = Math.random() < 0.5;
    for (let i = 0; i < n; i++) {
      const wy = y + i * 26, last = i === n - 1;
      addVape(laneX(wy, 0.2), wy, last && bigSide); addVape(laneX(wy, 0.8), wy, last && !bigSide);
    }
    return n * 26;
  },
  cluster(y) {
    const wy = y + 50, x = laneX(wy, rnd(0.3, 0.7), 40);
    addVape(x, wy, true);
    for (let i = 0; i < 8; i++) addVape(x + Math.cos(i * 0.785) * 26, wy + Math.sin(i * 0.785) * 26);
    if (Math.random() < 0.4) addVape(laneX(wy + 70, rnd(0.2, 0.8)), wy + 70, true);
    return 120;
  },
  barge(y, dens, m) {
    const len = pick([70, 90, 110]), f = pick([0.1, 0.5, 0.9]), wy = y + len / 2 + 10;
    const moving = Math.random() < Math.min(0.6, m / 1000 * HAZARDS.BARGE_MOVE_CHANCE_PER_KM);
    addHazard('barge', laneX(wy, f, 20), wy, 13, len / 2 - 3, { len, vx: moving ? pick([-1, 1]) * HAZARDS.BARGE_VX : 0 });
    const open = f < 0.4 ? 0.72 : f > 0.6 ? 0.28 : pick([0.14, 0.86]);
    for (let i = 0; i < 5; i++) { const vy = wy - len / 2 + i * (len / 4); addVape(laneX(vy, open), vy); }
    if (f === 0.5 && Math.random() < 0.5) addPickup('cash', laneX(wy, 1 - open), wy);
    return len + 30;
  },
  bridge(y) {
    const wy = y + 40, k = widthAt(wy) > 225 ? 3 : 2;
    addHazard('deck', 0, wy, 0, 11);
    for (let i = 1; i <= k; i++) addHazard('pier', laneX(wy, i / (k + 1), 0), wy, 6, 10);
    const gx = laneX(wy, (((Math.random() * (k + 1)) | 0) + 0.5) / (k + 1), 0);
    for (let i = -3; i <= 2; i++) addVape(gx, wy + i * 24);
    return 110;
  },
  lock(y) {
    const wy = y + 110, gap = 66, l = leftAt(wy), r = rightAt(wy);
    const gx = l + 10 + gap / 2 + rnd(r - l - gap - 20);
    addHazard('gate', (l - 12 + gx - gap / 2) / 2, wy, (gx - gap / 2 - l + 12) / 2, 5, { side: -1 });
    addHazard('gate', (r + 12 + gx + gap / 2) / 2, wy, (r + 12 - gx - gap / 2) / 2, 5, { side: 1 });
    for (let i = -4; i <= 2; i++) addVape(gx, wy + i * 24);
    return 180;
  },
  debris(y, dens) {
    const n = 4 + ((Math.random() * 4) | 0);
    for (let i = 0; i < n; i++) { const wy = y + 20 + i * 44 + rnd(-8, 8); addHazard('debris', laneX(wy, rnd(), 10), wy, 6, 5, { kind: pick(['trolley', 'barrel', 'cone']) }); }
    for (let i = 0; i < 6 * dens; i++) { const wy = y + rnd(n * 44); addVape(laneX(wy, rnd()), wy); }
    return n * 44 + 20;
  },
  vortex(y) {
    const wy = y + 80, x = laneX(wy, rnd(0.3, 0.7), 44);
    addHazard('vortex', x, wy, 0, 0);
    for (let i = 0; i < 8; i++) addVape(x + Math.cos(i * 0.785) * 38, wy + Math.sin(i * 0.785) * 38);
    if (Math.random() < 0.5) addPickup('cash', x + pick([-20, 20]), wy);
    return 170;
  },
  sandbars(y) {
    const n = 3, first = Math.random() < 0.5 ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const wy = y + 40 + i * 95, left = (i + first) % 2 === 0;
      addHazard('sandbar', laneX(wy, left ? rnd(0.12, 0.3) : rnd(0.7, 0.88), 22), wy, 27, 7);
      addVape(laneX(wy, left ? 0.75 : 0.25), wy, Math.random() < 0.35);
      addVape(laneX(wy + 45, 0.5), wy + 45);
    }
    if (Math.random() < 0.45) { const wy = y + 40 + 95 * rnd(0.3, 1.7); addHazard('barge', laneX(wy, 0.5, 30), wy, 13, 32, { len: 70, fake: true }); }
    return n * 95 + 20;
  },
  vines(y) {
    const n = 3 + ((Math.random() * 2) | 0), first = Math.random() < 0.5 ? 0 : 1;
    for (let i = 0; i < n; i++) {
      const wy = y + 40 + i * 100, left = (i + first) % 2 === 0, len = widthAt(wy) * rnd(0.45, 0.56);
      const l = leftAt(wy), r = rightAt(wy);
      addHazard('vine', left ? l + len / 2 : r - len / 2, wy, len / 2, 4, { side: left ? -1 : 1, len });
      for (let j = 0; j < 3; j++) addVape(laneX(wy - 20 + j * 20, left ? 0.82 : 0.18), wy - 20 + j * 20);
    }
    return n * 100;
  },
};
function genChunk() {
  const m = G.genY / WORLD.PX_PER_M, b = biomeAt(G.genY), dens = 1 + m * PICKUPS.DENSITY_PER_M * 10;
  let name = 'snake';
  if (G.chunkN >= 2) {
    let total = 0; const w = {};
    for (const k in BIOMES.CHUNKS) total += (w[k] = lerp3(BIOMES.CHUNKS[k], b));
    let r = Math.random() * total;
    for (const k in w) { r -= w[k]; if (r <= 0) { name = k; break; } }
  }
  const len = CHUNKS[name](G.genY, dens, m);
  if (G.chunkN >= 2 && Math.random() < PICKUPS.CASH_CHUNK_CHANCE) {
    const wy = G.genY + rnd(len);
    addPickup('cash', laneX(wy, pick([0, 1]), 12), wy);     // hugging the bank: a risk to grab
  }
  G.chunkN++;
  G.genY += len + lerp3(BIOMES.CHUNK_GAP, b);
}

function spawnWave(b) {
  const bi = Math.min(2, Math.floor(b) + (Math.random() < b % 1 ? 1 : 0)), table = SPAWN.TABLE[bi];
  let total = 0; for (const k in table) total += table[k];
  let r = Math.random() * total, type = 'swan';
  for (const k in table) { r -= table[k]; if (r <= 0) { type = k; break; } }
  const chase = ENEMIES[type].mode === 'chase';
  const n = chase && Math.random() < SPAWN.PACK_CHANCE[bi] ? SPAWN.PACK_SIZE[bi] : 1;
  const behind = chase && Math.random() < SPAWN.BEHIND_CHANCE[bi];
  const wy = behind ? G.dist - (view.H - playerY()) - 20 : G.dist + playerY() + 24;
  const x = laneX(wy, rnd(), 12);
  for (let i = 0; i < n; i++) addEnemy(type, x + (i ? rnd(-26, 26) : 0), wy + (i ? rnd(-30, 30) : 0), behind);
}

// ---- player actions ---------------------------------------------------------------
export function nudge(dir) {
  if (G.mode !== 'play' || G.dead) return;
  G.pvx = dir * PLAYER.NUDGE * S.nudge;
  G.paddle ^= 1;
  addPart(G.px - dir * 9, G.dist - 4, -dir * 40, G.speed - 30, 0.3); addPart(G.px - dir * 10, G.dist - 8, -dir * 60, G.speed - 50, 0.25);
}
function hurt(n, cause) {
  if (G.inv > 0 || G.dead) return;
  if (G.god) { G.hits = (G.hits || 0) + 1; G.inv = 0.5; return; }
  G.hp -= n; G.hurtT = 0.7; G.inv = PLAYER.INVULN_HIT; G.shake = JUICE.SHAKE_HIT; G.flash = 0.12; sfx.hurt();
  burst(G.px, G.dist, 14, 120);
  if (G.hp <= 0) die(cause);
}
function die(cause) {
  if (G.dead) return;
  if (G.god) { if (G.inv <= 0) { G.crashes = (G.crashes || 0) + 1; G.inv = 1; } return; }
  G.dead = true; G.deadT = 0; G.cause = cause; G.hp = 0;
  G.hitstop = JUICE.HITSTOP_DEATH; G.shake = JUICE.SHAKE_DEATH; G.flash = 0.2; sfx.death();
  for (let i = 0; i < 70; i++) { const a = rnd(6.28), s = rnd(20, 260); addPart(G.px + rnd(-6, 6), G.dist + rnd(-14, 14), Math.cos(a) * s, Math.sin(a) * s, rnd(0.4, 1.3), pick([2, 2, 3, 4])); }
  const m = metres(), bonus = Math.floor(m / 100) * REWARD.CASH_PER_100M + (G.level - 1) * REWARD.CASH_PER_LEVEL;
  const total = G.cash + Math.round(bonus * S.cash);
  G.result = { title: pick(FLAVOUR.DEATH_TITLES), tip: pick(FLAVOUR.TIPS), vapes: G.vapes, m, level: G.level, kills: G.kills, cash: total, newBest: G.vapes > save.best };
  save.cash += total; save.runs++; save.best = Math.max(save.best, G.vapes); save.bestDist = Math.max(save.bestDist, m);
  writeSave();
}
function gainXp(x) {
  G.xp += x * S.xp;
  while (G.xp >= G.xpNeed) { G.xp -= G.xpNeed; G.level++; G.xpNeed = XP.need(G.level); G.pending++; }
}
function collect(v) {
  v.dead = true;
  if (v.kind === 'cash') {
    const n = Math.round(PICKUPS.CASH_VALUE * S.cash); G.cash += n;
    addFloater('+£' + n, v.x, v.wy + 10, 2); burst(v.x, v.wy, 10, 90); sfx.cash(); return;
  }
  const big = v.kind === 'big', n = big ? PICKUPS.BIG_MULT : 1;
  G.vapes += n; gainXp(n * XP.VAPE);
  G.combo = G.comboT > 0 ? G.combo + 1 : 0; G.comboT = 0.7;
  addFloater('+' + n, v.x, v.wy + 10, big ? 2 : 1);
  burst(v.x, v.wy, big ? 14 : 6, big ? 110 : 80, 0.35);
  addPart(v.x, v.wy, 0, G.speed + 60, 0.28, 0, big ? 2 : 1);          // the spin-burst ghost
  if (big) { sfx.big(); G.grinT = Math.max(G.grinT, 0.5); } else sfx.vape(G.combo);
  if (shopLvl('engine')) {
    const t = shopLvl('turbo');
    G.burst = Math.min(ENGINE.BURST_CAP[t], G.burst + ENGINE.BURST_ADD[t] * (big ? 2 : 1));
    G.shake = Math.max(G.shake, ENGINE.SHAKE);
  }
}
function damageEnemy(e, dmg) {
  if (e.dead) return;
  dmg *= S.dmg; e.hp -= dmg; e.flash = 0.08;
  if (floaters.n < 14) addFloater(Math.round(dmg), e.x, e.wy + e.r, 1);
  if (e.hp > 0) return;
  const d = ENEMIES[e.type];
  e.dead = true; G.kills++; gainXp(d.xp);
  burst(e.x, e.wy, d.big ? 16 : 6, d.big ? 120 : 80, 0.35, d.big ? 3 : 2);
  G.shake = Math.max(G.shake, JUICE.SHAKE_KILL); sfx.kill();
  if (Math.random() < d.drop) addPickup(d.big ? 'big' : 'vape', e.x, e.wy);
}

// ---- level-up choices ---------------------------------------------------------------
function rollChoices() {
  const c = [];
  for (const id in WEAPONS) {
    const w = WEAPONS[id], lvl = G.weapons[id] || 0;
    if (G.evo[id]) continue;
    if (lvl >= w.maxLvl) {
      const ev = EVOLUTIONS[id];
      if (plvl(ev.needs)) c.push({ kind: 'evo', id, title: ev.name, desc: ev.desc, tag: 'EVOLUTION', w: LEVELUP.EVO_WEIGHT });
    } else c.push({ kind: 'weapon', id, title: w.name, desc: w.desc[lvl] || 'STRONGER', tag: lvl ? 'LV ' + (lvl + 1) : 'NEW', w: lvl ? LEVELUP.OWNED_WEIGHT : LEVELUP.NEW_WEIGHT });
  }
  for (const id in PASSIVES) {
    const p = PASSIVES[id], lvl = plvl(id);
    if (lvl < p.maxLvl) c.push({ kind: 'passive', id, title: p.name, desc: p.desc, tag: lvl ? 'LV ' + (lvl + 1) : 'NEW', w: lvl ? LEVELUP.OWNED_WEIGHT : LEVELUP.NEW_WEIGHT });
  }
  const out = [];
  while (out.length < 3 && c.length) {
    let total = 0; for (const o of c) total += o.w;
    let r = Math.random() * total, i = 0;
    for (; i < c.length - 1; i++) { r -= c[i].w; if (r <= 0) break; }
    out.push(c.splice(i, 1)[0]);
  }
  if (out.length < 3) out.push({ kind: 'cash', title: 'GIFT FROM A LORD', desc: '+£' + LEVELUP.FILLER_CASH + '. FULLY DECLARED, OBVIOUSLY.', tag: '' });
  if (out.length < 3) out.push({ kind: 'heal', title: 'CUP OF TEA', desc: 'RESTORE ALL HEARTS', tag: '' });
  return out;
}
export function choose(i) {
  const c = G.choices[i]; if (!c) return;
  if (c.kind === 'weapon') G.weapons[c.id] = (G.weapons[c.id] || 0) + 1;
  else if (c.kind === 'passive') { G.passives[c.id] = plvl(c.id) + 1; if (c.id === 'hivis') { calcStats(); G.hp = G.maxHp; } }
  else if (c.kind === 'evo') { G.evo[c.id] = true; G.flash = 0.2; G.shake = 8; }
  else if (c.kind === 'cash') G.cash += LEVELUP.FILLER_CASH;
  else if (c.kind === 'heal') G.hp = G.maxHp;
  calcStats(); sfx.pick(); G.grinT = c.kind === 'evo' ? 3 : 1.2;
  G.inv = Math.max(G.inv, PLAYER.INVULN_LEVELUP);
  G.pending--;
  if (G.pending > 0) G.choices = rollChoices(); else { G.choices = null; G.mode = 'play'; }
}

// ---- weapons ----------------------------------------------------------------------
const DIRS = {
  1: [0], 3: [0, -0.87, 0.87], 4: [0, 1.571, 3.142, -1.571],
  6: [0, 1.047, 2.094, 3.142, -2.094, -1.047], 8: [0, 0.785, 1.571, 2.356, 3.142, -2.356, -1.571, -0.785],
};
function enemyWithin(range) {
  const r2 = range * range;
  for (let i = 0; i < enemies.n; i++) { const e = enemies.items[i], dx = e.x - G.px, dy = e.wy - G.dist; if (dx * dx + dy * dy < r2) return true; }
  return false;
}
function updateWeapons(dt) {
  const cd = G.cd;
  cd.cloud -= dt;
  if (cd.cloud <= 0) {
    const p = wp('cloud');
    if (p.prox && !enemyWithin(p.prox * S.area)) cd.cloud = 0.05;
    else {
      const sp = WEAPONS.cloud.speed * p.size / 13 * S.area;
      for (const a of DIRS[p.dirs]) {
        const sx = Math.sin(a), sy = Math.cos(a);
        addCloud('puff', G.px + sx * 10, G.dist + sy * 16, sx * sp, sy * sp, p.size * 0.45 * S.area, p.size * S.area, p.life * S.dur, p.dmg, WEAPONS.cloud.tick);
      }
      cd.cloud = p.cd * S.cd; sfx.puff();
    }
  }
  if (G.passives.rings) {
    cd.rings -= dt;
    if (cd.rings <= 0) {
      const R = PASSIVES.rings, p = R.levels[G.passives.rings - 1]; cd.rings = p.cd * S.cd;
      addCloud('ring', G.px, G.dist + 18, 0, R.speed, 6, p.r * S.area, p.life * S.dur, p.dmg, 0);
      sfx.puff();
    }
  }
  if (G.weapons.trail) {
    cd.trail -= dt;
    if (cd.trail <= 0) {
      const p = wp('trail'); cd.trail = WEAPONS.trail.every;
      addCloud('trail', G.px + rnd(-3, 3), G.dist - 16, 0, 0, p.r * 0.6 * S.area, p.r * S.area, p.life * S.dur, p.dmg, WEAPONS.trail.tick);
    }
  }
  if (G.weapons.nova) {
    cd.nova -= dt;
    if (cd.nova <= 0) {
      const p = wp('nova'); cd.nova = p.cd * S.cd;
      addCloud('nova', G.px, G.dist, 0, 0, 8, p.r * S.area, p.r * S.area / WEAPONS.nova.expand, p.dmg, 0);
      G.shake = Math.max(G.shake, JUICE.SHAKE_NOVA); sfx.nova();
    }
  }
  orbs.length = 0;
  if (G.weapons.storm) {
    const p = wp('storm');
    G.orbA += WEAPONS.storm.spin * dt;
    for (let i = 0; i < p.n; i++) { const a = G.orbA + i / p.n * 6.283; orbs.push({ x: G.px + Math.cos(a) * p.orbit * S.area, wy: G.dist + Math.sin(a) * p.orbit * S.area, r: p.r * S.area }); }
    if (p.outer) for (let i = 0; i < p.outer; i++) { const a = -G.orbA * 0.7 + i / p.outer * 6.283; orbs.push({ x: G.px + Math.cos(a) * p.orbit * 1.9 * S.area, wy: G.dist + Math.sin(a) * p.orbit * 1.9 * S.area, r: p.r * 1.2 * S.area }); }
    G.orbTick -= dt;
    if (G.orbTick <= 0) {
      G.orbTick = WEAPONS.storm.tick;
      for (const o of orbs) for (let i = 0; i < enemies.n; i++) {
        const e = enemies.items[i], dx = e.x - o.x, dy = e.wy - o.wy, rr = o.r + e.r;
        if (dx * dx + dy * dy < rr * rr) damageEnemy(e, p.dmg);
      }
    }
  }
}
function updateClouds(dt) {
  for (let i = 0; i < clouds.n; i++) {
    const c = clouds.items[i];
    c.age += dt;
    if (c.age >= c.life) { c.dead = true; continue; }
    const t = c.age / c.life;
    if (c.kind === 'puff') {
      const drag = Math.exp(-1.6 * dt); c.vx *= drag; c.vwy *= drag;
      c.x += c.vx * dt; c.wy += (c.vwy + G.speed) * dt;
      c.r = c.r0 + (c.r1 - c.r0) * (1 - (1 - t) * (1 - t));
    } else if (c.kind === 'trail') c.r = c.r0 + (c.r1 - c.r0) * Math.min(1, t * 4);
    else if (c.kind === 'ring') { c.wy += (c.vwy + G.speed) * dt; c.r = c.r0 + (c.r1 - c.r0) * Math.sqrt(t); }
    else { c.x = G.px; c.wy = G.dist; c.r = c.r0 + (c.r1 - c.r0) * t; }
    const ring = c.kind === 'ring', nova = c.kind === 'nova' || ring;      // these hit each enemy once
    if (!nova) { c.tickT -= dt; if (c.tickT > 0) continue; c.tickT += c.tick; }
    for (let j = 0; j < enemies.n; j++) {
      const e = enemies.items[j];
      if (nova && e.novaId === c.id) continue;
      const dx = e.x - c.x, dy = e.wy - c.wy, rr = c.r + e.r;
      const d2 = dx * dx + dy * dy;
      if (ring) { const band = PASSIVES.rings.band + e.r, dd = Math.sqrt(d2) - c.r; if (dd > band || dd < -band) continue; }
      if (d2 < rr * rr + (ring ? 1e6 : 0)) { if (nova) e.novaId = c.id; damageEnemy(e, c.dmg); }
    }
  }
}

// ---- per-frame updates ------------------------------------------------------------
function updateEnemies(dt) {
  const below = G.dist - (view.H - playerY()) - 60;
  for (let i = 0; i < enemies.n; i++) {
    const e = enemies.items[i], d = ENEMIES[e.type];
    const dx = G.px + e.ox - e.x, dwy = G.dist + e.oy - e.wy, dist = Math.hypot(dx, dwy) || 1;
    if (e.flash > 0) e.flash -= dt;
    if (d.mode === 'chase') {
      if (!e.chasing && !e.gaveUp && dist < SPAWN.CHASE_RANGE) { e.chasing = true; e.ang = Math.atan2(dwy, dx); }
      if (e.chasing) {
        // steer with a limited turn rate: they commit to a line, so a side-step makes them overshoot
        let diff = Math.atan2(dwy, dx) - e.ang;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        e.ang += clamp(diff, -d.turn * dt, d.turn * dt);
        e.x += Math.cos(e.ang) * d.speed * dt; e.wy += (G.speed + Math.sin(e.ang) * d.speed) * dt;
        if (e.type === 'mozzie') e.x += Math.sin(G.t * 9 + e.seed) * 40 * dt;
        e.chaseT += dt;
        if (e.chaseT > d.stamina) { e.chasing = false; e.gaveUp = true; }      // knackered: drifts away downstream
      }
    } else if (d.mode === 'bounce') {
      e.wy -= d.speed * dt; e.x += e.vx * dt;
    } else {
      e.wy -= d.speed * dt; e.x += clamp(dx, -d.steer * dt, d.steer * dt);
    }
    const l = leftAt(e.wy) + e.r + 2, r = rightAt(e.wy) - e.r - 2;
    if (e.x < l) { e.x = l; if (e.vx < 0) e.vx = -e.vx; } else if (e.x > r) { e.x = r; if (e.vx > 0) e.vx = -e.vx; }
    if (e.wy < below) { e.dead = true; continue; }
    if (Math.abs(e.x - G.px) < e.r + PLAYER.HIT_W && Math.abs(e.wy - G.dist) < e.r + PLAYER.HIT_H && G.inv <= 0) {
      hurt(1, e.type); e.dead = true; burst(e.x, e.wy, 6, 80);
    }
  }
}
function updateHazards(dt) {
  const below = G.dist - (view.H - playerY()) - 80, jungle = clamp(biomeAt(G.dist) - 1, 0, 1);
  for (let i = 0; i < hazards.n; i++) {
    const h = hazards.items[i];
    if (h.wy + h.hh < below) { h.dead = true; continue; }
    const dy = h.wy - G.dist, dx = h.x - G.px;
    if (h.vx) {
      h.x += h.vx * dt;
      const l = leftAt(h.wy) + h.hw + 4, r = rightAt(h.wy) - h.hw - 4;
      if (h.x < l) { h.x = l; h.vx = Math.abs(h.vx); } else if (h.x > r) { h.x = r; h.vx = -Math.abs(h.vx); }
      if (Math.random() < dt * 14) addPart(h.x + rnd(-12, 12), h.wy - h.hh, rnd(-10, 10), -rnd(10, 30), 0.5);
    }
    if (h.fake) {
      if (dy < HAZARDS.FAKE_REVEAL) { h.dead = true; burst(h.x, h.wy, 16, 70, 0.5); addFloater('HEAT HAZE!', h.x, h.wy, 1); }
      continue;
    }
    if (h.type === 'vortex') {
      const d = Math.hypot(dx, dy);
      if (d < HAZARDS.VORTEX_R && d > 0.5) {
        G.px += dx / d * HAZARDS.VORTEX_PULL * (1 + jungle * (HAZARDS.VORTEX_JUNGLE_MULT - 1)) * (1 - d / HAZARDS.VORTEX_R) * dt;
        if (d < HAZARDS.VORTEX_CORE) hurt(1, 'vortex');
      }
      continue;
    }
    if (h.type === 'deck') continue;
    if (Math.abs(dx) > h.hw + PLAYER.HIT_W || Math.abs(dy) > h.hh + PLAYER.HIT_H) continue;
    if (h.type === 'barge' || h.type === 'pier' || h.type === 'gate') die(h.type);
    else if (h.type === 'debris') { if (G.inv <= 0) { hurt(1, 'debris'); h.dead = true; burst(h.x, h.wy, 10, 90); } }
    else if (h.type === 'sandbar') { hurt(1, 'sandbar'); G.slow = Math.min(G.slow, HAZARDS.SANDBAR_SLOW); }
    else if (h.type === 'vine') { G.snag = 0.12; G.slow = Math.min(G.slow, HAZARDS.VINE_SLOW); if (Math.random() < dt * 20) addPart(G.px + rnd(-6, 6), G.dist + 8, rnd(-30, 30), G.speed, 0.3); }
  }
}
function updatePickups(dt) {
  const below = G.dist - (view.H - playerY()) - 20, top = G.dist + playerY();
  const magR = PLAYER.MAGNET_R * S.magnet, magR2 = magR * magR, pickR2 = PLAYER.PICKUP_R * PLAYER.PICKUP_R;
  for (let i = 0; i < vapes.n; i++) {
    const v = vapes.items[i];
    if (v.wy < below) { v.dead = true; continue; }
    if (v.wy > top) continue;
    v.age += dt;
    v.ang += ((v.kind === 'big' ? PICKUPS.SPIN_BIG : PICKUPS.SPIN_BASE) + v.age * PICKUPS.SPIN_ACCEL) * dt;
    const dx = G.px - v.x, dy = G.dist - v.wy, d2 = dx * dx + dy * dy;
    if (d2 < magR2) v.mag = true;
    if (v.mag) {
      const d = Math.sqrt(d2) || 1, sp = PLAYER.MAGNET_PULL * dt;
      v.x += dx / d * sp; v.wy += dy / d * sp + G.speed * dt;
    }
    if (d2 < pickR2) collect(v);
  }
}
function updateFx(dt) {
  for (let i = 0; i < parts.n; i++) {
    const p = parts.items[i]; p.age += dt;
    if (p.age >= p.life) { p.dead = true; continue; }
    p.x += p.vx * dt; p.wy += p.vwy * dt;
  }
  for (let i = 0; i < floaters.n; i++) {
    const f = floaters.items[i]; f.age += dt;
    if (f.age >= f.life) { f.dead = true; continue; }
    f.wy += (G.speed * 0.9 + 30) * dt;
  }
  parts.sweep(); floaters.sweep();
  if (G.shake > 0) G.shake = Math.max(0, G.shake - dt * 30);
  if (G.flash > 0) G.flash -= dt;
}

/** attract-mode scrolling for the title screen */
export function idle(dt) {
  G.t += dt; G.speed = 70; G.dist += G.speed * dt; G.px = centreAt(G.dist);
  G.paddleT += dt; if (G.paddleT > 0.6) { G.paddleT = 0; G.paddle ^= 1; }
  updateFx(dt);
}

export function update(dt) {
  if (G.hitstop > 0) { G.hitstop -= dt; return; }
  G.t += dt;
  if (G.dead) { G.deadT += dt; G.hurtT = 0; updateFx(dt); if (G.deadT > 1.1) G.mode = 'dead'; return; }

  // speed
  const m = G.dist / WORLD.PX_PER_M;
  let base = PLAYER.SPEED_START + (PLAYER.SPEED_MAX - PLAYER.SPEED_START) * Math.min(1, m / PLAYER.SPEED_RAMP_M);
  if (shopLvl('engine')) base *= ENGINE.SPEED_MULT;
  G.burst *= Math.exp(-ENGINE.BURST_DECAY * dt);
  G.slow += (1 - G.slow) * Math.min(1, dt * HAZARDS.SLOW_RECOVER);
  G.speed = (base + G.burst) * G.slow;
  G.dist += G.speed * dt;

  // steering
  if (G.bot) botSteer(dt);
  else if (input.dir) { G.holdT += dt; if (G.holdT > PLAYER.HOLD_REPEAT) { G.holdT = 0; nudge(input.dir); } } else G.holdT = 0;
  const steer = G.snag > 0 ? HAZARDS.VINE_STEER : 1;
  if (G.snag > 0) G.snag -= dt;
  G.pvx *= Math.exp(-PLAYER.NUDGE_FRICTION * dt);
  let vx = G.pvx;
  if (save.tilt && !G.bot) vx += clamp(input.tilt / PLAYER.TILT_FULL_DEG, -1, 1) * PLAYER.TILT_SPEED * S.nudge;
  G.px += vx * steer * dt;
  const l = leftAt(G.dist) + 9, r = rightAt(G.dist) - 9;
  if (G.px < l || G.px > r) {
    if (Math.abs(vx) > 30 || Math.random() < dt * 8) addPart(G.px < l ? l - 8 : r + 8, G.dist + rnd(-10, 10), 0, G.speed - 40, 0.3);
    G.px = clamp(G.px, l, r); G.pvx = 0;
  }
  if (G.inv > 0) G.inv -= dt;
  if (G.hurtT > 0) G.hurtT -= dt;
  if (G.grinT > 0) G.grinT -= dt;
  if (G.comboT > 0) G.comboT -= dt;
  G.paddleT += dt * G.speed / 100; if (G.paddleT > 0.45) { G.paddleT = 0; G.paddle ^= 1; }
  // the occasional drag: hold, then a cloud that drifts away behind her
  G.vapeT -= dt;
  if (G.vapeT <= 0 && G.dragT <= 0) { G.dragT = VAPING.DRAG + VAPING.EXHALE; G.vapeT = rnd(VAPING.EVERY[0], VAPING.EVERY[1]); }
  if (G.dragT > 0) {
    G.dragT -= dt; G.puffT -= dt;
    if (G.dragT < VAPING.EXHALE && G.puffT <= 0) { G.puffT = VAPING.PUFF_EVERY; addPart(G.px + 4 + rnd(-3, 3), G.dist + 2, rnd(-16, 16), G.speed * rnd(0.3, 0.6), rnd(1.4, 2.3), rnd(4, 8), 3); }
  }

  // world
  while (G.genY < G.dist + playerY() + 60) genChunk();
  const b = biomeAt(G.dist), bi = Math.round(b);
  if (bi !== G.biomeIdx) { G.biomeIdx = bi; G.banner = BIOMES.NAMES[bi]; G.bannerT = 3; }
  if (G.bannerT > 0) G.bannerT -= dt;
  if (m > SPAWN.START_M) {
    G.spawnT += lerp3(SPAWN.RATE, b) * (1 + m / 1000 * SPAWN.RATE_GROWTH_PER_KM) * Math.sqrt(G.speed / PLAYER.SPEED_START) * dt;
    while (G.spawnT >= 1) { G.spawnT--; if (enemies.n < SPAWN.MAX_ALIVE) spawnWave(b); }
  }

  updateWeapons(dt);
  updateClouds(dt);
  updateEnemies(dt);
  updateHazards(dt);
  updatePickups(dt);
  updateFx(dt);
  vapes.sweep(); enemies.sweep(); hazards.sweep(); clouds.sweep();

  if (G.pending > 0 && !G.dead) { G.choices = rollChoices(); G.mode = 'levelup'; G.pvx = 0; sfx.level(); }
}

// ---- autoplay bot (for headless balance runs: ?bot=1) -------------------------------
let botT = 0;
function botSteer(dt) {
  botT -= dt; if (botT > 0) return;
  const l = leftAt(G.dist + 40) + 14, r = rightAt(G.dist + 40) - 14;
  let best = G.px, bestCost = 1e9;
  for (let k = 0; k <= 14; k++) {
    const x = l + (r - l) * k / 14;
    let cost = Math.abs(x - G.px) * 0.25;
    for (let i = 0; i < hazards.n; i++) {
      const h = hazards.items[i], dy = h.wy - G.dist;
      if (h.type === 'deck' || h.type === 'vine' || dy + h.hh < -16 || dy - h.hh > 210) continue;
      const pad = h.type === 'vortex' ? 46 : h.hw + 17;
      if (Math.abs(x - h.x) < pad) cost += (h.type === 'debris' || h.type === 'sandbar' ? 300 : 2000) * (1.2 - Math.max(0, dy) / 210);
    }
    for (let i = 0; i < enemies.n; i++) {
      const e = enemies.items[i], dy = e.wy - G.dist;
      if (dy > -30 && dy < 110 && Math.abs(x - e.x) < 22) cost += 120;
    }
    for (let i = 0; i < vapes.n; i++) {
      const v = vapes.items[i], dy = v.wy - G.dist;
      if (dy > 0 && dy < 170 && Math.abs(x - v.x) < 14) cost -= (v.kind === 'vape' ? 30 : 90) * (1 - dy / 220);
    }
    if (cost < bestCost) { bestCost = cost; best = x; }
  }
  if (Math.abs(best - G.px) > 9) { nudge(best > G.px ? 1 : -1); botT = 0.12; }
}
