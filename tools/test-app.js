// Automatische test van de desktop-app (draait met xvfb-run op Linux)
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs');
const T = process.argv[2];               // map met test-PDF's
const OUT = process.argv[3] || '/tmp';
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env } });
  const win = await app.firstWindow();
  const log = [];
  win.on('console', m => log.push(m.type() + ': ' + m.text()));
  win.on('pageerror', e => log.push('ERR ' + e.message));
  await win.waitForLoadState('domcontentloaded');
  await win.waitForTimeout(1500);
  console.log('titel:', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()));
  console.log('desktop-brug:', await win.evaluate(() => !!window.desktop && window.desktop.isDesktop));
  console.log('knop:', await win.textContent('#dl'));
  // 1. een PDF openen zoals Windows dat doet (dubbelklik / Openen met)
  await app.evaluate(({ BrowserWindow }, f) => {
    BrowserWindow.getAllWindows()[0].webContents.send('open-file', { name: f.name, bytes: new Uint8Array(Buffer.from(f.b64, 'base64')) });
  }, { name: 'test.pdf', b64: fs.readFileSync(path.join(T, 'test.pdf')).toString('base64') });
  await win.waitForFunction(() => window.__test.S.pages.length > 0, null, { timeout: 30000 });
  await win.waitForTimeout(4000);
  console.log('venstertitel na openen:', await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].getTitle()));
  console.log('lettertypes:', (await win.textContent('#docfonts')).replace(/\s+/g, ' ').slice(0, 400));
  console.log('eigen lettertypes:', await win.evaluate(() => window.__test.S.fonts.filter(f => f.src === 'user').map(f => f.name).join(', ')));
  console.log('melding:', await win.textContent('#toast'));
  // 2. tekst aanpassen met letters en symbolen (zonder internet: meegeleverde lettertypes)
  const L = await win.evaluate(() => window.__test.S.pages[0].lines.map(l => l.str));
  for (const [start, txt] of [['Totaal', 'Totaal te betalen: € 2.499,00 — Łódź ő ✓'], ['Standaard', 'Helvetica aangepast ★ → Ž']]) {
    await win.evaluate(i => { const P = window.__test.S.pages[0]; window.__test.startDraftFromLine(P, P.lines[i]) }, L.findIndex(x => x.startsWith(start)));
    await win.waitForTimeout(1200);
    await win.fill('#f-text', txt); await win.waitForTimeout(1500);
    await win.evaluate(() => window.__test.finishDraft());
  }
  // 3. object verplaatsen
  await win.click('#t-obj');
  await win.evaluate(() => { const T = window.__test, it = T.objItems(T.S.pages[0]).find(i => i.t === 'image'); T.S.opage = 1; T.S.osel = [it.key]; T.applyBox({ x: 300, y: 300, w: 150, h: 75 }) });
  await win.waitForTimeout(1500);
  await win.screenshot({ path: path.join(OUT, 'app-screen.png') });
  // 4. opslaan via het Windows-venster (venster wordt in de test automatisch beantwoord)
  const target = path.join(OUT, 'app-opgeslagen.pdf');
  await app.evaluate(({ dialog }, t) => { dialog.showSaveDialog = async () => ({ canceled: false, filePath: t }) }, target);
  if (fs.existsSync(target)) fs.unlinkSync(target);
  await win.keyboard.press('Control+s');
  for (let i = 0; i < 40 && !fs.existsSync(target); i++) await win.waitForTimeout(500);
  await win.waitForTimeout(500);
  console.log('opgeslagen:', fs.existsSync(target) ? fs.statSync(target).size + ' bytes' : 'NEE');
  console.log('melding:', (await win.textContent('#toast')).trim());
  // 5. bewaard na herstart?
  console.log('fouten:', log.filter(x => /ERR|error/i.test(x) && !/favicon/.test(x)).slice(0, 8).join('\n'));
  await app.close();
  const app2 = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const w2 = await app2.firstWindow();
  await w2.waitForFunction(() => window.__test && window.__test.S.pages.length > 0, null, { timeout: 30000 }).catch(() => {});
  await w2.waitForTimeout(2000);
  console.log('na herstart:', await w2.evaluate(() => (window.__test.S.name || '-') + ', ' + window.__test.S.edits.length + ' tekstaanpassingen, ' + window.__test.S.objs.length + ' object'));
  await app2.close();
})().catch(e => { console.error('TESTFOUT', e); process.exit(1) });
