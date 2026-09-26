# Audit Toolchain und Abhängigkeiten — 26.09.2026

## Umfang und Methode

Geprüft wurden die drei npm-Projekte (Root, `backend/`, `frontend/`) mit `package.json`,
Lockfiles und installierten `node_modules`, die Dockerfiles, die Workflows unter
`.github/workflows/`, `.github/dependabot.yml`, die Frontend-Konfiguration
(`tsconfig*.json`, `eslint.config.js`, `vite.config.ts`, `capacitor.config.ts`) sowie die
native Toolchain (`ios/App/Podfile(.lock)`, `android/variables.gradle`, `android/build.gradle`,
`android/app/build.gradle`, `capacitor.build.gradle`, `capacitor.settings.gradle`,
`gradle-wrapper.properties`).

Ausgeführt (alle Zahlen gemessen, Node 22.22.2, npm 10.9.7):

- `npm audit --json` (mit und ohne `--omit=dev`), `npm outdated --json`, `npm ls --all`
  in allen drei Projekten; `npm explain` für Overrides und undeklarierte Importe.
- Lizenz-Inventar per eigenem Skript über `npm ls --omit=dev --all --json` beider Projekte
  (liest `license` aus jeder installierten `package.json`).
- Tote/undeklarierte Abhängigkeiten per eigenem Skript (Import-Spezifizierer aller
  Quelldateien gegen `dependencies`/`devDependencies`).
- Frontend: `npx eslint src -f json` (51,2 s), `npx tsc --noEmit` (25,5 s),
  `npx tsc -p tsconfig.node.json`, Typprüfung der ausgeschlossenen Testdateien mit einer
  temporären tsconfig im Scratchpad (19 s), `npm run build` (61,6 s), `npx cap copy android`.
- Backend: ESLint 10 (Binärdatei aus `frontend/node_modules`) mit temporärer
  Minimalkonfiguration (`js.configs.recommended`, CommonJS, Node-Globals) im Scratchpad, 7 s.
- Nachbau der Dockerfile-Installationsfolge (`npm install --omit=dev && npm install pg`) auf
  einer Scratchpad-Kopie von `package.json`/`package-lock.json` mit `--package-lock-only`.
- `npm view <paket> time --json` für Wartungsstand der nativen Plugins und Kernpakete.
- GitHub-API (offene Pull Requests), Node-Release-Kalender (endoflife.date, nodejs.org).
- 10 der „harmlos" eingestuften react-hooks-Warnungen am Code nachgelesen.

Bewusst nicht geprüft: `pod install`/Xcode-Build (kein macOS), Gradle-Build (kein
Android-SDK; Gradle 8.x ist da, `ANDROID_HOME` nicht), Bau der Docker-Images (CI-Agent),
Backend-Suite auf Node 26 (hier nur 22), E2E-Lauf (Root-`node_modules` fehlen, globales
Playwright 1.56.1/Chromium 1194 passt nicht zur projektierten 1.62.1).

Alle temporären Konfigurationen und Ausgaben liegen im Scratchpad
(`…/scratchpad/toolchain/`), nichts davon im Repo.

## Zusammenfassung

Keine kritischen oder hohen Befunde. **5 Befunde MITTEL, 7 Befunde NIEDRIG.** Die
Sicherheitslage der Abhängigkeiten ist gut: Backend 0 Meldungen (Produktion und Dev), Root 0,
Frontend 3 moderate — alle aus derselben react-router-6-Kette, deren Fix nur in 7.18/8.4
existiert und mit Ionic 9 unvereinbar ist; beide Lücken sind im Code nicht erreichbar
(nachgeprüft, mit einer Präzisierung zum alten Befund). Keine Copyleft-Lizenzen in 451
Produktionspaketen (eine MPL-2.0-Plugin-Lizenz, dateibezogen, unverändert eingebunden).

Die drei wichtigsten Punkte: (1) Das Lint-Gate der CI läuft nur bei Pull Requests — seit dem
31.08.2026 gab es keinen mehr, alle 798 Commits gingen direkt auf `main`; im Frontend stehen
19 Lint-Fehler und 317 Warnungen (31.08.: 273), obwohl der CI-Kommentar „null" behauptet.
(2) Die nativen App-Bundles enthalten 33 MB Handbuch-Screenshots und Swagger-UI — 79 % des
Bundles, App-Code sind 8,5 MB; das war schon in 2.2.0 so. (3) Das Backend-Image wird nicht
aus dem Lockfile gebaut: `npm install` statt `npm ci`, und `npm install pg` zieht nachweislich
die neueste Version (8.22.0 → 8.23.0 im Nachbau); keine `.dockerignore`.

## Release-Empfehlung für den Bereich

**freigeben** — kein Befund in diesem Bereich bricht die ausgelieferte App, die API oder die
Store-Apps 2.2.x; die MITTEL-Befunde sind Prozess- und Reproduzierbarkeitsthemen, die vor dem
*nächsten* Release abzuarbeiten sind (Lint-Gate auch bei Push auf `main`, `dist/docs` aus dem
App-Bundle, `npm ci` im Backend-Dockerfile, E2E-Job weg von Node 20).

## Befunde

### BF-01: Lint-Gate der CI ist seit dem 31.08.2026 nicht mehr aktiv; der Fehlerbestand wächst
- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — 19 Fehler behoben, Lint läuft bei jedem Push und PR über den ganzen Baum (`npx eslint .` — Fehler blockieren, Warnungen nicht); die Kommentare in `ci.yml` und `eslint.config.js` beschreiben den tatsächlichen Stand.
- **Fundstelle:** `.github/workflows/ci.yml:161` (`if: github.event_name == 'pull_request'`),
  `.github/workflows/ci.yml:150-159` (Kommentar „Beide stehen aktuell auf null"),
  `frontend/eslint.config.js:23-43`
- **Kennzeichnung:** reproduziert (`cd frontend && npx eslint src -f json`;
  `git log --since=2026-08-27 --oneline | wc -l` → 798; `git log --since=2026-08-27 --grep='Merge pull request' | wc -l` → 31, letzter am 31.08.2026)
- **Beschreibung:** Der Lint-Schritt läuft ausschließlich bei `pull_request`. Seit dem
  31.08.2026 ist kein PR mehr gemergt worden; alle Commits gehen direkt auf `main`. Der
  Schritt ist damit seit vier Wochen nicht ein einziges Mal gelaufen. Ergebnis heute:
  579 Dateien, **19 Fehler** (15× `@typescript-eslint/no-unused-vars`, 3× `react-hooks/globals`,
  1× `no-require-imports`), **317 Warnungen** (Stand 31.08. laut `ci.yml:150`: 273; laut
  `eslint.config.js:23`: „rund 230" für die sechs herabgestuften Regeln — heute 200 dort,
  plus 56 `exhaustive-deps` und 59 `only-export-components`). Der CI-Kommentar „no-explicit-any
  und no-unused-vars … stehen aktuell auf null" ist für `no-unused-vars` falsch (15).
  10 der 19 Fehler liegen im App-Code, 9 in Tests.
- **Auswirkung aus Nutzersicht:** Keine direkte. Die ungenutzten Importe (`ICON_GESPERRT`,
  `formatDate`, `formatDateLong`, `ladeRolleVor`, `SeiteLaedt`, `IonNote`) deuten auf halb
  zurückgebaute Funktionen hin; die Regel „wer eine Datei anfasst, hinterlässt sie sauber"
  wird nicht durchgesetzt.
- **Beleg (App-Code):** `frontend/src/components/admin/pages/AdminEventsPage.tsx:13,654`,
  `frontend/src/components/admin/views/EventDetailSections.tsx:161`,
  `frontend/src/components/admin/views/EventDetailView.tsx:8,300`,
  `frontend/src/components/konfi/views/EventDetailView.tsx:56`,
  `frontend/src/components/layout/MainTabs.tsx:21,135`,
  `frontend/src/components/shared/PushAuswahl.tsx:14`,
  `frontend/src/components/teamer/pages/TeamerEventsPage.tsx:66`;
  Tests: `haptikBrichtNichtAb.test.ts:2`, `fehlerMessung.test.tsx:106`,
  `pushTokenAktivAbruf.test.tsx:160-174`, `pushTokenNachfassen.test.tsx:163`,
  `umamiKennungen.test.ts:298`.
- **Empfehlung:** Lint auch bei `push` auf `main` (Diff gegen den Vor-Commit oder Gesamtlauf
  mit Fehler-Schwelle 0 — Warnungen bleiben Warnungen); die 19 Fehler beheben; den
  Zahlen-Kommentar in `ci.yml` streichen oder pflegen.

### BF-02: Native App-Bundles enthalten 33 MB Handbuch-Screenshots und Swagger-UI
- **Schwere:** MITTEL
- **Fundstelle:** `frontend/capacitor.config.ts:8` (`webDir: 'dist'`), `frontend/public/docs/`
  (33 MB), `.github/workflows/android-release.yml:70-71` und
  `.github/workflows/ios-release.yml:106-107` (`npm run build` → `npx cap sync`),
  `scripts/build-handbuch.mjs` (spiegelt `docs/screenshots/` nach `frontend/public/docs/bilder/`)
- **Kennzeichnung:** reproduziert (`cd frontend && npm run build && du -sb dist dist/docs`;
  `npx cap copy android && du -sb android/app/src/main/assets/public{,/docs}`)
- **Beschreibung:** `dist/` ist 43.220.562 Bytes groß, davon `dist/docs` 34.271.274 Bytes
  (79 %): 42 PNG-Screenshots mit 30 MB (größte Datei
  `konfi-challenge-feed.png` 1,7 MB) und 2,7 MB API-Referenz inklusive
  `swagger-ui-bundle.js` (1,45 MB). Der eigentliche App-Code (`dist/assets`) sind 8,5 MB.
  `cap copy android` kopiert das komplette Verzeichnis in die App (43 MB, davon 33 MB docs).
  Beide Release-Workflows machen genau das. Im Tag `2.2.0` lagen bereits 34.180.367 Bytes
  unter `frontend/public/docs` — kein Regress, aber jede Store-Version ist rund viermal so
  groß wie nötig.
- **Auswirkung aus Nutzersicht:** Jedes App-Update lädt ~33 MB Handbuch-Bilder mit, die in
  der App nirgends angezeigt werden (das Handbuch wird im Web ausgeliefert). Trifft Konfis mit
  Mobilfunk und alten Geräten.
- **Beleg:** `dist bytes=43220562`; `dist/docs 34271274 bytes (33M)`; `docs/bilder 30M`,
  `docs/api 2.7M`, `png count: 42`; `android/app/src/main/assets/public total: 43220562 bytes`.
- **Empfehlung:** Vor `cap sync` `dist/docs` entfernen (eine Zeile in beiden
  Release-Workflows) oder das Handbuch außerhalb von `public/` bauen und nur ins Web-Image
  (nginx) kopieren; Screenshots nach WebP wandeln (die Hero-Bilder auf der Landing-Seite sind
  bereits WebP, 52–60 kB).

### BF-03: Backend-Image ist nicht aus dem Lockfile reproduzierbar
- **Schwere:** MITTEL
- **Fundstelle:** `backend/Dockerfile:17` (`RUN npm install --omit=dev && npm install pg`),
  `backend/Dockerfile:20` (`COPY . .`), fehlende `backend/.dockerignore`
- **Kennzeichnung:** reproduziert (Scratchpad-Kopie von `backend/package.json` +
  `package-lock.json`; `npm install pg@8.22.0 --package-lock-only` → Lock `pg 8.22.0`;
  dann der Dockerfile-Schritt `npm install pg --package-lock-only` → `package.json`
  `^8.23.0`, Lock `8.23.0`)
- **Beschreibung:** `npm install pg` ohne Versionsangabe bedeutet „neueste Version" und
  überschreibt Lockfile und `package.json` im Image. Heute ist 8.23.0 zufällig die
  neueste, die Abweichung ist latent; beim nächsten pg-Release läuft in Produktion eine
  ungetestete Version. `pg` steht ohnehin in `dependencies` — die zweite Installation ist
  überflüssig. `npm install --omit=dev` statt `npm ci` prüft die Lock-Konsistenz nicht (im
  Nachbau änderte es nur `libc`-Metadaten, 40 Diff-Zeilen). Ohne `.dockerignore` kopiert
  `COPY . .` bei einem lokalen Bau `node_modules` (mit macOS-Binärdateien für `bcrypt`),
  `tests/` und `uploads/` ins Image; das Frontend hat seit dem 14.09.2026 genau dafür eine
  `.dockerignore` mit Begründung (`frontend/.dockerignore:1-11`).
- **Auswirkung aus Nutzersicht:** Zwei Builds desselben Commits können unterschiedliche
  `pg`-Versionen enthalten; ein pg-Release mit Regression erreicht Produktion, ohne dass die
  Testsuite es je gesehen hat.
- **Beleg:** `pinned: package.json pg=^8.22.0 lock pg=8.22.0` → nach `npm install pg`:
  `package.json pg=^8.23.0 lock pg=8.23.0`. `npm view pg time`: 8.23.0 (08.08.2026),
  8.22.0 (19.06.2026).
- **Empfehlung:** `RUN npm ci --omit=dev`; `npm install pg` streichen;
  `backend/.dockerignore` mit `node_modules`, `tests`, `uploads`, `.env*`, `*.log`.

### BF-04: Node-Versionen: E2E-Job auf Node 20 (End-of-Life seit 30.04.2026), Produktion auf Node 26 (noch kein LTS)
- **Schwere:** MITTEL
- **Fundstelle:** `.github/workflows/ci.yml:245-247` (`actions/setup-node@v4`,
  `node-version: '20'`), `backend/Dockerfile:1` und `frontend/Dockerfile:2` (`node:26`),
  `.github/workflows/ci.yml:95-97,127-129` (Node 26, `setup-node@v7`),
  `backend/package.json:43-45` (`engines: node >=22.0.0`), lokal 22.22.2, keine `.nvmrc`
- **Kennzeichnung:** reproduziert (grep; Release-Kalender endoflife.date und
  nodejs.org/en/about/previous-releases, abgerufen 26.09.2026)
- **Beschreibung:** Vier Node-Stände: 20 (E2E), 22 (lokal, `engines`), 26 (Tests, Release,
  Produktion). Node 20 ist seit dem 30.04.2026 End-of-Life — der E2E-Job läuft auf einer
  Version ohne Sicherheitsfixes, mit `setup-node@v4` statt `@v7` wie überall sonst. Node 26
  ist heute „Current", nicht LTS (Übergang zu Active LTS voraussichtlich Ende Oktober 2026);
  nodejs.org: „Production applications should only use Active LTS or Maintenance LTS
  releases." Node 22 ist Maintenance LTS bis 30.04.2027, Node 24 Active LTS. Positiv: die
  Backend-Suite läuft in der CI auf 26, also auf der Produktionsversion. Ob die Suite auf 22
  (lokal) und 26 (CI) identisch läuft, ist hier nicht messbar.
- **Auswirkung aus Nutzersicht:** Keine direkte. Risiko: Verhaltensänderungen von Node 26
  bis zum LTS-Schnitt landen ungefiltert in Produktion; Node 20 im Runner ist ein Angriffsziel
  ohne Fix.
- **Beleg:** endoflife.date: „Version 20 … Maintenance ended: 30 Apr 2026 … End of life";
  „Version 26 … Status: Current"; nodejs.org: v20 EOL, v22 LTS, v24 LTS, v26 Current.
- **Empfehlung:** E2E-Job auf 26 und `setup-node@v7` (eine Zeile); `.nvmrc` mit `26` im Root,
  `engines` auf `>=26` heben oder Produktion bis zum LTS-Schnitt auf `node:24` — eine
  Entscheidung, aber eine bewusste.

### BF-05: Tageslosung hängt an `node-fetch`, das nur über eine optionale, transitive Kette installiert ist
- **Schwere:** MITTEL
- **Fundstelle:** `backend/services/losungService.js:90` (`const fetch = (await import('node-fetch')).default;`),
  `backend/package.json` (kein Eintrag `node-fetch`), aufgerufen aus `routes/konfi.js:10,1514`
  und `routes/teamer.js:5,1048`
- **Kennzeichnung:** reproduziert (`cd backend && npm explain node-fetch`;
  `node -e "console.log(typeof fetch)"` → `function`)
- **Beschreibung:** `npm explain` zeigt `node-fetch@2.7.0 optional` ← `gaxios@6.7.1` ←
  `gtoken` ← `google-auth-library@9` ← **`optional @google-cloud/storage`** ← `firebase-admin`.
  Das Paket ist nur da, weil firebase-admin einen optionalen Storage-Client mitbringt, den
  der Code nie benutzt (kein `getStorage`/`firestore` im Backend). Im Baum liegen zwei
  Fassungen (2.7.0 und 3.3.2, letztere ESM-only); welche oben liegt, entscheidet npm-Hoisting.
  npm überspringt fehlgeschlagene optionale Pakete still; ein firebase-admin-Update kann die
  Kette kappen; `--omit=optional` entfernt sie. Dann wirft `import('node-fetch')`
  „Cannot find module" → HTTP 500. Node ≥ 18 (hier 22/26) hat globales `fetch`; der Import ist
  überflüssig. `tests/services/losungService.test.js` nutzt den echten Import und würde es in
  der CI zeigen — sofern die CI-Installation denselben Zufall hat wie die Produktion.
- **Auswirkung aus Nutzersicht:** Losung des Tages für Konfis und Teamer fällt aus
  (Server-Fehler), ohne dass am Code etwas geändert wurde.
- **Beleg:** `node-fetch@2.7.0 optional … optional @google-cloud/storage@"^7.22.0" from firebase-admin@14.3.0`;
  `npm ls node-fetch` → `node-fetch@2.7.0` und `node-fetch@3.3.2` an sieben Stellen.
- **Empfehlung:** Globales `fetch` verwenden (eine Zeile weniger) oder `node-fetch`
  deklarieren. Gleiches für `validator` (`routes/auth.js:7`, `isEmail` in `:463,:948`) — kommt
  nur über `express-validator ~13.15` mit; deklarieren.

### BF-06: Backend ohne Lint-Konfiguration — 96 Fehler mit Standardregeln, aber keine undefinierten Bezeichner
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/package.json` (kein `lint`-Skript, kein ESLint installiert), im Repo
  existiert nur `frontend/eslint.config.js`
- **Kennzeichnung:** reproduziert (ESLint 10.10.0 aus `frontend/node_modules` mit
  temporärer Konfiguration `js.configs.recommended` + CommonJS + Node-Globals über
  `backend/`, 237 Dateien, 7 s)
- **Beschreibung:** 96 Fehler in 53 Dateien (71 außerhalb `tests/`), 1 Warnung:
  `no-unused-vars` 76 (54 außerhalb Tests in 23 Dateien: `routes/chat.js` 12,
  `routes/konfi.js` 6, `createApp.js` 5, `routes/teamer.js` 5, `services/backgroundService.js` 3),
  `no-useless-assignment` 11 (durchweg das Muster „erst `null`, dann im `try` gesetzt" —
  harmlos, z. B. `routes/events/checkin.js:61`, `createApp.js:396`),
  `preserve-caught-error` 3 (`push/firebase.js:65`), `no-empty` 2 (leere
  `if (newBadges > 0) {}` in `routes/konfi-management.js:1204,1366`), `no-useless-escape` 2,
  `no-control-regex` 1 (`utils/musikLinks.js:87`). **`no-undef`: 0 Treffer.**
- **Schwere begründet:** Keine Meldung zeigt einen Laufzeitfehler — null undefinierte
  Bezeichner, keine Doppeldeklarationen, kein unerreichbarer Code. Es ist Hygiene. Aber: ohne
  Lint fällt ein Tippfehler in einem selten laufenden Pfad (Cron-Job, Fehlerzweig) erst in
  Produktion auf; genau diese Klasse fängt `no-undef` ab.
- **Auswirkung aus Nutzersicht:** Keine heute.
- **Empfehlung:** `eslint.config.js` im Backend mit `recommended`, `no-unused-vars` als
  Warnung zum Abarbeiten, `no-undef` als Fehler; CI-Schritt analog Frontend. Hinweis:
  `tests/services/pushKennungMitsenden.test.js:1` nutzt ESM-`import` in einer `.js`-Datei
  (Vitest verkraftet das, ESLint braucht dafür einen `sourceType`-Eintrag).

### BF-07: 267 Testdateien, `vite.config.ts` und `capacitor.config.ts` werden von keiner Typprüfung erfasst — 64 Typfehler darin
- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/tsconfig.json:18-20` (`include: ["src"]`, `exclude` aller Tests,
  `references` ohne `tsc -b`), `frontend/tsconfig.node.json`, `frontend/package.json:15`
  (`"build": "tsc && vite build"`)
- **Kennzeichnung:** reproduziert (`npx tsc --noEmit` → 0 Fehler, 25,5 s;
  temporäre tsconfig im Scratchpad mit `extends`, `include src/**`, `exclude []` → 64 Fehler
  in 23 Testdateien + `capacitor.config.ts`; `npx tsc -p tsconfig.node.json --noEmit` →
  `vite.config.ts(63,3): error TS2769`)
- **Beschreibung:** `tsc` prüft nur `src/` ohne Tests; das referenzierte Projekt
  `tsconfig.node.json` wird ohne `-b` nie gebaut, `capacitor.config.ts` ist nirgends
  enthalten. `vite.config.ts` kompiliert nicht (`test` existiert nicht in
  `UserConfigExport` — die Vitest-4-Typen werden per `/// <reference types="vitest" />` nicht
  mehr eingehängt; Vitest liest die Datei trotzdem). In den Tests: `chatOutbox.test.ts` 15
  Fehler (u. a. TS2556 „spread argument must be a tuple" in `:5,:11`, TS2493 in `:135`),
  `laufenderTerminVerbuchen.test.ts` 13, `teilnehmerAuswahlJahrgang.test.tsx` 11;
  `capacitor.config.ts:108` `resize: 'ionic'` ist kein `KeyboardResize`-Enum-Wert (zur
  Laufzeit gleichwertig, da JSON).
- **Auswirkung aus Nutzersicht:** Keine. Tests mit falschen Typen prüfen aber
  möglicherweise nicht, was sie behaupten.
- **Empfehlung:** `tsconfig.test.json` (extends, include Tests) und in der CI prüfen;
  `defineConfig` aus `vitest/config` importieren; `KeyboardResize.Ionic` verwenden.

### BF-08: CI-Sicherheitsprüfung kann im Frontend nie rot werden, im Backend nur bei „critical"
- **Schwere:** NIEDRIG
- **Status:** behoben 26.09.2026 — Beide Audit-Schritte stehen auf `--audit-level=high` ohne `|| true`; die zwei react-router-Advisories sind `moderate` und liegen unter der Schwelle, eine gezielte Ausnahme ist deshalb nicht nötig (lokal geprüft: Frontend Exit 0 mit 3 moderate, Backend 0).
- **Fundstelle:** `.github/workflows/ci.yml:226` (`npm audit --audit-level=critical || true`),
  `.github/workflows/ci.yml:107` (`npm audit --audit-level=critical`)
- **Kennzeichnung:** reproduziert (`cd frontend && npm audit --json` → 3 moderate,
  Exit 1; der CI-Schritt bliebe grün)
- **Beschreibung:** Das `|| true` ist offenbar die Antwort auf die unfixbaren
  react-router-Meldungen; damit sind aber auch alle künftigen high/critical-Meldungen im
  Frontend unsichtbar. Im Backend blockieren high-Meldungen nicht.
- **Auswirkung aus Nutzersicht:** Keine heute (0 bzw. 3 bekannte moderate).
- **Empfehlung:** `--audit-level=high` in beiden Jobs; die zwei bekannten Advisories
  (GHSA-wrjc-x8rr-h8h6, GHSA-337j-9hxr-rhxg) gezielt ausnehmen (kleines Skript über
  `npm audit --json`).

### BF-09: Dependabot — 9 PRs offen seit dem 07.09., Ignore-Liste ohne TypeScript-Hauptversion
- **Schwere:** NIEDRIG
- **Fundstelle:** `.github/dependabot.yml:34-45` (Ignore nur react-router-Familie);
  GitHub-PRs #157, #158, #163, #164, #166, #167, #169, #170, #176
- **Kennzeichnung:** reproduziert (GitHub-API `list_pull_requests state=open` →
  9 Dependabot-PRs; `git log --author=dependabot` → letzter Merge 21.08.2026;
  `node_modules/typescript-eslint/package.json` → `peerDependencies.typescript: ">=4.8.4 <6.1.0"`)
- **Beschreibung:** Die Konfiguration vom 09.09. funktioniert (wöchentliche Gruppen-PRs
  kommen: #170 Backend 21.09. mit 3 Updates, #176 Frontend 24.09. mit 13 Updates — das sind
  genau die `npm outdated`-Einträge), aber nichts wird gemergt. PR #157 (TypeScript 7.0.2)
  verletzt die Peer-Grenze von typescript-eslint 8.70 (`<6.1.0`) — dieselbe Lage wie bei
  react-router 7, ohne Ignore-Eintrag. Die react-router-Ignores wirken: keine
  react-router-PRs offen.
- **Auswirkung aus Nutzersicht:** Keine.
- **Empfehlung:** `typescript` semver-major ignorieren, bis typescript-eslint TS 7 trägt
  (Kommentar wie bei react-router); `vitest` 5 nur in beiden Projekten gemeinsam; die
  Gruppen-PRs zeitnah mergen — sonst ist die Konfiguration Rauschen.

### BF-10: Abhängigkeits-Hygiene — undeklarierte Importe, tote Einträge, wirkungslose Overrides, bedeutungslose Versionsnummern
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/routes/auth.js:7`; `frontend/src/components/chat/useChatVerwaltung.ts`,
  `frontend/src/components/konfi/views/EventDetailView.tsx`, `frontend/src/contexts/ModalContext.tsx`
  (Import `@ionic/core`); `frontend/package.json:25,33,38` (`@types/qrcode` in `dependencies`,
  `@capacitor/status-bar`); `backend/package.json:46-50` (`overrides`); `package.json:3`
  (`2.9.0`), `backend/package.json:3` (`1.0.1`), `frontend/package.json:4` (`0.0.1`)
- **Kennzeichnung:** reproduziert (eigenes depcheck-Skript; `npm explain`; `git log -S`)
- **Beschreibung:**
  - Undeklariert, aber importiert: Backend `validator` (via express-validator), Frontend
    `@ionic/core` in 3 Dateien (kommt exakt gepinnt über `@ionic/react`), in Tests
    `lightningcss` und `plist` (dev-transitiv). Backend: 0 tote `dependencies`.
  - Nie importiert: `@capacitor/status-bar` (steht in `includePlugins`, wird nativ
    eingebunden, im Code nie aufgerufen — Capacitor 8 bringt `SystemBars` mit);
    `@types/qrcode` gehört in `devDependencies`. `@capacitor/android`/`ios` und `react-router`
    sind korrekt (Plattformpakete bzw. Peer).
  - `overrides`: `protobufjs ^7.5.5` — google-gax verlangt `^7.5.4`, ohne Override
    ergäbe sich dieselbe 7.6.5; `websocket-driver ^0.7.5` — faye-websocket verlangt `>=0.5.1`,
    ohne Override dieselbe 0.7.5. Beide sind seit dem Anlass (CVE-Fix 27.05.2026) wirkungslos
    und unkommentiert. `uuid ^11.1.1` ist begründet (Commit 71effd7c, CVE-2026-41907), erzwingt
    aber eine Hauptversion gegen `gaxios@6` (`^9.0.1`) — läuft (`v4` unverändert), muss bei
    jedem firebase-admin-Update mitgeprüft werden.
  - Versionsnummern: Root `2.9.0` stammt aus Commit d1dc9eae (28.03.2026) und wurde nie
    gepflegt; Backend `1.0.1`, Frontend `0.0.1`; die Wahrheit steht in
    `frontend/version.json` (`2.3.0`). Wer `package.json` liest, wird fehlgeleitet.
- **Auswirkung aus Nutzersicht:** Keine.
- **Empfehlung:** Fehlende Einträge deklarieren, `@types/qrcode` verschieben,
  `@capacitor/status-bar` entfernen (auch aus `includePlugins`, Podfile, Gradle), die zwei
  wirkungslosen Overrides streichen oder begründen, Versionsnummern auf `2.3.0` ziehen oder
  auf `0.0.0-siehe-version.json` setzen.

### BF-11: Startbündel lädt 1,39 MB Icon-Chunk (305 kB gzip) sofort; drei Build-Warnungen
- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/shared/icons.ts`, `frontend/src/utils/badgeIcons.ts`;
  Build-Ausgabe (`vite build`) Zeilen 305–311
- **Kennzeichnung:** reproduziert (`cd frontend && npm run build`, 61,6 s gesamt, davon Vite
  8,61 s; `grep -o 'data:image/svg+xml' dist/assets/icons-*.js | wc -l` → 284)
- **Beschreibung:** `dist/assets/icons-CIPRHCVA.js` ist 1.391,83 kB (gzip 305,64 kB), enthält
  284 Icon-SVGs (von 1.357 im Paket) und wird per `modulepreload` aus `index.html` und aus
  dem Haupt-Chunk (`index-BcJUgVnl.js`, 423,25 kB) geladen — also beim Start. Vite warnt
  „Some chunks are larger than 500 kB". Weitere Warnungen: `INEFFECTIVE_DYNAMIC_IMPORT`
  (`@rdlabo/ionic-theme-ios27` wird in `MainTabs.tsx` dynamisch, in `App.tsx` und
  `segmentGlas.ts` statisch importiert — der dynamische Import bringt nichts) und lightningcss
  `'host-context' is not recognized as a valid pseudo-class` (aus einer Theme-CSS). Gesamt:
  219 JS-Chunks, 4,70 MB JS, 421 kB CSS, keine Sourcemaps (0 `.map`), `define` nur
  `__APP_VERSION__`, kein explizites `build.target` (Vite-Default entspricht Safari 16 →
  passt zum iOS-Minimum 16.4).
- **Auswirkung aus Nutzersicht:** Im Web ~300 kB mehr vor dem ersten Bild; in der App aus
  dem Bundle nicht spürbar.
- **Empfehlung:** Badge-Icon-Tabelle lazy laden (`import()` in `getIconFromIoniconsName`),
  den dynamischen Theme-Import in `MainTabs.tsx` durch den statischen ersetzen.

### BF-12: Zwei der als „harmlos" eingestuften Hook-Warnungen haben sichtbare Nebenwirkungen
- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx:412`,
  `frontend/src/components/konfi/modals/ChallengeDetailModal.tsx:374`
- **Kennzeichnung:** aus Code gelesen (10 Warnungen der sechs Regeln stichprobenartig geprüft)
- **Beschreibung:** `getGreeting` ruft `Math.random()` im Render — mit 20 % Wahrscheinlichkeit
  „Moin, …", sonst tageszeitabhängig; bei jedem Re-Render des Dashboards kann die Begrüßung
  umspringen. `isActive` in `ChallengeDetailModal` memoisiert `Date.now()` auf `[current]` —
  endet die Challenge, während das Modal offen ist, bleibt „aktiv" stehen, bis sich
  `current` ändert. Die übrigen 8 geprüften Stellen sind harmlos wie beschrieben:
  `ChatMessagesList.tsx:56` und `LazyImage.tsx:31` (Ref-Lesen bewusst, dokumentiert),
  `KonfisView.tsx:134` und `ActivityRequestModal.tsx:123` (Laden beim Mount),
  `ActivityManagementModal.tsx:135` und `ActivityModal.tsx:92` (TDZ-Meldung, Effekt läuft
  nach der Deklaration), `ActivityRings.tsx:239` (`Ring` ohne eigenen State),
  `ChallengeLeitungModal.tsx:427` (nur für den React Compiler relevant, der nicht im Einsatz ist).
- **Auswirkung aus Nutzersicht:** Teamer sehen gelegentlich eine wechselnde Begrüßung;
  Konfis sehen eine gerade abgelaufene Challenge kurz noch als aktiv.
- **Empfehlung:** Zufall einmal pro Mount in `useState`-Initialisierer ziehen; `isActive`
  ohne `useMemo` berechnen oder einen Minuten-Ticker als Dependency führen.

## Unklar

- **Java-Level im Android-Build:** `frontend/android/build.gradle:40-43` setzt in
  `allprojects` für alle `JavaCompile`-Tasks Java 1.8; `capacitor.build.gradle:4-7` setzt
  Java 21. Welches gewinnt, entscheidet die Konfigurationsreihenfolge in Gradle — hier ohne
  Android-SDK nicht ausführbar. Android-Build 124 lief durch, der Block ist also wirkungslos
  oder harmlos; zu klären mit `./gradlew :app:compileReleaseJavaWithJavac --info` auf dem
  CI-Runner.
- **Lizenz von `@capgo/capacitor-native-biometric@8.6.7`:** `package.json` und `LICENSE`
  sagen MPL-2.0, die mitgelieferte `.podspec` sagt MIT (und Version 7.1.13). MPL-2.0 ist
  dateibezogenes Copyleft: unverändert eingebunden in eine proprietäre App unproblematisch;
  eigene Änderungen an Plugin-Dateien müssten offengelegt werden (im Repo gibt es keine —
  kein `patches/`, kein `postinstall`). Der Widerspruch gehört upstream gemeldet.
- **Identisches Verhalten der Backend-Suite auf Node 22 und 26:** hier nur 22 vorhanden.
- **ESLint-Rauschen durch fremde Änderungen:** Der erste Backend-Lint-Lauf meldete in
  `middleware/rbac.js:104,138` zweimal `no-constant-condition`; der zweite Lauf 0 — die Datei
  hatte um 12:07 UTC eine fremde Änderung (mtime), Inhalt heute identisch mit HEAD. Alle Zahlen
  in BF-06 stammen aus dem zweiten Lauf.
- **CI-Postgres 15-alpine** (`ci.yml:53`) gegen PostgreSQL 16 lokal — außerhalb dieses
  Bereichs, an den CI-Agenten weitergegeben.

## Alte Befunde nachgeprüft

- **`docs/offene-befunde.md` Nr. 2 „Sicherheitsmeldungen zu react-router — trifft uns nicht"
  → bestätigt, mit Präzisierung.** `npm audit` zeigt heute genau die zwei Advisories
  (GHSA-wrjc-x8rr-h8h6 Open Redirect via Backslash, GHSA-337j-9hxr-rhxg SSR
  `deserializeErrors`) für `react-router 6.30.6`; Fix nur in 7.18.0/8.4.0;
  `@ionic/react-router@9.0.3` deklariert weiterhin `react-router: >=6.4.0 <7`. SSR gibt es
  nicht. Die Aussage „Nirgends fließt ein nutzergesteuerter Pfad … aus … einem Push-Datenfeld
  in ein Ziel" stimmt aber nicht wörtlich: `buildPushTargetUrl`
  (`frontend/src/utils/pushNavigation.ts:195,227,254,279,323,362,382,401`) setzt
  `data.roomId`, `event_id`/`eventId` und `ausgabe_id` aus dem FCM-Payload in das Ziel ein, und
  `deepLinkZiel` (`frontend/src/utils/deepLinks.ts:52`) reicht Pfad, Query und Hash eines
  extern geöffneten Links an `router.push` (`navigation/PushZielNavigation.tsx:52,57`) weiter.
  Beides ist für das Backslash-Open-Redirect **nicht ausnutzbar**: das erste Segment ist immer
  fest (`/konfi/…`, Präfix-Allowlist `/login`, `/register`, `/reset-password`), und
  `new URL()` normalisiert Backslashes in `https:`-Adressen zu `/`. Der im Befund genannte
  Prüfbefehl (`grep -rn 'navigate(\`\|push(\`\|routerLink={\`'`, 16 Treffer, alle feste Pfade)
  findet diese beiden Stellen jedoch nicht — er sollte um `router.push(` und
  `<Navigate to={` ergänzt werden.
- **`CLAUDE.md` „react-router bleibt auf 6"** → Peer-Grenze bestätigt (`>=6.4.0 <7`).
- **`dependabot.yml:34-45` (09.09.2026, PRs #159/#160)** → Ignore wirkt: keine offenen
  react-router-PRs.
- **`ci.yml:150-159` „273 Meldungen (31.08.)", „no-unused-vars … auf null"** → heute 317
  Warnungen und 19 Fehler, davon 15 `no-unused-vars`; `no-explicit-any` weiterhin 0 (BF-01).
- **`eslint.config.js:23` „rund 230 Stellen"** → heute 200 für die sechs Regeln (91 refs,
  65 set-state-in-effect, 34 immutability, 5 static-components, 3 purity,
  2 preserve-manual-memoization); die Einstufung „harmlos" hält in 8 von 10 Stichproben (BF-12).
- **`frontend/Dockerfile:8-9` / `ci.yml:141-146` „kein --legacy-peer-deps mehr nötig"** →
  bestätigt: `npm ls` ohne `invalid`/`missing`/Peer-Konflikt in beiden Projekten.
- **`vite.config.ts:44-61` Alias `firebase/messaging` (23.09.)** → Stub
  `src/stubs/firebase-messaging-leer.ts` existiert, Build und Vitest-Alias funktionieren.
- **`backend/package.json` Override `uuid` (Commit 71effd7c, 10.06.2026)** → weiter nötig
  und begründet; `protobufjs`/`websocket-driver` inzwischen wirkungslos (BF-10).

## Geprüft und in Ordnung

- **Sicherheitslücken:** `npm audit` Backend 0 (Produktion und Dev), Root 0, Frontend 3
  moderate = eine Kette (`react-router`, `react-router-dom`, `@ionic/react-router`), zwei
  Advisories, beide nicht erreichbar (s. o.). Prüfmethode: `npm audit --json` /
  `--omit=dev` in allen drei Projekten, Code-Lesen der Navigationsziele.
- **Lockfile-Konsistenz und Peers:** `npm ls --all` in Backend und Frontend Exit 0, nur
  `UNMET OPTIONAL DEPENDENCY` (normal). Peer-Ranges geprüft: typescript-eslint 8.70.0 ↔
  TypeScript 6.0.3 (`<6.1.0`), `@vitejs/plugin-react` 6.1.1 ↔ Vite 8.2.2 (`^8.0.0`),
  Vitest 4.1.11 ↔ Vite 8 (`^6||^7||^8`), `@ionic/react-router` 9.0.3 ↔ react-router 6.30.6.
- **Doppelte Versionen im Produktionsbaum Frontend:** 137 Pakete, 1 Duplikat
  (`entities` 4.5.0/7.0.1, klein); React, Ionic, Capacitor je einmal. Dev-Baum: 19 Duplikate,
  alle Werkzeugpakete. Backend-Produktionsbaum: 313 Pakete.
- **Lizenzen (Produktionsabhängigkeiten, eigenes Skript):** Backend 313 Pakete — 233 MIT,
  37 Apache-2.0, 20 ISC, 13 BSD-3-Clause, 7 BlueOak-1.0.0, 1 0BSD, 1 BSD-2-Clause, 1 MIT-0;
  **0 Copyleft, 0 unbekannt.** Frontend 138 Pakete — 118 MIT, 8 ISC, 5 BSD-2-Clause,
  3 Apache-2.0, 1 BSD-3-Clause, 1 BlueOak-1.0.0, 1 0BSD, **1 MPL-2.0**
  (`@capgo/capacitor-native-biometric`, s. Unklar); keine GPL/AGPL/LGPL, keine unbekannte
  Lizenz (`ws@8.21.3` liegt verschachtelt unter `engine.io-client` und ist MIT).
- **Veraltete Pakete:** Backend 7 (`file-type` 22.0.2→22.1.1, `firebase-admin` 14.3.0→14.5.0,
  `multer` 2.3.0→2.4.0, `socket.io` 4.8.3→4.8.4, `supertest` 7.2.2→7.3.0; Major nur
  `nodemailer` 10, `vitest` 5), Frontend 19 (Capacitor 8.5.1→8.5.2, `@ionic/react` 9.0.3→9.0.5,
  biometric 8.6.7→8.6.11, ESLint 10.10→10.11, Vite 8.2.2→8.3.1 u. a.; Major nur `js-yaml` 5,
  `react-router` 8/`react-router-dom` 7, `typescript` 7, `vitest` 5). Kein überfälliger
  Sicherheits-Patch. `socket.io` Pin `^4.7.2` liefert 4.8.3 (4.8.4 erschien am 25.09.).
  Root: `npm outdated` ohne `node_modules` nicht messbar; Dependabot #163 meldet
  `@playwright/test` 1.63.0.
- **Node-Deprecations im Backend-Code:** grep nach `punycode`, `url.parse(`, `new Buffer(`,
  `fs.exists(`, `util._extend`, `util.isArray`, `process.binding`, `createCipher(`,
  `require('sys')`: 0 Treffer. Kein `require` eines devDependency-Pakets außerhalb `tests/`
  → `--omit=dev` ist sicher. Root `@playwright/test@1.62.1` verlangt `node >=20` → der
  Node-20-Job ist technisch kompatibel (aber EOL, BF-04).
- **Typprüfung:** `npx tsc --noEmit` im Frontend 0 Fehler (25,5 s); `strict: true`,
  `skipLibCheck: true` (üblich), `isolatedModules`, `moduleResolution: bundler`.
  `noUncheckedIndexedAccess`/`noUnusedLocals` fehlen (Hinweis, kein Befund).
- **Build:** `npm run build` erfolgreich (Exit 0, 61,6 s), 833 Module, keine Sourcemaps in
  Produktion, Version aus `version.json` via `define`, `dist/` ist gitignored.
- **Native Toolchain:** `Podfile.lock` (24.09.) stimmt für alle 17 Plugins mit den
  installierten npm-Versionen überein (Capacitor 8.5.1, App 8.1.1, Filesystem 8.1.3,
  Keyboard 8.0.5, FileViewer 2.0.3, Firebase-Plugins 8.5.2, capawesome 8.0.3; die
  capgo-Podspec trägt upstream 7.1.13 — kosmetisch, `:path`-Pod). iOS-Minimum 16.4, CocoaPods
  1.17.0, Firebase-iOS 12.17.0 einheitlich. Android: minSdk 24, compileSdk/targetSdk 36,
  AGP 8.13.1, Gradle 8.14.3, google-services 4.4.4, firebase-crashlytics-gradle 3.0.8;
  `capacitor.settings.gradle`, `capacitor.build.gradle`, `Podfile` und `includePlugins` nennen
  dieselben 17 Plugins. `npx cap copy android` läuft fehlerfrei (`cap doctor` braucht SDKs).
- **Wartungsstand der Plugins (`npm view time`):** alle Capacitor-Plugins mit Release in den
  letzten 12 Monaten — `@capacitor/core` 8.5.2 (11.09.2026), `@capgo/capacitor-native-biometric`
  8.6.11 (19.09.2026, 56 Releases/12 Monate), `@capawesome/*` 8.0.3 (02.09.2026),
  `@capacitor-firebase/*` 8.5.2 (17.09.2026), `@capacitor/file-viewer` 2.0.3 (09.09.2026),
  `@capacitor-community/file-opener` 8.0.1 (29.05.2026), `@rdlabo/*` (06./24.09.2026),
  `swiper` 14.2.0 (26.08.2026). Ohne Release seit über 12 Monaten: `qr-scanner` 1.4.2
  (23.11.2022), `qrcode` 1.5.4 (05.08.2024), `axios-retry` 4.5.0 (02.08.2024),
  `html-to-image` 1.11.13 (14.02.2025) — alle ohne Audit-Meldung, kein Handlungsbedarf.
- **Dependabot-Ignore** für `react-router`, `react-router-dom`, `@ionic/react-router` wirkt.
- **`frontend/.dockerignore`** (14.09.2026) schließt `node_modules`, `dist`, `ios`, `android`
  aus; `frontend/Dockerfile` nutzt `npm ci`.
- **Hook-Warnungen:** 8 von 10 Stichproben harmlos wie in `eslint.config.js` begründet
  (Liste in BF-12).

## Nicht geprüft

- `pod install`, Xcode-Build, `npx cap sync ios` (kein macOS).
- Gradle-Build und damit die Java-Level-Frage (kein Android-SDK; Gradle vorhanden).
- Bau der beiden Docker-Images (Aufgabe des CI-Agenten; hier nur die Abhängigkeitsseite).
- Backend-Suite auf Node 26; E2E-Lauf.
- Bundle-Zusammensetzung im Detail (kein Visualizer eingesetzt; nur Chunk-Größen).
- GitHub-Actions-Versionen (Dependabot #164 offen).

## Auf Produktion nachzumessen

- Im Backend-Container: `node --version` (26.x?), `npm ls pg node-fetch validator --depth=0`
  gegen `package-lock.json` (Drift durch `npm install pg`?), `ls /app/tests /app/node_modules/.bin | head`
  (ist `tests/` im Image, sind fremde `node_modules` hineinkopiert?), Image-Größe.
- Deprecation-Warnungen von Node 26 im Log: `docker logs <backend> 2>&1 | grep -i deprecat`.
- Tatsächliche Download-Größe der App in App Store Connect / Play Console gegen 8,5 MB
  App-Code + 33 MB docs.
- Java-Level im Android-Release-Build auf dem CI-Runner:
  `./gradlew :app:compileReleaseJavaWithJavac --info | grep -iE 'source|target'`.
- Ob die Backend-Testsuite auf Node 22 und 26 dieselben Ergebnisse liefert (CI-Job einmal auf
  `node-version: 22` laufen lassen).
