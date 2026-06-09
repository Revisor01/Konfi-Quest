---
phase: 119-konfispruch-jahrgang-steuerzentrale
plan: 03
subsystem: frontend
tags: [jahrgang, konfispruch, wrapped, dashboard, admin]
requires:
  - "119-01: Backend akzeptiert konfspruch_enabled, kein confirmation_date"
  - "119-02: konfspruch_visible im /konfi/dashboard"
provides:
  - "Jahrgang-Steuerzentrale (Modal: Punkte + Konfispruch + Wrapped)"
  - "Konfispruch-Card-Gate (konfspruch_visible)"
affects:
  - frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx
  - frontend/src/components/konfi/views/DashboardView.tsx
  - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
tech-stack:
  added: []
  patterns:
    - "useIonModal-Muster (unangetastet)"
    - "useIonAlert-Warnhinweise vor destruktiven/sichtbaren Aktionen"
    - "app-toggle--jahrgang Toggle-Reihen"
key-files:
  created: []
  modified:
    - frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx
    - frontend/src/components/konfi/views/DashboardView.tsx
    - frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
decisions:
  - "Wrapped-Toggle nur bei bestehendem Jahrgang (jahrgang != null) sichtbar"
  - "wrappedReleasedAt als lokaler Modal-State: Toggle zeigt sofort neuen Stand, Modal bleibt offen"
  - "konfspruch_visible wird in KonfiDashboardPage via Spread durchgereicht (kein expliziter Merge noetig)"
  - "Card-Gate prueft strikt === true (return null bei false/undefined)"
metrics:
  duration: ~15min
  completed: 2026-06-09
  tasks: 2
  files: 3
---

# Phase 119 Plan 03: Jahrgang-Steuerzentrale + Konfispruch-Card-Gate Summary

Jahrgang-Modal wird zur zentralen Steuerstelle (Punkteziele + Konfispruch-Freischaltung + Wrapped-Freigabe), Konfirmationsdatum-Feld komplett entfernt, Konfispruch-Card im Konfi-Dashboard haengt nun am konfspruch_visible-Flag.

## Was gebaut wurde

### Task 1 — Jahrgang-Modal (AdminJahrgaengeePage.tsx)
- Jahrgang-Interface: `confirmation_date` entfernt, `konfspruch_enabled?: boolean` + `wrapped_released_at?: string | null` ergaenzt.
- formData / useEffect-Init / Reset: confirmation_date raus, `konfspruch_enabled` (Default true) rein.
- handleSubmit: confirmation_date-Pflichtcheck + Payload-Feld entfernt, `konfspruch_enabled` in Payload. Submit-Disabled-Bedingung bereinigt.
- Konfirmationsdatum-IonItem + kompletter IonDatetime/IonModal-Block entfernt; Imports (`IonDatetime`, `IonDatetimeButton`, `IonModal`-Komponente, `calendar`) entfernt.
- Neue Card "Konfispruch & Wrapped": Toggle `konfspruch_enabled` (app-toggle--jahrgang) + Wrapped-Freigabe-Toggle.
- Wrapped-Toggle-Logik (D-Wrapped-1): `checked = !!wrappedReleasedAt`. Einschalten -> presentAlert-Warnhinweis (Push erwaehnt) -> `POST /admin/wrapped/generate/:id` -> lokaler State + onRefresh. Ausschalten -> presentAlert -> `DELETE /admin/wrapped/:id` -> State + onRefresh. Toggle nur bei bestehendem Jahrgang sichtbar.
- Erklaertext im Modal erweitert (steuert Punkteziele, Konfispruch-Freischaltung, Wrapped-Freigabe).

### Task 2 — Liste + Card-Gate
- Jahrgang-Liste: confirmation_date-Meta ersetzt durch Punkteziele (GD-/Gem-Ziel, nur aktive Typen), Spruch-Freigabe (checkmarkCircle/closeCircle), Wrapped-Status ("Wrapped gestartet am <de-DE Datum>" bzw. "nicht freigegeben", trophy-Icon). IonIcons aus ionicons/icons, keine Emojis.
- DashboardView: `konfspruch_visible?: boolean` im DashboardData-Interface; konfispruch-Renderer gibt `null` zurueck wenn `konfspruch_visible !== true` (Card komplett weg, D-02).
- KonfiDashboardPage: `konfspruch_visible?: boolean` im DashboardData-Interface; Feld kommt aus /konfi/dashboard (119-02) und wird ueber den bestehenden Spread `...dashboardData` an DashboardView durchgereicht.

## Verifikation
- `npx tsc --noEmit -p tsconfig.json` — keine Fehler in AdminJahrgaengeePage / DashboardView / KonfiDashboardPage.
- grep: `konfspruch_enabled` (7x) + `wrapped/generate` (1x) vorhanden, `confirmation_date` (0x) in Admin-Datei.
- grep: `konfspruch_visible` in DashboardView + KonfiDashboardPage; `wrapped_released_at` in Admin.
- Emoji-Scan ueber alle drei Dateien: keine Unicode-Emojis.

## Deviations from Plan
None - Plan wurde wie geschrieben ausgefuehrt. (Hinweis: Der Listen-Umbau der Admin-Datei aus Task 2 wurde gemeinsam mit Task 1 committet, weil beide dieselbe Datei betreffen und der Listen-Umbau das letzte `confirmation_date`-Vorkommen entfernt — Task-1-Verify `! grep confirmation_date` waere sonst rot. Der Dashboard-Teil von Task 2 ist als eigener Commit getrennt.)

## Commits
- aedb5ea: feat(119-03): Jahrgang-Steuerzentrale — Konfispruch- + Wrapped-Toggle, Liste, kein Konfirmationsdatum
- 067d851: feat(119-03): Konfispruch-Card-Gate im Konfi-Dashboard

## Checkpoint
Plan ist `autonomous: false`. Nach Task 2 folgt ein `checkpoint:human-verify` (visuelle Pruefung Jahrgang-Modal / Card-Gate / Wrapped-Toggle / Konfirmationstermin-Sicht-Check W3). Dieser erfordert einen Xcode-Build (auf diesem Mac nicht automatisierbar — kein cap-sync/Xcode non-interaktiv). Die autonome Arbeit bis zum Checkpoint ist vollstaendig committet.

## Self-Check: PASSED
- frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx: FOUND
- frontend/src/components/konfi/views/DashboardView.tsx: FOUND
- frontend/src/components/konfi/pages/KonfiDashboardPage.tsx: FOUND
- Commit aedb5ea: FOUND
- Commit 067d851: FOUND
