# Phase 32: Punkte-UI Frontend - Research

**Researched:** 2026-03-08
**Domain:** React/Ionic Frontend - Dynamische Punkte-Anzeige basierend auf Jahrgang-Konfiguration
**Confidence:** HIGH

## Summary

Diese Phase erfordert Aenderungen an 5 Frontend-Komponenten, die alle Punkte-bezogenen UI-Elemente dynamisch an die Jahrgang-Konfiguration (`gottesdienst_enabled`/`gemeinde_enabled`) anpassen. Das Backend liefert bereits `point_config` im Dashboard-Endpoint (`/konfi/dashboard`), aber die Frontend-Komponenten ignorieren es aktuell komplett.

Der Hauptaufwand liegt in `ActivityRings.tsx` (dynamische Ring-Anzahl), `DashboardView.tsx` (point_config propagieren, Ranking anpassen), `KonfisView.tsx` (Progress-Bars bedingt rendern), `KonfiDetailView.tsx` (Admin-Ansicht mit ausgegraut-Pattern) und `PointsHistoryModal.tsx` (Filterung nach aktiven Typen).

**Primary recommendation:** `point_config` vom Dashboard-Endpoint durchreichen und in jeder Komponente als Steuerung fuer bedingtes Rendering verwenden. ActivityRings erhaelt neue Props `gottesdienstEnabled`/`gemeindeEnabled` statt Ring-Anzahl hart zu kodieren.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- ActivityRings: Dynamische Ring-Anzahl (1 Ring bei 1 aktivem Typ, 3 Ringe bei 2 aktiven Typen inkl. Total)
- Bei 1 aktivem Typ: kein Total-Ring (waere identisch)
- Ring-Groesse bleibt konstant (size=160), kein Layout-Sprung
- Stats unter den Ringen zeigen nur aktive Typen (kein Gesamt-Chip bei 1 Typ)
- Gleiches Verhalten in Admin-KonfiDetailView wie im Konfi-Dashboard
- Konfi-Ansicht: Deaktivierte Typen komplett ausblenden (Progress-Bars und Chips)
- Bei 1 aktivem Typ: nur 1 Progress-Bar, kein Gesamt-Chip
- Admin-KonfiDetailView: Deaktivierte Typen ausgegraut mit '(deaktiviert)' Label sichtbar
- Admin sieht historische Punktedaten auch fuer deaktivierte Typen
- Ranking-Label bleibt generisch 'Punkte' (Backend liefert schon korrekte Summe nur aktiver Typen)
- Admin-Ranking (KonfisView Sortierung) nutzt gleiche Logik wie Konfi-Ranking (nur aktive Typen)
- Konfi-Ansicht (PointsHistoryModal): Eintraege deaktivierter Typen komplett ausblenden
- Admin-Ansicht (KonfiDetailView): Alle historischen Eintraege sichtbar, deaktivierte ausgegraut mit Label

### Claude's Discretion
- CSS-Klassen fuer ausgegraut-Darstellung in Admin-Views
- Exakte Implementierung der dynamischen Ring-Berechnung
- Wie point_config vom Dashboard-Endpoint in die Komponenten propagiert wird
- Uebergangsanimation wenn sich Ring-Anzahl aendert (oder keine)

### Deferred Ideas (OUT OF SCOPE)
None -- Diskussion blieb im Phase-Scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PUI-01 | ActivityRings zeigen nur aktive Punkte-Typen (dynamische Ring-Anzahl) | ActivityRings.tsx Props erweitern um `gottesdienstEnabled`/`gemeindeEnabled`, Ring-Rendering bedingt, Legende bedingt |
| PUI-02 | Progress-Bars/Fortschrittsbalken blenden deaktivierte Typen aus | KonfisView.tsx und KonfiDetailView.tsx: bedingte Rendering-Logik, Admin-Variante mit ausgegraut-Pattern |
| PUI-03 | Ranking beruecksichtigt nur aktive Punkte-Typen | Backend liefert bereits korrekte Summen; Frontend-Ranking in DashboardView.tsx zeigt total_points (schon korrekt); KonfisView-Sortierung muss angepasst werden |
| PUI-05 | Punkte-Historie blendet deaktivierte Typen aus | PointsHistoryModal.tsx: Filter auf history-Array nach aktiven Typen; point_config muss verfuegbar sein |
</phase_requirements>

## Architecture Patterns

### Datenfluss: point_config vom Backend zu den Komponenten

**Konfi-Seite (Dashboard):**
```
Backend /konfi/dashboard
  -> { point_config: { gottesdienst_enabled, gemeinde_enabled, target_gottesdienst, target_gemeinde } }
  -> KonfiDashboardPage (laedt Daten)
    -> DashboardView (erhaelt point_config als Prop)
      -> ActivityRings (erhaelt enabled-Flags als Props)
    -> PointsHistoryModal (erhaelt point_config oder enabled-Flags)
```

**Admin-Seite (KonfisView):**
```
Backend /admin/jahrgaenge
  -> [{ id, name, gottesdienst_enabled, gemeinde_enabled, target_gottesdienst, target_gemeinde }]
  -> AdminKonfisPage (laedt jahrgaenge mit Config)
    -> KonfisView (erhaelt jahrgaenge mit Config, mappt pro Konfi)
```

**Admin-Seite (KonfiDetailView):**
```
Backend /admin/konfis/:id  (aktuell OHNE point_config!)
  -> Muss entweder:
    a) jahrgang_id nutzen um Config aus jahrgaenge-Liste zu holen, ODER
    b) Backend erweitern um j.gottesdienst_enabled, j.gemeinde_enabled, j.target_gottesdienst, j.target_gemeinde mitzuliefern
  -> KonfiDetailView (hat dann point_config)
    -> ActivityRings (mit enabled-Flags)
```

### Aktuelle Luecken im Datenfluss

1. **KonfiDashboardPage** laedt `settings` separat ueber `/settings` fuer target-Werte -- muss auf `point_config` aus Dashboard-Response umgestellt werden
2. **DashboardView** erhaelt `targetGottesdienst`/`targetGemeinde` als Props, aber NICHT `gottesdienstEnabled`/`gemeindeEnabled`
3. **KonfiDetailView** laedt Settings ueber `/settings` -- muss stattdessen Jahrgang-spezifische Config nutzen
4. **KonfisView** nutzt `settings.target_gottesdienst` global -- muss pro-Jahrgang Config nutzen
5. **PointsHistoryModal** hat keinen Zugang zu point_config -- muss als Prop oder via Backend mitgeliefert werden
6. **Admin-Konfi-Detail-Endpoint** (`/admin/konfis/:id`) liefert `jahrgang_id` und `jahrgang_name`, aber NICHT die Config-Spalten -- muss erweitert werden

### Empfohlene Loesung fuer Datenfluss

**Option A (empfohlen): Backend-Endpunkte minimal erweitern + Props durchreichen**

- `/konfi/dashboard` liefert bereits `point_config` -- nutzen statt `/settings`
- `/admin/konfis/:id` erweitern: `j.gottesdienst_enabled, j.gemeinde_enabled, j.target_gottesdienst, j.target_gemeinde` im JOIN
- `/admin/jahrgaenge` liefert bereits die Config-Spalten
- KonfisView: Jahrgang-Config pro Konfi matchen (konfi.jahrgang_name -> jahrgang.name)
- PointsHistoryModal: point_config als Prop durchreichen

### Betroffene Dateien (komplett)

| Datei | Aenderungsart | Umfang |
|-------|---------------|--------|
| `frontend/src/components/admin/views/ActivityRings.tsx` | Props erweitern, bedingtes Ring-Rendering | Mittel |
| `frontend/src/components/konfi/views/DashboardView.tsx` | point_config als Prop, bedingte Anzeige | Klein |
| `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` | point_config aus Dashboard-Response nutzen | Klein |
| `frontend/src/components/konfi/modals/PointsHistoryModal.tsx` | point_config als Prop, Filter-Logik | Klein |
| `frontend/src/components/admin/KonfisView.tsx` | Pro-Jahrgang Config, bedingte Progress-Bars | Mittel |
| `frontend/src/components/admin/pages/AdminKonfisPage.tsx` | Jahrgaenge-Config durchreichen | Klein |
| `frontend/src/components/admin/views/KonfiDetailView.tsx` | Admin-ausgegraut-Pattern, Jahrgang-Config nutzen | Mittel |
| `backend/routes/konfi-managment.js` | Jahrgang-Config-Spalten in Konfi-Detail-Query | Klein |

## Code Examples

### ActivityRings: Dynamische Ring-Anzahl

```typescript
// Neue Props-Erweiterung
interface ActivityRingsProps {
  totalPoints: number;
  gottesdienstPoints: number;
  gemeindePoints: number;
  gottesdienstGoal: number;
  gemeindeGoal: number;
  size?: number;
  gottesdienstEnabled?: boolean;  // NEU
  gemeindeEnabled?: boolean;      // NEU
}

// Aktive Typen bestimmen
const activeTypes: Array<'gottesdienst' | 'gemeinde'> = [];
if (gottesdienstEnabled !== false) activeTypes.push('gottesdienst');
if (gemeindeEnabled !== false) activeTypes.push('gemeinde');
const showTotal = activeTypes.length === 2;

// Ring-Rendering: Dynamisch basierend auf aktiven Typen
// Bei 2 aktiven: 3 Ringe (Total aussen, Godi mitte, Gemeinde innen) -- wie bisher
// Bei 1 aktivem: 1 Ring (der aktive Typ auf Aussenring-Position)
// Bei 0 aktiven: Keine Ringe (Fallback-Anzeige)
```

### Ring-Radien-Berechnung bei dynamischer Anzahl

```typescript
// Konstante Groesse, aber Ringe passen sich an
const getRingConfig = () => {
  if (showTotal) {
    // 3 Ringe: Total, Gottesdienst, Gemeinde
    return [
      { radius: ringRadii[0], type: 'total' },
      { radius: ringRadii[1], type: 'gottesdienst' },
      { radius: ringRadii[2], type: 'gemeinde' }
    ].filter(r => {
      if (r.type === 'total') return showTotal;
      if (r.type === 'gottesdienst') return gottesdienstEnabled !== false;
      if (r.type === 'gemeinde') return gemeindeEnabled !== false;
      return false;
    });
  }
  // 1 Ring: Nutze Aussenring-Radius fuer den aktiven Typ
  if (gottesdienstEnabled !== false) {
    return [{ radius: ringRadii[0], type: 'gottesdienst' }];
  }
  if (gemeindeEnabled !== false) {
    return [{ radius: ringRadii[0], type: 'gemeinde' }];
  }
  return [];
};
```

### Zentrale Anzeige im Ring

```typescript
// Bei 1 aktivem Typ: Punkte des aktiven Typs anzeigen
// Bei 2 aktiven Typen: Gesamtpunkte anzeigen (wie bisher)
const centerValue = showTotal
  ? totalPoints
  : (gottesdienstEnabled !== false ? gottesdienstPoints : gemeindePoints);
```

### KonfisView: Bedingte Progress-Bars

```typescript
// Jahrgang-Config pro Konfi matchen
const getJahrgangConfig = (konfi: Konfi) => {
  const jg = jahrgaenge.find(j => j.name === konfi.jahrgang_name);
  return {
    gottesdienstEnabled: jg?.gottesdienst_enabled ?? true,
    gemeindeEnabled: jg?.gemeinde_enabled ?? true,
    targetGottesdienst: jg?.target_gottesdienst ?? 10,
    targetGemeinde: jg?.target_gemeinde ?? 10
  };
};

// Im Render: Bedingte Progress-Bars
const config = getJahrgangConfig(konfi);
const showBothBars = config.gottesdienstEnabled && config.gemeindeEnabled;

// Nur aktive Bars anzeigen, Gesamt nur wenn beide aktiv
{config.gottesdienstEnabled && (
  <div style={{ flex: 1 }}>/* Godi Progress */</div>
)}
{config.gemeindeEnabled && (
  <div style={{ flex: 1 }}>/* Gemeinde Progress */</div>
)}
{showBothBars && (
  <div>/* Gesamt Progress */</div>
)}
```

### Admin-Ausgegraut-Pattern (KonfiDetailView)

```typescript
// CSS fuer ausgegraut
const disabledStyle = {
  opacity: 0.4,
  filter: 'grayscale(100%)',
  position: 'relative' as const
};

const DisabledLabel: React.FC = () => (
  <span style={{
    fontSize: '0.6rem',
    color: '#999',
    fontWeight: '600',
    marginLeft: '4px'
  }}>
    (deaktiviert)
  </span>
);

// Im Render
<div style={!config.gottesdienstEnabled ? disabledStyle : {}}>
  <span>Godi {!config.gottesdienstEnabled && <DisabledLabel />}</span>
  {/* Progress-Bar */}
</div>
```

### PointsHistoryModal: Filter nach aktiven Typen

```typescript
// Props erweitern
interface PointsHistoryModalProps {
  onClose: () => void;
  pointConfig?: {
    gottesdienst_enabled: boolean;
    gemeinde_enabled: boolean;
  };
}

// Filter anwenden
const filteredHistory = useMemo(() => {
  if (!pointConfig) return history; // Fallback: alles zeigen
  return history.filter(entry => {
    if (entry.category === 'gottesdienst' && !pointConfig.gottesdienst_enabled) return false;
    if (entry.category === 'gemeinde' && !pointConfig.gemeinde_enabled) return false;
    return true;
  });
}, [history, pointConfig]);

// Totals ebenfalls anpassen
const activeTotals = {
  gottesdienst: pointConfig?.gottesdienst_enabled !== false ? totals.gottesdienst : 0,
  gemeinde: pointConfig?.gemeinde_enabled !== false ? totals.gemeinde : 0,
  total: (pointConfig?.gottesdienst_enabled !== false ? totals.gottesdienst : 0)
       + (pointConfig?.gemeinde_enabled !== false ? totals.gemeinde : 0)
};
```

### Backend-Erweiterung: Konfi-Detail mit Jahrgang-Config

```sql
-- In konfi-managment.js GET /:id Query erweitern:
SELECT u.*, kp.gottesdienst_points, kp.gemeinde_points,
       j.name as jahrgang_name, j.id as jahrgang_id,
       j.gottesdienst_enabled, j.gemeinde_enabled,
       j.target_gottesdienst, j.target_gemeinde
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
WHERE u.id = $1 AND r.name = 'konfi' AND u.organization_id = $2
```

## Common Pitfalls

### Pitfall 1: KonfiDashboardPage nutzt /settings statt point_config
**What goes wrong:** KonfiDashboardPage laedt Targets aus `/settings` (org-weit), aber seit Phase 30 sind Targets pro Jahrgang. Dashboard-Endpoint liefert bereits `point_config` mit den korrekten Jahrgang-spezifischen Werten.
**How to avoid:** `settings` Abruf ersetzen durch `dashboardResponse.data.point_config` fuer Targets UND enabled-Flags.

### Pitfall 2: KonfisView zeigt alle Konfis mit gleichen Targets
**What goes wrong:** KonfisView nutzt `settings.target_gottesdienst`/`target_gemeinde` global -- seit Phase 30 hat jeder Jahrgang eigene Targets und enabled-Flags.
**How to avoid:** Pro Konfi den Jahrgang matchen und dessen Config nutzen. Jahrgaenge-Array wird bereits geladen.

### Pitfall 3: Ranking-Punkte im Frontend manuell berechnen
**What goes wrong:** DashboardView berechnet `totalCurrentPoints = gottesdienstPoints + gemeindePoints` manuell (Zeile 545). Das Backend liefert aber `total_points` bereits korrekt berechnet (nur aktive Typen).
**How to avoid:** `dashboardData.total_points` verwenden statt manueller Addition. Oder: bei der manuellen Berechnung enabled-Flags beruecksichtigen.

### Pitfall 4: ActivityRings-Animation bei Ring-Anzahl-Wechsel
**What goes wrong:** Wenn sich die Ring-Anzahl aendert (z.B. Admin deaktiviert einen Typ), koennte ein Layout-Sprung entstehen.
**How to avoid:** Ring-Groesse (size) bleibt konstant. Bei 1 Ring einfach den aeusseren Radius nutzen -- kein Jump.

### Pitfall 5: PointsHistoryModal ohne point_config
**What goes wrong:** PointsHistoryModal wird via useIonModal instantiiert. Props muessen dort durchgereicht werden. Vergisst man das, zeigt die Historie weiterhin alle Eintraege.
**How to avoid:** `point_config` als Prop in useIonModal-Aufruf mitgeben.

### Pitfall 6: Admin-KonfiDetailView laedt Settings global
**What goes wrong:** KonfiDetailView hat `loadSettings()` das `/settings` abruft (Zeile 176-186). Das liefert org-weite target-Werte, nicht jahrgang-spezifische.
**How to avoid:** Backend-Query fuer Konfi-Detail erweitern um Jahrgang-Config-Spalten, dann diese Werte nutzen statt `/settings`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Punkte-Summe nur aktiver Typen | Frontend-Logik die Punkte filtert | `dashboardData.total_points` vom Backend | Backend berechnet bereits korrekt, doppelte Logik = Fehlerquelle |
| Ranking nur aktiver Typen | Frontend-Filter auf Ranking-Array | Backend-Query (bereits implementiert) | Backend liefert schon korrekte total_points und Reihenfolge |

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Org-weite Targets aus `/settings` | Pro-Jahrgang Targets aus `jahrgaenge`-Tabelle | Phase 30 (2026-03-07) | KonfiDashboardPage und KonfiDetailView muessen umgestellt werden |
| Alle Punkte-Typen immer sichtbar | Bedingte Anzeige basierend auf Jahrgang-Config | Phase 32 (diese Phase) | 5 Komponenten betroffen |
| 3 Ringe immer in ActivityRings | Dynamische Ring-Anzahl | Phase 32 (diese Phase) | ActivityRings Props erweitern |

## Open Questions

1. **PointsHistoryModal: Backend-Filter oder Frontend-Filter?**
   - Was wir wissen: Backend liefert alle Eintraege unabhaengig von point_config
   - Was klar ist: Konfi-Ansicht filtert im Frontend (einfacher, point_config als Prop)
   - Recommendation: Frontend-Filter reicht aus, da Datenmenge pro Konfi klein ist

2. **KonfisView: Wie kommt point_config pro Konfi?**
   - Was wir wissen: AdminKonfisPage laedt jahrgaenge UND konfis
   - Recommendation: Jahrgaenge-Array an KonfisView durchreichen (wird bereits gemacht), dort pro Konfi matchen

## Sources

### Primary (HIGH confidence)
- Codebase-Analyse: ActivityRings.tsx (350 Zeilen, hardcoded 3 Ringe)
- Codebase-Analyse: DashboardView.tsx (point_config nicht genutzt, targets aus settings)
- Codebase-Analyse: KonfiDashboardPage.tsx (settings separat geladen)
- Codebase-Analyse: KonfisView.tsx (globale targets, keine enabled-Pruefung)
- Codebase-Analyse: KonfiDetailView.tsx (settings aus /settings, keine jahrgang-config)
- Codebase-Analyse: PointsHistoryModal.tsx (keine Filterung nach aktiven Typen)
- Backend konfi.js: Dashboard-Endpoint liefert point_config (Zeile 236-241, 266)
- Backend konfi-managment.js: Konfi-Detail ohne Jahrgang-Config-Spalten (Zeile 398-406)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Reiner React/Ionic Code, keine neuen Bibliotheken
- Architecture: HIGH - Datenfluss klar analysiert, alle Luecken identifiziert
- Pitfalls: HIGH - Alle betroffenen Stellen im Code verifiziert

**Research date:** 2026-03-08
**Valid until:** 2026-04-08 (stabil, internes Projekt)
