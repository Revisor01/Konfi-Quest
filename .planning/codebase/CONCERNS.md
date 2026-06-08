# Codebase Concerns

**Analysis Date:** 2026-06-09

This is a **production app** (Apple App Store v1.0 live, iOS 1.0.1 in review, Google Play closed testing). This document distinguishes **real risks** that need attention from **accepted tradeoffs** that are documented decisions. Items are grouped by category and prioritized by severity within each.

---

## Security Considerations

### Secrets committed in stack config (HIGH)

- **Risk:** Production `JWT_SECRET` and PostgreSQL password are hardcoded in committed compose files.
- **Files:**
  - `portainer-stack.yml:11` — `POSTGRES_PASSWORD: konfi_secure_password_2025`
  - `portainer-stack.yml:41` — `JWT_SECRET: konfi-secret-super-secure-2025`
- **Current mitigation:** None at file level. Repo is private. The live stack on the server (`konfi_quest` id 249) carries the real values in its Portainer-managed compose, also plaintext.
- **Recommendations:**
  - Move both to environment variables / Docker secrets resolved at deploy time, not literals in the YAML.
  - Rotate `JWT_SECRET` and the DB password (they have been committed to git history, so they are effectively burned). Rotating `JWT_SECRET` invalidates existing access/refresh tokens — schedule during low traffic.
  - The e2e file `docker-compose.e2e.yml` (`JWT_SECRET: e2e-test-secret-key-min-32-chars!!`, `POSTGRES_PASSWORD: postgres`) is **fine** — those are throwaway test values, not a concern.

### Auth / RBAC surface (accepted, well-covered)

- RBAC is **role-based, not permission-granular** (see Deprecated Tables below). Enforced via `requireSuperAdmin/OrgAdmin/Admin/Teamer` + `checkJahrgangAccess` + `requireSameOrganization`. Source of truth: `.planning/FEATURE-MATRIX.md`.
- The big org-isolation audit (01.06.2026) found and fixed 16 chat org-leak findings + a `users.js` delete-FK bug. 458 backend integration tests now exercise all routes against real PostgreSQL. This area is **healthy**, not a concern — noted here only because it is the highest-blast-radius surface if a future change regresses isolation.

---

## Dependency / Upgrade Debt

### react-router locked at 5.3.4 (HIGH — locked, not fixable)

- **Issue:** `react-router` / `react-router-dom` pinned to `^5.3.4`. RR6/RR7 are **blocked** because `@ionic/react-router` peer-depends on `react-router ^5`.
- **Files:** `frontend/package.json:48-49`; v5 API in use across routing (`Switch` / `Route component=` / `Redirect`), plus `useIonRouter` used **52×** in `frontend/src` (verified 2026-06-09).
- **Impact:** Cannot adopt modern react-router data APIs, loaders, or RR7 typing. Locked until **Ionic v9** ships (no release date as of 2026-06-08).
- **Fix approach:** None available now. Re-evaluate when Ionic v9 lands. This is a **documented external constraint**, not a bug. The v5 API works correctly.

### eslint pinned at 9.x (MEDIUM — accepted)

- **Issue:** `eslint ^9.39.4` cannot move to 10 because `typescript-eslint 8` is not yet eslint-10 compatible.
- **Files:** `frontend/package.json:55,64,73`.
- **Impact:** Linter major behind latest. No functional impact; tooling-only.
- **Fix approach:** Bump when `typescript-eslint` ships eslint-10 support. Documented decision (see `memory/upgrade_vite8_ts6_cap8.md`).

### eslint-plugin-react-hooks pinned at 5.x (MEDIUM — accepted)

- **Issue:** `eslint-plugin-react-hooks ^5.2.0`; v7 ships the React-Compiler ruleset which is too aggressive against the existing codebase — produced **145 ref findings** plus immutability/purity violations on working code.
- **Files:** `frontend/package.json:66`.
- **Impact:** Cannot adopt the React-Compiler lint ruleset without a large refactor.
- **Fix approach:** Defer. Revisit only if/when the team commits to a React-Compiler migration pass. Documented decision.

### Lint baseline ~645 pre-existing findings (LOW — tolerated)

- **Issue:** Roughly **645 pre-existing lint findings** (mostly `no-unused-vars`, `@typescript-eslint/no-explicit-any`).
- **Impact:** Lint is **not the build gate** — `tsc` is (`build: "tsc && vite build"`, `frontend/package.json:8`). Findings are noise, not failures.
- **Fix approach:** Opportunistic cleanup; do not gate CI on lint. When touching a file, prefer removing its `any`/unused-var findings rather than a big-bang sweep. Note: there are **0 TODO/FIXME/HACK markers** in either backend (`routes`/`services`/`utils`) or `frontend/src` — debt lives in lint findings, not inline markers.

---

## Build / Bundle

### Large index chunk ~2.5MB+ (MEDIUM)

- **Problem:** The main `index` chunk is ~2.5MB+, triggering Vite's single-large-chunk warning. **Not** solved by the Vite 8 upgrade (faster build ≠ smaller bundle).
- **Files:** `frontend/vite.config.ts` — **no `manualChunks` configured** (verified); `stats.html` is the visualizer output for inspection.
- **Cause:** Everything bundled into one chunk; no route-level code-splitting.
- **Improvement path:** Add `build.rollupOptions.output.manualChunks` to split vendor libs (Ionic, Swiper, axios, socket.io, qrcode), and/or `React.lazy` + `Suspense` on heavy routes (Wrapped/Swiper slides, file viewers, QR scanner). Measurable win on cold-load on real devices.

---

## Platform / Native

### Capacitor 8 emulator renders black (LOW — not an app bug)

- **Problem:** On the Android emulator, the Capacitor WebView surface renders **black in screenshots** (GPU/surface capture issue), affecting the screenshot workflow only.
- **Cause:** Emulator GPU surface, not application code.
- **Workaround:** Use `fromSurface:false` in the CDP screenshot call. App renders correctly on **real devices** (verified in Pixel_9 emulator runtime: Konfi dashboard runs, no crashes — only screenshot capture is affected).
- **Action:** None on the app. Keep the CDP workaround documented for the screenshot toolkit.

### `frontend/android` is gitignored → versionCode not versioned (MEDIUM — process risk)

- **Problem:** `frontend/android/` is gitignored, so `android/app/build.gradle` `versionCode` is **not tracked in git**. It must be **manually bumped before every AAB build**.
- **Impact:** Easy to forget; Google Play rejects duplicate `versionCode`. History is only in memory notes (21 → 26 → 27 → 28 → 29 over recent builds).
- **Fix approach:** Either (a) un-ignore the minimal signing-relevant gradle files, or (b) add a pre-build script that auto-increments and records `versionCode` in a tracked file. At minimum, keep a single authoritative log of the last-used code.

---

## Deployment / Operations

### Manual deploy via Portainer API (MEDIUM — operational)

- **Problem:** No auto-deploy. The `konfi_quest` stack is **not git-bound** (`git_config: null`) and has **no Watchtower**. `git push` only triggers GitHub Actions to build `:latest` to ghcr.io — the server does **not** pull automatically.
- **Process (from MEMORY.md):** push → wait for CI green → Portainer `manage_image` pull (backend+frontend) → `update_stack` id 249 env 1 `pull_image:true` **with full compose_content** → verify containers + `curl` live.
- **Impact:** Multi-step, error-prone, requires the full compose payload each time (omitting it → "Invalid request payload"). Easy to deploy a stale image if the pull step is skipped.
- **Mitigation in place:** Rollback anchors (previous image SHAs) are recorded per deploy in `memory/upgrade_vite8_ts6_cap8.md`. CI is the deploy gate.
- **Fix approach:** Consider git-binding the stack or adding controlled auto-pull. Until then, treat the documented runbook as mandatory and keep rollback SHAs per deploy.

### Express 5 empty-body regression (RESOLVED — note for future)

- Express 5 makes `req.body` `undefined` (not `{}`) on empty/missing body, which previously crashed ~71 `const {x} = req.body` sites. Fixed centrally with one middleware in `backend/createApp.js` (`if(req.body===undefined) req.body={}`). **Not a current concern** — documented so a future refactor does not remove that middleware.

---

## Database / Scaling

### Single Postgres container, 256M, no HA (LOW — accepted for size)

- **Current capacity:** DB ~14MB, Postgres 15.18, single container, 256M memory, ~6 connections. Indices are already strong (composite indexes on all hot tables per audit 064).
- **Limit / scaling levers (documented, not needed now):** Bump Postgres container memory 256M → 512M/1G and raise `PG_POOL_MAX` (default 20) moderately — **caution:** `pool × backend instances` must not exceed Postgres `max_connections` (100). Pool config is env-overridable in `backend/database.js`.
- **Mitigation:** Restore plan exists — nightly consistent `pg_dump` 02:30 (`/opt/Konfi-Quest/backups/pg_backup.sh`, gzip, 14-day rotation) + restic to Hetzner storage box. HA/replication is **over-engineering at 14MB**; restore plan beats HA here.
- **Action:** None now. Re-evaluate at the EKD-scale (4000+ users) growth target. Levers are documented.

### Deprecated / unused tables (LOW — cleanup)

- **`badges` table:** 0 rows, no FK points to it, no code references it (the active path is `custom_badges`; `user_badges.badge_id → custom_badges`). **Droppable** via a migration (`DROP TABLE badges`) — never by hand on prod.
- **`permissions` + `role_permissions`:** both 0 rows, intentionally unused (RBAC is role-based, not permission-granular). Harmless; can stay.
- **Token hygiene (optional):** `refresh_tokens` ~145/213 revoked-or-expired (~232KB), `password_resets` 7 expired (harmless). Optional cleanup cron.
- **Fix approach:** Bundle a single cleanup migration (DROP `badges` + an expired-token cron) into the next deploy. Low priority, non-blocking.

---

## Test Coverage Gaps / Test Infra

### Sporadic deadlock in `truncateAll` on parallel vitest runs (MEDIUM — flaky CI)

- **What's wrong:** Running the multi-suite backend test set in parallel sporadically throws `deadlock detected` in `truncateAll`. Run **individually**, every suite passes green.
- **Cause:** Not feature code — vitest `maxWorkers` / truncate ordering across suites contending on the shared test DB.
- **Risk:** Flaky CI can mask real failures or block a deploy on a non-issue, eroding trust in the gate.
- **Fix approach:** Pin truncate ordering (consistent table order to avoid lock cycles), or serialize the truncate step / lower `maxWorkers` for the suites that truncate. Until fixed, a CI failure here should be re-run before being treated as real.

### Pre-existing test-schema gap (LOW)

- A pre-existing globalSetup gap (`events.cancelled_at`, `event_unregistrations`) surfaced during Phase 114 work — **not** caused by feature code. Align the test schema bootstrap with the latest migrations.

---

## Severity Summary

| Severity | Item | Type |
|----------|------|------|
| HIGH | Secrets in committed `portainer-stack.yml` (rotate + externalize) | Real risk |
| HIGH | react-router locked at v5 (Ionic v9 dependency) | Accepted (external lock) |
| MEDIUM | Large ~2.5MB index chunk (no manualChunks) | Real opportunity |
| MEDIUM | `frontend/android` gitignored → versionCode not versioned | Process risk |
| MEDIUM | Manual Portainer deploy, no auto-deploy/Watchtower | Operational risk |
| MEDIUM | Flaky parallel-vitest `truncateAll` deadlock | Test infra |
| MEDIUM | eslint 9 / react-hooks 5 pins | Accepted decision |
| LOW | Capacitor 8 emulator black-screenshot (GPU) | Not an app bug |
| LOW | bird.png borrowed from GuckMal | Branding/provenance |
| LOW | ~645 lint findings baseline | Tolerated (tsc is gate) |
| LOW | Single Postgres / no HA | Accepted for size |
| LOW | `badges` / `permissions` / `role_permissions` unused tables | Cleanup |

---

*Concerns audit: 2026-06-09*
