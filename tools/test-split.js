// splitsen in de app: één map kiezen, alle pagina's als aparte PDF
const { _electron: electron } = require('playwright');
const path = require('path'), fs = require('fs'), os = require('os');
(async () => {
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'] });
  const w = await app.firstWindow(); await w.waitForTimeout(1200);
  await app.evaluate(({ BrowserWindow }, f) => { BrowserWindow.getAllWindows()[0].webContents.send('open-file', { name: 'abc.pdf', bytes: new Uint8Array(Buffer.from(f, 'base64')) }) }, fs.readFileSync(process.argv[2]).toString('base64'));
  await w.waitForFunction(() => window.__test.S.pages.length === 3); await w.waitForTimeout(1000);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'split-'));
  await app.evaluate(({ dialog, shell }, d) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [d] }); shell.openPath = async () => '' }, dir);
  await w.click('#t-pages'); await w.waitForTimeout(400); await w.click('#pm-split');
  for (let i = 0; i < 40 && fs.readdirSync(dir).length < 3; i++) await w.waitForTimeout(300);
  await w.waitForTimeout(300);
  console.log('bestanden in map:', fs.readdirSync(dir).join(', '));
  console.log('melding:', (await w.textContent('#toast')).replace(dir, '<map>'));
  await app.close();
})().catch(e => { console.log('FOUT', e.message); process.exit(1) });
