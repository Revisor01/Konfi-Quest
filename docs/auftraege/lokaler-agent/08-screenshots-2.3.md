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

- [ ] Stand prüfen: `GET /api/status` meldet die App-Version aus
      `frontend/version.json` und den Commit des Deploys (siehe 03, Abschnitt 1).
- [ ] iPhone: `KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs`
      (21 Bilder, Demo-Gemeinde, iOS-Look).
- [ ] Android: `KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs --geraet play`
      (21 Bilder, 1080 × 2160). Das Skript setzt dafür die **Android-Kennung**
      (`GERAETE.play.kennung`); ohne sie entstehen die Bilder im iOS-Look und
      die MD3-Fehler bleiben unsichtbar. Probe an einem Bild: Unten die
      Reiterleiste im MD3-Stil (Symbol über der Beschriftung, ohne iOS-Glas),
      Umschalter mit Unterstrich statt Kapsel.
- [ ] Nur die Demo-Konten der Demo-Gemeinde benutzen, keine anderen Konten.

## 2. Jedes Bild ansehen

Allgemein, für alle 42:

- [ ] Kein Ladezustand, keine 404-Seite, kein Anmeldefehler, keine leere
      Liste, wo die Demo-Gemeinde Einträge hat.
- [ ] **Glocke** oben rechts in der Kopfzeile.
- [ ] Links in der Kopfzeile steht der **Name der Gemeinde** nur, wenn das
      Demo-Konto mehreren Gemeinden angehört, und nur auf den Seiten mit
      eigenem Reiter unten. Gehört es nur zur Demo-Gemeinde, steht dort nichts
      — beides ist richtig; nicht das eine auf einem Bild und das andere auf
      dem nächsten.
- [ ] Keine echten Namen aus anderen Gemeinden, keine Mitteilungen mit
      Inhalten aus anderen Gemeinden.
- [ ] Steht ein Testphase-, Wartungs- oder Update-Hinweis auf dem Bild: nicht
      einchecken, Simon fragen, ob das Bild so in den Store darf.
- [ ] MD5 über alle Bilder: keine zwei gleich.

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

- [ ] `grep -n "/docs/bilder/iphone/" docs/handbuch/*.md` — für jedes der
      15 eingebundenen Bilder die Beschreibung in eckigen Klammern gegen das
      neue Bild lesen (zum Beispiel `konfi-profil`: „Konfispruch, Jahrgang und
      Zugangsdaten"). Passt sie nicht mehr, die Beschreibung anpassen, nicht
      das Bild.

## 4. Einchecken

- [ ] `npm --prefix frontend run docs:handbuch` — spiegelt die Bilder nach
      `frontend/public/docs/bilder/` (oder in das Format, das der Generator zu
      dem Zeitpunkt schreibt). Die gespiegelten Bilder gehören in **denselben**
      Commit wie die neuen Quellbilder.
- [ ] `frontend/public/sitemap.xml` nicht mit einchecken
      (`git checkout -- frontend/public/sitemap.xml`).
- [ ] `git status` erst **nach** dem letzten Bild prüfen — ein sauberer Stand
      direkt nach dem Commit beweist nichts, wenn danach noch Bilder erneuert
      wurden (CLAUDE.md).
- [ ] Commit: `docs(screenshots): Bilder für 2.3 neu gezogen`, Pull Request
      nach `main` (README, Rückmeldung).

**Ergebnis** hier eintragen: Datum, Commit des Deploys, Zahl der Bilder je
Gerät, Auffälligkeiten je Bild. In `docs/audit/2026-09-26/ui-barrierefreiheit.md`
die Status-Zeile von BF-09 fortschreiben. Die Store-Bilder für 2.3.0 lädt
Simon danach hoch (`docs/store-texte-2.3.0.md`).
