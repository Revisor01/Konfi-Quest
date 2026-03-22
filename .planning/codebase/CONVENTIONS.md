# Coding Conventions

**Analysis Date:** 2026-03-22

## Naming Patterns

**Files:**
- React components: PascalCase, descriptive names — `AdminKonfisPage.tsx`, `EventDetailView.tsx`, `KonfiModal.tsx`
- Hooks: camelCase with `use` prefix — `useOfflineQuery.ts`, `useActionGuard.ts`
- Services: camelCase, purpose-describing — `tokenStore.ts`, `offlineCache.ts`, `writeQueue.ts`
- Backend routes: kebab-case filenames — `konfi-managment.js`, `jahrgaenge.js`
- Backend utils: camelCase — `roleHierarchy.js`, `liveUpdate.js`, `pointTypeGuard.js`
- Type definition files: camelCase — `user.ts`, `event.ts`, `wrapped.ts`

**Functions:**
- React components: PascalCase functional components — `const EventsView: React.FC<EventsViewProps> = ...`
- Event handlers: `handle` prefix — `handleClose`, `handleSave`, `handleValidationErrors`
- Async actions: verb + noun — `loadFromCache`, `sendTokenToServer`, `refreshKonfis`
- Boolean getters: `is` / `has` / `can` prefix — `isStale`, `hasError`, `canManageRole`
- Backend middleware factories: verb + noun — `checkUserHierarchy`, `requireAdmin`, `requireTeamer`

**Variables:**
- camelCase throughout — `konfiId`, `activityTargetRole`, `refreshSubscribers`
- Constants: SCREAMING_SNAKE_CASE — `API_BASE_URL`, `CACHE_TTL`, `VALID_POINT_FIELDS`, `ROLE_HIERARCHY`
- Boolean state: `is` prefix — `isSubmitting`, `isOnline`, `isDirty`, `isCancelled`

**Types/Interfaces:**
- Interfaces: PascalCase with descriptive names — `BaseUser`, `AppContextType`, `QueueItem`
- Props interfaces: ComponentName + `Props` suffix — `EventsViewProps`, `ActivityModalProps`
- Type unions: PascalCase — `LiveUpdateType`, `HighlightType`

## Code Style

**Formatting:**
- TypeScript strict mode enabled (`"strict": true` in `frontend/tsconfig.json`)
- ESNext target, no explicit Prettier config detected — formatting is ESLint-enforced
- Config: `frontend/eslint.config.js`

**Linting:**
- ESLint 9 with `typescript-eslint` recommended + `eslint-plugin-react-hooks`
- `react-refresh/only-export-components` warning enforced
- `no-console` is OFF in development, `warn` in production
- Backend: No ESLint config — vanilla Node.js CommonJS without type checking

## Import Organization

**Frontend pattern (observed consistently):**
1. React and React hooks — `import React, { useState, useCallback } from 'react'`
2. Router — `import { useHistory } from 'react-router-dom'`
3. Ionic components (grouped) — multi-line named imports from `@ionic/react`
4. Ionicons — named imports from `ionicons/icons`
5. Local contexts — `import { useApp } from '../../../contexts/AppContext'`
6. Local services/hooks — `import api from '../../../services/api'`
7. Local components — `import KonfisView from '../KonfisView'`
8. Local types — `import { BaseUser } from '../types/user'`

**Path aliases:** None — all imports use relative paths with `../../..` traversal.

**Backend pattern:**
- CommonJS `require()` — no ES modules in backend
- Express Router pattern: all routes exported as factory functions receiving `(db, rbacVerifier, roles, helpers)`

## Error Handling

**Frontend — user-facing errors:**
- Global error state via `AppContext.setError(message: string)` — shown as toast/alert app-wide
- Pattern: `const { setError, setSuccess } = useApp()` then `setError('German message')`
- Files: `src/components/konfi/modals/ActivityRequestModal.tsx`, `src/components/konfi/modals/ChangeEmailModal.tsx`

**Frontend — async errors in hooks/services:**
- `try/catch` with `err instanceof Error ? err.message : 'Unbekannter Fehler'` pattern
- Race-condition guard via `mountedRef.current` check before state updates
- File: `src/hooks/useOfflineQuery.ts` lines 70–83

**Frontend — API layer:**
- Axios interceptors handle 401 (token refresh) and 429 (rate limit) globally
- Custom `error.rateLimitMessage` property set on axios error objects
- `window.dispatchEvent(new CustomEvent('auth:relogin-required'))` for re-auth flows
- File: `src/services/api.ts`

**Frontend — rendering errors:**
- `ErrorBoundary` class component wraps entire app — `src/components/common/ErrorBoundary.tsx`
- Shows IonPage with reload button on crash

**Backend error responses:**
- `res.status(400).json({ error: 'German description' })` for validation errors
- `res.status(404).json({ error: 'Not found message' })` for missing resources
- `res.status(500).json({ error: 'Datenbankfehler' })` for all DB exceptions (minimal detail)
- `res.status(403).json({ error: 'Permission message' })` for RBAC denials
- Pattern: `try { ... } catch (err) { console.error(...); res.status(500).json({ error: 'Datenbankfehler' }); }`
- Validation via `express-validator` + `handleValidationErrors` middleware: `backend/middleware/validation.js`

## Logging

**Frontend:**
- `console.warn` for recoverable issues (offline, token send skip, push permission warnings)
- `console.error` for unrecoverable / unexpected errors (token parse fail, API errors)
- No structured logging or log aggregation in frontend

**Backend:**
- `console.error('Context message in GET /api/route:', err)` for DB errors
- `console.warn` for auth/socket issues
- Inconsistent indentation before `console.error` calls (some have leading space — formatting artifact)

## Comments

**When to Comment:**
- Section dividers for route files: `// ====================================================================`
- Inline German comments explaining non-obvious logic: `// Warteliste: booking_status kann 'waitlist' oder 'pending' sein (Backend sendet beides)`
- Race-condition explanations: `// revalidate bewusst nicht in deps (würde Loop verursachen)`
- Anti-pattern warnings: `// ANTI-SPAM: Verhindere mehrfache Push-Registrierung`

**JSDoc/TSDoc:**
- Used selectively in backend utilities — `backend/utils/roleHierarchy.js`, `backend/utils/liveUpdate.js`
- Not used in frontend TypeScript files — interfaces with inline comments preferred

## Function Design

**Frontend component functions:**
- Helper functions defined inside component body as `const` (not extracted) unless reusable
- Status derivation functions return plain objects: `return { statusColor, statusText, statusIcon, ... }`
- Callbacks memoized with `useCallback` when passed as props or used in effects

**Backend route handlers:**
- Always `async (req, res)` — no sync handlers
- Early return pattern for validation: `if (!name) return res.status(400).json({ error: ... })`
- DB operations use parameterized queries: `db.query(query, [param1, param2])`

## Module Design

**Frontend exports:**
- Default export for components: `export default EventsView`
- Named exports for hooks/services/utils
- Barrel file at `src/components/shared/index.ts` (exports `SectionHeader`, `EmptyState`, `ListSection`)
- Type files export only interfaces/types — no runtime code

**Backend exports:**
- CommonJS `module.exports = { ... }` for all backend modules
- Route files export factory function: `module.exports = (db, rbacVerifier, roles, ...) => { ... router; }`
- Utility files export named functions via object literal

## TypeScript Specifics

**Strict mode:** `"strict": true` — no implicit any, strict null checks active

**Type locations:**
- Shared domain types: `src/types/` — `user.ts`, `event.ts`, `chat.ts`, `dashboard.ts`, `wrapped.ts`
- Component-local interfaces defined at top of file, not exported
- Generic hooks typed with `<T>` — `useOfflineQuery<T>`, `offlineCache.get<T>`

**`any` usage:**
- Avoided in typed services, used in modal props (`onSave: (konfiData: any) => void` in `KonfiModal.tsx`)
- Backend is plain JavaScript — no TypeScript

## Modal Pattern

**Mandatory pattern — always `useIonModal` hook:**
```typescript
const [presentModal, dismissModal] = useIonModal(MyModal, {
  onClose: () => dismissModal(),
  onSuccess: () => { dismissModal(); loadData(); }
});
presentModal({ presentingElement: presentingElement });
```
**Never** use `<IonModal isOpen={state}>` — enforced by project rule.

Files using this pattern: `src/components/admin/pages/AdminKonfisPage.tsx`, `src/components/konfi/views/ProfileView.tsx`, `src/components/konfi/pages/KonfiEventsPage.tsx`

## Offline-First Pattern

All data-fetching pages use `useOfflineQuery` hook (SWR pattern):
```typescript
const { data, loading, error, refresh } = useOfflineQuery<T[]>(
  'cache:key:' + user?.organization_id,
  async () => { const res = await api.get('/endpoint'); return res.data; },
  { ttl: CACHE_TTL.KONFIS }
);
```
Cache keys namespaced by: `role:resource:org_id` — e.g., `'admin:konfis:5'`

## Double-Submit Prevention

All forms use `useActionGuard` hook:
```typescript
const { isSubmitting, guard } = useActionGuard();
await guard(async () => { /* submit logic */ });
```
File: `src/hooks/useActionGuard.ts`

## Locale

**Dates:** Always `toLocaleDateString('de-DE', ...)` and `toLocaleTimeString('de-DE', ...)`
**Text:** All UI strings in German — `'Ungültige ID'`, `'Datenbankfehler'`, `'Aktivität nicht gefunden'`
**Umlauts:** Real Unicode characters (ü, ö, ä, ß) — never escape sequences or HTML entities

---

*Convention analysis: 2026-03-22*
