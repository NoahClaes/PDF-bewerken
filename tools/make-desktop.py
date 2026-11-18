# Maakt app/index.html (desktopversie) uit de editor van het artifact.
# Gebruik: python3 tools/make-desktop.py <editor.html>
import sys, os
src_file = sys.argv[1]
out_file = os.path.join(os.path.dirname(__file__), '..', 'app', 'index.html')
src = open(src_file, encoding='utf-8').read()

def rep(old, new, cnt=1):
    global src
    n = src.count(old)
    if n != cnt:
        raise SystemExit(f'COUNT {n}!={cnt} for: {old[:100]!r}')
    src = src.replace(old, new)

# ---- bibliotheken uit de app zelf (werkt zonder internet) ----
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>', '<script src="vendor/pdf.min.js"></script>')
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js"></script>', '<script src="vendor/pdf-lib.min.js"></script>')
rep('<script src="https://unpkg.com/@pdf-lib/fontkit@1.1.1/dist/fontkit.umd.min.js"></script>', '<script src="vendor/fontkit.umd.min.js"></script>')
rep("pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';",
    "pdfjsLib.GlobalWorkerOptions.workerSrc=new URL('vendor/pdf.worker.min.js',location.href).href;")
rep("const PDFJS_DATA='https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/';", "const PDFJS_DATA=new URL('vendor/',location.href).href;")
# ---- lettertypes: eerst de meegeleverde, dan online ----
rep("const r=await fetch(`${FSBASE}${slug}/files/${slug}-${sub}-${w}-${it?'italic':'normal'}.woff`);",
    "const fn=`${slug}/files/${slug}-${sub}-${w}-${it?'italic':'normal'}.woff`;let r=null;try{r=await fetch('fonts/'+fn);if(!r.ok)r=null}catch(_){r=null}if(!r)r=await fetch(FSBASE+fn);")
# ---- opslaan met het gewone Windows-venster ----
rep("""  let dl=null;try{dl=await claude.use('downloads')}catch(e){}
  if(!dl){say('Downloaden is hier niet beschikbaar.""", """  if(window.desktop){
    try{
      const fp=await desktop.savePdf(S.name.replace(/\\.pdf$/i,'')+' (bewerkt).pdf',bytes);
      if(!fp){say('Opslaan geannuleerd.',2500);return}
      S.lastSavedPath=fp;
      say((warn?'PDF opgeslagen. '+warn:'PDF opgeslagen: '+esc(fp.split(/[\\\\/]/).pop())+'.')+' <button id="showf">Toon in map</button>',warn?12000:7000);
      const sb=$('#showf');if(sb)sb.onclick=()=>desktop.showInFolder(fp);
    }catch(e){say('Opslaan lukte niet: '+esc(e.message||e),8000)}
    return;
  }
  let dl=null;try{dl=await claude.use('downloads')}catch(e){}
  if(!dl){say('Downloaden is hier niet beschikbaar.""")
# ---- titel van het venster ----
rep("""    $('#fname').textContent=name;""", """    $('#fname').textContent=name;if(window.desktop)desktop.setTitle(name);""")
# ---- lettertypes van deze computer: automatisch bij het openen ----
rep("""    listDocFonts(true);""", """    if(window.desktop)desktopFonts(true).then(()=>listDocFonts(true));else listDocFonts(true);""")
rep("""$('#localfonts').onclick=async()=>{""", """// desktop: lettertypes rechtstreeks uit de Windows-lettertypemap en Adobe Creative Cloud lezen
async function desktopFonts(quiet){
  if(!window.desktop||!S.doc)return 0;
  let list;
  try{list=await desktop.listFonts()}catch(e){if(!quiet)say('Lettertypes van deze computer lezen lukte niet.',5000);return 0}
  const nm=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const want=new Set();
  for(const P of S.pages)for(const l of P.lines)if(l.rname){const n=parseFontName(l.rname).norm;if(n)want.add(n)}
  let done=[];try{done=JSON.parse(localStorage.getItem('pdfedit-imported')||'[]')}catch(e){}
  const has=new Set(S.fonts.filter(f=>f.src==='user').map(f=>f.norm));
  const pick=list.filter(f=>{const a=parseFontName(f.ps||'').norm,b=nm(f.family);return want.has(a)||want.has(b)});
  const ttcOnly=pick.length&&pick.every(f=>f.ttc);
  let ok=0;const fams=new Set();
  for(const f of pick){
    if(f.ttc)continue;
    const n=parseFontName(f.ps||f.family).norm;
    if(has.has(n)&&done.includes(f.path))continue;
    try{const b=await desktop.readFont(f.path);await addUserFontFile(new File([b],(f.ps||f.full||'lettertype')+'.otf'));ok++;fams.add(f.family);if(!done.includes(f.path))done.push(f.path)}catch(e){}
  }
  try{localStorage.setItem('pdfedit-imported',JSON.stringify(done.slice(-500)))}catch(e){}
  if(ok){rcache.clear();fontsChanged();showFontList();fillFontSelect();repaintAll()}
  if(ok&&quiet)say(`${ok} lettertype(s) van deze computer gebruikt: ${esc([...fams].join(', '))}.`,5000);
  if(!quiet){
    if(ok)say(`${ok} lettertype(s) van deze computer toegevoegd: ${esc([...fams].join(', '))}.`,6000);
    else if(ttcOnly)say('Dit lettertype staat op je computer, maar alleen als verzamelbestand (.ttc). Dat kan niet in een PDF worden ingesloten; de editor gebruikt een gelijkende vervanger.',9000);
    else say(pick.length?'De lettertypes van dit document zijn al toegevoegd.':`Geen van de lettertypes uit dit document staat op deze computer (${list.length} lettertypes bekeken). Activeer ze eventueel in Adobe Creative Cloud en klik opnieuw.`,8000);
    listDocFonts();
  }
  return ok;
}
$('#localfonts').onclick=async()=>{
  if(window.desktop){say('Lettertypes van deze computer zoeken…',20000);await desktopFonts(false);return}""")
# ---- bestanden die Windows doorgeeft (dubbelklik, Openen met, menu) ----
rep("""    if(docs.length&&!S.doc&&!window.__noAutoOpen){await openSaved(docs[0].id)}""",
    """    if(window.desktop)await new Promise(r=>setTimeout(r,500));
    if(docs.length&&!S.doc&&!S.extOpen&&!window.__noAutoOpen){await openSaved(docs[0].id)}""")
src = src.replace('</script>\n</body>', """
if(window.desktop){
  desktop.onOpenFile(f=>{S.extOpen=true;openBytes(new Uint8Array(f.bytes),f.name,{})});
  desktop.onMenu('save',()=>{if(S.doc)$('#dl').click();else say('Open eerst een PDF.',3000)});
  desktop.onMenu('library',()=>{$('#libbtn').click()});
  desktop.onMenu('zoomin',()=>setZoom(zoomStep(1)));
  desktop.onMenu('zoomout',()=>setZoom(zoomStep(-1)));
  desktop.onMenu('zoomfit',()=>{if(S.doc)fitScale().then(s=>setZoom(s,null,true))});
  (document.querySelector('#dl .dlt')||$('#dl')).textContent='Opslaan';$('#dl').title='Opslaan als PDF (Ctrl+S)';
  $('#openbtn').title='PDF openen (Ctrl+O)';
  $('#drop p').textContent='Sleep een PDF hierheen of kies een bestand. Het bestand blijft op deze computer; er wordt niets geüpload.';
  $('#localfonts').title='Lettertypes uit de Windows-lettertypemap en uit Adobe Creative Cloud. Dit gebeurt ook automatisch bij het openen van een PDF.';
  // sneltoetsen Ctrl+S en Ctrl+O (ook als je aan het typen bent)
  document.addEventListener('keydown',e=>{
    if(!(e.ctrlKey||e.metaKey)||e.altKey||e.shiftKey)return;
    const k=e.key.toLowerCase();
    if(k==='s'){e.preventDefault();if(S.saving)return;if(S.doc)$('#dl').click();else say('Open eerst een PDF.',3000)}
    else if(k==='o'){e.preventDefault();desktop.openDialog()}
  },true);
  // nooit twee keer tegelijk opslaan
  const dlBtn=$('#dl'),dlOrig=dlBtn.onclick;
  dlBtn.onclick=async(...a)=>{if(S.saving)return;S.saving=true;try{await dlOrig.apply(dlBtn,a)}finally{S.saving=false}};
  // ---- automatische updates ----
  const ub=document.createElement('div');ub.id='updbar';ub.hidden=true;
  ub.style.cssText='position:fixed;right:16px;bottom:16px;z-index:70;background:#fff;border:1px solid #d9dce1;border-radius:12px;box-shadow:0 10px 36px rgba(0,0,0,.22);padding:14px 16px;width:340px;font-size:14px';
  document.body.appendChild(ub);
  desktop.onUpdate(u=>{
    ub.hidden=false;
    ub.innerHTML=`<div style="font-weight:600;margin-bottom:4px">Nieuwe versie ${esc(u.version)} beschikbaar</div>`+
      (u.notes?`<div class="muted" style="white-space:pre-line;max-height:120px;overflow:auto;margin-bottom:8px">${esc(u.notes)}</div>`:'')+
      `<div class="muted" id="updst" style="margin-bottom:10px">Je bestanden en lettertypes blijven bewaard. De app start na het bijwerken vanzelf opnieuw.</div>`+
      `<div style="display:flex;gap:8px;justify-content:flex-end"><button id="updlater">Later</button><button id="updnow" class="primary">Nu bijwerken</button></div>`;
    $('#updlater').onclick=()=>{ub.hidden=true};
    $('#updnow').onclick=async()=>{
      if(S.draft)finishDraft();
      $('#updnow').disabled=true;$('#updlater').disabled=true;$('#updst').textContent='Downloaden… 0%';
      await desktop.installUpdate();
    };
  });
  desktop.onUpdateProgress(p=>{const s=$('#updst');if(s)s.textContent=p<100?`Downloaden… ${p}%`:'Installeren… de app sluit even en start opnieuw.'});
  desktop.onUpdateError(m=>{const s=$('#updst');if(s)s.textContent='Bijwerken lukte niet: '+m+'. Probeer later opnieuw via Help → Controleren op updates.';const b=$('#updnow'),l=$('#updlater');if(b)b.disabled=false;if(l)l.disabled=false});
  desktop.ready();
}
</script>
</body>""", 1)
assert 'desktop.ready()' in src
open(out_file, 'w', encoding='utf-8').write(src)
print('ok', len(src))
