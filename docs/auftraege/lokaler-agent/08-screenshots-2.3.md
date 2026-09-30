# 08 — Screenshots für 2.3 neu ziehen (UI BF-09)

Nach dem Deploy des Stands vom 29.09.2026 — **erst deployen, dann ziehen**
(CLAUDE.md, „Screenshots"). Dieser Auftrag ist der ausführliche Weg zu
Abschnitt 4 in [03](03-nach-dem-deploy.md) und zum Abschnitt „Screenshots"
in `docs/store-texte-2.3.0.md`: welche Bilder, warum jedes davon sich geändert
haben muss und woran man ein gelungenes Bild erkennt.

## Worum es geht

Alle 42 Bilder unter `docs/screenshots/iphone/` und `docs/screenshots/play/`
stammen vom 10.09.2026 (Commit `56b99d56`) und zeigen 2.2.x. Seitdem kam
vieles dazu, das auf **jedem** Bild zu sehen sein muss, vor allem die
**Glocke** oben rechts (Postfach, seit 25.09.2026). 15 der iPhone-Bilder
stehen im Handbuch, alle 42 dienen als Store-Bilder für 2.3.0.

## 1. Ziehen

- [x] Stand prüfen: `GET /api/status` meldet die App-Version aus
      `frontend/version.json` und den Commit des Deploys (siehe 03, Abschnitt 1).
- [x] iPhone: `KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs`
      (21 Bilder, Demo-Gemeinde, iOS-Look).
- [x] Android: `KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs --geraet play`
      (21 Bilder, 1080 × 2160). Das Skript setzt dafür die **Android-Kennung**
      (`GERAETE.play.kennung`); ohne sie entstehen die Bilder im iOS-Look und
      die MD3-Fehler bleiben unsichtbar. Probe an einem Bild: Unten die
      Reiterleiste im MD3-Stil (Symbol über der Beschriftung, ohne iOS-Glas),
      Umschalter mit Unterstrich statt Kapsel.
- [x] Nur die Demo-Konten der Demo-Gemeinde benutzen, keine anderen Konten.

## 2. Jedes Bild ansehen

Allgemein, für alle 42:

- [x] Kein Ladezustand, keine 404-Seite, kein Anmeldefehler, keine leere
      Liste, wo die Demo-Gemeinde Einträge hat.
- [x] **Glocke** oben rechts in der Kopfzeile.
- [x] Links in der Kopfzeile steht der **Name der Gemeinde** nur, wenn das
      Demo-Konto mehreren Gemeinden angehört, und nur auf den Seiten mit
      eigenem Reiter unten. Gehört es nur zur Demo-Gemeinde, steht dort nichts
      — beides ist richtig; nicht das eine auf einem Bild und das andere auf
      dem nächsten.
- [x] Keine echten Namen aus anderen Gemeinden, keine Mitteilungen mit
      Inhalten aus anderen Gemeinden.
- [x] Steht ein Testphase-, Wartungs- oder Update-Hinweis auf dem Bild: nicht
      einchecken, Simon fragen, ob das Bild so in den Store darf.
- [x] MD5 über alle Bilder: keine zwei gleich.

Je Bild (iPhone und Play gleich), was sich gegenüber dem 10.09. geändert haben
muss — fehlt es, zeigt das Bild einen alten Stand oder die falsche Seite. Auf
Profil und „Mehr" steht das Banner „Was ist neu in Version 2.3?" dauerhaft; die
alten Bilder zeigen dort „Version 2.1":

| Bild | Seite | Muss zu sehen sein (zusätzlich zur Glocke) |
|---|---|---|
| `konfi-startseite` | `/konfi/dashboard` | Event-Karten mit Wochentag im Datum (Mo., 14.09.2026); steht ein Banner „Was ist neu …?" da, dann mit 2.3 |
| `konfi-mitmachen` | `/konfi/events` | durchgehend „Event" statt „Termin"/„Veranstaltung" |
| `konfi-challenges` | `/konfi/challenges` | „Stempel" statt „Abzeichen" an den Challenges |
| `konfi-challenge-feed` | `/konfi/challenges` (Beitragsliste) | wie `konfi-challenges` |
| `konfi-challenge-detail` | `/konfi/challenges` (geöffnet) | Stempel statt Abzeichen; rote Zahl nur, wenn Neues da ist |
| `konfi-chat` | `/konfi/chat` | — (nur Glocke und dunklere graue Nebentexte) |
| `konfi-abzeichen` | `/konfi/badges` | „Badges" als Begriff |
| `konfi-profil` | `/konfi/profile` | Banner „Was ist neu in Version 2.3?"; Eintrag **„Benachrichtigungen"** in den Konto-Einstellungen |
| `teamer-startseite` | `/teamer/dashboard` | Event-Karten mit Wochentag; steht ein Banner „Was ist neu …?" da, dann mit 2.3 |
| `teamer-mitmachen` | `/teamer/events` | wie `konfi-mitmachen` |
| `teamer-challenges` | `/teamer/challenges` | orange Zahl an den Umschaltern, wenn Freigaben warten und das Team freigeben darf |
| `teamer-chat` | `/teamer/chat` | — |
| `teamer-abzeichen` | `/teamer/badges` | die Teamer-Badges der Demo-Gemeinde |
| `teamer-profil` | `/teamer/profile` | Banner „Was ist neu in Version 2.3?"; „Benachrichtigungen" in den Konto-Einstellungen |
| `leitung-konfis` | `/admin/konfis` | Suche und Filter über der Liste; steht ein Banner „Was ist neu …?" da, dann mit 2.3 |
| `leitung-mitmachen` | `/admin/events` | orange Zahl an „Aktivitäten" bzw. „Verbuchen", wenn etwas wartet |
| `leitung-challenges` | `/admin/challenges` | orange Zahl an Aktuell/Geplant/Archiv, wenn Freigaben warten |
| `leitung-abzeichen` | `/admin/badges` | Unterseite unter „Mehr": **kein** Gemeinde-Name links |
| `leitung-chat` | `/admin/chat` | — |
| `leitung-jahrgaenge` | `/admin/settings/jahrgaenge` | wie `leitung-abzeichen` |
| `leitung-einstellungen` | `/admin/settings` | Banner „Was ist neu in Version 2.3?"; unter *Konto* der Eintrag „Benachrichtigungen", unter *Verwaltung* „Benutzer:innen" (sichtbar nur für die Gemeindeleitung) |

Was **nicht** auf den Bildern stehen kann, weil die Bilder im Browser
entstehen: „App sperren" und „Absturzberichte senden" in den
Konto-Einstellungen (nur in der App auf dem Gerät), die Zahl am App-Symbol.
Das ist kein Fehler.

Hat die Demo-Gemeinde mehr als 30 Konfis, Events oder gemeldete Aktivitäten,
steht unter der jeweiligen Liste der Knopf „Weitere … zeigen (noch …)" —
richtig so (Handbuch 03, „In langen Listen weiterscrollen").

## 3. Handbuch-Texte zu den Bildern prüfen

Die Bildbeschreibungen im Handbuch müssen zum neuen Bild passen:

- [x] `grep -n "/docs/bilder/iphone/" docs/handbuch/*.md` — für jedes der
      15 eingebundenen Bilder die Beschreibung in eckigen Klammern gegen das
      neue Bild lesen (zum Beispiel `konfi-profil`: „Konfispruch, Jahrgang und
      Zugangsdaten"). Passt sie nicht mehr, die Beschreibung anpassen, nicht
      das Bild.

## 4. Einchecken

- [x] `npm --prefix frontend run docs:handbuch` — spiegelt die Bilder nach
      `frontend/public/docs/bilder/` (oder in das Format, das der Generator zu
      dem Zeitpunkt schreibt). Die gespiegelten Bilder gehören in **denselben**
      Commit wie die neuen Quellbilder.
- [x] `frontend/public/sitemap.xml` nicht mit einchecken
      (`git checkout -- frontend/public/sitemap.xml`).
- [x] `git status` erst **nach** dem letzten Bild prüfen — ein sauberer Stand
      direkt nach dem Commit beweist nichts, wenn danach noch Bilder erneuert
      wurden (CLAUDE.md).
- [x] Commit: `docs(screenshots): Bilder für 2.3 neu gezogen`, Pull Request
      nach `main` (README, Rückmeldung).

**Ergebnis** hier eintragen: Datum, Commit des Deploys, Zahl der Bilder je
Gerät, Auffälligkeiten je Bild. In `docs/audit/2026-09-26/ui-barrierefreiheit.md`
die Status-Zeile von BF-09 fortschreiben. Die Store-Bilder für 2.3.0 lädt
Simon danach hoch (`docs/store-texte-2.3.0.md`).

**Ergebnis 01.10.2026:** Gezogen am 01.10.2026 zwischen 00:05 und 00:35 Uhr
gegen Produktion, `/api/status` vor und nach jeder Serie: Version `2.3.0`,
Commit `e6a3d389` (beide Backends). Während des ersten Play-Laufs startete
eines der beiden Backends neu (Laufzeit 58 s danach) — der Play-Satz ist
deshalb komplett neu gezogen, danach blieb der Stand ruhig. **42 Bilder,
21 je Gerät, alle 42 erneuert und einzeln angesehen**; keine MD5-Dublette,
506 kB bis 1 735 kB; Play-Bilder im MD3-Look (Reiterleiste ohne Glas,
Umschalter mit Unterstrich). Nur `demo.leitung`, `demo.teamer`,
`demo.emilia`; links in der Kopfzeile
steht auf keinem Bild ein Gemeinde-Name (einheitlich). Kein Testphase-, Wartungs- oder
Update-Hinweis.

- **Skript nachgebessert** (`scripts/screenshots.mjs`): (1) Das Schließen
  des Challenge-Details traf mit `ion-modal` `.first()` ein verborgenes
  zweites Modal und ließ das Detail offen — drei Konfi-Bilder
  (Feed, Badges, Chat) scheiterten im ersten Lauf; jetzt wird das sichtbare
  Modal geschlossen, im zweiten Lauf 21/21. (2) Das Feed-Bild zeigte an
  Position 2 eine Challenge ohne Beiträge („Noch keine geteilten Beiträge");
  jetzt wird ab Position 2 die erste Challenge mit Beiträgen geöffnet.
- **Glocke:** auf allen 42 Bildern, mit **blauem Punkt** ohne Zahl — das ist
  der Stand seit 29.09.2026 (`PostfachGlocke.tsx`: Punkt statt Briefumschlag),
  nicht der Briefumschlag vom 28.09.
- **Soll-Punkte der Tabelle erfüllt:** Banner „Was ist neu in Version 2.3?"
  auf Konfi-/Teamer-Profil und „Mehr"; „Benachrichtigungen" und (iPhone)
  „Benutzer:innen" unter *Mehr*; „Stempel" (7) bei Konfi-Challenges; orange
  Zahlen an Aktuell (Leitung, Team) und an Events/Aktivitäten/Verbuchen
  (Leitung); rote Kugel an den Challenges (Team: je 1; Konfi iPhone: 3) und
  orange Uhr an „Zeig uns deinen Lieblingsplatz" (Leitung, Team); Badges und
  Jahrgänge ohne Gemeinde-Namen; Suche und Filter über der Konfi-Liste.
- **Nicht im Bild, weil unterhalb der ersten Bildschirmhöhe:** Event-Karten
  mit Wochentag auf den Startseiten (Konfi und Team), „Benachrichtigungen"
  im Konfi- und Teamer-Profil, „Benutzer:innen" auf dem Play-Bild „Mehr".
  Das Skript nimmt nur den sichtbaren Ausschnitt auf.
- **Ungleich zwischen den Sätzen:** Das Öffnen der Challenges beim Feed-Bild
  markiert sie für `demo.emilia` als gelesen. Die iPhone-Bilder
  `konfi-startseite`/`-mitmachen`/`-challenges` zeigen deshalb noch die rote
  4 am Reiter und die 3 an „Ein Wort, das dich begleitet", die übrigen
  Konfi-Bilder (iPhone ab Badges, alle Play-Konfi-Bilder) nicht mehr.
- **Auffällig (Inhalt/Darstellung, nicht behoben):**
  - `leitung-chat`, `teamer-chat`, `konfi-chat` (beide Geräte): letzte
    Nachricht im Jahrgangs-Chat ist „Test" von einem Entwicklerkonto mit
    echtem Namen — für Store-Bilder ungeeignet; Datenfrage an Simon.
  - `teamer-abzeichen` (beide): unter „Erreichte Badges (3)" steht als erste
    Gruppe „Kategorie-Meister 0 von 8 · 0 %" mit lauter grauen, nicht
    erreichten Badges.
  - `teamer-profil` (beide): Rolle „Teamer", auf der Startseite „Teamer:in".
  - `konfi-startseite` (beide): „noch 1 Punkte" statt „noch 1 Punkt"; die
    Tageslosung des Konfi-Kontos beginnt klein („der Herr weiß …").
  - `play/teamer-startseite`: Begrüßung „Gute Nacht, Lasse!" (nach
    Mitternacht gezogen); die Tageslosung wechselte um 0 Uhr, iPhone und Play
    zeigen verschiedene Verse.
  - Play (`leitung-konfis`, `leitung-mitmachen`): Suchfeld und Auswahlzeilen
    in „Suche & Filter" stehen als einzelne weiße Kästen mit Spalt statt als
    eine Karte mit Trennlinien wie auf dem iPhone.
- **Handbuch:** vier von 15 Bildbeschreibungen an die neuen Bilder angepasst
  (`konfi-startseite`, `konfi-chat`, `konfi-profil`, `teamer-startseite`);
  `docs:handbuch`, `docs:api`, `docs:openapi` gelaufen, 15 Handbuch-Bilder
  neu als WebP; `sitemap.xml` (nur Datum) verworfen.
