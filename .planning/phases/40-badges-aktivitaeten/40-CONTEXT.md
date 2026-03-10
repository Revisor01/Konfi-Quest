# Phase 40: Badges + Aktivitaeten - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Teamer-Badge-System und Teamer-Aktivitaeten einfuehren. Admin kann Teamer-spezifische Aktivitaeten erstellen und zuweisen, Teamer erhalten automatisch Badges basierend auf 5 Kriterien-Typen. Bestehende Tabellen werden umbenannt und um Rollen-Support erweitert.

</domain>

<decisions>
## Implementation Decisions

### DB-Struktur
- Geteilte Tabellen: bestehende Tabellen werden erweitert statt neue zu erstellen
- `konfi_badges` umbenennen zu `user_badges` (Spalte user_id statt konfi_id)
- `konfi_activities` umbenennen zu `user_activities` (Spalte user_id statt konfi_id)
- `badges` Tabelle bekommt `target_role` Spalte ('konfi' oder 'teamer') -- KEIN 'all', immer einer Rolle zugeordnet
- `activities` Tabelle bekommt `target_role` Spalte ('konfi' oder 'teamer')
- UNIQUE Constraint `(konfi_id, activity_id)` wird fuer ALLE aufgehoben (Konfis + Teamer koennen Aktivitaeten mehrfach bekommen)
- Alle Backend-Routes und Frontend-Referenzen muessen auf neue Tabellennamen migriert werden

### Badge-Kriterien fuer Teamer (5 Typen)
- Punkte-basierte Kriterien (total_points, gottesdienst_points, gemeinde_points, both_categories, bonus_points) sind fuer Teamer DEAKTIVIERT -- Teamer haben keine Punkte
- **activity_count**: X Aktivitaeten gesamt oder pro Kategorie
- **event_count**: X Events besucht (mit Anwesenheit bestaetigt)
- **streak**: X Wochen hintereinander aktiv (Aktivitaet oder Event)
- **activity_combination**: Bestimmte Kombination aus Aktivitaeten UND Events (gemischt moeglich, z.B. "Freizeit-Experte" = Jugendfreizeit + Konfifahrt + Uebernachtung + Teamerfreizeit)
- **teamer_year** (NEU): Aktive Teamer-Jahre zaehlen. Transition-Datum als Startpunkt. Ein Jahr zaehlt nur wenn mind. 1 Aktivitaet/Event in dem Jahr. Inaktive Jahre werden uebersprungen. Badge "3. Teamer-Jahr" = in 3 verschiedenen Jahren aktiv gewesen.

### Aktivitaeten-Vergabe
- Eigene Teamer-Aktivitaeten: activities-Tabelle mit target_role Spalte, Admin erstellt explizit fuer Konfis oder Teamer
- Teamer-Aktivitaeten OHNE Punkte-Felder (nur Name + Beschreibung + Kategorien)
- MIT Kategorien fuer Badge-Logik (z.B. Kategorie "Schulung" fuer JuLeiCa, Erste-Hilfe)
- Vergabe NUR durch Admin (wie bei Konfis)
- Mehrfachvergabe moeglich (gleiche Aktivitaet mehrmals, z.B. Jugendreise jedes Jahr)

### Admin-UI
- Badge-Management: Bestehendes BadgesView.tsx + BadgeManagementModal.tsx um Konfi/Teamer Segment-Toggle erweitern
- Aktivitaeten-Management: AdminSettingsPage Activities-Bereich bekommt Konfi/Teamer Segment-Toggle. Teamer-Aktivitaeten ohne Punkte-Felder
- Aktivitaets-Zuweisung: In der bestehenden Konfi-/Teamer-Verwaltung (KonfiDetailView). Teamer tauchen in der Liste mit auf
- KonfisView Jahrgang-Filter: "Teamer:innen" als zusaetzliche Option neben den bestehenden Jahrgaengen (Teamer sind nicht in Jahrgaengen)
- Badge-Auto-Check: Automatisch nach Aktivitaets-Zuweisung und Event-Attendance (wie bei Konfis), nur mit Teamer-spezifischen Kriterien

### Claude's Discretion
- Genauer Migrationspfad fuer Tabellen-Umbenennung (ALTER TABLE vs. neue Tabelle + Migration)
- Reihenfolge der Backend-Route-Anpassungen
- UI-Details der Segment-Toggles
- checkAndAwardBadges Refactoring fuer Teamer-Support

</decisions>

<specifics>
## Specific Ideas

- activity_combination soll Aktivitaeten UND Events mischen koennen (z.B. "Freizeit-Experte" = Jugendfreizeit (Aktivitaet) + Konfifahrt (Event) + Uebernachtung (Event) + Teamerfreizeit (Aktivitaet))
- Teamer-Jahr Badge: Transition 1.1.2026, aktiv im Jahr -> 1.1.2027 "1. Teamer-Jahr" Badge. Inaktives Jahr zaehlt nicht. Naechstes aktives Jahr -> "3. Teamer-Jahr" etc.
- Konfi-Liste hat bereits Jahrgang-Filter, braucht nur "Teamer:innen" als zusaetzliche Option

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `badges.js` CRITERIA_TYPES: 13 bestehende Typen, davon 5 fuer Teamer nutzbar + 1 neuer Typ
- `checkAndAwardBadges()`: Bestehende Auto-Award-Logik, muss um Teamer-Pfad erweitert werden (ueberspringt aktuell Teamer)
- `BadgesView.tsx` + `BadgeManagementModal.tsx`: Bestehende Badge-Verwaltungs-UI
- `AdminSettingsPage.tsx`: Aktivitaeten-Verwaltung bereits integriert
- `KonfiDetailView.tsx`: Aktivitaets-Zuweisung UI, muss fuer Teamer erweitert werden
- `KonfisView.tsx`: Jahrgang-Filter existiert bereits

### Established Patterns
- `condition_type` + `condition_data` JSONB: Flexibles Badge-Kriterien-System
- `checkAndAwardBadges` wird nach Punkte-Aenderungen und Aktivitaets-Zuweisungen aufgerufen
- Segment-Toggle Pattern: IonSegment wird in vielen Views verwendet (Events, Chat)
- target_role Pattern: Wird in dieser Phase eingefuehrt, spaeter auch fuer andere Tabellen nutzbar

### Integration Points
- `badges.js`: CRITERIA_TYPES erweitern, checkAndAwardBadges Teamer-Branch
- `activities.js`: target_role Filter, Punkte-Felder optional
- `konfi-managment.js`: Teamer-Aktivitaets-Zuweisung
- `teamer.js`: Badge-Daten fuer Teamer-Profil/Dashboard
- Schema: ALTER TABLE Migrationen fuer Umbenennung und neue Spalten

</code_context>

<deferred>
## Deferred Ideas

- Teamer-Antraege fuer Aktivitaeten (PRF-01, Phase 43)

</deferred>

---

*Phase: 40-badges-aktivitaeten*
*Context gathered: 2026-03-10*
