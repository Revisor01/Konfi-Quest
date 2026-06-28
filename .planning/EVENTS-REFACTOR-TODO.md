# Events/Material-Vereinheitlichung — Fahrplan (Stand 28.06.2026)

Branch: `refactor/events-unified` (abgezweigt von `feature/ipad-splitview-konfis`).

Ziel: Alle drei Rollen (Konfi/Admin/Teamer) nutzen dieselben gemeinsamen
Bausteine. Was WIRKLICH gemeinsam ist → shared. Was rollenspezifisch ist
(Status-Logik, Aktionen, Tab-Filter) → bleibt getrennt (das ist KEINE Schwäche,
sondern korrekt: jede Rolle sieht ein Event anders).

---

## ✅ ERLEDIGT

1. **shared/SplitViewShell.tsx** + `useIsWideScreen`-Hook
   - Die 4 Split-View-Wrapper (AdminKonfis, Chat, AdminEvents, KonfiEvents)
     nutzen sie bereits.
2. **shared/eventFormatting.ts** — `formatEventDate/Time/DateLong`
   - In allen 5 Views/DetailViews + Teamer per Alias-Import eingebunden.
   - `formatEventTime` mit Guards (leer/ungültig → '') vereinheitlicht.
   - Unit-Tests: `__tests__/components/shared/eventFormatting.test.ts`.
3. **shared/EventCornerBadges.tsx** — Team/Konfirmation/Pflicht/Status-Badges
   - **Admin-EventsView bereits umgestellt.**

---

## OFFEN — Card-Bausteine angleichen

### A) Konfi-EventsView auf EventCornerBadges umstellen
- Datei: `src/components/konfi/views/EventsView.tsx`
- Stelle: Badge-Block ab **Z.338** (`<div className="app-corner-badges" ...>`).
- ACHTUNG Konfi-Sonderfall: Konfi blendet den Status-Badge teils aus
  (`showBadge`-Bedingung). → `EventCornerBadges` mit `showStatus={showBadge}`
  aufrufen. Konfirmations-/Pflicht-Badge bleiben über die event-Flags.
- Import `EventCornerBadges` aus `'../../shared'` ergänzen.
- Danach prüfen, ob `people`/`flame`/`shieldCheckmark`/`StatusBadge` noch
  anderweitig genutzt werden (sonst Import entfernen).

### B) Teamer-EventsView auf EventCornerBadges umstellen
- Datei: `src/components/teamer/pages/TeamerEventsPage.tsx`
- Stelle: Badge-Block ab **Z.886**.
- Gleiches Vorgehen wie Konfi (showStatus über die dortige showBadge-Logik).

---

## OFFEN — Teamer-Eigenheiten angleichen (das "völlig andere" Teamer-Muster)

### C) Teamer-Events: eigenes useIsWide → Shell-Hook
- Datei: `src/components/teamer/pages/TeamerEventsPage.tsx`, **Z.91-103**.
- Teamer hat seine EIGENE matchMedia-Logik + ion-page-invisible-Cleanup
  inline. Stattdessen `useIsWideScreen` aus `'../../shared'` nutzen und das
  Split-Layout (Z.1026 ff.) auf `SplitViewShell` umstellen (wie die anderen
  Wrapper). Spart die duplizierte isWide/Cleanup-Logik.
- HINWEIS: Teamer-Events ist die EINZIGE Rolle mit In-Page-State-Detail
  (selectedEvent) statt Route+Detail-Page. Mittelfristig angleichen: Detail in
  eine eigene `TeamerEventDetailView` (eventId+onBack) ziehen wie Konfi/Admin,
  dann den normalen SplitView-Wrapper bauen. Das ist der größere Brocken.

### D) Teamer-Material: gleiches Muster wie Teamer-Events anwenden  ← USER-WUNSCH
- Datei: `src/components/teamer/pages/TeamerMaterialPage.tsx` (561 Z.)
- Auch hier In-Page-State-Detail: `selectedMaterial` (Z.96), Detail-Block ab
  **Z.214** (`if (selectedMaterial) { ... }`), Liste danach.
- TODO:
  1. Detail-Block + Liste in `renderDetail()`/`renderList()` kapseln (wie bei
     TeamerEventsPage in Commit 009b721 vorgemacht).
  2. SplitViewShell + useIsWideScreen einführen (Material-Liste links,
     Datei-Detail rechts).
  3. Detail-Zurück-Button im Split-Modus ausblenden (hideBackButton-Muster).
- Admin-Material (`AdminMaterialPage`) bleibt Modal-basiert (CRUD) → KEIN
  Split-View dort (anderes Pattern, wie Anträge).

---

## BEWUSST NICHT VEREINHEITLICHT (rollenspezifisch korrekt)

- **Status-Logik** (`getStatusColors`/`getStatusText`): fundamental verschieden
  pro Rolle (Konfi: Pflicht/Opt-Out/Anwesenheit/Warteliste-Position/
  Konfirmation-Sperre, ~22 Zweige; Teamer: Dabei/"Nur Info"/Team, ~9 Zweige;
  Admin: Verbuchen-Status). Verschiedene event-Felder. Eine unified-Funktion
  wäre ein if(role)-Monster — schlechter als 3 klare Funktionen. LASSEN.
- **Aktionen**: Konfi register/opt-out, Teamer book/unbook, Admin CRUD+Serien+
  Teilnehmer-Verwaltung. LASSEN.
- **Tab-Filter**: Konfi (meine/alle/konfirmation), Admin (aktuell/verbuchen/
  vergangen), Teamer (alle/meine/team) — verschiedene Semantik. LASSEN.

---

## SONSTIGES / HYGIENE

- `.gitignore`: `build_ios/`, `frontend/ios/App/build_archive/`,
  `frontend/ios/App/build_export/` und die `*.png`-Screenshots im Repo-Root
  gehören ignoriert (liegen aktuell untracked rum).
- Anträge-iPad: bleibt volle Breite + Modal (kein Split). Optional später:
  zentrierte max-width-Spalte für Modal-Listen (Badges/Material/Anträge/CRUD).
- Branch-Stand vor Merge: Split-View-Branch (Konfis/Chat/Events) + dieser
  Refactor-Branch sollten am echten iPad getestet werden, bevor → main.
