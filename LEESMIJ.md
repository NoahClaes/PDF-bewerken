# PDF Bewerken

Tekst, lettertypes, symbolen, afbeeldingen, vormen, lagen en pagina's in PDF-bestanden aanpassen. Er zijn drie versies met dezelfde editor:

| Versie | Waar |
|---|---|
| **Windows-app** | `PDF.Bewerken.Setup.<versie>.exe` onder **Releases** |
| **Android-app** | `PDF-Bewerken-<versie>.apk` onder **Releases** |
| **Online** | het artefact *PDF-tekst bewerken* op claude.ai |

Je bestanden blijven op je eigen computer of telefoon; er wordt niets geüpload.

## Installeren

### Windows

Download het installatieprogramma onder **Releases** en start het. Het installeert voor jouw gebruiker (geen beheerdersrechten nodig), maakt een snelkoppeling op het bureaublad en in het Startmenu, en voegt **Bewerken met PDF Bewerken** toe aan het rechtermuismenu van PDF-bestanden.

**Windows-waarschuwing bij de eerste start:** de app is niet digitaal ondertekend (daarvoor is een betaald certificaat nodig). Windows toont dan *"Windows heeft uw pc beschermd"*. Klik op **Meer informatie** → **Toch uitvoeren**. Dat hoeft maar één keer.

### Android

Open de releasepagina op je telefoon en tik op het `.apk`-bestand. Sta de eerste keer toe dat je browser apps installeert, en tik op **Installeren**. Waarschuwt Play Protect dat de app onbekend is (ze komt niet uit de Play Store), kies dan **Toch installeren**.

PDF's openen kan met **PDF kiezen** in de app, of vanuit een andere app (WhatsApp, Gmail, Mijn bestanden) met **Openen met** of **Delen** → **PDF Bewerken**. Opslaan gebeurt in de map **Download**.

### Updates

De Windows- en Android-app zien zelf wanneer er een nieuwe versie is en tonen dan **Nu bijwerken**.

## Wat de apps extra doen ten opzichte van de online versie

- **Werkt zonder internet**: de PDF-onderdelen en de reserve-lettertypes (ook voor symbolen zoals ✓ ★ → €) zitten in de app. Gratis Google-lettertypes worden nog wel online opgehaald als je ze zoekt.
- **Windows: lettertypes van je computer worden automatisch gebruikt** bij het openen van een PDF: uit `C:\Windows\Fonts`, je eigen geïnstalleerde lettertypes en **Adobe Fonts die in Creative Cloud geactiveerd zijn**.
- **Windows: opslaan met het gewone Windows-venster** (Ctrl+S) en openen met Ctrl+O, door slepen, dubbelklikken of *Openen met*.
- Je bewaarde bestanden en toegevoegde lettertypes blijven bewaard, ook na een update.

**Let op in de Claude-app op een telefoon:** daar kan het artefact geen bestanden kiezen. Gebruik op je telefoon de Android-app, of open het artefact in Chrome.

## Nieuwe versie uitbrengen

1. Pas `version` aan in `package.json` (bv. `2.3.0`) en schrijf wat er nieuw is in `RELEASE_NOTES.md`.
2. Commit en push naar `main`.
3. GitHub Actions (*Windows- en Android-versie publiceren*) doet dan:
   1. **Lettertypetest**: elke regel van de test-PDF's in `tests/pdfs` wordt bewerkt en per teken gecontroleerd. Mislukt die test, dan wordt er niets uitgebracht.
   2. **Windows**: het installatieprogramma bouwen en een release maken.
   3. **Android**: de APK bouwen, ondertekenen en bij dezelfde release zetten.
4. De geïnstalleerde apps zien de nieuwe versie bij de volgende start.

### Android-ondertekensleutel

Android installeert een update alleen als hij met dezelfde sleutel ondertekend is. De sleutel staat als GitHub-secrets in deze repository: `ANDROID_KEYSTORE_B64` (het sleutelbestand in base64) en `ANDROID_KEYSTORE_PASS` (het wachtwoord). **Bewaar een kopie van de sleutel op een veilige plek**; zonder die sleutel kunnen er geen Android-updates meer gemaakt worden. Zonder deze secrets slaat de release de Android-app over (met een waarschuwing).

## Zelf bouwen en testen (voor ontwikkelaars)

De editor zelf is één bestand: `tools/editor-artifact.html` (dezelfde als het artefact). Daaruit worden de apps gemaakt:

```bash
python3 tools/make-desktop.py tools/editor-artifact.html   # maakt app/index.html (Windows)
python3 tools/make-android.py                              # maakt android/www (Android), uit app/index.html
```

**Windows-app** (Node.js 20+; op Linux ook `nsis`):

```bash
npm install
npm start          # de app starten om te testen
npm run dist       # Windows-installatie maken in dist/
```

**Android-app** (Java 17, Gradle en de Android SDK; op GitHub Actions is dat aanwezig):

```bash
bash tools/build-android.sh debug      # test-APK in dist-android/
```

De Android-onderdelen staan in `android/`: `config.xml` (Cordova), `bridge.js` (opslaan, delen, openen met, updates) en de eigen plug-in in `android/pdfb-plugin`.

**Tests:**

| Test | Wat |
|---|---|
| `node tools/test-fonts.js tests/pdfs` | lettertypetest (Playwright + Chromium) |
| `xvfb-run -a node tools/test-app.js <map-met-test-pdfs> <uitvoermap>` | Windows-app: openen, aanpassen, opslaan, herstarten |
| workflow *Android testen* | bouwt een test-APK en test hem in een Android-emulator (openen met, opslaan in Download, terugknop, lege pagina) |
