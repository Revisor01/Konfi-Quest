---
phase: 40-badges-aktivitaeten
verified: 2026-03-10T23:00:00Z
status: gaps_found
score: 11/13 must-haves verified
re_verification: false
gaps:
  - truth: "Admin kann einem Teamer eine Teamer-Aktivitaet zuweisen"
    status: partial
    reason: "KonfiDetailView öffnet ActivityModal ohne target_role Filter — bei Teamer-Ansicht erscheinen auch Konfi-Aktivitaeten in der Auswahl. Die Backend-Filterung existiert, aber das Frontend (ActivityModal) ruft /admin/activities ohne ?target_role auf. KonfiDetailView ist de facto nur für Konfis erreichbar (Backend-Query filtert r.name = 'konfi'), es fehlt ein separater Teamer-Detail-View mit korrekter Aktivitaetsliste."
    artifacts:
      - path: "frontend/src/components/admin/modals/ActivityModal.tsx"
        issue: "Ruft /admin/activities ohne target_role Parameter auf (Zeile 89). Alle Aktivitaeten (inkl. Teamer-Aktivitaeten) werden geladen."
      - path: "frontend/src/components/admin/views/KonfiDetailView.tsx"
        issue: "Uebergibt keine role_name/target_role an ActivityModal. Die vorhandenen role_name/user_type Interface-Felder werden nicht genutzt um Aktivitaetsliste zu filtern."
    missing:
      - "ActivityModal muss targetRole Prop akzeptieren und /admin/activities?target_role=${targetRole} aufrufen"
      - "KonfiDetailView muss role_name an ActivityModal uebergeben"
      - "Teamer-seitiger Detail-View ist nicht vorhanden (KonfiDetailView filtert Backend-seitig auf r.name = 'konfi')"
  - truth: "Teamer:innen erscheinen als Filter-Option in der Konfi-Liste"
    status: partial
    reason: "KonfisView laedt Teamer korrekt via /api/konfi-managment/teamer. Teamer-Eintraege haben jedoch keine Detail-Navigation — es gibt keinen Teamer-Admin-Detail-View. Plan 03 sollte KonfiDetailView fuer Teamer anpassen, aber die Backend-Query in GET /:id Route filtert explizit auf r.name = 'konfi' und liefert 404 fuer Teamer. Teamer in der Liste sind nicht anklickbar/navigierbar."
    artifacts:
      - path: "frontend/src/components/admin/KonfisView.tsx"
        issue: "Teamer-Option und Fetch sind korrekt implementiert, aber Teamer-Listeneintraege fehlt onPress-Handler/Navigation zu Detail-View."
      - path: "backend/routes/konfi-managment.js"
        issue: "GET /:id Route (Zeile 455) filtert WHERE r.name = 'konfi' — Teamer-User liefern 404."
    missing:
      - "Teamer-Admin-Detail-View oder Anpassung von KonfiDetailView um Teamer zu unterstuetzen"
      - "Backend GET /:id Route muss auch Teamer liefern koennen (oder separater Teamer-Detail-Endpoint)"
human_verification:
  - test: "Teamer-Badge-Vergabe nach Aktivitaetszuweisung"
    expected: "Nach Zuweisung einer Teamer-Aktivitaet an einen Teamer erscheinen verdiente Badges im Teamer-Profil"
    why_human: "End-to-end Flow ueber echten DB-State mit checkAndAwardBadges nicht automatisch pruefbar"
  - test: "Segment-Toggle in Admin Badge-Management"
    expected: "Toggle zwischen Konfis/Teamer:innen zeigt unterschiedliche Badge-Listen, Punkte-Kriterien bei Teamer ausgeblendet"
    why_human: "UI-Interaktion nicht automatisch pruefbar"
  - test: "TeamerBadgesView im Teamer-Profil"
    expected: "Teamer-Profil zeigt eigene Teamer-Badges getrennt von eingefrorenen Konfi-Badges"
    why_human: "Visuelle Darstellung und Trennung nicht automatisch pruefbar"
---

# Phase 40: Teamer-Badges und Teamer-Aktivitaeten Verification Report

**Phase Goal:** Teamer-Badges und Teamer-Aktivitaeten System implementieren mit rollenbasierter Trennung
**Verified:** 2026-03-10T23:00:00Z
**Status:** gaps_found
**Re-verification:** Nein — initiale Verifikation

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Tabellen konfi_badges/konfi_activities umbenannt zu user_badges/user_activities | VERIFIED | Keine alten Tabellennamen in SQL-Queries (grep liefert 0 Treffer), Migration in badges.js runMigrations() idempotent |
| 2 | activities und custom_badges haben target_role Spalte | VERIFIED | badges.js 21 Treffer, activities.js 11 Treffer; Migration fuegt ADD COLUMN IF NOT EXISTS hinzu |
| 3 | UNIQUE Constraint auf user_activities entfernt | VERIFIED | badges.js Zeile 685-692: Information-Schema-Abfrage und DROP CONSTRAINT IF EXISTS |
| 4 | Alle Backend-Routes verwenden neue Tabellennamen | VERIFIED | grep nach konfi_badges/konfi_activities in routes/ liefert 0 SQL-Treffer |
| 5 | activities GET unterstuetzt target_role Filter | VERIFIED | activities.js Zeilen 56-61: Query-Parameter wird ausgewertet und WHERE-Klausel angehaengt |
| 6 | Teamer-Aktivitaeten ohne Punkte-Pflicht | VERIFIED | activities.js Zeile 482-499: isTeamerActivity-Guard verhindert Punkte-Update bei Teamer |
| 7 | checkAndAwardBadges funktioniert fuer Teamer mit 5 Kriterien-Typen | VERIFIED | badges.js: checkAndAwardTeamerBadges Funktion ab Zeile 303, alle 5 Kriterien-Typen (activity_count, event_count, streak, activity_combination, teamer_year) implementiert |
| 8 | Punkte-basierte Kriterien werden fuer Teamer uebersprungen | VERIFIED | badges.js Teamer-Branch laedt nur target_role='teamer' Badges, Punkte-Kriterien werden nicht gefuehrt |
| 9 | teamer_year Kriterium zaehlt aktive Teamer-Jahre | VERIFIED | badges.js Zeilen 86-88 (CRITERIA_TYPES), Zeilen 392-449 (Implementierung mit Fallback-Kette) |
| 10 | Teamer-Badge-Daten sind ueber teamer.js API abrufbar | VERIFIED | teamer.js: GET /badges (Zeile 61), GET /badges/unseen (Zeile 86), PUT /badges/mark-seen (Zeile 104) |
| 11 | Admin kann zwischen Konfi- und Teamer-Badges umschalten | VERIFIED | AdminBadgesPage.tsx: target_role State + /admin/badges?target_role=${targetRole}; BadgeManagementModal.tsx: Punkte-Kriterien bei Teamer ausgeblendet |
| 12 | Admin kann einem Teamer eine Teamer-Aktivitaet zuweisen | FAILED | ActivityModal ruft /admin/activities ohne target_role-Filter auf. KonfiDetailView-Backend liefert 404 fuer Teamer-User (WHERE r.name = 'konfi'). |
| 13 | Teamer:innen erscheinen als Filter-Option in der Konfi-Liste | PARTIAL | KonfisView hat Teamer-Option und Fetch via /konfi-managment/teamer, aber Teamer-Eintraege sind nicht zu einem Detail-View navigierbar (kein funktionierender Detail-View fuer Teamer als Admin). |

**Score:** 11/13 Truths verified (2 failed/partial)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/routes/badges.js` | Migration + checkAndAwardBadges Teamer-Branch + teamer_year | VERIFIED | 885 Zeilen, runMigrations ab Zeile 630, checkAndAwardTeamerBadges ab Zeile 303, teamer_year ab Zeile 86 |
| `backend/routes/activities.js` | target_role Filter und optionale Punkte fuer Teamer | VERIFIED | 11 target_role Treffer; isTeamerActivity-Guard vorhanden |
| `backend/routes/konfi-managment.js` | user_activities/user_badges Tabellennamen, Teamer-Aktivitaeten ohne Punkte | VERIFIED | Beide Tabellennamen korrekt; Teamer-Aktivitaets-Guard in Zeile 719 |
| `backend/routes/konfi.js` | user_badges/user_activities mit user_id | VERIFIED | Alte Tabellennamen nicht mehr vorhanden |
| `backend/routes/teamer.js` | Badge-Endpunkte GET/unseen/mark-seen | VERIFIED | Alle 3 Endpoints bestaetig |
| `frontend/src/components/admin/BadgesView.tsx` | Segment-Toggle | PARTIAL | BadgesView.tsx enthaelt teamer_year Text aber kein Segment-Toggle. Segment-Toggle ist in AdminBadgesPage.tsx (SUMMARY korrigiert: Implementation in AdminBadgesPage, nicht BadgesView) |
| `frontend/src/components/admin/modals/BadgeManagementModal.tsx` | target_role Auswahl, Punkte-Kriterien ausblenden | VERIFIED | Zeilen 262, 968-970: target_role Feld vorhanden, Punkte-Kriterien gefiltert |
| `frontend/src/components/admin/pages/AdminSettingsPage.tsx` | Aktivitaeten Segment-Toggle | UNCERTAIN | Plan 03 nutzte AdminActivitiesPage.tsx statt AdminSettingsPage.tsx (anderer Dateiname). AdminActivitiesPage.tsx bestaetigt mit target_role (Zeile 93). |
| `frontend/src/components/admin/KonfisView.tsx` | Teamer:innen als Filter-Option | VERIFIED | Teamer-Dropdown, Fetch-Logik und Listenrendering vorhanden |
| `frontend/src/components/admin/views/KonfiDetailView.tsx` | Teamer-Aktivitaeten bei Teamer-Usern | FAILED | Interface hat role_name/user_type Felder, aber ActivityModal wird ohne target_role aufgerufen. Backend GET /:id liefert 404 fuer Teamer. |
| `frontend/src/components/teamer/views/TeamerBadgesView.tsx` | Teamer-Badge-Grid mit earned/unearned | VERIFIED | 585 Zeilen, API-Fetch auf /teamer/badges (Zeile 226), mark-seen Aufruf vorhanden |
| `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` | TeamerBadgesView Integration | VERIFIED | Import Zeile 26, Render Zeile 223 |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| backend/routes/activities.js | activities Tabelle | target_role Spalte | WIRED | Zeile 56-61: Query-Parameter target_role wird in WHERE-Klausel umgesetzt |
| backend/routes/badges.js | user_badges Tabelle | SQL Queries | WIRED | Vielfache INSERT/SELECT auf user_badges in checkAndAwardBadges |
| backend/routes/badges.js | checkAndAwardTeamerBadges | Teamer-Branch (target_role=teamer) | WIRED | Zeile 113: return await checkAndAwardTeamerBadges(...) wenn User Teamer ist |
| backend/routes/activities.js assign-activity | checkAndAwardBadges | Aufruf nach Aktivitaetszuweisung | WIRED | Zeile 510: badgeResult = await checkAndAwardBadges(db, konfiId) — gilt auch fuer Teamer-User |
| frontend/src/components/admin/BadgesView.tsx | /api/badges?target_role | fetch mit target_role | NOT_WIRED in this file | Segment-Toggle ist in AdminBadgesPage.tsx, nicht BadgesView.tsx |
| frontend/src/components/admin/pages/AdminBadgesPage.tsx | /api/badges?target_role=teamer | fetch mit target_role Query-Parameter | WIRED | Zeile 103: api.get('/admin/badges?target_role=${targetRole}') |
| frontend/src/components/admin/pages/AdminActivitiesPage.tsx | /api/activities?target_role=teamer | fetch mit target_role | WIRED | Zeile 93: api.get('/admin/activities?target_role=${targetRole}') |
| frontend/src/components/teamer/views/TeamerBadgesView.tsx | /api/teamer/badges | fetch | WIRED | Zeile 226: api.get('/teamer/badges') |
| frontend/src/components/teamer/pages/TeamerProfilePage.tsx | TeamerBadgesView | import und render | WIRED | Import Zeile 26, JSX-Render Zeile 223 |
| frontend/src/components/admin/modals/ActivityModal.tsx | /admin/activities | fetch | PARTIAL | Zeile 89: api.get('/admin/activities') — kein target_role Parameter, alle Aktivitaeten werden geladen |

---

### Requirements Coverage

| Requirement | Source Plan | Beschreibung | Status | Evidence |
|-------------|------------|--------------|--------|----------|
| BDG-01 | 40-01, 40-03 | Admin kann Teamer-spezifische Aktivitaeten erstellen und manuell vergeben | PARTIAL | Erstellen: VERIFIED (activities.js POST mit target_role). Manuell vergeben via Admin-Detail: FAILED (ActivityModal filtert nicht, kein Teamer-Detail-View). Ueber AdminSettingsPage/Aktivitaeten-Verwaltung Teamer-Aktivitaeten existieren im Backend. |
| BDG-02 | 40-02 | Teamer-Badges vom Typ Aktivitaeten-Anzahl | VERIFIED | checkAndAwardTeamerBadges: activity_count case mit user_activities JOIN activities WHERE target_role='teamer' |
| BDG-03 | 40-02 | Teamer-Badges vom Typ Event-Teilnahme | VERIFIED | checkAndAwardTeamerBadges: event_count case mit event_bookings attendance_status='present' |
| BDG-04 | 40-02 | Teamer-Badges vom Typ Streak | VERIFIED | checkAndAwardTeamerBadges: streak case, Logik identisch zu Konfis aber mit user_activities |
| BDG-05 | 40-02 | Teamer-Badges vom Typ Sammel-Badge (alle Badges einer Gruppe) | VERIFIED | checkAndAwardTeamerBadges: activity_combination case mit required_activities UND required_events |
| BDG-06 | 40-02 | Teamer-Badges vom Typ Jahres-Badge (aktiv im X. Teamer-Jahr) | VERIFIED | checkAndAwardTeamerBadges: teamer_year case (Zeilen 392-449) mit Fallback-Kette |
| BDG-07 | 40-01, 40-03 | Admin kann Teamer-Badge-Typen und Kriterien frei konfigurieren | VERIFIED | AdminBadgesPage.tsx: Segment-Toggle; BadgeManagementModal: target_role + teamer_year Kriterium; Punkte-Kriterien bei Teamer ausgeblendet |

---

### Anti-Patterns

| Datei | Zeile | Pattern | Schwere | Auswirkung |
|-------|-------|---------|---------|------------|
| frontend/src/components/teamer/views/TeamerBadgesView.tsx | 118, 347 | `return null` | Info | Korrekte Null-Guards fuer Badge-Daten, kein Stub |
| frontend/src/components/admin/modals/ActivityModal.tsx | 89 | `/admin/activities` ohne target_role | Warnung | Teamer-Aktivitaeten und Konfi-Aktivitaeten werden gemischt angezeigt — funktional problematisch fuer Teamer-Zuweisung |

Keine kritischen Anti-Patterns (Stubs, Platzhalter, leere Implementierungen) gefunden.

---

### Human Verification Required

#### 1. Teamer-Badge-Vergabe End-to-End

**Test:** Einem Teamer eine Teamer-Aktivitaet zuweisen und dann Teamer-Profil aufrufen
**Expected:** Passende Badges erscheinen im TeamerBadgesView des Teamer-Profils, Push-Notification wird gesendet
**Why human:** End-to-end Flow ueber echten DB-State und checkAndAwardBadges nicht automatisch pruefbar

#### 2. Admin Segment-Toggle Badge-Verwaltung

**Test:** In Admin-Badge-Verwaltung zwischen Konfis und Teamer:innen umschalten
**Expected:** Unterschiedliche Badge-Listen, beim Teamer-Tab: Punkte-basierte Kriterien im Erstellungsmodal ausgeblendet, teamer_year sichtbar
**Why human:** UI-Interaktion nicht automatisch pruefbar

#### 3. Teamer-Filter in Konfi-Liste

**Test:** In Admin Konfi-Liste "Teamer:innen" im Jahrgang-Dropdown auswaehlen
**Expected:** Teamer-Liste mit lila Akzent erscheint; Eintraege sind sichtbar (kein Detail-Navigation erwartet, da dies ein bekannter Gap ist)
**Why human:** Visuelle Darstellung und Farbgebung nicht automatisch pruefbar

---

### Gaps Summary

Zwei Luecken blockieren den vollstaendigen Zielzustand:

**1. Teamer-Aktivitaetszuweisung durch Admin nicht korrekt implementiert (BDG-01 partial)**

Die Backend-Infrastruktur ist vorhanden (target_role in activities, Teamer-Guard in assign-activity), aber das Frontend hat eine Luecke:
- `ActivityModal.tsx` ruft `/admin/activities` ohne `?target_role` auf — Teamer-Aktivitaeten und Konfi-Aktivitaeten werden gemischt
- `KonfiDetailView.tsx` leitet `role_name` nicht an `ActivityModal` weiter
- Die Backend-Route `GET /:id` in `konfi-managment.js` filtert auf `r.name = 'konfi'` — ein Admin kann keinen Teamer ueber die Konfi-Detail-Ansicht verwalten

Diese Luecken haben denselben Root Cause: Es gibt keinen Admin-seitigen Detail-View fuer Teamer-User. Die Teamer:innen erscheinen zwar in der Liste (KonfisView) aber sind nicht anklickbar/navigierbar zu einem Detail-View.

**2. KonfisView Teamer-Eintraege ohne navigierbaren Detail-View**

Teamer erscheinen korrekt in der Konfi-Liste als separate Gruppe, aber der Klick auf einen Teamer-Eintrag fuehrt ins Leere (KonfiDetailView liefert 404 fuer Teamer, da das Backend explizit auf Konfi-Rolle filtert).

**Gemeinsamer Fix:** Ein minimaler Admin-Teamer-Detail-View (oder Erweiterung von KonfiDetailView fuer Teamer-User mit angepasster Backend-Query und ActivityModal target_role Prop) wuerde beide Gaps schliessen.

---

### Commit-Verifikation

Alle 7 in den Summaries dokumentierten Commit-Hashes sind im Git-Log verifiziert:
- `d85bf10` feat(40-01): DB-Migration
- `1a8d8ce` feat(40-01): Route-Migration
- `3a863c6` feat(40-02): Teamer-Branch
- `b0d14f8` feat(40-02): Teamer-Badge-API
- `48244ee` feat(40-03): Admin Badge-Toggle
- `5982827` feat(40-03): Admin Aktivitaeten-Toggle
- `ae5669a` feat(40-03): TeamerBadgesView

---

_Verified: 2026-03-10T23:00:00Z_
_Verifier: Claude (gsd-verifier)_
