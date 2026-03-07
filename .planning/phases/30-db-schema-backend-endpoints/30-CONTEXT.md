# Phase 30: DB-Schema + Backend-Endpoints - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Datengrundlage schaffen fuer Punkte-Typ-Konfiguration und Dashboard-Widget-Steuerung. Jahrgang-Tabelle um Punkte-Typ-Toggles und Zielwerte erweitern, Settings um Dashboard-Widget-Keys, Endpoints liefern Config an Frontend. Altes Punkte-UI aus Settings entfernen.

</domain>

<decisions>
## Implementation Decisions

### Punkte-Konfiguration pro Jahrgang
- Zwei neue Boolean-Spalten auf `jahrgaenge`: `gottesdienst_enabled` (DEFAULT true), `gemeinde_enabled` (DEFAULT true)
- Zwei neue Integer-Spalten auf `jahrgaenge`: `target_gottesdienst` (DEFAULT 10), `target_gemeinde` (DEFAULT 10)
- Punkteziele werden von org-weitem Settings komplett auf pro-Jahrgang verschoben
- Bestehende org-weite `target_gottesdienst`/`target_gemeinde` aus Settings-Tabelle und Settings-UI entfernen
- Bei Erstellung eines neuen Jahrgangs: beide Typen aktiviert, Zielwerte jeweils 10

### Jahrgang-Edit-Modal
- Punkte-Typ-Toggles und Zielwerte direkt im bestehenden Jahrgang-Edit-Modal (AdminJahrgaengeePage.tsx)
- Unter Name + Konfirmationsdatum platzieren
- Zwei IonToggle-Reihen (Gottesdienst aktiviert, Gemeinde aktiviert) + zwei Zielwert-Inputs

### Settings-Migration
- `target_gottesdienst` und `target_gemeinde` aus PUT /settings Endpoint entfernen
- Settings-Frontend: Punkte-Ziel-Felder entfernen
- Bestehende Org-Werte bei Migration in alle Jahrgaenge der Org uebertragen (einmalig)

### Dashboard-Widget-Keys
- 5 neue Keys in `settings`-Tabelle: `dashboard_show_konfirmation`, `dashboard_show_events`, `dashboard_show_losung`, `dashboard_show_badges`, `dashboard_show_ranking`
- Default bei fehlenden Keys: `true` (alles sichtbar)
- UPSERT-Pattern wie bestehende Settings-Keys
- Dashboard-Endpoint liefert `point_config` und `dashboard_config` an Frontend

### Claude's Discretion
- Exakte Platzierung der Toggle-Reihen im Modal-Layout
- Validierungslogik fuer Zielwerte (min 0)
- Migration-Script fuer bestehende Organisationen
- Dashboard-Config-API Responseformat

</decisions>

<specifics>
## Specific Ideas

- Jahrgang-Modal ist der zentrale Ort fuer alle Punkte-Konfiguration pro Jahrgang
- Settings-Modal behaelt nur: konfi_chat_permissions, waitlist_enabled, max_waitlist_size + neue Dashboard-Widget-Toggles
- Default-Zielwerte sind 10 (nicht 0) -- damit neue Jahrgaenge sofort sinnvolle Werte haben

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `jahrgaenge.js`: GET/POST/PUT/DELETE Endpoints mit organization_id Filterung, Validierung mit express-validator
- `settings.js`: UPSERT-Pattern fuer Key-Value Settings mit organization_id, GET liefert alle Keys als Object
- `AdminJahrgaengeePage.tsx`: Jahrgang-Edit-Modal mit Name + Konfirmationsdatum (existiert, muss erweitert werden)
- `DashboardView.tsx`: 5 klar abgegrenzte Sektionen (Konfirmation L745, Events L803, Tageslosung L915, Badges L962, Ranking L1236)

### Established Patterns
- Settings UPSERT: `INSERT ... ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`
- Idempotente Migration: `ensureOrgColumn()` Pattern in settings.js -- kann fuer Jahrgang-Spalten adaptiert werden
- Settings GET parst Werte typspezifisch (parseInt fuer Zahlen, Boolean-Check fuer Flags)

### Integration Points
- `konfi.js` Dashboard-Endpoint: Muss `point_config` (aus jahrgaenge) und `dashboard_config` (aus settings) mitliefern
- `jahrgaenge.js` PUT: Muss neue Spalten akzeptieren und validieren
- `jahrgaenge.js` POST: Muss Defaults setzen (beide enabled, target jeweils 10)
- Settings PUT: `target_gottesdienst`/`target_gemeinde` Handling entfernen

</code_context>

<deferred>
## Deferred Ideas

- AdminGoals pro Jahrgang als eigene Seite (aktuell nicht noetig, Modal reicht)
- Bestehende Settings als readonly Uebersicht (entschieden: komplett entfernen)

</deferred>

---

*Phase: 30-db-schema-backend-endpoints*
*Context gathered: 2026-03-07*
