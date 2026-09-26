# Audit Backend-Fachlogik A — Punkte, Aktivitäten, Termine, Jahrgänge, Abzeichen, Level — 26.09.2026

## Umfang und Methode

**Geprüft (vollständig gelesen):** `backend/routes/konfi.js`, `konfi-management.js`,
`activities.js`, `jahrgaenge.js`, `levels.js`, `badges.js` (Wertung, Zeilen 1–680,
Verwaltungsrouten nur punktuell), `routes/events/*` (index, verwaltung, lesen,
teilnehmer, anwesenheit, checkin, serien, buchung, validierung),
`utils/bookingUtils.js`, `badgeProgress.js`, `konfiBadgeProgress.js`,
`teamerBadgeProgress.js`, `abzeichenKandidaten.js`, `badgeKategorieRegel.js`,
`badgeEventRule.js`, `streakCalculation.js`, `levelFortschritt.js`,
`terminAnmeldeStatus.js`, `nachrueckMeldung.js`, `antragIdempotenz.js`,
`punkteHistorie.js`, `konfiLimit.js`, `pointTypeGuard.js`, `jahrgangsZugriff.js`,
`badgeAntwortV2.js`, `konfiDeletion.js`; dazu `routes/teamer.js` (Badge- und
Profilrouten), `services/backgroundService.js` (Kandidatenauswahl des
Abzeichenlaufs), `docs/wissen/abzeichen.md`, `docs/wissen/zaehler.md`,
`docs/offene-befunde.md`, Handbuch-Kapitel 70-termine, 45-jahrgaenge, 05-rollen,
`docs/api/konfis-events.yaml` (punktuell), `docs/api/ABRISS.md`. Frontend nur als
Vertragspartner: `services/writeQueue.ts`, `konfi/views/EventDetailView.tsx`,
`admin/modals/ParticipantManagementModal.tsx` sowie der Stand des Store-Tags
`2.2.0` (18.09.2026) für die Felder, die die ausgelieferte App aus meinen Routen
liest.

**Wie:**
- **Reproduktion mit temporärer Vitest-Datei** (14 Tests, Datenbank-Port 5434,
  gegen `createApp` mit Seed-Daten). Die Datei ist aus dem Repo entfernt; eine
  Kopie liegt zur Nachprüfung im Scratchpad der Koordination
  (`scratchpad/backend-fachlogik-punkte-termine/zzz_audit_fachlogik_tmp.test.js`,
  Messwerte in `audit-werte.log`). Nach `backend/tests/routes/` kopieren und mit
  `TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:<PORT>/postgres npx vitest run --config tests/vitest.config.ts tests/routes/zzz_audit_fachlogik_tmp.test.js`
  laufen lassen.
- **Bestehende Suiten gezielt ausgeführt** (Port 5434): `buchungKern.test.js`
  (40 Tests, darunter drei zu gleichzeitigen Buchungen), `nachrueckenLuecken`,
  `absageMeldetAb`, `absageZuruecknehmen`, `rbacTermine`,
  `anwesenheitZuruecksetzen` (zusammen 125 Tests) — alle grün.
- **Server gestartet** (Port 6434) gegen eine eigene Datenbank `konfi_audit`
  (Produktions-Schema + 36 offene Migrationen + Seed + synthetische Menge:
  161 Nutzer, 304 Termine, 18.000 Buchungen, 9.600 Punktebelege) und die
  Listen-Endpunkte mit `curl` gemessen; `EXPLAIN (ANALYZE, BUFFERS)` auf das
  Nachrück-Subselect und die Sicht `event_booking_stats`.
- **Schema-Prüfung** per `psql` (Spaltentypen, CHECK-Constraints, Indizes,
  Fremdschlüssel-Kaskaden).
- **Vertragsvergleich** `git diff 2.2.0 HEAD -- backend/routes` (alle entfernten
  Zeilen einzeln angesehen) und `git grep` im Frontend-Stand 2.2.0.

**Bewusst nicht geprüft:** `categories.js` (nur überflogen), die
Badge-Verwaltungsrouten (POST/PUT/DELETE ab `badges.js:680`, nur Validierung
nachgesehen), Push-Wortlaute und Postfach-Nebeneffekte (eigener Bereich),
Chat-Nebeneffekte (`eventChat`), Wrapped, Challenges, E2E, die Darstellung im
Frontend, konkrete Sommerzeit-Umstellungen (nur Schema und Code), Produktion
(kein Zugang).

## Zusammenfassung

13 Befunde: **0 KRITISCH, 2 HOCH, 7 MITTEL, 4 NIEDRIG.** Kein Vertragsbruch
gegenüber den Store-Apps 2.2.x gefunden — die Diff seit Tag 2.2.0 enthält in
meinen Routen ausschließlich additive Felder; die einzige Feldreduktion
(`series_events`) liest die 2.2.0-App nachweislich nicht. Der Buchungskern,
das Nachrücken und die Absage-Logik sind solide und durch Tests abgesichert;
die gleichzeitige Buchung des letzten Platzes ist korrekt gesperrt.

Die drei tragendsten Punkte: **(1)** `DELETE /api/events/:id/book` steht Konfis
offen und kennt weder den Pflichttermin-Riegel noch die im Handbuch
versprochene Zwei-Tage-Frist — ein Konfi kann damit einen eingetragenen
„abwesend“-Vermerk der Leitung löschen (BF-01). **(2)** Wird der Punktwert
einer Aktivität nachträglich geändert, zieht jede Rücknahme den *neuen* Wert
ab und die Punktehistorie zeigt den neuen Wert — der Saldo stimmt dann
dauerhaft nicht mehr (BF-02). **(3)** Die Offline-Wiederholung einer
Abmeldung über `DELETE /konfi/events/:id/register` antwortet 400 statt
`bereits_abgemeldet`; die App meldet dann einen Fehlschlag für eine
Abmeldung, die längst gelungen ist (BF-03) — der Fix vom 28.08.2026 greift für
diese Route nicht.

## Release-Empfehlung für den Bereich

**Mit Auflage.** BF-01 vor dem Release schließen (kleiner Eingriff: in
`routes/events/buchung.js` für `req.user.type === 'konfi'` dieselben drei
Riegel wie in `konfi.js` — Pflichttermin, Frist, Protokoll — oder Konfis auf
die Konfi-Route verweisen). BF-03 ist ein Zweizeiler (Vorab-Check in konfi.js
auf „bereits abgemeldet“ prüfen) und sollte mit. BF-02 braucht eine additive
Migration (Punktwert am Zuordnungsdatensatz speichern) und gehört in die
nächste 2.3.x-Fassung; bis dahin sollte das Handbuch warnen, Punktwerte
bestehender Aktivitäten nicht zu ändern.

## Befunde

### BF-01: `DELETE /events/:id/book` umgeht für Konfis Pflichttermin-Riegel, Abmeldefrist und Anwesenheitsvermerk
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/events/buchung.js:101-166` (Rolle Konfi
  zugelassen in Zeile 105-108, keine Prüfung auf `mandatory`, `event_date`,
  `attendance_status`); Vergleich `backend/routes/konfi.js:1638-1645`
  (Pflicht-Riegel), `:1671-1680` (Zwei-Tage-Frist), `:1732-1735`
  (Protokoll `event_unregistrations`); Zusage im Handbuch
  `docs/handbuch/70-termine.md:279-282`.
- **Kennzeichnung:** reproduziert (temporärer Test T1a/T1b, s. Umfang).
- **Beschreibung:** Die Konfi-App nutzt `/konfi/events/:id/register`
  (`EventDetailView.tsx:200`), das drei Regeln durchsetzt: Pflichttermine nur
  per Opt-out, Abmelden nur bis zwei Tage vorher, Protokoll in
  `event_unregistrations`. Die generische Route `DELETE /api/events/:id/book`
  ist mit einem Konfi-Token ebenso erreichbar, prüft aber nur „gibt es eine
  Buchung“ und löscht sie — einschließlich eines von der Leitung gesetzten
  `attendance_status`, auch nach dem Termin. Ein Konfi mit API-Kenntnis (der
  Token liegt in der App) kann so eine eingetragene Fehlzeit an einem
  Pflichttermin entfernen oder sich am Vortag ohne Spur abmelden.
- **Auswirkung aus Nutzersicht:** Die Anwesenheitsführung der Leitung ist
  nicht verlässlich: Ein „unentschuldigt gefehlt“ an einem Pflichttermin kann
  von der betroffenen Person selbst gelöscht werden; die Anwesenheitsmatrix
  zeigt sie danach als nie angemeldet. Die Frist, auf die sich das Handbuch
  festlegt, gilt faktisch nicht.
- **Beleg:** Pflichttermin (id 2) auf gestern gesetzt, Buchung `confirmed`,
  Leitung setzt `absent` (200). `DELETE /api/konfi/events/2/register` → **400**
  „Pflicht-Events können nur über Opt-out abgemeldet werden“.
  `DELETE /api/events/2/book` → **200** „Buchung erfolgreich storniert“, Buchung
  danach: `null`. Freiwilliger Termin morgen: Konfi-Route **400** „Abmeldung
  ist nur bis 2 Tage vor dem Event möglich“, `/book` **200**;
  `event_unregistrations`: 0 Zeilen.
- **Empfehlung:** In `buchung.js` für Konfis vor dem Löschen dieselben drei
  Prüfungen wie in `konfi.js` ausführen (oder den Konfi-Zweig ganz an die
  Konfi-Route delegieren); Test für den verbotenen (Pflicht, Frist, verbucht)
  und den erlaubten Fall.

### BF-02: Nachträglich geänderter Punktwert einer Aktivität verfälscht Rücknahme und Historie
- **Schwere:** HOCH
- **Fundstelle:** `backend/routes/konfi-management.js:1396-1403` (liest
  `a.points` der Aktivität, nicht den vergebenen Wert), `:1441-1447`
  (zieht diesen Wert ab); `backend/routes/activities.js:503-509`
  (Antrag zurücksetzen, gleiche Rechnung); `backend/utils/punkteHistorie.js:94-107`
  (Historie zeigt `a.points`); Schema `user_activities` ohne Punktspalte
  (`backend/tests/schema/prod-schema.sql:1112-1121`).
- **Kennzeichnung:** reproduziert (Test T6).
- **Beschreibung:** `user_activities` speichert nur die Zuordnung, nicht den
  gutgeschriebenen Wert. Vergeben wird der Wert zum Zeitpunkt der Zuordnung;
  zurückgenommen wird der *aktuelle* Wert der Aktivität. Ändert die Leitung
  den Punktwert (etwa von 1 auf 5), ist jede spätere Rücknahme falsch, und die
  Punktehistorie zeigt den neuen Wert, obwohl der alte gutgeschrieben wurde.
  `GREATEST(0, …)` verdeckt den Fehler, statt ihn sichtbar zu machen. Anders
  als bei `event_points` (Wert am Beleg) und `bonus_points` (Wert am Beleg)
  gibt es hier keinen Beleg des vergebenen Werts; der Saldo ist nicht mehr
  rekonstruierbar — genau die Lage, die der Code an anderer Stelle
  (`bookingUtils.js:88-91`) als das Gefährliche benennt.
- **Auswirkung aus Nutzersicht:** Ein Konfi hat nach einer Rücknahme weniger
  Punkte, als er verdient hat (im Versuch 6 statt 10), oder — bei einer
  Senkung des Werts — mehr; die Historie summiert sich nicht mehr zum
  angezeigten Stand („Ich habe Punkte eingetragen, aber es gibt keine“). Über
  Jahre und rund 100 Gemeinden wird der Fall sicher eintreten.
- **Beleg:** Saldo 10 → Aktivität (1 Punkt) zugeordnet → 11. `PUT
  /api/admin/activities/1` mit `points: 5` → Historie zeigt den Eintrag mit
  **5** Punkten bei `totals.gottesdienst` **11**. Zuordnung gelöscht →
  Saldo **6** (erwartet 10).
- **Empfehlung:** Additive Migration: `user_activities.points` und
  `user_activities.type` beim Vergeben speichern (bestehende Zeilen aus
  `activities` nachfüllen); Rücknahme, Antrags-Reset und Historie lesen den
  gespeicherten Wert. Bis dahin: Handbuch-Warnung und im Formular der
  Aktivität einen Hinweis, wenn Zuordnungen existieren.

### BF-03: Offline-Wiederholung einer Abmeldung meldet Fehlschlag, obwohl sie gelungen ist
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/konfi.js:1647-1655` (Vorab-Check antwortet
  400 „Du bist nicht für dieses Event angemeldet“) vor dem dafür gebauten
  Zweig `:1708-1717` (`bereits_abgemeldet: true`); Frontend
  `frontend/src/services/writeQueue.ts:552-559` (4xx → Item verworfen,
  Fehl-Toast, `rememberFailedAction`), Einreihung in
  `konfi/views/EventDetailView.tsx:183-197`.
- **Kennzeichnung:** reproduziert (Test T10).
- **Beschreibung:** Commit `fcd827da` (28.08.2026, „Doppelversand meldet keinen
  Fehler mehr“) hat den Wiederholungsfall für `DELETE /events/:id/book` und
  `POST …/opt-out` gelöst. Für `DELETE /konfi/events/:id/register` — die
  Route, die die Konfi-App tatsächlich einreiht — sitzt der neue Zweig
  hinter einem älteren Vorab-Check, der zuerst greift. Der Zweig
  `bereits_abgemeldet` ist für den sequenziellen Wiederholungsfall toter Code;
  er greift nur, wenn die Buchung zwischen Vorab-Check und `FOR UPDATE`
  verschwindet.
- **Auswirkung aus Nutzersicht:** Eine im Funkloch abgegebene Abmeldung, deren
  erste Antwort verloren ging, erscheint in der App als „Abmeldung von ‚…‘
  konnte nicht gesendet werden“ und landet in der Liste fehlgeschlagener
  Aktionen — obwohl die Leitung sie längst hat. Die Konfi meldet sich im
  Zweifel noch einmal oder ruft an.
- **Beleg:** `DELETE /api/konfi/events/1/register` zweimal → **200**, dann
  **400** `{"error":"Du bist nicht für dieses Event angemeldet"}`. Vergleich:
  `DELETE /api/events/1/book` zweimal → 200, **200**
  `{"bereits_storniert":true}`; `POST …/opt-out` zweimal → 200, **200**
  `{"bereits_abgemeldet":true}`.
- **Empfehlung:** Im Vorab-Check bei fehlender Buchung wie in `buchung.js`
  unterscheiden: Termin existiert → 200 `bereits_abgemeldet`, sonst 404.
  Test „zweite Abmeldung antwortet 200“ ergänzen (die Suite
  `nachrueckenLuecken` hat ihn nur für den Opt-out).

### BF-04: „Teilnehmende von Hand hinzufügen“ überbucht still; ungültiger `status` endet im 500
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/events/teilnehmer.js:29` (`status` aus dem
  Body), `:123-124` (`finalStatus = status`), `:139-219` (Kapazitäts- und
  Wartelistenprüfung nur im Zweig `status === 'auto'`), `:222` (INSERT ohne
  Werteprüfung); Frontend `admin/modals/ParticipantManagementModal.tsx:258-268`
  (`status: 'confirmed' // … übersteuert Kapazität`); Handbuch
  `docs/handbuch/70-termine.md:1073-1095` („Sonst gelten dieselben Regeln wie
  bei der Selbstanmeldung … Ist kein Platz mehr frei …, steht das in der
  Meldung“); Gegenstück `teilnehmer.js:581-622` (Bestätigen von Hand lehnt
  Überbuchung seit 16.09.2026 ausdrücklich ab).
- **Kennzeichnung:** reproduziert (Test T4).
- **Beschreibung:** Das Admin-Modal schickt immer `status: 'confirmed'`; der
  `auto`-Zweig mit Kapazität und Warteliste wird von der App nie benutzt.
  Damit verspricht das Handbuch Regeln, die nicht gelten, und die Entscheidung
  vom 16.09.2026 („abgelehnt statt still überbucht“) gilt für das Bestätigen
  von der Warteliste, nicht aber für das Hinzufügen. Außerdem wird ein
  beliebiger `status`-Wert ungeprüft in das INSERT gereicht; der
  CHECK-Constraint fängt ihn erst in der Datenbank.
- **Auswirkung aus Nutzersicht:** Zwei Personen auf einem Platz, ohne dass
  eine Zahl rot wird; die Wartenden rücken nie nach, weil der Termin
  rechnerisch überfüllt bleibt. Ein fehlerhafter Aufruf liefert
  „Datenbankfehler“ statt einer Meldung.
- **Beleg:** Termin mit `max_participants 1`, ein Konfi bestätigt.
  `POST /api/events/1/participants {user_id: 2, status: 'confirmed'}` →
  **201**; `event_booking_stats.konfi_confirmed` = **2**. Dieselbe Person über
  Warteliste → `PUT …/status {status:'confirmed'}` → **400** „Der Termin ist
  voll. Erhöhe die Teilnehmerzahl …“. `status: 'foo'` → **500**
  „Datenbankfehler“.
- **Empfehlung:** `status` auf `auto|confirmed|waitlist` validieren (400); für
  `confirmed` dieselbe Kapazitätsprüfung wie beim Bestätigen von Hand; das
  Modal auf `auto` umstellen oder die bewusste Überbuchung ausdrücklich
  anbieten und im Handbuch so beschreiben.

### BF-05: Wiederanmeldung nach Abmeldung behält den alten Wartelistenrang; Positionsanzeige widerspricht sich
- **Schwere:** MITTEL
- **Fundstelle:** `backend/utils/bookingUtils.js:1033-1047` (Reaktivierung
  setzt `booking_date = NOW()`, nicht `created_at`; Kommentar `:1028-1029`
  „Für Warteliste und Nachrücken zählt die NEUE Entscheidung“),
  `:488-499` (`promoteFromWaitlist` sortiert nach `created_at`);
  `backend/routes/konfi.js:1276-1282` (Position nach `created_at`) gegen
  `:1420-1429` (Position nach `booking_date`).
- **Kennzeichnung:** reproduziert (Test T2).
- **Beschreibung:** Die Reaktivierung einer abgemeldeten Zeile (`excused`/
  `opted_out`, seit 16.09.2026 für beide Rollen) aktualisiert `booking_date`,
  das Nachrücken ordnet aber nach `created_at` der ursprünglichen Buchung.
  Wer abgemeldet war und sich wieder anmeldet, überholt damit alle, die
  seit seiner Abmeldung warten — entgegen der im Code festgehaltenen Absicht.
  Die Konfi-Liste zeigt die Position nach `created_at`, die Status-Route nach
  `booking_date`: zwei verschiedene Zahlen für dieselbe Person.
- **Auswirkung aus Nutzersicht:** K3 wartet länger, K2 rückt nach; K2 sieht
  in der Liste „Platz 1“, im Detail „Platz 2“.
- **Beleg:** `created_at` K2 `13:56:20.32`, K3 `13:56:20.38`;
  `booking_date` K2 `11:56:20.423Z` (nach K3 `…382Z`). Position K2: Liste
  **1**, Status-Route **2**. Nach Abmeldung von K1: **K2 = confirmed,
  K3 = waitlist**.
- **Empfehlung:** Bei der Reaktivierung `created_at` mitsetzen (oder
  Nachrücken und beide Positionsabfragen auf `booking_date` umstellen — dann
  auch BF-11 mit erledigt); ein Test, der die Reihenfolge nach Reaktivierung
  festhält.

### BF-06: Konfi-Kapazität auf „unbegrenzt“ setzen lässt die Warteliste stehen
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/events/verwaltung.js:620-627`
  (`else if (max_participants > 0)` — 0 fällt durch); Gegenstück Team-Seite
  `:633-646` (`newTeamerMax === 0 || …` rückt alle Wartenden nach);
  Handbuch `docs/handbuch/70-termine.md:330-333` (Tabelle „Platz wird frei“).
- **Kennzeichnung:** reproduziert (Test T3, mit Gegenprobe Team-Seite).
- **Beschreibung:** Erhöht die Leitung die Konfi-Plätze auf eine Zahl, rücken
  Wartende nach. Stellt sie auf „unbegrenzt“ (0), rückt niemand nach —
  obwohl derselbe Aufruf für das Team-Kontingent genau das tut. Die
  Wartenden bleiben `waitlist`, während jede neue Anmeldung sofort bestätigt
  wird.
- **Auswirkung aus Nutzersicht:** Wer früh dran war und wartete, sieht später
  Angemeldete vor sich bestätigt; die Leitung muss jede Person von Hand
  bestätigen. Das ist die siebte Stelle zum behobenen Befund #9 („Warteliste
  rückte an sechs Stellen nicht nach“).
- **Beleg:** `PUT /api/events/1 {max_participants: 0, …}` → 200
  `promoted_count: 0`; K2 bleibt **waitlist**; K3 meldet sich danach an →
  **confirmed**. Team-Gegenprobe `teamer_max_participants: 0` → 200
  `promoted_teamer_count: 1`, teamer1 **confirmed**.
- **Empfehlung:** Konfi-Zweig wie der Team-Zweig behandeln (`max_participants
  === 0 || …`, Obergrenze = Zahl der Wartenden); Test.

### BF-07: Teamer-Aktivität lässt sich einer Person einer fremden Gemeinde zuordnen
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/konfi-management.js:1306` (nur die
  Aktivität org-gescopt), `:1312-1331` (Teamer-Zweig überspringt `darfKonfi`
  und damit jede Prüfung der Zielperson), `:1337-1340` (INSERT ohne
  Organisationsprüfung der `user_id`); Gegenstück `backend/routes/activities.js:767-773`
  (`assign-activity` prüft `users.organization_id`).
- **Kennzeichnung:** reproduziert (Test T5).
- **Beschreibung:** Für Aktivitäten mit `target_role = 'teamer'` gibt es keine
  Punkte und keinen Jahrgang, deshalb wurde die Zielperson gar nicht geprüft.
  Eine Leitung der Gemeinde A kann damit einer Teamer:in der Gemeinde B eine
  Zuordnung mit `organization_id` A anhängen. Die Zeile ist für Gemeinde B
  unsichtbar (alle Lesequeries filtern auf die eigene Organisation), löst aber
  einen Abzeichenlauf für die fremde Person aus (`checkAndAwardBadges(db, id)`
  in `:1365`) und bleibt als schreibender Übergriff über die Gemeindegrenze
  stehen.
- **Auswirkung aus Nutzersicht:** Heute kaum sichtbar; es ist eine Lücke in der
  Mandantentrennung auf einem Schreibweg, den die Oberfläche der Leitung
  (Konfi-Detail → Teamer-Aktivität) anbietet.
- **Beleg:** `POST /api/admin/konfis/7/activities` (teamer2, Org 2) mit einer
  Teamer-Aktivität aus Org 1 → **201**; `user_activities` für user 7:
  `{activity_id: 7, organization_id: 1}`. Vergleich `assign-activity` → **404**.
- **Empfehlung:** Vor dem Zweig die Zielperson wie in `activities.js:767`
  gegen `users.organization_id` prüfen; Test für Org-fremde Person (404) und
  eigene (201).

### BF-08: Jahrgang löschen hinterlässt Pflichttermine ohne Jahrgang und läuft ohne Transaktion
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/jahrgaenge.js:329-463` (rund zwanzig
  `db.query`-Aufrufe auf dem Pool, kein `BEGIN`); Fremdschlüssel
  `event_jahrgang_assignments.jahrgang_id … ON DELETE CASCADE`
  (`prod-schema.sql:4160`); Riegel nur beim Anlegen/Ändern
  `routes/events/verwaltung.js:98-103, 366-371` (seit 26.09.2026);
  Sichtbarkeit `routes/events/lesen.js:260-261` („Allgemeine Events … für
  alle sichtbar“), `utils/jahrgangsZugriff.js:160-162`.
- **Kennzeichnung:** reproduziert (Test T8).
- **Beschreibung:** Das Löschen prüft nur aktive Konfis und Chat-Nachrichten.
  Termine des Jahrgangs verlieren durch die Kaskade still ihre Zuordnung und
  werden zu „allgemeinen“ Terminen: für alle Leitungen und Teamer:innen ohne
  Zuweisung sichtbar und bearbeitbar; ein Pflichttermin steht danach genau
  in dem Zustand, den der Riegel vom 26.09.2026 beim Anlegen verbietet
  („Pflicht ohne Jahrgang ist ein Widerspruch“), und lässt sich nicht mehr
  speichern (400). Bricht das Löschen zwischen Chat-Aufräumen und
  `DELETE FROM jahrgaenge` ab, bleibt ein Jahrgang ohne Chat zurück.
- **Auswirkung aus Nutzersicht:** Nach dem Löschen eines alten Jahrgangs
  tauchen dessen Termine bei allen Leitungen auf; ein Bearbeiten-Versuch am
  verwaisten Pflichttermin endet mit einer Fehlermeldung, die auf den Termin
  nicht passt.
- **Beleg:** Jahrgang 3 mit Pflichttermin angelegt, `DELETE
  /api/admin/jahrgaenge/3` → 200; Termin danach `mandatory = true`,
  Jahrgangszuordnungen **0**; `GET /api/events` als Admin ohne Zuweisung
  listet ihn; `PUT` darauf → **400** `pflicht_ohne_jahrgang`.
- **Empfehlung:** Vor dem Löschen Termine mit ausschließlich diesem Jahrgang
  zählen und wie Konfis/Chat mit 409 blockieren (oder Pflichttermine
  mitlöschen/absagen lassen); die Route in eine Transaktion legen.

### BF-09: Beförderung zur Teamer:in löscht vergangene Teilnahmen
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/konfi-management.js:1573-1577`
  (`DELETE FROM event_bookings WHERE user_id = $1` — alle Buchungen, auch
  vergangene mit `attendance_status = 'present'`); Handbuch
  `docs/handbuch/05-rollen.md:261`, `30-leitung.md:65` („Punkte und
  Abzeichen bleiben als Konfi-Historie“).
- **Kennzeichnung:** reproduziert (Test T7).
- **Beschreibung:** Gemeint ist, künftige Plätze freizugeben (der Kommentar
  spricht vom Nachrücken). Gelöscht wird aber jede Buchung, auch die
  verbuchte Teilnahme an einem Termin von vor einem Jahr. Die `event_points`
  bleiben als Beleg ohne zugehörige Teilnahme stehen; die Teilnehmerliste
  des vergangenen Termins ist danach leer.
- **Auswirkung aus Nutzersicht:** Wer nachsieht, wer bei der Konfifreizeit
  2025 dabei war, findet die inzwischen beförderten Teamer:innen nicht mehr;
  im Konfi-Detail der Person stehen Event-Punkte für Termine, an denen sie
  laut Termin nie war. Die Konfi-Historie ist damit nur zur Hälfte erhalten.
- **Beleg:** Vergangener Termin, Buchung `present`, `event_points` 2 Punkte.
  `POST /api/admin/konfis/1/promote-teamer` → 200; Buchungen der Person
  **0**, `event_points` **1**; `GET /api/events/1` → `participants: []`.
- **Empfehlung:** Nur künftige Buchungen (`event_date > NOW()`) löschen und
  nachrücken lassen; vergangene stehen lassen.

### BF-10: Zielwert 0 wird als 10 ausgeliefert
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/konfi.js:299-304` (`target_gottesdienst
  || 10`); Validierung erlaubt 0 (`routes/jahrgaenge.js:23-24, 42-43`).
- **Kennzeichnung:** reproduziert (curl gegen Server 6434).
- **Beschreibung:** Speichert die Leitung einen Zielwert 0, liefert das
  Dashboard in `point_config` 10, im selben Objekt unter `konfi` aber 0.
- **Auswirkung aus Nutzersicht:** Der Fortschrittsbalken der Konfi rechnet
  gegen ein Ziel, das die Leitung nie gesetzt hat.
- **Beleg:** `target_gottesdienst` in DB 0 → `point_config.target_gottesdienst`
  **10**, `konfi.target_gottesdienst` **0**.
- **Empfehlung:** `?? 10` statt `|| 10`, oder 0 in der Validierung ausschließen
  (`min: 1`).

### BF-11: `event_bookings.created_at` ist TEXT und dient als Reihenfolge-Schlüssel der Warteliste
- **Schwere:** NIEDRIG
- **Fundstelle:** `prod-schema.sql:739` (`created_at text DEFAULT
  CURRENT_TIMESTAMP`, im Audit-Schema bestätigt); `utils/bookingUtils.js:495-499`
  (`ORDER BY eb.created_at ASC`); `routes/konfi.js:1281`, `routes/events/lesen.js:742`.
- **Kennzeichnung:** aus Code gelesen, Spaltentyp per `psql` bestätigt.
- **Beschreibung:** Die FIFO-Reihenfolge des Nachrückens hängt an einer
  Textsortierung von Zeitstempeln (`2026-09-26 13:56:20.32352+02`). Sie ist
  chronologisch, solange der Zonen-Offset gleich bleibt; in der Nacht der
  Zeitumstellung (`+02` → `+01`) sortiert der Text nach Uhrzeit statt nach
  Zeitpunkt. Ein Index auf der Spalte existiert nicht (Sortierung je Termin
  im Speicher, gemessen 0,3 ms — kein Leistungsproblem).
- **Auswirkung aus Nutzersicht:** Nur in der Umstellungsnacht denkbar falsche
  Reihenfolge; praktisch Hygiene.
- **Empfehlung:** Nachrücken und Positionen auf `booking_date` (timestamptz)
  umstellen — siehe BF-05 — oder die Spalte additiv als timestamptz
  nachziehen.

### BF-12: `series_events` in `GET /events/:id` liefert seit 22.09.2026 weniger Felder
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/events/lesen.js:778-785` (Commit
  `f586e6de`: `SELECT e.*` → fünf Felder); Store-App 2.2.0 liest
  `id, name, event_date, max_participants, registered_count`
  (`2.2.0:frontend/src/components/admin/views/EventDetailSections.tsx:541-566`).
- **Kennzeichnung:** aus Code gelesen, Verbraucher im Tag 2.2.0 per `git grep`
  geprüft.
- **Beschreibung:** Formal ein Verstoß gegen die Regel „Felder verschwinden
  nicht“ (CLAUDE.md), begründet mit einem Sicherheitsfix (`qr_token` lag für
  jeden Serientermin in der Antwort). Alle Felder, die die ausgelieferte App
  liest, sind weiter da; die Änderung ist damit unkritisch, gehört aber in
  die API-Doku als bewusste Ausnahme.
- **Empfehlung:** In `docs/api/konfis-events.yaml` bei `series_events` den
  reduzierten Feldsatz und den Grund vermerken.

### BF-13: Automatische Einschreibung in Pflichttermine beim Anlegen einer Konfi läuft nach dem COMMIT ohne Transaktion
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/konfi-management.js:301-327` (Einschreibung
  und Chat-Eintritt nach `COMMIT` auf dem Pool, Fehler nur geloggt); zum
  Vergleich `:428-522` (der Jahrgangswechsel macht dasselbe innerhalb der
  Transaktion, mit Begründung „Fehler wurden nur geloggt, niemand erfuhr
  davon“).
- **Kennzeichnung:** aus Code gelesen.
- **Beschreibung:** Scheitert die Einschreibung, existiert die Konfi, steht
  aber in keinem Pflichttermin — genau das Bild, das Simon am 26.09.2026 in
  Hennstedt gesehen hat („nur 4 von 12“), dort mit anderer Ursache.
- **Empfehlung:** Einschreibung in die Transaktion ziehen (wie beim PUT).

## Unklar

- **Migrationsstand der Produktion.** `backend/tests/schema/prod-migrations.txt`
  endet bei 123; im Repo liegen 124–159 als offen. Fehlte in Produktion
  Migration 153, liefe jedes `status = 'excused'` (Abmeldung durch die
  Leitung, Absage) auf den CHECK-Constraint und damit in einen 500er. Ob der
  Deploy alle 36 Migrationen anwendet, ist hier nicht prüfbar (siehe „Auf
  Produktion nachzumessen“).
- **Absage und Selbstabmeldung mit Verbuchung.** `meldeAlleAbBeiAbsage`
  fasst nur `confirmed`/`waitlist`. Wer sich von einem Pflichttermin
  abgemeldet hatte (`opted_out`), dann doch kam und `present` verbucht wurde,
  behält bei einer Absage `present` (`bookingUtils.js:225-235, 321-335`).
  Punkte sind nicht betroffen (Pflichttermine geben keine); die Teilnahme
  zählt aber für `mandatory_event_count`. Nicht reproduziert, weil die
  Bewertung („gewollt: die Leitung darf nach der Absage einzelne auf present
  setzen“) offen ist.
- **Check-in-Fenster endet nach dem Beginn.** `checkin.js:84-90` prüft
  `event_date ± checkin_window`; das Fenster schließt also 30 Minuten (Default)
  nach *Beginn*, nicht nach Ende. Wer zu einem zweistündigen Termin 40 Minuten
  zu spät kommt, kann nicht mehr einchecken. Ob das so gemeint ist, sagt das
  Handbuch nicht (`70-termine.md:94` nennt nur den Default).
- **`POST /events/:id/generate-qr` ohne Jahrgangsbindung** (`checkin.js:276-307`,
  nur `requireTeamer`): Eine Teamer:in kann den Check-in-Token jedes Termins
  der Gemeinde holen. Wirkung gering (Einchecken setzt eine eigene Buchung
  voraus), aber die einzige Schreibroute an Terminen ohne `darfTermin`.
- **Serienfolge der Abzeichen** (`streakCalculation.js:616-646`): endet an der
  neuesten aktiven Woche, nicht an „heute“ — eine vor Monaten gerissene Serie
  wird weiter als aktuell angezeigt (Befund 13 in `docs/wissen/abzeichen.md`,
  unverändert). Nur Anzeige, nicht gemessen.
- **Sammelverbuchung** (`anwesenheit.js:48-184`) prüft weder `cancelled` noch
  das Datum; faktisch harmlos, weil eine Absage alle auf `excused` setzt und
  die Oberfläche den Knopf erst ab Terminbeginn zeigt.
- **Sicht `event_booking_stats`** macht einen `Seq Scan` auf `users`
  (161 Zeilen, 3,5 ms je Termin). Wie sich das bei 25.000 Nutzern verhält,
  wenn die Terminliste die Sicht je Termin per LATERAL aufruft, ist hier nicht
  messbar; der Planer wird vermutlich auf den Primärschlüssel wechseln.

## Alte Befunde nachgeprüft

| Befund | Stand heute | Fundstelle / Prüfung |
|---|---|---|
| offene-befunde **#9** Warteliste rückte an sechs Stellen nicht nach | **behoben bestätigt** — plus eine siebte Stelle offen (BF-06) | `rueckeNach` an allen sechs Wegen (`anwesenheit.js:573`, `teilnehmer.js:399/567`, `konfi.js:1909`, `konfi-management.js:493/1579`, `konfiDeletion.js`); `nachrueckenLuecken.test.js` grün (Port 5434) |
| **#10** Abgesagte Termine fielen aus den Reitern | **behoben bestätigt** | `konfi.js:1304` (`cancelled IS NOT TRUE OR eb_konfi.id IS NOT NULL`), `konfi.js:1408-1410`, `lesen.js:223` (kein Filter) |
| **#11** Absage ließ Verbuchtes unangetastet | **behoben bestätigt**, transaktional | `bookingUtils.js:206-338` (Lesen, Saldo, Beleg löschen, Mengen-UPDATE in einer Transaktion des Aufrufers `verwaltung.js:1128-1217`); `absageMeldetAb.test.js` grün. Randfall `opted_out`+`present` siehe „Unklar“ |
| **#12** init-scripts vs. Produktionsschema | nicht mein Bereich, nicht geprüft | — |
| **#13** Teamer-Oberfläche bot 9 von 17 Termin-Aktionen nicht an → Terminverwaltung ist Leitungssache | **bestätigt umgesetzt** | `events/index.js:1-16`, `requireAdmin` in `verwaltung.js`, `teilnehmer.js`, `anwesenheit.js`, `serien.js`; `rbacTermine.test.js` grün |
| abzeichen.md **#1** `mandatory_event_count` unsichtbar | behoben | `konfi/views/BadgesView.tsx:112` |
| abzeichen.md **#2** geheime Teamer-Badges sichtbar | behoben | `teamer.js:280-282` (`!b.is_hidden \|\| b.earned`), v2 `available` ohne geheime |
| abzeichen.md **#3** Konfi-Statistik zählt Teamer-Badges | behoben | `konfiBadgeProgress.js:44, 238-246` |
| abzeichen.md **#4** Hilfetext `bonus_points` | behoben | `badges.js:139-142` |
| abzeichen.md **#6** deaktiviertes Badge verschwindet | behoben | `konfiBadgeProgress.js:43` |
| abzeichen.md **#7** Teamer-`activity_combination` andere Semantik | behoben | `badges.js:500-536` |
| abzeichen.md **#9** Hintergrundlauf nur mit Push-Token | behoben | `backgroundService.js:137-175` |
| abzeichen.md **#10** Teamer-mark-seen tot / PUT vs. POST | behoben | `TeamerBadgesPage.tsx:97,106` ruft `POST /teamer/badges/mark-seen` |
| abzeichen.md **#11** PUT validiert `criteria_value` nicht, 0 erlaubt | behoben | `badges.js:842, 852` (`isInt({ min: 1 })`) |
| abzeichen.md **#13** Streak endet an neuester Woche | weiter so (Anzeige) | `streakCalculation.js:616-646`, siehe „Unklar“ |
| Code-Kommentar `bookingUtils.js:435-446` (Pool statt Client) | erledigt | `verlangeClient` an allen fünf Kernfunktionen; alle Aufrufer übergeben Clients (geprüft in buchung, teilnehmer, anwesenheit, konfi, konfi-management, verwaltung) |
| CLAUDE.md-Vorfall 29.08. (`GET /teamer/badges` Array → Objekt) | Array wiederhergestellt, v2 versioniert | `teamer.js:267-297` (Array + Kopfzeilen), `:305-320` (v2); Store-App 2.2.0 ruft ausschließlich `/badges/v2` (`git grep` im Tag) |

## Geprüft und in Ordnung

- **Gleichzeitige Buchung des letzten Platzes** — `buchungKern.test.js`
  „Zwei gleichzeitige Buchungen“ (3 Tests: book, register mit Zeitslot,
  register mit Warteliste) grün auf Port 5434; Sperre `FOR UPDATE` auf
  `events` und `event_timeslots` in `bucheTermin` (`bookingUtils.js:827-836,
  995-1000`).
- **Doppel-Nachrücken bei gleichzeitigem Freiwerden** — `FOR UPDATE OF eb SKIP
  LOCKED` (`bookingUtils.js:488-512`); `nachrueckenLuecken.test.js` „Zwei
  Anfragen gleichzeitig“ grün; EXPLAIN ANALYZE des Subselects 0,32 ms.
- **Doppelte Punktevergabe an Terminen** — `UNIQUE (konfi_id, event_id)` auf
  `event_points` (`prod-schema.sql:3040`) plus `ON CONFLICT DO NOTHING` mit
  `rowCount`-Prüfung in Einzel-, Sammel- und QR-Weg (`anwesenheit.js:120-132,
  496-510`, `checkin.js:191-202`). Gleichzeitige Rücknahmen in
  `anwesenheit.js` serialisieren über das UPDATE der Buchungszeile (`:432`),
  das vor dem Lesen der Punkte steht — kein doppelter Abzug (aus Code
  gelesen, Reihenfolge nachvollzogen).
- **Negative oder Null-Bonuspunkte** — 400 (`middleware/validation.js:43`,
  Test T9: −5 → 400, 0 → 400).
- **Punkte über Gemeindegrenzen** — Bonuspunkte (`darfKonfi` +
  Organisationsfilter im UPDATE, `konfi-management.js:1160-1191`),
  Direktzuweisung (`activities.js:767-773`), Konfi-Aktivitäten
  (`konfi-management.js:1320-1331`); einzige Ausnahme BF-07.
- **Punkte an Konfis fremder Jahrgänge** — `darfKonfi` in allen Vergabe- und
  Rücknahmewegen (`konfi-management.js:1160, 1259, 1320, 1414`,
  `activities.js:493, 591, 793`); org_admin ausgenommen wie in der Sollregel.
- **Deaktivierte Punktarten je Jahrgang** — `checkPointTypeEnabled` vor jeder
  Vergabe; Gesamtpunkte, Level und Punkte-Abzeichen zählen nur aktivierte
  Arten (`konfi.js:111-112`, `levels.js:256-259`, `badges.js:264-283`,
  `konfiBadgeProgress.js:135-139`).
- **Absage und Zurücknahme** — Punkte-Rücknahme, Statuswechsel und
  Herkunftskennzeichen in einer Transaktion; Zurücknahme stellt je Person
  den alten Status wieder her, gibt keine Punkte zurück, rückt an
  abgesagten Terminen niemanden nach (`absageMeldetAb`, `absageZuruecknehmen`
  grün; `bookingUtils.js:206-424, 469-474`).
- **Pflichttermine** — keine Punkte, keine Zeitfenster, keine Warteliste
  serverseitig erzwungen (`verwaltung.js:178-186, 397-418`, `serien.js:66-72`);
  Auto-Einschreibung idempotent (`ON CONFLICT`); Pflicht ohne Jahrgang beim
  Anlegen/Ändern abgewiesen (`verwaltung.js:98-103, 366-371`).
- **Serien** — Anmeldefenster als Millisekunden-Abstand über Monatsgrenzen
  (`serien.js:176-182`), Auto-Einschreibung je Termin (`:301-315`),
  `qr_token` nicht mehr in `series_events` (`lesen.js:778-785`).
- **QR-Check-in** — Token in keiner Konfi-Antwort (`konfi.js:1338`,
  `lesen.js:328, 881`; die Status-Route gibt nur benannte Felder zurück);
  Zeitfenster vollständig in SQL mit `timestamptz` (`checkin.js:84-90`);
  zweiter Check-in → 200 `already_checked_in` ohne zweite Punkte;
  `opted_out`/`excused`/`waitlist` abgewiesen (`:117-150`); Punkte nur an
  Konfis und nur an freiwilligen Terminen (`:185`).
- **Idempotenz** — Anträge über `client_id` mit Vorab-Check und 23505-Fang
  (`antragIdempotenz.js`); Opt-out zweimal → 200 `bereits_abgemeldet`;
  `DELETE /events/:id/book` zweimal → 200 `bereits_storniert`; Anmeldung
  zweimal → 409, die App reiht Anmeldungen offline bewusst nicht ein
  (`EventDetailView.tsx:179-182`). Ausnahme BF-03.
- **Abzeichen** — keine Doppelvergabe (`UNIQUE uq_user_badges_user_badge` +
  `alreadyEarned`, `badges.js:214-256`); Wertung und Fortschritt aus
  gemeinsamen Quellen (`badgeEventRule`, `badgeKategorieRegel`,
  `streakCalculation`, `badgeProgress`); Rückwirkung bei Punktentzug: einmal
  verdiente Abzeichen bleiben — dokumentierte Entscheidung
  (`docs/wissen/abzeichen.md`), kein DELETE außer Badge-/Nutzerlöschung;
  Teamer-Abzeichen zählen nur Teamer-Aktivitäten (`badges.js:456-461`).
- **Level** — eine Rechnung (`levelFortschritt.js`) für Dashboard, Route und
  Push; Fortschritt auf 0–100 begrenzt.
- **Beförderung Konfi → Teamer** — Rolle, `teamer_since`, Chat-Typen,
  Konfi-Profil und Abzeichen bleiben, keine automatische Jahrgangszuweisung
  (`konfi-management.js:1557-1645`); Nachrücken auf frei werdende Plätze
  (`nachrueckenLuecken` L5 grün). Ausnahme BF-09.
- **Jahrgangswechsel einer Konfi** — Umbuchung, Chat-Wechsel, Nachrücken und
  Einschreibung in einer Transaktion (`konfi-management.js:359-524`;
  `nachrueckenLuecken` L6 grün).
- **Antwortformen gegenüber Store-App 2.2.0** — `git diff 2.2.0 HEAD` über alle
  Routen des Bereichs (270 Zeilen hinzu, 69 entfernt): entfernt wurden nur
  interne Zeilen (Push-Parameter, Foto-Streaming, Leitungs-Abfragen in Utils);
  neue Felder sind additiv (`error_code`, `cancelled_reason_set_by_name`,
  `durch_absage_abgemeldet_count`, `abgemeldet_count`, `jahrgang_ids`,
  `is_super_admin`, `assigned_user_ids`, `challengeMarks`, `offeneStempel`).
  Hüllen-Tests der Buchungsrouten grün (`buchungKern` „Antwortform beider
  Routen unverändert“). Einzige Feldreduktion: BF-12, für 2.2.0 unkritisch.
- **Laufzeiten** (Server 6434, `konfi_audit`: 304 Termine, 18.000 Buchungen,
  je fünf Aufrufe, Median):

  | Endpunkt | Median | Größe |
  |---|---|---|
  | `GET /api/konfi/events` | 86 ms | 404 kB |
  | `GET /api/konfi/events?all=true` | 39 ms | 404 kB |
  | `GET /api/events` (Leitung) | 72 ms | 445 kB |
  | `GET /api/events` (Teamer) | 56 ms | 445 kB |
  | `GET /api/events/:id` (60 Buchungen) | 21 ms | 46 kB |
  | `GET /api/konfi/dashboard` | 15 ms | 2 kB |
  | `GET /api/konfi/badges/v2` | 32 ms | 1,4 kB |
  | `GET /api/konfi/points-history` | 10 ms | — |
  | `GET /api/admin/konfis` | 5 ms | 40 kB |

  Nachrück-Subselect 0,32 ms Ausführung; `event_booking_stats` für einen
  Termin 3,5 ms. Kein N+1 mit Wirkung gefunden; die Schleifen
  (Sammelverbuchung, Beförderung, Kapazitätserhöhung) laufen innerhalb einer
  Transaktion über die Buchungen *eines* Termins bzw. *einer* Person.

## Nicht geprüft

- `routes/categories.js` (nur überflogen).
- Badge-Verwaltungsrouten (`badges.js` ab Zeile 680: Anlegen, Ändern,
  Löschen, „Abzeichen neu prüfen“) außer der Validierung.
- `routes/teamer.js` jenseits Profil- und Badge-Routen (Zusage-Route nur über
  `setzeTeamerZusage` gelesen).
- Push-Texte, Postfach, Live-Updates, Chat-Ein-/Austritte (andere Bereiche).
- Wrapped, Challenges, Material.
- Sommerzeit-Grenzfälle praktisch (BF-11 nur aus Schema abgeleitet).
- Verhalten des Hintergrundlaufs im Zeitablauf (nur Kandidatenauswahl).
- Frontend-Darstellung der hier geprüften Werte.

## Auf Produktion nachzumessen

```sql
-- Migrationsstand: fehlt 153, laeuft jede Abmeldung in den CHECK (siehe Unklar)
SELECT name FROM schema_migrations WHERE name >= '124' ORDER BY name;
SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'event_bookings_status_check';

-- BF-02: Saldo gegen die Belege (Aktivitaeten mit HEUTIGEM Wert + Bonus + Termine)
SELECT kp.user_id, kp.gottesdienst_points, kp.gemeinde_points,
       COALESCE((SELECT SUM(a.points) FROM user_activities ua JOIN activities a ON a.id = ua.activity_id
                 WHERE ua.user_id = kp.user_id AND a.type = 'gottesdienst'), 0)
     + COALESCE((SELECT SUM(points) FROM bonus_points WHERE konfi_id = kp.user_id AND type = 'gottesdienst'), 0)
     + COALESCE((SELECT SUM(points) FROM event_points WHERE konfi_id = kp.user_id AND point_type = 'gottesdienst'), 0) AS gd_belege
FROM konfi_profiles kp
WHERE kp.gottesdienst_points <> (
       COALESCE((SELECT SUM(a.points) FROM user_activities ua JOIN activities a ON a.id = ua.activity_id
                 WHERE ua.user_id = kp.user_id AND a.type = 'gottesdienst'), 0)
     + COALESCE((SELECT SUM(points) FROM bonus_points WHERE konfi_id = kp.user_id AND type = 'gottesdienst'), 0)
     + COALESCE((SELECT SUM(points) FROM event_points WHERE konfi_id = kp.user_id AND point_type = 'gottesdienst'), 0));

-- BF-05: reaktivierte Wartende (booking_date deutlich nach created_at)
SELECT id, event_id, user_id, created_at, booking_date FROM event_bookings
 WHERE status = 'waitlist' AND booking_date > created_at::timestamptz + INTERVAL '1 minute';

-- BF-06: unbegrenzte Termine mit Wartenden
SELECT e.id, e.name, COUNT(*) FROM events e JOIN event_bookings eb ON eb.event_id = e.id
 WHERE e.max_participants = 0 AND eb.status = 'waitlist' GROUP BY e.id, e.name;

-- BF-07: Zuordnungen ueber die Gemeindegrenze
SELECT ua.id, ua.user_id, ua.organization_id, u.organization_id AS heimat
  FROM user_activities ua JOIN users u ON u.id = ua.user_id
 WHERE ua.organization_id <> u.organization_id;

-- BF-08: Pflichttermine ohne Jahrgang (Bestand)
SELECT e.id, e.name, e.event_date FROM events e
 WHERE e.mandatory = true AND NOT EXISTS (SELECT 1 FROM event_jahrgang_assignments WHERE event_id = e.id);

-- BF-09: Punktebelege ohne Buchung (befoerderte Teamer:innen)
SELECT ep.konfi_id, ep.event_id, ep.points FROM event_points ep
 WHERE NOT EXISTS (SELECT 1 FROM event_bookings eb WHERE eb.event_id = ep.event_id AND eb.user_id = ep.konfi_id);

-- BF-04: Termine mit mehr Bestaetigten als Plaetzen
SELECT e.id, e.name, e.max_participants, s.konfi_confirmed FROM events e
  JOIN event_booking_stats s ON s.event_id = e.id
 WHERE e.max_participants > 0 AND s.konfi_confirmed > e.max_participants;
```

- **BF-01**: In den Zugriffslogs zählen, ob Konfi-Konten `DELETE
  /api/events/<id>/book` rufen (Vorgehen wie in `docs/api/ABRISS.md`
  beschrieben). Erwartet: 0 — jeder Treffer ist ein Umgehungsversuch.
- **BF-03**: In den Zugriffslogs `DELETE /api/konfi/events/<id>/register` mit
  Status 400 zählen; gehäufte 400er kurz nach einem 200 derselben Person
  sind Offline-Wiederholungen.
- **Unklar/Sicht**: `EXPLAIN (ANALYZE, BUFFERS)` der Terminliste
  (`GET /api/events`) gegen die echte Nutzerzahl, um den `Seq Scan` auf
  `users` in `event_booking_stats` zu bewerten.
