# Abrissliste

Sammelstelle für **alle** Routen, die sich fachlich verabschiedet haben und
trotzdem **noch stehen bleiben**, weil ausgelieferte Apps sie rufen. Hier
steht, was wann wegkann und woran man erkennt, dass der Zeitpunkt da ist.

> **Auf dieser Liste wird nichts gelöscht.** Sie ist eine Merkliste für den
> Zeitpunkt, an dem keine App im Store die Route mehr ruft — nicht die
> Ankündigung eines Abrisses. Eine Route, die zu früh entfernt wird, bricht
> die Apps auf den Geräten, und die lassen sich nicht mitdeployen.

Die Datei ist **gemeinsam gepflegt**: Wer eine Route überflüssig macht,
trägt sie unten in die passende Tabelle ein, statt sie zu entfernen.
Die Spalten stehen fest, der Prüfweg steht einmal oben — bei den einzelnen
Zeilen nicht wiederholen.

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
   neuere ersetzt — **und** die Übergangszeit ist vorbei. Nutzer:innen
   aktualisieren nicht sofort; erfahrungsgemäß braucht es einige Wochen, bis
   die alten Installationen praktisch verschwunden sind. Ein erzwungenes
   Mindest-Update verkürzt das, ist aber bisher nicht eingerichtet.
2. Die Zugriffszählung unten zeigt über einen vollen Beobachtungszeitraum
   (mindestens zwei Wochen, damit auch seltene Nutzer:innen erfasst sind)
   **null** Zugriffe.

## Wie man das prüft

**Die Zugriffe stehen im Traefik-Zugriffslog, NICHT in den Backend-Logs.**
Das ist der wichtigste Satz dieser Datei. Der Backend-Container
(`konfi_quest-backend-1`) schreibt nur Startmeldungen, Login-Versuche und
Fehler — **keine** Zeile pro Anfrage. Wer dort nach einer Route grept,
bekommt für **jede** Route null Treffer und hält eine lebendige Route für
tot. Genau diese Sorte falsche Sicherheit hat am 29.08.2026 die Apps
zerlegt.

Traefik dagegen protokolliert jede Anfrage als JSON-Zeile mit
`RequestPath` und `RouterName`. Die Router heißen:

| Router | Wofür |
|---|---|
| `konfi-api@docker` | Produktion (`konfi-quest.de`) — **das** ist der relevante |
| `konfi-api-test@docker` | Testsystem (`test-api.konfi-quest.de`) — beim Zählen ausschließen |

### Zählung je Route

```bash
ssh root@server.godsapp.de

# Alle Pfade der Produktion, IDs zusammengefasst, absteigend gezählt:
docker logs --since 336h traefik 2>&1 \
  | grep '"RouterName":"konfi-api@docker"' \
  | grep -oE '"RequestPath":"[^"?]*' \
  | sed 's/"RequestPath":"//' \
  | sed -E 's#/[0-9]+#/:id#g' \
  | sort | uniq -c | sort -rn
```

Eine einzelne Route gezielt (hier `/api/konfi/badges` — das abschließende
`"` verhindert, dass `/api/konfi/badges/v2` mitzählt):

```bash
docker logs --since 336h traefik 2>&1 \
  | grep '"RouterName":"konfi-api@docker"' \
  | grep -c '"RequestPath":"/api/konfi/badges"'
```

Taucht die Route dort mit **0** auf, ist ihre Bedingung erfüllt. Kommt sie
noch vor, lohnt der Blick, **wer** sie ruft (Zeitpunkt und IP stehen in
derselben Zeile):

```bash
docker logs --since 336h traefik 2>&1 \
  | grep '"RouterName":"konfi-api@docker"' \
  | grep '"RequestPath":"/api/konfi/badges"' \
  | tail -20
```

### ⚠ Vorher: Das Log reicht derzeit nur ~5 Tage zurück

Der Traefik-Container läuft mit `max-size=10m, max-file=3`, also 30 MB
Ringpuffer. Am 01.09.2026 nachgemessen: Der älteste Eintrag war vom
27.08.2026 — **rund fünf Tage**, nicht die geforderten vierzehn.
`--since 336h` liefert dann trotzdem klaglos ein Ergebnis, nur eben aus
einem zu kurzen Fenster. Eine Null daraus beweist **nichts**.

Vor der ersten echten Abrissentscheidung deshalb eines von beiden:

- Log-Rotation für den Traefik-Container hochsetzen (`max-file` erhöhen,
  z. B. auf 20 = rund vier Wochen) und dann zwei Wochen abwarten, **oder**
- die Zählung über den Zeitraum wiederholt abgreifen (etwa täglich per
  Cron in eine Datei) und die Teilergebnisse summieren.

Und immer gegenprüfen, dass das Fenster wirklich passt:

```bash
docker logs --since 336h traefik 2>&1 | grep -oE '"time":"[^"]*"' | head -1
```

Liegt der älteste Zeitstempel weniger als 14 Tage zurück, ist die Zählung
**nicht** aussagekräftig.

---

## Die Liste

### A — Alte Antwortformen, durch eine neuere Generation ersetzt

Diese Routen haben einen Nachfolger. Sie stehen nur noch, weil alte Apps
die alte Form erwarten.

| Route | Ersetzt durch | Warum sie noch steht | Eingetragen |
|---|---|---|---|
| `GET /api/teamer/badges` (Array + Kopfzeilen `X-Badges-Secret-Total` / `X-Badges-Visible-Total`) | `GET /api/teamer/badges/v2` | Vertrag der ausgelieferten Apps; genau hier ist der Vorfall vom 29.08.2026 passiert | 31.08.2026 |
| `PUT /api/teamer/badges/mark-seen` | `POST /api/teamer/badges/mark-seen` | Verb-Asymmetrie zum Konfi-Pfad; alte Apps senden PUT | 31.08.2026 |
| `GET /api/konfi/badges` | `GET /api/konfi/badges/v2` | Vertrag der ausgelieferten Apps. Gleiche Hülle wie v2, aber **mit** den Verwaltungsfeldern | 31.08.2026 |

`POST /api/konfi/badges/mark-seen` bleibt dauerhaft: Das Verb ist schon das
richtige, v2 ändert daran nichts. Kein Abrisskandidat.

### B — Ohne Aufrufer in der Oberfläche

Kein einziger Aufruf in `frontend/src` (grep ohne `__tests__`, variable URLs
per `apiEndpoint`/`apiBasePath`/Template-String nachgefasst). Das heißt
**nicht**, dass sie tot sind: Eine ausgelieferte App kann sie weiter rufen.
Die Prüfung übers Zugriffslog ist bei diesen Zeilen deshalb der eigentliche
Entscheider, nicht eine Formalie.

Stand der Nachprüfung: 01.09.2026, gegen Commit `4c46a3f2`.

| Route | Ersatz | Anmerkung | Eingetragen |
|---|---|---|---|
| `GET /api/konfi/badges/stats` | `GET /api/konfi/badges/v2` liefert dieselben Zahlen genauer (`stats` bzw. `earned.length`) | Hatte noch nie einen Aufrufer in der Oberfläche | 31.08.2026 |
| `GET /api/teamer/badges/unseen` | ersatzlos — der Zähler kommt aus `GET /api/notifications/badge-counts` | Seit 27.08.2026 ruft keine Ansicht sie mehr; zählt zudem falsch (ohne `target_role`-Filter zählt sie bei beförderten Konfis alte Konfi-Abzeichen mit) | 31.08.2026 |
| `GET /api/konfi/events/:id/status` | `GET /api/konfi/events` liefert dieselben Felder pro Termin | 115 Zeilen. Rechnet den Anmeldestatus seit 01.09.2026 über `utils/terminAnmeldeStatus.js` — solange sie steht, läuft sie nicht mehr weg | 01.09.2026 |
| `GET /api/events/user/bookings` | ersatzlos — die Buchung steht in der Terminliste (`booking_status`) | | 01.09.2026 |
| `GET /api/teamer/konfis` | `GET /api/admin/konfis` | | 01.09.2026 |
| `GET /api/teamer/:userId/certificates` | ersatzlos — die Nachweise stehen im Teamer-Dashboard | POST und DELETE auf demselben Pfad SIND in Benutzung (`CertificateAssignModal.tsx:50`, `KonfiDetailView.tsx:669`) — **nur das GET** ist gemeint | 01.09.2026 |
| `GET /api/notifications/preferences` | `GET /api/settings` | | 01.09.2026 |
| `PUT /api/notifications/preferences` | `PUT /api/settings` | | 01.09.2026 |
| `GET /api/roles/:id` | `GET /api/roles` liefert die Liste, aus der die Oberfläche auswählt | | 01.09.2026 |
| `GET /api/roles/list/assignable` | ersatzlos | Der Pfad existiert nur, um `/:id` auszuweichen — fällt mit `/roles/:id` zusammen weg | 01.09.2026 |
| `GET /api/challenges/admin/authors` | ersatzlos | | 01.09.2026 |
| `GET /api/organizations/current` | `GET /api/organizations/:id` (die Oberfläche ruft `/organizations/${user.organization_id}`) | Liefert denselben Inhalt anders berechnet (korrelierte Subselects statt paralleler Count-Queries) | 01.09.2026 |
| `GET /api/organizations/:id/users` | `GET /api/organizations/:id/members` | Überlappt `/members` bei anderer Feldliste und anderen Guards | 01.09.2026 |
| `GET /api/organizations/:id/stats` | ersatzlos — die Zahlen stehen in `GET /api/organizations/:id` | | 01.09.2026 |
| `GET /api/chat/admins` | `GET /api/chat/available-users` | Inhaltlich eine Teilmenge davon | 01.09.2026 |
| `POST /api/chat/messages/:messageId/vote` | `POST /api/chat/polls/:pollId/vote` | Bewusster Alias für alte Apps: reine Verpackung um `votePoll`, keine Logik-Kopie. Steht hier, damit er beim Abriss nicht vergessen wird | 01.09.2026 |
| `GET /api/levels/konfi/:userId` | `GET /api/konfi/dashboard` (Level und Fortschritt stehen dort) | | 01.09.2026 |
| `GET /api/users/:id/jahrgaenge` | ersatzlos — die Zuweisungen kommen mit `GET /api/users/:id` | POST auf demselben Pfad IST in Benutzung (`UserManagementModal.tsx:307`) — **nur das GET** ist gemeint | 01.09.2026 |
| `DELETE /api/admin/activities/requests/:id` | ersatzlos | Nur `…/:id/photo`-DELETE wird gerufen (`ActivityRequestModal.tsx:141`) | 01.09.2026 |

### C — Bleiben dauerhaft (geprüft, kein Abrisskandidat)

Damit sie nicht bei der nächsten Prüfung wieder als „tot" auffallen:

| Route | Warum sie bleibt |
|---|---|
| `DELETE /api/challenges/konfi/submissions/:id` | **Keine Altlast, sondern eine Entscheidung.** Die Route antwortet absichtlich immer mit 403: Eingereichte Beiträge lassen sich nicht mehr zurückziehen, das Ausblenden bleibt Sache der Leitung (`PUT /admin/submissions/:id/moderate`). Sie steht als *stabile Fehlerantwort* für Apps, die den Zurückziehen-Knopf noch zeigen — ein Abriss ergäbe dort ein nichtssagendes 404 statt der erklärenden Meldung. Sie fällt erst, wenn keine App den Knopf mehr hat, und dann aus einem anderen Grund als „niemand ruft sie". |
| `GET /api/konfi/points-history`, `GET /api/teamer/konfi-history` | Lebendig über die `apiEndpoint`-Prop (`PointsHistoryModal.tsx:72`, Override `TeamerKonfiStatsPage.tsx:94`) — sehen im grep tot aus, sind es nicht |
| `POST /api/auth/refresh` | Lebendig im axios-Interceptor (`services/api.ts:89`) |
| `GET /api/teamer/:userId/badges`, `GET /api/admin/konfis/:id/badges` | Lebendig über `KonfiBadgesSection.tsx:79-80` |
| `POST /api/wrapped/generate-teamer` | **Kein Abrisskandidat, sondern ein Betriebswerkzeug.** Am 01.09.2026 auf `server.godsapp.de` geprüft: keine Crontab-Zeile ruft den Endpunkt, der Jahres-Cron nutzt den Funktionsexport (`backgroundService.js:761`). Die Route ist der Hand-Auslöser daneben — „Rückblick nochmal bauen", wenn der Cron ausgefallen ist oder Zahlen korrigiert wurden. Vier Tests sichern sie ab (`wrapped.test.js:181-218`). Stand vorher fälschlich in Tabelle B: „ohne Aufrufer in der Oberfläche" stimmt, „abreißen" folgt daraus hier nicht. Gilt genauso für `DELETE /api/wrapped/teamer` (seit 01.09.2026), den Löschweg dazu. |

### D — Doppelte Mounts

Kein Routenabriss, sondern ein Einhänge-Pfad. Beide Mounts hängen denselben
Router ein (`createApp.js:480` und `:483`).

| Mount | Ersetzt durch | Warum er noch steht | Eingetragen |
|---|---|---|---|
| `/api/admin/users` (Mount von `routes/users.js`) | `/api/users` (derselbe Router, anderer Pfad) | Die Oberfläche ruft seit 01.09.2026 durchgängig `/users` — ausgelieferte Apps rufen aber weiter `/admin/users`. Beide Mounts bleiben, bis die Zählung für **alle** `/api/admin/users…`-Pfade null zeigt | 01.09.2026 |

---

## Was beim Abriss zu tun ist

1. Route aus der jeweiligen Datei in `backend/routes/` entfernen.
2. Die Verträge-Tests der alten Form entfernen — **nicht** aufweichen. Für
   die Abzeichen stehen sie in `backend/tests/routes/badgesV2.test.js`
   (Abschnitt „Alte Routen bleiben unveraendert"); die Tests für die neue
   Form und für die Berechtigungen bleiben.
3. Frontend-Reste aufräumen, soweit vorhanden. Für die Abzeichen kann
   `normalisiereTeamerBadges` in
   `frontend/src/components/teamer/teamerBadges.ts` auf die Objektform
   eingedampft werden; die Array-Hälfte und das Auslesen der Kopfzeilen
   fallen weg.
4. In `docs/api/*.yaml` die Einträge löschen, danach die drei Generatoren
   laufen lassen (`scripts/build-api-docs.mjs`, `build-openapi.mjs`,
   `build-handbuch.mjs`).
5. Die Zeile hier aus der Tabelle streichen.

## Eine Zeile ergänzen

Wer eine Route überflüssig macht, trägt sie ein, statt sie zu entfernen:

- **Abschnitt A**, wenn es einen Nachfolger mit anderer Antwortform gibt.
- **Abschnitt B**, wenn schlicht niemand in der Oberfläche sie mehr ruft.
- **Abschnitt C**, wenn sie *aussieht* wie eine Altlast, aber bleiben soll —
  mit dem Grund, damit die nächste Prüfung sie nicht erneut aufgreift.
- **Abschnitt D** für Einhänge-Pfade und Mounts.

Pflichtangaben je Zeile: **Route** (mit `/api`-Präfix, so wie sie im
Zugriffslog steht), **Ersatz** (oder „ersatzlos" mit dem Weg, den die
Oberfläche stattdessen nimmt), **Anmerkung** (was man beim Abriss wissen
muss — etwa: nur das GET ist gemeint, das POST daneben lebt) und das
**Eintragungsdatum**. Den Prüfweg nicht wiederholen; der steht oben und
gilt für alle Zeilen gleich.
