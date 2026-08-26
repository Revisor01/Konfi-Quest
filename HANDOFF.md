# Handoff — Stand 25.08.2026, spätabends

**Simons Auftrag für diese Sitzung, wörtlich:**
> "Wenn das alles erledigt ist, will ich einen Build. Den teste ich, und dann
> pushen wir in die Review-Prozesse."

Der erste Teil ist erledigt: alles Offene abgearbeitet, deployt, nachgemessen,
**Build 143 gebaut**. Jetzt ist Simon dran.

Das laufende Register steht in **`BAUSTELLEN.md`**, die Prüfberichte in
**`docs/agenten-berichte/`**.

---

## Wo es weitergeht

### 1. Simon testet Build 143
Die Testinfos liegen fertig im Scratchpad
(`testflight-143.txt`, 14 Punkte mit Klickpfad und Erwartet-Zeile). **Sie sind
noch NICHT per ASC-API gesetzt** — das war nicht mehr zu schaffen, solange der
Build lief. Vor dem Verteilen an die Tester:innen nachholen, Testinfos sind
Pflicht.

### 2. Danach: Tag und Release
- CHANGELOG: `## [Unreleased] - 2.0.0` auf `## [2.0.0] - <Datum>` ändern.
  Das Datum steht bewusst noch nicht drin — es soll der Tag sein, an dem
  wirklich veröffentlicht wird, nicht der Tag der Vorbereitung.
- Git-Tag **ohne** `v`-Präfix (die alten `v2.x`-Tags sind ein anderes,
  ausgelaufenes Schema — die Releases heißen `1.5.3` usw.).
- GitHub-Release mit den Store-Texten aus `docs/store-texte-2.0.0.md`.

### 3. Erst danach Store-Review
Auf Simons Zuruf.

---

## Was in dieser Sitzung passiert ist

**Ausgerollt und nachgemessen.** Produktion lief auf `6721eec` und liegt jetzt
auf `90592c5` — die gesamte Arbeit vom 25.08. ist live. Sicherung vorher
(2,2 MB), Migration 128 angewandt, View `event_booking_stats` da.
Die geforderte Messung stimmt: Termin 105 zeigt **19 Konfis, 4 Teamer:innen,
2 Abmeldungen**. Gegenprobe über sechs Demo-Termine: Liste, Detail und View
nennen überall dieselben Zahlen.

**Store-Texte** (`docs/store-texte-2.0.0.md`) — 157 Changelog-Einträge auf zwei
Texte eingedampft, iOS 1828 Zeichen, Android 467 von 500 erlaubten.
Zeichenzahlen nachgezählt, keine Emojis, echte Umlaute.

**Bildschirmfotos als Skript** (`scripts/screenshots.mjs`) — 19 Aufnahmen aus
der Demo-Gemeinde über alle drei Rollen. Wiederholbar, damit sie nicht
veralten: `node scripts/screenshots.mjs [--rolle konfi] [--geraet ipad]`.

**Handbuch** — QR-Einladung und QR-Check-in vollständig beschrieben (bisher nur
Randnotizen), Querverweise zwischen den Kapiteln, und 16 Bildschirmfotos in den
drei Rollenkapiteln. Der Generator kann jetzt Bilder und bricht ab, wenn eines
fehlt.

---

## Zwei Nebenbefunde, bewusst nicht behoben

- **Teamer:innen sehen den Termin-QR-Code nicht.** `QRDisplayModal` hängt nur
  im Admin-Baum, obwohl das Backend den Abruf per `requireTeamer` erlaubt.
  Sind bei einem Termin nur Teamer:innen da, kommen sie nicht an den Code.
  Im Handbuch vorerst als Ist-Zustand beschrieben. Wäre einen eigenen Fix wert,
  aber nicht kurz vor einem Build, den Simon testen soll.
- **Dependabot 123** (`uuid` < 11.1.1, mittel). Geprüft: hängt nur an
  `@capacitor/cli`, einer devDependency — das Paket landet nicht in der App.
  Der App-Code nutzt den eigenen Helfer `utils/uuid.ts` auf Web-Crypto-Basis.
  Werkzeug-Problem, kein Nutzerrisiko. Beim nächsten Capacitor-Update mitziehen.

---

## Fallen, die weiter gelten

- **Ein Agentenbericht ist eine Behauptung.** In dieser Sitzung hat sich das
  wieder bestätigt: Der Handbuch-Agent meldete zwei angebliche Doku-Fehler —
  beide stimmten, waren aber gegen den Code nachzuprüfen, bevor sie ins
  Handbuch wanderten.
- **Der Containername in CLAUDE.md ist veraltet.** Er heißt
  `konfi_quest-postgres-1`, nicht `konfi-quest-db-1`.
- **Die Migrationstabelle heißt `schema_migrations`**, nicht `migrations`.
- **Image-Tags sind SIEBEN Zeichen** (`git rev-parse --short=7`).
- **Beim Deploy melden beide Backend-Container "Migrations".** Der zweite sagt
  "keine neuen" — das ist normal, der erste hat sie schon angewandt. Nicht als
  Fehler lesen, sondern in `schema_migrations` nachsehen.
- **Der sporadische Testabbruch ist belegt und NICHT behoben**: Termin-Routen
  schreiben nach `res.json()` weiter, supertest schließt zu früh. Trifft ~1 von
  1200, wechselnd welchen. Vor dem Reparieren eines "roten" Tests den Lauf
  wiederholen.
- **`teamer_only` und `teamer_needed` schließen sich per CHECK aus.**
- **`last_login_at` ist irreführend** — es zählt nur die Anmeldung mit
  Passwort. Für "war jemand aktiv?" ist `chat_read_status.last_read_at` die
  belastbare Zahl.

---

## Zugänge

- **Server:** `ssh root@server.godsapp.de`, Stack unter
  `/opt/stacks/portainer/compose/249/v220/docker-compose.yml`
  (die Fassung vor dem Deploy liegt daneben als `.bak-6721eec`),
  Backups nach `/opt/Konfi-Quest/dump/`.
- **Datenbank:** `docker exec konfi_quest-postgres-1 psql -U konfi_user -d konfi_db`
- **Demo-Gemeinde (Org 4):** Passwort steht in `~/.claude/secrets.env`
  (`KONFI_DEMO_PASSWORT`) — bewusst nicht hier, das Repo ist öffentlich.
  **Nicht anfassen:** `review-*` und `google-test-*`.
- **Org 1 ist Simons ECHTE Gemeinde** — dort nichts zum Testen anlegen.
