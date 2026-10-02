## Was

<!-- Was ändert sich, in ein paar Sätzen. -->

## Warum

<!-- Anlass: Befund, Entscheidung (mit Datum), Fehlermeldung. Bei einem
offenen Punkt den Titel aus docs/offene-befunde.md nennen. -->

## Tests

<!-- Welche Tests, und die Gegenprobe: Fehler wieder eingebaut, Test fällt.
Bugfix: erst der Test, der den Fehler zeigt. Sicherheitsfix: der verbotene
UND der erlaubte Fall. Keine weichen Assertions. -->

## Prüfliste (CLAUDE.md)

- [ ] Ausgelieferte Apps brechen nicht: Antwortformen gleich, Felder nur
      hinzugefügt, Migrationen additiv; `docs/api/ABRISS.md` und die
      Version im Store bedacht
- [ ] Tests im selben Commit
- [ ] CHANGELOG.md, wenn Nutzer:innen es merken (ein Satz je Punkt, ohne
      Build-Nummern, Dateinamen oder Commit-Hashes)
- [ ] Handbuch (`docs/handbuch/`), wenn sich Verhalten ändert
- [ ] API-Doku (`docs/api/*.yaml`), wenn Routen oder Berechtigungen betroffen
      sind
- [ ] Generatoren gelaufen und Ergebnis eingecheckt:
      `npm --prefix frontend run docs:api`, `docs:openapi`, `docs:handbuch`
- [ ] Versionsnummern nur über `npm run version:setzen`
- [ ] Keine Geheimnisse, Serveradressen oder persönlichen Daten im Diff
- [ ] Erledigtes aus `docs/offene-befunde.md` gestrichen, Neues eingetragen
