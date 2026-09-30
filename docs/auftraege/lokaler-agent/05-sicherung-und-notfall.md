# 05 — Sicherung, Rückspielprobe, Notfall-Deploy

Mit einer gemeinsamen Datenbank für alle Gemeinden ist ein Datenverlust der
Verlust aller Gemeinden. Befunde: Datenbank BF-05
(`docs/audit/2026-09-26/datenbank-migrationen.md`), CI BF-10
(`ci-deployment-store.md`), `docs/offene-befunde.md` Nr. 3. Die Beschreibung
steht in [docs/betrieb/sicherung.md](../../betrieb/sicherung.md), das Skript in
`deploy/sicherung.sh`.

## 1. Rhythmus und Aufbewahrung einrichten

- [ ] Nächtliche Sicherung nach `docs/betrieb/sicherung.md` (Datenbank,
      Uploads) per Cron oder Timer am Host; Ablage außerhalb des Servers.
- [ ] Aufbewahrung wie dort beschrieben; alte Sicherungen werden automatisch
      entfernt.
- [ ] Überwachung: Bleibt eine Sicherung aus oder ist sie verdächtig klein,
      kommt eine Meldung (gleicher Weg wie „rotes main" in [04](04-ci.md)).
- [ ] Geheimnisse der Stack-Umgebung (Liste in `sicherung.md`) liegen in einer
      Passwortverwaltung — ohne `ACTIVITY_PHOTO_ENCRYPTION_KEY` sind die
      verschlüsselten Fotos nach einer Wiederherstellung unlesbar.

## 2. Rückspielprobe

- [ ] Die jüngste Sicherung in eine **leere** Datenbank auf einem
      Wegwerf-Container zurückspielen, genau nach dem Weg in `sicherung.md`
      (nicht über `init-scripts/` — das legte beim Versuch am 26.09. schon
      das Schema an und erzeugte 2.825 Fehlerzeilen).
- [ ] Prüfen: Zeilenzahlen der großen Tabellen gleich der Quelle, ein
      Backend gegen die Kopie startet ohne `Migration FAILED`, eine Anmeldung
      mit einem Testkonto klappt, ein verschlüsseltes Foto lässt sich öffnen.
- [ ] Dauer der Wiederherstellung messen und in `sicherung.md` eintragen
      (ohne Adressen).
- [ ] Wegwerf-Container und Kopie danach löschen.

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
- [ ] Nach dem Merge des Fixes einmal den Probelauf mit **leerem Tag**
      wiederholen. Erwartet: grün, im Log die übersprungenen Doku-Commits
      („keine Images … weiter zurück") und als Stand der zuletzt gebaute.
- [ ] Einmal bewusst mit dem aktuellen `main`-Stand auslösen (idempotent —
      derselbe Stand wird erneut ausgerollt). Vorher Simon Bescheid geben.
- [ ] Beobachten: Läuft er durch, wie lange, gibt es eine Lücke? Braucht der
      Workflow Rechte, die ihm fehlen (`permissions:`)?
- [ ] Danach im Ernstfall-Sinn prüfen: Wie rollt man auf den **vorigen**
      Stand zurück, wenn eine Migration schon gelaufen ist? (Migrationen sind
      additiv — der alte Code muss mit dem neuen Schema laufen. Einmal den
      Stand von 2.2.x gegen eine Kopie der Datenbank nach 2.3.0 starten und
      das Ergebnis eintragen.)
