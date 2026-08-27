# Push-Zustellung Ende zu Ende

Auftrag: Alle Push-Auslöser inventarisieren, für jede Sende-Methode prüfen,
ob sie aufgerufen wird und die richtigen Empfänger:innen erreicht, ob jeder
gesendete `data.type` beim Antippen an der richtigen Stelle der jeweiligen
Rolle landet, ob Multi-Org (`organization_id`) durchgängig gesetzt und
ausgewertet wird, was mit Tokens bei Abmeldung/Löschung/Ablehnung passiert,
und ob der Master-Schalter `push_enabled` überall greift.

Stand: 27.08.2026, geprüfter Code-Stand `8dec51bc` — alle Datei:Zeile-Angaben
beziehen sich auf diesen Commit. Während der Prüfung hat eine PARALLELE
Sitzung im selben Arbeitsbaum auf den Branch `fix/app-icon-hintergrund-sync`
gewechselt und (noch uncommittet) `pushService.js`/`backgroundService.js`
geändert — das betrifft genau die erste Hälfte von Befund M3, siehe dort.

**Urteil in einem Satz:** Das Senden ist in gutem Zustand (alle 36 Methoden
haben Aufrufer, der Master-Schalter greift lückenlos, die Token-Hygiene ist
mehrfach abgesichert) — aber ein Drittel aller Push-Arten führt beim
Antippen nirgendwohin, Erinnerungen feuern auch für abgesagte Events, und
der App-Icon-Sync behandelt die beiden Leitungsrollen unterschiedlich.

Alle als "gemessen" markierten Aussagen wurden am 27.08.2026 mit temporären
Tests gegen die Test-DB (Backend, `vitest`, 4 Tests, alle grün) bzw. gegen
`buildPushTargetUrl` (Frontend, 1 Test, grün) nachgewiesen; die Testdateien
sind wie beauftragt wieder gelöscht.

---

## Befunde nach Schwere

### H1 (HOCH): Event-Erinnerungen feuern auch für abgesagte Events — gemessen

Der Erinnerungs-Job (`backend/services/backgroundService.js:395-407` für
1 Tag vorher, `:441-452` für 1 Stunde vorher) selektiert alle
`event_bookings` mit `status = 'confirmed'` (`:399`, `:445`) — **ohne**
`e.cancelled = false`. Die Absage-Route setzt nur das Flag
(`backend/routes/events.js:3162`) und lässt die Buchungen auf `confirmed`
stehen (`:3168-3172` liest sie danach unverändert zum Benachrichtigen).

Gemessen: Event morgen, `cancelled = true`, eine bestätigte Buchung —
`sendEventReminders` ruft `sendEventReminderToKonfi` genau 1x für dieses
Event auf. Wer die Absage-Push ("Leider abgesagt") bekommen hat, bekommt
am Vortag trotzdem "Morgen: Event!" und eine Stunde vorher "Gleich: Event!".
Das ist die verwirrendste denkbare Reihenfolge.

Vorschlag: `JOIN events e ... AND e.cancelled = false` in beide Queries;
Test mit abgesagtem (verbotener Fall) und nicht abgesagtem Event (erlaubter
Fall).

### M2 (MITTEL): 10 von 30 Push-Arten haben beim Antippen KEIN Ziel — gemessen

Die Weiche `buildPushTargetUrl`
(`frontend/src/utils/pushNavigation.ts:75-145`) kennt 20 Typen; der
`default`-Zweig (`:142-144`) liefert `''` = keine Navigation. Gemessen
(alle drei Rollen): für diese 10 vom Backend gesendeten Typen kommt `''`
zurück — der Tap öffnet die App nur dort, wo sie zuletzt stand:

| Typ | gesendet von | sinnvolles Ziel wäre |
|---|---|---|
| `event_changed` | `pushService.js:999` | `{rolle}/events` bzw. Event-Detail |
| `event_opt_out` | `pushService.js:1427` | `/admin/events` |
| `event_opt_in` | `pushService.js:1464` | `/admin/events` |
| `challenge_badge_earned` | `pushService.js:1142` | `{rolle}/challenges` |
| `challenge_submission_hidden` | `pushService.js:1182` | `{rolle}/challenges` |
| `jahrgang_deletion_warning` | `pushService.js:1340` | `/admin/settings/jahrgaenge` |
| `mandatory_event_created` | `pushService.js:1502` | `/konfi/events/:id` |
| `teamer_event_booking` | `pushService.js:1525` | `/admin/events/:id` |
| `teamer_event_cancellation` | `pushService.js:1545` | `/admin/events/:id` |
| `certificate` | `pushService.js:1565` | `/teamer/profile` |

Der Org-Wechsel passiert immerhin trotzdem (in
`frontend/src/contexts/AppContext.tsx:744-749` läuft `resolveOrgForPush`
VOR `buildPushTargetUrl`) — Multi-Org-Nutzer:innen landen also in der
richtigen Gemeinde, nur eben auf der falschen Seite. Der bestehende Test
`frontend/src/__tests__/utils/pushNavigation.test.ts:110-113` dokumentiert
das Verhalten für `certificate` sogar als "unbekannter Typ" — die Lücke ist
teils bekannt, aber nie als Inventar gegen das Backend abgeglichen worden.
Genau daran ist auch der Wrapped-Tap schon einmal gescheitert
(Kommentar "Bestandslücke" in `pushNavigation.ts:138-139`).

Vorschlag: die 10 Fälle ergänzen und einen Paritätstest anlegen, der die
Typ-Liste aus `pushService.js` gegen die `case`-Liste der Weiche hält
(Muster: `backend/tests/utils/appIconBadgeVerdrahtung.test.js` liest die
Quelldatei).

### M3 (MITTEL): App-Icon-Sync behandelt die zwei Leitungsrollen verschieden — gemessen

Der 5-Minuten-Sync lädt seine Empfänger mit `WHERE r.name != 'admin'`
(`backend/services/backgroundService.js:118`), obwohl der Kommentar
darüber (`:95`) "Alle Konfis und Teamer:innen" beabsichtigt. Jede
Organisation hat aber ZWEI Leitungsrollen: `org_admin`
("Organisations-Admin") und `admin` ("Hauptamt",
`backend/routes/organizations.js:339-340`). Gemessen (alle vier Rollen mit
Token): `sendBadgeUpdate` wird für konfi, teamer und **org_admin**
aufgerufen, für die Rolle **admin nicht**.

Folge, zweigeteilt:
- **org_admin** bekommt alle 5 Minuten die **Chat-only**-Zahl aufs Icon
  (`backgroundService.js:162` liest nur `chatUnreadMap`, `:180` sendet sie)
  — und die überschreibt die volle Summe (Chat + Anträge + Termine +
  Freigaben), die jeder sichtbare Push seit dem B2b-Fix korrekt setzt
  (`pushService.js:198-200`, `utils/appIconBadge.js`).
- **admin** (Hauptamt) bekommt gar keinen Sync — sein Icon wird im
  Hintergrund nie nachgeführt.

Dazu eine falsche Entwarnung: BAUSTELLEN.md (Zeile 1249-1252) hält den
Sync für unkritisch, weil er angeblich "nur bei geöffneter App" läuft.
Das stimmt nicht — es ist ein serverseitiger Intervall-Job
(`backgroundService.js:50-58`), und `sendFirebaseSilentPush`
(`backend/push/firebase.js:88`) stellt gerade bei GESCHLOSSENER App zu;
dafür ist er da. Der Client korrigiert dann nichts.

**Parallelarbeit, noch während der Prüfung entdeckt:** Auf dem Branch
`fix/app-icon-hintergrund-sync` liegt (uncommittet) ein Fix genau für die
Chat-only-Hälfte — `sendBadgeUpdate` rechnet die Zahl künftig selbst über
`berechneBadge`, statt sie vom Aufrufer zu nehmen. Der Rollenfilter
`r.name != 'admin'` ist darin UNVERÄNDERT: Die org_admin/Hauptamt-Asymmetrie
bleibt auch nach diesem Fix offen (org_admin bekäme dann zwar die richtige
Zahl, Hauptamt weiterhin gar keine).

Vorschlag (zusätzlich zum laufenden Fix): Rollenfilter auf
`r.name IN ('konfi','teamer')` ODER beide Leitungsrollen aufnehmen; die
BAUSTELLEN-Notiz korrigieren.

### M4 (MITTEL): `badge_earned` und `activity_request_status` ohne Content-Org — für Multi-Org-Teamer:innen falscher Org-Wechsel möglich

Die eigene Regel steht in `pushService.js:83-86`: Aufrufstellen, deren
Empfänger Multi-Org sein können, setzen die Content-Org explizit — der
Fallback (Primär-Org des Empfängers, `pushService.js:190`) ist nur für
Konfis (immer Single-Org) gedacht. Zwei Stellen verletzen das:

- `sendBadgeEarnedToKonfi` (`pushService.js:571-583`) hat keinen
  Org-Parameter, obwohl Abzeichen ausdrücklich auch an Teamer:innen gehen
  (`backend/routes/badges.js:648-651`) und die Aufrufstelle die
  `organizationId` in der Hand hält (`badges.js:617` hat sie,
  `:643` übergibt sie nicht).
- `sendActivityRequestStatusToKonfi` (`pushService.js:548-554`, kein
  `organization_id` im data-Objekt): Anträge stellen auch Teamer:innen
  (`backend/routes/teamer.js:1520`), die Statusmeldung geht an
  `request.user_id` (`backend/routes/activities.js:602`) — also ggf. an
  eine Multi-Org-Teamer:in.

Verdient eine Teamer:in mit zwei Gemeinden ein Abzeichen in ihrer
Zweit-Gemeinde, trägt der Push die Primär-Org — der Tap wechselt in die
falsche (oder gar nicht) und zeigt die Abzeichen der falschen Gemeinde.
Nicht einzeln gemessen (bräuchte Multi-Org-Seed), aber der Mechanismus ist
identisch mit dem gemessenen Fallback-Verhalten von `sendToUser`
(`pushService.js:187-192`). Vorschlag: `organizationId` an beiden Stellen
durchreichen, wie es `sendCertificateToTeamer` (`pushService.js:1559`)
bereits vormacht.

### M5 (MITTEL): `new_event` geht auch an soft-gelöschte Konfis — gemessen

`sendNewEventToOrgKonfis` selektiert alle Org-Konfis ohne
`u.deleted_at IS NULL` (`pushService.js:1020-1024`) — im Kontrast zur
Nachbarmethode `sendChallengeStartedToJahrgaenge`, die den Filter hat
(`pushService.js:1081`). Die Jahrgangs-Archivierung setzt bei Konfis
60-120 Tage nach der Konfirmation nur `deleted_at`
(`backgroundService.js:1125`), löscht aber keine Tokens. Gemessen:
ein Konfi mit `deleted_at = NOW()` steht in der Empfängerliste. Solche
Konten bekommen bis zur 30-Tage-Token-Bereinigung weiter "Neues
Event!"-Pushes einer Gemeinde, aus der sie ausgeschieden sind.
Vorschlag: `AND u.deleted_at IS NULL` ergänzen (Test: verbotener und
erlaubter Fall).

### N1 (NIEDRIG): Zwei Teamer-Ziele der Weiche sind veraltet

- `activity_request_status`/`new_activity_request` schickt Teamer:innen
  auf `/teamer/dashboard` mit dem Kommentar "Teamer hat keine
  Requests-Page" (`pushNavigation.ts:87-88`) — inzwischen existiert
  `/teamer/requests` als Redirect auf die Antrags-Ansicht
  (`frontend/src/components/layout/MainTabs.tsx:306`).
- `badge_earned` schickt Teamer:innen auf `/teamer/profile`
  ("Teamer hat keine Badges-Page", `pushNavigation.ts:91-92`) — es gibt
  `/teamer/badges` (`MainTabs.tsx:303`).

Beides landet in der richtigen Rolle, nur eine Ebene zu hoch.

### N2 (NIEDRIG): Org-Filter macht den Token-Delete beim Logout für org-gewechselte Nutzer:innen zum stillen No-op

`DELETE /notifications/device-token` löscht nur bei
`u.organization_id = req.user.organization_id`
(`backend/routes/notifications.js:281-289`). Nach einem Org-Wechsel steht
im JWT die aktive Org, in `users.organization_id` die Primär-Org — der
Delete trifft dann 0 Zeilen und meldet trotzdem Erfolg (`changes: 0`).
Aufgefangen wird das vom zweiten Weg: `/auth/logout` löscht ungefiltert
(`backend/routes/auth.js:1233`), und der Client sendet dort seit dem
Audit vom 22.08. die Geräte-Daten mit (`frontend/src/services/auth.ts:131-135`).
Beide Wege sind aber best-effort (Timeout, nur online) — der Org-Filter
nimmt dem ersten Weg ohne Not seine Wirkung. Vorschlag: Filter auf
`pt.user_id = $1` reduzieren (eigene Tokens löschen darf man immer).

### N3 (NIEDRIG): 30 Tage App-Abstinenz beendet die Zustellung komplett

Der Cleanup-Job löscht Tokens mit `updated_at` älter als 30 Tage
(`backgroundService.js:617`). `updated_at` wird nur beim
App-Start-Upsert aufgefrischt (`notifications.js:245-255`,
Client-Drossel in `AppContext.tsx:55-79`). Ein gültiger FCM/APNs-Token
läuft aber nicht nach 30 Tagen ab — wer die App einen Monat nicht öffnet
(Sommerferien), bekommt danach auch keine Event-Erinnerung mehr, die ihn
zurückholen würde. Bewusster Karteileichen-Schutz, aber das Fenster ist
knapp gewählt; 90 Tage wären ohne Hygiene-Verlust möglich.

### N4 (NIEDRIG): Deaktivierte Leitungs-Konten bekommen weiter Leitungs-Pushes

Nur `sendJahrgangDeletionWarningToAdmins` filtert auf
`u.is_active = true` (`pushService.js:1327`); alle anderen
Admin-Empfängerabfragen (z.B. `sendToOrgAdmins` `pushService.js:477-481`,
`sendNewActivityRequestToAdmins` `:507-511`, Opt-out/Opt-in
`:1410-1414`/`:1447-1451`) tun das nicht und prüfen auch `deleted_at`
nicht. Solange deaktivierte Konten Tokens behalten (Deaktivieren löscht
sie nicht, nur das harte Löschen tut es, `backend/routes/users.js:501`),
bekommen sie weiter Antrags- und Abmelde-Pushes. Vorschlag: einheitlich
`u.is_active = true AND u.deleted_at IS NULL` in die
Admin-Empfängerabfragen.

---

## Ausdrücklich geprüft und in Ordnung

- **Jede Sende-Methode hat Aufrufer.** Alle 36 `send*`-Methoden aus
  `pushService.js` wurden per grep auf Aufrufstellen geprüft — keine
  einzige ist verwaist (Tabelle unten nennt jede Stelle).
- **`org_admin` bekommt überall mit, was `admin` bekommt.** Alle
  Admin-Empfängerabfragen im Push-Weg verwenden
  `r.name IN ('admin', 'org_admin')` (`pushService.js:480, 510, 743,
  1291, 1327, 1364/1375, 1413, 1450`) — das M6-Muster (In-App nur an
  `admin`) existiert im PUSH-Weg nicht. Die einzige Rollen-Asymmetrie
  ist der Icon-Sync (M3), und dort in umgekehrter Richtung.
- **Master-Schalter greift lückenlos — gemessen.** `push_enabled = false`
  liefert 0 Tokens, `true` liefert 1 (`getTokensForUser`,
  `pushService.js:62-74`). Alle drei Sendewege sind angebunden:
  `sendToUser` über `getTokensForUser` (`:172`), `sendChatNotification`
  mit eigener Query inkl. `u.push_enabled = true` (`:309`),
  `sendBadgeUpdate` über `getTokensForUser` (`:416`). Es gibt keinen Weg
  daran vorbei: `sendFirebasePushNotification`/`sendFirebaseSilentPush`
  werden ausschliesslich in `pushService.js` importiert (grep über
  routes/, services/, utils/, push/).
- **Multi-Org-Grundgerüst steht.** `sendToUser` stringifiziert eine
  mitgegebene Content-Org oder setzt die Primär-Org des Empfängers ein
  (`pushService.js:186-192`); der Chat-Push löst die Raum-Org auf
  (`:278-293`); `sendToOrgAdmins` reichert an (`:489-495`). Clientseitig
  wechselt `resolveOrgForPush` VOR der Navigation und navigiert mit der
  Rolle der ZIEL-Org (`pushNavigation.ts:34-61`,
  `AppContext.tsx:748-752`), abgesichert durch
  `pushNavigation.test.ts`. Übrig sind nur die zwei Aufrufstellen aus M4.
- **Token-Hygiene ist mehrfach abgesichert.** Abmelden: zwei Wege
  (Client-DELETE + serverseitig im Logout, `auth.js:1218-1240`).
  Konto-Löschung: `users.js:501`; Org-Löschung: `organizations.js:734`.
  Von FCM abgelehnte Tokens
  (`registration-token-not-registered`/`invalid-registration-token`)
  werden sofort gelöscht (`pushService.js:227-233`, `:378-384`,
  `:437-443`), sonstige Fehler zählen `error_count` hoch, und der
  Cleanup-Job räumt `error_count >= 10`, Waisen und 30-Tage-Leichen ab
  (`backgroundService.js:612-622`; zum Fenster siehe N3). Doppelte
  Zustellung an denselben Token ist per `DISTINCT ON (token)` und dem
  Unique-Delete beim Registrieren ausgeschlossen
  (`pushService.js:63`, `notifications.js:238-243`).
- **try/catch-Politik.** Jede Sende-Methode fängt intern
  (`return { success: false, ... }`), die Aufrufstellen fangen zusätzlich
  — Push blockiert nie eine Antwort, Fehler landen im Log. Still
  verloren geht dabei nichts Kritisches: Für die wichtigen
  Konfi-Meldungen (Antragsstatus, Abzeichen) existiert parallel eine
  In-App-Notification in der `notifications`-Tabelle
  (`activities.js:584`, `badges.js:625`, `konfi.js:763/814`,
  `teamer.js:1469/1501`), und die Sachverhalte selbst (Buchungsstatus,
  Punkte) sind in der App jederzeit sichtbar.
- **Alle Hintergrund-Push-Jobs werden tatsächlich gestartet**
  (`server.js:431` -> `backgroundService.js:1190-1203`): Icon-Sync,
  Erinnerungen, Anmeldefenster, Challenge-Start, Token-Cleanup, Wrapped,
  Jahrgangs-Warnung.

---

## Tabelle: Alle Push-Arten

Status: OK = kommt an und landet richtig; Kürzel verweisen auf Befunde.

| data.type | Auslöser | Empfänger | Ziel beim Antippen | Status |
|---|---|---|---|---|
| `chat` | Neue Nachricht (`chat.js:1102`, Umfrage `:1902`) | Raum-Teilnehmer ausser Sender, push_enabled-gefiltert | `{rolle}/chat/room/:roomId` | OK |
| (silent, ohne type) | Icon-Sync alle 5 Min (`backgroundService.js:180`) | alle ausser Rolle `admin` | kein Tap | M3 |
| `new_activity_request` | Konfi-/Teamer-Antrag (`konfi.js:835`, `teamer.js:1520`) | Org-Admins | `/admin/requests` (Redirect auf Antrags-Segment) | OK |
| `activity_request_status` | Antrag entschieden (`activities.js:602`) | Antragsteller:in (Konfi ODER Teamer:in) | `/konfi/requests` bzw. `/teamer/dashboard` | M4, N1 |
| `badge_earned` | Abzeichen vergeben (`badges.js:643`) | Konfi oder Teamer:in | `/konfi/badges` bzw. `/teamer/profile` | M4, N1 |
| `activity_assigned` | Aktivität zugewiesen (`activities.js:723`) | Konfi | `/konfi/dashboard` | OK |
| `bonus_points` | Bonuspunkte (`konfi-management.js:886`) | Konfi | `/konfi/dashboard` | OK |
| `event_registered` | Anmeldung (`konfi.js:1775`; Teamer `events.js:1746`) | Konfi/Teamer:in | `{rolle}/events` | OK |
| `event_unregistered` | Abmeldung (`konfi.js:1940`) | Konfi | `/konfi/events` | OK |
| `event_unregistration` | Konfi-Abmeldung (`konfi.js:1947`) | Org-Admins | `/admin/events` | OK |
| `level_up` | Punktevergabe-Levelcheck (`activities.js:549/714`, `events.js:573/2906/3049`, `konfi-management.js:879`) | Konfi | `/konfi/dashboard` | OK |
| `event_reminder` | Job 1 Tag / 1 Std vorher (`backgroundService.js:416/460`) | bestätigt Gebuchte (auch Teamer:innen) | `{rolle}/events` | **H1** |
| `waitlist_promotion` | Nachrücken (`events.js:1359/1374/2054/2056/2392/2394/2782`, `konfi.js:1908`) | Konfi/Teamer:in | `{rolle}/events` | OK |
| `event_cancelled` | Absage (`events.js:1621/3181`) | Gebuchte | `{rolle}/events` | OK |
| `event_changed` | Termin/Ort geändert (`events.js:1451`) | Gebuchte | **kein Ziel** | M2 |
| `new_event` | Anmeldefenster öffnet (`backgroundService.js:301`) | ALLE Org-Konfis | `/konfi/events/:id` | M5 |
| `mandatory_event_created` | Pflicht-Event angelegt (`events.js:1032`) | Konfis der Jahrgänge | **kein Ziel** | M2 |
| `event_attendance` | Anwesenheit verbucht (`events.js:574/580/2908/3050/3053/3058`) | Konfi | `{rolle}/events` | OK |
| `events_pending_approval` | Job unverbuchte Events (`backgroundService.js:554`) | Org-Admins | `/admin/events` | OK |
| `event_opt_out` | Pflicht-Event-Abmeldung (`konfi.js:2013`) | Org-Admins | **kein Ziel** | M2 |
| `event_opt_in` | Wieder-Anmeldung (`konfi.js:2078`) | Org-Admins | **kein Ziel** | M2 |
| `teamer_event_booking` | Teamer-Anmeldung (`events.js:1737`) | Org-Admins | **kein Ziel** | M2 |
| `teamer_event_cancellation` | Teamer-Abmeldung (`events.js:2075`) | Org-Admins | **kein Ziel** | M2 |
| `new_konfi_registration` | Registrierung (`auth.js:944`) | Jahrgangs-Admins, Fallback Org-Admins | `/admin/konfis` | OK |
| `jahrgang_deletion_warning` | Job Lösch-Warnung (`backgroundService.js:1013`) | aktive Org-Admins | **kein Ziel** | M2 |
| `challenge_started` | Job Challenge-Start (`backgroundService.js:373`) | Konfis der zugew. Jahrgänge | `{rolle}/challenges` | OK |
| `challenge_submission` | Beitrag eingereicht (`challenges.js:776`) | Org-Admins + Teamer der Jahrgänge | `{rolle}/challenges` | OK |
| `challenge_badge_earned` | Stempel erhalten (`challenges.js:798/1634`) | Einreichende:r | **kein Ziel** | M2 |
| `challenge_submission_hidden` | Beitrag ausgeblendet (`challenges.js:1613`) | Einreichende:r | **kein Ziel** | M2 |
| `certificate` | Zertifikat vergeben (`teamer.js:779`) | Teamer:in | **kein Ziel** | M2 |
| `wrapped` | Freigabe von Hand + Cron (`wrapped.js:542/609/752/807`) | Konfis bzw. Teamer:innen | `{rolle}/dashboard` | OK |

---

## Kurzfassung

1 Befund HOCH, 4 MITTEL, 4 NIEDRIG. Drei der fünf gewichtigen Befunde
sind gemessen, nicht nur gelesen.

**H1:** Der Erinnerungs-Job kennt keine Absagen — wer für ein abgesagtes
Event gebucht war, bekommt nach der Absage-Push trotzdem "Morgen: Event!"
und "Gleich: Event!". Zwei fehlende `cancelled = false`-Bedingungen in
`backgroundService.js`.

**M2:** 10 der 30 Push-Arten (u.a. Event-Änderung, Pflicht-Event,
Stempel, Zertifikat, alle Teamer-Buchungsmeldungen an die Leitung) haben
in der Antipp-Weiche keinen Fall — der Tap öffnet die App nur irgendwo.
Ein Paritätstest Backend-Typen gegen Frontend-Weiche würde das dauerhaft
verhindern.
