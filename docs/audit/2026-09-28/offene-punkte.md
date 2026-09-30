# Offene Punkte nach den Paketen vom 28./29.09.2026

Simon, 28.09.2026: „1-4 machen den rest für später. Aber bewahren. Ist das sicher alles."

Simon, 29.09.2026: „Schnüre ein größeres Paket. Ich möchte möglichst alle Befunde schließen bevor wir
an die Features gehen. Auch die App Größe finde ich extrem wichtig anzugehen. [...] Der Kontrast ist
uns erstmal egal."

Diese Liste bewahrte, was nach den Paketen 1–4, F und G offen war — gezählt aus den Status- und
Nachtragszeilen aller 15 Bereichsberichte und des Audits „Wer bekommt was", samt der Abschnitte
„Unklar" und „Nicht geprüft", den Nebenbefunden der Pakete und der Messliste der Gesamtabnahme. Am
29.09. hat das Großpaket (Pakete A–I) die Pakete 5–8 abgearbeitet. Jeder Eintrag trägt jetzt hinter
dem Pfeil seinen Stand; Einzelheiten, Messwerte und Tests stehen in der Status-Zeile des Befunds im
verlinkten Bericht.

Simon, 30.09.2026, nach dem Merge der Aufträge: „Gibt es irgendwas das du erledigen könntest." — Paket
J (Code-Nachzügler, Tests, Dependabot, Notfall-Probelauf); Ergebnis unten unter „Paket J".

## Stand 29.09.2026, abends

| | Anzahl | behoben | teilweise | offen |
|---|---|---|---|---|
| Befunde (20 MITTEL, 35 NIEDRIG) | 55 | 44 | 8 | 3 |
| Punkte aus „Unklar"/„Nicht geprüft" | 24 | 12 | 1 | 11 (Messungen, Simon, Feature) |
| Nebenbefunde der Pakete vom 29.09. | 12 | 10 | — | 1 am Gerät, 1 bewusst so |
| Feature-Empfehlungen | 23 | — | — | 23 (als Nächstes) |

**Was offen bleibt, und warum:**

- **Drei Befunde:** die Deploy-Lücke (CI BF-05, Ursache belegt, braucht den Server — Auftrag 10),
  die Screenshots (UI BF-09, erst nach dem Deploy — Auftrag 08) und der Kontrast im Hellmodus
  (UI BF-04, von Simon zurückgestellt).
- **Acht teilweise:** Der Rest ist jeweils begründet und steht am Befund — root im Container
  (Auftrag 09), erster echter Notfall-Deploy (Auftrag 05), `password_plain` entfernen (Frage an
  Simon), 33 Präfix-Indizes und 24 Zeitspalten (erst nach Messung in Produktion, Auftrag 11), 55
  Fremdschlüssel (bleiben begründet), 150 Quelltext-Tests und 12 Komponenten ohne Test (Leitplanke
  verhindert neue). *Stand 30.09.:* 117 Quelltext-Tests, 0 Komponenten ohne Test (Paket J); der
  Notfall-Deploy ist geprobt (Probelauf grün), der echte Lauf steht aus.
- **Messungen in Produktion und am Gerät** (Abschnitt unten) und die **Fragen an Simon**
  (Abschnitt „Bei Simon").

## Paket 5: Build, CI und Werkzeug

- BF-02: iOS-Deep-Links: `apple-app-site-association` ist ein Platzhalter und wird so ausgeliefert (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** (die Datei); Universal Links einschalten liegt bei Simon
- BF-04: Kein `concurrency`-Schutz — parallele Deploys können sich überholen (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.**
- BF-05: Jeder Push auf `main` erzeugt tagsüber eine Deploy-Lücke; „nachts unkritisch" stimmt nicht (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **offen** — Ursache belegt: Portainer erstellt bei jedem Deploy alle Dienste neu; Messung und Umbau im Auftrag 10
- BF-06: Backend-Image läuft als root, enthält Dev-Abhängigkeiten, Tests, Schema-Dump und Compiler (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **teilweise** — Image aus dem Lockfile, ohne Dev-Pakete, Tests und Compiler (1,92 GB → 486 MB); der Prozess läuft weiter als root (Auftrag 09)
- BF-07: Typprüfung und Web-Build laufen erst nach dem Merge — Build-Brüche erreichen `main` und stoppen still den Deploy (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** — ein roter `main` öffnet ein GitHub-Issue
- BF-09: Versionsstände widersprechen sich; ein Store-Build ist nicht sicher einem Commit zuzuordnen (MITTEL) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** — Versionen aus einer Quelle, Git-Tag je Store-Upload
- BF-10: Notfall-Deploy wurde nie ausgeführt — der Rückrollweg ist ungeprobt (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **teilweise** — rollt wie der CI-Deploy und hat einen Probelauf; der erste echte Lauf liegt beim Betrieb (Auftrag 05). *30.09.:* Probelauf auf GitHub grün (Rückrollweg auf `67c03dc`, nichts geändert); leerer Tag brach sicher ab und nimmt jetzt den jüngsten Stand mit Images (`0edb010f`)
- BF-11: E2E-Job auf Node 20 (EOL) und Actions v4; Produktions-Image auf Node 26 (kein LTS) (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** — eine Node-Linie (24) aus `.nvmrc`
- BF-13: `sitemap.xml` wird aus Datei-Änderungszeiten erzeugt — nicht reproduzierbar und vom Frischecheck nicht erfasst (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.**
- BF-14: Web-Frontend ohne CSP/Referrer-Policy/Permissions-Policy; veralteter `X-XSS-Protection` (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** — CSP scharf
- BF-15: Hygiene in Workflows und Deploy-Referenz (Sammelbefund) (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.**; `armv7` in der Info.plist bewusst erst beim nächsten Umbau mit Xcode
- BF-16: Play-Upload veröffentlicht sofort zu 100 %; Track-Namen ungeprüft (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** — gestaffelt, Vorgabe 10 %
- BF-17: `paths:`-Filter der CI lässt Wurzel-`package.json`/`package-lock.json` (E2E-Abhängigkeiten) aus (NIEDRIG) — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.**
- BF-02: Native App-Bundles enthalten 33 MB Handbuch-Screenshots und Swagger-UI (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.** — Web-Inhalt der App 45,7 → 9,2 MB, Android-Paket 41,2 → 9,2 MB (versionCode 129), iPhone-Paket 41,2 → 9,2 MB (Build 235), beide gemessen
- BF-03: Backend-Image ist nicht aus dem Lockfile reproduzierbar (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.**
- BF-04: Node-Versionen: E2E-Job auf Node 20 (End-of-Life seit 30.04.2026), Produktion auf Node 26 (noch kein LTS) (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.**
- BF-05: Tageslosung hängt an `node-fetch`, das nur über eine optionale, transitive Kette installiert ist (MITTEL) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.** — eingebautes `fetch`
- BF-06: Backend ohne Lint-Konfiguration — 96 Fehler mit Standardregeln, aber keine undefinierten Bezeichner (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.**
- BF-07: 267 Testdateien, `vite.config.ts` und `capacitor.config.ts` werden von keiner Typprüfung erfasst — 64 Typfehler d (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.** — eigener CI-Schritt
- BF-09: Dependabot — 9 PRs offen seit dem 07.09., Ignore-Liste ohne TypeScript-Hauptversion (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.**
- BF-10: Abhängigkeits-Hygiene — undeklarierte Importe, tote Einträge, wirkungslose Overrides, bedeutungslose Versionsnumm (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.**
- BF-11: Startbündel lädt 1,39 MB Icon-Chunk (305 kB gzip) sofort; drei Build-Warnungen (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.**, soweit ohne Risiko
- BF-12: Zwei der als „harmlos" eingestuften Hook-Warnungen haben sichtbare Nebenwirkungen (NIEDRIG) — [toolchain-abhaengigkeiten](../2026-09-26/toolchain-abhaengigkeiten.md) → **behoben 29.09.**

## Paket 6: Datenbank und Betrieb

- BF-11: Log-Volumen bei Zielgröße überrollt die Aufbewahrung binnen Stunden (MITTEL) — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md) → **behoben 29.09.** (Menge je Vorgang); Rotation und strukturierte Zeilen beim Betrieb
- BF-05: Wiederherstellung aus der Sicherung ist nirgends beschrieben und scheitert auf einer frisch aufgesetzten Instanz (MITTEL) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **behoben 29.09.** im Repo; Rhythmus, zweiter Ort und die Probe mit einem echten Dump beim Betrieb (Auftrag 11)
- BF-06: `konfi_profiles.password_plain` — eine Spalte für Klartext-Passwörter Minderjähriger existiert weiter und wird nu (MITTEL) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **teilweise** — kein Code liest oder schreibt die Spalte, in Produktion 0 Werte; die Spalte selbst entfernen (Frage an Simon)
- BF-08: Fünf von 89 Migrationen sind nicht idempotent — entgegen ihren eigenen Kommentaren (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **behoben 29.09.**
- BF-09: 42 redundante Indizes, davon 9 exakte Doppelgänger (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **teilweise** — die 9 Doppelgänger sind weg; die 33 präfix-redundanten erst nach `idx_scan` aus Produktion (Auftrag 11)
- BF-10: `settings` hat keinen Primärschlüssel; mit `organization_id = NULL` sind Duplikate möglich (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **behoben 29.09.**
- BF-11: 24 Zeitspalten ohne Zeitzone, neue Migrationen legen weiter `TIMESTAMP` an, zwei `created_at` sind TEXT (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **teilweise** — die beiden TEXT-Spalten sind `timestamptz`, neue Migrationen nur noch mit Zone; die 24 Altspalten erst, wenn die Herkunft der Altzeilen geklärt ist (Auftrag 11)
- BF-12: Typmischung integer/bigint an 55 Fremdschlüsseln, zwei Sequenzen tragen alte Tabellennamen (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **teilweise** — Sequenzen umbenannt, neue Migrationen nur noch passend; die 55 Fremdschlüssel bleiben begründet (Umbau schriebe große Tabellen unter Sperre neu, ohne Nutzen)
- BF-15: Der Neuinstallations-Wächter vergleicht keine Indizes, Fremdschlüssel, UNIQUE, Defaults und NOT NULL (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **behoben 29.09.**
- BF-17: Der Test-Dump ist fünf Wochen alt; ob Produktion heute dem Repo entspricht, ist aus dem Repo nicht belegbar (NIEDRIG) — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **behoben 29.09.** im Repo (Dump reproduzierbar fortgeschrieben); der Abgleich mit Produktion beim Betrieb (Auftrag 11)

## Paket 7: Tests

- BF-02: 46 % der Frontend-Tests prüfen Quelltext statt Verhalten (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **teilweise** — 42,4 → 38,7 % der Dateien, die riskanten zuerst; eine Leitplanke lässt keine neuen zu. *30.09.:* weitere 33 umgestellt, Leitplanke 150 → 117 (28,2 % der Dateien); die 41 verbliebenen mit Verhaltensversprechen stehen mit Grund im Bericht
- BF-03: E2E-Datenbank startet mit leerem Migrationsstand — 51 Migrationen laufen doppelt, 2 scheitern bei jedem Start (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-04: 15 Backend-Routen ohne einen einzigen Test (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-09: E2E-Suite ist zu 85 % Smoke; der Punkte-Test prüft „irgendeine Ziffer“ (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-10: 49 Frontend-Komponenten ohne Bezug in irgendeinem Test — darunter Termin-Detail, Chat-Übersicht, Chat-Socket und  (MITTEL) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **teilweise** — 49 → 12 Komponenten ohne Test. *30.09.:* 0 von 243 Komponenten ohne Test (die zehn übrigen gerendert, je mit Gegenprobe); offen bleiben 3 Utils, 1 Hook, 1 Service
- BF-11: Doku- und Kommentar-Drift in der Testinfrastruktur (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-12: Node-Versionen uneinheitlich — CI 26, Docker-Images 26, `engines` ≥ 22, lokal 22, E2E-Job 20 (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-13: E2E-Compose weicht von Produktion und Backend-Tests ab — Postgres 16 statt 15, keine Zeitzone, fehlende Schlüssel (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-14: Schema-Dump ist fünf Wochen alt, 36 Migrationen laufen obendrauf — kein definierter Auffrisch-Rhythmus (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-15: Frontend-Testlauf ohne feste Zeitzone, Tests mit echtem `new Date()` (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**
- BF-16: Backend ohne Lint (NIEDRIG) — [tests-testinfrastruktur](../2026-09-26/tests-testinfrastruktur.md) → **behoben 29.09.**

## Paket 8: Doku, Rechtstext, Oberfläche

- BF-13: Datenschutzerklärung beschreibt die Absturzdiagnose enger als der Code (NIEDRIG) — [app-grundgeruest](../2026-09-26/app-grundgeruest.md) → **behoben 29.09.**
- BF-14: Listen ohne Virtualisierung — Renderzeit wächst linear (NIEDRIG) — [app-screens-leitung](../2026-09-26/app-screens-leitung.md) → **behoben 29.09.**
- BF-15: Weg zum Anlegen einer neuen Gemeinde ist nirgends dokumentiert (NIEDRIG) — [app-screens-leitung](../2026-09-26/app-screens-leitung.md) → **behoben 29.09.** — Handbuch „Eine neue Gemeinde einrichten"
- BF-22: Absturzdiagnose ohne Einwilligungs- oder Abschaltmöglichkeit (NIEDRIG) — [backend-sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md) → **behoben 29.09.** — Schalter im Profil (Simon: „An, abschaltbar")
- BF-10: Abzeichen-Kriterienfarben leben als 17 rohe Hexwerte außerhalb der Tokens (NIEDRIG) — [darkmode](../2026-09-26/darkmode.md) → **behoben 29.09.** — Tokens
- BF-12: Kein dunkler Bild- und Regressionspfad (NIEDRIG) — [darkmode](../2026-09-26/darkmode.md) → **behoben 29.09.**
- BF-13: Sitemap-Erzeugung nicht reproduzierbar, von der CI nicht geprüft (NIEDRIG) — [dokumentation-gegen-code](../2026-09-26/dokumentation-gegen-code.md) → **behoben 29.09.**
- BF-15: Code-Kommentare mit veralteten Zahlen und toten Dateiverweisen (NIEDRIG) — [dokumentation-gegen-code](../2026-09-26/dokumentation-gegen-code.md) → **behoben 29.09.**
- BF-18: 27 unreferenzierte Bildschirmfotos werden mitgespiegelt und ausgeliefert (NIEDRIG) — [dokumentation-gegen-code](../2026-09-26/dokumentation-gegen-code.md) → **behoben 29.09.**
- BF-04: Kontraste im Hellmodus unter AA — Grautöne 2,85–3,54:1 an 119 Stellen, Bereichsfarben als Text bis 2,15:1 (MITTEL) — [ui-barrierefreiheit](../2026-09-26/ui-barrierefreiheit.md) → **zurückgestellt** (Simon, 29.09.: „Der Kontrast ist uns erstmal egal.")
- BF-09: Alle 42 Screenshots zeigen den Stand vor Glocke, Gemeinde-Umschalter und 2.3-Banner (MITTEL) — [ui-barrierefreiheit](../2026-09-26/ui-barrierefreiheit.md) → **offen** — erst nach dem Deploy ziehen (Auftrag 08)

## Offene Punkte aus den Abschnitten „Unklar“ und „Nicht geprüft“

Meist Messungen in Produktion oder Fragen, die bei Simon liegen. Stand hinter dem Pfeil.

- Cron-Leader in Produktion — [chat-challenges-rueckblick](../2026-09-26/backend-fachlogik-chat-challenges-rueckblick.md) → **kein Befund mehr:** `RUN_BACKGROUND_JOBS` entscheidet nur, ob sich eine Replica bewirbt; die Jobs startet allein der Leader.
- Absage und Selbstabmeldung mit Verbuchung (`meldeAlleAbBeiAbsage`) — [punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md) → **behoben 29.09.** nach Simons Entscheidung („Auch sie wird entschuldigt"): Bei der Absage gilt auch eine abgemeldete Konfi als entschuldigt.
- Check-in-Fenster endet nach dem Beginn — [punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md) → **kein Befund mehr:** gewollt, im Handbuch beschrieben.
- Serienfolge der Abzeichen — [punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md) → **behoben 29.09.** nach Simons Entscheidung („Fortschritt ehrlich zeigen").
- Sammelverbuchung prüft weder `cancelled` noch … — [punkte-termine](../2026-09-26/backend-fachlogik-punkte-termine.md) → **kein Befund mehr:** am Code geklärt, die Sammelverbuchung erreicht abgesagte Buchungen nicht.
- Chat-Texte im Push an Firebase und Apple — [sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md) → **behoben 29.09.** nach Simons Entscheidung („Absender, ohne Inhalt"); Datenschutzerklärung nachgezogen.
- `X-Real-IP` in Produktion (zweimal gemeldet: Sicherheit und Betrieb) — [sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md), [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md) → **offen bis zur Messung:** im Code geschlossen, ob der Proxy den Header setzt, misst Auftrag 07.
- Namen anderer Personen in `notifications.data` — [sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md) → **behoben 29.09. bis auf den Altbestand** (Einträge vor dem 27.09.2026 ohne Kennung; spätestens am 27.09.2027 durch die Frist weg — Frage an Simon, ob früher).
- Datenexport nach Art. 15 DSGVO — [sicherheit-datenschutz](../2026-09-26/backend-sicherheit-datenschutz.md) → **offen:** Feature E-21 „Selbstauskunft".
- Firebase-Zustellrate und -Latenz — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md) → **offen:** nach dem Deploy messen.
- SMTP-Grenzen — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md) → **im Code behoben 29.09.** (Massenversand gepoolt und gedrosselt, Vorgabe 20 Mails je Minute); die Grenze des Anbieters erfragt der Betrieb (Auftrag 11).
- Speicherbedarf bei 1.000+ Sockets — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md) → **offen:** Lasttest vor der EKD-Ausrollung.
- Postgres-Speicher unter Last — [betrieb-skalierung](../2026-09-26/betrieb-skalierung.md) → **offen:** nach dem Deploy messen.
- App-Icon mit Alphakanal — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.**
- `aps-environment = development` — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** (eigene Release-Entitlements); am nächsten IPA gegenprüfen.
- `UIBackgroundModes: fetch` — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.**
- `UIFileSharingEnabled` und `LSSupportsOpeningDocumentsInPlace` — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** (Documents-Ordner nicht mehr sichtbar).
- Test-Deadlocks in der CI — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **behoben 29.09.** (Ursache war `closePool`, nicht der Deadlock).
- Sicherheit der Firebase-Client-Schlüssel — [ci-deployment-store](../2026-09-26/ci-deployment-store.md) → **bei Simon:** Einschränkungen in der Google-Cloud-Konsole prüfen.
- Produktionsschema heute — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **Messweg bereit** (`schemaVergleich.js`), Messung beim Betrieb (Auftrag 11).
- Erst-Einrichtung einer neuen Instanz — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **behoben 29.09.** (von Null durchgespielt, drei Lücken geschlossen).
- Wirkung von 0,3 CPU — [datenbank-migrationen](../2026-09-26/datenbank-migrationen.md) → **beim Betrieb** (Auftrag 03).
- Nicht geprüft: die vier Zählungen in Produktion — [wer-bekommt-was](../2026-09-27/wer-bekommt-was.md) → **offen:** nach dem Deploy messen.

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

Beim Arbeiten an den Paketen 1–4, F und G aufgefallen und damals außerhalb des Pakets. Stand hinter
dem Pfeil (Commit in Klammern).

- **Gemeinde löschen** (`DELETE /organizations/:id`) nutzte die gemeinsame Kontolöschung nicht:
  Konten mit Anträgen in einer anderen Gemeinde konnten dort mit 500 abbrechen, Dateien und
  Zweiergespräche in anderen Gemeinden blieben liegen. → **behoben 29.09.** (`f6ab3278`; die
  Vorschau nennt, was mit den Konten geschieht, `a8f3f304`)
- **Teamer-Rückblick** zählte Badges ohne Filter auf `target_role`, also auch Konfi-Badges
  Beförderter. → **behoben 29.09.** (`bb98d665`)
- **`GET /teamer/profile`** filterte die Konfi-Zeit nicht auf die Gemeinde. → **behoben 29.09.**
  (`bb91d42f`)
- **`sichereKonfiZeitBefoerderter`** prüfte die Rolle nur an `users.role_id`. → **behoben 29.09.**
  mit den drei übrigen Stellen der Jahrgangslöschung (`6db134c4`)
- **`GET /admin/konfis/:id/badges`** las nur `u.organization_id`. → **behoben 29.09.**, beide Quellen
  der Zugehörigkeit (`7c7fc414`)
- **Android: zwei FCM-Dienste.** → **behoben 29.09.:** ein eigener Dienst für alle Nachrichten, auch
  bei offener App (`6d734d4d`, `4ebec8d8`)
- **Android-Zahl am App-Symbol** → gebaut wie auf iOS (Simon: „Zahl wie iOS"), bei 0 räumt die App
  auf Samsung und Xiaomi die Sammel-Mitteilung weg (`448a9d6f`). **Offen:** Prüfung am Gerät (Sony
  Xperia 1 VI) mit dem nächsten internen Testbuild.
- **Limiter** für `validate-invite`, `reset-password` und `refresh`. → **behoben 29.09.**
  (`1ae939c5`)
- **`POST /register-konfi`** verrät vergebene Namen mit 409 — nur mit gültigem Einladungscode und
  unter dem Registrierungs-Limiter. → **bewusst so gelassen**
- **`jahrgaenge.js`**: der unerreichbare 502-Zweig. → **entfernt 29.09.** (`9084488d`)
- **Tests:** `wrapped.test.js` stellte Fremdschlüssel und Spaltenkommentare nicht wieder her. →
  **behoben 29.09.** (`e5aa7071`, `207c07ea`)
- **Sperr-Texte** nannten „Organisation". → **behoben 29.09.** — Server-Meldungen, Mails, App und
  Handbuch sagen „Gemeinde"; einzige Ausnahme der 403 „Kein Zugriff auf diese Organisation", den
  die Store-Apps 2.2.0/2.3.0 wörtlich vergleichen. Test `begriffeEinheitlich.test.ts`.

### Nachzügler aus dem Großpaket und aus Simons Gerätetest (Xperia, Build 128)

- **Word-Datei (.docx) im Chat** ließ sich nicht senden. → **behoben 29.09.**
- **Dateiauswahl und Links** lösten beim Zurückkehren die Biometrie-Sperre aus. → **behoben
  29.09.** (alle Dateiauswahlen und alle externen Links über eine Stelle, je mit Wächter-Test)
- **Mitteilungssymbol auf Android** war ein graues Quadrat. → **behoben 29.09.** (eigenes
  Symbol aus der Lutherrose)
- **Titel der Konfi-Liste** auf Android gekürzt. → **behoben 29.09.** (`171858d1`)
- **Refresh-Tokens aufräumen** lief erst nach einem vollen Intervall. → **behoben 29.09.**
  (`ab81b289`, beim Start und auf dem Leader)
- **Abgesagte Events** zählen als offene Buchungen nur Konfis. → **bewusst so** (Simon: „Nur Konfis,
  wie heute")
- **FCM-Grenze von 4 KB** gegen 4.000 Zeichen Chat-Text. → **entfallen:** Mitteilungen tragen keinen
  Inhalt mehr.
- **Gemeinde anlegen** (`POST /organizations`) ohne Transaktion, Benutzername der Gemeindeleitung
  nicht systemweit geprüft, Systemname verlor Umlaute. → **behoben 29.09.** (`e2750c96`)
- **Eigene Stamm-Gemeinde** ließ sich vom Super-Admin löschen, das Konto war danach weg. →
  **behoben 29.09.:** 409, solange das Konto nur dort ist (`6c010347`)
- **Transaktions-Verbindung während Chat und Push** gehalten (Zusage, Event anlegen); drei Routen
  meldeten nach der Kontolöschung vor der Antwort. → **behoben 29.09.** (`45d3f5e6`, `9ab00f6f`)
- **pg-Warnung** „client.query() while already executing": bis zu sechs gleichzeitige Abfragen auf
  dem Client einer Transaktion. → **behoben 29.09.** (`88b037a9`)
- **Kleinere Reste:** Rechte-Zwischenspeicher im Rückblick-Test, `ensureOrgColumn` (Laufzeit-DDL,
  hätte den Primärschlüssel aus Migration 174 abgerissen), API-Doku zum Material-Upload. →
  **behoben 29.09.**
- **nodemailer 10** (Simon: „Ja, jetzt übernehmen"). → **übernommen 29.09.** (`132afaaf`; `npm
  audit` im Backend danach 0)

### Neue Nebenbefunde aus dem Großpaket — alle behoben 30.09. (Paket J)

- Weitere Hilfsfunktionen mit Parameter `db` bündeln Abfragen per `Promise.all`
  (`terminLeitungSicht`, `antragLeitungSicht`, `jahrgangLeitungSicht`, `orgMitglieder`,
  `appIconBadge`, `punkteHistorie`, `abzeichenKandidaten`, zwei Stellen im `pushService`). Heute
  ruft sie niemand mit dem Client einer Transaktion; täte es jemand, käme dieselbe pg-Warnung.
  → **behoben 30.09.** (`437e28d4`, dazu `konfiBadgeProgress`/`teamerBadgeProgress`; 12 Tests mit
  einem Client, der bei einer zweiten offenen Abfrage wirft)
- Die Ausfüllhilfe der App (`generateSystemName`) verliert weiter Umlaute; der Server fängt das beim
  Anlegen ab. Schriebe die App künftig selbst um, benennte `PUT` bestehende Gemeinden um.
  → **behoben 30.09.** (`eb733c55`): dieselbe Umschrift wie der Server; beim Bearbeiten bleibt der
  gespeicherte Systemname, solange der Anzeigename gleich bleibt
- `POST /users`, `/:id/admins` und `/organizations` prüfen den Benutzernamen ohne Sperre — zwei
  gleichzeitige Anlagen mit demselben Namen kämen durch. → **behoben 30.09.** (`6b34776f`):
  gemessen kamen sie durch (201/201 über Gemeinden und Schreibweisen hinweg); jetzt eine Sperre je
  Namen, die zweite Anlage bekommt 409
- `verwaltung-auth.yaml`, `POST /organizations`: `admin_password` „nur min 6 Zeichen" (die
  Passwort-Regel gilt seit 22.08.), die Zusammenfassung nennt veraltete Zahlen zum Startbestand.
  → **behoben 30.09.** (`432b08fb`, `07242a73`)

## Paket J (30.09.2026)

Vier Stränge, drei davon als Agenten parallel; alles in einem PR. Einzelheiten mit Tests und
Gegenproben stehen in den Commit-Nachrichten und als Nachtrag vom 30.09. am jeweiligen Befund.

- **Notfall-Probelauf** (Auftrag 05, CI BF-10): siehe Paket 5. Die erwartete Zahl der
  Stack-Variablen im Auftrag war falsch (0 ist richtig, die Werte stehen in der Stack-Datei).
- **Code-Nachzügler:** die vier Nebenbefunde oben. Dazu, beim Prüfen gefunden und behoben:
  - `PUT /users/:id` benannte ohne jede Prüfung um — auf einen Namen aus einer anderen Gemeinde oder
    „ADMIN1" neben „admin1" (gemessen: 200), danach war die Anmeldung mehrdeutig. → **behoben**
    (`eda772b6`); unveränderter Name und eigene Schreibweise geben weiter 200, weil die Store-Apps
    beim Speichern den Namen immer mitschicken.
  - `POST /admin/konfis` und `POST /auth/register-konfi` ohne die Sperre (gemessen: zwei
    gleichzeitige Konfis „Anna Muster" in zwei Gemeinden bekamen beide `anna.muster`). → **behoben**
    (`d2882121`); die Konfi-Anlage weicht auf den nächsten freien Namen aus.
  - Serienanlage bündelte Abfragen per `Promise.all` auf dem Transaktions-Client — heute schon
    aktiv. → **behoben** (`5359e80a`)
  - Mitglieder-Fenster im Chat holte für jedes Mitglied die Personenlisten; Konfis bekamen jedes Mal
    ein 403. → **behoben** (`1c729431`)
  - `@capacitor/status-bar` ist **nicht** ungenutzt: Es ist nativ eingebunden (`includePlugins`,
    Gradle, Podfile) und wirkt ohne Import — iOS scrollt beim Antippen der Statusleiste nach oben,
    Android legt die Oberfläche hinter die transparente Statusleiste. → **bleibt**, bis es am Gerät
    geprüft ist (`a4d29ac2`).
- **Tests:** siehe Paket 7 (BF-02, BF-10). Gefunden: `mailMassenversand` wackelte (Abstände
  364–404 ms gegen eine Schwelle von 390) → **behoben** (`f41a1460`, 10 von 10 grün).
- **Dependabot:** sieben offene PRs geprüft und lokal getestet. Sechs sind in diesem PR enthalten,
  mit den nötigen Anpassungen (vitest 5 braucht eine Typdatei für die jest-dom-Matcher, js-yaml 5 zwei
  Kommentarzeilen, file-type 22.1.1 einen Test): #158, #167 (vitest 5), #169 (js-yaml 5), #192
  (Playwright), #193 (Backend minor/patch, darunter firebase-admin 14.5.0), #194 (setup-java 6).
  Das Web-Bundle bleibt byte-gleich. **#195** (Frontend minor/patch mit Capacitor 8.5.2, Ionic 9.0.5,
  biometric 8.6.11) bringt nativen Code, den die Gerätetests auf Build 235/129 nicht abdecken —
  **zurückgehalten** bis nach dem Store-Release 2.3.0 (Simon). Die zwei moderaten Meldungen auf
  `main` sind react-router 6.30.6 (kein Update möglich, App nicht betroffen) → [offene Befunde
  Nr. 15](../../offene-befunde.md).
- **Beobachtet, nicht geändert:** Der erste E2E-Test direkt nach dem Stack-Start kann an
  `ERR_NETWORK_CHANGED` scheitern (einmal bei #195); ein Aufwärmschritt im E2E-Setup würde helfen.

## Gerätetest Build 130/236 (30.09.2026, Tester)

Bestätigt am Gerät: Mitteilungen tragen das Symbol, die Zahl am App-Symbol stimmt, nach dem
Wechsel in eine andere App und zurück kommt keine Fingerabdruck-Abfrage. Gemeldet und im Zweig von
PR #202 behoben (noch nicht in Produktion, nicht in 130/236):

- **Mitteilungen eines Chats verschwinden beim Lesen nicht** (Simon: „Das ist ein Bug").
  Android: `getDeliveredNotifications` liefert als `data` die `Notification.extras`, nicht den
  Push-Inhalt — der Abgleich auf Art und Raum traf nie. iOS: Das Plugin verweigert das Aufräumen,
  bis die Registrierung durch ist; ein per Push kalt gestarteter Chat verlor es. → **behoben**
  (`e0ec503b`): Server-tag `kq:<art>:<raum>:<eindeutig>`, App liest ihn; Nachholen nach der
  Registrierung. Braucht Server **und** neuen Build. Samsung/Xiaomi (Weg „mitteilungen") bleibt
  bewusst: Die eine Mitteilung trägt die Zahl und geht erst bei 0.
- **PDF und Word gehen vom Android-Handy nicht hoch** (Chat und Material; vom iPhone ja).
  Wahrscheinlichste Ursache: Das WebView liest die `content://`-Auswahl erst beim Senden und bricht
  mit `ERR_UPLOAD_FILE_CHANGED` ab, wenn der Anbieter eine andere Änderungszeit meldet
  (Chromium 40123366) — die Anfrage erreicht den Server nie. Am Gerät nicht nachgestellt, deshalb
  als Hypothese geführt; Gegenprobe über die Log-Zählung (lokaler Agent, Punkt 2). → **behoben**
  (`76e2758b`): Dokumente gehen als Kopie im App-Cache über den FileProvider ans WebView.
  Beim Prüfen gefunden und mit behoben:
  - Chat-Dateien und Offline-Anträge mit Foto landeten nie in der Warteschlange: `queue-uploads/`
    wurde ohne `recursive` beschrieben und nie angelegt („Missing parent directory").
  - Neues Material, dessen Datei-Upload scheiterte, entstand bei jedem weiteren Speichern neu.
- **Anregungen, nicht umgesetzt:** Inhalt einer Chat-Nachricht im Push (Simon prüft Datenschutz);
  Zahl am Symbol nur aus Chat und Glocke, oder ein Schalter „darf freigeben" am Konto (Simons
  Vorschlag; Empfehlung: Schalter, weil er Liste, Mitteilung und Zahl zusammen regelt).

## Mehrfach-Konten (Gespräch mit Simon)

Simon, 28.09.: „Das mit den Multi Accounts müssen wir besprechen." Die übrigen Stellen der Tabelle
„Rolle je Gemeinde" (verschiedene Team-Rollen je Gemeinde) und acht Fragen stehen in
[mehrfach-konten.md](mehrfach-konten.md). Konfi und Team parallel ist seit dem 29.09. ausgeschlossen,
Teamer-Badges gelten je Gemeinde.

## Messen in Produktion und am Gerät

- Aufträge für den lokalen Agenten: [03 nach dem Deploy](../../auftraege/lokaler-agent/03-nach-dem-deploy.md),
  [05 Sicherung und Notfall](../../auftraege/lokaler-agent/05-sicherung-und-notfall.md),
  [06 Mischkonten](../../auftraege/lokaler-agent/06-mischkonten.md),
  [07 Client-Adresse hinter dem Proxy](../../auftraege/lokaler-agent/07-client-adresse-hinter-dem-proxy.md),
  [08 Screenshots](../../auftraege/lokaler-agent/08-screenshots-2.3.md),
  [09 Backend-Container ohne root](../../auftraege/lokaler-agent/09-backend-container.md),
  [10 Deploy-Lücke](../../auftraege/lokaler-agent/10-deploy-luecke.md),
  [11 Schema und Rückspielprobe](../../auftraege/lokaler-agent/11-schema-und-rueckspielprobe.md).
- Die Messliste der [Gesamtabnahme](../2026-09-26/00-gesamtabnahme.md#auf-produktion-nachzumessen)
  und die Abschnitte „Auf Produktion nachzumessen" der Berichte.
- Aus den Paketen vom 29.09.: Jahrgänge mit Punkteziel 0, Teamer-Badges „Pflicht-Anwesenheit" im
  Bestand (Abfragen in den Nachträgen der Berichte).
- **Android-Zahl am Xperia** (nächster interner Testbuild): Das Log nennt beim Start
  `symbol=anbieter`; bei offener App stimmt die Zahl mit der App überein; bei geschlossener App
  erhöht ein Push die Zahl; Lesen in der App senkt sie; spätestens nach fünf Minuten stimmt sie
  wieder; die Mitteilungen bleiben einzeln; ein Push bei offener App verhält sich richtig; Antippen
  führt wie bisher zum Ziel.
- Am Gerät außerdem: Funkloch (Flugmodus), VoiceOver/TalkBack, Schrift „Größt", Dunkelmodus,
  Kaltstart, Biometrie-Rotation vor der Rückkehr des Schalters; Word-Datei senden, Dateiauswahl und
  Links ohne Biometrie-Abfrage; `aps-environment` am nächsten IPA.

## Bei Simon

- **Store und Konten:** Git-Tag `2.3.0` für den schon ausgelieferten Stand (die automatischen Tags
  gelten ab dem nächsten Upload); Store-Texte 2.3.0 (CI BF-08); Universal Links einschalten
  (Entitlement `applinks:konfi-quest.de`); Firebase-Schlüssel in der Google-Cloud-Konsole
  einschränken; ob App Store Connect bei den Uploads 221–230 wegen des Icons gewarnt hat.
- **Betrieb:** `backend-test` auf `test-latest` stellen; Screenshots nach dem Deploy (Auftrag 08);
  Umami bereinigen; Grenze des Mail-Anbieters erfragen.
- **Rückfragen aus dem Großpaket:**
  - Android: Eine Mitteilung, die mit Zahl 0 ankam, bleibt stehen, bis sie weggewischt wird — so
    lassen?
  - Meldung bei rotem `main`: soll das Issue jemanden erwähnen, und passt das Label
    `ci-rot-main`? Schema der Store-Tags; ein Endpunkt für CSP-Meldungen?
  - Node 26 nach dem 28.10.2026 (eine Zeile in `.nvmrc` plus die Dockerfiles); `armv7` in der
    Info.plist beim nächsten Umbau mit Xcode; `frontend.yml` ist gelöscht (baute aus jedem Branch
    ohne Tests und rollte aus) — einverstanden?
  - Datenbank: Wurden Zeitspalten je per psql geschrieben (entscheidet über die 24 Altspalten)?
    `password_plain` mit dem nächsten Release entfernen? Log-Rotation im Stack und
    `timezone=UTC` für den Produktions-Postgres?
  - Postfach: den Altbestand ohne Kennung (vor dem 27.09.2026) vor Ablauf der 365-Tage-Frist
    löschen?
  - Absage: Eine Selbstabgemeldete, die die Leitung als *abwesend* verbucht hatte, gilt nach der
    Absage ebenfalls als entschuldigt (wie die als anwesend verbuchte) — so recht? Und sie bekommt
    wie bisher keine Absage-Mitteilung — so lassen?
- **Aus Paket J (30.09.):**
  - Dependabot #195 (Capacitor/Ionic/biometric) erst nach dem Store-Upload 2.3.0 mergen — oder
    jetzt, dann mit neuen Testbuilds?
  - Die zwei react-router-Alerts auf GitHub mit „Risk is tolerable" schließen (Begründung in
    [offene Befunde Nr. 15](../../offene-befunde.md)).
  - Am Gerät: Scrollt ein Tipp auf die Statusleiste (iPhone) nach oben? Dann bleibt
    `@capacitor/status-bar`.
  - Benutzernamen: Sperre statt eindeutigem Index (kein Migrationsrisiko bei Altbestand-Dubletten);
    beim Bearbeiten wird nur ein wirklich neuer Name geprüft; die Store-App 2.2.x setzt beim
    Speichern einer Gemeinde den Systemnamen weiter ohne Umlaute — eine Serverregel dagegen ist nicht
    gebaut. So lassen?
- **Mehrfach-Konten:** die acht Fragen in [mehrfach-konten.md](mehrfach-konten.md).
- **Feature-Empfehlungen:** die zehn offenen Produktfragen; danach die Features.
