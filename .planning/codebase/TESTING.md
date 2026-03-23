# Testing Patterns

**Analysis Date:** 2026-03-23

## Test Framework

**Runner (Unit):**
- Vitest 4.x
- Config: eingebettet in `frontend/vite.config.ts` unter `test:`
- Globals aktiviert (`globals: true`) — kein expliziter Import von `describe`, `it`, `expect` nötig
- Environment: `jsdom`
- Setup-Datei: `frontend/src/setupTests.ts`

**Runner (E2E):**
- Cypress 13.x
- Config: `frontend/cypress.config.ts`
- Base URL: `http://localhost:5173`

**Assertion Library:**
- Vitest built-in (kompatibel mit Jest API)
- `@testing-library/jest-dom` fuer DOM-Assertions — via `setupTests.ts`

**Testing Library:**
- `@testing-library/react` 16.x
- `@testing-library/user-event` 14.x

**Backend:**
- Kein Test-Framework konfiguriert — `package.json` scripts.test gibt Fehler aus
- Keine Backend-Tests vorhanden

**Run Commands:**
```bash
# Frontend — im Verzeichnis frontend/
npm run test.unit          # Vitest (alle Unit-Tests)
npm run test.e2e           # Cypress (alle E2E-Tests)
npm run lint               # ESLint-Check
```

## Test File Organization

**Location:**
- Unit-Tests: Ko-lokiert im `src/`-Verzeichnis neben den Quelldateien
- E2E-Tests: `frontend/cypress/e2e/`
- Setup: `frontend/src/setupTests.ts`

**Naming:**
- Unit: `[Name].test.tsx` — z.B. `App.test.tsx`
- E2E: `[Name].cy.ts` — z.B. `test.cy.ts`

**Aktueller Umfang:**
```
frontend/src/
└── App.test.tsx              # 1 Smoke-Test
frontend/cypress/
├── e2e/
│   └── test.cy.ts            # 1 Placeholder-Test (Tab 1)
├── fixtures/
│   └── example.json          # Leeres Fixture
└── support/
    ├── commands.ts            # Nur auskommentierte Beispiele
    └── e2e.ts                 # Standard-Setup
```

## Test Structure

**Einziger vorhandener Unit-Test (App.test.tsx):**
```typescript
import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

**Einziger vorhandener E2E-Test (cypress/e2e/test.cy.ts):**
```typescript
describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/')
    cy.contains('ion-content', 'Tab 1 page')
  })
})
```

**Befund:** Beide Tests sind Scaffolding-Placeholders aus dem Ionic-Projekt-Generator — der E2E-Test ist definitiv nicht auf die aktuelle App ausgerichtet (`Tab 1 page` existiert nicht mehr).

## Mocking

**Framework:** Vitest built-in (`vi.mock`, `vi.fn`, `vi.spyOn`)

**Konfiguriertes Mock in setupTests.ts:**
```typescript
// Mock fuer window.matchMedia (Ionic benötigt dies in jsdom)
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};
```

**Capacitor-Mocking:** Nicht konfiguriert. Für Tests von Komponenten die Capacitor verwenden (z.B. `Preferences`, `PushNotifications`) wären Mocks erforderlich. Aktuell nicht vorhanden.

**Empfohlenes Mock-Pattern für Capacitor (nicht implementiert):**
```typescript
// Für Tests die tokenStore, offlineCache etc. nutzen
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }
}));
```

## Fixtures and Factories

**Test Data:**
- `frontend/cypress/fixtures/example.json`: leeres Objekt `{}`
- Keine Test-Factories oder Seeding-Utilities vorhanden

## Coverage

**Requirements:** Keine Coverage-Anforderungen konfiguriert.

**Coverage-Report:**
```bash
# Vitest Coverage (nicht konfiguriert, aber via CLI möglich)
npx vitest run --coverage
```

## Test Types

**Unit Tests:**
- Scope: Minimal — nur ein App-Smoke-Test
- Approach: `@testing-library/react` render + DOM-Assertion
- Effektiv getestete Logik: keine

**Integration Tests:**
- Nicht vorhanden

**E2E Tests:**
- Framework: Cypress 13 (konfiguriert)
- Basis-URL: `http://localhost:5173`
- Effektiv getestet: Placeholder ohne Relevanz fuer die aktuelle App

## Zusammenfassung des Ist-Zustands

**Praktisch keine automatisierten Tests vorhanden.** Das Projekt hat Testing-Infrastruktur aufgebaut (Vitest + Cypress + Testing Library), aber keine echten Tests implementiert.

- **Vitest**: 1 Smoke-Test der nur prüft ob `baseElement` definiert ist
- **Cypress**: 1 outdated Placeholder-Test
- **Backend**: Kein Test-Framework, kein einziger Test
- **Custom Commands**: Nur auskommentierte Cypress-Beispiele

**Testbare Kandidaten mit hohem Wert** (aktuell ungetestet):
- `src/utils/helpers.ts` — reine Funktionen: `calculateBadgeProgress`, `filterBySearchTerm`, `sortByDate`
- `src/utils/dateUtils.ts` — reine Funktionen
- `src/hooks/useOfflineQuery.ts` — SWR-Logik mit Netzwerk-State-Übergängen
- `src/hooks/useActionGuard.ts` — Double-Submit-Guard
- `src/services/tokenStore.ts` — Memory + Preferences-Sync
- Backend-Route-Handler — Express-Routen mit Supertest testbar

## Wenn Tests hinzugefügt werden

**Unit-Tests platzieren:** Ko-lokiert neben der Quelldatei als `[Name].test.ts` oder `[Name].test.tsx`

**Setup-Datei erweitern** für Capacitor-Mocks in `src/setupTests.ts`

**Async-Testing-Pattern (Vitest):**
```typescript
import { render, waitFor } from '@testing-library/react';

it('loads data', async () => {
  const { getByText } = render(<MyComponent />);
  await waitFor(() => expect(getByText('Geladen')).toBeInTheDocument());
});
```

**Error-Testing-Pattern (Vitest):**
```typescript
it('throws on invalid input', async () => {
  await expect(myAsyncFn(invalid)).rejects.toThrow('Ungültiger Wert');
});
```

---

*Testing analysis: 2026-03-23*
