# Audit CI, Build, Deployment, Release-Prozess und Store-Reife — 26.09.2026

## Umfang und Methode

**Geprüft (gelesen):** `.github/workflows/ci.yml`, `test-backend.yml`, `frontend.yml`,
`ios-release.yml`, `android-release.yml`, `notfall-deploy.yml`, `.github/scripts/upload-play.py`,
`.github/dependabot.yml`, `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`,
`backend/healthcheck.js`, `backend/database.js` (Migrationslauf), `backend/createApp.js`
(`/api/status`), `deploy/compose.konfi_quest.yml`, `deploy/rolling-deploy.sh`, `deploy/.env.example`,
`docker-compose.e2e.yml`, `backend/docker-compose.test.yml`, `init-scripts/*`, `e2e/global-setup.ts`,
`playwright.config.ts`, `frontend/capacitor.config.ts`, `frontend/version.json`,
`frontend/scripts/{apply-version,prepare-ios,prepare-android}.sh`, `frontend/vite.config.ts`,
`frontend/ios/App/**` (Info.plist, project.pbxproj, PrivacyInfo.xcprivacy, App.entitlements,
Podfile, AppDelegate.swift, SceneDelegate.swift, Assets), `frontend/android/**` (build.gradle,
variables.gradle, AndroidManifest.xml, proguard-rules.pro, data_extraction_rules.xml, MainActivity),
`frontend/config/*` (Firebase-Client-Konfigurationen), `frontend/public/**` (Icons, manifest.json,
`.well-known/*`), `docs/store-texte-*.md`, `frontend/release-notes-de.txt`, `CHANGELOG.md` (Kopf),
alle `package.json`-Versionen, `backend/routes/appVersion.js`, `backend/utils/storeVersion.js`,
`frontend/src/services/updateCheck.ts`, `frontend/src/utils/appVersion.ts`,
`scripts/build-{api-docs,openapi,handbuch}.mjs`, `docs/offene-befunde.md` (Abschnitte 2, 3, 12).

**Ausgeführt / gemessen:**
- `npm run build` im Frontend (`tsc && vite build`): Laufzeit, Chunk-Aufteilung, Warnungen, `dist`-Größe.
- Die drei Doku-Generatoren wie in der CI, danach `git status`/`git diff`; erzeugte Abweichung mit
  `git restore frontend/public/sitemap.xml` zurückgesetzt (einzige Berührung, nur erzeugte Datei).
- Docker: Pull der **tatsächlich deployten** Images `ghcr.io/revisor01/konfi-quest-backend:fce1ab0`
  und `…-frontend:fce1ab0` (ghcr ist anonym lesbar), Inspektion von Nutzer, Layern, Inhalt, Abhängigkeiten.
  Ein lokaler `docker build` scheiterte am Docker-Hub-Limit (`429 Too Many Requests` beim Pull von
  `node:26-bookworm`), war aber nach dem Pull des Produktions-Images nicht mehr nötig.
- `npm install --omit=dev` gefolgt von `npm install pg` in einem Wegwerfverzeichnis, um das Verhalten
  aus `backend/Dockerfile:17` ohne Docker nachzustellen.
- `npm audit` in Backend und Frontend.
- Der Tag-Rewrite aus `ci.yml:442` (perl) gegen die Referenz-Compose-Datei.
- Öffentliche Endpunkte der Produktion per `curl` (`/api/status`, `/api/app-version`,
  `/.well-known/apple-app-site-association`, `/.well-known/assetlinks.json`, Antwort-Header von `/`).
- GitHub-Actions-Historie über die API: Läufe von `ci.yml` (948 Läufe), `ios-release.yml` (116),
  `android-release.yml` (54), `notfall-deploy.yml` (0), `test-backend.yml` (9), `frontend.yml` (51),
  Jobs und Log-Enden der roten Läufe 36196314912 und 36128152982.
- Plist-Validität (`python3 plistlib`), Icon-Farbtyp (PNG-Header), Regex-Verhalten.

**Bewusst nicht geprüft:** Inhalt der Datenbank-Migrationen (anderer Bereich); Portainer-Stack-Datei,
Server-Backups, Ressourcenauslastung (kein Zugriff, siehe „Auf Produktion nachzumessen"); App Store
Connect und Play Console (Datenschutz-Labels, Data Safety, Altersfreigabe — nicht im Repo).

## Zusammenfassung

Der Weg vom Commit in den Betrieb ist solide gebaut: Test-Gate mit Backend-, Frontend- und E2E-Suite vor
Build und Deploy, unveränderliche Commit-SHA-Tags, Verify gegen `/api/status`, Migrationen mit
Advisory-Lock für zwei Replicas, Secrets nur über `${VAR:?}`. Der Weg in die **Stores** hat dieses Gate
nicht: Beide Release-Workflows laufen nur per Hand, hängen an keinem Testergebnis, prüfen den Branch nicht
und wurden nachweislich **aus Commits mit roter CI gebaut und hochgeladen** (iOS-Build 227 und Android 123
am 25.09., iOS 222 am 25.09.). Das ist der eine Befund der Stufe HOCH.

Daneben acht Befunde der Stufe MITTEL: iOS-Deep-Links sind ein öffentlicher Platzhalter (`TEAMID`) ohne
Entitlement; der CI-Deploy schreibt auch das Test-Backend auf das Live-Image um (entgegen der Doku); kein
`concurrency`-Schutz gegen sich überholende Deploys; jeder Push auf `main` erzeugt tagsüber eine
Deploy-Lücke (14 Deploys in 38 Stunden, 11 davon zwischen 7 und 22 Uhr); das Backend-Image läuft als root,
enthält Dev-Abhängigkeiten, Tests, Schema-Dump und Compiler; Typprüfung und Web-Build laufen erst nach dem
Merge; Store-Texte für 2.3.0 fehlen; die Versionsstände im Repo widersprechen sich. Dazu neun Befunde der
Stufe NIEDRIG (Hygiene). Keine KRITISCH-Befunde.

**Zahlen:** KRITISCH 0 · HOCH 1 · MITTEL 8 · NIEDRIG 9.

## Release-Empfehlung für den Bereich

**Mit Auflage.** Der Server-Deploy ist freigabefähig. Für die Store-Einreichung 2.3.0 gilt als Auflage:
(1) Vor der Freigabe in den Production-Track und der App-Store-Einreichung nachweisen, dass der CI-Lauf
**des exakt gebauten Commits** (`fce1ab01`, CI-Lauf 948 — grün) grün ist; für die nächsten Builds den
Release-Workflows ein Gate geben (Ref-Prüfung auf `main` + Warten auf grünen CI-Lauf desselben SHA).
(2) `docs/store-texte-2.3.0.md` anlegen, damit der Plattform-Check des iOS-Workflows überhaupt etwas
prüft. (3) `apple-app-site-association` entweder mit Team-ID `J459G9CJT5` und passendem Entitlement
richtig machen oder bis dahin entfernen.

## Befunde

### BF-01: Store-Builds ohne Test-Gate, ohne Branch-Prüfung — nachweislich aus roten Commits hochgeladen
- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — Beide Release-Workflows haben einen vorgeschalteten Job `ci-gate` (`.github/scripts/release-gate.py`): Abbruch, wenn der Commit nicht auf `main` liegt (Eingabe `allow_non_main` übersteuert bewusst), und Warten auf einen erfolgreichen `ci.yml`-Lauf für genau diesen SHA (bis 45 Minuten; roter oder fehlender Lauf bricht mit Link bzw. Startanleitung ab). Lokal mit gefälschtem `gh` in zwölf Szenen durchgespielt; der erste echte Dispatch ist in GitHub zu prüfen. **Nachweis für den laufenden Release 2.3.0** (Build 230/124, Commit `fce1ab01`): `gh run list --repo Revisor01/Konfi-Quest --workflow ci.yml --commit fce1ab013e317ed21a582b7e4179fcf402a07e83 --json databaseId,status,conclusion,url` — der Eintrag muss `"conclusion": "success"` tragen (laut Beleg oben Lauf 948, grün seit 10:33:24 UTC).
- **Fundstelle:** `.github/workflows/ios-release.yml:11-17` (nur `workflow_dispatch`, kein `needs`, keine
  Ref-Prüfung), `.github/workflows/android-release.yml:22-32` (dito), Job-Definitionen ohne Abhängigkeit
  `ios-release.yml:23-25`, `android-release.yml:38-40`.
- **Kennzeichnung:** reproduziert (GitHub-Actions-API; Läufe unten verlinkt)
- **Beschreibung:** Beide Release-Workflows bauen, signieren und laden hoch, sobald jemand sie auslöst —
  aus jedem Branch, ohne auf den CI-Lauf zu warten oder ihn zu prüfen. Der Web-Deploy dagegen ist gegatet
  (`ci.yml:285`). Die Historie zeigt, dass die Release-Workflows regelmäßig **Sekunden nach dem Push**
  gestartet werden, also bevor die CI fertig ist, und dass die CI danach mehrfach rot wurde:
  - Commit `b3b6ded1` („Android 123, iOS-Build 227"): CI-Lauf 938 gestartet 25.09. 22:21:38 UTC →
    **failure** (backend-test: `ERROR: deadlock detected` zwischen `TRUNCATE … RESTART IDENTITY CASCADE`
    und Zähler-Abfragen; frontend-test: `spawnSync plutil ENOENT` in `privacyManifest.test.ts`).
    iOS-Release-Lauf 113 gestartet 22:21:43 UTC → **success**, Android-Release-Lauf 53 gestartet
    22:21:53 UTC → **success**. Beide Builds gingen zu App Store Connect bzw. in die Play-Tracks.
  - Commit `830257e9` („iOS-Build 222"): CI-Lauf 931 **failure** (backend-test), iOS-Release-Lauf 108
    **success** (Upload).
  - Commit `fce1ab01` (heute, Build 230/124): CI-Lauf 948 gestartet 10:22:44 UTC, Release-Läufe 116/54 um
    10:23:50 bzw. 10:24:02 UTC gestartet — die CI wurde erst um 10:33:24 UTC grün. Diesmal ging es gut.
  Die roten Tests waren in beiden Fällen Infrastruktur-Fehler (Test-Deadlock, fehlendes macOS-Werkzeug),
  kein Fehler in der App. Das ist Glück, kein Schutz: Der Workflow hätte einen echten roten Test genauso
  durchgewunken. Der Kommentar in `android-release.yml:10-20` beschreibt bereits, dass versionCode 102
  am 15.09.2026 versehentlich in die Produktion ging — ein Produktions-Release ist nicht zurückziehbar.
- **Auswirkung aus Nutzersicht:** Ein Store-Update kann einen Fehler tragen, den die Tests bereits
  gefunden hatten. Für 10.000+ Nutzer:innen ist ein Store-Build nicht per Redeploy zurückzuholen; der
  Web-Deploy schützt sich genau davor, die App nicht.
- **Beleg:**
  - CI 938: https://github.com/Revisor01/Konfi-Quest/actions/runs/36196314912 (conclusion `failure`,
    Jobs backend-test 108272854640 und frontend-test 108272854358 rot; Log-Ende backend-test:
    `2026-09-26 00:33:02.723 CEST [930] ERROR: deadlock detected … Process 930: TRUNCATE …`;
    Log-Ende frontend-test: `Serialized Error: { … syscall: 'spawnSync plutil', path: 'plutil' …}`).
  - iOS 113: https://github.com/Revisor01/Konfi-Quest/actions/runs/36196321736 (head_sha `b3b6ded1`,
    `success`, 22:21:43Z). Android 53: https://github.com/Revisor01/Konfi-Quest/actions/runs/36196336463
    (`success`, 22:21:53Z).
  - CI 931: https://github.com/Revisor01/Konfi-Quest/actions/runs/36128152982 (`failure`),
    iOS 108: https://github.com/Revisor01/Konfi-Quest/actions/runs/36128160783 (`success`).
  - Alle 15 zuletzt gelisteten iOS- und 15 Android-Läufe kamen von `main`; die Möglichkeit, aus einem
    anderen Branch zu bauen, besteht dennoch (Workflow-YAML enthält keine Prüfung von `github.ref`).
- **Empfehlung:** Im Release-Workflow als ersten Schritt `github.ref == 'refs/heads/main'` erzwingen und
  den CI-Lauf desselben SHA abwarten/prüfen (`gh run list --commit $GITHUB_SHA --workflow ci.yml` mit
  Abbruch bei `failure`/laufend), oder Store-Builds als Job in `ci.yml` hinter `needs: [backend-test,
  frontend-test, e2e-test]` hängen und über einen Tag/Input auslösen. Für Production-Track zusätzlich
  einen Umgebungsschutz (GitHub Environment mit Freigabe).

### BF-02: iOS-Deep-Links: `apple-app-site-association` ist ein Platzhalter und wird so ausgeliefert
- **Schwere:** MITTEL
- **Fundstelle:** `frontend/public/.well-known/apple-app-site-association:6,7,12`
  (`"appID": "TEAMID.de.godsapp.konfiquest"`, Pfade `/konfi/*`, `/admin/*`),
  `frontend/ios/App/App/App.entitlements:5-6` (nur `aps-environment`, kein
  `com.apple.developer.associated-domains`), `frontend/nginx.conf:96-102` (kein Content-Type für die
  endungslose Datei), zum Vergleich `frontend/android/app/src/main/AndroidManifest.xml:67-76`.
- **Kennzeichnung:** reproduziert (`curl -D - https://konfi-quest.de/.well-known/apple-app-site-association`)
- **Beschreibung:** Android-App-Links sind vollständig (Manifest mit `autoVerify`, `assetlinks.json` mit
  zwei echten Fingerabdrücken, Test `appLinksAndroid.test.ts`). Für iOS liegt eine AASA-Datei mit dem
  wörtlichen Platzhalter `TEAMID` öffentlich auf `konfi-quest.de` (HTTP 200, `content-type:
  application/octet-stream`); das Xcode-Projekt hat kein Associated-Domains-Entitlement, also fragt kein
  iPhone diese Datei je an. Die Pfadliste (`/konfi/*`, `/admin/*`) widerspricht zudem der Android-Liste
  (`/login`, `/register`, `/reset-password`). Die Team-ID steht im Repo (`project.pbxproj:401`:
  `J459G9CJT5`). Das CHANGELOG bewirbt App-Links korrekt nur für Android — die Datei behauptet öffentlich
  etwas anderes.
- **Auswirkung aus Nutzersicht:** Einladungslink aus Elternbrief/QR und Passwort-vergessen-Link öffnen auf
  dem iPhone Safari statt der App (heutiger Stand, kein Rückschritt). Wer die Datei liest (Apple-CDN,
  Prüfwerkzeuge), sieht eine kaputte Konfiguration.
- **Beleg:** Live-Antwort (26.09.2026 11:54 UTC): `HTTP/2 200`, `content-type: application/octet-stream`,
  Body enthält `"appID": "TEAMID.de.godsapp.konfiquest"`; im deployten Frontend-Image
  `grep -c TEAMID /usr/share/nginx/html/.well-known/apple-app-site-association` → `2`.
- **Empfehlung:** Entweder vollständig umsetzen (Entitlement `applinks:konfi-quest.de`, Team-ID eintragen,
  Pfade wie Android, `default_type application/json` in nginx, Test analog `appLinksAndroid.test.ts`) oder
  die Datei entfernen, bis das passiert.

### BF-03: CI-Deploy schreibt auch `backend-test` auf das Live-Image um — Test-Backend läuft danach auf `main`
- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — Der Tag-Rewrite in `ci.yml` folgt jetzt dem Dienstblock und schreibt nur in `backend`, `backend2` und `frontend` um; Gegenprobe im Workflow: die `image`-Zeile von `backend-test` muss vor und nach dem Rewrite identisch sein, sonst Abbruch ohne Deploy; steht sie nicht auf `test-…`, warnt der Lauf (Altlast des alten Rewrites — im Portainer-Stack von Hand auf `test-latest` zurückstellen, siehe „Auf Produktion nachzumessen"). Lokal gegen die Referenz-Compose in fünf Szenen geprüft (alter Rewrite reproduziert den Befund, Gegenprobe schlägt dabei an). `notfall-deploy.yml:96` trägt dasselbe alte Muster und ist nicht angefasst.
- **Fundstelle:** `.github/workflows/ci.yml:442` (Regex `(konfi-quest-(?:backend|frontend)):[A-Za-z0-9._-]+`),
  `deploy/compose.konfi_quest.yml:203-205,212` („Das Image trägt den Tag test-latest … der Live-Redeploy
  zieht davon nichts"), `.github/workflows/test-backend.yml:9-11`.
- **Kennzeichnung:** reproduziert (perl-Rewrite gegen die Referenz-Compose-Datei)
- **Beschreibung:** Der Tag-Rewrite trifft **jede** `konfi-quest-backend:<tag>`-Zeile, also auch
  `konfi-quest-backend:test-latest` des Dienstes `backend-test`. Nach jedem Push auf `main` läuft
  `test-api.konfi-quest.de` damit auf demselben SHA wie Live; ein danach per `test-backend.yml` gebautes
  `test-latest` wird vom Stack nicht mehr referenziert, bis jemand die Stack-Datei von Hand zurückstellt.
  Die Doku an drei Stellen behauptet das Gegenteil. Der Deploy-Kommentar in `ci.yml:360-362` („Test-Backend
  läuft auf dem Stand von main") passt zu genau diesem Verhalten.
- **Auswirkung aus Nutzersicht:** Wer einen Feature-Branch über die TestFlight-App gegen `test-api`
  prüft, testet still den `main`-Stand, sobald irgendjemand pusht. Fehler fallen erst im Store auf.
- **Beleg:**
  ```
  vorher:  212:    image: ghcr.io/revisor01/konfi-quest-backend:test-latest
  IMG_TAG=fce1ab0 perl -i -pe 's#(konfi-quest-(?:backend|frontend)):[A-Za-z0-9._-]+#$1:$ENV{IMG_TAG}#g'
  nachher: 212:    image: ghcr.io/revisor01/konfi-quest-backend:fce1ab0
  ```
  (Ausgabe in `scratchpad/ci-deployment-store/`, Zeilen 59/138/212/267 alle auf `fce1ab0`.)
- **Empfehlung:** Regex auf die Dienste `backend`, `backend2`, `frontend` begrenzen (z. B. per Zeilenanker
  auf den Dienstblock oder `(?<!test-)` bzw. Ausschluss des Tags `test-`), Gegenprobe im Workflow:
  `grep -q 'konfi-quest-backend:test-latest' compose.yml` muss nach dem Rewrite noch treffen.

### BF-04: Kein `concurrency`-Schutz — parallele Deploys können sich überholen
- **Schwere:** MITTEL
- **Status:** teilweise behoben 26.09.2026 — `concurrency: deploy-production` (`cancel-in-progress: false`) auf dem `deploy`-Job: zwei Deploys laufen nie mehr gleichzeitig, ein wartender wird vom nächsten ersetzt. Offen bleibt die Reihenfolge: braucht der ältere Push länger für seine Tests, kommt sein Deploy weiterhin nach dem neueren an die Reihe und setzt den älteren SHA — eine Prüfung gegen den jüngsten erfolgreichen Lauf auf `main` fehlt. `cancel-in-progress` für Test-Jobs auf Nicht-`main`-Refs ist nicht umgesetzt.
- **Fundstelle:** `.github/workflows/ci.yml` (kein `concurrency:`-Block auf Workflow- oder Job-Ebene;
  `grep -n concurrency .github/workflows/*.yml` → kein Treffer), Deploy-Schleife `ci.yml:465-485`.
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Zwei kurz aufeinander folgende Pushes laufen parallel. Der ältere Lauf kann seinen
  `PUT /api/stacks/249` **nach** dem neueren absetzen und Produktion auf den älteren SHA zurückdrehen. Sein
  Verify (`live == GIT_SHA`) wird dann grün, der neuere Lauf versucht bis zu drei Runden, den neueren SHA
  wieder zu setzen — ob er gewinnt, hängt vom Timing ab. Am 26.09. gab es 8 Pushes auf `main` zwischen
  02:36 und 10:22 UTC, teils im Abstand von 12–35 Minuten (CI-Läufe 941–948); die Läufe dauern 10–23 Minuten.
- **Auswirkung aus Nutzersicht:** Ein bereits ausgerollter Fix kann für Minuten oder dauerhaft wieder
  verschwinden, ohne dass ein Lauf rot wird.
- **Beleg:** Laufzeiten aus der API: Lauf 946 (Attempt 2) 07:37→08:00 UTC (23 min), Lauf 947 09:08→09:22,
  Lauf 948 10:22→10:33. Kein `concurrency`-Schlüssel in `ci.yml`.
- **Empfehlung:** `concurrency: { group: deploy-main, cancel-in-progress: false }` auf dem `deploy`-Job
  (Serialisierung) und `cancel-in-progress: true` für die Test-Jobs auf Nicht-`main`-Refs.

### BF-05: Jeder Push auf `main` erzeugt tagsüber eine Deploy-Lücke; „nachts unkritisch" stimmt nicht
- **Schwere:** MITTEL
- **Fundstelle:** `deploy/compose.konfi_quest.yml:11-13` („kurze Lücke; nachts unkritisch"),
  `deploy/rolling-deploy.sh:1-16` (WIP seit 21.06.2026, zwei offene Punkte), `ci.yml:342-372,447-460`
  (update_stack mit `pullImage: true` für den ganzen Stack), `compose.konfi_quest.yml:17` (`postgres:15-alpine`
  als gleitender Tag).
- **Kennzeichnung:** aus Code gelesen; Deploy-Zeitpunkte reproduziert (GitHub-API)
- **Beschreibung:** Der Deploy ersetzt `backend`, `backend2` und `frontend` gleichzeitig (Portainer
  update_stack); der rollende Tausch ist seit drei Monaten „noch nicht scharf". Die Annahme „nachts" ist
  falsch: Von den 20 zuletzt gelisteten CI-Läufen waren 14 grün und haben deployt — Berliner Zeit am 25.09.
  um 12:41, 14:09, 18:48, 19:35, 20:15, 21:16, 21:18 und am 26.09. um 02:43, 05:04, 05:09, 07:38,
  08:34, 11:08, 12:22. Elf Deploys lagen zwischen 7 und 22 Uhr. Dazu: `pullImage: true` zieht bei jedem
  Deploy auch `postgres:15-alpine` neu; erscheint upstream ein neues Image unter diesem Tag, wird der
  Datenbank-Container mit neu erstellt (Compose erkennt geänderte Image-ID) — mitten im Betrieb.
- **Auswirkung aus Nutzersicht:** Wer im Moment des Deploys in der App arbeitet (Konfisamstag, 10–14 Uhr),
  sieht für Sekunden Fehler oder „Keine Verbindung"; ein Chat-Upload kann abbrechen. Die
  `rolling-deploy.sh` nennt gemessene „~15 s 502/503" für den Tausch.
- **Beleg:** Zeitstempel `created_at`/`updated_at` der Läufe 929–948 aus `list_workflow_runs`;
  `rolling-deploy.sh:4` („~15s lang 502/503 beim Tausch").
- **Empfehlung:** Entweder den rollenden Deploy fertigstellen (die beiden Punkte in `rolling-deploy.sh` sind
  benannt) oder den Deploy-Job auf ein Zeitfenster/manuelle Freigabe (GitHub Environment) legen und den
  Kommentar korrigieren. `postgres` per Digest pinnen (`postgres:15-alpine@sha256:…`), damit ein Deploy nie
  die Datenbank neu erstellt.

### BF-06: Backend-Image läuft als root, enthält Dev-Abhängigkeiten, Tests, Schema-Dump und Compiler
- **Schwere:** MITTEL
- **Fundstelle:** `backend/Dockerfile:1` (`node:26-bookworm`, Vollimage), `:6-11` (g++, make, python3 im
  Laufzeit-Image), `:17` (`npm install --omit=dev && npm install pg` statt `npm ci`), `:20` (`COPY . .`),
  kein `USER`, kein `backend/.dockerignore` (Datei fehlt; `frontend/.dockerignore` existiert).
- **Kennzeichnung:** reproduziert (Inspektion des deployten Images `…-backend:fce1ab0`; npm-Nachstellung)
- **Beschreibung:** Das Produktions-Image ist 1,92 GB (entpackt), davon 619 + 240 + 194 MB Basis-Layer mit
  Build-Werkzeugen, git, mercurial, subversion. Der Prozess läuft als `uid=0(root)`, `/app` ist für ihn
  schreibbar. `--omit=dev` ist wirkungslos, weil das nachgestellte `npm install pg` ohne den Schalter alle
  Abhängigkeiten nachinstalliert: `vitest`, `nodemon`, `supertest` liegen im Image (319 Module, 142 MB). Das
  Lockfile ist nicht bindend (`npm install` statt `npm ci`; heute zufällig konsistent: `npm ls --omit=dev`
  meldet 0 Abweichungen). `COPY . .` nimmt `tests/` (150 Dateien, 3,2 MB — darunter
  `tests/schema/prod-schema.sql`, der vollständige Produktions-Schema-Dump), `BACKEND_ANALYSE.md`,
  `RBAC-SCHEMA.md`, `docker-compose.test.yml` mit. `.env` und `uploads/` landen nur deshalb nicht im Image,
  weil die CI frisch auscheckt; ein lokaler Build würde sie mitnehmen (kein `.dockerignore`).
- **Auswirkung aus Nutzersicht:** Keine direkte. Betrieblich: größere Angriffsfläche (Compiler, root), der
  Schema-Dump liegt in einem öffentlich lesbaren Image (ghcr anonym lesbar — geprüft), langsamere Pulls.
- **Beleg:**
  ```
  docker inspect: User=[]  Cmd=[node server.js]  NODE_VERSION=26.10.0
  docker run … id → uid=0(root) gid=0(root)
  ls /app/node_modules | grep -c '^vitest$\|^nodemon$\|^supertest$' → 3
  find /app/tests -type f | wc -l → 150 ; ls -la /app/tests/schema/prod-schema.sql → 130900 Bytes
  which g++ gcc make python3 → alle vorhanden
  Nachstellung ohne Docker: npm install --omit=dev → 258 Module, vitest NEIN;
                            npm install pg          → 320 Module, vitest JA, nodemon JA
  ```
- **Empfehlung:** `npm ci --omit=dev` (pg steht bereits in `dependencies`, die zweite Zeile ist überflüssig),
  `FROM node:24-bookworm-slim` mit Multi-Stage für native Builds, `USER node`, `backend/.dockerignore`
  (tests, *.md, docker-compose.test.yml, .env*, uploads, node_modules), `COPY` gezielt.

### BF-07: Typprüfung und Web-Build laufen erst nach dem Merge — Build-Brüche erreichen `main` und stoppen still den Deploy
- **Schwere:** MITTEL
- **Status:** teilweise behoben 26.09.2026 — `frontend-test` führt jetzt `npx tsc --noEmit` und `npx vite build --logLevel warn` aus (lokal grün: 13,9 s bzw. 17,2 s); ein Typfehler oder eine kaputte CSS-Klammer macht den Test-Job rot, bevor `build-and-push` läuft. Nicht umgesetzt: eine zusätzliche aktive Benachrichtigung bei rotem `main` — es bleibt bei GitHubs Standard-Mail an den Committer.
- **Fundstelle:** `.github/workflows/ci.yml:228-230` (frontend-test führt nur `vitest run` aus, kein
  `tsc --noEmit`, kein `vite build`), `:284-290` (der Build passiert erst in `build-and-push`, nur auf
  `main`/push), `frontend/package.json` (`"build": "tsc && vite build"`).
- **Kennzeichnung:** reproduziert (Commit-Historie und CI-Läufe)
- **Beschreibung:** Vitest prüft keine Typen und parst kein CSS mit dem Bundler. Ein Typfehler oder eine
  kaputte CSS-Klammer wird auf einem PR grün und bricht erst `build-and-push` auf `main`. Genau das ist am
  26.09. passiert: `36b8f7ce` „fehlende Klammer im Dunkelblock brach den Build" (`SyntaxError: [lightningcss
  minify]`). Rote Läufe auf `main` heißen „kein Deploy" — richtig — aber nichts meldet das aktiv; die
  Commit-Historie kennt den Fall mehrfach („übersprang damit STILL den Deploy", `f7e662d3`; „seit dem
  01.09.2026 kein Image mehr gebaut", `173fab36`). Praktisch wird ohnehin direkt auf `main` gepusht (alle 20
  zuletzt gelisteten CI-Läufe sind `push`-Events; der PR-Lint-Schritt wurde in keinem ausgeführt).
- **Auswirkung aus Nutzersicht:** Ein Fix ist committet, im Betrieb aber nicht — und niemand merkt es,
  bis jemand die Actions-Seite ansieht.
- **Beleg:** Commit `36b8f7ce` (26.09. 09:49): Test `stylesheetsParsen.test.ts` wurde genau deshalb
  ergänzt; `ci.yml` enthält kein `tsc`, kein `npm run build` vor `build-and-push`.
- **Empfehlung:** In `frontend-test` den Schritt `npx tsc --noEmit && npx vite build --logLevel warn`
  aufnehmen (17 s lokal gemessen), eine Benachrichtigung bei `failure` auf `main` (GitHub-Notification ist
  Standard, aber ein `if: failure()`-Schritt mit Issue/Slack/Mail macht es sichtbar).

### BF-08: Store-Texte für 2.3.0 fehlen; Android-Notizen decken die größten Neuerungen nicht ab
- **Schwere:** MITTEL
- **Fundstelle:** `docs/` (vorhanden: `store-texte-2.0.0.md`, `2.1.0`, `2.1.1`, `2.2.0`; kein `2.3.0`),
  `frontend/release-notes-de.txt` (Play-Text, 489 Zeichen), `CHANGELOG.md:9-…` (Unreleased 2.3.0),
  `.github/workflows/ios-release.yml:41-71` (Plattform-Check liest nur vorhandene `store-texte-*.md`).
- **Kennzeichnung:** aus Code gelesen (Dateiliste, Textvergleich)
- **Beschreibung:** Der iOS-Text „Neues in dieser Version" hat keine Quelle im Repo; der Plattform-Check
  (Grund: Ablehnung unter Guideline 2.3.10 am 29.08.2026) läuft ins Leere, weil es nichts zu prüfen gibt.
  Die Android-Notizen nennen Multi-Gemeinde, Einladung, Rückblick je Gemeinde, Mitteilungs-Auswahl,
  Dunkelmodus, laufender Termin, Zähler-Fix — nicht aber das **Postfach mit Glocke** (mehrere
  CHANGELOG-Punkte, für alle Rollen sichtbar), die „Was ist neu"-Übersicht und die Android-App-Links.
  Zusätzlich enthält der Unreleased-Block des CHANGELOG doppelte Abschnitte (`### Hinzugefügt` 2×,
  `### Geändert` 2×, `### Sonstiges` 2×) — gegen Keep a Changelog und damit gegen `CLAUDE.md`.
- **Auswirkung aus Nutzersicht:** Nutzer:innen erfahren im Store nicht, dass es ein Postfach gibt; der
  iOS-Text wird von Hand in App Store Connect getippt — ohne die Prüfung, die eine zweitägige
  Ablehnung verhindern soll.
- **Beleg:** `ls docs/store-texte-*.md` → vier Dateien bis 2.2.0; `awk … CHANGELOG.md | sort | uniq -c`
  → `2 ### Geändert`, `2 ### Hinzugefügt`, `2 ### Sonstiges`; `wc -c frontend/release-notes-de.txt` → 489.
- **Empfehlung:** `docs/store-texte-2.3.0.md` mit `## iOS`/`## Android` anlegen (Postfach an den Anfang),
  Android-Text von dort nach `release-notes-de.txt` übernehmen; CHANGELOG-Abschnitte zusammenführen.

### BF-09: Versionsstände widersprechen sich; ein Store-Build ist nicht sicher einem Commit zuzuordnen
- **Schwere:** MITTEL
- **Fundstelle:** `frontend/version.json` (2.3.0 / Android 124 / iOS 230 — Quelle der Wahrheit),
  `frontend/ios/App/App/Info.plist:19-22` (2.3.0 / **220**), `project.pbxproj:400,410,436,447`
  (**218** / 2.3.0), `package.json:3` (2.9.0), `backend/package.json:3` (1.0.1 → `/api/status` meldet
  `"version":"1.0.1"`, `createApp.js:394-406`), `frontend/package.json:4` (0.0.1), Git-Tags `v2.5`…`v2.12`
  (mit `v`, gegen Konvention) neben `1.3.0`…`2.2.0`; `frontend/scripts/apply-version.sh:71-78` schreibt
  Info.plist/pbxproj nur **im Runner** (`ios-release.yml:114`), nichts wird zurückcommittet.
- **Kennzeichnung:** reproduziert (Dateien, `git log`, Actions-API, `/api/status`)
- **Beschreibung:** Wahr ist `version.json`; Android liest sie direkt (`build.gradle:8-14`), iOS über
  `apply-version.sh` zur Build-Zeit. Info.plist (220) wurde zuletzt mit Commit `1075062e` angefasst,
  pbxproj (218) mit `e1db99f2` — seit Build 221 tragen die nativen Dateien im Repo einen falschen Stand.
  Die App zeigt im Profil und im Update-Hinweis `App.getInfo().version` (`utils/appVersion.ts:20-30`,
  `updateCheck.ts:53-60`), also 2.3.0 — Build-Nummern zeigt sie nicht. Crashlytics meldet „2.3.0 (230)";
  die Zuordnung zum Commit geht nur über `git log --grep 'iOS-Build 230'` — und nur, wenn der Workflow auf
  genau diesem Commit gestartet wurde. Gegenbeispiel aus der Historie: iOS-Build 228 wurde aus `f7e662d3`
  gebaut (Lauf 114), nicht aus dem Commit „chore(release): iOS-Build 228" (`2c00633b`, CI rot). Kein Tag,
  kein Release-Eintrag, kein Commit-SHA in der App verbindet Build und Quelle.
- **Auswirkung aus Nutzersicht:** Indirekt: Bei einem Absturzbericht „2.3.0 (230)" muss geraten werden,
  welcher Code lief; Support-Anfragen („welche Version hast du?") liefern nur 2.3.0, keinen Build.
- **Beleg:** `git log -1 -- frontend/ios/App/App/Info.plist` → `1075062e chore(release): iOS-Build 220`;
  `git log -1 -- …/project.pbxproj` → `e1db99f2` (kein Release-Commit); `curl /api/status` →
  `"version":"1.0.1","commit":"fce1ab01…"`; Actions-Lauf 114 (`head_sha f7e662d3`, Commit-Message
  „fix(ci): Privacy-Manifest-Test …") lieferte den Build, den `version.json` als 228 führt.
- **Empfehlung:** Nach erfolgreichem Upload im Release-Workflow ein Git-Tag `2.3.0-ios230` / `2.3.0-and124`
  auf den gebauten SHA setzen (oder `gh release create`), `GIT_SHA` als `VITE_GIT_SHA` in den Web-Build
  einbetten und im Profil unter der Version anzeigen; `apply-version.sh` einmal lokal laufen lassen und die
  nativen Dateien committen, damit das Repo nicht lügt; `package.json`-Versionen auf `version.json` ziehen
  oder als „nicht gepflegt" markieren; `v`-Tags entfernen.

### BF-10: Notfall-Deploy wurde nie ausgeführt — der Rückrollweg ist ungeprobt
- **Schwere:** NIEDRIG
- **Fundstelle:** `.github/workflows/notfall-deploy.yml` (gesamt), `:34-35` (`permissions: contents: read`,
  kein `packages: read`), `:65-68` (`docker login ghcr.io` + `docker manifest inspect`).
- **Kennzeichnung:** reproduziert (Actions-API: `total_count: 0` für `notfall-deploy.yml`)
- **Beschreibung:** Der einzige schnelle Rollback-/Hotfix-Weg (Image-Tag zurückdrehen) ist seit seiner
  Einführung nie gelaufen. Die Vorprüfung per `docker manifest inspect` funktioniert nur, weil die
  ghcr-Pakete öffentlich sind (anonymer `manifest inspect` geprüft: OK) — mit `contents: read` allein hätte
  der Token kein `packages: read`. Der Rollback dreht nur Code zurück; Migrationen bleiben (additiv laut
  `CLAUDE.md`, daher tragbar, aber nirgends als Rollback-Prozedur beschrieben).
- **Auswirkung aus Nutzersicht:** Im Ernstfall verlängert ein scheiternder Notfall-Workflow die Störung.
- **Beleg:** `list_workflow_runs notfall-deploy.yml` → `{"total_count":0,"workflow_runs":[]}`.
- **Empfehlung:** Einmal bewusst mit dem aktuellen `main`-Tag proben (idempotent), `permissions:
  packages: read` ergänzen, Rollback-Ablauf inkl. Migrationsfrage kurz in `deploy/` dokumentieren.

### BF-11: E2E-Job auf Node 20 (EOL) und Actions v4; Produktions-Image auf Node 26 (kein LTS)
- **Schwere:** NIEDRIG
- **Fundstelle:** `.github/workflows/ci.yml:243-247` (`actions/checkout@v4`, `setup-node@v4`,
  `node-version: '20'`) gegenüber `:92-97` (`@v7`, Node 26); `backend/Dockerfile:1` (`node:26-bookworm`);
  `backend/package.json` (`engines.node >=22`); Umgebung lokal Node 22.
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Node 20 hat laut Node.js-Release-Plan am 30.04.2026 das Ende der Wartung erreicht; der
  E2E-Job läuft weiter darauf. Das Backend läuft in Produktion auf Node 26, das laut Release-Plan erst im
  Oktober 2026 LTS wird; getestet wird lokal mit 22, in CI mit 26, `engines` erlaubt ab 22. Drei Fassungen.
- **Auswirkung aus Nutzersicht:** Keine direkte.
- **Beleg:** Zeilen wie angegeben; `docker inspect … NODE_VERSION=26.10.0`.
- **Empfehlung:** Eine LTS-Fassung (24) überall: `.nvmrc`, CI, Dockerfile, `engines`; Actions einheitlich.

### BF-12: `npm audit` im Frontend nicht blockierend, `--passWithNoTests` in beiden Test-Jobs
- **Schwere:** NIEDRIG
- **Status:** behoben 26.09.2026 — `|| true` gestrichen, beide Audit-Schritte auf `--audit-level=high` (lokal gemessen: Backend 0 Schwachstellen, Frontend 3 moderate → beide Exit 0); `--passWithNoTests` in beiden Test-Jobs entfernt (Vitest 4.1.11 endet ohne gefundene Tests mit Exit 1, für beide Konfigurationen geprüft; das Frontend findet 264, das Backend 139 Testdateien).
- **Fundstelle:** `.github/workflows/ci.yml:226` (`npm audit --audit-level=critical || true`), `:116` und
  `:230` (`--passWithNoTests`).
- **Kennzeichnung:** reproduziert (`npm audit` lokal)
- **Beschreibung:** Heute ohne Folge: Backend 0 Schwachstellen, Frontend 3 moderate (react-router-dom), 0
  kritisch — der Schritt wäre auch ohne `|| true` grün. `--passWithNoTests` macht einen Job grün, wenn das
  Include-Muster einmal nichts mehr findet (z. B. nach einem Umzug der Tests).
- **Auswirkung aus Nutzersicht:** Keine direkte.
- **Beleg:** `npm audit --audit-level=critical` Backend → `found 0 vulnerabilities`, Frontend → Exit 0,
  Gesamt „3 moderate severity vulnerabilities".
- **Empfehlung:** `|| true` streichen; `--passWithNoTests` entfernen und stattdessen eine Mindestzahl
  Testdateien prüfen.

### BF-13: `sitemap.xml` wird aus Datei-Änderungszeiten erzeugt — nicht reproduzierbar und vom Frischecheck nicht erfasst
- **Schwere:** NIEDRIG
- **Fundstelle:** `scripts/build-handbuch.mjs:699-705` (`statSync(...).mtime`), `:714,741-743`;
  `.github/workflows/ci.yml:215-216` (Check nur `frontend/public/docs/`, nicht `frontend/public/sitemap.xml`).
- **Kennzeichnung:** reproduziert (Generatorlauf + `git diff`)
- **Beschreibung:** Ein frischer Checkout hat für alle Quelldateien dieselbe mtime → jeder CI-Lauf schreibt
  „heute" in zehn `lastmod`-Einträge; lokal steht das Datum der letzten lokalen Bearbeitung. Die eingecheckte
  Datei hängt also davon ab, wer sie zuletzt erzeugt hat, und der CI-Check sieht die Datei nicht.
- **Auswirkung aus Nutzersicht:** Keine (Suchmaschinen bekommen falsche Änderungsdaten).
- **Beleg:** Nach `node scripts/build-handbuch.mjs`: `git diff --stat -- frontend/public/` →
  `frontend/public/sitemap.xml | 20 ++++++++++----------`, z. B. `docs/start.html` `2026-09-08 → 2026-09-26`.
  API-Referenz, OpenAPI und Handbuch-Seiten: **keine** Abweichung.
- **Empfehlung:** `lastmod` aus `git log -1 --format=%cs -- <quelle>` statt mtime; `sitemap.xml` in den
  Frischecheck aufnehmen.

### BF-14: Web-Frontend ohne CSP/Referrer-Policy/Permissions-Policy; veralteter `X-XSS-Protection`
- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/nginx.conf:33-36,96-102,105-111,114-116`.
- **Kennzeichnung:** reproduziert (`curl -I https://konfi-quest.de/login`)
- **Beschreibung:** Die HTML-Antworten tragen `X-Frame-Options`, `nosniff`, `X-XSS-Protection: 1; mode=block`
  (von Browsern nicht mehr ausgewertet, kann in alten Browsern Lücken öffnen) und HSTS (von der Kante). Es
  fehlen `Content-Security-Policy`, `Referrer-Policy`, `Permissions-Policy`. Das Backend setzt über Helmet eine
  strikte CSP (`/api/status`: `default-src 'self'; script-src 'none' …`, `x-xss-protection: 0`) — die Web-App
  selbst nicht.
- **Auswirkung aus Nutzersicht:** Keine direkte; Schutztiefe bei XSS in der Web-App geringer.
- **Beleg:** Header von `/login`: `x-frame-options: SAMEORIGIN`, `x-content-type-options: nosniff`,
  `x-xss-protection: 1; mode=block`, `strict-transport-security: …`; kein `content-security-policy`.
- **Empfehlung:** Eine mit Ionic/Vite verträgliche CSP (Report-Only zuerst), `Referrer-Policy:
  strict-origin-when-cross-origin`, `Permissions-Policy` (Kamera nur `self`), `X-XSS-Protection` entfernen.

### BF-15: Hygiene in Workflows und Deploy-Referenz (Sammelbefund)
- **Schwere:** NIEDRIG
- **Fundstelle:** alle `uses:` in `.github/workflows/*.yml` (Tag-Pinning `@v7`/`@v4`, kein SHA);
  `test-backend.yml:22` (`default: 'feat/ionic-9'`, Branch längst gemergt — Lauf 7 vom 01.09.2026);
  `frontend.yml:4-5` (manueller Deploy ohne Tests, mit Portainer-Zugriff, aus jedem Branch; zuletzt
  03.08.2026 genutzt); `deploy/compose.konfi_quest.yml:1` (`version: '3.8'` ist in Compose v2 wirkungslos);
  `ci.yml:360-366` (Kommentar vom 02.09.: „Datenbank trägt bereits ALLE 72 Migrationen; ein Live-Deploy
  führt keine Migration mehr aus" — heute 89 Migrationsdateien, 36 jünger als der Schema-Dump; Deploys
  führen Migrationen aus, wie es `database.js` vorsieht); `docs/offene-befunde.md:429-437` (#12 „IN
  ARBEIT", tatsächlich erledigt — siehe „Alte Befunde"); `frontend/ios/App/App/Info.plist:71-74`
  (`UIRequiredDeviceCapabilities: armv7` bei Deployment-Target 16.4, Altlast).
- **Kennzeichnung:** aus Code gelesen; Nutzungsdaten reproduziert (Actions-API)
- **Beschreibung:** Einzeln folgenlos, zusammen Pflegeaufwand und Fehlerquellen.
- **Auswirkung aus Nutzersicht:** Keine.
- **Beleg:** `list_workflow_runs test-backend.yml` → 9 Läufe, letzter 02.09.2026; `frontend.yml` → 51 Läufe,
  letzter 03.08.2026; `ls backend/migrations/*.sql | wc -l` → 89; `wc -l prod-migrations.txt` → 53.
- **Empfehlung:** Actions per SHA pinnen (Dependabot aktualisiert sie ohnehin), `frontend.yml` löschen oder
  gaten, Default-Branch entfernen, `version:`-Zeile streichen, veraltete Kommentare korrigieren.

### BF-16: Play-Upload veröffentlicht sofort zu 100 %; Track-Namen ungeprüft
- **Schwere:** NIEDRIG
- **Fundstelle:** `.github/scripts/upload-play.py:107-113` (`"status": "completed"`, `TRACKS.split(",")`
  ohne `strip()`/Prüfung).
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Bei 10.000+ Installationen bekommt ein Fehler in einem Production-Release sofort alle.
  Google bietet `status: inProgress` mit `userFraction` (gestaffelt). Ein Tippfehler wie `internal, alpha`
  (Leerzeichen) erzeugt einen 404 auf `/tracks/ alpha` — der Edit wird verworfen, kein Schaden, aber ein
  verlorener Build-Lauf.
- **Auswirkung aus Nutzersicht:** Ein fehlerhaftes Update erreicht alle Android-Nutzer:innen gleichzeitig.
- **Beleg:** Codezeilen wie angegeben.
- **Empfehlung:** Für `production` `status: inProgress`, `userFraction: 0.1` als Voreinstellung; Tracks
  trimmen und gegen eine Positivliste (`internal`, `alpha`, `beta`, `production`) prüfen.

### BF-17: `paths:`-Filter der CI lässt Wurzel-`package.json`/`package-lock.json` (E2E-Abhängigkeiten) aus
- **Schwere:** NIEDRIG
- **Fundstelle:** `.github/workflows/ci.yml:7-25`.
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Der E2E-Job installiert aus der Wurzel (`npm ci`, `ci.yml:251`; `package.json` mit
  `@playwright/test`, `pg`). Eine Änderung nur dort (Dependabot-PR für `@playwright/test` nach Merge) löst
  keinen `push`-Lauf aus — dieselbe Fehlerklasse, die der Kommentar in `ci.yml:12-25` für `scripts/` und
  `e2e/` bereits zweimal beschreibt. `deploy/` und `.github/scripts/` fehlen ebenfalls, sind aber nicht
  laufzeitrelevant für `ci.yml`.
- **Auswirkung aus Nutzersicht:** Keine direkte.
- **Beleg:** Dateiliste im Filter.
- **Empfehlung:** `package.json`, `package-lock.json` (Wurzel) ergänzen — oder den Filter für `push` auf
  `main` ganz weglassen (Kosten: ein Lauf pro Doku-Commit).

### BF-18: Kamera-Berechtigungstext auf iOS nennt den QR-Scanner nicht
- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/ios/App/App/Info.plist:31-32` („… um Fotos für Chat-Nachrichten und
  Challenge-Beiträge aufzunehmen"), Nutzung durch `frontend/src/components/konfi/modals/QRScannerModal.tsx`
  (`qr-scanner`, Termin-Check-in); Android begründet die Kamera umgekehrt nur mit dem Scanner
  (`AndroidManifest.xml:111-114`).
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Apple verlangt (Guideline 5.1.1), dass der Zweck vollständig und verständlich ist. Ein
  Konfi, der beim Check-in erstmals die Kamerafrage sieht, liest „Fotos für Chat-Nachrichten" — passt nicht
  zur Situation. Übrige Texte (Fotos, Mikrofon, Dokumente, Face ID) sind deutsch, klar und passend.
- **Auswirkung aus Nutzersicht:** Verwirrung beim ersten Check-in; geringes Review-Risiko.
- **Beleg:** Zeilen wie angegeben.
- **Empfehlung:** „… um QR-Codes beim Check-in zu scannen und Fotos für Chat und Challenges aufzunehmen."

## Unklar

- **App-Icon mit Alphakanal.** `Assets.xcassets/AppIcon.appiconset/kq.png` ist 1024×1024 RGBA
  (PNG-Farbtyp 6). App Store Connect lehnt Marketing-Icons mit Transparenz ab (ITMS-90717). Die Uploads
  221–230 liefen durch — entweder ist der Kanal vollständig deckend und Xcode entfernt ihn, oder ASC hat
  gewarnt. Zu klären in App Store Connect (Build-Verarbeitung, Warnungen).
- **`aps-environment = development` in `App.entitlements`.** Xcode ersetzt den Wert beim Export mit
  App-Store-Profil nach gängiger Dokumentation durch `production`; Produktions-Push funktioniert laut
  Historie (Push-Ausfall betraf nur Android). Am IPA nicht geprüft (`codesign -d --entitlements`).
- **`UIBackgroundModes: fetch`.** `AppContext.tsx` nutzt `@capawesome/capacitor-background-task`
  (Hintergrundzeit beim Wechsel), was den Modus `fetch` nicht braucht. Ob `fetch` irgendwo genutzt wird,
  war nicht feststellbar; Apple prüft ungenutzte Modi gelegentlich.
- **`UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` = true.** Der Documents-Ordner der App
  ist in der Dateien-App sichtbar. `MaterialFormModal.tsx:218-228` und `chatTeilen.ts:41-47` schreiben
  temporär nach `Directory.Documents`. Ob dort Chat-Anhänge liegen bleiben (auch bei aktiver App-Sperre
  sichtbar), war ohne Gerät nicht prüfbar.
- **Test-Deadlocks in der CI.** Zwei rote `backend-test`-Läufe (931, 938) zeigen `deadlock detected`
  zwischen `truncateAll` und Zähler-Abfragen (`events`/`activity_requests`/`challenge_submissions`), die
  offenbar aus einem vorigen Test noch liefen. Sieht nach systematischem Flattern aus; gehört zum
  Test-Bereich, hier nur als Beobachtung.
- **Sicherheit der Firebase-Client-Schlüssel.** `frontend/config/google-services.json` und
  `GoogleService-Info.plist` sind Client-Konfigurationen (öffentlich per Design). Ob die beiden
  API-Schlüssel in der Google-Cloud-Konsole auf Paket/Bundle beschränkt sind, ist nur dort prüfbar.

## Alte Befunde nachgeprüft

- **#2 Sicherheitsmeldungen zu react-router (07.09.2026) — „trifft uns nicht":** heute `npm audit` im
  Frontend: 3 moderate (`react-router-dom`), 0 hoch/kritisch. Das CI-Gate (`--audit-level=critical`) wäre
  auch ohne `|| true` grün. Stand: **unverändert**, Bewertung nicht widerlegt (inhaltliche Prüfung nicht
  mein Bereich).
- **#3 Nächtlicher Datenbank-Dump war leer (10.09.2026) — BEHOBEN:** **nicht prüfbar.** Sicherungsskript
  und Überwachung liegen außerhalb des Repos (laut `CLAUDE.md` gewollt). Im Repo existiert keine
  Beschreibung, wie eine Wiederherstellung abläuft. Siehe „Auf Produktion nachzumessen".
- **#12 init-scripts weicht vom Produktionsschema ab (16.09.2026) — „IN ARBEIT":** **faktisch behoben,
  Doku veraltet.** `init-scripts/01-create-schema.sql` ist ab Zeile 17 byte-gleich mit
  `backend/tests/schema/prod-schema.sql` (`diff` → 0 Zeilen), `02-migrationsstand.sql` führt 53 = 53
  Migrationen, `init-scripts/refresh.sh` erzeugt beides, `backend/tests/schema/neuinstallation.test.js`
  wacht darüber. Der Eintrag in `docs/offene-befunde.md:429-437` sollte als behoben markiert werden.
- **Datierter Kommentar `ci.yml:360-366` (02.09.2026)** „Datenbank trägt bereits ALLE 72 Migrationen … ein
  Live-Deploy führt keine Migration mehr aus": **veraltet.** 89 Migrationsdateien im Repo; Deploys führen
  neue Migrationen automatisch aus (`database.js:76-104`, mit Advisory-Lock).
- **`deploy/rolling-deploy.sh` (21.06.2026) „NOCH NICHT IM CI AKTIV":** **weiter offen** (BF-05).
- **`android-release.yml:10-20` (15.09.2026) versehentlicher Production-Release:** Vorgabe steht heute auf
  `internal,alpha` (`:27`) — **behoben bestätigt**.

## Geprüft und in Ordnung

- **Versionsquelle:** `version.json` wird von Android direkt gelesen (`build.gradle:8-14`) und für iOS mit
  Nachprüfung geschrieben (`apply-version.sh:71-99`); Formatprüfung vor dem Schreiben. Gelesen.
- **iOS-Signierung:** Release-Konfiguration manuell mit festem Profil (`project.pbxproj:434-438`), Profil
  per ASC-API geholt (`ios-release.yml:139-195`), kein `-allowProvisioningUpdates`, Keychain temporär,
  `manageAppVersionAndBuildNumber=false`. Gelesen.
- **iOS-Firebase/Crashlytics-Absicherung:** `prepare-ios.sh` prüft Projekt-ID, Bundle-ID, Resources-Phase,
  Pod installiert (Manifest.lock = Podfile.lock), dSYM-Phase, `dwarf-with-dsym`, Swift-Import; zweiter
  dSYM-Upload im Workflow. Gelesen.
- **iOS-Manifeste:** Info.plist, PrivacyInfo.xcprivacy, App.entitlements, GoogleService-Info.plist sind
  gültige Plists (`plistlib`). `NSPrivacyTracking=false`, keine Tracking-Domains, Required-Reason-APIs
  `CA92.1`/`C617.1` begründet, Datentypen passen zu `services/analytics.ts` (Umami ohne Nutzer-ID) und
  Push-Token; Test `privacyManifest.test.ts` läuft ohne `plutil`. `ITSAppUsesNonExemptEncryption=false`
  (nur HTTPS). Deployment-Target 16.4 (Podfile und pbxproj). Kein Drittanbieter-Login im Code (`grep`
  nach `signInWith|OAuth|GoogleAuth` leer) → Sign in with Apple nicht erforderlich. Gelesen/ausgeführt.
- **Store-Text-Plattformcheck** (`ios-release.yml:41-71`) funktioniert für vorhandene Dateien. Gelesen.
- **Android Store-Reife:** `compileSdk`/`targetSdk` 36 (`variables.gradle:3-4`; Play verlangt für Updates
  seit 31.08.2026 Ziel-API 36), `minSdk` 24; `android:exported` gesetzt; `allowBackup=false` +
  `data_extraction_rules.xml` schließt Cloud-Backup und Gerätewechsel vollständig aus; kein Klartext
  (`androidScheme: 'https'`, keine `usesCleartextTraffic`); Berechtigungen nur `INTERNET`,
  `POST_NOTIFICATIONS`, `USE_BIOMETRIC`, `CAMERA`, Hardware als `required=false`; App Links mit
  `autoVerify`, `assetlinks.json` live `200 application/json` mit zwei Fingerabdrücken, Test
  `appLinksAndroid.test.ts` koppelt Manifest, Code und Datei; R8 mit Keep-Regeln, Zeilennummern und
  Mapping-Upload; signiertes AAB aus Secrets; `FLAG_SECURE` nur bei aktiver App-Sperre. Gelesen/gemessen.
- **Play-Upload:** Vorgabe nur Testkanäle, Dry-Run verwirft den Edit, Fehlerkörper werden geloggt, Edit wird
  im Fehlerfall gelöscht, Notizlänge geprüft (aktuell 489/500 Zeichen). Gelesen.
- **Firebase-Client-Konfigurationen** in `frontend/config/` sind Client-Dateien; der geheime
  Service-Account `backend/push/firebase-service-account.json` ist ignoriert (`git check-ignore` →
  `.gitignore:114`), ebenso `.env`, `uploads/`, `deploy/.env`. `deploy/.env.example` ohne Werte. Gemessen.
- **Secrets im Compose:** alle Pflichtwerte mit `${VAR:?…}`; `no-new-privileges`, Log-Rotation 3×10 MB je
  Dienst, Healthchecks, `stop_grace_period 30s`, Traefik-Healthcheck routet nur zu gesunden Replicas. Gelesen.
- **Migrationen bei zwei Replicas:** `pg_advisory_lock(723001)` auf dedizierter Verbindung, Lesen von
  `schema_migrations` erst nach dem Lock, jede Migration in einer Transaktion samt Eintrag
  (`database.js:74-141`). Gelesen.
- **Deploy-Mechanik:** unveränderliche SHA-Tags (`type=sha,prefix=`), Diff über den gesamten Push-Bereich
  (`github.event.before`), 3 Runden, Verify gegen `/api/status` (`checks.database == ok` und `commit ==
  GIT_SHA`). Live gemessen: `/api/status` meldet `commit: fce1ab01…` = aktueller `main`-HEAD, `database: ok`.
- **ghcr-Images öffentlich lesbar:** anonymer `docker manifest inspect` auf `…-backend:latest` und
  `…:test-latest` erfolgreich → `notfall-deploy` kann trotz fehlendem `packages: read` prüfen. Gemessen.
- **Frontend-Build:** `tsc && vite build` Exit 0 in 17,1 s; 219 JS-Chunks; größte: `icons` 1.391,83 kB
  (gzip 305,64 kB), `index` 423,25 kB (gzip 123,44 kB), `index.css` 356,78 kB (gzip 42,57 kB); eine
  Vite-Warnung „chunks larger than 500 kB" (icons). `dist` 43 MB, davon 33 MB Handbuch (30 MB Bilder),
  8,5 MB Assets. API-Basis im Store-Build: `VITE_API_URL` leer → `https://konfi-quest.de/api`
  (`api.ts:8`), der iOS-Workflow bricht bei gesetztem Wert ab (`ios-release.yml:80-95`); im deployten
  Frontend-Image nur `konfi-quest.de/api`, kein `test-api`. Gemessen.
- **Frontend-Image:** 173 MB, nginx 1.31.6, 42 MB HTML/Assets, SPA-Fallback, HTML `no-cache`, gehashte
  Assets `immutable`, gzip an, `absolute_redirect off`, `.dockerignore` schließt ios/android/node_modules/
  dist/.env aus. Gemessen/gelesen.
- **Doku-Generatoren:** API-Referenz, OpenAPI, Handbuch nach Lauf ohne Abweichung zu den eingecheckten
  Dateien (nur `sitemap.xml`, BF-13). Gemessen (1,66 s).
- **npm audit:** Backend 0, Frontend 0 kritisch (3 moderate). Gemessen.
- **Dependabot:** wöchentlich npm (drei Verzeichnisse, gruppiert), monatlich Actions und Docker-Basisimages,
  react-router-Hauptversionen begründet ausgenommen. Gelesen.
- **E2E-Gate:** `build-and-push` hängt an `backend-test`, `frontend-test`, `e2e-test` ohne `always()`
  (`ci.yml:285-290`); Läufe 931 und 938 zeigen: rote Tests → `build-and-push` und `deploy` `skipped`. Gemessen.
- **Update-Hinweis:** `/api/app-version` liefert live `2.2.0` für beide Plattformen (iTunes-Lookup, 6 h
  Cache, wirft nie); die App vergleicht gegen `App.getInfo().version` — der Hinweis erscheint erst, wenn
  Apple 2.3.0 freigegeben hat. Antwortform ist als Vertrag dokumentiert. Gemessen/gelesen.
- **Test-Backend-Schema-Wächter** (`test-backend.yml:48-59`) bricht bei neuen Migrationen im Branch ab;
  stempelt mit dem Branch-SHA. Gelesen.
- **Timeouts:** alle Jobs in `ci.yml`, beiden Release-Workflows und `notfall-deploy` haben
  `timeout-minutes`; `test-backend.yml` und `frontend.yml` nicht (kurz, manuell). Gelesen.

## Nicht geprüft

- Lokaler `docker build` des Backend-Images (Docker-Hub-Limit 429); ersetzt durch Inspektion des deployten
  Images.
- Inhalt der Portainer-Stack-Datei (nur per API mit Zugang).
- Signierte Artefakte (IPA/AAB) selbst: Entitlements im IPA, Icon nach Xcode-Verarbeitung, Play-Signatur.
- App Store Connect / Play Console: Datenschutz-Labels, Data Safety, Altersfreigabe, Kids-Category,
  Review-Warnungen — nicht im Repo.
- Die volle Backend- und Frontend-Testsuite (läuft bei der Koordination).
- Inhalt der 36 Migrationen jünger als der Schema-Dump (anderer Bereich).

## Auf Produktion nachzumessen

- **Portainer-Stack 249:** `curl -H "X-API-Key: …" $P_URL/api/stacks/249/file | jq -r .StackFileContent |
  grep image:` — steht `backend-test` auf `test-latest` oder auf dem Live-SHA? (BF-03)
- **Deploy-Lücke:** während eines Deploys `while :; do curl -s -o /dev/null -w '%{http_code}\n'
  https://konfi-quest.de/api/health; sleep 0.5; done | sort | uniq -c` — Anzahl 502/503 und Dauer. (BF-05)
- **Datenbank-Container beim Deploy neu erstellt?** `docker inspect konfi_quest-postgres-1 --format
  '{{.Created}} {{.Image}}'` gegen die letzten Deploy-Zeitpunkte; `docker image ls postgres:15-alpine
  --digests`. (BF-05)
- **Ressourcen:** `docker stats --no-stream` (Postgres-Limit 1 GB / 0,3 CPU), `SELECT count(*) FROM
  pg_stat_activity;`, Cache-Hit-Ratio `SELECT sum(blks_hit)/(sum(blks_hit)+sum(blks_read)) FROM
  pg_stat_database;`, `max_connections` vs. 3 × Pool 20.
- **Backups:** Alter und Größe des letzten Dumps (`ls -la`), Rückspielprobe in eine Wegwerf-Datenbank,
  Prüfung der Überwachung aus `offene-befunde.md #3`.
- **Migrationsstand:** `SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 5;` — steht `159_…`?
- **Node/Postgres-Fassungen live:** `docker exec … node -v`, `SELECT version();`.
- **App Store Connect:** Warnungen zu Build 230 (Icon-Alphakanal ITMS-90717, ungenutzte Background-Modes),
  „App-Datenschutz"-Angaben gegen PrivacyInfo (Umami, Crashlytics, Push-Token), Altersfreigabe.
- **Play Console:** Data-Safety-Formular gegen tatsächliche Erhebung; Ziel-API-Hinweise; Crashlytics
  zeigt für versionCode 124 lesbare Stapel (Mapping-Upload wirksam)?
- **Firebase/Google Cloud:** Anwendungsbeschränkungen der beiden Client-API-Schlüssel.
- **ghcr:** Anzahl und Alter der Tags (Aufräumregel? jeder Push erzeugt zwei Images).
