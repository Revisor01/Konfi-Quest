# Stack Research

**Domain:** Ionic 8 Hybrid-App -- UI Design-Konsistenz & Security Hardening
**Researched:** 2026-02-27
**Confidence:** MEDIUM-HIGH

## Kontext

Dieses Research fokussiert sich auf zwei Dimensionen fuer das bestehende Konfi Quest System:
1. **UI Design-Konsistenz** -- Wie wird eine einheitliche Optik ueber Admin/Teamer/Konfi Views hinweg erreicht?
2. **Security Hardening** -- Welche Standardmassnahmen fehlen im bestehenden Node.js/Express Backend?

Der bestehende Tech-Stack (React 19 + Ionic 8 + Capacitor 7 + Express + PostgreSQL) bleibt unveraendert. Es geht um ergaenzende Libraries und Patterns.

---

## Recommended Stack -- Design-Konsistenz

### Theming Libraries (bereits im Projekt)

| Technology | Aktuelle Version | Empfohlene Version | Purpose | Why |
|------------|-----------------|-------------------|---------|-----|
| @ionic/react | 8.5.0 | ^8.7.18 | UI-Komponenten | **Update empfohlen.** v8.7.18 (25.02.2026) fixt datetime, safe-area-inset und navigation Bugs. Ionic 8.7 brachte neue CSS Utility-Klassen und Reorder-Events. Confidence: HIGH (GitHub Releases verifiziert) |
| @rdlabo/ionic-theme-ios26 | 2.2.0 | ^2.2.1 | iOS 26 Design System | **Beibehalten + Minor Update.** v2.2.1 (22.02.2026) fixt action-sheet cancel margin. Library wird aktiv gepflegt (monatliche Releases). Confidence: HIGH (GitHub Releases verifiziert) |
| @rdlabo/ionic-theme-md3 | 1.0.2 | 1.0.2 | Material Design 3 fuer Android | **Beibehalten auf aktueller Version.** v1.0.2 ist die neueste Version (22.01.2026). Explizit kompatibel mit ionic-theme-ios26 designed. Confidence: HIGH (GitHub Releases verifiziert) |
| ionicons | 7.4.0 | ^7.4.0 | Icon Library | **Beibehalten.** Ionic 8.7 brachte Ionicons v8 Update -- aber v7.4 ist weiterhin kompatibel. Upgrade auf v8 optional. Confidence: MEDIUM |

### Design System Patterns (keine neuen Dependencies)

| Pattern | Purpose | Wie umsetzen |
|---------|---------|-------------|
| CSS Custom Properties in :root | Zentrale Farbpalette fuer alle Rollen | Bereits vorhanden in variables.css. `--app-color-*` Variablen konsistent in allen Views verwenden. |
| BEM-artige CSS-Klassen | Wiederverwendbare Komponenten-Styles | Bereits vorhanden (`app-list-item`, `app-chip`, `app-card`). Admin-Views muessen diese Klassen uebernehmen statt eigene Styles zu nutzen. |
| Kompakter Header-Pattern | Einheitliche Seitenheader | Referenz-Implementation aus Konfi-UI. Icon + Titel inline, Stats-Row darunter. Kein grosser Overlay-Text. |
| useIonModal Hook | Konsistentes Modal-Verhalten | Bereits als Pattern definiert. Alle 20+ Modale muessen auditiert und migriert werden. |

### Was NICHT hinzufuegen

| Vermeiden | Warum | Stattdessen |
|-----------|-------|-------------|
| Tailwind CSS | Wuerde mit Ionic CSS-Variablen-System kollidieren. Ionic nutzt Shadow DOM -- Tailwind-Klassen greifen dort nicht. Ausserdem: App hat bereits ein eigenes Design-System in variables.css. | Bestehende `app-*` CSS-Klassen erweitern. Ionic Utility-Klassen (ion-padding, ion-margin) nutzen. |
| Styled Components / CSS-in-JS | Unnoetige Komplexitaet. Ionic-Komponenten nutzen CSS Custom Properties und Shadow DOM Parts. CSS-in-JS kann diese nicht zuverlaessig ueberschreiben. | CSS Custom Properties + globale Klassen in variables.css |
| Separate Theme-Libraries (z.B. danielkleebinder/md3-for-ionic) | Inkompatibel mit rdlabo-Themes. rdlabo/ionic-theme-md3 ist explizit auf Kompatibilitaet mit rdlabo/ionic-theme-ios26 ausgelegt. Mischen verschiedener Theme-Libraries fuehrt zu CSS-Konflikten. | @rdlabo/ionic-theme-md3 beibehalten |
| React Router v6 | Ionic React Router basiert auf React Router v5. Migration wuerde komplettes Routing-Refactoring erfordern. Kein Nutzen fuer Design-Konsistenz. | react-router-dom 5.3.4 beibehalten |

---

## Recommended Stack -- Security Hardening

### Neue Dependencies (Backend)

| Library | Version | Purpose | Why Recommended | Confidence |
|---------|---------|---------|-----------------|------------|
| helmet | ^8.1.0 | HTTP Security Headers | Setzt 13 Security-Headers automatisch (CSP, HSTS, X-Frame-Options, etc.). Express.js offizielle Best-Practice-Empfehlung. Aktuell komplett fehlend im Backend. | HIGH (Official Express Docs, helmet npm) |
| express-validator | ^7.2.0 | Input Validation Middleware | Express-native Validation direkt auf req.body/params/query. Kein separates Schema-Objekt noetig (wie bei Joi/Zod). Fuer bestehendes Express-Backend am einfachsten zu integrieren -- Route fuer Route hinzufuegbar. | MEDIUM (Community Best Practice, npm trends) |

### Bestehende Dependencies -- Konfigurationsaenderungen

| Library | Aktuelle Version | Aenderung | Rationale |
|---------|-----------------|-----------|-----------|
| express-rate-limit | 8.2.1 | Konfiguration anpassen, NICHT upgraden | Version ist aktuell. Problem: In-Memory Store verliert State bei Restart. Fuer Produktionsbetrieb mit <500 Usern akzeptabel, aber Rate-Limiter UX im Frontend verbessern (Countdown anzeigen). Redis-Store erst bei Skalierungsbedarf. |
| jsonwebtoken | 9.0.2 | Refresh-Token-Mechanismus implementieren | Aktuell: 24h Access Token, kein Refresh. Empfehlung: Access Token auf 2h reduzieren, Refresh Token (7d) in HttpOnly Cookie. Token-Rotation bei jedem Refresh. Kein Library-Wechsel noetig -- jsonwebtoken reicht aus. |
| cors | 2.8.5 | CORS via Express aktivieren (zusaetzlich zu Apache) | Defense-in-Depth: Selbst wenn Apache CORS handelt, sollte Express als zweite Schicht explizit nur erlaubte Origins akzeptieren. Konfiguration existiert bereits fuer Socket.io (ALLOWED_ORIGINS). |

### Security Patterns (keine neuen Dependencies)

| Pattern | Problem | Loesung |
|---------|---------|---------|
| Organization-ID Middleware | Nicht alle Routes filtern konsistent nach organization_id | Zentrale Middleware erstellen, die JEDE Query mit organization_id anreichert. Bereits teilweise in rbac.js vorhanden (filterByJahrgangAccess). Muss auf alle Routes erweitert werden. |
| JWT Refresh Token Rotation | 24h Token-Lifetime zu lang, kein Refresh | Access Token: 2h. Refresh Token: 7d, in DB gespeichert, bei jedem Refresh rotiert. Altes Refresh Token wird sofort invalidiert. Bei Reuse-Detection (gestohlenes Token wiederverwendet) alle Tokens des Users invalidieren. |
| Token Blacklist bei Logout | Logout invalidiert Token nicht | Refresh Tokens in DB speichern (neue Tabelle `refresh_tokens`). Bei Logout alle Refresh Tokens des Users/Geraets loeschen. Access Token laeuft nach 2h automatisch ab. |
| Input Sanitization | SQL-Injection Risiko bei dynamischen Spalten | Template-Literal-Interpolation in SQL ersetzen durch parameterisierte Queries oder CASE-Statements. express-validator fuer Request-Body-Validation nutzen. |
| Audit Logging | Keine Nachverfolgung von Admin-Aktionen | Neue Tabelle `audit_log (id, user_id, action, entity_type, entity_id, details_json, created_at)`. Middleware oder Helper-Funktion, die bei jeder schreibenden Operation einen Eintrag erstellt. |

### Was NICHT hinzufuegen

| Vermeiden | Warum | Stattdessen |
|-----------|-------|-------------|
| Passport.js | Overkill fuer bestehende JWT-Auth. Passport wuerde Session-Management einfuehren, das mit dem aktuellen stateless JWT-Ansatz kollidiert. App hat bereits funktionierendes RBAC. | jsonwebtoken beibehalten + Refresh-Token-Logik selbst implementieren |
| Zod (Backend) | Zod ist primaer fuer TypeScript optimiert. Backend ist reines JavaScript. TypeScript-Type-Inference (Zods Staerke) bringt hier keinen Vorteil. | express-validator -- designed fuer Express, kein Schema-Boilerplate |
| Joi | Schwergewichtiger als express-validator, mehr Dependencies. Fuer ein bestehendes Express-Backend ohne Validation-Layer ist express-validator leichtgewichtiger einzufuehren. | express-validator |
| Redis (jetzt) | Fuer <500 User nicht noetig. In-Memory Rate Limiter und JWT Refresh Tokens in PostgreSQL reichen aus. Redis einfuehren wenn Skalierung es erfordert. | PostgreSQL fuer Token-Storage, In-Memory fuer Rate Limiting |
| OAuth2 / OpenID Connect | App hat geschlossene Nutzergruppe (Kirchengemeinden). Keine externen Identity Provider noetig. Selbst-implementiertes JWT+RBAC ist ausreichend und einfacher zu warten. | Bestehendes JWT + RBAC System haerten |

---

## Capacitor Version -- Wichtiger Hinweis

| Technology | Aktuelle Version | Neueste Version | Empfehlung |
|------------|-----------------|-----------------|------------|
| @capacitor/core | 7.4.2 | 7.5.0 (11.02.2026) | **Auf 7.5.0 updaten.** Bugfixes fuer Cookies und neue CLI Features. NICHT auf Capacitor 8.x upgraden -- 8.0 wurde parallel released (11.02.2026), erfordert aber Migration und ist zu frisch fuer Produktionseinsatz. Confidence: HIGH (GitHub Releases verifiziert) |

---

## Installation

```bash
# Backend Security Dependencies
cd backend && npm install helmet@^8.1.0 express-validator@^7.2.0

# Frontend Updates
cd frontend && npm install @ionic/react@^8.7.18 @ionic/react-router@^8.7.18 @rdlabo/ionic-theme-ios26@^2.2.1 @capacitor/core@7.5.0 @capacitor/ios@7.5.0 @capacitor/android@7.5.0

# Dev Dependencies (keine neuen)
```

---

## Alternatives Considered

| Kategorie | Empfohlen | Alternative | Wann Alternative waehlen |
|-----------|-----------|-------------|-------------------------|
| Input Validation | express-validator | Zod | Wenn Backend auf TypeScript migriert wird -- dann Zod fuer End-to-End Type Safety |
| Rate Limit Store | In-Memory (express-rate-limit default) | Redis via rate-limit-redis | Wenn >500 gleichzeitige User oder Multi-Instance Deployment |
| Theme Library (iOS) | @rdlabo/ionic-theme-ios26 | Ionic Native iOS 26 Support | Wenn Ionic offiziell iOS 26 Styles integriert (Issue #30466 offen). Dann rdlabo-Library entfernen. |
| Theme Library (Android) | @rdlabo/ionic-theme-md3 | Kein Theme (Ionic Default MD) | Wenn MD3 Styling nicht gewuenscht. Ionic Default ist Material Design 2, sieht datiert aus auf Android. |
| Token Storage | PostgreSQL Tabelle | Redis | Wenn Token-Lookup-Performance zum Bottleneck wird (unwahrscheinlich bei <500 Usern) |
| Audit Logging | PostgreSQL Tabelle | ELK Stack / Loki | Wenn detaillierte Log-Analyse und Dashboard benoetigt werden. Fuer Start reicht PostgreSQL. |

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| @ionic/react@8.7.18 | React 19.0.0 | Ionic 8 unterstuetzt React 18 und 19. Verifiziert durch bestehende funktionierende App. |
| @ionic/react@8.7.18 | @rdlabo/ionic-theme-ios26@2.2.1 | rdlabo-Themes sind CSS-only, keine JavaScript-API-Aenderungen zwischen Ionic Minor Versions. |
| @rdlabo/ionic-theme-ios26@2.2.1 | @rdlabo/ionic-theme-md3@1.0.2 | Explizit aufeinander abgestimmt (gleicher Maintainer, rdlabo-team). |
| @capacitor/core@7.5.0 | @ionic/react@8.7.18 | Capacitor 7.x ist vollstaendig kompatibel mit Ionic 8.x. |
| helmet@8.1.0 | express@4.18.2 | Helmet 8 unterstuetzt Express 4 und 5. |
| express-validator@7.2.0 | express@4.18.2 | express-validator ist fuer Express 4/5 designed. |
| react-router-dom@5.3.4 | @ionic/react-router@8.7.18 | Ionic React Router basiert auf React Router v5. NICHT auf v6 upgraden. |

---

## Stack Patterns by Variant

**Fuer Admin-Views (Design-Konsistenz):**
- Bestehende `app-list-item`, `app-card`, `app-chip` CSS-Klassen aus variables.css verwenden
- Kompakter Header: Icon + Titel inline, optional Stats-Row
- Farb-Mapping: Jeder Bereich hat definierte Farbe (`--app-color-events`, `--app-color-chat`, etc.)
- Keine eigenen Inline-Styles oder View-spezifische CSS-Dateien fuer grundlegende Layouts

**Fuer Modale (useIonModal Pattern):**
- Immer `useIonModal` Hook verwenden, NIEMALS `<IonModal isOpen={state}>`
- `presentingElement` auf den aktuellen `IonRouterOutlet` setzen fuer Card-Style auf iOS
- `canDismiss` nutzen fuer Formulare mit ungespeicherten Aenderungen
- Beim Dismiss: Daten ueber Callback zurueckgeben, dann Parent-Daten neu laden

**Fuer Security Middleware-Reihenfolge:**
```javascript
// 1. Helmet zuerst (Security Headers)
app.use(helmet());
// 2. CORS (Origin-Filterung)
app.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
// 3. Rate Limiting (globale Begrenzung)
app.use(generalLimiter);
// 4. Body Parsing
app.use(express.json({ limit: '10mb' }));
// 5. Authentifizierung (verifyTokenRBAC auf geschuetzten Routes)
// 6. Input Validation (express-validator auf einzelnen Endpoints)
```

**Fuer JWT Refresh Token Flow:**
```
Login → Access Token (2h) + Refresh Token (7d, HttpOnly Cookie)
API Request → Access Token im Authorization Header
Token Expired → POST /auth/refresh mit Refresh Token Cookie
  → Neues Access Token + neues Refresh Token (Rotation)
  → Altes Refresh Token invalidiert
Logout → DELETE /auth/logout → Alle Refresh Tokens geloescht
```

---

## Offene Fragen fuer Phase-spezifisches Research

1. **registerTabBarEffect Bug mit 6+ Tabs:** Ist dies in ionic-theme-ios26 v2.2.1 gefixt? Muss waehrend der Implementierung getestet werden.
2. **Capacitor 8 Migration:** Capacitor 8.0 wurde am 11.02.2026 released. Soll dies im naechsten Milestone evaluiert werden? Breaking Changes pruefen.
3. **Ionic Native iOS 26 Support:** Issue #30466 im Ionic Framework Repository ist offen. Wenn Ionic dies nativ integriert, kann rdlabo-Library entfernt werden. Monitoring empfohlen.
4. **express-validator vs. manuelle Validation:** Einige Routes haben bereits grundlegende req.body Checks. Soll express-validator schrittweise oder auf einmal eingefuehrt werden?

---

## Sources

- [Ionic Framework GitHub Releases](https://github.com/ionic-team/ionic-framework/releases) -- Verifiziert: v8.7.18 (25.02.2026), Confidence: HIGH
- [Capacitor GitHub Releases](https://github.com/ionic-team/capacitor/releases) -- Verifiziert: v7.5.0 + v8.1.0 (11.02.2026), Confidence: HIGH
- [rdlabo/ionic-theme-ios26 GitHub Releases](https://github.com/rdlabo-team/ionic-theme-ios26/releases) -- Verifiziert: v2.2.1 (22.02.2026), Confidence: HIGH
- [rdlabo/ionic-theme-md3 GitHub Releases](https://github.com/rdlabo-team/ionic-theme-md3/releases) -- Verifiziert: v1.0.2 (22.01.2026), Confidence: HIGH
- [Ionic Framework iOS 26 Support Issue #30466](https://github.com/ionic-team/ionic-framework/issues/30466) -- Status: Offen, Confidence: HIGH
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) -- Helmet + CORS Empfehlung, Confidence: HIGH
- [Helmet.js](https://helmetjs.github.io/) -- v8.1.0, 13 Security Headers, Confidence: HIGH
- [Ionic Theming Documentation](https://ionicframework.com/docs/theming/basics) -- CSS Custom Properties Pattern, Confidence: HIGH
- [Ionic Modal Documentation](https://ionicframework.com/docs/api/modal) -- useIonModal, presentingElement, canDismiss, Confidence: HIGH
- [JWT Refresh Token Rotation Best Practices](https://www.freecodecamp.org/news/how-to-build-a-secure-authentication-system-with-jwt-and-refresh-tokens/) -- Token Rotation Pattern, Confidence: MEDIUM
- [Auth0 Refresh Token Guide](https://auth0.com/blog/refresh-tokens-what-are-they-and-when-to-use-them/) -- HttpOnly Cookie Storage, Confidence: HIGH
- [express-rate-limit npm](https://www.npmjs.com/package/express-rate-limit) -- v8.2.1 Konfiguration, Confidence: HIGH
- [Joi vs Zod Comparison (Better Stack)](https://betterstack.com/community/guides/scaling-nodejs/joi-vs-zod/) -- Validation Library Vergleich, Confidence: MEDIUM
- [MDN: Securing APIs with Express Rate Limit](https://developer.mozilla.org/en-US/blog/securing-apis-express-rate-limit-and-slow-down/) -- Rate Limiting Patterns, Confidence: HIGH

---

*Stack research for: Konfi Quest -- UI Design-Konsistenz & Security Hardening*
*Researched: 2026-02-27*
