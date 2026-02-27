# Phase 1: Security Hardening - Research

**Researched:** 2026-02-27
**Domain:** Backend Security (Express.js HTTP Headers, Multi-Tenant Isolation, Input Validation, Rate Limiter UX)
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Generische Security-Fehlermeldungen: "Zugriff verweigert" -- keine Details die Angreifern helfen koennten
- Keine Unterscheidung ob Ressource existiert oder nicht bei Org-Verstoessen
- Alle Fehlermeldungen immer auf Deutsch (Backend gibt deutsche Texte zurueck, kein Frontend-Mapping)
- Stille 403 bei Cross-Org-Zugriff -- generische Fehlermeldung ohne Hinweis auf Existenz der Ressource
- Superadmin darf weiterhin Org-Grenzen ueberschreiten (bestehendes Verhalten beibehalten)
- ALLE Routes muessen organization_id filtern -- insbesondere notifications.js (aktuell komplett ohne Filterung)
- Audit aller Backend-Routes auf fehlende organization_id WHERE-Klauseln
- Inline-Fehler im Formular anzeigen (z.B. unter dem Login-Button), kein Toast oder Modal
- Fehlermeldung auf Deutsch mit Wartezeit-Hinweis: "Zu viele Versuche. Bitte warte X Minuten."
- Bestehende Rate-Limits beibehalten: 10 Login-Versuche/15min, 30 Chat-Nachrichten/min, 5 Registrierungen/Stunde
- Feld-spezifische Validierungsfehler: "Benutzername muss mindestens 3 Zeichen haben" (pro Feld, nicht generisch)
- express-validator auf ALLEN Endpoints einsetzen -- systematisch und konsistent
- Deutsche Validierungsmeldungen

### Claude's Discretion
- Reihenfolge der Route-Migration (welche zuerst auditiert werden)
- Technische Umsetzung der helmet-Konfiguration (welche Header, welche Werte)
- Strukturierung der express-validator Regeln (zentral vs. pro Route)
- SQL-Injection Fix Ansatz in activities.js (CASE-Statements vs. Whitelist)

### Deferred Ideas (OUT OF SCOPE)
- JWT Refresh-Token Mechanismus -- v2 Requirement (SEC-V2-01)
- Secure Token Storage (Keychain/Keystore) -- v2 Requirement (SEC-V2-02)
- Audit-Logging fuer Admin-Aktionen -- v2 Requirement (SEC-V2-04)
- DSGVO-Datenexport -- v2 Requirement (SEC-V2-05)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| SEC-01 | Backend nutzt helmet fuer HTTP Security Headers (Dependency existiert NICHT -- muss installiert werden) | helmet 8.x NPM-Paket, Default-Konfiguration setzt 13 Header, API-spezifische CSP-Anpassung noetig |
| SEC-02 | Alle Backend-Routes filtern Queries konsistent nach organization_id | Audit zeigt: 13 von 15 Route-Files haben Filterung. settings.js und notifications.js fehlen komplett |
| SEC-03 | notifications.js Route hat organization_id-Filterung | 0 Vorkommen von organization_id in notifications.js -- alle 3 Endpoints betroffen (POST /device-token, POST /test-push, DELETE /device-token) |
| SEC-04 | Backend nutzt express-validator fuer systematische Input-Validierung | express-validator 7.3.x, Validation-Chain-Pattern mit body()/param()/query(), withMessage() fuer deutsche Texte |
| SEC-05 | Rate-Limiter zeigt dem User eine verstaendliche Meldung bei Blockierung | Backend sendet bereits deutsche Texte, Frontend hat nur LoginView-Behandlung. Globaler 429-Interceptor fehlt |
| SEC-06 | SQL-Injection-Risiko in activities.js durch sichere Query-Patterns ersetzt | Template-Literal ${pointField} in activities.js (4x) und konfi-managment.js (4x) -- Whitelist-Validierung empfohlen |
</phase_requirements>

## Summary

Die Phase 1 befasst sich mit sechs konkreten Sicherheitsluecken im Backend. Die Codebase-Analyse zeigt ein klares Bild: Das Projekt nutzt Express 4.18.2 auf Node.js 18, hat ein gut strukturiertes RBAC-Middleware-System in `middleware/rbac.js`, aber Luecken in der Anwendung dieser Middleware auf bestimmte Routes.

**Kritische Korrektur:** CONTEXT.md behauptet, helmet existiere bereits als Dependency und muesse nur aktiviert werden. Die Analyse zeigt: helmet ist WEDER in package.json NOCH in package-lock.json vorhanden. Es muss installiert UND konfiguriert werden.

Die groesste Arbeit liegt bei SEC-04 (express-validator auf allen Endpoints) -- das Projekt hat aktuell KEINE Input-Validierungsbibliothek installiert. Manuelle Validierung (`if (!name || !points)`) existiert sporadisch. SEC-02/SEC-03 (Org-Isolation) sind kritisch fuer Datenschutz, aber im Umfang begrenzt (2 Route-Files). SEC-06 (SQL-Injection) hat begrenztes reales Risiko (die Werte kommen aus Ternary-Operationen, nicht direkt aus User-Input), sollte aber trotzdem abgesichert werden.

**Primary recommendation:** Zuerst helmet installieren und aktivieren (schneller Gewinn), dann Org-Isolation fixen (hohes Risiko), dann express-validator systematisch einfuehren (groesster Aufwand), zuletzt Rate-Limiter UX verbessern.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| [helmet](https://www.npmjs.com/package/helmet) | ^8.1.0 | HTTP Security Headers (13 Default-Header) | Express.js Defacto-Standard, 6700+ dependents, empfohlen in Express Security Best Practices |
| [express-validator](https://www.npmjs.com/package/express-validator) | ^7.3.1 | Input-Validierung und Sanitization | 12000+ dependents, wraps validator.js, Express-native Middleware-Pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| express-rate-limit | ^8.2.1 (bereits installiert) | Rate Limiting | Bereits im Projekt, UX-Verbesserung noetig |
| pg | ^8.16.3 (bereits installiert) | PostgreSQL Client | Parameterized Queries ($1, $2) verhindern SQL Injection |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| express-validator | joi/yup + custom middleware | express-validator ist Express-nativer, joi braucht Wrapper |
| helmet | manuell gesetzte Header | helmet deckt 13 Header ab, manuell fehleranfaellig |
| Whitelist fuer pointField | CASE-Statement in SQL | Whitelist ist lesbarer, CASE ist SQL-seitig sicherer aber umstaendlicher |

**Installation:**
```bash
cd backend && npm install helmet@^8.1.0 express-validator@^7.3.1
```

## Architecture Patterns

### Recommended Project Structure
```
backend/
  middleware/
    rbac.js              # Bestehend - Token-Verifikation + Rollen
    validation.js        # NEU - Zentrale Validierungsregeln
  routes/
    *.js                 # Validierung als Middleware vor Handler
  server.js              # helmet() als erstes Middleware
```

### Pattern 1: Helmet-Integration (SEC-01)
**What:** helmet als erstes Middleware in der Chain registrieren
**When to use:** Einmalig in server.js
**Example:**
```javascript
// Source: https://helmetjs.github.io/
const helmet = require('helmet');

app.use(helmet({
  // CSP fuer API-Backend lockern -- kein Browser-Content
  contentSecurityPolicy: false,
  // HSTS wird bereits von Apache gesetzt
  strictTransportSecurity: false
}));

// DANACH: generalLimiter, express.json(), etc.
```
**Begruendung:** Das Backend ist eine reine API hinter Apache Reverse-Proxy. Apache setzt bereits HSTS und SSL. CSP ist fuer APIs irrelevant (kein HTML-Content). Alle anderen Helmet-Default-Header (X-Content-Type-Options, X-Frame-Options, etc.) sind sinnvoll.

### Pattern 2: Organization-Isolation (SEC-02, SEC-03)
**What:** Jede DB-Query filtert nach req.user.organization_id
**When to use:** In JEDER Route die Daten liest oder schreibt
**Example:**
```javascript
// KORREKT: Immer organization_id mitfiltern
const { rows } = await db.query(
  'SELECT * FROM push_tokens WHERE user_id = $1 AND user_id IN (SELECT id FROM users WHERE organization_id = $2)',
  [userId, req.user.organization_id]
);

// ODER: push_tokens um organization_id Spalte erweitern (bevorzugt)
const { rows } = await db.query(
  'SELECT * FROM push_tokens pt JOIN users u ON pt.user_id = u.id WHERE pt.user_id = $1 AND u.organization_id = $2',
  [userId, req.user.organization_id]
);

// Superadmin-Ausnahme (bestehendes RBAC-Pattern):
// verifyTokenRBAC setzt req.user.is_super_admin
if (!req.user.is_super_admin) {
  // organization_id Filter anwenden
}
```

### Pattern 3: express-validator Chains (SEC-04)
**What:** Validierungsregeln als Middleware-Array vor dem Handler
**When to use:** Auf jedem Endpoint der Daten entgegennimmt
**Example:**
```javascript
// Source: https://express-validator.github.io/docs/guides/getting-started
const { body, param, validationResult } = require('express-validator');

// Zentrale Fehlerbehandlung
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validierungsfehler',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

// Pro Route: Validierungsregeln
const validateCreateActivity = [
  body('name')
    .notEmpty().withMessage('Name ist erforderlich')
    .isLength({ min: 2, max: 100 }).withMessage('Name muss zwischen 2 und 100 Zeichen haben'),
  body('points')
    .isInt({ min: 1 }).withMessage('Punkte muessen eine positive Ganzzahl sein'),
  body('type')
    .isIn(['gottesdienst', 'gemeinde']).withMessage('Typ muss gottesdienst oder gemeinde sein'),
  handleValidationErrors
];

router.post('/', rbacVerifier, requireAdmin, validateCreateActivity, async (req, res) => {
  // req.body ist hier bereits validiert
});
```

### Pattern 4: Sichere Spaltennamen (SEC-06)
**What:** Whitelist-Validierung fuer dynamische SQL-Spaltennamen
**When to use:** Ueberall wo Template-Literals in SQL-Queries verwendet werden
**Example:**
```javascript
// VORHER (unsicher):
const pointField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
await db.query(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + $1 WHERE user_id = $2`, [points, konfiId]);

// NACHHER (sicher mit Whitelist):
const VALID_POINT_FIELDS = ['gottesdienst_points', 'gemeinde_points'];
const pointField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';

if (!VALID_POINT_FIELDS.includes(pointField)) {
  throw new Error('Ungueltiger Punktetyp');
}

await db.query(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + $1 WHERE user_id = $2`, [points, konfiId]);
```
**Empfehlung:** Whitelist als Konstante in einer zentralen Datei definieren, da das Pattern in activities.js (4x) und konfi-managment.js (4x) vorkommt. Alternativ eine Hilfsfunktion:
```javascript
function getPointField(type) {
  const map = { gottesdienst: 'gottesdienst_points', gemeinde: 'gemeinde_points' };
  const field = map[type];
  if (!field) throw new Error('Ungueltiger Punktetyp');
  return field;
}
```

### Pattern 5: Rate-Limiter UX (SEC-05)
**What:** 429-Responses global im Frontend abfangen und benutzerfreundlich anzeigen
**When to use:** Im axios-Interceptor (frontend/src/services/api.ts)
**Example:**
```typescript
// In api.ts: Globaler 429-Interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers['retry-after'];
      const minutes = retryAfter ? Math.ceil(parseInt(retryAfter) / 60) : 15;
      error.rateLimitMessage = `Zu viele Versuche. Bitte warte ${minutes} Minuten.`;
    }
    // ... bestehende 401-Behandlung
    return Promise.reject(error);
  }
);
```
**Backend-Seite:** Rate-Limiter setzen bereits `standardHeaders: true`, was `RateLimit-*` Header sendet. Der `Retry-After`-Header wird bei express-rate-limit 8.x automatisch gesetzt.

### Anti-Patterns to Avoid
- **Inline-Validierung in Route-Handlern:** `if (!name || !points)` -- ersetzt durch express-validator Middleware fuer konsistente Fehlerformate
- **Fehlende Org-Filterung auf "harmlose" Routes:** Auch Push-Token-Routes koennten Org-uebergreifende Informationslecks haben
- **CSP fuer API aktivieren:** Unnoetig und kann Probleme mit API-Clients verursachen
- **Organization_id als Query-Parameter akzeptieren:** Immer aus req.user.organization_id nehmen (JWT-verifiziert), nie aus Request-Body

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTTP Security Headers | Manuelle res.setHeader()-Aufrufe | helmet | 13 Header korrekt konfiguriert, Community-maintained |
| Input-Validierung | if/else Ketten pro Feld | express-validator | Konsistente Fehlerformate, Sanitization, Typ-Checks |
| SQL-Injection Schutz | String-Escaping | pg parameterized queries ($1, $2) | Bereits vorhanden, nur Spaltennamen-Whitelist fehlt |
| Rate-Limit Zeitberechnung | Manuelle Zeitberechnung | express-rate-limit standardHeaders | Retry-After Header wird automatisch gesetzt |

**Key insight:** Die Codebase nutzt bereits parameterized queries ueberall korrekt -- das SQL-Injection-Risiko ist auf dynamische Spaltennamen beschraenkt, nicht auf Werte. Express-validator ersetzt die sporadische manuelle Validierung durch ein konsistentes System.

## Common Pitfalls

### Pitfall 1: Helmet CSP blockiert API-Responses
**What goes wrong:** Default-CSP von helmet setzt `default-src 'self'` was bei JSON-API-Responses Probleme mit CORS-Clients verursachen kann
**Why it happens:** Helmet ist primaer fuer Web-Apps konzipiert, nicht fuer reine APIs
**How to avoid:** `contentSecurityPolicy: false` setzen fuer reine API-Backends
**Warning signs:** Frontend-Clients bekommen leere Responses oder CSP-Violations

### Pitfall 2: HSTS-Dopplung mit Reverse-Proxy
**What goes wrong:** Sowohl helmet als auch Apache setzen HSTS-Header, was zu doppelten Headern fuehrt
**Why it happens:** Der Server laeuft hinter Apache mit KeyHelp (das bereits HSTS setzt)
**How to avoid:** `strictTransportSecurity: false` in helmet setzen -- Apache/KeyHelp handhabt HSTS
**Warning signs:** Doppelte Strict-Transport-Security Header in Response

### Pitfall 3: express-validator vergisst handleValidationErrors
**What goes wrong:** Validierungsregeln sind definiert, aber Fehler werden nie geprueft -- Request geht durch
**Why it happens:** express-validator sammelt nur Fehler, blockiert nicht automatisch
**How to avoid:** `handleValidationErrors` Middleware IMMER als letztes Element im Validierungs-Array
**Warning signs:** Ungueltige Daten kommen trotz Validierungsregeln im Handler an

### Pitfall 4: Superadmin-Bypass nicht beruecksichtigt
**What goes wrong:** Org-Filterung blockiert Superadmin-Zugriff
**Why it happens:** `WHERE organization_id = $1` ohne Superadmin-Check
**How to avoid:** Bestehendes RBAC-Pattern beibehalten: `if (!req.user.is_super_admin)` vor Org-Filter
**Warning signs:** Superadmin kann nach Security-Hardening nicht mehr auf Org-Daten zugreifen

### Pitfall 5: Push-Token ohne Org-Isolation
**What goes wrong:** Benutzer koennen Push-Tokens anderer Organisationen loeschen oder manipulieren
**Why it happens:** notifications.js hat keine organization_id-Filterung -- Queries filtern nur nach user_id
**How to avoid:** JOIN mit users-Tabelle oder Spalte organization_id zu push_tokens hinzufuegen
**Warning signs:** Ein Nutzer sendet eine Token-Loeschung fuer eine device_id die einem anderen Org-Nutzer gehoert

### Pitfall 6: Settings ohne Org-Isolation
**What goes wrong:** settings.js gibt ALLE Settings global zurueck, ohne Org-Filterung
**Why it happens:** Die settings-Tabelle hat moeglicherweise keine organization_id-Spalte
**How to avoid:** Pruefen ob settings org-spezifisch sein muessen. Falls ja: Spalte hinzufuegen und filtern. Falls nein (globale App-Settings): Dokumentieren warum keine Filterung noetig
**Warning signs:** Org A sieht Settings von Org B

## Code Examples

### Vollstaendige helmet-Konfiguration fuer dieses Projekt
```javascript
// Source: https://helmetjs.github.io/ + Projekt-spezifische Anpassungen
const helmet = require('helmet');

// In server.js NACH app-Erstellung, VOR allen anderen Middlewares:
app.use(helmet({
  // CSP: Nicht relevant fuer reine JSON-API
  contentSecurityPolicy: false,
  // HSTS: Apache/KeyHelp setzt das bereits
  strictTransportSecurity: false,
  // Alle anderen Defaults beibehalten:
  // - X-Content-Type-Options: nosniff
  // - X-Frame-Options: SAMEORIGIN
  // - X-DNS-Prefetch-Control: off
  // - X-Download-Options: noopen
  // - X-Permitted-Cross-Domain-Policies: none
  // - Referrer-Policy: no-referrer
  // - X-Powered-By: entfernt
  // - Cross-Origin-Opener-Policy: same-origin
  // - Cross-Origin-Resource-Policy: same-origin
  // - Origin-Agent-Cluster: ?1
  // - X-XSS-Protection: 0
}));
```

### Zentrale Validierungs-Middleware
```javascript
// Source: https://express-validator.github.io/docs/guides/getting-started
const { validationResult } = require('express-validator');

// middleware/validation.js
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validierungsfehler',
      details: errors.array().map(e => ({
        field: e.path,
        message: e.msg
      }))
    });
  }
  next();
};

module.exports = { handleValidationErrors };
```

### Beispiel: Validierung fuer activities.js POST
```javascript
// Source: https://express-validator.github.io/docs/guides/customizing
const { body } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

const validateCreateActivity = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name ist erforderlich')
    .isLength({ min: 2, max: 100 }).withMessage('Name muss zwischen 2 und 100 Zeichen lang sein'),
  body('points')
    .isInt({ min: 1 }).withMessage('Punkte muessen eine positive Ganzzahl sein'),
  body('type')
    .isIn(['gottesdienst', 'gemeinde']).withMessage('Typ muss "gottesdienst" oder "gemeinde" sein'),
  body('category_ids')
    .optional()
    .isArray().withMessage('Kategorie-IDs muessen ein Array sein'),
  body('category_ids.*')
    .optional()
    .isInt({ min: 1 }).withMessage('Ungueltige Kategorie-ID'),
  handleValidationErrors
];

// Verwendung: router.post('/', rbacVerifier, requireAdmin, validateCreateActivity, handler);
```

### notifications.js Org-Isolation Fix
```javascript
// VORHER (unsicher):
const { rows: tokens } = await db.query(
  'SELECT * FROM push_tokens WHERE user_id = $1',
  [userId]
);

// NACHHER (sicher -- JOIN mit users fuer Org-Check):
const { rows: tokens } = await db.query(
  `SELECT pt.* FROM push_tokens pt
   JOIN users u ON pt.user_id = u.id
   WHERE pt.user_id = $1 AND u.organization_id = $2`,
  [userId, req.user.organization_id]
);
```

## Bestandsaufnahme: Organization-ID Audit

### Routes MIT organization_id-Filterung (OK):
| Route-File | Occurrences | Status |
|-----------|-------------|--------|
| activities.js | 32 | OK |
| auth.js | 13 | OK |
| badges.js | 37 | OK |
| categories.js | 11 | OK |
| chat.js | 35 | OK |
| events.js | 75 | OK |
| jahrgaenge.js | 11 | OK |
| konfi-managment.js | 54 | OK |
| konfi.js | 76 | OK |
| levels.js | 19 | OK |
| organizations.js | 37 | OK (Superadmin-Routes) |
| roles.js | 6 | OK |
| users.js | 25 | OK |

### Routes OHNE organization_id-Filterung (KRITISCH):
| Route-File | Endpoints | Risiko | Fix-Ansatz |
|-----------|-----------|--------|------------|
| notifications.js | POST /device-token, POST /test-push, DELETE /device-token | HOCH -- Cross-Org Push-Token-Manipulation moeglich | JOIN mit users-Tabelle fuer Org-Validierung |
| settings.js | GET /, PUT / | MITTEL -- Settings sind moeglicherweise global (zu pruefen) | organization_id-Spalte zu settings hinzufuegen ODER dokumentieren warum global |

### SQL-Injection-Risiko Stellen:
| File | Zeilen | Pattern | Reales Risiko |
|------|--------|---------|---------------|
| activities.js | 211, 275, 374, 406 | `${pointField}` (Ternary, nicht User-Input) | NIEDRIG -- aber Best Practice erfordert Whitelist |
| konfi-managment.js | 441, 482, 528, 574 | `${updateField}` (Ternary, nicht User-Input) | NIEDRIG -- aber Best Practice erfordert Whitelist |

**Hinweis zu activities.js Zeile 405:** Der `type`-Wert in `assign-bonus` kommt aus `req.body.type` und wird NICHT vor der Ternary-Operation validiert. Die Ternary (`type === 'gottesdienst' ? ... : ...`) faellt auf den `else`-Zweig ('gemeinde_points') fuer JEDEN ungueltige Wert. Kein SQL-Injection-Risiko, aber logischer Fehler: ein `type: 'invalid'` wuerde stillschweigend als gemeinde_points gewertet.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| X-XSS-Protection: 1 | X-XSS-Protection: 0 | Helmet 5+ (2022) | Moderne Browser brauchen kein XSS-Filter-Header, kann sogar Angriffe ermoeglichen |
| express-validator checkBody() | body() Chain-Syntax | express-validator 6+ (2020) | Aktuelle API ist body()/param()/query() mit .withMessage() |
| Retry-After manuell | standardHeaders: true | express-rate-limit 7+ (2023) | RateLimit-* und Retry-After werden automatisch gesetzt |

**Deprecated/outdated:**
- express-validator `check()` API: Durch `body()`, `param()`, `query()` ersetzt (seit v6)
- helmet `hidePoweredBy`: Jetzt automatisch in helmet() enthalten
- `X-XSS-Protection: 1; mode=block`: Nicht mehr empfohlen, helmet setzt `0`

## Open Questions

1. **Settings-Tabelle: Global oder Org-spezifisch?**
   - Was wir wissen: settings.js hat keine organization_id-Filterung, die Tabelle scheint global zu sein
   - Was unklar ist: Ob die settings-Tabelle eine organization_id-Spalte hat oder haben sollte
   - Empfehlung: DB-Schema pruefen. Falls Settings global sind (z.B. App-Version), ist keine Filterung noetig. Falls org-spezifisch (target_gottesdienst, target_gemeinde), MUSS organization_id hinzugefuegt werden. **Hohes Risiko bei org-spezifischen Zielpunkten.**

2. **push_tokens Tabelle: organization_id hinzufuegen oder JOINen?**
   - Was wir wissen: push_tokens hat wahrscheinlich keine organization_id Spalte
   - Was unklar ist: Ob ein ALTER TABLE oder nur JOINs mit users-Tabelle besser sind
   - Empfehlung: JOIN-Ansatz (kein Schema-Change noetig), da user_id immer vorhanden und users-Tabelle die organization_id fuehrt

3. **express-validator: Zentral oder pro Route?**
   - Was wir wissen: 15 Route-Files mit unterschiedlichen Endpoints
   - Empfehlung: **Hybrid-Ansatz** -- zentrale `handleValidationErrors` Middleware + pro Route spezifische Validierungsregeln. Gemeinsame Validierungen (z.B. `paramId` fuer parseInt-Check auf :id Params) als wiederverwendbare Snippets in middleware/validation.js

## Sources

### Primary (HIGH confidence)
- [helmet NPM](https://www.npmjs.com/package/helmet) - Version 8.1.0, Default-Header-Liste, Installation
- [helmet.js Dokumentation](https://helmetjs.github.io/) - Konfigurationsoptionen, Default-Werte fuer alle 13 Header
- [express-validator NPM](https://www.npmjs.com/package/express-validator) - Version 7.3.1, Node.js 14+ Requirement
- [express-validator Docs: Getting Started](https://express-validator.github.io/docs/guides/getting-started) - Chain-Pattern, validationResult(), matchedData()
- [express-validator Docs: Customizing](https://express-validator.github.io/docs/guides/customizing) - withMessage(), Field-Level Messages, Custom Formatters
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html) - helmet-Empfehlung

### Secondary (MEDIUM confidence)
- Codebase-Analyse: Alle 15 Route-Files manuell auf organization_id-Filterung geprueft
- Codebase-Analyse: SQL-Template-Literal-Risiken in activities.js und konfi-managment.js identifiziert
- package.json/package-lock.json: Bestaetigt dass helmet NICHT installiert ist (korrigiert CONTEXT.md)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - helmet und express-validator sind etablierte, stabile Bibliotheken mit klarer Dokumentation
- Architecture: HIGH - Patterns basieren auf offizieller Dokumentation und Analyse der bestehenden Codebase-Struktur
- Pitfalls: HIGH - Basieren auf konkreter Code-Analyse (grep der Route-Files, package.json-Check)
- Org-Isolation Audit: HIGH - Automatisierter Count ueber alle 15 Route-Files

**Research date:** 2026-02-27
**Valid until:** 2026-03-27 (stabile Libraries, kaum Aenderungen erwartet)
