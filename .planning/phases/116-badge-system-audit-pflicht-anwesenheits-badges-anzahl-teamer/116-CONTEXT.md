# Phase 116: Badge-System-Audit + Pflicht-Anwesenheits-Badges - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning
**Mode:** Discuss (Audit-gestuetzt, Entscheidungen mit Inhaber abgestimmt)

<domain>
## Phase Boundary

Erweiterung des bestehenden Badge-Systems um zwei Badge-Typen plus Reparatur der prozentualen
Fortschrittsanzeige:
1. **Pflicht-Anwesenheits-Badge** (NEU): zaehlt die ANZAHL besuchter Pflicht-Events.
2. **Teamer-Jahre-Badge** (EXISTIERT, wird korrigiert): aktive Teamer-Jahre, Startjahr ab Promotion.
3. **Prozent-Bug-Fix**: Fortschrittsanzeige funktioniert fuer mehrere criteria_types nicht (0%).

Vollstaendige Bestandsaufnahme: siehe 116-AUDIT.md (gleiche Verzeichnis).

NICHT in dieser Phase: Pflicht-Flag auf Aktivitaeten (nur Events zaehlen), Badge-Entzug bei
Schwellwert-Anhebung, neue prozentuale Pflicht-Anzeige (nur absolute Anzahl).
</domain>

<decisions>
## Implementation Decisions

### Pflicht-Anwesenheits-Badge (PFL)
- **D-01:** Neuer `criteria_type = 'mandatory_event_count'` in CRITERIA_TYPES (badges.js:9-91).
  Zaehlt NUR absolute Anzahl (criteria_value = Schwelle, z.B. 12), KEIN Prozent gegen Gesamtzahl.
- **D-02:** Gezaehlt werden AUSSCHLIESSLICH Events mit `events.mandatory = true` und
  `event_bookings.attendance_status = 'present'`. KEINE Pflicht-Aktivitaeten (Aktivitaeten haben
  kein mandatory-Flag — bewusst NICHT eingefuehrt, out of scope).
  Zaehl-Query: `event_bookings eb JOIN events e ON eb.event_id = e.id
  WHERE eb.attendance_status='present' AND e.mandatory=true AND eb.user_id=$1 AND eb.organization_id=$2`.
- **D-03:** target_role = 'konfi' (Pflicht-Anwesenheit ist ein Konfi-Badge).
- **D-04:** Pflicht-Events zaehlen fuer Badges, OBWOHL sie punktneutral sind (events.js:355 vergibt
  keine Punkte bei mandatory). Punkte und Badge-Zaehlung sind hier bewusst entkoppelt.
- **D-05:** Die Leitung setzt den Schwellwert (criteria_value) frei und kann ihn nachtraeglich
  korrigieren (z.B. von 12 auf 11 bei Event-Ausfall). Das ist der bestehende Badge-Edit-Pfad
  (badges.js:763 PUT). Beispiel-Kontext: 10 Pflicht-Samstage + 2 Pflicht-Gottesdienste = max 12.

### Schwellwert-Aenderung (THR)
- **D-06:** Bei Schwellwert-Aenderung bleiben bereits vergebene Badges bestehen (KEIN Entzug —
  entspricht dem bestehenden Verhalten: Badges werden nur per INSERT vergeben, badges.js:607-639).
  Wer den NEUEN (z.B. gesenkten) Schwellwert erreicht, bekommt das Badge ab der naechsten Wertung.
  Senken (12->11) gibt mehr Konfis das Badge; Anheben entzieht NIEMANDEM etwas. KEINE Entzugs-Logik
  bauen.

### Teamer-Jahre-Badge (TEA)
- **D-07:** `criteria_type = 'teamer_year'` existiert bereits mit korrekter kumulativer,
  Luecken-ueberspringender Logik (badges.js:405-466): zaehlt Jahre mit >= 1 begleiteter Aktion,
  Luecken erlaubt. Beispiel: Jahr1 Aktion -> 1, Jahr2 Aktion -> 2, Jahr3 nichts, Jahr4 Aktion -> 3.
- **D-08:** FIX Startjahr-Quelle: Statt der NICHT-EXISTENTEN Tabelle `user_role_history`
  (badges.js:413-419, faellt aktuell per try/catch auf aelteste Aktivitaet zurueck) wird
  `users.teamer_since` (DATE, existiert seit Migration 064) als Startjahr genutzt. Nur Jahre
  >= YEAR(teamer_since) zaehlen. Falls teamer_since NULL (Altdaten): Fallback auf aelteste
  Teamer-Aktivitaet wie bisher beibehalten.
- **D-09:** target_role = 'teamer'.

### Prozent-Bug-Fix (PCT) — VOLLER UMFANG
- **D-10:** Fehlende `case`-Zweige im Progress-switch (konfi.js:921-1136) ergaenzen:
  `event_count`, `teamer_year` UND der neue `mandatory_event_count`. Ohne diese bleibt
  progress.current = 0 -> dauerhaft "0% - In Arbeit" trotz realem Fortschritt.
- **D-11:** Extra-Feld-Mismatch beheben: Progress-Query fuer `specific_activity` (konfi.js:992
  nutzt activity_id) und `activity_combination` (konfi.js:1039 nutzt activity_ids) auf dieselben
  Schluessel umstellen, die die WERTUNG nutzt: `required_activity_name` bzw. `required_activities`
  (badges.js:205, :216). Sonst bleibt der Fortschritt dieser Typen bei 0.
- **D-12:** Teamer-Badges-Progress: pruefen, ob GET /konfi/badges nur Konfi-Badges liefert
  (konfi.js:906 filtert target_role='konfi') und ob Teamer ueberhaupt einen Progress-Endpoint
  haben. Falls Teamer-Badges keinen Progress bekommen, ist der teamer_year-Progress dort zu
  ergaenzen (Planner mappt die genaue Stelle: frontend teamer BadgesView + zugehoeriger Endpoint).
  Befund (Plan-Check): Teamer-Progress laeuft ueber separaten Endpoint teamer.js:257-373.
- **D-13:** (Plan-Check-Ergaenzung, gleicher Bug-Kreis) Bestehender activity_count-Progress-Mismatch
  mitfixen: konfi.js:971-977 zaehlt nur user_activities, die Wertung (badges.js:266) addiert
  activityCount + eventCount. Da wir den Progress-switch ohnehin anfassen (D-10), wird der
  activity_count-Progress um die Event-Zaehlung ergaenzt, sodass Wertung == Progress. Gehoert zum
  Phasen-Ziel "Prozent-Bug fixen".

### Claude's Discretion
- Genaue Migration-Nummer falls eine noetig ist (vermutlich KEINE — kein Schema-Umbau, nur Code).
- Ob toter Frontend-Fallback (KonfiBadgesPage.tsx:135) + tote Filter collection/yearly
  (BadgesView.tsx:341-342) mit aufgeraeumt werden (nice-to-have, nicht zwingend).
- Modal-Details fuer den neuen Typ: getValueLabel (BadgeManagementModal.tsx:713), Default-Farbe
  (:217), Freischaltung in der Konfi-Typ-Auswahl (:1009).
- Ob der neue Typ auch in der Teamer-Variante sinnvoll waere (vermutlich nein, nur Konfi).
</decisions>

<canonical_refs>
## Canonical References

- `.planning/phases/116-.../116-AUDIT.md` — vollstaendige Bestandsaufnahme (MUSS gelesen werden)
- `backend/routes/badges.js:9-91` — CRITERIA_TYPES (neuer Typ hier ergaenzen)
- `backend/routes/badges.js:99-312` — checkAndAwardBadges (Konfi-Branch Wertung, neuer Case)
- `backend/routes/badges.js:317-552` — checkAndAwardTeamerBadges (teamer_year-Wertung, Startjahr-Fix)
- `backend/routes/badges.js:405-466` — teamer_year-Logik (Luecken-ueberspringend, user_role_history-Bug)
- `backend/routes/badges.js:732,763` — Badge POST/PUT (Erstellung/Edit, Schwellwert-Korrektur)
- `backend/routes/konfi.js:882-1172` — GET /konfi/badges Progress-Berechnung (Prozent-Bug, fehlende Cases)
- `backend/routes/konfi.js:992,1039` — Extra-Feld-Mismatch specific_activity/activity_combination
- `backend/routes/events.js:355` — Pflicht-Events punktneutral (mandatory)
- `backend/routes/events.js:26,34,66,270,525` — events.mandatory Verwendung
- `backend/services/backgroundService.js:17-30,75,108` — Badge-Cron (5 Min, updateAllUserBadges)
- `frontend/src/components/admin/modals/BadgeManagementModal.tsx` — Badge-Erstellungs-Modal
  (Typ-Auswahl :1009-1014, TEAMER_HIDDEN_TYPES :255, getValueLabel :713, Default-Farbe :217)
- `frontend/src/components/konfi/views/BadgesView.tsx:244,257,548,624` — Prozent-Anzeige
- `frontend/src/components/konfi/pages/KonfiBadgesPage.tsx:132-135,166-167` — Progress-Mapping + toter Fallback
- `users.teamer_since` (Migration 064_consolidate_inline_schemas.sql:108, DATE) — Teamer-Startjahr-Quelle

</canonical_refs>

<code_context>
## Existing Code Insights

- Badge-Definitionen in `custom_badges` (NICHT `badges`), Zuordnung `user_badges` (UNIQUE user+badge).
- criteria ueber criteria_type + criteria_value (Schwelle) + criteria_extra (JSONB) + target_role.
- 14 criteria_types existieren. Wertung via switch in checkAndAwardBadges (Konfi/Teamer getrennt).
- Pflicht-Events VOLLSTAENDIG modelliert: events.mandatory BOOLEAN + event_bookings.attendance_status.
  Pflicht-Events sind punktneutral (events.js:355). Zaehlung "nur Pflicht" fehlt nur als Code-Pfad.
- teamer_year existiert mit korrekter Luecken-Logik, liest aber nicht-existente user_role_history.
- Badges werden NUR vergeben (INSERT), nie entzogen — passt zu D-06.
- Cron alle 5 Min + bei Aktionen ruft checkAndAwardBadges. Neuer Typ reiht sich automatisch ein,
  sobald der switch-Case da ist.
- Prozent-Bug: Progress-switch in konfi.js fehlen Cases -> progress.current bleibt 0.
- target_role trennt Konfi/Teamer-Badges sauber. Neue Typen target_role-spezifisch.
- vitest-Test-Infra vorhanden (tests/helpers, `npx vitest run --config tests/vitest.config.ts`).
  Test-DB-Container backend-test-db-1 auf Port 5433. Tests mitschreiben (Projekt-Feedback).
- KEINE Schema-Migration noetig (alle Spalten existieren) — reiner Code-Plan.

</code_context>

<specifics>
## Specific Ideas

- Beispiel-Setup des Inhabers: 10 Pflicht-Samstage + 2 Pflicht-Gottesdienste = max 12. Bei Ausfall
  korrigiert die Leitung den Schwellwert (12->11). Motivation: "alle 12" vs. Teil-Badges.
- "Konfis" ist Plural, NICHT gendern. Teamer:innen gendern. Echte Umlaute, keine Emojis.
- Pflicht-Anwesenheits-Badge nur absolute Anzahl, weil sich die Pflicht-Event-Zahl im Betrieb
  aendert — Prozent gegen eine bewegliche Gesamtzahl waere fehleranfaellig.

</specifics>

<deferred>
## Deferred Ideas

- mandatory-Flag auf Aktivitaeten (Pflicht-Aktivitaeten mitzaehlen) — eigene Phase falls gewuenscht.
- Badge-Entzug bei Schwellwert-Anhebung — bewusst NICHT (D-06).
- Prozentuale "X von Y Pflicht-Events"-Darstellung ueber Serien (series_id) — nur absoluter
  Zaehler in dieser Phase.
- Aufraeumen toter Filter collection/yearly (BadgesView) — optional, Claude's Discretion.
- user_role_history tatsaechlich anlegen + bei Promotion befuellen — nicht noetig, teamer_since reicht.

</deferred>
