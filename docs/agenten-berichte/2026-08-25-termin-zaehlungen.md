> **TEILWEISE ERLEDIGT** am 25.08.2026 durch `bdc04fad`.
>
> Behoben: Befund 1 (Anmeldung fälschlich geschlossen — Prod-Event 150,
> nachgemessen), Befund 2 (Detail zählte Teamer mit — Event 105: 23 statt 19),
> Befund 4 (`opted_out` galt als "ausstehend").
>
> **Offen:** Befund 3 (`unprocessed_count` zählt Teamer mit) braucht eine
> fachliche Entscheidung. Die sechs kleineren Befunde sind nicht angefasst.
> Der Vereinfachungsvorschlag (gemeinsame SQL-View statt fünf Stellen mit drei
> Semantiken) steht weiterhin — er ist der eigentliche Hebel gegen die
> Fehlerklasse und gehört nach 2.0.0.
>
> **Nebenwirkung, die im Blick bleiben muss:** Seit Befund 2 rechnet
> `hasUnprocessedBookings` konfi-rein. Bei reinen Team-Terminen (0 Konfis)
> zeigt der Detail-Kopf nach dem Termin dadurch kein "Verbuchen" mehr — das
> hängt an Befund 3.

# Termin-Zählungen: Prüfung aller Zähl- und Statistikfunktionen

**Auftrag:** Systematische Prüfung aller Zähl- und Statistikfunktionen rund um
Termine (Events) in Backend und allen drei Rollen-Komponentenbäumen, nach den
drei am 25.08. gefundenen Fehlern. Analyse, kein Umbau.
**Datum:** 25.08.2026
**Geprüfter Commit:** `6b12e672` (main)
**Urteil in einem Satz:** Die drei heutigen Fehler waren kein Zufall — der
Detail-Endpunkt und die beiden Konfi-Status-Queries zählen bis heute anders
als der Listen-Endpunkt (Teamer mal drin, mal draußen; fehlender
Unbegrenzt-Guard), und dieselbe Statuslogik existiert in mindestens sieben
abweichenden Kopien; ein aktiver Produktionsfall (Event 150) und mehrere
scharf geladene Latenzfälle sind belegt.

---

## 1. Was die Backend-Felder tatsächlich bedeuten

Es gibt **fünf** Stellen, die Buchungszahlen berechnen — und sie stimmen
**nicht** überein:

| Endpunkt | Feld | Zählt | Teamer? | Beleg |
|---|---|---|---|---|
| `GET /events` (Liste, alle Rollen) | `registered_count` | `status='confirmed'` | **nein** | events.js:145 |
| | `waitlist_count` | `status='waitlist'` | **nein** | events.js:146 |
| | `unprocessed_count` / `pending_bookings_count` | `confirmed` + `attendance_status IS NULL` | **ja** | events.js:147, 268 |
| | `total_participants` | `COUNT(*)` — **inkl. `opted_out`** | ja | events.js:148 |
| | `teamer_count` / `teamer_waitlist_count` | confirmed/waitlist + Rolle teamer | — | events.js:149–150 |
| `GET /events/cancelled` | `registered_count`, `waitlist_count`, `unprocessed_count` | wie oben, aber **ohne Rollenfilter** (Teamer inkl.); `teamer_count` fehlt ganz | **ja** | events.js:285–287 |
| `GET /events/:id` (Detail) | `registered_count` | `confirmed` — **inkl. Teamer** | **ja** | events.js:741 |
| | `pending_count` (= Warteliste, anderer Name!) | `waitlist` inkl. Teamer | **ja** | events.js:742 |
| | `available_spots` | Kapazität − registered_count (inkl. Teamer) | ja | events.js:782 |
| `GET /konfi/events` | `registered_count`, `waitlist_count`, `teamer_count` | wie Admin-Liste (konfi-rein) | nein | konfi.js:1172–1174 |
| `GET /konfi/events/:id/status` | `registered_count`, `waitlist_count` | `confirmed`/`waitlist` **ohne Rollenfilter** | **ja** | konfi.js:1264–1265 |

Dazu: Timeslot-Zähler (`registered_count`/`waitlist_count` je Slot) ohne
Rollenfilter (events.js:616–617, 694–695; konfi.js:1480–1481) — praktisch
konfi-rein, weil Teamer nie in Slots buchen (events.js:1639 "KEIN Timeslot
für Teamer", ebenso events.js:2078). Serien-Geschwister:
`registered_count` = confirmed **inkl. Teamer** (events.js:678–680).
`GET /events/:id/attendance-count`: `checked_in`/`total` beide inkl. Teamer —
in sich konsistent (events.js:580–584), Anzeige QRDisplayModal.tsx:178.

Die Buchungslogik selbst (bookingUtils.js) ist sauber: `getEventWithCounts`
mit `excludeTeamers`, `promoteFromWaitlist` mit Pflicht-`roleFilter`,
`determineBookingStatus` behandelt `maxCapacity 0 = unbegrenzt`
(bookingUtils.js:91).

**Statusverwechslung (Frage 4):** `opted_out` wird in allen Zählern korrekt
herausgefiltert (überall `status='confirmed'`-Filter). Die Ausnahmen stehen
unten als Befunde 4 und der Notiz zu `total_participants`.

**Gegenmessung Prod (Event 105, Org 1):** 19 konfi confirmed, 4 teamer
confirmed, 2 konfi opted_out, attendance überall NULL, mandatory=t,
max_participants=0, waitlist_enabled=f — deckt sich mit der Analyse; die
Liste liefert dafür 19/0/4, das Detail liefert `registered_count=23`.

---

## 2. Befunde, nach Schwere sortiert

### Befund 1 (HOCH): Konfi-Queries melden unbegrenzte Events ohne Warteliste als "geschlossen"

Die Admin-Liste prüft Ausgebucht nur bei echter Kapazität:
`(... ) > 0 AND bstats.registered_count >= (...)` (events.js:127–130).
Den `> 0`-Guard **fehlt** in beiden Konfi-Queries:

- `GET /konfi/events`: `WHEN bstats.registered_count >= max ... THEN 'closed'`
  (konfi.js:1136–1141). Bei `max_participants=0` ist `N >= 0` immer wahr;
  ist zusätzlich `waitlist_enabled=false`, wird das Event `'closed'`.
- `GET /konfi/events/:id/status`: identisches Loch (konfi.js:1273–1279),
  dort obendrein ohne Rollenfilter.

Beiden Konfi-Queries fehlt außerdem der `'mandatory'`-Zweig, den die
Admin-Liste hat (events.js:123) — Pflichttermine (immer max=0 + Warteliste
aus, siehe `effectiveWaitlist` events.js:862) sind für Konfis deshalb
ebenfalls `'closed'`; das fängt derzeit nur die mandatory-Sonderlogik im
Konfi-UI ab (EventsView.tsx:187–214).

Wirkung bei nicht-Pflicht-Events: Konfi-Liste zeigt "Geschlossen", das
Detail blendet den Anmelden-Button aus, weil er an
`registration_status === 'open'` hängt (konfi/views/EventDetailView.tsx:915)
— obwohl die Buchungsroute die Anmeldung annehmen würde.

**Prod gemessen:** Event 150 "Gemeindeversammlung" (Org 3, Anmeldefenster
offen bis 06.09., max=0, Warteliste aus, nicht Pflicht) → simulierte
Konfi-Query ergibt `'closed'`. Einzige Rettung: Das Event hat keine
Jahrgangszuweisung und ist über den INNER JOIN (konfi.js:1164) für Konfis
gar nicht sichtbar. Sobald ein solches Event einem Jahrgang zugewiesen wird,
ist der Fehler live.

### Befund 2 (HOCH, latent): Detail-Endpunkt zählt Teamer in `registered_count` — Liste nicht

`GET /events/:id` berechnet `registered_count` aus **allen** confirmed
Buchungen (events.js:741), die Liste schließt Teamer aus (events.js:145).
Das Admin-Detail rechnet damit Status:

- `calculateRegistrationStatus`: `registered_count >= max_participants`
  → 'closed' (admin/views/EventDetailView.tsx:254)
- "Ausgebucht"/"Warteliste"-Farbe und -Text (ebd.:285–286, 306–307)

Bei einem `teamer_needed`-Event mit Kapazität (z.B. 10 Konfi-Plätze, 8
Konfis + 3 Teamer) meldet das Detail "Ausgebucht", die Liste "Offen".
**Prod gemessen:** aktuell 0 betroffene Events (Abfrage C) — reiner
Zufall der Datenlage, seit Migration 120 jederzeit auslösbar.

Die Kopf-Kacheln des Admin-Details sind hiervon NICHT betroffen — sie
zählen selbst aus `participants` mit Rollenfilter (EventDetailView.tsx:661 ff.,
heutiger Fix `0db13f09`). Dasselbe Feld heißt im Detail außerdem
`pending_count` statt `waitlist_count` (events.js:778) und
`available_spots` (events.js:782) zieht Teamer von der Konfi-Kapazität ab —
beide Felder werden im Frontend nirgends gelesen (nur Typdeklarationen,
admin/views/EventDetailView.tsx:57, EventDetailSections.tsx:70).

### Befund 3 (MITTEL, latent): `unprocessed_count` zählt Teamer, "Alle bestätigen" verbucht sie nicht — Termine klemmen im Verbuchen-Tab

- `unprocessed_count` = confirmed + attendance NULL **ohne** Rollenfilter
  (events.js:147).
- `PUT /:id/participants/attendance-all` verbucht bewusst **nur** Konfis
  (`r.name = 'konfi'`, events.js:2733–2740).
- Der Verbuchen-Tab der Leitung hängt allein an `pending_bookings_count`
  (AdminEventsPage.tsx:237–239).

Folge: Ein vergangenes Event, dessen Konfis alle verbucht sind, dessen
Teamer aber nicht (jede:r muss einzeln verbucht werden), bleibt im
Verbuchen-Tab hängen. Gleichzeitig zeigt die Karte es NICHT als
"Verbuchen" an, weil dort zusätzlich `registered_count > 0` (Konfi-Zahl)
verlangt wird (EventsView.tsx:291–292) — bei `teamer_only`-Events sagt der
Tab also "Verbuchen", die Karte "Geschlossen".
**Prod gemessen:** aktuell 0 Fälle (Abfrage B); 15 Teamer-Buchungen
existieren, der Fall entsteht mit dem nächsten vergangenen Team-Termin.

### Befund 4 (MITTEL, in Prod sichtbar): Anwesenheitsmatrix und -liste behandeln Abgemeldete als "ausstehend"

- `AttendanceMatrixModal.tsx:190–196`: `getCellStatus` prüft nur
  `attendance_status`; `b.status === 'opted_out'` fällt auf 'open' —
  Abgemeldete sind von "noch nicht verbucht" nicht unterscheidbar.
- Kopfspalte `stats.present}/{data.events.length` (ebd.:430): der Nenner
  zählt auch Termine, von denen der Konfi abgemeldet ist.
- Dieselbe Rechnung serverseitig in der Anwesenheitsliste:
  `present_count` gegen `totalEvents` ohne Abzug der Abmeldungen
  (jahrgaenge.js:535–541).

Das ist exakt das Muster von Fehler 1 vom Vormittag (dort im Event-Detail
behoben: Abgemeldete raus aus der Teilnehmerzahl, Commit `0db13f09`) — in
Matrix und Liste steht es noch. **Prod:** Events 105 (2x), 129 (1x),
132 (1x) haben Abmeldungen an Pflichtterminen; die Matrix zeigt diese
Zellen heute als "ausstehend". Unsicher ist nur die fachliche Sollvorgabe
(eigenes Symbol "abgemeldet" vs. Zelle ausblenden) — dass der Ist-Zustand
falsch liest, ist sicher.

### Befund 5 (MITTEL): `GET /events/cancelled` liefert eine dritte Semantik

`registered_count`/`waitlist_count` inkl. Teamer, `unprocessed_count` inkl.
Teamer, `teamer_count`/`teamer_waitlist_count` fehlen ganz
(events.js:285–287). Die Admin-Liste rendert abgesagte und aktive Events
mit demselben Code (AdminEventsPage mischt beide Quellen, Z. 228–231):
Ein abgesagter Team-Termin zeigt daher "N Konfis" (inkl. Teamer) und
"0/∞ Team" (EventsView.tsx:413–421); der Lösch-Dialog zählt bei abgesagten
Terminen Teamer mit, bei aktiven nicht (AdminEventsPage.tsx:319).

### Befund 6 (KLEIN): Lösch-Rückfrage unterschlägt Team-Anmeldungen

`anmeldungen = registered_count + waitlist_count` (AdminEventsPage.tsx:319)
— ohne `teamer_count`/`teamer_waitlist_count`. Ein `teamer_only`-Event mit
4 gebuchten Teamern läuft in den "wirklich löschen?"-Pfad ohne den Hinweis
"hat N Anmeldungen, alle werden benachrichtigt" (das Backend benachrichtigt
die Teamer trotzdem).

### Befund 7 (KLEIN, latent): `waitlist_position` — zwei Uhren, keine Filter

- Konfi-Liste: Position per `created_at` über **alle** Wartelisten-Einträge
  des Events (konfi.js:1199–1205) — inkl. Teamer-Warteliste (eigenes
  Kontingent!) und inkl. anderer Timeslots.
- `/status`-Endpunkt: Position per `booking_date` (konfi.js:1301–1307).

Beide können voneinander und von der echten Nachrück-Reihenfolge
(`promoteFromWaitlist`: `created_at` + Rollenfilter + Timeslot,
bookingUtils.js:131–140) abweichen. **Prod:** derzeit 0 Teamer- und
0 Timeslot-Wartelisteneinträge (7 Einträge gesamt) — ohne aktuelle Wirkung.

### Befund 8 (KLEIN): Serien-Geschwister zählen Teamer als "TN"

`series_events[].registered_count` inkl. Teamer (events.js:678–680), Anzeige
"N/∞ TN" und `isFull`-Rechnung in EventDetailSections.tsx:445, 467.

### Befund 9 (KLEIN): Wartelisten-Größe 0 hat drei Bedeutungen

`teamer_max_waitlist_size`/`max_waitlist_size` = 0 heißt im Teamer-Frontend
"unbegrenzt" (TeamerEventsPage.tsx:1005–1008), in `determineBookingStatus`
"10" (`|| 10`, bookingUtils.js:88) und in den Status-Queries "0 = sofort
voll" (`COALESCE(e.max_waitlist_size, 0)`, events.js:130). Praktisch kaum
erreichbar, weil Create/Update `|| 10` erzwingen (events.js:890, 1077) —
aber ein Altbestand oder direkter DB-Wert 0 verhielte sich dreifach anders.

### Befund 10 (KLEIN): Konfi-Liste nennt Pflichttermin "Angemeldet" auch ohne Buchung

`else if (isMandatory) statusText = 'Angemeldet'`
(konfi/views/EventsView.tsx:214) greift auch für Konfis ohne Buchung
(z. B. nach dem Termin-Anlegen, bevor die Leitung sie einträgt).

### Notizen (keine Fehler, aber Ballast)

- `total_participants` (events.js:148): `COUNT(*)` inkl. `opted_out` — im
  gesamten Frontend ungenutzt und semantisch irreführend benannt.
- `available_spots` und Detail-`pending_count`: ungenutzt (nur Typen).
- `booking_status === 'pending'` wird im Konfi-Frontend als
  Wartelisten-Alias toleriert (EventsView.tsx:156,
  DashboardSections.tsx:291); das Backend schreibt seit der
  Vereinheitlichung nur noch 'waitlist' (Kommentar konfi.js:1498) —
  toter Zweig, unschädlich.
- Buchende Rollen in Prod: ausschließlich konfi (546) und teamer (15) —
  die Sorge "Leitung bucht und fällt in die Konfi-Zählung" ist derzeit
  ohne Datenbestand.

---

## 3. Sonderfall-Matrix (Frage 3)

| Kombination | Verhalten heute | Problem |
|---|---|---|
| `mandatory` (max=0, Warteliste aus) | Admin-Liste: Status 'mandatory'; Konfi-Query: **'closed'** (Befund 1); UI-Kacheln seit heute korrekt "19 von 21" | latent, UI fängt es ab |
| `teamer_only` | Liste/Detail/Teamer-Seite seit heute (`b814e401`) ohne Konfi-Werte; aber: Verbuchen-Tab vs. Karte widersprüchlich (Befund 3), Lösch-Dialog blind (Befund 6), abgesagt ohne teamer_count (Befund 5) | mittel |
| `teamer_needed` + Kapazität | Liste korrekt getrennt; **Detail-Status zählt Teamer gegen Konfi-Plätze** (Befund 2) | latent |
| `has_timeslots` | Slot-Zähler faktisch konfi-rein (Teamer buchen keine Slots); `waitlist_position` event- statt slotweit (Befund 7) | klein |
| `is_konfirmation` | Sperrlogik zählt nur confirmed-Buchungen — sauber (konfi.js:1537–1546, events.js:1699 ff.) | — |
| `cancelled` | eigener Endpunkt mit eigener (dritter) Zähl-Semantik (Befund 5) | mittel |
| `waitlist_enabled=false` + max=0 | Konfi: "Geschlossen" trotz offener, unbegrenzter Anmeldung (Befund 1, Event 150) | hoch |

---

## 4. Vereinfachungsvorschlag (Frage 5)

Die Komplexität ist tatsächlich strukturell: **fünf** SQL-Stellen berechnen
Buchungszahlen (drei Semantiken), **drei** SQL-Stellen berechnen
`registration_status` (zwei Semantiken), und **vier** Frontend-Kaskaden
(Admin-Liste, Admin-Detail, Konfi-Liste, Teamer-Seite) übersetzen das je
eigenständig in Farbe/Text. Jeder Fix muss heute bis zu zwölf Stellen treffen
— genau daran sind die drei heutigen Fehler entstanden.

**Vorschlag in zwei Schritten:**

1. **Backend: eine Statistik-Quelle.** Das LATERAL-Aggregat aus
   events.js:139–157 als SQL-View `event_booking_stats` (oder als
   exportierter Query-Baustein in bookingUtils.js, analog
   `getEventWithCounts`) mit festen, konfi-reinen Feldern:
   `registered_count`, `waitlist_count`, `teamer_count`,
   `teamer_waitlist_count`, plus getrennt `unprocessed_konfi_count` und
   `unprocessed_teamer_count`. Alle fünf Endpunkte (Liste, /cancelled,
   Detail, Konfi-Liste, /status) joinen dagegen. `total_participants`,
   `available_spots` und Detail-`pending_count` ersatzlos streichen (im
   Frontend ungenutzt). Ebenso die `registration_status`-CASE **einmal**
   definieren (mit `> 0`-Guard, `mandatory`- und `cancelled`-Zweig) und in
   beide Konfi-Queries übernehmen — das erledigt Befund 1 und 2 nebenbei.
   Aufwand: ca. 1 Tag inkl. Tests (Test für Event-150-Konstellation und
   für teamer_needed-mit-Kapazität als Regressionsschutz).
   Risiko: mittel — fünf produktive Queries ändern sich; die View selbst
   ist mechanisch identisch zur heutigen Listen-Query, die als einzige
   überall stimmt.

2. **Frontend: ein Statushelfer.** `utils/eventStats.ts` mit
   `getKonfiZahlen(event)`, `getTeamerZahlen(event)` und
   `getEventStatus(event, rolle)` (Farbe + Text + Icon), gespeist nur aus
   Backend-Feldern — die vier Kaskaden (admin/EventsView.tsx:296–333,
   admin/views/EventDetailView.tsx:244–307, konfi/views/EventsView.tsx:
   150–230, TeamerEventsPage.tsx:570–610) rufen ihn auf und behalten nur
   ihre rollenspezifischen Zweige (angemeldet/Warteliste/eigene
   Anwesenheit). Aufwand: 1–2 Tage, gut schrittweise machbar (eine Ansicht
   nach der anderen). Risiko: gering pro Schritt, da rein darstellend.

**Nicht** empfohlen vor 2.0.0: beides in einem Zug. Erst die konkreten
Bugs (unten), Strukturumbau als eigenes Arbeitspaket direkt danach.

---

## 5. Priorisierung

**Vor Release 2.0.0 fixen:**
1. Befund 1 — `> 0`-Guard plus `mandatory`/`cancelled`-Zweig in
   konfi.js:1136–1142 und konfi.js:1271–1280 nachziehen (kleiner,
   isolierter SQL-Fix; Testfall: Event-150-Konstellation).
2. Befund 2 — Detail-`registered_count` konfi-rein machen
   (events.js:741–742 mit Rollenfilter wie Z. 145) ODER das Admin-Detail
   auf die ohnehin vorhandene participants-Zählung umstellen
   (EventDetailView.tsx:254, 276–307). Achtung: Konfi-Detail nutzt die
   Konfi-Liste, nicht diesen Endpunkt — kein Konfi-Seiteneffekt.
3. Befund 4 — Matrix/Anwesenheitsliste: `opted_out` als eigener
   Zellstatus, Nenner um Abmeldungen bereinigen (konsistent zum heutigen
   Kachel-Fix `0db13f09`). Fachliche Darstellung kurz mit Simon klären.

**Sollte zeitnah (klemmt sonst im Alltag der Leitung):**
4. Befund 3 — Entscheidung nötig: entweder `unprocessed_count` auf Konfis
   einschränken (dann verschwindet ein Team-Termin nach dem
   Konfi-Verbuchen aus dem Tab) oder Teamer-Verbuchung in den Tab- und
   Kartenzustand aufnehmen. Zusammen mit Befund 5 (cancelled-Endpunkt auf
   dieselbe Zähl-Semantik heben) erledigen.

**Kann warten (nach 2.0.0, idealerweise im Zuge des Strukturumbaus):**
5. Befunde 6–10, Streichung der toten Felder, Vereinheitlichung
   `waitlist_position`, Vereinfachungsschritte 1+2.
