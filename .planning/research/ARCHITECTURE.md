# Architecture Patterns

**Domain:** Konfigurierbare Punkte-Typen pro Jahrgang + Dashboard-Widget-Steuerung
**Researched:** 2026-03-07
**Confidence:** HIGH (basiert auf direkter Codebase-Analyse aller betroffenen Dateien)

## Ist-Zustand: Betroffene Architektur

### Punkte-System (aktuell)

```
Datenbank:
  konfi_profiles.gottesdienst_points  -- immer vorhanden, integer
  konfi_profiles.gemeinde_points      -- immer vorhanden, integer
  settings: target_gottesdienst       -- Org-weites Ziel (key-value, int)
  settings: target_gemeinde           -- Org-weites Ziel (key-value, int)

Backend:
  getPointField(type)                 -- Whitelist: 'gottesdienst' -> 'gottesdienst_points'
  activities.js                       -- Punkte addieren/subtrahieren via getPointField()
  konfi-managment.js                  -- Bonus-Punkte, Aktivitaeten-Zuweisung
  konfi.js /dashboard                 -- totalPoints = gottesdienst + gemeinde (IMMER)
  konfi.js /dashboard ranking         -- ORDER BY (gottesdienst_points + gemeinde_points)
  badges.js                           -- criteria_type: total_points, gottesdienst_points,
                                         gemeinde_points, both_categories
  levels.js                           -- Level basiert auf total_points (gottesdienst + gemeinde)

Frontend:
  ActivityRings.tsx                   -- 3 Ringe: Total, Gottesdienst, Gemeinde
  DashboardView.tsx                   -- Zeigt IMMER: Header+Rings, Konfirmation, Events,
                                         Tageslosung, Badges, Ranking
  KonfiDashboardPage.tsx              -- Laedt: /konfi/dashboard, /settings, /konfi/tageslosung,
                                         /konfi/events, /konfi/badges
  AdminGoalsPage.tsx                  -- Setzt target_gottesdienst, target_gemeinde
```

### Dashboard-Widgets (aktuell)

Das Dashboard ist ein monolithischer View mit 6 fest eingebauten Sektionen:

```
DashboardView.tsx Sektionen (Reihenfolge fest):
  1. Header Card + ActivityRings + Level Badge + Level Progress
  2. Konfirmation Card (wenn confirmation_date vorhanden)
  3. Events Section (wenn registrierte Events vorhanden)
  4. Tageslosung (wenn API-Daten verfuegbar)
  5. Badges Section (wenn Badges vorhanden)
  6. Ranking Section (wenn Ranking-Daten vorhanden)
```

Alle Sektionen sind hart kodiert. Es gibt KEINEN Mechanismus, einzelne Sektionen ein-/auszublenden.

### Settings-System (aktuell)

```sql
settings Tabelle:
  - Key-Value Store mit organization_id
  - Constraint: UNIQUE(organization_id, key)
  - Bestehende Keys: target_gottesdienst, target_gemeinde,
    konfi_chat_permissions, waitlist_enabled, max_waitlist_size
  - UPSERT Pattern: INSERT ... ON CONFLICT DO UPDATE
```

---

## Anforderung 1: Punkte-Typ pro Jahrgang auf 0 setzbar

### Problem-Analyse

"Auf 0 setzbar" bedeutet: Ein Jahrgang kann so konfiguriert werden, dass er NUR Gottesdienst-Punkte hat, NUR Gemeinde-Punkte hat, oder BEIDE. Das betrifft:

1. **ActivityRings:** Deaktivierter Ring darf nicht angezeigt werden
2. **Ranking:** Summe nur ueber aktive Punkte-Typen
3. **Badges:** criteria_type `gottesdienst_points`, `gemeinde_points`, `both_categories` muessen reagieren
4. **Fortschrittsbalken:** Level basiert auf Total Points -- nur aktive Typen zaehlen
5. **Punkte-Vergabe:** Aktivitaeten mit deaktiviertem Typ duerfen keine Punkte vergeben
6. **Ziele (AdminGoalsPage):** Deaktivierter Typ darf kein Ziel haben

### Wo speichern: Jahrgang-Tabelle (NICHT Settings)

Die Konfiguration gehoert an die `jahrgaenge` Tabelle, weil sie pro Jahrgang gilt, nicht pro Organisation.

**Gegen Settings-Tabelle:**
- Settings ist Org-weit, Punkte-Typen sind Jahrgang-spezifisch
- Eigene Keys wie `jahrgang_1_enable_gottesdienst` waeren ein Anti-Pattern im Key-Value-Store

**Fuer jahrgaenge-Tabelle:**
- Direkte Zuordnung: Jahrgang X hat Konfiguration Y
- Kein JOIN noetig, Daten kommen mit dem Jahrgang-Query
- Einfacheres Query-Pattern

### DB-Aenderung: jahrgaenge Tabelle

```sql
ALTER TABLE jahrgaenge ADD COLUMN enable_gottesdienst BOOLEAN DEFAULT TRUE;
ALTER TABLE jahrgaenge ADD COLUMN enable_gemeinde BOOLEAN DEFAULT TRUE;
```

**Defaults auf TRUE** -- bestehende Jahrgaenge behalten beide Punkte-Typen.

**Validierung:** Mindestens ein Typ muss aktiv sein (Backend-Constraint).

### Backend-Aenderungen

#### 1. jahrgaenge.js -- CRUD erweitern

```javascript
// POST/PUT: Neue Felder akzeptieren
const { name, confirmation_date, enable_gottesdienst, enable_gemeinde } = req.body;

// Validierung: Mindestens ein Typ
if (enable_gottesdienst === false && enable_gemeinde === false) {
  return res.status(400).json({ error: 'Mindestens ein Punkte-Typ muss aktiv sein' });
}

// INSERT/UPDATE Queries um Felder erweitern
```

#### 2. konfi.js /dashboard -- Punkte-Typ-Konfiguration mitsenden

Die Dashboard-Query joined bereits `jahrgaenge j`. Erweiterung:

```javascript
// SELECT ... j.enable_gottesdienst, j.enable_gemeinde ... FROM ...
// Im Response mitsenden:
res.json({
  // ... bestehende Daten ...
  point_config: {
    enable_gottesdienst: konfi.enable_gottesdienst,
    enable_gemeinde: konfi.enable_gemeinde
  }
});
```

#### 3. konfi.js /dashboard -- Ranking anpassen

```javascript
// AKTUELL:
// (kp.gottesdienst_points + kp.gemeinde_points) as points

// NEU (dynamisch basierend auf Jahrgang-Config):
const pointsExpression = buildPointsExpression(jahrgang);

function buildPointsExpression(jahrgang) {
  if (jahrgang.enable_gottesdienst && jahrgang.enable_gemeinde) {
    return '(kp.gottesdienst_points + kp.gemeinde_points)';
  } else if (jahrgang.enable_gottesdienst) {
    return 'kp.gottesdienst_points';
  } else {
    return 'kp.gemeinde_points';
  }
}
```

**Wichtig:** `getPointField()` in validation.js muss NICHT geaendert werden. Die Whitelist bleibt. Die Deaktivierung passiert auf Anzeige-/Konfigurations-Ebene, nicht auf Feld-Ebene.

#### 4. badges.js -- Deaktivierte Typen in Badge-Checks

```javascript
// In checkAndAwardBadges(): Jahrgang-Config laden
const { rows: [jahrgang] } = await db.query(
  'SELECT enable_gottesdienst, enable_gemeinde FROM jahrgaenge WHERE id = $1',
  [konfi.jahrgang_id]
);

// Badge-Criteria anpassen:
case 'gottesdienst_points':
  earned = jahrgang.enable_gottesdienst && konfi.gottesdienst_points >= badge.criteria_value;
  break;
case 'gemeinde_points':
  earned = jahrgang.enable_gemeinde && konfi.gemeinde_points >= badge.criteria_value;
  break;
case 'both_categories':
  // Nur pruefen was aktiv ist
  const gCheck = !jahrgang.enable_gottesdienst || konfi.gottesdienst_points >= badge.criteria_value;
  const mCheck = !jahrgang.enable_gemeinde || konfi.gemeinde_points >= badge.criteria_value;
  earned = gCheck && mCheck;
  break;
case 'total_points':
  // Total Points = Summe nur aktiver Typen
  const total = (jahrgang.enable_gottesdienst ? konfi.gottesdienst_points : 0)
              + (jahrgang.enable_gemeinde ? konfi.gemeinde_points : 0);
  earned = total >= badge.criteria_value;
  break;
```

#### 5. activities.js / konfi-managment.js -- Punkte-Vergabe blockieren

```javascript
// Vor Punkte-Vergabe: Pruefen ob Typ aktiv ist
const { rows: [jahrgang] } = await db.query(
  `SELECT j.enable_gottesdienst, j.enable_gemeinde
   FROM jahrgaenge j
   JOIN konfi_profiles kp ON kp.jahrgang_id = j.id
   WHERE kp.user_id = $1`, [konfiId]
);

const pointField = getPointField(activity.type);
if (pointField === 'gottesdienst_points' && !jahrgang.enable_gottesdienst) {
  return res.status(400).json({ error: 'Gottesdienst-Punkte sind fuer diesen Jahrgang deaktiviert' });
}
if (pointField === 'gemeinde_points' && !jahrgang.enable_gemeinde) {
  return res.status(400).json({ error: 'Gemeinde-Punkte sind fuer diesen Jahrgang deaktiviert' });
}
```

### Frontend-Aenderungen

#### 1. ActivityRings.tsx -- Dynamische Ring-Anzahl

```typescript
interface ActivityRingsProps {
  totalPoints: number;
  gottesdienstPoints: number;
  gemeindePoints: number;
  gottesdienstGoal: number;
  gemeindeGoal: number;
  enableGottesdienst?: boolean; // NEU
  enableGemeinde?: boolean;     // NEU
  size?: number;
}

// Im Render: Nur aktive Ringe anzeigen
// Wenn nur 1 Typ aktiv: 2 Ringe (Total + aktiver Typ)
// Wenn beide aktiv: 3 Ringe (wie bisher)
// Ring-Radien dynamisch berechnen basierend auf Anzahl aktiver Ringe
```

**Ansatz:** Aktive Ringe in ein Array sammeln, Radien dynamisch basierend auf `activeRings.length` berechnen. Legende zeigt nur aktive Typen.

#### 2. DashboardView.tsx -- point_config nutzen

```typescript
// DashboardData um point_config erweitern
interface DashboardData {
  // ... bestehend ...
  point_config?: {
    enable_gottesdienst: boolean;
    enable_gemeinde: boolean;
  };
}

// totalCurrentPoints nur aus aktiven Typen
const enableG = dashboardData.point_config?.enable_gottesdienst ?? true;
const enableM = dashboardData.point_config?.enable_gemeinde ?? true;
const totalCurrentPoints =
  (enableG ? gottesdienstPoints : 0) +
  (enableM ? gemeindePoints : 0);

// ActivityRings mit Config
<ActivityRings
  totalPoints={totalCurrentPoints}
  gottesdienstPoints={enableG ? gottesdienstPoints : 0}
  gemeindePoints={enableM ? gemeindePoints : 0}
  gottesdienstGoal={enableG ? targetGottesdienst : 0}
  gemeindeGoal={enableM ? targetGemeinde : 0}
  enableGottesdienst={enableG}
  enableGemeinde={enableM}
/>
```

#### 3. AdminGoalsPage.tsx -- Nur aktive Typen konfigurierbar

Muss Jahrgang-Konfiguration laden und deaktivierte Ziel-Felder ausblenden. Dazu muss der aktive Jahrgang bekannt sein oder die Goal-Seite muss die Jahrgang-Config mitladen.

**Empfehlung:** Da Goals Org-weit sind, aber Punkte-Typen Jahrgang-spezifisch, sollte AdminGoalsPage einen Hinweis zeigen, wenn ein Jahrgang einen Typ deaktiviert hat. Die Goals bleiben Org-weit (Minimum), aber im Frontend wird klar kommuniziert.

#### 4. Jahrgang-Bearbeitung -- UI fuer Punkte-Typ-Toggle

In der bestehenden Jahrgang-Bearbeitungs-UI (vermutlich ein Modal in der Admin-Ansicht) muessen zwei Toggles hinzugefuegt werden:

```
Gottesdienst-Punkte: [An/Aus]
Gemeinde-Punkte:     [An/Aus]
```

Mit Validierung: Mindestens einer muss aktiv sein.

---

## Anforderung 2: Dashboard-Widget-Konfiguration

### Problem-Analyse

Org-Admin soll festlegen koennen, welche Dashboard-Widgets fuer Konfis sichtbar sind. Betrifft:
- Tageslosung
- Ranking
- Badges (optional, da manche Gemeinden keine nutzen)
- Events (optional)
- Konfirmation-Countdown

Der Header mit ActivityRings ist NICHT konfigurierbar -- das ist das Kern-Feature.

### Wo speichern: Settings-Tabelle (Key-Value)

Dashboard-Widget-Sichtbarkeit ist Org-weit (nicht Jahrgang-spezifisch). Passt perfekt zum bestehenden Settings-Pattern.

```
Settings-Key                    | Default | Typ
dashboard_show_tageslosung      | true    | boolean
dashboard_show_ranking          | true    | boolean
dashboard_show_badges           | true    | boolean
dashboard_show_events           | true    | boolean
dashboard_show_konfirmation     | true    | boolean
```

### Backend-Aenderungen

#### 1. settings.js -- Neue Keys akzeptieren

```javascript
// PUT /settings erweitern:
const dashboardKeys = [
  'dashboard_show_tageslosung',
  'dashboard_show_ranking',
  'dashboard_show_badges',
  'dashboard_show_events',
  'dashboard_show_konfirmation'
];

for (const key of dashboardKeys) {
  if (req.body[key] !== undefined) {
    await db.query(
      `INSERT INTO settings (organization_id, key, value) VALUES ($1, $2, $3)
       ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
      [orgId, key, String(req.body[key])]
    );
  }
}

// GET /settings: Boolean-Parsing erweitern
const booleanKeys = ['waitlist_enabled', ...dashboardKeys];
if (booleanKeys.includes(row.key)) {
  settings[row.key] = row.value === 'true' || row.value === '1';
}
```

#### 2. Validierung in settings.js

```javascript
// Neue Validierungsregeln
for (const key of dashboardKeys) {
  body(key).optional().isBoolean().withMessage(`${key} muss ein Boolean sein`);
}
```

### Frontend-Aenderungen

#### 1. KonfiDashboardPage.tsx -- Settings an DashboardView weiterreichen

```typescript
interface Settings {
  target_gottesdienst?: number;
  target_gemeinde?: number;
  // NEU:
  dashboard_show_tageslosung?: boolean;
  dashboard_show_ranking?: boolean;
  dashboard_show_badges?: boolean;
  dashboard_show_events?: boolean;
  dashboard_show_konfirmation?: boolean;
}

// DashboardView erhaelt dashboard_config
<DashboardView
  // ... bestehende Props ...
  dashboardConfig={{
    showTageslosung: settings.dashboard_show_tageslosung ?? true,
    showRanking: settings.dashboard_show_ranking ?? true,
    showBadges: settings.dashboard_show_badges ?? true,
    showEvents: settings.dashboard_show_events ?? true,
    showKonfirmation: settings.dashboard_show_konfirmation ?? true
  }}
/>
```

#### 2. DashboardView.tsx -- Bedingte Sektion-Anzeige

```typescript
interface DashboardConfig {
  showTageslosung: boolean;
  showRanking: boolean;
  showBadges: boolean;
  showEvents: boolean;
  showKonfirmation: boolean;
}

interface DashboardViewProps {
  // ... bestehend ...
  dashboardConfig: DashboardConfig;
}

// In JSX: Jede Sektion mit Config-Guard wrappen
{dashboardConfig.showKonfirmation && (dashboardData.days_to_confirmation ...) && (
  <div className="app-dashboard-section app-dashboard-section--konfirmation">
    ...
  </div>
)}

{dashboardConfig.showEvents && regularEvents && regularEvents.length > 0 && (
  <div className="app-dashboard-section app-dashboard-section--events">
    ...
  </div>
)}

{dashboardConfig.showTageslosung && !loadingVerse && actualDailyVerse && ... && (
  <div className="app-dashboard-section app-dashboard-section--tageslosung">
    ...
  </div>
)}

{dashboardConfig.showBadges && (allBadges.available.length > 0 || ...) && (
  <div className="app-dashboard-section app-dashboard-section--badges">
    ...
  </div>
)}

{dashboardConfig.showRanking && dashboardData.ranking && ... && (
  <div className="app-dashboard-section app-dashboard-section--ranking">
    ...
  </div>
)}
```

**Kein Performance-Impact:** Die betroffenen Daten werden trotzdem geladen (Tageslosung-API, Badges, etc.), nur nicht gerendert. Bei Bedarf koennte man die API-Calls ebenfalls skippen, aber fuer Beta-Phase ist das unnoetig.

#### 3. Admin-UI: Dashboard-Konfig-Seite

Neues Modal/Page in Admin-Settings, erreichbar ueber AdminSettingsPage.tsx:

```
Dashboard konfigurieren
  [x] Tageslosung anzeigen
  [x] Ranking anzeigen
  [x] Badges anzeigen
  [x] Events anzeigen
  [x] Konfirmation-Countdown anzeigen
```

Implementierung als neues Modal (Pattern: useIonModal) analog zu AdminGoalsPage. Toggles als IonToggle-Items in einer IonList.

**Platzierung in AdminSettingsPage:** Unter "Inhalt"-Kategorie (bereits vorhanden in der Settings-Struktur, Stichwort "Konto/Verwaltung/Inhalt" aus v1.3).

---

## Komponentengrenzen (Soll-Zustand v1.6)

| Komponente | Verantwortung | Aenderung |
|-----------|---------------|-----------|
| jahrgaenge Tabelle | enable_gottesdienst, enable_gemeinde Flags | NEUE SPALTEN |
| jahrgaenge.js Route | CRUD fuer Punkte-Typ-Config | MODIFIZIERT |
| settings Tabelle | dashboard_show_* Keys | NEUE KEYS |
| settings.js Route | CRUD fuer Dashboard-Widget-Config | MODIFIZIERT |
| konfi.js /dashboard | point_config im Response, dynamisches Ranking | MODIFIZIERT |
| badges.js | Badge-Checks respektieren deaktivierte Typen | MODIFIZIERT |
| activities.js | Punkte-Vergabe fuer deaktivierte Typen blockieren | MODIFIZIERT |
| konfi-managment.js | Bonus-Vergabe fuer deaktivierte Typen blockieren | MODIFIZIERT |
| ActivityRings.tsx | Dynamische Ring-Anzahl | MODIFIZIERT |
| DashboardView.tsx | Bedingte Sektion-Anzeige, point_config nutzen | MODIFIZIERT |
| KonfiDashboardPage.tsx | dashboardConfig an View weiterreichen | MODIFIZIERT |
| AdminGoalsPage.tsx | Hinweis bei deaktivierten Typen | MODIFIZIERT |
| DashboardConfigModal.tsx | Toggle-UI fuer Dashboard-Widgets | NEU |
| AdminSettingsPage.tsx | Link zu DashboardConfigModal | MODIFIZIERT |
| Jahrgang-Modal | Toggles fuer Punkte-Typen | MODIFIZIERT |

---

## Datenfluss: Punkte-Typ-Konfiguration

```
Admin erstellt/bearbeitet Jahrgang
  |
  jahrgaenge.js PUT /api/jahrgaenge/:id
  { enable_gottesdienst: true, enable_gemeinde: false }
  |
  UPDATE jahrgaenge SET enable_gottesdienst = $1, enable_gemeinde = $2
  |
  LiveUpdate an Admins (bestehend)
  |
  +---> Konfi oeffnet Dashboard
  |       konfi.js GET /dashboard
  |       Query joined jahrgaenge -> liest enable_* Flags
  |       Response enthaelt point_config: { enable_gottesdienst, enable_gemeinde }
  |       |
  |       KonfiDashboardPage -> DashboardView
  |       -> ActivityRings (dynamische Ringe)
  |       -> Ranking (nur aktive Punkte-Typen)
  |
  +---> Admin vergibt Punkte
  |       activities.js oder konfi-managment.js
  |       Prueft Jahrgang-Config BEVOR Punkte vergeben werden
  |       Blockiert wenn Typ deaktiviert
  |
  +---> Badge-Check laeuft
          badges.js checkAndAwardBadges()
          Laedt Jahrgang-Config
          Deaktivierte Typen -> Badge nicht verdienbar (kein Fehler, einfach false)
```

## Datenfluss: Dashboard-Widget-Konfiguration

```
Org-Admin oeffnet Dashboard-Konfiguration
  |
  DashboardConfigModal laedt GET /settings
  |
  Admin toggled Widgets
  |
  PUT /settings { dashboard_show_ranking: false, ... }
  |
  settings Tabelle: UPSERT dashboard_show_ranking = 'false'
  |
  Konfi oeffnet Dashboard
  |
  KonfiDashboardPage laedt GET /settings (bestehender Call)
  settings.dashboard_show_ranking === false
  |
  DashboardView erhaelt dashboardConfig.showRanking = false
  |
  Ranking-Sektion wird nicht gerendert
```

---

## Build-Reihenfolge (Abhaengigkeiten beachtet)

```
Phase 1: DB-Schema + Backend-Foundation (keine Frontend-Abhaengigkeiten)
  |-- jahrgaenge: ALTER TABLE ADD enable_gottesdienst, enable_gemeinde
  |-- jahrgaenge.js: CRUD fuer neue Felder, Validierung
  |-- settings.js: dashboard_show_* Keys akzeptieren + validieren
  |-- konfi.js /dashboard: point_config im Response

Phase 2: Punkte-Logik anpassen (abhaengig von Phase 1)
  |-- activities.js: Punkte-Vergabe blockieren wenn Typ deaktiviert
  |-- konfi-managment.js: Bonus-Vergabe blockieren wenn Typ deaktiviert
  |-- badges.js: Badge-Checks respektieren deaktivierte Typen
  |-- konfi.js /dashboard: Ranking nur aktive Typen
  |-- levels.js: Level-Berechnung nur aktive Typen (falls betroffen)

Phase 3: Frontend Punkte-Anzeige (abhaengig von Phase 1+2)
  |-- ActivityRings.tsx: Dynamische Ring-Anzahl
  |-- DashboardView.tsx: point_config nutzen, Punkte-Anzeige anpassen
  |-- KonfiDashboardPage.tsx: point_config durchreichen
  |-- AdminGoalsPage.tsx: Hinweis bei deaktivierten Typen

Phase 4: Dashboard-Widget-Konfiguration (abhaengig von Phase 1)
  |-- DashboardConfigModal.tsx: Neues Modal erstellen
  |-- AdminSettingsPage.tsx: Link zum Modal
  |-- KonfiDashboardPage.tsx: dashboardConfig an DashboardView
  |-- DashboardView.tsx: Bedingte Sektion-Anzeige

Phase 5: Jahrgang-UI + End-to-End-Test (abhaengig von Phase 1-4)
  |-- Jahrgang-Modal: Punkte-Typ-Toggles
  |-- End-to-End: Jahrgang mit 1 Typ -> Dashboard, Badges, Ranking korrekt
  |-- Edge Cases: Typ deaktivieren wenn Konfis bereits Punkte haben
```

---

## Patterns to Follow

### Pattern 1: Defaults auf aktiv (bestehende Daten schuetzen)

```sql
-- BOOLEAN DEFAULT TRUE: Bestehende Jahrgaenge behalten beide Typen
ALTER TABLE jahrgaenge ADD COLUMN enable_gottesdienst BOOLEAN DEFAULT TRUE;
```

**Begruendung:** Keine Migration bestehender Daten noetig. Neue Spalten mit Defaults funktionieren transparent.

### Pattern 2: Settings Key-Value UPSERT (bestehend -- beibehalten)

```javascript
INSERT INTO settings (organization_id, key, value) VALUES ($1, $2, $3)
ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value
```

Dashboard-Widget-Config nutzt exakt dasselbe Pattern. Keine neue Tabelle noetig.

### Pattern 3: Frontend-Defaults mit Nullish Coalescing (bestehend)

```typescript
const targetGottesdienst = settings.target_gottesdienst || 10;
// NEU:
const showRanking = settings.dashboard_show_ranking ?? true;
```

**Wichtig:** `??` statt `||` fuer Booleans, da `false || true` zu `true` wuerde.

### Pattern 4: Fire-and-Forget Config-Loading (bestehend)

```typescript
const [dashboardResponse, settingsResponse] = await Promise.all([
  api.get('/konfi/dashboard'),
  api.get('/settings').catch(() => ({ data: {} }))
]);
```

Settings-Fehler blockieren nie das Dashboard. Fehlt die Config, greifen Defaults.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Punkte bei Deaktivierung loeschen

**Was passieren koennte:** Admin deaktiviert Gottesdienst-Punkte, System loescht bestehende Punkte.
**Stattdessen:** Punkte bleiben in der DB. Deaktivierung betrifft nur Anzeige, Vergabe und Berechnung. Bei Reaktivierung sind die Punkte sofort wieder da.

### Anti-Pattern 2: Separate Dashboard-Config-Tabelle

**Was verlockend waere:** Eigene Tabelle `dashboard_config` mit Spalten je Widget.
**Stattdessen:** Bestehende Settings-Tabelle nutzen. Key-Value-Store ist flexibel genug. Neue Tabelle wuerde das Pattern brechen und unnoetige Komplexitaet einfuehren.

### Anti-Pattern 3: API-Calls basierend auf Dashboard-Config skippen

**Was verlockend waere:** Wenn `showBadges = false`, keinen Badge-API-Call machen.
**Stattdessen:** Daten trotzdem laden, nur nicht rendern. Vereinfacht Code, vermeidet Race Conditions bei Config-Aenderungen, und der Performance-Impact ist bei <100 Usern irrelevant.

### Anti-Pattern 4: Punkte-Typ-Config in der Settings-Tabelle

**Was verlockend waere:** `settings` Key wie `jahrgang_1_enable_gottesdienst`.
**Stattdessen:** Spalten direkt an `jahrgaenge` Tabelle. Jahrgang-spezifische Config gehoert zum Jahrgang, nicht in ein Org-weites Key-Value-Store.

### Anti-Pattern 5: Frontend-seitige Punkte-Filterung ohne Backend

**Was gefaehrlich waere:** Backend liefert immer alle Punkte, Frontend filtert basierend auf Config.
**Stattdessen:** Backend muss Ranking, Badge-Checks und Punkte-Vergabe ebenfalls respektieren. Frontend-only waere inkonsistent und manipulierbar.

---

## Skalierbarkeit

| Aspekt | Aktuell (Beta) | Impakt von v1.6 |
|--------|---------------|-----------------|
| Settings-Tabelle | ~5 Keys/Org | +5 Keys/Org (Dashboard-Config) -- vernachlaessigbar |
| jahrgaenge-Tabelle | ~2-3/Org | +2 Spalten -- kein Impakt |
| Dashboard-Query | 6 Queries | Unveraendert, +1 Feld in bestehender Query |
| Badge-Check | Pro Konfi, pro Badge | +1 Query (Jahrgang-Config laden) -- cachebar |
| ActivityRings Render | 3 Ringe | 2-3 Ringe dynamisch -- kein Impakt |

---

## Edge Cases

### Edge Case 1: Typ deaktivieren wenn Konfis Punkte haben
**Verhalten:** Punkte bleiben, werden nur nicht angezeigt/gewertet. Bei Reaktivierung sofort wieder sichtbar.

### Edge Case 2: Beide Typen aktiv, ein Goal auf 0
**Aktuelles Verhalten:** ActivityRings nutzt `effectiveGoal = goal > 0 ? goal : 10`. Das bleibt. Ein Goal von 0 bedeutet "kein Ziel" (Ring laeuft endlos), nicht "Typ deaktiviert".

### Edge Case 3: Badge mit `both_categories` wenn ein Typ deaktiviert
**Verhalten:** Badge prueft nur aktive Typen. Wenn nur Gottesdienst aktiv, reicht Gottesdienst-Punkte >= criteria_value fuer `both_categories`.

### Edge Case 4: Dashboard-Config noch nicht gesetzt
**Verhalten:** Frontend-Defaults (alle Widgets an). Kein Settings-Eintrag = Default `true`.

---

## Quellen

- Direkte Codebase-Analyse:
  - konfi.js /dashboard Endpoint (Zeilen 32-272)
  - DashboardView.tsx (1400+ Zeilen, 6 Sektionen)
  - KonfiDashboardPage.tsx (305 Zeilen)
  - ActivityRings.tsx (350 Zeilen, 3 hardcoded Ringe)
  - settings.js (159 Zeilen, Key-Value UPSERT Pattern)
  - jahrgaenge.js (193 Zeilen, CRUD)
  - badges.js Badge-Checks (criteria_type Switch Statement)
  - activities.js + konfi-managment.js (getPointField Usage)
  - AdminGoalsPage.tsx (80 Zeilen, target_gottesdienst/target_gemeinde)
  - AdminSettingsPage.tsx (Settings-Navigation)

---
*Architecture research for: Konfi Quest v1.6 Dashboard-Konfig + Punkte-Logik*
*Researched: 2026-03-07*
