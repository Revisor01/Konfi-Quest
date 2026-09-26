# Gesamtabnahme Release-Audit Konfi Quest 2.3.0 — 26.09.2026

Koordination über 15 Bereichsprüfungen. Gegenstand: Repo `Revisor01/Konfi-Quest`, Stand
`fce1ab01` (main, „chore(release): Android 124, iOS-Build 230"). Anlass: Verkauf an die EKD,
Zielgröße 10.000–25.000 Nutzer:innen pro Jahr (nicht anwachsend), überwiegend Minderjährige.

## Release-Entscheidung

**2.3.0 in dieser Fassung: nicht freigeben.** Ein KRITISCHER Befund und drei HOHE liegen in
Code, der mit 2.3.0 neu dazukommt oder von den 2.3.0-Funktionen abhängt:

1. Ein Org-Admin kann das Passwort jedes Super-Admin-Kontos derselben Stamm-Gemeinde setzen
   und übernimmt damit die gesamte Instanz (Sicherheit BF-01, von der Koordination
   reproduziert). Für eine Instanz mit Hunderten Gemeinden ist das die Übernahme aller.
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

**EKD-Ausrollung (Skalierung auf 25.000): eigenes Gate, heute nicht erfüllt.** Der Betrieb
trägt die heutigen rund 110 Konten; bei Zielgröße sättigt die Datenbank (0,3 CPU) bei etwa
drei App-Starts oder 0,65 Chat-Nachrichten je Sekunde, und ein Verbindungsabbruch zur
Datenbank beendet beide Backend-Replicas gleichzeitig (Betrieb BF-01, von der Koordination
reproduziert). Dazu fehlen für Minderjährige an dieser Zahl Melden/Blockieren im Chat, die
Einwilligungsdokumentation und die Rechenschaftsunterlagen (Abschnitt „Vor EKD-Ausrollung").

Kein Bereich hat einen Vertragsbruch gegenüber den Store-Apps 2.2.x gefunden. Die
Mandantentrennung hält in 150 gezielten Fremdzugriffen. Die Testsuiten sind grün und fangen
in 11 von 15 Gegenproben echte Fehler. Das ist die gute Nachricht; sie ändert nichts an den
vier Punkten oben.

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
| S-04 | Terminlisten materialisieren die View `event_booking_stats` über alle Buchungen aller Gemeinden (83–119 ms bei 150.000 Buchungen statt 1,2 ms) | Datenbank BF-02, Betrieb BF-03, Punkte/Termine „Unklar" | HOCH für die Ausrollung |
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
| S-16 | Kein Melden/Blockieren im Chat für Minderjährige | Screens Konfi/Teamer BF-06, Feature E-15 | MITTEL (vor EKD-Ausrollung HOCH) |
| S-17 | 42 Screenshots zeigen den Stand 2.2.x (10.09.), werden aber als Store-Bilder genutzt und mit 33 MB in jedes Store-Bundle kopiert; 27 davon referenziert kein Handbuchkapitel | UI BF-09, Toolchain BF-02, Doku BF-18 | MITTEL |
| S-18 | Postgres mit 0,3 CPU / 1 GB, `PG_POOL_MAX` nicht im Compose, keine Sicherung/Wiederherstellung im Repo beschrieben | Datenbank BF-05/BF-07, Betrieb BF-13 | HOCH für die Ausrollung |
| S-19 | `/api/metrics/history?days=730` liefert 31–35 MB | Datenbank BF-16, Betrieb BF-14 | NIEDRIG |
| S-20 | Datenschutz-Dokumentation: Stand „Juni 2026", Multi-Gemeinde-Datenfluss fehlt, kein Verweis auf Verarbeitungsverzeichnis/TOM/AVV, Crashlytics ohne Abschaltmöglichkeit, Einwilligung außerhalb der App | Doku BF-08, Sicherheit BF-22, Grundgerüst BF-13, Feature E-01 | MITTEL (vor EKD-Ausrollung HOCH) |
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
   genau eine weitere Person). Bestand in Produktion prüfen (SQL im Bericht).
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

### Vor EKD-Ausrollung — Skalierung, Jugendschutz, Rechenschaft

25. **S-04 (HOCH):** Terminlisten ohne View-Materialisierung (Aggregat je Termin, Antwortform
    unverändert). Gemessen 100 ms → 1,2 ms.
26. **Betrieb BF-04 (HOCH):** Chat-Fan-out über `sendToMultipleUsers`, `total_unread`-Schleife
    streichen; Ziel < 50 Abfragen je Nachricht.
27. **Betrieb BF-02 (HOCH):** App-Icon-Lauf nach Neustart nur Merker füllen, Laufmerker gegen
    Überlappung.
28. **Datenbank BF-01 (HOCH):** Indizes auf `chat_messages(reply_to)` und `chat_messages(user_id)`
    (Migration 160). Gemessen: 1.000 Nachrichten löschen 31,4 s → 12,6 ms.
29. **S-18 (HOCH):** Postgres auf ≥ 2 CPU und 2–4 GB, `shared_buffers` anheben, `PG_POOL_MAX`
    ins Compose; `statement_timeout` für Lock- und Migrationsverbindung auf 0; Sicherung und
    Wiederherstellung im Repo beschreiben und einmal üben.
30. **Betrieb BF-06/BF-09/BF-10/BF-11 (MITTEL):** Wrapped-Parallelität begrenzen; gemeinsamer
    Limiter-Store; Cron-Leader per Advisory-Lock mit Sichtbarkeit; Sammel-Logzeilen.
31. **Jugendschutz (S-16, S-20):** „Nachricht melden" und Stummschalten im Chat;
    Datenschutzerklärung auf 2.3.0 (Multi-Gemeinde, Crashlytics, Umami); Verweis auf
    Verarbeitungsverzeichnis, TOM, AVVs; Einwilligung dokumentieren (Feature E-01); Crashlytics
    abschaltbar.
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

36. S-06 bis S-09, S-11 bis S-15, S-19, S-21 bis S-24 und die NIEDRIG-Befunde aller Berichte;
    Backend-Lint einführen; Frontend-Tests von Quelltext- auf gerenderte Prüfungen umstellen;
    Vorlagenkatalog, Kalender-Export, CSV-Import und die übrigen Feature-Empfehlungen B/C nach
    Produktentscheidung.

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
9. `docker stats` und `cpu.stat throttled` der Postgres an einem Abend; `SHOW statement_timeout`; Cache-Trefferquote `pg_stat_database`; Tabellengrößen (`chat_messages`, `event_bookings`, `notifications`).
10. `EXPLAIN (ANALYZE, BUFFERS)` der Terminliste mit echter Org-ID — läuft die View über alle Buchungen?
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
