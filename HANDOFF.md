# Handoff — Stand 25.08.2026, abends

**Simons Auftrag für diese Sitzung, wörtlich:**
> "Wenn das alles erledigt ist, will ich einen Build. Den teste ich, und dann
> pushen wir in die Review-Prozesse."

Also: erst alles Offene abarbeiten, dann EIN Build zum Testen, danach
Store-Review. Keine Zwischenbuilds ungefragt.

Das laufende Register steht in **`BAUSTELLEN.md`**, die Prüfberichte in
**`docs/agenten-berichte/`** (neu angelegt — Analysen gehören dorthin, nicht in
Temp-Verzeichnisse; sie werden nie gelöscht, nur als ERLEDIGT oder WIDERLEGT
vermerkt).

---

## ZUERST: zwei Dinge prüfen

1. **`git status`** — beim Sitzungsende war die Arbeit am Verbuchen-Kennzeichen
   (`backend/routes/events.js`, `backend/services/backgroundService.js`,
   `backend/tests/routes/events.test.js`) fertig und getestet, aber NICHT
   committet. Der Testlauf hing beim Abbruch. Also: Testlauf wiederholen
   (`cd backend && npm run test:ci`), dann committen.
2. **Produktion lief auf `6721eec`** — alles seit heute Mittag ist NICHT
   ausgerollt. Der Auto-Deploy ist seit 21.08. absichtlich pausiert
   (`if: false` in ci.yml). Von Hand deployen, mit Backup vorher.

---

## Reihenfolge bis zum Build

### 1. Deployen und nachmessen
Backup, dann Image-Tags in `/opt/stacks/portainer/compose/249/v220/docker-compose.yml`
per sed ersetzen, `docker compose -p konfi_quest up -d`.
**Migration 128 läuft dabei mit** (View `event_booking_stats`) — Logs prüfen:
"Migrations applied" muss sie nennen, keine FAILED-Zeile.
Danach nachmessen: Konfi-Fahrt (Event 105, Org 1) muss **19 Konfis, 4 Teamer,
2 abgemeldet** zeigen — in Liste, Detail und Verbuchen-Reiter gleich.

### 2. Offenes abarbeiten (vor dem Build)
- **Store-Texte** — 157 Changelog-Einträge auf eine lesbare Release-Notiz
  eindampfen. Aus Nutzersicht, keine Build-Nummern.
- **Bildschirmfotos aus Org 4**, als Skript (damit sie nicht veralten).
  Demo-Konten: `demo.leitung`, `demo.teamer`, `demo.emilia`, alle
  `KonfiDemo2026!`.
- **Handbuch mit Bildschirmfotos** plus vier Kapitelpunkte (QR-Einladung,
  QR-Check-in, Wiki-Querverweise, Hinweise aus dem Challenge-Modal).
- **Version, Git-Tag, GitHub-Release** — Tag ohne `v`-Präfix.

### 3. Build — erst wenn 1 und 2 durch sind
`frontend/version.json` auf **iosBuildNumber 143** (142 ist gebaut und in
TestFlight, hat aber die letzten sieben Commits nicht), committen, dann
`gh workflow run ios-release.yml --ref main`.
Testinfos sind Pflicht: per ASC-API setzen, mit Klickpfad und Erwartet-Zeile.
Der Entwurf von Build 142 liegt im Scratchpad und muss um die neuen Punkte
ergänzt werden (Teamer-Zusage, getrennte Verbuchung, Musik-Links, Offline).

### 4. Simon testet, dann Review
Erst auf seinen Zuruf in den Store-Review.

---

## Was heute passiert ist (Kurzfassung)

14 Commits. Die drei größten Sachen:

**Die Wurzel der Zähl-Fehler ist behoben.** Fünf Stellen zählten dieselben
Buchungen mit drei verschiedenen Bedeutungen — daher "0 von 21", "15 Konfis"
und ein Detail, das 23 zählte, wo die Liste 19 zeigte. Jetzt gibt es die View
`event_booking_stats` als einzige Quelle, mit verbindlicher Bedeutung im
Migrationskopf. Zwei Tests vergleichen View und Endpunkte direkt.

**Live-Aktualisierung.** Eine Regression vom 24.08. (In-flight-Dedupe
verschluckte Socket-Ereignisse) plus fehlende Empfänger in allen drei Bäumen.
In Produktion nachgemessen: Punktvergabe von außen, 14 auf 15 ohne Neuladen.

**Offline.** Der Hauptärger ("ich sehe die Liste, aber im Event ist alles 0 und
rot") war ein falscher Cache-Schlüssel: Liste und Detail luden dieselben Daten
unter verschiedenen Namen. Dazu Aktivitätenliste und Tageslosung gecacht.

Vollständig in `BAUSTELLEN.md` unter "Erledigt am 25.08.".

---

## Fallen, die diese Sitzung gekostet haben

- **Ein Agent starb mitten in der Gegenprobe** und hinterließ die Fixes
  ZURÜCKGENOMMEN bei grünen Tests daneben. Wer das ungeprüft committet, hat
  Tests im Repo, die nichts absichern. **Immer selbst nachprüfen, ob die
  Änderung wirklich drin ist**, nicht nur, ob die Tests grün sind.
- **Der Containername in CLAUDE.md ist veraltet.** Er heißt
  `konfi_quest-postgres-1`, nicht `konfi-quest-db-1`.
- **Image-Tags sind SIEBEN Zeichen**, nicht acht (`git rev-parse --short=7`).
- **`last_login_at` ist irreführend** — es zählt nur die Anmeldung mit
  Passwort. Wer angemeldet bleibt, aktualisiert es nie. Für "war jemand
  aktiv?" ist `chat_read_status.last_read_at` die belastbare Zahl.
- **Der sporadische Testabbruch ist belegt und NICHT behoben**: Termin-Routen
  schreiben nach `res.json()` weiter, supertest schließt zu früh
  (`Parse Error` / `socket hang up`). Trifft ~1 von 1200, wechselnd welchen.
  Vor dem Reparieren eines "roten" Tests immer den Lauf wiederholen.
- **`teamer_only` und `teamer_needed` schließen sich per CHECK aus.**

---

## Zugänge

- **Server:** `ssh root@server.godsapp.de`, Stack unter
  `/opt/stacks/portainer/compose/249/v220/docker-compose.yml`,
  Backups nach `/opt/Konfi-Quest/dump/`.
- **Datenbank:** `docker exec konfi_quest-postgres-1 psql -U konfi_user -d konfi_db`
- **Demo-Gemeinde (Org 4):** Passwort überall `KonfiDemo2026!`.
  **Nicht anfassen:** `review-*` und `google-test-*`.
- **Org 1 ist Simons ECHTE Gemeinde** — dort nichts zum Testen anlegen.
  Ausnahme: Test-Challenge id 17 ("TEST – Wo entdeckst du Gott?") liegt dort
  ohne Jahrgang-Zuweisung, sieht also kein Konfi. Auf Zuruf löschen.
