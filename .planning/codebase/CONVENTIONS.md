# Coding Conventions

**Analysis Date:** 2026-02-27

## Naming Patterns

**Files:**
- PascalCase for React components: `LoadingSpinner.tsx`, `MainTabs.tsx`, `KonfiDashboardPage.tsx`
- camelCase for utility/service files: `helpers.ts`, `dateUtils.ts`, `chatUtils.js`, `passwordUtils.js`
- camelCase for routes: `activities.js`, `events.js`, `konfi.js`, `chat.js`
- Routes and views use descriptive names with descriptive suffixes: `EventsView.tsx`, `DashboardView.tsx`, `ActivityRequestsView.tsx`
- Modal files use Modal suffix: `EditProfileModal.tsx`, `ActivityRequestModal.tsx`, `KonfiModal.tsx`
- Page files use Page suffix: `KonfiDashboardPage.tsx`, `AdminEventsPage.tsx`, `AdminUsersPage.tsx`
- Service files use Service suffix: `pushService.js`, `backgroundService.js`, `emailService.js`

**Functions:**
- camelCase for all function names
- Async functions explicitly marked: `async function fetchData()`, `const refreshChatNotifications = useCallback(async () => { ... })`
- Hook naming: `useApp()`, `useBadge()`, custom React hooks prefixed with `use`
- Event handlers prefixed with `handle`: `handleAppActive`, `handleNativeFCMToken`, `getEventStatusInfo` (getters/calculators)
- Getter/calculator functions prefixed with `get`: `getEventStatusInfo()`, `getStatLabelsAndCounts()`, `getFilteredEvents()`, `getProgressColor()`
- Boolean functions prefixed with `is`: `isToday()`, `isThisWeek()`, `isPlatform()`

**Variables:**
- camelCase for all variables: `userRoom`, `lastSent`, `statusColor`, `filteredEvents`, `totalUnread`
- Constants in UPPER_SNAKE_CASE at module level: `JWT_SECRET`, `ALLOWED_ORIGINS`, `MIN_REFRESH_INTERVAL = 5000`
- State variables in camelCase: `user`, `loading`, `error`, `chatNotifications`, `pushNotificationsPermission`
- Temporary/loop variables: `i`, `j` for indices, `err` for errors

**Types:**
- PascalCase for interfaces and types: `Event`, `AppContextType`, `ChatNotifications`, `User`, `Category`, `Badge`
- Props interfaces use `Props` suffix: `EventsViewProps`, `AppContextType` (context type)
- Database/API response types named descriptively: `Event`, `User`, `ChatRoom`, `Activity`

## Code Style

**Formatting:**
- Configured via ESLint and TypeScript strict mode
- 2-space indentation (standard JavaScript/TypeScript)
- Trailing commas in multiline objects/arrays
- Semicolons required (enforced by ESLint rules)

**Linting:**
- Tool: ESLint 9.20.1 with typescript-eslint
- Key rules:
  - `no-console`: Off in development, warn in production (can leave console.log during debugging)
  - `no-debugger`: Off in development, warn in production
  - React Hooks rules enabled via `eslint-plugin-react-hooks`
  - `react-refresh/only-export-components`: Components should be default exports when possible
- Configuration: `/Users/simonluthe/Documents/Konfipoints/frontend/eslint.config.js`

**Backend (Express/Node):**
- No formal linting configured for backend
- Patterns followed: async/await, error handling with try/catch
- German language for user-facing error messages: `'Datenbankfehler'`, `'Keine Berechtigung'`

## Import Organization

**Order:**
1. Core/external libraries (React, Ionic, third-party): `import React`, `import { useEffect }`, `import { IonApp }`
2. Type definitions: `import type { ... }` or from types files
3. Relative imports from services/utils: `import { checkAuth } from '../services/auth'`, `import api from '../services/api'`
4. Relative imports from contexts: `import { AppProvider, useApp } from './contexts/AppContext'`
5. Relative imports from components: `import MainTabs from './components/layout/MainTabs'`
6. CSS imports last: `import '@ionic/react/css/core.css'`, `import './theme/variables.css'`

**Path Aliases:**
- Not configured (project uses relative paths)
- All imports use relative paths: `../services`, `../contexts`, `../components`

## Error Handling

**Patterns:**
- Backend: Try/catch blocks with status code responses
  - 400: Bad request (validation errors)
  - 401: Unauthorized (missing/invalid token)
  - 403: Forbidden (permission denied)
  - 404: Not found (resource doesn't exist)
  - 409: Conflict (duplicate entries, constraint violations)
  - 500: Server error (database errors)

- Example from `backend/routes/activities.js`:
```javascript
try {
  const { rows } = await db.query(query, [req.user.organization_id]);
  res.json(activitiesWithCategories);
} catch (err) {
  console.error('Database error in GET /api/activities/:', err);
  res.status(500).json({ error: 'Datenbankfehler' });
}
```

- Frontend: Context-based error state in `AppContext.tsx`
  - Errors stored in state: `error`, `success`
  - Auto-cleared after 5 seconds via useEffect cleanup
  - User-facing messages in German

- Modal error handling: Errors trigger auto-slide via `presentToast()` or slide back on close
  - Example: Delete conflicts show German messages with auto-slide after 2s

## Logging

**Framework:** `console` (no dedicated logging library)

**Patterns:**
- `console.log()` for info (development, can be left in for important events): `console.log('User connected:', name)`
- `console.error()` for errors: `console.error('Database error in GET /api/activities/:', err)`
- `console.warn()` for warnings: `console.warn('parseGermanTime is deprecated, use parseLocalTime instead')`
- Push/socket events extensively logged: `console.log('AppContent: User available, setting up badge logic')`
- Token operations logged with partial visibility: `token.substring(0, 20) + '...'`
- Comments in German mixed with English code

## Comments

**When to Comment:**
- Disable/workaround explanations: `// iOS26 Theme Animationen`, `// ANTI-SPAM:...`, `// Dark Mode ist deaktiviert bis zur vollständigen Implementierung`
- Complex logic explanations: Inline before complex calculations
- Deprecated function warnings: `console.warn('parseGermanTime is deprecated, use parseLocalTime instead')`
- TODO markers for incomplete features (rarely used, CLAUDE.md prefers clean code)
- Commented code blocks: Present in AppContext.tsx showing disabled auto-refresh with reason

**JSDoc/TSDoc:**
- Minimal usage, focused on complex functions in `/frontend/src/utils/dateUtils.ts`
- Example:
```typescript
/**
 * Converts a UTC date string to user's local time
 */
export const parseLocalTime = (dateString: string): Date => {
```
- Not enforced across all files, used primarily for utilities

## Function Design

**Size:**
- Small, focused functions preferred: `getProgressColor()` is 5 lines
- Complex logic broken into smaller helpers: `calculateBadgeProgress()` is ~30 lines with clear cases
- Modal components can be larger (50-150 lines) but break views into separate functions where possible

**Parameters:**
- Props interfaces used for component props: `EventsViewProps` with explicit property types
- Callback functions passed as function props: `onTabChange: (tab: string) => void`, `onSelectEvent: (event: Event) => void`
- REST parameters for variable arguments: Rarely used, prefer objects
- Typed explicitly: TypeScript strict mode enforced in `tsconfig.json`

**Return Values:**
- Early returns for validation/errors:
```javascript
if (!name || !points || !type) return res.status(400).json({ error: '...' });
```
- useMemo hooks return memoized results: `const konfirmationEvents = useMemo(() => [...], [events])`
- useCallback returns stable function references for event handlers

## Module Design

**Exports:**
- Components: Default export (`export default App`)
- Utilities: Named exports (`export const formatFileSize = (...) => ...`)
- Contexts: Named exports for provider and hook (`export const AppProvider`, `export const useApp`)
- Services: Either default or named depending on single vs. multiple exports

**Barrel Files:**
- Not extensively used
- Main structure: Direct relative imports to specific files
- Example structure: `/components/konfi/views/` contains individual view files, no index.ts barrel

**Backend Module Pattern:**
```javascript
module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, checkAndAwardBadges, upload) => {
  // Routes defined here
  router.get('/', ...);
  return router;
};
```
- Routes exported as functions taking db and middleware dependencies
- Allows dependency injection at server startup

---

*Convention analysis: 2026-02-27*
