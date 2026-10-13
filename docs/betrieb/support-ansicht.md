# Die Support-Ansicht benutzen

Für den Betrieb von Konfi Quest: wer die Support-Ansicht sieht, wie man
hinkommt und wie man darin Vorgänge liest, bearbeitet und beantwortet, Mails
einsortiert, archiviert und löscht, Gemeinden anlegt, Lizenzen ändert, die
Struktur aus Landeskirchen und Kirchenkreisen pflegt und Support-Konten
verwaltet. Grundlage sind Simons Entscheidungen vom 02. und 03.10.2026
([planung/web-version.md](../planung/web-version.md), Punkt 2 bis 7 und 10
bis 15; [planung/support-vorgaenge.md](../planung/support-vorgaenge.md)) und
vom 11.10.2026 zu den Detailseiten
([planung/support-detailseiten.md](../planung/support-detailseiten.md)).
Belegt am Code (`frontend/src/components/support/`, die Regeln der
Detailseiten in `frontend/src/utils/supportVorgaenge.ts`, `supportMail.ts`,
`mailGespraeche.ts` und `lizenzAendern.ts`, ihre Texte in
`frontend/src/seiten/supportDetail.ts`,
`frontend/src/navigation/rollenBaeume.ts` und `supportMenue.ts`, die Formulare in
`frontend/public/landing.html`, `backend/routes/supportVorgaenge.js`,
`backend/utils/mailZuordnung.js`) und an den Tests unter
`frontend/src/__tests__/components/support/`,
`frontend/src/__tests__/navigation/supportBaum.test.tsx`,
`frontend/src/__tests__/betrieb/anfrageFormular.test.ts` und
`anliegenFormular.test.ts`. Die Routen dahinter stehen in der API-Doku.

## Wer sie sieht und wie man hinkommt

Nur Konten mit **Super-Admin-Recht**. Für alle anderen gibt es keinen Weg
dorthin; wer eine Adresse unter `/admin/support` eintippt, sieht „Nur für den
Support", und der Server antwortet ohnehin mit 403.

| Konto | Weg |
|---|---|
| Support-Konto ohne Gemeinde ([support-konto.md](support-konto.md)) | Anmelden auf konfi-quest.de im Browser; die Startseite ist die **Übersicht** (`/admin/support`). Auf breiten Bildschirmen stehen die Bereiche in der Leiste links, auf schmalen führt die Übersicht zu allen Bereichen und trägt unten **Abmelden**. |
| Gemeindeleitung mit Super-Admin-Merkmal (Simons Konto) | Im Browser ab breitem Fenster stehen die Bereiche der Support-Ansicht in der Leiste links unter den eigenen (Gruppen Support, Verwaltung, Betrieb). In den Apps und im schmalen Fenster: Reiter **„Mehr"** › oben rechts das **Headset-Symbol** („Support-Ansicht öffnen"). Daneben bleibt das Puls-Symbol zum Betrieb. |

Die Bereiche: **Übersicht**, **Vorgänge**, **Posteingang**, **Gemeinden**,
**Struktur**, **Support-Konten**, **Textbausteine**, **Betrieb**. Gemeinden und
Betrieb sind die bekannten Seiten; eine einzelne Gemeinde öffnet die Adresse
`/admin/organizations?gemeinde=<id>` direkt. Alte Adressen der Anfragen
(`/admin/support/anfragen/<id>`) führen zum Vorgang der Anfrage.

## Zwei Gesichter: Browser und App

Im Browser ab 992 px Breite (dieselbe Grenze wie die Leiste) zeigt jede Seite
der Support-Ansicht eine eigene **Web-Fassung** mit Tabellen, Karten,
Kennzahlen und Diagrammen; die Bereiche stehen links in der Leiste, eine
eigene Liste der Bereiche gibt es dort nicht. In den Apps und im schmalen
Fenster bleibt die Darstellung der App. Gestaltung und Bausteine:
[planung/support-web.md](../planung/support-web.md).

**Vorgänge** und **Posteingang** arbeiten im Browser wie ein Mailprogramm:
links die Liste, rechts der gewählte Eintrag im Lesebereich; beide Spalten
rollen für sich. Eine Zeile wählt man per Klick oder mit den Pfeiltasten, die
Adresse folgt der Wahl (`/admin/support/vorgaenge/12`), Neuladen öffnet
denselben Eintrag. Vor jeder Zeile steht derselbe Kreis wie im Kopf des
Eintrags — bei Vorgängen das Symbol der Art, im Posteingang die Initialen
des Absenders. Bei Vorgängen steht darunter „Nr. 12 · Art · Gemeinde“ —
ohne Gemeinde „Nicht zugeordnet“, bei einer Anfrage wie im Kopf „Noch nicht
angelegt“ — und die Marken in einer eigenen Zeile; im Posteingang der Kern
des Betreffs, eine Zeile Text und das Postfach. Vorleseprogramme lesen eine
Zeile mit kurzem Namen („Vorgang 12: Betreff“) und dazu als Beschreibung
Art, Gemeinde bzw. „Nicht zugeordnet“ oder „Noch nicht angelegt“, Status,
„Dringend“ und ungelesene Mails, im Posteingang Postfach, Anhänge und den
Anfang der Mail.

Kleine Formulare — Einordnen, Einsortieren, Neuer Vorgang, Lizenz ändern —
öffnen sich als kompakter Dialog über der Seite, „Gemeinde anlegen“ als
breiter Dialog in zwei Spalten. Geantwortet wird in einem Editor direkt unter
der jüngsten Mail ([unten](#mails-beantworten-und-einsortieren)). In der App
öffnen Antworten, Einordnen, Notiz, Lizenz ändern, Gemeinde anlegen und
Einsortieren je ein eigenes Fenster, „Abbrechen“ links, die Hauptaktion
rechts; Antworten, Einordnen, Notiz, Lizenz ändern und Gemeinde anlegen
fragen beim Schließen oder Wegwischen nach, wenn Eingaben verloren gingen.
Vorgang und Mail aktualisiert man in der App durch Herunterziehen.

**Breit lesen.** Der Symbolknopf im Kopf der Liste (Tooltip „Breit lesen –
die Liste ausblenden“) blendet die Liste aus; ohne gewählten Eintrag ist er
gesperrt. Der Lesebereich wird so breit wie die Seite und zweispaltig: links
Notiz und Verlauf, rechts die Angaben, darüber Stand und Kennzahlen in einer
Zeile. Titel, Knöpfe, Reiter, Suche und Filter der Liste treten mit ihr
zurück. Über dem Kopf stehen „‹ Alle Vorgänge“ bzw. „‹ Posteingang“, das die
Liste zurückholt, und ‹ › zum vorigen und nächsten Eintrag. Die Leiste rollt nicht mit und bleibt
beim Blättern stehen, auch solange der nächste Eintrag lädt oder sich nicht
laden lässt („nicht gefunden“, Netzfehler). In ihr blättern auch die
Pfeiltasten nach oben und unten, der Fokus bleibt auf dem Knopf; nur wenn
der Knopf am Ende der Liste gesperrt wird, geht er auf den der anderen
Richtung. Im Lesebereich rollen die Pfeiltasten den Inhalt. Die Wahl gilt je
Gerät für Vorgänge und Posteingang zugleich, auch für eine schon geöffnete
Liste; ist der Speicher des Browsers gesperrt, gilt sie bis zum Neuladen. Ein
Direktlink wie `/admin/support/vorgaenge/5` öffnet immer mit Liste, auch beim
erneuten Betreten.

**Nach Erledigt, Archivieren oder Löschen** öffnet der Lesebereich den
nächsten Eintrag der Liste, am Ende den vorigen; der Fokus steht dann auf
seinem Titel. Ebenso nach ‹ ›: Der Fokus bleibt auf dem Knopf, mit dem man
geblättert hat. Steht im Editor eine Antwort, die noch nicht gesendet ist,
oder eine Notiz, die noch nicht gespeichert ist, fragen Erledigt,
Archivieren und Ablehnen vorher („Ungespeicherte Änderungen“); „Abbrechen“
lässt Entwurf und Eintrag stehen, „Verwerfen“ schließt ab und öffnet den
nächsten. Dasselbe gilt für die Sammelleiste der Liste, wenn der offene
Eintrag dabei ist (Archivieren, Erledigt, Löschen): Der nächste öffnet sich,
der nicht mit dabei war; mit einem Entwurf bleibt der offene stehen, außer
er ist gelöscht. Fällt der offene Eintrag ohne Abschluss aus der Liste —
etwa im Filter „Neu“ nach einer Antwort mit „Danach: Wartet“ —, bleibt er
offen, und ‹ › blättern in der Reihenfolge, in der er zuletzt stand.

## Die Übersicht im Browser lesen

Die Übersicht im Browser liest `GET /api/support/uebersicht`:

- **Kennzahlen:** Gemeinden (Lizenz, Testphase, unbegrenzt, gesperrt — die
  vier ergeben zusammen die Gesamtzahl), Konfis, Team, aktive Konten in 30
  Tagen (je Konto einmal), offene Vorgänge und der Posteingang (dieselbe
  Zahl wie an der Leiste).
- **Entwicklung über zwölf Monate:** neue Gemeinden, neue Konten (Konfi und
  Team), Konten gesamt am Monatsende und neue Anfragen.
- **Aktivität über zwölf Wochen:** eingereichte Anträge, Anmeldungen zu
  Terminen (auch die automatischen bei Pflichtterminen) und Chat-Nachrichten.
- **Neueste offene Vorgänge und Mails** (je fünf), **Testphasen, die in den
  nächsten 14 Tagen enden**, und Gemeinden je Landeskirche. Die Mails stehen
  mit dem Kern des Betreffs (ohne „Re:“, „AW:“ und `[Vorgang 12]`), der volle
  Betreff im Tooltip. Liegt die Mail in einem Vorgang (`vorgang_id` an jeder
  Mail), öffnet ein Klick ihn direkt, mit der Mail aufgeklappt; eine Mail
  im Posteingang öffnet ihre eigene Seite.

Monate und Wochen rechnen in deutscher Zeit. Konten zählen wie in der
Statistik: nicht gelöscht, nicht gesperrt, Support-Konten ohne Gemeinde
nicht.

## Die Kennzahlen in der App lesen

Die Übersicht in der App und im schmalen Fenster zeigt aus
`GET /api/support/statistik`:

- **Gesamt:** Gemeinden (davon aktiv und ohne Zuordnung), Konfis,
  Teamer:innen, Leitung (davon Gemeindeleitung), Konten mit Anmeldung in den
  letzten 30 Tagen und Jahrgänge.
- **Je Landeskirche und Kirchenkreis:** aufklappbar bis zur einzelnen Gemeinde.
  Kirchenkreise ohne Landeskirche und Gemeinden ohne Kirchenkreis stehen
  zuletzt unter „Ohne Landeskirche" bzw. „Ohne Kirchenkreis". Eine Gemeinde
  antippen öffnet sie unter Gemeinden.

Gezählt werden Konten je Gemeinde und Rolle, ohne Namen. Wer in zwei Gemeinden
mitarbeitet, zählt in beiden — die Summe ist die Zahl der Mitgliedschaften,
nicht der Personen. Der Stand steht unter dem Baum.

## Mit Vorgängen arbeiten

Jedes Anliegen ist ein **Vorgang** mit Nummer: eine Anfrage einer neuen
Gemeinde, ein Anliegen aus dem Support-Formular, eine Mail, die einen neuen
Vorgang eröffnet, oder ein Vorgang, den der Support selbst anlegt (Spalte
`quelle`: `anfrage`, `formular`, `mail`, `support`). Jeder Vorgang trägt:

| Feld | Werte |
|---|---|
| Art | Neue Gemeinde, Frage zur Bedienung, Fehler, Wunsch oder Idee, Zugang und Konten, Lizenz und Abrechnung, Datenschutz, Sonstiges |
| Bereich | Konfis, Events, Punkte und Anträge, Challenges, Chat, Badges, Material, Konten und Einladungen, Einstellungen, Sonstiges — oder keiner |
| Dringlichkeit | Normal, Dringend |
| Status | Neu, In Arbeit, Wartet, Erledigt |
| Gemeinde | sobald zugeordnet (`organization_id`); sonst „Nicht zugeordnet“ mit der Angabe aus dem Formular — ein Gemeindename aus Formular oder Anfrage gilt nie als Zuordnung |

Die Listen stehen einmal im Server (`backend/utils/supportVorgaenge.js`) und
einmal in der Oberfläche (`frontend/src/utils/supportVorgaenge.ts`); ein
CHECK in Migration 195 hält die Datenbank dazu.

**Liste** (Bereich **Vorgänge**): im Browser links neben dem Lesebereich, je
Zeile Kreis der Art, Betreff, Zeit der letzten Aktivität, Nummer, Art,
Gemeinde, ungelesene Mails, Dringlichkeit und Status. In der App ist es eine
Liste: vor jeder Zeile der Kreis der Art mit der Zahl ungelesener Mails, der
Betreff über die ganze Breite, darunter Nummer, Art, Bereich, Gemeinde und
Zeit und eine Zeile mit Dringlichkeit und Status.
Filter **Offen** (Neu, In Arbeit, Wartet),
**Neu**, **In Arbeit**, **Wartet** und **Archiv** (darin die erledigten),
dazu Art, Gemeinde und eine Suche über Betreff, Beschreibung, Kontakt,
Gemeinde und die Mails des Vorgangs; „#12“ findet Vorgang 12. Art und
Gemeinde stehen hinter dem Knopf **Filter**, im Browser mit der Suche
daneben. In der App steht der Knopf oben in der Kopfzeile und klappt die
Suche mit auf. Er zählt, was gerade eingrenzt (in der App auch die Suche);
kommt man mit Art oder Gemeinde in der Adresse (`?art=…`, `?gemeinde=…`),
stehen die Felder offen. Im Browser lassen sich mehrere Zeilen ankreuzen („Alle
auswählen“ steht oben in der Liste) und gemeinsam archivieren,
wiederherstellen, löschen oder auf einen Status setzen. **Neuer Vorgang**
legt einen an — mit Text geht zugleich eine Mail von support@ hinaus, an eine
der Adressen der Gemeinde (Gemeindeleitung und Leitung, wie im Schriftwechsel
der Gemeinde; ohne Wahl die erste); scheitert der Versand, entsteht kein
Vorgang. Antworten gehen nur an Adressen, die zum Vorgang gehören:
Absender seiner Mails, Kontakt aus dem Formular, Adresse der Anfrage und die
Adressen der Gemeinde.

**Ein Vorgang** sagt oben, wer dran ist und seit wann; darunter stehen die
interne Notiz, der Verlauf mit der Antwort und die Angaben als Karten. Wie
er aufgebaut ist, steht unten unter
[„Einen Vorgang lesen“](#einen-vorgang-lesen). Kommt ein Vorgang aus einer
Mail, gilt als Kontakt, wer die erste Mail schrieb. Wechselt die Gemeinde,
gehen die Mails des Vorgangs mit.

**Einordnen** — im Browser ein Knopf im Kopf (schmal ein Symbol), in der App
das Symbol oben in der Kopfzeile und jede Marke der Karte „Stand“ außer
„Noch nicht angelegt“ — ändert Betreff, Status, Dringlichkeit, Art, Bereich
und Gemeinde in einem Formular. **Speichern** übernimmt alles in einem
Schritt, im Browser wie in der App; ohne Änderung schließt es ohne Aufruf.
Bei Frage, Fehler und Wunsch ist der Bereich Pflicht, der Betreff darf nicht
leer sein und höchstens 300 Zeichen haben. Wer „Erledigt“ wählt, liest
darunter, dass erledigte Vorgänge im Archiv liegen — an einer Anfrage, die
noch nicht angelegt ist: „Erledigt lehnt die Anfrage ab; sie wird nach 180
Tagen gelöscht.“

**Archivieren und löschen.** Der Status **Erledigt** archiviert den Vorgang;
er verschwindet aus „Offen“ und steht unter „Archiv“. Erledigt steht als
Haupt- oder Nebenknopf im Kopf bzw. in der Karte „Stand“ — außer im Archiv,
ohne Antwortweg und bei einer Anfrage, die noch nicht angelegt ist (dort
heißt es Ablehnen). **Archivieren** legt einen Vorgang auch ohne Erledigt ins
Archiv; er behält seinen Status. **Wiederherstellen** holt ihn zurück, einen
erledigten mit dem Status In Arbeit; im Archiv ist es der Hauptknopf. Kommt
zu einem archivierten Vorgang eine neue Mail, holt der Server ihn ebenso mit
In Arbeit zurück. **Löschen** (Symbol im Kopf, in der App der einzige Knopf
ganz unten, mit Rückfrage) entfernt den Vorgang samt seinen Mails aus Konfi
Quest; im Postfach bleiben sie. Der Vorgang einer Anfrage nimmt die Anfrage
mit („Vorgang und Anfrage löschen“).

**Rote Zahlen:** am Bereich **Vorgänge** die nicht archivierten Vorgänge, die
neu sind oder eine ungelesene Mail haben; am **Posteingang** die ungelesenen
Mails, die keinem Vorgang zugeordnet sind (`GET /api/support/mail/zaehler`,
Felder `vorgaenge` und `posteingang`). Die Leiste holt sie alle zwei Minuten.

**Aktualisieren.** Jede Aktion — Status, Einordnen, Lesen, Einsortieren,
Archivieren, Löschen — meldet sich bei allen offenen Listen, Zahlen und der
Übersicht, die dann neu laden; ebenso beim Zurückkehren auf eine Seite und in
den Tab (`frontend/src/utils/supportAktualisieren.ts`).

## Einen Vorgang lesen

Browser und App zeigen dieselbe Reihenfolge: Kopf, Stand, Notiz, Verlauf mit
der Antwort, Angaben. Was wann dasteht, entscheidet eine Stelle für beide
Fassungen (`frontend/src/utils/supportVorgaenge.ts`, die Texte in
`frontend/src/seiten/supportDetail.ts`).

**Kopf.** Im Browser klebt er oben im Lesebereich: der Kreis mit dem Symbol
der Art, der Betreff (höchstens drei Zeilen, ganz im Tooltip) und darunter
die Kennzeichen „Nr. 12“, Status, „Dringend“, „Art › Bereich“ und die
Gemeinde als Verweis. Die Gemeinde steht nur da, wenn der Vorgang ihr
zugeordnet ist; sonst die Marke „Keine Gemeinde“. Bei einer Anfrage steht
statt der Art „Noch nicht angelegt“, solange die Gemeinde nicht angelegt ist,
dazu Konfis und Teamer:innen. Fehlt bei Frage, Fehler oder Wunsch der
Bereich, steht „Bereich fehlt“. „Keine Gemeinde“ und „Bereich fehlt“ öffnen
Einordnen. Rechts stehen alle Aktionen: Löschen und Archivieren als Symbole,
Einordnen, bei einer Anfrage Ablehnen (Kreis mit x), die Nebenknöpfe und
rechts außen der eine Hauptknopf. Wie schmal sie werden, richtet sich nach
der Breite des Lesebereichs: Unter 760 px werden Einordnen und „Lizenz
ändern“ zu Symbolen, unter 600 px trägt nur der Hauptknopf Text, und der
Kreis der Art entfällt (bei 1280 px Fensterbreite neben der Liste). In der
App heißt die Kopfzeile „Vorgang 12“ bzw. „Anfrage 12“ und trägt Einordnen
und Archivieren bzw. Wiederherstellen als Symbole; darunter der farbige Kopf
mit dem Kreis der Art, dem Betreff, „Nr. 12 · Gemeinde“ und drei Kacheln.

**Stand.** Ein Satz sagt, wer dran ist und seit wann; der Hauptknopf folgt
ihm. In der App ist es die Karte „Stand“ mit den Marken (Status, Dringend,
Art › Bereich; antippen öffnet Einordnen), dem Satz, dem Hauptknopf und
darunter den Nebenknöpfen. Geprüft wird in dieser Reihenfolge; „von außen“
heißt Formular, Anfrage oder eine eingehende Mail, die automatische
Bestätigung zählt nicht als Antwort des Supports.

| Fall | Satz | Hauptknopf | Nebenknöpfe |
|---|---|---|---|
| Anfrage angelegt (im Archiv oder eben angelegt) | „Gemeinde angelegt am …. Benutzername der Gemeindeleitung: … – Benutzername und Passwort getrennt weitergeben.“ | Gemeinde öffnen | – |
| Anfrage abgelehnt | „Anfrage abgelehnt am …. Sie wird nach 180 Tagen gelöscht; Wiederherstellen holt sie zurück.“ | Wiederherstellen | Gemeinde anlegen |
| sonst erledigt oder im Archiv | „Erledigt am …“ bzw. „Im Archiv seit …“ und „Eine neue Mail holt ihn zurück.“ | Wiederherstellen | – |
| niemand, dem sich antworten ließe | „Niemand, dem sich antworten ließe: keine Gemeinde, kein Kontakt.“ (mit der Angabe aus dem Formular) | Gemeinde zuordnen (öffnet Einordnen) | – |
| die jüngste Nachricht kam von außen | „{Name} wartet seit {Zeit} auf Antwort.“ | Antworten | bei einer Anfrage Gemeinde anlegen und Ablehnen, sonst Erledigt |
| Anfrage nicht angelegt, der Support schrieb zuletzt | „Support hat {Zeit} geantwortet. Anlegen oder ablehnen?“ | Gemeinde anlegen | Ablehnen, Antworten |
| Status Wartet | „Wartet seit {Zeit} auf {Name}.“, ab 7 Tagen „… – nachfassen?“ | Erledigt, ab 7 Tagen Antworten | Antworten bzw. Erledigt |
| sonst | „Support ({Konto}) hat {Zeit} geantwortet.“ bzw. „Angelegt von …, noch ohne Nachricht.“ | Erledigt | Antworten |

Bei Wartet zählt die Zeit ab dem Wechsel auf Wartet oder ab der jüngsten
Mail des Supports, je nachdem, was später kam: Wer nachfasst und „Danach“ auf
Wartet lässt, wartet ab dieser Mail wieder sieben Tage. „Gemeinde angelegt“
steht, solange der Vorgang der angelegten Anfrage im Archiv liegt; holt
Wiederherstellen oder eine neue Mail ihn zurück, gilt die Tabelle wie für
jeden offenen Vorgang.

Im Vorgang „Lizenz und Abrechnung“ kommen eine Zeile zur Lizenz und „Lizenz
ändern“ als Nebenknopf dazu (unten, „Die Lizenz im Vorgang ändern“). Antworten
und Einordnen sind immer erreichbar; der Satz nennt nur Tatsachen.

**Notiz.** Die interne Notiz steht unter dem Stand. Im Browser zeigt sie
höchstens drei Zeilen, dann „mehr“; **Bearbeiten** macht ein Feld daraus,
„Notiz speichern“ erscheint erst nach einer Änderung. Ist sie leer, steht dort
nur **+ Interne Notiz**. In der App ist sie die letzte Zeile der Karte „Stand“
und öffnet das Fenster „Notiz“. Eine Notiz, die noch nicht gespeichert ist,
überlebt das Neuladen der Daten, etwa nach einer Änderung an anderer Stelle,
nicht aber das Neuladen der Seite.

**Kennzahlen.** Drei Zahlen: Mails, Neu und Tage offen, bei einer Anfrage
Konfis, Teamer:innen und Mails; bei 1 in der Einzahl („1 Mail“, „1 Tag
offen“). „Mails“ zählt das Anliegen aus dem Formular
bzw. die Nachricht der Anfrage mit, wie der Verlauf. Die App zeigt sie als
Kacheln im Kopf, der Browser nur, wenn der Lesebereich zwei Spalten hat (ab
960 px, also beim breiten Lesen), dann flach („6 Mails“) neben dem Stand;
schmaler stehen Konfis und Teamer:innen einer Anfrage in den Kennzeichen.

**Verlauf.** Überall — Vorgang und Posteingang, Browser und App — steht der
Schriftwechsel flach und zeitlich geordnet, das Älteste oben, ohne Einrückung
und ohne eigene Gesprächstitel:

- Oben steht das Anliegen aus dem Formular bzw. die Nachricht der Anfrage mit
  der Marke „Formular“ bzw. „Anfrage“. Es ist offen, bis der Support
  antwortet, danach zwei Zeilen mit „ganz lesen“.
- Offen sind die jüngste Mail und jede, die beim Öffnen ungelesen war (Marke
  „Neu“); jede andere ist eine Zeile mit Kreis, Absender, Zeit und dem Anfang
  des Textes. Ab drei eingeklappten Mails in Folge stehen sie als „N frühere
  Mails · Absender · k Anhänge“; Ungelesenes steht nie darin. „Alle
  aufklappen“ öffnet alles, „Alle einklappen“ stellt das Bild beim Öffnen
  wieder her. Zitate und Signatur (alles nach `-- `) bleiben eingeklappt.
- Was der Support gesendet hat, heißt „Support“ mit dem Kreis KQ, klein dazu
  das Konto, das es schrieb, und „Gesendet“. Wird die Zeile eng (am Handy),
  kürzt zuerst das Konto; „Support“ bleibt ganz. Antwortet eine Mail nicht
  auf die direkt davor, steht klein „Antwort auf {Name}, {Zeit}“; weicht ihr
  Betreff vom Betreff des Vorgangs ab, steht er als „Betreff: …“ dabei.
- Jede offene Mail hat ein Menü (···): „In anderen Vorgang verschieben“, „In
  neuen Vorgang herauslösen“ (nur im Vorgang) und „Kopfzeilen zeigen“.
- Unter der jüngsten Mail steht die Antwortzeile — im Browser „Antwort an
  {Name} schreiben …“ mit dem Postfach, in der App „Antwort an {Name} …“. Sie
  nennt nur, wen der Editor vorwählt, sonst „Antwort schreiben …“. Ohne
  Antwortweg ist sie gesperrt.

Die Regeln stehen in `frontend/src/utils/mailGespraeche.ts`, die Darstellung
in `frontend/src/components/support/MailGespraeche.tsx`.

**Angaben** stehen offen als Karten — im Browser neben dem Verlauf, sobald
der Lesebereich zwei Spalten hat, sonst darunter; in der App als Abschnitte
nach dem Verlauf. Jede Angabe steht einmal:

| Karte | Inhalt |
|---|---|
| Lizenz | nur im Vorgang „Lizenz und Abrechnung“, als erste Karte (unten) |
| Anfrage | Gemeinde (angefragt), Kirchenkreis › Landeskirche mit „steht in der Struktur“ bzw. „fehlt noch“ und dann **Als Kirchenkreis anlegen**, Wunschlizenz mit Preis, Eingang |
| Kontakt | Person mit Funktion, E-Mail (mailto) mit **Im Vorgang antworten** — der Editor öffnet sich mit dieser Adresse —, bei einer Anfrage die Mobilnummer (tel:), der Eingang (Herkunft), bei einem vom Support angelegten Vorgang „Angelegt von …“; ohne Zuordnung „Nicht zugeordnet – laut Formular: X“ mit **Zuordnen** |
| Gemeinde | nur mit Zuordnung: Laufzeit (die Testphase in den letzten sieben Tagen als Warnung, abgelaufen als Fehler), Konfis, Kirchenkreis › Landeskirche, die Gemeindeleitung je Person mit Name, „Gesperrt“, E-Mail oder „Keine E-Mail“ und letzter Anmeldung bzw. „noch nicht angemeldet“; dazu **Gemeinde öffnen** und **Alle Vorgänge**. In der App ist die Gemeindeleitung eingeklappt. |

## Die Lizenz im Vorgang ändern

Im Vorgang der Art **Lizenz und Abrechnung** — gemeint ist die Bitte einer
Gemeinde um eine Lizenz (Simon, 11.10.2026) — steht als erste Karte
**Lizenz**:

- **Tarif** mit Preis, etwa „Standard — bis 50 Konfis · 99 € pro Jahr“,
  „Testphase — bis 5 Konfis · kostenlos“, „Unbegrenzt“ oder „Eigenes Limit —
  120 Konfis“. Der Tarif ist das Konfi-Limit der Gemeinde (5 Testphase,
  15/50/75/100 Klein bis Groß, leer unbegrenzt, sonst ein eigenes Limit).
- **Konfis** „3 von 5“ (ab 90 % als Warnung, ab 100 % als Fehler), ohne Limit
  „3 · ohne Limit“; **Laufzeit** („Testphase bis 20.10.“, „Lizenz bis …“,
  „Unbegrenzt“, „Testphase abgelaufen“ bzw. „Lizenz abgelaufen“).
- **Wunsch bei der Anmeldung** mit Preis in derselben Schreibweise („Standard
  — bis 50 Konfis · 99 € pro Jahr“), „entspricht dem Tarif“, wenn er
  gleich ist; es ist der Wunsch aus dem Anfrageformular, nicht der dieses
  Anliegens — das Support-Formular hat dafür kein Feld.
- **Zugang** „Gesperrt“, nur bei einer gesperrten Gemeinde.

Laufzeit und Konfis stehen dann nicht noch einmal in der Karte der Gemeinde.
Unter dem Stand-Satz steht eine Zeile wie „Lizenz heute: Testphase bis 20.10.
· bei der Anmeldung gewünscht: Standard.“ (der Wunsch nur, wenn er vom Tarif
abweicht; dazu „Zugang gesperrt“ bzw. „abgelaufen am …“ als Warnung). Ohne
zugeordnete Gemeinde sagt sie, dass sich die Lizenz erst ändern lässt, wenn
eine Gemeinde zugeordnet ist; „Ändern“ ist dann gesperrt, und statt „Lizenz
ändern“ steht „Gemeinde zuordnen“.

**Lizenz ändern** (Nebenknopf im Kopf bzw. in der Karte „Stand“, „Ändern“ an
der Karte) öffnet im Browser einen Dialog, in der App ein Fenster:

- **Wunschlizenz übernehmen: …** — nur, wenn ein Wunsch bekannt ist, vom
  Tarif abweicht oder die Testphase noch läuft, und der Entwurf ihn noch
  nicht trägt. Setzt den Tarif auf die Konfi-Zahl des Wunsches (Verbund:
  unbegrenzt), schaltet die Testphase aus und die Laufzeit auf ein Jahr ab
  heute bzw. ab Laufzeitende, wenn die Lizenz noch läuft.
- **Tarif** wie im Formular der Gemeinde, mit „Eigenes Limit…“.
- **Laufzeit**: unverändert, 1 Jahr ab heute, 1 Jahr ab Laufzeitende (nur,
  wenn das Ende in der Zukunft liegt), 30 Tage Testphase, unbegrenzt oder ein
  eigenes Datum; ein Jahr sind 365 Tage.
- **Testphase (Hinweis auf den Startseiten)** — ohne Enddatum immer aus; das
  Limit folgt dem Schalter wie beim Anlegen einer Gemeinde.
- Darunter die **Vorschau** „Danach: …“, mit einer Warnung, wenn schon so
  viele oder mehr Konfis angelegt sind als das neue Limit (bis 5 darüber mit
  Bestätigung, danach gesperrt; `backend/utils/konfiLimit.js`). Ein
  ungültiges Limit oder ein fehlendes Enddatum steht an ihrer Stelle, im
  Browser wie in der App, und Speichern ist gesperrt. Ist die Gemeinde
  gesperrt (nach Ablauf sperrt sie der nächtliche Lauf), sagen Vorschau und
  Erfolgsmeldung: „Der Zugang der Gemeinde bleibt gesperrt – freigeben lässt
  er sich im Formular der Gemeinde.“ „Lizenz ändern“ schreibt den Zugang,
  wie er ist ([offene-befunde.md](../offene-befunde.md), „Lizenz ändern“ bei
  einer gesperrten Gemeinde).
- Ein Link **Alle Angaben der Gemeinde bearbeiten** führt ins volle Formular.

**Speichern** ist gesperrt ohne Änderung, ohne Netz und während des
Speicherns; eine Rückfrage gibt es nicht, die Vorschau sagt, was geschieht.
Gespeichert wird über die bestehenden Routen der Gemeinde: Ein geänderter
Tarif geht mit `PATCH /api/organizations/:id/limit`, eine geänderte Laufzeit
oder Testphase mit `GET` und danach `PUT /api/organizations/:id` mit allen
Stammfeldern aus der frischen Antwort — der PUT schreibt sie immer, ein
Teilkörper würde sie leeren. Dabei wird die Erinnerung an das Lizenzende
zurückgesetzt; die nächste kommt wieder. Klappt der Tarif, die Laufzeit aber
nicht, steht dort „Tarif gespeichert, Laufzeit nicht – bitte erneut
speichern.“, und der Entwurf bleibt. Liefert die Gemeinde keine lesbaren
Stammdaten, ist der Teil „Laufzeit“ gesperrt, mit Verweis auf das Formular
der Gemeinde. Wie im Formular der Gemeinde ist das ein Lesen, Ändern,
Schreiben: Ändert jemand die Stammdaten zwischen GET und PUT, geht diese
Änderung verloren.

## Ein Anliegen über das Support-Formular

Auf konfi-quest.de steht unter **„Hilfe und Support“** (`#support`) das
Formular für Gemeinden, die Konfi Quest schon nutzen; unter „Mehr“ führt
„Hilfe und Support“ für Gemeindeleitung und Leitung dorthin. Pflicht sind
**Gemeinde, Name, E-Mail-Adresse, Art, Betreff, Beschreibung** und die
Einwilligung; bei Frage, Fehler und Wunsch auch der **Bereich**. Funktion ist
freiwillig, die Dringlichkeit steht auf Normal. Die Art „Neue Gemeinde“ gibt
es hier nicht — dafür ist das Anfrageformular daneben.

Der Server (`POST /api/anliegen`, ohne Anmeldung) legt einen Vorgang mit
Quelle `formular` und Status **Neu** an und antwortet `201 { ok: true }` —
ohne Nummer. Gehört die Adresse zu genau einem aktiven Konto (nicht Konfi)
mit Gemeinde, ist der Vorgang gleich dieser Gemeinde zugeordnet, sonst ordnet
der Support von Hand zu. Danach geht von support@ eine Bestätigung mit festem
Text hinaus, die nur die Nummer nennt, mit `[Vorgang N]` im Betreff; eine
Antwort darauf landet im Vorgang. Grenzen gegen Missbrauch und das
unsichtbare Feld `website` wie beim Anfrageformular (unten). Was gespeichert
wird und wie lange, steht in der Datenschutzerklärung, Abschnitt 9e.

## Eine Anfrage kommt an

Die verantwortliche Person einer neuen Gemeinde füllt das Anfrageformular auf
konfi-quest.de aus. Pflicht sind **Gemeinde, Name und E-Mail-Adresse** und
das Häkchen zur Einwilligung; dazu können Kirchenkreis, Landeskirche,
Funktion, Mobilnummer, die ungefähre Zahl der Konfis und der Teamer:innen, die
**gewünschte Lizenz** und eine Nachricht kommen. Der Server (`POST /api/anfragen`, ohne Anmeldung)
speichert die Anfrage mit dem Status **neu** und dem Zeitpunkt der
Einwilligung und legt dazu einen Vorgang der Art **Neue Gemeinde** an.
Anfrage und Vorgang teilen Notiz und Status: Neu und In Arbeit gelten für
beide, Wartet ist für die Anfrage In Arbeit; Erledigt ist für eine noch nicht
angelegte Anfrage **Abgelehnt** (dann gilt deren Frist von 180 Tagen,
unten). Angelegt und Abgelehnt der Anfrage sind für den Vorgang Erledigt.

Danach gehen zwei Mails hinaus:

- **an die anfragende Adresse** eine Bestätigung mit festem Text — ohne
  irgendeine Eingabe aus dem Formular. Das Formular ist öffentlich; mit
  eingesetzten Feldern ließe sich über unseren Server beliebiger Text an
  fremde Adressen schicken.
- **an jedes aktive Super-Admin-Konto mit E-Mail-Adresse** ein Hinweis mit
  Kennung, Gemeinde, Kirchenkreis und Landeskirche — ohne Kontaktdaten und
  ohne Nachricht. Die stehen in der Support-Ansicht.

Scheitert eine Mail, bleibt die Anfrage gespeichert. Im Server-Protokoll
steht nur „Gemeinde-Anfrage 12 eingegangen" und bei Fehlern die Kennung mit
dem Fehlercode — keine Daten der Anfrage.

**Gegen Missbrauch:** Höchstens 5 angenommene Anfragen je Stunde von einer
Verbindung (Client-IP) und 3 je Tag für dieselbe E-Mail-Adresse, danach
antwortet der Server mit 429 und dem Hinweis auf moin@konfi-quest.de. Ein
unsichtbares Feld (`website`) fängt Programme ab: Ist es gefüllt, bekommt der
Absender dieselbe Antwort wie ein Mensch, gespeichert und verschickt wird
nichts.

## Anfragen bearbeiten

**Woher sie kommen:** Auf konfi-quest.de steht im Schlussabschnitt das
Formular „Konfi Quest für eure Gemeinde anfragen"; die Knöpfe „Kostenlos
testen" weiter oben führen dorthin. Es prüft Pflichtfelder, E-Mail-Adresse,
Mobilnummer und Zahlen vorab, sendet an `POST /api/anfragen` und sagt, was
herauskam: Dank, die Felder, die der Server bemängelt (400), „zu viele
Anfragen" (429) oder „später noch einmal" — die letzten beiden mit
moin@konfi-quest.de als Ausweg. Was der Server dabei tut (Mails, Grenzen
gegen Missbrauch, unsichtbares Feld gegen Programme) und wie lange eine
Anfrage bleibt, steht in der API-Doku und in der Datenschutzerklärung,
Abschnitt 9c.

**Liste:** Anfragen stehen unter **Vorgänge** mit der Art „Neue Gemeinde“
(Filter Art). Ein Eintrag öffnet den Vorgang mit den Angaben der Anfrage.

**Die Wunschlizenz** (Simon, 03.10.2026: „die Leute wählen ihre
Wunschlizenz"): Im Formular wählt die Gemeinde Klein (bis 15 Konfis),
Standard (50), Plus (75), Groß (100), Verbund (bis 4 Gemeinden) oder „Noch
offen". Die Testphase läuft trotzdem mit 5 Konfis; danach steht das Limit auf
der Konfi-Zahl der gewählten Lizenz — beim Verbund und ohne Wahl auf
unbegrenzt ([gemeinde-anlegen.md](gemeinde-anlegen.md#konfi-limit-testphase-5-danach-die-wunschlizenz)).
Die Werte stehen einmal in `backend/utils/lizenzen.js`; Migration 192 hält sie
mit einem CHECK fest.

**Der Vorgang einer Anfrage** zeigt die Angaben in den Karten „Anfrage“ und
„Kontakt“ (E-Mail und Mobilnummer als Verweis, [oben](#einen-vorgang-lesen));
Status und Notiz teilt er mit der Anfrage ([oben](#eine-anfrage-kommt-an)).
„Angelegt“ setzt allein das Anlegen der Gemeinde. Solange sie nicht angelegt
ist, sind Gemeinde anlegen, Ablehnen und Antworten die Knöpfe des Stands;
„Danach“ bietet beim Antworten nur Wartet und In Arbeit an, weil Erledigt die
Anfrage ablehnen würde.

**Ablehnen** — im Browser das Symbol mit dem Kreis und x im Kopf (Tooltip
„Anfrage ablehnen“), in der App ein Knopf in der Karte „Stand“ — fragt
zuerst: „Anfrage ablehnen? Der Vorgang wird erledigt und archiviert, die
Anfrage gilt als abgelehnt und wird nach 180 Tagen gelöscht. Eine Absage-Mail
geht dabei nicht hinaus. Wiederherstellen holt beides zurück.“ Erst nach
„Ablehnen“ setzt die Seite den Vorgang auf Erledigt; der Server lehnt die
Anfrage dabei ab. Eine Absage schreibt man vorher als Antwort; eine Antwort
auf die abgelehnte Anfrage lässt sie abgelehnt. **Wiederherstellen** holt
Vorgang und Anfrage zurück in Arbeit. Eine abgelehnte Anfrage lässt sich auch
anlegen: „Gemeinde anlegen“ steht dann neben „Wiederherstellen“.

**Gemeinde anlegen** öffnet im Browser einen breiten Dialog in zwei Spalten —
oben eine Zeile aus der Anfrage („A. Beispiel (Diakonin) · 38 Konfis · 9
Teamer:innen · Wunsch: Standard“), links Gemeinde und Tarif, rechts die erste
Gemeindeleitung —, in der App ein eigenes Fenster. Vorbelegt ist alles aus
der Anfrage:

| Feld | Vorbelegung |
|---|---|
| Name der Gemeinde | die Gemeinde aus der Anfrage; daraus entsteht der Systemname wie beim Anlegen unter Gemeinden ([gemeinde-anlegen.md](gemeinde-anlegen.md)) |
| Kirchenkreis | gesucht in der Struktur, ohne Groß/klein und ohne vorangestelltes „Kirchenkreis" („Dithmarschen" findet „Kirchenkreis Dithmarschen"); gibt es den Namen in zwei Landeskirchen, entscheidet die Landeskirche der Anfrage. Steht er noch nicht in der Struktur, legt **„Als Kirchenkreis anlegen"** ihn an (mit der Landeskirche, wenn es sie gibt) und wählt ihn aus. |
| Ansprechperson, E-Mail, Telefon | Name, E-Mail und Mobilnummer aus der Anfrage |
| Tarif | Auswahl mit Preis wie unter Gemeinden: Testphase 5 (kostenlos), Klein bis Groß, **Unbegrenzt** oder ein eigenes Limit. Vorbelegt mit 5, wie auf der Startseite für die Testphase zugesagt. Schaltet man die Testphase aus, wird daraus die Konfi-Zahl der Wunschlizenz (ohne Wunsch und beim Verbund: unbegrenzt) und beim Wiedereinschalten wieder 5 — ein selbst eingetragener Wert bleibt stehen. Regel wie unter Gemeinden: [gemeinde-anlegen.md](gemeinde-anlegen.md#konfi-limit-testphase-5-danach-die-wunschlizenz) |
| Testphase (30 Tage) | an: Zugang 30 Tage ab heute mit Hinweis auf den Startseiten; aus: ohne Ablaufdatum |
| Erste Gemeindeleitung | Benutzername als Vorschlag aus dem Namen („Anna Müller" → `anna.mueller`), Anzeigename und E-Mail aus der Anfrage; das Passwort trägt man ein oder lässt es vorschlagen |

„Als Kirchenkreis anlegen“ steht auch in der Karte „Anfrage“, wenn der
Kirchenkreis dort „fehlt noch“ heißt. Vor dem Absenden prüft der Dialog
Pflichtfelder, Benutzername und Passwortregel; dann kommt eine Rückfrage —
im Browser als zweites kleines Fenster über dem Dialog („Gemeinde anlegen?“
mit Name, Gemeindeleitung und Benutzername; **Abbrechen** lässt alles
stehen), in der App als Rückfrage der App. Beim Anlegen ist er gesperrt. **Anlegen** ruft
`POST /api/support/anfragen/<id>/anlegen`: Gemeinde und erste Gemeindeleitung
entstehen in einer Transaktion mit derselben Logik wie beim Anlegen unter
Gemeinden, die Anfrage steht danach auf **Angelegt**. Der Dialog schließt
sich; der Stand sagt „Gemeinde angelegt am …“ mit dem Benutzernamen der
Gemeindeleitung — auch nach dem Neuladen — und hat **Gemeinde öffnen** als
Hauptknopf. Ist der Benutzername schon vergeben, kommt die Meldung des
Servers, und nichts wird angelegt.

Wer den Dialog mit eigenen Eingaben schließt (Escape, Klick daneben, ✕,
Abbrechen), wird gefragt: „Eingaben verwerfen?“ — sonst ginge etwa ein
vorgeschlagenes Passwort verloren. Ohne eigene Eingabe schließt er ohne
Frage; ein Kirchenkreis, den „Als Kirchenkreis anlegen“ eben angelegt hat,
zählt zur Vorbelegung. „Verwerfen“ stellt die Vorbelegung wieder her, mit der
Struktur von jetzt.

Danach wie bei jeder neuen Gemeinde: Benutzername und Passwort auf getrennten
Wegen weitergeben ([gemeinde-anlegen.md](gemeinde-anlegen.md#was-danach-passiert)).
Die Vorlage zur Einwilligung der Eltern steht für die Gemeinde unter
konfi-quest.de/einwilligung.

## Die Struktur pflegen

Kirchenkreis und Landeskirche sind Zuordnungen an der Gemeinde, vor allem für
die Kennzahlen; Rechte hängen daran nicht. Im Bereich **Struktur**:

- Landeskirche oder Kirchenkreis **anlegen** (oben, ein Kirchenkreis gleich
  mit seiner Landeskirche oder ohne).
- **Bearbeiten** (Stift): umbenennen; bei einem Kirchenkreis auch die
  Landeskirche wechseln oder entfernen. Kirchenkreise ohne Landeskirche stehen
  unten gesammelt.
- **Löschen** (Papierkorb): Eine Landeskirche, an der noch Kirchenkreise
  hängen, lässt sich nicht löschen — die Seite sagt das, bevor etwas
  passiert. Ein gelöschter Kirchenkreis nimmt seinen Gemeinden nur die
  Zuordnung.

Die Zuordnung einer Gemeinde ändert man unter **Gemeinden** › Gemeinde ›
Bearbeiten › **Kirchenkreis** (Auswahl aus der Struktur); die Landeskirche
ergibt sich daraus. Der Name wird zugleich in die alte Textspalte geschrieben,
die ältere Apps lesen.

**Die alte Textspalte.** Die Apps bis 2.3.0 kennen nur den Freitext
`organizations.kirchenkreis`. Damit sie weiter das Richtige zeigen, steht
dort immer der Name des zugeordneten Kirchenkreises: beim Zuordnen, beim
Umbenennen des Kirchenkreises für alle seine Gemeinden, beim Lösen und Löschen
wird er leer. Schickt eine alte App beim Speichern einer Gemeinde einen
anderen Text, gilt der Text, und die Zuordnung endet — derselbe Text (ohne
Groß/klein) lässt sie stehen.

**Übernahme der vorhandenen Angaben** (Migration 191, einmal beim Deploy):
Jeder Freitext wird ein Kirchenkreis ohne Landeskirche, gleiche
Schreibweisen ohne Groß/klein und Randleerzeichen werden einer, und die
Gemeinden werden verknüpft. Danach die Kirchenkreise in der Support-Ansicht
ihrer Landeskirche zuordnen, Tippvarianten zusammenführen (Gemeinden dem
richtigen Kirchenkreis zuordnen, den doppelten löschen) und Gemeinden ohne
Angabe einordnen — auch den Dom Schwerin.

Vor dem Deploy in Produktion lesend prüfen, welche Kirchenkreise entstehen:

```sql
SELECT id, display_name, kirchenkreis FROM organizations ORDER BY id;
SELECT lower(btrim(kirchenkreis)) AS k, COUNT(*) FROM organizations
 WHERE NULLIF(btrim(kirchenkreis), '') IS NOT NULL GROUP BY 1 ORDER BY 1;
```

## Support-Konten verwalten

Im Bereich **Support-Konten** stehen alle Konten ohne Gemeinde mit Status,
letzter Anmeldung und den Gemeinden, in denen sie Gast sind.

| Was | Wie | Wirkung |
|---|---|---|
| Anlegen | oben rechts **Plus**: Benutzername, Anzeigename, E-Mail (freiwillig), Passwort | Benutzername systemweit frei, sonst Hinweis mit der Meldung des Servers |
| Passwort setzen | Knopf am Konto | alle Sitzungen des Kontos enden; beim eigenen Konto erst eine Rückfrage, danach neu anmelden |
| Sperren / Entsperren | Knopf am Konto, Sperren mit Rückfrage | gesperrt: Anmeldung unmöglich, alle Sitzungen enden sofort |
| Löschen | Knopf am Konto, mit Rückfrage | dieselbe Kontolöschung wie überall |

Das **eigene Konto** bietet die Ansicht weder zum Sperren noch zum Löschen an.
Das **letzte aktive Super-Admin-Konto** lässt sich weder sperren noch löschen;
dann bleibt ein Hinweis „Nicht möglich" mit dem Satz des Servers stehen, bis
man ihn wegdrückt. Regeln und API stehen in [support-konto.md](support-konto.md).

## Mails beantworten und einsortieren

Grundlage: Simons Entscheidungen vom 03.10.2026
([planung/support-mail.md](../planung/support-mail.md)); eingerichtet am 03.10.2026 mit
Auftrag 14 (Ergebnis in der Git-Historie).

**Zwei Postfächer, zwei Rollen.** `moin@konfi-quest.de` ist für Anfragen und
Erstkontakt — über dieses Postfach gehen auch schon die Systemmails (dieselbe
Anmeldung wie `SMTP_USER`). `support@konfi-quest.de` ist für Hilfe an
bestehende Gemeinden. Antworten auf eine Anfrage gehen von moin@, Antworten an
eine Gemeinde von support@.

**Abholen.** Der Cron-Leader liest beide Postfächer alle zwei Minuten — nur
lesend: Er löscht nichts, verschiebt nichts und markiert nichts als gelesen.
Im Mailprogramm bleibt alles, wie es war. Übernommen wird ab Einrichtung,
nicht der Altbestand. Auf einer Instanz mit `RUN_BACKGROUND_JOBS=false` wird
weder abgeholt noch versendet. Den Zustand zeigt der Bereich **Posteingang**
oben in einer Zeile („moin@ und support@ … zuletzt abgeholt …“); ist ein
Postfach nicht eingerichtet, auf diesem Server aus oder meldet einen Fehler,
steht dort der Grund — im Browser je Postfach ein Kasten, in der App eine
Zeile je Postfach („support@ · Fehler beim Abholen: …“); zwei Postfächer mit
demselben Grund teilen sich eine Zeile („moin@ und support@ · Zugangsdaten
fehlen: …“).

Übernommen werden der Text und von Anhängen nur Name, Typ und Größe. Eine
Mail über 10 MB (`MAX_MAIL_GROESSE` in `services/mailAbholung.js`) lädt der
Server gar nicht herunter — die Backends haben 512 MB Speicher. In Konfi Quest
stehen dann Absender, Betreff, die Anhänge mit geschätzter Größe und der
Hinweis „Diese Mail ist zu groß für die Übernahme … Bitte im Mailprogramm
ansehen."

**Zuordnen.** Eine neue Mail kommt, in dieser Reihenfolge,

1. in den Vorgang der Mail, auf die sie antwortet (Kopfzeilen
   `In-Reply-To`/`References`),
2. zu `[Vorgang 12]`, wenn das im Betreff steht; die alten Kennungen
   `[Anfrage 12]` und `[Gemeinde 7]` führen zum Vorgang der Anfrage bzw. zum
   jüngsten offenen Vorgang der Gemeinde,
3. bei moin@ zum Vorgang der jüngsten nicht abgelehnten Anfrage mit derselben
   Absenderadresse — so landen auch Antworten auf die Bestätigungsmail
   einer Anfrage richtig,
4. bei support@ in einen **neuen Vorgang** der Gemeinde, wenn genau ein
   aktives Konto (nicht Konfi) mit genau einer Gemeinde diese Adresse hat,
5. sonst in den **Posteingang**.

Ein archivierter Vorgang, zu dem eine Mail kommt, kehrt mit dem Status In
Arbeit zurück.

Der **Posteingang** zeigt nur die eingehenden Mails beider Postfächer, die
keinem Vorgang zugeordnet und nicht archiviert sind; Filter „Alle“,
„Ungelesen“, „moin@“, „support@“ und „Archiv“. In der App steht der Betreff
über die ganze Breite, darunter Absender, Zeit und Anhänge, zwei Zeilen der
Mail und das Postfach als Marke.

**Eine Mail im Posteingang** hat oben den Kern des Betreffs (ohne „Re:“,
„AW:“ und `[Vorgang 12]`), darunter „Von Name <adresse> · an support@“, die
Zeit und, wenn es sie gibt, die Zahl der Mails im Faden und der Anhänge; im
Browser mit dem Kreis der Initialen davor, in der App mit den Kacheln Mails,
Neu und Anhänge und dem Postfach als Marke in der Karte „Stand“. Darunter
steht der Verlauf wie im Vorgang, ohne Menü zum Verschieben, mit der
Antwortzeile unter der jüngsten Mail.

Gehört die Absenderadresse zu genau einem aktiven Konto der Leitung oder des
Teams in genau einer Gemeinde (dieselbe Regel wie beim Zuordnen, Schritt 4),
steht über dem Verlauf, in der App in der Karte „Stand“: „Absender gehört zu
Test-Gemeinde · 2 offene Vorgänge“. Hat die Gemeinde einen offenen Vorgang,
steht daneben **In Vorgang N einsortieren** — N ist der jüngste offene; ein
Klick legt die Mail ohne Dialog dorthin und öffnet den Vorgang. Steht ein
ungesendeter Entwurf da, fragt der Browser vorher nach. Konfis zählen dabei
nicht; eine Adresse mit mehreren Konten oder Gemeinden ist nicht eindeutig,
dann fehlt die Zeile.

Je Mail:

- **Einsortieren** — der Hauptknopf, denn der Posteingang ist zum Zuordnen
  da — in einen bestehenden Vorgang (mit Suche) oder in einen neuen mit Art,
  Bereich, Dringlichkeit, Betreff und Gemeinde; der ganze Faden geht mit,
  soweit er noch im Posteingang liegt. Kennt der Server den Absender, sind
  der jüngste offene Vorgang seiner Gemeinde und, für einen neuen Vorgang,
  die Gemeinde vorgewählt. Danach öffnet sich der Vorgang mit dieser Mail.
- **Antworten** daneben, an den Absender der jüngsten eingehenden Mail des
  Gesprächs, die noch im Posteingang liegt, von ihrem Postfach — an die
  Person, die der Editor nennt, auch wenn man eine ältere Mail des Gesprächs
  geöffnet hat.
- **Archivieren** (aus dem Eingang ins Archiv, wiederherstellbar) und
  **Löschen** (mit Rückfrage; nur aus Konfi Quest, im Postfach bleibt sie) —
  im Browser als Symbole im Kopf, in der App Archivieren oben in der
  Kopfzeile und „Mail löschen“ als einziger Knopf ganz unten.

Im Archiv sagt ein Satz: „Im Archiv seit … · wird nach 180 Tagen gelöscht ·
Einsortieren holt sie zurück.“ Der Hauptknopf bleibt Einsortieren — der
Server holt eine archivierte Mail dabei selbst aus dem Archiv —, daneben
steht Wiederherstellen; Antworten und Archivieren entfallen.

Im Browser lassen sich mehrere Mails wählen und gemeinsam archivieren,
wiederherstellen oder löschen (`POST /api/support/mail/sammel`). Eine Mail
zu einer Anfrage zählt als Bewegung: Die 365-Tage-Frist beginnt neu.

**Eine Mail, die schon in einem Vorgang liegt,** öffnet sich dort: Die Seite
der Mail (`/admin/support/post/5`) ersetzt sich durch
`/admin/support/vorgaenge/2?mail=5`, so dass „Zurück“ nicht auf ihr landet.
Im Vorgang steht die Mail aufgeklappt, in die Mitte gerollt und zwei
Sekunden hervorgehoben, bei jedem Betreten der Seite wieder. Weitergeleitet
wird, was schon beim Öffnen woanders lag. Wird die gewählte Mail im Browser
erst danach anderswo einsortiert (anderer Reiter, Handy, zweite Person),
bleibt der Posteingang stehen; der Lesebereich sagt „Die Mail liegt
inzwischen in Vorgang N.“, und **Im Vorgang N öffnen** führt dorthin. Gehört eine Mail
nur zu einer Anfrage oder Gemeinde (ältere Server), führt die Seite zur
Anfrage bzw. zu den Vorgängen der Gemeinde. Archivieren und Löschen gibt es
nur im Posteingang; der Server lehnt beides für Mails in einem Vorgang ab.
Wer eine Mail umsortieren will, nimmt das Menü (···) der Mail im Vorgang:

- **In anderen Vorgang verschieben** — nur diese Mail geht in den gewählten
  Vorgang, der eigene steht nicht zur Wahl, und der Ausgangsvorgang bleibt
  bestehen, auch wenn er leer wird.
- **In neuen Vorgang herauslösen** — dieselbe Wahl mit einem neuen Vorgang,
  der Betreff ist mit dem Kern des Betreffs der Mail vorbelegt.

Titel und Knopf nennen die Handlung, in App und Browser gleich; im Browser
nennt der Dialog dazu den Kern des Betreffs.

**Antworten.** Über **Antworten** (Haupt- oder Nebenknopf), die Antwortzeile
unter der jüngsten Mail oder **Im Vorgang antworten** an einer Adresse in
den Karten. Im Browser öffnet sich ein kompakter Editor an der Stelle der
Antwortzeile, direkt unter der jüngsten Mail; der Lesebereich rollt nur so
weit, dass das Ende des Editors im Bild ist, und der Fokus steht im Text.
Verwerfen und Senden geben den Fokus an die Antwortzeile zurück. In der App
öffnet sich das Fenster „Antworten“; oben steht „Du antwortest auf · Name ·
Zeit“ mit drei Zeilen der Mail, „ganz lesen“ zeigt sie ganz. Der Editor:

- **An** — wer im Vorgang geschrieben hat, dazu Kontakt, Anfrage und
  Gemeindeleitung, je mit lesbarer Herkunft: „schrieb uns“, „Kontakt aus dem
  Formular“, „aus der Anfrage“, „Gemeindeleitung“, „aus früheren Mails“.
  Vorgewählt ist die Adresse von „Im Vorgang antworten“, sonst der Absender
  der jüngsten eingehenden Mail, sonst der Kontakt — wenn die Adresse zur
  Wahl steht. Gibt es nur eine Adresse, steht eine feste Zeile „An … · von
  …“; im Posteingang ebenso.
- **Betreff** — „Re: “ und der Kern des Betreffs der letzten Mail, ohne
  gehäufte Vorsilben (Re, AW, Antw, WG, FW, Fwd) und ohne Kennung; die
  Kennung `[Vorgang 12]` hängt der Server an. **Ändern** macht ein Feld
  daraus.
- **Text**, **Baustein einfügen** (füllt die Platzhalter) und die
  eingeklappte **Vorschau mit Fußzeile**.
- **Danach** — der Status, den der Vorgang nach dem Senden bekommt:
  vorgewählt „Wartet auf Rückmeldung“, zur Wahl „In Arbeit“ und „Erledigt“;
  bei einer Anfrage, die noch nicht angelegt ist, ohne Erledigt. Er geht mit
  der Antwort an den Server, der ihn setzt, sobald die Mail hinaus ist — im
  selben Schritt, in dem er sie speichert. Bestätigt der Server ihn nicht,
  setzt die Oberfläche ihn danach eigens; klappt auch das nicht, steht dort
  „Gesendet, Status nicht gesetzt.“ statt der Erfolgsmeldung. „Danach“ gibt
  es nur, solange der Vorgang offen ist: Eine Antwort auf einen erledigten
  oder archivierten Vorgang — auch auf eine abgelehnte Anfrage — lässt den
  Status, wie er ist; zurück holt ihn nur Wiederherstellen.

Vor dem Senden kommt eine Rückfrage; Hinweise zu einem nicht eingerichteten
Postfach, „Senden ist aus“ und die Fehler 502 und 503 stehen im Editor wie
bisher. Der Server setzt die Fußzeile darunter, `[Vorgang 12]` in den
Betreff, die Antwort-Kopfzeilen (`In-Reply-To`, `References`) auf die
beantwortete Mail — im Vorgang die jüngste eingehende, in der App die unter
„Du antwortest auf“ — und legt die Antwort in den Ordner „Gesendet" des
Postfachs (fehlt er, legt er „Sent" an). Eine Anfrage antwortet von moin@,
alles andere von support@. Eine Antwort ohne „Danach“ auf einen neuen
Vorgang setzt ihn auf „In Arbeit". Scheitert der
Versand, wird nichts gespeichert; der Entwurf bleibt stehen.

**Textbausteine und Fußzeile** (Bereich **Textbausteine**): Bausteine für
moin@, support@ oder beide, mit den Platzhaltern `{{name}}`, `{{gemeinde}}`,
`{{lizenz}}`, `{{testphase_bis}}`, `{{benutzername}}`, `{{absender}}`. Was
ein Platzhalter nicht kennt, bleibt sichtbar stehen. Darunter Fußzeile und
Absendername — dort und nicht im Code stehen Namen, weil das Repo öffentlich
ist. Passwörter gehören nie in eine Mail: „Zugangsdaten unterwegs" nennt den
Benutzernamen, das Passwort geht auf anderem Weg.

## Interne Gemeinden

Gemeinden, die nur dem Betrieb dienen — die Test- und Review-Gemeinden für
die Stores —, tragen `organizations.intern = true` (Migration 194). Sie
erscheinen in keiner Liste der Gemeinden und keiner Zahl der Support-Ansicht
und nicht in `GET /api/organizations`; ihre Vorgänge stehen wie alle anderen
unter Vorgänge, weil der Support sie bearbeitet; über ihre Kennung (`/admin/organizations?gemeinde=<id>`,
`GET`/`PUT /api/organizations/:id`) bleiben sie erreichbar, ihre Konten
melden sich an wie bisher. Einen Schalter dafür gibt es bewusst nicht:
Gesetzt wird die Spalte nur direkt in der Datenbank, mit Sicherung vorher —
das erste Mal am 03.10.2026 für die Gemeinden 4, 14 und 15 (Auftrag 15,
Ergebnis in der Git-Historie).

## Was vom Probelauf stehen bleibt

Der Probelauf mit Vorgängen (Auftrag 16, 10.10.2026, Ergebnis in der
Git-Historie) hat zwei Dinge hinterlassen, die **bewusst stehen bleiben**,
bis Simon sie freigibt:

- das **Probe-Postfach des Betriebs** — eine eigene Adresse unter der
  Domain von Konfi Quest, nur für Probeläufe; Zugang beim Betrieb, nicht im
  Repo;
- das Konto **404** „Support-Probe" in der Gemeinde 4 (Leitung, ohne
  Jahrgang, keine weitere Gemeinde, meldet sich nie an) mit der Adresse des
  Probe-Postfachs. Mit ihm lässt sich jederzeit prüfen, dass eine Mail von
  einem Leitungskonto einen neuen Vorgang ihrer Gemeinde eröffnet.

Die Probe-Vorgänge 2–5 sind erledigt und liegen im Archiv; der Vorgang der
Probe-Anfrage 2 gilt als abgelehnt und geht mit ihr nach 180 Tagen, die
anderen nach 730 Tagen. Konto und Postfach gehen nur auf Simons Wort, und
dann zusammen.

## Aufbewahrung

Festgehalten in der Datenschutzerklärung, Abschnitte 9c, 9d und 9e
(`frontend/public/datenschutz.html`); `datenschutzGegenCode.test.ts` hält
Text und Code zusammen.

| Stand | Wie lange |
|---|---|
| neu, in Arbeit | bis zur Entscheidung; bleibt eine Anfrage **365 Tage ohne Änderung** (Status oder Notiz), löscht sie der nächtliche Lauf um 02:00 Uhr (`cleanupUnbewegteAnfragen`, gezählt ab `updated_at`) |
| abgelehnt | **180 Tage nach der Ablehnung**, dann löscht sie der nächtliche Lauf um 02:00 Uhr (`cleanupAbgelehnteAnfragen`, gezählt ab `status_seit`, nicht ab dem Eingang) |
| angelegt | solange die Gemeinde besteht; mit der Gemeinde wird die Anfrage gelöscht |
| Vorgang ohne Anfrage, offen | bis er erledigt ist |
| Vorgang ohne Anfrage, archiviert (auch erledigt) | **730 Tage nach dem Archivieren**, wenn er sich seitdem nicht geändert hat (`cleanupArchivierteVorgaenge`, gezählt ab `archiviert_am` und `updated_at`); eine neue Mail holt ihn vorher zurück |
| Vorgang einer Anfrage | wie die Anfrage; er geht mit ihr |
| Mails zu einem Vorgang, einer Anfrage oder Gemeinde | wie diese; sie gehen mit ihr |
| Mails im Posteingang (keinem Vorgang zugeordnet, auch archivierte) | **180 Tage nach Eingang**, dann löscht sie der nächtliche Lauf aus Konfi Quest; im Postfach selbst bleiben sie |

Vorgänge und Mails lassen sich außerdem jederzeit in der Support-Ansicht
löschen.

Möchte jemand die Löschung vorher, löscht man den Vorgang in der
Support-Ansicht; beim Vorgang einer Anfrage geht die Anfrage mit („Vorgang
und Anfrage löschen“, `vorgaengeLoeschen` in
`backend/utils/supportVorgaenge.js`). Den Zähler gegen Missbrauch
hält der Server je IP-Adresse eine Stunde, je E-Mail-Adresse einen Tag (als
Prüfwert, nicht die Adresse) und löscht ihn danach binnen gut einer Stunde.
