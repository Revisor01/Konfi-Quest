# Phase 1: Security Hardening - Context

**Gathered:** 2026-02-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Das Backend wird gegen die identifizierten Sicherheitsluecken gehaertet: helmet fuer HTTP Security Headers aktivieren, Multi-Tenant-Isolation lueckenlos machen (alle Routes nach organization_id filtern), Input-Validierung mit express-validator auf allen Endpoints, Rate-Limiter UX verbessern, SQL-Injection-Risiko in activities.js beheben.

</domain>

<decisions>
## Implementation Decisions

### Fehlermeldungen
- Generische Security-Fehlermeldungen: "Zugriff verweigert" -- keine Details die Angreifern helfen koennten
- Keine Unterscheidung ob Ressource existiert oder nicht bei Org-Verstoessen
- Alle Fehlermeldungen immer auf Deutsch (Backend gibt deutsche Texte zurueck, kein Frontend-Mapping)

### Org-Isolation
- Stille 403 bei Cross-Org-Zugriff -- generische Fehlermeldung ohne Hinweis auf Existenz der Ressource
- Superadmin darf weiterhin Org-Grenzen ueberschreiten (bestehendes Verhalten beibehalten)
- ALLE Routes muessen organization_id filtern -- insbesondere notifications.js (aktuell komplett ohne Filterung)
- Audit aller Backend-Routes auf fehlende organization_id WHERE-Klauseln

### Rate-Limiter UX
- Inline-Fehler im Formular anzeigen (z.B. unter dem Login-Button), kein Toast oder Modal
- Fehlermeldung auf Deutsch mit Wartezeit-Hinweis: "Zu viele Versuche. Bitte warte X Minuten."
- Bestehende Rate-Limits beibehalten: 10 Login-Versuche/15min, 30 Chat-Nachrichten/min, 5 Registrierungen/Stunde

### Input-Validierung
- Feld-spezifische Validierungsfehler: "Benutzername muss mindestens 3 Zeichen haben" (pro Feld, nicht generisch)
- express-validator auf ALLEN Endpoints einsetzen -- systematisch und konsistent
- Deutsche Validierungsmeldungen

### Claude's Discretion
- Reihenfolge der Route-Migration (welche zuerst auditiert werden)
- Technische Umsetzung der helmet-Konfiguration (welche Header, welche Werte)
- Strukturierung der express-validator Regeln (zentral vs. pro Route)
- SQL-Injection Fix Ansatz in activities.js (CASE-Statements vs. Whitelist)

</decisions>

<specifics>
## Specific Ideas

- helmet Dependency existiert bereits in package.json, ist aber NICHT in server.js aktiviert -- nur aktivieren, nicht neu installieren
- notifications.js hat KEINE organization_id-Filterung -- hoechste Prioritaet beim Org-Audit
- SQL-Injection-Risiko in activities.js: Template-Literal `${pointField}` fuer Spaltennamen -- muss durch sichere Alternative ersetzt werden
- Rate-Limiter Inline-Fehler sollen sich nahtlos in das bestehende Formular-Design einfuegen

</specifics>

<deferred>
## Deferred Ideas

- JWT Refresh-Token Mechanismus -- v2 Requirement (SEC-V2-01)
- Secure Token Storage (Keychain/Keystore) -- v2 Requirement (SEC-V2-02)
- Audit-Logging fuer Admin-Aktionen -- v2 Requirement (SEC-V2-04)
- DSGVO-Datenexport -- v2 Requirement (SEC-V2-05)

</deferred>

---

*Phase: 01-security-hardening*
*Context gathered: 2026-02-27*
