# Testing Patterns

**Analysis Date:** 2026-03-24

## Test Framework

**Runner (Unit):**
- Vitest 4.x
- Config: `frontend/vite.config.ts` (eingebettet unter `test:` key)
- Environment: jsdom
- Globals: aktiviert (`globals: true`)
- Setup-Datei: `frontend/src/setupTests.ts`

**Runner (E2E):**
- Cypress 13.x
- Config: `frontend/cypress.config.ts`
- Base URL: `http://localhost:5173`

**Assertion-Bibliothek:**
- `@testing-library/jest-dom` (via `setupTests.ts`)
- Vitest-natives `expect`

**Backend:**
- Keine Test-Infrastruktur vorhanden
- `backend/package.json` Scripts: `"test": "echo \"Error: no test specified\" && exit 1"`

**Kommandos:**
```bash
# Frontend (im /frontend Verzeichnis)
npm run test.unit          # Vitest (einmalig)
npm run test.e2e           # Cypress run (headless)
npm run lint               # ESLint pruefen
```

## Test-Datei-Organisation

**Unit Tests:**
- Einzelne Datei vorhanden: `frontend/src/App.test.tsx`
- Ko-lokation (gleicher Ordner wie Quell-Datei) als Konvention erkennbar
- Namensschema: `<ComponentName>.test.tsx` bzw. `<module>.test.ts`

**E2E Tests:**
- Verzeichnis: `frontend/cypress/e2e/`
- Einzige Datei: `frontend/cypress/e2e/test.cy.ts` (Boilerplate, nicht produktiv genutzt)
- Support-Datei: `frontend/cypress/support/commands.ts` (Boilerplate ohne Custom Commands)
- Fixtures: `frontend/cypress/fixtures/` (leer)

## Test-Struktur

**Vorhandenes Unit-Test-Muster:**
```typescript
// frontend/src/App.test.tsx
import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

**Vorhandenes E2E-Muster:**
```typescript
// frontend/cypress/e2e/test.cy.ts
describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/')
    cy.contains('ion-content', 'Tab 1 page')
  })
})
```

## Setup und Mocks

**setupTests.ts:**
```typescript
import '@testing-library/jest-dom/extend-expect';

// matchMedia Mock (Ionic benötigt das)
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};
```

**Benötigte Mocks für neue Tests:**
- `window.matchMedia` — bereits in `setupTests.ts` vorhanden
- Capacitor-Plugins (`@capacitor/preferences`, `@capacitor/network` etc.) — müssen gemockt werden
- `src/services/api.ts` (axios) — muss gemockt werden für Komponenten-Tests
- `src/services/tokenStore.ts` — Synchrone Getter, einfach mockbar
- Socket.IO-Client — muss gemockt werden für Chat-Komponenten

## Mocking

**Framework:** Vitest-natives `vi.mock()` / `vi.fn()`

**Empfohlenes Mocking-Muster für dieses Projekt:**
```typescript
// Capacitor Preferences mocken
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn().mockResolvedValue({ value: null }),
    set: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
  }
}));

// API-Service mocken
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  }
}));

// AppContext mocken
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'konfi', display_name: 'Test Konfi' },
    setError: vi.fn(),
    setSuccess: vi.fn(),
    isOnline: true,
  })
}));
```

**Was gemockt werden soll:**
- Alle Capacitor-Plugins (kein nativer Layer in Tests)
- API-Calls (axios-Instanz)
- AppContext (kein Provider nötig in Unit-Tests)
- Socket.IO-Client (`src/services/websocket.ts`)
- `networkMonitor` aus `src/services/networkMonitor.ts`

**Was NICHT gemockt werden soll:**
- `src/utils/helpers.ts` (pure Funktionen, direkt testbar)
- `src/utils/dateUtils.ts` (pure Funktionen, direkt testbar)
- `src/utils/haptics.ts` (Wrapper, kann gemockt werden aber nicht nötig)

## Fixtures und Factories

**Aktuell:** Keine Test-Fixtures oder Factories vorhanden (`cypress/fixtures/` leer, keine Vitest-Factories)

**Empfohlenes Muster für neue Tests:**
```typescript
// Test-Daten-Factory (Vorschlag)
const makeKonfi = (overrides = {}) => ({
  id: 1,
  display_name: 'Test Konfi',
  type: 'konfi' as const,
  organization_id: 1,
  ...overrides,
});

const makeEvent = (overrides = {}) => ({
  id: 1,
  title: 'Test Event',
  event_date: new Date().toISOString(),
  is_registered: false,
  ...overrides,
});
```

**Fixtures-Verzeichnis:** `frontend/cypress/fixtures/` (leer, für E2E-Fixture-JSON-Dateien vorgesehen)

## Coverage

**Anforderungen:** Keine Coverage-Ziele konfiguriert

**Coverage anzeigen:**
```bash
npx vitest run --coverage
```

**Aktueller Stand:** Praktisch keine Coverage — nur 1 Smoke-Test für `App.tsx`

## Test-Typen

**Unit-Tests:**
- Scope: Einzelne Komponente, Hook, oder Utility-Funktion
- Framework: Vitest + @testing-library/react
- Aktuell vorhanden: 1 Datei (`App.test.tsx`)

**Integration-Tests:**
- Scope: Mehrere Schichten zusammen (z.B. Page + API-Call)
- Framework: Vitest (möglich aber nicht genutzt)
- Aktuell vorhanden: Keine

**E2E-Tests:**
- Framework: Cypress 13
- Base URL: `http://localhost:5173` (Dev-Server muss laufen)
- Aktuell vorhanden: 1 Boilerplate-Datei (nicht produktiv)

**Backend-Tests:**
- Framework: Keines
- Aktuell vorhanden: Keine

## Async-Testing

**Empfohlenes Muster mit Vitest + Testing Library:**
```typescript
import { render, screen, waitFor } from '@testing-library/react';

test('laedt Daten asynchron', async () => {
  render(<KonfiEventsPage />);
  await waitFor(() => {
    expect(screen.getByText('Events')).toBeInTheDocument();
  });
});
```

## Fehler-Testing

**Empfohlenes Muster:**
```typescript
test('zeigt Fehlermeldung bei API-Fehler', async () => {
  vi.mocked(api.get).mockRejectedValue(new Error('Netzwerkfehler'));
  render(<KonfiEventsPage />);
  await waitFor(() => {
    expect(screen.getByText(/Fehler/)).toBeInTheDocument();
  });
});
```

## Wichtige Hinweise fuer neue Tests

1. **Ionic-Komponenten** rendern im Test-Environment nicht vollständig — Tests sollten auf logisches Verhalten (Callbacks, State) fokussieren, nicht auf visuelle Ionic-UI
2. **useIonModal** muss gemockt werden (Ionic-Hook): `vi.mock('@ionic/react', () => ({ useIonModal: () => [vi.fn(), vi.fn()] }))`
3. **useOfflineQuery** hat Abhängigkeiten auf `offlineCache` und `networkMonitor` — beide müssen gemockt werden
4. **useIonRouter** (aus `@ionic/react`) muss für Page-Tests gemockt werden
5. **ModalContext** (`useModalPage`) ist auf `IonPage`-Refs angewiesen — für Unit-Tests mocken

---

*Testing-Analyse: 2026-03-24*
