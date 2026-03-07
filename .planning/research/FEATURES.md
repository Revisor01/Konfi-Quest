# Feature Landscape: Dashboard-Konfig + Punkte-Logik v1.6

**Domain:** Konfigurierbare Punkte-Typen + Dashboard-Widget-System fuer Konfi Quest
**Researched:** 2026-03-07
**Confidence:** HIGH (basiert auf vollstaendiger Codebase-Analyse, keine externen Abhaengigkeiten)

## Ist-Zustand Analyse

### Punkte-System (aktuell)

| Komponente | Ort | Verhalten |
|-----------|-----|-----------|
| Punkte-Ziele | `settings`-Tabelle (Key-Value, org-scoped) | `target_gottesdienst` + `target_gemeinde`, global pro Organisation |
| Punkte-Speicherung | `konfi_profiles` (Spalten `gottesdienst_points`, `gemeinde_points`) | Immer zwei Spalten, werden summiert |
| Aktivitaeten-Typ | `activities.type` = `gottesdienst` ODER `gemeinde` | Hardcoded 2 Typen, Whitelist in `getPointField()` |
| Ranking | `konfi.js` Z.97-107 | `SUM(gottesdienst_points + gemeinde_points)` |
| ActivityRings | `ActivityRings.tsx` | 3 Ringe hardcoded: Gesamt (Gold), Gottesdienst (Blau), Gemeinde (Gruen) |
| Progress-Bars | `KonfisView.tsx` Z.292-334 | 3 Bars: Gottesdienst, Gemeinde, Gesamt |
| Admin-Ziele | `AdminGoalsPage.tsx` | 2 Stepper (Gottesdienst + Gemeinde), laedt/speichert via `/settings` |
| Badge-Kriterien | `badges.js` (13 CRITERIA_TYPES) | 4 punkte-basiert: `total_points`, `gottesdienst_points`, `gemeinde_points`, `both_categories` |

### Dashboard-Sections (aktuell in DashboardView.tsx, ~1450 Zeilen)

| Section | Zeilen | Inhalt | Abschaltbar? |
|---------|--------|--------|-------------|
| Header + ActivityRings | Z.586-743 | Begruessing, Ringe, Level-Badge, Level-Progress | Nein (Kern-Element) |
| Konfirmation | Z.745-912 | Countdown + Events | Nicht konfigurierbar |
| Tageslosung | Z.915-960 | AT/NT Bibelvers wechselnd | Nicht konfigurierbar |
| Badges | Z.962-1234 | Badge-Sammlung, Stats, Secret-Badges | Nicht konfigurierbar |
| Ranking | Z.1236-1450 | Jahrgangs-Platzierung, Top 3 + Nachbarn | Nicht konfigurierbar |
| Events | Z.830-912 | Angemeldete Events | Nicht konfigurierbar |

## Table Stakes

Features die fuer v1.6 erwartet werden. Ohne diese ist das Feature unvollstaendig.

| Feature | Warum erwartet | Komplexitaet | Abhaengigkeiten | Notes |
|---------|---------------|-------------|-----------------|-------|
| Punkte-Typ Aktivierung/Deaktivierung pro Jahrgang | Kern-Anforderung: Manche Gemeinden nutzen nur einen Punktetyp. Muss jahrgangs-spezifisch sein, nicht org-weit | Med | `jahrgaenge` Tabelle erweitern, `jahrgaenge.js`, Jahrgang-Edit-Modal | Aktuell hat `jahrgaenge` nur `name` + `confirmation_date`. Neue Spalten: `gottesdienst_enabled BOOLEAN DEFAULT true`, `gemeinde_enabled BOOLEAN DEFAULT true` |
| ActivityRings dynamisch (1-3 Ringe) | Ohne Anpassung zeigen Ringe leere/sinnlose Rings fuer deaktivierten Typ | Med | `ActivityRings.tsx` (Props erweitern um `showGottesdienst`, `showGemeinde`) | Bei 1 Typ: 1 Ring. Bei 0 Typen: Ringe komplett ausblenden |
| Gesamt-Ring-Logik bei einem Typ | Gesamt-Ring = Summe beider Typen. Bei einem Typ ist Gesamt identisch mit dem aktiven Typ -> redundant | Low | `ActivityRings.tsx` | Gesamt-Ring nur anzeigen wenn beide Typen aktiv |
| Legende dynamisch | LegendItem zeigt aktuell immer alle 3 Labels | Low | `ActivityRings.tsx` LegendItem-Komponente | Nur aktive Typen in Legende |
| Progress-Bars in KonfisView anpassen | Admin sieht 0/0 Bars fuer deaktivierte Typen | Low | `KonfisView.tsx` Z.292-334 | Deaktivierte Bar ausblenden, bei 1 Typ: Gesamt = aktiver Typ |
| KonfiDetailView ActivityRings anpassen | Admin-Konfi-Detail zeigt identische Ringe wie Dashboard | Low | `KonfiDetailView.tsx` Z.499-500 | Gleiche Logik wie Dashboard-Ringe, braucht Jahrgang-Config |
| Badge-Kriterien Warnung bei Typ-Deaktivierung | Badges mit `gottesdienst_points`/`gemeinde_points`/`both_categories` werden unerreichbar wenn Typ deaktiviert | High | `badges.js`, `checkAndAwardBadges()`, Jahrgang-Edit-Modal | Admin muss beim Deaktivieren gewarnt werden: "X Badges verwenden diesen Punktetyp" |
| Badge-Check skip bei deaktiviertem Typ | `checkAndAwardBadges` darf Badges mit deaktiviertem Typ-Kriterium nicht als "nicht erreicht" zaehlen | Med | `badges.js` checkAndAwardBadges, Jahrgang-Config | Badge wird uebersprungen, nicht als fehlend gewertet |
| Backend: Jahrgang-Config im Dashboard-Endpoint | Frontend braucht die enabled/disabled Info pro Typ | Low | `konfi.js` Dashboard-Route Z.32-62 | JOIN mit `jahrgaenge` liefert bereits `jahrgang_name`, muss `gottesdienst_enabled` + `gemeinde_enabled` hinzufuegen |
| Dashboard-Widget-Konfiguration (Org-Admin UI) | Org-Admin bestimmt welche Widgets Konfis sehen | Med | `settings.js` (Key-Value Store erweitern), neuer Admin-Settings-Bereich | Neuer Settings-Key `dashboard_widgets` als JSON |
| Dashboard rendert nur aktive Widgets | Konfi sieht nur konfigurierte Sections | Med | `DashboardView.tsx` (5 abschaltbare Sections) | Conditional Rendering basierend auf Widget-Config |
| Backend: Widget-Config im Dashboard-Daten | Frontend braucht Widget-Config bei jedem Dashboard-Load | Low | `konfi.js` Dashboard-Route, `settings`-Tabelle | Settings-Query erweitern um `dashboard_widgets` Key |

## Differentiators

Features die ueber das Minimum hinausgehen, aber echten Mehrwert bieten.

| Feature | Wertversprechen | Komplexitaet | Notes |
|---------|----------------|-------------|-------|
| Migration-Hinweis bei Typ-Deaktivierung | "X Konfis haben bereits Y Punkte in diesem Typ" -- verhindert versehentliches Deaktivieren | Low | Ein COUNT-Query beim Toggle genuegt. Guter UX-Schutz |
| Info-Text im Konfi-Dashboard | Kurzer Text "Deine Gemeinde trackt nur Gottesdienst-Punkte" wenn ein Typ deaktiviert | Low | Hilft Konfis zu verstehen warum nur ein Ring sichtbar ist |
| Admin-Goals pro Jahrgang | Statt org-weite Targets: Unterschiedliche Ziele pro Jahrgang | Med | Wuerde `target_gottesdienst`/`target_gemeinde` von `settings` nach `jahrgaenge` verschieben. Sinnvoll wenn Jahrgaenge verschiedene Anforderungen haben |
| Preview der Widget-Konfiguration | Admin sieht Vorschau wie Dashboard fuer Konfis aussieht | Med | Nett, aber bei 5 einfachen Toggles uebertrieben |

## Anti-Features

Features die explizit NICHT gebaut werden sollen.

| Anti-Feature | Warum vermeiden | Stattdessen |
|-------------|----------------|-------------|
| Punkte loeschen bei Typ-Deaktivierung | Datenverlust, Admin-Fehler nicht reversibel | Punkte bleiben in DB, werden nur nicht angezeigt/gewertet. Reaktivierung stellt alles wieder her |
| Dynamische Anzahl Punkte-Typen (N Typen) | System ist auf 2 Typen (Gottesdienst + Gemeinde) gebaut -- DB-Spalten, Variablennamen, UI-Texte. Generische N Typen waere massives Refactoring (>1000 Zeilen) | Bleibe bei 2 festen Typen, erlaube 0/1/2 aktiv |
| Widget-Konfiguration pro Jahrgang | Zu granular, ueberfordert Admins. Verschiedene Jahrgaenge gleicher Org sehen verschiedene Dashboards? Verwirrend | Dashboard-Config gilt org-weit |
| Punkte-Typ umbenennen | "Gottesdienst" und "Gemeinde" sind in der gesamten Codebase hardcoded: DB-Spalten (`gottesdienst_points`, `gemeinde_points`), getPointField-Whitelist, ActivityRings-Farben, LegendItems, Badge-Criteria | Labels bleiben fest. Umbenennung waere ein eigenes Refactoring |
| Custom Dashboard-Widgets | Admin erstellt beliebige Dashboard-Widgets mit eigenem Inhalt | Festes Widget-Set (5 Stueck) mit Toggle reicht. Konfis sind keine Power-User |
| Drag & Drop Widget-Reihenfolge | Admin sortiert Widgets per Drag & Drop | Feste Reihenfolge. Reihenfolge ist durchdacht (Header -> Konfirmation -> Losung -> Badges -> Ranking -> Events) |
| Aktivitaeten bei deaktiviertem Typ blockieren | Gemeinde-Aktivitaeten nicht mehr erfassbar wenn Gemeinde deaktiviert | Aktivitaeten bleiben erfassbar, Punkte werden weiterhin gespeichert. Nur Anzeige (Ring/Bar/Ziel) entfaellt. Ermoegllicht spaetere Reaktivierung |

## Feature-Abhaengigkeiten

```
Jahrgang-Tabelle erweitern (gottesdienst_enabled, gemeinde_enabled)
  |-> Backend: Dashboard-Endpoint liefert Jahrgang-Config mit
  |     |-> ActivityRings dynamisch (1-3 Ringe)
  |     |-> Progress-Bars anpassen (KonfisView)
  |     |-> KonfiDetailView Ringe anpassen
  |     |-> Badge-Check skip bei deaktiviertem Typ
  |-> Jahrgang-Edit-Modal: Toggles fuer Punkte-Typen
  |     |-> Badge-Warnung bei Deaktivierung (Alert im Modal)
  |     |-> Migration-Hinweis (optional)

Dashboard-Widget-Config in Settings-Tabelle
  |-> Admin Settings UI: Widget-Toggles
  |-> Backend: Widget-Config im Dashboard-Daten
  |     |-> DashboardView Conditional Rendering
```

## Bestandsaufnahme: Betroffene Code-Stellen

### Was passiert wenn `gottesdienst_enabled = false`?

| Stelle | Datei | Aktuelles Verhalten | Neues Verhalten |
|--------|-------|-------------------|-----------------|
| ActivityRings | `ActivityRings.tsx` | 3 Ringe: Gesamt (Gold), Gottesdienst (Blau), Gemeinde (Gruen) | 1 Ring: Gemeinde (Gruen). Gesamt-Ring entfaellt (= Gemeinde) |
| ActivityRings Props | `DashboardView.tsx` Z.636-643 | Alle 3 Werte uebergeben | `showGottesdienst={false}` |
| Legende | `ActivityRings.tsx` LegendItem | 3 Labels | 1 Label (Gemeinde) |
| Admin-Konfi-Liste | `KonfisView.tsx` Z.292-334 | 3 Progress-Bars | 2 Bars (Gemeinde + Gesamt, wobei identisch -> 1 Bar) |
| Admin-Konfi-Detail | `KonfiDetailView.tsx` Z.499-500 | Alle Goals | `gottesdienstGoal={0}` |
| Badge-Check | `badges.js` checkAndAwardBadges | Prueft `gottesdienst_points` Kriterium | Skip Badges mit `gottesdienst_points`/`both_categories` Kriterium |
| Ranking | `konfi.js` Z.97-107 | `SUM(godi + gem)` | Bleibt: Summe ist weiterhin korrekt (Godi = 0) |
| Punkte-Ziel Stepper | `AdminGoalsPage.tsx` | 2 Stepper immer sichtbar | Gottesdienst-Stepper ausgegraut oder unsichtbar wenn Typ deaktiviert fuer alle Jahrgaenge |

### Was passiert wenn BEIDE Typen deaktiviert?

| Stelle | Verhalten |
|--------|-----------|
| ActivityRings | Komplett ausblenden. Nur Begruessing + Level sichtbar |
| Progress-Bars | Komplett ausblenden |
| Ranking | Bleibt (alle haben 0 Punkte, Platz 1 geteilt) -- ODER ausblenden |
| Badge-Checks | Punkte-basierte Badges uebersprungen, andere Kriterien (activity_count, event_count, streak, etc.) funktionieren weiterhin |
| Level-Progress | Basiert auf Gesamtpunkten = 0 -> kein Fortschritt. Progress-Bar ausblenden |

**Empfehlung:** Beide-deaktiviert ist ein Edge Case der funktionieren muss, aber nicht optimiert werden muss. Ringe + Level-Progress ausblenden, Rest bleibt.

### Dashboard-Widgets: Konfigurierbare Sections

| Widget-ID | Section | Default | Kann deaktiviert werden? |
|-----------|---------|---------|------------------------|
| `header` | Header mit ActivityRings, Begruessing, Level | aktiv | NEIN -- enthaelt Kern-Identitaet der App |
| `konfirmation` | Countdown zur Konfirmation | aktiv | JA |
| `tageslosung` | Tageslosung (AT/NT wechselnd) | aktiv | JA |
| `badges` | Badge-Sammlung mit Stats | aktiv | JA |
| `ranking` | Jahrgangs-Ranking | aktiv | JA |
| `events` | Angemeldete Events | aktiv | JA |

## Datenmodell-Empfehlung

### Punkte-Typ-Konfiguration: Spalten auf `jahrgaenge`

```sql
ALTER TABLE jahrgaenge ADD COLUMN gottesdienst_enabled BOOLEAN DEFAULT true;
ALTER TABLE jahrgaenge ADD COLUMN gemeinde_enabled BOOLEAN DEFAULT true;
```

**Warum auf `jahrgaenge` statt `settings`:**
- Punkte-Typen sind jahrgangs-spezifisch: Jahrgang 2025 kann Gottesdienst-frei sein, Jahrgang 2026 nicht
- `settings`-Tabelle ist org-weit (kein Jahrgang-Bezug)
- Jahrgang-Edit-Modal ist der natuerliche Ort fuer diese Konfiguration
- Kein neues Datenmodell noetig, nur 2 Spalten

**Targets bleiben in `settings`:** `target_gottesdienst` und `target_gemeinde` sind weiterhin org-weite Zielwerte. Die `enabled`-Flags auf dem Jahrgang bestimmen nur, OB ein Typ angezeigt/gewertet wird.

### Dashboard-Widget-Config: JSON in `settings`

```sql
-- In bestehender settings-Tabelle (Key-Value):
INSERT INTO settings (organization_id, key, value)
VALUES (1, 'dashboard_widgets', '{"konfirmation":true,"tageslosung":true,"badges":true,"ranking":true,"events":true}');
```

**Warum:** Passt in bestehendes Key-Value-Pattern. JSON-Wert mit Widget-IDs und boolean. Default wenn Key fehlt: alle aktiv.

## Kritische Entscheidung: ActivityRings bei einem Typ

**Option A: 2 Ringe (Gesamt + aktiver Typ)**
- Gesamt-Ring ist identisch mit aktivem Typ -> redundant und verwirrend

**Option B: 1 Ring (nur aktiver Typ) -- EMPFOHLEN**
- Klar und eindeutig
- Zentrale Zahl zeigt weiterhin Gesamtpunkte
- Legende zeigt nur aktiven Typ
- Wenig Code-Aenderung: neue optionale Props `showGottesdienst`, `showGemeinde`

**Option C: 2 Ringe mit angepassten Radien (aktiver Typ aussen, Gesamt innen)**
- Visuell ansprechender als 1 Ring
- Aber: immer noch redundant bei 1 Typ

**Empfehlung:** Option B. ActivityRings bekommt `showGottesdienst?: boolean` und `showGemeinde?: boolean` Props (default: true). Nicht uebergebene Ringe werden nicht gerendert. Radien der verbleibenden Ringe werden angepasst damit sie zentriert aussehen.

## MVP-Empfehlung

### Phase 1: Punkte-Logik (Backend + Datenmodell)
1. Jahrgang-Tabelle erweitern (`gottesdienst_enabled`, `gemeinde_enabled`)
2. Jahrgang-CRUD Endpoints anpassen (neue Felder lesen/schreiben)
3. Dashboard-Endpoint: Jahrgang-Config mitliefern
4. Badge-Check: Deaktivierte Typ-Kriterien skippen

### Phase 2: Punkte-UI (Frontend-Anpassungen)
5. ActivityRings: Dynamische Props, 1-3 Ringe
6. Jahrgang-Edit-Modal: Toggles fuer Punkte-Typen + Badge-Warnung
7. KonfisView Progress-Bars anpassen
8. KonfiDetailView Ringe anpassen
9. AdminGoalsPage: Deaktivierte Typen markieren

### Phase 3: Dashboard-Konfiguration
10. Settings-Endpoint um `dashboard_widgets` erweitern
11. Admin-UI: Widget-Toggles in Settings (Checkbox-Liste)
12. DashboardView: Conditional Rendering basierend auf Widget-Config
13. Backend: Widget-Config im Dashboard-Daten mitliefern

**Zurueckstellen:**
- Widget-Reihenfolge (feste Reihenfolge reicht)
- Preview (unnoetig bei einfachen Toggles)
- Info-Banner fuer Konfis (nice-to-have, kann spaeter kommen)
- Admin-Goals pro Jahrgang (erst bei konkretem Bedarf)

## Feature-Priorisierungs-Matrix

| Feature | Nutzer-Wert | Implementierungskosten | Prioritaet |
|---------|------------|----------------------|-----------|
| Punkte-Typ toggle pro Jahrgang | HIGH | MED | P1 |
| ActivityRings dynamisch | HIGH | MED | P1 |
| Badge-Warnung bei Deaktivierung | HIGH | MED | P1 |
| Badge-Check skip | HIGH | MED | P1 |
| Dashboard-Widget-Toggles (Admin) | MED | MED | P1 |
| Dashboard Conditional Rendering | MED | MED | P1 |
| Progress-Bars anpassen | MED | LOW | P1 |
| KonfiDetailView Ringe | MED | LOW | P1 |
| Backend Config-Endpoints | MED | LOW | P1 |
| Migration-Hinweis bei Deaktivierung | LOW | LOW | P2 |
| Info-Text im Konfi-Dashboard | LOW | LOW | P2 |

## Quellen

- Codebase-Analyse: `DashboardView.tsx` (~1450 Zeilen, 6 Sections, Z.586-1450)
- Codebase-Analyse: `ActivityRings.tsx` (350 Zeilen, 3 hardcoded Ringe, Props: totalPoints, gottesdienstPoints, gemeindePoints, gottesdienstGoal, gemeindeGoal)
- Codebase-Analyse: `badges.js` (13 CRITERIA_TYPES, 4 punkte-basiert: total_points, gottesdienst_points, gemeinde_points, both_categories)
- Codebase-Analyse: `settings.js` (Key-Value Store, org-scoped, target_gottesdienst/target_gemeinde/konfi_chat_permissions/waitlist_enabled/max_waitlist_size)
- Codebase-Analyse: `jahrgaenge.js` (CRUD, aktuell nur name + confirmation_date + organization_id)
- Codebase-Analyse: `AdminGoalsPage.tsx` (2 Stepper, laedt/speichert via GET/PUT /settings)
- Codebase-Analyse: `KonfisView.tsx` (3 Progress-Bars pro Konfi, Z.292-334, targets aus settings)
- Codebase-Analyse: `KonfiDetailView.tsx` (ActivityRings mit settings.target_gottesdienst/target_gemeinde, Z.499-500)
- Codebase-Analyse: `konfi.js` Dashboard-Route (Z.32-240, Ranking, Level, Punkte aus konfi_profiles)

---
*Feature-Research fuer: Konfi Quest v1.6 Dashboard-Konfig + Punkte-Logik*
*Recherchiert: 2026-03-07*
