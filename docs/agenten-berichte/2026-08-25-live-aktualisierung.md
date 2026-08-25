> **ERLEDIGT** am 25.08.2026 durch `8fc097ce` (Dedupe-Regression) und
> `23ee763a` (fehlende Empfänger, Teamer-Adressierung).
> **Eine Aussage des Berichts wurde beim Nachprüfen WIDERLEGT:** Der als
> unsicher markierte Befund zu `events.js:1791` traf nicht zu — der
> Teamer-Pfad hat dort einen eigenen Zweig und sendet korrekt.

# Vollständigkeitsprüfung Live-Aktualisierung (Socket.io)

Stand: 25.08.2026, Branch `main`, Commit `a64ac8b4`.
Analyse — es wurde nichts geändert und nichts committet.

---

## Kurzfassung

Das Sende-System im Backend ist in weiten Teilen gut ausgebaut (rund 130
Sendepunkte, saubere Raum-Auflösung per Rolle). Die Lücken liegen — wie
vermutet — überwiegend bei den **Empfängern**. Dazu kommt eine **echte
Regression vom 24.08.**, die Live-Ereignisse unter einer bestimmten
Zeitkonstellation verschluckt; sie ist per A/B-Test gegen den Vorgänger-Stand
nachgewiesen.

Zahlen zur Einordnung:
- 24 Stellen im Frontend hören auf Live-Ereignisse (`useLiveRefresh`).
- Von 17 Admin-Seiten hören 11, von 8 Teamer-Seiten hören 3, von 6 Konfi-Seiten
  hören 5.
- **Keine einzige Detail-Ansicht** (Termin-Detail, Konfi-Detail, Material-Detail)
  hört auf Live-Ereignisse — in keinem der drei Bäume.
- Webhooks: **keine vorhanden** (Suche über `backend/routes/`, `backend/utils/`,
  `backend/server.js` nach "webhook" — null Treffer).

---

## A. Kritisch — vor 2.0.0 beheben

### A1. Regression: In-flight-Dedupe verschluckt Live-Ereignisse

**Datei:** `frontend/src/hooks/useOfflineQuery.ts:79-81`
**Eingeführt:** Commit `53e45f27` (24.08.2026)

```ts
// Zeile 79-81
if (inflightRef.current && inflightKeyRef.current === cacheKey) {
  return inflightRef.current;
}
```

**Was passiert:** Läuft für einen Schlüssel bereits ein Abruf, gibt `revalidate`
dessen Promise zurück und startet **keinen** neuen Abruf. Das gilt auch für
`refresh()` (Zeile 243-246), also genau den Pfad, über den ein Socket-Ereignis
das Neuladen auslöst:

`liveUpdate` (Socket) → `LiveUpdateContext.tsx:102` → `useLiveRefresh`
(`LiveUpdateContext.tsx:191`) → z.B. `KonfiEventsPage.tsx:177` → `refresh` →
`useOfflineQuery.ts:245` → `revalidate` → **Dedupe greift**.

Der bereits laufende Abruf wurde aber **vor** der Änderung gestartet und liefert
den alten Stand. Das Ereignis ist damit verloren — es gibt keinen Nachfolge-Abruf.

**Zeitfenster:** die Dauer eines laufenden Abrufs. Praktisch relevant, weil auf
Terminseiten mehrere Abrufe gleichzeitig laufen (`KonfiEventsPage.tsx:91` Termine
plus `:98` Anträge) und mobile Verbindungen dabei leicht mehrere hundert
Millisekunden brauchen.

**Nachgemessen (A/B-Test, Vitest, 25.08.2026):** Testaufbau — Abruf A startet
(Server-Stand "ALT"), währenddessen ändert jemand etwas (Server-Stand "NEU"),
Socket-Ereignis ruft `refresh()`, Abruf A kommt mit "ALT" zurück.

| Stand | Abrufe | angezeigt |
|---|---|---|
| vor `53e45f27` | 2 (zweiter mit Snapshot NEU) | **NEU** — Test grün |
| aktuell (`main`) | 1 (nur Snapshot ALT) | **ALT** — Test rot |

Der alte Stand lieferte den neuen Wert, der aktuelle nicht. Damit ist es eine
echte Regression, keine Vorbedingung.

**Die Frische-Drossel selbst (`JUST_FETCHED_MS = 1500`, Zeile 64) ist unkritisch:**
sie sitzt ausschließlich im Initial-Load-Effekt (Zeile 143-173), also im
Mount-Pfad, und wird von `refresh()` nicht berührt. Nachgemessen: ein `refresh()`
unmittelbar nach abgeschlossenem Abruf lädt sauber neu. Der Verdacht aus dem
Auftrag trifft also die Drossel nicht, sondern das In-flight-Dedupe daneben.

**Vorschlag zur Behebung** (nicht ausgeführt): Beim Dedupe merken, ob während des
laufenden Abrufs ein weiterer angefordert wurde, und dann genau **einen**
Nachfolge-Abruf anhängen. Alternativ: nur den automatischen Mount-Pfad dedupen,
`refresh()` davon ausnehmen. Ersteres behebt das Problem, ohne die am 24.08.
gemessene Doppel-Abfrage zurückzuholen.

---

### A2. Konfi-Detail der Leitung bekommt gar keine Live-Ereignisse

**Datei:** `frontend/src/components/admin/views/KonfiDetailView.tsx`
Route `/admin/konfis/:id`.

Die Datei importiert `useLiveUpdate` (Zeile 27) und nutzt daraus nur
`triggerRefresh` (Zeile 47) — das ist der **Sende**-Weg für lokal ausgelöste
Aktualisierungen, kein Empfänger. Ein `useLiveRefresh` gibt es nicht.

Betroffen sind damit die drei am dichtesten besendeten Ereignistypen:
- `konfis` (11 Sendepunkte, u.a. `backend/routes/konfi-management.js:837`, `:887`,
  `:963`, `:1027`)
- `points` (`backend/routes/activities.js:462`, `:628`, `:730`)
- `requests` (9 Sendepunkte)

**Praktische Folge:** Vergibt eine zweite Person Punkte oder genehmigt einen
Antrag, sieht die erste auf der geöffneten Konfi-Detailseite weiter den alten
Punktestand. Das ist die Ansicht, in der Punktevergabe stattfindet — also genau
die Stelle, an der zwei Leitende gleichzeitig arbeiten.

---

### A3. Termin-Detail bekommt in keinem Baum Live-Ereignisse

| Ansicht | Datei | Befund |
|---|---|---|
| Leitung | `frontend/src/components/admin/views/EventDetailView.tsx` | nur `triggerRefresh` (:104), kein `useLiveRefresh` |
| Konfi | `frontend/src/components/konfi/views/EventDetailView.tsx` | nur `triggerRefresh` (:87), kein `useLiveRefresh` |
| Teamer | eigene Detailseite existiert nicht (nutzt die Listenseite, die hört) | — |

Das Backend sendet für Termine 32 Live-Updates (`backend/routes/events.js`) — auf
den Detailseiten kommt **kein einziges** an. Betroffen sind genau die Vorgänge
aus dem Auftrag:

- Anmeldung/Absage anderer Personen → Teilnehmerliste und Platzzahlen veralten
  (gesendet u.a. `events.js:1791`, `:1792`, `:1961`, `:1962`)
- Nachrücken von der Warteliste (`events.js:1282`, `:1295`, `:2287`)
- Anwesenheit setzen (`events.js:2791`, `:2924`, `:2932`)
- QR-Check-in (`events.js:506`, `:507`)

**Besonders auffällig beim QR-Check-in:** Der Server sendet bei jedem Scan
`sendToOrgAdmins(..., 'events', 'update', { action: 'attendance' })`
(`events.js:507`). Die Leitung, die währenddessen den QR-Code auf dem Beamer
zeigt (`frontend/src/components/admin/modals/QRDisplayModal.tsx`) oder die
Teilnehmerliste offen hat, sieht den Zähler trotzdem nicht hochlaufen. Der
gesendete Vorgang existiert, er wird nur nirgends empfangen.

---

### A4. Teamer-Baum systematisch unterversorgt

Von 8 Teamer-Seiten hören 3. Die drei ohne Listener sind genau die, die **kein**
Admin-Pendant haben — sie wurden nicht vom Admin-Baum kopiert und haben den
Listener daher nie mitbekommen:

| Seite | Datei | Vergleich |
|---|---|---|
| Teamer-Dashboard | `components/teamer/pages/TeamerDashboardPage.tsx` | `KonfiDashboardPage.tsx:267` hört 4 Typen — Teamer keinen |
| Teamer-Abzeichen | `components/teamer/pages/TeamerBadgesPage.tsx` | `AdminBadgesPage.tsx:108` und `KonfiBadgesPage.tsx:77` hören, Teamer nicht |
| Konfi-Statistik | `components/teamer/pages/TeamerKonfiStatsPage.tsx` | `AdminKonfisPage.tsx:161` hört `konfis`, Teamer nicht |

Beim Teamer-Dashboard kommt hinzu, dass es Zertifikate, laufende Challenges und
Termine anzeigt (`TeamerDashboardPage.tsx:265-346`), also lauter fremdveränderliche
Daten — aktualisiert wird ausschließlich per Herunterziehen (`:507`).

Beim Teamer-Abzeichen ist die Lücke doppelt: Das Backend sendet den Zertifikats-
Erhalt gezielt an die Teamer:in (`backend/routes/teamer.js:796`,
`sendToUserByRole(..., 'badges', 'update')`) — die Seite, die es anzeigen müsste,
hört nicht zu. Ein korrekt gesendetes Ereignis läuft ins Leere.

---

## B. Wichtig — sollte vor 2.0.0 mit

### B1. Anwesenheit: die betroffene Person selbst wird nicht benachrichtigt

**Datei:** `backend/routes/events.js:2915-2933` (Einzel-Anwesenheit)

Beim Setzen der Anwesenheit geht `events` **nur** an die Leitung
(`sendToOrgAdmins`, Zeile 2924 und 2932). Die betroffene Person bekommt
lediglich `dashboard` — und das auch nur, wenn Punkte bewegt wurden
(Zeile 2920 bzw. 2929). Wurde jemand ohne Punktbewegung als anwesend markiert,
bekommt er/sie **gar nichts**.

Zum Vergleich: die Sammel-Anwesenheit macht es besser und sendet unbedingt
`events` an die Person (`events.js:2788`).

### B2. Anwesenheit für Teamer:innen hart auf Konfi verdrahtet

**Datei:** `backend/routes/events.js:2786`, `:2788` (Sammel-Anwesenheit)

```js
liveUpdate.sendToUser('konfi', userId, 'dashboard', 'update', ...)
liveUpdate.sendToUser('konfi', userId, 'events', 'update', { eventId });
```

Fest auf `'konfi'` verdrahtet. Teamer:innen sitzen aber im Raum
`user_teamer_<id>` (`backend/server.js:75f`, dokumentiert in
`liveUpdate.js:211-226`). Nimmt eine Teamer:in an einem Termin teil und wird per
Sammel-Anwesenheit markiert, landet das Ereignis im leeren Konfi-Raum.

Das Projekt kennt die richtige Lösung bereits: `sendToUserByRole` wird an anderen
Stellen genau dafür verwendet (`events.js:2677`, `activities.js:730`). Hier fehlt sie.

Dieselbe harte Verdrahtung steht in `events.js:502`, `:1282`, `:1791`, `:2137`,
`:2189`, `:2920`, `:2929`. Bei einigen davon ist es korrekt (der Kontext ist
nachweislich ein Konfi, z.B. `:2920` hinter `isKonfiParticipant`), bei den
Sammel-Fällen nicht. **Unsicher:** Ob `:1791` und `:2137` in der Praxis auch
Teamer treffen können, habe ich nicht bis in die Verzweigung hinein geprüft — das
sollte vor einem Fix nachgesehen werden.

### B3. Platzstand bei Terminen: andere Konfis sehen ihn nicht

Bei Anmeldung (`events.js:1792`), Absage (`events.js:1962`) und
Teamer-Buchung (`events.js:1628`) geht das Ereignis an die buchende Person und an
`sendToOrgAdmins` — **nicht** an die übrigen Konfis.

Die Konfi-Terminliste zeigt aber Belegung und Wartelistenstand an
(`frontend/src/components/konfi/views/EventsView.tsx:412`, `:415-418`:
`registered_count`, `waitlist_count`, `max_participants`). Ein Termin, der gerade
volllief, wird bei den anderen weiter als "frei" angezeigt, bis sie neu laden.

Ob das gewollt ist, ist eine Produktentscheidung — `sendToOrgKonfis` bei jeder
Buchung erzeugt bei großen Gemeinden viel Verkehr. **Bewusst entscheiden**, nicht
als Versehen behandeln.

### B4. Zertifikatsentzug sendet nichts

**Datei:** `backend/routes/teamer.js:807-822`

Die Zertifikats-**Vergabe** sendet sauber (`teamer.js:796`). Das **Entfernen**
(`DELETE /teamer/:userId/certificates/:certId`) sendet gar nichts — die Teamer:in
sieht das entzogene Zertifikat weiter, bis sie neu lädt. Asymmetrie zum
Gegenstück.

---

## C. Kleinere Befunde

### C1. Verwaltungsdaten erreichen Konfis nie

Diese Routen senden **ausschließlich** `sendToOrgAdmins`, nie an Konfis:

| Route | Sendepunkte | Konfi-Relevanz |
|---|---|---|
| `backend/routes/activities.js` | 8× nur Admins | Konfis rufen `/konfi/activities` ab (`frontend/src/components/konfi/modals/ActivityRequestModal.tsx:92`) — eine neu angelegte Aktivität erscheint erst nach Neuladen im Antragsformular |
| `backend/routes/categories.js` | 3× nur Admins | mittelbar über Aktivitäten |
| `backend/routes/levels.js` | 3× nur Admins | Level bestimmen die Konfi-Anzeige |
| `backend/routes/jahrgaenge.js` | 3× nur Admins | Jahrgangswechsel betrifft Konfis unmittelbar |

Zum Vergleich: `badges.js` macht es richtig und sendet an beide Gruppen
(`badges.js:805` und `:807`, `:835`/`:837`, `:865`/`:867`).

Geringe Dringlichkeit, weil diese Daten sich selten ändern und in der Regel
zwischen zwei Terminen gepflegt werden. Aber es ist dieselbe Klasse Lücke.

### C2. Material-Detailseite hört nicht

**Datei:** `frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx:79`

Die Listen-Seiten hören beide (`AdminMaterialPage.tsx:104`,
`TeamerMaterialPage.tsx:117`), die Detailseite nicht — obwohl `material.js` 8
Ereignisse sendet. Die Datei wird von beiden Bäumen genutzt (auch von
`admin/views/EventDetailView.tsx:23`), ein Fix wirkt also doppelt.

### C3. Toter Code: der DOM-Event-Pfad

`frontend/src/contexts/LiveUpdateContext.tsx:116` und `:154` senden bei jedem
Live-Ereignis ein `window`-Event `liveUpdate:<typ>`. **Kein einziger Konsument
existiert** — verifiziert per `grep -rn "liveUpdate:" frontend/src`, das liefert
exakt diese zwei Zeilen. Der Kommentar bei Zeile 115 ("for components that prefer
that pattern") beschreibt ein Muster, das nie benutzt wurde.

Harmlos, aber irreführend: Wer die Datei liest, hält es für einen zweiten
funktionierenden Weg.

### C4. Modals aktualisieren generell nicht live

Alle 27 Admin-Modals, 12 Konfi-Modals und 3 Teamer-Modals sind ohne Listener.
Für die meisten ist das richtig (kurzlebig, `onSuccess`-Rückruf schließt und
lädt neu — so dokumentiert in
`frontend/src/components/admin/modals/ActivityRequestModal.tsx:36`).

Zwei sind es nicht, weil sie **lange offen bleiben, während andere arbeiten**:
- `frontend/src/components/admin/modals/QRDisplayModal.tsx` — bleibt beim
  Check-in dauerhaft offen (siehe A3)
- `frontend/src/components/admin/modals/ParticipantManagementModal.tsx` — mehrere
  Teamer verwalten dieselbe Teilnehmerliste gleichzeitig

### C5. Webhooks

**Keine vorhanden.** Suche nach "webhook" (ohne Groß-/Kleinschreibung) über
`backend/routes/`, `backend/utils/` und `backend/server.js`: null Treffer. Es gibt
keine ausgehenden Webhooks und keine Webhook-Empfänger. Nichts zu prüfen.

---

## Was funktioniert (damit es nicht untergeht)

- **Raum-Auflösung nach Rolle** (`liveUpdate.js:227-260`, `sendToUserByRole`) ist
  sauber gelöst und wird an den meisten Stellen korrekt verwendet.
- **Mehrfach-Organisationen**: `sendToOrgAdmins` und `sendToOrgKonfis` vereinen
  Primär-Organisation und `user_organizations` (`liveUpdate.js:62-75`, `:115-128`).
- **Teamer im Admin-Broadcast**: `sendToOrgAdmins` bedient Teamer im richtigen
  Raum (`liveUpdate.js:88-89`).
- **Chat** hat einen eigenen, vollständigen Ereignis-Weg (`newMessage`,
  `messageDeleted`, `reactionAdded/Removed`, `pollUpdated`, `roomsChanged`) mit
  Neubindung nach Verbindungsabriss über `socketEpoch`. Keine Lücke.
- **Challenges** sind vollständig: `notifyJahrgaenge` plus `notifyLeadership` an
  allen Änderungspunkten (`challenges.js:812/815`, `:1234/1236`, `:1391/1395`,
  `:1453/1456`, `:1576/1577`, `:1646/1647`). Alle drei Listenseiten hören.
- **Anträge** sind vollständig: Backend sendet an Leitung **und** Antragsteller:in
  über die korrekte Rolle (`activities.js:457/458`, `:624/628/629`), alle drei
  Listen-Ansichten empfangen über ihre Elternseiten. Die Frage aus dem Auftrag
  ("sieht die Leitung den Antrag sofort? sieht die Konfi die Bestätigung sofort?")
  ist mit Ja zu beantworten — sofern A1 behoben ist.
- **Verbindungsabriss**: `sync:reconnect` leert den Zwischenspeicher und lädt die
  sichtbare Ansicht neu (`websocket.ts:54-75`, `useOfflineQuery.ts:225-233`). Das
  fängt verlorene Ereignisse nach einem Abriss auf — aber **nicht** die aus A1,
  denn dort reißt die Verbindung ja nicht ab.

---

## Priorisierung

### Muss vor 2.0.0

1. **A1 — Regression im Doppelabfrage-Schutz.** Ein Live-Ereignis, das während
   eines laufenden Abrufs eintrifft, geht verloren. Betrifft alle Rollen und alle
   Bereiche gleichzeitig, weil der Hook zentral ist. Nachgewiesen per A/B-Test
   gegen den Vorgänger-Stand. Kleinster Fix, größte Wirkung.
2. **A2 — Konfi-Detail der Leitung.** Die Ansicht, in der Punkte vergeben werden,
   sieht fremde Punktvergaben nicht. Ein `useLiveRefresh(['konfis','points','requests'], ...)`.
3. **A3 — Termin-Detail in beiden Bäumen.** Anmeldungen, Nachrücken, Anwesenheit
   und QR-Check-in kommen dort nie an, obwohl das Backend 32-mal sendet.
4. **A4 — Teamer-Dashboard und Teamer-Abzeichen.** Beim Abzeichen sendet das
   Backend bereits gezielt an die richtige Person (`teamer.js:796`) — es fehlt
   nur der Empfänger.

### Sollte mit, wenn Zeit ist

5. **B1/B2 — Anwesenheit.** Betroffene Person benachrichtigen; `sendToUserByRole`
   statt hart `'konfi'` bei den Sammel-Fällen. Vorher B2 zu Ende prüfen (siehe
   "unsicher" dort).
6. **B4 — Zertifikatsentzug.** Eine Zeile, Symmetrie zur Vergabe.
7. **C2 — Material-Detailseite.** Eine Zeile, wirkt in beiden Bäumen.

### Kann warten

8. **B3 — Platzstand bei fremden Buchungen.** Erst bewusst entscheiden
   (Verkehrsaufkommen), dann bauen.
9. **C1 — Verwaltungsdaten an Konfis.** Ändert sich selten, `badges.js` als
   Vorbild vorhanden.
10. **C4 — QR-Anzeige und Teilnehmerverwaltung.** Komfort, kein falscher Stand.
11. **C3 — toten DOM-Event-Pfad entfernen.** Reine Aufräumarbeit, gehört unter
    "Sonstiges".

---

## Anmerkung zur Prüftiefe

- A1 ist **gemessen** (Vitest-A/B gegen `53e45f27^`), nicht geschlussfolgert.
  Der Prüftest wurde nach der Messung wieder entfernt, das Repository ist unverändert.
- Alle Datei:Zeile-Angaben zu Empfängern sind einzeln nachgesehen; die Kernbefunde
  A2, A4 und C3 habe ich nach dem Bericht des Suchlaufs noch einmal selbst
  gegengeprüft.
- Als **unsicher** gekennzeichnet: die Frage in B2, ob `events.js:1791` und
  `:2137` in der Praxis Teamer treffen können.
