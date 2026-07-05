# Changelog

Alle nennenswerten Änderungen an Konfi Quest. Format lose angelehnt an
[Keep a Changelog](https://keepachangelog.com/de/). Neueste Version oben.
Dieser Changelog wächst fortlaufend mit — jede Änderung wird hier eingetragen.

---

## [Unreleased]

### 🐛 Timeslot-Events: Warteliste gilt jetzt pro Zeitslot
Bei Events mit Zeitslots entschied die event-weite Gesamtkapazität über
Anmeldung/Warteliste — ein voller Einzelslot wurde als "noch Platz" gewertet,
die Warteliste griff nie, und die nachgelagerte Slot-Prüfung warf nur ein
hartes "Dieser Zeitslot ist bereits ausgebucht" ohne Wartelisten-Option.
- **Buchung entscheidet jetzt pro Slot:** voller Slot + Warteliste aktiv →
  Warteliste für DIESEN Slot; voller Slot ohne/volle Warteliste → 400. Der
  Slot wird beim Buchen gesperrt (FOR UPDATE) gegen Doppelbuchung des letzten
  Platzes. Andere Slots bleiben unabhängig buchbar.
- **Nachrücken beim Stornieren** rechnet ebenfalls slot-bezogen (vorher
  event-weit → bei mehreren Slots rückte niemand oder der Falsche nach).
- **Admin-Sicht:** Timeslots liefern jetzt `waitlist_count` pro Slot
  zusätzlich zu `registered_count`.
- Tests: voller Slot → Warteliste, Nachrücken im selben Slot, voller Slot ohne
  Warteliste → 400, zweiter Slot bleibt frei buchbar.

### 🔒 Org-Isolation: fremde IDs in Request-Bodies werden abgewiesen (Backend)
Fund vom 05.07.: Ein Admin aus Org A konnte Events mit Jahrgängen aus Org B
anlegen — die ID-Arrays aus Request-Bodies wurden nie gegen die Organisation
geprüft. Neuer zentraler Guard `allIdsBelongToOrg` (utils/orgOwnership.js),
eingezogen in ALLE Schreibpfade der Klasse: Events (Create, Update, Serien:
jahrgang_ids + category_ids), Aktivitäten (Create, Update: category_ids),
Material (Create, Update: event_ids, jahrgang_ids, tag_ids). Fremde IDs
geben jetzt 400 mit klarer Meldung. 4 neue Tests (Cross-Org-Jahrgang,
Cross-Org-Kategorie, PUT-Unterschieben, Eigener-Jahrgang bleibt erlaubt).

### ⚡ Badge-Endpoint: ~60 sequenzielle Queries → 11 parallele (Backend)
`GET /konfi/badges` berechnete den Fortschritt pro Badge mit eigenen, sequenziell
ausgeführten Queries — bei ~130 aktiven Badges bis zu ~60 DB-Roundtrips und
~1s Antwortzeit (der Endpoint war damit der langsamste des App-Öffnens-Bursts,
sogar 304-Antworten kosteten ~1s). Jetzt werden alle badge-unabhängigen
Aggregate EINMAL parallel vorab geladen (Blaupause: teamer.js GET /badges),
die Schleife rechnet rein in-memory. Zählsemantik pro criteria_type unverändert
und adversarial gegen die Vergabe (badges.js) verifiziert.
- **Zwei Org-Filter-Drifts dabei gefixt:** `unique_activities` und `bonus_points`
  zählten im Fortschritt org-übergreifend, die Vergabe aber org-gefiltert —
  Multi-Org-Konfis konnten 10/10 sehen, ohne dass der Badge je kam. Progress
  zählt jetzt wie die Wertung (badges.js:166/168).
- Lookup-Maps als `Map` statt Plain Object (Kategorie-/Aktivitätsnamen wie
  "constructor" hätten sonst den Prototype getroffen).
- `activity_combination`: Duplikate in `required_activities` zählen jetzt wie
  in der Vergabe (bewusste Angleichung, vorher COUNT DISTINCT).
- Tests: 6 neue Progress-Tests (unique_activities inkl. Fremd-Org,
  bonus_points inkl. Fremd-Org, category_activities über Aktivität+Event,
  time_based-Zeitfenster, streak).

## [1.4.2] – 2026-07-05 — Stabilitäts-Release (Auth/Token + Foto-Upload)

**iOS Build 80 + Android versionCode 69** (Build 79/vc68 waren Zwischenstände,
Submission zurückgezogen und mit Foto-Fix neu eingereicht). Store-Notes: App
startet nach längerer Pause spürbar schneller, Chat und Live-Updates verbinden
zuverlässiger neu, Fotos bei Aktivitätsanträgen laden jetzt auch mit schlechter
Verbindung zuverlässig hoch.

### 🐛 Aktivitätsfotos: Live-Fotos zu groß, Uploads brechen ab
Konfis fotografieren Nachweise live — Handykameras liefern 8–16 MB. Die
Antrags-Modals luden das **Original** hoch (Kompression gab es nur im Chat)
und wiesen Kamerafotos >5 MB schon clientseitig mit "Foto ist zu groß" ab;
dazu killte der globale 20s-axios-Timeout langsame Uploads auf Mobilfunk, und
der Auto-Retry lud das volle Bild erneut.
- **`compressForUpload` (mediaCompression.ts):** komprimiert erst (1920px/JPEG
  q0.8 wie im Chat, Preview-URL wird freigegeben), prüft DANN gegen 5 MB —
  in beiden ActivityRequestModals (Konfi + Teamer:in) eingebaut; der
  Offline-Queue-Pfad übernimmt automatisch das komprimierte Foto.
- **Upload-Timeouts 60s** statt global 20s: Antrags-Modals, Chat-Upload (nur
  mit Datei), writeQueue-Replays (Foto + FormData-Medien).
- **Backend:** Multer `LIMIT_FILE_SIZE` antwortet jetzt 413 mit klarer
  deutscher Meldung statt generischem 500.
- Tests: compressForUpload-Suite (Durchreichen, Limit-Fehler, URL-Freigabe).

### 🐛 Auth: App-Öffnen-Hänger + Socket-Reconnect-Fehler durch abgelaufene Tokens
Traefik-Access-Logs (neu, s.u.) zeigten die Ursache der sporadischen "App hängt
kurz"-Momente: Beim App-Öffnen nach >15 Min war der Access-Token abgelaufen —
der Request-Burst lief erst in 401s und wartete dann gesammelt ~1s auf die
Token-Rotation; parallel lehnte der Server jeden Socket.io-Reconnect mit
"jwt expired" ab (166 WebSocket-500er an einem Vormittag), sodass Chat/Live-
Updates am Notfallpfad (Auth-Error → kompletter Socket-Neuaufbau) hingen.
- **Proaktiver Token-Refresh (`ensureFreshToken` in api.ts):** Der Request-
  Interceptor prüft das `exp`-Claim clientseitig und refresht VOR dem Senden —
  einmal pro Ablauf statt 401-Umweg pro Request. Parallele Aufrufer teilen sich
  den Refresh; bei transienten Fehlern bleibt die Session unangetastet (das
  entscheidet weiterhin allein der 401-Interceptor).
- **Socket-Token pro Handshake frisch (websocket.ts):** `auth` ist jetzt ein
  Callback, der sich vor jedem (Re-)Connect via `ensureFreshToken` den
  aktuellen Token besorgt — statt des beim Erstellen eingefrorenen Objekts.
- **Latenter Bug behoben:** Requests, die auf einen laufenden Refresh warteten,
  blieben bei dessen Scheitern als nie-auflösende Promises hängen — Subscriber
  haben jetzt einen Fehlerpfad und werden sauber rejected.
- Tests: `ensureFreshToken` (gültig/abgelaufen/parallel/Fehlerfall) in
  api.test.ts; Request-Interceptor-Tests auf async umgestellt.

### 🔧 Infra: Traefik-Ausbau, ntfy-Monitoring statt Uptime Kuma, CPU-Limits persistent
- **Traefik (Stack 245):** File-Provider (`/opt/stacks/traefik/dynamic`, watch)
  mit Middlewares `retry-deploy` (3 Versuche — überbrückt CI-Deploy-Fenster),
  `ratelimit-default`/`ratelimit-auth` (per X-Real-IP, da hinter Apache) und
  `compress-default`; Access-Log JSON gefiltert (nur 5xx + Requests >800ms);
  Prometheus-Metrics auf 127.0.0.1:8899. `retry-deploy` hängt an den
  konfi-api-/konfi-frontend-Routern.
- **Monitoring:** `/opt/scripts/healthcheck-ntfy.sh` (Cron: critical 3 Min,
  full 10 Min, Zertifikate täglich) alarmiert via ntfy auf die bestehenden
  Kuma-Topics `uptime`/`uptime-critical` — ersetzt Uptime Kuma (Dauer-SQLite-
  Schreiblast entfällt).
- **Nextcloud-AiO-CPU-Limits persistent:** `/opt/scripts/enforce-cpu-limits.sh`
  stündlich per Cron (AiO-Updates erstellen Container sonst ohne Limits neu).

## [1.4.1] – 2026-07-04 — an Apple + Google in Review

**iOS Build 78 (App Store, eingereicht) + Android versionCode 67 (Google Play
internal/alpha/production, automatisch in Review).** Sichtbare Highlights der
Store-Release-Notes: Chat-Nachrichten erscheinen sofort und flüssig, Tastatur
bleibt beim Senden offen, Umfragen/Votes live, Chat-Push öffnet direkt den
Raum, "Neue Nachrichten"-Marker als einmaliger Einstiegs-Indikator, kein Push
mehr vom vorherigen Konto, Push bei Termin-/Ortsänderung gebuchter Events,
Warteliste auffüllen + "Alle bestätigen", Direktchats mit Teamer:innen wieder
sichtbar. Alles Weitere (Audit-Phasen F–H, Multi-Org-Chat-Sync, DB/Query-Umbau)
lief als "Verbesserungen unter der Haube".

### 🐛 Chat: Direktchat mit Teamer:innen unsichtbar + Doppel-Blitzen beim Senden
- **Direktchat für Teamer:innen unsichtbar (Migration 117).** `POST /chat/direct`
  kannte als `target_user_type` nur `admin|konfi` — Teamer:innen wurden als
  `'admin'` in `chat_participants` eingetragen, lesen ihre Räume aber als
  `'teamer'`: Der Chat kam als Push an, tauchte aber nie in der Raumliste auf
  (gleiche Fehlerklasse wie Migration 098). Der Server leitet den `user_type`
  jetzt IMMER selbst aus der echten Rolle ab (Direktchats UND Gruppen-Teilnehmer
  in `POST /rooms`, nie mehr vom Client übernommen); Migration 117 repariert
  die Bestandsdaten (`backend/routes/chat.js`,
  `backend/migrations/117_fix_chat_participant_user_types.sql`).
- **"Neue Nachrichten"-Trenner sprang über eigene Nachrichten.** Der Trenner
  wurde per Index (`länge − ungelesen`) aus der aktuellen Listenlänge berechnet —
  jede neu angehängte (auch eigene) Nachricht schob ihn nach unten. Er wird
  jetzt einmalig per Message-ID an der ersten ungelesenen Nachricht verankert
  und bleibt dort stehen (`frontend/src/components/chat/ChatRoom.tsx`).
- **Kein Push mehr vom alten Account nach Logout+Login.** Der Push-Token-DELETE
  lief beim Logout NACH `clearAuth()` — der Endpoint verlangt Auth, der Call
  bekam still einen 401, der Token blieb beim alten User registriert. Dazu
  blockte das 12h-Sendefenster die Neu-Registrierung für den neuen Account.
  Dreifach-Fix: DELETE läuft jetzt VOR clearAuth (noch authentifiziert, mit
  Timeout), clearAuth setzt das Sendefenster zurück, und bei Account-Wechsel
  innerhalb der Session wird der bekannte FCM-Token sofort für den neuen User
  registriert (Server hängt ihn um) (`frontend/src/services/auth.ts`,
  `tokenStore.ts`, `contexts/AppContext.tsx`).
- **Chat-Push öffnet jetzt direkt den richtigen Raum.** Der Notification-Tap
  navigierte zu `/chat?room=<id>` — den Query-Parameter konsumierte keine
  Seite, man landete auf der Übersicht. Jetzt direkt `/chat/room/:roomId`
  (`frontend/src/contexts/AppContext.tsx`).
- **"Neue Nachrichten"-Trenner ist ein einmaliger Einstiegs-Indikator.**
  Verschwindet, sobald man selbst etwas schreibt; beim Verlassen des Raums wird
  er verworfen und erscheint beim Wiederbetreten nur, wenn seither wirklich
  neue Nachrichten kamen (derselbe Anker wird pro Raum nie zweimal gezeigt —
  auch nicht bei veraltetem unread_count aus dem Cache)
  (`frontend/src/components/chat/ChatRoom.tsx`).
- **Tastatur bleibt beim Senden offen (iOS/Android).** Nach dem Senden wird der
  Senden-Button disabled (Text leer) — der Browser warf den Fokus auf BODY,
  iOS schloss die Tastatur (im Web verifiziert: `activeElement` = BODY nach
  Klick, trotz pointerdown-preventDefault). Fix: Fokus wird synchron in der
  Klick-Geste per `setFocus()` ins Textfeld zurückgesetzt
  (`frontend/src/components/chat/ChatRoomSections.tsx`). Der in Build 76
  probierte Keyboard-Resize-Modus `native` sah schlechter aus (unanimierter
  Frame-Sprung) und ist zurück auf `ionic`. iOS Build 77 (1.4.1) zu TestFlight.
- **Neue Nachrichten erscheinen jetzt zackig statt ruckelig.** (1) React-Key der
  Bubbles bevorzugt `client_id` — beim Bestätigen der eigenen Nachricht
  (optimistisch → Server) wird die Bubble nicht mehr neu gemountet, nichts
  blitzt. (2) Auto-Scroll bei neuen Nachrichten springt sofort (0ms) statt 300ms
  zu animieren; eigener Sende-Scroll per Doppel-rAF direkt nach dem Rendern
  statt setTimeout+Animation (`frontend/src/components/chat/ChatRoom.tsx`).
- **Eigene Nachricht blitzte kurz doppelt auf.** Nach dem Senden hängte der
  `newMessage`-Socket-Handler die Server-Kopie ZUSÄTZLICH unter die noch
  sichtbare optimistische Nachricht; erst der Voll-Reload danach räumte auf
  (<1s Doppelanzeige). Der Handler ersetzt die optimistische Nachricht jetzt
  in-place (Match über `client_id`), der Voll-Reload pro Senden entfällt —
  Fallback-Reload nur noch, wenn der Socket binnen 2,5s nicht liefert
  (`frontend/src/components/chat/ChatRoom.tsx`, `frontend/src/types/chat.ts`).

### 🐛 Chat-Sync kennt Multi-Org-Mitgliedschaften (Org-Switcher)
- **Eingewechselte Mitglieder flogen aus den Chats.** Die Soll-Mitglieder-Queries
  in `syncJahrgangChat`/`syncTeamChat` kannten nur die Primär-Org
  (`users.organization_id` + `users.role_id`) — wer über den Org-Switcher
  (`user_organizations`, Migration 101) in einer zweiten Org Org-Admin/Admin/
  Teamer:in ist, war für den Sync unsichtbar und wurde beim nächsten Lauf aus
  Jahrgangs- und Team-Chats der Zweit-Org **entfernt** (so verschwand der
  Hennstedt-Jahrgangschat beim eingewechselten Org-Admin). Beide Queries und der
  Org-Admin-Schutz berücksichtigen jetzt zusätzlich `user_organizations`
  (`backend/utils/jahrgangChat.js`, `backend/utils/teamChat.js`).
- **Neue Teamer:innen/Admins sofort im Team-Chat.** `POST /api/admin/users` rief
  keinen Chat-Sync auf — seit dem Sync-TTL (Phase D2) erschienen neue
  Teammitglieder erst nach bis zu 10 Minuten im Team-Chat. Die User-Anlage synct
  jetzt inline (Org-Admins zusätzlich in alle Jahrgangs-Chats), Rollen-/
  Aktiv-Änderungen im PUT syncen ebenfalls inline und invalidieren den
  Sync-Cache (`backend/routes/users.js`).
- **Switcher-Members-Endpoints syncen mit.** `POST/DELETE /organizations/:id/members`
  pflegen die Chat-Mitgliedschaft der Ziel-Org jetzt direkt (Aufnahme bzw.
  Rauswurf ohne TTL-Wartezeit) (`backend/routes/organizations.js`).
- Tests: `tests/utils/chatMembershipSync.test.js` (uo-Org-Admin bleibt drin,
  uo-Teamerin mit Zuweisung kommt rein, Nicht-Mitglieder fliegen weiter raus,
  Primär-Org-Regression) + users-Test "sofort im Team-Chat".

### Events-Umbau + Änderungs-Push (Audit Phase H)
- **Events-Listen-Queries restrukturiert (Audit Achse 4, Fund 9).** `GET /events`
  (Admin/Teamer/Konfi) und `GET /konfi/events` bauten eine Join-Explosion
  (events × bookings × users × roles × categories × jahrgang_assignments vor
  GROUP BY) mit korrelierten Subqueries pro Zeile (material_count,
  waitlist_position). Beide Queries arbeiten jetzt mit LATERAL-Aggregaten pro
  Anliegen (Buchungs-Zähler via `COUNT(*) FILTER`, Kategorien/Jahrgänge als
  Sub-Selects, eigene Buchung mit `LIMIT 1`, Wartelisten-Position als eigenes
  LATERAL) — kein GROUP BY über die ganze Breite mehr. Die JSON-Response ist
  feldgenau identisch (`backend/routes/events.js`, `backend/routes/konfi.js`).
- **Datumsfenster für Events-Listen.** Beide Endpoints liefern standardmäßig nur
  noch Events des letzten Jahres (plus alle zukünftigen) — die Listen wachsen
  damit nicht mehr unbegrenzt mit den Jahrgängen. `?all=true` liefert weiterhin
  die gesamte Historie (aktuell von keiner View benötigt, Escape-Hatch für
  spätere Statistik-Ansichten).
- **Push bei Terminverschiebung (Audit Achse 3).** `PUT /events/:id` sendete bei
  Änderungen nur ein LiveUpdate — gebuchte Teilnehmer mit App im Hintergrund
  erfuhren von Datum-/Uhrzeit-/Ortsänderungen nichts. Jetzt geht nach dem COMMIT
  ein Push an alle gebuchten Teilnehmer (confirmed + Warteliste, rollenneutral
  inkl. Teamer:innen) mit dem konkret geänderten Wert ("Neuer Termin: …" /
  "Neuer Ort: …"). Alt/Neu-Vergleich normalisiert Datumswerte, damit der Push
  nur bei echten Änderungen feuert; nur für zukünftige, nicht abgesagte Events.
  Neuer Typ `event_changed` via `sendEventChangedToKonfis`
  (`backend/routes/events.js`, `backend/services/pushService.js`).
- Tests: Datumsfenster + Response-Shape für beide Listen-Endpoints,
  Änderungs-Push positiv/negativ (`backend/tests/routes/events.test.js`,
  `backend/tests/routes/konfi.test.js`).

### Chat-Feinschliff (Audit Phase G)
- **Umfragen erscheinen live (Audit Achse 2, Luecke 10a).** `POST /chat/rooms/:id/polls`
  legte die Umfrage-Nachricht an, sendete aber kein Socket-Event — Teilnehmer
  sahen die Umfrage erst nach Reload/Fallback-Poll. Der Handler emittet jetzt
  `newMessage` (an den Raum UND die persoenlichen User-Raeume aller Teilnehmer,
  exakt nach dem Muster des Nachrichten-Handlers) mit einem vollstaendigen
  Poll-Message-Objekt (message_type `poll`, options als Array, Poll-Metadaten,
  leere votes) und verschickt analog zur normalen Nachricht eine
  Push-Benachrichtigung (`backend/routes/chat.js`).
- **Umfrage-Votes aktualisieren sich live (Audit Achse 2, Luecke 10b).** Beide
  Vote-Endpoints (`POST /chat/polls/:id/vote`, `POST /chat/messages/:id/vote`)
  senden nach erfolgreichem Vote ein neues `pollUpdated`-Event an den Raum mit
  dem kompletten aktuellen Poll-Stand (anonymitaets-bewusste Votes, identische
  Struktur wie `GET /messages`). Das Frontend hoert `pollUpdated` und ersetzt
  nur den Poll-Teil der betroffenen Nachricht; Server-Daten gewinnen immer (der
  eigene Vote ist serverseitig ohnehin schon enthalten)
  (`backend/routes/chat.js`, `frontend/src/components/chat/ChatRoom.tsx`).
- **Raum-Aenderungen erscheinen live (Audit Achse 2, Luecke 14).** Direktchat-/
  Gruppen-Erstellung, Raum-Loeschung sowie Teilnehmer hinzufuegen/entfernen/
  verlassen senden jetzt ein `roomsChanged`-Event an die persoenlichen
  User-Raeume der betroffenen Nutzer (bei Raum-Loeschung an alle Teilnehmer, die
  VOR dem Delete eingesammelt werden). Die Chat-Uebersicht bindet einen
  `roomsChanged`-Listener mit `socketEpoch`-Rebind (gleiche Disziplin wie der
  BadgeContext) und laedt die Raumliste neu
  (`backend/routes/chat.js`, `frontend/src/components/chat/ChatOverview.tsx`).

### ⚡ Performance
- **Mark-Read gedrosselt (Audit Achse 4, Fund 13).** Der Effekt in `ChatRoom`
  feuerte pro empfangener Nachricht einen `POST` an den mark-read-Endpoint. Jetzt
  laeuft der erste Aufruf beim Chat-Oeffnen sofort (Badge verschwindet zuegig),
  Folgenachrichten werden mit 1,5s gebuendelt (letzter Aufruf gewinnt). Der
  lokale Badge geht weiterhin SOFORT weg — `badgeMarkRoomAsRead` im BadgeContext
  ist optimistisch; gedrosselt wird nur der Server-POST
  (`frontend/src/components/chat/ChatRoom.tsx`).
- **Chat-Fallback-Poll inkrementell + sichtbarkeitsabhaengig (Audit Achse 4, Fund 4).**
  Der 30s-Fallback-Poll in `ChatRoom` lud bislang immer die vollen 100
  Nachrichten. Er nutzt jetzt den inkrementellen Pfad `loadMissedMessages(lastId)`
  und pollt nur, wenn `document.visibilityState === 'visible'` (Web-Tab im
  Hintergrund pollt nicht; auf Native pausiert das OS den Timer ohnehin). Der
  Poll bleibt als bewusster Anker gegen stillen Socket-Tod erhalten. Deletes
  aelterer Nachrichten kommen ueber das `messageDeleted`-Socket-Event und gehen
  im `after=`-Poll bewusst verloren (`frontend/src/components/chat/ChatRoom.tsx`).
- **Chat-Mitgliedschafts-Sync vom Lesepfad entkoppelt.** `GET /chat/rooms`
  fuehrte bei JEDEM Aufruf den Jahrgangs- und Team-Chat-Sync aus (25-35 Queries
  Schreibarbeit bei einem Org-Admin mit 5 Jahrgaengen — Hauptursache der hohen
  Latenz des meistgerufenen Endpoints, p95 ~919ms). Der Sync laeuft jetzt pro
  User hoechstens einmal je 10 Minuten (In-Memory-TTL). Sicher, weil neue User
  beim ersten Aufruf sofort syncen und alle Mutations-Handler (Jahrgang-
  Zuweisung/-Wechsel, Befoerderung) die Mitgliedschaften ohnehin inline
  korrigieren. Zusaetzlich im Sync die Org-Admin-Schutzpruefung von einer Query
  pro Teilnehmer auf eine Set-Query reduziert (`backend/routes/chat.js`,
  `backend/utils/chatSyncCache.js`, `backend/utils/jahrgangChat.js`).
- **Badge-Zaehler laden keine Volllisten mehr.** Der `BadgeContext` holte fuer
  die Tab-Leisten-Zaehler die komplette Raumliste, alle Antraege und alle Events
  (drei teure Endpoints bei jedem Refresh — u.a. nach jeder Chat-Nachricht).
  Neuer leichtgewichtiger Endpoint `GET /notifications/badge-counts` liefert
  nur die Zahlen (unread pro Raum, pending-Antraege, unverarbeitete vergangene
  Events) mit exakt der Semantik der Listen-Ansichten
  (`backend/routes/notifications.js`, `frontend/src/contexts/BadgeContext.tsx`).
- **ChatOverview-Doppelhandler entfernt (Audit Achse 4, Fund 2).** Die
  Chat-Uebersicht hatte einen eigenen `socket.on('newMessage')`-Handler, der
  `refresh()` (`/chat/rooms`) rief — zusaetzlich zum Effect auf
  `chatUnreadByRoom`, das der `BadgeContext` bei jeder eingehenden Nachricht
  ohnehin aendert. Zusammen mit dem eigenen `/chat/rooms`-Fetch des BadgeContext
  waren das bis zu 3× `/chat/rooms` pro Nachricht. Der redundante Socket-Handler
  ist entfernt; der `chatUnreadByRoom`-Effect bleibt der einzige newMessage-
  Trigger (Kette: BadgeContext `newMessage` → `refreshAllCounts` →
  `chatUnreadByRoom` aendert sich → Effect → `refresh`). Der BadgeContext-Handler
  bindet ausserdem nach Reconnect korrekt neu (`socketEpoch`), was dem entfernten
  ChatOverview-Handler fehlte (`frontend/src/components/chat/ChatOverview.tsx`).
- **device-token-Sendefenster von 10s auf 12h (Audit Achse 4, Fund 5).** Das
  native AppDelegate feuert das `fcmToken`-Event bei JEDER App-Aktivierung; die
  bisherige 10-Sekunden-Anti-Spam-Sperre liess dadurch ~58 `POST /device-token`
  pro 90 Min org-weit durch. Jetzt wird ein UNVERAENDERTER Token nur noch gesendet,
  wenn der letzte erfolgreiche Send > 12h her ist (persistierter Timestamp aus
  `getPushTokenTimestamp`, ueberlebt App-Neustarts). Ein GEAENDERTER Token wird
  weiterhin sofort gesendet; die 10s-In-Memory-Sperre bleibt als Zusatzschutz
  (`frontend/src/contexts/AppContext.tsx`).
- **Push-Listener-Cleanup ergaenzt (Audit Achse 4, Fund 5).** Der Push-Setup-
  Effect (Dep `[user]`) registrierte vier `PushNotifications`-Listener ohne
  Cleanup — bei jedem User-Wechsel akkumulierten sie. Der Effect raeumt jetzt via
  `PushNotifications.removeAllListeners()` auf (gefahrlos, da dies die einzige
  Stelle im Frontend ist, die solche Listener registriert)
  (`frontend/src/contexts/AppContext.tsx`).
- **Konfi-Dashboard-Queries parallelisiert (Audit Achse 4, Fund 8).** Der Handler
  `GET /konfi/dashboard` fuehrte ~9 voneinander unabhaengige Queries sequentiell
  aus (p95 ~1010ms ≈ Summe der Roundtrips). Sie haengen alle nur vom initialen
  `konfi`-Query (bzw. dem daraus berechneten `totalPoints`) ab und laufen jetzt
  gebuendelt in EINEM `Promise.all` — Latenz ≈ langsamste Einzel-Query statt Summe.
  Der konditionale Level-Drift-`UPDATE` bleibt danach. Nebenbei: der
  `to_regclass`-Legacy-Check auf `custom_badges` entfernt (Tabelle seit Migration
  076/090 dauerhafter aktiver Badge-Pfad) und die ungenutzte bonus_points-Summe
  gestrichen (floss nie in die Response) → ein Roundtrip weniger. Response-Struktur
  byte-identisch (`backend/routes/konfi.js`).
- **60-Sekunden-Polling des Konfi-Badge-Zaehlers entfernt.** Die Tab-Leiste
  fragte fuer jeden Konfi 1×/Minute `/konfi/badges` ab, nur um den „neue Badges"-
  Punkt zu aktualisieren. Der Server sendet jetzt beim tatsaechlichen Vergeben
  eines Badges ein LiveUpdate an den Konfi (`checkAndAwardBadges` →
  `insertBadgesAndNotify` → `sendToKonfi('badges','earned')`), das an allen
  Punktevergabe-Stellen (Aktivitaet, Bonuspunkte, Event-Anwesenheit) ausgeloest
  wird. Die App laedt den Zaehler nur noch initial + auf dieses Event
  (`frontend/src/components/layout/MainTabs.tsx`, `backend/routes/badges.js`).
- **30-Sekunden-Polling der Admin-Badges entfernt.** Der `BadgeContext` fragte
  fuer Admins alle 30s `/chat/rooms` (+ `/admin/activities/requests` + `/events`)
  ab — eine offene Admin-App erzeugte so ~120 unnoetige Requests/Stunde und war
  mit Abstand der groesste Traffic-Verursacher (`/api/chat/rooms` = ~38% aller
  Requests). Das Polling war redundant: Chat-Unread laeuft ueber den WebSocket
  (`newMessage`), Antraege/Events ueber LiveUpdate (`requests`/`events`), und nach
  Verbindungsabriss/Push feuern `sync:reconnect`/`push:received` einen Refresh.
  Nur noch der initiale Load bleibt (`frontend/src/contexts/BadgeContext.tsx`).

### ✨ Verbesserungen
- **„Alle bestätigen" verbucht jetzt die Angemeldeten — nicht die Warteliste.**
  Der Button beförderte bisher die komplette Warteliste (und übersteuerte dabei
  die Kapazität) — fachlich gemeint war aber immer die Bulk-Verbuchung: alle
  angemeldeten Konfis ohne Anwesenheits-Status auf einen Schlag als anwesend
  verbuchen, inklusive Punktevergabe und Badge-Prüfung wie beim Einzel-Verbuchen
  (neuer Endpoint `PUT /events/:id/participants/attendance-all`). Bereits
  Verbuchte (anwesend/abwesend) und die Warteliste bleiben unberührt — Nachrücken
  läuft weiterhin automatisch (FIFO bei Absagen) bzw. einzeln. Die beiden
  Warteliste-Bulk-Endpoints (confirm-all, fill-capacity) wurden entfernt.
  Verbuchte bekommen Push + Live-Update (Dashboard bei Punkten)
  (`backend/routes/events.js`, `frontend/.../EventDetailView.tsx`).
  Nebenbei: Double-Release des DB-Clients im alten confirm-all-Handler behoben
  (Early-Returns releasten zusätzlich zum finally — Altlast, warf bei 404/403).

### 🗄️ Datenbank-Härtung (Audit Achse 1, Migrationen 110-116)
- **Verwaiste Daten bereinigt + fehlende Foreign Keys nachgezogen.**
  `activity_categories` hatte keinen FK auf activities (12 verwaiste Zeilen —
  entfernt, FK+Unique ergänzt, Migration 110); Chat-Raum-Leichen aus
  geloeschten Direktchats bereinigt (111, nur Raeume ohne Teilnehmer); sieben
  Kerntabellen ohne `organization_id`-FK abgesichert (112); funktionslose
  FK-Duplikate aus der SQLite-Altlast entfernt (113 — die vier gewollten
  History-Schutz-Paare auf users bleiben); fehlende Chat-FKs mit CASCADE
  nachgezogen (114); NOT-NULL-Härtung auf Kernspalten + Unique-Guard gegen
  doppelte Badge-Vergabe (115); redundante Indizes entfernt (116).
- **Migrationslauf mit Advisory-Lock serialisiert.** Beide Backend-Replikas
  starten beim Deploy parallel und rasten bisher um neue Migrationen
  (beobachtet bei Migration 109: duplicate-key auf einer Replika). Der Lauf ist
  jetzt per `pg_advisory_lock` serialisiert; die zweite Replika sieht die
  Eintraege der ersten und ueberspringt sauber (`backend/database.js`).
- **User-Löschung räumt leere Direktchat-Räume mit auf** — bisher blieben
  Raum-Leichen zurueck (`backend/routes/users.js`).
- **Aktivität mit abgeschlossenen Anträgen löschen gab „Datenbankfehler".**
  Der Delete-Check prüfte nur offene Anträge; der Foreign Key blockte aber auch
  bei abgelehnten/historischen — statt einer verständlichen Meldung kam ein
  500er (gleiche Fehlerklasse wie der behobene Teamer-Lösch-Bug). Jetzt sauberer
  409 mit Hinweis auf die Antragshistorie (`backend/routes/activities.js`).

### 🐛 Fehlerbehebungen
- **WebSocket-Reconnect nach Deploy/Verbindungsabriss robuster (Audit Achse 3B,
  B1/B2/B6).** (1) Der Socket versucht jetzt **unbegrenzt** neu zu verbinden
  (vorher 10 Versuche gedeckelt): Ein Deploy-Downtime-Fenster (~20–40s) verbrannte
  die 10 Versuche endgueltig, danach blieb der Socket bis zum App-Neustart tot.
  Der exponentielle Backoff deckelt bei 30s (`reconnectionDelayMax`), sodass ohne
  Haemmern dauerhaft neu verbunden wird (`frontend/src/services/websocket.ts`).
  (2) Beim App-Resume (Vordergrund) wird der Socket jetzt zuerst aktiv angestossen
  (`ensureSocketConnected()`), bevor die Resume-Sequenz laeuft — nach laengerem
  Hintergrund hing er oft getrennt fest (`frontend/src/contexts/AppContext.tsx`).
  (3) Die gerade sichtbare View laedt nach einem Reconnect frische Daten: Der
  `useOfflineQuery`-Hook hoert jetzt zusaetzlich auf `sync:reconnect` (analog zum
  bestehenden `org:switched`), da Ionic Pages im Router-Outlet cacht und ohne
  Remount sonst keine Revalidierung ausloest (`frontend/src/hooks/useOfflineQuery.ts`).
- **Chat-Badge blieb nach Token-Reconnect stumm (Audit Achse 3B, B4).** Der
  `newMessage`-Listener im `BadgeContext` hing nach `reconnectWithToken` (z.B.
  nach abgelaufenem Token) am verworfenen alten Socket-Objekt und empfing keine
  Nachrichten-Events mehr. Der `LiveUpdateContext` exportiert nun seinen
  `socketEpoch`; der Effekt bindet den Listener bei jeder Epoch-Erhoehung am
  frischen Socket neu (`frontend/src/contexts/LiveUpdateContext.tsx`,
  `frontend/src/contexts/BadgeContext.tsx`).
- **Fehlende Live-Updates in der Verwaltung nachgeruestet (Audit Achse 2,
  Luecken 5/8/11/12/13/15).** Mehrere schreibende Endpoints sendeten nach
  erfolgreicher Aenderung kein Live-Update, sodass Listen auf anderen Geraeten/
  Sitzungen bis zum manuellen Refresh veralteten:
  - **Konfis** (`backend/routes/konfi-management.js`): Anlegen, Aendern, Loeschen
    und Befoerderung zum Teamer senden jetzt `konfis`-Updates an alle Admins/
    Teamer:innen der Org; die Befoerderung zusaetzlich ein `users`-Update (der
    Konfi taucht nun als Teamer:in in der Benutzer-Liste auf).
  - **Selbstregistrierung** (`backend/routes/auth.js`): `register-konfi` sendet
    nach erfolgreicher Anmeldung ein `konfis`-Update an die Admins der Org
    (Org-ID aus dem Einladungscode, da unauthentifiziert).
  - **Benutzer** (`backend/routes/users.js`): Anlegen, Aendern, Loeschen und
    Jahrgangs-Zuweisung senden `users`-Updates. Die `AdminUsersPage` abonnierte
    den Typ bereits, er wurde nur nie gesendet (stilles Abo).
  - **Einstellungen** (`backend/routes/settings.js`): Speichern sendet ein
    `dashboard`-Update an die gesamte Org (Dashboard-Widget- und Punkt-Typ-
    Toggles wirken direkt auf Konfi-/Teamer-Dashboards).
  - **Badges** (`backend/routes/badges.js`): Anlegen/Aendern/Loeschen sendet
    zusaetzlich zum bestehenden Admin-Update jetzt auch ein `badges`-Update an
    die Konfis (der Badge-Katalog der `KonfiBadgesPage` bleibt aktuell).
  - **Organisationen** (`backend/routes/organizations.js`): Anlegen/Aendern/
    Loeschen und Limit-Aenderung senden ein `organizations`-Update an den
    ausfuehrenden (Super-)Admin selbst (Multi-Device-Sync).
- **AdminLevelsPage abonniert Live-Updates (toter Sender).** Der Server sendete
  bei Level-Aenderungen bereits ein `levels`-Event, aber keine View hoerte darauf.
  Die Level-Verwaltung revalidiert jetzt via `useLiveRefresh('levels', ...)`
  (`frontend/src/components/admin/pages/AdminLevelsPage.tsx`).
- **Tote Kompatibilitaets-Listener entfernt.** Die 13 `*Update`-Socket-Listener
  im `LiveUpdateContext` (dashboardUpdate, eventsUpdate, badgesUpdate,
  requestsUpdate, konfisUpdate, pointsUpdate, bookingUpdate, activitiesUpdate,
  categoriesUpdate, jahrgaengeUpdate, levelsUpdate, usersUpdate,
  organizationsUpdate) waren tot: Seit dem Entfernen des globalen `io.emit()` im
  Backend emittiert kein Server-Code mehr diese Events (alle laufen ueber das
  einheitliche `liveUpdate`-Event). Ersatzlos entfernt
  (`frontend/src/contexts/LiveUpdateContext.tsx`).

### 🔒 Sicherheit
- **Aktive Socket-Verbindungen bei Konto-Loeschung, Passwort-Reset und
  Deaktivierung sofort trennen (Audit Achse 3B, B5).** Bisher blieb ein bereits
  verbundener Socket bestehen und empfing weiter Live-Updates, bis der Client von
  selbst neu verband — ein geloeschter/gesperrter User konnte so mit toter Session
  weiter mitlesen. Neuer Helper `disconnectUserSockets(userId)` trennt alle drei
  Raum-Typen (`user_konfi_`/`user_teamer_`/`user_admin_`) via
  `disconnectSockets(true)` (replika-uebergreifend ueber den Postgres-Adapter).
  Aufgerufen im `DELETE /users/:id` (nach COMMIT), `PUT /users/:id/reset-password`
  und bei Deaktivierung (`PUT /users/:id` mit `is_active=false`)
  (`backend/utils/liveUpdate.js`, `backend/routes/users.js`).

- **Fehlende Push- und Live-Update-Benachrichtigungen an mehreren Stellen
  nachgezogen (Audit Achse 2/3).** Betroffen waren: (1) Teamer-Antraege
  (`POST/DELETE /teamer/requests`) — Admins bekamen weder Push noch Live-Update
  ueber neue/entfernte Antraege; jetzt `sendNewActivityRequestToAdmins` +
  `sendToOrgAdmins('requests', …)`. (2) Zertifikat-Zuweisung an Teamer:innen
  (`POST /teamer/:userId/certificates`) — Empfaenger:in erhielt keine
  Benachrichtigung; jetzt Push (`sendToUser`) + `sendToUserByRole('badges')`.
  (3) Wartelisten-Statuswechsel (`PUT /events/:id/participants/:pid/status` und
  `…/confirm-all`) — von der Warteliste bestaetigte Personen erhielten keine
  Push-/Live-Update-Benachrichtigung, bei Degradierung fehlte das
  Dashboard-Update; jetzt `sendWaitlistPromotionToKonfi` +
  `sendToUserByRole('events'/'dashboard')` + `sendToOrgAdmins('events')`.
  (4) Antrag-Reset (`PUT /activities/requests/:id/reset`) — kein Live-Update an
  Antragsliste/Antragsteller:in/Punkte; analog zum Genehmigungs-Handler ergaenzt.
  (5) Serien-Events (`POST /events/series`) — kein Live-Update nach dem Anlegen;
  jetzt `sendToOrg('events', 'create')` (`backend/routes/teamer.js`,
  `backend/routes/events.js`, `backend/routes/activities.js`).
- **Live-Updates und Chat-Events gingen zwischen den beiden Server-Instanzen
  verloren.** Die App laeuft auf zwei Backend-Replikas hinter einem Load-Balancer.
  Socket.IO hatte keinen Adapter — jede Replika emittete nur an ihre EIGENEN
  verbundenen Clients. Ein Live-Update (oder eine Chat-Nachricht), das die
  jeweils andere Replika verarbeitet hat, kam daher systematisch nie an
  (empirisch verifiziert: bei wiederholten Testlaeufen ging konsistent eines
  von zwei Events verloren; der 30s-Fallback-Poll im Chat hat das bisher
  kaschiert). Jetzt verteilt der offizielle `@socket.io/postgres-adapter` alle
  Emits ueber die vorhandene PostgreSQL (NOTIFY/LISTEN) an beide Replikas —
  keine neue Infrastruktur noetig (`backend/server.js`, Migration
  `109_socketio_pg_adapter.sql`).
- **Teamer:innen bekamen nie Live-Updates.** Alle Echtzeit-Aktualisierungen an
  „Admins der Organisation" (neue/geaenderte Antraege, Events, Zaehler) gingen
  ausschliesslich in den Admin-Socket-Raum, obwohl Teamer:innen in einem eigenen
  Raum (`user_teamer_<id>`) sitzen — sie waren dadurch faktisch vom gesamten
  LiveUpdate-System abgeschnitten (Teamer-Antragsliste, Teamer-Events,
  Teamer-Badge-Zaehler aktualisierten sich nie automatisch). `sendToOrgAdmins`
  adressiert Teamer:innen jetzt im korrekten Raum. Zusaetzlich landet ein an
  Teamer:innen vergebenes Badge bzw. der Status eines Teamer-Antrags nicht mehr
  im leeren Konfi-Raum: Ein neuer Helper `sendToUserByRole` schlaegt die Rolle
  des Empfaengers nach und trifft den richtigen Socket-Raum
  (`backend/utils/liveUpdate.js`, `backend/routes/badges.js`,
  `backend/routes/activities.js`). Nebenbei filtern die Org-/Jahrgangs-Sendungen
  jetzt geloeschte User (`deleted_at IS NULL`) heraus.
- **Antrags-Genehmigung sendete einen organisationsuebergreifenden Broadcast.**
  Beim Genehmigen/Ablehnen eines Antrags ging ein globales `io.emit` an ALLE
  Organisationen (Isolation-Verletzung, zudem redundant zu den org-gezielten
  LiveUpdates direkt daneben). Dieser Legacy-Broadcast wurde ersatzlos entfernt;
  die betroffenen Clients erhalten dieselbe Aktualisierung nun ueber das
  regulaere org-gezielte `liveUpdate`-Event (`backend/routes/activities.js`).
- **Benutzer mit Konfi-History liessen sich nicht loeschen ("Datenbankfehler").**
  Wurde ein User geloescht, der noch Antraege, Badges, Aktivitaeten oder
  Bonuspunkte hatte (typisch: ein zum Teamer befoerderter Ex-Konfi), brach der
  Delete mit HTTP 500 ab. Ursache: Die vier History-Tabellen (`activity_requests`,
  `bonus_points`, `user_activities`, `user_badges`) tragen aus der SQLite-Altlast
  je einen zweiten Foreign-Key mit `NO ACTION` neben dem `CASCADE`-FK — beim
  User-Delete gewann `NO ACTION` und blockierte. Der Delete-Handler raeumt diese
  History jetzt explizit vor dem User-Delete ab (`backend/routes/users.js`).
  Nachweisfoto-Cleanup vorgezogen, damit keine Dateileichen zurueckbleiben.
  Das gewuenschte Verhalten bleibt erhalten: Beim **Jahrgang**-Loeschen behalten
  befoerderte Ex-Konfis ihre History (nur die Jahrgang-Bindung faellt weg); erst
  beim Loeschen des **Users selbst** geht dessen History mit weg. Regressionstest
  ergaenzt (`backend/tests/routes/users.test.js`).

### Vorab enthalten seit iOS Build 75 (02.07., TestFlight)

### 🎨 Landing-Page (konfi-quest.de)
- **USP „Von einem Pastor für die Konfi-Arbeit entwickelt" prominent gemacht.**
  Hero-Eyebrow von „Moderne Konfi-Arbeit, die ankommt" auf diesen USP geändert
  und eine neue Story-Sektion („Aus der eigenen Konfi-Arbeit entstanden") mit
  persönlicher Gründungsgeschichte und Signatur ergänzt (`frontend/public/landing.html`).

### 🧪 Tests
- **networkMonitor-Tests an das neue Verhalten angepasst.** Der Android-Fix
  (connectionType `none`/`unknown` = optimistisch online, damit der Login nicht
  faelschlich blockt) hatte die zugehoerigen Tests nicht mitgezogen — dadurch
  war das CI-Deploy-Gate seit dem 30.06. rot und blockierte alle Deploys.
  Test „none → offline" auf das gewollte „none → online" korrigiert und die
  Web-Fallback-Isolation eines Subscribe-Tests robust gemacht (explizites
  `isNativePlatform=false` statt Verlass auf die Test-Reihenfolge).

### 🐛 Fehlerbehebungen
- **Genehmigen/Ablehnen-Buttons (Admin → Antrag) liefen auf schmalen Android-
  Geräten rechts aus dem Bild.** Die beiden nebeneinanderstehenden Buttons hatten
  gleichzeitig `expand="block"` und `flex: 1` gesetzt, was sich mit dem
  Flex-Layout biss; ohne `min-width: 0` konnten sie nicht unter ihre Inhaltsbreite
  schrumpfen. Jetzt teilen sie sich die Breite sauber 50/50 und passen auch auf
  kleinen Displays ins Bild.

### 🎨 Darstellung
- **Konfi-Event-Detail: Anmelde- und Wartelisten-Buttons wieder als gefüllte
  Vollfarb-Buttons.** Die in 1.4.0 testweise auf `fill="outline"` umgestellten
  Buttons („Anmelden", „Wieder anmelden", „Warteliste offen") sind wieder
  vollflächig eingefärbt (grün bzw. gelb), da die dezente Outline-Variante optisch
  nicht überzeugte.

---

## 1.4.0 (Juni 2026) — Production

App-Store-Release. iOS-Builds 64–74, Android versionCode 66. Schwerpunkte:
Medien-Verschlüsselung, Foto-Sichtbarkeit/-Aufräumung, Chat-Darstellungsfixes
und Android-Login-Härtung.

### 🔒 Sicherheit
- **Hochgeladene Medien werden jetzt verschlüsselt gespeichert (AES-256-GCM).**
  Betrifft alle drei Upload-Arten: Antrags-Nachweisfotos, Chat-Medien (Bilder,
  PDFs, Videos, Audio, Office-Dateien) und Team-Material. Die Dateien liegen
  nicht mehr im Klartext auf dem Server, sondern werden erst beim Abruf
  entschlüsselt ausgeliefert. Bestehende Alt-Dateien bleiben lesbar und werden
  per Migration nachverschlüsselt (abwärtskompatibel, keine Ausfallzeit).
- **Nachweisfotos sind nach der Bearbeitung nur noch für Admins sichtbar.**
  Sobald ein Antrag verbucht oder abgelehnt ist, kann der Konfi das Foto nicht
  mehr abrufen (serverseitig erzwungen, nicht nur in der Oberfläche). Admins
  sehen das Foto weiterhin in jedem Status — auch bei verbuchten und abgelehnten
  Anträgen.
  Hinweis: Bei bereits zuvor genehmigten Anträgen wurde das Foto durch die alte
  Logik beim Verbuchen entfernt; für diese Alt-Anträge ist kein Foto mehr
  vorhanden. Ab jetzt bleibt es erhalten.

### 🐛 Fehlerbehebungen
- **Chat-Detailseiten: schwarzer Header im Geräte-Dark-Mode + falsche Safe-Area
  oben.** Ursachen: (1) Der Chat-Header war als „durchscheinend" (translucent)
  konfiguriert, obwohl der Chat-Inhalt nicht darunter scrollt — dadurch saß die
  Kopfzeile im Bereich der Statusleiste/Notch falsch. Jetzt opaker Header mit
  korrektem Safe-Area-Abstand. (2) Die App hat kein eigenes Dark-Theme; Ionic
  färbte die Kopfzeile im System-Dark-Mode dennoch dunkel. Jetzt ist die
  Toolbar-Grundfarbe app-weit auf das helle Standard-Grau festgelegt.
- **Nachweisfoto „kam zurück", nachdem ein Antrag zurückgesetzt/neu gestellt
  wurde.** Ursache: Fotos wurden serverseitig nie wirklich entfernt und der
  Abruf prüfte den Status nicht. Behoben durch das neue Status-Gate und eine
  saubere Lösch-Logik.
- **Android: Login schlug in seltenen Fällen mit „Keine Verbindung" fehl,
  obwohl Netz vorhanden war.** Manche Umgebungen (Emulatoren, Review-Systeme)
  melden den Netzwerkstatus als „none/unknown", obwohl Anfragen funktionieren.
  Die App bleibt in diesen Fällen jetzt optimistisch online und versucht den
  Login, statt ihn vorab zu blockieren.

### ✨ Neu / Verbessert
- **Admins können das Nachweisfoto eines Antrags jetzt manuell löschen**
  (Button im Antrags-Detail). Datei wird vom Server entfernt, Antrag bleibt
  erhalten.
- **Antrags-Fotos werden zuverlässig aufgeräumt:** Beim Zurückziehen eines
  offenen Antrags durch den Konfi und beim Löschen eines Kontos werden die
  zugehörigen Fotodateien mitgelöscht (vorher blieben sie als Dateileichen
  liegen). Wartungsskripte für Nach-Verschlüsselung und Verwaisten-Aufräumung
  ergänzt.
- **Symbole in den Antrags- und Event-Detailansichten vereinheitlicht:** In den
  Antrags-Detail-Dialogen wurden die uneinheitlichen grauen/farbigen Zeilen-
  Symbole entfernt (Konfi & Admin). Das Schloss-Symbol bei „Anmeldung" ist jetzt
  wie alle anderen ein gefülltes Symbol. Antrags-Status heißt admin-seitig
  einheitlich „Verbucht".

### 🛠️ Intern
- Behoben: Material-Datei-Download lehnte gültige Dateinamen ab (Längen-Prüfung
  korrigiert).
- Backend-Tests können jetzt lokal gegen ein Homebrew-PostgreSQL laufen (vorher
  nur in der CI). Neue Tests für Medien-Verschlüsselung, Foto-Status-Gate und
  Lösch-Logik (Roundtrip- und Integrationstests).

---

## [Älter] — nach iOS-Build 60

Diese Änderungen sind committet/deployt (Backend live).

### 🐛 Fehlerbehebungen
- „Anmeldung möglich"-Push wurde teils doppelt gesendet. Jetzt sendet
  ausschließlich der Hintergrund-Dienst (atomar, alle 1 Min) — Erstellen/Ändern
  setzen nur noch das Flag. Genau ein Push pro Öffnung.
- Event-Liste (Konfi & Teamer): lange Titel werden nicht mehr zu früh mit „…"
  abgeschnitten, sondern laufen bis ans Zeilenende und brechen bei Bedarf auf
  zwei Zeilen um (v. a. auf iOS).
- Info-Legende (Events): Eintrag „Anmeldung bald" (orange, Uhr) ergänzt — erklärt
  Events, deren Anmeldung noch nicht geöffnet ist. (Konfi & Teamer & Admin)
- Einladungscode verlängern warf „Fehler beim Verlängern" — die Route fragte eine
  nicht existierende Spalte `role_id` ab. Abfrage korrigiert.
- Badge-Regel präzisiert: Bei **Konfis** zählen Pflicht-Events und Konfirmationen
  NICHT mehr für Badges — nur freiwillig besuchte, bestätigte Events plus
  eingereichte Aktivitäten. Bei **Teamer:innen** zählen weiterhin alle bestätigten
  Events (sie arbeiten bei Pflicht/Konfirmation mit). Gilt einheitlich für
  Event-Anzahl, Aktivitäts-Anzahl, Kategorie-, Serien- und Zeitraum-Badges
  (Wertung und Fortschritt). Badge „Turbo-Woche" entfernt.
- Selbst gebuchte Event-Anmeldungen von Konfis wurden ohne Organisation
  gespeichert (`organization_id` fehlte beim Insert) — dadurch zählten sie NICHT
  in Badge-Kriterien (Event-Anzahl, Aktivitäts-Anzahl, Kategorie, Pflicht-Events).
  Insert korrigiert; 23 betroffene Alt-Buchungen nachträglich der richtigen
  Organisation zugeordnet; Badge-Check für alle Konfis/Teamer neu ausgeführt
  (22 rückwirkend verdiente Badges vergeben).
- Event-Erklärung (Info-Button) öffnete als Vollbild statt als Karten-Dialog —
  jetzt korrektes Card-Modal (Konfi & Admin; Teamer war bereits korrekt).
- Badge-Fortschritt vollständig auditiert (Wertung vs. Anzeige für alle
  Kriterien-Typen, Konfi + Teamer). Behobene Abweichungen:
  - Teamer-Badges vom Typ „Kategorie-Aktivitäten" (z. B. Freizeithopper) zeigten
    immer 0 % Fortschritt, obwohl Aktivitäten/Events real zählten — jetzt
    korrekter Fortschritt.
  - Teamer-Fortschritt für „Spezifische Aktivität", „Kombination", „Serie" und
    „Zeitraum" war fest auf 0 — jetzt echte Werte.
  - Konfi-Badge „Kategorie-Aktivitäten": Fortschritt zählte nur Aktivitäten,
    nicht die anwesenden Events (die Wertung tat es) — jetzt deckungsgleich.
  - Konfi-Badge „Bonuspunkte" wurde bei der Wertung nach Anzahl der Einträge statt
    nach Punktesumme bewertet — jetzt nach Summe (wie Anzeige/Beschriftung).
- Teamer-Anwesenheit bestätigen warf einen 400-Fehler („Konfi-Profil nicht
  gefunden"), weil die Konfi-Punkte-Logik mitlief. Punkte gibt es jetzt nur noch
  für Konfis; Teamer-Anwesenheit wird ohne Punkte gesetzt. (`9140a23`, deployt)
- Anträge-Tab-Zähler verschwindet sofort nach Genehmigen/Ablehnen (und zählt
  beim Zurücksetzen sofort hoch) statt erst nach ~30 s — die Antrags-Aktionen
  feuern jetzt `triggerRefresh('requests')` für den BadgeContext.
- Events-Tab-Zähler verschwindet sofort nach vollständigem Verbuchen statt erst
  nach ~30 s (Provider-Reihenfolge LiveUpdate/Badge). (`6f9712e`)
- Teamer:innen sehen reine Konfi-Events korrekt als „Nur zur Info" (kein
  Anmelde-Button, keine grüne Anmelde-Farbe). (`8be6466`)
- Konfis sehen keine reinen Team-Events und keinen „Teamer gesucht"-Hinweis mehr.
  (`c33d27c`)

### ✨ Neue Funktionen
- „Anmeldung möglich"-Push für Events ist jetzt an die tatsächliche Anmeldbarkeit
  gekoppelt: Konfis bekommen den Push genau dann, wenn die Anmeldung offen ist —
  sofort beim Erstellen (falls schon offen), beim Ändern (sobald es anmeldbar
  wird) oder pünktlich zum Anmeldestart (über einen Hintergrund-Dienst, alle
  5 Min). Wird ein Event wieder „zu" gestellt und später erneut geöffnet, feuert
  der Push erneut. Push enthält Titel + Datum; Tippen öffnet direkt das Event.
- Dashboard-Tageslosung (Konfi): zeigt jetzt die gewählte Bibelübersetzung klein
  unter dem Vers an; Tippen auf die Losung öffnet die Übersetzungs-Auswahl. Die
  Auswahl wird gespeichert und die Losung sofort neu geladen.
- Zeit-/Serien-Badges erklären sich beim Antippen: Hinweis, ab wann bzw. in
  welchem Zeitraum der Fortschritt zählt (z. B. „Zählt die letzten 7 Tage (seit
  18. Juni)") und dass ältere Aktivitäten wieder herausfallen. So ist der
  schwankende Fortschritt verständlich. (Konfi + Teamer)
- Events: Info-(i)-Button mit kompletter Farb- und Symbol-Legende (rollenabhängig
  Konfi/Teamer/Admin). (`fdf4bc8`, `8be6466`, `c33d27c`)
- Chat: Neuer Chat öffnet sich nach dem Erstellen direkt (statt zurück zur
  Liste). (`1927a29`)

### 🎨 Verbesserungen
- Einheitliches Event-Status-System: Kreis-Icon vorne = Eck-Badge hinten,
  durchgängige Kreis-Symbole. „Anmeldung möglich" = Plus-Kreis,
  „Ausgebucht" = Schloss, „Verbuchen" = offener Kreis. (`8be6466`, `c33d27c`)

### 🔍 Analyse (kein Code-Change)
- Teamer-Badges geprüft (Logik + Prod-Daten): `checkAndAwardTeamerBadges`, Typ
  `category_activities` ist **korrekt** und zählt Aktivitäten UND anwesende
  Event-Teilnahmen der passenden Kategorie. „Freizeithopper" (Kategorie
  „Freizeit", Ziel 10) hat real bereits Progress 1/10 über das Freizeit-Event
  „Kirchenübernachtung". Die zum Test eingereichte Aktivität „Konfi-Freizeit
  begleitet" zählte NICHT, weil ihr die Kategorien „Kinder"/„Kreativ"
  zugeordnet sind — nicht „Freizeit". Lösung: der Aktivität die Kategorie
  „Freizeit" zuordnen (Datenpflege, kein Code-Fix).

---

## 1.3.0 (Juni 2026)

Großes Feature-Release: Onboarding für alle Rollen, Chat-Medien & Umfragen,
durchgängige Info-Hilfen und ein einheitliches Status-System für Events.

Umfang: 42 Commits über den 22.–25.06.2026, iOS-Builds B49–B60 (+ Folge-Fixes
nach B60). Version 1.3.0, iOS-Build 60, Android versionCode 64.

### ✨ Neue Funktionen

#### Onboarding für alle Rollen
- Geführte Tab-Tour beim ersten Login als Vollbild-Overlay (Konfi, Admin, Teamer:in)
- Direkte Ansprache, eigene Slides für Material & Zertifikate (Admin/Teamer)

#### Chat
- Bild-Versand mit automatischer Kompression vor dem Upload
- Persistenter Bild-Cache + Vorausladen (schnelleres Öffnen, weniger Datenverbrauch)
- „Cache leeren" in allen Profilen
- Umfragen: anonym oder mit Namen, optional exklusive Optionen (jede nur einmal wählbar)
- Tages-Trenner (Heute/Gestern/Datum) als sticky Chip im WhatsApp-Stil
- Sprung zur ersten ungelesenen Nachricht beim Öffnen
- Neuer Chat öffnet sich nach dem Erstellen direkt (statt zurück zur Liste)

#### Info & Hilfe
- Info-(i)-Buttons mit Erklär-Modals in allen Bereichen der „Mehr"-Seite
- Events: Info-Button mit kompletter Farb- und Symbol-Legende (rollenabhängig)

#### Teamer:innen
- Eigene Bibelübersetzung für die Tageslosung wählbar
- Aktivitäten zeigen „Team" statt Gemeinde/Punkte
- Eigene Onboarding-Tour & Bereichs-Infos

### 🎨 Verbesserungen

#### Einheitliches Event-Status-System
- Status-Icon vorne (Kreis) und Eck-Badge hinten zeigen immer dasselbe Symbol
- Durchgängige Kreis-Symbole; eindeutigere Icons:
  „Anmeldung möglich" = Plus-Kreis, „Ausgebucht" = Schloss, „Verbuchen" = offener Kreis
- Klare Farbcodierung pro Status, je Rolle passend

#### Onboarding & Design
- Vollbild-Onboarding statt Modal, deckend, Vollfarb-Optik
- Klare Rollen-Benennung (Org-Admin / Admin / Teamer:in)

### 🐛 Fehlerbehebungen
- Events-Tab-Zähler verschwindet jetzt sofort nach vollständigem Verbuchen
  (vorher bis zu 30 s Verzögerung)
- Teamer:innen sehen reine Konfi-Events korrekt als „Nur zur Info" — ohne
  irreführenden Anmelde-Button und ohne grüne Anmelde-Farbe
- Konfis sehen keine reinen Team-Events und keinen „Teamer gesucht"-Hinweis mehr
- Deaktivierte Punkt-Kategorien werden bei Punkten, Badges und Level konsistent
  berücksichtigt
- Super-Admins können organisationsübergreifend Passwörter zurücksetzen
- Chat: kein Bild-Ruckeln/Reload-Loop mehr, korrekter Abstand unter der letzten
  Nachricht auf iOS, kein Fehler mehr bei Antwort auf gelöschte Nachrichten
- Deutlicher Warnhinweis beim Löschen von Konfis

### 🔧 Technisches
- Teamer-Bibelübersetzung: Migration 107
- Umfragen-Erweiterung (Anonym/Exklusiv): Migration 106
- Provider-Reihenfolge LiveUpdate/Badge korrigiert (Tab-Badge-Live-Update)
- Status-Icons aus einer zentralen Map (StatusBadge) als Single Source of Truth

---

### Store-Text (Kurzfassung „Was ist neu")

```
Konfi Quest 1.3.0

• Onboarding-Tour beim ersten Login – für Konfis, Admins und Teamer:innen
• Chat: Bilder senden, Umfragen (anonym oder offen), schnelleres Laden
• Neuer Chat öffnet sich direkt nach dem Erstellen
• Info-Buttons mit Erklärungen in allen Bereichen
• Events: klare Farben & Symbole für jeden Status, mit Legende zum Nachschlagen
• Teamer:innen: eigene Bibelübersetzung für die Tageslosung
• Viele Detail-Verbesserungen im Chat und an der Anzeige
• Fehlerbehebungen rund um Events, Punkte und Anzeige
```

---

### Commit-Verlauf 1.3.0 (chronologisch)

**22.06. — Konfi-Onboarding & Chat-Grundlagen (B49–B51)**
- `2ddb39c` release: 1.3.0 (iOS B49, Android vc59)
- `031b88f` Chat-Eingabe scrollbar, Datums-Chip sticky, Onboarding Full-Color, Aktivität-Header
- `f055d6e` iOS Build 50
- `ea1d76b` Onboarding-Farbe im Modal + Chat-Abstand nach letzter Nachricht
- `bdd16cc` iOS Build 51
- `4142963` Datums-Chip sticky, gelöschte Nachricht, Geist-Toast, Onboarding-Farbe
- `48cd1bc` saubere Header-Zeile für gewählte Aktivität im Akkordeon

**23.06. — Onboarding-Politur & Punkte-Konsistenz (B52–B54)**
- `ed8f1e1` Login-Optik für Onboarding-Rose + klare Rollen-Benennung
- `a87007b` deaktivierte Punkt-Kategorien konsistent respektieren
- `74e105b` deutlicher Warn-Dialog beim Konfi-Löschen
- `c07983d` iOS Build 52
- `ed84d2c` Vollbild-Overlay statt Modal, deckend, direkte Ansprache
- `6b2a6c1` Rose bis an den Rand (Portal an body) + Bubbles drumherum
- `6378d17` iOS Build 53 — Onboarding-Overlay + alle UI-Fixes
- `2ba5f0c` bei Tastatur-Öffnung ans Listenende scrollen
- `ce14c81` iOS Build 54 — Chat-Tastatur-Scroll-Fix

**24.06. — Chat-Medien, Umfragen, Admin/Teamer-Onboarding, Info-Modals (B57–B60)**
- `cc6c181` Medien-Cache + Bild-Kompression vor Upload, Events-Stats-Fix
- `4748a5b` Medien-Reload-Loop, Tastatur-Scroll, Admin-Cache-Abstand
- `3f0e220` Umfragen — Anonym-Toggle + Exklusiv-Optionen
- `4768446` persistenter Bild-Cache + Vorausladen, kleinerer Abstand unten
- `c13fc1e` iOS Build 57 — Umfragen + Chat-Medien/Perf
- `71e368f` großer Abstand unter letzter Nachricht auf iOS — fullscreen entfernt
- `9878bb3` iOS Build 58 — Chat-Abstand-Fix (fullscreen)
- `1101d28` kein Ruckeln mehr beim Bild-Laden — Höhensprung + Sofort-Cache
- `dfb315a` iOS Build 59 — Chat-Bild-Ruckeln-Fix
- `cbc424a` Super-Admin per is_super_admin-Flag darf org-übergreifend Passwörter zurücksetzen
- `7902580` Admin- und Teamer-Onboarding-Tour (Stil wie Konfis)
- `eea190b` Chat-Texte — Direkt-/Gruppenchats betonen, Tour-/Aufgaben-Beispiele raus
- `5cf32f7` Material-Slide + Zertifikate in Admin-/Teamer-Tour
- `e4f15ff` Info-Modal pro Bereich (Jahrgänge) + Teamer-Events-Empty-Hinweis
- `3a797a2` Teamer: Bibelübersetzung wählbar (Tageslosung)
- `86d2bfe` Info-Buttons für alle Bereiche der „Mehr"-Seite
- `8af32b0` Info-Button auch für „Konfis einladen"
- `1034a9d` Info „Konfis einladen" — Jahrgang legt Admin fest, nicht der Konfi
- `353fd27` iOS Build 60 — Onboarding-Touren + Info-Modals + Teamer-Bibel

**25.06. — Teamer-Events, Status-Icons, Bugfixes (nach B60)**
- `bf2808a` Teamer: Bibel-Modal-Farben (rosa) + Aktivitäten zeigen „Team"
- `4d0e74e` Teamer-Events ohne Teamer-Anmeldung nicht mehr grün
- `fdf4bc8` Events: Info-Button mit Farbcode-Legende (alle 3 Rollen)
- `8be6466` Status-Icons vereinheitlicht + Teamer-Fixes + Legende mit Icons
- `c33d27c` durchgehend Kreis-Icons, Ausgebucht=Schloss, Verbuchen abgesetzt
- `6f9712e` Tab-Badge aktualisiert sofort nach Verbuchen (Provider-Reihenfolge)
- `1927a29` nach Chat-Erstellung direkt in den Chat springen

> Hinweis: Die Commits vom 25.06. (`bf2808a`…`1927a29`) sind noch in **keinem**
> iOS-Build enthalten — B60 liegt davor. Für eine vollständige 1.3.0-Einreichung
> ist ein neuer Build (B61) nötig.
