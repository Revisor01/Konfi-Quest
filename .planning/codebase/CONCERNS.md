# Codebase Concerns

**Analysis Date:** 2026-06-09

This is a **production app** (Apple App Store v1.0 live, iOS 1.0.1 in review, Google Play closed testing). This document distinguishes **real risks** that need attention from **accepted tradeoffs** that are documented decisions. Items are grouped by category and prioritized by severity within each.

---

## Security Considerations

### Secrets committed in stack config (RESOLVED 09.06.2026)

- **Was:** Production secrets sat in the committed `portainer-stack.yml` (git history commits `891423a`, `cb4d437`).
- **Resolved:** All 4 live secrets rotated to distinct strong values on 09.06.2026 — `JWT_SECRET`, `QR_SECRET`, DB password, SMTP password (previously JWT=QR=SMTP were the *same* weak value `4@cZPbnxRh!@fvf#yY`). DB password changed via `ALTER USER` in `konfi_quest-postgres-1`; SMTP password via KeyHelp API on mailbox `noreply@konfi-quest.de`. Deployed via Portainer `update_stack`. Old git-history values are now worthless → no history rewrite needed.
- **State now:** `portainer-stack.yml` is gitignored (`.gitignore:121`) and was already out of tracking. Rotated values live in `~/.claude/secrets/konfi-quest-secrets.env` (chmod 600). Details: `memory/secrets_rotation_jun9.md`.
- **Note:** The committed file had drifted far from the live stack (different DB pw, SMTP user `team@` which doesn't even exist as a mailbox). Live stack (Portainer `konfi_quest` id 249) is the source of truth.
- The e2e file `docker-compose.e2e.yml` throwaway test values were never a concern.

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

### Large index chunk ~2.7MB (LOW — measured, low ROI on native)

- **Problem:** The main `index` chunk is ~2.7MB (gzip ~627KB), triggering Vite's single-large-chunk warning.
- **Measured (09.06.2026, rollup-plugin-visualizer raw-data):** The weight is **app code (~30 eager-loaded pages/views/modals), NOT vendor libs.** Swiper/axios/socket.io are noise by comparison. Ionic components are already lazy-split by Ionic itself; the qr-scanner worker is already a separate chunk.
- **Why the earlier `manualChunks` attempt "went badly":** vendor-chunking an app-code-heavy bundle yields almost nothing and risks init-order bugs (React/Ionic context loading in the wrong chunk → white screen). Confirmed dead end — do **not** retry vendor `manualChunks`.
- **Real lever:** route-based `React.lazy` on the ~30 pages via `IonRouterOutlet`. Note: heavy modals (e.g. `WrappedModal` with Swiper) are mounted via `useIonModal(Component,…)`, which needs a real component — lazy-ing them requires a Suspense wrapper, not a bare `React.lazy`.
- **ROI is low on a native app:** the bundle ships **inside the app package on-device** (Capacitor), it is not downloaded — so lazy-loading saves only parse/init time at cold start (~hundreds of ms on a modern phone), not network time. Worth doing only if (a) users report slow cold start, (b) it can be folded into larger frontend work, or (c) a **web build** is added (then the network argument applies). Until then: leave as-is, raise `build.chunkSizeWarningLimit` if the warning is noise.

---

## Platform / Native

### Capacitor 8 emulator renders black (LOW — not an app bug)

- **Problem:** On the Android emulator, the Capacitor WebView surface renders **black in screenshots** (GPU/surface capture issue), affecting the screenshot workflow only.
- **Cause:** Emulator GPU surface, not application code.
- **Workaround:** Use `fromSurface:false` in the CDP screenshot call. App renders correctly on **real devices** (verified in Pixel_9 emulator runtime: Konfi dashboard runs, no crashes — only screenshot capture is affected).
- **Action:** None on the app. Keep the CDP workaround documented for the screenshot toolkit.

### Version not versioned in git (RESOLVED 09.06.2026)

- **Was:** `frontend/android/` is gitignored, so the Android `versionCode` lived only locally and had to be hand-bumped + remembered before each build. iOS was already tracked (`project.pbxproj`) but versioned separately, so version numbers could drift between platforms.
- **Resolved:** Single tracked source of truth `frontend/version.json` (`{version, androidVersionCode, iosBuildNumber}`). Android `build.gradle` reads it directly via `JsonSlurper`. iOS gets `frontend/scripts/apply-version.sh` (uses `agvtool` to set `MARKETING_VERSION` + `CURRENT_PROJECT_VERSION` from the same file) — tested working on this Mac. Shared `version` keeps both platforms in lockstep; per-store build numbers stay separate (Apple/Google count independently: currently 11 vs 32).
- **Release flow now:** bump `version.json`, run `./scripts/apply-version.sh` before an iOS build; Android picks it up automatically at build time.

---

## Deployment / Operations

### Deploy automation (NOT A CONCERN — already automated)

- **Reality (verified 09.06.2026):** Deploy is already fully automated and test-gated. `ci.yml` runs backend+frontend tests → builds+pushes images → `curl`s a Portainer stack webhook (`${{ secrets.PORTAINER_WEBHOOK }}`, ci.yml:143-146) which makes the server pull `:latest` and redeploy. Tests red → no build → no webhook → no deploy.
- **Normal deploy = `git push origin main`.** Watch the GitHub Actions run; done. The `PORTAINER_WEBHOOK` secret was re-set + verified 09.06.2026 (endpoint returns HTTP 405 to GET = valid, wants POST).
- **Manual Portainer `update_stack` is only the fallback** for compose/secret changes without a code push (e.g. the 09.06. secret rotation). Details: `memory/deploy_webhook_auto.md`.

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

- **`badges` table:** ✅ **DROPPED 09.06.2026** — migration `090_drop_legacy_badges.sql` (applied live + recorded in `schema_migrations`). Was 0 rows, no FK, no code path. Active path is `custom_badges`.
- **`permissions` + `role_permissions`:** both 0 rows, intentionally unused (RBAC is role-based, not permission-granular). Harmless; can stay.
- **Token hygiene (optional, still open):** `refresh_tokens` ~145/213 revoked-or-expired (~232KB), `password_resets` 7 expired (harmless). Optional cleanup cron — low priority, non-blocking.

---

## Test Coverage Gaps / Test Infra

### Sporadic deadlock in `truncateAll` on parallel vitest runs (RESOLVED 09.06.2026)

- **Was:** Parallel multi-suite backend runs sporadically threw `deadlock detected` in `truncateAll` (two TRUNCATE-CASCADE statements from different suites locking the same ~45 tables in non-identical order). Previous workaround was `maxWorkers: 1` (serial → slow).
- **Resolved:** `truncateAll` now wraps the TRUNCATE in a transaction guarded by `pg_advisory_xact_lock` (`backend/tests/helpers/db.js`) — suites serialize their cleanup phase, so the deadlock is structurally impossible. `maxWorkers` raised back to 4 (parallel again → faster CI). Committed `b0cb739`. **Note:** there is no Docker on the dev Mac, so this is verified by CI, not locally (`memory/dev_no_docker_mac.md`).

### Pre-existing test-schema gap (LOW)

- A pre-existing globalSetup gap (`events.cancelled_at`, `event_unregistrations`) surfaced during Phase 114 work — **not** caused by feature code. Align the test schema bootstrap with the latest migrations.

---

## Severity Summary

**Resolved 09.06.2026:** secrets-in-git (rotated), version-not-versioned (version.json), deploy automation (was already automated), `badges` table (dropped, migration 090), vitest `truncateAll` deadlock (advisory lock). bird.png reclassified as intentional cross-app branding (not a concern).

**Still open — all accepted tradeoffs or low-ROI, nothing blocking:**

| Severity | Item | Type |
|----------|------|------|
| HIGH | react-router locked at v5 (Ionic v9 dependency) | Accepted (external lock) |
| MEDIUM | eslint 9 / react-hooks 5 pins | Accepted decision |
| LOW | ~2.7MB index chunk — app-code weight, low ROI on native | Measured, deferred |
| LOW | Capacitor 8 emulator black-screenshot (GPU) | Not an app bug |
| LOW | ~645 lint findings baseline | Tolerated (tsc is gate) |
| LOW | Single Postgres / no HA | Accepted for size |
| LOW | `permissions` / `role_permissions` unused tables; token-hygiene cron | Harmless / optional |

---

*Concerns audit: 2026-06-09 (resolutions appended same day)*
