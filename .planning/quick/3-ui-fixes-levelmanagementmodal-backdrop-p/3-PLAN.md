---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/contexts/ModalContext.tsx
autonomous: true
requirements: [UI-FIX-LEVEL-BACKDROP]

must_haves:
  truths:
    - "LevelManagementModal oeffnet auf iOS mit korrektem Backdrop und Sheet-Effekt"
    - "presentingElement ist definiert wenn AdminLevelsPage ein Modal oeffnet"
  artifacts:
    - path: "frontend/src/contexts/ModalContext.tsx"
      provides: "Route-Mapping fuer admin-levels"
      contains: "admin-levels"
  key_links:
    - from: "frontend/src/contexts/ModalContext.tsx"
      to: "frontend/src/components/admin/pages/AdminLevelsPage.tsx"
      via: "tabId 'admin-levels' Registrierung und Route-Mapping"
      pattern: "admin-levels"
---

<objective>
Fix: LevelManagementModal Backdrop funktioniert nicht auf iOS

Das Problem: AdminLevelsPage registriert sich im ModalContext mit tabId `admin-levels`, aber die Route `/admin/settings/levels` hat keinen Eintrag in der `getCurrentPresentingElement` Funktion von ModalContext.tsx. Dadurch wird `presentingElement` als `undefined` zurueckgegeben und der iOS Sheet/Backdrop-Effekt fehlt.

Die Route `/admin/settings/levels` faellt aktuell in den generischen `/admin/settings` Check (Zeile 60), der `admin-settings` zurueckgibt - aber AdminLevelsPage ist als `admin-levels` registriert. Dieser Mismatch muss behoben werden.

Purpose: iOS-Nutzer sehen keinen Backdrop beim Oeffnen des LevelManagementModal
Output: Korrigierter ModalContext mit Route-Mapping fuer admin-levels
</objective>

<execution_context>
@/Users/simonluthe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/simonluthe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/contexts/ModalContext.tsx
@frontend/src/components/admin/pages/AdminLevelsPage.tsx
</context>

<interfaces>
<!-- Aus ModalContext.tsx: -->
```typescript
// getCurrentPresentingElement() mappt Routes zu tabIds.
// AdminLevelsPage registriert sich als:
const { pageRef, presentingElement } = useModalPage('admin-levels');
// Route ist: /admin/settings/levels (aus MainTabs.tsx)
```
</interfaces>

<tasks>

<task type="auto">
  <name>Task 1: Route-Mapping fuer admin-levels in ModalContext ergaenzen</name>
  <files>frontend/src/contexts/ModalContext.tsx</files>
  <action>
In der Funktion `getCurrentPresentingElement()` in ModalContext.tsx einen neuen Eintrag VOR dem generischen `/admin/settings` Check (Zeile 60) einfuegen:

```
else if (currentPath.includes('/admin/settings/levels')) currentTabId = 'admin-levels';
```

WICHTIG: Der Eintrag MUSS vor `else if (currentPath.includes('/admin/settings'))` stehen, da `/admin/settings` ein Prefix-Match ist und sonst zuerst greift. Die Reihenfolge der bestehenden spezifischeren Checks (categories, jahrgaenge) zeigt das Pattern bereits korrekt.

Konkret: Nach Zeile 59 (`admin-jahrgaenge`) und vor Zeile 60 (`admin-settings`) einfuegen.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit 2>&1 | head -20</automated>
  </verify>
  <done>ModalContext.tsx enthaelt Route-Mapping `/admin/settings/levels` -> `admin-levels`, TypeScript kompiliert ohne Fehler, Eintrag steht vor dem generischen `/admin/settings` Check</done>
</task>

</tasks>

<verification>
- grep "admin-levels" frontend/src/contexts/ModalContext.tsx zeigt den neuen Eintrag
- grep -n "settings/levels" frontend/src/contexts/ModalContext.tsx zeigt Zeile VOR "settings'" generischem Check
- TypeScript kompiliert fehlerfrei
</verification>

<success_criteria>
- ModalContext mappt /admin/settings/levels korrekt auf admin-levels tabId
- presentingElement ist definiert wenn LevelManagementModal geoeffnet wird
- iOS Backdrop/Sheet-Effekt funktioniert im LevelManagementModal
</success_criteria>

<output>
After completion, create `.planning/quick/3-ui-fixes-levelmanagementmodal-backdrop-p/3-SUMMARY.md`
</output>
