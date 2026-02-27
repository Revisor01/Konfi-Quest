# Testing Patterns

**Analysis Date:** 2026-02-27

## Test Framework

**Runner:**
- Vitest 0.34.6 (configured but minimal usage)
- Config: Not found in repository (uses defaults)

**Assertion Library:**
- Testing Library React 16.2.0
- Jest DOM matchers 5.16.5 (extends expect for DOM assertions)

**Run Commands:**
```bash
npm run test.unit    # Run Vitest (vitest)
npm run test.e2e     # Run Cypress end-to-end tests (cypress run)
npm run lint         # ESLint code quality checks
```

**Backend:**
- No automated testing configured
- `"test": "echo \"Error: no test specified\" && exit 1"` in `package.json`
- Tests must be added manually

## Test File Organization

**Location:**
- Frontend unit tests: Co-located with source files
  - Currently: `/Users/simonluthe/Documents/Konfipoints/frontend/src/App.test.tsx` only
  - Pattern: `[Component].test.tsx` alongside `[Component].tsx`

**Naming:**
- Standard: `.test.ts`, `.test.tsx`, `.spec.ts`, `.spec.tsx`
- Convention: Single test file found as `App.test.tsx`

**Structure:**
```
frontend/src/
├── components/        # Component implementation files
├── contexts/          # Context providers and hooks
├── utils/             # Utility/helper functions
├── App.test.tsx       # App component test
├── setupTests.ts      # Test configuration
```

## Test Structure

**Suite Organization:**
```typescript
import React from 'react';
import { render } from '@testing-library/react';
import App from './App';

test('renders without crashing', () => {
  const { baseElement } = render(<App />);
  expect(baseElement).toBeDefined();
});
```

Pattern observed from `App.test.tsx`:
- Single test per file (minimal testing)
- Direct render without providers or context setup
- Basic DOM assertion only

**Patterns:**
- Setup: Import component, render it directly
- Teardown: Not explicitly handled (React Testing Library cleanup automatic)
- Assertion: `expect(baseElement).toBeDefined()` pattern

## Mocking

**Framework:** None configured in repository

**Pattern observed:**
- Window API mocking in `setupTests.ts`:
```typescript
window.matchMedia = window.matchMedia || function() {
  return {
      matches: false,
      addListener: function() {},
      removeListener: function() {}
  };
};
```

**What to Mock:**
- Would need: API calls (via axios/api service), Socket.io events, Capacitor plugins
- Example: `api.get()`, `api.post()` from `frontend/src/services/api.ts`
- Contexts: Would need to mock `AppProvider`, `BadgeProvider`, `LiveUpdateProvider` for isolated component tests

**What NOT to Mock:**
- DOM utilities (React Testing Library handles rendering)
- Date utilities (pure functions, test with real dates)
- Type definitions (TypeScript handles these)

## Fixtures and Factories

**Test Data:**
- Not found in codebase
- Would need factories for:
  - Event objects (complex with many properties)
  - User objects (role-based test variations)
  - Activity/Badge/Badge objects

**Location:**
- Would be: `/frontend/src/utils/test-factories.ts` or `/frontend/src/__tests__/fixtures/`
- Currently: Not implemented

## Coverage

**Requirements:** Not enforced

**View Coverage:**
- No coverage configuration detected
- Would run: `vitest --coverage` if configured

**Current State:**
- Only 1 test file exists (`App.test.tsx`)
- Coverage is essentially 0% beyond the App component entry point
- No component tests for features (Events, Chat, Admin sections)
- No utility function tests
- No context tests

## Test Types

**Unit Tests:**
- Scope: Individual functions, components in isolation
- Current approach: None implemented for utilities or presentational components
- Should test: Helper functions (`formatFileSize`, `calculateBadgeProgress`, `getProgressColor`), date utilities, modal component rendering

**Integration Tests:**
- Scope: Multiple components working together, API interactions
- Current approach: Not implemented
- Would test: Full page rendering with providers, context state propagation, form submissions

**E2E Tests:**
- Framework: Cypress 13.5.0
- Location: `/Users/simonluthe/Documents/Konfipoints/frontend/cypress/`
- Config: `cypress.config.ts`
- Support files: `cypress/support/commands.ts`, `cypress/support/e2e.ts`
- Test files: `cypress/e2e/test.cy.ts` (minimal - currently checking if app loads)

**Current E2E Coverage:**
```typescript
// cypress/e2e/test.cy.ts
describe('Konfipoints App', () => {
  // Basic smoke test only
  it('should load', () => {
    cy.visit('/');
  });
});
```

## Common Patterns

**Async Testing:**
- Would use `waitFor` from Testing Library for async operations:
```typescript
import { render, waitFor, screen } from '@testing-library/react';

test('loads data', async () => {
  render(<Component />);
  await waitFor(() => {
    expect(screen.getByText(/loaded/i)).toBeInTheDocument();
  });
});
```

- Backend async: All route handlers are `async (req, res) =>`, wrapped in try/catch
- Would mock API calls that are promises

**Error Testing:**
- Backend pattern: Test status codes and error messages
```javascript
// From backend error handling
if (!name || !points) {
  return res.status(400).json({ error: 'Name und Punkte sind erforderlich' });
}
```

- Frontend pattern: Would test context error state changes
```typescript
const { error, setError } = useApp();

test('displays error message', () => {
  setError('Test error');
  expect(error).toBe('Test error');
});
```

## Gap Analysis

**Not Tested:**
- `EventsView.tsx` component with complex status logic (50+ lines of status determination)
- `AppContext.tsx` complex state management and side effects (450+ lines)
- Chat system WebSocket integration
- Push notification handling and FCM token flow
- RBAC middleware behavior (`verifyTokenRBAC` in `middleware/rbac.js`)
- Activity/Badge/Event CRUD operations in backend routes
- Error edge cases in modal submissions

**High-Risk Areas (should test):**
1. `frontend/src/contexts/AppContext.tsx` - Core app state, push notifications, badge logic
2. `frontend/src/components/konfi/views/EventsView.tsx` - Complex event status calculations
3. `backend/middleware/rbac.js` - RBAC token verification and permissions
4. `backend/routes/activities.js` - CRUD operations with category linking
5. `backend/routes/events.js` - Event bookings, waitlist, attendance tracking

## Recommended Testing Strategy

**Phase 1: Unit Tests**
- Test utility functions first: `dateUtils.ts`, `helpers.ts`
- Mock-free: Pure functions with clear inputs/outputs
- Target: 80% coverage of utils/

**Phase 2: Component Tests**
- Test presentational components: `EventsView.tsx`, `DashboardView.tsx`
- Mock context providers
- Test props variations, state changes
- Target: Critical user paths

**Phase 3: Integration/E2E**
- Cypress tests for full flows: Login → Events → Registration
- Mock API responses at network level (Cypress network stubbing)
- Test real Socket.io connection for chat

**Phase 4: Backend Tests**
- Jest or Mocha setup (currently missing)
- Mock database: Test transactions, error cases
- Mock external services: Push notifications, email
- Test RBAC middleware with various roles

---

*Testing analysis: 2026-02-27*
