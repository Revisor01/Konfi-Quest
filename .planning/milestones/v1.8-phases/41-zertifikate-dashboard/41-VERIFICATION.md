---
phase: 41-zertifikate-dashboard
verified: 2026-03-11T15:30:00Z
status: human_needed
score: 7/7 must-haves verified
re_verification:
  previous_status: gaps_found
  previous_score: 5/7
  gaps_closed:
    - "Config-Key-Mismatch: Backend liefert jetzt show_* statt teamer_dashboard_show_* (forEach mit .replace())"
    - "Event-Feld-Mismatch: SQL gibt e.name AS title zurueck, Frontend liest event.title korrekt"
  gaps_remaining: []
  regressions: []
human_verification:
  - test: "Als Teamer einloggen, Dashboard aufrufen. Dann als Admin einen Teamer-Dashboard-Toggle deaktivieren und Dashboard neu laden."
    expected: "Korrekte visuelle Darstellung; die deaktivierte Sektion verschwindet im Dashboard."
    why_human: "Visuelles Layout und Live-Config-Toggle-Wirkung nicht per Grep pruefbar"
  - test: "Auf eine Zertifikat-Karte klicken"
    expected: "Popover mit Name, Ausstellungsdatum, Ablaufdatum, Status-Label"
    why_human: "Interaktionsverhalten nicht statisch pruefbar"
  - test: "Admin: Teamer-Detail oeffnen, Zertifikat zuweisen"
    expected: "Alert mit Typ-Select, Datum-Inputs; Speichern aktualisiert die Liste"
    why_human: "Alert-Flow und Datum-Picker-Verhalten nicht statisch pruefbar"
---

# Phase 41: Zertifikate + Dashboard Verification Report

**Phase Goal:** Teamer sieht ein vollstaendiges Dashboard mit Zertifikaten, naechsten Events und Badges
**Verified:** 2026-03-11T15:30:00Z
**Status:** human_needed (alle automatisierten Pruefungen bestanden)
**Re-verification:** Ja - nach Gap-Closure Plan 41-03 (Commit `82f040e`)

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidenz |
|---|-------|--------|---------|
| 1 | Zertifikat-Typen koennen erstellt, bearbeitet und geloescht werden | VERIFIED | teamer.js: GET/POST/PUT/DELETE /teamer/certificate-types, alle mit DB-Queries gegen certificate_types |
| 2 | Zertifikate koennen einem Teamer zugewiesen werden mit Ausstellungsdatum und optionalem Ablaufdatum | VERIFIED | teamer.js: POST /:userId/certificates prueft User/Typ, INSERT in user_certificates; KonfiDetailView.tsx Z.480/507 |
| 3 | Teamer-Dashboard-Endpoint liefert Begruessing, Zertifikate, Events, Badges und Dashboard-Config | VERIFIED | teamer.js Z.382-489: vollstaendiger GET /teamer/dashboard mit korrektem JSON-Shape fuer alle 5 Sektionen |
| 4 | Dashboard-Config-Keys stimmen mit Frontend-Interface ueberein | VERIFIED | teamer.js Z.473-482: Defaults als show_*, forEach mit .replace('teamer_dashboard_show_', 'show_') behebt Gap 1 |
| 5 | Teamer sieht tageszeitabhaengige Begruessing im Dashboard | VERIFIED | TeamerDashboardPage.tsx: getGreeting() mit 5 Zeitbereichen + 20% Moin-Variante; app-header-banner--teamer |
| 6 | Teamer sieht Zertifikat-Typen als horizontale Karten; Config-Toggle deaktiviert die Sektion | VERIFIED | Scroll-Karten mit 3 Zustaenden; config?.show_zertifikate prueft jetzt gueltigen Key; Gap 1 geschlossen |
| 7 | Teamer sieht naechste 3 Events mit korrektem Titel | VERIFIED | teamer.js Z.422: e.name AS title; DashboardEvent.title; Render Z.417: {event.title}; Gap 2 geschlossen |

**Score:** 7/7 Truths verifiziert

### Required Artifacts

| Artifact | Erwartet | Status | Details |
|----------|----------|--------|---------|
| `backend/routes/teamer.js` | Teamer-Dashboard + Zertifikat-Endpoints | VERIFIED | 492 Zeilen, alle Endpoints, DB-Migration idempotent, Config-Mapping korrekt |
| `backend/routes/settings.js` | Teamer-Dashboard-Config-Flags | VERIFIED | teamer_dashboard_show_* in Validierung, GET und PUT |
| `backend/routes/konfi-managment.js` | Zertifikat-Zuweisung im Admin-Konfi-Detail | VERIFIED | Zertifikate-Query bei role_name='teamer', im Response inkludiert |
| `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx` | Vollstaendiges Teamer-Dashboard mit 5 Sektionen | VERIFIED | DashboardConfig Interface show_* stimmt mit API-Keys ueberein; event.title stimmt mit AS title-Alias ueberein |
| `frontend/src/components/admin/pages/AdminSettingsPage.tsx` | Zertifikat-Typen-CRUD + Teamer-Dashboard-Toggles | VERIFIED | Zertifikat-CRUD mit IonItemSliding, Segment-Toggle Konfi/Teamer, alle 4 Teamer-Toggles |
| `frontend/src/components/admin/views/KonfiDetailView.tsx` | Zertifikat-Zuweisung im Teamer-Detail | VERIFIED | api.post/delete zu /teamer/:id/certificates Z.480/507, loadKonfiData() nach Aktion |

### Key Link Verification

| Von | Zu | Via | Status | Details |
|-----|-----|-----|--------|---------|
| TeamerDashboardPage.tsx | /api/teamer/dashboard | api.get Z.211 | WIRED | Ergebnis direkt als DashboardData gesetzt; alle 5 Felder genutzt |
| TeamerDashboardPage config | Backend config-Keys | forEach .replace() in teamer.js Z.481 | WIRED | show_* Keys stimmen mit DashboardConfig Interface ueberein |
| TeamerDashboardPage events | event.title | e.name AS title SQL Z.422 | WIRED | SQL-Alias und Frontend-Interface uebereinstimmend |
| AdminSettingsPage.tsx | /api/teamer/certificate-types | api.get/post/put/delete | WIRED | loadCertificateTypes(), handleCreate/Edit/Delete |
| AdminSettingsPage.tsx | /api/settings | api.get/put | WIRED | loadSettings(), handleTeamerDashboardToggle |
| KonfiDetailView.tsx | /api/teamer/:userId/certificates | api.post/delete Z.480/507 | WIRED | loadKonfiData() nach jeder Aktion |
| backend/routes/teamer.js | certificate_types + user_certificates | SQL queries | WIRED | SELECT, INSERT, UPDATE, DELETE gegen beide Tabellen |
| backend/routes/settings.js | settings Tabelle | teamer_dashboard_show_* keys | WIRED | GET liest als Boolean, PUT speichert via UPSERT |

### Requirements Coverage

| Requirement | Quell-Plan | Beschreibung | Status | Evidenz |
|-------------|-----------|--------------|--------|---------|
| ZRT-01 | 41-01, 41-02 | Admin kann Teamer Zertifikate zuweisen (JuLeiCa, Teamer-Card, etc.) mit Datum | SATISFIED | POST /teamer/:userId/certificates; KonfiDetailView Z.480 |
| ZRT-02 | 41-02 | Zertifikate werden im Dashboard prominent angezeigt | SATISFIED | Horizontale Karten mit 3 Zustaenden, Popover-Details, Config-Toggle funktioniert |
| ZRT-03 | 41-01, 41-02 | Zertifikat-Typen sind frei konfigurierbar durch Admin | SATISFIED | GET/POST/PUT/DELETE /teamer/certificate-types; AdminSettingsPage CRUD |
| DSH-01 | 41-01, 41-02 | Teamer sieht tageszeitabhaengige Begruessing im Dashboard | SATISFIED | getGreeting() mit 5 Zeitbereichen + 20% Moin-Variante |
| DSH-02 | 41-01, 41-02 | Teamer sieht Zertifikat-Anzeige prominent im Dashboard | SATISFIED | Zertifikate-Sektion mit horizontalen Karten, status-abhaengige Farben, Toggle funktioniert |
| DSH-03 | 41-01, 41-02 | Teamer sieht naechste anstehende Events im Dashboard | SATISFIED | e.name AS title behebt Gap 2; Events-Sektion korrekt gefiltert, Limit 3 |
| DSH-04 | 41-01, 41-02 | Teamer sieht eigene Badges-Sektion im Dashboard | SATISFIED | Badges-Sektion mit recent-Badges, earned_count / total_count |

### Anti-Patterns Found

Keine Blocker-Anti-Patterns in den geaenderten Dateien gefunden. Die beiden zuvor gemeldeten Blocker (Config-Key-Mismatch, Event-Feld-Mismatch) sind durch Commit `82f040e` behoben.

### Human Verification Required

Alle automatisierten Pruefungen sind bestanden. Folgende Punkte koennen nicht programmatisch verifiziert werden:

#### 1. Visuelles Dashboard-Layout und Config-Toggle-Wirkung

**Test:** Als Teamer einloggen, Dashboard aufrufen. Dann als Admin einen Teamer-Dashboard-Toggle deaktivieren und Dashboard neu laden.
**Erwartet:** Korrekte visuelle Darstellung; die deaktivierte Sektion verschwindet aus dem Dashboard.
**Warum menschlich:** Visuelles Layout und Live-Config-Wirkung nicht per Grep pruefbar.

#### 2. Zertifikat-Popover-Details

**Test:** Auf eine Zertifikat-Karte klicken.
**Erwartet:** Popover mit Name, Ausstellungsdatum, Ablaufdatum, Status-Label.
**Warum menschlich:** Interaktionsverhalten nicht statisch pruefbar.

#### 3. Admin Zertifikat-Zuweisung im Teamer-Detail

**Test:** Teamer-Detail oeffnen, "Zertifikat zuweisen" nutzen.
**Erwartet:** Alert mit Typ-Select, Datum-Inputs; Speichern aktualisiert die Liste.
**Warum menschlich:** Alert-Flow und Datum-Picker-Verhalten nicht statisch pruefbar.

### Gap-Closure Bestaetigung

**Gap 1 - Config-Key-Mismatch: GESCHLOSSEN**

- `backend/routes/teamer.js` Z.473-478: Default-Config-Objekt hat bereits die Frontend-Keys (`show_zertifikate`, `show_events`, `show_badges`, `show_losung`).
- Z.480-482: `configRows.forEach` mappt DB-Rows via `.replace('teamer_dashboard_show_', 'show_')` auf dieselben Keys.
- Frontend `DashboardConfig` Interface stimmt exakt ueberein.
- Config-Guards im Template (`config?.show_zertifikate !== false` etc.) greifen korrekt.

**Gap 2 - Event-Feld-Mismatch: GESCHLOSSEN**

- `backend/routes/teamer.js` Z.422: SQL selektiert `e.name AS title`.
- Frontend `DashboardEvent` Interface: `title: string`.
- Render-Code Z.417: `{event.title}` liest den korrekten Alias.

**Commit:** `82f040e` - fix(41-03): Config-Key-Mismatch und Event-Feld-Mismatch im Teamer-Dashboard

---

_Verified: 2026-03-11T15:30:00Z_
_Verifier: Claude (gsd-verifier)_
