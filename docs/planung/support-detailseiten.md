# Support-Detailseiten: Vorgang, Anfrage und Mail übersichtlich

Stand: 11.10.2026, **Entwurf, wartet auf Simons Antworten** (unten). Baut
auf [support-vorgaenge.md](support-vorgaenge.md) (Entscheidung 7),
[support-web.md](support-web.md) und
[web-alle-bereiche.md](web-alle-bereiche.md) (Entscheidung 5) auf.

Gemessen am 11.10.2026 gegen lokale Testdaten: drei Vorgänge (eine Anfrage,
ein Anliegen aus dem Formular, ein reiner Mail-Vorgang) und 13 Mails, im
Browser bei 1440×900 und 1280×800, am Handy bei 390×844, hell und dunkel.
Die Zielwerte sind aus Bausteinhöhen **geschätzt**; nach jedem Paket wird
mit demselben Skript gegen dieselben Daten nachgemessen und mit Zahl
gemeldet.

## Anlass

> „Support Details Seiten zu einem Vorgang einem Antrag einer Anfrage müssen
> wir optimieren auf App und Desktop. Bitte mach einen Entwurf. Die Details
> Seite im Main Konfi Quest Web können Struktur geben. Aber es muss
> übersichtlicher werden." (Simon, 11.10.2026)

> „Die gesamte Support-Ansicht ist auf dem Handy mega unübersichtlich, im Web
> auch … Vieles ist aber schon sehr gut." (Simon, 10.10.2026)

**Was gut ist und bleibt:** Liste links, Lesebereich rechts wie ein
Mailprogramm; die Dialoge „Einordnen" und „Mail einsortieren";
Gespräche über die Kopfzeilen der Mails; Gelesen-Meldung beim Öffnen und
Aktuell-Bleiben nach jeder Änderung; die gemeinsamen Hooks für App und
Browser.

**Was die Messung zeigt:**

- **Die Mail, auf die man antwortet, liegt unten.** Weg bis zur jüngsten
  Mail im Anliegen (Vorgang 2): 513 px (1440), 656 px (1280), 551 px
  (Handy); aufgeklappt 1772 bzw. 2178 px.
- **Antworten im Browser springt.** Der Knopf steht oben, das Formular
  erscheint unter dem Verlauf. Der Lesebereich springt um 1280 px, das
  Formular ist mit 837 px höher als der sichtbare Lesebereich (656 px).
  Beantwortete Mail und „Antwort senden" sind nie zugleich zu sehen.
- **Die interne Notiz ist versteckt.** Im Browser im zugeklappten Bereich
  ganz unten (2363 px nach dem Aufklappen), am Handy nach dem ganzen Verlauf
  (1531 bzw. 2884 px).
- **Die Anfrage einer neuen Gemeinde ist am längsten:** 4001 px am Handy.
  Das Formular „Gemeinde anlegen" (≈ 1180 px im Browser, ≈ 1390 px am Handy)
  steht mitten im Verlauf, vor den Angaben, die man dafür liest. Darüber
  warnt ein gelber Kasten „Noch keiner Gemeinde zugeordnet", obwohl die
  Gemeinde erst angelegt werden muss.
- **Viele Wiederholungen.** Im Anliegen steht „Test Org-Admin 1" 6-mal im
  Lesebereich, bei der Anfrage der Gemeindename 5-mal, am Handy die
  Kontaktperson 6-mal.
- **Darstellungsfehler:** siehe [Fehler vorab](#fehler-vorab).

**Die Wörter.** *Vorgang* ist jedes Support-Anliegen mit Nummer. *Anfrage*
ist der Vorgang der Art „Neue Gemeinde" aus dem Formular der Homepage. Einen
*Antrag* gibt es im Support nicht; gelesen ist er hier als das Anliegen aus
dem Support-Formular (Frage 1). Der Entwurf deckt damit alle
Detailansichten des Supports ab: Vorgang (aus Formular, Mail oder vom
Support angelegt), Vorgang einer Anfrage, Mail im Posteingang und Mail, die
schon in einem Vorgang liegt.

## Leitidee

1. **Das Gerüst des Hauptwebs gilt auch im Support**, in der Reihenfolge von
   `WebDetailSeite`: Kopf (Kreis, Titel, Kennzeichen, rechts **alle**
   Aktionen, die wichtigste rechts außen — Simon, 06.10.), Hinweis,
   Kennzahlen wenn Platz ist, Hauptteil (Verlauf und Antwort), Angaben als
   Karten mit Symbolen (Simon, 07.10.). Im Lesebereich neben der Liste und
   in der breiten Fassung ohne Liste ist es dieselbe Komponente; die Spalten
   richten sich nach der Breite des Lesebereichs, nicht der Seite.
2. **Der Stand steht zuerst.** Ein Satz sagt, wer dran ist und seit wann
   („Test Org-Admin 1 wartet seit heute, 12:23 auf Antwort."). Der
   Hauptknopf folgt diesem Stand: Antworten, Erledigt, Gemeinde anlegen,
   Wiederherstellen oder Einsortieren.
3. **Das Neueste steht ohne Scrollen im Bild.** Der Verlauf ist flach und
   zeitlich geordnet, Gelesenes gefaltet, die jüngste Mail offen, die Antwort
   direkt darunter.
4. **Jede Angabe steht einmal und offen.** Kein Akkordeon mehr, die Notiz
   oben. Ein Gemeindename aus dem Formular erscheint nie als zugeordnete
   Gemeinde.
5. **Formulare sind Dialoge bzw. Modale:** Gemeinde anlegen, Einordnen,
   Einsortieren, am Handy auch Antworten und Notiz. Einordnen hat eine
   Bedienweise: Speichern.
6. **Die App zeigt dieselbe Reihenfolge nach App-Muster:** Kopfzeile mit
   Symbolknöpfen, farbiger Kopf mit drei Zahlen-Kacheln, Karte „Stand" mit
   dem Hauptknopf, Abschnitte, Löschen als einziger Knopf ganz unten.
7. **Eine Regel-Stelle.** Stand, Kennzahlen, Angaben, Verlauf, Betreff und
   Empfänger-Etiketten werden reine Funktionen, die Texte stehen in einer
   `seiten`-Datei. App und Browser zeigen nur an.

Für den Kern ist **keine Änderung an Backend oder API** nötig. Was optional
dazukäme, ist additiv und gekennzeichnet.

## Die gemeinsame Regel-Stelle

| Was | Wo | Inhalt |
|---|---|---|
| `vorgangStand(v, { anlegbar, jetzt })` | `utils/supportVorgaenge.ts` | `{ ton, marken, satz, haupt, neben[] }` nach der Stand-Regel unten |
| `mailStand(mail)` | `utils/supportMail.ts` | Posteingang: Haupt Einsortieren; Archiv-Satz |
| `vorgangKennzahlen(v)`, `mailKennzahlen(m)` | dieselben | drei Zahlen, gleich für App-Kacheln und `WebKachel` |
| `vorgangAngaben(v)` | `utils/supportVorgaenge.ts` | Zeilen für Kontakt, Gemeinde, Anfrage ohne Doppelungen; App als `Angabe`, Web als `WebAngaben` |
| `istZugeordnet(v)` | `utils/supportVorgaenge.ts` | `organization_id !== null`, nie `gemeinde_name` |
| `verlaufReihe(mails, anfang, neu)` | `utils/mailGespraeche.ts` | flacher Verlauf: offen, zu, Stapel, „Antwort auf …" |
| `betreffKern` (berichtigt), `standardBetreff` | `utils/mailGespraeche.ts`, `utils/supportMail.ts` | siehe [Fehler vorab](#fehler-vorab) |
| `empfaengerEtikett(herkunft)` | `utils/supportMail.ts` | absender → „schrieb uns", kontakt → „Kontakt aus dem Formular", anfrage → „aus der Anfrage", leitung → „Gemeindeleitung", verlauf → „aus früheren Mails" |
| `ART_SYMBOL` | `utils/supportVorgaenge.ts` | Kreis vor dem Titel und in der Listenzeile |
| Texte | neu `seiten/supportDetail.ts` | Stand-Sätze, Hinweise, Rückfragen (Löschen und Ablehnen je **ein** Text) |

**Hooks.**

- `useVorgangDetail` liefert zusätzlich `stand`, `statusSetzen(status)`,
  `ablehnen()` und die Empfänger aus dem Feld `empfaenger` der
  Detail-Antwort, statt sie getrennt über `/support/gemeinden/:id/empfaenger`
  zu holen. Der Server liefert sie schon, zusammen mit den Absendern
  eingehender Mails, die heute fehlen.
- `usePostDetail` liefert `stand`, das fertige Antwort-Objekt (heute baut
  jede Seite es selbst) und das Ziel einer Weiterleitung.
- Neu `useEinordnenFormular` für App und Web: gleiches Speichern, gleiche
  Prüfung des Pflicht-Bereichs.
- Der Leser `vorgangDetailLesen` nimmt `status_seit` und
  `erstellt_von_name` auf (beides liefert der Server schon).

**Die Stand-Regel**, in dieser Reihenfolge geprüft. „Von außen" heißt: das
Formular, die Anfrage oder eine eingehende Mail. Die automatische
Bestätigung (ausgehend, `verfasst_von` leer) zählt nicht als Antwort.

| # | Fall | Satz (Ton) | Haupt | Neben |
|---|---|---|---|---|
| 1a | Anfrage angelegt | „Gemeinde angelegt am …. Benutzername der Gemeindeleitung: … – Benutzername und Passwort getrennt weitergeben." (Erfolg) | Gemeinde öffnen | – |
| 1b | Anfrage abgelehnt (Archiv) | „Anfrage abgelehnt am …. Sie wird nach 180 Tagen gelöscht; Wiederherstellen holt sie zurück." (Hinweis) | Wiederherstellen | Gemeinde anlegen |
| 1c | sonst erledigt oder archiviert | „Erledigt am …" bzw. „Im Archiv seit …" und „Eine neue Mail holt ihn zurück." (Hinweis) | Wiederherstellen | – |
| 2 | kein Antwortweg | „Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt. Laut Formular: X." (Warnung) | Gemeinde zuordnen (öffnet Einordnen) | – |
| 3 | jüngste Nachricht von außen | „{Name} wartet seit {Zeit} auf Antwort." (Warnung) | Antworten | bei Anfrage Gemeinde anlegen und Ablehnen, sonst Erledigt |
| 4 | Anfrage anlegbar, Support schrieb zuletzt | „Support hat {Zeit} geantwortet. Anlegen oder ablehnen?" (Hinweis) | Gemeinde anlegen | Ablehnen, Antworten |
| 5 | Status Wartet | „Wartet seit {status_seit} auf {Name}." Ab 7 Tagen: „… – nachfassen?" (neutral) | Erledigt; ab 7 Tagen Antworten | Antworten bzw. Erledigt |
| 6 | sonst | „Support ({Konto}) hat {Zeit} geantwortet." (neutral) | Erledigt | Antworten |

Zu 1a: Den Benutzernamen gibt es künftig auch nach dem Neuladen, aus
`leitung[].username`; heute steht er nur direkt nach dem Anlegen da. Der
Satz nennt nur Tatsachen und gibt keinen Befehl. Antworten und Einordnen
sind immer erreichbar.

## Im Browser

Legende der Skizzen: `[[Knopf]]` Hauptknopf (genau einer, rechts außen,
wechselt mit dem Stand), `[Knopf]` Knopf mit Text, `(L)(A)(E)` Symbolknöpfe
mit aria-label und Tooltip (Löschen, Archivieren, Einordnen), `{Marke}`
Pill, `>` zu, `v` offen. Die y-Werte sind Zielwerte im Lesebereich.

### Rahmen und Maße

| Fenster | Liste | Lesebereich | Spalten im Lesebereich |
|---|---|---|---|
| 1440×900 | 380 px | 740 × 656 px | eine; Angaben unter dem Verlauf, ab 640 px zwei Karten nebeneinander |
| 1280×800 | 380 px | 580 × 556 px | eine; Karten untereinander |
| „Breit lesen" 1440 | aus | 1136 px | zwei: Haupt 1fr, Angaben 400 px |
| „Breit lesen" 1280 | aus | 976 px | zwei |

- `.web-postfach__lesen` bekommt `container-type: inline-size`
  (`theme/web/support.css`). Dann misst `WebSpalten` (ab 960 px
  zweispaltig) den Lesebereich statt `.web-seite`.
- Aus `WebDetailSeite` wird der Rumpf (Hinweis, Kennzahlen, `WebSpalten`)
  als `WebDetailRumpf` herausgelöst. `WebDetailSeite` nutzt ihn selbst
  unverändert, der Lesebereich ebenso; derselbe Code rendert den Rumpf aller
  Detailseiten. `WebDetailSeite` wird im Lesebereich nicht zur Wurzel: eine
  zweite IonPage neben der Liste ergäbe die bekannte weiße Seite, und
  `webDetailSeiteEinGeruest` verbietet das Mischen.
- **Kennzahlen** nur, wenn der Lesebereich zweispaltig ist (ab 960 px).
  Schmaler stehen dieselben Werte in der Kennzeichen-Zeile bzw. im
  Stand-Satz; jede Zahl steht genau einmal.
- **Kopf:** Löschen und Archivieren sind immer Symbole. Unter 760 px
  Lesebreite wird auch Einordnen zum Symbol, unter 600 px trägt nur der
  Hauptknopf Text. Der Titel behält mindestens 220 px und bricht auf
  höchstens zwei Zeilen um, der volle Betreff steht im Tooltip. Reicht das
  nicht, rutscht die Knopfreihe wie heute unter die Kennzeichen (nur die
  Anfrage bei 1280, siehe B).

### A. Vorgang mit Anliegen aus dem Formular (Vorgang 2), Lesebereich 740 px

```
+-- KOPF, klebt (Ziel ~104 px; heute 134, bei 1280 157) -----------------------+
| (Kreis   Konfis sehen den Termin am           (L)(A)(E) [Erledigt]           |
|  Fehler)  Samstag nicht                                   [[Antworten]]      |
|          Nr. 2 · {In Arbeit} {Dringend} · Fehler › Termine ·                 |
|          Test-Gemeinde St. Martin (Link)                                     |
+------------------------------------------------------------------------------+
| STAND (eine Zeile, Ton Warnung)                                      ~40 px  |
|   Test Org-Admin 1 wartet seit heute, 12:23 auf Antwort.                     |
| NOTIZ (höchstens 3 Zeilen, dann „mehr")               [Bearbeiten]   ~56 px  |
|   Vermutlich Zielgruppe „Nur Team" statt „Konfis und Team" …                 |
|                                                                              |
| VERLAUF                               6 Nachrichten, 1 neu · Alle aufklappen |
| | (TO) Test Org-Admin 1 · {Formular}                     09.10., 12:21   > | |
| |      Hallo Support, wir haben für Samstag … (2 Zeilen)     ganz lesen    | |
| | ··· 4 frühere Mails · Support, Test Org-Admin 1 · 2 Anhänge          >   | |
| | (TO) Test Org-Admin 1 {Neu}              an support@ · 12:23   v  (···)  | |  y ~390
| |      Super, danke! 31 von 34 Konfis … Kann ich die Anmeldegrenze …       | |
| |      > Zitat   > Signatur                                                | |
| | Antwort an Test Org-Admin 1 schreiben …                     (zu, 44 px)  | |
|                                                                              |
| +-- Kontakt -----------------------+ +-- Test-Gemeinde St. Martin  Öffnen > -+ |
| | Person  Test Org-Admin 1 (Pastor)| | Laufzeit unbegrenzt · Konfis 3 von 30 | |
| | E-Mail  … · Im Vorgang antworten | | Kreis {Kirchenkreis} › {Landeskirche} | |
| | Eingang Support-Formular         | | Gemeindeleitung (2) · Alle Vorgänge > | |
| +----------------------------------+ +---------------------------------------+ |
+------------------------------------------------------------------------------+
```

- **Kopf** trägt alles zum Wiedererkennen: Art (Kreis), Betreff, Nummer,
  Status, Dringend, Art › Bereich und die Gemeinde. Der Steckbrief entfällt;
  er brach je nach Textlänge ein- oder zweizeilig um. Die Gemeinde steht nur
  da, wenn `organization_id` gesetzt ist; ohne Zuordnung steht
  `{Keine Gemeinde}`, und die Kontakt-Karte zeigt „Nicht zugeordnet – laut
  Formular: X [Zuordnen]". Fehlt der Pflicht-Bereich, erscheint
  `{Bereich fehlt}`; die Marke öffnet Einordnen.
- **Hauptknopf** folgt dem Stand (hier Fall 3: Antworten). Hat der Support
  zuletzt geschrieben, ist es „Erledigt", Antworten wird Nebenknopf.
  Erledigt kostet dann einen Klick statt drei (Einordnen, Status, Speichern).
- **Notiz** oben, beim Öffnen sichtbar, inline bearbeitet; „Speichern"
  erscheint erst nach einer Änderung. Leer steht dort „+ Interne Notiz". Eine
  ungespeicherte Notiz überlebt das Neuladen wie heute.
- **Verlauf** (ein Baustein für App und Web, Regeln in `verlaufReihe`):
  - flach, das Älteste oben, keine Treppe. Antwortet eine Mail nicht auf die
    direkt davor, steht klein „Antwort auf {Name}, {Zeit}" dabei;
  - der Anfang (Formular bzw. Anfrage) ist der erste Eintrag mit der Marke
    `{Formular}` bzw. `{Anfrage}`; offen, solange keine Antwort des Supports
    folgt, danach zwei Zeilen mit „ganz lesen";
  - offen sind die jüngste Nachricht und jede ungelesene, alles andere ist
    eine Zeile in voller Breite;
  - ab drei eingeklappten Mails in Folge ein Stapel „N frühere Mails ·
    Absender · k Anhänge"; Ungelesenes wird nie gestapelt, „Alle aufklappen"
    öffnet auch den Stapel;
  - kein Gesprächstitel im Vorgang: Der Titel ist der Vorgangsbetreff, nicht
    „Euer Anliegen ist angekommen". Weicht der Kern des Betreffs einer Mail
    ab, steht klein „Betreff: …", nie roh „AW: [Vorgang 2] Re: …";
  - ausgehende Mails heißen einheitlich „Support" mit dem grünen Kreis KQ,
    dazu klein „· {Konto}"; ohne Konto (automatische Bestätigung) nur
    „Support". Heute stehen „Konfi Quest Support" und „Test Super-Admin"
    nebeneinander;
  - Menü (···) an jeder offenen Mail im Vorgang, nur mit Routen, die es
    gibt: „In anderen Vorgang verschieben" (Einsortieren-Dialog, die Mail
    geht allein), „In neuen Vorgang herauslösen" (dieselbe Route mit `neu`,
    heute fehlt das ganz), „Kopfzeilen zeigen". Löschen und Archivieren einer
    einzelnen Mail im Vorgang gibt es nicht; der Server lehnt beides mit 409
    ab.
- **Antwortzeile** unter der jüngsten Mail: der Editor im zugeklappten
  Zustand. Ein Klick darauf oder auf „Antworten" im Kopf öffnet ihn (G).
  Ohne Antwortweg ist sie gesperrt und verweist auf den Stand.
- **Angaben** offen als Karten aus `vorgangAngaben`. „Eingang" nennt nur die
  Herkunft; die Zeit steht einmal am Anfang des Verlaufs. Bei Herkunft „vom
  Support angelegt" zusätzlich „Angelegt von {erstellt_von_name}". Laufzeit
  mit Ton (Testphase endet bald = Warnung). Gemeindeleitung je Person: Name,
  `{Gesperrt}`, E-Mail oder „Keine E-Mail", zuletzt angemeldet bzw. noch nicht
  angemeldet. Bei vorhandener Adresse „Im Vorgang antworten": Der Editor
  öffnet sich mit dieser Person als Empfänger, damit die Antwort im Vorgang
  landet; mailto bleibt daneben.

**Ergebnis:** Die jüngste Mail beginnt bei y ≈ 390 (Kopf 104 + Stand 40 +
Notiz 56 + Abstände 36 + Verlaufskopf 32 + Anfang 76 + Stapel 40).
Scrollweg 0 statt 513 px (1440) bzw. 0 statt 656 px (1280, Lesehöhe 556).

### B. Vorgang einer Anfrage (Vorgang 1)

```
| (Kreis   Anfrage: Kirchengemeinde     (L)(E)(Ablehnen) [Gemeinde anlegen]  |
|  Neue     Musterdorf                                     [[Antworten]]      |
|  Gemeinde) Nr. 1 · {In Arbeit} · {Noch nicht angelegt} · 38 Konfis ·        |
|           9 Teamer:innen                                                    |
| STAND  A. Beispiel wartet seit heute, 15:23 auf Antwort.        (Warnung)   |
| + Interne Notiz                                                             |
| VERLAUF                                           3 Nachrichten, 1 neu      |
|   (AB) A. Beispiel · {Anfrage}                     09.10., 10:02   >        |
|   (KQ) Support · Test Super-Admin                  10.10., 09:14   >        |
|   (AB) A. Beispiel {Neu}                                  15:23    v        |
|   Antwort an A. Beispiel schreiben … (von moin@)                            |
| +-- Anfrage --------------------------------+ +-- Kontakt -----------------+ |
| | Gemeinde  Kirchengemeinde Musterdorf      | | Person A. Beispiel         | |
| |           (angefragt)                     | |        (Diakonin)          | |
| | Kreis     {KK} › {Landeskirche}           | | E-Mail … · Im Vorgang      | |
| |           steht in der Struktur / fehlt   | |        antworten           | |
| | Wunsch    Standard, 99 € im Jahr          | | Mobil  … (tel:)            | |
| | Eingang   Anfrage über die Homepage       | +----------------------------+ |
| +-------------------------------------------+                                |
```

- **Entfällt:** der gelbe Kasten „Noch keiner Gemeinde zugeordnet" (bei einer
  Anfrage der Normalfall; die Aufgabe heißt anlegen, Zuordnen zu einer
  bestehenden Gemeinde bleibt über Einordnen möglich), das Gemeinde-Symbol im
  Kopf und die Links auf `?gemeinde=null`, „Verantwortlich" (das ist der
  Kontakt), die doppelten Angaben „Gemeinde" und „Gemeinde laut Anfrage",
  Kirchenkreis und Landeskirche je zweimal.
- **Zahlen:** Konfis und Teamer:innen schmal in der Kennzeichen-Zeile, breit
  als Kennzahlen (Konfis 38 · Teamer:innen 9 · Mails 3).
- **Nach dem Anlegen:** Stand Fall 1a, Hauptknopf „Gemeinde öffnen"; unter
  der Karte „Anfrage" erscheint die Karte der Gemeinde.
- **Ablehnen:** Symbol mit Tooltip „Anfrage ablehnen" und Rückfrage:
  „Anfrage ablehnen? Der Vorgang wird erledigt und archiviert, die Anfrage
  gilt als abgelehnt und wird nach 180 Tagen gelöscht. Eine Absage-Mail geht
  dabei nicht hinaus. Wiederherstellen holt beides zurück." Dahinter steht
  `PATCH {status: 'erledigt'}`, also die bestehende Kopplung im Server. Im
  Code geprüft: Wiederherstellen setzt den Vorgang auf In Arbeit, die Anfrage
  folgt auf in_arbeit, außer sie ist angelegt
  (`backend/utils/supportVorgaenge.js`, `vorgaengeArchivieren` →
  `anfrageFolgtVorgang`). Ablehnen ist damit umkehrbar. Ein abgelehntes
  Anfrage-Formular bleibt anlegbar (`anlegbar` heißt nur „nicht angelegt",
  `useGemeindeAnlegen.ts`); deshalb steht in Fall 1b „Gemeinde anlegen" als
  Nebenaktion.
- **Bei 1280 (580 px):** Haupt plus Symbole lassen dem Titel ≈ 194 px; die
  Knopfreihe rutscht wie heute unter die Kennzeichen. Nach dem Bau messen.

### C. Reiner Mail-Vorgang (Vorgang 3)

Wie A ohne Formular-Anfang; der Kontakt ist der erste Absender, „Eingang:
Mail an support@". Bei drei Mails kein Stapel. Hat der Support zuletzt
geschrieben, ist der Stand neutral („Support (Test Super-Admin) hat heute,
15:23 geantwortet.") und der Hauptknopf „Erledigt". Der Betreff steht im
Lesebereich einmal (heute viermal); keine Karte „Anfrage" und keine
Sammelüberschrift „Gemeinde, Anfrage und Notiz".

### D. Mail im Posteingang (`/admin/support/post/:id`)

```
| (Kreis  Fotos meiner Tochter?            (L)(A) [Antworten] [[Einsortieren]] |
|  AB)    Von A. Beispiel <adresse> · an {support@} · heute, 09:12 · 1 Anhang  |
| VERLAUF                                                                     |
|   (AB) A. Beispiel {Neu}                        an support@ · 09:12    v     |
|        Text der Mail …   Anhang: Einladung.pdf (240 KB)                     |
|   Antwort an A. Beispiel schreiben … („An" fest, von support@)              |
```

- **Hauptknopf ist Einsortieren**, denn der Posteingang ist zum Zuordnen da;
  Antworten steht daneben.
- **Kein Stand-Satz im Normalfall.** Nur im Archiv: „Im Archiv seit … · wird
  nach 180 Tagen gelöscht · Einsortieren holt sie zurück." mit
  `[[Einsortieren]]` und `[Wiederherstellen]`. Der Server holt archivierte
  Mails beim Einsortieren selbst aus dem Archiv.
- **Kopf** nennt Name **und** Adresse (die App zeigt heute nur eins); der
  Betreff steht als Kern im Kopf und in der Liste, die Gesprächskarte
  entfällt (heute dreimal). Keine Angaben-Karte, sie wiederholte nur den
  Kopf.
- Nach dem Einsortieren geht es wie heute in den Vorgang.
- **Optional, Backend additiv (Frage 11):** ein Feld `absender_bekannt` an
  `GET /support/mail/nachrichten/:id` für die Zeile „Absender gehört zu
  Test-Gemeinde St. Martin · 2 offene Vorgänge [In Vorgang 2 einsortieren]".

### E. Mail, die in einem Vorgang liegt

**Heute** öffnet sich der Posteingang ohne markierte Zeile, der Kopf zeigt
den rohen Betreff „AW: [Vorgang 2] Re: AW: Re: …", darunter steht der ganze
Faden ein zweites Mal (erster Mailtext erst nach 196 px bzw. 366 px), und
Archivieren und Löschen sind aktiv, obwohl der Server beides mit 409
ablehnt.

**Künftig** leitet die Seite nach dem Laden mit replace auf
`/admin/support/vorgaenge/2?mail=5` weiter, wie heute schon
`/admin/support/anfragen/:id`. Dort ist der Vorgang gewählt, „Vorgänge" in
der Leiste aktiv, die Mail aufgeklappt, in den Blick gerollt und 2 s
hervorgehoben. Umsortieren geht über das Menü der Mail (A). Die Übersicht
verlinkt „Neueste Mails" mit Vorgang gleich dorthin. Die alten Adressen
tragen weiter.

### F. Breit lesen

Ein Symbolknopf im Listenkopf blendet die Liste aus; der Lesebereich wird
1136 px (1280: 976 px) breit und damit zweispaltig. Der Kopf bekommt, was
jede Detailseite hat: „‹ Alle Vorgänge" (blendet die Liste wieder ein) und
‹ › zum vorigen bzw. nächsten Eintrag der Liste; die Pfeiltasten wirken
weiter. Die Wahl wird je Gerät gemerkt (localStorage, nur Bequemlichkeit,
mit try/catch). Direktlinks öffnen wie heute mit Liste (Frage 9).

```
| ‹ Alle Vorgänge                                                     (‹)(›)  |
| (Kreis) Konfis sehen den Termin am Samstag nicht  (L)(A) [Einordnen]        |
|         Nr. 2 · {In Arbeit} {Dringend} · Fehler › Termine ·  [Erledigt]     |
|         Test-Gemeinde St. Martin                             [[Antworten]]  |
| STAND  Test Org-Admin 1 wartet seit heute, 12:23 auf Antwort.               |
| [Mails 6]          [Neu 1]          [Offen seit 2 Tagen · In Arbeit seit …]  |
+-- Haupt 1fr ----------------------------------+-- Angaben 400 px ----------+
| NOTIZ, VERLAUF wie in A, darunter die Antwort | Kontakt, Gemeinde, Leitung |
+-----------------------------------------------+----------------------------+
```

Das ist das Bild jeder Detailseite des Hauptwebs (Event, Konfi) und
entspricht Entscheidung 7 vom 03.10.: links Verlauf und Antwort, rechts die
Angaben.

### G. Antworten (Vorgang und Mail, ein Editor)

Der Editor öffnet sich unter der jüngsten Mail und rollt nur so weit, dass
das Ende der Mail und „Antwort senden" zugleich zu sehen sind
(`block: 'end'`). Heute springt der Lesebereich um 1280 px.

```
+-- Antwort ----------------------------------------------------- [Verwerfen] +
| (nur wenn zutreffend) Postfach support@ noch nicht eingerichtet – … (1 Zeile)|
| An  [Test Org-Admin 1 · schrieb uns                        v]  von support@ |
| Betreff  Re: Konfis sehen den Termin am Samstag nicht               [Ändern] |
| | Text der Antwort* (6 Zeilen, wächst mit)                                 | |
| [Baustein einfügen v]    > Vorschau mit Fußzeile                             |
| Danach  [Wartet auf Rückmeldung v]                      [[Antwort senden]]   |
+------------------------------------------------------------------------------+
```

- **Höhe** ≈ 300 statt 837/857 px. Bei 1440 passen Mail (≈ 200) und Editor
  unter den Kopf (552 px); bei 1280 bleiben vom Ende der Mail ≈ 150 px im
  Bild.
- **Empfänger** mit lesbarem Etikett statt „· verlauf", die Adresse in der
  Option. Gibt es nur eine Adresse, steht eine feste Zeile „An … · von …";
  im Posteingang genauso (eine Form statt zwei).
- **Betreff:** „Re: " plus der berichtigte Kern des Betreffs der letzten
  Mail; ohne Mail wie heute. Die Kennung `[Vorgang N]` hängt der Server an
  (`betreffMitKennung`).
- **„Danach"** setzt nach dem Senden den Status mit einem PATCH; Vorgabe
  „Wartet auf Rückmeldung", zur Wahl In Arbeit und Erledigt (Frage 3).
  Scheitert das PATCH, kommt „Gesendet, Status nicht gesetzt", nie Stille.
- **Unverändert:** Bausteine, Platzhalter- und Fußzeilen-Hinweis,
  Sendefehler 502/503, „Senden ist aus", Rückfrage vor dem Senden,
  „Verwerfen". Die Vorschau ist eingeklappt.

### H. Dialoge

- **Einordnen** (WebDialog 520 px): Feld Gemeinde über die volle Breite
  (heute „Test-Gemeinde St. Ma…"); neu das Feld „Betreff" (PATCH nimmt es
  schon an); bei Status „Erledigt" an einer Anfrage: „Erledigt lehnt die
  Anfrage ab; sie wird nach 180 Tagen gelöscht."
- **Gemeinde anlegen** (WebDialog breit, 720 px, Knopfleiste bleibt unten im
  Bild): oben eine Zeile aus der Anfrage („A. Beispiel (Diakonin) · 38 Konfis
  · 9 Teamer:innen · Wunsch Standard"), Felder in zwei Spalten (links
  Gemeinde und Tarif, rechts erste Gemeindeleitung). Vorbelegung, „Als
  Kirchenkreis anlegen", Passwort vorschlagen und zeigen, Prüfung und
  Rückfrage bleiben aus `useGemeindeAnlegen`. Beim Anlegen `gesperrt`.
  Schließen mit Änderungen (Escape, Klick daneben, ✕) fragt zurück, sonst
  ginge das erzeugte Passwort verloren. ≈ 720 × 620 px statt ≈ 1180 px Karte
  im Lesebereich.
- **Mail einsortieren** bleibt (520 × 454 px). Beim Verschieben heißt der
  Titel „In anderen Vorgang verschieben", in App und Web gleich.

### Rahmen (klein, im selben Zug)

- **Listenzeile:** derselbe Kreis wie im Kopf; in Zeile 2 „Nr. 2 · Fehler ·
  Gemeinde" bzw. „Nicht zugeordnet" nach `istZugeordnet`; die Marken in
  eigener Zeile (heute „Test-Gemeinde St. Mar").
- **Nach Erledigt, Archivieren oder Löschen** öffnet sich der nächste Eintrag
  der Liste statt eines leeren Lesebereichs (Frage 6).
- **Optional (Frage 10):** Suche in den Listenkopf, Untertitel weg; bringt
  ≈ 80 px Lesehöhe, weicht aber vom Kopf aller anderen Web-Listen ab.

## In der App (390 × 844)

Dieselbe Reihenfolge wie im Browser: Kopfzeile mit Symbolen; SectionHeader
mit drei **Zahlen**-Kacheln; Karte „Stand" mit Marken, Satz, Hauptknopf und
Notiz; Verlauf; Anfrage, Kontakt, Gemeinde; Löschen als einziger Knopf
unten. Alle Detailseiten bekommen „Ziehen zum Aktualisieren"
(IonRefresher); damit stimmt auch der Satz der Anfrage-Weiterleitung.

### A. Vorgang mit Anliegen (Vorgang 2)

```
+--------------------------------------------+
| <  Vorgang 2     (Einordnen)(Archiv)(Glocke)|  Archiv heute 1763 px tief
| ########################################## |  SectionHeader, Support-Farbe
| # (Kreis) Konfis sehen den Termin am     # |  Titel = Betreff
| #   Samstag nicht                        # |
| #   Nr. 2 · Test-Gemeinde St. Martin     # |  Gemeinde nur, wenn zugeordnet
| #   [  6  ]     [  1  ]     [  2  ]      # |  nur Zahlen: kein Überlauf
| #   MAILS       NEU         TAGE OFFEN   # |
| +-- Stand --------------------------------+ |
| | {In Arbeit}{Dringend}{Fehler › Termine} | |  Marken; antippen = Einordnen
| | Test Org-Admin 1 wartet seit heute,     | |
| | 12:23 auf Antwort.                      | |
| | [[    ANTWORTEN    ]]  [ ERLEDIGT ]     | |  Haupt 2 : Neben 1
| | Notiz: Vermutlich Zielgruppe „Nur …   > | |  leer: „Notiz hinzufügen >"
| +-----------------------------------------+ |
| (Verlauf)                6 · Alle aufklappen|
| | (TO) Test Org-Admin 1 · {Formular}    > | |  2 Zeilen
| | ··· 4 frühere Mails · 2 Anhänge       > | |
| | (TO) Test Org-Admin 1 {Neu}   12:23 (···)| |  y ~670: im ersten Bild
| |      Super, danke! 31 von 34 Konfis …   | |  volle Breite, keine Treppe
| | Antwort an Test Org-Admin 1 …         > | |  öffnet das Modal
| (Person) Kontakt                            |
| (Gemeinde) Test-Gemeinde St. Martin       > |  Kreis und Landeskirche neu
|   Gemeindeleitung (2)                     v |  eingeklappt
|        [  VORGANG LÖSCHEN  ]                |  einziger Knopf unten
+--------------------------------------------+   Ziel ~1600 px statt 2647
```

- **Kacheln:** Status, Art und Dringlichkeit waren Wörter und liefen über;
  jetzt Marken in der Stand-Karte. „Normal" entfällt als Anzeige und bleibt
  in Einordnen wählbar. Der Bereich steht heute in der App nirgends,
  künftig in der Marke „Fehler › Termine".
- **Knöpfe:** Antworten und Einordnen waren zwei gleich große Knöpfe. Jetzt
  folgt ein Hauptknopf dem Stand; Einordnen sitzt als Symbol oben, wie
  Bearbeiten bei Event und Konfi, und hinter den Marken.
- **Notiz** oben statt nach 1531 px.

### B. Vorgang einer Anfrage (Vorgang 1)

Kopfzeile „Anfrage 1", Kacheln Konfis 38 · Team 9 · Mails 3, Untertitel
„Nr. 1 · noch nicht angelegt" ohne Gemeinde-Symbol. Stand-Karte mit
`[[ANTWORTEN]]` über `[GEMEINDE ANLEGEN]` und `[ABLEHNEN]`, darunter „+
Interne Notiz". Danach Verlauf, Abschnitt Anfrage (Gemeinde angefragt, Kreis
› Landeskirche, „steht in der Struktur / fehlt noch", Wunschlizenz mit
Preis), Kontakt (Person, E-Mail, Mobil — fehlt der App heute), unten „Vorgang
und Anfrage löschen". Gemeinde anlegen öffnet ein Vollbild-Modal (F). Nach
dem Anlegen zeigt die Stand-Karte Fall 1a mit `[[GEMEINDE ÖFFNEN]]`, und der
Abschnitt Gemeinde erscheint. Der Gemeindename steht zweimal statt fünfmal.
Ziel ≈ 1700 px statt 4001.

### C. Reiner Mail-Vorgang (Vorgang 3)

Wie A ohne Formular-Anfang, Kontakt ist der erste Absender, Kacheln Mails
3 · Neu 0 · Tage 1. Ohne Gemeinde zeigt die Stand-Karte Fall 2 mit
`[[GEMEINDE ZUORDNEN]]`. Ziel ≈ 1300 px statt 2227.

### D. Mail im Posteingang

Kopfzeile „Mail" mit Archiv und Glocke; Kopf mit Kern-Betreff, Name **und**
Adresse; Kacheln Mails · Neu · Anhänge; Stand-Karte mit dem Postfach als
Marke statt der überlaufenden Kachel „support@Eingang", `[[EINSORTIEREN]]`
und `[ANTWORTEN]`; darunter die Mail offen mit Anhängen; unten „Mail
löschen". Im Archiv wie im Browser mit `[[EINSORTIEREN]] [WIEDERHERSTELLEN]`.
Eine Mail in einem Vorgang leitet mit replace auf den Vorgang weiter, die
Mail ist dort offen.

### E. Weiterleitung einer Anfrage (`/admin/support/anfragen/:id`)

Bleibt unsichtbar wie heute. Mit dem IonRefresher stimmt der Satz „Zieh die
Seite zum Aktualisieren herunter".

### F. Modale (Schließen links, Hauptaktion rechts, `gestaltung.md`)

```
| Abbrechen          Antworten          Senden |
| +-- Du antwortest auf --------------------+ |  neu: die beantwortete Mail,
| | (TO) Test Org-Admin 1 · heute, 12:23    | |  3 Zeilen, antippen = ganz
| | Super, danke! … Kann ich die Anmelde-   | |
| +-----------------------------------------+ |
| An       Test Org-Admin 1 · schrieb uns   > |  lesbare Herkunft
| Betreff  Re: Konfis sehen den Termin …    > |  antippen = ändern
| | Text der Antwort (Fokus, wächst mit)    | |
| [+ Baustein]        [Vorschau mit Fußzeile >]|
| Danach  [Wartet | In Arbeit | Erledigt]     |  IonSegment
| [[            ANTWORT SENDEN            ]]  |
```

- **Antworten:** Warnungen zu Server und Postfach als eine Zeile über „An";
  die Rückfrage vor dem Senden bleibt. Nach dem Senden schließt sich das
  Modal, die neue Mail steht offen im Verlauf.
- **Einordnen:** „Abbrechen | Einordnen | Speichern"; Status, Art, Bereich
  (Pflicht geprüft wie im Browser), Dringlichkeit, Gemeinde, neu Betreff;
  bei einer Anfrage und Erledigt: „Erledigt lehnt die Anfrage ab." Ein PATCH
  mit den geänderten Feldern; „Jede Änderung wird sofort gespeichert" und
  „Fertig" entfallen (Frage 5).
- **Notiz:** „Abbrechen | Notiz | Speichern" mit einem Textfeld; die
  ungespeicherte Notiz überlebt das Neuladen wie heute.
- **Gemeinde anlegen:** Vollbild, „Abbrechen | Gemeinde anlegen | Anlegen",
  darunter die Kurzzeile aus der Anfrage, dann Gemeinde, Tarif und erste
  Gemeindeleitung. Vorbelegung und Rückfrage wie heute; Wischen zum
  Schließen fragt bei Änderungen zurück (`canDismiss`).
- **Einsortieren** bleibt; der Titel wird angeglichen.

### Nebenbei: Listen am Handy (eigenes, optionales Paket)

Der Betreff läuft über die volle Breite, die Marken stehen darunter (heute
eine ≈ 90 px schmale Spalte über vier Zeilen mit Silbentrennung). Art,
Gemeinde und Suche wandern hinter einen Filter-Knopf: die erste Karte bei
y ≈ 200 statt 431. Die Postfach-Karte des Posteingangs wird eine Zeile: die
erste Mail bei y ≈ 200 statt 611.

## Zuordnung heute → künftig

Jede Angabe und Aktion des Bestands, App und Browser zusammen.

| Heute | Künftig |
|---|---|
| **Kopf und Stand** | |
| Betreff (Web h2, App Titel), „(ohne Betreff)" | unverändert im Kopf; davor der Kreis mit dem Symbol der Art (auch in der Listenzeile) |
| „Vorgang {id}" (Web), App-Untertitel „Vorgang {id} · {gemeinde_name}" mit Freitext | Web „Nr. 2" in den Kennzeichen; App-Kopfzeile „Vorgang 2", Untertitel „Nr. 2 · Gemeinde" nur mit `organization_id` |
| Status (Web Pill, App Kachel) | Marke in den Kennzeichen (Web) bzw. der Stand-Karte (App); ändern über Hauptknopf, „Danach" oder Einordnen |
| Art (Web Steckbrief, App Kachel), Bereich (nur Web-Steckbrief) | Kreis und „Art › Bereich" in beiden Fassungen; fehlt der Bereich bei Frage, Fehler, Wunsch: `{Bereich fehlt}` öffnet Einordnen |
| Dringlichkeit (Web nur Dringend, App „Normal/Dringend") | nur `{Dringend}`; „Normal" bleibt in Einordnen wählbar |
| Pill „Archiv" und Archiv-Hinweis (zwei Texte, App mit Knopf im Hinweis) | Stand Fall 1 mit einem Text; Wiederherstellen ist dann Hauptknopf |
| Gemeinde im Web-Kopf mit Symbol, auch Freitext | nur mit `organization_id`, als Link; sonst `{Keine Gemeinde}` bzw. `{Noch nicht angelegt}` |
| Warnung „Noch keiner Gemeinde zugeordnet" (Web mit Knopf, App mit Satz) | ohne Antwortweg Stand Fall 2 mit `[[Gemeinde zuordnen]]`; mit Antwortweg Zeile „Nicht zugeordnet – laut Formular: X [Zuordnen]" in der Kontakt-Karte; bei Anfrage entfällt sie |
| Hinweis „Es gibt noch niemanden, dem sich antworten ließe" (zwei Texte) | geht in Stand Fall 2 auf; die Antwortzeile ist gesperrt |
| (fehlt) wer dran ist, seit wann | Stand-Satz aus `vorgangStand` mit `status_seit` |
| **Verlauf** | |
| Anfangskarte „Anliegen aus dem Formular" / „Nachricht aus der Anfrage" (je Fassung selbst gebaut) | erster Eintrag mit Marke `{Formular}`/`{Anfrage}`, offen bis zur ersten Antwort, dann zwei Zeilen; gebaut in `verlaufReihe` |
| Leiste „N Mails in M Gesprächen · Alle aufklappen" | „N Nachrichten, k neu · Alle aufklappen" |
| Gesprächskarte mit dem Betreff der ältesten Mail | entfällt im Vorgang (Titel = Vorgangsbetreff) und im Posteingang (Betreff im Kopf) |
| Treppe bis drei Stufen, gekürzte Namen und Vorschauen | flach, volle Breite; „Antwort auf {Name}, {Zeit}", wo nötig |
| Zeile mit Kreis, Absender, Gesendet, Neu, Zeit, Vorschau, Anhang-Symbol | bleibt; ab drei eingeklappten in Folge Stapel „N frühere Mails" (Ungelesenes nie) |
| Offen: An/von, eigener Betreff roh, Text, Zitat, Signatur, Anhangnamen | bleibt; Betreff nur als abweichender Kern; Roh-Kopfzeilen im Menü (···) |
| Ausgehend „Konfi Quest Support" bzw. „Test Super-Admin" | „Support · {Konto}", ohne Konto „Support", grüner Kreis KQ |
| Leertext, Auf- und Zuklappen, Zitat, Signatur | bleibt; dazu Stapel öffnen |
| (fehlt) Aktion je Mail | Menü (···): In anderen Vorgang verschieben, In neuen Vorgang herauslösen, Kopfzeilen zeigen |
| **Antworten** | |
| Knopf (Web primär im Kopf, App oben links) | Hauptknopf, wenn man dran ist, sonst Nebenknopf; dazu die Antwortzeile unter der jüngsten Mail |
| Web-Formular unter dem Verlauf (837/857 px, Sprung 1280 px) | Editor ≈ 300 px unter der jüngsten Mail, rollt nur bis zu seinem Ende |
| App-Modal ohne die beantwortete Mail | Modal mit „Du antwortest auf" (drei Zeilen) |
| Empfänger „Name <adresse> · verlauf"; Ladefehler „Die möglichen Empfänger konnten nicht geladen werden." | deutsches Etikett; Liste aus `empfaenger` der Detail-Antwort (mit Absendern), der getrennte Abruf und sein Ladefehler entfallen; „Für diese Gemeinde ist keine Adresse bekannt." bleibt |
| Posteingang „An: … · von moin@" als Text, Vorgang als Auswahl | eine Form: feste Zeile bei einer Adresse, sonst Auswahl |
| Betreff „Re: [Vorgang 2] Re: AW: Re: …" mit Hinweis „Leer: …" | „Re: {Kern}" mit [Ändern]; der Hinweis erscheint beim Bearbeiten |
| Textbaustein, Platzhalter-Hinweis, Vorschau mit Fußzeile (immer offen) | bleibt; Vorschau aufklappbar, Vorgabe zu |
| Warnungen, Sendefehler, Rückfrage, Meldung | unverändert |
| Verwerfen (Web) / Schließen (App) | Web „Verwerfen", App „Abbrechen" |
| (fehlt) Status nach dem Senden | „Danach" mit Vorgabe Wartet (Frage 3) |
| **Angaben** | |
| Steckbrief bzw. Abschnitt Kontakt: Name, mailto, Funktion | Karte bzw. Abschnitt „Kontakt": Person (Funktion), E-Mail mit mailto und „Im Vorgang antworten", bei Anfrage Mobil (tel:) auch in der App |
| „Eingegangen" (Herkunft, Zeit) und dieselbe Zeit an der Anfangskarte | „Eingang" nur Herkunft; die Zeit einmal am Anfang |
| „Gemeinde laut Formular" (App) | nur solange nicht zugeordnet, in der Zeile „Nicht zugeordnet – laut Formular: X" |
| (nicht gelesen) `erstellt_von_name` | bei Herkunft Support „Angelegt von …" |
| Gemeinde: Link, Laufzeit (ohne Ton), Konfis, KK, LK (App ohne KK/LK), Alle Vorgänge | Karte bzw. Abschnitt „Gemeinde" aus `vorgangAngaben`, gleich in beiden Fassungen; Laufzeit mit Ton; „KK › LK" in einer Zeile; Links nur mit `organization_id` |
| Gemeindeleitung (Web ohne Überschrift, App ohne Gesperrt und „noch nicht angemeldet") | „Gemeindeleitung (n)"; Name, `{Gesperrt}`, E-Mail oder „Keine E-Mail", zuletzt bzw. noch nicht angemeldet, „Im Vorgang antworten"; App eingeklappt |
| Anfrage: Gemeinde (laut Anfrage), Verantwortlich, Mobil (nur Web), KK, LK, Zahl, Wunschlizenz | Karte „Anfrage": Gemeinde (angefragt), KK › LK mit „steht in der Struktur / fehlt noch", Wunschlizenz mit Preis, Eingang; Verantwortlich = Kontakt; Mobil beim Kontakt; Zahlen als Kennzeichen bzw. Kennzahlen |
| Akkordeon „Gemeinde, Anfrage und Notiz", „mit Notiz" | entfällt; offene Karten, Notiz oben |
| Notiz (Web im Akkordeon, App nach dem Verlauf) | unter dem Stand, höchstens drei Zeilen; Web inline mit Speichern bei Änderung, App Modal; leer „+ Interne Notiz" |
| „Die Gemeinde ist angelegt." mit Benutzername und „Gemeinde öffnen" | Stand Fall 1a, Benutzername auch nach dem Neuladen (aus `leitung`) |
| **Aktionen des Vorgangs** | |
| Einordnen (Web Knopf, App Knopfreihe) | Web Kopf (schmal Symbol); App Symbol in der Kopfzeile, dazu die Marken |
| Archivieren / Wiederherstellen (Web Symbol, App unten bei 1763 px) | Symbol im Kopf bzw. in der Kopfzeile; archiviert: Wiederherstellen als Hauptknopf |
| Löschen mit Rückfrage (zwei Texte) | Web Symbol im Kopf, App einziger Knopf unten; ein Text in `seiten/supportDetail.ts`; danach Web nächster Eintrag, App Liste |
| Gemeinde anlegen (Karte mitten im Lesebereich) | Dialog (Web 720 px) bzw. Vollbild-Modal (App) aus Kopf bzw. Stand-Karte; Inhalt unverändert |
| (fehlt) Anfrage ablehnen | Symbol (Web) bzw. Knopf (App) mit Rückfrage, die die Folge nennt; PATCH erledigt |
| (fehlt) Betreff ändern | Feld in Einordnen |
| Gemeinde öffnen, Alle Vorgänge (dreifach gebaut), mailto, tel: | je einmal in den Karten, Links aus einer Stelle |
| Gelesen-Meldung, „Neu" für den Besuch, Aktuell-Bleiben, Laden, Fehler, Nicht gefunden, Zurück | unverändert |
| **Mail** | |
| Betreff roh (Web h2, App Banner) | Kern-Betreff |
| Absender (Web „Name <adresse>", App Name oder Adresse) | Name und Adresse in beiden |
| Postfach-Pill bzw. -Kachel, „N Mails im Faden", Kachel „Liegt im" | Kennzeichen „an support@ · Zeit · N Mails · Anhänge"; App-Kacheln Mails/Neu/Anhänge, Postfach als Marke |
| Archiv-Hinweis mit Widerspruch | „Im Archiv seit … · wird nach 180 Tagen gelöscht · Einsortieren holt sie zurück." |
| Antworten (primär, nur ohne Vorgang) | Nebenknopf, derselbe Editor |
| Einsortieren / Umsortieren („Anderem Vorgang zuordnen" bzw. „Mail einsortieren") | Posteingang Hauptknopf; im Vorgang Menü der Mail; ein Titel je Handlung |
| Archivieren / Wiederherstellen, Löschen | Posteingang unverändert; bei Mails im Vorgang entfallen sie (Server 409) |
| „Einsortiert in Vorgang N", „Vorgang öffnen", Faden noch einmal | Weiterleitung auf `/vorgaenge/N?mail=id` |
| **Dialoge und Rahmen** | |
| Einordnen: App sofort gespeichert mit „Fertig", Web „Speichern"; Pflicht-Bereich nur im Web geprüft; Erledigt-Hinweis in der App immer | eine Bedienweise mit Speichern (`useEinordnenFormular`), Prüfung in beiden, Erledigt-Hinweis nur bei Erledigt, bei Anfrage mit Ablehnung |
| Einordnen Web: Gemeinde abgeschnitten | volle Breite; Fehlerzeilen bleiben |
| Einsortieren: Liste, Suche, Leertexte, neuer Vorgang | unverändert |
| Aktualisieren, Neuer Vorgang, Reiter, Suche, Filter, Sammelleiste, Pfeiltasten | unverändert; neu „Breit lesen" im Listenkopf |
| Listenzeile: Betreff, Zeit, „Nr. · gemeinde_name/Nicht zugeordnet", Zahl, Dringend, Status | dazu Kreis (Art) und Art in Zeile 2; „Nicht zugeordnet" nach `organization_id` |
| Lesebereich nach Archivieren/Löschen leer | nächster Eintrag der Liste (Frage 6) |

## Fehler vorab

Beim Messen gefunden und am Code bestätigt. Sie stehen unabhängig vom Umbau
an und kommen als Paket 1, je mit dem Test vorab, der fällt.

1. **Vorsilben häufen sich im Betreff.** `betreffKern('AW: [Vorgang 2] Re:
   AW: Re: Konfis sehen …')` ergibt „Re: AW: Re: Konfis sehen …": Erst
   fallen die führenden Vorsilben, dann die Kennung; was hinter der Kennung
   steht, bleibt (`utils/mailGespraeche.ts`). `standardBetreff` entfernt die
   Kennung gar nicht und schlägt „Re: [Vorgang 2] Re: AW: Re: …" vor
   (`utils/supportMail.ts`); der Server hängt die Kennung dann nicht noch
   einmal an, weil sie schon drinsteht. Fix: erst die Kennungen entfernen,
   dann alle Vorsilben wiederholt; `standardBetreff` nutzt den Kern.
2. **Archivieren und Löschen an Mails, die schon in einem Vorgang liegen.**
   Die Knöpfe stehen auf `/post/:id` immer da (`WebPostDetail.tsx`,
   `SupportPostDetailPage.tsx`); der Server antwortet für Mails mit Vorgang
   409 „Das geht nur für Mails im Posteingang" (`backend/routes/supportMail.js`).
   Bis Paket 5 weiterleitet: ausblenden.
3. **Ein Gemeindename aus dem Formular gilt als zugeordnete Gemeinde.** Der
   Web-Kopf zeigt `gemeinde_name` mit Gemeinde-Symbol auch ohne
   `organization_id`, die Links führen dann auf `?gemeinde=null`
   (`WebVorgangDetail.tsx`); ebenso Listenzeile und App-Untertitel. Die
   Attrappe `vorgaengeServer.ts` liefert `gemeinde_name` vorher wie der
   echte Server (COALESCE mit Freitext), sonst fällt der Test nicht.
4. **Roher Schlüssel in der Empfängerwahl.** `empfaengerText` hängt
   `herkunft` unübersetzt an: „Test Org-Admin 1 <…> · verlauf".
5. **App-Kacheln laufen über** („Neue GemNormal", „support@Eingang",
   „Dringend" über den Rand).
6. **Archiv-Satz der Mail widerspricht dem Knopf.** „Stelle sie wieder her,
   wenn sie einsortiert werden soll" — daneben ist Einsortieren aktiv, und
   der Server holt die Mail beim Einsortieren selbst aus dem Archiv.

## Messbarer Gewinn

Heute gemessen, Ziele geschätzt und nach jedem Paket nachgemessen.

| Messgröße | heute | Ziel |
|---|---|---|
| Weg zur jüngsten Mail, Web 1440: V2 / V1 / V3 | 513 / 342 / 23 px | 0 / 0 / 0 |
| dasselbe Web 1280 | 656 / 509 / 236 px | 0 / ≤ 60 / 0 |
| dasselbe Handy | 551 / 360 / 136 px | 0 / ≤ 100 / 0 |
| Notiz sichtbar, Web V2 / V1 | nach Klick + 2363 / 2617 px | 0 (y ≈ 160) |
| Notiz, Handy V2 / V1 / V3 | 1531 / 2884 / 1111 px | 0 (Stand-Karte) |
| Antwortformular Web | 837 / 857 px | ≈ 300 px |
| Sprung beim Öffnen der Antwort | 1280 px | ≤ 300 px |
| Mail und „Senden" zugleich sichtbar (1440) | nie | ja |
| Beantwortete Mail im App-Modal | 0 Zeilen | 3 Zeilen, aufklappbar |
| Fester Lesekopf 1440 / 1280 | 134 / 157 px | ≈ 104 / ≈ 104 px (Anfrage bei 1280 wie heute) |
| Lesebereich Web V1 / V2 / V3 (1440) | 2525 / 1360 / 1004 px | ≈ 1200 / ≈ 1050 / ≈ 850 px |
| Handyseite V1 / V2 / V3 | 4001 / 2647 / 2227 px | ≈ 1700 / ≈ 1600 / ≈ 1300 px |
| Archivieren am Handy (Scrollweg) V2 / V1 | 1763 / 3117 px | 0 (Kopfzeile) |
| Angaben hinter Akkordeon (Web) | 3 Blöcke | 0 |
| „Test Org-Admin 1" im Web-Lesebereich V2 | 6 (aufgeklappt 8) | 4 |
| Gemeindename V1, Web / Handy | 5 / 5 | 3 / 2 |
| Kontaktperson V1, Handy | 6 | 3 |
| Betreff im Lesebereich V3 | 4 | 1 |
| Mail im Vorgang (`/post/5`): Weg zum ersten Text | 196 / 366 / 221 px | 0 (Weiterleitung) |
| Klicks „Erledigt" / „Antworten und auf Wartet" / „Anfrage ablehnen" | 3 / 6 / 3 | 1 / 3 / 2 |
| Nach Erledigt, Archiv, Löschen weiterlesen (Web) | 1 Klick in die Liste | 0 |
| Bedienweisen Einordnen / Antwortformen | 2 / 2 | 1 / 1 |
| Knöpfe, die der Server ablehnt (`/post/:id` mit Vorgang) | 2 | 0 |

Die Zahl der Knöpfe im Lesebereich bleibt etwa gleich (V2: 6 → 6); genau
einer ist hervorgehoben, und er folgt dem Stand. Heute ist „Antworten" immer
primär, auch wenn man nicht dran ist.

## Umsetzung in Paketen

Jedes Paket für sich auslieferbar, ein Commit je Paket, im selben Commit
CHANGELOG, `docs/betrieb/support-ansicht.md` und Tests. Keine Route und
keine Antwortform am Server ändert sich; die ausgelieferten Apps sind nicht
betroffen.

1. **Fehler zuerst** — die sechs Punkte unter [Fehler vorab](#fehler-vorab),
   je erst der Test, der fällt, dann der Fix, dann die Gegenprobe.
2. **Kopf und Stand** — `vorgangStand`, `mailStand`,
   `seiten/supportDetail.ts`; Kopf mit allen Aktionen, Hauptknopf rechts
   außen; Kreis und Kennzeichen; Stand-Satz und Notiz; Leser für
   `status_seit` und `erstellt_von_name`; App: Stand-Karte, Kopfzeile mit
   Einordnen und Archiv, Löschen allein unten, IonRefresher auf Vorgang,
   Mail und Weiterleitung.
3. **Verlauf und Antworten** — `verlaufReihe` (flach, Anfang, Stapel,
   „Antwort auf", Absender „Support"); `MailGespraeche` bekommt die flache
   Darstellung in App und Web zugleich; Web-Editor kompakt unter der
   jüngsten Mail; App-Modal mit der beantworteten Mail; Empfänger aus der
   Detail-Antwort; „Danach" nach Frage 3.
4. **Angaben und Formulare** — `vorgangAngaben`, Karten statt Akkordeon;
   `WebDetailRumpf` und `container-type` am Lesebereich; Gemeinde anlegen als
   Dialog bzw. Modal mit Schutz beim Schließen; Ablehnen;
   `useEinordnenFormular` mit Speichern, Pflicht-Bereich, Betreff und
   Erledigt-Hinweis bei Anfragen.
5. **Mail und Lesen** — Posteingangs-Mail mit Einsortieren als Hauptknopf;
   Weiterleitung einsortierter Mails auf `?mail=`; Links der Übersicht; Menü
   (···) an der Mail; „Breit lesen" mit ‹ ›; nächster Eintrag nach dem
   Abschluss (Frage 6).
6. **Optional, eigener Schritt** — Listen am Handy, Web-Listenzeile mit
   Kreis, kompakter Rahmen (Frage 10), additive Backend-Felder
   (`absender_bekannt`, `status` an `POST …/antworten`, `antwort_auf`), je
   mit Backend-Test, Eintrag in der exakten Feldliste von
   `backend/tests/routes/supportVorgaenge.test.js` und in
   `docs/api/verwaltung-auth.yaml`.

## Tests

**Neue reine Funktionen** bekommen Tabellentests mit konkreten Werten und
Gegenprobe (Regel verfälschen, der Test muss fallen):

- `vorgangStand`: jeder Fall 1a bis 6, die automatische Bestätigung ohne
  `verfasst_von`, die Anfrage ohne Mail, Wartet mit 6 und 8 Tagen;
- `mailStand`; `istZugeordnet` mit Freitext ohne `organization_id`;
- `verlaufReihe`: Stapel ab drei, Ungelesenes nie gestapelt, zwei parallele
  Gespräche mit „Antwort auf", Anfang offen bis zur ersten Antwort;
- `betreffKern` mit „AW: [Vorgang 2] Re: AW: Re: X";
- `empfaengerEtikett`, `vorgangAngaben` (keine Angabe doppelt),
  `vorgangKennzahlen`.

**Umschreiben, nicht aufweichen:** `webVorgangDetail.test.tsx` (Reihenfolge
Kopf → Stand → Notiz → Verlauf → Karten; keine Steckbrief-Zeilen mehr; Notiz
oben statt im Akkordeon), `supportVorgangDetail.test.tsx` (Zahlen-Kacheln,
Stand-Karte, Einordnen mit Speichern statt eines PATCH je Feld), außerdem
`supportPostDetail`, `webPostDetail` (Weiterleitung mit replace, keine
409-Knöpfe), `mailGespraeche` (keine Tiefe, kein Gesprächstitel im
Vorgang), `supportAktuell` (ungespeicherte Notiz überlebt das Neuladen, auch
mit dem Notiz-Modal), `webVorgaenge` (nächster Eintrag, Listenzeile) und
`supportAnfrageWeiterleitung` (IonRefresher).

**Neu:** „Breit lesen" (Liste aus, ‹ ›, gemerkt, ohne localStorage
lauffähig); `?mail=` öffnet und markiert die Mail; der Anlege-Dialog fragt
beim Schließen mit Änderungen; Ablehnen schickt `status: 'erledigt'` erst
nach der Bestätigung.

**Wächter:** `webCssKlassen` (neue Klassen nur in `support.css`),
`webAnsichtCss` (nur Tokens), `webDetailSeite` und `webDetailUndAnsicht`
bleiben grün nach dem Herauslösen von `WebDetailRumpf`,
`webDetailSeiteEinGeruest` bleibt unberührt.

**Bilder** erst nach dem Deploy und jedes ansehen: 1440 und 1280, hell und
dunkel, Handy iOS und Android mit Android-Kennung, mit dem Messskript gegen
dieselben Daten.

## Doku im selben Commit

- `docs/betrieb/support-ansicht.md`: Antwortformular „unter dem Verlauf",
  Treppe und Gesprächstitel, Einordnen und den Block „Bearbeitung" mit
  „Abgelehnt" (gibt es nicht mehr) nachziehen.
- Kopfkommentare richtigstellen: `WebDetailSeite.tsx` (wird mit
  `WebDetailRumpf` wieder wahr) und `seiten/supportEinsortieren.ts` (Modal
  statt Abschnitt).
- In `docs/offene-befunde.md` die Fehler vorab streichen, sobald Paket 1
  sie behebt.
- Kein Handbuch-Kapitel, der Support betrifft nur Super-Admins. API-Doku
  nur mit den optionalen Backend-Feldern.

## Risiken

1. **Die Stand-Regel kann danebenliegen.** Ein „Danke, passt!" ergibt
   „wartet auf Antwort". Gegenmittel: Der Satz nennt nur Tatsachen, und
   „Erledigt" steht dann als Nebenknopf daneben.
2. **Antwort eines gelöschten Kontos.** Beim Löschen eines Kontos wird
   `verfasst_von` genullt (`kontoLoeschen.js`); die Antwort sieht dann aus
   wie die automatische Bestätigung und zählt im Stand nicht als Antwort.
   Selten; im Test festhalten.
3. **`container-type` am Lesebereich.** Alle `@container`-Regeln darin messen
   dann den Lesebereich, auch die Tabellenregel bei max-width 1000. Gewollt,
   aber Posteingang und Vorgänge bei 1280 und 1440, hell und dunkel, neu
   ansehen.
4. **Kopf bei 1280 und Anfrage.** Fünf Symbole und der Hauptknopf lassen dem
   Titel zu wenig Platz; die Knopfreihe rutscht wie heute unter die
   Kennzeichen. Messen; falls es stört, Ablehnen nur im Einordnen-Dialog.
5. **„Danach" braucht zwei Aufrufe.** Scheitert der zweite, muss „Gesendet,
   Status nicht gesetzt" kommen. Sauberer wäre ein additives Feld `status`
   an `POST …/antworten` (Paket 6).
6. **Die Weiterleitung `/post/:id` braucht replace**, sonst landet „Zurück"
   wieder in ihr. Das Menü „In anderen Vorgang verschieben" muss vorher
   stehen, sonst fehlt der Weg zum Umsortieren.
7. **Einordnen am Handy mit Speichern** ändert gelernte Bedienung (Frage 5).
   Entscheidet Simon für sofortiges Speichern, wird der Browser angeglichen;
   beides stehen zu lassen geht nicht.

## Fragen an Simon

Zu jeder Frage der Vorschlag.

1. **„Antrag"** — angenommen ist das Anliegen aus dem Support-Formular, dazu
   Anfrage und Mail. Den Aktivitäts-Antrag der Konfis gibt es im Support
   nicht. *Vorschlag: so.*
2. **Verlauf** überall flach, das Älteste oben, Gelesenes einzeilig, ab drei
   als „N frühere Mails", Bezug über „Antwort auf …" statt der Treppe, auch
   im Posteingang? *Vorschlag: ja.*
3. **Beim Senden den Status mitsetzen** („Danach", Vorgabe „Wartet auf
   Rückmeldung")? *Vorschlag: ja.*
4. **„Ablehnen" als eigener Knopf bei Anfragen** — erledigt und archiviert
   den Vorgang, die Anfrage wird nach 180 Tagen gelöscht, keine Absage-Mail,
   Wiederherstellen holt beides zurück? *Vorschlag: ja.*
5. **Einordnen am Handy** wie im Browser erst mit „Speichern"?
   *Vorschlag: ja.*
6. **Nach Erledigt, Archivieren oder Löschen** im Browser gleich den
   nächsten Eintrag öffnen? *Vorschlag: ja.*
7. **Kennzahlen:** Mails · Neu · Tage offen; bei Anfragen Konfis ·
   Teamer:innen · Mails; bei Mails Mails · Neu · Anhänge? *Vorschlag: so.*
8. **App: Hauptknopf** oben in der Karte „Stand" oder erst nach dem Verlauf
   wie bei Events („erst lesen, dann handeln")? *Vorschlag: oben.*
9. **„Breit lesen"** als Schalter im Listenkopf, je Gerät gemerkt,
   Direktlinks weiter mit Liste? *Vorschlag: ja.*
10. **Kompakter Rahmen:** Suche in den Listenkopf, Untertitel weg (≈ 80 px
    mehr Lesehöhe, weicht von den anderen Web-Listen ab)? *Vorschlag: erst
    nach Paket 5 messen.*
11. **Absender einer bekannten Gemeinde** im Posteingang anzeigen und beim
    Einsortieren vorbelegen (Backend additiv)? *Vorschlag: später,
    Paket 6.*
12. **Wort für den Bereich „termine":** im Support „Events", im Formular und
    in den Mails „Termin". *Vorschlag: „Events", wie überall in der App.*
