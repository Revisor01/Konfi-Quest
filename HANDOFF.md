# Handoff — Stand 23.08.2026

Übergabe an die nächste Sitzung. Alles unten Beschriebene ist auf `main`,
gepusht, CI grün und auf Produktion deployt.

## Wo wir stehen

- Branch `main`, letzter Stand `c1779d1` (auf Produktion deployt, CI grün).
- **Produktion läuft auf 2.0.0** (Server `kkd-fahrtenbuch.de`, siehe unten).
- **TestFlight: Build 139** (VALID, Testinfos gesetzt). Die UI-Änderungen von
  ganz zuletzt ("Was ist neu"-Banner, Umzugs-Hinweis entfernt) sind darin
  **nicht** enthalten — die bräuchten Build 140.
- iOS-Minimum ist seit Build 130 **16.4** (swiper 14 verlangt Safari 16.4+).

## Offen — hier weitermachen

### 1. Entscheidung von Simon: Tab "Events" umbenennen?

Der Tab heißt wie eines seiner eigenen Segmente:

```
Tab "Events"
 ├─ Segment "Events"        <- gleicher Name wie der Tab
 └─ Segment "Aktivitäten"
```

Simons Idee war "Punkte". Das trifft aber nur die Hälfte: Aktivitäten geben
Punkte, **Termine meist nicht** (Gottesdienste, Konfitage, Freizeiten sind
Verabredungen). Vorgeschlagene Alternativen, Entscheidung steht noch aus:

| | Tab | Segmente |
|---|---|---|
| A | Termine | Termine · Aktivitäten |
| B | Mitmachen | Termine · Aktivitäten |
| C | Punkte | Termine · Aktivitäten |

Betrifft **alle drei Ansichten** (`MainTabs.tsx:274/339/404` plus die
Segment-Labels in `AdminEventsPage.tsx:542` und `KonfiEventsPage.tsx:381`).

### 2. Docs-Bereich unter konfi-quest.de/docs (Wunsch Simon, 23.08.)

**Vorarbeit ist erledigt**, es fehlt nur noch die Freischaltung:

- `scripts/build-api-docs.mjs` erzeugt die HTML-Referenz aus `docs/api/*.yaml`.
  Aufruf: `npm --prefix frontend run docs:api`.
- Ergebnis liegt eingecheckt unter `frontend/public/docs/api/index.html`
  (131 Operationen). Vite kopiert `public/` unverändert nach `dist/`, damit
  ist die Seite **bereits Teil des Frontend-Containers**.
- Die CI prüft bei jedem Lauf, ob die Seite zum Stand der YAML-Dateien passt,
  und schlägt sonst mit einem Hinweis fehl (Schritt "API-Referenz aktuell?").

**Warum eingecheckt und nicht im Build erzeugt:** Der Docker-Kontext ist
`./frontend` (ci.yml:118) — `scripts/` und `docs/api/` liegen darüber und sind
im Container nicht erreichbar. Ein Build-Schritt dort würde brechen.

**Was noch zu tun ist:**
1. **Caddy: `/docs/api` schützen.** Die Seite ist derzeit unter
   `konfi-quest.de/docs/api/` erreichbar, sobald der nächste Frontend-Container
   deployt ist — **ungeschützt**. Die Berechtigungsmatrix ist eine Landkarte
   für jeden, der Lücken sucht. Caddy v2.10.2 auf dem Server kann `basic_auth`,
   genutzt wird es bisher nirgends. Im Block `konfi-quest.de` ergänzen:
   ```
   @apidocs path /docs/api /docs/api/*
   basic_auth @apidocs {
       simon <bcrypt-hash>
   }
   ```
   Hash erzeugen: `caddy hash-password`. Bis dahin schützt nur `noindex`
   im HTML-Kopf vor Suchmaschinen, nicht vor direktem Aufruf.
2. **Allgemeiner Docs-Bereich** unter `/docs` — Inhalte noch offen
   (Simons Wunsch). Struktur steht, `frontend/public/docs/` existiert.

### 3. Nach der Entscheidung: Build 140

Sammelt die UI-Änderungen ein, die nach Build 139 kamen.

## Server — wichtig, hat sich geändert

Der alte Server `server.godsapp.de` ist wegen einer **Netcup-Abuse-Sperre**
nicht erreichbar (Folge des abgegriffenen SMTP-Passworts). Konfi Quest läuft
übergangsweise auf dem Fahrtenbuch-Server:

- SSH: `ssh root@kkd-fahrtenbuch.de` (185.248.143.234)
- Stack: `/opt/konfi-quest/docker-compose.yml`
- Container: `kq-backend`, `kq-frontend`, `kq-postgres`
- Backups: `/opt/konfi-quest/dump/`

**Deploy läuft NICHT über die CI.** Der `deploy`-Job in `.github/workflows/ci.yml`
ist pausiert (`if: false && ...`), weil er auf den toten Portainer-Stack 249 zeigt.
Deploy von Hand:

```
cd /opt/konfi-quest
sed -i 's|konfi-quest-backend:[a-f0-9]\{7\}|konfi-quest-backend:<SHA>|; s|konfi-quest-frontend:[a-f0-9]\{7\}|konfi-quest-frontend:<SHA>|' docker-compose.yml
docker compose pull backend frontend && docker compose up -d
curl -sS http://127.0.0.1:5055/api/status
```

Wenn der alte Server zurückkommt: Deploy-Job wieder scharf schalten
(`false &&` entfernen) und Stack-ID prüfen.

## Tageslosung — behoben, aber im Notbetrieb

`ketiv.de` lag auf dem gesperrten Server und ist weiterhin tot. Deshalb laeuft
die Losungen-API jetzt zusaetzlich hier:

- Stack: `/opt/ketiv/docker-compose.notbetrieb.yml`
- Container: `ketiv-api`, `ketiv-postgres` (beide `unless-stopped`)
- Nur API, kein Frontend, kein Redis. Die Losungsdaten 2025/2026 kommen aus
  den SQL-Dumps im Repo (`sql/losungen_*.sql`), es wird nichts gescraped.
- Haengt zusaetzlich im Netz `konfi-quest_internal`, damit `kq-backend` den
  Namen `ketiv-api` aufloesen kann. **Wird dieses Netz neu angelegt, muss der
  ketiv-Stack neu verbunden werden.**
- `public/` fehlt im Repo (wird sonst per CI gebaut) und wurde von Hand als
  Platzhalter angelegt — sonst bricht der Build.

Zusaetzlich abgesichert, damit ein erneuter Ausfall nicht wieder die App bremst:

- **Negativ-Cache** im `losungService`: nach einem Fehlschlag wird der externe
  Abruf 30 Min uebersprungen. Vorher lief jede Anfrage erneut in beide Timeouts
  (2s intern + 5s oeffentlich); das Dashboard ruft die Losung bei jedem Oeffnen
  ab. Gemessen: 7s -> 4,5ms.
- Die Teamer-Route hat jetzt denselben DB-Fallback wie die Konfi-Route.

Noch offen: **Der Losungs-API-Key steht im Klartext im Backend-Log**, weil er
als Query-Parameter in der URL steht und die Fehlermeldung die ganze URL ausgibt.
Key ist rotiert, aber Logs werden aufbewahrt.

## Offene Punkte aus den Audits

### Live-Updates (Socket) — Hauptbefunde behoben
Behoben: tote Sitzung nach Login, Socket überlebt Logout, Challenges
(Anlegen/Löschen meldeten nichts), Punkte-Signale kreuzten sich, Material
ohne Updates, drei fehlende Socket-Trennungen.

Ebenfalls behoben (22.08.): **Organisationswechsel**. Die Empfaengerauflösung
in `liveUpdate.js` geht jetzt per UNION auch über `user_organizations` (mit der
dort hinterlegten Rolle, die je Gemeinde abweichen kann), und `switchOrg` baut
den Socket mit dem neuen Token neu auf. Betraf praktisch nur `simonluthe`,
den einzigen Mehrfach-Nutzer (Orgs 1, 2, 4).

Offen:
- **Detailansichten ohne Abo**: Konfi-Event-Detail, Teamer-Abzeichen,
  Teamer-Dashboard, Zertifikate-Seite.

### Berechtigungen — vier Lücken geschlossen
Behoben: Punktevergabe und Punkteabzug über Organisationsgrenzen,
Teilnehmerlisten fremder Gemeinden, `qr_token` + Entschuldigungsgründe an Konfis.

Am 22.08. abgearbeitet (alle gegen Produktion verifiziert, nicht nur im Test):
- **qr_token in der Terminliste** — ging an ALLE Rollen, auch Konfis. Damit
  konnte sich ein Konfi per QR-Checkin aus der Ferne als anwesend eintragen
  und Punkte gutschreiben. Der Filter existierte nur in der Detail-Route, über
  die Liste war er umgehbar. Live nachgewiesen (2 Token), jetzt 0.
- **Org-Stammdaten für Konfis** — Kontaktname, Telefon, Privatadresse, Lizenz-
  und Trial-Daten. Betraf `/organizations/:id`, `/:id/stats` UND `/current`;
  ohne den Guard auf `/current` wäre der Rest wirkungslos gewesen. Jetzt 403.
- **Passwortwechsel beendete keine Sitzungen** — Access-Tokens blieben gültig,
  Refresh-Tokens bis zu 90 Tage. Der Mechanismus (`token_invalidated_at`) war
  vorhanden, wurde nur nie gesetzt.
- **Reset-Token im Klartext** — jetzt als Hash, Migration 123 zog den einen
  offenen Eintrag nach. Achtung: Ein Klartext-Zweig als Übergang ist eine
  FALLE — der gespeicherte Hash ist selbst ein gültiger Klartext-Wert und
  funktioniert dann als Token.
- **E-Mail-Enumeration** — die Antwort war neutral, ein fehlgeschlagener
  Mail-Versand lieferte aber 500 und verriet damit die Existenz des Kontos.
- **Selbst-Aussperrung** — `is_active` setzt nur noch der super_admin.
- **Passwort-Policy** — Org-Anlage prüfte 6 Zeichen, das Bearbeiten eines
  Users gar nichts. Jetzt überall `validatePassword`.
- **Teamer-Filter ohne Jahrgang** — griff nur bei vorhandenen Zuweisungen.

### Multi-Org: der Befund war falsch, zwei andere Stellen waren es nicht

Der Audit-Befund "entzogener Zugang wirkt bis zu 15 Min nach" **stimmte
nicht**. Der Membership-Check existiert seit dem Multi-Org-Feature
(`rbac.js:150-166`) und liefert 403; der Entzug über die App leert zusätzlich
den Cache. Gegen Produktion gemessen: Entzug über die App wirkt **sofort**
(200 → 401), Entzug direkt in der DB nach ~30 s (Cache-TTL).

**Lehre daraus:** Audit-Befunde vor dem Weitergeben gegen den Code und
möglichst gegen Produktion prüfen. Ich hatte die 15 Minuten ungeprüft
übernommen und weitergereicht.

Tatsächlich offen waren zwei andere Stellen, auf die die Beschreibung passte —
beide am 22.08. behoben:
- `GET /chat/files/:filename` setzte `req.user = decoded`. Ungeprüfte
  Token-Angaben für die volle Laufzeit, und `organization_id` immer die
  Primär-Org: Wer in einer Zweit-Gemeinde arbeitete, bekam seine **eigenen**
  Chat-Dateien nicht (404).
- Die Socket-Anmeldung (`server.js`) ebenso — und ein Socket lebt deutlich
  länger als 15 Minuten. Jetzt eine Query je Verbindungsaufbau, nicht je
  Nachricht.

Dazu zwei kleine Härtungen: Die Org-Löschung leert den Cache der Gast-User,
und der Entzug einer Mitgliedschaft setzt `token_invalidated_at`. Niemand wird
dadurch ausgesperrt — die Refresh-Route prüft die Mitgliedschaft neu und
stellt ein Token ohne den entzogenen Claim aus.

Offen:
- **Abwägung für Simon:** Die Leitung kann private Zweier-Chats lesen und
  exportieren. Falls nicht gewollt, Direktchats vom Admin-Bypass ausnehmen.
- **Bewusst nicht geändert:** der 409 bei `update-email`. Dort ist der Nutzer
  angemeldet und die Meldung für die Bedienung nötig.

## Was am 22./23.08. gebaut wurde

**Tageslosung** — wieder da (ketiv als Notbetrieb-Stack, siehe oben) UND
wirklich abschaltbar: Ist sie in den Einstellungen aus, prüft das jetzt der
Server (204) *und* alle drei Frontend-Aufrufer. Vorher prüften nur zwei von
drei, und die Konfi-Startseite lud sie sogar doppelt.

**Sicherheit** (alle gegen Produktion verifiziert, nicht nur im Test):
- `qr_token` lag in der Terminliste für alle Rollen — ein Konfi konnte sich
  aus der Ferne als anwesend eintragen. Live nachgewiesen, jetzt weg.
- Org-Stammdaten (Kontakt, Adresse, Lizenz) waren für Konfis abrufbar.
  Betraf `/organizations/:id`, `/:id/stats` UND `/current`.
- Passwortwechsel beendete keine Sitzungen (`token_invalidated_at` existierte,
  wurde nur nie gesetzt). Reset-Token lag im Klartext.
- **Chat: Teamer:innen erreichten jeden Konfi der Gemeinde.** Jetzt nur noch
  die eigenen Jahrgänge; ohne Zuweisung gar keine. Leitung/Admins alle.
- Push kam nach dem Abmelden weiter an (Client-Cleanup war best-effort mit
  drei Bedingungen). Die Logout-Route räumt den Token jetzt selbst ab.
- **Konten ließen sich nicht löschen**, wenn damit je Punkte vergeben wurden —
  17 Fremdschlüssel ohne `ON DELETE`, nur einer war behandelt.

**Bedienung:**
- Termine mit unbegrenzter Teilnehmerzahl anlegbar (`0` wurde von einem
  truthy-Check verworfen)
- Chat: Reiter "Ungelesen" statt "Direkt", Kacheln sind Sprungziele
- Challenges (Leitung): Reiter Aktuell / Geplant / Archiv
- Teamer anlegen: Teamer-Farben, Benutzername automatisch, kein Aktiv-Schalter
- Benutzernamen mit Akzent: `Noémi Burau` → `noemi.burau` statt `noemiburau`
- "Was ist neu" als eigener Banner statt Listeneintrag (alle drei Ansichten)
- Umzugs-Hinweis unter Termine entfernt

**Aufgeräumt:** Sechs tote Dateien entfernt (ExploreContainer, zwei
Chat-Modals, uploadValidation, dateUtils, database.db). Bei
`uploadValidation.js` geprüft: Die Magic-Byte-Prüfung liegt inline in den
Routen und wirkt weiter — kein Sicherheitsverlust.

**Nicht angefasst (bewusst):** ChangeEmail-, ChangePassword- und
ActivityRequest-Modals gibt es je Rolle mehrfach, sind aber alle aktiv.
Zusammenlegen wäre Refactoring mit Risiko, kein Aufräumen.

## Test-DB-Schema — erledigt (22.08.)

Das Test-Schema kommt jetzt aus einem Produktions-Dump
(`backend/tests/schema/prod-schema.sql`, 57 Tabellen, nur Struktur), darauf
laufen nur noch nicht angewandte Migrationen — derselbe Weg wie beim Deploy.
Aktualisieren mit `bash backend/tests/schema/refresh-schema.sh`.

`globalSetup.js` schrumpfte von 354 auf 119 Zeilen und **bricht bei einer
fehlgeschlagenen Migration ab**, statt sie als "applied" zu markieren. Genau
dieses Verschlucken war die Wurzel, nicht die einzelnen Spalten.

Was der Umstieg ans Licht gebracht hat — vier Dinge, die vorher unsichtbar
grün liefen:

1. **Konten liessen sich nicht loeschen.** 17 Fremdschluessel zeigen auf
   `users(id)`, die meisten ohne `ON DELETE`; `deleteKonfiCascade` behandelte
   genau einen. Wer je Punkte vergeben, ein Event angelegt oder ein Abzeichen
   erstellt hatte, bekam bei der Selbstloeschung einen 500er. Betraf alle
   Rollen. Urheberschaft wird jetzt anonymisiert statt geloescht.
2. **bigint kam als String.** `database.js:7` registriert fuer die Anwendung
   einen Type-Parser, der Test-Pool nicht. Das alte Schema nutzte durchgaengig
   `integer` und verdeckte das; Produktion hat 111 `bigint`-Spalten. Rund 70
   Fehlschlaege, alle dieselbe Ursache. Die Tests hatten recht — sie pruefen
   jetzt das echte Verhalten.
3. **Die TRUNCATE-Liste war in beide Richtungen falsch**: zwei Tabellen, die
   es nur im alten Test-Schema gab, und fuenf fehlende (u.a. `settings`,
   `daily_verses`), deren Daten zwischen den Suites stehen blieben.
4. **`daily_verses` und `activities.category` hatten nirgends ein DDL** —
   Migration 124 traegt sie nach. Ohne sie haette eine Neuinstallation aus dem
   Repo beides nicht. Ebenso repariert: Migration 064 legt einen Index auf
   `invite_codes` an, das erst 079 erzeugt — auf einer frischen Datenbank
   brach die Kette und alle 73 Indexe der Datei entfielen.

Neu als Waechter: `backend/tests/schema/schemaDrift.test.js` (9 Tests) prueft
die betroffenen Objekte, das ON-CONFLICT-Verhalten von `daily_verses`, den
`text`-Typ von `chat_polls.options` (JSON.parse in `chat.js` verhaelt sich bei
`jsonb` anders), die Vollstaendigkeit der TRUNCATE-Liste in beide Richtungen
und dass keine Migration uebersprungen wurde.

Postgres im Test von 16 auf 15 angeglichen (Produktion laeuft 15.19).

**Falle fuer spaeter:** `pg_dump` schreibt `set_config('search_path','')` in
den Kopf und stellt den Pfad nicht wieder her. `refresh-schema.sh` filtert die
Zeile heraus; ohne das scheitert das erste `CREATE TABLE` danach mit "no
schema has been selected to create in".

## Danach

Vollständige API-Dokumentation nach **OpenAPI 3.1** über alle 223 Routen.
`docs/api/` deckt bisher 106 ab; die 25 LÜCKE-Marker darin waren keine
Doku-Lücken, sondern Sicherheitsbefunde — die sind jetzt abgearbeitet.

## Neue Dauerregeln (seit 23.08. in ~/.claude/CLAUDE.md, ALLE Repos)

- **CHANGELOG und API-Doku fortlaufend** — im selben Commit, nicht nachträglich.
  Behobene Befunde in der Doku markieren, nicht löschen.
- **Tests immer**, und weiche Assertions sind ein Fehler. `expect([200, 500])`
  oder `toBeDefined()` auf einem Zähler verdecken echte Fehler.
- **Git ohne Claude-Verweis** — kein `Co-Authored-By`, keine Session-Zeile.
- **Konventionen**: Keep a Changelog, OpenAPI 3.1, Conventional Commits.
- **Befunde vor dem Weitergeben prüfen** — ein Audit-Befund ist eine
  Behauptung. (Konkret passiert: "wirkt 15 Min nach" — gemessen Sekunden.)
- **Erst messen, dann behaupten** — mit Zahl, nicht "deutlich schneller".

In der Projekt-`CLAUDE.md` neu: die **drei Ansichtsbäume** (jede Rolle hat
einen eigenen, fast jede Funktion existiert mehrfach) und die **App-Typografie**
(Bebas Neue + Plus Jakarta Sans, Bereichsfarben aus `variables.css`).

## Fallen, die schon Zeit gekostet haben

- **Backend-Tests laufen lokal nicht** — kein Docker auf dem Mac. Nur über CI.
- **CI läuft auf Feature-Branches nicht automatisch**, nur auf `main` oder im PR.
  Manuell: `gh workflow run ci.yml --ref <branch>`.
- **Ionic `normalize.css`** setzt global `button { padding: 0; line-height: 1 }`
  und wird nach dem Theme geladen. Wer einen Button wie ein Div stylt, braucht
  `!important` — sonst ist er niedriger als die Nachbarn.
- **Ohne `IonItemSliding`** fehlt auch dessen `marginBottom`. Listen kleben dann
  aneinander.
- **firebase-admin v14**: `admin.credential` und `admin.messaging` gibt es nicht
  mehr. Import über `firebase-admin/app` und `firebase-admin/messaging`.
- **Das Test-DB-Schema hinkt der Produktion hinterher.** In der CI laufen
  Fehler wie `column a.category does not exist` (Wrapped) und
  `relation "daily_verses" does not exist` durch, ohne dass ein Test rot wird —
  beides existiert in Produktion sehr wohl. Heisst: diese Pfade werden faktisch
  nicht geprüft. Wer dort etwas ändert, hat kein Netz.
- **Ein Test kann grün aussehen und trotzdem am Ziel vorbeilaufen.** Die beiden
  Konfi-zu-Konfi-Tests schickten kein `name`; die Route antwortete mit 400
  ("Typ und Name sind erforderlich"), also lange vor der Sicherheitsprüfung.
  Bei Berechtigungstests immer den Statuscode prüfen, nicht nur "nicht 200".
- **Beim Bauen den Commit nennen.** Build 138 wurde gestartet, bevor sieben
  gewünschte Änderungen entstanden — sie fehlten dann im Build, und das fiel
  erst dem Nutzer auf.
- **Apple braucht länger als eine Stunde.** Build 138 tauchte nach 30 Minuten
  nicht in TestFlight auf; ich hielt ihn für verloren. Er kam später an.
  `UPLOAD SUCCEEDED` im Log ist das verlässliche Signal, nicht die Build-Liste.
- **Drei Ansichten heißt drei Stellen.** "Was ist neu" gab es in Konfi-, Teamer-
  UND Leitungsansicht; die dritte wäre fast durchgerutscht.
- **`git rm` aus dem Unterverzeichnis greift nicht** wie erwartet — die
  Löschungen fehlten still im Commit. Immer aus dem Repo-Wurzelverzeichnis.
- **API-Doku: `whatsNew`, nicht `whatsToTest`** (siehe Memory), und das
  Refresh-Skript für das Test-Schema filtert die `search_path`-Zeile heraus.
