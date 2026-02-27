# Project Research Summary

**Project:** Konfi Quest -- Design-Konsistenz und Security Hardening
**Domain:** Ionic 8 Hybrid-App Stabilisierung (Multi-Tenant, RBAC, Kirchengemeinde)
**Researched:** 2026-02-27
**Confidence:** HIGH

## Executive Summary

Konfi Quest ist eine produktive Ionic 8 Hybrid-App mit funktionierendem Backend (Node.js/Express + PostgreSQL) und einem fertig designten Konfi-UI, das als Referenz dient. Der aktuelle Milestone hat zwei klare Ziele: (1) alle Admin- und Teamer-Views an das bestehende Konfi-Design-Pattern angleichen und (2) kritische Sicherheitsluecken im Multi-Tenant-Backend schliessen. Der Tech-Stack bleibt unveraendert -- es geht ausschliesslich um Haertung und Konsistenz, nicht um neue Features.

Der empfohlene Ansatz basiert auf einer klaren Trennung von Security-Arbeit und Design-Arbeit, wobei Security Prioritaet hat. Die Forschung zeigt, dass `notifications.js` keine organization_id-Filterung hat, JWT-Tokens 24 Stunden ohne Refresh laufen, und `helmet` zwar installiert aber nicht aktiviert ist. Diese drei Punkte sind die groessten Risiken. Auf der Design-Seite existiert bereits ein umfangreiches CSS-Klassensystem (`app-list-item`, `app-card`, etc.), das nur konsequent auf alle Admin-Views angewendet werden muss. Drei kleine Shared Components (SectionHeader, EmptyState, ListSection) eliminieren ~50 Zeilen duplizierte Inline-Styles pro View.

Die Hauptrisiken sind: (a) Cross-Tenant Data Leakage durch fehlende organization_id-Filterung in einzelnen Routes, (b) globale CSS-Aenderungen die das fertige Konfi-UI brechen, und (c) Theme-Konflikte zwischen iOS 26 und MD3 CSS-Imports. Mitigation: Security-Audit aller Routes als erstes, CSS-Regel "nur hinzufuegen, nie aendern", und plattformabhaengige Theme-Imports.

## Key Findings

### Recommended Stack

Der bestehende Stack (React 19 + Ionic 8 + Capacitor 7 + Express + PostgreSQL) bleibt unveraendert. Empfohlen werden Minor-Updates und zwei neue Backend-Dependencies.

**Core-Aenderungen:**
- **@ionic/react 8.5.0 -> ^8.7.18**: Bugfixes fuer datetime, safe-area-inset und Navigation. Kein Breaking Change.
- **@capacitor/core 7.4.2 -> 7.5.0**: Bugfixes fuer Cookies und CLI. NICHT auf Capacitor 8.x upgraden (zu frisch).
- **helmet ^8.1.0** (NEU aktivieren): 13 Security-Headers automatisch. Ist in package.json vorhanden aber nicht in server.js aktiviert.
- **express-validator ^7.2.0** (NEU): Input-Validierung direkt auf Express-Routes. Leichtgewichtiger als Zod/Joi fuer bestehendes JS-Backend.
- **@rdlabo/ionic-theme-ios26 ^2.2.1**: Minor-Update, fixt action-sheet cancel margin.

**Explizit NICHT hinzufuegen:** Tailwind CSS (kollidiert mit Ionic Shadow DOM), Passport.js (Overkill), Redis (nicht noetig bei <500 Usern), Styled Components, React Router v6.

### Expected Features

**Must have (Table Stakes -- vor Go-Live):**
- Einheitliches Header-Pattern (kompaktes Banner) in allen Views
- Konsistente Listen-Items (`app-list-item`) in allen Admin-Views
- useIonModal-Pattern in verbleibenden 4-5 Modals durchsetzen (aktuell noch `isOpen`)
- Helmet Security Headers aktivieren (eine Zeile Code)
- organization_id-Filterung vollstaendig in allen 15 Route-Dateien
- Input-Validierung in activities.js (Template-Literal SQL-Injection-Risiko)
- Passwort-Reset Validierung angleichen (nutzt nur `length < 6` statt `validatePassword()`)
- Rate-Limiter UX im Login (Countdown-Anzeige statt stille Blockade)
- Badge Double-Count Risiko absichern

**Should have (v1.x nach Go-Live):**
- JWT Refresh-Token-Mechanismus (Access: 2h, Refresh: 7d mit Rotation)
- Sichere Token-Speicherung auf Mobilgeraeten (Keychain/Keystore)
- Audit-Logging fuer Admin-Aktionen (neue DB-Tabelle)
- DSGVO-Datenexport (rechtlich relevant fuer Minderjahrige)
- Push-Token Lifecycle (90-Tage Expiry, Logout-Invalidierung)

**Defer (v2+):**
- Dark Mode (erfordert umfangreiches CSS-Refactoring aller hardcodierten Farben)
- Biometrische Authentifizierung
- Row-Level Security in PostgreSQL
- Certificate Pinning
- Animierte View-Uebergaenge

### Architecture Approach

Die App folgt einem etablierten Page-View-Modal Pattern: Pages laden Daten und verwalten State, Views sind reine Darstellungskomponenten, Modals uebernehmen CRUD-Formulare via useIonModal-Hook. Das Design-System basiert auf CSS-Klassen in `variables.css` (nicht React-Komponenten). Das Backend ist ein Express-Monolith mit RBAC-Middleware (`verifyTokenRBAC`) und organization_id-basierter Tenant-Isolation.

**Refactoring-Architektur (drei Ebenen):**
1. **Shared UI Components (NEU):** `SectionHeader`, `EmptyState`, `ListSection` -- eliminieren 50+ Zeilen Inline-Style-Duplizierung pro View
2. **CSS-Klassen (ERWEITERN):** `app-header-banner`, `app-stats-row`, `app-stats-item` zu bestehendem System hinzufuegen
3. **Custom Hooks (NEU):** `useDataLoader`, `useRefresher` -- eliminieren duplizierten useEffect/try-catch Code

**Strukturbereinigung:** 7 Admin-Views liegen direkt in `admin/` statt in `admin/views/`. Verschieben fuer konsistente Dateistruktur.

### Critical Pitfalls

1. **organization_id fehlt in notifications.js (0 Vorkommen)** -- Systematischer Audit aller Routes mit <20 org_id-Vorkommen. Push-Tokens-Tabelle braucht organization_id-Spalte. Middleware `requireOrganizationScope()` als Sicherheitsnetz.

2. **CSS-Refactoring bricht Konfi-UI** -- Bestehende CSS-Klassen in variables.css NIEMALS aendern, nur neue hinzufuegen. Admin-spezifische Abweichungen als `.admin-*` Klassen. Screenshots der Konfi-Views vor und nach jeder Design-Aenderung.

3. **iOS Card-Modal-State haengt** -- Alle Modals muessen konsistent `useModalPage()` aus ModalContext nutzen, nicht eigenen `useState<HTMLElement>`. KonfiDetailView (Zeile 91) und EventDetailView (Zeile 133) muessen migriert werden.

4. **iOS 26 und MD3 Theme kollidieren** -- Beide Themes werden bedingungslos geladen. `md-remove-ios-class-effect.css` laeuft auch auf iOS. Loesung: Plattformabhaengige CSS-Imports oder Import-Reihenfolge korrigieren.

5. **registerTabBarEffect bricht bei 6 Tabs** -- Bekanntes Problem in `@rdlabo/ionic-theme-ios26`. Entweder Tabs auf 5 reduzieren, Effect nur einmal mounten, oder eigenen Tab-Effect implementieren.

## Implications for Roadmap

### Phase 1: Security Hardening (Backend)
**Rationale:** Cross-Tenant Data Leakage ist das groesste Risiko einer Multi-Tenant-App. Muss vor jeder anderen Arbeit geloest werden, da ein Datenleck alle Design-Arbeit irrelevant macht.
**Delivers:** Abgesichertes Backend mit vollstaendiger Tenant-Isolation und Security-Headers.
**Addresses:** Helmet aktivieren, organization_id-Audit aller 15 Routes, Input-Validierung (activities.js Template-Literals), Passwort-Reset Fix, JWT Token-Laufzeit auf 2-4h reduzieren, Invite-Code `used_at` Fix.
**Avoids:** Pitfall 2 (org_id-Filterung fehlt), Pitfall 3 (JWT ohne Rotation), SQL-Injection-Risiko.

### Phase 2: Known Bugs und Theme-Konfiguration
**Rationale:** Bevor Design-Arbeit beginnt, muessen die Grundlagen stimmen: TabBar muss funktionieren, Themes muessen plattformkorrekt laden, bekannte Bugs muessen weg. Sonst baut Design-Arbeit auf fehlerhafter Basis auf.
**Delivers:** Stabile Grundlage fuer Design-Refactoring: funktionierende TabBar, korrekte Theme-Imports, behobene bekannte Bugs.
**Addresses:** registerTabBarEffect 6-Tabs Fix, iOS26/MD3 Theme-Separation, Rate-Limiter UX, Badge Double-Count, deprecated Date Utils.
**Avoids:** Pitfall 5 (Theme-Konflikt), Pitfall 6 (TabBar-Crash).

### Phase 3: Design-System Grundlagen
**Rationale:** Bevor einzelne Views angefasst werden, muessen die wiederverwendbaren Bausteine existieren. Sonst wird Design-Konsistenz durch Copy-Paste statt durch Wiederverwendung erreicht.
**Delivers:** Shared Components (SectionHeader, EmptyState, ListSection), neue CSS-Klassen (app-header-banner), Custom Hooks (useDataLoader).
**Addresses:** Header-Banner-Duplizierung, Leerzustands-Pattern, Listen-Sektions-Pattern.
**Avoids:** Pitfall 4 (CSS bricht Konfi-UI) -- neue Klassen statt Aenderungen an bestehenden.

### Phase 4: Admin-Views Design-Konsistenz
**Rationale:** Die Admin-Views sind der groesste visuelle Inkonsistenz-Bereich. Mit den Shared Components aus Phase 3 kann jede View systematisch angeglichen werden.
**Delivers:** Alle Admin-Views (Konfis, Events, Badges, Aktivitaeten, Jahrgaenge, Users, Settings) nutzen einheitliches Header-Banner, Listen-Items, Sektions-Header und Farb-Schema.
**Addresses:** Admin-Views auf Design-Referenz umbauen, Dateistruktur bereinigen (Views nach admin/views/ verschieben), Swipe-Delete konsistent.
**Avoids:** Pitfall 4 (CSS bricht Konfi-UI) -- immer Screenshot-Vergleich vor/nach Aenderungen.

### Phase 5: Modal-Konsistenz und Konfi-Views Feinschliff
**Rationale:** Modals sind der letzte grosse Inkonsistenz-Bereich. Danach Konfi-Views auf neue Shared Components umstellen (leichtere Wartung, kein visueller Unterschied fuer User).
**Delivers:** Alle 20+ Modals auf useIonModal-Pattern, konsistentes Formular-Design, presentingElement ueber ModalContext, Konfi-Views nutzen SectionHeader-Komponente.
**Addresses:** useIonModal in 4-5 verbleibenden Modals, Modal-Formular-Konsistenz, presentingElement-Migration in KonfiDetailView und EventDetailView.
**Avoids:** Pitfall 1 (Card-Modal-State haengt) -- einheitliche presentingElement-Quelle.

### Phase 6: Post-Go-Live Security (v1.x)
**Rationale:** JWT Refresh-Token und sichere Token-Speicherung sind wichtig, aber die 2-4h Token-Laufzeit aus Phase 1 reicht fuer den Go-Live. Diese Phase kann nach der Stabilisierung kommen.
**Delivers:** Vollstaendiger JWT Refresh-Token-Flow mit HttpOnly Cookies, Capacitor Secure Storage, Audit-Logging, DSGVO-Export.
**Addresses:** Refresh-Token-Rotation, Sichere Token-Speicherung, Audit-Log-Tabelle, DSGVO Art. 15/20 Export.
**Avoids:** Pitfall 3 (JWT ohne Rotation) -- vollstaendige Loesung.

### Phase Ordering Rationale

- **Security vor Design:** Ein Cross-Tenant-Datenleck macht jede UI-Arbeit wertlos. organization_id-Audit und Helmet-Aktivierung sind die dringendsten Massnahmen.
- **Bugs vor Design:** registerTabBarEffect und Theme-Konflikte beeinflussen die Tab-Struktur und das Rendering. Design-Entscheidungen die auf fehlerhaftem Rendering basieren muessen spaeter revidiert werden.
- **Design-Grundlagen vor Views:** SectionHeader, EmptyState und CSS-Klassen einmal erstellen statt in jeder View duplizieren. Spart Zeit und verhindert Inkonsistenz.
- **Admin vor Konfi:** Konfi-UI ist die Referenz und funktioniert bereits. Admin-Views haben den groessten Design-Rueckstand. Konfi-Views bekommen in Phase 5 nur den Upgrade auf Shared Components.
- **Modals zuletzt (vor Go-Live):** Modal-Migration ist technisch riskant (iOS Card-Modal-State). Mit stabilem Fundament und klarem Pattern (ModalContext) sinkt das Risiko.

### Research Flags

Phasen die tieferes Research waehrend der Planung brauchen:
- **Phase 2 (Theme-Konfiguration):** Plattformabhaengige CSS-Imports sind nicht dokumentiert -- muss experimentell getestet werden. registerTabBarEffect-Alternativen muessen evaluiert werden.
- **Phase 6 (JWT Refresh-Token):** Refresh-Token-Rotation mit Capacitor Secure Storage ist nicht trivial. HttpOnly Cookies funktionieren anders in nativen WebViews als im Browser.

Phasen mit Standard-Patterns (kein zusaetzliches Research noetig):
- **Phase 1 (Security Hardening):** Helmet-Aktivierung, organization_id-Audit und Input-Validierung sind gut dokumentierte Express-Best-Practices.
- **Phase 3 (Design-System):** React Shared Components und CSS-Klassen sind Standard-Patterns.
- **Phase 4 (Admin-Views):** Anwendung bestehender Patterns auf existierende Views -- kein neues Wissen noetig.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Alle Versionen gegen GitHub Releases verifiziert. Bestehender Stack bleibt, nur Minor-Updates und zwei neue Dependencies. |
| Features | HIGH | Basiert auf direkter Codebase-Analyse und Ist-Zustand-Audit. Feature-Prioritaeten klar durch Security- und UX-Kriterien. |
| Architecture | HIGH | Direkte Codebase-Analyse aller relevanten Dateien. Page-View-Modal Pattern und CSS-Klassen-System sind bereits etabliert. |
| Pitfalls | HIGH | Kombination aus Codebase-Analyse und verifizierten Ionic/React Community-Issues. Alle Pitfalls sind im Code nachweisbar. |

**Overall confidence:** HIGH

### Gaps to Address

- **Theme-Kollision im Detail:** Die genaue Auswirkung der parallelen iOS26/MD3 Imports wurde nicht auf echten Geraeten getestet. Muss in Phase 2 experimentell validiert werden.
- **registerTabBarEffect Alternative:** Ob v2.2.1 das 6-Tabs-Problem fixt, ist unbekannt. Muss beim Update getestet werden. Fallback-Plan (Tabs reduzieren) sollte bereitstehen.
- **Capacitor Secure Storage Kompatibilitaet:** `@capacitor-community/secure-storage` wurde nicht auf Kompatibilitaet mit Capacitor 7.5 geprueft. Relevant fuer Phase 6.
- **notifications.js Vollstaendigkeit:** Die Route wurde als "0 organization_id Vorkommen" identifiziert, aber der genaue Scope der noetigten Aenderungen (Schema + Code) muss in Phase 1 detailliert werden.
- **Badge-System Migration:** badges.js ist noch nicht auf PostgreSQL migriert. Muss waehrend Phase 1 (Security) oder Phase 4 (Design) abgeschlossen werden, je nachdem was zuerst relevant wird.

## Sources

### Primary (HIGH confidence)
- [Ionic Framework GitHub Releases](https://github.com/ionic-team/ionic-framework/releases) -- v8.7.18 verifiziert
- [Capacitor GitHub Releases](https://github.com/ionic-team/capacitor/releases) -- v7.5.0 + v8.1.0 verifiziert
- [rdlabo/ionic-theme-ios26 GitHub](https://github.com/rdlabo-team/ionic-theme-ios26/releases) -- v2.2.1 verifiziert
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) -- Helmet, CORS
- [Helmet.js](https://helmetjs.github.io/) -- v8.1.0
- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [Ionic Modal API Dokumentation](https://ionicframework.com/docs/api/modal) -- useIonModal, presentingElement
- Direkte Codebase-Analyse aller relevanten Frontend- und Backend-Dateien

### Secondary (MEDIUM confidence)
- [JWT Refresh Token Rotation Best Practices](https://www.freecodecamp.org/news/how-to-build-a-secure-authentication-system-with-jwt-and-refresh-tokens/) -- Token Rotation Pattern
- [Auth0 Refresh Token Guide](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/) -- HttpOnly Cookie Storage
- [Capacitor Security Documentation](https://capacitorjs.com/docs/guides/security) -- Secure Storage
- [Multi-Tenant Leakage: When RLS Fails](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)

### Tertiary (LOW confidence)
- [registerTabBarEffect 6-Tabs-Problem](https://github.com/rdlabo-team/ionic-theme-ios26) -- Community-berichtet, nicht offiziell dokumentiert
- [@capacitor-community/secure-storage](https://github.com/nicekiwi/capacitor-secure-storage) -- Capacitor 7.5 Kompatibilitaet nicht verifiziert

---
*Research completed: 2026-02-27*
*Ready for roadmap: yes*
