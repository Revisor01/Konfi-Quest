# Konfi Wrapped — Kachel-Konzept

> **Simons Vorgaben vom 02.09.2026. Diese Datei ist die Quelle der Wahrheit
> für den Umbau. Nichts hier darf beim Bauen verloren gehen.**

## Das Grundmodell

Nicht „vier feste plus vier zufällige", sondern eine **Erzählung mit fester
Dramaturgie**, in die sich dynamische Seiten einschieben.

Simons Beispiel: eine Konfi, die viel gemacht hat — viel gechattet, an acht
Challenges teilgenommen, viele Abzeichen.

### Die Reihenfolge der Erzählung

| # | Seite | Art | Inhalt |
|---|-------|-----|--------|
| 1 | Opener | fest | Auftakt, „Dein Konfi-Jahr" |
| 2 | Chat | dynamisch | nur wer wirklich geschrieben hat |
| 3 | Events | fest | allgemein, Termine des Jahres |
| 4 | Kategorie | dynamisch | der eigene Schwerpunkt (z. B. Jugend) |
| 5 | Challenges | dynamisch | allgemein: zwei Momente und Stempel |
| 6 | Challenges Special | dynamisch | die Bilder, groß |
| 7 | Punkte | fest | allgemein |
| 8 | Badges | fest | **mit dem seltensten Abzeichen: „haben nur x %"** |
| 9 | Konfi | fest | allgemein |
| 10 | Abschluss | fest | Übersicht |

**Wichtig:** Das sind rund zehn Seiten für eine sehr aktive Person — nicht
acht. Die Zahl ergibt sich aus dem, was jemand getan hat, nicht aus einer
festen Obergrenze.

## Dynamische Sonderseiten

Zusätzlich zu den oben genannten. Simons Beispiele — die Liste ist
ausdrücklich als „sowas alles" gemeint, also erweiterbar:

- **„Die/der Wahrste"** bzw. **„die Fleißigste"** — Superlativ-Seiten
- **„Auf den letzten Drücker"** — z. B. 10 Punkte in den letzten drei
  Monaten. Datenlage geprüft: `user_activities.completed_date` trägt den
  Zeitverlauf, das ist rechenbar.
- **Advent** — als Kategorie-Sonderseite. Kategorien sind pro Gemeinde frei
  benennbar (heute: Gottesdienst, Gemeinde, Unterricht, Kasualien,
  Freizeit), eine Gemeinde kann also „Advent" anlegen.

## Das seltenste Abzeichen

Auf der Badges-Seite soll stehen, welches Abzeichen selten ist: **„haben nur
x %"**.

Datenlage geprüft (02.09.2026): berechenbar aus `user_badges` gegen die Zahl
der Konfis der Organisation. Beispiel-Abfrage:

```sql
SELECT cb.name, count(ub.id) AS haben_es,
       (SELECT count(*) FROM users u JOIN roles r ON r.id = u.role_id
         WHERE r.name = 'konfi' AND u.organization_id = 4) AS konfis_gesamt
FROM custom_badges cb
LEFT JOIN user_badges ub ON ub.badge_id = cb.id
WHERE cb.organization_id = 4
GROUP BY cb.id, cb.name
ORDER BY haben_es ASC;
```

## Was dabei gilt (aus früheren Entscheidungen)

Diese Regeln stehen fest und dürfen beim Umbau nicht aufgeweicht werden:

- **Keine Negativ-Seiten.** Kein Highlight fürs Absagen, keine Fehlzeiten.
  (Simon, 01.09.2026)
- **Vergleiche nur nach oben und anonym.** Wer unter dem Jahrgangsschnitt
  liegt, bekommt die Seite gar nicht erst — nicht die Seite mit einem
  mageren Vergleich.
- **Challenges ohne Punkte, ohne Zähler, ohne Rangliste** (Migration 118).
  Das seltenste Abzeichen ist davon nicht berührt: Es ist eine Aussage über
  das Abzeichen, keine Rangliste über Menschen.
- **Wer wenig getan hat, bekommt keine leere Seite.** Eine Kachel mit einer
  Null darauf ist keine Erinnerung.

## Stand der Umsetzung (02.09.2026)

**Fertig:**
- Migration 143 `wrapped_ausgaben` (frei benennbare Ausgaben, eigener
  Zeitraum, eigene Freigabe, beliebig viele pro Jahrgang)
- 16 Bildmotive, in `SlideBase` angeschlossen
- Abzeichen-Symbole: `-outline`-Fehler behoben (74 von 174 Abzeichen zeigten
  einen Pokal statt ihres Symbols)

**Offen:**
- Die Kachel-Auswahl `backend/utils/wrappedKacheln.js` hängt an **keinem
  Aufrufer**. `WrappedModal.tsx` stellt die Seiten weiterhin selbst und fest
  verdrahtet zusammen.
- Das Modul bildet noch das ALTE Modell ab (4 feste + 4 dynamische, Obergrenze
  8) und muss auf die Dramaturgie oben umgebaut werden.
- Die Sonderseiten oben gibt es noch nicht.
- Das Layout folgt noch nicht Simons Design-Entwurf (Typo-Skala 128 px bis
  14 px, Bebas Neue als Akzent).

---

# Mehr Kacheln (Vorschläge, 02.09.2026)

Auf Simons Wunsch: mehr Ideen, für Konfis **und** Teamer:innen. Jede Kachel
unten ist gegen die vorhandenen Daten geprüft — was nicht rechenbar ist,
steht als solches gekennzeichnet.

Weiterhin gilt: keine Negativ-Seiten, Vergleiche nur nach oben und anonym,
keine Ranglisten über Menschen.

## Für Konfis

### Zeit und Rhythmus
- **Auf den letzten Drücker** — „10 deiner 15 Punkte kamen in den letzten
  drei Monaten." *(rechenbar: `user_activities.completed_date`)*
- **Von Anfang an dabei** — Gegenstück: gleichmäßig übers Jahr verteilt.
- **Dein stärkster Monat** — schon vorhanden, gehört in die Reihe.
- **Dein Wochentag** — „Deine Termine lagen fast immer sonntags."
  *(rechenbar aus `event_date`)*
- **Die frühe Vogel-Kachel** — „Du warst bei drei Terminen vor 9 Uhr dabei."
- **Der lange Atem** — „Zwischen deinem ersten und letzten Termin lagen
  241 Tage."

### Anmelden (Simons Idee, 02.09.2026)
Wer sich oft anmeldet, sagt damit etwas — das lässt sich witzig verpacken,
ohne jemanden vorzuführen. **Immer nur positiv wenden**: Es geht um Vorfreude
und Dabeisein, nie um Absagen oder Unzuverlässigkeit.

- **Die Schnellste** — „Bei sechs Terminen warst du unter den ersten drei,
  die zugesagt haben." *(rechenbar: `event_bookings.created_at` gegen die
  anderen Anmeldungen desselben Termins)*
- **Sofort dabei** — „Im Schnitt hast du 3 Tage nach der Veröffentlichung
  zugesagt." Augenzwinkernd: „Du musstest nicht lange überlegen."
- **Zu allem Ja gesagt** — „Du hast dich zu 22 Terminen angemeldet."
  Die reine Anmeldezahl, unabhängig davon, wie viele stattfanden.
- **Der Frühbucher** — „Deine erste Anmeldung kam elf Minuten nach der
  Ankündigung." Der Superlativ-Fall, nur wenn es wirklich auffällig ist.
- **Warteliste-Held:in** — „Zweimal bist du von der Warteliste nachgerückt
  und warst trotzdem da." *(rechenbar: `status`-Verlauf)*

Vorsicht bei der Formulierung: „Du hast dich zu X Terminen angemeldet, warst
aber nur bei Y" wäre eine Negativ-Aussage und ist ausgeschlossen. Gezeigt
wird die Anmeldung als Zeichen von Interesse, nicht als Versprechen, das
gebrochen wurde.

### Abzeichen und Seltenheit
- **Dein seltenstes Abzeichen** — „Das haben nur 8 % deines Jahrgangs."
  *(Simons Idee, rechenbar)*
- **Der Sammler** — „Du hast 7 von 15 Abzeichen." *(vorhanden)*
- **Das erste** — „Dein allererstes Abzeichen war … am …"
- **Kurz davor** — „Bei zwei Abzeichen fehlt dir nur noch ein Schritt."
  *(nur wenn wirklich knapp; sonst wirkt es wie ein Vorwurf)*

### Gemeinschaft
- **Chat-Star** — vorhanden.
- **Reaktions-Magnet** — „89 Reaktionen auf deine Nachrichten." *(vorhanden)*
- **Der Antwortende** — „Du hast am häufigsten auf andere reagiert."
  Der freundliche Gegenpol zum Chat-Star: Es geht ums Zuhören, nicht ums
  Senden.
- **Nie allein** — „Bei 12 Terminen warst du mit denselben drei Leuten da."
  *(rechenbar über gemeinsame `event_bookings`; anonym halten — keine Namen
  ohne Einwilligung)*

### Challenges
- **Deine Momente** — vorhanden, mit Fotos.
- **Challenges Special** — die Bilder groß. *(Simons Idee)*
- **Der Vielseitige** — „Du hast mit Text, Foto UND Audio geantwortet."
  *(rechenbar aus `challenge_submissions.media_type`)*
- **Der Mutige** — „Du hast dich bei X Beiträgen mit Namen gezeigt."
  *(rechenbar aus `konfi_consent`; nur positiv wenden)*
- **Die erste Antwort** — „Bei der Challenge … warst du die Erste, die
  geantwortet hat."

### Kategorie-Seiten (Simons Vorgabe, 02.09.2026)

**Nicht eine Seite mit wechselndem Inhalt, sondern mehrere feste, benannte
Seiten.** Jede hat ihr eigenes Bild, ihre eigene Farbe und ihren eigenen
Text. Eine Seite erscheint nur, wenn die Gemeinde die Kategorie überhaupt
nutzt **und** die Person darin etwas getan hat.

Simon: „Wir setzen 6 oder 8 Kategorien, die dann vorkommen als möglicher
Slide."

#### Warum das trägt — gemessen am 02.09.2026

Kategorien sind pro Gemeinde frei benannt, aber einige Namen wiederholen
sich über die Organisationen hinweg:

| Kategorie | in wie vielen Gemeinden |
|---|---|
| Freizeit | 4 von 5 |
| Kasualien | 4 von 5 |
| Gemeinde | 3 |
| Gottesdienst | 3 |
| Unterricht | 3 |
| Jugend, Kinder, Fest, Kreativ, Öffentlichkeitsarbeit, Urlauberseelsorge | je 1 |

Es lohnt sich also, für die häufigen Namen feste Seiten zu bauen. Für
seltene bleibt eine allgemeine Schwerpunkt-Seite als Auffangnetz.

#### Die festen Kategorie-Seiten (Vorschlag: 8)

| Kategorie | Seite | Ton |
|---|---|---|
| **Kasualien** | „Du warst dabei, wenn es zählte" | Taufe, Trauung, Beerdigung — die Kategorie, in der Konfis den Ernstfall des Glaubens erleben. Ruhiges Bild (Kerzen, Kirchenschiff), zurückhaltender Ton. |
| **Gottesdienst** | „Sonntagstreu" | Die klassische Kategorie. Kirchenschiff, Fenster. |
| **Freizeit** | „Unterwegs" | Fahrten und Freizeiten. Deich, Watt, Wasser. |
| **Unterricht** | „Dranbleiben" | Die Konfistunden. Buch, Fenster. |
| **Gemeinde** | „Mit angepackt" | Gemeindefest, Helfen. Luftschlangen, Konfetti. |
| **Jugend** | „Deine Leute" | Jugendgruppe, Jugendtreff. Gitarre, Lagerfeuer-Stimmung. |
| **Advent / Weihnachten** | „Zwischen den Lichtern" | Simons Idee. Kerzen, Sternenhimmel. **Voraussetzung:** Die Kategorie muss angelegt sein — heute hat nur Org 5 „Gottesdienst an Weihnachten". Vorschlag: als empfohlene Standardkategorie beim Anlegen einer Gemeinde vorschlagen, dann können alle sie nutzen. |
| **Öffentlichkeitsarbeit** | „Du hast es nach draußen getragen" | Simons Idee. Heute nur in Org 1. Gemeindebrief, Social Media, Infoscreen. |

#### Über das DATUM statt nur über die Kategorie (Simon, 02.09.2026)

Simons Nachtrag, und er ist der bessere Weg: **„Gottesdienst im Dezember ist
ja immer auch Advent/Weihnachten. Und Neujahr können wir auch übers Datum
machen."**

Das löst das Problem, dass Gemeinden ihre Kategorien frei benennen: Ein
Gottesdienst am 24. Dezember ist Christvesper, ganz gleich ob die Kategorie
„Gottesdienst", „Advent" oder „Heiligabend" heißt. Das Datum lügt nicht.

Die Zeitfenster (`event_date` bzw. `user_activities.completed_date`):

| Seite | Zeitraum | Text-Idee |
|---|---|---|
| **Advent** | 1. Advent bis 23.12. | „Vier Kerzen, und du warst bei drei Terminen dabei." |
| **Weihnachten** | 24.12. bis 26.12. | „Heiligabend in der Kirche — du warst da." |
| **Jahreswechsel** | 27.12. bis 6.1. | „Zwischen den Jahren." |
| **Passion / Ostern** | Aschermittwoch bis Ostermontag | beweglich, aus dem Osterdatum berechnet |
| **Sommer** | Juli/August | „Die Freizeit im Sommer." |
| **Erntedank** | erster Sonntag im Oktober | |

**Vorrang:** Trifft beides zu (Kategorie *und* Datum), gewinnt das Datum —
es ist das konkretere Ereignis. Eine Person bekommt nie zwei Seiten über
denselben Termin.

**Datenlage geprüft:** `events.event_date` ist `timestamptz`, die Berliner
Zeitzone steht seit dem 02.09.2026 in Test und Betrieb gleich. Der 1. Advent
und das Osterdatum sind beweglich und müssen berechnet werden (Gauß'sche
Osterformel bzw. vierter Sonntag vor dem 25.12.) — kein Hardcoding von
Jahreszahlen.

#### Wie die Zuordnung funktioniert

Der Kategoriename in der Datenbank ist frei. Damit die Seite trotzdem
greift, braucht es eine **Erkennungsliste** je Seite — mehrere Schreibweisen
zeigen auf dieselbe Seite:

```
advent      -> "Advent", "Weihnachten", "Gottesdienst an Weihnachten",
               "Adventszeit", "Christvesper"
kasualien   -> "Kasualien", "Taufe", "Trauung", "Beerdigung", "Amtshandlungen"
oeffentlich -> "Öffentlichkeitsarbeit", "Presse", "Gemeindebrief"
```

Trifft kein Name, greift die allgemeine Schwerpunkt-Seite („Dein Bereich:
Kreativ") — so geht keine Gemeinde leer aus, auch mit eigenen Namen.

#### Weitere Kategorie-Kacheln
- **Der Allrounder** — „Du warst in allen fünf Bereichen unterwegs."
- **Die Entdeckerin** — „Du hast eine Kategorie ausprobiert, in der sonst
  kaum jemand war."

### Weg und Abschluss
- **Deine Konfirmation** — vorhanden.
- **Dein Weg in Zahlen** — Abschluss, vorhanden.
- **Der Anfang** — „Dein erster Termin war am … Weißt du noch?"

## Für Teamer:innen

Heute gibt es nur sechs Seiten (Termine geleitet, Konfis betreut, Abzeichen,
Zertifikate, Engagement, Zeitraum). Da geht deutlich mehr.

### Verantwortung
- **Dein größter Termin** — „Bei … waren 34 Konfis dabei." *(vorhanden als
  `meiste_teilnehmer_event`, aber ohne eigene Seite)*
- **Deine Jahrgänge** — „Du hast 2 Jahrgänge begleitet, 27 Konfis."
  *(vorhanden)*
- **Die Verlässliche** — „Du hast bei 18 von 20 Terminen zugesagt."
  *(rechenbar seit Migration 141: `event_bookings.status`)*
- **Immer da** — „Du warst bei jedem Pflichttermin dabei."

### Wachstum
- **Deine Jahre** — vorhanden, aber nur wenn `teamer_since` gesetzt ist.
- **Vom Konfi zur Teamer:in** — „Vor drei Jahren warst du selbst Konfi."
  *(rechenbar, wenn ein `konfi_profiles`-Eintrag existiert; sehr schöner
  Moment für befördert Teamer:innen)*
- **Deine Zertifikate** — vorhanden.
- **Neu dabei** — für das erste Jahr: „Dein erstes Jahr im Team."

### Miteinander
- **Dein Team** — „Ihr wart zu fünft für die Jahrgänge da."
- **Der Draht zu den Konfis** — „Du hast X Nachrichten im Jahrgangs-Chat
  geschrieben." *(rechenbar aus `chat_messages`)*
- **Die Challenge-Begleiterin** — „Du hast X Beiträge freigegeben."
  *(rechenbar aus `challenge_submissions.moderation_status` — nur die eigene
  Leistung zeigen, keine Ablehnungsquote)*
- **Mitgemacht statt nur begleitet** — „Du hast selbst bei X Challenges
  mitgemacht." Teamer:innen nehmen ausdrücklich teil (Migration 118).

### Noch nicht rechenbar
Diese bräuchten neue Daten und sind bewusst als offen markiert:
- „Wie viele Kilometer du für die Gemeinde gefahren bist" — keine Daten.
- „Deine Lieblingszeit" (Tageszeit der Termine) — `event_date` hat zwar eine
  Uhrzeit, aber die Aussagekraft ist gering, solange Termine überwiegend
  sonntags morgens liegen.

## Auswahl-Logik

Für eine sehr aktive Person kommen so über 20 Kacheln in Frage — gezeigt
werden soll aber eine Erzählung, kein Katalog.

Vorschlag: Die **feste Dramaturgie** (Opener, Events, Punkte, Badges, Konfi,
Abschluss) steht immer. Dazwischen schieben sich die dynamischen Seiten in
der Reihenfolge oben, begrenzt auf etwa **10 bis 12 Seiten gesamt** — mehr
blättert niemand durch. Bei Gleichstand gewinnt das Persönlichere: ein Foto
schlägt eine Zahl, ein Moment schlägt eine Statistik.

Themen-Streuung bleibt: Nicht drei Chat-Kacheln hintereinander, auch wenn
alle drei zuträfen.
