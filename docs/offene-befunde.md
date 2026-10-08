# Offene Befunde

Die eine Stelle für alles, was offen ist: Fehler und Lücken, Entscheidungen
bei Simon, Geplantes und Zurückgestelltes. Oben steht die **Arbeitsliste**
— was gerade läuft, worauf wir warten, was als Nächstes kommt —, darunter
die ausführlichen Einträge, auf die sie verweist. Was erledigt ist, wird
hier gestrichen — es bleibt in der Git-Historie und in der Commit-Nachricht.

- **Erledigt?** Eintrag unten löschen, in der Arbeitsliste abhaken und unter
  „Erledigt seit dem letzten Release" mit Datum und PR oder Commit
  vermerken; im Commit sagen, womit er erledigt ist.
- **Neu?** Unten eine Zeile mit Was, Warum und Seit wann; dazu genug Kontext,
  dass die nächste Sitzung ohne Vorwissen anfangen kann. In die
  Arbeitsliste kommt er, sobald jemand daran arbeitet oder er als Nächstes
  dran ist.
- **Keine Nummern.** Verweise aus Code und Doku nennen den Titel eines
  Eintrags, nicht seine Stelle in der Liste.
- Kennungen wie „Sicherheit BF-10" verweisen auf das Release-Audit vom
  26.–28.09.2026; wo es steht, erklärt
  [docs/README.md](README.md#befundkennungen).

Stand: 08.10.2026, gegen Code, Git und die Stores geprüft.

## Arbeitsliste

Je Punkt ein Satz und der Verweis auf den ausführlichen Eintrag, den Plan
oder den Auftrag. Abhaken, wenn der Branch auf `main` ist bzw. die Sache
erledigt ist.

### In Arbeit

- [ ] **Test-Backend am Server abbauen** — im Repo erledigt
  (`chore/test-backend-abschaffen`); am Server erst nach dem Push auf
  `main`: Stack-Dienst entfernen, Traefik-Regel, KeyHelp-vHost, DNS-Eintrag,
  Registry-Tags `test-latest` ([Betrieb](#betrieb), „Test-Backend teilt
  Datenbank und Schlüssel mit Produktion").

### Wartet auf Gerät oder Simon

- [ ] **Maltes Gerätetest Android versionCode 135** (interner Testtrack seit
  08.10.2026) — Rückmeldung je Prüfpunkt aus
  [Auftrag 18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md), Schritt 4.
- [ ] **VoiceOver, Sprachsteuerung und größte Schrift am iPhone** —
  Voraussetzung für die Barrierefreiheitsangaben bei Apple
  ([Release](#release), „Barrierefreiheitsangaben im App Store").
- [ ] **Simons offene Fragen** — unten unter
  [Bei Simon zu entscheiden](#bei-simon-zu-entscheiden); als Erstes die
  Status-Spalten (Simon fragt, was gemeint ist — dort erklärt).
- [ ] **CodeQL #124 und #127 auf GitHub als „False positive" schließen** —
  am Code begründet ([Code](#code), „CodeQL-Meldungen").

### Als Nächstes

- [ ] **Release 2.4.0** — Bildschirmfotos der Challenges erneuern
  ([planung/2.4.0.md](planung/2.4.0.md#1-challenges-als-eigene-seiten-wie-events)),
  ausliefern mit 2.4.0 ([Auftrag 18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md),
  Schritt 5), danach die Haken in der Play Console prüfen ([Release](#release),
  „Play Console empfiehlt vier Änderungen"); Ablauf in
  [betrieb/release.md](betrieb/release.md).
- [ ] **Support-Probelauf mit Vorgängen** —
  [Auftrag 16](auftraege/lokaler-agent/16-support-vorgaenge-probelauf.md).
- [ ] **Web-Version: was noch fehlt** — Leiste „Verwaltung", Rückweg ohne
  Gemeinde, Kennzahlen, Einwilligung am Profil
  ([planung/web-version.md](planung/web-version.md#offen)); Zuweisung von
  Vorgängen und Bildschirmfotos im Support-Formular
  ([planung/support-vorgaenge.md](planung/support-vorgaenge.md)).
- [ ] **Doppelter Code Konfi/Team** ([Code](#code)).
- [ ] **Feature-Empfehlungen vor der EKD-Ausrollung** —
  [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md).

### Später (entschieden)

- **DSGVO- und EKD-Unterlagen vor der Ausrollung** — Simon, 08.10.2026:
  „machen wir später" ([Zurückgestellt](#zurückgestellt), „Rechenschaft vor
  der EKD-Ausrollung").
- **„Darf freigeben"** — Simon, 08.10.2026: „machen wir viel später"
  ([planung/darf-freigeben.md](planung/darf-freigeben.md)).
- **Tablet-Fassung über die Web-Version** — Simon, 08.10.2026: „bisher nur
  hochformat, aber die web version … könnte eine tablet version werden". Die
  Apps bleiben im Hochformat; der Play-Hinweis „feste Ausrichtung" bleibt
  damit bewusst offen ([Release](#release)).

### Erledigt seit dem letzten Release

Seit 2.3.0 (Tag `2.3.0` auf `dac246eb`). **Wird beim Release 2.4.0
geleert** — der Beleg bleibt in Git und im CHANGELOG.

- [x] 03.10.2026 — 2.3.0 in beiden Stores: iOS freigegeben und live, Android
  (134) auf 100 % (Auftrag 13, `145270d0`).
- [x] 03.10.2026 — Repo aufgeräumt, 2.4.0 begonnen, veraltete
  Schema-Kommentare und der Biometrie-Schalter entfernt (#217, `4cc24f0e`).
- [x] 03.10.2026 — Web-Version mit Support-Ansicht und Anfrageformular,
  Challenges als Seiten, Rollenfarben, Support-Konten (#218, `4d5381a7`);
  TestFlight-Build 241 (Tag `2.4.0+ios.241`).
- [x] 03.10.2026 — Support-Mail (#219, `821e16e6`) und Support-Ansicht als
  Web-Oberfläche (#220, `2a282965`); Test-Gemeinden intern, Probe-Anfrage
  (Auftrag 15, `48f5c197`).
- [x] 06.10.2026 — Web-Ansicht aller Bereiche und Support-Vorgänge (#225,
  `e7357805`); Rollenfarbe der Filter, Konfi-Filter, Benachrichtigungen
  (#226, `c0445bd8`).
- [x] 07.10.2026 — gleicher Aufbau der Detailseiten, Liste/Kacheln (#227,
  `8d12dfd1`); Personenseite, Kacheln, Angaben mit Symbolen (#229,
  `fb07f831`); Listen sortierbar, Antrags-Entscheidung antwortet vor den
  Pushes (#230, `84363fe6`).
- [x] 08.10.2026 — Android-Gradle-Plugin 9.2.1, Gradle 9.5.1 (#231,
  `e48a7dd1`); versionCode 135 im internen Testtrack (`7741a3fc`, Tag
  `2.4.0+android.135`); Gradle-Schreibweise für Gradle 10 (#232,
  `8ef310f3`).
- [x] 08.10.2026 — Entscheidungen Simons: Chat-Mitteilungen ohne Inhalt
  bleiben (am Code bestätigt: nur Absender und Art,
  `backend/utils/pushText.js`); „Nachricht melden" wird nicht gebaut, weil
  jeder Chat moderiert ist (E-15 in
  [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md));
  Test-Backend abschaffen; Mehrfach-Konten-Fragen beantwortet;
  DSGVO/EKD-Unterlagen, „Darf freigeben" und Tablets später.
- [x] 08.10.2026 — Arbeitsliste oben in dieser Datei (`docs/arbeitsliste`).
- [x] 08.10.2026 — CodeQL #138, Schalternamen im Regex vollständig maskiert
  (`fix/codeql-138-regex`, PR #233).
- [x] 08.10.2026 — Test-Backend im Repo abgebaut: Dienst aus der
  Referenz-Compose, Workflow und `api_url`-Eingabe entfernt; die fünf
  TestFlight-Builds, die darauf zeigten, sind abgelaufen
  (`chore/test-backend-abschaffen`). Die Server-Seite steht oben unter „In
  Arbeit".
- [x] 08.10.2026 — Zeitgeber und Horcher enden mit ihrer Seite (alle Stellen,
  mit Wächtertest), Zähler-Abruf nach Chat-Nachrichten entprellt (Betrieb
  BF-08), doppelte CSS-Klassen der Bereichs-Stylesheets aufgelöst,
  Filterzeile der Challenges bei 1366 px einzeilig, `armv7` aus der
  Info.plist (CI BF-15) (`fix/zeitgeber-aufraeumen`).
- [x] 08.10.2026 — kein Bearbeiten-Knopf bei Super-Admin-Konten, erlaubter
  Fall für Löschen und Jahrgangszuweisung durch Super-Admins im Test,
  Zeichenregel für den Benutzernamen der Gemeindeleitung, eigene Mail nach
  „Passwort setzen" für Support-Konten, Punktart am Beleg (Migration 200),
  CodeQL #128, Wiederholungsschutz für Bonuspunkte und einzelne Events
  (Migration 201); CodeQL #124 und #127 am Code als Fehlalarme begründet
  (`fix/offene-backend-fehler`).
- [x] 08.10.2026 — Mehrfach-Konten abgeschlossen: Event-Chat nach der
  Gemeinde des Termins, Push mit Gemeinde zwingend, Urheber:innen und
  Detailansicht aus anderen Gemeinden, Stamm-Zeilen angeglichen,
  Funktionsbezeichnung, „Teamer seit" und Sperre je Gemeinde, Löschen durch
  die Leitung beendet nur die eigene Mitgliedschaft, Rolle in
  Termin-Teilnehmern und Chat-Nachrichten und Gemeindeleitung beim
  Bearbeiten einer Gemeinde aus der aktiven Gemeinde, Sperre wirkt sofort
  auf beiden Replicas (Sicherheit BF-10), Gemeinde-Rückfall lädt Rolle und
  Namen neu (Grundgerüst BF-05) (`feat/mehrfach-konten-abschluss`;
  [planung/mehrfach-konten.md](planung/mehrfach-konten.md#umsetzung-stand-08102026)).
- [x] 08.10.2026 — Push, Postfach-Eintrag und Mail nach der Antwort stehen
  als Auftrag in einer dauerhaften Warteschlange (Migration 202) und
  überleben einen Neustart (`feat/nachantwort-warteschlange`;
  [betrieb/routinen.md](betrieb/routinen.md#nachlauf-warteschlange)).
- [x] 08.10.2026 — Reste der Mehrfach-Konten: Feed-Push an Konfis über beide
  Quellen der Zugehörigkeit, Gegenprobe zur Push-Sperre im Chat-Versand,
  beim Entfernen eines Konfi-Mischkontos gehen die Konfi-Daten dieser
  Gemeinde mit, Chat-Export mit der Rolle in der Gemeinde des Raums; die
  Leitung trägt Team aus einer anderen Stamm-Gemeinde wieder vom Termin aus
  (`fix/mehrfach-konten-reste`).

## Offen

### Code

- **Ringe und Zähler beachten „Bewegung reduzieren" nicht.**
  `frontend/src/components/admin/views/ActivityRings.tsx` und
  `frontend/src/hooks/useCountUp.ts` animieren auch, wenn das System
  „Bewegung reduzieren" verlangt; beide Dateien fragen die Einstellung nicht
  ab (geprüft 08.10.2026). Das Handbuch
  ([03-bedienung.md](handbuch/03-bedienung.md#bewegung-reduzieren)) nennt
  sie nicht unter dem, was dann ruhig bleibt; die Angabe „Bewegung
  reduzieren" bei Apple setzt die Korrektur voraus ([Release](#release)).
- **Doppelter Code Konfi/Team.** `backend/routes/teamer.js` führt eine eigene
  Liste `KONFSPRUCH_TRANSLATIONS` und ein eigenes `loadKonfspruch` (um Zeile
  979 und 983), obwohl es beides aus `utils/konfspruch.js` importiert — die
  lokale Konstante beschattet den Import. `PATCH /profile` steht zweimal,
  in `routes/konfi.js` (um Zeile 2180) und `routes/teamer.js` (um Zeile
  1074), mit eigener Prüfliste je Seite. Die Kopien sind schon einmal
  auseinandergelaufen (Punkte-Historie, Tageslosung, beide inzwischen
  zusammengelegt). Fix: eine Stelle je Funktion, Antwortformen unverändert.
  Seit 01.09.2026 bekannt (interne Aufgabenliste), am 08.10.2026 am Code
  bestätigt.
- **Stamm-Rolle an weiteren Stellen (Mehrfach-Konten).** Beim Abarbeiten der
  Reste am 08.10.2026 per Suche nach `u.role_id`/`u.organization_id`
  gefunden und am Code bestätigt; alle betreffen Team-Konten, die nur über
  `user_organizations` zur Gemeinde gehören:
  - Schutz „letzte Gemeindeleitung": `DELETE /users/:id`
    (`backend/routes/users.js`) und die Selbstlöschung
    (`POST /auth/delete-account`, `backend/routes/auth.js`) zählen nur
    Gemeindeleitungen mit Stamm-Gemeinde hier. Folge: unnötiges 409, und wer
    nur über `user_organizations` einzige Gemeindeleitung ist, kann sein
    Konto löschen und die Gemeinde ohne Leitung lassen. Der Test in
    `users.test.js` hält das Zählen „wie bisher" ausdrücklich fest —
    **Entscheidung bei Simon**.
  - Live-Updates an eine Person (`sendToUserByRole`,
    `backend/utils/liveUpdate.js`) wählen den Socket-Raum nach der Rolle am
    Konto; wer zuhause Teamer:in und hier Leitung ist (oder umgekehrt),
    bekommt sie in der weiteren Gemeinde nicht.
  - Jahrgang mit Zuweisungen anlegen (`POST /jahrgaenge`): Team aus einer
    anderen Stamm-Gemeinde ergibt 404.
  - Einmalpasswort (`POST /admin/konfis/:id/regenerate-password`) und
    `PUT /users/:id/reset-password` finden Team aus einer anderen
    Stamm-Gemeinde nicht (404/403). Ob eine weitere Gemeinde das
    kontoweite Passwort setzen darf, ist **Entscheidung bei Simon**.
  - Teamer-Rückblick (`backend/routes/wrapped.js`): „Dein Team" zählt nur
    Teamer:innen mit Stamm-Gemeinde hier, `/team-jahre` nimmt die Rolle am
    Konto.
  - Teilnehmende eines Termins in der Konfi-Sicht (`backend/routes/konfi.js`)
    filtern Teamer:innen nach der Rolle am Konto.
  - Der Hintergrundlauf für App-Symbol-Zahl und Abzeichen
    (`backend/services/backgroundService.js`) lässt aus, wessen
    Stamm-Gemeinde gesperrt ist, auch wenn die weitere aktiv ist.
  - Der Schutz der Gemeindeleitung im Jahrgangs-Chat
    (`backend/utils/jahrgangChat.js`) beachtet die Sperre je Gemeinde nicht.
- **Anlegen ohne Wiederholungsschutz (Rest).** Bonuspunkte und einzelne
  Events tragen seit 08.10.2026 eine `client_id` (Migration 201). Offen sind
  Event-Serien und die Konfi-Anlage; die Konfi-Anlage geht nur online, weil
  ihre Antwort das Einmalpasswort trägt (Grundgerüst BF-02, Rest).
- **Laufzeiten im Hintergrund nicht sichtbar.** `/api/metrics/local` zeigt den
  Cron-Leader, aber nicht, wann welcher Job zuletzt lief und wie lange; auch
  die Dauer eines Push-Versands und des Zähler-Laufs steht in keiner
  Log-Zeile (01.10.2026: „nicht messbar ohne Code"). Seit 27.09.2026
  (Betrieb BF-10, Rest).
- **Unerklärtes 500 an `mark-read`.** `POST /api/chat/rooms/*/mark-read`
  antwortete zwischen 28.09. und 01.10.2026 einmal mit 500 (bei 718 × 200).
  Am 08.10.2026 keine belastbare Ursache gefunden. Kandidaten: Der Raum wird
  zwischen Rechteprüfung und Schreiben gelöscht (Fremdschlüssel), oder ein
  Deadlock bzw. Verbindungs-Timeout. Beim nächsten Auftreten das Log der
  Replica zur Uhrzeit lesen.
- **CodeQL-Meldungen.** #124 `js/missing-rate-limiting` an `GET
  /chat/files/:filename` (`backend/routes/chat.js`) und #127 an `POST
  /challenges/konfi/:id/submissions` (`backend/routes/challenges.js`) sind
  Fehlalarme: Der globale Limiter hängt per `app.use` vor allen Routen, der
  Upload-Limiter an der Beitrags-Route (beides in `backend/createApp.js`);
  CodeQL sieht das über die Dateigrenze nicht (am Code begründet
  08.10.2026). Offen ist nur, dass Simon beide auf GitHub als „False
  positive" schließt.

### Tests und CI

- **Dunkelmodus-Messung nicht in der CI.** `npm run dunkelmodus:messen`
  ([wissen/dunkelmodus-pruefen.md](wissen/dunkelmodus-pruefen.md)) läuft nur
  von Hand gegen eine lokale Vorschau; die CI prüft das Stylesheet als Text.
  Eine Farbänderung kann den Dunkelmodus zurückwerfen, ohne dass die CI rot
  wird. Seit 27.09.2026 (Dunkelmodus-Audit BF-09, Rest).
- **Quelltext-Tests.** 117 Frontend-Testdateien lesen Quelltext statt
  Verhalten (Stand 30.09.2026, Leitplanke
  `frontend/src/__tests__/quelltextTestsLeitplanke.test.ts` lässt keine neuen
  zu); 41 davon versprechen Verhalten und sollten gerendert prüfen (Tests
  BF-02, Rest).
- **Ohne Test.** 3 Utils, 2 Hooks und 1 Service kommen in keinem Test vor
  (30.09.2026); gegen neue Komponenten ohne Test gibt es keine Leitplanke
  (Tests BF-10, Rest).
- **E2E-Aufwärmen.** Der erste E2E-Test direkt nach dem Start des Stacks kann
  an `ERR_NETWORK_CHANGED` scheitern (beobachtet 30.09.2026); ein
  Aufwärmschritt im E2E-Setup würde helfen.
- **Erste echte Fälle beobachten.** Die Vorwärts-Prüfung des Deploys
  (`NUR_VORWAERTS` in `deploy/rollend.sh`) und die Meldung bei rotem `main`
  (`ci-meldung.yml`) sind nur gegen Nachbauten geprüft. Beim ersten echten
  Überholfall bzw. roten `main` das Log und das Issue ansehen (CI BF-04,
  BF-07, Rest).

### Betrieb

- **Test-Backend teilt Datenbank und Schlüssel mit Produktion.**
  `backend-test` hing an der Produktionsdatenbank, an denselben Uploads und
  am selben `JWT_SECRET`. Entschieden 08.10.2026 (Simon): abschaffen. Im Repo
  erledigt (`chore/test-backend-abschaffen`, 08.10.2026: Dienst aus
  `deploy/compose.konfi_quest.yml`, Workflow und `api_url`-Eingabe entfernt;
  kein gültiger Build zeigt mehr darauf). Offen ist die Server-Seite, erst
  nach dem Push auf `main`: Dienst aus dem Live-Stack nehmen, Traefik-Regel,
  KeyHelp-vHost, DNS-Eintrag und die Registry-Tags `test-latest` entfernen.
- **Referenz-Compose nachziehen.** `deploy/compose.konfi_quest.yml` fehlen
  die gewollten Abweichungen des Live-Stacks (Abgleich 27.09.2026): Router
  auch für den `www.`-Host, die Middlewares für Kompression und
  Wiederholung beim Deploy, das Sticky-Cookie am API-Dienst und der eigene
  Router für `/docs/api`. Wer die Referenz kopiert, verliert sie.
- **Log-Fenster vor dem nächsten Abriss von Routen.** Ob eine alte Route noch
  gerufen wird, zeigt nur das Zugriffslog des Reverse-Proxys, und das reicht
  heute nur wenige Tage zurück — die Regel verlangt zwei Wochen. Eine Null
  aus einem zu kurzen Fenster beweist nichts. Vor dem nächsten Abriss die
  Aufbewahrung des Zugriffslogs verlängern oder es täglich abgreifen; Weg
  und Zahlen in [api/ABRISS.md](api/ABRISS.md). Seit 01.09.2026.
- **Aufbewahrung der Sicherungen.** Am Host bleiben 14 tägliche Dumps; die
  Wochen- und Jahresstände aus
  [betrieb/sicherung.md](betrieb/sicherung.md#rhythmus-und-aufbewahrung)
  gibt es dort nicht, und ob das Datei-Backup des Hosts sie abdeckt, ist
  nicht gemessen (01.10.2026).
- **Drossel des Massenversands über der Mailgrenze.** Das Absenderkonto darf
  300 Mails je Stunde; `SMTP_MASSEN_JE_MINUTE` ist im Stack nicht gesetzt,
  also 20 je Minute (1.200 je Stunde). Ein großer nächtlicher Lauf
  (Lizenz-Erinnerung, Löschwarnung) liefe nach rund 15 Minuten in
  vorübergehende Ablehnungen. Im Stack auf höchstens 4 setzen (Messung
  01.10.2026).
- **Uploads wachsen ohne Aufräumen und Wächter.**
  `backend/scripts/cleanupOrphanPhotos.js` und `scripts/verwaiste-dateien.mjs`
  laufen nur von Hand; eine Überwachung des Plattenplatzes gibt es im Repo
  nicht. Heute 237 MB; mit Challenge-Videos (bis 50 MB je Beitrag) wächst
  es bei EKD-Größe schnell (Betrieb, „Nicht geprüft").
- **Lasttest vor der EKD-Ausrollung.** Die Kapazitätsaussage ist aus
  gemessenen Einzelkosten gerechnet. Nicht gemessen: Tausende gleichzeitige
  Sockets (Speicher je Replica bei 512 MB Grenze), Zustellrate und Dauer bei
  Firebase unter Last, Postgres unter Parallellast (Betrieb, „Unklar" und
  „Nicht geprüft").
- **Vier Zählungen „Wer bekommt was".** In Produktion zu zählen: Admins mit
  und ohne Jahrgangszuweisung, Gemeinden ohne Gemeindeleitung in der
  Stamm-Gemeinde, Zuweisungen mit `can_view = false` und Leitungs-Mitteilungen
  über Konfis, die es nicht mehr gibt. Sie zeigen, wie viele die Fixes vom
  27.09.2026 betrafen. Seit 27.09.2026.
- **Übrige Bestandszählungen.** Konfis ohne Jahrgang, aktive Pflicht-Events
  ohne Jahrgang, Push-Tokens ohne `app_version`, ungelesene Mitteilungen je
  Person — als Grundlage für spätere Aufräum-Migrationen nie gemessen
  (Behebungsbericht, „Nach dem Deploy").

### Am Gerät

- **Sicherheitsregeln des Browsers (CSP) am Gerät.** In Chrome unter der
  öffentlichen Adresse 0 Meldungen auf 34 Seiten der Leitung (01.10.2026).
  Nicht geprüft: Safari auf dem iPhone, die Ansichten von Konfi und Team,
  QR-Scanner, Sprachaufnahme, Rückblick als Bild (CI BF-14, Rest).
- **Bedienung am Gerät.** Funkloch (Flugmodus; Abmeldung von einem Event ohne
  Netz), VoiceOver und TalkBack je Rolle auf Anmeldeseite und im Chat,
  Systemschrift „Größt", Kaltstart; ein Tipp auf die Statusleiste des
  iPhones scrollt nach oben (sonst kann `@capacitor/status-bar` weg);
  `aps-environment = production` im nächsten IPA (Gesamtabnahme,
  Messung 17; Feature E-09 und Toolchain BF-10, Rest).

### Release

- **Barrierefreiheitsangaben im App Store.** Apple fragt je Gerät ab, welche
  Bedienungshilfen die App unterstützt. Heute angebbar: Dunkelmodus und
  „Nicht nur über Farbe". „Bewegung reduzieren" erst, wenn Ringe und Zähler
  sie beachten ([Code](#code)). Kontrast im Hellmodus nicht: 25 von 51
  Text-Tokens mit festem Farbwert im Hellmodus
  (`frontend/src/theme/variables.css`) bleiben auf Weiß unter 4,5:1
  (gemessen 08.10.2026; siehe [Zurückgestellt](#zurückgestellt), „Kontrast
  im Hellmodus"). VoiceOver, Sprachsteuerung und größere Schrift erst nach
  dem Test am iPhone ([Am Gerät](#am-gerät), „Bedienung am Gerät").
- **Play Console empfiehlt vier Änderungen an der Android-App** (Release
  2.3.0, abgelesen von Simon am 07.10.2026). Am Code geprüft:
  1. *Randlose Anzeige ab Android 15:* Die App zielt auf SDK 36; Google rät,
     die randlose Anzeige zu testen bzw. `EdgeToEdge.enable()` zu rufen.
  2. *Eingestellte APIs* `Window.get/setStatusBarColor`, `setNavigationBarColor`
     — aufgerufen aus `@capacitor/status-bar` (v8) und dem Material-Datepicker,
     nicht aus eigenem Code. Fix: Plugin-Update bzw. Status-Bar-Farbe nicht mehr
     setzen; vorher am Gerät (Malte) die Systemleiste prüfen.
  3. *Feste Ausrichtung:* `android:screenOrientation="portrait"` in
     `android/app/src/main/AndroidManifest.xml`; ab Android 16 ignoriert das
     System sie auf Tablets und Foldables. **Bewusst offen** (Simon,
     08.10.2026): Die Apps bleiben im Hochformat; eine Tablet-Fassung kommt,
     wenn überhaupt, über die Web-Version.
  4. *R8 schwach:* Optimierungsrate 48 %, Verschleierung 49 %, Ressourcen 49 %
     bei Bundle 134 (2.3.0), gebaut noch mit dem Android-Gradle-Plugin 8.13.1.
     Laut Console: 6,35 MB neu, 2,31 MB Update, Ziel-SDK 36, ab API 24,
     16-KB-Seitengröße unterstützt, DEX-Optimierung „Medium“, unkomprimierter
     DEX 4,13 MB. Erfüllt (grüner Haken): „Vollständiger Modus“ und
     „Entfernung von Ressourcen“. Nicht erfüllt: „Optimierte Entfernung von
     Ressourcen“ und „Klassen neu bündeln“ — beide gibt es erst mit AGP 9.
     **Im Repo erledigt (08.10.2026, #231):** AGP 9.2.1, Gradle 9.5.1; am
     unsignierten Release-Bau gemessen DEX 4,13 → 4,03 MB, Ressourcen 1,39 →
     1,02 MB, Klassen neu gebündelt (in Paketen 2.305 → 92). Offen: Maltes
     Gerätetest (versionCode 135) und der Haken in der Console nach dem
     Release, Auftrag [18](auftraege/lokaler-agent/18-agp9-android-2.4.0.md).
  Keins davon bricht die App heute; 2 und 3 werden mit Android 16 sichtbar.

## Bei Simon zu entscheiden

- **Status-Spalten der Web-Tabellen sortieren alphabetisch** (07.10.2026).
  *Was gemeint ist* (Simon fragte am 08.10.2026 nach): In den Tabellen der
  Web-Fassung lässt sich jede Spalte per Klick auf den Spaltenkopf sortieren.
  Bei einer Status-Spalte geschieht das heute nach dem angezeigten Wort, also
  „Abgelehnt – Offen – Verbucht" — nicht nach dem Ablauf. Frage: Soll eine
  Status-Spalte stattdessen in der fachlichen Reihenfolge sortieren, etwa
  Offen – Verbucht – Abgelehnt (Offenes zuerst)? So machen es heute schon
  Support (Gemeinden, Vorgänge) und Rückblick. Offen bis zu Simons Antwort.
- **Punkte-Verlauf im Profil und in der Konfi-Zeit sortiert nur, was sichtbar
  ist** (die ersten acht, bis „Alle anzeigen“). Auf der Personenseite der
  Leitung wird schon vor dem Kürzen sortiert; hier genauso?
- **Zeitspalten ohne Zeitzone.** 24 Spalten stehen auf `timestamp without
  time zone`, Produktion schreibt UTC; Stellen mit `CURRENT_DATE` nehmen
  zwischen 0 und 2 Uhr Berliner Zeit den Vortag. Ob sie sich eindeutig auf
  `timestamptz` umstellen lassen, hängt an einer Frage: Wurde seit der
  SQLite-Zeit je per `psql` in Berliner Zeit in diese Tabellen geschrieben
  (`notifications`, `refresh_tokens`, `users.deleted_at` …)? Danach eine
  Migration nach dem Muster von 138. Seit 27.09.2026 (Datenbank BF-11, Rest).
- **Offline: Detailseiten beim Besuch zwischenspeichern?** Ohne Netz zeigen
  Konfi-Termin, Leitungs-Termin und die Seite einer Person ehrlich einen
  Platzhalter (`OfflinePlatzhalter`, seit 01.09.2026). Offen ist, ob
  zusätzlich jede besuchte Detailseite ihre Antwort aufbewahrt, damit sie
  ohne Netz noch einmal aufgeht — ohne zusätzliche Anfragen. Seit 01.09.2026
  (interne Aufgabenliste).
- **Benutzernamen und Systemnamen.** Gleichzeitiges Anlegen desselben
  Benutzernamens schützt eine Sperre statt eines eindeutigen Index (kein
  Migrationsrisiko bei Altbestand-Dubletten); die Store-App 2.2.x setzt beim
  Speichern einer Gemeinde den Systemnamen weiter ohne Umlaute, eine
  Serverregel dagegen gibt es nicht. So lassen? (30.09.2026)
- **Meldungen der Sicherheitsregeln (CSP).** Ein Endpunkt, an den der Browser
  Verstöße meldet, existiert nicht; gewünscht? (29.09.2026)
- **Beschriftungen, Reiter und Filter an einer Stelle für App und
  Web-Fassung?** Laden, Rechte und Zähler teilen sich beide Fassungen; die
  Darstellung ist doppelt. Die Web-Fassung hat 130 Dateien mit rund 18.700
  Zeilen TSX und 6.700 Zeilen CSS neben rund 78.100 Zeilen
  App-Komponenten; an 54 Stellen wählt eine Weiche zwischen beiden
  (gezählt 06.10.2026). Ein neuer Filter oder ein umbenannter Reiter muss
  heute an zwei Stellen nachgezogen werden. Vorschlag: je Seite eine
  gemeinsame Beschreibung von Texten, Reitern und Filtern, aus der App und
  Web-Fassung lesen. Umsetzen?
- **Sprühangriff über viele Konten.** Die Kontosperre zählt je Konto (10
  Fehlversuche je Stunde); wer viele Konten mit je wenigen Versuchen
  durchprobiert, wird nur von der IP-Grenze gebremst (300 je 15 Minuten).
  Am 08.10.2026 geprüft, nichts geändert, weil beide Wege einen Preis haben:
  Eine engere IP-Grenze trifft Schulklassen, die hinter einer Adresse
  sitzen; eine globale Grenze für Fehlversuche wäre ein Hebel, alle
  auszusperren. Welcher Weg oder so lassen? Seit 27.09.2026 (Sicherheit
  BF-04, Rest).
- **Passwort-Reset-Mail auch in die Warteschlange?** Push, Postfach und die
  übrigen Mails nach der Antwort stehen seit 08.10.2026 als Auftrag in
  `nachlauf_auftraege`; die Mail zum Zurücksetzen des Passworts läuft
  bewusst weiter im Prozess. In der Warteschlange stünde der Reset-Token bis
  zum Versand im Klartext in der Datenbank; dafür verliert ein Neustart in
  diesem Moment heute die Mail. So lassen?
- **Soll `GET /api/status` hängende Nachlauf-Aufträge melden?** Ein
  additives Feld mit der Zahl fehlgeschlagener und lange offener Aufträge
  machte Störungen von außen sichtbar. Bisher gibt es nur die SQL-Abfrage in
  [betrieb/routinen.md](betrieb/routinen.md#nachlauf-warteschlange)
  (08.10.2026).
- **Ablage im Gesendet-Ordner dauerhaft machen?** Die Kopie einer Mail per
  IMAP in den Gesendet-Ordner läuft weiter im Prozess und geht bei einem
  Neustart verloren. Dauerhaft ginge es nur, wenn der Mailquelltext mit in
  die Tabelle `nachlauf_auftraege` käme (08.10.2026).
- **Nutzungsmessung.** Die Vorschläge S1–S17 in
  [messung/umami.md](messung/umami.md#vorschläge--simon-entscheidet) warten
  auf Simons Entscheidung.

## Geplant

- **Version 2.4.0** — Challenges als Seiten, Web-Version mit
  Support-Ansicht, Rollenfarben, Mehrfach-Konten (gebaut) und
  kleinere Punkte: [planung/2.4.0.md](planung/2.4.0.md).
- **Web-Version: was noch fehlt** — Leiste links, Support-Ansicht mit
  Vorgängen, Posteingang, Formularen und Support-Mail sowie die
  Browser-Ansichten aller Bereiche sind gebaut (03. bis 07.10.2026).
  Offen: die Gruppe „Verwaltung" in der Leiste, der Rückweg
  „ohne Gemeinde" nach einem Gemeindewechsel, weitere Kennzahlen,
  „Einwilligung liegt vor" am Konfi-Profil
  ([planung/web-version.md](planung/web-version.md), Abschnitt „Offen");
  Zuweisung von Vorgängen an einzelne Support-Konten und Bildschirmfotos im
  Support-Formular ([planung/support-vorgaenge.md](planung/support-vorgaenge.md));
  die Spalte „Letzte Aktivität" der Konfi-Tabelle im Browser bleibt
  ausgeblendet, bis `GET /admin/konfis` das Feld `letzte_aktivitaet`
  (additiv) liefert.
- **Feature-Empfehlungen** mit Simons Antworten vom 02.10.2026 —
  vor der EKD-Ausrollung Einwilligung (E-01, Vermerk am Konfi-Profil),
  Löschfristen (E-02), Selbstauskunft (E-21) und Hilfe und Support (E-04,
  E-18, E-20, in der Support-Ansicht); danach Vorlagenkatalog, Jahrgangsabschluss,
  Nachtruhe, Feature-Schalter ohne Chat, Statusseite, Ehrenamtsnachweis,
  Mehrjahresvergleich, Objektspeicher:
  [planung/feature-empfehlungen.md](planung/feature-empfehlungen.md).

## Zurückgestellt

- **Rechenschaft vor der EKD-Ausrollung.** Die Datenschutzerklärung sagt
  nichts zur Mitarbeit in mehreren Gemeinden (wer sieht was, wer stimmt zu);
  ein Verzeichnis der Verarbeitungstätigkeiten, TOM und AVV — oder ein
  Verweis, wo sie liegen — fehlen (Doku BF-08, Rest). Eine Datenauskunft nach
  DSG-EKD (Art. 15 DSGVO) gibt es nicht als Route; ob der Rückblick als
  Auskunft genügt, ist offen. Geplant als E-21 „Selbstauskunft"
  (Sicherheit, „Unklar: Auskunftsroute"). Simon, 08.10.2026: „machen wir
  später" — vor der Ausrollung wieder aufnehmen.
- **„Darf freigeben".** Ein Recht, Anträge zu entscheiden, Events zu
  verbuchen und Beiträge freizugeben, statt dass jede Leitung alles in die
  Zahl bekommt; sechs Fragen offen:
  [planung/darf-freigeben.md](planung/darf-freigeben.md). Simon, 08.10.2026:
  „machen wir viel später".
- **Tablets und Querformat.** Die Apps sind auf beiden Plattformen auf
  Hochformat gesperrt (Simon, 19.09.2026: „Will ich nicht auf phones"; UI
  BF-06). Simon, 08.10.2026: Die Apps bleiben so; eine Tablet-Fassung käme
  über die Web-Version. Das Handbuch nennt die Sperre nicht.
- **Upload aus Nextcloud auf Android.** PDF und Word gehen vom Android-Handy
  aus dem Download-Ordner und aus Google Drive (Build 133, Gerätetest
  02.10.2026), nicht aber über die Nextcloud-App. Vermutung, nicht gemessen:
  Die Nextcloud-App liefert einen Verweis auf ihren eigenen Anbieter und lädt
  erst beim Lesen; liegt die Datei nicht auf dem Gerät, scheitert schon die
  Auswahl. Die Fehlermessung zeigt das als `fehler` mit `ort`
  `dateiauswahl-…` (`frontend/src/services/uploadDiagnose.ts`). Ausweg für
  Nutzer:innen: die Datei in Nextcloud erst herunterladen. Simon, 02.10.2026:
  „nextcloud links auf android irgendwann vielleicht". Wieder aufnehmen, wenn
  sich weitere Gemeinden melden — dann zuerst diese Fehlermessung auswerten.
- **Kontrast im Hellmodus.** Bereichsfarben als Schrift erreichen im Hellen
  teils nur 2,15:1 (Badges), dazu weiße Symbole auf den Eck-Marken und die
  Kopfbanner der Event-Details. Simon, 29.09.2026: „Der Kontrast ist uns
  erstmal egal." Alle Textstellen hängen an den Tokens `--app-text-<bereich>`;
  ein hellerer Wert lässt sich je Bereich an einer Stelle setzen (UI BF-04,
  Rest). Gemessen 08.10.2026: 25 von 51 Text-Tokens mit festem Farbwert
  liegen auf Weiß unter 4,5:1 — deshalb keine Kontrast-Angabe bei Apple.
- **react-router 6.** Zwei moderate Meldungen (Open Redirect über Backslash,
  Constructor Injection bei SSR-Hydration) treffen die App nicht: kein SSR,
  Navigationsziele nur aus festen Pfaden mit eingesetzten Kennungen; Push-,
  App-Link- und Umleitungsziele laufen über `buildPushTargetUrl`,
  `deepLinkZiel` und `umleitungsZiel`. Ein Update ist nicht möglich,
  `@ionic/react-router` verlangt `react-router <7`. Auf GitHub am 01.10.2026
  als „tolerable risk" geschlossen. Wieder prüfen, sobald Ionic react-router 7
  zulässt oder ein Navigationsziel aus Nutzereingaben, API-Antworten oder
  Push-Daten gebaut wird.
- **Präfix-redundante Indizes.** 33 Einzelspalten-Indizes neben einem
  längeren hatten am 01.10.2026 keinen einzigen Zugriff — bei 169 Konten liest
  der Planer kleine Tabellen aber ohnehin ganz. Bei deutlich größerem Bestand
  `pg_stat_user_indexes.idx_scan` neu messen, dann entscheiden (Datenbank
  BF-09, Rest).
- **Fremdschlüssel `integer` statt `bigint`.** 55 Fremdschlüssel bleiben: Die
  Umstellung schriebe große Tabellen unter Sperre neu, ohne dass eine App
  oder Abfrage es merkt; neue Migrationen nehmen `BIGINT` (Wächter
  `migrationenKonventionen.test.js`). Wieder aufnehmen, falls ein Wert 2³¹
  nahekommt (Datenbank BF-12, Rest).
