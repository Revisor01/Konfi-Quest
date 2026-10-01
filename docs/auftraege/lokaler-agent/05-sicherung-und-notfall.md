# 05 — Sicherung, Rückspielprobe, Notfall-Deploy

Mit einer gemeinsamen Datenbank für alle Gemeinden ist ein Datenverlust der
Verlust aller Gemeinden. Befunde: Datenbank BF-05
(`docs/audit/2026-09-26/datenbank-migrationen.md`), CI BF-10
(`ci-deployment-store.md`), `docs/offene-befunde.md` Nr. 3. Die Beschreibung
steht in [docs/betrieb/sicherung.md](../../betrieb/sicherung.md), das Skript in
`deploy/sicherung.sh`.

## 1. Rhythmus und Aufbewahrung einrichten

- [x] Nächtliche Sicherung nach `docs/betrieb/sicherung.md` (Datenbank,
      Uploads) per Cron oder Timer am Host; Ablage außerhalb des Servers.
      **Ergebnis 01.10.2026:** besteht, nicht neu eingerichtet. Cron am Host
      um 02:30, im Log seit 01.09. jede Nacht „Backup ok" außer 10.09.
      (Ausfallnacht, damals als Fehler gemeldet). Jüngster Dump 30.09. 02:30,
      686.954 Byte, bei der Messung 22 h alt; Laufzeit laut Log 1–2 s.
      Außerhalb des Servers: das tägliche Datei-Backup des Hosts (gegen
      03:15, letzter Stand 30.09.) nimmt das Verzeichnis mit Dumps **und**
      Uploads mit, ein zweites Ziel wöchentlich (letzter Stand 28.09.).
      Abweichungen vom Soll, Entscheidung bei Simon: (1) das Skript schreibt
      reines SQL (`pg_dump --clean --if-exists | gzip`), nicht `-Fc` —
      `deploy/wiederherstellung.sh` liest es nicht (Weg für diesen Fall jetzt
      in `sicherung.md`); (2) 02:30 liegt im Fenster 02:00–03:30 (bei 1–2 s
      Laufzeit folgenlos gemessen); (3) Uploads nur über das Datei-Backup,
      nicht im nächtlichen Skript.
- [ ] Aufbewahrung wie dort beschrieben; alte Sicherungen werden automatisch
      entfernt.
      **Ergebnis 01.10.2026:** teilweise. Am Host bleiben die letzten 14
      Dumps (gezählt: 14 Dateien, 17.–30.09.), älteres löscht das Skript.
      Die Wochen- und Jahresstände des Solls gibt es am Host nicht; ob die
      Aufbewahrung des Datei-Backups sie abdeckt, ist nicht gemessen.
- [x] Überwachung: Bleibt eine Sicherung aus oder ist sie verdächtig klein,
      kommt eine Meldung (gleicher Weg wie „rotes main" in [04](04-ci.md)).
      **Ergebnis 01.10.2026:** besteht. Eine tägliche Prüfung am Host meldet
      per Push an Simon, wenn kein Dump jünger als 36 h ist, ein frischer
      Dump unter 2 kB liegt oder das Datei-Backup zu alt ist (seit 10.09.
      prüft sie auch das Konfi-Quest-Verzeichnis auf Größe).
- [ ] Geheimnisse der Stack-Umgebung (Liste in `sicherung.md`) liegen in einer
      Passwortverwaltung — ohne `ACTIVITY_PHOTO_ENCRYPTION_KEY` sind die
      verschlüsselten Fotos nach einer Wiederherstellung unlesbar.
      **Ergebnis 01.10.2026:** nicht prüfbar (Passwortverwaltung liegt bei
      Simon). Gemessen: Der Schlüssel aus der Stack-Umgebung öffnet alle 408
      verschlüsselten Dateien der zurückgespielten Uploads (Rückspielprobe
      unten); die Stack-Werte liegen außerdem im Datei-Backup des Hosts.

## 2. Rückspielprobe

- [x] Die jüngste Sicherung in eine **leere** Datenbank auf einem
      Wegwerf-Container zurückspielen, genau nach dem Weg in `sicherung.md`
      (nicht über `init-scripts/` — das legte beim Versuch am 26.09. schon
      das Schema an und erzeugte 2.825 Fehlerzeilen).
      **Ergebnis 01.10.2026:** Wegwerf-Container `postgres:15-alpine` (15.19
      wie Produktion, ohne `init-scripts/`) neben der Produktion auf dem
      Server. Zwei Proben: (a) der echte nächtliche Dump vom 30.09. (SQL,
      686.954 Byte gepackt, 3.336.906 Byte entpackt) per
      `psql -v ON_ERROR_STOP=1` in eine leere Datenbank: **1,25 s, 0
      Fehlerzeilen**; (b) eine frische Sicherung mit `deploy/sicherung.sh`
      (`-Fc` 931.258 Byte, Uploads 247.603.987 Byte, zusammen 10,9 s) mit
      `deploy/wiederherstellung.sh`: **1 s Einspielen, 2,2 s gesamt**, Ende
      „OK", jüngste Migration `185_push_tokens_app_symbol_weg.sql`.
- [x] Prüfen: Zeilenzahlen der großen Tabellen gleich der Quelle, ein
      Backend gegen die Kopie startet ohne `Migration FAILED`, eine Anmeldung
      mit einem Testkonto klappt, ein verschlüsseltes Foto lässt sich öffnen.
      **Ergebnis 01.10.2026:** (b) **alle 62 Tabellen zeilengleich** mit der
      Produktion direkt nach der Sicherung (u. a. 169 Konten, 135
      Konfi-Profile, 226 Termine, 1.500 Buchungen, 892 Chat-Nachrichten, 108
      Migrationen); (a) 62 Tabellen, Abweichungen nur um die 22 h seit dem
      Dump (z. B. 884 statt 892 Chat-Nachrichten). Schema beider Kopien
      gegen die Produktion: `Gleich` (62 Tabellen, 556 Spalten, 241
      Constraints, 215 Indizes). Backend `e6a3d38` gegen die Kopie (ohne
      Hintergrund-Jobs, ohne SMTP und Firebase): „Migrations: keine neuen
      (108 total)", `Migration FAILED` 0, `/api/status` `migrations: ok`;
      Anmeldung `demo.teamer` und `demo.emilia` je HTTP 200. Uploads aus dem
      Archiv zurück: 411 von 411 Dateien, inhaltsgleich; **408 von 408
      verschlüsselten Dateien entschlüsselt** (366 JPEG, 17 PNG, 17 PDF, 8
      sonstige), 0 Fehler.
- [x] Dauer der Wiederherstellung messen und in `sicherung.md` eintragen
      (ohne Adressen).
      **Ergebnis 01.10.2026:** eingetragen (Abschnitt „Rückspielprobe",
      gemessen): Datenbank 1–2 s, Uploads 2,4 s.
- [x] Wegwerf-Container und Kopie danach löschen.
      **Ergebnis 01.10.2026:** Container, Netz, Probe-Dateien (Sicherung,
      Uploads-Kopie) und das eigens gezogene Image entfernt; nachgezählt 0.
      Die Produktion wurde nur gelesen.

## 3. Notfall-Deploy proben (CI BF-10)

`.github/workflows/notfall-deploy.yml` ist der Rückrollweg und wurde nie
ausgeführt.

**Stand 29.09.2026 (Repo):** Der Workflow rollt über `deploy/rollend.sh` aus,
dasselbe Skript wie jeder CI-Deploy (zwei Stufen, Warten auf gesund, Verify
gegen den vollen Commit), hat `packages: read` und läuft in derselben
`concurrency`-Gruppe wie der CI-Deploy. Neu ist die Eingabe **`probelauf`**:
Sie geht denselben Weg bis unmittelbar vor `update_stack` (Image auf ghcr,
Portainer-Zugang, Tag-Umschreibung auf einer Kopie, Gegenprobe auf
`backend-test`, Status) und ändert nichts. Gegen eine nachgebaute
Portainer-API getestet (`frontend/src/__tests__/betrieb/rollenderDeploy.test.ts`).

- [x] Zuerst den **Probelauf** auslösen, ohne Rücksprache möglich:
      `gh workflow run notfall-deploy.yml --ref main -f grund="Probelauf" -f probelauf=true`
      (Tag leer = jüngster `main`-Stand mit gebauten Images; zusätzlich einmal
      mit dem Tag des vorigen Deploys). Erwartet: grün, im Log „OK Probelauf",
      die drei Dienste mit `alt -> neu`, `backend-test` unverändert. Die Zahl
      der Stack-Variablen ist **0**, solange alle Werte direkt in der
      Stack-Datei stehen ([02](02-portainer-stack.md), Ergebnis 27.09.) — eine
      Zahl über 0 heißt, jemand hat inzwischen Stack-Variablen angelegt; die
      schickt das Skript unverändert mit.
      **Ergebnis 30.09.2026 (Koordination, Freigabe Simon):**
      - *Rückrollweg auf den vorigen Deploy* (`image_tag=67c03dc`, Lauf
        Notfall-Deploy #1): **grün in 24 s.** Beide Images auf ghcr gefunden,
        Portainer-Zugang ok, Umschreibung `backend`, `backend2`, `frontend`
        jeweils `76178ec -> 67c03dc`, `backend-test` bleibt `test-latest`,
        Stack-Variablen 0, alle drei Container `healthy`, Live-Status meldete
        weiter `76178ec0…` mit `uptimeSeconds` 3995 — **nichts geändert**,
        „update_stack wurde NICHT aufgerufen".
      - *Tag leer* (Lauf #2): **rot, sicher abgebrochen.** Leer hieß bis
        hierher „HEAD", und HEAD war `7d8e945` — ein Commit nur an
        `docs/auftraege/`, für den der Pfadfilter keine Images baut. Meldung
        „Image konfi-quest-backend:7d8e945 existiert nicht auf ghcr", Produktion
        unverändert. Behoben am selben Tag: `deploy/notfall-tag.sh` sucht bei
        leerem Tag rückwärts den jüngsten Commit, zu dem **beide** Images
        liegen (Tests `frontend/src/__tests__/betrieb/notfallTag.test.ts`).
        Wirkt, sobald der Fix auf `main` ist.
- [x] Nach dem Merge des Fixes einmal den Probelauf mit **leerem Tag**
      wiederholen. Erwartet: grün, im Log die übersprungenen Doku-Commits
      („keine Images … weiter zurück") und als Stand der zuletzt gebaute.
      **Ergebnis 01.10.2026 (Lauf Notfall-Deploy #3):** **grün in 19 s.**
      „Kein Tag angegeben -> juengster Stand mit gebauten Images", Stand
      `e6a3d38` — zugleich HEAD von `main`, deshalb keine übersprungenen
      Commits im Log (der Suchpfad ist durch `notfallTag.test.ts` belegt).
      `backend`, `backend2`, `frontend` je `e6a3d38 -> e6a3d38`,
      `backend-test` bleibt `test-latest`, Stack-Variablen 0, alle drei
      `healthy`, „update_stack wurde NICHT aufgerufen". Vorher geprüft, dass
      der Probelauf nur liest (`rollend.sh` endet vor dem ersten Schreiben)
      und dass kein Deploy in der Gruppe `deploy-production` lief oder
      wartete — ein wartender CI-Deploy würde sonst durch den Probelauf
      ersetzt.
- [ ] Einmal bewusst mit dem aktuellen `main`-Stand auslösen (idempotent —
      derselbe Stand wird erneut ausgerollt). Vorher Simon Bescheid geben.
      **Stand 01.10.2026:** vorbereitet, nicht ausgelöst — wartet auf Simons
      Ansage und darauf, dass die Arbeit an der Deploy-Lücke ([10](10-deploy-luecke.md))
      ruht. Befehl: `gh workflow run notfall-deploy.yml --ref main -f
      grund="Idempotenter Notfall-Lauf" -f probelauf=false` (Tag leer =
      `e6a3d38`, solange nichts Neues gebaut ist).
- [ ] Beobachten: Läuft er durch, wie lange, gibt es eine Lücke? Braucht der
      Workflow Rechte, die ihm fehlen (`permissions:`)?
- [ ] Danach im Ernstfall-Sinn prüfen: Wie rollt man auf den **vorigen**
      Stand zurück, wenn eine Migration schon gelaufen ist? (Migrationen sind
      additiv — der alte Code muss mit dem neuen Schema laufen. Einmal den
      Stand von 2.2.x gegen eine Kopie der Datenbank nach 2.3.0 starten und
      das Ergebnis eintragen.)
      **Ergebnis 01.10.2026:** Der zuletzt vor 2.2.0 gebaute Stand `2d2e54d`
      (ein Commit vor dem Tag, Migrationen bis 155) gegen eine Kopie der
      Datenbank nach 2.3.0 (108 Migrationen bis 185): startet, „Migrations:
      keine neuen (85 total)", 0 SQL-Fehler im Log; Anmeldung für Teamer:in,
      Konfi und Leitung je HTTP 200, 33 Lese-Abfragen (Termine, Chat,
      Dashboard, Abzeichen, Konfis, Einstellungen) ohne eine 500. Geprüft am
      Code: 174 (Schlüssel `(organization_id, key)`) nutzt 2.2 schon so, 185
      ist additiv. Schreibwege nicht probiert. Rückrollen auf 2.2.x nach den
      Migrationen 156–185 geht demnach.
      **Nachtrag 01.10.2026 (Cloud):** Migration 187 entfernt
      `konfi_profiles.password_plain`. Der Stand 2.2.x setzt die Spalte beim
      „Einmalpasswort erzeugen" auf NULL; nach 187 scheitert auf dem Rückweg
      genau dieser Schreibweg (500, die Transaktion rollt zurück, das alte
      Passwort gilt weiter). Lesen und alle anderen gemessenen Wege
      betrifft es nicht.
