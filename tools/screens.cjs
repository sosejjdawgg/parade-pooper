// Screenshots of every screen + generates og.png and icon.png. Usage: node tools/screens.cjs <outDir>
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..'), out = process.argv[2] || '.';
(async () => {
  const srv = http.createServer((q, s) => {
    const f = path.join(root, q.url.split('?')[0] === '/' ? 'index.html' : q.url.split('?')[0]);
    fs.readFile(f, (e, d) => { if (e) { s.writeHead(404); s.end(); } else { s.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : f.endsWith('.html') ? 'text/html' : 'text/plain' }); s.end(d); } });
  }).listen(0);
  const base = 'http://localhost:' + srv.address().port;
  const b = await chromium.launch(), pg = await b.newPage({ viewport: { width: 360, height: 640 } });
  const errs = []; pg.on('pageerror', (e) => errs.push(String(e)));
  await pg.goto(base); await pg.waitForTimeout(600);
  await pg.screenshot({ path: out + '/s_title.png' });
  const title = (await pg.screenshot()).toString('base64');
  await pg.mouse.click(180, 300); await pg.waitForTimeout(1500);           // PLAY
  await pg.mouse.click(60, 400); await pg.mouse.click(60, 400); await pg.waitForTimeout(300);
  await pg.screenshot({ path: out + '/s_play.png' });
  await pg.evaluate(() => { __vc.G.xp = 9999; }); await pg.waitForTimeout(700);
  await pg.screenshot({ path: out + '/s_levelup.png' });
  await pg.mouse.click(180, 200); await pg.waitForTimeout(500);
  const afterPick = await pg.evaluate(() => __vc.G.mode + ' ' + JSON.stringify(__vc.G.weapons) + JSON.stringify(__vc.G.passives));
  await pg.evaluate(() => { const G = __vc.G; G.pending = 0; G.choices = null; G.mode = 'play'; G.xp = 0; G.hp = 1; G.inv = 0; G.px = -999; });
  await pg.evaluate(() => { const G = __vc.G; G.result = { title: 'RESIGNED!', tip: 'ALWAYS CHECK WHICH HOME IS YOUR MAIN HOME.', vapes: 1234, m: 2210, level: 31, kills: 4021, cash: 88, newBest: true }; G.cause = 'swan'; G.dead = true; G.mode = 'dead'; __vc.save.cash = 131; });
  await pg.waitForTimeout(500); await pg.screenshot({ path: out + '/s_dead.png' });
  await pg.mouse.click(100, 480); await pg.waitForTimeout(500);             // SHOP
  await pg.screenshot({ path: out + '/s_shop.png' });
  await pg.mouse.click(310, 126); await pg.waitForTimeout(400);             // buy engine
  await pg.screenshot({ path: out + '/s_shop2.png' });
  console.log('after pick:', afterPick, '| shop:', await pg.evaluate(() => JSON.stringify(__vc.save.shop) + ' cash ' + __vc.save.cash), '| errors:', errs);

  // icon
  const icon = await pg.evaluate(() => {
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512);
    const s = __vc.SPR.canoe[0], k = 10; g.drawImage(s, 256 - s.width * k / 2, 256 - s.height * k / 2, s.width * k, s.height * k);
    const v = __vc.SPR.bigVape[2]; g.drawImage(v, 30, 40, v.width * 6, v.height * 6); g.drawImage(__vc.SPR.bigVape[13], 340, 330, v.width * 6, v.height * 6);
    return c.toDataURL('image/png').split(',')[1];
  });
  fs.writeFileSync(path.join(root, 'icon.png'), Buffer.from(icon, 'base64'));
  // og image: title + late-game action
  const action = fs.existsSync(out + '/bal450.png') ? fs.readFileSync(out + '/bal450.png').toString('base64') : title;
  const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(`<body style="margin:0;background:#000;display:flex;overflow:hidden">
    <div style="width:700px;height:630px;overflow:hidden"><img src="data:image/png;base64,${title}" style="image-rendering:pixelated;width:700px;margin-top:-30px"></div>
    <div style="width:500px;height:630px;overflow:hidden;border-left:6px solid #fff;box-sizing:border-box"><img src="data:image/png;base64,${action}" style="image-rendering:pixelated;width:500px;margin-top:-380px"></div></body>`);
  await og.screenshot({ path: path.join(root, 'og.png') });
  await b.close(); srv.close();
})();
