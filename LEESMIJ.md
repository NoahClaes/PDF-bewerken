# PDF Bewerken

Tekst, lettertypes, symbolen, afbeeldingen, vormen, lagen en pagina's in PDF-bestanden aanpassen, als **Windows-app**. Dezelfde editor bestaat ook online als het artefact *PDF-tekst bewerken* op claude.ai.

Je bestanden blijven op je eigen computer; er wordt niets geüpload.

## Installeren

Download het installatieprogramma onder **Releases** en start het. Het installeert voor jouw gebruiker (geen beheerdersrechten nodig), maakt een snelkoppeling op het bureaublad en in het Startmenu, en voegt **Bewerken met PDF Bewerken** toe aan het rechtermuismenu van PDF-bestanden.

**Windows-waarschuwing bij de eerste start:** de app is niet digitaal ondertekend (daarvoor is een betaald certificaat nodig). Windows toont dan *"Windows heeft uw pc beschermd"*. Klik op **Meer informatie** → **Toch uitvoeren**. Dat hoeft maar één keer.

## Updates

De app ziet zelf wanneer er een nieuwe versie is en toont dan **Nu bijwerken**.

## Wat de app extra doet ten opzichte van de online versie

- **Werkt zonder internet**: de PDF-onderdelen en de reserve-lettertypes (ook voor symbolen zoals ✓ ★ → €) zitten in de app. Gratis Google-lettertypes worden nog wel online opgehaald als je ze zoekt.
- **Lettertypes van je computer worden automatisch gebruikt** bij het openen van een PDF: uit `C:\Windows\Fonts`, je eigen geïnstalleerde lettertypes en **Adobe Fonts die in Creative Cloud geactiveerd zijn**.
- **Opslaan met het gewone Windows-venster** (Ctrl+S) en openen met Ctrl+O, door slepen, dubbelklikken of *Openen met*.
- Je bewaarde bestanden en toegevoegde lettertypes blijven bewaard, ook na een update.

## Nieuwe versie uitbrengen

1. Pas `version` aan in `package.json` (bv. `2.3.0`) en schrijf wat er nieuw is in `RELEASE_NOTES.md`.
2. Commit en push naar `main`.
3. GitHub Actions (*Windows-versie publiceren*) doet dan:
   1. **Lettertypetest**: elke regel van de test-PDF's in `tests/pdfs` wordt bewerkt en per teken gecontroleerd. Mislukt die test, dan wordt er niets uitgebracht.
   2. **Windows**: het installatieprogramma bouwen en een release maken.
4. De geïnstalleerde app ziet de nieuwe versie bij de volgende start.

## Zelf bouwen en testen (voor ontwikkelaars)

De editor zelf is één bestand: `tools/editor-artifact.html` (dezelfde als het artefact). Daaruit wordt de app gemaakt:

```bash
python3 tools/make-desktop.py tools/editor-artifact.html   # maakt app/index.html
```

Bouwen (Node.js 20+; op Linux ook `nsis`):

```bash
npm install
npm start          # de app starten om te testen
npm run dist       # Windows-installatie maken in dist/
```

**Tests:**

| Test | Wat |
|---|---|
| `node tools/test-fonts.js tests/pdfs` | lettertypetest (Playwright + Chromium) |
| `xvfb-run -a node tools/test-app.js <map-met-test-pdfs> <uitvoermap>` | Windows-app: openen, aanpassen, opslaan, herstarten |
