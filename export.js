// Renders index.html frame-by-frame to a 1080x1920 (9:16) MP4 for TikTok.
// Needs Node, Playwright (with Chromium) and ffmpeg on PATH.
//   node export.js [out.mp4] [fps]
const {chromium}=require('playwright');
const {spawn}=require('child_process');
const path=require('path');

const out=process.argv[2]||'meadow-well.mp4';
const fps=Number(process.argv[3]||30);

(async()=>{
  const browser=await chromium.launch();
  const page=await browser.newPage({viewport:{width:1080,height:1920}});
  page.on('pageerror',e=>console.error('page error:',e.message));
  await page.goto('file://'+path.resolve(__dirname,'index.html')+'?export');
  await page.evaluate(()=>document.fonts.ready);
  const total=await page.evaluate(()=>window.__total);
  const frames=Math.ceil(total*fps);

  const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-',
    '-c:v','libx264','-preset','slow','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});

  for(let f=0;f<frames;f++){
    const url=await page.evaluate(dt=>window.__renderFrame(dt),f===0?0:1/fps);
    if(!ff.stdin.write(Buffer.from(url.split(',')[1],'base64')))await new Promise(r=>ff.stdin.once('drain',r));
    if(f%fps===0)process.stdout.write(`\rframe ${f}/${frames}`);
  }
  ff.stdin.end();
  await new Promise(r=>ff.on('close',r));
  await browser.close();
  console.log(`\nwrote ${out} (${total.toFixed(1)}s @ ${fps}fps, 1080x1920)`);
})();
