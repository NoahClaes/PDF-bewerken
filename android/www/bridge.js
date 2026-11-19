// Android-brug: dezelfde 'desktop'-functies als in de Windows-app, maar via de Cordova-plug-in.
(function () {
  var dr = new Promise(function (r) { document.addEventListener('deviceready', r, false); });
  var P = function () { return dr.then(function () { return window.PdfbAndroid; }); };
  var toB64 = function (u8) {
    if (!(u8 instanceof Uint8Array)) u8 = new Uint8Array(u8);
    var s = '';
    for (var i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  };
  var fromB64 = function (b) { var s = atob(b), u = new Uint8Array(s.length); for (var i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  var saved = new Map(), upd = null, updCb = null, progCb = null, errCb = null;
  var REPO = 'NoahClaes/PDF-bewerken';

  window.desktop = {
    isDesktop: true,
    isAndroid: true,
    ready: function () { checkUpdate(); },
    openDialog: function () { document.getElementById('file').click(); },
    savePdf: async function (name, bytes) {
      var p = await P();
      var r = await p.save(name, toB64(bytes), '');
      saved.set(r.path, r.uri);
      return r.path;
    },
    saveMany: async function (files) {
      var p = await P(), sub = 'PDF Bewerken';
      for (var i = 0; i < files.length; i++) {
        var r = await p.save(files[i].name, toB64(files[i].bytes), sub);
        saved.set(r.path, r.uri);
      }
      return 'Download/' + sub;
    },
    // in de Windows-app: "Toon in map"; op Android: delen
    showInFolder: async function (path) { var u = saved.get(path); if (u) (await P()).share(u); },
    openSaved: async function (path) { var u = saved.get(path); if (u) (await P()).open(u); },
    listFonts: async function () { return []; },
    readFont: async function () { throw new Error('Niet beschikbaar op Android.'); },
    setTitle: function () {},
    onMenu: function () {},
    onOpenFile: function (cb) {
      P().then(function (p) {
        p.onFile(function (f) {
          if (f.error) { if (window.say) say('Openen lukte niet: ' + f.error, 6000); return; }
          if (f.b64) cb({ name: f.name, bytes: fromB64(f.b64) });
        });
      });
    },
    version: async function () { return (await P()).version(); },
    onUpdate: function (cb) { updCb = cb; if (upd) cb(upd); },
    onUpdateProgress: function (cb) { progCb = cb; },
    onUpdateError: function (cb) { errCb = cb; },
    installUpdate: async function () {
      try { await (await P()).update(upd.url, function (p) { if (progCb) progCb(p); }); }
      catch (e) { if (errCb) errCb(String(e && e.message || e)); }
    }
  };

  var newer = function (a, b) {
    var x = String(a).split('.').map(Number), y = String(b).split('.').map(Number);
    for (var i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
    return false;
  };
  async function checkUpdate() {
    try {
      var p = await P(), cur = await p.version();
      var r = await fetch('https://api.github.com/repos/' + REPO + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
      if (!r.ok) return;
      var j = await r.json(), v = String(j.tag_name || '').replace(/^v/, '');
      var a = (j.assets || []).find(function (x) { return /\.apk$/i.test(x.name); });
      if (!a || !newer(v, cur)) return;
      upd = { version: v, notes: (j.body || '').replace(/\*\*/g, ''), url: a.browser_download_url };
      if (updCb) updCb(upd);
    } catch (e) { }
  }

  // terugknop van Android: eerst menu's/panelen sluiten, dan pas de app naar de achtergrond
  function onBack() {
    var q = function (s) { return document.querySelector(s); };
    var shown = function (e) { return e && !e.hidden && getComputedStyle(e).display !== 'none'; };
    var T = window.__test || {}, S = T.S;
    if (q('.ui-menu.show')) { document.querySelectorAll('.ui-menu.show').forEach(function (m) { m.classList.remove('show'); }); return; }
    if (q('#fb-more.show')) { q('#fb-more').classList.remove('show'); return; }
    if (q('#ui-helpback.show')) { q('#ui-helpback').classList.remove('show'); return; }
    if (q('#tour.show')) { var sk = q('#tour-skip'); if (sk) sk.click(); return; }
    if (shown(q('#sympanel'))) { q('#sympanel').hidden = true; return; }
    if (shown(q('#libpanel'))) { q('#libpanel').hidden = true; return; }
    if (q('#pmback') && !q('#pmback').hidden) { q('#pm-cancel').click(); return; }
    if (q('#dlgback') && getComputedStyle(q('#dlgback')).display !== 'none') { q('#dlgback').style.display = 'none'; return; }
    if (q('#updbar') && !q('#updbar').hidden) { q('#updbar').hidden = true; return; }
    if (q('#side.open') && T.sheet) { T.sheet(false); return; }
    if (S && S.draft && T.finishDraft) { T.finishDraft(); return; }
    if (S && S.mode === 'obj' && S.osel && S.osel.length) { S.osel = []; if (T.setMode) T.setMode('obj'); return; }
    P().then(function (p) { p.exit(); });
  }
  dr.then(function () { document.addEventListener('backbutton', onBack, false); });
})();
