# 🏆 BADGE-SYSTEM DOKUMENTATION

## 🎯 SYSTEM ÜBERSICHT

Das Badge-System ist ein vollständiges Gamification-Modul für das Konfi-Quest System. Es vergibt automatisch Badges (Achievements) basierend auf verschiedenen Kriterien wie Punkte, Aktivitäten, Kategorien und zeitbasierten Leistungen.

---

## 📊 DATENBANKSTRUKTUR

### **custom_badges** (Master-Badge-Definitionen)
```sql
CREATE TABLE custom_badges (
    id BIGINT PRIMARY KEY,
    name TEXT,                    -- Badge-Name (z.B. "Los geht's!")
    icon TEXT,                    -- Emoji/Icon (z.B. "🎯")
    description TEXT,             -- Beschreibung des Badges
    criteria_type TEXT,           -- Typ des Kriteriums (siehe unten)
    criteria_value BIGINT,        -- Zielwert (z.B. 20 für 20 Punkte)
    criteria_extra TEXT,          -- JSON für komplexe Kriterien
    is_active BOOLEAN DEFAULT true,
    is_hidden BOOLEAN DEFAULT false,  -- Geheime Badges
    organization_id BIGINT,       -- Multi-Tenant Support
    created_by BIGINT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### **konfi_badges** (Vergeben Badges)
```sql
CREATE TABLE konfi_badges (
    id BIGINT PRIMARY KEY,
    konfi_id BIGINT,              -- Konfi der das Badge erhalten hat
    badge_id BIGINT,              -- Referenz auf custom_badges
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    organization_id BIGINT        -- Multi-Tenant Support
);
```

---

## 🎯 CRITERIA TYPES (Badge-Kriterien)

### **🟢 PUNKTE-BASIERTE KRITERIEN (Einfach)**
```javascript
total_points: {
    description: "Mindestanzahl aller Punkte",
    example: "20 = mindestens 20 Punkte insgesamt"
}

gottesdienst_points: {
    description: "Mindestanzahl gottesdienstlicher Punkte", 
    example: "10 = mindestens 10 Gottesdienst-Punkte"
}

gemeinde_points: {
    description: "Mindestanzahl gemeindlicher Punkte",
    example: "15 = mindestens 15 Gemeinde-Punkte"
}

both_categories: {
    description: "Mindestpunkte in beiden Bereichen",
    example: "5 = mindestens 5 Gottesdienst-Punkte UND 5 Gemeinde-Punkte"
}
```

### **🟡 AKTIVITÄTS-BASIERTE KRITERIEN (Mittlere Komplexität)**
```javascript
activity_count: {
    description: "Gesamtanzahl aller Aktivitäten",
    example: "5 = mindestens 5 Aktivitäten (egal welche)"
}

unique_activities: {
    description: "Anzahl verschiedener Aktivitäten",
    example: "3 = 3 verschiedene Aktivitäten (Duplikate zählen nicht)"
}

bonus_points: {
    description: "Anzahl erhaltener Bonuspunkte-Vergaben",
    example: "2 = mindestens 2 Bonuspunkt-Einträge"
}
```

### **🟠 SPEZIFISCHE AKTIVITÄTS-KRITERIEN**
```javascript
specific_activity: {
    description: "Bestimmte Aktivität X-mal absolviert",
    criteria_extra: { "required_activity_name": "Sonntagsgottesdienst" },
    example: "5x Sonntagsgottesdienst teilgenommen"
}

category_activities: {
    description: "Aktivitäten aus bestimmter Kategorie",
    criteria_extra: { "required_category": "sonntagsgottesdienst" },
    example: "3 Aktivitäten aus Kategorie 'sonntagsgottesdienst'"
}

activity_combination: {
    description: "Spezifische Kombination von Aktivitäten",
    criteria_extra: { "required_activities": ["Taufe", "Konfirmation", "Trauung"] },
    example: "Alle 3 genannten Aktivitäten mindestens einmal"
}
```

### **🔴 ZEIT-BASIERTE KRITERIEN (Komplex)**
```javascript
time_based: {
    description: "Aktivitäten in einem Zeitraum",
    criteria_extra: { "days": 7 },
    example: "3 Aktivitäten in 7 Tagen"
}

streak: {
    description: "Aufeinanderfolgende Aktivitäten",
    example: "4 Wochen in Folge mindestens eine Aktivität"
}
```

---

## 🔄 BADGE-VERGABE TRIGGER-PUNKTE

### **Automatische Badge-Überprüfung erfolgt bei:**

1. **Admin manuelle Aktivitäts-Vergabe**
   ```javascript
   // Route: POST /api/admin/konfis/:id/activities
   // File: /backend/routes/konfi-managment.js
   const newBadges = await checkAndAwardBadges(db, konfiId);
   ```

2. **Admin manuelle Bonuspunkte-Vergabe**
   ```javascript
   // Route: POST /api/admin/konfis/:id/bonus-points  
   // File: /backend/routes/konfi-managment.js
   const newBadges = await checkAndAwardBadges(db, konfiId);
   ```

3. **Aktivitäts-Anträge Genehmigung**
   ```javascript
   // Route: PUT /api/activities/requests/:id (status = 'approved')
   // File: /backend/routes/activities.js
   const newBadges = await checkAndAwardBadges(db, request.konfi_id);
   ```

4. **Event-Teilnahme (automatisch nach Event)**
   ```javascript
   // Route: Various event completion routes
   // File: /backend/routes/events.js  
   const newBadges = await checkAndAwardBadges(db, eventData.user_id);
   ```

---

## 🏗️ BADGE-LOGIK KERN-FUNKTION

### **checkAndAwardBadges(db, konfiId)**
```javascript
// File: /backend/routes/badges.js
// Zentrale Funktion für Badge-Vergabe

const checkAndAwardBadges = async (db, konfiId) => {
  // 1. Konfi-Daten und Organisation laden
  // 2. Aktive Badges für Organisation laden  
  // 3. Bereits erhaltene Badges prüfen
  // 4. Für jedes nicht-erhaltene Badge:
  //    - Kriterium überprüfen (switch/case)
  //    - Bei Erfüllung: Badge vergeben
  //    - Notification senden
  // 5. Anzahl neuer Badges zurückgeben
}
```

### **Beispiel Badge-Überprüfung:**
```javascript
case 'total_points':
  earned = (konfi.gottesdienst_points + konfi.gemeinde_points) >= badge.criteria_value;
  break;

case 'unique_activities':
  const { rows: uniqueResults } = await db.query(
    "SELECT DISTINCT activity_id FROM konfi_activities WHERE konfi_id = $1", 
    [konfiId]
  );
  earned = uniqueResults.length >= badge.criteria_value;
  break;
```

---

## 📱 FRONTEND INTEGRATION

### **Badge-Anzeige im Dashboard**
```typescript
// File: /frontend/src/components/konfi/pages/KonfiDashboardPage.tsx
const secretEarned = earned.filter((badge: any) => badge.is_hidden === true).length;
const secretAvailable = allBadges.filter((badge: any) => badge.is_hidden === true).length;
```

### **Badge-Seite mit Progress**
```typescript
// File: /frontend/src/components/konfi/pages/KonfiBadgesPage.tsx
// Zeigt alle Badges mit Progress-Bars
// Format: "2/4" für Fortschritt + Prozent-Anzeige
{badge.progress_points || 0}/{badge.criteria_value}
```

### **Progress-Berechnung**
```typescript
// Backend berechnet Progress für jeden Badge-Typ
let progress = { current: 0, target: badge.criteria_value, percentage: 0 };
switch (badge.criteria_type) {
  case 'total_points':
    progress.current = totalPoints;
    progress.percentage = (progress.current / progress.target) * 100;
    break;
}
```

---

## 🎨 ADMIN INTERFACE

### **Badge-Verwaltung**
```javascript
// Routes: /api/badges/
GET    /              // Alle Badges anzeigen
POST   /              // Neues Badge erstellen  
PUT    /:id           // Badge bearbeiten
DELETE /:id           // Badge löschen
GET    /criteria-types // Verfügbare Kriterien-Typen
```

### **Badge-Erstellung Form-Felder:**
- **name**: Badge-Name (Text)
- **icon**: Emoji/Icon (Text) 
- **description**: Beschreibung (Text)
- **criteria_type**: Dropdown mit verfügbaren Typen
- **criteria_value**: Zielwert (Number)
- **criteria_extra**: JSON für komplexe Kriterien (Textarea)
- **is_hidden**: Checkbox für geheime Badges

---

## 🔧 TECHNISCHE DETAILS

### **Multi-Tenant Support (Organization ID)**
- Alle Badge-Queries filtern nach `organization_id`
- Badge-Vergabe nur innerhalb derselben Organisation
- Konfi kann nur Badges seiner Organisation sehen/erhalten

### **Notification System**
```javascript
// Bei Badge-Vergabe automatische Notification
await db.query(
  "INSERT INTO notifications (user_id, title, message, type, data, organization_id) VALUES (...)",
  [konfiId, `Neues Badge erhalten! ${badge.icon}`, message, 'badge_earned', data, organization_id]
);
```

### **Performance-Optimierungen**
- Badge-Überprüfung nur bei relevanten Events
- Batch-Insert für mehrere Badges
- Effiziente Queries mit JOINs statt N+1

---

## 🚀 DEPLOYMENT & WARTUNG

### **Produktions-Status: ✅ BEREIT**
- 50 Badges bereits konfiguriert
- Alle kritischen Bugs behoben
- Organization_id vollständig implementiert
- Frontend mit Progress-Anzeige

### **Monitoring & Debugging**
```javascript
// Console-Logs für Badge-Vergabe
console.log(`🏆 ${newBadges} neue Badge(s) für Konfi ${konfiId} vergeben`);

// Error-Handling in checkAndAwardBadges
try {
  // Badge logic
} catch (err) {
  console.error('Error in checkAndAwardBadges:', err);
  throw err; // Re-throw für Caller
}
```

### **Bekannte Limitierungen**
- Streak-Berechnung komplex (Wochenlogik)
- Time_based Badges basic implementiert
- Event-spezifische Badges fehlen noch

---

## 💡 ERWEITERUNGSMÖGLICHKEITEN

### **Zukünftige Badge-Types:**
- `event_participation` - Event-Teilnahme Badges
- `seasonal_activities` - Saisonale/Feiertags-Badges  
- `mentor_activities` - Mentor/Helfer-Badges
- `consistency_rewards` - Regelmäßigkeits-Badges

### **Admin-Features:**
- Badge-Preview vor Speichern
- Bulk-Badge-Vergabe
- Badge-Statistiken Dashboard
- Badge-Import/Export

**Status: 🟢 PRODUKTIV EINSATZBEREIT**