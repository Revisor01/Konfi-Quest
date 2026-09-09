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
sortieren Aktivitäten und Termine.

## Einen Jahrgang anlegen

**Neue Jahrgänge legt nur der Org-Admin an.** Admins sehen den Knopf zum
Anlegen nicht; sie bearbeiten und löschen nur die Jahrgänge, die ihnen
zugewiesen sind. Welche Rolle was darf, steht im Kapitel
[Rollen und Rechte](05-rollen.md).

Beim Anlegen wählt der Org-Admin direkt aus, welche **Admins und
Teamer:innen** Zugriff auf den neuen Jahrgang bekommen. Die ausgewählten
Personen sehen und bearbeiten den Jahrgang sofort und sind auch gleich im
Jahrgangs-Chat. Die Auswahl ist freiwillig — ohne sie entsteht der Jahrgang
zunächst ohne Zuweisungen, und der Org-Admin vergibt sie später unter
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

Eine Ausnahme im Verhalten: Trägst du bei einem Termin über **„alle
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
| Abzeichen auf diese Punktart | werden nicht mehr erreicht |
| Abzeichen auf Gesamtpunkte | rechnen nur mit der aktiven Art |
| Jahresrückblick | nur das aktive Ziel fließt ein |

### Erkennen, was ausgeblendet und was ausgegraut ist

**Ausgeblendet** (ganz weg):

- Der **Ziel-Schieberegler** der Art verschwindet aus dem Bearbeiten-Formular.
- In der Jahrgangsliste fehlt die Zeile „GD-Ziel“ bzw. „Gem-Ziel“.
- **Aktivitäten dieser Art verschwinden vollständig aus der Konfi-Ansicht.**
  Ein Konfi kann sie nicht mehr sehen und nicht mehr melden. Sonst könnte er
  etwas einreichen, das niemand genehmigen kann.

**Ausgegraut** (sichtbar, aber blass) in der Konfi-Detailansicht der Leitung:
Bonuspunkte, Terminpunkte und Aktivitäten der abgeschalteten Art. Ihr seht
also weiter, was einmal vergeben wurde — es ist nur erkennbar außer Kraft.

### Eine Punktart wieder einschalten

**Es muss nichts nachgerechnet werden.** Alle Summen, Level und
Fortschrittsanzeigen werden bei jedem Aufruf frisch berechnet. In dem Moment,
in dem du die Art wieder einschaltest, sind sämtliche alten Punkte wieder da
und zählen wieder — vollständig und sofort.

Eine Einschränkung: **Abzeichen werden nicht rückwirkend vergeben.** Wer
während der Abschaltung eine Abzeichen-Bedingung erfüllt hätte, bekommt es
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

> **Wichtig für die Praxis:** Mitgeliefert werden nur die **Vers-Stellen**,
> nicht die Verstexte. Die Übersetzungstexte sind aus Lizenzgründen leer und
> müssten von der Gemeinde selbst eingetragen werden. Solange das nicht
> geschehen ist, zeigt die Liste Stellenangaben ohne Text — der Freitext-Weg
> ist dann der einzige, der einen vollständigen Spruch liefert.

Die gesammelten Sprüche eines Jahrgangs kannst du dir als Übersicht anzeigen
und dir per E-Mail zuschicken lassen — praktisch für Urkunden und den
Konfirmationsablauf.

## Nachvollziehen, was die Jahrgangs-Zuweisung steuert

Admins und Teamer:innen werden einzelnen Jahrgängen zugewiesen. Diese
Zuweisung ist die **wichtigste Berechtigungseinstellung im ganzen System** —
sie entscheidet in sehr vielen Bereichen mit.

Für den **Org-Admin** gilt das alles nicht: Er sieht immer die ganze
Gemeinde, unabhängig davon, welche Jahrgänge bei ihm eingetragen sind. Für
**Admins** gilt das so nicht — bei der Konfi-Liste und im Chat sind auch sie
auf ihre zugewiesenen Jahrgänge beschränkt. Ein Admin ohne Zuweisung sieht
deshalb keine Konfis. Er kann auch nur in seinen Jahrgängen Konfis anlegen
und sie nur zwischen ihnen verschieben; ändert er die Jahrgänge einer
Teamer:in, bleiben deren übrige Zuweisungen erhalten. Was das im Chat
konkret bedeutet, steht im Kapitel
[Chat](90-chat.md#wer-wen-anschreiben-darf); die Unterschiede zwischen den
Rollen stehen im Kapitel [Rollen und Rechte](05-rollen.md).

| Bereich | Ohne passende Zuweisung |
|---|---|
| Konfi-Liste | die Liste bleibt **komplett leer** |
| Jahrgangs-Liste (Admin) | zeigt nur die eigenen Jahrgänge |
| Konfi anlegen oder verschieben (Admin) | abgewiesen mit „Kein Zugriff auf diesen Jahrgang“ |
| Konfi löschen, befördern, Passwort zurücksetzen (Admin) | abgewiesen mit „Kein Zugriff auf diesen Konfi“ |
| Punkte vergeben und zurücknehmen | abgewiesen mit „Kein Zugriff auf diesen Konfi“ |
| Termine | jahrgangsgebundene Termine sind unsichtbar und nicht buchbar |
| Material | jahrgangsgebundenes Material ist unsichtbar (Material ohne Jahrgang und „für alle“ bleibt) |
| Anwesenheits- und Spruchlisten (Admin) | abgewiesen mit „Kein Zugriff auf diesen Jahrgang“ |
| Jahresrückblick: Liste der Ausgaben | zeigt nur Ausgaben der eigenen Jahrgänge; ohne jede Zuweisung bleibt sie leer und nennt den Grund („Kein Jahrgang zugewiesen“) |
| Jahresrückblick freigeben (Admin) | abgewiesen mit „Kein Zugriff auf diesen Jahrgang“ |
| Chat: Teamer:in oder Admin schreibt Konfi an | „Du kannst nur Konfirmand:innen aus deinen Jahrgängen anschreiben“ |
| Chat: Konfi schreibt Teamer:in an | „Diese Teamer:in ist nicht für deinen Jahrgang zuständig“ (Admins darf ein Konfi dagegen immer anschreiben) |
| Chat: Kontaktliste | die Teamer:in taucht bei den Konfis gar nicht erst auf |
| Jahrgangs-Chatraum | keine Aufnahme in den Raum |
| Challenges | jahrgangsgebundene Challenges sind unsichtbar (Team-Runden bleiben) |
| Meldungs-Zähler an den Reitern und am App-Symbol | zählen nur, was die eigenen Listen zeigen |
| Mitteilungen und Push | nur für die eigenen Jahrgänge |

> **Der Chat sperrt in BEIDE Richtungen.** Eine Teamer:in ohne Zuweisung ist
> für Konfis unsichtbar und erreicht ihrerseits keinen einzigen Konfi. Wenn
> sich jemand meldet, er sehe „gar keine Konfis“ oder werde von niemandem
> gefunden, ist fast immer die fehlende Jahrgangs-Zuweisung die Ursache.

Bei [**Terminen**](70-termine.md) wirkt die Zuweisung auf beides: Sehen und
Buchen. Eine Teamer:in kann sich nur zu Terminen ihrer eigenen Jahrgänge
anmelden; sonst kommt **„Dieser Termin gehört zu einem Jahrgang, dem du
nicht zugewiesen bist“**. Zwei Arten von Terminen bleiben immer sichtbar und
buchbar: Termine [**nur für Teamer:innen**](70-termine.md#die-zielgruppe-waehlen)
und Termine ohne jede Jahrgangsbindung.

Wird ein Konfi **zur Teamer:in befördert**, übernimmt das System seinen
Jahrgang automatisch als Zuweisung, mit Lese- und Bearbeitungsrecht.

## Kategorien anlegen und pflegen

Kategorien findest du unter **Mehr › Kategorien**. Sie sortieren Aktivitäten
und Termine, und es gibt **eine einzige gemeinsame Liste** für beides — keine
getrennten Kategorien für Aktivitäten und Termine.

Eine Kategorie hat nur **Name** und **Beschreibung**. Beide gelten für die
ganze Gemeinde, nicht pro Jahrgang. Zwei Kategorien dürfen nicht denselben
Namen haben („Kategoriename existiert bereits“).

Verwendet werden sie an drei Stellen:

- zum Sortieren und Filtern von **Aktivitäten**
- zum Sortieren und Filtern von [**Terminen**](70-termine.md)
- als Grundlage für [**Kategorie-Abzeichen**](60-badges.md#kategorie-aktivitaeten)

### Eine Kategorie löschen

Wird eine Kategorie noch verwendet, lässt sie sich nicht löschen. Die Meldung
nennt die genauen Zahlen, etwa: **„Kategorie kann nicht gelöscht werden: 3
Aktivität(en) und 2 Event(s) zugeordnet.“** Es wird also nichts
stillschweigend entkoppelt — entweder die Kategorie geht ganz weg, oder sie
bleibt vollständig.

> Die Nachfrage vor dem Löschen („Kategorie "Ausflug" wirklich löschen?“)
> **warnt nicht vorab**, dass die Kategorie noch benutzt wird. Das erfährst du
> erst, nachdem du bestätigt hast — dann als Fehlermeldung.

### Kategorie-Abzeichen nicht ins Leere laufen lassen

> **Achtung, das ist die gefährlichste Stelle in diesem Kapitel:** Ein
> Kategorie-Abzeichen merkt sich den **Namen** der Kategorie, nicht die
> Kategorie selbst. Benennst du eine Kategorie um, findet das zugehörige
> Abzeichen nichts mehr — **stillschweigend, ohne Fehlermeldung**. Niemand
> bekommt es mehr, und niemand erfährt, warum. Bereits verliehene bleiben
> erhalten. **Kategorien, auf die [Abzeichen](60-badges.md) zeigen, also
> nicht umbenennen.**

## Einen Jahrgang löschen

Das Löschen ist an zwei Stellen abgesichert.

**Blockiert, solange aktive Konfis zugeordnet sind.** Meldung: „Jahrgang kann
nicht gelöscht werden: 12 Konfi(s) zugeordnet.“ Verschiebe die Konfis erst in
einen anderen Jahrgang.

**Blockiert, solange der Chatverlauf Nachrichten enthält.** Meldung:
„Jahrgang kann nicht gelöscht werden: Chat-Raum enthält 148 Nachricht(en).“
Hier gibt es allerdings einen Ausweg: Als Organisations-Administration
bekommst du die Rückfrage „Chat-Nachrichten vorhanden“ mit dem Knopf
**„Dennoch löschen“**. Dann werden **alle Nachrichten, Umfragen und Anhänge
unwiderruflich gelöscht** ([Chat](90-chat.md)).

### Beförderte Teamer:innen beim Löschen

Ehemalige Konfis, die inzwischen Teamer:in sind, **blockieren das Löschen
nicht**. Sie verlieren beim Löschen nur ihre Jahrgangs-Bindung.

**Ihre Daten bleiben vollständig erhalten**: Punktestand, Level, Abzeichen
und Konfispruch. Das ist bewusst so gebaut, damit sie ihre eigene Konfizeit
später noch nachschauen können.

## Das Konfirmationsdatum finden

Am Jahrgang selbst wird **kein** Konfirmationsdatum gepflegt. Der
Konfirmationstermin ergibt sich **pro Konfi** aus dem Termin, der
[als Konfirmation gekennzeichnet](70-termine.md#einen-termin-als-konfirmation-kennzeichnen) ist und den der
Konfi gebucht hat. Bei mehreren Konfirmationsterminen in einem Jahrgang hat
also jeder sein eigenes, richtiges Datum.
