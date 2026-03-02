# Milestones

## v1.2 Polishing + Tech Debt (Shipped: 2026-03-02)

**Phases completed:** 4 Phasen (8-11), 6 Plans
**Timeline:** 2026-03-02 (1 Tag)
**Stats:** 78 files changed, 3210 insertions, 1177 deletions
**Git range:** Phase 08 bis Phase 11 (15 Commits)
**Requirements:** 14/14 (SUI-01/02, DASH-01-07, DEBT-01-04, DOC-01)

**Key accomplishments:**
- Super-Admin TabBar auf 2 Tabs reduziert (Organisationen + Profil), alle anderen Admin-Tabs ausgeblendet
- ActivityRings 3. Runde Strichstaerke von 0.35 auf 0.7 korrigiert, hellere Bright-Farbvarianten, Maximum 300%
- Dashboard Design-Review: tageszeitabhaengige Begruessing, Badge-Stats als Glass-Chips, Tageslosung Zitat-Style
- rateLimitMessage UI-Wiring ueber Custom Event Pattern, generischer 429-Handler via Axios-Interceptor
- console.log Cleanup: 148 Frontend + 177 Backend Statements bereinigt, strukturierter Server-Start
- app-condense-toolbar CSS-Klasse auf alle 20 collapsible Headers, 17 BEM-Klassen fuer EventDetailView
- CLAUDE.md komplett neu geschrieben (202 auf 127 Zeilen), alle 15 Routes als migriert dokumentiert

**v1.1 Tech Debt aufgeloest:**
- EventDetailView Inline-Styles von 20 auf 1 (Admin) bzw. 11 auf 3 (Konfi) reduziert
- app-condense-toolbar von 2/19 auf 20/20 Stellen migriert
- rateLimitMessage Wiring-Gap aus v1.0 behoben

## Geplante Milestones

- **v1.3 Repo Hygiene** -- Git Repo aufraeuemen, Lizenzen, README
- **v1.4 Push-Benachrichtigungen** -- Systematischer Durchgang aller Push-Flows
- **v1.5 Event-Logik Debug** -- Anmeldung, Warteliste, Zeitsteuerung
- **v2.0 Teamer + Neue Features** -- Teamer-Design, Teamer-Badges, Konfi Wrapped

---

## v1.1 Design-Konsistenz (Shipped: 2026-03-02)

**Phases completed:** 5 Phasen (3-7), 17 Plans
**Timeline:** 2026-03-01 bis 2026-03-02 (2 Tage)
**Stats:** 66 files changed, 4426 insertions, 5653 deletions (Netto: -1227 Zeilen)
**Git range:** Phase 03 bis Phase 07 (47 Commits)

**Key accomplishments:**
- Shared Components (SectionHeader, EmptyState, ListSection) mit Preset-Farbsystem in 17 Views eingebaut
- 100+ CSS-Utility-Klassen in variables.css (Header, Stats, Modal, Icon-Farben, Auth-Seiten)
- Admin-TabBar auf 5 Tabs reduziert, Badges unter Settings verschoben
- Alle 28 Modale auf useIonModal migriert, isOpen-Pattern komplett eliminiert
- iOS Card-Modal Backdrop-Effekt und Unsaved-Changes-Schutz implementiert
- QR-Code Onboarding mit Auto-Login, differenzierten Fehlermeldungen und Username-Verfuegbarkeitspruefung

**Tech Debt (akzeptiert):**
- Einige Admin-Views haben mehr Inline-Styles als angepeilt (EventDetailView 63, AdminSettings 26)
- 3 Chat-Modals (GroupChat, DirectMessage, CreateChat) Props-migriert aber ohne aktive Aufrufer
- app-condense-toolbar nur 2/19 Stellen migriert

---

## v1.0 Security + Stabilisierung (Shipped: 2026-03-01)

**Phases completed:** 2 phases, 5 plans
**Timeline:** 2026-02-28 bis 2026-03-01 (2 Tage)
**Stats:** 37 files changed, 2294 insertions, 340 deletions

**Key accomplishments:**
- helmet Security Headers und express-validator Input-Validierung auf allen 15 Backend-Routes
- Multi-Tenant-Isolation lueckenlos: notifications.js und settings.js mit organization_id-Filterung
- SQL-Injection-Fix: getPointField Whitelist ersetzt unsichere Template-Literals in 8 Stellen
- TabBar-Rendering stabilisiert: registerTabBarEffect entfernt, CSS-only fuer 6+ Tabs
- Theme-Isolation: iOS26 und MD3 koexistieren ohne Kollisionen (Platform-scoped Overrides)
- Badge Double-Count-Risiko eliminiert: Fallback-Berechnungspfad entfernt, nur konfi_profiles Werte

**Known Gaps (Phasen 3-7 nicht ausgefuehrt):**
- DES-01 bis DES-04: Design-System Grundlagen (Phase 3)
- ADM-01 bis ADM-12: Admin-Views Design-Konsistenz (Phasen 4+5)
- MOD-01 bis MOD-04: Modal-Konsistenz (Phase 6)
- ONB-01, ONB-02: Onboarding-Validierung (Phase 7)

**Tech Debt:**
- SEC-05 Wiring-Gap: error.rateLimitMessage in api.ts ungenutzt (Login funktioniert ueber alternativen Pfad)
- iOS Glass-Effekt und Android Theme-Isolation visuell ausstehend

---

