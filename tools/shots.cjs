// Headless smoke test + screenshots. Usage: node tools/shots.cjs <outDir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
(async () => {
const out = process.argv[2] || '.';
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/json' };
const srv = http.createServer((q, s) => {
  const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/plain' }); s.end(d); } });
}).listen(0);
const base = 'http://localhost:' + srv.address().port;
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 1 });
const errs = []; pg.on('pageerror', (e) => errs.push(String(e))); pg.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await pg.goto(base); await pg.waitForTimeout(700);
await pg.screenshot({ path: out + '/title.png' });
await pg.goto(base + '/?bot=1&fast=6');
for (const s of [4, 12, 25, 45, 70]) {
  await pg.waitForTimeout((s - (globalThis.prev || 0)) * 1000); globalThis.prev = s;
  await pg.screenshot({ path: `${out}/run${s}.png` });
  console.log(s, await pg.evaluate(() => { const { G, enemies } = __vc; return JSON.stringify({ t: G.t | 0, m: (G.dist / 20) | 0, lv: G.level, v: G.vapes, hp: G.hp, en: enemies.n, w: G.weapons, evo: G.evo, runs: window.__runs }); }));
}
console.log('errors:', errs);
await b.close(); srv.close();
})();
