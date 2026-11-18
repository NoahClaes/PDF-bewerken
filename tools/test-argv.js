const { _electron: electron } = require('playwright');
(async()=>{const app=await electron.launch({executablePath:process.env.APPBIN,args:['--no-sandbox',process.argv[2]]});
const w=await app.firstWindow();await w.waitForFunction(()=>window.__test&&window.__test.S.pages.length>0,null,{timeout:30000});await w.waitForTimeout(800);
console.log('geopend via dubbelklik:',await w.evaluate(()=>window.__test.S.name),'| titel:',await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].getTitle()));
await app.close()})().catch(e=>{console.log('FOUT',e.message);process.exit(1)});
