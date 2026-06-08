# Coding Conventions

**Analysis Date:** 2026-06-09

These conventions are MANDATORY. The hard rules in the first section are enforced project-wide and defined in `CLAUDE.md`. Violating them breaks the build philosophy and produces inconsistent UI.

## Hard Rules (Non-Negotiable)

Source: `/Users/simonluthe/Documents/Konfipoints/CLAUDE.md`.

**1. NO Unicode emojis — anywhere:**
- FORBIDDEN: every Unicode emoji (smileys, symbols, pictographs) in `.tsx`, `.ts`, `.js`, `.jsx`, comments, strings, UI text, push messages — everywhere.
- ALLOWED: IonIcons from `ionicons/icons` (including `-outline` variants), line icons, icon fonts.
- Example: use `<IonIcon icon={checkmarkCircle} />`, never a checkmark emoji.

**2. ALWAYS real umlauts — never ASCII transliteration:**
- RIGHT: `für`, `Glückwunsch`, `bestätigt`, `Größe`, `ä ö ü ß`
- WRONG: `fuer`, `Glueckwunsch`, `bestaetigt`, `Groesse`, `ae oe ue ss`
- Applies especially to push notifications, UI texts, validation messages. Backend validation already follows this (e.g. `Punkte müssen eine Ganzzahl >= 0 sein` in `backend/routes/activities.js`).

**3. Gendering in user-facing text:**
- Use `Teamer:innen`, `Teilnehmer:innen`, etc. with the colon form.
- EXCEPTION: `Konfis` is already plural — do NOT gender it.

**4. German is the development language:**
- UI texts, validation messages, code comments, commit messages — all German.
- Identifiers may be German or English (both appear); follow the surrounding file.

## Naming Patterns

**Files:**
- Frontend components: PascalCase `.tsx` (`EventsView.tsx`, `SectionHeader.tsx`, `CertificateAssignModal.tsx`).
- Frontend hooks: camelCase with `use` prefix `.ts` (`useOfflineQuery.ts`, `useActionGuard.ts`, `useCountUp.ts`).
- Frontend services: camelCase `.ts` (`tokenStore.ts`, `writeQueue.ts`, `networkMonitor.ts`).
- Backend routes: lowercase, one file per domain (`activities.js`, `konfi-management.js`, `chat.js`) in `backend/routes/`.
- Backend middleware/utils/services: camelCase (`rbac.js`, `pushService.js`, `pointTypeGuard.js`).

**Functions/Variables:** camelCase throughout (`getTestApp`, `checkAndAwardBadges`, `generateToken`).

**Types:** PascalCase, defined in `frontend/src/types/` (`user.ts`, `event.ts`, `chat.ts`, `dashboard.ts`, `wrapped.ts`, `ionic.d.ts`).

## Component Organization (by Role)

Components are grouped by RBAC role under `frontend/src/components/`:

| Directory | Purpose |
|-----------|---------|
| `components/konfi/` | Konfi-facing components (`views/`, `pages/`, `modals/`) |
| `components/teamer/` | Teamer-facing components |
| `components/admin/` | Admin / org-admin components |
| `components/shared/` | Reusable cross-role components (e.g. `StatusBadge`) |
| `components/common/` | Generic UI primitives |
| `components/auth/` | Login / auth screens |
| `components/chat/` | Chat (ChatOverview, ChatRoom) |
| `components/layout/` | App shell / tab layout |
| `components/wrapped/` | Year-in-review "Wrapped" slides |

**Reference views (copy 1:1, do not invent layout):**
- View: `frontend/src/components/konfi/views/EventsView.tsx`
- Detail: `frontend/src/components/konfi/views/EventDetailView.tsx`

## Design System

CSS variables and global classes live in `frontend/src/theme/variables.css`. Use existing classes — no ad-hoc inline styles for list/card layouts.

**Core layout classes:**
- `app-card` — card container
- `app-list-item__row` — list row (inner `div` INSIDE the `IonItem`, NOT directly on the `IonItem` — wrong nesting breaks the border)
- `app-section-icon--<color>` / `app-icon-circle` / `app-icon-circle--lg` — colored section/list icons
- `app-corner-badges` — flex container for corner badges (Queue/Error/Team/Pflicht/Konfirmation). Shared: `components/shared/StatusBadge`
- `app-toggle--<color>` — 8 global toggle color classes for iOS26 theme

**Global text classes:** `app-text-main` (1rem bold), `app-text-sub` (0.85rem grey), `app-description-text` (1rem body); CSS var `--app-description-font-size`.

**Header style:** always compact (icon + title inline + stats row), NEVER a large overlay text header.

**Theme:** `@rdlabo/ionic-theme-ios26` + `@rdlabo/ionic-theme-md3`, Ionicons 8, Ionic React 8, React 19.

**LESSON (MEMORY):** for lists/UI always open a working reference view (e.g. `KonfisView`) and copy it exactly. Do not build "by feel" — wrong nesting produces broken frames.

## Modal Pattern

ALWAYS use the `useIonModal` hook. NEVER use `<IonModal isOpen={state}>`.

```typescript
const [presentModal, dismissModal] = useIonModal(MyModal, {
  onClose: () => dismissModal(),
  onSuccess: () => {
    dismissModal();
    loadData(); // reload after success
  }
});

presentModal({ presentingElement: presentingElement });
```

## Frontend Patterns

- **Data fetching:** `useOfflineQuery` (SWR, offline-first) on all pages — `frontend/src/hooks/useOfflineQuery.ts`, backed by `services/offlineCache.ts`.
- **Navigation:** `useIonRouter` for programmatic navigation (NOT `history.push` / `window.location`).
- **Native guards:** wrap platform-specific calls in `Capacitor.isNativePlatform()`.
- **Offline writes:** queued via `services/writeQueue.ts` (FIFO persistent queue).
- **Token storage:** `services/tokenStore.ts` — sync in-memory getter + async Capacitor Preferences setter. Access 15min, refresh 90d rotating with soft-revoke.
- **Action guards:** `useActionGuard` prevents duplicate/invalid actions.
- **State:** single React Context `AppContext` (`frontend/src/contexts/`).
- **HTTP:** `axios` + `axios-retry` via `services/api.ts`.
- **Realtime:** `socket.io-client` via `services/websocket.ts` (org-isolated).
- **Icon gotcha:** the `document` icon MUST be imported as `documentIcon` (shadows `window.document`).
- **Bonus points:** accumulated in `konfi_profiles` AND stored in `bonus_points`; when displaying, do NOT add twice.

## Backend Patterns

Routes export a factory injecting dependencies (DB pool, RBAC verifier, role guards, badge checker):

```javascript
module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, checkAndAwardBadges) => {
  const router = express.Router();
  // ... express-validator rules, then routes
  return router;
};
```

- **Auth:** JWT via `verifyTokenRBAC` middleware (`backend/middleware/rbac.js`) with LRU cache. RBAC is ROLE-based (`requireSuperAdmin` / `requireOrgAdmin` / `requireAdmin` / `requireTeamer` + `checkJahrgangAccess` + `requireSameOrganization`), NOT permission-granular.
- **Org isolation:** always scope queries by `organization_id`; cross-org access must be blocked via `requireSameOrganization`. Root cause of past audit findings — never skip it.
- **Validation:** `express-validator` (`body`, `param`) + `handleValidationErrors` + shared `commonValidations` from `backend/middleware/validation.js`. German `withMessage` text.
- **DB:** PostgreSQL via `pg` pool (`backend/database.js`). ALWAYS parameterized queries (`$1, $2`). With an explicit client, ALWAYS `client.release()` in a `finally` block. Pool config env-overridable (`PG_POOL_MAX`, `PG_IDLE_TIMEOUT`, `PG_CONN_TIMEOUT`).
- **App assembly:** `backend/createApp.js` builds the Express app, accepting injected `db`, `uploadsDir`, `transporter`, `io`, `rateLimiters` (Dummies in tests).
- **Uploads:** validated by magic-bytes (`file-type`) in `backend/middleware/uploadValidation.js`.
- **Async/cron:** bcrypt async; scheduled jobs via `node-cron`.

## RBAC Structure (Mandatory)

Use the RBAC schema. The old `admins` / `konfis` tables and `points.gottesdienst` structure are DEPRECATED.

Core tables: `users` (all users, with `role_id`, `organization_id`, `is_super_admin`), `konfi_profiles`, `konfi_activities`, `bonus_points`, `konfi_badges` / `user_badges` / `custom_badges`, `event_bookings`, chat tables. Full rights matrix: `.planning/FEATURE-MATRIX.md`.

## Error Handling

- Backend: validation → structured German messages via `handleValidationErrors`; RBAC violation → 403; cross-org / not-found → 403/404.
- Frontend: `components/ErrorBoundary`, offline SWR fallbacks, write retries via `writeQueue`.

## Comments

German comments describing intent, often referencing design decisions (`Per D-09:`, `Per Pitfall 6:`). Comment WHY, not WHAT.

---

*Convention analysis: 2026-06-09*
