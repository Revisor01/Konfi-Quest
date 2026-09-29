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

*Überholt — siehe „Stand 27.09.2026 (vor dem Merge von 2.3.0)" unten.* **Mit Auflage.** Der Server-Deploy ist freigabefähig. Für die Store-Einreichung 2.3.0 gilt als Auflage:
(1) Vor der Freigabe in den Production-Track und der App-Store-Einreichung nachweisen, dass der CI-Lauf
**des exakt gebauten Commits** (`fce1ab01`, CI-Lauf 948 — grün) grün ist; für die nächsten Builds den
Release-Workflows ein Gate geben (Ref-Prüfung auf `main` + Warten auf grünen CI-Lauf desselben SHA).
(2) `docs/store-texte-2.3.0.md` anlegen, damit der Plattform-Check des iOS-Workflows überhaupt etwas
prüft. (3) `apple-app-site-association` entweder mit Team-ID `J459G9CJT5` und passendem Entitlement
richtig machen oder bis dahin entfernen.

**Stand 27.09.2026 (vor dem Merge von 2.3.0):** Von den drei Auflagen sind zwei erfüllt — Release-Tor (BF-01) und `docs/store-texte-2.3.0.md` (BF-08); die AASA-Datei (BF-02) trägt weiter den Platzhalter, Entscheidung Simon. Von 18 Befunden sind 4 behoben (BF-01, BF-03, BF-08, BF-12), 5 teilweise behoben (BF-04, BF-05, BF-07, BF-09, MITTEL, für 2.3.x vorgemerkt; BF-15) und 9 offen (BF-02 und BF-06, MITTEL; BF-10, BF-11, BF-13, BF-14, BF-16, BF-17, BF-18, NIEDRIG). Kein HOCH- oder KRITISCH-Befund ist offen. Neu aus der Prüfung vor dem Merge: `.github/scripts/release-gate.py` und `deploy/rollend.sh` haben keine Tests (beide nur lokal mit Nachbauten geprüft) — offen, für 2.3.x vorgemerkt. Die übrigen Reste stehen als Auftrag in `docs/auftraege/lokaler-agent/04-ci.md`.

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
- **Status:** behoben 29.09.2026 (die Datei) — `apple-app-site-association` trägt statt `TEAMID` die App aus dem Xcode-Projekt (`J459G9CJT5.de.godsapp.konfiquest`, Format `appIDs`/`components`), die Pfade `/login*`, `/register*`, `/reset-password*` wie die Android-App-Links (`utils/deepLinks.ts`), `webcredentials` mit derselben App; nginx liefert sie mit `default_type application/json` (lokal mit `nginx:alpine` gemessen: vorher `application/octet-stream`, jetzt `200 application/json`, keine Umleitung). Wächter `frontend/src/__tests__/navigation/appLinksIos.test.ts` (7 Fälle, mit der alten Datei und nginx.conf 5 rot) koppelt Datei, Xcode-Projekt, Pfadliste und nginx; trägt die App einmal Associated Domains, prüft er auch deren Hosts. Weiter bei Simon: das Entitlement `applinks:konfi-quest.de` (Universal Links einschalten) — ohne es fragt kein iPhone die Datei ab; der Code leitet Universal Links schon heute weiter (`SceneDelegate` → `appUrlOpen` → `deepLinkZiel`).
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
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** Der Ort in der Status-Zeile stimmt nicht mehr: Der Tag-Rewrite steht nicht in `ci.yml`, sondern in `deploy/rollend.sh` (`schreibe_tags`, aus dem Deploy-Job gerufen, `ee996132`) und in `notfall-deploy.yml` — dort ebenfalls auf die Live-Dienste begrenzt, samt Gegenprobe auf `backend-test` (`02bf4045`); „nicht angefasst" ist überholt. Beide Wege schicken die Stack-Variablen seit `6cd0d52d` unverändert zurück. Liegt bei Simon/Betrieb: `backend-test` steht im Live-Stack noch auf dem Live-SHA `fce1ab0` (vor dem Deploy gemessen, Auftrag `01-vor-dem-deploy.md`, Nr. 7) — in Portainer auf `test-latest` zurückstellen oder über `test-backend.yml` neu setzen.
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
- **Status:** behoben 29.09.2026 — `deploy/rollend.sh` prüft vor dem Tausch (`NUR_VORWAERTS=1`, nur im CI-Deploy): Nennen alle Abfragen von `/api/status` denselben Commit, liegt er im Verlauf (`fetch-depth: 0`) und ist `GIT_SHA` sein Vorfahre, endet der Lauf grün mit `::notice::Deploy uebersprungen` und Eintrag in der Zusammenfassung, statt zurückzurollen; in jedem Zweifelsfall (Status nicht erreichbar, uneinheitliche Antworten, Commit unbekannt, älter, abgezweigt, gleich) wird wie bisher ausgerollt. Der Notfall-Deploy setzt den Schalter nicht und darf zurückrollen. `ci.yml` bricht überholte Läufe auf Nicht-`main`-Refs ab (`concurrency` je Ref, `cancel-in-progress` nur außerhalb von `main`; auf `main` eine Gruppe je SHA, also kein Abbruch und keine Warteschlange). Geprüft mit `frontend/src/__tests__/betrieb/rollenderDeploy.test.ts` gegen eine nachgebaute Portainer-API und die Referenz-Compose (11 Fälle, 15 s): Gegenprobe ohne Prüfung → 6 rot, Gegenprobe „überspringen ohne Vorfahren-Prüfung" → 2 rot, darunter der Normalfall (so eine Bedingung hätte den Deploy still verhindert). actionlint 1.7.12 ohne neue Meldung. Der erste echte Überholfall ist erst auf GitHub zu sehen (Hinweis im Deploy-Job).
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** Stand bestätigt: serialisiert ja, Prüfung gegen den jüngsten erfolgreichen Lauf auf `main` nein; für 2.3.x vorgemerkt (Auftrag `04-ci.md`, Abschnitt 1).
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
- **Status:** Ursache belegt, bleibt offen 29.09.2026 — der erste echte rollende Deploy (29.09.2026, Deploy von `beb745e`, Actions-Lauf 992, Job `deploy`) meldet im Log `##[warning] backend2 wurde in Stufe 1 mit neu erstellt (dc77245dea49 -> a0cc6e395efb)`: Portainers `update_stack` (mit `pullImage: true`) erstellt auch unveränderte Dienste neu, beide Backends waren in Stufe 1 zugleich im Tausch — die Lücke besteht weiter. Zeiten aus dem Log: Stufe 1 von `update_stack` bis „neues backend healthy" 27 s, davon 13–20 s im Zustand `created` (erstellt, nicht gestartet); Stufe 2 dasselbe, 28 s. Das lange `created` passt zu `depends_on: postgres: condition: service_healthy` und damit zu einem **bei jedem Deploy neu erstellten Postgres** — nicht belegt, weil ohne Serverzugriff. Die Lücke selbst (Antworten ≠ 200 von außen) ist nicht gemessen. Nicht geändert: Ein anderer Aufruf von Portainer (Image vorab ziehen, `pullImage: false`) ist von hier nicht prüfbar, ein blinder Umbau des Produktions-Deploys wäre nicht sicher. Messweg, Portainer-Probe und das Festhalten von Postgres per Digest: Auftrag `docs/auftraege/lokaler-agent/10-deploy-luecke.md`; der Kommentar in `deploy/rollend.sh` nennt den Stand.
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
- **Status:** teilweise behoben 29.09.2026 — `backend/Dockerfile` baut in zwei Stufen: `npm ci --omit=dev` aus dem Lockfile im Vollimage, Laufzeit auf `node:*-bookworm-slim` ohne Compiler, python, git und psql; `backend/.dockerignore` hält `tests/` (samt `prod-schema.sql`), `*.md`, `docker-compose.test.yml`, `.env*`, `uploads/`, `push/*.json` und `node_modules` heraus. Lokal am selben Commit gemessen: `docker images` 1,92 GB → 486 MB, komprimiert 478,8 MB → 104,4 MB, `node_modules` 319 Einträge/142 MB → 251/98 MB, `tests/` 253 Dateien → 0; das neue Image startet gegen eine Test-Datenbank (49 Migrationen, `checks.migrations: ok`), beide Healthchecks (`node healthcheck.js` und `curl -f`) 200, bcrypt und node-fetch laden. curl bleibt im Image, weil der Stack die Backends mit curl prüft (sonst wäre jeder neue Container `unhealthy` und `deploy/rollend.sh` bräche ab). Wächter `frontend/src/__tests__/betrieb/backendImage.test.ts` (10 Fälle; mit dem alten Dockerfile 7 rot, ohne curl-Zeile bzw. mit node-fetch als Dev-Paket je 1 rot). **Offen:** der Prozess läuft weiter als root — lokal nachgewiesen, dass `--user node` gegen ein Volume mit root-Dateien Uploads (`EACCES`) und den Firebase-Schlüssel (0600) bricht, während `/api/health` grün bleibt; Umstellung samt Healthcheck ohne curl als Auftrag `docs/auftraege/lokaler-agent/09-backend-container.md`.
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
- **Status:** bleibt offen 29.09.2026 — der technische Teil ist seit dem 26.09. behoben (Typprüfung und Web-Build im Test-Job, auf `main` seither wirksam: Lauf 992 „Typpruefung und Web-Build" grün in 9 s); offen ist allein die aktive Meldung bei rotem `main`. Das Ziel (Mail, Push, Issue) entscheidet Simon (Auftrag `04-ci.md`, Abschnitt 2); ohne diese Entscheidung ist nichts eingebaut. Hinweis: Ein Issue über `gh issue create` bräuchte kein Geheimnis (nur `issues: write`), wäre aber öffentlich sichtbar.
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** Stand bestätigt; die aktive Meldung bei rotem `main` fehlt, für 2.3.x vorgemerkt (Auftrag `04-ci.md`, Abschnitt 2).
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
- **Status:** teilweise behoben 26.09.2026 — `docs/store-texte-2.3.0.md` angelegt, `frontend/release-notes-de.txt` trägt jetzt Postfach/Glocke, Mitteilungs-Auswahl und die Push-Reparatur (437 Zeichen); die doppelten CHANGELOG-Abschnitte führt die Koordination zum Schluss zusammen, weil mehrere Pakete parallel in den Unreleased-Block schreiben.
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** behoben — `docs/store-texte-2.3.0.md` liegt vor, der CHANGELOG-Block ist zusammengeführt (`e4c940df`). Rest: Die Datei nennt Android versionCode 124 und iOS-Build 230, `frontend/version.json` steht auf 125 und 231 — vor dem Store-Upload angleichen.
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
- **Status:** teilweise behoben 29.09.2026 — `scripts/version-setzen.mjs` zieht jetzt auch `CFBundleShortVersionString` und `CFBundleVersion` in der Info.plist sowie `CURRENT_PROJECT_VERSION` im Xcode-Projekt an `frontend/version.json` heran (dieselben Ersetzungen wie `apply-version.sh` im Runner), `version:pruefen` prüft die Build-Nummer mit: vorher 2 Abweichungen (Info.plist 220, pbxproj 218 statt 234), jetzt 0; die Repo-Dateien sind auf 234 gezogen. Test `versionsnummernEineQuelle` (15 Stellen statt 12, dazu `version:setzen` an einer Kopie; mit altem Skript 2 rot, mit Info.plist 220 1 rot). **Offen, bei Simon:** ein Git-Tag je Store-Upload aus den Release-Workflows (Schema festlegen, z. B. `2.3.0+ios.234`/`2.3.0+android.128` — Build-Metadaten nach Semantic Versioning, sortieren nicht vor `2.3.0` wie `2.3.0-ios234` es täte; die Regel „Git-Tags" in CLAUDE.md wäre zu ergänzen) und ob der Commit-SHA in den Web-Build und die Absturzdiagnose soll. Heute verbindet den Store-Build und seinen Commit nur der Actions-Lauf (`head_sha`), der jetzt durch das Release-Tor zwingend der geprüfte `main`-Commit ist.
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** Stand bestätigt: `Info.plist` trägt weiter Build 220 (`CFBundleVersion`), `project.pbxproj` 218, `frontend/version.json` 231; der Git-Tag je Store-Upload fehlt. Für 2.3.x vorgemerkt (Auftrag `04-ci.md`, Abschnitt 3).
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
- **Status:** teilweise behoben 29.09.2026 — `notfall-deploy.yml` rollt über `deploy/rollend.sh` aus, dasselbe Skript wie jeder CI-Deploy (zwei Stufen statt eines `update_stack` für alle Dienste, Warten auf gesund, Verify gegen den vollen Commit, der aus dem 7-stelligen Tag über `git rev-parse` aufgelöst wird; mehrdeutig oder unbekannt → Abbruch ohne Änderung), ohne `NUR_VORWAERTS` (Zurückrollen ist der Zweck). `permissions: packages: read` ergänzt, `concurrency: deploy-production` wie der CI-Deploy, Eingaben (`grund`, Tag) über `env` statt inline ins Skript. Neue Eingabe `probelauf`: derselbe Weg bis unmittelbar vor `update_stack` (Image auf ghcr, Portainer-Zugang, Tag-Umschreibung auf einer Kopie, Gegenprobe `backend-test`, Status), ändert nichts. Geprüft in `frontend/src/__tests__/betrieb/rollenderDeploy.test.ts` gegen eine nachgebaute Portainer-API (Probelauf: 0 `update_stack`, Stack unverändert, falscher Schlüssel → Abbruch; Gegenprobe ohne Probelauf-Zweig → rot; alte Workflow-Datei → 4 rot) und actionlint (die alte Meldung SC2034 ist weg). Der Rollback-Ablauf samt Migrationsfrage steht im Kopf des Workflows. **Offen:** der erste echte Lauf auf GitHub — erst Probelauf, dann ein idempotenter Lauf mit dem aktuellen `main`-Stand (Auftrag `docs/auftraege/lokaler-agent/05-sicherung-und-notfall.md`, Abschnitt 3).
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
- **Status:** behoben 29.09.2026 — eine Node-Linie aus `.nvmrc` (neu, `24`): alle fünf `setup-node`-Schritte (drei Test-Jobs in `ci.yml`, Android- und iOS-Release) lesen `node-version-file: .nvmrc`, beide Dockerfiles bauen auf `node:24-*`, `engines` des Backends `>=24`, README nennt 24. Begründung (nodejs/Release `schedule.json`, abgerufen 29.09.2026): 24 ist Active LTS bis 20.10.2026, danach Maintenance bis 30.04.2028; 26 ist „Current" und wird erst am 28.10.2026 LTS; 20 ist seit dem 30.04.2026 ohne Updates. Der E2E-Job läuft nicht mehr auf Node 20 mit `checkout@v4`/`setup-node@v4`, sondern wie die anderen Jobs (v7), der Bericht-Upload auf `upload-artifact@v7` (v4 lief auf der Node-20-Laufzeit der Actions). Dependabot hebt die Node-Hauptversion der Images nicht mehr allein (Ignore-Regel). Vor der Umstellung auf Node 24.21.0 gemessen (Container, `npm ci` aus beiden Lockfiles mit npm 11.19.0, Test-Datenbank Postgres 16): `tsc --noEmit` und `vite build` fehlerfrei; Frontend-Suite 384 von 384 Dateien, 5070 von 5070 Tests grün; Backend-Suite 241 Dateien, 4515 von 4516 Tests grün (81 min bei Systemlast um 20). Der eine rote Fall (`kontoLoeschenWege.test.js`, „lässt auf den frei werdenden Team-Platz nachrücken": Buchung richtig nachgerückt, die Push-Attrappe aber 0-mal gerufen, kein Fehler im Protokoll) ist allein zweimal auf 24 und einmal auf 22 grün — kein Node-24-Befund, sondern ein seltener Aussetzer unter Last. Ein erster Lauf ohne die `closePool`-Korrektur (siehe „Unklar: Test-Deadlocks") hatte 67 rote Fälle in 4 Dateien, der zweite keinen davon. Backend-Image auf 24: 468 MB, startet gegen die Test-Datenbank (49 Migrationen, beide Healthchecks 200). Wächter `frontend/src/__tests__/betrieb/nodeVersionEineLinie.test.ts` (mit den alten Dateien 3 von 5 rot). Produktion wechselt mit dem nächsten Deploy von 26.10.0 auf 24.x; der Sprung auf 26 ist nach dem 28.10.2026 eine Zeile in `.nvmrc` plus die Dockerfiles (Test hält sie zusammen).
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
- **Status:** behoben 29.09.2026 — `scripts/build-handbuch.mjs` nimmt `lastmod` nicht mehr aus der Änderungszeit, sondern aus dem Inhalt: Ändert sich die erzeugte Seite gegenüber der eingecheckten, gilt der heutige Tag (Kalendertag in Berlin), sonst bleibt das eingetragene Datum; auch `/docs/` hängt jetzt an `index.html` statt immer „heute" zu tragen. Damit ist die Sitemap eine Funktion des Repo-Inhalts — unabhängig von Checkout, Rechner, flachem Klon oder Squash-Merge (der in beiden Berichten empfohlene Weg über `git log` hätte daran gehangen). Ein Lauf in ein anderes Zielverzeichnis schreibt keine Sitemap. Der Frischecheck „Handbuch aktuell?" in `ci.yml` vergleicht `frontend/public/sitemap.xml` mit. Geprüft: Generatorlauf auf dem Arbeitsstand → `sitemap.xml` unverändert; `frontend/src/__tests__/betrieb/sitemap.test.ts` (5 Fälle an einer Repo-Kopie mit frischen Änderungszeiten; mit dem alten Generator 2 rot). Die festen Seiten (Startseite, Rechtstexte) erzeugt der Generator nicht, ihr Datum bleibt wie eingetragen.
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
- **Status:** teilweise behoben 29.09.2026 — `frontend/nginx.conf` setzt in jeder Dokument-location `Referrer-Policy: strict-origin-when-cross-origin` und `Permissions-Policy: camera=(self), microphone=(self), geolocation=(), payment=(), usb=()`; `X-XSS-Protection` ist überall entfernt. Die Web-App (SPA-Rückfall) trägt eine CSP als `Content-Security-Policy-Report-Only` (`script-src 'self'` ohne `unsafe-inline`/`unsafe-eval`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'self'`; `style-src 'unsafe-inline'` für Ionic/Swiper; `connect-src` mit API und Socket auch über die volle Adresse, Umami, Schriften, `data:` und `blob:`). Statische Seiten mit eigenen Inline-Skripten (Startseite, Rechtstexte, Handbuch, API-Doku) haben eigene locations ohne diese CSP. Lokal nachgewiesen: gebautes Frontend-Image, Backend-Image und Test-Datenbank hinter einem Proxy mit einer Adresse wie in Produktion, Chromium (Playwright) an 21 Stationen (Anmeldung, Reiter von Konfi, Org-Admin und Team, Chat mit hochgeladenem Bild und PDF, PDF-Ansicht rendert): erster Lauf 24 Meldungen (`connect-src` für `data:` aus Ionicons, `blob:` aus der PDF-Ansicht), nach der Ergänzung 0 — auch mit scharf geschalteter Policy. `nginx -t` in `nginx:alpine` erfolgreich, Header je Pfad per `curl` geprüft. Wächter `frontend/src/__tests__/betrieb/sicherheitsHeader.test.ts` (15 Fälle; alte nginx.conf 12 rot, ohne `data:`/`blob:` 1 rot; koppelt fremde Adressen aus `index.html`, Theme-CSS und Umami an die Direktiven). **Offen:** Beobachtung im Betrieb und Umschalten auf die scharfe CSP — Auftrag `docs/auftraege/lokaler-agent/04-ci.md`, Abschnitt 8 (mit den lokal nicht geprüften Wegen: QR-Scanner im Browser, Sprachaufnahme, Rückblick als Bild).
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
- **Status:** behoben 29.09.2026 bis auf `Info.plist`/`armv7` — alle 25 `uses:` in den Workflows sind auf den Commit ihrer Fassung festgenagelt (`owner/repo@<sha> # vX.Y.Z`; Commits per `git ls-remote` ermittelt und an geklonten `action.yml` der Fassungen gegengeprüft, Eingaben der benutzten Schritte vorhanden; Dependabot aktualisiert Commit und Kommentar gemeinsam). `frontend.yml` gelöscht (baute aus jedem Branch ohne Tests, überschrieb `:latest` des Frontend-Images und rollte aus; letzter Lauf 03.08.2026 — schnelles Ausrollen eines fertigen Stands deckt der Notfall-Deploy). `test-backend.yml` ohne die Vorgabe `feat/ionic-9` (Branch ist Pflichtangabe) und mit Zeitgrenze. `version: '3.8'` aus der Referenz-Compose entfernt, die veralteten Kommentare in `ci.yml` („32/32", „72 Migrationen … keine Migration mehr") richtiggestellt. Wächter `frontend/src/__tests__/betrieb/workflowHygiene.test.ts` (5 Fälle: nur `ci.yml` und `notfall-deploy.yml` fassen Produktion an, Zeitgrenze in jedem Job, kein Vorgabe-Branch, alle Actions gepinnt; mit den alten Dateien 4 rot, mit einer ungepinnten Zeile 1 rot). **Bewusst nicht geändert:** `UIRequiredDeviceCapabilities: armv7` in der Info.plist — ohne Wirkung (Deployment-Target 16.4, alle Geräte arm64), eine Änderung an den Geräte-Anforderungen wäre nur mit einem Store-Upload prüfbar; beim nächsten Umbau der Info.plist mit Xcode mitnehmen.
- **Nachtrag 27.09.2026 (Prüfung vor dem Merge):** Stand: die Punkte des CI-Pakets sind weiter offen — Actions nicht per SHA gepinnt, `test-backend.yml` mit Vorgabe `feat/ionic-9` (`:22`), `frontend.yml` ohne Gate, `version: '3.8'` im Compose, die `ci.yml`-Kommentare „32/32" (`:249`) und „72 Migrationen" (`:379`), `armv7` in `Info.plist`. Später (Auftrag `04-ci.md`, Abschnitt 5).
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
- **Status:** behoben 29.09.2026 — `upload-play.py` setzt den Track `production` auf `status: inProgress` mit `userFraction` (neue Eingabe `production_anteil` im Android-Workflow, Vorgabe `0.1`; `1` heißt sofort an alle), die Testkanäle `internal`, `alpha`, `beta` bleiben `completed` und sind sofort für alle Testenden da. Track-Namen werden getrimmt, doppelte zusammengefasst und gegen die feste Liste `internal, alpha, beta, production` geprüft; der Anteil muss zwischen 0 (ausschließlich) und 1 liegen. Neuer Modus `--pruefen` (ohne Netz und Schlüssel) läuft im Job `ci-gate` **vor** dem Warten auf die CI und dem Bau — ein Tippfehler bricht nach Sekunden ab statt nach dem Upload. Eingaben gehen über `env` statt inline in das Skript. Geprüft mit `frontend/src/__tests__/betrieb/playUpload.test.ts` (14 Fälle; ohne Staffelung 2 rot, ohne Namensprüfung 1 rot) und actionlint. Auf GitHub zu sehen erst beim nächsten Production-Release (Ausgabe „gestaffelt an 10 %"); den Anteil erhöht man in der Play Console.
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
- **Status:** behoben 29.09.2026 — der `paths`-Filter für `push` nennt zusätzlich `package.json` und `package-lock.json` der Wurzel (E2E-Abhängigkeiten), `.nvmrc` (Node-Fassung aller Jobs), `docker-compose.e2e.yml` (E2E-Stack), `deploy/**` (der Deploy selbst, `rollend.sh`) und `.github/scripts/**` (von `frontend-test` mitgeprüft). Reine Doku (`docs/audit/`, `README.md`, `CHANGELOG.md`) löst weiter keinen Lauf und damit keinen Deploy aus. Wächter `frontend/src/__tests__/betrieb/ciPfadfilter.test.ts` (19 Fälle, mit dem alten Filter 7 rot).
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
- **Status:** offen 27.09.2026 — der Kamera-Text nennt den QR-Scanner weiter nicht (`Info.plist:31-32`). Vor EKD-Ausrollung (Store).
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
- **Nachtrag 28.09.2026:** behoben — `NSCameraUsageDescription` in `Info.plist`: „Diese App benötigt Zugriff auf die Kamera, um beim Einchecken zu Events QR-Codes zu scannen und Fotos für Chat-Nachrichten, Challenge-Beiträge und Aktivitäten aufzunehmen." (Aktivitäten dazu: auch „Aktivität melden" nimmt Fotos über dieselbe Dateiauswahl auf). Android geprüft: Dort gibt es keinen eigenen Begründungstext, der Dialog zeigt den Systemtext; nur der Kommentar im `AndroidManifest.xml` nannte allein den QR-Scanner und nennt jetzt auch die Fotos. Wächter `frontend/src/__tests__/config/kameraBerechtigung.test.ts` (4: liest das Plist, koppelt an `QRScannerModal`, Umlaute, Android-Deklaration); ohne Fix 2 rot. Wirkt ab dem nächsten iOS-Store-Build.

## Unklar

- **App-Icon mit Alphakanal.** `Assets.xcassets/AppIcon.appiconset/kq.png` ist 1024×1024 RGBA
  (PNG-Farbtyp 6). App Store Connect lehnt Marketing-Icons mit Transparenz ab (ITMS-90717). Die Uploads
  221–230 liefen durch — entweder ist der Kanal vollständig deckend und Xcode entfernt ihn, oder ASC hat
  gewarnt. Zu klären in App Store Connect (Build-Verarbeitung, Warnungen).
  - **Status:** behoben 29.09.2026 — Der Alphakanal war überall 255, das Symbol also schon deckend; `kq.png` ist jetzt RGB (PNG-Farbtyp 2), dekodierte Pixel gegen den alten Stand gleich, sRGB-Angabe erhalten, 1.605.317 → 1.097.006 Bytes. Ob App Store Connect bei den Uploads 221–230 gewarnt hat, bleibt dort nachzusehen (Simon); künftig gibt es nichts mehr zu warnen. Test `frontend/src/__tests__/config/iosNativ.test.ts` (Farbtyp, Maße, kein tRNS).
- **`aps-environment = development` in `App.entitlements`.** Xcode ersetzt den Wert beim Export mit
  App-Store-Profil nach gängiger Dokumentation durch `production`; Produktions-Push funktioniert laut
  Historie (Push-Ausfall betraf nur Android). Am IPA nicht geprüft (`codesign -d --entitlements`).
  - **Status:** behoben 29.09.2026 — Nicht mehr dem Export überlassen: Die Release-Konfiguration (manuell signiert mit dem App-Store-Profil „Konfi Quest AppStore CI“, nur für den Store-Build) liest `App/AppRelease.entitlements` mit `production`, Debug weiter `App/App.entitlements` mit `development`. Das ist der Wert, den der Export bisher schon einsetzte — Push aus dem Store funktioniert (sonst hätten iOS-Geräte Sandbox-Tokens, die gegen Produktion scheitern). Ein Build mit falschem Pfad oder Profil schlägt laut im Archiv-Schritt fehl, nicht still. Test `iosNativ.test.ts`: Release → `AppRelease.entitlements`/`production`, Debug → `development`, beide Dateien mit denselben Schlüsseln (eine neue Fähigkeit muss in beide). Am IPA (`codesign -d --entitlements :- Payload/App.app`) beim nächsten Store-Build gegenprüfen — kein macOS hier.
- **`UIBackgroundModes: fetch`.** `AppContext.tsx` nutzt `@capawesome/capacitor-background-task`
  (Hintergrundzeit beim Wechsel), was den Modus `fetch` nicht braucht. Ob `fetch` irgendwo genutzt wird,
  war nicht feststellbar; Apple prüft ungenutzte Modi gelegentlich.
  - **Status:** behoben 29.09.2026 — `fetch` entfernt: Kein Code nutzt Hintergrundabruf (kein `performFetchWithCompletionHandler`, kein `BGTaskScheduler`, kein `setMinimumBackgroundFetchInterval` in `ios/App/App` und den iOS-Teilen der Plugins); `@capawesome/capacitor-background-task` nutzt `beginBackgroundTask` und braucht keinen Modus. `remote-notification` bleibt — `backend/push/firebase.js` schickt `content-available: 1`. Test `iosNativ.test.ts`.
- **`UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` = true.** Der Documents-Ordner der App
  ist in der Dateien-App sichtbar. `MaterialFormModal.tsx:218-228` und `chatTeilen.ts:41-47` schreiben
  temporär nach `Directory.Documents`. Ob dort Chat-Anhänge liegen bleiben (auch bei aktiver App-Sperre
  sichtbar), war ohne Gerät nicht prüfbar.
  - **Status:** behoben 29.09.2026 — Am Code geprüft statt am Gerät: Auf iOS legt Capacitor-Filesystem `Directory.Data` UND `Directory.Documents` in den Documents-Ordner (`IONFileStructures+Converters.swift`). Dort lagen also die wartenden Uploads (`queue-uploads/`: Fotos aus Anträgen, Chat-Anhänge, `writeQueue.ts`, `chatOutbox.ts`) und jede aus dem Chat geteilte Datei (`share/`, `chatTeilen.ts`, nie gelöscht) — sichtbar in der Dateien-App und im Finder, auch an der App-Sperre vorbei. Der Medien-Cache (Chat-Bilder, Material) liegt in `Caches` und war nicht betroffen. Keine Funktion braucht die Freigabe: Sichern geht über das Teilen-Blatt, `CFBundleDocumentTypes` gibt es nicht (kein ITMS-90737). `UIFileSharingEnabled`, `LSSupportsOpeningDocumentsInPlace` und `UISupportsDocumentBrowser` (macht den Ordner ebenfalls sichtbar) entfernt. Test `iosNativ.test.ts`.
  - **Nachtrag 29.09.2026 (Nebenbefund, mitbehoben):** `nachrichtTeilen` (`chatTeilen.ts`) schrieb jede geteilte Chat-Datei nach `Directory.Documents/share/` und löschte sie nie — auf Android ist das der ÖFFENTLICHE Ordner „Dokumente“ (`Environment.DIRECTORY_DOCUMENTS`), lesbar für andere Apps und Dateimanager. Jetzt `Directory.Cache` wie beim Chat-Export; das Teilen-Blatt nimmt Cache-Dateien auf beiden Systemen (`cache-path` in `file_paths.xml`). Test `chatTeilenImCache.test.ts` (2), vor dem Fix 1 rot. Nicht gemacht: Altbestände in `Dokumente/share/` löschen — der Ordnername ist allgemein, ein Löschen könnte fremde Dateien treffen.
- **Android: zwei FCM-Dienste** (Nebenbefund vom 29.09.2026, in `docs/audit/2026-09-28/offene-punkte.md`).
  `@capacitor/push-notifications` und `@capacitor-firebase/messaging` melden je einen `FirebaseMessagingService` mit
  `MESSAGING_EVENT` an; Android stellt jede Nachricht nur einem zu.
  - **Status:** behoben 29.09.2026 — Aus den Quellen belegt, nicht am Gerät und nicht am gemergten Manifest gemessen
    (der Gradle-Lauf `processReleaseMainManifest` scheiterte hier an 429 von Maven Central und am Plattenplatz): FCM
    startet den Dienst, den `resolveService` für `MESSAGING_EVENT` liefert — bei gleicher Priorität den ersten im
    gemergten Manifest; die Bibliotheken stehen dort in der Reihenfolge aus `capacitor.build.gradle`, das
    Firebase-Plugin (Platz 3) vor dem Push-Plugin (Platz 12). Der Dienst des Firebase-Plugins meldet nur dessen
    eigenes `notificationReceived` (hört die App nicht ab) und zeigt auf Android bei offener App nichts an. Also
    feuerte `pushNotificationReceived` in `AppContext` (→ `push:received` → `BadgeContext` lädt die Zähler neu) auf
    Android nie, und bei offener App erschien keine Mitteilung, obwohl `presentationOptions` `alert` verlangt. Das
    Firebase-Plugin warnt in seiner Doku selbst vor dem Nebeneinander. Nicht betroffen: Token (beide Plugins holen ihn
    direkt beim SDK), Antippen (läuft über die Activity, `handleOnNewIntent`), Zahl am Symbol (JS, Badge-Plugin), iOS
    (Capacitors `NotificationRouter` ist Delegat, `AppDelegate` setzt ihn nur beim Start). Fix: Das App-Manifest nimmt
    den Dienst des Firebase-Plugins per `tools:node="remove"` heraus; die App braucht davon nur `getToken()`/
    `deleteToken()`, die ohne Dienst arbeiten. Test `frontend/src/__tests__/config/androidPushDienst.test.ts` (5:
    Manifest gültig, beide Dienste in den Plugins gefunden, nach dem Merge genau der des Push-Plugins, keine Ereignisse
    des Firebase-Plugins abgehört, `alert` gesetzt); gegen das alte Manifest 2 rot. Am Gerät nach dem nächsten
    internen Testbuild gegenprüfen: Mitteilung bei offener App sichtbar, Zähler springen.
- **Test-Deadlocks in der CI.** Zwei rote `backend-test`-Läufe (931, 938) zeigen `deadlock detected`
  zwischen `truncateAll` und Zähler-Abfragen (`events`/`activity_requests`/`challenge_submissions`), die
  offenbar aus einem vorigen Test noch liefen. Sieht nach systematischem Flattern aus; gehört zum
  Test-Bereich, hier nur als Beobachtung.
  - **Status:** behoben 29.09.2026 — Ursache aus den vollständigen Logs der Läufe 931 und 938 belegt: Rot war beide Male **nicht** der Deadlock, sondern derselbe Hook, `afterAll(closePool)` in `tests/routes/teamerZaehlerNachAbmeldung.test.js`, „Hook timed out in 10000ms" (938: 3348 von 3348 Tests grün, 1 Datei rot). Die `deadlock detected`-Zeilen am Log-Ende sind das Postgres-Protokoll des Service-Containers; die Opfer (TRUNCATE bzw. die Zähler-Abfrage in `berechneBadgesFuerAlle`) fangen Wiederholung bzw. `catch` ab. Der Hänger: Die Zusage-Route (`routes/teamer.js`) hält ihre Transaktions-Verbindung nach dem COMMIT und wartet danach noch auf den Event-Chat (weitere Pool-Abfragen), parallel läuft der Push an die Leitung mit bis zu zehn Abfragen; endet die Datei in diesem Moment, ruft `pool.end()` — ein endender Pool bedient seine Warteschlange nicht mehr, die Route bekommt ihre zweite Verbindung nie und gibt die erste nie zurück. Mit zwei Verbindungen nachgestellt: `pool.end()` hängt (> 4 s abgebrochen), mit `connectionTimeoutMillis` endet es nach der Grenze. Behoben in `backend/tests/helpers/db.js`: `closePool` wartet erst die Nachwehen, dann bis keine Verbindung mehr ausgeliehen ist und niemand wartet (höchstens 4 s), dann `end()`; der Test-Pool hat wie `database.js` `connectionTimeoutMillis: 5000` als Netz. Test `backend/tests/helpers/closePool.test.js` stellt die Lage nach (voller Pool, Halter wartet auf zweite Verbindung): mit dem Fix grün (beide Dateien zusammen 6 Tests in 6,5 s), mit dem alten `closePool` hängt er bis zur Grenze von 15 s (rot). Nebenbefund für Produktion: dieselben Routen halten ihre Verbindung während Push- und Chat-Arbeit; dort begrenzt `PG_CONN_TIMEOUT` (5 s) das Warten.
- **Sicherheit der Firebase-Client-Schlüssel.** `frontend/config/google-services.json` und
  `GoogleService-Info.plist` sind Client-Konfigurationen (öffentlich per Design). Ob die beiden
  API-Schlüssel in der Google-Cloud-Konsole auf Paket/Bundle beschränkt sind, ist nur dort prüfbar.
  - **Status:** offen 27.09.2026 — in der Google-Cloud-Konsole prüfen; liegt bei Simon.
- **Android: Mitteilungssymbol** (Simon am Gerät, Build 128, 29.09.2026: „die notification ist nicht korrekt
  gestyled“). Das Manifest nannte weder `default_notification_icon` noch `default_notification_color`, der Server
  schickt weder `icon` noch `color`; das FCM-SDK nahm das App-Symbol, von dem Android nur die Deckkraft auswertet
  (volles Quadrat → weißer bzw. grauer Fleck, keine Akzentfarbe).
  - **Status:** behoben 29.09.2026 — `drawable-{m,h,xh,xxh,xxxh}dpi/ic_stat_konfi.png` (24/36/48/72/96 px, Lutherrose
    aus `ic_launcher_monochrome` der xxxhdpi-Ebene, Linien um 1,25 dp verdickt, damit sie bei 24 dp nicht zerfallen,
    20 dp Motiv mit 2 dp Rand, weiß auf durchsichtig) und `benachrichtigung_farbe` #7C3AED hell (5,7:1 auf Weiß) /
    #A78BFA in `values-night` (5,9:1 auf #202124), beide aus den Text-Tokens der App; im Manifest als die zwei
    `meta-data` von FCM eingetragen. Beide Anzeige-Wege lesen dieselben Metadaten: FCM-SDK bei geschlossener App,
    `@capacitor/push-notifications` bei offener App (`CommonNotificationBuilder` mit den Metadaten der App; das Plugin
    hat keine eigene Einstellung dafür). Server unverändert: Ein `icon` zeigte bei Store-Apps 2.2.x ohne das Drawable
    ins Leere, eine `color` überschriebe die Hell/Dunkel-Farbe der App. Test
    `frontend/src/__tests__/config/androidMitteilungsSymbol.test.ts` (9: Manifest, fünf Dichten mit Maßen, Weiß, Rand
    und Anteil, Löcher im Motiv, Kontrast hell und dunkel, Server ohne `icon`/`color`); Gegenprobe (altes Manifest,
    volles weißes Quadrat) → 3 rot. Am Gerät ansehen.

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
  neue Migrationen automatisch aus (`database.js:76-104`, mit Advisory-Lock). *Stand 27.09.2026: steht weiter im Code (`ci.yml:379`), BF-15.*
- **`deploy/rolling-deploy.sh` (21.06.2026) „NOCH NICHT IM CI AKTIV":** **weiter offen** (BF-05). *Stand 27.09.2026: ersetzt durch `deploy/rollend.sh` (`ee996132`), erster Produktionslauf nach dem Merge.*
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

**Stand 27.09.2026 (vor dem Deploy gemessen, Aufträge `01-vor-dem-deploy.md` und `02-portainer-stack.md`):** Portainer-Stack — `backend-test` steht auf dem Live-SHA `fce1ab0` (BF-03). Ressourcen — vor dem Anheben 0,3 CPU, 14.489-mal gedrosselt in 27 h, Cache-Trefferquote 99,96 %, 40 Verbindungen; seit dem 27.09. 2 CPU / 3 GB. Sicherung — einmal vor dem Deploy mit dem Referenzskript, Rückspielprobe offen. Migrationsstand — 89, jüngster `159_…`. Node live v26.10.0. Nach dem Deploy messen: Deploy-Lücke im zweistufigen Deploy, ob der Datenbank-Container neu erstellt wird. Liegt bei Simon: App Store Connect, Play Console, Firebase-Schlüssel, ghcr-Aufräumregel.

## Auslieferung der Workflow-Änderungen (Nachtrag 26.09.2026)

Die Behebungen aus Paket B, die Dateien unter `.github/workflows/` verändern (BF-01
Release-Tor, BF-03 Deploy-Rewrite in `ci.yml` und `notfall-deploy.yml`, BF-04 `concurrency`,
BF-07 Typprüfung/Build im Test-Job, BF-12 `--passWithNoTests` und `npm audit`, Lint bei jedem
Push), konnte die Koordination zunächst nicht pushen: Der Token der GitHub-App durfte
Workflow-Dateien weder anlegen noch ändern. Simon hat der App am 26.09. das Recht „Workflows"
gegeben; die Workflow-Dateien sind seitdem als eigener Commit im Branch (Betreff „ci:
Workflow-Dateien aus Paket B nachgeschoben"). Der zwischenzeitlich beigelegte Patch ist damit
überflüssig und entfernt.
