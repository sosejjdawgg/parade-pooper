const {chromium}=require('playwright');const path=require('path');
(async()=>{const b=await chromium.launch();const src=__dirname;
for(const n of process.argv.slice(2)){
 const p=await b.newPage({viewport:{width:1280,height:769},deviceScaleFactor:1});
 await p.goto('file://'+src+'/'+n+'.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(300);
 if(n.startsWith('doc')){await p.pdf({path:path.join(__dirname,'..',n+'.pdf'),preferCSSPageSize:true,printBackground:true});}
 else await p.screenshot({path:path.join(__dirname,'..',n+'.png')});
 await p.close();}
await b.close()})();
