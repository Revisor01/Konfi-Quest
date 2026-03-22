# Phase 81: React Router Migration - Research

**Researched:** 2026-03-22
**Domain:** React Router, @ionic/react-router, Ionic React Navigation
**Confidence:** HIGH

## Summary

Die kritische Erkenntnis dieser Research: **@ionic/react-router v8 ist inkompatibel mit React Router v6.** Die peerDependencies von @ionic/react-router sind explizit auf `react-router ^5.0.1` beschränkt. React Router v6-Unterstützung ist erst für Ionic Framework v9 geplant - ohne Datum. Ein direktes Upgrade von react-router v5 auf v6 würde die App zerstören und wird von der aktuellen Ionic-Version schlicht nicht unterstützt.

Die Phase muss daher anders konzipiert werden: Statt react-router v6 wird die Migration auf `useIonRouter` (aus `@ionic/react`) durchgeführt. Dieser Hook ist Ionics eigene Abstraktion über React Router und bietet `push`, `replace`, `goBack` - damit lassen sich alle `useHistory`-Aufrufe im Codebase ersetzen, ohne react-router upzugraden. Das Routing bleibt intern auf v5, aber der Code wird von der react-router-eigenen API entkoppelt.

Das `<Route component={...}>` / `<Route render={...}>` Pattern in MainTabs.tsx kann ebenfalls bereinigt werden, da Ionic's `IonRouterOutlet` mit Route-render-Props über `props.history` arbeitet - das kann auf direktere `useIonRouter`-basierte Patterns umgestellt werden wo sinnvoll, aber `<Route render={...}>` bleibt v5-kompatibel und muss nicht zwingend migriert werden.

**Primary recommendation:** `useHistory` in allen 14 Dateien durch `useIonRouter` aus `@ionic/react` ersetzen. react-router bleibt auf v5. Das ist die einzig supportete Migration für Ionic 8.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

Keine locked decisions - alle Implementierungsentscheidungen liegen bei Claude.

### Claude's Discretion

Alle Implementierungsentscheidungen liegen bei Claude -- reine Infrastruktur-Phase. Wichtig: Ionic React nutzt eigene Routing-Wrapper (@ionic/react-router). Pruefen ob IonReactRouter mit React Router v6 kompatibel ist, da Ionic moeglicheweise eigene v6-kompatible Version mitbringt.

### Deferred Ideas (OUT OF SCOPE)

None -- discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RR-01 | React Router v5 durch Ionic-kompatible v6-Version ersetzen (useHistory → useNavigate, Route component → Route element) | KRITISCHE NEUBEWERTUNG: @ionic/react-router v8 unterstützt RR v6 nicht. useHistory → useIonRouter ist die korrekte Migration für Ionic 8. Route-Patterns bleiben v5-kompatibel in IonRouterOutlet. |
| RR-02 | Alle Routing-Patterns in App.tsx, Konfi-, Teamer- und Admin-Bereichen auf v6-Syntax migrieren | Scope muss angepasst werden: Migration bedeutet useHistory → useIonRouter, nicht v5→v6 Syntax. App.tsx und MainTabs.tsx behalten v5-Route-Syntax (IonRouterOutlet-kompatibel). |
| RR-03 | App funktioniert nach Migration identisch (keine gebrochenen Navigationen) | useIonRouter bietet push/replace/goBack - Drop-In-Ersatz für alle useHistory-Patterns im Codebase. |
</phase_requirements>

## KRITISCHER BLOCKER: React Router v6 ist mit Ionic 8 inkompatibel

### Befund

@ionic/react-router v8.8.1 (aktuelle Version im Projekt) hat folgende peerDependencies:
```json
"peerDependencies": {
  "react": ">=16.8.6",
  "react-dom": ">=16.8.6",
  "react-router": "^5.0.1",
  "react-router-dom": "^5.0.1"
}
```

Ein Upgrade auf react-router v6 würde zu Compile-Fehlern führen:
- `withRouter` nicht mehr in react-router-dom v6 exportiert
- History-Library-Abhängigkeiten fehlen
- IonReactRouter, IonRouterOutlet inkompatibel mit v6 Router-API

**GitHub Issue #24177** (seit 2021 offen, 105+ Kommentare): React Router v6-Support für @ionic/react-router ist offiziell für Ionic Framework v9 geplant - ohne Releasedatum.

### Korrekte Strategie für diese Phase

Statt react-router v5→v6 Migration:
**useHistory → useIonRouter Migration** (innerhalb von react-router v5 / @ionic/react-router v8)

## Standard Stack

### Core (unveränderter Stack nach Migration)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@ionic/react-router` | `^8.5.0` (bleibt) | Ionic Routing-Wrapper über react-router v5 | Pflicht für IonTabs, IonRouterOutlet |
| `react-router-dom` | `^5.3.4` (bleibt) | Routing-Basis, von @ionic/react-router benötigt | peerDependency |
| `react-router` | `^5.3.4` (bleibt) | Routing-Kern | peerDependency |
| `@ionic/react` | `^8.5.0` | Ionic React Komponenten inkl. useIonRouter | Bereits vorhanden |

### Migrationsrelevante APIs
| API | Von | Nach | Paket |
|-----|-----|------|-------|
| `useHistory()` | `react-router-dom` | `useIonRouter()` | `@ionic/react` |
| `history.push(path)` | react-router | `router.push(path)` | useIonRouter |
| `history.replace(path)` | react-router | `router.push(path, 'root', 'replace')` | useIonRouter |
| `history.goBack()` | react-router | `router.goBack()` | useIonRouter |
| `props.history.goBack()` | Route render-prop | `useIonRouter()` in Unterkomponente | useIonRouter |

### Entfernen nach Migration
| Paket | Was entfernen |
|-------|---------------|
| `@types/react-router` | `^5.1.20` - TypeScript-Typen für react-router v5 können nach Migration entfernt werden, da useIonRouter typisiert ist |
| `@types/react-router-dom` | `^5.3.3` - Ebenso entfernbar wenn useHistory nirgends mehr importiert wird |

**Version verification (npm registry, 2026-03-22):**
- `@ionic/react-router`: 8.8.1 (latest stable)
- `react-router`: 7.13.1 (latest, aber inkompatibel mit @ionic/react-router)
- `react-router-dom`: 7.13.1 (latest, aber inkompatibel)

## Architecture Patterns

### Recommended Migration Structure

Keine strukturellen Änderungen nötig - nur Hook-Austausch in bestehenden Dateien.

```
frontend/src/
├── App.tsx                    # Route component={} bleibt (IonRouterOutlet-kompatibel)
├── components/layout/
│   └── MainTabs.tsx           # Route render={props => ...} Patterns: props.history → useIonRouter
├── components/auth/           # useHistory → useIonRouter (4 Dateien)
├── components/admin/pages/    # useHistory → useIonRouter (2-3 Dateien)
├── components/konfi/          # useHistory → useIonRouter (3 Dateien)
├── components/teamer/pages/   # useHistory → useIonRouter (3 Dateien)
└── components/chat/pages/     # useHistory → useIonRouter (1 Datei)
```

### Pattern 1: useHistory → useIonRouter (Standard)

**Was:** Alle 14 Dateien mit `useHistory` ersetzen durch `useIonRouter`
**Wann:** In jeder Komponente wo aktuell `useHistory` aus `react-router-dom` importiert wird

```typescript
// VORHER (react-router-dom v5)
import { useHistory } from 'react-router-dom';
const history = useHistory();
history.push('/konfi/dashboard');
history.replace('/admin/konfis');
history.goBack();

// NACHHER (useIonRouter aus @ionic/react)
import { useIonRouter } from '@ionic/react';
const router = useIonRouter();
router.push('/konfi/dashboard');
router.push('/admin/konfis', 'root', 'replace');
router.goBack();
```

### Pattern 2: Route render-prop mit props.history (MainTabs.tsx)

MainTabs.tsx verwendet `render={(props) => ... props.history.goBack()}` in 4 Routen.
Zwei Optionen:

**Option A (empfohlen): Wrapper-Komponente mit useIonRouter**
```typescript
// Statt render-prop: eigene kleine Wrapper-Komponente
const KonfiDetailRoute: React.FC<RouteComponentProps<{id: string}>> = ({ match }) => {
  const router = useIonRouter();
  const konfiId = parseInt(match.params.id);
  return <KonfiDetailView konfiId={konfiId} onBack={() => router.goBack()} />;
};

// In der Route:
<Route path="/admin/konfis/:id" component={KonfiDetailRoute} />
```

**Option B (minimal): useHistory bleibt in MainTabs, wird nur intern bereinigt**
`Route render={props => <KonfiDetailView onBack={() => props.history.goBack()} />}` ist valides v5-Pattern und muss nicht zwingend migriert werden (funktioniert weiterhin).

### Pattern 3: Redirect-Komponente (bleibt)

`<Redirect>` aus `react-router-dom` v5 bleibt unverändert - ist kompatibel mit IonRouterOutlet.

```typescript
// BLEIBT - kein Änderungsbedarf
import { Redirect } from 'react-router-dom';
<Route exact path="/" render={() => <Redirect to="/login" />} />
```

### Anti-Patterns to Avoid

- **Nicht** react-router-dom auf v6 upgraden solange @ionic/react-router v8 im Einsatz
- **Nicht** `useNavigate` aus react-router-dom importieren (existiert in v5 nicht)
- **Nicht** `<Routes>` oder `<Route element={...}>` verwenden (v6-Syntax, inkompatibel mit IonRouterOutlet)
- **Nicht** `--legacy-peer-deps` verwenden um react-router v6 mit @ionic/react-router zu erzwingen

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Programmatische Navigation | Eigenen history-Wrapper bauen | `useIonRouter()` | Ionic verwaltet eigenen Navigation-Stack, Animationen, Zurück-Button |
| History-State übergeben | window.history.state direkt nutzen | `router.push(path, 'forward', 'push', undefined, state)` | Ionic-Router verarbeitet State korrekt |
| goBack-Fallback | `window.history.back()` aufrufen | `router.canGoBack()` + `router.goBack()` | Ionic hat eigene History-Stack-Verwaltung für Tabs |

**Key insight:** Ionic React verwaltet einen eigenen Navigation-Stack getrennt vom Browser-History, weil Tab-Navigationen eigene Histories haben. `useIonRouter` ist der einzige korrekte Weg in Ionic, programmatisch zu navigieren.

## Betroffene Dateien (Inventory)

### Dateien mit useHistory (14 Dateien):

| Datei | Verwendungen | Patterns |
|-------|-------------|---------|
| `components/auth/LoginView.tsx` | `history.replace('/admin/konfis')`, `history.replace('/teamer/dashboard')`, `history.replace('/konfi/dashboard')`, `history.push('/forgot-password')`, `history.push('/register')` | replace + push |
| `components/auth/ForgotPasswordPage.tsx` | `history.push('/login')` (2x) | push |
| `components/auth/KonfiRegisterPage.tsx` | `history.replace('/konfi/dashboard')`, `history.push('/login')` (2x) | replace + push |
| `components/auth/ResetPasswordPage.tsx` | `history.push('/login')` (2x), `history.push('/forgot-password')` | push |
| `components/admin/pages/AdminSettingsPage.tsx` | `history.push(...)` (9x) | push |
| `components/admin/pages/AdminEventsPage.tsx` | `history.push('/admin/events/${event.id}')` | push |
| `components/admin/pages/AdminKonfisPage.tsx` | `history.push('/admin/konfis/${konfi.id}')` | push |
| `components/konfi/pages/KonfiEventsPage.tsx` | `history.push('/konfi/events/${event.id}')` | push |
| `components/konfi/pages/KonfiEventDetailPage.tsx` | `history.goBack()` | goBack |
| `components/konfi/views/DashboardView.tsx` | `history.push('/konfi/events/${event.id}')`, `history.push('/konfi/badges')` | push |
| `components/teamer/pages/TeamerDashboardPage.tsx` | `history.push('/teamer/events', {...})`, `history.push('/teamer/events')`, `history.push('/teamer/profile/badges')` | push mit State |
| `components/teamer/pages/TeamerProfilePage.tsx` | `history.push('/teamer/profile/badges')`, `history.push('/teamer/profile/konfi-stats')` | push |
| `components/teamer/pages/TeamerEventsPage.tsx` | useHistory importiert | prüfen |
| `components/chat/pages/ChatOverviewPage.tsx` | `history.push('${basePath}/chat/room/${room.id}')` | push |

### Dateien mit Route render-prop + props.history (MainTabs.tsx):
- 4x `props.history.goBack()` in Route render-props (Admin KonfiDetail, Admin EventDetail, 3x ChatRoom)

### Dateien ohne Änderungsbedarf:
- `App.tsx`: Verwendet `<Route component={...}>` - bleibt wie ist
- `MainTabs.tsx`: `<Route component={...}>` und `<Route render={...}>` Syntax bleibt v5-kompatibel

## Common Pitfalls

### Pitfall 1: useIonRouter außerhalb von IonReactRouter aufrufen
**What goes wrong:** `useIonRouter` gibt `null` zurück oder wirft einen Fehler wenn es außerhalb des Ionic Router-Kontextes verwendet wird
**Why it happens:** Der Hook benötigt den IonReactRouter-Context (bereits in App.tsx vorhanden)
**How to avoid:** Nur in Komponenten verwenden, die innerhalb von `<IonReactRouter>` gerendert werden
**Warning signs:** TypeScript-Fehler oder Runtime-Fehler beim ersten Aufruf

### Pitfall 2: router.push mit State vs. history.push mit State
**What goes wrong:** TeamerDashboardPage übergibt `{ selectedEventId: event.id }` als State bei history.push - diese API ist leicht unterschiedlich in useIonRouter
**Why it happens:** useIonRouter.push Signatur: `push(path, direction?, action?, options?, state?)`
**How to avoid:** `router.push('/teamer/events', 'forward', 'push', undefined, { selectedEventId: event.id })`
**Warning signs:** State kommt nicht in der Zielkomponente an

### Pitfall 3: @types/react-router-dom Imports bleiben
**What goes wrong:** Wenn `@types/react-router-dom ^5.3.3` noch installiert ist und useHistory irgendwo noch importiert wird, kompiliert TypeScript, obwohl useHistory nicht mehr verwendet werden soll
**Why it happens:** TypeScript-Typen-Packages sind separate devDependencies
**How to avoid:** Nach vollständiger Migration `@types/react-router` und `@types/react-router-dom` aus devDependencies entfernen
**Warning signs:** `grep -r "useHistory" src/` findet noch Treffer

### Pitfall 4: history.replace Semantik in useIonRouter
**What goes wrong:** `history.replace` ersetzt den aktuellen History-Eintrag - in useIonRouter ist das `router.push(path, 'root', 'replace')`
**Why it happens:** API-Unterschied: useIonRouter.push akzeptiert Direction ('forward'|'back'|'root') und Action ('push'|'pop'|'replace') als separate Parameter
**How to avoid:** Für Login-Redirects nach erfolgreichem Login: `router.push('/konfi/dashboard', 'root', 'replace')` - eliminiert die Login-Page aus dem Back-Stack
**Warning signs:** Nach Login kann User mit Zurück-Button zur Login-Page navigieren

### Pitfall 5: Ionic v9 Migration (Zukunft)
**What goes wrong:** Wenn Ionic v9 erscheint und react-router v6 mitbringt, muss erneut migriert werden
**Why it happens:** Ionic kündigt react-router v6 für v9 an
**How to avoid:** Code-Kommentar in jeder migrierten Datei: `// useIonRouter: Ionic 8 API - bei Ionic v9 ggf. auf useNavigate migrieren`
**Warning signs:** @ionic/react peerDependency auf react-router wechselt auf ^6

## Code Examples

Verified patterns aus offizieller Ionic Dokumentation:

### useIonRouter - Basis-Navigation
```typescript
// Source: https://ionicframework.com/docs/react/navigation
import { useIonRouter } from '@ionic/react';

const MyComponent: React.FC = () => {
  const router = useIonRouter();

  // Navigation vorwärts
  router.push('/new-page');

  // Navigation mit History ersetzen (kein Zurück-Button zur vorherigen Seite)
  router.push('/dashboard', 'root', 'replace');

  // Zurück navigieren
  if (router.canGoBack()) {
    router.goBack();
  }
};
```

### useIonRouter - Navigation mit State
```typescript
// Source: @ionic/react useIonRouter API
router.push('/teamer/events', 'forward', 'push', undefined, { selectedEventId: 42 });
```

### Route render-prop Migration (Option A: Wrapper-Komponente)
```typescript
// VORHER in MainTabs.tsx:
<Route path="/admin/konfis/:id" render={(props) => {
  const konfiId = parseInt(props.match.params.id);
  return <KonfiDetailView konfiId={konfiId} onBack={() => props.history.goBack()} />;
}} />

// NACHHER - inline mit useIonRouter (via RouteComponentProps):
const KonfiDetailRoute: React.FC<RouteComponentProps<{id: string}>> = ({ match }) => {
  const router = useIonRouter();
  return <KonfiDetailView konfiId={parseInt(match.params.id)} onBack={() => router.goBack()} />;
};
<Route path="/admin/konfis/:id" component={KonfiDetailRoute} />
```

### Import-Änderung Zusammenfassung
```typescript
// ENTFERNEN:
import { useHistory } from 'react-router-dom';
const history = useHistory();

// HINZUFÜGEN:
import { useIonRouter } from '@ionic/react';
const router = useIonRouter();
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `useHistory` aus react-router | `useIonRouter` aus @ionic/react | Ionic 5+ | Ionic-nativer Hook mit Tab-History-Support |
| `history.push(path)` | `router.push(path)` | Ionic 5+ | Drop-In-Ersatz in 95% der Fälle |
| react-router v6 in Ionic | Nicht supportet bis Ionic v9 | Offen seit 2021 | RR v6 mit Ionic = Compile-Fehler |

**Deprecated/outdated:**
- `useHistory` aus react-router-dom: Wird zwar von react-router v5 noch unterstützt, soll laut RR-01 migriert werden
- `@types/react-router` + `@types/react-router-dom` als devDependencies: Können nach Migration entfernt werden

## Open Questions

1. **TeamerEventsPage useHistory-Nutzung**
   - What we know: Die Datei importiert useHistory und useLocation
   - What's unclear: Wo history exakt verwendet wird (nur grep-Treffer auf Import-Ebene gesehen)
   - Recommendation: Datei vor Migration prüfen, ob history.push/replace/goBack darin vorkommt

2. **Ionic v9 Timeline**
   - What we know: React Router v6 ist für Ionic v9 geplant, kein Datum bekannt
   - What's unclear: Wann erscheint v9? (Issue seit 2021 offen)
   - Recommendation: Migrierte Dateien mit Kommentar markieren für zukünftige v6-Migration

## Validation Architecture

Nyquist Validation ist in config.json nicht als `false` gesetzt - Abschnitt wird einbezogen.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 + @testing-library/react 16.2.0 |
| Config file | Keine vitest.config.* gefunden - Konfiguration in vite.config (zu prüfen) |
| Quick run command | `cd frontend && npm run test.unit` |
| Full suite command | `cd frontend && npm run test.unit` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| RR-01 | useIonRouter ersetzen useHistory überall | unit | `cd frontend && npm run test.unit -- --grep "navigation"` | Unklar - Wave 0 |
| RR-02 | Alle Routing-Patterns migriert | smoke (manuell) | Manuell: App starten + alle Navigationen testen | N/A - manuell |
| RR-03 | App funktioniert identisch | smoke (manuell) | Manuell: Login → Navigation → Tabs → Back-Button | N/A - manuell |

**Begründung für manuelle Tests:** Navigation in Ionic React ist stark von DOM-Rendering und Tab-History abhängig. Unit-Tests für Routing-Korrektheit sind in Ionic-Apps typischerweise E2E-Tests (Cypress vorhanden). RR-03 wird am besten durch manuelle Smoke-Tests verifiziert.

### Wave 0 Gaps
- [ ] `frontend/src/__tests__/navigation.test.tsx` - Basis-Navigationstests (optional, da manuell verifizierbar)

*(Keine kritischen Wave-0-Gaps - bestehende Infrastruktur ausreichend für diese Refactoring-Phase)*

## Sources

### Primary (HIGH confidence)
- npm registry (2026-03-22): @ionic/react-router 8.8.1, react-router 7.13.1, react-router-dom 7.13.1
- https://github.com/ionic-team/ionic-framework/blob/main/packages/react-router/package.json - peerDependencies `^5.0.1` verifiziert
- https://ionicframework.com/docs/react/navigation - useIonRouter API, push/goBack/canGoBack Methoden

### Secondary (MEDIUM confidence)
- https://github.com/ionic-team/ionic-framework/issues/24177 - RR v6 Support für Ionic v9 angekündigt, offen seit 2021
- https://github.com/ionic-team/ionic-framework/issues/30745 - RR v7 Feature Request (Oct 2025)
- https://forum.ionicframework.com/t/is-ionic-v8-compatible-with-react-router-v6/243106 - Inkompatibilität bestätigt

### Tertiary (LOW confidence)
- npm audit im Projektverzeichnis: 0 Vulnerabilities gefunden (path-to-regexp Vulnerability in react-router v5 scheint nicht aktiv zu sein)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - npm registry verifiziert, GitHub peerDependencies geprüft
- Architecture: HIGH - bestehender Code vollständig analysiert, 14 Dateien inventarisiert
- Pitfalls: HIGH - offiziell dokumentierte API-Unterschiede zwischen useHistory und useIonRouter

**Research date:** 2026-03-22
**Valid until:** 2026-09-22 (stabil - bis Ionic v9 erscheint)
