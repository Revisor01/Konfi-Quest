# Arbeiten an Konfi Quest

Was für alle gilt, die an diesem Projekt arbeiten. Betriebswissen (Serveradressen,
Zugangsdaten, SSH) gehört **nicht** hierher — dieses Repo ist öffentlich.

## Ausgelieferte Apps nie brechen

Solange eine App-Version im Store oder auf Geräten lebt, ist sie eine **Leserin
der API** — und die lässt sich nicht mitdeployen. Änderungen an Backend,
API-Antworten oder Datenbank dürfen alte App-Versionen niemals brechen.

- **Antwortformen sind ein Vertrag.** Aus einem Array wird kein Objekt (und
  umgekehrt), Felder verschwinden nicht, Typen ändern sich nicht. Wer die Form
  ändern will, legt eine **neue, versionierte Route** an und lässt die alte
  stehen, bis keine App sie mehr ruft.
- **Neue Felder hinzufügen ist erlaubt**, weglassen oder umbenennen nicht.
- **Migrationen laufen additiv:** erst Spalte dazu, dann beide Stände bedienen,
  Altes erst entfernen, wenn keine alte App mehr darauf zugreift.
- **Grüne Tests beweisen das nicht.** Sie prüfen gegen die mitdeployte
  Oberfläche, nicht gegen die App auf den Handys. Vor jeder Änderung an einer
  Antwortform: Wer ruft die Route noch? Auch die Version im Store.

*Konkret passiert (29.08.2026): `GET /teamer/badges` wurde von einem Array auf
`{available, earned, stats}` umgestellt. Die Store-Apps riefen darauf `.filter()`
auf — TypeError, das Teamer-Dashboard stürzte sofort nach dem Login ab, auf iOS
und Android. Im Browser fiel es nicht auf, dort lief die neue Oberfläche. Die
Backend-Tests waren grün.*

## Drei Dinge im selben Commit mitschreiben

Nicht nachträglich, nicht beim Release — im selben Commit wie die Änderung.

**CHANGELOG.md**, wenn die Änderung Nutzer:innen betrifft. Format Keep a
Changelog (Hinzugefügt / Geändert / Behoben / Sonstiges), ein knapper Satz pro
Punkt aus Nutzersicht. Niemals Build-Nummern, Framework-Namen, Dateinamen oder
Commit-Hashes — das gehört in die Commit-Message. Reine Interna (Refactoring,
Tests, CI) höchstens unter „Sonstiges".

**Das Handbuch** (`docs/handbuch/`), wenn sich das Verhalten ändert. Eine
Verhaltensänderung ohne Handbuch-Eintrag ist unvollständig.

**Die API-Doku** (`docs/api/*.yaml`), wenn Routen oder Berechtigungen betroffen
sind. Behobene Befunde nicht löschen, sondern als behoben markieren (mit Datum) —
sonst liest sich die Doku wie eine Liste offener Lücken, die längst zu sind.

### Die Generatoren gehören dazu

`docs/` ist die Quelle, `frontend/public/docs/` das eingecheckte Ergebnis. Wer
das eine ändert und das andere nicht neu erzeugt, macht die CI rot — drei
Prüfschritte fangen es ab. Alle drei laufen lassen:

```
npm --prefix frontend run docs:api
npm --prefix frontend run docs:openapi
npm --prefix frontend run docs:handbuch
```

`build-handbuch.mjs` spiegelt auch `docs/screenshots/` nach
`frontend/public/docs/bilder/`. Wer Screenshots neu zieht, muss den Generator
laufen lassen. Ein sauberes `git status` direkt nach dem Commit beweist nichts,
wenn danach noch Bilder erneuert wurden.

## Tests

Jede Änderung an Verhalten bekommt Tests im selben Commit.

- **Bugfix:** zuerst der Test, der den Fehler zeigt, dann der Fix.
- **Sicherheitsfix:** ein Test für den verbotenen *und* einer für den erlaubten
  Fall.
- **Weiche Assertions sind ein Fehler.** `expect([200, 500]).toContain(...)` oder
  `toBeDefined()` auf einem Zähler verdecken echte Fehler. Auf den konkreten Wert
  prüfen.
- Schlägt ein Test nach einer Änderung fehl, erst prüfen, ob er recht hat. Die
  Erwartung nur aufweichen, wenn sie nachweislich falsch war — nie, um grün zu
  werden.
- **Ein grüner Test beweist nichts, wenn er den Fehlerfall nicht erreicht.**
  Gegenprobe: Fehler wieder einbauen, der Test muss fallen.

Die Backend-Suites teilen sich **eine** Test-Datenbank mit festen IDs aus
`seed.js`; `maxWorkers` steht deshalb auf 1 (die Begründung steht in
`backend/tests/vitest.config.ts`). Wer zwei Läufe gleichzeitig braucht, trennt
Compose-Projekt *und* Port — nicht die Worker-Zahl anheben.

## Konventionen

- **Commits:** Conventional Commits (`fix(scope): …`, `feat`, `docs`, `test`,
  `chore`, `refactor`). Betreffzeile knapp, Details in den Body. Keine Verweise
  auf KI-Werkzeuge.
- **Git-Tags:** ohne `v`-Präfix.
- **CHANGELOG:** Keep a Changelog + Semantic Versioning.
- **API-Doku:** OpenAPI 3.1.
- **Umlaute** in Nutzertexten sind echte Umlaute — auch beim Schreiben über
  `psql`.

Im Zweifel nachsehen, wie es im Repo bisher gemacht wurde, und das fortführen.

## Handbuch-Stil

Kein Blick zurück („neu ist", „seit Version X") — das Handbuch beschreibt, wie es
jetzt ist. Überschriften benennen **Tätigkeiten** („Punkteziele festlegen"), nicht
Substantive. Was anderswo steht, wird verlinkt statt wiederholt.

## Befunde prüfen, bevor sie weitergehen

Ein Befund aus einem Audit, einem Report oder von einem anderen Agenten ist eine
**Behauptung**, keine Tatsache. Vor dem Weitergeben oder Beheben gegen den Code
prüfen, wenn möglich gegen Produktion messen.

Dasselbe gilt für Zahlen: Behauptungen über Laufzeiten, Größen und Häufigkeiten
werden gemessen, nicht geschätzt — und das Ergebnis mit Zahl genannt („7 s →
4,5 ms"), nicht als „deutlich schneller".

## Abhängigkeiten

**react-router bleibt auf 6.** `@ionic/react-router@9` verlangt
`react-router: >=6.4.0 <7`. Version 7 und 8 sind mit Ionic 9 **unvereinbar**,
nicht bloß riskant — die Hauptversionen stehen in der Ignorierliste. Vor jedem
Vorschlag, das anzuheben, erst die peerDependencies prüfen.

## Keine Geheimnisse ins Repo

Dieses Repo ist öffentlich. Passwörter, Tokens, Serveradressen und Betriebsdoku
gehören nicht hinein. `.claude/settings.local.json` ist in jeder Ebene
ausgenommen; `.claude/settings.json` ohne `.local` darf versioniert werden.

## Screenshots

Bilder gegen Produktion zeigen den Stand der Produktion. Wer eine
Layout-Korrektur macht und sofort Screenshots zieht, bekommt den alten Stand,
solange der Deploy nicht durch ist: **erst deployen, dann ziehen.** Und jedes
Bild ansehen — es sind schon 404-Seiten als „erfolgreiche" Aufnahmen entstanden.

Android-Screenshots brauchen eine Android-Kennung, sonst entstehen sie im
iOS-Modus und die MD3-Fehler bleiben unsichtbar.
