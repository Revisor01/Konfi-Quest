# Testing Patterns

**Analysis Date:** 2026-03-23

## Test Framework

**Unit/Integration Runner:**
- Vitest 4.x
- Config: `frontend/vite.config.ts` (eingebettet unter `test:`)
- Environment: jsdom

**Assertion Library:**
- Vitest globals (`expect`, `test`, `describe`) - kein separates Import noetig
- `@testing-library/jest-dom` fuer DOM-Assertions

**E2E Runner:**
- Cypress 13.x
- Config: `frontend/cypress.config.ts`
- Base URL: `http://localhost:5173`

**Run-Befehle:**
```bash
# Unit-Tests (Vitest)
cd frontend && npm run test.unit

# E2E-Tests (Cypress)
cd frontend && npm run test.e2e

# Backend hat KEINE Tests konfiguriert
# (package.json: "test": "echo \"Error: no test specified\" && exit 1")
```

## Test-Datei-Organisation

**Lage:**
- Unit-Tests: Co-located mit Quellcode in `src/`
  - Derzeit nur: `frontend/src/App.test.tsx`
- E2E-Tests: Separates Verzeichnis `frontend/cypress/e2e/`
  - Derzeit nur: `frontend/cypress/e2e/test.cy.ts`
- Setup-Datei: `frontend/src/setupTests.ts`

**Naming:**
- Unit-Tests: `[ComponentName].test.tsx` oder `[module].test.ts`
- E2E-Tests: `[feature].cy.ts`

**Struktur:**
```
frontend/
├── src/
│   ├── App.test.tsx          # Einziger unit test
│   └── setupTests.ts         # Test-Setup (jest-dom, matchMedia-Mock)
└── cypress/
    ├── cypress.config.ts     # Cypress-Konfiguration
    ├── e2e/
    │   └── test.cy.ts        # E2E-Smoke-Test (Placeholder)
    └── support/
        ├── commands.ts       # Custom Cypress Commands (leer/Vorlage)
        └── e2e.ts            # Cypress Support-File
```

## Test-Struktur

**Vorhandenes Unit-Test-Muster (`App.test.tsx`):**
```typescript
import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

**Vorhandenes E2E-Muster (`cypress/e2e/test.cy.ts`):**
```typescript
describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/')
    cy.contains('ion-content', 'Tab 1 page')
  })
})
```

**Vitest-Konfiguration (`vite.config.ts`):**
```typescript
test: {
  globals: true,          // describe/test/expect ohne Import
  environment: 'jsdom',   // DOM-Simulation
  setupFiles: './src/setupTests.ts',
}
```

## Mocking

**Framework:** Vitest built-in (`vi.mock`, `vi.fn`) - verfuegbar durch `globals: true`

**Setup-Mocks (`setupTests.ts`):**
```typescript
// matchMedia-Mock (required für Ionic-Komponenten)
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};
```

**Was gemockt werden muss:**
- `window.matchMedia` - Ionic-Komponenten brauchen dies (schon in setupTests)
- Capacitor-Plugins: Native APIs nicht in jsdom verfuegbar
- `api` (axios-Instanz): fuer Unit-Tests von Komponenten mit API-Calls
- `AppContext`/`useApp`: wenn Kontext-abhaengige Komponenten getestet werden

**Empfohlenes Mock-Pattern fuer api.ts:**
```typescript
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  }
}));
```

**Empfohlenes Mock-Pattern fuer Capacitor:**
```typescript
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
  }
}));
```

## Fixtures und Factories

**Test-Daten:** Keine Fixture-Dateien oder Factory-Pattern vorhanden.

**Empfohlenes Muster fuer neue Tests (Inline-Objekte):**
```typescript
const mockUser: BaseUser = {
  id: 1,
  type: 'konfi',
  display_name: 'Test Konfi',
  organization_id: 1,
};

const mockEvent: Event = {
  id: 1,
  name: 'Gottesdienst',
  event_date: '2026-04-01T10:00:00Z',
  points: 3,
  // ... weitere Pflichtfelder
};
```

**Lage:** Direkt in Test-Dateien als `const` vor den Tests.

## Coverage

**Anforderungen:** Nicht konfiguriert - keine Coverage-Schwellwerte gesetzt.

**Coverage anzeigen:**
```bash
cd frontend && npx vitest run --coverage
```

## Test-Typen

**Unit-Tests:**
- Abgedeckt: Minimaler Smoke-Test (`App.test.tsx`)
- Fehlend: Utility-Funktionen, Hooks, Komponenten-Logik

**Integration-Tests:**
- Nicht vorhanden

**E2E-Tests:**
- Vorhanden: Placeholder-Test in `cypress/e2e/test.cy.ts`
- Fehlend: Echte User-Flows (Login, Punkte-Vergabe, Events)

## Tatsaechlicher Testabdeckungsstand

**Kritische Luecken:**
- Utility-Funktionen in `src/utils/helpers.ts` und `src/utils/dateUtils.ts` sind vollstaendig ungetestet
- `useOfflineQuery` Hook (komplexe SWR-Logik) hat keine Tests
- Backend-Routes haben KEINERLEI Tests (`backend/package.json` hat `"test": "echo \"Error: no test specified\" && exit 1"`)
- Auth-Logik (`backend/routes/auth.js`, `src/services/tokenStore.ts`) ungetestet
- Validierungslogik (`backend/middleware/validation.js`) ungetestet

**Funktionsfaehige Test-Infrastruktur:**
- Vitest mit jsdom ist eingerichtet und funktionsfaehig
- `@testing-library/react` ist installiert
- Cypress ist installiert und konfiguriert

## Gemeinsame Async-Muster (fuer neue Tests)

**Async-Komponenten testen:**
```typescript
import { render, waitFor } from '@testing-library/react';

test('laedt Daten', async () => {
  render(<MyComponent />);
  await waitFor(() => {
    expect(screen.getByText('Erwarteter Text')).toBeInTheDocument();
  });
});
```

**Hook-Tests:**
```typescript
import { renderHook, act } from '@testing-library/react';
import { useOfflineQuery } from '../hooks/useOfflineQuery';

test('gibt gecachte Daten zurueck', async () => {
  const fetcher = vi.fn().mockResolvedValue({ id: 1 });
  const { result } = renderHook(() =>
    useOfflineQuery('test-key', fetcher)
  );
  await act(async () => { /* warte auf Laden */ });
  expect(result.current.data).toEqual({ id: 1 });
});
```

**Fehler-Testing:**
```typescript
test('behandelt API-Fehler', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Netzwerkfehler'));
  render(<MyComponent />);
  await waitFor(() => {
    expect(screen.getByText(/Fehler/i)).toBeInTheDocument();
  });
});
```

---

*Testing analysis: 2026-03-23*
