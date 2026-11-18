// Ctrl+scroll in de desktop-app: zoomt de pagina, niet het venster
const { _electron: electron } = require('playwright');
const path=require('path'),fs=require('fs');
(async()=>{const app=await electron.launch({executablePath:require('electron'),args:[path.join(__dirname,'..'),'--no-sandbox']});
const w=await app.firstWindow();await w.waitForTimeout(1200);
await app.evaluate(({BrowserWindow},f)=>{BrowserWindow.getAllWindows()[0].webContents.send('open-file',{name:'letter.pdf',bytes:new Uint8Array(Buffer.from(f,'base64'))})},fs.readFileSync(process.argv[2]).toString('base64'));
await w.waitForFunction(()=>window.__test.S.pages.length>0);await w.waitForTimeout(1500);
const s0=await w.evaluate(()=>window.__test.S.scale);
await w.mouse.move(500,500);await w.keyboard.down('Control');await w.mouse.wheel(0,-100);await w.mouse.wheel(0,-100);await w.keyboard.up('Control');await w.waitForTimeout(400);
console.log('pagina-zoom:',s0,'->',await w.evaluate(()=>window.__test.S.scale),'| venster-zoom:',await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.getZoomFactor()));
await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].webContents.send('menu-zoomfit'));await w.waitForTimeout(300);
console.log('menu Pagina passend:',await w.evaluate(()=>window.__test.S.scale));
await app.close()})().catch(e=>{console.log('FOUT',e.message);process.exit(1)});
