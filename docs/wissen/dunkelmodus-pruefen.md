# Den Dunkelmodus prüfen

Stand: 29.09.2026. Zwei Skripte unter `frontend/scripts/` prüfen den
Dunkelmodus gerendert, im echten Chromium, gegen eine lokale Vorschau.
Die Stylesheet-Tests (`dunkelmodus.test.ts`, `farbTokens.test.ts`) lesen nur
Text — ob eine Regel gegen das Ionic-Theme greift und wie es aussieht, zeigen
erst diese beiden. Keines läuft in der CI (die Pipeline hat keinen laufenden
Stack); **vor jeder Farbänderung und danach** lokal laufen lassen und die
Zahlen in die Commit-Nachricht schreiben.

| Skript | Was es tut | Dauer |
|---|---|---|
| `npm run dunkelmodus:messen` | rechnet Kontraste und sucht helle Flächen über 188 Zustände (47 Seiten, hell und dunkel, iOS- und Android-Kennung); Restliste in `dunkelmodus-restliste.json` | rund 12 Minuten |
| `npm run dunkelmodus:bilder` | macht 28 Bilder von 14 ausgewählten Seiten im Dunkeln (iOS und Android), prüft feste Merkmale und vergleicht mit einem früheren Lauf | rund 3 Minuten |

## Die lokale Vorschau aufsetzen

Beide Skripte melden sich als `konfi1`, `teamer1` und `admin1` aus dem
Test-Seed an (`backend/tests/helpers/seed.js`, Passwort dort).

1. **Datenbank** mit Schema, Migrationen und Seed — derselbe Weg wie
   `backend/tests/globalSetup.js` (Dump `backend/tests/schema/prod-schema.sql`,
   Stand aus `prod-migrations.txt`, dann die übrigen Migrationen, dann
   `seed()`). Für `dunkelmodus:messen` zusätzlich einige Chat-Nachrichten mit
   Reaktionen in Raum 1 (eine von jemand anderem als `konfi1`), einen Antrag
   und eine laufende Challenge, sonst melden die Auflagen „Seed?".
   Alternativ der E2E-Stack: `docker compose -f docker-compose.e2e.yml up -d
   --build --wait` samt Seed aus `e2e/global-setup.ts` (Oberfläche auf
   Port 5556).
2. **Backend** aus `backend/`: `node server.js` mit `DATABASE_URL` auf diese
   Datenbank, `PORT`, beliebigen Testwerten für `JWT_SECRET` und
   `QR_SECRET`, einem 64-stelligen Hex-Testschlüssel für
   `ACTIVITY_PHOTO_ENCRYPTION_KEY`, `CORS_ORIGINS` auf die Adresse der
   Vorschau und `RUN_BACKGROUND_JOBS=false`. Keine echten Schlüssel.
3. **Oberfläche** aus `frontend/`: `VITE_API_URL=http://localhost:<port>/api
   npx vite build --outDir <ordner>`, dann `npx vite preview --outDir <ordner>
   --port <port>` — oder `npx vite` für den Entwicklungsserver.
4. **Playwright** mit Chromium: aus `node_modules` im Repo-Root oder global;
   Browser über `PLAYWRIGHT_BROWSERS_PATH`.

## Vorher und nachher vergleichen

```
cd frontend
npm run dunkelmodus:bilder -- --url http://localhost:<port> --out /tmp/dunkel-vorher
# Farbänderung machen, Vorschau neu bauen
npm run dunkelmodus:bilder -- --url http://localhost:<port> --out /tmp/dunkel-nachher --vergleich /tmp/dunkel-vorher
```

Der zweite Lauf nennt je Bild den Anteil geänderter Bildpunkte und endet mit
Exit 1, wenn ein Bild die Schwelle (`--schwelle`, Standard 1 %) überschreitet
oder ein festes Merkmal fällt. Dann die genannten Bilder **ansehen**: Eine
gewollte Änderung ist kein Fehler. Den Zufall der App (Losung oder Lehrtext
auf den Startseiten) legt das Skript fest; zwei Läufe desselben Stands
unterscheiden sich damit um 0,00 % (28 von 28 Bildern, gemessen 29.09.2026 —
ohne die Festlegung 10–17 % auf den Startseiten). Was bleibt: Die Begrüßung
folgt der Tageszeit, und Uhrzeiten und relative Daten aus dem Seed („in 7
Tagen") ändern sich über den Tag. Vorher- und Nachher-Lauf deshalb kurz
hintereinander gegen dieselbe Datenbank.

Gegenprobe (29.09.2026): Ein Stand, in dem die Karte im Dunkeln hell war
(`--app-surface-card` dunkel auf `#f0f0f0`), fiel mit 48 Merkmalen — 24-mal
„helle Fläche", 24 Bilder mit 3–38 % geänderten Bildpunkten — und Exit 1.

Die festen Merkmale je Seite und Plattform:

- Ionic-Modus passt zur Kennung (iPhone → `ios`, Android → `md`);
- `prefers-color-scheme: dark` greift;
- der Seitengrund ist dunkel (relative Helligkeit unter 0,05);
- eine `ion-card.app-card` trägt das Token `--app-surface-card`;
- keine deckende helle Fläche ab 40 × 24 px.

Die Bilder bleiben außerhalb des Repos — Baselines im Repo wären je Lauf
28 Bilder, zusammen 12 MB, und schrieben die Schriften und Uhrzeiten einer
bestimmten Maschine fest. `--hell` nimmt zusätzlich die hellen Bilder auf.

## Wenn Chromium abstürzt

`dunkelmodus:messen` bricht bei knappem Speicher gelegentlich mit
„Target crashed" ab (am 29.09.2026 zweimal im Leitungs-Teil). Dann in Teilen
laufen lassen — `--only public|konfi|teamer|admin`, den Leitungs-Teil
zusätzlich je `--schemes dark|light` und `--platforms ios|android`, die
Auflagen mit `--nur-auflagen` — und jeden Teil auf Exit 0 prüfen.
