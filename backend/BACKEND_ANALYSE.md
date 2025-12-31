# Backend-Analyse Konfipoints

**Datum:** 30. Dezember 2025
**Analysiert von:** Claude Code

---

## Zusammenfassung

Diese umfassende Analyse des Konfipoints-Backends identifiziert Sicherheitslücken, fehlende Best Practices, Logikfehler und potenzielle Probleme in der Codebasis.

---

## 1. KRITISCHE SICHERHEITSPROBLEME

### 1.1 Hardcoded Secrets
**Datei:** `.env`
**Problem:** JWT_SECRET enthält einen schwachen Entwicklungswert
```
JWT_SECRET=konfi-secret-super-secure-2025
```
**Empfehlung:** Kryptografisch starken Secret verwenden (mind. 256-bit random string)

### 1.2 CORS-Konfiguration
**Datei:** `server.js`
**Problem:** CORS ist möglicherweise zu permissiv konfiguriert
**Empfehlung:** Explizite Origin-Whitelist für Produktion

### 1.3 Fehlendes Rate Limiting
**Problem:** Keine Rate-Limiting-Middleware gefunden
**Betroffene Endpoints:**
- POST `/api/auth/login` - Brute-Force anfällig
- POST `/api/auth/register` - Spam-Registrierungen möglich
- Alle API-Endpoints ohne Schutz

**Empfehlung:**
```javascript
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 5 // max 5 Versuche
});
app.use('/api/auth/login', loginLimiter);
```

### 1.4 Passwort in Response
**Datei:** `routes/auth.js` oder User-bezogene Routes
**Problem:** Passwort-Hash wird möglicherweise in API-Responses zurückgegeben
**Empfehlung:** Immer `password` Feld aus Responses filtern

---

## 2. ORGANISATION/MULTI-TENANCY PROBLEME

### 2.1 Fehlende organization_id Filter
**Betroffene Dateien und Zeilen:**

| Datei | Zeile | Problem |
|-------|-------|---------|
| `activities.js` | 21 | FROM activities ohne organization_id Filter |
| `badges.js` | 157, 173, 190, 199, 219 | event_bookings Queries ohne organization_id |
| `events.js` | 230, 484, 512, 548, 556, 609, 671, 684, 748 | event_bookings potenziell ungefiltert |

**Risiko:** Datenleck zwischen Organisationen (Multi-Tenant-Verletzung)

### 2.2 Inkonsistente bonus_points INSERTs
**Problem:** Unterschiedliche INSERT-Strukturen

**activities.js Zeile 403:**
```sql
INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date)
-- FEHLT: organization_id
```

**konfi-managment.js Zeile 434:**
```sql
INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id, created_at)
-- HAT organization_id
```

**Empfehlung:** Alle INSERTs mit organization_id vereinheitlichen

---

## 3. RACE CONDITIONS

### 3.1 Event-Buchungen
**Datei:** `events.js`
**Problem:** Keine Transaktionen bei gleichzeitigen Buchungen
**Szenario:** Zwei User buchen gleichzeitig den letzten Platz

**Empfehlung:**
```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  // Check + Insert in einer Transaktion
  await client.query('COMMIT');
} catch (e) {
  await client.query('ROLLBACK');
  throw e;
} finally {
  client.release();
}
```

### 3.2 Badge-Vergabe
**Problem:** Badge könnte doppelt vergeben werden bei gleichzeitigen Requests

---

## 4. FEHLERBEHANDLUNG

### 4.1 Inkonsistente Error Responses
**Problem:** Manche Endpoints geben detaillierte Fehlermeldungen, andere nur generische

**Empfehlung:** Einheitliches Error-Response-Format:
```javascript
{
  error: true,
  message: "Benutzerfreundliche Nachricht",
  code: "ERROR_CODE",
  details: {} // nur in Development
}
```

### 4.2 Fehlende Try-Catch-Blöcke
**Problem:** Einige async Funktionen haben keine Fehlerbehandlung
**Risiko:** Unhandled Promise Rejections können Server crashen

---

## 5. VALIDIERUNG

### 5.1 Fehlende Input-Validierung
**Problem:** Viele Endpoints validieren Input nicht ausreichend

**Empfehlung:** express-validator verwenden:
```javascript
const { body, validationResult } = require('express-validator');

router.post('/create',
  body('email').isEmail(),
  body('name').trim().isLength({ min: 2 }),
  (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    // ...
  }
);
```

### 5.2 SQL Injection Risiken
**Status:** Parametrisierte Queries werden verwendet (gut!)
**Aber:** Sicherstellen, dass ALLE Queries parametrisiert sind

---

## 6. AUTHENTIFIZIERUNG & AUTORISIERUNG

### 6.1 Super Admin Prüfung
**Aktueller Stand:** is_super_admin wird in JWT gespeichert und geprüft
**Gefunden in:**
- `auth.js` Zeile 44, 81, 92
- `statistics.js` Zeile 110
- `konfi-management.js` Zeile 17

**Empfehlung:** Zentrale Middleware für Admin-Checks erstellen

### 6.2 Token-Expiry
**Prüfen:** Ist Token-Expiry korrekt konfiguriert?
**Best Practice:** Access Token 15-30 min, Refresh Token 7 Tage

---

## 7. KONSISTENZ-PROBLEME

### 7.1 Notifications - GUT
**Status:** Alle 4 notification INSERTs sind konsistent mit organization_id:
- `activities.js` Zeile 311
- `badges.js` Zeile 285
- `konfi.js` Zeilen 571, 607

### 7.2 Feld-Namensinkonsistenz
**Problem:** `completed_date` vs `created_at` in bonus_points
**Empfehlung:** Einheitliche Benennung

---

## 8. PERFORMANCE

### 8.1 Fehlende Indizes
**Prüfen:** Sind alle häufig abgefragten Felder indiziert?
- `organization_id` auf allen Tabellen
- `user_id` auf Aktivitäts-Tabellen
- `created_at` für Sortierung

### 8.2 N+1 Query Probleme
**Prüfen:** Werden in Schleifen einzelne Queries ausgeführt?
**Empfehlung:** JOINs oder Batch-Queries verwenden

---

## 9. LOGGING & MONITORING

### 9.1 Fehlendes Audit-Logging
**Problem:** Keine Protokollierung von Admin-Aktionen
**Empfehlung:** Audit-Log-Tabelle für:
- User-Erstellung/Löschung
- Punkte-Vergabe
- Badge-Vergabe
- Konfigurationsänderungen

### 9.2 Error-Logging
**Empfehlung:** Winston oder Pino für strukturiertes Logging

---

## 10. PRIORITÄTEN-LISTE

### SOFORT (Phase 1)
1. ~~Rate Limiting für Auth-Endpoints~~ - ERLEDIGT (31.12.2025)
2. JWT_SECRET durch sicheren Wert ersetzen - MANUELL auf Server in .env ändern
3. ~~organization_id Filter überall prüfen/hinzufügen~~ - ERLEDIGT (31.12.2025)
   - activities.js: War bereits korrekt
   - badges.js: 6 Queries mit org_id abgesichert
   - events.js: War bereits korrekt
   - bonus_points INSERT: Mit org_id ergänzt
4. Passwort aus Responses entfernen - BEWUSSTE ENTSCHEIDUNG (Admin-Onboarding Feature)

### BALD (Phase 2)
1. ~~Transaktionen für kritische Operationen (Race Conditions)~~ - ERLEDIGT (31.12.2025)
   - Event-Buchungen mit FOR UPDATE Lock abgesichert
2. Input-Validierung mit express-validator
3. Einheitliche Error-Responses
4. ~~bonus_points INSERT vereinheitlichen~~ - ERLEDIGT (31.12.2025)

### SPÄTER (Phase 3)
1. Audit-Logging implementieren
2. Performance-Optimierung (Indizes)
3. Strukturiertes Logging
4. API-Dokumentation

---

## 11. BEREITS GUT UMGESETZT

- Parametrisierte SQL-Queries (SQL Injection Schutz)
- JWT-basierte Authentifizierung
- RBAC-System mit Rollen
- Konsistente Notifications mit organization_id
- PostgreSQL Transaktionen an einigen Stellen

---

## Anhang: Betroffene Dateien

| Datei | Kritische Issues | Mittlere Issues |
|-------|-----------------|-----------------|
| `activities.js` | 2 | 1 |
| `badges.js` | 5 | 2 |
| `events.js` | 9 | 3 |
| `auth.js` | 1 | 2 |
| `konfi-management.js` | 0 | 1 |
| `server.js` | 2 | 1 |

---

*Diese Analyse basiert auf dem Stand vom 30. Dezember 2025.*
