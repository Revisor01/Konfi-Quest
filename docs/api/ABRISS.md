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
   die alten Installationen praktisch verschwunden sind. Eine Mindestversion
   kann das verkürzen: Sie lässt sich je Plattform über `APP_MIN_VERSION_IOS`
   und `APP_MIN_VERSION_ANDROID` setzen (GET `/api/app-version`, siehe
   `verwaltung-auth.yaml`) und bittet darunter bei jedem Start deutlich um das
   Update — sie sperrt aber nicht, wer „Später" wählt, nutzt die alte Fassung
   weiter. Sie wirkt außerdem nur auf Apps ab 2.3.0; Installationen mit 2.2.x
   und älter kennen sie nicht. Ausgezählt wird deshalb in jedem Fall.
2. Die Zugriffszählung unten zeigt über einen vollen Beobachtungszeitraum
   (mindestens zwei Wochen, damit auch seltene Nutzer:innen erfasst sind)
   **null** Zugriffe.

## Wie man das prüft

**Die Zugriffe stehen im Zugriffslog des Apache vor Traefik, NICHT in den
Backend-Logs und NICHT im Traefik-Log.** Das ist der wichtigste Satz dieser
Datei. Der Backend-Container (`konfi_quest-backend-1`) schreibt nur
Startmeldungen, abgewiesene Anmeldungen gesperrter Konten und Fehler —
**keine** Zeile pro Anfrage. Wer dort nach einer Route grept, bekommt für
**jede** Route null Treffer und hält eine lebendige Route für tot. Genau
diese Sorte falsche Sicherheit hat am 29.08.2026 die Apps zerlegt.

Das Traefik-Zugriffslog taugt dafür ebenso wenig: Traefik schreibt nur
Anfragen mit Status 5xx oder über 800 ms Dauer (Filter in seinen
Startparametern), und das Log lebt im Container-Log, das bei jedem Neuerstellen
des Containers mit verschwindet. Nachgemessen am 09.10.2026: 540 Zeilen für
`konfi-api@docker` in zweieinhalb Tagen, davon 18 mit Status 200 — bei
mehreren zehntausend Anfragen am Tag. Eine Zählung dort ergibt für fast jede
Route null.

Der Apache (verwaltet von KeyHelp) protokolliert dagegen **jede** Anfrage an
`konfi-quest.de` und `www.konfi-quest.de` in je einer eigenen Datei im
Logverzeichnis des KeyHelp-Nutzers (`<logverzeichnis>/konfi-quest.de/` und
`<logverzeichnis>/www.konfi-quest.de/`, Zugang und Pfad aus der
Betriebsdoku, nicht im Repo). Das Format ist das kombinierte Apache-Format:
`"METHODE /pfad PROTOKOLL" status …`.

### Wie weit das Log zurückreicht

KeyHelp rotiert die Zugriffslogs **wöchentlich** und hebt vier alte Stände
auf (`access.log`, `access.log.1`, `access.log.2.gz` … `access.log.4.gz`).
Das Fenster liegt damit immer zwischen **28 und 35 Tagen** — mehr als die
geforderten zwei Wochen, ohne Eingriff am Server. Nachgemessen am
09.10.2026: ältester Eintrag vom 06.09.2026, 412.838 Zeilen, davon 332.097
unter `/api/`. In den rotierten Ständen sind die IP-Adressen anonymisiert,
für die Zählung spielt das keine Rolle.

Die Aufbewahrung gehört KeyHelp. Ändert ein KeyHelp-Update sie, wird das
Fenster still kürzer — deshalb vor jeder Abrissentscheidung den ältesten
Eintrag prüfen (unten).

### Zählung je Route

```bash
ssh <betriebszugang>   # user@host aus der Betriebsdoku, nicht im Repo
cd <logverzeichnis>    # Logverzeichnis des KeyHelp-Nutzers

# Alle Stände beider Hosts, auch die gepackten:
alle() { zcat -f konfi-quest.de/access.log* www.konfi-quest.de/access.log*; }

# Alle /api-Pfade, IDs zusammengefasst, absteigend gezählt:
alle | grep -oE '"[A-Z]+ /api/[^ "?]*' \
  | sed -E 's#^"##; s#/[0-9]+#/:id#g' \
  | sort | uniq -c | sort -rn
```

Eine einzelne Route gezielt (hier `GET /api/konfi/badges` — das `[ ?]`
dahinter verhindert, dass `/api/konfi/badges/v2` mitzählt):

```bash
alle | grep -cE '"GET /api/konfi/badges[ ?]'
```

Taucht die Route mit **0** auf, ist ihre Bedingung erfüllt. Kommt sie noch
vor, lohnt der Blick, **wann** und von wem sie kommt (Zeitpunkt und
User-Agent stehen in derselben Zeile):

```bash
alle | grep -E '"GET /api/konfi/badges[ ?]' | tail -20
```

Gegenprobe, dass die Zählung trifft: `GET /api/notifications/preferences`
ist lebendig (Abschnitt C) und muss Treffer zeigen — am 09.10.2026 waren es
267 GET und 4 PUT im Fenster. Zeigt sie null, ist der Weg kaputt, nicht die
Route tot.

### ⚠ Vorher: Das Fenster prüfen

```bash
zcat -f konfi-quest.de/access.log.4.gz | head -1   # ältester Stand
```

Liegt der älteste Zeitstempel weniger als 14 Tage zurück (oder fehlt die
Datei), ist die Zählung **nicht** aussagekräftig. Eine Null aus einem zu
kurzen Fenster beweist nichts.

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

Stand 26.09.2026, gegen den Store-Stand geprüft (`git grep … 2.2.0 --
frontend/src`): Tag `2.2.0` ruft bereits `/v2` und `POST …/mark-seen`. Die
alten Formen braucht nur noch, was vor 2.2.0 installiert wurde — die Zählung
im Zugriffslog entscheidet, wann das niemand mehr ist.

`POST /api/konfi/badges/mark-seen` bleibt dauerhaft: Das Verb ist schon das
richtige, v2 ändert daran nichts. Kein Abrisskandidat.

### B — Ohne Aufrufer in der Oberfläche

Kein einziger Aufruf in `frontend/src` (grep ohne `__tests__`, variable URLs
per `apiEndpoint`/`apiBasePath`/Template-String nachgefasst). Das heißt
**nicht**, dass sie tot sind: Eine ausgelieferte App kann sie weiter rufen.
Die Prüfung übers Zugriffslog ist bei diesen Zeilen deshalb der eigentliche
Entscheider, nicht eine Formalie.

Stand der Nachprüfung: 01.09.2026, gegen Commit `4c46a3f2`. Erneut
nachgeprüft am 26.09.2026 — gegen `frontend/src` (HEAD) **und** gegen den
Store-Stand Tag `2.2.0` (`git grep '<route>' 2.2.0 -- frontend/src`): Keine
Zeile dieser Tabelle wird von 2.2.0 gerufen. Die beiden
`/api/notifications/preferences`-Routen standen hier zu Unrecht — die
Push-Auswahl der 2.3.0 ruft sie — und sind nach Tabelle C gewandert.

| Route | Ersatz | Anmerkung | Eingetragen |
|---|---|---|---|
| `GET /api/konfi/badges/stats` | `GET /api/konfi/badges/v2` liefert dieselben Zahlen genauer (`stats` bzw. `earned.length`) | Hatte noch nie einen Aufrufer in der Oberfläche | 31.08.2026 |
| `GET /api/teamer/badges/unseen` | ersatzlos — der Zähler kommt aus `GET /api/notifications/badge-counts` | Seit 27.08.2026 ruft keine Ansicht sie mehr; zählt zudem falsch (ohne `target_role`-Filter zählt sie bei beförderten Konfis alte Konfi-Abzeichen mit) | 31.08.2026 |
| `GET /api/konfi/events/:id/status` | `GET /api/konfi/events` liefert dieselben Felder pro Termin | 95 Zeilen (gezählt 26.09.2026). Rechnet den Anmeldestatus seit 01.09.2026 über `utils/terminAnmeldeStatus.js` — solange sie steht, läuft sie nicht mehr weg | 01.09.2026 |
| `GET /api/events/user/bookings` | ersatzlos — die Buchung steht in der Terminliste (`booking_status`) | | 01.09.2026 |
| `GET /api/teamer/konfis` | `GET /api/admin/konfis` | | 01.09.2026 |
| `GET /api/teamer/:userId/certificates` | ersatzlos — die Nachweise stehen im Teamer-Dashboard | POST und DELETE auf demselben Pfad SIND in Benutzung (`CertificateAssignModal.tsx`, `KonfiDetailView.tsx` — auch in 2.2.0) — **nur das GET** ist gemeint | 01.09.2026 |
| `GET /api/roles/:id` | `GET /api/roles` liefert die Liste, aus der die Oberfläche auswählt | | 01.09.2026 |
| `GET /api/roles/list/assignable` | ersatzlos | Der Pfad existiert nur, um `/:id` auszuweichen — fällt mit `/roles/:id` zusammen weg | 01.09.2026 |
| `GET /api/challenges/admin/authors` | ersatzlos | | 01.09.2026 |
| `GET /api/organizations/current` | `GET /api/organizations/:id` (die Oberfläche ruft `/organizations/${user.organization_id}`) | Liefert denselben Inhalt anders berechnet (korrelierte Subselects statt paralleler Count-Queries) | 01.09.2026 |
| `GET /api/organizations/:id/users` | `GET /api/organizations/:id/members` | Überlappt `/members` bei anderer Feldliste und anderen Guards | 01.09.2026 |
| `GET /api/organizations/:id/stats` | ersatzlos — die Zahlen stehen in `GET /api/organizations/:id` | | 01.09.2026 |
| `GET /api/chat/admins` | `GET /api/chat/available-users` | Inhaltlich eine Teilmenge davon | 01.09.2026 |
| `POST /api/chat/messages/:messageId/vote` | `POST /api/chat/polls/:pollId/vote` | Bewusster Alias für alte Apps: reine Verpackung um `votePoll`, keine Logik-Kopie. Steht hier, damit er beim Abriss nicht vergessen wird | 01.09.2026 |
| `GET /api/levels/konfi/:userId` | `GET /api/konfi/dashboard` (Level und Fortschritt stehen dort) | | 01.09.2026 |
| `GET /api/users/:id/jahrgaenge` | ersatzlos — die Zuweisungen kommen mit `GET /api/users/:id` | POST auf demselben Pfad IST in Benutzung (`UserManagementModal.tsx`, auch in 2.2.0) — **nur das GET** ist gemeint | 01.09.2026 |
| `DELETE /api/admin/activities/requests/:id` | ersatzlos | Nur `…/:id/photo`-DELETE und das PUT auf `…/:id` werden gerufen (`ActivityRequestModal.tsx`, auch in 2.2.0) | 01.09.2026 |
| `DELETE /api/events/:id/book` | Teamer: `POST /api/teamer/events/:id/zusage` mit `dabei=false` (lässt die Absage samt Grund stehen); Konfi: `DELETE /api/konfi/events/:id/register` (protokolliert in `event_unregistrations`) | Löscht die Buchung, ohne irgendetwas zu protokollieren — genau deshalb abgelöst (Absage-mit-Grund, 01.09.2026). Tag 2.2.0 nimmt für Teamer:innen **beide Richtungen** über die Zusage-Route (`TeamerEventsPage.tsx`, Kommentar „KEIN handleBook … und kein handleUnbook mehr"); nur Installationen vor 2.2.0 rufen `/book` noch. Nicht zu verwechseln mit `DELETE /api/events/:id/bookings/:participantId` (Leitung trägt jemanden aus) — die lebt | 01.09.2026 |
| `POST /api/events/:id/book` | Teamer: `POST /api/teamer/events/:id/zusage` mit `dabei=true`; Konfi: `POST /api/konfi/events/:id/register` | Seit 2.2.0 ohne Aufrufer in der Oberfläche (siehe Zeile darüber); dieselbe Zählung wie das DELETE entscheidet | 26.09.2026 |

### C — Bleiben dauerhaft (geprüft, kein Abrisskandidat)

Damit sie nicht bei der nächsten Prüfung wieder als „tot" auffallen:

| Route | Warum sie bleibt |
|---|---|
| `DELETE /api/challenges/konfi/submissions/:id` | **Keine Altlast, sondern eine Entscheidung.** Die Route antwortet absichtlich immer mit 403: Eingereichte Beiträge lassen sich nicht mehr zurückziehen, das Ausblenden bleibt Sache der Leitung (`PUT /admin/submissions/:id/moderate`). Sie steht als *stabile Fehlerantwort* für Apps, die den Zurückziehen-Knopf noch zeigen — ein Abriss ergäbe dort ein nichtssagendes 404 statt der erklärenden Meldung. Sie fällt erst, wenn keine App den Knopf mehr hat, und dann aus einem anderen Grund als „niemand ruft sie". |
| `GET /api/konfi/points-history`, `GET /api/teamer/konfi-history` | Lebendig über die `apiEndpoint`-Prop (`PointsHistoryModal.tsx`, Override in `TeamerKonfiStatsPage.tsx`) — sehen im grep tot aus, sind es nicht |
| `POST /api/auth/refresh` | Lebendig im axios-Interceptor (`services/api.ts`, Funktion für den Token-Refresh) |
| `GET /api/teamer/:userId/badges`, `GET /api/admin/konfis/:id/badges` | Lebendig über `KonfiBadgesSection.tsx` |
| `GET /api/notifications/preferences`, `PUT /api/notifications/preferences` | **Seit 2.3.0 lebendig.** Die Push-Auswahl in der App (`shared/PushAuswahl.tsx`: `ladePushEinstellungen` liest, `speichern` schreibt) ruft genau diese beiden Routen. Sie standen bis zum 26.09.2026 in Tabelle B mit Ersatz `/api/settings` — wer ihnen dort gefolgt wäre, hätte für alle Nutzer:innen der 2.3.0 die Auswahl „welche Mitteilungen aufs Handy kommen" abgerissen. Die Zugriffszählung **muss** für diese Routen Treffer zeigen; zeigt sie null, ist das Log-Fenster zu kurz, nicht die Route tot. |
| `POST /api/wrapped/generate-teamer` | **Kein Abrisskandidat, sondern ein Betriebswerkzeug.** Am 01.09.2026 auf dem Produktionsserver geprüft: keine Crontab-Zeile ruft den Endpunkt, der Jahres-Cron nutzt den Funktionsweg (`checkWrappedTriggers` in `backgroundService.js`). Die Route ist der Hand-Auslöser daneben — „Rückblick nochmal bauen", wenn der Cron ausgefallen ist oder Zahlen korrigiert wurden. Tests sichern sie ab (`wrapped.test.js`, die describe-Blöcke zu `POST /api/wrapped/generate-teamer`). Stand vorher fälschlich in Tabelle B: „ohne Aufrufer in der Oberfläche" stimmt, „abreißen" folgt daraus hier nicht. Gilt genauso für `DELETE /api/wrapped/teamer` (seit 01.09.2026), den Löschweg dazu. |

### D — Doppelte Mounts

Kein Routenabriss, sondern ein Einhänge-Pfad. Beide Mounts hängen denselben
Router ein (die beiden `app.use(…, require('./routes/users')…)`-Zeilen in
`createApp.js`).

| Mount | Ersetzt durch | Warum er noch steht | Eingetragen |
|---|---|---|---|
| `/api/admin/users` (Mount von `routes/users.js`) | `/api/users` (derselbe Router, anderer Pfad) | Die Oberfläche ruft seit 01.09.2026 durchgängig `/users`; Tag 2.2.0 ebenfalls (geprüft 26.09.2026 — `/admin/users` kommt dort nur noch als Seitenpfad der Oberfläche vor, nicht als API-Aufruf). Installationen vor 2.2.0 rufen `/admin/users` weiter. Beide Mounts bleiben, bis die Zählung für **alle** `/api/admin/users…`-Pfade null zeigt | 01.09.2026 |

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
