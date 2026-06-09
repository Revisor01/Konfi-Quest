# Phase 117 — Konfirmations-Event-Flag — CONTEXT

**Milestone:** v2.12 Konfirmation + Konfispruch
**Liefert:** KONF-01..08 (siehe REQUIREMENTS.md)

## Ziel

Ein echtes Boolean-Flag `is_konfirmation` auf Events einfuehren, **strikt analog zum bestehenden `mandatory`/Pflicht-Flag**. Damit wird die heute fragile String-basierte Kategorie-Erkennung (`category_names` includes 'konfirmation') durch ein robustes Flag ersetzt. Die waehlbare/anlegbare Kategorie "Konfirmation" wird entfernt, damit niemand sie versehentlich setzt.

## Locked Decisions (vom User bestaetigt)

1. **Echtes Flag, keine Kategorie-Kruecke.** Neue Spalte `events.is_konfirmation BOOLEAN DEFAULT false`. Die Konfirmation-Kategorie-Logik fliegt komplett raus.
2. **Strikt analog `mandatory`.** Jede Stelle, an der `mandatory` heute behandelt wird (Validierung, POST, PUT, Anzeige), bekommt das `is_konfirmation`-Pendant nach demselben Muster.
3. **Mehrere Events** koennen das Flag tragen (kein Unique-Constraint).
4. **UI:** Toggle "Konfirmation" direkt neben "Pflicht-Event" im Event-Formular. Konfirmations-Events automatisch **lila** + Hinweis "Konfirmation" als **zweites Corner-Badge** (bestehendes Corner-Badge-System nutzen, nicht neu erfinden).
5. **Bestehende String-Filter umstellen** auf das Flag.
6. **Datenmigration:** Bestehende Events, die bisher per Kategorie "Konfirmation" markiert sind, in der Migration auf `is_konfirmation = true` ueberfuehren, dann die Kategorie-Verknuepfung/Kategorie bereinigen. Kein Datenverlust.

## Faktenbasis (aus Codebase-Exploration, Datei:Zeile)

### mandatory (Referenz-Implementierung)
- DB-Spalte: `init-scripts/01-create-schema.sql:301` — `mandatory BOOLEAN DEFAULT false` in Tabelle `events`
- Backend Validierung POST: `backend/routes/events.js:22-29` (Zeile 26: `body('mandatory').optional().isBoolean()`)
- Backend Validierung PUT: `backend/routes/events.js:31-37` (Zeile 34)
- Backend POST-Logik: `backend/routes/events.js:656-710` (662 extrahiert, 682-685 Guards, 697/707 INSERT, 737-750 Auto-Enrollment)
- Backend PUT-Logik: `backend/routes/events.js:800+`
- Backend QR-Check-in nutzt mandatory: `backend/routes/events.js:270` (SELECT), `:355` (Punkte-Logik)
- Frontend Typ: `frontend/src/components/admin/modals/EventFormSections.tsx:44` (`mandatory: boolean` in EventFormData)
- Frontend Toggle: `frontend/src/components/admin/modals/EventFormSections.tsx:112-121` (Label "Pflicht-Event", IonToggle)

### Konfirmation heute (String-basiert — muss umgestellt werden)
- `frontend/src/components/konfi/views/EventsView.tsx:69-75` (Filter), `:127` (isKonfirmationEvent), `:39`/`:102-106` (Tab 'konfirmation')
- `frontend/src/components/admin/views/EventDetailView.tsx:242` (isKonfirmationEvent), `:248` (Farb-Logik)

### Kategorie-System (Konfirmation-Bezug entfernen)
- `categories` Tabelle: `init-scripts/01-create-schema.sql:148-158`
- `event_categories` Join: `init-scripts/01-create-schema.sql:338-349`
- Kategorie-CRUD Backend: `backend/routes/categories.js:32-132`
- Kategorie-Verwaltung Frontend: `frontend/src/components/admin/pages/AdminCategoriesPage.tsx`
- Kategorie-Auswahl im Event-Formular: `frontend/src/components/admin/modals/EventFormSections.tsx:306-354`
- Event-Kategorie-Speicherung: `backend/routes/events.js:716-719` (POST), `:800+` (PUT)
- Event-Kategorie-Abfrage: `backend/routes/events.js:45-99` (STRING_AGG category_names)

### Event-Anzeige Konfi-Seite
- `frontend/src/components/konfi/views/EventsView.tsx` (Tabs, Farben)
- Corner-Badge-System: siehe MEMORY corner_badge_system.md (shared/StatusBadge, .app-corner-badges)

### Migrationen
- Letzte: `backend/migrations/090_drop_legacy_badges.sql`. Naechste: **091**.
- Migration-Runner trackt by filename in `schema_migrations` (database.js).
- WICHTIG: Test-Helper `backend/tests/helpers/db.js` truncateAll-Liste muss konsistent bleiben (NICHT badges-Falle wiederholen — falls neue Spalte, kein Tabellen-Add noetig).

## Projektregeln (KRITISCH)
- KEINE Emojis (nur IonIcons aus ionicons/icons)
- ECHTE Umlaute (ae/oe/ue/ss verboten in UI-Texten, Strings, Kommentaren)
- useIonModal (NIE `<IonModal isOpen>`)
- RBAC-Struktur (verifyTokenRBAC, requireAdmin etc.)
- Deutsche UI-Texte, gendern (Teamer:innen) — aber "Konfis" ist schon Plural
- Tests bei neuem Code mitschreiben (Backend-Integration gegen echte PostgreSQL)
- Nach Frontend-Aenderungen Xcode-Build noetig (Capacitor)

## Offene Detail-Entscheidungen fuer den Planner
- Migration 091: Datenueberfuehrung — wie bestehende Konfirmation-Kategorie-Events erkennen (per categories.name ILIKE '%konfirmation%' + event_categories Join) und auf Flag setzen, dann Kategorie + Verknuepfungen entfernen. Idempotent + reversibel-sicher.
- Guards: Soll is_konfirmation aehnliche Guards wie mandatory haben (points/max_participants)? Default: NEIN — Konfirmation ist nur eine Markierung/Farbe, keine Buchungslogik-Aenderung. Nur falls sich aus mandatory-Naehe etwas Sinnvolles ergibt, im Plan begruenden.
