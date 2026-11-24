// Draws the world and the in-run HUD. Three colours only: black, white, ginger.
import { VIEW, COLORS, BIOMES, VAPING, JUICE, IMMUNITY, PLAYER, SEA } from './config.js';
import { ctx, view, rect, box, text, textO, textW, draw, drawDisc, face, SPR, hash, LIGHTHOUSE_LAMP_Y } from './gfx.js';
import { G, S, DEV, orcaAt, vapes, enemies, hazards, clouds, parts, floaters, orbs, biomeAt, dangerAt, seaAt, leftAt, rightAt, playerY, metres } from './game.js';
import { save, shopLvl, stick, STICK_R, moveVector } from './platform.js';
import { devOverlay } from './dev.js';
import { drawBoss, drawBossTop, bossHud } from './boss.js';

const { BG, FG, GINGER } = COLORS, W = VIEW.W;
export const BAR_H = 64;
let PY = 0, KY = 0, D = 0, VW = VIEW.W, VH = 640, checker = null;   // PY: the kayak's resting row; KY: where she is drawn (the camera can lead her)
const sy = (wy) => PY - Math.round(wy - D);

function getChecker() {
  if (checker) return checker;
  const c = document.createElement('canvas'); c.width = c.height = 2;
  const g = c.getContext('2d'); g.fillStyle = FG; g.fillRect(0, 0, 1, 1); g.fillRect(1, 1, 1, 1);
  return checker = ctx.createPattern(c, 'repeat');
}
export function dither(x, y, w, h) { ctx.fillStyle = getChecker(); ctx.fillRect(x | 0, y | 0, w | 0, h | 0); }

let CX = 0;      // camera x: 0 on the river, follows the kayak sideways at sea
function drawWater(lo, hi) {
  const i0 = Math.floor(CX / 16) - 1, nI = Math.ceil(VW / 16) + 3;
  for (let j = Math.floor(lo / 16); j <= Math.floor(hi / 16); j++) {
    const y = sy(j * 16), sea = seaAt(j * 16);
    for (let i = i0; i < i0 + nI; i++) {
      const h = hash(j * 131 + i * 7919);
      if (h < 0.05) rect(i * 16 + h * 200, y, h < 0.02 ? 5 : 3, 1);
      else if (sea > 0 && h < 0.05 + 0.05 * sea) {                       // open sea: little rolling waves
        const x = i * 16 + (h * 977 % 1) * 12, k = ((G.t * 1.5 + h * 9) | 0) & 1;
        rect(x, y + k, 3, 1); rect(x + 3, y - 1 + k, 3, 1); rect(x + 6, y + k, 2, 1);
      }
    }
  }
}
function bankGlyph(bi, x, y, j, c) {
  if (bi === 0) { rect(x, y + 3, 6, 1, c); rect(x + ((j & 1) ? 1 : 4), y + 4, 1, 3, c); }
  else if (bi === 1) { rect(x + 1, y + 2, 1, 1, c); rect(x + 5, y + 5, 1, 1, c); }
  else { rect(x + 1, y + 3, 4, 1, c); rect(x + 2, y + 2, 2, 1, c); rect(x + 3, y + 4, 2, 1, c); }
}
let hudShown = true;
// ordered-dither fills: a 4x4 Bayer tile per (colour, density), so the land thins out pixel by pixel
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5], ditherFills = {};
function ditherFill(color, density) {
  const key = color + density;
  if (ditherFills[key]) return ditherFills[key];
  const px = BIOMES.BANK_DITHER_PX, c = document.createElement('canvas'); c.width = c.height = 4 * px;
  const g = c.getContext('2d'); g.fillStyle = color;
  for (let i = 0; i < 16; i++) if (BAYER[i] / 16 < density) g.fillRect((i % 4) * px, (i >> 2) * px, px, px);
  return ditherFills[key] = ctx.createPattern(c, 'repeat');
}
function drawBanks(lo, hi) {
  let lp = null, rp = null;
  for (let j = Math.floor(lo / 8) - 1; j <= Math.floor(hi / 8) + 1; j++) {
    const wy = j * 8, y = sy(wy + 8);
    const l = Math.round(leftAt(wy) / 4) * 4, r = Math.round(rightAt(wy) / 4) * 4;
    if (l < CX - 90 && r > CX + VW + 90) { lp = l; rp = r; continue; }       // out at sea: no banks in view
    if (l > CX) rect(CX, y, l - CX, 8, BG); if (r < CX + VW) rect(r, y, CX + VW - r, 8, BG);
    const b = biomeAt(wy), bi = Math.min(BIOMES.BANK_COLORS.length - 1, Math.floor(b) + (hash(j * 53) < b % 1 ? 1 : 0));
    const [edge, land] = BIOMES.BANK_COLORS[bi];
    for (const [off, w, dens] of BIOMES.BANK_FADE) {            // coloured land, dithering out to black
      ctx.fillStyle = dens >= 1 ? land : ditherFill(land, dens);
      ctx.fillRect(l - 3 - off - w, y, w, 8); ctx.fillRect(r + 3 + off, y, w, 8);
    }
    // late game: the bank edge flickers red and white, and bites
    const hot = dangerAt(wy), c = hot ? (((G.t * 6) | 0) & 1 ? FG : COLORS.ENEMY) : edge, t = 3;
    rect(l - t, y, t, 8, c); rect(r, y, t, 8, c);
    if (lp !== null && lp !== l) rect(Math.min(l, lp) - t, y + 7, Math.abs(l - lp) + t, 2, c);
    if (rp !== null && rp !== r) rect(Math.min(r, rp), y + 7, Math.abs(r - rp) + t, 2, c);
    lp = l; rp = r;
    for (let k = 1; k <= 4; k++) {
      if (hash(j * 977 + k * 31) < 0.45 / k) bankGlyph(bi, l - 4 - k * 8, y, j + k, edge);
      if (hash(j * 613 + k * 17) < 0.45 / k) bankGlyph(bi, r - 2 + k * 8, y, j + k, edge);
    }
    const dh = hash(j * 271);
    if (dh < 0.045) {
      const s = bi === 0 ? (dh < 0.011 ? SPR.signs[(dh * 9973 | 0) % SPR.signs.length] : dh < 0.025 ? SPR.lamp : SPR.bollard) : bi === 1 ? SPR.cactus : SPR.palm;
      if (dh * 1000 % 2 < 1) { if (l - CX > s.width + 20) ctx.drawImage(s, l - s.width - 10, y); } else if (r < CX + VW - s.width - 20) ctx.drawImage(s, r + 11, y);
    }
  }
}
/** static bezel: the face is split down the middle and the split sits at the screen edges */
function drawHazards(top) {
  for (let i = 0; i < hazards.n; i++) {
    const h = hazards.items[i], y = sy(h.wy);
    if (y < -80 || y > VH + 80) continue;
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
    if (y < -c.r || y > VH + c.r) continue;
    if (c.kind === 'ring') { if (t < 0.85 || ((G.t * 20) & 1)) { drawDisc(c.x, y, c.r, 3); drawDisc(c.x, y, c.r - 2, 3); if (c.r > 12) drawDisc(c.x, y, c.r - 5, 3); } continue; }
    const sea = G.seaF > 0.5;                                        // at sea, lighter clouds: you can see the fight through them
    drawDisc(c.x, y, c.r, (c.kind === 'puff' || c.kind === 'poof') ? (t < 0.1 ? (sea ? 1 : 0) : t < (sea ? 0.25 : 0.7) ? 1 : 2) : (t < (sea ? 0.3 : 0.65) ? 1 : 2));
  }
}
// lighthouses: a fixed beam from each one points the way to the next (never explained: you work it out)
let beamFill = null;
/** layer 'base': beams and the rocky island; layer 'top': the tower. Anything drawn between the two (the
 *  boss's snake) passes behind the tower but over the ground at its foot */
function drawLights(layer) {
  const L = G.lights; if (!L.length) return;
  const base = layer !== 'top', tower = layer !== 'base';
  if (!beamFill) beamFill = [ditherFill(FG, 0.25), ditherFill(FG, 0.5)];
  for (let i = 0; i < L.length; i++) {
    const h = L[i], nx = L[i + 1], y = sy(h.wy), top = y + 10 - SPR.lighthouse.height, ly = top + 1 + LIGHTHOUSE_LAMP_Y;
    if (nx && base) {
      const a = Math.atan2(-(nx.wy - h.wy), nx.x - h.x);
      for (let k = 0; k < 2; k++) {
        const sp = SEA.BEAM_SPREAD * (k ? 0.45 : 1), len = SEA.BEAM_LEN * (k ? 0.7 : 1);
        ctx.fillStyle = beamFill[k]; ctx.beginPath(); ctx.moveTo(h.x, ly);
        ctx.lineTo(h.x + Math.cos(a - sp) * len, ly + Math.sin(a - sp) * len); ctx.lineTo(h.x + Math.cos(a + sp) * len, ly + Math.sin(a + sp) * len);
        ctx.closePath(); ctx.fill();
      }
    }
    if (y < -40 || top > VH + 40 || h.x < CX - 80 || h.x > CX + VW + 80) continue;
    if (base) {
    drawDisc(h.x, y + 14, 46, 2); drawDisc(h.x, y + 12, 36, 1);                 // surf and rock
    for (let k = 0; k < 9; k++) { const a = k / 9 * 6.283 + h.x, rr = 18 + (hash(k * 31 + (h.wy | 0)) * 10 | 0); rect(h.x + Math.cos(a) * rr - 4, y + 10 + Math.sin(a) * rr * 0.6 - 3, 8, 6, BG); rect(h.x + Math.cos(a) * rr - 3, y + 10 + Math.sin(a) * rr * 0.6 - 2, 6, 3, FG); }
    }
    if (!tower) continue;
    if (((G.t * 3) | 0) & 1) drawDisc(h.x, ly, 16, 3);                    // the lamp pulses
    draw(SPR.lighthouse, h.x, top + SPR.lighthouse.height / 2);
    if (h.visited) textO(':(', h.x, y + 30, 2, FG, 0.5);
  }
}
function drawPickups() {
  for (let i = 0; i < vapes.n; i++) {
    const v = vapes.items[i], y = sy(v.wy);
    if (y < -20 || y > VH + 20) continue;
    if (v.kind === 'tea') { draw(SPR.tea, v.x, y + Math.round(Math.sin(G.t * 4 + v.ang) * 1.5)); continue; }
    if (v.kind === 'cash') { draw(SPR.cash, v.x, y + Math.round(Math.sin(G.t * 5 + v.ang) * 1.5)); continue; }
    const fr = v.kind === 'big' ? SPR.bigVape : SPR.vape;
    draw(fr[((v.ang / 6.283 * 16) | 0) & 15], v.x, y);
  }
}
function drawEnemies() {
  for (let i = 0; i < enemies.n; i++) {
    const e = enemies.items[i], y = sy(e.wy);
    if (y < -24 || y > VH + 24) continue;
    const s = SPR[e.type], bob = e.type === 'mozzie' || e.type === 'gull' ? 0 : Math.round(Math.sin(G.t * 6 + e.seed) * 1);
    if (e.flash > 0) drawDisc(e.x, y, e.r + 2, 0);
    else if (e.type === 'puffer' && e.inflate > 0) { const k = e.r / 7; ctx.drawImage(s, Math.round(e.x - s.width * k / 2), Math.round(y + bob - s.height * k / 2), Math.round(s.width * k), Math.round(s.height * k)); }
    else if (e.type === 'cutter') drawRot(s, e.x, y, Math.atan2(e.hx || 0, e.hy || 1));
    else if (e.type === 'gull') { ctx.save(); ctx.translate(Math.round(e.x), y); ctx.rotate(Math.atan2(-e.vwy, e.vx) - Math.PI / 2); ctx.drawImage(s, -(s.width >> 1), -(s.height >> 1)); ctx.restore(); }
    else draw(s, e.x, y + bob);
  }
}
// killer whales: a blinking dotted warning along the path, then the pod sweeps through, surfacing and diving
let shadowFill = null;
function drawRot(s, x, y, a) {
  if (!a) { draw(s, x, y); return; }
  ctx.save(); ctx.translate(Math.round(x), Math.round(y)); ctx.rotate(a); ctx.drawImage(s, -(s.width >> 1), -(s.height >> 1)); ctx.restore();
}
function drawPods() {
  if (!G.pods || !G.pods.length) return;
  if (!shadowFill) shadowFill = ditherFill('#4a6478', 0.5);
  for (const pod of G.pods) {
    const cx = pod.ax, cy = pod.ay;
    if (pod.t < SEA.ORCA_WARN + 0.35) {                                    // the warning: ripples along the line, ! where they come from
      const on = ((pod.t * 8) | 0) & 1;
      for (let s = 0; s <= pod.L; s += 12) {
        const f = s / pod.L, ux = (pod.x1 - pod.x0) / pod.L, uy = (pod.y1 - pod.y0) / pod.L, b = Math.sin(f * Math.PI) * pod.arc;
        const x = cx + pod.x0 + (pod.x1 - pod.x0) * f - uy * b, y = sy(cy + pod.y0 + (pod.y1 - pod.y0) * f + ux * b);
        if (((s / 12) & 1) === on) rect(x - 3, y - 1, 6, 2, COLORS.ENEMY);
      }
      const ex = Math.max(CX + 14, Math.min(CX + VW - 14, cx + pod.x0)), ey = Math.max(40, Math.min(VH - 90, sy(cy + pod.y0)));
      if (on) textO('!', ex, ey - 8, 4, COLORS.ENEMY, 0.5);
    }
    for (let i = pod.n - 1; i >= 0; i--) {
      const o = orcaAt(pod, i); if (!o) continue;
      const y = sy(o.wy);
      const left = Math.cos(o.ang) < 0;
      ctx.save(); ctx.translate(Math.round(o.x), y); ctx.rotate(-o.ang); if (left) ctx.scale(1, -1);   // side-on, belly always down
      if (o.up) { const s = SPR.orca; ctx.drawImage(s, -(s.width >> 1), -(s.height >> 1)); }
      else { ctx.fillStyle = shadowFill; ctx.fillRect(-34, -6, 68, 14); ctx.fillRect(-26, -9, 50, 20); }   // the dark shape under the surface...
      ctx.restore();
      if (!o.up) {                                                      // ...and the fin slicing through it
        const f = SPR.orcaFin; ctx.save(); ctx.translate(Math.round(o.x), y - 6); if (left) ctx.scale(-1, 1);
        ctx.drawImage(f, -(f.width >> 1) + 4, -f.height); ctx.restore();
        if (((G.t * 10 + i) | 0) & 1) rect(o.x - 10, y - 5, 20, 1, FG);           // a little bow wave
      }
    }
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
  const Z = mode === 'full' ? G.zoom || 1 : 1;                           // at sea the camera pulls back
  VW = W / Z; VH = view.H / Z;
  PY = Math.round(VH * playerY() / view.H); D = Math.round(G.dist + (mode === 'full' ? G.camY || 0 : 0)); KY = sy(G.dist);
  CX = mode === 'full' ? Math.round((G.camX || 0) + (W - VW) / 2) : 0;
  const lo = D - (VH - PY), hi = D + PY;
  rect(0, 0, W, view.H, BG);
  ctx.save();
  if (Z !== 1) ctx.scale(Z, Z);
  if (G.shake > 0.3) ctx.translate(Math.round((Math.random() - 0.5) * G.shake * 2), Math.round((Math.random() - 0.5) * G.shake * 2));
  ctx.translate(-CX, 0);
  ctx.fillStyle = FG; drawWater(lo, hi);
  const full = mode === 'full';
  hudShown = full;
  if (full) { drawHazards(false); drawClouds(); }
  drawBanks(lo, hi);
  if (full) {
    drawBoss(sy); drawLights('base'); drawBossTop(sy); drawLights('top'); drawPickups(); drawEnemies(); drawPods();
    for (const sh of G.shots) { const y = sy(sh.wy); rect(sh.x - sh.vx * 0.05 - 2, y + sh.vy * 0.05 - 2, 4, 4, '#7a1010'); rect(sh.x - 5, y - 5, 10, 10, '#000'); rect(sh.x - 4, y - 4, 8, 8, COLORS.ENEMY); rect(sh.x - 2, y - 2, 4, 4, GINGER); rect(sh.x - 1, y - 1, 2, 2, FG); }   // HMRC shells
    for (const o of orbs) { const y = sy(o.wy); drawDisc(o.x, y, o.r, 1); drawDisc(o.x, y, o.r * 0.45, 0); }
  }
  const hd = Math.round((G.heading || 0) / (Math.PI / 16)) * (Math.PI / 16);     // 32 headings: crisp pixels, smooth enough to feel analog
  if (full && !G.dead) drawRot(SPR.kayakHalo[G.paddle], G.px, KY, hd);   // keep her readable inside the fog: a black edge hugging her shape
  if (full && G.dashT > 0 && !G.dead) {                       // dash: afterimages streaming behind her
    for (let k = 3; k >= 1; k--) { ctx.globalAlpha = 0.5 - k * 0.12; drawRot(SPR.kayak[G.paddle], G.px - Math.sin(G.dashA) * k * 11, KY + Math.cos(G.dashA) * k * 11, hd); }
    ctx.globalAlpha = 1;
  }
  if (G.flipT > 0 && !G.dead) {                              // capsized: she spins
    drawRot(SPR.kayak[G.paddle], G.px, KY, hd + (1 - G.flipT / 0.8) * Math.PI * 2);
  } else if (!G.dead && !(full && G.inv > 0 && ((G.t * 14) & 1))) drawRot(SPR.kayak[G.paddle], G.px, KY, hd);
  if (full && !G.dead && shopLvl('immunity')) {             // political immunity: solid ring when ready, dots filling in while it recharges
    const R = IMMUNITY.RADIUS, cd = IMMUNITY.COOLDOWN[shopLvl('immunity') - 1];
    if (G.shieldT <= 0) drawDisc(G.px, KY, R + (((G.t * 4) | 0) & 1), 3);
    else { const n = Math.floor((1 - G.shieldT / cd) * 16); ctx.fillStyle = FG; for (let i = 0; i < n; i++) { const a = i / 16 * 6.283 - 1.571; ctx.fillRect(Math.round(G.px + Math.cos(a) * R), Math.round(KY + Math.sin(a) * R), 2, 2); } }
  }
  if (full) drawHazards(true);
  drawFx();
  if (full && DEV.hitbox) {                                   // developer: show the real collision shapes
    const R = COLORS.ENEMY, ring = (x, y, r, c) => { ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.max(1, r), 0, 6.283); ctx.stroke(); };
    box(G.px - PLAYER.HIT_W, KY - PLAYER.HIT_H, PLAYER.HIT_W * 2, PLAYER.HIT_H * 2, R);
    ring(G.px, KY, PLAYER.PICKUP_R, COLORS.VAPE); ring(G.px, KY, PLAYER.MAGNET_R * (S.magnet || 1), '#3a6a8a');
    for (let i = 0; i < enemies.n; i++) { const e = enemies.items[i]; ring(e.x, sy(e.wy), e.r, R); }
    for (let i = 0; i < hazards.n; i++) { const h = hazards.items[i]; if (h.hw) box(h.x - h.hw, sy(h.wy) - h.hh, h.hw * 2, h.hh * 2, GINGER); }
    for (const h of G.lights || []) ring(h.x, sy(h.wy), SEA.LIGHT_R, GINGER);
  }
  if (full && G.burst > 22) {
    const n = Math.min(16, G.burst / 7) * JUICE.SPEED_FX, k = (G.t * 24) | 0;
    for (let i = 0; i < n; i++) rect(CX + hash(i * 13 + k * 7) * VW, hash(i * 29 + k * 3) * VH, 1, (20 + G.burst / 4) * JUICE.SPEED_FX);
  }
  ctx.restore();
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
  const frac = G.maxHp ? Math.max(0, G.hp) / G.maxHp : 0, pct = Math.max(0, Math.round(G.hp / PLAYER.HP * 100));
  stat(0, 92, y0, String(G.vapes), 'VAPES');
  stat(92, 78, y0, pct + '%', 'HEALTH');
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
  if (G.bannerT > 0 && !(G.bannerT < 0.8 && ((G.t * 12) & 1))) G.banner.split('\n').forEach((l, i) => textO(l, W / 2, H * 0.2 + i * 24, i ? 2 : fit(l, W, 3), FG, 0.5));
  drawStick();
  bossHud(W);
  if (save.runs < 2 && G.t < 6 && !G.dead && G.seaF < 0.5 && ((G.t * 3) & 1)) {
    textO('< TAP', 28, PY + 70, 2); textO('TAP >', W - 28, PY + 70, 2, FG, 1);
  }
  devOverlay();
}
/** the open-water analog stick: a dotted ring where your thumb landed, a knob that follows it,
 *  and a ginger pointer showing which way she's paddling. Before you touch, a ghost of it pulses. */
let stickA = 0;
function drawStick() {
  const sea = G.mode === 'play' && G.seaF > 0.5 && !G.dead;
  stickA = Math.max(0, Math.min(1, stickA + (sea && stick.on ? 0.25 : -0.12)));
  if (!sea) return;
  const ghost = !stick.on && G.seaT < 8 && !G.boss, a = stick.on ? stickA : ghost ? 0.5 + 0.5 * Math.sin(G.t * 4) : 0;
  if (a <= 0.05 && !stick.on) return;
  const R = STICK_R, ox = stick.on ? stick.ox : W / 2, oy = stick.on ? stick.oy : view.H - BAR_H - 70;
  const mv = stick.on ? moveVector() : { x: Math.sin(G.t * 1.7) * 0.8, y: Math.cos(G.t * 1.7) * 0.8 };
  const kx = ox + mv.x * R, ky = oy - mv.y * R, n = 28;
  ctx.globalAlpha = Math.max(0.25, a);
  ctx.fillStyle = BG;                                                                   // a clean dotted ring, nothing cloud-like
  for (let i = 0; i < n; i++) { const t = i / n * 6.283; ctx.fillRect(Math.round(ox + Math.cos(t) * R) - 2, Math.round(oy + Math.sin(t) * R) - 2, 4, 4); }
  for (let i = 0; i < n; i++) { const t = i / n * 6.283, big = i % 7 === 0; ctx.fillStyle = big ? GINGER : FG; ctx.fillRect(Math.round(ox + Math.cos(t) * R) - 1, Math.round(oy + Math.sin(t) * R) - 1, big ? 3 : 2, big ? 3 : 2); }
  rect(ox - 4, oy, 9, 1, FG); rect(ox, oy - 4, 1, 9, FG);                                // centre mark
  const ready = 1 - (G.dashCd || 0) / SEA.DASH_CD, dn = 20;                               // dash meter: an inner ring that fills ginger
  for (let i = 0; i < dn; i++) { const t = -1.571 + i / dn * 6.283, on = i < ready * dn; if (on || ((i & 1) === 0)) rect(Math.round(ox + Math.cos(t) * (R - 9)) - 1, Math.round(oy + Math.sin(t) * (R - 9)) - 1, 2, 2, on ? (ready >= 1 ? GINGER : FG) : '#444'); }
  const m = Math.hypot(mv.x, mv.y);
  if (m > 0.05) {                                                                       // ginger pointer on the rim
    const ang = Math.atan2(-mv.y, mv.x);
    for (let k = -2; k <= 2; k++) { const t = ang + k * 0.09; rect(Math.round(ox + Math.cos(t) * (R + 5)) - 2, Math.round(oy + Math.sin(t) * (R + 5)) - 2, 4, 4, GINGER); }
    for (let s = 6; s < m * R; s += 5) rect(Math.round(ox + mv.x / m * s) - 1, Math.round(oy - mv.y / m * s) - 1, 2, 2, FG);   // the throw
  }
  drawDisc(kx, ky, 15, 0); drawDisc(kx, ky, 15, 3); drawDisc(kx, ky, 6, 1);              // the knob
  rect(Math.round(kx) - 2, Math.round(ky) - 2, 4, 4, GINGER);
  ctx.globalAlpha = 1;
  if (ghost && ((G.t * 2) & 1)) { textO('DRAG TO PADDLE', W / 2, oy + R + 12, 2, FG, 0.5); textO('TAP TO DASH', W / 2, oy + R + 26, 2, GINGER, 0.5); }
}
export const PAUSE_RECT = { x: W - 48, y: 0, w: 48, h: 44 };   // generous: thumbs are big
