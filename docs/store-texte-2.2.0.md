# Store-Texte 2.2.0

Quelle: Abschnitte `## [Unreleased] - 2.2.0`, `## [2.1.1]` und `## [2.1.0]`
in `CHANGELOG.md`.
Beide Texte sind getrennt zu verwenden — niemals mischen.

---

## Warum beide Texte diesmal weiter zurückgreifen

**Die Stände laufen auseinander.** Auf iOS ist 2.1.1 erschienen, auf Android
nicht: Dort steht noch 2.0. Die 2.1.1 wurde für Android nie fertig, und dann
kam der Push-Fehler dazwischen.

Simons Entscheidung vom 18.09.2026: **Beide Texte fassen alles seit 2.0
zusammen.** Für Android ist das zwingend — sonst erfahren diese
Nutzer:innen nie, was in 2.1 passiert ist, allen voran die Reparatur der
Push-Nachrichten, die genau sie betroffen hat. Für iOS ist es eine
Wiederholung der 2.1.1-Punkte, aber keine falsche Aussage: Die Funktionen
sind in dieser Version vorhanden.

---

## iOS — App Store Connect, „Neues in dieser Version"

> **Kein Wort über andere Plattformen — Apple lehnt danach ab.**
> Am 29.08.2026 wurde 2.0.0 (Build 149) unter Guideline 2.3.10
> zurückgewiesen, weil im letzten Absatz „der Anzeige auf Android" stand.
> Ein einziger Halbsatz. Zwei Tage Wartezeit, danach eine neue Prüfrunde.
> Verboten sind Android, Google Play, Windows und Verweise auf eine Web-App,
> in JEDEM Feld. Der `ios-release`-Workflow prüft das vor dem Build.

> **Die Push-Reparatur gehört hier NICHT hinein.** Sie betraf ausschließlich
> das andere System; auf dem iPhone kamen die Nachrichten durchgehend an.
> Sie zu erwähnen wäre ein Plattform-Verweis und zugleich sachlich falsch.

```
Termine planen geht leichter: Ein bestehender Termin lässt sich kopieren — alle Angaben stehen schon im Formular, nur Datum und Titel passt du an. Material, Chat und Anmeldungen bleiben beim alten Termin.

Fällt ein Termin aus, lässt sich ein Grund angeben. Alle Teilnehmenden sehen ihn, und er steht in der Mitteilung. Findet der Termin doch statt, nimmst du die Absage zurück: Anmeldungen, Warteliste und Chat kommen vollständig zurück, und alle erfahren es.

Die Anwesenheit kennt jetzt „Abgemeldet" — für den Anruf der Eltern am Morgen, mit Grund und Notiz. Dazu steht überall, wer einen Eintrag gemacht hat und wann.

Das Team sieht am Termin, wer kommt: Teilnehmende mit Jahrgang und Stand der Anmeldung, nach Konfis und Team getrennt.

Neu: Die App lässt sich mit Face ID oder Touch ID sperren, wahlweise sofort oder nach einigen Minuten. Im App-Umschalter erscheint dann nur das Logo.

Behoben: Kurzfristige Termine waren im Moment des Anlegens schon geschlossen. Abgesagte Termine sahen je nach Ansicht verschieden aus. Wer von der Leitung abgemeldet wurde, kam nicht zurück auf den Termin. Freie Plätze auf der Warteliste verfielen in mehreren Fällen stillschweigend.
```

---

## Android — Google Play, „Was ist neu"

> **Dieser Text muss nach `frontend/release-notes-de.txt` kopiert werden.**
> Der Play-Upload liest ausschließlich diese Datei. **Maximal 500 Zeichen**,
> sonst bricht der Upload ab.

> **Hier gehört die Push-Reparatur an die erste Stelle.** Diese
> Nutzer:innen bekamen über Wochen keine Nachrichten und wussten nicht,
> warum. Das ist für sie die wichtigste Nachricht des Updates — wichtiger
> als jedes neue Feature.

```
Push-Nachrichten kommen wieder an — für Chat und Termine. Wer betroffen war, bekommt sie ab dem nächsten Start.

Termine kopieren statt neu tippen. Absagen mit Grund, und die Absage lässt sich zurücknehmen: alle Anmeldungen kommen zurück.

Anwesenheit kennt jetzt „Abgemeldet" mit Grund und Notiz. Das Team sieht, wer kommt.

App-Sperre mit Fingerabdruck.

Dazu alles aus 2.1: Jahresrückblick fürs Team, Offline-Verbesserungen, schnellerer Start.
```

---

## Prüfschritte vor dem Einreichen

1. `frontend/release-notes-de.txt` auf den Play-Text setzen und die Länge
   messen: `wc -c frontend/release-notes-de.txt` — muss unter 500 liegen.
2. iOS-Text auf Plattform-Verweise prüfen (der Workflow tut es auch, aber
   erst beim Build — ein Fehlschlag kostet einen Durchlauf).
3. Beide Texte gegen den CHANGELOG lesen: Steht darin etwas, das gar nicht
   ausgeliefert wird?
