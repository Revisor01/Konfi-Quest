# Anonyme Nutzungsmessung (Umami) — Bestand und Messkonzept

Stand: 27.09.2026. Anlass: Simon, 27.09.2026 — „Aktivitäten wäre auch gut: wie
oft abgelehnt wird. Und auch hier Teamer, Konfi — gibt's ja für beide. Material
hinterlegt, abgerufen auch bitte. Konfi-Sprüche später auch verfolgen: welche
Sprüche, welche Übersetzung, eigene. Also da sollten wir nochmal schauen, was
wir alles mit Umami haben wollen."

Die Quelle der Wahrheit ist `frontend/src/services/analytics.ts`. Dieses
Dokument fasst zusammen, **was** heute gemessen wird, **wo** und **wann** — und
was dazukommen könnte. Adressen und Kennungen des Umami-Servers stehen bewusst
nicht hier; sie stehen im Code an genau einer Stelle.

## Grundsätze

Sie stehen ausführlich in den Kommentaren von `analytics.ts` und gelten für
jeden neuen Messpunkt unverändert:

- **Anonym.** Keine Namen, keine Nutzer-, Event-, Material- oder
  Gemeinde-Kennung, kein Jahrgang, keine Titel, keine Dateinamen, keine
  Freitexte, keine Punktzahlen und keine Anzahlen — bei einer Gemeinde mit drei
  Teamer:innen wäre schon eine Anzahl ein Fingerabdruck.
- **Die Rolle ist das einzige Personenmerkmal** (`konfi`, `teamer`, `admin`;
  `org_admin` zählt als `admin`, alles andere als `sonstige`). `track` hängt
  sie an jedes Ereignis.
- **Werte aus Formularen nur über eine Positivliste** (`ERLAUBTE_MERKMALE` für
  `trackHandlung`). Was nicht in der Liste steht, fällt heraus; das Ereignis
  selbst geht trotzdem, damit die Zählung stimmt. Dasselbe gilt für Texte, die
  nicht aus dem Code stammen: Fehlermeldungen gehen nur im Wortlaut raus, wenn
  sie in `utils/bekannteFehlertexte.ts` stehen (B1).
- **Erst nach der erfolgreichen Server-Antwort melden, nie beim Klick.** Ein
  Klick, der in einem Fehler endet, ist keine Nutzung. Offline eingereihte
  Schreibvorgänge zählen deshalb heute nicht.
- **Die Messung stört nie.** Versand ohne Warten (`keepalive`), jeder Fehler
  wird verschluckt, in der Entwicklung ist sie aus (`import.meta.env.PROD`).
- **Keine echten Routen.** Jedes Ereignis trägt dieselbe feste Adresse `/app`;
  echte Pfade können Kennungen enthalten.
- **Kein Chat.** Die Zahl der Nachrichten sagt über die pädagogische Nutzung
  nichts und liegt inhaltlich zu nah an den Beteiligten (begründet in
  `analytics.ts`, Typ `Handlung`).
- **Ereignis- und Merkmalsnamen sind ASCII ohne Umlaut-Umschreibung**
  (für die Handlungen geprüft in `nutzungstiefeAufrufstellen.test.ts`;
  `aktivitaet` ist dort die eine benannte Ausnahme). Ältere Ereignisse außerhalb
  der Handlungen tragen noch Umschreibungen (`aktivitaet-eingereicht`,
  `bestaetigt`); sie bleiben, damit die Zahlen im Dashboard vergleichbar
  bleiben.

### Was Umami selbst dazulegt

Neben dem, was die App schickt (Ereignisname, Merkmale, Rolle,
Bildschirmgröße, Sprache `de`, feste Adresse), leitet Umami serverseitig ab:
Browser, Betriebssystem, Gerätetyp und — aus der IP-Adresse, die selbst nicht
gespeichert wird — Land, Region und Stadt, sofern der Server eine
Ortsdatenbank hat. Mehrere Ereignisse hängen über eine Sitzungskennung
zusammen, die Umami aus IP-Adresse, Browserkennung und einem wechselnden
Salz bildet.

Das ist für jeden neuen Messpunkt die eigentliche Messlatte: Ein Merkmal, das
für sich harmlos ist, kann über Stadt, Tag und Sitzung eine Person
wiedererkennbar machen — und dann **alle** Ereignisse dieser Sitzung mit ihr
verbinden. Siehe Befund B4 zum Salz.

## Messpunkte heute

Stand des Codes am 27.09.2026 (vollständig: alle Aufrufe von `track(`,
`trackBereich(`, `trackHandlung(`, `trackFehler(`, `trackSitzungsstart(` und
`trackMitmachenAnsicht(` unter `frontend/src/`).

| Ereignis | Merkmale (erlaubte Werte) | Rolle(n) | Aufrufstelle | Wann gemeldet |
|---|---|---|---|---|
| *(Seitenaufruf, ohne Namen)* | nur `rolle` | alle | `contexts/AppContext.tsx` (`trackSitzungsstart`) | sobald eine Rolle feststeht: nach der Anmeldung, beim Start mit gespeicherter Anmeldung, beim Gemeindewechsel mit anderer Rolle. Ohne ihn zählt Umami keine Besuche. |
| `bereich-geoeffnet` | `bereich`: zweiter Pfadteil, Unterseiten des Profils unter ihrem eigenen Namen, nur Kleinbuchstaben und Bindestriche (`bereichAusPfad`). Leitung: `konfis`, `chat`, `activities` (Aktivitäten-Verwaltung), `events`, `settings`, `badges`, `challenges`, `users`, `organizations`, `material`, `wrapped`, `profile`, `metrics`. Team: `dashboard`, `chat`, `events`, `challenges`, `material`, `badges`, `konfi-stats`, `profile`. Konfi: `dashboard`, `events`, `challenges`, `badges`, `chat`, `profile` | alle | `components/layout/MainTabs.tsx` | bei jedem Pfadwechsel, auch ohne Tab-Leiste (Detailseiten zählen unter ihrem Bereich) |
| `bereich-geoeffnet` (über `trackMitmachenAnsicht`) | `bereich`: `events` \| `activities` | konfi, teamer | `konfi/pages/KonfiEventsPage.tsx`, `teamer/pages/TeamerEventsPage.tsx` | beim Umschalten der Leiste „Events \| Aktivitäten" und beim Einstieg mit `?segment=antraege` |
| `aktivitaet-eingereicht` | `mit_foto`: `true` \| `false` | konfi, teamer | `konfi/modals/ActivityRequestModal.tsx`, `teamer/modals/TeamerActivityRequestModal.tsx` | nach erfolgreichem `POST /konfi/requests` bzw. `/teamer/requests`; offline eingereiht zählt nicht |
| `event-angemeldet` | `status`: `bestaetigt` \| `warteliste`; `mit_zeitfenster`: `true` \| `false` | konfi | `konfi/views/EventDetailView.tsx` | nach erfolgreichem `POST /konfi/events/:id/register` |
| `challenge-beitrag` | `medium`: `text` \| `photo` \| `audio` \| `video` \| `link`; `sichtbarkeit`: `publish` \| `private` \| `anonymous` | konfi, teamer, admin | `konfi/modals/ChallengeSubmitModal.tsx` (auch aus dem Challenge-Detail von Team und Leitung) | nach erfolgreichem `POST /challenges/konfi/:id/submissions` |
| `dashboard-gescrollt` | `tiefe`: `25` \| `50` \| `75` \| `100` | konfi | `konfi/pages/KonfiDashboardPage.tsx` | beim Scrollen, jede Marke einmal, solange die Seite besteht |
| `punkte-vergeben` | `weg`: `aktivitaet` \| `bonus`; `punkteart`: `gottesdienst` \| `gemeinde` \| `ohne` | admin | `admin/modals/ActivityModal.tsx`, `admin/modals/BonusModal.tsx` | nach erfolgreichem `POST /admin/konfis/:id/activities` bzw. `/bonus-points`; offline zählt nicht |
| `anwesenheit-erfasst` | `umfang`: `einzeln` \| `alle`; `gruppe`: `konfi` \| `teamer` | admin | `admin/views/EventDetailView.tsx` | nach erfolgreichem `PUT …/attendance` bzw. `…/attendance-all` |
| `beitrag-moderiert` | `entscheidung`: `freigegeben` \| `ausgeblendet` \| `wieder-sichtbar` \| `anonymisiert` | teamer, admin | `admin/modals/ChallengeLeitungModal.tsx` | nach erfolgreichem `PUT /challenges/admin/submissions/:id/moderate` |
| `termin-angelegt` | `form`: `einzeln` \| `serie`; `zielgruppe`: `konfi` \| `teamer` | admin | `admin/modals/EventModal.tsx` | nach erfolgreichem `POST /events` bzw. `/events/series`; Bearbeiten zählt nicht |
| `material-bereitgestellt` | `inhalt`: `datei` \| `link` \| `beides` \| `nur-text` | admin | `admin/modals/MaterialFormModal.tsx` | nach Anlegen **und** Datei-Upload; nur neues Material, nicht das Bearbeiten |
| `antrag-entschieden` | `entscheidung`: `angenommen` \| `abgelehnt`; `antrag_von`: `konfi` \| `teamer` | admin | `admin/modals/ActivityRequestModal.tsx` | nach erfolgreichem `PUT /admin/activities/requests/:id`; offline eingereiht zählt nicht |
| `material-angesehen` | `inhalt`: `datei` \| `link` \| `beides` \| `nur-text` | teamer, admin | `teamer/pages/TeamerMaterialPage.tsx`, `teamer/pages/TeamerMaterialDetailPage.tsx` | nach der erfolgreichen Antwort auf `GET /material/:id`, einmal je Öffnen; ein Stand nur aus dem Zwischenspeicher zählt nicht |
| `material-abgerufen` | `inhalt`: `datei` \| `link` | teamer, admin | dieselben beiden | Datei: nach erfolgreichem `GET /material/files/…`; Link: wenn er geöffnet wird |
| `konfispruch-gespeichert` | `quelle`: `vorschlag` \| `eigen`; `bibel` (nur bei `vorschlag`): `luther` \| `gute-nachricht` \| `bigs` \| `elberfelder` | konfi, teamer | `konfi/modals/KonfispruchSelectModal.tsx` | nach erfolgreichem `PATCH /konfi/profile` bzw. `/teamer/profile`; unverändert gespeichert zählt nicht |
| `fehler` | `stelle`: die angezeigte Meldung nur, wenn sie auf der Positivliste steht (`utils/bekannteFehlertexte.ts`: 203 Texte der App, 19 Server-Texte der Event-An- und -Abmeldung), Ziffern durch `#` ersetzt, höchstens 80 Zeichen; ein anderer Text vom Server wird durch den Ersatztext der Aufrufstelle aus `fehlerText(err, 'Ersatz')` ersetzt, alles Übrige durch `andere-meldung` (`fehlerStelle`); `art`: `http-<Status>` \| `netz` \| `timeout` \| `abbruch` \| `intern` — aus dem Fehlerobjekt der Diagnose oder, bei einem ersetzten Server-Text, aus der Antwort; `ort`: festes Kürzel (`[a-z0-9-]`, höchstens 40 Zeichen) | alle | `contexts/AppContext.tsx` (`setError`) | wenn eine Fehlermeldung angezeigt wird; derselbe Wert geht als Wegmarke ins Absturzprotokoll (Crashlytics, nur iOS und Android) |

Hinweise zur Tabelle:

- Das Team kann kein Material anlegen (`POST /material` verlangt die Leitung);
  `material-bereitgestellt` greift deshalb nur für die Leitung — richtig so.
- `beitrag-moderiert` kommt auch vom Team: Teamer:innen dürfen Beiträge
  durchsehen (`requireTeamer` an der Route).
- Die Leitung hat unter „Mitmachen" ebenfalls die Leiste „Events |
  Aktivitäten" (`admin/pages/AdminEventsPage.tsx`), meldet das Umschalten
  aber nicht. Der Bereich `activities` der Leitung ist die
  Aktivitäten-**Verwaltung** (`/admin/activities`), nicht die Anträge.
- Die Datenschutzerklärung (Abschnitt 9a) zählt die Arten von Handlungen
  einzeln auf. Wer ein Ereignis ergänzt, zieht sie im selben Commit nach.
- Die Startseite `konfi-quest.de` misst mit einer **eigenen** Kennung
  (Klicks, Scrolltiefe, Verweildauer; `public/landing.html`). Sie ist nicht
  Teil dieses Dokuments.

## Welche Fragen sich heute beantworten lassen

| Frage | Heute | Womit |
|---|---|---|
| Wie viele Sitzungen gibt es, je Rolle? | ja | Seitenaufruf mit `rolle` (Sitzungen, nicht Personen) |
| Welche Bereiche werden geöffnet, von wem? | ja; die Aktivitäten der Leitung unter „Mitmachen" nicht (S2) | `bereich-geoeffnet` |
| Werden unter „Mitmachen" Events oder Aktivitäten angesehen? | ja, Konfi und Team | `trackMitmachenAnsicht` |
| Wie viele Aktivitäten werden eingereicht — von Konfis, vom Team, mit Foto? | ja | `aktivitaet-eingereicht` mit `rolle` und `mit_foto` |
| **Wie viele Anträge werden angenommen, wie viele abgelehnt — von Konfis, vom Team?** | **ja** (U1) | `antrag-entschieden` |
| Kommen Anmeldungen der Konfis durch oder landen sie auf der Warteliste? | ja | `event-angemeldet` |
| Meldet sich das Team zu Events an? | nein | siehe S3 |
| Welche Medien werden bei Challenges eingereicht, wie wird die Sichtbarkeit gewählt? | ja | `challenge-beitrag` |
| Arbeitet die Leitung mit der App (Punkte, Anwesenheit, Moderation, Events, Material)? | ja | `trackHandlung` |
| **Wird hinterlegtes Material angesehen, werden Dateien und Links geöffnet?** | **ja** (U2) | `material-angesehen`, `material-abgerufen`, daneben `material-bereitgestellt` |
| **Welche Konfisprüche, welche Übersetzung, wie viele eigene?** | **Übersetzung und eigene ja** (U3); welche Sprüche nicht (S1) | `konfispruch-gespeichert` |
| Wird der Jahresrückblick angesehen? | nur als Bereich `wrapped` der Leitung | siehe S7 |
| Wird das Postfach genutzt? | nein | siehe S8 |
| Welche Mitteilungen schalten Leute ab? | nein | siehe S9 |
| Wie viele nutzen den Dunkelmodus? | nein | siehe S11 |
| Wo und warum treten Fehler auf? | ja; Server-Texte nur bei der Event-An- und -Abmeldung im Wortlaut (B1) | `fehler` |
| Wie viele Punkte, Badges, Level haben Konfis? | nein, und bleibt so | Punktzahlen und Stände wären Fingerabdrücke |

## Befunde aus der Bestandsaufnahme

Im Code geprüft am 27.09.2026, nicht gegen die Umami-Datenbank.

### B1 — Server-Fehlermeldungen tragen Namen in `fehler.stelle` (dringend)

`setError` in `AppContext.tsx` meldet den **angezeigten** Text. Viele Stellen
zeigen die Meldung des Servers (`fehlerText(err, …)`), und einige davon
enthalten Namen oder Dateinamen. Ersetzt werden nur Ziffern; 80 Zeichen reichen
für einen ganzen Namen. Gefunden:

| Server-Text | Quelle | Angezeigt in |
|---|---|---|
| „*Name* gehört zu keinem Jahrgang dieses Events" — der Name einer Konfi | `routes/events/teilnehmer.js` | `admin/modals/ParticipantManagementModal.tsx` |
| „*Name* arbeitet bereits in dieser Gemeinde." / „Für *Name* steht bereits eine Einladung offen." | `routes/einladungen.js` | `admin/modals/EinladungModal.tsx` |
| „Dateityp nicht verifizierbar: *Dateiname*" | `routes/material.js` | `admin/modals/MaterialFormModal.tsx` |
| „Du bist bereits zu einem Konfirmationstermin angemeldet ("*Event-Name*")" | `utils/bookingUtils.js` | `konfi/views/EventDetailView.tsx` |

Das verletzt den ersten Grundsatz. **Vorschlag:** `stelle` nur noch für Texte
der App selbst senden; bei einer Server-Meldung stattdessen einen festen
Platzhalter (`server-meldung`) und die vorhandenen `art`/`ort`. Wo der Server
einen maschinenlesbaren `code` liefert (etwa `konfirmation_already_booked`),
kann der mit — über eine Positivliste. **Aufwand:** mittel (eine Stelle in
`AppContext.tsx` und `fehlerText`, dazu Tests). **Und:** in Umami unter
`fehler` → `stelle` nach diesen Satzanfängen suchen und Treffer löschen.
Eigener Auftrag, nicht Teil dieses Pakets.

**Behoben am 27.09.2026.** Am Code bestätigt: `setErrorTracked`
(`AppContext.tsx`) gab den angezeigten Text nach `\d+ → #` und 80 Zeichen an
`trackFehler` und an die Wegmarke; die Server-Texte stehen in
`events/teilnehmer.js` (Z. 93), `einladungen.js` (Z. 135, 156),
`material.js` (Z. 863) und `bookingUtils.js` (Z. 1014).
`ParticipantManagementModal` las `response.data.error` sogar direkt. Ein Test
mit dem echten `AppContext` zeigte den Namen in der Nutzlast an Umami (vor
dem Fix 14 von 18 Tests rot).

Wie:

- **Positivliste.** `stelle` ist nur noch der angezeigte Text, wenn er in
  `utils/bekannteFehlertexte.ts` steht — 203 feste Texte der App und 19
  Server-Texte (siehe unten). Verglichen wird exakt, nach der Entschärfung;
  gesendet wird immer ein Element von `ERLAUBTE_STELLEN` (`analytics.ts`),
  also ein Literal aus dem Quelltext. `trackFehler` prüft noch einmal (zweite
  Sperre).
- **Das WO bleibt.** Von 80 Aufrufen `setError(fehlerText(err, 'Ersatz'))`
  geben 78 weder `ort` noch Fehlerobjekt mit (gezählt am 27.09.2026) — mit
  einem bloßen Platzhalter wäre dort nicht mehr zu sehen, wo es klemmt.
  Deshalb merkt sich `fehlerText` für zehn Sekunden, welcher Ersatztext zu einem gelieferten
  Server-Text gehörte (`herkunftDesFehlertexts`, nur im Speicher, höchstens
  zehn Einträge, einmal abrufbar). Die Messung meldet dann den Ersatztext der
  Aufrufstelle und die Art aus der Antwort (`http-409` …). Nur wo es keinen
  gibt, steht `andere-meldung`. Die drei Stellen, die `response.data.error`
  direkt lasen (`ParticipantManagementModal`, `AdminWrappedPage`,
  `EventModal`), gehen jetzt über `fehlerText`; angezeigt wird dasselbe.
- **Server-Texte im Wortlaut** nur für die An- und Abmeldung bei Events: 19
  Texte, die in `backend/utils/bookingUtils.js` wörtlich als Literal stehen
  („Anmeldung bereits geschlossen", „Das Event ist leider bereits
  ausgebucht", „Abmeldung ist nur bis 2 Tage vor dem Event möglich" …).
  Dort stehen hinter `http-400` ein Dutzend Gründe, und genau die beantworten,
  warum Konfis sich nicht anmelden können. Der Text mit dem Namen des
  Konfirmationstermins ist nicht dabei. Weitere Server-Texte nicht: Die
  meisten sagen nicht mehr als der Status, und jeder Eintrag müsste dem
  Backend folgen.
- **Nicht veraltet.** `bekannteFehlertexte.test.ts` liest den Quelltext
  (`setError`, `fehlerText`, `fehlerTextOderMessage`, `onError`) und schlägt
  an, wenn ein fester Text fehlt oder ein Eintrag nicht mehr vorkommt; die
  Server-Texte prüft er gegen `bookingUtils.js`.
- **Absturzprotokoll.** Die Wegmarke (`wegmarke`, Firebase Crashlytics, nur
  iOS und Android, steht im nächsten Absturz- oder Fehlerbericht) trägt
  denselben Wert.
- **Altbestand.** Bereinigung der Umami-Datenbank:
  [docs/auftraege/lokaler-agent/03-nach-dem-deploy.md](../auftraege/lokaler-agent/03-nach-dem-deploy.md),
  Abschnitt 6. Store-Fassungen ohne diese Korrektur schicken bis zu ihrem
  Update weiter den vollen Text — die Bereinigung ist deshalb zu wiederholen.
  **Bereinigt am 01.10.2026:** 31 Einträge mit 14 verschiedenen Werten
  (11.08.–28.09.2026) durch `andere-meldung` ersetzt, danach 0; die Zahl der
  `stelle`-Einträge blieb 160. Seit dem Deploy von 2.3.0 kam kein Wert
  außerhalb der Liste an. Sicherung mit den Namen nach der Prüfung gelöscht.
  Absturzberichte in Crashlytics noch nicht geprüft (Konsole, bei Simon).

Tests: `fehlerMessungOhneNamen.test.tsx` (echte Nutzlast an Umami und
Wegmarke: verboten — die fünf Texte der vier Fundstellen, direkt und über
`fehlerText`, Name an bekanntem Text, zweite Sperre; erlaubt — Text der App
mit Ziffer, Offline-Meldung, mit Ort und Art, Ersatztext, zugelassener
Server-Text), `bekannteFehlertexte.test.ts`, `fehler.test.ts`.

### B2 — `bereich` hat keine Formprüfung

`MainTabs.tsx` nimmt den zweiten Pfadteil ungeprüft. Alle heutigen Routen
haben dort einen festen Namen; ein unbekannter Pfad aus einem alten Link
(etwa `/konfi/42`) würde aber für einen Moment gemessen, bevor die Umleitung
greift — mit der Zahl als Bereich. **Vorschlag:** dieselbe Formregel wie bei
`ort` (nur Kleinbuchstaben und Bindestriche). Aufwand klein.

**Behoben am 27.09.2026** zusammen mit B3: `bereichAusPfad` in
`analytics.ts` lässt nur Kleinbuchstaben und Bindestriche durch; alles andere
wird nicht gemeldet.

### B3 — Der Material-Reiter des Teams zählt als `profile`

Seit dem 04.09.2026 ist Material ein eigener Reiter des Teams mit der Adresse
`/teamer/profile/material`. Die Bereichsmessung nimmt den zweiten Pfadteil —
`profile`. Material-Aufrufe des Teams sind deshalb von Profil-Aufrufen nicht
zu trennen; dasselbe gilt für `/teamer/profile/badges`. Unter `material`
zählt nur noch die Altroute. **Vorschlag:** Unterseiten des Team-Profils unter
ihrem eigenen Namen zählen. Aufwand klein. Gehört zu U2.

**Behoben am 27.09.2026:** Unterseiten des Profils zählen unter ihrem eigenen
Namen (`material`, `badges`, `konfi-stats`). Die Zahlen des Team-Bereichs
`profile` sinken dadurch ab diesem Stand — das ist die Korrektur, kein
Rückgang.

### B4 — Wie lange eine Umami-Sitzung lebt, ist ungeklärt

`analytics.ts` schreibt von einem „täglich wechselnden Hash". Im aktuellen
Umami-Quelltext (`src/app/api/send/route.ts`, `src/lib/crypto.ts`) wechselt das
Salz der Sitzung dagegen standardmäßig **monatlich** (Umgebungsvariable
`SALT_ROTATION`, Vorgabe `month`, möglich sind `day` und `week`); Stadt und
Region werden aus einer GeoLite2-City-Datenbank abgeleitet und zur Sitzung
gespeichert. Die Datenschutzerklärung nennt nur das „Herkunftsland".
**Vorschlag:** am Server nachsehen, welche Umami-Fassung läuft und ob
`SALT_ROTATION` gesetzt ist. Bei monatlichem Wechsel `SALT_ROTATION=day`
setzen (falls die Fassung es kennt) oder Kommentar und Datenschutzerklärung
richtigstellen. Das entscheidet mit, wie viel ein einzelnes Merkmal verraten
darf — je länger die Sitzung, desto mehr hängt an einem Wiedererkennen.

Am Umami-Quelltext nachgesehen am 27.09.2026 (Hauptzweig, Fassung 3.4.0):
`SALT_ROTATION` mit Vorgabe `month` in `src/app/api/send/route.ts`,
`getSalt` in `src/lib/crypto.ts` kennt `day`, `week` und sonst Monat; die
Tabelle `session` hat die Spalten `country`, `region` und `city`. Welche
Fassung auf dem Server läuft, ist damit nicht geklärt. Der Auftrag dafür
steht in
[docs/auftraege/lokaler-agent/03-nach-dem-deploy.md](../auftraege/lokaler-agent/03-nach-dem-deploy.md),
Abschnitt 6.

**Am Server gemessen am 01.10.2026:** Es läuft Umami 3.4.0; die Fassung kennt
`SALT_ROTATION`, gesetzt ist es nicht — das Salz wechselt also monatlich.
Von 3.185 Sitzungen der App (seit 11.08.2026) tragen 3.113 eine Region
(97,7 %) und 3.011 eine Stadt (94,5 %). Kommentar in `analytics.ts` und
Datenschutzerklärung (9a) stimmen damit nicht; ob `SALT_ROTATION=day` und
weniger Ortsangaben oder eine richtiggestellte Erklärung, entscheidet Simon.

## Von Simon beauftragt (27.09.2026)

### U1 — Anträge entschieden

- **Frage:** Wie viele eingereichte Aktivitäten werden angenommen, wie viele
  abgelehnt — getrennt nach Konfis und Team?
- **Ereignis:** `antrag-entschieden`, über `trackHandlung`.
- **Merkmale:** `entscheidung`: `angenommen` \| `abgelehnt`; `antrag_von`:
  `konfi` \| `teamer` (aus der Zielgruppe der Aktivität, `activity_target_role`).
- **Stelle:** `admin/modals/ActivityRequestModal.tsx` nach erfolgreichem
  `PUT /admin/activities/requests/:id` — die einzige Stelle, an der die Leitung
  entscheidet. Offline eingereihte Entscheidungen zählen nicht (Grundsatz).
- **Nicht dabei:** Ablehnungsgrund, Aktivität, Punktzahl, Konfi.
- **Datenschutz:** zwei Merkmale mit je zwei Werten, Rolle ist immer die
  Leitung. Wer eine Entscheidung wiedererkennen wollte, bräuchte den Antrag
  selbst — und der steht ohnehin in der Datenbank der App.
- **Einreichen:** braucht nichts Neues. `aktivitaet-eingereicht` trägt über
  `track` die Rolle mit; Konfi und Team sind darüber schon getrennt.
- **Aufwand:** klein.
- **Status:** umgesetzt am 27.09.2026. Tests:
  `messungAntragEntschieden.test.tsx` (gerendert: erst nach der Antwort,
  nichts bei Fehler, nichts offline), `messungAntragMaterialSpruch.test.ts`
  (Nutzlast, Positivliste, Aufrufstelle).

### U2 — Material angesehen und abgerufen

- **Frage:** Wird hinterlegtes Material genutzt — angesehen, und werden Dateien
  und Links daraus geöffnet?
- **Ereignisse** (zwei, damit ein Ziel in Umami jeweils eine klare Zahl zählt):
  - `material-angesehen` — Detailansicht geöffnet, **einmal je Öffnen**, erst
    nach der erfolgreichen Antwort (kein erneutes Melden beim Aktualisieren
    oder Neuzeichnen). Merkmal `inhalt`: `datei` \| `link` \| `beides` \|
    `nur-text` — dieselben Werte wie `material-bereitgestellt`, damit sich
    Bereitgestelltes und Angesehenes nebeneinanderlegen lassen.
  - `material-abgerufen` — eine Datei (nach erfolgreichem Laden) oder ein Link
    daraus geöffnet. Merkmal `inhalt`: `datei` \| `link`.
- **Stellen:** `teamer/pages/TeamerMaterialPage.tsx` (Liste und Detail im
  Material-Reiter) und `teamer/pages/TeamerMaterialDetailPage.tsx` (Material
  an einem Event, für Team und Leitung).
- **Nicht dabei:** Titel, Kennung, Dateiname, Dateityp, Adresse des Links,
  Anzahl der Dateien. Die Material-Verwaltung der Leitung
  (`admin/pages/AdminMaterialPage.tsx` mit `MaterialFormModal`) zählt nicht:
  Dort legt die Leitung an und bearbeitet. Material, das an einem Event hängt,
  zählt dagegen auch für die Leitung (`TeamerMaterialDetailPage`). Siehe S17.
- **Dazu:** B3 beheben, sonst bleibt der Bereich `material` des Teams leer.
- **Datenschutz:** feste Werte, Rolle Team oder Leitung. Ob jemand ein
  bestimmtes Material geöffnet hat, lässt sich ohne Titel und Kennung nicht
  sagen.
- **Aufwand:** klein.
- **Status:** umgesetzt am 27.09.2026, B3 behoben. Tests:
  `messungMaterialAbruf.test.tsx` (gerendert, beide Seiten: einmal je Öffnen,
  nicht beim erneuten Laden, nicht nur aus dem Zwischenspeicher, nichts bei
  Fehler), `messungAntragMaterialSpruch.test.ts`.

### U3 — Konfispruch gespeichert

- **Frage:** Wählen Konfis (und Teamer:innen, die dieselbe Auswahl haben) einen
  Spruch aus den Vorschlägen oder einen eigenen, und in welcher Übersetzung?
- **Ereignis:** `konfispruch-gespeichert` (nicht „gewählt": Umlaut-Umschreibung,
  siehe Grundsätze), nach erfolgreichem `PATCH /konfi/profile` bzw.
  `/teamer/profile`. Unverändert erneut gespeichert zählt nicht.
- **Merkmale:** `quelle`: `vorschlag` \| `eigen`; `bibel` (nur bei
  `vorschlag`): `luther` \| `gute-nachricht` \| `bigs` \| `elberfelder` —
  die vier Übersetzungen, die die Auswahl anbietet, als Positivliste.
- **Stelle:** `konfi/modals/KonfispruchSelectModal.tsx` (Konfi-Startseite und
  Team-Startseite).
- **Nicht dabei:** die Bibelstelle (siehe S1), der Text, bei eigenen Sprüchen
  weder Text noch Stellenangabe.
- **Datenschutz:** zwei plus vier Werte; Texte gibt es heute nur für Luther und
  Gute Nachricht. Daran erkennt man niemanden.
- **Aufwand:** klein.
- **Status:** umgesetzt am 27.09.2026, ohne Bibelstelle. Tests:
  `messungKonfispruch.test.tsx` (gerendert: erst nach der Antwort, nichts bei
  Fehler, nichts bei unverändertem Speichern, Konfi und Team),
  `messungAntragMaterialSpruch.test.ts`. Den geänderten eigenen Spruch prüft
  nur der Quelltext-Test: Texteingaben erreichen React in jsdom nicht.

## Vorschläge — Simon entscheidet

Aufwand: **klein** = eine Aufrufstelle und Tests, **mittel** = mehrere
Stellen oder eine Positivliste, die einer Server-Liste folgen muss.

### S1 — Bibelstelle des Konfispruchs: nicht in Umami (Frage an Simon)

- **Frage:** Welche Sprüche werden gewählt?
- **Warum nicht in Umami:** Ein Konfirmationsspruch ist öffentlich — er wird
  im Gottesdienst verlesen, steht auf der Urkunde und oft mit Namen im
  Gemeindebrief. 32 Stellen sind genug Auswahl, um in einer kleinen Gemeinde
  zusammen mit Rolle, Stadt (Umami, siehe B4) und Tag eine bestimmte Konfi
  wiederzuerkennen. Dann ist nicht nur dieses Ereignis ihr zuzuordnen, sondern
  die ganze Sitzung — welche Bereiche, welche Fehler, wie lange. Dazu kommt:
  Der gewählte Vers ist Ausdruck religiöser Überzeugung, also eine besondere
  Kategorie personenbezogener Daten; bei Minderjährigen erst recht nicht in
  einer Reichweitenmessung. Eine Positivliste hilft hier nicht — sie verhindert
  Freitext, nicht das Wiedererkennen. Die Liste steht außerdem nicht fest in
  der App, sondern in der Datenbank (`konfsprueche`, Migration 093, auch mit
  Einträgen je Gemeinde möglich).
- **Besser:** Die Frage beantwortet die Datenbank schon heute, und zwar
  vollständig (Bestand statt nur neue Wahl): `konfi_profiles.konfspruch_id`,
  `konfspruch_translation`, `konfspruch_freitext`. Eine Auswertung über
  **alle** Gemeinden, je Spruch erst ab fünf Nennungen angezeigt, gehört in
  die Betreiber-Kennzahlen (`/admin/metrics`), nicht nach Umami.
- **Frage an Simon:** Reicht diese Auswertung aus der Datenbank? Oder soll die
  Stelle trotz der Bedenken nach Umami — dann nur mit Positivliste aus den 32
  festen Stellen und nach Klärung von B4?
- **Aufwand:** Auswertung mittel (Route, Kennzahlen-Seite, Tests).

### S2 — Anträge-Ansicht der Leitung

- **Frage:** Wie oft schaut die Leitung unter „Mitmachen" in die
  Aktivitäten, also die eingereichten Anträge?
- **Ereignis:** `bereich-geoeffnet` mit `bereich: requests` beim Umschalten der
  Leiste und beim Einstieg mit `?segment=antraege` (`AdminEventsPage.tsx`),
  wie bei Konfi und Team.
- **Datenschutz:** nur ein Bereichsname. **Aufwand:** klein.

### S3 — Anmeldung des Teams zu Events

- **Frage:** Meldet sich das Team über die App zu Events an?
- **Ereignis:** `event-angemeldet` auch aus `TeamerEventsPage.tsx`, dieselben
  Merkmale wie bei Konfis.
- **Datenschutz:** wie bei Konfis. **Aufwand:** klein.

### S4 — Abmeldung von Events

- **Frage:** Wie oft wird abgesagt, und betrifft es Pflicht-Events?
- **Ereignis:** `event-abgemeldet`, Merkmal `pflicht`: `true` \| `false`.
  Kein Grund, kein Event.
- **Datenschutz:** unbedenklich. **Aufwand:** klein (Konfi und Team).

### S5 — Badges angelegt

- **Frage:** Pflegen Gemeinden eigene Badges?
- **Ereignis:** `trackHandlung('badge-angelegt')`, Merkmal `zielgruppe`:
  `konfi` \| `teamer`. Kein Name, keine Bedingung.
- **Datenschutz:** unbedenklich. **Aufwand:** klein (`BadgeManagementModal.tsx`).

### S6 — Challenges angelegt

- **Frage:** Welche Challenge-Formen nutzen Gemeinden (Sichtbarkeit, mit
  Freigabe)?
- **Ereignis:** `trackHandlung('challenge-angelegt')`, Merkmale `sichtbarkeit`
  (feste Werte der App) und `freigabe`: `true` \| `false`. Kein Titel.
- **Datenschutz:** unbedenklich. **Aufwand:** klein (`ChallengeManageModal.tsx`).
- Stempel brauchen nichts Eigenes: Sie hängen am Beitrag, der schon als
  `challenge-beitrag` zählt.

### S7 — Jahresrückblick angesehen

- **Frage:** Wird der Rückblick angesehen und bis zum Ende durchgeblättert?
- **Ereignis:** `wrapped-angesehen`, Merkmale `art`: `konfi` \| `team` und
  `bis_ende`: `true` \| `false` — gemeldet im Rückblick selbst (`WrappedModal`),
  nicht an den sechs Stellen, die ihn öffnen.
- **Datenschutz:** unbedenklich. **Aufwand:** klein bis mittel.
- `analytics.ts` schließt den Rückblick bewusst aus den **Handlungen** aus
  („angesehen ist keine Arbeit"); als eigenes Ereignis widerspricht das dem
  nicht.

### S8 — Postfach

- **Frage:** Wird die Glocke genutzt, welche Mitteilungen werden angetippt?
- **Ereignisse:** `postfach-geoeffnet`; `mitteilung-geoeffnet` mit Merkmal
  `art` aus einer Positivliste der Mitteilungsarten.
- **Datenschutz:** unbedenklich, solange nur die Art geht (kein Inhalt, kein
  Event, kein Name). **Aufwand:** mittel — die Positivliste muss den
  Mitteilungsarten des Servers folgen; das Postfach wird gerade parallel
  überarbeitet.

### S9 — Push-Auswahl

- **Frage:** Welche Mitteilungen schalten Leute ab, und wie viele erlauben Push
  überhaupt?
- **Ereignisse:** `push-gruppe-umgeschaltet` mit `gruppe` (die vier Gruppen des
  Servers) und `an`: `true` \| `false`; `push-erlaubnis` mit `ergebnis`:
  `erteilt` \| `abgelehnt`.
- **Datenschutz:** unbedenklich. **Aufwand:** klein (`PushAuswahl.tsx`, eine
  gemeinsame Komponente für alle Rollen).

### S10 — Einladungen

- **Frage:** Wird die Einladung in eine Gemeinde genutzt, und wird sie
  angenommen?
- **Ereignisse:** `trackHandlung('einladung-gesendet')` mit `rolle_ziel`
  (Positivliste der festen Rollen); `einladung-beantwortet` mit `antwort`:
  `angenommen` \| `abgelehnt`.
- **Datenschutz:** unbedenklich; nie die Kennung, die eingegeben wurde.
  **Aufwand:** klein.

### S11 — Dunkelmodus (und warum keine Barrierefreiheits-Einstellungen)

- **Frage:** Wie viele nutzen den Dunkelmodus — lohnt die Pflege?
- **Ereignis:** Merkmal `dunkel`: `true` \| `false` am Seitenaufruf zu
  Sitzungsbeginn (`trackSitzungsstart`).
- **Datenschutz:** unbedenklich. **Aufwand:** klein.
- **Nicht empfohlen:** „Bewegung reduzieren", große Schrift, erhöhter Kontrast.
  Solche Einstellungen können auf eine Beeinträchtigung hindeuten
  (Gesundheitsdaten), und in einer kleinen Gemeinde ist „die Konfi mit
  reduzierter Bewegung" schnell eine Person. Die Schriftgröße liest die App
  zudem gar nicht aus.

### S12 — Übersetzung der Tageslosung

- **Frage:** Welche Übersetzung wird für die Tageslosung eingestellt?
- **Ereignis:** `losung-bibel` mit `bibel` aus der festen Liste
  (`BibleTranslationModal.tsx`).
- **Datenschutz:** unbedenklich (sechs Werte). **Aufwand:** klein.

### S13 — Scrolltiefe der Team-Startseite

- **Frage:** Sieht das Team die unteren Abschnitte seiner Startseite?
- **Ereignis:** `dashboard-gescrollt` auch aus `TeamerDashboardPage.tsx`.
- **Datenschutz:** wie bei Konfis. **Aufwand:** klein.

### S14 — Offline Erledigtes nachzählen

- **Frage:** Wie viel Arbeit geschieht ohne Netz?
- **Vorschlag:** Die Warteschlange (`services/writeQueue.ts`) meldet beim
  erfolgreichen Nachsenden die passende Handlung — über eine feste Zuordnung
  der Einträge, nicht über deren Beschriftung.
- **Datenschutz:** unbedenklich. **Aufwand:** mittel.

### S15 — Suche genutzt

- **Frage:** Brauchen Leute die Suche (Material, Konfis)?
- **Ereignis:** `suche-genutzt` mit `bereich`, einmal je Öffnen der Seite.
  **Nie der Suchbegriff.**
- **Datenschutz:** unbedenklich, solange der Begriff draußen bleibt.
  **Aufwand:** klein.

### S16 — Übersicht „Was ist neu?"

- **Frage:** Wird die Übersicht nach dem Update gelesen?
- **Ereignis:** `neuigkeiten-angesehen` mit `bis_ende`: `true` \| `false`.
- **Datenschutz:** unbedenklich. **Aufwand:** klein.

### S17 — Lese-Ansicht der Material-Verwaltung

- **Frage:** Sieht sich die Leitung Material von Kolleg:innen an?
- **Ereignis:** `material-angesehen` (und `material-abgerufen` für Dateien)
  auch aus der Material-Verwaltung — aber nur in der Lese-Ansicht
  (`nurLesen`: Material, das die Person nicht bearbeiten darf). Das eigene
  Material zu öffnen, um es zu bearbeiten, ist kein Abruf.
- **Datenschutz:** wie U2. **Aufwand:** klein bis mittel (die Datei-Öffnung
  im Formular hat zwei Wege, nativ und Rückfall).

### Bewusst nicht

- **Chat** — keine Zahlen zu Nachrichten, Räumen, Umfragen oder Dateien
  (Begründung in `analytics.ts`). Der Bereich `chat` zählt ohnehin.
- **Punkte, Level, Badges, Ranglisten als Stände oder Zahlen** — jede Zahl ist
  in einer kleinen Gemeinde ein Fingerabdruck.
- **Jahrgang, Gemeinde, Namen von Events oder Aktivitäten, Suchbegriffe,
  Begründungen** — nie, auch nicht gekürzt.

## Ziele in Umami

Neue Ereignisse erscheinen in Umami unter „Ereignisse", sobald das erste
ankommt. Damit sie im Ziel-Bericht neben den bisherigen stehen, legt Simon je
Ereignisname ein Ziel vom Typ **Ereignis** an. Ein Ziel zählt den
Ereignisnamen; die Aufteilung nach einem Merkmal (etwa `entscheidung:
abgelehnt`) steht in der Auswertung der Ereignis-Eigenschaften.

Für die beauftragten Messpunkte (U1–U3):

| Ziel (Ereignisname) | Aufteilen nach |
|---|---|
| `antrag-entschieden` | `entscheidung`, `antrag_von` |
| `material-angesehen` | `inhalt`, `rolle` |
| `material-abgerufen` | `inhalt`, `rolle` |
| `konfispruch-gespeichert` | `quelle`, `bibel`, `rolle` |

Die neuen Ereignisse kommen erst mit der nächsten ausgelieferten Fassung an
(Web nach dem Deploy, iOS und Android mit dem nächsten Store-Build). Ältere
App-Fassungen melden sie nie; bis alle umgestiegen sind, sind die Zahlen
Untergrenzen.

Ein bestehendes Ziel auf `bereich-geoeffnet` mit `bereich: material` zählt ab
dieser Fassung auch den Material-Reiter des Teams (B3).
