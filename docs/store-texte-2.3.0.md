# Store-Texte 2.3.0

Quelle: Abschnitt `## [Unreleased] - 2.3.0` in `CHANGELOG.md`.
Beide Texte sind getrennt zu verwenden — niemals mischen.

Versionsstände aus `frontend/version.json` (die eine Quelle, aus der beide
Release-Workflows lesen): **2.3.0**, Android versionCode **124**, iOS-Build
**230**. Auf beiden Plattformen ist 2.2.0 die Vorgängerin (iOS-Build 206,
Android versionCode 113) — anders als bei 2.2.0 laufen die Stände diesmal
nicht auseinander, beide Texte beschreiben also dieselbe Spanne.

---

## Was in dieser Version für alle sichtbar ist

Aus den 108 Einträgen des CHANGELOG bleiben für die Store-Texte die, die
Nutzer:innen ohne Vorwissen bemerken. Der Rest (Betriebs-Überblick, Abstände,
Symbol-Marken, Reglerraster, interne Aufräumarbeiten) bleibt draußen — wer es
genau wissen will, findet es im CHANGELOG und in der Übersicht „Was ist neu?"
in der App.

1. **Postfach mit Glocke** — für alle Rollen die auffälligste Änderung; sie
   fehlte in den bisherigen Play-Notizen.
2. **Auswählen, welche Mitteilungen aufs Handy kommen** — in der App, nicht in
   den Systemeinstellungen.
3. **In mehreren Gemeinden mitarbeiten** — eigene Rolle je Gemeinde,
   Umschalter oben links, Einladung bestehender Konten durch die Leitung.
4. **Team-Rückblick je Gemeinde.**
5. **Dunkelmodus** folgt dem Gerät.
6. **Übersicht „Was ist neu?"** nach dem Update.
7. **Behoben**, plattformübergreifend: laufender Termin unter „Verbuchen",
   mehrtägige Termine mit beiden Tagen, Termin-Mitteilung führt zum Termin,
   Zähler beim Gemeindewechsel, App-Sperre „Sofort" aus der App-Übersicht,
   Mitteilungen an große Gruppen.
8. **Behoben, nur Android:** keine Mitteilungen mehr nach Update oder
   Neuanmeldung, Absturz beim Antippen einer Mitteilung, App-Links.

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
> Update, Absturz beim Antippen, App-Links, Systemleiste, Reiterleiste). Sie
> betrafen ausschließlich das andere System; auf dem iPhone kamen die
> Mitteilungen durchgehend an. Sie zu erwähnen wäre ein Plattform-Verweis und
> zugleich sachlich falsch.

> **Höchstens 4.000 Zeichen.** Der Text unten hat 1.760.

```
Ein Postfach für alles, was die App dir mitteilen will: Oben rechts steht jetzt eine Glocke. Dahinter sammeln sich verliehene Abzeichen, eingereichte Anträge und die Entscheidungen dazu, Punkte, Level-Aufstiege, Anmeldungen und Terminänderungen – auch das, was du als Push verpasst hast. Ungelesenes ist markiert, Antippen führt an die passende Stelle, „Alle gelesen“ räumt auf. Die Zahl am App-Symbol zählt die ungelesenen Mitteilungen mit.

Du wählst selbst, welche Mitteilungen aufs Handy kommen: Unter „Benachrichtigungen“ im Profil beziehungsweise unter „Mehr“ lassen sich Nachrichten, Termine, Punkte und Abzeichen einzeln ab- und anschalten, dazu ein Hauptschalter für alles. Im Postfach steht jede Mitteilung weiterhin.

In mehreren Gemeinden mitarbeiten, mit eigener Rolle je Gemeinde: Wer in der einen die Leitung stellt, kann in der anderen Teamer:in sein. Der Umschalter oben links steht auf jeder Seite und zeigt je Gemeinde, wo etwas offen ist. Die Gemeindeleitung lädt Personen mit bestehendem Konto direkt ein – die eingeladene Person entscheidet selbst, ob sie zusagt.

Der Jahresrückblick fürs Team wird je Gemeinde erstellt.

Die App folgt dem Dunkelmodus des Geräts.

Nach dem Update zeigt eine Übersicht, was sich geändert hat – jederzeit nachlesbar unter „Was ist neu?“ im Profil beziehungsweise unter „Mehr“.

Behoben: Ein laufender Termin steht schon während des Termins unter „Verbuchen“. Mehrtägige Termine zeigen beide Tage. Eine Mitteilung zu einem Termin führt direkt zum Termin. Beim Wechsel der Gemeinde fallen die Zähler an den Reitern sofort auf null und laden frisch. Die App-Sperre auf „Sofort“ greift auch, wenn die App aus der App-Übersicht zurückkommt. Mitteilungen an ganze Gemeinden oder Jahrgänge kommen zuverlässig an.
```

---

## Android — Google Play, „Was ist neu"

> **Dieser Text steht in `frontend/release-notes-de.txt`.** Der Play-Upload
> liest ausschließlich diese Datei. **Maximal 500 Zeichen**, sonst bricht der
> Upload ab — messen mit `wc -m` (Zeichen) und zur Sicherheit `wc -c` (Bytes,
> Umlaute zählen doppelt; die Datei unten hat 437 Zeichen, 443 Bytes).
> Wer den Text hier ändert, ändert die Datei mit.

> **Hier gehört die Push-Reparatur an die erste Stelle der Behoben-Zeile.**
> Wer die App aktualisiert oder sich neu angemeldet hatte, bekam seit Wochen
> keine Mitteilungen mehr und wusste nicht, warum. Das Postfach steht davor,
> weil es die Änderung ist, die jede Rolle sofort sieht — es fehlte in den
> bisherigen Notizen ganz.

```
Neu: Ein Postfach hinter der Glocke oben rechts sammelt alles, was die App dir mitteilt. Du wählst, welche Mitteilungen aufs Handy kommen.

In mehreren Gemeinden mitarbeiten, mit eigener Rolle je Gemeinde. Team-Rückblick je Gemeinde. Dunkelmodus folgt dem Gerät.

Behoben: Nach Update oder Neuanmeldung kamen keine Mitteilungen mehr. Antippen einer Mitteilung ließ die App abstürzen. Einladungs- und Passwort-Links öffnen direkt die App.
```

---

## Screenshots, die vor dem Einreichen neu gezogen werden müssen

Alle 42 Bilder unter `docs/screenshots/` stammen vom 10.09.2026 und zeigen
2.2.x: keine Glocke, kein Gemeinde-Umschalter, Banner „Version 2.1". Dieselben
Bilder dienen als Store-Bilder — sie würden 2.3.0 mit der alten Oberfläche
bewerben (Audit 26.09.2026, UI BF-09 / Sammelbefund S-17).

Reihenfolge, wie `CLAUDE.md` sie verlangt: **erst deployen, dann ziehen**, und
jedes Bild ansehen (Glocke oben rechts, Banner „Version 2.3", kein Ladezustand,
keine 404-Seite).

```bash
KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs                 # iPhone, 21 Bilder
KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs --geraet play   # Android, 21 Bilder
npm --prefix frontend run docs:handbuch                            # spiegelt nach frontend/public/docs/bilder/
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

- **Version 2.3.0, Build 230** (aus `frontend/version.json`; der Workflow
  setzt beides).
- **„Neues in dieser Version"**: der iOS-Text oben, ohne Plattform-Wörter.
- **Screenshots**: die neu gezogenen iPhone-Bilder (siehe oben).
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
  trägt „Stand: Juni 2026" und kennt weder Crashlytics-Datum noch
  Multi-Gemeinde — vor dem Einreichen nachziehen (Doku BF-08).

### Play Console

- **versionCode 124**, Version 2.3.0 (aus `frontend/version.json`;
  `build.gradle` liest die Datei direkt).
- **„Was ist neu"**: kommt aus `frontend/release-notes-de.txt` — der Text oben.
- **Track**: Der `android-release`-Workflow reicht ohne ausdrückliche Angabe
  nur in die Testkanäle ein (seit dem 15.09.2026, als versionCode 102
  versehentlich in die Produktion ging). Für die Veröffentlichung muss
  `production` gesetzt werden.
- **Screenshots**: die neu gezogenen Play-Bilder (1080 × 2160).
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
4. Screenshots neu gezogen und angesehen (siehe oben) — erst nach dem Deploy.
5. Datenschutz-Angaben in beiden Konsolen gegen `PrivacyInfo.xcprivacy` und
   die Datenschutzerklärung geprüft; Erklärung auf dem Stand von 2.3.0.
