# Phase 7: Onboarding-Validierung - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Der QR-Code-basierte Einladungs- und Registrierungsflow funktioniert zuverlaessig mit verstaendlichen Fehlermeldungen. Dazu gehoert:
- Differenzierte Fehlermeldungen im gesamten Onboarding-Flow
- Username-Verfuegbarkeitspruefung in Echtzeit
- Design-Ueberholung von Login, Register und ForgotPassword (gleicher Stil, polierter)
- Admin-Einladungscode-Verwaltung (abgelaufene ausblenden, Verlaengerung nur aktiver Codes)
- Passwort-Recovery fixen (E-Mail-Versand reparieren, Admin-Reset-Hinweis fuer Konfis ohne E-Mail)
- JWT Token-Laufzeit auf 90 Tage erhoehen
- Auto-Login nach erfolgreicher Registrierung

</domain>

<decisions>
## Implementation Decisions

### Fehlerszenarien
- Differenzierte Fehlermeldungen statt generisch: Unterschiedliche Meldungen fuer "Code abgelaufen", "Code existiert nicht", "Code bereits benutzt"
- Backend validate-invite Route muss getrennte Fehlerfaelle zurueckgeben
- Netzwerkfehler: "Verbindung fehlgeschlagen" mit Retry-Button (kein automatischer Retry)
- Username-Verfuegbarkeit: Sofort-Check beim Verlassen des Feldes (Debounced API-Call), Inline-Feedback "Benutzername vergeben" oder "Verfuegbar"
- Shake-Effekt bei Fehler beibehalten (funktioniert gut bei Jugendlichen)

### QR-Code-Scan-Flow
- Kein In-App QR-Scanner, nur Link/native Kamera-App
- Register-URL ohne Code-Parameter zeigt Code-Eingabefeld (aktueller Stand beibehalten)
- QR + Link teilen: Admin kann QR-Code zeigen UND klickbaren Link per Share-Sheet teilen (bereits implementiert)
- QR-Code-Design: Standard schwarz/weiss (zuverlaessig mit allen Scannern)

### Registrierungsformular
- Felder bleiben: Name*, Username*, Passwort*, Passwort bestaetigen*, E-Mail (optional)
- Passwort-Anforderungen bleiben streng: Min. 8 Zeichen, Grossbuchstabe, Kleinbuchstabe, Zahl, Sonderzeichen
- Nach erfolgreicher Registrierung: Auto-Login und direkte Weiterleitung zum Konfi-Dashboard (kein Login-Redirect mehr)

### Design-Ueberholung Auth-Seiten
- Login, Register, ForgotPassword, ResetPassword: Gradient-Look beibehalten, aber polieren
- CSS-Klassen statt Inline-Styles, konsistentere Spacing/Rundungen, bessere Typografie
- Der Full-Screen-Gradient bleibt als bewusster erster Eindruck (eigener Look)
- Alle 4 Auth-Seiten bekommen den gleichen polierten Stil

### Admin-Einladungsseite
- Abgelaufene Codes werden komplett ausgeblendet (nicht verlängerbar)
- Nur aktive Codes sichtbar mit Restlaufzeit
- Verlaengerung nur fuer aktive (nicht abgelaufene) Codes moeglich
- Codes unbegrenzt verwendbar (Multi-Use, kein Limit)
- Registrierungsanzahl pro Code anzeigen (used_count)
- AdminInvitePage ans Design-System angleichen (SectionHeader, app-card etc.)

### Passwort Recovery
- E-Mail + Admin-Reset Strategie: Wenn E-Mail vorhanden, normaler E-Mail-Reset. Ohne E-Mail: Hinweis "Frag deinen Konfi-Leiter"
- E-Mail-Versand Bug fixen: SMTP-Verbindung pruefen, emailService.js statt inline-Funktion nutzen
- ForgotPassword zeigt aktuell immer "Erfolg" an (auch bei Fehlern) - muss ehrliche Fehlermeldung zeigen
- Passwort-vergessen-Link auf Login-Seite immer sichtbar
- Admin kann direkt neues Passwort setzen (kein Temp-Passwort)

### Session-Dauer
- JWT Token-Laufzeit von 24h auf 90 Tage erhoehen
- Konfis sollen quasi ein Konfi-Jahr lang eingeloggt bleiben
- Logout und Passwortaenderung machen Token ungueltig

### Claude's Discretion
- Exakte Platzierung des Passwort-vergessen-Links
- Debounce-Timing fuer Username-Check
- Retry-Button-Design bei Netzwerkfehler
- SMTP-Debugging-Strategie (Umgebungsvariablen vs. Transporter-Config)
- Auth-Seiten CSS-Klassen-Namenskonvention

</decisions>

<specifics>
## Specific Ideas

- Konfis (13-14 Jahre) vergessen staendig ihr Passwort - daher 90-Tage-Token und prominenter Admin-Reset-Hinweis
- "Abgelaufen = weg" Philosophie fuer Einladungscodes: keine Zombie-Codes die ewig verlaengert werden koennen
- ForgotPassword-Bug: Seite zeigt immer "E-Mail gesendet" an (catch-Block setzt trotzdem sent=true), kein User bekommt tatsaechlich eine E-Mail

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminInvitePage.tsx`: Vollstaendige QR-Code-Generierung mit qrcode-Bibliothek, Share/Copy-Buttons
- `KonfiRegisterPage.tsx`: Registrierungsformular mit Passwort-Checks, Code-Validierung
- `LoginView.tsx`: Login mit Fehler-Kategorisierung (Rate-Limit, Passwort falsch, User nicht gefunden, Netzwerk)
- `ForgotPasswordPage.tsx`: E-Mail-Eingabe fuer Passwort-Reset
- `ResetPasswordPage.tsx`: Neues Passwort setzen mit Token
- `emailService.js`: Modernerer E-Mail-Service mit HTML-Templates (wird aktuell NICHT von auth.js genutzt)
- Design-System CSS-Klassen: app-card, app-section-icon, app-gradient-background, SectionHeader
- `passwordUtils.js`: Passwort-Validierung (Backend)
- `loginWithAutoDetection()`: Auth-Service-Funktion fuer Login

### Established Patterns
- Auth-Seiten: Eigener Full-Screen-Gradient-Look (linear-gradient #667eea → #764ba2)
- Inline-Styles dominant in Auth-Seiten (nicht CSS-Klassen wie im Rest der App)
- Shake-Animation bei Fehlern (keyframes in style-Tag)
- Passwort-Checks als Grid mit Checkmark/Alert Icons
- Backend-Validierung via express-validator (validateRegisterKonfi etc.)

### Integration Points
- `App.tsx` Route: `/register` → KonfiRegisterPage, `/login` → LoginView, `/forgot-password` → ForgotPasswordPage
- Backend: `/api/auth/register-konfi`, `/api/auth/validate-invite/:code`, `/api/auth/login`, `/api/auth/request-password-reset`
- JWT Token: `expiresIn: '24h'` in auth.js Zeile 134
- SMTP: transporter wird an auth.js als Parameter durchgereicht (nicht emailService.js)
- AdminInvitePage wird als Modal via useIonModal geoeffnet

</code_context>

<deferred>
## Deferred Ideas

None — Diskussion blieb im Phase-Scope

</deferred>

---

*Phase: 07-onboarding-validierung*
*Context gathered: 2026-03-02*
