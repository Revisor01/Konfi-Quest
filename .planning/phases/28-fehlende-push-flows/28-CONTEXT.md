# Phase 28: Fehlende Push-Flows - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fehlende Push-Notification-Flows implementieren: Event-Erinnerungen, Admin-Alert bei Konfi-Registrierung, Level-Up Push. Alle drei Flows nutzen die bestehende pushService.js Infrastruktur.

FLW-04 (Punkte-Meilenstein) entfaellt — Badge-Earned Push (sendBadgeEarnedToKonfi) deckt Meilensteine bereits ab. Requirement FLW-04 wird als "covered by existing badge system" markiert.

</domain>

<decisions>
## Implementation Decisions

### Event-Erinnerungen (FLW-01)
- Zwei Zeitpunkte: 1 Tag und 1 Stunde vor Event-Start (bestehende Logik beibehalten)
- Nur bestaetigte Teilnehmer (status='confirmed') erhalten Erinnerungen — keine Wartelisten-Konfis
- backgroundService Reminder-Check-Intervall: alle 15 Minuten
- sendEventReminderToKonfi und event_reminders Tabelle existieren bereits — Logik verifizieren und ggf. fixen

### Admin-Alert bei Registrierung (FLW-02)
- Trigger: auth.js POST /register-konfi Endpoint, nach erfolgreicher Registrierung
- Empfaenger: Alle Admins (admin + org_admin Rolle) die dem Jahrgang des neuen Konfis zugewiesen sind (user_jahrgaenge Tabelle)
- Push-Inhalt: Name + Jahrgang, z.B. "Neue Registrierung: Max Mustermann (Jahrgang 2025/26)"
- Neuer Push-Type: sendNewKonfiRegistrationToAdmins in pushService.js

### Level-Up Push (FLW-03)
- Trigger: Bei jeder Punkte-Vergabe (Aktivitaet, Bonus, Event-Attendance) vorher/nachher Level vergleichen
- Wenn Level sich aendert: sendLevelUpToKonfi aufrufen (existiert bereits, wird nur nirgends aufgerufen)
- Push-Inhalt: Level-Name + Level-Titel (Parameter existieren bereits in sendLevelUpToKonfi)
- Punkte-Vergabe-Stellen: konfi-managment.js und konfi.js — dort Level-Check einbauen

### FLW-04 entfaellt
- Punkte-Meilenstein Push ist eine Doppelung mit dem Badge-System
- sendBadgeEarnedToKonfi wird bereits bei Badge-Vergabe aufgerufen und deckt Meilensteine ab
- Badge-Logik ggf. spaeter nochmal anschauen (sekundaer, nicht in dieser Phase)

### Claude's Discretion
- Exakte SQL-Queries fuer Jahrgangs-Admin-Lookup bei Registrierung
- Welche Punkte-Vergabe-Stellen genau den Level-Check brauchen (alle durchgehen)
- Ob Event-Reminder-Logik Bugs hat oder direkt funktioniert
- Push-Nachrichtentexte (deutsch, mit echten Umlauten)

</decisions>

<specifics>
## Specific Ideas

- User will pragmatische Loesungen — alle "Recommended" Optionen gewaehlt
- sendLevelUpToKonfi existiert schon komplett, muss nur an den richtigen Stellen aufgerufen werden
- backgroundService Event-Reminder-Loop existiert bereits — primaer Verifikation, nicht Neubau
- FLW-04 bewusst gestrichen weil Badges dasselbe abdecken

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pushService.js:527-543` — sendLevelUpToKonfi komplett implementiert, nie aufgerufen
- `pushService.js:551-569` — sendEventReminderToKonfi komplett implementiert
- `backgroundService.js:114-236` — Event-Reminder-Loop mit 1_day/1_hour Checks, event_reminders Tabelle
- `pushService.js:sendToMultipleUsers` — Fuer Admin-Alert an mehrere Admins

### Established Patterns
- Push-Methoden in pushService.js: statische Methoden mit try/catch, db als erster Parameter
- backgroundService: setInterval-Pattern fuer periodische Checks
- auth.js:518-634: Register-Endpoint mit invite_code Validierung, jahrgang_id aus invite_codes
- konfi.js:204-208: Level-Check bei Dashboard-Load (aktualisiert current_level_id)

### Integration Points
- `auth.js:591` — Nach erfolgreicher Registrierung: Admin-Push triggern (jahrgang_id verfuegbar aus invite_code)
- `konfi-managment.js` — Punkte-Vergabe-Endpoints: Level-Check einbauen (vorher/nachher Vergleich)
- `konfi.js` — Weitere Punkte-Vergabe-Stellen: Level-Check einbauen
- `backgroundService.js:122` — Intervall auf 15 Minuten setzen (falls anders)
- `user_jahrgaenge` Tabelle — Admin-Jahrgangs-Zuweisungen fuer Empfaenger-Lookup

</code_context>

<deferred>
## Deferred Ideas

- Badge-Logik nochmal anschauen (ob alle Badges korrekt vergeben werden) — sekundaer, eigene Phase
- FLW-04 Punkte-Meilenstein als separater Push — bewusst verworfen, nicht deferred

</deferred>

---

*Phase: 28-fehlende-push-flows*
*Context gathered: 2026-03-06*
