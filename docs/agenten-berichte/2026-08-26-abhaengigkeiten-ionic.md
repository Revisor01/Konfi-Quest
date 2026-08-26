# Abhängigkeits-Updates und Ionic-Plattform: Lagebild und Empfehlungen

**Auftrag:** Die sechs offenen Dependabot-PRs (#66–#71) prüfen (was ändert
sich, warum ist die CI rot, mergen ja/nein), die Sicherheitslage erheben
(Dependabot-Alerts, npm audit in frontend und backend, Produktion vs.
Dev-Werkzeuge getrennt) und den Stand der Ionic-Plattform samt der
MD3- und iOS-26-Theme-Plugins klären. Nur Analyse, kein Umbau.
**Datum:** 26.08.2026
**Geprüfter Commit:** `280686c` (main)
**Urteil in einem Satz:** Vier der sechs PRs (#66, #67, #69, #71) sind nach
einem Rebase gefahrlos mergebar — ihre rote CI ist ein Doku-Drift des alten
Basis-Commits vom 24.08., der auf main längst behoben ist —, die beiden
Major-PRs #68 (Ionic 9) und #70 (react-router 8) dürfen dagegen NICHT gemergt
werden (#70 nie: selbst Ionic 9 verlangt react-router 6.x, nicht 8), die
Sicherheitslage ist mit 0 offenen Alerts und 0 npm-audit-Funden sauber, und
die beiden rdlabo-Themes (MD3 1.1.0, iOS26 2.3.2) lassen sich schon jetzt —
ohne Ionic 9 — risikoarm auf ihre 9.0.1-Stände heben.

**Wichtige Einschränkung zur CI-Aussagekraft:** Der Job `frontend-test`
installiert mit `npm ci --legacy-peer-deps` (verschluckt Peer-Konflikte) und
führt weder `tsc` noch `vite build` noch `eslint` aus — nur die drei
Doku-Frischechecks und `vitest run --passWithNoTests`
(.github/workflows/ci.yml:100–149). Eine grüne CI beweist bei
Frontend-Abhängigkeiten also wenig; bei #68/#70 könnte sie nach Rebase sogar
grün werden, obwohl die App zur Laufzeit bricht. Nicht auf die Ampel
verlassen.

---

## Warum die CI auf allen sechs PRs rot ist (der entscheidende Befund)

`frontend-test` scheitert auf **allen sechs** PRs — auch auf #66, das nur
Backend-Pakete anfasst. Die Abhängigkeits-Änderungen sind also nicht die
Ursache. Das Log (z.B. Run 32690230128 zu #66) zeigt den echten Grund:

```
node scripts/build-openapi.mjs
##[error]openapi.json/swagger.html sind nicht auf dem Stand von docs/api/.
 frontend/public/docs/api/openapi.json | 2 +-
 frontend/public/docs/api/swagger.html | 2 +-
```

Der Frischecheck „OpenAPI aktuell?" schlug an, weil die Dependabot-Branches
auf dem main-Stand vom 24.08. 01:12 basieren (`78e404c5`). Kurz danach wurden
die OpenAPI-Quellen geändert (`b5d76109`, `39f6c023`, beide 24.08.), die
eingecheckte Ausgabe aber erst am 26.08. nachgezogen (`1708db88`
„docs(api): OpenAPI-Ausgabe auf den Stand der Quelldateien bringen"). Auf dem
heutigen main ist die CI grün (Runs vom 26.08. abends: success).

**Konsequenz:** Ein Rebase (`@dependabot rebase` als PR-Kommentar) sollte
`frontend-test` auf allen sechs PRs grün machen. Das ist eine belegte
Schlussfolgerung, kein Test — nach dem Rebase die CI ansehen, bevor gemergt
wird.

---

## Teil 1: Die sechs Dependabot-PRs

### PR #66 — backend-minor-patch: firebase-admin 14.2.0→14.3.0, vitest 4.1.10→4.1.11

- Minor + Patch, nur `/backend`. firebase-admin 14.3.0 bringt ausschließlich
  neue Data-Connect-Header (wird hier nicht genutzt), vitest ist ein
  Bugfix-Patch.
- CI: `backend-test` GRÜN (7m6s, echte Tests gegen Postgres). Der rote
  `frontend-test` ist der Doku-Drift von oben — ein Backend-PR kann ihn gar
  nicht verursacht haben.
- **EMPFEHLUNG: JETZT machen.** Rebase, CI abwarten, mergen. Risikoärmster
  der sechs PRs; der Backend-Testlauf ist hier sogar aussagekräftig.

### PR #67 — frontend-minor-patch: 7 Updates

@capacitor/camera 8.2.2→8.2.3, @capacitor/file-viewer 2.0.1→2.0.2,
@capacitor/filesystem 8.1.2→8.1.3, @vitejs/plugin-react 6.0.5→6.1.0,
cypress 15.20.1→15.21.0, vite 8.2.1→8.2.2, vitest 4.1.10→4.1.11.

- Alles Minor/Patch. Die drei Capacitor-Plugin-Patches sind reine
  Android-Build-Fixes (u.a. kotlin-android-Plugin-Doppelanwendung); der Rest
  sind Dev-Werkzeuge.
- **EMPFEHLUNG: JETZT machen.** Rebase, mergen. Einzige Nacharbeit: Da
  Capacitor-Plugins betroffen sind, beim nächsten iOS-/Android-Build (läuft
  ohnehin über die CI, nie lokal) auf einen sauberen Durchlauf achten.

### PR #68 — @ionic/react 8.8.18→9.0.0 (Major)

- **Der PR ist in sich kaputt:** Dependabot hebt nur `@ionic/react` auf 9.0.0,
  `@ionic/react-router` bleibt auf 8.8.18. Der Lockfile-Diff zeigt die Folge:
  unter `node_modules/@ionic/react-router/node_modules/` werden ein zweites
  `@ionic/react@8.8.18` und ein zweites `@ionic/core@8.8.18` eingenistet.
  Zwei Ionic-Kopien gleichzeitig heißt: Stencil-Komponenten doppelt
  registriert, Router und App reden über verschiedene Kontexte — das bricht
  zur Laufzeit, und die CI würde es nicht sehen (kein Build-Schritt).
- Ionic 9 selbst (erschienen 19.08., 9.0.1 vom 26.08.) verlangt laut
  BREAKING.md und den peerDependencies von `@ionic/react-router@9.0.1`:
  **react-router >=6.4.0 <7** (v5 fällt weg), React 18/19 (passt: React
  19.2.8), TypeScript 5.4+, Capacitor 7+ (passt: Capacitor 8.5),
  iOS 16+/Chromium 89+. Dazu: `component`-Prop wird `element`, `Redirect`
  wird `Navigate`, `RouteComponentProps` entfällt, `pickerController` und
  `ion-picker-legacy` entfernt (wird hier nicht genutzt, 0 Treffer).
- Der Migrationsumfang im Repo ist erheblich: 71 `<Route>`-Vorkommen, davon
  47 mit `component=` und 16 mit `render=` (App.tsx, MainTabs.tsx u.a.),
  5 `RouteComponentProps`-Wrapper in MainTabs.tsx:74–94, mehrere `Redirect`s,
  dazu müssen `@types/react-router`/`@types/react-router-dom` (v5-Typen)
  raus. Die 55 `useIonRouter`-Aufrufe bleiben dagegen stabil — es gibt kein
  einziges `useHistory` im Code, das hilft.
- **EMPFEHLUNG: GAR NICHT mergen (diesen PR), Migration SPÄTER als eigenes
  Vorhaben.** PR schließen. Ionic 9 ist als geplante Migration sinnvoll
  (Ionic 8 wird absehbar nur noch Fixes bekommen), aber nur als
  Gesamtpaket von Hand: @ionic/react@9.0.1 + @ionic/react-router@9.0.1 +
  react-router/react-router-dom 6.4.x + Routen-Syntax-Umbau + die beiden
  rdlabo-Themes auf 9.x + ausgiebiger Test auf Gerät. Grobschätzung: ein
  konzentrierter Arbeitstag plus Testrunde, kein Nebenbei-Merge.

### PR #69 — eslint-plugin-react-hooks 5.2.0→7.1.1 (Dev, zwei Majors)

- Nur Dev-Werkzeug; die CI lintet gar nicht (kein eslint-Schritt in ci.yml),
  Lint läuft nur lokal (`npm run lint`).
- Kompatibilität nachgemessen: 7.1.1 unterstützt ESLint ^9 UND ^10
  (peerDependencies) — 5.2.0 kann kein ESLint 10. Damit ist #69 die
  **Voraussetzung** für #71. Die in eslint.config.js verwendete Form
  `reactHooks.configs.recommended.rules` existiert in v7 weiter.
- Risiko: v7 aktiviert die neuen Compiler-gestützten Regeln — lokal kann es
  neue Warnungen geben. Da kein CI-Gate existiert, blockiert das nichts.
- **EMPFEHLUNG: JETZT machen, VOR #71.** Rebase, mergen, einmal lokal
  `npm run lint` laufen lassen und neue Hinweise sichten.

### PR #70 — react-router 5.3.4→8.3.0 (drei Majors)

- **DARF NICHT GEMERGT WERDEN — auch später nicht in dieser Form.** Belege:
  1. `@ionic/react-router@8.8.18` (installiert) verlangt als Peer
     `react-router ^5.0.1` und importiert konkret
     `import { Route, matchPath, Router } from 'react-router'` sowie
     `import { withRouter, Router } from 'react-router-dom'`
     (node_modules/@ionic/react-router/dist/index.js). `withRouter` und der
     v5-`Router` existieren ab react-router 6 nicht mehr — IonReactRouter
     bricht sofort.
  2. Selbst das neueste `@ionic/react-router@9.0.1` erlaubt nur
     `react-router >=6.4.0 <7`. **Kein Ionic-Stand unterstützt react-router
     7 oder 8.** Der Ziel-Stand dieses PRs ist für dieses Projekt schlicht
     unerreichbar.
  3. Der PR ist zusätzlich in sich inkonsistent: Er hebt nur `react-router`
     auf ^8.3.0, `react-router-dom` bleibt auf ^5.3.4 — zwei Router-Kerne
     parallel im Baum. 11 Quelldateien importieren aus `react-router-dom`.
  4. Tückisch: Wegen `--legacy-peer-deps` und fehlendem Build-Schritt könnte
     die CI nach Rebase trotzdem grün werden.
- **EMPFEHLUNG: GAR NICHT. PR schließen** und in `.github/dependabot.yml`
  einen ignore-Eintrag setzen (react-router und react-router-dom,
  `update-types: version-update:semver-major`), sonst kommt derselbe PR
  jede Woche wieder. Der Wechsel auf react-router 6.4.x passiert
  ausschließlich als Teil der Ionic-9-Migration (siehe #68).

### PR #71 — eslint 9.39.5→10.8.1 (Dev, Major)

- Nur Dev-Werkzeug, kein CI-Gate. Ökosystem nachgemessen:
  typescript-eslint 8.67 erlaubt eslint ^10, eslint-plugin-react-refresh
  0.5.4 erlaubt ^10, `@eslint/js` steht im Repo ohnehin schon auf ^10.0.1.
  Einziger Blocker: eslint-plugin-react-hooks 5.2.0 (Peer nur bis ^9) —
  genau das behebt #69. Node-Anforderung (>=20.19) ist mit Node 26 in der
  CI und lokal kein Thema.
- **EMPFEHLUNG: JETZT machen, aber NACH #69.** Reihenfolge einhalten,
  danach einmal lokal `npm run lint` prüfen (ESLint 10 hat einige
  Regel-Verschärfungen; ohne CI-Gate ist das Risiko rein lokal).

---

## Teil 2: Sicherheitslage

Sauber — und zwar durchgehend:

- **Dependabot-Alerts:** 0 offene (`gh api .../dependabot/alerts`,
  Filter state=open, leeres Ergebnis).
- **npm audit frontend:** 0 Funde (info/low/moderate/high/critical alle 0).
- **npm audit backend:** 0 Funde.

Die Trennung Produktion vs. Dev-Werkzeuge ist damit gegenstandslos — es gibt
schlicht nichts zu trennen. Keiner der sechs PRs ist ein Sicherheits-PR
(alle aus der wöchentlichen `version-updates`-Gruppe, keiner aus den
`*-security`-Gruppen); es gibt also auch keinen Zeitdruck aus der
Sicherheitsecke. Die CI prüft zusätzlich bei jedem Lauf
`npm audit --audit-level=critical` (Backend blockierend, Frontend mit
`|| true` nur informativ).

---

## Teil 3: Ionic-Plattform, MD3- und iOS-26-Theme

Was konkret gemeint ist (aus frontend/package.json und
frontend/src/theme/variables.css):

| Paket | Installiert | Neueste | Letztes Release |
|---|---|---|---|
| @ionic/react (+ core, react-router) | 8.8.18 | 9.0.1 | 26.08.2026 |
| @rdlabo/ionic-theme-md3 (MD3-Theme) | 1.1.0 | 9.0.1 | 25.08.2026 |
| @rdlabo/ionic-theme-ios26 (iOS-26-Theme, Liquid Glass) | 2.3.2 | 9.0.1 | 25.08.2026 |

Ein „iOS-27-Plugin" existiert nicht — `@rdlabo/ionic-theme-ios27` gibt es auf
npm nicht (404); rdlabo führt das iOS-Design unter dem Namen `ios26` weiter.
Beide Themes sind aktiv gepflegt (Releases diese Woche).

**Die wichtigste Erkenntnis: Die 9.x-Themes brauchen KEIN Ionic 9.** Beide
9.0.1-Stände deklarieren als Peer `@ionic/core >=8.8.0 <10` (ios26:
>=8.8.1) — die 9 im Namen ist nur Versionsgleichschaltung mit Ionic; die
Pakete laufen ausdrücklich auch mit dem installierten 8.8.18.

Kompatibilität gegen den echten Code geprüft:

- Alle fünf importierten CSS-Pfade aus variables.css:5–11
  (default-variables, ionic-theme-ios26, md-remove-ios-class-effect,
  ionic-theme-md3 usw.) existieren in den 9.0.1-Tarballs unverändert
  (per `npm pack --dry-run` verglichen).
- Alle vier genutzten JS-Exporte existieren weiter: `iosTransitionAnimation`,
  `popoverEnterAnimation`, `popoverLeaveAnimation` (App.tsx:29),
  `mdTransitionAnimation` (App.tsx:31), `registerTabBarEffect`
  (MainTabs.tsx:129, dynamischer Import).
- Der einzige dokumentierte Breaking Change beider Themes
  (CSS-Klasse `header-item-group` → `item-group-header`, seit ios26 3.0.0
  bzw. md3 2.0.0) trifft das Repo nicht: 0 Treffer im Quellcode.
- Was die Updates bringen: ios26 3.x/9.x — strukturierte zweizeilige
  Listen, bessere FAB-Positionierung, dokumentiertes Dual-Theme-Setup
  (iOS26 + MD3, genau die Konstellation hier); md3 2.x/9.x — überarbeitete
  Inset-Lists, Helper-/Fehlertexte für Select/Checkbox/Toggle/Radio,
  bessere Input-Outlines.
- Restrisiko: Es sind Theme-Pakete — API-kompatibel heißt nicht
  pixel-identisch. Ein Sichttest auf iOS- und Android-Gerät (oder Simulator)
  nach dem Update ist Pflicht, kein automatisierter Test fängt das.

Dependabot wird diese beiden Sprünge übrigens nicht anbieten
(1.1.0→9.0.1 und 2.3.2→9.0.1 sind Majors, das Limit von 5 offenen PRs ist
erreicht) — das ist ein manuelles Update.

**Ionic selbst:** Neben 9.0.0/9.0.1 gibt es auch noch 8.8.19 (19.08., ein
Gesture-Memory-Leak-Fix), das die Minor-Patch-Gruppe nicht angeboten hat,
weil für @ionic/react bereits der Major-PR #68 offen ist. Wer bei Ionic 8
bleibt, kann 8.8.19 beim nächsten manuellen Anlass mitnehmen.

---

## Handlungsempfehlung in Reihenfolge

1. **Jetzt, in dieser Reihenfolge, jeweils Rebase per `@dependabot rebase`
   und CI abwarten:**
   1. **#66** (backend-minor-patch) mergen — grüner Backend-Test ist hier
      ein echtes Signal.
   2. **#67** (frontend-minor-patch) mergen.
   3. **#69** (eslint-plugin-react-hooks 7.1.1) mergen — Voraussetzung
      für #71.
   4. **#71** (eslint 10) mergen, danach einmal lokal `npm run lint`.
2. **Jetzt, manuell (nicht via Dependabot): die beiden rdlabo-Themes auf
   9.0.1 heben** — läuft mit Ionic 8.8.18, Importpfade und Exporte bleiben
   gleich, der einzige Breaking Change trifft das Repo nicht. Danach
   Sichttest auf beiden Plattformen; das ist der günstigste Weg an die
   aktuellen MD3-/iOS-26-Verbesserungen, komplett ohne Ionic-9-Risiko.
3. **Später, als eigenes Vorhaben: Ionic-9-Migration** (#68 schließen).
   Gesamtpaket @ionic/react + @ionic/react-router 9.0.1 + react-router(-dom)
   6.4.x + Umbau von ~70 Routen (component→element, Redirect→Navigate,
   RouteComponentProps→useParams, v5-Typpakete entfernen) + Gerätetests.
   Kein Zeitdruck: keine Sicherheitslücke zwingt, und die Themes laufen auch
   auf 8.8.x weiter.
4. **Gar nicht: #70 (react-router 8) schließen** und in dependabot.yml
   Major-Updates für react-router/react-router-dom per ignore-Eintrag
   stummschalten — kein Ionic-Stand (auch 9.0.1 nicht) unterstützt
   react-router 7 oder 8; der PR würde sonst wöchentlich wiederkehren und
   wegen `--legacy-peer-deps` + fehlendem Build-Schritt in der CI sogar
   grün aussehen können.
5. **Beiläufig, aber lohnend (Beobachtung am Rande):** Dem `frontend-test`
   einen Build-Schritt (`npm run build` = tsc + vite build) spendieren.
   Genau diese Lücke ist der Grund, warum die CI bei #68/#70 nichts
   beweisen würde — mit Build-Schritt wären solche PRs automatisch
   aussortiert worden.

## Offene Punkte

- „Rebase macht die CI grün" ist eine belegte Schlussfolgerung (Ursache auf
  main behoben, main-CI grün), aber nicht ausgeführt — nach jedem Rebase
  die Checks ansehen, bevor gemergt wird.
- Die Theme-Updates sind API-seitig verifiziert (Pfade, Exporte, Peers),
  optisch aber ungetestet — der Gerätesichttest steht aus.
- Der genaue Umfang neuer Lint-Hinweise durch eslint 10 +
  react-hooks 7 wurde nicht ausgeführt (kein `npm install` in diesem
  Auftrag); erwartbar sind Warnungen, keine Blocker, da Lint nirgends
  ein Gate ist.
