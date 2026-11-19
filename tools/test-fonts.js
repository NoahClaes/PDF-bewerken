// Lettertypetest: opent PDF's in de editor, zet per pagina alle tekst in bewerkmodus en vergelijkt elke regel
// met hoe hij in de originele PDF staat. Blokjes, ontbrekende of verschoven letters geven een duidelijk verschil.
// Gebruik: node tools/test-fonts.js <map-met-pdfs> [uitvoermap]
// Werkt met app/index.html (de versie met lokale bibliotheken). Stopt met foutcode 1 als een regel niet goed is.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const APP = path.join(__dirname, '..', 'app');
const DIR = process.argv[2] || path.join(__dirname, '..', 'tests', 'pdfs');
const OUT = process.argv[3] || path.join(__dirname, '..', 'dist-test');
fs.mkdirSync(OUT, { recursive: true });

// grenzen (afgesteld op echte PDF's uit Word, Canva, LibreOffice en Google Docs)
const MIN_OVERLAP = 0.30, MAX_INK = 1.75, MIN_INK = 0.55, MAX_EXTRA = +(process.env.MAX_EXTRA || 9), MAX_MISS = +(process.env.MAX_MISS || 9);

(async () => {
  const pdfs = fs.readdirSync(DIR).filter(f => /\.pdf$/i.test(f)).sort();
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 1400, height: 2200 } });
  const errs = [];
  pg.on('pageerror', e => errs.push(e.message));
  await pg.route('**/*', async r => {
    const u = new URL(r.request().url());
    if (u.hostname !== 'app.test') return r.fulfill({ status: 404, body: '' });
    const p = path.join(APP, decodeURIComponent(u.pathname === '/' ? 'index.html' : u.pathname.slice(1)));
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return r.fulfill({ path: p });
    return r.fulfill({ status: 404, body: '' });
  });
  await pg.addInitScript(() => { try { localStorage.setItem('pdfb-tour', '1') } catch (e) { } window.__noAutoOpen = true; });
  await pg.goto('https://app.test/index.html');
  await pg.addStyleTag({ content: '.ed.draft .txt,.ed.gsel .txt{outline:none!important;background:none!important}.caret,.rh,.grip,.selr,#fbar,#toast{display:none!important}' });
  let bad = 0, total = 0;
  for (const f of pdfs) {
    await pg.evaluate(() => { window.__test.S.pages = [] });
    await pg.setInputFiles('#file', path.join(DIR, f));
    await pg.waitForFunction(() => window.__test.S.pages.length > 0 && document.querySelector('#docfonts').textContent.length > 0, null, { timeout: 60000 });
    await pg.waitForTimeout(2500);
    const n = await pg.evaluate(() => window.__test.S.pages.length);
    if (process.env.DBG) console.log(f, 'paginas', n);
    for (let pn = 1; pn <= Math.min(n, +(process.env.MAXP||6)); pn++) {
      // regels van deze pagina (vakjes in schermpunten, binnen de pagina)
      const lines = await pg.evaluate(pn => {
        const T = window.__test, P = T.S.pages[pn - 1], s = T.S.scale;
        P.wrap.scrollIntoView();
        return P.lines.map((l, i) => ({ i, str: l.str, x: l.xTL * s - 3, y: l.topTL * s - 3, w: l.wpt * s + 6, h: l.hpt * s + 6 }))
          .filter(r => r.w > 6 && r.h > 6 && r.str.trim().length > 1);
      }, pn);
      if (process.env.DBG) console.log('pagina', pn, 'regels', lines.length);
      if (!lines.length) continue;
      const shot = async () => (await (await pg.$(`#pages > .pg:nth-child(${pn})`)).screenshot()).toString('base64');
      const before = await shot();
      await pg.evaluate(async pn => { const T = window.__test, P = T.S.pages[pn - 1]; await T.makeGroup(P, P.lines.map(line => ({ line }))) }, pn);
      await pg.waitForTimeout(2500);
      const after = await shot();
      // exacte controle: komt elk teken uit een lettertype dat er een juiste vorm voor heeft?
      const glyphErr = await pg.evaluate(() => {
        const T = window.__test, S = T.S, out = [];
        for (const id of (S.group ? S.group.ids : [])) {
          const e = S.edits.find(x => x.id === id); if (!e) continue;
          for (const [st, t] of T.styleTexts(e).slice(0, -1)) for (const r of T.runsFor(st, t)) {
            if (r.miss) { out.push(`“${r.t}” zit in geen enkel lettertype (${e.text.slice(0, 30)})`); continue }
            const f = T.fontById(r.f); if (!f) continue;
            const fk = T.fkOf(f); if (!fk) continue;
            const src = [...r.t], map = [...r.m];
            for (let k = 0; k < map.length; k++) {
              const u = src[k] || ''; if (/[\u0000-\u001f\u007f]/.test(u)) continue; const g = fk.glyphForCodePoint(map[k].codePointAt(0));
              let n = -1; try { n = g.path.commands.length } catch (x) { }
              const ws = /\s/.test(u);
              if (!g || !g.id || (ws && n > 0) || (!ws && n === 0 && !/[\u200b-\u200f\u2060\ufeff]/.test(u)))
                out.push(`teken “${u}” (U+${u.codePointAt(0).toString(16)}) uit ${f.name}: ${!g || !g.id ? 'ontbreekt' : ws ? 'spatie is niet leeg' : 'letter is leeg'} (${e.text.slice(0, 30)})`);
            }
          }
        }
        return [...new Set(out)];
      });
      for (const m of glyphErr.slice(0, 10)) console.log(`FOUT ${f} p${pn}: ${m}`);
      if (glyphErr.length) bad += glyphErr.length;
      const res = await pg.evaluate(async ({ a, b, lines }) => {
        const load = src => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + src });
        const [A, B] = await Promise.all([load(a), load(b)]);
        const cv = document.createElement('canvas'); cv.width = A.width; cv.height = A.height;
        const x = cv.getContext('2d', { willReadFrequently: true });
        const px = img => { x.clearRect(0, 0, cv.width, cv.height); x.drawImage(img, 0, 0); return x.getImageData(0, 0, cv.width, cv.height).data };
        const da = px(A), db = px(B), W = cv.width;
        const out = [];
        for (const L of lines) {
          const x0 = Math.max(0, Math.floor(L.x)), y0 = Math.max(0, Math.floor(L.y)), x1 = Math.min(W, Math.ceil(L.x + L.w)), y1 = Math.min(cv.height, Math.ceil(L.y + L.h));
          if (x1 - x0 < 4 || y1 - y0 < 4) continue;
          // achtergrondkleur = meest voorkomende kleur in het originele vakje
          const hist = new Map();
          for (let y = y0; y < y1; y += 2) for (let xx = x0; xx < x1; xx += 2) { const o = (y * W + xx) * 4, k = (da[o] >> 4) + ',' + (da[o + 1] >> 4) + ',' + (da[o + 2] >> 4); hist.set(k, (hist.get(k) || 0) + 1) }
          const bg = [...hist].sort((p, q) => q[1] - p[1])[0][0].split(',').map(v => v * 16 + 8);
          const ink = (d, o) => Math.abs(d[o] - bg[0]) + Math.abs(d[o + 1] - bg[1]) + Math.abs(d[o + 2] - bg[2]) > 120;
          const w = x1 - x0, h = y1 - y0, ma = new Uint8Array(w * h), mb = new Uint8Array(w * h);
          let ia = 0, ib = 0;
          for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) { const o = ((y + y0) * W + xx + x0) * 4; if (ink(da, o)) { ma[y * w + xx] = 1; ia++ } if (ink(db, o)) { mb[y * w + xx] = 1; ib++ } }
          if (ia < 15) continue;
          // overlap met wat speling (2 px), want een vervangend lettertype staat nooit pixel-precies goed
          const dil = m => { const r = new Uint8Array(w * h); for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) if (m[y * w + xx]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xq = xx + dx; if (yy >= 0 && yy < h && xq >= 0 && xq < w) r[yy * w + xq] = 1 } return r };
          const A2 = dil(ma), B2 = dil(mb);
          let inter = 0, uni = 0, extra = 0, miss = 0;
          for (let k = 0; k < w * h; k++) { if (A2[k] || B2[k]) uni++; if (A2[k] && B2[k]) inter++; if (mb[k] && !A2[k]) extra++; if (ma[k] && !B2[k]) miss++ }
          out.push({ i: L.i, str: L.str, overlap: inter / uni, ink: ib / ia, extra: extra / ia, miss: miss / ia, box: [x0, y0, w, h] });
        }
        return out;
      }, { a: before, b: after, lines });
      for (const r of res) {
        total++;
        const fail = r.overlap < MIN_OVERLAP || r.ink > MAX_INK || r.ink < MIN_INK || r.extra > MAX_EXTRA || r.miss > MAX_MISS;
        if (fail) {
          bad++;
          console.log(`FOUT ${f} p${pn} regel ${r.i}: overlap ${r.overlap.toFixed(2)}, inkt ${r.ink.toFixed(2)}, extra ${r.extra.toFixed(2)}, mist ${r.miss.toFixed(2)} — “${r.str.slice(0, 60)}”`);
          const c = { x: r.box[0], y: r.box[1], width: r.box[2], height: r.box[3] };
          const el = await pg.$(`#pages > .pg:nth-child(${pn})`), bb = await el.boundingBox();
          await pg.screenshot({ path: path.join(OUT, `${f}-p${pn}-r${r.i}.png`), clip: { x: bb.x + c.x, y: bb.y + c.y, width: c.width, height: c.height } }).catch(() => { });
        } else if (process.env.VERBOSE) console.log(`ok   ${f} p${pn} regel ${r.i}: ${r.overlap.toFixed(2)} / ${r.ink.toFixed(2)} / extra ${r.extra.toFixed(3)} / mist ${r.miss.toFixed(3)} “${r.str.slice(0, 40)}”`);
      }
      const worst = res.slice().sort((p, q) => p.overlap - q.overlap)[0];
      console.log(`${f} p${pn}: ${res.length} regels getest` + (worst ? `, laagste overlap ${worst.overlap.toFixed(2)}` : ''));
      await pg.evaluate(() => { const T = window.__test; if (T.S.group) T.endGroup(false) });
      await pg.waitForTimeout(800);
    }
  }
  if (errs.length) { console.log('PAGINAFOUTEN:\n' + errs.slice(0, 5).join('\n')); }
  console.log(bad ? `${bad} van ${total} regels zien er anders uit dan in de PDF. Zie ${OUT}` : `ALLES OK: ${total} regels getest`);
  await b.close();
  process.exit(bad || errs.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
