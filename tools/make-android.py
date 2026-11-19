# Maakt android/www (de Android-app) uit de Windows-versie app/index.html.
# Gebruik: python3 tools/make-android.py
# Eerst tools/make-desktop.py draaien, zodat app/index.html bijgewerkt is.
import os, shutil

root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
app = os.path.join(root, 'app')
www = os.path.join(root, 'android', 'www')
src = open(os.path.join(app, 'index.html'), encoding='utf-8').read()

def rep(old, new, cnt=1):
    global src
    n = src.count(old)
    if n != cnt:
        raise SystemExit(f'COUNT {n}!={cnt} for: {old[:100]!r}')
    src = src.replace(old, new)

# cordova.js en de Android-brug laden vóór de editor
rep('<script src="vendor/pdf.min.js"></script>', '<script src="cordova.js"></script>\n<script src="bridge.js"></script>\n<script src="vendor/pdf.min.js"></script>')
# geen pinch-zoom van de hele pagina (de editor zoomt zelf)
rep('<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">')
# teksten voor een telefoon
rep("$('#drop p').textContent='Sleep een PDF hierheen of kies een bestand. Het bestand blijft op deze computer; er wordt niets geüpload.';",
    "$('#drop p').textContent='Kies een PDF op je toestel, of open een PDF vanuit een andere app met \"Openen met\" of \"Delen\" → PDF Bewerken. Er wordt niets geüpload.';")
rep("""say((warn?'PDF opgeslagen. '+warn:'PDF opgeslagen: '+esc(fp.split(/[\\\\/]/).pop())+'.')+' <button id="showf">Toon in map</button>',warn?12000:7000);
      const sb=$('#showf');if(sb)sb.onclick=()=>desktop.showInFolder(fp);""",
    """say((warn?'PDF opgeslagen in Download. '+warn:'PDF opgeslagen in Download: '+esc(fp.split(/[\\\\/]/).pop())+'.')+' <button id="showf">Delen</button><button id="openf">Openen</button>',warn?12000:8000);
      const sb=$('#showf');if(sb)sb.onclick=()=>desktop.showInFolder(fp);const ob=$('#openf');if(ob)ob.onclick=()=>desktop.openSaved(fp);""")
rep("Je bestanden en lettertypes blijven bewaard. De app start na het bijwerken vanzelf opnieuw.",
    "Je bestanden en lettertypes blijven bewaard. Na het downloaden vraagt Android of je de update wilt installeren.")
rep("'Installeren… de app sluit even en start opnieuw.'", "'Tik in het venster van Android op Installeren. Zie je een melding over onbekende apps, sta het dan toe voor PDF Bewerken.'")
rep("Probeer later opnieuw via Help → Controleren op updates.", "Probeer het later opnieuw (start de app opnieuw).")
# geen lettertypes 'van deze computer' op Android; veilige zones van het scherm
rep('</style>', """  #localfonts{display:none!important}
  body.mobile #bar{padding-top:env(safe-area-inset-top)}
  #toast button+button{margin-left:6px}
</style>""")

if os.path.isdir(www):
    shutil.rmtree(www)
os.makedirs(www)
open(os.path.join(www, 'index.html'), 'w', encoding='utf-8').write(src)
shutil.copy(os.path.join(root, 'android', 'bridge.js'), os.path.join(www, 'bridge.js'))
for d in ('vendor', 'fonts'):
    shutil.copytree(os.path.join(app, d), os.path.join(www, d))
print('ok', len(src))
