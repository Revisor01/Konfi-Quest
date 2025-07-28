# Konfi Management - Testcase Szenarios

## Testfälle die unbedingt geprüft werden müssen

### 🔴 KRITISCH: Konfi-Löschung mit Referenzen (DELETE /api/admin/konfis/:id)

**Warum kritisch:** 
- Löscht Daten aus 7 verschiedenen Tabellen
- Foreign Key Constraints können Löschung verhindern
- Datenintegrität muss gewährleistet bleiben

**Testcase 1: Vollständige Konfi-Löschung**
```
1. Konfi erstellen mit Name "Test Konfi" und jahrgang_id
2. Aktivität zuweisen (konfi_activities)
3. Bonuspunkte vergeben (bonus_points) 
4. Badge vergeben (konfi_badges)
5. Activity Request erstellen (activity_requests)
6. Chat Participation hinzufügen (chat_participants)
7. Event Points vergeben (event_points)
8. Konfi löschen via DELETE /api/admin/konfis/:id
9. Prüfen: Alle Referenzen müssen entfernt sein
```

**Expected Result:** 
- Status 200 + "Konfi deleted successfully"
- Alle 7 Tabellen sauber ohne Waisen-Referenzen

**Potential Issues:**
- Foreign Key Constraints verhindern Löschung
- Falsche Lösch-Reihenfolge in der Route
- Missing organization_id Filter könnte zu Cross-Org Löschungen führen

---

### 🟡 WICHTIG: Punktesystem Integrität

**Testcase 2: Aktivität zuweisen und entfernen**
```
1. Konfi erstellen 
2. Aktivität mit 5 Gottesdienst-Punkten zuweisen
3. Prüfen: konfi_profiles.gottesdienst_points = 5
4. Aktivität wieder entfernen via DELETE
5. Prüfen: konfi_profiles.gottesdienst_points = 0
```

**Testcase 3: Bonuspunkte vergeben und entfernen**
```
1. Konfi erstellen
2. 3 Bonuspunkte Typ "gemeinde" vergeben  
3. Prüfen: konfi_profiles.gemeinde_points = 3
4. Bonuspunkte löschen
5. Prüfen: konfi_profiles.gemeinde_points = 0
```

**Expected Result:** Punkte-Stände müssen mathematisch korrekt sein

---

### 🟡 WICHTIG: Organization Isolation

**Testcase 4: Cross-Organization Zugriff verhindern**
```
1. Als Org 1 Admin: Konfi in Org 1 erstellen
2. Als Org 2 Admin einloggen
3. Versuchen Org 1 Konfi zu laden: GET /api/admin/konfis/{org1_konfi_id}
4. Versuchen Org 1 Konfi zu bearbeiten
5. Versuchen Org 1 Konfi zu löschen
```

**Expected Result:** Alle Requests sollten 404 "not found" zurückgeben

---

### 🟡 WICHTIG: Transaktionale Integrität

**Testcase 5: Konfi Creation Rollback**
```
1. Konfi mit bereits existierendem Username erstellen
2. Database Error sollte Transaction zurückrollen
3. Prüfen: Keine Halbfertige Einträge in users oder konfi_profiles
```

**Testcase 6: Password Regeneration Rollback**
```
1. Konfi existiert
2. Mock Database Error während Password Update
3. Prüfen: Alter Password bleibt unverändert
```

---

### 🟢 STANDARD: CRUD Operations

**Testcase 7: Konfi Liste laden**
```
1. 3 Konfis in verschiedenen Jahrgängen erstellen
2. GET /api/admin/konfis
3. Prüfen: Alle 3 Konfis mit badgeCount, jahrgang_name, Punkten
```

**Testcase 8: Konfi Details laden**
```
1. Konfi mit Aktivitäten und Bonuspunkten erstellen
2. GET /api/admin/konfis/:id  
3. Prüfen: activities[] und bonusPoints[] Arrays sind vollständig
```

**Testcase 9: Konfi bearbeiten**
```
1. Konfi erstellen in Jahrgang A
2. PUT Request: Name ändern + zu Jahrgang B verschieben
3. Prüfen: Beide Änderungen sind persistent
```

---

### 🔴 KRITISCH: Jahrgang-Permissions

**Testcase 10: Jahrgang-basierte Sichtbarkeit**
```
1. Admin mit Zugriff nur auf Jahrgang A
2. Konfis in Jahrgang A und B erstellen
3. GET /api/admin/konfis als beschränkter Admin
4. Prüfen: Nur Jahrgang A Konfis sind sichtbar
```

---

### 🟡 WICHTIG: Passwort-Handling

**Testcase 11: Password Generation**
```
1. Konfi erstellen
2. Prüfen: password_plain ist biblisches Wort + Zahlen
3. Prüfen: password_hash ist bcrypt verschlüsselt
4. Passwort regenerieren
5. Prüfen: Neues Passwort unterschiedlich vom alten
```

---

## Automatisierte Testskripte

### Database Cleanup Hilfsfunktion
```javascript
async function cleanupTestData(db, konfiId) {
    await db.query('DELETE FROM konfi_activities WHERE konfi_id = $1', [konfiId]);
    await db.query('DELETE FROM bonus_points WHERE konfi_id = $1', [konfiId]); 
    await db.query('DELETE FROM konfi_badges WHERE konfi_id = $1', [konfiId]);
    await db.query('DELETE FROM activity_requests WHERE konfi_id = $1', [konfiId]);
    await db.query('DELETE FROM chat_participants WHERE user_id = $1', [konfiId]);
    await db.query('DELETE FROM event_points WHERE konfi_id = $1', [konfiId]);
    await db.query('DELETE FROM konfi_profiles WHERE user_id = $1', [konfiId]);
    await db.query('DELETE FROM users WHERE id = $1', [konfiId]);
}
```

### Punkt-Verifikation Hilfsfunktion
```javascript
async function verifyPoints(db, konfiId, expectedGottesdienst, expectedGemeinde) {
    const { rows: [result] } = await db.query(
        'SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1', 
        [konfiId]
    );
    assert.equal(result.gottesdienst_points, expectedGottesdienst);
    assert.equal(result.gemeinde_points, expectedGemeinde);
}
```

---

## Manuelle Testschritte für dich:

### 1. **Konfi Vollständig löschen** (KRITISCH)
```
1. Admin Panel öffnen
2. Neuen Konfi erstellen
3. Aktivität zuweisen + Bonuspunkte vergeben
4. Konfi löschen
5. Database prüfen: Alle Referenzen weg?
```

### 2. **Punkte-Mathematik prüfen**
```
1. Konfi mit 0 Punkten
2. Aktivität 5 Punkte + Bonus 3 Punkte vergeben
3. Frontend: Zeigt 8 Gesamtpunkte?
4. Aktivität entfernen
5. Frontend: Zeigt 3 Gesamtpunkte?
```

### 3. **Organization Isolation**
```
1. Zwei Browser: Org 1 + Org 2 Admin
2. Org 1: Konfi erstellen
3. Org 2: Konfi-Liste laden
4. Org 1 Konfi darf NICHT sichtbar sein
```

### 4. **Error Handling**
```
1. Konfi mit selben Namen zweimal erstellen
2. Error Message sinnvoll?
3. Nicht-existenten Konfi bearbeiten
4. 404 Error korrekt?
```

### 5. **Performance Check**
```
1. 20+ Konfis mit vielen Aktivitäten erstellen
2. Konfi-Liste laden - Performance OK?
3. Einzeln Konfi Details - Lädt schnell?
```

**Die 5 kritischsten Tests, die du sofort machen solltest:**
1. ✅ Konfi löschen mit allen Referenzen
2. ✅ Punkte addieren/subtrahieren mathematisch korrekt
3. ✅ Organization Isolation funktioniert
4. ✅ Username Uniqueness Error Handling
5. ✅ Jahrgang-Permissions bei beschränktem Admin