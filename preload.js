// Veilige brug tussen de editor (webpagina) en Windows
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktop', {
  isDesktop: true,
  ready: () => ipcRenderer.send('renderer-ready'),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  savePdf: (name, bytes) => ipcRenderer.invoke('save-pdf', name, bytes),
  saveMany: files => ipcRenderer.invoke('save-many', files),
  showInFolder: p => ipcRenderer.invoke('show-in-folder', p),
  listFonts: () => ipcRenderer.invoke('list-fonts'),
  readFont: p => ipcRenderer.invoke('read-font', p),
  setTitle: t => ipcRenderer.send('set-title', t),
  onOpenFile: cb => ipcRenderer.on('open-file', (_e, f) => cb(f)),
  onMenu: (name, cb) => ipcRenderer.on('menu-' + name, () => cb()),
  version: () => ipcRenderer.invoke('app-version'),
  onUpdate: cb => ipcRenderer.on('update-available', (_e, u) => cb(u)),
  onUpdateProgress: cb => ipcRenderer.on('update-progress', (_e, p) => cb(p)),
  onUpdateError: cb => ipcRenderer.on('update-error', (_e, m) => cb(m)),
  installUpdate: () => ipcRenderer.invoke('update-install')
});
