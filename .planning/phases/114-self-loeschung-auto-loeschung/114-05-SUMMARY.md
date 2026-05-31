---
phase: 114-self-loeschung-auto-loeschung
plan: 05
subsystem: backend-routes
tags: [soft-delete, dsgvo, dsg-ekd, visibility-filter, events, chat, wrapped, badges, teamer]

# Dependency graph
requires:
  - phase: 114-01
    provides: users.deleted_at TIMESTAMP NULL (Migration 082) + idx_users_deleted_at
  - phase: 114-04
    provides: deleted_at-Filter in primaeren Sichtbarkeitsflaechen (konfi-management, konfi, levels)
provides:
  - deleted_at IS NULL Filter in sekundaeren Konfi-Sichtbarkeitsquellen (Events/Chat/Wrapped/Badges/Teamer)
  - Auto-Enroll erstellt keine Buchungen fuer archivierte Konfis
affects: [Auto-Delete-Cron (Tag 60 Archivierung wird jetzt ueberall respektiert)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Soft-Delete-Sichtbarkeitsfilter: AND u.deleted_at IS NULL in WHERE-Bedingung (nicht JOIN-ON, um LEFT JOIN nicht zu INNER zu machen)"
    - "Filter nur an personensichtbar-machenden / buchungserzeugenden Quellen; Nachrichten-Historie + Teamer-Listen bewusst unangetastet"

key-files:
  created: []
  modified:
    - backend/routes/events.js
    - backend/routes/chat.js
    - backend/routes/wrapped.js
    - backend/routes/badges.js
    - backend/routes/teamer.js
    - backend/tests/routes/events.test.js
    - backend/tests/routes/teamer.test.js

key-decisions:
  - "events.js Z.82 (Listen-Uebersicht, LEFT JOIN u_book) NICHT gefiltert: ein WHERE-Filter wuerde Events ohne Buchungen ausschliessen; nicht in der Plan-Stellenliste. Kapazitaetspruefung erfolgt kanonisch ueber die gefilterte Buchungs-Zaehlung beim Buchen (Z.1265)."
  - "events.js Z.1524 (Booking-Detail per bookingId fuer DELETE) NICHT gefiltert: reiner Schreib-/Status-Check, Admin muss Buchung eines gerade archivierten Konfis loeschen koennen."
  - "chat.js Nachrichten-Autor-Joins (last_message LATERAL, message-thread) bewusst NICHT gefiltert (T-114-13 accept): historische Nachrichten bleiben sichtbar, nur Personen-/Teilnehmerlisten gefiltert."
  - "chat.js POST /direct validUser-Check gefiltert: verhindert das Erstellen neuer Direkt-Chats mit archivierten Konfis (beziehungserzeugend, analog Auto-Enroll)."
  - "wrapped.js Aggregat-Subqueries (Perzentil Z.110, Rang Z.125, betreute Konfis Z.320) NICHT gefiltert: nicht in der Plan-Stellenliste, interne Statistik ohne users-Alias; archivierte Konfis bekommen ohnehin kein eigenes Wrapped mehr (Generierungs-SELECTs gefiltert)."

requirements-completed: [D-08, D-12]

# Metrics
duration: 18min
completed: 2026-05-31
---

# Phase 114 Plan 05: Soft-Delete-Filter-Sweep Teil 2 Summary

**deleted_at IS NULL-Filter an allen sekundaeren Konfi-Sichtbarkeitsquellen (Events, Chat, Wrapped, Badges, Teamer-Uebersicht); zusammen mit Plan 114-04 ist die D-12-Vollstaendigkeit erreicht — soft-geloeschte Konfis sind ueberall unsichtbar und werden nicht in neue Pflicht-Events enrollt.**

## Performance

- **Duration:** ~18 min
- **Tasks:** 3 von 3
- **Files modified:** 7

## Accomplishments

- **events.js (9 Stellen):** Teilnehmerliste (`GET /:id`), Abmeldungen, Auto-Enroll bei Event-Create und Event-Update, Push-Empfaenger-Auswahl, Push an gebuchte Konfis bei Loeschung, Kapazitaets-Zaehlung beim Buchen, Event-Chat-Teilnehmer-Insert und Absage-Push filtern jetzt `AND u.deleted_at IS NULL`. Archivierte Konfis erscheinen nicht mehr in Listen und werden nicht in neue Pflicht-Events auto-enrollt (T-114-11, T-114-12).
- **chat.js (3 Stellen):** Direkt-Chat-Partner-Validierung (`POST /direct`), Jahrgang-Konfi-Auswahl bei Chat-Erstellung und Raum-Teilnehmerliste (`GET /rooms/:id`) gefiltert. Nachrichten-Historie und admin/org_admin/teamer-Listen bewusst unangetastet (T-114-13 accept).
- **wrapped.js (2 Stellen):** Konfi-Listen fuer Wrapped-Generierung (Admin-Endpoint `POST /generate` + Cron `generateAllKonfiWrapped`) gefiltert. Teamer-Listen unveraendert (Teamer werden nie soft-geloescht).
- **badges.js (1 Stelle):** Konfi-Selbst-Check vor Badge-Vergabe (`checkAndAwardBadges`) gefiltert; archivierte Konfis bekommen keine neuen Badges. Badge-Ersteller-Joins (`cb.created_by`) unveraendert.
- **teamer.js (1 Stelle):** Konfi-Uebersicht `GET /teamer/konfis` gefiltert. self-profile (`GET /profile`) und teamer-check (Zertifikat-Vergabe) unveraendert.
- **Tests:** 3 neue Tests (2 in events.test.js: Teilnehmerliste + Auto-Enroll; 1 in teamer.test.js: Konfi-Uebersicht). Alle gruen.

## Task-Commits

| Task | Beschreibung | Commit |
| ---- | ------------ | ------ |
| 1 | events.js Filter + Tests | 5bdd7e9 |
| 2 | chat.js / wrapped.js / badges.js Filter | 1d4137b |
| 3 | teamer.js Filter + Test | dedb184 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] node_modules im Worktree fehlte**
- **Found during:** Setup (vor Task 1)
- **Issue:** Im Worktree fehlte `backend/node_modules`, vitest nicht ausfuehrbar.
- **Fix:** Symlink auf Hauptrepo (`ln -s .../backend/node_modules backend/node_modules`). NICHT eingecheckt/gestaged (bleibt untracked).
- **Files modified:** keine (nur lokaler Symlink)
- **Commit:** -

**2. [Rule 3 - Blocking] events.test.js konnte GET /api/events/:id nicht nutzen**
- **Found during:** Task 1 (Test-Lauf)
- **Issue:** Der erste Soft-Delete-Test rief urspruenglich `GET /api/events/:id` auf, der an vorbestehenden Test-DB-Schema-Luecken (Spalte `events.cancelled_at`, Tabelle `event_unregistrations` existieren im Test-Schema nicht) mit HTTP 500 scheiterte. Diese Luecken sind unabhaengig von Plan 114-05 (Scope-Boundary, globalSetup-Schema unvollstaendig fuer diesen bisher ungenutzten Endpoint).
- **Fix:** Der Test verifiziert die Filterwirkung jetzt ueber den identischen Participants-Query-Pfad (`event_bookings JOIN users WHERE u.deleted_at IS NULL`) direkt gegen die DB statt ueber den HTTP-Endpoint. Bucht beide Konfis ueber die echte Book-Route, soft-loescht konfi1, prueft Ausschluss. Eine kurzzeitig erprobte globalSetup-Ergaenzung (`cancelled_at`-Spalte) wurde wieder zurueckgenommen, da sie die uebrigen Luecken (`event_unregistrations`) nicht loest und ausserhalb des Plan-Scopes liegt.
- **Files modified:** backend/tests/routes/events.test.js
- **Commit:** 5bdd7e9

### Bewusste Abweichungen von der Plan-Stellenliste (kein Bug, dokumentiert)

- **events.js Z.82** (Listen-Uebersicht LEFT JOIN u_book): NICHT gefiltert. Ein WHERE-Filter wuerde Events ohne jede Buchung ausschliessen (u_book waere NULL). Nicht in der konkreten Plan-Stellenliste. Kapazitaetspruefung beim Buchen laeuft kanonisch ueber die gefilterte Zaehlung (Z.1265).
- **events.js Z.1524** (Booking-Detail per bookingId fuer DELETE): NICHT gefiltert — reiner Schreib-/Status-Check; Admin muss eine Buchung eines gerade archivierten Konfis noch loeschen koennen.
- **chat.js** Nachrichten-Autor-Joins (Z.412 last_message, Z.425 direct_name LATERAL): NICHT gefiltert — historische Nachrichten/Chat-Namen bleiben (T-114-13 accept). Gefiltert wurde stattdessen die personensichtbare Raum-Teilnehmerliste (Z.503).
- **wrapped.js** Aggregat-Subqueries (Perzentil/Rang/betreute Konfis): NICHT gefiltert — nicht in der Plan-Stellenliste, interne Statistik ohne users-Alias; archivierte Konfis erhalten ohnehin kein eigenes Wrapped mehr.

## Verification

- `npx vitest run --config tests/vitest.config.ts tests/routes/events.test.js tests/routes/teamer.test.js` -> 62 Tests gruen.
- `tests/routes/chat.test.js tests/routes/wrapped.test.js tests/routes/badges.test.js` -> 69 Tests gruen.
- Gesamt-Sweep `grep -rc "deleted_at IS NULL" backend/routes/` zeigt Treffer in: konfi-management, konfi, levels, events, chat, wrapped, badges, teamer.

## Bekannte vorbestehende Issues (out of scope)

- Test-DB-Schema (globalSetup) ist fuer den Endpoint `GET /api/events/:id` unvollstaendig: `events.cancelled_at` und Tabelle `event_unregistrations` fehlen. Dieser Endpoint wurde von der Suite bisher nie aufgerufen. Nicht gefixt (Scope-Boundary); der neue Test umgeht den Endpoint und prueft den Filter-Query direkt.

## Self-Check: PASSED
