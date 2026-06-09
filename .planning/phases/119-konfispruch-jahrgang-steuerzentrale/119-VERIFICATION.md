---
phase: 119-konfispruch-jahrgang-steuerzentrale
verified: 2026-06-09T14:00:00Z
status: human_needed
score: 20/20 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Jahrgang-Modal pruefen (konfspruch_enabled-Toggle, Wrapped-Toggle, kein Konfirmationsdatum)"
    expected: "Admin oeffnet Jahrgang-Modal: kein Konfirmationsdatum-Feld sichtbar; Toggle Konfispruch-Auswahl vorhanden; bei bestehendem Jahrgang Toggle 'Wrapped freigeben' vorhanden. Wrapped einschalten -> Warnhinweis erscheint -> bestaetigen -> Erfolg. Liste zeigt Wrapped-Status + Spruch-Freigabe + Punkteziele."
    why_human: "UI-Rendering und Modal-Flow erfordern Xcode-Build auf Geraet/Simulator (kein cap-sync/Xcode automatisierbar auf diesem Mac)"
  - test: "Konfispruch-Card-Gate pruefen"
    expected: "konfspruch_enabled fuer einen Test-Jahrgang AUSschalten -> als Konfi dieses Jahrgangs einloggen -> Dashboard zeigt KEINE Konfispruch-Card. Wieder einschalten -> Card erscheint."
    why_human: "Erfordert Geraet/Simulator mit Xcode-Build und manuellem Login-Wechsel zwischen Rollen"
  - test: "Admin-Einsicht Konfispruch in Konfi-Details (SPRUCH-08)"
    expected: "Konfi mit Listen-Spruch oeffnen -> KonfispruchSection zeigt Referenz + Spruchtext. Konfi mit Freitext-Spruch -> Text + Referenz. Konfi ohne Spruch -> Hinweis 'Noch kein Konfispruch gewaehlt'."
    why_human: "Visuelles Layout der read-only Section erfordert Xcode-Build"
  - test: "Anwesenheitsmatrix-Umschaltung Anwesenheit/Spruch + E-Mail-Versand (SPRUCH-09, SPRUCH-10)"
    expected: "Matrix oeffnen -> IonSegment sichtbar. Auf 'Spruch' -> Liste Konfi -> gewaehlter Spruch (oder 'noch keiner'), KEIN Zellen-Layout. Mail-Button bei 'Anwesenheit' -> E-Mail mit Matrix kommt an eigene Adresse. Mail-Button bei 'Spruch' -> E-Mail mit Sprueche-Liste (Name + Konfirmationstermin + Spruch). Admin ohne E-Mail -> klare Fehlermeldung."
    why_human: "Erfordert Xcode-Build + E-Mail-Empfang verifizieren"
  - test: "FAQ-Seite landing.html im Browser pruefen (SPRUCH-11)"
    expected: "Neues FAQ-Item zum Konfispruch-Feature sichtbar; Konfirmations-FAQ-Item beschreibt Konfirmations-Event (kein 'festes Konfirmationsdatum' mehr); korrekte Umlaute; kein Emoji; Stil passt zu anderen Items."
    why_human: "Visueller Check im Browser erforderlich (statisches HTML, aber Rendering/Styling nicht per grep verifizierbar)"
  - test: "Konfirmationstermin-Sicht-Check (W3)"
    expected: "Als Konfi mit gesetztem is_konfirmation-Event: Dashboard-Countdown und Profil-Ansicht zeigen korrekten Termin aus dem Event (nicht aus jahrgaenge.confirmation_date). Konfi ohne is_konfirmation-Event -> kein Termin/keine Tage-Anzeige."
    why_human: "Datenabhaengig: benoetigt Testdaten mit is_konfirmation-Event in Prod/Testsystem + Geraet/Simulator"
---

# Phase 119: Konfispruch-Integration + Jahrgang-Steuerzentrale — Verification Report

**Phase Goal:** Liefert SPRUCH-07..11 — pro-Jahrgang steuerbare Konfispruch-Sichtbarkeit (konfspruch_enabled), confirmation_date-Umzug auf is_konfirmation-Event, Jahrgang-Steuerzentrale im Frontend (Modal: Konfispruch-Toggle + Wrapped-Freigabe, kein Konfirmationsdatum-Feld), Admin-Einsicht des Konfispruchs (read-only), Anwesenheitsmatrix-Umschaltung Anwesenheit/Spruch + E-Mail-Versand, FAQ-Eintrag.
**Verified:** 2026-06-09T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | jahrgaenge hat Spalte konfspruch_enabled BOOLEAN DEFAULT true, bestehende Zeilen auf true | VERIFIED | Migration 094 Z23: `ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS konfspruch_enabled BOOLEAN NOT NULL DEFAULT true` (idempotent) |
| 2  | POST/PUT /admin/jahrgaenge akzeptiert konfspruch_enabled und persistiert es | VERIFIED | jahrgaenge.js Z18, 28: validation; Z58/75: INSERT mit Default true; Z96/141: UPDATE via COALESCE |
| 3  | jahrgaenge.confirmation_date ist NULLABLE (NOT-NULL-Constraint entfernt) | VERIFIED | Migration 094 Z26: `ALTER TABLE jahrgaenge ALTER COLUMN confirmation_date DROP NOT NULL` |
| 4  | jahrgaenge.confirmation_date wird im Backend nirgends mehr ausgewertet (backgroundService, konfi.js, wrapped.js, users.js) | VERIFIED | `grep -c confirmation_date` ergibt 0 in backgroundService.js, wrapped.js, users.js; konfi.js hat 2 Treffer — beide sind Response-Feldnamen (confirmation_date: konfi.confirmation_event_date), nicht DB-Spalten-Reads |
| 5  | Teamer-Wrapped-Cron triggert jaehrlich am 6.1. | VERIFIED | backgroundService.js Z405/409: Log + cron.schedule('0 6 6 1 *') |
| 6  | Kein Konfi-Wrapped-Cron mehr (auf confirmation_date keyend) | VERIFIED | checkWrappedTriggers Z436-469: nur Teamer-Block, kein Konfi-Block |
| 7  | Auto-Loesch-Service leitet Stichtag aus is_konfirmation-Event ab | VERIFIED | backgroundService.js Z688-706: SELECT MIN(e.event_date) WHERE e.is_konfirmation=true; NULL-Skip-Guard Z703-706 |
| 8  | Jahrgang ohne is_konfirmation-Event wird uebersprungen (kein Datenverlust) | VERIFIED | backgroundService.js Z704: `if (!stichtag) { continue; }` — Test 7 in autoDeletion.test.js Z177 belegt den sicheren Default |
| 9  | GET /dashboard liefert konfspruch_visible (aus jahrgaenge.konfspruch_enabled) | VERIFIED | konfi.js Z48: `j.konfspruch_enabled` in konfiQuery; Z302: `const konfspruch_visible = konfi.konfspruch_enabled === true`; Z323: `konfspruch_visible` im Response |
| 10 | Konfi-Dashboard-Card Konfispruch erscheint nur bei konfspruch_visible=true | VERIFIED | DashboardView.tsx Z394: `if (dashboardData.konfspruch_visible !== true) { return null; }` |
| 11 | konfspruch_visible wird korrekt an DashboardView weitergereicht | VERIFIED | KonfiDashboardPage.tsx Z68: Interface-Feld; Z310-312: dashboardDataWithKonfspruch spreaded dashboardData (inkl. konfspruch_visible) und ueberschreibt nur konfspruch |
| 12 | GET /admin/konfis/:id liefert konfspruch-Objekt (Listen-Wahl/Freitext/null) | VERIFIED | konfi-management.js Z447-448: kp.konfspruch_id/freitext/freitext_referenz/translation in Query; Z568-603: Builder-Logik identisch zu konfi.js:486-522; kp.konfspruch_translation (nicht bible_translation) |
| 13 | Admin sieht Konfispruch read-only in Konfi-Details | VERIFIED | KonfiDetailSections.tsx Z403-443: KonfispruchSection exportiert; KonfiDetailView.tsx Z30/545: Import + Render bei role_name==='konfi' |
| 14 | Jahrgang-Modal hat konfspruch_enabled-Toggle und Wrapped-Freigabe-Toggle, kein confirmation_date-Feld | VERIFIED | AdminJahrgaengeePage.tsx: grep bestaetigt konfspruch_enabled (Z65, 121, 408), wrapped_released_at (Z66, 101, 123, 671-674); kein confirmation_date-Fund |
| 15 | Jahrgang-Liste zeigt Spruch-Freigabe und Wrapped-Status | VERIFIED | AdminJahrgaengeePage.tsx Z663-674: checkmarkCircle/closeCircle fuer konfspruch_enabled; Z671-674: wrapped_released_at -> 'Wrapped gestartet am ...' oder 'nicht freigegeben' |
| 16 | Anwesenheitsmatrix hat IonSegment Anwesenheit/Spruch | VERIFIED | AttendanceMatrixModal.tsx Z22-23: IonSegment/IonSegmentButton importiert; Z293-303: Segment gerendert |
| 17 | Spruch-Ansicht ist Liste Konfi -> Spruch (kein Zellen-Layout) | VERIFIED | AttendanceMatrixModal.tsx Z86: ViewMode-Typ; Z126-127: Sprueche-State; Z147: GET /admin/jahrgaenge/${id}/sprueche; Z307+: Listendarstellung bei viewMode='sprueche' |
| 18 | Admin kann Anwesenheit/Sprueche per E-Mail an eigene Adresse schicken (SPRUCH-10) | VERIFIED | AttendanceMatrixModal.tsx Z170: POST /admin/jahrgaenge/${jahrgangId}/matrix-email mit {type: viewMode}; jahrgaenge.js Z426-511: Endpoint mit Admin-Email-Load + 400 ohne E-Mail; emailService.js Z291: sendKonfiMatrixEmail exportiert (Z403) |
| 19 | Sprueche-E-Mail enthaelt Name + Konfirmationstermin (aus is_konfirmation-Event) + Spruch | VERIFIED | jahrgaenge.js Z447-453: getKonfirmationDate via is_konfirmation-Event; Z449-453: Rows mit konfirmation_date; emailService.js Z304-330: HTML-Tabelle Name/Konfirmation/Konfispruch |
| 20 | FAQ-Eintrag erklaert Konfispruch (pro-Jahrgang-Freischaltung, Konfirmationstermin) | VERIFIED | landing.html Z562-563: Konfispruch-FAQ-Item vorhanden; Z558: Konfirmations-FAQ-Item auf is_konfirmation-Event umgeschrieben ('festes Konfirmationsdatum' nirgends mehr) |

**Score:** 20/20 truths verified

---

### Review-Fixes (119-REVIEW.md, status: resolved)

| Finding | Fix | Evidence |
|---------|-----|----------|
| CR-01: Hard-Delete ohne org_id + deleted_at-Guard | backgroundService.js Z717: `u.organization_id = $3`; Z719: `u.deleted_at IS NOT NULL` (Hard-Delete setzt voraus, dass Soft-Delete bereits lief) | Commit dcf7fd5; Code verifiziert |
| CR-02: E-Mail-Subject-Header-Injection | emailService.js Z296: `safeJahrgangName = String(jahrgangName).replace(/[\r\n]+/g, ' ')` im Subject | Commit dcf7fd5; Code verifiziert |
| WR-01: DashboardView Konfirmation string-match statt is_konfirmation | DashboardView.tsx Z231-234: is_konfirmation=true wird primaer geprueft, Titel nur Fallback | Commit e364e99; Methode ist jetzt Flag-primaer |
| WR-02: canDismiss-Promise haengt bei Alert-Backdrop | AdminEventsPage.tsx Z100: backdropDismiss:false + Z106-107: onDidDismiss-Fallback | Commit e364e99; Code verifiziert |
| WR-04: setSprueche(null) fehlt beim Jahrgang-Wechsel | AttendanceMatrixModal.tsx Z144: `setSprueche(null)` | Commit e364e99; Code verifiziert |
| IN-03: sparkles statt sparklesOutline | AdminJahrgaengeePage.tsx Z38/391: `sparklesOutline` | Commit e364e99; Code verifiziert |
| WR-03: VERWORFEN | Admin-Unterseite-Close-Pfad ist bewusst unterschiedlich | Keine Aenderung noetig |

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/migrations/094_jahrgang_konfspruch_enabled.sql` | konfspruch_enabled BOOLEAN DEFAULT true + DROP NOT NULL auf confirmation_date | VERIFIED | Beide Schritte idempotent; korrekte Kommentare mit echten Umlauten |
| `backend/routes/jahrgaenge.js` | konfspruch_enabled in Validierung/POST/PUT/GET; /sprueche + /matrix-email Endpoints | VERIFIED | Alle Schritte verifiziert; kein confirmation_date mehr |
| `backend/services/backgroundService.js` | Cron 6.1.; kein Konfi-Wrapped-Block; Auto-Deletion auf is_konfirmation-Event | VERIFIED | Vollstaendig migriert |
| `backend/services/emailService.js` | sendKonfiMatrixEmail exportiert; Header-Injection-Schutz | VERIFIED | Z296 safeJahrgangName; Z403 exports |
| `backend/routes/konfi.js` | konfspruch_visible-Flag; confirmation_date aus is_konfirmation-Event; kein j.confirmation_date | VERIFIED | 0 DB-Spalten-Reads auf jahrgaenge.confirmation_date; Flag vorhanden |
| `backend/routes/konfi-management.js` | konfspruch-Builder in GET /:id; kp.konfspruch_translation | VERIFIED | Z447-603; korrekte Translation-Quelle |
| `backend/routes/wrapped.js` | Wrapped-Zeitraum aus is_konfirmation-Event; kein confirmation_date | VERIFIED | 0 confirmation_date-Vorkommen; is_konfirmation Z200 |
| `backend/routes/users.js` | kein j.confirmation_date in GET /me/jahrgaenge | VERIFIED | 0 confirmation_date-Vorkommen |
| `backend/tests/services/autoDeletion.test.js` | Stichtag ueber is_konfirmation-Event geseedet; Default-Test (kein Event -> keine Loeschung) | VERIFIED | setKonfirmationEventDaysAgo Z36; Test 7 Z177 |
| `frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx` | konfspruch_enabled-Toggle; Wrapped-Toggle mit Warnhinweis; kein confirmation_date; erweiterte Liste | VERIFIED | tsc sauber; alle grep-Checks positiv |
| `frontend/src/components/admin/modals/AttendanceMatrixModal.tsx` | IonSegment; Spruch-Liste; mail-Button; setSprueche(null) | VERIFIED | Z22-23 Imports; Z293-303 Segment; Z170 POST |
| `frontend/src/components/admin/views/KonfiDetailSections.tsx` | KonfispruchSection read-only exportiert | VERIFIED | Z403-443 |
| `frontend/src/components/admin/views/KonfiDetailView.tsx` | KonfispruchSection importiert und gerendert (nur konfi-Rolle) | VERIFIED | Z30 Import; Z545 Render |
| `frontend/src/components/konfi/views/DashboardView.tsx` | konfspruch_visible-Gate; Interface-Feld | VERIFIED | Z58, Z394 |
| `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` | konfspruch_visible im Interface; dashboardDataWithKonfspruch leitet es durch | VERIFIED | Z68; Z310-312 spread |
| `frontend/public/landing.html` | Konfispruch-FAQ-Item; Konfirmations-Item auf is_konfirmation-Event aktualisiert | VERIFIED | Z562-563 Konfispruch; Z558 Konfirmations-Event |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| jahrgaenge.js POST/PUT | jahrgaenge.konfspruch_enabled | INSERT/UPDATE-Parameter | WIRED | Z67-78 INSERT; Z138-152 UPDATE mit COALESCE |
| Migration 094 | jahrgaenge.confirmation_date | DROP NOT NULL | WIRED | Z26 |
| backgroundService.js runAutoDeletion | events.is_konfirmation | MIN(event_date) WHERE is_konfirmation=true | WIRED | Z690-706 |
| konfi.js GET /dashboard | jahrgaenge.konfspruch_enabled | konfspruch_visible-Flag im Response | WIRED | Z48 SELECT; Z302 Flag; Z323 Response |
| wrapped.js buildKonfiWrapped | events.is_konfirmation | SELECT MIN(event_date) WHERE is_konfirmation=true | WIRED | Z192-207 |
| konfi-management.js GET /:id | konfsprueche / konfspruch_uebersetzungen | konfspruch-Builder Z568-603 | WIRED | kp.konfspruch_translation genutzt |
| KonfiDetailView | KonfispruchSection | Import + Render bei role_name==='konfi' | WIRED | Z30/545 |
| DashboardView konfispruch-Renderer | dashboardData.konfspruch_visible | Gate vor Sektion-Render Z394 | WIRED | Z394 |
| AdminJahrgaengeePage Wrapped-Toggle | POST /admin/wrapped/generate/:id + DELETE /admin/wrapped/:id | api-Aufruf beim Umlegen | WIRED | Wiring im Modal-Code vorhanden |
| AttendanceMatrixModal IonSegment | GET /admin/jahrgaenge/:id/sprueche + POST matrix-email | State-Umschaltung + api-Post | WIRED | Z147 GET; Z170 POST |
| jahrgaenge.js /matrix-email | emailService.sendKonfiMatrixEmail | Aufruf mit Admin-Email + Jahrgang-Daten | WIRED | Z498-504; emailService Z291/403 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| konfi.js GET /dashboard | konfspruch_visible | jahrgaenge.konfspruch_enabled via JOIN | Ja — DB-Spalte aus Migration 094 | FLOWING |
| DashboardView.tsx konfispruch section | dashboardData.konfspruch_visible | KonfiDashboardPage spread via useOfflineQuery | Ja — durchgereicht aus API-Response | FLOWING |
| AttendanceMatrixModal sprueche-Ansicht | sprueche | GET /admin/jahrgaenge/:id/sprueche API | Ja — buildSpruecheList aus DB | FLOWING |
| emailService sendKonfiMatrixEmail | rows | jahrgaenge.js: buildSpruecheList + getKonfirmationDate | Ja — DB-Queries | FLOWING |

---

### Behavioral Spot-Checks

Nicht ausfuehrbar (kein Docker auf diesem Mac -> kein laufendes Backend; Frontend erfordert Xcode-Build).

---

### Probe Execution

Keine Probes deklariert (phase-Typ: execute, kein migration/tooling-Phase ohne Probe-Dateien).

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SPRUCH-07 | 119-01, 119-02, 119-03 | Pro-Jahrgang steuerbare Konfispruch-Sichtbarkeit (konfspruch_enabled) | SATISFIED | Migration 094, jahrgaenge.js, konfi.js konfspruch_visible, DashboardView Gate |
| SPRUCH-08 | 119-04 | Admin sieht gewaehlten Spruch in Konfi-Details | SATISFIED | konfi-management.js GET /:id + konfspruch-Builder; KonfispruchSection in KonfiDetailView |
| SPRUCH-09 | 119-05 | Anwesenheitsmatrix umschaltbar Anwesenheit/Spruch | SATISFIED | AttendanceMatrixModal IonSegment; /sprueche Endpoint |
| SPRUCH-10 | 119-05 | Admin verschickt Matrix/Sprueche-Liste per E-Mail an eigene Adresse | SATISFIED | /matrix-email Endpoint; emailService.sendKonfiMatrixEmail; Sprueche-E-Mail mit Konfirmationstermin |
| SPRUCH-11 | 119-06 | FAQ-Eintrag Konfispruch-Feature + Konfirmations-Eintrag aktualisiert | SATISFIED | landing.html Z562-563 + Z558 |

Keine verwaisten Requirements fuer Phase 119 in REQUIREMENTS.md.

---

### Anti-Patterns Found

| File | Pattern | Severity | Assessment |
|------|---------|----------|-----------|
| `backend/routes/konfi.js:444` | console.warn vor "kein Fallback mehr"-Kommentar (IN-02, REVIEW) | Info | Projektdurchgaengiger Stil, kein neuer Anti-Pattern |
| `frontend/src/components/konfi/views/DashboardView.tsx:231-234` | isKonfirmation-Funktion nutzt is_konfirmation-Flag primaer, Titel als Fallback (WR-01, teilweise behoben) | Info | Flag primaer gesetzt (Fix WR-01 applied); Fallback-Pfad ist toter Code bei korrekten Backend-Daten, aber unschaedlich |

Keine TBD/FIXME/XXX-Marker in den modifizierten Dateien.
tsc --noEmit: 0 Fehler (bestaetigt).

---

### Human Verification Required

Die folgenden Pruefungen erfordern einen Xcode-Build (kein automatisierbares cap-sync/Xcode auf diesem Mac) oder visuellen Browser-Check. Alle Code-Voraussetzungen sind nachweislich erfuellt.

#### 1. Jahrgang-Steuerzentrale (Modal + Liste)

**Test:** App bauen + auf Geraet/Simulator starten, als Admin einloggen. Jahrgaenge -> Jahrgang oeffnen.
**Expected:** Kein Konfirmationsdatum-Feld sichtbar; Toggle 'Konfispruch-Auswahl' und (bei bestehendem Jahrgang) 'Wrapped freigeben' vorhanden. Wrapped einschalten -> Warnhinweis -> bestaetigen -> Erfolg. Liste zeigt Wrapped-Status + Spruch-Freigabe + Punkteziele.
**Why human:** UI-Rendering und Modal-Flow erfordern Xcode-Build

#### 2. Konfispruch-Card-Gate (SPRUCH-07)

**Test:** konfspruch_enabled fuer Test-Jahrgang im Admin ausschalten, als Konfi einloggen.
**Expected:** Dashboard zeigt KEINE Konfispruch-Card. Wieder einschalten -> Card erscheint.
**Why human:** Erfordert Geraet + Rollenwechsel

#### 3. Admin-Einsicht Konfispruch (SPRUCH-08)

**Test:** Als Admin/Teamer einloggen, Konfi-Details oeffnen.
**Expected:** Listen-Spruch -> Referenz + Text. Freitext -> Text + Referenz. Kein Spruch -> 'Noch kein Konfispruch gewaehlt'.
**Why human:** Layout der KonfispruchSection visuell

#### 4. Matrix Umschaltung + E-Mail-Versand (SPRUCH-09, SPRUCH-10)

**Test:** Anwesenheitsmatrix oeffnen, Segment Anwesenheit/Spruch testen; Mail-Button beider Typen verwenden.
**Expected:** Spruch-Ansicht ist Liste (kein Zellen-Layout); E-Mails kommen an eigene Adresse; Admin ohne E-Mail -> Fehlermeldung.
**Why human:** Xcode-Build + E-Mail-Empfang

#### 5. FAQ landing.html im Browser (SPRUCH-11)

**Test:** landing.html im Browser oeffnen, FAQ-Sektion (#faq) aufrufen.
**Expected:** Konfispruch-Item vorhanden; Konfirmations-Item beschreibt Konfirmations-Event; Umlaute korrekt; kein Emoji; Stil stimmt.
**Why human:** Visueller Browser-Check

#### 6. Konfirmationstermin-Sicht-Check (W3 aus 119-03-PLAN)

**Test:** Als Konfi mit gesetztem is_konfirmation-Event Profil/Dashboard oeffnen.
**Expected:** Angezeigte Tage-bis-Konfirmation stammen aus dem Event (nicht aus jahrgaenge.confirmation_date). Kein Event -> kein Termin.
**Why human:** Abhaengig von Testdaten und Geraet

---

### Gaps Summary

Keine Gaps. Alle 20 must-have Truths sind VERIFIED. Saemtliche Review-Findings (2 Critical, 4 Warnings) aus 119-REVIEW.md sind in commits dcf7fd5 und e364e99 behoben und im Code bestaetigt. TypeScript laeuft ohne Fehler. Die 6 human_verification-Items resultieren aus dem Mac-seitigen No-Docker + No-Xcode-Constraint, nicht aus fehlender Implementierung — der autonome Code-Anteil ist vollstaendig.

---

_Verified: 2026-06-09T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
