---
titel: Jahrgänge und Kategorien
untertitel: Punkteziele, Konfispruch, Zuständigkeiten
farbe: "#5b21b6"
gruppe: Nachschlagen
---

Der Jahrgang ist die zentrale Schaltstelle. Fast alles, was für eine ganze
Gruppe von Konfis gilt, wird hier eingestellt: die Punkteziele, ob es beide
Punktarten gibt und ob der Konfispruch gewählt werden darf. Außerdem
entscheidet der Jahrgang, wer im Team was sieht.

Kategorien sind davon unabhängig — sie gelten für die ganze Gemeinde und
sortieren Aktivitäten und Events.

## Einen Jahrgang anlegen

**Neue Jahrgänge legt nur die Org-Leitung an.** Die Leitung sieht den Knopf
zum Anlegen nicht; sie bearbeitet und löscht nur die Jahrgänge, die ihr
zugewiesen sind. Welche Rolle was darf, steht im Kapitel
[Rollen und Rechte](05-rollen.md).

Beim Anlegen wählt die Org-Leitung direkt aus, welche Personen der
**Leitung und welche Teamer:innen** Zugriff auf den neuen Jahrgang bekommen.
Die ausgewählten Personen sehen und bearbeiten den Jahrgang sofort und sind
auch gleich im Jahrgangs-Chat. Die Auswahl ist freiwillig — ohne sie entsteht
der Jahrgang zunächst ohne Zuweisungen, und die Org-Leitung vergibt sie später
unter
**Mehr › Benutzer:innen**.

Zwei Jahrgänge dürfen nicht denselben Namen haben („Jahrgang-Name existiert
bereits in dieser Organisation“).

In der Jahrgangsliste steht zu jedem Jahrgang, welche Ziele gesetzt sind, ob
der Spruch freigegeben ist („Spruch frei“ oder „Spruch gesperrt“) und wie es
um den Rückblick steht — „Rückblick gestartet am …“, sobald eine Ausgabe
freigegeben ist, sonst „Noch kein Rückblick“. Angelegt und verwaltet werden
die Ausgaben im Kapitel [Jahresrückblick (Wrapped)](95-wrapped.md).

## Punkteziele festlegen

Für jede der beiden Punktarten stellst du im Abschnitt
„Punkte-Konfiguration“ getrennt ein Ziel ein. Der Schieberegler geht von
**1 bis 20**. Voreingestellt sind 10 und 10.

Das Ziel ist **keine Grenze** — niemand wird gebremst, wenn er es
überschreitet. Es ist der Bezugswert für die Fortschrittsanzeige:

- Die **Ringe im Dashboard** der Konfis füllen sich im Verhältnis zum Ziel
  ([wie Punkte entstehen](40-punkte.md)).
- In der **Konfi-Liste der Leitung** ergibt sich daraus die Fortschrittsfarbe.
- Der [**Jahresrückblick**](95-wrapped.md) rechnet den Zielwert mit ein.

Beim Gesamtfortschritt werden nur die Ziele der **aktiven** Punktarten
addiert. Ist Gemeinde abgeschaltet, ist das Gesamtziel nur das
Gottesdienst-Ziel.

> **Achtung:** Der Bereich 1 bis 20 ist die Begrenzung des Schiebereglers in
> der App. Die Schnittstelle dahinter akzeptiert jeden Wert ab 0 und kennt
> kein Maximum. Über die App kannst du aber weder 0 noch mehr als 20
> einstellen.

## Eine Punktart abschalten

Für jede Punktart gibt es im Abschnitt „Punkte-Konfiguration“ einen Schalter:
„Gottesdienst-Punkte aktiviert“ und „Gemeinde-Punkte aktiviert“. Das ist der
folgenreichste Schalter im ganzen Jahrgang.

### Neue Punkte werden blockiert

Jeder Versuch, Punkte der abgeschalteten Art zu vergeben, wird abgewiesen —
mit der Meldung **„Gottesdienst-Punkte sind für diesen Jahrgang
deaktiviert“** (entsprechend für Gemeinde). Das gilt für
[alle Wege](40-punkte.md#wissen-auf-welchen-drei-wegen-punkte-entstehen): Anträge
genehmigen, Aktivitäten direkt zuweisen, Bonuspunkte vergeben, Anwesenheit
eintragen.

Eine Ausnahme im Verhalten: Trägst du bei einem Event über **„alle
anwesend“** gesammelt Anwesenheit ein, werden betroffene Personen
**stillschweigend übersprungen** statt mit einer Fehlermeldung. Du siehst
also keinen Hinweis, dass jemand keine Punkte bekommen hat.

### Bestehende Punkte bleiben — zählen aber nicht mehr

Die einmal vergebenen Punkte werden **nicht gelöscht**. Sie stehen weiter in
der Datenbank, werden aber überall herausgerechnet:

| | Verhalten bei abgeschalteter Art |
|---|---|
| Gespeicherter Punktestand | bleibt unverändert erhalten |
| Gesamtpunkte und Rangliste | die Art wird als 0 gewertet |
| Level | zählt nur noch die aktive Art |
| Badges auf diese Punktart | werden nicht mehr erreicht |
| Badges auf Gesamtpunkte | rechnen nur mit der aktiven Art |
| Jahresrückblick | nur das aktive Ziel fließt ein |

### Erkennen, was ausgeblendet und was ausgegraut ist

**Ausgeblendet** (ganz weg):

- Der **Ziel-Schieberegler** der Art verschwindet aus dem Bearbeiten-Formular.
- In der Jahrgangsliste fehlt die Zeile „GD-Ziel“ bzw. „Gem-Ziel“.
- **Aktivitäten dieser Art verschwinden vollständig aus der Konfi-Ansicht.**
  Ein Konfi kann sie nicht mehr sehen und nicht mehr melden. Sonst könnte er
  etwas einreichen, das niemand genehmigen kann.

**Ausgegraut** (sichtbar, aber blass) in der Konfi-Detailansicht der Leitung:
Bonuspunkte, Event-Punkte und Aktivitäten der abgeschalteten Art. Ihr seht
also weiter, was einmal vergeben wurde — es ist nur erkennbar außer Kraft.

### Eine Punktart wieder einschalten

**Es muss nichts nachgerechnet werden.** Alle Summen, Level und
Fortschrittsanzeigen werden bei jedem Aufruf frisch berechnet. In dem Moment,
in dem du die Art wieder einschaltest, sind sämtliche alten Punkte wieder da
und zählen wieder — vollständig und sofort.

Eine Einschränkung: **Badges werden nicht rückwirkend vergeben.** Wer
während der Abschaltung eine Badge-Bedingung erfüllt hätte, bekommt es
nicht automatisch nachgereicht. Geprüft wird erst wieder bei der
[nächsten Punktevergabe oder beim Hintergrundlauf](60-badges.md#nachvollziehen-wann-geprueft-wird).

### Mindestens eine Art aktiv lassen

Schaltest du eine Art ab, lässt sich die andere nicht mehr abschalten — der
Schalter ist gesperrt, mit dem Hinweis „Mindestens ein Punkt-Typ muss aktiv
bleiben.“ Dieselbe Regel gilt auch hinter der Oberfläche: Der Versuch, beide
Arten abzuschalten, wird mit **„Mindestens eine Punktart muss aktiv bleiben —
sonst lassen sich in diesem Jahrgang gar keine Punkte mehr vergeben.“**
abgewiesen.

Beim Abschalten prüft das System außerdem, wie viele Konfis bereits Punkte
dieser Art haben, und meldet das zurück. **Diese Warnung wird in der App
nicht angezeigt** — du bekommst sie also nicht zu sehen.

## Den Konfispruch freigeben

Der Schalter **„Konfispruch-Auswahl“** steht im Jahrgang unter „Konfispruch“.
Er ist standardmäßig **an**.

Ist er an, erscheint im Konfi-Dashboard die Konfispruch-Karte, und der Konfi
kann zwischen zwei Wegen wählen:

**Weg 1 — aus der Liste.** Er wählt einen Vers aus einer vorbereiteten Liste
(Psalm 23,1; Jesaja 43,1; Jeremia 29,11; Josua 1,9 und weitere) und dazu eine
**Bibelübersetzung**. Zur Auswahl stehen genau vier:

- Luther 2017
- Bibel in gerechter Sprache
- Gute Nachricht
- Elberfelder

**Weg 2 — eigener Text.** Er tippt seinen Spruch selbst ein. Dabei ist die
**Stellenangabe Pflicht** („Bei einem eigenen Spruch ist die Stellenangabe
(Referenz) verpflichtend“). Die Stellenangabe darf höchstens 100 Zeichen lang
sein, der Text höchstens 1000.

Beides zugleich geht nicht: Wählt der Konfi aus der Liste, wird ein zuvor
eingetippter Text gelöscht — und umgekehrt.

> **Wichtig für die Praxis:** Den Wortlaut gibt es für **Luther 2017** und
> **Gute Nachricht** — Einzelverse daraus dürfen Gemeinden frei verwenden,
> der Quellenvermerk steht in der App bei der Auswahl. Für **Bibel in
> gerechter Sprache** und **Elberfelder** fehlt der Text aus Lizenzgründen;
> die Liste zeigt dort nur die Stellenangabe mit dem Hinweis, dass der Text
> noch fehlt. Wer einen dieser beiden Wortlaute will, nimmt den Freitext-Weg.

Die gesammelten Sprüche eines Jahrgangs kannst du dir als Übersicht anzeigen
und dir per E-Mail zuschicken lassen — praktisch für Urkunden und den
Konfirmationsablauf.

## Nachvollziehen, was die Jahrgangs-Zuweisung steuert

Leitung und Teamer:innen werden einzelnen Jahrgängen zugewiesen. Diese
Zuweisung ist die **wichtigste Berechtigungseinstellung im ganzen System** —
sie entscheidet in sehr vielen Bereichen mit.

Für die **Org-Leitung** gilt das alles nicht: Sie sieht immer die ganze
Gemeinde, unabhängig davon, welche Jahrgänge bei ihr eingetragen sind. Für
die **Leitung** gilt das so nicht — bei der Konfi-Liste und im Chat ist auch
sie auf ihre zugewiesenen Jahrgänge beschränkt. Wer als Leitung keine
Zuweisung hat, sieht deshalb keine Konfis. Die Leitung kann auch nur in ihren
Jahrgängen Konfis anlegen und sie nur zwischen ihnen verschieben; ändert sie
die Jahrgänge einer Teamer:in, bleiben deren übrige Zuweisungen erhalten. Was das im Chat
konkret bedeutet, steht im Kapitel
[Chat](90-chat.md#nachschlagen-wer-wen-anschreiben-darf); die Unterschiede zwischen den
Rollen stehen im Kapitel [Rollen und Rechte](05-rollen.md).

| Bereich | Ohne passende Zuweisung |
|---|---|
| Konfi-Liste | die Liste bleibt **komplett leer** |
| Konfi-Profil ansehen | kein Zugriff; Teamer:innen bleiben dagegen für die ganze Leitung sichtbar |
| Jahrgangs-Liste (Leitung) | zeigt nur die eigenen Jahrgänge |
| Konfi anlegen oder verschieben (Leitung) | abgewiesen mit „Kein Zugriff auf diesen Jahrgang“ |
| Konfi löschen, befördern, Passwort zurücksetzen (Leitung) | abgewiesen mit „Kein Zugriff auf diesen Konfi“ |
| Punkte vergeben und zurücknehmen | abgewiesen mit „Kein Zugriff auf diesen Konfi“ |
| Nachweisfotos zu Aktivitäten | nur für Verantwortliche der betreffenden Jahrgänge sichtbar |
| Anträge auf Aktivitäten (Leitung) | Anträge von Konfis dieser Jahrgänge stehen nicht in der Antragsliste, zählen nicht am Reiter und melden sich nicht als „Neuer Antrag eingegangen“; Anträge von Teamer:innen bleiben ([wer von einem neuen Antrag erfährt](40-punkte.md#nachsehen-wer-von-einem-neuen-antrag-erfaehrt)) |
| Events | jahrgangsgebundene Events sind unsichtbar und nicht buchbar; führt eine Mitteilung oder ein Link auf ein solches Event, steht dort der Grund („Nicht deinem Jahrgang zugeordnet") |
| Abmeldungen und Zusagen zu Events (Leitung) | Abmeldungen von Konfis, Pflicht-Abmeldungen und Zu- oder Absagen des Teams melden sich nicht; Events „Nur Team“ und Events ohne Jahrgang melden sich bei der ganzen Leitung ([wer davon erfährt](70-termine.md#nachsehen-wer-von-abmeldungen-und-zusagen-erfaehrt)) |
| „Events warten auf Verbuchung“ (Leitung) | zählt nur die Events, die der Reiter „Verbuchen“ zeigt; ist dort nichts offen, kommt keine Erinnerung |
| Neue Registrierung (Leitung) | keine Meldung; sie geht an die Org-Leitung und die Leitung des Jahrgangs ([wer davon erfährt](#nachsehen-wer-meldungen-zu-einem-jahrgang-bekommt)) |
| „Jahrgang wird bald gelöscht“ (Leitung) | keine Warnung; sie bekommt nur, wer im Jahrgang bearbeiten und damit befördern darf |
| Material | jahrgangsgebundenes Material ist unsichtbar (Material ohne Jahrgang und „für alle“ bleibt) |
| Anwesenheits- und Spruchlisten (Leitung) | abgewiesen mit „Kein Zugriff auf diesen Jahrgang“ |
| Jahresrückblick: Liste der Ausgaben | zeigt nur Ausgaben der eigenen Jahrgänge; ohne jede Zuweisung bleibt sie leer und nennt den Grund („Kein Jahrgang zugewiesen“) |
| Jahresrückblick freigeben (Leitung) | abgewiesen mit „Kein Zugriff auf diesen Jahrgang“ |
| Chat: Teamer:in oder Leitung schreibt Konfi an | „Du kannst nur Konfirmand:innen aus deinen Jahrgängen anschreiben“ |
| Chat: Konfi schreibt Teamer:in oder Leitung an | „Diese Teamer:in ist nicht für deinen Jahrgang zuständig“ bzw. „Diese Person aus der Leitung ist nicht für deinen Jahrgang zuständig“ (die Org-Leitung erreicht ein Konfi dagegen immer) |
| Chat: Kontaktliste | die Teamer:in taucht bei den Konfis gar nicht erst auf |
| Jahrgangs-Chatraum | keine Aufnahme in den Raum; auch die Leitung öffnet ihn dann nicht („Zugriff verweigert“) |
| Event-Chats und Gruppen mit Konfis | ohne eigene Mitgliedschaft zu; einen Event-Chat öffnet die Leitung nur, wenn das Event in ihrer Event-Liste steht ([Chat](90-chat.md#nachvollziehen-was-die-leitung-sehen-kann)) |
| Challenges | jahrgangsgebundene Challenges sind unsichtbar (Team-Runden bleiben) |
| Meldungs-Zähler an den Reitern und am App-Symbol | zählen nur, was die eigenen Listen zeigen |
| Mitteilungen und Push | nur für die eigenen Jahrgänge |

> **Der Chat sperrt in BEIDE Richtungen.** Eine Teamer:in ohne Zuweisung ist
> für Konfis unsichtbar und erreicht ihrerseits keinen einzigen Konfi. Wenn
> sich jemand meldet, er sehe „gar keine Konfis“ oder werde von niemandem
> gefunden, ist fast immer die fehlende Jahrgangs-Zuweisung die Ursache.

Bei [**Events**](70-termine.md) wirkt die Zuweisung auf beides: Sehen und
Buchen. Eine Teamer:in kann sich nur zu Events ihrer eigenen Jahrgänge
anmelden; sonst kommt **„Dieses Event gehört zu einem Jahrgang, dem du
nicht zugewiesen bist“**. Zwei Arten von Events bleiben immer sichtbar und
buchbar: Events [**nur für Teamer:innen**](70-termine.md#die-zielgruppe-waehlen)
und Events ohne jede Jahrgangsbindung.

Wird ein Konfi **zur Teamer:in befördert**, bekommt er seinen alten Jahrgang
**nicht** automatisch als Zuweisung. Die vergibt die Leitung, sobald die neue
Teamer:in in einem Jahrgang aktiv sein soll — siehe
[Eine Rolle ändern](05-rollen.md#eine-rolle-aendern).

## Nachsehen, wer Meldungen zu einem Jahrgang bekommt

Zwei Meldungen hängen an einem Jahrgang selbst. Beide kommen als Push und im
[Postfach](03-bedienung.md#mitteilungen-im-postfach-nachlesen) an:

- **„Neue Registrierung“** — eine Konfi hat sich mit einem
  [Einladungscode](35-passwoerter.md#sich-als-konfi-registrieren) angemeldet.
  Sie geht an die Org-Leitung und an die Leitung, der der
  Jahrgang zugewiesen ist — genau an die, bei denen die neue Konfi sofort in
  der Konfi-Liste steht. Ist der Jahrgang niemandem aus der Leitung
  zugewiesen, bekommt sie nur die Org-Leitung.
- **„Jahrgang wird bald gelöscht“** — sieben Tage bevor die Konfis eines
  Jahrgangs nach der Konfirmation
  [aus den Listen genommen werden](35-passwoerter.md#weiterkommen-wenn-gar-nichts-geht),
  mit dem Hinweis, wer bleiben soll, jetzt noch zur Teamer:in zu befördern.
  Sie kommt zusätzlich per E-Mail, und zwar an die Org-Leitung und an die
  Leitung, soweit sie im Jahrgang bearbeiten darf — denn nur sie können befördern.
  Eine Zuweisung, die nur zum Ansehen berechtigt, reicht dafür nicht.

Teamer:innen bekommen keine der beiden. Wer in mehreren Gemeinden
mitarbeitet, bekommt sie nach der Rolle und den Jahrgängen, die er in der
jeweiligen Gemeinde hat.

## Kategorien anlegen und pflegen

Kategorien findest du unter **Mehr › Kategorien**. Sie sortieren Aktivitäten
und Events, und es gibt **eine einzige gemeinsame Liste** für beides — keine
getrennten Kategorien für Aktivitäten und Events.

Eine Kategorie hat nur **Name** und **Beschreibung**. Beide gelten für die
ganze Gemeinde, nicht pro Jahrgang. Zwei Kategorien dürfen nicht denselben
Namen haben („Kategoriename existiert bereits“).

Verwendet werden sie an drei Stellen:

- zum Sortieren und Filtern von **Aktivitäten**
- zum Sortieren und Filtern von [**Events**](70-termine.md)
- als Grundlage für [**Kategorie-Badges**](60-badges.md#kategorie-aktivitaeten)

### Eine Kategorie löschen

Wird eine Kategorie noch verwendet, lässt sie sich nicht löschen. Die Meldung
nennt die genauen Zahlen, etwa: **„Kategorie kann nicht gelöscht werden: 3
Aktivität(en) und 2 Event(s) zugeordnet.“** Es wird also nichts
stillschweigend entkoppelt — entweder die Kategorie geht ganz weg, oder sie
bleibt vollständig.

> Die Nachfrage vor dem Löschen („Kategorie "Ausflug" wirklich löschen?“)
> **warnt nicht vorab**, dass die Kategorie noch benutzt wird. Das erfährst du
> erst, nachdem du bestätigt hast — dann als Fehlermeldung.

### Kategorie-Badges nicht ins Leere laufen lassen

> **Achtung, das ist die gefährlichste Stelle in diesem Kapitel:** Ein
> Kategorie-Badge merkt sich den **Namen** der Kategorie, nicht die
> Kategorie selbst. Benennst du eine Kategorie um, findet das zugehörige
> Badge nichts mehr — **stillschweigend, ohne Fehlermeldung**. Niemand
> bekommt es mehr, und niemand erfährt, warum. Bereits verliehene bleiben
> erhalten. **Kategorien, auf die [Badges](60-badges.md) zeigen, also
> nicht umbenennen.**

## Einen Jahrgang löschen

Vor dem Löschen fragt die App nach und nennt dabei, was mitgeht: wie viele
Events und Challenges gelöscht werden, wie viele dieser Events noch in der
Zukunft liegen und wie viele bestehen bleiben, weil sie auch zu anderen
Jahrgängen gehören. Das Löschen geschieht ganz oder gar nicht — bricht es
mittendrin ab, bleibt alles so, wie es war.

Das Löschen ist an zwei Stellen abgesichert.

**Blockiert, solange aktive Konfis zugeordnet sind.** Meldung: „Jahrgang kann
nicht gelöscht werden: 12 Konfi(s) zugeordnet.“ Verschiebe die Konfis erst in
einen anderen Jahrgang.

**Blockiert, solange der Chatverlauf Nachrichten enthält.** Meldung:
„Jahrgang kann nicht gelöscht werden: Chat-Raum enthält 148 Nachricht(en).“
Hier gibt es allerdings einen Ausweg: Wer den Jahrgang löschen darf, bekommt
die Rückfrage „Chat-Nachrichten vorhanden“ mit dem Knopf
**„Dennoch löschen“**. Dann werden **alle Nachrichten, Umfragen und Anhänge
unwiderruflich gelöscht** ([Chat](90-chat.md)).

### Events und Challenges des Jahrgangs mitlöschen

Was zum Jahrgang gehört, geht mit ihm. Was auch anderen gehört, bleibt:

| Was | Beim Löschen des Jahrgangs |
|---|---|
| Event, das nur zu diesem Jahrgang gehört | wird gelöscht — mit Anmeldungen, Anwesenheit, Zeitfenstern, Event-Chat, Erinnerungen und den Mitteilungen dazu, wie beim [Löschen eines Events](70-termine.md#ein-event-loeschen) |
| Event, das auch zu einem anderen Jahrgang gehört | bleibt; nur die Zuordnung zu diesem Jahrgang fällt weg |
| Event [„Nur Team“](70-termine.md#die-zielgruppe-waehlen) | bleibt, auch wenn es diesem Jahrgang zugeordnet war — es gehört dem ganzen Team |
| Event ohne Jahrgang | bleibt unberührt |
| Challenge, die nur zu diesem Jahrgang gehört | wird gelöscht — mit allen Beiträgen und Dateien, wie beim [Löschen einer Challenge](80-challenges.md#eine-challenge-loeschen) |
| Challenge, die auch zu einem anderen Jahrgang gehört | bleibt; nur die Zuordnung fällt weg |
| Challenge [„Nur das Team“](80-challenges.md#festlegen-wer-mitmachen-darf) | bleibt |

Zwei Dinge laufen anders als beim Löschen eines einzelnen Events:

- **Vergebene Punkte bleiben.** Wer bei einem gelöschten Event Punkte bekommen
  hat, behält sie — die Teilnahme hat stattgefunden, der Jahrgang wird nur
  aufgeräumt.
- **Niemand bekommt eine Absage.** Liegen Events des Jahrgangs noch in der
  Zukunft, nennt die Rückfrage ihre Zahl. Wer dort angemeldet ist, erfährt vom
  Löschen nichts; [sag solche Events vorher ab](70-termine.md#ein-event-absagen-oder-loeschen),
  wenn es jemanden betrifft.

**Stempel bleiben.** Stempel, die Teamer:innen und Leitung in einer gelöschten
Challenge bekommen haben, stehen danach weiter unter **„Deine Stempel“** und in
der Detailansicht der Person — mit Name, Symbol, Beschreibung und dem Tag, an
dem sie verliehen wurden. Konfis behalten ihre [Badges](60-badges.md); die
Stempel ihrer Challenges gehen mit dem Jahrgang.

### Beförderte Teamer:innen beim Löschen behalten

Ehemalige Konfis, die inzwischen Teamer:in sind, **blockieren das Löschen
nicht**. Sie verlieren beim Löschen nur ihre Jahrgangs-Bindung.

**Ihre Daten bleiben vollständig erhalten**: Punktestand, Level, Badges,
Konfispruch, ihr [Konfi-Rückblick](95-wrapped.md) und die Termine ihrer
Konfi-Zeit — die Kopie, die die App bei der
[Beförderung](05-rollen.md#eine-rolle-aendern) festhält. Fehlt einer
beförderten Person diese Kopie noch, legt das Löschen des Jahrgangs sie an, mit
allem, was dann noch da ist. Das ist bewusst so
gebaut, damit sie ihre eigene Konfizeit später noch nachschauen können — der
Rückblick steht weiterhin in ihrem Profil, auch wenn der Jahrgang, für den er
erstellt wurde, nicht mehr existiert. In deiner Liste der Ausgaben bleibt eine
solche Ausgabe ohne Jahrgangsnamen stehen; eine Ausgabe, in der kein Rückblick
mehr steckt, wird beim Löschen des Jahrgangs mit entfernt.

## Das Konfirmationsdatum finden

Am Jahrgang selbst wird **kein** Konfirmationsdatum gepflegt. Der
Konfirmationstermin ergibt sich **pro Konfi** aus dem Event, das
[als Konfirmation gekennzeichnet](70-termine.md#ein-event-als-konfirmation-kennzeichnen) ist und das der
Konfi gebucht hat. Bei mehreren Konfirmationsterminen in einem Jahrgang hat
also jeder sein eigenes, richtiges Datum.
