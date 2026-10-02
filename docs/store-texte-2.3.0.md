# Store-Texte 2.3.0

Quelle: Abschnitt `## [Unreleased] - 2.3.0` in `CHANGELOG.md`, Stand
01.10.2026 abends (neu gefasst; die erste Fassung stammte vom Stand
Build 231/125 und kannte alles ab dem 29.09. nicht).
Beide Texte sind getrennt zu verwenden — niemals mischen.

Versionsstände stehen in `frontend/version.json` (die eine Quelle, aus der
beide Release-Workflows lesen). **Eingereicht am 02.10.2026:** iOS-Build
**240** (TestFlight, aus `d99346fe`) und Android versionCode **134** (vom
Release-Commit, Produktion gestaffelt). Auf beiden Plattformen ist 2.2.0 die
Vorgängerin (iOS-Build 206, Android versionCode 113, seit 18.09.2026 zu
100 Prozent live); beide Texte beschreiben also dieselbe Spanne. Android hat
2.1 übersprungen — das haben schon die 2.2.0-Texte aufgefangen, die alles
seit 2.0 zusammenfassten.

---

## Was in dieser Version für alle sichtbar ist

Aus über 400 Einträgen des CHANGELOG bleiben für die Store-Texte die, die
Nutzer:innen ohne Vorwissen bemerken. Der Rest (Betriebs-Überblick,
Abstände, Symbol-Marken, Begriffe, interne Aufräumarbeiten) bleibt draußen —
wer es genau wissen will, findet es im CHANGELOG und in der Übersicht „Was
ist neu?" in der App.

1. **Postfach mit Glocke** — für alle Rollen die auffälligste Änderung.
2. **Auswählen, welche Mitteilungen aufs Handy kommen** — in der App, nicht
   in den Systemeinstellungen.
3. **Rote und orange Zahlen**: neue Challenge-Beiträge wie im Chat; offene
   Freigaben, zu verbuchende Events und Anträge in den Umschaltern oben; die
   Zahl am App-Symbol zählt mit.
4. **In mehreren Gemeinden mitarbeiten** — eigene Rolle je Gemeinde,
   Umschalter oben links, Einladung bestehender Konten mit Rückmeldung.
5. **Material und Challenge-Bilder bleiben auf dem Gerät.**
6. **Kleinere Dinge, die viele merken:** Konfi-Liste bei Pflicht-Events nach
   Vornamen, Mitteilung beim Austragen aus einem Event, Bestätigungs-Mail nach
   Passwortänderung, Einladungscodes 7 bis 90 Tage, Konfi-Zeit bleibt bei der
   Beförderung erhalten.
7. **Dunkelmodus, eigene Farbe der Leitung, „Was ist neu?"**, Absturzberichte
   abschaltbar.
8. **Behoben**, plattformübergreifend: Erinnerung „Gleich" eine Stunde
   vorher, laufendes Event unter „Verbuchen", mehrtägige Events, Event-
   Mitteilung führt zum Event, App-Sperre „Sofort", Mitteilungen an große
   Gruppen.
9. **Behoben, nur Android:** Mitteilungen nach Update oder Neuanmeldung und
   bei offener App, PDF und Word in Chat und Material.
10. **Links aus Einladung und Passwort-Mail öffnen die App** — auf Android als
   Reparatur der App-Links, auf dem iPhone neu (Universal Links, ab Build 240,
   Simon 02.10.2026).

**Upload von PDF und Word vom Android-Handy:** im Gerätetest mit Build 133
am 02.10.2026 bestätigt (Download-Ordner und Google Drive, Chat und
Material) und deshalb im Play-Text. Nicht aus der Nextcloud-App — ein
zurückgestellter Sonderfall (`docs/offene-befunde.md` Nr. 16), der im
Store-Text nicht vorkommt. Die Sortierung bei Pflicht-Events ist seit PR
#213 auf main.

---

## iOS — App Store Connect, „Neues in dieser Version"

> **Kein Wort über andere Plattformen — Apple lehnt danach ab.**
> Am 29.08.2026 wurde 2.0.0 (Build 149) unter Guideline 2.3.10
> zurückgewiesen, weil im letzten Absatz „der Anzeige auf Android" stand.
> Ein einziger Halbsatz. Zwei Tage Wartezeit, danach eine neue Prüfrunde.
> Verboten sind Android, Google Play, Windows und Verweise auf eine Web-App,
> in JEDEM Feld. Der `ios-release`-Workflow prüft den iOS-Abschnitt dieser
> Datei (von der iOS-Überschrift bis zur Android-Überschrift) vor dem Build —
> die beiden Überschriften dürfen deshalb nirgends sonst wörtlich stehen,
> sonst endet die Prüfung zu früh.

> **Die Android-Reparaturen gehören hier NICHT hinein** (Mitteilungen nach
> Update, Absturz beim Antippen, Systemleiste, Reiterleiste). Sie
> betrafen ausschließlich das andere System; auf dem iPhone kamen die
> Mitteilungen durchgehend an. Sie zu erwähnen wäre ein Plattform-Verweis und
> zugleich sachlich falsch. Der Satz über die Links ist keine solche
> Reparatur: Auf dem iPhone öffnen sie die App mit 2.3.0 zum ersten Mal
> (Universal Links, ab Build 240).

> **Höchstens 4.000 Zeichen.** Der Text unten hat 2.343.

```
Ein Postfach für alles, was die App dir mitteilen will: Oben rechts steht jetzt eine Glocke. Dahinter sammeln sich Badges, Anträge und die Entscheidungen dazu, Punkte, Level-Aufstiege, Anmeldungen und Änderungen an Events – auch das, was du als Push verpasst hast. Antippen führt an die passende Stelle, „Alle gelesen“ räumt auf.

Du wählst selbst, welche Mitteilungen aufs Handy kommen: „Nachrichten“, „Events“ und „Punkte und Badges“ lassen sich in der App einzeln ab- und anschalten. Im Postfach steht jede Mitteilung weiterhin.

Neues auf einen Blick: Eine rote Zahl am Reiter und an der einzelnen Challenge zeigt neue Beiträge, bis du sie gesehen hast – wie im Chat. Eine orange Zahl in den Umschaltern oben zeigt, wo Freigaben warten, bei der Leitung auch zu verbuchende Events und offene Anträge. Die Zahl am App-Symbol zählt mit.

In mehreren Gemeinden mitarbeiten, mit eigener Rolle je Gemeinde: Wer in der einen die Leitung stellt, kann in der anderen Teamer:in sein. Der Umschalter oben links zeigt je Gemeinde, wo etwas offen ist. Die Gemeindeleitung lädt Personen mit bestehendem Konto direkt ein und erfährt, ob sie zusagen.

Dateien im Material und Bilder in Challenges bleiben nach dem ersten Öffnen auf dem Gerät und öffnen beim nächsten Mal sofort.

Bei Pflicht-Events steht die Konfi-Liste nach Vornamen. Wer von der Leitung aus einem Event ausgetragen wird, bekommt eine Mitteilung. Nach jeder Passwortänderung kommt eine Bestätigung per E-Mail. Einladungscodes gelten wahlweise 7 bis 90 Tage.

Bei der Beförderung ins Team bleibt die Konfi-Zeit erhalten: besuchte Events, Punkte, Badges und der Konfispruch.

Links aus der Einladung und aus der Mail „Passwort vergessen“ öffnen direkt die App, wenn sie installiert ist.

Die App folgt dem Dunkelmodus des Geräts, und die Leitung hat eine eigene Farbe. Nach dem Update zeigt eine Übersicht, was sich geändert hat – jederzeit nachlesbar unter „Was ist neu?“. Absturzberichte lassen sich im Profil abschalten.

Behoben: Die Erinnerung „Gleich“ kommt eine Stunde vor Beginn. Ein laufendes Event steht schon unter „Verbuchen“. Mehrtägige Events zeigen beide Tage. Eine Mitteilung zu einem Event führt direkt zum Event. Die App-Sperre auf „Sofort“ greift auch, wenn die App aus der App-Übersicht zurückkommt. Mitteilungen an ganze Gemeinden oder Jahrgänge kommen zuverlässig an.
```

---

## Android — Google Play, „Was ist neu"

> **Dieser Text steht in `frontend/release-notes-de.txt`.** Der Play-Upload
> liest ausschließlich diese Datei. **Maximal 500 Zeichen**, sonst bricht der
> Upload ab — messen mit `wc -m` (Zeichen) und zur Sicherheit `wc -c` (Bytes,
> Umlaute zählen doppelt; die Datei unten hat 488 Zeichen, 493 Bytes).
> Wer den Text hier ändert, ändert die Datei mit.

> **Hier gehört die Push-Reparatur an die erste Stelle der Behoben-Zeile.**
> Wer die App aktualisiert oder sich neu angemeldet hatte, bekam seit Wochen
> keine Mitteilungen mehr und wusste nicht, warum. Das Postfach steht davor,
> weil es die Änderung ist, die jede Rolle sofort sieht — es fehlte in den
> bisherigen Notizen ganz.

```
Neu: Ein Postfach hinter der Glocke sammelt alles, was die App dir mitteilt; du wählst, was aufs Handy kommt. Rote Zahlen zeigen neue Challenge-Beiträge, orange Zahlen offene Freigaben, das App-Symbol zählt mit. In mehreren Gemeinden mitarbeiten, mit eigener Rolle je Gemeinde. Dunkelmodus folgt dem Gerät.

Behoben: Mitteilungen kommen nach Update oder Neuanmeldung wieder an. PDF und Word lassen sich in Chat und Material hochladen. Links aus Einladung und Passwort-Mail öffnen die App.
```

---

## Screenshots

Neu gezogen am 01.10.2026 gegen Produktion (Commit `9dd6cb97`, „Bilder für
2.3 neu gezogen"): je Gerät 21 Bilder mit Glocke und Gemeinde-Umschalter.
Vor dem Einreichen noch einmal ansehen, ob sich seither etwas Sichtbares
geändert hat. Wer neu zieht, hält die Reihenfolge aus `CLAUDE.md` ein:
**erst deployen, dann ziehen**, und jedes Bild ansehen (Glocke oben rechts,
Banner „Version 2.3", kein Ladezustand, keine 404-Seite).

```bash
KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs                 # iPhone, 21 Bilder
KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs --geraet play   # Android, 21 Bilder
npm --prefix frontend run docs:handbuch                            # eingebundene Bilder als WebP nach frontend/public/docs/bilder/
```

Je Gerät (`docs/screenshots/iphone/` und `docs/screenshots/play/`) dieselben
21 Dateien:

| Rolle | Bilder |
|---|---|
| Konfi | `konfi-startseite`, `konfi-mitmachen`, `konfi-challenges`, `konfi-challenge-feed`, `konfi-challenge-detail`, `konfi-chat`, `konfi-abzeichen`, `konfi-profil` |
| Teamer:in | `teamer-startseite`, `teamer-mitmachen`, `teamer-challenges`, `teamer-chat`, `teamer-abzeichen`, `teamer-profil` |
| Leitung | `leitung-konfis`, `leitung-chat`, `leitung-mitmachen`, `leitung-challenges`, `leitung-einstellungen`, `leitung-jahrgaenge`, `leitung-abzeichen` |

Das Handbuch bindet 15 der iPhone-Bilder ein (die anderen sechs iPhone- und
alle Play-Bilder dienen nur den Stores). Welche Bilder in die Stores
hochgeladen werden und in welcher Reihenfolge, entscheidet wer einreicht — die
Store-Konsolen halten die Auswahl fest, nicht das Repo.

---

## Was in den Store-Konsolen anzugeben ist

Was sich mit 2.3.0 ändert und beim Einreichen abgefragt wird. Hier steht nur,
**was zu prüfen** ist — die Entscheidung trifft, wer einreicht.

### App Store Connect

- **Version 2.3.0** mit dem Build aus `frontend/version.json` (der Workflow
  setzt beides; zuletzt 238).
- **„Neues in dieser Version"**: der iOS-Text oben, ohne Plattform-Wörter.
- **Screenshots**: die iPhone-Bilder vom 01.10.2026 (siehe oben).
- **App-Datenschutz (Nährwerttabelle)** — die App erhebt seit dieser Version
  mehr als bisher deklariert sein könnte. Abzugleichen mit
  `frontend/ios/App/App/PrivacyInfo.xcprivacy` und Abschnitt 9b der
  Datenschutzerklärung:
  - **Absturzberichte** (Firebase Crashlytics, neu in 2.3.0): Kategorie
    „Diagnose → Absturzdaten", nicht mit der Identität verknüpft, kein
    Tracking. Das Manifest führt es unter `OtherDiagnosticData`.
  - **Nutzungsdaten** (Umami, seit 2.1): „Nutzungsdaten → Produktinteraktion",
    nicht verknüpft, kein Tracking.
  - **Geräte-Kennung** (Push-Token): „Kennungen → Geräte-ID", mit dem Konto
    verknüpft, kein Tracking.
  - **Offene Frage, nicht hier zu entscheiden:** Verändert die Mitarbeit in
    mehreren Gemeinden die Angaben? Es kommt **keine neue Datenart** hinzu —
    aber Name, Benutzername, Rolle und Jahrgänge einer Person werden nach
    ihrer Zusage in einer **zweiten** Gemeinde sichtbar und dort verwaltbar.
    Das ist ein neuer Datenfluss, den die Datenschutzerklärung heute nicht
    beschreibt (Audit 26.09.2026, Doku BF-08 / Sammelbefund S-20). Die
    Nährwerttabelle fragt nach Datenarten und Zwecken, nicht nach
    Empfängern innerhalb des Dienstes; ob eine Angabe nötig wird, ist eine
    Rechtsfrage.
- **Datenschutz-URL**: zeigt auf `konfi-quest.de/datenschutz`. Die Erklärung
  trägt „Stand: 1. Oktober 2026" und beschreibt Crashlytics (9b) und die
  Reichweitenmessung (9a); Simon hat 9a am 01.10.2026 gegengelesen. Offen
  bleibt nur die Frage oben zur Sichtbarkeit in einer zweiten Gemeinde.

### Play Console

- **versionCode** und Version 2.3.0 aus `frontend/version.json` (134 für
  die Produktion; `build.gradle` liest die Datei direkt).
- **„Was ist neu"**: kommt aus `frontend/release-notes-de.txt` — der Text oben.
- **Track**: Der `android-release`-Workflow reicht ohne ausdrückliche Angabe
  nur in die Testkanäle ein (seit dem 15.09.2026, als versionCode 102
  versehentlich in die Produktion ging). Für die Veröffentlichung muss
  `production` gesetzt werden.
- **Screenshots**: die Play-Bilder vom 01.10.2026 (1080 × 2160).
- **Datensicherheit** — abzugleichen mit Abschnitt 9a/9b der
  Datenschutzerklärung:
  - **Absturzprotokolle** (Firebase Crashlytics, neu in 2.3.0) unter „App-
    Leistung", wenn dort noch nicht angegeben.
  - **App-Interaktionen** (Umami) unter „App-Aktivitäten".
  - **Geräte- oder andere IDs** (Push-Token).
  - Dieselbe offene Frage wie oben zur Sichtbarkeit in einer zweiten
    Gemeinde.
- **Datenschutzerklärung-URL**: wie bei Apple; gleiche Auflage.

---

## Prüfschritte vor dem Einreichen

1. `frontend/release-notes-de.txt` mit dem Play-Text abgleichen und die Länge
   messen: `wc -m frontend/release-notes-de.txt` — muss unter 500 liegen.
2. iOS-Text auf Plattform-Verweise prüfen (der Workflow tut es auch, aber
   erst beim Build — ein Fehlschlag kostet einen Durchlauf).
3. Beide Texte gegen den CHANGELOG lesen: Steht darin etwas, das gar nicht
   ausgeliefert wird? Insbesondere: Ist „Was ist neu?" für alle drei Rollen
   in der Fassung enthalten, die eingereicht wird?
4. Screenshots angesehen (siehe oben); neu ziehen nur nach einem Deploy.
5. Datenschutz-Angaben in beiden Konsolen gegen `PrivacyInfo.xcprivacy` und
   die Datenschutzerklärung geprüft; Erklärung auf dem Stand von 2.3.0.
