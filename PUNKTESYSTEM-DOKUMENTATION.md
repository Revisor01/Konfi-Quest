# Konfi-Quest Punktesystem - Technische Dokumentation

## Übersicht

Das Konfi-Quest System verwendet ein duales Punktesystem mit zwei Kategorien:
- **Gottesdienst-Punkte** (`gottesdienst_points`)
- **Gemeinde-Punkte** (`gemeinde_points`)

## Datenbank-Architektur

### Zentrale Punktespeicherung
```sql
-- Hauptspeicher für Konfi-Punkte
CREATE TABLE konfi_profiles (
    user_id INTEGER REFERENCES users(id),
    gottesdienst_points INTEGER DEFAULT 0,
    gemeinde_points INTEGER DEFAULT 0,
    -- ...
);
```

### Punktequellen-Tabellen
```sql
-- 1. Aktivitäten (Admin vergibt für abgeschlossene Aktivitäten)
CREATE TABLE konfi_activities (
    konfi_id INTEGER REFERENCES users(id),
    activity_id INTEGER REFERENCES activities(id),
    completed_date DATE,
    admin_id INTEGER REFERENCES users(id)
    -- Punkte kommen aus activities.points + activities.type
);

-- 2. Bonus-Punkte (Admin vergibt manuell)
CREATE TABLE bonus_points (
    konfi_id INTEGER REFERENCES users(id),
    points INTEGER NOT NULL,
    type VARCHAR(20) CHECK (type IN ('gottesdienst', 'gemeinde')),
    description TEXT,
    admin_id INTEGER REFERENCES users(id)
);

-- 3. Event-Punkte (Automatisch bei Anwesenheit)
CREATE TABLE event_points (
    konfi_id INTEGER REFERENCES users(id),
    event_id INTEGER REFERENCES events(id),
    points INTEGER NOT NULL,
    point_type VARCHAR(20) CHECK (point_type IN ('gottesdienst', 'gemeinde')),
    description TEXT,
    UNIQUE(konfi_id, event_id) -- Ein Konfi kann pro Event nur einmal Punkte bekommen
);
```

## Punktevergabe-Mechanismen

### 1. Aktivitäten-Punkte
**Route:** `POST /api/activities/assign-activity`  
**Datei:** `backend/routes/activities.js:215-229`

```javascript
// 1. Aktivität aus DB laden
const { rows: [activity] } = await db.query(
    "SELECT * FROM activities WHERE id = $1", [activityId]
);

// 2. Konfi-Aktivität verbuchen
await db.query(
    "INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date) VALUES ($1, $2, $3, $4)", 
    [konfiId, activityId, req.user.id, date]
);

// 3. Punkte zu konfi_profiles addieren
const pointField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
await db.query(
    `UPDATE konfi_profiles SET ${pointField} = ${pointField} + $1 WHERE user_id = $2`, 
    [activity.points, konfiId]
);
```

**Funktionsweise:**
- Admin weist einem Konfi eine abgeschlossene Aktivität zu
- System holt `activity.points` und `activity.type` aus der Activities-Tabelle
- Punkte werden je nach `activity.type` zu `gottesdienst_points` oder `gemeinde_points` addiert

### 2. Bonus-Punkte
**Route:** `POST /api/admin/konfis/:id/bonus-points`  
**Datei:** `backend/routes/konfi-managment.js:335-354`

```javascript
// 1. Bonus-Punkt-Eintrag erstellen
await db.query(`
    INSERT INTO bonus_points (konfi_id, points, type, description, admin_id) 
    VALUES ($1, $2, $3, $4, $5)`, 
    [konfiId, points, type, description, req.user.id]
);

// 2. Punkte zu konfi_profiles addieren
const updateField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
await db.query(`
    UPDATE konfi_profiles SET ${updateField} = ${updateField} + $1 WHERE user_id = $2`, 
    [points, konfiId]
);
```

**Funktionsweise:**
- Admin gibt manuell Punkte, Typ (gottesdienst/gemeinde) und Beschreibung ein
- System speichert Bonus-Punkt-Eintrag für Nachverfolgbarkeit
- Punkte werden je nach gewähltem `type` zu entsprechendem Feld addiert

### 3. Event-Punkte (Anwesenheits-basiert)
**Route:** `POST /api/events/:eventId/participants/:participantId/attendance`  
**Datei:** `backend/routes/events.js:745-770`

```javascript
if (attendance_status === 'present' && eventData.points > 0) {
    // 1. Event-Punkt-Eintrag erstellen (mit Duplikat-Schutz)
    const awardPointsQuery = `
        INSERT INTO event_points (konfi_id, event_id, points, point_type, description, awarded_date) 
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (konfi_id, event_id) DO NOTHING
    `;
    const { rowCount } = await db.query(awardPointsQuery, [
        eventData.user_id, eventId, eventData.points, pointType, description
    ]);
    
    // 2. Nur wenn Punkte tatsächlich vergeben wurden (rowCount > 0)
    if (rowCount > 0) {
        const updateProfileQuery = pointType === 'gottesdienst' 
            ? "UPDATE konfi_profiles SET gottesdienst_points = gottesdienst_points + $1 WHERE user_id = $2"
            : "UPDATE konfi_profiles SET gemeinde_points = gemeinde_points + $1 WHERE user_id = $2";
        await db.query(updateProfileQuery, [eventData.points, eventData.user_id]);
    }
}
```

**Funktionsweise:**
- Admin markiert Konfi bei Event als "anwesend" (`attendance_status = 'present'`)
- System prüft, ob Event Punkte hat (`event.points > 0`)
- Punkte werden automatisch vergeben basierend auf `event.point_type`
- `ON CONFLICT DO NOTHING` verhindert doppelte Punktevergabe pro Event

## Punkte-Berechnung und Anzeige

### Frontend-Calculation
**Datei:** `frontend/src/components/admin/KonfisView.tsx:93-97`

```typescript
const getTotalPoints = (konfi: Konfi) => {
    // Unterstützt sowohl neue als auch Legacy-Struktur
    const gottesdienst = konfi.gottesdienst_points ?? konfi.points?.gottesdienst ?? 0;
    const gemeinde = konfi.gemeinde_points ?? konfi.points?.gemeinde ?? 0;
    return gottesdienst + gemeinde;
};
```

### Backend-Query für Konfi-Liste
**Datei:** `backend/routes/konfi-managment.js:29-43`

```sql
SELECT u.id, u.display_name as name, u.username,
       kp.gottesdienst_points, kp.gemeinde_points,
       j.name as jahrgang_name,
       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as "badgeCount"
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
WHERE r.name = 'konfi' AND u.organization_id = $1
```

## Audit-Trail und Nachverfolgbarkeit

Jede Punktevergabe wird in separaten Tabellen gespeichert:

1. **konfi_activities**: Welche Aktivität, wann, von welchem Admin
2. **bonus_points**: Bonus-Punkte mit Beschreibung und Admin
3. **event_points**: Event-Teilnahme mit automatischer Vergabe

Die `konfi_profiles` Tabelle enthält nur die **aktuellen Summen** für Performance.

## Wichtige Design-Entscheidungen

1. **Denormalisierte Speicherung**: Summen in `konfi_profiles` für schnelle Abfragen
2. **Transaktionale Sicherheit**: INSERT + UPDATE in einer Transaktion
3. **Audit-Trail**: Alle Einzelvergaben bleiben nachverfolgbar
4. **Duplikat-Schutz**: Event-Punkte können pro Konfi/Event nur einmal vergeben werden
5. **Flexible Typisierung**: Jede Punktequelle kann gottesdienst/gemeinde-Punkte vergeben

## Badge-System Integration

Nach jeder Punktevergabe wird `checkAndAwardBadges(konfiId)` aufgerufen, um zu prüfen, ob neue Badges freigeschaltet wurden basierend auf den aktualisierten Punkteständen.