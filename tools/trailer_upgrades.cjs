// "Upgrades" trailer: records the real browser game frame by frame (fake requestAnimationFrame, so
// capture is deterministic), staging each shot. Structure follows trailer theory:
//   hook (cute close-up) -> set-up (one puff, one duck) -> escalation (each upgrade card arrives faster,
//   rings fire on the beat) -> breath (music drops out before the evolution) -> climax (fully upgraded)
//   -> button (callback to the duck) -> title + call to action.
// Timed to "Arabian Dancer" (2.0 s bars, quiet intro, drop at 8.0 s).
//   node tools/trailer_upgrades.cjs <framesDir>   -> frames + events.json (sfx cue sheet), then tools/trailer_upgrades_mix.sh
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const b64 = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'marketing', 'art', f)).toString('base64');
const FPS = 30, sec = (s) => Math.round(s * FPS);

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 360, height: 640 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.addInitScript(() => {
    localStorage.setItem('vapekayak.v1', JSON.stringify({ sound: false, runs: 9, seenIntro: true, best: 4210, bestDist: 2450, cash: 0, shop: {} }));
    let cb = null, t = 0;
    window.requestAnimationFrame = (f) => { cb = f; return 1; };
    window.__step = (n) => { for (let i = 0; i < n; i++) { if (window.__hook) window.__hook(); const f = cb; t += 1000 / 60; if (f) f(t); } };
  });
  await pg.goto('file://' + path.join(root, 'vape-kayak.html'));
  await pg.waitForTimeout(500);
  await pg.evaluate(async ({ portrait }) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const img = { portrait: await load(portrait) };
    const cv = document.getElementById('game'), g = cv.getContext('2d'), T = __vc.text, W = 360, H = 640;
    const off = document.createElement('canvas'); off.width = W; off.height = H; const og = off.getContext('2d');
    const { G, enemies } = __vc;
    const O = window.__ov = {};
    // ---- camera: re-frame the finished game frame (nearest-neighbour, so pixels stay crisp)
    O.zoom = (cx, cy, z) => {
      if (z <= 1.001) return;
      og.drawImage(cv, 0, 0); const sw = W / z, sh = H / z;
      const sx = Math.max(0, Math.min(W - sw, cx - sw / 2)), sy = Math.max(0, Math.min(H - sh, cy - sh / 2));
      g.imageSmoothingEnabled = false; g.drawImage(off, sx, sy, sw, sh, 0, 0, W, H);
    };
    O.kayak = () => [G.px, Math.round(H * 0.68)];
    O.art = (name, cx, zoom) => {
      const im = img[name], sw = im.height * 9 / 16 / zoom, sh = im.height / zoom;
      g.imageSmoothingEnabled = true; g.drawImage(im, cx - sw / 2, (im.height - sh) / 2, sw, sh, 0, 0, W, H); g.imageSmoothingEnabled = false;
    };
    O.cap = (lines, y, s, inv, col) => {
      const w = Math.max(...lines.map((l) => l.length * 4 * s - s)) + 20, h = lines.length * (5 * s + 6) + 12, x = (W - w) >> 1;
      g.fillStyle = '#fff'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = inv ? '#fff' : '#000'; g.fillRect(x, y, w, h);
      lines.forEach((l, i) => T(l, W / 2, y + 9 + i * (5 * s + 6), s, inv ? '#000' : col && i === 0 ? col : '#fff', 0.5, g));
    };
    O.flash = () => { g.fillStyle = '#fff'; for (let yy = 0; yy < H; yy += 2) g.fillRect(0, yy, W, 1); for (let xx = 0; xx < W; xx += 2) g.fillRect(xx, 0, 1, H); };
    O.white = () => { g.fillStyle = '#fff'; g.fillRect(0, 0, W, H); };
    O.black = () => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); };
    O.pick = (i, on) => {                                  // blinking selection box round a level-up card
      if (!on) return; const y = 160 + i * 124;
      g.fillStyle = '#ff5a1f'; g.fillRect(12, y - 8, 336, 4); g.fillRect(12, y + 116, 336, 4); g.fillRect(12, y - 8, 4, 128); g.fillRect(344, y - 8, 4, 128);
    };
    O.card = (title, sub, s) => {                           // full-screen upgrade title card, Vampire-Survivors style
      O.black(); T(sub, W / 2, 250, 3, '#ff5a1f', 0.5, g);
      T(title, W / 2, 290, s || 6, '#fff', 0.5, g);
    };
    O.lockup = (y) => {
      g.fillStyle = '#fff'; g.fillRect(19, y - 3, 322, 100); g.fillStyle = '#000'; g.fillRect(22, y, 316, 94);
      T("ANGELA RAYNER'S:", W / 2, y + 12, 3, '#ff5a1f', 0.5, g); T('VAPE KAYAK', W / 2, y + 40, 7, '#fff', 0.5, g);
    };
    O.small = (s, y) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) T(s, W / 2 + dx, y + dy, 1, '#000', 0.5, g); T(s, W / 2, y, 1, '#fff', 0.5, g); };
    // ---- staging helpers
    O.duck = (dx, dy, type) => {
      const e = enemies.spawn(); if (!e) return null;
      Object.assign(e, { dead: false, type: type || 'swan', x: G.px + dx, wy: G.dist + dy, hp: 6, maxHp: 6, r: 6, chasing: false, vx: 0, seed: Math.random() * 100,
        ox: 0, oy: 0, novaId: -1, flash: 0, puffs: 0, chaseT: 0, gaveUp: false, ang: 0 });
      return e;
    };
    O.flock = (cx, dy, n, spread) => { for (let i = 0; i < n; i++) { const a = i / n * 6.28; O.duck(cx + Math.cos(a) * spread * (i % 2 ? 1 : 0.55), dy + Math.sin(a) * spread * 0.7); } };
    window.__grab = (n, code) => { __step(n); if (code) new Function('O', code)(O); return cv.toDataURL('image/png').split(',')[1]; };
  }, { portrait: b64('key-art-portrait.jpg') });

  let n = 0; const events = [];
  const ev = (fn, arg) => pg.evaluate(fn, arg);
  const cue = (name, vol = 1) => events.push({ t: +(n / FPS).toFixed(3), name, vol });
  let lastKills = 0, killCue = true;
  const grab = async (code, steps = 2) => {
    const d = await pg.evaluate(([s, c]) => __grab(s, c), [steps, code || '']);
    fs.writeFileSync(path.join(out, `f_${String(n++).padStart(5, '0')}.png`), Buffer.from(d, 'base64'));
    const k = await ev(() => __vc.G.kills);
    if (k > lastKills && killCue) cue('kill', 0.7);
    lastKills = k;
  };
  const mark = (name) => console.log(name.padEnd(12), 'frame', n, '=', (n / FPS).toFixed(2) + 's');
  const until = async (t, fn) => { while (n < sec(t)) await fn(n - sec(t)); };
  // per-frame hook: steady-cam on the canal centre, no random spawns or chunks, ring cooldown under our control
  const hook = (opts) => ev((o) => {
    const { G } = __vc;
    window.__opts = o;
    window.__hook = () => {
      const o = window.__opts;
      if (G.mode !== 'play') return;
      if (o.noSpawn) G.spawnT = -1e9;
      if (o.steady) { G.bot = false; G.pvx = 0; G.px += (__vc.centreAt(G.dist) - G.px) * 0.08; }
      if (o.noCloud) G.cd.cloud = 99;
      if (o.ringLock) { if (window.__pulse) { G.cd.rings = 0; window.__pulse = false; } else G.cd.rings = Math.max(G.cd.rings, 1); }
    };
  }, opts);
  const pulse = () => ev(() => { window.__pulse = true; });
  // a level-up screen with our three cards; `pickAt` frames in, card `which` is taken
  const levelUp = async (cards, which, frames, pickAt, title, sub, cardFrames) => {
    await ev((c) => { const G = __vc.G; G.level++; G.pending = 1; G.xp = 0; }, cards);
    await ev(() => __step(1));
    await ev((c) => { __vc.G.choices = c; }, cards);
    cue('level', 0.8);
    for (let f = 0; f < frames; f++) {
      if (f === pickAt) { await ev((k) => window.dispatchEvent(new KeyboardEvent('keydown', { key: String(k + 1) })), which); cue('pick'); }
      if (f < pickAt) await grab(`O.pick(${which}, ${f >= pickAt - 12 ? ((f >> 1) & 1) : 0});`, 2);
      else if (f < pickAt + 2) await grab('O.white();', 0);
      else await grab(`O.card(${JSON.stringify(title)}, ${JSON.stringify(sub)}, ${cardFrames || 6});`, 0);
    }
  };
  const P = {
    rings: { kind: 'passive', id: 'rings', title: 'VAPE RINGS', desc: 'BLOWS LARGE GROWING HOOPS THAT CUT THROUGH ENEMIES' },
    extra: { kind: 'passive', id: 'extra', title: '+1 CLOUD', desc: '+1 CLOUD FOR EVERY WEAPON EXCEPT VAPETRAIL' },
    lungs: { kind: 'passive', id: 'lungs', title: 'BIGGER VAPE BATTERY', desc: '+20% SIZE FOR EVERY CLOUD, RING AND TRAIL' },
    paddle: { kind: 'passive', id: 'paddle', title: 'BIG PADDLE', desc: '+12% STEERING', tag: 'NEW' },
    hivis: { kind: 'passive', id: 'hivis', title: 'HI-VIS VEST', desc: '+34% MAX HEALTH AND A FULL HEAL', tag: 'NEW' },
    chain: { kind: 'passive', id: 'chain', title: 'CHAIN VAPER', desc: '-8% COOLDOWNS', tag: 'LV 2' },
    cloud2: { kind: 'weapon', id: 'cloud', title: 'VAPE CLOUD', desc: 'MORE DAMAGE, FASTER', tag: 'LV 2' },
    trail: { kind: 'weapon', id: 'trail', title: 'VAPETRAIL', desc: 'HURTS ENEMIES', tag: 'NEW' },
    storm: { kind: 'weapon', id: 'storm', title: 'VAPE STORM', desc: 'CLOUDS ORBIT THE KAYAK AND POP ON ENEMIES', tag: 'NEW' },
    nova: { kind: 'evo', id: 'nova', title: 'MUSHROOM CLOUD', desc: 'CLEARS THE WHOLE SCREEN.', tag: 'EVOLUTION' },
  };
  const tag = (o, t) => ({ ...o, tag: t });

  // ===== A. HOOK + SET-UP (0-8 s, quiet intro): a quiet day, one puff, one duck =================
  mark('A cute');
  await ev(() => {
    const { G } = __vc; __vc.newRun(); G.bot = false; G.god = true; G.genY = 1e9; G.spawnT = -1e9; G.inv = 0; G.banner = ''; G.bannerT = 0;
  });
  await hook({ noSpawn: true, steady: true, noCloud: true });
  await ev(() => __step(20));
  let duck = false;
  await until(2.0, async () => grab("O.zoom(O.kayak()[0], O.kayak()[1] - 20, 1.9); O.cap(['A QUIET DAY', 'ON THE CANAL'], 40, 4);"));
  await ev(() => { window.__duck = __ov.duck(0, 330); });
  // the duck drifts in; camera eases from the kayak to frame both
  await until(4.0, async (f) => {
    const k = 1 + f / sec(2);       // 0 -> 1
    await ev(() => { const d = window.__duck, G = __vc.G; if (d && !d.dead) { d.x += (G.px - d.x) * 0.1; } });
    await grab(`O.zoom(O.kayak()[0], O.kayak()[1] - ${Math.round(70 * k)}, ${(1.9 - 0.2 * k).toFixed(3)}); O.cap(['ONE VAPE.'], 40, 5);`);
  });
  // slow motion: the puff
  await hook({ noSpawn: true, steady: true, noCloud: false });
  await ev(() => { __vc.G.cd.cloud = 0; });
  cue('puff', 1);
  let killed = -1;
  await until(6.0, async (f) => {
    const dead = await ev(() => !window.__duck || window.__duck.dead);
    if (dead && killed < 0) killed = n;
    const cap = killed < 0 ? "O.cap(['PUFF.'], 40, 5);" : "O.cap(['BYE BYE,', 'DUCK.'], 40, 5);";
    await grab(`O.zoom(O.kayak()[0], O.kayak()[1] - 70, 1.8);` + cap, 1);
  });
  // level up: VAPE RINGS
  mark('A levelup');
  await levelUp([P.paddle, tag(P.rings, 'NEW'), P.cloud2], 1, sec(2.0), sec(1.55), 'VAPE RINGS', 'NEW POWER', 6);

  // ===== B. ESCALATION (8-22 s, the drop): each card comes faster, rings fire on the beat ==========
  mark('B rings');
  await hook({ noSpawn: true, steady: true, noCloud: true, ringLock: true });
  const wave = (cx, dy, nn, spread) => ev(([cx, dy, nn, spread]) => __ov.flock(cx, dy, nn, spread), [cx, dy, nn, spread]);
  await wave(0, 150, 6, 26);
  await until(12.0, async (f) => {
    const t = (n / FPS);
    if (Math.abs(t - 8.3) < 0.02) { await pulse(); cue('puff'); }
    if (Math.abs(t - 9.9) < 0.02) await wave(0, 170, 7, 30);
    if (Math.abs(t - 10.3) < 0.02) { await pulse(); cue('puff'); }
    await grab((f < -sec(4) + 3 ? 'O.flash();' : '') + (f < -sec(1.2) ? "O.cap(['VAPE RINGS', 'CUT THROUGH ANYTHING'], 40, 4, false, '#ff5a1f');" : ''));
  });
  mark('B +1 cloud');
  await levelUp([P.hivis, P.chain, tag(P.extra, 'NEW')], 2, sec(1.0), sec(0.62), '+1 CLOUD', 'MORE RINGS', 7);
  await ev(() => { __vc.G.passives.extra = 1; });
  await until(16.0, async (f) => {
    const t = n / FPS;
    if (Math.abs(t - 13.1) < 0.02) { await wave(0, 150, 5, 22); await wave(-70, 135, 4, 16); await wave(70, 135, 4, 16); }
    if (Math.abs(t - 13.5) < 0.02) { await pulse(); cue('puff'); }
    if (Math.abs(t - 14.6) < 0.02) { await wave(0, 150, 5, 22); await wave(-70, 135, 4, 16); await wave(70, 135, 4, 16); }
    if (Math.abs(t - 15.0) < 0.02) { await pulse(); cue('puff'); }
    await grab((f < -sec(3) + 3 ? 'O.flash();' : '') + "O.cap(['+1 CLOUD', '= +1 RING'], 40, 4, false, '#ff5a1f');");
  });
  // the cards speed up: 0.5 s each from here
  const quick = async (cards, which, title, sub, pre) => { if (pre) await ev(pre); await levelUp(cards, which, sec(0.5), sec(0.36), title, sub, 6); };
  const montage = async (tEnd, caption, beat, waves) => {
    let nextBeat = n / FPS;
    await until(tEnd, async (f) => {
      const t = n / FPS;
      if (t >= nextBeat - 0.01) { if (waves) await waves(); await pulse(); cue('puff', 0.8); nextBeat += beat; }
      await grab((f < -sec(tEnd - t) - 0 && false ? '' : '') + `O.cap(${JSON.stringify(caption)}, 40, 4, false, '#ff5a1f');`);
    });
  };
  mark('B lv5');
  await quick([tag(P.rings, 'LV 5'), P.trail, P.storm], 0, 'VAPE RINGS', 'LEVEL 5', '() => { const G = __vc.G; G.passives.rings = 4; G.dist = 900 * 20; }');
  const sides = async () => { await wave(0, 160, 6, 30); await wave(-80, 140, 5, 20); await wave(80, 140, 5, 20); };
  await montage(18.0, ['VAPE RINGS', 'LEVEL 5'], 0.75, sides);
  mark('B +3');
  await quick([P.cloud2, tag(P.extra, 'LV 3'), P.hivis], 1, '+1 CLOUD', 'LEVEL 3', '() => { __vc.G.passives.extra = 2; }');
  await montage(20.0, ['+3 MINI RINGS'], 0.5, sides);
  mark('B battery');
  await quick([tag(P.lungs, 'LV 5'), P.paddle, P.chain], 0, 'BIGGER VAPE BATTERY', 'LEVEL 5', '() => { __vc.G.passives.lungs = 4; }');
  await ev(() => { const G = __vc.G; G.dist = 2350 * 20; G.weapons.nova = 5; });
  const horde = async () => { await wave(0, 180, 8, 40); await wave(-90, 150, 6, 26); await wave(90, 150, 6, 26); };
  await montage(22.0, ['BIGGER. FASTER.'], 0.25, horde);

  // ===== C. BREATH + EVOLUTION (22-26 s): the music drops out, then MUSHROOM CLOUD ==================
  mark('C evo');
  killCue = false;
  await ev(() => { __vc.enemies.n = 0; });
  await ev(() => { const G = __vc.G; G.level++; G.pending = 1; });
  await ev(() => __step(1));
  await ev((c) => { __vc.G.choices = c; }, [tag(P.extra, 'LV 3'), P.nova, P.hivis]);
  cue('level');
  for (let f = 0; f < sec(2.0); f++) {
    if (f === sec(1.9)) { await ev(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }))); cue('pick'); }
    const t = f / FPS;
    await grab(f >= sec(1.9) ? 'O.white();' : `O.pick(1, ${t > 0.7 ? ((f >> 1) & 1) : 0});` + (t > 1.0 ? "O.cap(['EVOLUTION'], 534, 5, true);" : ''), f >= sec(1.9) ? 0 : 2);
  }
  mark('C mushroom');
  killCue = true;
  await hook({ noSpawn: true, steady: true, noCloud: false, ringLock: false });
  await ev(() => { const G = __vc.G; for (let i = 0; i < 4; i++) { __ov.flock(-60 + i * 40, 120 + i * 30, 8, 40); } G.cd.nova = 0; G.passives.extra = 3; G.weapons.cloud = 6; G.evo.cloud = true; });
  cue('nova', 1); cue('big', 0.8);
  await until(26.0, async (f) => grab((f < -sec(2) + 3 ? 'O.flash();' : '') + "O.cap(['MUSHROOM', 'CLOUD'], 40, 5, false, '#ff5a1f');"));

  // ===== D. CLIMAX (26-32 s): everything fully upgraded, a horde in the volcano ===================
  mark('D climax');
  killCue = false;
  await ev(() => {
    const G = __vc.G;
    G.weapons = { cloud: 6, trail: 5, nova: 5, storm: 5 }; G.evo = { cloud: true, storm: true, nova: true, trail: true };
    G.passives = { rings: 5, extra: 3, lungs: 5, chain: 5, linger: 3, magnet: 3 }; G.level = 40; G.vapes = 4210;
    G.dist = 2400 * 20; G.genY = G.dist + 300; G.bot = true; G.god = true; G.spawnT = 0; G.xp = 0; G.pending = 0;
    // stats are recalculated on the next level-up; force one silently
  });
  await hook({ noSpawn: false, steady: false, noCloud: false, ringLock: true });
  await ev(() => __step(240));
  let nb = n / FPS;
  await until(32.0, async (f) => {
    const t = n / FPS;
    if (t >= nb - 0.01) { await pulse(); await ev(() => { for (let i = 0; i < 3; i++) __ov.flock(-90 + i * 90, 200, 5, 24); }); nb += 0.5; }
    let c = f < -sec(6) + 3 ? 'O.flash();' : '';
    if (f < -sec(6) + sec(1.6)) c += "O.cap(['FULLY UPGRADED', 'VAPE TECH'], 40, 4, true);";
    if (f > -sec(1.5)) c += "O.cap(['THIS IS FINE.'], 40, 4);";
    await grab(c);
  });

  // ===== E. BUTTON (32-35 s): silence. The duck again. Total overkill =============================
  mark('E button');
  await ev(() => {
    const { G, enemies, clouds } = __vc; enemies.n = 0; clouds.n = 0;
    G.dist = 120 * 20; G.genY = 1e9; G.bot = false; G.cd = { cloud: 99, trail: 0, nova: 99, rings: 99 };
    window.__arsenal = { w: G.weapons, e: G.evo, p: G.passives }; G.weapons = { cloud: 1 }; G.evo = {}; G.passives = {};
    window.__duck = __ov.duck(0, 230);
  });
  await hook({ noSpawn: true, steady: true, noCloud: true, ringLock: true });
  await until(33.4, async () => {
    await ev(() => { const d = window.__duck, G = __vc.G; if (d && !d.dead) d.x += (G.px - d.x) * 0.1; });
    await grab("O.zoom(O.kayak()[0], O.kayak()[1] - 60, 1.9); O.cap(['ONE MORE DUCK.'], 40, 4);");
  });
  await ev(() => { const G = __vc.G, a = window.__arsenal; G.weapons = a.w; G.evo = a.e; G.passives = a.p; window.__opts.noCloud = false; window.__pulse = true; G.cd.cloud = 0; G.cd.nova = 0; });
  cue('nova', 1); cue('puff', 1); cue('kill', 1);
  await until(35.0, async (f) => grab((f < -sec(1.6) + 3 ? 'O.flash();' : '') + "O.zoom(O.kayak()[0], O.kayak()[1] - 90, 1.6); O.cap(['SORRY, DUCK.'], 40, 5);"));

  // ===== F. TITLE + CALL TO ACTION (35-40 s) =======================================================
  mark('F cta');
  for (let f = 0; f < sec(5); f++) await grab(`O.art('portrait', 900, ${1.05 + f * 0.001});` + (f < 3 ? 'O.flash();' : '') + 'O.lockup(300);' +
    "O.cap(['UPGRADE YOUR', 'VAPE TECH'], 418, 4, false, '#ff5a1f');" +
    `O.cap(['PLAY FREE NOW'], 500, 4, ${(f >> 3) & 1 ? 'true' : 'false'});` +
    "O.small('A FREE, NON-COMMERCIAL PARODY. NOT AFFILIATED WITH ANYONE.', 616);O.small('MUSIC: ARABIAN DANCER BY HARAYU (CC-BY 3.0)', 627);", 0);

  fs.writeFileSync(path.join(out, 'events.json'), JSON.stringify(events));
  console.log('frames', n, '=', (n / FPS).toFixed(1) + 's', 'errors', errs);
  await b.close();
})();
