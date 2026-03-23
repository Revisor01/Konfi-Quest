# Coding Conventions

**Analysis Date:** 2026-03-23

## Naming Patterns

**Files:**
- React-Komponenten: PascalCase mit Suffix — `AdminKonfisPage.tsx`, `KonfiEventsPage.tsx`, `KonfiModal.tsx`
- Hooks: camelCase mit `use`-Prefix — `useOfflineQuery.ts`, `useActionGuard.ts`
- Services/Utils: camelCase ohne Suffix — `api.ts`, `tokenStore.ts`, `helpers.ts`
- Backend-Routes: kebab-case mit `.js` — `konfi-management.js`, `activities.js`
- Typen-Dateien: lowercase nach Domain — `user.ts`, `event.ts`, `chat.ts`

**Komponenten-Klassen:**
- Pages (Ionic-Screens): `[Role][Feature]Page` — `AdminActivitiesPage`, `KonfiBadgesPage`
- Modals: `[Feature]Modal` — `ActivityManagementModal`, `KonfiModal`
- Views (darstellende Teile ohne eigenes Routing): `[Feature]View` — `EventsView`, `DashboardView`
- Shared/wiederverwendbare Komponenten: beschreibend ohne Prefix — `SectionHeader`, `EmptyState`

**Funktionen:**
- Handler: `handle[Action]` — `handleClose`, `handleSave`, `handleSubmit`
- Callbacks aus Eltern: `on[Event]` — `onClose`, `onSuccess`, `onTabChange`
- Guards/Hilfs-Methoden in Hooks: camelCase ohne Prefix — `guard`, `refresh`, `revalidate`

**Variablen:**
- Boolean-State: beschreibend — `isSubmitting`, `isOnline`, `isDirty`
- State-Arrays: Plural der Domain — `events`, `konfis`, `activities`
- Offline-Query-Destrukturierung: `data: [semantischer Name]` — `{ data: events }`, `{ data: konfis }`
- Refs fuer Race-Condition-Schutz: `[name]Ref` — `mountedRef`, `currentKeyRef`, `guardRef`

**TypeScript-Typen:**
- Interfaces: PascalCase — `BaseUser`, `QueueItem`, `CacheEntry`
- Union-Typen: PascalCase — `HighlightType`
- Props-Interfaces: `[Komponentenname]Props` — `EventsViewProps`, `KonfiModalProps`

## Code Style

**Formatting:**
- Kein Prettier konfiguriert — konsistente Einrückung mit 2 Leerzeichen (de-facto Standard)
- Einzel-Anführungszeichen in TypeScript/JavaScript

**Linting:**
- ESLint 9 mit Flat-Config — `frontend/eslint.config.js`
- typescript-eslint + react-hooks + react-refresh Plugins
- `no-console`: Warn in Production, deaktiviert in Development
- TypeScript strict-Mode aktiviert — `tsconfig.json`

**Absolutes Verbot:** Keine Unicode-Emojis in Code, UI oder Strings. Nur IonIcon mit Ionicons-Icons.

**Pflicht:** Echte Umlaute (ü, ö, ä, ß) in UI-Texten und Fehlermeldungen — niemals ue/oe/ae/ss.

## Import-Reihenfolge

**Konvention in Frontend-Komponenten (durchgängig eingehalten):**
1. React und React-Hooks — `import React, { useState, useCallback } from 'react'`
2. Ionic-Komponenten und Hooks — `import { IonPage, IonHeader, useIonModal } from '@ionic/react'`
3. Ionicons — `import { add, closeOutline } from 'ionicons/icons'`
4. Lokale Contexts — `import { useApp } from '../../../contexts/AppContext'`
5. Lokale Hooks — `import { useOfflineQuery } from '../../../hooks/useOfflineQuery'`
6. Services — `import api from '../../../services/api'`
7. Lokale Komponenten — `import EventsView from '../views/EventsView'`
8. Typen — `import { Event } from '../../../types/event'`
9. Utils — `import { triggerPullHaptic } from '../../../utils/haptics'`

**Path Aliases:** Keine konfigurierten Aliase — alle Imports sind relative Pfade mit `../`.

## Modal-Pattern

**PFLICHT: Nur `useIonModal` Hook verwenden — niemals `<IonModal isOpen={state}>`.**

```typescript
// Korrekte Verwendung (aus AdminActivitiesPage.tsx)
const [presentActivityModal, dismissActivityModal] = useIonModal(ActivityManagementModal, {
  activity: selectedActivity,
  onClose: () => dismissActivityModal(),
  onSuccess: () => {
    dismissActivityModal();
    refreshActivities();
  }
});

// Öffnen mit presentingElement fuer Sheet-Styling
presentActivityModal({ presentingElement: presentingElement });
```

**Modal-Komponenten-Interface:**
```typescript
interface MyModalProps {
  onClose: () => void;
  onSuccess: () => void;
  dismiss?: () => void; // Immer optionaler Fallback
}

const MyModal: React.FC<MyModalProps> = ({ onClose, onSuccess, dismiss }) => {
  const doClose = () => {
    if (dismiss) dismiss(); // dismiss bevorzugen
    else onClose();
  };
  // ...
};
```

## Data-Fetching-Pattern

**Alle Pages verwenden `useOfflineQuery` (SWR-Pattern):**

```typescript
const { data: events, loading, refresh } = useOfflineQuery<Event[]>(
  'konfi:events:' + user?.id,     // Cache-Key: [role]:[domain]:[scope-id]
  () => api.get('/konfi/events').then(r => r.data),
  { ttl: CACHE_TTL.EVENTS }       // TTL aus offlineCache.ts Konstanten
);
```

**Cache-Keys-Konvention:**
- `[role]:[domain]:[organization_id oder user_id]` — `admin:konfis:42`, `konfi:events:7`
- Mit Zusatz-Filter: `admin:activities:42:konfi`

**CACHE_TTL-Konstanten** aus `src/services/offlineCache.ts` — niemals Magic Numbers.

## Offline-Write-Pattern

Schreiboperationen über `writeQueue` mit Offline-Unterstützung. Doppel-Submit-Schutz durch `useActionGuard`:

```typescript
const { isSubmitting, guard } = useActionGuard();

const handleSave = async () => {
  await guard(async () => {
    await api.post('/endpoint', data);
    onSuccess();
  });
};
```

## Backend-Routen-Pattern

**Alle Routes als Factory-Funktion exportiert (Dependency Injection):**
```javascript
module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, checkAndAwardBadges) => {
  router.get('/', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const { rows } = await db.query(query, params);
      res.json(rows);
    } catch (err) {
      console.error('Database error in GET /api/[route]:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });
  return router;
};
```

**Middleware-Reihenfolge:** `rbacVerifier` → `requireRole` → Validierungs-Array → Handler

## Error Handling

**Frontend:**
- API-Fehler: `setError(message)` aus `useApp()` — zeigt globalen Toast, löscht nach 5s automatisch
- Erfolg: `setSuccess(message)` aus `useApp()`
- Fehler-Format aus API: `error.response?.data?.error` oder `error.message`
- Async-Fehler in Hooks/Services: `try/catch`, bei Offline-Zustand graceful degradation mit Cache

**Backend:**
- HTTP 400: Validierungsfehler mit `{ error: string, details?: array }` aus `handleValidationErrors`
- HTTP 401: Auth-Fehler mit `{ error: string }` — immer englisch (JWT-Standard)
- HTTP 403: Berechtigungsfehler mit `{ error: 'Keine Berechtigung' }` — deutsch
- HTTP 404: `{ error: '[Ressource] nicht gefunden' }` — deutsch
- HTTP 500: `{ error: 'Datenbankfehler' }` + `console.error()` mit Kontext-Prefix

**Konvention fuer console.error im Backend:**
```javascript
console.error('Database error in [VERB] /api/[route]:', err);
```

## Logging

**Frontend:** Kein dediziertes Logging-Framework. Nur `console.warn/error` fuer Fehler und unerwartete Zustände — NIE fuer normale Ablauf-Informationen.

**Backend:** `console.error/warn/log` direkt. Kein dediziertes Logger-Framework.

## Kommentare

**Wenn kommentiert wird:**
- Deutsche Kommentare für Geschäftslogik und Sicherheitshinweise
- Englische Kommentare sporadisch, besonders bei Capacitor/iOS-Workarounds
- Wichtige Warnungen gross markiert: `// WICHTIG:`, `// ANTI-SPAM:`, `// TESTFLIGHT FIX:`
- Migrationshinweise: `// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren`

**JSDoc/TSDoc:** Nicht verwendet. Typen werden stattdessen über TypeScript-Interfaces kommuniziert.

## Typdefinitionen

**Zentrale Typen-Dateien** in `src/types/`:
- Alle Consumer importieren von dort, keine lokal duplizierten Interfaces in Komponenten (wird angestrebt, aber nicht immer eingehalten — manche Pages definieren lokale Interfaces)
- Kommentare zeigen Intention: `// Zentrale User-Typen — alle Consumer importieren von hier`

**Lokale Interfaces:** Werden in Page-Komponenten direkt vor der Komponente definiert, wenn der Typ nur lokal relevant ist:
```typescript
// Aus AdminKonfisPage.tsx
interface Konfi {
  id: number;
  name: string;
  // ...
}
const AdminKonfisPage: React.FC = () => { ... };
```

## RBAC-Pattern (Backend)

**Organisations-Isolation ist Pflicht** — jede DB-Query filtert nach `organization_id`:
```javascript
// Immer req.user.organization_id als Filter-Parameter
const { rows } = await db.query(query, [req.user.organization_id]);
```

**SQL-Injection-Schutz:** Dynamische Spalten-Namen (z.B. Punktetypen) nur über Whitelist-Resolver:
```javascript
// Aus backend/middleware/validation.js
const field = VALID_POINT_FIELDS[type]; // Wirft Error bei ungültigem Wert
```

## Generics-Verwendung

TypeScript-Generics werden konsequent eingesetzt für wiederverwendbare Utilities:
```typescript
// useOfflineQuery<T>, offlineCache.get<T>, filterByJahrgang<T>, sortByDate<T>
const { data } = useOfflineQuery<Event[]>(key, fetcher);
```

---

*Convention analysis: 2026-03-23*
