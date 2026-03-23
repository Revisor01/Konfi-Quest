# Phase 31: Punkte-Logik Backend - Research

**Researched:** 2026-03-07
**Domain:** Backend-Validierung, Badge-Logik, Ranking-Queries
**Confidence:** HIGH

## Summary

Phase 31 implementiert Backend-Guards fuer deaktivierte Punkte-Typen. Phase 30 hat die DB-Spalten `gottesdienst_enabled` und `gemeinde_enabled` auf der `jahrgaenge`-Tabelle eingefuehrt. Jetzt muessen alle Punkte-Vergabe-Endpunkte pruefen, ob der jeweilige Typ fuer den Jahrgang des Konfis aktiviert ist, bevor Punkte vergeben werden.

Es gibt genau **5 Eintrittspunkte** fuer Punktevergabe im Backend: (1) `POST /api/activities/assign-activity`, (2) `PUT /api/activities/requests/:id` (Approval), (3) `POST /api/konfis/:id/bonus-points`, (4) `POST /api/konfis/:id/activities`, (5) Event-Attendance in `events.js` (Zeile ~1313). Alle muessen einen Guard erhalten. Zusaetzlich muss die Badge-Logik (`checkAndAwardBadges`) und die Ranking-Query im Konfi-Dashboard angepasst werden.

**Primary recommendation:** Zentrale Helper-Funktion `checkPointTypeEnabled(db, konfiId, pointType)` erstellen, die in allen 5 Eintrittspunkten wiederverwendet wird. Badge-Logik und Ranking-Query inline anpassen.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PKT-04 | Backend lehnt Punktevergabe fuer deaktivierte Typen ab | 5 Eintrittspunkte identifiziert, zentrale Guard-Funktion, 400er-Response mit klarer Meldung |
| PKT-05 | Warnung beim Deaktivieren wenn Konfis bereits Punkte haben | PUT /api/jahrgaenge/:id muss betroffene Konfis zaehlen und Warnung zurueckgeben |
| PUI-04 | Badge-Vergabe ueberspringt Kriterien die deaktivierte Punkte-Typen erfordern | checkAndAwardBadges um Jahrgang-Config erweitern, 4 Kriterien betroffen |
</phase_requirements>

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Express.js | existing | HTTP Routing | Bereits im Projekt |
| pg (node-postgres) | existing | PostgreSQL Client | Bereits im Projekt |
| express-validator | existing | Request Validation | Bereits im Projekt |

Keine neuen Abhaengigkeiten noetig - alles mit bestehenden Libraries loesbar.

## Architecture Patterns

### Alle Punkte-Vergabe-Eintrittspunkte (VOLLSTAENDIG)

| # | Route | Datei | Zeile | Typ-Quelle |
|---|-------|-------|-------|------------|
| 1 | `POST /api/activities/assign-activity` | activities.js | 424 | `activity.type` |
| 2 | `PUT /api/activities/requests/:id` (Approval) | activities.js | 287 | `request.type` |
| 3 | `POST /api/konfis/:id/bonus-points` | konfi-managment.js | 469 | `req.body.type` |
| 4 | `POST /api/konfis/:id/activities` | konfi-managment.js | 587 | `activity.type` |
| 5 | Event Attendance (present) | events.js | ~1313 | `eventData.point_type` |

### Pattern: Zentrale Guard-Funktion

```javascript
// backend/utils/pointTypeGuard.js
async function checkPointTypeEnabled(db, konfiId, pointType) {
  const query = `
    SELECT j.gottesdienst_enabled, j.gemeinde_enabled
    FROM konfi_profiles kp
    JOIN jahrgaenge j ON kp.jahrgang_id = j.id
    WHERE kp.user_id = $1
  `;
  const { rows: [config] } = await db.query(query, [konfiId]);
  if (!config) return { enabled: false, error: 'Konfi-Profil oder Jahrgang nicht gefunden' };

  const enabledField = pointType === 'gottesdienst' ? 'gottesdienst_enabled' : 'gemeinde_enabled';
  const typeName = pointType === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';

  if (!config[enabledField]) {
    return {
      enabled: false,
      error: `${typeName}-Punkte sind fuer diesen Jahrgang deaktiviert`
    };
  }
  return { enabled: true };
}
```

### Pattern: Guard-Einbau in bestehenden Route-Code

```javascript
// Beispiel: activities.js assign-activity (Zeile ~430, nach Activity-Lookup)
const { enabled, error } = await checkPointTypeEnabled(db, konfiId, activity.type);
if (!enabled) {
  return res.status(400).json({ error });
}
// ... rest des bestehenden Codes
```

### Pattern: PKT-05 Warnung beim Deaktivieren

```javascript
// jahrgaenge.js PUT /:id - VOR dem Update pruefen
// Wenn gottesdienst_enabled von true auf false wechselt:
const affectedQuery = `
  SELECT COUNT(*)::int as count
  FROM konfi_profiles
  WHERE jahrgang_id = $1 AND gottesdienst_points > 0
`;
// Response mit warning-Feld (kein Blocking, nur Info):
res.json({
  message: 'Jahrgang erfolgreich aktualisiert',
  warnings: [{
    type: 'gottesdienst',
    affected_count: 5,
    message: '5 Konfis haben bereits Gottesdienst-Punkte'
  }]
});
```

### Pattern: Badge-Logik Anpassung

In `checkAndAwardBadges` (badges.js, Zeile 92) muessen 4 Kriterien-Typen angepasst werden:

| Kriterium | Aenderung |
|-----------|-----------|
| `gottesdienst_points` | Ueberspringen wenn `gottesdienst_enabled = false` |
| `gemeinde_points` | Ueberspringen wenn `gemeinde_enabled = false` |
| `both_categories` | Ueberspringen wenn nur ein Typ aktiv |
| `total_points` | Nur aktive Typen summieren |

```javascript
// In checkAndAwardBadges: Jahrgang-Config laden
const jahrgangQuery = `
  SELECT j.gottesdienst_enabled, j.gemeinde_enabled
  FROM konfi_profiles kp
  JOIN jahrgaenge j ON kp.jahrgang_id = j.id
  WHERE kp.user_id = $1
`;
const { rows: [jahrgangConfig] } = await db.query(jahrgangQuery, [konfiId]);

// Im switch-case:
case 'gottesdienst_points':
  if (!jahrgangConfig?.gottesdienst_enabled) { earned = false; break; }
  earned = konfi.gottesdienst_points >= badge.criteria_value;
  break;

case 'both_categories':
  if (!jahrgangConfig?.gottesdienst_enabled || !jahrgangConfig?.gemeinde_enabled) {
    earned = false; break; // Ueberspringen wenn nicht beide aktiv
  }
  earned = konfi.gottesdienst_points >= badge.criteria_value
        && konfi.gemeinde_points >= badge.criteria_value;
  break;

case 'total_points': {
  let total = 0;
  if (jahrgangConfig?.gottesdienst_enabled) total += konfi.gottesdienst_points;
  if (jahrgangConfig?.gemeinde_enabled) total += konfi.gemeinde_points;
  earned = total >= badge.criteria_value;
  break;
}
```

### Pattern: Ranking-Query Anpassung

Aktuell (konfi.js, Zeile 98-108):
```sql
SELECT u.id, u.display_name,
       (kp.gottesdienst_points + kp.gemeinde_points) as points
FROM users u ...
ORDER BY points DESC
```

Neu (mit Jahrgang-Config):
```sql
SELECT u.id, u.display_name,
       (CASE WHEN j.gottesdienst_enabled THEN kp.gottesdienst_points ELSE 0 END
      + CASE WHEN j.gemeinde_enabled THEN kp.gemeinde_points ELSE 0 END) as points
FROM users u
JOIN konfi_profiles kp ON u.id = kp.user_id
JOIN jahrgaenge j ON kp.jahrgang_id = j.id
JOIN roles r ON u.role_id = r.id
WHERE kp.jahrgang_id = $1 AND r.name = 'konfi'
ORDER BY points DESC
```

Es gibt **3 Ranking-Queries** in konfi.js die angepasst werden muessen:
1. Dashboard Top-3 Ranking (Zeile 98)
2. Dashboard User-Ranking mit RANK() (Zeile 127)
3. Profil-Seite Ranking (Zeile 400)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Punkte-Typ-Pruefung | Inline-Check in jeder Route | Zentrale `checkPointTypeEnabled()` Funktion | 5 Eintrittspunkte, DRY-Prinzip |
| SQL CASE fuer Ranking | Separate Queries pro Typ | CASE WHEN in SQL | Eine Query, atomare Berechnung |

## Common Pitfalls

### Pitfall 1: Vergessene Eintrittspunkte
**What goes wrong:** Einer der 5 Eintrittspunkte wird nicht geGuarded, Punkte werden trotz Deaktivierung vergeben
**Why it happens:** Event-Points in events.js werden leicht uebersehen (versteckt in Attendance-Update)
**How to avoid:** Checkliste aller 5 Eintrittspunkte abarbeiten. Die vollstaendige Liste steht oben.

### Pitfall 2: Activity-Request Approval Race Condition
**What goes wrong:** Konfi stellt Request als Typ aktiv, Admin genehmigt nachdem Typ deaktiviert wurde
**Why it happens:** Zeitfenster zwischen Request-Erstellung und Genehmigung
**How to avoid:** Guard auch in Request-Approval (Eintrittspunkt #2) einbauen, nicht nur bei Erstellung

### Pitfall 3: Badge both_categories Semantik
**What goes wrong:** Badge wird nie vergeben weil both_categories bei nur einem aktiven Typ immer false ist
**Why it happens:** Entscheidung war: ueberspringen wenn nur ein Typ aktiv. Das heisst `earned = false` und das Badge kann nicht erreicht werden - das ist KORREKT und gewollt laut Entscheidung.
**Warning signs:** Admin fragt sich warum both_categories Badge nie vergeben wird

### Pitfall 4: total_points Badge mit deaktiviertem Typ
**What goes wrong:** total_points Badge zaehlt immer noch deaktivierte Punkte mit
**Why it happens:** Aktuell: `konfi.gottesdienst_points + konfi.gemeinde_points` ohne Config-Check
**How to avoid:** total_points CASE-Logik: nur aktive Typen summieren

### Pitfall 5: Warnung beim Deaktivieren blockiert statt informiert
**What goes wrong:** PUT /jahrgaenge/:id gibt 409 zurueck und verhindert Deaktivierung
**Why it happens:** Falsche Interpretation - Warnung soll nur informieren, nicht blockieren
**How to avoid:** Warnung als `warnings`-Array in erfolgreicher 200-Response zurueckgeben

## Code Examples

### Eintrittspunkt-Guard (vollstaendig)

```javascript
// backend/utils/pointTypeGuard.js
async function checkPointTypeEnabled(db, konfiId, pointType) {
  const query = `
    SELECT j.gottesdienst_enabled, j.gemeinde_enabled
    FROM konfi_profiles kp
    JOIN jahrgaenge j ON kp.jahrgang_id = j.id
    WHERE kp.user_id = $1
  `;
  const { rows: [config] } = await db.query(query, [konfiId]);
  if (!config) {
    return { enabled: false, error: 'Konfi-Profil oder Jahrgang nicht gefunden' };
  }

  const isEnabled = pointType === 'gottesdienst'
    ? config.gottesdienst_enabled
    : config.gemeinde_enabled;

  if (!isEnabled) {
    const typeName = pointType === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';
    return {
      enabled: false,
      error: `${typeName}-Punkte sind fuer diesen Jahrgang deaktiviert`
    };
  }

  return { enabled: true };
}

module.exports = { checkPointTypeEnabled };
```

### Jahrgang-Update mit Warnung (PKT-05)

```javascript
// In jahrgaenge.js PUT /:id, VOR dem UPDATE ausfuehren
const warnings = [];

// Bestehende Werte laden
const { rows: [current] } = await db.query(
  'SELECT gottesdienst_enabled, gemeinde_enabled FROM jahrgaenge WHERE id = $1 AND organization_id = $2',
  [req.params.id, req.user.organization_id]
);

if (current) {
  // Gottesdienst wird deaktiviert?
  if (current.gottesdienst_enabled && gottesdienst_enabled === false) {
    const { rows: [result] } = await db.query(
      'SELECT COUNT(*)::int as count FROM konfi_profiles WHERE jahrgang_id = $1 AND gottesdienst_points > 0',
      [req.params.id]
    );
    if (result.count > 0) {
      warnings.push({
        type: 'gottesdienst',
        affected_count: result.count,
        message: `${result.count} Konfi(s) haben bereits Gottesdienst-Punkte`
      });
    }
  }

  // Gemeinde wird deaktiviert?
  if (current.gemeinde_enabled && gemeinde_enabled === false) {
    const { rows: [result] } = await db.query(
      'SELECT COUNT(*)::int as count FROM konfi_profiles WHERE jahrgang_id = $1 AND gemeinde_points > 0',
      [req.params.id]
    );
    if (result.count > 0) {
      warnings.push({
        type: 'gemeinde',
        affected_count: result.count,
        message: `${result.count} Konfi(s) haben bereits Gemeinde-Punkte`
      });
    }
  }
}

// ... UPDATE ausfuehren ...

// Response mit Warnungen
const response = { message: 'Jahrgang erfolgreich aktualisiert' };
if (warnings.length > 0) {
  response.warnings = warnings;
}
res.json(response);
```

## Aenderungs-Matrix

| Datei | Aenderung | Aufwand |
|-------|-----------|---------|
| `backend/utils/pointTypeGuard.js` | NEU: checkPointTypeEnabled Funktion | Klein |
| `backend/routes/activities.js` | Guard in assign-activity + request-approval | Klein |
| `backend/routes/konfi-managment.js` | Guard in bonus-points + activities | Klein |
| `backend/routes/events.js` | Guard in attendance-update | Klein |
| `backend/routes/jahrgaenge.js` | Warnung bei Deaktivierung (PKT-05) | Mittel |
| `backend/routes/badges.js` | checkAndAwardBadges: Jahrgang-Config laden, 4 Kriterien anpassen | Mittel |
| `backend/routes/konfi.js` | 3 Ranking-Queries auf CASE WHEN umstellen | Klein |

## Open Questions

1. **total_points Badge bei deaktiviertem Typ**
   - Was wir wissen: Entscheidung sagt "nur aktive Typen zaehlen"
   - Was klar ist: total_points summiert nur aktive Typen
   - Recommendation: Implementieren wie beschrieben

2. **Event Point-Type bei Deaktivierung**
   - Was wir wissen: Events haben eigenen `point_type` (gottesdienst/gemeinde)
   - Was klar ist: Guard muss auch hier greifen
   - Recommendation: Gleicher Guard wie bei Activities

## Sources

### Primary (HIGH confidence)
- Codebase-Analyse: Alle 5 Eintrittspunkte direkt aus dem Code identifiziert
- Phase 30 Implementierung: jahrgaenge.js Spalten `gottesdienst_enabled`, `gemeinde_enabled` verifiziert
- REQUIREMENTS.md + STATE.md: Entscheidungen zu Ranking und Badge-Semantik

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH - Keine neuen Libraries, alles bestehende Patterns
- Architecture: HIGH - Code vollstaendig analysiert, alle Eintrittspunkte identifiziert
- Pitfalls: HIGH - Aus konkreter Code-Analyse abgeleitet

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stabil, keine externen Abhaengigkeiten)
