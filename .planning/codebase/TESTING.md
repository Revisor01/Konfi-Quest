# Testing Patterns

**Analysis Date:** 2026-03-22

## Test Framework

**Runner:**
- Vitest 4.x
- Config: `frontend/vite.config.ts` (inline `test` block)

**Assertion Library:**
- Vitest built-in (`expect`, `test`, `describe`)
- `@testing-library/jest-dom` 5.x for DOM assertions

**E2E:**
- Cypress 13.x
- Config: `frontend/cypress.config.ts`

**Backend:**
- No test framework configured — `backend/package.json` test script exits with error: `"Error: no test specified"`

**Run Commands:**
```bash
# Frontend unit tests
cd frontend && npm run test.unit

# Frontend E2E tests (requires dev server running)
cd frontend && npm run test.e2e

# Watch mode (vitest)
cd frontend && npx vitest --watch

# Coverage (vitest)
cd frontend && npx vitest --coverage
```

## Test File Organization

**Location:**
- Unit test co-located with source: `src/App.test.tsx` alongside `src/App.tsx`
- E2E tests in dedicated directory: `frontend/cypress/e2e/`

**Naming:**
- Unit: `[ComponentName].test.tsx`
- E2E: `[name].cy.ts`

**Current state:**
```
frontend/
  src/
    App.test.tsx           # Only existing unit test
    setupTests.ts          # Test setup (matchMedia mock)
  cypress/
    e2e/
      test.cy.ts           # Single placeholder E2E test
```

## Test Structure

**Vitest setup file** (`src/setupTests.ts`):
```typescript
import '@testing-library/jest-dom/extend-expect';

// Required mock for Ionic (uses matchMedia internally)
window.matchMedia = window.matchMedia || function() {
  return {
    matches: false,
    addListener: function() {},
    removeListener: function() {}
  };
};
```

**Only existing unit test** (`src/App.test.tsx`):
```typescript
import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

**Only existing E2E test** (`cypress/e2e/test.cy.ts`):
```typescript
describe('My First Test', () => {
  it('Visits the app root url', () => {
    cy.visit('/')
    cy.contains('ion-content', 'Tab 1 page')
  })
})
```
Note: This E2E test is a stale placeholder — it checks for `'Tab 1 page'` which no longer exists in the app.

## Vitest Configuration

```typescript
// frontend/vite.config.ts
test: {
  globals: true,          // No explicit import of describe/test/expect needed
  environment: 'jsdom',   // Browser-like DOM environment
  setupFiles: './src/setupTests.ts',
}
```

## Mocking

**Framework:** Vitest built-in mocking (`vi.mock`, `vi.fn`)

**Required mocks for Ionic components:**
- `window.matchMedia` — already in `setupTests.ts`
- Capacitor plugins (`@capacitor/preferences`, `@capacitor/network`, etc.) — not yet mocked

**No established mocking patterns exist** beyond the matchMedia stub. Any new tests will need to mock:
- `src/services/api.ts` (axios instance)
- `src/services/tokenStore.ts` (Capacitor Preferences)
- `src/services/networkMonitor.ts`
- `src/contexts/AppContext.tsx` (React context)

## Test Coverage

**Requirements:** None enforced — no coverage threshold configured

**Current coverage:** Near zero — only `App.test.tsx` exists for the entire frontend codebase (~42,000 lines of TSX/TS)

## Test Types

**Unit Tests:**
- Framework: Vitest + @testing-library/react
- Scope: Component rendering, hook behavior
- Current state: 1 smoke test only

**Integration Tests:**
- No integration tests exist

**E2E Tests:**
- Framework: Cypress 13
- Base URL: `http://localhost:5173`
- Current state: 1 stale placeholder test

**Backend Tests:**
- None — test script explicitly errors out

## What Would Need Mocking for Real Tests

**For testing any page component:**
```typescript
// Mock AppContext
vi.mock('../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 1, type: 'admin', display_name: 'Test Admin' },
    isOnline: true,
    setError: vi.fn(),
    setSuccess: vi.fn(),
  })
}));

// Mock API
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn().mockResolvedValue({ data: [] }),
    post: vi.fn().mockResolvedValue({ data: {} }),
  }
}));

// Mock offlineCache (requires Capacitor Preferences)
vi.mock('../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn(),
    isStale: vi.fn().mockReturnValue(false),
  },
  CACHE_TTL: { KONFIS: 300000 }
}));
```

## Coverage Gaps

**Entire codebase is untested.** High-risk areas with no test coverage:

**`src/hooks/useOfflineQuery.ts`:**
- Race-condition logic (key change during fetch)
- Stale-while-revalidate flow
- Offline fallback behavior

**`src/services/api.ts`:**
- Token refresh logic (parallel request queuing)
- 429 rate-limit event dispatch
- `auth:relogin-required` event dispatch on refresh failure

**`src/services/writeQueue.ts`:**
- FIFO queue persistence
- Flush/retry logic
- Offline queue accumulation

**`src/services/tokenStore.ts`:**
- Async init from Preferences
- Memory-sync pattern for synchronous getters

**`src/hooks/useActionGuard.ts`:**
- Double-submit prevention
- Concurrent guard throws

**Backend routes (`backend/routes/*.js`):**
- All 18 route files have zero test coverage
- SQL query correctness
- RBAC permission enforcement
- Input validation via express-validator

---

*Testing analysis: 2026-03-22*
