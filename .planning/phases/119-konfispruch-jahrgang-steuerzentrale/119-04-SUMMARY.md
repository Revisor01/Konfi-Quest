---
phase: 119-konfispruch-jahrgang-steuerzentrale
plan: 04
status: complete
requirements: [SPRUCH-08]
checkpoint: human-verify (Task 3 — visuelle Pruefung der read-only KonfispruchSection in Konfi-Details)
---

# 119-04 SUMMARY — Admin-Einsicht Konfispruch (read-only)

## Was gebaut wurde

Der Admin sieht den gewaehlten Konfispruch eines Konfis in den Konfi-Details (read-only, SPRUCH-08 / D-06).

### Backend
- `backend/routes/konfi-management.js`: `GET /admin/konfis/:id` um die konfspruch-Daten erweitert (analog dem bestehenden Builder aus `konfi.js:486-522`). 15 konfspruch-Referenzen.
- `backend/tests/routes/konfi-management.test.js`: failing-first Tests fuer konfspruch im GET-Response (+72 Zeilen).

### Frontend
- `frontend/src/components/admin/views/KonfiDetailSections.tsx`: neue read-only `KonfispruchSection`-Komponente analog der bestehenden Detail-Sections (+56 Zeilen), keine Emojis, echte Umlaute.
- `frontend/src/components/admin/views/KonfiDetailView.tsx`: Einbindung der neuen Section (+7 Zeilen).

## Commits
- `4ed50d4` test(119-04): add failing tests for konfspruch in GET /admin/konfis/:id
- `fc44d52` feat(119-04): konfspruch in GET /admin/konfis/:id ergaenzen
- `3d10ad7` feat(119-04): read-only KonfispruchSection in Konfi-Details (Admin)

## Self-Check

- [x] Backend GET liefert konfspruch-Daten (Builder uebernommen)
- [x] Frontend read-only Section vorhanden (KonfispruchSection)
- [x] Keine Emojis, echte Umlaute
- [ ] Human-Verify (Task 3): visuelle Pruefung der Section in den Konfi-Details — OFFEN

## Hinweise

- Backend-vitest laeuft nur in CI (kein lokales Docker auf diesem Mac) — Tests syntaktisch valide, Ausfuehrung in CI.
- Der Executor lief nach dem letzten Code-Commit (`3d10ad7`) ins Session-Limit, bevor diese SUMMARY committet werden konnte. Code-Arbeit ist vollstaendig; SUMMARY vom Orchestrator nachgezogen.
- Task 3 ist ein human-verify-Checkpoint (siehe oben).
