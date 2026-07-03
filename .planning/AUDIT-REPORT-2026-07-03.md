# Audit-Bericht: Datenbank, LiveUpdates & Request-Hygiene

> **Stand:** 03.07.2026 · Durchgeführt mit 4 parallelen Audit-Agenten gegen Code (main, 33e33647) und Prod-DB (read-only). Alle 4 Achsen vollständig.
> Auftrag: `.planning/AUDIT-JOB-live-db-requests.md`

---

## Executive Summary

Die Grundsubstanz ist gut: referenzielle Integrität sauber (0 Waisen in allen Kernbeziehungen), Unique-Constraints auf den kritischen Pfaden vorhanden, 429-Regel im Frontend eingehalten, viele LiveUpdate-Flows vorbildlich (Punktevergabe, Event-Buchung, Chat-Nachrichten). Es gibt aber **einen systemischen Bug mit großer Wirkung**: `sendToOrgAdmins` emittet für Teamer in den falschen Socket-Raum — **Teamer:innen sind vom gesamten LiveUpdate-System faktisch abgeschnitten** (Fix an EINER Stelle repariert Dutzende Sendungen). Zweitgrößter Hebel: `GET /chat/rooms` macht auf dem Lesepfad Chat-Sync-Schreibarbeit und wird pro eingehender Nachricht bis zu 3× pro Client aufgerufen — zusammen die Erklärung für p95 919ms und die anhaltend hohen Request-Zahlen. Drittens fehlen an ~15 mutierenden Endpoints LiveUpdate-Sendungen (Warteliste-Bestätigung mit Punktentzug ist die schwerste Lücke).

### Top-Handlungsempfehlungen (Reihenfolge)

1. **`sendToOrgAdmins`-Raum-Bug fixen** (liveUpdate.js) — 1 Stelle, repariert Teamer-Live-Updates überall. Danach `sendToKonfi`-auf-Teamer-Fälle (badges.js:628, activities.js:498f).
2. **Chat-Rooms-Kaskade entschärfen**: ChatOverview-Doppelhandler entfernen (Zeilen-Delete), Chat-Sync vom Lesepfad entkoppeln (Session-TTL), Badge-Counts-Endpoint statt 3 Voll-Fetches.
3. **LiveUpdate-Lücken HOCH schließen**: events.js Warteliste-Status/confirm-all, teamer.js Anträge.
4. **DB-Migrationen 109/110/112/115** (risikoarm: Waisen, Chat-Leichen, No-op-FK-Drops, Doppel-Indizes) — 111/113/114 als eigener, getesteter Schritt.

---

# ACHSE 1: DATENBANK (Prod read-only, nichts verändert)

## Fund-Tabelle

| # | Fund | Schweregrad | Empfehlung | Risiko |
|---|------|-------------|------------|--------|
| F1 | `activity_categories.activity_id`: **kein FK, 12 verwaiste Zeilen** (Activities 4,12,16,17,22,23,34 existieren nicht mehr). DELETE-Route `activities.js:222` löscht Junction-Zeilen nicht (nur PUT tut das) | **mittel** | Migration 109: Waisen löschen + FK CASCADE + Unique (activity_id, category_id) | gering |
| F2 | **Fehlende FKs auf `organization_id`** bei activities, categories, custom_badges, events, jahrgaenge, event_timeslots, notifications (Daten aktuell sauber) | **mittel** | Migration 111: FKs nachziehen, NO ACTION (konsistent mit prozeduralem Org-Purge organizations.js:558-613) | gering |
| F3 | **Chat-Leichen**: Rooms 50+51 (direct „Magda Spilcke", org=NULL, 0 Teilnehmer), Room 98 (1 Teilnehmer, Partner:in gelöscht). users.js:367 löscht participants, aber nie leere Direct-Rooms | **mittel** | Migration 110 + Code-Fix users.js (leere Direct-Rooms beim User-Delete mitlöschen). Room 98 = Entscheidung Simon | gering |
| F4 | **Latenter 500er beim Activity-Delete**: activities.js:200-238 prüft nur *pending* Anträge, aber der NO-ACTION-FK blockt auch bei abgelehnten → 500 statt 409. Exakt das Teamer-Lösch-Bug-Muster | **mittel** | Code-Fix: Check auf ALLE activity_requests erweitern oder abgelehnte mitlöschen | gering |
| F5 | Neue widersprüchliche FK-Paare: `bonus_points.organization_id` und `user_activities.activity_id` (je NO ACTION + CASCADE; NO ACTION gewinnt, CASCADE-Zwilling ist funktionslose Altlast) | kosmetisch | Migration 112: CASCADE-Duplikate droppen (nachweislich no-op) | keins |
| F6 | Doppel-CASCADE-FKs: event_bookings.event_id/user_id, event_points.event_id/konfi_id (je 2× identisch) | kosmetisch | Migration 112 | keins |
| F7 | **Fehlende FKs**: chat_messages.user_id, chat_participants.user_id, chat_rooms.event_id — Aufräumen rein prozedural (funktioniert, 0 Waisen, aber ohne Netz) | **mittel** | Migration 113: FKs CASCADE (deckungsgleich mit heutigem Handler-Verhalten) | gering |
| F8 | NULL erlaubt wo faktisch nie NULL: chat_messages.room_id/user_id, chat_participants.*, push_tokens.user_id/token, users.organization_id/role_id, konfi_profiles.organization_id | mittel | Migration 114: SET NOT NULL (eigener Schritt, vorher Insert-Pfade prüfen; chat_rooms.organization_id erst nach 110) + Unique-Guard user_badges(user_id,badge_id) | mittel |
| F9 | Exakt doppelte Indizes: idx_chat_rooms_org=idx_chat_rooms_organization_id; idx_invite_codes_code, idx_refresh_tokens_token_hash je redundant zu Unique | kosmetisch | Migration 115: droppen | keins |
| F10 | ~15 redundante Präfix-Indizes (führende Spalte durch mehrspaltigen/Unique-Index abgedeckt) | kosmetisch | optional in 115; bei 14MB-DB reine Hygiene | keins |
| F11 | 26 FK-Spalten ohne Index — fast alles Audit-Spalten (created_by/admin_id) auf Mini-Tabellen | kosmetisch | **keine Aktion** (Tabellen < 1000 Zeilen) | — |
| F12 | Seq-Scan-lastige Tabellen (categories 1M seq_scans bei 22 Zeilen) | kosmetisch | **keine Aktion** — Planner-gewollt bei Kleinsttabellen | — |

**Positivbefunde:** 0 verwaiste Zeilen in 20+ Beziehungen; keine Badge-Duplikate; Unique-Abdeckung wo es zählt (event_bookings, konfi_profiles, chat_participants, push_tokens, users, settings, jahrgaenge, roles, levels); Vacuum gesund (max 72 dead tuples); die 4 gewollten NO-ACTION+CASCADE-Paare auf users(id) bestätigt korrekt; Org-Delete-Kette vollständig.

## Migrations-Snippets (idempotent, ab 109)

```sql
-- 109_activity_categories_integrity.sql
DELETE FROM activity_categories ac
WHERE NOT EXISTS (SELECT 1 FROM activities a WHERE a.id = ac.activity_id);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_activity_categories_activity') THEN
    ALTER TABLE activity_categories ADD CONSTRAINT fk_activity_categories_activity
      FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE CASCADE;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_activity_categories_activity_category
  ON activity_categories (activity_id, category_id);
```

```sql
-- 110_cleanup_orphaned_direct_rooms.sql (Room 98 nur nach Freigabe Simon)
DELETE FROM chat_rooms r
WHERE r.type = 'direct'
  AND NOT EXISTS (SELECT 1 FROM chat_participants p WHERE p.room_id = r.id);
```

```sql
-- 111_add_missing_org_fks.sql
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['activities','categories','custom_badges','events','jahrgaenge','event_timeslots','notifications'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_' || t || '_organization') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT fk_%s_organization FOREIGN KEY (organization_id) REFERENCES organizations(id)', t, t);
    END IF;
  END LOOP;
END $$;
```

```sql
-- 112_drop_redundant_duplicate_fks.sql (nachweislich funktionale No-ops;
-- die 4 gewollten users(id)-Paare bleiben unangetastet!)
ALTER TABLE bonus_points    DROP CONSTRAINT IF EXISTS fk_bonus_points_org;
ALTER TABLE user_activities DROP CONSTRAINT IF EXISTS fk_user_activities_activity;
ALTER TABLE event_bookings  DROP CONSTRAINT IF EXISTS fk_event_bookings_event;
ALTER TABLE event_bookings  DROP CONSTRAINT IF EXISTS fk_event_bookings_user;
ALTER TABLE event_points    DROP CONSTRAINT IF EXISTS fk_event_points_event;
ALTER TABLE event_points    DROP CONSTRAINT IF EXISTS fk_event_points_konfi;
```

```sql
-- 113_add_chat_fks.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_messages_user') THEN
    ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_participants_user') THEN
    ALTER TABLE chat_participants ADD CONSTRAINT fk_chat_participants_user
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_chat_rooms_event') THEN
    ALTER TABLE chat_rooms ADD CONSTRAINT fk_chat_rooms_event
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE;
  END IF;
END $$;
```

```sql
-- 114_not_null_hardening.sql (eigener Schritt, Insert-Pfade vorher prüfen)
DO $$ BEGIN
  ALTER TABLE chat_messages     ALTER COLUMN room_id  SET NOT NULL;
  ALTER TABLE chat_messages     ALTER COLUMN user_id  SET NOT NULL;
  ALTER TABLE chat_participants ALTER COLUMN room_id  SET NOT NULL;
  ALTER TABLE chat_participants ALTER COLUMN user_id  SET NOT NULL;
  ALTER TABLE push_tokens       ALTER COLUMN user_id  SET NOT NULL;
  ALTER TABLE push_tokens       ALTER COLUMN token    SET NOT NULL;
  ALTER TABLE users             ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE users             ALTER COLUMN role_id         SET NOT NULL;
  ALTER TABLE konfi_profiles    ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE chat_rooms        ALTER COLUMN organization_id SET NOT NULL; -- setzt 110 voraus
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS uq_user_badges_user_badge ON user_badges (user_id, badge_id);
```

```sql
-- 115_drop_duplicate_indexes.sql
DROP INDEX IF EXISTS idx_chat_rooms_org;
DROP INDEX IF EXISTS idx_invite_codes_code;
DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;
-- plus (Achse 4, Fund 6): Index auf push_tokens.token existiert via Unique bereits? prüfen,
-- sonst: CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);
```

---

# ACHSE 2: LIVEUPDATE-ABDECKUNG

## Systemischer Hauptbefund: Teamer sind vom LiveUpdate-System abgeschnitten

- Jeder Socket joint `user_${type}_${id}` mit type aus dem JWT: `konfi | teamer | admin` (server.js:75f, auth.js:160).
- **`sendToOrgAdmins` (liveUpdate.js:51-67) selektiert korrekt admin+org_admin+teamer, emittet aber für ALLE an `user_admin_${id}`** → Teamer-Sockets (`user_teamer_${id}`) bekommen NIE ein Org-Broadcast. TeamerEventsPage, TeamerRequestsPage, Teamer-Badge-Zähler: alle tot.
- Gleiche Fehlerklasse: `badges.js:628` (Teamer-Badge-Vergabe via sendToKonfi → leerer Raum), `activities.js:498f` (Teamer-Antrag genehmigt → sendToKonfi → leer).
- Einzige korrekte Teamer-Adressierung: events.js:1258 `sendToUser('teamer', ...)`.

**Fix:** In sendToOrgAdmins Rolle mitselektieren, Raum `user_teamer_` für role='teamer'; bei den sendToKonfi-Fällen User-Typ ermitteln und `sendToUser(type, ...)` nutzen. **Ein Fix an einer Stelle repariert Dutzende Sendungen.**

## Priorisierte Lücken

| # | Lücke | Schwere | Fix |
|---|---|---|---|
| 1 | sendToOrgAdmins-Raum-Bug (Teamer nie erreicht) | **HOCH** | liveUpdate.js:51-67 Rolle→Raum-Mapping |
| 2 | Teamer-Badge + Teamer-Antrag senden sendToKonfi in leeren Raum | **HOCH** | badges.js:628, activities.js:498f: sendToUser(typ, ...) |
| 3 | events.js PUT /:id/participants/:pid/status (1975) + confirm-all (2019): Warteliste bestätigt/degradiert **inkl. Punktentzug** — NIEMAND erfährt es (kein LiveUpdate, kein Push) | **HOCH** | sendToUser('konfi', user_id, 'events'+'dashboard') + sendToOrgAdmins('events') |
| 4 | teamer.js POST/DELETE /requests (969/1026): Teamer-Anträge erreichen Admin-Antragsliste nicht | **HOCH** | sendToOrgAdmins('requests','create'/'delete') |
| 5 | konfi-management POST/PUT/DELETE /:id + promote-teamer: keine 'konfis'-Events | MITTEL | sendToOrgAdmins('konfis', aktion) |
| 6 | activities.js PUT /requests/:id/reset (271): Punktentzug+Statuswechsel unsichtbar | MITTEL | analog Genehmigungs-Handler |
| 7 | events.js POST /series (1777): einziges Event-Create OHNE sendToOrg | MITTEL | sendToOrg('events','create') |
| 8 | KonfiDashboardPage abonniert 'points' nicht; activities.js sendet 'points' statt 'dashboard' (Inkonsistenz zu konfi-management) | MITTEL | vereinheitlichen auf 'dashboard' |
| 9 | activities.js:488f `io.emit(...)` = globaler Broadcast an ALLE Orgs (Legacy, redundant) | MITTEL | Z.487-492 streichen |
| 10 | Chat: Poll-Create ohne newMessage-Emit, Poll-Votes ohne Emit (nur 30s-Fallback rettet) | MITTEL | Emit nach Poll-Insert (Muster Z.700-718); pollUpdated-Event |
| 11 | users.js komplett ohne liveUpdate → Typ 'users' nie gesendet (AdminUsersPage-Abo tot) | MITTEL | sendToOrgAdmins('users', aktion) |
| 12 | settings.js PUT ohne Broadcast (Punkt-Typ-Toggles wirken erst nach Neustart) | MITTEL | sendToOrg('dashboard','update') |
| 13 | auth.js register-konfi ohne 'konfis' (Invite-Registrierung unsichtbar) | KLEIN | sendToOrgAdmins('konfis','create') |
| 14 | Chat Raum create/delete/participants/leave ohne Emit | KLEIN | roomsChanged-Event |
| 15 | Badge-Definitions-CRUD nur an Admins (Konfi-Katalog veraltet) | KLEIN | zusätzlich sendToOrgKonfis |
| 16 | Event-Buchungen nie an andere Org-Konfis (Platz-Anzeige stale) | KLEIN | bewusste Abwägung, ggf. belassen |

## Tote Sender / stille Abos / Aufräumkandidaten

- **Toter Sender:** 'levels' wird gesendet, aber AdminLevelsPage hat KEIN useLiveRefresh → `useLiveRefresh('levels', refresh)` ergänzen.
- **Stille Abos:** 'users' (AdminUsersPage:64), 'organizations' (AdminOrganizationsPage:91) — Server sendet die Typen nie.
- **Tote Typen/Listener:** 'event_booking'; 13 Legacy-`*Update`-Listener in LiveUpdateContext:102-114 (nach Streichung von activities.js:488f alle tot → entfernen).
- **Ungenutzt:** sendToJahrgang (nie aufgerufen).
- **Hygiene:** sendToOrgAdmins/sendToOrgKonfis/sendToJahrgang filtern nicht auf `users.deleted_at IS NULL`.

**Positivbefunde:** Badge-Earned-Fix wirksam; konfi-management-Punkte-Flows sind Muster-Implementierung; events.js Attendance/Checkin/Nachrücker vorbildlich; Chat-Nachrichten erreichen alle Teilnehmer (auch Teamer, weil user_type aus DB); LiveUpdateContext robust (Auth-Recovery, socketEpoch); Socket-Join prüft Org-Isolation.

---

# ACHSE 4: REQUEST-HYGIENE & EFFIZIENZ

## Warum /chat/rooms, /events, /admin/activities/requests trotz Poll-Entfernung noch häufig sind

Der Timer ist weg, aber die **ereignisgetriebene Kaskade** bleibt:
1. **refreshAllCounts (BadgeContext) lädt für Admins alle 3 Endpoints** und feuert bei jeder Chat-Nachricht (newMessage), jedem LiveUpdate requests/events, jedem Resume/Push.
2. **ChatOverview doppelt**: eigener newMessage-Handler + Effect auf chatUnreadByRoom → bis 3× /chat/rooms pro Nachricht pro Client.
3. **useOfflineQuery revalidiert bei JEDEM Mount** (SWR), TTLs steuern nur Offline-/First-Paint — jeder Tab-Wechsel = voller Refetch.

## Fund-Tabelle

| # | Fund | Datei:Zeile | Schwere | Optimierung |
|---|---|---|---|---|
| 1 | **GET /chat/rooms macht Schreibarbeit auf dem Lesepfad**: syncJahrgangChat (pro Jahrgang!) + syncTeamChat bei JEDEM Aufruf; org_admin-Check pro Teilnehmer in Schleife. Org-Admin mit 5 Jahrgängen = 25-35 Queries vor der Raumliste. Hauptursache p95 919ms | chat.js:218-255, jahrgangChat.js:104-125, teamChat.js:75-87 | **kritisch** | Sync entkoppeln: nur bei mutierenden Ereignissen oder 1×/Session (In-Memory-TTL ~10min); org_admin-Check als Set-Query |
| 2 | **newMessage-Fan-out: bis 3× /chat/rooms pro Nachricht/Client** (BadgeContext + ChatOverview-Handler + ChatOverview-Effect). Gruppe mit 30 Mitgliedern: bis 90 Calls org-weit pro Nachricht | BadgeContext:148-163, ChatOverview:140-162 | **kritisch** | (1) ChatOverview-Doppelung entfernen (Zeilen-Delete); (2) unread lokal inkrementieren (Payload hat roomId) statt Vollfetch; (3) mind. Debounce 500-1000ms |
| 3 | **BadgeContext lädt VOLLE Listen für Zähler** (/admin/activities/requests + /events komplett, nur um pending zu zählen) | BadgeContext:62-95 | mittel | Neuer Endpoint GET /notifications/badge-counts (3 COUNT-Queries) ersetzt alle 3 Voll-Fetches |
| 4 | ChatRoom-30s-Fallback lädt immer volle 100 Nachrichten statt inkrementell (loadMissedMessages existiert!) | ChatRoom:318-320 | mittel | Poll auf loadMissedMessages(lastId) + visibilityState-Guard. NICHT ganz entfernen (Anker bei stillem Socket-Tod) |
| 5 | POST /device-token 58×/90min: fcmToken-Event bei jeder App-Aktivierung, Anti-Spam nur 10s; doppelter register()-Pfad; Push-Listener-Effect ohne Cleanup (Listener akkumulieren) | AppContext:38-73, 467-472, 552-681 | mittel | Sendefenster auf 6-12h bei unverändertem Token (Timestamp wird schon persistiert, nur nicht geprüft!); removeAllListeners im Cleanup; einen register()-Pfad entfernen |
| 6 | device-token avg 218ms: DELETE ... WHERE token=$1 vermutlich ohne Index | notifications.js:72-89 | kosmetisch | Index auf push_tokens(token) prüfen/anlegen |
| 7 | **GET /konfi/badges N+1**: pro Count-Badge sequentielle Einzel-Queries (~10-25 Queries), p95 1004ms. Punkte-Badges bereits vorgeladen (gut) | konfi.js:1004-1260 | mittel | Counts EINMAL vorab (sind konfi-global!): Promise.all pro benötigtem criteria_type, dann synchrone Zuordnung; to_regclass-Legacy-Check raus |
| 8 | **GET /konfi/dashboard: ~11 sequentielle awaits** ohne Abhängigkeit, p95 1010ms ≈ Summe der Roundtrips | konfi.js:40-308 | mittel | Nach konfi-Query alles in EIN Promise.all (9 Queries parallel) |
| 9 | **GET /events: Join-Explosion + keine Eingrenzung** (events×bookings×users×roles×categories×jahrgang_assignments vor GROUP BY; korrelierte material_count-Subquery; kein Datumsfilter — wächst unbegrenzt). Gleiche Struktur in konfi.js GET /events inkl. Waitlist-Subquery pro Zeile | events.js:47-171, konfi.js:1394ff | mittel, steigend | LATERAL-Aggregate statt Join+COUNT DISTINCT; json_agg-Sub-Selects; Datumsfenster (1 Jahr) mit ?all=true |
| 10 | QR-Modal 10s-Poll | QRDisplayModal:75 | ok | Akzeptabel (Live-Einlass gewollt); optional hybrid mit useLiveRefresh |
| 11 | Metrics 5s-Poll | AdminMetricsPage:154-160 | ok | Keine Änderung (In-Memory, Toggle, Cleanup korrekt) |
| 12 | useOfflineQuery revalidiert bei jedem Mount trotz frischem Cache — TTLs wirken nicht auf Online-Traffic | useOfflineQuery:117-123 | mittel | Bei !isStale Revalidierung überspringen oder Mindestintervall (30s). NUR nach Schließung der Achse-2-Lücken (LiveUpdates müssen tragen) |
| 13 | mark-read pro empfangener Nachricht bei offenem Chat (POST + Kaskade) | ChatRoom:340-344 | kosmetisch | Debounce 1-2s |

**Doppel-Fetches beim Mount:** /chat/rooms beim App-Start 2-3× (BadgeContext + ChatOverview useOfflineQuery + useIonViewWillEnter); max_konfis könnte in /admin/konfis-Response (spart /organizations/:id pro Mount); /events doppelt (BadgeContext + AdminEventsPage) — mit Badge-Counts-Endpoint erledigt.

**Positivbefunde:** api.ts hält 429-Regel ein (retryCondition explizit false bei 429); writeQueue sturm-sicher (FIFO, break bei transienten Fehlern, Mutex); Chat-Messages-Endpoint bulk-optimiert inkl. after=-Inkrementalpfad; /chat/rooms-Hauptquery selbst nutzt LATERAL (Problem ist der Sync davor); Badge-Punkte-Vorladung existiert schon.

## Priorisierte Reihenfolge (Aufwand vs. Wirkung)

1. **Sofort, risikoarm:** ChatOverview-Doppelhandler raus; device-token-Fenster auf Stunden; Dashboard-Promise.all; push_tokens-Index.
2. **Zweite Welle:** Chat-Sync-Entkopplung (Session-TTL); Badge-Count-Hoisting (/konfi/badges); Badge-Counts-Endpoint; inkrementeller Chat-Poll.
3. **Eigener Umbau mit Tests:** Events-Query-Restrukturierung + Datumsfenster; SWR-Verhalten (erst nach Achse-2-Lückenschluss).

---

# ACHSE 3: LIVE-PUSH & WEBSOCKET-ROBUSTHEIT

## Teil A: Push-Notification-Abdeckung

`pushService.js` exportiert 26 Methoden, alle haben Aufrufer (Routes oder backgroundService-Crons) — keine toten Push-Funktionen.

| Ereignis | Push? | Fundstelle |
|---|---|---|
| Bonuspunkte / Aktivität zugewiesen / Event-Anwesenheit / Level-Up / Badge | JA | konfi-management.js:723/716, activities.js:579/417/570, events.js:404/2158f, badges.js:622 |
| Konfi-Antrag eingereicht → Admins; genehmigt/abgelehnt → Konfi | JA | konfi.js:776, activities.js:470 |
| **Teamer-Antrag eingereicht/gelöscht → Admins** | **NEIN** | teamer.js:969/1026 — **0 PushService-Aufrufe in ganz teamer.js** (deckt sich mit LiveUpdate-Lücke Achse 2 #4) |
| Event-Buchung bestätigt (Selbstbuchung); Warteliste **automatisch** nachgerückt | JA | konfi.js:1878/1972, events.js:1010/1513/1731 |
| **Warteliste MANUELL bestätigt (Admin-Klick) + confirm-all** | **NEIN — verifiziert** | events.js:1975/2019: zwischen Z.1975 und 2158 kein einziger Push- oder LiveUpdate-Aufruf. Konfi erfährt GAR NICHTS. Größte Lücke — Erwartung "sofort" ist genau hier am höchsten |
| Neue Chat-Nachricht; Event abgesagt; neues Event (Pflicht sofort, freiwillig via Cron mit Flankenerkennung); Event-Erinnerung; Konfi-Ab-/Ummeldung → Admins; neue Registrierung → Admins | JA | chat.js:754/1130, events.js:2301/1186/784, backgroundService.js:216/259/302, konfi.js:2011-2138, auth.js:828 |
| **Event geändert (Datum/Ort/Zeit)** | **NEIN** | events.js:810 PUT /:id sendet nur LiveUpdate — kein Push an gebuchte Konfis bei Terminverschiebung. App im Hintergrund = verpasst. Mittel |
| **Zertifikat erhalten → Konfi** | **NEIN** | teamer.js:686 (teamer.js hat 0 Push-Referenzen) |
| Antrag-Reset | NEIN | vertretbar (Admin-Housekeeping) |

## Teil B: WebSocket-Lebenszyklus

| # | Fund | Szenario | Schwere | Fix |
|---|---|---|---|---|
| B1 | `reconnectionAttempts: 10` ohne reconnect_failed-Handler (websocket.ts:32) — nach ~30-50s gibt socket.io ENDGÜLTIG auf; Recovery nur bei Netzwechsel/auth-error | **Deploy-Realität (Compose Stack 249 verifiziert):** backend+backend2 teilen einen Traefik-Service (LB, Healthcheck 5s), aber NICHTS erzwingt sequenzielles Update — `update_stack` erstellt beide parallel neu. API-Downtime = Container-Recreate + ~20s start_period ≈ 20-40s → liegt GENAU an der Grenze der 10 Versuche (~30-50s). Manche Clients überleben den Deploy, manche nicht — nichtdeterministisch. Dazu: Server-Crash/längere Netzlöcher töten den Socket immer endgültig | **Mittel-Hoch** | reconnectionAttempts: Infinity + reconnectionDelayMax, oder reconnect_failed-Listener → socket.connect() |
| B2 | App-Resume ruft ensureSocketConnected() NICHT (AppContext.tsx:506-525, nur flush→invalidate→sync:reconnect) | Socket beim Resume tot (nach B1) → bleibt tot obwohl User aktiv | Mittel | ensureSocketConnected() in den isActive-Zweig |
| B3 | Token-Refresh aktualisiert socket.auth nicht → Reconnect nach >15min läuft immer über den Fehlerpfad (connect_error → auth-recovery). Funktioniert, verbrennt aber einen Versuch gegen die 10 Attempts | jeder Reconnect nach >15min | Klein | im Interceptor socket.auth = {token} setzen |
| B4 | BadgeContext-newMessage-Listener ohne socketEpoch-Dependency (BadgeContext.tsx:148-163) — hängt nach reconnectWithToken am toten Socket-Objekt | Nach Token-Rebind zählt der Chat-Badge nicht mehr live | Klein-Mittel | socketEpoch als Effect-Dependency oder newMessage zentral über LiveUpdateContext |
| B5 | **Server prüft JWT nur beim Handshake** (server.js:56-71), kein token_invalidated_at-Check (REST prüft es, rbac.js:104/138); kein Re-Check bei Emits | Gelöschter/deaktivierter/zwangs-ausgeloggter User: REST sperrt sofort, **Socket empfängt unbegrenzt weiter** Chat + LiveUpdates | Mittel (Privacy/Moderation) | Bei User-Delete/Invalidierung `io.in('user_<typ>_<id>').disconnectSockets(true)`; optional token_invalidated_at im Handshake |
| B6 | useOfflineQuery hört NICHT auf sync:reconnect (nur org:switched, useOfflineQuery.ts:161-169); invalidateAll markiert nur stale; Ionic cacht Pages → kein Remount beim Tab-Rückwechsel | Socket 5 Min tot, View bleibt offen → **sichtbare View zeigt nach Reconnect alte Daten** bis Pull-to-Refresh | Mittel | sync:reconnect-Listener in useOfflineQuery (3 Zeilen, analog org:switched) — schließt die Lücke global |

**Gesamturteil verpasste Events:** Netz zu ~80% dicht (Mount-SWR, Chat-reconnectCallback, Badge-Counts via sync:reconnect, WriteQueue-Flush). Die eine systematische Lücke ist B6 — mit dem 3-Zeilen-Fix global geschlossen.

**Positivbefunde:** Koordinierte Reconnect-Sequenz sauber (Socket-Reconnect und App-Resume identisch); auth-error-Recovery mit Single-Flight-Guard + socketEpoch robust; Org-Isolation bei joinRoom/typing serverseitig; Push-Architektur für neue Events durchdacht (Flankenerkennung gegen Doppel-Push); alle Push-Aufrufe try/catch nach COMMIT — kein Push-Fehler kippt eine Transaktion.

---

# Gesamt-Priorisierung: Sofort-Fixes vs. Umbauten

## Sofort-Fixes (risikoarm, hoher Nutzen)

| Fix | Ort | Wirkung |
|---|---|---|
| sendToOrgAdmins-Raum-Bug | liveUpdate.js:51-67 | Teamer bekommen ALLE Live-Updates |
| sendToKonfi→sendToUser bei Teamer-Empfängern | badges.js:628, activities.js:498f | Teamer-Badges/Anträge live |
| ChatOverview-Doppelhandler entfernen | ChatOverview.tsx:140-162 | -33 bis -66% /chat/rooms-Kaskade |
| io.emit-Global-Broadcast streichen | activities.js:487-492 | Org-Isolation-Hygiene |
| device-token-Sendefenster 10s→Stunden | AppContext.tsx:38-73 | -90% device-token-Calls |
| Dashboard-Queries parallelisieren | konfi.js:40-308 | p95 1010ms → ~200-300ms |
| Migrationen 109, 110, 112, 115 | backend/migrations/ | DB-Hygiene, 12 Waisen weg |
| Warteliste-Status: LiveUpdate + Push | events.js:1975, 2019 | Schwerste UX-Lücke (Bestätigung/Punktentzug komplett unsichtbar); sendWaitlistPromotionToKonfi existiert schon, ~5 Zeilen/Endpoint |
| teamer.js requests-Broadcasts + Push | teamer.js:969, 1026 | Admin sieht Teamer-Anträge live |
| AdminLevelsPage useLiveRefresh | AdminLevelsPage.tsx | toter Sender bekommt Hörer |
| Activity-Delete-Check auf alle Requests | activities.js:200-238 | latenter 500er weg |
| reconnectionAttempts: Infinity | websocket.ts:32 | App überlebt CI-Deploy-Downtime (heute: Socket stirbt endgültig nach ~50s) |
| ensureSocketConnected bei App-Resume | AppContext.tsx:507 | toter Socket wird beim Resume wiederbelebt |
| sync:reconnect-Listener in useOfflineQuery | useOfflineQuery.ts:161ff | sichtbare View aktualisiert nach Reconnect (3 Zeilen, wirkt global) |
| Socket-Disconnect bei User-Delete/Invalidierung | users.js + server.js | gelöschte User empfangen keine Events mehr (Privacy) |

## Größere Umbauten (eigener Commit + Tests)

| Umbau | Aufwand | Voraussetzung |
|---|---|---|
| Chat-Sync vom Lesepfad entkoppeln | mittel | Sync-Trigger-Punkte vollständig identifizieren |
| Badge-Counts-Endpoint (ersetzt 3 Voll-Fetches) | mittel | — |
| BadgeContext: unread lokal inkrementieren | mittel | sauberes Eigene-Nachricht-Handling |
| Events-Query-Restrukturierung + Datumsfenster | groß | Referenz-Query vieler Views, Tests |
| /konfi/badges Count-Hoisting | mittel | Konsistenz-Vertrag zu badges.js |
| Migrationen 111, 113, 114 (neue FKs + NOT NULL) | mittel | Insert-Pfade grün testen |
| useOfflineQuery-SWR drosseln | klein | Achse-2-Lücken geschlossen |
| Poll-Create/Vote-Emits im Chat | mittel | pollUpdated-Listener in ChatRoom |
