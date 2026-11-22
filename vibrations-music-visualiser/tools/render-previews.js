// Renders preview PNGs of every scene with headless Chromium.
// Usage: node tools/render-previews.js <outDir> [scene=...&palette=...]...
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const outDir = path.resolve(process.argv[2] || 'previews');
const extra = process.argv.slice(3);
fs.mkdirSync(outDir, { recursive: true });

const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(req.url.split('?')[0]));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200); fs.createReadStream(p).pipe(res);
}).listen(0, async () => {
  const port = server.address().port;
  const scenes = JSON.parse(fs.readFileSync(path.join(root, 'app/src/main/assets/scenes.json')));
  const jobs = extra.length ? extra : scenes.map((s, i) => `scene=${s.id}&palette=${i % 11}&t=37`);
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const page = await browser.newPage({ viewport: { width: 540, height: 960 } });
  for (const q of jobs) {
    const w = /w=(\d+)/.exec(q)?.[1] || 540, h = /h=(\d+)/.exec(q)?.[1] || 960;
    await page.setViewportSize({ width: +w, height: +h });
    await page.goto(`http://localhost:${port}/tools/shader-preview.html?${q}`);
    await page.waitForFunction(() => document.title === 'ready' || document.title === 'error', null, { timeout: 120000 });
    const err = await page.evaluate(() => document.body.getAttribute('data-error'));
    const name = q.replace(/[^a-z0-9=]+/gi, '_') + '.png';
    if (err) { console.log('ERROR', q, '\n', err.slice(0, 3000)); continue; }
    await page.screenshot({ path: path.join(outDir, name) });
    console.log('ok', name);
  }
  await browser.close();
  server.close();
});
