---
titel: Jahrgänge und Kategorien
untertitel: Punkteziele, Konfispruch, Zuständigkeiten
farbe: "#5b21b6"
gruppe: Nachschlagen
---

Der Jahrgang ist die zentrale Schaltstelle. Fast alles, was für eine ganze
Gruppe von Konfis gilt, wird hier eingestellt: die Punkteziele, ob es beide
Punktarten gibt, ob der Konfispruch gewählt werden darf und ob der
Jahresrückblick freigegeben ist.

Kategorien sind davon unabhängig — sie gelten für die ganze Gemeinde und
sortieren Aktivitäten und Termine.

## Punkteziele

Für jede der beiden Punktarten stellst du getrennt ein Ziel ein. Der
Schieberegler geht von **1 bis 20**. Voreingestellt sind 10 und 10.

Das Ziel ist **keine Grenze** — niemand wird gebremst, wenn er es überschreitet.
Es ist der Bezugswert für die Fortschrittsanzeige:

- Die **Ringe im Dashboard** der Konfis füllen sich im Verhältnis zum Ziel
  ([wie Punkte entstehen](40-punkte.md)).
- In der **Konfi-Liste der Leitung** ergibt sich daraus die Fortschrittsfarbe.
- Der [**Jahresrückblick**](95-wrapped.md) rechnet den Zielwert mit ein.

Beim Gesamtfortschritt werden nur die Ziele der **aktiven** Punktarten addiert.
Ist Gemeinde abgeschaltet, ist das Gesamtziel nur das Gottesdienst-Ziel.

> **Achtung:** Der Bereich 1 bis 20 ist nur die Begrenzung des Schiebereglers in
> der App. Die Schnittstelle dahinter akzeptiert jeden Wert ab 0 und kennt kein
> Maximum. Über die App kannst du aber weder 0 noch mehr als 20 einstellen.

## Wenn eine Punktart abgeschaltet ist

Für jede Punktart gibt es einen Schalter. Das ist der folgenreichste Schalter im
ganzen Jahrgang, deshalb hier ausführlich, was daran hängt.

### Neue Punkte werden blockiert

Jeder Versuch, Punkte der abgeschalteten Art zu vergeben, wird abgewiesen — mit
der Meldung **„Gottesdienst-Punkte sind für diesen Jahrgang deaktiviert“**
(entsprechend für Gemeinde). Das gilt für
[alle Wege](40-punkte.md#die-drei-wege-auf-denen-punkte-entstehen): Anträge
genehmigen, Aktivitäten direkt zuweisen, Bonuspunkte vergeben, Anwesenheit
eintragen.

Eine Ausnahme im Verhalten: Trägst du bei einem Termin über **„alle anwesend“**
gesammelt Anwesenheit ein, werden betroffene Personen **stillschweigend
übersprungen** statt mit einer Fehlermeldung. Du siehst also keinen Hinweis,
dass jemand keine Punkte bekommen hat.

### Bestehende Punkte bleiben — zählen aber nicht mehr

Die einmal vergebenen Punkte werden **nicht gelöscht**. Sie stehen weiter in der
Datenbank, werden aber überall herausgerechnet:

| | Verhalten bei abgeschalteter Art |
|---|---|
| Gespeicherter Punktestand | bleibt unverändert erhalten |
| Gesamtpunkte und Rangliste | die Art wird als 0 gewertet |
| Level | zählt nur noch die aktive Art |
| Abzeichen auf diese Punktart | werden nicht mehr erreicht |
| Abzeichen auf Gesamtpunkte | rechnen nur mit der aktiven Art |
| Jahresrückblick | nur das aktive Ziel fließt ein |

### Was ausgeblendet und was ausgegraut wird

**Ausgeblendet** (ganz weg):

- Der **Ziel-Schieberegler** der Art verschwindet aus dem Bearbeiten-Formular.
- In der Jahrgangsliste fehlt die Zeile „GD-Ziel“ bzw. „Gem-Ziel“.
- **Aktivitäten dieser Art verschwinden vollständig aus der Konfi-Ansicht.** Ein
  Konfi kann sie nicht mehr sehen und nicht mehr melden. Das ist Absicht: Sonst
  könnte er etwas einreichen, das niemand genehmigen kann.

**Ausgegraut** (sichtbar, aber blass) in der Konfi-Detailansicht der Leitung:
Bonuspunkte, Terminpunkte und Aktivitäten der abgeschalteten Art. Ihr seht also
weiter, was einmal vergeben wurde — es ist nur erkennbar außer Kraft.

### Beim Wiedereinschalten

**Es muss nichts nachgerechnet werden.** Alle Summen, Level und
Fortschrittsanzeigen werden bei jedem Aufruf frisch berechnet. In dem Moment,
in dem du die Art wieder einschaltest, sind sämtliche alten Punkte wieder da
und zählen wieder — vollständig und sofort.

Eine Einschränkung: **Abzeichen werden nicht rückwirkend vergeben.** Wer während
der Abschaltung eine Abzeichen-Bedingung erfüllt hätte, bekommt es nicht
automatisch nachgereicht. Geprüft wird erst wieder bei der
[nächsten Punktevergabe oder beim Hintergrundlauf](60-badges.md#wann-wird-geprueft).

### Mindestens eine Art muss aktiv bleiben

Schaltest du eine Art ab, lässt sich die andere nicht mehr abschalten — der
Schalter ist gesperrt, mit dem Hinweis „Mindestens ein Punkt-Typ muss aktiv
bleiben.“

> **Achtung:** Diese Regel wird **nur in der Oberfläche** durchgesetzt. Im
> System dahinter gibt es keine Sperre. Wer die Schnittstelle direkt anspricht,
> kann beide Arten abschalten — mit der Folge, dass keinerlei Punkte mehr
> vergeben werden können und alle Konfis auf 0 stehen. Verlass dich also auf
> die Regel, aber wisse, dass sie nicht unumstößlich ist.

Beim Abschalten prüft das System außerdem, wie viele Konfis bereits Punkte
dieser Art haben, und meldet das zurück. **Diese Warnung wird in der App
derzeit nicht angezeigt** — du bekommst sie also nicht zu sehen.

## Konfispruch-Freigabe

Der Schalter **„Konfispruch-Auswahl“** steht im Jahrgang unter „Konfispruch &
Wrapped“. Er ist standardmäßig **an**.

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
verpflichtend“). Die Stellenangabe darf höchstens 100 Zeichen lang sein, der
Text höchstens 1000.

Beides zugleich geht nicht: Wählt der Konfi aus der Liste, wird ein zuvor
eingetippter Text gelöscht — und umgekehrt.

> **Wichtig für die Praxis:** Mitgeliefert werden nur die **Vers-Stellen**, nicht
> die Verstexte. Die Übersetzungstexte sind aus Lizenzgründen leer und müssten
> von der Gemeinde selbst eingetragen werden. Solange das nicht geschehen ist,
> zeigt die Liste Stellenangaben ohne Text — der Freitext-Weg ist dann der
> einzige, der einen vollständigen Spruch liefert.

Die gesammelten Sprüche eines Jahrgangs kannst du dir als Übersicht anzeigen und
dir per E-Mail zuschicken lassen — praktisch für Urkunden und den
Konfirmationsablauf.

## Wrapped-Freigabe

Der zweite Schalter im selben Abschnitt gibt den Jahresrückblick frei. Er
erscheint erst, wenn du einen bestehenden Jahrgang **bearbeitest**.

**Beim Einschalten** fragt die App nach: „Wrapped wird für alle Konfis dieses
Jahrgangs generiert und sie erhalten eine Push-Benachrichtigung. Fortfahren?“

Bestätigst du, passiert beides:

1. Für **jeden aktiven Konfi** des Jahrgangs wird der Rückblick berechnet und
   als feste Momentaufnahme gespeichert.
2. Alle bekommen einen Push: **„Dein Konfi-Jahr ist da!“** mit dem Text „Schau
   dir jetzt deinen persönlichen Jahresrückblick an!“

**Beim Ausschalten** — Rückfrage „Wrapped-Rückblick für diesen Jahrgang löschen?
Die Konfis sehen den Rückblick dann nicht mehr.“ — werden die gespeicherten
Rückblicke **wirklich gelöscht**, nicht nur ausgeblendet.

Mehr dazu im Kapitel [Jahresrückblick (Wrapped)](95-wrapped.md).

## Was die Jahrgangs-Zuweisung von Teamer:innen steuert

Teamer:innen werden einzelnen Jahrgängen zugewiesen. Diese Zuweisung ist die
**wichtigste Berechtigungseinstellung im ganzen System** — sie entscheidet in
sehr vielen Bereichen mit.

Für den **Org-Admin** gilt das alles nicht: Er sieht immer die ganze Gemeinde,
unabhängig davon, welche Jahrgänge bei ihm eingetragen sind. Für **Admins**
gilt das so nicht — bei der Konfi-Liste und im Chat sind auch sie auf ihre
zugewiesenen Jahrgänge beschränkt. Ein Admin ohne Zuweisung sieht deshalb
keine Konfis. Er kann auch nur in seinen Jahrgängen Konfis anlegen und sie nur
zwischen ihnen verschieben; ändert er die Jahrgänge einer Teamer:in, bleiben
deren übrige Zuweisungen erhalten. Was das im Chat konkret bedeutet, steht im Kapitel
[Chat](90-chat.md#wer-wen-anschreiben-darf); die Unterschiede zwischen den
Rollen stehen im Kapitel [Rollen und Rechte](05-rollen.md).

| Bereich | Ohne passende Zuweisung |
|---|---|
| Konfi-Liste | die Liste bleibt **komplett leer** |
| Konfi anlegen oder verschieben (Admin) | abgewiesen mit „Kein Zugriff auf diesen Jahrgang“ |
| Punkte vergeben | abgewiesen mit „Kein Zugriff auf diesen Konfi“ |
| Termine | jahrgangsgebundene Termine sind unsichtbar |
| Chat: Teamer:in schreibt Konfi an | „Du kannst nur Konfirmand:innen aus deinen Jahrgängen anschreiben“ |
| Chat: Konfi schreibt Teamer:in an | „Diese Teamer:in ist nicht für deinen Jahrgang zuständig“ |
| Chat: Kontaktliste | die Teamer:in taucht bei den Konfis gar nicht erst auf |
| Jahrgangs-Chatraum | keine Aufnahme in den Raum |
| Challenges | jahrgangsgebundene Challenges sind unsichtbar |
| Mitteilungen und Push | nur für die eigenen Jahrgänge |

> **Der Chat sperrt in BEIDE Richtungen.** Eine Teamer:in ohne Zuweisung ist für
> Konfis unsichtbar und erreicht ihrerseits keinen einzigen Konfi. Wenn sich
> jemand meldet, er sehe „gar keine Konfis“ oder werde von niemandem gefunden,
> ist fast immer die fehlende Jahrgangs-Zuweisung die Ursache.

Termine, die [**nur für Teamer:innen**](70-termine.md#nur-teamer-innen) gedacht
sind, und Termine ohne Jahrgangsbindung bleiben immer sichtbar — die Sperre greift nur bei
jahrgangsgebundenen Terminen.

Wird ein Konfi **zur Teamer:in befördert**, übernimmt das System seinen Jahrgang
automatisch als Zuweisung, mit Lese- und Bearbeitungsrecht.

## Kategorien

Kategorien sortieren Aktivitäten und Termine. Es gibt **eine einzige gemeinsame
Liste** für beides — keine getrennten Kategorien für Aktivitäten und Termine.

Eine Kategorie hat nur **Name** und **Beschreibung**. Beide gelten für die ganze
Gemeinde, nicht pro Jahrgang.

Verwendet werden sie an drei Stellen:

- zum Sortieren und Filtern von **Aktivitäten**
- zum Sortieren und Filtern von **Terminen**
- als Grundlage für [**Kategorie-Abzeichen**](60-badges.md#kategorie-aktivitaeten)

### Löschen ist blockiert, solange sie benutzt wird

Wird eine Kategorie noch verwendet, lässt sie sich nicht löschen. Die Meldung
nennt die genauen Zahlen, etwa: **„Kategorie kann nicht gelöscht werden: 3
Aktivität(en) und 2 Event(s) zugeordnet.“**

Es wird also nichts stillschweigend entkoppelt — entweder die Kategorie geht
ganz weg, oder sie bleibt vollständig.

> Die Nachfrage vor dem Löschen („Kategorie wirklich löschen?“) **warnt nicht
> vorab**, dass die Kategorie noch benutzt wird. Das erfährst du erst, nachdem
> du bestätigt hast — dann als Fehlermeldung.

Zwei Kategorien dürfen nicht denselben Namen haben („Kategoriename existiert
bereits“).

### Die Falle mit den Kategorie-Abzeichen

> **Achtung, das ist die gefährlichste Stelle in diesem Kapitel:** Ein
> Kategorie-Abzeichen merkt sich den **Namen** der Kategorie, nicht die
> Kategorie selbst. Benennst du eine Kategorie um, findet das zugehörige
> Abzeichen nichts mehr — **stillschweigend, ohne Fehlermeldung**. Niemand
> bekommt es mehr, und niemand erfährt, warum. Bereits verliehene bleiben
> erhalten. **Kategorien, auf die Abzeichen zeigen, also nicht umbenennen.**

## Jahrgang löschen

Das Löschen ist an zwei Stellen abgesichert.

**Blockiert, solange aktive Konfis zugeordnet sind.** Meldung: „Jahrgang kann
nicht gelöscht werden: 12 Konfi(s) zugeordnet.“ Verschiebe die Konfis erst in
einen anderen Jahrgang.

**Blockiert, solange der Chatverlauf Nachrichten enthält.** Meldung: „Jahrgang
kann nicht gelöscht werden: Chat-Raum enthält 148 Nachricht(en).“ Hier gibt es
allerdings einen Ausweg: Als Organisations-Administration bekommst du die
Rückfrage „Chat-Nachrichten vorhanden“ mit dem Knopf **„Dennoch löschen“**.
Dann werden **alle Nachrichten, Umfragen und Anhänge unwiderruflich gelöscht**.

### Was mit beförderten Teamer:innen passiert

Ehemalige Konfis, die inzwischen Teamer:in sind, **blockieren das Löschen
nicht**. Sie verlieren beim Löschen nur ihre Jahrgangs-Bindung.

**Ihre Daten bleiben vollständig erhalten**: Punktestand, Level, Abzeichen und
Konfispruch. Das ist bewusst so gebaut, damit sie ihre eigene Konfizeit später
noch nachschauen können.

## Das Konfirmationsdatum

Am Jahrgang selbst wird **kein** Konfirmationsdatum mehr gepflegt. Das Feld gibt
es technisch noch, wird aber nicht mehr beschrieben.

Der Konfirmationstermin ergibt sich stattdessen **pro Konfi** aus dem Termin, der
[als Konfirmation gekennzeichnet](70-termine.md#konfirmation) ist und den der
Konfi gebucht hat. Bei mehreren
Konfirmationsterminen in einem Jahrgang hat also jeder sein eigenes, richtiges
Datum.
