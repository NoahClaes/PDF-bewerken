// Test de Android-app in een emulator (GitHub Actions): starten, PDF openen via "Openen met",
// tekst aanpassen, opslaan in Download, panelen en terugknop. Schermafbeeldingen in dist-android/shots.
const { _android } = require('playwright');
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path');
const PKG = 'be.pdfbewerken.app';
const OUT = path.join(__dirname, '..', 'dist-android', 'shots');
fs.mkdirSync(OUT, { recursive: true });
const adb = c => execSync('adb ' + c, { encoding: 'utf8' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ok = true;
const check = (name, cond, extra) => { console.log((cond ? 'OK   ' : 'FOUT ') + name + (extra ? ' — ' + extra : '')); if (!cond) ok = false; };

(async () => {
  const [dev] = await _android.devices();
  console.log('toestel:', dev.model(), dev.serial());
  adb('install -r -g dist-android/PDF-Bewerken-debug.apk');
  adb(`shell am start -W -n ${PKG}/.MainActivity`);
  await sleep(8000);
  await dev.screenshot({ path: path.join(OUT, '1-start.png') });
  const wv = await dev.webView({ pkg: PKG });
  const page = await wv.page();
  page.on('pageerror', e => console.log('PAGINAFOUT', e.message));
  check('editor geladen', await page.evaluate(() => !!(window.__test && window.desktop && window.desktop.isAndroid)));
  check('mobiele weergave', await page.evaluate(() => document.body.classList.contains('mobile')));
  check('versie', true, await page.evaluate(() => window.desktop.version()));
  await page.evaluate(() => { try { localStorage.setItem('pdfb-tour', '1') } catch (e) { } });

  // "Openen met": PDF in de app-map zetten en een VIEW-intent sturen
  const dir = `/sdcard/Android/data/${PKG}/files`;
  adb(`shell mkdir -p ${dir}`);
  adb(`push android/test/voorbeeld.pdf ${dir}/voorbeeld.pdf`);
  adb(`shell am start -a android.intent.action.VIEW -t application/pdf -d file://${dir}/voorbeeld.pdf -n ${PKG}/.MainActivity`);
  await page.waitForFunction(() => window.__test.S.pages.length > 0, null, { timeout: 60000 });
  await sleep(3000);
  check('PDF geopend via Openen met', true, await page.evaluate(() => document.querySelector('#fname').textContent));
  await dev.screenshot({ path: path.join(OUT, '2-geopend.png') });

  // tekst aanpassen
  await page.evaluate(() => { const T = window.__test, P = T.S.pages[0]; T.startDraftFromLine(P, P.lines[0]); });
  await sleep(1500);
  await dev.screenshot({ path: path.join(OUT, '3-tekst.png') });
  await page.evaluate(() => { const t = document.querySelector('#f-text'); t.value = 'WERKERVARING'; t.dispatchEvent(new Event('input')); });
  await sleep(1500);
  await page.evaluate(() => window.__test.finishDraft());
  await sleep(800);

  // opslaan in Download
  await page.evaluate(() => document.querySelector('#dl').click());
  await page.waitForFunction(() => /opgeslagen/i.test(document.querySelector('#toast').textContent), null, { timeout: 60000 }).catch(() => { });
  const toast = await page.evaluate(() => document.querySelector('#toast').textContent);
  check('melding na opslaan', /opgeslagen in Download/i.test(toast), toast);
  await dev.screenshot({ path: path.join(OUT, '4-opgeslagen.png') });
  const ls = adb('shell ls /sdcard/Download/');
  check('bestand in Download', /voorbeeld \(bewerkt\)\.pdf/.test(ls), ls.replace(/\s+/g, ' '));
  try {
    adb(`pull "/sdcard/Download/voorbeeld (bewerkt).pdf" dist-android/shots/opgeslagen.pdf`);
    const txt = execSync('pdftotext dist-android/shots/opgeslagen.pdf -', { encoding: 'utf8' });
    check('aangepaste tekst in de PDF', /WERKERVARING/.test(txt) && !/^ERVARING/m.test(txt), txt.split('\n')[0]);
  } catch (e) { check('PDF ophalen', false, e.message); }

  // paneel open en terugknop
  await page.evaluate(() => document.querySelector('#rail-layers') && document.querySelector('#stabs button[data-tab=layers]').click());
  await sleep(1000);
  check('paneel open', await page.evaluate(() => document.querySelector('#side').classList.contains('open')));
  await dev.screenshot({ path: path.join(OUT, '5-lagen.png') });
  adb('shell input keyevent 4');
  await sleep(1000);
  check('terugknop sluit paneel', await page.evaluate(() => !document.querySelector('#side').classList.contains('open')));
  check('app nog open', /pdfbewerken/.test(adb('shell dumpsys activity activities | grep -i resumed || true')));

  // lege pagina toevoegen
  await page.evaluate(() => window.__test.insertBlank(1));
  await page.waitForFunction(() => window.__test.S.pages.length === 2, null, { timeout: 30000 }).catch(() => { });
  check('lege pagina toegevoegd', await page.evaluate(() => window.__test.S.pages.length) === 2);
  await dev.screenshot({ path: path.join(OUT, '6-lege-pagina.png') });

  await dev.close();
  console.log(ok ? 'ALLES OK' : 'ER GING IETS MIS');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
