# Offene Punkte nach den Paketen vom 28./29.09.2026

Simon, 28.09.2026: „1-4 machen den rest für später. Aber bewahren. Ist das sicher alles."

Diese Liste bewahrt, was nach den Paketen 1–4, F und G (29.09.2026) offen ist. Gezählt aus den
Status- und Nachtragszeilen aller 15 Bereichsberichte und des Audits „Wer bekommt was", **samt der
Abschnitte „Unklar" und „Nicht geprüft"** — die fehlten in der Zählung vom 27.09. Dazu kommen die
Nebenbefunde der Pakete vom 29.09. und die Messliste der Gesamtabnahme. Einzelheiten stehen je
Befund im verlinkten Bericht.

**Stand:** 55 Befunde offen (20 MITTEL, 35 NIEDRIG), kein KRITISCH, kein HOCH; 24 offene Punkte aus
„Unklar"/„Nicht geprüft"; 23 Feature-Empfehlungen; 12 Nebenbefunde vom 29.09. Die Pakete 5–8 hat
Simon auf später gelegt.

## Paket 5: Build, CI und Werkzeug

- BF-02: iOS-Deep-Links: `apple-app-site-association` ist ein Platzhalter und wird so ausgeliefert (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-04: Kein `concurrency`-Schutz — parallele Deploys können sich überholen (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-05: Jeder Push auf `main` erzeugt tagsüber eine Deploy-Lücke; „nachts unkritisch" stimmt nicht (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-06: Backend-Image läuft als root, enthält Dev-Abhängigkeiten, Tests, Schema-Dump und Compiler (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-07: Typprüfung und Web-Build laufen erst nach dem Merge — Build-Brüche erreichen `main` und stoppen still den Deploy (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-09: Versionsstände widersprechen sich; ein Store-Build ist nicht sicher einem Commit zuzuordnen (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-10: Notfall-Deploy wurde nie ausgeführt — der Rückrollweg ist ungeprobt (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-11: E2E-Job auf Node 20 (EOL) und Actions v4; Produktions-Image auf Node 26 (kein LTS) (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-13: `sitemap.xml` wird aus Datei-Änderungszeiten erzeugt — nicht reproduzierbar und vom Frischecheck nicht erfasst (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-14: Web-Frontend ohne CSP/Referrer-Policy/Permissions-Policy; veralteter `X-XSS-Protection` (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-15: Hygiene in Workflows und Deploy-Referenz (Sammelbefund) (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-16: Play-Upload veröffentlicht sofort zu 100 %; Track-Namen ungeprüft (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-17: `paths:`-Filter der CI lässt Wurzel-`package.json`/`package-lock.json` (E2E-Abhängigkeiten) aus (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- BF-02: Native App-Bundles enthalten 33 MB Handbuch-Screenshots und Swagger-UI (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-03: Backend-Image ist nicht aus dem Lockfile reproduzierbar (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-04: Node-Versionen: E2E-Job auf Node 20 (End-of-Life seit 30.04.2026), Produktion auf Node 26 (noch kein LTS) (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-05: Tageslosung hängt an `node-fetch`, das nur über eine optionale, transitive Kette installiert ist (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-06: Backend ohne Lint-Konfiguration — 96 Fehler mit Standardregeln, aber keine undefinierten Bezeichner (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-07: 267 Testdateien, `vite.config.ts` und `capacitor.config.ts` werden von keiner Typprüfung erfasst — 64 Typfehler d (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-09: Dependabot — 9 PRs offen seit dem 07.09., Ignore-Liste ohne TypeScript-Hauptversion (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-10: Abhängigkeits-Hygiene — undeklarierte Importe, tote Einträge, wirkungslose Overrides, bedeutungslose Versionsnumm (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-11: Startbündel lädt 1,39 MB Icon-Chunk (305 kB gzip) sofort; drei Build-Warnungen (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)
- BF-12: Zwei der als „harmlos" eingestuften Hook-Warnungen haben sichtbare Nebenwirkungen (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md)

## Paket 6: Datenbank und Betrieb

- BF-11: Log-Volumen bei Zielgröße überrollt die Aufbewahrung binnen Stunden (MITTEL) — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md)
- BF-05: Wiederherstellung aus der Sicherung ist nirgends beschrieben und scheitert auf einer frisch aufgesetzten Instanz (MITTEL) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-06: `konfi_profiles.password_plain` — eine Spalte für Klartext-Passwörter Minderjähriger existiert weiter und wird nu (MITTEL) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-08: Fünf von 89 Migrationen sind nicht idempotent — entgegen ihren eigenen Kommentaren (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-09: 42 redundante Indizes, davon 9 exakte Doppelgänger (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-10: `settings` hat keinen Primärschlüssel; mit `organization_id = NULL` sind Duplikate möglich (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-11: 24 Zeitspalten ohne Zeitzone, neue Migrationen legen weiter `TIMESTAMP` an, zwei `created_at` sind TEXT (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-12: Typmischung integer/bigint an 55 Fremdschlüsseln, zwei Sequenzen tragen alte Tabellennamen (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-15: Der Neuinstallations-Wächter vergleicht keine Indizes, Fremdschlüssel, UNIQUE, Defaults und NOT NULL (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- BF-17: Der Test-Dump ist fünf Wochen alt; ob Produktion heute dem Repo entspricht, ist aus dem Repo nicht belegbar (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)

## Paket 7: Tests

- BF-02: 46 % der Frontend-Tests prüfen Quelltext statt Verhalten (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-03: E2E-Datenbank startet mit leerem Migrationsstand — 51 Migrationen laufen doppelt, 2 scheitern bei jedem Start (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-04: 15 Backend-Routen ohne einen einzigen Test (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-09: E2E-Suite ist zu 85 % Smoke; der Punkte-Test prüft „irgendeine Ziffer“ (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-10: 49 Frontend-Komponenten ohne Bezug in irgendeinem Test — darunter Termin-Detail, Chat-Übersicht, Chat-Socket und  (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-11: Doku- und Kommentar-Drift in der Testinfrastruktur (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-12: Node-Versionen uneinheitlich — CI 26, Docker-Images 26, `engines` ≥ 22, lokal 22, E2E-Job 20 (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-13: E2E-Compose weicht von Produktion und Backend-Tests ab — Postgres 16 statt 15, keine Zeitzone, fehlende Schlüssel (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-14: Schema-Dump ist fünf Wochen alt, 36 Migrationen laufen obendrauf — kein definierter Auffrisch-Rhythmus (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-15: Frontend-Testlauf ohne feste Zeitzone, Tests mit echtem `new Date()` (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)
- BF-16: Backend ohne Lint (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md)

## Paket 8: Doku, Rechtstext, Oberfläche

- BF-13: Datenschutzerklärung beschreibt die Absturzdiagnose enger als der Code (NIEDRIG) — [app-grundgeruest](../2026-09-26/app-grundgeruest.md)
- BF-14: Listen ohne Virtualisierung — Renderzeit wächst linear (NIEDRIG) — [app-screens-leitung](../2026-09-26/app-screens-leitung.md)
- BF-15: Weg zum Anlegen einer neuen Gemeinde ist nirgends dokumentiert (NIEDRIG) — [app-screens-leitung](../2026-09-26/app-screens-leitung.md)
- BF-22: Absturzdiagnose ohne Einwilligungs- oder Abschaltmöglichkeit (NIEDRIG) — [backend-sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md)
- BF-10: Abzeichen-Kriterienfarben leben als 17 rohe Hexwerte außerhalb der Tokens (NIEDRIG) — [darkmode](../2026-09-26/darkmode.md)
- BF-12: Kein dunkler Bild- und Regressionspfad (NIEDRIG) — [darkmode](../2026-09-26/darkmode.md)
- BF-13: Sitemap-Erzeugung nicht reproduzierbar, von der CI nicht geprüft (NIEDRIG) — [dokumentation-gegen-code](../2026-09-26/dokumentation-gegen-code.md)
- BF-15: Code-Kommentare mit veralteten Zahlen und toten Dateiverweisen (NIEDRIG) — [dokumentation-gegen-code](../2026-09-26/dokumentation-gegen-code.md)
- BF-18: 27 unreferenzierte Bildschirmfotos werden mitgespiegelt und ausgeliefert (NIEDRIG) — [dokumentation-gegen-code](../2026-09-26/dokumentation-gegen-code.md)
- BF-04: Kontraste im Hellmodus unter AA — Grautöne 2,85–3,54:1 an 119 Stellen, Bereichsfarben als Text bis 2,15:1 (MITTEL) — [ui-barrierefreiheit](../2026-09-26/ui-barrierefreiheit.md)
- BF-09: Alle 42 Screenshots zeigen den Stand vor Glocke, Gemeinde-Umschalter und 2.3-Banner (MITTEL) — [ui-barrierefreiheit](../2026-09-26/ui-barrierefreiheit.md)

## Offene Punkte aus den Abschnitten „Unklar“ und „Nicht geprüft“

Meist Messungen in Produktion oder Fragen, die bei Simon liegen.

- Unklar: Cron-Leader in Produktion. Ob `backend2` tatsächlich `RUN_BACKGROUND_JOBS=false` trägt, steht nur im Stack; oh — [backend-fachlogik-chat-challenges-rueckblick](../2026-09-26/backend-fachlogik-chat-challenges-rueckblick.md)
- Unklar: Absage und Selbstabmeldung mit Verbuchung. `meldeAlleAbBeiAbsage` — [backend-fachlogik-punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md)
- Unklar: Check-in-Fenster endet nach dem Beginn. `checkin.js:84-90` prüft — [backend-fachlogik-punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md)
- Unklar: Serienfolge der Abzeichen (`streakCalculation.js:616-646`): endet an der — [backend-fachlogik-punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md)
- Unklar: Sammelverbuchung (`anwesenheit.js:48-184`) prüft weder `cancelled` noch — [backend-fachlogik-punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md)
- Unklar: Werden Chat-Nachrichtentexte im Push-Payload an FCM/APNs übertragen? `pushService.js:763/961` senden `notifica — [backend-sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md)
- Unklar: Zeigt `X-Real-IP` in Produktion wirklich die Client-IP? Die Limiter hängen daran (BF-05, BF-13). Nur mit Zugri — [backend-sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md)
- Unklar: Enthält `notifications.data` (JSONB) Namen anderer Personen, die nach deren Löschung stehen bleiben? Struktur  — [backend-sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md)
- Unklar: Existiert ein Datenexport (Art. 15 DSGVO)? Keine Route gefunden (`grep export\|Auskunft` in `konfi.js`/`auth.js — [backend-sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md)
- Unklar: Firebase-Zustellrate und -Latenz: Alle Push-Messungen liefen ohne Firebase (schneller — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md)
- Unklar: SMTP-Grenzen: `emailService.js` sendet ohne Warteschlange, Rate oder Pooling — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md)
- Unklar: `X-Real-IP` wird ungeprüft übernommen (`server.js:261–265`): Die IP-basierten — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md)
- Unklar: Speicherbedarf des Node-Prozesses bei 1.000+ Sockets (25 kB je Socket geschätzt → — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md)
- Unklar: Postgres-Speicher unter Last: `max_connections=200` × `work_mem` 4 MB ist nur bei — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md)
- Unklar: App-Icon mit Alphakanal. `Assets.xcassets/AppIcon.appiconset/kq.png` ist 1024×1024 RGBA — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- Unklar: `aps-environment = development` in `App.entitlements`. Xcode ersetzt den Wert beim Export mit — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- Unklar: `UIBackgroundModes: fetch`. `AppContext.tsx` nutzt `@capawesome/capacitor-background-task` — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- Unklar: `UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` = true. Der Documents-Ordner der App — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- Unklar: Test-Deadlocks in der CI. Zwei rote `backend-test`-Läufe (931, 938) zeigen `deadlock detected` — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- Unklar: Sicherheit der Firebase-Client-Schlüssel. `frontend/config/google-services.json` und — [ci-deployment-store](../2026-09-26/ci-deployment-store.md)
- Unklar: Produktionsschema heute: Der Dump ist vom 22.08.2026. Ob Produktion heute exakt — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- Unklar: Erst-Einrichtung einer neuen Instanz: Das Schema entsteht korrekt, aber — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- Unklar: Wirkung von 0,3 CPU: Alle Zeiten hier stammen von einer unbegrenzten CPU; der Faktor — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md)
- Nicht geprüft: Produktion: Kein Zugriff. Nachzumessen wären: Zahl der Admins mit Zuweisung auf einzelne Jahrgänge gegenü — [wer-bekommt-was](../2026-09-27/wer-bekommt-was.md)

## Feature-Empfehlungen (vor der EKD-Ausrollung)

- E-01: Rechtstexte, Einwilligung und Datenschutzhinweis in der App — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-02: Löschfrist auch ohne Konfirmationstermin greifen lassen — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-03: Gemeinden anlegen ohne Flaschenhals — Antragsweg, EKD-Vorgaben, zweiter Org-Admin — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-04: Hilfe und Support in der App — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-06: Ranking als Opt-in und ohne Klarnamen in der Antwort — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-09: Sprache und Barrierefreiheit der Web-Variante — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-10: Landeskirche und Kirchenkreis als Ebene über der Gemeinde, mit anonymen Kennzahlen — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-11: Vorlagenkatalog zwischen Gemeinden (Aktivitäten, Kategorien, Abzeichen, Challenges, Termine) — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-12: CSV-Import von Konfis mit Passwortliste — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-13: Kalender-Export (ICS) und Termin-Abo — auch als Elterninformation — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-14: Jahrgangsabschluss — Export für Urkunden und Archivierung — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-15: Nachricht melden und Konfi im Raum stummschalten — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-16: Nachtruhe für Push je Gemeinde — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-17: Feature-Schalter je Gemeinde — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-18: Fehler melden aus der App — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-19: Öffentliche Statusseite und Störungshinweis — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-20: Speicher- und Mengen-Kennzahlen je Gemeinde (Grundlage für das Kostenmodell) — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-21: Selbstauskunft — Datenexport für das eigene Konto — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-22: Material und Aufgaben für Konfis — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-23: Ehrenamtsnachweis für Teamer:innen als Dokument — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-24: Mehrjahresvergleich für die Leitung — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-25: Objektspeicher und Mandanten-Quoten — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)
- E-26: Delegierte Gemeindeverwaltung durch Kirchenkreise — [feature-empfehlungen](../2026-09-26/feature-empfehlungen.md)

## Nebenbefunde der Pakete vom 29.09.2026

Beim Arbeiten aufgefallen, nicht geändert (außerhalb des jeweiligen Pakets):

- **Gemeinde löschen** (`DELETE /organizations/:id`) nutzt die gemeinsame Kontolöschung
  (`utils/kontoLoeschen.js`) nicht: Konten der Gemeinde mit Anträgen in einer anderen Gemeinde
  können dort mit 500 abbrechen; ihre Dateien und Zweiergespräche in anderen Gemeinden bleiben liegen.
- **Teamer-Rückblick** (`routes/wrapped.js`, um Zeile 1697) zählt Badges ohne Filter auf
  `target_role` — also auch Konfi-Badges Beförderter.
- **`GET /teamer/profile`**: `profileQuery` filtert nicht auf die Gemeinde.
- **`sichereKonfiZeitBefoerderter`** prüft die Rolle nur an `users.role_id`, nicht je Gemeinde.
- **`GET /admin/konfis/:id/badges`** filtert nur auf `u.organization_id` (vermutlich 404 für
  Personen, die nur über eine weitere Gemeinde dazugehören).
- **Android: zwei FCM-Dienste** (`@capacitor/push-notifications` und
  `@capacitor-firebase/messaging`) melden je einen `MessagingService` an; Android stellt jede
  Nachricht nur einem zu. Möglicherweise feuert `pushNotificationReceived` in `AppContext` auf
  Android nie. Nicht geprüft.
- **Android-Zahl am App-Symbol** am Gerät prüfen (Samsung und Pixel), nach dem nächsten internen
  Testbuild.
- **Limiter:** `validate-invite`, `reset-password` und `refresh` haben keinen eigenen Limiter
  (Sicherheit, N3).
- **`POST /register-konfi`** verrät vergebene Namen mit 409 — nur mit gültigem Einladungscode und
  unter dem Registrierungs-Limiter; bewusst so gelassen.
- **`jahrgaenge.js`**: der unerreichbare 502-Zweig (Chat BF-11, Rest).
- **Tests:** `tests/routes/wrapped.test.js` stellt den Fremdschlüssel auf
  `challenge_submissions.approved_by` nach dem Test nicht wieder her.
- **Sperr-Texte** des Servers nennen weiter „Organisation" — gehört zum Begriffe-Durchgang
  „Gemeinde statt Organisation".

## Mehrfach-Konten (Gespräch mit Simon)

Simon, 28.09.: „Das mit den Multi Accounts müssen wir besprechen." Die übrigen Stellen der Tabelle
„Rolle je Gemeinde" (verschiedene Team-Rollen je Gemeinde) und acht Fragen stehen in
[mehrfach-konten.md](mehrfach-konten.md). Konfi und Team parallel ist seit dem 29.09. ausgeschlossen,
Teamer-Badges gelten je Gemeinde.

## Messen in Produktion und am Gerät

- Aufträge für den lokalen Agenten: [06 Mischkonten](../../auftraege/lokaler-agent/06-mischkonten.md),
  [07 Client-Adresse hinter dem Proxy](../../auftraege/lokaler-agent/07-client-adresse-hinter-dem-proxy.md),
  dazu die offenen Punkte aus [03 nach dem Deploy](../../auftraege/lokaler-agent/03-nach-dem-deploy.md).
- Die Messliste der [Gesamtabnahme](../2026-09-26/00-gesamtabnahme.md#auf-produktion-nachzumessen)
  und die Abschnitte „Auf Produktion nachzumessen" der Berichte.
- Aus den Paketen vom 29.09.: Jahrgänge mit Punkteziel 0, Teamer-Badges „Pflicht-Anwesenheit" im
  Bestand (Abfragen in den Nachträgen der Berichte).
- Am Gerät: Funkloch (Flugmodus), VoiceOver/TalkBack, Schrift „Größt", Dunkelmodus, Kaltstart,
  Android-Symbol und -Zahl, Biometrie-Rotation vor der Rückkehr des Schalters.

## Bei Simon

- Git-Tag `2.3.0`, sobald 2.3.0 in den Store geht; Store-Texte 2.3.0 (CI BF-08).
- `RUN_BACKGROUND_JOBS=false` bei `backend2` entfernen, `backend-test` auf `test-latest` stellen.
- Screenshots neu ziehen (erst nach dem Deploy), Umami bereinigen.
- `datenschutz.html` 4.3 (Geräte-Kennung), Absturzdiagnose, Chat-Texte im Push.
- Universal Links (`apple-app-site-association`), App-Icon mit Alphakanal, `aps-environment`,
  Firebase-Schlüssel.

