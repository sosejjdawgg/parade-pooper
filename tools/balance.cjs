// Headless balance run: an invulnerable bot plays, we log the power curve.
// Usage: node tools/balance.cjs [seconds-of-game-time] [shop-json]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
(async () => {
  const srv = http.createServer((q, s) => {
    const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); s.end(d); } });
  }).listen(0);
  const base = 'http://localhost:' + srv.address().port, total = +process.argv[2] || 480, shop = process.argv[3] || '{}';
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 360, height: 780 } });
  pg.on('pageerror', (e) => console.log('ERR', String(e)));
  await pg.addInitScript((shop) => localStorage.setItem('vapekayak.v1', JSON.stringify({ shop: JSON.parse(shop), sound: false })), shop);
  await pg.goto(base + '/?bot=1&god=1&fast=20');
  let next = 30, lastHits = 0, lastKills = 0;
  for (;;) {
    await pg.waitForTimeout(250);
    const s = await pg.evaluate(() => { const { G, enemies, clouds } = __vc; return { t: G.t, m: (G.dist / 20) | 0, sp: G.speed | 0, lv: G.level, v: G.vapes, k: G.kills, en: enemies.n, cl: clouds.n, hits: G.hits, crashes: G.crashes, w: JSON.stringify(G.weapons), e: Object.keys(G.evo).join(',') }; });
    if (s.t >= next) {
      console.log(`${String(next).padStart(4)}s ${String(s.m).padStart(5)}m sp${s.sp} lv${s.lv} vapes${s.v} kills${s.k}(+${s.k - lastKills}) alive${s.en} clouds${s.cl} hits+${s.hits - lastHits} crashes${s.crashes} ${s.w} evo[${s.e}]`);
      lastHits = s.hits; lastKills = s.k; next += 30;
      if (process.argv[4]) await pg.screenshot({ path: `${process.argv[4]}/bal${next - 30}.png` });
    }
    if (s.t >= total) break;
  }
  await b.close(); srv.close();
})();
