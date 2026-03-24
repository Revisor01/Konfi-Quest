# Coding Conventions

**Analysis Date:** 2026-03-24

## Naming Patterns

**Files (Frontend):**
- React-Komponenten: PascalCase, Dateiendung `.tsx` (z.B. `KonfiEventsPage.tsx`, `ActivityModal.tsx`)
- Hooks: camelCase mit `use`-Prefix, Dateiendung `.ts` (z.B. `useOfflineQuery.ts`, `useActionGuard.ts`)
- Services: camelCase, Dateiendung `.ts` (z.B. `tokenStore.ts`, `writeQueue.ts`, `networkMonitor.ts`)
- Utility-Funktionen: camelCase, Dateiendung `.ts` (z.B. `helpers.ts`, `dateUtils.ts`)
- Typen/Interfaces: camelCase Dateinamen, PascalCase Typnamen (`user.ts`, `event.ts`)

**Files (Backend):**
- Routes: kebab-case, Dateiendung `.js` (z.B. `konfi-management.js`, `activities.js`)
- Middleware: camelCase, Dateiendung `.js` (z.B. `validation.js`, `rbac.js`)
- Utils: camelCase, Dateiendung `.js` (z.B. `liveUpdate.js`, `passwordUtils.js`)

**Verzeichnisse (Frontend):**
- Feature-Gruppen: Singular ohne Bindestrich (`admin/`, `konfi/`, `teamer/`, `wrapped/`)
- Interne Unterteilung: `pages/`, `views/`, `modals/` je Feature-Gruppe
- Querschnitts-Code: `common/`, `shared/`

**Funktionen:**
- Frontend: camelCase, beschreibend (z.B. `filterBySearchTerm`, `calculateBadgeProgress`)
- Backend: camelCase (z.B. `getCachedUser`, `handleValidationErrors`, `invalidateUserCache`)

**Variablen:**
- camelCase durchgehend
- Private Module-Variablen in Services: Unterstrich-Prefix (z.B. `_token`, `_items`, `_flushing`)
- Konstanten: SCREAMING_SNAKE_CASE (z.B. `DEFAULT_TTL`, `USER_CACHE_MAX`, `QUEUE_KEY`)

**TypeScript Typen/Interfaces:**
- Interfaces: PascalCase mit beschreibendem Namen (z.B. `BaseUser`, `QueueItem`, `LiveUpdateEvent`)
- Props-Interfaces: `<KomponentenName>Props` (z.B. `EventsViewProps`, `ActivityModalProps`)
- Union-Typen in Interfaces für eingeschränkte Strings (z.B. `type: 'admin' | 'konfi' | 'teamer'`)

## Code Style

**Sprache:**
- Deutsche Kommentare und UI-Texte durchgehend
- Echte Umlaute (ä, ö, ü, ß) — niemals ae/oe/ue/ss
- Keine Unicode-Emojis; Icons ausschließlich über `ionicons/icons`
- Logging/Fehlermeldungen auf Deutsch (z.B. `'Unbekannter Fehler'`, `'Ungültige ID'`)

**Formatierung:**
- Kein dediziertes Prettier-Config (kein `.prettierrc` vorhanden)
- ESLint mit TypeScript-ESLint + React Hooks + React Refresh Plugins
- Config: `frontend/eslint.config.js`
- `no-console`/`no-debugger` nur in Production als Warning, in Development erlaubt

**Linting-Regeln:**
- `@typescript-eslint` recommended Rules aktiv
- `eslint-plugin-react-hooks` recommended Rules aktiv
- `react-refresh/only-export-components` als Warning (mit `allowConstantExport`)

## Import-Organisation

**Reihenfolge (Frontend-Konvention beobachtet):**
1. React-Core (`import React, { useState, useEffect } from 'react'`)
2. Ionic-Komponenten (`from '@ionic/react'`)
3. Ionicons (`from 'ionicons/icons'`)
4. Externe Bibliotheken (axios, socket.io-client, swiper etc.)
5. Interne Contexts (`from '../../../contexts/AppContext'`)
6. Interne Hooks (`from '../../../hooks/useOfflineQuery'`)
7. Interne Services (`from '../../../services/api'`)
8. Interne Komponenten (relativ, Views und Shared-Components)
9. Typen (`from '../../../types/event'`)

**Barrel Files:**
- `src/components/shared/index.ts` exportiert `SectionHeader`, `EmptyState`, `ListSection`
- Kein App-weites Barrel; alle anderen Module werden direkt importiert

**Backend:**
- CommonJS (`require`) durchgehend im Backend
- Keine Barrel-Files; direkte Requires mit relativem Pfad

## Fehlerbehandlung

**Frontend:**
- API-Fehler: `try/catch` mit `err instanceof Error ? err.message : 'Unbekannter Fehler'`
- Axios-Fehler: Zentraler Response-Interceptor in `src/services/api.ts` — behandelt 401 (Token-Refresh), 429 (Rate-Limit), dispatched Custom Events (`auth:relogin-required`, `rate-limit`)
- Komponenten-Fehler: `ErrorBoundary`-Komponente in `src/components/common/ErrorBoundary.tsx`
- Form-Submission: `useActionGuard` Hook verhindert Doppel-Submits und liefert `isSubmitting`-State
- Offline-Fehler: `useOfflineQuery` behält gecachte Daten bei Netzwerkfehlern; markiert als stale statt Error anzuzeigen

**Backend:**
- Routes: `try/catch` pro Endpoint, `res.status(500).json({ error: '...' })`
- Validierung: `express-validator` + zentrale `handleValidationErrors`-Middleware → 400 mit strukturierten `details`
- SQL-Injection: Parameterized Queries durchgehend (`$1`, `$2` etc. mit pg-Treiber)
- SQL-Spalten-Injektion: Whitelist-Resolver `getPointField()` in `middleware/validation.js`

```javascript
// Beispiel: Backend Fehlerbehandlung in Route
try {
  const { rows } = await db.query(query, params);
  res.json(rows);
} catch (err) {
  console.error('Fehler beim Laden:', err);
  res.status(500).json({ error: 'Interner Serverfehler' });
}
```

## Logging

**Frontend:**
- `console.warn()` für non-kritische Zustände (z.B. Offline-Token, übersprungene Aktionen)
- `console.error()` für Fehler mit Kontext-String (z.B. `'Fehler beim Senden des FCM-Tokens:', err`)
- Kein strukturiertes Logging-Framework

**Backend:**
- `console.warn()` für Auth-Fehler, Engine-Errors
- `console.error()` für Server-Fehler mit Kontext
- `console.log()` für Server-Start, wichtige Initialisierungen
- Kein strukturiertes Logging-Framework (kein Winston/Pino)

## Kommentare

**Wann kommentieren:**
- Nicht-offensichtliche Business-Logik (z.B. Race-Condition-Schutz, Anti-Spam-Logik)
- Architektur-Entscheidungen (z.B. `// FCM Token wird über Window Events empfangen`)
- Rollen-Hierarchie-Erklärungen in `rbac.js`
- SQL-Queries mit mehreren JOINs

**Stil:**
- Inline-Kommentare auf Deutsch
- Sections durch `// ====` Trennlinien mit Titel in Backend-Dateien (z.B. `// ===== ROUTES =====`)
- Keine JSDoc/TSDoc außer bei komplexen Utility-Funktionen

## Funktionsdesign

**Größe:** Kein striktes Limit; große Komponenten existieren (bis ~1181 Zeilen in `KonfiDetailSections.tsx`), aber Views sind zunehmend als separate Datei ausgelagert

**Parameter:**
- React-Komponenten: Props-Interface immer explizit definiert (`interface XxxProps`)
- Hooks: Optionaler `options`-Parameter mit Interface (z.B. `UseOfflineQueryOptions<T>`)
- Generics für wiederverwendbare Utility-Funktionen (z.B. `filterByJahrgang<T>`, `sortByDate<T>`)

**Return-Werte:**
- Hooks geben strukturiertes Result-Objekt zurück (z.B. `{ data, loading, error, isStale, isOffline, refresh }`)
- Services exportieren einzelne Funktionen, kein Klassen-Pattern (Frontend)
- Backend-Routes geben immer JSON zurück

## Modul-Design

**Frontend-Muster:**
- Services als Singleton-Module mit exportierten Funktionen (kein `class`): `tokenStore.ts`, `writeQueue.ts`, `offlineCache.ts`
- Contexts: React-Context + Provider + Custom-Hook-Pattern (`useApp()`, `useLiveRefresh()`)
- Modals ausschließlich über `useIonModal`-Hook; niemals `<IonModal isOpen={state}>`

```typescript
// Korrektes Modal-Muster
const [presentModal, dismissModal] = useIonModal(MyModal, {
  onClose: () => dismissModal(),
  onSuccess: () => { dismissModal(); refresh(); }
});
presentModal({ presentingElement });
```

**Backend-Muster:**
- Routes als Factory-Funktion exportiert: `module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, ...) => { ... }`
- Validierungsregeln als Arrays am Anfang jeder Route-Factory definiert

**Exports:**
- Frontend: Named Exports für Utilities/Types; Default Exports für React-Komponenten
- Barrel: Nur `src/components/shared/index.ts` vorhanden

---

*Convention-Analyse: 2026-03-24*
