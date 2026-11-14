// Draws the world and the in-run HUD. Three colours only: black, white, ginger.
import { VIEW, COLORS, VAPING, JUICE, SIDE_ART } from './config.js';
import { ctx, view, rect, box, text, textO, textW, draw, drawDisc, face, sideArt, SPR, hash } from './gfx.js';
import { G, vapes, enemies, hazards, clouds, parts, floaters, orbs, biomeAt, leftAt, rightAt, playerY, metres } from './game.js';
import { save } from './platform.js';

const { BG, FG } = COLORS, W = VIEW.W;
export const BAR_H = 64;
let PY = 0, D = 0, checker = null;
const sy = (wy) => PY - Math.round(wy - D);

function getChecker() {
  if (checker) return checker;
  const c = document.createElement('canvas'); c.width = c.height = 2;
  const g = c.getContext('2d'); g.fillStyle = FG; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
  return checker = ctx.createPattern(c, 'repeat');
}
export function dither(x, y, w, h) { ctx.fillStyle = getChecker(); ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

function drawWater(lo, hi) {
  for (let j = Math.floor(lo / 16); j <= Math.floor(hi / 16); j++) {
    const y = sy(j * 16);
    for (let i = 0; i < 23; i++) {
      const h = hash(j * 131 + i * 7919);
      if (h < 0.05) rect(i * 16 + h * 200, y, h < 0.02 ? 5 : 3, 1);
    }
  }
}
function bankGlyph(bi, x, y, j) {
  if (bi === 0) { rect(x, y + 3, 6, 1); rect(x + ((j & 1) ? 1 : 4), y + 4, 1, 3); }
  else if (bi === 1) { rect(x + 1, y + 2, 1, 1); rect(x + 5, y + 5, 1, 1); }
  else { rect(x + 1, y + 3, 4, 1); rect(x + 2, y + 2, 2, 1); rect(x + 3, y + 4, 2, 1); }
}
let hudShown = true;
function drawBanks(lo, hi) {
  let lp = null, rp = null;
  for (let j = Math.floor(lo / 8) - 1; j <= Math.floor(hi / 8) + 1; j++) {
    const wy = j * 8, y = sy(wy + 8);
    const l = Math.round(leftAt(wy) / 4) * 4, r = Math.round(rightAt(wy) / 4) * 4;
    rect(0, y, l, 8, BG); rect(r, y, W - r, 8, BG);
    rect(l - 2, y, 2, 8); rect(r, y, 2, 8);
    if (lp !== null && lp !== l) rect(Math.min(l, lp) - 2, y + 7, Math.abs(l - lp) + 2, 2);
    if (rp !== null && rp !== r) rect(Math.min(r, rp), y + 7, Math.abs(r - rp) + 2, 2);
    lp = l; rp = r;
    const b = biomeAt(wy), bi = Math.min(2, Math.floor(b) + (hash(j * 53) < b % 1 ? 1 : 0));
    ctx.fillStyle = FG;
    for (let k = 1; k <= 4; k++) {
      if (hash(j * 977 + k * 31) < 0.55 / k) bankGlyph(bi, l - 4 - k * 8, y, j + k);
      if (hash(j * 613 + k * 17) < 0.55 / k) bankGlyph(bi, r - 2 + k * 8, y, j + k);
    }
    const dh = hash(j * 271);
    if (dh < 0.045) {
      const s = bi === 0 ? (dh < 0.011 ? SPR.signs[(dh * 9973 | 0) % SPR.signs.length] : dh < 0.025 ? SPR.lamp : SPR.bollard) : bi === 1 ? SPR.cactus : SPR.palm;
      if (dh * 1000 % 2 < 1) { if (l > s.width + 20) ctx.drawImage(s, l - s.width - 10, y); } else if (r < W - s.width - 20) ctx.drawImage(s, r + 11, y);
    }
  }
}
/** static bezel: the face is split down the middle and the split sits at the screen edges */
function drawBorder() {
  const B = SIDE_ART.BORDER, h = view.H - (hudShown ? BAR_H : 0), art = save.sideArt ? sideArt(h) : null;
  if (!art) return;
  const bw = B - SIDE_ART.GAP, hw = art.L.width;
  rect(0, 0, B, h, BG); rect(W - B, 0, B, h, BG);
  ctx.drawImage(art.R, 0, 0, bw, h, 0, 0, bw, h);                    // right half of the picture, split edge at x = 0
  ctx.drawImage(art.L, hw - bw, 0, bw, h, W - bw, 0, bw, h);         // left half, split edge at the right-hand side
}
function drawHazards(top) {
  for (let i = 0; i < hazards.n; i++) {
    const h = hazards.items[i], y = sy(h.wy);
    if (y < -80 || y > view.H + 80) continue;
    const upper = h.type === 'deck' || h.type === 'pier';
    if (upper !== top) continue;
    if (h.type === 'barge') {
      const s = SPR.barge[h.len];
      if (h.fake) {       // heat haze: wobbly scanlines
        const x0 = Math.round(h.x - s.width / 2), y0 = y - (s.height >> 1), ph = (G.t * 10) | 0;
        for (let row = ph & 1; row < s.height; row += 2) ctx.drawImage(s, 0, row, s.width, 1, x0 + Math.round(Math.sin(G.t * 7 + row * 0.35) * 2), y0 + row, s.width, 1);
      } else draw(s, h.x, y);
    } else if (h.type === 'sandbar') draw(SPR.sandbar[h.seed % 3], h.x, y);
    else if (h.type === 'debris') draw(SPR[h.kind], h.x, y + Math.round(Math.sin(G.t * 3 + h.seed) * 1));
    else if (h.type === 'gate') {
      const x = Math.round(h.x - h.hw), w = Math.round(h.hw * 2);
      rect(x, y - 5, w, 10); ctx.fillStyle = BG;
      for (let gx = x + 3; gx < x + w - 1; gx += 5) ctx.fillRect(gx, y - 3, 1, 6);
      const inner = h.side < 0 ? x + w : x;   // gap-side post
      rect(inner - 3, y - 8, 6, 16); rect(inner - 1, y - 6, 2, 12, BG);
    } else if (h.type === 'vine') {
      const x0 = h.side < 0 ? h.x - h.hw : h.x + h.hw, n = (h.len / 4) | 0;
      ctx.fillStyle = FG;
      for (let k = 0; k < n; k++) {
        const x = x0 - h.side * k * 4, yy = y + Math.round(Math.sin(k * 0.7 + h.seed) * 3);
        ctx.fillRect(x - 2, yy - 1, 4, 2);
        if (k % 3 === 1) { ctx.fillRect(x - 1, yy - 5, 3, 3); ctx.fillRect(x - 3, yy + 2, 3, 3); }
      }
    } else if (h.type === 'vortex') {
      ctx.fillStyle = FG;
      for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 13; k++) {
        const a = -G.t * 4 + arm * 2.094 + k * 0.42, rad = 3 + k * 2.6, s = k > 8 ? 3 : 2;
        ctx.fillRect(Math.round(h.x + Math.cos(a) * rad), Math.round(y + Math.sin(a) * rad * 0.9), s, s);
      }
    } else if (h.type === 'deck') {
      const l = Math.round(leftAt(h.wy)) - 6, r = Math.round(rightAt(h.wy)) + 6;
      rect(l, y - 11, r - l, 22, BG); dither(l, y - 9, r - l, 18);
      rect(l, y - 12, r - l, 3); rect(l, y + 9, r - l, 3);
    } else if (h.type === 'pier') draw(SPR.pier, h.x, y);
  }
}
function drawClouds() {
  for (let i = 0; i < clouds.n; i++) {
    const c = clouds.items[i], y = sy(c.wy), t = c.age / c.life;
    if (c.kind === 'nova') {
      const n = Math.max(20, (c.r * 0.55) | 0);
      ctx.fillStyle = FG;
      for (let k = 0; k < n; k++) {
        const a = k / n * 6.283 + c.id;
        ctx.fillRect(Math.round(c.x + Math.cos(a) * c.r) - 3, Math.round(y + Math.sin(a) * c.r) - 3, 6, 6);
        if (k & 1) ctx.fillRect(Math.round(c.x + Math.cos(a + 0.1) * c.r * 0.86) - 1, Math.round(y + Math.sin(a + 0.1) * c.r * 0.86) - 1, 3, 3);
      }
      if (c.r < 150) drawDisc(c.x, y, c.r - 6, t < 0.6 ? 1 : 2);        // billows out as a thick cloud, then thins
      continue;
    }
    if (y < -c.r || y > view.H + c.r) continue;
    if (c.kind === 'ring') { if (t < 0.85 || ((G.t * 20) & 1)) { drawDisc(c.x, y, c.r, 3); drawDisc(c.x, y, c.r - 2, 3); if (c.r > 12) drawDisc(c.x, y, c.r - 5, 3); } continue; }
    drawDisc(c.x, y, c.r, c.kind === 'puff' ? (t < 0.1 ? 0 : t < 0.7 ? 1 : 2) : (t < 0.65 ? 1 : 2));
  }
}
function drawPickups() {
  for (let i = 0; i < vapes.n; i++) {
    const v = vapes.items[i], y = sy(v.wy);
    if (y < -20 || y > view.H + 20) continue;
    if (v.kind === 'tea') { draw(SPR.tea, v.x, y + Math.round(Math.sin(G.t * 4 + v.ang) * 1.5)); continue; }
    if (v.kind === 'cash') { draw(SPR.cash, v.x, y + Math.round(Math.sin(G.t * 5 + v.ang) * 1.5)); continue; }
    const fr = v.kind === 'big' ? SPR.bigVape : SPR.vape;
    draw(fr[((v.ang / 6.283 * 16) | 0) & 15], v.x, y);
  }
}
function drawEnemies() {
  for (let i = 0; i < enemies.n; i++) {
    const e = enemies.items[i], y = sy(e.wy);
    if (y < -24 || y > view.H + 24) continue;
    const s = SPR[e.type], bob = e.type === 'mozzie' ? 0 : Math.round(Math.sin(G.t * 6 + e.seed) * 1);
    if (e.flash > 0) drawDisc(e.x, y, e.r + 2, 0); else draw(s, e.x, y + bob);
  }
}
function drawFx() {
  for (let i = 0; i < parts.n; i++) {
    const p = parts.items[i], y = sy(p.wy);
    if (p.spr === 3) { const t = p.age / p.life, r = p.size * (1 + t * 1.8); if (t < 0.55) drawDisc(p.x, y, r, 3); drawDisc(p.x, y, r - 1, 2); }
    else if (p.spr) { const fr = p.spr === 2 ? SPR.bigVape : SPR.vape; draw(fr[((p.age * 70) | 0) & 15], p.x, y); }
    else rect(p.x, y, p.size, p.size);
  }
  for (let i = 0; i < floaters.n; i++) {
    const f = floaters.items[i];
    if (f.age > f.life * 0.75 && ((f.age * 30) & 1)) continue;
    textO(f.txt, f.x, sy(f.wy) - 14, f.scale, FG, 0.5);
  }
}

/** mode: 'full' = everything, 'menu' = just water, banks and an idle kayak */
export function drawWorld(mode = 'full') {
  PY = playerY(); D = Math.round(G.dist);
  const lo = D - (view.H - PY), hi = D + PY;
  rect(0, 0, W, view.H, BG);
  ctx.save();
  if (G.shake > 0.3) ctx.translate(Math.round((Math.random() - 0.5) * G.shake * 2), Math.round((Math.random() - 0.5) * G.shake * 2));
  ctx.fillStyle = FG; drawWater(lo, hi);
  const full = mode === 'full';
  hudShown = full;
  if (full) { drawHazards(false); drawClouds(); }
  drawBanks(lo, hi);
  if (full) {
    drawPickups(); drawEnemies();
    for (const o of orbs) { const y = sy(o.wy); drawDisc(o.x, y, o.r, 1); drawDisc(o.x, y, o.r * 0.45, 0); }
  }
  if (full && !G.dead) { const x = Math.round(G.px); rect(x - 7, PY - 23, 15, 47, BG); rect(x - 10, PY - 18, 21, 37, BG); rect(x - 13, PY - 11, 27, 23, BG); }   // keep her readable inside the fog
  if (!G.dead && !(full && G.inv > 0 && ((G.t * 14) & 1))) draw(SPR.kayak[G.paddle], G.px, PY);
  if (full) drawHazards(true);
  drawFx();
  if (full && G.burst > 22) {
    const n = Math.min(16, G.burst / 7) * JUICE.SPEED_FX, k = (G.t * 24) | 0;
    for (let i = 0; i < n; i++) rect(hash(i * 13 + k * 7) * W, hash(i * 29 + k * 3) * view.H, 1, (20 + G.burst / 4) * JUICE.SPEED_FX);
  }
  ctx.restore();
  drawBorder();
  if (G.flash > 0) dither(0, 0, W, view.H);
}

function fit(str, w, max) { let sc = max; while (sc > 1 && textW(str, sc) > w - 6) sc--; return sc; }
function stat(x, w, y0, value, label) {
  box(x, y0 + 12, w, 52); box(x + 2, y0 + 14, w - 4, 48, FG, 1);
  const sc = fit(value, w - 6, 4);
  text(value, x + w / 2, y0 + 19 + (20 - sc * 5) / 2, sc, FG, 0.5);
  text(label, x + w / 2, y0 + 47, 2, FG, 0.5);
}
/** Status bar across the bottom: everything about the player lives down here. */
export function drawHud() {
  const H = view.H, y0 = H - BAR_H;
  rect(0, y0, W, BAR_H, BG); rect(0, y0, W, 2);
  // XP strip
  box(3, y0 + 4, W - 6, 7); rect(5, y0 + 6, Math.round((W - 10) * Math.min(1, G.xp / G.xpNeed)), 3);
  const frac = G.maxHp ? Math.max(0, G.hp) / G.maxHp : 0;
  stat(0, 92, y0, String(G.vapes), 'VAPES');
  stat(92, 78, y0, Math.round(frac * 100) + '%', 'HEALTH');
  stat(214, 68, y0, '£' + G.cash, 'CASH');
  box(282, y0 + 12, 78, 52); box(284, y0 + 14, 74, 48, FG, 1);
  text('LV ' + G.level, 321, y0 + 20, 3, FG, 0.5);
  text(metres() + 'M', 321, y0 + 42, fit(metres() + 'M', 72, 3), FG, 0.5);
  // the face
  box(170, y0 + 12, 44, 52);
  const tier = frac > 0.8 ? 0 : frac > 0.6 ? 1 : frac > 0.4 ? 2 : frac > 0.2 ? 3 : 4;
  const look = hash((G.t / 1.1) | 0);
  const mode = G.dead || G.hp <= 0 ? 'dead' : G.hurtT > 0 ? 'ouch' : G.dragT > VAPING.EXHALE ? 'drag' : G.dragT > 0 ? 'puff' : G.grinT > 0 ? 'grin' : look < 0.25 ? 'l' : look < 0.5 ? 'r' : 'c';
  const jolt = G.hurtT > 0.35 ? Math.round(Math.sin(G.t * 60) * 2) : 0;
  ctx.drawImage(face(tier, mode), 174 + jolt, y0 + 17);
  if (G.hurtT > 0.45 && ((G.t * 20) & 1)) box(171, y0 + 13, 42, 50, FG, 3);          // hit flash, palette-safe
  // pause button stays up top, out of the thumbs' way
  rect(W - 28, 6, 22, 22, BG); box(W - 28, 6, 22, 22, FG, 2); rect(W - 21, 12, 3, 10); rect(W - 16, 12, 3, 10);
  if (G.bannerT > 0 && !(G.bannerT < 0.8 && ((G.t * 12) & 1))) textO(G.banner, W / 2, H * 0.2, 3, FG, 0.5);
  if (save.runs < 2 && G.t < 6 && !G.dead && ((G.t * 3) & 1)) {
    textO('< TAP', 28, PY + 70, 2); textO('TAP >', W - 28, PY + 70, 2, FG, 1);
  }
}
export const PAUSE_RECT = { x: W - 48, y: 0, w: 48, h: 44 };   // generous: thumbs are big
