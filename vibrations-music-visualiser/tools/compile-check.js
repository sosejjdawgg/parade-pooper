// Compiles every GLSL file used by the app (scenes + post) in WebGL2 and reports errors.
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const A = path.resolve(__dirname, '../app/src/main/assets/shaders');
const vs = fs.readFileSync(path.join(A, 'post/fullscreen.vert'), 'utf8');
const common = fs.readFileSync(path.join(A, 'common.glsl'), 'utf8');
const jobs = [];
for (const f of fs.readdirSync(path.join(A, 'post'))) if (f.endsWith('.frag')) jobs.push([f, fs.readFileSync(path.join(A, 'post', f), 'utf8')]);
for (const f of fs.readdirSync(path.join(A, 'scenes'))) jobs.push([f, common + '\n' + fs.readFileSync(path.join(A, 'scenes', f), 'utf8')]);
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage();
  const res = await p.evaluate(({ vs, jobs }) => {
    const gl = document.createElement('canvas').getContext('webgl2');
    const out = [];
    for (const [name, fs] of jobs) {
      const mk = (t, s) => { const sh = gl.createShader(t); gl.shaderSource(sh, '#version 300 es\n' + s); gl.compileShader(sh); return sh; };
      const v = mk(gl.VERTEX_SHADER, vs), f = mk(gl.FRAGMENT_SHADER, fs);
      const pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
      out.push([name, gl.getProgramParameter(pr, gl.LINK_STATUS) ? 'ok' : (gl.getShaderInfoLog(f) || gl.getProgramInfoLog(pr))]);
    }
    return out;
  }, { vs, jobs });
  res.forEach(([n, r]) => console.log(n.padEnd(16), r));
  await b.close();
  process.exit(res.every(([, r]) => r === 'ok') ? 0 : 1);
})();
