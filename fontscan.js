// Lettertypes op deze computer vinden (Windows, ook Adobe Fonts uit Creative Cloud).
// Leest alleen de naamtabel van elk bestand, zodat ook honderden lettertypes snel gaan; de lijst wordt bewaard.
const fs = require('fs');
const path = require('path');

function fontDirs() {
  const d = [];
  const env = process.env;
  if (process.platform === 'win32') {
    d.push(path.join(env.WINDIR || 'C:\\Windows', 'Fonts'));
    if (env.LOCALAPPDATA) d.push(path.join(env.LOCALAPPDATA, 'Microsoft', 'Windows', 'Fonts'));
    // Adobe Fonts (Creative Cloud) worden hier verborgen bewaard
    if (env.APPDATA) d.push(path.join(env.APPDATA, 'Adobe', 'CoreSync', 'plugins', 'livetype'));
  } else if (process.platform === 'darwin') {
    d.push('/Library/Fonts', '/System/Library/Fonts', '/System/Library/Fonts/Supplemental', path.join(env.HOME || '', 'Library', 'Fonts'));
    d.push(path.join(env.HOME || '', 'Library', 'Application Support', 'Adobe', 'CoreSync', 'plugins', 'livetype'));
  } else {
    d.push('/usr/share/fonts', '/usr/local/share/fonts', path.join(env.HOME || '', '.fonts'), path.join(env.HOME || '', '.local', 'share', 'fonts'));
  }
  return d.filter(x => { try { return fs.statSync(x).isDirectory(); } catch (e) { return false; } });
}

function walk(dir, out, depth = 0) {
  if (depth > 8) return;
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const it of items) {
    const p = path.join(dir, it.name);
    if (it.isDirectory()) walk(p, out, depth + 1);
    else if (it.isFile()) out.push(p);
  }
}

function readAt(fd, pos, len) {
  const b = Buffer.alloc(len);
  const n = fs.readSync(fd, b, 0, len, pos);
  return b.subarray(0, n);
}

// namen uit de 'name'-tabel van één lettertype dat op positie 'base' in het bestand begint
function namesAt(fd, base) {
  const hd = readAt(fd, base, 12);
  if (hd.length < 12) return null;
  const tag = hd.toString('latin1', 0, 4);
  if (!(tag === '\x00\x01\x00\x00' || tag === 'OTTO' || tag === 'true')) return null;
  const numTables = hd.readUInt16BE(4);
  if (numTables > 100) return null;
  const dir = readAt(fd, base + 12, numTables * 16);
  let off = -1, len = 0;
  for (let i = 0; i < numTables; i++) {
    if (dir.toString('latin1', i * 16, i * 16 + 4) === 'name') { off = dir.readUInt32BE(i * 16 + 8); len = dir.readUInt32BE(i * 16 + 12); }
  }
  if (off < 0 || len > 2e6) return null;
  const t = readAt(fd, off, len);
  if (t.length < 6) return null;
  const count = t.readUInt16BE(2), strOff = t.readUInt16BE(4);
  const names = {};
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    if (r + 12 > t.length) break;
    const pid = t.readUInt16BE(r), eid = t.readUInt16BE(r + 2), lang = t.readUInt16BE(r + 4), nid = t.readUInt16BE(r + 6), l = t.readUInt16BE(r + 8), o = t.readUInt16BE(r + 10);
    if (![1, 2, 4, 6, 16, 17].includes(nid)) continue;
    const s = t.subarray(strOff + o, strOff + o + l);
    let v;
    if (pid === 3 || pid === 0) { // UTF-16BE
      const sw = Buffer.from(s); if (sw.length % 2) continue; sw.swap16(); v = sw.toString('utf16le');
      if (pid === 3 && lang !== 0x409 && names[nid]) continue; // Engels heeft voorrang
    } else if (pid === 1 && eid === 0) { if (names[nid]) continue; v = s.toString('latin1'); }
    else continue;
    names[nid] = v.replace(/\0/g, '').trim();
  }
  if (!names[1] && !names[6]) return null;
  return { family: names[16] || names[1] || '', sub: names[17] || names[2] || '', full: names[4] || '', ps: names[6] || '' };
}

function scanFile(p) {
  let fd;
  try {
    fd = fs.openSync(p, 'r');
    const hd = readAt(fd, 0, 12);
    if (hd.length < 12) return [];
    const tag = hd.toString('latin1', 0, 4);
    if (tag === 'ttcf') {
      // verzamelbestand (.ttc): kan niet in een PDF worden ingesloten, alleen vermelden
      const n = Math.min(hd.readUInt32BE(8), 64);
      const offs = readAt(fd, 12, n * 4);
      const out = [];
      for (let i = 0; i < n; i++) { const nm = namesAt(fd, offs.readUInt32BE(i * 4)); if (nm) out.push({ ...nm, ttc: true }); }
      return out;
    }
    const nm = namesAt(fd, 0);
    return nm ? [nm] : [];
  } catch (e) { return []; } finally { if (fd !== undefined) try { fs.closeSync(fd); } catch (e) {} }
}

function listFonts(cacheFile) {
  let cache = {};
  try { cache = JSON.parse(fs.readFileSync(cacheFile, 'utf8')); } catch (e) {}
  const next = {}, out = [];
  for (const d of fontDirs()) {
    const files = [];
    walk(d, files);
    for (const p of files) {
      let st;
      try { st = fs.statSync(p); } catch (e) { continue; }
      if (st.size < 1000 || st.size > 40e6) continue;
      // Adobe-lettertypes hebben vaak geen extensie; anders alleen lettertypebestanden
      const ext = path.extname(p).toLowerCase();
      const adobe = /livetype/i.test(p);
      if (!adobe && !['.ttf', '.otf', '.ttc'].includes(ext)) continue;
      const key = p + '|' + st.size + '|' + Math.round(st.mtimeMs);
      const v = cache[key] || scanFile(p);
      next[key] = v;
      for (const f of v) out.push({ path: p, ...f, adobe, size: st.size });
    }
  }
  try { fs.writeFileSync(cacheFile, JSON.stringify(next)); } catch (e) {}
  return out;
}

module.exports = { listFonts, fontDirs };
