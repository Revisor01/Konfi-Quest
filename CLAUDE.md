# CLAUDE.md - Konfipoints/Konfi Quest System

## ⚠️ KRITISCHE REGELN FÜR CLAUDE CODE

1. **NIEMALS das Backend ändern, nur Frontend anpassen** (außer bei kritischen Bugs)
2. **Neue RBAC-Struktur verwenden** - Alte Strukturen sind deprecated
3. **Alle API-Calls mit /admin/ prefix für Admin-Funktionen**
4. **Deutsche Entwicklungssprache verwenden**
5. **Legacy `points.gottesdienst` Struktur ist TOT - verwende `gottesdienst_points`**

---

## Aktuelle Systemarchitektur (Juli 2025)

### Backend: Node.js Express mit RBAC System
- **Database**: SQLite mit neuer RBAC-Struktur
- **Authentication**: JWT mit `verifyTokenRBAC` middleware
- **Port**: 5000 (Docker: 8623)
- **API Base**: https://konfipoints.godsapp.de/api

### Frontend: React 19 + Ionic 8 + TypeScript
- **Framework**: React 19 mit Ionic React 8
- **Build**: Vite 5.2 
- **State**: React Context (`AppContext`)
- **Dev Port**: 5173

---

## Neue RBAC Datenbankstruktur (VERWENDEN!)

### Kern-Tabellen:
```sql
-- Alle Benutzer (Admin + Konfis)
users: id, display_name, username, role_id, organization_id

-- Konfi-spezifische Daten
konfi_profiles: user_id, gottesdienst_points, gemeinde_points, jahrgang_id

-- Aktivitäten
konfi_activities: konfi_id, activity_id, completed_date, admin_id

-- Bonus Points
bonus_points: konfi_id, points, type, description, admin_id

-- Badges
konfi_badges: konfi_id, badge_id, awarded_date

-- Events
event_bookings: user_id, event_id, status, booking_date
```

### ❌ DEPRECATED (NICHT VERWENDEN):
- `admins` tabelle → Ersetzt durch `users` mit role='admin'
- `konfis` tabelle → Ersetzt durch `users` + `konfi_profiles`

---

## API Endpoints (Admin) - AKTUELL GÜLTIG

### Konfi Management
- `GET /api/admin/konfis` - Alle Konfis mit badgeCount ✅
- `GET /api/admin/konfis/:id` - Einzelner Konfi mit activities, bonusPoints ✅
- `POST /api/admin/konfis` - Neuer Konfi erstellen ✅
- `PUT /api/admin/konfis/:id` - Konfi bearbeiten ✅
- `DELETE /api/admin/konfis/:id` - Konfi löschen ✅
- `POST /api/admin/konfis/:id/regenerate-password` - Passwort neu generieren ✅

### Activities & Bonus (NEU IMPLEMENTIERT)
- `POST /api/admin/konfis/:id/activities` - Aktivität hinzufügen ✅
- `DELETE /api/admin/konfis/:id/activities/:activityId` - Aktivität löschen ✅
- `POST /api/admin/konfis/:id/bonus-points` - Bonuspunkte hinzufügen ✅
- `DELETE /api/admin/konfis/:id/bonus-points/:bonusId` - Bonuspunkte löschen ✅

### Activity Requests
- `GET /api/admin/activities/requests` - Alle Anträge ✅

### Other Resources
- `GET /api/admin/activities` - Alle Aktivitäten ✅
- `GET /api/admin/jahrgaenge` - Alle Jahrgänge ✅
- `GET /api/settings` - System Settings ✅

---

## Frontend Datenstrukturen (AKTUELL)

### Konfi Interface - SO VERWENDEN:
```typescript
interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang_name?: string;        // ✅ Backend liefert jahrgang_name
  gottesdienst_points?: number;  // ✅ Backend neue Struktur
  gemeinde_points?: number;      // ✅ Backend neue Struktur  
  badgeCount?: number;           // ✅ Jetzt verfügbar
  password?: string;             // ✅ Für Admin Views
}
```

### ✅ RICHTIGE Implementierung:
```typescript
const getTotalPoints = (konfi: Konfi) => {
  const gottesdienst = konfi.gottesdienst_points ?? 0;
  const gemeinde = konfi.gemeinde_points ?? 0;
  return gottesdienst + gemeinde;
};

// Anzeige
{konfi.jahrgang_name} • {konfi.badgeCount || 0} Badges
G: {konfi.gottesdienst_points ?? 0}/{settings.target_gottesdienst}
Gem: {konfi.gemeinde_points ?? 0}/{settings.target_gemeinde}
```

### ❌ FALSCH (Legacy - NICHT verwenden):
```typescript
// ❌ NIEMALS SO:
konfi.points?.gottesdienst  // TOT
konfi.points?.gemeinde     // TOT
konfi.jahrgang            // Backend liefert jahrgang_name
```

---

## Modals korrekt verwenden

### ✅ IMMER so (useIonModal Hook):
```typescript
const [presentModal, dismissModal] = useIonModal(MyModal, {
  onClose: () => dismissModal(),
  onSuccess: () => { 
    dismissModal(); 
    loadData(); // Daten neu laden
  }
});

// Öffnen
presentModal({ presentingElement: presentingElement });
```

### ❌ NIEMALS `<IonModal isOpen={state}>` verwenden!

---

## Entwicklungskommandos

### Backend starten:
```bash
cd backend && npm start
```

### Frontend development:
```bash
cd frontend && npm run dev
```

### Deployment:
```bash
ssh root@server.godsapp.de
cd /opt/Konfi-Quest/
git pull && docker-compose down && docker-compose up -d --build
```

---

## Häufige Probleme & Lösungen

### 1. 403 Forbidden Errors
- RBAC middleware prüfen in `middleware/rbac.js`
- JWT Token und Organization ID prüfen
- Permissions in Database validieren

### 2. "Daten werden nicht angezeigt"
**GRUND**: Legacy Datenstruktur verwendet!
**LÖSUNG**: 
- ✅ `konfi.gottesdienst_points` verwenden
- ✅ `konfi.gemeinde_points` verwenden  
- ✅ `konfi.jahrgang_name` verwenden
- ✅ `konfi.badgeCount` ist verfügbar

### 3. Modal 404 Errors
**GRUND**: Falsche API Routes
**LÖSUNG**:
- ✅ `/api/admin/konfis/:id/activities` 
- ✅ `/api/admin/konfis/:id/bonus-points`

### 4. Database Errors
- `konfi_event_registrations` → `event_bookings` verwenden
- `a.title` → `a.name` verwenden

### 5. useEffect Loop in ModalContext
**PROBLEM**: "Maximum update depth exceeded" in ModalContext
**GRUND**: `registerPage` Funktion wird bei jedem Render neu erstellt
**LÖSUNG**: `useCallback` verwenden für `registerPage`

```tsx
// ❌ FALSCH - verursacht Loop
const registerPage = (tabId: string, element: HTMLElement | null) => {
  // ...
};

// ✅ RICHTIG - verhindert Loop
const registerPage = useCallback((tabId: string, element: HTMLElement | null) => {
  // ...
}, []);
```

**WICHTIG**: Diese Lösung ist kritisch für Tab-Navigation und Modal-Funktionalität!

---

## Database Schema Mapping

### User/Konfi Queries:
```sql
-- Alle Konfis laden
SELECT u.id, u.display_name as name, u.username, 
       kp.gottesdienst_points, kp.gemeinde_points,
       j.name as jahrgang_name,
       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as badgeCount
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
WHERE r.name = 'konfi' AND u.organization_id = ?
```

---

## Typische API Aufrufe

```typescript
// ✅ Konfis laden (mit badges)
const konfis = await api.get('/admin/konfis');

// ✅ Einzelnen Konfi laden (komplett mit activities, bonusPoints)
const konfi = await api.get(`/admin/konfis/${id}`);

// ✅ Aktivität hinzufügen
await api.post(`/admin/konfis/${konfiId}/activities`, {
  activity_id: activityId,
  completed_date: date,
  comment: comment
});

// ✅ Bonuspunkte hinzufügen
await api.post(`/admin/konfis/${konfiId}/bonus-points`, {
  points: points,
  type: 'gottesdienst', // oder 'gemeinde'
  description: description
});
```

---

## System Status (Juli 2025)

### ✅ FUNKTIONIERT:
- RBAC System komplett migriert
- Badge Counts in Übersicht und Details
- Activity/Bonus CRUD Operations
- Admin Konfi Management
- Punkte werden korrekt angezeigt
- Modal System mit useIonModal

### 🔄 IN ARBEIT:
- Events Sektion für KonfiDetailView
- Legacy Code cleanup

### ❌ DEPRECATED:
- Alte `points.gottesdienst` Struktur
- `admins`/`konfis` Tabellen
- `<IonModal isOpen>` Pattern

---

**WICHTIG**: Dieses System ist produktiv. Alle Änderungen müssen der neuen RBAC-Struktur folgen!