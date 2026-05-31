---
phase: 114-self-loeschung-auto-loeschung
verified: 2026-05-31T18:25:00Z
status: passed
score: 12/12
overrides_applied: 0
---

# Phase 114: Self-Loeschung + Auto-Loeschung — Verification Report

**Phase-Ziel:** DSGVO/DSG-EKD-Konformitaet fuer den Launch: Self-Loeschung (alle Rollen, In-App, Apple-Guideline 5.1.1(v)) + Auto-Loeschung (60-Tage-Soft, 120-Tage-Hard ab confirmation_date, Teamer-Ausnahme).
**Verifiziert:** 2026-05-31T18:25:00Z
**Status:** PASSED
**Re-Verifikation:** Nein — initiale Verifikation

---

## Ziel-Erreichung

### Beobachtbare Wahrheiten

| # | Wahrheit | Status | Belege |
|---|---------|--------|--------|
| 1 | Self-Loeschung: jede:r angemeldete Nutzer:in (alle Rollen) kann Account in-App loeschen | VERIFIED | `auth.js:216` — `router.post('/delete-account', rbacVerifier, ...)`, kein requireAdmin/requireTeamer |
| 2 | Self-Delete verlangt Passwort-Bestaetigung; falsches PW -> 400, kein Loeschen | VERIFIED | `auth.js:233-236` — `bcrypt.compare`, 400 "Aktuelles Passwort ist falsch" |
| 3 | Self-Delete ist sofortiger kaskadierender Hard-Delete (nicht Soft) | VERIFIED | `auth.js:241-243` — `BEGIN -> deleteKonfiCascade(...) -> COMMIT` |
| 4 | Nach Loeschung: Client ausgeloggt + Redirect zu Login | VERIFIED | `DeleteAccountModal.tsx:61-69` — `await logout()`, danach `window.location.href = '/'` |
| 5 | DeleteAccountModal in allen drei Profil-Ansichten (Konfi, Teamer, Admin) | VERIFIED | grep-Treffer je 1x in ProfileView.tsx:47+331, TeamerProfilePage.tsx:49+133, AdminProfilePage.tsx:41+109 |
| 6 | Gemeinsame deleteKonfiCascade-Funktion: Admin-Delete, Self-Delete, Auto-Delete nutzen sie ALLE | VERIFIED | konfi-management.js:361, auth.js:242, backgroundService.js:603 — alle drei Pfade per grep bestaetigt |
| 7 | Migration 082: users.deleted_at + archived_at, jahrgaenge.confirmation_date NOT NULL mit Backfill | VERIFIED | `082_self_auto_deletion.sql` — ALTER TABLE users ADD COLUMN IF NOT EXISTS deleted_at/archived_at; UPDATE COALESCE; ALTER COLUMN confirmation_date SET NOT NULL |
| 8 | confirmation_date Pflicht in Create + Update (Backend); fehlt -> 400 | VERIFIED | `jahrgaenge.js:15+26` — `.notEmpty().withMessage('Konfirmationsdatum ist erforderlich').isISO8601()` |
| 9 | Frontend-Formular erzwingt Konfirmationsdatum; kein null-Versand mehr | VERIFIED | `AdminJahrgaengeePage.tsx:130+137+200` — Guard + trim() ohne `\|\| null`-Fallback + disabled-Bedingung |
| 10 | Soft-Delete-Filter (deleted_at IS NULL) vollstaendig in ALLEN Konfi-Sichtbarkeits-Queries | VERIFIED | konfi-management.js: 3, konfi.js: 8 (inkl. beidseitige RANK-Subqueries), levels.js: 2, events.js: 9, chat.js: 9+, wrapped.js: 2, badges.js: 1, teamer.js: 1 Treffer |
| 11 | Cron-Job: taeglich 02:00 Europe/Berlin, 60-Soft + 120-Hard, Teamer-Ausnahme, idempotent, fehler-isoliert | VERIFIED | `backgroundService.js:527+534` — `cron.schedule('0 2 * * *', ..., { timezone: 'Europe/Berlin' })`; Soft nur WHERE deleted_at IS NULL; Hard via deleteKonfiCascade; r.name='konfi'-Filter |
| 12 | Cron in startAllServices eingereiht | VERIFIED | `backgroundService.js:660` — `this.startAutoDeletionCron(db)` in startAllServices; `backgroundService.js:672` — `this.stopAutoDeletionCron()` in stopAllServices |

**Score: 12/12 Wahrheiten verifiziert**

---

## Artefakt-Verifikation

### Pflicht-Artefakte

| Artefakt | Erwartet | Status | Details |
|---------|---------|--------|---------|
| `backend/migrations/082_self_auto_deletion.sql` | Schema: deleted_at/archived_at + confirmation_date NOT NULL | VERIFIED | 25 Zeilen; alle 3 Aenderungen vorhanden; idempotent (IF NOT EXISTS) |
| `backend/utils/konfiDeletion.js` | Exportiert deleteKonfiCascade (16 Tabellen, kein BEGIN/COMMIT) | VERIFIED | 43 Zeilen; 16 DELETE-Statements in korrekter FK-Reihenfolge; CommonJS export |
| `backend/routes/auth.js` | POST /api/auth/delete-account mit Passwort + Hard-Delete | VERIFIED | Zeile 216; rbacVerifier; bcrypt.compare; Transaktion; deleteKonfiCascade |
| `frontend/src/components/shared/DeleteAccountModal.tsx` | useIonModal-Modal mit Passwort, Warnung, logout | VERIFIED | 188 Zeilen; IonInput password; api.post('/auth/delete-account'); logout() + window.location |
| `backend/services/backgroundService.js` | runAutoDeletion + startAutoDeletionCron in startAllServices | VERIFIED | runAutoDeletion Z.561; startAutoDeletionCron Z.519; in startAllServices Z.660; Modul laedt ohne Fehler |
| `backend/tests/services/autoDeletion.test.js` | 6 Test-Szenarien (60/120/30 Tage, Teamer, Idempotenz, Fehler-Isolation) | VERIFIED | 159 Zeilen; 6 it()-Bloecke exakt wie geplant |

### Schluessel-Verbindungen (Key Links)

| Von | Zu | Ueber | Status | Details |
|-----|----|-------|--------|---------|
| `auth.js` | `konfiDeletion.js` | `deleteKonfiCascade` in delete-account | VERIFIED | auth.js:10 require + auth.js:242 Aufruf |
| `konfi-management.js` | `konfiDeletion.js` | `deleteKonfiCascade` in DELETE-Handler | VERIFIED | konfi-management.js:7 require + Z.361 Aufruf; KEINE inline-16-Statements mehr |
| `backgroundService.js` | `konfiDeletion.js` | `deleteKonfiCascade` fuer Tag-120-Hard-Delete | VERIFIED | backgroundService.js:3 require + Z.603 Aufruf |
| `backgroundService.js` | `startAutoDeletionCron` | Aufruf in `startAllServices` | VERIFIED | Z.660 `this.startAutoDeletionCron(db)` |
| `DeleteAccountModal.tsx` | `/api/auth/delete-account` | `api.post('/auth/delete-account', ...)` | VERIFIED | DeleteAccountModal.tsx:57 |
| `ProfileView.tsx` | `DeleteAccountModal` | `useIonModal` | VERIFIED | Z.47 import + Z.331 useIonModal |
| `TeamerProfilePage.tsx` | `DeleteAccountModal` | `useIonModal` | VERIFIED | Z.49 import + Z.133 useIonModal |
| `AdminProfilePage.tsx` | `DeleteAccountModal` | `useIonModal` | VERIFIED | Z.41 import + Z.109 useIonModal |

---

## Soft-Delete-Filter-Vollstaendigkeit (D-12 — kritisch)

| Route-Datei | Treffer `deleted_at IS NULL` | Bewertung |
|------------|------------------------------|-----------|
| `konfi-management.js` | 3 | Konfi-Liste (GET /), DELETE-Check, Konfi-Detail (GET /:id). Teamer-Liste + promote-teamer bewusst ungefiltert (D-10). |
| `konfi.js` | 8 | Dashboard-Lookup, Dashboard-Ranking, 2x RANK-Subqueries (u + u2), Profil-Lookup, Profil-Stats, 2x Profil-RANK-Subqueries. Beidseitige Filterung sichert korrekte total_in_jahrgang-Zaehlung. |
| `levels.js` | 2 | Level-Usage-Count-Aggregat + Konfi-Level-Lookup. |
| `events.js` | 9 | Teilnehmerliste, Abmeldungen, Auto-Enroll bei Event-Create/-Update, Push-Empfaenger, Push bei Loeschung, Kapazitaets-Zaehlung, Event-Chat-Insert, Absage-Push. |
| `chat.js` | 9+ | validUser-Check (Direkt-Chat-Erstellung), Jahrgang-Konfi-Auswahl, Raum-Teilnehmerliste + vorbestehende chat_messages.deleted_at-Filter. Nachrichten-Autor-Joins bewusst ungefiltert (T-114-13). |
| `wrapped.js` | 2 | Konfi-Listen fuer Wrapped-Generierung (Admin-Endpoint + Cron). Aggregat-Subqueries ohne users-Alias bewusst ungefiltert. |
| `badges.js` | 1 | Konfi-Selbst-Check in checkAndAwardBadges. Badge-Ersteller-Joins bewusst ungefiltert. |
| `teamer.js` | 1 | Konfi-Uebersicht GET /teamer/konfis. self-profile + teamer-check bewusst ungefiltert. |

**Bewertung: Vollstaendig.** Alle Konfi-personensichtbar-machenden Queries sind gefiltert. Bewusste Ausnahmen (Nachrichten-Historie, Badge-Ersteller, Teamer-Listen) sind dokumentiert und DSGVO-konform (keine Personenprofile, nur historische Inhalte oder Nicht-Konfis).

---

## Test-Suiten-Verifikation (live ausgefuehrt)

| Test-Suite | Tests | Ergebnis |
|-----------|-------|----------|
| `tests/utils/konfiDeletion.test.js` | Teil von 101 | PASS (101/101) |
| `tests/routes/konfi-management.test.js` | Teil von 101 | PASS (101/101) |
| `tests/routes/auth.test.js` | Teil von 101 | PASS (101/101) |
| `tests/routes/jahrgaenge.test.js` | Teil von 101 | PASS (101/101) |
| `tests/services/autoDeletion.test.js` | Teil von 103 | PASS (103/103) |
| `tests/routes/konfi.test.js` | Teil von 103 | PASS (103/103) |
| `tests/routes/levels.test.js` | Teil von 103 | PASS (103/103) |
| `tests/routes/events.test.js` | Teil von 103 | PASS (103/103) |
| `tests/routes/teamer.test.js` | Teil von 103 | PASS (103/103) |
| `tests/routes/chat.test.js` (isoliert) | 24 | PASS (24/24) |
| `tests/routes/wrapped.test.js` (isoliert) | Teil von 68 | PASS |
| `tests/routes/badges.test.js` (isoliert) | Teil von 68 | PASS |

**Gesamt live verifiziert: alle relevanten Suiten gruen.**

Hinweis zum Parallel-Lauf: Beim gleichzeitigen Start von chat + wrapped + badges tritt sporadisch ein `deadlock detected` in `truncateAll` auf (parallele TRUNCATE-Contention auf gemeinsamen Tabellen). Dieses Problem ist vorbestehend (seit Phase 2.9 dokumentiert), nicht durch Phase 114 verursacht, und betrifft keine der neuen Soft-Delete-Tests. Isolierter Lauf aller drei Suiten: gruen.

---

## CLAUDE.md-Konformitaet

| Pruefung | Ergebnis |
|---------|----------|
| Unicode-Emojis in neuen Dateien (082_migration, konfiDeletion.js, DeleteAccountModal.tsx, backgroundService.js) | KEINE — 0 Treffer |
| Echte Umlaute (aeoess) in UI-Texten und Kommentaren | BESTAETIGT — "geloescht", "gelöscht", "Passwort", "Löschung" korrekt in allen Dateien |
| IonModal-Muster: `useIonModal` statt `<IonModal isOpen>` | BESTAETIGT — DeleteAccountModal.tsx nutzt IonPage-Muster; alle drei Profile-Views nutzen useIonModal-Hook |

---

## Anti-Pattern-Scan

| Datei | Fund | Bewertung |
|------|------|-----------|
| `konfi-management.js` | Kein inline-16-Statement-Block mehr im DELETE-Handler | OK — Refactoring bestaetigt |
| `backgroundService.js` | Keine TODO/TBD/FIXME-Marker | OK |
| `DeleteAccountModal.tsx` | Kein `<IonModal isOpen>` | OK |
| `AdminJahrgaengeePage.tsx` | Kein `confirmation_date.trim() \|\| null` mehr | OK |

Keine Blocker-Anti-Pattern gefunden.

---

## Human-Verifikation erforderlich

### 1. In-App-Fluss auf Geraet (iOS)

**Test:** Auf einem iPhone-Testgeraet mit einem Konfi-Account einloggen, zu Profil navigieren, "Account loeschen" antippen, Passwort eingeben und bestaetigen.
**Erwartet:** Modal zeigt klare Warnung ohne Emojis, Loeschen-Button deaktiviert bei leerem Passwort, nach Bestaetigung: Modal schliesst, App navigiert zu Login-Seite, erneutes Login mit altem Passwort schlaegt fehl.
**Warum human:** UI-Verhalten, Navigations-Flow, visuelle Darstellung des Modals — nicht per grep verifizierbar.

### 2. Auto-Loeschungs-Cron-Timing in Produktion

**Test:** Sicherstellen, dass der Cron tatsaechlich um 02:00 Uhr (Europe/Berlin, nicht UTC) laeuft.
**Erwartet:** Server-Logs zeigen "Auto-Deletion-Cron: Starte node-cron 0 2 * * * Europe/Berlin" beim Start; kein Lauf um 01:00 UTC (= 02:00 CEST).
**Warum human:** Prod-Deploy notig, Timezone-Verhalten im echten Docker-Container — nicht im lokalen Test abgesichert.

### 3. Teamer-"Retten"-Fenster UX

**Test:** Mit einem Admin-Account einen Konfi, dessen Jahrgang confirmation_date in Kuerze erreicht (z.B. in 5 Tagen), zu einem Teamer promoten. Sicherstellen, dass nach Tag 60 keine Auto-Loeschung erfolgt.
**Erwartet:** Nach Cron-Lauf ist der (nun-)Teamer noch vorhanden; confirmed durch Server-Log ohne dessen user_id als "soft-geloescht".
**Warum human:** End-to-End-Szenario mit echtem Prod-DB-Stand und echtem Cron-Lauf.

---

## Scope-Grenzen (vorbestehend, nicht durch Phase verursacht)

- `GET /api/events/:id` fehlen im Test-DB-globalSetup die Spalten `events.cancelled_at` und Tabelle `event_unregistrations`. Der neue events-Soft-Delete-Test umgeht den Endpoint und prueft den DB-Query direkt — korrekte Entscheidung, Scope-Boundary.
- Sporadischer `deadlock detected` im vollen Parallel-Lauf aller Test-Suiten (TRUNCATE-Contention in truncateAll) — vorbestehend seit Phase 2.9.

---

## Zusammenfassung

Alle 12 beobachtbaren Wahrheiten sind im Code verifiziert. Die Phase liefert vollstaendig:

**Self-Loeschung:** `POST /api/auth/delete-account` (auth.js) mit rbacVerifier (alle Rollen), bcrypt-Passwort-Bestaetigung, kaskadierendem Hard-Delete via deleteKonfiCascade in Transaktion. Frontend: `shared/DeleteAccountModal.tsx` mit useIonModal, in allen drei Profil-Ansichten eingebunden.

**Gemeinsame Loesch-Funktion:** `backend/utils/konfiDeletion.js` exportiert `deleteKonfiCascade` (16 Tabellen, FK-Reihenfolge, kein eigenes BEGIN/COMMIT). Admin-Delete (konfi-management.js), Self-Delete (auth.js) und Auto-Delete (backgroundService.js) nutzen sie alle — Single Source of Truth bestaetigt.

**confirmation_date Pflicht:** Migration 082 setzt NOT NULL nach COALESCE-Backfill. Backend-Validierung `notEmpty().isISO8601()` in Create + Update. Frontend: kein `\|\| null` mehr, Guard + disabled-Bedingung.

**Soft-Delete-Filter:** `deleted_at IS NULL` in allen 8 Konfi-sichtbar-machenden Route-Dateien (35+ Einzelstellen insgesamt). RANK()-Subqueries beidseitig gefiltert. Bewusste Ausnahmen (Nachrichten-Historie, Badge-Ersteller) dokumentiert und DSGVO-konform.

**Auto-Loeschungs-Cron:** `runAutoDeletion` + `startAutoDeletionCron` in backgroundService.js. Zeitplan `'0 2 * * *'` + `timezone: 'Europe/Berlin'`. In `startAllServices` + `stopAllServices` eingereiht. 60-Soft/120-Hard, Teamer-Ausnahme via r.name='konfi'-Filter, Idempotenz, Fehler-Isolation. 6 Integration-Tests gruen.

Drei Human-Checks verbleiben (in-App-Fluss iOS, Cron-Timing in Prod, Teamer-Rettungsfenster end-to-end) — Automated Checks vollstaendig bestanden.

---

_Verifiziert: 2026-05-31T18:25:00Z_
_Verifier: Claude (gsd-verifier)_
