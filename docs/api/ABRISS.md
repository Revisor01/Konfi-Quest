# Abrissliste

Routen, die durch eine neuere Generation ersetzt sind und **noch stehen
bleiben**, weil ausgelieferte Apps sie rufen. Hier steht, was wann wegkann
und woran man erkennt, dass der Zeitpunkt da ist.

## Warum es diese Liste gibt

Eine App im Store ist eine Leserin der API, und die lässt sich nicht
mitdeployen. Am 28.08.2026 wurde `GET /teamer/badges` still von einem Array
auf ein Objekt umgestellt, um Konfi- und Teamer-Sicht anzugleichen. Die
ausgelieferten Apps (iOS 2.0.0, Android versionCode 81) rufen auf der Antwort
`.filter()` auf — auf einem Objekt ist das ein TypeError. Am Abend des
Rollouts kamen Teamer:innen auf beiden Plattformen nicht mehr ins Dashboard.
Im Browser fiel nichts auf, dort lief die neue Oberfläche, und die
Backend-Tests waren grün: Sie kannten nur die mitdeployte Oberfläche.

Seitdem gilt: Eine Antwortform ändern heißt **neue Route neben der alten**,
und die alte fällt erst, wenn niemand sie mehr ruft. Diese Datei ist die
Merkliste dafür — ohne sie bleiben die Altlasten einfach für immer stehen.

## Wann darf abgerissen werden?

Für **jede** Zeile unten gilt dieselbe Bedingung:

> Keine App-Version im Store und auf den Geräten ruft die Route mehr.

Das ist erfüllt, wenn beides zutrifft:

1. Die letzte App-Version, die die alte Route ruft, ist im Store durch eine
   v2-Version ersetzt — **und** die Übergangszeit ist vorbei. Nutzer:innen
   aktualisieren nicht sofort; erfahrungsgemäß braucht es einige Wochen, bis
   die alten Installationen praktisch verschwunden sind. Ein erzwungenes
   Mindest-Update verkürzt das, ist aber bisher nicht eingerichtet.
2. Die Zugriffszählung unten zeigt über einen vollen Beobachtungszeitraum
   (mindestens zwei Wochen, damit auch seltene Nutzer:innen erfasst sind)
   **null** Zugriffe.

### Wie man das prüft

Die Zugriffe stehen in den Logs des Backend-Containers auf
`server.godsapp.de`. Eine Zählung je Route über die letzten Wochen:

```bash
ssh root@server.godsapp.de
# Ersetzt <container> durch den laufenden Backend-Container
docker logs --since 336h <container> 2>&1 \
  | grep -oE '(GET|POST|PUT) /api/(konfi|teamer)/badges[^ ?"]*' \
  | sort | uniq -c | sort -rn
```

Steht eine Route dort mit **0** (taucht also gar nicht auf), ist ihre
Bedingung erfüllt. Kommt sie noch vor, lohnt der Blick, **wer** sie ruft:

```bash
docker logs --since 336h <container> 2>&1 | grep '/api/teamer/badges ' | tail -20
```

Achtung: Ein Treffer auf `/api/teamer/badges` matcht ohne das abschließende
Leerzeichen auch `/api/teamer/badges/v2` — beim Zählen also auf die exakte
Route achten (das `grep -oE` oben trennt sie korrekt).

## Die Liste

| Route | Ersetzt durch | Warum sie noch steht | Weg, wenn |
|---|---|---|---|
| `GET /api/teamer/badges` (Array + Kopfzeilen `X-Badges-Secret-Total` / `X-Badges-Visible-Total`) | `GET /api/teamer/badges/v2` | Vertrag der ausgelieferten Apps; genau hier ist der Vorfall vom 29.08.2026 passiert | Zugriffszählung 0 |
| `PUT /api/teamer/badges/mark-seen` | `POST /api/teamer/badges/mark-seen` | Verb-Asymmetrie zum Konfi-Pfad; alte Apps senden PUT | Zugriffszählung 0 |
| `GET /api/teamer/badges/unseen` | ersatzlos — der Zähler kommt aus `GET /api/notifications/badge-counts` | Seit 27.08.2026 ruft keine Ansicht sie mehr; sie zählt zudem falsch (ohne `target_role`-Filter zählt sie bei beförderten Konfis alte Konfi-Abzeichen mit) | Zugriffszählung 0 |
| `GET /api/konfi/badges` | `GET /api/konfi/badges/v2` | Vertrag der ausgelieferten Apps. Gleiche Hülle wie v2, aber **mit** den Verwaltungsfeldern | Zugriffszählung 0 |
| `GET /api/konfi/badges/stats` | ersatzlos — `GET /api/konfi/badges/v2` liefert dieselben Zahlen genauer (`stats` bzw. `earned.length`) | Hatte noch nie einen Aufrufer in der Oberfläche, könnte aber in einer alten App stecken | Zugriffszählung 0 |

`POST /api/konfi/badges/mark-seen` bleibt: Das Verb ist schon das richtige,
v2 ändert daran nichts.

## Was beim Abriss zu tun ist

1. Route aus `backend/routes/teamer.js` bzw. `backend/routes/konfi.js`
   entfernen.
2. Die Verträge-Tests der alten Form in `backend/tests/routes/badgesV2.test.js`
   (Abschnitt „Alte Routen bleiben unveraendert") entfernen — **nicht**
   aufweichen. Die Tests für v2 und für die Berechtigungen bleiben.
3. `normalisiereTeamerBadges` in `frontend/src/components/teamer/teamerBadges.ts`
   kann auf die Objektform eingedampft werden; die Array-Hälfte und das
   Auslesen der Kopfzeilen fallen weg.
4. In `docs/api/*.yaml` die Einträge löschen, danach die drei Generatoren
   laufen lassen (`scripts/build-api-docs.mjs`, `build-openapi.mjs`,
   `build-handbuch.mjs`).
5. Diese Zeile hier aus der Tabelle streichen.
