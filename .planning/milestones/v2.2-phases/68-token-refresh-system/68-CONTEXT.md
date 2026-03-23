# Phase 68: Token-Refresh-System - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Refresh-Token-Mechanismus einbauen: Access-Token 15min, Refresh-Token 90 Tage rotierend. Soft-Revoke ueber token_invalidated_at Timestamp. Bei abgelaufenem Token + Offline gecachte Daten weiterhin anzeigen.

</domain>

<decisions>
## Implementation Decisions

### JWT-Laufzeit + Refresh-Strategie
- **D-01:** Access-Token Laufzeit: 15 Minuten (statt aktuell 90 Tage)
- **D-02:** Refresh-Token Laufzeit: 90 Tage
- **D-03:** Refresh-Token wird bei jedem Refresh rotiert — altes Refresh-Token wird sofort ungueltig
- **D-04:** Refresh-Token in eigener DB-Tabelle gespeichert (refresh_tokens: id, user_id, token_hash, expires_at, created_at, revoked_at)
- **D-05:** Frontend: api.ts 401-Handler versucht automatisch Refresh bevor Logout — transparent fuer den User
- **D-06:** Refresh-Token wird in Capacitor Preferences gespeichert (gleicher TokenStore wie Access-Token)

### Soft-Revoke bei Rollenaenderung
- **D-07:** Neues Feld `token_invalidated_at` TIMESTAMP auf users-Tabelle
- **D-08:** Backend JWT-Validierung prueft: Wenn Token `iat` < `token_invalidated_at` → 401 (Token zu alt)
- **D-09:** 401 durch invalidiertes Token → Frontend versucht Refresh → neuer Access-Token mit aktueller Rolle
- **D-10:** Trigger fuer token_invalidated_at: Rollenaenderung (befoerdern), Passwort-Aenderung, Admin sperrt User
- **D-11:** Kein sofortiger Logout — User merkt maximal einen kurzen Refresh (15min Fenster)

### Offline + abgelaufener Token
- **D-12:** Access-Token abgelaufen + offline → Gecachte Daten weiterhin anzeigen (useOfflineQuery Cache funktioniert ohne gueltigen Token)
- **D-13:** Access-Token abgelaufen + online → Automatischer Refresh via Refresh-Token, kein Re-Login
- **D-14:** Refresh-Token abgelaufen (>90 Tage nicht geoeffnet) → Re-Login-Dialog mit freundlichem Text
- **D-15:** Re-Login-Dialog: Kein harter Redirect auf /, sondern IonAlert mit "Bitte erneut einloggen" + Login-Button
- **D-16:** Nach erfolgreichem Re-Login: Aktive Page bleibt erhalten, Daten werden revalidiert

### Backend-Aenderungen
- **D-17:** Neuer Endpoint POST /auth/refresh — nimmt Refresh-Token, gibt neuen Access-Token + neuen Refresh-Token zurueck
- **D-18:** Login-Response erweitert: gibt jetzt auch refresh_token zurueck (neben token + user)
- **D-19:** Logout loescht Refresh-Token in DB (revoked_at setzen)
- **D-20:** DB-Migration: refresh_tokens Tabelle + token_invalidated_at Spalte auf users

### Claude's Discretion
- Refresh-Token Hash-Algorithmus (SHA-256 empfohlen, konsistent mit Phase 66)
- Retry-Logik bei fehlgeschlagenem Refresh (1x Retry, dann Re-Login)
- Cleanup-Job fuer abgelaufene Refresh-Tokens in DB
- Genauer Wortlaut des Re-Login-Dialogs

</decisions>

<specifics>
## Specific Ideas

- Refresh-Flow soll fuer den User unsichtbar sein — wie bei jeder modernen App
- Bei Rollenaenderung soll der User maximal einen kurzen Ladeindikator sehen, keinen Logout
- Re-Login-Dialog erst nach 90 Tagen Inaktivitaet — das ist 2x laenger als Sommerferien

</specifics>

<canonical_refs>
## Canonical References

### Phase 55 Artefakte (Token-Infrastruktur)
- `frontend/src/services/tokenStore.ts` — getToken/setToken/clearAuth — muss um Refresh-Token erweitert werden
- `frontend/src/services/api.ts` — 401-Handler muss um Refresh-Logik erweitert werden
- `frontend/src/services/auth.ts` — login/logout muss Refresh-Token speichern/loeschen

### Backend Auth
- `backend/routes/auth.js` — Login-Endpoint, JWT-Signing, Token-Validierung
- `backend/server.js` — JWT-Middleware (verifyTokenRBAC)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- TokenStore (Phase 55): sync Memory-Cache + async Preferences — kann direkt um refreshToken erweitert werden
- 401-Handler in api.ts (Phase 55): Bereits Offline-Check vorhanden — Refresh-Logik kommt VOR dem Offline-Check
- offlineCache (Phase 56): Gecachte Daten bleiben bei abgelaufenem Token verfuegbar
- SHA-256 (Phase 66): Gleicher Hash fuer Refresh-Token-Speicherung im Backend

### Established Patterns
- JWT mit jwt.sign/jwt.verify in backend/routes/auth.js
- verifyTokenRBAC Middleware in backend/server.js
- TokenStore set/get/clear Pattern

### Integration Points
- auth.js Login → refresh_token mitgeben
- auth.js → neuer /auth/refresh Endpoint
- api.ts 401-Handler → Refresh vor Logout
- tokenStore.ts → refreshToken speichern/lesen
- server.js verifyTokenRBAC → token_invalidated_at Check
- Users-Tabelle → token_invalidated_at Spalte
- Neue refresh_tokens Tabelle

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 68-token-refresh-system*
*Context gathered: 2026-03-21*
