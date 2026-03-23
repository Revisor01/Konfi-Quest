# Coding Conventions

**Analysis Date:** 2026-03-23

## Naming Patterns

**Files:**
- React-Komponenten: PascalCase, z.B. `EventsView.tsx`, `KonfiDashboardPage.tsx`, `ActivityModal.tsx`
- Hooks: camelCase mit `use`-Prefix, z.B. `useOfflineQuery.ts`, `useActionGuard.ts`
- Services/Utils: camelCase, z.B. `tokenStore.ts`, `writeQueue.ts`, `networkMonitor.ts`
- Backend-Routes: kebab-case für Mehrwort-Dateien, z.B. `konfi-management.js`, `event.js`
- CSS-Klassen: BEM-ähnlich mit `app-` Prefix, z.B. `.app-header-banner`, `.app-list-item__title`

**Verzeichnisstruktur-Konvention:**
- Rollenbasierte Trennung: `admin/`, `konfi/`, `teamer/`, `chat/`, `wrapped/`
- Unter jeder Rolle: `pages/`, `views/`, `modals/`
- Seiten (Pages) enthalten Routing-Logik + Data-Fetching
- Views sind reine Darstellungskomponenten, erhalten Props
- Modals werden immer per `useIonModal` geöffnet

**Komponenten-Benennung:**
- Pages: `{Rolle}{Funktion}Page.tsx` — z.B. `KonfiDashboardPage.tsx`, `TeamerEventsPage.tsx`
- Views: `{Funktion}View.tsx` — z.B. `EventsView.tsx`, `DashboardView.tsx`
- Modals: `{Funktion}Modal.tsx` — z.B. `ActivityModal.tsx`, `EventModal.tsx`
- Shared-Komponenten: kurze, generische Namen — z.B. `SectionHeader.tsx`, `EmptyState.tsx`, `ListSection.tsx`

**TypeScript-Typen:**
- Interfaces: PascalCase mit `I`-freiem Prefix, z.B. `Event`, `BaseUser`, `QueueItem`
- Props-Interfaces: `{KomponentenName}Props`, z.B. `EventsViewProps`, `ActivityModalProps`
- Zentrale Typen in `src/types/`: `event.ts`, `user.ts`, `dashboard.ts`, etc.

**Backend-Funktionen:**
- Route-Handler: anonyme `async (req, res) =>` Funktionen direkt in `router.get/post/put/delete`
- Hilfsfunktionen: camelCase, z.B. `generateResetToken()`, `hashToken()`, `sendTokenToServer()`
- Validierungsregel-Arrays: `validate{Aktion}{Ressource}`, z.B. `validateCreateActivity`, `validateLogin`

## Code Style

**Formatierung:**
- Kein dediziertes Prettier-Config — Formatierung via TypeScript/ESLint
- 2-Spaces Einrückung (implizit durch ESLint)
- Semikolons: keine (TypeScript-ESLint Standard)
- Anführungszeichen: einfach im JSX-freien Code, doppelt in JSX-Attributen

**Linting:**
- ESLint mit `typescript-eslint` + `eslint-plugin-react-hooks` + `eslint-plugin-react-refresh`
- Konfiguration: `frontend/eslint.config.js`
- `no-console`: in Produktion `warn`, in Entwicklung `off`
- `react-hooks/rules-of-hooks` und `react-hooks/exhaustive-deps` aktiv

**TypeScript:**
- Strict Mode aktiviert (`"strict": true` in `frontend/tsconfig.json`)
- `allowJs: false` — reines TypeScript im Frontend
- Target: ESNext
- `any` wird vereinzelt verwendet (26 Vorkommen), bevorzugt für schnell wechselnde API-Daten

## Import-Organisation

**Reihenfolge in TSX-Dateien (implizit):**
1. React-Imports (`import React, { useState, ... } from 'react'`)
2. Ionic-Komponenten (`from '@ionic/react'`, `from 'ionicons/icons'`)
3. Interne Hooks und Contexts (`from '../../../hooks/...'`, `from '../../../contexts/...'`)
4. Services (`from '../../../services/...'`)
5. Shared-Komponenten (`from '../../shared'`)
6. Typen (`from '../../../types/...'`)

**Barrel-Files:**
- Nur `src/components/shared/index.ts` existiert als Barrel-Export
- Direkte Imports sonst überall bevorzugt

**Pfad-Aliases:**
- Keine konfigurierten Aliases — alle Imports sind relative Pfade

## Fehlerbehandlung

**Frontend:**
- API-Fehler werden über den `AppContext` (`setError`) als Toast angezeigt
- `useOfflineQuery` kapselt Lade-/Fehler-/Stale-States für alle Datenabrufe
- `useActionGuard` verhindert doppeltes Absenden von Formularen
- Fallback-Daten bei Offline-Zustand: gecachte Daten bleiben sichtbar, `isStale` Flag
- Kritische Fehler: `console.error()` mit deutschen Fehlermeldungen

**Backend:**
- Jeder Route-Handler in `try/catch` eingewickelt
- Fehler-Response: `res.status(500).json({ error: 'Datenbankfehler' })`
- Validierungsfehler: `res.status(400).json({ error: 'Validierungsfehler', details: [...] })`
- Auth-Fehler: `res.status(401).json({ error: '...' })`
- Input-Validierung immer vor Business-Logik per `express-validator` + `handleValidationErrors` Middleware
- `console.error` mit Pfadangabe beim DB-Fehler, z.B. `'Database error in POST /api/activities/:'`

## Logging

**Frontend:**
- `console.warn()` für recoverable Fehler und Offline-Warnungen
- `console.error()` für unerwartete Fehler in catch-Blöcken
- Keine strukturierten Logging-Bibliotheken
- Logging-Texte auf Deutsch

**Backend:**
- `console.error()` in catch-Blöcken mit Pfadangabe und Original-Fehler
- Kein strukturiertes Logging-Framework

## Kommentare

**Wann kommentiert wird:**
- Sektionen in langen Dateien mit `// ====` Trennlinien und Beschriftung
- Nicht-offensichtliche Business-Logik und Sonderfälle
- Anti-Spam/Race-Condition-Schutz immer erklärt
- Inline-Kommentare für komplexe Konditionen
- Deutsche Kommentare überall (konsistent mit Sprachvorgabe)

**Typische Muster:**
```typescript
// ANTI-SPAM: Verhindere mehrfache Push-Registrierung (Global Scope)
// Race-Condition-Schutz: Key kann sich ändern während fetch läuft
// Teamer-Aktivitäten: points und type sind optional
```

## Funktionsdesign

**Frontend:**
- Kleine Helper-Funktionen direkt in der Komponente für View-Logik (z.B. `formatDate`, `getEventStatusInfo`)
- Komplexe, wiederverwendbare Logik als Custom Hook in `src/hooks/`
- Modale per `useIonModal` — NIEMALS `<IonModal isOpen={state}>`
- `useCallback` und `useMemo` für teure Berechnungen und Callback-Stabilität

**Backend:**
- Route-Factories: jede Route-Datei exportiert `module.exports = (db, rbacVerifier, helpers, ...) => { ... }`
- Validierungsregeln als Arrays vor den Routen deklariert
- Wiederverwendbare Validierungen in `backend/middleware/validation.js` als `commonValidations`

## Modul-Design

**Frontend-Exports:**
- Standard-Export für Komponenten: `export default EventsView`
- Named-Exports für Hooks, Services, Utilities und Typen
- Barrel-Export nur in `src/components/shared/index.ts`

**Backend-Exports:**
- CommonJS: `module.exports = (db, ...) => { router.get(...); return router; }`
- Services als Klassen oder Singleton-Objekte, z.B. `PushService`

## UI-Design-Regeln (projektspezifisch)

**Keine Emojis:**
- Alle Icons über `IonIcon` aus `ionicons/icons`
- Icons als Named-Imports: `import { calendar, time, close } from 'ionicons/icons'`
- Ausnahme: `document` muss als `documentIcon` importiert werden (shadowed `window.document`)

**Sprache:**
- Alle UI-Texte auf Deutsch mit echten Umlauten (ä, ö, ü, ß)
- Niemals Ersatzschreibweisen (ae, oe, ue, ss)

**Design-Pattern:**
- Header immer kompakt: `SectionHeader` Komponente mit Icon + Titel + Stats-Row
- Referenz-View: `src/components/konfi/views/EventsView.tsx`
- CSS-Klassen: `src/theme/variables.css` mit `app-` Prefix-System

---

*Convention-Analyse: 2026-03-23*
