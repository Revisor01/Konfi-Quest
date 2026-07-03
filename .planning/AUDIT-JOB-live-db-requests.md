# Audit-Auftrag: Datenbank, LiveUpdates & Request-Hygiene (Konfi Quest)

> **Für:** Claude Fable
> **Kontext:** Konfi Quest (Node/Express + PostgreSQL Backend, React 19 + Ionic 8 Frontend).
> Dieser Audit entstand aus konkreten Funden am 02./03.07.2026 (siehe „Referenzfälle"
> unten). Ziel ist ein **strukturierter Befundbericht mit priorisierten Empfehlungen** —
> NICHT blind alles umbauen. Jede vorgeschlagene Änderung braucht Begründung + Risiko.

## Grundregeln (aus CLAUDE.md, zwingend beachten)

- **RBAC-Struktur**, keine alten `admins`/`konfis`-Tabellen.
- **Deutsche Entwicklungssprache**, echte Umlaute (ü/ö/ä/ß), **KEINE Emojis** im Code/UI
  (nur IonIcons).
- **Super-Admin-Prüfung immer über `req.user.is_super_admin`**, nie `role_name === 'super_admin'`.
- **Tests bei neuem/geändertem Code mitschreiben.**
- **bcrypt-Hashes NIE per SSH-inline-SQL** (Shell frisst `$2b$`-Segmente) → Node-Skript im Container.
- **CHANGELOG.md** (Repo-Root, `## [Unreleased]`) bei jeder Änderung pflegen.
- Prod ist eine einzige geteilte DB über mehrere Orgs (1=Kirchspiel West, 2=Hennstedt,
  3=Heide, 4=Test&Demo). Schema-Änderungen treffen alle Orgs.
- Deploy: `git push origin main` → CI (baut Images + Portainer-Redeploy). **Mac hat kein
  Docker** → Backend-Tests laufen nur in CI, Frontend-Vitest nativ (`cd frontend && npx vitest run`).
  Nach jedem main-Push CI-grün prüfen (Deploy hängt am grünen Test-Gate).

## Referenzfälle (das haben wir gerade gefunden — als Muster für die Suche)

1. **Doppelte FK-Constraints auf `users(id)` aus SQLite-Altlast.**
   `activity_requests`, `bonus_points`, `user_activities`, `user_badges` trugen JE zwei
   Foreign Keys auf dieselbe Spalte: einen `*_konfi_id_fkey` mit `NO ACTION` **und** einen
   `fk_*_konfi` mit `CASCADE`. Postgres wendet den striktesten an → `NO ACTION` blockierte
   das Löschen eines Users mit History (500 „Datenbankfehler").
   Fix war NICHT die Constraints zu droppen (der NO-ACTION-Schutz ist beim **Jahrgang**-Delete
   gewollt: beförderte Ex-Konfis behalten ihre History), sondern der **User-Delete-Handler**
   räumt die eigene History des Users jetzt explizit vor dem `DELETE FROM users` ab
   (`backend/routes/users.js`). `event_bookings`/`event_points` haben doppelte FKs, aber
   beide CASCADE → harmlos, nur redundant.

2. **Redundantes Frontend-Polling trotz WebSocket.**
   `BadgeContext.tsx` pollte alle 30s `/chat/rooms` + `/admin/activities/requests` + `/events`
   (Admin) — obwohl alle drei bereits live sind (Chat via `socket.on('newMessage')`,
   requests/events via `useLiveRefresh(['requests','events'])`, plus `sync:reconnect`/
   `push:received`-Trigger). `/api/chat/rooms` war dadurch ~38 % aller Requests. Entfernt.
   `MainTabs.tsx` pollte alle 60s `/konfi/badges` nur für den „neue Badges"-Zähler → ersetzt
   durch Server-seitiges `sendToKonfi('badges','earned')` in `insertBadgesAndNotify`
   (`backend/routes/badges.js`), das an allen `checkAndAwardBadges`-Stellen feuert.

3. **UI-Refresh/Toast fehlte nach Aktion.**
   Teamer-Liste ist lokaler State in `KonfisView.tsx` (`GET /admin/konfis/teamer`), wurde nach
   dem Löschen nicht neu geladen und zeigte keinen Erfolgs-Toast. Muster: Liste kommt aus
   separatem Fetch, der übergeordnete Refresh trifft sie nicht.

---

## Auftrag — 4 Achsen

### Achse 1: Datenbank-Optimierung (Constraints, Indizes, Integrität)

**Vorgehen:** Live-Schema aus Prod ziehen (read-only Analyse), NICHT direkt ändern —
alle Änderungen als **idempotente Migration** (`backend/migrations/109_*.sql` aufwärts,
höchste bestehende Nummer ist 108) mit `IF EXISTS`/`IF NOT EXISTS`-Guards vorschlagen.

DB-Zugriff (read-only):
```
ssh root@server.godsapp.de "docker exec -i konfi_quest-postgres-1 psql -U konfi_user -d konfi_db -c '<SQL>'"
```

Prüfe konkret:
1. **Doppelte/widersprüchliche FK-Constraints** auf allen Tabellen (nicht nur `users`).
   Query-Muster: pro (Tabelle, Spalte) mehr als ein FK auf dieselbe Zielspalte, besonders
   mit unterschiedlichem `confdeltype`. Für jeden Fund: Ist der NO-ACTION-Schutz gewollt
   (wie bei History) oder Altlast? → Empfehlung mit Begründung, NICHT pauschal droppen.
2. **Fehlende Indizes auf FK-Spalten.** Jede FK-Spalte, über die gejoint oder gefiltert
   wird (z. B. `*.organization_id`, `*.user_id`, `*.konfi_id`, `*.jahrgang_id`, `room_id`),
   sollte einen Index haben. Liste FK-Spalten OHNE passenden Index.
3. **Fehlende `ON DELETE`-Strategie.** Tabellen, deren Aufräumen aktuell nur im
   JS-Delete-Handler passiert (siehe `users.js`-Purge-Block) — dokumentiere, welche
   Löschketten rein prozedural sind und wo ein sauberes CASCADE die Handler entlasten würde
   (Vorsicht: History-Schutz-Fälle nicht kaputtmachen).
4. **`NOT NULL` / Defaults / Unique.** Spalten die faktisch immer gefüllt sind aber NULL
   erlauben; fehlende Unique-Constraints wo Duplikate schaden (z. B. `(organization_id, …)`).
5. **Verwaiste Daten.** Zeilen, die auf gelöschte Parents zeigen (sollten dank FKs 0 sein —
   verifiziere; wenn >0, ist irgendwo ein Handler unvollständig).
6. **Indizes für die häufigsten Queries** (siehe Achse 4 / Metrics): langsame p95-Routen
   auf fehlende Indizes prüfen (`EXPLAIN ANALYZE`).

**Deliverable:** Tabelle „Fund → Schweregrad → Empfehlung → Migrations-Snippet → Risiko".

### Achse 2: LiveUpdate-Abdeckung nach Aktionen (Vollständigkeit)

**Frage:** Feuert nach JEDER mutierenden Aktion (POST/PUT/PATCH/DELETE) ein passendes
`liveUpdate.*`, damit alle betroffenen Clients ihre Ansicht aktualisieren?

Verfügbare Sender (`backend/utils/liveUpdate.js`): `sendToUser`, `sendToKonfi`, `sendToAdmin`,
`sendToOrgAdmins`, `sendToOrgKonfis`, `sendToOrg`, `sendToJahrgang`.
Frontend-Typen (`LiveUpdateType` in `LiveUpdateContext.tsx`): `dashboard`, `events`,
`event_booking`, `badges`, `requests`, `konfis`, `points`, `chat`, `activities`,
`categories`, `jahrgaenge`, `levels`, `users`, `organizations`.

**Vorgehen:**
1. Alle mutierenden Endpoints in `backend/routes/*.js` (18 Dateien) auflisten.
2. Pro Endpoint prüfen: Wird ein `liveUpdate.*` gesendet? An die **richtige Zielgruppe**?
   (z. B. Antrag genehmigt → Konfi bekommt `points`/`requests`, Admins bekommen `requests`.)
   Mit dem **richtigen Typ**, den das Frontend auch abonniert?
3. **Gegenprobe Frontend:** Welche Views abonnieren welche Typen (`useLiveRefresh`)? Gibt es
   Sende-Events, die niemand hört (toter Sender), oder Views, die auf ein Event warten, das
   der Server nie sendet (stille Lücke)?
4. **Zielgruppen-Korrektheit:** Achtung auf `sendToOrgAdmins` vs. `sendToKonfi` — heute
   gefunden: Badge-Vergabe sendete nur an Admins, nicht an den betroffenen Konfi.

**Deliverable:** Matrix „Endpoint × sendet LiveUpdate? × Typ × Zielgruppe × Frontend hört zu?"
mit den Lücken markiert.

### Achse 3: „Alles Wichtige wird live gepusht" (Push vs. Poll)

Konzeptionelle Prüfung, welche Daten **überhaupt** live sein sollten und ob der Kanal steht:
- WebSocket-Events (`socket.on(...)` in `LiveUpdateContext.tsx`, Chat in `ChatRoom.tsx`).
- Push Notifications (`backend/services/pushService.js`) — für App-im-Hintergrund-Fälle.
- Fallback-Trigger: `sync:reconnect`, `push:received`.

Prüfe: Gibt es Daten, die der Nutzer „sofort" erwartet (Punkte, Badges, neue Chat-Nachricht,
Event-Bestätigung, Antrag-Status), die aktuell NUR beim manuellen Reload/Seitenwechsel
kommen? Ist der WebSocket-Reconnect robust (Token-Refresh, App-Resume aus Hintergrund)?

**Deliverable:** Liste „Daten, die live sein sollten × aktueller Mechanismus × Lücke?".

### Achse 4: Request-Hygiene / verbleibende Optimierung

**Baseline (Live-Metrics, `/api/metrics`, im Super-Admin-Dashboard sichtbar):** Bei ~35
Nutzer:innen ~0,1 rps — Last ist unkritisch. Ziel ist Sauberkeit, nicht Skalierung.

Prüfe:
1. **Verbleibende `setInterval`-Polls** (nach den heutigen Fixes noch da):
   - `ChatRoom.tsx:318` — 30s-Fallback-Poll `loadMessages`, nur bei offenem Chat. Bewusster
     Sicherheitsanker; bewerten ob nötig (WebSocket trägt Nachrichten bereits).
   - `QRDisplayModal.tsx:75` — 10s Anwesenheits-Poll, nur bei offenem QR-Modal. Vermutlich ok.
   - `AdminMetricsPage.tsx:157` — 5s Metrics-Poll, nur auf der Metrics-Seite mit Auto-Refresh-
     Toggle. Ok.
   Für jeden: nötig / durch LiveUpdate ersetzbar / auf „nur wenn sichtbar" (Page Visibility)
   drosselbar?
2. **N+1 / Über-Fetching:** Endpoints, die pro Listeneintrag eine Extra-Query machen
   (z. B. Badge-Count je Chatroom). Langsame p95-Routen aus Metrics gegen Query-Plan prüfen.
3. **Doppel-Fetches beim Mount:** Views, die dieselben Daten mehrfach laden (mehrere
   `useOfflineQuery`/`api.get` für überlappende Daten).
4. **Cache-TTLs** (`useOfflineQuery`, `CACHE_TTL`): sinnvoll gewählt oder unnötig aggressiv?

**Deliverable:** Liste „Poll/Fetch × Häufigkeit × nötig? × Optimierung × Aufwand/Risiko".

---

## Format des Abschlussberichts

Ein Markdown-Dokument mit:
1. **Executive Summary** (3–5 Sätze: Zustand + Top-3-Handlungsempfehlungen).
2. Pro Achse: Fund-Tabelle mit Schweregrad (kritisch / mittel / kosmetisch), Empfehlung,
   Aufwand, Risiko.
3. **Sofort-Fixes** (risikoarm, hoher Nutzen) getrennt von **Größeren Umbauten** (eigener
   Commit/Feature, Tests nötig).
4. Für jede DB-Änderung ein **idempotentes Migrations-Snippet** (ab `109_*.sql`).

**Nicht** ungefragt deployen oder Prod-Schema ändern — der Bericht ist die Lieferung.
Umsetzung entscheidet Simon danach.
