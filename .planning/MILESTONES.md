# Milestones

## v1.7 Unterricht + Pflicht-Events (Shipped: 2026-03-09)

**Phases completed:** 4 Phasen (34-37), 8 Plans
**Timeline:** 2026-03-09 (1 Tag)
**Stats:** 23 files changed, 2312 insertions, 523 deletions
**Requirements:** 17/17 (PFL: 4, OPT: 3, QRC: 5, EUI: 3, ANW: 2)

**Key accomplishments:**
- Pflicht-Events mit Auto-Enrollment aller Jahrgangs-Konfis, Punkte-Guard und Nachtrags-Hooks bei Jahrgang-Wechsel
- Opt-out-Flow mit Freitext-Begruendung (min. 5 Zeichen), Admin-Uebersicht und Push-Benachrichtigung bei Abmeldung
- QR-Code Check-in mit signiertem JWT-Token, konfigurierbarem Zeitfenster (5-120 Min) und Live-Zaehler im Admin-Modal
- Manuelle Anwesenheitskorrektur und druckfreundlicher QR-Code mit Print-CSS
- Pro-Konfi Anwesenheitsstatistik mit farbiger IonProgressBar (gruen/gelb/rot) und verpasste-Events-Liste
- Dashboard Events-Widget mit Was-mitbringen-Info (bagHandle-Icon) und Admin-Toggle (show_events)

---

## v1.6 Dashboard-Konfig + Punkte-Logik (Shipped: 2026-03-09)

**Phases completed:** 4 Phasen (30-33), 7 Plans, 14 Tasks
**Timeline:** 2026-03-07 bis 2026-03-09 (3 Tage)
**Stats:** 18 files changed, 866 insertions, 524 deletions
**Requirements:** 13/13 (PKT: 5, PUI: 5, DSH: 3)

**Key accomplishments:**
- Punkte-Typ-Konfiguration pro Jahrgang: Gottesdienst und Gemeinde einzeln aktivierbar/deaktivierbar mit individuellen Zielwerten
- Backend-Guard verhindert Punktevergabe fuer deaktivierte Typen mit 400er-Fehler und Warnung bei Deaktivierung
- ActivityRings dynamisch: 1 oder 3 Ringe basierend auf aktiven Punkte-Typen, Ranking/Badges/Historie angepasst
- Admin-Views mit ausgegraut-Pattern: deaktivierte Typen sichtbar bei 40% Opacity mit "(deaktiviert)" Label
- Dashboard-Widget-Steuerung: 5 Sektionen (Konfirmation, Events, Losung, Badges, Ranking) vom Org-Admin ein/ausblendbar
- Tageslosung-API-Call-Optimierung: bei deaktivierter Losung wird kein Netzwerk-Request gemacht

---

## v1.5 Push-Notifications (Shipped: 2026-03-07)

**Phases completed:** 5 phases (25-29), 8 plans, 16 tasks
**Timeline:** 2026-03-05 bis 2026-03-07 (3 Tage)
**Stats:** 16 files changed, 647 insertions, 406 deletions
**Requirements:** 17/17 (TKN: 4, CLN: 2, FLW: 4, CFG: 2, BDG: 4, CMP: 1)

**Key accomplishments:**
- Push-Type Registry mit 18 dokumentierten Notification-Types und Firebase Error-Code Forwarding als Grundlage
- Vollstaendiger Token-Lifecycle: Logout-Cleanup, 12h-Refresh, User-Wechsel-Handling, Fallback-Device-ID Fix
- BadgeContext als Single Source of Truth fuer alle Unread-Counts (App-Icon, TabBar, Chat-Liste)
- Neue Push-Flows: Event-Erinnerungen (15min-Intervall), Admin-Alert bei Registrierung, Level-Up-Notifications
- Selbstreinigendes Token-System mit 6h-Cleanup-Intervall fuer verwaiste/fehlerhafte Tokens
- Konsistentes Result-Pattern in allen Push-Send-Methoden mit error_count Tracking

---

## v1.4 Logik-Debug (Shipped: 2026-03-05)

**Phases completed:** 5 phases, 9 plans, 0 tasks

**Key accomplishments:**
- (none recorded)

---

## v1.3 Layout-Polishing (Shipped: 2026-03-04)

**Phases completed:** 9 Phasen (12-19 + 17.1), 18 Plans
**Timeline:** 2026-03-03 bis 2026-03-04 (2 Tage)
**Stats:** 65 files changed, 4654 insertions, 637 deletions
**Git range:** Phase 12 bis Phase 19 (59 Commits)
**Requirements:** 48/48 (GUI: 5, KUI: 11, AUI: 7, SET: 9, SUA: 7, BUG: 6, FIX: 2, SEC: 1)

**Key accomplishments:**
- Admin-Modal-Bugs behoben (Participant, Badges, QR-Code) + sicheres Einmalpasswort-System mit Kopier-Button
- Globale UI-Konsistenz: Listen-Icons 32px/Top-Aligned, Fokus-Rahmen entfernt, Checkbox-Farben vereinheitlicht
- Konfi-Views poliert: Tab "Start", EmptyStates, PointsHistory 3+2 Layout, Profil Lila, Antrags-Icons Gruen
- Admin-Views vereinheitlicht: Corner-Badges, Solid-Icons, Standard-Stepper, Beschreibungs-Cards, Checkbox links
- Settings-Bereich ueberarbeitet: Struktur (Konto/Verwaltung/Inhalt), Kategorien Sky-Blue, Gottesdienst Blau, Badges mit Oberkategorie-Icons
- Super-Admin komplett neu: TabBar entfernt, Vollbild-Layout, mattes Blau (#667eea), Logout-Button, OrganizationManagementModal

**v1.2 Tech Debt aufgeloest:**
- Checkbox-Farben von hardcoded Tuerkis auf dynamische Kontext-Farben
- Einmalpasswort-Alert ohne HTML-Tags (subHeader statt HTML in message)

---

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

- **v1.8 Teamer** -- Neue Rolle, professionelleres Dashboard, Konfi-zu-Teamer Transition, Teamer-Badges/Events/Chat
- **v1.9 Datenschutz + Archivierung** -- Jahrgaenge archivieren, Loeschfristen, DSGVO
- **Konfi Wrapped** -- Spotify-Wrapped-Style Rueckblick vor Konfirmation

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
