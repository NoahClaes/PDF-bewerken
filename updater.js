// Automatisch bijwerken via GitHub Releases (openbare repository, geen account nodig om te downloaden)
const { app, net, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const REPO = require('./package.json').updateRepo; // bv. "NoahClaes/pdf-bewerken"
const API = process.env.PDFB_UPDATE_URL || ('https://api.github.com/repos/' + REPO + '/releases/latest');

const newer = (a, b) => { // is versie a nieuwer dan b?
  const p = v => String(v).replace(/^v/, '').split(/[.-]/).map(n => parseInt(n, 10) || 0);
  const x = p(a), y = p(b);
  for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
};

let found = null, busy = false;

async function check(getWin, manual) {
  if (!REPO && !process.env.PDFB_UPDATE_URL) return null;
  try {
    const r = await net.fetch(API, { headers: { 'User-Agent': 'PDF-Bewerken/' + app.getVersion(), 'Accept': 'application/vnd.github+json' } });
    if (r.status === 404) { if (manual) info(getWin, 'Er is nog geen versie gepubliceerd.'); return null; }
    if (!r.ok) throw new Error('GitHub antwoordde ' + r.status);
    const rel = await r.json();
    const ver = String(rel.tag_name || '').replace(/^v/, '');
    const asset = (rel.assets || []).find(a => /setup.*\.exe$/i.test(a.name));
    if (!ver || !asset || !newer(ver, app.getVersion())) { if (manual) info(getWin, 'Je hebt de nieuwste versie (' + app.getVersion() + ').'); return null; }
    found = { version: ver, notes: String(rel.body || '').slice(0, 2000), url: asset.browser_download_url, size: asset.size, name: asset.name };
    const w = getWin();
    if (w) w.webContents.send('update-available', found);
    return found;
  } catch (e) {
    if (manual) info(getWin, 'Controleren op updates lukte niet (geen internet?).\n\n' + e.message);
    return null;
  }
}

function info(getWin, msg) {
  const w = getWin();
  dialog.showMessageBox(w, { type: 'info', title: 'Updates', message: msg });
}

// nieuwe versie downloaden en stil installeren; de app start daarna vanzelf opnieuw
async function install(getWin) {
  if (!found || busy) return false;
  busy = true;
  const w = getWin();
  const send = (ch, d) => { const x = getWin(); if (x) x.webContents.send(ch, d); };
  try {
    const r = await net.fetch(found.url, { headers: { 'User-Agent': 'PDF-Bewerken/' + app.getVersion() } });
    if (!r.ok) throw new Error('download mislukt (' + r.status + ')');
    const total = Number(r.headers.get('content-length')) || found.size || 0;
    const file = path.join(app.getPath('temp'), 'PDF-Bewerken-Setup-' + found.version + '.exe');
    const out = fs.createWriteStream(file);
    const reader = r.body.getReader();
    let got = 0, last = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      got += value.length;
      if (!out.write(Buffer.from(value))) await new Promise(res => out.once('drain', res));
      const pct = total ? Math.round(got / total * 100) : 0;
      if (pct !== last) { last = pct; send('update-progress', pct); }
    }
    await new Promise((res, rej) => { out.end(res); out.on('error', rej); });
    if (total && got !== total) throw new Error('download onvolledig');
    send('update-progress', 100);
    if (process.platform !== 'win32') { send('update-error', 'Bijwerken kan alleen op Windows'); busy = false; return false; }
    // installatieprogramma stil laten lopen (/S); --relaunch start de app daarna opnieuw
    spawn(file, ['/S', '--relaunch'], { detached: true, stdio: 'ignore' }).unref();
    setTimeout(() => app.quit(), 400);
    return true;
  } catch (e) {
    busy = false;
    send('update-error', e.message);
    return false;
  }
}

function start(getWin) {
  setTimeout(() => check(getWin, false), 4000);
  setInterval(() => check(getWin, false), 6 * 3600 * 1000);
}

module.exports = { start, check, install, newer };
