# Phase 75: Backend-Aggregation + DB-Schema - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

DB-Schema fuer Wrapped-Snapshots, Konfirmations-Datum, Aggregations-Queries, API-Endpoints, automatische Trigger-Logik, Admin-Override, Endspurt-Erkennung.

</domain>

<decisions>
## Implementation Decisions

### DB-Schema
- **D-01:** Neue Tabelle `wrapped_snapshots`: id, user_id (FK), type (konfi/teamer), year INT, data JSONB, generated_at TIMESTAMP, organization_id (FK)
- **D-02:** Neues Feld `confirmation_date DATE` auf `jahrgaenge` Tabelle (nullable — nicht alle Jahrgaenge haben Konfirmation)
- **D-03:** Neues Feld `wrapped_released_at TIMESTAMP` auf `jahrgaenge` Tabelle (NULL = nicht freigeschaltet)
- **D-04:** UNIQUE Index auf (user_id, type, year) — ein Wrapped pro User pro Typ pro Jahr

### Aggregations-Queries (Konfi)
- **D-05:** Gesamtpunkte: SUM aus konfi_profiles (gottesdienst_points + gemeinde_points)
- **D-06:** Events: COUNT aus event_bookings WHERE status IN ('confirmed', 'attended')
- **D-07:** Badges: COUNT aus konfi_badges, JOIN mit badges fuer Icons
- **D-08:** Chat: COUNT aus chat_messages WHERE user_id = X
- **D-09:** Aktivster Monat: GROUP BY EXTRACT(MONTH FROM completed_date) auf konfi_activities + event_bookings
- **D-10:** Endspurt: Vergleich aktuelle Punkte vs. Zielwert aus jahrgaenge (target_gottesdienst, target_gemeinde)

### Aggregations-Queries (Teamer)
- **D-11:** Events geleitet: COUNT aus event_bookings WHERE user_id = X (als Teamer)
- **D-12:** Konfis betreut: COUNT DISTINCT Konfis in zugewiesenen Jahrgaengen
- **D-13:** Badges: COUNT aus konfi_badges (Teamer-Badges)
- **D-14:** Zertifikate: COUNT aus teamer_certificates
- **D-15:** Jahre aktiv: Berechnung aus teamer_since Feld

### API-Endpoints
- **D-16:** GET /wrapped/:userId — liefert Wrapped-Snapshot (oder 404 wenn nicht generiert)
- **D-17:** POST /wrapped/generate/:jahrgangId — Admin-Trigger: generiert Wrapped fuer alle Konfis des Jahrgangs
- **D-18:** POST /wrapped/generate-teamer — Admin-Trigger: generiert Teamer-Wrapped fuer alle Teamer der Org
- **D-19:** PUT /jahrgaenge/:id — Konfirmationsdatum setzen (erweitert bestehenden Endpoint)

### Trigger-Logik
- **D-20:** Cron-Check: Beim Server-Start und dann taeglich um 00:01 pruefen ob heute der 1. eines Monats ist
- **D-21:** Wenn 1. des Monats: Alle Jahrgaenge pruefen deren confirmation_date im aktuellen Monat liegt → generieren
- **D-22:** Am 1. Dezember: Teamer-Wrapped fuer alle Organisationen generieren
- **D-23:** Admin kann manuell frueher/spaeter ausloesen (POST Endpoints)
- **D-24:** Wrapped wird nur einmal generiert — wenn wrapped_snapshots Eintrag existiert, nicht erneut generieren

### Claude's Discretion
- Genauer Cron-Mechanismus (setInterval im Server vs. node-cron)
- JSONB-Struktur der Snapshot-Daten (genaue Felder)
- Error-Handling bei fehlenden Daten (Konfi mit 0 Aktivitaeten)

</decisions>

<canonical_refs>
## Canonical References

### Research
- `.planning/research/ARCHITECTURE.md` — DB-Schema, Query-Beispiele, Trigger-Mechanismus
- `.planning/research/PITFALLS.md` — Datenschutz, Edge-Cases
- `.planning/research/FEATURES.md` — Slide-Inhalte (bestimmt welche Daten aggregiert werden muessen)

### Bestehende Backend-Patterns
- `backend/routes/badges.js` — Aggregations-Pattern mit Window Functions
- `backend/routes/konfi-managment.js` — Transaktionssichere Multi-Query Patterns
- `backend/routes/jahrgaenge.js` oder `backend/routes/konfi-managment.js` — Jahrgaenge-Verwaltung

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `db.query()` Pattern fuer alle SQL-Queries
- `requireAdmin` / `requireSuperAdmin` Middleware fuer Berechtigungen
- Bestehende setInterval-Pattern fuer Background-Jobs (Token-Cleanup in auth.js)
- express-validator fuer Input-Validierung

### Established Patterns
- Transaktionen mit `client.connect()` / `BEGIN` / `COMMIT`
- JSONB fuer flexible Datenstrukturen (settings KV-Store)
- Idempotente DB-Migrationen (CREATE TABLE IF NOT EXISTS, DO $$ blocks)

</code_context>

<specifics>
## Specific Ideas

No specific requirements.

</specifics>

<deferred>
## Deferred Ideas

- Frontend-Slides (Phase 76)
- Share-Funktion (Phase 78)
- Dashboard-Integration (Phase 79)

</deferred>

---

*Phase: 75-backend-aggregation-db-schema*
*Context gathered: 2026-03-22*
