# Phase 38: Rolle + App-Shell - Context

**Gathered:** 2026-03-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Teamer-Transition (Konfi -> Teamer) und eigene 5-Tab-UI aufbauen. Teamer existiert als nutzbare Rolle mit eigener Navigation und UI-Grundstruktur. Chat und Profil funktionieren sofort, restliche Tabs sind EmptyState-Platzhalter fuer spaetere Phasen.

</domain>

<decisions>
## Implementation Decisions

### Transition-Flow
- Button "Zum Teamer befoerdern" in KonfiDetailView (nicht im UserManagementModal)
- Bestaetigungsdialog mit Zusammenfassung: Name, aktuelle Punkte/Badges, Warnung dass UI wechselt
- Bei Transition: Event-Buchungen und offene Antraege werden geloescht
- Chat-Raeume bleiben erhalten (Zugriff bleibt bestehen)
- Transition ist einmalig -- kein Zurueck von Teamer zu Konfi

### Teamer-TabBar
- 5 Tabs in Reihenfolge: Start (home), Chat (chatbubbles), Events (calendar), Material (documentIcon), Profil (person)
- Chat auf Position 2 wie bei Konfis -- zentraler Platz
- Eigene Teamer-Farbe: Rose (#e11d48) -- hebt sich klar von Konfi-Lila, Admin-Blau und Chat-Teal ab
- Route-Prefix: /teamer/ (eigener Namespace)

### Badge/Punkte-Einfrierung
- konfi_profiles-Zeile bleibt nach Transition bestehen (nicht loeschen)
- konfi_badges bleiben als Historie erhalten
- Teamer-Profil liest Konfi-Daten readonly aus
- Badge-Auto-Check ueberspringt User mit Teamer-Rolle -- keine neuen Konfi-Badges moeglich
- Teamer-Badges kommen als eigenes System in Phase 40

### Tab-Status in Phase 38
- Chat: VOLL -- bestehende Chat-Logik funktioniert sofort
- Profil: VOLL -- zeigt eingefrorene Konfi-Badges, Punkte und Level
- Start/Dashboard: EmptyState (wird in Phase 41 gefuellt)
- Events: EmptyState (wird in Phase 39 gefuellt -- Teamer koennen keine Konfi-Plaetze buchen)
- Material: EmptyState (wird in Phase 42 gefuellt)

### Claude's Discretion
- Genauer Aufbau der Profil-Seite (Layout der eingefrorenen Daten)
- EmptyState-Texte und Icons
- Route-Struktur innerhalb /teamer/
- Wie user.type im Frontend fuer Teamer erweitert wird (aktuell nur 'admin' vs 'konfi')
- Backend-Endpoint fuer die Transition-Operation

</decisions>

<specifics>
## Specific Ideas

- Teamer ist kein Mini-Admin -- eigene UI, kein Zugriff auf Admin-Funktionen
- Rose (#e11d48) als Hauptfarbe fuer Header-Gradienten und UI-Akzente
- Chat-Position 2 in TabBar wie bei Konfis fuer Konsistenz
- Transition-Dialog soll Konfi-Punkte und Badge-Anzahl konkret anzeigen (nicht nur abstrakte Warnung)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `EmptyState` Shared Component: fuer Platzhalter-Tabs
- `ChatOverviewPage` + `ChatRoomView`: direkt wiederverwendbar fuer Teamer-Chat
- `KonfiProfilePage`: als Referenz fuer eingefrorene Daten-Anzeige
- `useIonModal` Hook: fuer Bestaetigungsdialog
- Domain-Farb-CSS-Klassen in variables.css: Pattern fuer neue Teamer-Farbe

### Established Patterns
- MainTabs.tsx: 3-Wege-Routing (SuperAdmin / Admin / Konfi) -- wird um Teamer erweitert
- `user.type`: aktuell 'admin' oder 'konfi' in rbac.js (Zeile 97) -- muss 'teamer' unterstuetzen
- `requireTeamer` Middleware: existiert bereits, erlaubt org_admin + admin + teamer
- `konfi_profiles` + `konfi_badges`: bestehende Tabellen bleiben nach Transition erhalten

### Integration Points
- `rbac.js` verifyTokenRBAC: user.type Erweiterung fuer Teamer
- `MainTabs.tsx`: neuer Teamer-Branch im Routing
- `KonfiDetailView.tsx`: Transition-Button hinzufuegen
- `roleHierarchy.js`: canManageRole erlaubt admin -> teamer bereits
- `App.tsx`: Route-Guards fuer /teamer/ Pfade

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 38-rolle-app-shell*
*Context gathered: 2026-03-10*
