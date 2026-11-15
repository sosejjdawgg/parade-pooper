// Records the YouTube Shorts trailer from the real browser game, frame by frame.
// The game's clock is driven manually (fake requestAnimationFrame), so capture is
// deterministic and never drops frames. Captions use the game's own pixel font.
//   node tools/trailer.cjs <framesDir>     then encode with ffmpeg (see marketing/trailer/README.md)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = process.argv[2];
const b64 = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(root, 'marketing', 'art', f)).toString('base64');
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 360, height: 640 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.addInitScript(() => {
    localStorage.setItem('vapekayak.v1', JSON.stringify({ sound: false, runs: 9, seenIntro: true, best: 2890, bestDist: 2100, cash: 0, shop: { engine: 1, turbo: 3 } }));
    let cb = null, t = 0;
    window.requestAnimationFrame = (f) => { cb = f; return 1; };
    window.__step = (n) => { for (let i = 0; i < n; i++) { const f = cb; t += 1000 / 60; if (f) f(t); } };
  });
  await pg.goto('file://' + path.join(root, 'vape-kayak.html'));
  await pg.waitForTimeout(500);
  await pg.evaluate(async ({ cloud, portrait }) => {
    const load = (u) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = u; });
    const img = { cloud: await load(cloud), portrait: await load(portrait) };
    const cv = document.getElementById('game'), g = cv.getContext('2d'), T = __vc.text, W = 360, H = 640;
    const O = window.__ov = {};
    O.art = (name, cx, zoom) => {                       // key art, cover-fit, low-res like the game
      const im = img[name], sw = im.height * 9 / 16 / zoom, sh = im.height / zoom;
      g.imageSmoothingEnabled = true; g.drawImage(im, cx - sw / 2, (im.height - sh) / 2, sw, sh, 0, 0, W, H); g.imageSmoothingEnabled = false;
    };
    O.cap = (lines, y, s, inv) => {                      // caption panel in the game's style
      const w = Math.max(...lines.map((l) => l.length * 4 * s - s)) + 20, h = lines.length * (5 * s + 6) + 12, x = (W - w) >> 1;
      g.fillStyle = '#fff'; g.fillRect(x - 3, y - 3, w + 6, h + 6);
      g.fillStyle = inv ? '#fff' : '#000'; g.fillRect(x, y, w, h);
      lines.forEach((l, i) => T(l, W / 2, y + 9 + i * (5 * s + 6), s, inv ? '#000' : i === 0 && lines.length > 1 ? '#ff5a1f' : '#fff', 0.5, g));
    };
    O.lockup = (y) => {
      g.fillStyle = '#fff'; g.fillRect(19, y - 3, 322, 100); g.fillStyle = '#000'; g.fillRect(22, y, 316, 94);
      T("ANGELA RAYNER'S:", W / 2, y + 12, 3, '#ff5a1f', 0.5, g); T('VAPE KAYAK', W / 2, y + 40, 7, '#fff', 0.5, g);
    };
    O.flash = () => { g.fillStyle = '#fff'; for (let yy = 0; yy < H; yy += 2) g.fillRect(0, yy, W, 1); for (let xx = 0; xx < W; xx += 2) g.fillRect(xx, 0, 1, H); };
    O.small = (s, y) => { for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) T(s, W / 2 + dx, y + dy, 1, '#000', 0.5, g); T(s, W / 2, y, 1, '#fff', 0.5, g); };
    window.__grab = (n, code) => { __step(n); if (code) new Function('O', 'f', code)(O, 0); return cv.toDataURL('image/png').split(',')[1]; };
  }, { cloud: b64('key-art-vape-cloud.jpg'), portrait: b64('key-art-portrait.jpg') });

  let n = 0;
  const grab = async (code, steps = 2) => { const d = await pg.evaluate(([s, c]) => __grab(s, c), [steps, code || '']); fs.writeFileSync(path.join(out, `f_${String(n++).padStart(5, '0')}.png`), Buffer.from(d, 'base64')); };
  const step = (k) => pg.evaluate((k) => __step(k), k);
  const ev = (fn, arg) => pg.evaluate(fn, arg);
  const mode = () => ev(() => __vc.G.mode);
  const mark = (name) => console.log(name.padEnd(12), 'starts at frame', n, '=', (n / 30).toFixed(1) + 's');

  // 1 ---- cold open: key art, title slams in
  mark('open');
  await step(30);
  for (let f = 0; f < 78; f++) await grab(`O.art('cloud', ${820 + f * 0.5}, ${1 + f * 0.0016});` + (f < 3 ? 'O.flash();' : '') + (f >= 24 ? `O.lockup(${f < 28 ? 470 - (f - 24) * 14 : 418});` : '') + (f >= 24 && f < 27 ? 'O.flash();' : ''));

  // 2 ---- collect the vapes
  mark('collect');
  await pg.mouse.click(180, 300); await step(4);
  await ev(() => { __vc.G.bot = true; __vc.G.god = true; });
  await step(300);
  for (let f = 0; f < 100; f++) await grab((f < 3 ? 'O.flash();' : '') + (f < 84 ? `O.cap(['HELP ANGIE', 'COLLECT THE VAPES!'], ${f < 6 ? 30 + (6 - f) * 6 : 30}, 4);` : ''));

  // 3 ---- level up
  mark('levelup');
  await ev(() => { const G = __vc.G; G.bot = false; G.xp = G.xpNeed; });
  for (let f = 0; f < 52; f++) { if (f === 40) await pg.mouse.click(180, 215); await grab((f < 3 ? 'O.flash();' : '') + (f > 8 && f < 44 ? "O.cap(['PICK A POWER'], 560, 4, true);" : '') + (f >= 41 && f < 44 ? 'O.flash();' : '')); }
  if (await mode() !== 'play') { await ev(() => { __vc.G.bot = true; }); await step(40); }

  // 4 ---- upgrades montage
  mark('upgrades');
  const jump = (m) => ev((m) => { const G = __vc.G; G.dist = m * 20; G.genY = G.dist + 300; G.bot = true; }, m);
  await ev(() => { const G = __vc.G; G.weapons.cloud = 4; G.passives.rings = 3; });
  await jump(820); await step(300);
  for (const [name, add] of [['VAPE RINGS', ''], ['VAPE STORM', 'storm'], ['BIG VAPE CLOUDS', 'nova']]) {
    if (add) await ev((a) => { const G = __vc.G; G.weapons[a] = a === 'storm' ? 4 : 3; if (a === 'nova') G.cd.nova = 0.3; }, add);
    for (let f = 0; f < 42; f++) await grab((f < 3 ? 'O.flash();' : '') + `O.cap(['UPGRADE:', '${name}'], 30, 4);`);
  }

  // 5 ---- vape cloud chaos
  mark('chaos');
  await ev(() => { const G = __vc.G; G.weapons = { cloud: 6, trail: 5, nova: 5, storm: 5 }; G.evo = { cloud: true, storm: true, nova: true, trail: true }; G.passives = { rings: 5, extra: 3, lungs: 3, chain: 3, magnet: 3 }; G.level = 38; G.vapes = 3980; G.xp = G.xpNeed; });
  await step(50);                                           // bot takes a level-up, which recalculates the stats
  await jump(2350); await step(420);
  for (let f = 0; f < 200; f++) await grab((f < 3 ? 'O.flash();' : '') + (f < 46 && (f < 8 || (f >> 2) & 1) ? "O.cap(['VAPE CLOUD', 'CHAOS!!'], 220, 6, true);" : '') + (f >= 110 && f < 165 ? "O.cap(['MELT THE HORDE'], 30, 4);" : ''));

  // 6 ---- high score
  mark('score');
  await ev(() => {
    const { G, enemies } = __vc; G.bot = false; G.god = false; G.hp = 1; G.inv = 0; G.shieldT = 99; G.burst = 0;
    const e = enemies.items[enemies.n] || (enemies.items[enemies.n] = {}); enemies.n++;
    Object.assign(e, { dead: false, type: 'swan', x: G.px, wy: G.dist, hp: 9999, maxHp: 9999, r: 6, chasing: false, vx: 0, seed: 1, ox: 0, oy: 0, novaId: -1, flash: 0, puffs: 0, chaseT: 0, gaveUp: false, ang: 0 });
  });
  for (let f = 0; f < 150; f++) {
    if (f === 20) await ev(() => { const r = __vc.G.result; if (r) { r.title = 'RESIGNED!'; r.tip = 'ALWAYS CHECK WHICH HOME IS YOUR MAIN HOME.'; } });
    await grab((f < 2 ? 'O.flash();' : '') + (f > 70 ? "O.cap(['CAN YOU BEAT IT?'], 24, 4, true);" : ''));
  }

  // 7 ---- call to action
  mark('cta');
  for (let f = 0; f < 120; f++) await grab(`O.art('portrait', 900, ${1.05 + f * 0.001});` + (f < 3 ? 'O.flash();' : '') + 'O.lockup(330);' +
    `O.cap(['PLAY FREE NOW'], 446, 5, ${(f >> 3) & 1 ? 'true' : 'false'});` + "O.cap(['IN YOUR BROWSER', 'LINK BELOW'], 504, 3);" +
    "O.small('A FREE, NON-COMMERCIAL PARODY. NOT AFFILIATED WITH ANYONE.', 618);O.small('MUSIC: RIDING A UFO BY HARAYU (CC-BY 3.0)', 628);");
  console.log('frames', n, '=', (n / 30).toFixed(1) + 's', 'errors', errs);
  await b.close();
})();
