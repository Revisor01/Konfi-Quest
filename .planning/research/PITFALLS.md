# Pitfalls Research

**Domain:** Ionic 8 Hybrid-App Design-Konsistenz-Refactoring und Security Hardening (Multi-Tenant Kirchengemeinde-App)
**Researched:** 2026-02-27
**Confidence:** HIGH (basierend auf Codebase-Analyse, Ionic-Dokumentation und Community-Issues)

## Critical Pitfalls

### Pitfall 1: iOS Card-Modal-Animation bleibt nach Modal-Wechsel haengen

**What goes wrong:**
Wenn ein Modal mit `presentingElement` (Card-Style) geoeffnet wird und waehrend der Anzeige ein zweites Modal ohne `presentingElement` (Fullscreen-Style) geoeffnet wird, bleibt die dahinterliegende Seite im "boxed" Card-Modal-State stecken. Die Seite schrumpft und kehrt nicht in ihren normalen Zustand zurueck.

**Why it happens:**
Ionic React verwaltet den Card-Modal-State ueber CSS-Transformationen auf dem `presentingElement`. Wenn Modals mit unterschiedlichen Styles (Card vs. Fullscreen) gemischt werden, wird der CSS-State des presenting elements nicht korrekt zurueckgesetzt. Im Konfi Quest Code gibt es zwei verschiedene Patterns: `KonfiDetailView` und `EventDetailView` verwenden eigenen `useState<HTMLElement>` fuer das `presentingElement`, waehrend Page-Komponenten `useModalPage()` aus dem `ModalContext` nutzen. Diese Inkonsistenz erhoeht das Risiko fuer State-Mismatch.

**How to avoid:**
- Alle Modals innerhalb einer Seite muessen konsistent entweder Card-Style (mit `presentingElement`) oder Fullscreen verwenden
- Den `ModalContext` mit `useModalPage()` als einzige Quelle fuer `presentingElement` verwenden, nie eigenen State
- Die `cleanupModals()` Funktion im ModalContext bei Route-Wechseln aufrufen (bereits implementiert, aber verifizieren)
- Beim Refactoring `KonfiDetailView` (Zeile 91) und `EventDetailView` (Zeile 133) von eigenem `useState` auf `useModalPage()` migrieren

**Warning signs:**
- Seite erscheint "eingerueckt" oder verkleinert nach Schliessen eines Modals
- Backdrop bleibt sichtbar nach Modal-Dismiss
- Unterschiedliche `presentingElement`-Quellen in derselben View (eigener State vs. ModalContext)

**Phase to address:**
Phase: Design-Konsistenz (Modal-Refactoring). Muss VOR dem Refactoring der Admin-Seiten abgeschlossen sein, da sonst neue Modals auf fehlerhafter Basis aufbauen.

---

### Pitfall 2: Organization-ID-Filterung fehlt in Security-kritischen Routes

**What goes wrong:**
Benutzer aus Organisation A koennen Daten aus Organisation B lesen oder manipulieren. Konkret: `notifications.js` hat KEINE `organization_id`-Filterung. Die `push_tokens`-Tabelle hat kein `organization_id`-Feld. Ein Admin koennte theoretisch Push-Tokens anderer Organisationen sehen oder manipulieren, wenn IDs erraten werden.

**Why it happens:**
Schrittweise Migration von SQLite zu PostgreSQL. Aeltere Routes wurden vor dem RBAC-System geschrieben. Neue Organisation-Isolation wurde fuer Chat (Juli 2025) nachgeruestet, aber nicht systematisch ueber alle Routes hinweg. Die `verifyTokenRBAC` Middleware laedt zwar `organization_id`, aber erzwingt sie nicht automatisch in Queries -- das muss jede Route selbst tun.

**How to avoid:**
- Systematischer Audit ALLER Routes mit Checkliste: "Enthaelt jeder SELECT/UPDATE/DELETE ein `WHERE organization_id = $X`?"
- Routes-Prioritaetsliste: `notifications.js` (0 org-Filter), `badges.js` (teilweise), `levels.js` (pruefen)
- Middleware-Layer erweitern: `requireOrganizationScope()` der automatisch `req.user.organization_id` als Pflichtparameter injiziert
- Fuer `push_tokens`: `organization_id` Spalte hinzufuegen und bei Token-Registrierung setzen

**Warning signs:**
- Route-Datei hat keinen Import/Verwendung von `organization_id` oder `req.user.organization_id`
- SQL-Queries ohne WHERE-Clause auf `organization_id`
- Tests, die Cross-Organisation-Zugriff nicht abdecken

**Phase to address:**
Phase: Security Hardening (erste Phase, vor Design-Arbeit). Cross-Tenant Data Leakage ist der schwerwiegendste Fehler in Multi-Tenant-Systemen.

---

### Pitfall 3: JWT Token ohne Rotation und Blacklisting bei 24h Laufzeit

**What goes wrong:**
Ein kompromittierter JWT Token ist 24 Stunden gueltig. Es gibt keinen Mechanismus, um einen Token vorzeitig zu invalidieren (kein Logout-Blacklist, kein Refresh-Token-Rotation). Wenn ein Konfi sein Passwort aendert, bleiben alte Tokens gueltig. Wenn ein Admin einen User deaktiviert, bleibt dessen Token bis zum Ablauf aktiv.

**Why it happens:**
Einfache JWT-Implementierung ohne Refresh-Token-Mechanismus. Die `verifyTokenRBAC`-Middleware prueft zwar `is_active` in der Datenbank (Zeile 62), was eine partielle Mitigation darstellt. Allerdings gibt es fuer Passwort-Aenderungen, Rollen-Aenderungen oder manuelle Sperren keine sofortige Token-Invalidierung.

**How to avoid:**
- Phase 1 (Sofort): Access Token Laufzeit auf 1-2 Stunden reduzieren
- Phase 2: Refresh Token Mechanismus mit `httpOnly` Cookie und Rotation bei jedem Refresh
- Phase 3: Token-Version in `users` Tabelle (`token_version INT`). Bei Passwort-Aenderung, Rollen-Aenderung oder Admin-Sperrung wird `token_version` inkrementiert. JWT enthaelt `token_version`, Middleware vergleicht.
- WICHTIG: Die bestehende DB-Pruefung in `verifyTokenRBAC` (is_active Check) beibehalten -- sie ist aktuell die einzige Schutzschicht

**Warning signs:**
- User meldet sich ab, kann aber mit altem Token weiter zugreifen
- Passwort-Aenderung invalidiert laufende Sessions nicht
- Admin deaktiviert User, der sofort weiter navigieren kann (bis Token expired)

**Phase to address:**
Phase: Security Hardening. Token-Laufzeit-Reduktion in Phase 1, Refresh-Token in Phase 2 (wenn vor Go-Live genug Zeit).

---

### Pitfall 4: Design-Refactoring bricht funktionierendes Konfi-UI

**What goes wrong:**
Beim Anpassen der Admin-Seiten an das Konfi-Design-Pattern werden versehentlich globale CSS-Klassen geaendert, die auch das bereits fertige Konfi-UI betreffen. Die `variables.css` enthaelt globale Styles wie `ion-card.app-card`, `ion-popover`, und `.app-list-item`, die von ALLEN Views (Konfi + Admin) verwendet werden. Eine Aenderung an z.B. `.app-list-item` Padding bricht die Konfi-EventsView.

**Why it happens:**
Das Design System in `variables.css` (529 Zeilen) definiert wiederverwendbare Komponenten-Klassen, die absichtlich global sind. Es gibt keine Scoping-Mechanik (kein CSS Modules, kein Styled Components). Wenn ein Entwickler eine `.app-card` Eigenschaft aendert, weil sie im Admin-Bereich anders aussehen soll, wirkt sich das global aus.

**How to avoid:**
- REGEL: Bestehende CSS-Klassen in `variables.css` NIEMALS aendern, nur neue hinzufuegen
- Admin-spezifische Abweichungen als eigene Klassen: `.admin-card` statt Modifikation von `.app-card`
- Vor jedem CSS-Edit: In den Devtools pruefen, welche Komponenten die betroffene Klasse verwenden
- Konfi-EventsView als "Goldene Referenz" festlegen: Screenshots vor Refactoring machen, nach jedem Schritt vergleichen
- Optional: CSS Scope mit Klassen-Prefix `.admin-` und `.konfi-` fuer bereichsspezifische Styles

**Warning signs:**
- Admin-CSS-Aenderung sichtbar auf Konfi-Seiten
- Konfi-EventsView sieht nach Admin-Refactoring anders aus
- Globale Ionic-Selektoren (z.B. `ion-card`, `ion-popover`) in variables.css werden geaendert

**Phase to address:**
Phase: Design-Konsistenz. Muss als explizite Regel VOR dem Refactoring etabliert werden. Jede Design-Phase sollte mit einem Screenshot-Vergleich der Konfi-Views beginnen und enden.

---

### Pitfall 5: iOS 26 Theme und MD3 Theme kollidieren auf CSS-Ebene

**What goes wrong:**
In `variables.css` werden BEIDE Theme-Bibliotheken importiert: `@rdlabo/ionic-theme-ios26` (3 CSS-Dateien) UND `@rdlabo/ionic-theme-md3` (2 CSS-Dateien). Diese Themes definieren ueberlappende CSS Custom Properties und Styles. Auf Android zeigt sich iOS-spezifisches Styling (z.B. durch `md-remove-ios-class-effect.css`, das iOS-Klassen auf MD-Plattform entfernt). Auf iOS koennen MD3-Styles die iOS26-Styles ueberschreiben, je nach Import-Reihenfolge.

**Why it happens:**
Beide Theme-Pakete werden bedingungslos geladen. In `App.tsx` wird die Animation plattformabhaengig gesetzt (`isPlatform('ios')`), aber die CSS-Dateien werden IMMER geladen -- unabhaengig von der Plattform. Das CSS-Cascading fuehrt dazu, dass spaeter importierte Regeln fruehere ueberschreiben.

**How to avoid:**
- CSS-Imports plattformabhaengig machen: Separate CSS-Dateien fuer iOS und Android, die jeweils nur ein Theme laden
- Alternative: Dynamischer CSS-Import via JavaScript beim App-Start basierend auf `isPlatform()`
- Einfachste Loesung: `@import` Reihenfolge in `variables.css` pruefen und sicherstellen, dass iOS26-Imports VOR MD3-Imports stehen (aktuell: iOS26 zuerst, MD3 danach -- MD3 koennte iOS26 ueberschreiben auf iOS)
- `md-remove-ios-class-effect.css` sollte NUR auf Android geladen werden -- aktuell wird sie immer geladen

**Warning signs:**
- Android-Geraete zeigen iOS-typische Animationen oder Styling
- iOS-Geraete zeigen Material-Design-Elemente (flache Buttons, ripple effects)
- Inkonsistente Darstellung zwischen iOS-Simulator und Android-Emulator
- `registerTabBarEffect` funktioniert nicht korrekt auf Android

**Phase to address:**
Phase: Design-Konsistenz (Theme-Konfiguration). Sollte als erstes in der Design-Phase adressiert werden, da alle weiteren Design-Entscheidungen auf dem korrekten Theme aufbauen.

---

### Pitfall 6: registerTabBarEffect bricht bei 6 Tabs (bekanntes Problem)

**What goes wrong:**
Die `registerTabBarEffect` Funktion aus `@rdlabo/ionic-theme-ios26` versagt auf iOS, wenn die TabBar 6 oder mehr Tabs hat. Das Admin-Layout hat aktuell exakt 6 Tabs (Konfis, Chat, Events, Badges, Antraege, Mehr). Das Konfi-Layout hat ebenfalls 6 Tabs (Dashboard, Chat, Events, Badges, Aktivitaeten, Profil). Der Effect wird bei jedem Route-Wechsel zerstoert und neu erstellt (`useEffect` in MainTabs.tsx Zeile 157-169), was zu Flackern fuehrt.

**Why it happens:**
Die Bibliothek `@rdlabo/ionic-theme-ios26` ist ein Community-Paket (nicht offiziell von Ionic). Die `registerTabBarEffect` nutzt Ionic Gesture und Animation APIs, die bei mehr als 5 Tabs Performance-Probleme haben. Das Re-Registering bei jedem Route-Wechsel (`location.pathname` Dependency) verschaerft das Problem.

**How to avoid:**
- Tab-Anzahl auf 5 reduzieren (z.B. "Badges" in "Mehr"-Menu integrieren)
- Alternative: `registerTabBarEffect` nur einmal beim Mount registrieren, nicht bei jedem Route-Wechsel
- Konditionalen Aufruf: Nur auf iOS ausfuehren (auf Android wird es nicht benoetigt)
- Oder: Eigenen Tab-Bar-Effect implementieren, der die Bibliothek ersetzt
- Langfristig: Warten auf offizielle Ionic iOS 26 Theme-Unterstuetzung (Issue #30466 ist offen)

**Warning signs:**
- TabBar-Animation ruckelt oder springt bei Wechsel zwischen Tabs
- `console.error` oder Warnungen von `registerTabBarEffect`
- Leere/weisse TabBar kurz sichtbar beim Route-Wechsel

**Phase to address:**
Phase: Known Bugs (fruehe Phase). Sollte vor dem Design-Refactoring geloest werden, da die Tab-Struktur alle weiteren Layout-Entscheidungen beeinflusst.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| `console.log` statt strukturiertem Logging | Schnelle Debugging-Ausgabe | Keine Log-Levels, kein JSON-Format, keine Log-Rotation in Produktion | Waehrend Beta-Phase akzeptabel, aber vor Go-Live auf winston/pino umstellen |
| Globale CSS-Klassen ohne Scoping | Schnelle Wiederverwendung | Design-Aenderung an einer Stelle bricht andere Bereiche | Akzeptabel wenn Konvention "nur hinzufuegen, nie aendern" eingehalten wird |
| `CREATE TABLE IF NOT EXISTS` in Route-Handler (notifications.js) | Keine separate Migration noetig | Schema-Aenderungen schwer nachvollziehbar, Race-Conditions beim Parallel-Start | Nie -- Schema sollte ueber Migrations-Skript verwaltet werden |
| Polling statt WebSocket fuer Pending-Counts (MainTabs.tsx, 30s/60s Intervals) | Einfache Implementierung | Unnoetige API-Last, verzoegerte Updates | Akzeptabel bei geringer Nutzerzahl (<100), dann auf WebSocket-Events umstellen |
| `verifyTokenRBAC` macht DB-Query bei JEDEM Request | Aktuelle Daten (is_active, Rollen) | Latenz auf jeder Route, Datenbank-Last | Akzeptabel wenn Caching hinzugefuegt wird (Redis, 30s TTL) |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Firebase Push (backend) | Token-Registrierung ohne `organization_id` in `push_tokens` | `organization_id` Spalte hinzufuegen, beim Registrieren mitgeben |
| Socket.io Chat | Room-Join ohne Organisation-Validierung | `io.use()` Middleware die `organization_id` aus JWT verifiziert und nur Rooms der eigenen Org erlaubt |
| @rdlabo/ionic-theme-ios26 | CSS global laden fuer beide Plattformen | Plattform-abhaengige CSS-Imports oder Feature-Detection |
| Capacitor Push Notifications | `PushNotifications.removeAllListeners()` vor `addListener` (App.tsx Zeile 103) | Listener-Cleanup ueber `useEffect` Return-Funktion, nicht manuelles `removeAll` das andere Listener zerstoert |
| Ionic Router + IonTabs | Route-Wechsel innerhalb Tabs fuehrt zu Modal-State-Leaks | `cleanupModals()` bei Route-Wechsel ausfuehren (bereits implementiert in ModalContext, verifizieren) |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| `verifyTokenRBAC` laedt `user_jahrgang_assignments` bei JEDEM Request | Langsamere API-Responses, hoehere DB-Last | Jahrgang-Assignments in JWT-Payload oder Redis cachen | Ab 50+ gleichzeitigen Nutzern spuerbar |
| N+1 Badge-Progress-Queries im Dashboard | Dashboard-Ladezeit >2 Sekunden | CTEs oder Batch-Queries fuer Badge-Progress | Ab 20+ aktiven Badges pro Organisation |
| `registerTabBarEffect` destroy/recreate bei jedem Route-Wechsel | Tab-Animation flackert, Performance-Drop auf aelteren iPhones | Effect nur einmal beim Mount, `destroy` nur beim Unmount | Sofort sichtbar auf iPhone SE oder aelteren Geraeten |
| Alle Chat-Nachrichten in einer Tabelle ohne Partitioning | Langsame Chat-Room-Abfragen | Pagination + Index auf `(room_id, created_at)` | Ab 100.000+ Nachrichten |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| `push_tokens` ohne `organization_id` | Cross-Org Token-Manipulation theoretisch moeglich | Spalte hinzufuegen, bei Registrierung setzen, bei Queries filtern |
| JWT enthaelt `organization_id` im Payload (auth.js Zeile 87) | Wenn Token dekodiert wird (z.B. im Frontend), sieht jeder die Org-ID | Nicht sicherheitskritisch (Org-ID ist kein Geheimnis), aber sensible Daten (Email) aus JWT entfernen |
| Kein Token-Blacklist bei Passwort-Aenderung | Alte Sessions bleiben 24h aktiv nach Passwort-Aenderung | `token_version` in `users` Tabelle, bei Passwort-Aenderung inkrementieren, in JWT einbetten und bei Verifizierung pruefen |
| Rate-Limiter in-Memory (express-rate-limit) | Server-Restart setzt Limiter zurueck, Brute-Force nach Deploy moeglich | Redis-basierter Rate-Limiter Store |
| `validate-invite/:code` ist public ohne Rate-Limiting | Invite-Code Brute-Force (8 Hex-Chars = 4.3 Milliarden Moeglichkeiten, aber trotzdem) | Rate-Limiting auf Invite-Validation Endpoint hinzufuegen |
| SQL-Injection-Risiko bei dynamischen Spalten (activities.js) | Derzeit durch Validierung geschuetzt, aber fragiles Pattern | CASE-Statements statt Template-Literals fuer dynamische Spalten |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Rate-Limiter zeigt keine Benutzer-Nachricht bei 15-Min-Sperre | User denkt App ist kaputt, versucht es immer wieder | Klare Fehlermeldung mit Countdown "Bitte warte noch X Minuten" |
| Konfi sieht 6 Tabs auf kleinem iPhone-Display | Tabs werden sehr schmal, Labels abgeschnitten | Tab-Anzahl auf 5 reduzieren oder "Mehr"-Tab mit Untermenu |
| Admin-Design inkonsistent zum Konfi-Design | Verwirrung beim Wechsel zwischen Bereichen, unprofessioneller Eindruck | Design-System konsequent auf alle Bereiche anwenden (Ziel dieses Milestones) |
| Modal-Backdrop-Effekt fehlt auf manchen Admin-Seiten | Kein visuelles Feedback dass ein Modal ueber der Seite liegt | `presentingElement` konsistent in allen Modals setzen |
| Push-Notifications ohne Organization-Scope | Theoretisch koennte ein Admin einer anderen Org Pushes sehen | Push-Token-Registrierung mit `organization_id` verknuepfen |

## "Looks Done But Isn't" Checklist

- [ ] **Modal-System:** Alle 20+ Modals verwenden `useIonModal` -- aber pruefen ob ALLE `presentingElement` korrekt setzen (einige View-Dateien nutzen eigenen State statt ModalContext)
- [ ] **Organization-Isolation:** Chat hat `organization_id`-Filter -- aber `notifications.js`, `badges.js` (teilweise) und `levels.js` muessen auditiert werden
- [ ] **iOS 26 Theme:** CSS wird geladen -- aber `md-remove-ios-class-effect.css` wird auch auf Android geladen (unerwuenscht)
- [ ] **Invite-Code-System:** Funktioniert -- aber `used_at` wird nie gesetzt (Zeile 520 in auth.js ist auskommentiert), Codes sind unendlich wiederverwendbar
- [ ] **Badge-Streak-Berechnung:** Badge-System existiert -- aber Streak- und Zeit-basierte Fortschrittsberechnung sind TODO-Stubs (konfi.js Zeilen 962-970), immer 0%
- [ ] **Dark Mode:** CSS-Imports sind vorbereitet (als Kommentar in App.tsx) -- aber `variables.css` hat nur Light-Mode Farben, Custom-Klassen (`.app-list-item`, `.app-card`) haben hardcodierte `white`/`#333`-Werte
- [ ] **Responsive Design:** Ionic Grid vorhanden -- aber Admin-Seiten auf Tablet-Groesse nicht getestet
- [ ] **Error Boundary:** React Error Boundary nicht implementiert -- ein Fehler in einer Subkomponente crasht die gesamte App

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Globale CSS-Aenderung bricht Konfi-UI | LOW | Git revert der CSS-Aenderung, Admin-spezifische Klasse erstellen |
| Cross-Org Data Leak entdeckt | HIGH | Sofort alle betroffenen Routes patchen, Audit-Log pruefen (nicht vorhanden!), betroffene Nutzer informieren |
| Modal-State-Leak nach Refactoring | MEDIUM | `ModalContext.cleanupModals()` in betroffener Route aufrufen, presenting element Pattern korrigieren |
| Theme-Konflikt iOS/Android | MEDIUM | CSS-Imports separieren, plattform-spezifische Imports einfuehren |
| Token-Kompromittierung | HIGH | JWT_SECRET rotieren (invalidiert ALLE Tokens, alle User muessen sich neu anmelden), kuerzere Token-Laufzeit einfuehren |
| registerTabBarEffect Crash | LOW | Effect-Code in try/catch wrappen, Fallback auf Standard-TabBar ohne Animation |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Organization-ID-Filterung fehlt | Security Hardening (Phase 1) | SQL-Audit aller Routes: jeder SELECT/UPDATE/DELETE hat `WHERE organization_id` |
| JWT Token-Lifecycle | Security Hardening (Phase 1-2) | Token-Laufzeit reduziert, `token_version` in Users-Tabelle, Passwort-Aenderung invalidiert Sessions |
| Theme-Konflikt iOS/MD3 | Design-Konsistenz (fruehe Phase) | iOS-Simulator und Android-Emulator zeigen jeweils korrekte Plattform-Styles |
| registerTabBarEffect 6-Tabs | Known Bugs (fruehe Phase) | Admin- und Konfi-TabBar animiert korrekt auf iOS-Device |
| Modal presentingElement Inkonsistenz | Design-Konsistenz (Modal-Phase) | Alle 20+ Modals verwenden `useModalPage()` als einzige Quelle, keine eigenen `useState<HTMLElement>` |
| CSS bricht Konfi-UI | Design-Konsistenz (jede Phase) | Screenshot-Vergleich der Konfi-Views vor und nach jeder Design-Aenderung |
| Invite-Code wiederverwendbar | Security Hardening | `used_at` wird gesetzt, oder max_uses Counter implementiert |
| Push-Token ohne Org-Scope | Security Hardening | `push_tokens` Tabelle hat `organization_id`, Queries filtern danach |
| Rate-Limiter in-Memory | Security Hardening | Redis-Store konfiguriert, ueberdauert Server-Restarts |
| Badge-Streak TODO | Feature-Completion (spaetere Phase) | Streak-basierte Badges zeigen korrekten Fortschritt (nicht 0%) |

## Sources

- [Ionic Modal API Dokumentation](https://ionicframework.com/docs/api/modal) -- presentingElement Nutzung und Card-Modal Verhalten
- [GitHub Issue #28352: IonModal with presentingElement doesn't render on iOS](https://github.com/ionic-team/ionic-framework/issues/28352) -- bekanntes presentingElement-Problem
- [GitHub Issue #30296: Card Modal State nach Wechsel haengt](https://github.com/ionic-team/ionic-framework/issues/30296) -- Card-Modal-State-Leak
- [GitHub Issue #30466: iOS 26 Style Support in Ionic](https://github.com/ionic-team/ionic-framework/issues/30466) -- offizieller iOS 26 Support Status
- [@rdlabo/ionic-theme-ios26 GitHub Repository](https://github.com/rdlabo-team/ionic-theme-ios26) -- Community-Theme-Bibliothek
- [Multi-Tenant Leakage: When Row-Level Security Fails in SaaS](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c) -- Organisation-Isolation Pitfalls
- [10 Common Mistakes in Ionic Apps](https://www.ionicframeworks.com/2025/07/10-common-mistakes-in-ionic-apps-and.html) -- Allgemeine Ionic-Fehler
- [Secure Authentication with JWTs & Rotating Refresh Tokens](https://dev.to/wiljeder/secure-authentication-with-jwts-rotating-refresh-tokens-typescript-express-vanilla-js-4f41) -- JWT Rotation Best Practices
- [How to Handle JWT Authentication Securely in Node.js](https://oneuptime.com/blog/post/2026-01-06-nodejs-jwt-authentication-secure/view) -- JWT Security Hardening
- Codebase-Analyse: `backend/middleware/rbac.js`, `backend/routes/auth.js`, `backend/routes/notifications.js`, `frontend/src/theme/variables.css`, `frontend/src/contexts/ModalContext.tsx`, `frontend/src/components/layout/MainTabs.tsx`

---
*Pitfalls research for: Konfi Quest Design-Konsistenz und Security Hardening*
*Researched: 2026-02-27*
