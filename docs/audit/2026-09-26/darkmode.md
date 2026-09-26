# Audit Dunkelmodus — 26.09.2026

## Umfang und Methode

**Geprüft:** der Dunkelmodus der App (Frontend, Version 2.3.0 „Unreleased“) — Screen für Screen, mit
echten Bildern, für alle drei Rollen (Konfi, Teamer:in, Leitung) auf zwei Plattform-Kennungen
(iPhone-UA → Ionic-Modus `ios`, Android-UA → Ionic-Modus `md`), jeweils dunkel und hell als Vergleich.

**Wie:**

- Stack lokal gestartet: Test-DB `konfi_test` auf Port 5440 (Produktions-Schema + 36 Migrationen,
  `backend/tests/helpers/seed.js`), zusätzlich 9 Chat-Nachrichten, 2 Reaktionen, 2 Anträge,
  2 Mitteilungen, 2 Challenges und ein Rückblick (per API als `orgadmin1`) eingespielt, damit die
  Screens nicht leer sind. Backend auf 6440, Vite auf 5240.
- **400 Screenshots** mit Playwright 1.56 / Chromium 1194 (390×844, DSF 2, `colorScheme` dark/light,
  iPhone- bzw. Android-User-Agent): 16 Anmeldeseiten, 108 Konfi, 92 Teamer, 184 Leitung, darunter
  104 Modals/Overlays (Onboarding-Tour, Änderungsanzeige, Postfach, Konfispruch, Punkte-Übersicht,
  E-Mail/Passwort/Bibel, Push-Auswahl, Abmelden/Cache-Alert, Account löschen, Antrag stellen/Detail,
  Farblegende, Challenge-Detail, Neue Direktnachricht, Mitglieder, Badge-Popover, Rückblick-Intro,
  Chat-Langdruck, Anlege-Modale der Leitung, Anwesenheit). Jedes Bild wurde angesehen. Die Bilder liegen unter
  `scratchpad/darkmode/shots/<schema>-<plattform>-<rolle>-<screen>.png` (nicht im Repo).
- **Messung statt Schätzung:** ein Skript (`scratchpad/darkmode/messen.cjs`) läuft im Dunkelmodus
  über 47 Seitenzustände × 2 Plattformen = **94 Zustände**, liest für jedes sichtbare Element die
  berechneten Stile (auch im Shadow-DOM), sucht (a) deckende helle Flächen (Luminanz > 0,5,
  ≥ 40×24 px) und (b) Textknoten unter der WCAG-Grenze (4,5:1, bzw. 3:1 ab 24 px). Ergebnis in
  `messung-all.json`. Ergänzend `computed.cjs`, `hell-karte.cjs`, `regel.cjs`: berechnete Stile und
  die tatsächlich greifende CSS-Regel an konkreten Stellen.
- Code gelesen: `frontend/src/theme/variables.css` (4655 Zeilen), `colors.ts`, `abstaende.css`,
  `App.tsx`, `index.html`, `capacitor.config.ts`, Android `styles.xml`, iOS `Info.plist`, die
  Dunkelmodus-Tests (`dunkelmodus.test.ts`, `dunkelmodusJsFarben.test.ts`, `systemBars.test.ts`),
  die Ionic-Palette `dark.system.css` und die rdlabo-Themes (ios27, md3). Git-Historie gezählt.
- Die drei vorhandenen Dunkelmodus-Testdateien gezielt ausgeführt (39 Tests, alle grün).

**Bewusst nicht geprüft:** echte Geräte (kein Zugriff) — Statusleiste, Safe-Area-Einsätze,
Tastatur-Zubehörleiste, nativer Startbildschirm, WebKit-Rendering auf iOS. Chromium mit iPhone-UA
rendert Farben identisch, aber `env(safe-area-inset-*)` ist 0, die Kopfzeile sitzt deshalb am
oberen Rand, und der Glas-Weichzeichner kann auf dem Gerät anders wirken. Die Headline-Schrift
Outfit (Google Fonts) wurde im Container nicht geladen, Überschriften erscheinen in der
Ersatzschrift — für Farben ohne Belang. Allgemeine Barrierefreiheit prüft ein anderer Agent; hier
stehen nur Kontraste, die der Dunkelmodus verursacht oder nicht behebt.

## Zusammenfassung

Die Dunkelmodus-Grundlage steht: **0 helle Flächen** auf 94 gemessenen Seitenzuständen — die
weißen Karten, Eingabefelder und Anmeldeseiten aus den ersten Fix-Runden sind verschwunden.
Was bleibt, ist eine andere Klasse von Fehlern: **104 Textstellen unter der WCAG-Grenze**, davon
die schwersten auf der **Anmeldeseite** (Überschrift und alle Links in Konfi-Lila auf dunkler Karte,
1,4–1,7:1) und auf den **Dashboards** von Konfi und Teamer:in (weiße Schrift auf Verlaufsenden, die
im Dunkeln hell werden, 1,3–1,9:1). Dazu kommt die Ursache, warum Simon auf dem iPhone „nach wie
vor unglücklich“ ist: Die Karten-Aufhellung aus Commit a9815de **erreicht iOS nicht** — das
ios27-Theme schlägt die App-Regel an Spezifität, 225 Karten bleiben auf Ionics `#1c1c1d`, die
Kommentare im CSS rechnen mit einem Wert, den kein iPhone anzeigt. Auf iOS stehen so fünf
verschiedene Flächentöne auf einem Screen, Inset-Listen tiefschwarz. Die Tests sind grün, weil sie
das Stylesheet als Text prüfen, nicht das Ergebnis.

**Befunde: 0 KRITISCH, 2 HOCH, 7 MITTEL, 3 NIEDRIG.** Die drei wichtigsten: Anmeldeseite
unlesbar (BF-01), Dashboard-Verläufe (BF-02), iOS-Karten ohne Token (BF-03).

## Release-Empfehlung für den Bereich

**Mit Auflage.** Der Dunkelmodus bricht nichts und ist kein Absturz- oder Datenrisiko, aber die
Anmeldeseite — der erste Screen jedes Konfis — hat im Dunkeln Links mit 1,4:1, und die Dashboards
zeigen weiße Schrift auf Pastell. Auflage vor dem Store-Release: BF-01, BF-02, BF-03 und BF-07
beheben (zusammen wenige Stunden, alle mit Fundstelle und Zielwert unten), danach die vier
betroffenen Screens dunkel auf einem iPhone ansehen. Alles andere kann in die 2.3.x-Reihe.

## Befunde

### BF-01: Anmeldeseiten — Überschrift und Links in Bereichs-Lila auf dunkler Karte unlesbar

- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — Text-Token `--app-text-konfis` (hell = Bereichsfarbe `#5b21b6`, dunkel `#c4b5fd`) eingeführt; Überschrift, Feldbeschriftungen und Links der Anmeldeseiten (`.app-auth-card__heading h2`, `.app-auth-input__label`, `.app-auth-link`, `--muted`) schreiben damit. Gemessen dunkel, iOS und Android gleich: „Anmelden“ 1,72 → 8,39:1, „Passwort vergessen?“ 1,40 → 4,89:1, „Noch keinen Account?“ 1,72 → 8,39:1; `messen.cjs --only public` meldet 0 statt 16 Verstöße. Hell unverändert 8,98:1.
- **Fundstelle:** `frontend/src/theme/variables.css:2636` (`.app-auth-card__heading h2 { color: var(--app-color-konfis) }`),
  `:2771-2782` (`.app-auth-link`, `.app-auth-link--muted`), `:2599` (Kartengrund seit 8665b80 `var(--app-surface-card)`)
- **Kennzeichnung:** reproduziert — `node scratchpad/darkmode/messen.cjs --only public`; Bilder
  `dark-ios-public-login.png`, `dark-android-public-login.png`, `dark-ios-public-register.png`,
  `dark-ios-public-forgot-password.png`, `dark-ios-public-reset-password.png`; Vergleich `light-ios-public-login.png`
- **Beschreibung:** Commit 8665b80 machte die Anmeldekarte dunkel (`--app-surface-card`, dunkel `#242426`).
  Die Textfarben darauf blieben, was sie für die weiße Karte waren — der Kommentar in Zeile 2772
  sagt es selbst: *„Links liegen auf der weissen Card -> Lila statt Weiss (sonst unsichtbar)“*.
  Die Bereichsfarbe `--app-color-konfis` (`#5b21b6`) bleibt laut Entscheidung vom 26.09. in beiden
  Modi gleich (Zeile 3562–3568) und ist als Text auf `#242426` nicht lesbar.
- **Auswirkung aus Nutzersicht:** Ein Konfi mit dunklem Handy sieht auf der Anmeldeseite die
  Überschrift „Anmelden“ nur als dunkellila Schemen; „Passwort vergessen?“, „Noch keinen Account?“
  und „Mit Einladungscode registrieren“ sind kaum zu finden. Betrifft alle Rollen, Registrierung,
  Passwort vergessen und Passwort zurücksetzen gleichermaßen.
- **Beleg (gemessen, dunkel, iOS und Android identisch):**
  „Anmelden“ `#5b21b6` auf `#242426` = **1,72:1** (28,8 px, Grenze 3:1);
  „Passwort vergessen?“ `#4b228b` (Lila mit 0,7 Deckkraft) = **1,40:1**;
  „Noch keinen Account?“ / „Mit Einladungscode registrieren“ = **1,72:1**;
  „Einladungscode eingeben“ (Registrierung, 20,8 px) = 1,72:1; „Zurück zum Login“ = 1,72:1.
  Hell: `#5b21b6` auf `#ffffff` = 8,98:1.
- **Empfehlung:** Ein Text-Token je Bereichsfarbe einführen (`--app-color-konfis-text`), hell = Bereichsfarbe,
  dunkel = aufgehellter Ton (z. B. `#c4b5fd`, auf `#242426` 9,6:1), und die Auth-Regeln darauf umstellen.
  Gleiches Muster löst BF-06.

### BF-02: Dashboard-Karten „Ranking“ und „Events“ — weiße Schrift auf hellem Verlaufsende

- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — Verlaufsenden auf Flächen-Tokens: `--app-color-events-tief` (`#991b1b`, als Bereichsfarbe in beiden Modi gleich) und `--app-color-success-klassisch-dunkel` (hell `#155724`, dunkel `#14532d`); die Text-Tokens `--app-text-fehler` und `--app-color-success-tief` stehen in keinem Verlauf mehr (Test über alle Verläufe im Stylesheet). Gemessen dunkel auf Konfi- und Teamer-Dashboard (iOS = Android): Weiß auf Ranking-Ende 1,28 → 9,11:1, auf Events-Ende 1,90 → 8,31:1; hell unverändert 8,68 / 8,31 (Verlaufsenden weiter `#155724` / `#991b1b`).
- **Fundstelle:** `frontend/src/theme/variables.css:3115` (`.app-dashboard-section--events`: Verlauf
  `var(--app-color-events)` → `var(--app-text-fehler)`), `:3149` (`.app-dashboard-section--ranking`:
  `var(--app-color-success-klassisch)` → `var(--app-color-success-tief)`); Nutzer der Klassen:
  `frontend/src/components/konfi/views/DashboardView.tsx:621`, `konfi/views/DashboardSections.tsx:372`,
  `teamer/pages/TeamerDashboardPage.tsx:925`
- **Kennzeichnung:** reproduziert — `node scratchpad/darkmode/computed.cjs` liefert
  `ranking bg-image: linear-gradient(135deg, rgb(52,199,89) 0%, rgb(167,243,208) 100%)` und
  `events bg-image: linear-gradient(135deg, rgb(220,38,38) 0%, rgb(252,165,165) 100%)`; Bilder
  `dark-ios-konfi-dashboard-unten.png`, `dark-android-konfi-dashboard-unten.png`,
  `dark-ios-teamer-dashboard-unten.png`; Vergleich `light-ios-konfi-dashboard-unten.png`
- **Beschreibung:** Die Verläufe enden nicht auf einer Flächenfarbe, sondern auf **Text-Tokens**:
  `--app-text-fehler` (hell `#991b1b`, ein dunkles Rot für Fehlertext) und `--app-color-success-tief`
  (hell `#155724`). Im Dunkelblock werden beide — richtig für ihren Zweck als Text auf dunkler
  Statusfläche — aufgehellt (`#fca5a5`, `#a7f3d0`). Als Verlaufsende kippen die Karten damit von
  „Rot → Dunkelrot“ nach „Rot → Rosa“ und von „Grün → Dunkelgrün“ nach „Grün → Mint“, während die
  Schrift darauf fest weiß bleibt (`color: 'white'`, `rgba(255,255,255,0.7)`).
- **Auswirkung aus Nutzersicht:** Auf dem Konfi-Dashboard ist im unteren Teil der Ranking-Karte
  („Test Konfi 2 · 0 Punkte“) weiße Schrift auf Mintgrün; auf der Events-Karte von Konfi und
  Teamer:in läuft die rechte untere Ecke ins Rosa. Genau die Karten, die Simon als „Farben sind
  furchtbar“ beschrieb — nur dass die Bereichsfarbe nicht die Ursache ist, sondern das falsche Token
  am Verlaufsende.
- **Beleg:** Weiß auf Verlaufsende Ranking `#a7f3d0` = **1,28:1**, auf Verlaufsmitte 1,69:1
  (hell: 8,68:1 / 4,13:1). Weiß auf Verlaufsende Events `#fca5a5` = **1,90:1**, Mitte 3,15:1
  (hell: 8,31:1 / 6,26:1). Weiß mit 0,7 Deckkraft („0 Punkte“) entsprechend schlechter.
- **Empfehlung:** Verlaufsenden auf Flächen-Tokens setzen (`--app-color-events-dunkel`,
  `--app-color-gemeinde` o. ä.), wie es `--konfispruch`, `--tageslosung`, `--challenges` in denselben
  Zeilen bereits tun. Eine Test-Regel: Ein `--app-text-*`-Token darf in keinem `background` stehen
  (heute 3 Treffer: Zeile 3115, `:4320` und `:1548` als `rgba(var(--app-text-system-rgb), 0.08)`).

### BF-03: iOS — der Kartengrund aus dem Dunkelblock erreicht keine einzige `ion-card`

- **Schwere:** MITTEL (Inkonsistenz; zugleich die Ursache für „Karten setzen sich nicht ab“ auf dem iPhone)
- **Status:** behoben 26.09.2026 — Kartenregel steht unter `:root.ios` / `:root.md` (Spezifität (0,4,1) gegen (0,3,1) des Themes; Ionic setzt die Modus-Klasse auf `<html>`), gewinnt also unabhängig von der Ladereihenfolge. Der Inline-Flicken in `PostfachModal.tsx` ist entfernt; die anderen vier Treffer von `'--background': 'var(--app-surface-card)'` sind keine Karten-Flicken (drei `IonItem` in `OrganizationManagementModal.tsx`, ein `IonContent` in `QRDisplayModal.tsx` — gestaltete Flächen, nicht `ion-card.app-card`) und bleiben. Gemessen mit `hell-karte.cjs`: dunkel iOS `rgb(28,28,29)` → `rgb(36,36,38)`, Android weiter `rgb(36,36,38)`, hell beide `rgb(255,255,255)`. Test: `dunkelmodus.test.ts` rechnet die Spezifität jedes Selektors der Kartenregel gegen jeden Karten-Selektor des Themes nach (Rücknahme auf `ion-card.app-card:not(…)` macht ihn rot) und verbietet Inline-Kartengründe an `app-card`. BF-04 bleibt offen: Ionics `:root.ios { --ion-item-background }` hat (0,2,0) und schlägt eine Zeile im `:root`-Dunkelblock — das braucht die plattformweise Flächen-Stufenleiter des empfohlenen Wegs, keine Einzelzeile.
- **Fundstelle:** `frontend/src/theme/variables.css:396` (`ion-card.app-card:not(.ios-theme-disabled) { --background: var(--app-surface-card) }`),
  `:3741` (Token `--app-surface-card: #242426`, davor der Kommentar „iOS dL* 14,27“),
  `node_modules/@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27.css` (Regel
  `ion-card.ios:not(.ios-theme-disabled, .ios26-disabled):not(.ion-color) { --background: var(--ion-card-background, …) }`),
  `frontend/src/components/common/PostfachModal.tsx:309-320` (Inline-Flicken mit dem Kommentar
  „Welche Variable im Modal abweicht, liess sich im CSS nicht belegen — deshalb hier fest“)
- **Kennzeichnung:** reproduziert — `node scratchpad/darkmode/hell-karte.cjs`:

  ```
  light ios     karteGerendert rgb(255,255,255)  tokenSurfaceCard #ffffff
  light android karteGerendert rgb(255,255,255)  tokenSurfaceCard #ffffff
  dark  ios     karteGerendert rgb(28,28,29)     tokenSurfaceCard #242426   <- Token greift nicht
  dark  android karteGerendert rgb(36,36,38)     tokenSurfaceCard #242426
  ```

  `node scratchpad/darkmode/regel.cjs` listet die drei Regeln, die `--background` an Karten setzen.
- **Beschreibung:** Die Theme-Regel hat Spezifität (0,3,1) — `ion-card` + `.ios` + `:not(.ios-theme-disabled, …)`
  + `:not(.ion-color)` —, die App-Regel (0,2,1). Auf iOS gewinnt das Theme, `--background` fällt auf
  `--ion-card-background`, das Ionics `dark.system.css` für `:root.ios` auf `#1c1c1d` setzt. Auf
  Android (`.md`) greift die Theme-Regel nicht, dort kommt das App-Token an. **Im Hellmodus ist der
  Fehler unsichtbar**, weil beide Wege bei `#ffffff` landen — deshalb fiel es nie auf. Commit a9815de
  („Flächen im Dunkeln abgesetzt“) hob das Token von `#1c1c1e` auf `#242426` und begründet das im
  Kommentar mit „iOS dL* 14,27“; gerendert sind es auf iOS weiterhin dL* **10,30** (`#1c1c1d` gegen
  `#000000`). Fünf Karten wurden inzwischen einzeln per Inline-Style geflickt
  (`'--background': 'var(--app-surface-card)'`, 5 Treffer), 225 `<IonCard className="app-card">`
  nicht.
- **Auswirkung aus Nutzersicht:** Auf dem iPhone sehen Karten im Dunkeln fast so aus wie vor dem
  Fix — Simons Rückmeldung „Könntest du die Listenelemente im Darkmode etwas absetzen“ ist damit
  auf seinem Gerät nicht erledigt, obwohl CHANGELOG (Zeile 124–127) und Handbuch es versprechen.
  Postfach-Karte (geflickt) und Nachbarkarten haben zwei verschiedene Grautöne.
- **Beleg:** siehe Skriptausgabe oben; Bilder `dark-ios-teamer-material.png` (Karte `#1c1c1d`) gegen
  `dark-android-admin-material.png` (Karte `#242426`).
- **Empfehlung:** Spezifität der App-Regel über die des Themes heben (z. B. `ion-card.app-card.ios,
  ion-card.app-card.md { … }` oder `:where()` im Theme-Import), die 5 Inline-Flicken entfernen und
  einen gerenderten Test (Playwright, `getComputedStyle(card).backgroundColor === #242426` auf iOS
  **und** md) dazulegen — der CSS-Text-Test kann das nicht sehen.

### BF-04: iOS — fünf Flächentöne auf einem Screen, Inset-Listen tiefschwarz

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — Ionics Flächenvariablen hängen im Dunkelblock je Plattform an den App-Tokens (`html:root.ios` / `html:root.md`, Spezifität (0,2,1) gegen Ionics (0,2,0)): `--ion-item-background` und `--ion-card-background` = `--app-surface-card`, die md-Kopfleiste im Leisten-Ton (`--app-glasleiste-rgb`, deckend), md-Meldungen und Aktionsblätter im Kartenton (`--ion-overlay-background-color`), iOS-Modale per `inherit` auf Seitengrund und Glasleiste statt Ionics angehobener Stufen (`html:root.ios ion-modal`, (0,2,2) gegen (0,2,1)). `--ion-background-color` bleibt Ionics (Begründung im Dunkelblock). Gemessen (Playwright, 94 Zustände dunkel): Such-Item der Konfi-Verwaltung auf iOS `rgb(0,0,0)` → `rgb(36,36,38)` (= Kartenton), Android `#1e1e1e` → `#242426`; neutrale Flächentöne je Screen auf Android höchstens 5 → 4, Zustände mit mehr als drei Tönen 20 → 5 (die fünf: gedämpfte Stempel-Kacheln `#323234` als vierte Stufe neben Grund, Leiste, Karte — gewollt); Kontrastverstöße unverändert 84 (Flächen, nicht Schrift). Hell: 132 von 148 Screenshots pixelgleich, die 16 Abweichler sind Tageslosung und Kopfzeilen-Animation, keine Farbe — der Diff liegt vollständig im `@media (prefers-color-scheme: dark)`-Block. Test: Spezifitäts-Rechner gegen jede Regel aus `dark.system.css` für dieselbe Variable, Plattform und dasselbe Zielelement.
- **Fundstelle:** `node_modules/@ionic/react/css/palettes/dark.system.css` (`:root.ios { --ion-background-color: #000000; --ion-item-background: #000000; --ion-card-background: #1c1c1d }`;
  `:root.md { --ion-background-color: #121212; --ion-item-background: #1e1e1e; --ion-card-background: #1e1e1e }`);
  `frontend/src/theme/variables.css:3572-3794` (Dunkelblock definiert **ausschließlich** `--app-*`-Tokens plus
  `--ion-toolbar-color`; keine Zeile bindet `--ion-item-background`, `--ion-card-background` oder
  `--ion-background-color` an die App-Stufenleiter); 222 `<IonList inset>` in 78 Komponenten
- **Kennzeichnung:** reproduziert — `computed.cjs`: `admin/konfis Such-ion-item … native: rgb(0,0,0)` (iOS)
  bzw. `rgb(30,30,30)` (Android); Bilder `dark-ios-admin-konfis.png`, `dark-ios-admin-events.png`,
  `dark-ios-admin-organizations.png`, `dark-ios-konfi-badges.png`, `dark-ios-konfi-m-chat-neu.png`,
  `dark-ios-admin-m-konfi-anlegen.png`, `dark-ios-konfi-m-antrag-stellen.png` (Auswahlfeld „Aktivität auswählen“)
- **Beschreibung:** Die App legt ihre eigene Stufenleiter fest (Grund-Verlauf `#121212 → #1f1f22`,
  Karte `#242426`, gedämpft `#323234`, Ladefläche `#3a3a3c`), lässt aber Ionics Flächen-Variablen
  unangetastet. Auf iOS stehen deshalb auf der Konfi-Verwaltung der Leitung: Seitenverlauf
  `#121212–#1f1f22`, Suchfeld/Filter-Liste `#000000` (Ionic `--ion-item-background`), Karten `#1c1c1d`
  (BF-03), Glasleiste `rgba(28,28,30,0.72)`, Postfach-Karte `#242426`. Das Handbuch schreibt „Karten und
  Listen sind dabei etwas heller als der Hintergrund“ (`docs/handbuch/03-bedienung.md:125`) — die
  Inset-Listen sind auf iOS dunkler als der Hintergrund (dL* −14,27 gegen die Sollkarte).
- **Auswirkung aus Nutzersicht:** Suchfelder und Filter wirken auf dem iPhone wie schwarze Löcher
  im dunkelgrauen Seitengrund; die Seite sieht zusammengesetzt aus, nicht gestaltet. Auf Android ist
  derselbe Screen stimmig (Items `#1e1e1e` knapp über `#121212`).
- **Beleg:** Skriptausgabe oben; Bild `dark-ios-admin-konfis.png` gegen `dark-android-admin-konfis.png`.
- **Empfehlung:** Im Dunkelblock (und im Hellblock) die Ionic-Flächen an die App-Tokens binden:
  `--ion-background-color`, `--ion-item-background`, `--ion-card-background`,
  `--ion-toolbar-background`, `--ion-tab-bar-background` — je Plattform, weil Ionic sie je Plattform
  setzt. Dann gibt es eine Stufenleiter statt zwei.

### BF-05: `--app-text-muted` fällt an 45 Stellen unter 4,5:1

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — `--app-text-muted` dunkel `#7c7c82` → `#9c9ca1` (Karte 3,74 → 5,67:1, gedämpfte Fläche `#323234` 3,08 → 4,68:1), in der Rangfolge nachgezogen `--app-text-tertiary` `#8e8e93` → `#a0a0a5` (Karte 4,75 → 5,95:1, gedämpft 3,92 → 4,91:1) und `--app-text-system` `#98989d` → `#a5a5aa` (5,40 → 6,32:1); hell dieselben drei Tokens auf ≥ 4,5:1 (UI-Audit BF-04). Gemessen (94 Zustände dunkel): Messstellen mit `#7c7c82` 44 → 0 (Stempel-Namen, Leerzustände, „/ 20"-Zähler), Verstöße gesamt 77 → 33. Das Token steht jetzt in der Kartenprüfung des Tests; ein eigener Test rechnet die vier Grautöne dunkel gegen Karte, gedämpfte Fläche, Matrix-Kopfzeile und beide Seitengründe und hält die Rangfolge.
- **Fundstelle:** `frontend/src/theme/variables.css:3699` (dunkel `#7c7c82`), Nutzer u. a. `:1467`
  (`.app-empty-state__text`), Stempel-/Badge-Kacheln (Name unter dem Symbol, auf `--app-surface-muted #323234`);
  `frontend/src/__tests__/components/dunkelmodus.test.ts:225` (Kontrastprüfung listet 9 Text-Tokens — `--app-text-muted` fehlt)
- **Kennzeichnung:** reproduziert — `messung-all.json`: 45 Treffer mit `vorder: #7c7c82`; Bilder
  `dark-ios-konfi-challenges.png` („Ortskundig“, „Segensb…“), `dark-ios-teamer-material.png`
  („Noch keine Materialien vorhanden.“), `dark-ios-admin-konfi-detail-unten.png` („Noch keine Badges erreicht“)
- **Beschreibung:** Das Token ist im Hellen `#999` und im Dunkeln `#7c7c82` — für den Dunkelblock
  wurde es *abgedunkelt* statt aufgehellt. Auf der gedämpften Fläche `#323234` (Stempel-Kacheln)
  ergibt das 3,08:1, auf der Karte `#242426` 3,74:1, auf Ionics iOS-Karte `#1c1c1d` 4,11:1.
- **Auswirkung aus Nutzersicht:** Namen der Stempel, alle Leerzustands-Texte („Du bist noch für
  keine Events angemeldet“, „Noch keine Aktivitäten gemeldet“, „Sammle Punkte für deine ersten
  Badges!“) und die Zähler „/ 20“, „0 / 10“ auf der Konfi-Karte der Leitung sind im Dunkeln blass.
- **Beleg:** 22 Stellen auf `#323234` = 3,08:1; 13 auf `#242426` = 3,74:1; 10 auf `#1c1c1d` = 4,11:1.
- **Empfehlung:** Dunkel auf ≥ `#98989d` (auf `#323234` 4,7:1; auf `#242426` 5,5:1) heben und das Token
  in die Kontrastprüfung des Tests aufnehmen — dort fehlt es als einziges Text-Token.

### BF-06: Bereichsfarben als Textfarbe — 234 Stellen ohne dunkle Text-Variante

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — Text-Token-Familie `--app-text-<bereich>` (+ `-rgb`) für 20 Bereiche nach dem Muster von BF-01: hell = Bereichsfarbe (im Hellen ändert sich nichts), dunkel die aufgehellte Stufe derselben Farbreihe mit ≥ 4,5:1 auf Karte `#242426` **und** beiden Seitengründen (events `#f87171` 5,60, activities `#34d399` 8,06, teamer `#f472b6` 5,85, challenges `#818cf8` 5,19, users `#a5b4fc` 7,77, wrapped `#a78bfa` 5,69, jahrgang/gottesdienst `#60a5fa` 6,09, gemeinde `#6ee7b7` 10,16, badges `#fbbf24` 9,28, chat `#22d3ee` 8,57 …). Umgestellt per Codemod (`scratchpad/darkmode-k/codemod-textfarben.mjs`, nur `color`/`--color*` in `style={{}}` und im Stylesheet; Flächen, Ränder, Verläufe unangetastet): 110 Stellen in 34 Komponenten und 24 Regeln in `variables.css`; vier Stellen auf Statusflächen der Anmeldeseiten von Hand auf die Status-Text-Tokens. Nachgezählt gegen die 234 des Berichts: in `.tsx` 227 Vorkommen (110 in `style`-Blöcken umgestellt, 113 Datenfelder von Folien, Kacheln und Legenden — ihr Wert landet als Fläche oder als Schrift auf einem in beiden Modi weißen Knopf, bleibt daher absichtlich —, 4× `--app-color-wrapped-hell` auf eigenem dunklen Grund), im Stylesheet 29 (24 umgestellt, 4 Handstellen, 1 Ausnahme: Sperrbildschirm-Knopf, weiß in beiden Modi). Gemessen (94 Zustände dunkel): 84 → 77 Verstöße, alle 7 Bereichsfarben-Stellen der Messung weg („Gesamt" 1,72 → 8,39:1, „Godi" 4,21 → 6,09:1, „Gemeinde" 4,11 → 10,16:1, Hinweiskasten Einladung 4,33 → 6,09:1), keine neue Stelle. Test: hell = Bereichsfarbe, dunkel ≥ 4,5:1 auf vier Gründen, „keine Bereichsfarbe als Textfarbe" in `.tsx` (Restbestand 4, mit Grund) und `.css` (Ausnahmeliste mit Grund, Ausnahme muss `--app-weiss` als Fläche tragen).
- **Fundstelle:** 205 Inline-Stellen `color: 'var(--app-color-<bereich>)'` in 56 `.tsx`-Dateien
  (users 50, konfis 39, events 39, challenges 26, chat 25, teamer 21, material 20, activities 20 …) plus
  29 Regeln in `variables.css`; konkret `variables.css:1536-1560` (`.app-info-box--blue/--neutral/--purple/…`
  mit `color: var(--app-color-…)`), `:2635`, `:2771`; Entscheidung „Bereichsfarben bleiben original“
  `:3562-3568`, festgeschrieben in `dunkelmodus.test.ts:475`
- **Kennzeichnung:** reproduziert — Bilder `dark-ios-konfi-m-email-aendern.png` (Hinweiskasten lila
  auf dunkel), `dark-ios-admin-m-wrapped-anlegen.png` (Hinweis violett), `dark-ios-teamer-m-push-einstellungen.png`
  (trotz des Dateinamens das Modal „E-Mail ändern“ der Teamer:in — Hinweis beerenrot),
  `dark-ios-admin-konfis.png` („Gesamt“ unter dem Balken)
- **Beschreibung:** Die Bereichsfarben sind als **Flächen** für Kopfbereiche mit weißem Text
  gewählt und bleiben — Simons Entscheidung — in beiden Modi gleich. Dieselben Tokens dienen an 234
  Stellen als **Textfarbe** auf Karten und Hinweiskästen. Im Hellen funktioniert das (Lila auf Weiß
  8,98:1), im Dunkeln nicht: Es gibt kein `-text`-Gegenstück, das auf dunklem Grund aufhellt.
- **Auswirkung aus Nutzersicht:** Hinweiskästen („Diese E-Mail-Adresse wird für Passwort-Reset …“,
  „Gezählt wird die ganze Konfi-Zeit …“), Beschriftungen wie „Gesamt“ und alle Anmelde-Links (BF-01)
  sind im Dunkeln schwer lesbar; je Bereich unterschiedlich stark.
- **Beleg (dunkel, gemessen bzw. aus gerenderten Farben gerechnet):** Konfi-Lila `#5b21b6` auf
  Karte `#242426` = **1,72:1**; `.app-info-box--purple` Text auf gemischtem Grund `#1d1926` = **1,92:1**
  (hell 7,81:1); `--teamer` `#be185d` = **2,83:1**; `--wrapped` `#7c3aed` = **2,94:1**; `--blue`
  (`--app-color-jahrgang #007aff`) = 4,06:1. Bereichsfarben auf `#242426` insgesamt: konfis 1,72,
  challenges 2,46, teamer 2,57, wrapped 2,72, activities 2,83, events 3,21, jahrgang 3,86, gemeinde 4,11,
  gottesdienst 4,21, users 4,23 — nur chat (6,38) und badges (7,21) bestehen.
- **Empfehlung:** Je Bereichsfarbe ein Text-Token (`--app-color-<bereich>-text`), hell = Bereichsfarbe,
  dunkel = Ton mit ≥ 4,5:1 auf `#242426`; die 234 Stellen per Codemod umstellen; Lint-Regel: `color:` darf
  kein reines `--app-color-<bereich>` mehr tragen (nur `-text`).

### BF-07: Chat — Reaktionszähler an fremden Nachrichten unsichtbar

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — Zählertext an fremden Nachrichten auf `var(--app-text-emphasis)`, Chip-Grund auf `rgba(var(--app-text-system-rgb), 0.12)`; beides folgt dem Modus, die eigene (türkise) Blase behält Weiß. Mitgenommen, weil gleiches Muster in derselben Datei: der Platzhalter gelöschter Nachrichten (`MessageBubble.tsx:339`, `rgba(0,0,0,0.5)` auf der fremden Blase) schreibt ebenfalls mit `--app-text-emphasis`. Gemessen im Chatraum mit Reaktionen (iOS = Android): dunkel Zähler auf Chip 1,25 → 11,47:1 (Chip mit eigener Reaktion 1,53 → 11,39:1), hell 9,55 → 14,72:1. Test: `dunkelmodus.test.ts` zählt `rgba(0,0,0,…)` als Inline-Textfarbe je Datei (auch hinter `? :`) und erlaubt nur den benannten Bestand — vier Hinweistexte der Anmeldeseiten, siehe Nebenbefund; `MessageBubble.tsx` ist sauber.
- **Fundstelle:** `frontend/src/components/chat/MessageBubble.tsx:769` (`color: isOwnMessage ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.75)'`),
  `:748` (Chip-Grund `rgba(0,0,0,0.05)`), Blase `:214` (`var(--app-surface-soft)`, dunkel `#242426`)
- **Kennzeichnung:** reproduziert — `computed.cjs`: `chat reaktions-chip … color rgba(0,0,0,0.75), chipBg rgba(0,0,0,0.05), blaseBg rgb(36,36,38)`;
  Bild `dark-ios-konfi-chat-raum.png` (unter „Hallo zusammen!“: Herz-Chip mit kaum sichtbarer „1“)
- **Beschreibung:** Commit 69a6023 stellte die Reaktions-**Farben** auf Tokens um; die Zähler-Schrift
  und der Chip-Grund blieben als rohes `rgba(0,0,0,…)` — Schwarz mit Deckkraft, gedacht für die weiße
  Blase. Auf der dunklen Blase ergibt das schwarze Schrift auf fast schwarzem Chip.
- **Auswirkung aus Nutzersicht:** Konfis sehen im Dunkeln nicht, wie viele auf eine Nachricht
  reagiert haben — der Chip wirkt leer.
- **Beleg:** Zählertext `#09090a` auf Chip `#222224` = **1,25:1** (hell: `#404040` auf `#f0f0f0` = 9,10:1).
- **Empfehlung:** `var(--app-text-primary)` bzw. `rgba(var(--ion-text-color-rgb), 0.75)` und Chip-Grund
  `rgba(var(--ion-text-color-rgb), 0.06)` — folgt dann beiden Modi.

### BF-08: „Zur Teamer:in befördern“ — schwarze Schrift auf Lila

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — `'--color': 'var(--app-weiss)'` an beiden Knöpfen (`KonfiDetailSections.tsx`, `OrganizationManagementModal.tsx` „Hinzufügen“). Gemessen (iOS = Android): dunkel 2,34 → 8,98:1, hell unverändert 8,98:1. Test: `dunkelmodus.test.ts` verbietet `IonButton` mit inline `--background` ohne `--color` (vorher genau diese zwei Treffer, jetzt 0).
- **Fundstelle:** `frontend/src/components/admin/views/KonfiDetailSections.tsx:1278`
  (`style={{ '--background': 'var(--app-color-konfis)', '--background-hover': … }}` ohne `--color`);
  gleiches Muster `admin/modals/OrganizationManagementModal.tsx:1124` (`users`, dort 5,74:1, also
  lesbar, aber zufällig)
- **Kennzeichnung:** reproduziert — `computed.cjs`: `konfi-detail Befoerdern-Button: text rgb(0,0,0), bg rgb(91,33,182)`;
  Bild `dark-ios-admin-konfi-detail-unten.png`, `dark-android-admin-konfi-detail-unten.png`
- **Beschreibung:** Ionics Dunkelpalette setzt `--ion-color-primary-contrast: #000` (Schwarz auf
  hellem Blau). Der Knopf überschreibt nur den Hintergrund mit dem dunklen Konfi-Lila und erbt die
  schwarze Kontrastfarbe. Die CSS-Klassen `.app-modal-submit-btn--*` (`variables.css:2340-2386`) machen
  es richtig (`--color: white`), dieser Knopf nutzt sie nicht.
- **Auswirkung aus Nutzersicht:** Die Leitung sieht im Dunkeln einen lila Knopf mit schwarzer
  Beschriftung; die Aktion ist gefährlich („kann nicht rückgängig gemacht werden“) und schlecht lesbar.
- **Beleg:** `#000000` auf `#5b21b6` = **2,34:1** (hell mit Ionic-Kontrast Weiß: 8,98:1).
- **Empfehlung:** `--color: var(--app-weiss)` dazu, besser die vorhandene Klasse `app-modal-submit-btn--konfi`
  nutzen; Lint: `'--background'` an `IonButton` nie ohne `'--color'`.

### BF-09: Die Dunkelmodus-Tests sind grün, obwohl 104 Stellen unter der Grenze liegen

- **Schwere:** MITTEL (Verstoß gegen CLAUDE.md: „Ein grüner Test beweist nichts, wenn er den Fehlerfall nicht erreicht“)
- **Status:** teilweise behoben 26.09.2026 — die Bausteine 1–3 sind eingebaut und nachgemessen (104 → 33 Verstöße, Abschnitt „Nachmessung"); der gerenderte Messlauf als wiederholbarer Test (Baustein 4) fehlt noch.
- **Fundstelle:** `frontend/src/__tests__/components/dunkelmodus.test.ts` (39 Tests in drei Dateien, alle
  grün: `npx vitest run src/__tests__/components/dunkelmodus.test.ts src/__tests__/components/dunkelmodusJsFarben.test.ts src/__tests__/config/systemBars.test.ts`),
  Kontrastprüfung `:222-236` (9 Tokens auf einem Grund), Ausnahmeliste `GLEICH_IN_BEIDEN_MODI` mit **36**
  Einträgen `:80-120`, Karten-Behauptung „dL* mindestens 8“ `:306` (rechnet mit dem Token, nicht mit dem Rendering)
- **Kennzeichnung:** reproduziert — Testlauf grün (Ausgabe: `Tests 39 passed (39)`), Messung derselben
  Version: 104 Kontrastverstöße, Karten-Token auf iOS nicht wirksam (BF-03)
- **Beschreibung:** Alle Tests lesen `variables.css` als Text (RegEx über den `@media`-Block). Sie
  prüfen, *dass* ein dunkles Token existiert, nicht *wo* es landet und *ob es greift*. Die
  Kontrastprüfung kennt genau eine Paarung (Text-Token auf `--app-surface-card`) und lässt
  `--app-text-muted`, alle Bereichsfarben-als-Text, Verlaufsenden und Ionic-Kontrastfarben aus. Der
  Kommentar zur Karte behauptet einen iOS-Wert, den der Test aus dem Token ableitet und der im
  Browser nicht existiert.
- **Auswirkung aus Nutzersicht:** indirekt — jeder der drei Fix-Commits vom 26.09. lief mit grünen
  Tests durch und ließ die hier gemessenen Löcher offen; die Rückmeldung kam vom Gerät, nicht von der CI.
- **Beleg:** siehe oben; `messung-all.json` (94 Zustände, 104 Verstöße, 0 helle Flächen).
- **Empfehlung:** Einen gerenderten Test ergänzen (Playwright, `colorScheme: 'dark'`, iOS- und
  Android-UA), der je Screen die Textkontraste misst — das Skript `messen.cjs` aus diesem Audit ist
  ein Prototyp dafür — und den CSS-Text-Test auf die Frage beschränken, die er beantworten kann.

### BF-10: Abzeichen-Kriterienfarben leben als 17 rohe Hexwerte außerhalb der Tokens

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/utils/badgeCriteria.ts:66-81` (17 Hexwerte), `:104` (`CRITERIA_FALLBACK_COLOR`)
- **Kennzeichnung:** reproduziert — `messung-all.json`: „0%“-Ring `#eb445a` auf `#1c1c1d` = 4,47:1 (iOS),
  auf `#242426` = 4,06:1 (Android); Bild `dark-ios-konfi-badges.png`
- **Beschreibung:** Die einzigen Hex-Farben außerhalb des Themes (24 Treffer in 5 Dateien, davon 17 hier,
  der Rest in Kommentaren). Sie färben Symbolkreise (unkritisch) und den Fortschrittsring-Text.
- **Auswirkung aus Nutzersicht:** Die Prozentzahl im Ring der Badges („0%“) ist im Dunkeln knapp unter lesbar.
- **Empfehlung:** In `colors.ts`/Tokens überführen; für Text im Ring `--app-text-secondary`.

### BF-11: Doku widerspricht sich und dem Rendering

- **Schwere:** NIEDRIG
- **Status:** behoben 26.09.2026 — der Systemleisten-Eintrag im CHANGELOG sagt jetzt „folgen dem Telefon" statt „immer dunkel"; der Handbuch-Satz zu Karten und Listen ist seit BF-04 auf beiden Plattformen wahr und nennt sie ausdrücklich („auf iPhone und Android gleich, und ebenso bei Suchfeldern, Auswahllisten, Meldungen …"); `dunkelmodus.test.ts` prüft den Satz gegen die Datei.
- **Fundstelle:** `CHANGELOG.md:42-47` („Die App folgt dem Dunkelmodus des Handys“) gegen `:254-257`
  („Sie sind jetzt immer dunkel und damit lesbar — die App hat keinen Dunkelmodus, also passt das
  überall“) — beide im selben Block `[Unreleased] - 2.3.0`; `docs/handbuch/03-bedienung.md:124-127`
  („Karten und Listen … etwas heller als der Hintergrund“) gegen BF-03/BF-04 auf iOS
- **Kennzeichnung:** aus Code gelesen (CHANGELOG), reproduziert (Handbuch-Aussage gegen Messung)
- **Beschreibung:** Der Eintrag zu den Android-Systemleisten beschreibt den Stand vor dem
  Dunkelmodus (Symbole „immer dunkel“); `capacitor.config.ts` steht inzwischen auf `style: 'DEFAULT'`
  (Symbole folgen dem Telefon). Nutzer:innen lesen im Release-Text zwei gegensätzliche Sätze.
- **Auswirkung aus Nutzersicht:** Verwirrung im Änderungsprotokoll; das Handbuch beschreibt für iPhone-Nutzer:innen einen Zustand, den sie nicht sehen.
- **Empfehlung:** Den Systemleisten-Eintrag auf „folgen dem Telefon“ umschreiben; Handbuch-Satz erst nach BF-03/04 wieder wahr.

### BF-12: Kein dunkler Bild- und Regressionspfad

- **Schwere:** NIEDRIG
- **Fundstelle:** `scripts/screenshots.mjs` (kein `colorScheme`, 0 Treffer für „dark“), `docs/screenshots/`
  (nur helle Bilder), `e2e/` und `frontend/src` (0 Treffer `toHaveScreenshot`/`toMatchSnapshot`)
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Es gibt keinen automatisierten Weg, den Dunkelmodus zu *sehen*. Jede Prüfung
  lief bisher auf Simons Gerät.
- **Auswirkung aus Nutzersicht:** indirekt — jede Farbänderung kann den Dunkelmodus still zurückwerfen.
- **Empfehlung:** siehe „Empfohlener Weg“.

## Screen-Matrix

Dunkelmodus, je Rolle und Plattform. „ok“ = keine Auffälligkeit im Bild und keine Messstelle unter
der Grenze; BF-Nummern = sichtbar betroffen; „–“ = für die Rolle nicht vorhanden. Alle Bilder unter
`scratchpad/darkmode/shots/dark-<ios|android>-<rolle>-<screen>.png`.

| Screen | Konfi iOS | Konfi Android | Teamer iOS | Teamer Android | Leitung iOS | Leitung Android |
|---|---|---|---|---|---|---|
| Anmeldung / Registrierung / Passwort vergessen / zurücksetzen | BF-01 | BF-01 | BF-01 | BF-01 | BF-01 | BF-01 |
| Onboarding-Tour (2 Folien) | ok | ok | ok | ok | ok | ok |
| Änderungsanzeige 2.3 (2 Folien) | ok | ok | ok | ok | ok | ok |
| Dashboard / Start (oben) | ok | ok | ok | ok | – | – |
| Dashboard / Start (unten: Badges, Ranking, Events) | BF-02 | BF-02 | BF-02 | BF-02 | – | – |
| Chat-Übersicht | BF-03 BF-04 | ok | BF-03 BF-04 | ok | BF-03 BF-04 | ok |
| Chat-Raum mit Nachrichten und Reaktionen | BF-07 | BF-07 | BF-07 | BF-07 | BF-07 | BF-07 |
| Neue Direktnachricht (Modal) | BF-04 | ok | BF-04 | ok | BF-04 | ok |
| Mitglieder (Modal) | ok | ok | – | – | – | – |
| Challenges (Liste) | BF-05 | BF-05 | BF-05 | BF-05 | BF-05 | BF-05 |
| Challenge-Detail (Modal) | ok | ok | ok | ok | – | – |
| Mitmachen: Events (Liste) | BF-03 BF-05 | BF-05 | BF-03 BF-05 | BF-05 | BF-03 BF-04 | ok |
| Mitmachen: Anträge / Aktivitäten | BF-03 BF-05 | BF-05 | BF-03 BF-05 | BF-05 | BF-03 | ok |
| Antrag stellen (Modal) | BF-04 | ok | – | – | – | – |
| Antrag-Detail / Aktivität prüfen (Modal) | ok | ok | ok | ok | ok | ok |
| Termin-Detail | ok | ok | ok | ok | BF-03 | ok |
| Farblegende Events (Modal) | ok | ok | – | – | – | – |
| Badges (Liste, Stempel) | BF-04 BF-05 BF-10 | BF-05 BF-10 | BF-03 BF-05 | BF-05 | BF-03 BF-04 BF-05 | BF-05 |
| Badge-Popover | ok | ok | – | – | – | – |
| Profil (oben) | ok | ok | ok | ok | ok | ok |
| Profil (unten: Konto, Abmelden, Löschen) | BF-03 | ok | BF-03 | ok | BF-03 | ok |
| Postfach (Modal) | ok | ok | ok | ok | ok | ok |
| Punkte-Übersicht, Konfispruch, Bibelübersetzung (Modale) | ok | ok | – | – | – | – |
| E-Mail ändern (Modal) | BF-06 | BF-06 | BF-06 | BF-06 | – | – |
| Passwort ändern, Account löschen (Modale) | ok | ok | ok | ok | ok | ok |
| Push-Auswahl (Modal) | nicht erfasst | nicht erfasst | nicht erfasst | nicht erfasst | – | – |
| Chat-Langdruck (Aktionsleiste unter der Blase) | ok | ok | – | – | – | – |
| Abmelden-/Cache-Alert | ok | ok | ok | ok | ok | ok |
| Rückblick (Intro-Folie) | ok | – | – | – | – | – |
| Material | – | – | BF-03 BF-05 | BF-05 | BF-03 BF-04 BF-05 | BF-05 |
| Konfi-Historie (Teamer) | – | – | BF-03 | ok | – | – |
| Konfis (Leitung) | – | – | – | – | BF-03 BF-04 BF-05 BF-06 | BF-05 BF-06 |
| Konfi-Detail (Leitung, unten) | – | – | – | – | BF-03 BF-05 BF-08 | BF-05 BF-08 |
| Anlege-Modale (Konfi, Event, Aktivität, Badge, Challenge, Jahrgang, Kategorie, Level) | – | – | – | – | BF-04 (Konfi/Anwesenheit) sonst ok | ok |
| Neuer Rückblick (Modal) | – | – | – | – | BF-06 | BF-06 |
| Einstellungen „Mehr“, Dashboard-Konfiguration, Jahrgänge, Kategorien, Level, Zertifikate, Einladung | – | – | – | – | BF-03 (Karten) | ok |
| Nutzer, Organisationen, Jahresrückblick-Verwaltung, Betrieb | – | – | – | – | BF-03 BF-04 | ok |

Lesehilfe: Fast jede „Leitung iOS“-Zelle trägt BF-03/BF-04, fast jede „Android“-Zelle nicht — das
ist der Plattform-Unterschied aus der Spezifitätsfrage, nicht ein Unterschied in den Screens.

## Ursachenanalyse: Warum der Dunkelmodus immer wieder Löcher hat

**1. Er ist 13 Stunden alt und wurde in sieben Anläufen gebaut.** `feat(ui): Dunkelmodus nach
Systemeinstellung` (b625b15) kam am 25.09.2026 um 23:03, danach 69a6023 (23:41), 53b2c3f (00:02),
8665b80 (02:10), a9815de (09:07), 36b8f7c (09:49, „fehlende Klammer brach den Build“), Release
fce1ab0 um 12:22 Uhr. `variables.css` zählt insgesamt 147 Commits, 28 davon mit „dunkel/dark“ im
Betreff (die ältesten von Juni 2026 sind Einzelfixe für den iOS-Header). Jeder Fix reagierte auf
eine Gerätemeldung; keiner hatte ein Messverfahren.

**2. Es gibt ein Token-System — aber nur die halbe Schicht.** Der Dunkelblock
(`variables.css:3572-3794`, 223 Zeilen) definiert 169 Farb-Tokens neu, sauber an *einer* Stelle, mit
`-rgb`-Tripeln und Tests. Das ist gut. Er lässt aber Ionics eigene Flächen-Variablen
(`--ion-background-color`, `--ion-item-background`, `--ion-card-background`, `--ion-toolbar-background`)
den Plattform-Werten aus `dark.system.css` — auf iOS `#000000`/`#000000`/`#1c1c1d`, auf Android
`#121212`/`#1e1e1e`/`#1e1e1e`. Ergebnis: zwei Stufenleitern (App und Ionic), je Plattform anders
gemischt (BF-04).

**3. Das Theme gewinnt gegen das Token.** Die zentrale Karten-Regel verliert auf iOS an Spezifität
gegen `ionic-theme-ios27.css` (BF-03). Weil beide Wege im Hellen bei `#ffffff` enden, war das seit dem
Theme-Wechsel (10688ca) unsichtbar; der Dunkelmodus hat es aufgedeckt. Statt der Ursache wurden fünf
Karten per Inline-Style geflickt — und der Kommentar am Flicken dokumentiert, dass die Ursache
gesucht und nicht gefunden wurde.

**4. Semantik der Tokens wird nicht eingehalten.** Text-Tokens stehen als Verlaufsenden (BF-02),
Bereichs-Flächenfarben als Text (BF-06, 234 Stellen), rohe `rgba(0,0,0,…)` als Text auf Flächen,
die im Dunkeln kippen (BF-07). Der Dunkelblock kann nur richtig umschalten, was richtig benannt ist.
Zahlen: 469 rohe Farbliterale in `.tsx`/`.ts` (davon 24 Hex in 5 Dateien; der Rest `white`,
`rgba(255,…)` — meist legitim auf farbigen Flächen, aber unprüfbar), 107 Zeilen rohe Farbwerte in
den hellen Regeln von `variables.css` (davon 86 Weiß-Töne für farbige Flächen), 458 in
`WrappedModal.css` und 238 in `ShareCard.css` (eigenständig dunkel gestaltet, akzeptiert im Test).
`colors.ts` spiegelt 40 helle Hexwerte für JS-Kontexte und folgt dem Modus ausdrücklich nicht.

**5. Die Tests prüfen den Text, nicht das Bild.** 39 grüne Tests, 36 begründete Ausnahmen, eine
Kontrastpaarung — und 104 gerenderte Verstöße (BF-09). Kein visueller Regressionstest, kein
dunkler Screenshot-Pfad (BF-12), keine Kontrastmessung im Browser. Die einzige Instanz, die den
Dunkelmodus sieht, ist Simons iPhone.

**6. Modus-Ermittlung und Systemleisten sind in Ordnung** — das ist der Teil, der stimmt:
`prefers-color-scheme` über Ionics `dark.system.css` (vor `variables.css` geladen, Test sichert die
Reihenfolge), ios27 `-dark-system`, ein einziger `@media`-Block, `<meta name="color-scheme"
content="light dark">`, Android `SystemBars.style: 'DEFAULT'` (Symbole folgen dem Telefon, Test
koppelt das an den Dunkelmodus), iOS `UIViewControllerBasedStatusBarAppearance` ohne eigenen
StatusBar-Aufruf (folgt dem System). Kein `theme-color`-Meta, kein Laufzeit-Umschalter, kein JS
weiß vom Modus (0 `matchMedia`) — konsequent, aber ohne Nachtvarianten für Splash/WebView-Grund
(siehe „Unklar“).

## Empfohlener Weg

Einmal systematisch statt weiter Einzelstellen: fünf Bausteine, geschätzt **9–10 Personentage**,
begründet aus den Zahlen oben.

1. **Eine Flächen-Stufenleiter** (1 PT). Im Hell- und Dunkelblock die fünf Ionic-Flächenvariablen an
   die App-Tokens binden, je Plattform (`:root.ios`, `:root.md`), und die Karten-Regel über die
   Theme-Spezifität heben (BF-03/04). Die 5 Inline-Flicken entfernen. Gegenprobe per gerendertem
   Test: `ion-card.app-card` und `ion-item` haben auf iOS und md die Tokenfarbe.
2. **Semantische Token-Familie** (2,5 PT). Je Bereichsfarbe ein `-text`-Token mit dunkler Variante;
   `--app-text-muted` heben; Verlaufsenden auf Flächen-Tokens (BF-01/02/05/06). Umstellung der 234
   Text-Stellen per Codemod (`color: var(--app-color-X)` → `-text`), 2 Verläufe, 1 Chat-Chip, 1 Knopf
   von Hand (BF-07/08). Die 17 Hexwerte aus `badgeCriteria.ts` in Tokens (BF-10).
3. **Lint gegen Rückfall** (1 PT). Stylelint für `variables.css`/Komponenten-CSS:
   `color-no-hex` außerhalb der Token-Definitionen, `declaration-property-value-disallowed-list`
   für `white`/`black`/`rgba(255,…)`/`rgba(0,…)` in `color`/`background`, Verbot von
   `--app-text-*` in `background`. ESLint `no-restricted-syntax` für Inline-`style` mit Farbliteral
   und für `'--background'` an `IonButton` ohne `'--color'`. Bestand als Ausnahmeliste, die nur
   schrumpfen darf.
4. **Gerenderte Prüfung in der CI** (3 PT). Ein Playwright-Projekt mit 4 Kontexten (hell/dunkel ×
   iOS-/Android-UA) über die ~47 Seitenzustände und ~25 Modale je Rolle: (a) Kontrastmessung wie
   `messen.cjs` mit Schwellwert 4,5:1 als harter Test, (b) `toHaveScreenshot` mit Baselines im
   Repo (`e2e/__screenshots__`, ~300 Bilder à ~150 kB ≈ 45 MB, oder gezielt die 40 wichtigsten),
   `maxDiffPixelRatio` 0,01. Läuft gegen den vorhandenen Compose-Stack aus `e2e/global-setup.ts`;
   der Seed braucht die hier ergänzten Daten (Nachrichten, Reaktionen, Antrag, Challenge).
   Aufwand enthält CI-Anbindung und Flake-Kontrolle (Animationen, Fonts, Uhrzeiten).
5. **Bilder und Doku** (1 PT). `scripts/screenshots.mjs` um `--schema dunkel` erweitern und die
   Handbuch-Bilder in beiden Modi ziehen (`build-handbuch.mjs` spiegelt sie); CHANGELOG- und
   Handbuch-Sätze (BF-11) nach der Umstellung wieder wahr machen; ein Abnahme-Lauf auf iPhone und
   Android mit den vier Screens aus der Auflage.

Zum Vergleich: Die sieben Einzelfixe vom 25./26.09. haben zusammen rund 13 Stunden gekostet und
lassen 104 Messstellen offen, davon zwei Klassen (Verläufe, Bereichsfarben als Text), die kein
Einzelfix erreicht, weil sie an 2 bzw. 234 Stellen sitzen.

## Unklar

- **Weißer Blitz beim Kaltstart im Dunkeln:** `capacitor.config.ts` setzt keinen `backgroundColor`
  (WebView-Grund bleibt Weiß, bis CSS geladen ist), Android hat keinen `values-night`-Ordner für den
  Splash, das iOS-LaunchScreen nutzt `systemBackgroundColor` (folgt dem System). Nur am Gerät prüfbar.
- **Statusleiste iOS:** Kein `StatusBar.setStyle`-Aufruf; `UIViewControllerBasedStatusBarAppearance=true`
  → Textfarbe folgt dem System. Sollte im Dunkeln hell sein; nicht headless prüfbar.
- **Eigene Chat-Blase:** Weiß auf Chat-Türkis `#06b6d4` = 2,43:1 — in **beiden** Modi, also kein
  Dunkelmodus-Befund; gehört zum Barrierefreiheits-Audit. Gleiches gilt für „Überspringen“
  (grau auf Blau) in der Onboarding-Tour und die kleinen Punkte-Pillen („+ 2 P“ Weiß auf Grün 3,77:1).
- **MD3-Theme-Hexwerte:** `ionic-theme-md3.css` enthält 10 feste Hexwerte (4× `#ffffff`, 2× `#fff`,
  `#79747e`, `#e6e0e9`, `#4a4458`). In meinen Android-Bildern ist nichts davon als helle Fläche
  aufgetaucht; ob sie in nicht erfassten Zuständen (Ripple, Fokus, Select-Popover) stören, ist offen.
- **ShareCard / Rückblick-Teilen:** `html-to-image` rendert die Karte aus DOM; ob im Dunkeln eine
  andere Karte entsteht als im Hellen, wurde nicht ausgelöst.

## Alte Befunde nachgeprüft

`docs/offene-befunde.md` enthält keinen Eintrag zu Dunkelmodus, Dark Mode oder Kontrast (grep
`dunkel|dark|kontrast`: 0 Treffer). Datierte Code-Kommentare zum Thema:

- `variables.css:2594-2599` (BEFUND 26.09.2026, Anmeldekarte hell) → **behoben bestätigt** für die Karte
  (gerendert `#242426`), **nicht** für den Text darauf (BF-01).
- `variables.css:3708-3741` (26.09.2026, Karte `#242426`, „iOS dL* 14,27“) → **weiter offen auf iOS**:
  gerendert `#1c1c1d`, dL* 10,30 (BF-03); auf Android behoben bestätigt.
- `PostfachModal.tsx:309-320` (25.09.2026, „liess sich im CSS nicht belegen“) → Ursache jetzt belegt (BF-03).
- `capacitor.config.ts` SystemBars (25.09.2026, Maltes Befund) → **behoben bestätigt** (`style: 'DEFAULT'`, Test grün).
- CHANGELOG „Sprechblasen deckend“ (a9815de) → Badge-Popover im Bild `dark-ios-konfi-m-badge-popover.png`
  dunkel und deckend, Pfeilspitze mitgefärbt: **behoben bestätigt**.

## Geprüft und in Ordnung

- **Keine hellen Flächen mehr:** 0 deckende Elemente mit Luminanz > 0,5 auf 94 Seitenzuständen
  (`messen.cjs`). Die 22 Inline-`white`-Hintergründe aus dem Einbau sind weg; Test
  `dunkelmodus.test.ts:243` hält das.
- **Modus-Ermittlung:** `dark.system.css` vor `variables.css` (`App.tsx:66-69`), ios27
  `-dark-system` nach dem Theme (`variables.css:36-39`), genau ein `@media`-Block, `<meta name="color-scheme" content="light dark">`
  (`index.html:9`). Gerendert: `--ion-background-color` iOS `#000000`, md `#121212` (Skript `computed.cjs`).
- **Kopfzeile, Tab-Leiste, Segmente, Toggles, Datumschip, Eingabefelder:** dunkel und lesbar in
  allen 400 Bildern; Glasleiste `rgba(28,28,30,0.72)`.
- **Overlays:** Alerts (iOS-Glas, Android MD3), Badge-Popover, Postfach-Modal, alle Formular-Modale
  der Leitung (Konfi/Event/Aktivität/Badge/Challenge/Jahrgang/Kategorie/Level/Rückblick anlegen),
  Antrag stellen/Detail, Aktivität prüfen, Challenge-Detail, Direktnachricht, Mitglieder, Passwort/
  E-Mail/Bibel/Konfispruch/Punkte, Account löschen — Karten und Felder dunkel, Text hell (Ausnahmen
  in BF-04/06 genannt). Chat-Langdruck: die Aktionsleiste (+, Antworten, Teilen) unter der Blase ist
  dunkel und lesbar (`dark-ios-konfi-m-chat-longpress.png`, `dark-android-konfi-m-chat-longpress.png`).
- **Onboarding-Tour, Änderungsanzeige, Rückblick-Folien:** eigene dunkle Verläufe, weiße Schrift, in beiden Modi gleich (Absicht laut Test-Ausnahmeliste).
- **Hinweiskarten „Was ist neu“ / „Events und Aktivitäten“:** Verlauf mit weißer Schrift, ok.
- **Chat:** Datumsmarke, Eingabezeile, fremde Blasen `#242426` mit `--app-text-emphasis`, Sendeknopf — ok (Fix 8665b80 greift); nur Reaktionszähler (BF-07).
- **Schatten im Dunkeln:** `--app-schatten-*` dreifache Deckkraft (53b2c3f), Karten heben sich auf Android sichtbar; Test `dunkelmodus.test.ts:358`.
- **Systemleisten Android:** `SystemBars.style: 'DEFAULT'`, `systemBars.test.ts` grün und an den Dunkelmodus gekoppelt.
- **Die drei Dunkelmodus-Testdateien** laufen grün (39/39) — nur beweisen sie das Falsche (BF-09).

## Nicht geprüft

- Toasts (kein Auslöser ohne Netzfehler erreicht; „Cache leeren“ öffnet einen Alert, keinen Toast),
  das Push-Auswahl-Modal („Welche Mitteilungen aufs Handy kommen“ — der Textklick traf die
  „Was ist neu“-Karte, die denselben Wortlaut trägt), die Rückblick-Folien nach der Intro-Folie
  (Swiper reagiert headless nicht auf Tipp/Pfeiltaste), das ActionSheet aus `useIonActionSheet`
  im Chat, Umfrage-Modal, Datei-Viewer
  (`FileViewerModal.css`, eigenständig schwarz gestaltet), QR-Scanner/QR-Anzeige, Kamera-Aufnahme,
  Org-Wechsler-Popover, Pull-to-Refresh-Spinner (nur während der Geste sichtbar), Ladeflächen.
- Super-Admin-Rolle (Organisationen/Betrieb wurden als Leitung mit 403 gesehen — Fehlerzustand dunkel ok).
- Tablet/Split-Ansicht, Web-Landingpages (`public/*.html`), E-Mail-Vorlagen.
- Echte Geräte (Safe Area, Statusleiste, WebKit, Startbildschirm, Tastatur).

## Auf Produktion nachzumessen

- **iPhone, Dunkelmodus:** Anmeldeseite (Links sichtbar?), Konfi-Dashboard ganz unten (Ranking-Karte),
  Teamer-Dashboard (Events-Karte), Konfi-Verwaltung der Leitung (Suchfeld schwarz? Karten `#1c1c1d`
  oder `#242426`? Safari-Web-Inspector: `getComputedStyle(document.querySelector('ion-card.app-card')).backgroundColor`),
  Chatraum mit Reaktionen, Konfi-Detail unten (Befördern-Knopf).
- **Android, Dunkelmodus:** dieselben Screens als Gegenprobe (dort sollten BF-03/04 nicht auftreten).
- **Kaltstart im Dunkeln, beide Plattformen:** weißer Blitz vor dem ersten Frame? Splash-Farbe?
- **Statusleiste iOS im Dunkeln:** helle Symbole über der Glasleiste?
- Nach BF-03/04-Fix: `node scripts/screenshots.mjs --url https://konfi-quest.de` mit einer neuen
  Dunkel-Option gegen Produktion laufen lassen und die Handbuch-Bilder erneuern (erst deployen, dann ziehen).

## Nachmessung nach den Bausteinen 1–3 (Koordination, 26.09.2026)

Dasselbe Skript wie im Audit (`messen.cjs`, 47 Seitenzustände × iOS/Android = 94 Zustände, dunkel),
gegen den Sammelbranch nach Einbau der drei Umbau-Commits (Flächen-Stufenleiter, Text-Token-Familie,
Grautöne) und der fünf Einzelauflagen:

| | Audit (Ausgang) | nach Umbau |
|---|---|---|
| helle Flächen im Dunkeln | 0 | 0 |
| Textstellen unter 4,5:1 | **104** | **33** |
| Zustände mit Verstoß | 30 von 94 | 15 von 94 |

Die 33 verbleibenden Stellen, je Plattform gleich (iOS = Android):

- **16 Stellen** eigene Chat-Blase: weiße Schrift und Uhrzeit auf `#06b6d4`, **2,43:1** — in beiden
  Modi gleich, also kein Dunkelmodus-Befund (UI-Bericht, Bereichsfarbe Chat als Fläche mit weißem
  Text); Entscheidung Simon: dunklere Chat-Fläche oder dunkle Schrift auf der eigenen Blase.
- **2 Stellen** Termindetail Konfi: Knopf „Anmelden (0/50)" **1,36:1** — der schwerste Rest, ein
  Knopf mit Bereichsfarbe ohne `--color` (gleiches Muster wie BF-08).
- **8 Stellen** Level-Punkte (`/admin/settings/levels`, „0 P" bis „20 P", 2,15–4,23:1) und
  Punkte-Chips („+ 1 P" bis „+ 3 P", 3,65–3,77:1, Aktivitäten und Konfi-Detail): Zahlen in
  Bereichsfarbe auf getöntem Chip — braucht das Text-Token auf dem Chip-Grund statt auf der Karte.
- **2 Stellen** Abzeichen-Fortschritt „0%" 4,06:1 — knapp unter der Grenze.

Damit ist der Zielwert dieses Pakets (unter 15 Verstöße) **nicht** erreicht, der Dunkelmodus-Anteil
(ohne die Chat-Blase) liegt bei 17 Stellen in vier Mustern; alle vier sind mit dem Text-Token-Muster
lösbar. Baustein 4 (gerenderte Messung als wiederholbarer Test, `frontend/scripts/dunkelmodus-messen.mjs`)
blieb im Arbeitsbaum des Pakets unfertig (Abbruch am Sitzungslimit) und ist nicht eingebaut; die
Messung hier lief mit dem Audit-Skript aus dem Scratchpad.
