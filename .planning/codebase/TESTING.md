# Testing Patterns

**Analysis Date:** 2026-03-23

## Test-Framework

**Runner:**
- Vitest 4.x (Unit-Tests)
- Konfiguration: `frontend/vite.config.ts` (eingebettet im Vite-Config, `/// <reference types="vitest" />`)

**Assertion-Bibliothek:**
- `@testing-library/jest-dom` 5.x — DOM-Assertions
- `@testing-library/react` 16.x — React-Komponenten rendern
- `@testing-library/user-event` 14.x — User-Interaktionen
- `@testing-library/dom`

**E2E:**
- Cypress 13.x
- Konfiguration: `frontend/cypress.config.ts`
- Base URL: `http://localhost:5173`

**Run-Kommandos:**
```bash
cd frontend && npm run test.unit    # Vitest (Unit-Tests)
cd frontend && npm run test.e2e     # Cypress (E2E-Tests)
```

**Backend:**
- Kein Test-Framework konfiguriert
- `package.json` script: `"test": "echo \"Error: no test specified\" && exit 1"`
- Keine Backend-Tests vorhanden

## Test-Datei-Organisation

**Ort:**
- Unit-Tests: Co-located im `src/`-Verzeichnis, nur `src/App.test.tsx` existiert
- E2E-Tests: `frontend/cypress/e2e/test.cy.ts`
- Cypress Support: `frontend/cypress/support/e2e.ts`, `frontend/cypress/support/commands.ts`
- Cypress Fixtures: `frontend/cypress/fixtures/example.json`

**Benennung:**
- Unit-Tests: `{Dateiname}.test.tsx` (z.B. `App.test.tsx`)
- E2E-Tests: `{name}.cy.ts`

**Struktur:**
```
frontend/
├── src/
│   ├── App.test.tsx         # Einziger Unit-Test
│   └── setupTests.ts        # Jest-DOM-Setup + matchMedia-Mock
├── cypress/
│   ├── e2e/
│   │   └── test.cy.ts       # Einziger E2E-Test (Stub)
│   ├── fixtures/
│   │   └── example.json     # Fixture-Stub
│   └── support/
│       ├── commands.ts      # Custom Commands (nur Kommentare/Stubs)
│       └── e2e.ts           # E2E-Support-Datei
```

## Test-Struktur

**Vorhandene Unit-Test-Suite (`src/App.test.tsx`):**
```typescript
import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

**E2E-Test (`cypress/e2e/test.cy.ts`):**
```typescript
describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/')
    cy.contains('ion-content', 'Tab 1 page')
  })
})
```

**Test-Setup (`src/setupTests.ts`):**
```typescript
import '@testing-library/jest-dom/extend-expect';

window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};
```

## Vitest-Konfiguration

**Eingebettet in `frontend/vite.config.ts`:**
```typescript
/// <reference types="vitest" />
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,           // describe/test/expect global verfügbar
    environment: 'jsdom',    // Browser-Umgebung simuliert
    setupFiles: './src/setupTests.ts',
  }
})
```

## Mocking

**Framework:** Vitest globals (`vi.mock`, `vi.fn`)

**Patterns:**
- `window.matchMedia` wird in `setupTests.ts` global gemockt (Ionic-Kompatibilität)
- Capacitor-Plugins müssen für Unit-Tests gemockt werden (kein Gerät vorhanden)
- API-Calls: kein globales Mock-Setup vorhanden — müsste pro Test mit `vi.mock('../services/api')` gemacht werden

**Aktuell was NICHT gemockt ist (würde Unit-Tests zum Absturz bringen):**
- `@capacitor/preferences` (Preferences API)
- `@ionic/react` Router (benötigt Router-Context)
- `AppContext` / `BadgeContext` / `LiveUpdateContext`

## Fixtures und Test-Daten

**Ort:**
- `frontend/cypress/fixtures/example.json` — nur Stub, keine echten Fixtures

**Kein Factory-Pattern vorhanden** — bei neuen Tests müssen Testdaten inline definiert werden.

## Coverage

**Anforderungen:** Keine definierten Coverage-Ziele

**Coverage-Kommando:**
```bash
cd frontend && npx vitest run --coverage
```
(coverage-Paket muss ggf. installiert werden: `npm install -D @vitest/coverage-v8`)

## Test-Typen

**Unit-Tests:**
- Framework: Vitest + React Testing Library
- Aktueller Umfang: 1 Test (`App.test.tsx` — Smoke-Test)
- Ziel: Komponenten-Rendering ohne Crash

**Integration-Tests:**
- Nicht vorhanden

**E2E-Tests:**
- Framework: Cypress 13
- Aktueller Umfang: 1 Test (Stub, greift noch auf nicht-existenten Inhalt zu)
- Custom Commands: nur Stubs/Kommentare, keine echten Commands implementiert

**Backend-Tests:**
- Nicht vorhanden

## Häufige Muster (falls Tests geschrieben werden)

**Async-Testing mit React Testing Library:**
```typescript
import { render, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('Lädt Daten und zeigt sie an', async () => {
  const { getByText } = render(<KonfiDashboardPage />);
  await waitFor(() => expect(getByText('Dashboard')).toBeInTheDocument());
});
```

**Fehler-Testing:**
```typescript
test('zeigt Fehlermeldung bei API-Fehler', async () => {
  vi.mock('../services/api', () => ({
    default: { get: vi.fn().mockRejectedValue(new Error('Netzwerkfehler')) }
  }));
  // ...
});
```

**Context-Provider-Wrapping (notwendig für die meisten Komponenten):**
```typescript
// Ionic-Komponenten benötigen IonApp-Wrapper
import { IonApp } from '@ionic/react';

const wrapper = ({ children }) => (
  <IonApp>
    <AppContext.Provider value={mockContextValue}>
      {children}
    </AppContext.Provider>
  </IonApp>
);

render(<MyComponent />, { wrapper });
```

## Bewertung des Test-Zustands

**Aktuell:**
- Test-Infrastruktur ist vorhanden und konfiguriert (Vitest + Cypress)
- Faktisch keine Tests geschrieben (1 Smoke-Test + 1 Cypress-Stub)
- Backend hat keine Tests
- `setupTests.ts` enthält den nötigen `matchMedia`-Mock für Ionic

**Prioritäten für neue Tests:**
1. Custom Hooks (`useOfflineQuery`, `useActionGuard`) — reine Logik, gut testbar
2. Utils/Services (`tokenStore`, `writeQueue`) — keine UI-Abhängigkeiten
3. Backend-Middleware (`validation.js`, `rbac.js`) — kritische Sicherheitslogik
4. Shared-Komponenten (`SectionHeader`, `ListSection`, `EmptyState`) — stabile Props-API

---

*Testing-Analyse: 2026-03-23*
