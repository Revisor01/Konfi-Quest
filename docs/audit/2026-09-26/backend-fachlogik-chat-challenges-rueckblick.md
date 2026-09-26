# Audit Backend-Fachlogik B (Chat, Challenges, Jahresrückblick, Postfach, Push, E-Mail, Hintergrundjobs) — 26.09.2026

## Umfang und Methode

**Geprüft (gelesen):** `backend/routes/chat.js`, `challenges.js`, `wrapped.js` (Routen-Teil 2160–3313 vollständig, Snapshot-Erzeugung stichprobenartig), `material.js` (Zugriffsregeln), `notifications.js`, `teamer.js` (Badge-Routen, Profil, Dashboard-Wrapped), `appVersion.js`, `settings.js`, `services/pushService.js` (Token-Auswahl, Versand, Wiederholung, Empfängerauswahl), `backgroundService.js` (vollständig), `emailService.js`, `losungService.js`, `push/firebase.js`, `server.js`/`createApp.js` (Socket.IO, Replika-Adapter, Cron-Leader), `middleware/rbac.js`, `utils/chatRoomAccess.js`, `jahrgangChat.js`, `teamChat.js`, `eventChat.js`, `chatSyncCache.js`, `postfachArten.js`, `postfachAufraeumen.js`, `pushGruppen.js`, `challengeNeuigkeiten.js`, `challengeSichtbarkeit.js`, `orgMitglieder.js`, `liveUpdate.js` (Empfängerauswahl), `photoCrypto.js` (Stromverschlüsselung), `storeVersion.js`, Migrationen 143/144/156/157/158, Produktionsschema (`tests/schema/prod-schema.sql`) für die betroffenen Tabellen.

**Ausgeführt:** Elf temporäre Vitest-Tests in `backend/tests/audit-tmp/` gegen die Test-Datenbank auf Port 5435 (Produktionsschema + offene Migrationen, Seed aus `helpers/seed.js`); danach gelöscht. Zusätzlich vier bestehende Suiten gezielt laufen lassen (`utils/chatRoomAccess`, `utils/socketioExpressWeiche`, `services/pushGruppenAuswahl`, `services/eventReminders`: 51 Tests, alle grün).

**Antwortformen gegenüber Store-Apps 2.2.x:** `git diff 2.2.0..HEAD` über `chat.js`, `challenges.js`, `wrapped.js`, `notifications.js`, `teamer.js` vollständig gelesen (das Repo war zu Beginn flach geklont — mit `git fetch --deepen` bis zum 23.03.2026 nachgeholt; Tag `2.2.0` = 18.09.2026, `2.1.1` = 11.09.2026). Frontend-Stand `2.2.0` per `git grep` auf die aufgerufenen Routen geprüft.

**Bewusst nicht geprüft:** die Zahlenlogik der Wrapped-Snapshots (`generateKonfiSnapshot`/`generateTeamerSnapshot`, ~1.800 Zeilen — dafür stehen 60+ Tests in `wrapped.test.js`), die Kachel-/Segen-/Kategorie-Auswahl (`wrappedKacheln.js`, `wrappedSegen.js`, `wrappedKategorien.js` — eigene Unit-Suiten), `appIconBadge.js`, `musikLinks.js`, `bibelVerszaehlung.js`, `konfspruch.js`, das Frontend über die Frage hinaus, welche Routen es ruft. Kein Zugriff auf Produktion, kein Firebase, kein SMTP — Push und Mail konnten nur bis zur Empfängerauswahl bzw. zum Aufruf geprüft werden.

## Zusammenfassung

Der Bereich ist in weiten Teilen sorgfältig gebaut: Direktchat-Privatsphäre, Socket-Beitritt, Push-Gruppen, Postfach, Alt-App-Verträge und der Vorfall vom 29.08. (versionierte Badge-Route) halten der Prüfung stand. **14 Befunde: 0 KRITISCH, 3 HOCH, 6 MITTEL, 5 NIEDRIG.** Die drei tragenden Punkte: (1) `POST /chat/rooms` nimmt den Raumtyp `direct` mit beliebig vielen Teilnehmenden an — so entsteht ein Gruppenraum, den die Leitung nach der Direktchat-Regel nicht öffnen darf, in dem zwei Konfis miteinander schreiben können (reproduziert). (2) Das Löschen eines Jahrgangs löscht per Kaskade (Migration 143/144) die Konfi-Rückblicke der beförderten Teamer:innen — das Handbuch verspricht ausdrücklich das Gegenteil (reproduziert). (3) Die Erinnerung „Morgen: Event!" geht im ersten 15-Minuten-Lauf nach Mitternacht raus, also zwischen 00:00 und 00:15 Uhr — für jeden Termin, an jede Konfi (reproduziert). Dazu kommen mehrere Lücken der Mehr-Gemeinden-Funktion (Cron-Rückblick, `/wrapped/me`, Gruppenchat-Teilnehmer), die die CHANGELOG-Zusagen von 2.3.0 an genau den Stellen unterlaufen, die nicht mit umgebaut wurden.

## Release-Empfehlung für den Bereich

**Mit Auflage.** Vor dem Release BF-01 schließen (`direct` in `POST /chat/rooms` ablehnen oder auf genau zwei Teilnehmende begrenzen — ein Einzeiler plus Bestandsabfrage) und BF-03 entscheiden (Uhrzeit der Vortags-Erinnerung); BF-02 mindestens im Löschdialog und Handbuch benennen, wenn die Kaskade nicht vor dem Release entschärft wird. Die MITTEL-Befunde zur Mehr-Gemeinden-Funktion (BF-04, BF-06, BF-08) betreffen ein 2.3.0-Hauptmerkmal und sollten in den Release-Notes nicht als vollständig beworben werden, solange sie offen sind.

## Befunde

### BF-01: Raumtyp „direct" mit mehr als zwei Teilnehmenden — Gruppenraum ohne Leitungszugriff, Konfis schreiben einander
- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — `POST /chat/rooms` nimmt `type='direct'` nur noch mit genau einer weiteren Person an (400, `direct_nur_zu_zweit`); Migration 164 stellt Bestandsräume mit mehr als zwei Personen auf `group` (Räume mit zwei oder einer Person bleiben privat). Tests für Leitung und Teamer:in mit zwei Konfis, ohne Person, mit genau einer Person (bleibt für Dritte zu), `group` (Leitung liest) und für die Migration in `chat.test.js`. Die Store-Apps 2.2.x senden kein `type='direct'` an diese Route (in Tag 2.2.0 geprüft).
- **Fundstelle:** `backend/routes/chat.js:524-535` (Typ kommt vom Client, keine Teilnehmerzahl-Prüfung), `chat.js:303-318` (`darfRaumOeffnen`: `direct` = privat, auch für die Leitung), `backend/utils/chatRoomAccess.js:55` (dieselbe Regel für Socket-Räume)
- **Kennzeichnung:** reproduziert — Test A1/A2 (temporär, gelöscht): `teamer1` sendet `POST /api/chat/rooms {type:'direct', name:'Geheim', participants:[konfi1, konfi2]}` → 200, Raum hat 3 Teilnehmende und `type='direct'`; `GET /rooms/:id/messages` als `org_admin` → **403**, als `admin` → **403**; `konfi1 POST …/messages` → 200, `konfi2 GET …/messages` → 200 mit dieser Nachricht. Gegenprobe A2: derselbe Raum als `group` → `org_admin` 200.
- **Beschreibung:** Der Client bestimmt den Raumtyp frei; `direct` wird nur für Konfis eingeschränkt (dürfen *nur* `direct`), für Team und Leitung nicht. Ein Raum mit Typ `direct` gilt anschließend überall als Zweiergespräch — die Leitung darf ihn weder lesen noch exportieren, keine Nachricht darin löschen, keine Umfrage stellen (`darfRaumOeffnen`, Handbuch `90-chat.md:147-161`). Die Regel „Konfi-zu-Konfi-Chats gibt es nicht" (`chat.js:456`) greift nur gegen Konfis als Ersteller:innen; wer als Teamer:in zwei Konfis in einen `direct`-Raum setzt, schafft genau das. Der echte Direktchat läuft über `POST /direct` mit genau einem Ziel; `POST /rooms` bräuchte den Typ `direct` gar nicht.
- **Auswirkung aus Nutzersicht:** Eine Teamer:in (oder ein Admin) kann per API einen Chat mit mehreren Konfis anlegen, den keine Leitung einsehen kann; die Konfis können darin miteinander schreiben. Die App-Oberfläche bietet nur `group` an (`SimpleCreateChatModal.tsx:300`) — es braucht einen direkten API-Aufruf mit gültigem Team-Token. Bei einer App für 13- bis 14-Jährige, deren Schutz gerade auf der Einsehbarkeit gemeinschaftlicher Räume beruht, ist das eine Lücke mit Vorbedingung, keine Kleinigkeit.
- **Beleg:** Testausgabe A1: `POST /rooms -> 200 {"room_id":5,"created":true}`, Teilnehmer `[1 konfi, 2 konfi, 3 teamer]`, `Raumtyp: direct`, `org_admin liest -> 403 | admin liest -> 403`, `konfi1 schreibt -> 200 | konfi2 liest -> 200 Nachrichten: 1`.
- **Empfehlung:** In `POST /rooms` den Typ `direct` ablehnen (400, Verweis auf `POST /direct`) oder auf `participants.length === 1` begrenzen; bei `direct` zusätzlich prüfen, dass nicht zwei Konfis darin landen. Bestand in Produktion prüfen (siehe „Auf Produktion nachzumessen"). Test für den verbotenen (3 Teilnehmende) und den erlaubten Fall (`POST /direct`) ergänzen.

### BF-02: Jahrgang löschen vernichtet die Konfi-Rückblicke beförderter Teamer:innen
- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — Migration 162 stellt `wrapped_ausgaben.jahrgang_id` auf `ON DELETE SET NULL` und lockert den CHECK (Konfi-Ausgabe darf jahrgangslos werden); die Löschroute räumt nur noch Konfi-Ausgaben ohne Snapshot weg; `GET /wrapped/history/:id` liefert den Rückblick der beförderten Person weiter (Test G1 als Dauertest in `tests/routes/rueckblickUeberlebtJahrgangLoeschung.test.js`); Handbuch 45-jahrgaenge und API-Doku ergänzt.
- **Fundstelle:** `backend/migrations/143_wrapped_ausgaben.sql:43` (`jahrgang_id … ON DELETE CASCADE`), `143_wrapped_ausgaben.sql:82` (`wrapped_snapshots.ausgabe_id … ON DELETE CASCADE`), `backend/routes/jahrgaenge.js:429-446` (löst nur `konfi_profiles`, nicht die Ausgaben)
- **Kennzeichnung:** reproduziert — Test G1 (temporär, gelöscht): `POST /api/wrapped/generate/1` → 2 Snapshots (`konfi1`, `konfi2`, `ausgabe_id 1`); beide zu Teamer:innen befördert (`role_id=2`); `DELETE /api/admin/jahrgaenge/1` als `org_admin` → 200 „Jahrgang erfolgreich gelöscht"; danach `wrapped_snapshots` **leer**, `wrapped_ausgaben` **leer**, `GET /wrapped/history/1` der beförderten Person → 0 Einträge.
- **Beschreibung:** Bis Migration 143 hing ein Konfi-Snapshot mit `jahrgang_id ON DELETE SET NULL` am Jahrgang und überlebte dessen Löschung (`prod-schema.sql`, Constraint `wrapped_snapshots_jahrgang_id_fkey`). Seit dem 03.09.2026 gehört jeder Snapshot zu einer Ausgabe, und die Ausgabe hängt mit `ON DELETE CASCADE` am Jahrgang. Die Löschroute selbst weiß, dass beförderte Ex-Konfis ihre Werte behalten sollen („damit er seine Werte später noch einsehen kann", `jahrgaenge.js:433-436`), und das Handbuch verspricht es (`45-jahrgaenge.md:277-283`: „Ihre Daten bleiben vollständig erhalten … damit sie ihre eigene Konfizeit später noch nachschauen können"). Der Rückblick ist davon jetzt ausgenommen — und lässt sich ohne Jahrgang nicht neu erzeugen (`POST /generate/:jahrgangId` braucht ihn).
- **Auswirkung aus Nutzersicht:** Eine Teamer:in, die als Konfi einen Rückblick bekommen hat, verliert ihn in dem Moment, in dem die Leitung den alten Jahrgang aufräumt — ohne Hinweis im Löschdialog („Chat-Nachrichten vorhanden" ist die einzige Rückfrage). Betrifft genau die Gruppe, für die die Konfi-Historie gebaut wurde (offene Befunde #7.2).
- **Beleg:** `G1 Snapshots vorher: [{"user_id":1,"jahrgang_id":1,"ausgabe_id":1},{"user_id":2,…}]` → `G1 DELETE /admin/jahrgaenge/1 -> 200` → `G1 Snapshots nachher: [] | Ausgaben nachher: []` → `/history … Eintraege: 0`.
- **Empfehlung:** Additiv: `wrapped_ausgaben.jahrgang_id` auf `ON DELETE SET NULL` umstellen und den CHECK `wrapped_ausgaben_jahrgang_passt` entsprechend lockern (Konfi-Ausgabe *darf* jahrgangslos werden), oder die Snapshots vor dem Löschen von der Ausgabe lösen. Mindestens: Löschdialog und Handbuch nennen den Verlust. Test: Jahrgang mit beförderter Teamer:in löschen → ihr Snapshot bleibt.

### BF-03: „Morgen: Event!" wird zwischen 00:00 und 00:15 Uhr nachts verschickt
- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — Vortags-Erinnerung an das Fenster „24 Stunden vor Beginn ±15 Minuten" gebunden (wie der Ein-Stunden-Zweig); Regel im Handbuch (70-termine.md „Terminerinnerungen einordnen"); Tests F1–F7 in `tests/services/eventReminders.test.js`.
- **Fundstelle:** `backend/services/backgroundService.js:667-668` (Fenstervariablen berechnet, aber ungenutzt), `:670-682` (`e.event_date::date = $1::date` — reiner Datumsvergleich), `:467-473` (Takt 15 Minuten ab Prozessstart)
- **Kennzeichnung:** reproduziert — Test F1/F2/F3 (temporär, gelöscht; `vi.setSystemTime`): Termin 29.09. 18:00 Berlin, Buchung `konfi1`. Systemzeit 28.09. **00:05** Berlin → `sendEventReminders` schreibt `event_reminders(1_day)` — **34 Stunden vorher**. 27.09. 23:50 → nichts (richtig). 28.09. 18:05 → Erinnerung (der Fall, den die Kommentare meinen).
- **Beschreibung:** Die Vortags-Erinnerung wird für alle Termine ausgelöst, deren Kalendertag „morgen" ist. Weil der Dienst alle 15 Minuten läuft, ist der erste Treffer der erste Lauf nach Mitternacht. Der Ein-Stunden-Zweig arbeitet korrekt mit einem ±15-Minuten-Fenster (`:722-734`); für den Tageszweig sind dieselben Fenstervariablen angelegt, aber nie in die Abfrage gekommen. Das Handbuch sagt nur „am Vortag" (`70-termine.md:520`), die Push-Texte sagen „Morgen: … um 18:00 Uhr".
- **Auswirkung aus Nutzersicht:** Jede Konfi mit einem Termin bekommt die Erinnerung mitten in der Nacht auf das Handy — bei 10.000 Nutzer:innen und wöchentlichen Terminen jede Woche tausendfach. Für Minderjährige ist eine Push um 00:05 Uhr genau die Störung, wegen der Eltern Mitteilungen abschalten (und dann fehlen auch die wichtigen).
- **Beleg:** `F1 Erinnerungen um 00:05 Berlin: [{"reminder_type":"1_day","sent_at":"…"}]` (Soll: leer); `F3 … 23:50 Berlin (2 Tage vorher): []`; `F2 … 18:05 Berlin: [{"reminder_type":"1_day"}]`.
- **Empfehlung:** Vortags-Erinnerung an eine Uhrzeit binden — entweder „24 Stunden vorher ±15 Minuten" (Fenstervariablen sind schon da) oder eine feste Tageszeit (z. B. 18:00 Uhr des Vortags, wie der Team-Rückblick-Cron eine feste Zeit hat). Test mit `vi.setSystemTime` auf 00:05 und 18:05.

### BF-04: Automatischer Team-Rückblick (6. Januar) übersieht Teamer:innen der Zweitgemeinde — und gesperrte Konten nicht
- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — `generateAllTeamerWrapped` (Cron-Weg) zieht die Empfänger wie der Hand-Weg über `ladeMitgliederDerOrganisation(client, orgId, ['teamer'])` (beide Quellen, Rolle je Gemeinde, ohne gesperrte und gelöschte Konten); ohne Empfänger geht kein Push mehr hinaus. Test E1 als Dauertest in `tests/services/wrappedCron.test.js` („Teamer:innen aus einer zweiten Gemeinde": beide Gemeinden, Rolle je Gemeinde, eigene Ausgabe je Gemeinde, gesperrt/gelöscht ohne Snapshot und Push).
- **Fundstelle:** `backend/routes/wrapped.js:3235-3239` (`WHERE r.name = 'teamer' AND u.organization_id = $1` — nur Stamm-Gemeinde, ohne `is_active`/`deleted_at`) gegenüber `:2557-2570` (Hand-Weg über `ladeMitgliederDerOrganisation`, beide Quellen, gefiltert)
- **Kennzeichnung:** reproduziert — Test E1 (temporär, gelöscht): `teamer2` (Stamm-Org 2) per `user_organizations` als Teamer:in in Org 1. `generateAllTeamerWrapped(db, 1, 2025)` → Snapshots nur für `[3]`; `POST /api/wrapped/generate-teamer {jahr:2025}` → Snapshots für `[3, 7]`.
- **Beschreibung:** Die CHANGELOG-Zusage von 2.3.0 („Der Jahresrückblick fürs Team wird je Gemeinde erstellt: Wer in zwei Gemeinden im Team ist, bekommt in jeder einen eigenen Rückblick") wurde am 26.09. nur im Hand-Weg umgesetzt; der Cron-Weg, den das Handbuch als Normalfall beschreibt („Am 6. Januar geht es von allein", `95-wrapped.md:180-187`), ruft weiter nur die Stamm-Gemeinde ab. Umgekehrt nimmt er deaktivierte und gelöschte Teamer-Konten mit (kein `is_active`/`deleted_at`-Filter) und schickt ihnen den Push (dort filtert `getTokensForUser`, das Postfach-Schreiben in `schreibePostfach` filtert nur `deleted_at`).
- **Auswirkung aus Nutzersicht:** Wer in der Zweitgemeinde mitarbeitet, bekommt dort am 6. Januar keinen Team-Rückblick — und weil die Ausgabe dann existiert, kann die Leitung ihn auch nicht mehr von Hand nachholen (`schonDa`, `:2533-2551`). Nur `DELETE /ausgabe/:id` und Neuanlage helfen.
- **Beleg:** `E1 Cron -> {"generated":1,"errors":0} Snapshots fuer user_ids: [3]` / `E1 Hand -> 200 {"generated":2,…} Snapshots fuer user_ids: [3,7]`.
- **Empfehlung:** In `generateAllTeamerWrapped` dieselbe Empfängerquelle wie im Hand-Weg (`ladeMitgliederDerOrganisation(client, orgId, ['teamer'])`). Test: Zweitgemeinde-Teamer:in bekommt Snapshot im Cron-Weg; deaktiviertes Konto nicht.

### BF-05: `DELETE /wrapped/teamer` lässt die Ausgabe stehen — der Team-Rückblick des Jahres ist danach nicht mehr erzeugbar
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/wrapped.js:2988-3010` (löscht nur `wrapped_snapshots`), `:2533-2551` (Idempotenz-Sperre prüft `wrapped_ausgaben`)
- **Kennzeichnung:** reproduziert — Test D1 (temporär, gelöscht): `POST /generate-teamer {jahr:2025}` → `generated:1`; `DELETE /api/wrapped/teamer` → `deleted:1`; `POST /generate-teamer {jahr:2025}` → `generated:0`, „Der Team-Rückblick 2025 besteht bereits", `benachrichtigt:false`; `GET /ausgaben?typ=teamer` zeigt die Ausgabe mit `snapshots:0`; `GET /wrapped/meine` der Teamer:in → `[]`.
- **Beschreibung:** Der Kommentar der Route („Erneutes Generieren überschreibt zwar") stammt aus der Zeit vor der Ausgaben-Sperre (08.09.2026). Seitdem gilt: Ausgabe da → nichts tun. Die Route hinterlässt eine leere Ausgabe, die genau diese Sperre auslöst. `docs/api/ABRISS.md` führt die Route als Betriebswerkzeug („Löschweg"), die Oberfläche nutzt seit 2.2.0 nur `DELETE /ausgabe/:id` (`AdminWrappedPage.tsx:229`; auch im Stand `2.2.0`).
- **Auswirkung aus Nutzersicht:** Wer den dokumentierten Löschweg benutzt (Betrieb, API), nimmt dem Team den Rückblick des Jahres endgültig; die Leitung sieht in der App eine Ausgabe mit „0 Rückblicke" und bekommt beim Neuanlegen die Meldung, es gebe sie schon.
- **Beleg:** siehe Kennzeichnung (Ausgabe der Konsole in D1).
- **Empfehlung:** Entweder die Route mit der Ausgabe löschen lassen (`DELETE FROM wrapped_ausgaben WHERE … wrapped_type='teamer' [AND EXTRACT(YEAR FROM zeitraum_start)=$2]`, Snapshots gehen per Kaskade mit) oder sie aus dem Code nehmen und in ABRISS.md streichen — ein Werkzeug, das die Daten in einen Zustand bringt, aus dem nur ein anderes Werkzeug zurückführt, ist keins.

### BF-06: `GET /wrapped/me` und `/wrapped/meine` kennen die aktive Gemeinde nicht — Teamer-Dashboard zeigt in Gemeinde B den Rückblick aus Gemeinde A
- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — `/me`, `/meine` und `has_wrapped` im Teamer-Dashboard filtern auf `s.organization_id = req.user.organization_id` (die aktive Gemeinde); additiv liefert `/me` `organization_id`, `/meine` `organization_id` und `organization_name`. Antwortformen unverändert. Test H1 als Dauertest in `tests/routes/wrappedAktiveGemeinde.test.js` (Zweitgemeinde, Stamm-Gemeinde unverändert, 404 statt fremder Rückblick, Dashboard-Flagge je Gemeinde).
- **Fundstelle:** `backend/routes/wrapped.js:2169-2185` (`WHERE s.user_id = $1 AND s.wrapped_type = $2`, kein `organization_id`), `:2681-2695` (ebenso), `backend/routes/teamer.js:840-842` (`has_wrapped` ohne Org), `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx:363-367` (öffnet `WrappedModal` ohne `initialData` → lädt `/wrapped/me`)
- **Kennzeichnung:** reproduziert — Test H1 (temporär, gelöscht): `teamer1` mit je einer freigegebenen Team-Ausgabe 2025 in Org 1 (jünger) und Org 2; `GET /api/wrapped/me` mit `X-Active-Organization: 2` → `{"gemeinde":1}`; `/meine` in Org 2 → 2 Einträge ohne Gemeindeangabe; `/history/:id` in Org 2 → 1 Eintrag `{"gemeinde":2}` (dort ist es seit 26.09. richtig).
- **Beschreibung:** Am 26.09. wurde `GET /history/:userId` auf die aktive Gemeinde eingeschränkt (Commit f8eaff3), `/me` und `/meine` nicht. Das Teamer-Dashboard ruft `/me`. Die Antwort trägt weder `organization_id` noch einen Gemeindenamen — die App kann nicht erkennen, welchen Rückblick sie zeigt.
- **Auswirkung aus Nutzersicht:** Eine Teamer:in in zwei Gemeinden tippt in Gemeinde B auf „Dein Team-Jahr ist da" und sieht die Zahlen von Gemeinde A — die CHANGELOG verspricht „in jeder einen eigenen Rückblick mit den Zahlen genau dieser Gemeinde". Kein Datenabfluss (eigene Daten), aber falsche Anzeige.
- **Beleg:** `H1 /me aktiv Org 2 -> 200 {"gemeinde":1} | /me aktiv Org 1 -> {"gemeinde":1}`; `/meine aktiv Org 2 -> Eintraege: 2 | /history aktiv Org 2 -> Eintraege: 1 [{"gemeinde":2}]`.
- **Empfehlung:** `/me`, `/meine` und `has_wrapped` auf `s.organization_id = req.user.organization_id` einschränken (Antwortform bleibt); additiv `organization_id`/`organization_name` in `/meine` mitgeben. Test wie H1.

### BF-07: Leitung darf einen Jahrgangs-Chat lesen, bekommt die Anhänge darin aber nicht
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/chat.js:1852-1861` (Mitgliedschaft nur über `chat_participants`, ohne `user_type`, ohne Leitungsregel) gegenüber `chat.js:303-318` (`darfRaumOeffnen`) und Handbuch `90-chat.md:147-153`
- **Kennzeichnung:** reproduziert — Test B1 (temporär, gelöscht): `konfi1` lädt PNG in Raum 1 (Jahrgangs-Chat); `org_admin1` (kein Teilnehmer) `GET /rooms/1/messages` → 200, `GET /chat/files/<file_path>` → **403** „Zugriff verweigert"; `admin1` (Teilnehmer) → 200.
- **Beschreibung:** Alle anderen Leserouten (`/rooms/:id`, `/messages`, `/participants`, `/export`, Reaktionen lesen) folgen `darfRaumOeffnen`; die Datei-Route hat eine eigene, engere Mitgliedschaftsprüfung. Die Leitung sieht in der Nachrichtenliste ein Bild mit Dateinamen und bekommt beim Öffnen einen Fehler.
- **Auswirkung aus Nutzersicht:** Genau der Fall, für den die Leitung den Zugriff hat („muss im Zweifel eingreifen können"): Ein gemeldetes Bild im Jahrgangs-Chat lässt sich nicht ansehen, ohne sich erst als Teilnehmer:in einzutragen. Org-Admins sind über den Sync normalerweise Teilnehmende — die Lücke trifft `admin`-Konten mit Jahrgangs-Zuweisung, die den Chat noch nie geöffnet haben (Sync läuft erst bei `GET /rooms`), und Gruppen-/Termin-Chats, in denen die Leitung nicht steht.
- **Beleg:** `B1 org_admin: messages -> 200 | files -> 403 {"error":"Zugriff verweigert"} | admin1 (Teilnehmer) files -> 200`.
- **Empfehlung:** In `GET /files/:filename` `darfRaumOeffnen(fileMessage.room_id, req.user)` verwenden (mit `user_type`). Test: Leitung ohne Teilnehmerschaft im Gruppenchat → 200; im fremden Direktchat → 403.

### BF-08: Zweitgemeinde-Mitglieder stehen in der Kontaktliste, lassen sich aber nicht in Gruppenchats eintragen
- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — `POST /chat/rooms` (participants) und `POST /chat/rooms/:roomId/participants` lösen die Person über `TEAM_MITGLIED_ROLLE` auf (Stamm-Gemeinde ODER `user_organizations`, `user_type` aus der Rolle dieser Gemeinde); Tests L1 als Dauertests in `tests/routes/chatGruppenZweitgemeinde.test.js` (Zusatzmitglied, Rolle je Gemeinde, Stamm-Mitglied unverändert, fremde Gemeinde bleibt außen). Nicht auflösbare Teilnehmer:innen in `POST /rooms` werden weiterhin still weggelassen (kein 400 — Antwortverhalten der Store-Apps unverändert); die „gleiche Klasse" in `challenges.js` und der Lizenz-Erinnerung ist nicht Teil dieses Fixes.
- **Fundstelle:** `backend/routes/chat.js:1584-1592` (`POST /rooms/:roomId/participants`: `u.organization_id = $2`), `chat.js:606-611` (`POST /rooms`: Teilnehmerliste ebenso gefiltert — fremde werden **stillschweigend** weggelassen), gleiche Klasse: `backend/routes/challenges.js:1196` (`GET /admin/authors`), `:1365`/`:1506` (Urheber-Prüfung), `backend/services/backgroundService.js:1237` (Lizenz-Erinnerung)
- **Kennzeichnung:** reproduziert — Test L1 (temporär, gelöscht): `teamer2` per `user_organizations` in Org 1; `GET /chat/team-contacts` (teamer1) enthält ihn; `POST /rooms/3/participants {user_id:7}` (org_admin1) → **404** „Benutzer nicht in deiner Organisation gefunden"; `POST /rooms {type:'group', participants:[7]}` → 200, Teilnehmer danach nur `[5]` (der Ersteller).
- **Beschreibung:** Am 25./26.09. wurden Kontaktliste, Direktchat (`TEAM_MITGLIED_ROLLE`), Team-Chat-Sync und Push-Empfänger auf beide Zugehörigkeitsquellen umgestellt; die Gruppenchat-Teilnehmerverwaltung nicht. Die Rolle für den `user_type` käme zudem aus `u.role_id` (Stamm-Rolle) statt aus der Rolle in dieser Gemeinde.
- **Auswirkung aus Nutzersicht:** Die Leitung wählt in der Gruppen-Erstellung eine Person aus der Liste, die Gruppe entsteht ohne sie, ohne Fehlermeldung. Beim nachträglichen Hinzufügen kommt „nicht in deiner Organisation", obwohl die Person im Team-Chat steht und Push aus dieser Gemeinde bekommt.
- **Beleg:** `L1 team-contacts enthaelt teamer2: true | POST participants -> 404 … | POST /rooms Teilnehmer: [5]`.
- **Empfehlung:** Beide Stellen auf `TEAM_MITGLIED_ROLLE` (bzw. `ladeMitgliederDerOrganisation`) umstellen und die effektive Rolle für `user_type` nehmen; in `POST /rooms` nicht auflösbare Teilnehmer:innen mit 400 melden statt still zu streichen. Test wie L1 plus erlaubter Fall (Stamm-Mitglied).

### BF-09: Token im Query-String der Chat-Dateiroute landet im Zugriffslog
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/chat.js:1743` (`|| req.query.token`), Gegenstück `backend/routes/challenges.js:995-1000` (lehnt genau dieses Muster als „reine Angriffsfläche" ab, weil Tokens in Access-Logs und Referrern landen)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Traefik protokolliert jede Anfrage mit `RequestPath` (`docs/api/ABRISS.md`, Abschnitt „Wie man das prüft"); der Pfad enthält den Query-String und damit das Zugriffstoken (15 Minuten gültig, aber mit `active_organization_id` und Nutzer-ID). Das Muster ist bewusst („Video-Elemente können keine Header senden"), die Challenge-Route zieht seit 04.08.2026 die gegenteilige Konsequenz — zwei Regeln für dieselbe Frage.
- **Auswirkung aus Nutzersicht:** Wer die Server-Logs liest (Betrieb, Hosting), sieht gültige Anmelde-Tokens von Konfis. Begrenzt durch die kurze Laufzeit und die Log-Rotation (~5 Tage), aber vermeidbar.
- **Beleg:** Codevergleich der beiden Routen; Log-Inhalt nur in Produktion prüfbar (siehe unten).
- **Empfehlung:** Kurzlebige, zweckgebundene Datei-Tokens (wie ein signierter Abruf-Link) statt des Session-Tokens im Query — oder Traefik anweisen, Query-Strings zu maskieren. Bis dahin im Log prüfen, ob `token=` vorkommt.

### BF-10: Zwei Ungelesen-Zähler mit verschiedener Semantik (`GET /chat/rooms` zählt eigene Nachrichten mit)
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/chat.js:789-800` (kein Ausschluss eigener Nachrichten), `backend/routes/notifications.js:55-63` (schließt sie aus; der Kommentar dort behauptet Gleichheit)
- **Kennzeichnung:** reproduziert — Test C1 (temporär, gelöscht): `konfi1` schreibt in Raum 1; `GET /chat/rooms` → `unread_count = 1`; `GET /notifications/badge-counts` → `chat.byRoom[1] = 0`.
- **Beschreibung:** Die App nimmt `chatUnreadByRoom` aus `badge-counts` und fällt nur ohne Wert auf `room.unread_count` zurück (`ChatOverview.tsx:567`, `useChatSocket.ts:64`) — sichtbar wird der Unterschied also selten. Für jeden anderen Leser der Route (Store-Apps, Skripte) ist `unread_count` aber falsch, und offene Befunde #1 hat genau an solchen Doppelzählern gelitten.
- **Auswirkung aus Nutzersicht:** Im Normalfall keine; im Fallback (Zähler aus `badge-counts` noch nicht geladen) steht kurz eine 1 am eigenen Chat.
- **Beleg:** `C1 GET /rooms unread_count Raum 1 = 1 | badge-counts byRoom[1] = 0`.
- **Empfehlung:** In `GET /rooms` `AND NOT (m.user_id = $1 AND m.user_type = $2)` ergänzen (Wert wird kleiner, Form bleibt) und den irreführenden Kommentar in `notifications.js:34-37` korrigieren.

### BF-11: E-Mail-Vorlagen setzen Namen unmaskiert ins HTML; ein Fehlerzweig ist unerreichbar
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/services/emailService.js:175`, `:247`, `:321` (`${name}`, `${orgName}`, `${jahrgangName}` roh im HTML; `escapeHtml` existiert (`:333`) und wird nur in `sendGemeindeEinladungEmail` und `sendKonfiMatrixEmail` benutzt); `backend/routes/jahrgaenge.js:758-760` (`mailResult.success === false` — `sendEmail` wirft bei Fehlern (`:55-79`), gibt nie `success:false` zurück, der 502-Zweig ist tot, es kommt 500)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Anzeigename (frei wählbar), Gemeindename und Jahrgangsname (Leitung) gelangen ohne Maskierung in den HTML-Teil von Passwort-Reset, Lizenz- und Löschwarnung. Mailclients führen kein Skript aus; Layoutbruch und Phishing-Optik über einen präparierten Anzeigenamen sind aber möglich. Zwei Vorlagen maskieren korrekt — die Regel ist da, nur nicht überall.
- **Auswirkung aus Nutzersicht:** Gering (eigene Mail bzw. Mail an die Leitung); Hygiene.
- **Empfehlung:** `escapeHtml` in allen sechs Vorlagen; in `jahrgaenge.js` den toten Zweig entfernen oder `sendEmail` einheitlich ein Ergebnis zurückgeben lassen.

### BF-12: Tipp-Anzeige sendet `userName: undefined`
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/server.js:190` liest `socket.user.display_name`; `server.js:146-151` setzt in `socket.user` nur `id`, `organization_id`, `role_name`, `type`
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Das Feld fehlt seit der Umstellung der Socket-Authentifizierung auf Datenbankprüfung (22.08.2026). Das Handbuch sagt, es gebe keine „schreibt gerade…"-Anzeige (`90-chat.md:181`) — der Server sendet trotzdem `userTyping`-Ereignisse, nur ohne Namen.
- **Auswirkung aus Nutzersicht:** keine sichtbare; toter Zweig.
- **Empfehlung:** `display_name` in der Socket-Auth mitladen oder die Tipp-Ereignisse entfernen.

### BF-13: Ausgabe löschen verlangt weniger Rechte als Ausgabe anlegen
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/wrapped.js:2743-2750` (`DELETE /ausgabe/:id`: irgendeine Zuweisung auf den Jahrgang genügt, `can_edit` wird nicht geprüft) gegenüber `:2312` (`POST /generate/:jahrgangId`: `darfJahrgang(req, …, { edit: true })`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Ein Admin mit reiner Lese-Zuweisung darf den Rückblick eines Jahrgangs samt aller Snapshots löschen, aber keinen anlegen.
- **Auswirkung aus Nutzersicht:** Ein Admin, der nur mitlesen soll, kann die Rückblicke „seines" Jahrgangs entfernen; Wiederherstellen nur durch Neuanlage durch jemanden mit Schreibrecht.
- **Empfehlung:** `darfJahrgang(req, ausgabe.jahrgang_id, { edit: true })` verwenden — dieselbe Quelle wie beim Anlegen.

### BF-14: Jahres-Cron läuft über gesperrte Organisationen; Lizenz-Mail nur an Stamm-Mitglieder
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/services/backgroundService.js:1011` (`SELECT id FROM organizations` ohne `is_active`), `:1234-1241` (`runLicenseReminders`: Leitung nur über `u.organization_id`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Der Team-Rückblick wird am 6. Januar auch für inaktive (Testphase abgelaufen, gesperrte) Gemeinden erzeugt und der Push angestoßen (`getTokensForUser` filtert nur Konto-, nicht Gemeindestatus). Die Lizenz-Erinnerung erreicht eine Leitung, die die Gemeinde nur über `user_organizations` führt (realer Fall laut `orgMitglieder.js`), nicht.
- **Auswirkung aus Nutzersicht:** Einmal jährlich unnötige Arbeit und Pushes an Konten gesperrter Gemeinden; eine Gemeinde ohne Stamm-Leitung bekommt keine Warnung vor dem Lizenzende.
- **Empfehlung:** `WHERE is_active = true` im Cron; `ladeLeitungDerOrganisation` in der Lizenz-Erinnerung (wie schon in der Löschwarnung).

## Unklar

- **Mehrfach-Einreichung bei `allow_multiple = false` im Wettlauf.** Die Prüfung ist Lesen-dann-Schreiben ohne Unique-Constraint (`challenges.js:780-788`, Schema `challenge_submissions` ohne Eindeutigkeit auf `(challenge_id, user_id)`). Fünf gleichzeitige Text-Einreichungen im Test ergaben trotzdem genau einen Beitrag (Test I1) — das Zeitfenster ist klein, aber nicht null. Zu klären wäre mit einer gezielt verzögerten Transaktion; ein partieller Unique-Index (`WHERE` auf `allow_multiple` geht nicht über Tabellen hinweg) wäre nur über eine Prüfung mit `FOR UPDATE` auf der Challenge zu schließen.
- **Überlappende Erinnerungsläufe.** `sendEventReminders` läuft per `setInterval` ohne Wiedereintrittsschutz; die `event_reminders`-Zeile wird erst *nach* dem Push geschrieben. Dauert ein Lauf länger als 15 Minuten (viele Empfänger, langsames FCM), kann der nächste dieselben Erinnerungen ein zweites Mal senden. Ob das bei 10.000 Nutzer:innen eintritt, hängt an der Laufzeit je Push — nur in Produktion messbar (Dauer eines Laufs loggen).
- **Cron-Leader in Produktion.** Ob `backend2` tatsächlich `RUN_BACKGROUND_JOBS=false` trägt, steht nur im Stack; ohne diesen Schalter liefen Erinnerungen, Team-Rückblick und Zähler doppelt (die Challenge-Start- und Anmeldestart-Pushes sind über `UPDATE … RETURNING` dagegen geschützt, die Erinnerungen nicht).
- **`POST /rooms/:roomId/messages` mit fremder `client_id`.** Die Idempotenz-Prüfung liefert eine vorhandene Nachricht derselben Organisation unabhängig vom Absender zurück (`chat.js:1099-1112`). Eine UUID zu raten ist praktisch aussichtslos; ein Test dafür wäre Theater — notiert, nicht bewertet.

## Alte Befunde nachgeprüft

- **#1 Chat: Ungelesen-Markierung (02.09.)** — Backend-Seite bestätigt in Ordnung: `POST /rooms/:id/mark-read` ist ein UPSERT (`chat.js:1334-1338`), `badge-counts` respektiert den Lesestand (`notifications.test.js:782` grün). Neu dazu: die beiden Zähler haben verschiedene Semantik (BF-10).
- **#6 Rückblick las die falsche Kategorie-Quelle** — behoben bestätigt: `wrapped.js:300/310/518` lesen `activity_categories`/`event_categories`, der frühere `COALESCE(a.category, a.type)` steht nur noch im Kommentar (`:448`).
- **#7.2 Konfi-Historie hängt am Jahrgang (13.09.)** — im Frontend behoben, im Backend seit Migration 143 **neu gebrochen**: Die Konfi-Rückblicke verschwinden mit dem Jahrgang (BF-02). Punkte, Level, Abzeichen bleiben (`jahrgaenge.js:429-440`), der Rückblick nicht.
- **#8 Erinnerungen an Abgemeldete (15.09.)** — behoben bestätigt: `eb.attendance_status IS NULL` in beiden Erinnerungsabfragen (`backgroundService.js:675, 727`), `services/eventReminders.test.js` (grün, 26.09.) deckt Abmeldung und Absage ab.
- **ABRISS.md / Vorfall 29.08. (`GET /teamer/badges`)** — die versprochene Lösung steht so im Code: alte Array-Route mit Kopfzeilen (`teamer.js:267-291`), neue `GET /badges/v2` (`:305-318`), `PUT` und `POST /badges/mark-seen` nebeneinander mit einer gemeinsamen Funktion (`:353-401`); Frontend `2.2.0` ruft `/badges/v2` und `POST mark-seen`. Tests in `badgesV2.test.js` („Alte Routen bleiben unveraendert").

## Geprüft und in Ordnung

- **Direktchat-Privatsphäre und Leitungszugriff** — `darfRaumOeffnen` (`chat.js:303-318`) in allen Lese-/Schreibrouten außer Dateien (BF-07); Socket-Beitritt spiegelt die Regel (`chatRoomAccess.js`, `utils/chatRoomAccess.test.js` grün), Tipp-Ereignisse prüfen sie ebenfalls (`server.js:183-205`). Bestehende Tests `chat.test.js:1173-1260`.
- **Konfi-zu-Konfi-Sperre und Jahrgangsgrenzen im Anlegen** — `POST /direct`, `POST /rooms` (Teilnehmerliste), `POST /rooms/:id/participants` prüfen `teamAnschreibenVerboten`/`konfiAnschreibenVerboten` (`chat.js:265-522, 596-660, 1596-1602`); Lücke nur über den Typ (BF-01).
- **Nachrichten löschen** — eigene immer, fremde nur Leitung in öffnbaren Räumen (`chat.js:2328-2331`); Umfrage anlegen/abstimmen folgt der Raumregel (`chat.js:1942, 2175`).
- **Nachrichtenlimit** — Deckel 200 liegt über den 100 der ausgelieferten App (`chat.js:917-949`); negative Werte fallen auf 50.
- **Socket.IO bei 2 Replikas** — Postgres-Adapter mit eigenem Pool (`server.js:58-68`), Auth mit Datenbankprüfung und Soft-Revoke (`:88-152`), Weiche gegen Doppelantwort (`:417-421`, `utils/socketioExpressWeiche.test.js` grün).
- **Hintergrundjobs bei 2 Replikas** — nur der Leader startet sie (`server.js:470-476`); Challenge-Start und Anmeldestart flippen ihr Flag atomar (`backgroundService.js:541-551, 615-623`); jeder Cron mit `timezone: 'Europe/Berlin'`; Erstläufe mit `.catch`, `unhandledRejection` beendet den Prozess nicht (`server.js:560-575`).
- **Push-Gruppen (Migration 158)** — Abwahl greift in `getTokensForUser`, `getTokensForUsers`, `sendChatNotification`; stiller `badge_update` läuft durch; Postfach-Eintrag entsteht unabhängig (`services/pushGruppenAuswahl.test.js` grün, 26 Tests). Rollen bekommen nur ihre Gruppen (`pushGruppen.js:60-80`).
- **Push-Tokens je App-Version (Migration 156)** — additiv, nullbar, `COALESCE` beim Upsert (`notifications.js:678-694`), Tests `notifications.test.js:72-122`.
- **Push-Versand** — Wiederholung nur bei drei zeitweiligen Fehlern, fatale Tokens sofort weg (`pushService.js:159-263`), Blockweise Zustellung mit Pause (`:812-873`), `success` sagt die Wahrheit (`:784`).
- **Postfach** — nur `user_id` aus dem Token, Cursor-Paginierung, `data` immer Objekt, fremde/fehlende IDs beide 404 (`notifications.js:447-563`, `postfach.test.js` 30 Tests); Mitteilungen sterben mit ihrem Gegenstand (`postfachAufraeumen.js`, in `challenges.js:1641`, `teamer.js:1380`, `jahrgaenge.js:453` verdrahtet); Aufräumen nach 365 Tagen im 02:00-Lauf, fehlerisoliert (`backgroundService.js:1120-1128`).
- **Multi-Org-Zustellung an die Leitung** — `ladeLeitungDerOrganisation` (beide Quellen, Rolle je Gemeinde) in `sendToOrgAdmins`, Pending-Events, Löschwarnung, Antrags-Mitteilung (`orgMitglieder.js`, `pushService.js:1089-1110`, `teamer.js:1308-1311`).
- **Challenges: Sichtbarkeit** — eine Quelle `PUBLIC_SUBMISSION_SQL`/`isSubmissionPublic` für Galerie, Datei, Export, Feed-Push und Neuigkeiten-Zähler (`challengeSichtbarkeit.js`, `challenges.js:108-117`, `challengeNeuigkeiten.js:78-82`); Anonymität einbahnig; `private`-Zusage unantastbar (`challenges.js:1762-1775`); Export lässt `private`-Konsens draußen (`:1993-2011`).
- **Challenges: Rechte** — Konfis nie `nur_team` (404), Jahrgangsbindung für admin/teamer, org_admin org-weit, Löschen nur Leitung (`challenges.js:180-260, 1603-1660`); Datei-Route mit Multi-Org-Header, Owner, Team-Regel, Konfi-Regel (`:1006-1130`); `mark-read` folgt denselben Regeln (`:692-731`). 90+ Tests in `challenges.test.js`.
- **Medien** — Magic-Bytes auf den Kopfbytes vor dem Ablegen, Stromverschlüsselung ohne Vollpuffer, alte Klartextdateien werden durchgereicht (`photoCrypto.js:149-177`, `utils/photoCrypto.test.js`); Zwischenlager wird bei `close` geräumt (`createApp.js:297-320`).
- **Jahresrückblick: Rechte und Freigabe** — Konfi-Rückblick nur mit `edit`-Zuweisung erzeugbar (`wrapped.js:2309`), Konfi sieht ihn erst nach Freigabe (`:2198-2216`), Team-Rückblick nur org_admin und nur abgeschlossene Jahre (`:2474-2504`), Idempotenz je Kalenderjahr (`:2533-2551`), Savepoint je Person, Totalausfall wird zurückgerollt (`:2594-2632`). Leere Datenlagen: Zahl-Seiten haben Bedingungen (`wrappedKacheln.js:36-60`), `wrapped.test.js:762` („Ohne Termine und Abzeichen fehlen beide Seiten").
- **`GET /wrapped/history/:userId`** — Multi-Org-Ziel über beide Quellen, Jahrgangsbindung für Konfi-Ziele, nur aktive Gemeinde (`wrapped.js:3061-3158`).
- **Antwortformen seit 2.2.0** — alle Änderungen additiv: `badge-counts` (neue Objekte, `pendingChallenges` bleibt Zahl), `preferences` (`push_enabled` bleibt, `stumm`/`gruppen` dazu; `PUT` nimmt die Alt-Form weiter an), `device-token` (optionale Felder), `wrapped` (`ausgabe_id`, `titel`, `benachrichtigt` dazu; `/history` bleibt Array), `challenges` (neue Route `mark-read`, `offene_stempel` als eigenes Feld, `earned_at` additiv), `chat` (Limit-Deckel > App-Wert). Keine entfernten Felder, kein Array→Objekt.
- **`GET /api/app-version`** — Vertrag unverändert (`appVersion.js:11-20`), Store-Abfrage wirft nie (`storeVersion.js`).
- **E-Mail ohne SMTP** — `getTransporter` wirft klar (`emailService.js:22-29`); Aufrufer fangen: Passwort-Reset (`auth.js:708-709`), Einladung (`nachAntwort`, `einladungen.js:165-175`), Lizenz-/Löschwarnung je Empfänger (`backgroundService.js:1248-1257, 1378-1388`), Marker werden nur bei Erfolg gesetzt.
- **Tageslosung** — interner Weg mit kurzem Timeout, Negativ-Cache 30 Minuten, DB-Fallback auf den letzten Vers (`losungService.js:20-60, 238-260`).
- **Settings** — org-gescopt lesen, nur org_admin schreiben (`settings.js:74-112`).
- **Material** — Jahrgangsschranke einheitlich in Liste, Detail, Termin-Sicht und Datei-Route (`material.js:54-74`, `:901-918`); Ändern nur Ersteller:in oder Leitung (`:234-237`).

## Nicht geprüft

- Rechenlogik der Snapshots (`generateKonfiSnapshot`, `generateTeamerSnapshot`) und Kachelauswahl im Detail; Sommerfreizeit-Sonderseite.
- `appIconBadge.js` (Summenbildung fürs App-Symbol) über die Paritätstests hinaus.
- `musikLinks.js` (Fremddienste), `bibelVerszaehlung.js`, `konfspruch.js`, `pushText.js`.
- Frontend-Verhalten jenseits der Frage, welche Routen es ruft (Chat-UI, Postfach-UI, Wrapped-Modal-Inhalte).
- Firebase-Payload gegen echte Geräte (Kanäle, Badge auf Android) — nur Code.
- Lastverhalten von `updateAllUserBadges` bei 10.000 Konten (Messwerte stehen als Kommentar im Code, wurden hier nicht nachgemessen).

## Auf Produktion nachzumessen

- **BF-01, Bestand:** `SELECT r.id, r.organization_id, COUNT(*) FROM chat_rooms r JOIN chat_participants p ON p.room_id=r.id WHERE r.type='direct' GROUP BY r.id, r.organization_id HAVING COUNT(*) <> 2;` — jede Zeile ist ein „Direktchat", der keiner ist. Zusätzlich: `… HAVING COUNT(*) FILTER (WHERE p.user_type='konfi') >= 2`.
- **BF-02, Betroffene:** `SELECT COUNT(*) FROM wrapped_snapshots s JOIN users u ON u.id=s.user_id JOIN roles r ON r.id=u.role_id WHERE s.wrapped_type='konfi' AND r.name<>'konfi';` — so viele Rückblicke beförderter Teamer:innen hängen an löschbaren Jahrgängen.
- **BF-03, Sendezeiten:** `SELECT date_trunc('hour', sent_at AT TIME ZONE 'Europe/Berlin') AS stunde, COUNT(*) FROM event_reminders WHERE reminder_type='1_day' GROUP BY 1 ORDER BY 2 DESC LIMIT 5;` — erwartet: die Stunde 00:00 dominiert.
- **BF-04/05:** `SELECT a.id, a.organization_id, a.titel, COUNT(s.id) FROM wrapped_ausgaben a LEFT JOIN wrapped_snapshots s ON s.ausgabe_id=a.id WHERE a.wrapped_type='teamer' GROUP BY a.id HAVING COUNT(s.id)=0;` — leere Team-Ausgaben, die die Neuanlage blockieren.
- **BF-09:** `docker logs --since 24h traefik 2>&1 | grep -c 'chat/files/[a-f0-9]*?token='` — kommt etwas, stehen JWTs im Log.
- **Unklar/Erinnerungen:** Laufzeit eines `sendEventReminders`-Laufs loggen (Start/Ende) und gegen die 15 Minuten halten; prüfen, dass genau eine Replika `Hintergrund-Jobs gestartet (diese Replica ist der Cron-Leader)` loggt.
- **Zweitgemeinden:** `SELECT COUNT(*) FROM user_organizations uo JOIN roles r ON r.id=uo.role_id WHERE r.name='teamer';` — so viele Personen trifft BF-04/06/08 heute.
