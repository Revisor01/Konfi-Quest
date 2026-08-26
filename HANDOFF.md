# Handoff — Stand 26.08.2026, abends

Simons Reihenfolge: **erst die vier PRs zusammenführen, dann Store-Review.**

Das laufende Register steht in `BAUSTELLEN.md`, die Prüfberichte in
`docs/agenten-berichte/`.

---

## ZUERST: die vier offenen PRs

Alle vier stammen aus der Löschlogik-Prüfung vom 26.08. Sie sind fachlich
fertig und getestet, aber **noch nicht zusammengeführt**.

| PR | Inhalt | Branch |
|---|---|---|
| **#72** | Blockierte Löschwege öffnen, letzter Org-Admin geschützt | `fix/loeschwege-blockiert` |
| **#73** | Termin-Löschen rechnet Punkte zurück, Warnung erreicht Nutzer:innen | `fix/termin-loeschen-sauber` |
| **#74** | Dateien verwaisen nicht mehr beim Löschen | `fix/verwaiste-dateien` |
| **#75** | Beitrag endgültig löschen, Team-Chat leeren, Level-409 | `feat/beitrag-loeschen-und-aufraeumen` |

### Empfohlene Merge-Reihenfolge

**#72 → #73 → #74 → #75.**
Grund: #72 und #73 fassen andere Dateien an als #74/#75. Die Konflikte
entstehen erst zwischen den letzten beiden.

**Erwartete Konflikte zwischen #74 und #75** (klein, beide Seiten additiv):
`backend/routes/chat.js`, `backend/tests/routes/chat.test.js`,
`docs/api/chat-challenges.yaml`, `CHANGELOG.md`.
Beim CHANGELOG: **beide** Einträge behalten, nicht einen wegwerfen.

### Nach jedem Merge

Die drei Doku-Generatoren laufen lassen, sonst wird die CI rot:

    node scripts/build-handbuch.mjs
    node scripts/build-api-docs.mjs
    node scripts/build-openapi.mjs

### Ein Vorbehalt, der ernst zu nehmen ist

Drei Agenten haben versehentlich im **selben Arbeitsverzeichnis** gearbeitet
(mein Einrichtungsfehler — richtig wäre `isolation: "worktree"` gewesen).
Die Arbeit ist vollständig und in den PRs sauber getrennt, aber:

**Die Testläufe fanden teils mit fremden Änderungen im Verzeichnis statt.**
"Grün" heißt hier "grün mit Fremdanteil". Nach dem Merge muss die CI das
noch einmal sauber bestätigen — nicht auf die Angaben in den PRs verlassen.

Ein lokaler Branch `rettung/dateiwaisen-f8ff5648` diente der Rettung während
der Kollision. Inhalt ist in PR #74 enthalten; **nach dem Merge löschen.**

---

## Danach: Store-Review

1. **Deployen** — nach den Merges auf den neuen Stand.
2. **Neuer Build** — der letzte ist 147 (`109d4e0`, in TestFlight, Testinfos
   gesetzt). Er hat die vier PRs noch nicht.
3. **Testinfos** per ASC-API setzen. Limit **4000 Zeichen**, wird schnell
   erreicht — ältere, schon geprüfte Punkte rausnehmen.
4. **Tag und GitHub-Release** — Tag ohne `v`-Präfix (die alten `v2.x` sind ein
   ausgelaufenes Schema; Releases heißen `1.5.3` usw.).
5. **CHANGELOG**: `## [Unreleased] - 2.0.0` auf `## [2.0.0] - <Datum>` ändern.
   Das Datum steht bewusst noch nicht drin — es soll der echte
   Veröffentlichungstag sein.

---

## Was aus der Löschprüfung bewusst OFFEN bleibt

- **Abzeichen aberkennen** — werden nach Punktkorrekturen nie entzogen. Simon
  will das getrennt besprechen, **nicht nebenbei umsetzen.**
- **Waisen-Cleanup-Skript** für Altbestand: Dateien, die vor diesen Fixes
  liegengeblieben sind, räumt niemand auf. Nur manuell und blind für
  `uploads/challenges/`.
- **Nicht-atomare Reihenfolge** "DB zuerst, Datei danach": bewusst so gelassen.
  Bricht der Prozess dazwischen ab, bleibt eine Datei liegen — das ist besser
  als ein gescheitertes Löschen.
- **Schema-Test** als Vorschlag aus dem Bericht: "Jeder Fremdschlüssel auf
  `users`/`organizations` hat entweder eine ON-DELETE-Regel oder steht in der
  Löschliste." Hätte K1, M1 und die historischen `user_certificates`-Fälle
  alle gefunden. **Der wirksamste Hebel gegen Wiederholung.**

---

## Entscheidungen vom 26.08., die nicht verloren gehen dürfen

- **Nachrichten-Löschen bleibt Soft-Delete.** Bewusst: Simon will rechtlich
  relevante Inhalte als Admin wiederherstellen können. Das "unwiderruflich"
  in der Oberfläche ist verkürzt, aber gewollt — nur Admins dürfen überhaupt
  löschen. **Nicht "reparieren".**
- **Teamer:innen dürfen Termine anlegen, bearbeiten UND löschen.**
  Designentscheidung ("eröffnet den Teamer:innen Selbstständigkeit").
  Sollte im Handbuch und auf der Website so stehen — **noch zu prüfen.**
- **Ausblenden und Löschen bei Challenge-Beiträgen sind zwei Dinge.**
  Ausblenden hebt auf, Löschen entfernt Eintrag und Datei.
- **Level umbenennen funktioniert** (belegt: vergebene Level hängen an
  `current_level_id`, nicht am Namen). Löschen bleibt gesperrt, jetzt mit
  verständlicher 409-Meldung.

---

## Zwei Befunde, die im Bericht falsch waren

Beide beim Nachprüfen widerlegt — als Mahnung, Berichte gegen den Code zu
prüfen:

- **"Abgelehnter Konfi-Antrag lässt Foto verwaisen"** — stimmt nicht,
  `activities.js:378-382` räumt längst auf. Die **echte** Lücke lag bei der
  Beförderung Konfi→Teamer (`konfi-management.js`) und stand in keinem
  Bericht. In PR #74 behoben.
- **"Event-Chat wird beim Termin-Löschen nicht aufgeräumt"** — stimmt nicht,
  war schon vollständig da inklusive Dateien. In PR #73 nur mit Tests
  abgesichert, nichts doppelt gebaut.

---

## Fallen, die weiter gelten

- **Ein Agentenbericht ist eine Behauptung.** Siehe oben: zwei von zwölf
  Befunden waren falsch.
- **Nie mehrere Agenten im selben Checkout.** `isolation: "worktree"` nutzen.
- **Containername:** `konfi_quest-postgres-1` (CLAUDE.md ist veraltet).
- **Migrationstabelle:** `schema_migrations`, nicht `migrations`.
- **Image-Tags sind SIEBEN Zeichen** (`git rev-parse --short=7`).
- **Beim Deploy melden beide Backend-Container "Migrations".** Der zweite sagt
  "keine neuen" — normal, der erste hat sie schon angewandt.
- **bcrypt-Hashes nie durch die Shell reichen** — die `$`-Teile aus `$2b$10$`
  werden gefressen, der Hash landet verstümmelt in der DB und NIEMAND kann
  sich mehr anmelden. Über eine SQL-Datei einspielen, danach beide Fälle
  prüfen: neues Passwort geht, altes scheitert.
- **Keine Secrets ins Repo** — es ist öffentlich. Passwörter über
  Umgebungsvariablen (`KONFI_DEMO_PASSWORT`), Betriebsdoku auf den Server.
- **Sporadischer Testabbruch** ist stark zurückgegangen (Keep-Alive im
  Testlauf aus), trifft aber noch gelegentlich einen Test. Vor dem Reparieren
  eines "roten" Tests den Lauf wiederholen.

---

## Werkzeuge, die es jetzt gibt

- `node scripts/drei-ansichten.mjs` — öffnet Leitung, Teamer:in und Konfi
  nebeneinander, angemeldet. `--url https://konfi-quest.de` für Produktion.
  Braucht `source ~/.claude/secrets.env`.
- `node scripts/screenshots.mjs` — 19 Bildschirmfotos aus der Demo-Gemeinde,
  wiederholbar. Ebenfalls mit gesetztem `KONFI_DEMO_PASSWORT`.
- Notfall-Anleitung für den Serverausfall liegt **auf dem Fahrtenbuch-Server**
  unter `/opt/konfi-quest/NOTFALL.md` — bewusst nicht im Repo.

---

## Zugänge

- **Server:** `ssh root@server.godsapp.de`, Stack unter
  `/opt/stacks/portainer/compose/249/v220/docker-compose.yml`,
  Backups nach `/opt/Konfi-Quest/dump/`.
- **Datenbank:** `docker exec konfi_quest-postgres-1 psql -U konfi_user -d konfi_db`
- **Demo-Gemeinde (Org 4):** Passwort in `~/.claude/secrets.env`
  (`KONFI_DEMO_PASSWORT`), am 26.08. rotiert.
  **Nicht anfassen:** `review-*` und `google-test-*`.
- **Org 1 ist Simons ECHTE Gemeinde** — dort nichts zum Testen anlegen.
