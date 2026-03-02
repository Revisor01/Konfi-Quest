# Phase 10: Tech Debt Cleanup - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Bekannte Code-Qualitaetsprobleme bereinigen: Rate-Limit UI-Wiring, console.log Cleanup (Frontend + Backend), condense-toolbar Konsistenz auf allen Seiten, EventDetailView Inline-Styles durch CSS-Klassen ersetzen. Keine neuen Features, kein neues Logging-Framework.

</domain>

<decisions>
## Implementation Decisions

### Rate-Limit UI
- Login-Seite: Inline-Fehlermeldung direkt im Formular (rot, unterhalb der Eingabefelder)
- Meldung zeigt Restzeit an: "Zu viele Versuche. Bitte warte X Minuten."
- rateLimitMessage aus api.ts im Login-Component konsumieren und als Inline-Text anzeigen
- Generische 429-Fehler (nicht Login): IonAlert mit Fehlermeldung und OK-Button
- KEINE Toasts verwenden -- Toasts sollen generell entfernt/vermieden werden

### console.log Strategie
- Frontend: Alle console.log entfernen oder in console.warn/error umwandeln wo relevant
- Backend: Gleiche Strategie -- console.log entfernen, relevante in warn/error
- Kein neues Logger-Package (kein Winston, kein Pino) -- console.warn/error reicht
- Server-Start Logs BEHALTEN und STRUKTURIEREN:
  - Beim Start sollen alle wichtigen Infos sauber formatiert ausgegeben werden
  - APN/Push-Notification Status (verbunden, konfiguriert, Fehler)
  - Firebase Status
  - Webhook/Live-Update Status (verbunden, aktiv)
  - Port, Environment, DB-Verbindung
  - Gut lesbar und strukturiert, nicht chaotische Einzelzeilen
- Laufzeit-Logs: Fehler als console.error, Warnungen als console.warn
- Debug-Logs die nur zum Testen dienten: entfernen

### condense-toolbar Konsistenz
- ALLE Seiten bekommen den collapsible Header-Effekt (grosser Titel scrollt in kleinen Header)
- Auch Seiten ohne scrollbaren Inhalt zeigen den grossen Titel (einheitliches Erscheinungsbild)
- app-condense-toolbar CSS-Klasse auf alle IonHeader/IonToolbar anwenden
- Aktuell nur in 3 Dateien vorhanden, muss auf alle ~55 Dateien mit IonHeader erweitert werden

### EventDetailView Inline-Styles
- BEIDE EventDetailViews umbauen (Admin + Konfi)
- Bestehende CSS-Klassen aus dem Design-System wiederverwenden (app-card, app-list-item etc.)
- Nur neue Klassen erstellen wo das Design-System keine passende hat
- Design beim Umbauen LEICHT AUFFRISCHEN -- Spacing, Schatten, Border-Radius an Design-System anpassen
- Kein kompletter Redesign, nur subtile Verbesserungen beim Refactoring

### Claude's Discretion
- Welche console.log als warn vs error eingestuft werden
- Genaues Format der Server-Start Ausgabe
- Welche bestehenden CSS-Klassen fuer EventDetailView wiederverwendet werden
- Ob einzelne Seiten den condense-Effekt anders brauchen (z.B. Modals)

</decisions>

<specifics>
## Specific Ideas

- Server-Start soll "gut aussehend" und strukturiert sein -- alle wichtigen Service-Stati auf einen Blick
- APN, Firebase, Webhooks waren als console.log drin um zu pruefen ob alles laeuft -- diese Info soll beim Start weiterhin sichtbar sein, nur besser formatiert
- Toasts generell vermeiden -- User will keine Toast-Notifications im Projekt

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- api.ts (Zeile 37-44): rateLimitMessage wird bereits auf Error-Objekt gesetzt, nur UI-Wiring fehlt
- variables.css: app-condense-toolbar Klasse existiert bereits, muss nur angewendet werden
- Design-System CSS-Klassen: app-card, app-list-item, app-section-header etc. fuer EventDetailView

### Established Patterns
- IonAlert wird im Projekt fuer Fehler und Bestaetigungen verwendet (useIonAlert Hook)
- Login-Seite hat bereits Error-State-Handling (Inline-Fehlermeldungen)
- CSS-Klassen-Pattern: app-{component}-{element}--{modifier}

### Integration Points
- api.ts Interceptor setzt rateLimitMessage -> Login-Component muss darauf reagieren
- IonHeader/IonToolbar Pattern in ~55 Dateien -> CSS-Klasse hinzufuegen
- EventDetailView: Admin (components/admin/views/) und Konfi (components/konfi/views/)

</code_context>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 10-tech-debt-cleanup*
*Context gathered: 2026-03-02*
