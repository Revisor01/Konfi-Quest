# Audit UI-Qualität und Barrierefreiheit — 26.09.2026

## Umfang und Methode

**Geprüft** (Frontend, alle drei Rollen, ohne Datenbank):

- `frontend/index.html`, `frontend/public/manifest.json`, `frontend/capacitor.config.ts`, Android-Manifest und iOS-`Info.plist` (Orientierung, Systemleisten).
- `frontend/src/theme/*` (variables.css 4 655 Zeilen, typografie.css, abstaende.css, colors.ts) — Farbtoken hell und dunkel per WCAG-Kontrastrechner nachgerechnet (Python, Formel WCAG 2.1 relative Luminanz).
- `frontend/src/components/**` (215 Dateien): statische Auswertung per Skript über alle `.tsx` — Icon-Knöpfe ohne Namen, Formularfelder ohne Label, klickbare Nicht-Knöpfe, `<img>` ohne `alt`, rohe Fehlertexte, Umlaut-Ersatzschreibungen in sichtbaren Strings, Datumsformate, Begriffe (Events/Termine, Badges/Abzeichen).
- `components/shared/*`, `components/common/*`, `layout/MainTabs.tsx`, `navigation/rollenBaeume.ts`, `auth/*`, Onboarding (`OnboardingTour`, `useOnboardingOnce`, `*Update230WalkthroughModal`, `UpdateHinweisKarte`), `services/notifications.ts`.
- **Web-Variante ausgeführt:** `npx vite --port 5199` (frontend) + Playwright/Chromium 1.56 (global unter `/opt/node22/lib/node_modules/playwright`, Browser `/opt/pw-browsers`). Geprüft auf `/login`, `/forgot-password`, `/register`, `/reset-password`: Zugänglichkeitsbaum (`ariaSnapshot`), Tab-Reihenfolge, Fokusdarstellung (Screenshot-Ausschnitte + computed style), Enter-Verhalten, Live-Regionen, Browser-Zurück, unbekannte URL, Plattform-Modus je Kennung (Desktop, iPhone, Android, iPad/Macintosh+Touch), Desktop 1 440 px, 150 % Textzoom bei 393 px.
- **Screenshots:** alle 42 Bilder in `docs/screenshots/iphone/` und `docs/screenshots/play/` einzeln angesehen (Read), Maße, Größen, MD5-Dubletten, Git-Datum, Abgleich mit `frontend/public/docs/bilder/`.
- Handbuch `docs/handbuch/03-bedienung.md` gegen die Oberfläche gelesen; `docs/offene-befunde.md` Nr. 4 nachgeprüft.
- Fünf bestehende Tests gezielt laufen lassen (`eckBadgesBarrierefrei`, `dunkelmodus`, `wrappedBewegungReduzieren`, `onboardingSlides`, `postfachGlocke`): 272 Tests grün.

**Bewusst nicht geprüft:** Der Dunkelmodus im Detail — ihn prüft ein eigener Agent (`docs/audit/2026-09-26/darkmode.md`); hier nur ein Überblicksbefund mit Zahl. Seiten hinter dem Login konnten im echten Browser nicht gerendert werden (kein Backend); dort gilt die statische Auswertung. Kein Gerätetest mit VoiceOver/TalkBack.

Alle Hilfsskripte und Ausgaben liegen unter
`/tmp/claude-0/-home-user-Konfi-Quest/a6ca9d68-37c0-5c30-bb2c-1715bd69e07c/scratchpad/ui-barrierefreiheit/` (außerhalb des Repos). Die tragenden Prüfungen sind unten als Ein-Zeiler wiederholbar.

## Zusammenfassung

16 Befunde: **0 KRITISCH, 2 HOCH, 8 MITTEL, 6 NIEDRIG.**

Die Oberfläche ist in vielem sorgfältig gebaut — jeder der 89 Icon-Knöpfe trägt einen Namen, alle 24 Bilder ein `alt`, die Eck-Marken sind vorgelesen, die Glocke sagt in einem Satz, was hinter ihr liegt, Toasts sind Live-Regionen. Drei Dinge fallen dagegen strukturell ab: **(1)** 170 von 186 Formularfeldern haben keinen zugänglichen Namen, weil die App die in Ionic 8/9 entfernte Legacy-Syntax `<IonLabel position="stacked">` neben `<IonInput>` benutzt — der Name kommt seit Ionic 8 nur noch aus `label=`/`aria-label`, und beides fehlt durchgehend (0 Vorkommen von `label=`). Im Browser gemessen: die Login-Felder heißen für Vorlesehilfen nur „Textfeld“ mit Platzhalter. **(2)** In der Web-Variante ist die Anmeldeseite per Tastatur nur zur Hälfte bedienbar: „Passwort vergessen?“, „Mit Einladungscode registrieren“ und der Passwort-Augen-Umschalter sind `span`/`IonIcon` mit `onClick`, liegen nicht in der Tab-Reihenfolge, und Enter im Passwortfeld sendet nicht. **(3)** Alle 42 Handbuch- und Store-Bilder stammen vom 10.09.2026 und zeigen den Stand vor Glocke, Gemeinde-Umschalter und 2.3-Banner — das Handbuch beschreibt eine Kopfzeile, die auf keinem Bild zu sehen ist.

Dazu kommen Kontraste unter AA im Hellmodus (drei Text-Grautöne mit 2,85–3,54:1 an 119 Stellen; Bereichsfarben als Text bis hinab zu 2,15:1), `lang="en"` auf einer deutschen App, die Hochformat-Sperre auf beiden Plattformen und Tab-Beschriftungen mit 8,8 px (MD3) bei fehlender Dynamic-Type-Unterstützung auf iOS.

## Release-Empfehlung für den Bereich

**mit Auflage.** Nichts hiervon stürzt ab oder verletzt den API-Vertrag; die Store-Apps 2.2.x haben dieselben Lücken. Auflage vor dem Release: **(a)** die vier Anmeldeseiten (Login, Registrierung, Passwort vergessen/zurücksetzen) tastatur- und vorlesefähig machen — `aria-label` bzw. `label=` an den Feldern, Links als `<button>`/`role="link"` mit `tabIndex`, Enter sendet (BF-01 für diese Seiten, BF-02, BF-08); **(b)** die 42 Screenshots nach dem Deploy neu ziehen, bevor sie als Store-Bilder für 2.3.0 hochgeladen werden (BF-09). Der Rest (BF-01 für die übrigen Formulare, Kontraste, `lang`, Orientierung, Schriftgrößen) gehört in einen Barrierefreiheits-Sprint nach dem Release, bevor die App an die EKD geht.

## Befunde

### BF-01: 170 von 186 Formularfeldern haben keinen zugänglichen Namen (Ionic-9-Legacy-Label)

- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — alle 186 Felder tragen `aria-label` als erstes Attribut (Name aus dem sichtbaren IonLabel, sonst aus Platzhalter oder Überschrift; Pflichtfelder mit Stern `aria-required`), das sichtbare IonLabel bleibt; gemessen mit dem Skript unten: `186 170` → `186 0` (klammerbewusst über den ganzen Öffnungstag: 57 → 0). Tests `formularfelderBenannt.test.ts` (Zählung, beide Lesarten) und `formularfelderBenanntGerendert.test.tsx` (Termin-Formular, Konfi-Karte, Umfrage).
- **Fundstelle:** durchgehend, z. B. `frontend/src/components/auth/LoginView.tsx:302-316`, `frontend/src/components/admin/modals/EventFormSections.tsx:89-95` und `:155-167`, `frontend/src/components/admin/modals/UserManagementModal.tsx:422-470`, `frontend/src/components/chat/modals/PollModal.tsx:243-307`; vollständige Liste über das Skript unten.
- **Kennzeichnung:** reproduziert — statisch (Skript) und im Browser (Playwright, Chromium-Zugänglichkeitsbaum).
- **Beschreibung:** Die App beschriftet Felder mit `<IonLabel position="stacked">Text</IonLabel>` als Geschwister eines `<IonInput>`/`<IonTextarea>`/`<IonSelect>`/`<IonToggle>`/`<IonRange>`/`<IonDatetime>` im `<IonItem>` (93 Vorkommen). Diese Legacy-Syntax hat Ionic 8 entfernt; in Ionic 9.0.3 (`node_modules/@ionic/core/components/ion-input.js`) setzt `getLabelledById()` den Namen ausschließlich aus dem `label`-Prop, einem `slot="label"` oder einem geerbten `aria-label`. Es gibt in der App **0** Felder mit `label=`; 170 von 186 Feldern haben weder `label`, `aria-label`, `aria-labelledby` noch `placeholder` im Tag. Die 16 übrigen haben nur einen Platzhalter, der verschwindet, sobald etwas eingetippt ist.
- **Auswirkung aus Nutzersicht:** Wer mit VoiceOver/TalkBack durch ein Formular geht, hört „Textfeld“, „Schalter, aus“, „Schieberegler“ — nicht „Pflicht-Event“, „Benutzername“ oder „Maximale Teilnehmer“. Für die Leitung sind Termin-, Konfi- und Benutzer-Formulare mit 10–20 Feldern damit blind nicht auszufüllen; im Login helfen nur die Platzhalter. WCAG 1.3.1 und 4.1.2 (Stufe A).
- **Beleg:**
  - Chromium-Zugänglichkeitsbaum der Login-Seite (Playwright `ariaSnapshot`): `- text: Benutzername` / `- textbox:` / `  - /placeholder: Dein Nutzername` — der sichtbare Text „Benutzername“ ist reiner Text, die Textbox hat keinen Namen. Gleiches Bild auf `/forgot-password` (E-Mail-Adresse), `/reset-password` (zwei Passwortfelder), `/register` (Einladungscode).
  - Zählung: `total form controls: 186  without label/aria-label/placeholder: 170`, `Felder mit label= prop: 0`, `IonLabel position=stacked/floating/fixed: 93`.
  - Ionic-Quelle: `getLabelledById(){if(!this.inheritedAttributes["aria-label"])return void 0!==this.label?this.labelTextId:this.labelSlot?.id||void 0}` — kein Bezug auf ein Geschwister-`ion-label`.
- **Reproduktion (statisch):**
  ```
  cd frontend/src && python3 - <<'EOF'
  import re,glob
  t=o=0
  for f in glob.glob('components/**/*.tsx',recursive=True):
      s=open(f).read()
      for m in re.finditer(r'<(IonInput|IonTextarea|IonSelect|IonSearchbar|IonToggle|IonCheckbox|IonRange|IonDatetime)\b',s):
          tag=s[m.start():s.find('>',m.end())+1]; t+=1
          if not re.search(r'\b(label|aria-label|aria-labelledby|placeholder)\s*=',tag): o+=1
  print(t,o)
  EOF
  ```
  Erwartet bei korrekter Beschriftung: zweite Zahl 0. Beobachtet: `186 170`.
- **Empfehlung:** Auf die moderne Ionic-Syntax umstellen: `<IonInput label="Benutzername" labelPlacement="stacked">` (das `IonLabel` entfällt), bei Toggles `<IonToggle>Pflicht-Event</IonToggle>` bzw. `labelPlacement`. Ein Test wie `eckBadgesBarrierefrei.test.tsx` über alle Felder hält den Stand. Zuerst die vier Anmeldeseiten (Auflage), dann Modale der Leitung.

### BF-02: Web-Variante — Anmeldeseite per Tastatur nur halb bedienbar

- **Schwere:** HOCH
- **Status:** behoben 26.09.2026 — Augen-Umschalter als `<button aria-pressed>`, „Passwort vergessen?"/„Zurück"/„Registrieren"/„Anmelden" als `<a href>`, Enter im Feld sendet (`utils/tastatur.ts`, `beiEnter`); gemessen: Tab-Reihe 3 → 6 Haltepunkte, Enter 0 → 1 `POST /api/auth/login`; Layout pixelgleich (8 Screenshots, 0 abweichende Pixel).
- **Fundstelle:** `frontend/src/components/auth/LoginView.tsx:333-338` (Augen-Umschalter als `IonIcon onClick`), `:380-386` (`<span onClick>` „Passwort vergessen?“), `:424-431` (`<div onClick>` Registrierung); kein `<form>`, kein `onKeyDown` (grep `'Enter'|<form|onSubmit` → 0 Treffer). Gleiches Muster `KonfiRegisterPage.tsx` („Zurück zur Anmeldung“), `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`.
- **Kennzeichnung:** reproduziert (Playwright gegen `http://127.0.0.1:5199/login`, Desktop 1 440 px).
- **Beschreibung:** Die Tab-Reihenfolge der Login-Seite hat genau drei Haltepunkte: Nutzername → Passwort → „Anmelden“ → zurück zum `body`. Der Passwort-Augen-Umschalter, „Passwort vergessen?“ und „Noch keinen Account? Mit Einladungscode registrieren“ sind nicht fokussierbar und tragen keine Rolle (Zugänglichkeitsbaum: `img` ohne Namen bzw. `text`). Enter im Passwortfeld löst keinen Anmeldeversuch aus; erst der Klick auf „Anmelden“ sendet `POST https://konfi-quest.de/api/auth/login`. Auf `/register` ist ebenfalls nur das Code-Feld erreichbar („Zurück zur Anmeldung“ nicht).
- **Auswirkung aus Nutzersicht:** Wer konfi-quest.de am Rechner mit Tastatur oder Vorlesehilfe bedient (Sehbehinderung, motorische Einschränkung, Bildschirmleser), kann sich anmelden, aber weder ein vergessenes Passwort zurücksetzen noch registrieren — und muss nach der Passworteingabe zur Maus greifen. WCAG 2.1.1 (Stufe A).
- **Beleg:** Tab-Protokoll (20 Schritte, zyklisch): `1. input "Dein Nutzername" · 2. input "Dein Passwort" · 3. ion-button "Anmelden" · 4. body …`. Zugänglichkeitsbaum: `- text: Passwort vergessen? Noch keinen Account?` / `- strong: Mit Einladungscode registrieren`. `cursor:pointer`-Elemente ohne Rolle: `ION-ICON.app-auth-input__toggle role=img tabindex=null`, `SPAN.app-auth-link role=null tabindex=null :: Passwort vergessen?`, `SPAN.app-auth-link … :: Noch keinen Account?Mit Einladungscode registrieren`. Enter: `Anfragen (1,5 s): (keine)`; Klick: `POST …/api/auth/login`.
- **Reproduktion:** Vite starten (`cd frontend && npx vite --port 5199`), dann Playwright: `page.goto('/login'); for (i<6) page.keyboard.press('Tab')` und `document.activeElement` protokollieren — erwartet: Umschalter, Links und Knopf in der Reihenfolge; beobachtet: nur zwei Felder und ein Knopf. `inputs.nth(1).press('Enter')` → erwartet ein `POST /api/auth/login`, beobachtet keiner.
- **Empfehlung:** Links als `<IonButton fill="clear">` oder `<a role="link" tabIndex={0}>` mit `onKeyDown`; Augen-Umschalter als `<button aria-label="Passwort anzeigen" aria-pressed=…>`; Felder in ein `<form onSubmit>` oder `onKeyDown Enter → handleLogin`. Zusätzlich Gegenprobe mit `ariaSnapshot` im e2e-Login-Spec.

### BF-03: 147 klickbare `div`/`span`/`IonIcon` ohne Rolle, Tabindex oder Tastaturhandler

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — jedes klickbare `div` trägt `role="button" tabIndex={0} onKeyDown={tastaturKlick}` (`utils/tastatur.ts`: Enter/Leertaste klicken das Element, nur wenn die Taste auf dem Element selbst fiel), Auswahlzeilen zusätzlich `aria-pressed`, Symbol-Raster `aria-label`; das Wiederholen-Symbol im Chat und der Ort der Konfirmation sind `<button class="app-knopf-nackt">`; 19 Wrapper, die nur den Klick stoppen oder den Knopf im Inneren tragen (Zeilen unter „Mehr" mit Info-Knopf, Chat-Blase, Foto-Flächen, Rückblick-Hinweis), sind `role="presentation"` mit dem Knopf innen — kein Knopf im Knopf. Sichtbarer Fokus für `[role="button"]` in `theme/barrierefreiheit.css`. Gemessen (klammerbewusst über den ganzen Öffnungstag): 138 → 0; naiv wie im Bericht 147 → 0. Tests `klickbareElementeBedienbar.test.ts` (Zählung, Rollen vollständig, Restliste der `presentation`-Stellen abschließend) und `klickbareElementeGerendert.test.tsx` (Kachel, Termin-Karte, „App sperren" per Enter/Leertaste).
- **Fundstelle:** z. B. `frontend/src/components/admin/pages/AdminSettingsPage.tsx:238-246` (13 Listeneinträge unter „Mehr“ als `<div className="app-list-item" onClick>`), `frontend/src/components/shared/PushAuswahl.tsx:306-310`, `frontend/src/components/shared/KachelRaster.tsx:126-134` (Abzeichen-Kacheln), `frontend/src/components/admin/modals/BadgeManagementModal.tsx` (8 Stellen), `ChallengeSubmitModal.tsx` (5), `EventDetailSections.tsx` (4).
- **Kennzeichnung:** reproduziert (Skript über alle `.tsx`).
- **Beschreibung:** 137 `<div onClick>`, 6 `<span onClick>`, 8 `<IonIcon onClick>`, 1 `<p onClick>`; davon 147 ohne `role`, `tabIndex`, `onKeyDown` oder `aria-hidden`. Positivbeispiel im selben Repo: `UpdateHinweisKarte.tsx:22-34` macht es richtig (`role="button" tabIndex={0} onKeyDown`).
- **Auswirkung aus Nutzersicht:** Vorlesehilfen kündigen diese Einträge als Text an, nicht als Schaltfläche („Profil — Passwort und E-Mail ändern“ statt „Schaltfläche Profil“); in der Web-Variante sind sie per Tastatur unerreichbar. Auf dem Handy per Finger merkt niemand etwas. WCAG 4.1.2 / 2.1.1.
- **Beleg:** `{'div': 137, 'span': 6, 'IonIcon': 8, 'IonCard': 0, 'p': 1} — ohne role/tabIndex/onKeyDown: 147`.
- **Empfehlung:** Für Listeneinträge `IonItem button` (bringt Rolle, Fokus und Tastatur mit) oder das Muster aus `UpdateHinweisKarte`; Regel per Test festhalten.

### BF-04: Kontraste im Hellmodus unter AA — Grautöne 2,85–3,54:1 an 119 Stellen, Bereichsfarben als Text bis 2,15:1

- **Schwere:** MITTEL
- **Status:** teilweise behoben 26.09.2026 — die Grautöne: `--app-text-muted` `#999` → `#707070` (auf Weiß 2,85 → 4,95:1), `--app-text-system` `#8e8e93` → `#6e6e73` (3,26 → 5,07:1), `--app-text-tertiary` `#888` → `#6b6b70` (3,54 → 5,30:1); alle ≥ 4,5:1 auch auf `#f8f9fa`, `#f5f5f5` und dem Ionic-Seitengrund `#f4f5f8`, Rangfolge secondary < tertiary < system < muted erhalten (`dunkelmodus.test.ts`, hell wie dunkel). **Offen:** Bereichsfarben als Textfarbe im Hellen (badges 2,15, chat 2,43, users 3,66 …) — die neue Text-Token-Familie `--app-text-<bereich>` ist hell absichtlich die Bereichsfarbe (Dunkelmodus-Paket, Baustein 2: im Hellen ändert sich an den Farben nichts); alle Textstellen hängen jetzt aber an diesen Tokens, sodass ein hellerer Hell-Wert je Bereich an **einer** Stelle gesetzt werden kann. Ebenso offen: weiße Symbole auf den Eck-Marken.
- **Fundstelle:** `frontend/src/theme/variables.css:327-330` (`--app-text-tertiary: #888`, `--app-text-muted: #999`, `--app-text-system: #8e8e93`), Bereichsfarben `:140-172`; Nutzung als `color:` in Komponenten: `text-system` 78+6, `text-muted` 22+4, `text-tertiary` 19; `--app-color-badges` 8, `chat` 16+2, `material` 16, `users` 40+1, `categories` 3, `bonus` 4+1, `level` 3, `warning` 4+2, `success` 4+3. Weiße Symbole auf Eck-Marken: `shared/StatusBadge.tsx:132`, `shared/EventCornerBadges.tsx:44`.
- **Kennzeichnung:** reproduziert (Kontrastrechnung; Zählung per grep).
- **Beschreibung:** Gerechnet auf dem hellen Kartengrund `#ffffff` (WCAG-Verhältnis): `--app-text-muted` **2,85:1**, `--app-text-system` **3,26:1**, `--app-text-tertiary` **3,54:1**, `--app-color-neutral-hell` 2,54:1 — alle unter 4,5:1 für Fließtext (Zeitstempel, Metazeilen, Untertitel; `--app-text-system` ist mit 84 Stellen der zweithäufigste Textton der App). Bereichsfarben als Textfarbe: `badges #f59e0b` **2,15:1**, `chat #06b6d4` 2,43, `categories #0ea5e9` 2,77, `bonus #f97316` 2,80, `material #d97706` 3,19, `level` 3,53, `users #667eea` 3,66, `gottesdienst` 3,68, `gemeinde` 3,77, `jahrgang/info #007aff` 4,02. Weißes Symbol auf farbiger Eck-Marke: auf `badges` 2,15, `warning` 2,20, `success` 2,22, `chat` 2,43, `users` 3,66 — unter den 3:1 für grafische Objekte (WCAG 1.4.11). Bemerkenswert: Für den **Dunkelmodus** gibt es einen Test (`dunkelmodus.test.ts:222`), der 4,5:1 erzwingt, und dort halten die Töne (`text-tertiary` 4,75:1); für den Hellmodus gibt es keinen — und der ist der Standard für die meisten Konfis.
- **Auswirkung aus Nutzersicht:** Pastor:innen mit Sehschwäche oder Konfis in praller Sonne lesen Zeitstempel („15d“), Untertitel („Passwort und E-Mail ändern“) und farbige Zähler schlechter; die orangefarbenen Abzeichen-Marken sind bei Farbsehschwäche kaum als Symbol zu erkennen.
- **Beleg (Auszug Rechner):** `text-muted #999999 weiss 2.85`, `text-system #8e8e93 weiss 3.26`, `text-tertiary #888888 weiss 3.54`, `badges #f59e0b weiss 2.15 … weiss-auf-farbe 2.15`.
- **Reproduktion:** `python3 -c "..."` mit der WCAG-Formel (siehe Skript `kontrast.py` im Scratchpad) oder jeder Online-Kontrastrechner mit den Hexwerten aus `variables.css`.
- **Empfehlung:** `--app-text-system`/`-muted`/`-tertiary` hell auf ≥ `#767676` (4,54:1) heben; Bereichsfarben als Textfarbe nur in der `-dunkel`-Stufe verwenden oder fett/groß setzen; Eck-Marken auf `badges`/`warning`/`success` mit dunklem Symbol. Den Hellmodus in `dunkelmodus.test.ts` (oder einem Schwestertest) mit derselben 4,5:1-Schwelle absichern.

### BF-05: `lang="en"` auf einer deutschsprachigen App

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — `<html lang="de">` in `index.html`, Test `sprache.test.ts`.
- **Fundstelle:** `frontend/index.html:2` (`<html lang="en">`); zur Laufzeit nirgends gesetzt (grep `documentElement.lang` → 0 Treffer); Kommentar in `__tests__/components/kachelrasterEinheitlich.test.tsx:147` kennt das Problem („Die Seite steht auf lang="en"“). Die statischen Seiten `public/*.html` haben korrekt `lang="de"`.
- **Kennzeichnung:** reproduziert (Playwright: `document.documentElement.lang === "en"` auf allen vier Auth-Seiten).
- **Beschreibung:** Die Sprachangabe steuert Vorlesestimme, Silbentrennung und Rechtschreibprüfung. WCAG 3.1.1 (Stufe A).
- **Auswirkung aus Nutzersicht:** VoiceOver/TalkBack lesen die App standardmäßig mit englischer Stimme vor („Guten Tag, Emilia“ wird englisch ausgesprochen), sofern die Nutzerin nicht manuell umschaltet; der WebView bricht deutsche Wörter nicht nach deutschen Regeln.
- **Beleg:** `meta: {"lang":"en", …}` in allen vier Seitenprotokollen.
- **Empfehlung:** `<html lang="de">` in `index.html`; danach den Kommentar im Kachelraster-Test anpassen.

### BF-06: Hochformat-Sperre auf beiden Plattformen (WCAG 1.3.4)

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/android/app/src/main/AndroidManifest.xml:33` (`android:screenOrientation="portrait"`), `frontend/ios/App/App/Info.plist:75-78` (nur `UIInterfaceOrientationPortrait`, kein `~ipad`-Eintrag).
- **Kennzeichnung:** aus Code gelesen.
- **Beschreibung:** Beide Apps erzwingen Hochformat. Der Manifest-Kommentar dokumentiert die Entscheidung („Simon, 19.09.2026: Will ich nicht auf phones“) und weist selbst darauf hin, dass Android 16 die Sperre auf großen Displays ignoriert. WCAG 1.3.4 (Stufe AA) verlangt, dass Inhalte nicht auf eine Ausrichtung beschränkt werden, sofern sie nicht wesentlich ist — für eine Listen-/Chat-App ist sie das nicht.
- **Auswirkung aus Nutzersicht:** Wer das Gerät fest montiert nutzt (Rollstuhlhalterung, Ständer im Querformat) oder ein iPad quer hält, bekommt die App seitlich gedreht oder gar nicht passend. Betrifft auch Teamer:innen mit iPad-Tastaturhülle.
- **Beleg:** Manifest-Zeile 33; `UISupportedInterfaceOrientations` mit genau einem Eintrag.
- **Empfehlung:** Mindestens auf Tablets (`~ipad`, Android `sw600dp` über Laufzeit-`setRequestedOrientation`) freigeben; auf Telefonen ist die Sperre eine bewusste Produktentscheidung — dann im Handbuch als Einschränkung nennen.

### BF-07: Schriftgrößen folgen auf iOS nicht der Systemgröße; Tab-Beschriftungen 8,8 px; Zoom im Browser gesperrt

- **Schwere:** MITTEL
- **Fundstelle:** `frontend/src/theme/typografie.css:17-18` (`--app-text-schmal: 0.55rem`, `--app-text-winzig: 0.6rem`), `variables.css:1137` (`ion-tab-bar.md ion-tab-button ion-label { font-size: var(--app-text-schmal) !important }`), `variables.css:960` (iOS-Tab-Label `--app-text-winzig`); `frontend/index.html:10-13` (`maximum-scale=1.0, user-scalable=no`); kein `-apple-system-body`/`text-size-adjust` im Projekt (grep → 0).
- **Kennzeichnung:** aus Code gelesen; Größen gerechnet (0,55 rem × 16 px = 8,8 px; 0,6 rem = 9,6 px), Textzoom im Browser gemessen.
- **Beschreibung:** Die Typografie ist konsequent in `rem` — gut für Browser-Zoom (150 % Textzoom bei 393 px gemessen: kein horizontaler Überlauf, `scrollWidth 393`). Aber: In WKWebView skaliert `rem` nicht mit der iOS-Einstellung „Textgröße“ (Dynamic Type), solange die Wurzel nicht `font: -apple-system-body` nutzt; wer auf iOS größere Schrift eingestellt hat, sieht Konfi Quest unverändert. Die Tab-Beschriftungen liegen mit 8,8 px (MD3) und 9,6 px (iOS) unter den Plattform-Vorgaben (Material 12 px, iOS 10 px) — der Kommentar begründet es mit „Challenges“ bei 360 px Breite. Im Browser verbietet `user-scalable=no` das Pinch-Zoomen (Android Chrome hält sich daran, iOS Safari ignoriert es).
- **Auswirkung aus Nutzersicht:** Eine Pastorin, die ihr iPhone auf „größere Schrift“ gestellt hat, bekommt in dieser App nichts davon; die fünf Reiterbeschriftungen sind auf Android 8,8 px klein, und im Android-Browser lässt sich nicht heranzoomen. WCAG 1.4.4 (AA) für die Web-Variante.
- **Beleg:** `Schriftgroessen: … "span 12.8px "Passwort vergessen?""` (Login, iPhone-Kennung); `Nach 150 % Textzoom: {"scrollW":393,"innerW":393,"contentScrollH":974}`.
- **Empfehlung:** `html { font: -apple-system-body; }` (Ionic-Empfehlung für Dynamic Type) plus `--app-text-schmal` auf ≥ 0,7 rem mit `text-overflow: ellipsis`; `user-scalable=no` und `maximum-scale` aus dem Viewport-Meta streichen (Ionic braucht es nicht mehr).

### BF-08: Kein sichtbarer Fokus auf dem Anmelde-Knopf; Fehlermeldung ohne Live-Region

- **Schwere:** MITTEL
- **Status:** behoben 26.09.2026 — Fehlerblöcke `role="alert"`, Bestätigungen `role="status"`; Fokusring in `theme/barrierefreiheit.css` (Hauptknopf zweifarbig Weiß/Lila über `.ion-focused` und `:focus-visible`, Links und nackte Knöpfe `currentColor`); gemessen: `outline none` → `solid 3px` Weiß + `solid 3px` Lila.
- **Fundstelle:** `frontend/src/components/auth/LoginView.tsx:340-345` (`IonButton.app-auth-button`), `:390-411` (`<div className="app-auth-error">` ohne `role`/`aria-live`); vergleichbar `KonfiRegisterPage.tsx`, `ForgotPasswordPage.tsx`, `ResetPasswordPage.tsx`. Im Theme nur 6 `:focus-visible`-Regeln (`variables.css`), keine für Auth-Knöpfe.
- **Kennzeichnung:** reproduziert (Playwright: Screenshot-Ausschnitte mit/ohne Fokus pixelgleich; computed style).
- **Beschreibung:** Der Knopf erhält per Tab die Klasse `ion-focused`, aber `::after`-Overlay hat mit und ohne Fokus `opacity 0.08` bei `background rgba(0,0,0,0)` — kein sichtbarer Unterschied. Die Eingabefelder zeigen dagegen einen 3-px-Ring (in Ordnung). Nach fehlgeschlagener Anmeldung erscheint der Text „Anmeldung fehlgeschlagen — Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.“ (verständlich, gut) in einem `div` ohne `role="alert"`; im gesamten DOM war danach keine Live-Region vorhanden.
- **Auswirkung aus Nutzersicht:** Tastaturnutzer:innen sehen nicht, dass „Anmelden“ den Fokus hat; Vorlesehilfen erfahren vom Fehler nichts, solange sie den Text nicht selbst suchen. WCAG 2.4.7 (AA), 4.1.3 (AA).
- **Beleg:** `Fokus Knopf: … inner button computed: outline none 0px | bg rgba(0,0,0,0) | after-bg rgba(0,0,0,0) opacity 0.08` und `Knopf ohne Fokus inner: bg rgba(0,0,0,0) | after-bg rgba(0,0,0,0) opacity 0.08`; `Live-Regionen jetzt: []`; `DIV.app-auth-error … role=null live=null`.
- **Empfehlung:** `.app-auth-button:focus-visible::part(native) { outline: 3px solid var(--app-weiss); outline-offset: 2px }`; Fehlerblock mit `role="alert"`. Im eingeloggten Bereich übernehmen die Toasts (`role="status"`, siehe „Geprüft und in Ordnung“).

### BF-09: Alle 42 Screenshots zeigen den Stand vor Glocke, Gemeinde-Umschalter und 2.3-Banner

- **Schwere:** MITTEL
- **Fundstelle:** `docs/screenshots/iphone/*.png`, `docs/screenshots/play/*.png` (42 Dateien, letzter Commit `56b99d56` vom 10.09.2026), gespiegelt nach `frontend/public/docs/bilder/` (identisch, `diff -rq` leer). Handbuch-Einbindung: 15 Bilder in `docs/handbuch/10-konfis.md`, `20-teamer.md`, `30-leitung.md`.
- **Kennzeichnung:** reproduziert (jedes Bild angesehen; Git-Datum; Glocke eingeführt mit `31cb623b` am 25.09.2026).
- **Beschreibung:** Jedes Bild zeigt den beschriebenen Screen, keines einen Ladezustand oder eine 404-Seite, keine MD5-Dubletten, alle 442–1 655 kB, die Play-Bilder korrekt im MD3-Look (Android-Kennung greift). Aber in keiner Kopfzeile steht die Glocke, nirgends der Gemeinde-Umschalter, und die Profil-/Mehr-Seiten zeigen „Was ist neu in Version 2.1?“ — also 2.2.x. Das Handbuch (`03-bedienung.md`: „Oben rechts steht eine **Glocke**“) beschreibt eine Oberfläche, die auf seinen eigenen Bildern nicht vorkommt. Da dieselben Bilder als Store-Bilder dienen (Skript-Kommentar: „Die iPhone-Grösse entspricht dem, was die Stores erwarten“), würden sie 2.3.0 mit der alten Oberfläche bewerben. Nebenbefund: Seitentitel „Events“ unter dem Reiter „Mitmachen“ (siehe BF-10) ist auf allen Mitmachen-Bildern sichtbar.
- **Auswirkung aus Nutzersicht:** Wer die Glocke im Handbuch sucht, findet sie im Text, aber nicht im Bild; Store-Besucher sehen eine andere App als die, die sie installieren.
- **Beleg:** `git log -1 --format=%cd -- docs/screenshots/iphone/konfi-startseite.png` → `2026-09-10`; Sichtprüfung: Kopfzeile `konfi-startseite.png` zeigt nur den Profil-Knopf rechts, `leitung-einstellungen.png` Banner „Version 2.1“.
- **Empfehlung:** Nach dem Deploy `node scripts/screenshots.mjs` und `--geraet play` laufen lassen, dann `npm --prefix frontend run docs:handbuch` (CLAUDE.md: „erst deployen, dann ziehen“, jedes Bild ansehen).

### BF-10: Begriffe uneinheitlich — Oberfläche sagt „Events“/„Badges“, Handbuch „Termine“/„Abzeichen“

- **Schwere:** MITTEL
- **Fundstelle:** Oberfläche: Seitentitel und Karten `KonfiEventsPage`/`TeamerEventsPage`/`AdminEventsPage` („Events“, „Deine Events“, „Events durchsuchen…“, „Event suchen…“), Reiter `rollenBaeume.ts:296` (`label: 'Badges'`), Seiten „Badges“, „Teamer-Badges“, Onboarding-Text `'Unter "Events" stehen die Termine …'`. Handbuch: `03-bedienung.md` Reitertabelle „Badges“, sonst „Termine“ und „Abzeichen“.
- **Kennzeichnung:** reproduziert (Zählung sichtbarer Strings; Screenshots).
- **Beschreibung:** In sichtbaren UI-Strings: **„Events“ 92× gegen „Termine“ 41×**, **„Badges“ 72× gegen „Abzeichen“ 33×**. Im Handbuch umgekehrt: „Termine“ 102× gegen „Events“ 17×, „Abzeichen“ 148× gegen „Badges“ 11×. Der Reiter heißt „Mitmachen“, der Seitentitel darunter „Events“, die Karte „Deine Events — Termine und Veranstaltungen“, das Segment „Events | Aktivitäten“; das Onboarding erklärt den Bruch sogar. Mitteilungen sagen „Neues Badge erhalten!“ (CHANGELOG), das Handbuch „Abzeichen-Mitteilung“. Auch die Suchplatzhalter variieren („Events durchsuchen…“ bei Konfi/Team, „Event suchen…“ bei der Leitung; „Badges durchsuchen…“ / „Badge suchen…“).
- **Auswirkung aus Nutzersicht:** Eine Konfi liest im Handbuch von „Terminen“ und „Abzeichen“, sucht in der App danach und findet „Events“ und „Badges“; Elternbriefe und Handbuch-Zitate der Leitung passen nicht zur Oberfläche.
- **Beleg:** `grep -rhoE ">[^<{]*\bEvents\b[^<{]*<|'[^']*\bEvents\b[^']*'" frontend/src/components | wc -l` → 92; Handbuch `grep -rhow Termine docs/handbuch/*.md | wc -l` → 102.
- **Empfehlung:** Eine Entscheidung (Glossar in `docs/handbuch/`), dann Oberfläche **oder** Handbuch anpassen; mindestens Seitentitel/Reiter in Einklang bringen („Mitmachen“ → Titel „Mitmachen“ oder „Termine“).

### BF-11: Umlaut-Ersatzschreibungen in Nutzertexten (CLAUDE.md-Verstoß)

- **Schwere:** NIEDRIG
- **Fundstelle:** `frontend/src/services/notifications.ts:67` (`'Anmeldungen, Aenderungen, Absagen und Erinnerungen'`), `:72` (`'… und der Rueckblick'`), `frontend/src/components/admin/modals/KonfiModal.tsx:138` (`aria-label="Aenderungen speichern"`).
- **Kennzeichnung:** reproduziert (Skript über String-Literale und JSX-Text; 75 Roh-Treffer, davon 3 sichtbar — die übrigen sind API-Pfade, Schlüssel, Konsolentexte oder echte Wörter wie „Zuweisungen“).
- **Beschreibung:** Die Kanalbeschreibungen erscheinen wörtlich in den Android-Systemeinstellungen unter *Apps → Konfi Quest → Benachrichtigungen*; das Handbuch (`03-bedienung.md:211/243`) zitiert sie mit echten Umlauten („Anmeldungen, Änderungen, …“) — Doku und System stimmen nicht überein. Das `aria-label` wird vorgelesen („Aenderungen“).
- **Auswirkung aus Nutzersicht:** Sichtbar „Aenderungen“ in den Android-Einstellungen; Vorlesehilfe spricht „A-e-nderungen“.
- **Empfehlung:** Drei Stellen korrigieren; das Prüfskript (Scratchpad `umlaute.py`) als Test aufnehmen, damit die CLAUDE.md-Regel nicht nur für `psql` gilt.

### BF-12: Bewegungsreduktion nur in Wrapped und am „Was ist neu“-Banner

- **Schwere:** NIEDRIG
- **Fundstelle:** `prefers-reduced-motion` nur in `components/wrapped/WrappedModal.css:1180/1430/1946` und `theme/variables.css:4009` (`.app-whatsnew`). Nicht: `shared/OnboardingTour.tsx:134-171` (Swiper-Übergänge, wandernde Lutherrose), `LoginView.tsx:291` (`app-auth-card--shaking`), `common/LoadingSpinner.tsx` (pulsierende Punkte), Ionic-Seitenübergänge (`App.tsx:74-77`, `navAnimation`).
- **Kennzeichnung:** aus Code gelesen (grep; `wrappedBewegungReduzieren.test.ts` deckt nur Wrapped).
- **Beschreibung:** Wer im System „Bewegung reduzieren“ eingeschaltet hat, bekommt Onboarding-Wisch, Login-Schütteln und alle Seitenübergänge unverändert. WCAG 2.3.3 ist AAA, das Handbuch-Zielpublikum (13-Jährige, Ehrenamtliche) enthält aber Menschen mit vestibulären Beschwerden.
- **Empfehlung:** In `OnboardingTour` `speed={0}`/`allowTouchMove` bei `matchMedia('(prefers-reduced-motion: reduce)')`; Ionic `animated: false` unter derselben Bedingung in `setupIonicReact`.

### BF-13: Berührungsziele unter 44 px

- **Schwere:** NIEDRIG
- **Status:** behoben 26.09.2026 — Klasse `.app-beruehrungsziel` in `theme/barrierefreiheit.css`: ein unsichtbares `::after` von `max(100%, 44px)` mittig über dem Knopf nimmt die Berührung an, die Optik bleibt (Auge 19 px, X 32 px, Chat-Knöpfe 38 px). An zehn Stellen: Auge und Fehler-Kreuz auf den drei Anmeldeseiten mit Passwortfeld, X der Neuigkeiten-Karte, Anhängen und Senden im Chat. Gemessen mit Playwright/Chromium gegen Vite bei 393 px (`elementFromPoint`, 1-px-Schritte), Trefffläche vorher → nachher: Auge 20 × 20 → 44 × 45, X 32 × 32 → 44 × 44, Chat-Anhang 24 × 48 → 44 × 48, Chat-Senden 39 × 48 → 44 × 48, Fehler-X 12 × 21 → 44 × 44; Layout-Boxen unverändert (19,2 / 32,0 / 22,7 × 46,2 / 38,0 × 46,5 px). Tests `beruehrungsziele.test.ts` (Regel und alle zehn Stellen) und `beruehrungszieleGerendert.test.tsx` (Auge, X).
- **Fundstelle:** `theme/variables.css:3980-3993` (`.app-whatsnew__close` 32 × 32 px), `:2685-2690` (`.app-auth-input__toggle`: nur `font-size: 1.2rem` ≈ 19 px, kein Innenabstand), `typografie.css:52-55` (38-px-Chat-Knöpfe).
- **Kennzeichnung:** aus Code gelesen.
- **Beschreibung:** Apple HIG und Material verlangen 44 bzw. 48 px; WCAG 2.5.5 (AAA) 44 px, WCAG 2.2 2.5.8 (AA) 24 px. Das Passwort-Auge liegt mit ~19 px unter allen dreien.
- **Empfehlung:** Auge als Knopf mit 44-px-Trefffläche (Padding), `.app-whatsnew__close` auf 44 px mit negativem Rand.

### BF-14: 14 verschiedene Datumsformate

- **Schwere:** NIEDRIG
- **Fundstelle:** 56 `toLocale*`-Aufrufe in `components/` und `utils/` mit 14 unterschiedlichen Optionssätzen; dazu `utils/dateUtils.ts:10` (`formatDate`, `DD.MM.YYYY`) und `shared/eventFormatting.ts:5-24`.
- **Kennzeichnung:** reproduziert (grep, Ausgabe sortiert nach Häufigkeit).
- **Beschreibung:** `dd.MM.yyyy` (16×), `toLocaleDateString('de-DE')` ohne Optionen (13×), `d. MMM yyyy` (4×, sichtbar als „8. Sept. 2026“ im Profil), `d. MMMM` (3×), `dd.MM.` (3×), Wochentag kurz/lang (2×), Monat/Jahr (2×) usw. Alle korrekt deutsch, aber uneinheitlich: Termin „14.09.2026“, Rückblick „8. Sept. 2026“, Jahrgang „8.9.2026“ (Screenshot `leitung-jahrgaenge.png`).
- **Empfehlung:** Zwei, drei Formate in `eventFormatting.ts` festlegen und überall benutzen.

### BF-15: Dunkelmodus — 540 rohe Farbwerte in Komponenten außerhalb des Themes (Überblick, Details im Dunkelmodus-Bericht)

- **Schwere:** NIEDRIG (hier nur Zahl; Bewertung siehe `docs/audit/2026-09-26/darkmode.md`)
- **Fundstelle:** `grep -rnE "#fff\b|#ffffff\b|#000\b|#000000\b|\bwhite\b|\bblack\b|rgba?\(" frontend/src/components` → **540** Treffer in 40 Dateien, davon 128 `wrapped/WrappedModal.css` (eigene dunkle Folien, absichtlich), 50 `teamer/pages/TeamerDashboardPage.tsx`, 35 `konfi/views/DashboardSections.tsx`, 31 `wrapped/share/ShareCard.tsx`, 27 `chat/MessageBubble.tsx`. Außerhalb des Prüfbereichs von `dunkelmodus.test.ts` (nur `theme/*.css` und Inline-`white/black`): `shared/FileViewerModal.css:118` (`background: #fff`).
- **Kennzeichnung:** reproduziert (grep). Die meisten Treffer sind weißer Text/Halbtransparenz auf Farbflächen und in beiden Modi richtig; die Bereichsfarben stehen im Dunkelblock (`variables.css:3572 ff.`) mit **identischen** Werten wie hell, obwohl der Kommentar „eine Stufe heller“ sagt — als Textfarbe auf der dunklen Karte `#242426` ergeben sie 1,72:1 (`konfis`) bis 3,21:1 (`events`).
- **Empfehlung:** Details, Screenshots und Bewertung im Dunkelmodus-Bericht; hier nur der Zähler als Ausgangswert.

### BF-16: 16 Modale ohne Namen

- **Schwere:** NIEDRIG
- **Status:** behoben 26.09.2026 — alle 17 `<IonModal>` (inzwischen eins mehr als im Bericht) tragen einen Namen: Postfach und „Neuer Rückblick" `aria-labelledby` auf die `id` ihrer `IonTitle`, die 15 Datumswähler-Modale `aria-label="<Feld> wählen"` aus dem Namen des `IonDatetime` darin. Gemessen (grep `<IonModal` in `components/`): 17 ohne Namen → 0. Tests `modaleBenannt.test.ts` (Zählung, `aria-labelledby`-Ziele vorhanden) und `modaleBenanntGerendert.test.tsx` (Bonus- und Aktivitäts-Modal, Postfach). Offen bleibt außerhalb der Zählung: die 92 per `useIonModal` geöffneten Modale erhalten ihren Namen nur über `htmlAttributes` je Aufruf — als Nebenbefund gemeldet.
- **Fundstelle:** 16 `<IonModal>` in `components/`, 0 mit `aria-label`/`aria-labelledby` (grep).
- **Kennzeichnung:** aus Code gelesen.
- **Beschreibung:** Ionic rendert `role="dialog"`; ohne Namen kündigt die Vorlesehilfe nur „Dialog“ an, nicht „Termin bearbeiten“. Der Titel steht als `IonTitle` im Modal — `aria-labelledby` auf dessen `id` reicht.
- **Empfehlung:** In `AppKopfzeile`-Nutzung der Modale die Titel-`id` durchreichen.

## Unklar

- **Android WebView und Systemschriftgröße:** Ob der Capacitor-WebView die Android-Schriftskalierung übernimmt (Chromium-Standard ja, sofern niemand `textZoom` setzt — im Projekt nicht gefunden), ließ sich hier nicht messen. Gerätetest mit „Schriftgröße: Größt“ nötig (siehe unten).
- **App-Store-Bildgrößen:** Die iPhone-Bilder sind 1 179 × 2 556 (6,1"), die Play-Bilder 1 080 × 2 160. Ob App Store Connect für den 2.3.0-Upload 6,7"/6,9" (1 290 × 2 796 / 1 320 × 2 868) verlangt, kann ich offline nicht prüfen; das Skript kennt nur `iphone`, `play`, `ipad`, `desktop`.
- **Fokusfalle in Modalen:** Ionic dokumentiert eine Fokusfalle für Overlays; im minifizierten Build fand ich `trapKeyboardFocus` nur in `ion-menu.js`. Ohne Backend war kein Modal erreichbar, um es zu messen.
- **`teamer-abzeichen.png`:** Unter „Erreichte Badges (3)“ steht als erste Gruppe „Kategorie-Meister — 0 von 8“ mit lauter gesperrten Kacheln. Ob das eine Gruppierungs-Eigenart (Gruppen mit 0 Erreichten unter „Erreichte“) oder Absicht ist, ließ sich ohne Daten nicht klären.
- **Fehlertexte aus dem Backend:** `fehlerText()`/`fehlerTextOderMessage()` (`utils/fehler.ts:33-46`) reichen Servertexte durch. Ob alle Backend-Meldungen deutsch und laienverständlich sind, ist Sache des Backend-Audits.

## Alte Befunde nachgeprüft

- **`docs/offene-befunde.md` Nr. 4 „Screenshots zeigten die falsche Seite“ (10.09.2026, BEHOBEN)** → **behoben bestätigt, aber Bilder veraltet.** MD5 über alle 42 Dateien: 0 Dubletten; kleinste Datei 442 kB; kein Ladezustand, keine 404 auf einem der 42 Bilder (alle angesehen). Play-Bilder tragen den MD3-Look — die Android-Kennung aus `scripts/screenshots.mjs:63-65` greift. Offen bleibt: Stand 10.09. (BF-09).
- **CLAUDE.md „Android-Screenshots brauchen eine Android-Kennung“** → umgesetzt (`GERAETE.play.kennung`), im Bild verifiziert (Unterstrich-Segmente, Material-Tab-Leiste, Toolbar ohne Glas-Pille).
- **CHANGELOG 2.3.0 „Alle Symbol-Marken in den Ecken der Karten sind jetzt für Vorlesehilfen beschriftet“** → bestätigt: `eckBadgesBarrierefrei.test.tsx` grün; `StatusBadge.tsx:122-124` und `EventCornerBadges.tsx:55-79` tragen `role="img"` + `aria-label`.
- Die übrigen Nummern (1–3, 5–13) liegen außerhalb dieses Bereichs.

## Geprüft und in Ordnung

| Was | Fundstelle | Methode / Ergebnis |
|---|---|---|
| Icon-Knöpfe mit Namen | alle `IonButton` in `components/` | Skript: 256 `IonButton`, 89 nur mit Symbol, **0** ohne `aria-label`/`title` |
| Bilder mit `alt` | 24 `<img>` in `components/` | grep: 24/24 mit `alt` (dekorative mit `alt=""` + `aria-hidden`) |
| Glocke vorlesbar, Farbe nicht alleiniger Träger | `shared/PostfachGlocke.tsx:47-58, 77-83` | Text „Postfach: 2 ungelesene Mitteilungen, 1 Vorgang wurde nicht gesendet“ im `aria-label`; Zahl `aria-hidden`; `postfachGlocke.test.tsx` grün |
| Gemeinde-Umschalter | `shared/OrgSwitcherButton.tsx:160-166, 188-196` | `aria-label` mit vollem Namen, `aria-current` am aktiven Eintrag |
| Toasts als Live-Region | `common/GlobalToasts.tsx`, Ionic `ion-toast.js` | Ionic setzt `role:"status"`; Fehler/Erfolg über `AppContext` zentral |
| Keine rohen `error.message` in Toasts | `components/**` | grep: 2 Stellen (`ActivityRequestModal.tsx:126`, `TeamerActivityRequestModal.tsx:129`) mit deutschem Fallback und eigener `Error`-Quelle; sonst `fehlerText()` |
| Punktearten nicht nur farbig | `admin/views/ActivityRings.tsx:332-344`, Screenshot `konfi-startseite.png` | Legende „Gesamt / Gottesdienst / Gemeinde“ mit Zahlen |
| Kennzahlen-Ampel mit Text | `admin/pages/AdminMetricsPage.tsx:440-442` | „zügig / erträglich / zu langsam“ neben den Farben |
| Passwortregeln mit Symbol | `auth/KonfiRegisterPage.tsx:646` | Haken/Warnzeichen zusätzlich zur Farbe |
| Plattform-Modus | Playwright, vier Kennungen | Desktop → `md`, iPhone → `ios`, Android → `md`, Macintosh+Touch (iPad) → `ios`; kein erzwungener `mode` in `setupIonicReact` |
| Registrierung ohne Server | `/register?code=…` nach 10 s | „Verbindung fehlgeschlagen. Bitte prüfe deine Internetverbindung.“ + Knopf „Erneut versuchen“ — verständlich, kein Endlos-Spinner |
| Login-Fehlertext | `/login` nach Klick | „Anmeldung fehlgeschlagen — Keine Verbindung zum Server …“ nach ~6 s (axios-retry), deutsch, mit Schließen-Kreuz |
| Browser-Zurück | Playwright | `/login` → „Passwort vergessen?“ → `/forgot-password` → `goBack()` → `/login`, Felder sichtbar |
| Unbekannte URL | Playwright `/irgendwas/unbekannt` | Umleitung auf `/login` (App.tsx `path="*"`) |
| Desktop 1 440 px | Screenshot | Karte 420 px zentriert, Hero lesbar, kein Überlauf |
| 150 % Textzoom bei 393 px | Playwright | `scrollWidth 393 = innerWidth`, Inhalt scrollt (974 px) |
| Safe Areas | grep `env(safe-area-inset` | 23 Stellen in eigenen Overlays (Wrapped, FileViewer, Onboarding, Chat-Fußzeile); Rest Ionic |
| Tastatur-Plugin | `capacitor.config.ts` `Keyboard.resize: 'ionic'`, `chat/useChatScroll.ts:177-179` | Chat scrollt bei `keyboardWillShow/DidShow` ans Ende |
| Onboarding/Änderungsanzeige abbrechbar und erneut aufrufbar | `shared/OnboardingTour.tsx:127-131, 174-191`, `hooks/useOnboardingOnce.ts`, `UpdateHinweisKarte` in 6 Seiten (3 Rollen × Start/Profil bzw. Mehr) | „Überspringen“ bis zur letzten Folie, „Los geht’s!“ schließt; Version wird erst beim Schließen vermerkt; Banner „Was ist neu in Version 2.3?“ dauerhaft im Profil/Mehr; `onboardingSlides.test.ts` (≤ 300 Zeichen, ≤ 6 Folien) und `e2e/aenderungsanzeige.spec.ts` |
| Onboarding-Kachel tastaturfähig | `shared/UpdateHinweisKarte.tsx:22-34` | `role="button" tabIndex={0} onKeyDown Enter/Space`, X mit `aria-label` |
| Android-Systemleisten folgen dem Modus | `capacitor.config.ts` `SystemBars.style: 'DEFAULT'` | Begründung im Kommentar; Test `systemBars.test.ts` referenziert |
| `color-scheme` Meta | `index.html:9` | `light dark` gesetzt |
| Handbuch-Bilder gespiegelt | `diff -rq docs/screenshots frontend/public/docs/bilder` | leer — Generator-Stand konsistent |
| Bestehende Schutz-Tests | 5 Dateien | 272 Tests grün in 10,9 s |

## Nicht geprüft

- Seiten hinter dem Login im echten Browser (Dashboard, Listen, Modale, Chat) — kein Backend; dort gilt nur die statische Auswertung (BF-01, BF-03).
- Fokusreihenfolge und Fokusfalle in geöffneten Modalen, Escape-Verhalten, Scrollen in Modalen — nur Ionic-Quelle gelesen.
- Screenreader auf echten Geräten (VoiceOver, TalkBack), Dynamic Type auf iOS, Schriftskalierung auf Android.
- Querformat auf iPad/Tablets (gesperrt, siehe BF-06).
- Statusleiste iOS im Dunkelmodus, weißer Blitz beim Android-Kaltstart im Dunkelmodus — Dunkelmodus-Bericht.
- Store-Listings (App Store Connect / Play Console) selbst — kein Zugriff.
- jsdom-Rendering aller Seiten je Rolle (Kontexte/API-Mocks wären je Seite nachzubauen; die Browser-Messung an den vier Auth-Seiten belegt das Muster).

## Auf Produktion nachzumessen

1. **Vorlesehilfe am Gerät:** iPhone mit VoiceOver auf konfi-quest.de/login und in der App: Namen der Felder („Benutzername“ erwartet, „Textfeld“ beobachtet?), Rolle der Listeneinträge unter „Mehr“, Sprache der Stimme (BF-01, BF-03, BF-05).
2. **Schriftgröße:** iOS *Einstellungen → Bedienungshilfen → Anzeige & Textgröße* auf Maximum; Android *Anzeigegröße und Text* auf Größt — wächst die App mit? (BF-07, Unklar 1).
3. **Web-Tastatur:** Am Rechner auf konfi-quest.de/login nur mit Tab/Enter versuchen, „Passwort vergessen“ zu erreichen und sich anzumelden (BF-02).
4. **Automatischer Lauf:** `npx playwright test` mit axe-core (`@axe-core/playwright`) gegen `/login`, `/register`, `/forgot-password` — erwartet nach den Auflagen 0 Verstöße der Regeln `label`, `button-name`, `html-has-lang`, `color-contrast`.
5. **Screenshots neu:** nach dem Deploy `KONFI_DEMO_PASSWORT=… node scripts/screenshots.mjs` und `… --geraet play`, dann `npm --prefix frontend run docs:handbuch`; jedes Bild ansehen — Glocke oben rechts, Banner „Version 2.3“ (BF-09).
6. **Kontrast am Gerät:** Zeitstempel („15d“) und Untertitel in der Chatliste bei voller Helligkeit im Freien lesen; Colour-Contrast-Analyser auf `#8e8e93`/`#999` gegen Weiß (BF-04).
