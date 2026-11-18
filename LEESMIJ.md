# PDF Bewerken – Windows-app

Tekst, lettertypes, symbolen, afbeeldingen en vormen in PDF-bestanden aanpassen. Je bestanden blijven op je computer.

## Installeren

Er zijn twee versies in de map `dist`:

| Bestand | Wat |
|---|---|
| `PDF Bewerken Setup 1.0.0.exe` | Installatieprogramma. Installeert voor jouw gebruiker (geen beheerdersrechten nodig), maakt een snelkoppeling op het bureaublad en in het Startmenu, en voegt **Bewerken met PDF Bewerken** toe aan het rechtermuismenu van PDF-bestanden. |
| `PDF Bewerken 1.0.0 (zonder installatie).zip` | Uitpakken en `PDF Bewerken.exe` starten. Niets wordt geïnstalleerd. |

**Windows-waarschuwing bij de eerste start:** de app is niet digitaal ondertekend (daarvoor is een betaald certificaat nodig). Windows toont dan *"Windows heeft uw pc beschermd"*. Klik op **Meer informatie** → **Toch uitvoeren**. Dat hoeft maar één keer.

Je standaard PDF-programma blijft hetzelfde. PDF Bewerken staat erbij onder **Openen met**.

## Wat de app extra doet ten opzichte van de browserversie

- **Werkt zonder internet**: de PDF-onderdelen en de reserve-lettertypes (ook voor symbolen zoals ✓ ★ → €) zitten in de app. Gratis Google-lettertypes worden nog wel online opgehaald als je ze zoekt.
- **Lettertypes van je computer worden automatisch gebruikt** bij het openen van een PDF: uit `C:\Windows\Fonts`, je eigen geïnstalleerde lettertypes, en **Adobe Fonts die in Creative Cloud geactiveerd zijn**. Geen bestanden meer zoeken en toevoegen.
- **Opslaan met het gewone Windows-venster** (Ctrl+S), met de knop *Toon in map* erna.
- **Openen** via Ctrl+O, door een PDF op het venster te slepen, of door te dubbelklikken / *Openen met* in Verkenner.
- Je bewaarde bestanden ("Mijn bestanden") en toegevoegde lettertypes blijven bewaard in `%APPDATA%\PDF Bewerken`, ook na een update of verwijderen van de app.

## Zelf opnieuw bouwen (voor ontwikkelaars)

Nodig: Node.js 20+, en op Linux `nsis` en `zip` (Wine is niet nodig).

```bash
npm install
npm start          # de app starten om te testen
npm run dist       # Windows-installatie + zip maken in dist/
```

De editor zelf staat in `app/index.html`. Die wordt gemaakt uit de artifactversie met:

```bash
python3 tools/make-desktop.py <pad-naar-editor.html>
```

Automatische test (Linux, met xvfb): `xvfb-run -a node tools/test-app.js <map-met-test-pdfs> <uitvoermap>`.
