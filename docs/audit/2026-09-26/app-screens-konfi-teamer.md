# Audit Fachliche Screens Konfi/Teamer, Chat und Jahresrückblick — 26.09.2026

## Umfang und Methode

**Geprüfte Module (Frontend):** `frontend/src/components/konfi/**` (6 Seiten, 8 Views, 13 Modals),
`components/teamer/**` (8 Seiten, `teamerBadges.ts`), `components/chat/**` (ChatOverview, ChatRoom,
ChatRoomView, ChatRoomSections, ChatMessagesList, MessageBubble, useChatScroll, useChatSocket,
useChatDateien, useChatVerwaltung, useUmfragenUndReaktionen, chatOutbox, Modals), `components/wrapped/**`
(WrappedModal, share/ShareCard, share/shareUtils, Slide-Aufbau), die von diesen Screens genutzten
`components/shared/*` (AppKopfzeile, OrgSwitcherButton, eventFormatting, EmptyState, OfflinePlatzhalter,
ZaehlerKugel, LoadingSpinner), dazu `contexts/AppContext.tsx`, `contexts/BadgeContext.tsx`,
`hooks/useOfflineQuery.ts`, `services/api.ts`, `services/mediaCompression.ts`, `services/writeQueue.ts`,
`navigation/rollenBaeume.ts`, `types/*.ts`.

**Gegengelesen im Backend:** jede Route, die diese Screens rufen — `routes/konfi.js` (vollständig),
`routes/teamer.js` (Profil, Badges, Dashboard, Aktivitäten, Anträge, Zusage), `routes/chat.js` (Räume,
Nachrichten, mark-read, Löschen, Reaktionen), `routes/wrapped.js` (`/me`, `/meine`, `/history/:userId`),
`routes/challenges.js` (Konfi-Liste, Detail, Einreichen, Löschen), `routes/material.js` (Lese-Routen),
`routes/events/lesen.js`, `routes/events/checkin.js`, `utils/bookingUtils.js` (bucheTermin),
`routes/jahrgaenge.js` (Lösch-Schutz), `database.js` (pg-Typ-Parser).

**Sollverhalten:** Handbuch `10-konfis.md`, `20-teamer.md`, `40-punkte.md`, `60-badges.md`,
`70-termine.md`, `80-challenges.md`, `90-chat.md`, `95-wrapped.md`; `docs/offene-befunde.md`;
die Commits 1b3689a, 878ca24, 1243d6b, 54b0d88, b85ab19.

**Methode:** Für jeden Screen die API-Aufrufe per `grep api.(get|post|put|delete|patch)` gesammelt
(Konfi 41, Teamer 34, Chat 29, Wrapped 2 Aufrufe), die gelesenen Felder gegen die heutigen
`res.json(...)`-Formen im Backend abgeglichen. Drei temporäre Vitest-Tests geschrieben und
ausgeführt (8 Tests, alle grün = Verhalten reproduziert), danach gelöscht; Quellen liegen im
Scratchpad (`app-screens-konfi-teamer/auditTmp*.test.tsx`). `npx tsc --noEmit` (22,7 s, Exit 0)
und `npx eslint` über die fünf Verzeichnisse (52 s, Exit 1) gelaufen. Sieben bestehende Wächter
des Bereichs stichprobenartig ausgeführt (129 Tests, grün).

**Bewusst nicht geprüft:** Kein Gerät, keine Kamera, kein Ionic-Laufzeitverhalten (Übergänge,
Tastatur, Scroll) — das lässt sich in jsdom nicht reproduzieren. Keine Datenbank nötig, deshalb
keine Backend-Tests gestartet; Backend-Routen wurden gelesen, nicht ausgeführt.

## Zusammenfassung

12 Befunde: 0 KRITISCH, 2 HOCH, 6 MITTEL, 4 NIEDRIG. **Kein Vertragsbruch gegenüber den
Store-Apps gefunden:** Alle 106 gelesenen API-Aufrufe treffen Routen, die heute genau die Felder
und Formen liefern, die die App liest; die drei bekannten Übergänge (Badges v2, Material-Links,
Wrapped-Ausgaben) sind additiv gebaut, und der Zwischenspeicher-Wandler `normalisiereTeamerBadges`
liest beide Formen. Die zwei HOCH-Befunde liegen beide in der Konfi-Termin-Detailansicht: Eine
von der Leitung abgemeldete Konfi kann sich **nicht wieder anmelden** (Handbuch 70-termine.md:536
verspricht es, `bucheTermin` erlaubt es, die App sagt „Nicht verfügbar" und verschweigt die
Abmeldung); und eine Konfi **auf der Warteliste hat keinen Abmeldeweg** — stattdessen steht dort
ein Knopf „Warteliste offen", der in einen 409-Fehler läuft. Das Ranking der Startseite zeigt
Namen und Punkte der drei besten Konfis des Jahrgangs, obwohl das Handbuch „ohne die Punkte der
anderen" zusagt. Der Chat lädt genau 100 Nachrichten und bietet kein Blättern; ältere Nachrichten
sind in der App unerreichbar. Die früheren Befunde #1, #5, #7.1, #7.2 und #10 sind am heutigen
Code als behoben bestätigt.

**Stand 27.09.2026 (vor dem Merge):** Jeder Befund ist gegen Code, Tests und CHANGELOG am Stand
`b6a67ed1` geprüft und trägt eine Status-Zeile. Von 12 Befunden sind **4 behoben** (beide HOCH,
BF-01 und BF-02, dazu BF-08 und BF-11), **2 bewusst so gelassen** (BF-03 Ranking: Entscheidung
Simon 27.09., das Handbuch beschreibt jetzt, was die App zeigt; BF-06 Melden/Blockieren:
Produktentscheidung, alle Chats moderiert) und **6 offen** (BF-04, BF-05, BF-07 MITTEL, für
2.3.x vorgemerkt; BF-09, BF-10, BF-12 NIEDRIG, später). **Kein HOCH- oder KRITISCH-Befund ist
mehr offen.** Aus „Unklar" weiter offen: „Konfi ohne Jahrgang" — `GET /konfi/dashboard` und
`/konfi/profile` machen weiter einen inneren `JOIN jahrgaenge` (heute `konfi.js:92` und `:434`)
und antworten ohne Jahrgang mit 404. Das passt nicht zur Regel vom 27.09. (Konfis sehen
Events ohne Jahrgang „auch ohne eigenen Jahrgang"), ist über die Oberfläche aber weiter nicht
erreichbar (Konfi-Anlage verlangt `jahrgang_id ≥ 1`, Jahrgang mit Konfis lässt sich nicht
löschen); für 2.3.x vorgemerkt. Ebenfalls offen: Zeitzone der Anzeige (Gerätezone, nicht
entschieden; später). Die Messungen unter „Auf Produktion nachzumessen" liegen beim Betrieb
(nach dem Deploy messen).

## Release-Empfehlung für den Bereich

**Stand 27.09.2026 (vor dem Merge):** Die Auflage ist erfüllt — BF-01 und BF-02 sind am
26.09. behoben (`febfeb33`, `8150b86c`). BF-03 ist entschieden (Handbuch angeglichen). Die
Empfehlung vom 26.09. bleibt als damaliger Stand stehen und ist überholt.

*Stand 26.09.2026, überholt:* **Mit Auflage.** Auflage: BF-01 und BF-02 vor dem Release beheben (beides Frontend-Änderungen in
`konfi/views/EventDetailView.tsx` plus eine Zeile in `routes/konfi.js`, additiv), weil sie eine
im Handbuch zugesagte Funktion für Konfis unbenutzbar machen. BF-03 (Ranking) sollte vor der
EKD-Ausrollung entschieden werden: entweder Handbuch angleichen oder Punkte anderer ausblenden —
es geht um Daten Minderjähriger, die standardmäßig eingeschaltet sind.

## Befunde

### BF-01: Von der Leitung abgemeldete Konfi kann sich nicht wieder anmelden und sieht „Offen"/„Nicht verfügbar"
- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — `can_register` in `GET /konfi/events` und `/konfi/events/:id/status` ist für `excused`/`opted_out` wahr (gleiche Form); Detailansicht und Liste zeigen „Abgemeldet" / „Von der Leitung abgemeldet" mit Knopf „Wieder anmelden" (auch am Pflichttermin); Tests `wiederanmeldenSichtbarUndWarteliste.test.js`, `konfiAbgemeldetUndWarteliste.test.tsx`.
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** Stand bestätigt, Commit `febfeb33`.
- **Fundstelle:** `backend/routes/konfi.js:1197-1202` (`can_register`), `frontend/src/components/konfi/views/EventDetailView.tsx:1071` (Anmelde-Knopf), `frontend/src/components/konfi/views/EventDetailView.tsx:1100-1109` („Nicht verfügbar"), `frontend/src/components/konfi/views/EventsView.tsx` (Statustext-Kette, kein Zweig für `excused`)
- **Kennzeichnung:** reproduziert (Vitest `auditTmpEventDetailWarteliste.test.tsx`, Fall „excused"; Quelle im Scratchpad)
- **Beschreibung:** Seit Migration 153 setzt eine Abmeldung durch die Leitung `event_bookings.status = 'excused'`. `GET /konfi/events` berechnet `can_register` als `false`, sobald **irgendeine** Buchungszeile existiert (`WHEN eb_konfi.id IS NOT NULL THEN false`). Die Detailansicht zeigt den Anmelde-Knopf nur bei `can_register`; für `excused` bleibt der deaktivierte Knopf „Nicht verfügbar". Der Statuskopf sagt „Offen" (die Kette kennt `excused` nicht), nirgends steht „abgemeldet". Das Backend erlaubt die Wiederanmeldung ausdrücklich (`utils/bookingUtils.js:891-895`, Simons Entscheidung 16.09.2026, Test `wiederanmeldenNachAbmeldung.test.js`), das Handbuch verspricht sie (`70-termine.md:536-542`: „Wieder anmelden kann sie sich aber selbst … steht der Termin für sie wieder da wie jeder andere offene Termin").
- **Auswirkung aus Nutzersicht:** Die Mutter meldet das Kind krank, die Leitung trägt „Abgemeldet" ein. Das Kind wird gesund, öffnet den Termin — und sieht einen offenen Termin mit einem grauen Knopf „Nicht verfügbar". Es erfährt weder, dass es abgemeldet ist, noch kann es zurück. Der QR-Check-in ist für Abgemeldete gesperrt (richtig so), also bleibt nur der Anruf bei der Leitung — genau der Umweg, den das Handbuch ausschließt.
- **Beleg:** Testausgabe (Event `booking_status: 'excused'`, `is_registered: false`, `can_register: false`, `registration_status: 'open'`, 2/10 belegt):
  ```
  expect(status).toBe('Offen')                     -> bestanden
  expect(knopf 'Nicht verfügbar').disabled === true -> bestanden
  expect(queryByText(/^Anmelden/)).toBeNull()       -> bestanden
  expect(text).not.toContain('abgemeldet')          -> bestanden
  ```
  SQL-Ursache `konfi.js:1199`: `WHEN eb_konfi.id IS NOT NULL THEN false`.
- **Empfehlung:** `can_register` in `konfi.js` auf `WHEN eb_konfi.id IS NOT NULL AND eb_konfi.status NOT IN ('excused','opted_out') THEN false` ändern (additiv, gleiche Form); in `EventDetailView`/`EventsView` einen Zweig für `booking_status === 'excused'` mit Text „Von der Leitung abgemeldet" und Knopf „Wieder anmelden" (→ `POST /konfi/events/:id/register`). Test: `excused` → Knopf sichtbar, Klick → POST.

### BF-02: Konfi auf der Warteliste hat keinen Abmeldeweg; der angebotene Knopf läuft in einen Fehler
- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — Detailansicht hat für `waitlist`/`pending` einen eigenen Zweig („Du stehst auf Platz N der Warteliste", Knopf „Von der Warteliste abmelden" → bestehender Abmelde-Dialog/DELETE); das Backend nimmt Wartende von der Zwei-Tage-Frist aus (`konfi.js`, DELETE /events/:id/register); Tests wie bei BF-01.
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** Stand bestätigt, Commits `febfeb33` und `8150b86c`. Fundstelle korrigiert: Die Abmelderegeln samt Ausnahme für Wartende stehen seit `8150b86c` nicht mehr in der Route, sondern in `pruefeKonfiStorno` (`backend/utils/bookingUtils.js`); `DELETE /konfi/events/:id/register` (`konfi.js`, heute ab Zeile 1668) und `DELETE /events/:id/book` (`routes/events/buchung.js`) rufen sie beide. Die im Befund genannten Zeilen `konfi.js:1628-1660` und `:1671-1680` beschreiben den Stand vom 26.09.
- **Fundstelle:** `frontend/src/components/konfi/views/EventDetailView.tsx:328-333` (`canUnregister` verlangt `is_registered`), `:1022-1049` (Abmelden nur bei `is_registered`), `:1089-1099` (Knopf „Warteliste offen" für Wartende); Backend `backend/routes/konfi.js:1628-1660` (DELETE akzeptiert jede Buchung), `backend/utils/bookingUtils.js:894-895` (409 bei vorhandener Buchung)
- **Kennzeichnung:** reproduziert (Vitest `auditTmpEventDetailWarteliste.test.tsx`, Fall „Warteliste")
- **Beschreibung:** `is_registered` ist nur bei `status = 'confirmed'` wahr. Wer auf der Warteliste steht (`booking_status = 'waitlist'`), bekommt deshalb keinen Abmelden-Knopf. Weil zugleich `can_register = false` ist und der Termin voll, fällt die Ansicht in den Zweig „Warteliste offen (2/5)" — einen aktiven Knopf, der `POST /konfi/events/:id/register` ruft. Der Server antwortet 409 „Du bist bereits für dieses Event angemeldet". Der Server-Weg zum Verlassen der Warteliste existiert (`DELETE /konfi/events/:id/register` löscht jede eigene Buchung), die App bietet ihn nicht an.
- **Auswirkung aus Nutzersicht:** Eine Konfi steht auf der Warteliste und hat inzwischen etwas anderes vor. Sie sieht „Warteliste (2)" im Kopf und darunter den Knopf „Warteliste offen" — tippt sie darauf, kommt eine rote Fehlermeldung. Herunter von der Warteliste kommt sie nicht. Rückt sie in den letzten 48 Stunden nach, ist auch das Abmelden gesperrt („Abmelden geht nur bis 2 Tage vorher"); der Platz bleibt belegt, sie wird später als abwesend verbucht.
- **Beleg:** Testausgabe (Event `booking_status: 'waitlist'`, `waitlist_position: 2`, 4/4 belegt, Warteliste 2/5):
  ```
  expect(status).toBe('Warteliste (2)')                                   -> bestanden
  expect(queryByText(/Abmelden/)).toBeNull()                              -> bestanden
  expect(knopf.textContent).toBe('Warteliste offen (2/5)')                -> bestanden
  click -> apiPost('/konfi/events/5/register', {})                        -> bestanden
  setError('Du bist bereits für dieses Event angemeldet')                 -> bestanden
  ```
- **Empfehlung:** Zweig für `booking_status === 'waitlist'` vor den Anmelde-Zweigen: Text „Du stehst auf Platz N der Warteliste", Knopf „Von der Warteliste abmelden" → bestehender `handleUnregister` (DELETE). Die Abmeldefrist sollte für Wartende nicht gelten (ein Wartender belegt keinen Platz); das Backend prüft die 2-Tage-Frist derzeit auch für Wartende (`konfi.js:1671-1680`) — dort ebenfalls ausnehmen.

### BF-03: Ranking der Startseite zeigt Namen und Punkte anderer Konfis — Handbuch verspricht das Gegenteil
- **Schwere:** MITTEL
- **Status:** bewusst so gelassen, Handbuch angepasst 27.09.2026 (vor dem Merge von 2.3.0; Commit `c565fa14`) — Entscheidung Simon 27.09.2026: „Handbuch anpassen". Das Ranking bleibt, wie es ist (Namen und Punkte der Bestplatzierten, siehe Beschreibung); `docs/handbuch/10-konfis.md` beschreibt jetzt, was die App zeigt. Voreinstellung für neue Gemeinden und Klarnamen in der Antwort bleiben Feature E-06 (vor EKD-Ausrollung).
- **Fundstelle:** `frontend/src/components/konfi/views/DashboardSections.tsx:325-360` (Podest aus `ranking[0..2]` inkl. `points`), `:506-509` (`${entry.points} Punkte`), `backend/routes/konfi.js:136-146` (`rankingSql` liefert `display_name` und `points` der Top 3), `docs/handbuch/10-konfis.md:35`
- **Kennzeichnung:** reproduziert (Vitest `auditTmpRanking.test.tsx`, 2 Tests grün)
- **Beschreibung:** Das Handbuch sagt: „**Dein Ranking** — dein Platz, ohne die Punkte der anderen zu zeigen". Tatsächlich liefert das Backend für die drei Bestplatzierten `display_name` und `points`, und die Ansicht rendert beides — bei eigenem Platz ≤ 3 alle drei, sonst Platz 1 mit Punktzahl. Nur die eingeschobenen Nachbarplätze sind anonym („Konfi vor dir"). `show_ranking` steht standardmäßig auf `true` (`konfi.js:335`).
- **Auswirkung aus Nutzersicht:** Jede Konfi eines Jahrgangs sieht, wer mit wie vielen Punkten vorn liegt — Klarnamen und Zahlen von 13-Jährigen, sichtbar für alle Gleichaltrigen der Gruppe. Die Leitung liest im Handbuch, dass genau das nicht passiert.
- **Beleg:**
  ```
  render(RankingSection, rankInJahrgang=2, ranking=[Anna 25, Ben 21, Clara 18])
  textContent enthält 'Anna Beispiel' und '25 Punkte'   -> bestanden
  textContent enthält 'Clara Test' und '18 Punkte'      -> bestanden
  render(rankInJahrgang=9): 'Anna Beispiel' + '25 Punkte' sichtbar -> bestanden
  ```
- **Empfehlung:** Entscheidung der Leitung einholen. Entweder Handbuch auf den Ist-Stand bringen („Platz 1–3 mit Punkten") oder — dem Handbuch und dem Datenschutzgedanken folgend — im Backend `points` der anderen weglassen und in der Ansicht nur Initialen/Platz zeigen. Kein Formwechsel nötig: Feld auf `null` setzen, die Ansicht zeigt dann bereits „Platz N".

### BF-04: Chat-Verlauf endet nach 100 Nachrichten — kein Blättern, ältere Nachrichten in der App unerreichbar
- **Schwere:** MITTEL
- **Status:** offen 27.09.2026 — unverändert: `ChatRoom.tsx:59` und `:280` laden `?limit=100`, kein Nachladen älterer Nachrichten, kein Hinweis am Listenanfang. Für 2.3.x vorgemerkt.
- **Nachtrag 28.09.2026:** behoben — Backend: `GET /chat/rooms/:roomId/messages` nimmt additiv `?before=<message_id>` (Keyset über `(created_at, id)`, gleiche Rechteprüfung `darfRaumOeffnen`; ungültiges `before` oder `before` mit `after` → 400, Anker aus fremdem Raum/unbekannte id → leere Liste; ohne `before` unverändert). App: `ChatRoom.tsx` lädt am Listenanfang je 50 ältere nach (`chatVerlauf.ts`, `ChatVerlaufAnfang.tsx`), fügt sie oben ein, hält die Leseposition (`useChatScroll.ts`, Layout-Effekt an der bisher obersten Nachricht), zeigt Ladeanzeige (`role="status"`, `aria-live`) und „Anfang des Chats"; der jüngste Block beim Aktualisieren behält die nachgeladenen älteren. Der Offline-Cache hält weiter nur den jüngsten Block (100). Tests: `backend/tests/routes/chatAeltereNachrichten.test.js` (25), `frontend/src/__tests__/components/chatVerlauf.test.ts` (21), `chatAeltereNachrichten.test.tsx` (8, echter ChatRoom mit nachgebautem Layout). Folgekorrektur im selben Zug: Eine gelöschte Nachricht zeigt sofort den Platzhalter — auch im nachgeladenen Teil, den der jüngste Block nicht mitbringt, und bei allen anderen im Raum (das Socket-Ereignis setzte bisher nur `deleted_at`, das die Blase nicht auswertet).
- **Fundstelle:** `frontend/src/components/chat/ChatRoom.tsx:59`, `:280` (`?limit=100`), `:295` (nur `?after=`); Backend `backend/routes/chat.js:941-947` (Deckel 200), `:1004` (`LIMIT $2 OFFSET $3` vorhanden)
- **Kennzeichnung:** aus Code gelesen (`grep -rn "offset" frontend/src/components/chat` → kein Treffer)
- **Beschreibung:** Der Raum lädt einmal die letzten 100 Nachrichten und danach nur noch Neues (`after`). Es gibt kein „ältere laden", keinen Scroll-Trigger nach oben, keine Nutzung von `offset`. Das Handbuch (90-chat.md) beschreibt den Chat ohne diese Grenze; der Export („ganzer Verlauf") steht nur der Leitung offen.
- **Auswirkung aus Nutzersicht:** In einem Jahrgangs-Chat mit einem Jahr Verlauf sind für Konfis und Teamer:innen alle Nachrichten vor den letzten 100 verschwunden — die Abmachung von vor drei Wochen, das Foto vom Ausflug. Wer scrollt, landet am Anfang der 100 und weiß nicht, dass es weitergeht.
- **Beleg:** `ChatRoom.tsx:59: api.get(\`/chat/rooms/${room?.id}/messages?limit=100\`)`; `:280` identisch; `:295` `?after=`; kein `offset` im gesamten Chat-Frontend. Server: `chat.js:1004` `LIMIT $2 OFFSET $3`.
- **Empfehlung:** Beim Erreichen des oberen Listenendes `?limit=100&offset=<geladen>` nachladen und oben anfügen (Scroll-Position halten); alternativ `before=<älteste id>`. Bis dahin ein Hinweis am Listenanfang („Ältere Nachrichten sind nur im Export enthalten").

### BF-05: Teamer-Termin-Detailansicht trägt den Gemeinde-Umschalter — entgegen der Regel, und der Wächter erzwingt es
- **Schwere:** MITTEL
- **Status:** offen 27.09.2026 — unverändert: Keine Kopfzeile in `TeamerEventsPage.tsx` schaltet den Umschalter ab (0 Treffer für `gemeindeUmschalter`), und der Wächter `umschalterInDetailansichten.test.ts` verlangt das weiter. Für 2.3.x vorgemerkt.
- **Fundstelle:** `frontend/src/components/teamer/pages/TeamerEventsPage.tsx:904-907` (Kopfzeile der Detailansicht ohne `gemeindeUmschalter={false}`), `:2022` (Jahrgang-Hinweis, ebenfalls ohne), `frontend/src/__tests__/components/umschalterInDetailansichten.test.ts:112-124` („die Listen behalten ihn": verlangt für **jede** Kopfzeile in `TeamerEventsPage.tsx`, dass sie **nicht** abschaltet)
- **Kennzeichnung:** aus Code gelesen; Wächter `umschalterInDetailansichten.test.ts` ausgeführt (grün — und genau das ist der Befund)
- **Beschreibung:** Commit 54b0d88 legt fest: „Eine Detailansicht zeigt EINEN Gegenstand, und der gehört zu genau einer Gemeinde. Ein Wechsel führt dort ins Leere." Die Konfi- und Leitungs-Detailansicht schalten ab; die Teamer-Detailansicht lebt inline in `TeamerEventsPage` (`renderDetail`) und trägt ihn weiter. Der Wächter behandelt die ganze Datei als „Liste" und würde die Korrektur rot machen — dieselbe Wächter-Falle, die 878ca24 für die Leitung beschreibt.
- **Auswirkung aus Nutzersicht:** Eine Teamer:in in zwei Gemeinden öffnet einen Termin, wechselt oben die Gemeinde und landet in der Liste der anderen Gemeinde, während die Adresse `?eventId=` den alten Termin trägt; beim nächsten Tippen auf den Reiter versucht der Deep-Link-Effekt, ihn dort zu öffnen (`pruefeJahrgangsgrund` → 403/404-Weg).
- **Beleg:** `TeamerEventsPage.tsx:904-907`:
  ```tsx
  <AppKopfzeile
    titel={selectedEvent.name}
    onZurueck={hideBackButton ? undefined : () => setSelectedEvent(null)}
    rechts={(
  ```
  kein `gemeindeUmschalter`. Test `:112-124` verlangt `not.toMatch(/gemeindeUmschalter=\{false\}/)` für **alle** Kopfzeilen der Datei.
- **Empfehlung:** In `renderDetail` und `renderJahrgangHinweis` `gemeindeUmschalter={false}` setzen; den Wächter für `TeamerEventsPage.tsx` wie für `TeamerMaterialPage.tsx` (Test `:96-108`) auf „Liste behält, Detail schaltet ab" umstellen.
- **Nachtrag 28.09.2026:** behoben — Simon 28.09.: „Gemeinde Umschalter kommt nie in Details." `renderDetail` und `renderJahrgangHinweis` schalten ihn ab; der Wächter `umschalterInDetailansichten.test.ts` prüft `TeamerEventsPage.tsx` jetzt wie `TeamerMaterialPage.tsx` (Liste behält, Detail und Jahrgang-Hinweis schalten ab) und zusätzlich über alle drei Rollen jede Kopfzeile mit Zurück-Knopf (35 Stück; einzige Ausnahme die Material-Liste der Teamer:innen). Weitere Treffer außer den beiden in `TeamerEventsPage.tsx` gab es nicht. Vorher 2 von 13 Tests rot, danach 13 grün.

### BF-06: Keine Möglichkeit, Nachrichten oder Personen im Chat zu melden oder zu blockieren
- **Schwere:** MITTEL (die Gesamtabnahme führt ihn seit dem 26.09. als NIEDRIG, S-16)
- **Status:** bewusst so gelassen (Entscheidung Simon 26.09.2026: alle Chats sind moderiert, Konfi-zu-Konfi-Chat gibt es nicht; Gesamtabnahme Punkt 31) — am Code geprüft: `POST /chat/direct` weist Konfi an Konfi mit 403 ab (heute `chat.js:541-542`), Gruppen mit Konfis untereinander ebenso (`:735-738`); Konfis treffen einander nur in Räumen, die die Leitung liest. „Nachricht melden" bleibt Feature E-15. Offen ist nur, ob die Store-Prüfung für Apps mit nutzergenerierten Inhalten einen Meldeweg verlangt — vor EKD-Ausrollung klären.
- **Fundstelle:** `frontend/src/components/chat/MessageBubble.tsx` (Aktionsleiste: Antworten, Teilen, Reagieren, Löschen nur eigene), `frontend/src/components/chat/useChatVerwaltung.ts` (Optionen: Verlassen, Exportieren, Leeren), `backend/routes/chat.js` (keine Route für Meldung/Block)
- **Kennzeichnung:** aus Code gelesen (`grep -rni "melden|blockier|report|missbrauch" frontend/src/components/chat backend/routes/chat.js` → keine fachlichen Treffer)
- **Beschreibung:** Konfis (13–14 Jahre) chatten in Jahrgangs-, Gruppen- und Termin-Chats miteinander und mit dem Team. Es gibt keinen Weg, eine Nachricht zu melden oder eine Person zu blockieren; Konfis dürfen fremde Nachrichten nicht löschen (richtig). Die einzige Eskalation ist, die Leitung selbst anzuschreiben. Das Handbuch (90-chat.md) beschreibt keine Meldefunktion; App-Store-Richtlinien für Apps mit nutzergenerierten Inhalten verlangen üblicherweise einen Melde- und Blockierweg.
- **Auswirkung aus Nutzersicht:** Eine Konfi, die im Jahrgangs-Chat beleidigt wird, hat in der App keinen Knopf dafür. Die Leitung erfährt es nur, wenn das Kind sich aktiv meldet.
- **Beleg:** Aktionsleiste in `MessageBubble.tsx` enthält ausschließlich `onReply`, `onShare`, `onOpenReactionPicker`, `onDelete` (Zeilen 89-96 der Props); `useChatVerwaltung.ts:60-151` bietet Verlassen/Exportieren/Leeren.
- **Empfehlung:** Mindestens „Nachricht melden" in der Aktionsleiste (POST an eine neue Route, Mitteilung an die Leitung mit Nachrichten-Id). Vor der EKD-Ausrollung mit Blick auf Store-Review und Jugendschutz entscheiden.

### BF-07: Teamer:innen können den Rückblick-Hinweis nur einmal für immer wegklicken — Backend liefert keine Ausgabe-Id
- **Schwere:** MITTEL
- **Status:** offen 27.09.2026 — unverändert: `GET /teamer/dashboard` liefert kein `wrapped_ausgabe_id` (0 Treffer in `teamer.js`), der Schlüssel in `TeamerDashboardPage.tsx` (heute Zeile 375) endet weiter auf `_alt`. Für 2.3.x vorgemerkt (vor dem Team-Rückblick am 6. Januar).
- **Fundstelle:** `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx:372` (`wrapped_hinweis_t_${user.id}_${dashboardData?.wrapped_ausgabe_id ?? 'alt'}`), `backend/routes/teamer.js:847` (Antwort `{ greeting, certificates, events, badges, config, has_wrapped, konfspruch }` — kein `wrapped_ausgabe_id`), `docs/handbuch/95-wrapped.md:511-514`
- **Kennzeichnung:** aus Code gelesen (`grep -n wrapped_ausgabe_id backend/routes/teamer.js` → kein Treffer)
- **Beschreibung:** Der Konfi-Weg merkt sich das Wegklicken pro Ausgabe (`konfi.js` liefert `wrapped_ausgabe_id`). Der Teamer-Weg baut denselben Schlüssel, bekommt aber nie eine Id → Schlüssel endet immer auf `_alt`. Das Handbuch verspricht für beide Karten: „die nächste Ausgabe meldet sich wieder".
- **Auswirkung aus Nutzersicht:** Eine Teamer:in klickt den Hinweis 2026 weg; der Rückblick 2027 (Cron am 6. Januar) erscheint auf der Startseite nie mehr. Er bleibt nur im Profil unter „Meine Rückblicke" erreichbar.
- **Beleg:** `teamer.js:847`: `res.json({ greeting, certificates, events, badges, config, has_wrapped, konfspruch });` — `TeamerDashboardPage.tsx:158` deklariert `wrapped_ausgabe_id?: number | null`, liest also ein Feld, das nie kommt.
- **Empfehlung:** In `GET /teamer/dashboard` additiv `wrapped_ausgabe_id` (und `wrapped_titel`) aus `wrapped_snapshots JOIN wrapped_ausgaben` liefern, wie `konfi.js:222-236`.
- **Nachtrag 28.09.2026:** behoben — `GET /teamer/dashboard` liefert additiv `wrapped_ausgabe_id` und `wrapped_titel`: die Ausgabe, die `GET /wrapped/me` öffnet (jüngste freigegebene der aktiven Gemeinde, Alt-Snapshots `null`). Die Store-Apps bauen den Schlüssel schon je Ausgabe und profitieren ohne Update; wer den Hinweis bisher (unter `_alt`) weggeklickt hat, sieht die aktuelle Ausgabe einmal wieder. `wrapped_titel` zeigt die App bewusst nicht an (Team-Rückblicke tragen nur den Platzhalter „Team-Rückblick <Jahr>"). Tests `teamerDashboardRueckblick.test.js` (6, vorher 6 rot) und `teamerRueckblickHinweisJeAusgabe.test.tsx` (3; mit einem Schlüssel ohne Id 3 rot).

### BF-08: Chat-Dateigrenze: App prüft 10 MB, Server nimmt 5 MB — Datei dazwischen scheitert nach dem Upload
- **Schwere:** MITTEL
- **Status:** behoben 27.09.2026 — Die App prüft im Chat die Grenze des Servers, 5 MB, auf demselben Weg wie bei Challenges und Material (Fotos werden vorher verkleinert, ein Satz für „zu groß"); der „bekannte Stolperstein" ist aus `90-chat.md` gestrichen. Commit `c67ac3c8` (Medien: Verkleinerung und Größengrenze beim Hochladen).
- **Fundstelle:** `frontend/src/components/chat/useChatDateien.ts:82-86` (`10 * 1024 * 1024`), `backend/createApp.js:196` (`fileSize: 5 * 1024 * 1024`), `:616` (413 „Datei ist zu groß (max. 5 MB).")`, `docs/handbuch/90-chat.md` („Achtung, bekannter Stolperstein")
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Das Handbuch dokumentiert den Widerspruch bereits als „bekannten Stolperstein"; er besteht unverändert. Eine Datei zwischen 5 und 10 MB (etwa ein 40-Sekunden-Video) passiert die App-Prüfung, wird hochgeladen, der Server antwortet 413. `ChatRoom.sendMessage` fängt den Fehler, reiht die Nachricht in die Warteschlange und flusht; `writeQueue.ts:552-560` behandelt 4xx als endgültig → die Blase wechselt auf „fehlgeschlagen" mit „Erneut senden", was wieder scheitert.
- **Auswirkung aus Nutzersicht:** Upload läuft bis 100 %, dann rotes Warnsymbol. „Erneut senden" hilft nie. Die Grenze 5 MB steht nirgends in der App.
- **Beleg:** `useChatDateien.ts:82`: `if (file.size > 10 * 1024 * 1024)`; `createApp.js:196`: `limits: { fileSize: 5 * 1024 * 1024 }`.
- **Empfehlung:** Grenze in `useChatDateien.ts` auf 5 MB setzen (eine Zahl) und die Meldung anpassen; Handbuch-Stolperstein danach streichen.

### BF-09: Doppeltipp auf „Anmelden" schickt zwei Anmeldungen — der zweite Versuch zeigt einen Fehler trotz Erfolg
- **Schwere:** NIEDRIG
- **Status:** offen 27.09.2026 — unverändert: `doRegister` (heute `EventDetailView.tsx:354`) läuft ohne `useActionGuard`. Später.
- **Fundstelle:** `frontend/src/components/konfi/views/EventDetailView.tsx:352-378` (`doRegister` ohne `useActionGuard`), `:1071-1088` (Knopf ohne `disabled` während des Sendens)
- **Kennzeichnung:** reproduziert (Vitest `auditTmpEventDetailWarteliste.test.tsx`, Fall „Doppeltipp": 2 POSTs, `setError('Du bist bereits für dieses Event angemeldet')`)
- **Beschreibung:** Die Modals des Bereichs nutzen `useActionGuard` (ActivityRequestModal, ChallengeSubmitModal, UnregisterModal); die Anmeldung im Termin-Detail nicht. Der Server ist idempotent (409 beim zweiten), der Nutzer sieht aber die Fehlermeldung des zweiten Aufrufs, obwohl die Anmeldung geklappt hat.
- **Auswirkung aus Nutzersicht:** Nach ungeduldigem Doppeltipp erscheint „Du bist bereits für dieses Event angemeldet" in Rot; die Konfi glaubt, etwas sei schiefgelaufen.
- **Beleg:** Test: zwei `fireEvent.click` → `apiPost` zweimal, zweiter Aufruf 409 → `setError` mit Servertext.
- **Empfehlung:** `doRegister` in `guard()` wickeln und den Knopf während `isSubmitting` deaktivieren; 409 „bereits angemeldet" nach eigenem Erfolg stumm schalten.
- **Nachtrag 28.09.2026:** behoben — `EventDetailView.tsx`: der ganze Anmeldeweg (`handleRegister` samt Konfirmations-Vorabfrage und Zeitfenster-Auswahl, `doRegister`) läuft unter `useActionGuard`; ein zweiter Tipp tut still nichts, die vier Anmelde-Knöpfe sind während des Sendens gesperrt und werden erst nach dem Neuladen der Liste frei. Den 409 stumm zu schalten war danach nicht mehr nötig: Er erreicht die Ansicht nur noch, wenn die Buchung von woanders kam, und dann stimmt die Meldung. Test `components/konfiAnmeldungDoppeltipp.test.tsx` (5: einfacher Termin, Sperre des Knopfs, Konfirmation mit hängender Vorabfrage, Zeitfenster, Gegenprobe Serverfehler sichtbar); ohne Fix 4 rot.

### BF-10: QR-Scanner liest `isOnline` und `scanning` aus einer veralteten Closure
- **Schwere:** NIEDRIG
- **Status:** offen 27.09.2026 — unverändert: Der Scan-Callback entsteht im Mount-Effekt und liest `isOnline` aus dem ersten Rendern. Später.
- **Fundstelle:** `frontend/src/components/konfi/modals/QRScannerModal.tsx:34-65` (`useEffect(..., [])` legt den Scan-Callback einmal an), `:67-70` (`if (scanning) return; if (!isOnline) ...`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Der QrScanner-Callback wird im Mount-Effekt erzeugt und sieht `isOnline`/`scanning` vom ersten Rendern. Geht das Gerät nach dem Öffnen offline, greift die Prüfung nicht; statt „Du bist offline" kommt der Fallback „QR-Code konnte nicht verarbeitet werden" (Netzfehler ohne Servertext). Den Doppel-Scan verhindert praktisch `scanner.stop()`, nicht der `scanning`-Merker.
- **Auswirkung aus Nutzersicht:** Im Gemeindehaus-Funkloch scannt die Konfi und bekommt eine unpassende Meldung; das Handbuch (70-termine.md:684) verspricht „Du bist offline".
- **Beleg:** Callback in `new QrScanner(videoRef.current, (result) => handleScanResult(result.data), ...)` innerhalb `useEffect(() => {...}, [])`; `handleScanResult` ist eine pro Rendern neue Funktion, der Callback hält die erste.
- **Empfehlung:** `isOnline`/`scanning` über `useRef` spiegeln oder `networkMonitor.isOnline` direkt lesen.
- **Nachtrag 28.09.2026:** behoben — `QRScannerModal.tsx`: Der Scan-Rückruf ruft über ein Ref die jeweils aktuelle `handleScanResult`; `isOnline` wird in ein Ref gespiegelt, der Scan-Merker ist ein Ref statt Zustand (gilt sofort, nicht erst nach dem nächsten Rendern). Ein neuer Scan nimmt einen alten Offline-Hinweis weg. Test `components/qrScannerAktuellerZustand.test.tsx` (4, echte Ansicht, Scanner als Attrappe: offline nach dem Öffnen, Netz zurück, zwei Treffer kurz hintereinander, Neustart nach „bereits eingecheckt"); ohne Fix 3 rot.

### BF-11: `npm run lint` schlägt im Bereich mit 3 Fehlern fehl; die CI prüft nur geänderte Dateien
- **Schwere:** NIEDRIG
- **Status:** behoben 26.09.2026 — die drei ungenutzten Importe (`formatDate`, `formatDateLong`, `IonNote`) sind entfernt (Commit `4c8fb30d`, 19 ESLint-Fehler im Frontend-Bestand, danach `npx eslint .` ohne Fehler); die CI lintet seitdem den ganzen Frontend-Baum bei jedem Push (`ci.yml`, Schritt „Lint", `npx eslint .`), nicht mehr nur geänderte Dateien.
- **Fundstelle:** `frontend/src/components/konfi/views/EventDetailView.tsx:56` (`formatDate` ungenutzt), `frontend/src/components/teamer/pages/TeamerEventsPage.tsx:66` (`formatDateLong` ungenutzt), `frontend/src/components/shared/PushAuswahl.tsx:14` (`IonNote` ungenutzt); `.github/workflows/ci.yml:160-178`
- **Kennzeichnung:** reproduziert (`npx eslint src/components/{konfi,teamer,chat,wrapped,shared}` → „3 errors, 197 warnings", Exit 1; Protokoll `scratchpad/app-screens-konfi-teamer/eslint.log`)
- **Beschreibung:** Die CI-Kommentare behaupten „no-unused-vars … stehen aktuell auf null". Drei `@typescript-eslint/no-unused-vars`-Fehler liegen im Bereich; da die CI nur im PR geänderte Dateien lintet, blockieren sie erst, wenn jemand diese Dateien anfasst — dann aber mit fremden Altfehlern.
- **Auswirkung aus Nutzersicht:** keine; Hygiene. Für Entwickler:innen: der nächste PR an `EventDetailView.tsx` oder `TeamerEventsPage.tsx` wird rot, ohne selbst etwas verursacht zu haben.
- **Beleg:** `eslint.log`: `EventDetailView.tsx 56:61 error 'formatDate' is defined but never used`; `TeamerEventsPage.tsx 66:185 error 'formatDateLong' …`; `PushAuswahl.tsx 14:3 error 'IonNote' …`.
- **Empfehlung:** Die drei Importe entfernen; CI-Kommentar „stehen aktuell auf null" nachziehen.

### BF-12: Kleinere Hygiene: Chat-Raum-Typ kennt keine Teamer:innen, Badges-Seite leer ohne Profilantwort
- **Schwere:** NIEDRIG
- **Status:** offen 27.09.2026 — unverändert: `ChatRoomView.tsx:22` kennt `user_type` nur als `'admin' | 'konfi'`, `KonfiBadgesPage.tsx:112` verwirft die Liste ohne Profilantwort. Später.
- **Fundstelle:** `frontend/src/components/chat/views/ChatRoomView.tsx:22` (`user_type: 'admin' | 'konfi'`), `frontend/src/components/konfi/pages/KonfiBadgesPage.tsx:112` (`if (!badgeData || !konfiData) return [];`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** (a) `ChatRoomData.participants[].user_type` fehlt `'teamer'`, obwohl `chat_participants.user_type` ihn seit langem führt (`types/chat.ts` kennt `ChatUserType`); `ChatRoom` liest daraus `partnerType`. (b) Die Badges-Seite verwirft die komplette Abzeichenliste, wenn `GET /konfi/profile` (nur als Rückfall für den Punkte-Fortschritt gebraucht) noch nicht oder nicht mehr geladen ist — die Kopfzahlen aus `stats` stehen dann neben „Keine Badges gefunden".
- **Auswirkung aus Nutzersicht:** (a) keine sichtbare, Typlüge. (b) Bei fehlgeschlagenem Profilabruf (500, Zeitüberschreitung) zeigt die Badges-Seite „Keine Badges gefunden", obwohl die Abzeichen geladen sind.
- **Beleg:** Zeilen wie oben zitiert.
- **Empfehlung:** (a) `ChatUserType` aus `types/chat.ts` verwenden. (b) Abzeichen auch ohne `konfiData` rendern; der Punkte-Rückfall betrifft nur Abzeichen ohne `progress`.

## Unklar

- **IonPage-Tausch auf Nicht-Startseiten.** `KonfiBadgesPage`, `KonfiProfilePage`, `ChatOverview`, `TeamerBadgesPage`, `TeamerKonfiStatsPage`, `TeamerProfilePage` geben bei `loading` einen nackten `<LoadingSpinner/>` (ein `div`, keine IonPage) zurück und montieren die IonPage erst mit Daten. Der Wächter `dashboardErstesRendern.test.tsx` deckt nur die Startseiten ab. Nach meiner Lesart registriert `@ionic/react` die IonPage in diesem Muster genau einmal (beim ersten IonPage-Mount), so dass der Übergang läuft — anders als beim IonPage→IonPage-Tausch der Startseiten. Belegen kann ich das ohne Gerät nicht. Zu klären: Erstbesuch des Badges-Reiters ohne Zwischenspeicher auf einem langsamen Netz.
- **HEIC aus der Galerie auf Android.** `compressImage` fällt bei nicht dekodierbarem Bild auf die Originaldatei zurück; `POST /konfi/upload-photo` akzeptiert `image/heic` (Magic-Bytes `image/*`). Ob Android-Geräte HEIC liefern und ob die Leitung das Foto dann im Browser sieht, ließ sich hier nicht prüfen.
- **Zeitzonen.** Alle Uhrzeiten (`formatEventTime`, `formatEventDate`) laufen über die Gerätezone. Eine Konfi im Auslandsurlaub sieht die Termine in Ortszeit. Ob das gewollt ist, steht nirgends; das Backend rechnet Check-in-Fenster serverseitig (`checkin.js:84-90`), das ist unabhängig davon korrekt.
- **Sichtbarkeit der 413-Meldung (BF-08).** `writeQueue.ts:326` zeigt bei endgültigem Scheitern einen Toast; ob dessen Text die Server-Meldung „max. 5 MB" trägt oder generisch bleibt, habe ich nicht bis zum Ende verfolgt.
- **Konfi ohne Jahrgang.** `GET /konfi/dashboard` und `GET /konfi/profile` machen `JOIN jahrgaenge` → 404 „Konfi nicht gefunden" → Startseite dauerhaft „konnte nicht geladen werden". Über die Oberfläche ist der Zustand nicht erreichbar (`jahrgaenge.js:353-365` blockiert das Löschen bei aktiven Konfis, `konfi-management.js:31` verlangt `jahrgang_id ≥ 1`); `konfi_profiles.jahrgang_id` ist aber nullbar, und `GET /konfi/events`/`GET /challenges/konfi` behandeln den Fall ausdrücklich. Ein direkter DB-Eingriff oder eine künftige Lockerung würde die Startseite lahmlegen.
- **Sehr viele Einträge.** Weder Terminliste, Chat noch Badges sind virtualisiert; 200 Termine oder 500 Nachrichten (BF-04 kappt den Chat ohnehin bei 100) rendern als flache Liste. Laufzeit ohne Gerät nicht messbar.

## Alte Befunde nachgeprüft

- **#1 Chat: Ungelesen-Markierung verschwindet nicht (02.09.2026)** → **behoben bestätigt.** `BadgeContext.tsx:markRoomAsRead` wartet den POST ab und wirft `chat:rooms:<userId>` aus dem Zwischenspeicher; `ChatRoom.tsx:markRoomAsRead` ruft erst `badgeMarkRoomAsRead`, dann `refreshAllCounts` (mit `await`). Wächter vorhanden: `contexts/badgeMarkRoomAsRead.test.ts`, `badgeMarkReadWettlauf.test.ts`. Live gegen Produktion nicht gemessen.
- **#2 react-router-Navigationsziele** (Teil, der den Bereich betrifft) → **weiter in Ordnung.** Alle `router.push` im Bereich sind feste Pfade mit eingesetzter Id (`/konfi/events/${event.id}`, `/konfi/chat/room/${id}`, `/teamer/chat/room/${id}`, `/teamer/profile`).
- **#5 CodeQL `linkifyText`** → **bestätigt, greift nicht** (reproduziert: `auditTmpLinkify.test.tsx`, 3 Tests grün): `javascript:`/`data:` werden nicht verlinkt; `www.` erhält `https://`; Unicode-Domain und Großschreibung ergeben ausschließlich `http(s)://`-hrefs.
- **#7.1 Karte „Nächstes Badge"** → **behoben bestätigt.** `grep -rn 'next_badge\|recent_activities' frontend/src` (ohne Tests) → kein Treffer.
- **#7.2 Konfi-Historie hängt am Jahrgangsnamen** → **behoben bestätigt.** `TeamerProfilePage.tsx:625` prüft `profile.konfi_data`; `TeamerKonfiStatsPage.tsx:184` fällt auf „Konfi-Zeit" zurück; `teamer.js:142` liefert `konfi_data` unabhängig vom Jahrgang.
- **#10 Abgesagte Termine fielen aus allen Reitern** → **behoben bestätigt.** `konfi.js:1304` (`e.cancelled IS NOT TRUE OR eb_konfi.id IS NOT NULL`), `teamer.js:762` (Startseite: abgesagte mit eigener Buchung), `EventsView.tsx` Status „Abgesagt" + `AbsageBlock`; Wächter `abgesagteTermineAnsichten.test.ts` grün (Lauf heute).
- **Commit 1b3689a (laufender Termin unter „Verbuchen")** → **bestätigt.** `laufenderTerminVerbuchen.test.ts` grün (Lauf heute). Betrifft nur die Leitung; Konfi und Team haben keinen Verbuchen-Reiter (Terminverwaltung ist Leitungssache, `TeamerEventsPage.tsx:601-630`).
- **Commit b85ab19 (Zähler folgen der Gemeinde)** → **bestätigt.** `BadgeContext.tsx:330-346` hört auf `org:switched` und `auth:org-fallback`, setzt zurück, lädt neu, verwirft späte Antworten (`gemeindeLauf`); `useOfflineQuery.ts:248-262` revalidiert auf beide Ereignisse; Wächter `contexts/badgeGemeindeWechsel.test.tsx` vorhanden.

## Geprüft und in Ordnung

- **API-Vertrag aller 106 Aufrufe** (gegengelesen, Feld für Feld): `GET /konfi/dashboard` → `DashboardData` (inkl. `level_info`, `rank_in_jahrgang`, `has_wrapped`, `wrapped_ausgabe_id`); `GET /konfi/profile` → `ProfileView` liest nur gelieferte Felder; `GET /konfi/events` → Array, alle 30 gelesenen Felder vorhanden (`abgemeldet_count`, `cancelled_by_name`, `chat_room_id` additiv); `GET /konfi/badges/v2` und `GET /teamer/badges/v2` → `{available, earned, stats}`; `GET /teamer/badges` (Alt) bleibt Array mit Kopfzeilen, `normalisiereTeamerBadges` liest beide Formen (Lehre aus 29.08.2026 umgesetzt); `GET /challenges/konfi` → `{active, archive, marks, offene_stempel}`, Frontend prüft jedes Feld mit `Array.isArray`; `GET /chat/rooms` → Array; `GET /chat/rooms/:id/messages` → Array; `GET /wrapped/me` → `{data, computed_at, year, wrapped_type, ausgabe_id, titel}`; `GET /wrapped/history/:userId` → Array (Kommentar `wrapped.js:3140-3143` benennt den Vertrag); `GET /material`, `/material/:id` (`link_url` bleibt Spiegel des ersten Links, `links[]` additiv — `TeamerMaterialDetailPage.tsx:65-68`). Keine `.map/.filter` auf ein Feld, das kein Array liefert.
- **pg-Zähler sind Zahlen:** `database.js:7` `types.setTypeParser(20, parseInt)` — `unread_count`/`participant_count` in `ChatOverview.sanitizeRooms` (verlangt `typeof === 'number'`) kommen als Zahl an.
- **Fehlerzustände:** `api.ts` behandelt 401 (Refresh, Re-Login-Ereignis), 403 „Kein Zugriff auf diese Organisation" (Rückfall auf Stammgemeinde), 429 (kein Retry, Ereignis), 5xx/Timeout (3 Wiederholungen). `useOfflineQuery` hält bei Fehler den Zwischenspeicher (`isStale`), ohne Cache offline „Keine Daten verfügbar (offline)". Startseiten zeigen bei fehlender Antwort einen Text mit Hinweis auf Nachladen (`KonfiDashboardPage.tsx:338-348`).
- **Leerzustände:** Termine (`EventsView` je Reiter eigener Text), Badges (3 Varianten), Chat („Keine Chaträume gefunden"), Challenges (Detail: „Noch kein Beitrag von dir"/„Noch keine geteilten Beiträge", je nach aktiv/beendet), Teamer-Konfi-Historie („Keine Konfi-Daten vorhanden"), Wrapped (`error` 404 → „Dein Wrapped wird bald freigeschaltet").
- **Abgesagte Termine (Konfi, Team, Startseiten):** `istAbgesagt` prüft beide Felder; Titel in Listen durchgestrichen, im Detail nicht (bewusst, `eventFormatting.ts:159-210`); Anmelde-Knöpfe an abgesagten Terminen weg (`EventDetailView.tsx:940-947`, `:1055-1061`), Opt-in serverseitig gesperrt (`konfi.js:1988-1990`), `bucheTermin` sperrt zentral (`bookingUtils.js:852`).
- **Pflichttermine:** Opt-out mit ≥ 5 Zeichen (`UnregisterModal` erzwingt, Server prüft), Opt-in nur aus `opted_out`, Offline-Abmeldung in Warteschlange mit `client_id` und Idempotenz (`konfi.js:1885-1897`).
- **Abmeldefrist:** 2 Tage, Frontend (`canUnregister`, `EventDetailView.tsx:328-333`) und Backend (`konfi.js:1671-1680`) rechnen gleich; Knopf nennt den Grund („Abmelden geht nur bis 2 Tage vorher").
- **QR-Check-in:** Kamera verweigert → eigene Seite mit Hinweis; alle Server-Meldungen aus dem Handbuch (`checkin.js`: nicht angemeldet, Warteliste, `opted_out`, `excused`, bereits eingecheckt, fremde Gemeinde) werden per `fehlerText` angezeigt; Token nur per Scan, `qr_token` wird aus beiden Listen entfernt (`konfi.js:1334-1340`, `lesen.js:320-328`).
- **Zeitfenster:** Detail weigert die Anmeldung, wenn Zeitfenster nicht geladen wurden (`EventDetailView.tsx:382-390`); volle Fenster mit/ohne Warteliste unterschieden.
- **Anträge/Foto:** `compressForUpload` verkleinert erst (1920 px, JPEG 0,8) und prüft dann 5 MB; Server prüft Magic-Bytes und verschlüsselt (`konfi.js:787-826`); `useActionGuard` gegen Doppelabsenden; Offline-Antrag mit lokal gesichertem Foto und `client_id`; Ablehnungsgrund sichtbar (`RequestDetailModal.tsx:316-324`); Löschen nur `pending` (Frontend und Server `konfi.js:942-945`).
- **Challenges:** Einreichen nur online, `useActionGuard`, 50-MB-Grenze vor dem Upload, Server prüft Medienart gegen `allowed_media`, Magic-Bytes, Musik-Link-Erlaubnisliste; Ablehnungsbegründung (`moderation_note`) am eigenen Beitrag sichtbar (`ChallengeDetailModal.tsx:279-289`); Löschen eigener Beiträge bewusst gesperrt (403 mit Erklärung), Handbuch 80-challenges.md:416-431 stimmt; anonyme Beiträge verlassen den Server ohne Namen (`challenges.js:615-624`); Galerie-Links nur `istWebLink`.
- **Abzeichen:** Fortschritt kommt vom Server (`progress`), Rückfall nur für Punkte-Kriterien ohne `progress`; alle 18 Kriterientypen haben eine Gruppe (`BadgesView.tsx:91-115`); mark-seen dedupliziert und lädt Zähler nach; geheime Abzeichen erst nach Erhalt sichtbar.
- **Chat:** Reaktionen auf sechs feste Werte begrenzt (Server `allowedEmojis`), Löschen fremder Nachrichten nur Leitung und nur in öffnbaren Räumen (`chat.js:2326-2334`), Umfragen nur Leitung (`ChatHeader` und Server), „Neue Nachrichten"-Trenner einmalig pro Anker (`ChatMessagesList.tsx`), Auto-Scroll parkt am Trenner, Reconnect lädt `after=` nach, Fallback-Poll 30 s nur bei sichtbarer Seite, Offline-Nachrichten mit Wiederholen/Löschen, `client_id`-Dedupe im Socket-Handler.
- **Jahresrückblick / Teilen:** ShareCard trägt nur eigene Zahlen, eigenen Namen, Jahrgangsnamen, Gemeindenamen, Challenge-Titel und gekürzten eigenen Text; **keine Fotos/Medien, keine Namen anderer Personen** (`ShareCard.tsx`, geprüft alle `slides.*`-Zugriffe; `konfis_betreut.jahrgaenge` sind Jahrgangsnamen). Alte Snapshots ohne `kacheln` laufen über die feste Reihenfolge; Slides mit fehlenden Daten liefern `null` statt zu werfen (`WrappedModal.tsx` Renderer). Historie nur der aktiven Gemeinde (`wrapped.js:3146-3154`). Konfi-Freigabe-Gate in `/me` (`wrapped.js:2198-2216`). Wächter `wrappedTeilenKarteInhalt.test.tsx` grün.
- **Multi-Gemeinde, systematisch alle Seiten des Bereichs:** Reiter-Seiten tragen den Umschalter (Konfi: Start, Chat, Challenges, Mitmachen, Badges; Team: Start, Chat, Challenges, Mitmachen, Material). Unterseiten schalten ab: `KonfiProfilePage`, `konfi/EventDetailView` (alle 3 Kopfzeilen), `ChatRoom`/`ChatHeader`/`ChatRoomView`, `TeamerProfilePage`, `TeamerBadgesPage`, `TeamerKonfiStatsPage` (beide Zustände), `TeamerMaterialPage` (Detail), `TeamerMaterialDetailPage` (Modal, auch ohne Glocke). Einzige Ausnahme: BF-05. Zähler-Reset beim Wechsel siehe „Alte Befunde".
- **Teamer-Datenzugriff auf fremde Jahrgänge ist serverseitig begrenzt, nicht nur im UI:** `GET /events` filtert nach Zuweisung und meldet `X-Kein-Jahrgang-Zugewiesen`, `GET /events/:id` → 403 `jahrgang_nicht_zugewiesen` (Frontend zeigt Erklärung), `GET /material` → `jahrgangsSchranke` (`material.js:54-71`), `GET /challenges/konfi` → `viewableJahrgangIds`, `GET /teamer/requests` → nur eigene, `GET /wrapped/history/:userId` → `darfKonfi`. Konfi-Teilnehmerliste anonymisiert („Vorname N.") und org-geprüft (`konfi.js:1452-1517`).
- **Material-Links:** Frontend öffnet nur `istWebLink` (http/https), Server nimmt nur `http:`/`https:` an (`material.js:120`); `link_url` bleibt für Store-Apps der erste Link.
- **Typprüfung:** `npx tsc --noEmit` → Exit 0 (22,7 s).
- **Bestehende Wächter des Bereichs (Stichprobe, heute ausgeführt, 7 Dateien, 129 Tests grün):** `laufenderTerminVerbuchen`, `abgesagteTermineAnsichten`, `teamerZusageKarteAbgesagt`, `KonfiBadgesPageMarkSeen`, `wrappedTeilenKarteInhalt`, `umschalterInDetailansichten`, `abmeldefristSichtbar`.

## Nicht geprüft

- Die einzelnen Wrapped-Slide-Komponenten (`slides/*.tsx`, `slides/teamer/*.tsx`) inhaltlich — nur der Aufbau in `WrappedModal` und die Teilen-Karte.
- `MembersModal`, `SimpleCreateChatModal`, `PollModal` über die API-Weiche hinaus (wer welche Route ruft); `KonfispruchSelectModal`; Onboarding- und Walkthrough-Modals (230/220/211).
- `VideoPreview`, `LazyImage`, `AudioPlayer`, `FileViewerModal`, `mediaCache` — Medienwiedergabe braucht ein Gerät.
- `TeamerActivityRequestModal` im Detail (Spiegel von `ActivityRequestModal`, nur die Routen abgeglichen); `TeamerChallengesPage`/`shared/ChallengesPage` nur überflogen.
- Push-Navigation, Deep-Links, iPad-Split-View, Tastatur-/Scroll-Verhalten, Dunkelmodus.
- Laufzeit- und Speicherverhalten großer Listen (siehe Unklar).
- Backend-Tests wurden nicht ausgeführt (keine Datenbank nötig für diesen Bereich; Routen gelesen).

## Auf Produktion nachzumessen

- **BF-01 Betroffene:** `SELECT COUNT(*) FROM event_bookings eb JOIN events e ON e.id = eb.event_id JOIN users u ON u.id = eb.user_id JOIN roles r ON r.id = u.role_id WHERE eb.status = 'excused' AND r.name = 'konfi' AND e.event_date > NOW() AND e.cancelled IS NOT TRUE AND e.mandatory IS NOT TRUE;` — so viele Konfis sehen heute „Nicht verfügbar" statt „Wieder anmelden".
- **BF-02 Betroffene:** `SELECT COUNT(*) FROM event_bookings eb JOIN events e ON e.id = eb.event_id WHERE eb.status = 'waitlist' AND e.event_date > NOW() AND e.cancelled IS NOT TRUE;`
- **BF-02/BF-09 Häufigkeit:** In Umami die Fehlermeldung „Du bist bereits für dieses Event angemeldet" (Ort `event-angemeldet`/`setError`) über 30 Tage zählen.
- **BF-03 Reichweite:** `SELECT organization_id, value FROM settings WHERE key = 'dashboard_show_ranking';` — Organisationen ohne Eintrag haben das Ranking an.
- **BF-04 Reichweite:** `SELECT room_id, COUNT(*) FROM chat_messages WHERE deleted_at IS NULL GROUP BY room_id HAVING COUNT(*) > 100 ORDER BY 2 DESC;` — in diesen Räumen ist Verlauf unerreichbar.
- **BF-07 Relevanz:** `SELECT organization_id, COUNT(*) FROM wrapped_ausgaben WHERE wrapped_type = 'teamer' GROUP BY 1 HAVING COUNT(*) > 1;` — ab der zweiten Team-Ausgabe greift der Befund.
- **BF-08 Häufigkeit:** Nginx/App-Log auf `413` unter `/api/chat/rooms/*/messages` zählen.
- **Unklar „Konfi ohne Jahrgang":** `SELECT COUNT(*) FROM konfi_profiles kp JOIN users u ON u.id = kp.user_id JOIN roles r ON r.id = u.role_id WHERE r.name = 'konfi' AND kp.jahrgang_id IS NULL;` — muss 0 sein.
- **Chat-Ladezeit:** p95 von `GET /chat/rooms/:id/messages?limit=100` im APM (Reaktionen und Stimmen werden je Nachricht nachgeladen, `chat.js:1015-1045`).
