---
titel: Termine
untertitel: Anlegen, Anmeldung, Anwesenheit und Punkte
farbe: "#dc2626"
gruppe: Nachschlagen
---

Termine (im System „Events") sind alles, wozu man kommen kann: Gottesdienste,
Ausflüge, Konfi-Stunden, die Konfirmation. Ein Termin regelt, wer sich anmelden
darf, wie viele mitkommen, ob es Punkte gibt und wie du hinterher die
Anwesenheit verbuchst. Dieses Kapitel richtet sich an Leitung und
Teamer:innen; was Konfis sehen, steht jeweils dabei.

## Einen Termin anlegen

Name, Datum, Speichern — mehr braucht es nicht. Alles andere hat sinnvolle
Voreinstellungen.

Eine Einstellung entscheidet aber über alle anderen und steht deshalb ganz
oben: **„Für wen ist das Event?"** Sie legt fest, welche Abschnitte im
Formular überhaupt erscheinen. Stell sie zuerst ein, dann den Rest.

### Die Zielgruppe wählen

Drei Möglichkeiten stehen zur Auswahl:

| | Nur Konfis | Konfis, Team gesucht | Nur Team |
|---|---|---|---|
| Konfis sehen den Termin | ja | ja | **nein** |
| Konfis können sich anmelden | ja | ja | nein |
| Team sieht den Termin | nur bei passendem Jahrgang | nur bei passendem Jahrgang | **alle** |
| Team kann sich anmelden | **nein** | nur bei passendem Jahrgang | ja |
| Abschnitt „Konfis" (Plätze, Punkte) | ja | ja | **weg** |
| Abschnitt „Teamer:innen" (Kontingent) | **weg** | ja | ja |
| Pflicht-Event und Konfirmation möglich | ja | ja | **weg** |
| Anmeldezeitraum und Zeitfenster möglich | ja | ja | **weg** |

Bei „Nur Konfis" lehnt der Server eine Teamer-Buchung auch dann ab, wenn sie
über einen Umweg versucht wird: „Dieses Event ist nicht für das Team buchbar".

Bei „Konfis, Team gesucht" gibt es **zwei getrennte Kontingente**. Zehn
Konfi-Plätze und drei Teamer-Plätze sind zehn und drei, nicht dreizehn.

Umschalten auf „Nur Team" setzt sofort Pflicht-Event, Konfirmation und
Zeitfenster aus. Beim Speichern werden zusätzlich Punkte, Konfi-Plätze,
Jahrgänge und der Anmeldezeitraum auf null gesetzt. „Konfis, Team gesucht"
und „Nur Team" schließen sich gegenseitig aus.

### Nachvollziehen, welche Termine das Team sieht

**Teamer:innen sehen und buchen nur Termine der Jahrgänge, die sie betreuen.**
Dieselbe Regel wie im [Chat](90-chat.md#wer-wen-anschreiben-darf), wo man auch
nur Konfis der eigenen Jahrgänge anschreiben kann. Wer den Jahrgang nicht
betreut, findet den Termin gar nicht erst in seiner Liste; eine Buchung über
einen Umweg lehnt der Server ab („Dieser Termin gehört zu einem Jahrgang, dem
du nicht zugewiesen bist").

Zwei Ausnahmen: Termine mit der Zielgruppe **„Nur Team"** und Termine **ohne
jeden Jahrgang** sind für alle Teamer:innen der Gemeinde offen — die einen
betreffen keinen Jahrgang, die anderen gelten der ganzen Gemeinde.

Für Admins gilt dieselbe Bindung, für org_admin und super_admin nicht. Was
die Jahrgangs-Zuweisung sonst noch steuert, steht unter
[Jahrgänge](45-jahrgaenge.md#nachvollziehen-was-die-jahrgangs-zuweisung-steuert).

### Kategorien und Jahrgänge zuordnen

Beides ordnest du im selben Abschnitt zu. Die Kategorien legst du vorher
unter [Kategorien anlegen und pflegen](45-jahrgaenge.md#kategorien-anlegen-und-pflegen)
an; sie gruppieren Termine und sind die Grundlage für Kategorie-Abzeichen.

### Die Voreinstellungen kennen

| Feld | Voreinstellung |
|---|---|
| Endzeit | eine Stunde nach Beginn |
| Anmeldung ab | sofort (kein Startzeitpunkt) |
| Anmeldeschluss | 24 Stunden vor Beginn |
| Max. Teilnehmer:innen | 5 (einstellbar 1 bis 50) |
| Punkte | 1, Typ Gemeinde |
| Warteliste | an, 3 Plätze |
| Check-in-Fenster | 30 Minuten |

## Ein Pflicht-Event einrichten

Ein Pflicht-Event ist ein Termin, zu dem **der ganze Jahrgang automatisch
angemeldet ist**. Beim Speichern legt das System für jeden Konfi der
ausgewählten Jahrgänge eine bestätigte Anmeldung an; alle bekommen einen Push
„Neues Pflicht-Event".

Deshalb braucht ein Pflicht-Event **mindestens einen Jahrgang** — sonst
verweigert das Formular das Speichern mit „Pflicht-Events brauchen mindestens
einen Jahrgang".

Machst du einen bestehenden Termin nachträglich zum Pflicht-Event, wird der
Jahrgang jetzt angemeldet. Wer schon angemeldet war, bleibt es; Doppelanmeldungen
entstehen nicht.

### Wissen, welche Optionen dabei wegfallen

Das System setzt diese Einstellungen beim Speichern hart auf null, egal was im
Formular stand:

| Einstellung | Was passiert |
|---|---|
| Punkte | auf 0 |
| Max. Teilnehmer:innen | auf 0 (= unbegrenzt) |
| Warteliste | ausgeschaltet |
| Zeitfenster | ausgeschaltet, der Abschnitt verschwindet |
| Anmeldung ab / Anmeldeschluss | entfallen, der Abschnitt verschwindet |

Wenn ohnehin der ganze Jahrgang angemeldet ist, gibt es nichts zu begrenzen und
keinen Anmeldezeitraum zu öffnen.

> **Keine Punkte für Pflicht.** Das lässt sich nicht umstellen. Die Anwesenheit
> wird trotzdem erfasst — sie zählt für das Abzeichen
> [„Pflicht-Anwesenheit"](60-badges.md#die-passende-bedingung-waehlen).

### Eine Abmeldung vom Pflicht-Event entgegennehmen

Konfis können sich abmelden, aber nur **mit Begründung**, und die muss
**mindestens 5 Zeichen** lang sein — sonst kommt „Begründung muss mindestens
5 Zeichen haben".

Danach steht die Anmeldung auf „abgemeldet", du bekommst einen Push mit Namen,
Termin und Begründung, und beim Konfi steht „Du hast dich abgemeldet". Über
den Knopf **„Wieder anmelden"** geht es zurück; die ursprüngliche Begründung
bleibt gespeichert. Beides geht nur, solange der Termin in der Zukunft liegt.

> **Wer abgemeldet ist, kann sich nicht per QR-Code einchecken** — der Scanner
> meldet „Du hast dich von diesem Event abgemeldet". Wer doch spontan kommt,
> meldet sich vorher wieder an oder wird von dir von Hand als anwesend verbucht.

## Einen Termin als Konfirmation kennzeichnen

Das Häkchen „Konfirmation" tut etwas anderes als „Pflicht-Event": Es meldet
niemanden automatisch an, sondern sorgt dafür, dass **ein Konfi sich nur zu
genau einem Konfirmationstermin anmelden kann**. Der zweite Versuch wird
abgelehnt:

> „Du bist bereits zu einem Konfirmationstermin angemeldet (…). Melde dich
> dort zuerst ab, um einen anderen Termin zu wählen."

In der App sind die anderen Konfirmationstermine dann ausgegraut.

| | Pflicht-Event | Konfirmation |
|---|---|---|
| Alle automatisch angemeldet | **ja** | nein — jede:r meldet sich selbst an |
| Jahrgang zwingend nötig | ja | nein |
| Punkte | 0 (erzwungen) | 0 (erzwungen) |
| Zeitfenster möglich | nein | nein |
| Plätze und Warteliste | entfallen | **möglich** |
| Anmeldezeitraum | entfällt | **möglich** |
| Abmelden | nur mit Begründung | ganz normal |

*Typischer Einsatz:* drei Konfirmationsgottesdienste an zwei Wochenenden, je
15 Plätze. Die Konfis verteilen sich selbst.

Abgesagte Konfirmationstermine blockieren niemanden — wer dort angemeldet ist,
kann sich ohne Weiteres einen anderen aussuchen.

## Den Anmeldezeitraum festlegen

Der Anmeldezeitraum besteht aus **„Anmeldung ab"** und **„Anmeldeschluss"**.

Er gilt **ausschließlich für Konfis**. Teamer:innen können sich jederzeit
melden — vor Öffnung wie nach Schluss; sie begrenzt allein ihr Kontingent.
Deshalb blendet das Formular den Abschnitt bei „Nur Team" aus.

Der Schalter **„Anmeldung ab sofort"** steht standardmäßig an: Es gibt keinen
Startzeitpunkt, nach dem Speichern kann man sich anmelden. Schaltest du ihn
aus, erscheint ein Datumsfeld, vorbelegt mit „jetzt".

Vor der Öffnung sehen die Konfis den Termin zwar, bekommen beim Versuch aber
„Anmeldung noch nicht geöffnet"; in der Liste steht „Bald". Nach dem
Anmeldeschluss kommt „Anmeldung bereits geschlossen", in der Liste steht
„Geschlossen".

### Den „Anmeldung möglich"-Push einordnen

Sobald ein freiwilliger Termin anmeldbar wird, geht **genau ein** Push an die
Konfis. Er kommt nicht beim Speichern, sondern von einem Hintergrundlauf, der
jede Minute prüft — so kann er nicht doppelt kommen.

Schließt du die Anmeldung wieder (Fenster in die Zukunft verschoben, Termin
abgesagt), wird die Merkung zurückgesetzt: Beim nächsten Öffnen kommt wieder
ein Push. Pflicht-Events haben ihren eigenen Push beim Anlegen.

### Wissen, bis wann Konfis sich abmelden können

**Zwei Tage vor dem Termin ist Schluss.** Danach ist der Abmelden-Knopf
gesperrt, und in der App steht „Abmelden geht nur bis 2 Tage vorher". Das ist
fest eingestellt; der Anmeldezeitraum regelt nur das Anmelden.

> **Du selbst bist davon nicht betroffen.** Die Leitung kann eine Anmeldung in
> der Detailansicht jederzeit entfernen, auch am Tag des Termins.

## Plätze und Warteliste einstellen

Konfis und Teamer:innen haben **je ein eigenes Kontingent** mit **je eigener
Warteliste**. Beide Abschnitte sind gleich aufgebaut: unbegrenzt oder Zahl,
Warteliste an oder aus, Wartelisten-Plätze.

Die Zahl **0 heißt überall im System: unbegrenzt** — das setzt der Schalter
„Unbegrenzte Teilnehmer:innen". Ist er an, verschwindet der Warteliste-Schalter:
Bei unbegrenzten Plätzen wird jede Anmeldung sofort bestätigt.

Ist die Warteliste an und alle Plätze belegt, landet die nächste Anmeldung auf
der Warteliste: „Du bist auf der Warteliste. Wird ein Platz frei, rückst du
automatisch nach." Ist auch die Warteliste voll, kommt „Event ist voll und
Warteliste ist auch voll"; ist sie ganz aus, kommt „Das Event ist leider
bereits ausgebucht".

### Nachvollziehen, wann jemand nachrückt

Das passiert automatisch, in vier Fällen:

| Auslöser | Was passiert |
|---|---|
| Jemand meldet sich ab | die erste wartende Person rückt nach |
| Du erhöhst die Teilnehmerzahl | so viele rücken nach, wie neue Plätze da sind |
| Du erhöhst die Plätze eines Zeitfensters | dasselbe, aber nur in diesem Zeitfenster |
| Du erhöhst das Teamer-Kontingent | die wartenden Teamer:innen rücken nach |

Nachgerückt wird in der Reihenfolge der Anmeldung; die nachgerückte Person
bekommt einen Push. Gelöschte Nutzer:innen rücken nie nach.

> **Ein frei gewordener Konfi-Platz geht niemals an eine wartende Teamer:in** —
> und umgekehrt. Die beiden Wartelisten werden strikt getrennt geführt.

Reduzierst du die Plätze, wird **niemand zurückgestuft**. Wer bestätigt ist,
bleibt bestätigt, auch wenn dadurch mehr Leute drin sind als erlaubt. Erst
wenn genug Leute abspringen, greift die neue Grenze.

### Das Teamer-Kontingent verwalten

Der Abschnitt „Teamer:innen" erscheint nur bei „Konfis, Team gesucht" und
„Nur Team". Meldet sich eine Teamer:in an oder ab, bekommt die Leitung einen
Push; bei Konfi-Anmeldungen nicht, sonst wäre die Leitung mit Meldungen
zugeschüttet.

Teamer:innen geben eine klare Antwort: **„Ich bin dabei"** oder **„Ich bin
nicht dabei"**. Jede Antwort lässt sich jederzeit ändern, auch von der Absage
zurück zur Zusage. Eine Absage bleibt als eigener Eintrag stehen — in der
Detailansicht siehst du sie als „Abgemeldet" samt Grund. So ist eine Absage
von „hat noch nicht reagiert" zu unterscheiden.

Für den Grund gilt:

- Absage **ohne vorherige Zusage**: freiwillig.
- Absage **nach einer Zusage** (fester Platz oder Warteliste): **Pflicht** —
  ohne Grund lehnt der Server ab. Solche Absagen sind in der Detailansicht
  eigens als „Nach Zusage abgesagt" gekennzeichnet, denn dann musst du umplanen.

Sagt jemand von einem festen Platz ab, wird der Platz frei und die nächste
Person rückt aus der Team-Warteliste nach.

> **Zwei Arten von „weg vom Termin":** Eine **Absage** (Teamer:in, oder Konfi
> bei einem Pflicht-Event) bleibt als Eintrag mit Grund sichtbar stehen. Eine
> **Abmeldung** von einem freiwilligen Termin entfernt die Anmeldung selbst;
> sie taucht in der Detailansicht unter „Abmeldungen" auf. Für die Plätze
> zählt beides gleich: Wer absagt oder sich abmeldet, belegt keinen Platz mehr.

## Zeitfenster einrichten

Zeitfenster sind für Termine, bei denen die Leute **nacheinander in kleinen
Gruppen** kommen: Vorstellungsgespräche, Fototermine, Beichtgespräche. Du
legst mehrere Fenster mit eigener Uhrzeit und eigener Platzzahl an:

```
Fototermin
  ├─ 14:00 – 14:30   4 Plätze
  ├─ 14:30 – 15:00   4 Plätze
  └─ 15:00 – 15:30   4 Plätze
```

Ein neues Fenster schließt zeitlich ans letzte an und übernimmt dessen
Platzzahl — du stellst also nur die erste Zeile ein und tippst dann auf
„Zeitfenster hinzufügen".

Bei „Pflicht-Event", „Konfirmation" und „Nur Team" gibt es keine Zeitfenster:
Das Formular blendet den Abschnitt aus, der Server erzwingt es zusätzlich.

### Wissen, wie das Buchen abläuft

Der Konfi **muss** ein Fenster auswählen; ohne kommt „Bitte einen Zeitslot
auswählen". Beim Buchen zählt **die Kapazität des einzelnen Fensters**, nicht
die Gesamtzahl.

Ist ein Fenster voll und die Warteliste an, steht in der Auswahlliste etwa
„14:00 - 14:30 (voll — auf Warteliste, 2 warten)". Man setzt sich also gezielt
auf die Warteliste **dieses einen Fensters**, und dort rückt auch genau von
dieser Warteliste jemand nach. Ist die Warteliste aus, kommt „Dieser Zeitslot
ist ausgebucht und hat keine Warteliste."

Die in der Übersicht angezeigte Gesamtzahl ist bei Zeitfenster-Terminen die
Summe aller Fensterplätze.

### Zeitfenster nachträglich ändern

Beim Speichern werden vorhandene Fenster aktualisiert, nicht neu angelegt —
bestehende Anmeldungen bleiben an ihrem Fenster hängen.

Entfernst du ein Fenster **ohne Anmeldungen**, wird es gelöscht. Ein Fenster
**mit Anmeldungen** bleibt bestehen und verschwindet nur aus der Anzeige.
Dasselbe gilt, wenn du Zeitfenster ganz ausschaltest.

> **Ein Zeitfenster mit Anmeldungen lässt sich nicht wirklich loswerden.**
> Willst du es weg haben, melde erst die Leute ab oder verschiebe sie in ein
> anderes Fenster.

## Punkte für einen Termin vergeben

Jeder Termin gibt entweder **Gottesdienst-** oder **Gemeindepunkte**;
Voreinstellung ist Gemeinde. Der Unterschied der beiden Arten steht unter
[Punkte](40-punkte.md#die-zwei-punktarten-auseinanderhalten).

Punkte werden vergeben, wenn **alle fünf** Bedingungen erfüllt sind:

1. Die Person ist als **anwesend** verbucht (per QR-Check-in oder von Hand)
2. Der Termin hat eine **Punktzahl größer 0**
3. Es ist **kein Pflicht-Event**
4. Die Person ist ein **Konfi** — Teamer:innen bekommen für Termine keine Punkte
5. Der gewählte Punkt-Typ ist
   [im Jahrgang eingeschaltet](45-jahrgaenge.md#eine-punktart-abschalten)

Fehlt eine davon, wird die Anwesenheit trotzdem gesetzt — nur ohne Punkte. Pro
Person und Termin gibt es die Punkte genau einmal.

Danach prüft das System automatisch, ob neue [Abzeichen](60-badges.md) fällig
sind und ob jemand ein [Level](40-punkte.md#level-anlegen-und-pflegen)
aufgestiegen ist.

> **Ein Unterschied, den du kennen solltest:** Verbuchst du eine Person
> **einzeln** und der Punkt-Typ ist in ihrem Jahrgang abgeschaltet, bricht der
> Vorgang mit einer Fehlermeldung ab. Beim Sammel-Verbuchen wird die Person
> dagegen als anwesend verbucht und einfach übersprungen — sonst würde ein
> einziger Sonderfall die ganze Liste blockieren.

### Punkte zurücknehmen

In zwei Fällen nimmt das System die Punkte vollständig zurück, inklusive Abzug
vom Punktestand: Du stellst die Anwesenheit von **anwesend auf fehlend**, oder
die Person **meldet sich ab**, obwohl sie schon als anwesend verbucht war. Der
Punktestand fällt dabei nie unter null.

Ein Abzeichen, das durch diese Punkte ausgelöst wurde, bleibt bestehen —
[Abzeichen werden nie aberkannt](60-badges.md#ein-abzeichen-aus-dem-verkehr-ziehen).

## Die Anwesenheit verbuchen

Nach dem Termin trägst du ein, wer da war. Es gibt drei Wege: einzeln, alle auf
einmal, oder die Leute checken sich selbst per QR-Code ein.

**Einzeln** geht es in der Teilnehmerliste über die
[Wischgeste](03-bedienung.md#etwas-loeschen-nach-links-wischen) am jeweiligen
Eintrag: **Anwesend** oder **Fehlend**. Punkte werden sofort vergeben oder
abgezogen, und die Person bekommt einen Push.

### Alle auf einmal verbuchen

Liegt ein Termin in der Vergangenheit und es gibt noch unverbuchte Anmeldungen,
zeigt er oben den Status **„Verbuchen"**. Der Knopf „Alle bestätigen" setzt
dann in einem Rutsch alle bestätigt angemeldeten Konfis ohne Anwesenheitsstatus
auf „anwesend" — inklusive Punkten, Abzeichen- und Level-Prüfung und Push.

Nicht angefasst werden dabei:

| | wird verbucht |
|---|---|
| Angemeldete Konfis ohne Status | **ja** |
| Bereits verbuchte (anwesend oder fehlend) | nein, bleiben wie sie sind |
| Wartelisten-Einträge | **nein** |
| Abgemeldete (Pflicht-Event) | nein |
| Teamer:innen | **nein — die verbuchst du einzeln** |

Sind alle verbucht, wechselt der Status auf **„Verbucht"**.

> **„Alle bestätigen" heißt „alle waren da".** Wer gefehlt hat, muss danach
> einzeln auf „Fehlend" gestellt werden — dabei werden die gerade vergebenen
> Punkte wieder abgezogen. Bei vielen Fehlenden ist einzeln verbuchen der
> schnellere Weg.

## Den QR-Check-in nutzen

Du zeigst einen QR-Code (auf dem Handy, am Beamer, ausgedruckt), die Konfis
scannen ihn in der App und sind eingecheckt — inklusive
[Punkten](#punkte-fuer-einen-termin-vergeben).

Konfis finden den Scanner oben rechts in ihrer Terminliste oder im geöffneten
Termin über den Knopf **„Einchecken"**; der erscheint nur, wenn die Anmeldung
bestätigt und noch keine Anwesenheit eingetragen ist, danach steht dort
**„Anwesend"**. Teamer:innen scannen über den runden Knopf unten rechts in
ihrer Terminliste.

Gescannt wird mit der Kamera in der App, nicht mit der Kamera-App des Geräts.
Beim ersten Mal fragt das Gerät nach der Kamera-Erlaubnis. Ohne Netz geht es
nicht — dann meldet die App „Du bist offline". Nach jedem Scan zeigt die App
kurz das Ergebnis und schaltet von selbst wieder scharf.

### Das Check-in-Fenster einstellen

Beim Anlegen stellst du es ein: 5 bis 60 Minuten, Voreinstellung 30. **Die Zahl
gilt in beide Richtungen — vor und nach dem Terminbeginn.**

*Beispiel:* Termin um 18:00 Uhr, Fenster 30 Minuten → Check-in von 17:30 bis
18:30. Das ist eine ganze Stunde, nicht eine halbe.

Davor kommt „Check-in ist noch nicht möglich", danach „Der Check-in-Zeitraum
ist abgelaufen". Gerechnet wird immer ab dem Terminbeginn, nie ab der Endzeit.

> **Für einen dreistündigen Konfi-Tag ist ein 30-Minuten-Fenster knapp** — wer
> eine Stunde später dazustößt, kommt nicht mehr rein. Plane das Fenster nach
> der erwarteten Ankunftszeit, nicht nach der Länge des Termins.

### Den Zähler unter dem Code lesen

Solange der Code offen ist, steht darunter **„X / Y eingecheckt"**. Beide
Zahlen beziehen sich nur auf bestätigte Anmeldungen: rechts, wie viele
bestätigt angemeldet sind, links, wie viele davon schon als anwesend verbucht
sind. Wer wartet oder sich abgemeldet hat, ist in keiner der beiden Zahlen.

Der Zähler aktualisiert sich alle zehn Sekunden von selbst und zählt auch
Anwesenheiten mit, die ihr währenddessen von Hand verbucht habt. Über das
Drucken-Symbol lässt sich die Seite ausdrucken oder als PDF sichern.

### Nachvollziehen, wer sich einchecken kann

Der Scan funktioniert nur bei **bestätigter Anmeldung**. Andernfalls:

| Situation | Meldung |
|---|---|
| gar nicht angemeldet | „Du bist nicht für dieses Event angemeldet" |
| auf der Warteliste | „Deine Anmeldung ist nicht bestätigt" |
| von einem Pflicht-Event abgemeldet | „Du hast dich von diesem Event abgemeldet" |
| schon eingecheckt | „Du bist bereits eingecheckt" (kein Fehler, keine zweiten Punkte) |
| Code einer anderen Gemeinde | „Kein Zugriff auf dieses Event" |

Teamer:innen können sich ebenfalls einchecken — sie werden als anwesend
verbucht, bekommen aber keine Punkte.

Ein erfolgreicher Scan wirkt **sofort**: Die Anwesenheit steht, die Punkte sind
gutgeschrieben, die Person bekommt „Teilnahme bestätigt!" aufs Gerät, und
Abzeichen wie Level werden geprüft. Nachtragen musst du nichts; der Termin
taucht nur dann noch unter „Verbuchen" auf, wenn Personen offen sind, die nicht
gescannt haben.

### Wissen, warum Konfis den Code nicht sehen

Würde der Code in der Konfi-App auftauchen, könnte sich jeder von zu Hause aus
als anwesend eintragen. Deshalb wird er ausschließlich an das Team
ausgeliefert, und auch dort nur in der Detailansicht des einzelnen Termins —
nie in der Terminliste.

Leitung und Teamer:innen kommen gleichermaßen an den Code: oben rechts im
geöffneten Termin über das QR-Symbol. Sind vor Ort nur Teamer:innen, reicht
das also. Der Code wird beim ersten Anzeigen erzeugt, bleibt danach gleich und
läuft nicht ab; die zeitliche Begrenzung macht allein das Check-in-Fenster.

## Eine Serie anlegen

Statt zwölf Konfi-Stunden einzeln anzulegen, legst du eine Serie an. Der
Abschnitt erscheint nur beim Anlegen, nicht beim Bearbeiten.

| | |
|---|---|
| Anzahl Termine | **2 bis 26** (bei „Monatlich" höchstens 12) |
| Intervall | Täglich · Wöchentlich · Alle 2 Wochen · Monatlich |
| Zeitspanne | **höchstens 12 Monate** vom ersten bis zum letzten Termin |

Unter den Einstellungen steht immer das Datum des letzten Termins. Reißt du die
12-Monats-Grenze, verweigert das System das Speichern.

Die Termine werden durchnummeriert: aus „Konfi-Stunde" wird „Konfi-Stunde #1",
„Konfi-Stunde #2" und so weiter. Das lässt sich nicht abschalten.

Alle Einstellungen — Punkte, Plätze, Warteliste, Kategorien, Jahrgänge,
Pflicht-Häkchen, Check-in-Fenster, Teamer-Kontingent — werden auf jeden Termin
der Serie übertragen, mit denselben Zwangsregeln wie beim Einzeltermin.

### Verstehen, wie das Anmeldefenster mitwandert

Eine Einstellung wird nicht kopiert, sondern **mitverschoben**: der
Anmeldezeitraum. Du stellst ihn einmal für den ersten Termin ein, und der
**Abstand** gilt dann für jeden weiteren Termin.

Erster Termin am 1. September, Anmeldung ab dem 25. August, also sieben Tage
vorher:

| Termin | Anmeldung öffnet |
|---|---|
| 1. September | 25. August |
| 8. September | 1. September |
| 15. September | 8. September |
| 22. September | 15. September |

Immer sieben Tage vor dem jeweiligen Termin, nicht immer am 25. Dasselbe gilt
für den Anmeldeschluss. Der Abstand wird als echte Zeitspanne gerechnet, nicht
als Tag im Kalender — eine Serie darf also über einen Monats- oder
Jahreswechsel laufen.

> **Brauchst du es anders** — etwa eine Anmeldung, die für alle Termine
> gleichzeitig öffnet — geht das nicht über die Serie. Dann legst du die
> Termine einzeln an oder passt die Anmeldezeiten hinterher an.

### Wissen, dass es keine Serien-Bearbeitung gibt

Nach dem Anlegen sind es ganz normale Einzeltermine, die nur eine gemeinsame
Kennung teilen. Einen Termin bearbeiten, löschen oder absagen betrifft immer
nur **diesen einen**; die übrigen bleiben.

> **Willst du an einer zwölfteiligen Serie den Ort ändern, sind das zwölf
> Bearbeitungen.** Prüfe die Einstellungen also lieber einmal zu viel, bevor du
> eine lange Serie speicherst.

## Einen Termin absagen oder löschen

Zwei verschiedene Dinge, die oft verwechselt werden.

| | Absagen | Löschen |
|---|---|---|
| Termin bleibt sichtbar | **ja, durchgestrichen als „Abgesagt"** | nein, weg |
| Anmeldungen | bleiben erhalten | **werden mitgelöscht** |
| Termin-Chat und Nachrichten | bleiben | **werden mitgelöscht** |
| Wer wird benachrichtigt | Angemeldete **und** Wartende | Angemeldete und Wartende |
| Rückgängig | nein, aber der Termin ist noch da | **nein** |
| Neue Anmeldungen möglich | nein | — |

**Absagen** ist der saubere Weg: Der Termin wird als abgesagt markiert, alle
Angemeldeten und alle auf der Warteliste bekommen einen Push, der Termin bleibt
durchgestrichen in der Liste stehen. Ein bereits abgesagter Termin lässt sich
nicht nochmal absagen.

**Löschen** ist endgültig. Gelöscht werden der Termin selbst, alle Anmeldungen,
alle Zeitfenster, die Zuordnung zu Kategorien und Jahrgängen sowie der komplette
Termin-Chat mit allen Nachrichten, Umfragen und Dateien. Damit das nicht
versehentlich passiert, fragt das System nach — einmal wegen der Anmeldungen
(„Für dieses Event gibt es 12 Anmeldung(en). Beim Löschen werden alle
benachrichtigt.") und einmal wegen des Chats („Der Event-Chat enthält 34
Nachricht(en). Beim Löschen gehen sie verloren.").

> **Faustregel:** Ein Termin, der stattfinden sollte und ausfällt, wird
> **abgesagt**. Ein Termin, den es nie hätte geben sollen (Tippfehler,
> versehentlich angelegt), wird **gelöscht**.

## Nachvollziehen, wann automatisch benachrichtigt wird

Änderst du an einem **zukünftigen, nicht abgesagten** Termin das Datum, die
Uhrzeit, die Endzeit oder den Ort, bekommen alle Angemeldeten und alle auf der
Warteliste automatisch einen Push mit der Änderung. Das passiert beim
Speichern, du musst es nicht auslösen.

Änderst du nur den Namen, die Beschreibung, die Punkte oder die Platzzahl,
kommt kein Push. Bei vergangenen Terminen ebenfalls nicht.

## Einen Termin-Chat einrichten

Zu jedem Termin lässt sich ein Gruppenchat einrichten — **nicht automatisch**.
Jemand aus Leitung oder Team muss ihn in der Detailansicht über den Chat-Knopf
anlegen und die Rückfrage bestätigen. Pro Termin gibt es genau einen; ein
zweiter Versuch meldet „Chat existiert bereits für dieses Event".

Beim Anlegen kommen hinein: die Person, die den Chat erstellt, und alle, die zu
diesem Zeitpunkt **bestätigt angemeldet** sind — Konfis, Teamer:innen und
Leitung gleichermaßen. Wer auf der Warteliste steht, ist nicht dabei.

> **Wer sich nach dem Anlegen anmeldet, wird nicht hinzugefügt** — auch nicht,
> wer von der Warteliste nachrückt. Lege den Chat also möglichst spät an, am
> besten erst nach dem Anmeldeschluss. Sonst fehlt die Hälfte drin.

Wer sich vom Termin abmeldet, wird gleichzeitig aus dem Chat entfernt. Wird der
Termin gelöscht, verschwindet der Chat mitsamt allem; beim Absagen bleibt er
bestehen.

Was sonst im Termin-Chat gilt — schreiben, Umfragen, Dateien —, steht im
Kapitel [Chat](90-chat.md#die-fuenf-chat-arten-unterscheiden).

## Teilnehmende von Hand hinzufügen

In der Detailansicht kannst du Leute selbst eintragen — praktisch für alle, die
keine App haben oder die Frist verpasst haben. Der Anmeldezeitraum gilt hier
nicht, du kannst also auch nach Anmeldeschluss noch jemanden eintragen.

Sonst gelten dieselben Regeln wie bei der Selbstanmeldung:

- Eine Teamer:in lässt sich nur bei „Konfis, Team gesucht" oder „Nur Team"
  eintragen
- Ein Konfi lässt sich nicht in einen reinen Team-Termin eintragen
- Bei Zeitfenster-Terminen musst du ein Fenster auswählen
- Doppelte Anmeldungen werden abgewiesen

## Material an einem Termin finden

Hängt [Material](30-leitung.md#die-gemeinde-unter-mehr-einstellen) an einem Termin, zeigen Terminliste und
Detailansicht das für Leitung und Teamer:innen an. In der Detailansicht steht
der Hinweis direkt bei den Eckdaten und ist klickbar: Bei einem einzelnen
Material öffnet sich sofort dessen Ansicht, bei mehreren springt die Seite zur
Materialliste weiter unten. Konfis sehen Material grundsätzlich nicht.

## Häufige Stolpersteine nachschlagen

> **„Ich habe Punkte eingetragen, aber es gibt keine."**
> Prüfe die fünf Bedingungen. Am häufigsten: Es ist ein Pflicht-Event oder eine
> Konfirmation (dort sind Punkte immer 0), oder der Punkt-Typ ist im Jahrgang
> abgeschaltet.

> **„Die Teamer:innen sehen den Termin nicht."**
> Teamer:innen sehen nur Termine ihrer eigenen Jahrgänge. Ausgenommen sind
> „Nur Team"-Termine und Termine ohne jeden Jahrgang.

> **„Der Termin ist ausgebucht, obwohl noch Plätze frei sind."**
> Bei Zeitfenster-Terminen zählt das einzelne Fenster, nicht die Summe.

> **„Ich habe die Teilnehmerzahl reduziert, es sind aber immer noch zu viele
> drin."**
> So ist es gedacht: Bestätigte Anmeldungen werden nie zurückgestuft.

> **„Die Hälfte fehlt im Termin-Chat."**
> Der Chat nimmt nur mit, wer beim Anlegen schon angemeldet war. Später
> Angemeldete und Nachrücker kommen nicht dazu.

> **„Der Konfi kann sich nicht abmelden."**
> Bei freiwilligen Terminen geht Abmelden nur bis 2 Tage vor dem Termin. Du
> selbst kannst die Anmeldung in der Detailansicht trotzdem entfernen.
