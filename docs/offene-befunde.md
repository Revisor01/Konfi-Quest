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

- [ ] **Mehrfach-Konten abschließen** — Branch `feat/mehrfach-konten-abschluss`:
  Event-Chat nach der Gemeinde des Termins, Push mit Gemeinde zwingend,
  Urheber:innen und Detailansicht aus anderen Gemeinden, Stamm-Zeilen
  angleichen, Funktionsbezeichnung, „Teamer seit" und Sperre je Gemeinde
  (Sperre nur in der sperrenden Gemeinde), Löschen durch die Leitung beendet
  nur die eigene Mitgliedschaft, Sperre sofort auf beiden Replicas, Rolle
  und Gemeindeleitung aus der aktiven statt der Stamm-Gemeinde,
  Gemeinde-Rückfall im Frontend. Entscheidungen:
  [planung/mehrfach-konten.md](planung/mehrfach-konten.md#fragen-an-simon);
  Einträge unten unter [Code](#code).
- [ ] **Offene Backend-Fehler** — Branch `fix/offene-backend-fehler`:
  Bearbeiten-Knopf bei Super-Admin-Konten, Testlücke Super-Admin,
  Benutzername einer Gemeindeleitung, Punktart am Beleg,
  Wiederholungsschutz beim Anlegen, Mail nach „Passwort setzen",
  Sprühangriff prüfen, CodeQL #124, #127 und #128, das 500 an `mark-read`
  ([Code](#code)).
- [ ] **Mitteilungen nach der Antwort dauerhaft einreihen** — Branch
  `feat/nachantwort-warteschlange` ([Code](#code), „Mitteilungen nach der
  Antwort gehen bei einem Neustart verloren").
- [ ] **Zeitgeber aufräumen und Kleinigkeiten der Web-Fassung** — Branch
  `fix/zeitgeber-aufraeumen`: alle Zeitgeber mit Wächtertest, Zähler-Abruf
  entprellen, doppelte CSS-Klassen, Filterzeile der Challenges, `armv7`
  ([Code](#code), [Tests und CI](#tests-und-ci)).
- [ ] **Test-Backend abschaffen** — Branch `chore/test-backend-abschaffen`
  (Simon, 08.10.2026); zuerst prüfen, ob noch ein Build darauf zeigt
  ([Betrieb](#betrieb), „Test-Backend teilt Datenbank und Schlüssel mit
  Produktion").
- [ ] **CodeQL #138** — PR #233 (`fix/codeql-138-regex`), offen, nicht
  gemergt ([Code](#code), „CodeQL-Meldungen").

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

## Offen

### Code

- **Mitteilungen nach der Antwort gehen bei einem Neustart verloren.**
  `utils/nachAntwort.js` läuft im Backend-Prozess: Startet der Container in
  den Millisekunden nach der Antwort neu (Deploy, Absturz), fehlen Push und
  Postfach-Eintrag; die eigentliche Änderung (Punkte, Abzeichen) ist
  gespeichert. Betrifft seit 07.10.2026 auch die Entscheidung über gemeldete
  Aktivitäten (vorher abgewartet, 1,5 s in Produktion). Fix: dauerhafte
  Warteschlange in der Datenbank, die ein Hintergrunddienst abarbeitet.
  *In Arbeit: `feat/nachantwort-warteschlange`.*
- **Gleiche CSS-Klassen in zwei Bereichs-Stylesheets der Web-Fassung.**
  Alle Dateien unter `frontend/src/theme/web/` liegen im selben Bündel; setzen
  zwei Bereiche dieselbe Klasse, mischen sich die Regeln auf beiden Seiten. So
  waren die Fortschrittsbalken der Konfi-Liste nur ein flacher Streifen
  (behoben 06.10.2026). Noch doppelt: `web-beschreibung` (leitung/termine),
  `web-menue` (chat/termine), `web-rolle` und `web-rolle--leitung`
  (leitung/start). `web-stempel` ist behoben (07.10.2026). Ob die übrigen
  sichtbar falsch aussehen, ist nicht geprüft.
  Fix: je Bereich umbenennen; der Wächter
  `__tests__/components/webCssKlassen.test.ts` führt sie als bekannt und lässt
  keine neuen zu — wer eine behebt, streicht sie dort. Gefunden 06.10.2026.
  *In Arbeit: `fix/zeitgeber-aufraeumen`.*
- **Filterzeile der Challenges zweizeilig bis etwa 1400 px.** Auf der
  Challenge-Seite der Leitung rutschen Suche und Umschalter Liste/Kacheln
  unter die Zustands-Chips, solange das Fenster 1366 px oder schmaler ist
  (Zeile 86 statt 40 px hoch); ab 1440 px steht alles in einer Zeile.
  Gemessen 07.10.2026 bei 1100, 1280, 1366, 1440 und 1600 px gegen einen
  lokalen Server mit vier Challenges. Stelle:
  `components/shared/web/challenges/WebChallengeFilter.tsx`.
  *In Arbeit: `fix/zeitgeber-aufraeumen`.*
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
- **Bearbeiten-Knopf bei Super-Admin-Konten.** `GET /users` setzt `can_edit`
  allein nach der Rolle (`filterUsersByHierarchy`); bei einem Konto mit
  Super-Admin-Recht — Simons Konto in seiner Gemeinde, ein Support-Gast —
  steht `can_edit: true`, Bearbeiten, Entfernen und Passwort enden aber mit
  403 „Super-Admin-Konten kann nur ein Super-Admin bearbeiten." (Schutz seit
  26.09.2026, Sicherheit BF-01). Die App bietet also Knöpfe an, die nicht
  gehen. Fix: `can_edit` zusätzlich nach `istSuperAdminKonto`
  (`utils/roleHierarchy.js`), dafür `is_super_admin` in die Abfrage.
  Gefunden 03.10.2026. *In Arbeit: `fix/offene-backend-fehler`.*
- **Benutzername einer Gemeindeleitung ohne Zeichenregel.** `POST
  /organizations` (erste Gemeindeleitung), `POST /organizations/:id/admins`
  und `POST /support/anfragen/:id/anlegen` prüfen den Benutzernamen nur auf
  „nicht leer" und systemweit frei; Leerzeichen und Sonderzeichen gehen
  durch. Überall sonst gilt `commonValidations.username` (3 bis 50 Zeichen,
  Buchstaben, Ziffern, Punkt, Bindestrich), auch für Support-Konten. Fix:
  dieselbe Regel an den drei Stellen (für Bestandskonten folgenlos). Am Code
  gefunden 03.10.2026. *In Arbeit: `fix/offene-backend-fehler`.*
- **Mail nach „Passwort setzen" für Support-Konten.** `PUT
  /users/:id/reset-password` schickt einem Support-Konto „die Leitung deiner
  Gemeinde hat ein neues Passwort gesetzt"; `PUT
  /organizations/support-konten/:id/passwort` schickt deshalb gar keine Mail.
  Eine passende Vorlage fehlt. Gefunden 03.10.2026.
  *In Arbeit: `fix/offene-backend-fehler`.*
- **Challenge-Urheber:innen nur aus der Stamm-Gemeinde.** `GET
  /challenges/admin/authors` und die Urheber-Prüfung beim Anlegen und Ändern
  lesen nur `users.organization_id`; wer als Teamer:in in einer weiteren
  Gemeinde mitarbeitet, steht dort nicht zur Auswahl (gesetzt über die
  Kennung: 400). Seit 27.09.2026; Gruppenchats und Lizenz-Mail sind schon
  umgestellt. Punkt 3 in
  [planung/mehrfach-konten.md](planung/mehrfach-konten.md) (Chat BF-08,
  Rest). *In Arbeit: `feat/mehrfach-konten-abschluss`.*
- **Rolle aus der Stamm-Gemeinde in Termin-Teilnehmern und Chat-Nachrichten.**
  `GET /events/:id` (Teilnehmerliste, `backend/routes/events/lesen.js`) und
  `GET /chat/rooms/:roomId/messages` (`sender_role_name`) lesen die Rolle über
  `users.role_id`. Wer eine Gemeinde zusätzlich betreut, steht dort mit der
  Rolle der Stamm-Gemeinde: In der Teilnehmerliste hängen daran das Wort
  „Leitung", die Trennung Konfi/Team und die Zähler, in der Nachricht das
  Rollenwort hinter dem Namen. Die Chat-Mitgliederliste zieht die Rolle seit
  02.10.2026 je Gemeinde (Regel wie `ladeRolleInGemeinde`,
  `backend/utils/orgMitglieder.js`). Gefunden 02.10.2026 beim Nachstellen der
  Rollenfarben. *In Arbeit: `feat/mehrfach-konten-abschluss`.*
- **Gemeindeleitung beim Bearbeiten einer Gemeinde nur aus der
  Stamm-Gemeinde.** `GET /organizations/:id/admins` fragt
  `u.organization_id = $1`; wer die Gemeinde über `user_organizations` als
  Gemeindeleitung betreut, fehlt im Abschnitt „Gemeindeleitung" — in
  Produktion hat Organisation 2 ihre ganze Leitung nur dort (gemessen
  25.09.2026). Gefunden 02.10.2026.
  *In Arbeit: `feat/mehrfach-konten-abschluss`.*
- **Punktart steht nicht am Beleg.** Seit Migration 163 speichert
  `user_activities` den Punktwert zum Zeitpunkt der Vergabe, die Art
  (Gottesdienst/Gemeinde) aber nicht. Ändert die Leitung die Art einer
  Aktivität, landen Rücknahme, Detailliste und Historie in der anderen Säule
  (`konfi-management.js` liest `a.type`); die Summe stimmt, die Verteilung
  nicht. Seit 27.09.2026 (Punkte/Termine BF-02, Rest).
  *In Arbeit: `fix/offene-backend-fehler`.*
- **Sperre wirkt auf der zweiten Replica erst nach 30 s.** Deaktivieren und
  Löschen leeren den Rechte-Zwischenspeicher nur auf der Replica, die die
  Anfrage bearbeitet; die andere arbeitet bis zu 30 s mit dem alten Stand
  (`USER_CACHE_TTL` in `backend/middleware/rbac.js`). Ein gemeinsamer Merker
  (etwa über `token_invalidated_at`) fehlt. Seit 26.09.2026 (Sicherheit
  BF-10). *In Arbeit: `feat/mehrfach-konten-abschluss`.*
- **Sprühangriff über viele Konten.** Die Kontosperre zählt je Konto (10
  Fehlversuche je Stunde); wer viele Konten mit je wenigen Versuchen
  durchprobiert, wird nur von der IP-Grenze gebremst (300 je 15 Minuten).
  Seit 27.09.2026, „später" (Sicherheit BF-04, Rest).
  *In Arbeit (prüfen): `fix/offene-backend-fehler`.*
- **Testlücke Super-Admin-Konten.** `backend/tests/routes/users.test.js`
  prüft alle vier verbotenen Wege (Org-Leitung verwaltet ein Konto mit
  Super-Admin-Merkmal), aber den erlaubten Fall nur für Passwort und
  Bearbeiten; für Löschen und Jahrgangszuweisung durch einen Super-Admin fehlt
  er. Seit 27.09.2026 (Sicherheit BF-01, Testlücke).
  *In Arbeit: `fix/offene-backend-fehler`.*
- **Gemeinde-Rückfall lässt Rolle und Namen stehen.** Wird einer Person die
  aktive Gemeinde entzogen, wechselt die App per `auth:org-fallback`
  (`frontend/src/contexts/AppContext.tsx`) Token, Zwischenspeicher und Socket
  zur Stamm-Gemeinde, nicht aber Rolle und Gemeindenamen im Nutzer-Zustand —
  bis zum nächsten Start zeigt sie womöglich die Oberfläche der entzogenen
  Rolle. Seit 27.09.2026 (Grundgerüst BF-05, Nebenbefund).
  *In Arbeit: `feat/mehrfach-konten-abschluss`.*
- **Anlegen ohne Wiederholungsschutz.** POST und PATCH werden seit 26.09.2026
  nie automatisch wiederholt, Doppelbuchungen entstehen nicht mehr. Damit
  Bonuspunkte, Event- und Konfi-Anlage nach einem Netzabbruch sicher
  wiederholbar wären, bräuchten sie eine `client_id` nach dem Muster
  `backend/utils/antragIdempotenz.js` (Grundgerüst BF-02, Rest).
  *In Arbeit: `fix/offene-backend-fehler`.*
- **Laufzeiten im Hintergrund nicht sichtbar.** `/api/metrics/local` zeigt den
  Cron-Leader, aber nicht, wann welcher Job zuletzt lief und wie lange; auch
  die Dauer eines Push-Versands und des Zähler-Laufs steht in keiner
  Log-Zeile (01.10.2026: „nicht messbar ohne Code"). Seit 27.09.2026
  (Betrieb BF-10, Rest).
- **Zähler-Abruf nach jeder Nachricht (optional).** Jede `newMessage` löst im
  `BadgeContext` einen Abruf der Zähler aus; eine Entprellung wäre billiger.
  Seit 27.09.2026, optional (Betrieb BF-08, Rest).
  *In Arbeit: `fix/zeitgeber-aufraeumen`.*
- **Unerklärtes 500 an `mark-read`.** `POST /api/chat/rooms/*/mark-read`
  antwortete zwischen 28.09. und 01.10.2026 einmal mit 500 (bei 718 × 200);
  die Ursache ist nicht untersucht.
  *In Arbeit: `fix/offene-backend-fehler`.*
- **CodeQL-Meldungen.** Offen auf GitHub (abgefragt 08.10.2026):
  - #124 `js/missing-rate-limiting` an `GET /chat/files/:filename`
    (`backend/routes/chat.js`), seit 28.09.2026;
  - #127 `js/missing-rate-limiting` an `POST /challenges/konfi/:id/submissions`
    (`backend/routes/challenges.js`), seit 29.09.2026 — greift nicht
    (Upload-Limiter und globaler Limiter hängen in `backend/createApp.js`,
    nicht an der Route), am 29.09.2026 als „False positive" begründet, aber
    nicht geschlossen;
  - #128 `js/incomplete-multi-character-sanitization` in
    `frontend/src/__tests__/begriffeEinheitlich.test.ts`, seit 29.09.2026;
  - #138 `js/incomplete-sanitization` in
    `frontend/src/__tests__/config/androidGradlePlugin9.test.ts`, PR #233.

  *In Arbeit: #124, #127, #128 auf `fix/offene-backend-fehler`, #138 in PR
  #233.*

### Tests und CI

- **Zeitgeber, die das Schließen einer Seite überleben.** Ein `setTimeout`,
  das nach dem Schließen noch Zustand setzt, trifft in der CI das schon
  abgebaute Testfenster: alle Tests grün, der Lauf rot („window is not
  defined"). Zweimal am 06.10.2026 so aufgetreten und behoben (Anmeldeseite:
  Rütteln; Registrierung: Benutzernamen-Prüfung, Rütteln, Sprung zum
  Dashboard). Weitere Kandidaten ohne Aufräumen, nicht einzeln geprüft:
  `KonfiDetailView.tsx` (Passwort nach 300 ms), `QRScannerModal.tsx`,
  `WebNachricht.tsx` (Hervorhebung), `MessageBubble.tsx`. Fix je Stelle:
  Zeitgeber in einem Ref halten und beim Abbau löschen, mit Test wie in
  `konfiRegistrierung.test.tsx`. *In Arbeit: `fix/zeitgeber-aufraeumen`
  (alle Stellen samt Wächtertest).*
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
- **`armv7` in der Info.plist.** `UIRequiredDeviceCapabilities` nennt noch
  `armv7`; beim nächsten Umbau mit Xcode entfernen (CI BF-15, Rest).
  *In Arbeit: `fix/zeitgeber-aufraeumen`.*

### Betrieb

- **Test-Backend teilt Datenbank und Schlüssel mit Produktion.**
  `backend-test` (eigener Hostname, für TestFlight- und Testbuilds) hängt an
  der Produktionsdatenbank, an denselben Uploads und am selben `JWT_SECRET`
  (`deploy/compose.konfi_quest.yml`, Anker `backend_env`): Ungetesteter Code
  arbeitet mit echten Daten, und ein Token des einen Backends gilt beim
  anderen. Gefunden 02.10.2026. **Entschieden 08.10.2026** (Simon):
  abschaffen. Vorher prüfen, ob noch ein ausgelieferter oder Test-Build
  darauf zeigt. *In Arbeit: `chore/test-backend-abschaffen`.*
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
- **Nutzungsmessung.** Die Vorschläge S1–S17 in
  [messung/umami.md](messung/umami.md#vorschläge--simon-entscheidet) warten
  auf Simons Entscheidung.

## Geplant

- **Version 2.4.0** — Challenges als Seiten, Web-Version mit
  Support-Ansicht, Rollenfarben (gebaut), Mehrfach-Konten (in Arbeit) und
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
- **Mehrfach-Konten sauber** — Team-Rollen je Gemeinde für Einzelfälle, auch
  Admin in der einen und Teamer:in in der anderen Gemeinde; entschieden
  08.10.2026, in Arbeit: [planung/mehrfach-konten.md](planung/mehrfach-konten.md).
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
