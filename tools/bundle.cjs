// Builds vape-canoe.html: the whole game in one file, no dependencies.
// Each module is embedded as a data: URL and wired up with an import map.
// Usage: node tools/bundle.cjs
const fs = require('fs'), path = require('path');
const root = path.resolve(__dirname, '..');
const mods = ['config', 'gfx', 'platform', 'music', 'game', 'render', 'main'];
const imports = {};
for (const m of mods) {
  const src = fs.readFileSync(path.join(root, 'src', m + '.js'), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from 'vc/$1'");
  imports['vc/' + m] = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
}
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'icon.png')).toString('base64');
const music = {};
for (const k of ['river', 'ufo', 'arab']) music[k] = 'data:audio/mpeg;base64,' + fs.readFileSync(path.join(root, 'music', k + '.mp3')).toString('base64');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="manifest"[^>]*>\n/, '').replace(/href="icon\.png"/g, `href="${icon}"`)
  .replace(/<meta (property="og:image[^>]*|name="twitter:[^>]*)>\n/g, '')
  .replace('<script type="module" src="src/main.js"></script>',
    () => `<script>window.__MUSIC=${JSON.stringify(music)}</script>\n<script type="importmap">${JSON.stringify({ imports })}</script>\n<script type="module">import 'vc/main';</script>`);
fs.writeFileSync(path.join(root, 'vape-canoe.html'), html);
console.log('vape-canoe.html', (html.length / 1024).toFixed(1) + ' KB');
