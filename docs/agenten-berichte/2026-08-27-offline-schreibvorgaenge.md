# Offline-Schreibvorgänge: Was passiert, wenn der Server später Nein sagt

**Auftrag:** Prüfung der Schreibrichtung der Offline-Fähigkeit — Warteschlange
finden, Vorgangstypen listen, Fehlerbehandlung beim Nachreichen messen,
Doppel-Ausführung und Reihenfolge prüfen, drei Ansichten abgleichen
(Analyse, kein Umbau).
**Datum:** 27.08.2026
**Geprüfter Commit:** `9ceaea2e` (Branch `docs/badge-counts-newbadges`;
`git diff main -- frontend/src` ist leer, das geprüfte Frontend ist identisch
mit `main` = `5b0dfe46`).
**Urteil in einem Satz:** Die Warteschlange selbst ist solide gebaut (FIFO,
Retry-Budget, kein Datenverlust im Transport), aber eine vom Server
ABGELEHNTE Nachreichung existiert für alles außer Chat nur als
4-Sekunden-Toast — läuft der Flush im Hintergrund, verschwindet sie komplett
lautlos, und selbst eine ERFOLGREICHE Nachreichung kann lügen (Teamer-Buchung
landet still auf der Warteliste).

Alle mit "gemessen (M#)" markierten Aussagen wurden am 27.08.2026 mit einem
temporären Vitest-Lauf gegen den echten `writeQueue`-Code belegt (8 Tests,
8 grün, Datei nach der Messung gelöscht).

---

## 1. Die Warteschlange

Eine einzige, zentrale Outbox: `frontend/src/services/writeQueue.ts`.
Persistenz in Capacitor `Preferences` unter `queue:items` (writeQueue.ts:58,
144-171), Items mit `method/url/body/maxRetries/metadata` (writeQueue.ts:9-25).
Dateien (Fotos, Chat-Medien) liegen bis zum Versand lokal im Filesystem und
werden erst beim Flush zu FormData aufgelöst (writeQueue.ts:223-318).

Nachgereicht wird:
- bei jedem Offline-zu-Online-Wechsel (`networkMonitor.subscribe`,
  writeQueue.ts:559-563),
- beim Socket-Reconnect als koordinierte Sequenz flush -> invalidateAll ->
  `sync:reconnect` (services/websocket.ts:54-72),
- beim App-in-Vordergrund (contexts/AppContext.tsx:665-673),
- beim App-in-Hintergrund als `flushTextOnly()` ohne Datei-Uploads via
  BackgroundTask (AppContext.tsx:676-684).

Fehlerlogik (writeQueue.ts:400-428): 4xx außer 408/429 -> Item wird ENTFERNT
und als `failed` gemeldet; 5xx/408/429/Netzfehler -> `retryCount++`, nach
`maxRetries` (meist 5) ebenfalls entfernt. Offline-Flushes verbrennen kein
Retry-Budget (writeQueue.ts:339-343), `clear()` bei Logout/Org-Wechsel räumt
auch lokale Dateien und schützt per Generation-Zähler vor Wiederauferstehung
(writeQueue.ts:535-555).

## 2. Was darin landet (nach `metadata.type`)

| Typ | Vorgänge | Beleg |
|---|---|---|
| `chat` | Nachricht inkl. Bild/Video | chat/chatOutbox.ts:141 |
| `request` | Aktivität melden inkl. Foto (Konfi + Teamer) | konfi/modals/ActivityRequestModal.tsx:242, teamer/modals/TeamerActivityRequestModal.tsx:245 |
| `opt-out` | Konfi-Abmeldung von Pflicht-Terminen | konfi/views/EventDetailView.tsx:141 |
| `teamer` | Zusage/Absage, Event buchen, Event stornieren | teamer/pages/TeamerEventsPage.tsx:464, 575, 605 |
| `admin` | Event/Serie anlegen+bearbeiten, Aktivität verbuchen/entfernen, Bonuspunkte, Badge/Level/Kategorie/Jahrgang/Material/Zertifikat-CRUD, Dashboard-Settings, Rollentitel | admin/modals/EventModal.tsx:284-290, ActivityManagementModal.tsx:222/232, BonusModal.tsx:101, u.v.m. |
| `fire-and-forget` | mark-read, Badges-gesehen, Bibelübersetzung, Umfrage-Stimme, Reaktion | contexts/BadgeContext.tsx:144, KonfiBadgesPage.tsx:99, ProfileView.tsx:199, chat/ChatRoom.tsx:929, 1015 |

NICHT in der Queue (bewusst, Bericht 25.08.): Konfi-Event-ANMELDUNG, QR-Check-in,
Challenge-Einreichung, Anwesenheit, Löschungen — sie melden offline einen Fehler.

Alle drei Rollen-Bäume (admin/, teamer/, konfi/) und der Chat nutzen DIESELBE
Queue — es gibt keinen zweiten Weg (vollständige Aufrufer-Liste per
`grep -rn "writeQueue.enqueue"`, 38 Stellen, alle importieren
services/writeQueue). Der Rollen-Unterschied liegt nicht im Mechanismus,
sondern in der Sichtbarkeit (Befund M2 unten).

---

## Befunde

### HOCH

**H1 — Abgelehnte Nachreichungen verschwinden für alles außer Chat: bestenfalls
ein 4-Sekunden-Toast, im Hintergrund komplett lautlos.**
Gemessen (M1-M3): Ein 409 auf "Event buchen", ein 400 auf eine Abmeldung, ein
403 auf einen Antrag — in allen Fällen wird das Item aus der Queue entfernt,
es entsteht KEIN persistenter Eintrag (`queue:failedChat` bleibt leer, der
Merker greift ausdrücklich nur bei `type === 'chat'`, writeQueue.ts:106), und
das einzige Signal ist `toastController.create` mit 4 s Dauer
(writeQueue.ts:189-219). Wirft der Toast — Hintergrund-Flush via
BackgroundTask (AppContext.tsx:676-684), Kaltstart, Web ohne Ionic-Overlay —
wird das im `catch` geschluckt (writeQueue.ts:198-200): der Vorgang ist dann
SPURLOS weg. Der `onItemFailed`-Melder (writeQueue.ts:45-48) hat genau einen
Abonnenten, und der lebt nur in einem geöffneten Chat-Raum
(chat/ChatRoom.tsx:136).
Konkret heißt das: Eine Konfi meldet sich offline von der Freizeit ab, die App
bestätigt "Abmeldung wird gesendet" (EventDetailView.tsx:153) — ist der Termin
beim Nachreichen vorbei, antwortet der Server 400 "Event ist bereits vorbei"
(backend/routes/konfi.js:1994-1996), die Abmeldung verpufft, die Konfi gilt
als unentschuldigt abwesend und glaubt das Gegenteil. Dasselbe Muster trifft
einen offline angelegten Termin der Leitung: bei 400 ist der gesamte
eingetippte Inhalt (Name, Beschreibung, Zeiten) unwiederbringlich verloren.
Die Testdatei writeQueue.test.ts:181 dokumentiert dieses Verhalten sogar als
Soll ("Nicht-Chat-Items landen NICHT im Merker").
**Vorschlag:** Den bewährten Chat-Fehl-Merker (writeQueue.ts:74-122) auf alle
sichtbaren Typen verallgemeinern (`queue:failedItems` mit label, url, body,
Fehlertext) plus eine kleine "Nicht gesendet"-Liste, z.B. im Profil oder als
Badge — exakt das war Vorschlag 4 des 25.08.-Berichts und ist weiter offen.

**H2 — Teamer-Offline-Buchung: die Server-Antwort wird verworfen, eine stille
Wartelisten-Platzierung erfährt niemand.**
Das ist das Leitfrage-Szenario, und es ist real — nur beim Teamer, nicht beim
Konfi. Online zeigt `handleBook` die Warteliste ausdrücklich an
(TeamerEventsPage.tsx:566-573: "Du stehst auf der Warteliste..."). Offline
wird derselbe POST gequeued (TeamerEventsPage.tsx:575-586, Meldung "Buchung
wird gesendet sobald du wieder online bist") — aber `flush()` wirft die
Response weg (writeQueue.ts:387-399, `FlushResult` transportiert nur die
Items). Gemessen (M5): Antwortet der Server `{status: 'waitlist'}`
(backend/routes/events.js:1719-1725 setzt bei vollem Teamer-Kontingent auf
`waitlist`), landet das Item in `succeeded`, kein Toast, kein Ereignis — die
Teamer:in hält sich für fest angemeldet und steht auf der Warteliste. Ist das
Kontingent voll UND die Warteliste zu, kommt ein 4xx und H1 greift (Toast oder
nichts). Der 25.08.-Bericht hatte diese Asymmetrie ("eher dort überdenken")
bereits angemerkt; jetzt ist sie gemessen.
**Abschwächung:** Der Reconnect-Flush invalidiert anschließend den Cache
(websocket.ts:60-64), die Event-Liste zeigt danach "Warteliste" — aber nur,
wenn die Teamer:in aktiv nachschaut. Es gibt keinen Push und keinen Hinweis.
**Vorschlag:** Entweder die Teamer-Offline-Buchung wie die Konfi-Anmeldung
bewusst online-pflichtig machen (ehrlichste Lösung, Konsistenz mit der
Begründung im 25.08.-Bericht), oder `FlushResult` um die Server-Antwort
erweitern und bei `status === 'waitlist'` einen Toast/Push auslösen.

### MITTEL

**M1 — Doppelte Ausführung bei Timeout-Retry: Chat und Anträge sind geschützt,
Bonuspunkte, Aktivität-Verbuchen und Event-Anlegen nicht.**
Gemessen (M6): Scheitert ein Versand mit Timeout (kein `response.status` ->
transient), obwohl der Server verarbeitet hat, wird derselbe POST beim
nächsten Flush byte-identisch wiederholt. Dasselbe droht bei App-Abbruch
zwischen erfolgreichem Request und `_save` (writeQueue.ts:387-399). Schutzlage
pro Endpunkt:
- GESCHÜTZT: Chat-Nachrichten (client_id-Dedup, backend/routes/chat.js:933-943
  plus Unique-Fallback :1123), Aktivitätsanträge Konfi und Teamer (konfi.js:724-727,
  852; teamer.js:1440-1443), Teamer-Zusage (UPDATE-oder-INSERT, idempotent,
  teamer.js Zusage-Handler), Buchung (Duplikat-Check -> 409, events.js:1685-1693),
  Opt-out (UPDATE nur bei status='confirmed' -> zweiter Lauf 400, konfi.js:1999-2007).
- UNGESCHÜTZT: Bonuspunkte — blanker INSERT plus Punkte-Addition ohne jeden
  Schlüssel (konfi-management.js:845-857): doppelte Punkte. Aktivität verbuchen
  (admin, INSERT user_activities + Punkte): doppelt. Event/Serie anlegen
  (POST /events ohne client_id im Body, EventModal.tsx:287-290): doppelter
  Termin samt doppelter Pflicht-Buchungen.
Beachte die Kehrseite der "geschützten" Fälle: Der Wiederholungs-409/400 wird
als 4xx-FEHLSCHLAG behandelt — die Nutzerin bekommt "Event buchen konnte nicht
gesendet werden", obwohl die Buchung längst durch ist (Phantom-Fehler, falsches
Lagebild in die andere Richtung). Der Opt-out sendet sogar eine `client_id`
mit (EventDetailView.tsx:144), aber der Server ignoriert sie (konfi.js:1970
destrukturiert nur `reason`).
**Vorschlag:** `metadata.clientId` existiert bereits für JEDES Queue-Item —
sie als `client_id` in den Body aller POST-Bodies übernehmen und serverseitig
für bonus-points, assign-activity und POST /events dedupen (Muster aus
konfi.js:724 kopieren); bei den Guard-geschützten Endpunkten den
Duplikat-Fall als Erfolg statt Fehler beantworten (409 mit `already: true`
oder 200).

**M2 — Wartende Vorgänge sind nur für zwei Typen sichtbar; Abmeldung, Buchung
und alle Admin-Änderungen warten unsichtbar.**
Seit dem 25.08. verbessert: Anträge (`type: 'request'`) erscheinen in Konfi-
und Teamer-Ansicht als "Wird gesendet..."-Block mit Warte-Badge
(KonfiEventsPage.tsx:141, 438-460; TeamerEventsPage.tsx:160, 1313), Chat
rekonstruiert wartende Bubbles (ChatRoom.tsx:213-259). Aber: `getByMetadata`
wird nirgends für `opt-out`, `teamer` oder `admin` aufgerufen (grep über
frontend/src, nur 'request' und 'chat'). Folgen: Das Konfi-Event-Detail zeigt
weiter "angemeldet", obwohl eine Abmeldung in der Queue wartet; die
Teamer-Event-Karte zeigt "Offen" statt "Buchung wartet"; ein offline
angelegter Termin fehlt in der Admin-Liste komplett, bis der Flush
durch ist — wer nachschauen will, ob das Anlegen geklappt hat, sieht nichts
und legt ihn womöglich ein zweites Mal an (dann tatsächlich doppelt, ganz
ohne Retry). Zusammen mit H1 gilt: unsichtbar beim Warten, unsichtbar beim
Scheitern.
**Vorschlag:** Mindestens die zustandsrelevanten Typen (`opt-out`, `teamer`)
in den jeweiligen Detail-Ansichten als "wartet auf Versand" kennzeichnen —
das Render-Muster aus KonfiEventsPage.tsx:438 existiert bereits.

**M3 — Umfrage-Stimme: optimistisch angezeigt, Ablehnung komplett stumm — auch
im Konfliktfall "Option schon vergeben".**
Die Stimme wird offline sofort ins UI gemalt (ChatRoom.tsx:911-925) und als
`fire-and-forget` gequeued (ChatRoom.tsx:929-934). `fire-and-forget` ist vom
Fehler-Toast ausgenommen (writeQueue.ts:210) — gemessen (M4): ein 4xx erzeugt
NICHTS. Bei exklusiven Umfragen (Kuchen-Listen-Fall) antwortet der Server
409 "Diese Option ist bereits vergeben" (chat.js:2040-2051): die Konfi glaubt,
den Platz zu haben, tatsächlich hat ihn jemand anderes — erst ein späterer
Blick in die (nach Reconnect revalidierte) Umfrage zeigt es, ohne Hinweis.
Randnotiz Doppel-Ausführung: Bei Mehrfachauswahl-Umfragen löscht der Server
alte Stimmen NICHT (DELETE nur bei `!poll.multiple_choice`, chat.js:2057-2062)
— ein Timeout-Retry kann dieselbe Stimme doppelt eintragen; die
Reaktions-Route ist ein Toggle (chat.js:2415-2419), ein Retry ENTFERNT die
gerade gesetzte Reaktion wieder.
**Vorschlag:** Umfrage-Stimmen von `fire-and-forget` auf einen sichtbaren Typ
heben (Toast bei 4xx genügt hier) und bei Mehrfachauswahl serverseitig
`ON CONFLICT DO NOTHING` auf (poll_id, user_id, user_type, option_index).

### NIEDRIG

**N1 — Hintergrund-Flush verletzt die Reihenfolge: spätere Text-Items überholen
frühere Datei-Items.**
Gemessen (M7): `flushTextOnly()` überspringt `hasFileUpload`-Items
(writeQueue.ts:456-459) und sendet dahinterliegende Text-Items zuerst. Eine
später getippte Chat-Textnachricht steht dann auf dem Server VOR dem früher
gesendeten Foto; über Vorgangstypen hinweg ist es fachlich harmlos.
Der Vordergrund-Flush arbeitet dagegen strikt FIFO — gemessen (M8): offline
erst Zusage, dann Absage ergibt exakt diese Reihenfolge, und da die
Zusage-Route ein Upsert ist, gewinnt korrekt die letzte Aussage.
**Vorschlag:** dokumentieren oder `flushTextOnly` pro `roomId` stoppen, sobald
ein Datei-Item übersprungen wurde.

**N2 — Kopf-Blockade: ein dauerhaft transient scheiterndes Item bremst alle
nachfolgenden.**
Bei 5xx/Timeout bricht der Flush ab (`break`, writeQueue.ts:426-427) — korrekt
gegen Reihenfolge-Verletzung, aber ein einzelnes Item mit z.B. kaputtem
Foto-Upload hält bis zu `maxRetries` Flush-Runden lang auch alle wartenden
Abmeldungen und Buchungen zurück. Kein Handlungsbedarf, solange H1 behoben
wird (dann ist wenigstens sichtbar, WAS klemmt).

---

## Antwort auf die Leitfrage

Wird ein Schreibvorgang aus der Warteschlange später abgelehnt (409/403/400/404),
erfährt die Person davon genau dann, wenn (a) es eine Chat-Nachricht war
(persistenter Merker, Bubble mit Retry-Knopf) oder (b) die App im Vordergrund
läuft und sie den 4-Sekunden-Toast zufällig sieht. In allen anderen Fällen —
Hintergrund-Flush, App-Neustart, übersehener Toast — verschwindet der Vorgang
still. Das konkrete Eingangs-Szenario (offline zum Termin anmelden, Termin ist
beim Nachreichen voll) trifft die Konfi-Rolle NICHT (Anmeldung ist bewusst
online-pflichtig), die Teamer-Rolle aber doppelt: bei voller Warteliste als
stiller Totalausfall (H1), bei freier Warteliste als stille Falsch-Auskunft
"gebucht" statt "Warteliste" (H2).

## Kurzfassung

**7 Befunde: 2 HOCH, 3 MITTEL, 2 NIEDRIG.** Gemessen mit 8 temporären
Vitest-Tests gegen den echten writeQueue-Code (alle grün, Datei gelöscht).

Die zwei wichtigsten:
1. **H1:** Eine vom Server abgelehnte Nachreichung existiert für alles außer
   Chat nur als 4-Sekunden-Toast; im Hintergrund-Flush oder nach Neustart ist
   sie spurlos weg (writeQueue.ts:106, 189-219). Eine offline abgegebene
   Abmeldung kann so verpuffen, während die App "wird gesendet" bestätigt hat.
2. **H2:** Die Teamer-Offline-Buchung verwirft die Server-Antwort — landet
   die Buchung auf der Warteliste, erfährt die Teamer:in das nie
   (writeQueue.ts:387-399, TeamerEventsPage.tsx:575-586, events.js:1719-1725).
   Entweder online-pflichtig machen wie beim Konfi oder die Antwort auswerten.
