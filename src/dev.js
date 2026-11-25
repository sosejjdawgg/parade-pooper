// Developer options. Hidden: tap the version number on the title screen (or press ` on a keyboard) and enter
// DEV_CODE. Once unlocked it stays unlocked on this device, and the pause menu gets a DEV OPTIONS button.
// Everything here is for testing: cheats, teleports, spawners, build editing, save editing and debug overlays.
import { VERSION, DEV_CODE, WEAPONS, PASSIVES, EVOLUTIONS, SHOP, BIOMES, BANKS, SEA, ENEMIES, COLORS, VIEW } from './config.js';
import { view, text, textO, rect, box } from './gfx.js';
import {
  G, S, DEV, newRun, calcStats, addEnemy, addPickup, gainXp, hurt, devJump, devNextLight, devRing, devKill, orcaPod, gullFlock, fleet, devBoss, devFirstLight,
  enemies, clouds, vapes, hazards, metres, biomeAt,
} from './game.js';
import { save, writeSave, resetSave, sfx, nokia } from './platform.js';
import { bossDev } from './boss.js';

const { FG, BG, GINGER } = COLORS, W = VIEW.W;
const KEY = 'vapekayak.dev', PERSIST = ['unlocked', 'god', 'oneHit', 'noSpawn', 'noHazards', 'hitbox', 'info', 'speed', 'infDash', 'noWhales', 'noFleets', 'noGulls'];
export function loadDev() { try { Object.assign(DEV, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* private mode */ } }
function saveDev() { try { const o = {}; for (const k of PERSIST) o[k] = DEV[k]; localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* ignore */ } }

export const devState = { from: 'title', tab: 0, code: '', wipeArm: -9, sfxI: 0 };
/** open the developer menu (or the code pad if it's still locked) from the title or the pause menu */
export function openDev(from) { devState.from = from; devState.code = ''; G.mode = DEV.unlocked ? 'dev' : 'devcode'; }
const inRun = () => devState.from === 'pause';
/** actions that need a run start one (from the title) and leave you paused in it */
function ensureRun() { if (!inRun()) { newRun(); devState.from = 'pause'; } G.mode = 'dev'; }

// ---- code pad ----------------------------------------------------------------------------
export function devCodeScreen(ui) {
  ui.shade();
  const y = Math.round(view.H / 2 - 210);
  ui.panel(30, y, W - 60, 420);
  text('DEVELOPER', W / 2, y + 18, 4, FG, 0.5);
  text('ENTER CODE', W / 2, y + 48, 2, FG, 0.5);
  const shown = devState.code.padEnd(DEV_CODE.length, '-').split('').join(' ');
  rect(80, y + 66, W - 160, 40, BG); box(80, y + 66, W - 160, 40, FG, 2); text(shown, W / 2, y + 76, 4, GINGER, 0.5);
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'CLR', '0', 'OK'];
  keys.forEach((k, i) => {
    const bx = 60 + (i % 3) * 82, by = y + 120 + ((i / 3) | 0) * 56;
    if (!ui.button(bx, by, 74, 48, k, { scale: k.length > 1 ? 3 : 4, inv: k === 'OK' })) return;
    if (k === 'CLR') devState.code = '';
    else if (k === 'OK') check();
    else if (devState.code.length < DEV_CODE.length) { devState.code += k; if (devState.code.length === DEV_CODE.length) check(); }
  });
  if (ui.button(60, y + 352, W - 120, 40, 'BACK', { scale: 3 })) G.mode = devState.from;
  function check() {
    if (devState.code === DEV_CODE) { DEV.unlocked = true; saveDev(); sfx.level(); ui.say('DEVELOPER OPTIONS UNLOCKED'); G.mode = 'dev'; }
    else { sfx.no(); ui.say('WRONG CODE'); }
    devState.code = '';
  }
}

// ---- the menu ---------------------------------------------------------------------------
const TABS = ['RUN', 'BUILD', 'SPAWN', 'WORLD', 'SEA', 'BOSS', 'SAVE', 'DEBUG'];
const SPEEDS = [0.25, 0.5, 1, 2, 4, 8];
const SFX = ['vape', 'big', 'cash', 'puff', 'nova', 'kill', 'heal', 'hurt', 'level', 'pick', 'ui', 'no', 'buy', 'death'];

export function devScreen(ui) {
  const H = view.H;
  rect(0, 0, W, H, BG);
  text('DEV OPTIONS', 10, 10, 3, GINGER);
  text('V' + VERSION + (inRun() ? '  IN RUN ' + metres() + 'M' : '  NO RUN'), W - 10, 14, 1, FG, 1);
  TABS.forEach((t, i) => { if (ui.button(6 + (i % 4) * 87, 32 + ((i / 4) | 0) * 30, 84, 26, t, { inv: devState.tab === i })) devState.tab = i; });
  const top = 100, bottom = H - 50;
  rect(0, top - 6, W, 1, FG);

  // a two-column grid of buttons; toggles show inverted when on
  let n = 0;
  const cell = (label, fn, on, wide) => {
    if (wide && n % 2) n++;
    const col = n % 2, row = (n / 2) | 0, x = wide ? 6 : 6 + col * 177, w = wide ? W - 12 : 171, y = top + row * 34;
    n += wide ? 2 : 1;
    if (y + 30 > bottom) return;
    if (ui.button(x, y, w, 30, label, { inv: !!on })) fn();
  };
  const toggle = (label, k) => cell(label + (DEV[k] ? ': ON' : ': OFF'), () => { DEV[k] = !DEV[k]; saveDev(); }, DEV[k]);
  const act = (label, fn, msg) => cell(label, () => { fn(); if (msg) ui.say(msg); });
  const runAct = (label, fn, msg) => act(label, () => { ensureRun(); fn(); }, msg);

  const tab = TABS[devState.tab];
  if (tab === 'RUN') {
    toggle('GOD MODE', 'god'); toggle('ONE-HIT KILLS', 'oneHit');
    toggle('NO ENEMIES', 'noSpawn'); toggle('NO HAZARDS', 'noHazards');
    cell('GAME SPEED: X' + DEV.speed, () => { DEV.speed = SPEEDS[(SPEEDS.indexOf(DEV.speed) + 1) % SPEEDS.length]; saveDev(); }, DEV.speed !== 1);
    cell('AUTOPILOT: ' + (G.bot ? 'ON' : 'OFF'), () => { ensureRun(); G.bot = !G.bot; }, G.bot);
    runAct('HEAL FULL', () => { G.hp = G.maxHp; }, 'HEALED');
    runAct('TAKE A HIT', () => { G.inv = 0; G.mode = 'play'; hurt(1, 'dev'); G.mode = 'dev'; });
    runAct('+1 LEVEL', () => gainXp(G.xpNeed - G.xp + 0.01), 'LEVEL-UP QUEUED');
    runAct('+5 LEVELS', () => { for (let i = 0; i < 5; i++) gainXp(G.xpNeed - G.xp + 0.01); }, '5 LEVEL-UPS QUEUED');
    runAct('+100 VAPES', () => { G.vapes += 100; }, '+100 VAPES');
    runAct('+£100 RUN CASH', () => { G.cash += 100; }, '+£100');
    runAct('CLEAR ENEMIES', () => { enemies.n = 0; }, 'ENEMIES CLEARED');
    runAct('CLEAR HAZARDS', () => { hazards.n = 0; }, 'HAZARDS CLEARED');
    runAct('SHIELD READY', () => { G.shieldT = 0; });
    runAct('MAX BOOST', () => { G.burst = 200; });
    toggle('INFINITE DASH', 'infDash');
    runAct('DASH READY', () => { G.dashCd = 0; });
    act('NEW RUN', () => { newRun(); devState.from = 'pause'; G.mode = 'dev'; }, 'NEW RUN STARTED');
    act('DIE NOW', () => { ensureRun(); G.mode = 'play'; devKill(); }, null);
  } else if (tab === 'BUILD') {
    let y = top;
    const row = (name, lvl, max, minus, plus) => {
      text(name, 10, y + 7, 2); text(lvl + '/' + max, 238, y + 7, 2, lvl ? GINGER : FG, 1);
      if (ui.button(250, y, 50, 22, '-')) { ensureRun(); minus(); calcStats(); }
      if (ui.button(304, y, 50, 22, '+')) { ensureRun(); plus(); calcStats(); }
      y += 25;
    };
    for (const id in WEAPONS) row(WEAPONS[id].name, G.weapons?.[id] || 0, WEAPONS[id].maxLvl,
      () => { const l = (G.weapons[id] || 0) - 1; if (id === 'cloud' && l < 1) return; if (l > 0) G.weapons[id] = l; else delete G.weapons[id]; delete G.evo[id]; },
      () => { G.weapons[id] = Math.min(WEAPONS[id].maxLvl, (G.weapons[id] || 0) + 1); });
    for (const id in PASSIVES) row(PASSIVES[id].name, G.passives?.[id] || 0, PASSIVES[id].maxLvl,
      () => { const l = (G.passives[id] || 0) - 1; if (l > 0) G.passives[id] = l; else delete G.passives[id]; },
      () => { G.passives[id] = Math.min(PASSIVES[id].maxLvl, (G.passives[id] || 0) + 1); if (id === 'hivis') { calcStats(); G.hp = G.maxHp; } });
    let x = 6;
    for (const id in EVOLUTIONS) {
      const on = G.evo?.[id];
      if (ui.button(x, y + 2, 85, 24, EVOLUTIONS[id].name.split(' ')[0], { inv: on })) {
        ensureRun(); if (on) delete G.evo[id]; else { G.weapons[id] = WEAPONS[id].maxLvl; G.evo[id] = true; } calcStats();
      }
      x += 88;
    }
    y += 32;
    if (ui.button(6, y, 113, 26, 'MAX ALL')) { ensureRun(); for (const id in WEAPONS) G.weapons[id] = WEAPONS[id].maxLvl; for (const id in PASSIVES) G.passives[id] = PASSIVES[id].maxLvl; calcStats(); G.hp = G.maxHp; ui.say('EVERYTHING MAXED'); }
    if (ui.button(123, y, 113, 26, 'ALL EVOS')) { ensureRun(); for (const id in EVOLUTIONS) { G.weapons[id] = WEAPONS[id].maxLvl; G.evo[id] = true; } calcStats(); ui.say('ALL EVOLUTIONS'); }
    if (ui.button(240, y, 114, 26, 'CLEAR')) { ensureRun(); G.weapons = { cloud: 1 }; G.passives = {}; G.evo = {}; calcStats(); ui.say('BUILD CLEARED'); }
  } else if (tab === 'SPAWN') {
    for (const t in ENEMIES) if (t !== 'gull' && t !== 'cutter') runAct(t.toUpperCase() + ' X5', () => { for (let i = 0; i < 5; i++) addEnemy(t, G.px + (Math.random() - 0.5) * 120, G.dist + 220 + i * 24); });
    runAct('ORCA POD: SWEEP', () => orcaPod('sweep'), 'WHALES!'); runAct('ORCA POD: DIAGONAL', () => orcaPod('diag'), 'WHALES!');
    runAct('ORCA POD: CHARGE', () => orcaPod('charge'), 'WHALES!'); runAct('GULL FLOCK', () => gullFlock());
    runAct('HMRC FLEET', () => fleet(), 'FLEET!');
    runAct('SURROUND RING X16', () => devRing('swan', 16), 'RING INCOMING');
    runAct('PIRANHA RING X24', () => devRing('piranha', 24), 'RING INCOMING');
    runAct('SEA WAVE NOW', () => { G.waveT = 0; }, G.seaF > 0.5 ? 'WAVE!' : 'WAVES ONLY RUN AT SEA');
    runAct('10 BIG VAPES', () => { for (let i = 0; i < 10; i++) addPickup('big', G.px + (i % 5 - 2) * 18, G.dist + 140 + (i / 5 | 0) * 24); });
    runAct('CUP OF TEA', () => addPickup('tea', G.px, G.dist + 140));
    runAct('CASH BAG', () => addPickup('cash', G.px, G.dist + 140));
    runAct('NEXT LIGHTHOUSE', () => { if (!devNextLight()) ui.say('NO LIGHTHOUSE AHEAD: JUMP TO THE SEA'); });
  } else if (tab === 'WORLD') {
    const jumps = [['CANAL START', 0], ['DESERT', BIOMES.DESERT_AT + BIOMES.BLEND], ['RED BANKS', BANKS.DANGER_AT_M], ['VOLCANO', BIOMES.JUNGLE_AT + BIOMES.BLEND],
      ['SEA OPENING', BIOMES.SEA_AT - 40], ['OPEN SEA', BIOMES.SEA_AT + BIOMES.BLEND + 10]];
    for (const [name, m] of jumps) runAct(name + ' ' + Math.round(m) + 'M', () => devJump(m), 'JUMPED TO ' + Math.round(m) + 'M');
    runAct('+100M', () => devJump(metres() + 100)); runAct('+500M', () => devJump(metres() + 500));
    runAct('BACK 100M', () => devJump(Math.max(0, metres() - 100)));
    runAct('SEA: +5 MIN', () => { G.seaT += 300; }, 'SEA CLOCK +5 MIN (TOUGHER ENEMIES)');
    runAct('+1 LIGHTHOUSE', () => { G.lighthouses++; calcStats(); }, 'DAMAGE X' + (1 + ((G.lighthouses || 0) + 1) * SEA.LIGHT_DMG).toFixed(1));
    runAct('RESET LIGHTHOUSES', () => { G.lighthouses = 0; calcStats(); });
  } else if (tab === 'SEA') {
    runAct('FIRST LIGHTHOUSE', () => devFirstLight(), "PADDLE IN: SNAKE'S LIGHTHOUSE");
    runAct('OPEN SEA', () => devJump(BIOMES.SEA_AT + BIOMES.BLEND + 10), 'OPEN SEA');
    runAct('NEXT LIGHTHOUSE', () => { if (!devNextLight()) ui.say('NO LIGHTHOUSE AHEAD'); });
    runAct('SEA WAVE NOW', () => { G.waveT = 0; });
    runAct('WHALES NOW', () => { G.orcaT = 0; }); runAct('FLEET NOW', () => fleet());
    runAct('GULLS NOW', () => gullFlock()); runAct('CLEAR SHELLS', () => { G.shots = []; });
    toggle('NO WHALES', 'noWhales'); toggle('NO FLEETS', 'noFleets');
    toggle('NO GULLS', 'noGulls');
    runAct('SEA CLOCK +60S', () => { G.seaT += 60; }, 'SEA CLOCK +60S (TOUGHER)');
    runAct('SEA CLOCK RESET', () => { G.seaT = 0; G.wave = 0; });
  } else if (tab === 'BOSS') {
    const has = !!G.boss;
    runAct(has ? 'BOSS RUNNING' : 'START SNAKE', () => { if (!G.boss) devBoss(); }, has ? null : 'SNAKE!');
    runAct('SKIP INTRO', () => bossDev.skipIntro());
    runAct('HIT HIM (-1 LIFE)', () => bossDev.hit());
    runAct('WIN NOW', () => bossDev.win());
    runAct('PHASE 1: CALM', () => bossDev.phase(0)); runAct('PHASE 2: ANGRY', () => bossDev.phase(1));
    runAct('PHASE 3: WALLS DOWN', () => bossDev.phase(2)); runAct('SMASH WALLS', () => bossDev.smash());
    runAct('+5 TAIL KAYAKS', () => bossDev.tail(5)); runAct('-5 TAIL KAYAKS', () => bossDev.tail(-5));
    runAct('SNAKE +5 LONG', () => bossDev.grow(5)); runAct('EGG SHOWER', () => bossDev.eggs());
    runAct((has && G.boss.frozen) ? 'UNFREEZE SNAKE' : 'FREEZE SNAKE', () => bossDev.freeze());
    runAct('LEAVE BOSS', () => bossDev.quit(), 'BOSS ABANDONED');
    runAct('TEST NOKIA SOUNDS', () => { const k = Object.keys(nokia); const n = k[devState.nk = ((devState.nk || 0) + 1) % k.length]; nokia[n](0); ui.say('NOKIA: ' + n.toUpperCase()); });
    text(bossDev.info(), 10, bottom - 14, 1, GINGER);
  } else if (tab === 'SAVE') {
    act('+£100 WALLET', () => { save.cash += 100; writeSave(); }, 'WALLET £' + (save.cash + 100));
    act('+£1000 WALLET', () => { save.cash += 1000; writeSave(); }, 'WALLET £' + (save.cash + 1000));
    act('MAX SHOP', () => { for (const it of SHOP) save.shop[it.id] = it.costs.length; writeSave(); }, 'SHOP MAXED');
    act('CLEAR SHOP', () => { save.shop = {}; writeSave(); }, 'SHOP CLEARED');
    act('RESET BEST', () => { save.best = 0; save.bestDist = 0; writeSave(); }, 'BEST RESET');
    act('SHOW INTRO AGAIN', () => { save.seenIntro = false; writeSave(); }, 'INTRO WILL SHOW');
    act('RUNS = 0 (TAP HINTS)', () => { save.runs = 0; writeSave(); }, 'FIRST-RUN HINTS BACK');
    act('SOUND: ' + (save.sound ? 'ON' : 'OFF'), () => { save.sound = !save.sound; writeSave(); });
    const armed = G.t - devState.wipeArm < 3;
    cell(armed ? 'TAP AGAIN TO WIPE' : 'WIPE SAVE', () => { if (armed) { resetSave(); devState.wipeArm = -9; ui.say('SAVE WIPED'); } else devState.wipeArm = G.t; }, armed);
    act('LOCK DEV MENU', () => { DEV.unlocked = false; saveDev(); G.mode = devState.from; }, 'DEV MENU LOCKED');
  } else if (tab === 'DEBUG') {
    toggle('STATS OVERLAY', 'info'); toggle('HITBOXES', 'hitbox');
    runAct('FORCE LEVEL-UP', () => { gainXp(G.xpNeed - G.xp + 0.01); G.mode = 'play'; }, null);
    act('RESULTS SCREEN', () => { ensureRun(); G.mode = 'play'; devKill(); }, null);
    act('TEST SOUND: ' + SFX[devState.sfxI].toUpperCase(), () => { const k = SFX[devState.sfxI]; if (k === 'vape') sfx.vape(3); else sfx[k](); devState.sfxI = (devState.sfxI + 1) % SFX.length; });
    act('HOW TO PLAY', () => { G.mode = 'intro'; });
    let y = top + 3 * 34 + 8;
    const line = (s) => { text(s, 10, y, 1); y += 11; };
    line('VERSION ' + VERSION + '   CANVAS ' + W + 'X' + view.H + '   DPR ' + (window.devicePixelRatio || 1));
    line('FPS ' + Math.round(DEV.fps) + '   MODE FROM ' + devState.from.toUpperCase());
    line('URL: ?BOT=1 AUTOPLAY  &GOD=1  &FAST=N  (HEADLESS TESTS)');
    line('KEYS: ` DEV MENU   1-3 PICK CARD   ENTER PLAY/AGAIN');
    if (inRun()) {
      line('DIST ' + metres() + 'M  BIOME ' + biomeAt(G.dist).toFixed(2) + '  SEA ' + (G.seaF || 0).toFixed(2) + '  CAMX ' + Math.round(G.camX || 0));
      line('ENEMIES ' + enemies.n + '  CLOUDS ' + clouds.n + '  PICKUPS ' + vapes.n + '  HAZARDS ' + hazards.n);
      line('LV ' + G.level + '  XP ' + Math.round(G.xp) + '/' + G.xpNeed + '  HP ' + Math.round(G.hp) + '/' + G.maxHp + '  SPEED ' + Math.round(G.speed));
      line('DMG X' + S.dmg.toFixed(2) + '  AREA X' + S.area.toFixed(2) + '  CD X' + S.cd.toFixed(2) + '  DUR X' + S.dur.toFixed(2));
      line('WAVE ' + (G.wave || 0) + '  SEA TIME ' + Math.round(G.seaT || 0) + 'S  LIGHTHOUSES ' + (G.lighthouses || 0) + '  KILLS ' + G.kills);
      line('ROAM V ' + Math.round(G.mvx || 0) + ',' + Math.round(G.mvy || 0) + '  HEADING ' + Math.round((G.heading || 0) * 57.3) + '  ZOOM ' + (G.zoom || 1).toFixed(2) + '  DASH CD ' + (G.dashCd || 0).toFixed(1));
      line('PODS ' + (G.pods || []).length + '  SHELLS ' + (G.shots || []).length + '  NEXT: WAVE ' + Math.round(G.waveT || 0) + 'S WHALES ' + Math.round(G.orcaT || 0) + 'S FLEET ' + Math.round(G.fleetT || 0) + 'S');
      line('BOSS: ' + bossDev.info());
    }
  }
  const back = inRun() ? 'BACK TO RUN' : 'BACK TO TITLE';
  if (ui.button(6, H - 42, W - 12, 36, back, { scale: 3, inv: true })) G.mode = devState.from;
}

// ---- in-game overlays (drawn by render.js when switched on) -------------------------------
export function devOverlay() {
  if (!DEV.info) return;
  const lines = [
    'FPS ' + Math.round(DEV.fps) + '  ' + metres() + 'M  B' + biomeAt(G.dist).toFixed(2) + (G.seaF > 0 ? ' SEA' + G.seaF.toFixed(2) : ''),
    'EN ' + enemies.n + ' CL ' + clouds.n + ' PU ' + vapes.n + ' HZ ' + hazards.n,
    'DMG X' + S.dmg.toFixed(2) + ' SPD ' + Math.round(G.speed) + (G.wave ? ' WAVE ' + G.wave : '') + (G.lighthouses ? ' LH ' + G.lighthouses : ''),
    (G.boss ? bossDev.info() : G.seaF > 0.5 ? 'ZOOM ' + (G.zoom || 1).toFixed(2) + ' DASH ' + (G.dashCd || 0).toFixed(1) + ' PODS ' + G.pods.length + ' SHELLS ' + G.shots.length : ''),
    (DEV.god ? 'GOD ' : '') + (DEV.oneHit ? '1HIT ' : '') + (DEV.noSpawn ? 'NOSPAWN ' : '') + (DEV.noHazards ? 'NOHAZ ' : '') + (DEV.infDash ? 'INFDASH ' : '') + (DEV.noWhales ? 'NOWHALE ' : '') + (DEV.noFleets ? 'NOFLEET ' : '') + (DEV.speed !== 1 ? 'X' + DEV.speed : ''),
  ];
  rect(0, 0, 250, lines.length * 10 + 6, BG);
  lines.forEach((l, i) => textO(l, 4, 4 + i * 10, 1, i === lines.length - 1 ? GINGER : FG));
}
