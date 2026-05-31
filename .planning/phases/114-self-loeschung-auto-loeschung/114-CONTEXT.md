# Phase 114: Self-Loeschung + Auto-Loeschung (DSGVO/DSG-EKD) - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning
**Mode:** Discuss (Entscheidungen mit Inhaber abgestimmt)

<domain>
## Phase Boundary

DSGVO/DSG-EKD-Konformitaet fuer den Launch: Nutzer:innen koennen ihren Account selbst loeschen (In-App, erfuellt Apple-Anforderung), und Konfi-Daten werden nach der Konfirmation automatisch geloescht (Datenaufbewahrungsfrist). Gekoppelt an das Konfirmationsdatum des Jahrgangs.

NICHT in dieser Phase: Kirchenkreis-Hierarchie, Plan-/Konfi-Limits (eigene Phase), Self-Service-Org-Erstellung.
</domain>

<decisions>
## Implementation Decisions

### Self-Loeschung (SD)
- **D-01:** ALLE Rollen (Konfis, Teamer:innen, Admins) koennen den eigenen Account in der App loeschen.
- **D-02:** Hard-Delete (sofort, endgueltig, kaskadierend) — KEIN Soft-Delete bei Self-Loeschung.
- **D-03:** Passwort-Bestaetigung erforderlich (Muster: auth.js:177-210 change-password mit bcrypt.compare).
- **D-04:** Loesch-Logik wiederverwendet die bestehende kaskadierende Konfi-Loeschung (konfi-management.js:342-387, 16 Tabellen) — als gemeinsame Funktion extrahieren, damit Self-Delete + Admin-Delete + Auto-Delete dieselbe Logik nutzen.
- **D-05:** Frontend: Bestaetigungs-Dialog mit Passwort-Eingabe + klarer Warnung ("endgueltig, nicht rueckgaengig"). useIonModal-Pattern. Danach Logout + Redirect zum Login.

### Auto-Loeschung — Fristen ab Konfirmationsdatum (AD)
- **D-06:** Basis ist `jahrgaenge.confirmation_date`. Wird PFLICHTFELD beim Jahrgang-Anlegen UND -Bearbeiten (aktuell optional, jahrgaenge.js:15/26/63 `.optional()` entfernen, Migration setzt NOT NULL nach Backfill).
- **D-07:** **Tag 0-60 (ab confirmation_date):** Konfi normal sichtbar. RETTUNGSFENSTER — Leitung kann via promote-teamer (konfi-management.js:912) zum Teamer machen. Keine Aenderung am Verhalten.
- **D-08:** **Tag 60:** SOFT-LOESCHUNG. Konfi wird archiviert und ist KOMPLETT UNSICHTBAR in allen Ansichten — auch fuer die Leitung kein Zugriff mehr (nur DB-Ebene). Ohne Erklaerung/Benachrichtigung an die Nutzer. Ab hier KEIN Promote-to-Teamer mehr moeglich (Fenster war Tag 0-60).
- **D-09:** **Tag 120:** ECHTE LOESCHUNG. Kaskadierend endgueltig (dieselbe Loesch-Funktion wie D-04).
- **D-10:** AUSNAHME: Konfis, die zu Teamer:innen promotet wurden (role_id != konfi-Rolle, `teamer_since` gesetzt), werden NIE auto-geloescht — weder Soft noch Hard. Die Frist gilt nur fuer aktive Konfis.

### Soft-Delete-Mechanik (SDM)
- **D-11:** Soft-Delete-Spalte auf `users` (oder `konfi_profiles`) — Planner entscheidet wo sauberer, vermutlich `users.deleted_at TIMESTAMP NULL` + ggf. `archived_at`. Muster existiert: chat_messages.deleted_at (chat.js:1428).
- **D-12:** ALLE Konfi-Queries muessen `deleted_at IS NULL` filtern, damit archivierte Konfis ab Tag 60 ueberall unsichtbar sind (Listen, Detail, Ranking, Chat, Events, Stats, Wrapped). Vollstaendigkeit ist kritisch — kein Query darf den Filter vergessen.

### Cron-Job (CR)
- **D-13:** Taeglicher Cron-Job (node-cron `'0 2 * * *'`, timezone Europe/Berlin). Muster: backgroundService.js startWrappedCron (Zeile 415-434).
- **D-14:** Job prueft taeglich: fuer jeden Jahrgang mit confirmation_date — welche Konfis haben Tag 60 (-> deleted_at setzen) bzw. Tag 120 (-> kaskadierend hard-deleten) ueberschritten. Teamer-Ausnahme (D-10) beachten.
- **D-15:** Idempotent + transaktional. Fehler pro Jahrgang/Konfi loggen, nicht den ganzen Job abbrechen.

### Claude's Discretion
- Genaue Spalten-Namen + Tabelle fuer Soft-Delete (users vs konfi_profiles).
- Refactoring der kaskadierenden Loesch-Logik in eine gemeinsame Util-Funktion.
- Exakte Query-Stellen die den deleted_at-Filter brauchen (Planner mappt vollstaendig).
- Backfill-Strategie fuer confirmation_date NOT NULL (bestehende Jahrgaenge ohne Datum).
</decisions>

<canonical_refs>
## Canonical References

- `backend/routes/konfi-management.js:342-387` — bestehende kaskadierende Konfi-Loeschung (16 Tabellen), Vorlage fuer gemeinsame Loesch-Funktion
- `backend/routes/konfi-management.js:912-1006` — promote-teamer (Rettungsfenster, behaelt konfi_profiles + Badges)
- `backend/routes/auth.js:177-210` — change-password, Vorlage fuer Self-Service + Passwort-Bestaetigung
- `backend/routes/jahrgaenge.js:15,26,63` — confirmation_date Validierung (optional -> Pflicht) + INSERT/UPDATE
- `backend/routes/chat.js:1428` — Soft-Delete-Muster (deleted_at)
- `backend/services/backgroundService.js:415-434` — Cron-Muster (startWrappedCron, node-cron Europe/Berlin)
- `init-scripts/01-create-schema.sql` — Schema (jahrgaenge, users, konfi_profiles)
- `frontend/src/` — useIonModal-Pattern fuer Bestaetigungs-Dialog (siehe CLAUDE.md Modal-Regeln)

</canonical_refs>

<code_context>
## Existing Code Insights

- Bestehende Admin-Loeschung loescht ueber 16 Tabellen in Transaktion (BEGIN/COMMIT/ROLLBACK via db.getClient()).
- chat_messages nutzt bereits deleted_at Soft-Delete mit `AND deleted_at IS NULL` Filter — bewaehrtes Muster im Code.
- promote-teamer behaelt konfi_profiles + user_badges bewusst (Kommentar im Code) und setzt teamer_since=CURRENT_DATE, role_id wechselt. Das ist der Marker fuer die Teamer-Ausnahme.
- backgroundService.js hat etablierte Service-Registrierung (startAllServices) + node-cron fuer Wrapped. Neuer Auto-Delete-Service reiht sich dort ein.
- confirmation_date wird schon im Konfi-Dashboard genutzt (konfi.js:47) und fuer Wrapped-Trigger (backgroundService.js:461) — also vorhanden, nur nullable.

</code_context>

<specifics>
## Specific Ideas

- Apple App Store Review Guideline 5.1.1(v) verlangt In-App-Account-Loeschung bei Apps mit Account-Anlage — Self-Loeschung erfuellt das (war Launch-Risiko, siehe session_30mai_launch Punkt 7).
- DSG-EKD (kirchliches Datenschutzrecht) verlangt Datenaufbewahrungsfristen — die 60/120-Tage-Logik ab Konfirmation erfuellt das.

</specifics>

<deferred>
## Deferred Ideas

- Konfi-/Personen-Limits pro Org (Tarif-Durchsetzung, +5-Grace) — eigene Phase, siehe konfi_limits_konzept im Memory.
- Kirchenkreis-Hierarchie (parent_organization_id, Multi-Org-Admin) — nach Launch.
- Benachrichtigung/Export der eigenen Daten vor Loeschung (DSGVO Art. 20 Datenportabilitaet) — falls spaeter gefordert.

</deferred>
