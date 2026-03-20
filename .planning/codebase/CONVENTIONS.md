# Coding Conventions

**Analysis Date:** 2026-03-20

## Absolute Rules (Project-Specific)

These rules are mandated by `CLAUDE.md` and override general conventions:

1. **Keine Unicode-Emojis** — VERBOTEN in Code, UI, Strings, Kommentaren, überall. Stattdessen IonIcon aus `ionicons/icons` verwenden.
2. **Echte Umlaute** — Immer ü, ö, ä, ß schreiben. Niemals ue, oe, ae, ss.
3. **Deutsche UI-Sprache** — Alle Texte, Labels, Fehlermeldungen auf Deutsch.
4. **RBAC-Struktur** — Kein Code, der die alten `admins`/`konfis`-Tabellen oder `points.gottesdienst`-Struktur nutzt.
5. **Modal Pattern** — Ausschließlich `useIonModal` Hook verwenden. NIEMALS `<IonModal isOpen={state}>` außer für `keepContentsMounted` Date-Picker-Inline-Widgets.

---

## Naming Patterns

**Dateien:**
- Pages: `PascalCase` mit Rollenprefix, z.B. `AdminKonfisPage.tsx`, `KonfiDashboardPage.tsx`, `TeamerEventsPage.tsx`
- Views: `PascalCase` mit optionalem Rollenprefix, z.B. `EventsView.tsx`, `DashboardView.tsx`, `TeamerBadgesView.tsx`
- Modals: `PascalCase` mit funktionalem Suffix, z.B. `KonfiModal.tsx`, `ActivityManagementModal.tsx`, `PointsHistoryModal.tsx`
- Backend-Routes: `kebab-case.js`, z.B. `konfi-managment.js`, `activities.js`

**Komponenten:**
- Funktionskomponenten: PascalCase, z.B. `const AdminKonfisPage: React.FC = () => {}`
- Props-Interface: `{ComponentName}Props`, z.B. `interface KonfiModalProps`, `interface ActivityManagementModalProps`

**Funktionen:**
- Lade-Funktionen: `load{Resource}()` oder generisch `loadData()`, z.B. `loadActivities()`, `loadEvents()`, `loadData()`
- Handler-Funktionen: `handle{Action}{Noun}`, z.B. `handleDeleteActivity`, `handleSelectActivity`, `handleRoleChange`
- Öffnen von Modals: `open{Action}` oder direkt `present{Name}Modal(...)`, z.B. `openPointsHistory()`
- Callback-Props: `on{Action}`, z.B. `onClose`, `onSave`, `onSuccess`, `onUpdate`

**Variablen/State:**
- State: camelCase, z.B. `const [loading, setLoading] = useState(true)`
- Modal-Hooks: `[present{Name}Modal, dismiss{Name}Modal]`, z.B. `[presentKonfiModalHook, dismissKonfiModalHook]`

**CSS-Klassen:**
- BEM-ähnlich mit `app-`-Prefix: `app-list-item`, `app-list-item__title`, `app-list-item--events`
- Element: `__` Separator, z.B. `app-list-item__row`, `app-header-banner__icon`
- Modifier: `--` Separator, z.B. `app-list-item--selected`, `app-modal-submit-btn--events`

---

## Code Style

**Formatierung:**
- Kein Prettier konfiguriert — kein gemeinsamer Formatter erzwungen
- TypeScript strict mode aktiv (`"strict": true` in `tsconfig.json`)
- ESLint mit typescript-eslint, react-hooks, react-refresh Plugins (`frontend/eslint.config.js`)
- `no-console` nur in Production als Warning (dev erlaubt)

**Linting:**
- typescript-eslint recommended rules
- react-hooks recommended rules (exhaustive-deps etc.)
- react-refresh/only-export-components als Warning

---

## Import-Reihenfolge

Konsistent über alle Dateien:

1. React und Hooks (`import React, { useState, useEffect, ... } from 'react'`)
2. Ionic-Komponenten (`import { IonPage, IonHeader, ... } from '@ionic/react'`)
3. Ionicons (`import { calendar, add, ... } from 'ionicons/icons'`)
4. Router (`import { useHistory } from 'react-router-dom'`)
5. Eigene Contexts (`import { useApp } from '../../../contexts/AppContext'`)
6. Eigene Services (`import api from '../../../services/api'`)
7. Eigene Komponenten (`import LoadingSpinner from '../../common/LoadingSpinner'`)
8. Lokale Typen/Interfaces (in derselben Datei definiert, kein eigener types-Import normalerweise)

**Wichtig beim `document`-Import:**
```typescript
import { document as documentIcon } from 'ionicons/icons';
// NIEMALS: import { document } from 'ionicons/icons' — shadowed window.document!
```

---

## TypeScript-Patterns

**Interface-Definitionen:**
- Typen werden lokal in der Datei definiert, die sie nutzt (kein zentrales types-File außer `src/types/chat.ts`, `src/types/dashboard.ts`)
- `any[]` wird in ~19 Stellen verwendet (hauptsächlich für Backend-Response-Arrays) — vermeiden, wenn möglich
- Keine `type`-Aliases — nur `interface`

**Generics:**
```typescript
export const filterByJahrgang = <T extends { jahrgang?: string }>(items: T[], selectedJahrgang: string): T[]
```

---

## Error Handling

### Frontend

**Pattern:** `try/catch` in async Funktionen mit `setError` aus AppContext.

```typescript
const loadActivities = async () => {
  setLoading(true);
  try {
    const response = await api.get('/admin/activities');
    setActivities(response.data);
  } catch (err) {
    setError('Fehler beim Laden der Aktivitäten');
    console.error('Error loading activities:', err);
  } finally {
    setLoading(false);
  }
};
```

**Kritisch vs. nicht-kritisch:**
- Kritische Fehler (Dashboard-Daten fehlen): `setError()` aufrufen
- Nicht-kritische Fehler (Events/Badges beim Dashboard): Nur `console.error`, kein UI-Feedback
- Fehlervariable: meistens `err`, seltener `error`

**Erfolgsmeldungen:**
```typescript
setSuccess(`Aktivität "${activity.name}" gelöscht`);
```

**Rate-Limit-Handling:**
- Zentrales Handling in `src/services/api.ts` via Axios-Interceptor
- Sendet `rate-limit` DOM-Event für non-Login-Requests

### Backend

**Pattern:** `try/catch` in Route-Handlern mit einheitlichen Response-Strukturen.

```javascript
try {
  // ...
  res.json(result);
} catch (err) {
  console.error('Database error in GET /api/activities/:', err);
  res.status(500).json({ error: 'Datenbankfehler' });
}
```

**HTTP-Status-Codes:**
- `400`: Validierungsfehler (`{ error: 'Name ist erforderlich' }`)
- `404`: Ressource nicht gefunden (`{ error: 'Aktivität nicht gefunden' }`)
- `500`: Datenbankfehler (`{ error: 'Datenbankfehler' }`)
- `403`: Keine Berechtigung

**Validierung:**
- Alle Route-Handler mit `express-validator` (body, param, query)
- Zentrale Validierungs-Middleware in `backend/middleware/validation.js`
- Gemeinsame Validierungen als `commonValidations`-Objekt

---

## UI-Patterns

### Page-Struktur (Standard-Page)

Alle Admin/Konfi/Teamer-Pages folgen diesem Muster:

```tsx
const AdminFooPage: React.FC = () => {
  const { user, setSuccess, setError } = useApp();
  const { pageRef, presentingElement, cleanupModals } = useModalPage('admin-foo');

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const [presentModal, dismissModal] = useIonModal(FooModal, {
    onClose: () => dismissModal(),
    onSuccess: () => { dismissModal(); loadData(); }
  });

  useLiveRefresh('foo', useCallback(() => loadData(), []));

  useEffect(() => { loadData(); }, []);

  return (
    <IonPage ref={pageRef}>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Titel</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
          <IonRefresherContent />
        </IonRefresher>
        <FooView data={data} onAction={handleAction} onUpdate={loadData} />
      </IonContent>
    </IonPage>
  );
};
```

### View-Komponenten

Views erhalten alle Daten als Props, kein eigener API-Zugriff.
Referenz-View: `src/components/konfi/views/EventsView.tsx`

**Listen-Pattern:**
```tsx
<SectionHeader
  title="Titel"
  subtitle="Untertitel"
  icon={calendarIcon}
  preset="events"
  stats={[{ value: 3, label: 'Gesamt' }]}
/>
<ListSection
  icon={calendarOutline}
  title="Events"
  count={items.length}
  iconColorClass="events"
  isEmpty={items.length === 0}
  emptyIcon={calendarOutline}
  emptyTitle="Keine Events"
  emptyMessage="Keine Events gefunden"
>
  {items.map(item => (
    <IonItemSliding key={item.id}>
      <IonItem button onClick={() => onSelect(item)} detail={false} lines="none" style={{ '--background': 'transparent', ... }}>
        <div className="app-list-item app-list-item--events" style={{ borderLeftColor: statusColor }}>
          <div className="app-list-item__row">
            <div className="app-list-item__main">
              <div className="app-icon-circle app-icon-circle--lg" style={{ backgroundColor: statusColor }}>
                <IonIcon icon={statusIcon} />
              </div>
              <div className="app-list-item__content">
                <div className="app-list-item__title">{item.name}</div>
                <div className="app-list-item__meta">...</div>
              </div>
            </div>
          </div>
        </div>
      </IonItem>
    </IonItemSliding>
  ))}
</ListSection>
```

### Modal-Pattern

```typescript
// RICHTIG: useIonModal Hook
const [presentModal, dismissModal] = useIonModal(MyModal, {
  data: someData,
  onClose: () => dismissModal(),
  onSuccess: () => {
    dismissModal();
    loadData();
  }
});

// Öffnen mit presentingElement für Card-Animation
presentModal({ presentingElement: presentingElement || pageRef.current || undefined });
```

Modal-Komponenten haben immer:
- Beide `onClose` und optional `dismiss` (für `useIonModal`-Kompatibilität)
- `handleClose`-Funktion die `dismiss?.()` oder `onClose()` aufruft
- Toolbar-Buttons: `app-modal-close-btn` (links, X-Icon) und `app-modal-submit-btn--{domain}` (rechts, Checkmark-Icon)

### Segment/Tab-Switcher

```tsx
<div className="app-segment-wrapper">
  <IonSegment value={activeTab} onIonChange={(e) => onTabChange(e.detail.value as any)}>
    <IonSegmentButton value="meine"><IonLabel>Meine</IonLabel></IonSegmentButton>
    <IonSegmentButton value="alle"><IonLabel>Alle</IonLabel></IonSegmentButton>
  </IonSegment>
</div>
```

### Daten-Refresh-Pattern

Zwei parallele Mechanismen:
1. **Pull-to-Refresh:** `IonRefresher` → `handleRefresh` → `loadData()` → `event.detail.complete()`
2. **Live-Updates:** `useLiveRefresh('resource', refreshCallback)` über WebSocket (`src/contexts/LiveUpdateContext.tsx`)
3. **Custom DOM Events** (Legacy): `window.dispatchEvent(new CustomEvent('events-updated'))` in Views, Listener in Pages

---

## CSS-Klassen-Referenz

Alle Klassen in `src/theme/variables.css` definiert (1810 Zeilen).

**Domain-Farbcodes (konsistent überall):**
- Events: `#dc2626` (Rot)
- Activities: `#047857` (Dunkelgrün)
- Chat: `#06b6d4` (Cyan)
- Konfis/Requests/Primary: `#5b21b6` (Lila)
- Users/Organizations: `#667eea` (Indigo)
- Badges: `#f59e0b` (Gelb)
- Bonus: `#f97316` (Orange)
- Info/Jahrgang: `#007aff` (Blau, iOS)
- Level: `#ec4899` (Pink)
- Teamer: `#e11d48` (Dunkelrot)
- Warning: `#ff9500` (Orange, iOS)
- Success: `#34c759` (Grün, iOS)
- Danger: `#dc3545` (Rot)

**Wiederverwendbare Klassen:**
- `app-list-item`, `app-list-item--{color}`, `app-list-item--selected`
- `app-list-item__row`, `app-list-item__main`, `app-list-item__content`, `app-list-item__title`, `app-list-item__subtitle`, `app-list-item__meta`, `app-list-item__meta-item`
- `app-icon-circle`, `app-icon-circle--lg`, `app-icon-circle--{color}`
- `app-header-banner`, `app-header-banner__header`, `app-header-banner__icon`, `app-header-banner__title`
- `app-stats-row`, `app-stats-row__item`, `app-stats-row__value`, `app-stats-row__label`
- `app-section-icon`, `app-section-icon--{color}`
- `app-chip`, `app-chip--{color}`
- `app-tag`, `app-tag--{color}`
- `app-corner-badge`, `app-corner-badge--{color}`
- `app-reason-box`, `app-reason-box--danger/warning/info`
- `app-modal-section`, `app-modal-section-header`, `app-modal-footer`
- `app-modal-close-btn`, `app-modal-submit-btn--{domain}`
- `app-segment-wrapper`
- `app-condense-toolbar` (für `IonHeader collapse="condense"`)
- `app-auth-background`, `app-auth-container`

**CSS-Variablen:**
```css
--app-color-events: #dc2626;
--app-color-chat: #06b6d4;
/* ... alle Domain-Farben als CSS-Variablen in :root */
```

---

## Inline-Styles

Inline-Styles werden häufig für dynamische Werte verwendet, besonders für Farben (z.B. `statusColor`). Das ist gängige Praxis im Projekt.

```tsx
// Dynamische Farben — Inline-Style OK
<div className="app-list-item app-list-item--events" style={{ borderLeftColor: statusColor }}>
<div className="app-icon-circle" style={{ backgroundColor: statusColor }}>

// Ionic CSS-Custom-Properties — Inline-Style auf IonItem OK
<IonItem style={{ '--background': 'transparent', '--padding-start': '0' }}>
```

---

## Logging

**Frontend:**
- Entwicklung: `console.error()` und `console.warn()` erlaubt
- Production: `no-console` als ESLint Warning aktiv
- Kein Logging-Framework

**Backend:**
- `console.error('Database error in {METHOD} /api/{route}:', err)` für alle DB-Fehler
- Kein strukturiertes Logging

---

## Shared Components

**Verwendung von `src/components/shared/`:**
```typescript
import { SectionHeader, ListSection } from '../../shared';
// oder
import { SectionHeader, ListSection } from '../../shared/index';
```

Enthält: `SectionHeader`, `ListSection`, `EmptyState`, `LoadingSpinner` (in `common/`), `PushNotificationSettings`

---

*Convention analysis: 2026-03-20*
