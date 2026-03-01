# Phase 2: Bug-Fixes und Theme-Stabilisierung - Context

**Gathered:** 2026-02-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Bekannte Bugs beheben und Theme-Konfiguration stabilisieren. iOS bekommt iOS 26 Theme, Android bekommt MD3 Theme, ohne Kollisionen. Kein visuelles Redesign oder Design-Angleich -- das ist Scope von Phase 3-5.

Requirements: BUG-01, BUG-02, BUG-03, BUG-04, THM-01, THM-02, THM-03, THM-04

</domain>

<decisions>
## Implementation Decisions

### TabBar-Fix (BUG-01, THM-04)
- `registerTabBarEffect` aus `@rdlabo/ionic-theme-ios26` komplett entfernen (JS-Import + useEffect in MainTabs.tsx)
- Durch eigenes CSS ersetzen: `backdrop-filter: blur()` fuer transluzenten iOS 26 TabBar-Look
- iOS26 Library bleibt als Dependency -- nur der JS-basierte TabBar-Effect wird ersetzt
- CSS-Styles der Library fuer die TabBar (Floating-Style, kompakte Darstellung) weiterhin nutzen
- Fix betrifft nur iOS -- Android TabBar bleibt unveraendert
- Ionic 8.7 hat noch kein eingebautes iOS 26 Theme (Issue #30466 offen), daher bleibt @rdlabo/ionic-theme-ios26 der Standard

### Theme-Konfiguration (THM-01, THM-02, THM-03)
- Ionic 8 erkennt die Plattform automatisch (.ios / .md Klassen) -- kein manuelles CSS-Switching noetig
- Beide Theme-CSS-Dateien bleiben bedingungslos geladen (Library isoliert intern per Plattform-Klassen)
- JS-Animationen sind bereits plattformspezifisch konfiguriert (iosTransitionAnimation vs mdTransitionAnimation in App.tsx)
- Ansatz: Testen und nur bei Bedarf fixen -- keine proaktive Variablen-Isolation
- Phase 2 = technische Korrektheit der Theme-Konfiguration, kein visuelles Redesign

### Badge-Punkte Verifikation (BUG-02)
- Code-Review aller relevanten Endpoints (Dashboard, Profile, Points-History) auf Double-Count-Risiko
- Live-Daten-Abgleich via SSH + Docker psql gegen die produktive Datenbank
- Verifikation: konfi_profiles.gottesdienst_points/gemeinde_points enthaelt bereits Aktivitaets- + Event- + Bonus-Punkte (akkumuliert)
- Bei Unstimmigkeiten: DB-Daten direkt korrigieren UND Code fixen
- Zugriff: ssh root@server.godsapp.de -> docker exec in Postgres-Container

### Deprecated dateUtils (BUG-03)
- `parseGermanTime` und `getGermanNow` aus dateUtils.ts entfernen
- Funktionen werden aktuell nirgends im Codebase aufgerufen -- reines Cleanup
- Alle Code soll `parseLocalTime()` bzw. `getLocalNow()` verwenden

### UI-Fehler Durchgang (BUG-04)
- Code-basierter Review aller Views/Pages auf typische Probleme (fehlende safe-area, hardcodierte Hoehen, overflow)
- Keine manuelle App-Durchklickung -- Code-Analyse reicht
- Keine bekannten visuellen Bugs ausser dem TabBar-Problem
- Design-Angleich (gleiche Listen, Layouts, Farblogiken) ist NICHT Phase 2 Scope -- das kommt in Phase 3-5

### Claude's Discretion
- Konkretes CSS fuer den iOS TabBar blur-Effekt (backdrop-filter Werte, Farben, Transparenz)
- Welche Theme-Variablen ggf. angepasst werden muessen falls Konflikte gefunden werden
- Umfang des Code-Reviews bei BUG-04 (welche Views prioritaer geprueft werden)
- SQL-Queries fuer den Live-Daten-Abgleich bei BUG-02

</decisions>

<specifics>
## Specific Ideas

- iOS26 TabBar soll bestmoeglich dem nativen iOS 26 Look entsprechen (transluzent, blur)
- Die @rdlabo/ionic-theme-ios26 Library ist der Standard fuer das Projekt und bleibt erhalten
- Layout ist plattformuebergreifend identisch (ein Codebase), Ionic macht den Rest per .ios/.md Klassen

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@rdlabo/ionic-theme-ios26`: CSS-Styles fuer iOS 26 Look (behalten), JS registerTabBarEffect (entfernen)
- `@rdlabo/ionic-theme-md3`: MD3 Styling fuer Android (unveraendert)
- `frontend/src/utils/dateUtils.ts`: Aktuelle Funktionen (parseLocalTime, getLocalNow, formatDate) -- deprecated Funktionen entfernen
- `frontend/src/theme/variables.css`: Zentrale CSS-Variablen und Utility-Klassen (app-card, app-list-item, etc.)

### Established Patterns
- Plattform-Detection: `isPlatform('ios')` in App.tsx fuer JS-Animationen, CSS per .ios/.md Klassen
- Theme-Imports: Beide Themes in variables.css geladen, intern plattform-isoliert
- TabBar: useEffect + useRef Pattern in MainTabs.tsx fuer Effect-Lifecycle
- Punkte-Akkumulation: konfi_profiles speichert Gesamt-Punkte (inkl. Bonus), bonus_points Tabelle fuer Audit-Trail

### Integration Points
- `MainTabs.tsx:29,155-169`: registerTabBarEffect Import und useEffect -- hier wird der Fix angewandt
- `App.tsx:28-83`: Theme-Animation-Konfiguration in setupIonicReact
- `variables.css:4-11`: Theme CSS Imports
- `backend/routes/konfi.js:115-124`: Dashboard Punkte-Berechnung
- `backend/routes/konfi.js:506-520`: Points-History Berechnung
- `dateUtils.ts:118-133`: Deprecated Funktionen zum Entfernen

</code_context>

<deferred>
## Deferred Ideas

- Design-Angleich aller Views (gleiche Listen, Layouts, Farblogiken) -- Phase 3-5 Scope
- Proaktive CSS-Variablen-Isolation zwischen iOS26 und MD3 -- nur bei Bedarf in Phase 2

</deferred>

---

*Phase: 02-bug-fixes-und-theme-stabilisierung*
*Context gathered: 2026-02-28*
