---
phase: 107-e2e-tests-mit-playwright
verified: 2026-03-28T09:30:00Z
status: human_needed
score: 8/8 must-haves verified (runtime not testable without Docker)
human_verification:
  - test: "Docker-Compose Stack starten und E2E Suite vollstaendig ausfuehren"
    expected: "docker compose -f docker-compose.e2e.yml up -d --build --wait startet alle 3 Services. npx playwright test fuehrt alle 6 Tests durch und alle bestehen."
    why_human: "Docker war waehrend der Entwicklung nicht verfuegbar. node_modules nicht installiert (npm install nie ausgefuehrt). Runtime-Verhalten kann nur auf einem Rechner mit Docker geprueft werden."
  - test: "Login-Test: .app-auth-error Selektor mit --with-badge Modifier"
    expected: "Der Fehler-Div in LoginView.tsx hat Klasse 'app-auth-error app-auth-error--with-badge'. Der Test sucht nach '.app-auth-error' — pruefe ob Playwright-Selektor auch mit BEM-Modifier-Klassen matcht."
    why_human: "CSS-Selektor '.app-auth-error' trifft auf 'app-auth-error app-auth-error--with-badge' — semantisch korrekt in CSS, aber Playwright-Behavior bei Partial-Class-Match benoetigt Ausfuehrung zur Verifikation."
  - test: "Punkte-Vergabe: waitForTimeout(2_000) Stabilitaet"
    expected: "2 Sekunden Wartezeit nach Aktivitaets-Vergabe ist lang genug, dass die Aenderung persistiert ist. Bei langsamer CI-Umgebung koennte dies knapp sein."
    why_human: "Timing-basierte Tests sind umgebungsabhaengig. Nur durch tatsaechliche Ausfuehrung verifizierbar."
  - test: "npm install + npx playwright install chromium ausfuehren"
    expected: "@playwright/test und pg werden installiert, Chromium-Browser wird heruntergeladen."
    why_human: "node_modules existiert nicht im Projekt-Root. npm install muss vor erstem Test-Run ausgefuehrt werden."
---

# Phase 107: E2E Tests mit Playwright — Verification Report

**Phase Goal:** Die 4 wichtigsten User-Journeys sind End-to-End im echten Browser verifiziert
**Verified:** 2026-03-28T09:30:00Z
**Status:** human_needed
**Re-verification:** Nein — initiale Verifikation

## Hinweis zur Verifikation

Docker war waehrend der Entwicklung lokal nicht verfuegbar. Alle Artefakte wurden statisch geprueft (Existenz, Inhalt, Selektoren, Wiring). Runtime-Verifikation (tatsaechliche Test-Ausfuehrung) erfordert menschliche Pruefung mit Docker-Zugang.

---

## Goal Achievement

### Observable Truths

| #   | Truth                                                                                 | Status      | Evidence                                                                              |
| --- | ------------------------------------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------- |
| 1   | Docker-Compose Test-Stack startet mit einem Befehl und ist fuer Playwright erreichbar | ? UNCERTAIN | docker-compose.e2e.yml vollstaendig, global-setup.ts korrekt — nicht ausfuehrbar ohne Docker |
| 2   | Konfi kann sich einloggen und sieht das Konfi-Dashboard                               | ? UNCERTAIN | login.spec.ts Test vorhanden, Selektor .app-auth-button + /login Route korrekt — keine Ausfuehrung |
| 3   | Admin kann sich einloggen und sieht den Admin-Bereich                                 | ? UNCERTAIN | login.spec.ts Test vorhanden, URL-Pattern /admin/ korrekt — keine Ausfuehrung        |
| 4   | Admin vergibt Aktivitaet, Punkte erscheinen im Konfi-Profil                           | ? UNCERTAIN | punkte-vergabe.spec.ts vorhanden, Selektoren verifiziert — keine Ausfuehrung         |
| 5   | Konfi bucht Event und Buchung erscheint in der Liste                                  | ? UNCERTAIN | event-buchung.spec.ts vorhanden, Selektoren verifiziert — keine Ausfuehrung          |
| 6   | Chat-Nachricht wird gesendet und beim Empfaenger angezeigt                            | ? UNCERTAIN | chat.spec.ts vorhanden, dual-page browser.newPage() Pattern korrekt — keine Ausfuehrung |

**Score:** 0/6 runtime-verifiziert (alle Artefakte statisch vollstaendig — 6/6 strukturell korrekt)

---

## Required Artifacts

| Artifact                         | Erwartet                                       | Status     | Details                                              |
| -------------------------------- | ---------------------------------------------- | ---------- | ---------------------------------------------------- |
| `docker-compose.e2e.yml`         | 3-Service Stack: postgres, backend, frontend   | ✓ VERIFIED | 51 Zeilen, alle 3 Services, Health-Checks vorhanden  |
| `playwright.config.ts`           | Playwright-Config Chromium-only                | ✓ VERIFIED | 19 Zeilen, chromium-only, baseURL, globalSetup/Teardown verdrahtet |
| `e2e/global-setup.ts`            | Docker up + DB Seed vor Tests                  | ✓ VERIFIED | 51 Zeilen, docker compose up + waitForBackend + seedDatabase |
| `e2e/global-teardown.ts`         | Docker down nach Tests                         | ✓ VERIFIED | 19 Zeilen, docker compose down -v                    |
| `e2e/helpers/auth.ts`            | loginAs Helper fuer Authentifizierung          | ✓ VERIFIED | 23 Zeilen, exportiert loginAs, Ionic-Selektoren korrekt |
| `e2e/login.spec.ts`              | Login E2E Tests fuer Konfi + Admin             | ✓ VERIFIED | 46 Zeilen, 3 Tests (Konfi, Admin, Fehlerfall)        |
| `e2e/punkte-vergabe.spec.ts`     | Punkte-Vergabe E2E Test                        | ✓ VERIFIED | 49 Zeilen, vollstaendige User-Journey                |
| `e2e/event-buchung.spec.ts`      | Event-Buchung E2E Test                         | ✓ VERIFIED | 36 Zeilen, vollstaendige User-Journey                |
| `e2e/chat.spec.ts`               | Chat E2E Test                                  | ✓ VERIFIED | 56 Zeilen, dual-page Sessions                        |
| `package.json`                   | test:e2e Script + Playwright devDependency     | ✓ VERIFIED | test:e2e Script, @playwright/test ^1.58.2, pg ^8.20.0 |
| `frontend/Dockerfile`            | VITE_API_URL Build-Arg                         | ✓ VERIFIED | ARG VITE_API_URL + ENV VITE_API_URL=$VITE_API_URL vor RUN npm run build |

---

## Key Link Verification

| Von                        | Nach                         | Via                    | Status     | Details                                                    |
| -------------------------- | ---------------------------- | ---------------------- | ---------- | ---------------------------------------------------------- |
| `e2e/global-setup.ts`      | `docker-compose.e2e.yml`     | docker compose up -d   | ✓ WIRED    | Zeile 37: `docker compose -f ${COMPOSE_FILE} up -d --build --wait` |
| `playwright.config.ts`     | `e2e/global-setup.ts`        | globalSetup config     | ✓ WIRED    | Zeile 17: `globalSetup: './e2e/global-setup.ts'`           |
| `playwright.config.ts`     | `e2e/global-teardown.ts`     | globalTeardown config  | ✓ WIRED    | Zeile 18: `globalTeardown: './e2e/global-teardown.ts'`     |
| `e2e/login.spec.ts`        | `e2e/helpers/auth.ts`        | loginAs import         | ✓ WIRED    | Import + 2 Verwendungen                                    |
| `e2e/punkte-vergabe.spec.ts` | `e2e/helpers/auth.ts`      | loginAs import         | ✓ WIRED    | Import + 2 Verwendungen (admin1 + konfi1)                  |
| `e2e/event-buchung.spec.ts` | `e2e/helpers/auth.ts`       | loginAs import         | ✓ WIRED    | Import + 1 Verwendung                                      |
| `e2e/chat.spec.ts`         | `e2e/helpers/auth.ts`        | loginAs import         | ✓ WIRED    | Import + 2 Verwendungen (konfi1 + admin1)                  |

---

## Selector Verification (CSS-Klassen in Frontend vorhanden)

| Selektor                          | Test-Datei               | Frontend-Fundort                                               | Status     |
| --------------------------------- | ------------------------ | -------------------------------------------------------------- | ---------- |
| `ion-button.app-auth-button`      | auth.ts, login.spec.ts   | frontend/src/components/auth/LoginView.tsx:160                 | ✓ VERIFIED |
| `.app-auth-error`                 | login.spec.ts            | frontend/src/components/auth/LoginView.tsx:185 (mit --with-badge Modifier) | ? UNCERTAIN (Playwright-Partial-Class-Match benoetigt Test) |
| `.app-action-button`              | event-buchung.spec.ts    | frontend/src/components/konfi/views/EventDetailView.tsx:737ff  | ✓ VERIFIED |
| `.app-modal-submit-btn--activities` | punkte-vergabe.spec.ts | frontend/src/components/admin/modals/ActivityModal.tsx:158    | ✓ VERIFIED |
| `ion-textarea[placeholder="Nachricht schreiben..."]` | chat.spec.ts | Benoetigt Ausfuehrung zur Verifikation | ? UNCERTAIN |

---

## Data-Flow Trace (Level 4)

Ueberspringen — E2E Tests sind selbst der Test-Mechanismus, keine Daten-rendernden Komponenten. Runtime-Datenfluss ist Teil der Human Verification.

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — Playwright node_modules nicht installiert, Docker nicht lokal verfuegbar. Keine lokale Test-Ausfuehrung moeglich.

---

## Requirements Coverage

| Requirement | Quell-Plan | Beschreibung                                       | Status         | Evidenz                                            |
| ----------- | ---------- | -------------------------------------------------- | -------------- | -------------------------------------------------- |
| E2E-01      | Plan 01    | Playwright Setup mit Docker Compose Test-Stack     | ? NEEDS HUMAN  | docker-compose.e2e.yml + playwright.config.ts vorhanden, nicht ausgefuehrt |
| E2E-02      | Plan 01    | Login-Flow E2E (Konfi + Admin)                     | ? NEEDS HUMAN  | login.spec.ts vorhanden, nicht ausgefuehrt         |
| E2E-03      | Plan 02    | Punkte-Vergabe E2E                                 | ? NEEDS HUMAN  | punkte-vergabe.spec.ts vorhanden, nicht ausgefuehrt |
| E2E-04      | Plan 02    | Event-Buchung E2E                                  | ? NEEDS HUMAN  | event-buchung.spec.ts vorhanden, nicht ausgefuehrt |
| E2E-05      | Plan 02    | Chat E2E                                           | ? NEEDS HUMAN  | chat.spec.ts vorhanden, nicht ausgefuehrt          |

**Hinweis:** REQUIREMENTS.md zeigt E2E-03, E2E-04, E2E-05 noch als `[ ]` unchecked und "Pending" — diese wurden nach Plan-02-Abschluss nicht aktualisiert. Reines Dokumentationsproblem, kein Code-Problem.

---

## Anti-Patterns Found

| Datei                          | Zeile | Pattern                        | Schwere     | Impact                                                        |
| ------------------------------ | ----- | ------------------------------ | ----------- | ------------------------------------------------------------- |
| `e2e/punkte-vergabe.spec.ts`   | 34    | `page.waitForTimeout(2_000)`   | ⚠️ Warning  | Feste 2s-Wartezeit statt event-basiertem Warten — flaky in langsamen Umgebungen |
| `REQUIREMENTS.md`              | 45,99 | E2E-03/04/05 als Pending       | ℹ️ Info     | Dokumentation nicht mit tatsaechlichem Implementierungsstand aktualisiert |

**node_modules fehlt:** `npm install` wurde nie ausgefuehrt. Kein Blocker fuer den Code selbst, muss vor erstem Test-Run nachgeholt werden.

---

## Human Verification Required

### 1. Vollstaendige E2E Suite ausfuehren

**Test:** Im Projekt-Root ausfuehren:
```bash
npm install
npx playwright install chromium
npx playwright test
```
**Erwartet:** Alle 6 Tests bestehen (3 aus Plan 01, 3 aus Plan 02)
**Warum menschlich:** Docker war waehrend Entwicklung nicht verfuegbar — npm install nie ausgefuehrt, kein Test-Run moeglich

### 2. `.app-auth-error` Selektor im Login-Test

**Test:** Fehlschlag-Test manuell pruefen: Schritt "Bleibt auf Login-Seite"
**Erwartet:** `page.locator('.app-auth-error')` findet das Element mit Klassen `app-auth-error app-auth-error--with-badge`
**Warum menschlich:** Playwright matcht auf CSS-Klasse (Partial-Match ist Standard) — zu bestaetigen dass kein Selektor-Problem vorliegt

### 3. Punkte-Vergabe Timing

**Test:** `waitForTimeout(2_000)` in Zeile 34 von punkte-vergabe.spec.ts evaluieren
**Erwartet:** Entweder die 2s sind ausreichend, oder durch `page.waitForURL` / `expect(toast).toBeVisible()` ersetzen
**Warum menschlich:** Timing-Sensitivitaet haengt von Docker-Host-Performance ab

### 4. REQUIREMENTS.md Checkbox-Update

**Test:** E2E-03, E2E-04, E2E-05 auf `[x]` setzen und Status auf "Complete" aendern
**Erwartet:** Dokumentation entspricht tatsaechlichem Stand
**Warum menschlich:** Inhaltliche Entscheidung ob Anforderungen als erfuellt gelten ohne ausgefuehrte Tests

---

## Strukturelle Qualitaet (statisch verifiziert)

Alle strukturellen Pruefungen bestanden:

- **Alle 5 Commits verifiziert:** d1dc9ea, 8851760, 5593640, 4d996a3, 9065eec
- **Alle 11 Artefakte existieren** und sind substantiell (keine Stubs, keine Platzhalter)
- **Alle 7 Key Links verdrahtet** (Imports, globalSetup, docker compose)
- **CSS-Selektoren** in tatsaechlicher Frontend-UI vorhanden verifiziert
- **frontend/Dockerfile** korrekt um VITE_API_URL erweitert (Zeilen 13-15)
- **Min-Zeilen** alle erfuellt: global-setup 51 (min 30), punkte-vergabe 49 (min 25), event-buchung 36 (min 20), chat 56 (min 25)
- **Login-Route** `/login` stimmt mit App.tsx Route ueberein (Zeile 192)
- **Seed-Daten-Referenzen** korrekt: konfi1/admin1, Sonntagsgottesdienst, Weihnachtsgottesdienst, Jahrgang 2025/2026

---

_Verified: 2026-03-28T09:30:00Z_
_Verifier: Claude (gsd-verifier)_
