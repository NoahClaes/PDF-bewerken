// Test van automatisch bijwerken met een nep-release op een lokale server
const { _electron: electron } = require('playwright');
const http = require('http'), path = require('path'), fs = require('fs');
(async () => {
  const fake = Buffer.alloc(3 * 1024 * 1024, 7);
  const srv = http.createServer((req, res) => {
    if (req.url === '/latest') { res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ tag_name: 'v1.2.0', body: 'Testversie met verbeteringen.', assets: [{ name: 'PDF Bewerken Setup 1.2.0.exe', size: fake.length, browser_download_url: 'http://127.0.0.1:' + srv.address().port + '/setup.exe' }] })); }
    else if (req.url === '/setup.exe') { res.setHeader('content-length', fake.length); res.end(fake); }
    else { res.statusCode = 404; res.end(); }
  }).listen(0);
  await new Promise(r => srv.once('listening', r));
  const app = await electron.launch({ executablePath: require('electron'), args: [path.join(__dirname, '..'), '--no-sandbox'], env: { ...process.env, PDFB_UPDATE_URL: 'http://127.0.0.1:' + srv.address().port + '/latest' } });
  const win = await app.firstWindow();
  await win.waitForSelector('#updbar:not([hidden])', { timeout: 20000 });
  console.log('melding:', (await win.textContent('#updbar')).replace(/\s+/g, ' ').trim());
  await win.screenshot({ path: process.argv[2] + '/update.png' });
  await win.click('#updnow');
  await win.waitForFunction(() => /alleen op Windows|Installeren/.test(document.querySelector('#updst').textContent), null, { timeout: 20000 });
  console.log('na klik:', await win.textContent('#updst'));
  const f = path.join(require('os').tmpdir(), 'PDF-Bewerken-Setup-1.2.0.exe');
  console.log('gedownload:', fs.existsSync(f) ? fs.statSync(f).size + ' bytes' : 'nee');
  await app.close(); srv.close();
})().catch(e => { console.error('TESTFOUT', e.message); process.exit(1); });
