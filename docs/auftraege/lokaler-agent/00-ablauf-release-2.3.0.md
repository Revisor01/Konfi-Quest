# 00 — Ablauf Release 2.3.0: was wann passiert

Stand 27.09.2026. Diese Datei ist der Einstieg; die Einzelheiten stehen in
01–05. Sie liegt auch auf `main`, damit du ohne den Release-Branch anfangen
kannst.

## Das Wichtigste zuerst

**Ein Merge nach `main` ist der Produktions-Deploy.** `.github/workflows/ci.yml`
läuft bei jedem Push auf `main` (Pfade `backend/`, `frontend/`, …), testet,
baut die Images und tauscht die Backends in Produktion aus. Deshalb:

- Alles aus **Phase A** ist erledigt, **bevor** gemergt wird.
- **Den Merge gibt Simon frei.** Nicht selbst mergen, auch nicht, wenn alles
  grün ist.
- Ergebnisse, die du in diese Dateien schreibst (Kästchen, Zeile
  **Ergebnis**), dürfen direkt auf `main` — Änderungen nur in
  `docs/auftraege/` lösen keinen CI-Lauf und keinen Deploy aus. Alles andere
  (Code, Workflows, Compose-Referenz) per Pull Request.

## Wo der Release-Stand liegt

Bis zum Merge liegt 2.3.0 auf dem Branch `claude/fervent-edison-wp5yfj`.
Mehrere Dateien, auf die 01–05 verweisen, gibt es auf `main` erst nach dem
Merge: `deploy/rollend.sh`, `deploy/sicherung.sh`, `docs/betrieb/sicherung.md`,
die Audit-Berichte unter `docs/audit/2026-09-26/` und `2026-09-27/`,
`frontend/scripts/fehlerstellen-sql.mjs`. Zum Lesen einen eigenen Arbeitsbaum
anlegen und dort **nichts committen**:

```
git fetch origin claude/fervent-edison-wp5yfj
git worktree add ../kq-release origin/claude/fervent-edison-wp5yfj
```

Auf dem Branch arbeitet bis zum Merge noch die Entwicklung (vier Fixes, eine
Prüfung gegen die Store-App 2.2.x, dann ein Pull Request). Vor dem Merge also
noch einmal `git fetch`.

## Phase A — jetzt, vor dem Merge

Reihenfolge wie aufgeführt. Alles hier verträgt sich mit dem **alten** Code,
der bis zum Merge weiterläuft.

1. **Sicherung** — [01](01-vor-dem-deploy.md) Abschnitt 1. Ohne Sicherung
   nichts weiter.
2. **Portainer abgleichen, nur lesen** — [02](02-portainer-stack.md)
   Abschnitt 1: Live-Stack exportieren und gegen
   `deploy/compose.konfi_quest.yml` (Release-Branch) diffen. Die Variablen
   stehen schon in Portainer; prüfe, **wo** die Werte heute herkommen:
   - als Stack-Variablen in Portainer (Abschnitt „Environment variables"),
   - oder direkt eingetragen in der Stack-Datei.

   Die Referenz erwartet Stack-Variablen (`${SMTP_HOST:?…}`,
   `${JWT_SECRET:?…}` usw.). Bis zum 27.09. schickte **jeder** Deploy
   (`ci.yml`, `frontend.yml`, `notfall-deploy.yml`) beim Stack-Update
   `"env": []` — Portainer **ersetzt** die Stack-Variablen durch diese Liste
   (so liest es sich im Portainer-Quelltext; am eigenen Stack prüfen: Stehen
   nach dem letzten Deploy noch Stack-Variablen drin, und wenn ja, wie?).
   Gesetzte Variablen wären dann beim nächsten Deploy weg gewesen. Auf dem
   Release-Branch schicken alle drei die vorhandenen Variablen unverändert
   zurück. Deshalb: **Nichts** von „direkt in der Stack-Datei" auf
   Stack-Variablen umstellen, solange noch der alte Workflow auf `main`
   deployt. Erst nach dem Merge umstellen, dann mit dem neuen Workflow.
   Ergebnis: welche Variablen wo stehen (nur Namen, keine Werte).
3. **Mail** — [01](01-vor-dem-deploy.md) Abschnitt 2: Zertifikat des
   Mail-Servers gegen den Hostnamen prüfen; `SMTP_HOST`, `SMTP_USER`,
   `SMTP_PASS`, `SMTP_HOST_IP` mit dem Bestand abgleichen. Der neue Code hat
   **keinen** eingebauten Mail-Host mehr: Fehlt `SMTP_HOST` nach dem Deploy,
   gehen keine Mails raus. Absender mit Simon klären.
4. **Zählungen und Vorher-Messungen** — [01](01-vor-dem-deploy.md)
   Abschnitte 3–5. Nur Lese-Abfragen.
5. **Postgres** — [02](02-portainer-stack.md) Abschnitt 2 (Ressourcen,
   `command`, `pg_stat_statements`). Braucht einen Neustart von Postgres:
   Fenster mit Simon abstimmen. Der alte Code verträgt das.
6. **Umgebung der Backends vorbereiten** — [02](02-portainer-stack.md)
   Abschnitt 3 (`PG_POOL_MAX`, `PG_*`, `SHUTDOWN_DRAIN_MS`, `SMTP_*`,
   `extra_hosts`). Der alte Code liest `PG_POOL_MAX`, `PG_IDLE_TIMEOUT` und
   `PG_CONN_TIMEOUT` schon, die übrigen ignoriert er. Anwenden heißt beim alten
   Workflow: Stack-Datei ändern — also mit Schritt 2 abstimmen.
   **`TZ` nicht setzen** (siehe Kommentar in der Referenz): Produktion läuft
   in UTC, das Umschalten verschöbe gelesene Zeitwerte; erst nach Klärung durch
   die Entwicklung. **`RUN_BACKGROUND_JOBS=false` bei `backend2` bleibt stehen** —
   das kommt erst in Phase B weg.
7. **Rückmeldung an Simon:** Sicherung (Größe, Zeit), Zählungen, Ergebnis des
   Abgleichs, offene Punkte. Danach entscheidet Simon über den Merge.

**Stand 27.09.2026, 16:30:** Phase A ist durch. Schritte 1–4 siehe
[01](01-vor-dem-deploy.md) und [02](02-portainer-stack.md) Abschnitt 1.
Die Schritte 5 und 6 hat Simon sofort freigegeben; sie liefen in **einem**
Stack-Update um 16:25:58 (Ergebnis in [02](02-portainer-stack.md) Abschnitte
2 und 3). `TZ` ist nicht gesetzt, `RUN_BACKGROUND_JOBS=false` bei `backend2`
steht noch. Offen ist nur der Merge.

## Phase B — Merge und Deploy (Simon gibt frei)

1. Simon merged den Pull Request des Release-Branches nach `main`.
2. Den Lauf von `ci.yml` beobachten: Tests, Build, dann der zweistufige
   Deploy (`deploy/rollend.sh`) — [02](02-portainer-stack.md) Abschnitt 4
   (Sekundentakt auf `/api/status`, Fehlschläge zählen, Dauer je Stufe,
   `Migration FAILED` = 0).
3. Nach dem Deploy: `GET /api/status` → `version` = `2.3.0`, `commit` = Merge-SHA
   auf **beiden** Backends; Migrationen 160–168 eingespielt.
4. Erst jetzt: `RUN_BACKGROUND_JOBS=false` bei `backend2` entfernen —
   [02](02-portainer-stack.md) Abschnitt 5 (Cron-Leader prüfen, Übernahme
   messen).
5. [03](03-nach-dem-deploy.md): Nachher-Messungen, eine echte Mail
   („Passwort vergessen" mit einem Testkonto), Absender.
6. `backend-test` zieht beim Deploy nicht mit (der Deploy schreibt nur
   `backend`, `backend2` und `frontend` um, CI BF-03). Damit die Test-API zum
   neuen Stand passt: `test-backend.yml` einmal auf `main` laufen lassen.

**Wenn der Deploy scheitert:** Der Workflow `notfall-deploy.yml` rollt einen
früheren Image-Tag aus. Die Migrationen 160–168 sind additiv — der alte Code
läuft auf dem neuen Schema weiter. Vorher Simon Bescheid geben.

**Ausgelieferte Apps:** Die Store-Apps 2.2.x laufen gegen das neue Backend
weiter (Antwortformen gleich, nur neue Felder; die Prüfung dazu steht im Pull
Request). Wenn nach dem Deploy trotzdem etwas auffällt — Absturz nach dem
Login, leere Listen —, sofort Simon melden und den Notfall-Deploy vorbereiten.

## Phase C — Testbuilds (nach grünem CI-Lauf des Merge-Commits)

Beide Release-Workflows prüfen selbst, dass der Commit auf `main` liegt und
seine CI grün ist (Release-Tor). Die Build-Nummern stehen schon auf dem
nächsten Stand in `frontend/version.json` (Entwicklung hebt sie vor dem Pull
Request an); nichts von Hand ändern.

- **iOS:** `ios-release.yml` per „Run workflow" auf `main`, `api_url` **leer**
  (= Produktion). Der Build landet in TestFlight.
- **Android:** `android-release.yml` auf `main` mit `tracks: internal` —
  **nur** `internal`. `production` reicht sofort zur Prüfung ein und ist nicht
  umkehrbar (CI BF-16: der Upload veröffentlicht zu 100 %, Track-Namen werden
  nicht geprüft). Erst einmal mit `dry_run: true`, dann ohne.
- Ergebnis: Build-Nummern, Laufzeiten, Links auf die Läufe. Die Store-Freigabe
  macht Simon.

## Phase D — nach dem Deploy

- [03](03-nach-dem-deploy.md): Screenshots **nach** dem Deploy neu ziehen und
  jedes Bild ansehen; Log-Volumen; Umami bereinigen (Abschnitt 6) und
  Sitzungssalz sowie Ortsangaben prüfen.
- [04](04-ci.md): offene Workflow-Punkte.
- [05](05-sicherung-und-notfall.md): Sicherungs-Rhythmus, Rückspielprobe,
  Notfall-Deploy proben.
