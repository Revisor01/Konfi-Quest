# Audit Betrieb, Skalierung und Lastverhalten — 26.09.2026

Zielbild laut Auftrag: 10.000–25.000 Nutzer:innen pro Jahr in vielen Gemeinden, Spitzen
sonntags nach dem Gottesdienst (Check-in), abends im Chat, am Jahresende beim Rückblick.
Heutiger Betrieb laut `deploy/compose.konfi_quest.yml`: zwei Backend-Replicas + ein
Test-Backend gegen **eine** Postgres mit 1 GB RAM und **0,3 CPU**, Pool 3 × 20.

## Umfang und Methode

**Gelesen:** `backend/server.js`, `createApp.js`, `database.js`, `healthcheck.js`,
`utils/apm.js`, `utils/liveUpdate.js`, `utils/chatSyncCache.js`, `utils/photoStorage.js`,
`utils/appIconBadge.js`, `utils/pushGruppen.js`, `services/backgroundService.js`,
`services/pushService.js`, `services/emailService.js`, `routes/chat.js` (Raumliste,
Nachricht senden, Push-Fan-out), `routes/wrapped.js` (Snapshot-Erzeugung),
`routes/notifications.js`, `routes/events/checkin.js`, `routes/events/lesen.js`,
`routes/konfi.js` (Dashboard, Terminliste), `routes/activities.js` (Antragsliste),
`routes/einladungen.js`, `middleware/rbac.js`, `push/firebase.js`,
`scripts/cleanupOrphanPhotos.js`, `utils/postfachAufraeumen.js`, `Dockerfile`,
`deploy/compose.konfi_quest.yml`, `deploy/rolling-deploy.sh`, `.github/workflows/ci.yml`
(Deploy-Schritt), `node_modules/@socket.io/postgres-adapter` (Reconnect-Verhalten).
Frontend für das Lastprofil: `contexts/AppContext.tsx`, `contexts/BadgeContext.tsx`,
`contexts/LiveUpdateContext.tsx`, `components/konfi/pages/KonfiDashboardPage.tsx`,
`components/konfi/views/DashboardView.tsx`, `components/chat/useChatSocket.ts`,
`components/shared/QRDisplayModal.tsx`, `hooks/useOfflineQuery.ts`,
`services/offlineCache.ts`, `services/mediaCompression.ts`, `services/websocket.ts`.

**Ausgeführt (alles ausschließlich auf Port 5439, Datenbank `konfi_test`):**

1. Test-Datenbank über den `globalSetup` des Repos angelegt (Produktions-Schema + 36
   offene Migrationen), dann mit `generate_series` auf Zielgröße gefüllt
   (`scratchpad/betrieb-skalierung/gen-data.sql`, Laufzeit 92 s, Ergebnis 486 MB):

   | Tabelle | Zeilen | Größe |
   |---|---|---|
   | organizations / roles / jahrgaenge | 200 / 800 / 400 | — |
   | users (115 Konfis, 6 Teamer, 3 Admins, 1 org_admin je Gemeinde) | 25.000 | 10 MB |
   | events / event_bookings | 5.000 / 150.000 | — / 36 MB |
   | chat_rooms / chat_participants / chat_messages | 2.600 / 33.000 / 1.000.000 | — / — / 164 MB |
   | user_activities + event_points + bonus_points (Punkteeinträge) | 200.000 + 92.400 + 20.000 | 30 MB + … |
   | push_tokens (2 Geräte je Konfi) | 48.000 | 15 MB |
   | notifications (Postfach) | 500.000 | 110 MB |
   | activity_requests (10 % offen) | 50.000 | — |
   | apm_snapshots (2 Jahre im 5-Minuten-Takt) | 210.000 | 29 MB |

2. **EXPLAIN-Harness** (`explain-harness.js`): die echte Express-App aus `createApp()` mit
   einem Datenbank-Wrapper, der jede SELECT-Abfrage zusätzlich mit
   `EXPLAIN (ANALYZE, BUFFERS)` misst. 27 echte HTTP-Aufrufe der wichtigsten Routen
   (Konfi, Teamer, gebundener Admin, org_admin), inklusive Nachläufer (Push, Live-Update).
   Ergänzend `explain-direkt.sql` für einzelne Abfragen mit eingesetzten Parametern.
3. **Hintergrundjobs** direkt aufgerufen (`jobs-messen.js`, `zaehler-steady.js`):
   Laufzeit, Abfragezahl und Log-Zeilen je Lauf gegen den großen Datenbestand.
   Firebase war nicht konfiguriert — jeder Token läuft dort in den schnellen Fehlerpfad;
   die FCM-Netzlatenz (in Produktion nachzumessen) kommt in Produktion **obendrauf**.
4. **Zwei Backend-Instanzen** (`server.js`, Ports 6439/6539, identische Umgebung wie
   `backend`/`backend2`) gegen dieselbe Datenbank: Socket.IO-Zustellung über Replicas,
   Rate-Limiter je Replica, Wrapped-Erzeugung unter Pool-Druck, `/api/metrics`-Aggregation,
   Graceful Shutdown, simulierter Datenbank-Ausfall (`pg_terminate_backend`).
5. Startzeit `node server.js` bis `/api/health` 200 gemessen.

**Bewusst nicht geprüft:** Firebase-Zustellraten und SMTP-Grenzen (kein Zugang; siehe
„Auf Produktion nachzumessen"), Traefik-Konfiguration außerhalb der Labels, die Portainer-
Seite des Deploys, Android/iOS-Verhalten bei Push-Stürmen. Die Zahlen aus dem Frontend
(Requests je App-Start) sind aus dem Code gezählt, nicht am Gerät mitgeschnitten.

### Lastprofil (Herleitung, aus Code gezählt)

Ein Konfi-App-Start löst laut Code aus: `GET /auth/me`, `GET /auth/my-organizations`,
`POST /notifications/device-token` (höchstens alle 12 h), `GET /app-version`,
`GET /notifications/badge-counts` (plus einmal je `sync:reconnect`), Socket.IO-Handshake,
danach die Startseite: `GET /konfi/dashboard`, `/konfi/profile`, `/konfi/events`,
`/konfi/badges/v2` (nachgelagert), `/konfi/tageslosung`, `/challenges/konfi` — **12
Anfragen** gezählt; der Kommentar in `KonfiDashboardPage.tsx:196` nennt „rund 25 Anfragen
gleichzeitig" aus einer Messung am 31.08.2026. Rechnung mit 12–25.

Feste Takte im Client: 30-s-Poll im geöffneten Chatraum (`useChatSocket.ts:201`),
10-s-Poll der Anwesenheitszahl während des Check-ins (`QRDisplayModal.tsx:91`),
5-s-Poll im Metrik-Dashboard (`AdminMetricsPage.tsx:319`, nur super_admin). Kein
Dauer-Polling der Zähler mehr — dafür lädt `BadgeContext` bei **jedem** empfangenen
`newMessage`-Ereignis `GET /notifications/badge-counts` neu (`BadgeContext.tsx:492–509`),
und der Server sendet dieses Ereignis je Nachricht **zweimal** an denselben Client (BF-08).

| Größe | Rechnung | Ergebnis |
|---|---|---|
| Anfragen je Konfi und Tag | 3 App-Starts × 12–25 + Chat (10 min offen = 20 Polls, 30 empfangene Nachrichten × 2 Zähler-Abrufe = 60, 10 Listen) + 10 Navigation | **≈ 140–175** |
| Anfragen je Leitungskonto und Tag | doppelt so viele Listen, Verbuchen, Chat-Räume | ≈ 300 |
| Täglich aktiv (20 % von 25.000) | 4.600 Konfis + 400 Team | 5.000 |
| Anfragen je Tag | 4.600 × 150 + 400 × 300 | **≈ 810.000** (Ø 9,4/s) |
| Abendspitze (40 % in 3 h) | 324.000 / 10.800 s | **≈ 30 Anfragen/s** |
| Sonntag 10:00–10:10, Check-in in 200 Gemeinden | 6.000 Konfis × (1 Check-in + 12–25 Start-Anfragen) / 600 s + 200 Leitungen × 6 Polls/min | **≈ 130–260 Anfragen/s** für 10 Minuten |

Was das die Datenbank kostet, steht in den Befunden: die Zahl der Anfragen ist nicht das
Problem, sondern was einzelne davon auslösen.

### Messwerte je Route (EXPLAIN ANALYZE gegen die Zielgröße, alle Puffer im Cache)

| Route (Rolle) | Abfragen | DB-Zeit Summe | Langsamste Abfrage | Seq Scan auf großer Tabelle |
|---|---|---|---|---|
| GET /konfi/dashboard | 11 | 1,6 ms | 0,4 ms | nein |
| GET /konfi/profile | 5 | 0,8 ms | 0,4 ms | nein |
| GET /konfi/badges/v2 | 11 | 1,6 ms | 0,3 ms | nein |
| GET /notifications/badge-counts (Konfi) | 4 | 3,0 ms | 2,7 ms | nein |
| GET /notifications/badge-counts (org_admin) | 7 | 10,9 ms | 8,9 ms (offene Anträge) | nein |
| GET /chat/rooms (Konfi, warm / kalt mit Sync) | 1 / 8 | 0,4 / 1,1 ms | 0,6 ms | nein |
| GET /chat/rooms (org_admin, warm / kalt) | 1 / 18 | 1,2 / 6,9 ms | 4,5 ms | nein |
| GET /chat/rooms/1/messages | 4 | 0,5 ms | 0,4 ms | nein |
| GET /notifications/postfach | 2 | 0,5 ms | 0,4 ms | nein |
| GET /admin/activities/requests?status=pending (org_admin) | 1 | 8,5 ms | 8,5 ms | nein |
| GET /admin/konfis (org_admin) | 1 | 0,7 ms | 0,7 ms | nein |
| POST /konfi/events/:id/register | 23 | 2,5 ms | 0,6 ms | nein |
| POST /events/qr-checkin (Transaktion) | 7 | 0,3 ms | 0,1 ms | nein |
| POST /einladungen (Nutzersuche exakt) | 19 | 12,3 ms | 5,6 ms | users (LOWER, 1,0 ms) |
| **GET /konfi/events** | 2 | **83 ms** | 83 ms | **event_bookings 150.000, users 25.000** |
| **GET /events (org_admin / Admin / Teamer)** | 1 | **91–119 ms** | 119 ms | **event_bookings 150.000, users 25.000** |
| GET /metrics/history?days=730 | 1 | 47 ms | 47 ms | nein — aber 35 MB Antwort |
| **POST /chat/rooms/1/messages (67 Teilnehmer)** | **1.086** | **464 ms** | 26,5 ms (`total_unread`) × 66 | nein |

Alles unter 100 ms außer den beiden Terminlisten und dem Chat-Fan-out. Die einzelnen
Abfragen von Dashboard, Profil, Abzeichen, Raumliste und Postfach sind mit Indizes
abgedeckt und bleiben bei Zielgröße im Millisekundenbereich.

## Zusammenfassung

Der Betrieb trägt die heutigen rund 110 Konten problemlos; für 25.000 Nutzer:innen ist er
in dieser Form **nicht tragfähig**, und zwar nicht wegen der Anfragezahl, sondern wegen
dreier Abfragemuster, die mit der Datenmenge oder der Empfängerzahl wachsen, und einer
Datenbank mit 0,3 CPU, die dafür keinen Spielraum hat. **16 Befunde: 0 KRITISCH, 5 HOCH,
7 MITTEL, 4 NIEDRIG.** Die drei wichtigsten Punkte:

1. **Ein Verbindungsabbruch zur Datenbank beendet beide Replicas gleichzeitig** (BF-01,
   reproduziert): Der Postgres-Adapter von Socket.IO hält eine dauerhafte LISTEN-Verbindung
   ohne Fehlerbehandlung; reißt sie, wirft Node eine `uncaughtException`, `server.js` fährt
   herunter. Ein Neustart oder OOM-Kill der Datenbank (1 GB Grenze) ist damit ein
   Totalausfall der API, bis Docker beide Container neu startet.
2. **Jede Chat-Nachricht kostet 1.086 Datenbankabfragen** in einem Jahrgangschat mit 67
   Teilnehmenden (BF-04, reproduziert) — 16 je Empfänger, obwohl für den Sammelversand
   längst eine Blockvariante existiert (`sendToMultipleUsers`, gemessen 0,23 Abfragen je
   Empfänger). Bei 0,3 CPU sättigt das die Datenbank ab etwa 0,6 Nachrichten pro Sekunde;
   die Abendspitze bei Zielgröße liegt bei rund 0,7/s.
3. **Die Terminlisten materialisieren die View `event_booking_stats` bei jedem Aufruf
   komplett** (BF-03, reproduziert): 83–119 ms je Aufruf bei 150.000 Buchungen statt
   1,2 ms mit einem Aggregat je Termin. Die Sonntagsspitze (6.000 App-Starts in 10 Minuten)
   braucht dafür das Dreifache dessen, was 0,3 CPU liefern.

Dazu kommt der App-Icon-Lauf, der nach **jedem Neustart** alle 48.000 Geräte anschreibt
(BF-02: 215 s, 328.000 Abfragen, ohne FCM-Latenz) und sich mit seinem eigenen
5-Minuten-Takt überlappt. Die Bausteine, die es richtig machen — `sendToMultipleUsers`,
`getTokensForUsers`, `appIconSummenFuerAlle`, Advisory-Lock der Migrationen, gemeinsames
Upload-Volume, Socket-Adapter über Replicas — halten (siehe „Geprüft und in Ordnung").

### Kapazitätsaussage in Zahlen

Rechenbasis: 0,3 CPU = **300 ms Datenbank-Rechenzeit je Sekunde**; die gemessenen
EXPLAIN-Zeiten sind bei vollständig gecachten Puffern im Wesentlichen CPU-Zeit.

- **Ohne Chat:** Ein App-Start kostet heute ≈ 90 ms Datenbankzeit (davon 83 ms die
  Terminliste). Das sind **höchstens 3 App-Starts je Sekunde**. Die Sonntagsspitze braucht
  10/s → dreifache Überlast, Anfragen stauen sich im Pool (20 Plätze, 5 s Wartezeit bis
  „timeout exceeded when trying to connect") und laufen in Fehler. Mit BF-03 behoben sinkt
  der App-Start auf ≈ 8 ms → 37 Starts/s, die Spitze passt.
- **Mit Chat:** Eine Nachricht in einem 67er-Raum kostet 464 ms Datenbankzeit →
  **0,65 Nachrichten je Sekunde** sättigen die Datenbank vollständig; alles andere wartet.
  Bei 400 Jahrgangschats und 20 Nachrichten je Chat und Abend (8.000 in 3 h = 0,74/s) ist
  die Datenbank abends dauerhaft am Anschlag, bevor eine einzige Liste geladen wird.
- **Gleichzeitig aktive Nutzer:innen (Dashboard-Muster, ohne Chat-Fan-out):** ≈ 7,5 ms
  Datenbankzeit je Anfrage im Mix, 0,055 Anfragen/s je aktiver Person → ≈ 0,4 ms/s je Person
  → **≈ 700 gleichzeitig aktive** heute; nach BF-03 ≈ 5.000 (dann begrenzt der
  Node-Prozess mit 0,5 CPU je Replica, nicht gemessen).
- **Engpass:** die Datenbank (0,3 CPU), getrieben von BF-03, BF-04 und BF-02 — nicht die
  Node-Replicas, nicht der Pool, nicht die Zahl der Verbindungen.

## Release-Empfehlung für den Bereich

**Mit Auflage.** Für die heutige Nutzung (eine Handvoll Gemeinden) ist 2.3.0 betreibbar;
für die EKD-Ausrollung sind vor dem Anwachsen fünf Dinge zu erledigen, die sich alle
lokal mit dem hier hinterlegten Datenbestand nachmessen lassen:

### Die fünf wichtigsten Maßnahmen vor dem Release

1. **BF-01 beheben:** dem Socket-Adapter-Pool-Client einen `error`-Handler geben (oder den
   Adapter mit eigener `pg.Client`-Instanz samt Reconnect betreiben) und den Fall
   `pg_terminate_backend` als Test festhalten: Prozess lebt, `/api/status` liefert nach
   einer Sekunde wieder 200.
2. **BF-03 beheben:** in `routes/konfi.js:1155` und `routes/events/lesen.js` das LATERAL auf
   `event_booking_stats` durch ein Aggregat direkt auf `event_bookings ... WHERE
   eb.event_id = e.id` ersetzen (gemessen 100 ms → 1,2 ms) oder die View durch eine
   parametrisierbare Funktion ablösen.
3. **BF-04 beheben:** den Chat-Push-Fan-out in `routes/chat.js:1240–1300` auf
   `sendToMultipleUsers` umstellen (Postfach, Tokens, Badge je Block statt je Kopf) und die
   `total_unread`-Abfrage je Empfänger streichen — die Badge-Zahl rechnet der Sammelweg
   ohnehin selbst.
4. **BF-02 beheben:** `letzterZaehler` nicht leer starten (z. B. beim ersten Lauf nur den
   Merker füllen, nichts senden) und jeden `setInterval`-Job mit einem „läuft noch"-Merker
   gegen Überlappung schützen (gilt ebenso für BF-05).
5. **Datenbank dimensionieren und die eigene Vorgabe umsetzen:** `PG_POOL_MAX` ins Compose
   (Kommentar `database.js:13–18` verlangt es seit dem 24.09.2026, fehlt dort), CPU-Grenze
   der Postgres von 0,3 auf mindestens 2 anheben, `statement_timeout`-Kette gegen die
   Sonntagsspitze auf dem großen Datenbestand nachmessen.

## Befunde

### BF-01: Verbindungsabbruch zur Datenbank beendet alle Backend-Replicas gleichzeitig
- **Schwere:** HOCH
- **Fundstelle:** `backend/server.js:64–73` (Adapter-Pool ohne Client-Fehlerbehandlung),
  `backend/server.js:567–570` (`uncaughtException` → Shutdown),
  `backend/node_modules/@socket.io/postgres-adapter/dist/util.js:65–99` (LISTEN-Client
  bindet nur `notification` und `end`, kein `error`)
- **Kennzeichnung:** reproduziert — zwei Instanzen auf 6439/6539 gegen `konfi_test`, dann
  `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='konfi_test'`
  (`scratchpad/betrieb-skalierung/replica-tests.sh`, TEST 3; zweimal ausgeführt, beide Male
  identisch)
- **Beschreibung:** `database.js:69` fängt Fehler auf **leerlaufenden** Pool-Verbindungen
  ab; der Socket.IO-Postgres-Adapter hält aber dauerhaft eine **ausgecheckte** Verbindung
  für `LISTEN`. Bricht sie ab, feuert `pg` ein `error`-Ereignis auf dem Client, das niemand
  hört → Node wirft `uncaughtException` → `gracefulShutdown('uncaughtException', 1)`. Da
  beide Replicas dieselbe Datenbank nutzen, sterben beide im selben Moment; das
  Test-Backend ebenso. Ein Postgres-Neustart (Update, OOM-Kill bei der 1-GB-Grenze,
  Failover) ist damit ein Totalausfall bis Docker (`restart: unless-stopped`) neu startet.
  Der Neustart selbst schlägt fehl, solange die Datenbank noch nicht wieder da ist
  (`database.js:171–184`, `process.exit(1)`), und beim ersten erfolgreichen Start läuft BF-02
  an.
- **Auswirkung aus Nutzersicht:** Alle Konfis und Leitungen sehen für 10–30 s
  Verbindungsfehler; offene Chats verlieren die Live-Verbindung; wer gerade eincheckt,
  bekommt einen Fehler. Danach ein Push-Sturm (BF-02).
- **Beleg:** Log `replicaA2.log`:
  ```
  Postgres-Pool: Fehler auf leerlaufender Verbindung: terminating connection due to administrator command
  Socket.IO-Adapter-Pool Fehler: terminating connection due to administrator command
  Unbehandelte Exception - geordneter Shutdown: error: terminating connection due to administrator command
      at Socket.<anonymous> (.../node_modules/pg-protocol/dist/index.js:12:42)
  uncaughtException empfangen - Graceful Shutdown...
  ```
  Ausgabe des Tests: `Prozesse leben: A=NEIN B=NEIN`, `/api/status` und `/api/health`
  danach `HTTP 000`.
- **Empfehlung:** Adapter-Client mit `error`-Handler versehen (z. B. eigener `pg.Client`
  mit `client.on('error', …)` + Reconnect) oder den Adapter so kapseln, dass ein Fehler nur
  den Adapter neu verbindet. Test: nach `pg_terminate_backend` muss der Prozess leben und
  eine Chat-Nachricht muss die andere Replica wieder erreichen.

### BF-02: App-Icon-Lauf schreibt nach jedem Neustart alle Geräte an und überlappt sich
- **Schwere:** HOCH
- **Fundstelle:** `backend/services/backgroundService.js:30` (`letzterZaehler` im
  Prozessspeicher), `:95–101` (5-Minuten-`setInterval` ohne Laufmerker),
  `:373–383` (Push, wenn Merker abweicht — beim ersten Lauf immer),
  `backend/services/pushService.js:1012–1060` (`sendBadgeUpdate`: ~13 Abfragen je Person)
- **Kennzeichnung:** reproduziert — `jobs-messen.js` (Kaltstart) und `zaehler-steady.js`
  (Regelbetrieb) gegen 25.000 Konten
- **Beschreibung:** Der Zähler-Lauf sendet einen stillen Push an jedes Gerät, dessen
  gemerkter Stand vom berechneten abweicht. Nach jedem Neustart (Deploy, Absturz, BF-01)
  ist der Merker leer — also bekommen **alle** ein Push. Gemessen: **214,8 s, 328.403
  Abfragen, 96.000 Log-Zeilen** für 25.000 Konten mit 48.000 Tokens, und das ohne
  FCM-Netzlatenz (Firebase nicht konfiguriert). Mit realer Zustellung (Größenordnung
  50–100 ms je Token, sequentiell je Person) dauert der Lauf 40–80 Minuten. Der Takt ist
  aber **5 Minuten** und startet ungeachtet eines laufenden Vorgängers erneut → mehrere
  Läufe gleichzeitig, jeder mit 328.000 Abfragen. Im Regelbetrieb ist der Lauf harmlos:
  2,7–3,2 s und 2.003 Abfragen je 5 Minuten; eine einzelne neue Chat-Nachricht kostet im
  nächsten Takt zusätzlich 865 Abfragen und 66 Pushes (Lauf 4).
- **Auswirkung aus Nutzersicht:** Nach jedem Deploy ist die Datenbank bis zu einer Stunde
  ausgelastet, Listen laden träge oder laufen in Timeouts; 48.000 stille Pushes gehen an
  Geräte, an denen sich nichts geändert hat.
- **Beleg:** `jobs-ergebnis.txt`:
  `updateAllUserBadges nurZaehler (App-Icon, alle 5 min, 25.000 Konten): 214845 ms, 328403 Abfragen, Log-Zeilen +96000 -> {"updated":25000,…}`;
  `zaehler-steady-ergebnis.txt`: `Lauf 2 (Regelbetrieb): 2744 ms, 2003 Abfragen, updated=0`,
  `Lauf 4 (eine neue Nachricht in Raum 1): 3214 ms, 2868 Abfragen, 244 Log-Zeilen, updated=66`.
- **Empfehlung:** Beim ersten Lauf nur den Merker füllen (oder den letzten gesendeten Stand
  je Token in `push_tokens` persistieren); jeden Intervall-Job mit `laeuft`-Flag gegen
  Überlappung sichern; Pushes des Zähler-Laufs über `sendToMultipleUsers`-Blöcke statt je
  Kopf.

### BF-03: Terminlisten materialisieren die gesamte View `event_booking_stats` je Aufruf
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/konfi.js:1155 ff.` (LATERAL auf `event_booking_stats`),
  `backend/routes/events/lesen.js:135–170` (dito), View-Definition aus Migration 128
  (`GROUP BY eb.event_id` über **alle** Buchungen, Join auf `users` und `roles`)
- **Kennzeichnung:** reproduziert — `explain-harness.js` (Routen) und
  `explain-direkt.sql` Abfragen 1 und 2
- **Beschreibung:** Postgres schiebt `WHERE ebs.event_id = e.id` nicht in die View: Der
  Plan zeigt `HashAggregate rows=5000` über einen `Seq Scan on event_bookings rows=150001`
  und `Seq Scan on users rows=25000` — für **jede** Terminliste, unabhängig davon, wie viele
  Termine die Gemeinde hat. Gemessen: `GET /konfi/events` 83 ms, `GET /events` 91–119 ms
  bei 150.000 Buchungen; dieselbe Zahl als Aggregat direkt auf `event_bookings ... WHERE
  eb.event_id = e.id` kostet **1,2 ms** (Bitmap-Index `idx_event_bookings_event_status`).
  Die Kosten wachsen linear mit der Gesamtzahl der Buchungen aller Gemeinden.
- **Auswirkung aus Nutzersicht:** Bei 0,3 CPU sind höchstens 3 Terminlisten je Sekunde
  möglich. Am Sonntag nach dem Gottesdienst, wenn in 200 Gemeinden gleichzeitig die App
  aufgeht (Startseite lädt `/konfi/events` mit), stauen sich die Anfragen im Pool; Check-in
  und Startseite laufen in Timeouts.
- **Beleg:** `explain-direkt.sql` Abfrage 1: `Execution Time: 100.557 ms`, darin
  `Seq Scan on event_bookings eb (rows=150001)`, `Seq Scan on users u (rows=25000)`;
  Abfrage 2 (Aggregat je Termin): `Execution Time: 1.212 ms`.
- **Empfehlung:** In beiden Routen das View-LATERAL durch das Aggregat je Termin ersetzen
  (Spaltennamen unverändert lassen — Antwortform ist Vertrag), oder die View als
  `SQL`-Funktion mit Parameter `event_id` bereitstellen. Test mit ≥ 100.000 Buchungen: kein
  `Seq Scan on event_bookings` im Plan.

### BF-04: Eine Chat-Nachricht kostet 1.086 Datenbankabfragen und 66 Einzel-Pushes
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/chat.js:1240–1300` (Schleife je Teilnehmer:
  `total_unread`-Abfrage + `sendChatNotification`), `backend/services/pushService.js:876–1000`
  (`sendChatNotification`: Raum-Org, Sender-Tokens, Empfänger-Tokens, `berechneBadge` mit
  7–9 Abfragen, FCM je Gerät)
- **Kennzeichnung:** reproduziert — `explain-harness.js`, Fall
  `POST /chat/rooms/1/messages (Konfi 1, 67 Teilnehmer)`
- **Beschreibung:** Nach der Antwort läuft für jeden der 66 anderen Teilnehmenden eine
  Kette: `total_unread` (26,5 ms — Join `chat_messages` × `chat_participants` über alle
  Räume der Person), Raum-Organisation, Sender-Tokens, Empfänger-Tokens, `berechneBadge`
  (Rolle, Organisationen, sieben Zähler-Abfragen) und je Gerät ein FCM-Aufruf mit bis zu
  drei Versuchen. Gemessen: **1.086 Abfragen, 464 ms Datenbankzeit, 372 Log-Zeilen** für
  eine Nachricht. `sendToMultipleUsers` (`pushService.js:812`) löst dieselbe Aufgabe in
  Blöcken: gemessen **232 Abfragen für 1.000 Empfänger** (0,23 je Kopf) — der Chat-Weg
  nutzt ihn nicht. Zusätzlich bezieht jeder Empfänger im nächsten 5-Minuten-Takt einen
  stillen Badge-Push (BF-02, Lauf 4: 865 Abfragen für eine Nachricht).
- **Auswirkung aus Nutzersicht:** Ab etwa 0,65 Nachrichten je Sekunde über alle Gemeinden
  ist die Datenbank (0,3 CPU) ausgelastet; die Abendspitze bei Zielgröße (≈ 0,74/s) legt
  jede andere Funktion lahm — Listen, Check-in, Anmeldung. Der Chat selbst fühlt sich
  träge an, Pushes kommen Minuten später.
- **Beleg:** `explain-ergebnis.txt`:
  `POST /chat/rooms/1/messages (Konfi 1, 67 Teilnehmer): Abfragen: 1086 (davon 961 SELECT gemessen), DB-Zeit Summe: 464.3 ms, Log-Zeilen: 372; langsamste: 26.5 ms SELECT COUNT(DISTINCT cm.id) as total_unread …`;
  `jobs-ergebnis.txt`: `sendToMultipleUsers 1.000 Empfaenger: 1336 ms, 232 Abfragen`.
- **Empfehlung:** Fan-out auf `sendToMultipleUsers` umstellen (Postfach, Tokens, Badge je
  Block; Sender ausschließen), die `total_unread`-Schleife streichen (die Badge-Zahl
  rechnet `berechneBadgesFuerAlle` ohnehin), Log-Zeile „Keine Push-Tokens" auf eine
  Sammelzeile je Nachricht reduzieren. Zielwert: < 50 Abfragen je Nachricht unabhängig von
  der Teilnehmerzahl.

### BF-05: Terminerinnerungen laufen sequentiell je Empfänger ohne Überlappungsschutz
- **Schwere:** HOCH
- **Status:** teilweise behoben 26.09.2026 — Laufmerker `eventReminderLaeuft` in `sendEventReminders`: ein Takt, der einen laufenden Vorgänger trifft, wird übersprungen (Test L1/L2); Mitternachts-Bündelung durch das 24-Stunden-Fenster aufgelöst (Chat BF-03). Offen: Sammelversand je Termin über `sendToMultipleUsers` und blockweises `INSERT … ON CONFLICT` (Umbau der Versandschleife, nicht Teil des Fachlogik-Pakets).
- **Fundstelle:** `backend/services/backgroundService.js:467–474` (15-Minuten-`setInterval`
  ohne Laufmerker), `:692–715` und `:740–761` (Schleife: Push + Insert je Empfänger),
  `backend/services/pushService.js:1485` (`sendEventReminderToKonfi` → `sendToUser` je Kopf)
- **Kennzeichnung:** reproduziert (Kosten je Empfänger: `jobs-messen.js`), aus Code gelesen
  (fehlender Überlappungsschutz)
- **Beschreibung:** Je Empfänger 14 Abfragen und 9,2 ms Datenbankzeit (300 Empfänger:
  2.761 ms, 4.202 Abfragen, 1.800 Log-Zeilen) — plus ein FCM-Aufruf je Gerät. Die
  1-Tag-Erinnerung geht für **alle** Termine des Folgetags im ersten Takt nach Mitternacht
  hinaus (`e.event_date::date = morgen`, kein Uhrzeitfenster), die 1-Stunde-Erinnerung
  gebündelt vor der Gottesdienstzeit. Bei 200 Gemeinden mit je einem Sonntagsgottesdienst
  und 30 Zusagen sind das 6.000 Empfänger je Takt: **55 s Datenbankzeit** gemessen, mit
  FCM-Latenz (≈ 100 ms je Gerät, sequentiell) ≈ **10 Minuten**. Ab ≈ 9.000 Empfängern je
  Takt (zwei Gottesdienste je Gemeinde, Konfi-Fahrten) dauert der Lauf länger als 15
  Minuten; der nächste Takt startet trotzdem, findet die noch nicht eingetragenen
  `event_reminders` und **schickt dieselben Erinnerungen ein zweites Mal**.
- **Auswirkung aus Nutzersicht:** Erinnerungen kommen bis zu einer Viertelstunde verspätet
  oder doppelt; währenddessen ist die Datenbank für alle anderen langsamer.
- **Beleg:** `jobs-ergebnis.txt`:
  `sendEventReminders (300 Empfaenger …): 2761 ms, 4202 Abfragen, Log-Zeilen +1800` →
  `je Empfaenger 9.2 ms DB-seitig; hochgerechnet auf 6000: 55 s ohne FCM-Netzlatenz`.
  `explain-direkt.sql` Abfrage 5 (Auswahl selbst): 11,8 ms, unkritisch.
- **Empfehlung:** Empfänger je Termin sammeln und über `sendToMultipleUsers` versenden
  (Erinnerungstext ist je Termin gleich), `event_reminders` blockweise `INSERT … ON
  CONFLICT DO NOTHING` **vor** dem Versand, Laufmerker gegen Überlappung. Prüfen, ob die
  1-Tag-Erinnerung um Mitternacht gewollt ist (fachlich, anderer Bereich).

### BF-06: Wrapped-Erzeugung belegt den gesamten Verbindungspool und bremst alle anderen
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/wrapped.js:2405–2409` (`Promise.allSettled` über alle
  Konfis, jeder mit eigenem `getClient()`), `:2139–2162` (je Konfi ~30 Abfragen in einer
  Transaktion), `backend/database.js:57` (`connectionTimeoutMillis` 5 s gilt auch für das
  Warten auf einen Pool-Platz)
- **Kennzeichnung:** reproduziert — `replica-tests.sh` TEST 4
- **Beschreibung:** Für einen Jahrgang mit 58 Konfis holen 58 parallele Ketten je einen
  Pool-Client (Pool 20): Gemessen war der Pool die ganze Zeit voll (`gesamt 20, frei 0,
  wartend 20`), ein gleichzeitiger Dashboard-Aufruf brauchte **754 ms statt 17 ms**. Auf
  dieser Maschine dauerte der Lauf 944 ms; auf der Produktions-Datenbank mit 0,3 CPU ist
  mit dem Drei- bis Zehnfachen zu rechnen — dann laufen die wartenden Ketten **und alle
  API-Anfragen dieser Replica** in den 5-s-Timeout. Fehlgeschlagene Snapshots werden nur
  gezählt (`errors`), die Freigabe wird trotzdem gesetzt (`wrappedSql`-Kommentar in
  `konfi.js:189 ff.` beschreibt genau diese Folge).
- **Auswirkung aus Nutzersicht:** Während die Leitung den Rückblick erzeugt, hängt für alle
  Nutzer:innen dieser Replica die App; einzelne Konfis bekommen den Rückblick nicht, sehen
  aber den Hinweis darauf.
- **Beleg:** `replica-ergebnis.txt`: `POST /wrapped/generate/1: 944 ms -> {"generated":58,"errors":0}`;
  `dashboard #1: HTTP 200 754 ms` (danach 14–24 ms); `pool: {"gesamt":20,"frei":0,"wartend":20,"max":20}`.
- **Empfehlung:** Parallelität auf einen festen Block begrenzen (z. B. 4 gleichzeitig, wie
  `EMPFAENGER_BLOCK`), oder den Lauf in einer Transaktion auf **einem** Client mit
  Savepoints fahren wie `generateAllTeamerWrapped` es schon tut; Freigabe erst setzen, wenn
  `errors === 0`.

### BF-07: Graceful Shutdown hängt immer 10 s und endet mit Exit-Code 1
- **Schwere:** MITTEL
- **Fundstelle:** `backend/server.js:518–541` (`db.end()`, dann `socketAdapterPool.end()`,
  10-s-Notausstieg mit Exit 1), `node_modules/@socket.io/postgres-adapter/dist/util.js:47–56`
  (Aufräum-Timer läuft weiter, LISTEN-Client bleibt ausgecheckt)
- **Kennzeichnung:** reproduziert — `start1.log` und `replica-tests.sh` TEST 6
- **Beschreibung:** `pool.end()` wartet auf die Rückgabe aller Clients; der Adapter gibt
  seinen LISTEN-Client nie zurück, und sein 30-s-Timer versucht weiter `DELETE FROM
  socket_io_attachments` auf dem geschlossenen Pool. Ergebnis bei **jedem** SIGTERM:
  `Socket.IO-Postgres-Adapter Fehler: Cannot use a pool after calling end on the pool`,
  dann `Shutdown-Timeout erreicht - erzwinge Beendigung`, Exit 1 nach exakt 10.016 ms
  (A) bzw. 10.011 ms (B). Der Container meldet damit jeden regulären Stopp als Absturz —
  genau das, was der Kommentar in `server.js:515–517` vermeiden wollte — und jeder Deploy
  verlängert sich je Replica um 10 s, in denen der alte Prozess keine Verbindungen mehr
  annimmt, Traefik ihn aber bis zum nächsten 5-s-Check weiter anspricht (BF-13).
- **Auswirkung aus Nutzersicht:** Beim Deploy 10 s länger „Verbindung fehlgeschlagen";
  in der Neustart-Statistik ist ein echter Absturz nicht mehr von einem Deploy zu
  unterscheiden.
- **Beleg:** `replica-ergebnis.txt`: `Replica A: beendet nach 10016 ms`, Log-Zeilen wie oben.
- **Empfehlung:** Vor `socketAdapterPool.end()` `io.close()` aufrufen (schließt Adapter,
  Timer und LISTEN-Client), dann die Pools beenden; Test: SIGTERM → Exit 0 in < 1 s ohne
  Adapter-Fehlerzeile.

### BF-08: `newMessage` erreicht jeden Client doppelt und löst zwei Zähler-Abrufe aus
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/chat.js:1215` (Emit an `room_<id>`) und `:1229` (Emit an
  jeden `user_<typ>_<id>` — auch an die, die im Raum sind),
  `frontend/src/contexts/BadgeContext.tsx:492–509` (`GET /notifications/badge-counts` je
  `newMessage`)
- **Kennzeichnung:** reproduziert — `socket-test.js`: beide Clients empfingen dieselbe
  Nachricht **zweimal** (`Client an A empfing: [msg, msg]`, `Client an B empfing: [msg, msg]`)
- **Beschreibung:** Wer den Raum offen hat, sitzt in beiden Socket-Räumen und bekommt das
  Ereignis doppelt; der `BadgeContext` lädt daraufhin zweimal die Zähler (4 Abfragen je
  Aufruf). Je Nachricht in einem 67er-Raum sind das bis zu **134 HTTP-Anfragen und 536
  Abfragen** von den Clients — zusätzlich zu BF-04 auf dem Server. Der Kommentar an
  `:1226` begründet den zweiten Emit mit Teilnehmenden, die **nicht** im Raum sind; die im
  Raum bekommen ihn trotzdem.
- **Auswirkung aus Nutzersicht:** Nichts Sichtbares (der Client dedupliziert nach ID),
  aber jede Nachricht kostet doppelt so viel Netz und Datenbank wie nötig; im Chatabend ist
  das der zweitgrößte Lastfaktor nach BF-04.
- **Beleg:** Ausgabe `socket-test.js` in `replica-ergebnis.txt` TEST 1.
- **Empfehlung:** Entweder nur an `user_`-Räume emittieren (alle Teilnehmenden sind dort),
  oder die Sockets, die bereits im `room_`-Raum sind, beim zweiten Emit ausnehmen
  (`io.in(userRoom).except(\`room_${roomId}\`)`). Im Client den Zähler-Abruf je Ereignis
  entprellen.

### BF-09: Rate-Limiter zählen je Replica — jedes Limit gilt doppelt
- **Schwere:** MITTEL
- **Fundstelle:** `backend/server.js:279–385` (alle `rateLimit(...)` ohne `store`,
  `express-rate-limit` 8.7.0 → `MemoryStore` je Prozess),
  `deploy/compose.konfi_quest.yml:57–182` (zwei Replicas hinter einem Traefik-Service)
- **Kennzeichnung:** reproduziert — `replica-tests.sh` TEST 2: 21 falsche
  Doku-Passwörter an A → `HTTP 429`; direkt danach an B → `HTTP 401` (nicht 429)
- **Beschreibung:** Traefik verteilt ~50/50. Der Doku-Limiter (20 Fehlversuche / 15 min
  gegen ein einzelnes gemeinsames Passwort, CodeQL-Befund 101) erlaubt real 40, der
  Auth-Limiter 600 statt 300 Fehlversuche, der Chat-Limiter 120 statt 60 Nachrichten pro
  Minute, der allgemeine 4.000 statt 2.000. Umgekehrt bekommt ein Nutzer, dessen Anfragen
  gerade auf die „volle" Replica fallen, 429, während die andere noch durchlässt — das
  Verhalten wirkt zufällig.
- **Auswirkung aus Nutzersicht:** Schutzwirkung halbiert (Doku-Passwort, Login), 429
  wechselhaft.
- **Beleg:** Testausgabe: `21. Fehlversuch an A: HTTP 429`, `1. Versuch danach an B: HTTP 401`.
- **Empfehlung:** Gemeinsamer Store (z. B. `rate-limit-postgresql` auf der vorhandenen
  Datenbank, oder die Grenzwerte halbieren und im Handbuch die effektive Zahl nennen);
  mindestens für Doku- und Auth-Limiter.

### BF-10: Cron-Leader ohne Ersatz und ohne Sichtbarkeit
- **Schwere:** MITTEL
- **Fundstelle:** `backend/server.js:469–475` (`RUN_BACKGROUND_JOBS`),
  `deploy/compose.konfi_quest.yml:135–141, 193–194, 213–215` (nur `backend` ist Leader),
  `backend/services/backgroundService.js` (keine Laufzeitstempel, kein Export des letzten
  Laufs)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Ist der Container `backend` weg oder in einer Neustartschleife (der
  Kommentar in `server.js:416–428` belegt 20 Abstürze in 45 Minuten am 27.08.2026), laufen
  weder Erinnerungen noch Token-Bereinigung, Auto-Löschung (DSG-EKD-Fristen!),
  Lizenz-Erinnerungen, APM-Schnappschüsse noch der Team-Rückblick am 6. Januar. `backend2`
  antwortet weiter — von außen ist nichts zu sehen. `/api/metrics` und `/api/status` kennen
  keinen „letzter Job-Lauf"-Wert; `node-cron`-Jobs, die um 02:00/03:00/09:00 ausfallen,
  werden nicht nachgeholt (nur `sendEventReminders` und `cleanupStaleTokens` laufen beim
  Start einmal sofort).
- **Auswirkung aus Nutzersicht:** Erinnerungen bleiben aus, Jahrgänge werden nicht
  fristgerecht gelöscht — und niemand merkt es.
- **Beleg:** `compose.konfi_quest.yml:135–141`; `backgroundService.js:1584–1598`
  (`startAllServices` ohne Zustandsausgabe).
- **Empfehlung:** Leader über einen Postgres-Advisory-Lock wählen (jede Replica versucht
  ihn beim Start, die zweite übernimmt bei Ausfall), letzte Laufzeit je Job in
  `/api/metrics/local` ausgeben und extern (Uptime Kuma) auf Alter prüfen.

### BF-11: Log-Volumen bei Zielgröße überrollt die Aufbewahrung binnen Stunden
- **Schwere:** MITTEL
- **Fundstelle:** `deploy/compose.konfi_quest.yml:115–119` (json-file 10 m × 3 je
  Container), `backend/services/pushService.js:720, 938` (`console.warn('Keine Push-Tokens
  …')` je Empfänger), `backend/utils/apm.js:437` (`[APM] LANGSAM` je Anfrage > 1 s), 543
  `console.*`-Aufrufe in Routen/Services/Utils, kein strukturierter Logger, keine
  Request-ID
- **Kennzeichnung:** reproduziert (Zeilen je Vorgang) / Rechnung (Volumen)
- **Beschreibung:** Gemessen: eine Chat-Nachricht 372 Log-Zeilen (Firebase-Fehlerpfad;
  mit funktionierendem FCM bleiben je Empfänger ohne Token die „Keine Push-Tokens"-Zeile,
  laut Produktionsmessung im Code hat etwa die Hälfte kein Token → ≈ 33 Zeilen je
  Nachricht), der Kaltstart-Zählerlauf 96.000 Zeilen, ein Erinnerungslauf 6 Zeilen je
  Empfänger. 30 MB je Container fassen bei ≈ 130 Byte je JSON-Zeile rund 230.000 Zeilen.
  Bei 8.000 Chat-Nachrichten am Abend (264.000 Zeilen) ist das Log des Cron-Leaders
  **innerhalb eines Abends** einmal durchrotiert; ein Fehler vom Vormittag ist abends nicht
  mehr im Log. Alles ist Freitext ohne Anfrage-Kennung, ein Fehler lässt sich keiner
  Anfrage zuordnen.
- **Auswirkung aus Nutzersicht:** Keine direkte — aber gemeldete Fehler („bei mir kam
  gestern kein Push") sind nicht mehr nachvollziehbar.
- **Beleg:** `explain-ergebnis.txt` (`Log-Zeilen: 372` für eine Nachricht),
  `jobs-ergebnis.txt` (`Log-Zeilen +96000`).
- **Empfehlung:** Je-Kopf-Warnungen zu einer Sammelzeile je Vorgang zusammenfassen
  („12 von 67 ohne Token"), strukturierte Zeilen (JSON mit Route, Nutzer-Hash, Dauer),
  `max-size` auf 50 m × 5 oder Versand an einen Log-Sammler.

### BF-12: Deploy-Lücke: `update_stack` ersetzt beide Replicas gleichzeitig
- **Schwere:** MITTEL
- **Fundstelle:** `.github/workflows/ci.yml:426–470` (PUT `/api/stacks/249` mit
  `pullImage:true` — recreate aller Dienste), `deploy/rolling-deploy.sh:1–16` („NOCH NICHT
  IM CI AKTIV", zwei offene Punkte), `deploy/compose.konfi_quest.yml:11–13`,
  Traefik-Healthcheck 5 s (`:128`), Compose-Healthcheck `start_period 20s` (`:98`)
- **Kennzeichnung:** aus Code gelesen; Startzeit reproduziert
- **Beschreibung:** Gemessen: `node server.js` bis `/api/health` 200 = **2,86 s** (lokal,
  Test-DB, 89 Migrationen geprüft). Abgeleitete Lücke je Deploy: Alt-Container hört nach
  SIGTERM sofort auf, Verbindungen anzunehmen, bleibt aber bis zu 5 s im Traefik-Pool
  (BF-07: 10 s bis Exit) → 502/503; Neu-Container: Image-Pull + Start ≈ 3–5 s + 2,9 s Node
  + bis 5 s bis zum ersten Traefik-Check → **≈ 10–20 s ohne API**, alle Sockets getrennt.
  Der eigene Live-Test (`rolling-deploy.sh:4`) hatte ~15 s 502/503 gemessen. Das rollende
  Verfahren liegt seit dem 21.06.2026 als Entwurf da. Bei 25.000 Nutzer:innen fällt jedes
  Deploy — auch das nächtliche — in eine Zeit, in der jemand die App benutzt, und jedes
  Deploy löst BF-02 aus.
- **Auswirkung aus Nutzersicht:** 10–20 s „Verbindung fehlgeschlagen" je Deploy, danach
  ein Push-Sturm.
- **Beleg:** `start1.log`/Konsole: `Startzeit bis /api/health 200: 2861 ms`; Kommentare in
  den genannten Dateien.
- **Empfehlung:** Rolling-Deploy fertigstellen (die beiden offenen Punkte sind im Skript
  benannt: fester SHA-Tag statt `:latest` ist im CI inzwischen gelöst, es fehlt das
  Draining); bis dahin BF-07 beheben, damit die Lücke nicht länger ist als nötig.

### BF-13: Datenbank-Dimensionierung und Pool-Vorgabe passen nicht zum Ziel
- **Schwere:** MITTEL
- **Fundstelle:** `deploy/compose.konfi_quest.yml:42–46` (Postgres 1 GB, **0,3 CPU**),
  `:25` (`max_connections=200`), `backend/database.js:9–18` (Kommentar vom 24.09.2026:
  „PG_POOL_MAX gehört ins Compose", Rechenweg für 50), Compose ohne `PG_POOL_MAX`,
  `PG_IDLE_TIMEOUT`, `PG_STATEMENT_TIMEOUT`
- **Kennzeichnung:** aus Code gelesen und gerechnet (Grundlage: die EXPLAIN-Zeiten oben)
- **Beschreibung:** 200 erlaubte Verbindungen bei tatsächlich 3 × (20 + 2) = 66 genutzten
  — die Speicherrechnung im Compose-Kommentar („~90 gleichzeitige") ist plausibel, aber
  die eigene Vorgabe aus `database.js` (Pool 50, 3 × 52 + 20 = 176) ist nicht umgesetzt. Der
  eigentliche Engpass ist die **CPU-Grenze 0,3**: 300 ms Rechenzeit je Sekunde für alle
  drei Backends zusammen. Damit ist die Kapazität (siehe Kapazitätsaussage) ≈ 3 App-Starts
  je Sekunde bzw. 0,65 Chat-Nachrichten je Sekunde. Die Timeouts der Pool-Konfiguration
  (30 s Statement, 5 s Verbindung, 60 s idle-in-transaction) sind sinnvoll gesetzt; die
  Buchungs-Transaktion (`checkin.js:55–226`) hält den Client nur für 7 Abfragen (0,3 ms).
- **Auswirkung aus Nutzersicht:** In den Spitzen warten alle; ohne Anhebung greifen die
  Behebungen von BF-03/BF-04 nur bis zur nächsten Verdopplung.
- **Beleg:** Rechnung in „Kapazitätsaussage"; `compose.konfi_quest.yml:46: cpus: '0.3'`.
- **Empfehlung:** Postgres auf ≥ 2 CPU und 2–4 GB (`shared_buffers` 1 GB), `PG_POOL_MAX`
  laut eigener Rechnung setzen, `work_mem` prüfen; danach den Sonntags-Lastfall gegen den
  hinterlegten Datenbestand nachmessen.

### BF-14: `/api/metrics/history?days=730` liefert 35 MB
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/createApp.js:487–509`, `backend/services/backgroundService.js:1569`
  (Aufbewahrung 2 Jahre, ein Schnappschuss je 5 Minuten)
- **Kennzeichnung:** reproduziert — `explain-harness.js`
- **Beschreibung:** 210.000 Zeilen ungefiltert als JSON: 47 ms in der Datenbank, aber
  **35.005.521 Byte** Antwort für ein Mobil-Dashboard. Nur super_admin, Voreinstellung 7
  Tage — deshalb NIEDRIG.
- **Auswirkung aus Nutzersicht:** Der super_admin wartet beim Zwei-Jahres-Verlauf auf 35 MB.
- **Beleg:** `GET /metrics/history?days=730 (super_admin): HTTP 200, 35005521 B, 46.7 ms`.
- **Empfehlung:** Ab `days > 30` serverseitig je Stunde/Tag aggregieren (`date_trunc`), oder
  eine Obergrenze für die Zeilenzahl.

### BF-15: `sendRegistrationOpenPushes` schickt nach Rückstand alles auf einmal
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/services/backgroundService.js:541–559` (UPDATE … RETURNING über
  alle fälligen Termine, dann Push je Termin an alle Konfis der Gemeinde)
- **Kennzeichnung:** reproduziert — `jobs-messen.js` mit 5.000 Terminen ohne gesetztes Flag
  (Datenbestand-Artefakt: in Produktion setzt das Anlegen das Flag sofort)
- **Beschreibung:** Stauen sich fällige Termine (Import, langer Ausfall des Leaders,
  Migration mit `false`-Vorgabe), gehen in **einem** Minutenlauf alle Pushes hinaus:
  gemessen 34,1 s, 50.365 Abfragen, 137.910 Log-Zeilen. Im Regelbetrieb kostet der Lauf
  eine Abfrage je Minute — unkritisch.
- **Auswirkung aus Nutzersicht:** Nach einem Ausfall ein Schwall „Anmeldung möglich"-
  Pushes, teils für längst offene Termine.
- **Beleg:** `sendRegistrationOpenPushes (jede Minute): 34102 ms, 50365 Abfragen, Log-Zeilen +137910`.
- **Empfehlung:** Je Lauf höchstens N Termine (LIMIT im UPDATE) und Termine, deren Fenster
  seit > 24 h offen ist, nur noch markieren statt pushen.

### BF-16: Startseeding der Zertifikatstypen läuft auf beiden Replicas ohne `ON CONFLICT`
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/organizations.js:1340–1370` (bei jedem Start: Insert je
  Organisation ohne Zertifikatstypen, ohne `ON CONFLICT`), Unique-Index
  `certificate_types_organization_id_name_key` fängt Doppelte ab
- **Kennzeichnung:** reproduziert — `explain-harness.js`: 800 Schreibabfragen in den
  ersten Sekunden nach `createApp()` bei 200 Gemeinden ohne Typen; `debug-schreibend.js`
  danach: 2 Abfragen
- **Beschreibung:** Starten beide Replicas gleichzeitig gegen eine frische Gemeindemenge,
  verliert eine den Wettlauf je Zeile mit `duplicate key` (Log-Rauschen, `catch` in `:1365`
  schluckt). Funktional harmlos wegen des Unique-Index, aber es ist Schreibarbeit beim
  Start auf dem Anfragepfad, die bei 200 Gemeinden 800 Statements kostet.
- **Auswirkung aus Nutzersicht:** keine.
- **Beleg:** Harness: `GET /auth/me (Konfi): Abfragen: 472 (davon 3 SELECT gemessen)` — die
  übrigen 469 waren diese Inserts.
- **Empfehlung:** `INSERT … ON CONFLICT DO NOTHING` und den Seed in eine Migration bzw. in
  das Anlegen einer Organisation verlegen.

## Unklar

- **Firebase-Zustellrate und -Latenz:** Alle Push-Messungen liefen ohne Firebase (schneller
  Fehlerpfad). Ob FCM bei 48.000 Einzelaufrufen in Folge `quota-exceeded` liefert
  (`pushService.js:165` behandelt es mit drei Versuchen), lässt sich nur in Produktion
  messen. Fehlt: Messwert ms je `send()` aus dem Produktions-Log.
- **SMTP-Grenzen:** `emailService.js` sendet ohne Warteschlange, Rate oder Pooling
  (`nodemailer.createTransport` ohne `pool: true`); heute gehen nur Lizenz-, Lösch- und
  Passwort-Mails hinaus (Dutzende je Tag). Bei einem Massenversand wäre das Limit des
  Anbieters (`server.godsapp.de`) die Grenze — unbekannt.
- **`X-Real-IP` wird ungeprüft übernommen** (`server.js:261–265`): Die IP-basierten
  Limiter (Login, Registrierung, Doku) lassen sich mit einem selbstgesetzten Header
  umgehen, falls Apache/Traefik den Header nicht überschreiben. Ob sie das tun, steht
  nicht im Repo. Fehlt: Traefik-/Apache-Konfiguration.
- **1-Tag-Erinnerung um Mitternacht:** `sendEventReminders` (`backgroundService.js:665–690`)
  wählt Termine des Folgetags ohne Uhrzeitfenster — die Erinnerung „Morgen: …" geht im
  ersten Takt nach 00:00 hinaus. Fachlich anderer Bereich; für die Last bedeutet es einen
  Schwall statt Verteilung über den Tag.
- **Speicherbedarf des Node-Prozesses bei 1.000+ Sockets** (25 kB je Socket geschätzt →
  25–50 MB je Replica bei 512 MB Grenze): plausibel, nicht gemessen — kein Lastgenerator
  für Tausende Sockets aufgesetzt.
- **Postgres-Speicher unter Last:** `max_connections=200` × `work_mem` 4 MB ist nur bei
  Sortierungen relevant; ob 1 GB bei 486 MB Daten plus 66 Verbindungen genügt, hängt vom
  Cache-Trefferanteil ab — nur in Produktion messbar (`pg_stat_database.blks_hit`).

## Alte Befunde nachgeprüft

- `docs/offene-befunde.md` Nr. 3 „Nächtlicher Datenbank-Dump war leer" (10.09.2026, BEHOBEN):
  liegt außerhalb des Repos (Sicherungsskript auf dem Server) → **nicht prüfbar**.
- `docs/offene-befunde.md` Nr. 12 „init-scripts weicht vom Produktionsschema ab" (IN
  ARBEIT): `init-scripts/README.md` beschreibt inzwischen den Dump-Ansatz, `01-create-schema.sql`
  vorhanden; Schema-Abgleich gehört in den Datenbank-Bereich → **nicht in diesem Bereich
  geprüft**.
- Kommentar `database.js:9–18` (24.09.2026): „PG_POOL_MAX gehört ins Compose" →
  **weiter offen**, Compose setzt keine PG_*-Variablen (BF-13).
- Kommentar `compose.konfi_quest.yml:11–13` und `rolling-deploy.sh:1–16` (21.06.2026):
  rollender Deploy nicht scharf → **weiter offen** (BF-12).
- Kommentar `server.js:416–436` (27.08.2026): Doppel-Listener-Absturz bei fehlerhaftem
  Socket.IO-Handshake → **behoben bestätigt**: `server.on('request')` prüft
  `res.headersSent || res.writableEnded`; im Zwei-Instanzen-Test kein Absturz durch
  Handshakes.
- Kommentar `database.js:76–83` (Audit 03.07.2026): parallele Migrationen beider Replicas →
  **behoben bestätigt**: Advisory-Lock 723001, Lesen von `schema_migrations` erst nach dem
  Lock; zwei gleichzeitige Starts im Test ohne Migrationsfehler (`replicaA.log`,
  `replicaB.log`: „Migrations: keine neuen (89 total)").
- Kommentar `pushService.js:100–118` (24.09.2026): `sendToMultipleUsers` in Blöcken →
  **behoben bestätigt**, gemessen 232 Abfragen für 1.000 Empfänger. Aber: Chat-Fan-out und
  Erinnerungen nutzen den Weg nicht (BF-04, BF-05).
- Kommentar `chatSyncCache.js:19–20`: Cache je Replica „bewusst akzeptiert" → **so
  vorgefunden**; Wirkung gemessen: kalter Raumlisten-Aufruf 8 statt 1 Abfragen (Konfi),
  18 statt 1 (org_admin), je Replica einmal je 10 Minuten — vertretbar.

## Geprüft und in Ordnung

- **Konfi-Dashboard, Profil, Abzeichen, Anträge, Postfach, Raumliste, Nachrichtenliste bei
  Zielgröße:** alle Abfragen mit Index, 0,1–4,5 ms je Abfrage, Summe je Route ≤ 11 ms
  (EXPLAIN-Harness, Tabelle oben). `idx_notifications_unread`, `idx_chat_messages_room_created`,
  `idx_event_bookings_event_status`, `idx_push_tokens_user_id` tragen ihre Abfragen.
- **Zähler-Endpunkt `GET /notifications/badge-counts`:** 4 Abfragen / 3 ms (Konfi), 7 /
  10,9 ms (org_admin) — der Ersatz der früheren Voll-Abrufe hält.
- **Push-Empfängerermittlung `getTokensForUsers`** (`pushService.js:337`): 115 Konfis in
  1,04 ms, eine Abfrage (EXPLAIN direkt, Abfrage 8). **`sendToMultipleUsers`:** 115
  Empfänger 153 ms / 24 Abfragen, 1.000 Empfänger 1.336 ms / 232 Abfragen, Postfach-
  Einträge exakt 1.115 (gezählt).
- **Socket.IO über zwei Replicas** (`@socket.io/postgres-adapter`, `server.js:58–73`): Eine
  per HTTP an Instanz A gesendete Nachricht erreichte den Client an Instanz B
  (`socket-test.js`, TEST 1: Client an B empfing Nachricht id 1000002). Der Adapter
  verbindet nach `end` selbst neu (`util.js:86–90`) — nur der `error`-Fall fehlt (BF-01).
- **Migrationen bei parallelem Start** (`database.js:76–106`): Advisory-Lock, Lesen nach
  dem Lock, je Migration eine Transaktion; zwei Instanzen gleichzeitig gestartet ohne
  Konflikt.
- **Uploads bei zwei Replicas:** `compose.konfi_quest.yml:82, 143, 218` mounten dasselbe
  Host-Verzeichnis `/opt/Konfi-Quest/uploads` in alle drei Backends; `photoStorage.js:73–76`
  und `createApp.js:145–152` (auch `tmp/`) liegen darunter. Kein Lokal-Platten-Problem.
- **Verbindungspool** (`database.js:51–63`): `statement_timeout` und `query_timeout` 30 s,
  `connectionTimeoutMillis` 5 s, `idle_in_transaction_session_timeout` 60 s; `pool.on('error')`
  für leerlaufende Verbindungen; Pool-Zustand in `/api/metrics` (`wartend`) sichtbar —
  im Wrapped-Test korrekt `wartend: 20` gemeldet.
- **Check-in-Transaktion** (`checkin.js:55–226`): 7 Abfragen, 0,3 ms, Client nur innerhalb
  der Transaktion gehalten, Nacharbeit nach `release()`. Anwesenheitszähler für das
  10-s-Polling 0,11 ms (EXPLAIN direkt, Abfrage 10).
- **Rate-Limits gegen Schulklassen hinter einer NAT-Adresse:** `userOrIpKey`
  (`server.js:266–277`) zählt angemeldete Anfragen je Konto; die IP greift nur für
  Login/Refresh/Registrierung mit `skipSuccessfulRequests`. 30 Konfis × 25 Start-Anfragen
  = 750 in derselben Viertelstunde lägen selbst je IP unter 2.000; 30 Registrierungen
  unter 200/h. Passt — Vorbehalt `X-Real-IP` siehe Unklar.
- **Token-Bereinigung `cleanupStaleTokens`:** 4 Abfragen, 43 ms bei 48.000 Tokens.
  **`cleanupAlteMitteilungen`:** 1 Abfrage, 2 ms (Index `idx_notifications_created`).
  **`runAutoDeletion` / `runJahrgangDeletionReminders`:** 1.201 / 801 Abfragen, 609 / 195 ms
  für 400 Jahrgänge — täglich einmal, unkritisch. **`checkPendingEvents`:** 50 ms Abfrage +
  200 Gemeinde-Pushes = 2,5 s, täglich.
- **`generateAllTeamerWrapped`** (`wrapped.js:3216–3313`): ein Client, Savepoint je
  Person, Rollback bei null Snapshots, idempotent über den Zeitraum — so sollte auch der
  Konfi-Weg arbeiten (BF-06).
- **APM (`utils/apm.js`) sendet nichts nach außen:** keine `fetch`/`http`-Aufrufe im Modul,
  alles im Prozessspeicher; Nutzer:innen nur als gekürzter SHA-256-Hash (`:142–151`);
  Peer-Aggregation nur über `METRICS_PEERS` im internen Netz (`createApp.js:451–483`),
  `/api/metrics*` nur `is_super_admin`. Gemessen: `/api/metrics` zeigt beide Replicas mit
  `share`, `dbPool` je Replica und Summe (TEST 5).
- **`/api/health` ohne Datenbankprüfung** (`createApp.js:380–382`): bewusst, damit ein
  hängender DB-Check den gesunden Container nicht aus dem Pool nimmt; `/api/status` prüft
  die Datenbank getrennt (503 bei Fehler).
- **Startzeit:** 2,86 s bis `/api/health` 200 inklusive Prüfung von 89 Migrationen.
- **Unbehandelte Promise-Ablehnungen** (`server.js:560–562`): nur loggen — verhindert
  Neustartschleifen durch Hintergrundjobs; im Job-Test warf kein Job ungefangen.
- **Speicherwachstum der Tabellen:** bei Zielgröße 486 MB gesamt (chat_messages 164 MB je
  1 Mio., notifications 110 MB je 500.000, apm_snapshots 29 MB je 2 Jahre) — passt in die
  1-GB-Grenze, Chat-Nachrichten haben aber keine Aufbewahrungsgrenze (siehe „Nicht
  geprüft"/„Auf Produktion nachzumessen").

## Nicht geprüft

- Ein Lastgenerator mit hunderten gleichzeitigen Socket- und HTTP-Clients gegen die zwei
  Instanzen (die Maschine teilen sich 13 Agenten; die Kapazitätsaussage ist aus
  gemessenen Einzelkosten gerechnet, nicht unter Parallellast gemessen).
- Traefik-Verhalten beim Ausfall einer Replica (kein Traefik lokal).
- Tatsächliche Fotogrößen nach `mediaCompression.ts` (kein Browser-Canvas im Container):
  Der Code skaliert auf 1920 px lange Kante bei JPEG 0,8 und lässt Bilder ≤ 500 kB und
  ≤ 1920 px unverändert (`mediaCompression.ts:11–17, 92`); der Server nimmt bis 5 MB je
  Antragsfoto, 5 MB je Chat-Anhang, 20 MB Material, **50 MB je Challenge-Beitrag** an
  (`createApp.js:15, 196, 223, 255`). Obergrenze bei 25.000 Konfis × 2 Fotoanträge × 5 MB =
  250 GB/Jahr, realistisch bei 0,5 MB ≈ 25 GB; Challenge-Videos bei 5 Beiträgen × 25.000 ×
  50 MB bis 6 TB/Jahr. `scripts/cleanupOrphanPhotos.js` wird **nur von Hand** aufgerufen
  (`docker exec`, Kopfkommentar) — kein Cron, keine Plattenplatz-Überwachung im Repo.
- Chat-Aufbewahrung: `chat_messages` werden nur mit Raum, Termin, Jahrgang, Konto oder
  Organisation gelöscht (kein Alters-Aufräumen gefunden: `grep -rln "DELETE FROM
  chat_messages" backend` trifft `routes/chat.js`, `routes/events/verwaltung.js`,
  `routes/jahrgaenge.js`, `routes/users.js`, `routes/organizations.js`,
  `utils/konfiDeletion.js`) — Wachstum 164 MB je Million; ob das gewollt ist, ist eine
  Datenschutz-Frage (anderer Bereich).
- Android/iOS-seitige Folgen von 48.000 stillen Pushes (BF-02).

## Auf Produktion nachzumessen

```sql
-- Verbindungen und Wartende je Backend (max_connections 200)
SELECT usename, application_name, state, count(*) FROM pg_stat_activity GROUP BY 1,2,3;
-- Cache-Trefferquote (unter 99 % -> shared_buffers zu klein)
SELECT datname, blks_hit::float/(blks_hit+blks_read) FROM pg_stat_database WHERE datname='konfi_db';
-- Tabellengrößen und Wachstum
SELECT relname, pg_size_pretty(pg_total_relation_size(oid)) FROM pg_class
 WHERE relkind='r' AND relnamespace='public'::regnamespace ORDER BY pg_total_relation_size(oid) DESC LIMIT 15;
-- Terminliste: läuft die View voll? (erwartet nach BF-03: kein Seq Scan)
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM event_booking_stats WHERE event_id = <id>;
```

```bash
# Dauer eines FCM-Aufrufs und Anteil "Keine Push-Tokens" im Log (für BF-02/BF-04/BF-11)
docker logs --since 24h konfi_quest-backend-1 | grep -c "Keine Push-Tokens"
docker logs --since 24h konfi_quest-backend-1 | grep -c "Firebase notification error"
# Log-Rotation: wie alt ist die älteste noch vorhandene Zeile?
docker logs konfi_quest-backend-1 2>&1 | head -1
# Zähler-Lauf nach einem Deploy: Dauer und Push-Zahl (BF-02) aus dem Log
docker logs konfi_quest-backend-1 2>&1 | grep -n "Abzeichen-Prüfung\|Token cleanup\|Badge update failed" | tail
# Deploy-Lücke: Sekunden mit 502/503 im Traefik-Access-Log um den Deploy-Zeitpunkt
# Postgres: CPU-Drosselung sichtbar? (throttled_time steigt = Grenze 0,3 greift)
cat /sys/fs/cgroup/$(docker inspect -f '{{.Id}}' konfi_quest-postgres-1 | head -c 12)*/cpu.stat 2>/dev/null
docker stats --no-stream konfi_quest-postgres-1
```

- `SMTP`: Sendegrenze des Anbieters (Mails/Stunde) beim Anbieter erfragen; heute
  irrelevant, vor einem Massenversand (Elternbriefe o. ä.) Pflicht.
- Plattenplatz `/opt/Konfi-Quest/uploads` (`du -sh`) und Wachstum je Woche; ob
  `cleanupOrphanPhotos.js --dry-run` etwas findet.
- Traefik/Apache: wird `X-Real-IP` vom Proxy überschrieben (Curl mit gesetztem Header
  gegen `/api/docs-auth/anmelden`, 21-mal: 429 muss unabhängig vom Header kommen).

---

*Messumgebung: PostgreSQL 16.13 lokal (Port 5439, `shared_buffers` 128 MB, keine
CPU-Grenze), Node 22.22. Skripte und Rohausgaben liegen unter
`scratchpad/betrieb-skalierung/` (`gen-data.sql`, `explain-harness.js`, `explain-direkt.sql`,
`jobs-messen.js`, `zaehler-steady.js`, `replica-tests.sh`, `socket-test.js`, `*-ergebnis.txt`).
Die Datenbank `konfi_test` auf Port 5439 bleibt mit dem Zielgrößen-Bestand stehen, damit
die Koordination die Messungen wiederholen kann.*
