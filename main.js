// PDF Bewerken - Windows-app (Electron)
const { app, BrowserWindow, protocol, net, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { listFonts } = require('./fontscan');
const updater = require('./updater');

const APP_DIR = path.join(__dirname, 'app');

// eigen adres app://editor/ : de editor bewaart zijn bestanden en lettertypes blijvend in de app
protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
]);

let win = null;
let rendererReady = false;
const pendingFiles = [];

const pdfArg = argv => argv.slice(1).find(a => /\.pdf$/i.test(a) && fs.existsSync(a));

// één venster: een tweede keer openen (bv. dubbelklik op een PDF) gaat naar het open venster
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', (_e, argv) => {
    const f = pdfArg(argv);
    if (f) openPath(f);
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

function openPath(p) {
  if (!rendererReady || !win) { pendingFiles.push(p); return; }
  try {
    const bytes = fs.readFileSync(p);
    win.webContents.send('open-file', { name: path.basename(p), path: p, bytes: new Uint8Array(bytes) });
  } catch (e) {
    dialog.showErrorBox('Openen mislukt', 'Kon dit bestand niet openen:\n' + p + '\n\n' + e.message);
  }
}

async function chooseAndOpen() {
  const r = await dialog.showOpenDialog(win, {
    title: 'PDF openen',
    properties: ['openFile'],
    filters: [{ name: 'PDF-bestanden', extensions: ['pdf'] }]
  });
  if (!r.canceled && r.filePaths[0]) openPath(r.filePaths[0]);
}

function buildMenu() {
  const send = ch => () => win && win.webContents.send(ch);
  const tpl = [
    { label: 'Bestand', submenu: [
      { label: 'PDF openen…', accelerator: 'CmdOrCtrl+O', registerAccelerator: false, click: chooseAndOpen },
      { label: 'Opslaan als PDF…', accelerator: 'CmdOrCtrl+S', registerAccelerator: false, click: send('menu-save') },
      { label: 'Mijn bestanden', click: send('menu-library') },
      { type: 'separator' },
      { label: 'Afsluiten', role: 'quit' }
    ] },
    // geen Ongedaan maken/Opnieuw hier: die regelt de editor zelf (Ctrl+Z / Ctrl+Y)
    { label: 'Bewerken', submenu: [
      { label: 'Knippen', role: 'cut' }, { label: 'Kopiëren', role: 'copy' }, { label: 'Plakken', role: 'paste' },
      { label: 'Alles selecteren', role: 'selectAll' }
    ] },
    { label: 'Beeld', submenu: [
      { label: 'Inzoomen (venster)', role: 'zoomIn' }, { label: 'Uitzoomen (venster)', role: 'zoomOut' }, { label: 'Ware grootte', role: 'resetZoom' },
      { type: 'separator' }, { label: 'Volledig scherm', role: 'togglefullscreen' },
      { type: 'separator' }, { label: 'Opnieuw laden', role: 'reload' }, { label: 'Ontwikkelaarshulpmiddelen', role: 'toggleDevTools' }
    ] },
    { label: 'Help', submenu: [
      { label: 'Controleren op updates…', click: () => updater.check(() => win, true) },
      { type: 'separator' },
      { label: 'Over PDF Bewerken', click: () => dialog.showMessageBox(win, {
        type: 'info', title: 'Over PDF Bewerken',
        message: 'PDF Bewerken ' + app.getVersion(),
        detail: 'Tekst, lettertypes, afbeeldingen en vormen in PDF-bestanden aanpassen.\nJe bestanden blijven op deze computer; er wordt niets geüpload.\n\nLettertypes van je computer (ook Adobe Fonts uit Creative Cloud) worden automatisch gebruikt.'
      }) }
    ] }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createWindow() {
  win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 900, minHeight: 600,
    title: 'PDF Bewerken',
    icon: path.join(__dirname, 'build', 'icon.png'),
    backgroundColor: '#eceef1',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  win.once('ready-to-show', () => win.show());
  win.on('page-title-updated', e => e.preventDefault());
  win.loadURL('app://editor/index.html');
  // links naar buiten openen in de gewone browser
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // een PDF op het venster slepen
  win.on('closed', () => { win = null; rendererReady = false; });
}

app.whenReady().then(() => {
  protocol.handle('app', async req => {
    const u = new URL(req.url);
    const p = path.normalize(path.join(APP_DIR, decodeURIComponent(u.pathname)));
    if (!p.startsWith(APP_DIR)) return new Response('', { status: 403 });
    try {
      if (!fs.statSync(p).isFile()) return new Response('', { status: 404 });
      return await net.fetch(pathToFileURL(p).toString());
    } catch (e) {
      return new Response('', { status: 404 });
    }
  });
  // lettertypes van de computer mogen gelezen worden
  const ses = require('electron').session.defaultSession;
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(['local-fonts', 'clipboard-read', 'clipboard-sanitized-write'].includes(perm)));

  buildMenu();
  createWindow();
  updater.start(() => win);
  const f = pdfArg(process.argv);
  if (f) pendingFiles.push(f);
});

app.on('window-all-closed', () => app.quit());
app.on('open-file', (e, p) => { e.preventDefault(); openPath(p); }); // macOS

// ---- verbinding met de editor ----
ipcMain.on('renderer-ready', () => {
  rendererReady = true;
  while (pendingFiles.length) openPath(pendingFiles.shift());
});
ipcMain.handle('open-dialog', () => chooseAndOpen());
ipcMain.handle('save-pdf', async (_e, defaultName, bytes) => {
  const last = app.getPath('documents');
  const r = await dialog.showSaveDialog(win, {
    title: 'PDF opslaan',
    defaultPath: path.join(last, defaultName),
    filters: [{ name: 'PDF-bestand', extensions: ['pdf'] }]
  });
  if (r.canceled || !r.filePath) return null;
  let fp = r.filePath;
  if (!/\.pdf$/i.test(fp)) fp += '.pdf';
  fs.writeFileSync(fp, Buffer.from(bytes));
  return fp;
});
ipcMain.handle('show-in-folder', (_e, p) => { if (p && fs.existsSync(p)) shell.showItemInFolder(p); });
ipcMain.handle('list-fonts', () => listFonts(path.join(app.getPath('userData'), 'fontindex.json')));
ipcMain.handle('read-font', (_e, p) => {
  // alleen lettertypes uit de lijst mogen gelezen worden
  const ok = listFonts(path.join(app.getPath('userData'), 'fontindex.json')).some(f => f.path === p);
  if (!ok) throw new Error('geen lettertype');
  return new Uint8Array(fs.readFileSync(p));
});
ipcMain.on('set-title', (_e, t) => { if (win) win.setTitle(t ? t + ' - PDF Bewerken' : 'PDF Bewerken'); });
ipcMain.handle('update-install', () => updater.install(() => win));
ipcMain.handle('app-version', () => app.getVersion());
