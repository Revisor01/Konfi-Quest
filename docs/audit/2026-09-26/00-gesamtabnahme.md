# Gesamtabnahme Release-Audit Konfi Quest 2.3.0 — 26.09.2026

Koordination über 15 Bereichsprüfungen. Gegenstand: Repo `Revisor01/Konfi-Quest`, Stand
`fce1ab01` (main, „chore(release): Android 124, iOS-Build 230"). Anlass: Verkauf an die EKD,
insgesamt 10.000–25.000 Nutzer:innen pro Jahr (nicht anwachsend), überwiegend Minderjährige —
verteilt auf **Einzelinstanzen mit höchstens 150 Teilnehmenden**, keine gemeinsame Großinstanz.
Alle Chats laufen moderiert, Konfi-zu-Konfi-Chat gibt es nicht. (Beide Angaben von Simon am
26.09. nach der ersten Fassung; was sich dadurch ändert, steht im Abschnitt „Nachtrag".)

## Release-Entscheidung

**2.3.0 in dieser Fassung: nicht freigeben.** Ein KRITISCHER Befund und drei HOHE liegen in
Code, der mit 2.3.0 neu dazukommt oder von den 2.3.0-Funktionen abhängt:

1. Ein Org-Admin kann das Passwort jedes Super-Admin-Kontos derselben Stamm-Gemeinde setzen
   und übernimmt damit die gesamte Instanz (Sicherheit BF-01, von der Koordination
   reproduziert). Innerhalb einer Instanz ist das die Übernahme aller Gemeinden und aller
   Daten darin — bei höchstens 150 Teilnehmenden begrenzt, aber vollständig.
2. Die neue Gemeinde-Einladung lädt Konfis fremder Gemeinden als Teamer:in ein und
   beantwortet jede E-Mail-Adresse im System mit Klarname und Benutzername (Sicherheit
   BF-03, reproduziert).
3. Zwei Apple-Signaturschlüssel liegen in der öffentlichen Git-Historie; ob sie widerrufen
   sind, ist aus dem Repo nicht ersichtlich (Sicherheit BF-02, bestätigt).
4. Der neue Einladungsfluss ist nur zur Hälfte benutzbar: Eingeladene fehlen in
   „Benutzer:innen" und bekommen keine Jahrgänge (Leitung BF-01, bestätigt).

Alle vier sind klein im Eingriff (Rollenprüfung des Ziels, zwei Abfragen auf beide
Zugehörigkeitsquellen, Widerruf im Apple-Portal). **Nach ihrer Behebung: freigeben mit
Auflagen** (Abschnitt „Vor Release"). Die Auflagen sind ebenfalls überwiegend Einzeiler
mit großer Nutzerwirkung (Registrierung verliert die Sitzung nach 15 Minuten, Push um
Mitternacht, Doppelbuchungen bei langsamer Leitung, Abgemeldete können sich nicht wieder
anmelden, Anmeldeseite im Dunkelmodus mit Links bei 1,4:1 Kontrast).

**EKD-Ausrollung: kein Skalierungstor mehr, aber ein Betriebstor und eine offene
Architekturfrage.** Die Ausrollung geschieht in Einzelinstanzen mit höchstens 150
Teilnehmenden; die heutige Produktion trägt rund 110 Konten auf derselben Dimensionierung.
Die Kapazitätsbefunde des Betriebsberichts (Datenbank sättigt bei etwa drei App-Starts je
Sekunde, 1.086 Abfragen je Chat-Nachricht) verlieren damit ihre Dringlichkeit; die Messwerte
bleiben richtig und wandern in die Hygiene-Liste. Von der Größe unabhängig und mit jeder
Instanz einmal mehr zu tragen: Ein Verbindungsabbruch zur Datenbank beendet beide
Backend-Replicas (Betrieb BF-01, von der Koordination reproduziert; Auflage 14), Sicherung
und Wiederherstellung sind im Repo nicht beschrieben, der Deploy hat eine Lücke, die
Rate-Limiter zählen je Replica. Neu und aus dem Repo nicht entscheidbar: Die Store-App kennt
genau **eine** API-Adresse, zur Bauzeit gesetzt (`frontend/src/services/api.ts:8`). Wie eine
App im Store mehrere Instanzen erreicht, steht nirgends (Punkt 25). Melden/Blockieren im Chat
entfällt als Jugendschutz-Auflage: Konfis erreichen einander nur in Räumen, die die Leitung
liest (`chat.js:456`, am Code geprüft); die einzige Stelle, an der diese Zusage im Code nicht
hält, ist Chat BF-01 (Blocker 5).

Kein Bereich hat einen Vertragsbruch gegenüber den Store-Apps 2.2.x gefunden. Die
Mandantentrennung hält in 150 gezielten Fremdzugriffen. Die Testsuiten sind grün und fangen
in 11 von 15 Gegenproben echte Fehler. Das ist die gute Nachricht; sie ändert nichts an den
vier Punkten oben.

**Stand der Behebung (26.09., Abend):** Sechs der sieben Blocker sind im Branch
`claude/fervent-edison-wp5yfj` behoben und mit Tests belegt; offen ist allein Blocker 3
(Widerruf der Apple-Schlüssel, nur Simon im Developer-Portal). Von den Auflagen 8–24 sind alle
umgesetzt bis auf die Zusammenführung der CHANGELOG-Doppelabschnitte (Punkt 19, zum Schluss)
und die Screenshots nach dem Deploy (Punkt 22). Die vollen Suiten sind auf dem
zusammengeführten Stand grün. Einzelheiten im Abschnitt „Behebungsstand".

## Rahmen und Methode

- 15 Bereichsprüfungen parallel, jede mit eigenem Bericht in diesem Verzeichnis, jede nur
  lesend am Projektcode (temporäre Tests wurden geschrieben und wieder gelöscht; der
  Arbeitsbaum ist bis auf die Berichte sauber, `git status --porcelain` nach jedem Bereich
  geprüft).
- Die Koordination hat aus jedem Bericht mindestens eine tragende Behauptung selbst am Code
  nachgeprüft und die kritischen sowie ausgewählte hohe Befunde mit eigenen Tests
  reproduziert (Abschnitt „Gegenprüfungen"). Kein Bericht musste zurückgegeben werden.
- Umgebung: Linux-Container, Node 22.22 (CI: 26, E2E-Job: 20, Produktion: 26),
  PostgreSQL 16 lokal (Produktion 15), sieben getrennte Datenbank-Instanzen (eine je
  Backend-Bereich), Docker-Daemon von Hand gestartet, kein Zugang zu Produktion, Stores,
  Apache/Traefik, Firebase oder Backups.
- Baseline vor dem Start der Bereiche:

| Prüfung | Ergebnis |
|---|---|
| Backend-Suite (`vitest`, echte DB) | 139 Dateien, 3.399 Tests grün, 1.450 s unter Volllast der Maschine |
| Frontend-Suite (`vitest`, jsdom) | 264 Dateien, 3.788 Tests grün, 132 s |
| Typprüfung Frontend (`tsc --noEmit`) | grün |
| E2E (Playwright gegen Docker-Stack) | **nicht ausführbar**: Image-Pull scheitert am Proxy (429). Specs nur gelesen. |

## Zahlen je Bereich

| Bereich | Bericht | KRITISCH | HOCH | MITTEL | NIEDRIG | Empfehlung des Bereichs | Gegenprüfung |
|---|---|---|---|---|---|---|---|
| Backend-Fachlogik A: Punkte, Termine, Jahrgänge, Abzeichen | `backend-fachlogik-punkte-termine.md` | 0 | 2 | 7 | 4 | mit Auflage | hält |
| Backend-Fachlogik B: Chat, Challenges, Rückblick, Postfach, Push | `backend-fachlogik-chat-challenges-rueckblick.md` | 0 | 3 | 6 | 5 | mit Auflage | hält (BF-01 reproduziert) |
| Backend-Sicherheit und Datenschutz | `backend-sicherheit-datenschutz.md` | **1** | 5 | 7 | 9 | **nicht freigeben** | hält (BF-01, BF-03 reproduziert) |
| Datenbank, Schema, Migrationen | `datenbank-migrationen.md` | 0 | 1 | 6 | 10 | mit Auflage | hält |
| App-Grundgerüst (Anmeldung, Sitzung, Offline, Umschalter) | `app-grundgeruest.md` | 0 | 5 | 4 | 4 | mit Auflage | hält |
| Screens Konfi und Teamer, Chat, Rückblick | `app-screens-konfi-teamer.md` | 0 | 2 | 6 | 4 | mit Auflage | hält |
| Screens Leitung und Organisationsverwaltung | `app-screens-leitung.md` | 0 | 1 | 4 | 10 | mit Auflage | hält |
| UI und Barrierefreiheit | `ui-barrierefreiheit.md` | 0 | 2 | 8 | 6 | mit Auflage | hält (Zählungen reproduziert) |
| Dunkelmodus (400 Screenshots, 94 gemessene Zustände) | `darkmode.md` | 0 | 2 | 7 | 3 | mit Auflage | hält (Fundstellen im Theme-CSS bestätigt, Bilder gesichtet) |
| Tests und Testinfrastruktur | `tests-testinfrastruktur.md` | 0 | 0 | 10 | 6 | mit Auflage | hält (Zählungen reproduziert) |
| CI, Deployment, Store-Reife | `ci-deployment-store.md` | 0 | 1 | 8 | 9 | mit Auflage | hält (BF-01 über GitHub-API, BF-03 nachgestellt) |
| Dokumentation gegen Code | `dokumentation-gegen-code.md` | 0 | 0 | 8 | 12 | mit Auflage | hält |
| Toolchain und Abhängigkeiten | `toolchain-abhaengigkeiten.md` | 0 | 0 | 5 | 7 | freigeben | hält |
| Betrieb, Skalierung, Lastverhalten | `betrieb-skalierung.md` | 0 | 5 | 7 | 4 | mit Auflage | hält (BF-01 reproduziert) |
| **Summe der 14 Befundberichte** | | **1** | **29** | **93** | **93** | | **216 Befunde** |
| Feature-Empfehlungen für die EKD-Ausrollung | `feature-empfehlungen.md` | 33 Empfehlungen (9 vor Release, 12 in den ersten drei Monaten, 5 danach, 7 bewusst nicht), 10 offene Produktfragen | | | | kein Befundbericht | hält |

Doppelungen zwischen Berichten sind in der Summe **nicht** herausgerechnet; die
zusammengeführten Sammelbefunde stehen im nächsten Abschnitt.

## Zusammengeführte Doppelungen (Sammelbefunde)

| Nr. | Thema | Fundstellen in den Berichten | Schwere (zusammengeführt) |
|---|---|---|---|
| S-01 | Spalte `konfi_profiles.password_plain` existiert weiter, wird nur beim Passwort-Neusetzen geleert; Altbestand an Klartextpasswörtern möglich | Sicherheit BF-06, Datenbank BF-06, Koordination K-01 | HOCH, KRITISCH falls in Produktion befüllt |
| S-02 | Multi-Gemeinde-Funktion (2.3.0) nur teilweise umgebaut: `GET /users` und `PUT /users/:id` nur Stamm-Gemeinde; Gruppenchat-Teilnehmer; Cron-Team-Rückblick; `/wrapped/me`; 403-Rückfall lässt Org-Claim im Token; Einladung fremder Konfis | Leitung BF-01, Chat BF-04/06/08, Grundgerüst BF-05, Sicherheit BF-03 | HOCH |
| S-03 | Ranking liefert Klarnamen und exakte Punkte der drei Besten an jeden Konfi; Handbuch verspricht das Gegenteil | Screens Konfi/Teamer BF-03, Feature E-06, Koordination K-03 | MITTEL (Datenminimierung Minderjähriger) |
| S-04 | Terminlisten materialisieren die View `event_booking_stats` über alle Buchungen aller Gemeinden (83–119 ms bei 150.000 Buchungen statt 1,2 ms) | Datenbank BF-02, Betrieb BF-03, Punkte/Termine „Unklar" | NIEDRIG — Nachtrag 26.09.: bei ≤ 150 Teilnehmenden je Instanz ohne Nutzerwirkung, Messwert bleibt |
| S-05 | Vortags-Erinnerung geht im ersten 15-Minuten-Takt nach Mitternacht hinaus; Erinnerungslauf ohne Überlappungsschutz, Doppelversand möglich | Chat BF-03, Betrieb BF-05, Chat „Unklar" | HOCH |
| S-06 | Lint- und Build-Gate der CI wirkungslos: Lint nur bei Pull Requests (seit 31.08. kein PR), kein `tsc`/`vite build` vor dem Merge, 19 ESLint-Fehler im Bestand | Tests BF-07, Toolchain BF-01, CI BF-07, Screens BF-11/BF-13, Grundgerüst BF-12 | MITTEL |
| S-07 | `--passWithNoTests` in beiden Test-Jobs, `npm audit || true` im Frontend | Tests BF-08, CI BF-12, Toolchain BF-08 | MITTEL |
| S-08 | Vier Node-Stände (20 EOL im E2E-Job, 22 lokal/engines, 26 CI/Produktion ohne LTS) | CI BF-11, Tests BF-12, Toolchain BF-04 | MITTEL |
| S-09 | Backend-Image: `npm install` statt `npm ci`, `npm install pg` hebt `--omit=dev` auf, root, Tests und Schema-Dump im Image, keine `.dockerignore` | CI BF-06, Toolchain BF-03 | MITTEL |
| S-10 | Rate-Limiter zählen je Replica (Limits gelten doppelt), `X-Real-IP` ungeprüft, Passwort-Reset-Limiter ohne Proxy-Schlüssel (5 Anfragen je Viertelstunde für die ganze Plattform) | Sicherheit BF-05/BF-13, Betrieb BF-09 | HOCH (Reset-Limiter), MITTEL (übrige) |
| S-11 | Deploy-Lücke bei jedem Push auf `main` (10–20 s), rollender Deploy seit 21.06. Entwurf, Graceful Shutdown endet immer nach 10 s mit Exit 1 | CI BF-05, Betrieb BF-07/BF-12 | MITTEL |
| S-12 | Store-Texte 2.3.0 fehlen, CHANGELOG-Unreleased mit doppelten Abschnitten | CI BF-08, Doku BF-05/BF-10 | MITTEL |
| S-13 | Versionsstände widersprechen sich (Root `package.json` 2.9.0, Backend 1.0.1 → `/api/status`, Frontend 0.0.1, Info.plist 220, pbxproj 218 gegen `version.json` 2.3.0/230) | CI BF-09, Doku BF-10, Toolchain BF-10, Koordination K-02 | NIEDRIG (Quelle `version.json` ist korrekt) |
| S-14 | `docs/offene-befunde.md` führt #12 (init-scripts) und #13 (Teamer-Termine) als offen; beide sind seit 16.09. erledigt (Schema-Diff 0 Zeilen) | Doku BF-12, CI BF-15, Datenbank BF-13, Tests BF-11 | NIEDRIG |
| S-15 | Serveradressen, IP, SMTP-Nutzer und Produktions-SSH-Ziel im öffentlichen Repo | Sicherheit BF-12, Datenbank BF-14 | MITTEL |
| S-16 | Kein Melden/Blockieren im Chat für Minderjährige | Screens Konfi/Teamer BF-06, Feature E-15 | NIEDRIG, Produktentscheidung — Nachtrag 26.09.: jeden gemeinsamen Raum liest die Leitung, kein Konfi-zu-Konfi-Chat |
| S-17 | 42 Screenshots zeigen den Stand 2.2.x (10.09.), werden aber als Store-Bilder genutzt und mit 33 MB in jedes Store-Bundle kopiert; 27 davon referenziert kein Handbuchkapitel | UI BF-09, Toolchain BF-02, Doku BF-18 | MITTEL |
| S-18 | Postgres mit 0,3 CPU / 1 GB, `PG_POOL_MAX` nicht im Compose, keine Sicherung/Wiederherstellung im Repo beschrieben | Datenbank BF-05/BF-07, Betrieb BF-13 | MITTEL — Nachtrag 26.09.: CPU-Grenze reicht für ≤ 150 Teilnehmende; Sicherung/Wiederherstellung bleibt und gilt je Instanz |
| S-19 | `/api/metrics/history?days=730` liefert 31–35 MB | Datenbank BF-16, Betrieb BF-14 | NIEDRIG |
| S-20 | Datenschutz-Dokumentation: Stand „Juni 2026", Multi-Gemeinde-Datenfluss fehlt, kein Verweis auf Verarbeitungsverzeichnis/TOM/AVV, Crashlytics ohne Abschaltmöglichkeit, Einwilligung außerhalb der App | Doku BF-08, Sicherheit BF-22, Grundgerüst BF-13, Feature E-01 | MITTEL, je Instanz und Träger |
| S-21 | Sitemap aus Datei-Änderungszeiten, nicht reproduzierbar, nicht im Frischecheck | CI BF-13, Doku BF-13 | NIEDRIG |
| S-22 | README: Installationsweg funktioniert so nicht, Testzahlen 1625/2470 statt 3788/3399, „Handbuch in der App" ohne Link | Doku BF-01, Tests BF-11, Feature E-04, Koordination K-05 | MITTEL |
| S-23 | Personenbezogene Daten in Logs: Benutzernamen bei jedem Login, Passwort im Konsolen-Log des Clients bei Fehlversuch, Roh-URLs mit Suchbegriffen im Betriebs-Dashboard | Sicherheit BF-14, Grundgerüst BF-08, Leitung BF-12 | MITTEL |
| S-24 | `lang="en"` auf einer deutschen App | UI BF-05, Feature E-09, Koordination K-04 | MITTEL |
| S-25 | Grüne Tests, die das Falsche prüfen: 124 von 264 Frontend-Testdateien lesen Quelltext statt zu rendern; die Dunkelmodus-Tests prüfen das Stylesheet als Text und übersehen 104 gerenderte Kontrastverstöße | Tests BF-02, Dunkelmodus BF-09 | MITTEL |
| S-26 | Bereichsfarben als Textfarbe ohne dunkle Variante (234 Stellen, im Dunkeln 1,7–4,2:1) und Hellmodus-Grautöne unter 4,5:1 (119 Stellen) — dieselbe Ursache: keine Text-Token-Familie | Dunkelmodus BF-01/BF-05/BF-06, UI BF-04 | MITTEL (Anmeldeseite HOCH) |

## Gegenprüfungen der Koordination

| Bericht | Geprüfte Behauptung | Methode | Ergebnis |
|---|---|---|---|
| Sicherheit | BF-01 KRITISCH: Org-Admin setzt Super-Admin-Passwort | eigener Vitest gegen `createApp` (Port 5432, gelöscht): `PUT /api/admin/users/10/reset-password` als `orgAdmin1` | **200**; Login als `superadmin` mit neuem Passwort 200, `is_super_admin=true`; `GET /api/organizations` 200 mit allen Organisationen |
| Sicherheit | BF-03: Einladung fremder Konfis, Personenabfrage | derselbe Test: `POST /api/einladungen {kennung:'konfi3', role_id:2}` | **201** mit `display_name`, `username`, `user_id`; unbekannte Kennung 404 |
| Sicherheit | BF-02: Apple-Schlüssel in der Historie | `git log --all --diff-filter=A -- 'docs/AuthKey_*.p8'` | zwei Commits (01.08.2025, 23.03.2026) fügen `AuthKey_7AQA623H3T.p8` und `AuthKey_A29U7SN796.p8` hinzu; Entfernung 24.03.2026 nur aus dem Tracking |
| Chat/Challenges | BF-01: `direct`-Raum mit drei Teilnehmenden ohne Leitungszugriff | eigener Vitest: `POST /api/chat/rooms {type:'direct', participants:[konfi1, konfi2]}` als `teamer1` | 200, drei Teilnehmer, `type=direct`; `org_admin` liest → **403**; konfi1 schreibt 200, konfi2 liest 200; Gegenprobe `group` → org_admin 200 |
| Chat/Challenges | BF-02 Kaskade, BF-03 Mitternachts-Erinnerung | Code: `143_wrapped_ausgaben.sql:43,82` CASCADE; `backgroundService.js:666-677` Fenstervariablen ungenutzt | bestätigt |
| Punkte/Termine | BF-01: `DELETE /events/:id/book` ohne Pflicht-, Frist-, Anwesenheitsprüfung für Konfis | Code `buchung.js:105-108,151` | bestätigt: Konfi zugelassen, nur `present` behandelt, kein `mandatory`/`event_date` |
| Datenbank | BF-01 fehlender Index `chat_messages.reply_to`/`user_id`; BF-03/04 `statement_timeout` auf Lock-Verbindung | grep über Migrationen und Dump; `database.js:51-59,84-86` | bestätigt |
| Grundgerüst | BF-01 `'none'` gilt als online; BF-02 POST wird wiederholt; BF-03 Registrierung ohne Refresh-Token | `networkMonitor.ts:25`, `api.ts:47-53`, `KonfiRegisterPage.tsx:249` (0 Treffer `refresh_token`), `auth.js:1081` | bestätigt |
| Screens Konfi/Teamer | BF-01 Wiederanmeldung; BF-04 Chat endet bei 100; BF-08 10 MB gegen 5 MB | `konfi.js:1199`, `bookingUtils.js:891-895`, `ChatRoom.tsx:59,280,295`, `useChatDateien.ts:82`, `createApp.js:196` | bestätigt |
| Leitung | BF-01 `GET /users` nur Stamm-Gemeinde; BF-02 keine Einladungsliste im Frontend | `users.js:97,288` gegen `:119-141`; grep `einladungen` in `frontend/src` | bestätigt |
| UI | BF-01 170 von 186 Feldern ohne Namen; BF-04 Kontraste | Zählskript des Berichts erneut ausgeführt; WCAG-Formel nachgerechnet | 186/170, 93 Legacy-Labels, 0 `label=`; 3,26 / 2,85 / 3,54 / 2,15 |
| Tests | BF-06 weiche Assertions; BF-02 Quelltext-Tests | Fundstellen gelesen; eigene Zählung | 124 von 264 Dateien lesen Quelltext ohne `render(` (Bericht: 123/263 ohne `App.test.tsx`) |
| CI/Store | BF-01 Store-Build aus rotem Commit; BF-03 Deploy-Regex trifft Test-Backend | GitHub-API: CI-Lauf 36196314912 `failure`, iOS-Lauf 36196321736 `success`, gleicher SHA `b3b6ded1`, 5 s Abstand; perl-Rewrite nachgestellt | bestätigt: Zeile 212 `test-latest` → `fce1ab0` |
| Dokumentation | BF-02 E-Mail-Wechsel ohne Bestätigung; BF-06 ABRISS-Liste; BF-07 falsche Rollen in der yaml | `auth.js:469`; `ABRISS.md:161-162` gegen `PushAuswahl.tsx:77,136`; `chat-challenges.yaml:1594-1595` gegen `challenges.js:1605` | bestätigt |
| Toolchain | BF-02 33 MB Handbuch im Bundle; BF-05 `node-fetch` undeklariert | `du -sb frontend/public/docs` = 34.271.274; `npm explain node-fetch` → optional über `@google-cloud/storage` | bestätigt |
| Betrieb | BF-01 Verbindungsabbruch beendet Replica | eigene Instanz (Port 6441) gegen die Messdatenbank, `pg_terminate_backend` | **Prozess beendet sich** („Unbehandelte Exception - geordneter Shutdown"), `/api/health` danach nicht erreichbar |
| Betrieb | BF-03 View-Materialisierung, BF-04 Fan-out je Teilnehmer | `konfi.js:1258,1393`, `lesen.js:163`; `chat.js:1260` Schleife mit `total_unread` je Kopf | bestätigt |
| Feature-Empfehlungen | E-06 Ranking-Antwort, E-09 `lang`, E-04 kein Handbuch-Link | `konfi.js:136-137,265-267,335`; `index.html:2`; grep `/docs` | bestätigt |
| Dunkelmodus | BF-01 Auth-Textfarben, BF-02 Verlaufsenden auf Text-Tokens, BF-03 Theme schlägt Karten-Token auf iOS | `variables.css:2635,2771-2782,3115,3149,396`; Theme-Regel in `@rdlabo/ionic-theme-ios27/dist/css/ionic-theme-ios27.css`; 5 Inline-Flicken gezählt; Bilder `dark-ios-public-login.png`, `dark-ios-admin-konfis.png` gesichtet | bestätigt |

Nebenbeobachtung zum Prüfprozess: Während des Audits erschienen zeitweise Änderungen an
`backend/routes/events/lesen.js`, `middleware/rbac.js` und `utils/chatRoomAccess.js` im
Arbeitsbaum. Sie stammten aus den dokumentierten Gegenproben des Testbereichs („Fehler
einbauen, Test muss fallen") und wurden jeweils zurückgesetzt; `git diff` gegen `main` ist
für den gesamten Projektcode leer.

## Eigene Befunde der Koordination

- **K-01** `konfi_profiles.password_plain` — siehe S-01. Aus Code gelesen; Bestand nur in
  Produktion prüfbar. Empfehlung: erst zählen, dann Migration `UPDATE … SET password_plain = NULL`,
  später `DROP COLUMN`.
- **K-02** Versionsstände — siehe S-13. Die Quelle `frontend/version.json` (2.3.0 / 124 / 230)
  ist korrekt und wird von beiden Release-Workflows gelesen; die eingecheckten iOS-Dateien
  und die drei `package.json` führen in die Irre. NIEDRIG.
- **K-03** Ranking-Antwort mit Klarnamen — siehe S-03. MITTEL.
- **K-04** `lang="en"` — siehe S-24. MITTEL.
- **K-05** README-Testzahlen und „Handbuch in der App" — siehe S-22. NIEDRIG.
- **K-06** `frontend/tsconfig.node.tsbuildinfo` entsteht bei `tsc -p tsconfig.node.json`
  (`composite: true`) und ist nicht in `.gitignore`; im Audit tauchte die Datei als
  untracked auf. NIEDRIG, Hygiene.
- **Geprüft und in Ordnung (Koordination):** `GET /teamer/badges` liefert weiter ein Array
  mit Kopfzeilen, `/badges/v2` das Objekt, die Store-App 2.2.0 ruft nur `/v2`
  (`teamer.js:267-318`; der Vorfall vom 29.08. ist damit gelöst wie in CLAUDE.md
  versprochen). Die Rolle je Gemeinde wird in `rbac.js:150-169` auf die aktive Gemeinde
  umgeschaltet. Nur zwei Stellen im Frontend iterieren direkt über API-Antworten, beide
  abgesichert (`EventDetailView.tsx:345` in `try/catch`, `AppContext.tsx:602` hinter
  `Array.isArray`). Git-Tags der letzten Releases ohne `v`-Präfix wie verlangt (2.0.0,
  2.1.1, 2.2.0); die 22 `v`-Tags sind Altlast der alten Zählung.

## Priorisierte Reihenfolge

### Blocker — vor Release 2.3.0 zwingend

1. **Sicherheit BF-01 (KRITISCH):** In `reset-password`, `PUT /users/:id`, `DELETE /users/:id`
   und `checkUserHierarchy` das Ziel laden und bei `role_name = 'super_admin'` oder
   `is_super_admin = true` mit 403 abweisen, sofern der Aufrufer nicht selbst Super-Admin ist.
   Tests für den verbotenen und den erlaubten Fall. API-Doku N1 als behoben datieren.
2. **Sicherheit BF-03 (HOCH):** `POST /einladungen` lehnt Ziele mit Stammrolle `konfi` ab und
   antwortet ohne `display_name`/`username`/`user_id` (einheitlich, ohne Existenzbestätigung).
3. **Sicherheit BF-02 (HOCH, Betriebsfrage):** Widerruf der Apple-Key-IDs `7AQA623H3T` und
   `A29U7SN796` bestätigen oder jetzt durchführen. Ohne Nachweis blockierend.
4. **Leitung BF-01 (HOCH):** `GET /users` und `PUT /users/:id` auf beide Zugehörigkeitsquellen
   (`users.organization_id` und `user_organizations`) erweitern — oder den Einladungsknopf für
   2.3.0 zurückhalten.
5. **Chat BF-01 (HOCH):** `POST /chat/rooms` weist den Typ `direct` ab (oder begrenzt ihn auf
   genau eine weitere Person). Bestand in Produktion prüfen (SQL im Bericht). Das ist die
   einzige Stelle, an der die Zusage „alle Chats moderiert, kein Konfi-zu-Konfi-Chat" im Code
   nicht hält: Ein Teamer-Token genügt, um zwei Konfis in einen Raum zu setzen, den keine
   Leitung lesen kann.
6. **Grundgerüst BF-03 (HOCH):** Registrierung übernimmt `refresh_token` in den `tokenStore`
   (zwei Zeilen). Ohne das fliegt jede neue Konfi 15 Minuten nach der Registrierung heraus.
7. **CI BF-01 (HOCH):** Für die Store-Einreichung 2.3.0 nachweisen, dass der CI-Lauf des exakt
   gebauten Commits grün ist; für künftige Builds Ref-Prüfung auf `main` und Warten auf den
   grünen CI-Lauf desselben SHA in beide Release-Workflows.

### Vor Release — Auflagen zur Freigabe

8. **S-05 (HOCH):** Vortags-Erinnerung an eine Uhrzeit binden (24 h ± 15 min oder feste
   Tageszeit); Erinnerungslauf mit Laufmerker gegen Überlappung.
9. **Grundgerüst BF-02 (HOCH):** `axios-retry` wiederholt keine POSTs ohne Idempotenzschlüssel.
10. **Screens Konfi/Teamer BF-01 und BF-02 (HOCH):** `can_register` für `excused`/`opted_out`
    wahr; Zweig „Von der Leitung abgemeldet → Wieder anmelden"; Abmeldeweg von der Warteliste.
11. **Punkte/Termine BF-01 (HOCH):** `DELETE /events/:id/book` prüft für Konfis Pflichttermin,
    Frist und Anwesenheitsvermerk wie die Konfi-Route (oder delegiert dorthin).
12. **Sicherheit BF-05 (HOCH):** Passwort-Reset-Limiter mit `clientIp`-Schlüssel und zusätzlich
    je Ziel-E-Mail; in Produktion messen, was `req.ip` hinter dem Proxy liefert.
13. **S-01 (HOCH):** `SELECT count(*) FROM konfi_profiles WHERE password_plain IS NOT NULL` in
    Produktion; bei > 0 sofort leeren und Sicherungen bewerten; Migration nachziehen.
14. **Betrieb BF-01 (HOCH):** LISTEN-Client des Socket-Adapters mit `error`-Handler und
    Reconnect versehen; Test „nach `pg_terminate_backend` lebt der Prozess". Trifft heute jede
    Datenbank-Neustartsituation, nicht erst die Ausrollung.
15. **Grundgerüst BF-05 (HOCH):** Im 403-Rückfall auf die Stamm-Gemeinde ein Token ohne
    Org-Claim beschaffen und den Socket neu aufbauen.
16. **Chat BF-02 (HOCH):** `wrapped_ausgaben.jahrgang_id` auf `ON DELETE SET NULL` (additiv)
    oder mindestens Löschdialog und Handbuch nennen den Verlust der Rückblicke beförderter
    Teamer:innen.
17. **Punkte/Termine BF-02 (HOCH):** Punktwert am Zuordnungsdatensatz speichern (additive
    Migration); bis dahin Handbuch-Warnung, Punktwerte bestehender Aktivitäten nicht zu ändern.
18. **UI-Auflage:** Die vier Anmeldeseiten tastatur- und vorlesefähig (Feldnamen, Links als
    Knöpfe, Enter sendet, `role="alert"`, Fokusring); `lang="de"`.
18a. **Dunkelmodus-Auflage (darkmode BF-01, BF-02, BF-03, BF-07, BF-08):** Text-Token je Bereichsfarbe
    für Überschrift und Links der Anmeldeseiten (heute 1,4–1,7:1 auf der dunklen Karte);
    Verlaufsenden der Dashboard-Karten „Ranking" und „Events" auf Flächen-Tokens statt
    Text-Tokens (weiße Schrift auf Mint/Rosa, 1,3–1,9:1); Karten-Regel `ion-card.app-card` über die
    Spezifität des ios27-Themes heben, damit `--app-surface-card` auch auf dem iPhone greift (heute
    bleiben dort alle Karten auf Ionics `#1c1c1d`, die fünf Inline-Flicken entfallen);
    Reaktionszähler im Chat auf Text-Token; Knopf „Zur Teamer:in befördern" mit `--color: white`
    (heute Schwarz auf Lila, 2,3:1). Danach die fünf Screens dunkel auf einem iPhone ansehen.
19. **Doku-Auflage:** `docs/store-texte-2.3.0.md` anlegen; CHANGELOG-Doppelabschnitte
    zusammenführen; Handbuch: E-Mail-Wechsel ohne Bestätigungsmail, Rechte-Tabelle Challenges,
    Beförderung ohne automatische Jahrgangszuweisung, Umschalter-Regel; `ABRISS.md` die beiden
    `preferences`-Routen aus der Abrissliste nehmen; API-Referenz fünf Rollenangaben
    korrigieren; `offene-befunde.md` #12/#13 als behoben markieren.
20. **CI-Auflage:** Deploy-Regex auf `backend`/`backend2`/`frontend` begrenzen (Test-Backend
    läuft heute nach jedem Push auf dem Live-Stand); `concurrency` für den Deploy-Job;
    `tsc --noEmit` und `vite build` im Frontend-Test-Job; `--passWithNoTests` entfernen.
21. **Test-Auflage:** Test „fremde Gemeinde → 404" für `GET /api/events/:id` und die 23
    geschützten Routen ohne Fremd-Gemeinde-Test; die zehn weichen Assertions schärfen.
22. **Screenshots** nach dem Deploy neu ziehen, bevor sie als Store-Bilder für 2.3.0 dienen.
23. **Sicherheit BF-07/BF-08/BF-09/BF-10 (MITTEL):** Soft-gelöschte Konten am Login abweisen;
    Refresh-Gnadenfrist auf eine Wiederverwendung; `rejectUnauthorized` für SMTP entfernen;
    RBAC-Cache bei Deaktivierung und Löschung invalidieren.
24. **Multi-Gemeinde-Restlücken (Chat BF-04/06/08, MITTEL):** Cron-Team-Rückblick, `/wrapped/me`,
    Gruppenchat-Teilnehmer auf beide Quellen — oder die Funktion in den Release-Notes nicht als
    vollständig bewerben.

### Vor EKD-Ausrollung — Betriebsmodell, Betrieb je Instanz, Rechenschaft

*Nachtrag 26.09.: Die Skalierungspunkte der ersten Fassung (S-04, Betrieb BF-02/BF-03/BF-04/
BF-06/BF-11 und der CPU-Anteil von S-18) stehen gesammelt unter Punkt 37. Nach Simons
Entscheidung, alle Gemeinden in einer Datenbank zu betreiben (Punkt 25), gelten sie wieder in
voller Schwere und gehören vor die Ausrollung. Die Nummern 25–31 sind neu belegt, 32–36
unverändert.*

25. **Betriebsmodell der Einzelinstanzen klären (Unklar, entscheidend):** Die Store-App spricht
    genau eine API-Adresse: `VITE_API_URL` zur Bauzeit, sonst `https://konfi-quest.de/api`
    (`frontend/src/services/api.ts:8`). Der iOS-Release-Workflow kennt den Parameter `api_url`
    nur für die Test-API (`ios-release.yml:14-17`), der Android-Workflow gar nicht. Zwei
    Lesarten, aus dem Repo nicht entscheidbar: (a) eine Instanz = eine Organisation im
    gemeinsamen Backend — dann gelten die Skalierungsbefunde aus Punkt 37 wieder in voller
    Schwere, weil alle 10.000–25.000 Konten in einer Datenbank landen; (b) eine Instanz = eigene
    Installation mit eigener Datenbank — dann braucht die App eine Instanzwahl (Server-Adresse
    beim ersten Start, QR-Code, Subdomain je Instanz) oder je Instanz einen eigenen Build samt
    Store-Eintrag, und davon existiert heute nichts. Vor jedem weiteren Ausrollschritt
    entscheiden und im Repo festhalten.
    **Entschieden 26.09. (Simon): Lesart (a) — alle Gemeinden in einer Datenbank, jede
    Gemeinde eine Organisation mit höchstens 150 Teilnehmenden.** Damit gelten die
    Skalierungsbefunde aus Punkt 37 wieder in voller Schwere und gehören vor die
    Ausrollung; ihre Behebung läuft als eigenes Paket (Indizes, Terminlisten,
    Replica-Absturz zuerst, dann Chat-Fan-out, Limiter-Store, Cron-Leader,
    Postgres-Ressourcen, Deploy-Lücke).
26. **Betrieb je Instanz (S-18 Rest, Datenbank BF-05/BF-07, Betrieb BF-02/BF-10/BF-12):**
    Sicherung und Wiederherstellung beschreiben und einmal üben; `PG_POOL_MAX` ins Compose;
    Deploy-Lücke schließen; Cron-Leader mit Sichtbarkeit; App-Icon-Lauf nach Neustart mit
    Laufmerker. Was bei einer Instanz Hygiene ist, wird bei N Instanzen zur Routine, die ohne
    Beschreibung nicht delegierbar ist.
27. **Datenbank BF-01 (HOCH → MITTEL):** Indizes auf `chat_messages(reply_to)` und
    `chat_messages(user_id)` (Migration 160). Additive Migration von zwei Zeilen, unabhängig
    von der Größe sinnvoll; gemessen an 490.400 Nachrichten 31,4 s → 12,6 ms. Bei 150
    Teilnehmenden entsprechend kleiner, aber der Löschpfad (Konto löschen, Raum leeren, Jahrgang
    löschen) wächst mit jedem Jahrgang, der im Chat bleibt.
28. **Rechenschaft (S-20):** Datenschutzerklärung auf 2.3.0 (Multi-Gemeinde, Crashlytics,
    Umami); Verweis auf Verarbeitungsverzeichnis, TOM, AVVs; Einwilligung dokumentieren
    (Feature E-01); Crashlytics abschaltbar. Gilt je Instanz und je Träger — bei Lesart (b)
    aus Punkt 25 also je Installation.
29. **Betrieb BF-09 (MITTEL):** gemeinsamer Limiter-Store; heute gelten alle Limits doppelt,
    weil jede Replica für sich zählt. Unabhängig von der Größe.
30. **Betrieb BF-14 / S-19 (NIEDRIG):** `/api/metrics/history?days=730` liefert 31–35 MB —
    Größe je Instanz begrenzen oder paginieren; wächst mit der Laufzeit, nicht mit der
    Teilnehmerzahl.
31. **Jugendschutz (S-16) — Produktentscheidung, keine Auflage mehr:** Konfis erreichen
    einander nur in Räumen, die die Leitung liest; ein Konfi-zu-Konfi-Direktchat wird mit 403
    abgewiesen (`backend/routes/chat.js:456-459`, am Code geprüft); Zweiergespräche
    Konfi–Teamer:in sind laut Handbuch bewusst privat. „Nachricht melden" (Feature E-15) bleibt
    eine Komfortfunktion, mit der ein Kind die Leitung auf eine Stelle im Chat zeigt, ohne sie
    selbst anzuschreiben; Blockieren hat kein Ziel. Offen bleibt, ob die Store-Prüfung für
    Apps mit nutzergenerierten Inhalten einen Meldeweg verlangt — bisher kam die App ohne durch.
32. **Feature-Empfehlungen A (E-01 bis E-09):** insbesondere Wartungshinweis/Mindestversion über
    `/api/app-version` (muss in 2.3.0, damit der Rollout-Bestand es kennt), Gemeinden anlegen
    ohne Flaschenhals, Löschfrist ohne Konfirmationstermin, Hilfe in der App.
33. **Barrierefreiheit:** 170 Formularfelder auf `label=`, 147 klickbare `div`/`span` mit
    Rolle, Kontraste im Hellmodus, Dynamic Type auf iOS.
34. **Dunkelmodus systematisch statt Einzelfixe** (darkmode „Empfohlener Weg", geschätzt 9–10
    Personentage): Ionic-Flächenvariablen je Plattform an die App-Tokens binden (eine
    Stufenleiter statt zwei), Text-Token-Familie je Bereichsfarbe mit Codemod über die 234
    Textstellen, `--app-text-muted` heben, Stylelint/ESLint gegen rohe Farbwerte, ein gerenderter
    Kontrast- und Screenshot-Test in der CI (hell/dunkel × iOS/Android), Handbuch-Bilder in beiden
    Modi. Die sieben Einzelfixe vom 25./26.09. haben rund 13 Stunden gekostet und 104 Messstellen
    offen gelassen; die grünen Dunkelmodus-Tests prüfen das Stylesheet als Text, nicht das Ergebnis.
35. **S-17:** Handbuch-Bilder aus dem Store-Bundle (33 MB) nehmen.

### Danach — Hygiene und Prozess

36. S-06 bis S-09, S-11 bis S-15, S-21 bis S-24 und die NIEDRIG-Befunde aller Berichte;
    Backend-Lint einführen; Frontend-Tests von Quelltext- auf gerenderte Prüfungen umstellen;
    Vorlagenkatalog, Kalender-Export, CSV-Import und die übrigen Feature-Empfehlungen B/C nach
    Produktentscheidung.
37. **Skalierungspunkte (Nachtrag 26.09.) — nach Simons Entscheidung „alles in einer
    Datenbank" wieder VOR der EKD-Ausrollung, siehe Punkt 25:** S-04 (Terminlisten ohne View-Materialisierung,
    gemessen 100 ms → 1,2 ms), Betrieb BF-03/BF-04 (1.086 Abfragen und 66 Einzel-Pushes je
    Chat-Nachricht), BF-06 (Wrapped-Parallelität), BF-11 (Log-Volumen), BF-13 CPU-Anteil
    (Postgres ≥ 2 CPU, 2–4 GB, `shared_buffers`). Bei ≤ 150 Teilnehmenden je Instanz ohne
    Nutzerwirkung; die Messwerte und Rezepte im Betriebs- und Datenbankbericht bleiben gültig
    und rücken sofort nach „Vor EKD-Ausrollung", falls Punkt 25 auf Lesart (a) hinausläuft.

## Was nicht geprüft werden konnte

- **E2E-Suite:** Playwright gegen den Docker-Stack lief nicht (Image-Pull über den Proxy:
  429). Die acht Specs sind nur gelesen; der E2E-Datenbankaufbau wurde außerhalb von Docker
  nachgestellt (Tests BF-03).
- **Geräte:** kein iOS/Android-Gerät, kein Simulator. Dunkelmodus, Dynamic Type, VoiceOver/
  TalkBack, Offline-Erkennung im Flugmodus, Push-Empfang nur aus Quelltext und Headless-Browser.
- **Produktion:** kein Zugang zu Datenbank, Containern, Logs, Portainer, Apache/Traefik,
  Firebase, SMTP, Sicherungen. Alles, was davon abhängt, steht im nächsten Abschnitt.
- **Stores:** App Store Connect und Play Console (Datenschutz-Angaben, Altersfreigabe,
  Review-Warnungen, tatsächliche Bundle-Größe).
- **Native Builds:** kein Xcode, kein Android-SDK; Podfile/Gradle nur gelesen.
- **Backend-Suite auf Node 26:** lokal nur Node 22.
- **Lastverhalten unter echter Parallellast:** Kapazitätsaussage aus gemessenen Einzelkosten
  gerechnet, nicht mit einem Lastgenerator gemessen.
- **Rechtliche Bewertung** (Einwilligung Minderjähriger, Crashlytics-Rechtsgrundlage,
  DSG-EKD-Fristen): technisch beschrieben, nicht juristisch bewertet.

## Auf Produktion nachzumessen

Die vollständigen Kommandos stehen je Bericht im Abschnitt „Auf Produktion nachzumessen".
Die wichtigsten, in dieser Reihenfolge:

1. `SELECT count(*) FILTER (WHERE password_plain IS NOT NULL) FROM konfi_profiles;` — entscheidet, ob S-01 KRITISCH ist.
2. Apple-Developer-Portal: Key-IDs `7AQA623H3T` und `A29U7SN796` widerrufen?
3. `SELECT u.id, u.username, u.organization_id, r.name, u.is_super_admin FROM users u JOIN roles r ON r.id=u.role_id WHERE r.name='super_admin' OR u.is_super_admin;` — jede Zeile mit gesetzter `organization_id` ist heute von jedem Org-Admin dieser Gemeinde übernehmbar.
4. `SELECT r.id, r.organization_id, COUNT(*) FROM chat_rooms r JOIN chat_participants p ON p.room_id=r.id WHERE r.type='direct' GROUP BY 1,2 HAVING COUNT(*) <> 2;` — Bestand an „Direktchats" mit mehr als zwei Personen.
5. `SELECT date_trunc('hour', sent_at AT TIME ZONE 'Europe/Berlin'), COUNT(*) FROM event_reminders WHERE reminder_type='1_day' GROUP BY 1 ORDER BY 2 DESC LIMIT 5;` — dominiert 00:00?
6. `SELECT name FROM schema_migrations ORDER BY name DESC LIMIT 5;` (erwartet `159_…`, 89 Einträge) und `docker logs … | grep -c "Migration FAILED"`; Schema-Dump gegen `backend/tests/schema/prod-schema.sql` plus Migrationen diffen (Dump ist vom 22.08.).
7. Portainer-Stack 249: steht `backend-test` auf `test-latest` oder auf dem Live-SHA?
8. `req.ip` gegen `X-Real-IP`/`X-Forwarded-For` bei Anfragen verschiedener Clients loggen; überschreibt Apache `X-Real-IP`?
9. `docker stats` und `cpu.stat throttled` der Postgres an einem Abend; `SHOW statement_timeout`; Cache-Trefferquote `pg_stat_database`; Tabellengrößen (`chat_messages`, `event_bookings`, `notifications`). Nachtrag 26.09.: bei ≤ 150 Teilnehmenden je Instanz zur Bestätigung der Dimensionierung, nicht mehr entscheidend.
10. `EXPLAIN (ANALYZE, BUFFERS)` der Terminliste mit echter Org-ID — läuft die View über alle Buchungen? Nachtrag 26.09.: nur relevant, falls das Betriebsmodell eine gemeinsame Instanz bleibt (Punkt 25).
11. Traefik-Access-Log: `grep -c 'chat/files/[a-f0-9]*?token='` (Token in URLs) und `DELETE /api/events/<id>/book` durch Konfi-Konten.
12. `SELECT COUNT(*) FROM users WHERE deleted_at IS NOT NULL AND last_login_at > deleted_at;` — soft-gelöschte, weiter aktive Konten.
13. `SELECT user_id, COUNT(*) FROM refresh_tokens WHERE revoked_at IS NULL GROUP BY 1 ORDER BY 2 DESC LIMIT 20;` — Wiederverwendung der Gnadenfrist.
14. Dauer eines FCM-`send()` und Anteil „Keine Push-Tokens" im Log; Dauer und Push-Zahl des Zähler-Laufs nach dem nächsten Deploy.
15. `curl -s https://konfi-quest.de/api/status | jq .version` (erwartet fälschlich `1.0.1`) und `docker exec … node -v`.
16. Sicherung: Alter und Größe des letzten Dumps, Rückspielprobe in eine leere Datenbank, Überwachung aus `offene-befunde.md` #3.
17. Am Gerät: Flugmodus → `Network.getStatus()`; Abmeldung von einem Termin im Funkloch (Warteschlange oder Fehler?); VoiceOver auf der Anmeldeseite; Systemschriftgröße „Größt".

## Dunkelmodus — Antwort auf die Rückmeldung „nach wie vor unglücklich"

Der Bereichsbericht `darkmode.md` hat den Dunkelmodus nicht gelesen, sondern angesehen: 400
Screenshots (drei Rollen, iPhone- und Android-Kennung, hell gegen dunkel, 104 Modale) und eine
Messung über 94 Seitenzustände, die jedes sichtbare Element auf helle Flächen und
Kontrastverstöße prüft. Ergebnis: **0 helle Flächen** (die Grundlage steht), aber **104
Textstellen unter der WCAG-Grenze**, davon die schwersten auf der Anmeldeseite (Überschrift und
Links in Konfi-Lila auf dunkler Karte, 1,4–1,7:1) und auf den Dashboards (weiße Schrift auf
Verlaufsenden, die im Dunkeln hell werden, 1,3–1,9:1).

Die Ursache dafür, dass die Karten auf dem iPhone weiter „nicht abgesetzt" wirken, ist gefunden
und gemessen: Die Karten-Regel der App (`ion-card.app-card:not(.ios-theme-disabled)`,
`variables.css:396`) verliert auf iOS an Spezifität gegen die Regel des ios27-Themes
(`ion-card.ios:not(…):not(.ion-color)`); `--background` fällt auf Ionics `#1c1c1d` statt auf das
App-Token `#242426`. Auf Android greift das Token. Im Hellmodus enden beide Wege bei Weiß, deshalb
fiel es nie auf. Fünf Karten wurden einzeln per Inline-Style geflickt, rund 200 nicht. Dazu bleiben
Ionics eigene Flächenvariablen (`--ion-item-background` u. a.) auf iOS bei `#000000`, weshalb
Suchfelder und Inset-Listen wie schwarze Löcher im dunkelgrauen Seitengrund stehen. Die drei
Dunkelmodus-Testdateien sind grün, weil sie das Stylesheet als Text prüfen und den Token statt
des Renderings messen.

Die Koordination hat die Theme-Regel im Paket, die App-Regel, die beiden Verlaufsenden auf
Text-Tokens und die fünf Inline-Flicken am Code bestätigt und die Bilder der Anmeldeseite und der
Konfi-Verwaltung gesichtet. Was daraus folgt, steht in Punkt 18a (vor Release, wenige Stunden)
und Punkt 34 (systematischer Weg, 9–10 Personentage).

## Nachtrag 26.09. — Rahmen korrigiert: Einzelinstanzen und moderierte Chats

Nach der ersten Fassung hat Simon zwei Prämissen korrigiert: Die EKD-Ausrollung geschieht in
**Einzelinstanzen mit höchstens 150 Teilnehmenden**, nicht als gemeinsame Instanz für 25.000;
und **alle Chats sind moderiert, Konfi-zu-Konfi-Chat gibt es nicht.** Beides ist gegen den
Code geprüft, die Bereichsberichte bleiben unverändert (ihre Messwerte stimmen weiter), die
Bewertung in dieser Abnahme ändert sich wie folgt.

**Am Code geprüft:**

- `backend/routes/chat.js:456-459`: `POST /direct` weist einen Konfi, der einen Konfi
  anschreibt, mit 403 ab („Konfis können keine anderen Konfis anschreiben"). Konfis erreichen
  Team und Leitung nur über einen gemeinsamen Jahrgang (`teamAnschreibenVerboten`). Gruppen-,
  Jahrgangs- und Termin-Räume darf die Leitung lesen, exportieren und darin löschen
  (`darfRaumOeffnen`, laut Chat-Bericht und Handbuch `90-chat.md:147-161`); Zweiergespräche
  sind privat, auch vor der Leitung — das ist Absicht.
- Die Zusage hält an genau einer Stelle nicht: `POST /chat/rooms` nimmt den Typ `direct` mit
  beliebig vielen Teilnehmenden an, sobald der Aufrufer kein Konfi ist (Chat BF-01, vom
  Bereich reproduziert, von der Koordination mit eigenem Test bestätigt). Der Befund bleibt
  Blocker 5 und wird durch die Prämisse wichtiger, nicht unwichtiger.
- `frontend/src/services/api.ts:8`: `import.meta.env.VITE_API_URL || 'https://konfi-quest.de/api'`
  — eine Adresse je Build. `ios-release.yml:14-17` nimmt `api_url` als Eingabe („LEER =
  Produktion. Fuer Tests: …"), `android-release.yml` kennt keine solche Eingabe. Eine
  Instanzwahl in der App existiert nicht (Suche nach `serverUrl`, `apiBaseUrl`, „Server
  wählen" im Frontend: nur `api.ts`).

**Was sich ändert:**

| Befund | Erste Fassung | Jetzt | Grund |
|---|---|---|---|
| S-16 Melden/Blockieren | MITTEL, vor Ausrollung HOCH | NIEDRIG, Produktentscheidung (Punkt 31) | Konfis treffen einander nur in Räumen, die die Leitung liest; Blockieren hat kein Ziel |
| S-04 Terminlisten-View | HOCH für die Ausrollung | NIEDRIG (Punkt 37) | 100 ms je Aufruf bei ≤ 150 Teilnehmenden ohne spürbare Wirkung |
| S-18 Postgres-Dimensionierung | HOCH für die Ausrollung | MITTEL (Punkt 26) | CPU-Anteil entfällt; Sicherung/Wiederherstellung bleibt und gilt je Instanz |
| Betrieb BF-03/BF-04/BF-06/BF-11 | vor Ausrollung | Danach (Punkt 37) | Kapazitätsbefunde ohne Nutzerwirkung bei dieser Größe |
| Betrieb BF-01 Replica-Absturz | vor Ausrollung | **vor Release** (Punkt 14, unverändert) | von der Größe unabhängig; jeder Datenbank-Neustart trifft jede Instanz |
| Datenbank BF-01 Indizes | HOCH | MITTEL (Punkt 27) | Löschpfad wächst mit der Laufzeit, nicht mit der Zielgröße; Fix bleibt zwei Zeilen |
| Sicherheit BF-01 Super-Admin-Übernahme | KRITISCH, „Übernahme aller Gemeinden" | KRITISCH, Übernahme einer Instanz | Schwere als Rechteausweitung unverändert, Tragweite je Instanz begrenzt |
| Chat BF-01 `direct`-Raum ohne Leitungszugriff | HOCH, Blocker 5 | HOCH, Blocker 5 — einzige Lücke in der Moderationszusage | siehe oben |
| S-20 Datenschutz-Dokumentation | MITTEL, vor Ausrollung HOCH | MITTEL, je Instanz und Träger (Punkt 28) | von der Größe unabhängig |
| Neu: Betriebsmodell der Instanzen | — | **entschieden: eine Datenbank, Instanz = Organisation** (Punkt 25) | Simons Antwort vom 26.09.; damit kehren S-04, S-18 und Betrieb BF-03/BF-04/BF-06/BF-11/BF-13 in voller Schwere vor die Ausrollung zurück |

**Was gleich bleibt:** die vier Blocker, alle Auflagen 8–24, die Release-Entscheidung.
Die Zählung „216 Befunde" bleibt, weil die Bereichsberichte nicht verändert wurden; die
Verschiebungen betreffen nur die Bewertung in dieser Abnahme.

**Feature-Empfehlungen unter den neuen Prämissen:** E-15 (Melden/Stummschalten) verliert
seinen Platz in den Top 10 und wird Produktentscheidung. E-03 (Gemeinden anlegen), E-10/E-26
(Verbandssicht) und E-11 (Vorlagenkatalog) hängen vollständig an Punkt 25: Bei getrennten
Installationen braucht ein Vorlagenkatalog ein Austauschformat zwischen Instanzen statt einer
gemeinsamen Tabelle, und eine Verbandssicht über mehrere Instanzen ist ein anderes Produkt.
Der Feature-Bericht ist nicht umgeschrieben; seine Top-10-Liste liest sich mit dieser Fußnote.

## Behebungsstand (fortlaufend)

Stand 26.09.2026, 16:15 UTC. Jeder Eintrag steht als Commit auf `claude/fervent-edison-wp5yfj`,
jeder Befund trägt im Bereichsbericht eine Status-Zeile mit Datum. Regeln für jeden Fix: Test
für den verbotenen und den erlaubten Fall, Gegenprobe (Fix raus → Test rot), CHANGELOG,
Handbuch, API-Doku, Antwortformen unverändert, Migrationen additiv.

**Volle Suiten auf dem zusammengeführten Stand (Commit `fac0b361`, 71 Commits):**

| Suite | Ergebnis |
|---|---|
| Frontend (`vitest`, jsdom) | 271 Dateien, 3.864 Tests grün, 149 s |
| Backend (`vitest`, echte DB, Migrationen 160–166) | 153 Dateien, 3.593 Tests grün, 1.336 s |
| Typprüfung, ESLint (`--quiet`, jetzt CI-Gate) | grün |

**Pakete:**

| Paket | Inhalt | Befunde | Stand |
|---|---|---|---|
| Blocker (Koordination) | Super-Admin-Übernahme, Einladung fremder Konfis, Direktchat nur zu zweit, Eingeladene verwaltbar, Registrierung mit Refresh-Token | Sicherheit BF-01/BF-03, Chat BF-01, Leitung BF-01, Grundgerüst BF-03 | eingebaut (`0f2bd4db`, `1c953171`, `40f16971`, `260b82b7`, `853ab400`) |
| A Dunkelmodus, fünf Auflagen | Anmeldeseite 1,4 → 8,4:1, Dashboards 1,3 → 9,1:1, Kartenregel (0,4,1) gegen ios27-Theme, Reaktionszähler, Befördern-Knopf; Messskript | darkmode BF-01/02/03/07/08 | eingebaut |
| B CI und Release | Release-Tor (Store-Build nur von `main` nach grünem CI-Lauf desselben SHA), Deploy-Rewrite nur Live-Dienste (auch Notfall-Deploy), `concurrency`, `tsc`+`vite build`, kein `--passWithNoTests`, `npm audit` ab hoch, Lint bei Push, 19 ESLint-Fehler bereinigt; Store-Text-Prüfung gehärtet | CI BF-01/03/04/07/12, Tests BF-07/08, Toolchain BF-01/08, S-06, S-07 | eingebaut (Workflow-Dateien nach Rechtevergabe in `02bf4045`) |
| C Skalierung A | Indizes `chat_messages` (Löschen 1.000 Nachrichten 32 s → 10 ms), Terminlisten je Termin statt View (77 ms → 2 ms), Datenbank-Abbruch beendet Replicas nicht mehr (mit zwei Instanzen nachgewiesen) | Datenbank BF-01/02, Betrieb BF-01/03, S-04 | eingebaut |
| D Fachliche HOCH-Befunde | Vortags-Erinnerung 24 h vor Beginn ± 15 min mit Laufmerker, Wiederanmeldung nach Abmeldung, Wartelisten-Abmeldung, Stornoregeln auf beiden Wegen, Rückblicke überleben Jahrgangslöschung (Migration 162), kein Retry schreibender Anfragen ohne Idempotenzschlüssel | S-05, Screens BF-01/02, Punkte/Termine BF-01, Chat BF-02, Grundgerüst BF-02 | eingebaut |
| E Sicherheit MITTEL | Reset-Limiter je Absender und je E-Mail, `password_plain` geleert (Migration 165), Soft-Delete an Login/Refresh/Middleware, Refresh-Gnadenfrist genau einmal (Migration 166), SMTP-Zertifikatsprüfung, RBAC-Cache bei Deaktivierung/Löschung, `X-Real-IP` nur vom Proxy, keine Adress-Fallbacks im Code | Sicherheit BF-05/06/07/08/09/10/12/13 (13 teilweise), S-01 | eingebaut |
| F Barrierefreiheit Anmeldeseiten | Feldnamen, Links als Links, Enter sendet, Alarm-Regionen, Fokusring, `lang="de"`; Layout pixelgleich | UI BF-02/05/08, BF-01 teilweise, S-24/K-04 | eingebaut |
| G Dokumentation | Store-Texte 2.3.0, Handbuch gegen Code, API-Rollen, Abrissliste gegen Tag 2.2.0, offene Befunde, README, Kommentare | Doku BF-01/02/03/04/05/06/07/09/11/12/14/15/17/19 (teils teilweise), S-12, S-14, S-22 | eingebaut |
| H Tests | 40 Tests „fremde Gemeinde → 403/404" für 21 Routen (keine Route gab fremde Daten preis), zehn weiche Assertions geschärft | Tests BF-01/05/06 | eingebaut |
| J Multi-Gemeinde-Restlücken | Eingeladene in Gruppenchats, Team-Rückblick je Gemeinde, eigener Rückblick der aktiven Gemeinde, 403-Rückfall mit Token ohne Org-Claim und Socket-Neuaufbau | Chat BF-04/06/08, Grundgerüst BF-05, S-02 | eingebaut |
| L Punktwert am Zuordnungsdatensatz | `user_activities.points` (Migration 163, Backfill ≤ 13 s bei 1 Mio. Zeilen), Vergabe/Rücknahme/Reset/Historie/Listen lesen den vergebenen Wert | Punkte/Termine BF-02 | eingebaut |
| Koordination, Hygiene | Betriebsadressen aus Compose, Abrissliste, Skript und Berichten; Gesamtabnahme-Nachträge | S-15, Sicherheit BF-12 | eingebaut |
| I1 Skalierung B1 | Chat-Fan-out, doppelte `newMessage`, Sammelversand der Erinnerungen, App-Icon-Lauf, Registrierungs-Pushes | Betrieb BF-02/04/05/08/15 | **läuft** |
| I2 Skalierung B2 | Limiter-Store, Cron-Leader, Graceful Shutdown, Wrapped-Parallelität, Deploy ohne Lücke, Postgres-Ressourcen, `statement_timeout` für Migrationen, Metrics-Grenze, Startseeding, Sicherungsdoku | Betrieb BF-06/07/09/10/11/12/13/14/16, Datenbank BF-03/04/05/07, S-10, S-11, S-18, S-19 | **läuft** |
| K Dunkelmodus systematisch | Flächen-Stufenleiter, Text-Token je Bereichsfarbe (234 Stellen), Grautöne, Messung als Test | darkmode BF-04/05/06/09/11, UI BF-04, S-26 | **läuft** |

**Noch nicht begonnen:** Barrierefreiheit über die Anmeldeseiten hinaus (Punkt 33: rund 150
Felder, 147 klickbare `div`, Berührungsziele, Modalnamen — nach Paket K, weil beide dieselben
Komponenten anfassen), Handbuch-Bilder aus dem Store-Bundle (S-17), Feature-Empfehlungen A
(Punkt 32), Rechenschaft/Datenschutz (Punkt 28, Produkt- und Rechtsfragen), CHANGELOG-Doppelabschnitte
(Punkt 19, zum Schluss durch die Koordination), NIEDRIG-Befunde (Punkt 36).

**Bei Simon:**

1. Apple-Schlüssel `7AQA623H3T` und `A29U7SN796` widerrufen oder Widerruf bestätigen (Blocker 3).
2. Vor dem Deploy in Portainer: `SMTP_HOST`, `SMTP_USER`, `SMTP_HOST_IP` als Stack-Variablen;
   SMTP-Zertifikat gegen den Hostnamen prüfen (`openssl s_client -connect <SMTP_HOST>:465
   -servername <SMTP_HOST>`), sonst Notnagel `SMTP_TLS_REJECT_UNAUTHORIZED=false`.
3. Vor dem Deploy in Produktion zählen: `SELECT count(*) FILTER (WHERE password_plain IS NOT NULL)
   FROM konfi_profiles;` (Migration 165 leert danach), `SELECT count(*) FROM user_activities;`
   (Backfill der Migration 163 muss unter 30 s bleiben; gemessen 13 s bei 1 Mio. Zeilen).
4. Postgres-Ressourcen und `PG_POOL_MAX` im Portainer-Stack angleichen, sobald Paket I2 die
   Referenz-Compose geändert hat.
5. Autor-Identität der 71 älteren Branch-Commits (teils „Claude"): Force-Push zum Umschreiben
   erlauben, per Squash-Merge auflösen oder selbst umschreiben. Neue Commits laufen als `Revisor01`.
6. Nach dem Deploy: Screenshots neu ziehen (Punkt 22), Produktionsmessungen aus dem Abschnitt
   „Auf Produktion nachzumessen".

**Entscheidungen, die in der Umsetzung getroffen wurden und die Simon kippen kann:** Vortags-Erinnerung
zur gleichen Uhrzeit am Vortag (24 h ± 15 min) statt zu einer festen Tageszeit; Konfis als
Einladungsziel antworten wie unbekannte Kennungen (Team-Konten bleiben auffindbar); in einer weiteren
Gemeinde lassen sich nur Rolle und Jahrgänge ändern, Kontofelder bleiben bei der Stamm-Gemeinde;
Refresh-Gnadenfrist genau eine Wiederverwendung, die dritte widerruft alle Tokens des Kontos;
SMTP-Zertifikatsprüfung standardmäßig streng.

## Dateien dieses Audits

| Datei | Inhalt |
|---|---|
| `00-gesamtabnahme.md` | diese Abnahme |
| `backend-fachlogik-punkte-termine.md` | Punkte, Aktivitäten, Termine, Jahrgänge, Abzeichen, Level |
| `backend-fachlogik-chat-challenges-rueckblick.md` | Chat, Challenges, Rückblick, Material, Postfach, Push, E-Mail, Hintergrundjobs |
| `backend-sicherheit-datenschutz.md` | Mandantentrennung, Rechte, Authentifizierung, Uploads, Datenschutz, Geheimnisse |
| `datenbank-migrationen.md` | Schema-Quellen, Migrationen, Integrität, Indizes, Sicherung |
| `app-grundgeruest.md` | Anmeldung, Sitzung, Navigation, Offline, Push-Empfang, Umschalter |
| `app-screens-konfi-teamer.md` | Screens Konfi und Teamer, Chat-Oberfläche, Rückblick |
| `app-screens-leitung.md` | Screens der Leitung, Organisationsverwaltung |
| `ui-barrierefreiheit.md` | Barrierefreiheit, Konsistenz, Screenshots, Web-Variante |
| `darkmode.md` | Dunkelmodus: Screen-Matrix, Messung über 94 Zustände, Ursachenanalyse, empfohlener Weg |
| `tests-testinfrastruktur.md` | Backend-, Frontend-, E2E-Tests, Gegenproben, CI-Testjobs |
| `ci-deployment-store.md` | Workflows, Images, Deploy, Release-Prozess, iOS/Android-Store-Reife |
| `dokumentation-gegen-code.md` | Handbuch, API-Doku, CHANGELOG, README, Kommentare |
| `toolchain-abhaengigkeiten.md` | npm-Projekte, Lizenzen, Node, Lint/TS-Konfiguration, native Toolchain |
| `betrieb-skalierung.md` | Lastprofil, Messungen bei Zielgröße, Replicas, Jobs, Kapazitätsaussage |
| `feature-empfehlungen.md` | 33 Produktempfehlungen für die EKD-Ausrollung, Top 10, offene Fragen |
