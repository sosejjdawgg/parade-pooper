// Boot, main loop and every menu screen (immediate-mode UI).
import { VIEW, COLORS, SHOP, FLAVOUR, MUSIC, LEGAL, SIDE_ART } from './config.js';
import { preloadMusic, musicFrame, musicState, openerFinished } from './music.js';
import { ctx, view, resize, rect, box, text, textO, textW, wrap, draw, buildSprites, SPR, face, loadSideArt } from './gfx.js';
import { G, newRun, update, idle, nudge, choose, playerY, enemies, clouds, vapes } from './game.js';
import { drawWorld, drawHud, dither, PAUSE_RECT } from './render.js';
import { save, loadSave, writeSave, resetSave, shopLvl, sfx, input, initInput, requestTilt, getAC } from './platform.js';

const { BG, FG, GINGER } = COLORS, W = VIEW.W, STEP = 1 / 60;
const params = new URLSearchParams(location.search);
let FAST = +params.get('fast') || 1;
let last = 0, acc = 0, modeT = 0, prevMode = '', backTo = 'title', toast = '', toastT = 0, resetArm = 0, introThenPlay = false;

// ---- immediate-mode UI ----------------------------------------------------------
const hit = (t, x, y, w, h) => t.x >= x && t.x < x + w && t.y >= y && t.y < y + h;
function tapped(x, y, w, h) {
  if (modeT < 0.3) return false;
  for (const t of input.taps) if (!t.key && hit(t, x, y, w, h)) { input.taps.length = 0; return true; }
  return false;
}
function panel(x, y, w, h, inv) { rect(x, y, w, h, inv ? FG : BG); box(x, y, w, h, FG, 2); if (!inv) box(x + 3, y + 3, w - 6, h - 6, FG, 1); }
function button(x, y, w, h, label, o = {}) {
  const s = o.scale || 2, inv = o.inv;
  rect(x, y, w, h, inv ? FG : BG); box(x, y, w, h, FG, 2);
  text(label, x + w / 2, y + (h - 5 * s) / 2, s, inv ? BG : FG, 0.5);
  if (o.disabled) { if (tapped(x, y, w, h)) sfx.no(); return false; }
  if (tapped(x, y, w, h)) { sfx.ui(); return true; }
  return false;
}
function shade() { ctx.fillStyle = BG; for (let y = 0; y < view.H; y += 2) ctx.fillRect(0, y, W, 1); }
function say(msg) { toast = msg; toastT = 2; }

// ---- screens ----------------------------------------------------------------------
/** first-timers see the how-to-play screen before their first run */
function play() { if (save.seenIntro) newRun(); else { introThenPlay = true; G.mode = 'intro'; } }

function titleScreen() {
  const H = view.H, bob = Math.round(Math.sin(G.t * 2) * 3);
  textO("ANGELA RAYNER'S", W / 2, H * 0.1 + bob, 3, GINGER, 0.5);
  for (const [word, y] of [['VAPE', H * 0.1 + 28], ['KAYAK', H * 0.1 + 88]]) {
    text(word, W / 2 + 4, y + bob + 4, 10, BG, 0.5); textO(word, W / 2, y + bob, 10, FG, 0.5);
  }
  const by = Math.round(H * 0.43);
  if (button(W / 2 - 90, by, 180, 44, 'PLAY', { scale: 4, inv: true })) play();
  const canBuy = !shopLvl('engine') && save.cash >= SHOP[0].costs[0] && ((G.t * 3) & 1);
  if (button(W / 2 - 90, by + 54, 86, 30, canBuy ? 'SHOP !' : 'SHOP', { inv: canBuy })) { backTo = 'title'; G.mode = 'shop'; }
  if (button(W / 2 + 4, by + 54, 86, 30, 'SETTINGS')) G.mode = 'settings';
  if (button(W / 2 - 90, by + 92, 180, 26, 'HOW TO PLAY')) { introThenPlay = false; G.mode = 'intro'; }
  textO('TAP LEFT / RIGHT TO STEER', W / 2, H * 0.79, 2, FG, 0.5);
  textO('COLLECT VAPES. GET POWERFUL.', W / 2, H * 0.79 + 16, 2, FG, 0.5);
  if (save.best) textO('BEST ' + save.best + ' VAPES   ' + save.bestDist + 'M   £' + save.cash, W / 2, H * 0.9, 2, FG, 0.5);
  textO('NO STAMP DUTY PAYABLE ON KAYAKS.', W / 2, H * 0.79 + 34, 2, FG, 0.5);
  textO('A FREE, NON-COMMERCIAL PARODY. NOT AFFILIATED WITH ANYONE.', W / 2, H - 12, 1, FG, 0.5);
}

// ---- intro / how to play --------------------------------------------------------
// Three steps, shown with the real in-game sprites: kayak down the river, collect vapes, avoid the dangers.
function stepTitle(n, label, y) {
  rect(22, y, 22, 22, FG); text(n, 33, y + 4, 3, BG, 0.5);
  text(label, 52, y + 4, 3, FG);
}
function chevron(y) { for (let i = 0; i < 5; i++) rect(W / 2 - 5 + i, y + i, 10 - i * 2, 1); }
function introScreen() {
  shade();
  const t = G.t, top = Math.max(2, Math.round((view.H - 636) / 2));
  const big = (s, x, y) => ctx.drawImage(s, Math.round(x - s.width), Math.round(y - s.height), s.width * 2, s.height * 2);   // real sprite, doubled
  rect(8, top, W - 16, 634, BG);
  text('HOW TO PLAY', W / 2, top + 10, 5, FG, 0.5);

  // 1 ---- kayak down the river
  let y = top + 42;
  panel(12, y, W - 24, 136); stepTitle(1, 'KAYAK DOWN THE RIVER', y + 10);
  const sx = 24, sy0 = y + 40, sw = 150, sh = 86, kx = sx + sw / 2 + Math.sin(t * 1.5) * 34, goingLeft = Math.cos(t * 1.5) < 0;
  ctx.save(); ctx.beginPath(); ctx.rect(sx, sy0, sw, sh); ctx.clip();
  rect(sx, sy0, sw, sh, BG);
  for (let i = 0; i < 9; i++) rect(sx + 22 + ((i * 53) % 104), sy0 + ((t * 60 + i * 37) % (sh + 6)) - 3, 3, 1);      // water rushing past
  for (let row = -1; row < 13; row++) {                                                                                // stepped banks
    const yy = sy0 + row * 8 + ((t * 60) % 8), off = ((row - Math.floor(t * 60 / 8)) % 5 + 5) % 5 < 2 ? 4 : 0;
    rect(sx + 12 + off, yy, 2, 8); rect(sx + sw - 14 - off, yy, 2, 8);
  }
  for (let i = 0; i < 3; i++) { const vy = ((t * 60 + i * 40) % 120) - 12; if (vy < 52) draw(SPR.vape[((t * 9 + i * 3) | 0) & 15], sx + sw / 2 + Math.sin((t - (60 - vy) / 60) * 1.5) * 34, sy0 + vy); }
  draw(SPR.kayak[((t * 3) | 0) & 1], kx, sy0 + 62);
  ctx.restore(); box(sx, sy0, sw, sh);
  text('TAP THE LEFT OR', 186, y + 42, 2); text('RIGHT HALF OF', 186, y + 55, 2); text('THE SCREEN TO', 186, y + 68, 2); text('STEER.', 186, y + 81, 2);
  rect(186, y + 100, 70, 24, goingLeft ? FG : BG); box(186, y + 100, 70, 24); text('< LEFT', 221, y + 107, 2, goingLeft ? BG : FG, 0.5);
  rect(262, y + 100, 74, 24, goingLeft ? BG : FG); box(262, y + 100, 74, 24); text('RIGHT >', 299, y + 107, 2, goingLeft ? FG : BG, 0.5);
  chevron(y + 139);

  // 2 ---- collect vapes
  y += 146;
  panel(12, y, W - 24, 130); stepTitle(2, 'COLLECT VAPES', y + 10);
  const items = [[SPR.vape[((t * 9) | 0) & 15], '+1'], [SPR.bigVape[((t * 5) | 0) & 15], '+5'], [SPR.tea, 'HEALS'], [SPR.cash, 'CASH']];
  items.forEach(([s, label], i) => { const x = 58 + i * 82; big(s, x, y + 56 + (i > 1 ? Math.round(Math.sin(t * 4 + i) * 2) : 0)); text(label, x, y + 80, 2, FG, 0.5); });
  text('VAPES LEVEL YOU UP. EACH LEVEL', W / 2, y + 98, 2, FG, 0.5); text('GIVES YOU A NEW POWER.', W / 2, y + 111, 2, FG, 0.5);
  chevron(y + 133);

  // 3 ---- avoid the dangers
  y += 140;
  panel(12, y, W - 24, 248); stepTitle(3, 'AVOID THE DANGERS', y + 10);
  text('ENEMIES: A TOUCH COSTS HEALTH', 24, y + 38, 2);
  ['swan', 'pap', 'tumble', 'piranha', 'mozzie', 'croc'].forEach((k, i) => big(SPR[k], 46 + i * 54, y + 74 + Math.round(Math.sin(t * 6 + i) * 2)));
  text('YOUR VAPE CLOUDS DESTROY THEM', 24, y + 100, 2);
  rect(24, y + 115, W - 48, 1);
  text('THESE SINK YOU INSTANTLY', 24, y + 122, 2);
  ctx.save(); ctx.translate(80, y + 154); ctx.rotate(Math.PI / 2); ctx.drawImage(SPR.barge[70], -SPR.barge[70].width / 2, -SPR.barge[70].height / 2); ctx.restore();
  text('BARGE', 80, y + 174, 1, FG, 0.5);
  dither(150, y + 145, 70, 18); rect(150, y + 143, 70, 2); rect(150, y + 163, 70, 2); draw(SPR.pier, 185, y + 154); text('LOW BRIDGE', 185, y + 174, 1, FG, 0.5);
  rect(250, y + 149, 34, 10); rect(304, y + 149, 30, 10); rect(281, y + 146, 6, 16); rect(301, y + 146, 6, 16); text('LOCK GATE', 292, y + 174, 1, FG, 0.5);
  rect(24, y + 185, W - 48, 1);
  text('THESE HURT OR SLOW YOU', 24, y + 192, 2);
  draw(SPR.trolley, 44, y + 224); big(SPR.barrel, 80, y + 224); big(SPR.cone, 108, y + 224);
  draw(SPR.sandbar[0], 158, y + 224);
  ctx.fillStyle = FG; for (let arm = 0; arm < 3; arm++) for (let k = 0; k < 8; k++) { const a = -t * 4 + arm * 2.094 + k * 0.5, r = 2 + k * 2; ctx.fillRect(Math.round(214 + Math.cos(a) * r), Math.round(y + 224 + Math.sin(a) * r * 0.9), 2, 2); }
  rect(244, y + 211, 3, 26, COLORS.ENEMY); for (let i = 0; i < 3; i++) rect(250 + (i % 2) * 4, y + 214 + i * 8, 5, 1, COLORS.ENEMY);
  text('RED BANKS', 302, y + 213, 2, FG, 0.5); text('LATER ON', 302, y + 226, 2, FG, 0.5);

  if (button(40, top + 582, W - 80, 46, save.seenIntro ? 'GOT IT' : "LET'S GO", { scale: 4, inv: true })) {
    const first = !save.seenIntro; save.seenIntro = true; writeSave();
    if (first || introThenPlay) newRun(); else G.mode = 'title';
  }
}

function levelUpScreen() {
  shade();
  textO('LEVEL UP!', W / 2, 34, 5, FG, 0.5);
  textO('LEVEL ' + (G.level - G.pending + 1) + ' - CHOOSE ONE', W / 2, 68, 2, FG, 0.5);
  const ch = 112, gap = 12, y0 = Math.max(92, Math.round((view.H - 3 * ch - 2 * gap) / 2) + 20);
  for (let i = 0; i < G.choices.length; i++) {
    const c = G.choices[i], y = y0 + i * (ch + gap), inv = c.kind === 'evo';
    const fg = inv ? BG : FG, pop = Math.max(0, 1 - (modeT - i * 0.06) * 6), x = 20 + Math.round(pop * 40);
    panel(x, y, W - 40, ch, inv);
    text(c.title, x + 14, y + 14, 3, fg);
    if (c.tag) { const tw = textW(c.tag, 2) + 10; rect(x + W - 40 - tw - 10, y + 12, tw, 18, fg); text(c.tag, x + W - 40 - 15, y + 16, 2, inv ? FG : BG, 1); }
    wrap(c.desc, 36).forEach((l, k) => text(l, x + 14, y + 44 + k * 14, 2, fg));
    text('TAP TO TAKE', x + 14, y + ch - 16, 1, fg);
    if (tapped(20, y, W - 40, ch)) { choose(i); return; }
  }
}

function deadScreen() {
  shade();
  const r = G.result, y = Math.round(view.H / 2 - 245);
  panel(20, y, W - 40, 490);
  text(r.title, W / 2, y + 22, Math.min(8, Math.floor(300 / (r.title.length * 4))), FG, 0.5);
  text(FLAVOUR.CAUSES[G.cause] || '', W / 2, y + 72, 2, FG, 0.5);
  draw(SPR.bigVape[((G.t * 10) | 0) & 15], W / 2, y + 108);
  text(r.vapes, W / 2, y + 126, 8, FG, 0.5);
  text(r.newBest ? 'NEW BEST!' : 'VAPES', W / 2, y + 172, 2, r.newBest && ((G.t * 4) & 1) ? BG : FG, 0.5);
  const rows = [['DISTANCE', r.m + 'M'], ['LEVEL', r.level], ['MELTED', r.kills], ['TAX ADVICE TAKEN', 'NONE'], ['CASH BANKED', '+£' + r.cash]];
  rows.forEach(([a, b], i) => { text(a, 44, y + 202 + i * 18, 2); text(b, W - 44, y + 202 + i * 18, 2, FG, 1); });
  rect(44, y + 294, W - 88, 1);
  text('WALLET £' + save.cash, W / 2, y + 302, 2, FG, 0.5);
  if (button(40, y + 324, W - 80, 44, 'GO AGAIN', { scale: 4, inv: true })) { newRun(); return; }
  const canBuy = SHOP.some((it) => canAfford(it)) && ((G.t * 3) & 1);
  if (button(40, y + 378, 134, 34, canBuy ? 'SHOP !' : 'SHOP', { inv: canBuy })) { backTo = 'dead'; G.mode = 'shop'; }
  if (button(186, y + 378, 134, 34, 'SHARE')) share();
  wrap('TIP: ' + r.tip, 36).forEach((l, k) => text(l, W / 2, y + 426 + k * 13, 2, FG, 0.5));
  text('A PARODY. NO KAYAKS WERE HARMED.', W / 2, y + 472, 1, FG, 0.5);
}
function canAfford(it) {
  const lvl = shopLvl(it.id);
  return lvl < it.costs.length && save.cash >= it.costs[lvl] && (!it.needs || shopLvl(it.needs));
}
async function share() {
  const r = G.result, url = location.origin + location.pathname;
  const msg = `I collected ${r.vapes} vapes and paddled ${r.m}m in Angela Rayner's: Vape Kayak. Beat that.`;
  try {
    if (navigator.share) await navigator.share({ title: "Angela Rayner's: Vape Kayak", text: msg, url });
    else { await navigator.clipboard.writeText(msg + ' ' + url); say('COPIED TO CLIPBOARD'); }
  } catch { /* user cancelled */ }
}

function shopScreen() {
  shade();
  const rowH = 62, top = Math.max(8, Math.round((view.H - (60 + SHOP.length * rowH + 50)) / 2));
  textO('SHOP', 14, top + 6, 6);
  textO('£' + save.cash, W - 14, top + 14, 4, FG, 1);
  SHOP.forEach((it, i) => {
    const y = top + 52 + i * rowH, lvl = shopLvl(it.id), max = lvl >= it.costs.length, locked = it.needs && !shopLvl(it.needs);
    panel(8, y, W - 16, rowH - 4);
    text(it.name, 18, y + 9, 2);
    for (let k = 0; k < it.costs.length; k++) { const px = 22 + textW(it.name, 2) + k * 8; if (k < lvl) rect(px, y + 9, 6, 10); else box(px, y + 9, 6, 10); }
    wrap(it.desc, 31).forEach((l, k) => text(l, 18, y + 25 + k * 12, 2));
    if (it.flavour) text(it.flavour, 18, y + 47, 1);
    const label = max ? 'MAX' : locked ? 'LOCKED' : '£' + it.costs[lvl], ok = !max && !locked && save.cash >= it.costs[lvl];
    if (button(W - 86, y + 12, 68, 32, label, { inv: ok, disabled: !ok })) {
      save.cash -= it.costs[lvl]; save.shop[it.id] = lvl + 1; writeSave(); sfx.buy(); say(it.name + ' UPGRADED');
    }
  });
  const y = top + 52 + SHOP.length * rowH + 4;
  if (backTo === 'dead') {
    if (button(8, y, 130, 36, 'BACK')) G.mode = 'dead';
    if (button(146, y, W - 154, 36, 'GO AGAIN', { inv: true })) newRun();
  } else if (button(8, y, W - 16, 36, 'BACK')) G.mode = 'title';
}

function settingsScreen() {
  shade();
  const y = Math.round(view.H / 2 - 195);
  panel(20, y, W - 40, 390);
  text('SETTINGS', W / 2, y + 20, 5, FG, 0.5);
  if (button(40, y + 64, W - 80, 40, 'SOUND: ' + (save.sound ? 'ON' : 'OFF'), { scale: 3 })) { save.sound = !save.sound; writeSave(); }
  if (button(40, y + 114, W - 80, 40, 'TILT STEER: ' + (save.tilt ? 'ON' : 'OFF'), { scale: 3 })) {
    if (save.tilt) { save.tilt = false; writeSave(); }
    else requestTilt().then((ok) => { save.tilt = ok; writeSave(); if (!ok) say('TILT NOT AVAILABLE'); });
  }
  const armed = G.t - resetArm < 3;
  if (button(40, y + 164, W - 80, 40, armed ? 'TAP AGAIN TO WIPE' : 'RESET PROGRESS', { scale: 2, inv: armed })) {
    if (armed) { resetSave(); resetArm = 0; say('PROGRESS RESET'); } else resetArm = G.t;
  }
  if (button(40, y + 214, W - 80, 40, 'SIDE ART: ' + (save.sideArt ? 'ON' : 'OFF'), { scale: 3 })) { save.sideArt = !save.sideArt; writeSave(); }
  if (button(40, y + 264, W - 80, 40, 'ABOUT AND LEGAL', { scale: 2 })) G.mode = 'legal';
  if (button(40, y + 326, W - 80, 44, 'BACK', { scale: 3, inv: true })) G.mode = 'title';
}

function legalScreen() {
  shade();
  rect(10, 10, W - 20, view.H - 20, BG); box(10, 10, W - 20, view.H - 20, FG, 2);
  text('ABOUT AND LEGAL', W / 2, 24, 4, FG, 0.5);
  let y = 58;
  LEGAL.forEach((block, i) => {
    if (i % 2 === 0) { text(block, 24, y, 3, GINGER); y += 21; return; }
    if (LEGAL[i - 1] === 'MUSIC' && !window.__NO_OPENER) block += ' OPENING TRACK: RIVER (8 BIT TRIBUTE) BY 8 BIT UNIVERSE, PRIVATE BUILD ONLY.';
    wrap(block, 39).forEach((l) => { text(l, 24, y, 2); y += 12; });
    y += 7;
  });
  if (button(40, view.H - 66, W - 80, 44, 'BACK', { scale: 3, inv: true })) G.mode = 'settings';
}

function pauseScreen() {
  shade();
  const y = Math.round(view.H / 2 - 100);
  panel(40, y, W - 80, 200);
  text('PAUSED', W / 2, y + 22, 6, FG, 0.5);
  if (button(60, y + 76, W - 120, 44, 'RESUME', { scale: 4, inv: true }) || input.pause) G.mode = 'play';
  if (button(60, y + 132, W - 120, 36, 'QUIT RUN')) { G.mode = 'title'; G.dead = false; }
}

// ---- main loop ----------------------------------------------------------------------
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - last) / 1000 || 0); last = ts;
  if (G.mode !== prevMode) { prevMode = G.mode; modeT = 0; acc = 0; }
  modeT += dt;

  if (G.mode === 'play') {
    for (const t of input.taps) {
      if (!t.key && hit(t, PAUSE_RECT.x, PAUSE_RECT.y, PAUSE_RECT.w, PAUSE_RECT.h)) input.pause = true;
      else nudge(t.x < W / 2 ? -1 : 1);
    }
    if (input.pause && !G.dead) { G.mode = 'pause'; input.pause = false; }   // consume it, or the pause screen reads it as 'resume'
    else {
      acc += dt * FAST;
      while (acc >= STEP && G.mode === 'play') { update(STEP); acc -= STEP; }
    }
  } else if (G.mode === 'title' || G.mode === 'shop' || G.mode === 'settings' || G.mode === 'legal' || G.mode === 'intro') idle(dt);
  else G.t += dt;

  if (G.bot) {      // headless balance runs
    if (G.mode === 'levelup') { const rank = { evo: 0, weapon: 1, passive: 2 }; let bi = 0; G.choices.forEach((c, i) => { if ((rank[c.kind] ?? 3) < (rank[G.choices[bi].kind] ?? 3)) bi = i; }); choose(Math.random() < 0.6 ? bi : (Math.random() * 3) | 0); }
    if (G.mode === 'dead') { (window.__runs = window.__runs || []).push({ ...G.result, cause: G.cause, t: G.t, weapons: { ...G.weapons }, evo: { ...G.evo } }); newRun(); G.bot = true; }
  }

  const onTitle = G.mode === 'title' || G.mode === 'settings' || G.mode === 'legal' || G.mode === 'intro' || (G.mode === 'shop' && backTo === 'title');
  musicFrame(!openerFinished() ? MUSIC.OPENER : onTitle ? 'menu' : MUSIC.BIOME_TRACKS[G.biomeIdx || 0], G.mode !== 'play' && G.mode !== 'title');
  const menu = G.mode === 'title' || G.mode === 'settings' || G.mode === 'legal' || G.mode === 'intro' || (G.mode === 'shop');
  drawWorld(menu ? 'menu' : 'full');
  if (!menu) drawHud();
  if (G.mode === 'title') titleScreen();
  else if (G.mode === 'levelup') levelUpScreen();
  else if (G.mode === 'dead') deadScreen();
  else if (G.mode === 'shop') shopScreen();
  else if (G.mode === 'settings') settingsScreen();
  else if (G.mode === 'legal') legalScreen();
  else if (G.mode === 'intro') introScreen();
  else if (G.mode === 'pause') pauseScreen();
  if (toastT > 0) { toastT -= dt; const tw = textW(toast, 2) + 20; rect(W / 2 - tw / 2, view.H - 96, tw, 22, FG); text(toast, W / 2, view.H - 90, 2, BG, 0.5); }

  input.taps.length = 0; input.pause = false;
}

function boot() {
  loadSave(); resize(); buildSprites(); initInput(); preloadMusic();
  loadSideArt(window.__ART || SIDE_ART.SRC);
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.dead && !G.bot) G.mode = 'pause';
    const a = getAC(); if (a) { if (document.hidden) a.suspend(); else a.resume(); } });
  window.addEventListener('keydown', (e) => {
    if (G.mode === 'levelup' && modeT > 0.3 && '123'.includes(e.key)) choose(+e.key - 1);
    if ((e.key === 'Enter' || e.key === ' ') && modeT > 0.3 && (G.mode === 'title' || G.mode === 'dead')) { if (G.mode === 'title') play(); else newRun(); }
  });
  newRun(); G.mode = 'title'; G.banner = ''; G.inv = 0;
  if (params.get('bot')) { newRun(); G.bot = true; G.god = !!params.get('god'); G.hits = G.crashes = 0; }
  window.__vc = { text, setFast: (n) => { FAST = n; }, musicState, G, save, newRun, enemies, clouds, vapes, SPR, face };
  requestAnimationFrame(frame);
}
boot();
