// Boot, main loop and every menu screen (immediate-mode UI).
import { VIEW, COLORS, SHOP, FLAVOUR, MUSIC } from './config.js';
import { preloadMusic, musicFrame, musicState, openerFinished } from './music.js';
import { ctx, view, resize, rect, box, text, textO, textW, wrap, draw, buildSprites, SPR, face } from './gfx.js';
import { G, newRun, update, idle, nudge, choose, playerY, enemies, clouds, vapes } from './game.js';
import { drawWorld, drawHud, dither, PAUSE_RECT } from './render.js';
import { save, loadSave, writeSave, resetSave, shopLvl, sfx, input, initInput, requestTilt, getAC } from './platform.js';

const { BG, FG, GINGER } = COLORS, W = VIEW.W, STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const FAST = +params.get('fast') || 1;
let last = 0, acc = 0, modeT = 0, prevMode = '', backTo = 'title', toast = '', toastT = 0, resetArm = 0;

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
function titleScreen() {
  const H = view.H, bob = Math.round(Math.sin(G.t * 2) * 3);
  textO("ANGELA RAYNER'S", W / 2, H * 0.1 + bob, 3, GINGER, 0.5);
  for (const [word, y] of [['VAPE', H * 0.1 + 28], ['CANOE', H * 0.1 + 88]]) {
    text(word, W / 2 + 4, y + bob + 4, 10, BG, 0.5); textO(word, W / 2, y + bob, 10, FG, 0.5);
  }
  const by = Math.round(H * 0.43);
  if (button(W / 2 - 90, by, 180, 44, 'PLAY', { scale: 4, inv: true })) newRun();
  const canBuy = !shopLvl('engine') && save.cash >= SHOP[0].costs[0] && ((G.t * 3) & 1);
  if (button(W / 2 - 90, by + 54, 86, 30, canBuy ? 'SHOP !' : 'SHOP', { inv: canBuy })) { backTo = 'title'; G.mode = 'shop'; }
  if (button(W / 2 + 4, by + 54, 86, 30, 'SETTINGS')) G.mode = 'settings';
  textO('TAP LEFT / RIGHT TO STEER', W / 2, H * 0.79, 2, FG, 0.5);
  textO('COLLECT VAPES. GET POWERFUL.', W / 2, H * 0.79 + 16, 2, FG, 0.5);
  if (save.best) textO('BEST ' + save.best + ' VAPES   ' + save.bestDist + 'M   £' + save.cash, W / 2, H * 0.9, 2, FG, 0.5);
  textO('NO STAMP DUTY PAYABLE ON CANOES.', W / 2, H * 0.79 + 34, 2, FG, 0.5);
  textO('A PARODY. NOT AFFILIATED WITH ANYONE.', W / 2, H - 12, 1, FG, 0.5);
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
  text('A PARODY. NO CANOES WERE HARMED.', W / 2, y + 472, 1, FG, 0.5);
}
function canAfford(it) {
  const lvl = shopLvl(it.id);
  return lvl < it.costs.length && save.cash >= it.costs[lvl] && (!it.needs || shopLvl(it.needs));
}
async function share() {
  const r = G.result, url = location.origin + location.pathname;
  const msg = `I collected ${r.vapes} vapes and paddled ${r.m}m in Angela Rayner's Vape Canoe. Beat that.`;
  try {
    if (navigator.share) await navigator.share({ title: "Angela Rayner's Vape Canoe", text: msg, url });
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
  const y = Math.round(view.H / 2 - 150);
  panel(20, y, W - 40, 300);
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
  if (button(40, y + 236, W - 80, 44, 'BACK', { scale: 3, inv: true })) G.mode = 'title';
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
  } else if (G.mode === 'title' || G.mode === 'shop' || G.mode === 'settings') idle(dt);
  else G.t += dt;

  if (G.bot) {      // headless balance runs
    if (G.mode === 'levelup') { const rank = { evo: 0, weapon: 1, passive: 2 }; let bi = 0; G.choices.forEach((c, i) => { if ((rank[c.kind] ?? 3) < (rank[G.choices[bi].kind] ?? 3)) bi = i; }); choose(Math.random() < 0.6 ? bi : (Math.random() * 3) | 0); }
    if (G.mode === 'dead') { (window.__runs = window.__runs || []).push({ ...G.result, cause: G.cause, t: G.t, weapons: { ...G.weapons }, evo: { ...G.evo } }); newRun(); G.bot = true; }
  }

  const onTitle = G.mode === 'title' || G.mode === 'settings' || (G.mode === 'shop' && backTo === 'title');
  musicFrame(!openerFinished() ? MUSIC.OPENER : onTitle ? 'menu' : MUSIC.BIOME_TRACKS[G.biomeIdx || 0], G.mode !== 'play' && G.mode !== 'title');
  const menu = G.mode === 'title' || G.mode === 'settings' || (G.mode === 'shop');
  drawWorld(menu ? 'menu' : 'full');
  if (!menu) drawHud();
  if (G.mode === 'title') titleScreen();
  else if (G.mode === 'levelup') levelUpScreen();
  else if (G.mode === 'dead') deadScreen();
  else if (G.mode === 'shop') shopScreen();
  else if (G.mode === 'settings') settingsScreen();
  else if (G.mode === 'pause') pauseScreen();
  if (toastT > 0) { toastT -= dt; const tw = textW(toast, 2) + 20; rect(W / 2 - tw / 2, view.H - 96, tw, 22, FG); text(toast, W / 2, view.H - 90, 2, BG, 0.5); }

  input.taps.length = 0; input.pause = false;
}

function boot() {
  loadSave(); resize(); buildSprites(); initInput(); preloadMusic();
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G.mode === 'play' && !G.dead && !G.bot) G.mode = 'pause';
    const a = getAC(); if (a) { if (document.hidden) a.suspend(); else a.resume(); } });
  window.addEventListener('keydown', (e) => {
    if (G.mode === 'levelup' && modeT > 0.3 && '123'.includes(e.key)) choose(+e.key - 1);
    if ((e.key === 'Enter' || e.key === ' ') && modeT > 0.3 && (G.mode === 'title' || G.mode === 'dead')) newRun();
  });
  newRun(); G.mode = 'title'; G.banner = ''; G.inv = 0;
  if (params.get('bot')) { newRun(); G.bot = true; G.god = !!params.get('god'); G.hits = G.crashes = 0; }
  window.__vc = { musicState, G, save, newRun, enemies, clouds, vapes, SPR, face };
  requestAnimationFrame(frame);
}
boot();
