---
phase: 05-admin-views-erweitert
plan: 02
subsystem: ui
tags: [css, ionic, react, design-system, inline-styles, stepper, settings]

requires:
  - phase: 05-admin-views-erweitert
    plan: 01
    provides: app-icon-color--* Klassen, app-stepper, app-avatar-initials, app-item-transparent, app-swipe-actions CSS-Klassen
provides:
  - Bereinigte GoalsPage mit app-stepper CSS-Klassen (4 Inline-Styles)
  - Bereinigte InvitePage mit app-list-inner und app-button-row (15 Inline-Styles, Rest dynamisch/QR-spezifisch)
  - Modernisierte SettingsPage mit Profil-Block und app-flex-fill (4 Inline-Styles)
  - Bereinigte LevelsPage mit app-item-transparent und app-swipe-actions (4 Inline-Styles)
  - Neue CSS-Klassen app-condense-toolbar, app-list-item__title--with-badge, app-list-inner, app-button-row, app-flex-fill
  - app-list-item erweitert um position:relative und width:100%
affects: [05-03, alle Views mit Condense-Toolbar, alle Views mit Corner-Badges]

tech-stack:
  added: []
  patterns: [condense-toolbar-klasse, title-with-badge-modifier, flex-fill-utility, list-inner-utility, button-row-utility]

key-files:
  created: []
  modified:
    - frontend/src/components/admin/pages/AdminGoalsPage.tsx
    - frontend/src/components/admin/pages/AdminInvitePage.tsx
    - frontend/src/components/admin/pages/AdminSettingsPage.tsx
    - frontend/src/components/admin/pages/AdminLevelsPage.tsx
    - frontend/src/theme/variables.css

key-decisions:
  - "app-condense-toolbar als wiederverwendbare Klasse fuer transparente Large-Title Toolbars (19 Vorkommen im Projekt)"
  - "app-list-item um position:relative und width:100% erweitert fuer Corner-Badge-Kompatibilitaet"
  - "InvitePage dynamische/QR-spezifische Styles bleiben inline (15 verbleibend, alle legitimiert)"
  - "Neuer Profil-Block in SettingsPage mit app-avatar-initials statt app-detail-header (zu gross fuer Settings)"

patterns-established:
  - "Condense-Toolbar: app-condense-toolbar statt inline --background/--color auf IonToolbar"
  - "Title mit Badge: app-list-item__title--with-badge statt inline paddingRight"
  - "Flex-Fill: app-flex-fill statt inline flex:1 auf Container-Divs"
  - "Innere IonList: app-list-inner statt inline background:transparent/padding:0"
  - "Button-Reihe: app-button-row statt inline display:flex/gap/flex:1"

requirements-completed: [ADM-09, ADM-10, ADM-11, ADM-12]

duration: 9min
completed: 2026-03-02
---

# Phase 5 Plan 2: GoalsPage, InvitePage, SettingsPage und LevelsPage Inline-Styles Bereinigung Summary

**GoalsPage Stepper auf app-stepper CSS-Klassen, SettingsPage mit neuem Profil-Block, LevelsPage auf Utility-Klassen; 5 neue wiederverwendbare CSS-Klassen in variables.css**

## Performance

- **Duration:** 9 min
- **Started:** 2026-03-02T11:03:43Z
- **Completed:** 2026-03-02T11:12:55Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- GoalsPage: 2 Stepper-Sektionen (Gottesdienst + Gemeinde) auf app-stepper/app-stepper__value/app-stepper__button umgestellt (19 -> 4 Inline-Styles)
- SettingsPage: Neuer Profil-Block mit Initialen-Avatar, Rollen-Anzeige und Organisation (26 -> 4 Inline-Styles)
- LevelsPage: IonItem-Wrapper auf app-item-transparent, Swipe-Actions auf CSS-Klassen (10 -> 4 Inline-Styles)
- InvitePage: IonList-Margins, innere Listen und Button-Reihe auf CSS-Klassen (27 -> 15 Inline-Styles)
- 5 neue wiederverwendbare CSS-Utility-Klassen fuer das gesamte Projekt

## Task Commits

Each task was committed atomically:

1. **Task 1: AdminGoalsPage Stepper auf app-stepper und AdminInvitePage bereinigen** - `5d721aa` (feat)
2. **Task 2: AdminSettingsPage Profil-Block modernisieren und AdminLevelsPage bereinigen** - `634c133` (feat)

## Files Created/Modified
- `frontend/src/components/admin/pages/AdminGoalsPage.tsx` - Stepper auf CSS-Klassen, IonList margin durch app-segment-wrapper
- `frontend/src/components/admin/pages/AdminInvitePage.tsx` - IonList margin, innere Listen, Button-Reihe und Title-Badge auf CSS-Klassen
- `frontend/src/components/admin/pages/AdminSettingsPage.tsx` - Neuer Profil-Block, flex:1 durch app-flex-fill, Condense-Toolbar-Klasse
- `frontend/src/components/admin/pages/AdminLevelsPage.tsx` - IonItem auf app-item-transparent, Swipe-Actions auf CSS-Klassen, Condense-Toolbar-Klasse
- `frontend/src/theme/variables.css` - 5 neue CSS-Klassen, app-list-item Erweiterung

## Decisions Made
- app-condense-toolbar als wiederverwendbare Klasse fuer transparente Large-Title Toolbars erstellt (Pattern kommt 19x im Projekt vor)
- app-list-item Basisklasse um position:relative und width:100% erweitert, da Corner-Badges und IonItem-Wrapper dies ueberall benoetigen
- InvitePage dynamische Styles (isExpired-basierte Farben) und einmalige QR-Code-Styles bleiben inline -- nur wiederverwendbare Patterns migriert
- Profil-Block in SettingsPage nutzt app-avatar-initials statt app-detail-header (Letzteres hat min-height 200px, zu gross fuer Settings)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] app-condense-toolbar CSS-Klasse fuer transparente Condense-Toolbars**
- **Found during:** Task 2
- **Issue:** Das Condense-Toolbar-Pattern (--background: transparent, --color: black + color: black auf IonTitle) war in 19 Dateien als Inline-Styles dupliziert
- **Fix:** Neue CSS-Klasse app-condense-toolbar und Selektor fuer ion-title in variables.css
- **Files modified:** frontend/src/theme/variables.css
- **Verification:** LevelsPage und SettingsPage nutzen die Klasse, TypeScript kompiliert fehlerfrei
- **Committed in:** 634c133 (Task 2 commit)

**2. [Rule 2 - Missing Critical] app-list-item__title--with-badge Modifier**
- **Found during:** Task 2
- **Issue:** paddingRight: '50px' fuer Corner-Badge-Kompatibilitaet war in 7 Dateien als Inline-Style dupliziert
- **Fix:** Neue CSS-Modifier-Klasse app-list-item__title--with-badge
- **Files modified:** frontend/src/theme/variables.css
- **Verification:** LevelsPage und InvitePage nutzen die Klasse
- **Committed in:** 634c133 (Task 2 commit)

**3. [Rule 2 - Missing Critical] app-list-item Erweiterung um position:relative und width:100%**
- **Found during:** Task 2
- **Issue:** Viele list-items mit Corner Badges brauchten position:relative und width:100% als Inline-Styles
- **Fix:** Beide Properties direkt in die app-list-item Basisklasse aufgenommen
- **Files modified:** frontend/src/theme/variables.css
- **Verification:** LevelsPage list-item braucht nur noch borderLeftColor als Inline-Style
- **Committed in:** 634c133 (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (3 missing critical)
**Impact on plan:** Alle Auto-Fixes waren notwendig um die Inline-Style-Ziele zu erreichen. Die neuen Klassen sind wiederverwendbar fuer alle Views.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Alle 4 Admin-Pages bereinigt und unter 5 Inline-Styles (ausser InvitePage mit 15 dynamischen/einmaligen Styles)
- app-condense-toolbar Klasse bereit fuer Anwendung in allen 19 Dateien mit Condense-Toolbars
- app-list-item__title--with-badge bereit fuer Anwendung in allen 7 Dateien mit Corner-Badge-Titeln
- Bereit fuer Plan 05-03 (weitere Detail-View Bereinigungen)

---
*Phase: 05-admin-views-erweitert*
*Completed: 2026-03-02*
