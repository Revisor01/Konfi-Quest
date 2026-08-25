> **ERLEDIGT** am 25.08.2026 durch `ccf09d5f` (im Register abgehakt).
> Alle drei Punkte waren längst behoben, nur nicht vermerkt.

# Befund: drei offene Punkte aus BAUSTELLEN.md (25.08.2026)

Nur Analyse, keine Änderungen im Repo.

---

## 1. Zeile 236: "Socket.IO — Pushes nach dem Abmelden."

**Urteil: ERLEDIGT im Kern (Commit `f267a982`, 23.08.), mit einer Restlücke
beim Sitzungsablauf — die aber ein anderer Fall ist als der Registereintrag.**

Der Eintrag ist nur eine Zeile ohne Detail, benennt aber genau den Fall, den
`f267a982` behoben hat. Die Commit-Nachricht dort widerlegt sogar die
Überschrift des Registereintrags: Push läuft über Firebase/APNs, NICHT über
Socket.IO. Der Titel "Socket.IO" ist also eine falsche Zuordnung im Register.

Beleg im aktuellen Code:
- `backend/routes/auth.js:1191-1215` — `POST /auth/logout` nimmt `device_id`
  und `platform` entgegen und löscht in Zeile 1207-1210 den Push-Token dieses
  Geräts (`DELETE FROM push_tokens WHERE user_id = $1 AND device_id = $2 AND
  platform = $3`), in einem try/catch, das den Logout nie aufhält.
- `frontend/src/services/auth.ts:105-107` — Client ruft zusätzlich
  `DELETE /notifications/device-token`; `auth.ts:124-127` schickt `device_id`
  und `platform` an `/auth/logout` mit. Zwei unabhängige Wege.
- Tests: `backend/tests/routes/auth.test.js:186-241` — eigener Token weg
  (186-200), Token anderer Geräte desselben Nutzers bleiben (208-224,
  harte Assertion `toEqual(['tablet'])`), Token anderer Nutzer auf demselben
  Gerät bleiben (229-241).

Der spätere Commit `cda3d1f5` (24.08.) betrifft NUR die Socket-Verbindung
beim Sitzungsablauf (`frontend/src/services/websocket.ts:122-131`, hört auf
`auth:relogin-required` und trennt). Er berührt Push-Tokens nicht — musste er
auch nicht, weil `f267a982` das schon abdeckte. Seine Commit-Nachricht hält
das explizit fest ("Push-Token doppelt abgesichert").

**Restlücke (verifiziert, nicht spekuliert):** Beim Sitzungsablauf, also wenn
der Token-Refresh endgültig scheitert, feuert `frontend/src/services/api.ts:201`
bzw. `:241` das Event `auth:relogin-required` und räumt lokal auf. Auf diesem
Pfad wird WEDER `DELETE /notifications/device-token` NOCH `POST /auth/logout`
gerufen (die einzigen beiden Aufrufstellen liegen in
`frontend/src/services/auth.ts:106` und `:124`, beide nur im bewussten
`logout()`). Der Push-Token des Geräts bleibt also stehen, bis sich dort
jemand neu anmeldet. Praktische Bedeutung ist begrenzt: Der Refresh-Token ist
in diesem Moment ohnehin abgelaufen oder revoked, ein serverseitiger Delete
wäre also nicht mehr authentifizierbar; es bräuchte eine eigene Lösung
(z.B. Löschen im letzten noch gültigen Moment oder Aufräumen anhand
revokierter Sitzungen). *Unsicher, ob Simon diesen Fall überhaupt mitgemeint
hat — der Registereintrag nennt ausdrücklich "nach dem Abmelden".*

Vorschlag: Punkt abhaken mit Verweis auf `f267a982`, die Restlücke
"Sitzungsablauf räumt den Push-Token nicht ab" als eigenen, kleineren Punkt
neu aufnehmen — und dabei die falsche Zuordnung zu Socket.IO korrigieren.

---

## 2. Zeile 196: "Jahrgangswechsel — was passiert mit Pflichtterminen?"

**Urteil: ERLEDIGT (Commit `a164e888` legte die Grundlage, `9d3eeeb3` vom
24./25.08. schloss den Chat-Teil). Der Termin-Teil IST behandelt — der
Commit-Titel "Chat-Austritt beim Jahrgangswechsel" verschweigt das nur.**

Beleg im aktuellen Code, `backend/routes/konfi-management.js`,
`PUT /konfis/:id`:
- Zeile 311-351: Pflichttermine des ALTEN Jahrgangs werden abgeräumt.
  Das `DELETE FROM event_bookings ... USING events` (Zeile 323-338) ist
  bewusst eng gefasst und die Bedingungen stehen wörtlich im Code:
  nur `attendance_status IS NULL` (erfasste Anwesenheit bleibt),
  nur `e.mandatory = true`, nur `e.event_date > NOW()` (Historie unberührt),
  und `NOT EXISTS`-Klausel auf den NEUEN Jahrgang (Termine, die zu beiden
  Jahrgängen gehören, bleiben gebucht).
- Zeile 344-346: Wer entbucht wird, fliegt auch aus dem Event-Chat
  (`removeFromEventChat`) — das ist der Teil, den der Commit-Titel nennt.
- Zeile 352-375: Pflichttermine des NEUEN Jahrgangs werden nachgebucht
  (`INSERT ... ON CONFLICT DO NOTHING`), inklusive Eintritt in deren Chats
  (`addToEventChat`, Zeile 372-374).
- Zeile 301-306: zusätzlich Wechsel des Jahrgangs-Chats über
  `syncJahrgangChat` (alter Chat raus, neuer rein).

Tests belegen jede dieser Regeln einzeln, `backend/tests/routes/konfi-management.test.js:900-1010`:
- `:943` "Die kuenftigen Pflichttermine des alten Jahrgangs fallen weg"
- `:957` "Die Pflichttermine des neuen Jahrgangs kommen dazu"
- `:968` "Eine bereits erfasste Anwesenheit bleibt erhalten"
- `:984` "Ein Termin, der zu BEIDEN Jahrgaengen gehoert, bleibt gebucht"
- `:1055` "Jahrgangs-Chat: raus aus dem alten, rein in den neuen"
Die Assertions sind hart (`toBeNull()`, `toBe('present')`, `toBe('confirmed')`),
keine weichen `toBeDefined()`.

Der Kommentar im Code datiert den Befund selbst: "Befund 24.08.2026"
(Zeile 313-315 und 341-343). Der Registereintrag ist also seit dem
24./25.08. beantwortet und nur nicht abgehakt worden.

Nebenbei geprüft, kein Restpunkt: Der zweite Weg, auf dem sich eine
Jahrgangszuordnung ändert, ist das LÖSCHEN eines Jahrgangs in
`backend/routes/jahrgaenge.js:295-301` — dort wird nur bei BEFÖRDERTEN
Ex-Konfis (Rolle != 'konfi') `jahrgang_id = NULL` gesetzt, um den Foreign Key
zu lösen; das ist ein anderer Vorgang und nicht vom Registereintrag gemeint.

Vorschlag: abhaken mit `9d3eeeb3` und der Antwort im Klartext
(alte Pflichttermine fallen weg, außer bereits anwesend oder Termin gehört
auch zum neuen Jahrgang; neue kommen dazu; Chats laufen mit).

---

## 3. Zeile 141: "Mobile Navigation ist unbrauchbar. Gemessen bei 390 px"

**Urteil: ERLEDIGT (Commit `debc8af3`, 24.08. 22:52). Es ist genau dieser
Punkt — die Formulierung des Registereintrags und die Commit-Nachricht
decken sich Wort für Wort.**

Der Registereintrag verlangt drei Dinge, alle drei sind im aktuellen Code:
1. "einklappbar": `scripts/build-handbuch.mjs:412-429` erzeugt ein
   `<details class="nav-klapp" open>` mit `<summary>`; ein Mini-Skript
   (`:433-436`) nimmt das `open` auf schmalen Bildschirmen weg, sodass das
   Menü zu startet. Ohne JavaScript bleibt die Liste sichtbar und nativ
   zuklappbar — kein kaputter Zustand.
2. "mitlaufend": `scripts/build-handbuch.mjs:304` in der Mobil-Media-Query:
   `.seitenleiste { position:sticky; top:0; z-index:30; ... }`. Dieselbe Regel
   steht wörtlich im erzeugten HTML (in `frontend/public/docs/index.html`
   nachgeprüft). Zusätzlich `scroll-margin-top:58px` für Ankersprünge
   (`:318-319`).
3. "statt aller Punkte oben" / 449 px: Die Leiste ist jetzt eine Zeile mit
   Kapitelnummer, Titel und Inhalt-Knopf (`:305-310`); der aufgeklappte
   Inhalt scrollt in sich statt die Seite zu verlängern
   (`.nav-inhalt { max-height:calc(100dvh - 47px); overflow-y:auto }`, `:313`).
   Die Commit-Nachricht nennt 53 px Leistenhöhe.

Alle 13 erzeugten Seiten unter `frontend/public/docs/` tragen die neue
Navigation (`nav-klapp` je 7-mal in jeder Datei) — auch `challenges.html`,
das `debc8af3` bewusst ausgelassen hatte und das offenbar per Folge-Commit
nachgezogen wurde.

Nicht verwechseln: `d7a5639d` (23.08., "Handbuch-Navigation auf dem Handy
kompakt") ist der VORGÄNGER-Versuch mit umbrechenden Chips, der ausdrücklich
gegen `<details>` argumentierte. `debc8af3` hat diesen Ansatz ersetzt.
Der Registereintrag stammt vom 24.08. abends und meint den Stand NACH
`d7a5639d`, also die 449 px der Chip-Lösung — genau die Zahl, die
`debc8af3` in seiner Nachricht als "vorher" nennt.

**Nicht gemessen:** Ich habe die 53 px nicht im Browser nachgemessen, sondern
nur den Code belegt. Wenn Simon eine gemessene Zahl im Register haben will,
müsste das noch mit Playwright bei 390 px verifiziert werden.

Vorschlag: abhaken mit `debc8af3`. Die vier anderen Handbuch-Punkte in
Zeile 145-155 sind davon NICHT betroffen und bleiben offen — allerdings
sieht "Konfis einladen per QR-Code und Code" (Zeile 147) nach `e3d4d786`
("docs(handbuch): Konfis einladen vollstaendig beschrieben") ebenfalls
erledigt aus, und die Querverweise (Zeile 145) sind laut `debc8af3` im
Renderer angelegt. Das war nicht mein Auftrag, aber es lohnt einen Blick.

---

## Zusammenfassung

| Punkt | Zeile | Urteil | Commit |
|---|---|---|---|
| Socket.IO — Pushes nach dem Abmelden | 236 | ERLEDIGT, kleine Restlücke beim Sitzungsablauf | `f267a982` |
| Jahrgangswechsel — Pflichttermine | 196 | ERLEDIGT | `9d3eeeb3` |
| Mobile Navigation Handbuch | 141 | ERLEDIGT | `debc8af3` |

Zusätzlich zu korrigieren: Punkt 1 ist im Register unter "Socket.IO"
einsortiert, hat mit Socket.IO aber nichts zu tun.
