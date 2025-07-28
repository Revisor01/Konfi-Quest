# Konfi Management - Performance Optimierung

## Aktuelle Performance-Bottlenecks

### 1. Badge Count Berechnung
**Problem:** N+1 Query für jeden Konfi
```sql
-- Aktuell: Subquery für jeden Konfi
(SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as "badgeCount"
```

**Lösung:** JOIN mit COUNT
```sql
-- Optimiert: Ein einziger JOIN
LEFT JOIN (
    SELECT konfi_id, COUNT(*) as badge_count 
    FROM konfi_badges 
    GROUP BY konfi_id
) badges ON u.id = badges.konfi_id
```

### 2. Pagination für große Listen
**Problem:** Alle Konfis werden auf einmal geladen
**Lösung:** LIMIT/OFFSET mit Frontend-Pagination
```sql
-- Backend: GET /admin/konfis?page=1&limit=50
SELECT ... FROM users u ... 
ORDER BY j.name DESC, u.display_name
LIMIT $3 OFFSET $4
```

### 3. Database Indexe
**Kritische Indexe für Performance:**
```sql
-- Bereits vorhanden in Schema:
CREATE INDEX idx_users_organization_role ON users (organization_id, role_id);
CREATE INDEX idx_konfi_profiles_user ON konfi_profiles (user_id);
CREATE INDEX idx_konfi_badges_konfi ON konfi_badges (konfi_id);

-- Zusätzlich empfohlen:
CREATE INDEX idx_users_display_name ON users (display_name);
CREATE INDEX idx_jahrgaenge_name ON jahrgaenge (name);
```

### 4. Lazy Loading für Details
**Problem:** KonfiDetailView lädt alles sofort
**Lösung:** Aktivitäten/Bonuspunkte erst bei Tab-Wechsel laden
```typescript
// Statt sofort alle Details:
const loadKonfiDetails = async (id: string) => {
  const [konfi, activities, bonusPoints, eventPoints] = await Promise.all([
    api.get(`/admin/konfis/${id}`),
    api.get(`/admin/konfis/${id}/activities`),
    api.get(`/admin/konfis/${id}/bonus-points`),
    api.get(`/admin/konfis/${id}/event-points`)
  ]);
};

// Besser: Nur Basis-Daten, Rest on-demand
const loadBasicKonfi = async (id: string) => {
  return api.get(`/admin/konfis/${id}/basic`);
};
```

## Implementierungs-Prioritäten

### 🔴 **Sofort (>100 Konfis):**
1. Badge Count Subquery → JOIN optimieren
2. Display Name Index hinzufügen
3. Frontend Pagination implementieren

### 🟡 **Mittelfristig (>500 Konfis):**
1. Lazy Loading für Detail-Views
2. Search/Filter auf Backend verlagern
3. Aktivitäten/Bonus History paginieren

### 🟢 **Langfristig (>1000 Konfis):**
1. Redis Caching für Badge Counts
2. Materialized Views für Statistics
3. Database Connection Pooling optimieren

## Geschätzte Performance-Verbesserung

| Anzahl Konfis | Aktuell | Nach Optimierung | Verbesserung |
|---------------|---------|------------------|-------------|
| 50 Konfis     | ~200ms  | ~100ms          | 2x schneller |
| 100 Konfis    | ~800ms  | ~200ms          | 4x schneller |
| 500 Konfis    | ~4s     | ~500ms          | 8x schneller |
| 1000 Konfis   | ~15s    | ~1s             | 15x schneller |

## Code-Beispiele

### Optimierte Badge Count Query:
```sql
SELECT u.id, u.display_name as name, u.username, kp.password_plain, 
       kp.gottesdienst_points, kp.gemeinde_points,
       j.name as jahrgang_name, j.id as jahrgang_id,
       COALESCE(badges.badge_count, 0) as "badgeCount"
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
LEFT JOIN (
    SELECT konfi_id, COUNT(*) as badge_count 
    FROM konfi_badges 
    GROUP BY konfi_id
) badges ON u.id = badges.konfi_id
WHERE r.name = 'konfi' AND u.organization_id = $1
ORDER BY j.name DESC, u.display_name
LIMIT $2 OFFSET $3;
```

### Frontend Pagination Component:
```typescript
interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

const usePaginatedKonfis = (pageSize = 50) => {
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  
  const loadPage = async (pageNum: number) => {
    const response = await api.get(`/admin/konfis?page=${pageNum}&limit=${pageSize}`);
    return {
      konfis: response.data.konfis,
      totalCount: response.data.totalCount,
      totalPages: Math.ceil(response.data.totalCount / pageSize)
    };
  };
  
  return { page, setPage, loadPage, totalPages: Math.ceil(totalCount / pageSize) };
};
```

## Monitoring & Measurement

### Performance Metrics zu tracken:
1. **Query Execution Time** - PostgreSQL slow query log
2. **Frontend Load Time** - Browser DevTools Network tab
3. **Memory Usage** - Docker stats
4. **Database Connections** - PostgreSQL pg_stat_activity

### Test-Szenario für Performance-Tests:
```bash
# 1000 Test-Konfis erstellen
for i in {1..1000}; do
  curl -X POST localhost:8623/api/admin/konfis \
    -H "Authorization: Bearer $TOKEN" \
    -d "{\"name\":\"Test Konfi $i\",\"jahrgang_id\":1}"
done

# Load Time messen
time curl -s localhost:8623/api/admin/konfis > /dev/null
```