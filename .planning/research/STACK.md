# Technology Stack: v1.6 Dashboard-Konfig + Punkte-Logik

**Project:** Konfi Quest
**Researched:** 2026-03-07
**Scope:** Punkte-Typen pro Jahrgang konfigurierbar, Dashboard-Widgets fuer Org-Admins steuerbar
**Overall Confidence:** HIGH

---

## Empfehlung: Keine neuen Bibliotheken erforderlich

v1.6 braucht **null neue Dependencies**. Alle Features lassen sich mit dem bestehenden Stack umsetzen. Die Architektur aus v1.0-v1.5 (Settings-KV-Store, RBAC, AppContext, getPointField-Whitelist) traegt die neuen Anforderungen vollstaendig.

---

## Bestehender Stack (unveraendert)

| Technologie | Version | Zweck im Milestone | Warum ausreichend |
|-------------|---------|-------------------|-------------------|
| PostgreSQL (pg) | ^8.16.3 | Settings-KV-Store, Jahrgang-Spalten | `settings`-Tabelle mit `(organization_id, key)` UPSERT-Pattern existiert bereits |
| Express + express-validator | ^4.18.2 / ^7.3.1 | Neue Settings-Keys validieren und speichern | PUT `/settings` Route hat UPSERT-Pattern, einfach erweiterbar |
| React 19 + Ionic 8 | 19.0.0 / ^8.5.0 | Bedingte Widget-Darstellung, Toggle-UIs | Conditional Rendering reicht voellig |
| Axios | ^1.10.0 | Settings laden und speichern | Bestehender `api`-Service, keine Aenderung noetig |
| Socket.io | ^4.7.2 / ^4.8.1 | Live-Updates bei Settings-Aenderungen | `liveUpdate`-Pattern aus jahrgaenge.js wiederverwendbar |

---

## Datenbank-Strategie

### 1. Punkte-Typ-Konfiguration: Spalten auf `jahrgaenge`-Tabelle

```sql
ALTER TABLE jahrgaenge
  ADD COLUMN gottesdienst_enabled BOOLEAN DEFAULT true,
  ADD COLUMN gemeinde_enabled BOOLEAN DEFAULT true;
```

**Warum direkte Spalten statt Settings-KV:**
- Punkte-Typ-Konfiguration ist jahrgangs-spezifisch, nicht organisations-global
- Die bestehende `settings`-Tabelle hat keinen `jahrgang_id`-Bezug und ist fuer Org-weite Settings konzipiert
- Direkte Boolean-Spalten sind einfacher abzufragen (`WHERE j.gottesdienst_enabled = true`) als KV-Lookups
- Kein JSON-Parsing noetig, Boolean ist natuerlicher Datentyp fuer an/aus
- Backend `jahrgaenge.js` hat bereits CREATE/UPDATE Routes mit Validierung -- 2 neue `body()`-Checks reichen

**Warum NICHT Settings-Tabelle mit jahrgang_id:**
- Wuerde neuen Composite Key `(organization_id, jahrgang_id, key)` brauchen
- Ueberverkompliziert fuer 2 Boolean-Werte
- Jeder Punkte-Query muesste zusaetzlichen JOIN auf settings machen

### 2. Dashboard-Widget-Konfiguration: Bestehende `settings`-Tabelle

```sql
-- Neue Settings-Keys (Organization-Level), Default-Werte im Code
-- Kein Schema-Change noetig, nur neue Key-Value-Paare
INSERT INTO settings (organization_id, key, value) VALUES
  ($1, 'dashboard_show_losung', 'true'),
  ($1, 'dashboard_show_ranking', 'true'),
  ($1, 'dashboard_show_badges', 'true'),
  ($1, 'dashboard_show_events', 'true'),
  ($1, 'dashboard_show_level', 'true');
```

**Warum Settings-KV statt eigene Tabelle:**
- Dashboard-Widgets sind org-weite Einstellungen -- genau der Scope der `settings`-Tabelle
- UPSERT-Pattern (`ON CONFLICT ... DO UPDATE`) existiert bereits in `settings.js` (Zeile 99-113)
- GET Route liefert alle Keys als flaches Objekt -- Frontend kann direkt pruefen
- Kein Schema-Change noetig
- Bestehende Validierung leicht erweiterbar: `body('dashboard_show_losung').optional().isBoolean()`

**Defaults im Code, nicht in DB:**
- Wenn ein Key nicht in der DB existiert, interpretiert das Frontend es als `true` (alles sichtbar)
- Erst wenn OrgAdmin explizit etwas deaktiviert, wird ein Eintrag angelegt
- Kein Seeding-Script noetig, keine Migration fuer bestehende Organisationen

---

## Frontend-Strategie

### Conditional Rendering (kein neues Pattern)

Das Dashboard nutzt bereits bedingte Darstellung:

```typescript
// BESTEHENDES Pattern in DashboardView.tsx (Zeile 1237):
{dashboardData.ranking && dashboardData.ranking.length > 0 && (
  <div className="app-dashboard-section--ranking">...</div>
)}

// NEUES Pattern (identische Struktur):
{settings.dashboard_show_ranking !== false && dashboardData.ranking?.length > 0 && (
  <div className="app-dashboard-section--ranking">...</div>
)}
```

**Kein State-Management-Tool noetig.** Der bestehende `AppContext` laedt Settings bereits. Die DashboardView bekommt die Widget-Flags als Props.

### ActivityRings-Anpassung

Die `ActivityRings`-Komponente bekommt aktuell `gottesdienstGoal` und `gemeindeGoal` als Props. Wenn ein Typ deaktiviert ist:
- Goal auf 0 setzen und Ring visuell ausblenden
- Bei nur einem aktiven Typ: Einziger Ring wird zum Haupt-Ring
- Total-Ring (aeusserster) berechnet sich nur aus aktivierten Typen

### Dashboard-Sektionen (identifiziert aus DashboardView.tsx)

| Sektion | CSS-Klasse | Toggle-Key | Zeile |
|---------|-----------|------------|-------|
| Header + ActivityRings | `app-dashboard-header` | Immer sichtbar | 590 |
| Level-Icons | (inline im Header) | `dashboard_show_level` | 647 |
| Events | `app-dashboard-section--events` (implizit) | `dashboard_show_events` | ~780 |
| Tageslosung | `app-dashboard-section--tageslosung` | `dashboard_show_losung` | 917 |
| Badges | `app-dashboard-section--badges` | `dashboard_show_badges` | 964 |
| Ranking | `app-dashboard-section--ranking` | `dashboard_show_ranking` | 1238 |

**Header + ActivityRings bleiben immer sichtbar** -- sie sind das Kern-Element des Dashboards.

---

## Backend-Strategie

### `getPointField()` bleibt unveraendert

Die Whitelist-Funktion in `validation.js` (Zeile 24-35) validiert nur den Typ-String. Die Aenderung passiert an den Aufrufstellen -- vor der Punktevergabe wird geprueft ob der Punkte-Typ fuer den Jahrgang des Konfis aktiviert ist.

### Betroffene Backend-Routes

| Route | Aenderung | Risiko |
|-------|-----------|--------|
| `jahrgaenge.js` | Neue Boolean-Spalten in CREATE/UPDATE/GET | Niedrig |
| `settings.js` | Neue `dashboard_show_*` Keys in Validierung und UPSERT | Niedrig |
| `konfi.js` | Dashboard-Endpoint liefert Jahrgangs-Config + Widget-Settings mit | Mittel |
| `activities.js` | Punkte-Typ-Check vor Vergabe (Zeile 246, 320, 455) | Mittel |
| `konfi-managment.js` | Bonus-Punkte nur fuer aktivierte Typen (Zeile 476, 555, 609, 666) | Mittel |
| `events.js` | Event-Punkte nur vergeben wenn Typ aktiviert (Zeile 1316-1328) | Mittel |
| `badges.js` | Kriterien-Evaluation ignoriert deaktivierte Punkte-Typen | Hoch |
| `levels.js` | Level-Berechnung nur mit aktivierten Punkt-Typen | Hoch |

### Jahrgangs-Config an Punkte-Vergabe-Stellen

```javascript
// Pattern fuer alle Routes die Punkte vergeben:
// 1. Konfi-ID → User holen → Jahrgang-ID
// 2. Jahrgang laden → gottesdienst_enabled/gemeinde_enabled pruefen
// 3. Wenn Typ deaktiviert → 400 "Dieser Punktetyp ist fuer diesen Jahrgang deaktiviert"

const { rows: [jahrgang] } = await db.query(
  `SELECT j.gottesdienst_enabled, j.gemeinde_enabled
   FROM jahrgaenge j
   JOIN konfi_profiles kp ON kp.jahrgang_id = j.id
   WHERE kp.user_id = $1`,
  [konfiId]
);

if (pointType === 'gottesdienst' && !jahrgang.gottesdienst_enabled) {
  return res.status(400).json({ error: 'Gottesdienst-Punkte sind fuer diesen Jahrgang deaktiviert' });
}
```

---

## Explizit NICHT hinzufuegen

| Bibliothek | Warum nicht |
|------------|------------|
| react-grid-layout / react-beautiful-dnd | Drag-and-Drop Dashboard-Sortierung ist Over-Engineering. OrgAdmin braucht nur Toggles (an/aus), keine Reihenfolge. |
| zustand / redux / jotai | State-Management unnoetig. AppContext + Props reicht fuer Settings-Propagation. 6 Milestones konsistent mit React Context. |
| JSON Schema Validator (ajv) | Settings-Validierung laeuft ueber express-validator auf allen 15 Routes. |
| Feature-Flag-Service (LaunchDarkly, Unleash) | Massiv ueberdimensioniert fuer 5-7 Boolean-Toggles. Settings-Tabelle ist der richtige Ort. |
| react-hook-form / formik | Admin-Settings-UI hat wenige Toggle-Felder. IonToggle mit useState reicht. |
| jsonb-Spalte auf jahrgaenge | 2 Boolean-Werte rechtfertigen kein JSONB. Explizite Spalten sind klarer und type-safe. |

---

## Integrationspunkte

### Settings-Flow (Dashboard-Widgets)

```
OrgAdmin Settings-UI → PUT /api/settings → settings-Tabelle (org-scoped)
                                                    ↓
Konfi Dashboard Load → GET /api/settings → AppContext → DashboardView Props
```

### Punkte-Typ-Flow (Jahrgang)

```
Admin Jahrgang-Edit → PUT /api/jahrgaenge/:id → jahrgaenge-Tabelle
                                                      ↓
Punkte-Vergabe → Backend prueft jahrgang.gottesdienst_enabled/gemeinde_enabled
                                                      ↓
Dashboard → Konfi-Endpoint liefert enabled-Flags → ActivityRings passt sich an
```

### Betroffene Frontend-Komponenten

| Komponente | Aenderung |
|------------|-----------|
| `DashboardView.tsx` | Conditional Rendering aller Sektionen basierend auf Settings |
| `KonfiDashboardPage.tsx` | Widget-Settings laden und an DashboardView durchreichen |
| `ActivityRings.tsx` | Ein-Ring-Modus wenn nur ein Punkt-Typ aktiv |
| Admin Settings-View | Neue Sektion mit Dashboard-Toggles (IonToggle) |
| Admin Jahrgang-Edit-Modal | Gottesdienst/Gemeinde-Toggle hinzufuegen |
| `AppContext.tsx` | Settings-State um dashboard_show_* Flags erweitern |

---

## Versionen -- Alles aktuell

Alle bestehenden Dependencies sind auf aktuellem Stand (geprueft gegen package.json):
- React 19.0.0 -- aktuell
- Ionic 8.5.0 -- aktuell
- Capacitor 7.4.2 -- aktuell
- pg 8.16.3 -- aktuell
- Express 4.18.2 -- stabil (Express 5 ist noch nicht produktionsreif fuer Ionic-Backends)
- express-validator 7.3.1 -- aktuell

**Keine Updates noetig fuer v1.6.**

---

## Zusammenfassung: Was sich aendert

```
Backend:
  (keine neuen Dependencies)
  ~ backend/routes/jahrgaenge.js      # 2 neue Boolean-Spalten, Validierung
  ~ backend/routes/settings.js        # 5 neue dashboard_show_* Keys
  ~ backend/routes/konfi.js           # Dashboard-Endpoint liefert Config mit
  ~ backend/routes/activities.js      # Punkte-Typ-Guard vor Vergabe
  ~ backend/routes/konfi-managment.js # Punkte-Typ-Guard vor Vergabe
  ~ backend/routes/events.js          # Punkte-Typ-Guard vor Vergabe
  ~ backend/routes/badges.js          # Kriterien ignorieren deaktivierte Typen
  ~ backend/routes/levels.js          # Berechnung nur mit aktiven Typen

Frontend:
  (keine neuen Dependencies)
  ~ DashboardView.tsx                 # Conditional Rendering per Section
  ~ KonfiDashboardPage.tsx            # Widget-Settings laden
  ~ ActivityRings.tsx                 # Ein-Ring-Modus
  ~ Admin Settings-View              # Dashboard-Toggle-UI
  ~ Admin Jahrgang-Edit              # Punkte-Typ-Toggles
  ~ AppContext.tsx                    # Settings-State erweitern

Datenbank:
  + ALTER TABLE jahrgaenge ADD COLUMN gottesdienst_enabled BOOLEAN DEFAULT true
  + ALTER TABLE jahrgaenge ADD COLUMN gemeinde_enabled BOOLEAN DEFAULT true
  (settings-Tabelle: nur neue KV-Paare, kein Schema-Change)
```

---

## Quellen

- Codebase-Analyse: `settings.js` UPSERT-Pattern (Zeile 99-148)
- Codebase-Analyse: `jahrgaenge.js` CREATE/UPDATE Routes
- Codebase-Analyse: `DashboardView.tsx` Sektions-Struktur (1400+ Zeilen)
- Codebase-Analyse: `getPointField()` Whitelist in `validation.js`
- Codebase-Analyse: `KonfiDashboardPage.tsx` Settings-Loading

**Confidence: HIGH** -- Alle Empfehlungen basieren auf direkter Codebase-Analyse. Keine externen Abhaengigkeiten, keine unverifizierten Claims.

---

*Stack research for: Konfi Quest v1.6 Dashboard-Konfig + Punkte-Logik*
*Researched: 2026-03-07*
