---
titel: Termine
untertitel: Anlegen, Anmeldung, Anwesenheit und Punkte
farbe: "#dc2626"
gruppe: Nachschlagen
---

Termine (im System „Events") sind alles, wozu man kommen kann: Gottesdienste,
Ausflüge, Konfi-Tage, die Konfirmation selbst. Ein Termin regelt **wer sich
anmelden darf**, **wie viele mitkommen können**, **ob es Punkte gibt** und
**wie du hinterher die Anwesenheit verbuchst**.

Dieses Kapitel geht das Anlege-Formular Abschnitt für Abschnitt durch. Fast
jede Einstellung schaltet andere Einstellungen ab — deshalb lohnt es sich, die
Reihenfolge einzuhalten: **erst die Zielgruppe, dann alles andere.**

## Der schnellste Weg zum ersten Termin

1. Name und Datum eintragen
2. „Für wen ist das Event?" auf **Nur Konfis** lassen
3. Plätze festlegen (oder „Unbegrenzte Teilnehmer:innen" einschalten)
4. Punkte festlegen
5. Speichern

Alles andere — Warteliste, Zeitfenster, Serie, QR-Check-in — ist optional und
hat sinnvolle Voreinstellungen.

---

## Zielgruppe: „Für wen ist das Event?"

**Diese Auswahl steht ganz oben und entscheidet über alles Weitere.** Sie legt
fest, welche Abschnitte im Formular überhaupt erscheinen.

| | Nur Konfis | Konfis, Teamer:innen gesucht | Nur Teamer:innen |
|---|---|---|---|
| Konfis sehen den Termin | ja | ja | **nein** |
| Konfis können sich anmelden | ja | ja | nein |
| Teamer:innen können sich anmelden | **nein** | ja | ja |
| Abschnitt „Konfis" (Plätze, Punkte) | ja | ja | **weg** |
| Abschnitt „Teamer:innen" (Kontingent) | **weg** | ja | ja |
| Pflicht-Event möglich | ja | ja | **weg** |
| Konfirmation möglich | ja | ja | **weg** |
| Anmeldezeitraum möglich | ja | ja | **weg** |
| Zeitfenster möglich | ja | ja | **weg** |

### Nur Konfis

Der Normalfall. Teamer:innen können sich hier **nicht** anmelden — auch nicht
über einen Umweg; der Server lehnt es ab („Dieses Event ist nicht für
Teamer:innen buchbar"). Sie sehen den Termin nur, wenn er einem Jahrgang
zugeordnet ist, den sie betreuen, oder wenn er gar keinem Jahrgang zugeordnet
ist.

### Konfis, Teamer:innen gesucht

Beide Gruppen können mitmachen — mit **zwei völlig getrennten Kontingenten**.
Zehn Konfi-Plätze und drei Teamer-Plätze sind zehn und drei, nicht dreizehn.
Ein freigewordener Konfi-Platz geht nie an eine wartende Teamer:in und
umgekehrt.

Der Termin ist für **alle** Teamer:innen sichtbar, unabhängig davon, welche
Jahrgänge sie betreuen.

### Nur Teamer:innen

Zum Beispiel eine Teamer-Schulung oder Vorbereitungsrunde. Konfis sehen den
Termin gar nicht — er wird aus ihrer Liste herausgefiltert.

Umschalten auf „Nur Teamer:innen" setzt sofort **Pflicht-Event aus,
Konfirmation aus und Zeitfenster aus** — alle drei sind Konfi-Angelegenheiten.
Beim Speichern werden zusätzlich Punkte, Konfi-Plätze, Jahrgänge und das
Anmeldefenster auf null gesetzt.

> **Achtung:** „Konfis, Teamer:innen gesucht" und „Nur Teamer:innen" schließen
> sich gegenseitig aus — das erzwingt auch die Datenbank. Es gibt kein
> „irgendwie beides".

---

## Pflicht-Event

Ein Pflicht-Event ist ein Termin, zu dem **der ganze Jahrgang automatisch
angemeldet ist**. Niemand muss sich anmelden, weil alle schon drin sind.

### Was „automatisch angemeldet" konkret heißt

In dem Moment, in dem du speicherst, legt das System für **jeden Konfi der
ausgewählten Jahrgänge** eine bestätigte Anmeldung an. Alle bekommen einen
Push: „Neues Pflicht-Event".

Deshalb gilt: **Pflicht-Events brauchen mindestens einen Jahrgang.** Ohne
Jahrgang wüsste das System nicht, wen es anmelden soll — das Formular
verweigert das Speichern mit „Pflicht-Events brauchen mindestens einen
Jahrgang".

### Welche Optionen dadurch wegfallen

Sobald du „Pflicht-Event" einschaltest, sind folgende Einstellungen
wirkungslos — das System setzt sie beim Speichern hart auf null, egal was im
Formular stand:

| Einstellung | Was passiert |
|---|---|
| **Punkte** | werden auf 0 gesetzt |
| **Max. Teilnehmer:innen** | auf 0 (= keine Begrenzung) |
| **Warteliste** | ausgeschaltet |
| **Zeitfenster** | ausgeschaltet, das Formular blendet den Abschnitt aus |
| **Anmeldung ab / Anmeldeschluss** | entfallen, der Abschnitt verschwindet |

Der Grund ist bei allen derselbe: Wenn ohnehin der ganze Jahrgang angemeldet
ist, gibt es nichts zu begrenzen, keine Reihenfolge zu verwalten und keinen
Anmeldezeitraum zu öffnen.

> **Warum keine Punkte?** Für etwas, wozu man verpflichtet ist, gibt es keine
> Belohnung. Das ist eine bewusste Entscheidung und lässt sich nicht
> umstellen. Die Anwesenheit wird trotzdem erfasst — sie zählt für das
> Abzeichen [„Pflicht-Anwesenheit"](60-badges.md#pflicht-anwesenheit).

### Abmelden mit Begründung

Konfis können sich von einem Pflicht-Event abmelden — aber nur **mit
Begründung**, und die muss **mindestens 5 Zeichen** lang sein. Ein leeres Feld
oder ein „ok" wird abgelehnt.

*Beispiel:* „Bin krank" oder „Familienfeier, war lange geplant".

Was dann passiert:

1. Die Anmeldung wechselt von „angemeldet" auf „abgemeldet"
2. Die Leitung bekommt einen Push mit Namen, Termin und Begründung
3. Beim Konfi steht „Du hast dich abgemeldet"

Abmelden geht **nur, solange der Termin in der Zukunft liegt**. Ist er vorbei,
lehnt das System es ab.

### Wieder rein kommen

Ein Knopf: **„Wieder anmelden".** Die Anmeldung wechselt zurück auf
„angemeldet", die Leitung bekommt wieder einen Push. Auch das geht nur, solange
der Termin noch nicht vorbei ist.

Die ursprüngliche Begründung bleibt gespeichert — sie verschwindet nicht,
wenn jemand sich wieder anmeldet.

> **Achtung:** Wer sich abgemeldet hat, kann sich **nicht per QR-Code
> einchecken**. Der Scanner meldet „Du hast dich von diesem Event abgemeldet".
> Wer doch spontan kommt, muss sich vorher in der App wieder anmelden oder von
> dir von Hand als anwesend verbucht werden.

### Nachträglich zum Pflicht-Event machen

Machst du einen bestehenden Termin nachträglich zum Pflicht-Event, wird der
ganze Jahrgang **jetzt** angemeldet. Wer sich vorher schon angemeldet hatte,
bleibt einfach angemeldet — es entstehen keine Doppelanmeldungen.

Vorhandene Zeitfenster werden entfernt, sofern keine Anmeldung daran hängt.
Hängen Anmeldungen daran, bleiben die Zeitfenster in der Datenbank stehen,
werden aber nicht mehr angezeigt.

---

## Konfirmation

Das Häkchen „Konfirmation" markiert einen Termin als Konfirmationstermin. Es
tut **etwas ganz anderes** als „Pflicht-Event":

| | Pflicht-Event | Konfirmation |
|---|---|---|
| Alle automatisch angemeldet | **ja** | nein — jede:r meldet sich selbst an |
| Jahrgang zwingend nötig | ja | nein |
| Punkte | 0 (erzwungen) | 0 (erzwungen) |
| Zeitfenster möglich | nein | nein |
| Plätze begrenzbar | nein | **ja** |
| Warteliste möglich | nein | **ja** |
| Anmeldezeitraum | entfällt | **möglich** |
| Abmelden | nur mit Begründung | ganz normal |

Die eigentliche Wirkung: **Ein Konfi kann sich nur zu genau einem
Konfirmationstermin anmelden.** Versucht jemand, einen zweiten zu buchen,
lehnt das System es ab:

> „Du bist bereits zu einem Konfirmationstermin angemeldet (…). Melde dich
> dort zuerst ab, um einen anderen Termin zu wählen."

In der App sind die anderen Konfirmationstermine dann ausgegraut.

*Typischer Einsatz:* Drei Konfirmationsgottesdienste an zwei Wochenenden, je
15 Plätze. Die Konfis verteilen sich selbst, und niemand landet versehentlich
in zweien.

> **Achtung:** Abgesagte Konfirmationstermine zählen nicht mit. Wer zu einem
> abgesagten Termin angemeldet ist, kann sich ohne Weiteres einen neuen
> aussuchen.

---

## Anmeldezeitraum

Der Anmeldezeitraum besteht aus zwei Zeitpunkten: **Anmeldung ab** und
**Anmeldeschluss**.

> **Das Wichtigste zuerst:** Das Anmeldefenster gilt **ausschließlich für
> Konfis**. Teamer:innen können sich jederzeit anmelden — vor Öffnung, nach
> Schluss, egal. Sie begrenzt allein ihr Kontingent. Deshalb blendet das
> Formular den Abschnitt bei „Nur Teamer:innen" komplett aus: Die Felder wären
> dort wirkungslos.

### „Anmeldung ab sofort"

Der Schalter steht standardmäßig **an**. Das heißt: Es gibt keinen
Startzeitpunkt — sobald der Termin gespeichert ist, kann man sich anmelden.
Das ist der Normalfall.

Schaltest du ihn aus, erscheint ein Datumsfeld, vorbelegt mit „jetzt". Setz es
auf den gewünschten Zeitpunkt.

*Beispiel:* Anmeldung ab 1. September, 18 Uhr → vorher sehen die Konfis den
Termin zwar, bekommen aber „Anmeldung noch nicht geöffnet" beim Versuch.
In der Liste steht der Termin auf „Bald".

### Anmeldeschluss

Ist beim Anlegen automatisch auf **eine Stunde vor Terminbeginn** vorbelegt.
Nach diesem Zeitpunkt gibt es „Anmeldung bereits geschlossen"; in der Liste
steht „Geschlossen".

### Voreinstellungen beim Anlegen im Überblick

| Feld | Voreinstellung |
|---|---|
| Termin-Beginn | die nächste volle Stunde |
| Endzeit | zwei Stunden nach Beginn |
| Anmeldung ab | sofort (kein Startzeitpunkt) |
| Anmeldeschluss | eine Stunde vor Beginn |
| Max. Teilnehmer:innen | 5 |
| Punkte | 1, Typ Gemeinde |
| Warteliste | an, 3 Plätze |
| Check-in-Fenster | 30 Minuten |

### Der „Anmeldung möglich"-Push

Sobald ein freiwilliger Termin anmeldbar wird, geht **genau ein** Push an die
Konfis. Er wird nicht beim Speichern verschickt, sondern von einem
Hintergrundlauf, der jede Minute prüft — so kann er nicht doppelt kommen.

Schließt du die Anmeldung wieder (Fenster in die Zukunft verschoben, Termin
abgesagt), wird die Merkung zurückgesetzt: Beim nächsten Öffnen kommt wieder
ein Push.

Pflicht-Events haben ihren eigenen Push beim Anlegen und sind hiervon
ausgenommen.

### Bis wann sich Konfis wieder abmelden können

**Zwei Tage vor dem Termin ist Schluss.** Danach ist der Abmelden-Knopf für
Konfis gesperrt, und in der App steht „Abmelden geht nur bis 2 Tage vorher".

Das ist **fest eingestellt** und lässt sich nicht ändern — der Anmeldezeitraum
oben regelt nur, wann man sich *anmelden* kann, nicht das Abmelden.

Der Gedanke dahinter: Wer kurzfristig doch nicht kann, soll Bescheid sagen,
statt sich still auszutragen. Und ihr könnt zwei Tage vorher verlässlich
planen, wie viele kommen.

> **Du selbst bist davon nicht betroffen.** Die Leitung kann eine Anmeldung
> in der Detailansicht jederzeit entfernen — auch am Tag des Termins. Sagt
> also jemand kurzfristig ab, trägst du es dort aus.

Nicht zu verwechseln mit dem **Zeitfenster für den QR-Code** (siehe
[QR-Check-in](#qr-check-in)): Das legt fest, wie lange vor und nach dem
Termin eingecheckt werden kann, und ist pro Termin einstellbar.

---

## Plätze und Warteliste

Konfis und Teamer:innen haben **je ein eigenes Kontingent** mit **je eigener
Warteliste**. Beide Abschnitte sind gleich aufgebaut.

### „Unbegrenzte Teilnehmer:innen" und die Null

Die Zahl **0 bedeutet überall im System: unbegrenzt.** Der Schalter
„Unbegrenzte Teilnehmer:innen" setzt genau das.

Ist er an, verschwindet der Warteliste-Schalter — bei unbegrenzten Plätzen
gibt es nichts zu warten, jede Anmeldung wird sofort bestätigt.

### Warteliste

Ist die Warteliste an und alle Plätze belegt, landet die nächste Anmeldung auf
der Warteliste statt abgewiesen zu werden. Die Person sieht: „Du bist auf der
Warteliste. Wird ein Platz frei, rückst du automatisch nach."

**Max. Wartelisten-Plätze** begrenzt auch die Warteliste. Ist sie voll,
kommt „Event ist voll und Warteliste ist auch voll". Ist die Warteliste ganz
aus, kommt stattdessen „Das Event ist leider bereits ausgebucht".

### Wann wird nachgerückt?

Das passiert **automatisch, ohne dein Zutun**, in vier Fällen:

| Auslöser | Was passiert |
|---|---|
| Jemand meldet sich ab | die erste wartende Person rückt nach |
| Du erhöhst die Teilnehmerzahl | so viele rücken nach, wie neue Plätze da sind |
| Du erhöhst die Plätze eines Zeitfensters | dasselbe, aber nur in diesem Zeitfenster |
| Du erhöhst das Teamer-Kontingent | die wartenden Teamer:innen rücken nach |

Nachgerückt wird immer **in der Reihenfolge der Anmeldung** (wer zuerst kam,
rückt zuerst nach). Die nachgerückte Person bekommt einen Push.

> **Die wichtigste Regel:** Ein frei gewordener **Konfi-Platz geht niemals an
> eine wartende Teamer:in** — und umgekehrt. Die beiden Wartelisten werden
> strikt getrennt geführt.

Gelöschte Nutzer:innen rücken nie nach.

### Wenn du die Plätze reduzierst

**Niemand wird zurückgestuft.** Wer schon bestätigt ist, bleibt bestätigt —
auch wenn dadurch mehr Leute drin sind, als die neue Zahl erlaubt. Das gilt
für Konfis und Teamer:innen gleichermaßen.

*Beispiel:* 20 Plätze, 20 Anmeldungen, du reduzierst auf 15 → alle 20 bleiben
drin. Erst wenn sich fünf abmelden, greift die neue Grenze.

### Teamer-Kontingent

Der Abschnitt „Teamer:innen" erscheint nur bei „Konfis, Teamer:innen gesucht"
und „Nur Teamer:innen". Er hat dieselben drei Einstellungen: unbegrenzt / Zahl,
Warteliste an-aus, Wartelisten-Plätze.

Meldet sich eine Teamer:in an oder ab, bekommt die Leitung einen Push. Bei
Konfi-Anmeldungen ist das nicht so — sonst wäre die Leitung mit Meldungen
zugeschüttet.

### Teamer:innen sagen zu oder ab

Teamer:innen geben zu Team-Terminen eine klare Antwort: **„Ich bin dabei"**
oder **„Ich bin nicht dabei"**. Jede Antwort lässt sich jederzeit ändern,
auch von der Absage zurück zur Zusage. Eine Absage bleibt dabei als eigener
Eintrag stehen — in der Detailansicht siehst du sie als „Abgemeldet", samt
Grund. So ist eine Absage von „hat noch nicht reagiert" zu unterscheiden,
und du musst nicht nachfragen.

Für den **Grund** gilt:

- Absage **ohne vorherige Zusage**: Grund freiwillig.
- Absage **nach einer Zusage** (fester Platz oder Warteliste): Grund
  **Pflicht** — die App lässt die Absage sonst nicht durch. Solche Absagen
  sind in der Detailansicht eigens als **„Nach Zusage abgesagt"**
  gekennzeichnet, denn dann musst du umplanen.

Sagt jemand von einem festen Platz ab, wird der Platz frei und die nächste
Person rückt aus der Team-Warteliste nach — mit Push an die Nachrückerin.
Der Push über die Absage an dich nennt den Grund gleich mit.

> **Zwei Arten von „weg vom Termin":** Eine **Absage** (Teamer:in, oder
> Konfi bei einem [Pflicht-Event](#pflicht-event)) bleibt als Eintrag mit
> Grund sichtbar stehen. Eine **Abmeldung** von einem freiwilligen Termin
> entfernt dagegen die Anmeldung selbst; sie taucht in der Detailansicht
> unter „Abmeldungen" auf. Für die Plätze zählt beides gleich: Wer absagt
> oder sich abmeldet, belegt keinen Platz mehr.

---

## Zeitfenster (Timeslots)

Zeitfenster sind für Termine, bei denen die Leute **nacheinander in kleinen
Gruppen** kommen: Vorstellungsgespräche, Fototermine, Beichtgespräche.

### Wie das aussieht

Du legst mehrere Fenster an, jedes mit eigener Uhrzeit und **eigener
Platzzahl**:

```
Fototermin
  ├─ 14:00 – 14:30   4 Plätze
  ├─ 14:30 – 15:00   4 Plätze
  └─ 15:00 – 15:30   4 Plätze
```

Ein neues Fenster schließt zeitlich ans letzte an und übernimmt dessen
Platzzahl — du musst also nur die erste Zeile einstellen und dann auf
„Zeitfenster hinzufügen" tippen.

### Wie das Buchen läuft

Der Konfi **muss** ein Fenster auswählen; ohne kommt „Bitte einen Zeitslot
auswählen". Beim Buchen zählt **die Kapazität des einzelnen Fensters**, nicht
die Gesamtzahl.

Ist ein Fenster voll und die Warteliste an, steht in der Auswahlliste zum
Beispiel: „14:00 - 14:30 (voll — auf Warteliste, 2 warten)". Man kann sich also
gezielt auf die Warteliste **dieses einen Fensters** setzen. Wird dort ein
Platz frei, rückt genau von dieser Warteliste jemand nach — nicht von einer
anderen.

Ist das Fenster voll und die Warteliste aus, kommt „Dieser Zeitslot ist
ausgebucht und hat keine Warteliste."

Die in der Übersicht angezeigte Gesamt-Teilnehmerzahl ist bei
Zeitfenster-Terminen die **Summe aller Fensterplätze**.

### Was beim Bearbeiten passiert

Beim Speichern werden vorhandene Fenster **aktualisiert**, nicht neu angelegt —
bestehende Anmeldungen bleiben also an ihrem Fenster hängen.

Entfernst du ein Fenster:

- **ohne Anmeldungen** → es wird gelöscht
- **mit Anmeldungen** → es bleibt bestehen, verschwindet aber aus der Anzeige

> **Achtung:** Ein Zeitfenster mit Anmeldungen lässt sich nicht wirklich
> loswerden. Willst du es weg haben, melde erst die Leute ab oder verschiebe
> sie in ein anderes Fenster.

Schaltest du Zeitfenster ganz aus, werden alle Fenster gelöscht — **außer**,
es hängt mindestens eine Anmeldung dran. Dann bleiben sie alle stehen.

### Warum es bei Pflicht und Konfirmation nicht geht

Das Formular blendet den Abschnitt aus, sobald „Pflicht-Event" oder
„Konfirmation" gesetzt ist, und der Server erzwingt es zusätzlich.

Der Grund ist inhaltlich: Ein Pflicht-Event gilt für den ganzen Jahrgang zur
selben Zeit, eine Konfirmation hat einen festen Termin. In beiden Fällen gibt
es nichts zu verteilen.

Auch bei „Nur Teamer:innen" gibt es keine Zeitfenster: Teamer-Anmeldungen
hängen grundsätzlich an keinem Zeitfenster.

---

## Punkte

### Wann es Punkte gibt

Punkte werden vergeben, wenn **alle fünf** Bedingungen erfüllt sind:

1. Die Person ist als **anwesend** verbucht (per QR-Check-in oder von Hand)
2. Der Termin hat eine **Punktzahl größer 0**
3. Es ist **kein Pflicht-Event** (dort sind die Punkte auf 0 erzwungen)
4. Die Person ist ein **Konfi** — Teamer:innen bekommen für Termine keine Punkte
5. Der gewählte **Punkt-Typ ist
   [im Jahrgang eingeschaltet](45-jahrgaenge.md#wenn-eine-punktart-abgeschaltet-ist)**
   (Gottesdienst oder Gemeinde)

Fehlt eine davon, wird die Anwesenheit trotzdem gesetzt — nur eben ohne Punkte.

Pro Person und Termin gibt es die Punkte **genau einmal**. Doppelt einchecken
oder zweimal verbuchen ändert nichts.

Nach der Punktevergabe wird geprüft, ob neue [Abzeichen](60-badges.md) fällig
sind, und ob jemand ein [Level](40-punkte.md#level) aufgestiegen ist. Beides
läuft automatisch.

### Punkt-Typ

Jeder Termin gibt entweder **Gottesdienst-** oder **Gemeindepunkte**;
Voreinstellung ist Gemeinde. Ist der gewählte Typ im Jahrgang des Konfis
abgeschaltet, gibt es keine Punkte.

> **Unterschied, den du kennen solltest:** Verbuchst du eine Person **einzeln**
> und der Punkt-Typ ist in ihrem Jahrgang abgeschaltet, bricht der Vorgang mit
> einer Fehlermeldung ab. Beim Sammel-Verbuchen („Alle bestätigen") wird die
> Person dagegen als anwesend verbucht und einfach übersprungen — sonst würde
> ein einziger Sonderfall die ganze Liste blockieren.

### Wann Punkte zurückgenommen werden

In zwei Fällen — jeweils vollständig, inklusive Abzug vom Punktestand:

- Du stellst die Anwesenheit von **anwesend auf fehlend**
- Die Person **meldet sich ab**, obwohl sie schon als anwesend verbucht war

Der Punktestand fällt dabei nie unter null.

> **Achtung:** Ein Abzeichen, das durch diese Punkte ausgelöst wurde, **bleibt
> bestehen.** [Abzeichen werden nie aberkannt](60-badges.md#einmal-verliehen-immer-verliehen).

---

## Anwesenheit

Nach dem Termin trägst du ein, wer da war. Es gibt drei Wege.

### Einzeln

In der Teilnehmerliste über den jeweiligen Eintrag wischen und **Anwesend**
oder **Fehlend** wählen. Punkte werden dabei sofort vergeben oder abgezogen,
und die Person bekommt einen Push.

### „Verbuchen" — alle auf einmal

Liegt ein Termin in der Vergangenheit und es gibt noch unverbuchte Anmeldungen,
zeigt der Termin oben den Status **„Verbuchen"**. Der Knopf „Alle bestätigen"
setzt dann in einem Rutsch:

- **alle bestätigt angemeldeten Konfis** ohne Anwesenheitsstatus auf „anwesend"
- inklusive Punkten, Abzeichen-Prüfung, Level-Prüfung und Push

Was dabei **nicht** angefasst wird:

| | wird verbucht |
|---|---|
| Angemeldete Konfis ohne Status | **ja** |
| Bereits verbuchte (anwesend oder fehlend) | nein, bleiben wie sie sind |
| Wartelisten-Einträge | **nein** |
| Abgemeldete (Pflicht-Event) | nein |
| Teamer:innen | **nein — die verbuchst du einzeln** |

Sind alle verbucht, wechselt der Status auf **„Verbucht"**.

> **Achtung:** „Alle bestätigen" heißt „alle waren da". Wer gefehlt hat, muss
> **danach** einzeln auf „Fehlend" gestellt werden — dabei werden die gerade
> vergebenen Punkte wieder abgezogen. Bei vielen Fehlenden ist einzeln
> verbuchen der schnellere Weg.

### QR-Check-in

Die Leute checken sich selbst ein. Siehe nächster Abschnitt.

---

## QR-Check-in

Du zeigst einen QR-Code (auf dem Handy, am Beamer, ausgedruckt), die Konfis
scannen ihn in der App und sind eingecheckt — inklusive
[Punkten](#wann-es-punkte-gibt).

### Wer scannt, und wo

Den Scanner findet man an drei Stellen, je nach Rolle:

- **Konfis** — oben rechts in der [Terminliste](10-konfis.md#events), oder im
  geöffneten Termin über den Knopf **„Einchecken"**. Der Knopf erscheint nur,
  wenn die Anmeldung bestätigt und noch keine Anwesenheit eingetragen ist;
  danach steht dort **„Anwesend"**.
- **Teamer:innen** — über den runden Knopf unten rechts in ihrer Terminliste.

Gescannt wird mit der Kamera in der App, nicht mit der Kamera-App des Geräts.
Beim ersten Mal fragt das Gerät nach der Kamera-Erlaubnis; wird sie abgelehnt,
erklärt die App, wie man sie nachträglich erteilt. Ohne Netz geht es nicht —
dann meldet die App „Du bist offline".

Nach jedem Scan zeigt die App kurz das Ergebnis und schaltet dann von selbst
wieder scharf, sodass die nächste Person direkt scannen kann.

### Das Zeitfenster

Beim Anlegen stellst du das **Check-in-Fenster** ein: 5 bis 60 Minuten,
Voreinstellung 30.

**Die Zahl gilt in beide Richtungen — vor und nach dem Terminbeginn.**

*Beispiel:* Termin um 18:00 Uhr, Fenster 30 Minuten → Check-in ist von
**17:30 bis 18:30** möglich. Das sind eine ganze Stunde, nicht dreißig
Minuten.

Davor: „Check-in ist noch nicht möglich". Danach: „Der Check-in-Zeitraum ist
abgelaufen". Gerechnet wird immer ab dem **Terminbeginn**, nie ab der Endzeit.

> **Achtung:** Für einen dreistündigen Konfi-Tag ist ein 30-Minuten-Fenster
> knapp — wer eine Stunde später dazustößt, kommt nicht mehr rein. Plane das
> Fenster nach der erwarteten Ankunftszeit, nicht nach der Länge des Termins.
> Über die App sind maximal 60 Minuten einstellbar.

### Der Zähler unter dem Code

Solange der Code offen ist, steht darunter **„X / Y eingecheckt"**. Beide
Zahlen beziehen sich nur auf **bestätigte Anmeldungen**: rechts, wie viele
bestätigt angemeldet sind, links, wie viele davon schon als anwesend verbucht
sind. Wer auf der Warteliste steht oder sich abgemeldet hat, ist in keiner der
beiden Zahlen.

Der Zähler aktualisiert sich **alle zehn Sekunden von selbst** — du musst
nichts nachladen. Er zählt auch Anwesenheiten mit, die ihr währenddessen
[von Hand verbucht](#anwesenheit) habt, nicht nur die Scans.

Über das Drucken-Symbol lässt sich die Seite mit dem Code ausdrucken oder als
PDF sichern, etwa um ihn an die Tür zu hängen.

### Wer sich einchecken kann

Der Scan funktioniert nur, wenn die Person **bestätigt angemeldet** ist.
Andernfalls:

| Situation | Meldung |
|---|---|
| gar nicht angemeldet | „Du bist nicht für dieses Event angemeldet" |
| auf der Warteliste | „Deine Anmeldung ist nicht bestätigt" |
| von einem Pflicht-Event abgemeldet | „Du hast dich von diesem Event abgemeldet" |
| schon eingecheckt | „Du bist bereits eingecheckt" (kein Fehler, keine zweiten Punkte) |
| Code einer anderen Gemeinde | „Kein Zugriff auf dieses Event" |

Teamer:innen können sich ebenfalls einchecken — sie werden als anwesend
verbucht, bekommen aber keine Punkte.

### Was der Scan sofort auslöst

Ein erfolgreicher Scan wirkt **sofort**, nicht erst beim
[Verbuchen](#anwesenheit):

- Die Anwesenheit steht, und die [Punkte](#wann-es-punkte-gibt) sind gutgeschrieben.
- Die Person bekommt eine Benachrichtigung aufs Gerät („Teilnahme bestätigt!"),
  mit der Punktzahl, falls es welche gab.
- Es wird geprüft, ob damit ein [Abzeichen](60-badges.md) oder ein neues
  [Level](40-punkte.md#level) fällig ist — beides kommt als eigene Nachricht.

Ihr müsst danach nichts mehr nachtragen. Der Termin taucht nur dann noch unter
„Verbuchen" auf, wenn Personen offen sind, die nicht gescannt haben.

### Warum Konfis den Code nicht sehen

Der QR-Code ist ein Geheimnis. Würde er in der Konfi-App auftauchen, könnte
sich jeder von zu Hause aus als anwesend eintragen und sich die Punkte selbst
gutschreiben.

Deshalb wird der Code **ausschließlich** an das Team ausgeliefert, und auch
dort nur in der Detailansicht des einzelnen Termins — nie in der Terminliste.

**Leitung und Teamer:innen** kommen gleichermaßen an den Code: oben rechts im
geöffneten Termin über das QR-Symbol. Sind bei einem Termin nur Teamer:innen
vor Ort, reicht das also aus — niemand muss den Code vorher besorgen.

Der Code wird beim ersten Anzeigen erzeugt und bleibt danach gleich. Er läuft
nicht ab; die zeitliche Begrenzung macht allein das Check-in-Fenster.

---

## Serien

Statt zwölf Konfi-Stunden einzeln anzulegen, legst du eine **Serie** an.

Der Abschnitt erscheint nur **beim Anlegen**, nicht beim Bearbeiten.

### Einstellungen und Grenzen

| | |
|---|---|
| Anzahl Termine | **2 bis 26** (bei „Monatlich" höchstens 12) |
| Intervall | Täglich · Wöchentlich · Alle 2 Wochen · Monatlich |
| Zeitspanne | **höchstens 12 Monate** vom ersten bis zum letzten Termin |

Unter den Einstellungen steht immer das Datum des letzten Termins — so siehst
du sofort, worauf du dich einlässt.

Reißt du die 12-Monats-Grenze, verweigert das System das Speichern und nennt
das Datum, das zu weit läge.

### Benennung

Die Termine werden **durchnummeriert**: aus „Konfi-Stunde" wird
„Konfi-Stunde #1", „Konfi-Stunde #2" und so weiter. Das lässt sich nicht
abschalten.

### Alle Einstellungen gelten für alle Termine

Punkte, Plätze, Warteliste, Kategorien, Jahrgänge, Pflicht-Häkchen,
Check-in-Fenster, Teamer-Kontingent — alles wird auf jeden Termin der Serie
übertragen, mit denselben Zwangsregeln wie beim Einzeltermin.

### Das Anmeldefenster wandert mit

Eine Einstellung wird nicht einfach kopiert, sondern **mitverschoben**: der
Anmeldezeitraum.

Du stellst ihn einmal für den ersten Termin ein — und der **Abstand**, den du
dort wählst, gilt dann für jeden weiteren Termin der Serie.

Ein Beispiel. Erster Termin am 1. September, Anmeldung ab dem 25. August, also
sieben Tage vorher:

| Termin | Anmeldung öffnet |
|---|---|
| 1. September | 25. August |
| 8. September | 1. September |
| 15. September | 8. September |
| 22. September | 15. September |

Immer sieben Tage vor dem jeweiligen Termin — nicht immer am 25. Dasselbe gilt
für den Anmeldeschluss.

Das ist meistens genau das, was man will: Zu jeder Konfi-Stunde soll eine Woche
vorher die Anmeldung aufgehen, nicht zu allen zwölf gleichzeitig.

> **Wenn du es anders brauchst** — etwa eine Anmeldung, die für alle Termine
> gleichzeitig öffnet — geht das nicht über die Serie. Dann legst du die
> Termine einzeln an, oder du legst die Serie an und passt die Anmeldezeiten
> danach an den einzelnen Terminen an. Nach dem Anlegen sind es ohnehin
> gewöhnliche Einzeltermine (siehe unten).

Der Abstand wird als echte Zeitspanne gerechnet, nicht als Tag im Kalender —
eine Serie darf also über einen Monatswechsel oder über den Jahreswechsel
laufen, ohne dass das Fenster verrutscht. *(Bis August 2026 stimmte das nicht:
Lief die Serie über eine Monatsgrenze, öffnete die Anmeldung erst nach dem
Termin, und niemand konnte sich anmelden. Behoben.)*

### Was danach passiert

**Es gibt keine Serien-Bearbeitung.** Nach dem Anlegen sind es ganz normale
einzelne Termine, die nur eine gemeinsame Kennung teilen:

- Einen Termin bearbeiten ändert **nur diesen einen**
- Einen Termin löschen löscht **nur diesen einen**, die übrigen bleiben
- Einen Termin absagen sagt **nur diesen einen** ab

> **Achtung:** Willst du an einer zwölfteiligen Serie den Ort ändern, sind das
> zwölf Bearbeitungen. Prüfe die Einstellungen also lieber einmal zu viel,
> bevor du eine lange Serie speicherst.

---

## Absagen oder Löschen?

Zwei verschiedene Dinge, die oft verwechselt werden.

| | Absagen | Löschen |
|---|---|---|
| Termin bleibt sichtbar | **ja, durchgestrichen als „Abgesagt"** | nein, weg |
| Anmeldungen | bleiben erhalten | **werden mitgelöscht** |
| Event-Chat und Nachrichten | bleiben | **werden mitgelöscht** |
| Wer wird benachrichtigt | Angemeldete **und** Wartende | Angemeldete und Wartende (Konfis) |
| Rückgängig | nein, aber der Termin ist noch da | **nein** |
| Neue Anmeldungen möglich | nein | — |

### Absagen

Der saubere Weg. Der Termin wird als abgesagt markiert, alle Angemeldeten
**und alle auf der Warteliste** bekommen einen Push. Der Termin bleibt in der
Liste stehen, durchgestrichen, und taucht in der Leitungsansicht unter den
abgesagten Terminen auf.

Ein bereits abgesagter Termin lässt sich nicht nochmal absagen.

Ein abgesagter Konfirmationstermin blockiert niemanden mehr: Die Betroffenen
können sich einen anderen aussuchen.

### Löschen

Endgültig. Gelöscht werden dabei: der Termin selbst, alle Anmeldungen, alle
Zeitfenster, die Zuordnung zu Kategorien und Jahrgängen sowie **der komplette
Event-Chat mit allen Nachrichten, Umfragen und hochgeladenen Dateien**.

Damit das nicht versehentlich passiert, fragt das System zweimal nach:

- Gibt es Anmeldungen → „Für dieses Event gibt es 12 Anmeldung(en). Beim
  Löschen werden alle benachrichtigt."
- Gibt es Chat-Nachrichten → „Der Event-Chat enthält 34 Nachricht(en). Beim
  Löschen gehen sie verloren."

Erst nach der Bestätigung wird gelöscht. Angemeldete und wartende Konfis
bekommen dann einen Push — auch dann, wenn der Termin vorher schon abgesagt
war.

> **Faustregel:** Ein Termin, der stattfinden sollte und ausfällt, wird
> **abgesagt**. Ein Termin, den es nie hätte geben sollen (Tippfehler,
> versehentlich angelegt), wird **gelöscht**.

---

## Automatische Änderungs-Meldungen

Änderst du an einem **zukünftigen, nicht abgesagten** Termin

- das Datum oder die Uhrzeit,
- die Endzeit oder
- den Ort,

bekommen **alle Angemeldeten und alle auf der Warteliste** automatisch einen
Push mit der Änderung. Das musst du nicht auslösen — es passiert beim
Speichern.

Änderst du nur den Namen, die Beschreibung, die Punkte oder die Platzzahl,
kommt kein Push. Bei vergangenen Terminen ebenfalls nicht.

---

## Event-Chat

Zu jedem Termin lässt sich ein Gruppenchat einrichten.

### Wann er entsteht

**Nicht automatisch.** Jemand aus Leitung oder Teamer-Team muss ihn in der
Detailansicht des Termins über den Chat-Knopf anlegen und die Rückfrage
bestätigen. Pro Termin gibt es genau einen — ein zweiter Versuch meldet „Chat
existiert bereits für dieses Event".

### Wer reinkommt

Beim Anlegen kommen hinein:

- die Person, die den Chat erstellt
- **alle, die zu diesem Zeitpunkt bestätigt angemeldet sind** — Konfis,
  Teamer:innen und Leitung gleichermaßen

### Wer nicht nachkommt

> **Das ist der wichtigste Punkt:** Wer sich **nach** dem Anlegen des Chats
> anmeldet, wird **nicht** automatisch hinzugefügt. Auch nicht, wer von der
> Warteliste nachrückt.
>
> Lege den Chat also möglichst **spät** an — am besten erst, wenn die
> Anmeldefrist durch ist. Sonst fehlt die Hälfte drin.

Ebenfalls nicht dabei: alle, die zum Zeitpunkt des Anlegens auf der Warteliste
standen.

### Wer rausfliegt

Wer sich vom Termin **abmeldet**, wird gleichzeitig aus dem Event-Chat
entfernt. Das passiert automatisch — sonst bliebe man in einem Chat zu einem
Termin, an dem man nicht teilnimmt.

### Was beim Löschen passiert

Wird der Termin gelöscht, verschwindet der Chat mitsamt allen Nachrichten,
Umfragen und Dateien. Beim **Absagen** bleibt er dagegen bestehen.

Was sonst im Termin-Chat gilt — schreiben, Umfragen, Dateien —, steht im
Kapitel [Chat](90-chat.md#termin-chat).

---

## Material am Termin

Hängt [Material](30-leitung.md#wer-sieht-welches-material) an einem
Termin, zeigen Terminliste und Detailansicht das für Leitung und
Teamer:innen an. In der Detailansicht steht der Hinweis direkt bei den
Eckdaten und ist klickbar: Bei einem einzelnen Material öffnet sich sofort
dessen Ansicht, bei mehreren springt die Seite zur Materialliste weiter
unten. Konfis sehen Material grundsätzlich nicht — auch nicht am Termin.

---

## Teilnehmende von Hand hinzufügen

In der Detailansicht kannst du Leute selbst eintragen — praktisch für alle,
die keine App haben oder die Frist verpasst haben.

Dabei gelten dieselben Regeln wie bei der Selbstanmeldung:

- Eine Teamer:in lässt sich nur eintragen, wenn der Termin „Konfis,
  Teamer:innen gesucht" oder „Nur Teamer:innen" ist
- Ein Konfi lässt sich nicht in einen reinen Teamer-Termin eintragen
- Bei Zeitfenster-Terminen musst du ein Fenster auswählen
- Doppelte Anmeldungen werden abgewiesen

Das **Anmeldefenster gilt hier nicht** — du kannst also auch nach
Anmeldeschluss noch jemanden eintragen.

---

## Häufige Stolpersteine auf einen Blick

> **„Ich habe Punkte eingetragen, aber es gibt keine."**
> Prüfe die fünf Bedingungen oben. Am häufigsten: Es ist ein Pflicht-Event
> oder eine Konfirmation (dort sind Punkte immer 0), oder der Punkt-Typ ist im
> Jahrgang abgeschaltet.

> **„Die Teamer:innen sehen den Termin nicht."**
> Bei „Nur Konfis" sehen Teamer:innen den Termin nur, wenn er einem ihrer
> Jahrgänge zugeordnet ist oder gar keinem Jahrgang. Bei „Teamer:innen
> gesucht" sehen ihn alle.

> **„Der Termin ist ausgebucht, obwohl noch Plätze frei sind."**
> Bei Zeitfenster-Terminen zählt das einzelne Fenster, nicht die Summe. Ein
> volles Fenster ist voll, auch wenn nebenan noch Platz ist.

> **„Ich habe die Teilnehmerzahl reduziert, es sind aber immer noch zu viele
> drin."**
> So ist es gedacht: Bestätigte Anmeldungen werden nie zurückgestuft.

> **„Die Hälfte fehlt im Event-Chat."**
> Der Chat nimmt nur mit, wer beim Anlegen schon angemeldet war. Später
> Angemeldete und Nachrücker kommen nicht dazu.

> **„Der Konfi kann sich nicht abmelden."**
> Bei freiwilligen Terminen geht Abmelden nur **bis 2 Tage vor** dem Termin.
> Danach steht in der App „Abmelden geht nur bis 2 Tage vorher". Du selbst
> kannst die Anmeldung in der Detailansicht trotzdem entfernen.
