# PostgreSQL Migration - Lessons Learned

## Kritische Fehlerquellen bei SQLite → PostgreSQL Migration

### 1. BigInt zu String Konversion ⚠️

**Problem:**
- PostgreSQL `bigint` Spalten werden vom Node.js `pg` Driver standardmäßig als **Strings** zurückgegeben
- Frontend erwartet Zahlen für mathematische Operationen
- Resultat: String-Konkatenation statt Addition (`"2" + "3" = "23"` statt `5`)

**Symptom:**
```
// Frontend zeigt: "063002310101210251..." statt korrekter Summe
konfis.reduce((sum, k) => sum + getTotalPoints(k), 0)
```

**Lösung:**
```javascript
// backend/database.js
const types = require('pg').types;
types.setTypeParser(20, (val) => parseInt(val, 10)); // bigint type = 20
```

**Betroffene Spalten:**
- `gottesdienst_points` (bigint)
- `gemeinde_points` (bigint)
- `points` (bigint)
- Alle COUNT() Abfragen

---

### 2. Column Alias Case Sensitivity 🔤

**Problem:**
- PostgreSQL konvertiert unquoted column aliases automatisch zu lowercase
- Frontend erwartet camelCase Properties
- SQLite behält original Case bei

**Symptom:**
```javascript
// Backend Query: SELECT COUNT(*) as badgeCount
// PostgreSQL Response: { badgecount: 1 }  ← lowercase!
// Frontend Code: konfi.badgeCount || 0    ← undefined, zeigt 0
```

**Lösung:**
```sql
-- Falsch:
SELECT COUNT(*) as badgeCount

-- Richtig:
SELECT COUNT(*) as "badgeCount"  -- Quotes preservieren camelCase
```

**Betroffene Felder:**
- `badgeCount`
- Alle camelCase aliases

---

### 3. Boolean Comparison Error 🔢

**Problem:**
- SQLite verwendet `1`/`0` für boolean values
- PostgreSQL hat native `boolean` type mit `true`/`false`
- Queries mit `= 1` schlagen fehl

**Symptom:**
```
ERROR: operator does not exist: boolean = integer
HINT: No operator matches the given name and argument types.
```

**Lösung:**
```sql
-- Falsch:
WHERE can_view = 1

-- Richtig:
WHERE can_view = true
```

---

### 4. Foreign Key Constraint Violations 🔗

**Problem:**
- pgloader importiert Daten in falscher Reihenfolge
- Verwaiste Referenzen durch inkonsistente SQLite-Daten
- Fehlende organization_id Referenzen

**Lösung:**
```sql
-- Datenbereinigung vor Migration:
DELETE FROM roles WHERE organization_id NOT IN (SELECT id FROM organizations);
DELETE FROM chat_messages WHERE room_id NOT IN (SELECT id FROM chat_rooms);
```

---

### 5. Migration Tools Comparison 📊

**pgloader (empfohlen):**
```bash
pgloader sqlite:///path/to/db.sqlite postgresql://user:pass@host:port/db
```
✅ Schnell und automatisch  
✅ Erhält Datentypen  
⚠️ Benötigt Datenbereinigung bei Constraint-Verletzungen

**Manuelles Migration Script:**
✅ Vollständige Kontrolle  
✅ Custom Data Transformation  
❌ Zeitaufwändig  
❌ Fehleranfällig bei Foreign Keys

---

## Migration Checklist ✅

### Vor der Migration:
- [ ] SQLite Daten auf Konsistenz prüfen
- [ ] Verwaiste Foreign Key Referenzen bereinigen
- [ ] Backup erstellen

### Nach der Migration:
- [ ] BigInt Type Parser konfigurieren
- [ ] Alle camelCase aliases in Quotes setzen
- [ ] Boolean Comparisons auf `true`/`false` ändern
- [ ] Frontend-API-Calls testen
- [ ] Mathematische Berechnungen validieren

### Production Deployment:
- [ ] Docker Container neu builden (nicht nur restart!)
- [ ] Database Constraints testen
- [ ] Performance vergleichen (PostgreSQL sollte besser sein)

---

## Code-Patterns für PostgreSQL

### Database Connection:
```javascript
// database.js
const { Pool } = require('pg');
const types = require('pg').types;

// KRITISCH: BigInt Type Parser
types.setTypeParser(20, (val) => parseInt(val, 10));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

### Sichere Column Aliases:
```sql
SELECT 
    u.display_name as name,
    kp.gottesdienst_points,
    kp.gemeinde_points,
    (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as "badgeCount"  -- Quotes!
FROM users u
```

### Boolean Queries:
```sql
-- SQLite Style (falsch für PostgreSQL):
WHERE active = 1 AND can_view = 1

-- PostgreSQL Style (korrekt):
WHERE active = true AND can_view = true
```

---

## Performance Verbesserungen durch PostgreSQL

1. **Bessere Concurrent Access** - Mehrere Admins gleichzeitig
2. **Proper Constraints** - Datenintegrität garantiert
3. **JSONB Support** - Für complex Badge-Conditions
4. **Bessere Aggregation** - Statistics-Queries sind schneller
5. **Production Ready** - ACID-Compliance, Backup-Tools

---

## Warum PostgreSQL Migration sinnvoll war

- ✅ **Skalierbarkeit**: Unterstützt mehr gleichzeitige Benutzer
- ✅ **Datenintegrität**: Robuste Foreign Key Constraints
- ✅ **Performance**: Bessere Query-Optimierung
- ✅ **Standards**: PostgreSQL SQL ist standardkonformer
- ✅ **Tooling**: Bessere Backup/Monitoring-Tools
- ✅ **Deployment**: Industry Standard für Production

**Fazit:** Migration war technisch herausfordernd, aber strategisch richtig!