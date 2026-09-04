---
titel: Abzeichen
untertitel: Wie Badges funktionieren und welche Bedingungen es gibt
farbe: "#b45309"
gruppe: Nachschlagen
---

Abzeichen (im System „Badges") bekommen Konfis und Teamer:innen **automatisch**,
sobald sie eine Bedingung erfüllen. Es gibt keine Möglichkeit, ein Abzeichen von
Hand zu verleihen oder wieder abzuerkennen.

## Der Grundgedanke

Du legst ein Abzeichen einmal an und beschreibst dabei, **wofür** es vergeben
wird. Ab dann prüft das System selbst — bei jeder
[Punktevergabe](40-punkte.md) und zusätzlich alle fünf Minuten im Hintergrund.

Ein Abzeichen besteht aus vier Dingen:

- **Name und Beschreibung** — was drauf steht
- **Symbol und Farbe** — wie es aussieht. Die Farbe richtet sich zunächst nach
  der Bedingung, damit verwandte Abzeichen zusammen wirken: Punkte-Abzeichen
  sind golden, Gottesdienst-Abzeichen orange, Gemeinde-Abzeichen grün. Du
  kannst jede Farbe von Hand ändern.
- **Bedingung** — wofür es vergeben wird (die 15 Möglichkeiten unten)
- **Zielgruppe** — für Konfis oder für Teamer:innen

## Wichtig zu wissen, bevor du anfängst

### Vergangenes zählt immer mit

Ein heute angelegtes Abzeichen „10 Aktivitäten" geht **sofort** an alle, die das
längst erfüllen. Es gibt keine Möglichkeit, es nur ab heute gelten zu lassen.

Plane das ein: Wenn du mitten im Jahr ein Abzeichen einführst, haben es einige
sofort — das ist so gewollt, wirkt aber überraschend, wenn man es nicht erwartet.

### Einmal verliehen, immer verliehen

Wird ein Abzeichen vergeben und die Person verliert später Punkte, **bleibt das
Abzeichen**. Es gibt keinen Entzug. Das ist Absicht: Was jemand einmal geschafft
hat, bleibt geschafft.

### Zielgruppe lässt sich nachträglich nicht ändern

Beim Anlegen wählst du Konfis oder Teamer:innen. Beim Bearbeiten ist diese
Auswahl weg — das Feld wird gar nicht mehr mitgespeichert. Willst du wechseln,
musst du ein neues Abzeichen anlegen.

### Deaktivieren ist nicht dasselbe wie Löschen

| | Deaktivieren | Löschen |
|---|---|---|
| Neue Vergabe | stoppt | stoppt |
| Bereits Verliehene | bleiben in der Datenbank | **werden mitgelöscht** |
| Konfi sieht es weiter | **nein, es verschwindet** | nein |
| Teamer:in sieht es weiter | ja | nein |
| Rückgängig | ja | nein |

> **Unstimmigkeit, die du kennen solltest:** Deaktivierst du ein Abzeichen,
> verschwindet es bei **Konfis** auch dann aus der App, wenn sie es schon hatten.
> Bei **Teamer:innen** bleibt es sichtbar. Wenn du ein Abzeichen aus dem Verkehr
> ziehen willst, ohne jemandem etwas wegzunehmen, ist das derzeit nicht
> zufriedenstellend lösbar.

### Geheime Abzeichen

Ein „geheimes" Abzeichen sehen Konfis erst, **wenn sie es haben**. Vorher taucht
es weder in der Liste noch als Fortschritt auf — nur die Anzahl unentdeckter
Geheimnisse wird angezeigt („3 geheime Abzeichen").

Die Bedingung wird ganz normal geprüft. „Geheim" betrifft nur die Anzeige.

---

## Die 15 Bedingungen

Der Zahlenwert wird immer über einen Schieberegler von **1 bis 20** eingestellt.
Höhere Werte sind über die App nicht möglich.

### Nach Punkten

#### Gesamtpunkte

Gottesdienst- und Gemeindepunkte zusammen erreichen den Wert.

*Beispiel:* Wert 20 → sobald jemand insgesamt 20 Punkte hat.

Gezählt werden **nur die Punktarten, die
[im Jahrgang eingeschaltet](45-jahrgaenge.md#wenn-eine-punktart-abgeschaltet-ist)
sind**. Ist Gemeinde abgeschaltet, zählen nur Gottesdienstpunkte. Sind beide aus, ist das
Abzeichen unerreichbar und wird Konfis gar nicht erst angezeigt.

#### Gottesdienst-Punkte · Gemeinde-Punkte

Wie oben, aber nur die jeweilige Art. Ist sie im Jahrgang abgeschaltet, wird das
Abzeichen nicht vergeben.

#### Beide Kategorien

Der Wert muss in **beiden** Bereichen einzeln erreicht sein.

*Beispiel:* Wert 5 → mindestens 5 Gottesdienstpunkte **und** mindestens 5
Gemeindepunkte.

> **Achtung, Wortfalle:** „Kategorien" meint hier **Gottesdienst und Gemeinde**,
> nicht die Kategorien, die du selbst anlegst. Wer Kategorie-Abzeichen will,
> nimmt „Kategorie-Aktivitäten" (siehe unten).

#### Bonuspunkte

Die **Summe** aller vergebenen [Bonuspunkte](40-punkte.md#weg-3-bonuspunkte) erreicht den Wert.

*Beispiel:* Wert 2 → sobald du insgesamt 2 Bonuspunkte vergeben hast.

> Der Hilfetext in der App sagt „Anzahl der Vergaben" — das stimmt nicht,
> gezählt wird die Punktesumme. Zwei Bonuspunkte auf einmal erfüllen die
> Bedingung also genauso wie zweimal ein Punkt.

### Nach Anzahl

#### Aktivitäten & Events

Erledigte Aktivitäten **plus** besuchte Termine zusammen.

*Beispiel:* Wert 10 → 10 Einträge insgesamt, egal in welcher Mischung.

#### Event-Teilnahmen

Nur besuchte Termine.

#### Verschiedene Aktivitäten

Wie viele **unterschiedliche** Aktivitäten jemand gemacht hat.

*Beispiel:* Wert 3 → drei verschiedene Aktivitäten. Fünfmal dieselbe zählt als
eine. Termine zählen hier **nicht** mit.

#### Pflicht-Anwesenheit

Besuchte [**Pflicht-Termine**](70-termine.md#pflicht-event).

*Beispiel:* Wert 12 → 12 besuchte Pflichttermine.

> Das ist die einzige Bedingung, die Pflichttermine zählt. Bei allen anderen
> zählen Pflichttermine und Konfirmationen **nicht** mit — sonst bekäme man
> Abzeichen für etwas, wozu man ohnehin verpflichtet ist.

### Nach Inhalt

#### Spezifische Aktivität

Eine bestimmte Aktivität, so oft wie eingestellt.

*Beispiel:* Wert 5 + „Sonntagsgottesdienst" → fünfmal daran teilgenommen.

#### Aktivitäts-Kombination

Von mehreren ausgewählten Aktivitäten muss eine Mindestanzahl erledigt sein.

*Beispiel:* Zehn Aktivitäten ausgewählt, Wert 3 → drei davon reichen.

#### Kategorie-Aktivitäten

**Das ist die Bedingung, die deine selbst angelegten
[Kategorien](45-jahrgaenge.md#kategorien) nutzt.**

Gezählt wird alles aus einer Kategorie — **Aktivitäten und Termine zusammen**.

*Beispiel:* Wert 3 + Kategorie „Kasualien" → drei Kasualien, egal ob als
Aktivität gemeldet oder als Termin besucht.

So hängt es zusammen:

```
Kategorie "Kasualien" anlegen
   ├─ der Aktivität "Taufe begleiten" zuordnen
   ├─ der Aktivität "Beerdigung besuchen" zuordnen
   └─ dem Termin "Trauung Familie Meier" zuordnen
                    ↓
Abzeichen "Kasualien-Kenner": 3 aus Kategorie "Kasualien"
```

> **Wichtige Falle:** Das Abzeichen merkt sich den **Namen** der Kategorie, nicht
> die Kategorie selbst. Benennst du „Kasualien" später in „Kasualien &
> Begleitung" um, findet das Abzeichen nichts mehr — stillschweigend, ohne
> Fehlermeldung. Bereits verliehene bleiben. **Kategorien, auf die Abzeichen
> zeigen, also besser nicht umbenennen.**

### Nach Zeit

#### Zeitbasiert

So viele Aktivitäten oder Termine innerhalb der letzten X Wochen.

*Beispiel:* Wert 2 + 4 Wochen → zwei Einträge in den letzten vier Wochen.

Das Fenster wandert immer mit — es ist kein fester Zeitraum, sondern „ab jetzt
rückwärts". Einstellbar sind 1 bis 26 Wochen.

#### Serie

Wochen **in Folge** mit mindestens einem Eintrag.

*Beispiel:* Wert 4 → vier Wochen am Stück aktiv.

> Gezählt wird ab der **letzten aktiven Woche** rückwärts, nicht ab heute. Wer
> vor einem Jahr vier Wochen am Stück aktiv war und seitdem nichts, erfüllt die
> Bedingung weiterhin und bekommt das Abzeichen beim nächsten Anlegen sofort.

### Nur für Teamer:innen

#### Teamer-Jahr

Kalenderjahre mit mindestens einer Aktivität oder einem Termin.

*Beispiel:* Wert 3 → in drei Jahren aktiv gewesen.

**Lücken sind erlaubt:** Wer 2024 und 2026 aktiv war, aber 2025 nicht, hat zwei
Jahre. Gezählt wird ab dem Eintrittsdatum („Teamer:in seit"). Fehlt das, wird das
Jahr der ältesten Aktivität genommen; fehlt auch das, zählt es null.

---

## Welche Bedingung für welche Zielgruppe?

| Bedingung | Konfis | Teamer:innen |
|---|---|---|
| Gesamtpunkte, Gottesdienst, Gemeinde, Beide Kategorien | ja | nein |
| Bonuspunkte | ja | nein |
| Aktivitäten & Events | ja | ja |
| Event-Teilnahmen | ja | nein |
| Verschiedene Aktivitäten | ja | ja |
| Pflicht-Anwesenheit | ja | nein |
| Spezifische Aktivität | ja | ja |
| Aktivitäts-Kombination | ja | ja |
| Kategorie-Aktivitäten | ja | ja |
| Zeitbasiert, Serie | ja | nein |
| Teamer-Jahr | nein | ja |

Teamer:innen sammeln keine Punkte — deshalb entfallen alle punktebasierten
Bedingungen. Bei Termin-Bedingungen zählen für Teamer:innen **alle** besuchten
Termine, auch Pflichttermine: Sie arbeiten dort mit.

## Wann wird geprüft?

Sofort bei:

- einer genehmigten Aktivitäts-Meldung
- einer direkt zugewiesenen Aktivität
- vergebenen Bonuspunkten
- [eingetragener Anwesenheit](70-termine.md#anwesenheit) bei einem Termin

Zusätzlich alle fünf Minuten im Hintergrund.

> Der Hintergrundlauf erfasst **nur Geräte mit eingeschalteten Mitteilungen**.
> Wer die App nie installiert oder Mitteilungen abgelehnt hat, bekommt zeitliche
> Abzeichen („Serie", „Zeitbasiert", „Teamer-Jahr") erst bei der nächsten
> Punktevergabe. Die anderen Bedingungen greifen ohnehin sofort.

## Was beim Verleihen passiert

1. Das Abzeichen wird eingetragen
2. Mitteilung in der App: „Neues Badge erhalten!"
3. Push aufs Gerät
4. Der Zähler in der Tab-Leiste aktualisiert sich

Ein Abzeichen kann nie doppelt vergeben werden.
