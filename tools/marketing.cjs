// Builds the itch.io kit in marketing/: gameplay screenshots (720x1280) and store images
// composed from the key art in marketing/art with the game's own pixel lettering.
// Usage: node tools/marketing.cjs
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'marketing');
(async () => {
  const srv = http.createServer((q, s) => {
    const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : f.endsWith('.mp3') ? 'audio/mpeg' : 'text/plain' }); s.end(d); } });
  }).listen(0);
  const base = 'http://localhost:' + srv.address().port;
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 2 });
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.addInitScript(() => localStorage.setItem('vapekayak.v1', JSON.stringify({ sound: false, best: 1287, bestDist: 2140, cash: 96, runs: 9, shop: { engine: 1 } })));
  const shot = (n) => pg.screenshot({ path: path.join(out, 'screenshots', n + '.png') });

  await pg.goto(base); await pg.waitForTimeout(900); await shot('1-title');
  await pg.mouse.click(180, 295); await pg.waitForTimeout(400);
  await pg.evaluate(() => { const G = __vc.G; G.bot = true; G.god = true; __vc.save.runs = 9; });
  await pg.waitForTimeout(9000); await shot('2-early-run');
  await pg.evaluate(() => __vc.setFast(20));
  for (let i = 0; i < 400; i++) { await pg.waitForTimeout(250); if (await pg.evaluate(() => __vc.G.dist / 20 > 2500 && Object.keys(__vc.G.evo).length >= 2)) break; }
  await pg.evaluate(() => __vc.setFast(1)); await pg.waitForTimeout(2500); await shot('4-horde');
  const horde = (await pg.screenshot()).toString('base64');
  await pg.evaluate(() => { __vc.G.xp = __vc.G.xpNeed; }); await pg.waitForTimeout(900); await shot('3-level-up');
  await pg.evaluate(() => { const G = __vc.G; G.bot = false; G.pending = 0; G.choices = null; G.mode = 'play'; G.xp = 0; G.god = false; G.inv = 0; G.hp = 1; });
  for (let i = 0; i < 200; i++) { await pg.waitForTimeout(300); if (await pg.evaluate(() => __vc.G.mode === 'dead')) break; }
  await pg.waitForTimeout(600); await shot('5-game-over');
  await pg.mouse.click(100, 470); await pg.waitForTimeout(600); await shot('6-shop');

  // ---- store images ---------------------------------------------------------
  const art = (f) => 'data:image/jpeg;base64,' + fs.readFileSync(path.join(out, 'art', f)).toString('base64');
  const jobs = [
    { name: 'itch-cover-630x500', w: 630, h: 500, src: 'cloud', crop: [190, 0, 1391, 1104], lock: { cx: 315, bottom: 486, s: 10 } },
    { name: 'itch-banner-960x300', w: 960, h: 300, src: 'cloud', crop: [0, 170, 1792, 560], lock: { cx: 205, bottom: 284, s: 8 } },
    { name: 'social-1200x630', w: 1200, h: 630, src: 'cloud', crop: [0, 80, 1792, 941], lock: { cx: 300, bottom: 606, s: 12 }, tag: 'PLAY FREE IN YOUR BROWSER' },
    { name: 'square-1080', w: 1080, h: 1080, src: 'portrait', crop: [344, 0, 1104, 1104], lock: { cx: 540, bottom: 1050, s: 20 }, tag: 'PADDLE. VAPE. MELT THE HORDE.' },
    { name: 'story-1080x1920', w: 1080, h: 1920, src: 'cloud', crop: [230, 0, 1325, 1104], artH: 900, lock: { cx: 540, bottom: 1075, s: 20 }, game: true, tag: 'PLAY FREE IN YOUR BROWSER' },
  ];
  const imgs = { cloud: art('key-art-vape-cloud.jpg'), portrait: art('key-art-portrait.jpg'), horde: 'data:image/png;base64,' + horde };
  const results = await pg.evaluate(async ({ jobs, imgs }) => {
    const load = (u) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = u; });
    const I = {}; for (const k in imgs) I[k] = await load(imgs[k]);
    const T = __vc.text, outp = {};
    for (const j of jobs) {
      const c = document.createElement('canvas'); c.width = j.w; c.height = j.h; const g = c.getContext('2d');
      g.fillStyle = '#000'; g.fillRect(0, 0, j.w, j.h);
      g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
      g.drawImage(I[j.src], ...j.crop, 0, 0, j.w, j.artH || j.h);
      g.imageSmoothingEnabled = false;
      if (j.game) { const gh = j.h - j.artH; g.drawImage(I.horde, 0, 330, 720, gh / 1.5, 0, j.artH, 1080, gh); g.fillStyle = '#fff'; g.fillRect(0, j.artH - 4, j.w, 8); }
      // title lockup in a game-style panel
      const s = j.lock.s, s2 = Math.max(2, Math.round(s * 0.45)), s3 = Math.max(2, Math.round(s * 0.3)), pad = Math.round(s * 1.6);
      const wBig = 10 * 4 * s - s, hTag = j.tag ? s3 * 5 + pad * 0.6 : 0;
      const pw = Math.max(wBig, j.tag ? j.tag.length * 4 * s3 : 0) + pad * 2, ph = s2 * 5 + s * 5 + pad * 2.6 + hTag;
      const px = Math.round(j.lock.cx - pw / 2), py = Math.round(j.lock.bottom - ph), bw = Math.max(2, Math.round(s / 3));
      g.fillStyle = '#fff'; g.fillRect(px - bw, py - bw, pw + bw * 2, ph + bw * 2);
      g.fillStyle = '#000'; g.fillRect(px, py, pw, ph);
      T("ANGELA RAYNER'S:", j.lock.cx, py + pad, s2, '#ff5a1f', 0.5, g);
      T('VAPE KAYAK', j.lock.cx, py + pad * 1.6 + s2 * 5, s, '#ffffff', 0.5, g);
      if (j.tag) T(j.tag, j.lock.cx, py + pad * 2.2 + s2 * 5 + s * 5, s3, '#a9d6f5', 0.5, g);
      outp[j.name] = c.toDataURL('image/png').split(',')[1];
    }
    return outp;
  }, { jobs, imgs });
  for (const k in results) fs.writeFileSync(path.join(out, k + '.png'), Buffer.from(results[k], 'base64'));
  fs.copyFileSync(path.join(out, 'social-1200x630.png'), path.join(root, 'og.png'));
  // icon with the renamed boat
  const icon = await pg.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
    const s = __vc.SPR.kayak[0], k = 10; g.drawImage(s, 256 - s.width * k / 2, 256 - s.height * k / 2, s.width * k, s.height * k);
    const v = __vc.SPR.bigVape[2]; g.drawImage(v, 30, 40, v.width * 6, v.height * 6); g.drawImage(__vc.SPR.bigVape[13], 340, 330, v.width * 6, v.height * 6);
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(path.join(root, 'icon.png'), Buffer.from(icon, 'base64'));
  console.log('done', Object.keys(results), 'errors:', errs);
  await b.close(); srv.close();
})();
