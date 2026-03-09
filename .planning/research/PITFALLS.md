# Domain Pitfalls: v1.7 Pflicht-Events, QR-Check-in, Auto-Enrollment, Anwesenheitsstatistik

**Domain:** Pflicht-Event-Management mit Anwesenheitsverfolgung in bestehendem Event-System
**Researched:** 2026-03-09
**Confidence:** HIGH (basierend auf vollstaendiger Analyse von events.js, konfi.js, 01-create-schema.sql und bestehendem Booking-Flow)

## Kritische Pitfalls

Fehler die zu Datenverlust, inkonsistenter Anwesenheit oder gebrochener bestehender Event-Logik fuehren.

### Pitfall 1: Status-CHECK-Constraint blockiert neue Booking-Stati

**Was schiefgeht:** Die `event_bookings` Tabelle hat einen CHECK-Constraint in der Schema-Definition (Zeile 387): `CHECK (status IN ('confirmed', 'pending', 'cancelled'))`. Der Code verwendet aber bereits `'waitlist'` statt `'pending'` -- das funktioniert nur weil die DB offensichtlich nachtraeglich angepasst wurde (ALTER TABLE oder kein strikter Check). Wenn fuer Pflicht-Events ein neuer Status wie `'enrolled'` oder `'opted_out'` eingefuehrt wird, MUSS der CHECK-Constraint explizit aktualisiert werden, sonst scheitern INSERTs mit einem Constraint-Violation-Error.

**Warum es passiert:** Schema-Datei (`01-create-schema.sql`) ist nicht synchron mit der tatsaechlichen DB. Entwickler testen gegen die Live-DB (die bereits modifiziert wurde) und vergessen den CHECK-Constraint in der Schema-Datei zu aktualisieren. Beim naechsten Fresh-Setup (neuer Docker-Container, neue Organisation) greifen die alten Constraints.

**Konsequenzen:**
- Neue Docker-Setups brechen beim ersten Pflicht-Event-Enrollment
- `waitlist` Status funktioniert in der Live-DB aber nicht in frischen Setups (bereits ein latenter Bug)
- Auto-Enrollment mit neuem Status schlaegt fehl mit kryptischem `23514 check_violation` Error

**Praevention:**
- ZUERST Schema-Datei mit tatsaechlicher DB synchronisieren -- `waitlist` in CHECK aufnehmen
- Dann neue Stati in einer Migration hinzufuegen: `ALTER TABLE event_bookings DROP CONSTRAINT ...; ALTER TABLE event_bookings ADD CONSTRAINT ... CHECK (status IN ('confirmed', 'waitlist', 'cancelled', 'enrolled'));`
- ENTSCHEIDUNG ob Pflicht-Event-Bookings einen eigenen Status brauchen oder `confirmed` wiederverwendet wird mit einem `enrollment_type` Feld (empfohlen: `enrollment_type` statt neuer Status)
- Migrations-Skript MUSS idempotent sein (IF NOT EXISTS Pattern)

**Erkennungszeichen:** `INSERT INTO event_bookings` schlaegt fehl bei frischem Docker-Setup, funktioniert aber in der bestehenden DB.

**Betroffene Phase:** Datenmodell/Migration (allererster Schritt)

---

### Pitfall 2: Auto-Enrollment erzeugt Konflikte mit UNIQUE-Constraint

**Was schiefgeht:** `event_bookings` hat einen UNIQUE-Constraint (Zeile 395): `UNIQUE (user_id, event_id)`. Wenn ein Pflicht-Event erstellt wird und Auto-Enrollment alle Jahrgangs-Konfis eintraegt, kann es Konflikte geben wenn:
1. Ein Konfi sich bereits manuell fuer dasselbe Event angemeldet hatte (vor dem Pflicht-Flag)
2. Admin setzt nachtraeglich das `mandatory`-Flag auf ein bestehendes Event -- Konfis die schon gebucht haben erzeugen UNIQUE-Violations
3. Serien-Events: Auto-Enrollment fuer Serien-Events muss fuer JEDES Einzel-Event separat laufen

**Warum es passiert:** Die bestehende Buchungslogik prueft `existingBooking` nur im Kontext einer einzelnen Buchung. Massenhafte Auto-Enrollment-INSERTs ueberspringen diese Pruefung.

**Konsequenzen:**
- Enrollment-Transaktion rollt komplett zurueck wenn EIN Konfi bereits gebucht ist
- Kein Konfi wird eingetragen obwohl nur einer das Problem hat
- Bei Serien-Events: eine einzige fehlgeschlagene Enrollment blockiert die ganze Serie

**Praevention:**
- `INSERT INTO event_bookings ... ON CONFLICT (user_id, event_id) DO UPDATE SET enrollment_type = 'mandatory'` -- bestehende Buchungen auf mandatory upgraden statt Fehler
- ODER: `ON CONFLICT DO NOTHING` und danach die bereits gebuchten separat taggen
- Serien-Events: Auto-Enrollment pro Einzel-Event, nicht in einer einzigen Transaktion
- Edge Case "Pflicht-Flag nachtraeglich setzen": Alle Konfis des Jahrgangs pruefen, nur fehlende nachbuchen, bestehende Buchungen als `mandatory` markieren

**Betroffene Phase:** Auto-Enrollment-Logik (Backend)

---

### Pitfall 3: Opt-out loescht Booking statt Status zu aendern

**Was schiefgeht:** Der bestehende Abmelde-Flow (`konfi.js` Zeile 1718-1830) LOESCHT die Booking (`DELETE FROM event_bookings`) und erstellt einen Eintrag in `event_unregistrations`. Bei Pflicht-Events ist das fatal:
1. Geloeschte Booking = kein Anwesenheits-Tracking moeglich
2. Wenn Admin den Opt-out ablehnen will, muss er den Konfi manuell wieder eintragen
3. Die Statistik "Wer hat sich abgemeldet vs. wer ist nicht erschienen" geht verloren

**Warum es passiert:** Der Abmelde-Flow wurde fuer freiwillige Events designed. "Abmeldung" = "will nicht mehr teilnehmen" = Buchung loeschen. Bei Pflicht-Events bedeutet "Opt-out" aber "kann nicht, mit Begruendung" -- die Buchung muss BESTEHEN BLEIBEN mit neuem Status.

**Konsequenzen:**
- Opt-out Konfi verschwindet aus der Teilnehmerliste -- Admin sieht ihn nicht mehr
- Anwesenheitsstatistik fehlen die abgemeldeten Konfis -- "100% anwesend" obwohl 3 sich abgemeldet haben
- Waitlist-Nachrueck-Logik (`cancel booking` Zeile 856-884) wird bei Pflicht-Events ausgeloest obwohl es keine Kapazitaetsbegrenzung gibt
- `event_unregistrations` Tabelle ist nicht in der Schema-Datei definiert (nur im Code referenziert)

**Praevention:**
- Pflicht-Event-Opt-out als STATUS-Aenderung implementieren (`status = 'opted_out'`), NICHT als DELETE
- Bestehenden Abmelde-Flow (`DELETE /events/:id/book`) NICHT fuer Pflicht-Events verwenden
- Neuer Endpoint: `PUT /events/:id/opt-out` mit `reason` Body -- aendert Status, loescht nicht
- Die `event_unregistrations` Tabelle PARALLEL als Audit-Log behalten (Grund + Zeitstempel)
- Kapazitaets-/Waitlist-Logik fuer Pflicht-Events komplett ueberspringen (Pflicht = keine Kapazitaet)

**Betroffene Phase:** Opt-out-Flow (Backend + Frontend), muss VOR Anwesenheitsstatistik fertig sein

---

### Pitfall 4: QR-Check-in ohne Offline-Fallback und Replay-Schutz

**Was schiefgeht:** QR-Code Check-in auf einem Smartphone erfordert:
1. Kamera-Zugriff (nicht immer genehmigt)
2. Netzwerk-Verbindung (Kirche/Gemeindehaus oft schlecht)
3. Schutz gegen Weitergabe des QR-Codes (Konfi fotografiert QR, gibt ihn weiter)

**Warum es passiert:** QR-Check-in wird als simples "QR scannen = anwesend" implementiert. In der Praxis scheitert es an physischen Gegebenheiten und der Kreativitaet von 14-Jaehrigen.

**Konsequenzen:**
- Kein Internet: QR-Scan schlaegt fehl, Admin muss manuell eintragen, QR-System verliert Glaubwuerdigkeit
- QR-Code-Weitergabe: Konfi ist "anwesend" obwohl er zu Hause ist
- Kamera-Permission-Dialog bei jedem Check-in auf iOS (wenn nicht persistent gespeichert)
- Admin-Geraet als Scanner: Flaschenhals wenn 30 Konfis gleichzeitig einchecken

**Praevention:**
- **Architektur-Entscheidung zuerst:** Wer scannt wen?
  - **Option A (empfohlen):** Admin/Teamer scannt QR-Codes der Konfis -- ein Geraet, kontrolliert
  - **Option B:** Konfis scannen einen Event-QR-Code -- 30 Geraete parallel, aber Weitergabe-Risiko
  - **Option C:** Beides optional -- mehr Code, mehr Edge Cases
- **Admin-scannt-Konfi-QR:** Konfi-App zeigt persistent einen QR-Code (Konfi-ID + HMAC-Signatur). Admin scannt, Backend validiert. Kein Replay-Problem weil Admin physisch neben dem Konfi steht
- **Konfi-scannt-Event-QR:** Event-QR als TOTP (zeitbasiert, rotierend alle 30s) -- verhindert Screenshot-Weitergabe. ABER: braucht Internet auf Konfi-Geraet
- **Manueller Fallback IMMER:** Bestehende Admin-Attendance-UI (`PUT /events/:id/participants/:id/attendance`) bleibt als Fallback. QR ist Beschleunigung, nicht Ersatz
- Capacitor Camera-Plugin fuer QR-Scanning, NICHT HTML5 getUserMedia (Performance, Permissions)

**Betroffene Phase:** QR-Check-in (eigene Phase, nach Basis-Anwesenheit)

---

### Pitfall 5: Punkte-Vergabe wird bei Pflicht-Events faelschlich ausgeloest

**Was schiefgeht:** Der bestehende Attendance-Endpunkt (`PUT /events/:id/participants/:id/attendance`, events.js Zeile 1288-1432) vergibt automatisch Punkte wenn `attendance_status === 'present' && eventData.points > 0`. Die Anforderung fuer v1.7 ist explizit: "Keine Punkte fuer Pflicht-Events, nur Anwesenheits-Tracking". Wenn der bestehende Endpunkt wiederverwendet wird OHNE Guard:
1. Admin setzt Anwesenheit -> Punkte werden vergeben -> widerspricht der Anforderung
2. Wenn `points = 0` gesetzt wird: funktioniert, ABER Admin koennte versehentlich Punkte konfigurieren
3. Level-Up-Notifications werden ausgeloest obwohl keine Punkte vergeben werden sollen

**Warum es passiert:** Der Attendance-Flow ist fest mit der Punkte-Vergabe gekoppelt (Zeile 1314-1385). Es gibt keine Trennung zwischen "Anwesenheit erfassen" und "Punkte vergeben".

**Konsequenzen:**
- Punkte fuer Unterricht/Pflicht-Events verfaelschen Ranking und Level
- Badge-Check (`checkAndAwardBadges`, Zeile 1343) laeuft unnoetig
- Push-Notification "Du hast X Punkte erhalten" obwohl es ein Pflicht-Event ohne Punkte ist

**Praevention:**
- Guard im Attendance-Endpunkt: `if (event.mandatory && eventData.points > 0) { /* skip points */ }`
- ODER besser: `events` Tabelle bekommt `mandatory BOOLEAN DEFAULT false` -- und wenn `mandatory = true`, wird `points` auf 0 erzwungen (DB-Level: `CHECK (NOT mandatory OR points = 0)`)
- Attendance-Endpunkt in zwei logische Bloecke trennen: (1) Status setzen, (2) Punkte vergeben (nur wenn nicht mandatory)
- Badge-Check und Level-Check nur ausfuehren wenn Punkte vergeben wurden

**Betroffene Phase:** Backend-Anpassung (Attendance-Flow) -- muss vor Frontend-Arbeit stehen

---

### Pitfall 6: Multi-Tenant-Isolation bei Auto-Enrollment durchbrochen

**Was schiefgeht:** Auto-Enrollment muss alle Konfis eines Jahrgangs eintragen. Die Query dafuer muesste sein:
```sql
SELECT u.id FROM users u
JOIN konfi_profiles kp ON u.id = kp.user_id
WHERE kp.jahrgang_id = $1 AND u.organization_id = $2 AND u.is_active = true
```
Wenn `organization_id` im WHERE vergessen wird, werden Konfis aus ANDEREN Organisationen eingetragen die zufaellig dieselbe Jahrgang-ID haben (Jahrgaenge sind pro Organisation, aber IDs sind global).

**Warum es passiert:** `jahrgang_id` klingt eindeutig, ist es aber nicht -- verschiedene Organisationen koennen Jahrgaenge mit gleicher ID haben (SERIAL-Counter). Bestehende Event-Queries filtern immer auf `organization_id`, aber eine neue Auto-Enrollment-Query koennte es vergessen.

**Konsequenzen:**
- Konfis aus Organisation A erscheinen in Pflicht-Events von Organisation B
- Datenschutz-Verstoss (DSGVO-relevant)
- Push-Notifications an falsche Konfis

**Praevention:**
- JEDE Enrollment-Query MUSS `organization_id` im WHERE haben
- Jahrgang-Lookup: IMMER `jahrgaenge.organization_id = req.user.organization_id` pruefen
- Test-Case: Zwei Organisationen mit Jahrgang-ID 1 -- darf NICHT cross-enrollen
- Review-Checkliste: Jede neue Query auf `organization_id` Filter pruefen

**Betroffene Phase:** Auto-Enrollment-Logik (Backend) -- Code-Review-Fokus

## Moderate Pitfalls

### Pitfall 7: Bestehende Konfi-Event-UI verwirrt bei Pflicht-Events

**Was schiefgeht:** Die Konfi-EventsView zeigt aktuell "Anmelden"/"Abmelden"-Buttons. Bei Pflicht-Events soll es keinen "Anmelden"-Button geben (automatisch eingetragen), aber einen "Abmelden mit Grund"-Button. Wenn die UI nicht klar zwischen freiwilligen und Pflicht-Events unterscheidet:
1. Konfi sieht "Abmelden" und denkt er kann sich einfach abmelden (ohne Grund)
2. Konfi sieht kein visuelles Kennzeichen dass das Event Pflicht ist
3. Bestehender "Stornieren"-Flow wird fuer Opt-out missbraucht (loescht Booking, siehe Pitfall 3)

**Praevention:**
- Visuelles Kennzeichen fuer Pflicht-Events: Icon/Badge "Pflicht" neben dem Event-Titel
- "Abmelden"-Button durch "Abmelden mit Begruendung"-Button ersetzen (oeffnet Modal mit Textfeld)
- "Anmelden"-Button bei Pflicht-Events komplett ausblenden (statt disabled)
- Registrierungsfenster-Logik (`registration_opens_at`/`registration_closes_at`) fuer Pflicht-Events ueberspringen

**Betroffene Phase:** Frontend Konfi-EventsView

---

### Pitfall 8: Anwesenheitsstatistik zaehlt Opt-outs falsch

**Was schiefgeht:** Die Statistik "3 von 20 Konfis fehlten" muss klar unterscheiden:
- **Entschuldigt abwesend:** Hat sich vorher per Opt-out abgemeldet (mit Grund)
- **Unentschuldigt abwesend:** War einfach nicht da (kein Opt-out, kein Check-in)
- **Anwesend:** Check-in erfolgt

Wenn Opt-outs als "absent" gezaehlt werden (wie im bestehenden `attendance_status`), gibt es keine Unterscheidung. Der Admin sieht "5 absent" aber weiss nicht ob 3 davon sich abgemeldet haben.

**Warum es passiert:** Bestehendes `attendance_status` Feld hat nur zwei Werte: `'present'` und `'absent'`. Ein dritter Wert wie `'excused'` fehlt.

**Praevention:**
- `attendance_status` um `'excused'` erweitern (CHECK-Constraint aktualisieren)
- ODER: Opt-out-Status in `event_bookings.status = 'opted_out'` speichern und `attendance_status` nur fuer tatsaechlich Anwesende/Abwesende nutzen (empfohlen -- sauberere Trennung)
- Statistik-Query: `COUNT(CASE WHEN status = 'confirmed' AND attendance_status = 'present')` vs. `COUNT(CASE WHEN status = 'opted_out')` vs. `COUNT(CASE WHEN status = 'confirmed' AND attendance_status = 'absent')`
- Dashboard-Widget: Drei Zahlen statt zwei (anwesend / entschuldigt / unentschuldigt)

**Betroffene Phase:** Anwesenheitsstatistik (Datenmodell-Entscheidung VOR Frontend)

---

### Pitfall 9: QR-Code-System Kollision mit bestehendem Invite-QR

**Was schiefgeht:** Das bestehende QR-Code-System (`AdminInvitePage.tsx`) generiert QR-Codes die auf `https://konfi-quest.de/register?code=XXXXXXXX` verweisen. Wenn der neue Event-Check-in-QR aehnlich aussieht, scannt ein Konfi versehentlich einen Invite-QR als Check-in oder umgekehrt.

**Warum es passiert:** Beide QR-Systeme verwenden dieselbe Library (`qrcode`), sehen visuell identisch aus, und die App muss entscheiden was mit dem gescannten Inhalt passieren soll.

**Konsequenzen:**
- Falscher QR-Typ wird gescannt -> Fehler oder unerwartete Aktion
- App versucht Check-in-QR als Invite zu interpretieren -> "Ungültiger Einladungscode"
- Verwirrung bei Admins die beide QR-Typen nutzen

**Praevention:**
- QR-Code-Inhalt mit Typ-Prefix: `konfiquest://invite/XXXXXXXX` vs. `konfiquest://checkin/EVENT_ID/HMAC`
- Scanner-UI erkennt den Typ und leitet entsprechend weiter
- Visuell unterscheidbar: Invite-QR mit anderem Farbschema als Check-in-QR
- Deeplink-Handler in der App der beide Typen dispatcht

**Betroffene Phase:** QR-Check-in (Datenformat-Design)

---

### Pitfall 10: Neue Konfis nach Event-Erstellung werden nicht nachgetragen

**Was schiefgeht:** Auto-Enrollment findet beim Erstellen des Events statt. Ein Konfi der DANACH dem Jahrgang beitritt (spaete Registrierung, Jahrgang-Wechsel), wird nicht automatisch fuer bestehende Pflicht-Events eingetragen.

**Warum es passiert:** Enrollment ist ein einmaliger Akt bei Event-Erstellung, kein reaktives System. Es gibt keinen Trigger "neuer Konfi im Jahrgang -> alle zukuenftigen Pflicht-Events buchen".

**Konsequenzen:**
- Neue Konfis fehlen in allen bestehenden Pflicht-Events
- Admin merkt es erst bei der Anwesenheitspruefung
- Statistik "15 von 20 anwesend" obwohl es 22 Konfis im Jahrgang gibt

**Praevention:**
- **Trigger-basiert (empfohlen):** Wenn ein Konfi einem Jahrgang zugewiesen wird (Registrierung oder Jahrgang-Wechsel), alle zukuenftigen Pflicht-Events dieses Jahrgangs finden und Auto-Enrollment ausfuehren
- Betroffene Stellen: `auth.js` (Konfi-Registrierung mit Invite-Code), `konfi-managment.js` (Jahrgang-Zuweisung durch Admin)
- `ON CONFLICT DO NOTHING` verwenden damit doppelte Enrollments keine Fehler erzeugen
- NICHT nur bei Event-Erstellung enrollen, sondern auch bei Jahrgang-Aenderung

**Betroffene Phase:** Auto-Enrollment-Logik (Backend) -- leicht zu vergessen, schwer nachtraeglich zu fixen

---

### Pitfall 11: "Was mitbringen"-Feld bricht bestehende Event-Erstellung

**Was schiefgeht:** Das neue optionale Textfeld "Was mitbringen" (`bring_items` o.ae.) auf Events muss:
1. In der `events` Tabelle als Spalte hinzugefuegt werden (Migration)
2. Im Event-Erstellen-Modal eingefuegt werden (Frontend)
3. Im Event-Update-Endpunkt (`PUT /events/:id`) mit aufgenommen werden
4. In der Konfi-Event-Ansicht und im Dashboard-Widget angezeigt werden

Wenn nur 1-3 gemacht werden aber 4 vergessen wird, sehen Admins das Feld aber Konfis nicht. Wenn nur 1 und 4 gemacht werden, kann es nie befuellt werden.

**Praevention:**
- Checkliste: Neue Event-Spalte -> 5 Stellen anpassen: Schema, CREATE, UPDATE, GET (Admin), GET (Konfi), Dashboard-Widget
- Migration-Skript: `ALTER TABLE events ADD COLUMN bring_items TEXT;` (nullable, kein Default noetig)
- Event-Validation: KEIN required-Check -- Feld ist optional fuer alle Events

**Betroffene Phase:** Event-Model-Erweiterung (fruehe Phase, geringe Komplexitaet)

---

### Pitfall 12: Kapazitaetsprufung-Logik greift bei Pflicht-Events

**Was schiefgeht:** Der bestehende Booking-Flow (`POST /events/:id/book`, Zeile 730-828) prueft:
- Registrierungsfenster (`registration_opens_at`/`registration_closes_at`)
- Kapazitaet (`max_participants`)
- Waitlist-Verfuegbarkeit

Pflicht-Events mit Auto-Enrollment DUERFEN diese Pruefungen nicht durchlaufen. Wenn Auto-Enrollment den bestehenden Book-Endpunkt aufruft statt direkt in die DB zu schreiben:
- `max_participants` blockiert das Enrollment wenn mehr Konfis als Plaetze existieren
- Registrierungsfenster blockiert Enrollment ausserhalb des Zeitraums
- Waitlist-Logik wird unnoetig ausgeloest

**Praevention:**
- Auto-Enrollment NICHT ueber den Book-Endpunkt routen
- Direkte DB-Inserts mit `ON CONFLICT DO NOTHING`
- `max_participants` bei Pflicht-Events auf 0 setzen (0 = unbegrenzt im bestehenden Code, Zeile 798: `if (totalCapacity > 0 && ...)`)
- ODER: Kapazitaetspruefung explizit ueberspringen wenn `event.mandatory = true`
- Registrierungsfenster bei Pflicht-Events ignorieren (immer "offen" fuer Auto-Enrollment)

**Betroffene Phase:** Auto-Enrollment-Logik (Backend-Architektur)

## Geringfuegige Pitfalls

### Pitfall 13: Push-Notification-Spam bei Massen-Enrollment

**Was schiefgeht:** Wenn 30 Konfis gleichzeitig per Auto-Enrollment eingetragen werden und jedes Enrollment eine Push-Notification ausloest, erhaelt jeder Konfi eine Nachricht. Bei Serien-Events mit 10 Terminen = 300 Notifications auf einmal.

**Praevention:**
- EINE Push-Notification pro Konfi bei Pflicht-Event-Erstellung: "Du wurdest fuer [Event-Name] eingetragen"
- Bei Serien-Events: "Du wurdest fuer [Serien-Name] (10 Termine) eingetragen" -- EINE Nachricht
- Batch-Versand: PushService.sendToJahrgangKonfis() statt Einzel-Notifications in Schleife
- Rate-Limiter fuer Push nicht triggern (bestehender Rate-Limiter: 10 Fehlversuche / 15 Min Cooldown)

**Betroffene Phase:** Auto-Enrollment (Push-Integration)

---

### Pitfall 14: Anwesenheitsstatistik ohne Zeitraum-Filter

**Was schiefgeht:** "Anwesenheitsstatistik pro Konfi" ohne Zeitraum-Filter zeigt ALLE Events seit Beginn. Bei aktiven Gemeinden mit 2+ Events pro Woche wird die Liste schnell unuebersichtlich und die Anwesenheitsquote (z.B. 85%) hat keinen Kontext.

**Praevention:**
- Default-Zeitraum: Aktuelles Konfirmationsjahr (vom Jahrgangs-Startdatum bis heute)
- Filteroption: Letzter Monat, letztes Quartal, gesamt
- Nur Pflicht-Events in die Anwesenheitsquote einrechnen (freiwillige Events verfaelschen die Quote)
- Gruppenstatistik pro Jahrgang: Durchschnittliche Anwesenheitsquote

**Betroffene Phase:** Anwesenheitsstatistik (Frontend)

---

### Pitfall 15: Event-Loeschen mit Auto-Enrollment-Bookings

**Was schiefgeht:** Der bestehende Loesch-Flow (`DELETE /events/:id`, Zeile 616-728) verhindert das Loeschen wenn `confirmed` Bookings existieren (Zeile 630-634). Bei Pflicht-Events haben IMMER alle Konfis eine Booking -> Event kann NIE geloescht werden.

**Praevention:**
- Loesch-Guard fuer Pflicht-Events anpassen: Enrolled-Bookings zaehlen nicht als Blocker
- ODER: Pflicht-Events koennen nur abgesagt werden (bestehendes Cancel-Feature, `PUT /events/:id/cancel`), nicht geloescht
- Cancel-Flow bei Pflicht-Events: Alle Enrollments auf `cancelled` setzen + Push an alle Konfis

**Betroffene Phase:** Backend-Anpassung (Event-Lifecycle)

## Phasen-spezifische Warnungen

| Phase-Thema | Wahrscheinlicher Pitfall | Mitigation |
|-------------|--------------------------|------------|
| Datenmodell/Migration | CHECK-Constraint blockiert neue Stati (Pitfall 1) | Schema-Datei zuerst synchronisieren, dann erweitern |
| Auto-Enrollment | UNIQUE-Violations bei Massen-Insert (Pitfall 2) | ON CONFLICT DO NOTHING/UPDATE verwenden |
| Auto-Enrollment | Neue Konfis nicht nachgetragen (Pitfall 10) | Trigger bei Jahrgang-Zuweisung, nicht nur bei Event-Erstellung |
| Auto-Enrollment | Kapazitaetspruefung greift (Pitfall 12) | Direkte DB-Inserts, nicht ueber Book-Endpunkt |
| Opt-out-Flow | Booking wird geloescht statt Status geaendert (Pitfall 3) | Neuer Endpoint PUT statt bestehendes DELETE |
| QR-Check-in | Kein Offline-Fallback (Pitfall 4) | Admin-scannt-Konfi als Default, manueller Fallback immer |
| QR-Check-in | Kollision mit Invite-QR (Pitfall 9) | Typ-Prefix im QR-Inhalt |
| Attendance-Backend | Punkte werden bei Pflicht-Events vergeben (Pitfall 5) | Guard: mandatory -> keine Punkte |
| Anwesenheitsstatistik | Opt-outs nicht von Abwesenheit unterscheidbar (Pitfall 8) | Drei-Werte-Modell: anwesend/entschuldigt/unentschuldigt |
| Multi-Tenant | organization_id im Enrollment vergessen (Pitfall 6) | Code-Review-Checkliste |
| Event-Lifecycle | Pflicht-Event nicht loeschbar (Pitfall 15) | Cancel statt Delete, oder Guard anpassen |

## Abhaengigkeits-Reihenfolge der Pitfall-Mitigationen

```
1. Datenmodell-Entscheidungen (Pitfall 1, 8)
   - CHECK-Constraint synchronisieren
   - Status-Modell festlegen: enrolled/opted_out/excused
   - mandatory-Spalte auf events
   - bring_items-Spalte auf events (Pitfall 11)
   |
   v
2. Auto-Enrollment-Backend (Pitfall 2, 6, 10, 12, 13)
   - Enrollment-Logik mit ON CONFLICT
   - Tenant-Isolation sicherstellen
   - Trigger bei Jahrgang-Zuweisung
   - Kapazitaetspruefung ueberspringen
   - Push-Batch statt Einzel-Notifications
   |
   v
3. Opt-out-Flow (Pitfall 3)
   - Neuer Endpunkt, Status-Aenderung statt DELETE
   - Audit-Log in event_unregistrations beibehalten
   |
   v
4. Attendance-Backend (Pitfall 5)
   - Punkte-Guard fuer mandatory Events
   - Badge/Level-Check ueberspringen
   |
   v
5. Frontend parallel:
   - Konfi-Event-UI (Pitfall 7)
   - Anwesenheitsstatistik (Pitfall 8, 14)
   - Dashboard-Widget "Naechstes Event"
   |
   v
6. QR-Check-in (Pitfall 4, 9)
   - Eigene Phase, kann spaeter kommen
   - QR-Format mit Typ-Prefix
   - Scanner-UI mit Fallback
   |
   v
7. Event-Lifecycle (Pitfall 15)
   - Loesch-Guard anpassen
   - Cancel-Flow fuer Pflicht-Events
```

## Quellen

- Direkte Code-Analyse: `events.js` (1500+ Zeilen, alle CRUD- und Booking-Endpunkte), `konfi.js` (Unregistration-Flow Zeile 1718-1830), `01-create-schema.sql` (event_bookings CHECK-Constraints Zeile 387), `AdminInvitePage.tsx` (QR-Code-System)
- Bestehende Datenmodelle: `event_bookings` (status, attendance_status, UNIQUE-Constraint), `events` (Kapazitaet, Registration-Windows, Series), `event_unregistrations` (nur im Code, nicht in Schema)
- Projekt-Historie: v1.4 Event-Logik transaktionssicher (Race Conditions, Waitlist-Nachruecken), v1.5 Push-Notifications (18 Types), v1.6 Punkte-Typ-Konfiguration
- Architektur-Kontext: `PROJECT.md` (v1.7 Active Requirements), `CLAUDE.md` (RBAC, Multi-Tenant-Isolation)

---
*Pitfalls research for: Konfi Quest v1.7 Pflicht-Events, QR-Check-in, Auto-Enrollment, Anwesenheitsstatistik*
*Researched: 2026-03-09*
