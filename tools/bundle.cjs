// Builds the whole game into one HTML file, no dependencies.
// Each module is embedded as a data: URL and wired up with an import map.
//   node tools/bundle.cjs          -> vape-kayak.html (personal build, includes the opening track)
//   node tools/bundle.cjs --itch   -> marketing/vape-kayak-itch.zip (public build: index.html + LEGAL.txt,
//                                     WITHOUT music/river.mp3, which is a cover of a commercial song)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const root = path.resolve(__dirname, '..'), itch = process.argv.includes('--itch');
const mods = ['config', 'gfx', 'platform', 'music', 'game', 'render', 'main'];
const imports = {};
for (const m of mods) {
  const src = fs.readFileSync(path.join(root, 'src', m + '.js'), 'utf8').replace(/from '\.\/(\w+)\.js'/g, "from 'vc/$1'");
  imports['vc/' + m] = 'data:text/javascript;base64,' + Buffer.from(src).toString('base64');
}
const icon = 'data:image/png;base64,' + fs.readFileSync(path.join(root, 'icon.png')).toString('base64');
const music = {};
for (const k of itch ? ['ufo', 'arab'] : ['river', 'ufo', 'arab']) music[k] = 'data:audio/mpeg;base64,' + fs.readFileSync(path.join(root, 'music', k + '.mp3')).toString('base64');
let html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
html = html.replace(/<link rel="manifest"[^>]*>\n/, '').replace(/href="icon\.png"/g, `href="${icon}"`)
  .replace(/<meta (property="og:image[^>]*|name="twitter:[^>]*)>\n/g, '')
  .replace('<script type="module" src="src/main.js"></script>',
    () => `<script>window.__MUSIC=${JSON.stringify(music)};window.__NO_OPENER=${itch}</script>\n<script type="importmap">${JSON.stringify({ imports })}</script>\n<script type="module">import 'vc/main';</script>`);
if (!itch) {
  fs.writeFileSync(path.join(root, 'vape-kayak.html'), html);
  console.log('vape-kayak.html', (html.length / 1024).toFixed(1) + ' KB');
} else {
  const dir = path.join(root, 'marketing', 'itch-build'), zip = path.join(root, 'marketing', 'vape-kayak-itch.zip');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.copyFileSync(path.join(root, 'LEGAL.md'), path.join(dir, 'LEGAL.txt'));
  execFileSync('python3', ['-c', "import zipfile,sys\nz=zipfile.ZipFile(sys.argv[1],'w',zipfile.ZIP_DEFLATED)\nz.write(sys.argv[2]+'/index.html','index.html')\nz.write(sys.argv[2]+'/LEGAL.txt','LEGAL.txt')\nz.close()", zip, dir]);
  fs.rmSync(dir, { recursive: true });
  console.log('marketing/vape-kayak-itch.zip', (fs.statSync(zip).size / 1024).toFixed(1) + ' KB (no opening track)');
}
