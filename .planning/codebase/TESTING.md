# Testing Patterns

**Analysis Date:** 2026-03-20

## Zustand

**Wichtige Vorabinformation:** Das Projekt hat so gut wie keine produktiven Tests. Es existieren nur Scaffold-Dateien und unbenutzte Konfigurationen.

---

## Test Frameworks (konfiguriert)

**Unit Test Runner:**
- Vitest (via `npm run test.unit`)
- Config: Keine eigene `vitest.config.*` — läuft über Vite-Defaults
- Assertion Library: Vitest-eigene (`expect`)

**E2E-Framework:**
- Cypress 13 (via `npm run test.e2e`)
- Config: `frontend/cypress.config.ts`
- BaseURL: `http://localhost:5173`

**Setup-Datei:**
- `frontend/src/setupTests.ts` — importiert `@testing-library/jest-dom/extend-expect`, mockt `window.matchMedia`

**Backend:**
- Kein Test-Framework konfiguriert
- `package.json` scripts.test: `"echo \"Error: no test specified\" && exit 1"`

**Run Commands:**
```bash
# Frontend
cd frontend && npm run test.unit    # Vitest Unit Tests
cd frontend && npm run test.e2e     # Cypress E2E Tests

# Backend
# Kein Test-Befehl vorhanden
```

---

## Tatsächliche Test-Dateien

### Einzige Unit-Test-Datei

`frontend/src/App.test.tsx` — Scaffold, nicht produktiv:

```typescript
import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

### Einzige E2E-Test-Datei

`frontend/cypress/e2e/test.cy.ts` — Scaffold, inhaltlich falsch (testet "Tab 1 page", das im Projekt nicht existiert):

```typescript
describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/')
    cy.contains('ion-content', 'Tab 1 page')  // Würde fehlschlagen!
  })
})
```

---

## Test-Infrastruktur-Dateien

**Vorhanden, aber ungenutzt:**
- `frontend/src/setupTests.ts` — matchMedia Mock
- `frontend/cypress/support/commands.ts` — Cypress Custom Commands (leer)
- `frontend/cypress/support/e2e.ts` — E2E Support
- `frontend/cypress/fixtures/` — Fixtures-Verzeichnis (leer)

**Installierte aber ungenutzte Test-Packages:**
- `@testing-library/react` ^16.2.0
- `@testing-library/user-event` ^14.4.3
- `@testing-library/jest-dom` ^5.16.5
- `vitest` ^4.1.0
- `cypress` ^13.5.0
- `jsdom` ^29.0.0

---

## Coverage

**Anforderungen:** Keine Enforcement.

**Status:** Keine Coverage-Daten vorhanden (keine Tests laufen).

---

## Wo Tests sinnvoll wären

Basierend auf der Codeanalyse gibt es mehrere untestete kritische Bereiche:

**`frontend/src/utils/helpers.ts`** — Pure Funktionen, gut testbar:
- `calculateBadgeProgress(konfi, badge)` — Komplexe Logik für Badge-Fortschritt
- `calculateWeekStreak(activities)` — Streak-Berechnung
- `filterBySearchTerm()`, `filterByJahrgang()`, `sortByDate()` — Filter-Utilities

**`frontend/src/utils/dateUtils.ts`** — Pure Funktionen:
- `getYearWeek()`, `formatDate()`, `getRelativeTime()`

**`frontend/src/services/api.ts`** — Interceptor-Logik:
- 401-Redirect-Verhalten
- Rate-Limit-Event-Dispatch

**Backend-Routes** — Integration Tests mit Test-DB:
- `backend/routes/activities.js` — RBAC-Checks, Punkte-Vergabe
- `backend/routes/auth.js` — Login, Rate-Limiting, Password-Reset

---

## Mocking-Ansatz (wenn Tests geschrieben werden)

**Für Vitest:**
```typescript
// API mocken
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  }
}));

// AppContext mocken
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'admin' },
    setError: vi.fn(),
    setSuccess: vi.fn(),
  })
}));
```

**matchMedia** ist bereits in `setupTests.ts` gemockt.

**Ionic-Komponenten** — Bei Bedarf mocken:
```typescript
vi.mock('@ionic/react', () => ({
  IonPage: ({ children }) => <div>{children}</div>,
  // ...
}));
```

---

## Empfohlene Test-Struktur

**Wenn neue Tests geschrieben werden sollen:**

Unit Tests co-located mit Quellcode:
```
src/utils/helpers.test.ts
src/utils/dateUtils.test.ts
src/services/api.test.ts
```

Komponenten-Tests:
```
src/components/shared/SectionHeader.test.tsx
src/components/shared/ListSection.test.tsx
```

E2E-Tests in:
```
frontend/cypress/e2e/auth.cy.ts
frontend/cypress/e2e/konfi-dashboard.cy.ts
```

---

*Testing analysis: 2026-03-20*
