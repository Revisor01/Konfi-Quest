# Feature Research

**Domain:** Design-Konsistenz und Sicherheits-Hardening fuer eine Ionic 8 Hybrid-App (Multi-Tenant, RBAC)
**Researched:** 2026-02-27
**Confidence:** HIGH (basierend auf Codebase-Analyse, Ionic/Capacitor-Doku, OWASP-Standards)

## Feature Landscape

### Table Stakes (Nutzer erwarten das)

Features, die vorhanden sein muessen. Fehlen = App wirkt unfertig oder unsicher.

#### A. Design-Konsistenz

| Feature | Warum erwartet | Komplexitaet | Abhaengigkeiten | Notizen |
|---------|---------------|-------------|-----------------|---------|
| Einheitliches Header-Pattern (kompaktes Banner) | Nutzer erwarten visuell zusammenhaengende Bereiche, nicht ein Flickwerk verschiedener Layouts | MEDIUM | Design System CSS (`variables.css`) | Admin-Views und Teamer-Views muessen das gleiche Gradient-Banner + Stats-Row Pattern wie Konfi-EventsView verwenden. Referenz: `src/components/konfi/views/EventsView.tsx` |
| Konsistente Listen-Items (app-list-item) | Unterschiedliche Karten-Stile in verschiedenen Bereichen verwirren Nutzer | MEDIUM | CSS-Klassen in `variables.css` | Alle Admin-Listen (Konfis, Events, Badges, Aktivitaeten, Jahrgaenge) muessen `app-list-item` mit korrektem `--SUFFIX` und `app-icon-circle` verwenden |
| Einheitliche Sektions-Header | Inkonsistente Ueberschriften wirken unprofessionell | LOW | `app-section-icon` CSS-Klassen | Jede Sektion: `IonList inset` + `IonListHeader` mit `app-section-icon--SUFFIX` und Outline-Icon |
| useIonModal-Pattern durchsetzen | `isOpen={state}` verursacht bekannte iOS-Bugs (Backdrop, Navigation-Stack) | MEDIUM | Alle 20+ Modal-Dateien | 8 Dateien verwenden noch `isOpen`: ChatModals (4), DashboardView (2 Popover), BadgesView (1), KonfiDetailView (1). Popover-isOpen ist akzeptabel, aber Modals muessen migriert werden |
| Konsistente Leerzustands-Anzeige | Leere Listen ohne Feedback sind verwirrend | LOW | `app-card` CSS | Standard-Pattern: Outline-Icon (3rem), Titel (#666), Beschreibung (#999), zentriert mit 32px Padding |
| Konsistente Formular-Elemente in Modals | Verschiedene Input-Stile in verschiedenen Modals wirken chaotisch | MEDIUM | EventModal als Referenz | Alle Modals: `IonItem lines="inset"` zwischen Feldern, `lines="none"` fuer letztes, `--background: transparent`, Stepper mit 40px Buttons |
| IonSegment fuer Tab-Navigation | Nutzer erwarten gleiche Navigation in allen Bereichen | LOW | Ionic 8 IonSegment | Admin-Events, Admin-Konfis, Konfi-Events nutzen es bereits - alle anderen Views muessen folgen wo sinnvoll |
| Swipe-Delete mit rundem Icon | Nutzer gewoehnen sich an ein Interaktionsmuster | LOW | `app-icon-circle--danger` | Alle loeschbaren Listen: IonItemSliding + IonItemOptions mit `app-icon-circle--lg app-icon-circle--danger` |
| Farb-Konsistenz nach Sektionen | Nutzer orientieren sich an Farben (Rot=Events, Tuerkis=Chat, Lila=Konfis) | LOW | CSS Custom Properties | Farbzuordnung aus Design System strikt einhalten: Events=#dc2626, Chat=#06b6d4, Konfis=#5b21b6, Badges=#f59e0b, Aktivitaeten=#059669 |

#### B. Sicherheit (Production-Ready)

| Feature | Warum erwartet | Komplexitaet | Abhaengigkeiten | Notizen |
|---------|---------------|-------------|-----------------|---------|
| Helmet Security Headers | OWASP Top 10: Fehlende Security Headers ermoeglichen XSS, Clickjacking | LOW | `npm install helmet` | `helmet` ist in `package.json` vorhanden aber NICHT in `server.js` aktiviert. Muss hinzugefuegt werden: `app.use(helmet())` mit angepasster CSP |
| Vollstaendige organization_id-Filterung | Multi-Tenant-Datenleck ist die groesste Gefahr. Nutzer einer Gemeinde koennten Daten anderer sehen | HIGH | Alle 13 Backend-Routes | CONCERNS.md identifiziert: Nicht alle Routes filtern konsistent. Jede DB-Query mit Nutzer-Daten MUSS `organization_id` in WHERE haben |
| Input-Validierung und -Sanitisierung | SQL-Injection, XSS via Chat-Nachrichten, manipulierte API-Requests | MEDIUM | Keine neue Dependency noetig, nur Code | Template-Literal-Interpolation in `activities.js` (Zeilen 211, 275, 374, 406) ersetzen. Chat-Messages muessen sanitisiert werden |
| JWT Token-Lifecycle verbessern | 24h Token ohne Refresh-Mechanismus: Bei Kompromittierung 24h Zugriff | HIGH | Neuer Refresh-Token-Endpunkt, Frontend-Logik | Aktuell: `expiresIn: '24h'` ohne Refresh. Empfehlung: 2h Access-Token + Refresh-Token-Rotation |
| Rate-Limiter Persistenz | In-Memory Rate-Limiter verliert State bei Server-Restart | MEDIUM | Redis oder Datenbank-basierter Store | Aktuell: `express-rate-limit` im Speicher. Bei Restart koennen Angreifer Rate-Limits umgehen |
| Sichere Token-Speicherung auf Mobilgeraeten | localStorage ist auf Mobilgeraeten nicht verschluesselt | MEDIUM | `@capacitor-community/secure-storage` oder Capacitor Preferences mit Keychain | Aktuell wird Token vermutlich in localStorage gespeichert. iOS Keychain / Android Keystore noetig |
| HTTPS-Erzwingung / Certificate Pinning | Man-in-the-Middle-Angriffe moeglich ohne Pinning | LOW (HTTPS) / HIGH (Pinning) | Apache/Traefik Config bereits vorhanden | HTTPS laeuft ueber Apache/Traefik. Certificate Pinning waere nice-to-have fuer native Builds |
| Passwort-Reset Validierung | Reset-Endpoint prueft nur 6 Zeichen Minimum statt volle Passwort-Policy | LOW | `validatePassword()` bereits vorhanden | `reset-password` Route (Zeile 556) prueft nur `length < 6`, aber `change-password` nutzt `validatePassword()`. Muss angeglichen werden |
| File-Upload Sicherheit | Uploads ohne Virenscanning, aber mit MIME-Filterung | LOW | Bestehende Multer-Config | MIME-Whitelist existiert bereits. Encrypted Filenames vorhanden. Gut, aber fehlende Dateityp-Validierung (Magic Bytes) |
| Push-Token Lifecycle | Verwaiste Push-Tokens verbrauchen Ressourcen und koennten missbraucht werden | LOW | Cleanup-Job, Logout-Endpoint | Keine Token-Expiration, kein Cleanup. Empfehlung: 90-Tage Expiry + Logout-Invalidierung |

#### C. Bekannte Bugs (Muessen behoben werden)

| Feature/Bug | Warum erwartet | Komplexitaet | Abhaengigkeiten | Notizen |
|-------------|---------------|-------------|-----------------|---------|
| TabBar 6+ Tabs Fix | App crasht/rendert falsch mit mehr als 5 Tabs auf iOS | MEDIUM | `@rdlabo/ionic-theme-ios26` Limitation | Entweder Tabs reduzieren, conditional rendering, oder Custom-Tab-Effekt |
| Rate-Limiter UX | Nutzer sieht keine Erklaerung warum Login blockiert ist | LOW | Frontend-Aenderung | Fehlermeldung "Zu viele Versuche" im Login-UI anzeigen + Countdown |
| Badge Double-Count Risiko | Bonus-Punkte koennten doppelt gezaehlt werden | LOW | `konfi_profiles` + `bonus_points` Tabelle | Dashboard-Query muss korrekt separieren: Profil-Punkte + Bonus-Punkte getrennt summieren |
| Deprecated Date Utils bereinigen | `parseLocalTime` und `getLocalNow` sind deprecated aber noch in Benutzung | LOW | `frontend/src/utils/dateUtils.ts` | Alle Verwendungen finden und durch empfohlene Alternativen ersetzen |

### Differentiators (Wettbewerbsvorteil)

Features, die die App hervorheben. Nicht erwartet, aber wertvoll.

| Feature | Wert-Proposition | Komplexitaet | Abhaengigkeiten | Notizen |
|---------|-----------------|-------------|-----------------|---------|
| iOS 26 Theme konsistent | Modernste iOS-Aesthetik, die sich von Standardapps abhebt | LOW | `@rdlabo/ionic-theme-ios26` bereits aktiv | Bereits importiert und aktiv. Sicherstellen, dass alle Views profitieren (keine manuellen Overrides die das Theme brechen) |
| MD3 Theme fuer Android | Material Design 3 gibt Android-Nutzern ein natives Erlebnis | LOW | `@rdlabo/ionic-theme-md3` bereits als Dependency | CSS-Import existiert in `variables.css`. Pruefen ob es korrekt rendert, da beide Themes parallel importiert werden |
| Audit-Logging fuer Admin-Aktionen | Nachvollziehbarkeit wer wann was geaendert hat - wichtig fuer Gemeinde-Kontext | MEDIUM | Neue DB-Tabelle `audit_log`, Middleware | CONCERNS.md identifiziert als fehlend. Wertvoll fuer Transparenz: Wer hat Punkte vergeben, wer hat Konfi geloescht |
| DSGVO-Datenexport | Rechtliche Compliance (DSGVO Art. 15, 20) | MEDIUM | Neuer API-Endpunkt, PDF/CSV-Generator | CONCERNS.md: Kein Bulk-Export vorhanden. Fuer eine App mit Minderjahrigen (Konfirmanden) besonders relevant |
| Dark Mode Support | Nutzer mit Sehschwaeche oder naechtlicher Nutzung | HIGH | CSS Custom Properties fuer alle Komponenten | In `variables.css` als "DISABLED" kommentiert. Wuerde komplettes CSS-Audit und Anpassung aller hardcodierten Farben erfordern |
| Animierte Uebergaenge zwischen Views | Fluessigere Navigation, professionellerer Eindruck | MEDIUM | Ionic NavController, `routeAnimation` | Ionic 8 bietet eingebaute Page-Transitions. Pruefen ob diese korrekt konfiguriert sind |
| Biometrische Authentifizierung | Quick-Login per Face ID / Fingerprint statt Passwort | MEDIUM | `@capacitor-community/biometric-auth` | Besonders relevant fuer Jugendliche die ihre App haeufig oeffnen |
| Row-Level Security (PostgreSQL) | Datenisolierung auf DB-Ebene statt nur in App-Code | HIGH | PostgreSQL RLS Policies, Schema-Aenderung | CONCERNS.md empfiehlt RLS als Verbesserung. Wuerde organization_id-Filtering auf DB-Ebene erzwingen, sodass Code-Bugs keine Daten leaken koennen |
| App-Gradient-Background konsistent | Einheitlicher Hintergrund in allen Views fuer professionellen Look | LOW | `app-gradient-background` CSS-Klasse | Klasse existiert (`linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)`), muss aber auf alle IonContent-Elemente angewandt werden |

### Anti-Features (Bewusst NICHT bauen)

Features, die verlockend erscheinen, aber Probleme verursachen wuerden.

| Anti-Feature | Warum verlockend | Warum problematisch | Alternative |
|--------------|-----------------|--------------------|----|
| Komplett eigenes Design-System | "Wir koennten alles selber schoener machen" | Ionic-Themes (iOS 26, MD3) werden nicht mehr genutzt, Updates brechen, Wartung explodiert | Bestehende CSS-Klassen (`app-list-item`, etc.) ergaenzen und Ionic-Theming nutzen statt ersetzen |
| Offline-First / Service Worker | Konfis koennten auch ohne Netz Punkte sehen | Enorme Komplexitaet (Sync-Konflikte, Stale Data, DB-Duplikation), Milestone-Scope explodiert | Lieber gute Loading-States und Error-Recovery. Offline ist Out of Scope (PROJECT.md) |
| Custom UI-Komponenten-Library | "Wiederverwendbare Atoms fuer alles" | Over-Engineering fuer eine App mit ~80 Views. CSS-Klassen + Ionic-Komponenten reichen | CSS-Klassen in `variables.css` und Referenz-Views als Vorlage (Design-System-by-Convention) |
| API-Dokumentation (Swagger) | Andere Entwickler koennten die API nutzen | Kein externer API-Zugriff geplant (PROJECT.md: Out of Scope). Wartung kostet Zeit ohne Mehrwert | CLAUDE.md und Route-Dateien als interne Doku nutzen |
| Komplettes Backend-Refactoring | Route-Files sind 1500+ Zeilen lang | Funktioniert stabil. Refactoring-Risiko ohne Tests ist hoeher als Wartungskosten | Nur kritische Fixes, kein Splitting. Erst Tests schreiben, dann optional aufteilen |
| Real-time alles (WebSocket fuer Punkte, Events) | "Punkte sofort live aktualisieren" | Socket.io nur fuer Chat noetig. Punkte-Updates sind selten (<10x/Tag pro Konfi). Polling reicht | Manuelles Refresh + Pull-to-Refresh. Chat nutzt bereits Socket.io korrekt |
| Token-Blacklist mit Redis | "Jedes Token sofort invalidierbar" | Redis-Dependency nur fuer Token-Blacklist ist Over-Engineering bei <1000 Nutzern | Kurze Token-Lifetime (2h) + Refresh-Token-Rotation. Bei Kompromittierung: Passwort-Reset erzwingt neues Token |
| Virenscanning fuer Uploads | "Uploads auf Malware pruefen" | ClamAV-Integration erhoehte Server-Last massiv, Uploads sind auf 5MB begrenzt und MIME-gefiltert | Bestehende MIME-Whitelist + Encrypted Filenames sind ausreichend fuer den Anwendungsfall |

## Feature-Abhaengigkeiten

```
[Helmet Security Headers]
    (keine Abhaengigkeit - sofort umsetzbar)

[organization_id-Filterung]
    (keine Abhaengigkeit - sofort umsetzbar, aber hohe Komplexitaet wegen vieler Routes)

[JWT Refresh Token]
    erfordert: [Sichere Token-Speicherung auf Mobilgeraeten]
                   (Refresh-Token im Keychain speichern)

[Design-Konsistenz Header-Pattern]
    erfordert: [Farb-Konsistenz nach Sektionen]
                   (Header braucht korrekte Sektionsfarben)

[useIonModal durchsetzen]
    erfordert: [Design-Konsistenz in Modals]
                   (Modals muessen erst das richtige Pattern haben)

[iOS 26 Theme konsistent]
    konfligiert teilweise mit: [MD3 Theme fuer Android]
                                   (Beide Themes sind importiert - Plattform-Detection noetig)

[Dark Mode Support]
    erfordert: [Farb-Konsistenz nach Sektionen]
    erfordert: [Alle hardcodierten Farben durch CSS Custom Properties ersetzen]
    (deshalb HIGH Komplexitaet und nicht Table Stakes)

[Audit-Logging]
    erfordert: [organization_id-Filterung]
                   (Audit-Log muss org-isoliert sein)

[DSGVO-Datenexport]
    erfordert: [organization_id-Filterung]
                   (Export muss korrekt nach Org filtern)

[Row-Level Security]
    erfordert: [organization_id-Filterung vollstaendig]
                   (RLS baut auf korrekter Spalte auf)
    verbessert: [organization_id-Filterung]
                   (macht App-Code-Fehler unschaedlich)
```

### Abhaengigkeits-Notizen

- **JWT Refresh Token erfordert Sichere Token-Speicherung:** Ein Refresh-Token im localStorage waere schlimmer als gar keins, weil es laenger lebt. Erst Keychain/Keystore, dann Refresh.
- **Dark Mode erfordert Farb-Konsistenz:** Wenn noch hardcodierte Inline-Farben existieren (#333, #666, #999 in diversen Views), brechen diese im Dark Mode. Erst alle Farben als CSS Variables, dann Dark Mode.
- **iOS 26 und MD3 gleichzeitig:** Beide Themes sind in `variables.css` importiert. Das funktioniert, weil Ionic plattformabhaengig rendert (`ios` vs `md` Mode). Aber manuelles Testen auf Android ist noetig.
- **organization_id ist Basis fuer alles:** Audit-Log, DSGVO-Export, RLS - alles baut auf korrekte Org-Isolation auf. Diese muss ZUERST vollstaendig sein.

## MVP-Definition (Stabilisierungs-Milestone)

### Launch With (v1 - Go-Live)

- [x] Helm Security Headers aktivieren -- sofort umsetzbar, LOW Komplexitaet, HIGH Sicherheitswert
- [x] organization_id-Filterung auditieren und vervollstaendigen -- kritischste Sicherheitsluecke
- [x] Input-Validierung in activities.js fixen -- SQL-Injection-Risiko beseitigen
- [x] Passwort-Reset Validierung angleichen -- LOW Komplexitaet Fix
- [x] Admin-Views auf Design-Referenz-Pattern umbauen -- Hauptziel des Milestones
- [x] Modal-Pattern (useIonModal) in verbleibenden 4 Chat-Modals durchsetzen -- iOS-Stabilitaet
- [x] Konsistente Leerzustands-Anzeige -- LOW Komplexitaet, hoher Polish-Effekt
- [x] Rate-Limiter UX im Login -- Nutzer muessen verstehen warum Login blockiert
- [x] Badge Double-Count-Risiko absichern -- Datenintegritaet

### Add After Validation (v1.x)

- [ ] JWT Refresh-Token-Mechanismus -- nach Go-Live, da 24h-Token fuer Beta akzeptabel
- [ ] Sichere Token-Speicherung (Keychain/Keystore) -- zusammen mit Refresh-Token
- [ ] Push-Token Lifecycle (Expiry + Cleanup) -- nach Go-Live, da kein akutes Problem
- [ ] Audit-Logging fuer Admin-Aktionen -- wertvoll, aber kein Blocker
- [ ] DSGVO-Datenexport -- rechtlich relevant, aber kann initial manuell erledigt werden

### Zukunft (v2+)

- [ ] Dark Mode -- erfordert umfangreiches CSS-Refactoring, erst nach Farb-Konsolidierung
- [ ] Biometrische Authentifizierung -- Nice-to-have, nicht essentiell fuer Go-Live
- [ ] Row-Level Security -- optimale Loesung, aber organization_id-Filterung im Code reicht erstmal
- [ ] Animierte View-Uebergaenge -- rein kosmetisch, nach Stabilitaet
- [ ] Certificate Pinning -- nur relevant wenn App im App Store ist

## Feature-Priorisierungs-Matrix

| Feature | Nutzer-Wert | Implementierungskosten | Prioritaet |
|---------|------------|----------------------|-----------|
| Helmet Security Headers | HIGH | LOW | P1 |
| organization_id-Filterung | HIGH | HIGH | P1 |
| Admin-Views Design-Konsistenz | HIGH | MEDIUM | P1 |
| Input-Validierung (activities.js) | HIGH | LOW | P1 |
| useIonModal durchsetzen | MEDIUM | MEDIUM | P1 |
| Passwort-Reset Fix | MEDIUM | LOW | P1 |
| Rate-Limiter UX | MEDIUM | LOW | P1 |
| Badge Double-Count Fix | MEDIUM | LOW | P1 |
| Leerzustand-Pattern | LOW | LOW | P1 |
| Swipe-Delete konsistent | LOW | LOW | P1 |
| Deprecated Date Utils | LOW | LOW | P1 |
| JWT Refresh Token | HIGH | HIGH | P2 |
| Sichere Token-Speicherung | HIGH | MEDIUM | P2 |
| Push-Token Lifecycle | LOW | LOW | P2 |
| Audit-Logging | MEDIUM | MEDIUM | P2 |
| DSGVO-Export | MEDIUM | MEDIUM | P2 |
| iOS 26 Theme validieren | LOW | LOW | P2 |
| MD3 Theme validieren | LOW | LOW | P2 |
| Dark Mode | MEDIUM | HIGH | P3 |
| Biometrie | MEDIUM | MEDIUM | P3 |
| Row-Level Security | HIGH | HIGH | P3 |
| Animierte Uebergaenge | LOW | MEDIUM | P3 |
| Certificate Pinning | LOW | HIGH | P3 |

**Prioritaets-Schluessel:**
- P1: Muss vor Go-Live erledigt sein
- P2: Sollte bald nach Go-Live kommen
- P3: Zukunft, wenn App stabil und im Store ist

## Ist-Zustand Analyse (Codebase-Audit)

### Design-Konsistenz Status

| Bereich | Nutzt Design-System | Header-Pattern | Listen-Pattern | Modal-Pattern | Notizen |
|---------|-------------------|---------------|---------------|--------------|---------|
| Konfi EventsView | JA (Referenz) | Kompakt, korrekt | app-list-item, korrekt | useIonModal | Referenz-Implementierung |
| Konfi DashboardView | TEILWEISE | Eigenes Layout | Eigene Karten | 2x isOpen (Popover) | Popover-isOpen ist akzeptabel |
| Konfi BadgesView | TEILWEISE | -- | Eigene Karten | 1x isOpen (Detail-Modal) | Modal migrieren |
| Konfi ProfileView | UNBEKANNT | -- | -- | useIonModal | Muss geprueft werden |
| Admin EventsView | JA | Korrekt | app-list-item, korrekt | useIonModal | Weitgehend konsistent |
| Admin KonfisView | TEILWEISE | -- | Eigene Implementierung | useIonModal | Listen-Items muessen migriert werden |
| Admin BadgesView | UNBEKANNT | -- | -- | useIonModal | Muss geprueft werden |
| Admin ActivitiesView | UNBEKANNT | -- | -- | useIonModal | Muss geprueft werden |
| Admin SettingsPage | UNBEKANNT | -- | -- | useIonModal | Muss geprueft werden |
| Chat ChatRoom | EIGENES | Globales Layout | Eigenes Design | 4x isOpen | Chat hat Sonderrolle, aber Modals migrieren |
| Chat Overview | EIGENES | Globales Layout | app-list-item | useIonModal | Weitgehend korrekt |

### Sicherheits-Status

| Bereich | Status | Details |
|---------|--------|---------|
| Helmet/Security Headers | FEHLT | `helmet` in package.json aber nicht aktiviert |
| CORS | DELEGIERT | An Apache, kein app-level CORS (`app.use(cors())` auskommentiert) |
| Rate Limiting | VORHANDEN (fragil) | In-Memory, verliert State bei Restart |
| JWT Validation | VORHANDEN | `verifyTokenRBAC` prueft Token korrekt |
| JWT Lifecycle | UNZUREICHEND | 24h ohne Refresh, kein Logout-Invalidierung |
| organization_id Filter | TEILWEISE | 431 Vorkommen in 13 Route-Dateien, aber nicht garantiert ueberall |
| Input Sanitisierung | TEILWEISE | Parametrisierte Queries groesstenteils, aber Template-Literals in activities.js |
| File Upload Security | GUT | MIME-Whitelist, 5MB Limit, Encrypted Filenames, kein Static-Serving |
| Password Hashing | GUT | bcrypt mit Salt-Rounds=10 |
| Token-Speicherung (Client) | UNBEKANNT (vermutlich localStorage) | Muss auf Capacitor Secure Storage migriert werden |
| HTTPS | GUT | Ueber Apache/Traefik erzwungen |

## Quellen

- [Ionic Enterprise Guide: React Best Practices](https://ionic.io/enterprise-guide/react)
- [Ionic Design Systems with Web Components](https://ionic.io/resources/articles/building-design-systems-with-web-components)
- [Capacitor Security Documentation](https://capacitorjs.com/docs/guides/security)
- [Capgo: Secure Token Storage Best Practices](https://capgo.app/blog/secure-token-storage-best-practices-for-mobile-developers/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
- [Helmet.js GitHub](https://github.com/helmetjs/helmet)
- [Logto: Express.js RBAC with JWT](https://docs.logto.io/api-protection/nodejs/express)
- [Multi-Tenant Architecture in Node.js (DEV Community)](https://dev.to/rampa2510/guide-to-building-multi-tenant-architecture-in-nodejs-40og)
- [Ionic Mobile App Security Trifecta](https://ionic.io/resources/articles/ionic-mobile-app-security-trifecta)
- Codebase-Analyse: `CONCERNS.md`, `CONVENTIONS.md`, `variables.css`, `rbac.js`, `auth.js`, `server.js`

---
*Feature-Research fuer: Konfi Quest Design-Konsistenz und Sicherheits-Hardening*
*Recherchiert: 2026-02-27*
