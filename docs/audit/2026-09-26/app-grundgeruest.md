# Audit App-Grundgerüst — 26.09.2026

Anmeldung, Sitzung, Navigation, Datenzugriff, Offline, Push-Empfang, Gemeinde-Umschalter
(Frontend `frontend/src`, Ionic 9 + React 19 + Capacitor 8, Stand Commit `fce1ab01`,
Version 2.3.0 / Android 124 / iOS-Build 230).

## Umfang und Methode

**Gelesen (vollständig):** `App.tsx`, `main.tsx`, `contexts/AppContext.tsx`,
`BadgeContext.tsx`, `LiveUpdateContext.tsx`, `ModalContext.tsx`, `navigation/*`
(routes.ts, rollenBaeume.ts, PushZielNavigation.tsx, useAppLocation.ts,
useSeitenBereit.ts), `services/*` (api, auth, tokenStore, appSperre, biometrics,
writeQueue, offlineCache, networkMonitor, websocket, notifications, updateCheck,
migrateStorage, mediaCache (Kopf), systemDialoge, absturzdiagnose, analytics),
`hooks/useOfflineQuery.ts`, `useAppSperre.ts`, `useWartendeVorgaenge.ts`,
`useActionGuard.ts`, `components/auth/LoginView.tsx`, `KonfiRegisterPage.tsx`
(Ausschnitt), `components/layout/MainTabs.tsx`, `components/common/ErrorBoundary.tsx`,
`GlobalToasts.tsx`, `AppSperrbildschirm.tsx` (Kopf), `utils/pushNavigation.ts`,
`deepLinks.ts`, `fehler.ts`, `offlineAktion.ts`, `types/user.ts`,
`capacitor.config.ts`, `vite.config.ts`, `frontend/config/*`, die Release-Workflows.

**Gegengelesen im Backend**, soweit der Client davon abhängt: `middleware/rbac.js`,
`routes/auth.js` (login, refresh, switch-org, register-konfi, logout),
`server.js` (Socket-Auth), `utils/antragIdempotenz.js`, `utils/storeVersion.js`,
`routes/chat.js` (Datei-Route), Unique-Indizes in `tests/schema/prod-schema.sql`.
Dazu die Quellen der Capacitor-Plugins `@capacitor/network` (Android/iOS) und
`axios-retry`.

**Ausgeführt:**
- `npx tsc --noEmit` (14,9 s, fehlerfrei) und `npx eslint` über den Bereich
  (6,8 s: 2 Fehler, 37 Warnungen).
- 31 bestehende Testdateien des Bereichs (`services/*`, `navigation/*`,
  `utils/pushNavigation`, `deepLinks`, `contexts/AppContext`,
  `badgeGemeindeWechsel`, `hooks/useOfflineQuery`, `useAppSperre`,
  `components/ErrorBoundary`): **464 Tests, alle grün**, 85,6 s.
- **10 temporäre Testdateien mit 15 Zusicherungen** (Vitest,
  `frontend/src/__tests__/audit-tmp/`, nach dem Lauf gelöscht) plus **ein Node-Skript** gegen `rbac.js` mit
  Fake-Datenbank (Scratchpad). Jeder Test formuliert die *korrekte* Erwartung;
  12 von 15 Zusicherungen fielen — das sind die reproduzierten Befunde, die 3
  grünen sind Gegenproben.
- Systematische Suchen: `JSON.parse` (13 Stellen), direkte `.filter/.map` auf
  Antworten (2 Stellen), `setX(res.data)` (11 Stellen), `window.location`
  (3 aktive Stellen), `console.*` mit Token/Passwort, alle 47 Cache-Schlüssel
  von `useOfflineQuery`, alle 37 `writeQueue.enqueue`-Stellen in 24 Dateien, alle 73 `api.post`.

**Bewusst nicht geprüft:** Gerätetests (kein Gerät, kein Simulator), das Verhalten
der nativen Plugins zur Laufzeit (nur aus Quelltext), Store-Builds selbst, die
Backend-Routen jenseits der Auth-/RBAC-Schicht (andere Auditbereiche), die
rechtliche Bewertung der Crashlytics-Rechtsgrundlage bei Minderjährigen.

## Zusammenfassung

Das Grundgerüst ist an vielen Stellen sorgfältig gehärtet (Refresh-Single-Flight,
Socket-Trennung bei Abmeldung und Sitzungsablauf, Erlaubnisliste für App-Links,
Stack-Handling bei Push-Zielen, Absturzdiagnose ohne Personenbezug). Dennoch sind
**5 Befunde HOCH, 4 MITTEL, 4 NIEDRIG**, davon **12 reproduziert**. Die drei
gewichtigsten: (1) Auf den Geräten gilt „kein Netz" als **online** — das
Network-Plugin meldet im Funkloch `connectionType 'none'`, `networkMonitor` wertet
das als verbunden; damit greift die im Handbuch versprochene Offline-Warteschlange
auf iOS nie und auf Android nur bei WLAN ohne Internet, und ein Flush im Funkloch
verbrennt das Wiederholungsbudget. (2) `axios-retry` wiederholt **schreibende POSTs**
bei 5xx und bei Zeitüberschreitung bis zu viermal; Bonuspunkte, Termine,
Aktivitäten und Konfi-Anlagen haben keinen Idempotenzschlüssel — eine langsame
Leitung erzeugt Doppelbuchungen. (3) Die **Registrierung speichert den
Refresh-Token nicht**: Jede neu registrierte Konfi fliegt 15 Minuten nach der
Registrierung mit „Sitzung abgelaufen" heraus. Dazu kommt beim neuen
Gemeinde-Umschalter ein Rückfall-Pfad, der die App bis zu 15 Minuten in
403-Fehler laufen lässt, und ein Sitzungsablauf, der Cache und Warteschlange der
vorigen Person stehen lässt.

## Release-Empfehlung für den Bereich

**Mit Auflage.** Vor dem Store-Build sind drei kleine, risikoarme Korrekturen zu
machen: BF-03 (Refresh-Token bei Registrierung übernehmen, zwei Zeilen), BF-02
(POST aus der Wiederholung herausnehmen bzw. nur mit Idempotenzschlüssel
wiederholen) und BF-05 (im 403-Rückfall ein Token ohne Org-Claim beschaffen).
BF-01 (Offline-Erkennung) und BF-04 (Sitzungsablauf räumt nicht) bestehen auch in
2.2.x, brauchen eine Entscheidung zum Verhalten und gehören in den nächsten
Patch — bis dahin ist die Offline-Zusage im Handbuch (`03-bedienung.md:286 ff.`)
so nicht haltbar.

## Befunde

### BF-01: Funkloch gilt als online — die Offline-Warteschlange greift auf den Geräten nicht

- **Schwere:** HOCH
- **Fundstelle:** `frontend/src/services/networkMonitor.ts:24-27`;
  Plugin-Quellen `node_modules/@capacitor/network/dist/esm/definitions.d.ts:37`
  („If there is no active network connection, connectionType will be 'none'"),
  `ios/Sources/NetworkPlugin/NetworkPlugin.swift:43`, `android/.../NetworkStatus.java:22-23`;
  Aufrufstellen z. B. `components/konfi/views/EventDetailView.tsx:128-155`,
  `components/konfi/modals/ActivityRequestModal.tsx:184-259`,
  `utils/offlineAktion.ts:19-26`, `services/writeQueue.ts:490`.
- **Kennzeichnung:** reproduziert — temporärer Test `audit-offline-budget.test.ts`
  (Network-Mock meldet `{connected:false, connectionType:'none'}` auf nativer
  Plattform): `networkMonitor.isOnline` → **true** (erwartet false); drei
  `writeQueue.flush()` im „Funkloch" schicken **3 Requests** und werfen einen
  Eintrag mit `maxRetries: 3` in die Fehlliste (erwartet 0 Requests, Eintrag
  bleibt). Das bestehende `networkMonitor.test.ts:84-100` hält dieses Verhalten
  sogar als gewollt fest (Commit `8827370e`, 30.06.2026: „Login bei
  connectionType none/unknown nicht blocken").
- **Beschreibung:** `evaluateOnline` gibt für `connectionType 'none'` **true**
  zurück. Genau `'none'` ist aber laut Plugin-Definition der Zustand „keine
  Verbindung": iOS liefert es, sobald Reachability `.unavailable` meldet
  (Flugmodus, kein Empfang), Android, sobald es kein aktives Netz gibt
  (`getActiveNetwork() == null` → Standardwert `NONE`). Nur „WLAN verbunden, aber
  kein Internet" (Android: `connected=false`, Typ `WIFI`) wird als offline
  erkannt. Der Fix vom 30.06. sollte den *Login* nicht blocken; er hat aber die
  gesamte Offline-Logik mitgenommen: **23 der 24 Dateien** mit
  `writeQueue.enqueue`-Stellen verzweigen über `networkMonitor.isOnline`, **39** `offlineBlockiert`-Aufrufe
  und die beiden `isOffline`-Hinweise hängen am selben Wert. Im Funkloch nimmt die
  App deshalb den Online-Zweig: `api.post` → `ERR_NETWORK` → `axios-retry`
  wiederholt Netzfehler (auch POST) dreimal → nach ≈1,5–2 s Fehler-Toast.
  Chat-Nachrichten sind die Ausnahme: `chatOutbox.ts:109-160` reiht auch nach
  einem gescheiterten Online-Versand ein.
- **Auswirkung aus Nutzersicht:** Eine Konfi im Bus meldet sich von einem Termin
  ab oder reicht eine Aktivität mit Foto ein — statt „Wird gesendet, sobald du
  wieder online bist" kommt „Fehler bei der Abmeldung" bzw. „Fehler beim
  Einreichen". Eine Leitung im Gemeindehaus ohne Empfang vergibt Bonuspunkte —
  Fehler statt Warteschlange. Bereits eingereihte Chat-Nachrichten verlieren bei
  jedem App-Start und jedem Resume im Funkloch einen Wiederholungsversuch
  (`maxRetries: 5`) und landen nach fünf Anläufen als „Nicht gesendet". Das
  Handbuch verspricht das Gegenteil (`docs/handbuch/03-bedienung.md:286-313`,
  `90-chat.md:173`).
- **Beleg:**
  ```
  × connectionType "none" ohne Verbindung wird als OFFLINE gewertet
    → expected true to be false
  × im Funkloch verbraucht ein Flush KEINE Wiederholungen
    → expected "vi.fn()" to be called +0 times, but got 3 times
  ```
- **Empfehlung:** `'none'` als offline werten; die Login-Sorge des Commits
  `8827370e` (Emulator/Play-Review meldet `unknown`) allein über `'unknown'`
  abdecken. Zusätzlich im Online-Zweig der Formulare bei `ERR_NETWORK` in die
  Warteschlange fallen (wie `chatOutbox`), damit eine falsche Netz-Einschätzung
  nicht sofort in einen Fehler führt. Am Gerät nachmessen (siehe unten).

### BF-02: axios-retry wiederholt schreibende POSTs — Doppelbuchungen bei langsamer Leitung

- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — `retryCondition` in `api.ts` wiederholt POST/PATCH nur noch mit gesetztem `Idempotency-Key`-Header (`IDEMPOTENCY_HEADER`, Client-Regel und Header-Hook; Server-Auswertung ist ein eigener Schritt); GET/PUT/DELETE und die 429-Sperre unverändert. Test `apiRetryNurIdempotent.test.ts` mit echtem axios-retry und zählendem Adapter (GET/503 → 4, POST/503 → 1, POST mit Schlüssel → 4).
- **Fundstelle:** `frontend/src/services/api.ts:42-55` (retryCondition: `status >= 500`
  und `ECONNABORTED` ohne Methodenprüfung); Ziele ohne Idempotenzschlüssel:
  `components/admin/modals/BonusModal.tsx:95` (`POST /admin/konfis/:id/bonus-points`),
  `EventModal.tsx:282,292` (`POST /events`, `/events/series`),
  `ActivityModal.tsx:124` (`POST /admin/konfis/:id/activities`),
  `KonfiDetailView.tsx:610` (`regenerate-password`); Backend ohne Idempotenz:
  `backend/routes/konfi-management.js:1135`, `routes/events/verwaltung.js:72`,
  `routes/events/serien.js:23`, `routes/activities.js:749`. `client_id` kennt
  das Backend nur für `activity_requests` (`utils/antragIdempotenz.js`,
  `konfi.js:44`, `teamer.js:1083`); `bonus_points` hat keinen Unique-Index
  (`tests/schema/prod-schema.sql`, nur `idx_activity_requests_client_id` und
  `idx_event_bookings_user_event`).
- **Kennzeichnung:** reproduziert — `audit-api-retry.test.ts` mit echtem
  `axios-retry` und zählendem Adapter: `POST /admin/konfis/1/bonus-points` bei
  500 → **4 Versuche**; `POST /events` bei `ECONNABORTED` → **4 Versuche**.
  Gegenproben: GET/500 → 4 (gewollt), POST/429 → 1 (gewollt).
- **Beschreibung:** `axios-retry` schließt POST in
  `isNetworkOrIdempotentRequestError` bewusst aus (`IDEMPOTENT_HTTP_METHODS` =
  GET/HEAD/OPTIONS/PUT/DELETE). Die eigene Bedingung `status >= 500` und die
  Zeitüberschreitungs-Klausel heben das auf: Ein POST, dessen Antwort nach 20 s
  nicht da ist, obwohl der Server längst geschrieben hat, wird bis zu dreimal
  neu gesendet. Von 73 `api.post`-Aufrufen tragen 2 einen `client_id`; nur die
  Antragsroute wertet ihn serverseitig aus. Bei Terminbuchungen verhindert der
  Unique-Index eine Doppelzeile, der zweite Versuch endet aber mit einem Fehler,
  obwohl die Buchung steht.
- **Auswirkung aus Nutzersicht:** Eine Leitung vergibt im Gemeindehaus (1–5 Mbit/s,
  siehe die eigene Messung in `api.ts:19-34`) 3 Bonuspunkte; die Antwort kommt
  nicht in 20 s — die Konfi hat danach 6, 9 oder 12 Punkte, Level und
  Abzeichen werden falsch vergeben, jeder Versuch schickt einen Push. Ein
  Termin wird zwei- oder dreifach angelegt; ein neu angelegter Konfi existiert
  mehrfach mit verschiedenen Einmalpasswörtern. Eine Konfi, die sich anmeldet,
  sieht „bereits angemeldet" als Fehler.
- **Beleg:**
  ```
  × POST mit 500 wird NICHT wiederholt (erwartet 1 Versuch)       → expected 4 to be 1
  × POST mit Timeout (ECONNABORTED) wird NICHT wiederholt          → expected 4 to be 1
  ✓ Gegenprobe: GET mit 500 wird wiederholt (4 Versuche)
  ✓ Gegenprobe: POST mit 429 wird nicht wiederholt (1 Versuch)
  ```
- **Empfehlung:** In `retryCondition` nur idempotente Methoden (GET/HEAD/PUT/DELETE)
  bei 5xx/Timeout wiederholen — oder POST nur dann, wenn der Body einen
  `client_id` trägt und die Route ihn serverseitig auswertet. Mittelfristig
  `client_id` für Bonuspunkte, Termin-Anlage und Konfi-Anlage einführen
  (Muster `antragIdempotenz.js`).

### BF-03: Registrierung speichert den Refresh-Token nicht — Sitzung endet nach 15 Minuten

- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — `sitzungUebernehmen` in `services/auth.ts` speichert Access-Token, Refresh-Token und Nutzer; Login und `KonfiRegisterPage` nutzen denselben Weg. Tests in `auth.test.ts` (Übernahme, Fehlerfall, Login, Quelltest der Seite).
- **Fundstelle:** `frontend/src/components/auth/KonfiRegisterPage.tsx:248-254`
  (liest nur `{ token, user }`, importiert `setRefreshToken` nicht);
  `backend/routes/auth.js:1081-1083` (liefert `refresh_token` mit).
- **Kennzeichnung:** reproduziert — `audit-register-refresh.test.ts`
  (Quelltext-Zusicherung nach dem Muster von `deepLinks.test.ts:128 ff.`): Backend
  liefert `refresh_token` ✓; Seite enthält weder `setRefreshToken` noch
  `refresh_token` ✗. `git log -S'setRefreshToken' -- KonfiRegisterPage.tsx` ist
  leer: die Übernahme fehlte von Anfang an, der Fehler steckt auch in 2.2.x.
- **Beschreibung:** Nach der Registrierung liegt nur das 15-Minuten-Access-Token
  im `tokenStore`. Läuft es ab, findet `ensureFreshToken` keinen Refresh-Token
  (`api.ts:166-167`) und der 401-Interceptor führt zu `clearAuth()` +
  `auth:relogin-required` (`api.ts:225-235`). Die Anmeldeseite zeigt „Deine
  Sitzung ist abgelaufen" (`LoginView.tsx:59-68`). Erst der zweite Login per
  Passwort erzeugt eine dauerhafte Sitzung.
- **Auswirkung aus Nutzersicht:** Jede der ~10.000–25.000 Konfis pro Jahr wird
  genau eine Viertelstunde nach ihrer Registrierung hinausgeworfen — mitten im
  Kennenlernen der App, mit einem Text, der nach einem Fehler klingt. Wer das
  gerade gewählte Passwort nicht mehr weiß, landet bei „Passwort vergessen"
  (nur mit E-Mail möglich, die bei der Registrierung optional ist).
- **Beleg:**
  ```
  ✓ der Server liefert bei /auth/register-konfi ein refresh_token mit
  × KonfiRegisterPage uebernimmt das refresh_token in den tokenStore
    → expected '…' to match /setRefreshToken/
  ```
- **Empfehlung:** `const { token, refresh_token, user } = response.data;` und
  `if (refresh_token) await setRefreshToken(refresh_token);` wie in
  `auth.ts:25-31`; Test dazu.

### BF-04: Sitzungsablauf räumt Offline-Cache, Warteschlange und Fehl-Merker nicht — die nächste Person am Gerät sieht Reste

- **Schwere:** HOCH
- **Fundstelle:** `frontend/src/services/api.ts:232-234` und `:272-274` (nur
  `clearAuth()`), `App.tsx:135-146` (Handler setzt nur `user` auf null),
  `components/common/ErrorBoundary.tsx:72-77` (leert Auth + Cache, aber nicht
  die Warteschlange); Cache-Schlüssel ohne Personenbezug z. B.
  `components/chat/ChatRoom.tsx:58` (`chat:messages:<roomId>`),
  `components/chat/views/ChatRoomView.tsx:36`, `admin/pages/AdminKonfisPage.tsx:108`
  (`admin:konfis:<orgId>`), `AdminEventsPage.tsx:96`; `hooks/useOfflineQuery.ts:119-121`
  (bei Fehler bleiben Cache-Daten stehen).
- **Kennzeichnung:** reproduziert — `audit-relogin-cache-queue.test.ts` mit
  echtem `tokenStore`, `offlineCache`, `writeQueue`: Nach dem 401-Pfad ist
  `getToken()` null und `auth:relogin-required` gefeuert ✓, aber
  `offlineCache.get('chat:messages:96')` liefert weiter die Daten, und die
  Warteschlange hält den eingereihten Chat-Post.
- **Beschreibung:** Der *bewusste* Logout (`auth.ts:56-198`) leert Warteschlange,
  Cache und Biometrie sauber (Tests `auth.test.ts` grün). Der *Sitzungsablauf*
  (Passwortwechsel auf einem anderen Gerät setzt `token_invalidated_at` und
  revoziert alle Refresh-Tokens, `auth.js:324-328`; 90 Tage Inaktivität; Konto
  deaktiviert) nimmt einen anderen Weg, der nur `clearAuth()` ruft. Was liegen
  bleibt: alle `cache:*`-Einträge (Chat-Nachrichten 1 h TTL, Teilnehmerlisten,
  Konfi-Listen der Gemeinde), `queue:items`, `queue:failedChat` (mit
  Nachrichtentext) und `queue:failedActions`. Meldet sich danach Person B an,
  zeigt `useOfflineQuery` zuerst den Cache (SWR) und behält ihn, wenn der Server
  403 antwortet. Die Warteschlange wird beim App-Start (`AppContext.tsx:913-915`)
  und bei jedem Resume geflusht — **mit B's Token**. Derselbe Rest bleibt, wenn
  jemand über die Fehlerseite der `ErrorBoundary` „Zur Anmeldung" wählt.
- **Auswirkung aus Nutzersicht:** Geteiltes Gerät oder Gemeindebüro-Rechner
  (Web-Build): Nach Ablauf von A's Sitzung meldet sich B an und findet unter
  `/konfi/chat/room/<id>` die zwischengespeicherten Nachrichten eines Raums, in
  dem B nicht ist; ein fehlgeschlagener Chat-Entwurf von A erscheint in B's
  Chat mit „Erneut senden"; A's eingereihte Abmeldung oder Chat-Nachricht geht
  unter B's Namen raus. Vorbedingungen (Ablauf statt Abmelden, gleiches Gerät,
  Kenntnis einer Raumnummer bzw. Mitgliedschaft im selben Raum) sind real bei
  Geschwistern im selben Jahrgang und bei Gemeinde-Tablets.
- **Beleg:**
  ```
  × nach auth:relogin-required sind Cache, Warteschlange und Fehl-Merker leer
    → expected { data: [ { id: 1, …(1) } ], …(2) } to be null
  ```
- **Empfehlung:** Im 401-Fehlpfad und in `ErrorBoundary.handleBackToLogin`
  dieselbe Aufräumfolge wie in `logout()`: `writeQueue.clear()`,
  `offlineCache.clearAll()`, `biometrieVergessen()`, `disconnectWebSocket()`
  (letzteres passiert schon). Zusätzlich Cache-Schlüssel grundsätzlich mit
  `user.id` präfixen und beim Login eines *anderen* Kontos (`prevUserId !==
  user.id`) den Cache leeren.

### BF-05: 403-Rückfall auf die Stamm-Gemeinde lässt den Org-Claim im Token — bis 15 Minuten nur Fehler

- **Schwere:** HOCH
- **Fundstelle:** `frontend/src/services/api.ts:198-208` (entfernt nur den Header),
  `contexts/AppContext.tsx:619-627` (Handler: State, Cache, Remount — kein Token),
  `backend/routes/auth.js:659-664` (switch-org setzt `active_organization_id` ins
  Token), `auth.js:1272-1279` (Refresh übernimmt den Claim aus dem Header),
  `backend/middleware/rbac.js:94-97` (ohne Header gilt der Token-Claim),
  `:150-166` (fehlende Mitgliedschaft → 403); Socket: `backend/server.js:125-136`
  lehnt mit „Kein Zugriff auf diese Organisation" ab, `frontend/src/services/websocket.ts:88-91`
  erkennt diese Meldung nicht als Auth-Fehler.
- **Kennzeichnung:** reproduziert — (a) `audit-org-fallback.test.ts`: 403 mit
  „Kein Zugriff auf diese Organisation" → `setActiveOrgId(null)` und Event ✓, aber
  **kein** `axios.post` (Refresh) und **kein** `setToken`; (b) Node-Skript
  `rbac-claim-vorrang.mjs` gegen `verifyTokenRBAC` mit Fake-DB:
  ```
  A) Header 2, Claim 2 (vor dem Rueckfall)            -> HTTP 403 Kein Zugriff auf diese Organisation
  B) KEIN Header, Claim 2 bleibt (nach dem Rueckfall)  -> HTTP 403 Kein Zugriff auf diese Organisation
  C) KEIN Header, Token OHNE Claim                     -> next(), req.user.organization_id=1
  ```
- **Beschreibung:** Wird einer Teamer:in die Mitgliedschaft in der Zweit-Gemeinde
  entzogen, während sie dort aktiv ist, kommt 403. `api.ts` setzt die aktive Org
  auf null und meldet `auth:org-fallback`; `AppContext` leert Cache und
  remountet. Das Access-Token trägt aber weiter `active_organization_id` der
  entzogenen Gemeinde, und `rbac.js` greift ohne Header auf genau diesen Claim
  zurück → wieder 403. Da `getActiveOrgId()` jetzt null ist, greift der
  Rückfall-Zweig nicht mehr; jeder Request scheitert, bis das Token abläuft und
  `ensureFreshToken` ein neues ohne Claim holt (bis zu 15 Minuten, plus 30 s
  RBAC-Cache — die API-Doku kennt das Nachwirken:
  `docs/api/verwaltung-auth.yaml:1086` „BEKANNT: laufende Access-Tokens mit
  active_organization_id-Claim wirken bis Ablauf nach"). Der Socket bleibt
  ebenfalls hängen: Sein Fehlertext enthält keines der gesuchten Wörter
  (`jwt`, `token`, `auth`, `unauthorized`), also kein `socket:auth-error`; er
  verbindet alle ≤30 s mit demselben Token neu.
- **Auswirkung aus Nutzersicht:** Nach dem Entzug sieht die Person eine Viertel-
  stunde lang leere Listen und Fehler-Toasts in *jeder* Gemeinde, ohne Hinweis,
  was los ist; Abmelden und Neuanmelden hilft. Der Umschalter ist neu in 2.3.0.
- **Beleg:** siehe Kennzeichnung; Testausgabe
  `expected "wrap" to be called at least once` (kein Refresh ausgelöst).
- **Empfehlung:** Im Rückfall-Handler nach `setActiveOrgId(null)` einen Refresh
  ohne Org-Header erzwingen (`performRefresh` mit leerer Org) und den Socket mit
  dem neuen Token neu aufbauen; in `websocket.ts` auch „Zugriff"/„Organisation"
  als Auth-Fehler behandeln. Serverseitig könnte `rbac.js` bei explizit
  *fehlendem* Header und ungültigem Claim still auf die Stamm-Org fallen — das
  widerspräche aber dem dortigen Kommentar (bewusst kein stiller Rückfall).

### BF-06: Biometrische Anmeldung — die Klartext-Kopie des Refresh-Tokens kehrt nach der ersten Rotation zurück

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/services/api.ts:122` (`setRefreshToken` schreibt
  immer in Preferences), `services/tokenStore.ts:58-61`,
  `services/biometrics.ts:27-32` (Zusicherung a: „NUR biometrie-geschuetzt …
  nie zusaetzlich im Klartext"), `:305-307` (Klartext wird beim Aktivieren
  entfernt), `:475-490` (`rotationUebernehmen` schreibt in den sicheren Speicher,
  lässt die Preferences aber unangetastet).
- **Kennzeichnung:** reproduziert — `audit-biometrie-klartext.test.ts`: nach
  `biometrieAktivieren()` fehlt `konfi_refresh_token` ✓; nach dem nächsten
  `ensureFreshToken()` steht `konfi_refresh_token = 'refresh-neu'` wieder in den
  Preferences, gleichzeitig liegt derselbe Token im sicheren Speicher.
- **Beschreibung:** Die Sicherheitsabwägung in `biometrics.ts` verspricht, dass
  der 90-Tage-Token nach dem Einschalten nur noch hinter Face ID liegt. Der
  Refresh-Pfad ruft `setRefreshToken` ohne Rücksicht auf den Schalter, deshalb
  liegt spätestens 15 Minuten nach dem Einschalten (erste Rotation) wieder eine
  Klartext-Kopie in `Preferences` (iOS UserDefaults, Android SharedPreferences).
  Beim nächsten Kaltstart lädt `initTokenStore` diesen Token, die App ist
  angemeldet, und die Anmeldeseite mit der Face-ID-Abfrage erscheint gar nicht.
  Das bestehende `biometrics.test.ts:262` prüft nur den Moment des Einschaltens.
- **Auswirkung aus Nutzersicht:** Wer „Anmeldung sichern" einschaltet, glaubt,
  die Sitzung liege geschützt — tatsächlich ist der Schutz nach einer
  Viertelstunde derselbe wie vorher; die biometrische Anmeldung selbst kommt
  im Alltag kaum je zum Zug (nur die davon unabhängige App-Sperre schützt). Kein
  Rückschritt gegenüber 2.2.x, aber eine Zusage im Code, die nicht hält.
- **Beleg:** `expected 'refresh-neu' to be undefined`.
- **Empfehlung:** In `performRefresh` (und `mitBiometrieAnmelden`) bei aktivem
  Schalter den Refresh-Token nur in den sicheren Speicher schreiben
  (`setRefreshToken` mit `persist: false` oder Prüfung `istBiometrieAktiv()`),
  Test „nach Rotation kein Klartext" ergänzen. Alternativ die Zusicherung a) im
  Code und die Beschreibung des Schalters ehrlich abschwächen.

### BF-07: Der Refresh-Request hat kein Zeitlimit — hängt er, warten alle Requests

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/services/api.ts:107-109` (`axios.post` ohne
  `timeout`; die API-Instanz hat 20 s, `api.ts:16`), `:169-173` und `:237-249`
  (Wartende hängen am `isRefreshing`-Merker), `services/auth.ts:244-246`
  (`mitBiometrieAnmelden` ebenso ohne Zeitlimit).
- **Kennzeichnung:** reproduziert — `audit-refresh-hang.test.ts`: `axios.post`
  antwortet nie; nach 5 Minuten Fake-Zeit: `refresh-config timeout: undefined`,
  Zustand `p1=haengt p2=haengt p3=haengt` (zwei `ensureFreshToken` und ein
  Request-Interceptor).
- **Beschreibung:** Der Kommentar in `api.ts:12-16` beschreibt genau den Fall
  (WLAN↔LTE-Wechsel, tote TCP-Verbindung) und begründet damit das 20-s-Limit der
  Instanz — der Refresh läuft aber am Interceptor vorbei über nacktes
  `axios.post` ohne Limit. Trifft der Wechsel auf die Rotation (alle 15 Minuten
  Nutzung), bleibt `isRefreshing` stehen, bis das Betriebssystem den Socket
  aufgibt (iOS URLSession 60 s, Android/Chromium bis zu mehreren Minuten). Bis
  dahin lädt keine Ansicht, keine Aktion geht raus.
- **Auswirkung aus Nutzersicht:** Die App „hängt" eine bis mehrere Minuten
  komplett, ohne Fehlermeldung; die naheliegende Reaktion ist Neustart.
- **Beleg:** siehe Kennzeichnung.
- **Empfehlung:** `timeout: 20000` an beide direkten `axios.post`-Aufrufe;
  im Fehlerfall `onTokenRefreshFailed` (läuft dann von selbst).

### BF-08: Fehlgeschlagener Login schreibt das Passwort ins Konsolen-Log

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/services/auth.ts:36-43` (`fullError: error`).
- **Kennzeichnung:** reproduziert — `audit-passwort-im-log.test.ts`: das
  geloggte Objekt enthält `config.data = '{"username":"anna","password":"Geheim!2026"}'`.
- **Beschreibung:** Ein axios-Fehler trägt in `error.config.data` den
  serialisierten Request-Body. `console.error` gibt ihn bei jedem Fehlversuch
  aus — auf den Geräten in Xcode-Konsole bzw. `logcat`, im Browser in den
  DevTools. Crashlytics bekommt es nicht (kein `log()`-Aufruf), Umami nicht.
  Analog loggt `AppContext.tsx:294` den Fehler beim Senden des FCM-Tokens samt
  Token.
- **Auswirkung aus Nutzersicht:** Wer ein Konfi-Handy per USB ausliest oder an
  einem gemeinsam genutzten Rechner die Konsole öffnet, sieht falsch getippte
  Passwörter im Klartext — die sich meist nur in einem Zeichen vom richtigen
  unterscheiden.
- **Beleg:**
  ```
  Received: "[["Login fehlgeschlagen:",{…,"fullError":{…,"config":{"url":"/auth/login","method":"post","data":"{\"username\":\"anna\",\"password\":\"Geheim!2026\"}"},…}}]]"
  ```
- **Empfehlung:** `fullError` streichen, nur Status, `error_code` und `message`
  loggen; dasselbe für `AppContext.tsx:294`.

### BF-09: Keine Sperre gegen die Schleife „401 → Refresh gelingt → 401 → …"

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/services/api.ts:253-261` (`api(originalRequest)`
  ohne `_retry`-Merker).
- **Kennzeichnung:** reproduziert (Mechanismus) — `audit-401-schleife.test.ts`:
  Adapter liefert auf `/x` immer 401, Refresh gelingt immer; bis zur eingebauten
  Notbremse: **8 Versuche auf /x, 7 Refresh-Aufrufe** (erwartet ≤ 2 / ≤ 1). Ein
  auslösender Fall im heutigen Backend wurde **nicht** gefunden: Alle 401-Gründe
  in `rbac.js:83-134,178` (abgelaufen, ungültig, invalidiert, inaktiv, Org
  inaktiv) lassen auch den Refresh scheitern (`auth.js:1214,1252-1268`);
  `users.deleted_at`, das `chat.js:1777` und `server.js:110` prüfen, wird von
  keiner Route gesetzt.
- **Beschreibung:** Nach erfolgreichem Refresh wird der Originalrequest ohne
  Kennzeichnung erneut gesendet. Antwortet die Route weiter 401 (eine künftige
  Route mit eigener Token-Prüfung, ein Unterschied in der Prüfreihenfolge), dreht
  der Client eine Endlosschleife und rotiert dabei je Durchlauf den
  Refresh-Token (eine DB-Zeile und ein Revoke pro Runde).
- **Auswirkung aus Nutzersicht:** Heute keine; im Fehlerfall friert die App ein
  und lastet den Server.
- **Beleg:** `AUDIT 401-Schleife: Versuche auf /x = 8 | Refresh-Aufrufe = 7`.
- **Empfehlung:** `originalRequest._retry = true` setzen und bei gesetztem Merker
  den 401 durchreichen (Standardmuster).

### BF-10: Migrationsreste im localStorage überleben das Abmelden

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/services/migrateStorage.ts:5-6,15-23` („Keys
  werden NICHT gelöscht"), `services/tokenStore.ts:76-91` (`clearAuth` räumt
  nur Preferences).
- **Kennzeichnung:** reproduziert — `audit-migrate-localstorage.test.ts`: nach
  Migration und `clearAuth()` liegt `konfi_user` (`display_name`, `email`,
  `jahrgang`) weiter im `localStorage`.
- **Beschreibung:** Auf Installationen aus der Zeit vor `storage_migrated_v1`
  bleibt das damalige Profilobjekt samt E-Mail und ein (längst abgelaufenes)
  Access-Token dauerhaft im WebView-Speicher — auch nach Abmelden oder
  Kontowechsel. Der Rollback-Grund ist erledigt.
- **Auswirkung aus Nutzersicht:** Profildaten einer Minderjährigen liegen nach
  dem Abmelden weiter auf dem Gerät (App-Sandbox, nur mit Werkzeugen lesbar).
- **Beleg:** `expected '{"id":7,"display_name":"Anna Beispiel…' to be null`.
- **Empfehlung:** Nach erfolgreicher Migration die vier Schlüssel aus
  `localStorage` entfernen; `clearAuth` räumt sie ebenfalls.

### BF-11: Gesperrte Gemeinde / abgelaufene Testphase erscheint als „Sitzung abgelaufen"

- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/auth.js:1255-1268` (403 mit `error_code`),
  `frontend/src/services/api.ts:262-275` (jeder Refresh-Fehler → `clearAuth` +
  `auth:relogin-required`), `App.tsx:138`, `LoginView.tsx:61-63`.
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Der Refresh unterscheidet 401 (Token ungültig) von 403 (Konto
  deaktiviert, Org gesperrt, Testphase vorbei) samt `error_code`; der Client
  wirft beides auf denselben Pfad. Erst der nächste Passwort-Login zeigt die
  richtige Meldung (`LoginView.tsx:218-221`).
- **Auswirkung aus Nutzersicht:** Eine Konfi, deren Gemeinde die Testphase
  überschritten hat, liest zuerst „Deine Sitzung ist abgelaufen", tippt das
  Passwort neu und erfährt erst dann den echten Grund.
- **Empfehlung:** Bei `response.status === 403` mit `error_code` die Meldung des
  Servers in `sessionStorage` durchreichen statt des Standardtexts.

### BF-12: Lint-Fehler im Bereich (toter Code in MainTabs)

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/layout/MainTabs.tsx:21` (`ladeRolleVor`
  importiert, ungenutzt), `:135-143` (`SeiteLaedt` definiert, ungenutzt).
- **Kennzeichnung:** reproduziert — `npx eslint --quiet …`: 2 Fehler
  (`@typescript-eslint/no-unused-vars`). Die CI lintet nur geänderte Dateien
  (`.github/workflows/ci.yml:175-178`), deshalb fällt es dort erst beim nächsten
  Anfassen der Datei auf. `tsc --noEmit` ist sauber.
- **Empfehlung:** Beide Reste entfernen.

### BF-13: Datenschutzerklärung beschreibt die Absturzdiagnose enger als der Code

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/public/datenschutz.html:265 ff.` („Ein Bericht wird
  ausschließlich dann erzeugt, wenn die App abstürzt oder einen Fehler abfängt,
  der die Bedienung unterbricht — nicht im laufenden Betrieb") gegen
  `frontend/src/services/absturzdiagnose.ts:282-297` (jede unbehandelte
  Promise-Ablehnung und jedes `window.error` wird als nicht-fataler Bericht
  gesendet, bis 20 je Sitzung).
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Inhaltlich stimmt die Datensparsamkeit (Rolle normalisiert,
  Org als Zahl, keine Kennung, Meldung auf 200 Zeichen gekürzt; geprüft in
  `absturzdiagnose.test.ts`, grün). Die Beschreibung „nur bei Absturz oder
  Bedienungsunterbrechung" trifft aber nicht zu: eine im Hintergrund abgelehnte
  Promise unterbricht nichts und wird trotzdem übertragen. Eine Einwilligung
  gibt es nicht (`diagnoseSchalten` ohne Oberfläche, `absturzdiagnose.ts:47-53`);
  ob das bei überwiegend Minderjährigen mit „berechtigtem Interesse" trägt, ist
  eine rechtliche Frage (siehe Unklar).
- **Empfehlung:** Text anpassen („auch abgefangene Programmfehler im
  Hintergrund") oder `globaleFehlerkanaeleAnhaengen` auf `wegmarke` statt
  `fehlerMelden` umstellen.

## Unklar

- **Zwangsläufigkeit von BF-01 am Gerät.** Die Bewertung stützt sich auf
  Plugin-Quelltext und Unit-Test. Ob iOS in bestimmten Lagen (Mobilfunk ohne
  Datendurchsatz) `cellular/connected=true` statt `none` meldet, ändert nichts
  am Befund für Flugmodus/kein Empfang, wäre aber am Gerät zu bestätigen
  (Debug-Ausgabe von `Network.getStatus()` in Flugmodus, beide Plattformen).
- **Uhrzeit-Versatz.** `ensureFreshToken` vergleicht `exp` mit der Geräteuhr
  (`api.ts:164`). Geht die Uhr ≥ 15 Minuten vor, würde vor *jedem* Request
  refresht (eine Rotation pro Request). Nicht getestet; ob solche Geräte im
  Bestand sind, zeigt nur die `refresh_tokens`-Tabelle (siehe unten).
- **Modale nach Rollen-/Kontowechsel.** `ModalContext` schließt Modale beim
  Routenwechsel; ob per `useIonModal` geöffnete Modale beim Abbau des
  Router-Teilbaums (Logout, `orgVersion`-Remount) immer geschlossen werden, hängt
  an Ionics `useOverlay`-Aufräumlogik (`@ionic/react/dist/index.js:3013 ff.`) —
  nicht ohne Gerät prüfbar.
- **Crashlytics und Minderjährige.** Die Datenschutzerklärung stützt sich auf
  berechtigtes Interesse (§ 6 Nr. 8 DSG-EKD), ein Opt-in gibt es nicht. Ob das
  für 13-Jährige trägt, ist eine Rechtsfrage außerhalb dieses Audits; technisch
  wäre `diagnoseSchalten` vorbereitet.
- **`switchOrg` bei laufendem Flush.** `writeQueue.flush()` kehrt sofort leer
  zurück, wenn bereits ein Flush läuft (`writeQueue.ts:485`); `switchOrg` leert
  danach die Queue (`AppContext.tsx:685`). Ein gerade sendender Eintrag könnte
  so still verworfen werden — der `_generation`-Schutz verhindert das
  Zurückschreiben, aber nicht den Verlust. Nicht reproduziert.

## Alte Befunde nachgeprüft

- **`docs/offene-befunde.md` #2 (react-router, Ziel aus Push-Datenfeld):**
  weiter unkritisch. Push-Ziele entstehen ausschließlich aus einem `switch` über
  feste Typen mit festen Präfixen (`utils/pushNavigation.ts:182-443`); nur
  Kennungen werden mittig eingesetzt, kein Ziel beginnt mit Nutzerdaten. App-Links
  laufen durch eine Erlaubnisliste (Host, `https`, drei Pfadpräfixe —
  `utils/deepLinks.ts:19-53`, Tests grün). Postfach-Ziele nutzen dieselbe Weiche.
  Einschränkung: Kennungen werden nicht auf Zahlen geprüft (`data.roomId` roh in
  der Route); `ParamSeite` macht daraus `parseInt` → `0`. Kein Redirect möglich.
- **Kommentar `api.ts:12-16` / CHANGELOG 2803 (proaktiver Refresh, wartende
  Requests werden bei Fehler abgewiesen):** bestätigt — `api.test.ts` „parallele
  Aufrufe teilen sich EINEN Refresh-Request" und „gibt bei Refresh-Fehler den
  alten Token zurück" grün; Single-Flight über `isRefreshing` (`api.ts:86-101`).
  Offen geblieben ist das fehlende Zeitlimit (BF-07).
- **Fund Audit 22.08.2026 (Socket überlebt Logout) und Fund 24.08.2026 (Socket
  überlebt Sitzungsablauf):** behoben bestätigt — `auth.ts:179-183`,
  `websocket.ts:129-133`, `websocket.test.ts` beide Fälle grün.
- **Simons Befund 04.09.2026 (Logout bleibt hängen, `logoutInProgress`):**
  behoben bestätigt — `auth.ts:63-197` (try/finally), `auth.test.ts` „ein Fehler
  in clearAuth blockiert den naechsten Logout NICHT" grün.
- **Maltes Befund 23.09.2026 (Push-Tap: Reload-Absturz):** behoben bestätigt —
  kein `window.location` mehr in `AppContext.tsx` (Suche), Ziel läuft über
  `pushZielMelden` → `PushZielNavigation` (`pushZielNavigation.test.tsx` grün).
  Verbliebene harte Navigationen: `LoginView.tsx:86` (`window.location.replace`
  für super_admin, dokumentiert als Absicht), `ErrorBoundary.tsx:76`
  (`location.reload`), `EinladungenKarte.tsx:63` (`location.reload`, außerhalb
  des Bereichs, aber im nativen WebView dasselbe Risiko wie das behobene).
- **Simons Befund 26.09.2026 (Badge beim Gemeindewechsel bleibt):** behoben
  bestätigt — `BadgeContext.tsx:329-344` (erst zurücksetzen, dann laden,
  `gemeindeLauf`), `badgeGemeindeWechsel.test.tsx` grün.
- **API-Doku `verwaltung-auth.yaml:1086` („BEKANNT: Access-Tokens mit
  active_organization_id-Claim wirken bis Ablauf nach"):** bekannt, aber
  unterschätzt — der Client entfernt beim Rückfall den Header und macht das
  Nachwirken damit zum Totalausfall (BF-05).
- **Vorfall 29.08.2026 (`.filter` auf Nicht-Array):** heute nur 2 direkte
  Iterationen auf Antworten: `AppContext.tsx:602` (mit `Array.isArray`-Prüfung),
  `EventDetailView.tsx:345` (in `try/catch`, Fehler → `false`). 11 Stellen
  `setX(res.data)` ohne Formprüfung (u. a. `EventModal.tsx:166-176`,
  `MembersModal.tsx:106`, `WrappedModal.tsx:164`) verlassen sich auf den
  API-Vertrag aus `CLAUDE.md` — ein Formwechsel dort bräche erst beim Rendern.

## Geprüft und in Ordnung

- **Refresh-Race:** parallele 401 bzw. parallele `ensureFreshToken` lösen genau
  einen Refresh aus; Wartende werden bei Fehler abgewiesen statt zu hängen
  (`api.ts:83-101,169-173,237-249`; `api.test.ts` grün).
- **Reihenfolge der Persistenz:** Refresh-Token vor Access-Token (`api.ts:122-123`,
  Test „Android-Session-Race" grün).
- **Kein Endlos-Relogin:** Ohne Refresh-Token oder bei fehlgeschlagenem Refresh
  genau ein `clearAuth` + ein Event; Login/Refresh-Requests selbst werden nicht
  refresht (`api.ts:211-217`; Test „401 auf Login-Request" grün). Bewusster
  Logout unterdrückt den Dialog (`isLoggingOut`, `tokenStore.ts:16-24`).
- **Token nur an die eigene API:** Kein einziger `api.*`-Aufruf mit absoluter
  URL (Suche `api\.(get|post|…)\(\s*['"\`]https?://` → 0 Treffer); Umami und
  Crashlytics laufen über eigene Kanäle ohne `Authorization`.
- **Token in Logs/Diagnose:** Kein `console.*` gibt Access- oder Refresh-Token
  aus (Suche); Crashlytics erhält Rolle (normalisiert), Org-Nummer, Plattform,
  Fassung, gekürzte Meldungen; kein `setUserId` (`absturzdiagnose.ts:140-178`,
  Tests grün). Umami: nur Rolle, feste Hostname/URL, keine Kennungen
  (`analytics.ts:39-84`; `umamiKennungen.test.ts`).
- **Basis-URL im Store-Build:** `VITE_API_URL` leer → `https://konfi-quest.de/api`
  (`api.ts:8`, `websocket.ts:7-9`); der iOS-Workflow bricht bei gesetzter
  Test-URL bewusst ab (`ios-release.yml:87-95`).
- **API-Pfade:** Jeder fest verdrahtete Frontend-Pfad hat einen Mountpunkt im
  Server (`apiPfadeExistieren.test.ts`, grün).
- **429:** keine Wiederholung, benutzerfreundliche Meldung, Alert (`api.ts:47-49,
  279-294`; Tests grün).
- **Route-Guards und 404:** Ohne Anmeldung nur Login/Register/Reset, Catch-all →
  `/login` (`App.tsx:206-218`); angemeldet Catch-all → Startseite der Rolle
  (`MainTabs.tsx:349`), Rollenwechsel tauscht den Baum über `key={rolle}`
  (`MainTabs.tsx:318`), Zurück ohne Verlauf ersetzt durch die Übersicht
  (`MainTabs.tsx:119-125`; `zurueckOhneVerlauf.test.ts` grün).
- **Rollenbaum vs. Backend-RBAC:** `/admin/users` (org_admin) und
  `/admin/metrics` (super_admin) stehen zwar im Admin-Baum (`rollenBaeume.ts:202,
  210`), die Einstiege sind aber nach Rolle ausgeblendet
  (`AdminSettingsPage.tsx:206,284,315`; `benutzerseiteRollenGate.test.ts`).
  Umgekehrt keine Route, die das Backend erlaubt und der Baum verbirgt, gefunden.
- **Gemeindewechsel:** Flush vor dem Wechsel, danach Cache und Queue leer,
  Socket mit neuem Token, `org:switched` + Remount, Restmenge ehrlich gemeldet
  (`AppContext.tsx:634-748`); Server hält Org im Cache-Schlüssel (`rbac.js:19`);
  Socket löst die aktive Org aus dem Token-Claim auf (`server.js:120-136`).
- **Push-Empfang:** Listener werden bei Nutzerwechsel abgeräumt
  (`AppContext.tsx:1235-1239`); Token-Registrierung mit Sendefenster und
  Kontowechsel-Erkennung (`AppContext.tsx:223-304,450-490`; `pushToken*.test.tsx`
  grün); `removeDeliveredById` lässt nur Zahlen durch (`notifications.ts:154-179`).
- **Warteschlange:** FIFO, 4xx (außer 408/429) → sofort endgültig und gemerkt,
  5xx/Netz → Budget, Abbruch der Runde; `clear()` während `flush()` schützt über
  `_generation`; Fotos/Dateien überleben Neustart; Fehl-Merker gedeckelt auf 50
  (`writeQueue.ts`; `writeQueue.test.ts` 25 Tests grün). Idempotenz für
  Anträge passt zum Backend (`client_id` UUID, `antragIdempotenz.js`).
- **JSON.parse:** alle 13 Stellen in `try/catch` mit Aufräumen des korrupten
  Werts (`tokenStore.ts:100-108`, `offlineCache.ts:25-35`, `writeQueue.ts:169-179,
  222-232,278-300`, `biometrics.ts:380-386`, `api.ts:144-150`, drei
  Badge-Kriterien-Stellen).
- **Globale Fehlerkanäle:** `unhandledrejection` und `window.error` werden
  angehängt, bevor irgendetwas läuft (`main.tsx:38`); Start hat ein Zeitlimit
  von 4 s je Schritt und rendert in jedem Fall (`main.tsx:53-71`).
- **Update-Prüfung:** Hinweis, kein Zwang; einmal je Start; wegklickbar je
  Version; Formprüfung der Antwort (`updateCheck.ts:46-73`; Tests grün). 2.2.x
  läuft nach dem Release ungebremst weiter gegen dieselbe API.
- **App-Sperre:** Merker der laufenden Abfrage, Ausflug-Zähler, `startGeklaert`
  gegen Aufblitzen, Abdeckung beim Wegwechseln (`appSperre.ts`, `useAppSperre.ts`;
  Tests grün). Die Kopfkommentare beschreiben ehrlich, dass sie Sichtschutz ist.
- **Typprüfung:** `tsc --noEmit` fehlerfrei (14,9 s).

## Nicht geprüft

- `services/mediaCache.ts` (nur Kopf gelesen), `services/mediaCompression.ts`,
  `hooks/useOnboardingOnce.ts`, `useChallengeDelete.ts`, `useCountUp.ts`,
  `useMediaCacheControl.ts`, `components/common/PostfachModal.tsx`,
  `AppAbdeckung.tsx`, `LoadingSpinner.tsx`, `components/auth/ForgotPasswordPage.tsx`
  und `ResetPasswordPage.tsx` (nur Token-Handling per Suche),
  `types/*` außer `user.ts`, `theme/*`, iOS-/Android-Projektdateien
  (Info.plist, Manifest — `privacyManifest.test.ts`, `appLinksAndroid.test.ts`
  liefen grün, Inhalt nicht selbst gelesen).
- Verhalten im echten WebView (Preferences-Fehler, Kaltstart-URL-Wiederherstellung,
  Modal-Reste).
- Größe und Wachstum der Preferences (`cache:*`) über Wochen — nur am Gerät messbar.

## Auf Produktion nachzumessen

- **BF-01 am Gerät:** Debug-Build, Flugmodus an, `Network.getStatus()` ausgeben
  (iOS und Android). Erwartung laut Plugin: `{connected:false, connectionType:'none'}`.
  Dann Abmeldung von einem Termin versuchen: erscheint „Wird gesendet…" oder ein
  Fehler-Toast?
- **BF-02 Doppelbuchungen (SQL, Produktion):**
  ```sql
  SELECT konfi_id, points, description, count(*) AS n, min(created_at), max(created_at)
  FROM bonus_points
  GROUP BY konfi_id, points, description, date_trunc('minute', created_at)
  HAVING count(*) > 1 ORDER BY n DESC LIMIT 20;
  SELECT organization_id, name, event_date, count(*) FROM events
  GROUP BY 1,2,3 HAVING count(*) > 1;
  ```
  Server-Log: Anteil `POST`-Anfragen mit Dauer > 20 s (APM, `utils/apm.js`).
- **BF-03 Registrierung:** Refresh-Tokens aus `register-konfi`, die nie rotiert
  wurden — Näherung:
  ```sql
  SELECT count(*) FROM users u
  WHERE u.created_at > now() - interval '90 days'
    AND (SELECT count(*) FROM refresh_tokens r WHERE r.user_id = u.id) = 1
    AND EXISTS (SELECT 1 FROM refresh_tokens r WHERE r.user_id = u.id AND r.revoked_at IS NULL);
  ```
  Dazu im Log die Häufung von `401 Token expired` ~15 Minuten nach `POST /auth/register-konfi`.
- **BF-05 und Uhrzeit-Versatz:** Rotationen je Konto und Tag —
  ```sql
  SELECT user_id, count(*) FROM refresh_tokens
  WHERE created_at > now() - interval '1 day' GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
  ```
  Werte weit über der Zahl der Nutzungsviertelstunden deuten auf BF-09/Versatz.
  Im Log: Ketten von `403 Kein Zugriff auf diese Organisation` für dasselbe
  Konto über > 1 Minute (BF-05).
- **BF-04:** Verteilung der Preferences-Größe je Gerät ist nur am Gerät
  messbar; serverseitig die Häufigkeit von `401 Token invalidated` (Passwort
  auf anderem Gerät geändert) als Maß dafür, wie oft der ungeräumte Pfad
  überhaupt läuft.
