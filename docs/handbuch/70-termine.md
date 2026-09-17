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

**Die Terminverwaltung liegt bei der Leitung.** Anlegen — einzeln wie als
Serie —, Ändern, Absagen, Löschen, Personen eintragen oder entfernen und die
Anwesenheit verbuchen sind Sache der Admins und Org-Admins. Teamer:innen sagen
für sich selbst zu oder ab, zeigen den QR-Code zum Einchecken und öffnen den
Termin-Chat; was am Termin steht, lesen sie mit — einschließlich des Grundes,
wenn er abgesagt wurde.

Für die Leitung gilt dabei weiterhin die Jahrgangsgrenze: Anlegen, Ändern,
Absagen, Löschen, Personen eintragen und Verbuchen gehen nur in den eigenen
Jahrgängen, und ein Termin lässt sich auch nur Jahrgängen zuordnen, die man
selbst betreut.

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
| Endzeit | zwei Stunden nach Beginn |
| Anmeldung ab | sofort (kein Startzeitpunkt) |
| Anmeldeschluss | 24 Stunden vor Beginn, bei kurzfristigen Terminen früher |
| Max. Teilnehmer:innen | 5 (einstellbar 1 bis 50) |
| Punkte | 1, Typ Gemeinde |
| Warteliste | an, 3 Plätze |
| Check-in-Fenster | 30 Minuten |

## Einen Termin kopieren

Wiederholt sich ein Termin, ohne eine Serie zu sein — die Freizeit im nächsten
Jahr, der Jugendgottesdienst im neuen Halbjahr —, kopierst du ihn, statt alles
neu einzutippen. In der Terminliste wischst du den Termin nach links und tippst
auf das Kopieren-Symbol; in der Detailansicht steht es oben neben dem Stift.

**Es wird dabei nichts angelegt.** Das Formular öffnet sich wie bei einem neuen
Termin, nur mit allen Werten des Originals darin. Du änderst, was du ändern
willst, und speicherst. Willst du doch nicht, schließt du das Fenster — dann ist
nichts passiert. Nach dem Speichern landest du in der Terminliste, in der der
neue Termin sofort steht.

Mit kommen Titel, Beschreibung, Ort, Mitbringsel, Punkte, Kategorien, Jahrgänge,
Plätze und Wartelisten, das Teamer-Kontingent, Pflicht- und
Konfirmations-Kennzeichen, das Check-in-Fenster und die Zeitfenster.

Nicht mit kommen **Material und Chat** — die hängen am ursprünglichen Termin und
werden für den neuen frisch angelegt. Ebenso wenig die Anmeldungen, die
Anwesenheit und die vergebenen Punkte: Die gehören zu dem Termin, der
stattgefunden hat. Die Kopie eines abgesagten Termins ist nicht abgesagt — so
holst du einen ausgefallenen Termin nach.

Das **Datum** steht auf heute, gerechnet wie bei einem neuen Termin; der
Anmeldeschluss folgt daraus (siehe [Kurzfristige Termine](#kurzfristige-termine))
und kann deshalb nicht in der Vergangenheit liegen. Die **Dauer** bleibt: Aus
einem Wochenende wird wieder ein Wochenende, auch wenn du das Datum verschiebst.

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

> **Ist der Termin abgesagt, gibt es kein Zurück.** Dann steht statt des
> Knopfes „Dieser Termin ist abgesagt" — er findet nicht statt, es gibt also
> nichts, wozu man sich anmelden könnte. Soll er doch stattfinden,
> [nimm die Absage zurück](#eine-absage-zuruecknehmen); dabei kommen alle
> wieder, die nur wegen der Absage abgemeldet waren.

> **Wer abgemeldet ist, kann sich nicht per QR-Code einchecken** — der Scanner
> meldet „Du hast dich von diesem Event abgemeldet". Wer doch spontan kommt,
> meldet sich vorher wieder an oder wird von dir
> [von Hand verbucht](#eine-selbstabmeldung-nachtraeglich-verbuchen).

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

### Kurzfristige Termine

Der Anmeldeschluss wird mit 24 Stunden vor Beginn vorgeschlagen. Liegt der
Termin näher — du trägst am Nachmittag etwas für den Abend ein —, rückt der
Vorschlag nach und landet zwischen jetzt und Beginn, statt in der
Vergangenheit. So bleibt immer ein Fenster offen, in dem sich jemand anmelden
kann. Du kannst ihn wie jeden anderen Wert danach frei setzen.

Trägst du bei einem Termin, der noch bevorsteht, von Hand einen bereits
abgelaufenen Anmeldeschluss ein, sagt das Speichern es und der Termin wird
nicht angelegt — er wäre von Anfang an geschlossen. Bei Terminen, die du
nachträglich einträgst oder korrigierst, ist ein Anmeldeschluss in der
Vergangenheit dagegen richtig und bleibt erlaubt.

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

### Lesen, wen die Teilnehmerzahl meint

**Angemeldet ist, wer weder abgemeldet noch auf der Warteliste steht.** Wer
sich selbst abgemeldet hat und wen du abgemeldet hast, zählt nicht mit — beide
geben ihren Platz frei, und beide stehen unter „Abgemeldet". Bei 13
eingetragenen Konfis, von denen zwei abgemeldet sind, steht überall 11: auf
den Kacheln, in der Liste, in der Rückfrage vor dem Absagen und in der
Konfi-Ansicht.

Teamer:innen und zugeordnete Leitung zählen nie in die Konfi-Zahl. Sie haben
ihr eigenes Kontingent und stehen getrennt daneben.

Bei einem **abgesagten** Termin ist niemand mehr angemeldet — dort steht
deshalb keine Platz-Zahl, sondern wie viele der Termin erreicht hat.

### Nachvollziehen, wann jemand nachrückt

**Wird ein belegter Platz frei, rückt nach.** Das gilt für jeden Weg, auf dem
ein Platz frei wird — nicht nur für die Abmeldung durch die Person selbst:

| Auslöser | Was passiert |
|---|---|
| Jemand meldet sich selbst ab | die erste wartende Person rückt nach |
| Eine Konfi meldet sich von einem Pflichttermin ab | dasselbe |
| Du meldest jemanden ab („Abgemeldet") | dasselbe |
| Du trägst jemanden aus | dasselbe |
| Du setzt jemanden auf die Warteliste zurück | dasselbe |
| Du löschst eine Konfi | auf jeden ihrer Plätze rückt jemand nach |
| Du beförderst eine Konfi zur Teamer:in | dasselbe — ihre Konfi-Plätze werden frei |
| Du verschiebst eine Konfi in einen anderen Jahrgang | auf den Plätzen der Termine des alten Jahrgangs rückt nach |
| Du erhöhst die Teilnehmerzahl | so viele rücken nach, wie neue Plätze da sind |
| Du erhöhst die Plätze eines Zeitfensters | dasselbe, aber nur in diesem Zeitfenster |
| Du erhöhst das Teamer-Kontingent | die wartenden Teamer:innen rücken nach |

Nachgerückt wird in der Reihenfolge der Anmeldung; die nachgerückte Person
bekommt einen Push und kommt in den Chat zum Termin, falls es einen gibt.
Gelöschte Nutzer:innen rücken nie nach.

> **Ein frei gewordener Konfi-Platz geht niemals an eine wartende Teamer:in** —
> und umgekehrt. Die beiden Wartelisten werden strikt getrennt geführt.

> **An einem abgesagten Termin rückt niemand nach.** Der Termin findet nicht
> statt; eine Meldung „Ein Platz ist frei geworden, du bist jetzt angemeldet"
> wäre dort schlicht falsch. Wer auf der Warteliste steht, bleibt stehen.

Setzt du jemanden auf die Warteliste zurück, geht der geräumte Platz an die
**nächste wartende Person** — nicht an die eben herabgestufte zurück. Wartet
sonst niemand, bleibt sie schlicht auf der Warteliste stehen.

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

### Selbst zu- oder absagen

Unter „Bist du dabei?" beantwortest du den Termin für dich selbst — in der
Leitungsansicht genauso wie im Team. Solange du noch nichts gesagt hast,
stehen beide Knöpfe nebeneinander: **„Dabei"** und **„Nicht dabei"**. Hast du
geantwortet, bleibt nur noch der Weg zurück stehen — nach einer Zusage
**„Nicht mehr dabei"**, nach einer Absage **„Doch dabei"**. Wo du gerade
stehst, zeigt das Zeichen an der Karte.

Der Abschnitt erscheint nur bei Terminen, die Team-Anmeldungen annehmen, und
nur solange der Termin weder vergangen noch abgesagt ist. Du zählst dabei in
dasselbe Kontingent wie die Teamer:innen.

Für den Grund gilt dieselbe Regel wie unten: Sagst du nach einer Zusage ab,
fragt ein Fenster nach dem Grund, sonst ist er freiwillig.

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

Unter jedem Fenster stehen die Angemeldeten, und zwar mit demselben Zustand wie
in Terminen ohne Zeitfenster: anwesend, abwesend, abgemeldet oder gebucht, in
denselben Farben und mit dem Abmeldegrund darunter. Wer sich abgemeldet hat,
bleibt dort sichtbar — der Platz ist damit nicht frei, sondern belegt und
abgemeldet.

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

In drei Fällen nimmt das System die Punkte vollständig zurück, inklusive Abzug
vom Punktestand: Du stellst die Anwesenheit von **anwesend auf fehlend**, du
trägst eine [Abmeldung nach](#eine-abmeldung-nachtragen), oder die Person
**meldet sich ab**, obwohl sie schon als anwesend verbucht war. Der
Punktestand fällt dabei nie unter null.

Ein Abzeichen, das durch diese Punkte ausgelöst wurde, bleibt bestehen —
[Abzeichen werden nie aberkannt](60-badges.md#ein-abzeichen-aus-dem-verkehr-ziehen).

## Die Anwesenheit verbuchen

Nach dem Termin trägst du ein, wer da war. Es gibt drei Wege: einzeln, alle auf
einmal, oder die Leute checken sich selbst per QR-Code ein.

**Einzeln** geht es in der Teilnehmerliste: Tipp auf den Eintrag, dann
**Anwesend**, **Abwesend** oder **Abgemeldet**. Punkte werden sofort vergeben
oder abgezogen, und bei „Anwesend" und „Abwesend" bekommt die Person einen
Push. Das Menü gibt es auch bei Leuten, die sich
[selbst abgemeldet haben](#eine-selbstabmeldung-nachtraeglich-verbuchen).

### Eine Abmeldung nachtragen

Wird jemand außerhalb der App abgemeldet — die Mutter ruft an, das Kind ist
krank —, tippst du den Eintrag an und wählst **Abgemeldet**. Es öffnet sich ein
Fenster mit zwei Feldern: dem **Grund** und einer **Notiz**. Der Grund gehört
zur Abmeldung („krank, Mutter hat angerufen"), die Notiz zu allem anderen, was
festgehalten gehört („Attest liegt vor"). Beides ist freiwillig, beides lässt
sich später über denselben Weg ändern.

Nach dem Speichern wird der Eintrag grau, der Grund steht direkt in der
Teilnehmerliste, und alle im Team sehen ihn.

Punkte gibt es dabei keine; schon vergebene werden zurückgenommen, genau wie
bei „Abwesend". Die Konfi bekommt eine Mitteilung, dass die Abmeldung
eingetragen wurde — so sieht sie, dass der Anruf von zu Hause angekommen ist.

Danach ist für sie Ruhe: Die Terminerinnerungen am Vortag und kurz vor Beginn
bleiben aus. Das gilt für jede verbuchte Anwesenheit — wer als anwesend,
abwesend oder abgemeldet eingetragen ist, bekommt zu diesem Termin keine
Erinnerung mehr.

**Der Platz wird frei.** Eine Abmeldung zählt nicht mehr als Anmeldung: Der
Termin hat wieder einen Platz mehr, und wartet jemand, [rückt er
nach](#nachvollziehen-wann-jemand-nachrueckt). In der Teilnehmerliste rutscht
die abgemeldete Person nach unten zu den anderen Abgemeldeten, statt zwischen
den Anwesenden zu stehen.

Einchecken kann sie sich danach nicht mehr selbst: Der QR-Scanner meldet „Du
wurdest von diesem Termin abgemeldet". Steht sie doch vor dir, trägst du sie
über dasselbe Menü als **Anwesend** ein — damit zählt die Anmeldung wieder,
und die Punkte gibt es auch.

**Wieder anmelden kann sie sich aber selbst.** Wird das Kind rechtzeitig
gesund, steht der Termin für sie wieder da wie jeder andere offene Termin, und
sie meldet sich neu an. Dabei gilt, was für alle gilt: Ist der Anmeldeschluss
vorbei, kommt sie nicht mehr hinein; ist der Termin voll, landet sie auf der
Warteliste; bei Zeitfenstern wählt sie wieder eines aus. Der Abmeldegrund
verschwindet in dem Moment aus der Teilnehmerliste — die neue Anmeldung ersetzt
die Abmeldung.

Am Termin selbst bleibt es beim Weg über dich: Der QR-Scanner ist gesperrt,
damit niemand sich die Punkte zurückholt, die die Abmeldung genommen hat.

### Einen falschen Eintrag zurücknehmen

Hast du jemanden versehentlich abgemeldet oder auf der falschen Zeile
verbucht, tippst du den Eintrag an und wählst **Eintrag zurücksetzen**. Der
Eintrag ist danach weg: Die Person steht wieder als nicht verbucht in der
Liste, so wie vor deiner Eingabe.

Was dabei mitgeht: der Abmeldegrund, die Angabe, wer den Eintrag gemacht hat,
und die Punkte, falls welche vergeben waren. Was **bleibt**: die Notiz. Sie
gehört nicht zum Status — „Attest liegt vor" stimmt weiter, auch wenn die
Verbuchung zurückgenommen ist. Willst du sie auch los, leerst du sie über
**Notiz bearbeiten**.

Der Eintrag steht nur im Menü, wenn überhaupt etwas verbucht ist. Bei einer
Person, an der noch nichts eingetragen wurde, gibt es nichts zurückzunehmen.

War die Person abgemeldet, zählt sie danach wieder als angemeldet — ihr Platz
ist also wieder belegt. Ist der Termin inzwischen voll, weil jemand
[nachgerückt](#nachvollziehen-wann-jemand-nachrueckt) ist, hat er nun eine
Person mehr als vorgesehen; sieh in dem Fall auf die Teilnehmerzahl.

In der [Anwesenheits-Matrix](30-leitung.md#konfis-und-teamer-innen-verwalten) steht dafür ein
grauer Punkt, und der Termin zählt nicht in die Pflicht-Summe — so wie bei
einer Abmeldung, die der Konfi selbst in der App vorgenommen hat.

> **Zwei Wege zur selben Aussage.** Meldet sich die Konfi
> [selbst in der App ab](#eine-abmeldung-vom-pflicht-event-entgegennehmen),
> steht das als „Abgemeldet" mit ihrer eigenen Begründung. Trägst du eine
> Abmeldung nach, heißt sie in der Übersicht „Abgemeldet (nachgetragen)".
> Für Punkte und Summe zählt beides gleich.

### Eine Selbstabmeldung nachträglich verbuchen

Hat sich jemand selbst von einem Pflichttermin abgemeldet und kommt dann doch,
tippst du den Eintrag genauso an wie jeden anderen. Du bekommst dasselbe Menü:
**Anwesend**, **Abwesend**, **Abgemeldet** und die **Notiz**.

Sobald du etwas einträgst, richtet sich die Anzeige danach: Der Eintrag wird
grün, in der Anwesenheits-Matrix steht ein grüner Punkt, und der Termin zählt
wieder in die Pflicht-Summe. Die ursprüngliche Abmeldung bleibt als
Vorgeschichte darunter stehen — „Hatte sich abgemeldet: Familienfeier an dem
Tag" —, damit im Team nachvollziehbar ist, warum hier von Hand nachgetragen
wurde.

> **„Alle auf einmal" lässt Abmeldungen in Ruhe.** Der Sammelknopf verbucht nur
> die Angemeldeten. Wer sich abgemeldet hat, bleibt unangetastet, bis du dich
> ausdrücklich für ihn entscheidest.

### Sehen, wer den Eintrag gemacht hat

Unter dem Eintrag steht klein, wer ihn gemacht hat und wann: „Eingetragen von
Simon Luthe, 13.09." So ist bei einer Rückfrage klar, wen man fragt — wer mit
der Mutter telefoniert hat.

**Status und Notiz werden getrennt geführt.** Wer die Anwesenheit setzt und wer
die Notiz schreibt, ist oft nicht dieselbe Person. Deshalb nennt jede Zeile
ihren eigenen Urheber: „Eingetragen von …" steht unter Status und Grund,
„Notiz von …" unter der Notiz. Trägt eine Kollegin nachträglich nur eine Notiz
ein, bleibt der Name bei der Abmeldung stehen, wo er hingehört.

Festgehalten wird immer der **aktuelle** Stand. Ändert später jemand anderes
den Status oder die Notiz, steht dessen Name da. Speicherst du denselben Stand
noch einmal, ohne etwas zu ändern, bleiben die Namen, wie sie waren.

**Beim Check-in per QR-Code steht kein Name, sondern der Weg.** Dort hat sich
die Person selbst eingecheckt — es gibt niemanden aus dem Team, der es
eingetragen hätte, und ein Name an dieser Stelle läse sich wie eine
Entscheidung von euch. Stattdessen steht dort „Eingecheckt per QR-Code,
15.09.". Trägst du den Status später von Hand nach, tritt dein Name an die
Stelle dieser Zeile: Es gilt immer, was zuletzt gesetzt wurde.

Bei älteren Einträgen fehlt jede Zeile. Das heißt „nicht bekannt", nicht
„niemand" — für diese Buchungen wurde weder der Name noch der Weg
festgehalten.

### Eine Notiz hinzufügen

Manches ist kein eigener Status, gehört aber festgehalten: „ging um 14 Uhr",
„kam erst zur zweiten Hälfte", „Attest liegt vor". Dafür gibt es die **Notiz**
— ein freies Feld, das du zu **jedem** Anwesenheitsstatus eintragen kannst.

Die Notiz ändert nichts am Status: Wer anwesend ist, bleibt anwesend und
behält seine Punkte. Sie steht in der Teilnehmerliste unter dem Namen, damit
das ganze Team sie sieht, und bleibt stehen, auch wenn du den Status später
änderst.

Grund und Notiz sind zwei getrennte Felder. Der Grund gehört zur Abmeldung und
verschwindet, sobald du den Status auf anwesend oder abwesend stellst — die
Notiz bleibt.

Beides einzutragen geht erst, wenn ein Anwesenheitsstatus gesetzt ist.

### Eine Notiz ändern oder löschen

Tipp auf den Eintrag und wähle **Notiz bearbeiten**. Der bisherige Text steht
schon da; du überschreibst ihn und speicherst.

Zum Entfernen gibt es darunter **Notiz löschen**. Dasselbe passiert, wenn du
das Feld leerst und speicherst. Danach ist auch die Zeile weg, die nannte, wer
die Notiz geschrieben hatte — es gibt ja keine mehr. Am Anwesenheitsstatus,
an den Punkten und am Abmeldegrund ändert das Löschen nichts.

### Alle auf einmal verbuchen

Liegt ein Termin in der Vergangenheit und es gibt noch unverbuchte Anmeldungen,
zeigt er oben den Status **„Verbuchen"**. Der Knopf „Alle bestätigen" setzt
dann in einem Rutsch alle bestätigt angemeldeten Konfis ohne Anwesenheitsstatus
auf „anwesend" — inklusive Punkten, Abzeichen- und Level-Prüfung und Push.

Nicht angefasst werden dabei:

| | wird verbucht |
|---|---|
| Angemeldete Konfis ohne Status | **ja** |
| Bereits verbuchte (anwesend, fehlend oder abgemeldet) | nein, bleiben wie sie sind |
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

Der Anmeldeschluss des **ersten** Termins wird dabei so geprüft wie bei einem
Einzeltermin: Steht er in der Vergangenheit, während der Termin noch bevorsteht,
lässt sich die Serie nicht anlegen. Die Folgetermine erben den Abstand und
rücken damit ohnehin mit, deshalb genügt der Blick auf den ersten. Eine Reihe,
die komplett in der Vergangenheit liegt, kannst du weiterhin nachtragen.

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
| Anmeldungen | bleiben erhalten, alle werden abgemeldet | **werden mitgelöscht** |
| Termin-Chat und Nachrichten | bleiben | **werden mitgelöscht** |
| Wer wird benachrichtigt | Angemeldete **und** Wartende | Angemeldete und Wartende |
| Rückgängig | nein, aber der Termin ist noch da | **nein** |
| Neue Anmeldungen möglich | nein | — |

**Absagen** ist der saubere Weg: Der Termin wird als abgesagt markiert, alle
Angemeldeten und alle auf der Warteliste bekommen einen Push, der Termin bleibt
durchgestrichen in der Liste stehen. Ein bereits abgesagter Termin lässt sich
nicht nochmal absagen.

**Zu einem abgesagten Termin meldet sich niemand mehr an** — weder Konfis noch
Team, und auch du trägst dort niemanden mehr ein. Der Termin findet nicht
statt. Die Anmelde-Knöpfe und „Konfi hinzufügen" verschwinden deshalb, solange
die Absage steht. Abmelden geht weiter: Wer raus will, kommt raus. Soll wieder
jemand dazukommen, [nimm zuerst die Absage zurück](#eine-absage-zuruecknehmen).

### Einen Grund zur Absage angeben

Beim Absagen öffnet sich ein Fenster mit einem Feld für den Grund. Das Feld ist
freiwillig: Lässt du es leer, wird der Termin abgesagt und es wird nur die
Absage gemeldet — wie bei jeder Absage zuvor.

Schreibst du etwas hinein, geht der Grund an **alle Teilnehmenden**. Er steht
am Termin — in der Liste und in der Detailansicht, für Leitung, Team und Konfis
gleichermaßen — und er steht in der Mitteilung, die auf den Handys ankommt:
„Leider abgesagt: ‚Konfifreizeit' am Sa., 20.09. um 10:00 Uhr. Heizung im
Gemeindehaus defekt."

Unter dem Grund steht klein, wer abgesagt hat und wann („Abgesagt von Simon
Luthe, 15.09."). Bei Terminen, die vor der Einführung des Grundes abgesagt
wurden, fehlt diese Zeile — da ist schlicht nicht festgehalten, wer es war.

Hast du keinen Grund angegeben, steht in der Detailansicht „Kein Grund zur
Absage angegeben." Der Satz steht für Leitung, Team und Konfis gleichermaßen
da: Ohne ihn wäre nicht zu erkennen, ob niemand einen Grund geschrieben hat
oder ob die Absage aus der Zeit vor diesem Feld stammt.

> **Der Grund ist öffentlich.** Zwanzig Konfis lesen ihn auf dem
> Sperrbildschirm. Was intern bleiben soll, gehört nicht in dieses Feld,
> sondern in den Termin-Chat oder ins Gespräch.

### Angemeldete nach einer Absage verbuchen

Mit der Absage sind alle Angemeldeten und alle auf der Warteliste **abgemeldet**.
In der Teilnehmerliste stehen sie grau als „Abgemeldet", als Grund steht der
Absagegrund — hast du keinen angegeben, steht dort „Termin abgesagt". Punkte
gibt es dafür keine, und bereits vergebene sind zurückgenommen: Der Termin hat
nicht stattgefunden.

Das gilt auch für alle, **die du schon verbucht hattest**: Wer auf anwesend
oder abwesend stand, steht danach ebenfalls auf abgemeldet, und seine Punkte
für diesen Termin sind weg. Ein abgesagter Termin hat keine Anwesenden — wer
dort als anwesend stünde, wäre bei etwas anwesend gewesen, das nicht
stattgefunden hat. Auch der Vermerk, wer die Anwesenheit eingetragen hatte
oder dass jemand sich per QR-Code eingecheckt hat, fällt damit weg.

Das erspart dir das Nacharbeiten. Ein abgesagter Termin gilt damit als erledigt
und taucht nicht mehr als „noch zu verbuchen" in der roten Zahl am Reiter auf.

**Das ist die Voreinstellung, nicht das Ende.** Waren drei Konfis trotzdem da
und haben beim Abbauen geholfen, tippst du sie in der Teilnehmerliste an und
setzt sie auf **anwesend** — sie bekommen ihre Punkte wie an jedem anderen
Termin. Die übrigen bleiben abgemeldet. Genauso lässt sich der Grund bei
einzelnen Personen durch einen eigenen ersetzen, etwa „krank, Mutter hat
angerufen".

Eine **Abmeldung mit eigenem Grund** bleibt dagegen stehen. Hast du jemanden
vor der Absage abgemeldet, weil die Mutter angerufen hat, steht bei ihm
weiterhin „krank, Mutter hat angerufen" und nicht der Absagegrund. Der Grund
gehört der Person und nicht dem Termin. Dasselbe gilt für Konfis, die sich
selbst von einem Pflichttermin abgemeldet haben, und für Teamer:innen, die
schon abgesagt hatten: Ihre Rückmeldung bleibt so stehen, wie sie ist.

### Den Grund nachtragen oder ändern

Der Grund lässt sich an einem abgesagten Termin jederzeit nachtragen, ändern
oder wieder entfernen. Eine Absage ist oft eilig — wer morgens um sieben in
Eile nichts eingetragen hat oder sich vertippt, kommt so noch einmal heran.

Der Weg dorthin führt über die **Terminliste**: Wisch den abgesagten Termin
nach links — dort, wo bei den übrigen „Absagen" steht, liegt bei einem
abgesagten Termin der Stift. Diesen Wisch hat die Leitung.

Im Termin selbst steht der Grund nur zum Lesen. Der Abschnitt „Absage" nennt
ihn und darunter, wer abgesagt hat; geändert wird er in der Liste.

Es öffnet sich dasselbe Fenster wie beim Absagen, mit dem Text, der bisher
dasteht. Leerst du das Feld und speicherst, fällt der Grund weg und der Termin
steht wieder nur als abgesagt da.

**Eine neue Mitteilung geht dabei nicht raus.** Die Absage ist schon gemeldet;
eine Korrektur am Begleittext ist keine zweite Absage. Wer möchte, dass alle
von der Änderung erfahren, schreibt sie in den Termin-Chat.

**Der neue Text kommt trotzdem überall an.** Er steht danach nicht nur am
Termin, sondern auch in der Teilnehmerliste bei allen, die durch die Absage
abgemeldet wurden — als ihr Abmeldegrund. Löschst du den Grund ganz, steht bei
ihnen wieder „Termin abgesagt".

Wem du vorher einen **eigenen Grund** eingetragen hast, etwa „krank, Mutter hat
angerufen", der behält ihn. Dieser Grund gehört der Person und nicht dem
Termin; eine Korrektur am Absagegrund rührt ihn nicht an.

Ändert jemand anderes den Grund als die Person, die abgesagt hat, steht das
darunter („Grund geändert von Anna Meier, 16.09."). „Abgesagt von" nennt
weiterhin, wer den Termin tatsächlich abgesagt hat — wer einen Tippfehler
korrigiert, hat den Termin nicht abgesagt. Ändert die absagende Person ihren
eigenen Grund, bleibt es bei der einen Zeile.

Wer bearbeiten darf, richtet sich nach denselben Regeln wie das Absagen: Wer
den Termin nicht hätte absagen dürfen, ändert auch den Grund nicht. Teamer:innen
und Konfis lesen den Grund nur; sie haben den Wisch nicht.

### Eine Absage zurücknehmen

Die Heizung ist doch rechtzeitig repariert, der Sturm zieht vorbei: Ein
abgesagter Termin lässt sich wieder aufleben lassen. Du musst ihn dafür nicht
neu anlegen — Anmeldungen, Warteliste und Chat bleiben, wo sie waren.

Es gibt zwei Wege dorthin, genau wie beim Absagen. In der **Terminliste** den
Termin nach links wischen: An einem abgesagten Termin liegen dort zwei
Aktionen nebeneinander — der grüne Pfeil nimmt die Absage zurück, der Stift
daneben öffnet den Grund. Oder **im Termin selbst**, ganz unten: Dort, wo bei
einem laufenden Termin „Event absagen" steht, steht bei einem abgesagten der
grüne Knopf „Absage zurücknehmen". Beide Wege hat die Leitung, beide fragen
dasselbe.

Vorher fragt das System nach und nennt dir, **wie viele Personen wieder
angemeldet werden** — denn genau die bekommen gleich eine Mitteilung.

**Was zurückkommt:** Alle, die durch diese Absage abgemeldet wurden, sind
wieder angemeldet — jede genau dort, wo sie vorher stand. Wer einen festen
Platz hatte, hat ihn wieder; wer auf der Warteliste war, wartet weiter. Der
Absagegrund verschwindet, und der Termin steht wieder ganz normal in den
Listen: Man kann sich anmelden, und die Warteliste rückt wieder nach.

**Was nicht zurückkommt:**

- **Wer schon vor der Absage abgemeldet war, bleibt abgemeldet.** Egal ob er
  sich selbst abgemeldet hat oder du ihn abgemeldet hast, weil die Mutter
  angerufen hatte: Diese Entscheidung galt unabhängig von der Absage und gilt
  weiter. Auch der eigene Grund („krank, Mutter hat angerufen") bleibt stehen.
- **Punkte werden nicht wiederhergestellt.** Der Termin steht ja erst bevor.
  Punkte gibt es, wenn du die Anwesenheit verbuchst — wie an jedem anderen
  Termin.
- **Eine Anwesenheit von vor der Absage kommt nicht zurück.** Wen du damals
  auf anwesend oder abwesend gesetzt hattest, steht nach dem Zurücknehmen
  wieder als noch nicht verbucht in der Liste — die Absage hatte ihn
  abgemeldet. Das überrascht, ist aber richtig: Der Termin steht jetzt ja
  wieder bevor. Verbucht wird, wenn er gelaufen ist.

**Alle Wiederangemeldeten bekommen eine Mitteilung:** „Termin findet doch
statt" — mit dem Hinweis, dass sie wieder angemeldet sind und bitte prüfen
sollen, ob sie Zeit haben. Wer nicht kann, meldet sich über den Termin ab. Wer
abgemeldet bleibt, bekommt keine Nachricht: Sie ginge ihn nichts an.

Wer zurücknehmen darf, richtet sich nach denselben Regeln wie das Absagen: die
Leitung. Teamer:innen sehen, dass und warum ein Termin abgesagt ist, ändern
daran aber nichts.

### Wo ein abgesagter Termin steht

Das richtet sich nach dem Datum: Solange der Termin noch bevorsteht oder
läuft, findest du ihn unter **„Aktuell"**, danach unter **„Vergangen"** —
durchgestrichen in beiden Fällen. Unter **„Verbuchen"** taucht er nicht auf:
An einem abgesagten Termin gibt es nichts zu verbuchen.

In allen Listen und auf den Startseiten steht ein abgesagter Termin
durchgestrichen und grau, mit rotem Zeichen in der Ecke — für Leitung, Team und
Konfis gleich. In der Detailansicht bleibt der Titel ungestrichen: Dort sagen
die Überschrift „Abgesagt", die rote Farbe und der Abschnitt „Absage" mit dem
Grund ohnehin schon, woran man ist. Dieser Abschnitt steht in einer Karte wie
die Details und die Beschreibung darunter — nur das Zeichen im Kopf und das
Wort „Abgesagt:" sind rot.

Konfis sehen einen abgesagten Termin nur, wenn sie dafür angemeldet waren — er
geht sie ja an. Er steht in beiden Reitern an seinem Datum: unter **„Alle"**
zwischen den Terminen, für die man sich noch anmelden kann, und unter
**„Meine"** bei den eigenen. Beide Male durchgestrichen und mit rotem Zeichen.
Der Platz im Kalender ist der Punkt: An dem Tag war etwas geplant, und dass
genau das ausfällt, ist die Nachricht. Am Listenende wäre an seiner Stelle nur
eine Lücke.

### Einen Termin löschen

**Löschen** ist endgültig. Gelöscht werden der Termin selbst, alle Anmeldungen,
alle Zeitfenster, die Zuordnung zu Kategorien und Jahrgängen sowie der komplette
Termin-Chat mit allen Nachrichten, Umfragen und Dateien. Damit das nicht
versehentlich passiert, fragt das System zweimal nach. Die erste Frage ist die
gewöhnliche Sicherheitsfrage. Hängt am Termin noch etwas dran, kommt danach eine
zweite und nennt genau, was verloren geht: die Zahl der Anmeldungen, die Zahl
der Chat-Nachrichten samt Dateien und die bereits vergebenen Punkte, die den
Konfis wieder abgezogen werden. Erst nach **Endgültig löschen** ist der Termin
weg. Ist der Termin leer, entfällt die zweite Frage.

Löschst du eine ganze Serie oder „diesen und alle folgenden", zählt die zweite
Frage über alle betroffenen Termine zusammen.

Benachrichtigt wird beim Löschen nur, wer es noch nicht weiß: Löschst du einen
Termin, der **noch nicht abgesagt** war, bekommen alle Angemeldeten und alle
auf der Warteliste die Meldung, dass er ausfällt. Räumst du dagegen einen
**bereits abgesagten** Termin auf, bleibt es still — die Absage war schon
gemeldet, ein zweites Mal sagt sie niemandem etwas Neues.

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

Eine Mitteilung geht außerdem raus, wenn du jemanden
[von Hand einträgst](#teilnehmende-von-hand-hinzufuegen) und wenn jemand
[von der Warteliste nachrückt](#nachvollziehen-wann-jemand-nachrueckt).

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

**Wer eingetragen wird, bekommt einen Push** — Konfis, Teamer:innen und
Leitung gleichermaßen, mit derselben Meldung wie bei der Selbstanmeldung. Ist
kein Platz mehr frei oder trägst du jemanden bewusst auf die Warteliste ein,
steht das in der Meldung. Trägst du dich selbst ein, bekommst du nichts aufs
eigene Handy.

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
