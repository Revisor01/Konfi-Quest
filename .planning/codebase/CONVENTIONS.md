# Coding Conventions

**Analysis Date:** 2026-03-23

## Naming Patterns

**Files:**
- React-Komponenten: PascalCase mit beschreibendem Suffix, z.B. `KonfiDashboardPage.tsx`, `ActivityRequestModal.tsx`, `EventsView.tsx`
- Suffix-Konvention: `*Page.tsx` für Seiten, `*Modal.tsx` für Modals, `*View.tsx` für View-Unterkomponenten, `*Section.tsx` für Abschnitte
- Utilities: camelCase, z.B. `helpers.ts`, `dateUtils.ts`, `tokenStore.ts`
- Hooks: `use`-Prefix, z.B. `useOfflineQuery.ts`, `useActionGuard.ts`
- Contexts: PascalCase mit `Context`-Suffix, z.B. `AppContext.tsx`, `BadgeContext.tsx`
- Backend-Routes: kebab-case, z.B. `konfi-management.js`, `konfi.js`

**Funktionen:**
- React-Komponenten: PascalCase (`KonfiDashboardPage`, `SectionHeader`)
- Custom Hooks: camelCase mit `use`-Prefix (`useOfflineQuery`, `useActionGuard`)
- Utility-Funktionen: camelCase (`formatDate`, `calculateBadgeProgress`, `getProgressColor`)
- Event-Handler: camelCase mit Verb-Prefix (`onClose`, `onSuccess`, `onTabChange`, `handleSubmit`)
- Async-Funktionen: camelCase mit Verb-Prefix (`sendTokenToServer`, `loadFromCache`)

**Variablen:**
- camelCase durchgehend (`dashboardData`, `activeTab`, `isOnline`)
- Boolean-Flags: `is`- oder `has`-Prefix (`isLoading`, `isOnline`, `hasError`, `hasWrapped`)
- Konstanten: SCREAMING_SNAKE_CASE fuer module-level (`API_BASE_URL`, `JWT_SECRET`, `DEFAULT_TTL`, `VALID_POINT_FIELDS`)

**TypeScript-Typen und Interfaces:**
- PascalCase (`BaseUser`, `AppContextType`, `EventsViewProps`, `DashboardData`)
- Props-Interfaces: Komponenten-Name + `Props` (`EventsViewProps`, `SectionHeaderProps`)
- State-Interfaces: beschreibender Name (`ErrorBoundaryState`)

## Code Style

**Formatierung:**
- Prettier nicht konfiguriert - kein `.prettierrc` vorhanden
- 2-Spaces-Einrueckung (de-facto Standard im Projekt)
- Keine trailing commas enforced

**Linting:**
- ESLint 9 mit Flat-Config (`frontend/eslint.config.js`)
- Plugins: `eslint-plugin-react-hooks`, `eslint-plugin-react-refresh`, `typescript-eslint`
- `no-console` und `no-debugger`: nur Warnung in production, im dev deaktiviert
- React Hooks Rules: `reactHooks.configs.recommended.rules` aktiv

## Import-Organisation

**Frontend (TypeScript/React):**
1. React-Core und React-Hooks
2. Ionic-Komponenten (`@ionic/react`)
3. IonIcons (`ionicons/icons`)
4. Projekt-interne Contexts (`../../contexts/...`)
5. Projekt-interne Hooks (`../../hooks/...`)
6. Services (`../../services/...`) und Utilities (`../../utils/...`)
7. Komponenten aus demselben oder uebergeordnetem Verzeichnis
8. Typen (`../../types/...`)

**Beispiel-Muster aus `KonfiDashboardPage.tsx`:**
```typescript
import React, { useState, useCallback, useRef } from 'react';
import { IonPage, IonHeader, useIonModal } from '@ionic/react';
import { sparkles, chevronForward } from 'ionicons/icons';
import { useApp } from '../../../contexts/AppContext';
import { useOfflineQuery } from '../../../hooks/useOfflineQuery';
import api from '../../../services/api';
import DashboardView from '../views/DashboardView';
import { Event } from '../../../types/event';
```

**Keine Path-Aliases** (kein `@/` o.ae.) - alle Imports relativ mit `../`.

**Backend (CommonJS):**
```javascript
const express = require('express');
const { body, param } = require('express-validator');
const { handleValidationErrors, commonValidations } = require('../middleware/validation');
const PushService = require('../services/pushService');
```

## Komponenten-Architektur

**Page-Komponenten (`*Page.tsx`):**
- Enthalten State, Datenfetching via `useOfflineQuery`, Modal-Steuerung
- Rendern eine `*View.tsx`-Komponente mit den geladenen Daten als Props
- Verwenden `useIonModal` fuer Modals (NIEMALS `<IonModal isOpen={state}>`)

**View-Komponenten (`*View.tsx`):**
- Reine Darstellungskomponenten, empfangen Daten als Props
- Enthalten `useMemo` fuer aufwendige Berechnungen aus Props
- Keine eigenen API-Calls

**Shared-Komponenten (`src/components/shared/`):**
- `SectionHeader`: Kompakt-Header mit Icon, Titel, Stats-Row und Farbverlauf
- `EmptyState`, `ListSection`: Wiederverwendbare Listenkomponenten
- Alle als Named Exports in `src/components/shared/index.ts`

## Typen

**Typen-Dateien:** zentralisiert in `src/types/`
- `user.ts`: `BaseUser`, `AdminUser`, `ChatUser`
- `event.ts`: `Event`, `Category`, `Timeslot`, `Jahrgang`
- `chat.ts`, `dashboard.ts`, `wrapped.ts`
- Kommentar-Konvention am Dateianfang: `// Zentrale [X]-Typen — alle Consumer importieren von hier`

**`any` Verwendung:**
- Vereinzelt vorhanden in `DashboardData`-Interfaces (`recent_badges: any[]`)
- Nicht empfohlen fuer neue Interfaces - typisierte Felder bevorzugen

## Fehlerbehandlung

**Frontend:**
- API-Fehler werden ueber `setError()` aus `AppContext` geleitet und als `IonToast` angezeigt
- `useOfflineQuery` unterscheidet: Netzwerkfehler mit gecachten Daten (als `isStale` markieren) vs. kein Cache (Fehlermeldung)
- Unerwartete Render-Fehler: `ErrorBoundary`-Klasse in `src/components/common/ErrorBoundary.tsx` als Top-Level-Wrapper
- Async-Fehler in Callbacks: `try/catch` mit `console.error()` + `setError()`-Aufruf

**Pattern fuer API-Calls in Seiten:**
```typescript
try {
  const response = await api.post('/endpoint', data);
  setSuccess('Erfolgreich gespeichert');
  onSuccess();
} catch (err) {
  setError('Fehler beim Speichern');
}
```

**Backend:**
- Alle Route-Handler in `try/catch`
- Fehlerantwort: `res.status(500).json({ error: 'Datenbankfehler' })`
- Validierungsfehler: `res.status(400).json({ error: '...', details: [...] })`
- Auth-Fehler: `res.status(401).json({ error: '...' })`
- Express-Validator fuer Input-Validierung, zentralisiert in `backend/middleware/validation.js`

**Backend Validierungsschema:**
```javascript
const validateCreateActivity = [
  commonValidations.name,
  body('points').optional().isInt({ min: 0 }),
  handleValidationErrors  // Immer als letztes in der Middleware-Chain
];
```

## Logging

**Framework:** `console` direkt (kein Logging-Framework)

**Muster:**
- `console.error()`: Datenbankfehler, unerwartete Exceptions
- `console.warn()`: Erwartete, nicht-kritische Fehler (z.B. Push-Token nicht verfuegbar, Tageslosung-Fallback)
- Frontend: `no-console` nur in production als Warning - console.log im dev erlaubt
- Deutsche Fehlermeldungen fuer Benutzer, englische oder deutsche interne Logs

## Kommentare

**Wann kommentieren:**
- Sicherheits-relevante Stellen (z.B. `// ANTI-SPAM`, `// Verhindere parallele Refresh-Requests`)
- Nicht-offensichtliche Algorithmen (z.B. ISO-Wochennummer-Berechnung)
- Abschnitts-Trenner: `// ====================================================================`
- Pfad-Kommentare in Backend-Routes: `// Pfad: GET /api/activities/`

**JSDoc/TSDoc:**
- Vereinzelt fuer utiltiy-Funktionen in `dateUtils.ts`:
```typescript
/**
 * Gets the user's local timezone
 */
export const getUserTimezone = (): string => { ... };
```
- Nicht durchgehend vorhanden - nur bei weniger offensichtlichen Funktionen

## Modul-Design

**Frontend-Exports:**
- Komponenten: Default Export (`export default MyComponent`)
- Utility-Funktionen: Named Exports (`export const formatDate = ...`)
- Barrel-Dateien: nur fuer `src/components/shared/index.ts`

**Backend-Exports:**
- Route-Module: Funktion-Factory-Pattern mit Dependency Injection
```javascript
module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, checkAndAwardBadges) => {
  const router = express.Router();
  // routes...
  return router;
};
```

## Sprachliche Konventionen

**Pflichtregeln (laut CLAUDE.md):**
- KEINE Unicode-Emojis - weder in Code, UI, Kommentaren noch Strings
- Icons ausschliesslich als IonIcon mit ionicons/icons-Importen
- Echte Umlaute verwenden: `ü`, `ö`, `ä`, `ß` (nie `ue`, `oe`, etc.)
- Deutsche UI-Texte und Fehlermeldungen fuer Benutzer

---

*Convention analysis: 2026-03-23*
