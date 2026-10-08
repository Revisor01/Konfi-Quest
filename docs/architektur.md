# Architektur

Wie die Teile von Konfi Quest zusammenhängen. Jede Aussage ist am Code
belegt (Stand 02.10.2026); Adressen, Zugangsdaten und Serverpfade stehen
absichtlich nicht hier.

## Gemeinden und Rollen

- **Alle Gemeinden in einer Datenbank.** Jede Gemeinde ist eine Zeile in
  `organizations`; fast jede Tabelle trägt `organization_id`, und jede Route
  liest und schreibt nur in der aktiven Gemeinde (Simons Entscheidung vom
  26.09.2026, ausgelegt auf Gemeinden bis 150 Teilnehmende).
- **Rolle je Gemeinde.** Ein Konto hat eine Stamm-Gemeinde mit Rolle
  (`users.organization_id`, `users.role_id`) und kann in weiteren Gemeinden
  mit eigener Rolle mitarbeiten (`user_organizations`). Beide Quellen liest
  `backend/utils/orgMitglieder.js`. Rollen: `org_admin` (Gemeindeleitung),
  `admin` (Leitung), `teamer`, `konfi`. Ein Konto ist Konfi **oder** Team, nie
  beides (`backend/utils/konfiOderTeam.js`). Super-Admin ist ein Merkmal am
  Konto (`users.is_super_admin`), keine Rolle.
- **Jahrgänge.** Leitung und Team sehen nur ihre zugewiesenen Jahrgänge
  (`user_jahrgang_assignments`, `can_view`/`can_edit`), die Gemeindeleitung
  alles ihrer Gemeinde. Wer was sieht und gemeldet bekommt, regelt
  [CLAUDE.md](../CLAUDE.md) („Wer sieht und bekommt was"); je Vorgang liest
  eine Regel-Stelle Liste, Zähler und Empfänger, etwa
  `backend/utils/challengeLeitungSicht.js`.
- **Aktive Gemeinde.** Die App schickt sie im Header `X-Active-Organization`;
  nach dem Wechsel (`POST /auth/switch-org`) steht sie auch als Claim im
  Zugriffstoken. `backend/middleware/rbac.js` prüft bei jeder Anfrage die
  Mitgliedschaft in dieser Gemeinde.

## Backend

- **Node und Express 5** (`backend/server.js`, Routen in `backend/createApp.js`
  eingehängt), Anmeldung mit JWT (Zugriffstoken 15 Minuten, dazu
  Refresh-Tokens, höchstens eines je Gerät), Rechte je Route über
  `backend/middleware/rbac.js`. Die
  Node-Fassung steht in `.nvmrc`.
- **Zwei Replicas** `backend` und `backend2` hinter Traefik. Echtzeit (Chat,
  Live-Zähler) über Socket.IO mit dem Postgres-Adapter, sodass beide Replicas
  dieselben Ereignisse verteilen. Grenzen gegen Missbrauch zählen in der
  Tabelle `rate_limit_zaehler`, also über beide Replicas.
- **Cron-Leader.** Hintergrund-Jobs (Erinnerungen, Zahl am App-Symbol,
  Auto-Löschung, Lizenz-Mails, Jahresrückblick, Aufräumen; `node-cron` in
  `backend/services/backgroundService.js`) fährt genau eine Replica: Wer den
  Postgres-Advisory-Lock hält (`backend/utils/cronLeader.js`), ist Leader;
  fällt sie aus, übernimmt die andere im nächsten Takt.
  `RUN_BACKGROUND_JOBS=false` heißt „nie" (eine Instanz, die weder Jobs
  fährt noch Mail sendet; im Stack setzt es derzeit kein Dienst). Sichtbar in
  `GET /api/status` (`cron_leader`).
- **Kein Test-Backend.** Jede App — Store, TestFlight, interner Testtrack —
  spricht mit der Produktion. Das frühere Test-Backend (eigener Hostname,
  dieselbe Datenbank, dieselben Schlüssel) ist seit dem 08.10.2026
  abgeschafft (Simons Entscheidung); die fünf TestFlight-Builds, die darauf
  zeigten (153–158), wurden vorher abgelaufen gelassen.
- **Uploads** liegen in einem Host-Verzeichnis, das alle Backends einhängen;
  Nachweisfotos und Challenge-Dateien sind verschlüsselt
  (`backend/utils/photoCrypto.js`, Schlüssel `ACTIVITY_PHOTO_ENCRYPTION_KEY`).
- **Mails** über SMTP (`backend/services/emailService.js`, nodemailer);
  Massenläufe gedrosselt (`SMTP_MASSEN_JE_MINUTE`).

## Datenbank

- **PostgreSQL 15** (`postgres:15-alpine`, per Digest festgehalten in
  `deploy/compose.konfi_quest.yml`).
- **Neue Instanz:** `init-scripts/01-create-schema.sql` ist ein
  `pg_dump --schema-only`-Stand, `02-migrationsstand.sql` vermerkt die darin
  enthaltenen Migrationen ([init-scripts/README.md](../init-scripts/README.md)).
- **Migrationen** in `backend/migrations/` laufen beim Start jedes Backends
  unter einem Advisory-Lock (`backend/utils/migrationslauf.js`); vermerkt wird
  nach Dateinamen in `schema_migrations`. Sie sind additiv, damit ausgelieferte
  Apps und ein zurückgerollter Code weiterlaufen.
- **Sicherung und Wiederherstellung:** [betrieb/sicherung.md](betrieb/sicherung.md).

## Apps und Web

- **Ein Code für iOS, Android und Web:** Ionic 9 mit React 19 und
  TypeScript, als native Apps über Capacitor 8 (`frontend/ios/`,
  `frontend/android/`). Aussehen: [wissen/gestaltung.md](wissen/gestaltung.md).
- **Offline:** Schreibende Vorgänge ohne Netz gehen in eine Warteschlange
  (`frontend/src/services/writeQueue.ts`) und werden später gesendet.
- **Web:** Das Frontend-Image ist nginx (`frontend/Dockerfile`,
  `frontend/nginx.conf`) und liefert die Web-App, die Homepage, Handbuch und
  API-Referenz aus `frontend/public/` samt den Sicherheits-Headern (CSP).
  Ein Jahr im Browser-Zwischenspeicher bleiben nur die Dateien mit Prüfsumme
  im Namen (`/assets/<name>-<prüfsumme>.js` u. ä. aus dem Build); alles
  andere fragt jedes Mal nach und bekommt bei unverändertem Stand ein 304.
  Davor verteilt Traefik nach Pfad: `/api` und `/socket.io` an die Backends,
  der Rest an das Frontend.

## Mitteilungen, Messung, Absturzberichte

- **Push** über Firebase Cloud Messaging (`firebase-admin`,
  `backend/push/firebase.js`); iOS-Geräte erreicht Firebase über APNs. Die
  App registriert sich mit `@capacitor-firebase/messaging`. Die Zahl am
  App-Symbol rechnet der Server mit (`backend/utils/appIconBadge.js`), die
  App gleicht sie nach. Mitteilungen über Vorgänge — nicht Chat-Nachrichten —
  stehen zusätzlich im Postfach (`notifications`).
- **Nutzungsmessung** mit einer selbst betriebenen Umami-Instanz: Die App
  schickt anonyme Ereignisse ohne Namen, Konto oder Gemeinde
  (`frontend/src/services/analytics.ts`; was und warum:
  [messung/umami.md](messung/umami.md)).
- **Absturzberichte** über Firebase Crashlytics, nur in den nativen Apps und
  im Profil abschaltbar (`@capacitor-firebase/crashlytics`).

## Bauen und Ausrollen

- **CI** (`.github/workflows/ci.yml`) bei jedem Push: Backend-Tests gegen eine
  echte Datenbank, Frontend-Tests mit Typprüfung, Lint und Doku-Frische,
  E2E-Tests mit Playwright gegen den vollen Stack
  (`docker-compose.e2e.yml`). Auf `main` danach die Images für Backend und
  Frontend nach ghcr.
- **Deploy** von `main`: `deploy/rollend.sh` spricht die Portainer-API an und
  tauscht in zwei Stufen erst `backend` und `frontend`, dann `backend2`,
  sodass immer eine gesunde Replica antwortet. Rückweg:
  `notfall-deploy.yml` ([betrieb/routinen.md](betrieb/routinen.md#notfall-deploy)).
- **Store-Builds** von Hand über `ios-release.yml` und `android-release.yml`,
  nur von grünen Commits auf `main` ([betrieb/release.md](betrieb/release.md)).
  Versionen stehen an einer Stelle: `frontend/version.json`.
