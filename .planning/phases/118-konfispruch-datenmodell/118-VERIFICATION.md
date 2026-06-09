---
phase: 118-konfispruch-datenmodell
verified: 2026-06-09T00:00:00Z
status: human_needed
score: 16/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "App im iOS-Simulator als Konfi starten, Dashboard-Card 'Dein Konfispruch' antippen, beide Modi (Liste mit 4 Uebersetzungs-Tabs / Freitext mit Pflicht-Referenz) durchspielen, Speichern + Card-Aktualisierung pruefen"
    expected: "Card sichtbar (Indigo/Violett, unterscheidbar von Konfirmation), Modal oeffnet als Sheet, 4 Uebersetzungs-Tabs nur im Listen-Modus umschaltbar, Freitext ohne Tabs lehnt fehlende Stellenangabe mit deutschem Hinweis ab, nach Speichern zeigt Card den gewaehlten Spruch; keine Emojis, echte Umlaute"
    why_human: "Visuelle Darstellung, Sheet-Animation, Tab-Umschaltung und Live-Card-Aktualisierung sind nur am laufenden iOS-Build pruefbar. HINWEIS: Vom User bereits explizit als verifiziert uebernommen ('Als verifiziert uebernehmen') ohne Simulator-Lauf — kein Blocker."
---

# Phase 118: Konfispruch-Datenmodell Verification Report

**Phase Goal:** Kuratierte Spruch-Liste in der DB (Vers + 4 Uebersetzungen, seed-/db-erweiterbar). Speicherung des gewaehlten Spruchs am Konfi-Profil (Listen-Referenz ODER Freitext + gewaehlte Uebersetzung). Auswahl-Modal mit Uebersetzungs-Tableiste (Luther 2017 / Bibel in gerechter Sprache / Gute Nachricht / Elberfelder). Dashboard-Card "Dein Konfispruch" -> useIonModal.
**Verified:** 2026-06-09
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
| -- | ----- | ------ | -------- |
| 1  | Tabellen konfsprueche + konfspruch_uebersetzungen (4 Uebersetzungen/Vers) nach Migration 093 | VERIFIED | 093_konfspruch.sql:25-47, CREATE TABLE IF NOT EXISTS beide + UNIQUE(spruch_id, translation):45 |
| 2  | Migration 093 seedet ~32 Vers-REFERENZEN mit LEEREN Uebersetzungstexten | VERIFIED | 32 INSERT-Zeilen (:64-96), Quelle 118-spruch-referenzen.md enthaelt exakt 32; Uebersetzungs-Seed text='' via CROSS JOIN :100-104 |
| 3  | konfi_profiles um konfspruch_id (FK), konfspruch_freitext, konfspruch_freitext_referenz erweitert; dedizierte Uebersetzungs-Spalte | VERIFIED | 093:54-57 ADD COLUMN IF NOT EXISTS (alle 4); konfspruch_translation dediziert (CR-02-Fix), bible_translation NICHT angefasst |
| 4  | GET /api/konfi/konfsprueche liefert kuratierte Liste + Uebersetzungen | VERIFIED | konfi.js:2099-2142, json_object_agg pro Spruch, alle 4 Keys garantiert :2122-2135, org-gefiltert + is_active |
| 5  | GET /api/konfi/profile liefert gewaehlten Spruch (Listen-Wahl ODER Freitext) | VERIFIED | konfi.js:485-518, Feld konfspruch source 'liste'/'freitext'/null; org-scoped + is_active (WR-02), COALESCE-Default luther2017 (WR-03) |
| 6  | PATCH /profile Listen-Wahl setzt konfspruch_id + konfspruch_translation, NULLt Freitext | VERIFIED | konfi.js:2157-2192, UPDATE setzt beide + NULLt Freitext-Felder :2181-2187 |
| 7  | PATCH /profile Freitext (Text + PFLICHT-Referenz) NULLt konfspruch_id | VERIFIED | konfi.js:2195-2229, UPDATE :2218-2224 NULLt konfspruch_id; Laengen-Validierung (WR-01) :2210-2215 |
| 8  | Freitext ohne Stellenangabe -> 400 | VERIFIED | konfi.js:2203-2207, deutscher Pflicht-Referenz-Fehler |
| 9  | Konfi kann nur EIGENES Profil setzen (RBAC) | VERIFIED | type!=='konfi' -> 403 :2147-2148; WHERE user_id=req.user.id (kein Scope-Param) :2185/:2222 |
| 10 | Dashboard-Card 'Dein Konfispruch' (Sektion 'konfispruch') | VERIFIED | DashboardView.tsx:383-417 sectionRenderer; in DEFAULT_KONFI_ORDER :130; Backend-section_order-Backfill (CR-01-Fix) konfi.js:267-281 |
| 11 | Klick auf Card oeffnet Modal via useIonModal | VERIFIED | KonfiDashboardPage.tsx:239-253 useIonModal + openKonfispruch; Card onClick={onOpenKonfispruch} DashboardView:391 |
| 12 | IonSegment-Tableiste wechselt 4 Uebersetzungen (Luther 2017 / BIGS / Gute Nachricht / Elberfelder) | VERIFIED | KonfispruchSelectModal.tsx:229-241, TRANSLATION_KEYS + Labels :39-46 |
| 13 | Konfi waehlt Listen-Spruch ODER eigenen Freitext mit Pflicht-Stellenangabe | VERIFIED | Modal mode-Segment :213-224; Freitext-Validierung :158-167 |
| 14 | Beim Freitext KEINE Uebersetzungs-Tabs | VERIFIED | Uebersetzungs-IonSegment nur im mode==='liste'-Zweig :226-241; Freitext-Zweig :305-348 ohne Tabs |
| 15 | Speichern ruft PATCH /api/konfi/profile, Card zeigt danach gewaehlten Spruch | VERIFIED | Modal :141/:170 api.patch; onSuccess -> refreshProfile+refreshDashboard KonfiDashboardPage:241-244 |
| 16 | Card in Phase 118 ohne pro-Jahrgang-Gate sichtbar | VERIFIED | DashboardView:383 Renderer ohne show_*/Jahrgang-Gate, immer in section_order |

**Score:** 16/16 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| backend/migrations/093_konfspruch.sql | 2 Tabellen + 4 Profil-Spalten + 32-Referenz-Seed | VERIFIED | Idempotent (IF NOT EXISTS, DELETE WHERE org IS NULL), kein bible_translation angelegt, Lizenz-Hinweis im Kopf, echte Umlaute |
| backend/routes/konfi.js | GET /konfsprueche, GET /profile-Spruch, PATCH /profile | VERIFIED | node --check gruen, alle 3 Routen + RBAC + Validierung + Exklusivitaet |
| backend/tests/helpers/db.js | beide Tabellen in truncateAll | VERIFIED | konfspruch_uebersetzungen:51 + konfsprueche:52 (korrekte FK-Reihenfolge) |
| backend/tests/routes/konfi.test.js | Integrationstests | VERIFIED | 8 it-Blocks (Liste 200, Admin 403, Listen-Wahl, Freitext, Pflicht-Referenz 400, Exklusivitaet, ungueltige translation 400, RBAC 403); node --check gruen. Lauf in CI (kein lokales Docker) |
| frontend/.../KonfispruchSelectModal.tsx | useIonModal-Modal mit Tabs + Freitext | VERIFIED | 355 Zeilen (>80), beide Modi, Pflicht-Referenz, Platzhalter-Hinweis, echte Umlaute |
| frontend/.../DashboardView.tsx | Renderer 'konfispruch' + Callback | VERIFIED | Renderer :383-417, DEFAULT_KONFI_ORDER :130, onOpenKonfispruch-Prop |
| frontend/.../KonfiDashboardPage.tsx | useIonModal-Wiring | VERIFIED | Import :25, useIonModal :239, current aus Profil-Query, onSuccess-Refresh |
| frontend/src/theme/variables.css | .app-dashboard-section--konfispruch | VERIFIED | :2268-2271, Gradient #6d28d9->#4338ca, unterscheidbar von --konfirmation |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| PATCH /profile | konfi_profiles (UPDATE) | UPDATE konfi_profiles SET ... WHERE user_id | WIRED (konfi.js:2181, :2218) |
| GET /konfsprueche | konfsprueche JOIN uebersetzungen | json_object_agg :2107-2118 | WIRED |
| Migration Seed | 32 Referenzen | INSERT INTO konfsprueche + CROSS JOIN Uebersetzungen | WIRED |
| Card | KonfispruchSelectModal | onOpenKonfispruch -> presentKonfispruchModal | WIRED |
| Modal Speichern | PATCH /konfi/profile | api.patch('/konfi/profile', body) | WIRED |
| Modal Liste | GET /konfi/konfsprueche | api.get beim Mount :101 | WIRED |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| Card 'konfispruch' | dashboardData.konfspruch | GET /konfi/profile (useOfflineQuery) gemergt in Page :311 | Ja (DB-aufgeloest) | FLOWING |
| Modal Liste | sprueche | GET /konfi/konfsprueche (DB-Query) :101 | Ja — Referenzen real; Uebersetzungstexte INTENTIONAL leer (Lizenz, Betreiber befuellt per UPDATE) | FLOWING |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ----------- | ----------- | ------ | -------- |
| SPRUCH-01 | 118-01 | Kuratierte Spruch-Liste in DB, seed-/db-erweiterbar, ohne externe API | SATISFIED | konfsprueche-Tabelle + 32 Referenz-Seed, GET /konfsprueche |
| SPRUCH-02 | 118-01 | 4 Uebersetzungen pro Vers (Luther 2017, BIGS, Gute Nachricht, Elberfelder) | SATISFIED | konfspruch_uebersetzungen, je 4 Zeilen pro Vers (STRUKTUR erfuellt; Text intentional leer = lizenz-korrekt) |
| SPRUCH-03 | 118-01 | konfi_profiles speichert gewaehlten Spruch (Referenz ODER Freitext + Uebersetzung) | SATISFIED | konfspruch_id/freitext/freitext_referenz/konfspruch_translation + GET-Resolution |
| SPRUCH-04 | 118-01/02 | Konfi waehlt Liste ODER eigenen Freitext | SATISFIED | PATCH /profile beide Modi + Modal Modus-Segment |
| SPRUCH-05 | 118-02 | Auswahl-Modal mit Tableiste fuer 4 Uebersetzungen | SATISFIED | Modal IonSegment :229-241 |
| SPRUCH-06 | 118-02 | Dashboard-Card 'Dein Konfispruch' -> useIonModal | SATISFIED | Card + useIonModal-Wiring |

Keine orphaned Requirements: alle 6 IDs (SPRUCH-01..06) in REQUIREMENTS.md vorhanden und durch Plan-Frontmatter abgedeckt.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| - | - | - | - | Keine. Kein Emoji, kein TBD/FIXME/XXX, keine Umlaut-Verstoesse in UI-Strings (IN-01-Fix verifiziert: "wähle"/"wählen"/"ergänzt"), keine Stubs. |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| konfi.js Syntax | node --check routes/konfi.js | SYNTAX OK | PASS |
| Tests Syntax | node --check konfi.test.js + db.js | SYNTAX OK | PASS |
| Frontend Typen | npx tsc --noEmit (3 Phase-118-Dateien) | keine Fehler | PASS |
| Migration vollstaendig | node-Check Tabellen/Spalten/Seed/kein bible_translation | grep-bestaetigt | PASS |
| Backend-Integrationstests (vitest) | npx vitest run konfi.test.js | nur in CI (kein Docker/Postgres lokal) | SKIP (CI-gegated, Code geprueft) |

### Human Verification Required

#### 1. iOS-Simulator Sichtpruefung Konfispruch-Flow

**Test:** App im iOS-Simulator als Konfi starten, Card 'Dein Konfispruch' antippen, Listen-Modus (4 Uebersetzungs-Tabs umschalten, Spruch waehlen, speichern) und Freitext-Modus (ohne Stellenangabe -> Fehler, mit Stellenangabe -> speichern) durchspielen.
**Expected:** Card sichtbar (Indigo/Violett), Modal als Sheet, Tabs nur im Listen-Modus, Pflicht-Referenz wird erzwungen, Card aktualisiert sich nach Speichern. Keine Emojis, echte Umlaute.
**Why human:** Visuelle Darstellung + Sheet-Animation + Live-Aktualisierung nur am laufenden Build pruefbar.
**Hinweis:** Vom User bereits explizit als verifiziert uebernommen — kein Blocker fuer die Phase.

### Gaps Summary

Keine Gaps. Alle 16 Observable Truths verifiziert, alle 8 Artefakte auf allen Ebenen (Existenz, Substanz, Verdrahtung, Daten-Fluss) bestanden, alle 6 Requirements erfuellt, alle 6 Key-Links verdrahtet. Die beiden kritischen Review-Funde (CR-01 Card-rendert-nie via section_order-Backfill; CR-02 bible_translation-Kollision via dedizierter konfspruch_translation-Spalte) sind im Code nachweislich behoben, ebenso WR-01..05 und IN-01. Die leeren Uebersetzungstexte sind lizenz-konform beabsichtigt (Betreiber befuellt per UPDATE) und KEIN Defekt. Backend-vitest-Tests laufen ausschliesslich in CI (kein lokales Docker/Postgres) — der Test-Code ist vollstaendig geschrieben und syntaktisch abgesichert.

Status human_needed ergibt sich allein aus dem (vom User bereits akzeptierten) iOS-Sichttest; technisch ist die Phase vollstaendig.

---

_Verified: 2026-06-09_
_Verifier: Claude (gsd-verifier)_
