# Phase 28: Fehlende Push-Flows - Research

**Researched:** 2026-03-06
**Domain:** Push-Notification Flows (Node.js/Express Backend, Firebase FCM)
**Confidence:** HIGH

## Summary

Phase 28 implementiert drei fehlende Push-Notification-Flows: Event-Erinnerungen (FLW-01), Admin-Alert bei Konfi-Registrierung (FLW-02) und Level-Up Push (FLW-03). FLW-04 entfaellt, da Badge-Earned Push Meilensteine bereits abdeckt.

Die bestehende Infrastruktur ist sehr ausgereift. Alle drei Push-Methoden (`sendEventReminderToKonfi`, `sendLevelUpToKonfi`) existieren bereits in `pushService.js`. Die Event-Reminder-Loop in `backgroundService.js` ist komplett implementiert inklusive `event_reminders` Tabelle zur Duplikat-Vermeidung. Der Hauptaufwand liegt bei: (1) Verifizierung der Event-Reminder-Logik, (2) neue `sendNewKonfiRegistrationToAdmins` Methode, (3) Level-Check-Helper an allen Punkte-Vergabe-Stellen einbauen.

**Primary recommendation:** Bestehende Methoden wiederverwenden, Level-Check als wiederverwendbare Helper-Funktion in pushService.js oder als standalone Utility implementieren, um Code-Duplikation an 4+ Punkte-Vergabe-Stellen zu vermeiden.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Event-Erinnerungen (FLW-01): Zwei Zeitpunkte (1 Tag, 1 Stunde), nur bestaetigte Teilnehmer, 15-Min Intervall
- Admin-Alert (FLW-02): Trigger in auth.js nach Registrierung, Empfaenger via user_jahrgang_assignments
- Level-Up (FLW-03): Vorher/nachher Level-Vergleich bei jeder Punkte-Vergabe
- FLW-04 entfaellt (Badge-System deckt Meilensteine ab)

### Claude's Discretion
- Exakte SQL-Queries fuer Jahrgangs-Admin-Lookup bei Registrierung
- Welche Punkte-Vergabe-Stellen genau den Level-Check brauchen
- Ob Event-Reminder-Logik Bugs hat oder direkt funktioniert
- Push-Nachrichtentexte (deutsch, mit echten Umlauten)

### Deferred Ideas (OUT OF SCOPE)
- Badge-Logik nochmal anschauen (ob alle Badges korrekt vergeben werden) — eigene Phase
- FLW-04 Punkte-Meilenstein als separater Push — bewusst verworfen
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| FLW-01 | Event-Erinnerung X Stunden vor Event-Beginn an angemeldete Konfis | backgroundService.js:113-239 komplett implementiert, event_reminders Tabelle existiert, Logik verifiziert |
| FLW-02 | Admin erhaelt Push bei neuer Konfi-Registrierung (Invite-Code eingeloest) | Neue Methode noetig, auth.js:597 ist der Trigger-Punkt, Admin-Lookup via user_jahrgang_assignments |
| FLW-03 | Konfi erhaelt Push bei Level-Up | sendLevelUpToKonfi existiert (pushService.js:527), 4 Punkte-Vergabe-Stellen identifiziert |
| FLW-04 | Konfi erhaelt Push bei Punkte-Meilenstein | ENTFAELLT — Badge-Earned Push deckt dies ab (CONTEXT.md Entscheidung) |
</phase_requirements>

## Architecture Patterns

### Bestehende Push-Infrastruktur

```
pushService.js (statische Methoden)
├── sendToUser(db, userId, notification)          — einzelner User
├── sendToMultipleUsers(db, userIds, notification) — mehrere User
├── sendLevelUpToKonfi(...)                        — EXISTIERT, nie aufgerufen
├── sendEventReminderToKonfi(...)                  — EXISTIERT, wird von backgroundService aufgerufen
└── [NEU] sendNewKonfiRegistrationToAdmins(...)    — muss erstellt werden

backgroundService.js
├── startEventReminderService(db)                  — alle 15 Min, LAEUFT bereits
├── sendEventReminders(db)                         — 1-day und 1-hour Logik, KOMPLETT
└── event_reminders Tabelle                        — Duplikat-Schutz, EXISTIERT
```

### Pattern: Push nach Punkte-Vergabe (Level-Check)

Alle Punkte-Vergabe-Stellen folgen dem gleichen Pattern:
1. Transaktion: Punkte erhoehen in `konfi_profiles`
2. COMMIT
3. Badge-Check NACH COMMIT (`checkAndAwardBadges`)
4. Push-Notification NACH COMMIT
5. **[NEU] Level-Check NACH COMMIT** (vorher/nachher Vergleich)

### Identifizierte Punkte-Vergabe-Stellen (Level-Check noetig)

| Datei | Zeile | Kontext | Typ |
|-------|-------|---------|-----|
| `activities.js:321` | Antrag genehmigt (approve) | gottesdienst/gemeinde | Nach COMMIT, nach Badge-Check |
| `activities.js:449` | Admin weist Aktivitaet zu | gottesdienst/gemeinde | Nach COMMIT, nach Badge-Check |
| `konfi-managment.js:489` | Admin vergibt Bonus-Punkte | gottesdienst/gemeinde | Nach COMMIT, nach Badge-Check |
| `events.js:1329-1331` | Event-Attendance (present) | gottesdienst/gemeinde | Nach COMMIT, nach Badge-Check |

**Anti-Pattern: Level-Check VOR Commit** — Punkte-Stand waere noch nicht aktualisiert.

### Pattern: Admin-Lookup fuer Jahrgangs-spezifische Pushes

Bestehender Admin-Lookup (z.B. `sendNewActivityRequestToAdmins`) holt ALLE Admins einer Organisation:
```sql
SELECT u.id FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name IN ('admin', 'org_admin') AND u.organization_id = $1
```

Fuer FLW-02 brauchen wir einen Jahrgangs-spezifischen Lookup:
```sql
SELECT DISTINCT u.id FROM users u
JOIN roles r ON u.role_id = r.id
JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
WHERE r.name IN ('admin', 'org_admin')
  AND u.organization_id = $1
  AND uja.jahrgang_id = $2
```

**Fallback:** Falls kein Admin dem Jahrgang zugewiesen ist, an ALLE Org-Admins senden (damit kein Push verloren geht).

### Pattern: Level-Check Helper-Funktion

Wiederverwendbare Funktion, die an 4+ Stellen aufgerufen wird:

```javascript
// In pushService.js oder als separate Utility
static async checkAndSendLevelUp(db, konfiId, organizationId) {
  // 1. Aktuelle Punkte holen
  const { rows: [profile] } = await db.query(
    'SELECT gottesdienst_points, gemeinde_points, current_level_id FROM konfi_profiles WHERE user_id = $1',
    [konfiId]
  );
  if (!profile) return;

  const totalPoints = (profile.gottesdienst_points || 0) + (profile.gemeinde_points || 0);

  // 2. Alle Levels der Organisation holen
  const { rows: levels } = await db.query(
    'SELECT * FROM levels WHERE organization_id = $1 AND is_active = true ORDER BY points_required ASC',
    [organizationId]
  );

  // 3. Aktuelles Level berechnen
  let newLevel = null;
  for (const level of levels) {
    if (totalPoints >= level.points_required) {
      newLevel = level;
    }
  }

  // 4. Vergleich mit gespeichertem Level
  if (newLevel && newLevel.id !== profile.current_level_id) {
    // Level-ID updaten
    await db.query(
      'UPDATE konfi_profiles SET current_level_id = $1 WHERE user_id = $2',
      [newLevel.id, konfiId]
    );

    // Nur Push senden wenn Level HOEHER (nicht bei Punkte-Abzug)
    if (!profile.current_level_id || newLevel.points_required > 0) {
      await PushService.sendLevelUpToKonfi(
        db, konfiId, newLevel.name, newLevel.title, newLevel.icon, newLevel.id
      );
    }
  }
}
```

**Wichtig:** Muss pruefen ob Level AUFGESTIEGEN ist (nicht nur geaendert), da Punkte auch abgezogen werden koennen.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Duplikat-Erinnerungen | Eigene In-Memory Tracking | `event_reminders` Tabelle (existiert) | Persistent, ueberlebt Server-Restart |
| Level-Berechnung | Neue Level-Logik | Bestehende Logik aus konfi.js:175-210 | Bereits getestet, konsistent |
| Admin-User-Lookup | Eigener Query-Builder | Bestehendes Pattern aus pushService.js:274-278 | Konsistent mit anderen Admin-Pushes |
| Push-Versand | Eigene Firebase-Integration | `sendToUser`/`sendToMultipleUsers` | Error-Handling, Token-Cleanup eingebaut |

## Common Pitfalls

### Pitfall 1: Event-Reminder 1-Day Query vergleicht nur Datum, nicht Zeit
**Was:** Die 1-Tag-Query nutzt `e.event_date::date = $1::date` (Zeile 158), vergleicht also NUR das Datum.
**Warum relevant:** Events am naechsten Tag werden korrekt gefunden, unabhaengig von der Uhrzeit. Das ist gewollt.
**Kein Bug:** Die 1-Stunde-Query nutzt korrekt ein Zeitfenster (`BETWEEN $1 AND $2`).
**Aktion:** Keine Aenderung noetig, nur verifizieren dass die Logik laeuft.

### Pitfall 2: Level-Check bei Punkte-ABZUG
**Was:** Wenn Punkte abgezogen werden (Antrag zurueckgenommen, Event Absent), aendert sich ggf. das Level.
**Warum problematisch:** Kein "Level Down" Push erwuenscht.
**Vermeidung:** Level-Check-Helper muss pruefen ob neues Level HOEHER als altes ist, bevor Push gesendet wird.

### Pitfall 3: auth.js hat keinen db-Import fuer PushService
**Was:** Die Registrierungs-Route in auth.js nutzt `db` aus dem Closure, aber PushService muss importiert werden.
**Vermeidung:** PushService am Anfang der auth.js importieren (wie in anderen Route-Files).

### Pitfall 4: Registrierungs-Push nach COMMIT, nicht innerhalb der Transaktion
**Was:** Der Push muss NACH `await client.query('COMMIT')` gesendet werden.
**Warum:** Falls die Transaktion fehlschlaegt, soll kein Push rausgehen.
**Position:** Nach Zeile 597 (COMMIT), vor Zeile 599 (JWT Token Generierung).

### Pitfall 5: user_jahrgang_assignments vs. user_jahrgaenge
**Was:** CONTEXT.md erwaehnt `user_jahrgaenge` Tabelle, aber die echte Tabelle heisst `user_jahrgang_assignments`.
**Korrekt:** `user_jahrgang_assignments` mit Spalten: user_id, jahrgang_id, can_view, can_edit, assigned_by, assigned_at.

### Pitfall 6: Event-Reminder Service laeuft bereits
**Was:** `BackgroundService.startAllServices(db)` wird in server.js:446 aufgerufen und startet den Event-Reminder-Service automatisch.
**Aktion:** Kein neuer Start noetig, nur Verifizierung der bestehenden Logik.

## Code Examples

### FLW-02: sendNewKonfiRegistrationToAdmins (Neue Methode)

```javascript
// In pushService.js — nach sendEventReminderToKonfi
static async sendNewKonfiRegistrationToAdmins(db, organizationId, jahrgangId, konfiName, jahrgangName) {
  try {
    // Admins des Jahrgangs finden
    const { rows: admins } = await db.query(`
      SELECT DISTINCT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
      WHERE r.name IN ('admin', 'org_admin')
        AND u.organization_id = $1
        AND uja.jahrgang_id = $2
    `, [organizationId, jahrgangId]);

    // Fallback: Alle Org-Admins wenn kein Jahrgangs-Admin
    let adminIds;
    if (admins.length === 0) {
      const { rows: allAdmins } = await db.query(`
        SELECT u.id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE r.name IN ('admin', 'org_admin') AND u.organization_id = $1
      `, [organizationId]);
      adminIds = allAdmins.map(a => a.id);
    } else {
      adminIds = admins.map(a => a.id);
    }

    if (adminIds.length === 0) return { success: false, message: 'No admins found' };

    const notification = {
      title: 'Neue Registrierung',
      body: `${konfiName} hat sich registriert (${jahrgangName})`,
      data: {
        type: 'new_konfi_registration',
        organization_id: organizationId.toString(),
        jahrgang_id: jahrgangId.toString()
      }
    };

    return await this.sendToMultipleUsers(db, adminIds, notification);
  } catch (error) {
    console.error('sendNewKonfiRegistrationToAdmins error:', error);
    return { success: false, error: error.message };
  }
}
```

### FLW-02: Integration in auth.js

```javascript
// auth.js — nach COMMIT (Zeile 597), vor JWT Token Generierung
await client.query('COMMIT');

// Push-Notification an Jahrgangs-Admins
try {
  await PushService.sendNewKonfiRegistrationToAdmins(
    db,
    invite.organization_id,
    invite.jahrgang_id,
    display_name,
    invite.jahrgang_name
  );
} catch (pushErr) {
  console.error('Push for new registration failed:', pushErr);
}
```

### FLW-03: Level-Check Integration (Beispiel activities.js:449)

```javascript
// Nach Badge-Check, nach COMMIT
try {
  await PushService.checkAndSendLevelUp(db, konfiId, req.user.organization_id);
} catch (levelErr) {
  console.error('Level-up check failed:', levelErr);
}
```

## Analyse der Event-Reminder-Logik (FLW-01)

### Status: Komplett implementiert, potentiell funktionsfaehig

Die Logik in `backgroundService.js:144-238`:

1. **1-Tag-Erinnerung** (Zeile 153-191): Sucht Events deren `event_date::date` morgen ist. Prueft via `event_reminders` ob bereits gesendet. Funktional korrekt.

2. **1-Stunde-Erinnerung** (Zeile 198-233): Nutzt 30-Min-Zeitfenster (`oneHourFromNow +/- 15 Min`). Prueft via `event_reminders` ob bereits gesendet. Funktional korrekt.

3. **Duplikat-Schutz**: `UNIQUE(event_id, user_id, reminder_type)` in `event_reminders`. Korrekt.

4. **Nur bestaetigte Teilnehmer**: `eb.status = 'confirmed'`. Korrekt.

### Potentieller Bug: Zeitzone
Die Queries nutzen `new Date()` serverseitig. Der Server laeuft auf Hetzner (UTC). `event_date` im DB koennte UTC oder lokale Zeit sein. Bei deutschen Events (UTC+1/+2) koennte die 1-Tag-Erinnerung zu frueh/spaet kommen.

**Empfehlung:** Verifizieren wie `event_date` gespeichert wird. Falls mit Zeitzone (TIMESTAMPTZ): kein Problem. Falls ohne (TIMESTAMP): potentielles Zeitzone-Issue, aber pragmatisch akzeptabel da 15-Min-Fenster gross genug ist.

### Aktion fuer Phase 28
- Event-Reminder-Logik ist bereits aktiv (startAllServices in server.js)
- Primaer: Manuell testen ob Reminders tatsaechlich ankommen
- Sekundaer: Log-Output pruefen ob der Service laeuft

## Open Questions

1. **Event-Reminder tatsaechlich aktiv?**
   - Was wir wissen: Code ist vollstaendig, Service wird gestartet
   - Was unklar ist: Ob die Migration (`add_push_foundation.sql`) auf dem Server ausgefuehrt wurde
   - Empfehlung: Event-Reminders Tabelle per SQL-Query pruefen, Test-Event erstellen

2. **Zeitzone bei event_date**
   - Was wir wissen: Server laeuft auf UTC (Hetzner)
   - Was unklar ist: Ob event_date als TIMESTAMPTZ oder TIMESTAMP gespeichert wird
   - Empfehlung: Pragmatisch ignorieren, 15-Min-Fenster kompensiert kleine Abweichungen

## Sources

### Primary (HIGH confidence)
- `backend/services/pushService.js` — Alle bestehenden Push-Methoden, sendLevelUpToKonfi (Zeile 527-546), sendEventReminderToKonfi (Zeile 551-572)
- `backend/services/backgroundService.js` — Event-Reminder-Loop komplett (Zeile 113-239), startAllServices (Zeile 313-317)
- `backend/routes/auth.js` — Register-Endpoint (Zeile 518-637), invite_code mit jahrgang_id und organization_id
- `backend/routes/activities.js` — Punkte-Vergabe bei Approve (Zeile 321) und Assign (Zeile 449)
- `backend/routes/konfi-managment.js` — Bonus-Punkte-Vergabe (Zeile 483-491)
- `backend/routes/events.js` — Event-Attendance-Punkte (Zeile 1329-1331)
- `backend/routes/konfi.js` — Level-Berechnung (Zeile 175-210), current_level_id Update
- `backend/migrations/add_push_foundation.sql` — event_reminders Tabelle (Zeile 23-33)
- `backend/middleware/rbac.js` — assigned_jahrgaenge im req.user (Zeile 74-81)

### Tabelle: user_jahrgang_assignments (verifiziert)
- Spalten: user_id, jahrgang_id, can_view, can_edit, assigned_by, assigned_at
- Verwendet in: rbac.js, users.js, chat.js, konfi-managment.js, organizations.js

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Alles bestehendes Node.js/Express, keine neuen Dependencies
- Architecture: HIGH — Alle Patterns direkt aus dem bestehenden Code abgeleitet
- Pitfalls: HIGH — Alle aus Code-Analyse identifiziert, keine externen Quellen noetig

**Research date:** 2026-03-06
**Valid until:** 2026-04-06 (stabiles Backend, keine externen Dependency-Aenderungen erwartet)
